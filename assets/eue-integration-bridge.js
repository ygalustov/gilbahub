/**
 * =============================================================================
 * EUE INTEGRATION BRIDGE v1.0.0
 * =============================================================================
 * 
 * Wires the Environmental Utilisation Efficiency engine (GSSH_EUE) into:
 *   1. Shade orchestrator pipeline (shade result → EUE enrichment)
 *   2. LED prescription model (EUE-adjusted hours + spectral recommendations)
 *   3. Stadium tab UI (venue readiness card + environmental factor display)
 * 
 * This bridge makes GSSH_EUE a live participant in the analysis cascade
 * rather than a standalone calculation module.
 * 
 * DATA FLOW:
 *   gssh:shadeOrchestratorComplete → EUE calculation with climate + venue data
 *   → EUE result stored on hubState.computed.eue
 *   → gssh:eueCalculated event dispatched
 *   → LED model re-run with EUE-adjusted parameters
 *   → Stadium tab UI updated with venue readiness card
 * 
 * Also listens for:
 *   gssh:climateFetchComplete → recalculate with fresh weather data
 *   gssh:venueEnvironmentChanged → recalculate when user changes venue config
 *   gssh:speciesChanged → recalculate with new species pathway
 * 
 * @requires environmental-utilisation-engine.js (GSSH_EUE)
 * @requires shade-orchestrator.js (shade result)
 * @requires climate-engine.js (weather data)
 * @version 1.0.0
 * =============================================================================
 */

(function(global) {
    'use strict';

    var VERSION = '1.0.0';

    function log(context, msg) {
        console.log('[EUE-Bridge:' + context + '] ' + msg);
    }

    /* =========================================================================
       STATE
    ========================================================================= */

    var _lastEUE = null;
    var _lastShade = null;
    var _lastClimate = null;
    var _lastParams = null;  // Stored for what-if projections
    var _venueEnvConfig = null;  // User-configured venue environment
    var _initialized = false;
    var _venueTransitioning = false;  // True while waiting for new venue's climate data
    var _pendingVenueCoords = null;   // { lat, lng } of venue awaiting climate data

    /* =========================================================================
       VENUE ENVIRONMENT CONFIG
       
       These are the parameters the user configures for their stadium that
       aren't available from weather APIs: enclosure type, drainage quality,
       CO₂ management, height of cut per zone, etc.
       
       Stored in the hub's persistence layer alongside other site config.
    ========================================================================= */

    var DEFAULT_VENUE_ENV = {
        enclosureType: 'open',            // open | partial | retractable_open | retractable_closed | fixed_roof | enclosed | enclosed_enriched
        drainageRating: null,             // null = derive from construction type in buildParams(). 0-1 scale when user-set.
        hocMM: null,                      // Height of cut in mm (null = use species default)
        managementGoal: 'maintenance',    // maintenance | strengthening | recovery | establishment
        hasFans: false,                   // Active airflow management?
        estimatedAirflowMs: null,         // Override if known (m/s)
        co2Management: 'none',            // none | ventilation_schedule | enrichment
        co2ppm: null,                     // Override if measured (ppm)
        hasSubSoilHeating: false,         // Under-pitch heating system?
        irrigationAdjustedForLED: false,  // Has irrigation been recalibrated for LED transpiration demand?
        sessionStartHour: null,           // Hour (0-23) when LED session begins; used to derive isDaytimeSession for spectral prescription
        // b35fix177: overseed toggle — null = auto (calendar-based Feb–Sep AU),
        // true = force overseed active, false = force overseed inactive
        overseedActive: null
    };

    /**
     * Get the current venue environment configuration.
     * Reads from hub persistence or falls back to defaults.
     */
    function getVenueEnvConfig() {
        if (_venueEnvConfig) return _venueEnvConfig;

        // Try to read from hub persistence
        var persistence = global.GSSH_Persistence || global.gsshPersistence;
        if (persistence && typeof persistence.get === 'function') {
            var saved = persistence.get('venueEnvironment');
            if (saved && typeof saved === 'object') {
                _venueEnvConfig = mergeDefaults(saved, DEFAULT_VENUE_ENV);
                return _venueEnvConfig;
            }
        }

        // Try hub state
        var hubState = global._gsshHubState || global.GSSH_STATE || {};
        if (hubState.site && hubState.site.venueEnvironment) {
            _venueEnvConfig = mergeDefaults(hubState.site.venueEnvironment, DEFAULT_VENUE_ENV);
            return _venueEnvConfig;
        }

        _venueEnvConfig = Object.assign({}, DEFAULT_VENUE_ENV);
        return _venueEnvConfig;
    }

    /**
     * Update venue environment config and trigger recalculation.
     */
    function setVenueEnvConfig(config) {
        _venueEnvConfig = mergeDefaults(config, DEFAULT_VENUE_ENV);

        // Persist
        var persistence = global.GSSH_Persistence || global.gsshPersistence;
        if (persistence && typeof persistence.set === 'function') {
            persistence.set('venueEnvironment', _venueEnvConfig);
        }

        // Store in hub state
        var hubState = global._gsshHubState || global.GSSH_STATE || {};
        if (!hubState.site) hubState.site = {};
        hubState.site.venueEnvironment = _venueEnvConfig;

        log('config', 'Venue environment updated: ' + JSON.stringify(_venueEnvConfig));

        // Dispatch change event
        document.dispatchEvent(new CustomEvent('gssh:venueEnvironmentChanged', {
            detail: _venueEnvConfig
        }));

        // Recalculate
        recalculate('config_change');
    }

    function mergeDefaults(obj, defaults) {
        var result = Object.assign({}, defaults);
        if (obj && typeof obj === 'object') {
            var keys = Object.keys(obj);
            for (var i = 0; i < keys.length; i++) {
                var v = obj[keys[i]];
                if (v !== undefined && v !== null) {
                    // b35fix252: drainageRating of exactly 0.85 is the old hardcoded
                    // default — treat it as unset so buildParams() can apply the
                    // construction-aware default. Users who explicitly want 0.85 can
                    // set it via the dropdown (which saves the chosen value).
                    if (keys[i] === 'drainageRating' && v === 0.85 &&
                        defaults.drainageRating === null) {
                        continue; // skip — let buildParams() derive from construction
                    }
                    result[keys[i]] = v;
                }
            }
        }
        return result;
    }

    /* =========================================================================
       CORE EUE CALCULATION
    ========================================================================= */

    /**
     * Build EUE params from available data sources and run calculation.
     */
    function recalculate(trigger) {
        if (typeof global.GSSH_EUE === 'undefined') {
            log('calc', 'GSSH_EUE module not loaded, skipping');
            return null;
        }

        var envConfig = getVenueEnvConfig();
        var params = buildParams(envConfig);

        if (!params) {
            log('calc', 'Insufficient data for EUE calculation');
            return null;
        }

        log('calc', 'Running EUE calculation (trigger: ' + trigger + ') species: ' + params.species + ' pathway: ' + (global.GSSH_EUE.getPathway ? global.GSSH_EUE.getPathway(params.species) : 'N/A'));

        // Store params for what-if projections
        _lastParams = JSON.parse(JSON.stringify(params));

        // Run calculation
        _lastEUE = global.GSSH_EUE.calculate(params);

        // b35fix176 G7: per-zone DLI breakdown
        // Populate zoneEUE from shade result zones when the radial profile
        // returned per-zone DLI. We retain the zoneEUE name for API
        // compatibility with the UI renderer, but no longer call
        // GSSH_EUE.calculate() per zone — EUE is uniform across the pitch
        // (climate is the same everywhere); DLI sufficiency is the meaningful
        // per-zone metric and is computed in renderZoneBreakdown() against
        // the species DLI target from the shade engine thresholds.
        _lastEUE.zoneEUE = null;
        if (_lastShade && Array.isArray(_lastShade.zones) && _lastShade.zones.length > 1) {
            var zonesWithDLI = _lastShade.zones.filter(function(z) {
                return z.dli != null && typeof z.dli === 'number';
            });
            if (zonesWithDLI.length > 1) {
                _lastEUE.zoneEUE = zonesWithDLI.map(function(z) {
                    return {
                        zoneId:          z.zone_id,
                        zoneName:        z.zone_name || z.zone_id,
                        dli:             z.dli,
                        shadeFactor:     z.shade_factor,
                        transmissionPct: z.transmission_pct
                    };
                });
                log('G7', 'Zone DLI: ' + _lastEUE.zoneEUE.map(function(z) {
                    return z.zoneId + '=' + z.dli.toFixed(1) + 'mol';
                }).join(', '));
            }
        }

        // b35fix173 G2: auto-switch managementGoal based on wear recovery days.
        // If the wear engine reports 7+ day recovery, override the manual goal to
        // 'recovery' so the spectral prescription switches to red-dominant post-event mode.
        // This is non-destructive — we store the override on _lastEUE and pass it to
        // the spectral call; we do NOT mutate the saved venueConfig (user's manual
        // setting is preserved and reinstated once recoveryDays drops below threshold).
        var _effectiveGoal = envConfig.managementGoal || 'maintenance';
        var _wearAutoGoal  = null;
        if (params.wearRecoveryDays != null) {
            if (params.wearRecoveryDays >= 7) {
                _wearAutoGoal = 'recovery';
                log('G2', 'Wear recovery ' + params.wearRecoveryDays.toFixed(1) + ' days >= 7, spectral goal auto-switched to recovery');
            } else if (params.wearRecoveryDays >= 4) {
                _wearAutoGoal = 'strengthening';
                log('G2', 'Wear recovery ' + params.wearRecoveryDays.toFixed(1) + ' days >= 4, spectral goal auto-switched to strengthening');
            }
        }
        if (_wearAutoGoal && _wearAutoGoal !== _effectiveGoal) {
            _effectiveGoal = _wearAutoGoal;
            _lastEUE.managementGoalAutoSwitch = {
                from: envConfig.managementGoal || 'maintenance',
                to: _wearAutoGoal,
                reason: 'Wear recovery ' + (typeof params.wearRecoveryDays === 'number' ? params.wearRecoveryDays.toFixed(1) : '?') + ' days',
                recoveryDays: params.wearRecoveryDays
            };
        }
        _lastEUE._effectiveManagementGoal = _effectiveGoal;

        // Enrich with venue-specific context
        _lastEUE.venueConfig = envConfig;
        _lastEUE.trigger = trigger;
        _lastEUE.hocConfig = {
            hocMM: envConfig.hocMM,
            goal: _effectiveGoal  // b35fix173 G2: use auto-switched goal if wear triggered it
        };

        // HOC-aware DLI target
        if (envConfig.hocMM) {
            _lastEUE.hocTarget = global.GSSH_EUE.getDLIForHOC(
                params.species,
                envConfig.hocMM,
                _effectiveGoal  // b35fix173 G2
            );
        }

        // Spectral prescription (for multi-channel equipment)
        // Pass environment data for seasonal adjustment
        var equipment = getActiveEquipment();
        var spectralEnv = null;
        if (params.airTempC || _lastClimate) {
            spectralEnv = {
                airTempC: params.airTempC || null,
                dliMol: null,
                isDaytimeSession: (function() {
                    // Derive from session start hour if available, otherwise solar data
                    var startHour = envConfig.sessionStartHour;
                    if (typeof startHour === 'number') {
                        return startHour >= 6 && startHour < 20;
                    }
                    // Fall back to solar elevation or DLI: if DLI is effectively zero, treat as overnight
                    if (_lastClimate) {
                        var dli = _lastClimate.dli || (_lastClimate.solar && _lastClimate.solar.dli) || null;
                        if (dli !== null) return dli > 1;
                    }
                    return null; // unknown — no adjustment applied
                })()
            };
            // Try to get DLI from climate metrics or hub state
            if (_lastClimate) {
                spectralEnv.dliMol = _lastClimate.dli || 
                    (_lastClimate.solar && _lastClimate.solar.dli) || null;
            }
            if (!spectralEnv.dliMol) {
                var cs = (global.GSSH_CANONICAL_STATE || {}).climate || {};
                spectralEnv.dliMol = (cs.solar && cs.solar.dli) || null;
            }
        }
        _lastEUE.spectral = global.GSSH_EUE.getSpectralPrescription(
            params.species,
            _effectiveGoal,  // b35fix173 G2: use auto-switched goal if wear triggered it
            equipment,
            spectralEnv,
            params.c3Fraction
        );

        // Irrigation advisory
        _lastEUE.irrigationAdvisory = buildIrrigationAdvisory(envConfig, _lastEUE);

        // b35fix335: sessionProtocol advisory rewritten — pre-fix text cited a fabricated
        // "Sawannarut et al. 2024" paper (Tier 1 provenance audit). Real sources for the
        // gradual-ramping direction are Stamford et al. 2024 (rocket, full-photoperiod
        // sinusoidal regimes) and Lawson & Vialet-Chabrand 2019 (stomatal kinetics
        // outpacing rapid intensity steps). Neither paper specifies a 20–30 min onset/
        // offset ramp duration — that figure is a Gilba practitioner heuristic and is
        // labelled as such in the advisory text.
        _lastEUE.sessionProtocol = (function() {
            var compositeEUE = _lastEUE.compositeEUE || 0;
            // Recommend ramp only when conditions actually support useful photosynthesis
            var rampMinutes = compositeEUE >= 0.5 ? 20 : 30;
            return {
                rampUpAdvisory: 'Ramp up intensity gradually over ~' + rampMinutes + ' min using ' +
                    'existing dimmer controls. Gradual ramping allows stomata to open progressively ' +
                    'ahead of peak PPFD delivery, reducing photooxidative shock and improving ' +
                    'early-session CO\u2082 uptake (directional support: Stamford et al. 2024 ' +
                    'on full-photoperiod sinusoidal regimes; Lawson & Vialet-Chabrand 2019 on ' +
                    'stomatal kinetics). The ' + rampMinutes + ' min figure is a Gilba practitioner ' +
                    'heuristic, not a published session-onset duration.',
                rampDownAdvisory: 'Ramp down intensity over ~' + rampMinutes + ' min before ' +
                    'session end. Abrupt cutoff when stomata are fully open causes transient ' +
                    'water stress and elevates tissue temperature without photosynthetic benefit. ' +
                    'Gradual reduction maintains gas exchange balance and minimises post-session ' +
                    'stress (directional support: Stamford et al. 2024; Lawson & Vialet-Chabrand 2019).',
                rampDurationMin: rampMinutes,
                rampDurationProvenance: 'Gilba practitioner heuristic (no published session-duration source)',
                citation: 'Stamford et al. 2024 + Lawson & Vialet-Chabrand 2019 (directional only)'
            };
        })();

        // What-if projections — show improvement cascade for any sub-optimal factors
        _lastEUE.projections = buildProjections(_lastParams, _lastEUE);

        // b35fix173 G3: PGR/DMI → LED hours advisory
        // PGR suppresses growth, reducing the DLI requirement during the suppression window.
        // DMI fungicide has the same effect via sterol biosynthesis interference.
        // Neither should cause the LED programme to deliver more light than the
        // suppressed-growth plant can utilise — doing so wastes energy and overshoots GP.
        // We emit a structured advisory rather than mutating PHP-calculated hours, since the
        // hours come from the server-side seasonal planner which has no live PGR state.
        (function() {
            var pgrResult = global.GAIP_PGR_RESULT;
            var dmiResult = global.GAIP_DMI_RESULT;
            var combinedSupp = global.GAIP_COMBINED_SUPPRESSION;

            var pgrSuppPct = (pgrResult && pgrResult.effect && pgrResult.effect.suppression != null)
                ? pgrResult.effect.suppression : 0;
            var adjSuppPct = (pgrResult && pgrResult.effect && pgrResult.effect.adjustedSuppression)
                ? (pgrResult.effect.adjustedSuppression.combinedPct || pgrSuppPct) : pgrSuppPct;
            var dmiActive = dmiResult && dmiResult.active;
            var dmiLevel  = dmiResult && dmiResult.suppressionLevel ? dmiResult.suppressionLevel : null;

            if (adjSuppPct < 10 && !dmiActive) return; // nothing material

            // DLI reduction factor: suppressed plant needs proportionally less light
            // to hit target GP. Relationship is approximately linear at moderate suppression.
            var dliReductionFactor = Math.min(adjSuppPct / 100, 0.55); // cap at 55% — beyond that other limits dominate
            var reducedHours = null;
            if (_lastEUE.ledRecommendation && _lastEUE.ledRecommendation.hours) {
                reducedHours = Math.max(
                    Math.round(_lastEUE.ledRecommendation.hours * (1 - dliReductionFactor * 0.7)),
                    1
                );
            }

            var advisory = {
                active: true,
                pgrSuppression: adjSuppPct > 0 ? Math.round(adjSuppPct) : null,
                dmiActive: dmiActive,
                dmiLevel: dmiLevel,
                combinedRisk: combinedSupp ? combinedSupp.riskLevel : null,
                dliReductionPct: Math.round(dliReductionFactor * 100),
                reducedLEDHours: reducedHours,
                message: (function() {
                    var parts = [];
                    if (adjSuppPct >= 10) parts.push('PGR active (' + Math.round(adjSuppPct) + '% growth suppression)');
                    if (dmiActive) parts.push('DMI fungicide active' + (dmiLevel ? ' (' + dmiLevel + ')' : ''));
                    return parts.join(' + ') +
                        ', plant DLI requirement reduced ~' + Math.round(dliReductionFactor * 100) + '%.' +
                        (reducedHours ? ' Consider reducing LED session to ~' + reducedHours + 'h to avoid energy waste.' : '');
                })(),
                citation: 'Kreuser & Soldat (2012) Crop Sci 52:1177; Kageyama et al. (2015) J Jpn Soc Turfgrass Sci 44:14'
            };

            _lastEUE.pgrDmiLEDAdvisory = advisory;
            log('G3', 'PGR/DMI LED advisory: ' + advisory.message);
        })();

        // Inject into hub state
        injectIntoHubState(_lastEUE);

        // Dispatch event for UI consumers
        document.dispatchEvent(new CustomEvent('gssh:eueCalculated', {
            detail: _lastEUE
        }));

        log('calc', 'EUE complete, composite: ' + _lastEUE.compositeEUE +
            ' readiness: ' + _lastEUE.venueReadiness.status +
            ' limiting: ' + (_lastEUE.primaryLimitingFactor ? _lastEUE.primaryLimitingFactor.factor : 'none'));

        return _lastEUE;
    }

    /**
     * Build EUE params from climate data, hub state, and venue environment config.
     */
    function buildParams(envConfig) {
        var params = {
            species: null,
            soilTempC: null,
            airTempC: null,
            humidityPct: null,
            windSpeedMs: null,
            co2ppm: envConfig.co2ppm || null,
            venueEnclosure: envConfig.enclosureType || 'open',
            drainageRating: envConfig.drainageRating,
            soilMoisturePct: null,
            equipmentFeatures: null
        };

        // b35fix252: construction-aware drainage default.
        // If the user hasn't explicitly set drainageRating in the venue env config,
        // seed a sensible default from the venue's construction type rather than
        // falling through to the EUE engine's generic 0.85 default (which sits
        // exactly on the <= 0.85 'improvable' threshold, falsely flagging sand
        // carpet venues like Marvel Stadium for drainage infrastructure upgrades).
        if (params.drainageRating === null || params.drainageRating === undefined) {
            var _construction = null;
            if (global.GSSH_CANONICAL_STATE && global.GSSH_CANONICAL_STATE.inputs &&
                global.GSSH_CANONICAL_STATE.inputs.turf) {
                _construction = global.GSSH_CANONICAL_STATE.inputs.turf.construction || null;
            }
            var _drainageByConstruction = {
                'sand_carpet':      0.95,  // USGA/PURR-WICK profile — excellent drainage by design
                'sand_ameliorated': 0.90,  // Ameliorated native soil — good but not optimal
                'native_soil':      0.70,  // Variable — conservative default
                'push_up':          0.65,  // Push-up green construction — drainage dependent on age
                'organic':          0.65   // High OM retention — drainage often limiting
            };
            params.drainageRating = (_construction && _drainageByConstruction[_construction] !== undefined)
                ? _drainageByConstruction[_construction]
                : 0.85; // unchanged generic default for unknown construction
        }

        // Species resolution — multiple sources, prioritised for reliability
        // 1. TurfProfile controller (most authoritative, always current)
        // 2. GSSH_CANONICAL_STATE (populated by orchestrator)
        // 3. hubState.turf (can be stale after computeAll rewrites inputs)
        // 4. DOM species selector (fallback)
        var hubState = global._gsshHubState || global.GSSH_STATE || {};
        
        var turfProfile = global.GaipTurfProfile || global.GSSH_TurfProfile;
        if (turfProfile && turfProfile.getState) {
            var tpState = turfProfile.getState();
            if (tpState && tpState.species) {
                params.species = tpState.effectiveSpecies || tpState.species;
            }
        }
        if (!params.species && global.GSSH_CANONICAL_STATE && global.GSSH_CANONICAL_STATE.turf) {
            params.species = global.GSSH_CANONICAL_STATE.turf.effectiveSpecies || 
                             global.GSSH_CANONICAL_STATE.turf.species || null;
        }
        if (!params.species && hubState.turf) {
            params.species = hubState.turf.effectiveSpecies || hubState.turf.species || null;
        }
        if (!params.species) {
            // Try DOM
            var speciesEl = document.querySelector('.gssh-species');
            if (speciesEl) params.species = speciesEl.value || null;
        }
        if (!params.species) {
            params.species = 'couch'; // Final fallback for stadium context
        }

        // Overseed blend fraction — used for spectral prescription blending
        params.c3Fraction = 0;
        if (global.GSSH_CANONICAL_STATE && global.GSSH_CANONICAL_STATE.turf &&
            global.GSSH_CANONICAL_STATE.turf.speciesFractions) {
            params.c3Fraction = global.GSSH_CANONICAL_STATE.turf.speciesFractions.c3Fraction || 0;
        } else if (turfProfile && typeof turfProfile.getState === 'function') {
            var tpFractions = turfProfile.getState();
            if (tpFractions && typeof tpFractions.c3Fraction === 'number') {
                params.c3Fraction = tpFractions.c3Fraction;
            }
        }

        // Climate data — always use the freshest available source.
        // During a venue transition (_venueTransitioning=true), ALL cached climate
        // sources are stale (from the previous venue). Skip them and let the
        // no-data defaults (0.85 efficiency @ confidence 0.3) apply until the
        // async climate fetch completes for the new coordinates.
        if (!_venueTransitioning) {
            var climateSource = null;
            if (global.climateMetrics && global.climateMetrics.temperature) {
                climateSource = global.climateMetrics;
            } else if (_lastClimate) {
                climateSource = _lastClimate;
            }
            
            if (climateSource && typeof global.GSSH_EUE.fromClimateMetrics === 'function') {
                var bridged = global.GSSH_EUE.fromClimateMetrics(climateSource, hubState, envConfig);
                // Merge bridged data but keep our overrides
                params.soilTempC = bridged.soilTempC;
                params.airTempC = bridged.airTempC;
                params.humidityPct = bridged.humidityPct;
                params.windSpeedMs = bridged.windSpeedMs;
                params.soilMoisturePct = bridged.soilMoisturePct;
            }
        } else {
            log('params', 'Venue transitioning, skipping stale climate data, using defaults');
        }

        // Direct temperature extraction — rawWeatherData is the most reliable source
        // (same as hub's getTemperature priority chain)
        // Skip during venue transition as rawWeatherData is also stale.
        if (params.airTempC == null && !_venueTransitioning) {
            var raw = global.rawWeatherData;
            if (raw && raw.forecast && raw.forecast.hourly && raw.forecast.hourly.temperature_2m) {
                var hours = raw.forecast.hourly.time || [];
                var temps = raw.forecast.hourly.temperature_2m;
                var now = new Date();
                var nowHour = now.getFullYear() + '-' + 
                    String(now.getMonth() + 1).padStart(2, '0') + '-' + 
                    String(now.getDate()).padStart(2, '0') + 'T' + 
                    String(now.getHours()).padStart(2, '0') + ':00';
                for (var hi = 0; hi < hours.length; hi++) {
                    if (hours[hi] === nowHour) {
                        params.airTempC = temps[hi];
                        break;
                    }
                }
                // Fallback: first temperature in the forecast
                if (params.airTempC == null && temps.length > 0) {
                    params.airTempC = temps[0];
                }
            }
        }

        // climateMetrics.temperature.mean as last resort
        if (params.airTempC == null && !_venueTransitioning && global.climateMetrics && global.climateMetrics.temperature) {
            var cm = global.climateMetrics.temperature;
            params.airTempC = cm.todayMean != null ? cm.todayMean : cm.mean;
        }

        // Estimate soil temp from air temp if not available
        if (params.soilTempC == null && params.airTempC != null) {
            params.soilTempC = params.airTempC * 0.85 + 3;
        }

        // Humidity from climateMetrics if not set
        if (params.humidityPct == null && !_venueTransitioning && global.climateMetrics && global.climateMetrics.moisture && global.climateMetrics.moisture.humidity) {
            params.humidityPct = global.climateMetrics.moisture.humidity.mean || global.climateMetrics.moisture.humidity.current;
        }
        // Fallback from rawWeatherData
        if (params.humidityPct == null && !_venueTransitioning && global.rawWeatherData) {
            var rawH = global.rawWeatherData;
            if (rawH.forecast && rawH.forecast.hourly && rawH.forecast.hourly.relative_humidity_2m) {
                params.humidityPct = rawH.forecast.hourly.relative_humidity_2m[0];
            }
        }

        // Airflow override from venue config (indoor venues may have fan data)
        if (envConfig.estimatedAirflowMs != null) {
            params.windSpeedMs = envConfig.estimatedAirflowMs;
        } else if (envConfig.hasFans && (params.windSpeedMs == null || params.windSpeedMs < 0.3)) {
            // Venue has fans but no measurement — assume minimum functional airflow
            params.windSpeedMs = 0.5;
        }

        // CO₂ management adjustments
        if (envConfig.co2Management === 'enrichment') {
            params.venueEnclosure = 'enclosed_enriched';
        }

        // Equipment features
        var equipment = getActiveEquipment();
        if (equipment && equipment.features) {
            params.equipmentFeatures = equipment.features;
        }

        // Attach venueConfig so chemistry coupling can access
        // irrigationAdjustedForLED, overseedApplicationDate, manualECe
        params.venueConfig = envConfig;

        // Also pass overseed season flag from GSSH context
        var ctx = global.GSSH_CONTEXT || {};
        params.isOverseedSeason = ctx.overseed_active || false;

        // b35fix177: when ryegrass overseed is active, switch EUE species and
        // c3Fraction so the spectral prescription, limiting factor labels, and
        // advisory text all reflect the ryegrass sward rather than the C4 base.
        // Calendar logic mirrors getThresholds() in shade-orchestrator.js:
        // Feb–Sep = ryegrass dominant, Oct–Jan = base species.
        // Manual override (venueConfig.overseedActive) takes priority.
        (function() {
            var overseedOverride = envConfig.overseedActive;
            var useOverseed = false;
            if (overseedOverride === true) {
                useOverseed = true;
            } else if (overseedOverride === false) {
                useOverseed = false;
            } else {
                var mo = new Date().getMonth(); // 0=Jan
                useOverseed = (mo >= 1 && mo <= 8); // Feb–Sep
            }
            // Only apply for warm-season base species
            var warmKeys = ['couch', 'bermuda', 'kikuyu', 'zoysia', 'buffalo',
                            'couch_grass', 'hybrid_couch'];
            var baseKey = (params.species || '').toLowerCase().replace(/\s+/g, '_');
            var isWarmBase = warmKeys.some(function(k) { return baseKey.indexOf(k) !== -1; });
            if (useOverseed && isWarmBase) {
                params.species     = 'Perennial Ryegrass';
                params.c3Fraction  = 1;
                params.isOverseedSeason = true;
                log('overseed', 'EUE params switched to ryegrass (overseed active, base: ' + baseKey + ')');
            }
        }());

        // b35fix173 G2: wear/traffic → managementGoal auto-switch
        // Read recoveryDays from the wear engine output (orchestrator path or hub-tissue path).
        // The EUE managementGoal drives the spectral prescription — after a heavy traffic event
        // where the wear engine reports 7+ day recovery, we must switch to 'recovery' mode
        // automatically rather than relying on the agronomist to change it manually.
        var wearData = null;
        var canon = global.GAIP_CANONICAL_STATE || {};
        if (canon.wear && canon.wear.recoveryDays != null) {
            wearData = canon.wear;
        } else if (hubState.computed && hubState.computed.wear) {
            wearData = hubState.computed.wear;
        } else if (global.GAIP_STATE && global.GAIP_STATE.wearMetrics) {
            wearData = global.GAIP_STATE.wearMetrics;
        }
        if (wearData) {
            // Prefer adjustedRecovery (DLI-corrected) over raw recoveryDays
            var rd = (wearData.adjustedRecovery && wearData.adjustedRecovery.adjustedDays != null)
                ? wearData.adjustedRecovery.adjustedDays
                : (wearData.recoveryDays != null ? wearData.recoveryDays : null);
            params.wearRecoveryDays = rd;
            params.wearStatus = wearData.stressStatus || null;
        }

        // Need at least species and some weather to be useful
        if (!params.species) return null;
        if (params.airTempC == null && params.soilTempC == null) {
            log('params', 'No temperature data available, attempting with defaults');
        }

        return params;
    }

    /**
     * Get the currently selected equipment spec from the rig calculator.
     */
    function getActiveEquipment() {
        // Check hub state for selected equipment
        var hubState = global._gsshHubState || global.GSSH_STATE || {};
        if (hubState.stadium && hubState.stadium.equipment) {
            return hubState.stadium.equipment;
        }

        // Check coverage slider state
        var slider = global.GSSH_CoverageSlider || global.gsshCoverageSlider;
        if (slider && slider.getSelectedRig) {
            return slider.getSelectedRig();
        }

        return null;
    }

    /* =========================================================================
       IRRIGATION ADVISORY
       
       The most commonly overlooked consequence of LED deployment.
       
       When PPFD increases under supplemental LED:
       - Transpiration rate increases proportionally
       - VPD demand rises (LED may warm local environment)
       - Irrigation schedule must be recalibrated
       - Drainage must handle increased volume
    ========================================================================= */

    function buildIrrigationAdvisory(envConfig, eueResult) {
        var advisory = {
            recalibrationRequired: false,
            urgency: 'none',
            warnings: [],
            actions: []
        };

        // If LED is prescribed and irrigation hasn't been adjusted
        if (!envConfig.irrigationAdjustedForLED) {
            advisory.recalibrationRequired = true;
            advisory.urgency = 'important';
            advisory.warnings.push(
                'Irrigation schedule has not been recalibrated for LED operation. ' +
                'Supplemental light increases transpiration proportionally to PPFD delivered. ' +
                'Existing irrigation may be insufficient under LED, leading to stomatal closure ' +
                'and wasted photon energy.'
            );
            advisory.actions.push({
                action: 'Recalibrate irrigation frequency and volume for LED operation',
                priority: 'high',
                detail: 'Establish baseline transpiration under natural light, then model ' +
                        'the increase under proposed LED PPFD and hours. Target VPD 0.5–1.2 kPa ' +
                        'at canopy height during LED operation.',
                source: null
            });
        }

        // VPD-specific warning
        if (eueResult && eueResult.factors && eueResult.factors.vpd) {
            var vpd = eueResult.factors.vpd;
            if (vpd.efficiency < 0.7 && vpd.value > 1.2) {
                advisory.urgency = 'critical';
                advisory.warnings.push(
                    'VPD at ' + vpd.value + ' kPa exceeds stomatal closure threshold (1.2 kPa). ' +
                    'Photosynthesis stalls regardless of PPFD. Increase irrigation frequency.'
                );
                advisory.actions.push({
                    action: 'Install VPD monitoring at canopy height',
                    priority: 'high',
                    detail: 'VPD must be the management metric during LED operation, not soil moisture alone.',
                    source: null
                });
            }
        }

        // Drainage + increased irrigation volume risk
        if (envConfig.drainageRating && envConfig.drainageRating < 0.6) {
            advisory.warnings.push(
                'Drainage rated below adequate. Increasing irrigation volume for LED operation ' +
                'risks rhizosphere anaerobia. Verify drainage capacity before increasing watering.'
            );
            advisory.actions.push({
                action: 'Verify drainage capacity for increased irrigation volume',
                priority: 'medium',
                detail: 'Over-irrigation to compensate for LED-driven transpiration, combined with ' +
                        'inadequate drainage, creates anaerobic root conditions that suppress root function.',
                source: null
            });
        }

        return advisory;
    }

    /* =========================================================================
       WHAT-IF PROJECTION ENGINE
       
       For each limiting factor, determines the environment change that would
       resolve it, then re-runs GSSH_EUE.calculate() with cumulative fixes.
       Produces a chain showing: current → fix #1 → fix #1+#2 → ... → best case.
    ========================================================================= */

    /**
     * Remediation strategies keyed by factor name.
     * Each provides:
     *   - label:  human-readable intervention name
     *   - fix:    function(params) that returns modified params with this factor resolved
     *   - detail: what specifically changes
     */
    var REMEDIATION_MAP = {
        rootZoneTemp: {
            label: function(p) {
                var pathway = global.GSSH_EUE.getPathway(p.species);
                var target = (pathway === 'c3') ? 15 : 22;
                return (p.soilTempC != null && p.soilTempC > target)
                    ? 'Reduce root-zone temperature (syringe/shade/ventilation)'
                    : 'Install sub-soil heating';
            },
            fix: function(p) {
                var pathway = global.GSSH_EUE.getPathway(p.species);
                // C3 optimal midpoint: 15°C, C4: 22°C
                p.soilTempC = (pathway === 'c3') ? 15 : 22;
                return p;
            },
            detail: function(p) {
                var pathway = global.GSSH_EUE.getPathway(p.species);
                var target = (pathway === 'c3') ? 15 : 22;
                if (p.soilTempC != null && p.soilTempC > target) {
                    return 'Lower root-zone temperature toward ' + target + '\u00b0C via syringe cycles, surface shading, or increased ventilation';
                }
                return 'Raise root-zone temperature to ' + target + '\u00b0C';
            }
        },
        leafTemp: {
            label: 'Enclosed environment with climate control',
            fix: function(p) {
                var pathway = global.GSSH_EUE.getPathway(p.species);
                // C3 midpoint: 15°C, C4: 25°C
                var target = (pathway === 'c3') ? 15 : 25;
                if (p.airTempC != null && p.airTempC < target) {
                    p.airTempC = target;
                    // Soil temp follows air temp in heated enclosure
                    if (p.soilTempC != null && p.soilTempC < target) {
                        p.soilTempC = target * 0.85 + 3;
                    }
                }
                if (p.airTempC != null && p.airTempC > target + 10) {
                    // Heat stress — cooling
                    p.airTempC = target + 5;
                }
                p.venueEnclosure = 'fixed_roof';
                return p;
            },
            detail: function(p) {
                var pathway = global.GSSH_EUE.getPathway(p.species);
                var target = (pathway === 'c3') ? 15 : 25;
                return 'Control air temperature to ~' + target + '\u00b0C via enclosure';
            }
        },
        vpd: {
            label: 'Humidity management',
            fix: function(p) {
                // Optimal VPD range 0.5-1.2 kPa. At 15°C air, ~65% RH gives VPD ~0.55
                // At 25°C air, ~55% RH gives VPD ~0.85
                var temp = p.airTempC || 15;
                if (temp < 20) {
                    p.humidityPct = 65;
                } else {
                    p.humidityPct = 55;
                }
                return p;
            },
            detail: function(p) {
                return 'Regulate humidity for VPD 0.5\u20131.2 kPa';
            }
        },
        airflow: {
            label: 'Install circulation fans',
            fix: function(p) {
                p.windSpeedMs = 0.5; // gentle circulation
                return p;
            },
            detail: function(p) {
                return 'Provide 0.5 m/s airflow across canopy';
            }
        },
        co2: {
            label: 'CO\u2082 ventilation or supplementation',
            fix: function(p) {
                // Either enrich or at least ventilate to ambient
                if (p.venueEnclosure === 'fixed_roof' || p.venueEnclosure === 'enclosed') {
                    p.venueEnclosure = 'enclosed_enriched';
                    p.co2ppm = 600; // moderate enrichment
                } else {
                    p.co2ppm = 410; // ambient outdoor
                    p.windSpeedMs = Math.max(p.windSpeedMs || 0, 0.3);
                }
                return p;
            },
            detail: function(p) {
                if (p.venueEnclosure === 'enclosed_enriched') {
                    return 'Supplement CO\u2082 to 600 ppm in enclosed venue';
                }
                return 'Ensure adequate ventilation for CO\u2082 replenishment';
            }
        },
        rhizosphere: {
            label: 'Improve drainage infrastructure',
            fix: function(p) {
                p.drainageRating = 0.9;
                p.soilMoisturePct = 35; // healthy field capacity
                return p;
            },
            detail: function(p) {
                return 'Upgrade drainage to maintain aerobic root zone';
            }
        }
    };

    /**
     * Build progressive what-if projections.
     * 
     * @param {object} baseParams  - The params used for the current calculation
     * @param {object} eueResult   - The current EUE result with limitingFactors
     * @returns {object} Projection chain
     */
    function buildProjections(baseParams, eueResult) {
        if (!baseParams || !eueResult || !eueResult.factors) return null;
        if (typeof global.GSSH_EUE === 'undefined') return null;

        // Don't project if already near-perfect
        if (eueResult.compositeEUE >= 0.95) return null;

        // Collect ALL sub-optimal factors (at or below 0.85), sorted worst-first
        var improvable = [];
        var factorKeys = Object.keys(eueResult.factors);
        var isOpenVenue = (baseParams.venueEnclosure === 'open' || baseParams.venueEnclosure === 'partial' ||
                           !baseParams.venueEnclosure);
        for (var f = 0; f < factorKeys.length; f++) {
            var key = factorKeys[f];
            var factor = eueResult.factors[key];
            // b35fix252: use < not <= so efficiency of exactly 0.85 is not flagged.
            // The default drainage rating is 0.85 — 'adequate', not 'needs improvement'.
            if (factor.efficiency < 0.85 && REMEDIATION_MAP[key]) {
                // Don't recommend fans for open venues with no wind data —
                // outdoor airflow is adequate by default; the null reading
                // just means the API didn't return wind speed, not that
                // the venue is stagnant.
                if (key === 'airflow' && isOpenVenue && factor.source === 'no_data') {
                    continue;
                }
                // Don't recommend sub-soil heating/cooling for open venues when
                // soil temp is estimated from air temp — there's no actionable
                // intervention for ambient rootzone temp outdoors.
                if (key === 'rootZoneTemp' && isOpenVenue && factor.source !== 'measured') {
                    continue;
                }
                improvable.push({
                    factor: key,
                    efficiency: factor.efficiency,
                    severity: factor.severity || 'moderate'
                });
            }
        }

        log('projections', 'Sub-optimal factors: ' + improvable.map(function(x) { return x.factor + '=' + x.efficiency; }).join(', ') || 'none');

        if (improvable.length === 0) return null;

        // Sort by efficiency ascending (worst first)
        improvable.sort(function(a, b) { return a.efficiency - b.efficiency; });

        var steps = [];
        var runningParams = JSON.parse(JSON.stringify(baseParams));
        var previousEUE = eueResult.compositeEUE;
        var fixedFactors = [];

        for (var i = 0; i < Math.min(improvable.length, 4); i++) {
            var target = improvable[i];
            var remedy = REMEDIATION_MAP[target.factor];
            if (!remedy) continue;

            // Apply this fix cumulatively
            runningParams = remedy.fix(runningParams);
            fixedFactors.push(target.factor);

            // Re-run the EUE calculation with cumulative fixes
            var projected = global.GSSH_EUE.calculate(runningParams);

            var newEUE = projected.compositeEUE;
            var improvement = newEUE - previousEUE;

            // Only include if it actually improves things
            if (improvement < 0.01) continue;

            var newLimiter = projected.primaryLimitingFactor;

            steps.push({
                intervention: (typeof remedy.label === 'function') ? remedy.label(runningParams) : remedy.label,
                detail: remedy.detail(runningParams),
                factorFixed: target.factor,
                cumulativeFixedFactors: fixedFactors.slice(),
                previousEUE: +previousEUE.toFixed(2),
                projectedEUE: +newEUE.toFixed(2),
                improvement: +improvement.toFixed(2),
                improvementPct: Math.round(improvement * 100),
                newLimiter: newLimiter ? newLimiter.factor : null,
                newLimiterLabel: newLimiter ? (global.GSSH_EUE.FACTOR_LABELS || {})[newLimiter.factor] || newLimiter.factor : null,
                readiness: projected.venueReadiness
            });

            previousEUE = newEUE;

            // Stop if we've reached excellent performance
            if (newEUE >= 0.95) break;
        }

        if (steps.length === 0) return null;

        return {
            currentEUE: +eueResult.compositeEUE.toFixed(2),
            bestCaseEUE: steps.length > 0 ? steps[steps.length - 1].projectedEUE : eueResult.compositeEUE,
            totalImprovement: steps.length > 0 ? +(steps[steps.length - 1].projectedEUE - eueResult.compositeEUE).toFixed(2) : 0,
            steps: steps,
            stepsCount: steps.length
        };
    }

    /* =========================================================================
       HUB STATE INJECTION
    ========================================================================= */

    function injectIntoHubState(eueResult) {
        var hubState = global._gsshHubState || global.GSSH_STATE;
        // If neither exists, create _gsshHubState so the reference is stable
        if (!hubState) {
            global._gsshHubState = {};
            hubState = global._gsshHubState;
        }
        if (!hubState.computed) hubState.computed = {};

        var euePayload = {
            compositeEUE: eueResult.compositeEUE,
            weightedEUE: eueResult.weightedEUE,
            factors: eueResult.factors,
            limitingFactors: eueResult.limitingFactors,
            primaryLimitingFactor: eueResult.primaryLimitingFactor,
            venueReadiness: eueResult.venueReadiness,
            advisory: eueResult.advisory,
            hocTarget: eueResult.hocTarget || null,
            spectral: eueResult.spectral || null,
            irrigationAdvisory: eueResult.irrigationAdvisory || null,
            wastedPhotonPct: eueResult.wastedPhotonPct,
            pathway: eueResult.pathway,
            confidence: eueResult.confidence,
            // b35fix173/174: G2 wear auto-switch fields
            _effectiveManagementGoal: eueResult._effectiveManagementGoal || null,
            managementGoalAutoSwitch: eueResult.managementGoalAutoSwitch || null,
            // b35fix173/174: G3 PGR/DMI LED advisory
            pgrDmiLEDAdvisory: eueResult.pgrDmiLEDAdvisory || null,
            // Session protocol (sinusoidal ramp)
            sessionProtocol: eueResult.sessionProtocol || null,
            projections: eueResult.projections || null,
            // b35fix176 G7: per-zone EUE (null when no zone DLI from shade engine)
            zoneEUE: eueResult.zoneEUE || null,
            timestamp: Date.now()
        };

        hubState.computed.eue = euePayload;

        // Also make EUE available to shade engine's LED model
        // The shade engine checks for this in its ledSupplementationModel()
        hubState.computed.eueForLED = eueResult;

        // Sync to GSSH_CANONICAL_STATE via getter — the orchestrator's
        // populateCanonicalState() can overwrite direct property assignments,
        // so we use a live getter that always reads from the working state.
        if (global.GSSH_CANONICAL_STATE && !global.GSSH_CANONICAL_STATE._eueGetterInstalled) {
            try {
                Object.defineProperty(global.GSSH_CANONICAL_STATE, 'eue', {
                    get: function() {
                        var s = global._gsshHubState || global.GSSH_STATE;
                        return s && s.computed ? s.computed.eue : undefined;
                    },
                    configurable: true,
                    enumerable: true
                });
                global.GSSH_CANONICAL_STATE._eueGetterInstalled = true;
            } catch (e) {
                // Fallback: direct assignment (may be overwritten by orchestrator)
                global.GSSH_CANONICAL_STATE.eue = euePayload;
            }
        }
    }

    /* =========================================================================
       EVENT LISTENERS
    ========================================================================= */

    /**
     * Fetch climate data for a new venue's coordinates.
     * Uses the hub's climate engine (gssh_climate_fetch) if available,
     * falls back to direct Open-Meteo API call.
     * On success, updates _lastClimate, clears transition flag, recalculates.
     */
    function fetchClimateForVenue(lat, lng) {
        // Build a minimal state object for the climate engine
        var today = new Date();
        var startDate = today.getFullYear() + '-' +
            String(today.getMonth() + 1).padStart(2, '0') + '-' +
            String(today.getDate()).padStart(2, '0');
        
        // Resolve current species for growth calculations
        var turfProfile = global.GaipTurfProfile || global.GSSH_TurfProfile;
        var species = 'couch';
        var c3Fraction = 0;
        var c4Fraction = 1;
        if (turfProfile && turfProfile.getState) {
            var tpState = turfProfile.getState();
            if (tpState && tpState.species) {
                species = tpState.effectiveSpecies || tpState.species;
            }
        }
        var pathway = (typeof global.GSSH_EUE !== 'undefined' && global.GSSH_EUE.getPathway) 
            ? global.GSSH_EUE.getPathway(species) : 'c4';
        if (pathway === 'c3') { c3Fraction = 1; c4Fraction = 0; }
        else if (pathway === 'c4') { c3Fraction = 0; c4Fraction = 1; }

        var fetchState = {
            climate: {
                lat: lat,
                lon: lng,
                useLiveWeather: true,
                period: { start: startDate },
                forecastDays: 8,
                historical: { enabled: false }
            },
            turf: {
                species: { c3Fraction: c3Fraction, c4Fraction: c4Fraction },
                speciesName: species
            }
        };

        // Prefer the hub's climate engine (includes soil temp, humidity, radiation)
        if (typeof global.gssh_climate_fetch === 'function') {
            global.gssh_climate_fetch(fetchState).then(function(rawData) {
                if (!rawData || !rawData.forecast) {
                    log('climate', 'Climate engine returned no data for venue');
                    _venueTransitioning = false;
                    _pendingVenueCoords = null;
                    return;
                }

                // Calculate metrics from raw data
                var metrics = null;
                if (typeof global.gssh_climate_calculate_metrics === 'function') {
                    metrics = global.gssh_climate_calculate_metrics(rawData, fetchState);
                }

                if (metrics) {
                    _lastClimate = metrics;
                    // Also update window.climateMetrics so other modules benefit
                    global.climateMetrics = metrics;
                    log('climate', 'Venue climate fetched and metrics calculated, air temp: ' +
                        (metrics.temperature ? (metrics.temperature.todayMean || metrics.temperature.mean) : 'N/A') + '°C');
                } else {
                    // Use raw data directly as fallback
                    _lastClimate = rawData;
                    log('climate', 'Venue climate fetched (raw, no metrics calculated)');
                }

                // Also update rawWeatherData for other consumers
                global.rawWeatherData = rawData;

                _venueTransitioning = false;
                _pendingVenueCoords = null;
                recalculate('venue_climate_fetch');
            }).catch(function(err) {
                log('climate', 'Climate fetch failed: ' + err.message + ', falling back to API');
                fetchClimateFromAPI(lat, lng);
            });
        } else {
            // Direct Open-Meteo fallback
            fetchClimateFromAPI(lat, lng);
        }
    }

    /**
     * Direct Open-Meteo API fallback when climate engine is unavailable.
     */
    function fetchClimateFromAPI(lat, lng) {
        var url = (global.GSSH_HUB_CONFIG && global.GSSH_HUB_CONFIG.openMeteoUrl || 
                   'https://api.open-meteo.com/v1/forecast') +
            '?latitude=' + lat +
            '&longitude=' + lng +
            '&hourly=temperature_2m,relative_humidity_2m,wind_speed_10m' +
            '&wind_speed_unit=ms' +
            '&timezone=auto';

        fetch(url).then(function(response) {
            if (!response.ok) throw new Error('API ' + response.status);
            return response.json();
        }).then(function(data) {
            if (!data || !data.hourly) {
                log('climate', 'Open-Meteo returned no hourly data');
                _venueTransitioning = false;
                _pendingVenueCoords = null;
                return;
            }

            // Extract current hour temperature
            var hours = data.hourly.time || [];
            var temps = data.hourly.temperature_2m || [];
            var humidity = data.hourly.relative_humidity_2m || [];
            var wind = data.hourly.wind_speed_10m || [];
            var now = new Date();
            var nowHour = now.getFullYear() + '-' +
                String(now.getMonth() + 1).padStart(2, '0') + '-' +
                String(now.getDate()).padStart(2, '0') + 'T' +
                String(now.getHours()).padStart(2, '0') + ':00';
            
            var currentTemp = temps[0];
            var currentHumidity = humidity[0];
            var currentWind = wind[0];
            for (var i = 0; i < hours.length; i++) {
                if (hours[i] === nowHour) {
                    currentTemp = temps[i];
                    currentHumidity = humidity[i];
                    currentWind = wind[i];
                    break;
                }
            }

            // Build a minimal climateMetrics-compatible object
            _lastClimate = {
                temperature: {
                    current: currentTemp,
                    todayMean: currentTemp,
                    mean: currentTemp
                },
                moisture: {
                    humidity: { mean: currentHumidity, current: currentHumidity }
                },
                wind: { mean: currentWind }
            };

            // Update global sources so buildParams and other modules get fresh data
            global.climateMetrics = _lastClimate;
            // Only overwrite rawWeatherData if the existing version doesn't already
            // have shortwave_radiation — the hub's full fetch includes it and the
            // shade orchestrator's DLI resolution depends on it. Overwriting with
            // this minimal response (temp/humidity/wind only) would cause hub_dli
            // to come back null on the orchestrator's second shade AJAX call.
            var existingHourly = global.rawWeatherData &&
                (global.rawWeatherData.hourly || (global.rawWeatherData.forecast && global.rawWeatherData.forecast.hourly));
            var hasShortwave = existingHourly && existingHourly.shortwave_radiation;
            if (!hasShortwave) {
                global.rawWeatherData = data;
            }

            log('climate', 'Open-Meteo fallback: air temp ' + currentTemp + '°C');
            _venueTransitioning = false;
            _pendingVenueCoords = null;
            recalculate('venue_climate_fetch');
        }).catch(function(err) {
            log('climate', 'Open-Meteo fallback failed: ' + err.message);
            _venueTransitioning = false;
            _pendingVenueCoords = null;
            // Will use no-data defaults (0.85 @ confidence 0.3)
        });
    }

    function setupListeners() {
        // Primary trigger: shade analysis complete
        document.addEventListener('gssh:shadeOrchestratorComplete', function(e) {
            _lastShade = e.detail;
            recalculate('shade_complete');
        });

        // Climate data updated (from external source)
        document.addEventListener('gssh:climateFetchComplete', function(e) {
            _lastClimate = e.detail;
            _venueTransitioning = false;
            _pendingVenueCoords = null;
            recalculate('climate_update');
        });

        // Climate metrics calculated (v2.1 dual-metrics format)
        document.addEventListener('gssh:climateMetricsCalculated', function(e) {
            if (e.detail && e.detail.metrics) {
                _lastClimate = e.detail.metrics;
            } else {
                _lastClimate = e.detail;
            }
            _venueTransitioning = false;
            _pendingVenueCoords = null;
            recalculate('climate_metrics');
        });

        // Species changed
        document.addEventListener('gssh:speciesChanged', function() {
            recalculate('species_change');
        });

        // Turf profile changed (may include HOC change)
        document.addEventListener('gssh:turfProfileChange', function() {
            recalculate('turf_profile');
        });

        // Venue environment config changed (from UI)
        document.addEventListener('gssh:venueEnvironmentChanged', function() {
            // Already handled in setVenueEnvConfig, but catch external dispatches
        });

        // Venue location changed — invalidate cached climate data and fetch
        // weather for the new coordinates. During the async fetch, all EUE
        // calculations use no-data defaults (0.85 @ confidence 0.3) rather
        // than stale temps from the previous venue.
        document.addEventListener('gssh:venueSelect', function(e) {
            var detail = e.detail || {};
            if (detail.lat && detail.lng) {
                log('climate', 'Venue changed to ' + (detail.venue_name || 'unknown') + 
                    ' (' + detail.lat + ', ' + detail.lng + '), fetching climate');
                _lastClimate = null;
                _venueTransitioning = true;
                _pendingVenueCoords = { lat: detail.lat, lng: detail.lng };
                fetchClimateForVenue(detail.lat, detail.lng);
            }
        });
        document.addEventListener('gssh:locationChange', function(e) {
            var detail = e.detail || {};
            if (detail.lat && detail.lng && !_pendingVenueCoords) {
                // Only if venueSelect didn't already trigger the fetch
                log('climate', 'Location changed (' + detail.lat + ', ' + detail.lng + '), fetching climate');
                _lastClimate = null;
                _venueTransitioning = true;
                _pendingVenueCoords = { lat: detail.lat, lng: detail.lng };
                fetchClimateForVenue(detail.lat, detail.lng);
            }
        });

        // Cascade recalculation
        document.addEventListener('gssh:cascadeRecalculate', function() {
            recalculate('cascade');
        });

        // Analysis complete (fires after orchestrator populates GSSH_CANONICAL_STATE)
        // ALWAYS refresh climate data here — venue may have changed location,
        // so _lastClimate from the previous venue's weather is stale.
        // Previous guard (!_lastClimate) caused AU/NZ venues to calculate EUE
        // using leftover UK/EU temperatures after a venue switch.
        document.addEventListener('gssh:analysis-complete', function() {
            var hubState = global._gsshHubState || global.GSSH_STATE || {};
            var canonical = global.GSSH_CANONICAL_STATE || {};
            
            // The hub's validateClimateMetrics strips wind, solar, et, and other
            // fields from window.climateMetrics. If _lastClimate already has richer
            // data (from our own gssh_climate_fetch), merge the hub's validated
            // temperature/moisture with our existing wind/solar/et data.
            if (global.climateMetrics && global.climateMetrics.temperature) {
                var hubCM = global.climateMetrics;
                if (_lastClimate && _lastClimate.wind && !hubCM.wind) {
                    // Hub's validated metrics lack wind — merge with our richer data
                    // Take hub's temperature (more authoritative — includes soil temp 
                    // integration, sensor data, etc.) but keep our wind/solar/et
                    hubCM.wind = _lastClimate.wind;
                    if (_lastClimate.solar && !hubCM.solar) hubCM.solar = _lastClimate.solar;
                    if (_lastClimate.et && !hubCM.et) hubCM.et = _lastClimate.et;
                    log('climate', 'Merged hub climate with bridge wind/solar/et data');
                }
                _lastClimate = hubCM;
                log('climate', 'Refreshed climate data from window.climateMetrics');
            }
            // Priority 2: canonical state or hub state
            else if (canonical.climate || hubState.climate) {
                _lastClimate = canonical.climate || hubState.climate;
                log('climate', 'Refreshed climate data from hub state');
            }
            // Priority 3: rawWeatherData (populated by climate API fetch)
            else if (global.rawWeatherData) {
                _lastClimate = {
                    temperature: {
                        current: global.rawWeatherData.current_weather ? global.rawWeatherData.current_weather.temperature : null,
                        todayMean: null
                    }
                };
                log('climate', 'Refreshed climate data from rawWeatherData');
            }
            
            _venueTransitioning = false;
            _pendingVenueCoords = null;
            
            // Always recalculate with current climate
            recalculate('analysis_complete');
        });

    }

    /* =========================================================================
       INIT
    ========================================================================= */

    function init() {
        if (_initialized) return;

        if (typeof global.GSSH_EUE === 'undefined') {
            log('init', 'GSSH_EUE not loaded, bridge inactive');
            return;
        }

        setupListeners();
        _initialized = true;

        log('init', 'EUE Integration Bridge v' + VERSION + ' initialized');


        // If climate data already available, do initial calculation
        var hubState = global._gsshHubState || global.GSSH_STATE || {};
        if (hubState.computed && hubState.computed.climate) {
            _lastClimate = hubState.computed.climate;
            recalculate('initial');
        }
    }

    // Auto-init when DOM ready
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', init);
    } else {
        setTimeout(init, 100);
    }

    /* =========================================================================
       EXPORTS
    ========================================================================= */

    global.GSSH_EUE_Bridge = {
        init: init,
        recalculate: recalculate,
        getLastEUE: function() { return _lastEUE; },
        getVenueEnvConfig: getVenueEnvConfig,
        setVenueEnvConfig: setVenueEnvConfig,
        DEFAULT_VENUE_ENV: DEFAULT_VENUE_ENV,
        version: VERSION
    };

})(typeof window !== 'undefined' ? window : this);

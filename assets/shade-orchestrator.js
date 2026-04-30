/**
 * =============================================================================
 * GSSH SHADE ORCHESTRATOR v1.0.0
 * =============================================================================
 * 
 * Replaces the 4 separate bridge scripts from the old two-plugin architecture:
 *   - hub-stadium-bridge.js (Hub → Stadium events)
 *   - hub-context-bridge.js (Stadium event listener + shared state)
 *   - stadium-to-hub-bridge.js (Stadium → Hub shade data)
 *   - hub-shortcode-integration.js (shortcode Hub-awareness)
 * 
 * In the merged Stadium Shade Hub, there's no event bridge needed between
 * plugins. This orchestrator:
 * 
 * 1. Listens for venue selection (from unified venue selector)
 * 2. Runs local shade analysis using the hub shade engine/fallback
 * 3. Injects shade results into the hub's cascade orchestrator state
 * 4. Notifies downstream engines (disease, stress, wear, irrigation, PGR, nutrition)
 * 
 * DATA FLOW:
 *   Venue selector → gssh:venueSelected
 *   → local shade analysis
 *   → shade result injected into _hubState.computed.shade
 *   → gssh:shadeOrchestratorComplete dispatched
 *   → cascade orchestrator picks up shade for downstream engines
 * 
 * DLI THRESHOLDS (research-backed, mol/m²/day):
 *   Species              Survival    Stress     Target
 *   Bermuda/Couch       18          24         30
 *   Perennial Ryegrass  12          18         25
 *   Creeping Bentgrass  22          28         30
 *   Zoysia              12          18         22
 *   Kentucky Bluegrass  22          26         30
 *   Fine Fescue         10          15         20
 * 
 * Sources: USGA 2021, STRI 2018-19, Texas A&M Wherley 2018, Russell 2019,
 *          Chen 2021, Bunnell 2005, Reed 2024, Gardner & Taylor 2002
 * 
 * =============================================================================
 */

(function(global) {
    'use strict';

    // =========================================================================
    // DLI THRESHOLDS - Research-validated minimums
    // =========================================================================

    const DLI_THRESHOLDS = {
        // Warm-season (C4)
        bermuda:    { survival: 18, stress: 24, target: 30, optimal: 40, teReduction: 0.16 },
        couch:      { survival: 18, stress: 24, target: 30, optimal: 40, teReduction: 0.16 },
        zoysia:     { survival: 12, stress: 18, target: 22, optimal: 30, teReduction: 0.15 },
        kikuyu:     { survival: 20, stress: 26, target: 32, optimal: 45, teReduction: 0.12 },
        buffalo:    { survival: 8,  stress: 12, target: 18, optimal: 25, teReduction: 0.10 },

        // Cool-season (C3)
        ryegrass:           { survival: 12, stress: 18, target: 25, optimal: 35, teReduction: 0.20 },
        perennial_ryegrass: { survival: 12, stress: 18, target: 25, optimal: 35, teReduction: 0.20 },
        bentgrass:          { survival: 22, stress: 28, target: 30, optimal: 40, teReduction: 0.10 },
        creeping_bentgrass: { survival: 22, stress: 28, target: 30, optimal: 40, teReduction: 0.10 },
        poa:                { survival: 15, stress: 20, target: 25, optimal: 35, teReduction: 0.15 },
        kentucky_bluegrass: { survival: 22, stress: 26, target: 30, optimal: 38, teReduction: 0.15 },
        fescue:             { survival: 10, stress: 15, target: 20, optimal: 30, teReduction: 0.12 }
    };

    // =========================================================================
    // SHADE ORCHESTRATOR
    // =========================================================================

    const ShadeOrchestrator = {

        version: '1.0.0',
        initialized: false,
        debug: false,

        // Current state
        currentVenue: null,
        currentShade: null,
        currentSpecies: null,
        lastAnalysisTime: null,

        // =====================================================================
        // INITIALIZATION
        // =====================================================================

        init: function() {
            if (this.initialized) return;

            this.log('init', 'Initializing v' + this.version);

            this.setupEventListeners();
            this.initialized = true;

            this.log('init', 'Ready');

            // b35fix176 G7c: catch-up — if a venue was selected before this
            // orchestrator initialised (common when scripts load async), the
            // gssh:venueSelected event already fired and was missed. Check the
            // unified venue selector for a current venue and run immediately.
            var self = this;
            setTimeout(function() {
                if (self.currentVenue) return; // already got one via event
                var uvs = global.GSSH_UnifiedVenueSelector;
                if (uvs && typeof uvs.getCurrentVenue === 'function') {
                    var existing = uvs.getCurrentVenue();
                    var hasCoords = existing && (existing.lat || (existing.location && existing.location.lat));
                    if (existing && (existing.venue_id || existing.id || hasCoords)) {
                        self.log('init', 'Catch-up: venue already selected —', existing.name || existing.venue_id || existing.id);
                        self.onVenueSelected(existing);
                    }
                }
            }, 500);
        },

        setupEventListeners: function() {
            const self = this;

            // Venue selection from unified venue selector or location manager
            document.addEventListener('gssh:venueSelected', function(e) {
                self.onVenueSelected(e.detail);
            });

            // Also listen for location changes from the hub's location manager
            // (for custom venues entered via geocode)
            document.addEventListener('gssh:locationChanged', function(e) {
                if (!self.currentVenue || self.currentVenue.source === 'geocode') {
                    self.onLocationChanged(e.detail);
                }
            });

            // Species changes from turf profile
            document.addEventListener('gssh:speciesChanged', function(e) {
                self.onSpeciesChanged(e.detail);
            });

            // Turf profile changes (includes species)
            document.addEventListener('gssh:turfProfileChange', function(e) {
                if (e.detail && e.detail.species) {
                    self.onSpeciesChanged(e.detail);
                }
            });

            // Climate data updates (ambient DLI may change).
            // b35fix176 G7b: the climate engine dispatches gaip:climate-fetch-complete
            // and gaip:climate-metrics-ready — NOT gssh:climateFetchComplete.
            // The old listener never fired, so runAnalysis() was only ever called
            // once (on venue select) before climateMetrics.solar was populated,
            // leaving live DLI unavailable for the first shade pass.
            // Listen to both real event names; guard against double-fire with a
            // 200 ms debounce so rapid back-to-back climate events don't rerun
            // shade twice.
            var _climateRerunTimer = null;
            function _onClimateReady() {
                if (!self.currentVenue) return;
                clearTimeout(_climateRerunTimer);
                _climateRerunTimer = setTimeout(function() {
                    self.log('climate', 'Climate data ready — re-running shade analysis with live DLI');
                    self.recalculate('climate update');
                }, 200);
            }
            document.addEventListener('gaip:climate-fetch-complete',  _onClimateReady);
            document.addEventListener('gaip:climate-metrics-ready',   _onClimateReady);
            // Keep the old name in case any other module ever dispatches it
            document.addEventListener('gssh:climateFetchComplete',    _onClimateReady);

            // b35fix176 G7g: re-run shade after hub analysis completes.
            // gssh:eueCalculated (venue_climate_fetch) fires before the hub tissue
            // analysis runs — climateMetrics.solar.dli is not yet set at that point.
            // The hub sets climateMetrics.solar.dli at analysis time, then dispatches
            // gssh:analysis-complete. Listen here instead — DLI is guaranteed
            // available. Only re-run if zones came back with null DLI on the first
            // pass (live DLI was missing when venue selection first ran).
            document.addEventListener('gaip:analysis-complete', function() {
                if (!self.currentVenue) return;
                var hasZones = self.currentShade && self.currentShade.zones &&
                               self.currentShade.zones.length > 0 &&
                               self.currentShade.zones[0].dli != null;
                if (hasZones) return; // already have good zone data — don't re-run
                var dli = window.climateMetrics && window.climateMetrics.solar &&
                          window.climateMetrics.solar.dli;
                if (!dli) return; // still no DLI — nothing to gain from re-running
                self.log('G7g', 'Analysis complete with live DLI (' + dli + ') — re-running shade for zone data');
                self.recalculate('climate_eue_complete');
            });

            // b35fix176 G7g-b: also listen to gaip:ambient-dli-ready which fires
            // before gaip:analysis-complete and carries the DLI value in detail.current.
            // This is the most reliable trigger — fires immediately when AmbientDLIEngine
            // computes the value, before validateClimateMetrics() strips solar from
            // climateMetrics. Cache the DLI on the orchestrator so later shade
            // passes can use it even after climateMetrics.solar is stripped.
            document.addEventListener('gaip:ambient-dli-ready', function(e) {
                if (!self.currentVenue) return;
                var dli = e.detail && e.detail.current;
                if (!dli || dli <= 0) return;
                // Cache so later shade passes can read it.
                self._cachedAmbientDLI = dli;
                var hasZones = self.currentShade && self.currentShade.zones &&
                               self.currentShade.zones.length > 0 &&
                               self.currentShade.zones[0].dli != null;
                if (hasZones) return;
                self.log('G7g', 'Ambient DLI ready (' + dli + ') — re-running shade for zone data');
                self.recalculate('ambient_dli_ready');
            });

            // Manual shade refresh request
            document.addEventListener('gssh:requestShadeRefresh', function() {
                if (self.currentVenue) {
                    self.runAnalysis(self.currentVenue);
                }
            });

            // b35fix249: Re-run shade analysis when roof state changes.
            // venue-readiness-ui.js dispatches this when user toggles open/closed
            // on a retractable roof venue (e.g. Marvel Stadium). The new roof_state
            // is read from GSSH_EUE_Bridge during analysis.
            var _roofRerunTimer = null;
            document.addEventListener('gssh:venueEnvConfigChanged', function(e) {
                var enclosure = (e.detail && e.detail.enclosureType) || '';
                if (enclosure.indexOf('retractable') !== 0) return; // only retractable venues
                if (!self.currentVenue) return;
                clearTimeout(_roofRerunTimer);
                _roofRerunTimer = setTimeout(function() {
                    self.log('roof', 'Roof state changed to ' + enclosure + ' — re-running shade analysis');
                    self.runAnalysis(self.currentVenue);
                }, 150);
            });
        },

        // =====================================================================
        // EVENT HANDLERS
        // =====================================================================

        onVenueSelected: function(venueData) {
            this.log('venue', 'Venue selected:', venueData.name || venueData.venue_id || venueData.id);

            // b35fix176 G7d: normalise id to venue_id. The unified venue selector
            // returns objects keyed as 'id' but the orchestrator expects
            // 'venue_id'. Without this, all database venues fall through as
            // source:'custom' and lose their venue metadata.
            var venueId = venueData.venue_id || venueData.id || null;

            // b35fix176 G7f: normalise nested lat/lng. getCurrentVenue() spreads
            // ALL_STADIUMS[id] which stores coordinates inside a 'location' object
            // ({ location: { lat, lng } }). Direct venueData.lat is undefined in
            // that case, causing analysis to run with invalid coordinates even
            // when venue_id is valid.
            var lat = venueData.lat || (venueData.location && venueData.location.lat) || null;
            var lng = venueData.lng || (venueData.location && venueData.location.lng) ||
                      (venueData.location && venueData.location.lon) || null;

            this.currentVenue = {
                venue_id: venueId,
                name: venueData.name || '',
                lat: lat,
                lng: lng,
                source: venueId ? 'database' : 'custom',
                orientation: venueData.orientation || 0,
                timezone: venueData.timezone || null,
                hemisphere: lat ? (lat >= 0 ? 'north' : 'south') : 'south'
            };

            // Update hub location manager
            this.syncToLocationManager(this.currentVenue);

            // Run shade analysis
            this.runAnalysis(this.currentVenue);
        },

        onLocationChanged: function(locationData) {
            if (!locationData || !locationData.lat || !locationData.lng) return;

            this.log('location', 'Location changed (geocode):', locationData.lat, locationData.lng);

            this.currentVenue = {
                venue_id: null,
                name: locationData.name || 'Custom Location',
                lat: locationData.lat,
                lng: locationData.lng,
                source: 'geocode',
                hemisphere: locationData.lat >= 0 ? 'north' : 'south'
            };

            // For geocode locations, use the hub's basic shade engine
            // (no obstruction profile available)
            this.runBasicShadeAnalysis(this.currentVenue);
        },

        onSpeciesChanged: function(detail) {
            const species = detail.species || detail.effectiveSpecies || null;
            if (species && species !== this.currentSpecies) {
                this.currentSpecies = species;
                this.log('species', 'Species changed to:', species);

                // Recalculate thresholds with new species
                if (this.currentShade) {
                    this.applyThresholds(this.currentShade);
                    this.injectIntoHubState(this.currentShade);
                    this.dispatch(this.currentShade);
                }
            }
        },

        // =====================================================================
        // SHADE ANALYSIS
        // =====================================================================

        /**
         * b35fix249: Read roof state from EUE bridge config and return
         * the analysis value ('open' | 'closed').
         * Retractable venues (e.g. Marvel Stadium) toggle this via
         * venue-readiness-ui.js setRoofState() → GSSH_EUE_Bridge.setVenueEnvConfig().
         */
        getRoofStateParam: function() {
            var cfg = global.GSSH_EUE_Bridge &&
                      typeof global.GSSH_EUE_Bridge.getVenueEnvConfig === 'function'
                      ? global.GSSH_EUE_Bridge.getVenueEnvConfig()
                      : null;
            if (!cfg || !cfg.enclosureType) return 'open';
            if (cfg.enclosureType === 'retractable_closed') return 'closed';
            if (cfg.enclosureType === 'retractable_open')   return 'open';
            // Fixed roof / fully enclosed — treat as permanently closed
            if (cfg.enclosureType === 'fixed_roof' || cfg.enclosureType === 'enclosed') return 'closed';
            return 'open';
        },

        /**
         * Run shade analysis locally.
         *
         * The old server-side obstruction renderer is not present in Laravel
         * yet, so use the existing client-side shade engine/fallback directly.
         */
        runAnalysis: function(venue) {
            const self = this;
            this.log('analysis', 'Running analysis for:', venue.name);

            // Dispatch loading state
            document.dispatchEvent(new CustomEvent('gssh:shadeAnalysisStarted', {
                detail: { venue: venue.name }
            }));

            // b35fix251: stale-result guard.
            // Multiple triggers (climate-ready, roof-toggle, ambient-dli-ready) can
            // fire runAnalysis() in quick succession. Stamp each request with a
            // monotonic ID; discard any deferred response that isn't most recent.
            this._lastRequestId = (this._lastRequestId || 0) + 1;
            var requestId = this._lastRequestId;

            setTimeout(function() {
                if (requestId !== self._lastRequestId) {
                    self.log('analysis', 'Discarding stale shade result (request #' + requestId + ' superseded by #' + self._lastRequestId + ')');
                    return;
                }
                self.runBasicShadeAnalysis(venue);
            }, 0);
        },

        /**
         * Run basic shade analysis using client-side hub shade engine
         * Used for custom venues without obstruction profiles
         */
        runBasicShadeAnalysis: function(venue) {
            this.log('analysis', 'Running basic (no obstruction profile) for:', venue.name);

            // Use the hub's shade engine if available
            if (typeof global.gssh_shade_engine === 'function') {
                const state = this.getHubState();
                const weather = this.getWeatherData();
                const result = global.gssh_shade_engine(state, weather);

                if (result) {
                    this.processShadeResult(this.normalizeBasicResult(result, venue), venue);
                    return;
                }
            }

            // Fallback: estimate from latitude + season
            const estimated = this.estimateFromLatitude(venue.lat);
            this.processShadeResult(estimated, venue);
        },

        /**
         * Process shade analysis result and inject into hub state
         */
        processShadeResult: function(shadeData, venue) {
            this.log('result', 'Processing shade result');

            // Normalize the shade data structure
            const normalized = {
                // Core DLI values
                dli_ambient: shadeData.dli_ambient || shadeData.ambientDLI || null,
                dli_shaded: shadeData.dli_shaded || shadeData.shadedDLI || null,
                dli_deficit: shadeData.dli_deficit || null,

                // Zone data (from obstruction profiles)
                zones: shadeData.zones || shadeData.zone_deficits || [],
                worst_zone: shadeData.worst_zone || null,

                // Shade characteristics
                shade_percentage: shadeData.shade_percentage || shadeData.shade_pct || 0,
                daily_lit_hours: shadeData.daily_lit_hours || shadeData.lit_hours || null,
                peak_shade_hour: shadeData.peak_shade_hour || null,

                // Fungal risk from shade
                fungal_risk: shadeData.fungal_risk || shadeData.fungalRisk || null,
                leaf_wetness_modifier: this.calculateLeafWetnessModifier(shadeData),

                // b35fix250: roof state from shade data or local default.
                // Consumed by hub-orchestrator.js buildDiseaseInputs() to apply
                // enclosed-canopy humidity and leaf wetness modifiers.
                roof_state:        shadeData.roof_state        || 'open',
                roof_transmission: shadeData.roof_transmission != null ? shadeData.roof_transmission : 1.0,

                // Source metadata
                source: shadeData.source || ((shadeData.zones && shadeData.zones.length) ? 'obstruction_profile' : 'estimated'),
                venue_id: venue.venue_id,
                venue_name: venue.name,
                timestamp: Date.now()
            };

            // Apply species-specific DLI thresholds
            this.applyThresholds(normalized);

            // Store
            this.currentShade = normalized;
            this.lastAnalysisTime = Date.now();

            // Inject into hub state
            this.injectIntoHubState(normalized);

            // Dispatch for downstream consumers
            this.dispatch(normalized);
        },

        /**
         * Apply species-specific DLI thresholds and calculate status
         */
        applyThresholds: function(shadeData) {
            const species = this.getEffectiveSpecies();
            const thresholds = this.getThresholds(species);

            shadeData.thresholds = thresholds;
            shadeData.species = species;

            const dli = shadeData.dli_shaded || shadeData.dli_ambient;
            if (dli !== null && thresholds) {
                // Calculate deficit relative to target
                shadeData.dli_deficit = Math.max(0, thresholds.target - dli);
                shadeData.deficit_pct = thresholds.target > 0
                    ? Math.max(0, ((thresholds.target - dli) / thresholds.target) * 100)
                    : 0;

                // Status classification
                if (dli >= thresholds.target) {
                    shadeData.status = 'adequate';
                    shadeData.stressIndex = 0;
                } else if (dli >= thresholds.stress) {
                    shadeData.status = 'suboptimal';
                    shadeData.stressIndex = Math.round(
                        (1 - (dli - thresholds.stress) / (thresholds.target - thresholds.stress)) * 50
                    );
                } else if (dli >= thresholds.survival) {
                    shadeData.status = 'stressed';
                    shadeData.stressIndex = 50 + Math.round(
                        (1 - (dli - thresholds.survival) / (thresholds.stress - thresholds.survival)) * 30
                    );
                } else {
                    shadeData.status = 'critical';
                    shadeData.stressIndex = 80 + Math.round(
                        Math.min(20, (thresholds.survival - dli) / thresholds.survival * 20)
                    );
                }

                // Growth modifier (0-1 scale, 1 = no impact)
                shadeData.growth_modifier = this.calculateGrowthModifier(dli, thresholds);

                // Stress factor for hub engines (0 = no stress, 1 = max stress)
                shadeData.stressFactor = Math.min(1, shadeData.stressIndex / 100);
            }
        },

        // =====================================================================
        // HUB STATE INTEGRATION
        // =====================================================================

        /**
         * Inject shade data into the hub's cascade orchestrator state
         * This is the key integration point — replaces all bridge scripts
         */
        injectIntoHubState: function(shadeData) {
            // Find the hub orchestrator's state
            const hubState = global._gsshHubState || global.GSSH_STATE || {};

            if (!hubState.computed) hubState.computed = {};

            // Write shade data in the format hub engines expect
            hubState.computed.shade = {
                // Core values (expected by hub-orchestrator.js stress aggregator)
                DLI_total: shadeData.dli_shaded || shadeData.dli_ambient,
                dli: shadeData.dli_shaded || shadeData.dli_ambient,
                dliShaded: shadeData.dli_shaded,
                dliDeficit: shadeData.dli_deficit || 0,
                deficitPct: shadeData.deficit_pct || 0,
                stressIndex: shadeData.stressIndex || 0,
                stressFactor: shadeData.stressFactor || 0,

                // Status
                status: shadeData.status,
                c4Status: shadeData.status, // legacy compat

                // Modular format (expected by some engines)
                modular: {
                    deficitPct: shadeData.deficit_pct || 0,
                    status: shadeData.status,
                    growthModifier: shadeData.growth_modifier || 1
                },

                // Fungal/disease data
                fungalRisk: shadeData.fungal_risk,
                fungal: shadeData.fungal_risk,
                leafWetnessModifier: shadeData.leaf_wetness_modifier || 1,

                // Zone data for stadium-specific analysis
                zones: shadeData.zones,
                worstZone: shadeData.worst_zone,

                // Shade characteristics
                shadePercentage: shadeData.shade_percentage,
                dailyLitHours: shadeData.daily_lit_hours,

                // Thresholds
                thresholds: shadeData.thresholds,

                // Metadata
                source: shadeData.source,
                venueName: shadeData.venue_name,
                venueId: shadeData.venue_id,
                timestamp: shadeData.timestamp
            };

            this.log('inject', 'Shade data injected into hub state',
                'DLI:', shadeData.dli_shaded,
                'Status:', shadeData.status,
                'Stress:', shadeData.stressIndex
            );
        },

        // =====================================================================
        // EVENT DISPATCH
        // =====================================================================

        /**
         * Dispatch shade results to hub engines and UI
         */
        dispatch: function(shadeData) {
            // Main shade event (replaces old bridge event)
            document.dispatchEvent(new CustomEvent('gssh:shadeOrchestratorComplete', {
                detail: shadeData
            }));

            // Shade context update (for disease, stress, wear engines)
            document.dispatchEvent(new CustomEvent('gssh:shadeContextUpdate', {
                detail: {
                    dli: shadeData.dli_shaded || shadeData.dli_ambient,
                    dliDeficit: shadeData.dli_deficit,
                    stressFactor: shadeData.stressFactor,
                    leafWetnessModifier: shadeData.leaf_wetness_modifier,
                    growthModifier: shadeData.growth_modifier,
                    status: shadeData.status,
                    zones: shadeData.zones,
                    source: shadeData.source
                }
            }));

            // Trigger hub cascade re-run with new shade data
            document.dispatchEvent(new CustomEvent('gssh:selectiveComputeComplete', {
                detail: { trigger: 'shade', engines: ['disease', 'stress', 'wear', 'irrigation', 'pgr', 'nutrition'] }
            }));

            this.log('dispatch', 'Events dispatched — cascade will re-run downstream engines');
        },

        // =====================================================================
        // HELPER METHODS
        // =====================================================================

        getEffectiveSpecies: function() {
            // Check for overseed dominant
            const overseedState = global.GSSH_OVERSEED_STATE;
            if (overseedState && overseedState.dominant && overseedState.c3Fraction > 0.5) {
                return overseedState.effectiveSpecies || 'ryegrass';
            }

            // From turf profile controller
            if (global.TurfProfileController && global.TurfProfileController.state) {
                return global.TurfProfileController.state.species || this.currentSpecies;
            }

            return this.currentSpecies || 'ryegrass'; // safe default for stadiums
        },

        getThresholds: function(species) {
            if (!species) return DLI_THRESHOLDS.ryegrass;

            const key = species.toLowerCase().replace(/\s+/g, '_');
            const baseThresholds = DLI_THRESHOLDS[key] || DLI_THRESHOLDS.ryegrass;

            // b35fix177: overseed DLI threshold logic.
            // Australian stadium overseed is ryegrass over a warm-season base.
            // Feb–Sep (months 1–8, zero-indexed): ryegrass thresholds — ryegrass
            //   is either establishing (Feb) or dominant (Mar–Sep). In both cases
            //   we want to favour ryegrass light requirements.
            // Oct–Jan: base species thresholds — couch breaking dormancy or at
            //   peak growth; ryegrass thinning out naturally.
            //
            // Manual override: venueConfig.overseedActive
            //   true  → always use ryegrass thresholds regardless of month
            //   false → always use base species thresholds regardless of month
            //   null  → calendar logic (default)
            var venueConfig = (global.GSSH_EUE_Bridge && global.GSSH_EUE_Bridge.getVenueEnvConfig)
                ? global.GSSH_EUE_Bridge.getVenueEnvConfig()
                : null;
            var overseedOverride = venueConfig ? venueConfig.overseedActive : null;

            var useOverseed = false;
            if (overseedOverride === true) {
                useOverseed = true;
            } else if (overseedOverride === false) {
                useOverseed = false;
            } else {
                // Calendar: Feb=1, Mar=2 ... Sep=8 (zero-indexed months)
                var month = new Date().getMonth(); // 0=Jan
                useOverseed = (month >= 1 && month <= 8); // Feb–Sep
            }

            // Only apply overseed logic for warm-season base species —
            // a ryegrass venue overseeding with ryegrass needs no adjustment
            var isWarmSeason = ['couch', 'bermuda', 'kikuyu', 'zoysia', 'buffalo'].includes(key);
            if (useOverseed && isWarmSeason) {
                return DLI_THRESHOLDS.perennial_ryegrass || DLI_THRESHOLDS.ryegrass;
            }

            return baseThresholds;
        },

        calculateGrowthModifier: function(dli, thresholds) {
            if (dli >= thresholds.target) return 1.0;
            if (dli >= thresholds.stress) {
                return 0.6 + 0.4 * (dli - thresholds.stress) / (thresholds.target - thresholds.stress);
            }
            if (dli >= thresholds.survival) {
                return 0.2 + 0.4 * (dli - thresholds.survival) / (thresholds.stress - thresholds.survival);
            }
            return Math.max(0, 0.2 * (dli / thresholds.survival));
        },

        calculateLeafWetnessModifier: function(shadeData) {
            // Shade increases leaf wetness duration — impacts disease
            // Based on: Beard 1973, Bell et al. 2000
            const shadePct = shadeData.shade_percentage || shadeData.shade_pct || 0;

            if (shadePct < 20) return 1.0;       // minimal impact
            if (shadePct < 40) return 1.15;       // 15% longer wetness
            if (shadePct < 60) return 1.30;       // 30% longer wetness
            if (shadePct < 80) return 1.50;       // 50% longer wetness
            return 1.75;                          // 75% longer — high disease pressure
        },

        normalizeBasicResult: function(hubResult, venue) {
            return {
                dli_ambient: hubResult.dli || hubResult.DLI_total,
                dli_shaded: hubResult.dliShaded || hubResult.dli,
                shade_percentage: hubResult.shadePercentage || 0,
                daily_lit_hours: hubResult.litHours || null,
                fungal_risk: hubResult.fungalRisk || hubResult.fungal,
                zones: [],
                worst_zone: null,
                source: 'hub_shade_engine'
            };
        },

        estimateFromLatitude: function(lat) {
            // Rough DLI estimate based on latitude + current month
            // This is the fallback when no obstruction profile or hub shade engine
            const absLat = Math.abs(lat);
            const month = new Date().getMonth();
            const hemisphere = lat >= 0 ? 'north' : 'south';

            // Base DLI at equator ~45 mol/m²/day, decreasing with latitude
            let baseDLI = 45 - (absLat * 0.5);

            // Seasonal modifier
            const summerMonths = hemisphere === 'north' ? [5, 6, 7] : [11, 0, 1];
            const winterMonths = hemisphere === 'north' ? [11, 0, 1] : [5, 6, 7];

            if (summerMonths.includes(month)) baseDLI *= 1.2;
            else if (winterMonths.includes(month)) baseDLI *= 0.6;

            return {
                dli_ambient: Math.round(baseDLI * 10) / 10,
                dli_shaded: null, // unknown without obstruction data
                shade_percentage: 0,
                zones: [],
                worst_zone: null,
                source: 'latitude_estimate'
            };
        },

        getHubState: function() {
            return global._gsshHubState || global.GSSH_STATE || {};
        },

        getWeatherData: function() {
            const state = this.getHubState();
            return state.weather || state.computed?.climate || {};
        },

        getCurrentDate: function() {
            return new Date().toISOString().split('T')[0];
        },

        syncToLocationManager: function(venue) {
            // Update the hub's location manager with venue coordinates
            const latInput = document.querySelector('#gssh-lat, .gssh-lat, input[name="latitude"]');
            const lngInput = document.querySelector('#gssh-lon, .gssh-lon, input[name="longitude"]');

            if (latInput) latInput.value = venue.lat;
            if (lngInput) lngInput.value = venue.lng;

            // Dispatch location change for hub's climate engine
            document.dispatchEvent(new CustomEvent('gssh:locationChanged', {
                detail: {
                    lat: venue.lat,
                    lng: venue.lng,
                    name: venue.name,
                    source: 'venue_selector'
                }
            }));
        },

        recalculate: function(reason) {
            this.log('recalc', 'Recalculating shade — reason:', reason);
            if (this.currentVenue.source === 'database') {
                this.runAnalysis(this.currentVenue);
            } else {
                this.runBasicShadeAnalysis(this.currentVenue);
            }
        },

        // =====================================================================
        // PUBLIC API
        // =====================================================================

        /**
         * Get current shade status for external consumers
         */
        getShadeStatus: function() {
            return this.currentShade;
        },

        /**
         * Get DLI deficit for rig calculator
         */
        getDLIDeficit: function() {
            if (!this.currentShade) return null;
            return {
                ambient: this.currentShade.dli_ambient,
                shaded: this.currentShade.dli_shaded,
                deficit: this.currentShade.dli_deficit,
                target: this.currentShade.thresholds?.target || null,
                species: this.currentShade.species
            };
        },

        /**
         * Get supplemental light requirement
         */
        getSupplementalRequirement: function() {
            if (!this.currentShade || !this.currentShade.dli_deficit) return null;
            return {
                deficit_mol: this.currentShade.dli_deficit,
                deficit_pct: this.currentShade.deficit_pct,
                target_dli: this.currentShade.thresholds?.target,
                current_dli: this.currentShade.dli_shaded || this.currentShade.dli_ambient,
                zones: this.currentShade.zones,
                worst_zone: this.currentShade.worst_zone
            };
        },

        /**
         * Check if data is fresh (within 5 minutes)
         */
        isDataCurrent: function() {
            if (!this.lastAnalysisTime) return false;
            return (Date.now() - this.lastAnalysisTime) < 300000;
        },

        // =====================================================================
        // LOGGING
        // =====================================================================

        log: function() {
            if (!this.debug && !global.GSSH_DEBUG) return;
            var args = Array.prototype.slice.call(arguments);
            var category = args.shift();
            args.unshift('[ShadeOrchestrator:' + category + ']');
            console.log.apply(console, args);
        }
    };

    // =========================================================================
    // EXPOSE & INITIALIZE
    // =========================================================================

    global.GSSH_ShadeOrchestrator = ShadeOrchestrator;

    // Auto-init when DOM ready
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', function() {
            ShadeOrchestrator.init();
        });
    } else {
        ShadeOrchestrator.init();
    }

})(window);

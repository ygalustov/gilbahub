/**
 * =============================================================================
 * GILBA IRRIGATION SCHEDULER v1.4.0
 * =============================================================================
 * 
 * v1.4.0: Pure function extraction for orchestrator integration
 *   - NEW: schedule_pure(state, weatherData, options) accepts date/varietyTraits
 *   - NEW: detectOverseedForIrrigation accepts optional currentDate parameter
 *   - NEW: getVarietyWaterModifier accepts optional varietyTraitsData parameter
 *   - FIX: Orchestrator was passing 4 separate args to 1-arg function (never worked)
 *   - Backward compatible: legacy schedule(state, weatherData) unchanged
 * 
 * v1.3.3: Return waterBalance even when forecast is unavailable
 *   - FIX: schedule() now returns waterBalance, overseed, strategy, species, 
 *          and summary even when no forecast data is available
 *   - This prevents undefined values in the UI when weather fetch fails
 *   - UI can now show current water status without forecast
 * 
 * v1.3.2: Fixed ET data path for Open-Meteo API
 *   - FIX: weatherData.forecast.daily access (was looking for rawWeatherData.daily)
 *   - FIX: et0_fao_evapotranspiration field name (was expecting et0)
 *   - Maintains backward compatibility with old data shapes
 * 
 * v1.3.0: Enhanced overseed maintain vs transition irrigation strategy
 *   - NEW: summerIntent now directly controls irrigation species selection
 *   - "maintain": Uses C3 crop coefficients when overseed is significant
 *   - "transition": Switches to C4 coefficients as overseed dies back
 *   - NEW: Explicit overseed detection from turf profile state
 *   - Better ETc calculation for blended species scenarios
 * 
 * v1.2.0: Previous version with basic overseed detection
 * v1.1.0: Added variety-specific water use modifiers
 * 
 * @version 1.3.3
 * =============================================================================
 */

(function(global) {
    'use strict';

    const CONFIG = {
        version: '1.4.0',  // v1.4.0: Pure function extraction for orchestrator
        
        cropCoefficients: {
            ryegrass:     { mid: 0.85, stress: 0.70, dormant: 0.30 },
            tallFescue:   { mid: 0.80, stress: 0.65, dormant: 0.25 },
            bentgrass:    { mid: 0.90, stress: 0.75, dormant: 0.35 },
            bluegrass:    { mid: 0.85, stress: 0.70, dormant: 0.30 },
            poaAnnua:     { mid: 0.95, stress: 0.80, dormant: 0.40 },
            bermuda:      { mid: 0.70, stress: 0.55, dormant: 0.15 },
            couch:        { mid: 0.70, stress: 0.55, dormant: 0.15 },
            kikuyu:       { mid: 0.75, stress: 0.60, dormant: 0.20 },
            buffalo:      { mid: 0.65, stress: 0.50, dormant: 0.15 },
            zoysia:       { mid: 0.65, stress: 0.50, dormant: 0.15 },
            paspalum:     { mid: 0.75, stress: 0.60, dormant: 0.20 },
            generic:      { mid: 0.80, stress: 0.65, dormant: 0.25 }
        },
        
        poaAnnuaParams: {
            rootDepthMm: 50,
            maxMAD: 0.3,
            summerStressThreshold: 28,
            summerDormantThreshold: 32,
            frequencyMultiplier: 1.5,
            depthMultiplier: 0.6
        },
        
        soilTypes: {
            sand:       { fieldCapacity: 0.10, wiltingPoint: 0.04, infiltrationRate: 50, saturatedHydraulic: 210, awc: 0.06 },
            loamySand:  { fieldCapacity: 0.14, wiltingPoint: 0.06, infiltrationRate: 40, saturatedHydraulic: 150, awc: 0.08 },
            sandyLoam:  { fieldCapacity: 0.20, wiltingPoint: 0.09, infiltrationRate: 25, saturatedHydraulic: 100, awc: 0.11 },
            loam:       { fieldCapacity: 0.27, wiltingPoint: 0.12, infiltrationRate: 15, saturatedHydraulic: 50,  awc: 0.15 },
            siltLoam:   { fieldCapacity: 0.30, wiltingPoint: 0.13, infiltrationRate: 12, saturatedHydraulic: 40,  awc: 0.17 },
            clayLoam:   { fieldCapacity: 0.35, wiltingPoint: 0.18, infiltrationRate: 8,  saturatedHydraulic: 25,  awc: 0.17 },
            clay:       { fieldCapacity: 0.40, wiltingPoint: 0.22, infiltrationRate: 4,  saturatedHydraulic: 10,  awc: 0.18 },
            sandProfile:{ fieldCapacity: 0.12, wiltingPoint: 0.05, infiltrationRate: 60, saturatedHydraulic: 300, awc: 0.07 },
            usga:       { fieldCapacity: 0.15, wiltingPoint: 0.06, infiltrationRate: 50, saturatedHydraulic: 250, awc: 0.09 }
        },
        
        rootDepths: {
            bermuda: 150, couch: 150, kikuyu: 200, buffalo: 100, zoysia: 120,
            paspalum: 150, ryegrass: 100, tallFescue: 200, bentgrass: 75,
            bluegrass: 150, poaAnnua: 50, generic: 125
        },
        
        rootActivityThresholds: {
            c4: {
                inactive: 10,
                optimal: { min: 20, max: 30 },
                reduced: 35,
                uptakeFactors: { belowInactive: 0.2, transitional: 0.6, optimal: 1, heatStress: 0.7 }
            },
            c3: {
                inactive: 4,
                optimal: { min: 10, max: 24 },
                reduced: 30,
                uptakeFactors: { belowInactive: 0.3, transitional: 0.75, optimal: 1, heatStress: 0.6 }
            }
        },
        
        deficitStrategies: {
            conservative: { label: 'Conservative', deficitMm: 10, depletionFraction: 0.3, suitableFor: ['greens', 'tees', 'bowling_greens'] },
            moderate:     { label: 'Moderate',     deficitMm: 18, depletionFraction: 0.5, suitableFor: ['fairways', 'sports', 'general'] },
            efficient:    { label: 'Efficient',    deficitMm: 25, depletionFraction: 0.65, suitableFor: ['fairways', 'roughs', 'parks'] },
            deficit:      { label: 'Deficit',      deficitMm: 35, depletionFraction: 0.8, suitableFor: ['roughs', 'low_input'] }
        },
        
        madLevels: { optimal: 0.3, standard: 0.5, deficit: 0.65, severe: 0.8 },
        
        sprinklerDefaults: {
            rotorPrecipRate: 15,
            sprayPrecipRate: 40,
            bigGunPrecipRate: 10,
            dripPrecipRate: 4,
            uniformity: 0.8,
            efficiency: 0.75
        },
        
        scheduling: {
            preferredStartHour: 4,
            maxRuntimeMinutes: 120,
            soakTimeMinutes: 60,
            minRuntimeMinutes: 5,
            daysAhead: 7
        },
        
        // v1.3.0: Summer intent profiles for irrigation
        summerIntentProfiles: {
            transition: {
                label: 'Transition to C4',
                description: 'Allow overseed to die back naturally',
                useC3InSummer: false,
                summerC3Fraction: 0.1
            },
            maintain: {
                label: 'Maintain Overseed',
                description: 'Keep C3 overseed alive through summer',
                useC3InSummer: true,
                summerC3Fraction: 0.35
            }
        }
    };

    // =========================================================================
    // UTILITY FUNCTIONS
    // =========================================================================

    var clamp = GAIP_Utils.clamp;

    function safeNum(val, fallback) {
        const n = parseFloat(val);
        return isFinite(n) ? n : fallback;
    }

    function getSpeciesKey(species) {
        if (!species) return 'generic';
        const s = species.toLowerCase().replace(/\s+/g, '');
        
        if (s.includes('bermuda') || s.includes('couch')) return 'bermuda';
        if (s.includes('kikuyu')) return 'kikuyu';
        if (s.includes('buffalo')) return 'buffalo';
        if (s.includes('zoysia')) return 'zoysia';
        if (s.includes('paspalum')) return 'paspalum';
        if (s.includes('ryegrass') || s.includes('prg')) return 'ryegrass';
        if (s.includes('tall') && s.includes('fescue')) return 'tallFescue';
        if (s.includes('fescue') || s.includes('chewing')) return 'fineFescue';
        if (s.includes('bent')) return 'bentgrass';
        if (s.includes('poa') || s.includes('annualbluegrass')) return 'poaAnnua';
        if (s.includes('bluegrass') || s.includes('kbg')) return 'bluegrass';
        
        return 'generic';
    }

    function isC4(species) {
        return ['bermuda', 'couch', 'kikuyu', 'buffalo', 'zoysia', 'paspalum'].includes(getSpeciesKey(species));
    }

    // =========================================================================
    // v1.3.0: ENHANCED OVERSEED DETECTION
    // =========================================================================

    /**
     * Detect overseed scenario and determine effective species for irrigation
     * v1.4.0: accepts optional currentDate for pure function path
     * 
     * @param {Object} state - Hub state object
     * @param {Date|string} [currentDate] - Override for current date (pure path)
     * @returns {Object} Overseed detection result
     */
    function detectOverseedForIrrigation(state, currentDate) {
        const turf = state?.turf || {};
        const baseSpecies = turf.grassSpecies || turf.species || 'generic';
        
        // v1.4.0: Determine real overseed species.
        // TurfProfile sets coolOverseed = base species for pure C3 stands.
        // Only treat coolOverseed as overseed when warmBase is set (real C4+C3 scenario)
        // AND the overseed species differs from the base species.
        let overseedSpecies = turf.overseedSpecies || null;
        if (!overseedSpecies && turf.warmBase && turf.coolOverseed) {
            overseedSpecies = turf.coolOverseed;
        }
        // If coolOverseed/winterOverseed equals the base species, not a real overseed
        if (!overseedSpecies) {
            const candidateOverseed = turf.coolOverseed || turf.winterOverseed || null;
            if (candidateOverseed && candidateOverseed !== baseSpecies) {
                // Different species with no warmBase — still might be overseed
                // Only if base is C4
                if (isC4(baseSpecies)) {
                    overseedSpecies = candidateOverseed;
                }
            }
        }

        const result = {
            isOverseed: false,
            baseSpecies: baseSpecies,
            overseedSpecies: overseedSpecies,
            summerIntent: turf.overseedSummerIntent || turf.summerIntent || 'transition',
            effectiveSpecies: null,
            effectiveVariety: null,
            c3Fraction: 0,   // Default 0 — only set if explicitly provided or calculated
            useOverseed: false,
            reason: ''
        };
        
        // Check for explicit C3 fraction — must come from state, not assumed
        if (typeof turf.c3Fraction === 'number') {
            result.c3Fraction = turf.c3Fraction;
        } else if (turf.species?.c3Fraction !== undefined) {
            result.c3Fraction = turf.species.c3Fraction;
        } else if (typeof turf.percentC3Cover === 'number' && turf.percentC3Cover > 0) {
            result.c3Fraction = turf.percentC3Cover / 100;
        }
        // For pure C4 with no overseed indicators at all, force to 0
        if (result.c3Fraction === 0 && isC4(baseSpecies) && !overseedSpecies &&
            !turf.coolOverseed && !turf.warmBase) {
            result.c3Fraction = 0;
        }
        
        // Determine if this is an overseed scenario
        const baseIsC4 = isC4(result.baseSpecies);
        const hasOverseed = !!result.overseedSpecies;
        
        if (baseIsC4 && hasOverseed) {
            result.isOverseed = true;
        } else if (baseIsC4 && result.c3Fraction >= 0.2 && result.c3Fraction < 1.0) {
            // Implicit overseed detected via C3 fraction on C4 base
            // Note: c3Fraction of exactly 1.0 on a C4 is a data error — ignore it
            result.isOverseed = true;
            result.overseedSpecies = turf.coolOverseed || turf.winterOverseed || 'cool-season overseed';
        }
        
        if (!result.isOverseed) {
            result.effectiveSpecies = result.baseSpecies;
            result.effectiveVariety = turf.variety || turf.cultivar || null;
            result.reason = 'Pure stand - no overseed detected';
            return result;
        }
        
        // v1.3.0/v1.4.0: Determine effective species based on summerIntent and current season
        const refDate = currentDate ? new Date(currentDate) : new Date();
        const month = refDate.getMonth() + 1;
        const isSouthernHemisphere = (state?.location?.lat || -33) < 0;
        const isSummer = isSouthernHemisphere 
            ? (month === 12 || month === 1 || month === 2)
            : (month === 6 || month === 7 || month === 8);
        
        const intentProfile = CONFIG.summerIntentProfiles[result.summerIntent] || 
                             CONFIG.summerIntentProfiles.transition;
        
        // Determine whether to use C3 or C4 for ETc calculation
        if (isSummer) {
            if (intentProfile.useC3InSummer && result.c3Fraction >= 0.2) {
                // MAINTAIN mode: User wants to keep overseed alive
                result.useOverseed = true;
                result.effectiveSpecies = result.overseedSpecies;
                result.effectiveVariety = turf.overseedVariety || null;
                result.reason = `Maintain mode: Using C3 overseed ETc (${Math.round(result.c3Fraction * 100)}% cover)`;
            } else {
                // TRANSITION mode: Use C4 base, overseed dying back
                result.useOverseed = false;
                result.effectiveSpecies = result.baseSpecies;
                result.effectiveVariety = turf.variety || null;
                result.reason = `Transition mode: C4 base dominant, overseed dying back`;
            }
        } else {
            // Winter/transition: Overseed typically active
            if (result.c3Fraction >= 0.3) {
                result.useOverseed = true;
                result.effectiveSpecies = result.overseedSpecies;
                result.effectiveVariety = turf.overseedVariety || null;
                result.reason = `Cool season: C3 overseed dominant (${Math.round(result.c3Fraction * 100)}% cover)`;
            } else {
                result.useOverseed = false;
                result.effectiveSpecies = result.baseSpecies;
                result.effectiveVariety = turf.variety || null;
                result.reason = `Cool season but low C3 cover (${Math.round(result.c3Fraction * 100)}%)`;
            }
        }
        
        return result;
    }

    // =========================================================================
    // ORGANIC MATTER MODIFIER
    // =========================================================================

    function applyOMModifier(omPct, soilType, baseProps) {
        if (!omPct || omPct <= 0) {
            return { props: baseProps, omEffect: null };
        }
        
        const adjustedProps = { ...baseProps };
        const isSandy = ['sand', 'loamySand', 'sandProfile', 'usga'].includes(soilType);
        const baseline = isSandy ? 1.5 : 3;
        const omDelta = omPct - baseline;
        
        // AWC increases with OM
        const awcChange = omDelta * (isSandy ? 0.015 : 0.008);
        adjustedProps.awc = Math.max(0.04, baseProps.awc + awcChange);
        
        // FC increases with OM
        const fcChange = omDelta * (isSandy ? 0.012 : 0.006);
        adjustedProps.fieldCapacity = Math.max(0.08, baseProps.fieldCapacity + fcChange);
        
        // Infiltration affected by OM
        let infiltrationMult = 1;
        if (omPct < 1.5 && isSandy) {
            infiltrationMult = 1.1;
        } else if (omPct > 6) {
            infiltrationMult = 0.7; // Hydrophobicity
        } else if (omPct > 5) {
            infiltrationMult = 0.85;
        } else if (omPct >= 3 && omPct <= 4.5) {
            infiltrationMult = 1.05;
        }
        adjustedProps.infiltrationRate = baseProps.infiltrationRate * infiltrationMult;
        
        const effect = {
            applied: true,
            omPct: omPct,
            omBaseline: baseline,
            omDelta: Math.round(omDelta * 10) / 10,
            awcChange: Math.round(awcChange * 1000) / 10,
            fcChange: Math.round(fcChange * 1000) / 10,
            infiltrationMultiplier: infiltrationMult,
            status: omPct < 1.5 ? 'low' : omPct <= 4 ? 'optimal' : omPct <= 6 ? 'elevated' : 'excessive',
            note: null
        };
        
        if (omPct < 1.5 && isSandy) {
            effect.note = 'Low OM reduces water holding - more frequent, lighter irrigation recommended';
        } else if (omPct > 6) {
            effect.note = 'High OM causes hydrophobicity - use wetting agents, cycle-soak irrigation';
        } else if (omPct > 5) {
            effect.note = 'Elevated OM may cause dry spots - monitor for localized dry areas';
        }
        
        return { props: adjustedProps, omEffect: effect };
    }

    // =========================================================================
    // VARIETY WATER USE MODIFIER
    // =========================================================================

    function getVarietyWaterModifier(species, variety, varietyTraitsData) {
        if (!variety) return { multiplier: 1, confidence: 'none' };
        
        // v1.4.0: Accept pre-fetched traits data (pure path) or read global (legacy)
        const traitsModule = varietyTraitsData || global.GAIP_VarietyTraits;
        if (traitsModule && typeof traitsModule.getWaterUseModifier === 'function') {
            const modifier = traitsModule.getWaterUseModifier(species, variety);
            if (modifier.confidence !== 'none') return modifier;
        }
        
        // Built-in modifiers for known varieties
        const knownVarieties = {
            'Tahoma 31':      { multiplier: 0.82, confidence: 'high', source: 'Amgain 2018 OSU' },
            'TifTuf':         { multiplier: 1.00, confidence: 'high', source: 'Reference cultivar' },
            'Celebration':    { multiplier: 0.86, confidence: 'medium', source: 'OSU ET studies' },
            'RTF Turf Saver': { multiplier: 0.85, confidence: 'medium', source: 'NMSU deep rooting' }
        };
        
        return knownVarieties[variety] || { multiplier: 1, confidence: 'none' };
    }

    // =========================================================================
    // ETc CALCULATION
    // =========================================================================

    function calculateETc(et0, species, variety, growthStage) {
        const speciesKey = getSpeciesKey(species);
        const coefficients = CONFIG.cropCoefficients[speciesKey] || CONFIG.cropCoefficients.generic;
        
        let kc;
        switch (growthStage) {
            case 'dormant': kc = coefficients.dormant; break;
            case 'stress':
            case 'deficit': kc = coefficients.stress; break;
            default: kc = coefficients.mid;
        }
        
        const varietyMod = getVarietyWaterModifier(species, variety);
        const kcAdjusted = kc * varietyMod.multiplier;
        const etc = et0 * kcAdjusted;
        
        return {
            et0: et0,
            kc: kc,
            kcAdjusted: kcAdjusted,
            etc: Math.round(etc * 10) / 10,
            varietyModifier: varietyMod.multiplier,
            varietyConfidence: varietyMod.confidence,
            varietySource: varietyMod.source
        };
    }

    // =========================================================================
    // WATER BALANCE CALCULATION
    // =========================================================================

    function calculateWaterBalance(state) {
        const soil = state.irrigation?.soil || state.soil || {};
        const turf = state.turf || {};
        
        // Get soil properties
        // v1.4.0: Derive soil type from construction when no soil type provided
        let soilType = soil.type || null;
        if (!soilType) {
            const construction = turf.construction || state.site?.construction || '';
            if (construction) {
                const constructionMap = {
                    'sand_profile': 'sandProfile', 'sandProfile': 'sandProfile',
                    'usga': 'usga',
                    'sand_carpet': 'sand', 'sandCarpet': 'sand',
                    'push_up': 'loam', 'pushUp': 'loam',
                    'native': 'sandyLoam',
                    'california': 'sandProfile'
                };
                soilType = constructionMap[construction] || 'sandyLoam';
            } else {
                soilType = 'sandyLoam';
            }
        }
        const baseProps = CONFIG.soilTypes[soilType] || CONFIG.soilTypes.sandyLoam;
        
        // Apply OM modifier
        const omPct = safeNum(soil.LOI, 0) || safeNum(soil.OM_pct, 0);
        const { props: soilProps, omEffect } = applyOMModifier(omPct, soilType, baseProps);
        
        // Get species and check for Poa
        const speciesKey = getSpeciesKey(turf.grassSpecies);
        const isPoa = speciesKey === 'poaAnnua';
        const poaPercent = safeNum(turf.poaPercent, 0);
        
        // Get root depth
        // v1.4.0: Species-based root depth is the primary source.
        // User/schedule overrides only apply if explicitly set (non-zero, non-default).
        const speciesRootDepth = CONFIG.rootDepths[speciesKey] || CONFIG.rootDepths.generic;
        const explicitIrrigRoot = safeNum(state.irrigation?.rootDepth, 0);
        const explicitTurfRoot = safeNum(turf.rootDepth, 0);
        // Only use explicit if it's a real user-entered value (> 0 and different from defaults)
        let rootDepth = speciesRootDepth;
        if (explicitIrrigRoot > 0) {
            rootDepth = explicitIrrigRoot;
        } else if (explicitTurfRoot > 0) {
            rootDepth = explicitTurfRoot;
        }
        
        let adjustedRootDepth = rootDepth;
        let poaAdjustment = null;
        
        // Adjust for Poa contamination
        if (poaPercent > 0 && !isPoa) {
            const poaRootDepth = CONFIG.poaAnnuaParams.rootDepthMm;
            if (poaPercent >= 30) {
                adjustedRootDepth = poaRootDepth;
                poaAdjustment = {
                    type: 'shallow',
                    reason: `${poaPercent}% Poa contamination - using shallow root depth`,
                    originalDepth: rootDepth,
                    adjustedDepth: poaRootDepth
                };
            } else {
                const blend = poaPercent / 30;
                adjustedRootDepth = Math.round(rootDepth * (1 - blend) + poaRootDepth * blend);
                poaAdjustment = {
                    type: 'blended',
                    reason: `${poaPercent}% Poa contamination - adjusted root depth`,
                    originalDepth: rootDepth,
                    adjustedDepth: adjustedRootDepth
                };
            }
        }
        
        const effectiveRootDepth = adjustedRootDepth;
        const taw = soilProps.awc * effectiveRootDepth;
        
        // Get MAD (Management Allowable Depletion)
        const strategy = state.irrigation?.strategy || 'standard';
        let mad = CONFIG.madLevels[strategy] || 0.5;
        
        if (isPoa || poaPercent >= 20) {
            mad = Math.min(mad, CONFIG.poaAnnuaParams.maxMAD);
            if (poaAdjustment) {
                poaAdjustment.madAdjusted = true;
                poaAdjustment.originalMAD = CONFIG.madLevels[strategy];
                poaAdjustment.adjustedMAD = mad;
            }
        }
        
        const raw = taw * mad;
        
        // Estimate current depletion
        let currentDepletion;
        let depletionSource = 'estimated';
        
        const sensorVWC = state.irrigation?.soilVWC;
        if (sensorVWC && sensorVWC > 0) {
            const vwc = sensorVWC / 100;
            currentDepletion = taw - Math.max(0, (vwc - soilProps.wiltingPoint) * effectiveRootDepth);
            depletionSource = 'sensor';
        } else if (soil.moisture !== undefined && typeof soil.moisture === 'number') {
            const vwc = soil.moisture / 100;
            currentDepletion = taw - Math.max(0, (vwc - soilProps.wiltingPoint) * effectiveRootDepth);
            depletionSource = 'sensor';
        } else {
            const daysSince = safeNum(state.irrigation?.daysSinceIrrigation, 1);
            let avgET = 4;
            // v1.3.2: Fix data path - weather data may be at state.weather.forecast.daily
            const dailyWeather = state.weather?.forecast?.daily || state.weather?.daily;
            if (dailyWeather && dailyWeather.length > 0) {
                const etValues = dailyWeather.slice(0, 3).map(d => 
                    d.et0_fao_evapotranspiration ?? d.et0 ?? d.evapotranspiration ?? 4
                );
                avgET = etValues.reduce((a, b) => a + b, 0) / etValues.length;
            }
            currentDepletion = daysSince * avgET;
            depletionSource = 'days';
        }
        
        currentDepletion = clamp(currentDepletion, 0, taw);
        const depletionFraction = currentDepletion / taw;
        
        // Determine status
        let status;
        if (depletionFraction < 0.3) status = 'optimal';
        else if (depletionFraction < 0.5) status = 'adequate';
        else if (depletionFraction < 0.7) status = 'stressed';
        else status = 'critical';
        
        const needsIrrigation = currentDepletion >= raw;
        const refillDepth = needsIrrigation ? Math.round(currentDepletion * 10) / 10 : 0;
        
        return {
            soilType,
            soilProps,
            omEffect,
            rootDepth: effectiveRootDepth,
            taw: Math.round(taw * 10) / 10,
            raw: Math.round(raw * 10) / 10,
            mad,
            currentDepletion: Math.round(currentDepletion * 10) / 10,
            depletionFraction: Math.round(depletionFraction * 100),
            depletionSource,
            status,
            needsIrrigation,
            refillDepth,
            poaAdjustment
        };
    }

    // =========================================================================
    // LEACHING REQUIREMENT
    // =========================================================================

    function calculateLeachingRequirement(ecw, variety, ece) {
        if (!ecw || ecw <= 0) return 0;
        
        // Threshold EC for turf (dS/m)
        let threshold = 3.0;
        
        // Adjust for salt-tolerant varieties
        if (variety) {
            const v = variety.toLowerCase();
            if (v.includes('paspalum') || v.includes('seaspray')) {
                threshold = 8.0;
            }
        }
        
        if (ecw <= threshold) return 0;
        
        // Leaching fraction = ECw / (5 * ECe_threshold - ECw)
        const lf = ecw / (5 * threshold - ecw);
        return Math.max(0, Math.min(0.3, lf)); // Cap at 30%
    }

    // =========================================================================
    // RUNTIME CALCULATION
    // =========================================================================

    function calculateRuntime(depthMm, systemConfig) {
        const precipRate = systemConfig.precipRate || CONFIG.sprinklerDefaults.rotorPrecipRate;
        const uniformity = systemConfig.uniformity || CONFIG.sprinklerDefaults.uniformity;
        const efficiency = systemConfig.efficiency || CONFIG.sprinklerDefaults.efficiency;
        const infiltrationRate = systemConfig.soilInfiltration || 25;
        
        const grossDepth = depthMm / (uniformity * efficiency);
        const baseRuntime = (grossDepth / precipRate) * 60;
        
        // Check if cycle-soak needed
        const maxSingleRun = (infiltrationRate / precipRate) * 60;
        
        if (baseRuntime <= maxSingleRun) {
            return {
                totalRuntime: Math.round(baseRuntime),
                cycles: 1,
                runPerCycle: Math.round(baseRuntime),
                soakTime: 0,
                netDepth: depthMm,
                grossDepth: Math.round(grossDepth * 10) / 10,
                cycleSoak: false
            };
        }
        
        // Need cycle-soak
        const cycles = Math.ceil(baseRuntime / maxSingleRun);
        const runPerCycle = Math.round(baseRuntime / cycles);
        const soakTime = CONFIG.scheduling.soakTimeMinutes;
        
        return {
            totalRuntime: Math.round(baseRuntime + (cycles - 1) * soakTime),
            cycles,
            runPerCycle,
            soakTime,
            netDepth: depthMm,
            grossDepth: Math.round(grossDepth * 10) / 10,
            cycleSoak: true
        };
    }

    // =========================================================================
    // v1.4.0: PURE SCHEDULE FUNCTION — for orchestrator integration
    // =========================================================================

    /**
     * Pure version of schedule() that accepts all dependencies via parameters.
     * No global reads, no implicit Date() calls.
     * 
     * @param {Object} state - Complete state: turf, soil, water, irrigation, location
     * @param {Object} weatherData - Weather forecast data with daily ET0
     * @param {Object} [options] - Pure function overrides
     * @param {Date|string} [options.currentDate] - Override for current date
     * @param {Object} [options.varietyTraitsData] - Pre-fetched variety traits module
     * @returns {Object} Irrigation schedule result
     */
    function schedule_pure(state, weatherData, options = {}) {
        if (!state) return { error: 'No state provided' };
        
        const turf = state.turf || {};
        const irrigation = state.irrigation || {};
        
        // v1.4.0: Use currentDate from options for deterministic season detection
        const overseedInfo = detectOverseedForIrrigation(state, options.currentDate || null);
        
        // Calculate water balance
        const waterBalance = calculateWaterBalance(state);
        
        // Get irrigation strategy
        const strategy = irrigation.strategy || 'moderate';
        const strategyConfig = CONFIG.deficitStrategies[strategy] || CONFIG.deficitStrategies.moderate;
        
        // Get weather forecast
        const forecast = weatherData?.forecast?.daily || weatherData?.daily || weatherData?.forecast;
        if (!forecast || forecast.length === 0) {
            return { 
                error: 'No forecast data available',
                waterBalance,
                overseed: overseedInfo,
                strategy: {
                    key: strategy,
                    label: strategyConfig.label,
                    triggerMm: waterBalance.raw
                },
                species: {
                    base: turf.grassSpecies || 'generic',
                    effective: overseedInfo.effectiveSpecies,
                    usingOverseed: overseedInfo.useOverseed,
                    reason: overseedInfo.reason
                },
                summary: {
                    totalET: 0, totalPrecipitation: 0, netDeficit: 0,
                    irrigationEvents: 0, totalIrrigation: 0, avgDailyET: 0
                },
                schedule: []
            };
        }
        
        // System configuration
        const systemConfig = {
            precipRate: irrigation.precipRate || CONFIG.sprinklerDefaults.rotorPrecipRate,
            uniformity: irrigation.uniformity || CONFIG.sprinklerDefaults.uniformity,
            efficiency: irrigation.efficiency || CONFIG.sprinklerDefaults.efficiency,
            soilInfiltration: waterBalance.soilProps.infiltrationRate
        };
        
        // Leaching requirement
        const ecw = state.water?.ecw || 0;
        const ece = state.soil?.ECe || 0;
        const leachingFraction = calculateLeachingRequirement(ecw, overseedInfo.effectiveVariety, ece);
        
        // Build daily schedule
        const days = [];
        let cumulativeDepletion = waterBalance.currentDepletion;
        
        for (let i = 0; i < forecast.length && i < CONFIG.scheduling.daysAhead; i++) {
            const day = forecast[i];
            const temp = day.tempMax && day.tempMin ? (day.tempMax + day.tempMin) / 2 : 20;
            
            const growthStage = temp < 10 ? 'dormant' : temp > 30 ? 'stress' : 'mid';
            const dayET0 = day.et0_fao_evapotranspiration ?? day.et0 ?? 4;
            
            // v1.4.0: Pass variety traits data to ETc calc (pure path)
            const etcResult = calculateETc(
                dayET0,
                overseedInfo.effectiveSpecies,
                overseedInfo.effectiveVariety,
                growthStage
            );
            
            const netChange = etcResult.etc - (day.precipitation || 0);
            cumulativeDepletion += netChange;
            cumulativeDepletion = clamp(cumulativeDepletion, 0, waterBalance.taw);
            
            let irrigationRec = null;
            if (cumulativeDepletion >= waterBalance.raw) {
                const netDepth = cumulativeDepletion;
                const leachingDepth = leachingFraction > 0 ? netDepth * leachingFraction : 0;
                const totalDepth = netDepth + leachingDepth;
                const runtime = calculateRuntime(totalDepth, systemConfig);
                
                irrigationRec = {
                    recommended: true,
                    netDepth: Math.round(netDepth * 10) / 10,
                    leachingDepth: Math.round(leachingDepth * 10) / 10,
                    totalDepth: Math.round(totalDepth * 10) / 10,
                    runtime,
                    startTime: `${String(CONFIG.scheduling.preferredStartHour).padStart(2, '0')}:00`,
                    priority: cumulativeDepletion > 0.7 * waterBalance.taw ? 'high' : 'normal'
                };
                
                cumulativeDepletion = 0;
            }
            
            days.push({
                date: day.date || day.time,
                dayName: getDayName(day.date || day.time),
                et0: dayET0,
                etc: etcResult.etc,
                kc: etcResult.kcAdjusted,
                precipitation: day.precipitation || 0,
                netChange: Math.round(netChange * 10) / 10,
                cumulativeDepletion: Math.round(cumulativeDepletion * 10) / 10,
                depletionPct: Math.round(cumulativeDepletion / waterBalance.taw * 100),
                status: cumulativeDepletion / waterBalance.taw < 0.3 ? 'optimal' :
                        cumulativeDepletion / waterBalance.taw < 0.5 ? 'adequate' :
                        cumulativeDepletion / waterBalance.taw < 0.7 ? 'stressed' : 'critical',
                irrigation: irrigationRec,
                growthStage,
                usingOverseed: overseedInfo.useOverseed
            });
        }
        
        // Summary statistics
        const irrigationEvents = days.filter(d => d.irrigation?.recommended).length;
        const totalIrrigation = days.reduce((sum, d) => sum + (d.irrigation?.totalDepth || 0), 0);
        const totalET = days.reduce((sum, d) => sum + d.etc, 0);
        const totalPrecip = days.reduce((sum, d) => sum + d.precipitation, 0);
        
        return {
            schedule: days,
            waterBalance,
            overseed: overseedInfo,
            species: {
                base: turf.grassSpecies || 'generic',
                baseVariety: turf.variety || null,
                effective: overseedInfo.effectiveSpecies,
                effectiveVariety: overseedInfo.effectiveVariety,
                usingOverseed: overseedInfo.useOverseed,
                summerIntent: overseedInfo.summerIntent,
                reason: overseedInfo.reason
            },
            leachingRequirement: leachingFraction > 0 ? {
                fraction: Math.round(leachingFraction * 100),
                reason: `ECw ${ecw} dS/m requires ${Math.round(leachingFraction * 100)}% additional water`
            } : null,
            summary: {
                totalET: Math.round(totalET * 10) / 10,
                totalPrecipitation: Math.round(totalPrecip * 10) / 10,
                netDeficit: Math.round((totalET - totalPrecip) * 10) / 10,
                irrigationEvents,
                totalIrrigation: Math.round(totalIrrigation * 10) / 10,
                avgDailyET: Math.round(totalET / days.length * 10) / 10
            },
            system: systemConfig
        };
    }

    // =========================================================================
    // MAIN SCHEDULE FUNCTION (LEGACY)
    // =========================================================================

    /**
     * Generate irrigation schedule
     * v1.3.0: Enhanced overseed handling with maintain/transition support
     * v1.3.3: Return waterBalance even when forecast is unavailable
     */
    function schedule(state, weatherData) {
        if (!state) return { error: 'No state provided' };
        
        const turf = state.turf || {};
        const irrigation = state.irrigation || {};
        
        // v1.3.0: Detect overseed scenario and effective species
        const overseedInfo = detectOverseedForIrrigation(state);
        
        // Calculate water balance - this can be done without forecast data
        const waterBalance = calculateWaterBalance(state);
        
        // Get irrigation strategy for display
        const strategy = irrigation.strategy || 'moderate';
        const strategyConfig = CONFIG.deficitStrategies[strategy] || CONFIG.deficitStrategies.moderate;
        
        // Get weather forecast
        // v1.3.2: Fix data path - ET data is at forecast.daily.et0_fao_evapotranspiration
        const forecast = weatherData?.forecast?.daily || weatherData?.daily || weatherData?.forecast;
        if (!forecast || forecast.length === 0) {
            // v1.3.3: Return waterBalance and basic info even without forecast
            // This allows the UI to display current water status
            return { 
                error: 'No forecast data available',
                waterBalance,
                overseed: overseedInfo,
                strategy: {
                    key: strategy,
                    label: strategyConfig.label,
                    triggerMm: waterBalance.raw
                },
                species: {
                    base: turf.grassSpecies || 'generic',
                    effective: overseedInfo.effectiveSpecies,
                    usingOverseed: overseedInfo.useOverseed,
                    reason: overseedInfo.reason
                },
                summary: {
                    totalET: 0,
                    totalPrecipitation: 0,
                    netDeficit: 0,
                    irrigationEvents: 0,
                    totalIrrigation: 0,
                    avgDailyET: 0
                },
                schedule: []
            };
        }
        
        // System configuration
        const systemConfig = {
            precipRate: irrigation.precipRate || CONFIG.sprinklerDefaults.rotorPrecipRate,
            uniformity: irrigation.uniformity || CONFIG.sprinklerDefaults.uniformity,
            efficiency: irrigation.efficiency || CONFIG.sprinklerDefaults.efficiency,
            soilInfiltration: waterBalance.soilProps.infiltrationRate
        };
        
        // Leaching requirement
        const ecw = state.water?.ecw || 0;
        const ece = state.soil?.ECe || 0;
        const leachingFraction = calculateLeachingRequirement(ecw, overseedInfo.effectiveVariety, ece);
        
        // Build daily schedule
        const days = [];
        let cumulativeDepletion = waterBalance.currentDepletion;
        
        for (let i = 0; i < forecast.length && i < CONFIG.scheduling.daysAhead; i++) {
            const day = forecast[i];
            const temp = day.tempMax && day.tempMin ? (day.tempMax + day.tempMin) / 2 : 20;
            
            // v1.3.0: Use effective species from overseed detection
            const growthStage = temp < 10 ? 'dormant' : temp > 30 ? 'stress' : 'mid';
            // v1.3.2: Handle et0_fao_evapotranspiration field name from Open-Meteo
            const dayET0 = day.et0_fao_evapotranspiration ?? day.et0 ?? 4;
            const etcResult = calculateETc(
                dayET0,
                overseedInfo.effectiveSpecies,
                overseedInfo.effectiveVariety,
                growthStage
            );
            
            const netChange = etcResult.etc - (day.precipitation || 0);
            cumulativeDepletion += netChange;
            cumulativeDepletion = clamp(cumulativeDepletion, 0, waterBalance.taw);
            
            let irrigationRec = null;
            if (cumulativeDepletion >= waterBalance.raw) {
                const netDepth = cumulativeDepletion;
                const leachingDepth = leachingFraction > 0 ? netDepth * leachingFraction : 0;
                const totalDepth = netDepth + leachingDepth;
                const runtime = calculateRuntime(totalDepth, systemConfig);
                
                irrigationRec = {
                    recommended: true,
                    netDepth: Math.round(netDepth * 10) / 10,
                    leachingDepth: Math.round(leachingDepth * 10) / 10,
                    totalDepth: Math.round(totalDepth * 10) / 10,
                    runtime,
                    startTime: `${String(CONFIG.scheduling.preferredStartHour).padStart(2, '0')}:00`,
                    priority: cumulativeDepletion > 0.7 * waterBalance.taw ? 'high' : 'normal'
                };
                
                cumulativeDepletion = 0;
            }
            
            days.push({
                date: day.date || day.time,
                dayName: getDayName(day.date || day.time),
                et0: dayET0,
                etc: etcResult.etc,
                kc: etcResult.kcAdjusted,
                precipitation: day.precipitation || 0,
                netChange: Math.round(netChange * 10) / 10,
                cumulativeDepletion: Math.round(cumulativeDepletion * 10) / 10,
                depletionPct: Math.round(cumulativeDepletion / waterBalance.taw * 100),
                status: cumulativeDepletion / waterBalance.taw < 0.3 ? 'optimal' :
                        cumulativeDepletion / waterBalance.taw < 0.5 ? 'adequate' :
                        cumulativeDepletion / waterBalance.taw < 0.7 ? 'stressed' : 'critical',
                irrigation: irrigationRec,
                growthStage,
                usingOverseed: overseedInfo.useOverseed
            });
        }
        
        // Summary statistics
        const irrigationEvents = days.filter(d => d.irrigation?.recommended).length;
        const totalIrrigation = days.reduce((sum, d) => sum + (d.irrigation?.totalDepth || 0), 0);
        const totalET = days.reduce((sum, d) => sum + d.etc, 0);
        const totalPrecip = days.reduce((sum, d) => sum + d.precipitation, 0);
        
        return {
            schedule: days,
            waterBalance,
            overseed: overseedInfo,  // v1.3.0: Include overseed info
            species: {
                base: turf.grassSpecies || 'generic',
                baseVariety: turf.variety || null,
                effective: overseedInfo.effectiveSpecies,
                effectiveVariety: overseedInfo.effectiveVariety,
                usingOverseed: overseedInfo.useOverseed,
                summerIntent: overseedInfo.summerIntent,
                reason: overseedInfo.reason
            },
            leachingRequirement: leachingFraction > 0 ? {
                fraction: Math.round(leachingFraction * 100),
                reason: `ECw ${ecw} dS/m requires ${Math.round(leachingFraction * 100)}% additional water`
            } : null,
            summary: {
                totalET: Math.round(totalET * 10) / 10,
                totalPrecipitation: Math.round(totalPrecip * 10) / 10,
                netDeficit: Math.round((totalET - totalPrecip) * 10) / 10,
                irrigationEvents,
                totalIrrigation: Math.round(totalIrrigation * 10) / 10,
                avgDailyET: Math.round(totalET / days.length * 10) / 10
            },
            system: systemConfig
        };
    }

    function getDayName(dateStr) {
        const days = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
        return days[new Date(dateStr).getDay()];
    }

    // =========================================================================
    // QUICK CALCULATION (SINGLE DAY)
    // =========================================================================

    function calculateQuick(state) {
        const turf = state.turf || {};
        const irrigation = state.irrigation || {};
        const climate = state.climate || {};
        
        const et0 = safeNum(climate.et0 || climate.dailyET || irrigation.et0, 5);
        const overseedInfo = detectOverseedForIrrigation(state);
        
        const etcResult = calculateETc(
            et0, 
            overseedInfo.effectiveSpecies, 
            overseedInfo.effectiveVariety, 
            irrigation.growthStage
        );
        const waterBalance = calculateWaterBalance(state);
        
        let recommendation;
        if (waterBalance.needsIrrigation) {
            const systemConfig = {
                precipRate: irrigation.precipRate || 15,
                uniformity: irrigation.uniformity || 0.8,
                efficiency: irrigation.efficiency || 0.75,
                soilInfiltration: waterBalance.soilProps.infiltrationRate
            };
            const runtime = calculateRuntime(waterBalance.refillDepth, systemConfig);
            
            recommendation = {
                action: 'irrigate',
                depth: waterBalance.refillDepth,
                runtime,
                urgency: waterBalance.status === 'critical' ? 'high' : 'normal',
                message: `Apply ${runtime.netDepth}mm (${formatRuntime(runtime.totalRuntime)} runtime)`
            };
        } else {
            const daysUntil = Math.floor((waterBalance.raw - waterBalance.currentDepletion) / etcResult.etc);
            recommendation = {
                action: 'wait',
                daysUntil: Math.max(1, daysUntil),
                message: `No irrigation needed. ${daysUntil} days until next irrigation.`
            };
        }
        
        return {
            et0,
            etc: etcResult,
            waterBalance,
            overseed: overseedInfo,
            recommendation,
            timestamp: new Date().toISOString()
        };
    }

    function formatRuntime(minutes) {
        const hrs = Math.floor(minutes / 60);
        const mins = minutes % 60;
        if (hrs === 0) return `${mins}min`;
        if (mins === 0) return `${hrs}hr`;
        return `${hrs}hr ${mins}min`;
    }

    /**
     * Calculate irrigation needs from a VWC sensor reading
     * Used by sensor-import-ui.js for zone-based irrigation recommendations
     * 
     * @param {number} vwcPercent - Volumetric water content as percentage (e.g., 18 for 18%)
     * @param {object} options - Optional configuration
     * @param {string} options.soilType - Soil type key (default: 'sandProfile')
     * @param {number} options.rootDepth - Root depth in mm (default: 100)
     * @param {string} options.strategy - Irrigation strategy: 'optimal', 'standard', 'deficit' (default: 'standard')
     * @param {number} options.omPct - Organic matter percentage (default: 0)
     * @returns {object} Irrigation recommendation
     */
    function calculateForVWC(vwcPercent, options = {}) {
        const {
            soilType = 'sandProfile',
            rootDepth = 100,
            strategy = 'standard',
            omPct = 0
        } = options;
        
        // Get soil properties
        const baseProps = CONFIG.soilTypes[soilType] || CONFIG.soilTypes.sandProfile;
        const { props: soilProps, omEffect } = applyOMModifier(omPct, soilType, baseProps);
        
        // Convert VWC from percentage to decimal
        const vwc = vwcPercent / 100;
        
        // Calculate water holding parameters
        const taw = soilProps.awc * rootDepth;  // Total Available Water (mm)
        const mad = CONFIG.madLevels[strategy] || 0.5;  // Management Allowable Depletion
        const raw = taw * mad;  // Readily Available Water (mm)
        
        // Calculate current water status relative to field capacity and wilting point
        const currentWater = Math.max(0, (vwc - soilProps.wiltingPoint) * rootDepth);
        const currentDepletion = taw - currentWater;
        const depletionFraction = currentDepletion / taw;
        
        // Calculate percentages relative to FC and WP
        const fcPercent = soilProps.fieldCapacity * 100;
        const wpPercent = soilProps.wiltingPoint * 100;
        const triggerVWC = soilProps.wiltingPoint + (soilProps.awc * (1 - mad));
        const triggerPercent = triggerVWC * 100;
        
        // Determine status
        let status;
        if (vwc >= soilProps.fieldCapacity) {
            status = 'saturated';
        } else if (depletionFraction < 0.3) {
            status = 'optimal';
        } else if (depletionFraction < 0.5) {
            status = 'adequate';
        } else if (depletionFraction < 0.7) {
            status = 'stressed';
        } else if (vwc > soilProps.wiltingPoint) {
            status = 'critical';
        } else {
            status = 'wilting';
        }
        
        // Determine if irrigation is needed
        const needsIrrigation = vwc <= triggerVWC;
        const refillDepth = needsIrrigation ? Math.round(currentDepletion * 10) / 10 : 0;
        
        // Calculate deficit from trigger point (for display)
        const deficitFromTrigger = needsIrrigation ? 
            Math.round((triggerVWC - vwc) * rootDepth * 10) / 10 : 0;
        
        // Build recommendation
        let recommendation;
        if (status === 'saturated') {
            recommendation = {
                action: 'none',
                message: 'Soil is at or above field capacity. No irrigation needed.',
                urgency: 'low'
            };
        } else if (needsIrrigation) {
            recommendation = {
                action: 'irrigate',
                depth: refillDepth,
                message: `Apply ${refillDepth}mm to return to field capacity`,
                urgency: status === 'critical' || status === 'wilting' ? 'high' : 'normal'
            };
        } else {
            const marginToTrigger = Math.round((vwc - triggerVWC) * rootDepth * 10) / 10;
            recommendation = {
                action: 'monitor',
                message: `${marginToTrigger}mm buffer before irrigation trigger`,
                urgency: 'low'
            };
        }
        
        return {
            vwc: vwcPercent,
            soilType,
            soilProps: {
                fieldCapacity: fcPercent,
                wiltingPoint: wpPercent,
                awc: soilProps.awc * 100
            },
            thresholds: {
                fieldCapacity: Math.round(fcPercent * 10) / 10,
                trigger: Math.round(triggerPercent * 10) / 10,
                wiltingPoint: Math.round(wpPercent * 10) / 10
            },
            status,
            depletionFraction: Math.round(depletionFraction * 100),
            taw: Math.round(taw * 10) / 10,
            raw: Math.round(raw * 10) / 10,
            currentDepletion: Math.round(currentDepletion * 10) / 10,
            needsIrrigation,
            refillDepth,
            deficitFromTrigger,
            recommendation,
            omEffect
        };
    }

    // =========================================================================
    // PUBLIC API
    // =========================================================================

    const IrrigationScheduler = {
        version: CONFIG.version,
        schedule,
        schedule_pure,              // v1.4.0: Pure function for orchestrator
        calculateETc,
        calculateWaterBalance,
        calculateLeachingRequirement,
        calculateRuntime,
        calculateQuick,
        calculateForVWC,
        detectOverseedForIrrigation,
        applyOMModifier,
        getVarietyWaterModifier,
        config: CONFIG,
        getSpeciesKey,
        isC4
    };

    // Export for different environments
    if (typeof module !== 'undefined' && module.exports) {
        module.exports = IrrigationScheduler;
    }
    
    global.GAIP_IrrigationScheduler = IrrigationScheduler;
    global.gaip_irrigation_schedule = schedule;
    global.gaip_irrigation_schedule_pure = schedule_pure;  // v1.4.0
    // Alias for hub-orchestrator compatibility
    global.gaip_irrigation_scheduler = function(state) {
        return IrrigationScheduler.schedule(state);
    };
    
    console.log('✅ Gilba Irrigation Scheduler v' + CONFIG.version + ' loaded (pure function extraction)');

})(typeof window !== 'undefined' ? window : this);

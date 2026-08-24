/**
 * =============================================================================
 * GILBA NUTRITION SUMMARY INTEGRATION v1.3.0
 * =============================================================================
 *
 * v1.3.0 (b35fix423, C29 close): Amendment efficiency factor lookup.
 *   - New NUTRITION_CONFIG.amendmentEfficiency table — per-amendment ×
 *     delivery-method × soil-condition multipliers (gypsum saline 0.40, MAP
 *     alkaline 0.55, lime acid 0.80, sulphate of ammonia 0.75, elemental S
 *     alkaline 0.50, etc.). Mid-range AU/NZ practice values; pin per-site as
 *     needed. References: Hopkins & Ellsworth 2005 calcareous P fixation;
 *     Sample/Soper/Racz 1980 SSSAJ 44; Carrow & Duncan saline amendment work;
 *     STRI / R&A turf practice notes.
 *   - New public API getAmendmentEfficiency(amendmentKey, deliveryMethod,
 *     soilData) — returns { efficiency, condition, source }. Soil-condition
 *     resolution priority: saline (ESP > 6 or ECe > 4) → alkaline (pH ≥ 7.5)
 *     → acid (pH < 6.0) → neutral (6.0 ≤ pH < 7.5) → 'normal' / 'any' fallback.
 *   - Default 0.60 returned with source='default-...' when lookup misses, so
 *     missed entries surface in audit copy rather than silently failing.
 *   - C29 ships with deliveryMethod='granular' default; C20 will populate
 *     'foliar' for greens/bowls/croquet on P/K/S branches. Foliar branches
 *     for MAP and Potassium sulphate are pre-wired in the table now so the
 *     C20 activation is a parameter change, not a table change.
 *   - calculateNutrientRequirement signature unchanged. C29's effect on the
 *     Annual Soil Amendments table render is delegated to word-export.js
 *     _computeAmendmentDecision (which reads getAmendmentEfficiency from
 *     this module's public API). The HTML preview rendered by this module's
 *     renderDeficitSummary continues to show the SLAN/MLSN annualRequirement
 *     unchanged — dual-rate display is docx-only per C29 scope.
 *
 * v1.2.0 (b35fix302b): Delegate calculation to NutritionRequirementEngine_Pure.
 *   - Fixes Jerry's reported combined-export bug where every green/sportsground
 *     showed identical fertiliser recs (stale GAIP_NUTRITION_SOIL_CACHE across
 *     site switches). Engine computes per-sample requirements from that
 *     sample's soil chemistry directly.
 *   - renderNutritionSummary now calls engine.compute() and reads perSample +
 *     facility from the return object. Cache populated from engine output.
 *   - Local calculation functions preserved as fallback path (marked deprecated)
 *     and will be removed in b35fix31x once engine-load stability is confirmed
 *     across GAIP + GSSH modes.
 *   - Latent bugs silently fixed by engine: duplicate 'couch' key in
 *     removalRates, 'zoysia'/'paspalum' alias typos (all silently fell to
 *     mixedCool defaults). Zoysia + paspalum sites now get species-correct
 *     removal rates.
 *   - C3-on-C3 overseed misconfiguration guard added (engine-side).
 *   - User N-override (turf.nProgramKgHaYr via orchestrator/DOM) preserved
 *     through extractUserAnnualN() → engine's turf.nProgramKgHaYr input.
 *
 * v1.1.3: Fixed straight C3 grass incorrectly showing as overseed
 *   - Added strict validation: baseIsC4 must be TRUE (verified by isC4Species)
 *   - Added check: base and overseed must be DIFFERENT species
 *   - Overrides incorrect isC4Base inference from GAIP_OVERSEED_STATE
 *   - Straight Perennial Ryegrass now shows solid blue bars (100% C3)
 * 
 * v1.1.2: Fixed overseed detection when data comes from multiple state sources
 *   - isOverseed check now runs AFTER all data sources are consulted
 *   - Added GAIP_OVERSEED_STATE as authoritative source for overseed config
 *   - Added warmBase field lookup for base species
 *   - Added overseedSummerIntent field lookup for summer intent
 *   - Couch + Ryegrass oversow now correctly shows blended N distribution
 * 
 * v1.1.1: Fixed false overseed detection for pure C3 stands in warm climates
 *   - REMOVED automatic latitude-based overseed inference
 *   - Previously assumed C3 grass at latitude < 35° was overseed of C4 base
 *   - Pure ryegrass in Sydney now correctly shows as single-species (no overseed)
 *   - Overseed scenarios must be explicitly set via turf profile coolOverseed field
 * 
 * v1.1.0: Enhanced overseed intent N distribution blending
 *   - NEW: summerIntent now fully controls seasonal C3/C4 fractions
 *   - "maintain" intent: Higher C3 fraction maintained through summer (30-40%)
 *   - "transition" intent: C3 drops rapidly in summer (10%)
 *   - NEW: Visual indicator shows overseed management strategy
 *   - NEW: Monthly chart shows species dominance with color-coded bars
 *   - Respects user's explicit summerIntent setting from turf profile
 * 
 * v1.0.8: Fixed C3/C4 species detection for N distribution
 * v1.0.7: Fixed soil data extraction from nested ppm structure
 * 
 * @version 1.1.3
 * =============================================================================
 */

(function(global) {
    'use strict';

    const NUTRITION_CONFIG = {
        version: '1.1.3',
        debug: false,
        
        // b35fix301a: mlsnThresholds sourced from gaip-classification-constants.js.
        //             MLSN S value changes from 6 to 7 — standardisation onto
        //             the published MLSN guideline (Woods, Stowell, Gelernter 2016).
        mlsnThresholds:
            ((typeof window !== 'undefined' && window.GilbaClassificationConstants) ||
             (typeof globalThis !== 'undefined' && globalThis.GilbaClassificationConstants) || {}).MLSN_THRESHOLDS ||
            { P: 21, K: 37, Ca: 331, Mg: 47, S: 7 },
        targetMultiplier: 1.5,

        // pPhAdjustments retained inline in 301a. These use ph <= maxPh semantics
        // (see getMLSNThreshold below), which differs from hub-tissue-v3.js's
        // strict-inequality approach at exact boundary values (5.5, 6.0, 7.5, 8.0).
        // Harmonisation is out of scope for 301a — a future build must decide
        // which semantics are canonical before consolidating these into
        // gaip-classification-constants.P_PH_ADJUSTMENTS.
        pPhAdjustments: [
            { maxPh: 5.5, threshold: 35 },
            { maxPh: 6.0, threshold: 28 },
            { maxPh: 7.5, threshold: 21 },
            { maxPh: 8.0, threshold: 32 },
            { maxPh: 99,  threshold: 40 }
        ],
        
        yearsToCorrect: { P: 2, K: 2, Ca: 3, Mg: 3, S: 2 },
        defaultSoilDepth: 10,
        defaultBulkDensity: 1.4,

        // ====================================================================
        // b35fix423 (C29) — Amendment efficiency factor table
        // ====================================================================
        //
        // Each amendment delivers only a fraction of its applied nutrient to
        // the plant-available pool over the correction window. The remainder
        // is lost to fixation, leaching, biological-oxidation lag, or volatile
        // loss. The pre-C29 engine assumed efficiency = 1.0, producing rates
        // that under-prescribed for amendment loss and presented theoretical
        // figures as practical recommendations.
        //
        // Lookup is keyed by (amendmentKey, deliveryMethod, condition) where
        // condition is derived from soil chemistry (pH, ESP, ECe).
        //
        // Reference values (mid-range, AU/NZ practice; pin per-site as needed):
        //
        //   Gypsum granular         saline (ESP > 6 or ECe > 4 dS/m)   0.40
        //                           normal                              0.60
        //   MAP granular            alkaline (pH ≥ 7.5)                 0.55
        //                           neutral                             0.70
        //   MAP foliar (Tech soluble foliar P)  any pH                  0.65
        //   Lime / dolomite granular  acid (pH < 6.0)                   0.80
        //   Sulphate of ammonia granular  any pH                        0.75
        //   Elemental S granular      alkaline (acidification target)   0.50
        //   Potassium sulphate granular  any                            0.70
        //   Kieserite / Epsom granular   any                            0.70
        //   Foliar (any nutrient)     any                               0.65
        //
        // Sources: Hopkins & Ellsworth (2005) calcareous P fixation review;
        //   Sample, Soper & Racz (1980) SSSAJ 44; Carrow & Duncan body of
        //   work on saline soil amendment; STRI / R&A turf practice notes.
        //   AU/NZ paspalum on coastal alkaline sand sits at the higher end
        //   of the alkaline-MAP range (low free-Ca carbonate fraction).
        //
        // C29 ships with deliveryMethod hardcoded to 'granular' as default;
        // C20 (b35fix424) populates deliveryMethod based on per-nutrient × surface
        // selection ('foliar' on greens/bowls/croquet for P/K/S; foliar everywhere
        // for Mg via Epsom — Epsom is sold as soluble in AU/NZ practice).
        //
        // b35fix424 (C20) foliar entries added:
        //   sulphateOfAmmonia.foliar = 0.65   (SOL-AS Tech soluble for S Rule 3 on close-cut)
        //   gypsum.foliar           = 0.55   (defensive only — Ca foliar rare; entry for completeness)
        //   epsom.foliar            = 0.65   (Mg Rule "else" path — Epsom always foliar)
        // epsom.granular kept as defensive fallback so non-greens sites that drop into
        // the Mg branch via a future code path don't fall through to defaultAmendmentEfficiency
        // (would otherwise emit 'default-no-delivery' source on every Mg site).
        amendmentEfficiency: {
            gypsum:               { granular: { saline: 0.40, normal: 0.60 },
                                    foliar:   { any: 0.55 } },
            map:                  { granular: { alkaline: 0.55, neutral: 0.70 },
                                    foliar:   { any: 0.65 } },
            lime:                 { granular: { any: 0.80 } },
            dolomite:             { granular: { any: 0.80 } },
            sulphateOfAmmonia:    { granular: { any: 0.75 },
                                    foliar:   { any: 0.65 } },
            elementalSulphur:     { granular: { any: 0.50 } },
            potassiumSulphate:    { granular: { any: 0.70 },
                                    foliar:   { any: 0.65 } },
            kieserite:            { granular: { any: 0.70 } },
            epsom:                { granular: { any: 0.70 },
                                    foliar:   { any: 0.65 } },
            foliarDefault:        { foliar:   { any: 0.65 } }
        },

        // Default amendment fallback when product-key isn't matched. Set to
        // 0.60 (mid-range across the table). Logged via console.warn so
        // misses surface during development.
        defaultAmendmentEfficiency: 0.60,

        
        gpParams: {
            c3: { optimalTemp: 20, sigma: 5.5 },
            c4: { optimalTemp: 31, sigma: 7 }
        },
        
        minGpThreshold: 0.10,
        
        removalRates: {
            bentgrass:          { N: 150, P: 15, K: 80,  Ca: 25, Mg: 12, S: 8 },
            perennialRyegrass:  { N: 180, P: 18, K: 100, Ca: 30, Mg: 15, S: 10 },
            kentuckyBluegrass:  { N: 160, P: 16, K: 90,  Ca: 28, Mg: 14, S: 9 },
            fineFescue:         { N: 100, P: 10, K: 60,  Ca: 20, Mg: 10, S: 6 },
            tallFescue:         { N: 140, P: 14, K: 80,  Ca: 25, Mg: 12, S: 8 },
            couch:            { N: 200, P: 20, K: 120, Ca: 35, Mg: 18, S: 12 },
            couch:              { N: 200, P: 20, K: 120, Ca: 35, Mg: 18, S: 12 },
            zoysiagrass:        { N: 120, P: 12, K: 70,  Ca: 22, Mg: 11, S: 7 },
            kikuyu:             { N: 250, P: 25, K: 140, Ca: 40, Mg: 20, S: 14 },
            buffalo:            { N: 80,  P: 8,  K: 50,  Ca: 15, Mg: 8,  S: 5 },
            seashorePaspalum:   { N: 160, P: 16, K: 90,  Ca: 28, Mg: 14, S: 9 },
            mixedCool:          { N: 160, P: 16, K: 85,  Ca: 26, Mg: 13, S: 8 },
            mixedWarm:          { N: 180, P: 18, K: 100, Ca: 32, Mg: 16, S: 10 }
        },
        
        clippingCollectionFactor: 2.5,
        trafficModifiers: { low: 0.8, moderate: 1.0, high: 1.2, extreme: 1.5 },
        
        // v1.1.0: Summer intent configuration
        summerIntentProfiles: {
            transition: {
                label: 'Transition to C4',
                description: 'Allow overseed to die back; C4 base takes over',
                summerC3: 0.10,
                transitionC3: 0.40,
                winterC3: 0.90
            },
            maintain: {
                label: 'Maintain Overseed',
                description: 'Keep overseed alive through summer with irrigation/management',
                summerC3: 0.35,
                transitionC3: 0.60,
                winterC3: 0.90
            },
            establish: {
                label: 'Establishing Overseed',
                description: 'New overseed being established',
                summerC3: 0.05,
                transitionC3: 0.30,
                winterC3: 0.85
            },
            dormant: {
                label: 'C4 Dormant Period',
                description: 'C4 base dormant; C3 overseed active',
                summerC3: 0.10,
                transitionC3: 0.50,
                winterC3: 0.95
            }
        },
        
        containerSelectors: [
            '.gaip-mlsn-progressive-container',
            '.gaip-mlsn-cards-grid',
            '.gaip-mlsn-cards',
            '.gaip-mlsn-output',
            '.gaip-mlsn-results',
            '.gaip-mlsn-section',
            '.gaip-soil-results',
            '.gaip-soil-section',
            '.gaip-soil-interpretation',
            '#gaip-soil-interpretation',
            '.gaip-results-container',
            '.gaip-analysis-results',
            '#gaip-results',
            '.gaip-hub-output',
            '.gaip-output-section'
        ],
        
        maxRetries: 8,
        retryBaseDelay: 250
    };

    let moduleState = {
        initialized: false,
        injected: false,
        retryCount: 0,
        lastFoundContainer: null
    };

    global.GAIP_NUTRITION_SOIL_CACHE = global.GAIP_NUTRITION_SOIL_CACHE || null;

    function log(message, data) {
        if (!NUTRITION_CONFIG.debug) return;
        if (data !== undefined) {
        } else {
        }
    }

    function safeNum(val, fallback) {
        const n = parseFloat(val);
        return isNaN(n) ? fallback : n;
    }

    function normalizeSpecies(species) {
        if (!species) return 'mixedCool';
        
        // BEST: Use SpeciesController when available
        if (window.SpeciesController && typeof window.SpeciesController.normalize === 'function') {
            return window.SpeciesController.normalize(species);
        }
        
        // FALLBACK: Original logic
        const s = String(species).toLowerCase().replace(/[\s\-_]+/g, '').replace(/grass$/, '');
        
        const aliases = {
            'couch': 'couch', 'bermuda': 'couch', 'bermudagrass': 'couch',
            'cynodon': 'couch', 'bent': 'bentgrass', 'creepingbent': 'bentgrass',
            'agrostis': 'bentgrass', 'prg': 'perennialRyegrass', 'rye': 'perennialRyegrass',
            'ryegrass': 'perennialRyegrass', 'perennialrye': 'perennialRyegrass',
            'kbg': 'kentuckyBluegrass', 'bluegrass': 'kentuckyBluegrass',
            'poa': 'kentuckyBluegrass', 'fescue': 'fineFescue', 'tallfescue': 'tallFescue',
            'finefescue': 'fineFescue', 'chewings': 'fineFescue', 'chewingsfescue': 'fineFescue', 'zoysia': 'zoysia',
            'paspalum': 'seashore_paspalum', 'seashore': 'seashore_paspalum'
        };
        
        if (aliases[s]) return aliases[s];
        for (const key of Object.keys(NUTRITION_CONFIG.removalRates)) {
            if (key.toLowerCase() === s) return key;
        }
        return isC4Species(species) ? 'mixedWarm' : 'mixedCool';
    }

    function isC4Species(species) {
        if (!species) return false;
        const s = String(species).toLowerCase();
        return s.includes('couch') || s.includes('bermuda') || 
               s.includes('kikuyu') || s.includes('buffalo') ||
               s.includes('zoysia') || s.includes('paspalum') ||
               s.includes('c4') || s.includes('warm');
    }

    // =========================================================================
    // OVERSEED DETECTION - v1.1.0 ENHANCED
    // =========================================================================

    function detectOverseedScenario() {
        const result = {
            isOverseed: false,
            baseSpecies: null,
            overseedSpecies: null,
            summerIntent: 'transition',
            baseIsC4: false,
            intentProfile: null
        };
        
        // Gather data from all possible sources
        if (global.GilbaHubOrchestrator) {
            const state = global.GilbaHubOrchestrator.getState();
            
            if (state?.inputs?.turf) {
                const turf = state.inputs.turf;
                result.baseSpecies = turf.grassSpecies || turf.species || turf.warmBase;
                // v1.1.4: Only assign overseedSpecies if explicitly non-empty
                const _orchOverseed = turf.overseedSpecies || turf.winterOverseed || turf.coolOverseed;
                if (_orchOverseed) result.overseedSpecies = _orchOverseed;
                result.summerIntent = turf.summerIntent || turf.overseedSummerIntent || 'transition';
            }
            
            if (state?.turf) {
                result.baseSpecies = result.baseSpecies || state.turf.grassSpecies || state.turf.warmBase;
                const _orchTurfOverseed = state.turf.overseedSpecies || state.turf.coolOverseed;
                if (_orchTurfOverseed) result.overseedSpecies = result.overseedSpecies || _orchTurfOverseed;
                result.summerIntent = state.turf.summerIntent || state.turf.overseedSummerIntent || result.summerIntent;
            }
        }
        
        if (global.GAIP_STATE?.turf) {
            result.baseSpecies = result.baseSpecies || global.GAIP_STATE.turf.grassSpecies || global.GAIP_STATE.turf.warmBase;
            // v1.1.4: Only read overseedSpecies/coolOverseed if explicitly non-empty.
            // An empty string from site-config-persistence must not overwrite a null.
            const _gaipCoolOverseed = global.GAIP_STATE.turf.coolOverseed || global.GAIP_STATE.turf.overseedSpecies;
            if (_gaipCoolOverseed) result.overseedSpecies = result.overseedSpecies || _gaipCoolOverseed;
            result.summerIntent = global.GAIP_STATE.turf.summerIntent || global.GAIP_STATE.turf.overseedSummerIntent || result.summerIntent;
        }
        
        // Check GAIP_OVERSEED_STATE for explicit overseed config
        // v1.1.4: GAIP_OVERSEED_STATE is null for pure C4 sites (cleared by overseed-climate-integration v1.2.3)
        if (global.GAIP_OVERSEED_STATE) {
            const os = global.GAIP_OVERSEED_STATE;
            if (os.baseSpecies) result.baseSpecies = result.baseSpecies || os.baseSpecies;
            // Only accept overseedSpecies from this source if it is non-empty
            if (os.overseedSpecies) result.overseedSpecies = result.overseedSpecies || os.overseedSpecies;
            if (os.summerIntent) result.summerIntent = os.summerIntent;
            // If GAIP_OVERSEED_STATE says it's an overseed scenario, trust it —
            // but only if overseedSpecies is explicitly present (not a default fallback)
            if (os.isC4Base && os.overseedSpecies) {
                result.isOverseed = true;
                result.baseIsC4 = true;
            }
        } else {
            // GAIP_OVERSEED_STATE is null = pure C4, no overseed. Clear any overseedSpecies
            // that may have leaked in from another state source.
            if (result.baseIsC4 || (result.baseSpecies && ['couch','bermuda','kikuyu','zoysia','buffalo','buffalograss','seashore paspalum','paspalum'].some(s => (result.baseSpecies||'').toLowerCase().includes(s)))) {
                result.overseedSpecies = null;
            }
        }
        
        // v1.1.3: Determine baseIsC4 from ACTUAL species, not from upstream inference
        // This overrides any incorrect isC4Base from GAIP_OVERSEED_STATE
        if (result.baseSpecies) {
            result.baseIsC4 = isC4Species(result.baseSpecies);
        }
        
        // v1.1.3: Validate overseed scenario with strict checks
        // An overseed scenario requires:
        // 1. A C4 base species (verified by isC4Species, not just a flag)
        // 2. A different C3 overseed species
        // 3. The base and overseed must be different species
        if (result.baseSpecies && result.overseedSpecies) {
            const overseedIsC4 = isC4Species(result.overseedSpecies);
            const speciesAreDifferent = normalizeSpecies(result.baseSpecies) !== normalizeSpecies(result.overseedSpecies);
            
            // Only valid overseed if: C4 base + C3 overseed + different species
            result.isOverseed = result.baseIsC4 && !overseedIsC4 && speciesAreDifferent;
            
            // v1.1.3: If baseIsC4 is false, force isOverseed to false regardless
            // This catches cases where upstream incorrectly inferred a C4 base
            if (!result.baseIsC4) {
                result.isOverseed = false;
                result.overseedSpecies = null; // Clear invalid overseed
                log('Corrected: baseIsC4=false, forcing isOverseed=false (straight C3 grass)');
            }
        } else {
            result.isOverseed = false;
        }
        
        result.intentProfile = NUTRITION_CONFIG.summerIntentProfiles[result.summerIntent] || 
                               NUTRITION_CONFIG.summerIntentProfiles.transition;
        
        log('Overseed detection:', result);
        return result;
    }

    function extractLatitude() {
        if (global.GilbaHubOrchestrator) {
            const state = global.GilbaHubOrchestrator.getState();
            if (state?.location?.lat) return state.location.lat;
            if (state?.inputs?.location?.lat) return state.inputs.location.lat;
        }
        // Priority: .gaip-lat (the actual hub DOM input), then legacy selectors
        const latInput = document.querySelector('.gaip-lat, [name="latitude"], .gaip-latitude, #latitude');
        if (latInput && latInput.value) return parseFloat(latInput.value) || -33;
        return -33;
    }

    // =========================================================================
    // DEPRECATED LOCAL CALCULATIONS (b35fix302b)
    //
    // These functions are preserved for compatibility with any code path that
    // may still call them directly, and as a fallback if the engine fails to
    // load. Production rendering path now delegates to
    // NutritionRequirementEngine_Pure.compute() (see renderNutritionSummary).
    // Scheduled for removal in b35fix31x once no external callers remain and
    // engine-load stability is confirmed across GAIP + GSSH modes.
    //
    // Known local bugs NOT fixed here (fixed in engine):
    //   - NUTRITION_CONFIG.removalRates has duplicate 'couch' key
    //   - normalizeSpecies('zoysia')   → 'zoysia' (no such removalRates key)
    //   - normalizeSpecies('paspalum') → 'seashore_paspalum' (camelCase key is seashorePaspalum)
    // Both silently fall back to mixedCool defaults. Engine returns species-
    // correct values; deprecated path preserved with bugs so behaviour is
    // bit-identical to pre-302b builds.
    // =========================================================================

    // =========================================================================
    // MLSN CALCULATIONS
    // =========================================================================

    function getMLSNThreshold(nutrient, ph) {
        if (nutrient === 'P' && ph) {
            for (const adj of NUTRITION_CONFIG.pPhAdjustments) {
                if (ph <= adj.maxPh) return adj.threshold;
            }
        }
        return NUTRITION_CONFIG.mlsnThresholds[nutrient] || 0;
    }

    function getMLSNTarget(nutrient, ph) {
        return getMLSNThreshold(nutrient, ph) * NUTRITION_CONFIG.targetMultiplier;
    }

    function getRemovalRate(species, nutrient) {
        const normalized = normalizeSpecies(species);
        return NUTRITION_CONFIG.removalRates[normalized]?.[nutrient] || 
               NUTRITION_CONFIG.removalRates.mixedCool[nutrient];
    }

    /**
     * b35fix423 (C29) — Amendment efficiency lookup.
     *
     * Returns the efficiency multiplier (0.0 - 1.0) for an amendment under the
     * specified delivery method and soil condition. Used by the recommendation
     * engine to convert a theoretical kg/ha rate (1:1 deficit-to-product) into
     * a practical applied rate (deficit / efficiency / yearsToCorrect).
     *
     * @param {string} amendmentKey  Amendment table key (e.g. 'gypsum', 'map',
     *                               'lime', 'sulphateOfAmmonia'). See
     *                               NUTRITION_CONFIG.amendmentEfficiency.
     * @param {string} deliveryMethod  'granular' | 'foliar'. C29 ships with
     *                                 'granular' default; C20 will populate
     *                                 'foliar' for greens/bowls/croquet.
     * @param {Object} soilData  { pH, ESP, ECe, ... } — used to derive the
     *                            soil condition (saline / alkaline / neutral
     *                            / acid / any) for the lookup.
     * @returns {Object} { efficiency: Number, condition: String, source: String }
     *
     * Returns defaultAmendmentEfficiency (0.60) when the lookup misses, with
     * source='default' so the caller can flag the miss in audit copy.
     */
    function getAmendmentEfficiency(amendmentKey, deliveryMethod, soilData) {
        const table = NUTRITION_CONFIG.amendmentEfficiency;
        const dflt = NUTRITION_CONFIG.defaultAmendmentEfficiency;
        if (!amendmentKey || !table[amendmentKey]) {
            return { efficiency: dflt, condition: 'unknown', source: 'default-no-key' };
        }
        const delivery = deliveryMethod || 'granular';
        const deliveryTable = table[amendmentKey][delivery];
        if (!deliveryTable) {
            return { efficiency: dflt, condition: 'unknown', source: 'default-no-delivery' };
        }

        // Derive soil condition from soilData. Order matters — saline takes
        // precedence over alkaline (Rockingham-class case: pH 8.5 + ESP 8 =
        // saline branch, not alkaline branch).
        const pH = soilData && soilData.pH != null ? parseFloat(soilData.pH) : null;
        const ESP = soilData && soilData.ESP != null ? parseFloat(soilData.ESP) : null;
        const ECe = soilData && soilData.ECe != null ? parseFloat(soilData.ECe) : null;

        const isSaline = (ESP !== null && ESP > 6) || (ECe !== null && ECe > 4);
        const isAlkaline = pH !== null && pH >= 7.5;
        const isAcid = pH !== null && pH < 6.0;
        const isNeutral = pH !== null && pH >= 6.0 && pH < 7.5;

        // Try condition keys in priority order, fall through to 'any' if no
        // soil-condition-specific entry exists for this amendment.
        let condition = null;
        if (isSaline && deliveryTable.saline != null) condition = 'saline';
        else if (isAlkaline && deliveryTable.alkaline != null) condition = 'alkaline';
        else if (isAcid && deliveryTable.acid != null) condition = 'acid';
        else if (isNeutral && deliveryTable.neutral != null) condition = 'neutral';
        else if (deliveryTable.normal != null) condition = 'normal';
        else if (deliveryTable.any != null) condition = 'any';

        if (condition === null) {
            return { efficiency: dflt, condition: 'unknown', source: 'default-no-condition' };
        }
        return {
            efficiency: deliveryTable[condition],
            condition: condition,
            source: amendmentKey + '/' + delivery + '/' + condition
        };
    }

    function calculateNutrientRequirement(nutrient, currentLevel, config) {
        const threshold = getMLSNThreshold(nutrient, config.ph);
        const target = getMLSNTarget(nutrient, config.ph);
        const removal = getRemovalRate(config.species, nutrient);
        const yearsToCorrect = NUTRITION_CONFIG.yearsToCorrect[nutrient] || 2;
        
        let clippingFactor = config.clippingsCollected ? NUTRITION_CONFIG.clippingCollectionFactor : 1;
        let trafficMod = NUTRITION_CONFIG.trafficModifiers[config.trafficIntensity] || 1;
        
        const adjustedRemoval = removal * clippingFactor * trafficMod;
        let correctionRequired = currentLevel < threshold ? (target - currentLevel) / yearsToCorrect : 0;

        // Strict MLSN three-tier logic:
        // Above target (MLSN min × 1.5): apply 0 — let soil draw down naturally
        // Between threshold and target: apply removal only — maintain current level
        // Below threshold: apply removal + deficit correction
        let annualRequirement;
        if (currentLevel > target) {
            annualRequirement = 0;
        } else {
            annualRequirement = Math.max(0, adjustedRemoval + correctionRequired);
        }

        let status = 'Adequate';
        if (currentLevel < threshold * 0.5) status = 'Very Low';
        else if (currentLevel < threshold) status = 'Low';
        else if (currentLevel > target * 2) status = 'Excessive';
        else if (currentLevel > target) status = 'High';
        
        return {
            nutrient, currentLevel, threshold, target,
            removal: adjustedRemoval, correctionRequired,
            annualRequirement: Math.round(annualRequirement * 10) / 10,
            status
        };
    }

    function calculateAllRequirements(soilValues, config) {
        const nutrients = ['P', 'K', 'Ca', 'Mg', 'S'];
        const results = {};
        for (const nutrient of nutrients) {
            const currentLevel = soilValues[nutrient];
            if (currentLevel !== undefined && currentLevel !== null) {
                results[nutrient] = calculateNutrientRequirement(nutrient, currentLevel, config);
            }
        }
        return results;
    }

    // =========================================================================
    // GROWTH POTENTIAL CALCULATIONS
    // =========================================================================

    function calculateGPForTemp(temp, c3Fraction = 1) {
        const GPE = global.GilbaGrowthPotentialEngine;
        if (!GPE) return 0;
        const gp = GPE.compute(temp, { model: 'pace', species: 'blend', c3Fraction: c3Fraction });
        return gp != null ? gp : 0;
    }

    /**
     * v1.1.0: Enhanced monthly C3 fractions based on summerIntent
     */
    function calculateMonthlyC3Fractions(overseedConfig, hemisphere) {
        if (!overseedConfig.isOverseed) {
            const fraction = overseedConfig.baseIsC4 ? 0 : 1;
            const result = {};
            for (let m = 1; m <= 12; m++) result[m] = fraction;
            return result;
        }
        
        const fractions = {};
        const intent = overseedConfig.summerIntent || 'transition';
        const profile = NUTRITION_CONFIG.summerIntentProfiles[intent] || 
                       NUTRITION_CONFIG.summerIntentProfiles.transition;
        
        log(`Calculating C3 fractions with intent: ${intent}`, profile);
        
        for (let month = 1; month <= 12; month++) {
            const season = getSeason(month, hemisphere);
            if (season === 'Winter') {
                fractions[month] = profile.winterC3;
            } else if (season === 'Summer') {
                fractions[month] = profile.summerC3;
            } else {
                fractions[month] = profile.transitionC3;
            }
        }
        
        log('Monthly C3 fractions:', fractions);
        return fractions;
    }

    function calculateMonthlyGPWithOverseed(monthlyTemps, monthlyC3Fractions) {
        const gp = {};
        for (let month = 1; month <= 12; month++) {
            const temp = monthlyTemps[month] || 15;
            const c3Fraction = monthlyC3Fractions ? monthlyC3Fractions[month] : 1.0;
            gp[month] = Math.round(calculateGPForTemp(temp, c3Fraction) * 100) / 100;
        }
        return gp;
    }

    function calculateMonthlyGP(monthlyTemps, c3Fraction) {
        const gp = {};
        for (let month = 1; month <= 12; month++) {
            const temp = monthlyTemps[month] || 15;
            gp[month] = Math.round(calculateGPForTemp(temp, c3Fraction) * 100) / 100;
        }
        return gp;
    }

    function distributeNGPWeighted(annualN, monthlyGP) {
        let totalGP = 0;
        const activeMonths = [];
        
        for (let month = 1; month <= 12; month++) {
            if (monthlyGP[month] >= NUTRITION_CONFIG.minGpThreshold) {
                totalGP += monthlyGP[month];
                activeMonths.push(month);
            }
        }
        
        if (totalGP === 0) {
            const perMonth = annualN / 12;
            const result = {};
            for (let month = 1; month <= 12; month++) {
                result[month] = Math.round(perMonth * 10) / 10;
            }
            return result;
        }
        
        const result = {};
        for (let month = 1; month <= 12; month++) {
            if (monthlyGP[month] >= NUTRITION_CONFIG.minGpThreshold) {
                const fraction = monthlyGP[month] / totalGP;
                result[month] = Math.round(annualN * fraction * 10) / 10;
            } else {
                result[month] = 0;
            }
        }
        return result;
    }

    function getMonthNames() {
        return ['', 'Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
    }

    function getSeason(month, hemisphere) {
        hemisphere = hemisphere || 'south';
        const seasonsNorth = {
            12: 'Winter', 1: 'Winter', 2: 'Winter',
            3: 'Spring', 4: 'Spring', 5: 'Spring',
            6: 'Summer', 7: 'Summer', 8: 'Summer',
            9: 'Autumn', 10: 'Autumn', 11: 'Autumn'
        };
        const seasonsSouth = {
            6: 'Winter', 7: 'Winter', 8: 'Winter',
            9: 'Spring', 10: 'Spring', 11: 'Spring',
            12: 'Summer', 1: 'Summer', 2: 'Summer',
            3: 'Autumn', 4: 'Autumn', 5: 'Autumn'
        };
        return hemisphere.toLowerCase().includes('south') ? seasonsSouth[month] : seasonsNorth[month];
    }

    // =========================================================================
    // DATA EXTRACTION
    // =========================================================================

    function extractSoilValues() {
        function extractFromSoilData(soil) {
            if (!soil) return null;
            const source = soil.ppm || soil;
            const result = {
                P: source.P ?? source.p,
                K: source.K ?? source.k,
                Ca: source.Ca ?? source.ca,
                Mg: source.Mg ?? source.mg,
                S: source.S ?? source.s,
                pH: soil.pH ?? soil.pH_water ?? source.pH,
                // GH-299 (D07 item 6): carried through so renderNutritionSummary()
                // can resolve an AA ceiling via HillLabsSampleTypes.deriveCode()/
                // getRangesPpm() before calling the requirement engine. Previously
                // dropped here, which meant soil.methodology never reached
                // NutritionRequirementEngine_Pure.compute() from this call site at
                // all -- every site was silently treated as MLSN for the Nutrition
                // Program's annual-requirement figure, AA included.
                methodology: soil.methodology || null,
                soilTexture: soil.soilTexture || null,
                CEC: soil.CEC ?? soil.cec ?? null
            };
            if (result.P || result.K || result.Ca || result.Mg || result.S) {
                return result;
            }
            return null;
        }
        
        if (global.GAIP_STATE?.soil) {
            const extracted = extractFromSoilData(global.GAIP_STATE.soil);
            if (extracted) {
                log('Soil values from GAIP_STATE:', extracted);
                return extracted;
            }
        }

        if (global.GilbaHubOrchestrator) {
            const state = global.GilbaHubOrchestrator.getState();
            if (state?.soil) {
                const extracted = extractFromSoilData(state.soil);
                if (extracted) return extracted;
            }
            if (state?.inputs?.soil) {
                const extracted = extractFromSoilData(state.inputs.soil);
                if (extracted) return extracted;
            }
        }

        if (global.GAIP_NUTRITION_SOIL_CACHE) {
            const extracted = extractFromSoilData(global.GAIP_NUTRITION_SOIL_CACHE);
            if (extracted) return extracted;
        }

        // GH-297: on a fresh site switch, the MLSN engine's rendered HTML table
        // (the thing GAIP_STATE.soil / GilbaHubOrchestrator's state / the
        // GAIP_NUTRITION_SOIL_CACHE mirror all ultimately derive from) can still
        // be empty at the moment gaip:monthly-normals-ready/gaip:analysis-complete
        // fire for the new site -- confirmed live: hub-persistence.js's own primary
        // MLSN-scrape path logged "verdict: NO DATA" for this exact site switch,
        // while its GAIP_SampleManager-based fallback (same one used here) found a
        // real sample seconds later. Without an equivalent fallback here,
        // renderNutritionSummary() bails on its hasData check before ever reaching
        // the monthly-N computation -- not a climate-normals problem (monthlyTemps
        // was already resolved at that point), a soil-data-source gap specific to
        // the just-switched site. Mirrors hub-persistence.js's own
        // GAIP_SampleManager fallback (site-aware getAllSamples() first, to avoid
        // the same active-site mismatch that fallback's own comment documents).
        if (global.GAIP_SampleManager) {
            try {
                const siteId = window.GAIP_HUB_CONFIG && window.GAIP_HUB_CONFIG.activeSiteId;
                let soilSamples = null;
                if (siteId && typeof global.GAIP_SampleManager.getAllSamples === 'function') {
                    const allS = global.GAIP_SampleManager.getAllSamples();
                    soilSamples = (allS.allSites && allS.allSites[siteId] && allS.allSites[siteId].soil) || null;
                }
                if (!soilSamples && typeof global.GAIP_SampleManager.getSamples === 'function') {
                    soilSamples = global.GAIP_SampleManager.getSamples('soil');
                }
                if (soilSamples) {
                    let latestId = null, latestDate = '';
                    Object.keys(soilSamples).forEach(sid => {
                        const d = soilSamples[sid].date || '';
                        if (!latestId || d > latestDate) { latestId = sid; latestDate = d; }
                    });
                    if (latestId) {
                        const raw = soilSamples[latestId].rawData || soilSamples[latestId].values || {};
                        const cleaned = {};
                        Object.keys(raw).forEach(k => {
                            const clean = k.replace(/_ppm$/i, '').replace(/_me$/i, '');
                            const v = parseFloat(raw[k]);
                            if (!isNaN(v)) cleaned[clean] = v;
                        });
                        const extracted = extractFromSoilData(cleaned);
                        if (extracted) {
                            log('Soil values from GAIP_SampleManager:', extracted);
                            return extracted;
                        }
                    }
                }
            } catch (e) {}
        }

        const values = {};
        const fieldMap = {
            P: ['#soil-p', '.gaip-soil-p', '[name="soil-p"]', '[data-nutrient="P"]'],
            K: ['#soil-k', '.gaip-soil-k', '[name="soil-k"]', '[data-nutrient="K"]'],
            Ca: ['#soil-ca', '.gaip-soil-ca', '[name="soil-ca"]', '[data-nutrient="Ca"]'],
            Mg: ['#soil-mg', '.gaip-soil-mg', '[name="soil-mg"]', '[data-nutrient="Mg"]'],
            S: ['#soil-s', '.gaip-soil-s', '[name="soil-s"]', '[data-nutrient="S"]'],
            pH: ['#soil-ph', '.gaip-soil-ph', '[name="soil-ph"]', '[data-nutrient="pH"]']
        };
        
        for (const [nutrient, selectors] of Object.entries(fieldMap)) {
            for (const selector of selectors) {
                const el = document.querySelector(selector);
                if (el && el.value) {
                    values[nutrient] = parseFloat(el.value);
                    break;
                }
            }
        }
        return values;
    }

    function extractTurfConfig() {
        const config = {
            species: 'perennialRyegrass',
            clippingsCollected: false,
            trafficIntensity: 'moderate',
            hemisphere: 'south'
        };
        
        if (global.GilbaHubOrchestrator) {
            const state = global.GilbaHubOrchestrator.getState();
            if (state?.turf) {
                config.species = state.turf.grassSpecies || state.turf.species || config.species;
                config.clippingsCollected = state.turf.clippingsCollected || false;
            }
            if (state?.traffic) {
                if (state.traffic.matchesPerWeek > 3) config.trafficIntensity = 'extreme';
                else if (state.traffic.matchesPerWeek > 1) config.trafficIntensity = 'high';
            }
            if (state?.location?.hemisphere) {
                config.hemisphere = state.location.hemisphere;
            }
        }
        
        if (global.GAIP_STATE?.turf) {
            config.species = global.GAIP_STATE.turf.grassSpecies || config.species;
            config.clippingsCollected = global.GAIP_STATE.turf.clippingsCollected ?? config.clippingsCollected;
        }
        
        const speciesSelect = document.querySelector('.gaip-grass-species, #grass-species, [name="grass-species"]');
        if (speciesSelect) config.species = speciesSelect.value || config.species;
        
        const lat = extractLatitude();
        config.hemisphere = lat < 0 ? 'south' : 'north';
        
        return config;
    }

    // GH-296: same coordinate-read climate-normals-service.js's own
    // readCoords() uses, duplicated here (not imported — that file exposes no
    // "current site's coords" getter) so extractMonthlyTemps() below can query
    // its per-coordinate cache directly as a race-proof fallback.
    function _readCoordsForNormals() {
        let lat, lon;
        if (typeof document !== 'undefined') {
            const latEl = document.querySelector('.gaip-lat');
            const lonEl = document.querySelector('.gaip-lon');
            if (latEl && lonEl) {
                lat = parseFloat(latEl.value);
                lon = parseFloat(lonEl.value);
            }
        }
        if (!isFinite(lat) || !isFinite(lon)) {
            const loc = global.GAIP_STATE && global.GAIP_STATE.location;
            if (loc) {
                lat = parseFloat(loc.lat);
                lon = parseFloat(loc.lon != null ? loc.lon : loc.lng);
            }
        }
        if (isFinite(lat) && isFinite(lon) && lat && lon) {
            return { lat, lon };
        }
        return null;
    }

    // GH-296: climate-normals-service.js's own resolved-value cache
    // (_resolvedByCoord), read synchronously via getResolvedSync() — never
    // touched by either of the two wipes below, so it's the one source that
    // survives every Re-run.
    function _resolvedNormals() {
        if (!global.GilbaClimateNormalsService || typeof global.GilbaClimateNormalsService.getResolvedSync !== 'function') {
            return null;
        }
        const coords = _readCoordsForNormals();
        if (!coords) return null;
        return global.GilbaClimateNormalsService.getResolvedSync(coords.lat, coords.lon);
    }

    // GH-245: reads the real monthly climate normals resolved by
    // ClimateFetchCoordinator.ensureMonthlyNormals() (climate-engine-v2.js):
    // NASA POWER climatology first, Open-Meteo archive average as fallback.
    // Returns null — never a guessed regional profile — when neither source
    // has resolved yet or both failed. Callers must treat null as "climate
    // data unavailable" and surface that explicitly, not compute against a
    // fabricated series. See Hoxton audit D02/D03.
    //
    // GH-296: the first two reads below are NOT stable across a Re-run.
    // hub-tissue-v3.js's validateClimateMetrics() rebuilds window.climateMetrics
    // from a strict whitelist (temperature/stress/growth/moisture only) on every
    // weather fetch, and hub-orchestrator.js's canonical-state rebuild
    // (GAIP_CANONICAL_STATE.climate = {...}) does the same to
    // GilbaHubOrchestrator's state.climate — neither preserves monthlyTemps,
    // which climate-normals-service.js's applyResult() only ever writes once
    // (its one-time page-load fetch, never re-triggered by Re-run). Net effect,
    // confirmed live: whether either read below still has monthlyTemps after a
    // given Re-run depends purely on whether that one-time fetch happened to
    // resolve before or after that Re-run's climate rebuild — a genuine,
    // non-deterministic race, reproducing "correct, then wrong, then correct
    // again" across consecutive Re-runs of the same site. _resolvedNormals()
    // (third tier) reads climate-normals-service.js's own untouched cache
    // directly and is not subject to either wipe — always correct once the
    // one-time fetch has resolved at all, regardless of Re-run timing.
    function extractMonthlyTemps() {
        if (global.climateMetrics?.monthlyTemps) {
            return global.climateMetrics.monthlyTemps;
        }

        if (global.GilbaHubOrchestrator) {
            const state = global.GilbaHubOrchestrator.getState();
            if (state?.climate?.monthlyTemps) {
                return state.climate.monthlyTemps;
            }
        }

        const resolved = _resolvedNormals();
        if (resolved?.monthlyTemps) {
            return resolved.monthlyTemps;
        }

        return null;
    }

    // Source label for the resolved monthlyTemps ('nasa-power',
    // 'open-meteo-fallback', or 'unavailable'), for UI/export labelling.
    function extractMonthlyTempsSource() {
        if (global.climateMetrics?.monthlyTempsSource) {
            return global.climateMetrics.monthlyTempsSource;
        }
        const resolved = _resolvedNormals();
        return resolved?.source || 'unavailable';
    }

    // Info tooltip explaining that Monthly N Distribution uses climate
    // normals (not live weather), and which source resolved them — matches
    // the existing "assumptions" tooltip style used for MLSN/tissue/water.
    function showClimateNormalsInfo(btn) {
        document.querySelectorAll('.gaip-assumptions-tooltip').forEach(t => t.remove());

        const source = extractMonthlyTempsSource();
        const period = global.climateMetrics?.monthlyTempsPeriod || _resolvedNormals()?.period || '';
        const sourceLabel = source === 'nasa-power'
            ? `NASA POWER climatology (${period || '2001–2020'})`
            : source === 'open-meteo-fallback'
            ? `Open-Meteo archive average (${period || 'recent years'}) — fallback, NASA POWER was unavailable`
            : 'unavailable';

        const tooltip = document.createElement('div');
        tooltip.className = 'gaip-assumptions-tooltip';
        tooltip.style.cssText = `
            position: fixed;
            z-index: 99999;
            max-width: 300px;
            background: var(--gaip-surface);
            color: var(--gaip-text);
            border: 1px solid var(--gaip-border);
            padding: 12px 14px;
            border-radius: 8px;
            box-shadow: 0 10px 25px rgba(0, 0, 0, 0.4);
            font-size: 12px;
            line-height: 1.5;
        `;
        tooltip.innerHTML = `
            <div style="margin-bottom: 8px; font-weight: 600; font-size: 13px; border-bottom: 1px solid var(--gaip-border); padding-bottom: 6px;">
                About these values
            </div>
            <div>These are long-term monthly climate normals for this site's coordinates, not live weather.</div>
            <div style="margin-top: 6px;"><strong>Source:</strong> ${sourceLabel}</div>
            <div style="margin-top: 6px;">Live current conditions are shown separately in Climate &amp; Growth Conditions.</div>
        `;
        document.body.appendChild(tooltip);

        const rect = btn.getBoundingClientRect();
        const left = Math.max(8, Math.min(rect.left, window.innerWidth - 316));
        tooltip.style.top = `${rect.bottom + 6}px`;
        tooltip.style.left = `${left}px`;

        const autoHide = setTimeout(() => tooltip.remove(), 8000);
        tooltip.addEventListener('click', () => { clearTimeout(autoHide); tooltip.remove(); });
    }

    // b35fix312 Fix 2: Nutrition Program panel input takes precedence.
    // The Nutrition Program section has its own Annual N Target field
    // (.gaip-nutrition-annual-n, added b35fix~280) intended as the primary
    // user-facing input for N programme planning. Previously the engine only
    // read .gaip-n-program from the Turf Profile / Site Settings area, which
    // had a sticky hardcoded default of 200 (fix 3 removes that). If both
    // inputs have values, the Nutrition Program input wins.
    function _readPrimaryNInput() {
        const nutritionPanelInput = document.querySelector('.gaip-nutrition-annual-n');
        if (nutritionPanelInput && nutritionPanelInput.value) return nutritionPanelInput;
        // Fall back to legacy / secondary selectors
        return document.querySelector('.gaip-n-program, #n-program, [name="n-program"], .gaip-annual-n');
    }

    function extractAnnualNRate(species) {
        if (global.GilbaHubOrchestrator) {
            const state = global.GilbaHubOrchestrator.getState();
            if (state?.turf?.nProgramKgHaYr) return state.turf.nProgramKgHaYr;
            if (state?.inputs?.turf?.nProgramKgHaYr) return state.inputs.turf.nProgramKgHaYr;
        }

        const nInput = _readPrimaryNInput();
        if (nInput && nInput.value) return parseFloat(nInput.value);

        const normalized = normalizeSpecies(species);
        return NUTRITION_CONFIG.removalRates[normalized]?.N || 160;
    }

    // b35fix302b: returns ONLY user-specified N override (orchestrator/DOM),
    // or null if no override. Engine applies species default internally.
    // Prevents integration layer from resolving species default through the
    // buggy local NUTRITION_CONFIG.removalRates (duplicate couch key, bad
    // zoysia/paspalum aliases); engine uses the clean REMOVAL_RATES table.
    //
    // b35fix312 Fix 2: now uses _readPrimaryNInput helper so the Nutrition
    // Program panel input takes precedence over the Site Settings input.
    function extractUserAnnualN() {
        if (global.GilbaHubOrchestrator) {
            const state = global.GilbaHubOrchestrator.getState();
            if (state?.turf?.nProgramKgHaYr) return state.turf.nProgramKgHaYr;
            if (state?.inputs?.turf?.nProgramKgHaYr) return state.inputs.turf.nProgramKgHaYr;
        }
        const nInput = _readPrimaryNInput();
        if (nInput && nInput.value) {
            const parsed = parseFloat(nInput.value);
            return isNaN(parsed) ? null : parsed;
        }
        return null;
    }

    // =========================================================================
    // RENDERING
    // =========================================================================

    function renderDeficitSummary(requirements) {
        const nutrients = Object.keys(requirements);
        if (nutrients.length === 0) return '';
        
        let html = `
            <div class="gaip-nutrition-deficit-panel" style="
                margin-top: 16px;
                padding: 16px;
                background: linear-gradient(135deg, var(--gaip-info-bg) 0%, var(--gaip-info-bg) 100%);
                border: 1px solid #7dd3fc;
                border-radius: 8px;
            ">
                <div style="display: flex; align-items: center; margin-bottom: 12px; gap: 8px;">
                    <span style="font-size: 18px;">📊</span>
                    <strong style="font-size: 14px; color: #0369a1;">Annual Nutrient Requirements (${(function() {
                        const m = (window.GAIP_STATE?.soil?.methodology || 'mlsn').toLowerCase();
                        if (m === 'ammonium_acetate' || m === 'ammoniumacetate') return 'Ammonium Acetate';
                        if (m === 'slan') return 'SLAN';
                        return 'MLSN';
                    })()})</strong>
                </div>
                <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(100px, 1fr)); gap: 8px;">
        `;
        
        for (const nutrient of nutrients) {
            const req = requirements[nutrient];
            const statusColor = req.status === 'Low' || req.status === 'Very Low' ? '#dc2626' :
                               req.status === 'Excessive' || req.status === 'High' ? '#f59e0b' : '#16a34a';
            
            html += `
                <div style="
                    background: var(--gaip-surface);
                    padding: 10px;
                    border-radius: 6px;
                    text-align: center;
                    border: 1px solid var(--gaip-border);
                ">
                    <div style="font-weight: 600; color: var(--gaip-text); font-size: 13px;">${nutrient}</div>
                    <div style="font-size: 18px; font-weight: 700; color: ${statusColor};">
                        ${req.annualRequirement}
                    </div>
                    <div style="font-size: 10px; color: var(--gaip-text);">kg/ha/yr</div>
                    <div style="font-size: 10px; color: ${statusColor}; margin-top: 4px;">
                        ${req.status}
                    </div>
                    ${req.annualRequirement === 0 ? '<div style="font-size: 9px; color: var(--gaip-text-secondary); margin-top: 4px; line-height: 1.3;">Soil level exceeds MLSN target, no application required this season. Monitor annually.</div>' : ''}
                </div>
            `;
        }
        
        html += '</div></div>';
        return html;
    }

    /**
     * v1.1.0: Enhanced N distribution table with overseed intent indicator
     */
    function renderNDistributionTable(annualN, monthlyGP, nAllocations, config, overseedConfig, monthlyC3Fractions) {
        const monthNames = getMonthNames();
        
        let maxN = 0, activeMonths = [];
        for (let month = 1; month <= 12; month++) {
            if (nAllocations[month] > 0) {
                activeMonths.push(month);
                maxN = Math.max(maxN, nAllocations[month]);
            }
        }
        
        // v1.1.0: Build title with overseed strategy indicator
        let titleSuffix = '';
        let strategyBadge = '';
        
        if (overseedConfig.isOverseed) {
            const profile = overseedConfig.intentProfile || NUTRITION_CONFIG.summerIntentProfiles.transition;
            const intentColor = overseedConfig.summerIntent === 'maintain' ? '#7c3aed' : '#0891b2';
            const intentBg = overseedConfig.summerIntent === 'maintain' ? 'var(--gaip-info-bg)' : '#ecfeff';
            
            titleSuffix = ` <span style="font-size: 11px; color: ${intentColor}; background: ${intentBg}; padding: 2px 6px; border-radius: 4px; margin-left: 6px;">Overseed</span>`;
            
            strategyBadge = `
                <div style="
                    display: flex;
                    align-items: center;
                    gap: 8px;
                    padding: 8px 12px;
                    margin-bottom: 10px;
                    background: ${intentBg};
                    border: 1px solid ${intentColor}40;
                    border-radius: 6px;
                    font-size: 11px;
                ">
                    <span style="font-size: 14px;">🌱</span>
                    <div>
                        <strong style="color: ${intentColor};">${profile.label}</strong>
                        <span style="color: var(--gaip-text); margin-left: 6px;">${profile.description}</span>
                    </div>
                </div>
            `;
        }
        
        let html = `
            <div class="gaip-n-distribution-panel" style="
                margin-top: 12px;
                padding: 16px;
                background: linear-gradient(135deg, var(--gaip-good-bg) 0%, var(--gaip-good-bg) 100%);
                border: 1px solid #86efac;
                border-radius: 8px;
            ">
                <div style="display: flex; align-items: center; margin-bottom: 12px; gap: 8px; flex-wrap: wrap;">
                    <span style="font-size: 18px;">🌱</span>
                    <strong style="font-size: 14px; color: #166534;">Monthly N Distribution (GP-Weighted)</strong>
                    ${titleSuffix}
                    <button class="gaip-assumptions-btn" data-climate-info="monthly-normals" title="About these values">
                        <span class="gaip-icon-info">ⓘ</span>
                    </button>
                </div>
                
                ${strategyBadge}
                
                <div style="display: grid; grid-template-columns: repeat(12, 1fr); gap: 4px; margin-bottom: 10px;">
        `;
        
        for (let month = 1; month <= 12; month++) {
            const gp = monthlyGP[month] || 0;
            const n = nAllocations[month] || 0;
            const barHeight = maxN > 0 ? Math.round((n / maxN) * 40) : 0;
            const isActive = n > 0;
            const season = getSeason(month, config.hemisphere);
            
            const c3Frac = monthlyC3Fractions ? (monthlyC3Fractions[month] || 0) : (config.c3Fraction || 1);
            const isC3Month = c3Frac > 0.5;
            
            const seasonColors = {
                'Summer': 'var(--gaip-warning-bg)',
                'Autumn': 'var(--gaip-warning-border)',
                'Winter': 'var(--gaip-info-bg)',
                'Spring': 'var(--gaip-good-bg)'
            };
            
            // v1.1.0: Color bars by dominant species
            let barColor = '#22c55e';
            if (overseedConfig.isOverseed && isActive) {
                barColor = isC3Month ? '#3b82f6' : '#f59e0b'; // Blue for C3, Orange for C4
            }
            
            html += `
                <div style="
                    text-align: center;
                    padding: 6px 2px;
                    background: ${isActive ? seasonColors[season] : 'var(--gaip-surface-hover)'};
                    border-radius: 4px;
                    opacity: ${isActive ? 1 : 0.5};
                ">
                    <div style="font-size: 9px; color: var(--gaip-text); margin-bottom: 4px;">${monthNames[month]}</div>
                    <div style="
                        height: 40px;
                        display: flex;
                        align-items: flex-end;
                        justify-content: center;
                    ">
                        <div style="
                            width: 16px;
                            height: ${barHeight}px;
                            background: ${isActive ? barColor : 'var(--gaip-border)'};
                            border-radius: 2px 2px 0 0;
                        "></div>
                    </div>
                    <div style="font-size: 11px; font-weight: 600; color: ${isActive ? '#166534' : 'var(--gaip-text-muted)'}; margin-top: 4px;">
                        ${n > 0 ? n.toFixed(0) : '-'}
                    </div>
                </div>
            `;
        }
        
        // v1.1.0: Legend for overseed scenarios
        let legend = '';
        if (overseedConfig.isOverseed) {
            legend = `
                <div style="display: flex; gap: 12px; font-size: 10px; color: var(--gaip-text); margin-top: 8px;">
                    <span><span style="display: inline-block; width: 10px; height: 10px; background: #3b82f6; border-radius: 2px; margin-right: 4px;"></span>C3 Overseed (${overseedConfig.overseedSpecies || 'Ryegrass'})</span>
                    <span><span style="display: inline-block; width: 10px; height: 10px; background: #f59e0b; border-radius: 2px; margin-right: 4px;"></span>C4 Base (${overseedConfig.baseSpecies || 'Couch'})</span>
                </div>
            `;
        }
        
        html += `
                </div>
                ${legend}
                <div style="display: flex; justify-content: space-between; font-size: 11px; color: var(--gaip-text); padding-top: 8px; border-top: 1px solid #86efac;">
                    <span>Total: <strong>${annualN} kg N/ha/yr</strong></span>
                    <span>Active months: <strong>${activeMonths.length}</strong></span>
                </div>
            </div>
        `;
        
        return html;
    }

    // GH-299 (D07 item 6): resolves a per-nutrient {P:{min,max}, K:{...}, ...}
    // ppm map from HillLabsSampleTypes' certificate-backed SSOT, only when the
    // site's methodology is AA -- gated so MLSN/SLAN sites never even attempt
    // this resolution (avoids wasted work, and any risk of it accidentally
    // influencing a non-AA computation). Returns null when methodology isn't
    // AA, HillLabsSampleTypes isn't loaded, or deriveCode() finds no
    // certificate match for this species/texture (uncovered combo) -- the
    // engine's own graceful-degradation path (config.aaRanges absent) then
    // keeps today's unconditional pure-removal behaviour for every nutrient.
    function _resolveAARanges(soilValues, species) {
        if (!soilValues) return null;
        const m = String(soilValues.methodology || '').toUpperCase().replace(/[\s-]+/g, '_');
        if (m !== 'AA' && m !== 'AMMONIUM_ACETATE') return null;

        const hlst = global.HillLabsSampleTypes;
        const code = (hlst && typeof hlst.deriveCode === 'function')
            ? hlst.deriveCode(species, soilValues.soilTexture)
            : null;

        // GH-305 (D07 item 6, "correction for generic numbers too" -- user
        // decision, 2026-08-24): certificate-only ranges meant an uncertified
        // nutrient (uncovered species/texture, or a covered code whose
        // certificate prints no range for this one nutrient -- e.g. Sulphur
        // on S277) could never trigger the ceiling, even when clearly high --
        // "it will be incorrect to recommend adding fertilizers if we have
        // already high numbers". Falls back to AmmoniumAcetateMethodology.
        // getSufficiencyRange() (the same generic sands/others SSOT
        // hub-tissue-v3.js/nutrition-calendar.js/SampleAnalysisController.php
        // already use) for any nutrient the certificate path didn't cover.
        const aam = global.AmmoniumAcetateMethodology;
        const texKey = String(soilValues.soilTexture || '').toLowerCase().indexOf('sand') !== -1 ? 'sands' : 'others';

        const ranges = {};
        let any = false;
        ['P', 'K', 'Ca', 'Mg', 'S'].forEach(function (n) {
            let r = (code && hlst && typeof hlst.getRangesPpm === 'function')
                ? hlst.getRangesPpm(code, n, soilValues.CEC != null ? soilValues.CEC : undefined)
                : null;
            if (!r && aam && typeof aam.getSufficiencyRange === 'function') {
                const generic = aam.getSufficiencyRange(n, texKey);
                if (generic && generic.ranges && Array.isArray(generic.ranges.medium) &&
                    typeof generic.ranges.medium[1] === 'number' && isFinite(generic.ranges.medium[1])) {
                    r = { min: generic.ranges.medium[0], max: generic.ranges.medium[1] };
                }
            }
            if (r) { ranges[n] = r; any = true; }
        });
        return any ? ranges : null;
    }

    function renderNutritionSummary() {
        const soilValues = extractSoilValues();
        const turfConfig = extractTurfConfig();
        const monthlyTemps = extractMonthlyTemps();
        
        const hasData = soilValues && (soilValues.P || soilValues.K || soilValues.Ca);

        if (!hasData) {
            return `
                <div class="gaip-nutrition-placeholder" style="
                    margin-top: 16px; padding: 20px; background: var(--gaip-surface-muted);
                    border: 1px dashed var(--gaip-border); border-radius: 8px;
                    text-align: center; color: var(--gaip-text);
                ">
                    <span style="font-size: 24px; display: block; margin-bottom: 8px;">📋</span>
                    <strong>Nutrition Summary</strong>
                    <p style="margin: 8px 0 0 0; font-size: 12px;">
                        Enter soil test values above to see annual nutrient requirements and monthly N distribution.
                    </p>
                </div>
            `;
        }
        
        // GH-245: no fabricated regional-guess fallback exists anymore
        // (Hoxton audit D02/D03) — if NASA POWER and the Open-Meteo fallback
        // both failed to resolve real monthly normals for this site, say so
        // explicitly instead of computing Monthly N Distribution against an
        // invented temperature series. Message is deliberately non-technical
        // (client-facing) — source/provenance detail lives in the opt-in "i"
        // tooltip instead (showClimateNormalsInfo below).
        if (!monthlyTemps) {
            return `
                <div class="gaip-nutrition-placeholder" style="
                    margin-top: 16px; padding: 20px; background: var(--gaip-warning-bg);
                    border: 1px solid var(--gaip-warning-border); border-radius: 8px;
                    text-align: center; color: var(--gaip-text);
                ">
                    <strong>Climate data unavailable</strong>
                    <p style="margin: 8px 0 0 0; font-size: 12px;">
                        We couldn't load climate data for this site. Please try again in a moment.
                    </p>
                </div>
            `;
        }

        const overseedConfig = detectOverseedScenario();

        // b35fix302b: delegate pure calculation to NutritionRequirementEngine_Pure.
        // Integration layer keeps DOM/orchestrator reads (soil, turf, climate,
        // overseed, user-N-override); engine handles all math with canonical
        // MLSN thresholds, species-correct removal rates (zoysia/paspalum
        // aliases fixed), PACE GP via GilbaGrowthPotentialEngine, and the
        // C3-on-C3 overseed misconfiguration guard.
        //
        // Fallback: if engine not loaded (enqueue failure, legacy bundle),
        // the deprecated local functions below still produce a valid result
        // so the panel renders rather than throwing.
        const Engine = global.NutritionRequirementEngine_Pure ||
                       (typeof window !== 'undefined' && window.NutritionRequirementEngine_Pure);

        let requirements, monthlyC3Fractions, monthlyGP, annualN, nAllocations, monthlyNData, activeMonthCount;

        if (Engine && typeof Engine.compute === 'function') {
            const userN = extractUserAnnualN();
            const engineResult = Engine.compute({
                soil: soilValues,
                turf: {
                    species: turfConfig.species,
                    clippingsCollected: turfConfig.clippingsCollected,
                    trafficIntensity: turfConfig.trafficIntensity,
                    nProgramKgHaYr: userN  // null → engine uses species default
                },
                aaRanges: _resolveAARanges(soilValues, turfConfig.species),
                climate: {
                    monthlyTemps: monthlyTemps,
                    hemisphere: turfConfig.hemisphere
                },
                overseedConfig: overseedConfig
            });

            requirements = engineResult.perSample;
            monthlyC3Fractions = engineResult.facility.monthlyC3Fractions;
            monthlyGP = engineResult.facility.monthlyGP;
            annualN = engineResult.facility.annualN;
            monthlyNData = engineResult.facility.monthlyN;
            activeMonthCount = engineResult.facility.activeMonths;

            // Reconstruct {1..12: n} map for renderNDistributionTable
            nAllocations = {};
            for (let i = 0; i < 12; i++) nAllocations[i + 1] = monthlyNData[i].n;
        } else {
            // Deprecated local path — kept for fallback only. Remove once all
            // production environments confirmed to have engine loaded.
            monthlyC3Fractions = calculateMonthlyC3Fractions(overseedConfig, turfConfig.hemisphere);
            requirements = calculateAllRequirements(soilValues, {
                ph: soilValues.pH,
                species: turfConfig.species,
                clippingsCollected: turfConfig.clippingsCollected,
                trafficIntensity: turfConfig.trafficIntensity
            });
            monthlyGP = calculateMonthlyGPWithOverseed(monthlyTemps, monthlyC3Fractions);
            annualN = extractAnnualNRate(turfConfig.species);
            nAllocations = distributeNGPWeighted(annualN, monthlyGP);

            monthlyNData = [];
            activeMonthCount = 0;
            for (let month = 1; month <= 12; month++) {
                const n = nAllocations[month] || 0;
                const gp = monthlyGP[month] || 0;
                const c3Frac = monthlyC3Fractions[month] != null ? monthlyC3Fractions[month] : 1;
                monthlyNData.push({ n, gp, c3Frac });
                if (n > 0) activeMonthCount++;
            }
        }

        // b35fix329: engine output is no longer written to GAIP_NUTRITION_SOIL_CACHE.
        // The export-side fallback that read from this cache (word-export.js
        // pre-b35fix329) was the only consumer of these computed fields
        // (annualP/annualK/annualS/totalN/monthlyN). Read removed → write is
        // dead code. Removing keeps the global clean for its remaining
        // legitimate purpose: caching raw soil from gaip:analysis-complete
        // events for the on-page panel's soil-extraction fallback (lines
        // 595 + 1189 — those still write/read the soil shape, not the
        // engine output shape).
        //
        // Warn-once if any external integration still expects the engine
        // output cache. The flag is module-scoped — fires at most once per
        // page load, regardless of how many times the panel re-renders.
        if (!moduleState._b35fix329WarnedLegacyCacheWrite) {
            moduleState._b35fix329WarnedLegacyCacheWrite = true;
            log('b35fix329: skipping legacy GAIP_NUTRITION_SOIL_CACHE engine-output write. ' +
                'Word export consumes engine results directly (data.engineInputs path).');
        }

        // Expose monthlyN for hub-persistence.js to pick up during analysis cache save.
        if (Array.isArray(monthlyNData) && monthlyNData.length === 12) {
            global.__GAIP_MONTHLY_N__ = monthlyNData;
        }

        let html = renderDeficitSummary(requirements);
        html += renderNDistributionTable(annualN, monthlyGP, nAllocations, turfConfig, overseedConfig, monthlyC3Fractions);
        
        return html;
    }

    // =========================================================================
    // INTEGRATION
    // =========================================================================

    function findTargetContainer() {
        for (const selector of NUTRITION_CONFIG.containerSelectors) {
            const el = document.querySelector(selector);
            if (el) {
                log(`Found container: ${selector}`);
                return { container: el, selector };
            }
        }
        return null;
    }

    function debugAvailableContainers() {
        const found = [];
        for (const selector of NUTRITION_CONFIG.containerSelectors) {
            const el = document.querySelector(selector);
            if (el) found.push(selector);
        }
        
        log('Available containers:', found.length > 0 ? found : 'NONE');
        
        const gaipElements = document.querySelectorAll('[class*="gaip-"]');
        const gaipClasses = new Set();
        gaipElements.forEach(el => {
            el.classList.forEach(cls => {
                if (cls.startsWith('gaip-')) gaipClasses.add(cls);
            });
        });
        
        if (gaipClasses.size > 0) {
            log('All gaip- classes on page:', Array.from(gaipClasses).sort());
        }
        
        return { found, gaipClasses: Array.from(gaipClasses) };
    }

    function injectNutritionSummary() {
        const result = findTargetContainer();

        if (!result) {
            if (moduleState.retryCount < NUTRITION_CONFIG.maxRetries) {
                moduleState.retryCount++;
                const delay = NUTRITION_CONFIG.retryBaseDelay * Math.pow(1.5, moduleState.retryCount - 1);
                log(`No container found - retry ${moduleState.retryCount}/${NUTRITION_CONFIG.maxRetries} in ${Math.round(delay)}ms`);
                setTimeout(injectNutritionSummary, delay);
            } else {
                log('Max retries reached. Available containers:');
                debugAvailableContainers();
            }
            return false;
        }
        
        const { container, selector } = result;
        moduleState.lastFoundContainer = selector;
        
        if (container.querySelector('.gaip-nutrition-summary-wrapper') ||
            container.querySelector('.gaip-nutrition-deficit-panel')) {
            log('Nutrition summary already present - updating');
            updateNutritionSummary();
            return true;
        }
        
        const wrapper = document.createElement('div');
        wrapper.className = 'gaip-nutrition-summary-wrapper';
        wrapper.innerHTML = renderNutritionSummary();
        
        container.appendChild(wrapper);
        moduleState.injected = true;
        log(`Nutrition summary injected into: ${selector}`);
        
        return true;
    }

    function forceInject(containerSelector) {
        const container = containerSelector 
            ? document.querySelector(containerSelector)
            : findTargetContainer()?.container;
        
        if (!container) {
            log('forceInject failed - no container found');
            debugAvailableContainers();
            return false;
        }
        
        const existing = container.querySelector('.gaip-nutrition-summary-wrapper');
        if (existing) existing.remove();
        
        const wrapper = document.createElement('div');
        wrapper.className = 'gaip-nutrition-summary-wrapper';
        wrapper.innerHTML = renderNutritionSummary();
        
        container.appendChild(wrapper);
        moduleState.injected = true;
        log('Force injected nutrition summary');
        
        return true;
    }

    function updateNutritionSummary() {
        const wrapper = document.querySelector('.gaip-nutrition-summary-wrapper');
        if (wrapper) {
            wrapper.innerHTML = renderNutritionSummary();
            log('Nutrition summary updated');
        }
    }

    function handleAnalysisComplete(event) {
        log('Received gaip:analysis-complete event');
        
        if (event.detail?.state?.soil) {
            global.GAIP_NUTRITION_SOIL_CACHE = event.detail.state.soil;
            log('Cached soil from event:', global.GAIP_NUTRITION_SOIL_CACHE);
        }
        
        moduleState.retryCount = 0;
        
        setTimeout(() => {
            if (!injectNutritionSummary()) {
                setTimeout(injectNutritionSummary, 200);
            }
        }, 100);
    }

    function init() {
        log('Initializing Nutrition Summary Integration v' + NUTRITION_CONFIG.version);
        
        moduleState.initialized = true;
        
        document.addEventListener('gaip:analysis-complete', handleAnalysisComplete);
        
        if (!injectNutritionSummary()) {
            if (document.readyState === 'loading') {
                document.addEventListener('DOMContentLoaded', () => {
                    setTimeout(injectNutritionSummary, 500);
                });
            } else {
                setTimeout(injectNutritionSummary, 500);
            }
        }
        
        document.addEventListener('gaip:soil-data-update', updateNutritionSummary);
        document.addEventListener('gaip:mlsn-calculated', updateNutritionSummary);
        document.addEventListener('gaip:turf-profile-change', updateNutritionSummary);
        // GH-278: climateMetrics.monthlyTemps resolves asynchronously (NASA
        // POWER/Open-Meteo, climate-normals-service.js) and is usually still
        // null when gaip:analysis-complete fires 100ms after page load --
        // renderNutritionSummary() bails into the "Climate data unavailable"
        // placeholder and never sets __GAIP_MONTHLY_N__. Without this
        // listener nothing ever retries once the normals actually arrive, so
        // Monthly N Distribution silently falls back to soil-nutrition-
        // analysis.js's forecast-window approximation for the rest of the
        // page's life.
        document.addEventListener('gaip:monthly-normals-ready', updateNutritionSummary);
        
        const observer = new MutationObserver((mutations) => {
            if (moduleState.injected) return;
            
            for (const mutation of mutations) {
                if (mutation.type === 'childList' && mutation.addedNodes.length > 0) {
                    for (const node of mutation.addedNodes) {
                        if (node.nodeType === 1) {
                            for (const selector of NUTRITION_CONFIG.containerSelectors) {
                                const selectorBase = selector.replace(/^[.#]/, '');
                                if (node.classList?.contains(selectorBase) ||
                                    node.id === selectorBase ||
                                    node.querySelector?.(selector)) {
                                    log(`Detected new container: ${selector}`);
                                    moduleState.retryCount = 0;
                                    setTimeout(injectNutritionSummary, 100);
                                    return;
                                }
                            }
                        }
                    }
                }
            }
        });
        
        observer.observe(document.body, { childList: true, subtree: true });
        
        log('Initialization complete');
    }

    // =========================================================================
    // PUBLIC API
    // =========================================================================

    const NutritionSummary = {
        calculateNutrientRequirement, 
        calculateAllRequirements,
        getAmendmentEfficiency,  // b35fix423 (C29) — efficiency lookup for word-export rate calc
        calculateGPForTemp, 
        calculateMonthlyGP, 
        calculateMonthlyGPWithOverseed,
        distributeNGPWeighted, 
        calculateMonthlyC3Fractions,
        
        extractSoilValues, 
        extractTurfConfig, 
        extractMonthlyTemps,
        extractMonthlyTempsSource,
        detectOverseedScenario,
        
        renderNutritionSummary, 
        renderDeficitSummary, 
        renderNDistributionTable,
        
        inject: injectNutritionSummary, 
        update: updateNutritionSummary, 
        forceInject,
        init,
        
        getMLSNThreshold, 
        getMLSNTarget, 
        getRemovalRate,
        normalizeSpecies, 
        isC4Species, 
        getMonthNames, 
        getSeason,
        
        debugAvailableContainers,
        
        get initialized() { return moduleState.initialized; },
        get injected() { return moduleState.injected; },
        get state() { return moduleState; },
        config: NUTRITION_CONFIG
    };

    global.GilbaNutritionSummary = NutritionSummary;

    document.addEventListener('click', function(e) {
        const climateInfoBtn = e.target.closest('[data-climate-info="monthly-normals"]');
        if (climateInfoBtn) {
            e.preventDefault();
            e.stopPropagation();
            showClimateNormalsInfo(climateInfoBtn);
        }
    });

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', init);
    } else {
        setTimeout(init, 100);
    }

    log('✅ Gilba Nutrition Summary Integration v' + NUTRITION_CONFIG.version + ' loaded (straight C3 grass fix)');

})(typeof window !== 'undefined' ? window : this);

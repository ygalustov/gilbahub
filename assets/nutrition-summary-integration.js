/**
 * =============================================================================
 * GILBA NUTRITION SUMMARY INTEGRATION v1.1.3
 * =============================================================================
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
        
        mlsnThresholds: { P: 21, K: 37, Ca: 331, Mg: 47, S: 6 },
        targetMultiplier: 1.5,
        
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
        const c3Params = NUTRITION_CONFIG.gpParams.c3;
        const c4Params = NUTRITION_CONFIG.gpParams.c4;
        const c3GP = Math.exp(-0.5 * Math.pow((temp - c3Params.optimalTemp) / c3Params.sigma, 2));
        const c4GP = Math.exp(-0.5 * Math.pow((temp - c4Params.optimalTemp) / c4Params.sigma, 2));
        return c3Fraction * c3GP + (1 - c3Fraction) * c4GP;
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
                pH: soil.pH ?? soil.pH_water ?? source.pH
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

    function extractMonthlyTemps() {
        const temps = {};
        
        if (global.GilbaClimateEngine) {
            const climateData = global.GilbaClimateEngine.getMonthlyData?.();
            if (climateData) {
                for (let m = 1; m <= 12; m++) {
                    temps[m] = climateData[m]?.avgTemp || 15;
                }
                return temps;
            }
        }
        
        if (global.GilbaHubOrchestrator) {
            const state = global.GilbaHubOrchestrator.getState();
            if (state?.climate?.monthlyTemps) {
                return state.climate.monthlyTemps;
            }
        }
        
        const turfConfig = extractTurfConfig();
        const lat = extractLatitude();
        const absLat = Math.abs(lat);
        
        // Tropical (within tropics, |lat| < 23.5°) — warm year-round, slight seasonal variation
        // Represents Vietnam/SE Asia (north) or tropical QLD/Darwin (south)
        if (absLat < 23.5) {
            if (lat >= 0) {
                // Northern hemisphere tropical (Vietnam, SE Asia): cooler Dec-Feb, peak Apr-Oct
                return { 1: 17, 2: 19, 3: 23, 4: 27, 5: 30, 6: 31, 7: 31, 8: 30, 9: 29, 10: 27, 11: 23, 12: 19 };
            } else {
                // Southern hemisphere tropical (Darwin, Cairns): peak Nov-Mar, cooler Jun-Aug
                return { 1: 30, 2: 30, 3: 29, 4: 28, 5: 26, 6: 24, 7: 23, 8: 25, 9: 28, 10: 30, 11: 31, 12: 31 };
            }
        }
        
        // Subtropical (23.5–35°) — warm summers, mild winters
        if (absLat < 35) {
            if (lat >= 0) {
                // Northern subtropical (S China, N India): cold winters, hot summers
                return { 1: 10, 2: 12, 3: 17, 4: 22, 5: 27, 6: 30, 7: 31, 8: 30, 9: 26, 10: 21, 11: 15, 12: 11 };
            } else {
                // Southern subtropical (Brisbane, SE QLD): hot summers, mild winters
                return { 1: 26, 2: 26, 3: 24, 4: 21, 5: 17, 6: 14, 7: 13, 8: 15, 9: 18, 10: 21, 11: 24, 12: 26 };
            }
        }
        
        // Temperate fallbacks (original behaviour)
        if (turfConfig.hemisphere === 'south') {
            return { 1: 25, 2: 25, 3: 22, 4: 18, 5: 14, 6: 11, 7: 10, 8: 12, 9: 15, 10: 18, 11: 21, 12: 24 };
        } else {
            return { 1: 5, 2: 7, 3: 11, 4: 15, 5: 20, 6: 24, 7: 26, 8: 25, 9: 21, 10: 15, 11: 9, 12: 5 };
        }
    }

    function extractAnnualNRate(species) {
        if (global.GilbaHubOrchestrator) {
            const state = global.GilbaHubOrchestrator.getState();
            if (state?.turf?.nProgramKgHaYr) return state.turf.nProgramKgHaYr;
            if (state?.inputs?.turf?.nProgramKgHaYr) return state.inputs.turf.nProgramKgHaYr;
        }
        
        const nInput = document.querySelector('.gaip-n-program, #n-program, [name="n-program"], .gaip-annual-n');
        if (nInput && nInput.value) return parseFloat(nInput.value);
        
        const normalized = normalizeSpecies(species);
        return NUTRITION_CONFIG.removalRates[normalized]?.N || 160;
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
                    ${req.annualRequirement === 0 ? '<div style="font-size: 9px; color: var(--gaip-text-secondary); margin-top: 4px; line-height: 1.3;">Soil level exceeds MLSN target — no application required this season. Monitor annually.</div>' : ''}
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
                        ${n > 0 ? n.toFixed(0) : '—'}
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
        
        const overseedConfig = detectOverseedScenario();
        const monthlyC3Fractions = calculateMonthlyC3Fractions(overseedConfig, turfConfig.hemisphere);
        
        const requirements = calculateAllRequirements(soilValues, {
            ph: soilValues.pH,
            species: turfConfig.species,
            clippingsCollected: turfConfig.clippingsCollected,
            trafficIntensity: turfConfig.trafficIntensity
        });
        
        const monthlyGP = calculateMonthlyGPWithOverseed(monthlyTemps, monthlyC3Fractions);
        const annualN = extractAnnualNRate(turfConfig.species);
        const nAllocations = distributeNGPWeighted(annualN, monthlyGP);
        
        // Populate export data
        const monthlyNData = [];
        let activeMonthCount = 0;
        for (let month = 1; month <= 12; month++) {
            const n = nAllocations[month] || 0;
            const gp = monthlyGP[month] || 0;
            const c3Frac = monthlyC3Fractions[month] || 1;
            monthlyNData.push({ n, gp, c3Frac });
            if (n > 0) activeMonthCount++;
        }
        
        global.GAIP_NUTRITION_SOIL_CACHE = global.GAIP_NUTRITION_SOIL_CACHE || {};
        Object.assign(global.GAIP_NUTRITION_SOIL_CACHE, {
            annualP: requirements['P']?.annualRequirement || null,
            annualK: requirements['K']?.annualRequirement || null,
            annualS: requirements['S']?.annualRequirement || null,
            pStatus: requirements['P']?.status || 'Unknown',
            kStatus: requirements['K']?.status || 'Unknown',
            sStatus: requirements['S']?.status || 'Unknown',
            monthlyN: monthlyNData,
            totalN: annualN,
            activeMonths: activeMonthCount,
            overseedConfig: overseedConfig
        });
        log('Populated export data:', global.GAIP_NUTRITION_SOIL_CACHE);
        
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
        calculateGPForTemp, 
        calculateMonthlyGP, 
        calculateMonthlyGPWithOverseed,
        distributeNGPWeighted, 
        calculateMonthlyC3Fractions,
        
        extractSoilValues, 
        extractTurfConfig, 
        extractMonthlyTemps,
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
    
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', init);
    } else {
        setTimeout(init, 100);
    }

    log('✅ Gilba Nutrition Summary Integration v' + NUTRITION_CONFIG.version + ' loaded (straight C3 grass fix)');

})(typeof window !== 'undefined' ? window : this);

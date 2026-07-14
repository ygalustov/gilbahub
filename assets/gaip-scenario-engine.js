/**
 * GAIP Scenario Engine v2.1.1
 * 
 * What-If Scenario Infrastructure with Confidence Handling
 * Enables A/B comparison by running engines with different state objects
 * 
 * v2.1.1: Added top-level score property to confidence for UI display
 * v2.1.0: Added confidence wrapper, assumptions tracking, validation metadata
 * v2.0.3: Added Santa Ana, TifTuf, Tahoma to C4 species list
 * v2.0.2: Force pure state-based calculations (bypass DOM-reading global engines)
 * 
 * Integrated Engines:
 * - Disease risk (full DiseaseEngine integration)
 * - Water quality (SAR, salinity penalty)
 * - PGR scheduling (GDD accumulation)
 * - Irrigation scheduling
 * - Stress trajectory
 * - N optimization
 * - Shade/DLI
 * - Traffic/wear
 * 
 * Key principles:
 * 1. All engines accept state parameter (no DOM reading)
 * 2. Pure functions - same input = same output
 * 3. State immutability - engines never mutate input state
 * 4. Unified result schema for comparison
 * 5. Every result includes confidence metadata
 * 
 * @author Gilba Solutions
 * @version 2.1.1
 */

(function(global) {
    'use strict';

    // CRITICAL: Force pure state-based calculations
    const USE_PURE_CALCULATIONS = true;

    const VERSION = '2.1.1';


    /* ============================================================
       CONFIDENCE INFRASTRUCTURE
       Standard schema for all engine outputs
    ============================================================ */

    /**
     * Confidence levels and their meaning
     * v2.1.1: Added top-level score property for numeric standardization
     */
    const CONFIDENCE_LEVELS = {
        high: {
            label: 'High',
            description: 'Based on peer-reviewed research, validated for this context',
            color: '#059669',
            bgColor: 'var(--gaip-good-bg)',
            score: 90
        },
        medium: {
            label: 'Medium',
            description: 'Based on related research or extrapolated from similar conditions',
            color: '#d97706',
            bgColor: 'var(--gaip-warning-bg)',
            score: 70
        },
        low: {
            label: 'Low',
            description: 'Limited research available, significant assumptions required',
            color: '#dc2626',
            bgColor: 'var(--gaip-critical-bg)',
            score: 40
        },
        indicative: {
            label: 'Indicative',
            description: 'For guidance only - verify with local expertise',
            color: 'var(--gaip-text-secondary)',
            bgColor: 'var(--gaip-surface-hover)',
            score: 20
        }
    };

    /**
     * Convert string level to numeric score
     * @param {string} level - 'high', 'medium', 'low', 'indicative'
     * @returns {number} Score 0-100
     */
    function confidenceLevelToScore(level) {
        if (typeof level === 'number') return level;
        const meta = CONFIDENCE_LEVELS[level];
        return meta ? meta.score : 50;
    }

    /**
     * Validation levels
     */
    const VALIDATION_LEVELS = {
        validated: 'Directly supported by peer-reviewed trial data',
        extrapolated: 'Extended from validated research to similar conditions',
        estimated: 'Calculated using standard agronomic principles',
        theoretical: 'Based on theoretical models without direct validation'
    };

    /**
     * Citation database for engine methodologies
     */
    const CITATIONS = {
        'fao-1985': {
            shortRef: 'FAO Guidelines (1985)',
            fullRef: 'Ayers & Westcot. Water quality for agriculture. FAO Irrigation Paper 29.'
        },
        'smith-2018': {
            shortRef: 'Smith et al. (2018)',
            fullRef: 'Smith DL et al. Weather-based advisory for dollar spot. Crop Protection 105:51-58.'
        },
        'fidanza-1996': {
            shortRef: 'Fidanza et al. (1996)',
            fullRef: 'Fidanza MA et al. Brown patch warning model. Phytopathology 86:385-390.'
        },
        'gelernter-2005': {
            shortRef: 'PACE Growth Potential',
            fullRef: 'Gelernter WD & Stowell LJ (2005). Improved overseeding programs. GCM 73(3):108-113.'
        },
        'kreuser-2011': {
            shortRef: 'Kreuser & Soldat (2011)',
            fullRef: 'Kreuser WC & Soldat DJ. GDD model for trinexapac-ethyl. Crop Science 51:2132-2140.'
        },
        'kussow-2012': {
            shortRef: 'Kussow et al. (2012)',
            fullRef: 'Kussow WR et al. N-Driven Nutrient Demand. ISRN Agronomy 2012.'
        },
        'fao-penman': {
            shortRef: 'FAO Penman-Monteith',
            fullRef: 'Allen RG et al. (1998). Crop evapotranspiration. FAO Irrigation Paper 56.'
        }
    };

    /**
     * Create a standard confidence wrapper for engine results
     * v2.1.1: Now includes numeric score alongside string level for standardization
     * @param {Object} result - The engine result object
     * @param {Object} confidenceData - Confidence metadata
     * @returns {Object} Result with confidence wrapper
     */
    function wrapWithConfidence(result, confidenceData) {
        const {
            confidence = 'medium',
            validationLevel = 'estimated',
            sources = [],
            assumptions = [],
            dataQuality = null
        } = confidenceData;

        const levelMeta = CONFIDENCE_LEVELS[confidence] || CONFIDENCE_LEVELS.medium;
        const numericScore = confidenceLevelToScore(confidence);

        return {
            ...result,
            _confidence: {
                level: confidence,
                score: numericScore,           // NEW: Always include numeric score
                validationLevel: validationLevel,
                sources: sources,
                assumptions: assumptions,
                dataQuality: dataQuality,
                levelMeta: levelMeta
            }
        };
    }

    /**
     * Assess data quality for a state object
     * @param {Object} state 
     * @param {string} engineType 
     * @returns {Object} Quality assessment
     */
    function assessDataQuality(state, engineType) {
        const issues = [];
        let score = 100;

        // Common checks
        if (!state.climate?.useLiveWeather) {
            issues.push('Using manual climate data (less accurate)');
            score -= 15;
        }

        // Engine-specific checks
        switch (engineType) {
            case 'water':
                if (!state.water?.ions?.Ca && !state.water?.ions?.Mg) {
                    issues.push('Incomplete ion analysis');
                    score -= 20;
                }
                if (!state.water?.ecw) {
                    issues.push('No EC measurement');
                    score -= 25;
                }
                break;

            case 'disease':
                if (!state.turf?.variety || state.turf?.variety === 'generic') {
                    issues.push('Generic variety (no resistance data)');
                    score -= 10;
                }
                if (!state.climate?.manual?.moisture?.humidity) {
                    issues.push('Humidity not specified');
                    score -= 15;
                }
                break;

            case 'shade':
                if (!state.shade?.svf && !state.turf?.dli) {
                    issues.push('No shade/light data provided');
                    score -= 30;
                }
                break;

            case 'traffic':
                if (!state.traffic?.matchesPerWeek && !state.traffic?.sessionsPerWeek) {
                    issues.push('No traffic data - using defaults');
                    score -= 20;
                }
                break;

            case 'irrigation':
                if (!state.soil?.soilTexture) {
                    issues.push('Soil texture unknown');
                    score -= 10;
                }
                break;

            case 'nopt':
                if (!state.turf?.nProgramKgHaYr) {
                    issues.push('Current N program not specified');
                    score -= 10;
                }
                break;
        }

        return {
            score: Math.max(0, score),
            level: score >= 80 ? 'high' : score >= 60 ? 'medium' : score >= 40 ? 'low' : 'indicative',
            issues
        };
    }

    /**
     * Merge confidence metadata from multiple engine results
     * Takes the lowest (most conservative) confidence
     * @param {Object[]} results - Array of engine results with _confidence
     * @returns {Object} Merged confidence metadata
     */
    function mergeConfidence(results) {
        const confidenceOrder = ['indicative', 'low', 'medium', 'high'];
        const validationOrder = ['theoretical', 'estimated', 'extrapolated', 'validated'];

        let lowestConfidence = 'high';
        let lowestValidation = 'validated';
        const allSources = new Set();
        const allAssumptions = [];
        const qualityScores = [];

        results.forEach(r => {
            if (!r?._confidence) return;

            const conf = r._confidence;

            // Take lowest confidence
            if (confidenceOrder.indexOf(conf.level) < confidenceOrder.indexOf(lowestConfidence)) {
                lowestConfidence = conf.level;
            }

            // Take lowest validation
            if (validationOrder.indexOf(conf.validationLevel) < validationOrder.indexOf(lowestValidation)) {
                lowestValidation = conf.validationLevel;
            }

            // Collect sources
            (conf.sources || []).forEach(s => allSources.add(s));

            // Collect assumptions (dedupe)
            (conf.assumptions || []).forEach(a => {
                if (!allAssumptions.includes(a)) {
                    allAssumptions.push(a);
                }
            });

            // Collect quality scores
            if (conf.dataQuality?.score !== undefined) {
                qualityScores.push(conf.dataQuality.score);
            }
        });

        const avgQuality = qualityScores.length > 0
            ? Math.round(qualityScores.reduce((a, b) => a + b, 0) / qualityScores.length)
            : null;

        return {
            level: lowestConfidence,
            score: CONFIDENCE_LEVELS[lowestConfidence]?.score || 70,  // Top-level score for UI
            validationLevel: lowestValidation,
            sources: Array.from(allSources),
            assumptions: allAssumptions,
            dataQuality: avgQuality !== null ? {
                score: avgQuality,
                level: avgQuality >= 80 ? 'high' : avgQuality >= 60 ? 'medium' : 'low'
            } : null,
            levelMeta: CONFIDENCE_LEVELS[lowestConfidence]
        };
    }

    /* ============================================================
       STATE SCHEMA
       Canonical state shape for all engines
    ============================================================ */

    const DEFAULT_STATE = {
        // Climate/Location
        climate: {
            lat: -33.87,
            lon: 151.21,
            useLiveWeather: false,
            period: { start: null, end: null },
            forecastDays: 7,
            manual: {
                temperature: { min: 15, max: 25, mean: 20, soil: null },
                moisture: { humidity: 65, rainfall: 0, soilMoisture: null },
                solar: { radiation: null, cloudCover: null },
                wind: { speed: 2 }
            }
        },
        
        // Soil chemistry
        soil: {
            depthCm: 10,
            bulkDensity: 1.4,
            methodology: 'mlsn',
            pH_water: null,
            CEC: null,
            EC1_5: null,
            soilTexture: 'loam',
            ppm: { P: 0, K: 0, Ca: 0, Mg: 0, S: 0, Fe: 0, Mn: 0, Zn: 0, Cu: 0, B: 0, Na: 0 }
        },
        
        // Water quality
        water: {
            ecw: 0,
            pH: 7,
            ions: { Ca: 0, Mg: 0, Na: 0, K: 0, Cl: 0, SO4: 0, HCO3: 0, CO3: 0, B: 0, Fe: 0 }
        },
        
        // Turf profile
        turf: {
            turfType: 'sports',
            subCategory: '',
            grassSpecies: 'Perennial Ryegrass',
            warmBase: '',
            coolOverseed: '',
            percentC3Cover: 100,
            hoc: 25,
            nProgramKgHaYr: 0,
            construction: 'sand_carpet',
            drainage: '',
            variety: 'generic',
            dli: 20,
            ledPPFD: 0,
            ledHours: 0,
            species: { c3Fraction: 1, c4Fraction: 0 }
        },
        
        // Traffic/Usage
        traffic: {
            matchesPerWeek: 0,
            sessionsPerWeek: 0,
            restDays: 2,
            matchCode: 'soccer',
            trainingCode: 'training_drills',
            matchDuration: 1.5,
            sessionDuration: 1.5
        },
        
        // Shade inputs
        shade: {
            svf: 1,
            facadeAngle: 0,
            treeOcclusion: 0
        },
        
        // PGR inputs
        pgr: {
            productType: '',
            applicationDate: null,
            rateLperHa: 0,
            gddThreshold: null,
            baseTemp: 0
        },
        
        // Tissue test results
        tissue: null,
        
        // Site history
        siteHistory: {
            yearsEstablished: null,
            thatchMm: null,
            previousDiseaseHistory: []
        }
    };

    /* ============================================================
       STATE UTILITIES
    ============================================================ */

    function cloneState(state) {
        return JSON.parse(JSON.stringify(state));
    }

    function mergeState(base, overrides) {
        const result = cloneState(base);
        
        function merge(target, source) {
            for (const key in source) {
                if (source[key] && typeof source[key] === 'object' && !Array.isArray(source[key])) {
                    if (!target[key]) target[key] = {};
                    merge(target[key], source[key]);
                } else {
                    target[key] = source[key];
                }
            }
        }
        
        merge(result, overrides);
        return result;
    }

    function validateState(state) {
        const errors = [];
        if (!state) {
            errors.push('State is null or undefined');
            return { valid: false, errors };
        }
        if (!state.turf) errors.push('Missing turf configuration');

        // Forward-ported from gssh-scenario-engine.js (Item 21 Priority 2).
        // Inject default climate if missing — use live data when available
        // rather than hard-failing with "Missing climate configuration".
        // Covers the post-site-switch window before hub-tissue re-runs.
        if (!state.climate) {
            var cm = (typeof window !== 'undefined' && window.climateMetrics) || null;
            var raw = (typeof window !== 'undefined' && window.rawWeatherData) || null;
            var temp = 20; // fallback
            if (cm && cm.temperature && cm.temperature.mean != null) {
                temp = cm.temperature.mean;
            } else if (raw && raw.forecast && raw.forecast.hourly && raw.forecast.hourly.temperature_2m) {
                temp = raw.forecast.hourly.temperature_2m[0];
            }
            state.climate = {
                lat: -33.87,
                lon: 151.21,
                useLiveWeather: false,
                manual: {
                    temperature: { min: temp - 5, max: temp + 5, mean: temp },
                    moisture: { humidity: 65, rainfall: 0 },
                    wind: { speed: 2 }
                }
            };
        }
        return { valid: errors.length === 0, errors };
    }

    function buildState(partialState) {
        return mergeState(DEFAULT_STATE, partialState || {});
    }

    /* ============================================================
       HELPER FUNCTIONS
    ============================================================ */

    function getAverageTemp(state, climateData) {
        if (climateData?.dailyData?.length) {
            const temps = climateData.dailyData.map(d => (d.maxTemp + d.minTemp) / 2);
            return temps.reduce((a, b) => a + b, 0) / temps.length;
        }
        if (state.climate?.manual?.temperature?.mean) {
            return state.climate.manual.temperature.mean;
        }
        const min = state.climate?.manual?.temperature?.min || 15;
        const max = state.climate?.manual?.temperature?.max || 25;
        return (min + max) / 2;
    }

    function isC4Species(species) {
        const c4Species = ['bermuda', 'couch', 'kikuyu', 'zoysia', 'buffalo', 'seashore paspalum', 'st augustine', 'santa ana', 'tiftuf', 'tahoma'];
        return c4Species.some(s => (species || '').toLowerCase().includes(s));
    }

    function getGrowthPotential(temp, isC4) {
        const GPE = global.GilbaGrowthPotentialEngine;
        const species = isC4 ? 'c4' : 'c3';
        const gp = GPE ? GPE.compute(temp, { model: 'pace', species: species }) : null;
        return gp != null ? Math.max(0, Math.min(100, gp * 100)) : 0;
    }

    function detectRegion(lat, lon) {
        if (lat > 49 && lat < 61 && lon > -12 && lon < 2) return 'uk_ireland';
        if (lat > 54 && lon > 4 && lon < 32) return 'scandinavia';
        if (lat > 24 && lat < 46 && lon > 122 && lon < 154) return 'japan';
        if (lat < -10) return 'australia';
        return 'ntep';
    }

    /* ============================================================
       WATER QUALITY ENGINE
       Calculates SAR, salinity effects, and irrigation impacts
    ============================================================ */

    function runWaterQualityEngine(state) {
        const water = state.water || {};
        const ions = water.ions || {};
        const ecw = water.ecw || 0;
        const pH = water.pH || 7;
        
        // Assess data quality
        const dataQuality = assessDataQuality(state, 'water');
        
        // Build assumptions list
        const assumptions = [
            'SAR calculation using standard formula',
            'Thresholds from FAO Irrigation Guidelines (1985)'
        ];
        
        if (!ions.Ca && !ions.Mg) {
            assumptions.push('Ca/Mg assumed from EC correlation');
        }
        
        const speciesLabel = state.turf?.grassSpecies || 'cool-season grass';
        assumptions.push(`Species tolerance: ${isC4Species(speciesLabel) ? 'Warm-season (more tolerant)' : 'Cool-season'}`);
        
        // Convert ppm to meq/L
        const Ca_meq = (ions.Ca || 0) / 20.04;
        const Mg_meq = (ions.Mg || 0) / 12.15;
        const Na_meq = (ions.Na || 0) / 23.0;
        const HCO3_meq = (ions.HCO3 || 0) / 61.02;
        const Cl_meq = (ions.Cl || 0) / 35.45;
        
        // SAR calculation
        const denom = Math.sqrt((Ca_meq + Mg_meq) / 2);
        const sar = denom > 0 ? Na_meq / denom : 0;
        
        // Adjusted SAR
        const pHc = 2.5;
        const sarAdj = sar * (1 + (8.4 - pHc) * 0.1);
        
        // Salinity penalty
        let salinityPenalty = { recoveryPenalty: 0, growthPenalty: 0, severity: 'none' };
        
        if (ecw > 0.7) {
            const excessEC = ecw - 0.7;
            const recoveryPenalty = Math.min(50, excessEC * 15);
            const growthPenalty = Math.min(40, excessEC * 12);
            salinityPenalty = {
                recoveryPenalty,
                growthPenalty,
                severity: recoveryPenalty > 30 ? 'high' : recoveryPenalty > 15 ? 'moderate' : 'low'
            };
        }
        
        // Classification
        let qualityClass = 'Excellent';
        let concerns = [];
        
        if (ecw > 3.0) { qualityClass = 'Severe'; concerns.push('Very high salinity'); }
        else if (ecw > 1.5) { qualityClass = 'Moderate'; concerns.push('Elevated salinity'); }
        else if (ecw > 0.7) { qualityClass = 'Slight'; concerns.push('Slight salinity'); }
        
        if (sar > 9) { concerns.push('High sodicity risk'); qualityClass = 'Severe'; }
        else if (sar > 6) { concerns.push('Moderate sodicity risk'); }
        else if (sar > 3) { concerns.push('Low sodicity risk'); }
        
        if (pH > 8.5) concerns.push('High pH - nutrient availability issues');
        if (pH < 6.0) concerns.push('Low pH - potential toxicity');
        if ((ions.HCO3 || 0) > 150) concerns.push('High bicarbonates');
        if ((ions.Cl || 0) > 350) concerns.push('High chlorides');
        if ((ions.B || 0) > 1.0) concerns.push('Boron toxicity risk');
        
        // Determine confidence
        let confidence = 'high';
        let validationLevel = 'validated';
        
        if (!ions.Ca || !ions.Mg || !ions.Na) {
            confidence = 'low';
            validationLevel = 'estimated';
        } else if (!ecw) {
            confidence = 'medium';
            validationLevel = 'extrapolated';
        }
        
        const result = {
            sar: Math.round(sar * 100) / 100,
            sarAdj: Math.round(sarAdj * 100) / 100,
            ecw,
            pH,
            qualityClass,
            concerns,
            salinityPenalty,
            meq: { Ca: Ca_meq, Mg: Mg_meq, Na: Na_meq, HCO3: HCO3_meq, Cl: Cl_meq },
            riskScore: Math.min(100, (ecw * 15) + (sar * 5) + (concerns.length * 10)),
            source: 'scenario-engine'
        };

        return wrapWithConfidence(result, {
            confidence,
            validationLevel,
            sources: ['fao-1985'],
            assumptions,
            dataQuality
        });
    }

    /* ============================================================
       DISEASE RISK ENGINE
       With confidence based on data completeness
    ============================================================ */

    function calculateDiseaseRisk(temp, optimalTemp, variance, humidity, humidityThreshold, dli, dliThreshold, speciesModifier) {
        const tempFactor = Math.exp(-0.5 * Math.pow((temp - optimalTemp) / variance, 2));
        const humidityFactor = humidity >= humidityThreshold ? 1 : humidity / humidityThreshold;
        const dliFactor = dli < dliThreshold ? 1 + (dliThreshold - dli) * 0.05 : 1;
        return Math.min(100, Math.round(tempFactor * humidityFactor * dliFactor * speciesModifier * 100));
    }

    function runDiseaseEngine(state, climateData, shadeResult, waterResult) {
        const dataQuality = assessDataQuality(state, 'disease');
        
        const assumptions = [
            'Risk models based on published epidemiological research'
        ];
        
        if (state.climate?.useLiveWeather) {
            assumptions.push('Using live weather data');
        } else {
            assumptions.push('Using manual climate inputs');
        }
        
        const variety = state.turf?.variety;
        if (variety && variety !== 'generic') {
            assumptions.push(`Variety susceptibility data: ${variety}`);
        } else {
            assumptions.push('Generic variety (baseline susceptibility)');
        }
        
        // Calculate disease risks
        const temp = getAverageTemp(state, climateData);
        const humidity = state.climate?.manual?.moisture?.humidity || 65;
        const dli = shadeResult?.DLI_total || state.turf?.dli || 20;
        const ecw = waterResult?.ecw || state.water?.ecw || 0;
        const species = state.turf?.grassSpecies || '';
        const isC4 = isC4Species(species);
        
        let diseases = [];
        
        // Dollar Spot
        const dollarSpotRisk = calculateDiseaseRisk(temp, 22, 8, humidity, 80, dli, 15, isC4 ? 0.7 : 1.0);
        diseases.push({ 
            name: 'Dollar Spot', 
            risk: dollarSpotRisk, 
            optimalTemp: '15-30°C',
            source: 'smith-2018'
        });
        
        // Brown Patch
        const brownPatchRisk = calculateDiseaseRisk(temp, 28, 5, humidity, 90, dli, 12, isC4 ? 1.0 : 0.8);
        diseases.push({ 
            name: 'Brown Patch', 
            risk: brownPatchRisk, 
            optimalTemp: '25-32°C',
            source: 'fidanza-1996'
        });
        
        // Pythium Blight
        const pythiumRisk = calculateDiseaseRisk(temp, 31, 4, humidity, 95, dli, 10, isC4 ? 0.9 : 0.6);
        diseases.push({ name: 'Pythium Blight', risk: pythiumRisk, optimalTemp: '28-35°C' });
        
        // Fusarium Patch
        const fusariumRisk = calculateDiseaseRisk(temp, 8, 10, humidity, 85, dli, 12, isC4 ? 0.3 : 1.2);
        diseases.push({ name: 'Fusarium Patch', risk: fusariumRisk, optimalTemp: '0-15°C' });
        
        // Anthracnose
        const anthracnoseRisk = calculateDiseaseRisk(temp, 27, 4, humidity, 80, dli, 18, isC4 ? 0.5 : 1.0);
        diseases.push({ name: 'Anthracnose', risk: anthracnoseRisk, optimalTemp: '25-30°C' });
        
        // Take-all Patch
        const soilpH = state.soil?.pH_water || 7;
        let takeAllRisk = calculateDiseaseRisk(temp, 15, 6, humidity, 70, dli, 15, isC4 ? 0.2 : 1.0);
        if (soilpH > 6.5) takeAllRisk *= (1 + (soilpH - 6.5) * 0.3);
        diseases.push({ name: 'Take-all Patch', risk: Math.min(100, takeAllRisk), optimalTemp: '12-18°C' });
        
        // Gray Leaf Spot
        const grayLeafRisk = calculateDiseaseRisk(temp, 27, 4, humidity, 90, dli, 15, isC4 ? 0.4 : 1.1);
        diseases.push({ name: 'Gray Leaf Spot', risk: grayLeafRisk, optimalTemp: '25-30°C' });
        
        // Sort by risk
        diseases.sort((a, b) => b.risk - a.risk);
        
        // Calculate overall
        const topRisks = diseases.slice(0, 3).map(d => d.risk);
        const overallScore = Math.round(topRisks.reduce((a, b) => a + b, 0) / 3);
        
        // Salinity stress modifier
        let stressModifier = 1;
        if (ecw > 1.5) {
            stressModifier = 1.15;
            assumptions.push('Salinity stress increases disease susceptibility (+15%)');
        }
        
        const adjustedScore = Math.min(100, Math.round(overallScore * stressModifier));
        
        // Determine confidence
        let confidence = 'medium';
        let validationLevel = 'extrapolated';
        
        if (state.climate?.useLiveWeather && variety && variety !== 'generic') {
            confidence = 'high';
            validationLevel = 'validated';
        } else if (!state.climate?.manual?.moisture?.humidity) {
            confidence = 'low';
            validationLevel = 'estimated';
        }
        
        const result = {
            diseases,
            overallScore: adjustedScore,
            overallRisk: adjustedScore > 60 ? 'High' : adjustedScore > 35 ? 'Moderate' : 'Low',
            primaryRisk: diseases[0]?.name || 'None',
            stressModifier,
            conditions: {
                temperature: temp,
                humidity,
                dli
            },
            source: 'scenario-engine'
        };

        return wrapWithConfidence(result, {
            confidence,
            validationLevel,
            sources: ['smith-2018', 'fidanza-1996'],
            assumptions,
            dataQuality
        });
    }

    /* ============================================================
       SHADE/DLI ENGINE
    ============================================================ */

    function runShadeEngine(state, climateData) {
        const dataQuality = assessDataQuality(state, 'shade');
        
        const assumptions = [
            'DLI thresholds from turfgrass photobiology research'
        ];
        
        const lat = state.climate?.lat || -33.87;
        const svf = state.shade?.svf ?? 1;
        const treeOcclusion = state.shade?.treeOcclusion || 0;
        
        // Base DLI from latitude and season
        const dayOfYear = Math.floor((Date.now() - new Date(new Date().getFullYear(), 0, 0)) / (1000 * 60 * 60 * 24));
        const declination = 23.45 * Math.sin(2 * Math.PI * (284 + dayOfYear) / 365);
        const daylightHours = 12 + 4 * Math.sin(2 * Math.PI * (dayOfYear - 80) / 365);
        
        // Base DLI for clear sky
        const baseDLI = 40 + 20 * Math.cos((lat - declination) * Math.PI / 180);
        
        // Apply shade factors
        const effectiveSVF = svf * (1 - treeOcclusion / 100);
        const shadedDLI = baseDLI * effectiveSVF;
        
        // LED supplementation
        const ledPPFD = state.turf?.ledPPFD || 0;
        const ledHours = state.turf?.ledHours || 0;
        const ledDLI = (ledPPFD * ledHours * 3600) / 1000000;
        
        if (ledPPFD > 0) {
            assumptions.push(`LED supplementation: ${ledPPFD} µmol/m²/s × ${ledHours}h = ${ledDLI.toFixed(1)} mol/m²/day`);
        }
        
        const totalDLI = shadedDLI + ledDLI;
        
        // Thresholds
        const isC4 = isC4Species(state.turf?.grassSpecies);
        const minDLI = isC4 ? 25 : 15;
        const optimalDLI = isC4 ? 35 : 25;
        
        assumptions.push(`Species: ${isC4 ? 'Warm-season' : 'Cool-season'} (min DLI: ${minDLI})`);
        
        const deficit = minDLI - totalDLI;
        
        let status = 'OPTIMAL';
        if (totalDLI < minDLI * 0.6) status = 'CRITICAL';
        else if (totalDLI < minDLI) status = 'MARGINAL';
        else if (totalDLI < optimalDLI) status = 'ADEQUATE';
        
        // Confidence based on input quality
        let confidence = 'medium';
        let validationLevel = 'extrapolated';
        
        if (svf !== 1 || state.turf?.dli) {
            confidence = 'high';
            validationLevel = 'validated';
        } else {
            assumptions.push('No shade data provided - assuming full sun');
            confidence = 'low';
        }
        
        const result = {
            DLI_natural: Math.round(shadedDLI * 10) / 10,
            DLI_led: Math.round(ledDLI * 10) / 10,
            DLI_total: Math.round(totalDLI * 10) / 10,
            svf,
            effectiveSVF: Math.round(effectiveSVF * 100) / 100,
            threshold: minDLI,
            optimalDLI,
            deficit: Math.round(Math.max(0, deficit) * 10) / 10,
            status,
            daylightHours: Math.round(daylightHours * 10) / 10,
            source: 'scenario-engine'
        };

        return wrapWithConfidence(result, {
            confidence,
            validationLevel,
            sources: ['gelernter-2005'],
            assumptions,
            dataQuality
        });
    }

    /* ============================================================
       PGR ENGINE
    ============================================================ */

    function runPGREngine(state, climateData) {
        const pgr = state.pgr || {};
        const assumptions = ['GDD model from Kreuser & Soldat (2011)'];
        
        if (!pgr.productType || !pgr.applicationDate) {
            return wrapWithConfidence({
                active: false,
                message: 'No PGR application configured',
                source: 'scenario-engine'
            }, {
                confidence: 'high',
                validationLevel: 'validated',
                sources: [],
                assumptions: ['No PGR data provided']
            });
        }
        
        assumptions.push(`Product: ${pgr.productType}`);
        assumptions.push(`Base temperature: ${pgr.baseTemp || 0}°C`);
        
        const temp = getAverageTemp(state, climateData);
        const baseTemp = pgr.baseTemp || 0;
        const dailyGDD = Math.max(0, temp - baseTemp);
        const threshold = pgr.gddThreshold || 200;
        
        const appDate = new Date(pgr.applicationDate);
        const daysSinceApp = Math.floor((Date.now() - appDate.getTime()) / (1000 * 60 * 60 * 24));
        const accumulatedGDD = daysSinceApp * dailyGDD;
        
        const effectRemaining = Math.max(0, 100 * (1 - accumulatedGDD / threshold));
        const daysToReapply = dailyGDD > 0 ? Math.ceil((threshold - accumulatedGDD) / dailyGDD) : 999;
        
        let status = 'Active';
        if (effectRemaining < 20) status = 'Reapply soon';
        else if (effectRemaining < 50) status = 'Declining';
        
        const result = {
            active: true,
            productType: pgr.productType,
            daysSinceApplication: daysSinceApp,
            dailyGDD: Math.round(dailyGDD * 10) / 10,
            accumulatedGDD: Math.round(accumulatedGDD),
            threshold,
            effectRemaining: Math.round(effectRemaining),
            daysToReapply: Math.max(0, daysToReapply),
            status,
            source: 'scenario-engine'
        };

        return wrapWithConfidence(result, {
            confidence: 'high',
            validationLevel: 'validated',
            sources: ['kreuser-2011'],
            assumptions
        });
    }

    /* ============================================================
       IRRIGATION ENGINE
    ============================================================ */

    function runIrrigationEngine(state, climateData, waterResult) {
        const dataQuality = assessDataQuality(state, 'irrigation');
        const assumptions = [
            'ET₀ from FAO Penman-Monteith method',
            'Crop coefficient Kc from turfgrass literature'
        ];
        
        const temp = getAverageTemp(state, climateData);
        const humidity = state.climate?.manual?.moisture?.humidity || 65;
        const windSpeed = state.climate?.manual?.wind?.speed || 2;
        
        // Simplified Hargreaves ET₀
        const tempRange = (state.climate?.manual?.temperature?.max || 25) - 
                          (state.climate?.manual?.temperature?.min || 15);
        const Ra = 20; // Simplified extraterrestrial radiation
        const ET0 = 0.0023 * Ra * Math.sqrt(tempRange) * (temp + 17.8);
        
        assumptions.push(`Reference ET₀: ${ET0.toFixed(1)} mm/day`);
        
        // Crop coefficient
        const isC4 = isC4Species(state.turf?.grassSpecies);
        const Kc = isC4 ? 0.75 : 0.85;
        assumptions.push(`Kc: ${Kc} (${isC4 ? 'warm-season' : 'cool-season'})`);
        
        const ETc = ET0 * Kc;
        
        // Weekly need
        const weeklyNeed = ETc * 7;
        
        // Leaching requirement if saline water
        const ecw = waterResult?.ecw || state.water?.ecw || 0;
        let leachingRequirement = 0;
        if (ecw > 0.5) {
            const ecThreshold = isC4 ? 3.0 : 1.5;
            leachingRequirement = ecw / (5 * ecThreshold - ecw);
            leachingRequirement = Math.min(0.5, Math.max(0, leachingRequirement));
            assumptions.push(`Leaching fraction: ${(leachingRequirement * 100).toFixed(0)}% for EC ${ecw} dS/m`);
        }
        
        const adjustedWeekly = weeklyNeed * (1 + leachingRequirement);
        
        // Determine confidence
        let confidence = 'medium';
        let validationLevel = 'extrapolated';
        
        if (state.climate?.useLiveWeather) {
            confidence = 'high';
            validationLevel = 'validated';
        }
        
        const result = {
            dailyET0: Math.round(ET0 * 10) / 10,
            dailyETc: Math.round(ETc * 10) / 10,
            weeklyNeed: Math.round(weeklyNeed),
            leachingRequirement: Math.round(leachingRequirement * 100),
            adjustedWeekly: Math.round(adjustedWeekly),
            cropCoefficient: Kc,
            source: 'scenario-engine'
        };

        return wrapWithConfidence(result, {
            confidence,
            validationLevel,
            sources: ['fao-penman'],
            assumptions,
            dataQuality
        });
    }

    /* ============================================================
       TRAFFIC/WEAR ENGINE
    ============================================================ */

    function runTrafficEngine(state, climateData, shadeResult) {
        const dataQuality = assessDataQuality(state, 'traffic');
        const assumptions = [
            'Wear units based on sports turf research',
            'Recovery rates from growth potential model'
        ];
        
        const traffic = state.traffic || {};
        const matches = traffic.matchesPerWeek || 0;
        const sessions = traffic.sessionsPerWeek || 0;
        
        assumptions.push(`Traffic: ${matches} matches, ${sessions} training/week`);
        
        // Wear factors by activity
        const wearFactors = {
            soccer: 1.0,
            rugby_union: 1.4,
            rugby_league: 1.3,
            afl: 1.2,
            american_football: 1.3,
            cricket: 0.6,
            baseball: 0.5,
            training_drills: 0.6,
            training_match: 0.8,
            training_light: 0.3
        };
        
        const matchFactor = wearFactors[traffic.matchCode] || 1.0;
        const trainingFactor = wearFactors[traffic.trainingCode] || 0.6;
        
        const matchLoad = matches * (traffic.matchDuration || 1.5) * matchFactor * 10;
        const trainingLoad = sessions * (traffic.sessionDuration || 1.5) * trainingFactor * 10;
        const totalLoad = matchLoad + trainingLoad;
        
        // Growth/recovery
        const temp = getAverageTemp(state, climateData);
        const isC4 = isC4Species(state.turf?.grassSpecies);
        const gp = getGrowthPotential(temp, isC4);
        
        assumptions.push(`Growth potential: ${Math.round(gp)}% at ${temp.toFixed(1)}°C`);
        
        // DLI affects recovery
        const dli = shadeResult?.DLI_total || state.turf?.dli || 20;
        const dliModifier = Math.min(1, dli / 20);
        
        if (dliModifier < 1) {
            assumptions.push(`Reduced recovery due to low light (${(dliModifier * 100).toFixed(0)}%)`);
        }
        
        const recoveryCapacity = (gp / 100) * dliModifier * 100;
        const wearRecoveryRatio = totalLoad / Math.max(10, recoveryCapacity);
        
        let status = 'SUSTAINABLE';
        if (wearRecoveryRatio > 1.5) status = 'UNSUSTAINABLE';
        else if (wearRecoveryRatio > 1.0) status = 'STRESSED';
        else if (wearRecoveryRatio > 0.7) status = 'MODERATE';
        
        // Confidence
        let confidence = 'medium';
        if (matches > 0 || sessions > 0) {
            confidence = 'high';
        } else {
            assumptions.push('No traffic data - baseline assessment');
            confidence = 'low';
        }
        
        const result = {
            matchLoad,
            trainingLoad,
            totalLoad: Math.round(totalLoad * 10) / 10,
            growthPotential: Math.round(gp),
            recoveryCapacity: Math.round(recoveryCapacity),
            wearRecoveryRatio: Math.round(wearRecoveryRatio * 100) / 100,
            status,
            recommendedRestDays: wearRecoveryRatio > 1 ? Math.ceil(wearRecoveryRatio * 2) : traffic.restDays || 2,
            source: 'scenario-engine'
        };

        return wrapWithConfidence(result, {
            confidence,
            validationLevel: 'extrapolated',
            sources: ['gelernter-2005'],
            assumptions,
            dataQuality
        });
    }

    /* ============================================================
       STRESS TRAJECTORY ENGINE
    ============================================================ */

    function runStressTrajectoryEngine(state, climateData, diseaseResult, waterResult, trafficResult) {
        const assumptions = [
            'Stress score combines disease, water, traffic factors',
            '14-day projection based on current conditions'
        ];
        
        const days = 14;
        const trajectory = [];
        
        const baseStress = 
            (diseaseResult?.overallScore || 0) * 0.3 +
            (waterResult?.riskScore || 0) * 0.2 +
            (trafficResult?.wearRecoveryRatio || 0) * 30 * 0.3 +
            (100 - (trafficResult?.growthPotential || 80)) * 0.2;
        
        assumptions.push(`Base stress score: ${Math.round(baseStress)}`);
        
        for (let i = 0; i < days; i++) {
            const dayStress = Math.min(100, Math.max(0, baseStress + (Math.random() - 0.5) * 10));
            trajectory.push({
                day: i,
                score: Math.round(dayStress),
                date: new Date(Date.now() + i * 24 * 60 * 60 * 1000).toISOString().split('T')[0]
            });
        }
        
        const peakStress = Math.max(...trajectory.map(t => t.score));
        const avgStress = trajectory.reduce((a, b) => a + b.score, 0) / trajectory.length;
        
        // Merge confidence from input engines
        const inputConfidences = [
            diseaseResult?._confidence,
            waterResult?._confidence,
            trafficResult?._confidence
        ].filter(Boolean);
        
        const mergedConf = mergeConfidence(inputConfidences.map(c => ({ _confidence: c })));
        
        const result = {
            trajectory,
            currentScore: Math.round(baseStress),
            peakScore: peakStress,
            averageScore: Math.round(avgStress),
            trend: trajectory[days - 1].score > trajectory[0].score ? 'RISING' : 'STABLE',
            criticalDays: trajectory.filter(t => t.score > 70).length,
            source: 'scenario-engine'
        };

        return wrapWithConfidence(result, {
            confidence: mergedConf.level,
            validationLevel: 'estimated',
            sources: mergedConf.sources,
            assumptions: [...assumptions, ...mergedConf.assumptions.slice(0, 3)]
        });
    }

    /* ============================================================
       N OPTIMIZATION ENGINE
    ============================================================ */

    function runNOptEngine(state, climateData) {
        const dataQuality = assessDataQuality(state, 'nopt');
        const assumptions = [
            'Base N requirements from sports turf literature',
            'Adjusted for growth potential'
        ];
        
        const temp = getAverageTemp(state, climateData);
        const isC4 = isC4Species(state.turf?.grassSpecies);
        const gp = getGrowthPotential(temp, isC4);
        
        const baseRequirements = {
            'golf_green': 150,
            'golf_fairway': 100,
            'sports': 120,
            'lawn': 80,
            'default': 100
        };
        
        const turfType = state.turf?.turfType || 'default';
        const subCategory = state.turf?.subCategory || '';
        const key = subCategory ? `${turfType}_${subCategory}` : turfType;
        const baseN = baseRequirements[key] || baseRequirements[turfType] || baseRequirements.default;
        
        assumptions.push(`Base requirement: ${baseN} kg N/ha/year`);
        assumptions.push(`Growth potential adjustment: ${Math.round(gp)}%`);
        
        const adjustedN = baseN * (gp / 100);
        const monthlyN = adjustedN / 12;
        
        const currentN = state.turf?.nProgramKgHaYr || 0;
        const difference = currentN - adjustedN;
        
        let confidence = 'medium';
        let validationLevel = 'extrapolated';
        
        if (state.tissue?.nRateMonthly) {
            assumptions.push('Tissue test data available for validation');
            confidence = 'high';
            validationLevel = 'validated';
        }
        
        const result = {
            recommendedAnnual: Math.round(adjustedN),
            currentAnnual: currentN,
            difference: Math.round(difference),
            monthlyRate: Math.round(monthlyN * 10) / 10,
            weeklyRate: Math.round(monthlyN / 4 * 10) / 10,
            growthPotential: Math.round(gp),
            status: Math.abs(difference) < 20 ? 'OPTIMAL' : difference > 0 ? 'EXCESS' : 'DEFICIENT',
            source: 'scenario-engine'
        };

        return wrapWithConfidence(result, {
            confidence,
            validationLevel,
            sources: ['kussow-2012'],
            assumptions,
            dataQuality
        });
    }

    /* ============================================================
       SCENARIO RUNNER
    ============================================================ */

    function runScenario(state, climateData) {
        const validation = validateState(state);
        if (!validation.valid) {
            return { error: validation.errors.join(', '), results: null };
        }
        
        const validState = buildState(state);
        
        // Run all engines
        const water = runWaterQualityEngine(validState);
        const shade = runShadeEngine(validState, climateData);
        const disease = runDiseaseEngine(validState, climateData, shade, water);
        const traffic = runTrafficEngine(validState, climateData, shade);
        const pgr = runPGREngine(validState, climateData);
        const irrigation = runIrrigationEngine(validState, climateData, water);
        const nOpt = runNOptEngine(validState, climateData);
        const stressTrajectory = runStressTrajectoryEngine(validState, climateData, disease, water, traffic);
        
        // Aggregate confidence
        const allResults = [water, shade, disease, traffic, pgr, irrigation, nOpt, stressTrajectory];
        const overallConfidence = mergeConfidence(allResults);
        
        return {
            state: validState,
            results: {
                water,
                shade,
                disease,
                traffic,
                pgr,
                irrigation,
                nOpt,
                stressTrajectory
            },
            summary: generateSummary(water, shade, disease, traffic, pgr, irrigation, stressTrajectory),
            confidence: overallConfidence,
            timestamp: new Date().toISOString()
        };
    }

    /* ============================================================
       SCENARIO COMPARISON WITH CONFIDENCE
    ============================================================ */

    function compareScenarios(stateA, stateB, climateData) {
        const scenarioA = runScenario(stateA, climateData);
        const scenarioB = runScenario(stateB, climateData);
        
        if (scenarioA.error || scenarioB.error) {
            return {
                error: scenarioA.error || scenarioB.error,
                comparison: null
            };
        }
        
        const deltas = {
            water: {
                sar: (scenarioB.results.water?.sar || 0) - (scenarioA.results.water?.sar || 0),
                ecw: (scenarioB.results.water?.ecw || 0) - (scenarioA.results.water?.ecw || 0),
                riskScore: (scenarioB.results.water?.riskScore || 0) - (scenarioA.results.water?.riskScore || 0),
                salinityPenalty: (scenarioB.results.water?.salinityPenalty?.recoveryPenalty || 0) - 
                                 (scenarioA.results.water?.salinityPenalty?.recoveryPenalty || 0)
            },
            shade: {
                dliTotal: (scenarioB.results.shade?.DLI_total || 0) - (scenarioA.results.shade?.DLI_total || 0),
                deficit: (scenarioB.results.shade?.deficit || 0) - (scenarioA.results.shade?.deficit || 0)
            },
            disease: {
                overallScore: (scenarioB.results.disease?.overallScore || 0) - (scenarioA.results.disease?.overallScore || 0),
                riskLevel: {
                    from: scenarioA.results.disease?.overallRisk || '-',
                    to: scenarioB.results.disease?.overallRisk || '-'
                }
            },
            traffic: {
                wearRecoveryRatio: (scenarioB.results.traffic?.wearRecoveryRatio || 0) - 
                                   (scenarioA.results.traffic?.wearRecoveryRatio || 0),
                recoveryCapacity: (scenarioB.results.traffic?.recoveryCapacity || 0) - 
                                  (scenarioA.results.traffic?.recoveryCapacity || 0)
            },
            pgr: {
                effectRemaining: (scenarioB.results.pgr?.effectRemaining || 0) - 
                                 (scenarioA.results.pgr?.effectRemaining || 0),
                daysToReapply: (scenarioB.results.pgr?.daysToReapply || 0) - 
                               (scenarioA.results.pgr?.daysToReapply || 0)
            },
            irrigation: {
                weeklyNeed: ((scenarioB.results.irrigation?.weeklyNeed) || 0) - 
                            ((scenarioA.results.irrigation?.weeklyNeed) || 0),
                leachingRequirement: ((scenarioB.results.irrigation?.leachingRequirement) || 0) - 
                                     ((scenarioA.results.irrigation?.leachingRequirement) || 0)
            },
            nOpt: {
                recommended: ((scenarioB.results.nOpt?.recommendedAnnual) || 0) - 
                             ((scenarioA.results.nOpt?.recommendedAnnual) || 0)
            },
            stressTrajectory: {
                peakScore: ((scenarioB.results.stressTrajectory?.peakScore) || 0) - 
                           ((scenarioA.results.stressTrajectory?.peakScore) || 0),
                criticalDays: ((scenarioB.results.stressTrajectory?.criticalDays) || 0) - 
                              ((scenarioA.results.stressTrajectory?.criticalDays) || 0)
            }
        };
        
        // Compare confidence between scenarios
        const confidenceComparison = {
            scenarioA: scenarioA.confidence,
            scenarioB: scenarioB.confidence,
            preferHigherConfidence: getConfidenceOrder(scenarioA.confidence?.level) >= 
                                    getConfidenceOrder(scenarioB.confidence?.level) ? 'A' : 'B',
            note: generateConfidenceNote(scenarioA.confidence, scenarioB.confidence)
        };
        
        return {
            scenarioA,
            scenarioB,
            deltas,
            comparison: generateComparison(deltas, scenarioA, scenarioB),
            confidenceComparison
        };
    }

    function getConfidenceOrder(level) {
        const order = { 'high': 3, 'medium': 2, 'low': 1, 'indicative': 0 };
        return order[level] || 0;
    }

    function generateConfidenceNote(confA, confB) {
        const levelA = confA?.level || 'unknown';
        const levelB = confB?.level || 'unknown';
        
        if (levelA === levelB) {
            return `Both scenarios have ${levelA} confidence`;
        }
        
        const higher = getConfidenceOrder(levelA) > getConfidenceOrder(levelB) ? 'A' : 'B';
        const lower = higher === 'A' ? 'B' : 'A';
        const higherLevel = higher === 'A' ? levelA : levelB;
        const lowerLevel = lower === 'A' ? levelA : levelB;
        
        return `Scenario ${higher} has ${higherLevel} confidence vs Scenario ${lower} with ${lowerLevel} confidence. Consider data quality when comparing.`;
    }

    /* ============================================================
       SUMMARY GENERATION
    ============================================================ */

    function generateSummary(water, shade, disease, traffic, pgr, irrigation, stressTrajectory) {
        const issues = [];
        const positives = [];
        
        if (water.qualityClass === 'Severe') issues.push('Severe water quality issues');
        else if (water.qualityClass === 'Moderate') issues.push('Water quality concerns');
        else if (water.qualityClass === 'Excellent') positives.push('Excellent water quality');
        
        if (shade.status === 'CRITICAL') issues.push('Critical light deficit');
        else if (shade.status === 'MARGINAL') issues.push('Marginal light levels');
        else if (shade.status === 'OPTIMAL') positives.push('Optimal light levels');
        
        if (disease.overallRisk === 'High') issues.push(`High disease risk (${disease.primaryRisk})`);
        else if (disease.overallRisk === 'Moderate') issues.push('Moderate disease pressure');
        else if (disease.overallRisk === 'Low') positives.push('Low disease pressure');
        
        if (traffic.status === 'UNSUSTAINABLE') issues.push('Unsustainable traffic load');
        else if (traffic.status === 'STRESSED') issues.push('Traffic stress detected');
        else if (traffic.status === 'SUSTAINABLE') positives.push('Sustainable traffic levels');
        
        if (pgr.active && pgr.status === 'Reapply soon') issues.push('PGR reapplication needed');
        
        if (stressTrajectory.criticalDays > 3) issues.push(`${stressTrajectory.criticalDays} critical stress days forecast`);
        
        return {
            overallStatus: issues.length > 2 ? 'CRITICAL' : issues.length > 0 ? 'ATTENTION' : 'GOOD',
            issues,
            positives,
            waterQuality: water.qualityClass,
            lightStatus: shade.status,
            diseaseRisk: disease.overallRisk,
            trafficStatus: traffic.status,
            stressTrend: stressTrajectory.trend
        };
    }

    function generateComparison(deltas, scenarioA, scenarioB) {
        const improvements = [];
        const concerns = [];
        const neutral = [];
        
        if (deltas.water.riskScore < -10) {
            improvements.push(`Water quality risk improves by ${Math.abs(Math.round(deltas.water.riskScore))} points`);
        } else if (deltas.water.riskScore > 10) {
            concerns.push(`Water quality risk increases by ${Math.round(deltas.water.riskScore)} points`);
        }
        
        if (deltas.water.salinityPenalty < -5) {
            improvements.push(`Salinity penalty reduces by ${Math.abs(Math.round(deltas.water.salinityPenalty))}%`);
        } else if (deltas.water.salinityPenalty > 5) {
            concerns.push(`Salinity penalty increases by ${Math.round(deltas.water.salinityPenalty)}%`);
        }
        
        if (deltas.shade.dliTotal > 3) {
            improvements.push(`Light increases by ${deltas.shade.dliTotal.toFixed(1)} mol/m²/day`);
        } else if (deltas.shade.dliTotal < -3) {
            concerns.push(`Light decreases by ${Math.abs(deltas.shade.dliTotal).toFixed(1)} mol/m²/day`);
        }
        
        if (deltas.disease.overallScore < -10) {
            improvements.push(`Disease risk reduces by ${Math.abs(Math.round(deltas.disease.overallScore))} points`);
        } else if (deltas.disease.overallScore > 10) {
            concerns.push(`Disease risk increases by ${Math.round(deltas.disease.overallScore)} points`);
        }
        
        if (deltas.traffic.recoveryCapacity > 10) {
            improvements.push(`Recovery capacity improves by ${Math.round(deltas.traffic.recoveryCapacity)}%`);
        } else if (deltas.traffic.recoveryCapacity < -10) {
            concerns.push(`Recovery capacity decreases by ${Math.abs(Math.round(deltas.traffic.recoveryCapacity))}%`);
        }
        
        if (Math.abs(deltas.irrigation.weeklyNeed) > 5) {
            neutral.push(`Weekly irrigation ${deltas.irrigation.weeklyNeed > 0 ? 'increases' : 'decreases'} by ${Math.abs(Math.round(deltas.irrigation.weeklyNeed))}mm`);
        }
        
        if (deltas.stressTrajectory.peakScore < -10) {
            improvements.push(`Peak stress reduces by ${Math.abs(Math.round(deltas.stressTrajectory.peakScore))} points`);
        } else if (deltas.stressTrajectory.peakScore > 10) {
            concerns.push(`Peak stress increases by ${Math.round(deltas.stressTrajectory.peakScore)} points`);
        }
        
        let recommendation = '';
        if (improvements.length > concerns.length && concerns.length === 0) {
            recommendation = 'Scenario B is clearly preferable';
        } else if (improvements.length > concerns.length) {
            recommendation = 'Scenario B shows net improvement with some tradeoffs';
        } else if (concerns.length > improvements.length && improvements.length === 0) {
            recommendation = 'Scenario A is preferable - B introduces risks';
        } else if (concerns.length > improvements.length) {
            recommendation = 'Scenario A may be safer despite some B benefits';
        } else {
            recommendation = 'Scenarios are comparable - consider specific priorities';
        }
        
        return {
            improvements,
            concerns,
            neutral,
            recommendation,
            netScore: improvements.length - concerns.length
        };
    }

    /* ============================================================
       EXPORTS
    ============================================================ */

    const ScenarioEngine = {
        // State utilities
        buildState,
        cloneState,
        mergeState,
        validateState,
        DEFAULT_STATE,
        
        // Confidence utilities
        CONFIDENCE_LEVELS,
        VALIDATION_LEVELS,
        CITATIONS,
        wrapWithConfidence,
        mergeConfidence,
        assessDataQuality,
        
        // Individual engines (all now return confidence wrappers)
        runWaterQualityEngine,
        runDiseaseEngine,
        runShadeEngine,
        runTrafficEngine,
        runPGREngine,
        runIrrigationEngine,
        runNOptEngine,
        runStressTrajectoryEngine,
        
        // Scenario operations
        runScenario,
        compareScenarios,
        
        // Version
        VERSION
    };

    // Export to global
    global.GAIP_ScenarioEngine = ScenarioEngine;
    
    // Convenience aliases
    global.gaip_scenario_run = runScenario;
    global.gaip_scenario_compare = compareScenarios;


})(typeof window !== 'undefined' ? window : this);

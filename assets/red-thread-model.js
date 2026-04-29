/**
 * =============================================================================
 * GILBA RED THREAD DISEASE MODEL v1.0.0
 * =============================================================================
 * 
 * HEURISTIC MODEL - NOT A VALIDATED PREDICTIVE EQUATION
 * 
 * Red thread (Laetisaria fuciformis) is primarily a nutritional disease.
 * Unlike dollar spot (Smith-Kerns) or Pythium models which have validated
 * epidemiological equations, no peer-reviewed predictive model exists for
 * red thread. This model uses observational thresholds from extension research.
 * 
 * GLOBAL VALIDITY:
 * The environmental thresholds are consistent worldwide - the same temperature
 * and humidity parameters apply in UK, Europe, Australia, NZ, and North America.
 * Regional modifiers adjust for local climate characteristics (maritime humidity,
 * growing season length, etc.) but core biology is identical.
 * 
 * KEY INSIGHT: Nitrogen status is the DOMINANT factor. A well-fed sward rarely
 * develops problematic red thread regardless of weather conditions.
 * 
 * ENVIRONMENTAL THRESHOLDS (from peer-reviewed sources):
 * - Temperature optimum: 15-25°C (59-77°F) - Penn State, MSU, NC State
 * - Temperature range: 4-29°C (40-80°F) can cause disease - NC State
 * - Growth cessation: >29°C (85°F) - Wikipedia citing research
 * - Peak activity: ~21°C (70°F) - NC State, Iowa State
 * - Humidity: High / prolonged leaf wetness required for infection
 * - Leaf wetness: >10 hours/day for several days (Syngenta ANZ)
 * 
 * SOURCES:
 * - Penn State Extension: Turfgrass Diseases - Red Thread
 * - NC State Extension: Diseases of Cool-Season Turfgrasses
 * - MSU Turf Diseases: Red Thread
 * - UMass Extension: Red Thread and Pink Patch
 * - UC IPM: Red Thread / Turfgrass
 * - RHS (UK): Red Thread Symptoms & Control
 * - Syngenta Australia/NZ: Red Thread Control
 * - Finelawn NZ: Red Thread (Pink Patch)
 * - ICL ANZ: Red Thread Impact on Turf Value
 * - Smiley et al. (2005) Compendium of Turfgrass Diseases
 * - Stalpers & Loerakker (1982) Laetisaria taxonomy
 * - Hims et al. (1984) Control of red thread
 * - Zhang et al. (2015) Red thread on warm-season turf in tropical China
 * - Richter & Schneider (1961) Red thread damage in NW Germany
 * 
 * CONFIDENCE LEVEL: LOW
 * This is a heuristic risk index, not a validated predictive model.
 * Use for general risk awareness, not precise timing decisions.
 * 
 * @author Gilba Solutions
 * @version 1.0.0
 * @date January 2026
 * =============================================================================
 */

(function(global) {
    'use strict';


    // =========================================================================
    // CONFIGURATION
    // =========================================================================

    const RED_THREAD_CONFIG = {
        // Temperature thresholds (°C)
        temp: {
            min: 4,           // Below this, minimal activity
            optimalLow: 15,   // Optimal range start
            peak: 20,         // Peak activity
            optimalHigh: 25,  // Optimal range end
            max: 29,          // Above this, growth cessation
            suppressionStart: 27  // Decline accelerates
        },
        
        // Humidity thresholds (%)
        humidity: {
            minForInfection: 70,   // Below this, very low risk
            moderate: 80,          // Moderate risk
            high: 85,              // High risk
            optimal: 90            // Ideal for pathogen
        },
        
        // Leaf wetness (estimated hours per day)
        leafWetness: {
            minHours: 6,      // Minimum for infection
            optimalHours: 10  // Extended wetness = high risk
        },

        // Nitrogen status modifiers
        // THIS IS THE DOMINANT FACTOR
        nitrogenModifiers: {
            'deficient': 2.0,    // Very high risk - primary cause of severe outbreaks
            'low': 1.5,          // Elevated risk
            'adequate': 0.6,     // Suppressed - healthy turf resists infection
            'high': 0.3,         // Low risk - vigorous growth outpaces pathogen
            'excessive': 0.4     // Low risk, but may invite other diseases
        },

        // Species susceptibility (relative to baseline 1.0)
        // Source: Penn State, Illinois Extension, BSPB notes, Syngenta ANZ
        // Note: Red thread primarily affects cool-season turf but CAN occur on
        // warm-season grasses, particularly bermuda (Illinois Extension, Maryland Extension)
        speciesSusceptibility: {
            // COOL-SEASON - HIGH SUSCEPTIBILITY
            'fineFescue': 1.5,           // Most susceptible (all sources agree)
            'chewingsFescue': 1.5,
            'slenderCreepingRedFescue': 1.4,
            'strongCreepingRedFescue': 1.3,
            'redFescue': 1.4,            // Festuca rubra
            'perennialRyegrass': 1.3,    // Very susceptible (BSPB, Penn State)
            
            // COOL-SEASON - MODERATE SUSCEPTIBILITY
            'kentuckyBluegrass': 1.1,    // Moderately susceptible
            'annualBluegrass': 1.0,      // Poa annua
            'roughBluegrass': 1.0,       // Poa trivialis
            
            // COOL-SEASON - LOWER SUSCEPTIBILITY
            'creepingBentgrass': 0.9,    // Less susceptible
            'browntopBent': 0.9,         // Agrostis capillaris
            'colonialBentgrass': 0.9,
            'tallFescue': 0.7,           // More resistant
            'hardFescue': 0.6,           // Resistant
            'sheepFescue': 0.6,          // Resistant
            
            // WARM-SEASON - RARELY AFFECTED BUT POSSIBLE
            // Maryland Extension: "to a lesser extent... Bermuda grass"
            // Illinois Extension: "Less susceptible grasses include bermudagrass"
            'bermuda': 0.35,             // Rarely affected but documented
            'couch': 0.35,               // Same as bermuda
            'zoysia': 0.4,               // Illinois: "Less susceptible"
            'kikuyu': 0.25,              // Very rarely affected
            'buffalo': 0.3,              // St. Augustine - occasional
            'buffalograss': 0.3,
            'seashore_paspalum': 0.3,    // Documented in tropical China (Zhang 2015)
            'centipede': 0.25
        },

        // Regional climate modifiers
        // Based on disease prevalence reports and climate suitability
        regionalModifiers: {
            // UK & IRELAND - Highest pressure (maritime humidity)
            'uk_ireland': 1.3,
            
            // CONTINENTAL EUROPE
            'continental_europe': 0.9,   // France, Germany, Benelux - moderate
            'scandinavia': 0.7,          // Shorter season, less pressure
            'mediterranean': 0.5,        // Too dry in summer
            
            // NORTH AMERICA
            'us_north': 1.0,             // Baseline - Great Lakes, Northeast
            'us_transition': 0.8,        // Hot summers limit activity
            'us_south': 0.4,             // Warm-season dominated
            'us_pacific_nw': 1.2,        // Maritime - similar to UK
            
            // AUSTRALIA - varies significantly by region
            'australia_temperate': 0.9,  // Victoria, Tasmania, Adelaide
            'australia_subtropical': 0.5, // Brisbane, Sydney - less common
            'australia_tropical': 0.2,   // Rare - warm-season dominated
            'australia_perth': 0.7,      // Mediterranean climate
            
            // NEW ZEALAND
            'new_zealand': 1.1,          // Common, similar to UK
            'nz_north': 1.0,
            'nz_south': 1.2,             // Cooler, more pressure
            
            // OTHER
            'japan': 0.8,                // Cool-season areas (Hokkaido, highlands)
            'south_africa': 0.6          // Limited cool-season turf areas
        }
    };

    // =========================================================================
    // RED THREAD MODEL
    // =========================================================================

    const RedThreadModel = {
        name: 'Red Thread',
        pathogen: 'Laetisaria fuciformis',
        modelType: 'heuristic',
        confidence: 'low',
        version: '1.0.0',

        /**
         * Calculate red thread risk
         * 
         * @param {Object} climate - Climate data with temperature, humidity
         * @param {Object} nitrogen - Nitrogen status {status: 'deficient'|'low'|'adequate'|'high'|'excessive'}
         * @param {Object} variety - Variety traits (may include disease.redThread.riskMultiplier)
         * @param {Object} options - Additional options {species, region, tissueN}
         * @returns {Object} Risk assessment
         */
        calculate(climate, nitrogen, variety, options = {}) {
            // b35fix345: null-passthrough on temperature and humidity. Pre-fix
            // meanTemp `?? 15` and humidity `?? 75` planted fabricated values
            // when climate data was missing — produced spurious risk on no-data
            // sites. Now: degrade explicitly when temperature is missing
            // (humidity-only can't drive red thread; the engine needs a temp
            // signal to enter the bell curve).
            const meanTemp = climate?.temperature?.mean ?? null;
            const humidity = climate?.moisture?.humidity?.mean ?? climate?.humidity ?? null;
            const precip = climate?.precipitation?.total ?? 0;
            const nStatus = nitrogen?.status || 'adequate';
            const species = options.species || 'perennialRyegrass';
            const region = options.region || 'uk_ireland';
            
            if (meanTemp == null) {
                return this._buildResult(0, 'minimal', {
                    temperature: { value: null, contribution: 0, note: 'No temperature data — degraded' },
                    humidity: { value: humidity, contribution: 0 },
                    nitrogen: { status: nStatus, modifier: 1 },
                    species: { name: species, modifier: 1 }
                }, 'Temperature data unavailable — risk computation skipped (b35fix345)');
            }
            
            const minTemp = climate?.temperature?.min ?? (meanTemp - 5);
            const maxTemp = climate?.temperature?.max ?? (meanTemp + 5);
            
            // ==============================================================
            // EXIT EARLY: Temperature outside viable range
            // ==============================================================
            if (meanTemp > RED_THREAD_CONFIG.temp.max || meanTemp < RED_THREAD_CONFIG.temp.min) {
                return this._buildResult(0, 'minimal', {
                    temperature: { value: meanTemp, contribution: 0, note: 'Outside viable range (4-29°C)' },
                    humidity: { value: humidity, contribution: 0 },
                    nitrogen: { status: nStatus, modifier: 1 },
                    species: { name: species, modifier: 1 }
                }, 'Temperature outside pathogen activity range');
            }

            // ==============================================================
            // TEMPERATURE FACTOR
            // Bell curve with peak at 20°C, range 4-29°C
            // ==============================================================
            let tempFactor = 0;
            const cfg = RED_THREAD_CONFIG.temp;
            
            if (meanTemp >= cfg.optimalLow && meanTemp <= cfg.optimalHigh) {
                // Within optimal range: high activity
                // Gaussian centered on 20°C with sigma ~4
                tempFactor = Math.exp(-0.5 * Math.pow((meanTemp - cfg.peak) / 4, 2));
            } else if (meanTemp >= cfg.min && meanTemp < cfg.optimalLow) {
                // Below optimal: reduced but possible
                tempFactor = 0.3 + 0.5 * ((meanTemp - cfg.min) / (cfg.optimalLow - cfg.min));
            } else if (meanTemp > cfg.optimalHigh && meanTemp <= cfg.max) {
                // Above optimal: declining activity
                // Sharper decline above 25°C
                if (meanTemp <= cfg.suppressionStart) {
                    tempFactor = 0.8 * (1 - (meanTemp - cfg.optimalHigh) / (cfg.suppressionStart - cfg.optimalHigh));
                } else {
                    tempFactor = 0.3 * (cfg.max - meanTemp) / (cfg.max - cfg.suppressionStart);
                }
            }
            tempFactor = Math.max(0, Math.min(1, tempFactor));

            // ==============================================================
            // HUMIDITY / LEAF WETNESS FACTOR
            // Prolonged leaf wetness required for infection
            // ==============================================================
            let humidityFactor = 0;
            const hCfg = RED_THREAD_CONFIG.humidity;
            
            // b35fix345: null-guard. When humidity null, factor stays 0.
            // Precip-only path below still applies (rain-driven leaf wetness).
            if (humidity != null) {
                if (humidity >= hCfg.optimal) {
                    humidityFactor = 1.0;
                } else if (humidity >= hCfg.high) {
                    humidityFactor = 0.7 + 0.3 * ((humidity - hCfg.high) / (hCfg.optimal - hCfg.high));
                } else if (humidity >= hCfg.moderate) {
                    humidityFactor = 0.4 + 0.3 * ((humidity - hCfg.moderate) / (hCfg.high - hCfg.moderate));
                } else if (humidity >= hCfg.minForInfection) {
                    humidityFactor = 0.1 + 0.3 * ((humidity - hCfg.minForInfection) / (hCfg.moderate - hCfg.minForInfection));
                }
            }
            
            // Boost from precipitation (rain = extended wetness)
            if (precip > 10) {
                humidityFactor = Math.min(1, humidityFactor + 0.2);
            } else if (precip > 5) {
                humidityFactor = Math.min(1, humidityFactor + 0.1);
            }
            
            // ==============================================================
            // NITROGEN MODIFIER (DOMINANT FACTOR)
            // This is THE primary driver of red thread severity
            // ==============================================================
            const nModifier = RED_THREAD_CONFIG.nitrogenModifiers[nStatus] || 1.0;
            
            // Check tissue N if available (more precise than status)
            let tissueNAdjustment = 1.0;
            if (options.tissueN !== undefined) {
                // Tissue N below 3.5% = deficient for most cool-season turf
                // Below 4.0% = low, Above 5.5% = high
                if (options.tissueN < 3.0) {
                    tissueNAdjustment = 1.5; // Severe deficiency
                } else if (options.tissueN < 3.5) {
                    tissueNAdjustment = 1.25;
                } else if (options.tissueN < 4.0) {
                    tissueNAdjustment = 1.1;
                } else if (options.tissueN > 5.5) {
                    tissueNAdjustment = 0.7;
                } else if (options.tissueN > 5.0) {
                    tissueNAdjustment = 0.85;
                }
            }
            
            const effectiveNModifier = nModifier * tissueNAdjustment;
            
            // ==============================================================
            // SPECIES SUSCEPTIBILITY
            // ==============================================================
            const speciesBase = RED_THREAD_CONFIG.speciesSusceptibility[species] || 1.0;
            
            // Use variety-specific modifier if available (from BSPB data)
            const varietyModifier = variety?.disease?.redThread?.riskMultiplier ?? 1.0;
            const effectiveSpeciesModifier = speciesBase * varietyModifier;
            
            // ==============================================================
            // REGIONAL MODIFIER
            // ==============================================================
            const regionalModifier = RED_THREAD_CONFIG.regionalModifiers[region] || 1.0;
            
            // ==============================================================
            // CALCULATE COMBINED RISK
            // 
            // Weighting rationale:
            // - Nitrogen is dominant (applied as multiplier, not weighted)
            // - Temperature and humidity are gating factors
            // - Both temp AND humidity must be favorable for significant risk
            // ==============================================================
            
            // Base risk from environmental factors
            // Use geometric mean to require BOTH factors
            const envRisk = Math.sqrt(tempFactor * humidityFactor);
            
            // Apply modifiers
            let riskScore = envRisk * effectiveNModifier * effectiveSpeciesModifier * regionalModifier * 100;
            
            // Soft cap at 100
            riskScore = Math.min(100, Math.max(0, riskScore));
            
            // ==============================================================
            // DETERMINE PRIMARY DRIVER
            // ==============================================================
            let primaryDriver = 'nitrogen';
            let primaryDriverNote = null;
            
            if (effectiveNModifier >= 1.5) {
                primaryDriver = 'nitrogen_deficiency';
                primaryDriverNote = 'Low nitrogen is the primary risk factor - consider N application';
            } else if (humidityFactor > tempFactor && humidityFactor > 0.7) {
                primaryDriver = 'humidity';
                primaryDriverNote = 'Extended leaf wetness favoring infection';
            } else if (tempFactor > 0.7) {
                primaryDriver = 'temperature';
                primaryDriverNote = 'Temperature in optimal range for pathogen';
            }
            
            // ==============================================================
            // BUILD RESULT
            // ==============================================================
            const drivers = {
                temperature: {
                    value: meanTemp,
                    min: minTemp,
                    max: maxTemp,
                    optimalRange: '15-25°C',
                    contribution: Math.round(100 * tempFactor),
                    inOptimal: meanTemp >= cfg.optimalLow && meanTemp <= cfg.optimalHigh
                },
                humidity: {
                    value: humidity,
                    precipitation: precip,
                    contribution: Math.round(100 * humidityFactor),
                    note: humidity >= hCfg.high ? 'Extended leaf wetness likely' : null
                },
                nitrogen: {
                    status: nStatus,
                    tissueN: options.tissueN,
                    modifier: Math.round(100 * effectiveNModifier) / 100,
                    note: effectiveNModifier >= 1.5 ? 
                        '⚠️ Low N is primary driver - fertilise to suppress' : null
                },
                species: {
                    name: species,
                    baseSusceptibility: speciesBase,
                    varietyModifier: varietyModifier !== 1 ? varietyModifier : null,
                    effectiveModifier: Math.round(100 * effectiveSpeciesModifier) / 100
                },
                region: {
                    id: region,
                    modifier: regionalModifier,
                    note: region === 'uk_ireland' ? 'UK maritime climate elevates red thread pressure' : null
                }
            };
            
            const riskLevel = this._classifyRisk(riskScore);
            
            return this._buildResult(riskScore, riskLevel, drivers, primaryDriverNote);
        },

        /**
         * Calculate daily risk for forecast
         * Simplified version for timeline display
         */
        calculateDaily(dayClimate, nitrogen, variety, options = {}) {
            // b35fix345: null-passthrough on temp and humidity. Pre-fix
            // `?? 15` for temp and `?? 75` for humidity fabricated values
            // when day-climate data was missing — produced spurious risk
            // on no-data sites. Now: degrade explicitly when temp missing;
            // null humidity yields humidityFactor=0 (no contribution).
            const temp = dayClimate.mean ?? dayClimate.temp ?? null;
            const humidity = dayClimate.humidity ?? null;
            const precip = dayClimate.precip ?? dayClimate.precipitation ?? 0;
            const nStatus = nitrogen?.status || nitrogen || 'adequate';
            const species = options.species || 'perennialRyegrass';
            
            if (temp == null) {
                return 0; // Degraded — no temperature signal, no risk computed.
            }
            
            // Quick temperature check
            if (temp > 29 || temp < 4) {
                return 0;
            }
            
            // Temperature factor (simplified)
            let tempFactor = 0;
            if (temp >= 15 && temp <= 25) {
                tempFactor = 1.0 - Math.abs(temp - 20) / 10;
            } else if (temp >= 4 && temp < 15) {
                tempFactor = 0.3 + 0.5 * ((temp - 4) / 11);
            } else if (temp > 25 && temp <= 29) {
                tempFactor = 0.5 * ((29 - temp) / 4);
            }
            
            // Humidity factor (simplified)
            // b35fix345: null-guard. When humidity null, factor stays 0.
            let humidityFactor = 0;
            if (humidity != null) {
                if (humidity >= 90) {
                    humidityFactor = 1.0;
                } else if (humidity >= 80) {
                    humidityFactor = 0.5 + 0.5 * ((humidity - 80) / 10);
                } else if (humidity >= 70) {
                    humidityFactor = 0.2 + 0.3 * ((humidity - 70) / 10);
                }
            }
            
            // Rain boost
            if (precip > 5) {
                humidityFactor = Math.min(1, humidityFactor + 0.15);
            }
            
            // Nitrogen modifier (THE dominant factor)
            const nModifiers = { 'deficient': 2.0, 'low': 1.5, 'adequate': 0.6, 'high': 0.3, 'excessive': 0.4 };
            const nMod = nModifiers[nStatus] || 1.0;
            
            // Species modifier
            const speciesMod = RED_THREAD_CONFIG.speciesSusceptibility[species] || 1.0;
            
            // Variety modifier
            const varietyMod = variety?.disease?.redThread?.riskMultiplier ?? 1.0;
            
            // Combined (geometric mean of environmental factors)
            const envRisk = Math.sqrt(tempFactor * humidityFactor);
            let risk = envRisk * nMod * speciesMod * varietyMod * 100;
            
            return Math.min(100, Math.max(0, Math.round(risk)));
        },

        /**
         * Get management interventions based on risk level
         */
        getInterventions(riskLevel, context = {}) {
            const interventions = {
                immediate: [],
                shortTerm: [],
                cultural: []
            };
            
            const nStatus = context.nitrogen?.status || 'adequate';
            const species = context.species || 'perennialRyegrass';
            
            // Nitrogen-based interventions (PRIMARY)
            if (nStatus === 'deficient' || nStatus === 'low') {
                interventions.immediate.push({
                    action: 'Apply nitrogen fertiliser',
                    detail: 'Quick-release N (ammonium sulphate or urea) at 25-35 kg N/ha',
                    rationale: 'N deficiency is the primary cause of red thread - correction typically resolves outbreaks within 2-3 weeks',
                    source: 'Penn State Extension, RHS'
                });
            }
            
            if (riskLevel === 'severe' || riskLevel === 'high') {
                // Severe/High risk interventions
                interventions.shortTerm.push({
                    action: 'Monitor N status',
                    detail: 'Submit tissue test if N status uncertain',
                    rationale: 'Tissue N <4% indicates deficiency risk'
                });
                
                if (context.useType === 'professional' || context.useType === 'golf') {
                    interventions.shortTerm.push({
                        action: 'Consider fungicide if severe',
                        detail: 'SDHI (penthiopyrad) or DMI (tebuconazole) if N correction insufficient',
                        rationale: 'Fungicides rarely needed - N correction usually sufficient',
                        source: 'Penn State: "fungicide treatment will minimize symptoms" on high-value turf'
                    });
                }
            }
            
            // Cultural practices (always relevant)
            interventions.cultural = [
                {
                    action: 'Maintain balanced fertility',
                    detail: 'Soil test annually; ensure adequate P, K, Ca alongside N',
                    rationale: 'P deficiency also correlates with red thread (OSU research)',
                    priority: 'high'
                },
                {
                    action: 'Reduce leaf wetness duration',
                    detail: 'Irrigate early morning (before sunrise) to shorten wet period',
                    rationale: 'Prolonged leaf wetness required for infection',
                    priority: 'medium'
                },
                {
                    action: 'Improve air circulation',
                    detail: 'Prune overhanging vegetation; address drainage issues',
                    rationale: 'Reduces humidity at turf surface',
                    priority: 'medium'
                },
                {
                    action: 'Consider resistant varieties',
                    detail: species === 'perennialRyegrass' ? 
                        'Check BSPB ratings - red thread resistance varies 4.0-8.0' :
                        'Select varieties with documented resistance',
                    rationale: 'Genetic resistance reduces management intensity',
                    priority: 'long-term'
                }
            ];
            
            // Remove box-clipping note for rough areas
            if (context.mowingHeight > 25) {
                interventions.cultural.push({
                    action: 'Collect clippings during outbreak',
                    detail: 'Remove infected material to reduce inoculum spread',
                    rationale: 'Sclerotia on clippings can spread infection',
                    priority: 'low'
                });
            }
            
            return interventions;
        },

        /**
         * Classify risk score into level
         */
        _classifyRisk(score) {
            if (score >= 70) return 'severe';
            if (score >= 50) return 'high';
            if (score >= 30) return 'moderate';
            if (score >= 15) return 'low';
            return 'minimal';
        },

        /**
         * Build standardised result object
         */
        _buildResult(score, level, drivers, primaryNote) {
            return {
                disease: 'redThread',
                displayName: 'Red Thread',
                pathogen: 'Laetisaria fuciformis',
                riskScore: Math.round(score),
                riskLevel: level,
                confidence: 'low',
                confidenceScore: 40,
                confidenceNote: 'Heuristic model based on observational thresholds - not a validated predictive equation',
                modelType: 'heuristic',
                modelVersion: '1.0.0',
                primaryDriver: drivers.nitrogen?.modifier >= 1.5 ? 'nitrogen_deficiency' : 
                              (drivers.humidity?.contribution > drivers.temperature?.contribution ? 'humidity' : 'temperature'),
                primaryDriverNote: primaryNote,
                drivers: drivers,
                keyInsight: 'Red thread is primarily a nutritional disease. Adequate nitrogen typically prevents outbreaks regardless of weather.',
                source: 'Penn State, NC State, MSU, UMass Extension; Smiley et al. (2005)'
            };
        }
    };

    // =========================================================================
    // INTEGRATION HELPERS
    // =========================================================================

    /**
     * Check if red thread model should be used for this region/species
     * Returns true for most scenarios - model handles low-risk cases internally
     * 
     * Red thread primarily affects cool-season turf but CAN occur on warm-season
     * grasses (documented on bermuda, seashore paspalum). The model applies
     * appropriate species modifiers rather than excluding entirely.
     */
    function shouldUseRedThreadModel(region, species) {
        // Hot tropical regions with no cool-season turf - skip entirely
        const tropicalRegions = ['australia_tropical', 'middle_east', 'southeast_asia'];
        if (tropicalRegions.includes(region)) {
            return false;
        }
        
        // If species is explicitly warm-season AND region is hot, skip
        const warmSeasonSpecies = ['bermuda', 'couch', 'kikuyu', 'buffalo', 'buffalograss', 
                                   'zoysia', 'seashore_paspalum', 'centipede'];
        const hotRegions = ['us_south', 'australia_subtropical', 'australia_tropical', 
                          'mediterranean', 'middle_east'];
        
        if (warmSeasonSpecies.includes(species?.toLowerCase()) && hotRegions.includes(region)) {
            // Very low risk but not impossible - let caller decide
            // Return true but model will give very low scores
            return true;
        }
        
        return true;
    }

    /**
     * Get red thread risk modifier for a UK variety based on BSPB rating
     * BSPB uses 1-9 scale where HIGHER = MORE RESISTANT
     * We need to convert to risk multiplier where HIGHER = MORE SUSCEPTIBLE
     */
    function bspbToRiskMultiplier(bspbRating) {
        if (!bspbRating || bspbRating < 1 || bspbRating > 9) {
            return 1.0; // No data
        }
        
        // BSPB 9 (most resistant) → 0.7 multiplier (30% less risk)
        // BSPB 5 (average) → 1.0 multiplier (baseline)
        // BSPB 1 (least resistant) → 1.4 multiplier (40% more risk)
        
        return 1.0 + (5 - bspbRating) * 0.1;
    }

    // =========================================================================
    // EXPORTS
    // =========================================================================

    const RedThreadModule = {
        version: '1.0.0',
        modelType: 'heuristic',
        confidence: 'low',
        
        // Model
        RedThreadModel: RedThreadModel,
        
        // Configuration
        CONFIG: RED_THREAD_CONFIG,
        
        // Main calculation
        calculate: (climate, nitrogen, variety, options) => 
            RedThreadModel.calculate(climate, nitrogen, variety, options),
        
        calculateDaily: (dayClimate, nitrogen, variety, options) =>
            RedThreadModel.calculateDaily(dayClimate, nitrogen, variety, options),
        
        // Interventions
        getInterventions: (riskLevel, context) =>
            RedThreadModel.getInterventions(riskLevel, context),
        
        // Helpers
        shouldUseRedThreadModel: shouldUseRedThreadModel,
        bspbToRiskMultiplier: bspbToRiskMultiplier,
        
        // Metadata
        getModelInfo: () => ({
            name: 'Red Thread Risk Index',
            pathogen: 'Laetisaria fuciformis',
            modelType: 'heuristic',
            confidence: 'low',
            version: '1.0.0',
            note: 'Based on observational thresholds from extension research. Not a validated predictive model.',
            keyFactors: [
                'Nitrogen status (DOMINANT - deficiency is primary cause)',
                'Temperature (optimal 15-25°C)',
                'Humidity/leaf wetness (prolonged wetness required)',
                'Species susceptibility (fine fescues, PRG most susceptible)'
            ],
            sources: [
                'Penn State Extension',
                'NC State Extension', 
                'Michigan State University',
                'UMass Extension',
                'UC IPM',
                'RHS (UK)',
                'Smiley et al. (2005) Compendium of Turfgrass Diseases'
            ]
        })
    };

    // Export to global
    if (typeof module !== 'undefined' && module.exports) {
        module.exports = RedThreadModule;
    }
    
    global.GAIP_RedThreadModel = RedThreadModule;
    global.RedThreadModel = RedThreadModel;
    
    // Convenience function for disease engine integration
    global.calcRedThreadRisk = (climate, nitrogen, variety, options) =>
        RedThreadModel.calculate(climate, nitrogen, variety, options);
    
    global.calcRedThreadDaily = (dayClimate, nitrogen, variety, options) =>
        RedThreadModel.calculateDaily(dayClimate, nitrogen, variety, options);

})(typeof window !== 'undefined' ? window : this);

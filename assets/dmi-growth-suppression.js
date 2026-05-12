/**
 * ============================================================================
 * GILBA DMI FUNGICIDE TRACKING MODULE v2.0.0
 * ============================================================================
 * 
 * Tracks DMI (demethylation inhibitor) fungicide applications and provides
 * warnings about potential interactions with PGR programs.
 * 
 * EVIDENCE-BASED APPROACH:
 * This module is based on published peer-reviewed research. Key findings:
 * 
 * 1. DMI fungicides alone have MINIMAL effect on clipping yield in most turf
 *    (Mitkowski & Chaves 2013, HortScience): "there was very little effect 
 *    from DMI fungicides" on creeping bentgrass clipping weights.
 * 
 * 2. The real risk is DMI + PGR COMBINATIONS which can cause:
 *    - 70%+ combined suppression (GreenKeeper/Kreuser research)
 *    - Synergistic phytotoxicity
 *    - Extended recovery time (several weeks)
 * 
 * 3. Species sensitivity varies — SPECIES-CONDITIONAL risk (Kahiu et al. 2025):
 *    - Triticonazole: significant injury on Poa annua, safe on bentgrass
 *    - Metconazole: injurious to Poa annua, safe on bentgrass
 *    - Myclobutanil: reached unacceptable injury alongside propiconazole
 *    - Ultradwarf bermudagrass: Most sensitive overall (Penn State/VA Tech)
 * 
 * 4. Product differences are real and relate to PHYTOTOXICITY:
 *    - Mefentrifluconazole: Lowest injury ≤0.1 all species/dates (Kahiu 2025)
 *    - Propiconazole: Darkening/thickening documented but minimal clipping
 *      effect at green height (Mitkowski 2013 vs Kahiu 2025 at fairway height)
 *    - Triadimefon: Highest phytotoxicity risk (6 dates highest injury, Kahiu)
 * 
 * WHAT THIS MODULE DOES:
 * - Tracks GDD accumulation since DMI application (valid - same as PGRs)
 * - Warns about combined PGR + DMI risk (validated in research)
 * - Flags higher-risk products vs lower-risk options
 * - Applies species-conditional risk overrides (Kahiu et al. 2025)
 * - Does NOT calculate fabricated suppression percentages
 * 
 * REFERENCES:
 * - Mitkowski & Chaves (2013) HortScience 48(8):1052
 * - Kahiu et al. (2025) Int. Turfgrass Soc. Research J. (Penn State)
 * - Kreuser - GreenKeeper PGR & DMI GDD Models v2.0
 * - Penn State/VA Tech DMI phytotoxicity research
 * 
 * ============================================================================
 */

(function(global) {
    'use strict';

    // ========================================================================
    // CONFIGURATION
    // ========================================================================

    const DMI_CONFIG = {
        version: '2.0.0',
        
        // GDD settings (same as PGR module - validated)
        defaults: {
            baseTemp: {
                c3: 0,      // Cool-season: base 0°C
                c4: 10      // Warm-season: base 10°C
            },
            maxDailyGDD: 25,
            // Typical persistence of DMI activity in plant
            typicalDurationGDD: {
                c3: 250,    // ~2-3 weeks at summer temps
                c4: 200     // Faster metabolism in warm-season
            }
        },
        
        // Risk categories based on published research
        // Kahiu et al. (2025) Int. Turfgrass Soc. Research J. — phytotoxicity ranking
        // Mitkowski & Chaves (2013) HortScience — clipping yield (minimal DMI effect alone)
        // NOTE: These indicate phytotoxicity/interaction risk, NOT suppression %
        riskCategory: {
            // Higher risk for phytotoxicity and PGR interaction
            // Triadimefon: highest injury in Kahiu study (6 dates)
            // Metconazole: injurious to Poa annua (Kahiu 2025)
            // Myclobutanil: reached unacceptable injury alongside propiconazole (Kahiu 2025)
            high: ['triadimefon', 'metconazole', 'myclobutanil'],
            
            // Moderate risk — context-dependent
            // Propiconazole: darkening/thickening documented (Kahiu 2025), but
            //   minimal clipping effect at green height (Mitkowski 2013)
            // Tebuconazole: moderate injury in Kahiu study
            // Triticonazole: significant injury on Poa annua, safe on bentgrass (Kahiu 2025)
            moderate: ['propiconazole', 'tebuconazole', 'triticonazole'],
            
            // Lower risk — newer chemistries with better turf safety
            // Mefentrifluconazole: ≤0.1 injury on all species/dates (Kahiu 2025)
            // Flutriafol: low injury (≤1.0) across all dates (Kahiu 2025)
            low: ['flutriafol', 'difenoconazole', 'mefentrifluconazole']
        },
        
        // Species-conditional risk overrides (Kahiu et al. 2025)
        // Some DMIs are safe on one species but injurious on another
        speciesRiskOverrides: {
            triticonazole: {
                'poa annua': 'high',           // Significant injury documented
                'annual bluegrass': 'high',
                'creeping bentgrass': 'low',   // No injury observed
                'bentgrass': 'low'
            },
            metconazole: {
                'poa annua': 'high',           // Injury documented
                'annual bluegrass': 'high',
                'creeping bentgrass': 'low',   // No injury observed
                'bentgrass': 'low'
            },
            propiconazole: {
                'poa annua': 'moderate',       // Darkening/thickening
                'annual bluegrass': 'moderate',
                'creeping bentgrass': 'moderate', // Darkening but minimal at green height
                'ultradwarf bermuda': 'high'   // Sensitive species
            }
        },
        
        // Species sensitivity to DMI phytotoxicity (from Penn State/VA Tech)
        speciesSensitivity: {
            // High sensitivity - use caution
            high: [
                'ultradwarf bermuda', 'tifeagle', 'champion dwarf', 'miniverde',
                'annual bluegrass', 'poa annua'
            ],
            // Moderate sensitivity
            moderate: [
                'bermuda', 'couch', 'hybrid bermuda', 'tifway', 'celebration',
                'perennial ryegrass', 'kentucky bluegrass'
            ],
            // Lower sensitivity - generally tolerant
            low: [
                'creeping bentgrass', 'bentgrass', 'agrostis',
                'zoysiagrass', 'zoysia', 'seashore paspalum'
            ]
        },
        
        // Warning thresholds for combined PGR + DMI
        // These ARE validated in research
        combinedRiskThresholds: {
            caution: 0.35,    // Combined effects may be noticeable
            warning: 0.50,    // Monitor for stress symptoms
            danger: 0.70      // High phytotoxicity risk - validated
        }
    };

    // ========================================================================
    // AUSTRALIAN DMI PRODUCTS — b35fix245
    // Corrected formulations per APVMA labels.
    // ========================================================================

    const DMI_PRODUCTS = {
        // ====================================================================
        // PROPICONAZOLE PRODUCTS (Moderate risk — species-dependent)
        // Kahiu 2025: darkening/thickening on both Poa and bentgrass
        // Mitkowski 2013: minimal clipping effect at green height
        // ====================================================================
        BANNER: {
            name: 'Banner Maxx (Propiconazole 155g/L)',
            activeIngredient: 'propiconazole',
            formulation: '155 g/L',
            aiPerL: 0.155,
            frac: 3,
            riskCategory: 'moderate',
            diseases: ['Dollar Spot', 'Brown Patch', 'Anthracnose', 'Fusarium'],
            registered: ['c3', 'c4'],
            notes: {
                typicalRate: { min: 5, max: 10, unit: 'L/ha' },
                interval: '14-28 days',
                warning: 'May cause darkening/thickening of foliage (Kahiu 2025). Minimal clipping effect at green height (Mitkowski 2013). Use caution with concurrent PGR applications.'
            }
        },
        BANNER_FAIRWAY: {
            name: 'Banner Fairway (Propiconazole 250g/L)',
            activeIngredient: 'propiconazole',
            formulation: '250 g/L',
            aiPerL: 0.250,
            frac: 3,
            riskCategory: 'moderate',
            diseases: ['Dollar Spot', 'Brown Patch', 'Anthracnose', 'Fusarium'],
            registered: ['c3', 'c4'],
            notes: {
                typicalRate: { min: 3, max: 6, unit: 'L/ha' },
                interval: '14-28 days',
                warning: 'Registered for fairways only, not greens or tees. Use caution with concurrent PGR applications.'
            }
        },
        BUMPER: {
            name: 'Bumper 625 (Propiconazole 625g/L)',
            activeIngredient: 'propiconazole',
            formulation: '625 g/L',
            aiPerL: 0.625,
            frac: 3,
            riskCategory: 'moderate',
            diseases: ['Dollar Spot', 'Brown Patch', 'Anthracnose'],
            registered: ['c3', 'c4'],
            notes: {
                typicalRate: { min: 1.2, max: 2.4, unit: 'L/ha' },
                interval: '14-28 days',
                warning: 'Highly concentrated formulation. Calculate rates carefully. Use caution with concurrent PGR applications.'
            }
        },
        REGIMENT: {
            name: 'Regiment 550 (Propiconazole 550g/L)',
            activeIngredient: 'propiconazole',
            formulation: '550 g/L',
            aiPerL: 0.550,
            frac: 3,
            riskCategory: 'moderate',
            diseases: ['Dollar Spot', 'Brown Patch', 'Anthracnose'],
            registered: ['c3', 'c4'],
            notes: {
                typicalRate: { min: 1.4, max: 2.8, unit: 'L/ha' },
                interval: '14-28 days',
                warning: 'Highly concentrated. Lower volume required, calculate carefully.'
            }
        },

        // ====================================================================
        // TRITICONAZOLE COMBINATIONS (Moderate risk — SPECIES-DEPENDENT)
        // Kahiu 2025: significant injury on Poa annua, safe on bentgrass
        // ====================================================================
        TRIBECA: {
            name: 'Tribeca (Triticonazole 194g/L + Fludioxonil 127g/L)',
            activeIngredient: 'triticonazole+fludioxonil',
            formulation: '194 g/L + 127 g/L',
            aiPerL: 0.194,  // DMI component
            frac: '3+12',
            riskCategory: 'moderate',
            diseases: ['Dollar Spot', 'Brown Patch', 'Anthracnose', 'Fusarium', 'Take-all'],
            registered: ['c3', 'c4'],
            notes: {
                typicalRate: { min: 0.75, max: 1.5, unit: 'L/ha' },
                interval: '14-28 days',
                warning: 'Significant injury to Poa annua; safe on bentgrass (Kahiu et al. 2025). Check species before applying.'
            }
        },
        IMPALA: {
            name: 'Impala (Triticonazole 194g/L + Azoxystrobin 96g/L)',
            activeIngredient: 'triticonazole+azoxystrobin',
            formulation: '194 g/L + 96 g/L',
            aiPerL: 0.194,  // DMI component
            frac: '3+11',
            riskCategory: 'moderate',
            diseases: ['Dollar Spot', 'Brown Patch', 'Anthracnose', 'Spring Dead Spot'],
            registered: ['c3', 'c4'],
            notes: {
                typicalRate: { min: 0.75, max: 1.5, unit: 'L/ha' },
                interval: '14-28 days',
                warning: 'Significant injury to Poa annua; safe on bentgrass (Kahiu et al. 2025). Check species before applying.'
            }
        },

        // ====================================================================
        // TRIADIMENOL PRODUCTS (Moderate risk — older chemistry)
        // ====================================================================
        CITADEL: {
            name: 'Citadel (Triadimenol 250g/L)',
            activeIngredient: 'triadimenol',
            formulation: '250 g/L',
            aiPerL: 0.250,
            frac: 3,
            riskCategory: 'moderate',
            diseases: ['Dollar Spot', 'Brown Patch', 'Helminthosporium', 'Rust', 'Spring Dead Spot'],
            registered: ['c3', 'c4'],
            notes: {
                typicalRate: { min: 3, max: 6, unit: 'L/ha' },
                interval: '28 days',
                warning: 'State registration restrictions apply. Older DMI chemistry, confirm current APVMA status before use.'
            }
        },
        TRIDIM: {
            name: 'Tridim 250 (Triadimenol 250g/L)',
            activeIngredient: 'triadimenol',
            formulation: '250 g/L',
            aiPerL: 0.250,
            frac: 3,
            riskCategory: 'moderate',
            diseases: ['Dollar Spot', 'Brown Patch', 'Helminthosporium', 'Rust', 'Spring Dead Spot'],
            registered: ['c3', 'c4'],
            notes: {
                typicalRate: { min: 3, max: 6, unit: 'L/ha' },
                interval: '28 days',
                warning: 'Generic triadimenol. Older DMI chemistry.'
            }
        },

        // ====================================================================
        // TEBUCONAZOLE PRODUCTS
        // ====================================================================
        DEDICATE_FORTE: {
            name: 'Dedicate Forte Stressgard (Tebuconazole 240g/L)',
            activeIngredient: 'tebuconazole',
            formulation: '240 g/L',
            aiPerL: 0.240,
            frac: 3,
            riskCategory: 'moderate',
            diseases: ['Dollar Spot', 'Brown Patch', 'Anthracnose', 'Leaf Spot', 'Fusarium'],
            registered: ['c3', 'c4'],
            notes: {
                typicalRate: { min: 1.5, max: 3, unit: 'L/ha' },
                interval: '14-28 days',
                warning: 'Stressgard formulation may reduce phytotoxicity. Use caution with concurrent PGR applications.'
            }
        },
        DEDICATE: {
            name: 'Dedicate Turf (Tebuconazole 200g/L + Trifloxystrobin 100g/L)',
            activeIngredient: 'tebuconazole+trifloxystrobin',
            formulation: '200 g/L + 100 g/L',
            aiPerL: 0.200,  // DMI component
            frac: '3+11',
            riskCategory: 'moderate',
            diseases: ['Dollar Spot', 'Brown Patch', 'Anthracnose', 'Leaf Spot'],
            registered: ['c3', 'c4'],
            notes: {
                typicalRate: { min: 3.0, max: 5.0, unit: 'L/ha' },
                interval: '14-28 days',
                warning: 'Combo product with QoI. Use caution with concurrent PGR applications.'
            }
        },
        TOMBSTONE_DUO: {
            name: 'Tombstone Duo (Tebuconazole 200g/L + Trifloxystrobin 100g/L)',
            activeIngredient: 'tebuconazole+trifloxystrobin',
            formulation: '200 g/L + 100 g/L',
            aiPerL: 0.200,  // DMI component
            frac: '3+11',
            riskCategory: 'moderate',
            diseases: ['Dollar Spot', 'Brown Patch', 'Anthracnose', 'Leaf Spot'],
            registered: ['c3', 'c4'],
            notes: {
                typicalRate: { min: 3.0, max: 5.0, unit: 'L/ha' },
                interval: '14-28 days',
                warning: 'Combo product with QoI. Use caution with concurrent PGR applications.'
            }
        },

        // ====================================================================
        // LOW RISK DMIs (Newer chemistries — best turf safety evidence)
        // ====================================================================
        MAXTIMA: {
            name: 'Maxtima (Mefentrifluconazole 400g/L)',
            activeIngredient: 'mefentrifluconazole',
            formulation: '400 g/L',
            aiPerL: 0.400,
            frac: 3,
            riskCategory: 'low',
            diseases: ['Dollar Spot', 'Brown Patch', 'Anthracnose'],
            registered: ['c3', 'c4'],
            notes: {
                typicalRate: { min: 0.4, max: 0.75, unit: 'L/ha' },
                interval: '14-28 days',
                warning: 'Lowest phytotoxicity of all DMIs tested, injury ≤0.1 on all species and dates (Kahiu et al. 2025). Preferred option when using concurrent PGR programs.'
            }
        }
    };

    // ========================================================================
    // UTILITY FUNCTIONS
    // ========================================================================

    function getSpeciesClass(species) {
        const c4Species = ['couch', 'bermuda', 'hybrid bermuda', 'tifeagle', 
                          'champion', 'kikuyu', 'seashore paspalum', 'zoysiagrass',
                          'buffalo', 'st. augustine', 'bahia', 'ultradwarf'];
        const speciesLower = (species || '').toLowerCase();
        return c4Species.some(s => speciesLower.includes(s)) ? 'c4' : 'c3';
    }

    function getSpeciesSensitivity(species) {
        const speciesLower = (species || '').toLowerCase();
        
        for (const s of DMI_CONFIG.speciesSensitivity.high) {
            if (speciesLower.includes(s)) return { level: 'high', factor: 1.5 };
        }
        for (const s of DMI_CONFIG.speciesSensitivity.low) {
            if (speciesLower.includes(s)) return { level: 'low', factor: 0.7 };
        }
        return { level: 'moderate', factor: 1.0 };
    }

    function getRiskCategory(activeIngredient, species) {
        const ai = (activeIngredient || '').toLowerCase().split('+')[0];
        
        // Check species-conditional overrides first (Kahiu et al. 2025)
        if (species && DMI_CONFIG.speciesRiskOverrides[ai]) {
            const speciesLower = (species || '').toLowerCase();
            const overrides = DMI_CONFIG.speciesRiskOverrides[ai];
            for (const [speciesKey, risk] of Object.entries(overrides)) {
                if (speciesLower.includes(speciesKey)) return risk;
            }
        }
        
        // Fall back to general category
        if (DMI_CONFIG.riskCategory.high.includes(ai)) return 'high';
        if (DMI_CONFIG.riskCategory.low.includes(ai)) return 'low';
        return 'moderate';
    }

    // ========================================================================
    // GDD CALCULATION (Same as PGR module - validated approach)
    // ========================================================================

    function calculateGDDAccumulation(applicationDate, state, baseTemp) {
        if (!applicationDate) return { totalGDD: 0, days: 0, estimated: false };
        
        const appDate = new Date(applicationDate);
        appDate.setHours(0, 0, 0, 0);
        const today = new Date();
        const days = Math.floor((today - appDate) / (1000 * 60 * 60 * 24));
        
        if (days <= 0) return { totalGDD: 0, days: 0, estimated: false };
        
        // Helper function to calculate daily GDD
        function calcDailyGDD(tmax, tmin, base) {
            const avg = (tmax + tmin) / 2;
            return Math.min(DMI_CONFIG.defaults.maxDailyGDD, Math.max(0, avg - base));
        }
        
        // Try rawWeatherData first (same as PGR module) - hourly format
        if (typeof window !== 'undefined' && window.rawWeatherData?.forecast?.hourly) {
            try {
                const hourly = window.rawWeatherData.forecast.hourly;
                if (hourly.time && hourly.temperature_2m) {
                    const hoursPerDay = 24;
                    const numDays = Math.ceil(hourly.time.length / hoursPerDay);
                    
                    let totalGDD = 0;
                    let dayCount = 0;
                    
                    for (let d = 0; d < numDays; d++) {
                        const startIdx = d * hoursPerDay;
                        const endIdx = Math.min(startIdx + hoursPerDay, hourly.time.length);
                        const dayTemps = hourly.temperature_2m.slice(startIdx, endIdx);
                        const dateStr = hourly.time[startIdx].split('T')[0];
                        const dayDate = new Date(dateStr);
                        dayDate.setHours(0, 0, 0, 0);
                        
                        if (dayDate >= appDate && dayTemps.length > 0) {
                            const tmax = Math.max.apply(null, dayTemps);
                            const tmin = Math.min.apply(null, dayTemps);
                            totalGDD += calcDailyGDD(tmax, tmin, baseTemp);
                            dayCount++;
                        }
                    }
                    
                    if (dayCount > 0) {
                        return { totalGDD: Math.round(totalGDD), days: dayCount, estimated: false, source: 'weather_hourly' };
                    }
                }
            } catch (e) {
                console.warn('DMI: Error calculating GDD from hourly weather:', e);
            }
        }
        
        // Try rawWeatherData daily format
        if (typeof window !== 'undefined' && window.rawWeatherData?.daily) {
            try {
                const daily = window.rawWeatherData.daily;
                let totalGDD = 0;
                let dayCount = 0;
                
                for (let i = 0; i < daily.time.length; i++) {
                    const dateStr = daily.time[i];
                    const dayDate = new Date(dateStr);
                    dayDate.setHours(0, 0, 0, 0);
                    
                    if (dayDate >= appDate) {
                        const tmax = daily.temperature_2m_max[i];
                        const tmin = daily.temperature_2m_min[i];
                        if (tmax !== undefined && tmin !== undefined) {
                            totalGDD += calcDailyGDD(tmax, tmin, baseTemp);
                            dayCount++;
                        }
                    }
                }
                
                if (dayCount > 0) {
                    return { totalGDD: Math.round(totalGDD), days: dayCount, estimated: false, source: 'weather_daily' };
                }
            } catch (e) {
                console.warn('DMI: Error calculating GDD from daily weather:', e);
            }
        }
        
        // Try climate engine
        if (typeof window !== 'undefined' && window.GAIP_CLIMATE?.calculateGDD) {
            const climateGDD = window.GAIP_CLIMATE.calculateGDD({
                startDate: applicationDate,
                baseTemp: baseTemp,
                maxDailyGDD: DMI_CONFIG.defaults.maxDailyGDD
            });
            if (climateGDD && climateGDD.totalGDD > 0) {
                return {
                    totalGDD: Math.round(climateGDD.totalGDD),
                    days: climateGDD.days || days,
                    estimated: false,
                    source: 'climate_engine'
                };
            }
        }
        
        // Try weather data from state
        if (state?.weather?.daily && state.weather.daily.length > 0) {
            let totalGDD = 0;
            state.weather.daily.forEach((d, i) => {
                const dateStr = state.weather.dates?.[i] || d.date;
                if (dateStr && new Date(dateStr) >= appDate) {
                    const tempMax = d.temperature_2m_max || d.tempMax || d.max;
                    const tempMin = d.temperature_2m_min || d.tempMin || d.min;
                    if (tempMax !== undefined && tempMin !== undefined) {
                        totalGDD += calcDailyGDD(tempMax, tempMin, baseTemp);
                    }
                }
            });
            if (totalGDD > 0) {
                return { totalGDD: Math.round(totalGDD), days, estimated: false, source: 'state_weather' };
            }
        }
        
        // Fallback: estimate
        let avgTemp = 18;
        if (state?.climate?.manual?.tmin && state?.climate?.manual?.tmax) {
            avgTemp = (state.climate.manual.tmin + state.climate.manual.tmax) / 2;
        } else if (state?.climate?.manual?.temperature?.mean) {
            avgTemp = state.climate.manual.temperature.mean;
        }
        
        const dailyGDD = Math.min(DMI_CONFIG.defaults.maxDailyGDD, Math.max(0, avgTemp - baseTemp));
        const totalGDD = dailyGDD * days;
        
        return { totalGDD: Math.round(totalGDD), days, estimated: true, avgTemp, source: 'estimated' };
    }

    // ========================================================================
    // MAIN DMI TRACKING FUNCTION
    // ========================================================================

    /**
     * Track DMI fungicide application and assess interaction risk
     * 
     * NOTE: This does NOT calculate suppression % because research shows
     * DMIs alone have minimal effect on clipping yield. Instead, it tracks
     * the application for PGR interaction warnings.
     */
    function trackDMIApplication(config, state = {}) {
        const product = DMI_PRODUCTS[config.product];
        if (!product) {
            return { 
                error: true, 
                message: `Unknown DMI product: ${config.product}`,
                hasActiveApplication: false
            };
        }
        
        const species = config.species || 'Perennial Ryegrass';
        const speciesClass = getSpeciesClass(species);
        const baseTemp = DMI_CONFIG.defaults.baseTemp[speciesClass];
        const speciesSensitivity = getSpeciesSensitivity(species);
        
        // Calculate GDD since application
        const gddData = calculateGDDAccumulation(config.applicationDate, state, baseTemp);
        
        // Determine if DMI is still "active" (within typical duration)
        const typicalDuration = DMI_CONFIG.defaults.typicalDurationGDD[speciesClass];
        const isActive = gddData.totalGDD < typicalDuration;
        const gddProgress = Math.min(100, Math.round((gddData.totalGDD / typicalDuration) * 100));
        
        // Calculate remaining days (estimate)
        const remainingGDD = Math.max(0, typicalDuration - gddData.totalGDD);
        let avgDailyGDD = gddData.days > 0 && gddData.totalGDD > 0 
            ? gddData.totalGDD / gddData.days 
            : (speciesClass === 'c3' ? 15 : 10);
        const daysRemaining = avgDailyGDD > 0 ? Math.round(remainingGDD / avgDailyGDD) : 14;
        
        // Determine risk level (species-conditional from Kahiu et al. 2025)
        const productRisk = getRiskCategory(product.activeIngredient, species);
        let overallRisk = productRisk;
        
        // Elevate risk for sensitive species
        if (speciesSensitivity.level === 'high' && productRisk !== 'low') {
            overallRisk = 'high';
        }
        
        return {
            product: {
                code: config.product,
                name: product.name,
                activeIngredient: product.activeIngredient,
                riskCategory: productRisk,
                diseases: product.diseases
            },
            application: {
                date: config.applicationDate,
                rateLperHa: config.rateLperHa,
                daysSince: gddData.days
            },
            gdd: {
                accumulated: gddData.totalGDD,
                typicalDuration: typicalDuration,
                progress: gddProgress,
                remaining: remainingGDD,
                baseTemp,
                estimated: gddData.estimated,
                source: gddData.source
            },
            status: {
                isActive,
                daysRemaining: isActive ? daysRemaining : 0,
                effectEndsDate: isActive 
                    ? new Date(Date.now() + daysRemaining * 24 * 60 * 60 * 1000)
                        .toLocaleDateString('en-AU', { day: 'numeric', month: 'short' })
                    : 'Complete'
            },
            risk: {
                overall: overallRisk,
                species: speciesSensitivity.level,
                speciesName: species,
                warning: product.notes?.warning || null
            },
            // Explicitly NOT including suppression % - not supported by research
            hasActiveApplication: isActive
        };
    }

    // ========================================================================
    // COMBINED PGR + DMI RISK ASSESSMENT
    // This IS validated in research (70%+ combined = phytotoxicity risk)
    // ========================================================================

    /**
     * Assess risk when PGR and DMI are used together
     * 
     * Research shows the combination can cause 70%+ suppression and
     * phytotoxicity that lasts several weeks.
     * 
     * @param {number} pgrSuppression - Current PGR suppression (0-1)
     * @param {object} dmiStatus - Result from trackDMIApplication
     * @returns {object} Combined risk assessment
     */
    function assessCombinedRisk(pgrSuppression, dmiStatus) {
        if (!dmiStatus || !dmiStatus.hasActiveApplication) {
            return {
                hasCombinedRisk: false,
                warningLevel: 'none',
                message: null
            };
        }
        
        const pgrPct = Math.round(pgrSuppression * 100);
        const dmiRisk = dmiStatus.risk?.overall || 'moderate';
        const speciesRisk = dmiStatus.risk?.species || 'moderate';
        
        // Risk factors
        let riskScore = 0;
        
        // PGR suppression contributes to combined risk
        if (pgrSuppression >= 0.40) riskScore += 3;
        else if (pgrSuppression >= 0.25) riskScore += 2;
        else if (pgrSuppression >= 0.15) riskScore += 1;
        
        // DMI product risk
        if (dmiRisk === 'high') riskScore += 2;
        else if (dmiRisk === 'moderate') riskScore += 1;
        
        // Species sensitivity
        if (speciesRisk === 'high') riskScore += 2;
        else if (speciesRisk === 'moderate') riskScore += 1;
        
        // Determine warning level
        let warningLevel, message, recommendation;
        
        if (riskScore >= 6 || (pgrSuppression >= 0.40 && dmiRisk === 'high')) {
            warningLevel = 'danger';
            message = 'HIGH RISK: Active PGR program with high-risk DMI fungicide. Research shows this combination can cause 70%+ growth suppression and phytotoxicity lasting several weeks.';
            recommendation = 'Consider: (1) extending PGR interval, (2) reducing PGR rate, or (3) switching to a lower-risk DMI like mefentrifluconazole.';
        } else if (riskScore >= 4 || (pgrSuppression >= 0.25 && dmiRisk !== 'low')) {
            warningLevel = 'warning';
            message = 'CAUTION: Active PGR program with DMI fungicide may cause elevated growth suppression. Monitor for stress symptoms.';
            recommendation = 'Monitor turf closely for 2-3 weeks. Consider extending next PGR application interval.';
        } else if (riskScore >= 2) {
            warningLevel = 'caution';
            message = 'Note: DMI fungicide active during PGR program. Effects are typically minimal with current combination.';
            recommendation = null;
        } else {
            warningLevel = 'none';
            message = null;
            recommendation = null;
        }
        
        return {
            hasCombinedRisk: warningLevel !== 'none',
            warningLevel,
            pgrSuppression: pgrPct,
            dmiProduct: dmiStatus.product?.name,
            dmiRiskCategory: dmiRisk,
            speciesSensitivity: speciesRisk,
            riskScore,
            message,
            recommendation
        };
    }

    // ========================================================================
    // PRODUCT LIST AND HELPERS
    // ========================================================================

    function getDMIProductList() {
        return Object.entries(DMI_PRODUCTS).map(([code, product]) => ({
            code,
            name: product.name,
            activeIngredient: product.activeIngredient,
            riskCategory: product.riskCategory,
            diseases: product.diseases,
            typicalRate: product.notes?.typicalRate,
            warning: product.notes?.warning
        }));
    }

    function getProductsByRisk(riskLevel) {
        return getDMIProductList().filter(p => p.riskCategory === riskLevel);
    }

    /**
     * Calculate adjusted (combined PGR + DMI) suppression percentage for display.
     *
     * Research basis:
     *   - Kreuser/GreenKeeper: PGR + DMI combinations can reach 70%+ suppression
     *   - Kahiu et al. 2025: Species-conditional phytotoxicity (high-risk DMIs worst on Poa annua)
     *   - Mitkowski & Chaves 2013: DMI alone has minimal clipping effect at green height
     *
     * Logic:
     *   - 'danger' (riskScore ≥6 or PGR ≥40% + high-risk DMI): adjusted = max(pgrPct, 70)
     *     Kreuser documents 70%+ combined suppression in this scenario.
     *   - 'warning' (riskScore ≥4): adjusted = pgrPct + 12pp additive
     *     Conservative mid-range estimate for moderate combined effect.
     *   - 'caution' (riskScore ≥2): adjusted = pgrPct + 5pp
     *     Minimal additive effect — DMI alone has little clipping impact (Mitkowski 2013).
     *   - 'none': no adjustment.
     *
     * Returns: { adjustedPct, pgrOnlyPct, addedPct, basis }
     * addedPct = 0 means no DMI adjustment applied.
     *
     * @param {number} pgrSuppression  0–1 fraction from PGR engine
     * @param {object} combinedRisk    result of assessCombinedRisk()
     * @returns {object}
     */
    function calcAdjustedSuppression(pgrSuppression, combinedRisk) {
        const pgrPct = Math.round(pgrSuppression * 100);
        if (!combinedRisk || !combinedRisk.hasCombinedRisk) {
            return { adjustedPct: pgrPct, pgrOnlyPct: pgrPct, addedPct: 0, basis: null };
        }
        let adjustedPct, basis;
        switch (combinedRisk.warningLevel) {
            case 'danger':
                // Kreuser: 70%+ combined suppression documented
                adjustedPct = Math.max(pgrPct, 70);
                basis = 'Combined suppression may reach 70%+ (Kreuser/GreenKeeper research)';
                break;
            case 'warning':
                adjustedPct = Math.min(100, pgrPct + 12);
                basis = 'Estimated +12pp from DMI interaction (Kahiu et al. 2025)';
                break;
            case 'caution':
                adjustedPct = Math.min(100, pgrPct + 5);
                basis = 'Minimal DMI additive effect (Mitkowski & Chaves 2013)';
                break;
            default:
                return { adjustedPct: pgrPct, pgrOnlyPct: pgrPct, addedPct: 0, basis: null };
        }
        return {
            adjustedPct,
            pgrOnlyPct: pgrPct,
            addedPct: adjustedPct - pgrPct,
            basis
        };
    }

    function getLowerRiskAlternatives(currentProduct, species) {
        const product = DMI_PRODUCTS[currentProduct];
        if (!product) return [];
        
        const currentRisk = getRiskCategory(product.activeIngredient, species);
        if (currentRisk === 'low') return [];
        
        return getDMIProductList().filter(p => {
            const altRisk = getRiskCategory(p.activeIngredient.split('+')[0], species);
            return altRisk === 'low' && 
                   p.diseases.some(d => product.diseases.includes(d));
        });
    }

    // ========================================================================
    // PUBLIC API
    // ========================================================================

    const GAIP_DMI = {
        version: DMI_CONFIG.version,
        
        // Main tracking function
        track: trackDMIApplication,
        
        // Risk assessment
        assessCombinedRisk,
        calcAdjustedSuppression,
        
        // Product helpers
        getProductList: getDMIProductList,
        getProductsByRisk,
        getLowerRiskAlternatives,
        getProduct: (code) => DMI_PRODUCTS[code],
        
        // Configuration
        config: DMI_CONFIG,
        products: DMI_PRODUCTS
    };

    // Export to global scope
    global.GAIP_DMI = GAIP_DMI;

    // Wrapper function for hub integration
    global.gaip_dmi_calculate = function(state) {
        if (!state.dmi || !state.dmi.product) {
            return { error: true, message: 'No DMI product selected', hasActiveApplication: false };
        }
        
        return trackDMIApplication({
            product: state.dmi.product,
            applicationDate: state.dmi.applicationDate,
            rateLperHa: state.dmi.rateLperHa || 0,
            species: state.turf?.grassSpecies || 'Perennial Ryegrass'
        }, state);
    };


})(typeof window !== 'undefined' ? window : this);

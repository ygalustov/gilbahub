/**
 * ============================================================================
 * GILBA CLIMATE MODULE v2.1.3
 * ============================================================================
 * 
 * Enhanced climate analysis with variety-specific modifiers.
 * Extends climate-engine.js with NTEP-based cultivar adjustments.
 * 
 * NEW IN v2.0:
 * - Variety-specific cold tolerance (winterkill risk adjustment)
 * - Variety-specific heat tolerance modifiers
 * - Dormancy timing predictions by cultivar
 * - Spring greenup forecasting
 * - Drought stress integration with variety traits
 * - Enhanced growth potential with cultivar adjustments
 * 
 * SCIENTIFIC BASIS:
 * - NTEP cold tolerance trials (Indiana 2014-2017)
 * - PACE Turf growth potential model
 * - Turfgrass heat stress research (Xu & Huang, Rutgers)
 * - OSU shade/cold tolerance studies
 * 
 * INTEGRATION:
 * - Loads after climate-engine.js
 * - Automatically applies variety modifiers when available
 * - Falls back to species defaults if no variety specified
 * 
 * ============================================================================
 */

(function(global) {
    'use strict';

    // ========================================================================
    // CONFIGURATION
    // ========================================================================

    const CLIMATE_V2_CONFIG = {
        version: '2.0.0',
        
        // ====================================================================
        // WINTERKILL RISK THRESHOLDS
        // Source: NTEP cold tolerance trials, OSU/Purdue research
        // ====================================================================
        winterkill: {
            // Soil temperature thresholds (°C at 5cm depth)
            criticalSoilTemp: -6,      // Below this = severe risk
            warningSoilTemp: -3,       // Below this = elevated risk
            dormancySoilTemp: 10,      // C4 dormancy trigger
            
            // Duration thresholds (consecutive hours)
            criticalDuration: 48,      // Hours below critical = high risk
            warningDuration: 24,       // Hours below warning = moderate risk
            
            // Species base survival rates (fraction surviving after -6°C exposure)
            speciesBaseSurvival: {
                bermuda: 0.60,
                couch: 0.60,
                kikuyu: 0.70,
                buffalo: 0.50,
                zoysia: 0.75,
                ryegrass: 0.95,
                tallFescue: 0.90,
                bentgrass: 0.85
            }
        },
        
        // ====================================================================
        // HEAT STRESS THRESHOLDS
        // Source: Xu & Huang (Rutgers), PACE Turf research
        // ====================================================================
        heatStress: {
            // Air temperature thresholds (°C)
            c3: {
                optimal: 22,           // Peak photosynthesis
                suboptimal: 27,        // Reduced growth begins
                stress: 32,            // Significant stress
                critical: 38           // Severe damage risk
            },
            c4: {
                optimal: 32,
                suboptimal: 37,
                stress: 40,
                critical: 45
            },
            
            // Night temperature thresholds (critical for C3 summer decline)
            nightTempStress: 22,       // C3 stress when nights > 22°C
            nightTempCritical: 25      // C3 severe stress when nights > 25°C
        },
        
        // ====================================================================
        // DORMANCY TRIGGERS
        // ====================================================================
        dormancy: {
            // C4 dormancy (going dormant in autumn/winter)
            c4DormancySoilTemp: 10,    // °C - below this triggers dormancy
            c4DormancyAirTemp: 10,     // °C mean daily temperature
            c4DormancyDays: 7,         // Consecutive days below threshold
            
            // C3 summer dormancy
            c3SummerStressTemp: 30,    // °C - above this + drought = dormancy
            
            // Greenup triggers (spring)
            c4GreenupSoilTemp: 15,     // °C - above this for 5 days
            c4GreenupDays: 5,
            
            // Growing degree days for greenup
            gddBaseC4: 10,             // °C base for C4 GDD
            gddGreenupThreshold: 100   // GDD needed for visible greenup
        },
        
        // ====================================================================
        // DROUGHT STRESS INTEGRATION
        // ====================================================================
        drought: {
            // Soil moisture thresholds (volumetric %)
            optimal: 25,
            adequate: 18,
            stressed: 12,
            wilting: 8,
            
            // ET deficit thresholds (mm/week below replacement)
            mildDeficit: 10,
            moderateDeficit: 20,
            severeDeficit: 35
        }
    };

    // ========================================================================
    // HELPER FUNCTIONS
    // ========================================================================

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
        if (s.includes('ryegrass') || s.includes('prg')) return 'ryegrass';
        if (s.includes('tall') && s.includes('fescue')) return 'tallFescue';
        if (s.includes('fescue') || s.includes('chewing')) return 'fineFescue';
        if (s.includes('bent')) return 'bentgrass';
        return 'generic';
    }

    function isC4(species) {
        const c4 = ['bermuda', 'couch', 'kikuyu', 'buffalo', 'zoysia', 'paspalum'];
        return c4.includes(getSpeciesKey(species));
    }

    function isC3(species) {
        const c3 = ['ryegrass', 'tallFescue', 'bentgrass', 'bluegrass', 'fescue'];
        return c3.includes(getSpeciesKey(species));
    }
    
    /**
     * Get the effective species for analysis
     * If overseed is dominant (>50% C3 cover), use the overseed species
     * @param {object} turf - Turf state object
     * @returns {object} - {species, variety, isOverseed}
     */
    function getEffectiveSpecies(turf) {
        const baseSpecies = turf.grassSpecies || 'couch';
        const baseVariety = turf.variety || turf.cultivar;
        const overseedSpecies = turf.coolOverseed || '';
        const overseedVariety = turf.overseedVariety || '';
        // v2.1.4: Read percentC3Cover first; fall back to speciesFractions.c3Fraction
        // (x100) if the DOM field hasn't populated yet on run #1. Without this,
        // getEffectiveSpecies returns the base C4 species on the first cascade pass
        // because percentC3Cover is 0, causing gpWeighted = 49% (C4) instead of 99% (C3).
        const percentC3 = turf.percentC3Cover ||
            ((turf.speciesFractions && typeof turf.speciesFractions.c3Fraction === 'number')
                ? turf.speciesFractions.c3Fraction * 100
                : 0);

        // b35fix171: isOverseed must only fire when there is a genuine warm-season base.
        // For pure C3 species (bentgrass, ryegrass, fescue etc.) hub-tissue-v3 sets
        // coolOverseed = grassSpecies and c3Fraction = 1, which makes percentC3 = 100.
        // Without this guard, getEffectiveSpecies returns isOverseed:true with
        // baseSpecies === species — contradictory and wrong for GP weighting.
        // An overseed scenario requires: warm-season base AND a distinct cool-season overseed.
        const C4_KEYS = ['couch', 'bermuda', 'kikuyu', 'zoysia', 'buffalo', 'paspalum', 'seashore'];
        const baseKey = baseSpecies.toLowerCase();
        const hasWarmBase = turf.warmBase && turf.warmBase.trim().length > 0
            || C4_KEYS.some(k => baseKey.indexOf(k) > -1);
        const overseedIsDistinct = overseedSpecies && overseedSpecies !== baseSpecies;

        // If overseed is dominant (>50%) AND there is a genuine warm-season base
        if (percentC3 > 50 && hasWarmBase && overseedIsDistinct) {
            return {
                species: overseedSpecies,
                variety: overseedVariety || 'generic',
                isOverseed: true,
                baseSpecies: baseSpecies,
                baseVariety: baseVariety
            };
        }
        
        return {
            species: baseSpecies,
            variety: baseVariety,
            isOverseed: false
        };
    }

    // ========================================================================
    // VARIETY TRAITS INTEGRATION
    // ========================================================================

    /**
     * Get variety-specific cold tolerance modifier
     * Returns winterkillRisk multiplier: <1.0 = more cold hardy
     */
    function getVarietyColdModifier(species, variety) {
        if (!variety) return { winterkillRisk: 1.0, confidence: 'none' };
        
        // Check variety traits integration
        if (global.GAIP_VarietyTraits) {
            const mod = global.GAIP_VarietyTraits.getColdModifier(species, variety);
            if (mod.confidence !== 'none') {
                return mod;
            }
        }
        
        // Fallback: known varieties with cold data
        const knownVarieties = {
            'Tahoma 31': { winterkillRisk: 0.70, dormancyModifier: 0.85, confidence: 'high', 
                          source: 'NTEP Indiana 4% winterkill' },
            'Latitude 36': { winterkillRisk: 0.85, dormancyModifier: 0.90, confidence: 'high',
                            source: 'NTEP transition zone trials' },
            'TifTuf': { winterkillRisk: 1.00, dormancyModifier: 1.00, confidence: 'high',
                       source: 'NTEP baseline' },
            'Celebration': { winterkillRisk: 1.10, dormancyModifier: 1.00, confidence: 'medium',
                            source: 'Less cold hardy than Tahoma' },
            'Northbridge': { winterkillRisk: 0.75, dormancyModifier: 0.85, confidence: 'high',
                            source: 'OSU cold tolerance selection' },
            'Avenger III': { winterkillRisk: 0.90, dormancyModifier: 1.00, confidence: 'medium',
                            source: 'Wide climate adaptability' }
        };
        
        return knownVarieties[variety] || { winterkillRisk: 1.0, dormancyModifier: 1.0, confidence: 'none' };
    }

    /**
     * Get variety-specific heat/drought tolerance modifier
     */
    function getVarietyHeatDroughtModifier(species, variety) {
        if (!variety) return { heatMultiplier: 1.0, droughtMultiplier: 1.0, confidence: 'none' };
        
        // Check variety traits integration
        if (global.GAIP_VarietyTraits) {
            const mod = global.GAIP_VarietyTraits.getHeatDroughtModifier(species, variety);
            if (mod.confidence !== 'none') {
                return mod;
            }
        }
        
        // Fallback: known varieties
        const knownVarieties = {
            'Tahoma 31': { heatMultiplier: 0.95, droughtMultiplier: 0.82, confidence: 'high' },
            'TifTuf': { heatMultiplier: 1.00, droughtMultiplier: 0.85, confidence: 'high' },
            'Celebration': { heatMultiplier: 0.90, droughtMultiplier: 0.86, confidence: 'medium' },
            'RTF Turf Saver': { heatMultiplier: 1.00, droughtMultiplier: 0.85, confidence: 'medium' },
            'Firecracker G-LS': { heatMultiplier: 0.90, droughtMultiplier: 1.00, confidence: 'medium' }
        };
        
        return knownVarieties[variety] || { heatMultiplier: 1.0, droughtMultiplier: 1.0, confidence: 'none' };
    }

    /**
     * Get variety-specific spring greenup modifier
     */
    function getVarietyGreenupModifier(species, variety) {
        if (!variety) return { daysEarlier: 0, confidence: 'none' };
        
        // Check variety traits data
        const data = global.GAIP_VarietyTraits?.getVarietyData?.(species, variety);
        if (data?.traits?.springGreenup) {
            return {
                daysEarlier: data.traits.springGreenup.daysEarlier || 0,
                confidence: data.traits.springGreenup.confidence || 'medium',
                source: data.traits.springGreenup.source
            };
        }
        
        // Fallback
        const knownVarieties = {
            'Tahoma 31': { daysEarlier: 14, confidence: 'high', source: 'NTEP #1 spring greenup' },
            'Latitude 36': { daysEarlier: 10, confidence: 'high' },
            'TifTuf': { daysEarlier: 7, confidence: 'medium' },
            'Celebration': { daysEarlier: 5, confidence: 'medium' }
        };
        
        return knownVarieties[variety] || { daysEarlier: 0, confidence: 'none' };
    }

    // ========================================================================
    // WINTERKILL RISK CALCULATION
    // ========================================================================

    /**
     * Calculate winterkill risk based on temperature forecast and variety
     * @param {object} state - Hub state with turf info
     * @param {object} climateData - Climate engine output or forecast
     * @returns {object} Winterkill risk assessment
     */
    function calculateWinterkillRisk(state, climateData) {
        const turf = state.turf || {};
        const species = turf.grassSpecies || 'couch';
        const variety = turf.variety || turf.cultivar;
        
        // C3 grasses have very low winterkill risk
        if (isC3(species)) {
            return {
                applicable: false,
                reason: 'C3 grasses are cold-tolerant',
                risk: 'minimal',
                riskScore: 5
            };
        }
        
        // Get variety modifier
        const coldMod = getVarietyColdModifier(species, variety);
        
        // Get temperature data
        const temps = extractTemperatureData(climateData);
        if (!temps || temps.length === 0) {
            return {
                applicable: false,  // Don't show card when no data
                error: 'No temperature data available',
                risk: 'unknown'
            };
        }
        
        // Find minimum temperatures
        const minTemp = Math.min(...temps.map(t => t.min));
        
        // Early exit: If min temp > 15°C, it's clearly not winter - don't show winterkill
        if (minTemp > 15) {
            return {
                applicable: false,
                risk: 'none',
                severity: 'none',
                riskScore: 0,
                minTemp: minTemp,
                recommendations: []
            };
        }
        
        // b35fix139: sensor soilTemp first for winterkill threshold check
        const _wkCanon = (typeof window !== 'undefined') ? window.GAIP_CANONICAL_STATE : null;
        const _wkSensorSoil = _wkCanon?.sensor?.soilTemp ?? _wkCanon?.soilTemp?.mean ?? null;
        const minSoilTemp = _wkSensorSoil !== null ? _wkSensorSoil :
            (temps[0].soilTemp !== undefined ?
            Math.min(...temps.map(t => t.soilTemp)) : minTemp + 2);
        
        // Count hours below thresholds
        const hoursData = extractHourlyTemps(climateData);
        let hoursBelowCritical = 0;
        let hoursBelowWarning = 0;
        
        if (hoursData) {
            hoursBelowCritical = hoursData.filter(t => t < CLIMATE_V2_CONFIG.winterkill.criticalSoilTemp).length;
            hoursBelowWarning = hoursData.filter(t => t < CLIMATE_V2_CONFIG.winterkill.warningSoilTemp).length;
        }
        
        // Base survival rate for species
        const speciesKey = getSpeciesKey(species);
        const baseSurvival = CLIMATE_V2_CONFIG.winterkill.speciesBaseSurvival[speciesKey] || 0.60;
        
        // Calculate risk score (0-100)
        let riskScore = 0;
        
        // Temperature-based risk
        if (minSoilTemp < CLIMATE_V2_CONFIG.winterkill.criticalSoilTemp) {
            riskScore += 40;
        } else if (minSoilTemp < CLIMATE_V2_CONFIG.winterkill.warningSoilTemp) {
            riskScore += 20;
        } else if (minSoilTemp < 0) {
            riskScore += 10;
        }
        
        // Duration-based risk
        if (hoursBelowCritical >= CLIMATE_V2_CONFIG.winterkill.criticalDuration) {
            riskScore += 30;
        } else if (hoursBelowCritical >= CLIMATE_V2_CONFIG.winterkill.warningDuration) {
            riskScore += 15;
        }
        
        if (hoursBelowWarning >= 72) {
            riskScore += 15;
        }
        
        // Apply variety modifier
        riskScore = riskScore * coldMod.winterkillRisk;
        riskScore = clamp(riskScore, 0, 100);
        
        // Estimated survival
        const survivalPct = baseSurvival * (1 - riskScore / 200) * (2 - coldMod.winterkillRisk);
        
        // Risk classification
        let risk, severity;
        if (riskScore < 15) {
            risk = 'minimal';
            severity = 'good';
        } else if (riskScore < 35) {
            risk = 'low';
            severity = 'good';
        } else if (riskScore < 55) {
            risk = 'moderate';
            severity = 'watch';
        } else if (riskScore < 75) {
            risk = 'high';
            severity = 'concern';
        } else {
            risk = 'severe';
            severity = 'critical';
        }
        
        // Recommendations
        const recommendations = [];
        if (riskScore > 30) {
            recommendations.push('Avoid traffic on dormant turf to prevent crown damage');
        }
        if (riskScore > 50) {
            recommendations.push('Consider protective covers for critical areas');
            recommendations.push('Delay nitrogen applications until spring greenup confirmed');
        }
        if (riskScore > 70) {
            recommendations.push('Prepare contingency renovation plan');
            recommendations.push('Document damage for insurance if applicable');
        }
        
        // Only show winterkill card if there's actual cold stress (min temp < 10°C)
        // Don't clutter summer reports with irrelevant winterkill info
        const showWinterkillUI = minTemp < 10 || riskScore > 20;
        
        return {
            applicable: showWinterkillUI,
            risk: risk,
            severity: severity,
            riskScore: Math.round(riskScore),
            estimatedSurvival: Math.round(survivalPct * 100),
            minTemp: minTemp,
            minSoilTemp: minSoilTemp,
            hoursBelowCritical: hoursBelowCritical,
            hoursBelowWarning: hoursBelowWarning,
            variety: {
                name: variety,
                modifier: coldMod.winterkillRisk,
                confidence: coldMod.confidence,
                source: coldMod.source
            },
            recommendations: recommendations,
            thresholds: {
                critical: CLIMATE_V2_CONFIG.winterkill.criticalSoilTemp,
                warning: CLIMATE_V2_CONFIG.winterkill.warningSoilTemp
            }
        };
    }

    // ========================================================================
    // HEAT STRESS CALCULATION
    // ========================================================================

    /**
     * Calculate heat stress risk based on temperature forecast and variety
     */
    function calculateHeatStress(state, climateData) {
        const turf = state.turf || {};
        const species = turf.grassSpecies || 'couch';
        const variety = turf.variety || turf.cultivar;
        
        const isWarmSeason = isC4(species);
        const thresholds = isWarmSeason ? 
            CLIMATE_V2_CONFIG.heatStress.c4 : 
            CLIMATE_V2_CONFIG.heatStress.c3;
        
        // Get variety modifier
        const heatMod = getVarietyHeatDroughtModifier(species, variety);
        
        // Get temperature data
        const temps = extractTemperatureData(climateData);
        if (!temps || temps.length === 0) {
            return { error: 'No temperature data available' };
        }
        
        // Calculate heat stress metrics
        const maxTemp = Math.max(...temps.map(t => t.max));
        const avgMaxTemp = temps.reduce((sum, t) => sum + t.max, 0) / temps.length;
        
        // Night temperature stress (critical for C3)
        const nightTemps = temps.map(t => t.min);
        const avgNightTemp = nightTemps.reduce((a, b) => a + b, 0) / nightTemps.length;
        const hotsNights = nightTemps.filter(t => t > CLIMATE_V2_CONFIG.heatStress.nightTempStress).length;
        
        // Calculate stress score
        let stressScore = 0;
        
        // Daytime heat
        if (maxTemp >= thresholds.critical) {
            stressScore += 40;
        } else if (maxTemp >= thresholds.stress) {
            stressScore += 25;
        } else if (maxTemp >= thresholds.suboptimal) {
            // v10.9.9: Graduated scoring for proximity to stress threshold.
            // Xu & Huang (2001, Rutgers) showed root decline in bentgrass at 28°C.
            // Carrow (1996) documented photosynthetic inhibition above 28°C in C3.
            // Linear interpolation from suboptimal (10pts) to stress (25pts).
            var range = thresholds.stress - thresholds.suboptimal;
            var above = maxTemp - thresholds.suboptimal;
            var proximity = range > 0 ? above / range : 0;
            stressScore += 10 + Math.round(proximity * 15);
        } else if (avgMaxTemp >= thresholds.suboptimal) {
            stressScore += 10;
        }
        
        // Night temperature (especially for C3)
        if (!isWarmSeason) {
            if (avgNightTemp >= CLIMATE_V2_CONFIG.heatStress.nightTempCritical) {
                stressScore += 30;
            } else if (avgNightTemp >= CLIMATE_V2_CONFIG.heatStress.nightTempStress) {
                stressScore += 15;
            }
            stressScore += hotsNights * 3;
        }
        
        // Apply variety modifier
        stressScore = stressScore * heatMod.heatMultiplier;
        stressScore = clamp(stressScore, 0, 100);
        
        // Classification
        let stress, severity;
        if (stressScore < 15) {
            stress = 'minimal';
            severity = 'good';
        } else if (stressScore < 35) {
            stress = 'mild';
            severity = 'good';
        } else if (stressScore < 55) {
            stress = 'moderate';
            severity = 'watch';
        } else if (stressScore < 75) {
            stress = 'high';
            severity = 'concern';
        } else {
            stress = 'severe';
            severity = 'critical';
        }
        
        // Growth impact
        const growthImpact = stressScore > 50 ? 
            Math.round((stressScore - 50) * 1.5) : 0;
        
        // Recommendations
        const recommendations = [];
        if (!isWarmSeason && stressScore > 30) {
            recommendations.push('Increase mowing height to reduce stress');
            // Only recommend syringe if dew/disease risk isn't already high
            // Adding water when leaf wetness is already extended increases disease pressure
            const dewSeverity = window.GAIP_DEW_RESULT?.summary?.severity;
            const leafWetnessHours = window.GAIP_DEW_RESULT?.leafWetness?.totalWetHours || 0;
            if (dewSeverity !== 'severe' && leafWetnessHours < 30) {
                recommendations.push('Syringe midday to cool canopy (light irrigation)');
            } else {
                recommendations.push('⚠️ Avoid syringing - leaf wetness already extended (disease risk)');
            }
        }
        if (stressScore > 50) {
            recommendations.push('Reduce nitrogen applications during heat stress');
            recommendations.push('Limit traffic during peak heat hours (11am-4pm)');
        }
        if (!isWarmSeason && hotsNights >= 3) {
            recommendations.push('Night temperature stress detected - C3 recovery will be limited');
        }
        
        return {
            stress: stress,
            severity: severity,
            stressScore: Math.round(stressScore),
            maxTemp: maxTemp,
            avgMaxTemp: Math.round(avgMaxTemp * 10) / 10,
            avgNightTemp: Math.round(avgNightTemp * 10) / 10,
            hotNights: hotsNights,
            growthReduction: growthImpact,
            variety: {
                name: variety,
                modifier: heatMod.heatMultiplier,
                confidence: heatMod.confidence
            },
            thresholds: thresholds,
            isC3: !isWarmSeason,
            recommendations: recommendations
        };
    }

    // ========================================================================
    // DORMANCY & GREENUP FORECASTING
    // ========================================================================

    /**
     * Predict dormancy status and greenup timing
     */
    function calculateDormancyStatus(state, climateData) {
        const turf = state.turf || {};
        const species = turf.grassSpecies || 'couch';
        const variety = turf.variety || turf.cultivar;
        
        if (!isC4(species)) {
            return {
                applicable: false,
                reason: 'C3 grasses do not have true winter dormancy',
                status: 'active'
            };
        }
        
        // Get variety modifiers
        const coldMod = getVarietyColdModifier(species, variety);
        const greenupMod = getVarietyGreenupModifier(species, variety);
        
        // Get temperature data
        const temps = extractTemperatureData(climateData);
        if (!temps || temps.length === 0) {
            return { error: 'No temperature data available' };
        }
        
        // Current conditions — use current hour temp, not multi-day mean
        const _currentTemp = getCurrentHourTemp(climateData);
        const avgTemp = _currentTemp !== null ? _currentTemp :
            temps.reduce((sum, t) => sum + t.mean, 0) / temps.length;
        
        // Soil temp priority — b35fix139: sensor first, then canonical, then API data, then estimate
        let avgSoilTemp;
        let soilTempSource = 'estimated';

        // Priority 1: raw sensor reading from canonical state
        const _canonState = (typeof window !== 'undefined') ? window.GAIP_CANONICAL_STATE : null;
        if (_canonState?.sensor?.soilTemp != null) {
            avgSoilTemp = _canonState.sensor.soilTemp;
            soilTempSource = 'sensor';
        }
        // Priority 2: orchestrator-resolved soilTemp (sensor > API > physics cascade)
        else if (_canonState?.soilTemp?.mean != null) {
            avgSoilTemp = _canonState.soilTemp.mean;
            soilTempSource = _canonState.soilTemp.source || 'canonical';
        }
        // Priority 3: API soil temp from weather data
        else {
            const hasSoilData = temps.some(t => t.soilTemp !== undefined && t.soilTemp > 0);
            if (hasSoilData) {
                const validSoilTemps = temps.filter(t => t.soilTemp !== undefined && t.soilTemp > 0);
                avgSoilTemp = validSoilTemps.reduce((sum, t) => sum + t.soilTemp, 0) / validSoilTemps.length;
                soilTempSource = 'api';
            } else {
                // Priority 4: estimate from air temp
                const soilOffset = avgTemp > 20 ? 3 : (avgTemp < 10 ? -2 : 0);
                avgSoilTemp = avgTemp + soilOffset;
                soilTempSource = 'estimated';
            }
        }
        
        // Dormancy thresholds (adjusted by variety)
        const dormancyThreshold = CLIMATE_V2_CONFIG.dormancy.c4DormancySoilTemp * 
            (coldMod.dormancyModifier || 1.0);
        const greenupThreshold = CLIMATE_V2_CONFIG.dormancy.c4GreenupSoilTemp;
        
        // Determine status
        let status, statusDetail;
        let daysToTransition = null;
        
        // Determine actual season based on hemisphere and month
        // Default to Sydney (-33.87) if no latitude provided
        const lat = state.climate?.lat || state.location?.lat || -33.87;
        const isSouthernHemisphere = lat < 0;
        const month = new Date().getMonth(); // 0-11
        
        // Southern hemisphere: Dec-Feb = summer, Jun-Aug = winter
        // Northern hemisphere: Dec-Feb = winter, Jun-Aug = summer
        let actualSeason;
        if (month >= 11 || month <= 1) { // Dec, Jan, Feb
            actualSeason = isSouthernHemisphere ? 'summer' : 'winter';
        } else if (month >= 2 && month <= 4) { // Mar, Apr, May
            actualSeason = isSouthernHemisphere ? 'autumn' : 'spring';
        } else if (month >= 5 && month <= 7) { // Jun, Jul, Aug
            actualSeason = isSouthernHemisphere ? 'winter' : 'summer';
        } else { // Sep, Oct, Nov
            actualSeason = isSouthernHemisphere ? 'spring' : 'autumn';
        }
        
        
        // Active growth - soil temp well above greenup threshold
        // b35fix139: in autumn/winter, override 'active' to 'transitional' so dormancy card shows
        if (avgSoilTemp >= greenupThreshold + 5) {
            if (actualSeason === 'autumn' || actualSeason === 'winter') {
                status = 'transitional';
                statusDetail = 'Heading toward dormancy, soil temperatures still warm';
            } else {
                status = 'active';
                statusDetail = 'Full growth - soil temperatures optimal';
            }
        } else if (avgSoilTemp >= greenupThreshold) {
            // Use correct status based on season
            if (actualSeason === 'summer') {
                status = 'active';
                statusDetail = 'Summer growth - soil temperatures adequate';
            } else if (actualSeason === 'spring') {
                status = 'greening';
                statusDetail = 'Spring greenup in progress';
            } else if (actualSeason === 'autumn') {
                status = 'transitional';
                statusDetail = 'Heading toward dormancy, monitor soil temperature trend';
            } else {
                status = 'greening';
                statusDetail = 'Late winter warmth - early greenup possible';
            }
        } else if (avgSoilTemp >= dormancyThreshold) {
            status = 'transitional';

            // b35fix463 (C67): trend formula and unit grounding fixed.
            //
            // Pre-fix formula was (last.mean - first.mean) / temps.length, which
            // is wrong on three counts:
            //   1. Dimensionally incoherent. N daily samples define N-1 intervals,
            //      so per-day change is delta / (N-1), not / N. Off-by-N error
            //      shrinks trend by a factor of N then inflates day-count by N.
            //   2. Trends on air temp (temps[i].mean) but extrapolates soil temp
            //      distance to threshold. Soil temperature tracks air temperature
            //      with attenuated amplitude and a lag; daily soil-temp change is
            //      typically 0.5-0.7x daily air-temp change at 0-10 cm depth
            //      (Hillel 1998, Environmental Soil Physics, p.318-322; Carson 1961,
            //      Soil temperature and weather conditions, ANL-6470).
            //   3. No bound on extrapolation horizon. A near-flat short-window
            //      trend (e.g. 13.7 to 13.5 deg C over 7 days) produced absurd
            //      projections (~240 days) that crossed seasons and ignored the
            //      seasonal cycle dominating beyond a few weeks.
            //
            // Production evidence: Santa Ana couch, Bowral SH autumn, sensor soil
            // temp 14 deg C, flat 7-day air-temp forecast, rendered "dormancy
            // expected in ~240 days". Correct projection at this latitude and
            // season is in the order of 10-30 days.
            //
            // Fix shape:
            //   - Prefer soil-temp daily series when populated (forecast API
            //     surfaces hourly soil_temperature_0_to_7cm which aggregateHourlyTemps
            //     rolls into temps[i].soilTemp). Use it directly.
            //   - Fall back to air-temp series scaled by AIR_TO_SOIL_COUPLING
            //     when soilTemp is absent (sensor-only or daily-API without soil).
            //   - Divide by (N-1) intervals not N samples.
            //   - Require minimum trend magnitude 0.1 deg C/day before reporting
            //     a number; below that the short-window forecast cannot
            //     reliably project a transition direction.
            //   - Cap at 60 days. Beyond two months the seasonal cycle (annual
            //     soil-temp wave with amplitude 5-12 deg C at 10 cm in
            //     temperate zones, Hillel 1998 p.319) dominates over the
            //     short-window linear trend; reporting a longer projection
            //     implies precision the model does not have.
            //
            // C67 in turn fed into adjacent C-entries logged in the ledger;
            // the C67 close is the dimensional and bounds fix only. A multi-week
            // climate-normal blend that respects full seasonality is logged
            // separately for future engine refinement.
            daysToTransition = _projectDaysToSoilTempThreshold(temps, avgSoilTemp,
                actualSeason === 'autumn' || actualSeason === 'winter'
                    ? dormancyThreshold : greenupThreshold,
                actualSeason === 'autumn' || actualSeason === 'winter'
                    ? 'cooling' : 'warming');

            if (actualSeason === 'autumn' || actualSeason === 'winter') {
                statusDetail = 'Heading toward dormancy';
                if (daysToTransition !== null) {
                    statusDetail += `, dormancy expected in ~${daysToTransition} days`;
                }
            } else {
                statusDetail = 'Between dormancy and active growth';
                if (daysToTransition !== null) {
                    statusDetail += `, greenup expected in ~${daysToTransition} days`;
                }
            }
        } else {
            status = 'dormant';
            statusDetail = 'Winter dormancy - soil temperature below threshold';
        }
        
        // Calculate GDD for greenup prediction
        let gdd = 0;
        for (const day of temps) {
            const dailyGDD = Math.max(0, day.mean - CLIMATE_V2_CONFIG.dormancy.gddBaseC4);
            gdd += dailyGDD;
        }
        
        const gddToGreenup = CLIMATE_V2_CONFIG.dormancy.gddGreenupThreshold - gdd;
        const greenupProgress = Math.min(100, Math.round((gdd / CLIMATE_V2_CONFIG.dormancy.gddGreenupThreshold) * 100));
        
        // Adjust for variety
        const adjustedDaysEarlier = greenupMod.daysEarlier || 0;
        
        // Show dormancy card if not in full active summer growth
        // In autumn/winter always show — even warm soil is heading toward dormancy
        const showDormancyUI = status !== 'active' || 
            actualSeason === 'autumn' || actualSeason === 'winter';
        
        return {
            applicable: showDormancyUI,
            status: status,
            statusDetail: statusDetail,
            avgSoilTemp: Math.round(avgSoilTemp * 10) / 10,
            avgAirTemp: Math.round(avgTemp * 10) / 10,
            soilTempSource: soilTempSource,
            dormancyThreshold: dormancyThreshold,
            greenupThreshold: greenupThreshold,
            gdd: Math.round(gdd),
            gddToGreenup: Math.max(0, Math.round(gddToGreenup)),
            greenupProgress: greenupProgress,
            daysToTransition: daysToTransition,
            actualSeason: actualSeason,
            headingToDormancy: (actualSeason === 'autumn' || actualSeason === 'winter'),
            variety: {
                name: variety,
                daysEarlier: adjustedDaysEarlier,
                dormancyModifier: coldMod.dormancyModifier,
                confidence: greenupMod.confidence || coldMod.confidence,
                note: adjustedDaysEarlier > 0 ? 
                    `${variety} typically greens up ${adjustedDaysEarlier} days earlier than standard` : null
            }
        };
    }

    // ========================================================================
    // DROUGHT STRESS CALCULATION
    // ========================================================================

    /**
     * Calculate drought stress with variety modifiers
     * Accounts for dormancy - dormant grass has minimal water needs
     * Accounts for overseed - if C3 overseed is active, it needs water even if C4 base is dormant
     * Uses seasonal calendar to determine if overseed is actually present
     */
    function calculateDroughtStress(state, climateData) {
        const turf = state.turf || {};
        const species = turf.grassSpecies || 'couch';
        const variety = turf.variety || turf.cultivar;
        const coolOverseed = turf.coolOverseed;
        
        // Get variety modifier
        const droughtMod = getVarietyHeatDroughtModifier(species, variety);
        
        // Get temperature to assess growth/dormancy status
        const temps = extractTemperatureData(climateData);
        // FIX v10.9.5: use current hour temp, not multi-day mean
        const _curTemp = getCurrentHourTemp(climateData);
        const avgTemp = _curTemp !== null ? _curTemp :
            (temps && temps.length > 0 ?
                temps.reduce((sum, t) => sum + (t.mean || ((t.max + t.min) / 2)), 0) / temps.length :
                null);
        
        // Calculate growth potential for both C3 and C4 components
        const isWarmSeason = isC4(species);
        let gpC4 = 50, gpC3 = 50; // Defaults
        
        if (avgTemp !== null) {
            const GPE = global.GilbaGrowthPotentialEngine;
            gpC4 = GPE ? (GPE.compute(avgTemp, { model: 'pace', species: 'c4' }) ?? 0) * 100 : 0;
            gpC3 = GPE ? (GPE.compute(avgTemp, { model: 'pace', species: 'c3' }) ?? 0) * 100 : 0;
        }
        
        // Determine if overseed is actually present based on season
        // In summer (Dec-Jan in Southern Hemisphere), overseed is DEAD regardless of setting
        const currentMonth = new Date().getMonth() + 1; // 1-12
        const overseedCalendar = {
            12: 'dead', 1: 'dead',  // Summer - overseed gone
            2: 'establishing', 3: 'establishing',  // Autumn - new overseed
            4: 'established', 5: 'dominant', 6: 'dominant', 7: 'dominant', 8: 'dominant',  // Winter
            9: 'fading', 10: 'fading', 11: 'dying'  // Spring - overseed dying
        };
        const overseedStatus = overseedCalendar[currentMonth] || 'dead';
        const overseedIsPresent = coolOverseed && ['establishing', 'established', 'dominant', 'fading'].includes(overseedStatus);
        
        // Determine effective growth potential based on species mix
        let effectiveGP;
        let hasActiveOverseed = false;
        
        if (isWarmSeason && overseedIsPresent) {
            // C4 base with active C3 overseed - use the HIGHER of the two
            // If C3 overseed is active, water is needed even if C4 is dormant
            effectiveGP = Math.max(gpC4, gpC3);
            hasActiveOverseed = gpC3 > 30; // C3 overseed is actively growing
        } else if (isWarmSeason) {
            // Pure C4 (no overseed or overseed is dead)
            effectiveGP = gpC4;
        } else {
            effectiveGP = gpC3;
        }
        
        // If grass is dormant, drought stress is not applicable
        const isDormant = effectiveGP < 20;
        
        if (isDormant) {
            return {
                stress: 'none',
                severity: 'good',
                stressScore: 0,
                soilMoisture: state.soil?.moisture,
                weeklyET: 0,
                weeklyPrecip: 0,
                etDeficit: 0,
                isDormant: true,
                growthPotential: Math.round(effectiveGP),
                gpC3: Math.round(gpC3),
                gpC4: Math.round(gpC4),
                overseedStatus: overseedStatus,
                hasActiveOverseed: false,
                variety: {
                    name: variety,
                    modifier: droughtMod.droughtMultiplier,
                    confidence: droughtMod.confidence
                },
                recommendations: [],
                note: 'Grass is dormant - minimal water requirements'
            };
        }
        
        // Get soil moisture data
        const soilMoisture = state.soil?.moisture || state.irrigation?.soilMoisture;
        
        // Get ET deficit - scale by growth potential
        const etData = extractETData(climateData);
        const precipitation = extractPrecipitation(climateData);
        
        // Base ET scales with effective growth potential
        const baseET = etData?.weeklyTotal || 35;
        const scaledET = baseET * (effectiveGP / 100);
        
        const weeklyPrecip = precipitation?.weeklyTotal || 0;
        const etDeficit = Math.max(0, scaledET - weeklyPrecip);
        
        // Calculate stress score
        let stressScore = 0;
        
        // Soil moisture component
        if (soilMoisture !== undefined) {
            if (soilMoisture < CLIMATE_V2_CONFIG.drought.wilting) {
                stressScore += 50;
            } else if (soilMoisture < CLIMATE_V2_CONFIG.drought.stressed) {
                stressScore += 30;
            } else if (soilMoisture < CLIMATE_V2_CONFIG.drought.adequate) {
                stressScore += 15;
            }
        }
        
        // ET deficit component (only significant if grass is actively growing)
        if (effectiveGP > 30) {
            if (etDeficit >= CLIMATE_V2_CONFIG.drought.severeDeficit) {
                stressScore += 40;
            } else if (etDeficit >= CLIMATE_V2_CONFIG.drought.moderateDeficit) {
                stressScore += 25;
            } else if (etDeficit >= CLIMATE_V2_CONFIG.drought.mildDeficit) {
                stressScore += 10;
            }
        }
        
        // Apply variety modifier (lower multiplier = more drought tolerant)
        stressScore = stressScore * droughtMod.droughtMultiplier;
        stressScore = clamp(stressScore, 0, 100);
        
        // Classification
        let stress, severity;
        if (stressScore < 15) {
            stress = 'none';
            severity = 'good';
        } else if (stressScore < 35) {
            stress = 'mild';
            severity = 'good';
        } else if (stressScore < 55) {
            stress = 'moderate';
            severity = 'watch';
        } else if (stressScore < 75) {
            stress = 'severe';
            severity = 'concern';
        } else {
            stress = 'critical';
            severity = 'critical';
        }
        
        // Build recommendations - adjust for overseed situation
        let recommendations = [];
        if (stressScore > 30) {
            if (hasActiveOverseed) {
                recommendations = [
                    'Maintain irrigation for active overseed',
                    'C3 overseed requires water even though C4 base is dormant',
                    'Reduce traffic on stressed areas'
                ];
            } else {
                recommendations = [
                    'Increase irrigation frequency',
                    'Raise mowing height',
                    'Reduce traffic on stressed areas'
                ];
            }
        }
        
        return {
            stress: stress,
            severity: severity,
            stressScore: Math.round(stressScore),
            soilMoisture: soilMoisture,
            weeklyET: Math.round(scaledET * 10) / 10,
            weeklyPrecip: Math.round(weeklyPrecip * 10) / 10,
            etDeficit: Math.round(etDeficit * 10) / 10,
            isDormant: false,
            growthPotential: Math.round(effectiveGP),
            gpC3: Math.round(gpC3),
            gpC4: Math.round(gpC4),
            overseedStatus: overseedStatus,
            hasActiveOverseed: hasActiveOverseed,
            variety: {
                name: variety,
                modifier: droughtMod.droughtMultiplier,
                confidence: droughtMod.confidence
            },
            recommendations: recommendations
        };
    }

    // ========================================================================
    // ENHANCED GROWTH POTENTIAL
    // ========================================================================

    /**
     * Calculate growth potential with variety adjustments
     * Extends base climate engine growth potential
     * v2.1.3: Now uses getEffectiveSpecies() to respect overseed when >50% C3
     */
    function calculateEnhancedGrowthPotential(state, climateData) {
        const turf = state.turf || {};
        
        // v2.1.3: Use effective species - may be overseed if >50% C3 cover
        const effective = getEffectiveSpecies(turf);
        const species = effective.species;
        const variety = effective.variety || turf.variety || turf.cultivar;
        
        // Get temperature data
        const temps = extractTemperatureData(climateData);
        if (!temps || temps.length === 0) {
            return { error: 'No temperature data available' };
        }
        
        // Calculate base growth potential (PACE Turf model)
        const isWarm = isC4(species);
        const dailyGP = temps.map(t => {
            if (isWarm) {
                return calculateC4GrowthPotential(t.mean);
            } else {
                return calculateC3GrowthPotential(t.mean);
            }
        });
        
        const avgGP = dailyGP.reduce((a, b) => a + b, 0) / dailyGP.length;
        
        // Get stress modifiers
        const heatMod = getVarietyHeatDroughtModifier(species, variety);
        const coldMod = getVarietyColdModifier(species, variety);
        
        // Apply variety adjustment
        // Better heat tolerance = less GP reduction at high temps
        // Better cold tolerance = higher GP at low temps
        let varietyAdjustment = 1.0;
        
        // FIX v10.9.5: use current hour temp for variety adjustment, not multi-day mean
        const _curTempEGP = getCurrentHourTemp(climateData);
        const avgTemp = _curTempEGP !== null ? _curTempEGP :
            temps.reduce((sum, t) => sum + t.mean, 0) / temps.length;

        if (isWarm && avgTemp > 35) {
            // Heat stress - better heat tolerance helps
            varietyAdjustment = 1 + (1 - heatMod.heatMultiplier) * 0.2;
        } else if (isWarm && avgTemp < 15) {
            // Cold stress - better cold tolerance helps
            varietyAdjustment = 1 + (1 - coldMod.winterkillRisk) * 0.3;
        } else if (!isWarm && avgTemp > 27) {
            // C3 heat stress
            varietyAdjustment = 1 + (1 - heatMod.heatMultiplier) * 0.25;
        }
        
        const adjustedGP = avgGP * varietyAdjustment;
        
        return {
            baseGrowthPotential: Math.round(avgGP * 100),
            adjustedGrowthPotential: Math.round(adjustedGP * 100),
            dailyGrowthPotential: dailyGP.map(gp => Math.round(gp * 100)),
            varietyAdjustment: Math.round(varietyAdjustment * 100) / 100,
            avgTemp: Math.round(avgTemp * 10) / 10,
            species: species,
            isC4: isWarm,
            isOverseed: effective.isOverseed || false,
            baseSpecies: effective.baseSpecies || turf.grassSpecies,
            variety: {
                name: variety,
                heatModifier: heatMod.heatMultiplier,
                coldModifier: coldMod.winterkillRisk,
                confidence: heatMod.confidence || coldMod.confidence
            }
        };
    }

    function calculateC4GrowthPotential(tempC) {
        if (tempC <= 0 || tempC >= 45) return 0;
        const GPE = global.GilbaGrowthPotentialEngine;
        const gp = GPE ? GPE.compute(tempC, { model: 'pace', species: 'c4' }) : null;
        return gp != null ? Math.max(0, Math.min(1, gp)) : 0;
    }

    function calculateC3GrowthPotential(tempC) {
        if (tempC <= -5 || tempC >= 40) return 0;
        const GPE = global.GilbaGrowthPotentialEngine;
        const gp = GPE ? GPE.compute(tempC, { model: 'pace', species: 'c3' }) : null;
        return gp != null ? Math.max(0, Math.min(1, gp)) : 0;
    }

    // ========================================================================
    // DATA EXTRACTION HELPERS
    // ========================================================================

    // FIX v10.9.5: Get current hour temperature from rawWeatherData.
    // Climate V2 was using a multi-day mean (~19°C overnight-dragged) for GP
    // calculations, producing gpC3=99% for bentgrass at 30°C. Use the same
    // rawWeatherData source that hub-tissue getAverageTemperature uses.
    function getCurrentHourTemp(climateData) {
        var src = (typeof window !== 'undefined' && window.rawWeatherData) ? window.rawWeatherData : climateData;
        if (src && src.forecast && src.forecast.hourly && src.forecast.hourly.temperature_2m) {
            var temps = src.forecast.hourly.temperature_2m;
            var nowHour = new Date().getHours();
            if (nowHour < temps.length && temps[nowHour] != null) return temps[nowHour];
            // Fallback: first non-null value today
            for (var i = 0; i < Math.min(24, temps.length); i++) {
                if (temps[i] != null) return temps[i];
            }
        }
        return null;
    }

    // b35fix463 (C67): dimensional-grounded projection of days from current
    // soil temperature to a transition threshold (dormancy or greenup).
    //
    // Inputs:
    //   temps:           daily array from extractTemperatureData; each entry
    //                    carries .mean (air mean) and optionally .soilTemp
    //   currentSoilTemp: resolved sensor-or-orchestrator-or-api soil temp value
    //   threshold:       target soil temperature
    //   direction:       'cooling' (autumn/winter dormancy) or 'warming'
    //                    (spring greenup); sets sign expectation on trend
    //
    // Returns: integer days (1..PROJECTION_HORIZON_DAYS) when projection is
    //          reliable; null when trend too weak, wrong direction, or
    //          horizon exceeded.
    //
    // Why a helper rather than inline math: the dimensional-grounding +
    // bounds + air-to-soil fallback collectively are non-trivial; inlining
    // them at two near-identical call sites in calculateDormancyStatus is
    // the read-shelf-asymmetry bug class (lessons #33 and #45 banked).
    function _projectDaysToSoilTempThreshold(temps, currentSoilTemp, threshold, direction) {
        // Need at least 4 daily samples for a usable short-window trend.
        // Below this the slope is dominated by single-day noise.
        if (!temps || temps.length < 4) {
            return null;
        }

        // Prefer soil-temp daily series when populated. aggregateHourlyTemps
        // pushes soilTemp values from forecast hourly soil_temperature_0_to_7cm
        // when present; absent on manual entry, daily-API-only paths, and
        // some sensor-fed runs where only the current reading exists.
        const soilDaily = temps.filter(t =>
            t && typeof t.soilTemp === 'number' && t.soilTemp > 0);

        let dailyChange;
        let trendSource;
        if (soilDaily.length >= 4) {
            // (last - first) / (N-1) intervals. Direct soil-temp trend, no
            // coupling assumption needed.
            const span = soilDaily.length - 1;
            dailyChange = (soilDaily[soilDaily.length - 1].soilTemp - soilDaily[0].soilTemp) / span;
            trendSource = 'soil-direct';
        } else {
            // Air-temp fallback. Scale by AIR_TO_SOIL_COUPLING (0.6, conservative;
            // see comment in calculateDormancyStatus). Same (N-1) denominator.
            const span = temps.length - 1;
            const airChange = (temps[temps.length - 1].mean - temps[0].mean) / span;
            const AIR_TO_SOIL_COUPLING = 0.6;
            dailyChange = airChange * AIR_TO_SOIL_COUPLING;
            trendSource = 'air-scaled';
        }

        // Minimum trend magnitude. Below 0.1 deg C/day the short-window
        // forecast cannot reliably project direction; report no number
        // rather than an inflated one.
        const MIN_TREND_MAGNITUDE = 0.1;
        if (Math.abs(dailyChange) < MIN_TREND_MAGNITUDE) {
            return null;
        }

        // Direction gate. In autumn/winter we want a cooling trend; in
        // spring we want a warming trend. Wrong-direction trend means the
        // forecast contradicts the season's expected trajectory; suppress
        // the day-count rather than report a negative or absurd projection.
        if (direction === 'cooling' && dailyChange >= 0) return null;
        if (direction === 'warming' && dailyChange <= 0) return null;

        // Distance to threshold along the expected direction.
        const distance = direction === 'cooling'
            ? currentSoilTemp - threshold
            : threshold - currentSoilTemp;
        if (distance <= 0) return null;

        const rawDays = Math.ceil(distance / Math.abs(dailyChange));

        // Horizon cap. Beyond 60 days the annual soil-temperature wave
        // (Hillel 1998 p.319) dominates over the short-window linear trend.
        const PROJECTION_HORIZON_DAYS = 60;
        if (rawDays > PROJECTION_HORIZON_DAYS) return null;
        if (rawDays < 1) return 1;
        // trendSource intentionally not surfaced on return value to keep
        // the public shape unchanged; available for future UI annotation.
        void trendSource;
        return rawDays;
    }

    function extractTemperatureData(climateData) {
        // Handle different data formats from climateData first
        if (climateData) {
            if (climateData.temperature?.daily) {
                return climateData.temperature.daily;
            }
            
            if (climateData.daily) {
                const daily = climateData.daily;
                const dates = daily.time || daily.dates || [];
                return dates.map((date, i) => ({
                    date: date,
                    max: daily.temperature_2m_max?.[i] || daily.tempMax?.[i] || 25,
                    min: daily.temperature_2m_min?.[i] || daily.tempMin?.[i] || 15,
                    mean: daily.temperature_2m_mean?.[i] || 
                          ((daily.temperature_2m_max?.[i] || 25) + (daily.temperature_2m_min?.[i] || 15)) / 2,
                    soilTemp: daily.soil_temperature_0cm?.[i] || daily.soilTemp?.[i]
                }));
            }
            
            if (climateData.forecast?.hourly) {
                // Aggregate hourly to daily
                return aggregateHourlyTemps(climateData.forecast.hourly);
            }
        }
        
        // Fallback: Handle manual weather data from window.climateMetrics
        if (window.climateMetrics?.temperature) {
            const temp = window.climateMetrics.temperature;
            const today = new Date().toISOString().split('T')[0];
            // Create a single-day entry from manual data
            return [{
                date: today,
                max: temp.max || 25,
                min: temp.min || 15,
                mean: temp.mean || ((temp.max || 25) + (temp.min || 15)) / 2,
                soilTemp: temp.soil || undefined
            }];
        }
        
        return null;
    }

    function extractHourlyTemps(climateData) {
        if (climateData?.forecast?.hourly?.temperature_2m) {
            return climateData.forecast.hourly.temperature_2m;
        }
        if (climateData?.forecast?.hourly?.soil_temperature_0_to_7cm) {
            return climateData.forecast.hourly.soil_temperature_0_to_7cm;
        }
        return null;
    }

    function aggregateHourlyTemps(hourly) {
        if (!hourly?.time) return null;
        
        const daily = [];
        let currentDate = null;
        let dayTemps = [];
        let daySoilTemps = [];
        
        for (let i = 0; i < hourly.time.length; i++) {
            const dateStr = hourly.time[i].split('T')[0];
            
            if (dateStr !== currentDate) {
                if (currentDate !== null && dayTemps.length > 0) {
                    daily.push({
                        date: currentDate,
                        max: Math.max(...dayTemps),
                        min: Math.min(...dayTemps),
                        mean: dayTemps.reduce((a, b) => a + b, 0) / dayTemps.length,
                        soilTemp: daySoilTemps.length > 0 ? 
                            daySoilTemps.reduce((a, b) => a + b, 0) / daySoilTemps.length : undefined
                    });
                }
                currentDate = dateStr;
                dayTemps = [];
                daySoilTemps = [];
            }
            
            if (hourly.temperature_2m?.[i] !== undefined) {
                dayTemps.push(hourly.temperature_2m[i]);
            }
            if (hourly.soil_temperature_0_to_7cm?.[i] !== undefined) {
                daySoilTemps.push(hourly.soil_temperature_0_to_7cm[i]);
            }
        }
        
        // Add last day
        if (currentDate !== null && dayTemps.length > 0) {
            daily.push({
                date: currentDate,
                max: Math.max(...dayTemps),
                min: Math.min(...dayTemps),
                mean: dayTemps.reduce((a, b) => a + b, 0) / dayTemps.length,
                soilTemp: daySoilTemps.length > 0 ? 
                    daySoilTemps.reduce((a, b) => a + b, 0) / daySoilTemps.length : undefined
            });
        }
        
        return daily;
    }

    function extractETData(climateData) {
        if (climateData?.et) return climateData.et;
        if (climateData?.daily?.et0_fao_evapotranspiration) {
            const et = climateData.daily.et0_fao_evapotranspiration;
            return {
                daily: et,
                weeklyTotal: et.slice(0, 7).reduce((a, b) => a + b, 0)
            };
        }
        return null;
    }

    function extractPrecipitation(climateData) {
        if (climateData?.precipitation) return climateData.precipitation;
        if (climateData?.daily?.precipitation_sum) {
            const precip = climateData.daily.precipitation_sum;
            return {
                daily: precip,
                weeklyTotal: precip.slice(0, 7).reduce((a, b) => a + b, 0)
            };
        }
        return null;
    }

    // ========================================================================
    // MAIN ENGINE FUNCTION
    // ========================================================================

    /**
     * Comprehensive climate analysis with variety modifiers
     * @param {object} state - Hub state object
     * @param {object} climateData - Climate engine output or raw forecast
     * @returns {object} Enhanced climate analysis
     */
    function climateModuleV2(state, climateData) {
        if (!state) {
            return { error: 'No state provided' };
        }
        
        const turf = state.turf || {};
        
        // Get effective species - may be overseed if >50% C3 cover
        const effectiveSpecies = getEffectiveSpecies(turf);
        const species = effectiveSpecies.species;
        const variety = effectiveSpecies.variety;
        
        // Store original state species for reference
        const originalState = { ...state };
        
        // Create modified state with effective species for sub-analyses
        const analysisState = {
            ...state,
            turf: {
                ...turf,
                grassSpecies: species,
                variety: variety
            }
        };
        
        // Run all analyses with effective species
        const winterkill = calculateWinterkillRisk(analysisState, climateData);
        const heatStress = calculateHeatStress(analysisState, climateData);
        const dormancy = calculateDormancyStatus(analysisState, climateData);
        const drought = calculateDroughtStress(analysisState, climateData);
        const growthPotential = calculateEnhancedGrowthPotential(analysisState, climateData);
        
        // Determine primary stress driver
        let primaryStress = 'none';
        let primarySeverity = 'good';
        
        const stressScores = [
            { type: 'winterkill', score: winterkill.riskScore || 0, severity: winterkill.severity },
            { type: 'heat', score: heatStress.stressScore || 0, severity: heatStress.severity },
            { type: 'drought', score: drought.stressScore || 0, severity: drought.severity }
        ];
        
        const maxStress = stressScores.reduce((max, s) => s.score > max.score ? s : max, stressScores[0]);
        if (maxStress.score > 30) {
            primaryStress = maxStress.type;
            primarySeverity = maxStress.severity;
        }
        
        return {
            version: CLIMATE_V2_CONFIG.version,
            species: species,
            variety: variety,
            isOverseed: effectiveSpecies.isOverseed,
            baseSpecies: effectiveSpecies.baseSpecies,
            
            // Individual analyses
            winterkill: winterkill,
            heatStress: heatStress,
            dormancy: dormancy,
            drought: drought,
            growthPotential: growthPotential,
            
            // Summary
            primaryStress: primaryStress,
            primarySeverity: primarySeverity,
            
            // Combined variety impact
            varietyImpact: {
                coldTolerance: getVarietyColdModifier(species, variety),
                heatDrought: getVarietyHeatDroughtModifier(species, variety),
                springGreenup: getVarietyGreenupModifier(species, variety)
            },
            
            timestamp: new Date().toISOString()
        };
    }

    // ========================================================================
    // EXPORTS
    // ========================================================================

    const ClimateModuleV2 = {
        version: CLIMATE_V2_CONFIG.version,
        
        // Main entry
        analyze: climateModuleV2,
        
        // Individual calculations
        calculateWinterkillRisk: calculateWinterkillRisk,
        calculateHeatStress: calculateHeatStress,
        calculateDormancyStatus: calculateDormancyStatus,
        calculateDroughtStress: calculateDroughtStress,
        calculateEnhancedGrowthPotential: calculateEnhancedGrowthPotential,
        
        // Variety modifiers
        getVarietyColdModifier: getVarietyColdModifier,
        getVarietyHeatDroughtModifier: getVarietyHeatDroughtModifier,
        getVarietyGreenupModifier: getVarietyGreenupModifier,
        
        // Growth potential
        calculateC3GrowthPotential: calculateC3GrowthPotential,
        calculateC4GrowthPotential: calculateC4GrowthPotential,
        
        // Configuration
        config: CLIMATE_V2_CONFIG,
        
        // Utilities
        isC4: isC4,
        isC3: isC3,
        getSpeciesKey: getSpeciesKey,

        // b35fix463 (C67): expose dormancy/greenup day-count projection helper
        // for regression test grip without re-orchestrating full state +
        // climateData fixtures.
        _projectDaysToSoilTempThreshold: _projectDaysToSoilTempThreshold
    };

    // Export
    if (typeof module !== 'undefined' && module.exports) {
        module.exports = ClimateModuleV2;
    }
    
    global.GAIP_ClimateV2 = ClimateModuleV2;
    global.gaip_climate_v2 = climateModuleV2;

})(typeof window !== 'undefined' ? window : this);

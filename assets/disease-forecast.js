/**
 * ============================================================================
 * GILBA DISEASE FORECAST v1.5.4
 * ============================================================================
 * 
 * v1.5.4 - Fix species resolution: use grassSpecies as base, not effectiveSpecies
 *   - Integrate SpeciesController when available
 *   - Fixes overseed not being detected (base was already set to effective)
 *   - Base species = dropdown selection, effective = calculated from overseed
 *
 * v1.5.3 - Add helminthosporium to beta disease list
 *   - helminthosporium now flagged as beta alongside others
 *   - Complete beta list: Bipolaris, Curvularia, Drechslera, Waitea, Helminthosporium
 *
 * v1.5.2 - Add Waitea Patch to beta disease list
 *   - GAIP_STATE.turf.species now checked FIRST (updated by TurfProfileController)
 *   - DOM dropdown checked second (may have stale value during state transitions)
 *   - Fixes needing to run analysis twice after species change
 *   - Stores resolved species in GAIP_DISEASE_FORECAST for validation
 *
 * v1.5.0 - Store forecast peak data in global for dashboard access
 *   - Stores window.GAIP_DISEASE_FORECAST with full forecast data
 *   - Dashboard can now show "current → peak" trajectory
 *   - Peak risk and peak day accessible for at-a-glance view
 *
 * v1.4.5 - Fix overseed detection: check turf.effectiveSpecies FIRST
 *   - hub-tissue-v3.js sets turf.effectiveSpecies when overseed is dominant (>50% C3)
 *   - This is set during state building, before async overseed state updates
 *   - Now checks turf.effectiveSpecies as PRIORITY 1 for C4 base scenarios
 *   - Falls back to GAIP_OVERSEED_STATE and DOM dropdown as PRIORITY 2
 *   - Fixes 55% ryegrass on couch base showing couch diseases on first run
 *
 * v1.4.4 - Fix overseed detection for C4 base + overseed scenarios
 *   - When base is C4 (Couch), turf.coolOverseed is cleared by hub-tissue-v3.js
 *   - Now checks GAIP_OVERSEED_STATE.overseedSpecies (set by overseed-climate-integration)
 *   - Also checks DOM dropdown .gaip-cool-overseed directly as fallback
 *   - Respects summer intent: "maintain" uses overseed species even at 30%+ C3
 *
 * v1.4.3 - Fix species resolution when switching to C4 species
 *   - When overseedState.baseSpecies is C4 but turf.grassSpecies is still C3,
 *     trust the overseedState as the more current value
 *   - Fixes needing to run analysis twice when switching from Ryegrass to Couch
 *
 * v1.4.2 - Fix stale species when overseed state doesn't match current selection
 *   - Validates overseedState.baseSpecies matches current turf.grassSpecies
 *   - Also validates isC4Base flag consistency
 *   - Prevents using stale effectiveSpecies when species dropdown changed
 *   - Now correctly uses base species on first Run after species change
 *
 * v1.4.1 - Fix stale species after switching turf types
 *   - Checks GAIP_OVERSEED_STATE.stage before using effectiveSpecies
 *   - When stage is "none", uses base species directly to avoid stale data
 *   - Prevents needing to run analysis twice after species change
 *
 * v1.4.0 - Respects effective species when overseed is dominant (>50% C3)
 *   - Uses turf.effectiveSpecies for disease susceptibility when overseed dominant
 *   - Ensures disease forecast matches orchestrator species resolution
 *
 * v1.3.0 - Consecutive day multiplier + Soil temp estimate
 *   - Pythium/Brown Patch/GLS: Risk amplifies when conditions persist 2+ days
 *   - Soil temp estimate: 3-day rolling avg accounts for thermal mass lag
 *   - More accurate "building pressure" detection
 *
 * v1.2.0 - Pythium night temp threshold aligned with Nutter-Shane (1983)
 *   - Night temp gate: 18°C → 20°C per validated research
 *
 * v1.1.0 - Aligned Pythium model with disease-engine.js PythiumModel
 *   - Same 40/20/40 weighting for night temp, day temp, humidity
 *   - Humidity gate: <80% = 0 contribution, 80-90% = 0.5, ≥90% = 1.0
 *   - Removed nitrogen modifier (not a major Pythium factor)
 *
 * Extends the Disease Engine to provide daily risk forecasts for timeline
 * visualization. Uses the same disease models but applies them to each
 * forecast day's climate data.
 * 
 * INTEGRATION:
 * - Reads daily climate data from climateMetrics.temperature.dailyPattern
 * - Calls disease models for each day
 * - Returns forecast array suitable for GilbaCharts.createDiseaseTimeline()
 * 
 * @requires disease-engine.js
 * @requires gilba-charts.js
 * @version 1.4.2
 * @date January 2026
 * @author Gilba Solutions
 * ============================================================================
 */

var DiseaseForecast = (function() {
    'use strict';

    // =========================================================================
    // CONFIGURATION
    // =========================================================================

    var CONFIG = {
        // Maximum diseases to show in chart (reduced from 5 to avoid clutter)
        maxDiseases: 4,
        
        // Minimum risk to include disease in forecast
        minRiskThreshold: 15,
        
        // Default forecast days if not available from climate
        defaultForecastDays: 7,
        
        // Colours for diseases - high contrast, distinct hues
        colors: [
            '#2563eb',  // Blue (primary threat)
            '#dc2626',  // Red (secondary)
            '#059669',  // Teal/Green (tertiary)
            '#d97706'   // Orange (quaternary)
        ]
    };

    // =========================================================================
    // CONSECUTIVE DAY MULTIPLIER
    // =========================================================================
    // Some diseases require sustained favorable conditions. Risk amplifies when
    // conditions remain favorable across consecutive days.
    //
    // Research basis:
    // - Pythium: "sustained hot, humid nights" - Penn State
    // - Gray Leaf Spot: "consecutive nights >95% RH" - Rutgers
    // - Brown Patch: "extended periods of high night temps" - UMass
    
    var CONSECUTIVE_DAY_DISEASES = {
        pythiumBlight: { threshold: 20, maxMultiplier: 1.35, perDayBonus: 0.15 },
        brownPatch: { threshold: 15, maxMultiplier: 1.25, perDayBonus: 0.10 },
        grayLeafSpot: { threshold: 20, maxMultiplier: 1.40, perDayBonus: 0.18 },
        bipolarisSorokiniana: { threshold: 25, maxMultiplier: 1.30, perDayBonus: 0.12 },
        bipolarisCynodontis: { threshold: 20, maxMultiplier: 1.25, perDayBonus: 0.10 },
        curvulariaBlight: { threshold: 30, maxMultiplier: 1.35, perDayBonus: 0.15 }
    };
    
    /**
     * Apply consecutive day multiplier to disease forecast
     * Amplifies risk when favorable conditions persist across multiple days
     * 
     * @param {Array} forecast - Array of {day, date, risk} objects
     * @param {string} diseaseKey - Disease identifier (e.g., 'pythiumBlight')
     * @param {Array} dailyClimate - Daily climate data for checking conditions
     * @returns {Array} Modified forecast with amplified risks
     */
    function applyConsecutiveDayMultiplier(forecast, diseaseKey, dailyClimate) {
        var config = CONSECUTIVE_DAY_DISEASES[diseaseKey];
        if (!config) return forecast; // No consecutive day logic for this disease
        
        var consecutiveDays = 0;
        var appliedAny = false;
        
        for (var i = 0; i < forecast.length; i++) {
            var dayRisk = forecast[i].risk;
            
            // Check if this day meets the "favorable" threshold
            if (dayRisk >= config.threshold) {
                consecutiveDays++;
                
                // Apply multiplier based on streak length (starts on day 2)
                if (consecutiveDays >= 2) {
                    var multiplier = 1 + (config.perDayBonus * (consecutiveDays - 1));
                    multiplier = Math.min(multiplier, config.maxMultiplier);
                    var oldRisk = dayRisk;
                    
                    forecast[i].risk = Math.min(100, Math.round(dayRisk * multiplier));
                    forecast[i].consecutiveDays = consecutiveDays;
                    forecast[i].multiplier = multiplier;
                    
                    if (!appliedAny) {
                        appliedAny = true;
                    }
                }
            } else {
                // Reset streak when conditions break
                consecutiveDays = 0;
            }
        }
        
        return forecast;
    }

    // =========================================================================
    // SIMPLIFIED DISEASE RISK CALCULATORS
    // =========================================================================
    // These are simplified versions of the full disease models, designed to
    // work with single-day climate data for forecasting purposes.

    /**
     * Calculate Dollar Spot risk for a single day
     */
    function calcDollarSpotDaily(dayClimate, nitrogen, variety) {
        var temp = dayClimate.mean || 20;
        // b35fix342: degrade explicitly when no humidity data — engine path now
        // emits null instead of literal 70 from buildDailyClimate.
        if (dayClimate.humidity == null) return 0;
        var humidity = dayClimate.humidity;
        
        // Temperature risk (optimal 15-30°C, peak 22°C)
        var tempRisk = 0;
        if (temp >= 15 && temp <= 30) {
            tempRisk = Math.exp(-0.5 * Math.pow((temp - 22) / 6, 2));
        } else if (temp > 30) {
            tempRisk = Math.max(0, 1 - (temp - 30) / 10);
        } else if (temp > 10) {
            tempRisk = (temp - 10) / 10;
        }
        
        // v1.6.0: Humidity risk — Smith-Kerns concurrent condition hours
        // Use hourly-derived concurrent hours when available (RH ≥ 90% AND temp 15-30°C),
        // normalised against 8 hrs/day. Falls back to dampened period-mean estimate.
        var humidityRisk;
        if (dayClimate.concurrentHrs !== null && dayClimate.concurrentHrs !== undefined) {
            humidityRisk = Math.min(1, dayClimate.concurrentHrs / 8);
        } else {
            // Fallback: only credit humidity when temp is in activity window
            if (temp >= 15 && temp <= 30 && humidity > 80) {
                humidityRisk = Math.min(1, (humidity - 80) / 20);
            } else {
                humidityRisk = 0;
            }
        }
        
        // Modifiers
        var nMod = nitrogen === 'deficient' ? 1.6 : nitrogen === 'low' ? 1.3 : 1.0;
        var varietyMod = variety && variety.disease && variety.disease.dollarSpot ? 
                        variety.disease.dollarSpot.riskMultiplier || 1.0 : 1.0;
        
        var risk = (tempRisk * 0.50 + humidityRisk * 0.50) * nMod * varietyMod * 100;
        return Math.min(100, Math.max(0, Math.round(risk)));
    }

    /**
     * Calculate Brown Patch risk for a single day
     * Rhizoctonia solani - active when night temps 16-21°C+ and day temps 25-30°C+
     * High humidity/leaf wetness critical
     */
    function calcBrownPatchDaily(dayClimate, nitrogen, variety) {
        var minTemp = dayClimate.min || 15;
        var maxTemp = dayClimate.max || 25;
        // b35fix342: degrade explicitly when no humidity data — engine path now
        // emits null instead of literal 70 from buildDailyClimate.
        if (dayClimate.humidity == null) return 0;
        var humidity = dayClimate.humidity;
        
        // Night temperature risk - key trigger is warm nights (>16°C)
        // Optimal 18-25°C night temps
        var nightRisk = 0;
        if (minTemp >= 18 && minTemp <= 25) {
            nightRisk = 1.0;
        } else if (minTemp >= 16 && minTemp < 18) {
            nightRisk = (minTemp - 16) / 2;
        } else if (minTemp > 25 && minTemp <= 30) {
            nightRisk = 1 - (minTemp - 25) / 5;
        }
        
        // Day temperature risk (optimal 25-30°C)
        var dayRisk = 0;
        if (maxTemp >= 25 && maxTemp <= 30) {
            dayRisk = 1.0;
        } else if (maxTemp >= 22 && maxTemp < 25) {
            dayRisk = (maxTemp - 22) / 3;
        } else if (maxTemp > 30 && maxTemp <= 35) {
            dayRisk = 1 - (maxTemp - 30) / 5;
        }
        
        // Humidity/leaf wetness risk - needs prolonged leaf wetness
        var humidityRisk = 0;
        if (humidity >= 90) {
            humidityRisk = 1.0;
        } else if (humidity >= 80) {
            humidityRisk = (humidity - 80) / 10;
        }
        
        // Modifiers - excessive N is a major driver
        var nMod = nitrogen === 'excessive' ? 1.6 : nitrogen === 'high' ? 1.3 : 1.0;
        var varietyMod = variety && variety.disease && variety.disease.brownPatch ?
                        variety.disease.brownPatch.riskMultiplier || 1.0 : 1.0;
        
        // Night temp is the key trigger, humidity sustains infection
        var risk = (nightRisk * 0.40 + dayRisk * 0.25 + humidityRisk * 0.35) * nMod * varietyMod * 100;
        return Math.min(100, Math.max(0, Math.round(risk)));
    }

    /**
     * Calculate Pythium Blight risk for a single day
     * Pythium aphanidermatum - extremely aggressive in hot, humid conditions
     * CRITICAL: Night temps ≥18°C + high humidity (≥80%) = outbreak conditions
     * Aligned with disease-engine.js model
     */
    /**
     * Calculate Pythium Blight risk for a single day
     * ALIGNED with disease-engine.js PythiumModel
     * Pythium aphanidermatum - water mold requiring high moisture
     * Key: Night temp ≥18°C gate, humidity ≥80% critical
     */
    function calcPythiumDaily(dayClimate, nitrogen, variety) {
        var nightTemp = dayClimate.min || 15;
        var dayTemp = dayClimate.max || 25;
        // b35fix342: degrade explicitly when no humidity data.
        if (dayClimate.humidity == null) return 0;
        var nightRH = dayClimate.humidity;
        var recentRain = dayClimate.precipitation || 0;
        
        // Hard gate: Night temp must be ≥20°C for any risk
        // Nutter-Shane model (1983): min temp >20°C (68°F) required
        if (nightTemp < 20) {
            return 0;
        }
        
        // Night temperature risk — threshold 20°C, ramps to full at 28°C
        // Corrected from erroneous 18-26°C ramp (Nutter, Cole & Schein 1983)
        var nightRisk = Math.min(1, (nightTemp - 20) / 8);
        
        // Day temperature risk (≥30°C amplifies - hot humid conditions)
        var dayRisk = dayTemp >= 30 ? Math.min(1, (dayTemp - 30) / 8) : 0;
        
        // Humidity/moisture - CRITICAL for water mold
        // Pythium requires free water or near-saturation for zoospore release
        // ≥90% = full risk, 80-90% = partial, <80% = zero humidity contribution
        var humidityRisk = nightRH >= 90 ? 1 : (nightRH >= 80 ? 0.5 : 0);
        
        // Rain amplifies risk significantly (standing water)
        var rainBoost = recentRain > 10 ? 1.3 : (recentRain > 5 ? 1.15 : 1.0);
        
        // Variety modifier only (N not a major Pythium factor unlike other diseases)
        var varietyMod = variety && variety.disease && variety.disease.pythium ?
                        variety.disease.pythium.riskMultiplier || 1.0 : 1.0;
        
        // Weighted combination - humidity gets equal weight to night temp
        // because Pythium is fundamentally moisture-dependent
        var risk = (nightRisk * 0.40 + dayRisk * 0.20 + humidityRisk * 0.40) * rainBoost * varietyMod * 100;
        
        return Math.min(100, Math.max(0, Math.round(risk)));
    }

    /**
     * Calculate Anthracnose risk for a single day
     * Colletotrichum cereale - this is primarily a STRESS disease
     * Heat stress (>28°C), N deficiency, low mowing, compaction all contribute
     * Aligns with disease-engine.js stress model
     */
    function calcAnthracnoseDaily(dayClimate, nitrogen, variety) {
        var temp = dayClimate.mean || 20;
        var maxTemp = dayClimate.max || 25;
        // b35fix342: degrade explicitly when no humidity data — engine path now
        // emits null instead of literal 70 from buildDailyClimate.
        if (dayClimate.humidity == null) return 0;
        var humidity = dayClimate.humidity;
        
        // Heat stress is the primary climate driver (onset >26°C, severe >30°C)
        var heatRisk = 0;
        if (maxTemp >= 30) {
            heatRisk = Math.min(1, (maxTemp - 28) / 8);
        } else if (maxTemp >= 26) {
            heatRisk = (maxTemp - 26) / 8;
        }
        
        // Humidity contributes to spore spread but is secondary
        var humidityRisk = humidity > 80 ? Math.min(0.5, (humidity - 80) / 40) : 0;
        
        // N deficiency is MAJOR factor - but we can't assess daily
        // Use nitrogen status passed in
        var nMod = 1.0;
        if (nitrogen === 'deficient') {
            nMod = 2.5;  // Major amplifier
        } else if (nitrogen === 'low') {
            nMod = 1.8;
        } else if (nitrogen === 'adequate') {
            nMod = 1.0;
        } else if (nitrogen === 'excessive') {
            nMod = 0.7;  // Excessive N actually reduces anthracnose
        }
        
        var varietyMod = variety && variety.disease && variety.disease.anthracnose ?
                        variety.disease.anthracnose.riskMultiplier || 1.0 : 1.0;
        
        // Base risk from climate, amplified by N status
        var risk = (heatRisk * 0.70 + humidityRisk * 0.30) * nMod * varietyMod * 100;
        
        // Below 26°C with adequate N = minimal risk
        if (maxTemp < 26 && (nitrogen === 'adequate' || nitrogen === 'high' || nitrogen === 'excessive')) {
            risk = Math.min(risk, 10);
        }
        
        return Math.min(100, Math.max(0, Math.round(risk)));
    }

    /**
     * Calculate Fusarium Patch risk for a single day
     * Fusarium (Microdochium nivale) is strictly a COOL-SEASON disease
     * Active: 0-12°C optimal, minimal above 15°C, zero above 18°C
     */
    function calcFusariumDaily(dayClimate, nitrogen, variety) {
        var temp = dayClimate.mean || 10;
        // b35fix342: degrade explicitly when no humidity data — engine path now
        // emits null instead of literal 70 from buildDailyClimate.
        if (dayClimate.humidity == null) return 0;
        var humidity = dayClimate.humidity;
        
        // Temperature risk - Fusarium ONLY active in cold conditions
        // Optimal 0-12°C, drops rapidly above 12°C, zero above 18°C
        var tempRisk = 0;
        if (temp >= 18) {
            tempRisk = 0;  // Zero risk in warm conditions
        } else if (temp >= 0 && temp <= 12) {
            tempRisk = 1.0 - Math.abs(temp - 6) / 12;  // Peak around 6°C
        } else if (temp > 12 && temp < 18) {
            tempRisk = (18 - temp) / 6 * 0.5;  // Rapid decline above 12°C
        } else if (temp < 0) {
            tempRisk = Math.max(0, 0.3 + temp / 10);  // Drops below freezing
        }
        
        // Humidity/moisture risk - needs wet/damp conditions
        var humidityRisk = humidity > 85 ? Math.min(1, (humidity - 85) / 10) : 0;
        
        // Modifiers
        var nMod = nitrogen === 'excessive' ? 1.3 : 1.0;
        var varietyMod = variety && variety.disease && variety.disease.fusarium ?
                        variety.disease.fusarium.riskMultiplier || 1.0 : 1.0;
        
        // Both temp AND humidity must be favorable
        var risk = (tempRisk * 0.65 + humidityRisk * 0.35) * nMod * varietyMod * 100;
        
        // Hard cutoff - zero above 18°C regardless of other factors
        if (temp >= 18) {
            risk = 0;
        }
        
        return Math.min(100, Math.max(0, Math.round(risk)));
    }

    /**
     * Calculate Gray Leaf Spot risk for a single day
     * Aligned with disease-engine.js GrayLeafSpotModel
     */
    function calcGrayLeafSpotDaily(dayClimate, nitrogen, variety) {
        var avgTemp = dayClimate.mean || 25;
        var minTemp = dayClimate.min || (avgTemp - 5);
        // b35fix342: degrade explicitly when no humidity data.
        if (dayClimate.humidity == null) return 0;
        var humidity = dayClimate.humidity;
        
        // Temperature risk (Penn State/Rutgers thresholds)
        // Min infection ≈20°C, Optimum 26-30°C (peak 28°C), Suppressed >34-35°C
        var tempRisk = 0;
        if (avgTemp >= 20 && avgTemp <= 34) {
            if (avgTemp <= 28) {
                // Rising phase: 20-28°C
                tempRisk = (avgTemp - 20) / 8;
            } else {
                // Declining phase: 28-34°C
                tempRisk = 1 - ((avgTemp - 28) / 12);
            }
            tempRisk = Math.max(0, Math.min(1, tempRisk));
        } else if (avgTemp > 34) {
            // Suppression zone >34-35°C
            tempRisk = Math.max(0, 0.5 - ((avgTemp - 34) * 0.25));
        }
        
        // Night temperature risk (critical - disease develops when nights stay warm ≥18-20°C)
        var nightRisk = 0;
        if (minTemp >= 18) {
            nightRisk = Math.min(1, (minTemp - 18) / 6);
        }
        
        // Night humidity (>95% RH triggers spore germination)
        // Estimate night humidity as mean + 10%
        var nightHumidity = Math.min(100, humidity + 10);
        var humidityRisk = 0;
        if (nightHumidity >= 95) {
            humidityRisk = 1.0;
        } else if (nightHumidity >= 85) {
            humidityRisk = (nightHumidity - 85) / 10;
        }
        
        // Leaf wetness estimate (from humidity)
        // High humidity = more leaf wetness hours
        var estimatedWetHours = humidity > 85 ? 12 : humidity > 70 ? 8 : 4;
        var wetnessRisk = 0;
        if (estimatedWetHours >= 12) {
            wetnessRisk = 1.0;
        } else if (estimatedWetHours >= 10) {
            wetnessRisk = 0.85 + ((estimatedWetHours - 10) * 0.075);
        } else if (estimatedWetHours >= 6) {
            wetnessRisk = (estimatedWetHours - 6) / 5 * 0.85;
        }
        
        // Modifiers
        var nMod = nitrogen === 'excessive' ? 2.0 : nitrogen === 'high' ? 1.5 : 1.0;
        var varietyMod = variety && variety.disease && variety.disease.grayLeafSpot ?
                        variety.disease.grayLeafSpot.riskMultiplier || 1.0 : 1.0;
        
        // Match disease-engine.js weighting
        var risk = (tempRisk * 0.20 + nightRisk * 0.25 + humidityRisk * 0.25 + wetnessRisk * 0.30) 
                   * nMod * varietyMod * 100;
        return Math.min(100, Math.max(0, Math.round(risk)));
    }

    /**
     * Calculate Bipolaris Leaf Spot/Blight risk for a single day
     * B. sorokiniana primarily affects cool-season grasses under stress
     * B. cynodontis affects warm-season grasses
     * Optimal temp 15-30°C, favoured by high humidity and N deficiency
     */
    function calcBipolarisDaily(dayClimate, nitrogen, variety) {
        var temp = dayClimate.mean || 20;
        // b35fix342: degrade explicitly when no humidity data — engine path now
        // emits null instead of literal 70 from buildDailyClimate.
        if (dayClimate.humidity == null) return 0;
        var humidity = dayClimate.humidity;
        
        // Temperature risk (optimal 15-30°C, peak around 25°C)
        var tempRisk = 0;
        if (temp >= 15 && temp <= 30) {
            // Gaussian curve peaking at 25°C
            tempRisk = Math.exp(-0.5 * Math.pow((temp - 25) / 7, 2));
        } else if (temp > 30 && temp <= 35) {
            tempRisk = Math.max(0, 1 - (temp - 30) / 5);
        } else if (temp >= 10 && temp < 15) {
            tempRisk = (temp - 10) / 5 * 0.5;
        }
        
        // Humidity/leaf wetness risk - needs prolonged leaf wetness (8-10 hours)
        var humidityRisk = 0;
        if (humidity >= 85) {
            humidityRisk = 1.0;
        } else if (humidity >= 70) {
            humidityRisk = (humidity - 70) / 15;
        }
        
        // N deficiency dramatically increases susceptibility
        var nMod = nitrogen === 'deficient' ? 1.8 : nitrogen === 'low' ? 1.4 : 1.0;
        
        // K deficiency also matters (not available in forecast, assume neutral)
        
        var risk = (tempRisk * 0.45 + humidityRisk * 0.55) * nMod * 100;
        return Math.min(100, Math.max(0, Math.round(risk)));
    }

    /**
     * Calculate Drechslera Leaf Spot / Melting-Out risk for a single day
     * D. poae primarily affects Kentucky bluegrass
     * Optimal temp 15-25°C (cooler than Bipolaris), favoured by wet conditions
     */
    function calcDrechsleraDaily(dayClimate, nitrogen, variety) {
        var temp = dayClimate.mean || 18;
        // b35fix342: degrade explicitly when no humidity data — engine path now
        // emits null instead of literal 70 from buildDailyClimate.
        if (dayClimate.humidity == null) return 0;
        var humidity = dayClimate.humidity;
        
        // Temperature risk (optimal 15-25°C, peak around 20°C - cooler preference)
        var tempRisk = 0;
        if (temp >= 15 && temp <= 25) {
            tempRisk = Math.exp(-0.5 * Math.pow((temp - 20) / 5, 2));
        } else if (temp > 25 && temp <= 32) {
            tempRisk = Math.max(0, 1 - (temp - 25) / 7);
        } else if (temp >= 10 && temp < 15) {
            tempRisk = (temp - 10) / 5 * 0.6;
        }
        
        // High humidity/leaf wetness critical
        var humidityRisk = 0;
        if (humidity >= 90) {
            humidityRisk = 1.0;
        } else if (humidity >= 75) {
            humidityRisk = (humidity - 75) / 15;
        }
        
        // N excess increases risk for Drechslera (opposite of Bipolaris)
        var nMod = nitrogen === 'excessive' ? 1.5 : nitrogen === 'high' ? 1.3 : 1.0;
        
        var risk = (tempRisk * 0.40 + humidityRisk * 0.60) * nMod * 100;
        return Math.min(100, Math.max(0, Math.round(risk)));
    }

    /**
     * Calculate Red Thread (Laetisaria fuciformis) daily risk for forecast
     * timeline (b35fix459 / C64 - engine wire-in).
     *
     * Thin delegation wrapper around the standalone red-thread-model.js
     * GAIP_RedThreadModel.calculateDaily helper. Defensive null check: if
     * red-thread-model.js failed to load, returns 0 silently. Daily-shape
     * variant of the main analyse() dispatcher block in disease-engine-pure.js
     * line ~4980; same neutral-baseline invocation (species='perennialRyegrass',
     * region='neutral' so the standalone module's internal regional modifier
     * stays at 1.0 and the forecast's own susceptibility multiplier in the
     * main loop at line ~1331 applies the per-species scaling instead).
     *
     * The 4-arg form is needed because RedThreadModel.calculateDaily reads
     * options.species and options.region; the daily forecast loop at
     * line ~1331 was 3-arg pre-b35fix459 (dayClimate, nitrogen, variety)
     * with options omitted, falling through to the standalone module's
     * defaults (species='perennialRyegrass', region='uk_ireland' which
     * would apply 1.3x regional pressure silently). The pure-engine
     * dispatcher and this forecast wrapper deliberately override both.
     */
    function calcRedThreadDaily(dayClimate, nitrogen, variety, options) {
        var rt = typeof window !== 'undefined'
            ? window.GAIP_RedThreadModel
            : (typeof global !== 'undefined' ? global.GAIP_RedThreadModel : null);
        if (!rt || typeof rt.calculateDaily !== 'function') return 0;
        var rtOpts = { species: 'perennialRyegrass', region: 'neutral' };
        if (options && typeof options.tissueN === 'number') rtOpts.tissueN = options.tissueN;
        return rt.calculateDaily(dayClimate, nitrogen, variety, rtOpts);
    }

    // =========================================================================
    // DISEASE CALCULATOR MAP
    // =========================================================================

    var DISEASE_CALCULATORS = {
        dollarSpot: { name: 'Dollar Spot', calc: calcDollarSpotDaily, beta: false },
        brownPatch: { name: 'Brown Patch', calc: calcBrownPatchDaily, beta: false },
        pythium: { name: 'Pythium', calc: calcPythiumDaily, beta: false },
        anthracnose: { name: 'Anthracnose', calc: calcAnthracnoseDaily, beta: false },
        fusarium: { name: 'Fusarium', calc: calcFusariumDaily, beta: false },
        grayLeafSpot: { name: 'Gray Leaf Spot', calc: calcGrayLeafSpotDaily, beta: false },
        bipolaris: { name: 'Bipolaris Leaf Spot', calc: calcBipolarisDaily, beta: true },
        // b35fix462 (C59g): Drechslera Melting-Out promoted from beta to validated.
        // DrechsleraPoaeModel emits validationStatus: 'validated' after b35fix362
        // Tier 2 audit and b35fix461 CABI 2024 Box 7.7 curve lock. Registry flag
        // cleared so the forecast chart, peak-risk surface and BETA legend stop
        // marking Drechslera as beta.
        drechslera: { name: 'Drechslera Melting-Out', calc: calcDrechsleraDaily, beta: false },
        // b35fix459 (C64): Red Thread engine wire-in. Heuristic confidence-low
        // model; included in the daily forecast registry so timeline chart
        // and forecast peak-risk surface Red Thread risk on cool-season turf
        // matching the main analyse() dispatcher coverage.
        redThread: { name: 'Red Thread', calc: calcRedThreadDaily, beta: false, heuristic: true }
    };

    // =========================================================================
    // SPECIES SUSCEPTIBILITY (simplified from disease-engine.js)
    // =========================================================================

    // b35fix459 (C64): redThread column added to mirror the pure engine
    // dispatcher decision. Warm-season values set to 0 so the forecast
    // timeline does not emit Red Thread on bermuda/couch/kikuyu/zoysia/
    // buffalo (matches the >0.5 gate in disease-engine-pure.js at the
    // main analyse() dispatcher). Cool-season values match the pure
    // engine's susceptibility column. The forecast loop at line ~1331
    // applies this multiplier as `adjustedRisk = baseRisk * suscept`
    // so 0 fully suppresses the disease in the timeline output.
    var SPECIES_SUSCEPTIBILITY = {
        bentgrass: { dollarSpot: 1.3, brownPatch: 1.2, pythium: 1.3, anthracnose: 1.4, fusarium: 1.2, grayLeafSpot: 0, bipolaris: 0.8, drechslera: 0.6, redThread: 0.9 },
        perennialRyegrass: { dollarSpot: 1.1, brownPatch: 1.2, pythium: 1.4, anthracnose: 0.8, fusarium: 1.0, grayLeafSpot: 1.5, bipolaris: 1.3, drechslera: 1.2, redThread: 1.3 },
        kentuckyBluegrass: { dollarSpot: 1.0, brownPatch: 0.9, pythium: 1.1, anthracnose: 0.7, fusarium: 1.2, grayLeafSpot: 0.4, bipolaris: 0.9, drechslera: 1.5, redThread: 1.1 },
        tallFescue: { dollarSpot: 0.8, brownPatch: 1.4, pythium: 0.9, anthracnose: 0.5, fusarium: 0.7, grayLeafSpot: 0.8, bipolaris: 0.7, drechslera: 0.6, redThread: 0.7 },
        poaAnnua: { dollarSpot: 1.4, brownPatch: 1.0, pythium: 1.5, anthracnose: 1.8, fusarium: 1.3, grayLeafSpot: 0, bipolaris: 0.8, drechslera: 0.9, redThread: 1.0 },
        bermuda: { dollarSpot: 0.3, brownPatch: 0.7, pythium: 0.6, anthracnose: 0.3, fusarium: 0, grayLeafSpot: 0.3, bipolaris: 1.4, drechslera: 0.2, redThread: 0 },
        couch: { dollarSpot: 0.3, brownPatch: 0.7, pythium: 0.6, anthracnose: 0.3, fusarium: 0, grayLeafSpot: 0.3, bipolaris: 1.4, drechslera: 0.2, redThread: 0 },
        kikuyu: { dollarSpot: 0.25, brownPatch: 0.5, pythium: 0.6, anthracnose: 0.2, fusarium: 0, grayLeafSpot: 0.2, bipolaris: 1.0, drechslera: 0.3, redThread: 0 },
        zoysia: { dollarSpot: 0.9, brownPatch: 1.0, pythium: 0.7, anthracnose: 0.4, fusarium: 0, grayLeafSpot: 0.4, bipolaris: 1.1, drechslera: 0.3, redThread: 0 },
        buffalo: { dollarSpot: 0.5, brownPatch: 0.6, pythium: 0.5, anthracnose: 0.2, fusarium: 0, grayLeafSpot: 1.6, bipolaris: 0.8, drechslera: 0.2, redThread: 0 }
    };

    // =========================================================================
    // MAIN FORECAST FUNCTION
    // =========================================================================

    /**
     * Generate disease risk forecast using the MAIN DiseaseEngine
     * This ensures chart and detail list show consistent values
     * @param {Object} state - Hub state with climateMetrics, species, nitrogen status
     * @returns {Object} Forecast data for chart rendering
     */
    function generateForecast(state) {
        if (!state || !state.climateMetrics) {
            return { error: 'No climate data available', diseases: [] };
        }
        
        // b35fix355: humidity-shape diagnostic. Production log
        // gilbasolutions_com-1777248533557 showed 7+7+7=21 forecast-loop
        // dispatches all reading MEANRH n/a while the orchestrator's primary
        // call (which goes through getAuthoritativeClimate's v1.5.1 shape
        // adapter) resolved 82.36% on the same run. The forecast loop reads
        // climateMetrics directly without that adapter, so any shape mismatch
        // between v2's `humidity.mean` (top-level) and the v1 nested
        // `moisture.humidity.mean` collapses humidity propagation silently.
        // This one-line dump exposes exactly what shape the forecast sees on
        // every invocation.
        //
        // b35fix356 production verification: this diagnostic is now the
        // primary signal for whether Edit 1 (hub-tissue P-builder humidity
        // extraction) is working. Healthy post-b35fix356 logs should show
        // moisture.humidity.mean populated with a numeric value on every
        // forecast invocation where raw weather hourly RH is present.
        var _cmDiag = state.climateMetrics;
        var _hourlyArr = _cmDiag.hourly && _cmDiag.hourly.humidity;
        var _hourlyDataArr = _cmDiag.hourlyData && _cmDiag.hourlyData.relative_humidity_2m;
        console.log('[DiseaseForecast b35fix355] climateMetrics humidity shape, ' +
            'moisture.humidity.mean=' + (_cmDiag.moisture && _cmDiag.moisture.humidity ? _cmDiag.moisture.humidity.mean : 'undefined') +
            ' | humidity.mean=' + (_cmDiag.humidity ? _cmDiag.humidity.mean : 'undefined') +
            ' | hourly.humidity[len]=' + (Array.isArray(_hourlyArr) ? _hourlyArr.length : 'n/a') +
            ' | hourlyData.relative_humidity_2m[len]=' + (Array.isArray(_hourlyDataArr) ? _hourlyDataArr.length : 'n/a') +
            ' | source=' + (_cmDiag.source || 'unset'));
        
        // ===========================================================
        // b35fix356 Edit 2 — orchestrator-adapter humidity fallback.
        // ===========================================================
        // Even with Edit 1's hub-tissue P-builder humidity extraction in
        // place, edge cases remain where state.climateMetrics may reach
        // generateForecast without a populated humidity field:
        //   (a) site-switch race where forecast fires after a partial
        //       state update but before hub-tissue's full re-run completes
        //   (b) manual mode where the user enters tempMin/tempMax but no
        //       humidity, raw weather hourly RH is absent, and the P-builder
        //       falls into the empty-humidity branch (_rhCount === 0)
        //   (c) any future code path that builds a state object passing
        //       through climateMetrics from a stale snapshot
        //
        // Strategy: when state.climateMetrics has no usable humidity AND the
        // orchestrator exposes getAuthoritativeClimate (which goes through the
        // v1.5.1 shape adapter at hub-orchestrator.js:1198, reading from
        // GAIP_CANONICAL_STATE → state.computed.climate → global.climateMetrics
        // → manual fallback in that priority order), splice the adapter's
        // humidity into a SHALLOW COPY of climateMetrics and use that for
        // buildDailyClimate. Defensive — never mutates the caller's state.
        //
        // The orchestrator's adapter reads multiple sources, so even when
        // hub-tissue's P-builder produced empty humidity, the adapter may
        // still resolve via a different rung (e.g. GAIP_CANONICAL_STATE or
        // state.computed.climate where the v2 climate engine wrote
        // humidity.mean directly without going through hub-tissue's overwrite).
        var climateMetrics = state.climateMetrics;
        var _hasHumidity = !!(climateMetrics.moisture && climateMetrics.moisture.humidity &&
                              typeof climateMetrics.moisture.humidity.mean === 'number' &&
                              !isNaN(climateMetrics.moisture.humidity.mean));
        if (!_hasHumidity &&
            typeof window !== 'undefined' &&
            window.GaipOrchestrator &&
            typeof window.GaipOrchestrator.getAuthoritativeClimate === 'function') {
            try {
                var _adapted = window.GaipOrchestrator.getAuthoritativeClimate();
                var _adaptedH = _adapted && _adapted.moisture && _adapted.moisture.humidity;
                if (_adaptedH && typeof _adaptedH.mean === 'number' && !isNaN(_adaptedH.mean)) {
                    // Shallow copy + merge so we don't mutate state.climateMetrics
                    climateMetrics = Object.assign({}, climateMetrics, {
                        moisture: Object.assign({}, climateMetrics.moisture || {}, {
                            humidity: _adaptedH,
                            // Preserve dailyPattern from adapter if present (some
                            // adapter sources include per-day humidity); otherwise
                            // keep what state had.
                            dailyPattern: (_adapted.moisture && Array.isArray(_adapted.moisture.dailyPattern))
                                ? _adapted.moisture.dailyPattern
                                : (climateMetrics.moisture && climateMetrics.moisture.dailyPattern) || null,
                        }),
                        // Pull through hourlyData if adapter has it and state didn't —
                        // get5DayMeanRH and BrownPatch's getFidanzaE2 both prefer
                        // hourly arrays when available.
                        hourlyData: climateMetrics.hourlyData || _adapted.hourlyData || null,
                    });
                    console.log('[DiseaseForecast b35fix356] humidity fallback fired, adapter resolved ' +
                        _adaptedH.mean + '% (state.climateMetrics.moisture.humidity was missing)');
                } else {
                    console.log('[DiseaseForecast b35fix356] humidity fallback attempted, adapter returned no usable humidity');
                }
            } catch (_e) {
                console.warn('[DiseaseForecast b35fix356] humidity fallback threw:', _e && _e.message);
            }
        }
        
        // Check if a disease engine is available
        var hasEngine = (typeof window.DiseaseEnginePure !== 'undefined' && window.DiseaseEnginePure.analyse) ||
                        (typeof window.DiseaseEngine !== 'undefined' && window.DiseaseEngine.analyse);
        if (!hasEngine) {
            console.warn('[DiseaseForecast] No disease engine available, using fallback');
            return generateForecastFallback(state);
        }
        
        var dailyPattern = climateMetrics.temperature && climateMetrics.temperature.dailyPattern;
        
        // If no dailyPattern, try to build one from raw weather data or create synthetic forecast
        if (!dailyPattern || dailyPattern.length === 0) {
            dailyPattern = buildDailyPatternFallback(state, climateMetrics);
        }
        
        if (!dailyPattern || dailyPattern.length === 0) {
            return { error: 'No daily forecast data available', diseases: [] };
        }
        
        // Build daily climate data with humidity estimates
        var dailyClimate = buildDailyClimate(dailyPattern, climateMetrics);
        
        // =====================================================================
        // SPECIES RESOLUTION - v1.5.2 Use SpeciesController if available
        // v1.5.2: Fix bug where effectiveSpecies was used as base species
        // Base = dropdown selection (grassSpecies), effective = calculated from overseed
        // =====================================================================
        var turf = state.turf || {};
        var baseSpecies = null;
        var effectiveSpeciesFromController = null;
        
        // BEST: Use SpeciesController (Single Source of Truth)
        if (typeof window !== 'undefined' && window.SpeciesController) {
            baseSpecies = window.SpeciesController.getBaseSpecies();
            effectiveSpeciesFromController = window.SpeciesController.getEffectiveSpecies();
        }
        
        // FALLBACK: GAIP_STATE.turf.grassSpecies (base species from dropdown)
        if (!baseSpecies && typeof window !== 'undefined' && window.GAIP_STATE && window.GAIP_STATE.turf) {
            // Handle case where species might be an object like {c3Fraction: 1}
            var rawSpecies = window.GAIP_STATE.turf.grassSpecies || window.GAIP_STATE.turf.species;
            if (typeof rawSpecies === 'string') {
                baseSpecies = rawSpecies;
            } else if (rawSpecies && rawSpecies.name) {
                baseSpecies = rawSpecies.name;
            }
            // Note: Do NOT use effectiveSpecies as base - that's the calculated value
            if (baseSpecies) {
            }
        }
        
        // 2. PRIORITY 2: DOM dropdown (fallback, may be stale during transitions)
        if (!baseSpecies && typeof document !== 'undefined') {
            var speciesDropdown = document.querySelector('.gaip-species, #gaip-species, [data-field="species"], .gaip-grass-species');
            if (speciesDropdown && speciesDropdown.value) {
                baseSpecies = speciesDropdown.value;
            }
        }
        
        // 3. PRIORITY 3: Fall back to state.turf passed in
        if (!baseSpecies) {
            baseSpecies = turf.species || turf.grassSpecies || 'perennialRyegrass';
        }
        
        var normalizedBase = normalizeSpecies(baseSpecies);
        var species = normalizedBase;  // Default to base species
        
        // Check if current species is C4 (warm season)
        var isC4Species = ['couch', 'bermuda', 'kikuyu', 'zoysia', 'buffalo', 'paspalum', 'seashore_paspalum'].includes(normalizedBase);
        
        // =====================================================================
        // OVERSEED HANDLING - v1.4.5: Check turf.effectiveSpecies FIRST
        // When hub-tissue-v3 detects overseed dominant (>50% C3), it sets turf.effectiveSpecies
        // This is the most reliable source as it's set during state building, not async
        // =====================================================================
        
        // v1.4.5: PRIORITY 1 - Check if hub already resolved effectiveSpecies
        // This handles C4 base + overseed scenarios where coolOverseed is cleared
        if (isC4Species && turf.effectiveSpecies) {
            var normalizedEffective = normalizeSpecies(turf.effectiveSpecies);
            // Only use effectiveSpecies if it's different from base (i.e., it's the overseed)
            if (normalizedEffective !== normalizedBase) {
                species = normalizedEffective;
            }
        }
        
        // v1.4.5: PRIORITY 2 - If effectiveSpecies wasn't set, check GAIP_OVERSEED_STATE
        // This handles cases where overseed-climate-integration has run but hub hasn't set effectiveSpecies
        if (species === normalizedBase) {
            var overseedState = (typeof window !== 'undefined' && window.GAIP_OVERSEED_STATE) || {};
            
            // Check multiple sources for overseed presence
            var hasCoolOverseedInState = turf.coolOverseed && turf.coolOverseed.trim() !== '';
            var hasOverseedInGlobalState = overseedState.overseedSpecies && overseedState.overseedSpecies.trim() !== '';
            
            // Also check DOM dropdown directly (most reliable for C4 + overseed scenarios)
            var domOverseedSpecies = null;
            if (typeof document !== 'undefined') {
                var overseedDropdown = document.querySelector('.gaip-cool-overseed');
                if (overseedDropdown && overseedDropdown.value && overseedDropdown.value.trim() !== '') {
                    domOverseedSpecies = overseedDropdown.value;
                }
            }
            var hasOverseedInDOM = !!domOverseedSpecies;
            
            // Only consider overseed logic if:
            // 1. There's an overseed defined (in state, global, OR DOM dropdown), AND
            // 2. The overseed state shows an active stage (not 'none'), AND
            // 3. There's some C3 cover
            var hasActiveOverseed = (hasCoolOverseedInState || hasOverseedInGlobalState || hasOverseedInDOM) && 
                                    overseedState.stage && 
                                    overseedState.stage !== 'none' &&
                                    overseedState.c3Fraction > 0;
            
            if (hasActiveOverseed) {
                // Validate overseed state matches current base species
                var overseedBaseNormalized = overseedState.baseSpecies ? normalizeSpecies(overseedState.baseSpecies) : null;
                var overseedStateIsValid = overseedBaseNormalized === normalizedBase || 
                                           (isC4Species && overseedState.isC4Base);
                
                // Also check summer intent - if "maintain", overseed should be used even in summer
                var summerIntent = overseedState.summerIntent || turf.overseedSummerIntent || 'transition';
                var isRetainingOverseed = ['retain', 'perennial', 'maintain', 'keep'].includes(summerIntent);
                
                // Use overseed species if:
                // - c3Fraction > 50% (overseed dominant), OR
                // - Retaining overseed through summer AND c3Fraction >= 30%
                var shouldUseOverseed = (overseedStateIsValid && overseedState.c3Fraction > 0.5) ||
                                        (overseedStateIsValid && isRetainingOverseed && overseedState.c3Fraction >= 0.3);
                
                if (shouldUseOverseed) {
                    // Overseed is dominant or being maintained - use effective species
                    var effectiveSpecies = overseedState.effectiveSpecies || overseedState.overseedSpecies || domOverseedSpecies;
                    if (effectiveSpecies) {
                        species = normalizeSpecies(effectiveSpecies);
                    }
                } else {
                }
            } else {
            }
        }
        
        // b35fix101: Map shadeMetrics to the shape DollarSpotModel.calculate() expects.
        // b35fix104: Gate DLI deficit on structural obstruction — same logic as
        // buildDiseaseInputs() in hub-orchestrator.js. Without svf<0.99, facade>0,
        // or treeBlock>0 the deficit is a species-requirement or time-of-day artifact,
        // not a shade-driven disease risk. fungalRisk still passes through.
        var _sm = state.shadeMetrics || window.GAIP_SHADE_RESULT || null;
        var _shadeForEngine = null;
        if (_sm) {
            var _svf       = (_sm.svf       != null ? _sm.svf       : (_sm.modular && _sm.modular.svf       != null ? _sm.modular.svf       : 1));
            var _facade    = (_sm.facade     != null ? _sm.facade    : (_sm.modular && _sm.modular.facade    != null ? _sm.modular.facade    : 0));
            var _treeBlock = (_sm.treeBlock  != null ? _sm.treeBlock : (_sm.modular && _sm.modular.treeBlock != null ? _sm.modular.treeBlock : 0));
            var _hasStructural = _svf < 0.99 || _facade > 0 || _treeBlock > 0;
            var _deficitPct = _hasStructural
                ? (_sm.deficitPct || (_sm.modular && _sm.modular.deficitPct) || 0)
                : 0;
            _shadeForEngine = {
                dliDeficit: { percentage: _deficitPct, mol: _hasStructural ? (_sm.dliDeficit || 0) : 0 },
                deficitPct: _deficitPct,
                stressFactor: _hasStructural ? (_sm.stressFactor || (_sm.stressIndex != null ? _sm.stressIndex / 100 : 0)) : 0,
                fungalRisk: _sm.fungalRisk || null,
                hasStructuralShade: _hasStructural
            };
        }

        // b35fix102: Resolve variety traits from multiple sources.
        // state.varietyTraits is only populated when hub-tissue has built variety data
        // into the state object. If it's null, check selectedVarietyTraits (set by the
        // variety traits integration when a named variety is loaded) and fall back to
        // building from GAIP_CANONICAL_STATE so Pure Distinction / L-93 modifiers flow
        // through to all 7 forecast-day calls, not just the primary orchestrator call.
        var _variety = state.varietyTraits || window.selectedVarietyTraits || null;
        if (!_variety && typeof window !== 'undefined') {
            var _ct = (window.GAIP_CANONICAL_STATE && window.GAIP_CANONICAL_STATE.turf) || {};
            var _vName = _ct.variety || _ct.cultivar || null;
            var _vSpecies = _ct.effectiveSpeciesKey || _ct.speciesKey || _ct.grassSpecies || null;
            if (_vName && _vName !== 'generic' && _vSpecies) {
                var _getDM = (window.GAIP_VarietyTraits && window.GAIP_VarietyTraits.getDiseaseModifier) ||
                             window.gaip_getRegionalDiseaseModifier ||
                             window.gaip_getDiseaseModifier;
                if (typeof _getDM === 'function') {
                    var _traits = { name: _vName, species: _vSpecies, disease: {} };
                    var _dKeys = ['dollarSpot','brownPatch','pythium','anthracnose',
                                  'grayLeafSpot','springDeadSpot','redThread','fusarium',
                                  'takeAll','helminthosporium'];
                    for (var _di = 0; _di < _dKeys.length; _di++) {
                        try {
                            var _r = _getDM(_vSpecies, _vName, _dKeys[_di]);
                            if (_r && _r.confidence !== 'none') {
                                _traits.disease[_dKeys[_di]] = { riskMultiplier: _r.riskMultiplier || 1 };
                            }
                        } catch (e) { /* ignore */ }
                    }
                    if (Object.keys(_traits.disease).length > 0) _variety = _traits;
                }
            }
        }

        var baseInputs = {
            nitrogen: extractNitrogenStatus(state),
            shade: _shadeForEngine,
            soil: state.soilMetrics || null,
            variety: _variety,
            species: species,
            baseSpecies: state.turf && state.turf.baseSpecies ? normalizeSpecies(state.turf.baseSpecies) : null,
            traffic: state.wearMetrics || null,
            mowing: state.mowingData || null,
            siteHistory: state.siteHistory || null,
            region: state.region || 'AU',
            dewData: window.GAIP_DEW_RESULT || null,
            tissueNutrients: state.tissueNutrients || null,
            // v1.6.0: Injectable dependencies for DiseaseEnginePure
            regionalMultipliers: (function() {
                var mults = {};
                if (typeof window.gaip_getDiseaseMultiplier === 'function') {
                    var diseases = ['dollarSpot','brownPatch','pythiumBlight','fusariumPatch',
                                    'anthracnose','takeAllPatch','grayLeafSpot','springDeadSpot',
                                    'largePatch','wateaPatch','redThread'];
                    for (var i = 0; i < diseases.length; i++) {
                        var m = window.gaip_getDiseaseMultiplier(diseases[i], state.region || 'AU');
                        if (m !== 1) mults[diseases[i]] = m;
                    }
                }
                return mults;
            })(),
            regionDisplayInfo: typeof window.gaip_getRegionDisplayInfo === 'function'
                ? window.gaip_getRegionDisplayInfo(state.region || 'AU') : { name: 'Australia' }
        };
        
        // Track disease risks across all days
        var diseaseRisksByDay = {};  // { diseaseName: [day0risk, day1risk, ...] }
        var diseaseMetadata = {};    // { diseaseName: { beta, riskLevel, ... } }
        
        // Run DiseaseEngine for each forecast day
        // v1.6.0: Prefer DiseaseEnginePure when available (uses Smith-Kerns concurrent hours)
        var useEngine = (window.GILBA_USE_PURE_DISEASE !== false && window.DiseaseEnginePure)
                        ? window.DiseaseEnginePure
                        : window.DiseaseEngine;
        for (var d = 0; d < dailyClimate.length; d++) {
            var dayClimate = dailyClimate[d];
            
            // Build climate object for this day that matches what DiseaseEngine expects
            // b35fix342: humidity field passes through null when upstream genuinely has
            // no data — engines (Smith-Kerns, Brown Patch) degrade explicitly rather
            // than computing on fabricated 70%. Pre-fix `dayClimate.humidity || 70`
            // also defaulted falsy zero to 70, which would have hidden the rare but
            // legitimate "0% RH" reading; the post-fix null check (!= null) preserves
            // 0 as a real value. humiditySource flows through for engine provenance.
            var dayInputs = Object.assign({}, baseInputs, {
                climate: {
                    temperature: {
                        current: dayClimate.mean,
                        min: dayClimate.min,
                        max: dayClimate.max,
                        mean: dayClimate.mean,
                        nightMin: dayClimate.min,
                        dayMax: dayClimate.max,
                        // Soil temp estimates (3-day rolling avg for thermal mass lag)
                        soilTemp: dayClimate.soilTemp,
                        soilNightTemp: dayClimate.soilNightTemp
                    },
                    moisture: {
                        humidity: {
                            mean: dayClimate.humidity,                                                  // null-passthrough (b35fix342)
                            max:  dayClimate.humidity != null ? dayClimate.humidity + 15 : null,        // null-passthrough (b35fix342)
                            source: dayClimate.humiditySource                                           // 'per-day' | 'period-mean' | 'no-data'
                        },
                        precipitation: { total: dayClimate.precipitation || 0 }
                    },
                    leafWetness: dayClimate.humidity != null
                        ? estimateLeafWetnessFromHumidity(dayClimate.humidity, dayClimate.precipitation || 0)
                        : null
                }
            });
            
            // v1.6.0: Build synthetic hourlyData for the disease engine
            // When real hourly data isn't available, synthesize from daily min/max/humidity
            // so the pure engine's Smith-Kerns calculation can run per-day.
            // b35fix220: Always synthesize hourlyData for forecast days.
            // b35fix335: pre-fix getSmithKernsConcurrentHours was replaced with
            // getSmithKerns2018Probability (the actual published logistic regression
            // on 5-day mean RH and 5-day mean air temp). The synthetic hourlyData
            // produced here still feeds the new function correctly via get5DayMeanRH —
            // the means it computes are valid whether the underlying hours are real
            // or synthesized.
            // (day 0, computed from actual API hourly data) use them directly.
            // Otherwise derive concurrent hours from the forecast-day humidity and
            // temperature: treat each daytime hour (06-20) as concurrent if RH≥90
            // and temp in window. Simple but physically honest.
            {
                var synthRH = [];
                var synthTemp = [];
                var synthTime = [];
                var baseDate = dayClimate.date || new Date().toISOString().split('T')[0];
                var concHrs;
                if (dayClimate.concurrentHrs !== null && dayClimate.concurrentHrs !== undefined) {
                    // Pre-computed from actual hourly data (current day / b35fix103 path)
                    concHrs = Math.min(dayClimate.concurrentHrs, 14);
                } else if (dayClimate.humidity != null) {
                    // Estimate from forecast day mean RH and temperature.
                    // Smith-Kerns threshold is RH≥90 in 15-30°C window.
                    // Forecast gives only daily mean RH. During warm humid days
                    // the overnight peak typically runs ~10pp above the daily mean
                    // and the daytime trough ~10-15pp below. A conservative daytime
                    // RH estimate is: mean - 10pp (for AU coastal/humid conditions).
                    // We then count the fraction of daytime hours (14h window 06-20)
                    // where that estimate exceeds 90%, and cap at 8h (one full
                    // Smith-Kerns event period).
                    var dayRH = dayClimate.humidity;
                    var dayTemp = dayClimate.mean || 20;
                    var daytimeRHest = dayRH - 10; // conservative daytime mean
                    var inTempWindow = dayTemp >= 15 && dayTemp <= 30;
                    if (inTempWindow && daytimeRHest >= 90) {
                        // Estimate proportion of daytime hours in saturation
                        // Linear: 90%→0h, 100%→8h
                        concHrs = Math.min(8, (daytimeRHest - 90) / 10 * 8);
                    } else if (inTempWindow && daytimeRHest >= 80) {
                        // Transitional — 1-2 hours at dawn/dusk
                        concHrs = Math.min(2, (daytimeRHest - 80) / 10 * 2);
                    } else {
                        concHrs = 0;
                    }
                } else {
                    // b35fix342: no humidity available — concHrs is null. The synth
                    // below will emit null entries in synthRH, and Smith-Kerns + Brown
                    // Patch will degrade explicitly rather than computing on a fabricated
                    // 70-anchored array.
                    concHrs = null;
                }
                // b35fix336: replace pre-fix binary 95/50 marker pattern with a
                // physically honest diurnal RH pattern anchored on the forecast
                // day's mean humidity. The pre-fix non-concurrent value (50) was
                // an arbitrary "below all thresholds" marker chosen for the legacy
                // favourable-hours engine; it was NEVER intended as a measurement.
                // After b35fix335 wired the published Smith-Kerns 2018 logistic
                // (which AVERAGES MEANRH directly), the marker became a fabricated
                // measurement: 21 of 26 production sites on 2026-04-26 read MEANRH
                // = 50.00 exactly, collapsing dollar-spot probability to ~6% on
                // every forecast day with daily-mean RH < 80% — most of the AU
                // autumn-winter year. This is the "asymmetric engines" bug class
                // (skill recurring-bug-patterns): same hourly array consumed by
                // both threshold-counters AND average-then-logit engines, with
                // the synth designed only for the former.
                //
                // Post-fix synthesis:
                //   - daytime non-concurrent hours: dayRH - 10 (matches the
                //     "conservative daytime mean ~10pp below daily mean"
                //     assumption already used at line 901 to estimate concHrs)
                //   - nighttime hours (20:00-06:00): dayRH + 10 (matches the
                //     "overnight peak ~10pp above daily mean" assumption
                //     documented in the comment at line 893)
                //   - concurrent daytime hours: 95 (legitimately near-saturated;
                //     unchanged from pre-fix)
                //   - all values clamped to [0, 100]
                //
                // Net effect: mean(synthRH) ≈ dayRH (physically honest).
                // Threshold counters (>=85, >=90, >=95) read accurate hour counts
                // for legitimate overnight saturation as well as concurrent windows.
                // SK 2018 input MEANRH now reflects the actual forecast humidity.
                //
                // b35fix342: when dayClimate.humidity is null (no upstream data),
                // synthRH is filled with null entries. Engines that consume hourly
                // RH (Smith-Kerns get5DayMeanRH, Brown Patch getFidanzaE2) skip
                // null entries during averaging — when the entire array is null,
                // those engines correctly degrade and report null/n/a rather than
                // computing on a fabricated 70-anchored synth. Pre-fix, the synth
                // baked literal 70 into the array indistinguishably from real data.
                if (dayClimate.humidity != null) {
                    var clampedDayRH = Math.max(0, Math.min(100, dayClimate.humidity));
                    var daytimeNonConcRH = Math.max(0, Math.min(100, clampedDayRH - 10));
                    var nighttimeRH = Math.max(0, Math.min(100, clampedDayRH + 10));
                    for (var h = 0; h < 24; h++) {
                        var isDaytime = h >= 6 && h < 20;
                        var isConcurrent = isDaytime && (h - 6) < concHrs;
                        if (isConcurrent) {
                            synthRH.push(95);
                        } else if (isDaytime) {
                            synthRH.push(daytimeNonConcRH);
                        } else {
                            synthRH.push(nighttimeRH);
                        }
                        synthTemp.push(isConcurrent ? (dayClimate.mean || 22) : (dayClimate.mean || 20));
                        synthTime.push(baseDate + 'T' + (h < 10 ? '0' : '') + h + ':00');
                    }
                } else {
                    // No upstream humidity — emit null RH entries. Engines must degrade.
                    for (var h = 0; h < 24; h++) {
                        synthRH.push(null);
                        synthTemp.push(dayClimate.mean != null ? dayClimate.mean : null);
                        synthTime.push(baseDate + 'T' + (h < 10 ? '0' : '') + h + ':00');
                    }
                }
                dayInputs.climate.hourlyData = {
                    relative_humidity_2m: synthRH,
                    temperature_2m: synthTemp,
                    time: synthTime
                };
            }

            try {
                var dayResults = useEngine.analyse(dayInputs);
                
                if (dayResults && dayResults.diseases) {
                    dayResults.diseases.forEach(function(disease) {
                        // Use displayName for chart legend, fall back to name or disease key
                        var fullName = disease.displayName || disease.name || disease.disease;
                        // Create abbreviated name for legend (max ~15 chars)
                        var shortName = abbreviateDiseaseName(fullName);
                        
                        if (!diseaseRisksByDay[fullName]) {
                            diseaseRisksByDay[fullName] = [];
                            diseaseMetadata[fullName] = {
                                key: disease.disease,
                                name: shortName,  // Use short name for legend
                                fullName: fullName,
                                beta: isBetaDisease(disease.disease),
                                riskLevel: disease.riskLevel
                            };
                        }
                        
                        diseaseRisksByDay[fullName].push({
                            day: d,
                            date: dayClimate.date,
                            risk: disease.adjustedRisk || 0
                        });
                    });
                }
            } catch (e) {
                console.warn('[DiseaseForecast] Error running engine for day ' + d + ':', e);
            }
        }
        
        // Build forecast structure
        var diseaseForecasts = {};
        
        for (var diseaseName in diseaseRisksByDay) {
            var forecast = diseaseRisksByDay[diseaseName];
            var meta = diseaseMetadata[diseaseName];
            
            while (forecast.length < dailyClimate.length) {
                forecast.push({
                    day: forecast.length,
                    date: dailyClimate[forecast.length] ? dailyClimate[forecast.length].date : '',
                    risk: 0
                });
            }
            
            // Apply consecutive day multiplier for diseases that require sustained conditions
            // This amplifies risk when favorable conditions persist across multiple days
            forecast = applyConsecutiveDayMultiplier(forecast, meta.key, dailyClimate);
            
            var avgRisk = forecast.reduce(function(sum, f) { return sum + f.risk; }, 0) / forecast.length;
            var peakRisk = Math.max.apply(null, forecast.map(function(f) { return f.risk; }));
            
            // Check if consecutive day amplification occurred
            var hasConsecutiveBoost = forecast.some(function(f) { return f.consecutiveDays && f.consecutiveDays >= 2; });
            
            if ((avgRisk >= CONFIG.minRiskThreshold || peakRisk >= 30) && peakRisk >= 15) {
                diseaseForecasts[diseaseName] = {
                    key: meta.key,
                    name: diseaseName,
                    beta: meta.beta,
                    forecast: forecast,
                    avgRisk: Math.round(avgRisk),
                    peakRisk: peakRisk,
                    peakDay: forecast.findIndex(function(f) { return f.risk === peakRisk; }),
                    consecutiveBoost: hasConsecutiveBoost
                };
            }
        }
        
        var sortedDiseases = Object.values(diseaseForecasts).sort(function(a, b) {
            return b.peakRisk - a.peakRisk;
        }).slice(0, CONFIG.maxDiseases);
        
        for (var i = 0; i < sortedDiseases.length; i++) {
            sortedDiseases[i].color = CONFIG.colors[i];
        }
        
        var allPeaks = sortedDiseases.map(function(d) { return d.peakRisk; });
        var maxPeak = allPeaks.length > 0 ? Math.max.apply(null, allPeaks) : 0;
        
        return {
            species: species,
            forecastDays: dailyClimate.length,
            diseases: sortedDiseases,
            summary: {
                topThreat: sortedDiseases.length > 0 ? sortedDiseases[0].name : null,
                peakRisk: maxPeak,
                peakDay: sortedDiseases.length > 0 ? sortedDiseases[0].peakDay : null,
                riskLevel: classifyRisk(maxPeak)
            }
        };
    }
    
    function isBetaDisease(diseaseKey) {
        // b35fix462 (C59g): drechsleraPoae removed from beta array following
        // promotion to validated (DRECHSLERA_POAE_VALIDATION_STATUS in
        // bipolaris-curvularia-models.js:176, b35fix362 Tier 2 audit + b35fix461
        // CABI 2024 Box 7.7 curve lock).
        var betaDiseases = ['bipolarisCynodontis', 'bipolarisSorokiniana', 'curvularia', 'waiteaPatch', 'helminthosporium'];
        return betaDiseases.indexOf(diseaseKey) !== -1;
    }
    
    /**
     * Abbreviate disease names for chart legend to prevent overlap
     */
    function abbreviateDiseaseName(fullName) {
        var abbreviations = {
            'Bipolaris Leaf Spot (B. cynodontis)': 'B. cynodontis *',
            'Bipolaris Leaf Spot/Blight (B. sorokiniana)': 'B. sorokiniana *',
            'Drechslera Leaf Spot / Melting-Out': 'Drechslera *',
            'Curvularia Blight': 'Curvularia *',
            'Helminthosporium Leaf Spot': 'Helminthosporium',
            'Spring Dead Spot': 'SDS',
            'Gray Leaf Spot': 'Gray Leaf',
            'Fusarium Patch': 'Fusarium',
            'Pythium Blight': 'Pythium',
            'Take-all Patch': 'Take-all'
        };
        return abbreviations[fullName] || fullName;
    }
    
    function estimateLeafWetnessFromHumidity(humidity, precipitation) {
        var wetHours = 0;
        if (humidity >= 90) wetHours = 8;
        else if (humidity >= 80) wetHours = 5;
        else if (humidity >= 70) wetHours = 3;
        else wetHours = 1;
        if (precipitation > 5) wetHours += 6;
        else if (precipitation > 2) wetHours += 4;
        else if (precipitation > 0) wetHours += 2;
        return {
            totalWetHours: Math.min(12, wetHours),
            dewHours: Math.min(6, wetHours),
            irrigationWetHours: 0
        };
    }
    
    function generateForecastFallback(state) {
        var climateMetrics = state.climateMetrics;
        var dailyPattern = climateMetrics.temperature && climateMetrics.temperature.dailyPattern;
        if (!dailyPattern || dailyPattern.length === 0) {
            dailyPattern = buildDailyPatternFallback(state, climateMetrics);
        }
        if (!dailyPattern || dailyPattern.length === 0) {
            return { error: 'No daily forecast data available', diseases: [] };
        }
        
        // Determine species - respect effective species when overseed is dominant
        // v1.4.5: Check turf.effectiveSpecies FIRST (same logic as main function)
        var turf = state.turf || {};
        var baseSpecies = turf.grassSpecies || 'perennialRyegrass';
        var normalizedBase = normalizeSpecies(baseSpecies);
        var species = normalizedBase;
        
        // Check if base is C4 (warm season)
        var isC4Species = ['couch', 'bermuda', 'kikuyu', 'zoysia', 'buffalo', 'paspalum', 'seashore_paspalum'].includes(normalizedBase);
        
        // v1.4.5: PRIORITY 1 - Check if hub already resolved effectiveSpecies
        if (isC4Species && turf.effectiveSpecies) {
            var normalizedEffective = normalizeSpecies(turf.effectiveSpecies);
            if (normalizedEffective !== normalizedBase) {
                species = normalizedEffective;
            }
        }
        
        // v1.4.5: PRIORITY 2 - Check GAIP_OVERSEED_STATE if effectiveSpecies wasn't used
        if (species === normalizedBase) {
            var overseedState = (typeof window !== 'undefined' && window.GAIP_OVERSEED_STATE) || {};
            
            var hasCoolOverseedInState = turf.coolOverseed && turf.coolOverseed.trim() !== '';
            var hasOverseedInGlobalState = overseedState.overseedSpecies && overseedState.overseedSpecies.trim() !== '';
            
            var domOverseedSpecies = null;
            if (typeof document !== 'undefined') {
                var overseedDropdown = document.querySelector('.gaip-cool-overseed');
                if (overseedDropdown && overseedDropdown.value && overseedDropdown.value.trim() !== '') {
                    domOverseedSpecies = overseedDropdown.value;
                }
            }
            var hasOverseedInDOM = !!domOverseedSpecies;
            
            var hasActiveOverseedFallback = (hasCoolOverseedInState || hasOverseedInGlobalState || hasOverseedInDOM) && 
                                            overseedState.stage && 
                                            overseedState.stage !== 'none' &&
                                            overseedState.c3Fraction > 0;
            
            if (hasActiveOverseedFallback) {
                var c3Fraction = (turf.species && turf.species.c3Fraction) || turf.c3Fraction || overseedState.c3Fraction || 0;
                var summerIntent = overseedState.summerIntent || turf.overseedSummerIntent || 'transition';
                var isRetainingOverseed = ['retain', 'perennial', 'maintain', 'keep'].includes(summerIntent);
                
                var shouldUseOverseed = (c3Fraction > 0.5) || (isRetainingOverseed && c3Fraction >= 0.3);
                
                if (shouldUseOverseed) {
                    var effectiveSpecies = overseedState.effectiveSpecies || overseedState.overseedSpecies || domOverseedSpecies;
                    if (effectiveSpecies) {
                        species = normalizeSpecies(effectiveSpecies);
                    }
                } else {
                }
            } else {
            }
        }
        
        var nitrogenStatus = extractNitrogenStatus(state);
        // b35fix102: same variety resolution as main forecast path
        var variety = state.varietyTraits || window.selectedVarietyTraits || null;
        var susceptibility = SPECIES_SUSCEPTIBILITY[species] || SPECIES_SUSCEPTIBILITY.perennialRyegrass;
        var dailyClimate = buildDailyClimate(dailyPattern, climateMetrics);
        // b35fix459 (C64): options bag passed to per-calculator .calc so the
        // Red Thread wrapper can override the standalone module's species and
        // region defaults (perennialRyegrass / uk_ireland) and consume
        // optional tissueN. Most calculators ignore the 4th arg via positional
        // signature truncation (function calcDollarSpotDaily(dayClimate,
        // nitrogen, variety) drops options) so the bump is backward-compatible
        // across the existing registry. Only calcRedThreadDaily reads options.
        var rtOptions = {
            species: species,
            tissueN: (state && state.tissue && typeof state.tissue.N === 'number') ? state.tissue.N : undefined
        };
        var diseaseForecasts = {};
        for (var diseaseKey in DISEASE_CALCULATORS) {
            if (!DISEASE_CALCULATORS.hasOwnProperty(diseaseKey)) continue;
            var suscept = susceptibility.hasOwnProperty(diseaseKey) ? susceptibility[diseaseKey] : 1.0;
            if (suscept === 0) continue;
            var calculator = DISEASE_CALCULATORS[diseaseKey];
            var forecast = [];
            for (var d = 0; d < dailyClimate.length; d++) {
                var dayClimate = dailyClimate[d];
                var baseRisk = calculator.calc(dayClimate, nitrogenStatus, variety, rtOptions);
                var adjustedRisk = Math.min(100, Math.round(baseRisk * suscept));
                forecast.push({ day: d, date: dayClimate.date, risk: adjustedRisk });
            }
            var avgRisk = forecast.reduce(function(sum, f) { return sum + f.risk; }, 0) / forecast.length;
            var peakRisk = Math.max.apply(null, forecast.map(function(f) { return f.risk; }));
            if ((avgRisk >= CONFIG.minRiskThreshold || peakRisk >= 30) && peakRisk >= 15) {
                diseaseForecasts[diseaseKey] = {
                    key: diseaseKey, name: calculator.name, beta: calculator.beta || false,
                    forecast: forecast, avgRisk: Math.round(avgRisk), peakRisk: peakRisk,
                    peakDay: forecast.findIndex(function(f) { return f.risk === peakRisk; })
                };
            }
        }
        var sortedDiseases = Object.values(diseaseForecasts).sort(function(a, b) {
            return b.peakRisk - a.peakRisk;
        }).slice(0, CONFIG.maxDiseases);
        for (var i = 0; i < sortedDiseases.length; i++) {
            sortedDiseases[i].color = CONFIG.colors[i];
        }
        var allPeaks = sortedDiseases.map(function(d) { return d.peakRisk; });
        var maxPeak = allPeaks.length > 0 ? Math.max.apply(null, allPeaks) : 0;
        return {
            species: species, forecastDays: dailyClimate.length, diseases: sortedDiseases,
            summary: {
                topThreat: sortedDiseases.length > 0 ? sortedDiseases[0].name : null,
                peakRisk: maxPeak,
                peakDay: sortedDiseases.length > 0 ? sortedDiseases[0].peakDay : null,
                riskLevel: classifyRisk(maxPeak)
            }
        };
    }


    // =========================================================================
    // HELPER FUNCTIONS
    // =========================================================================

    /**
     * Normalize species name to match susceptibility keys
     */
    function normalizeSpecies(species) {
        if (!species) return 'perennialRyegrass';
        
        // Handle object species (e.g., { name: 'Tall Fescue', c3Fraction: 1 })
        if (typeof species === 'object') {
            species = species.name || species.species || species.grassSpecies || 'perennialRyegrass';
        }
        
        // Ensure it's a string before calling toLowerCase
        if (typeof species !== 'string') return 'perennialRyegrass';
        
        var s = species.toLowerCase().replace(/[\s\-_]/g, '');
        
        if (s.indexOf('bent') >= 0) return 'bentgrass';
        if (s.indexOf('rye') >= 0 || s === 'prg') return 'perennialRyegrass';
        if (s.indexOf('blue') >= 0 || s === 'kbg') return 'kentuckyBluegrass';
        if (s.indexOf('tallfescue') >= 0 || s === 'tf') return 'tallFescue';
        if (s.indexOf('fescue') >= 0 || s.indexOf('chewing') >= 0) return 'fineFescue';
        if (s.indexOf('poa') >= 0 || s.indexOf('annual') >= 0) return 'poaAnnua';
        if (s.indexOf('bermuda') >= 0) return 'bermuda';
        if (s.indexOf('couch') >= 0) return 'couch';
        if (s.indexOf('kikuyu') >= 0) return 'kikuyu';
        if (s.indexOf('zoysia') >= 0) return 'zoysia';
        if (s.indexOf('buffalo') >= 0 || s.indexOf('stenotaphrum') >= 0) return 'buffalo';
        if (s.indexOf('paspalum') >= 0 || s.indexOf('vaginatum') >= 0) return 'seashore_paspalum';  // b35fix364
        
        return 'perennialRyegrass';
    }

    /**
     * Extract nitrogen status from state
     */
    function extractNitrogenStatus(state) {
        if (state.nitrogenStatus && state.nitrogenStatus.status) {
            return state.nitrogenStatus.status;
        }
        if (state.tissue && state.tissue.N) {
            var n = state.tissue.N;
            if (n < 3.5) return 'deficient';
            if (n < 4.0) return 'low';
            if (n > 5.5) return 'excessive';
            if (n > 5.0) return 'high';
            return 'adequate';
        }
        return 'adequate';
    }

    /**
     * Build daily pattern from fallback sources when climateMetrics.temperature.dailyPattern is missing
     */
    function buildDailyPatternFallback(state, climateMetrics) {
        var daily = [];
        
        
        // Try 1: Build from raw weather hourly data if available
        if (window.rawWeatherData && window.rawWeatherData.forecast && window.rawWeatherData.forecast.hourly) {
            var hourly = window.rawWeatherData.forecast.hourly;
            
            if (hourly.time && hourly.temperature_2m) {
                var hoursPerDay = 24;
                var numDays = Math.min(Math.ceil(hourly.time.length / hoursPerDay), 14);
                
                for (var d = 0; d < numDays; d++) {
                    var startIdx = d * hoursPerDay;
                    var endIdx = Math.min(startIdx + hoursPerDay, hourly.time.length);
                    var dayTemps = hourly.temperature_2m.slice(startIdx, endIdx);
                    
                    if (dayTemps.length > 0) {
                        daily.push({
                            date: hourly.time[startIdx].split('T')[0],
                            min: Math.min.apply(null, dayTemps),
                            max: Math.max.apply(null, dayTemps),
                            mean: dayTemps.reduce(function(a,b) { return a+b; }, 0) / dayTemps.length
                        });
                    }
                }
                
                if (daily.length > 0) {
                    return daily;
                }
            }
        }
        
        // Try 2: Create synthetic 7-day forecast from current climate metrics
        // Uses gradual variation, not random spikes
        if (climateMetrics && climateMetrics.temperature) {
            
            var baseTemp = climateMetrics.temperature.mean || 20;
            var minTemp = climateMetrics.temperature.min || baseTemp - 5;
            var maxTemp = climateMetrics.temperature.max || baseTemp + 5;
            var today = new Date();
            
            
            // Create 7 days with GRADUAL sinusoidal variation (no random spikes)
            // Simulates realistic weather patterns with ±1.5°C gentle oscillation
            for (var i = 0; i < 7; i++) {
                var dateStr = new Date(today.getTime() + i * 24 * 60 * 60 * 1000).toISOString().split('T')[0];
                
                // Sinusoidal variation - gradual warming/cooling pattern
                var dayVariance = Math.sin(i * 0.8) * 1.5;  // ±1.5°C oscillation over ~8 day cycle
                
                // Min/max vary slightly differently to keep realistic diurnal range
                var minVariance = dayVariance - 0.5;
                var maxVariance = dayVariance + 0.5;
                
                daily.push({
                    date: dateStr,
                    min: Math.round((minTemp + minVariance) * 10) / 10,
                    max: Math.round((maxTemp + maxVariance) * 10) / 10,
                    mean: Math.round((baseTemp + dayVariance) * 10) / 10
                });
            }
            
            
            return daily;
        }
        
        return null;
    }

    /**
     * Build daily climate array with humidity estimates
     */
    function buildDailyClimate(dailyPattern, climateMetrics) {
        var daily = [];
        // b35fix342: emit null for genuinely missing upstream humidity instead
        // of literal 70. Track the source so engines and downstream presentation
        // can distinguish "real per-day data" from "period-mean fallback" from
        // "no data at all". Pre-fix the 70-default was indistinguishable from
        // a genuine 70% reading downstream — engines computed against fabricated
        // values without flagging degradation.
        var hasUpstreamHumidity = !!(climateMetrics.moisture && climateMetrics.moisture.humidity &&
                                     typeof climateMetrics.moisture.humidity.mean === 'number' &&
                                     !isNaN(climateMetrics.moisture.humidity.mean));
        var avgHumidity = hasUpstreamHumidity ? climateMetrics.moisture.humidity.mean : null;
        
        // Get daily moisture data if available
        var moistureDaily = climateMetrics.moisture && climateMetrics.moisture.dailyPattern;
        
        // Check if GAIP physics-based soil temps are available
        var useGaipSoilTemp = typeof window !== 'undefined' && 
                             window.GAIP_SOIL_TEMP?.raw?.T_50mm?.length > 0;
        var gaipSoilTemp50 = useGaipSoilTemp ? window.GAIP_SOIL_TEMP.raw.T_50mm : null;
        var gaipSoilTemp100 = useGaipSoilTemp && window.GAIP_SOIL_TEMP.raw.T_100mm ? 
                             window.GAIP_SOIL_TEMP.raw.T_100mm : null;
        
        if (useGaipSoilTemp) {
        }
        
        for (var i = 0; i < dailyPattern.length; i++) {
            var dayTemp = dailyPattern[i];
            var soilTempEstimate, soilNightEstimate;
            
            // Use GAIP physics model if available
            if (useGaipSoilTemp && gaipSoilTemp50) {
                // Get daily average from hourly GAIP data (24 hours per day)
                var startHour = i * 24;
                var endHour = Math.min(startHour + 24, gaipSoilTemp50.length);
                var daySum = 0, nightSum = 0, dayCount = 0, nightCount = 0;
                
                for (var h = startHour; h < endHour; h++) {
                    if (gaipSoilTemp50[h] !== undefined) {
                        daySum += gaipSoilTemp50[h];
                        dayCount++;
                        // Night hours: 6pm-6am (hours 18-23, 0-5)
                        var hourOfDay = h % 24;
                        if (hourOfDay >= 18 || hourOfDay < 6) {
                            nightSum += gaipSoilTemp50[h];
                            nightCount++;
                        }
                    }
                }
                soilTempEstimate = dayCount > 0 ? daySum / dayCount : dayTemp.mean;
                soilNightEstimate = nightCount > 0 ? nightSum / nightCount : dayTemp.min;
            } else {
                // Fallback: Estimate soil/thatch temp as 3-day rolling average
                // Soil temp lags air temp and is more stable (thermal mass effect)
                var soilTempSum = 0;
                var soilTempCount = 0;
                for (var j = Math.max(0, i - 2); j <= i; j++) {
                    soilTempSum += dailyPattern[j].mean;
                    soilTempCount++;
                }
                soilTempEstimate = soilTempSum / soilTempCount;
                
                // Estimate soil night temp (min temps over 3 days)
                var soilNightSum = 0;
                var soilNightCount = 0;
                for (var k = Math.max(0, i - 2); k <= i; k++) {
                    soilNightSum += dailyPattern[k].min;
                    soilNightCount++;
                }
                soilNightEstimate = soilNightSum / soilNightCount;
            }
            
            // b35fix342: humidity null-passthrough with explicit source.
            // Resolution chain: per-day moistureDaily[i] > climateMetrics period mean > null.
            // Pre-fix all three rungs collapsed to literal 70 via the avgHumidity || 70
            // default. Now the chain emits null when upstream genuinely has no data,
            // and humiditySource records which rung supplied the value so downstream
            // engines and the presentation layer can degrade explicitly.
            var perDayHumidity = null;
            var humiditySource = 'no-data';
            if (moistureDaily && moistureDaily[i] && typeof moistureDaily[i].humidity === 'number' && !isNaN(moistureDaily[i].humidity)) {
                perDayHumidity = moistureDaily[i].humidity;
                humiditySource = 'per-day';
            } else if (avgHumidity != null) {
                perDayHumidity = avgHumidity;
                humiditySource = 'period-mean';
            }
            
            daily.push({
                date: dayTemp.date,
                min: dayTemp.min,
                max: dayTemp.max,
                mean: dayTemp.mean,
                soilTemp: soilTempEstimate,          // GAIP 50mm or 3-day rolling avg
                soilNightTemp: soilNightEstimate,    // GAIP 50mm night or 3-day rolling min
                soilTempSource: useGaipSoilTemp ? 'physics' : 'estimated',
                humidity: perDayHumidity,            // null when no upstream data (b35fix342)
                humiditySource: humiditySource,      // 'per-day' | 'period-mean' | 'no-data' (b35fix342)
                // Precipitation per forecast day — priority:
                //   1. Per-day value from dailyPattern (climate engine populates from Open-Meteo precipitation_sum)
                //   2. Per-day value from moistureDaily
                //   3. Today's total for day 0 only (manual mode / API fallback) — future days get 0
                precipitation: (function() {
                    var perDay = dailyPattern[i] && (dailyPattern[i].precipitation ?? dailyPattern[i].precip);
                    if (perDay != null) return perDay;
                    if (moistureDaily && moistureDaily[i]) return moistureDaily[i].precipitation || 0;
                    // Day 0 only: use today's total from climateMetrics as best estimate
                    if (i === 0) {
                        return climateMetrics?.precipitation?.total
                            ?? climateMetrics?.moisture?.precipitation?.total
                            ?? climateMetrics?.moisture?.rainfall
                            ?? 0;
                    }
                    return 0;
                })(),
                // v1.6.0: Smith-Kerns concurrent condition hours for this day
                // Count hours where BOTH RH ≥ 90% AND temp 15-30°C
                // b35fix103: Apply 06:00-20:00 daytime restriction.
                // b35fix335: This per-day counter is a forecast-UI hint
                // (used by the spark-line risk display), NOT the Smith-Kerns
                // engine input. The engine itself now uses the published 2018
                // logistic regression in disease-engine-pure.js. This counter
                // is retained as a separate Gilba presentation aid because it
                // gives forecast users an at-a-glance "how many high-risk
                // hours did today have" display alongside the SK probability.
                concurrentHrs: (function() {
                    var hrRH = climateMetrics.hourlyData && climateMetrics.hourlyData.relative_humidity_2m;
                    var hrTemp = climateMetrics.hourlyData && climateMetrics.hourlyData.temperature_2m;
                    var hrTime = climateMetrics.hourlyData && climateMetrics.hourlyData.time;
                    if (!hrRH || !hrTemp) return null;
                    var start = i * 24;
                    var end = Math.min(start + 24, hrRH.length);
                    var count = 0;
                    for (var h = start; h < end; h++) {
                        if (hrRH[h] >= 90 && hrTemp[h] >= 15 && hrTemp[h] <= 30) {
                            // Restrict to daytime (06:00-20:00) — same as pure engine
                            var hourOfDay = hrTime ? new Date(hrTime[h]).getHours() : (h - start);
                            if (hourOfDay >= 6 && hourOfDay < 20) count++;
                        }
                    }
                    return count;
                })()
            });
        }
        
        // Log soil temp estimates for first day
        if (daily.length > 0) {
            var sourceLabel = useGaipSoilTemp ? ' (GAIP physics 50mm)' : ' (estimated)';
        }
        
        return daily;
    }

    /**
     * Classify risk level
     */
    function classifyRisk(score) {
        if (score >= 85) return 'severe';
        if (score >= 70) return 'high';
        if (score >= 50) return 'moderate';
        if (score >= 25) return 'low';
        return 'minimal';
    }

    // =========================================================================
    // RENDER FUNCTION (integrates with GilbaCharts)
    // =========================================================================

    /**
     * Render disease forecast timeline into container
     * 
     * @param {HTMLElement|string} container - Container element or ID
     * @param {Object} state - Hub state
     * @param {Object} options - Rendering options
     */
    function render(container, state, options) {
        options = options || {};
        
        if (typeof container === 'string') {
            container = document.getElementById(container);
        }
        
        if (!container) {
            console.warn('DiseaseForecast: Container not found');
            return;
        }
        
        // Generate forecast
        var forecast = generateForecast(state);
        
        // v1.5.0: Store forecast data globally for dashboard access
        if (typeof window !== 'undefined') {
            window.GAIP_DISEASE_FORECAST = forecast;
            
            // Also store simplified peak data for quick dashboard access
            if (forecast.summary) {
                window._diseaseForecastData = {
                    peakRisk: forecast.summary.peakRisk,
                    peakDay: forecast.summary.peakDay !== null ? forecast.summary.peakDay + 1 : null,
                    topThreat: forecast.summary.topThreat,
                    riskLevel: forecast.summary.riskLevel,
                    forecastDays: forecast.forecastDays,
                    species: forecast.species  // v1.5.1: Store species for validation
                };
            }
        }
        
        if (forecast.error || forecast.diseases.length === 0) {
            container.innerHTML = '<div class="gaip-chart-empty" style="padding: 20px; text-align: center; color: var(--gaip-text);">' +
                                 '<p>' + (forecast.error || 'No significant disease risk in forecast period') + '</p></div>';
            return;
        }
        
        // Create wrapper with title
        var wrapper = document.createElement('div');
        wrapper.className = 'gaip-disease-forecast-chart';
        wrapper.style.cssText = 'margin: 16px 0; padding: 16px; background: var(--gaip-surface-muted); border: 1px solid var(--gaip-border); border-radius: 8px;';
        
        // Title and summary
        var header = document.createElement('div');
        header.style.cssText = 'margin-bottom: 12px; display: flex; justify-content: space-between; align-items: center;';
        header.innerHTML = '<div style="font-weight: 600; color: var(--gaip-text);">Disease Risk Forecast (' + forecast.forecastDays + ' days)</div>' +
                          '<div style="font-size: 12px; color: var(--gaip-text);">Peak: <strong style="color: ' + getRiskColor(forecast.summary.riskLevel) + '">' + 
                          forecast.summary.topThreat + ' ' + forecast.summary.peakRisk + '%</strong> on day ' + (forecast.summary.peakDay + 1) + '</div>';
        wrapper.appendChild(header);
        
        // Create chart using GilbaCharts
        if (typeof GilbaCharts !== 'undefined' && GilbaCharts.createDiseaseTimeline) {
            var svg = GilbaCharts.createDiseaseTimeline(forecast.diseases, options);
            wrapper.appendChild(svg);
            
            // Attach tooltips
            GilbaCharts.attachTooltips(wrapper, function(value, label) {
                return label || (value + '%');
            });
        } else {
            wrapper.innerHTML += '<p style="color: #ef4444;">GilbaCharts module not loaded</p>';
        }
        
        container.innerHTML = '';
        container.appendChild(wrapper);
        
        return forecast;
    }

    /**
     * Get colour for risk level
     */
    function getRiskColor(level) {
        switch (level) {
            case 'severe': return '#7f1d1d';
            case 'high': return '#ef4444';
            case 'moderate': return '#f59e0b';
            case 'low': return '#22c55e';
            default: return 'var(--gaip-text-secondary)';
        }
    }

    // =========================================================================
    // PUBLIC API
    // =========================================================================

    return {
        CONFIG: CONFIG,
        generateForecast: generateForecast,
        render: render
    };

})();

// Export for browser/WordPress
if (typeof window !== 'undefined') {
    window.DiseaseForecast = DiseaseForecast;
}

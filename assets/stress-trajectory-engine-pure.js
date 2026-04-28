/**
 * =============================================================================
 * GILBA STRESS TRAJECTORY ENGINE - PURE EXTRACTED v3.0.0
 * =============================================================================
 * 
 * Pure-function stress projection engine. No DOM reads, no global mutation.
 * f(state, weather, options) → trajectory result
 * 
 * Extracted from stress-trajectory-engine.js v2.0.1.
 * All global fallbacks REMOVED. State injection is the ONLY input path.
 * 
 * Changes from v2.0.1:
 *   - new Date() replaced with options.startDate (REQUIRED)
 *   - GAIP_Utils.clamp inlined
 *   - global.GAIP_DLI_Recovery removed (use state.dliRecovery only)
 *   - global.GAIP namespace registration removed
 *
 * PURPOSE:
 * Experts think in trajectories: "Where are we heading?"
 * This engine projects multi-factor stress over a 14-day window, enabling:
 * - Proactive intervention before thresholds are breached
 * - Event go/no-go decisions based on projected surface state
 * - Optimal timing windows for cultural practices
 * 
 * METHODOLOGY:
 * 1. Collect current state from all hub modules
 * 2. Project each stress component forward using forecast data
 * 3. Apply compound effects when multiple stressors exceed thresholds
 * 4. Calculate daily trajectory with intervention windows
 * 
 * STRESS COMPONENTS:
 * | Component   | Weight | Sources                          | Recovery |
 * |-------------|--------|----------------------------------|----------|
 * | Thermal     | 20%    | Heat/cold stress from forecast   | 7 days   |
 * | Light       | 15%    | DLI deficit from shade engine    | 10 days  |
 * | Moisture    | 20%    | ET₀ balance, waterlogging        | 5 days   |
 * | Traffic     | 20%    | Match load, scheduled events     | 7 days   |
 * | Nutrition   | 15%    | MLSN/tissue deficiencies         | 14 days  |
 * | Biotic      | 10%    | Disease pressure                 | 14 days  |
 * 
 * COMPOUND EFFECTS (when multiple stressors > 35%):
 * | Combination      | Multiplier | Example              |
 * |------------------|------------|----------------------|
 * | Heat + Drought   | 1.5×       | Summer stress cascade|
 * | Shade + Traffic  | 1.4×       | Shaded goal mouths   |
 * | Disease + Heat   | 1.4×       | Brown patch flare-up |
 * | Disease + Wet    | 1.6×       | Pythium conditions   |
 * | Heat + Traffic   | 1.35×      | Match day heat event |
 * | Shade + Low N    | 1.25×      | Weak shaded turf     |
 * 
 * THRESHOLD LEVELS:
 * | Level    | Score | Action                      |
 * |----------|-------|-----------------------------|
 * | Normal   | 0-30  | No action required          |
 * | Caution  | 31-50 | Monitor closely             |
 * | Warning  | 51-65 | Intervention recommended    |
 * | Critical | 66-80 | Immediate action required   |
 * | Failure  | 81-100| Surface damage imminent     |
 * 
 * CHANGELOG v2.0.1:
 * - Fixed compound effect conditions for Disease+Wet and Wet+Traffic (were impossible: m>35 && m<0)
 * - Added C3_BENT grass type for bentgrass with separate thermal thresholds (28/35°C)
 * - Updated general C3 thresholds to 30/38°C (was 28/35°C)
 * - Removed dead gaip_stress_trajectory alias (orchestrator path was non-functional)
 * - Added lowercase 'version' alias on export for integration compatibility
 * 
 * CHANGELOG v2.0.0:
 * - Fixed weather data format handling (now supports Climate Engine format)
 * - Supports both forecast.daily.temperature_2m_max[] and forecast[].temp_max
 * - Fixed species detection for PRG/C3 grasses
 * 
 * @requires climate-engine.js (for forecast data)
 * @requires shade-engine.js (for DLI data)
 * @requires wear-recovery-engine.js (for traffic data)
 * @requires disease-engine.js (for disease pressure)
 * @provides GAIP_StressTrajectory.project(state, weather, options)
 * 
 * =============================================================================
 */

(function(global) {
    'use strict';

    var VERSION = '3.0.0';

    /* =========================================================================
       CONFIGURATION
    ========================================================================= */

    var CONFIG = {
        // Default projection window
        defaultDays: 14,
        maxDays: 28,
        
        // Component weights (must sum to 1.0)
        weights: {
            thermal: 0.20,
            light: 0.15,
            moisture: 0.20,
            traffic: 0.20,
            nutrition: 0.15,
            biotic: 0.10
        },
        
        // Recovery times (days to return to baseline)
        recoveryDays: {
            thermal: 7,
            light: 10,
            moisture: 5,
            traffic: 7,
            nutrition: 14,
            biotic: 14
        },
        
        // Threshold levels
        thresholds: {
            normal: 30,
            caution: 50,
            warning: 65,
            critical: 80
        },
        
        // Compound effect threshold (both stressors must exceed this)
        compoundThreshold: 35
    };

    /* =========================================================================
       COMPOUND EFFECTS MATRIX
    ========================================================================= */

    var COMPOUND_EFFECTS = [
        {
            stressors: ['thermal', 'moisture'],
            condition: function(t, m) { return t > 35 && m > 35 && t > 0; }, // Hot + dry
            multiplier: 1.5,
            label: 'Heat + Drought cascade',
            description: 'Combined heat and water stress causes rapid decline'
        },
        {
            stressors: ['light', 'traffic'],
            condition: function(l, t) { return l > 35 && t > 35; },
            multiplier: 1.4,
            label: 'Shade + Traffic compound',
            description: 'Shaded turf cannot recover from wear damage'
        },
        {
            stressors: ['biotic', 'thermal'],
            condition: function(b, t) { return b > 35 && t > 35; },
            multiplier: 1.4,
            label: 'Disease + Heat synergy',
            description: 'Heat stress compromises disease resistance'
        },
        {
            stressors: ['biotic', 'moisture'],
            condition: function(b, m) { return b > 35 && m < -35; }, // Disease + wet (negative moisture = waterlogging) // PATCH v2.0.1: was m > 35 && m < 0 (impossible)
            multiplier: 1.6,
            label: 'Disease + Wet conditions',
            description: 'Extended moisture promotes pathogen activity'
        },
        {
            stressors: ['thermal', 'traffic'],
            condition: function(t, tr) { return t > 35 && tr > 35; },
            multiplier: 1.35,
            label: 'Heat + Traffic stress',
            description: 'Traffic on heat-stressed turf causes lasting damage'
        },
        {
            stressors: ['light', 'nutrition'],
            condition: function(l, n) { return l > 35 && n > 35; },
            multiplier: 1.25,
            label: 'Shade + Low N compound',
            description: 'Insufficient light limits N utilisation'
        },
        {
            stressors: ['moisture', 'traffic'],
            condition: function(m, t) { return m < -35 && t > 35; }, // Wet + traffic (negative moisture = waterlogging) // PATCH v2.0.1: was m > 35 && m < 0 (impossible)
            multiplier: 1.45,
            label: 'Wet + Traffic compaction',
            description: 'Traffic on saturated soil causes severe compaction'
        }
    ];

    /* =========================================================================
       THERMAL STRESS CALCULATIONS
    ========================================================================= */

    var THERMAL = {
        // Optimal temperature ranges by grass type
        optimal: {
            C3: { min: 15, max: 24, peak: 20 },
            C3_BENT: { min: 15, max: 22, peak: 18 },  // PATCH v2.0.1: Bentgrass more heat-sensitive than general C3
            C4: { min: 24, max: 35, peak: 30 }
        },
        
        // Stress thresholds
        // PATCH v2.0.1: C3 updated to 30/38 (was 28/35), bentgrass split out at 28/35
        thresholds: {
            C3: {
                heatStressOnset: 30,
                heatStressSevere: 38,
                coldStressOnset: 5,
                coldStressSevere: -2
            },
            C3_BENT: {
                heatStressOnset: 28,
                heatStressSevere: 35,
                coldStressOnset: 5,
                coldStressSevere: -2
            },
            C4: {
                heatStressOnset: 38,
                heatStressSevere: 42,
                coldStressOnset: 12,
                coldStressSevere: 5
            }
        },
        
        /**
         * Calculate thermal stress (0-100) from temperature
         */
        calculate: function(temp, grassType) {
            var type = (grassType === 'C4') ? 'C4' : (grassType === 'C3_BENT') ? 'C3_BENT' : 'C3'; // PATCH v2.0.1: support C3_BENT
            var opt = this.optimal[type];
            var thresh = this.thresholds[type];
            
            // Within optimal range
            if (temp >= opt.min && temp <= opt.max) {
                return 0;
            }
            
            // Heat stress
            if (temp > opt.max) {
                if (temp >= thresh.heatStressSevere) {
                    return 100;
                }
                if (temp >= thresh.heatStressOnset) {
                    // Interpolate between onset and severe
                    var range = thresh.heatStressSevere - thresh.heatStressOnset;
                    var excess = temp - thresh.heatStressOnset;
                    return 35 + (excess / range) * 65;
                }
                // Between optimal max and onset
                var range = thresh.heatStressOnset - opt.max;
                var excess = temp - opt.max;
                return (excess / range) * 35;
            }
            
            // Cold stress
            if (temp < opt.min) {
                if (temp <= thresh.coldStressSevere) {
                    return 100;
                }
                if (temp <= thresh.coldStressOnset) {
                    var range = thresh.coldStressOnset - thresh.coldStressSevere;
                    var deficit = thresh.coldStressOnset - temp;
                    return 35 + (deficit / range) * 65;
                }
                // Between optimal min and onset
                var range = opt.min - thresh.coldStressOnset;
                var deficit = opt.min - temp;
                return (deficit / range) * 35;
            }
            
            return 0;
        }
    };

    /* =========================================================================
       LIGHT STRESS CALCULATIONS
    ========================================================================= */

    var LIGHT = {
        /**
         * Calculate light stress (0-100) from DLI data
         */
        calculate: function(dliRecovery) {
            if (!dliRecovery || !dliRecovery.available) {
                return 0; // No data = assume OK
            }
            
            var ratio = dliRecovery.ratioToMin;
            
            if (ratio >= 1.0 && dliRecovery.dliActual >= dliRecovery.dliTarget) {
                return 0; // At or above target
            }
            
            if (ratio < 0.5) {
                return 100; // Critical deficit
            }
            
            if (ratio < 0.75) {
                return 70 + (0.75 - ratio) / 0.25 * 30; // 70-100
            }
            
            if (ratio < 1.0) {
                return 40 + (1.0 - ratio) / 0.25 * 30; // 40-70
            }
            
            // Between min and target
            var deficitPct = dliRecovery.deficitPct || 0;
            return Math.min(40, deficitPct * 0.8); // 0-40
        }
    };

    /* =========================================================================
       MOISTURE STRESS CALCULATIONS
       Negative values = waterlogging stress
       Positive values = drought stress
    ========================================================================= */

    var MOISTURE = {
        /**
         * Calculate moisture stress (-100 to +100)
         * Negative = waterlogging, Positive = drought
         */
        calculate: function(soilMoisture, etBalance) {
            // If we have direct soil moisture reading
            if (typeof soilMoisture === 'string') {
                var levels = {
                    'saturated': -80,
                    'wet': -40,
                    'moist': -10,
                    'optimal': 0,
                    'slightly_dry': 15,
                    'dry': 50,
                    'very_dry': 80
                };
                return levels[soilMoisture] || 0;
            }
            
            // If we have ET balance (mm/day deficit)
            if (typeof etBalance === 'number') {
                // Positive = deficit (drought), negative = surplus (waterlogging)
                if (etBalance > 8) return 80;
                if (etBalance > 5) return 50;
                if (etBalance > 2) return 25;
                if (etBalance > 0) return etBalance * 10;
                if (etBalance > -3) return etBalance * 15; // -45 to 0
                if (etBalance > -6) return -50;
                return -80;
            }
            
            return 0;
        },
        
        /**
         * Convert to absolute stress (0-100)
         */
        toAbsolute: function(stress) {
            return Math.abs(stress);
        }
    };

    /* =========================================================================
       TRAFFIC STRESS CALCULATIONS
    ========================================================================= */

    var TRAFFIC = {
        /**
         * Calculate traffic stress (0-100) from wear data
         */
        calculate: function(wearResult) {
            if (!wearResult) return 0;
            
            // Use compaction risk percentage directly
            if (wearResult.compactionRisk && wearResult.compactionRisk.riskPercent) {
                return wearResult.compactionRisk.riskPercent;
            }
            
            // Or use usage ratio
            if (wearResult.compactionRisk && wearResult.compactionRisk.adjustedRatio) {
                var ratio = wearResult.compactionRisk.adjustedRatio;
                if (ratio <= 0.4) return ratio * 25;
                if (ratio <= 0.7) return 10 + (ratio - 0.4) * 100;
                if (ratio <= 1.0) return 40 + (ratio - 0.7) * 133;
                return Math.min(100, 80 + (ratio - 1.0) * 40);
            }
            
            return 0;
        },
        
        /**
         * Calculate scheduled event impact
         */
        calculateEventImpact: function(event) {
            var factors = {
                'afl': 1.35,
                'rugby_league': 1.3,
                'rugby_union': 1.25,
                'soccer': 1.0,
                'training_full': 0.7,
                'training_drills': 0.5,
                'training_light': 0.3,
                'concert': 2.0,
                'community': 0.6
            };
            
            var factor = factors[event.type] || 1.0;
            var duration = event.duration || 1.5;
            
            // Base impact + duration scaling
            return factor * 15 * (duration / 1.5);
        }
    };

    /* =========================================================================
       NUTRITION STRESS CALCULATIONS
    ========================================================================= */

    var NUTRITION = {
        /**
         * Calculate nutrition stress (0-100) from MLSN/tissue data
         */
        calculate: function(state, tissueResult) {
            var stress = 0;
            
            // Check tissue N if available
            if (tissueResult && tissueResult.N) {
                var n = tissueResult.N;
                var nOpt = tissueResult.N_optimal || 4.0;
                var nMin = tissueResult.N_min || 3.0;
                
                if (n < nMin * 0.7) stress += 40;
                else if (n < nMin) stress += 25;
                else if (n < nOpt * 0.85) stress += 10;
            }
            
            // Check MLSN deficiencies
            if (state.mlsnResult && state.mlsnResult.deficiencies) {
                var defCount = state.mlsnResult.deficiencies.length;
                stress += Math.min(30, defCount * 10);
            }
            
            // Check if N program is low relative to growth potential
            if (state.fertility && state.climateMetrics) {
                var gp = state.climateMetrics.growthPotential || 50;
                var nRate = state.fertility.monthlyN || 0;
                var expectedN = gp * 0.5; // Rough estimate
                
                if (nRate < expectedN * 0.5) {
                    stress += 20;
                } else if (nRate < expectedN * 0.75) {
                    stress += 10;
                }
            }
            
            return Math.min(100, stress);
        }
    };

    /* =========================================================================
       BIOTIC STRESS CALCULATIONS
    ========================================================================= */

    var BIOTIC = {
        /**
         * Calculate biotic stress (0-100) from disease data
         */
        calculate: function(diseaseResult) {
            if (!diseaseResult) return 0;
            
            // Check for active high-risk diseases
            var maxRisk = 0;
            var activeCount = 0;
            
            var diseases = [
                'dollarSpot', 'brownPatch', 'pythium', 'anthracnose',
                'grayLeafSpot', 'springDeadSpot', 'takeAllPatch'
            ];
            
            for (var i = 0; i < diseases.length; i++) {
                var disease = diseaseResult[diseases[i]];
                if (disease && disease.risk) {
                    var risk = typeof disease.risk === 'number' 
                        ? disease.risk 
                        : (disease.risk === 'High' ? 80 : disease.risk === 'Moderate' ? 50 : 20);
                    
                    if (risk > 30) activeCount++;
                    if (risk > maxRisk) maxRisk = risk;
                }
            }
            
            // Multiple active diseases compound
            var compoundFactor = activeCount > 2 ? 1.3 : activeCount > 1 ? 1.15 : 1.0;
            
            return Math.min(100, maxRisk * compoundFactor);
        }
    };

    /* =========================================================================
       UTILITY FUNCTIONS
    ========================================================================= */

    // Pure inlined clamp - no global dependency
    function clamp(v, lo, hi) { return Math.max(lo, Math.min(hi, v)); }

    /**
     * Determine grass type from state
     * Returns 'C3' or 'C4'
     */
    function getGrassType(state) {
        var species = state.turf?.grassSpecies || state.turf?.species || '';
        var s = species.toLowerCase();
        
        // C4 species list
        var c4Species = ['couch', 'bermuda', 'kikuyu', 'zoysia', 'buffalo', 'paspalum', 'seashore paspalum', 'st. augustine', 'centipede'];
        if (c4Species.some(function(c) { return s.indexOf(c) >= 0; })) {
            return 'C4';
        }
        
        // PATCH v2.0.1: Bentgrass detected separately (more heat-sensitive than general C3)
        var bentSpecies = ['bentgrass', 'bent grass', 'creeping bent', 'agrostis'];
        if (bentSpecies.some(function(c) { return s.indexOf(c) >= 0; })) {
            return 'C3_BENT';
        }
        
        // Explicit C3 check (for clarity in debugging)
        var c3Species = ['ryegrass', 'prg', 'perennial ryegrass', 'fescue', 'bluegrass', 'kbg', 'poa'];
        if (c3Species.some(function(c) { return s.indexOf(c) >= 0; })) {
            return 'C3';
        }
        
        // Default to C3 (conservative - will show stress earlier)
        return 'C3';
    }

    function formatDate(date) {
        return date.toISOString().split('T')[0];
    }

    function addDays(date, days) {
        var d = new Date(date);
        d.setDate(d.getDate() + days);
        return d;
    }

    function getThresholdLevel(score) {
        if (score >= CONFIG.thresholds.critical) return { level: 'Failure', colour: '#dc2626', action: 'Surface damage imminent' };
        if (score >= CONFIG.thresholds.warning) return { level: 'Critical', colour: '#ea580c', action: 'Immediate action required' };
        if (score >= CONFIG.thresholds.caution) return { level: 'Warning', colour: '#f59e0b', action: 'Intervention recommended' };
        if (score >= CONFIG.thresholds.normal) return { level: 'Caution', colour: '#eab308', action: 'Monitor closely' };
        return { level: 'Normal', colour: '#22c55e', action: 'No action required' };
    }

    /* =========================================================================
       WEATHER DATA EXTRACTION - v2.0.0 FIX
       Handles both Climate Engine format and simple array format
    ========================================================================= */

    /**
     * Extract current temperature from weather data
     * Supports multiple formats:
     * - Climate Engine: weather.forecast.daily.temperature_2m_max[0]
     * - Simple array: weather.forecast[0].temp_max
     * - Temperature object: weather.temperature.max
     */
    function extractCurrentTemp(weather, state) {
        // Default fallback
        var defaultTemp = 20;
        
        if (!weather) {
            // Try state.climateMetrics
            if (state && state.climateMetrics && state.climateMetrics.temperature) {
                return state.climateMetrics.temperature.max || 
                       state.climateMetrics.temperature.mean || 
                       defaultTemp;
            }
            return defaultTemp;
        }
        
        // Climate Engine format: forecast.daily.temperature_2m_max[]
        if (weather.forecast && weather.forecast.daily && weather.forecast.daily.temperature_2m_max) {
            var temps = weather.forecast.daily.temperature_2m_max;
            if (temps.length > 0 && typeof temps[0] === 'number') {
                return temps[0];
            }
        }
        
        // Simple array format: forecast[].temp_max
        if (weather.forecast && Array.isArray(weather.forecast) && weather.forecast[0]) {
            return weather.forecast[0].temp_max || 
                   weather.forecast[0].temperature_2m_max ||
                   weather.forecast[0].temp ||
                   defaultTemp;
        }
        
        // Temperature object: weather.temperature.max
        if (weather.temperature) {
            return weather.temperature.max || weather.temperature.mean || defaultTemp;
        }
        
        // State climateMetrics fallback
        if (state && state.climateMetrics && state.climateMetrics.temperature) {
            return state.climateMetrics.temperature.max || 
                   state.climateMetrics.temperature.mean || 
                   defaultTemp;
        }
        
        return defaultTemp;
    }

    /**
     * Get forecast temperature for a specific day offset
     * Supports multiple formats:
     * - Climate Engine: weather.forecast.daily.temperature_2m_max[dayOffset]
     * - Simple array: weather.forecast[dayOffset].temp_max
     */
    function getForecastTemp(weather, dayOffset) {
        if (!weather || !weather.forecast) return null;
        
        // Climate Engine format: forecast.daily.temperature_2m_max[]
        if (weather.forecast.daily && weather.forecast.daily.temperature_2m_max) {
            var temps = weather.forecast.daily.temperature_2m_max;
            if (dayOffset < temps.length) {
                return temps[dayOffset];
            }
            // Beyond forecast range, use last available
            if (temps.length > 0) {
                return temps[temps.length - 1];
            }
            return null;
        }
        
        // Simple array format: forecast[].temp_max
        if (Array.isArray(weather.forecast)) {
            if (weather.forecast[dayOffset]) {
                return weather.forecast[dayOffset].temp_max || 
                       weather.forecast[dayOffset].temperature_2m_max ||
                       weather.forecast[dayOffset].temp;
            }
            // Beyond forecast range, use last available
            var last = weather.forecast[weather.forecast.length - 1];
            if (last) {
                return last.temp_max || last.temperature_2m_max || last.temp;
            }
        }
        
        return null;
    }

    /* =========================================================================
       COMPOUND EFFECTS CALCULATOR
    ========================================================================= */

    function calculateCompoundEffects(components) {
        var appliedEffects = [];
        var totalMultiplier = 1.0;
        
        for (var i = 0; i < COMPOUND_EFFECTS.length; i++) {
            var effect = COMPOUND_EFFECTS[i];
            var s1 = effect.stressors[0];
            var s2 = effect.stressors[1];
            var v1 = components[s1] || 0;
            var v2 = components[s2] || 0;
            
            // For moisture, we need absolute value for threshold check
            if (s1 === 'moisture') v1 = Math.abs(v1);
            if (s2 === 'moisture') v2 = Math.abs(v2);
            
            if (effect.condition(components[s1], components[s2])) {
                appliedEffects.push({
                    label: effect.label,
                    description: effect.description,
                    stressors: effect.stressors,
                    multiplier: effect.multiplier
                });
                
                // Use maximum multiplier (don't stack multiplicatively)
                if (effect.multiplier > totalMultiplier) {
                    totalMultiplier = effect.multiplier;
                }
            }
        }
        
        return {
            multiplier: totalMultiplier,
            effects: appliedEffects,
            isCompounding: appliedEffects.length > 0
        };
    }

    /* =========================================================================
       MAIN PROJECTION FUNCTION
    ========================================================================= */

    /**
     * Project stress trajectory over time
     * 
     * @param {object} state - Current hub state
     * @param {object} weather - Weather data with forecast
     * @param {object} options - Projection options
     * @returns {object} Trajectory projection
     */
    function project(state, weather, options) {
        options = options || {};
        var days = Math.min(options.days || CONFIG.defaultDays, CONFIG.maxDays);
        var events = options.events || {}; // { 'YYYY-MM-DD': [{ type, duration }] }
        
        var grassType = getGrassType(state);
        if (!options.startDate) throw new Error('stress-trajectory-engine-pure: options.startDate is required (Date object or ISO string)');
        var today = (options.startDate instanceof Date) ? options.startDate : new Date(options.startDate);
        var trajectory = [];
        
        // Get current component values
        var currentComponents = calculateCurrentComponents(state, weather, grassType);
        
        // Project forward
        for (var d = 0; d < days; d++) {
            var date = addDays(today, d);
            var dateStr = formatDate(date);
            
            // Get forecast temperature for this day
            var forecastTemp = getForecastTemp(weather, d);
            
            // Calculate projected components
            var projected = projectComponents(currentComponents, d, forecastTemp, grassType, events[dateStr]);
            
            // Calculate compound effects
            var compound = calculateCompoundEffects(projected);
            
            // Calculate weighted total
            var weighted = calculateWeightedTotal(projected);
            var totalScore = weighted * compound.multiplier;
            totalScore = clamp(Math.round(totalScore), 0, 100);
            
            // Get threshold level
            var level = getThresholdLevel(totalScore);
            
            trajectory.push({
                day: d,
                date: dateStr,
                components: {
                    thermal: Math.round(projected.thermal),
                    light: Math.round(projected.light),
                    moisture: Math.round(MOISTURE.toAbsolute(projected.moisture)),
                    traffic: Math.round(projected.traffic),
                    nutrition: Math.round(projected.nutrition),
                    biotic: Math.round(projected.biotic)
                },
                rawMoisture: projected.moisture, // Keep sign for compound detection
                compound: compound,
                weightedScore: Math.round(weighted),
                totalScore: totalScore,
                level: level.level,
                colour: level.colour,
                action: level.action,
                forecastTemp: forecastTemp,
                scheduledEvents: events[dateStr] || []
            });
        }
        
        // Calculate summary statistics
        var summary = calculateSummary(trajectory, currentComponents);
        
        return {
            trajectory: trajectory,
            summary: summary,
            currentComponents: currentComponents,
            grassType: grassType,
            projectionDays: days,
            generatedAt: today.toISOString(),
            version: VERSION
        };
    }

    /**
     * Calculate current stress components from state
     */
    function calculateCurrentComponents(state, weather, grassType) {
        // Get current temperature using new extraction function
        var currentTemp = extractCurrentTemp(weather, state);
        
        // v3.0.0 pure: DLI recovery from state only
        var dliRecovery = state.dliRecovery || null;
        
        // Get wear data
        var wearResult = state.wearResult || state.le || null;
        
        // Get disease data
        var diseaseResult = state.diseaseResult || null;
        
        // Get tissue data
        var tissueResult = state.tissueResult || state.de || null;
        
        return {
            thermal: THERMAL.calculate(currentTemp, grassType),
            light: LIGHT.calculate(dliRecovery),
            moisture: MOISTURE.calculate(state.site?.soilMoisture, state.etBalance),
            traffic: TRAFFIC.calculate(wearResult),
            nutrition: NUTRITION.calculate(state, tissueResult),
            biotic: BIOTIC.calculate(diseaseResult)
        };
    }

    /**
     * Project component values forward with decay/persistence
     */
    function projectComponents(current, dayOffset, forecastTemp, grassType, scheduledEvents) {
        var projected = {};
        
        // Thermal - use forecast temperature directly
        if (forecastTemp !== null && forecastTemp !== undefined) {
            projected.thermal = THERMAL.calculate(forecastTemp, grassType);
        } else {
            // Decay towards normal
            var decayRate = 1 / CONFIG.recoveryDays.thermal;
            projected.thermal = current.thermal * Math.pow(1 - decayRate, dayOffset);
        }
        
        // Light - persists (shade doesn't change quickly)
        projected.light = current.light * 0.98; // Very slow decay
        
        // Moisture - faster recovery with irrigation assumed
        var moistureDecay = 1 / CONFIG.recoveryDays.moisture;
        projected.moisture = current.moisture * Math.pow(1 - moistureDecay, dayOffset);
        
        // Traffic - base decay plus scheduled events
        var trafficDecay = 1 / CONFIG.recoveryDays.traffic;
        projected.traffic = current.traffic * Math.pow(1 - trafficDecay, dayOffset);
        
        // Add scheduled event impacts
        if (scheduledEvents && scheduledEvents.length > 0) {
            for (var i = 0; i < scheduledEvents.length; i++) {
                projected.traffic += TRAFFIC.calculateEventImpact(scheduledEvents[i]);
            }
            projected.traffic = Math.min(100, projected.traffic);
        }
        
        // Nutrition - slow decay (fertiliser applications persist)
        var nutritionDecay = 1 / CONFIG.recoveryDays.nutrition;
        projected.nutrition = current.nutrition * Math.pow(1 - nutritionDecay, dayOffset);
        
        // Biotic - varies with conditions (simplified: slow decay)
        var bioticDecay = 1 / CONFIG.recoveryDays.biotic;
        projected.biotic = current.biotic * Math.pow(1 - bioticDecay, dayOffset);
        
        // Thermal-disease interaction: high humidity + heat = disease spike
        if (projected.thermal > 40 && projected.moisture < -30) {
            projected.biotic = Math.min(100, projected.biotic * 1.3);
        }
        
        return projected;
    }

    /**
     * Calculate weighted total stress score
     */
    function calculateWeightedTotal(components) {
        var total = 0;
        var weights = CONFIG.weights;
        
        total += (components.thermal || 0) * weights.thermal;
        total += (components.light || 0) * weights.light;
        total += Math.abs(components.moisture || 0) * weights.moisture; // Use absolute for total
        total += (components.traffic || 0) * weights.traffic;
        total += (components.nutrition || 0) * weights.nutrition;
        total += (components.biotic || 0) * weights.biotic;
        
        return total;
    }

    /**
     * Calculate summary statistics from trajectory
     */
    function calculateSummary(trajectory, currentComponents) {
        var peakScore = 0;
        var peakDay = 0;
        var daysAboveNormal = 0;
        var daysAboveCaution = 0;
        var daysAboveWarning = 0;
        var daysAboveCritical = 0;
        var firstCriticalDay = -1;
        
        for (var i = 0; i < trajectory.length; i++) {
            var day = trajectory[i];
            
            if (day.totalScore > peakScore) {
                peakScore = day.totalScore;
                peakDay = i;
            }
            
            if (day.totalScore > CONFIG.thresholds.normal) daysAboveNormal++;
            if (day.totalScore > CONFIG.thresholds.caution) daysAboveCaution++;
            if (day.totalScore > CONFIG.thresholds.warning) daysAboveWarning++;
            if (day.totalScore > CONFIG.thresholds.critical) {
                daysAboveCritical++;
                if (firstCriticalDay === -1) firstCriticalDay = i;
            }
        }
        
        // Find intervention windows (periods below caution threshold)
        var interventionWindows = [];
        var windowStart = null;
        
        for (var i = 0; i < trajectory.length; i++) {
            if (trajectory[i].totalScore < CONFIG.thresholds.normal) {
                if (windowStart === null) windowStart = i;
            } else {
                if (windowStart !== null && i - windowStart >= 2) {
                    interventionWindows.push({
                        start: trajectory[windowStart].date,
                        end: trajectory[i - 1].date,
                        days: i - windowStart
                    });
                }
                windowStart = null;
            }
        }
        // Check for window extending to end
        if (windowStart !== null && trajectory.length - windowStart >= 2) {
            interventionWindows.push({
                start: trajectory[windowStart].date,
                end: trajectory[trajectory.length - 1].date,
                days: trajectory.length - windowStart
            });
        }
        
        // Find primary stressor
        var componentTotals = { thermal: 0, light: 0, moisture: 0, traffic: 0, nutrition: 0, biotic: 0 };
        for (var i = 0; i < trajectory.length; i++) {
            var c = trajectory[i].components;
            componentTotals.thermal += c.thermal;
            componentTotals.light += c.light;
            componentTotals.moisture += c.moisture;
            componentTotals.traffic += c.traffic;
            componentTotals.nutrition += c.nutrition;
            componentTotals.biotic += c.biotic;
        }
        
        var primaryStressor = 'thermal';
        var maxComponentValue = componentTotals.thermal;
        for (var key in componentTotals) {
            if (componentTotals[key] > maxComponentValue) {
                maxComponentValue = componentTotals[key];
                primaryStressor = key;
            }
        }
        
        // Generate recommendation
        var recommendation = generateRecommendation(
            peakScore, 
            daysAboveWarning, 
            daysAboveCritical, 
            primaryStressor, 
            firstCriticalDay, 
            interventionWindows
        );
        
        return {
            currentScore: trajectory[0].totalScore,
            currentLevel: trajectory[0].level,
            peakScore: peakScore,
            peakDay: peakDay,
            peakDate: trajectory[peakDay].date,
            peakLevel: trajectory[peakDay].level,
            
            daysAboveNormal: daysAboveNormal,
            daysAboveCaution: daysAboveCaution,
            daysAboveWarning: daysAboveWarning,
            daysAboveCritical: daysAboveCritical,
            firstCriticalDay: firstCriticalDay,
            
            primaryStressor: primaryStressor,
            primaryStressorValue: Math.round(maxComponentValue),
            
            interventionWindows: interventionWindows,
            
            recommendation: recommendation,
            
            trend: peakDay === 0 ? 'improving' : (peakScore > trajectory[0].totalScore * 1.2 ? 'worsening' : 'stable')
        };
    }

    /**
     * Generate actionable recommendation
     */
    function generateRecommendation(peakScore, warningDays, criticalDays, stressor, firstCritical, windows) {
        var rec = {
            urgency: 'normal',
            message: '',
            actions: []
        };
        
        if (criticalDays > 0) {
            rec.urgency = 'critical';
            rec.message = 'Surface damage likely within ' + (firstCritical + 1) + ' day(s). Immediate intervention required.';
            
            if (stressor === 'thermal') {
                rec.actions.push('Increase irrigation frequency to reduce canopy temperature');
                rec.actions.push('Consider protective covering or traffic postponement');
            } else if (stressor === 'traffic') {
                rec.actions.push('Reduce or reschedule scheduled events');
                rec.actions.push('Implement rest period after current events');
            } else if (stressor === 'moisture') {
                rec.actions.push('Adjust irrigation to address moisture stress');
                rec.actions.push('Check drainage if waterlogged');
            } else if (stressor === 'light') {
                rec.actions.push('Deploy supplemental lighting if available');
                rec.actions.push('Reduce traffic in shaded areas');
            }
        }
        else if (warningDays > 3) {
            rec.urgency = 'warning';
            rec.message = 'Elevated stress expected for ' + warningDays + ' days. Intervention recommended.';
            rec.actions.push('Monitor primary stressor: ' + stressor);
            rec.actions.push('Plan cultural practices for intervention windows');
        }
        else if (peakScore > CONFIG.thresholds.caution) {
            rec.urgency = 'caution';
            rec.message = 'Moderate stress period approaching. Monitor conditions.';
            rec.actions.push('Continue normal maintenance');
            rec.actions.push('Be prepared to adjust if conditions worsen');
        }
        else {
            rec.message = 'Conditions favorable. Good window for maintenance activities.';
            if (windows.length > 0) {
                rec.actions.push('Optimal intervention window: ' + windows[0].start + ' to ' + windows[0].end);
            }
        }
        
        return rec;
    }

    /* =========================================================================
       EVENT SIMULATION
    ========================================================================= */

    /**
     * Simulate impact of a specific event on current trajectory
     * 
     * @param {object} state - Current hub state
     * @param {object} weather - Weather data
     * @param {object} event - Event to simulate { date, type, duration }
     * @returns {object} Simulation result with go/no-go recommendation
     */
    function simulateEvent(state, weather, event) {
        // v3.0.0 pure: startDate required - use event.startDate or derive from event.date
        var startDate = event.startDate || event.date;
        
        // Project without event
        var baselineResult = project(state, weather, { days: 14, startDate: startDate });
        
        // Project with event
        var eventDate = event.date;
        var events = {};
        events[eventDate] = [{ type: event.type, duration: event.duration || 1.5 }];
        
        var eventResult = project(state, weather, { days: 14, events: events, startDate: startDate });
        
        // Find the event day in trajectory
        var eventDayIndex = -1;
        for (var i = 0; i < eventResult.trajectory.length; i++) {
            if (eventResult.trajectory[i].date === eventDate) {
                eventDayIndex = i;
                break;
            }
        }
        
        if (eventDayIndex === -1) {
            return {
                canSimulate: false,
                reason: 'Event date outside projection window'
            };
        }
        
        var baseDay = baselineResult.trajectory[eventDayIndex];
        var eventDay = eventResult.trajectory[eventDayIndex];
        
        // Calculate impact
        var impactScore = eventDay.totalScore - baseDay.totalScore;
        var postEventPeak = 0;
        var recoveryDays = 0;
        
        // Find post-event peak and recovery
        for (var j = eventDayIndex; j < eventResult.trajectory.length; j++) {
            if (eventResult.trajectory[j].totalScore > postEventPeak) {
                postEventPeak = eventResult.trajectory[j].totalScore;
            }
            if (eventResult.trajectory[j].totalScore <= CONFIG.thresholds.normal) {
                recoveryDays = j - eventDayIndex;
                break;
            }
        }
        if (recoveryDays === 0) recoveryDays = eventResult.trajectory.length - eventDayIndex;
        
        // Generate go/no-go
        var goNoGo = 'GO';
        var confidence = 'high';
        var concerns = [];
        
        if (postEventPeak > CONFIG.thresholds.critical) {
            goNoGo = 'NO-GO';
            confidence = 'high';
            concerns.push('Event will push surface into critical stress zone');
        }
        else if (postEventPeak > CONFIG.thresholds.warning) {
            goNoGo = 'CAUTION';
            confidence = 'medium';
            concerns.push('Event may cause warning-level stress');
        }
        else if (baseDay.totalScore > CONFIG.thresholds.caution) {
            goNoGo = 'CAUTION';
            confidence = 'medium';
            concerns.push('Surface already under moderate stress');
        }
        
        if (recoveryDays > 7) {
            concerns.push('Extended recovery period expected (' + recoveryDays + '+ days)');
        }
        
        return {
            canSimulate: true,
            event: event,
            baseline: {
                date: eventDate,
                score: baseDay.totalScore,
                level: baseDay.level
            },
            withEvent: {
                score: eventDay.totalScore,
                level: eventDay.level,
                impact: impactScore
            },
            postEvent: {
                peakScore: postEventPeak,
                peakLevel: getThresholdLevel(postEventPeak).level,
                recoveryDays: recoveryDays
            },
            goNoGo: goNoGo,
            confidence: confidence,
            concerns: concerns
        };
    }

    /* =========================================================================
       EXPORTS
    ========================================================================= */

    var GAIP_StressTrajectory = {
        VERSION: VERSION,
        version: VERSION,   // PATCH v2.0.1: lowercase alias for integration compat
        
        // Main functions
        project: project,
        simulateEvent: simulateEvent,
        
        // Component calculators (for testing/direct use)
        components: {
            THERMAL: THERMAL,
            LIGHT: LIGHT,
            MOISTURE: MOISTURE,
            TRAFFIC: TRAFFIC,
            NUTRITION: NUTRITION,
            BIOTIC: BIOTIC
        },
        
        // Configuration
        CONFIG: CONFIG,
        COMPOUND_EFFECTS: COMPOUND_EFFECTS,
        
        // Utility (exposed for debugging)
        _extractCurrentTemp: extractCurrentTemp,
        _getForecastTemp: getForecastTemp,
        _getGrassType: getGrassType
    };

    // Export to global
    global.GAIP_StressTrajectory = GAIP_StressTrajectory;


})(typeof window !== 'undefined' ? window : this);

/**
 * ============================================================================
 * GILBA CLIMATE MODULE v2.1.1 - DUAL METRICS ENHANCEMENT
 * ============================================================================
 * 
 * v2.1.1 - Respects effective species when overseed is dominant (>50% C3)
 * 
 * Adds Current vs 8-Day Outlook dual metrics display using real forecast data.
 * Extends climate-module-v2.js with forward-looking analysis.
 * 
 * NEW IN v2.1.0:
 * - Dual metrics: Current (today) vs 8-Day Outlook (forecast average)
 * - Trajectory indicators showing improving/declining conditions
 * - Day-by-day forecast breakdown for growth potential
 * - Forecast confidence degradation based on forecast day
 * - Integrated with existing stress calculations
 * 
 * SCIENTIFIC BASIS:
 * - Open-Meteo API provides 16-day forecast (using 8-day window)
 * - Forecast skill degrades ~3% per day beyond day 3
 * - Growth potential calculations remain PACE Turf model
 * 
 * INTEGRATION:
 * - Loads after climate-module-v2.js
 * - Enhances existing ClimateModuleV2.analyze() output
 * - UI components in climate-module-v2.1-ui.js
 * 
 * ============================================================================
 */

(function(global) {
    'use strict';

    // ========================================================================
    // CONFIGURATION
    // ========================================================================

    const DUAL_METRICS_CONFIG = {
        version: '2.1.1',
        
        // Forecast window configuration
        forecast: {
            outlookDays: 8,           // Days for outlook average
            currentDays: 1,           // Days for "current" (today only)
            
            // Confidence degradation by forecast day
            // Source: General meteorological practice, NWS skill scores
            confidenceByDay: {
                0: 0.95,   // Today - very high confidence
                1: 0.90,   // Tomorrow
                2: 0.85,   // Day 2
                3: 0.80,   // Day 3
                4: 0.70,   // Day 4 - skill starts degrading faster
                5: 0.60,   // Day 5
                6: 0.50,   // Day 6
                7: 0.40,   // Day 7 - getting unreliable
                8: 0.35    // Day 8
            }
        },
        
        // Trajectory thresholds
        trajectory: {
            improvingThreshold: 5,    // GP difference to show "improving"
            decliningThreshold: -5,   // GP difference to show "declining"
            stressChangeThreshold: 10 // Stress score change to flag
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

    function round(val, decimals = 1) {
        const mult = Math.pow(10, decimals);
        return Math.round(val * mult) / mult;
    }

    /**
     * Calculate weighted average with confidence weights
     */
    function weightedAverage(values, weights) {
        if (!values || values.length === 0) return null;
        
        let sum = 0;
        let weightSum = 0;
        
        for (let i = 0; i < values.length; i++) {
            const weight = weights && weights[i] !== undefined ? weights[i] : 1;
            sum += values[i] * weight;
            weightSum += weight;
        }
        
        return weightSum > 0 ? sum / weightSum : null;
    }

    // ========================================================================
    // FORECAST DATA EXTRACTION
    // ========================================================================

    /**
     * Extract and structure forecast data for dual metrics
     * @param {object} climateData - Raw climate/forecast data
     * @returns {object} Structured forecast with daily breakdown
     */
    function extractForecastData(climateData) {
        // Handle different data formats
        let daily = null;
        
        if (climateData?.daily) {
            daily = climateData.daily;
        } else if (climateData?.forecast?.daily) {
            daily = climateData.forecast.daily;
        }
        
        if (!daily || !daily.time) {
            // Fallback to aggregating hourly if available
            if (climateData?.hourly || climateData?.forecast?.hourly) {
                return aggregateHourlyToDaily(climateData.hourly || climateData.forecast.hourly);
            }
            return null;
        }
        
        // Structure daily data with confidence
        const days = [];
        const numDays = Math.min(daily.time.length, DUAL_METRICS_CONFIG.forecast.outlookDays + 1);
        
        for (let i = 0; i < numDays; i++) {
            const date = daily.time[i];
            const tMax = daily.temperature_2m_max?.[i] ?? daily.tempMax?.[i];
            const tMin = daily.temperature_2m_min?.[i] ?? daily.tempMin?.[i];
            const tMean = daily.temperature_2m_mean?.[i] ?? 
                          (tMax !== undefined && tMin !== undefined ? (tMax + tMin) / 2 : undefined);
            const precip = daily.precipitation_sum?.[i] ?? daily.precipitation?.[i] ?? 0;
            const et0 = daily.et0_fao_evapotranspiration?.[i] ?? daily.et0?.[i];
            const soilTemp = daily.soil_temperature_0cm?.[i] ?? daily.soilTemp?.[i];
            
            // Get confidence for this forecast day
            const confidence = DUAL_METRICS_CONFIG.forecast.confidenceByDay[i] ?? 0.30;
            
            days.push({
                date,
                dayIndex: i,
                isToday: i === 0,
                temperature: {
                    max: tMax,
                    min: tMin,
                    mean: tMean
                },
                precipitation: precip,
                et0: et0,
                soilTemp: soilTemp,
                confidence
            });
        }
        
        return {
            days,
            hasData: days.length > 0,
            totalDays: days.length
        };
    }

    /**
     * Aggregate hourly data to daily (fallback)
     */
    function aggregateHourlyToDaily(hourly) {
        if (!hourly?.time || !hourly?.temperature_2m) return null;
        
        const dayMap = new Map();
        
        for (let i = 0; i < hourly.time.length; i++) {
            const dateStr = hourly.time[i].split('T')[0];
            
            if (!dayMap.has(dateStr)) {
                dayMap.set(dateStr, {
                    date: dateStr,
                    temps: [],
                    precip: 0,
                    soilTemps: []
                });
            }
            
            const day = dayMap.get(dateStr);
            
            if (hourly.temperature_2m[i] !== undefined) {
                day.temps.push(hourly.temperature_2m[i]);
            }
            if (hourly.precipitation?.[i]) {
                day.precip += hourly.precipitation[i];
            }
            if (hourly.soil_temperature_0_to_7cm?.[i] !== undefined) {
                day.soilTemps.push(hourly.soil_temperature_0_to_7cm[i]);
            }
        }
        
        const days = [];
        let dayIndex = 0;
        
        for (const [date, data] of dayMap) {
            if (data.temps.length === 0) continue;
            
            days.push({
                date,
                dayIndex,
                isToday: dayIndex === 0,
                temperature: {
                    max: Math.max(...data.temps),
                    min: Math.min(...data.temps),
                    mean: data.temps.reduce((a, b) => a + b, 0) / data.temps.length
                },
                precipitation: data.precip,
                soilTemp: data.soilTemps.length > 0 ? 
                    data.soilTemps.reduce((a, b) => a + b, 0) / data.soilTemps.length : undefined,
                confidence: DUAL_METRICS_CONFIG.forecast.confidenceByDay[dayIndex] ?? 0.30
            });
            
            dayIndex++;
            if (dayIndex > DUAL_METRICS_CONFIG.forecast.outlookDays) break;
        }
        
        return {
            days,
            hasData: days.length > 0,
            totalDays: days.length
        };
    }

    // ========================================================================
    // GROWTH POTENTIAL CALCULATIONS (PACE Turf Model)
    // ========================================================================

    function calculateC4GP(tempC) {
        if (tempC <= 0 || tempC >= 45) return 0;
        const GPE = global.GilbaGrowthPotentialEngine;
        const gp = GPE ? GPE.compute(tempC, { model: 'pace', species: 'c4' }) : null;
        return gp != null ? gp * 100 : 0;
    }

    function calculateC3GP(tempC) {
        if (tempC <= -5 || tempC >= 40) return 0;
        const GPE = global.GilbaGrowthPotentialEngine;
        const gp = GPE ? GPE.compute(tempC, { model: 'pace', species: 'c3' }) : null;
        return gp != null ? gp * 100 : 0;
    }

    // ========================================================================
    // DUAL METRICS CALCULATION
    // ========================================================================

    /**
     * Calculate dual metrics (Current vs 8-Day Outlook)
     * @param {object} state - Hub state with turf info
     * @param {object} climateData - Climate/forecast data
     * @returns {object} Dual metrics analysis
     */
    function calculateDualMetrics(state, climateData) {
        const forecast = extractForecastData(climateData);
        
        if (!forecast || !forecast.hasData) {
            return {
                available: false,
                error: 'No forecast data available for dual metrics',
                forecast: null
            };
        }
        
        // Determine grass type - respect effective species when overseed is dominant
        const turf = state.turf || {};
        const c3Fraction = turf.species?.c3Fraction || turf.c3Fraction || 0;
        const overseedDominant = c3Fraction > 0.5;
        
        // Use effective species if overseed is dominant, otherwise use base species
        let species;
        let isC4;
        
        if (overseedDominant && turf.effectiveSpecies) {
            species = turf.effectiveSpecies;
            isC4 = turf.effectiveIsC4 === true; // Explicitly false for overseed
        } else {
            species = turf.grassSpecies || 'couch';
            isC4 = isWarmSeason(species);
        }
        
        const gpCalculator = isC4 ? calculateC4GP : calculateC3GP;
        
        // Calculate GP for each day
        const dailyGP = forecast.days.map(day => ({
            date: day.date,
            dayIndex: day.dayIndex,
            isToday: day.isToday,
            gp: day.temperature.mean !== undefined ? 
                Math.round(gpCalculator(day.temperature.mean)) : null,
            temperature: day.temperature,
            confidence: day.confidence
        }));
        
        // Current (today)
        const today = dailyGP[0];
        const currentGP = today?.gp;
        const currentTemp = today?.temperature?.mean;
        
        // 8-Day Outlook (weighted by confidence)
        const outlookDays = dailyGP.slice(1, DUAL_METRICS_CONFIG.forecast.outlookDays + 1);
        const outlookGPs = outlookDays.filter(d => d.gp !== null).map(d => d.gp);
        const outlookConfidences = outlookDays.filter(d => d.gp !== null).map(d => d.confidence);
        const outlookGP = outlookGPs.length > 0 ? 
            Math.round(weightedAverage(outlookGPs, outlookConfidences)) : null;
        
        // Outlook temperature average
        const outlookTemps = outlookDays
            .filter(d => d.temperature?.mean !== undefined)
            .map(d => d.temperature.mean);
        const outlookTemp = outlookTemps.length > 0 ?
            round(outlookTemps.reduce((a, b) => a + b, 0) / outlookTemps.length) : null;
        
        // Calculate trajectory
        let trajectory = 'stable';
        let trajectoryDelta = 0;
        
        if (currentGP !== null && outlookGP !== null) {
            trajectoryDelta = outlookGP - currentGP;
            
            if (trajectoryDelta >= DUAL_METRICS_CONFIG.trajectory.improvingThreshold) {
                trajectory = 'improving';
            } else if (trajectoryDelta <= DUAL_METRICS_CONFIG.trajectory.decliningThreshold) {
                trajectory = 'declining';
            }
        }
        
        // Overall confidence (average of outlook days)
        const avgConfidence = outlookConfidences.length > 0 ?
            round(outlookConfidences.reduce((a, b) => a + b, 0) / outlookConfidences.length * 100) : null;
        
        return {
            available: true,
            species,
            isC4,
            
            current: {
                date: today?.date,
                growthPotential: currentGP,
                temperature: currentTemp !== undefined ? round(currentTemp) : null,
                label: 'Current',
                confidence: 95 // Today is high confidence
            },
            
            outlook: {
                days: DUAL_METRICS_CONFIG.forecast.outlookDays,
                growthPotential: outlookGP,
                temperature: outlookTemp,
                label: `${DUAL_METRICS_CONFIG.forecast.outlookDays}-Day Outlook`,
                confidence: avgConfidence
            },
            
            trajectory: {
                direction: trajectory,
                delta: trajectoryDelta,
                description: getTrajectoryDescription(trajectory, trajectoryDelta, isC4)
            },
            
            daily: dailyGP,
            
            forecast: {
                totalDays: forecast.totalDays,
                source: 'Open-Meteo API'
            }
        };
    }

    /**
     * Get human-readable trajectory description
     */
    function getTrajectoryDescription(trajectory, delta, isC4) {
        const absChange = Math.abs(delta);
        const species = isC4 ? 'warm-season' : 'cool-season';
        
        switch (trajectory) {
            case 'improving':
                if (absChange >= 15) {
                    return `Significant improvement expected (+${delta}% GP) - excellent ${species} growth conditions ahead`;
                }
                return `Conditions improving (+${delta}% GP) - growth will increase over the forecast period`;
                
            case 'declining':
                if (absChange >= 15) {
                    return `Significant decline expected (${delta}% GP) - prepare for reduced ${species} growth`;
                }
                return `Conditions declining (${delta}% GP) - growth will slow over the forecast period`;
                
            default:
                return `Stable conditions expected - growth potential relatively consistent over forecast period`;
        }
    }

    /**
     * Check if species is warm-season (C4)
     */
    function isWarmSeason(species) {
        if (!species) return true; // Default to C4 (Australian context)
        const s = species.toLowerCase().replace(/\s+/g, '');
        const c4 = ['bermuda', 'couch', 'kikuyu', 'buffalo', 'zoysia', 'paspalum', 'seashore'];
        return c4.some(c => s.includes(c));
    }

    // ========================================================================
    // STRESS OUTLOOK CALCULATIONS
    // ========================================================================

    /**
     * Calculate stress outlook comparing current to forecast stress levels
     * @param {object} v2Result - ClimateModuleV2 analysis result
     * @param {object} dualMetrics - Dual metrics calculation
     * @returns {object} Stress outlook analysis
     */
    function calculateStressOutlook(v2Result, dualMetrics) {
        if (!v2Result || !dualMetrics?.available) {
            return { available: false };
        }
        
        // Current stress levels
        const currentHeatScore = v2Result.heatStress?.stressScore ?? 0;
        const currentDroughtScore = v2Result.drought?.stressScore ?? 0;
        const currentWinterkillScore = v2Result.winterkill?.riskScore ?? 0;
        
        // Estimate outlook stress based on temperature trajectory
        // This is a simplified projection - more sophisticated would re-run stress calcs
        const tempChange = (dualMetrics.outlook.temperature || 0) - 
                          (dualMetrics.current.temperature || 0);
        
        // Heat stress projection
        let outlookHeatScore = currentHeatScore;
        if (dualMetrics.isC4) {
            // C4: stress increases significantly above 40°C
            if (dualMetrics.outlook.temperature > 38) {
                outlookHeatScore = Math.min(100, currentHeatScore + 20);
            } else if (tempChange > 5) {
                outlookHeatScore = Math.min(100, currentHeatScore + tempChange * 2);
            }
        } else {
            // C3: stress increases above 27°C, night temps critical
            if (dualMetrics.outlook.temperature > 30) {
                outlookHeatScore = Math.min(100, currentHeatScore + 25);
            } else if (tempChange > 3) {
                outlookHeatScore = Math.min(100, currentHeatScore + tempChange * 3);
            }
        }
        
        // Drought stress projection (simplified - would need precip forecast)
        let outlookDroughtScore = currentDroughtScore;
        if (tempChange > 5) {
            outlookDroughtScore = Math.min(100, currentDroughtScore + 10);
        }
        
        // Winterkill projection
        let outlookWinterkillScore = currentWinterkillScore;
        if (tempChange < -5 && dualMetrics.outlook.temperature < 5) {
            outlookWinterkillScore = Math.min(100, currentWinterkillScore + 15);
        }
        
        // Calculate changes
        const heatChange = outlookHeatScore - currentHeatScore;
        const droughtChange = outlookDroughtScore - currentDroughtScore;
        const winterkillChange = outlookWinterkillScore - currentWinterkillScore;
        
        // Determine overall stress outlook
        const significantChange = DUAL_METRICS_CONFIG.trajectory.stressChangeThreshold;
        let stressTrajectory = 'stable';
        
        if (heatChange >= significantChange || droughtChange >= significantChange || 
            winterkillChange >= significantChange) {
            stressTrajectory = 'increasing';
        } else if (heatChange <= -significantChange || droughtChange <= -significantChange || 
                   winterkillChange <= -significantChange) {
            stressTrajectory = 'decreasing';
        }
        
        return {
            available: true,
            
            current: {
                heat: currentHeatScore,
                drought: currentDroughtScore,
                winterkill: dualMetrics.isC4 ? currentWinterkillScore : null
            },
            
            outlook: {
                heat: Math.round(outlookHeatScore),
                drought: Math.round(outlookDroughtScore),
                winterkill: dualMetrics.isC4 ? Math.round(outlookWinterkillScore) : null
            },
            
            change: {
                heat: Math.round(heatChange),
                drought: Math.round(droughtChange),
                winterkill: dualMetrics.isC4 ? Math.round(winterkillChange) : null
            },
            
            trajectory: stressTrajectory,
            
            alerts: generateStressAlerts(
                { heat: currentHeatScore, drought: currentDroughtScore, winterkill: currentWinterkillScore },
                { heat: outlookHeatScore, drought: outlookDroughtScore, winterkill: outlookWinterkillScore },
                dualMetrics.isC4
            )
        };
    }

    /**
     * Generate stress alerts for significant changes
     */
    function generateStressAlerts(current, outlook, isC4) {
        const alerts = [];
        const threshold = DUAL_METRICS_CONFIG.trajectory.stressChangeThreshold;
        
        // Heat stress alerts
        if (outlook.heat - current.heat >= threshold) {
            if (outlook.heat >= 70) {
                alerts.push({
                    type: 'heat',
                    severity: 'critical',
                    message: 'Heat stress expected to reach critical levels - plan protective measures'
                });
            } else if (outlook.heat >= 50) {
                alerts.push({
                    type: 'heat',
                    severity: 'warning',
                    message: 'Increasing heat stress expected - consider irrigation adjustments'
                });
            }
        }
        
        // Drought stress alerts
        if (outlook.drought - current.drought >= threshold) {
            if (outlook.drought >= 60) {
                alerts.push({
                    type: 'drought',
                    severity: 'warning',
                    message: 'Drought stress likely to increase - monitor soil moisture closely'
                });
            }
        }
        
        // Winterkill alerts (C4 only)
        if (isC4 && outlook.winterkill - current.winterkill >= threshold) {
            if (outlook.winterkill >= 50) {
                alerts.push({
                    type: 'winterkill',
                    severity: 'warning',
                    message: 'Cold stress risk increasing - protect dormant turf from traffic'
                });
            }
        }
        
        return alerts;
    }

    // ========================================================================
    // ENHANCED ANALYZE FUNCTION
    // ========================================================================

    /**
     * Enhanced climate analysis with dual metrics
     * Wraps ClimateModuleV2.analyze() and adds outlook data
     * @param {object} state - Hub state object
     * @param {object} climateData - Climate engine output or raw forecast
     * @returns {object} Enhanced climate analysis with dual metrics
     */
    function analyzeWithDualMetrics(state, climateData) {
        // First, run base v2 analysis
        let v2Result = null;
        
        if (global.GAIP_ClimateV2?.analyze) {
            v2Result = global.GAIP_ClimateV2.analyze(state, climateData);
        } else if (global.gaip_climate_v2) {
            v2Result = global.gaip_climate_v2(state, climateData);
        }
        
        // Calculate dual metrics
        const dualMetrics = calculateDualMetrics(state, climateData);
        
        // Calculate stress outlook
        const stressOutlook = calculateStressOutlook(v2Result, dualMetrics);
        
        // Merge results
        const enhanced = {
            ...(v2Result || {}),
            
            // Add dual metrics
            dualMetrics,
            
            // Add stress outlook
            stressOutlook,
            
            // Update version
            version: DUAL_METRICS_CONFIG.version,
            
            // Add summary headline incorporating outlook
            outlookHeadline: generateOutlookHeadline(dualMetrics, stressOutlook)
        };
        
        return enhanced;
    }

    /**
     * Generate headline summarizing outlook
     */
    function generateOutlookHeadline(dualMetrics, stressOutlook) {
        if (!dualMetrics?.available) {
            return null;
        }
        
        const gpCurrent = dualMetrics.current.growthPotential;
        const gpOutlook = dualMetrics.outlook.growthPotential;
        const trajectory = dualMetrics.trajectory.direction;
        
        let headline = '';
        
        // Growth potential summary
        if (trajectory === 'improving') {
            headline = `Growth improving: ${gpCurrent}% → ${gpOutlook}%`;
        } else if (trajectory === 'declining') {
            headline = `Growth declining: ${gpCurrent}% → ${gpOutlook}%`;
        } else {
            headline = `Growth stable at ~${gpCurrent}%`;
        }
        
        // Add stress warning if applicable
        if (stressOutlook?.alerts?.length > 0) {
            const critical = stressOutlook.alerts.find(a => a.severity === 'critical');
            if (critical) {
                headline += ` ⚠️ ${critical.type} stress alert`;
            }
        }
        
        return headline;
    }

    // ========================================================================
    // EXPORTS
    // ========================================================================

    const ClimateModuleDualMetrics = {
        version: DUAL_METRICS_CONFIG.version,
        
        // Main entry point
        analyze: analyzeWithDualMetrics,
        
        // Individual calculations
        calculateDualMetrics,
        calculateStressOutlook,
        extractForecastData,
        
        // Growth potential (exposed for testing)
        calculateC3GP,
        calculateC4GP,
        
        // Configuration
        config: DUAL_METRICS_CONFIG,
        
        // Utilities
        isWarmSeason,
        weightedAverage
    };

    // Export to global
    if (typeof module !== 'undefined' && module.exports) {
        module.exports = ClimateModuleDualMetrics;
    }
    
    global.GAIP_ClimateV2_DualMetrics = ClimateModuleDualMetrics;
    
    // Also register as enhanced analyze function
    global.gaip_climate_v2_dual = analyzeWithDualMetrics;


})(typeof window !== 'undefined' ? window : this);

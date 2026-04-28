/**
 * =============================================================================
 * GILBA DEW PREDICTION ENGINE v2.0.1 (Production Build)
 * =============================================================================
 *
 * Inlined pure engine wrapped in IIFE for WordPress <script> loading.
 * Physics and thresholds identical to extracted ES module dew-engine.js.
 *
 * v2.0.1 - Rain suppression: dew probability = 0 during precipitation
 *          (physically correct — radiative cooling blocked by clouds during rain)
 * v2.0.0 - Extracted from hub IIFE. Pure calculation, no DOM/globals.
 *
 * SCIENTIFIC BASIS:
 *   - Magnus formula for dew point (Alduchov & Eskridge, 1996)
 *   - Radiative cooling (Monteith 1957, Garratt & Segal 1988)
 *   - Empirical dew formation (Jacobs et al. 2008, Ritter et al. 2019)
 *   - Grass surface temp estimation from air temp + cloud + wind
 *
 * EXPORTS:
 *   window.gaip_dew_prediction(state, climateData)  — orchestrator entry
 *   window.GAIP_DewPrediction                        — full API object
 *
 * @version 2.0.1
 * @author Gilba Solutions
 */

(function(global) {
    'use strict';

    // =========================================================================
    // UTILITIES (inlined from GAIP_Utils)
    // =========================================================================

    function clamp(val, min, max) {
        return Math.min(max, Math.max(min, val));
    }

    function safeNum(val, fallback) {
        var n = parseFloat(val);
        return isFinite(n) ? n : fallback;
    }

    // =========================================================================
    // CONFIGURATION (frozen - identical to extracted v2.0.1)
    // =========================================================================

    var DEW_CONFIG = Object.freeze({
        version: '2.0.1',

        physics: Object.freeze({
            depressionThresholds: Object.freeze({
                certain: 1,
                veryHigh: 2,
                high: 4,
                moderate: 6,
                low: 10,
                unlikely: 15
            }),
            windThresholds: Object.freeze({
                calm: 5,
                light: 10,
                moderate: 15,
                breezy: 20
            }),
            cloudImpact: Object.freeze({
                clear: 1.0,
                partlyCloudy: 0.7,
                mostlyCloudy: 0.4,
                overcast: 0.15
            }),
            surfaceCooling: Object.freeze({
                maxCooling: 6,
                typicalCooling: 4
            })
        }),

        timing: Object.freeze({
            onsetHoursAfterSunset: 2,
            clearanceHoursAfterSunrise: 2,
            peakStartHour: 22,
            peakEndHour: 6
        }),

        sports: Object.freeze({
            alertThresholds: Object.freeze({
                light: 30,
                moderate: 50,
                heavy: 75,
                severe: 90
            }),
            tractionImpact: Object.freeze({
                light: 0.1,
                moderate: 0.25,
                heavy: 0.45,
                severe: 0.65
            }),
            ballGripImpact: Object.freeze({
                light: 0.15,
                moderate: 0.35,
                heavy: 0.55,
                severe: 0.75
            })
        }),

        soilMoistureImpact: Object.freeze({
            dry: 0.7,
            moderate: 1.0,
            wet: 1.2,
            saturated: 1.3
        })
    });

    // =========================================================================
    // HELPER FUNCTIONS
    // =========================================================================

    function calculateDewPoint(tempC, rhPercent) {
        if (rhPercent <= 0 || rhPercent > 100) return tempC;
        var a = 17.27;
        var b = 237.7;
        var alpha = ((a * tempC) / (b + tempC)) + Math.log(rhPercent / 100);
        return (b * alpha) / (a - alpha);
    }

    function calculateDewPointDepression(tempC, rhPercent) {
        return tempC - calculateDewPoint(tempC, rhPercent);
    }

    function estimateSurfaceTemperature(airTempC, cloudCover, windSpeed, isNight) {
        if (!isNight) return airTempC + 2;

        var cloudFactor;
        if (cloudCover <= 10) cloudFactor = 1.0;
        else if (cloudCover <= 40) cloudFactor = 0.7;
        else if (cloudCover <= 70) cloudFactor = 0.4;
        else cloudFactor = 0.15;

        var windFactor;
        if (windSpeed < 5) windFactor = 1.0;
        else if (windSpeed < 10) windFactor = 0.75;
        else if (windSpeed < 15) windFactor = 0.5;
        else if (windSpeed < 20) windFactor = 0.25;
        else windFactor = 0.1;

        var maxCooling = DEW_CONFIG.physics.surfaceCooling.maxCooling;
        return airTempC - (maxCooling * cloudFactor * windFactor);
    }

    function isNightHour(hour) {
        return hour >= 20 || hour < 7;
    }

    function isPeakDewHour(hour) {
        return hour >= DEW_CONFIG.timing.peakStartHour || hour < DEW_CONFIG.timing.peakEndHour;
    }

    function getSoilMoistureFactor(soilMoistureVWC) {
        var impact = DEW_CONFIG.soilMoistureImpact;
        if (!soilMoistureVWC && soilMoistureVWC !== 0) return 1.0;
        if (soilMoistureVWC < 0.15) return impact.dry;
        if (soilMoistureVWC < 0.30) return impact.moderate;
        if (soilMoistureVWC < 0.50) return impact.wet;
        return impact.saturated;
    }

    // =========================================================================
    // CORE DEW PROBABILITY CALCULATION
    // =========================================================================

    function calculateHourlyDewProbability(hourData) {
        var temperature = hourData.temperature;
        var humidity = hourData.humidity;
        var dewpoint = hourData.dewpoint;
        var windSpeed = hourData.windSpeed;
        var cloudCover = hourData.cloudCover;
        var soilMoisture = hourData.soilMoisture;
        var hour = hourData.hour;
        var precipitation = hourData.precipitation;

        var physics = DEW_CONFIG.physics;
        var night = isNightHour(hour);
        var isPeak = isPeakDewHour(hour);

        // v2.0.1: Rain suppresses dew formation
        var precipMm = safeNum(precipitation, 0);
        if (precipMm > 0) {
            return {
                probability: 0,
                intensity: 'none',
                intensityScore: 0,
                factors: {
                    dewPointDepression: null,
                    surfaceDepression: null,
                    surfaceTemp: null,
                    dewPoint: null,
                    cloudFactor: 0,
                    windFactor: 0,
                    timeFactor: 0,
                    soilFactor: 0,
                    precipitationMm: precipMm
                },
                isNight: night,
                isPeakWindow: isPeak,
                suppressedByRain: true,
                wetFromRain: true
            };
        }

        var calculatedDewpoint = dewpoint || calculateDewPoint(temperature, humidity);
        var depression = temperature - calculatedDewpoint;
        var surfaceTemp = estimateSurfaceTemperature(temperature, cloudCover || 0, windSpeed || 0, night);
        var surfaceDepression = surfaceTemp - calculatedDewpoint;

        // Base probability from surface depression
        var baseProbability;
        if (surfaceDepression <= physics.depressionThresholds.certain) {
            baseProbability = 0.95;
        } else if (surfaceDepression <= physics.depressionThresholds.veryHigh) {
            baseProbability = 0.85;
        } else if (surfaceDepression <= physics.depressionThresholds.high) {
            baseProbability = 0.70;
        } else if (surfaceDepression <= physics.depressionThresholds.moderate) {
            baseProbability = 0.70 - (((surfaceDepression - 4) / 2) * 0.25);
        } else if (surfaceDepression <= physics.depressionThresholds.low) {
            baseProbability = 0.45 - (((surfaceDepression - 6) / 4) * 0.30);
        } else if (surfaceDepression <= physics.depressionThresholds.unlikely) {
            baseProbability = 0.15 - (((surfaceDepression - 10) / 5) * 0.10);
        } else {
            baseProbability = 0.03;
        }

        // Cloud modifier (v1.1.0 fix: bonus for clear only, no penalty)
        var cloudModifier = 1.0;
        if (night && (cloudCover || 0) <= 20) {
            cloudModifier = 1.15;
        }

        // Wind modifier
        var ws = safeNum(windSpeed, 0);
        var windModifier;
        if (ws < 5) windModifier = 1.0;
        else if (ws < 10) windModifier = 0.85;
        else if (ws < 15) windModifier = 0.6;
        else if (ws < 20) windModifier = 0.35;
        else windModifier = 0.15;

        // Time modifier (peak window bonus)
        var timeModifier = isPeak ? 1.2 : (night ? 1.0 : 0.3);

        // Soil moisture modifier
        var soilFactor = getSoilMoistureFactor(soilMoisture);

        var rawProbability = baseProbability * cloudModifier * windModifier * timeModifier * soilFactor;
        var probability = clamp(Math.round(rawProbability * 100), 0, 100);

        // Intensity classification
        var thresholds = DEW_CONFIG.sports.alertThresholds;
        var intensity, intensityScore;
        if (probability >= thresholds.severe) { intensity = 'severe'; intensityScore = 4; }
        else if (probability >= thresholds.heavy) { intensity = 'heavy'; intensityScore = 3; }
        else if (probability >= thresholds.moderate) { intensity = 'moderate'; intensityScore = 2; }
        else if (probability >= thresholds.light) { intensity = 'light'; intensityScore = 1; }
        else { intensity = 'none'; intensityScore = 0; }

        return {
            probability: probability,
            intensity: intensity,
            intensityScore: intensityScore,
            factors: {
                dewPointDepression: Math.round(depression * 10) / 10,
                surfaceDepression: Math.round(surfaceDepression * 10) / 10,
                surfaceTemp: Math.round(surfaceTemp * 10) / 10,
                dewPoint: Math.round(calculatedDewpoint * 10) / 10,
                cloudFactor: cloudModifier,
                windFactor: windModifier,
                timeFactor: timeModifier,
                soilFactor: soilFactor
            },
            isNight: night,
            isPeakWindow: isPeak,
            suppressedByRain: false,
            wetFromRain: false
        };
    }

    // =========================================================================
    // FORECAST GENERATION
    // =========================================================================

    function generateDewForecast(climateData, options) {
        options = options || {};
        var hourly = climateData && climateData.forecast && climateData.forecast.hourly;
        if (!hourly || !hourly.time || !hourly.temperature_2m) {
            return { error: 'No hourly forecast data available', hourlyForecasts: [] };
        }

        var hours = hourly.time.length;
        var hourlyForecasts = [];

        for (var i = 0; i < hours; i++) {
            var timeStr = hourly.time[i];
            var date = new Date(timeStr);
            var hour = date.getHours();

            var windRaw = safeNum(hourly.wind_speed_10m ? hourly.wind_speed_10m[i] : null, 0);
            var wind = windRaw;
            if (options.windUnit === 'ms') wind = windRaw * 3.6;

            var soilMoist = null;
            if (hourly.soil_moisture_0_to_7cm) {
                soilMoist = safeNum(hourly.soil_moisture_0_to_7cm[i], null);
            }

            var precip = 0;
            if (hourly.precipitation) {
                precip = safeNum(hourly.precipitation[i], 0);
            }

            var result = calculateHourlyDewProbability({
                temperature: safeNum(hourly.temperature_2m[i], 15),
                humidity: safeNum(hourly.relative_humidity_2m ? hourly.relative_humidity_2m[i] : null, 70),
                dewpoint: hourly.dewpoint_2m ? safeNum(hourly.dewpoint_2m[i], null) : null,
                windSpeed: wind,
                cloudCover: safeNum(hourly.cloud_cover ? hourly.cloud_cover[i] : null, 50),
                soilMoisture: soilMoist,
                hour: hour,
                precipitation: precip
            });

            result.time = timeStr;
            result.date = timeStr.split('T')[0];
            result.hour = hour;
            result.airTemp = safeNum(hourly.temperature_2m[i], null);
            result.humidity = safeNum(hourly.relative_humidity_2m ? hourly.relative_humidity_2m[i] : null, null);
            result.windSpeed = wind;
            result.cloudCover = safeNum(hourly.cloud_cover ? hourly.cloud_cover[i] : null, null);

            hourlyForecasts.push(result);
        }

        // Daily aggregation
        var dailyMap = {};
        for (var j = 0; j < hourlyForecasts.length; j++) {
            var f = hourlyForecasts[j];
            if (!dailyMap[f.date]) {
                dailyMap[f.date] = { date: f.date, hours: [] };
            }
            dailyMap[f.date].hours.push(f);
        }

        var dailyForecasts = [];
        var dates = Object.keys(dailyMap).sort();
        for (var k = 0; k < dates.length; k++) {
            var day = dailyMap[dates[k]];
            var nightHours = day.hours.filter(function(h) { return h.isNight; });
            var dewHours = day.hours.filter(function(h) { return h.probability >= 30; });
            var peakProb = Math.max.apply(null, day.hours.map(function(h) { return h.probability; }));
            var peakIntensity = 'none';
            for (var m = 0; m < day.hours.length; m++) {
                if (day.hours[m].probability === peakProb) {
                    peakIntensity = day.hours[m].intensity;
                    break;
                }
            }

            var avgNight = nightHours.length > 0 ?
                Math.round(nightHours.reduce(function(s, h) { return s + h.probability; }, 0) / nightHours.length) : 0;

            dailyForecasts.push({
                date: day.date,
                dewHours: dewHours.length,
                peakProbability: peakProb,
                peakIntensity: peakIntensity,
                avgNightProbability: avgNight,
                nightHoursAssessed: nightHours.length
            });
        }

        // Summary
        var totalDewHours = hourlyForecasts.filter(function(h) { return h.probability >= 30; }).length;
        var daysWithDew = dailyForecasts.slice(1).filter(function(d) { return d.dewHours >= 2; }).length;

        return {
            hourlyForecasts: hourlyForecasts,
            dailyForecasts: dailyForecasts,
            summary: {
                totalHoursAnalyzed: hourlyForecasts.length,
                dewLikelyHours: totalDewHours,
                daysWithSignificantDew: daysWithDew,
                peakProbability: Math.max.apply(null, hourlyForecasts.map(function(h) { return h.probability; }).concat([0]))
            }
        };
    }

    // =========================================================================
    // MATCH DAY FORECAST
    // =========================================================================

    function generateMatchDayForecast(climateData, matchDetails) {
        if (!matchDetails || !matchDetails.date) return null;

        var forecast = generateDewForecast(climateData);
        if (forecast.error) return { error: forecast.error };

        var matchDate = matchDetails.date;
        var kickoff = safeNum(matchDetails.kickoffHour, 19);
        var durationMin = safeNum(matchDetails.durationMinutes, 120);
        var durationHours = Math.ceil(durationMin / 60);

        // Pre-match (2h before)
        var preMatchStart = kickoff - 2;
        var matchEnd = kickoff + durationHours;

        var matchHours = forecast.hourlyForecasts.filter(function(h) {
            if (h.date !== matchDate) return false;
            return h.hour >= preMatchStart && h.hour <= matchEnd;
        });

        if (matchHours.length === 0) {
            return {
                matchDate: matchDate,
                kickoffHour: kickoff,
                warning: 'No forecast data available for match window',
                recommendation: 'Check forecast data coverage'
            };
        }

        var kickoffHourData = matchHours.filter(function(h) { return h.hour === kickoff; });
        var peakMatch = Math.max.apply(null, matchHours.map(function(h) { return h.probability; }));
        var avgMatch = Math.round(matchHours.reduce(function(s, h) { return s + h.probability; }, 0) / matchHours.length);

        var recommendation;
        if (peakMatch >= 75) recommendation = 'Heavy dew expected. Deploy squeegee/roller before kick-off. Monitor ball grip.';
        else if (peakMatch >= 50) recommendation = 'Moderate dew likely. Have dew removal equipment ready.';
        else if (peakMatch >= 30) recommendation = 'Light dew possible. Standard preparation adequate.';
        else recommendation = 'Low dew risk. No special preparation needed.';

        return {
            matchDate: matchDate,
            kickoffHour: kickoff,
            durationMinutes: durationMin,
            sport: matchDetails.sport || 'AFL',
            conditions: {
                atKickoff: kickoffHourData[0] || null,
                peakProbability: peakMatch,
                averageProbability: avgMatch,
                hourByHour: matchHours
            },
            recommendation: recommendation,
            equipmentNeeded: peakMatch >= 50
        };
    }

    // =========================================================================
    // LEAF WETNESS METRICS
    // =========================================================================

    function calculateLeafWetnessMetrics(dewForecast, options) {
        options = options || {};
        if (!dewForecast || !dewForecast.hourlyForecasts) {
            return {
                totalWetHours: 0, averageWetHours: 0, consecutiveWetHours: 0,
                averageNightWetness: 0, highWetnessNights: 0, dewRiskFactor: 0,
                dewWetHours: 0, rainWetHours: 0,
                leafWetnessDuration: 0, extendedWetnessRisk: false,
                diseaseConditions: { dollarSpot: false, brownPatch: false, pythium: false, grayLeafSpot: false }
            };
        }

        var wetThreshold = options.wetThreshold || 30;
        var lookbackDays = options.lookbackDays || (dewForecast.dailyForecasts ? dewForecast.dailyForecasts.length : 3);

        var wetHours = dewForecast.hourlyForecasts.filter(function(h) {
            return h.probability >= wetThreshold || h.wetFromRain;
        });
        var dewWetHours = dewForecast.hourlyForecasts.filter(function(h) {
            return h.probability >= wetThreshold && !h.suppressedByRain;
        }).length;
        var rainWetHours = dewForecast.hourlyForecasts.filter(function(h) {
            return h.wetFromRain === true;
        }).length;

        // Consecutive wet hours
        var maxConsecutive = 0, current = 0;
        for (var i = 0; i < dewForecast.hourlyForecasts.length; i++) {
            var h = dewForecast.hourlyForecasts[i];
            if (h.probability >= wetThreshold || h.wetFromRain) {
                current++;
                if (current > maxConsecutive) maxConsecutive = current;
            } else {
                current = 0;
            }
        }

        var nightForecasts = dewForecast.hourlyForecasts.filter(function(h) { return h.isNight; });
        var avgNightWetness = nightForecasts.length > 0 ?
            nightForecasts.reduce(function(sum, f) { return sum + f.probability; }, 0) / nightForecasts.length : 0;

        var highWetnessNights = (dewForecast.dailyForecasts || []).filter(function(d) {
            return d.avgNightProbability >= 85 && d.dewHours >= 6;
        }).length;

        return {
            totalWetHours: wetHours.length,
            averageWetHours: wetHours.length / Math.max(1, lookbackDays),
            consecutiveWetHours: maxConsecutive,
            averageNightWetness: Math.round(avgNightWetness),
            highWetnessNights: highWetnessNights,
            dewRiskFactor: Math.min(1, wetHours.length / (lookbackDays * 10)),
            dewWetHours: dewWetHours,
            rainWetHours: rainWetHours,
            leafWetnessDuration: wetHours.length,
            extendedWetnessRisk: maxConsecutive >= 8,
            diseaseConditions: {
                dollarSpot: avgNightWetness >= 70,
                brownPatch: avgNightWetness >= 85 && highWetnessNights >= 2,
                pythium: avgNightWetness >= 90,
                grayLeafSpot: maxConsecutive >= 10 && avgNightWetness >= 95
            }
        };
    }

    // =========================================================================
    // MAIN ENTRY POINT
    // =========================================================================

    function analyzeDew(params) {
        params = params || {};
        var turfType = params.turfType;
        var climateData = params.climateData;
        var match = params.match;

        if (turfType !== 'sports' && turfType !== 'golf') {
            return {
                applicable: false,
                reason: 'Dew prediction only relevant for sports turf and golf contexts',
                turfType: turfType
            };
        }

        if (!climateData) {
            return {
                applicable: true,
                error: 'No climate data available',
                recommendation: 'Enable live weather or provide manual climate inputs'
            };
        }

        var forecast = generateDewForecast(climateData);
        if (forecast.error) {
            return { applicable: true, error: forecast.error, details: forecast };
        }

        var leafWetness = calculateLeafWetnessMetrics(forecast);

        var matchForecast = null;
        if (match && match.date && match.kickoffHour !== undefined) {
            matchForecast = generateMatchDayForecast(climateData, {
                date: match.date,
                kickoffHour: match.kickoffHour,
                durationMinutes: match.duration || 120,
                sport: match.sport || params.subCategory || 'AFL'
            });
        }

        var summary = {
            nextDewRisk: (forecast.dailyForecasts && forecast.dailyForecasts[0]) || null,
            weekAhead: {
                daysWithDew: forecast.summary.daysWithSignificantDew,
                totalDewHours: forecast.summary.dewLikelyHours,
                heavyDewDays: (forecast.dailyForecasts || []).filter(function(d) {
                    return d.peakIntensity === 'heavy' || d.peakIntensity === 'severe';
                }).length
            },
            diseaseRisk: {
                leafWetnessHours: leafWetness.totalWetHours,
                extendedWetness: leafWetness.extendedWetnessRisk,
                conditionsMet: leafWetness.diseaseConditions
            }
        };

        return {
            applicable: true,
            version: DEW_CONFIG.version,
            forecast: forecast,
            leafWetness: leafWetness,
            matchForecast: matchForecast,
            summary: summary,
            timestamp: new Date().toISOString()
        };
    }

    // =========================================================================
    // ORCHESTRATOR BRIDGE
    // =========================================================================

    /**
     * Bridge: translates orchestrator call signature to pure analyzeDew params.
     * Orchestrator calls: gaip_dew_prediction(dewState, weatherForDew)
     * Pure engine expects: analyzeDew({ turfType, climateData, match })
     */
    function dewBridge(state, climateData) {
        var turfType = (state && state.turfType) ||
                       (state && state.turf && state.turf.turfType) ||
                       'sports';
        var match = (state && state.match) || null;
        var subCategory = (state && state.subCategory) ||
                          (state && state.turf && state.turf.subCategory);

        return analyzeDew({
            turfType: turfType,
            climateData: climateData || (state && (state.climateData || (state.climate && state.climate.data))),
            match: match,
            subCategory: subCategory
        });
    }

    // =========================================================================
    // EXPORTS
    // =========================================================================

    global.gaip_dew_prediction = dewBridge;

    global.GAIP_DewPrediction = {
        version: DEW_CONFIG.version,
        analyze: dewBridge,
        generateDewForecast: generateDewForecast,
        generateMatchDayForecast: generateMatchDayForecast,
        calculateLeafWetnessMetrics: calculateLeafWetnessMetrics,
        calculateDewPoint: calculateDewPoint,
        calculateDewPointDepression: calculateDewPointDepression,
        calculateHourlyDewProbability: calculateHourlyDewProbability,
        estimateSurfaceTemperature: estimateSurfaceTemperature,
        isNightHour: isNightHour,
        isPeakDewHour: isPeakDewHour,
        getSoilMoistureFactor: getSoilMoistureFactor,
        config: DEW_CONFIG,
        isApplicable: function(state) {
            var tt = (state && state.turfType) || (state && state.turf && state.turf.turfType);
            return tt === 'sports' || tt === 'golf';
        }
    };

})(typeof window !== 'undefined' ? window : this);

/**
 * GILBA AGRONOMIC INTELLIGENCE HUB
 * Stress Trajectory Integration v3.0.0
 * 
 * Wires StressTrajectory results into the hub UI.
 * 
 * v3.0.0 - Moved computation onto orchestrator path (computeAll step 8a).
 *          Replaced MutationObserver + setTimeout trigger with
 *          gaip:orchestrator-complete listener. This file now handles
 *          UI rendering only — no engine calls, no global state polling.
 *          Removed: initButtonHook, hookAnalysisButton, tryRunTrajectory,
 *                   gatherEngineResults, gaip:weather-ready re-run band-aid,
 *                   isRunning/hasRun guards, initStateListener.
 * v2.2.1 - Aligned getStressLevel thresholds to engine (was 25/45/65/80, now 30/50/65/80)
 *          - Fixed summary shape references in debug logging (.currentScore not .current.score)
 *          - Refactored 3x duplicate hourly-to-daily weather aggregation into single function
 *          - Fixed stale version in init log
 * v2.2.0 - Added Climate Stress mode for golf turf types
 *          - Golf now shows thermal stress trajectory (heat/cold forecast)
 *          - Simplified display without traffic/wear components
 *          - Stores forecast peak for dashboard integration
 * v2.1.6 - Added weather fallback directly in runTrajectoryAnalysis (fixes null weather from event)
 * v2.1.5 - Fixed weather source priority (rawWeatherData first)
 * v2.1.3 - Added pre-render validation logging
 * 
 * @version 2.2.1
 * @date January 2026
 * @author Gilba Solutions
 */

(function() {
    'use strict';

    // =========================================================================
    // CONFIGURATION
    // =========================================================================
    
    var CONFIG = {
        containerId: 'gaip-trajectory-container',
        climateContainerId: 'gaip-climate-stress-container',
        projectionDays: 14,
        showSimulator: true,
        debug: false
    };
    
    // Thermal stress thresholds by grass type
    var THERMAL_THRESHOLDS = {
        c3: {
            optimal: { min: 15, max: 24 },
            heatStressOnset: 30,
            heatStressSevere: 38,
            coldStressOnset: 5,
            coldStressSevere: -5
        },
        c4: {
            optimal: { min: 27, max: 35 },
            heatStressOnset: 38,
            heatStressSevere: 45,
            coldStressOnset: 10,
            coldStressSevere: 0
        },
        bentgrass: {
            // Bentgrass is more sensitive to heat than other C3
            optimal: { min: 15, max: 22 },
            heatStressOnset: 28,
            heatStressSevere: 35,
            coldStressOnset: 5,
            coldStressSevere: -5
        }
    };

    // (No isRunning/hasRun guards needed — orchestrator handles sequencing)

    // =========================================================================
    // LOGGING HELPER
    // =========================================================================
    
    function log(message, data) {
        if (!CONFIG.debug) return;
        var prefix = '[StressTrajectory]';
        if (data !== undefined) {
        } else {
        }
    }

    function logError(message, error) {
        var prefix = '[StressTrajectory ERROR]';
        console.error(prefix, message, error);
    }

    function logWarn(message, data) {
        var prefix = '[StressTrajectory WARN]';
        if (data !== undefined) {
            console.warn(prefix, message, data);
        } else {
            console.warn(prefix, message);
        }
    }

    // =========================================================================
    // STATE DISPATCH LISTENER
    // =========================================================================

    // (State listener removed — orchestrator-complete event handles trigger)

    /**
     * Listen for orchestrator completion and render from pre-computed result.
     * v3.0.0: Replaced MutationObserver + setTimeout pattern.
     *         GAIP_StressTrajectory.project() now runs inside computeAll() step 8a.
     *         This file's job is UI rendering only.
     */
    function initOrchestratorListener() {
        document.addEventListener('gaip:orchestrator-complete', function() {
            renderFromOrchestratorResult();
        });

        // If computeAll() already ran before this listener registered,
        // GAIP_TRAJECTORY_RESULT is already populated — render immediately.
        if (window.GAIP_TRAJECTORY_RESULT) {
            log('Late init — result already available, rendering now');
            setTimeout(renderFromOrchestratorResult, 0);
        }
    }

    function renderFromOrchestratorResult() {
            console.log('[StressTrajectory] renderFromOrchestratorResult called, result:', !!window.GAIP_TRAJECTORY_RESULT);
            var result = window.GAIP_TRAJECTORY_RESULT;
            if (!result) return;

            // Golf path: climate stress UI
            if (trajectoryTurfContext.turfType === 'golf') {
                var summary = result.summary || {};
                window.GAIP_CLIMATE_STRESS_RESULT = {
                    currentStress: summary.currentScore || 0,
                    peakStress:    summary.peakScore    || 0,
                    peakDay:       summary.peakDay      || 0,
                    trajectory:    result.trajectory    || [],
                    species:       trajectoryTurfContext.species,
                    timestamp:     new Date().toISOString()
                };
                renderClimateStressUI(window.GAIP_CLIMATE_STRESS_RESULT);
                document.dispatchEvent(new CustomEvent('gaip:climate-stress-complete', {
                    detail: window.GAIP_CLIMATE_STRESS_RESULT
                }));
                return;
            }

            // Sports/general path: render full trajectory UI
            if (typeof StressTrajectoryUI === 'undefined') {
                logWarn('StressTrajectoryUI not available — cannot render');
                return;
            }

            var container = document.getElementById(CONFIG.containerId);
            if (!container) container = createContainer();
            if (!container) return;

            try {
                StressTrajectoryUI.render(CONFIG.containerId, result, {
                    showSimulator: CONFIG.showSimulator,
                    onSimulate: function(event, callback) {
                        if (typeof window.GAIP_StressTrajectory === 'undefined') {
                            callback({ canSimulate: false, reason: 'Engine not available' });
                            return;
                        }
                        // Re-gather inputs for simulation (uses same orchestrator helper)
                        var simState = (window.GAIP_STATE && window.GAIP_STATE.inputs)
                            ? { turf: window.GAIP_STATE.inputs.turf, diseaseResult: window.GAIP_DISEASE_RESULT,
                                wearResult: window.GAIP_TRAFFIC_RESULT, shadeResult: window.GAIP_SHADE_RESULT }
                            : {};
                        var simWeather = window.rawWeatherData ? (function(raw) {
                            var hourly = raw.hourly, dayTemps = {};
                            for (var i = 0; i < hourly.time.length; i++) {
                                var day = hourly.time[i].split('T')[0];
                                if (!dayTemps[day]) dayTemps[day] = { temps: [] };
                                dayTemps[day].temps.push(hourly.temperature_2m[i]);
                            }
                            var days = Object.keys(dayTemps).sort();
                            return { forecast: { daily: {
                                time: days,
                                temperature_2m_max: days.map(function(d) { return Math.max.apply(null, dayTemps[d].temps); }),
                                temperature_2m_min: days.map(function(d) { return Math.min.apply(null, dayTemps[d].temps); })
                            }}};
                        })(window.rawWeatherData) : null;
                        var simResult = window.GAIP_StressTrajectory.simulateEvent(simState, simWeather, event);
                        callback(simResult);
                    }
                });
                log('Stress trajectory UI rendered from orchestrator result');
            } catch (e) {
                logError('StressTrajectoryUI.render error:', e);
            }
    }

    // =========================================================================
    // MAIN ANALYSIS FUNCTION
    // =========================================================================

    /**
     * Run stress trajectory analysis and render results
     */
    function runTrajectoryAnalysis(state, weather, results) {
        log('=== runTrajectoryAnalysis START ===');
        
        // Golf turf: Run simplified climate stress analysis (no traffic/wear)
        if (trajectoryTurfContext.turfType === 'golf') {
            log('Golf turf detected - running climate stress analysis');
            runClimateStressAnalysis(state, weather, results);
            return;
        }
        
        // Set running flag
        isRunning = true;
        
        // =====================================================================
        // WEATHER FALLBACK LOGIC - ensures weather is available regardless of
        // how this function is called (event listener or direct call)
        // =====================================================================
        if (!weather) {
            log('Weather is null - attempting fallback sources...');
            
            // Priority 1: rawWeatherData from Climate Engine (has hourly data)
            if (typeof window.rawWeatherData !== 'undefined' && window.rawWeatherData.hourly) {
                // PATCH v2.2.1: Use shared aggregateHourlyWeather() (was inline duplicate)
                weather = aggregateHourlyWeather(window.rawWeatherData);
                var dayCount = weather.forecast.daily.time.length;
                log('Weather converted from window.rawWeatherData (' + dayCount + ' days)');
            }
            // Priority 2: GAIP_LAST_WEATHER
            else if (typeof window.GAIP_LAST_WEATHER !== 'undefined' && window.GAIP_LAST_WEATHER) {
                weather = window.GAIP_LAST_WEATHER;
                log('Weather found via window.GAIP_LAST_WEATHER');
            }
            // Priority 3: state.weatherData
            else if (state && state.weatherData) {
                weather = state.weatherData;
                log('Weather found via state.weatherData');
            }
            // Priority 4: climateMetrics dailyPattern
            else if (typeof window.climateMetrics !== 'undefined' && window.climateMetrics.growth && window.climateMetrics.growth.dailyPattern) {
                var cm = window.climateMetrics;
                weather = {
                    daily: {
                        temperature_2m_max: cm.growth.dailyPattern.map(function(d) { return d.tempMax; }),
                        temperature_2m_min: cm.growth.dailyPattern.map(function(d) { return d.tempMin; }),
                        precipitation_sum: cm.growth.dailyPattern.map(function() { return 0; })
                    }
                };
                log('Weather constructed from climateMetrics.growth.dailyPattern');
            }
            else {
                logWarn('No weather data found from any source - projections will be limited');
            }
        }
        
        // Check dependencies
        if (typeof window.GAIP_StressTrajectory === 'undefined') {
            logError('GAIP_StressTrajectory not available');
            isRunning = false;
            return;
        }

        if (typeof StressTrajectoryUI === 'undefined') {
            logError('StressTrajectoryUI not available');
            return;
        }
        log('Both engine and UI modules available');

        // Ensure container exists
        var container = document.getElementById(CONFIG.containerId);
        log('Looking for container #' + CONFIG.containerId + ':', container ? 'FOUND' : 'NOT FOUND');
        
        if (!container) {
            log('Creating container...');
            container = createContainer();
        }

        if (!container) {
            logError('Could not create trajectory container');
            return;
        }
        log('Container ready');

        // Merge engine results into state
        if (results) {
            var merged = [];
            for (var key in results) {
                if (results.hasOwnProperty(key)) {
                    state[key] = results[key];
                    merged.push(key);
                }
            }
            if (merged.length > 0) {
                log('Merged engine results into state:', merged.join(', '));
            }
        }

        // Show loading state
        container.innerHTML = '<div class="gaip-trajectory-loading" style="padding: 20px; text-align: center; color: var(--gaip-text);">' +
                              '<span style="font-size: 24px;">📊</span><br>' +
                              'Calculating stress trajectory...</div>';

        // Run projection (slight delay to allow UI update)
        setTimeout(function() {
            log('setTimeout fired - starting projection');
            try {
                log('About to call GAIP_StressTrajectory.project()');
                log('State passed:', state ? 'exists' : 'null');
                log('Weather passed:', weather ? 'exists' : 'null');
                log('Options:', { days: CONFIG.projectionDays });
                
                var startTime = performance.now();
                
                var result = window.GAIP_StressTrajectory.project(state, weather, {
                    days: CONFIG.projectionDays
                });
                
                var elapsed = Math.round(performance.now() - startTime);
                log('Projection completed in ' + elapsed + 'ms');
                
                if (!result) {
                    logError('Engine returned null/undefined result');
                    container.innerHTML = '<div style="padding: 20px; color: #ef4444;">Engine returned no result</div>';
                    return;
                }
                
                log('Result summary:', {
                    trajectoryDays: result.trajectory ? result.trajectory.length : 'NO TRAJECTORY',
                    currentScore: result.summary ? result.summary.currentScore : 'NO SUMMARY',  // PATCH v2.2.1: was .current.score
                    peakScore: result.summary ? result.summary.peakScore : 'NO PEAK',            // PATCH v2.2.1: was .peak.score
                    trend: result.summary ? result.summary.trend : 'NO TREND',
                    criticalPoints: result.criticalPoints ? result.criticalPoints.length : 'NO CP',
                    interventionWindows: result.interventionWindows ? result.interventionWindows.length : 'NO IW'
                });

                // Store for other modules
                window.GAIP_TRAJECTORY_RESULT = result;
                log('Result stored in window.GAIP_TRAJECTORY_RESULT');

                // Pre-render validation - check if result has required structure
                if (!result.trajectory || !Array.isArray(result.trajectory) || result.trajectory.length === 0) {
                    logWarn('Result has no valid trajectory data - UI will show placeholder');
                }

                // Render
                log('About to call StressTrajectoryUI.render()');
                log('Container ID:', CONFIG.containerId);
                log('StressTrajectoryUI exists:', typeof StressTrajectoryUI !== 'undefined');
                log('StressTrajectoryUI.render exists:', typeof StressTrajectoryUI.render === 'function');
                
                StressTrajectoryUI.render(CONFIG.containerId, result, {
                    showSimulator: CONFIG.showSimulator,
                    onSimulate: function(event, callback) {
                        log('Event simulation requested:', event);
                        var simResult = window.GAIP_StressTrajectory.simulateEvent(state, weather, event);
                        log('Simulation result:', simResult.recommendation);
                        callback(simResult);
                    }
                });

                log('=== Stress Trajectory COMPLETE ===');
                if (result.summary && result.summary.headline) {
                    log('Headline:', result.summary.headline);
                }
                
                // Mark as complete
                isRunning = false;
                hasRun = true;

            } catch (e) {
                logError('Stress Trajectory error:', e);
                console.error(e.stack);
                container.innerHTML = '<div class="gaip-trajectory-error" style="padding: 20px; color: #ef4444;">' +
                                      '<strong>Trajectory Analysis Error:</strong> ' + e.message + 
                                      '<br><small>Check console for details</small></div>';
                // Clear running flag but mark as run to prevent loop
                isRunning = false;
                hasRun = true;
            }
        }, 50);
    }

    /**
     * Create trajectory container in results section
     */
    function createContainer() {
        log('createContainer called');
        
        // Find results section - try multiple selectors
        var resultsSection = document.getElementById('gaip-results');
        if (resultsSection) {
            log('Found results section by ID: gaip-results');
        }
        
        if (!resultsSection) {
            resultsSection = document.querySelector('.gaip-results');
            if (resultsSection) {
                log('Found results section by class: .gaip-results');
            }
        }
        
        if (!resultsSection) {
            resultsSection = document.querySelector('.gaip-output');
            if (resultsSection) {
                log('Found results section by class: .gaip-output');
            }
        }

        if (!resultsSection) {
            logWarn('Could not find results section for trajectory container');
            log('Tried: #gaip-results, .gaip-results, .gaip-output');
            return null;
        }

        // Create container
        var container = document.createElement('div');
        container.id = CONFIG.containerId;
        container.className = 'gaip-result-block';
        container.setAttribute('data-section', 'trajectory');
        container.style.marginTop = '24px';

        // Insert after disease section if it exists, otherwise at end
        var diseaseSection = resultsSection.querySelector('[data-section="disease"]');
        if (diseaseSection) {
            var dsParent = diseaseSection.parentNode || resultsSection;
            if (diseaseSection.nextSibling) {
                dsParent.insertBefore(container, diseaseSection.nextSibling);
            } else {
                dsParent.appendChild(container);
            }
            log('Container inserted after disease section');
        } else {
            resultsSection.appendChild(container);
            log('Container appended to end of results section');
        }

        return container;
    }

    // =========================================================================
    // MANUAL TRIGGER
    // =========================================================================

    /**
     * Expose manual trigger for testing
     */
    window.runStressTrajectory = function(state, weather) {
        log('Manual trigger called via window.runStressTrajectory()');
        if (!state && typeof window.gaip_build_state === 'function') {
            var formContainer = document.querySelector('#gaip-hub');
            if (formContainer) {
                state = window.gaip_build_state(formContainer);
                log('Built state from gaip_build_state()');
            }
        }
        if (!weather && typeof window.GAIP_LAST_WEATHER !== 'undefined') {
            weather = window.GAIP_LAST_WEATHER;
            log('Using weather from GAIP_LAST_WEATHER');
        }
        runTrajectoryAnalysis(state, weather, gatherEngineResults());
    };

    // Expose debug function
    window.debugStressTrajectory = function() {
    };

    // =========================================================================
    // INITIALIZATION
    // =========================================================================

    function init() {
        log('=== Stress Trajectory Integration v3.0.0 INIT ===');
        log('Debug mode:', CONFIG.debug);
        
        // Check engine loaded
        if (typeof window.GAIP_StressTrajectory === 'undefined') {
            logWarn('GAIP_StressTrajectory not found at init — will be called from computeAll when loaded');
        } else {
            log('StressTrajectoryEngine ready, version:', window.GAIP_StressTrajectory.version);
        }
        
        if (typeof StressTrajectoryUI === 'undefined') {
            logWarn('StressTrajectoryUI not found at init — UI will not render until available');
        } else {
            log('StressTrajectoryUI ready');
        }
        
        // v3.0.0: Orchestrator-path listener replaces MutationObserver + state-dispatch hooks
        initOrchestratorListener();
        
        log('Integration initialized — listening for gaip:orchestrator-complete');
        log('=================================================');
    }

    // =========================================================================
    // CLIMATE STRESS ANALYSIS (for Golf turf types)
    // Simplified stress trajectory focusing on thermal stress without traffic/wear
    // =========================================================================
    
    /**
     * Calculate thermal stress score from temperature
     */
    function calculateThermalStress(temp, thresholds) {
        var opt = thresholds.optimal;
        
        // Within optimal range
        if (temp >= opt.min && temp <= opt.max) {
            return 0;
        }
        
        // Heat stress
        if (temp > opt.max) {
            if (temp >= thresholds.heatStressSevere) {
                return 100;
            }
            if (temp >= thresholds.heatStressOnset) {
                var range = thresholds.heatStressSevere - thresholds.heatStressOnset;
                var excess = temp - thresholds.heatStressOnset;
                return 35 + (excess / range) * 65;
            }
            // Between optimal max and onset
            var range = thresholds.heatStressOnset - opt.max;
            var excess = temp - opt.max;
            return (excess / range) * 35;
        }
        
        // Cold stress
        if (temp < opt.min) {
            if (temp <= thresholds.coldStressSevere) {
                return 100;
            }
            if (temp <= thresholds.coldStressOnset) {
                var range = thresholds.coldStressOnset - thresholds.coldStressSevere;
                var deficit = thresholds.coldStressOnset - temp;
                return 35 + (deficit / range) * 65;
            }
            // Between optimal min and onset
            var range = opt.min - thresholds.coldStressOnset;
            var deficit = opt.min - temp;
            return (deficit / range) * 35;
        }
        
        return 0;
    }
    
    /**
     * Get thermal thresholds for species
     */
    function getThermalThresholds(species, isC4) {
        if (isC4) return THERMAL_THRESHOLDS.c4;
        
        var speciesLower = (species || '').toLowerCase();
        if (speciesLower.indexOf('bentgrass') !== -1 || speciesLower.indexOf('bent') !== -1) {
            return THERMAL_THRESHOLDS.bentgrass;
        }
        
        return THERMAL_THRESHOLDS.c3;
    }
    
    /**
     * Run climate stress analysis for golf turf
     * Shows thermal stress trajectory without traffic/wear components
     */
    function runClimateStressAnalysis(state, weather, results) {
        log('=== runClimateStressAnalysis START (Golf mode) ===');
        
        // Get weather data
        if (!weather) {
            // Try fallback sources
            if (typeof window.rawWeatherData !== 'undefined' && window.rawWeatherData.daily) {
                weather = { forecast: { daily: window.rawWeatherData.daily } };
                log('Weather from rawWeatherData.daily');
            } else if (typeof window.rawWeatherData !== 'undefined' && window.rawWeatherData.hourly) {
                // Aggregate hourly to daily
                weather = aggregateHourlyWeather(window.rawWeatherData);
                log('Weather aggregated from rawWeatherData.hourly');
            }
        }
        
        if (!weather || !weather.forecast || !weather.forecast.daily) {
            log('No weather data available for climate stress analysis');
            return;
        }
        
        var daily = weather.forecast.daily;
        var maxTemps = daily.temperature_2m_max || [];
        var minTemps = daily.temperature_2m_min || [];
        var times = daily.time || [];
        
        if (maxTemps.length === 0) {
            log('No temperature forecast data');
            return;
        }
        
        // Get thresholds for this species
        var thresholds = getThermalThresholds(
            trajectoryTurfContext.species,
            trajectoryTurfContext.isC4
        );
        log('Using thermal thresholds:', thresholds);
        
        // Calculate daily stress trajectory
        var trajectory = [];
        var peakStress = 0;
        var peakDay = 0;
        var currentStress = 0;
        
        for (var i = 0; i < Math.min(maxTemps.length, 8); i++) {
            var maxTemp = maxTemps[i];
            var minTemp = minTemps[i] || maxTemp - 10;
            var meanTemp = (maxTemp + minTemp) / 2;
            
            // Heat stress from max temp (peak of day stress)
            var heatStress = calculateThermalStress(maxTemp, thresholds);
            // Cold stress from min temp (night stress)
            var coldStress = calculateThermalStress(minTemp, thresholds);
            
            // Combined thermal stress (weighted toward max as heat is more damaging in summer)
            var thermalStress = Math.max(heatStress, coldStress);
            
            // Add disease modifier if available
            var diseaseStress = 0;
            if (results && results.diseaseResult) {
                var diseaseRisk = results.diseaseResult.overall || 0;
                diseaseStress = diseaseRisk * 0.3; // 30% weight
            }
            
            // Combined stress (thermal dominant for golf)
            var combinedStress = Math.min(100, thermalStress * 0.7 + diseaseStress);
            
            trajectory.push({
                day: i,
                date: times[i] || 'Day ' + (i + 1),
                maxTemp: maxTemp,
                minTemp: minTemp,
                thermalStress: Math.round(thermalStress),
                diseaseStress: Math.round(diseaseStress),
                combined: Math.round(combinedStress),
                level: getStressLevel(combinedStress)
            });
            
            if (i === 0) {
                currentStress = combinedStress;
            }
            
            if (combinedStress > peakStress) {
                peakStress = combinedStress;
                peakDay = i;
            }
        }
        
        // Store result for dashboard
        window.GAIP_CLIMATE_STRESS_RESULT = {
            currentStress: Math.round(currentStress),
            peakStress: Math.round(peakStress),
            peakDay: peakDay,
            trajectory: trajectory,
            thresholds: thresholds,
            species: trajectoryTurfContext.species,
            timestamp: new Date().toISOString()
        };
        
        log('Climate stress result:', window.GAIP_CLIMATE_STRESS_RESULT);
        
        // Also store as trajectory result for dashboard compatibility
        window.GAIP_TRAJECTORY_RESULT = {
            summary: {
                currentScore: Math.round(currentStress),
                currentLevel: getStressLevel(currentStress),
                peakScore: Math.round(peakStress),
                peakDay: peakDay,
                trend: peakStress > currentStress + 10 ? 'RISING' : 
                       peakStress < currentStress - 10 ? 'FALLING' : 'STABLE'
            },
            trajectory: trajectory,
            mode: 'climate'
        };
        
        // Render the climate stress UI
        renderClimateStressUI(window.GAIP_CLIMATE_STRESS_RESULT);
        
        // Dispatch event for dashboard
        document.dispatchEvent(new CustomEvent('gaip:climate-stress-complete', {
            detail: window.GAIP_CLIMATE_STRESS_RESULT
        }));
    }
    
    /**
     * Aggregate hourly weather to daily
     */
    function aggregateHourlyWeather(raw) {
        // PATCH v2.2.1: Single source for hourly-to-daily aggregation (was duplicated 3x)
        var hourly = raw.hourly;
        var dayTemps = {};
        
        for (var i = 0; i < hourly.time.length; i++) {
            var day = hourly.time[i].split('T')[0];
            if (!dayTemps[day]) {
                dayTemps[day] = { temps: [], precip: 0 };
            }
            dayTemps[day].temps.push(hourly.temperature_2m[i]);
            if (hourly.precipitation && hourly.precipitation[i]) {
                dayTemps[day].precip += hourly.precipitation[i];
            }
        }
        
        var weather = {
            forecast: {
                daily: {
                    temperature_2m_max: [],
                    temperature_2m_min: [],
                    precipitation_sum: [],
                    time: []
                }
            }
        };
        
        var days = Object.keys(dayTemps).sort();
        for (var d = 0; d < days.length; d++) {
            var dayData = dayTemps[days[d]];
            weather.forecast.daily.time.push(days[d]);
            weather.forecast.daily.temperature_2m_max.push(Math.max.apply(null, dayData.temps));
            weather.forecast.daily.temperature_2m_min.push(Math.min.apply(null, dayData.temps));
            weather.forecast.daily.precipitation_sum.push(dayData.precip);
        }
        
        return weather;
    }
    
    /**
     * Get stress level label
     */
    function getStressLevel(score) {
        // PATCH v2.2.1: Aligned to engine thresholds (was 25/45/65/80)
        if (score < 30) return 'normal';
        if (score < 50) return 'caution';
        if (score < 65) return 'warning';
        if (score < 80) return 'critical';
        return 'failure';
    }
    
    /**
     * Render climate stress UI for golf
     */
    function renderClimateStressUI(result) {
        // Find or create container
        var container = document.getElementById(CONFIG.climateContainerId);
        if (!container) {
            // Find results container
            var resultsContainer = document.querySelector('.gaip-results, .gaip-output, .gaip-results-container, [data-hub-results]');
            if (!resultsContainer) {
                log('Results container not found for climate stress UI');
                return;
            }
            
            container = document.createElement('div');
            container.id = CONFIG.climateContainerId;
            container.className = 'gaip-climate-stress-panel';
            
            // Insert after disease or at end
            var diseaseCard = resultsContainer.querySelector('.gaip-disease-card, .gilba-card-disease, [data-disease-results]');
            if (diseaseCard && diseaseCard.nextSibling) {
                diseaseCard.parentNode.insertBefore(container, diseaseCard.nextSibling);
            } else {
                resultsContainer.appendChild(container);
            }
        }
        
        var trajectory = result.trajectory || [];
        var current = result.currentStress || 0;
        var peak = result.peakStress || 0;
        var peakDay = result.peakDay || 0;
        var trend = peak > current + 10 ? 'rising' : peak < current - 10 ? 'falling' : 'stable';
        
        // Determine severity colors
        var currentLevel = getStressLevel(current);
        var peakLevel = getStressLevel(peak);
        
        var levelColors = {
            normal: '#22c55e',
            caution: '#eab308',
            warning: '#f97316',
            critical: '#ef4444',
            failure: '#7f1d1d'
        };
        
        // Build mini chart
        var chartBars = trajectory.map(function(day, i) {
            var height = Math.max(day.combined, 5);
            var color = levelColors[day.level] || 'var(--gaip-text-secondary)';
            var isToday = i === 0;
            var isPeak = i === peakDay;
            
            return '<div class="climate-bar' + (isToday ? ' today' : '') + (isPeak ? ' peak' : '') + '" ' +
                   'style="height: ' + height + '%; background: ' + color + ';" ' +
                   'title="Day ' + (i + 1) + ': ' + day.combined + '% (' + Math.round(day.maxTemp) + '°C)">' +
                   '<span class="bar-label">' + Math.round(day.maxTemp) + '°</span>' +
                   '</div>';
        }).join('');
        
        // Build alert message if needed
        var alertHTML = '';
        if (peak >= 65) {
            var peakDate = trajectory[peakDay] ? trajectory[peakDay].date : 'Day ' + (peakDay + 1);
            var peakTemp = trajectory[peakDay] ? Math.round(trajectory[peakDay].maxTemp) : '?';
            alertHTML = '<div class="climate-alert critical">' +
                       '🔥 <strong>Critical heat stress forecast:</strong> ' + peakTemp + '°C on ' + formatDate(peakDate) + 
                       ' — Prepare syringe cooling, monitor canopy temps' +
                       '</div>';
        } else if (peak >= 45) {
            alertHTML = '<div class="climate-alert warning">' +
                       '⚠️ <strong>Elevated stress expected:</strong> Monitor closely, ensure adequate irrigation' +
                       '</div>';
        }
        
        // Render
        container.innerHTML = 
            '<div class="gilba-card climate-stress-card">' +
                '<div class="gilba-card-header" style="display: flex; justify-content: space-between; align-items: center; padding: 12px 16px; background: linear-gradient(135deg, var(--gaip-warning-bg) 0%, var(--gaip-warning-border) 100%); border-radius: 8px 8px 0 0;">' +
                    '<h3 style="margin: 0; font-size: 14px; font-weight: 600; color: #92400e; display: flex; align-items: center; gap: 8px;">' +
                        '<span style="font-size: 18px;">🌡️</span> Climate Stress Forecast' +
                    '</h3>' +
                    '<span class="stress-badge ' + currentLevel + '" style="padding: 4px 10px; border-radius: 12px; font-size: 11px; font-weight: 600; background: ' + levelColors[currentLevel] + '; color: var(--gaip-surface);">' +
                        current + '% ' + currentLevel.charAt(0).toUpperCase() + currentLevel.slice(1) +
                    '</span>' +
                '</div>' +
                '<div class="gilba-card-body" style="padding: 16px;">' +
                    alertHTML +
                    '<div class="climate-summary" style="display: grid; grid-template-columns: repeat(3, 1fr); gap: 12px; margin-bottom: 16px;">' +
                        '<div class="summary-item" style="text-align: center; padding: 12px; background: var(--gaip-surface-muted); border-radius: 6px;">' +
                            '<div style="font-size: 11px; color: var(--gaip-text); text-transform: uppercase;">Current</div>' +
                            '<div style="font-size: 24px; font-weight: 700; color: ' + levelColors[currentLevel] + ';">' + current + '%</div>' +
                        '</div>' +
                        '<div class="summary-item" style="text-align: center; padding: 12px; background: var(--gaip-surface-muted); border-radius: 6px;">' +
                            '<div style="font-size: 11px; color: var(--gaip-text); text-transform: uppercase;">Peak (Day ' + (peakDay + 1) + ')</div>' +
                            '<div style="font-size: 24px; font-weight: 700; color: ' + levelColors[peakLevel] + ';">' + peak + '%</div>' +
                        '</div>' +
                        '<div class="summary-item" style="text-align: center; padding: 12px; background: var(--gaip-surface-muted); border-radius: 6px;">' +
                            '<div style="font-size: 11px; color: var(--gaip-text); text-transform: uppercase;">Trend</div>' +
                            '<div style="font-size: 24px; font-weight: 700; color: ' + (trend === 'rising' ? '#ef4444' : trend === 'falling' ? '#22c55e' : 'var(--gaip-text-secondary)') + ';">' +
                                (trend === 'rising' ? '↗' : trend === 'falling' ? '↘' : '→') +
                            '</div>' +
                        '</div>' +
                    '</div>' +
                    '<div class="climate-chart" style="display: flex; align-items: flex-end; gap: 4px; height: 80px; padding: 8px 0; border-top: 1px solid var(--gaip-border);">' +
                        chartBars +
                    '</div>' +
                    '<div class="climate-legend" style="display: flex; justify-content: space-between; font-size: 10px; color: var(--gaip-text); margin-top: 4px;">' +
                        '<span>Today</span>' +
                        '<span>8-day forecast</span>' +
                    '</div>' +
                '</div>' +
            '</div>' +
            '<style>' +
                '.climate-stress-card .climate-bar { flex: 1; min-width: 20px; border-radius: 3px 3px 0 0; position: relative; transition: all 0.2s; }' +
                '.climate-stress-card .climate-bar:hover { opacity: 0.8; transform: scaleY(1.05); transform-origin: bottom; }' +
                '.climate-stress-card .climate-bar.today { box-shadow: 0 0 0 2px #3b82f6; }' +
                '.climate-stress-card .climate-bar.peak { box-shadow: 0 0 0 2px #ef4444; }' +
                '.climate-stress-card .bar-label { position: absolute; top: -18px; left: 50%; transform: translateX(-50%); font-size: 9px; color: var(--gaip-text); white-space: nowrap; }' +
                '.climate-stress-card .climate-alert { padding: 10px 12px; border-radius: 6px; margin-bottom: 12px; font-size: 12px; }' +
                '.climate-stress-card .climate-alert.critical { background: var(--gaip-critical-bg); border: 1px solid var(--gaip-critical-border); color: #991b1b; }' +
                '.climate-stress-card .climate-alert.warning { background: var(--gaip-warning-bg); border: 1px solid var(--gaip-warning-border); color: #92400e; }' +
            '</style>';
        
        log('Climate stress UI rendered');
    }
    
    /**
     * Format date for display
     */
    function formatDate(dateStr) {
        if (!dateStr || dateStr.indexOf('Day') === 0) return dateStr;
        try {
            var d = new Date(dateStr);
            var days = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
            var months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
            return days[d.getDay()] + ' ' + d.getDate() + ' ' + months[d.getMonth()];
        } catch (e) {
            return dateStr;
        }
    }

    // =========================================================================
    // TURF PROFILE LISTENER
    // Updates stress trajectory context based on turf type selection
    // =========================================================================
    
    var trajectoryTurfContext = {
        turfType: null,
        subCategory: null,
        species: null,
        isC4: false,
        description: ''
    };
    
    function handleTurfProfileChange(event) {
        var detail = event.detail;
        
        trajectoryTurfContext.turfType = detail.turfType;
        trajectoryTurfContext.subCategory = detail.subCategory;
        trajectoryTurfContext.species = detail.species;
        trajectoryTurfContext.isC4 = detail.isC4 || false;
        trajectoryTurfContext.description = detail.thresholds ? detail.thresholds.description : '';
        
        log('Turf context updated:', trajectoryTurfContext);
    }
    
    // Listen for turf profile changes
    document.addEventListener('gaip:turf-profile-change', handleTurfProfileChange);
    
    // Expose context getter for diagnostics
    window.gaip_trajectory_getTurfContext = function() {
        return trajectoryTurfContext;
    };

    // =========================================================================
    // MANUAL TRIGGER (kept for console debugging)
    // =========================================================================

    window.runStressTrajectory = function() {
        log('Manual trigger — use window.GilbaHub.compute() to re-run the full orchestrator');
        if (typeof window.GilbaHub !== 'undefined') {
            window.GilbaHub.compute();
        }
    };

    // Run on load
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', init);
    } else {
        init();
    }

    log('Stress Trajectory Integration v3.0.0 loaded (orchestrator path)');

})();

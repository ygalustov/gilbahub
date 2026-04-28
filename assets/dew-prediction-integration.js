/**
 * =============================================================================
 * GILBA DEW PREDICTION INTEGRATION v1.0.0
 * =============================================================================
 * 
 * Wires DewPredictionEngine into the hub analysis flow.
 * - Only activates for sports turf contexts
 * - Renders to #gaip-dew-output container
 * - Publishes leaf wetness data for disease engine consumption
 * 
 * INTEGRATION POINTS:
 * - Listens for analysis-complete event
 * - Reads climate data from hub state
 * - Renders via GAIP_DewUI
 * - Exposes window.GAIP_DEW_RESULT for disease engine and PDF export
 * 
 * =============================================================================
 */

(function() {
    'use strict';

    // =========================================================================
    // CONFIGURATION
    // =========================================================================

    const CONFIG = {
        containerId: 'gaip-dew-output',
        sectionId: 'gaip-dew-section',
        debug: false
    };

    let hasRun = false;
    let isRunning = false;

    // =========================================================================
    // LOGGING
    // =========================================================================

    function log(message, data) {
        if (!CONFIG.debug) return;
        if (data !== undefined) {
        } else {
        }
    }

    function logError(message, error) {
        console.error('[DewIntegration ERROR]', message, error);
    }

    // =========================================================================
    // TURF TYPE DETECTION
    // =========================================================================

    /**
     * Check if current turf type is sports
     */
    function isSportsTurf(state) {
        // Check multiple sources
        const turfType = state?.turfType || 
                        state?.turf?.turfType || 
                        document.querySelector('.gaip-turf-type-option.active')?.dataset?.type;
        
        // Dew prediction is applicable to sports turf AND golf (greens benefit from dew management)
        return turfType === 'sports' || turfType === 'golf';
    }

    /**
     * Show/hide dew section based on turf type
     */
    function updateSectionVisibility(show) {
        const section = document.getElementById(CONFIG.sectionId);
        if (section) {
            section.style.display = show ? 'block' : 'none';
            log('Dew section visibility:', show ? 'shown' : 'hidden');
        }
    }

    // =========================================================================
    // STATE EXTRACTION
    // =========================================================================

    /**
     * Extract climate data from hub state
     */
    function extractClimateData(state) {
        // Try multiple sources
        if (state?.climateData?.forecast?.hourly) {
            return state.climateData;
        }
        
        if (state?.climate?.forecast?.hourly) {
            return state.climate;
        }
        
        // Try window.rawWeatherData (set by hub-tissue-v3.js after weather fetch)
        if (window.rawWeatherData?.forecast?.hourly) {
            log('Using rawWeatherData');
            return window.rawWeatherData;
        }
        
        // Try window global GAIP_CLIMATE_DATA
        if (window.GAIP_CLIMATE_DATA?.forecast?.hourly) {
            return window.GAIP_CLIMATE_DATA;
        }
        
        // Try climateMetrics (from GAIP_STATE)
        if (window.GAIP_STATE?.climateMetrics) {
            log('climateMetrics found but may not have hourly data');
        }
        
        return null;
    }

    /**
     * Extract match schedule from state
     */
    function extractMatchData(state) {
        // Check for match inputs in DOM
        const matchSport = document.querySelector('.gaip-match-sport')?.value;
        const matchesWeek = document.querySelector('.gaip-matches-week')?.value;
        const matchDuration = document.querySelector('.gaip-match-duration')?.value;
        
        if (!matchSport && !state?.match) {
            return null;
        }
        
        return {
            sport: matchSport || state?.match?.sport || 'AFL',
            matchesPerWeek: parseFloat(matchesWeek) || state?.match?.matchesPerWeek || 2,
            duration: parseFloat(matchDuration) || state?.match?.duration || 1.5,
            // Future: specific match dates/times
            date: state?.match?.date || null,
            kickoffHour: state?.match?.kickoffHour || null
        };
    }

    // =========================================================================
    // DEW ANALYSIS
    // =========================================================================

    /**
     * Run dew prediction analysis
     */
    function runDewAnalysis(state) {
        if (isRunning) {
            log('Already running - skipping');
            return;
        }
        
        // Check turf type first
        if (!isSportsTurf(state)) {
            log('Not sports turf - dew prediction not applicable');
            updateSectionVisibility(false);
            window.GAIP_DEW_RESULT = { applicable: false, reason: 'Not sports turf' };
            return;
        }
        
        // Show the section
        updateSectionVisibility(true);
        
        // Check dependencies
        if (typeof GAIP_DewPrediction === 'undefined') {
            logError('GAIP_DewPrediction engine not loaded');
            renderError('Dew prediction engine not available');
            return;
        }
        
        if (typeof GAIP_DewUI === 'undefined') {
            logError('GAIP_DewUI not loaded');
            renderError('Dew prediction UI not available');
            return;
        }
        
        isRunning = true;
        log('Running dew analysis...');
        
        try {
            // Extract climate data
            const climateData = extractClimateData(state);
            
            if (!climateData) {
                log('No climate data available');
                renderError('Climate data required for dew prediction. Enable live weather or enter manual conditions.');
                isRunning = false;
                return;
            }
            
            // Extract match data if available
            const matchData = extractMatchData(state);
            
            // Build analysis state
            const analysisState = {
                turfType: 'sports',
                turf: state?.turf || { turfType: 'sports' },
                climateData: climateData,
                climate: { data: climateData },
                match: matchData,
                subCategory: state?.subCategory || state?.turf?.subCategory || 'AFL'
            };
            
            log('Analysis state prepared', {
                hasClimateData: !!climateData,
                hasHourlyData: !!climateData?.forecast?.hourly,
                hasMatchData: !!matchData
            });
            
            // Run dew analysis
            const result = GAIP_DewPrediction.analyze(analysisState, climateData);
            
            log('Dew analysis complete', {
                applicable: result.applicable,
                error: result.error,
                hasForecast: !!result.forecast,
                hasLeafWetness: !!result.leafWetness
            });
            
            // Store result globally for disease engine and PDF export
            window.GAIP_DEW_RESULT = result;
            
            // Dispatch event for disease engine integration
            document.dispatchEvent(new CustomEvent('gaip:dew-analysis-complete', {
                detail: {
                    result: result,
                    leafWetness: result.leafWetness
                }
            }));
            
            // Render UI
            renderDewUI(result);
            
            hasRun = true;
            
        } catch (error) {
            logError('Dew analysis failed:', error);
            renderError('Analysis error: ' + error.message);
        } finally {
            isRunning = false;
        }
    }

    // =========================================================================
    // RENDERING
    // =========================================================================

    /**
     * Render dew prediction UI
     */
    function renderDewUI(result) {
        const container = document.getElementById(CONFIG.containerId);
        if (!container) {
            logError('Dew output container not found');
            return;
        }
        
        if (!result.applicable) {
            container.innerHTML = `
                <div class="gaip-dew-not-applicable">
                    <p style="color: var(--gaip-text); font-size: 0.9rem;">
                        ${result.reason || 'Dew prediction only available for sports turf contexts.'}
                    </p>
                </div>
            `;
            return;
        }
        
        if (result.error) {
            renderError(result.error, result.recommendation);
            return;
        }
        
        // GAIP_DewUI.render sets innerHTML directly, don't capture return value
        // Pass the result as state with turfType set so it renders properly
        const renderState = {
            turfType: 'sports',
            turf: { turfType: 'sports' },
            dewResult: result,
            climateData: result.climateData
        };
        
        // Build HTML manually using the result data
        const dewData = result;
        
        // Get severity helpers
        const getSeverityColor = (level) => {
            const colors = { none: '#10b981', light: '#10b981', moderate: '#f59e0b', heavy: '#ef4444', severe: '#dc2626' };
            return colors[level] || 'var(--gaip-text-secondary)';
        };
        
        const getSeverityBg = (level) => {
            const bgs = { none: 'var(--gaip-good-bg)', light: 'var(--gaip-good-bg)', moderate: 'var(--gaip-warning-bg)', heavy: 'var(--gaip-critical-bg)', severe: 'var(--gaip-critical-bg)' };
            return bgs[level] || 'var(--gaip-surface-hover)';
        };
        
        const today = dewData.forecast?.dailyForecasts?.[0];
        const tomorrow = dewData.forecast?.dailyForecasts?.[1];
        const currentRisk = today || tomorrow;
        const riskLevel = currentRisk?.peakIntensity || 'none';
        const riskColor = getSeverityColor(riskLevel);
        const summary = dewData.summary;
        
        // Check for recent precipitation (last 6 hours)
        const checkRecentPrecipitation = () => {
            const hourly = window.rawWeatherData?.forecast?.hourly;
            if (!hourly?.precipitation || !hourly?.time) return { hasRain: false, total: 0 };
            
            const now = new Date();
            const sixHoursAgo = new Date(now.getTime() - 6 * 60 * 60 * 1000);
            
            let recentPrecip = 0;
            for (let i = 0; i < Math.min(hourly.time.length, 24); i++) {
                const hourTime = new Date(hourly.time[i]);
                if (hourTime >= sixHoursAgo && hourTime <= now) {
                    recentPrecip += hourly.precipitation[i] || 0;
                }
            }
            
            return { hasRain: recentPrecip >= 1.0, total: recentPrecip };
        };
        
        const recentRain = checkRecentPrecipitation();
        const wetFromRain = recentRain.hasRain;
        
        // Adjust display when wet from rain
        const displayLabel = wetFromRain ? 'Rain Wet' : 
                            (riskLevel === 'none' ? 'Low Risk' : riskLevel.charAt(0).toUpperCase() + riskLevel.slice(1));
        const displayColor = wetFromRain ? '#3b82f6' : riskColor; // Blue for rain
        const displayBg = wetFromRain ? 'var(--gaip-info-bg)' : getSeverityBg(riskLevel);
        
        container.innerHTML = `
            <div class="gaip-dew-module">
                <div class="gaip-dew-card" style="border-left: 4px solid ${displayColor}; padding: 16px; background: var(--gaip-surface); border-radius: 8px; margin-bottom: 12px;">
                    <div class="gaip-dew-header" style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 12px;">
                        <div style="display: flex; align-items: center; gap: 8px;">
                            <span>${wetFromRain ? '🌧️' : '💧'}</span>
                            <span style="font-weight: 600;">${wetFromRain ? 'Surface Wetness' : 'Dew Forecast'}</span>
                            <span style="background: ${displayBg}; color: ${displayColor}; padding: 2px 8px; border-radius: 4px; font-size: 0.85rem;">
                                ${displayLabel}
                            </span>
                        </div>
                    </div>
                    
                    <div style="display: grid; grid-template-columns: repeat(3, 1fr); gap: 16px; text-align: center;">
                        <div>
                            <div style="font-size: 1.5rem; font-weight: 700; color: ${displayColor};">${wetFromRain ? Math.round(recentRain.total) + 'mm' : (currentRisk?.peakProbability || 0) + '%'}</div>
                            <div style="font-size: 0.8rem; color: var(--gaip-text);">${wetFromRain ? 'Recent Rain' : "Tonight's Peak"}</div>
                        </div>
                        <div>
                            <div style="font-size: 1.5rem; font-weight: 700;">${summary?.weekAhead?.daysWithDew || 0}</div>
                            <div style="font-size: 0.8rem; color: var(--gaip-text);">Dew Days (7d Forecast)</div>
                        </div>
                        <div>
                            <div style="font-size: 1.5rem; font-weight: 700;">${dewData.leafWetness?.dewWetHours ?? dewData.leafWetness?.totalWetHours ?? 0}h</div>
                            <div style="font-size: 0.8rem; color: var(--gaip-text);">Leaf Wetness</div>
                        </div>
                    </div>
                    
                    ${wetFromRain ? `
                        <div style="margin-top: 12px; padding: 8px 12px; background: var(--gaip-info-bg); border-radius: 4px; font-size: 0.9rem;">
                            <strong>🌧️ Note:</strong> Surfaces wet from recent rain (${recentRain.total.toFixed(1)}mm in last 6h). 
                            Disease risk elevated due to extended leaf wetness.
                        </div>
                    ` : (currentRisk?.peakProbability >= 50 ? `
                        <div style="margin-top: 12px; padding: 8px 12px; background: var(--gaip-warning-bg); border-radius: 4px; font-size: 0.9rem;">
                            <strong>⚠️ Action:</strong> ${currentRisk.peakProbability >= 75 ? 
                                'Heavy dew expected. Plan early morning mowing to remove dew and reduce disease pressure.' : 
                                'Moderate dew likely. Consider dew removal if disease pressure is elevated.'}
                        </div>
                    ` : '')}
                </div>
            </div>
        `;
        
        log('Dew UI rendered');
    }

    /**
     * Render error message
     */
    function renderError(message, recommendation) {
        const container = document.getElementById(CONFIG.containerId);
        if (!container) return;
        
        container.innerHTML = `
            <div class="gaip-dew-error" style="
                padding: 16px;
                background: var(--gaip-warning-bg);
                border-radius: 8px;
                border-left: 4px solid #f59e0b;
            ">
                <p style="margin: 0 0 8px 0; color: #92400e; font-weight: 500;">
                    ⚠️ ${message}
                </p>
                ${recommendation ? `
                    <p style="margin: 0; color: var(--gaip-text); font-size: 0.85rem;">
                        ${recommendation}
                    </p>
                ` : ''}
            </div>
        `;
    }

    // =========================================================================
    // EVENT LISTENERS
    // =========================================================================

    /**
     * Initialize event listeners
     */
    function initListeners() {
        // Listen for state dispatch
        if (typeof window.GilbaStateDispatch !== 'undefined') {
            log('Using GilbaStateDispatch');
            window.GilbaStateDispatch.subscribe('analysis-complete', function(payload) {
                log('Received analysis-complete from StateDispatch');
                hasRun = false;  // Allow re-run
                runDewAnalysis(payload.state);
            });
        }
        
        // Also listen for DOM event fallback
        document.addEventListener('gaip:analysis-complete', function(e) {
            log('Received gaip:analysis-complete event');
            hasRun = false;
            runDewAnalysis(e.detail?.state || {});
        });
        
        // Listen for turf type changes
        document.addEventListener('click', function(e) {
            const turfOption = e.target.closest('.gaip-turf-type-option');
            if (turfOption) {
                const turfType = turfOption.dataset.type;
                log('Turf type changed:', turfType);
                updateSectionVisibility(turfType === 'sports');
            }
        });
        
        // MutationObserver fallback for results container
        initResultsObserver();
    }

    /**
     * Set up MutationObserver on results container
     */
    function initResultsObserver() {
        const runBtn = document.getElementById('gaip-run-analysis') || 
                      document.querySelector('.gaip-run-btn');
        
        if (runBtn) {
            runBtn.addEventListener('click', function() {
                log('Run button clicked - resetting dew state');
                hasRun = false;
                isRunning = false;
            });
        }
        
        const resultsContainer = document.getElementById('gaip-results') ||
                                document.querySelector('.gaip-results');
        
        if (resultsContainer) {
            const observer = new MutationObserver(function(mutations) {
                for (let i = 0; i < mutations.length; i++) {
                    if (mutations[i].addedNodes.length > 0 && !hasRun) {
                        // Check it's not our own container
                        let isOurs = false;
                        mutations[i].addedNodes.forEach(node => {
                            if (node.id === CONFIG.containerId || 
                                node.id === CONFIG.sectionId) {
                                isOurs = true;
                            }
                        });
                        
                        if (!isOurs) {
                            log('Results updated - triggering dew analysis');
                            setTimeout(tryRunDew, 600);
                        }
                        break;
                    }
                }
            });
            
            observer.observe(resultsContainer, { childList: true, subtree: false });
            log('MutationObserver active on results container');
        }
    }

    /**
     * Attempt to run dew analysis by gathering state
     */
    function tryRunDew() {
        if (hasRun || isRunning) return;
        
        // Guard: don't attempt to build state if hub DOM isn't ready
        var hubEl = document.querySelector('#gaip-hub');
        if (!hubEl) {
            return;
        }
        
        let state = window.currentState || window.gaipState;
        
        if (!state && typeof window.gaip_build_state === 'function') {
            try {
                state = window.gaip_build_state(hubEl);
            } catch (e) {
                log('Could not build state:', e);
            }
        }
        
        if (state) {
            runDewAnalysis(state);
        } else {
            log('No state available for dew analysis');
        }
    }

    // =========================================================================
    // INITIALIZATION
    // =========================================================================

    function init() {
        log('Initializing Dew Prediction Integration...');
        
        // Check dependencies
        if (typeof GAIP_DewPrediction === 'undefined') {
            logError('GAIP_DewPrediction not loaded - check script order');
            return;
        }
        
        if (typeof GAIP_DewUI === 'undefined') {
            logError('GAIP_DewUI not loaded - check script order');
            return;
        }
        
        log('Dependencies loaded:', {
            engine: GAIP_DewPrediction.version,
            ui: 'ready'
        });
        
        // Set initial section visibility based on current turf type
        const currentTurfType = document.querySelector('.gaip-turf-type-option.active')?.dataset?.type;
        updateSectionVisibility(currentTurfType === 'sports');
        
        // Initialize listeners
        initListeners();
        
        log('Dew Prediction Integration ready');
    }

    // Auto-init when DOM ready
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', init);
    } else {
        init();
    }

    // =========================================================================
    // EXPORTS
    // =========================================================================

    window.GAIP_DewIntegration = {
        run: tryRunDew,
        reset: function() { hasRun = false; isRunning = false; }
    };

})();

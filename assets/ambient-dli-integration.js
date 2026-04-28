/**
 * =============================================================================
 * GILBA AMBIENT DLI INTEGRATION v1.0.0
 * =============================================================================
 * 
 * Integrates the Ambient DLI Engine into the Hub workflow:
 * 1. Auto-calculates DLI when climate data is fetched
 * 2. Populates shade engine input with ambient DLI
 * 3. Updates UI with current light conditions
 * 
 * @author Gilba Solutions
 * @version 1.0.0
 * =============================================================================
 */

(function(global) {
    'use strict';

    const INTEGRATION_CONFIG = {
        version: '1.0.0',
        debug: false,
        autoPopulate: { enabled: true, overrideManual: false, minQuality: 50 }
    };

    let _lastAmbientDLI = null;
    let _isInitialized = false;

    function log(category, message, data) {
        if (INTEGRATION_CONFIG.debug) {
        }
    }

    function processClimateData(climateData, state) {
        log('process', 'Processing climate data for ambient DLI');
        
        if (!global.AmbientDLIEngine) {
            console.warn('[AmbientDLI-Integration] AmbientDLIEngine not loaded');
            return null;
        }
        
        const ambientDLI = global.AmbientDLIEngine.calculate(climateData, state);
        
        if (!ambientDLI || ambientDLI.current === null) {
            log('process', 'Could not calculate ambient DLI');
            return null;
        }
        
        _lastAmbientDLI = ambientDLI;
        
        log('process', `Ambient DLI: ${ambientDLI.current} mol/m²/day (${ambientDLI.status})`);
        
        if (INTEGRATION_CONFIG.autoPopulate.enabled) {
            injectIntoState(ambientDLI, state);
        }
        
        updateUI(ambientDLI);
        dispatchEvent(ambientDLI);
        
        return ambientDLI;
    }

    function injectIntoState(ambientDLI, state) {
        if (!state) state = global._gaipState || global.gaipState || {};
        
        if (ambientDLI.quality && ambientDLI.quality.score < INTEGRATION_CONFIG.autoPopulate.minQuality) {
            return;
        }
        
        const manualDLI = state?.turf?.dli || 0;
        if (manualDLI > 0 && !INTEGRATION_CONFIG.autoPopulate.overrideManual) {
            return;
        }
        
        state.ambientDLI = ambientDLI;
        
        if (!state.turf) state.turf = {};
        state.turf.ambientDLI = ambientDLI.current;
        state.turf.ambientDLISource = ambientDLI.source;
        state.turf.ambientDLIStatus = ambientDLI.status;
        
        global._gaipAmbientDLI = ambientDLI;
        
        log('inject', `Injected ambient DLI ${ambientDLI.current} into state`);
    }

    function dispatchEvent(ambientDLI) {
        const event = new CustomEvent('gaip:ambient-dli-ready', { detail: ambientDLI });
        document.dispatchEvent(event);
        global.gaip_currentAmbientDLI = ambientDLI;
    }

    function updateUI(ambientDLI) {
        updateDLIIndicator(ambientDLI);
    }

    function updateDLIIndicator(ambientDLI) {
        let container = document.querySelector('.gaip-ambient-dli-container');
        
        if (!container) {
            const climateBanner = document.querySelector('#gaip-climate-status-banner');
            if (climateBanner) {
                container = document.createElement('div');
                container.className = 'gaip-ambient-dli-container';
                container.style.cssText = 'margin: 10px 0; padding: 8px 12px; background: linear-gradient(135deg, var(--gaip-warning-bg) 0%, var(--gaip-warning-bg) 100%); border-radius: 6px; border-left: 3px solid #eab308;';
                climateBanner.insertAdjacentElement('afterend', container);
            }
        }
        
        if (container && global.AmbientDLIEngine) {
            const statusColors = {
                critical: { bg: 'var(--gaip-critical-bg)', border: '#ef4444', text: '#dc2626' },
                deficient: { bg: 'var(--gaip-warning-bg)', border: '#f97316', text: '#ea580c' },
                marginal: { bg: 'var(--gaip-warning-bg)', border: '#eab308', text: '#ca8a04' },
                adequate: { bg: '#f7fee7', border: '#84cc16', text: '#65a30d' },
                optimal: { bg: 'var(--gaip-good-bg)', border: '#22c55e', text: '#16a34a' },
                abundant: { bg: '#ecfeff', border: '#06b6d4', text: '#0891b2' }
            };
            
            const colors = statusColors[ambientDLI.status] || { bg: 'var(--gaip-surface-muted)', border: 'var(--gaip-text-secondary)', text: 'var(--gaip-text-secondary)' };
            
            container.style.background = `linear-gradient(135deg, ${colors.bg} 0%, ${colors.bg} 100%)`;
            container.style.borderLeftColor = colors.border;
            
            let deficitInfo = '';
            const speciesLabel = ambientDLI.metadata?.isOverseedDominant 
                ? `${ambientDLI.metadata.species} (overseed)` 
                : (ambientDLI.classification?.species || 'turf');
            if (ambientDLI.classification?.deficit > 0) {
                deficitInfo = `${ambientDLI.classification.deficit} mol/m²/d below optimal for ${speciesLabel}`;
            } else if (ambientDLI.status === 'optimal' || ambientDLI.status === 'abundant') {
                deficitInfo = `Light levels optimal for ${speciesLabel}`;
            } else {
                deficitInfo = `From weather data (${ambientDLI.source || 'API'})`;
            }
            
            container.innerHTML = `
                <div style="display: flex; align-items: center; gap: 12px;">
                    <span style="font-size: 20px;">☀️</span>
                    <div>
                        <div style="font-weight: 600; color: ${colors.text}; font-size: 13px;">
                            Ambient Light: ${ambientDLI.current} mol/m²/day
                            <span style="font-weight: 400; margin-left: 8px; padding: 2px 8px; background: ${colors.border}20; border-radius: 4px; font-size: 11px;">
                                ${(ambientDLI.status || 'Unknown').toUpperCase()}
                            </span>
                        </div>
                        <div style="color: var(--gaip-text); font-size: 11px; margin-top: 2px;">
                            ${deficitInfo}
                        </div>
                    </div>
                </div>
            `;
        }
    }

    function getAmbientDLIForShade() {
        if (_lastAmbientDLI && _lastAmbientDLI.current !== null) {
            return {
                dli: _lastAmbientDLI.current,
                source: _lastAmbientDLI.source,
                status: _lastAmbientDLI.status,
                quality: _lastAmbientDLI.quality?.level || 'unknown'
            };
        }
        return null;
    }

    function setupEventListeners() {
        // Listen for climate fetch events
        document.addEventListener('gaip:climate-fetch-complete', function(e) {
            processClimateData(e.detail, global._gaipState);
        });
        
        document.addEventListener('gaip:climate-metrics-ready', function(e) {
            if (e.detail?.solar) {
                processClimateData(e.detail, global._gaipState);
            }
        });
        
        // Listen for raw weather data changes
        document.addEventListener('gaip:weather-data-ready', function(e) {
            processClimateData(e.detail, global._gaipState);
        });
        
        // Listen for analysis complete - use the hub's already-calculated DLI
        document.addEventListener('gaip:analysis-complete', function(e) {
            log('event', 'Analysis complete, checking for ambient DLI');
            // Prefer the hub pipeline's calculated value (set via gaip_currentAmbientDLI)
            if (global.gaip_currentAmbientDLI && global.gaip_currentAmbientDLI.current > 0) {
                _lastAmbientDLI = global.gaip_currentAmbientDLI;
                updateUI(global.gaip_currentAmbientDLI);
                log('event', 'Updated UI from hub-calculated DLI: ' + global.gaip_currentAmbientDLI.current);
            } else if (global.rawWeatherData) {
                // Fallback: build climate object from forecast data (same as hub pipeline)
                var rwd = global.rawWeatherData;
                var dliClimate = {};
                if (rwd.forecast) {
                    if (rwd.forecast.hourly) dliClimate.hourly = rwd.forecast.hourly;
                    if (rwd.forecast.daily) dliClimate.daily = rwd.forecast.daily;
                }
                if (!dliClimate.daily && rwd.historical && rwd.historical.daily) {
                    dliClimate.daily = rwd.historical.daily;
                }
                processClimateData(dliClimate, global._gaipState || global.GAIP_STATE);
            }
        });
        
        log('events', 'Event listeners configured');
    }

    function hookClimateEngine() {
        // Hook into rawWeatherData changes
        let lastRawWeatherData = null;
        
        // Build climate object from rawWeatherData the same way as hub pipeline
        function buildDLIClimate(rwd) {
            var dliClimate = {};
            if (rwd.forecast) {
                if (rwd.forecast.hourly) dliClimate.hourly = rwd.forecast.hourly;
                if (rwd.forecast.daily) dliClimate.daily = rwd.forecast.daily;
            }
            if (!dliClimate.daily && rwd.historical && rwd.historical.daily) {
                dliClimate.daily = rwd.historical.daily;
            }
            // Fallback: if no forecast structure, use top-level daily/hourly
            if (!dliClimate.daily && !dliClimate.hourly) {
                if (rwd.daily) dliClimate.daily = rwd.daily;
                if (rwd.hourly) dliClimate.hourly = rwd.hourly;
            }
            return dliClimate;
        }
        
        const checkRawWeatherData = function() {
            if (global.rawWeatherData && global.rawWeatherData !== lastRawWeatherData) {
                lastRawWeatherData = global.rawWeatherData;
                log('hook', 'Raw weather data detected, processing...');
                processClimateData(buildDLIClimate(global.rawWeatherData), global._gaipState || global.GAIP_STATE);
            }
        };
        
        // Check periodically for rawWeatherData
        setInterval(checkRawWeatherData, 2000);
        
        // Also check immediately and after short delays
        setTimeout(checkRawWeatherData, 500);
        setTimeout(checkRawWeatherData, 1500);
        setTimeout(checkRawWeatherData, 3000);
        
        // Hook the climate fetch function if available
        if (global.gaip_climate_fetch) {
            const originalFetch = global.gaip_climate_fetch;
            global.gaip_climate_fetch = async function(...args) {
                const result = await originalFetch.apply(this, args);
                if (result) {
                    log('hook', 'Climate fetch completed, processing...');
                    processClimateData(buildDLIClimate(result), global._gaipState || global.GAIP_STATE);
                }
                return result;
            };
            log('hook', 'Hooked gaip_climate_fetch');
        }
        
        log('hook', 'Climate data monitoring started');
    }

    function initialize() {
        if (_isInitialized) return;
        
        log('init', 'Initializing Ambient DLI Integration');
        
        setupEventListeners();
        hookClimateEngine();
        
        global.gaip_getAmbientDLI = getAmbientDLIForShade;
        if (typeof window !== 'undefined') {
            window.gaip_getAmbientDLI = getAmbientDLIForShade;
        }
        
        _isInitialized = true;
        
    }

    const AmbientDLIIntegration = {
        version: INTEGRATION_CONFIG.version,
        init: initialize,
        process: processClimateData,
        getCurrent: function() { return _lastAmbientDLI; },
        getForShade: getAmbientDLIForShade,
        updateUI: updateUI,
        setDebug: function(enabled) { INTEGRATION_CONFIG.debug = enabled; }
    };

    global.AmbientDLIIntegration = AmbientDLIIntegration;
    
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', initialize);
    } else {
        setTimeout(initialize, 100);
    }

})(typeof window !== 'undefined' ? window : global);

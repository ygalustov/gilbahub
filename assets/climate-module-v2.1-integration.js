/**
 * ============================================================================
 * CLIMATE MODULE v2.1 - AUTO INTEGRATION
 * ============================================================================
 * 
 * Automatically wires dual metrics into the climate analysis flow.
 * Listens for analysis completion and injects the UI.
 * 
 * Load AFTER: climate-module-v2.1-dual-metrics.js, climate-module-v2.1-ui.js
 * 
 * ============================================================================
 */

(function(global) {
    'use strict';

    var hasInjected = false;

    /**
     * Inject dual metrics UI into the climate panel
     */
    function injectDualMetrics() {
        // Prevent double injection
        if (hasInjected) return;
        if (document.querySelector('.climate-dual-metrics')) return;

        // Check dependencies
        if (!global.GAIP_ClimateV2_DualMetrics) {
            console.warn('[ClimateV2.1 Integration] Dual metrics engine not loaded');
            return;
        }
        if (!global.GAIP_ClimateV2_DualMetricsUI) {
            console.warn('[ClimateV2.1 Integration] Dual metrics UI not loaded');
            return;
        }

        // Get state and weather
        var state = global.currentState || global.GAIP_STATE || global.GAIP_LAST_STATE;
        var weather = global.rawWeatherData || global.GAIP_LAST_WEATHER;

        if (!state) {
            console.warn('[ClimateV2.1 Integration] No state available');
            return;
        }
        if (!weather) {
            console.warn('[ClimateV2.1 Integration] No weather data available');
            return;
        }

        // Run dual metrics analysis
        var result;
        try {
            result = global.GAIP_ClimateV2_DualMetrics.analyze(state, weather);
        } catch (e) {
            console.error('[ClimateV2.1 Integration] Analysis error:', e);
            return;
        }

        if (!result || !result.dualMetrics || !result.dualMetrics.available) {
            return;
        }

        // Store globally for other modules
        global.GAIP_CLIMATE_DUAL_RESULT = result;

        // Find climate panel and inject
        var panel = document.querySelector('.climate-v2-panel');
        if (!panel) {
            return;
        }

        // Render the dual metrics HTML
        var html = global.GAIP_ClimateV2_DualMetricsUI.render(result);
        if (!html) {
            return;
        }

        // Find insertion point - after header, before stress grid
        var header = panel.querySelector('.climate-v2-header');
        var stressGrid = panel.querySelector('.climate-stress-grid');
        
        // Create container
        var container = document.createElement('div');
        container.innerHTML = html;
        var dualMetricsEl = container.firstElementChild;

        if (header && header.nextSibling) {
            // Insert after header
            header.parentNode.insertBefore(dualMetricsEl, header.nextSibling);
        } else if (stressGrid) {
            // Insert before stress grid
            stressGrid.parentNode.insertBefore(dualMetricsEl, stressGrid);
        } else {
            // Append to panel
            panel.insertBefore(dualMetricsEl, panel.firstChild.nextSibling);
        }

        hasInjected = true;
    }

    /**
     * Reset injection flag (called when new analysis starts)
     */
    function resetInjection() {
        hasInjected = false;
        // Remove existing dual metrics panel if present
        var existing = document.querySelector('.climate-dual-metrics');
        if (existing) {
            existing.remove();
        }
    }

    /**
     * Initialize listeners
     */
    function init() {

        // Method 1: Listen for state dispatch
        if (global.GilbaStateDispatch) {
            global.GilbaStateDispatch.subscribe('analysis-complete', function() {
                setTimeout(injectDualMetrics, 200);
            });
        }

        // Method 2: Listen for DOM event
        document.addEventListener('gaip:analysis-complete', function() {
            setTimeout(injectDualMetrics, 200);
        });

        // Method 3: MutationObserver on results container
        var resultsContainer = document.getElementById('gaip-results') || 
                               document.querySelector('.gaip-results');
        
        if (resultsContainer) {
            var observer = new MutationObserver(function(mutations) {
                for (var i = 0; i < mutations.length; i++) {
                    if (mutations[i].addedNodes.length > 0) {
                        // Check if climate panel was added
                        var climatePanel = resultsContainer.querySelector('.climate-v2-panel');
                        if (climatePanel && !hasInjected) {
                            setTimeout(injectDualMetrics, 100);
                            break;
                        }
                    }
                }
            });
            observer.observe(resultsContainer, { childList: true, subtree: true });
        }

        // Method 4: Hook run button for reset
        var runBtn = document.getElementById('gaip-run-analysis') ||
                     document.querySelector('.gaip-run-btn') ||
                     document.querySelector('[data-action="analyze"]');
        
        if (runBtn) {
            runBtn.addEventListener('click', function() {
                resetInjection();
            });
        }

    }

    // Initialize on DOM ready
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', init);
    } else {
        init();
    }

    // Expose manual trigger for testing
    global.injectDualMetrics = injectDualMetrics;
    global.resetDualMetrics = resetInjection;

})(typeof window !== 'undefined' ? window : this);

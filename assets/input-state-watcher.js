/**
 * =============================================================================
 * GILBA HUB INPUT STATE WATCHER v1.0.0
 * =============================================================================
 * 
 * Monitors input changes and flags when analysis results may be stale.
 * Part of TIER 2 Item #4: Scenario-Aware Recalculation Cascade
 * 
 * PURPOSE:
 * - Detects when inputs change AFTER an analysis has been run
 * - Shows visual indicator that results may not reflect current inputs
 * - Provides one-click re-run functionality
 * - Prevents "UI lies by omission" where stale results appear current
 * 
 * WATCHED EVENTS:
 * - Sample Manager: import, load, update, delete
 * - Turf Profile: species, variety, surface type changes
 * - Form inputs: soil, water, tissue, climate settings
 * - Sensor imports
 * 
 * USAGE:
 * - Include AFTER hub-tissue-v3.js and sample-manager.js
 * - Automatically initializes on DOMContentLoaded
 * - GAIP_InputWatcher.isStale() returns current stale state
 * - GAIP_InputWatcher.markStale() manually flags as stale
 * - GAIP_InputWatcher.clearStale() clears stale flag
 * 
 * @author Gilba Solutions
 * @version 1.0.0
 * =============================================================================
 */

(function(global) {
    'use strict';

    // =========================================================================
    // CONFIGURATION
    // =========================================================================

    const CONFIG = {
        version: '1.0.0',
        debug: false,
        
        // Delay before showing stale indicator (debounce rapid changes)
        debounceMs: 300,
        
        // Pulse animation count for run button
        pulseCount: 3,
        
        // Auto-hide banner after this many seconds (0 = never)
        autoHideSecs: 0
    };

    // =========================================================================
    // STATE
    // =========================================================================

    let _lastAnalysisTime = 0;
    let _inputsChangedSince = false;
    let _staleBanner = null;
    let _debounceTimer = null;
    let _changedInputs = new Set();

    // =========================================================================
    // WATCHED EVENTS
    // =========================================================================

    /**
     * Custom events dispatched by other GAIP modules that indicate input changed
     */
    const WATCHED_EVENTS = [
        // Sample Manager events
        'gaip:samples-imported',      // Lab CSV/XLSX imported
        'gaip:sampleLoaded',         // Sample switched in dropdown
        'gaip:sampleUpdated',        // Sample manually edited
        'gaip:sampleDeleted',        // Sample removed
        'gaip:sampleRenamed',        // Sample renamed
        'gaip:samplesCleared',       // All samples cleared
        
        // Turf Profile events
        'gaip:turf-profile-change',    // Species, variety, surface changed
        'gaip:varietySelected',      // Specific variety selected
        
        // Sensor events
        'gaip:sensorDataImported',   // TDR/POGO data imported
        'gaip:sensorZoneLabelled',   // Zone label assigned to sensor data
        
        // Climate events
        'gaip:weatherUpdated',       // Weather data refreshed
        'gaip:locationChanged',      // Site location changed
        
        // Scenario events (for completeness)
        'gaip:scenarioApplied'       // What-if scenario applied to live state
    ];

    // =========================================================================
    // WATCHED FORM SELECTORS
    // =========================================================================

    /**
     * CSS selectors for form inputs that should trigger stale state
     */
    const WATCHED_SELECTORS = [
        // Turf identification
        '.gaip-species',
        '.gaip-variety',
        '.gaip-turf-type',
        '.gaip-cool-overseed',
        '.gaip-poa-percent',
        
        // Surface/profile
        '.gaip-subcategory-option',
        '.gaip-surface-type',
        '.gaip-rootzone-type',
        
        // Soil inputs
        '.gaip-soil-ph',
        '.gaip-soil-ec',
        '.gaip-cec',
        '.gaip-loi',
        '.gaip-loi-0-2',
        '.gaip-loi-2-4', 
        '.gaip-loi-4-6',
        '.gaip-soil-texture',
        '.gaip-soil-methodology',
        '[data-mlsn]',
        
        // Water inputs
        '.gaip-water-ph',
        '.gaip-ecw',
        '[data-ion]',
        '.gaip-water-source',
        
        // Tissue inputs
        '[data-val]',
        '.gaip-tissue-input',
        '[data-tissue]',
        
        // Climate/weather
        '.gaip-use-live-weather',
        '.gaip-manual-temp',
        '.gaip-manual-precip',
        '.gaip-latitude',
        '.gaip-longitude',
        
        // Traffic/schedule
        '.gaip-match-schedule',
        '.gaip-events-per-week',
        '.gaip-recovery-days',
        
        // Shade
        '.gaip-shade-factor',
        '.gaip-svf',
        '.gaip-facade-angle',
        
        // Irrigation
        '.gaip-irrigation-rate',
        '.gaip-irrigation-freq',
        
        // PGR
        '.gaip-pgr-product',
        '.gaip-pgr-rate',
        '.gaip-pgr-interval',
        
        // Fertility
        '.gaip-n-program',
        '.gaip-n-rate'
    ];

    // =========================================================================
    // LOGGING
    // =========================================================================

    function log(message, data) {
        if (!CONFIG.debug) return;
        if (data !== undefined) {
        } else {
        }
    }

    // =========================================================================
    // STALE STATE MANAGEMENT
    // =========================================================================

    /**
     * Mark results as stale (inputs changed since last analysis)
     * @param {string} source - What triggered the stale state
     */
    function markStale(source) {
        // Ignore if no analysis has been run yet
        if (_lastAnalysisTime === 0) {
            log('Ignoring change before first analysis:', source);
            return;
        }

        // Track what changed
        if (source) {
            _changedInputs.add(source);
        }

        // Debounce rapid changes
        if (_debounceTimer) {
            clearTimeout(_debounceTimer);
        }

        _debounceTimer = setTimeout(() => {
            if (!_inputsChangedSince) {
                _inputsChangedSince = true;
                showStaleBanner();
                pulseRunButton();
                log('Results now STALE. Changed inputs:', Array.from(_changedInputs));
            }
        }, CONFIG.debounceMs);
    }

    /**
     * Clear stale state (analysis just ran)
     */
    function clearStale() {
        _inputsChangedSince = false;
        _lastAnalysisTime = Date.now();
        _changedInputs.clear();
        
        if (_debounceTimer) {
            clearTimeout(_debounceTimer);
            _debounceTimer = null;
        }
        
        hideStaleBanner();
        log('Stale state CLEARED');
    }

    /**
     * Check if currently stale
     */
    function isStale() {
        return _inputsChangedSince;
    }

    /**
     * Get list of inputs that changed
     */
    function getChangedInputs() {
        return Array.from(_changedInputs);
    }

    // =========================================================================
    // UI: STALE BANNER
    // =========================================================================

    function showStaleBanner() {
        if (_staleBanner) return;

        // Find results panel
        const resultsPanel = document.querySelector('.gaip-results');
        if (!resultsPanel) {
            log('Results panel not found - cannot show banner');
            return;
        }

        // Create banner
        _staleBanner = document.createElement('div');
        _staleBanner.className = 'gaip-stale-banner';
        _staleBanner.setAttribute('role', 'alert');
        _staleBanner.innerHTML = `
            <span class="gaip-stale-icon" aria-hidden="true">⚠</span>
            <div class="gaip-stale-content">
                <span class="gaip-stale-title">Inputs changed</span>
                <span class="gaip-stale-subtitle">Results may not reflect current values</span>
            </div>
            <button class="gaip-stale-rerun" type="button">
                <span class="gaip-stale-btn-icon">▶</span>
                Re-run Analysis
            </button>
            <button class="gaip-stale-dismiss" type="button" aria-label="Dismiss" title="Dismiss">×</button>
        `;

        // Wire up buttons
        _staleBanner.querySelector('.gaip-stale-rerun').onclick = () => {
            const runBtn = document.querySelector('.gaip-run-btn');
            if (runBtn) {
                runBtn.click();
            } else {
                log('Run button not found');
            }
        };

        _staleBanner.querySelector('.gaip-stale-dismiss').onclick = () => {
            hideStaleBanner();
        };

        // Insert at top of results
        resultsPanel.insertBefore(_staleBanner, resultsPanel.firstChild);

        // Auto-hide if configured
        if (CONFIG.autoHideSecs > 0) {
            setTimeout(hideStaleBanner, CONFIG.autoHideSecs * 1000);
        }

        log('Stale banner shown');
    }

    function hideStaleBanner() {
        if (_staleBanner) {
            _staleBanner.remove();
            _staleBanner = null;
            log('Stale banner hidden');
        }
    }

    // =========================================================================
    // UI: RUN BUTTON PULSE
    // =========================================================================

    function pulseRunButton() {
        const btn = document.querySelector('.gaip-run-btn');
        if (!btn) return;

        // Add pulse class
        btn.classList.add('gaip-run-pulse');

        // Remove after animation completes
        setTimeout(() => {
            btn.classList.remove('gaip-run-pulse');
        }, 500 * CONFIG.pulseCount);
    }

    // =========================================================================
    // EVENT HANDLERS
    // =========================================================================

    /**
     * Handle custom GAIP events
     */
    function handleGaipEvent(e) {
        log('GAIP event received:', e.type);
        markStale(e.type);
    }

    /**
     * Handle form input changes
     */
    function handleInputChange(e) {
        const target = e.target;
        
        // Check if target matches any watched selector
        const isWatched = WATCHED_SELECTORS.some(selector => {
            try {
                return target.matches(selector);
            } catch {
                return false;
            }
        });

        if (isWatched) {
            // Build a descriptive source string
            let source = target.className || target.tagName;
            if (target.dataset.mlsn) source = `soil.${target.dataset.mlsn}`;
            if (target.dataset.ion) source = `water.${target.dataset.ion}`;
            if (target.dataset.val) source = `tissue.${target.dataset.val}`;
            
            log('Watched input changed:', source);
            markStale(source);
        }
    }

    /**
     * Handle subcategory option clicks (special case - not input change)
     */
    function handleSubcategoryClick(e) {
        const option = e.target.closest('.gaip-subcategory-option');
        if (option) {
            const surface = option.dataset.surface || 'unknown';
            log('Surface subcategory clicked:', surface);
            markStale(`surface.${surface}`);
        }
    }

    /**
     * Handle analysis complete
     */
    function handleAnalysisComplete(e) {
        log('Analysis complete - clearing stale state');
        clearStale();
    }

    // =========================================================================
    // CSS INJECTION
    // =========================================================================

    function injectStyles() {
        // Check if already injected
        if (document.getElementById('gaip-input-watcher-styles')) return;

        const styles = document.createElement('style');
        styles.id = 'gaip-input-watcher-styles';
        styles.textContent = `
            /* =================================================================
               GAIP INPUT WATCHER STYLES
               ================================================================= */

            .gaip-stale-banner {
                display: flex;
                align-items: center;
                gap: 12px;
                padding: 12px 16px;
                background: linear-gradient(135deg, var(--gaip-warning-bg) 0%, var(--gaip-warning-border) 100%);
                border: 1px solid #f59e0b;
                border-left: 4px solid #d97706;
                border-radius: 6px;
                margin-bottom: 16px;
                font-size: 13px;
                box-shadow: 0 2px 8px rgba(245, 158, 11, 0.15);
                animation: gaip-banner-slide-in 0.3s ease-out;
            }

            @keyframes gaip-banner-slide-in {
                from {
                    opacity: 0;
                    transform: translateY(-10px);
                }
                to {
                    opacity: 1;
                    transform: translateY(0);
                }
            }

            .gaip-stale-icon {
                font-size: 20px;
                flex-shrink: 0;
            }

            .gaip-stale-content {
                flex: 1;
                display: flex;
                flex-direction: column;
                gap: 2px;
            }

            .gaip-stale-title {
                color: #92400e;
                font-weight: 600;
                font-size: 14px;
            }

            .gaip-stale-subtitle {
                color: #a16207;
                font-size: 12px;
            }

            .gaip-stale-rerun {
                display: inline-flex;
                align-items: center;
                gap: 6px;
                padding: 8px 16px;
                background: linear-gradient(135deg, #f59e0b 0%, #d97706 100%);
                color: var(--gaip-surface);
                border: none;
                border-radius: 6px;
                font-size: 13px;
                font-weight: 600;
                cursor: pointer;
                transition: all 0.2s ease;
                box-shadow: 0 2px 4px rgba(217, 119, 6, 0.3);
            }

            .gaip-stale-rerun:hover {
                background: linear-gradient(135deg, #d97706 0%, #b45309 100%);
                transform: translateY(-1px);
                box-shadow: 0 4px 8px rgba(217, 119, 6, 0.4);
            }

            .gaip-stale-btn-icon {
                font-size: 10px;
            }

            .gaip-stale-dismiss {
                width: 28px;
                height: 28px;
                display: flex;
                align-items: center;
                justify-content: center;
                background: transparent;
                border: none;
                border-radius: 4px;
                font-size: 18px;
                color: #92400e;
                cursor: pointer;
                transition: background 0.15s;
                flex-shrink: 0;
            }

            .gaip-stale-dismiss:hover {
                background: rgba(146, 64, 14, 0.1);
            }

            /* Run button pulse animation */
            .gaip-run-pulse {
                animation: gaip-pulse 0.5s ease-in-out 3;
            }

            @keyframes gaip-pulse {
                0%, 100% {
                    transform: scale(1);
                    box-shadow: 0 2px 4px rgba(59, 130, 246, 0.2);
                }
                50% {
                    transform: scale(1.05);
                    box-shadow: 0 4px 16px rgba(59, 130, 246, 0.5);
                }
            }

            /* Responsive adjustments */
            @media (max-width: 600px) {
                .gaip-stale-banner {
                    flex-wrap: wrap;
                    padding: 10px 12px;
                }

                .gaip-stale-content {
                    flex-basis: calc(100% - 50px);
                }

                .gaip-stale-rerun {
                    flex-basis: 100%;
                    justify-content: center;
                    margin-top: 8px;
                }

                .gaip-stale-dismiss {
                    position: absolute;
                    right: 8px;
                    top: 8px;
                }

                .gaip-stale-banner {
                    position: relative;
                }
            }

            /* Print: hide banner */
            @media print {
                .gaip-stale-banner {
                    display: none;
                }
            }
        `;

        document.head.appendChild(styles);
        log('Styles injected');
    }

    // =========================================================================
    // INITIALIZATION
    // =========================================================================

    function init() {
        log('Initializing Input State Watcher v' + CONFIG.version);

        // Inject styles
        injectStyles();

        // Listen for custom GAIP events
        WATCHED_EVENTS.forEach(eventName => {
            document.addEventListener(eventName, handleGaipEvent);
        });

        // Listen for form input changes (use capture to catch before bubbling stops)
        document.addEventListener('change', handleInputChange, true);
        document.addEventListener('input', handleInputChange, true);

        // Special handler for subcategory clicks
        document.addEventListener('click', handleSubcategoryClick, true);

        // Listen for analysis complete to clear stale state
        document.addEventListener('gaip:analysis-complete', handleAnalysisComplete);
        
        // Also listen for the other completion event
        document.addEventListener('gaip:hub-state-update', handleAnalysisComplete);

        // If analysis has already run (page refresh scenario), mark time
        if (window.GAIP_STATE) {
            _lastAnalysisTime = Date.now();
            log('Existing GAIP_STATE detected - analysis already run');
        }

        log('✅ Input State Watcher initialized');
        log('Watching ' + WATCHED_EVENTS.length + ' events and ' + WATCHED_SELECTORS.length + ' selectors');
    }

    // Initialize on DOM ready
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', init);
    } else {
        // Small delay to ensure other modules are loaded
        setTimeout(init, 100);
    }

    // =========================================================================
    // EXPORTS
    // =========================================================================

    global.GAIP_InputWatcher = {
        // State checks
        isStale: isStale,
        getChangedInputs: getChangedInputs,
        
        // Manual control
        markStale: markStale,
        clearStale: clearStale,
        
        // UI control
        showBanner: showStaleBanner,
        hideBanner: hideStaleBanner,
        
        // Config
        version: CONFIG.version,
        setDebug: function(enabled) { CONFIG.debug = enabled; }
    };

})(window);

/**
 * GAIP Clear Data Module v1.0
 * 
 * Adds clear/reset buttons to Soil, Water, and Tissue input panels.
 * Clears form inputs, SampleManager stores, global result state,
 * and re-renders output panels to their empty state.
 * 
 * Dependencies: sample-manager.js (GAIP_SampleManager)
 */
(function(window, document) {
    'use strict';

    const VERSION = '1.0.1';

    // =========================================================================
    // CONFIGURATION
    // =========================================================================

    const SELECTORS = {
        // Input containers
        soilGrid:       '.gaip-soil-grid',
        soilPH:         '.gaip-soil-ph',
        soilEC:         '.gaip-soil-ec',
        soilTexture:    '.gaip-soil-texture',
        soilCEC:        '.gaip-cec',
        soilMethodology:'.gaip-soil-methodology',
        samplingDepth:  '.gaip-sampling-depth',
        loi:            '.gaip-loi',
        loiStratified:  '[class*="gaip-loi-"]',

        waterECW:       '.gaip-ecw',
        waterPH:        '.gaip-water-ph',
        waterGrid:      '.gaip-water-grid',
        irrMethod:      '.gaip-irr-method',
        irrEfficiency:  '.gaip-irr-efficiency',
        irrRainEff:     '.gaip-irr-rain-eff',
        irrCost:        '.gaip-irr-cost',
        daysSinceIrr:   '.gaip-days-since-irrigation',
        soilVWC:        '.gaip-soil-vwc',
        rootDepth:      '.gaip-root-depth',
        sensorResult:   '#gaip-sensor-result',
        sensorSummary:  '#gaip-sensor-summary-container',

        tissueModule:   '#gaipTissueModule',

        // Output panels
        soilOutput:     '.gaip-mlsn-body',
        waterOutput:    '.gaip-water-body',
        tissueOutput:   '.gaip-tissue-body',
        nutrientDemand: '.gaip-nutrient-demand-body',

        // Card headers where buttons go
        soilWaterCard:  '.gaip-enable-soil-water',
        tissueCard:     '.gaip-enable-tissue',

        // The h4 section headers inside the soil/water card
        soilMethodLabel:'.gaip-soil-method-label',
        waterHeader:    '.gaip-card-body h4'
    };

    const BUTTON_STYLE = `
        padding: 4px 10px;
        font-size: 11px;
        font-weight: 500;
        background: var(--gaip-critical-bg);
        color: #b91c1c;
        border: 1px solid var(--gaip-critical-border);
        border-radius: 4px;
        cursor: pointer;
        line-height: 1.4;
        transition: all 0.15s ease;
    `;

    const BUTTON_HOVER_BG = 'var(--gaip-critical-bg)';
    const BUTTON_HOVER_BORDER = '#f87171';

    // =========================================================================
    // UTILITY
    // =========================================================================

    function log(action, detail) {
    }

    /**
     * Create a clear button element
     */
    function createClearButton(label, title, onClick) {
        const btn = document.createElement('button');
        btn.type = 'button';
        btn.textContent = label;
        btn.title = title;
        btn.setAttribute('style', BUTTON_STYLE);
        btn.addEventListener('mouseenter', function() {
            this.style.background = BUTTON_HOVER_BG;
            this.style.borderColor = BUTTON_HOVER_BORDER;
        });
        btn.addEventListener('mouseleave', function() {
            this.style.background = 'var(--gaip-critical-bg)';
            this.style.borderColor = 'var(--gaip-critical-border)';
        });
        btn.addEventListener('click', function(e) {
            e.preventDefault();
            e.stopPropagation();
            onClick(btn);
        });
        return btn;
    }

    /**
     * Brief visual confirmation on button
     */
    function flashConfirm(btn, originalLabel) {
        // Silent calls from site-switch pass a plain object, not a DOM element
        if (!btn || typeof btn.querySelector !== 'function') return;

        // Store original innerHTML for buttons with icons
        var originalHTML = btn.innerHTML;
        var hasIcon = btn.querySelector('.gaip-btn-icon');
        
        if (hasIcon) {
            btn.innerHTML = '<span class="gaip-btn-icon">✓</span><span>Cleared</span>';
            var origBg = btn.style.background;
            var origShadow = btn.style.boxShadow;
            btn.style.background = 'linear-gradient(135deg, #10b981 0%, #059669 100%)';
            btn.style.boxShadow = '0 2px 4px rgba(5, 150, 105, 0.2)';
            setTimeout(function() {
                btn.innerHTML = originalHTML;
                btn.style.background = origBg;
                btn.style.boxShadow = origShadow;
            }, 1500);
        } else {
            btn.textContent = '✓ Cleared';
            btn.style.background = 'var(--gaip-good-bg)';
            btn.style.color = '#166534';
            btn.style.borderColor = '#86efac';
            setTimeout(function() {
                btn.textContent = originalLabel;
                btn.style.background = 'var(--gaip-critical-bg)';
                btn.style.color = '#b91c1c';
                btn.style.borderColor = 'var(--gaip-critical-border)';
            }, 1500);
        }
    }

    /**
     * Clear all inputs within a container
     */
    function clearInputs(container) {
        if (!container) return;
        container.querySelectorAll('input[type="number"]').forEach(function(input) {
            input.value = '';
            input.dispatchEvent(new Event('input', { bubbles: true }));
        });
    }

    /**
     * Reset a select to its first option or a specified default
     */
    function resetSelect(selector, defaultValue) {
        var el = document.querySelector(selector);
        if (!el) return;
        if (defaultValue !== undefined) {
            el.value = defaultValue;
        } else {
            el.selectedIndex = 0;
        }
        el.dispatchEvent(new Event('change', { bubbles: true }));
    }

    /**
     * Clear a single input by selector
     */
    function clearInput(selector) {
        var el = document.querySelector(selector);
        if (!el) return;
        el.value = '';
        el.dispatchEvent(new Event('input', { bubbles: true }));
    }

    /**
     * Set input to a default value
     */
    function setInput(selector, value) {
        var el = document.querySelector(selector);
        if (!el) return;
        el.value = value;
        el.dispatchEvent(new Event('input', { bubbles: true }));
    }

    // =========================================================================
    // CLEAR SOIL DATA
    // =========================================================================

    function clearSoilData(btn, domOnly) {
        log('clearSoil', 'Clearing all soil input data' + (domOnly ? ' (DOM only)' : ''));

        // Clear soil nutrient grid (K, P, Ca, Mg, S, Fe, Mn, Cu, Zn)
        var soilGrid = document.querySelector(SELECTORS.soilGrid);
        if (soilGrid) clearInputs(soilGrid);

        // Clear individual soil fields
        clearInput(SELECTORS.soilPH);
        clearInput(SELECTORS.soilCEC);
        clearInput(SELECTORS.soilEC);
        clearInput(SELECTORS.loi);

        // Clear stratified OM fields
        document.querySelectorAll(SELECTORS.loiStratified).forEach(function(input) {
            if (input.classList.contains('gaip-loi')) return; // skip main LOI
            input.value = '';
            input.dispatchEvent(new Event('input', { bubbles: true }));
        });

        // Reset selects to defaults
        resetSelect(SELECTORS.soilTexture, 'loam');
        resetSelect(SELECTORS.samplingDepth, '');

        // Clear SampleManager soil store — skip on site-switch (domOnly=true)
        // because _currentSite has already changed; clearing would wipe the NEW site's samples
        if (!domOnly && window.GAIP_SampleManager) {
            window.GAIP_SampleManager.clearSamples('soil');
            log('clearSoil', 'SampleManager soil samples cleared');
        }

        // Clear global AI interpretation state
        window.GAIP_SOIL_INTERPRETATION = null;

        // Reset output panels
        var soilOutput = document.querySelector(SELECTORS.soilOutput);
        if (soilOutput) {
            soilOutput.innerHTML =
                '<div class="gaip-no-data" style="' +
                    'padding: 20px; background: var(--gaip-surface-muted); border: 1px dashed var(--gaip-border);' +
                    'border-radius: 8px; text-align: center; color: var(--gaip-text);">' +
                    '<div style="font-size: 24px; margin-bottom: 8px;">📋</div>' +
                    '<div style="font-weight: 500;">Enter soil test values above</div>' +
                    '<div style="font-size: 12px; margin-top: 4px;">K, P, Ca, Mg, S, Fe, Mn values required for analysis</div>' +
                '</div>';
        }

        // Clear nutrient demand (depends on soil)
        var ndOutput = document.querySelector(SELECTORS.nutrientDemand);
        if (ndOutput) {
            ndOutput.innerHTML =
                '<p class="gaip-note">Run analysis with soil data to see nutrient demand calculations.</p>';
        }

        // Dispatch event for other modules
        document.dispatchEvent(new CustomEvent('gaip:soil-data-cleared'));

        flashConfirm(btn, 'Clear Soil Data');
        log('clearSoil', 'Complete');
    }

    // =========================================================================
    // CLEAR WATER DATA
    // =========================================================================

    function clearWaterData(btn, domOnly) {
        log('clearWater', 'Clearing all water input data' + (domOnly ? ' (DOM only)' : ''));

        // Clear water ion grid
        var waterGrid = document.querySelector(SELECTORS.waterGrid);
        if (waterGrid) clearInputs(waterGrid);

        // Clear individual water fields
        clearInput(SELECTORS.waterECW);
        clearInput(SELECTORS.waterPH);

        // Reset irrigation fields to defaults
        resetSelect(SELECTORS.irrMethod, '');
        setInput(SELECTORS.irrEfficiency, '75');
        setInput(SELECTORS.irrRainEff, '80');
        setInput(SELECTORS.irrCost, '3.00');
        setInput(SELECTORS.daysSinceIrr, '1');
        clearInput(SELECTORS.soilVWC);
        setInput(SELECTORS.rootDepth, '100');

        // Clear sensor data
        var sensorResult = document.querySelector(SELECTORS.sensorResult);
        if (sensorResult) sensorResult.innerHTML = '';
        var sensorSummary = document.querySelector(SELECTORS.sensorSummary);
        if (sensorSummary) sensorSummary.innerHTML = '';

        // Clear SampleManager water store — skip on site-switch (domOnly=true)
        // because _currentSite has already changed; clearing would wipe the NEW site's samples
        if (!domOnly && window.GAIP_SampleManager) {
            window.GAIP_SampleManager.clearSamples('water');
            log('clearWater', 'SampleManager water samples cleared');
        }

        // Clear global state
        window.GAIP_WATER_INTERPRETATION = null;
        window.__GAIP_WATER_STATE__ = null;

        // Reset output panel
        var waterOutput = document.querySelector(SELECTORS.waterOutput);
        if (waterOutput) {
            waterOutput.innerHTML =
                '<div class="gaip-water-no-data">' +
                    '<p class="gaip-note">' +
                        '<strong>No water quality data entered.</strong><br>' +
                        'Enter water ion concentrations (Ca, Mg, Na, Cl, HCO₃, etc.) in the Soil & Water section above.' +
                    '</p>' +
                '</div>';
        }

        // Dispatch event for other modules
        document.dispatchEvent(new CustomEvent('gaip:waterDataCleared'));

        flashConfirm(btn, 'Clear Water Data');
        log('clearWater', 'Complete');
    }

    // =========================================================================
    // CLEAR TISSUE DATA
    // =========================================================================

    function clearTissueData(btn) {
        log('clearTissue', 'Clearing all tissue input data');

        // Clear tissue input values (data-val="N", data-val="P", etc.)
        var tissueModule = document.querySelector(SELECTORS.tissueModule);
        if (tissueModule) {
            tissueModule.querySelectorAll('input[data-val]').forEach(function(input) {
                input.value = '';
                input.dispatchEvent(new Event('input', { bubbles: true }));
            });

            // Reset tissue selects to defaults
            tissueModule.querySelectorAll('select.gaip-inp').forEach(function(sel) {
                sel.selectedIndex = 0;
                sel.dispatchEvent(new Event('change', { bubbles: true }));
            });

            // Clear the tissue interpretation output within the card
            var tissueOut = tissueModule.querySelector('#gaipTissueOut');
            if (tissueOut) tissueOut.innerHTML = '';

            // Clear range/band displays
            var ranges = tissueModule.querySelector('.gaip-tissue-ranges');
            if (ranges) ranges.innerHTML = '';
            var bands = tissueModule.querySelector('.gaip-tissue-bands');
            if (bands) bands.innerHTML = '';
        }

        // Clear SampleManager tissue store
        if (window.GAIP_SampleManager) {
            window.GAIP_SampleManager.clearSamples('tissue');
            log('clearTissue', 'SampleManager tissue samples cleared');
        }

        // Clear global state
        window.__GAIP_TISSUE_LAST__ = null;
        window.GAIP_TISSUE_RESULT = null;

        // Reset results output panel
        var tissueOutput = document.querySelector(SELECTORS.tissueOutput);
        if (tissueOutput) {
            tissueOutput.innerHTML =
                '<div class="gaip-tissue-no-data">' +
                    '<p class="gaip-note">' +
                        '<strong>No tissue test data entered.</strong><br>' +
                        'Enter tissue nutrient values (N, P, K, Ca, Mg, S, Fe, Mn, Zn, Cu, B) in the Tissue Testing section.' +
                    '</p>' +
                '</div>';
        }

        // Dispatch event for other modules
        document.dispatchEvent(new CustomEvent('gaip:tissueDataCleared'));

        flashConfirm(btn, 'Clear Tissue Data');
        log('clearTissue', 'Complete');
    }

    // =========================================================================
    // INJECT BUTTONS INTO UI
    // =========================================================================

    function injectButtons() {
        // ── Soil & Water card: Add buttons near the section headers ──

        // Find the Soil & Water card body
        var soilWaterCheckbox = document.querySelector(SELECTORS.soilWaterCard);
        if (!soilWaterCheckbox) {
            log('inject', 'Soil & Water card not found, retrying...');
            return false;
        }

        var soilWaterCard = soilWaterCheckbox.closest('.gaip-card');
        if (!soilWaterCard) return false;

        // --- Soil clear button: place before the soil methodology label ---
        // Search the whole card — a stray </div> in the HTML means some
        // elements sit outside .gaip-card-body in the parsed DOM.
        var soilMethodLabel = soilWaterCard.querySelector(SELECTORS.soilMethodLabel);
        if (soilMethodLabel && !soilWaterCard.querySelector('.gaip-clear-soil-btn')) {
            var soilBtnContainer = document.createElement('div');
            soilBtnContainer.style.cssText = 'display: flex; justify-content: flex-end; margin-bottom: 6px;';

            var soilBtn = createClearButton('Clear Soil Data', 'Clear all soil test inputs and results', clearSoilData);
            soilBtn.classList.add('gaip-clear-soil-btn');
            soilBtnContainer.appendChild(soilBtn);

            soilMethodLabel.parentNode.insertBefore(soilBtnContainer, soilMethodLabel);
            log('inject', 'Soil clear button added');
        }

        // --- Water clear button: place before the "Water quality" h4 ---
        // Search all h4s in the card (not just card-body) because the
        // water section may sit outside card-body due to DOM structure.
        var waterH4 = null;
        soilWaterCard.querySelectorAll('h4').forEach(function(h4) {
            if (h4.textContent.includes('Water quality')) {
                waterH4 = h4;
            }
        });

        if (waterH4 && !soilWaterCard.querySelector('.gaip-clear-water-btn')) {
            var waterBtnContainer = document.createElement('div');
            waterBtnContainer.style.cssText = 'display: flex; justify-content: flex-end; margin-bottom: 6px; margin-top: 12px;';

            var waterBtn = createClearButton('Clear Water Data', 'Clear all water quality inputs and results', clearWaterData);
            waterBtn.classList.add('gaip-clear-water-btn');
            waterBtnContainer.appendChild(waterBtn);

            waterH4.parentNode.insertBefore(waterBtnContainer, waterH4);
            log('inject', 'Water clear button added');
        }

        // ── Tissue card: Add button next to "Save as Sample" in sample switcher ──
        var tissueSwitcher = document.querySelector('.gaip-sample-switcher[data-type="tissue"]');
        if (tissueSwitcher) {
            var importZone = tissueSwitcher.querySelector('.gaip-sample-import-zone');
            if (importZone && !importZone.querySelector('.gaip-clear-tissue-btn')) {
                var tissueBtn = createClearButton('Clear Tissue Data', 'Clear all tissue test inputs and results', clearTissueData);
                tissueBtn.classList.add('gaip-clear-tissue-btn');
                // Match the visual weight of sibling buttons
                tissueBtn.style.cssText =
                    'display: inline-flex; align-items: center; gap: 6px;' +
                    'padding: 8px 14px; font-size: 13px; font-weight: 500;' +
                    'background: linear-gradient(135deg, #ef4444 0%, #dc2626 100%);' +
                    'color: var(--gaip-surface); border: none; border-radius: 6px; cursor: pointer;' +
                    'transition: all 0.2s ease;' +
                    'box-shadow: 0 2px 4px rgba(220, 38, 38, 0.2);';
                tissueBtn.innerHTML = '<span class="gaip-btn-icon">🗑️</span><span>Clear Data</span>';

                tissueBtn.addEventListener('mouseenter', function() {
                    this.style.background = 'linear-gradient(135deg, #dc2626 0%, #b91c1c 100%)';
                    this.style.transform = 'translateY(-1px)';
                    this.style.boxShadow = '0 4px 8px rgba(220, 38, 38, 0.3)';
                });
                tissueBtn.addEventListener('mouseleave', function() {
                    this.style.background = 'linear-gradient(135deg, #ef4444 0%, #dc2626 100%)';
                    this.style.transform = 'none';
                    this.style.boxShadow = '0 2px 4px rgba(220, 38, 38, 0.2)';
                });

                importZone.appendChild(tissueBtn);
                log('inject', 'Tissue clear button added next to Save as Sample');
            }
        } else {
            // Switcher not mounted yet — retry is handled by the delayed init
            log('inject', 'Tissue sample switcher not yet mounted');
            return false;
        }

        return true;
    }

    // =========================================================================
    // INITIALISE
    // =========================================================================

    function init() {
        if (injectButtons()) {
            log('init', 'Clear Data module v' + VERSION + ' initialised');
        } else {
            // Retry — sample-switcher-ui injects tissue switcher at 500ms
            setTimeout(function() {
                if (injectButtons()) {
                    log('init', 'Clear Data module v' + VERSION + ' initialised (delayed)');
                } else {
                    // Second retry for slow DOM
                    setTimeout(function() {
                        if (injectButtons()) {
                            log('init', 'Clear Data module v' + VERSION + ' initialised (2nd retry)');
                        } else {
                            log('init', 'WARNING: Could not inject all clear buttons');
                        }
                    }, 2000);
                }
            }, 1000);
        }
    }

    // Start on DOM ready
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', init);
    } else {
        // DOM already loaded, but cards might be async — slight delay
        setTimeout(init, 500);
    }

    // =========================================================================
    // SITE SWITCH — clear stale DOM inputs
    // =========================================================================
    // When the active site changes, the sample manager swaps its in-memory store
    // but the water/soil ion input fields in the DOM are NOT automatically cleared.
    // If the new site has no water samples those stale DOM values feed waterEngine
    // and produce a phantom water result. Clear them before the new analysis runs.

    document.addEventListener('gaip:site-changed', function(e) {
        var newSiteId = e.detail && e.detail.siteId;

        // Clear water and soil DOM inputs only — do NOT wipe SampleManager stores.
        // By this point _currentSite is already the NEW site, so clearSamples() would
        // destroy the new site's data. domOnly=true skips the SM call.
        var silentBtn = { textContent: '', style: {} };
        clearWaterData(silentBtn, true);
        clearSoilData(silentBtn, true);

        log('siteSwitch', 'DOM inputs cleared (DOM only) for site switch -> ' + (newSiteId || '?'));
    });

    // Expose for console access and testing
    window.GAIP_ClearData = {
        clearSoil: function() { clearSoilData({ textContent: '', style: {} }); },
        clearWater: function() { clearWaterData({ textContent: '', style: {} }); },
        clearTissue: function() { clearTissueData({ textContent: '', style: {} }); },
        clearAll: function() {
            this.clearSoil();
            this.clearWater();
            this.clearTissue();
            log('clearAll', 'All data cleared');
        },
        version: VERSION
    };

})(window, document);

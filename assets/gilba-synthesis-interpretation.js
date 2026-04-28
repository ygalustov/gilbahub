/**
 * Gilba Cross-Module Synthesis Interpretation
 * 
 * Analyses patterns and anomalies across soil, water, and tissue data.
 * Only appears when 2+ modules have data available.
 * 
 * @package Gilba_Hub
 * @version 1.0.0
 * @since 10.5.11
 */

(function() {
    'use strict';


    // =========================================================================
    // CONFIGURATION
    // =========================================================================

    const CONFIG = {
        // Minimum modules required for synthesis
        minModules: 2,
        
        // Selectors for result containers
        resultsContainer: '.gaip-results',
        soilContainer: '.gaip-mlsn-progressive-container, .gaip-soil-body',
        waterContainer: '.gaip-water-progressive-container, .gaip-water-body',
        tissueContainer: '.gaip-tissue-progressive-container, .gaip-tissue-body',
        
        // Button will be injected before the export controls (report section)
        insertAfter: '.gaip-run-btn',
    };

    // =========================================================================
    // STATE
    // =========================================================================

    let wrapper = null;
    let button = null;
    let outputEl = null;
    let isLoading = false;

    // =========================================================================
    // INITIALIZATION
    // =========================================================================

    function init() {
        // Wait for results to be rendered
        document.addEventListener('gaip:analysis-complete', onAnalysisComplete);
        
        // Also use MutationObserver on results container
        const resultsContainer = document.querySelector(CONFIG.resultsContainer);
        if (resultsContainer) {
            const observer = new MutationObserver((mutations) => {
                // Check if we have enough modules for synthesis
                setTimeout(checkAndInject, 500);
            });
            observer.observe(resultsContainer, { childList: true, subtree: true });
        }
        
        // Fallback check
        setTimeout(checkAndInject, 3000);
    }

    /**
     * Handle analysis complete event
     */
    function onAnalysisComplete() {
        setTimeout(checkAndInject, 500);
    }

    // Cooldown after site switch — prevents MutationObserver from immediately
    // re-injecting the button before the new site's data is rendered.
    var _siteSwitchCooldown = false;

    /**
     * Remove the synthesis UI (called on site switch)
     */
    function removeUI() {
        var existing = document.querySelector('.gilba-synthesis-wrapper, .gilba-synthesis-btn');
        if (existing) {
            var wrapper = existing.closest('.gilba-synthesis-wrapper') || existing.parentElement;
            if (wrapper) wrapper.remove();
            else existing.remove();
        }
        // Also remove any floating clone
        var floater = document.querySelector('.gilba-synthesis-floater');
        if (floater) floater.remove();
        button = null;
        // Block re-injection for 3 seconds while new site renders
        _siteSwitchCooldown = true;
        setTimeout(function() {
            _siteSwitchCooldown = false;
            // Re-check after cooldown in case new site does have enough data
            checkAndInject();
        }, 3000);
    }

    /**
     * Check if we have enough data and inject UI
     */
    function checkAndInject() {
        // Don't inject during site-switch cooldown
        if (_siteSwitchCooldown) {
            return;
        }
        // Don't inject twice
        if (document.querySelector('.gilba-synthesis-btn')) {
            return;
        }
        
        // Count available modules
        const modules = countAvailableModules();
        
        if (modules.count >= CONFIG.minModules) {
            injectUI(modules);
        }
    }

    /**
     * Count which modules have data
     */
    function countAvailableModules() {
        const result = {
            count: 0,
            soil: false,
            water: false,
            tissue: false,
            labels: []
        };

        // Gate on SampleManager — if the active site has no samples at all,
        // the DOM may still contain cards from the previously active site.
        // Don't show the button until this site has actual data entered.
        try {
            const SM = window.GAIP_SampleManager;
            if (SM && typeof SM.getActiveSiteId === 'function') {
                const activeSiteId = SM.getActiveSiteId();
                const soilSamples = SM.getSamples ? SM.getSamples('soil') : [];
                const waterSamples = SM.getSamples ? SM.getSamples('water') : [];
                if (soilSamples.length === 0 && waterSamples.length === 0) {
                    return result; // count stays 0 — no button
                }
            }
        } catch(e) { /* non-fatal */ }
        
        // Check soil — require actual nutrient values (ppm inputs with non-zero values)
        const soilContainer = document.querySelector(CONFIG.soilContainer);
        if (soilContainer && soilContainer.innerHTML.length > 200) {
            const mlsnInputs = soilContainer.querySelectorAll('[data-mlsn]');
            let hasSoilValues = false;
            mlsnInputs.forEach(function(el) {
                if (parseFloat(el.value) > 0) hasSoilValues = true;
            });
            // Also accept rendered diagnostic cards (post-analysis render)
            if (!hasSoilValues) {
                const cards = soilContainer.querySelectorAll('.gaip-nutrient-card, .gaip-diagnostic-card');
                hasSoilValues = cards.length > 0 && soilContainer.innerHTML.length > 500;
            }
            if (hasSoilValues) {
                result.soil = true;
                result.count++;
                result.labels.push('Soil');
            }
        }
        
        // Check water — require actual ion values (non-empty diagnostic cards)
        const waterContainer = document.querySelector(CONFIG.waterContainer);
        if (waterContainer && waterContainer.innerHTML.length > 200) {
            const waterCards = waterContainer.querySelectorAll('.gaip-diagnostic-card, .gaip-water-diagnostic');
            const hasWaterData = waterCards.length > 0 && waterContainer.innerHTML.length > 500;
            if (hasWaterData) {
                result.water = true;
                result.count++;
                result.labels.push('Water');
            }
        }
        
        // Check tissue
        const tissueContainer = document.querySelector(CONFIG.tissueContainer);
        if (tissueContainer && tissueContainer.innerHTML.length > 200) {
            const hasTissueData = tissueContainer.querySelector('.gaip-diagnostic-card, .tissue-card, .gaip-tissue-cards-grid');
            if (hasTissueData) {
                result.tissue = true;
                result.count++;
                result.labels.push('Tissue');
            }
        }
        
        return result;
    }

    /**
     * Inject the synthesis UI
     */
    function injectUI(modules) {
        // Insert into the Reports tab actions area (alongside Export to Word, What-If)
        const reportsActions = document.getElementById('gaip-reports-actions');
        // Fallback to legacy insertion points if reports container not yet built
        const insertPoint = reportsActions ||
                           document.querySelector(CONFIG.insertAfter) || 
                           document.querySelector(CONFIG.resultsContainer);
        
        if (!insertPoint) {
            return;
        }
        
        // Create wrapper
        wrapper = document.createElement('div');
        wrapper.className = 'gilba-synthesis-wrapper';
        wrapper.innerHTML = `
            <div class="gilba-synthesis-header">
                <button type="button" class="gilba-synthesis-btn">
                    <span class="gilba-synthesis-icon">🔗</span>
                    <span class="gilba-synthesis-text">Analyse Cross-Module Patterns</span>
                    <span class="gilba-synthesis-modules">${modules.labels.join(' + ')}</span>
                </button>
            </div>
            <div class="gilba-synthesis-output" style="display: none;"></div>
        `;
        
        // If we have the reports actions div, append inside it; otherwise insert after
        if (reportsActions) {
            reportsActions.appendChild(wrapper);
        } else {
            insertPoint.after(wrapper);
        }
        
        // Store references
        button = wrapper.querySelector('.gilba-synthesis-btn');
        outputEl = wrapper.querySelector('.gilba-synthesis-output');
        
        // Bind click handler
        button.addEventListener('click', handleSynthesisClick);
        
        // Floating duplicate — appears when original button scrolls out of view.
        // position:sticky won't work here because ancestor .gaip-card has
        // overflow:hidden, so we use a fixed-position clone instead.
        const header = wrapper.querySelector('.gilba-synthesis-header');
        if (header && typeof IntersectionObserver !== 'undefined') {
            const floater = document.createElement('button');
            floater.type = 'button';
            floater.className = 'gilba-synthesis-btn gilba-synthesis-floater';
            floater.innerHTML = button.innerHTML;
            floater.style.cssText = [
                'position:fixed',
                'bottom:80px',          // sits above the green Update FAB
                'right:24px',
                'z-index:9998',
                'opacity:0',
                'pointer-events:none',
                'transform:translateY(12px)',
                'transition:opacity .25s ease, transform .25s ease',
                'box-shadow:0 4px 14px rgba(124,58,237,0.35), 0 2px 6px rgba(0,0,0,0.1)',
                'border-radius:50px',
                'padding:10px 18px',
                'font-size:13px',
            ].join(';');
            document.body.appendChild(floater);
            
            // Mirror click to the real button
            floater.addEventListener('click', () => button.click());
            
            // Sync disabled / loading state
            const syncState = () => {
                floater.disabled = button.disabled;
                floater.innerHTML = button.innerHTML;
            };
            const mo = new MutationObserver(syncState);
            mo.observe(button, { attributes: true, childList: true, subtree: true });
            
            // Show/hide based on original button visibility
            const io = new IntersectionObserver(([entry]) => {
                const show = !entry.isIntersecting;
                floater.style.opacity = show ? '1' : '0';
                floater.style.pointerEvents = show ? 'auto' : 'none';
                floater.style.transform = show ? 'translateY(0)' : 'translateY(12px)';
            }, { threshold: 0 });
            io.observe(header);
        }
        
    }

    /**
     * Handle synthesis button click
     */
    async function handleSynthesisClick() {
        if (isLoading) return;
        
        // Collect data from all modules
        const synthesisData = collectSynthesisData();
        
        if (!synthesisData) {
            showError('Unable to collect module data. Please ensure analysis has run.');
            return;
        }
        
        setLoading(true);
        
        try {
            const formData = new FormData();
            formData.append('action', 'gilba_interpret_synthesis');
            formData.append('nonce', window.GAIP_HUB_CONFIG?.nonce || '');
            formData.append('synthesis_data', JSON.stringify(synthesisData));
            
            const response = await fetch(window.GAIP_HUB_CONFIG?.ajaxUrl || '/wp-admin/admin-ajax.php', {
                method: 'POST',
                body: formData
            });
            
            const data = await response.json();
            
            if (data.success) {
                // Store globally for Word export
                window.GAIP_SYNTHESIS_INTERPRETATION = data.data;
                renderInterpretation(data.data);
            } else {
                showError(data.data?.message || 'Analysis failed');
            }
            
        } catch (err) {
            console.error('[Synthesis] Error:', err);
            showError('Network error — please try again');
        } finally {
            setLoading(false);
        }
    }

    /**
     * Collect data from all available modules
     * 
     * Data source priority:
     *   1. window.GAIP_STATE (set by hub-tissue-v3.js after analysis)
     *   2. window.GAIP_CANONICAL_STATE (set by hub-orchestrator.js)
     *   3. DOM fallback (read inputs directly)
     */
    function collectSynthesisData() {
        // GAIP_STATE is the main state object populated by hub-tissue-v3.js
        const gaipState = window.GAIP_STATE || {};
        const canonicalState = window.GAIP_CANONICAL_STATE || {};
        
        // Debug: log what we're working with
        console.log('[Synthesis] Collecting data...');
        console.log('[Synthesis] GAIP_STATE keys:', Object.keys(gaipState));
        console.log('[Synthesis] GAIP_STATE.soil:', gaipState.soil);
        console.log('[Synthesis] GAIP_STATE.water:', gaipState.water);
        
        const data = {
            soil: null,
            water: null,
            tissue: null,
            context: {}
        };
        
        // =====================================================================
        // SOIL: Try GAIP_STATE.soil.ppm → DOM fallback
        // =====================================================================
        const soilState = gaipState.soil || canonicalState.soil || {};
        const mlsnResults = gaipState.mlsnResults || window.__GAIP_MLSN_LAST__ || {};
        
        // Build ppm from state OR DOM
        let soilPpm = soilState.ppm || {};
        if (!soilPpm || Object.keys(soilPpm).length === 0) {
            // DOM fallback: read directly from soil grid inputs
            soilPpm = collectGridValues('.gaip-soil-grid', 'data-mlsn');
            if (Object.keys(soilPpm).length > 0) {
                console.log('[Synthesis] Soil ppm recovered from DOM fallback:', soilPpm);
            }
        }
        
        if (soilPpm && Object.keys(soilPpm).length > 0) {
            data.soil = {
                pH: soilState.pH_water || soilState.pH_cacl2 || getInputValue('.gaip-soil-ph'),
                EC: soilState.ECe || soilState.EC1_5 || getInputValue('.gaip-soil-ec'),
                CEC: soilState.CEC || getInputValue('.gaip-cec'),
                methodology: soilState.methodology || 'mlsn',
                construction: gaipState.turf?.construction || canonicalState.turf?.construction || getSelectedValue('.gaip-construction'),
                soilTexture: soilState.soilTexture || 'loam',
                ppm: {},
                status: {}
            };
            
            // Get nutrients — allow zero values (a zero test result is valid data)
            const nutrients = ['K', 'P', 'Ca', 'Mg', 'S', 'Fe', 'Mn', 'Zn', 'Cu', 'Na'];
            nutrients.forEach(n => {
                const value = soilPpm[n];
                if (value !== undefined && value !== null) {
                    const num = parseFloat(value);
                    if (!isNaN(num)) {
                        data.soil.ppm[n] = num;
                        data.soil.status[n] = mlsnResults.nutrients?.[n]?.status || 'unknown';
                    }
                }
            });
            
            // Only keep soil if we have actual nutrient data
            if (Object.keys(data.soil.ppm).length === 0) {
                console.log('[Synthesis] Soil: ppm keys found but all values were null/NaN — discarding');
                data.soil = null;
            } else {
                console.log('[Synthesis] Soil: ✓ collected', Object.keys(data.soil.ppm).length, 'nutrients');
            }
        } else {
            console.log('[Synthesis] Soil: no ppm data found in state or DOM');
        }
        
        // =====================================================================
        // WATER: Try GAIP_STATE.water.ions → waterResults → __GAIP_WATER_STATE__ → DOM
        // =====================================================================
        const waterState = gaipState.water || {};
        const waterResults = gaipState.waterResults || {};
        const waterCalcs = window.__GAIP_WATER_STATE__ || {};
        
        // Try multiple sources for ions — check __GAIP_WATER_STATE__ early as it's most reliable
        let waterIons = (waterState.ions && Object.keys(waterState.ions).length > 0) ? waterState.ions : null;
        if (!waterIons && waterCalcs.water?.ions && Object.keys(waterCalcs.water.ions).length > 0) {
            waterIons = waterCalcs.water.ions;
            console.log('[Synthesis] Water ions from __GAIP_WATER_STATE__.water.ions');
        }
        if (!waterIons && waterCalcs.ions && Object.keys(waterCalcs.ions).length > 0) {
            waterIons = waterCalcs.ions;
            console.log('[Synthesis] Water ions from __GAIP_WATER_STATE__.ions');
        }
        if (!waterIons && waterResults.ions && Object.keys(waterResults.ions).length > 0) {
            waterIons = waterResults.ions;
            console.log('[Synthesis] Water ions recovered from waterResults');
        }
        if (!waterIons) {
            // DOM fallback: read directly from water grid inputs
            waterIons = collectGridValues('.gaip-water-grid', 'data-ion');
            if (Object.keys(waterIons).length > 0) {
                console.log('[Synthesis] Water ions recovered from DOM fallback:', waterIons);
            }
        }
        
        if (waterIons && Object.keys(waterIons).length > 0) {
            data.water = {
                ecw: waterState.ecw || waterCalcs.ecw || waterCalcs.water?.ecw || getInputValue('.gaip-ecw'),
                pH: waterState.pH || waterCalcs.water?.pH || getInputValue('.gaip-water-ph'),
                SAR: waterCalcs.SAR || waterCalcs.sar || waterState.SAR,
                SARadj: waterCalcs.SARadj || waterCalcs.saradj || waterState.SARadj,
                ions: {}
            };
            
            // Get ions — allow zero values (zero boron is meaningful data)
            const ions = ['Ca', 'Mg', 'Na', 'K', 'Cl', 'HCO3', 'CO3', 'SO4', 'B', 'Fe'];
            ions.forEach(ion => {
                const value = waterIons[ion];
                if (value !== undefined && value !== null) {
                    const num = parseFloat(value);
                    if (!isNaN(num)) {
                        data.water.ions[ion] = num;
                    }
                }
            });
            
            // Get diagnostics if available
            if (waterCalcs.diagnostics) {
                data.water.diagnostics = waterCalcs.diagnostics;
            }
            
            // Only keep water if we have at least 1 non-zero ion value
            const nonZeroIons = Object.values(data.water.ions).filter(v => v > 0).length;
            if (nonZeroIons < 1) {
                console.log('[Synthesis] Water: ions found but all zero — discarding');
                data.water = null;
            } else {
                console.log('[Synthesis] Water: ✓ collected', Object.keys(data.water.ions).length, 'ions (' + nonZeroIons + ' non-zero)');
            }
        } else {
            console.log('[Synthesis] Water: no ion data found in state or DOM');
        }
        
        // =====================================================================
        // TISSUE: Try canonical inputs/computed → GAIP_STATE → DOM
        // =====================================================================
        // GAIP_STATE in orchestrator context has keys: inputs, computed, derived, turf
        // Tissue lives at inputs.tissue or computed.tissue
        const canonicalTissue = canonicalState.tissue           // set by orchestrator from hub-tissue-v3
                             || canonicalState.inputs?.tissue
                             || canonicalState.computed?.tissue
                             || null;
        if (canonicalTissue) console.log('[Synthesis] Tissue found in canonical state');
        const tissueState = canonicalTissue
                         || gaipState.tissue
                         || gaipState.tissueResults
                         || {};
        const tissueValues = tissueState.tissue || tissueState; // Handle both nested and flat structures
        
        if (tissueValues && Object.keys(tissueValues).length > 0) {
            const tissueNutrients = ['N', 'P', 'K', 'Ca', 'Mg', 'S', 'Fe', 'Mn', 'Zn', 'Cu', 'B', 'Na'];
            let hasData = false;
            
            data.tissue = {
                status: {}
            };
            
            tissueNutrients.forEach(n => {
                const value = tissueValues[n]
                           || getInputValue(`[data-tissue-nutrient="${n}"]`)
                           || getInputValue(`[data-val="${n}"]`)
                           || getInputValue(`[name="tissue.${n}"]`);
                if (value !== undefined && value !== null && value !== '' && parseFloat(value) !== 0) {
                    data.tissue[n] = parseFloat(value);
                    data.tissue.status[n] = tissueState.status?.[n] || 'unknown';
                    hasData = true;
                }
            });
            
            if (!hasData) {
                data.tissue = null;
            } else {
                console.log('[Synthesis] Tissue: ✓ collected');
            }
        }
        
        // =====================================================================
        // CONTEXT
        // =====================================================================
        const turfState = gaipState.turf || canonicalState.turf || {};
        data.context = {
            turfType: turfState.turfType || getSelectedValue('.gaip-turf-type'),
            species: turfState.speciesKey || turfState.grassSpecies || getSelectedValue('.gaip-species'),
            region: detectRegion(),
            lat: getLatitude(),
            season: gaipState.climate?.season || canonicalState.climate?.season || null
        };
        
        // =====================================================================
        // VALIDATE: need at least 2 modules
        // =====================================================================
        let moduleCount = 0;
        if (data.soil) moduleCount++;
        if (data.water) moduleCount++;
        if (data.tissue) moduleCount++;
        
        console.log('[Synthesis] Module count:', moduleCount,
            '(soil:', !!data.soil, ', water:', !!data.water, ', tissue:', !!data.tissue, ')');
        
        if (moduleCount < 2) {
            console.warn('[Synthesis] ✗ Need 2+ modules but only found', moduleCount);
            return null;
        }
        
        return data;
    }
    
    /**
     * DOM grid value collector (mirrors hub-tissue-v3.js collectGridValues)
     */
    function collectGridValues(gridSelector, attrName) {
        const grid = document.querySelector(gridSelector);
        const result = {};
        if (!grid) return result;
        const inputs = grid.querySelectorAll('input[' + attrName + ']');
        inputs.forEach(input => {
            const key = input.getAttribute(attrName);
            const val = parseFloat(input.value);
            if (key && !isNaN(val)) {
                result[key] = val;
            }
        });
        return result;
    }

    /**
     * Get input value helper
     */
    function getInputValue(selector) {
        const el = document.querySelector(selector);
        return el ? parseFloat(el.value) || null : null;
    }

    /**
     * Get selected value helper
     */
    function getSelectedValue(selector) {
        const el = document.querySelector(selector);
        return el ? el.value : null;
    }

    /**
     * Detect region
     */
    function detectRegion() {
        if (typeof window.gaip_getCurrentRegion === 'function') {
            const region = window.gaip_getCurrentRegion();
            return region?.id || region?.name || '';
        }
        
        const lat = getLatitude();
        if (lat !== null && lat < 0) {
            return 'australia';
        }
        
        return '';
    }

    /**
     * Get latitude
     */
    function getLatitude() {
        const state = window.GAIP_CANONICAL_STATE || window.__GAIP_STATE__ || {};
        let lat = state.location?.lat || state.site?.lat || state.climate?.lat || null;
        
        if (!lat) {
            const latInput = document.querySelector('.gaip-lat');
            if (latInput) {
                lat = parseFloat(latInput.value) || null;
            }
        }
        
        return lat;
    }

    /**
     * Render interpretation result
     */
    function renderInterpretation(result) {
        let narrative = result.narrative || '';
        
        // Convert markdown bold to HTML
        narrative = narrative.replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>');
        
        // Convert headers
        narrative = narrative.replace(/^### (.+)$/gm, '<h4 class="gilba-synthesis-h4">$1</h4>');
        narrative = narrative.replace(/^## (.+)$/gm, '<h3 class="gilba-synthesis-h3">$1</h3>');
        
        // Convert bullet points
        narrative = narrative.replace(/^- (.+)$/gm, '<li>$1</li>');
        narrative = narrative.replace(/(<li>.*<\/li>\n?)+/g, '<ul class="gilba-synthesis-list">$&</ul>');
        
        // Convert paragraphs (lines not already wrapped)
        narrative = narrative.split('\n\n').map(para => {
            para = para.trim();
            if (!para) return '';
            if (para.startsWith('<')) return para; // Already has HTML
            return `<p>${para}</p>`;
        }).join('\n');
        
        outputEl.innerHTML = `
            <div class="gilba-synthesis-narrative">
                ${narrative}
            </div>
            ${result.cached ? '<span class="gilba-synthesis-cached" title="Cached result">●</span>' : ''}
        `;
        
        outputEl.style.display = 'block';
        
        // Update button text
        button.querySelector('.gilba-synthesis-text').textContent = 'Refresh Analysis';
    }

    /**
     * Show error message
     */
    function showError(message) {
        outputEl.innerHTML = `
            <div class="gilba-synthesis-error">
                <span class="gilba-synthesis-error-icon">⚠️</span>
                ${message}
            </div>
        `;
        outputEl.style.display = 'block';
    }

    /**
     * Set loading state
     */
    function setLoading(loading) {
        isLoading = loading;
        button.disabled = loading;
        
        if (loading) {
            button.querySelector('.gilba-synthesis-icon').textContent = '⏳';
            button.querySelector('.gilba-synthesis-text').textContent = 'Analysing patterns...';
        } else {
            button.querySelector('.gilba-synthesis-icon').textContent = '🔗';
        }
    }

    // =========================================================================
    // INITIALIZATION
    // =========================================================================

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', init);
        // Remove button on site switch — new site may not have sufficient data
        document.addEventListener('gaip:site-changed', function() {
            removeUI();
        });
    } else {
        init();
    }

    // Export for external access
    window.GilbaSynthesisInterpretation = {
        refresh: handleSynthesisClick,
        getInterpretation: () => window.GAIP_SYNTHESIS_INTERPRETATION
    };

})();

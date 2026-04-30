/**
 * Gilba Water Quality AI Interpretation
 * 
 * Adds an "Interpret Results" button to water quality output
 * and handles the AI interpretation request/display.
 * 
 * NOTE: Currently hidden in favour of cross-module synthesis.
 * Set GILBA_SHOW_SINGLE_MODULE_INTERPRET = true to re-enable.
 * 
 * @version 1.0.2
 */

(function() {
    'use strict';
    
    // Feature flag - set to true to show individual module interpretation
    const SHOW_SINGLE_MODULE = window.GILBA_SHOW_SINGLE_MODULE_INTERPRET || false;
    
    if (!SHOW_SINGLE_MODULE) {
        return; // Exit early - don't inject UI
    }
    
    let interpretButton = null;
    let interpretOutput = null;
    let isLoading = false;
    
    /**
     * Initialize water interpretation UI
     */
    function init() {
        // Use MutationObserver to detect when water results are rendered
        const waterBody = document.querySelector('.gaip-water-body');
        if (waterBody) {
            const observer = new MutationObserver((mutations) => {
                // Check if water content was added
                if (waterBody.innerHTML.length > 100 && !document.querySelector('.gilba-water-interpret-btn')) {
                    // Wait a tick for all content to settle
                    setTimeout(() => {
                        if (!document.querySelector('.gilba-water-interpret-btn')) {
                            injectUI(waterBody);
                        }
                    }, 100);
                }
            });
            
            observer.observe(waterBody, { childList: true, subtree: true });
        }
        
        // Also listen for custom event
        document.addEventListener('gaip:water-analysis-complete', onWaterComplete);
        document.addEventListener('gaip:analysis-complete', onWaterComplete);
        
        // Fallback check on page load
        setTimeout(() => {
            const waterSection = document.querySelector('.gaip-water-body');
            if (waterSection && waterSection.innerHTML.length > 100 && !document.querySelector('.gilba-water-interpret-btn')) {
                injectUI(waterSection);
            }
        }, 2000);
        
    }
    
    /**
     * Handle water analysis complete event
     */
    function onWaterComplete(event) {
        setTimeout(() => {
            const waterSection = document.querySelector('.gaip-water-body');
            if (waterSection && waterSection.innerHTML.length > 100 && !document.querySelector('.gilba-water-interpret-btn')) {
                injectUI(waterSection);
            }
        }, 200);
    }
    
    /**
     * Inject the interpretation UI into the water section
     */
    function injectUI(container) {
        // Find the best insertion point - after the phytotoxicity card or at the end
        const phytotoxCard = container.querySelector('.gaip-diagnostic-card.water-card');
        const priorityActions = container.querySelector('.gaip-water-management-section, .gaip-priority-actions');
        const lastCard = container.querySelector('.gaip-diagnostic-card:last-of-type');
        const progressiveContainer = container.querySelector('.gaip-water-progressive-container');
        
        let insertPoint = phytotoxCard || priorityActions || lastCard || progressiveContainer || container;
        
        // Create wrapper
        const wrapper = document.createElement('div');
        wrapper.className = 'gilba-water-interpretation-wrapper';
        wrapper.style.marginTop = '16px';
        wrapper.innerHTML = `
            <div class="gilba-interpretation-header">
                <button type="button" class="gilba-water-interpret-btn gilba-interpret-btn">
                    <span class="gilba-interpret-icon">💧</span>
                    <span class="gilba-interpret-text">Interpret Water Quality</span>
                </button>
            </div>
            <div class="gilba-water-interpretation-output" style="display: none;"></div>
        `;
        
        // Insert after the found element or at end of container
        if (insertPoint && insertPoint !== container) {
            insertPoint.after(wrapper);
        } else {
            container.appendChild(wrapper);
        }
        
        // Store references
        interpretButton = wrapper.querySelector('.gilba-water-interpret-btn');
        interpretOutput = wrapper.querySelector('.gilba-water-interpretation-output');
        
        // Bind click handler
        interpretButton.addEventListener('click', handleInterpretClick);
        
    }
    
    /**
     * Handle interpret button click
     */
    async function handleInterpretClick() {
        if (isLoading) return;
        
        // Collect water output data
        const waterOutput = collectWaterOutput();
        
        if (!waterOutput || Object.keys(waterOutput.ions || {}).length === 0) {
            showError('No water quality data available. Please run an analysis first.');
            return;
        }
        
        setLoading(true);
        
        try {
            const result = generateLocalInterpretation(waterOutput);
            window.GAIP_WATER_INTERPRETATION = result;
            renderInterpretation(result);
        } catch (err) {
            console.error('[WaterInterpretation] Error:', err);
            showError('Interpretation failed — local engine unavailable');
        } finally {
            setLoading(false);
        }
    }

    function generateLocalInterpretation(waterOutput) {
        const engine = window.GAIP_WordExport;
        if (!engine || typeof engine.generateWaterNarrative !== 'function') {
            throw new Error('GAIP_WordExport.generateWaterNarrative unavailable');
        }

        const turfState = window.GAIP_STATE?.turf || window.GAIP_CANONICAL_STATE?.turf || {};
        const waterData = normalizeWaterOutput(waterOutput);
        const turfData = {
            overseedDominant: !!turfState.overseedDominant,
            effectiveSpecies: turfState.effectiveSpecies || turfState.species || turfState.grassSpecies || null,
            species: turfState.species || turfState.grassSpecies || null
        };
        const analysis = engine.generateWaterNarrative(waterData, turfData) || {};

        return {
            narrative: formatInterpretationNarrative(analysis.narrative, analysis.recommendations),
            concerns: analysis.concerns || [],
            recommendations: analysis.recommendations || [],
            cached: false,
            citations: {}
        };
    }

    function normalizeWaterOutput(waterOutput) {
        const ions = waterOutput.ions || {};
        const state = window.GAIP_STATE || window.GAIP_CANONICAL_STATE || {};
        const waterState = state.water || window.__GAIP_WATER_STATE__ || {};
        return {
            EC: waterOutput.ecw != null ? parseFloat(waterOutput.ecw) : null,
            pH: ions.pH != null ? parseFloat(ions.pH) : null,
            SAR: waterOutput.SAR != null ? parseFloat(waterOutput.SAR) : null,
            adjSAR: waterOutput.SARadj != null ? parseFloat(waterOutput.SARadj) : null,
            Cl: ions.Cl != null ? parseFloat(ions.Cl) : null,
            HCO3: ions.HCO3 != null ? parseFloat(ions.HCO3) : null,
            Na: ions.Na != null ? parseFloat(ions.Na) : null,
            Ca: ions.Ca != null ? parseFloat(ions.Ca) : null,
            Mg: ions.Mg != null ? parseFloat(ions.Mg) : null,
            RSC: waterState.RSC != null ? parseFloat(waterState.RSC) : null
        };
    }

    function formatInterpretationNarrative(narrativeParts, recommendations) {
        const blocks = [];
        if (Array.isArray(narrativeParts)) {
            narrativeParts.filter(Boolean).forEach(part => blocks.push(String(part).trim()));
        } else if (narrativeParts) {
            blocks.push(String(narrativeParts).trim());
        }
        if (Array.isArray(recommendations) && recommendations.length) {
            blocks.push('## Recommendations');
            recommendations.forEach(rec => blocks.push('1. ' + rec));
        }
        return blocks.join('\n\n');
    }
    
    /**
     * Collect water output data from the page
     */
    function collectWaterOutput() {
        const state = window.GAIP_CANONICAL_STATE || window.__GAIP_STATE__ || {};
        const waterState = window.__GAIP_WATER_STATE__ || {};
        
        // Get ion inputs
        const ions = {};
        const ionInputs = {
            'Ca': '.gaip-ca, [name="ca"], [data-ion="Ca"]',
            'Mg': '.gaip-mg, [name="mg"], [data-ion="Mg"]',
            'Na': '.gaip-na, [name="na"], [data-ion="Na"]',
            'K': '.gaip-k, [name="k"], [data-ion="K"]',
            'Cl': '.gaip-cl, [name="cl"], [data-ion="Cl"]',
            'HCO3': '.gaip-hco3, [name="hco3"], [data-ion="HCO3"]',
            'CO3': '.gaip-co3, [name="co3"], [data-ion="CO3"]',
            'SO4': '.gaip-so4, [name="so4"], [data-ion="SO4"]',
            'B': '.gaip-b, [name="b"], [data-ion="B"]',
            'Fe': '.gaip-fe, [name="fe"], [data-ion="Fe"]',
        };
        
        for (const [ion, selectors] of Object.entries(ionInputs)) {
            const input = document.querySelector(selectors);
            if (input && input.value) {
                ions[ion] = parseFloat(input.value) || 0;
            }
        }
        
        // Get EC and pH
        const ecInput = document.querySelector('.gaip-ecw, [name="ecw"], [data-param="ecw"]');
        const phInput = document.querySelector('.gaip-water-ph, [name="water_ph"], [data-param="ph"]');
        
        const ecw = ecInput ? parseFloat(ecInput.value) || 0 : 0;
        const pH = phInput ? parseFloat(phInput.value) || 0 : 0;
        
        ions.pH = pH;
        
        // Get SAR values if calculated
        const SAR = state.water?.SAR || waterState.SAR || null;
        const SARadj = state.water?.adjSAR || waterState.SARadj || null;
        
        // Get diagnostics from rendered cards
        const diagnostics = collectDiagnostics();
        
        // Get latitude from DOM or state
        let lat = state.location?.lat || state.site?.lat || state.climate?.lat || null;
        if (!lat) {
            const latInput = document.querySelector('.gaip-lat');
            if (latInput) {
                lat = parseFloat(latInput.value) || null;
            }
        }
        
        // Get region from state or detect from lat
        let region = state.location?.region || state.site?.region || '';
        if (!region && typeof window.gaip_getCurrentRegion === 'function') {
            const regionObj = window.gaip_getCurrentRegion();
            region = regionObj?.id || regionObj?.name || '';
        }
        // Fallback region detection from lat
        if (!region && lat !== null) {
            if (lat < 0) region = 'australia';
        }
        
        // Get context
        const context = {
            turfType: state.species?.speciesKey || state.turf?.grassSpecies || 'turf',
            region: region,
            lat: lat,
            waterSource: 'irrigation water',
        };
        
        return {
            ions,
            ecw,
            pH,
            SAR,
            SARadj,
            diagnostics,
            context
        };
    }
    
    /**
     * Collect diagnostics from rendered diagnostic cards
     */
    function collectDiagnostics() {
        const diagnostics = [];
        
        // Find all diagnostic cards in water section
        const cards = document.querySelectorAll('.gaip-water-progressive-container .gaip-diagnostic-card, .gaip-water-body .gaip-diagnostic-card');
        
        cards.forEach(card => {
            const label = card.querySelector('.gaip-card-label, .gaip-param-label')?.textContent?.trim();
            const value = card.querySelector('.gaip-card-value, .gaip-param-value')?.textContent?.trim();
            const status = card.querySelector('.gaip-status-badge, .gaip-card-status')?.textContent?.trim();
            const driver = card.querySelector('.gaip-card-driver, .gaip-driver-text')?.textContent?.trim();
            
            // Determine status class
            let statusClass = 'status-ok';
            const statusEl = card.querySelector('.gaip-status-badge, .gaip-card-status');
            if (statusEl) {
                if (statusEl.classList.contains('status-deficient') || statusEl.classList.contains('status-high')) {
                    statusClass = 'status-deficient';
                } else if (statusEl.classList.contains('status-borderline') || statusEl.classList.contains('status-moderate')) {
                    statusClass = 'status-borderline';
                }
            }
            
            if (label && value) {
                diagnostics.push({
                    label,
                    value,
                    status: status || '',
                    statusClass,
                    driver: driver || ''
                });
            }
        });
        
        return diagnostics;
    }
    
    /**
     * Render the interpretation result
     */
    function renderInterpretation(result) {
        let narrative = result.narrative || '';
        
        // Convert **text** to <strong>
        narrative = narrative.replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>');
        
        // Convert paragraphs
        narrative = narrative
            .split(/\n\n+/)
            .filter(p => p.trim())
            .map(p => `<p>${p.trim()}</p>`)
            .join('');
        
        // Link citations
        if (result.citations) {
            narrative = linkCitations(narrative, result.citations);
        }
        
        interpretOutput.innerHTML = `
            <div class="gilba-interpretation-content gilba-water-interpretation">
                <div class="gilba-interpretation-header-bar">
                    <span class="gilba-interpretation-title">💧 Water Quality Interpretation</span>
                    ${result.cached ? '<span class="gilba-cached-badge" title="Cached result">Cached</span>' : ''}
                </div>
                <div class="gilba-narrative">${narrative}</div>
            </div>
        `;
        
        interpretOutput.style.display = 'block';
        interpretButton.querySelector('.gilba-interpret-text').textContent = 'Refresh Interpretation';
        
        // Scroll into view
        interpretOutput.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
    }
    
    /**
     * Link citation references to their sources
     */
    function linkCitations(text, citations) {
        return text.replace(/\[([a-z0-9\-]+)\]/gi, (match, id) => {
            const cite = citations[id];
            if (cite) {
                const title = `${cite.title} (${cite.authors}, ${cite.year})`;
                return `<span class="gilba-citation" title="${title}">[${id}]</span>`;
            }
            return match;
        });
    }
    
    /**
     * Show error message
     */
    function showError(message) {
        interpretOutput.innerHTML = `
            <div class="gilba-interpretation-error">
                <span class="gilba-error-icon">⚠️</span>
                <span class="gilba-error-text">${message}</span>
            </div>
        `;
        interpretOutput.style.display = 'block';
    }
    
    /**
     * Set loading state
     */
    function setLoading(loading) {
        isLoading = loading;
        interpretButton.disabled = loading;
        
        const icon = interpretButton.querySelector('.gilba-interpret-icon');
        const text = interpretButton.querySelector('.gilba-interpret-text');
        
        if (loading) {
            icon.textContent = '⏳';
            text.textContent = 'Interpreting...';
            interpretButton.classList.add('gilba-loading');
        } else {
            icon.textContent = '💧';
            interpretButton.classList.remove('gilba-loading');
        }
    }
    
    // Initialize when DOM is ready
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', init);
    } else {
        init();
    }
    
    
})();

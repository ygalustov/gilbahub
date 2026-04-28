/**
 * Gilba Soil Interpretation UI
 * 
 * Adds "Interpret results" button to soil analysis output.
 * Fetches AI interpretation via AJAX and displays narrative.
 * Caches interpretation for Word export integration.
 * 
 * NOTE: Currently hidden in favour of cross-module synthesis.
 * Set GILBA_SHOW_SINGLE_MODULE_INTERPRET = true to re-enable.
 * 
 * @package Gilba_Hub
 * @version 1.0.2
 * @since 10.4.0
 */

(function() {
    'use strict';

    // Feature flag - set to true to show individual module interpretation
    const SHOW_SINGLE_MODULE = window.GILBA_SHOW_SINGLE_MODULE_INTERPRET || false;
    
    if (!SHOW_SINGLE_MODULE) {
        return; // Exit early - don't inject UI
    }


    // =========================================================================
    // CONFIGURATION
    // =========================================================================

    const CONFIG = {
        // Selectors
        soilResultsContainer: '.gaip-mlsn-progressive-container',
        methodologyHeader: '.gaip-methodology-header',
        
        // Classes
        wrapperClass: 'gilba-interpretation-wrapper',
        buttonClass: 'gilba-interpret-btn',
        outputClass: 'gilba-interpretation-output',
        
        // State
        debounceMs: 300,
    };

    // =========================================================================
    // MAIN CLASS
    // =========================================================================

    class GilbaSoilInterpretation {
        
        constructor() {
            this.wrapper = null;
            this.button = null;
            this.outputEl = null;
            this.lastInterpretation = null;
            this.isLoading = false;
            
            this.init();
        }
        
        /**
         * Initialize the interpretation UI
         */
        init() {
            // Use event delegation on document for reliable click handling
            // Be specific to soil button to avoid catching water interpretation button
            document.addEventListener('click', (e) => {
                const btn = e.target.closest('.' + CONFIG.buttonClass);
                // Only handle if it's the soil button (not water)
                if (btn && !btn.classList.contains('gilba-water-interpret-btn')) {
                    e.preventDefault();
                    e.stopPropagation();
                    this.requestInterpretation();
                }
            });
            
            // Wait for soil results to be rendered
            this.waitForSoilResults();
            
            // Listen for soil recalculation events
            document.addEventListener('gaip:soil-calculated', () => this.onSoilRecalculated());
            document.addEventListener('gaip:methodology-change', () => this.onMethodologyChange());
            document.addEventListener('gaip:analysis-complete', () => {
                setTimeout(() => this.ensureUIExists(), 500);
            });
            
            // Also check periodically in case events don't fire
            setTimeout(() => this.ensureUIExists(), 2000);
            setTimeout(() => this.ensureUIExists(), 5000);
        }
        
        /**
         * Wait for soil results container to exist
         */
        waitForSoilResults() {
            const container = document.querySelector(CONFIG.soilResultsContainer);
            
            if (container && container.querySelector(CONFIG.methodologyHeader)) {
                this.injectUI(container);
            } else {
                // Retry after a short delay
                setTimeout(() => this.waitForSoilResults(), 500);
            }
        }
        
        /**
         * Ensure UI exists (fallback check)
         */
        ensureUIExists() {
            const container = document.querySelector(CONFIG.soilResultsContainer);
            if (container && !container.querySelector('.' + CONFIG.wrapperClass)) {
                this.injectUI(container);
            } else if (container && container.querySelector('.' + CONFIG.wrapperClass)) {
                // Re-bind references
                this.wrapper = container.querySelector('.' + CONFIG.wrapperClass);
                this.button = this.wrapper.querySelector('.' + CONFIG.buttonClass);
                this.outputEl = this.wrapper.querySelector('.' + CONFIG.outputClass);
            }
        }
        
        /**
         * Inject the interpretation UI into the soil results
         */
        injectUI(container) {
            // Don't inject if already exists
            if (container.querySelector('.' + CONFIG.wrapperClass)) {
                this.wrapper = container.querySelector('.' + CONFIG.wrapperClass);
                this.button = this.wrapper.querySelector('.' + CONFIG.buttonClass);
                this.outputEl = this.wrapper.querySelector('.' + CONFIG.outputClass);
                return;
            }
            
            // Create wrapper
            this.wrapper = document.createElement('div');
            this.wrapper.className = CONFIG.wrapperClass;
            this.wrapper.innerHTML = `
                <button type="button" class="${CONFIG.buttonClass}">
                    <span class="gilba-interpret-icon">💡</span>
                    <span class="gilba-interpret-text">Interpret results</span>
                </button>
                <div class="${CONFIG.outputClass}" hidden></div>
            `;
            
            // Insert after methodology header or at end of container
            const header = container.querySelector(CONFIG.methodologyHeader);
            if (header && header.nextSibling) {
                container.insertBefore(this.wrapper, header.nextSibling);
            } else {
                container.appendChild(this.wrapper);
            }
            
            this.button = this.wrapper.querySelector('.' + CONFIG.buttonClass);
            this.outputEl = this.wrapper.querySelector('.' + CONFIG.outputClass);
            
        }
        
        /**
         * Handle soil recalculation
         */
        onSoilRecalculated() {
            // Clear cached interpretation when soil data changes
            this.lastInterpretation = null;
            window.GAIP_SOIL_INTERPRETATION = null;
            
            // Reset UI if visible
            if (this.outputEl && !this.outputEl.hidden) {
                this.outputEl.innerHTML = `
                    <div class="gilba-interpretation-stale">
                        ⚠️ Soil data changed. Click "Interpret results" to update.
                    </div>
                `;
            }
            
            // Reset button text
            if (this.button) {
                this.button.querySelector('.gilba-interpret-text').textContent = 'Interpret results';
            }
        }
        
        /**
         * Handle methodology change
         */
        onMethodologyChange() {
            this.onSoilRecalculated();
        }
        
        /**
         * Request interpretation from server
         */
        async requestInterpretation() {
            if (this.isLoading) return;
            
            // Get soil output from GAIP_STATE
            const soilOutput = this.collectSoilOutput();
            
            if (!soilOutput || !this.hasNutrientData(soilOutput)) {
                this.showError('Enter soil test values first');
                return;
            }
            
            this.setLoading(true);
            
            try {
                const formData = new FormData();
                formData.append('action', 'gilba_interpret_soil');
                formData.append('nonce', window.GAIP_HUB_CONFIG?.nonce || '');
                formData.append('soil_output', JSON.stringify(soilOutput));
                
                const response = await fetch(window.GAIP_HUB_CONFIG?.ajaxUrl || '/wp-admin/admin-ajax.php', {
                    method: 'POST',
                    body: formData,
                });
                
                const data = await response.json();
                
                if (data.success) {
                    this.renderInterpretation(data.data);
                    
                    // Cache for Word export
                    this.lastInterpretation = data.data;
                    window.GAIP_SOIL_INTERPRETATION = data.data;
                } else {
                    this.showError(data.data?.message || 'Interpretation failed');
                }
                
            } catch (err) {
                console.error('[SoilInterpretation] Request failed:', err);
                this.showError('Network error — please try again');
            } finally {
                this.setLoading(false);
            }
        }
        
        /**
         * Collect soil output from current state
         */
        collectSoilOutput() {
            const state = window.GAIP_STATE;
            if (!state?.soil) return null;
            
            const soil = state.soil;
            
            // Get methodology
            const methodSelect = document.querySelector('.gaip-soil-methodology');
            const methodology = methodSelect?.value || soil.methodology || 'mlsn';
            
            // Get soil texture for Ammonium Acetate
            const textureSelect = document.querySelector('.gaip-aa-soil-texture');
            const soilType = textureSelect?.value || soil.aaSoilTexture || 'others';
            
            // Get CEC from DOM or state
            const cecInput = document.querySelector('.gaip-cec');
            const cec = cecInput?.value || soil.cec || soil.CEC || null;
            
            // Get latitude for hemisphere detection
            const lat = state.location?.lat || state.site?.lat || null;
            
            // Build output structure
            const output = {
                methodology: methodology,
                soilType: soilType,
                pH: soil.pH || soil.ph,
                CEC: cec,
                ppm: soil.ppm || {},
                thresholds: soil.thresholds || {},
                context: {
                    methodology: methodology,
                    soilType: soilType,
                    region: state.location?.region || this.detectRegion(),
                    lat: lat,
                    turfType: state.turf?.species || state.turf?.grassSpecies || state.turf?.warmBase,
                    surfaceType: state.soil?.surfaceType || state.turf?.surfaceType,
                },
            };
            
            // Include nutrients array if available (from progressive disclosure)
            if (window.__GAIP_MLSN_LAST__?.nutrients) {
                output.nutrients = window.__GAIP_MLSN_LAST__.nutrients;
            }
            
            // Include confidence if available
            if (window.GilbaEngineConfidence) {
                const confidence = window.GilbaEngineConfidence.assessConfidence('mlsn-calculator', state);
                output.confidence = confidence;
            }
            
            return output;
        }
        
        /**
         * Check if output has nutrient data
         */
        hasNutrientData(output) {
            if (output.nutrients && output.nutrients.length > 0) {
                return output.nutrients.some(n => n.actual && n.actual > 0);
            }
            
            const ppm = output.ppm || output;
            return !!(ppm.P || ppm.K || ppm.Ca || ppm.Mg);
        }
        
        /**
         * Detect region from location
         */
        detectRegion() {
            if (window.GAIP_RegionalProfiles?.detectRegionFromHub) {
                return window.GAIP_RegionalProfiles.detectRegionFromHub();
            }
            
            const lat = window.GAIP_STATE?.location?.lat;
            const lon = window.GAIP_STATE?.location?.lon;
            
            if (lat && lon) {
                // Simple region detection
                if (lon >= 166 && lon <= 179 && lat >= -47 && lat <= -34) {
                    return 'new_zealand';
                }
                if (lon >= 113 && lon <= 154 && lat >= -44 && lat <= -10) {
                    return 'australia';
                }
                if (lon >= -10 && lon <= 2 && lat >= 50 && lat <= 60) {
                    return 'UK';
                }
            }
            
            return 'temperate';
        }
        
        /**
         * Render interpretation in UI
         */
        renderInterpretation(result) {
            let narrative = result.narrative || '';
            
            // Convert [citation-id] to styled spans
            narrative = this.linkCitations(narrative, result.citations || {});
            
            // Convert markdown-style bold to HTML
            narrative = narrative.replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>');
            
            // Convert numbered lists
            narrative = narrative.replace(/^(\d+)\.\s+/gm, '<span class="gilba-list-num">$1.</span> ');
            
            // Convert paragraphs
            narrative = narrative
                .split(/\n\n+/)
                .map(p => `<p>${p.trim()}</p>`)
                .join('');
            
            // Build output HTML
            const cachedBadge = result.cached 
                ? '<span class="gilba-cached-badge" title="Cached result">cached</span>' 
                : '';
            
            this.outputEl.innerHTML = `
                <div class="gilba-narrative">${narrative}</div>
                ${cachedBadge}
            `;
            
            this.outputEl.hidden = false;
            this.button.querySelector('.gilba-interpret-text').textContent = 'Refresh interpretation';
            
            // Scroll into view if needed
            this.outputEl.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
        }
        
        /**
         * Link citations in narrative
         */
        linkCitations(text, citations) {
            return text.replace(/\[([a-z0-9\-_]+)\]/gi, (match, id) => {
                const cite = citations[id] || citations[id.toLowerCase()];
                if (cite?.url) {
                    return `<a href="${cite.url}" target="_blank" rel="noopener" class="gilba-citation" title="${cite.title || id}">[${id}]</a>`;
                }
                if (cite?.title) {
                    return `<span class="gilba-citation" title="${cite.title}">[${id}]</span>`;
                }
                return `<span class="gilba-citation">[${id}]</span>`;
            });
        }
        
        /**
         * Set loading state
         */
        setLoading(loading) {
            this.isLoading = loading;
            this.button.disabled = loading;
            
            if (loading) {
                this.button.innerHTML = `
                    <span class="gilba-interpret-spinner"></span>
                    <span class="gilba-interpret-text">Interpreting...</span>
                `;
            } else {
                this.button.innerHTML = `
                    <span class="gilba-interpret-icon">💡</span>
                    <span class="gilba-interpret-text">${this.lastInterpretation ? 'Refresh interpretation' : 'Interpret results'}</span>
                `;
            }
        }
        
        /**
         * Show error message
         */
        showError(message) {
            this.outputEl.innerHTML = `
                <div class="gilba-interpretation-error">
                    <span class="gilba-error-icon">⚠️</span>
                    ${message}
                </div>
            `;
            this.outputEl.hidden = false;
        }
        
        /**
         * Get last interpretation (for Word export)
         */
        getInterpretation() {
            return this.lastInterpretation;
        }
    }

    // =========================================================================
    // INITIALIZATION
    // =========================================================================

    // Create singleton instance
    let instance = null;
    
    function init() {
        if (instance) return instance;
        instance = new GilbaSoilInterpretation();
        return instance;
    }
    
    // Auto-init when DOM ready
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', init);
    } else {
        // Slight delay to ensure other modules loaded
        setTimeout(init, 100);
    }

    // =========================================================================
    // EXPORTS
    // =========================================================================

    window.GilbaSoilInterpretation = {
        init: init,
        getInstance: () => instance,
        getInterpretation: () => instance?.getInterpretation() || window.GAIP_SOIL_INTERPRETATION,
    };

})();

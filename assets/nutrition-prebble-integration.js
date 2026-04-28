/**
 * Nutrition Calendar ↔ Prebble Recommender Integration
 * 
 * Wires the Prebble product recommendation engine to the Nutrition Calendar.
 * Automatically generates product recommendations when the calendar generates.
 * 
 * REGION RESTRICTION: Only activates for New Zealand locations.
 * Prebbles is a NZ-based supplier - products not valid for other regions.
 * 
 * Dependencies:
 *   - nutrition-calendar.js (GilbaNutritionCalendar)
 *   - prebbles-products.js (PrebbleRecommender)
 *   - regional-profiles.js (for NZ detection)
 *   - Hub state (GAIP_STATE.soil.surfaceType)
 * 
 * @package Gilba_Hub
 * @version 1.0.3
 * @since 10.1.0
 */

(function() {
    'use strict';

    // ========================================================================
    // INTEGRATION MODULE
    // ========================================================================

    const NutritionPrebbleIntegration = {
        
        version: '1.4.0',
        
        // Store last generated program
        lastProgram: null,
        
        /**
         * Initialize integration
         * Hooks into NutritionCalendar's render pipeline
         * Only activates for New Zealand locations (Prebbles is NZ-only supplier)
         */
        init: function() {
            // Wait for PrebbleRecommender to be available
            if (!window.PrebbleRecommender) {
                console.warn('[NutritionPrebbleIntegration] Waiting for PrebbleRecommender...');
                setTimeout(() => this.init(), 100);
                return;
            }
            
            // Inject styles for nutrient summary
            this.injectStyles();
            
            // v1.0.2: Always listen for calendar generation, check region at generation time
            // This handles location changes after page load
            document.addEventListener('gaip:nutrition-calendar-generated', (e) => {
                
                // Check region at generation time, not init time
                const isNZ = this.isNewZealand();
                
                if (!isNZ) {
                    // Hide any existing Prebble recommendations
                    this.hideRecommendations();
                    return;
                }
                this.generateAndRender(e.detail.program);
            });
            
        },
        
        /**
         * Inject CSS styles for Prebble UI components
         */
        injectStyles: function() {
            if (document.getElementById('prebble-integration-styles')) return;
            
            const style = document.createElement('style');
            style.id = 'prebble-integration-styles';
            style.textContent = `
                /* Nutrient Summary Table */
                .prebble-nutrient-summary {
                    margin-bottom: 20px;
                }
                .prebble-nutrient-summary td {
                    padding: 8px 12px;
                }
                .prebble-nutrient-summary .nutrient-diff {
                    font-weight: 600;
                }
                .prebble-nutrient-summary .nutrient-diff.positive {
                    color: #059669;
                }
                .prebble-nutrient-summary .nutrient-diff.negative {
                    color: #dc2626;
                }
                .prebble-nutrient-summary tr.nutrient-sufficient td:last-child {
                    color: #059669;
                    font-weight: 600;
                }
                .prebble-nutrient-summary tr.nutrient-marginal td:last-child {
                    color: #d97706;
                    font-weight: 600;
                }
                .prebble-nutrient-summary tr.nutrient-deficit td:last-child {
                    color: #dc2626;
                    font-weight: 600;
                }
                /* Product Summary Totals */
                .prebble-summary-table tfoot {
                    border-top: 2px solid var(--gaip-text);
                }
                .prebble-totals-row td {
                    background: var(--gaip-good-bg);
                    padding: 10px 12px;
                }
                .prebble-required-row td {
                    background: var(--gaip-surface-muted);
                    color: var(--gaip-text);
                    padding: 8px 12px;
                }
                .prebble-npk-delivered {
                    font-family: monospace;
                    font-size: 0.9em;
                }
            `;
            document.head.appendChild(style);
        },
        
        /**
         * Sync soil data from DOM to GAIP_STATE
         * Called before generating recommendations to ensure fresh values
         */
        syncSoilState: function() {
            // No-op: GAIP_STATE is a defineProperty getter on window (gilba-hub-v2.js).
            // Each access returns a new ephemeral object so writes don't persist.
            // getSoilPpm/getSoilCEC/getMethodology all read direct from HubStore or DOM.
        },
        
        /**
         * Hide existing recommendations (when region changes)
         */
        hideRecommendations: function() {
            const container = document.querySelector('[data-prebble-recommendations]');
            if (container) {
                container.style.display = 'none';
            }
        },
        
        /**
         * Check if current location is in New Zealand
         * Uses RegionalProfiles if available, otherwise checks coordinates directly
         */
        isNewZealand: function() {
            // Method 1: Check RegionalProfiles detection
            if (window.GAIP_RegionalProfiles?.detectRegionFromHub) {
                const region = window.GAIP_RegionalProfiles.detectRegionFromHub();
                return region === 'new_zealand';
            }
            
            // Method 2: Check GAIP_STATE for region
            if (window.GAIP_STATE?.location?.region) {
                return window.GAIP_STATE.location.region === 'new_zealand';
            }
            
            // Method 3: Direct coordinate check (NZ bounds: lat -47 to -34, lon 166 to 179)
            const lat = window.GAIP_STATE?.location?.lat || 
                        window.GAIP_HUB_CONFIG?.savedLocation?.lat;
            const lon = window.GAIP_STATE?.location?.lon || 
                        window.GAIP_HUB_CONFIG?.savedLocation?.lon;
            
            
            if (lat && lon) {
                const isNZ = (lon >= 166 && lon <= 179 && lat >= -47 && lat <= -34);
                return isNZ;
            }
            
            // Default: not NZ
            return false;
        },
        
        /**
         * Get surface type from Hub state
         * Cascades through possible locations
         * Priority: Turf profile > GAIP_STATE > DOM
         */
        getSurfaceType: function() {
            // Cotula/bowls check first — covers all possible state locations
            const _tpcState = window.GaipTurfProfile?.state || window.gaipTurfProfile?.state || {};
            const _gaipTurf = window.GAIP_STATE?.turf || {};
            if (_tpcState.turfType === 'bowls' || _gaipTurf.turfType === 'bowls' ||
                _gaipTurf.cotula === true || _tpcState.species === 'cotula' ||
                _gaipTurf.grassSpecies === 'cotula') {
                return 'bowling_greens';
            }

            // Primary: turf profile (user's actual selection)
            if (_tpcState.turfType) {
                const turfType = _tpcState.turfType;
                const subCategory = _tpcState.subCategory;

                // Map turf type + subcategory to surface type
                if (turfType === 'golf') {
                    if (subCategory === 'greens') return 'golf_greens';
                    if (subCategory === 'tees') return 'tees';
                    if (subCategory === 'fairways') return 'fairways';
                    return 'fairways'; // default for golf
                }
                if (turfType === 'bowling' || turfType === 'bowls') return 'bowling_greens';
                if (turfType === 'cricket') return 'cricket_wickets';
                if (subCategory) return subCategory;
                return turfType;
            }
            
            // Fallback: GAIP_STATE.soil.surfaceType
            if (window.GAIP_STATE?.soil?.surfaceType) {
                const st = window.GAIP_STATE.soil.surfaceType;
                if (st === 'cotula_bowling_green') return 'bowling_greens';
                return st;
            }
            
            // Fallback: DOM select
            const surfaceSelect = document.querySelector('.gaip-surface-type');
            if (surfaceSelect?.value) {
                return surfaceSelect.value;
            }
            
            // Default
            return 'sports';
        },
        
        /**
         * Get methodology from Hub state or calendar
         */
        getMethodology: function() {
            // Cotula/bowls always maps to ammonium_acetate (Hill Labs S78 = AA extractant)
            const _tpcState = window.GaipTurfProfile?.state || window.gaipTurfProfile?.state || {};
            const _gaipTurf = window.GAIP_STATE?.turf || {};
            if (_tpcState.turfType === 'bowls' || _gaipTurf.turfType === 'bowls' ||
                _gaipTurf.cotula === true || _tpcState.species === 'cotula') {
                return 'ammonium_acetate';
            }

            if (window.GAIP_STATE?.soil?.methodology) {
                const m = window.GAIP_STATE.soil.methodology;
                if (m === 'cotula_s78' || m === 'cotula') return 'ammonium_acetate';
                return m;
            }
            
            const methodSelect = document.querySelector('.gaip-soil-methodology');
            if (methodSelect?.value) {
                return methodSelect.value;
            }
            
            return 'mlsn';
        },
        
        /**
         * Generate product program from calendar data
         */
        generateAndRender: function(calendarData) {
            // v1.0.3: Sync soil data from DOM to GAIP_STATE first
            this.syncSoilState();
            
            
            // Get soil nutrient levels (ppm) from GAIP_STATE
            const soilPpm = this.getSoilPpm();
            
            // Get tissue test status if available
            const tissueStatus = this.getTissueStatus();
            
            // Determine if there's a P deficiency based on soil test
            // MLSN P guideline is typically 21 ppm, SLAN varies
            const methodology = this.getMethodology();
            const pThreshold = methodology === 'mlsn' ? 21 : 30; // MLSN vs SLAN
            const pDeficient = soilPpm.P !== null && soilPpm.P < pThreshold;
            
            const context = {
                surfaceType: this.getSurfaceType(),
                methodology: methodology,
                soilCEC: this.getSoilCEC(),
                irrigationFrequency: this.getIrrigationFrequency(),
                soilTemp: this.getSoilTemperature(),
                latitude: this.getLatitude(),
                hemisphere: this.getHemisphere(),
                // Soil nutrient status
                soilPpm: soilPpm,
                pDeficient: pDeficient,
                // Tissue status (if available)
                tissueStatus: tissueStatus,
                // Establishment flags (could be wired to UI later)
                establishment: false,
                seeding: false,
                renovation: false,
            };
            
            
            try {
                const program = window.PrebbleRecommender.generateProgram(calendarData, context);
                
                if (program.error) {
                    console.error('[NutritionPrebbleIntegration]', program.error);
                    return;
                }
                
                this.lastProgram = program;
                
                // v10.3.38: Store program globally for Word export, tagged with site
                program._generatedForSite = (window.GAIP_SampleManager && window.GAIP_SampleManager.getActiveSiteId) 
                    ? window.GAIP_SampleManager.getActiveSiteId() : 'unknown';
                window.GAIP_NUTRITION_PROGRAM = program;
                
                this.renderProductRecommendations(program);
                
                // Dispatch event for other modules
                document.dispatchEvent(new CustomEvent('gaip:prebble-program-generated', {
                    detail: { program: program, context: context }
                }));
                
            } catch (error) {
                console.error('[NutritionPrebbleIntegration] Error generating program:', error);
            }
        },
        
        /**
         * Get current soil temperature from Hub state
         * Used to determine release technology efficiency
         */
        getSoilTemperature: function() {
            // Try GAIP computed soil temp (from physics model)
            if (window.GAIP_SOIL_TEMP?.T_50mm_mean !== undefined) {
                return Math.round(window.GAIP_SOIL_TEMP.T_50mm_mean * 10) / 10;
            }
            
            // Try sensor data
            if (window.GAIP_STATE?.sensor?.soilTemp !== undefined) {
                return parseFloat(window.GAIP_STATE.sensor.soilTemp);
            }
            
            // Try climate metrics
            if (window.climateMetrics?.temperature?.mean !== undefined) {
                return window.climateMetrics.temperature.mean;
            }
            
            // Try GAIP_STATE climate
            if (window.GAIP_STATE?.climate?.temperature !== undefined) {
                return window.GAIP_STATE.climate.temperature;
            }
            
            // Default to moderate temp
            return 15;
        },
        
        /**
         * Get soil nutrient levels (ppm) from Hub state
         * Used to determine deficiencies and product selection
         */
        getSoilPpm: function() {
            const defaultPpm = { P: null, K: null, Ca: null, Mg: null, S: null };
            
            // Read from HubStore (gilba-hub-v2.js) — GAIP_STATE getter returns ephemeral objects
            const storeNutrients = window.GilbaHub?.store?.peek('inputs.soil.nutrients');
            if (storeNutrients && typeof storeNutrients === 'object' && Object.keys(storeNutrients).length > 0) {
                return {
                    P: storeNutrients.P ?? null,
                    K: storeNutrients.K ?? null,
                    Ca: storeNutrients.Ca ?? null,
                    Mg: storeNutrients.Mg ?? null,
                    S: storeNutrients.S ?? null,
                };
            }
            
            // Try DOM inputs - use correct data-mlsn selectors
            const pInput = document.querySelector('[data-mlsn="P"]');
            const kInput = document.querySelector('[data-mlsn="K"]');
            const caInput = document.querySelector('[data-mlsn="Ca"]');
            const mgInput = document.querySelector('[data-mlsn="Mg"]');
            const sInput = document.querySelector('[data-mlsn="S"]');
            
            if (pInput || kInput) {
                const result = {
                    P: pInput ? parseFloat(pInput.value) || null : null,
                    K: kInput ? parseFloat(kInput.value) || null : null,
                    Ca: caInput ? parseFloat(caInput.value) || null : null,
                    Mg: mgInput ? parseFloat(mgInput.value) || null : null,
                    S: sInput ? parseFloat(sInput.value) || null : null,
                };
                return result;
            }
            
            return defaultPpm;
        },
        
        /**
         * Get tissue test status from Hub state
         * Returns object with nutrient status (deficient/sufficient/excess)
         */
        getTissueStatus: function() {
            const defaultStatus = { available: false, nutrients: {} };
            
            // Try GAIP_STATE tissue
            if (window.GAIP_STATE?.tissue?.results) {
                const tissue = window.GAIP_STATE.tissue.results;
                return {
                    available: true,
                    nutrients: {
                        N: tissue.N?.status || null,
                        P: tissue.P?.status || null,
                        K: tissue.K?.status || null,
                        Ca: tissue.Ca?.status || null,
                        Mg: tissue.Mg?.status || null,
                        S: tissue.S?.status || null,
                        Fe: tissue.Fe?.status || null,
                    }
                };
            }
            
            // Try tissue engine results
            if (window.GAIP_TISSUE_RESULTS) {
                return {
                    available: true,
                    nutrients: window.GAIP_TISSUE_RESULTS,
                };
            }
            
            return defaultStatus;
        },
        
        /**
         * Get site latitude from Hub state
         */
        getLatitude: function() {
            if (window.GAIP_STATE?.location?.lat !== undefined) {
                return window.GAIP_STATE.location.lat;
            }
            
            const latInput = document.querySelector('.gaip-lat');
            if (latInput?.value) {
                return parseFloat(latInput.value);
            }
            
            return -35; // Default NZ/AU latitude
        },
        
        /**
         * Get hemisphere from Hub state or latitude
         */
        getHemisphere: function() {
            if (window.GAIP_STATE?.location?.hemisphere) {
                return window.GAIP_STATE.location.hemisphere;
            }
            
            const lat = this.getLatitude();
            return lat < 0 ? 'south' : 'north';
        },
        
        /**
         * Get soil CEC from Hub state
         * Low CEC (<5) = high leaching risk, favour slow release
         */
        getSoilCEC: function() {
            // Try GAIP_STATE first
            if (window.GAIP_STATE?.soil?.cec !== undefined) {
                return parseFloat(window.GAIP_STATE.soil.cec);
            }
            
            // Try form input - correct selector for gaip-cec class
            const cecInput = document.querySelector('.gaip-cec, [name="cec"], #soil-cec');
            if (cecInput?.value) {
                const cec = parseFloat(cecInput.value);
                return cec;
            }
            
            // Infer from construction type
            const construction = window.GAIP_STATE?.turf?.construction || 
                                 window.GAIP_STATE?.soil?.construction || '';
            
            if (construction.includes('sand') || construction.includes('usga')) {
                return 3; // Sand-based rootzone - low CEC
            } else if (construction.includes('push_up') || construction.includes('native')) {
                return 12; // Native soil - moderate CEC
            }
            
            // Default to moderate (conservative)
            return 8;
        },
        
        /**
         * Get irrigation frequency from Hub state
         * 'frequent' = daily or more, 'moderate' = 2-3x/week, 'infrequent' = weekly or less
         */
        getIrrigationFrequency: function() {
            // Try GAIP_STATE
            if (window.GAIP_STATE?.irrigation?.frequency) {
                return window.GAIP_STATE.irrigation.frequency;
            }
            
            // Infer from surface type - greens typically irrigated frequently
            const surface = this.getSurfaceType().toLowerCase();
            
            if (surface.includes('green') || surface.includes('wicket')) {
                return 'frequent'; // Greens typically daily
            } else if (surface.includes('tee') || surface.includes('fairway')) {
                return 'moderate';
            } else {
                return 'moderate'; // Default
            }
        },
        
        /**
         * Render product recommendations UI
         */
        renderProductRecommendations: function(program) {
            // Find or create the container
            let container = document.querySelector('[data-prebble-recommendations]');
            
            if (!container) {
                // Create container after calendar results
                const calendarResults = document.querySelector('[data-nutrition-results]');
                if (calendarResults) {
                    container = document.createElement('div');
                    container.setAttribute('data-prebble-recommendations', '');
                    container.className = 'gilba-prebble-recommendations';
                    calendarResults.appendChild(container);
                }
            }
            
            if (!container) {
                console.warn('[NutritionPrebbleIntegration] No container found for recommendations');
                return;
            }
            
            // Render
            container.innerHTML = this.buildRecommendationsHTML(program);
        },
        
        /**
         * Get abbreviation for release technology
         */
        getTechAbbrev: function(tech) {
            const abbrevs = {
                'ibdu': 'IBDU',
                'mu': 'MU',
                'mesa': 'MESA',
                'pcu': 'PCU',
                'scu': 'SCU',
                'pcscu': 'PCSCU',
                'as': 'AS',
                'standard': 'QR',
            };
            return abbrevs[tech?.toLowerCase()] || 'SR';
        },
        
        /**
         * Get full label for release technology
         */
        getTechLabel: function(tech) {
            const labels = {
                'ibdu': 'IBDU (Hydrolysis - works in cold)',
                'mu': 'Methylene Urea (Microbial - needs warmth >13°C)',
                'mesa': 'MESA (Hybrid - moderate temp range)',
                'pcu': 'Polymer Coated (Diffusion - temp dependent)',
                'scu': 'Sulfur Coated (Needs warmth + moisture)',
                'pcscu': 'Polymer-Coated SCU (Dual coating - more predictable)',
                'as': 'Ammonium Sulfate (Quick release)',
                'standard': 'Quick Release',
            };
            return labels[tech?.toLowerCase()] || 'Slow Release';
        },
        
        /**
         * Build HTML for product recommendations
         */
        buildRecommendationsHTML: function(program) {
            const meta = program.meta;
            const monthly = program.monthly;
            const summary = program.annualSummary;
            
            // ================================================================
            // Determine units based on surface type
            // Sports/fairways = kg/ha, Greens/tees/bowling = g/m²
            // ================================================================
            const useGM2 = ['greens', 'golf_greens', 'bowling_greens', 'tees', 'cricket_wickets'].includes(meta.surfaceType);
            
            // ================================================================
            // Calculate total nutrients delivered vs required
            // ================================================================
            const nutrientTotals = { N: 0, P: 0, K: 0, Ca: 0, Mg: 0, S: 0 };
            const nutrientRequired = { N: 0, P: 0, K: 0, Ca: 0, Mg: 0, S: 0 };
            
            monthly.forEach(m => {
                // Sum requirements
                nutrientRequired.N += m.requirements?.N || 0;
                nutrientRequired.P += m.requirements?.P || 0;
                nutrientRequired.K += m.requirements?.K || 0;
                nutrientRequired.Ca += m.requirements?.Ca || 0;
                nutrientRequired.Mg += m.requirements?.Mg || 0;
                nutrientRequired.S += m.requirements?.S || 0;
                
                // Sum delivered from granular products (accounting for split applications)
                m.granular.forEach(p => {
                    const rate = p.rateKgHa || 0;
                    const splitCount = p.splitCount || 1;
                    const totalRate = rate * splitCount;
                    const analysis = p.analysis || {};
                    nutrientTotals.N += totalRate * (analysis.N || 0) / 100;
                    nutrientTotals.P += totalRate * (analysis.P || 0) / 100;
                    nutrientTotals.K += totalRate * (analysis.K || 0) / 100;
                    nutrientTotals.Ca += totalRate * (analysis.Ca || 0) / 100;
                    nutrientTotals.Mg += totalRate * (analysis.Mg || 0) / 100;
                    nutrientTotals.S += totalRate * (analysis.S || 0) / 100;
                });
                
                // Sum delivered from liquid products (accounting for split applications)
                m.liquid.forEach(p => {
                    const rate = p.rateKgHa || p.rateLHa || 0;
                    const splitCount = p.splitCount || 1;
                    const totalRate = rate * splitCount;
                    const analysis = p.analysis || {};
                    nutrientTotals.N += totalRate * (analysis.N || 0) / 100;
                    nutrientTotals.P += totalRate * (analysis.P || 0) / 100;
                    nutrientTotals.K += totalRate * (analysis.K || 0) / 100;
                    nutrientTotals.Ca += totalRate * (analysis.Ca || 0) / 100;
                    nutrientTotals.Mg += totalRate * (analysis.Mg || 0) / 100;
                    nutrientTotals.S += totalRate * (analysis.S || 0) / 100;
                });
            });
            
            // Round values
            Object.keys(nutrientTotals).forEach(k => {
                nutrientTotals[k] = Math.round(nutrientTotals[k] * 10) / 10;
                nutrientRequired[k] = Math.round(nutrientRequired[k] * 10) / 10;
            });
            
            // Build nutrient summary rows
            const nutrientSummaryRows = ['N', 'P', 'K'].map(nutrient => {
                const required = nutrientRequired[nutrient];
                const delivered = nutrientTotals[nutrient];
                const diff = delivered - required;
                const pct = required > 0 ? Math.round((delivered / required) * 100) : 0;
                const statusClass = pct >= 90 ? 'sufficient' : pct >= 70 ? 'marginal' : 'deficit';
                const statusIcon = pct >= 90 ? '✓' : pct >= 70 ? '⚠' : '✗';
                return `
                    <tr class="nutrient-${statusClass}">
                        <td><strong>${nutrient}</strong></td>
                        <td>${required}</td>
                        <td>${delivered}</td>
                        <td class="nutrient-diff ${diff >= 0 ? 'positive' : 'negative'}">${diff >= 0 ? '+' : ''}${diff.toFixed(1)}</td>
                        <td>${statusIcon} ${pct}%</td>
                    </tr>
                `;
            }).join('');
            
            // Build monthly rows
            const monthlyRows = monthly.map(m => {
                const granularList = m.granular.map(p => {
                    // Show release tech type with efficiency indicator
                    const techLabel = this.getTechLabel(p.releaseTech);
                    const effClass = p.techEfficiency >= 70 ? 'optimal' : 
                                    p.techEfficiency >= 40 ? 'reduced' : 'poor';
                    const releaseTag = p.release === 'slow' 
                        ? `<span class="release-tag slow" title="${techLabel}: ${p.techEfficiency}% efficiency">${this.getTechAbbrev(p.releaseTech)}</span>` 
                        : p.release === 'standard' 
                        ? '<span class="release-tag quick">QR</span>' 
                        : '';
                    const longevityTitle = p.longevity ? `Expected longevity: ${p.longevity}` : '';
                    const effTitle = p.techEfficiency ? `Release efficiency at current soil temp: ${p.techEfficiency}%` : '';
                    const npkDisplay = p.npk ? ` (${p.npk})` : '';
                    const splitNote = p.splitRequired ? ` [×${p.splitCount}]` : '';
                    // Use kg/ha for sports/fairways, g/m² for greens/tees
                    const rateDisplay = useGM2 ? `${p.rateGM2}g/m²` : `${p.rateKgHa}kg/ha`;
                    return `<span class="prebble-product eff-${effClass}" title="${p.notes || ''} ${longevityTitle} ${effTitle}">${p.name}${npkDisplay} @ ${rateDisplay}${splitNote} ${releaseTag}</span>`;
                }).join(' + ') || '<span class="prebble-none">—</span>';
                
                // Show "covered by" info if this month is covered by previous application
                let coverageDisplay = '';
                if (m.coveredBy) {
                    coverageDisplay = `<div class="prebble-covered" title="Still releasing from ${m.coveredBy.month}"><small>🔄 ${m.coveredBy.product} (${m.coveredBy.month}) - N:${m.coveredBy.remainingN.toFixed(1)} K:${m.coveredBy.remainingK.toFixed(1)} remaining</small></div>`;
                }
                
                // Legacy: Show active nutrients from previous slow-release if present (for backwards compat)
                const activeDisplay = !m.coveredBy && m.activeFromPrevious 
                    ? `<div class="prebble-active" title="Still releasing from previous application"><small>🔄 Active: N:${m.activeFromPrevious.N.toFixed(1)} K:${m.activeFromPrevious.K.toFixed(1)}</small></div>` 
                    : '';
                
                const liquidList = m.liquid.map(p => {
                    // Handle different liquid types: standard liquid (L/ha), soluble (kg/ha in spray tank)
                    let rate;
                    if (p.form === 'soluble') {
                        rate = p.rateKgHa ? `${p.rateKgHa} kg/ha` : (p.rateGM2 ? `${p.rateGM2}g/m²` : '');
                    } else {
                        rate = p.rateLHa ? `${p.rateLHa} L/ha` : (p.rateGM2 ? `${p.rateGM2}g/m²` : '');
                    }
                    const npkDisplay = p.npk ? ` (${p.npk})` : '';
                    const splitNote = p.splitRequired ? ` [×${p.splitCount}]` : '';
                    const solubleNote = p.form === 'soluble' ? ' 💧' : ''; // Water drop to indicate dissolve in tank
                    return `<span class="prebble-product liquid" title="${p.notes || ''}">${p.name}${npkDisplay}${rate ? ' @ ' + rate : ''}${splitNote}${solubleNote}</span>`;
                }).join(' + ') || '';
                
                const notesHtml = m.notes.length > 0 
                    ? `<div class="prebble-notes">${m.notes.join('. ')}</div>` 
                    : '';
                
                const gpClass = m.gp >= 0.5 ? 'high' : (m.gp >= 0.25 ? 'medium' : 'low');
                
                // Build requirements string - only show nutrients that are needed
                let reqParts = [`N:${m.requirements.N.toFixed(1)}`];
                if (m.requirements.K > 0) reqParts.push(`K:${m.requirements.K.toFixed(1)}`);
                if (m.requirements.P > 0) reqParts.push(`P:${m.requirements.P.toFixed(1)}`);
                const reqString = reqParts.join(' ');
                
                return `
                    <tr class="gilba-gp-${gpClass}">
                        <td>${m.month}</td>
                        <td>${m.season}</td>
                        <td class="prebble-req">${reqString}</td>
                        <td class="prebble-granular">${granularList}${coverageDisplay}${activeDisplay}</td>
                        <td class="prebble-liquid">${liquidList}</td>
                    </tr>
                    ${notesHtml ? `<tr class="prebble-note-row"><td colspan="5">${notesHtml}</td></tr>` : ''}
                `;
            }).join('');
            
            // Build annual summary with release type and nutrients delivered
            const productEntries = Object.entries(summary.products);
            const summaryRows = productEntries.map(([id, data]) => {
                // MAP Tech (soluble) uses kg/ha even though it's in liquid column
                const isSoluble = id === 'MAPTECH' || data.name?.includes('soluble');
                // Use g/m² for greens/tees, kg/ha for sports/fairways
                let unit, rateValue;
                if (data.isLiquid && !isSoluble) {
                    unit = 'L/ha';
                    rateValue = Math.round(data.totalKg);
                } else if (useGM2) {
                    unit = 'g/m²';
                    rateValue = Math.round(data.totalKg / 10 * 10) / 10; // kg/ha to g/m²
                } else {
                    unit = 'kg/ha';
                    rateValue = Math.round(data.totalKg);
                }
                const techAbbrev = this.getTechAbbrev(data.releaseTech);
                const releaseLabel = data.release === 'slow' ? ` (${techAbbrev})` : 
                                    data.release === 'standard' ? ' (QR)' : '';
                
                // Format nutrients delivered
                const nutrients = data.nutrients || { N: 0, P: 0, K: 0 };
                
                // Get product analysis for label
                const productAnalysis = data.analysis || {};
                const analysisLabel = productAnalysis.N !== undefined 
                    ? `${productAnalysis.N || 0}-${productAnalysis.P || 0}-${productAnalysis.K || 0}`
                    : '';
                
                return `
                    <tr>
                        <td>${data.name}${releaseLabel}${analysisLabel ? `<div style="font-size: 11px; color: var(--gaip-text-secondary);">Analysis: ${analysisLabel}</div>` : ''}</td>
                        <td>${data.applications}</td>
                        <td>${rateValue} ${unit}</td>
                        <td style="text-align: right; font-family: monospace;">${Math.round(nutrients.N)}</td>
                        <td style="text-align: right; font-family: monospace;">${Math.round(nutrients.P * 10) / 10}</td>
                        <td style="text-align: right; font-family: monospace;">${Math.round(nutrients.K)}</td>
                    </tr>
                `;
            }).join('');
            
            return `
                <div class="gilba-panel gilba-prebble-panel">
                    <h3>
                        <span class="gilba-panel-icon">🧪</span>
                        Prebbles Product Recommendations
                    </h3>
                    
                    <div class="prebble-meta">
                        <span class="meta-item">
                            <strong>Surface:</strong> ${this.formatSurfaceType(meta.surfaceType)}
                        </span>
                        <span class="meta-item">
                            <strong>Methodology:</strong> ${(function(){
                                const _mEl = document.querySelector('.gaip-soil-methodology');
                                const _m = (_mEl ? _mEl.value : null) || meta.methodology || 'mlsn';
                                const _mu = _m.toUpperCase();
                                if (_mu === 'SLAN') return 'SLAN';
                                if (_mu === 'AMMONIUM_ACETATE' || _mu === 'COTULA_S78') return 'Ammonium Acetate';
                                return 'MLSN';
                            })()}
                        </span>
                    </div>
                    
                    <h4>Monthly Program</h4>
                    <div class="gilba-table-scroll">
                        <table class="gilba-calendar-table prebble-program-table">
                            <thead>
                                <tr>
                                    <th>Month</th>
                                    <th>Season</th>
                                    <th>Requirements</th>
                                    <th>Granular Products</th>
                                    <th>Liquid/Foliar</th>
                                </tr>
                            </thead>
                            <tbody>
                                ${monthlyRows}
                            </tbody>
                        </table>
                    </div>
                    
                    <h4>Nutrient Delivery Summary</h4>
                    <table class="gilba-totals-table prebble-nutrient-summary">
                        <thead>
                            <tr>
                                <th>Nutrient</th>
                                <th>Required (kg/ha)</th>
                                <th>Delivered (kg/ha)</th>
                                <th>Balance</th>
                                <th>Status</th>
                            </tr>
                        </thead>
                        <tbody>
                            ${nutrientSummaryRows}
                        </tbody>
                    </table>
                    
                    ${productEntries.length > 0 ? `
                        <h4>Annual Product Summary</h4>
                        <table class="gilba-totals-table prebble-summary-table">
                            <thead>
                                <tr>
                                    <th>Product</th>
                                    <th>Applications</th>
                                    <th>Total Rate</th>
                                    <th style="text-align: right;">N</th>
                                    <th style="text-align: right;">P</th>
                                    <th style="text-align: right;">K</th>
                                </tr>
                                <tr style="background: var(--gaip-surface-muted);">
                                    <th colspan="3" style="font-weight: 400; font-size: 11px; color: var(--gaip-text-secondary);"></th>
                                    <th colspan="3" style="text-align: center; font-weight: 400; font-size: 11px; color: var(--gaip-text-secondary);">kg/ha delivered</th>
                                </tr>
                            </thead>
                            <tbody>
                                ${summaryRows}
                            </tbody>
                            <tfoot>
                                <tr class="prebble-totals-row">
                                    <td colspan="3"><strong>TOTAL DELIVERED</strong></td>
                                    <td style="text-align: right; font-family: monospace;"><strong>${Math.round(nutrientTotals.N)}</strong></td>
                                    <td style="text-align: right; font-family: monospace;"><strong>${Math.round(nutrientTotals.P * 10) / 10}</strong></td>
                                    <td style="text-align: right; font-family: monospace;"><strong>${Math.round(nutrientTotals.K)}</strong></td>
                                </tr>
                                <tr class="prebble-required-row">
                                    <td colspan="3"><em>Required (kg/ha)</em></td>
                                    <td style="text-align: right; font-family: monospace;"><em>${Math.round(nutrientRequired.N)}</em></td>
                                    <td style="text-align: right; font-family: monospace;"><em>${Math.round(nutrientRequired.P * 10) / 10}</em></td>
                                    <td style="text-align: right; font-family: monospace;"><em>${Math.round(nutrientRequired.K)}</em></td>
                                </tr>
                                <tr style="background: ${(nutrientTotals.N - nutrientRequired.N) >= 0 ? 'var(--gaip-good-bg)' : 'var(--gaip-critical-bg)'};">
                                    <td colspan="3"><strong>Balance</strong></td>
                                    <td style="text-align: right; font-family: monospace; color: ${(nutrientTotals.N - nutrientRequired.N) >= 0 ? '#059669' : '#dc2626'};"><strong>${(nutrientTotals.N - nutrientRequired.N) >= 0 ? '+' : ''}${Math.round(nutrientTotals.N - nutrientRequired.N)}</strong></td>
                                    <td style="text-align: right; font-family: monospace; color: ${(nutrientTotals.P - nutrientRequired.P) >= 0 ? '#059669' : '#dc2626'};"><strong>${(nutrientTotals.P - nutrientRequired.P) >= 0 ? '+' : ''}${Math.round((nutrientTotals.P - nutrientRequired.P) * 10) / 10}</strong></td>
                                    <td style="text-align: right; font-family: monospace; color: ${(nutrientTotals.K - nutrientRequired.K) >= 0 ? '#059669' : '#dc2626'};"><strong>${(nutrientTotals.K - nutrientRequired.K) >= 0 ? '+' : ''}${Math.round(nutrientTotals.K - nutrientRequired.K)}</strong></td>
                                </tr>
                            </tfoot>
                        </table>
                    ` : ''}
                    
                    <div class="prebble-disclaimer">
                        <strong>Note:</strong> These recommendations are based on nutrient requirements
                        calculated from ${(function(){
                            // b35fix230: Read live from DOM — more reliable than meta which may be stale
                            const _mEl = document.querySelector('.gaip-soil-methodology');
                            const _mRaw = (_mEl ? _mEl.value : null) || (meta && meta.methodology) || 'mlsn';
                            const m = _mRaw.toUpperCase();
                            if (m === 'AMMONIUM_ACETATE' || m === 'COTULA_S78') return 'Hill Labs Ammonium Acetate (S78) methodology';
                            if (m === 'SLAN') return 'SLAN methodology';
                            return 'MLSN methodology';
                        })()} . Actual rates may need adjustment based on
                        site conditions, weather, and turf response. Always verify SGN compatibility with
                        your spreader settings.
                    </div>
                </div>
            `;
        },
        
        /**
         * Format surface type for display
         */
        formatSurfaceType: function(surfaceType) {
            if (!surfaceType) return 'Sports Field';
            
            const formats = {
                'greens': 'Golf Greens',
                'golf_greens': 'Golf Greens',
                'bowling_greens': 'Bowling Greens',
                'cricket_wickets': 'Cricket Wickets',
                'tees': 'Golf Tees',
                'fairways': 'Fairways',
                'sports': 'Sports Field',
                'sports_fields': 'Sports Field',
                'lawns': 'Lawns',
                'landscaping': 'Landscaping',
            };
            
            return formats[surfaceType.toLowerCase()] || surfaceType.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase());
        },
        
        /**
         * Get the last generated program
         * For use by other modules (Word export, etc.)
         */
        getProgram: function() {
            return this.lastProgram;
        },
        
        /**
         * Manually trigger regeneration
         * Call if surface type changes after calendar generation
         */
        regenerate: function() {
            const calendar = window.GilbaNutritionCalendar;
            if (calendar?.program) {
                this.generateAndRender(calendar.program);
            }
        },
    };

    // ========================================================================
    // CSS INJECTION (minimal styles for recommendations panel)
    // ========================================================================

    const styles = `
        .gilba-prebble-recommendations {
            margin-top: 2rem;
        }
        
        .gilba-prebble-panel {
            background: var(--gaip-surface);
            border: 1px solid var(--gaip-border);
            border-radius: 8px;
            padding: 1.5rem;
        }
        
        .gilba-prebble-panel h3 {
            margin: 0 0 1rem 0;
            color: #2e7d32;
            font-size: 1.25rem;
        }
        
        .gilba-prebble-panel h4 {
            margin: 1.5rem 0 0.75rem 0;
            color: var(--gaip-text);
            font-size: 1rem;
            border-bottom: 1px solid var(--gaip-border);
            padding-bottom: 0.5rem;
        }
        
        .prebble-meta {
            display: flex;
            gap: 1.5rem;
            padding: 0.75rem;
            background: var(--gaip-surface-muted);
            border-radius: 4px;
            font-size: 0.9rem;
        }
        
        .prebble-program-table {
            font-size: 0.9rem;
        }
        
        .prebble-program-table .prebble-product {
            display: inline-block;
            background: var(--gaip-good-bg);
            padding: 2px 8px;
            border-radius: 4px;
            margin: 2px;
            font-size: 0.85rem;
        }
        
        .prebble-program-table .prebble-product.liquid {
            background: var(--gaip-info-bg);
        }
        
        .prebble-program-table .prebble-none {
            color: var(--gaip-text-muted);
        }
        
        .prebble-program-table .prebble-req {
            font-family: monospace;
            font-size: 0.85rem;
            white-space: nowrap;
        }
        
        .prebble-note-row td {
            padding: 0.25rem 0.5rem !important;
            background: #fffde7 !important;
            font-size: 0.85rem;
            font-style: italic;
        }
        
        .prebble-notes {
            color: #f57c00;
        }
        
        .prebble-summary-table {
            max-width: 500px;
        }
        
        .prebble-disclaimer {
            margin-top: 1.5rem;
            padding: 0.75rem;
            background: #fff3e0;
            border-left: 3px solid #ff9800;
            font-size: 0.85rem;
            color: var(--gaip-text);
        }
        
        .gilba-table-scroll {
            overflow-x: auto;
        }
    `;

    // Inject styles
    const styleEl = document.createElement('style');
    styleEl.textContent = styles;
    document.head.appendChild(styleEl);

    // ========================================================================
    // INITIALIZATION
    // ========================================================================

    // Export to global scope
    window.NutritionPrebbleIntegration = NutritionPrebbleIntegration;
    
    // Also expose via GAIP namespace
    window.GAIP_NUTRITION_PREBBLE = NutritionPrebbleIntegration;

    // Auto-init when DOM ready
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', () => NutritionPrebbleIntegration.init());
    } else {
        NutritionPrebbleIntegration.init();
    }

})();

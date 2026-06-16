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
 * @version 1.0.4
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
            const _loc = window.GAIP_STATE?.location || {};
            const _hub = window.GAIP_HUB_CONFIG?.savedLocation || {};
            const lat = parseFloat(_loc.lat || _hub.lat || 0);
            const lon = parseFloat(_loc.lon || _loc.lng || _hub.lon || _hub.lng || 0);

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
            const _tpcState = window.GaipTurfProfile?.state || window.gaipTurfProfile?.state || {};
            const _gaipTurf = window.GAIP_STATE?.turf || {};

            // Cotula/bowls check first
            if (_tpcState.turfType === 'bowls' || _gaipTurf.turfType === 'bowls' ||
                _gaipTurf.cotula === true || _tpcState.cotula === true ||
                _tpcState.species === 'cotula' || _gaipTurf.grassSpecies === 'cotula') {
                return 'bowling_greens';
            }

            function _mapTurfType(turfType, subCategory) {
                if (!turfType) return null;
                if (turfType === 'golf') {
                    if (subCategory === 'greens')    return 'golf_greens';
                    if (subCategory === 'tees')      return 'tees';
                    if (subCategory === 'fairways')  return 'fairways';
                    if (subCategory === 'surrounds') return 'fairways';
                    return 'golf_greens';
                }
                if (turfType === 'bowling' || turfType === 'bowls') return 'bowling_greens';
                if (turfType === 'cricket') return 'cricket_wickets';
                if (subCategory) return subCategory;
                return turfType;
            }

            // Primary: legacy turf profile component
            if (_tpcState.turfType) {
                return _mapTurfType(_tpcState.turfType, _tpcState.subCategory);
            }

            // Secondary: GAIP_STATE.turf (set by plan page data bridge)
            if (_gaipTurf.turfType) {
                return _mapTurfType(_gaipTurf.turfType, _gaipTurf.subCategory);
            }

            // Tertiary: GAIP_STATE.inputs.soil.surfaceType (data bridge path)
            const inputsSt = window.GAIP_STATE?.inputs?.soil?.surfaceType;
            if (inputsSt) {
                if (inputsSt === 'cotula_bowling_green') return 'bowling_greens';
                return inputsSt;
            }

            // Legacy: GAIP_STATE.soil.surfaceType
            const soilSt = window.GAIP_STATE?.soil?.surfaceType;
            if (soilSt) {
                if (soilSt === 'cotula_bowling_green') return 'bowling_greens';
                return soilSt;
            }

            // Fallback: DOM select
            const surfaceSelect = document.querySelector('.gaip-surface-type');
            if (surfaceSelect?.value) return surfaceSelect.value;

            return 'sports';
        },
        
        /**
         * Get methodology from Hub state or calendar
         */
        getMethodology: function() {
            // Prebble integration runs ONLY for NZ sites (isNewZealand() is checked at init).
            // NZ standard is Ammonium Acetate (Hill Labs S78). The only valid override is SLAN,
            // which must be explicitly set in Settings.
            const _hubMeth = (window.GAIP_HUB_CONFIG?.turfMethodology || '').toLowerCase();
            if (_hubMeth === 'slan') return 'slan';

            // Everything else (mlsn, ammonium_acetate, cotula_s78, empty) → ammonium_acetate
            return 'ammonium_acetate';
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

            // b35fix308: reset hidden state on every render — same issue as AU
            // integration. hideRecommendations() sets display:none during a
            // region-toggle race (NZ → AU → NZ), and without this reset the
            // container stays hidden even though innerHTML gets rebuilt.
            container.style.display = '';

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
                const statusLabel = pct >= 90 ? 'On Track' : pct >= 70 ? 'Monitor' : 'Deficit';
                return `
                    <tr class="nutrient-${statusClass}">
                        <td class="prebble-cell prebble-cell--left"><strong>${nutrient}</strong></td>
                        <td class="prebble-cell prebble-cell--num">${required}</td>
                        <td class="prebble-cell prebble-cell--num">${delivered}</td>
                        <td class="prebble-cell prebble-cell--num nutrient-diff ${diff >= 0 ? 'positive' : 'negative'}">${diff >= 0 ? '+' : ''}${diff.toFixed(1)}</td>
                        <td class="prebble-cell prebble-cell--num"><span class="nutrient-status-badge nutrient-status-${statusClass}">${statusLabel}</span></td>
                    </tr>
                `;
            }).join('');

            // b35fix399 — Evaluate K-Reconciliation SSOT for live preview.
            // Surfaces the spot-K decision the Word export would produce,
            // so the user understands the K balance status without having
            // to generate the export. State machine: balanced / no-soil /
            // soil-suppress / will-apply.
            const kReconResult = this._evaluateKReconPreview(nutrientRequired.K, nutrientTotals.K);
            const kReconSummaryRow = this._buildKReconSummaryRow(kReconResult);
            
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
                    coverageDisplay = `<div class="prebble-covered" title="Still releasing from ${m.coveredBy.month}"><small><svg class="gilba-icon-inline" width="10" height="10" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2.5"><path stroke-linecap="round" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15"/></svg> ${m.coveredBy.product} (${m.coveredBy.month}) - N:${m.coveredBy.remainingN.toFixed(1)} K:${m.coveredBy.remainingK.toFixed(1)} remaining</small></div>`;
                }
                
                // Legacy: Show active nutrients from previous slow-release if present (for backwards compat)
                const activeDisplay = !m.coveredBy && m.activeFromPrevious 
                    ? `<div class="prebble-active" title="Still releasing from previous application"><small><svg class="gilba-icon-inline" width="10" height="10" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2.5"><path stroke-linecap="round" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15"/></svg> Active: N:${m.activeFromPrevious.N.toFixed(1)} K:${m.activeFromPrevious.K.toFixed(1)}</small></div>` 
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
                    const solubleNote = p.form === 'soluble' ? ' <svg class="gilba-icon-inline" width="10" height="10" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2" title="Dissolve in spray tank"><path stroke-linecap="round" stroke-linejoin="round" d="M12 2.25c-5.385 0-9 3.56-9 7.5C3 14.69 7.5 19.5 12 21.75c4.5-2.25 9-7.06 9-12C21 5.81 17.385 2.25 12 2.25z"/></svg>' : ''; // droplet = dissolve in tank
                    return `<span class="prebble-product liquid" title="${p.notes || ''}">${p.name}${npkDisplay}${rate ? ' @ ' + rate : ''}${splitNote}${solubleNote}</span>`;
                }).join(' + ') || '';

                // b35fix399c — append K-recon split SOP for this month (if any).
                // Renders inline in the liquid column as form:'soluble' style
                // (kg/ha rate + 💧 marker), italicised + amber-tinted, with
                // "(provisional, at export)" annotation.
                const kReconMonthlySpan = this._buildKReconMonthlySpan(kReconResult, m.month, useGM2);
                const liquidListWithKRecon = kReconMonthlySpan
                    ? (liquidList ? `${liquidList} + ${kReconMonthlySpan}` : kReconMonthlySpan)
                    : liquidList;

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
                        <td class="prebble-cell prebble-cell--month">${m.month}</td>
                        <td class="prebble-cell prebble-cell--season">${m.season}</td>
                        <td class="prebble-cell prebble-req">${reqString}</td>
                        <td class="prebble-cell prebble-granular">${granularList}${coverageDisplay}${activeDisplay}</td>
                        <td class="prebble-cell prebble-liquid">${liquidListWithKRecon}</td>
                        <td class="prebble-cell prebble-cell--notes">${m.notes && m.notes.length ? `<span class="prebble-inline-note">${m.notes.join(' · ')}</span>` : ''}</td>
                    </tr>
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
                        <td class="prebble-cell prebble-cell--left">${data.name}${releaseLabel}${analysisLabel ? `<div class="prebble-cell-sub">Analysis: ${analysisLabel}</div>` : ''}</td>
                        <td class="prebble-cell prebble-cell--num">${data.applications}</td>
                        <td class="prebble-cell prebble-cell--num">${rateValue} ${unit}</td>
                        <td class="prebble-cell prebble-cell--num prebble-cell--mono">${Math.round(nutrients.N)}</td>
                        <td class="prebble-cell prebble-cell--num prebble-cell--mono">${Math.round(nutrients.P * 10) / 10}</td>
                        <td class="prebble-cell prebble-cell--num prebble-cell--mono">${Math.round(nutrients.K)}</td>
                    </tr>
                `;
            }).join('');
            
            return `
                <div class="gilba-panel gilba-prebble-panel">
                    <div class="gilba-int-header">
                        <svg class="gilba-int-header-icon" width="16" height="16" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2"><path stroke-linecap="round" stroke-linejoin="round" d="M19.428 15.428a2 2 0 00-1.022-.547l-2.387-.477a6 6 0 00-3.86.517l-.318.158a6 6 0 01-3.86.517L6.05 15.21a2 2 0 00-1.806.547M8 4h8l-1 1v5.172a2 2 0 00.586 1.414l5 5c1.26 1.26.367 3.414-1.415 3.414H4.828c-1.782 0-2.674-2.154-1.414-3.414l5-5A2 2 0 009 10.172V5L8 4z"/></svg>
                        Prebbles Product Recommendations
                        <span class="gilba-int-region-badge">NZ</span>
                    </div>
                    
                    <div class="prebble-meta">
                        <span class="meta-item">
                            <strong>Surface:</strong> ${this.formatSurfaceType(meta.surfaceType)}
                        </span>
                        <span class="meta-item">
                            <strong>Methodology:</strong> ${(function(){
                                const _mu = (meta.methodology || 'mlsn').toUpperCase();
                                if (_mu === 'SLAN') return 'SLAN';
                                if (_mu === 'AMMONIUM_ACETATE' || _mu === 'COTULA_S78') return 'Ammonium Acetate';
                                return 'MLSN';
                            })()}
                        </span>
                    </div>
                    
                    <div class="prebble-section-card">
                        <h4>Monthly Program</h4>
                        <div class="gilba-table-scroll">
                            <table class="gilba-calendar-table prebble-program-table">
                                <colgroup>
                                    <col class="col-month">
                                    <col class="col-season">
                                    <col class="col-req">
                                    <col class="col-granular">
                                    <col class="col-liquid">
                                    <col class="col-notes">
                                </colgroup>
                                <thead>
                                    <tr>
                                        <th class="prebble-th prebble-th--left">Month</th>
                                        <th class="prebble-th prebble-th--left">Season</th>
                                        <th class="prebble-th prebble-th--left">Requirements</th>
                                        <th class="prebble-th prebble-th--left">Granular Products</th>
                                        <th class="prebble-th prebble-th--left">Liquid / Foliar</th>
                                        <th class="prebble-th prebble-th--left">Notes</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    ${monthlyRows}
                                </tbody>
                            </table>
                        </div>
                    </div>

                    <div class="prebble-section-card">
                        <h4>Nutrient Delivery Summary</h4>
                        <table class="gilba-int-table prebble-nutrient-summary">
                            <thead>
                                <tr>
                                    <th class="prebble-th prebble-th--left">Nutrient</th>
                                    <th class="prebble-th">Required (kg/ha)</th>
                                    <th class="prebble-th">Delivered (kg/ha)</th>
                                    <th class="prebble-th">Balance</th>
                                    <th class="prebble-th">Status</th>
                                </tr>
                            </thead>
                            <tbody>
                                ${nutrientSummaryRows}
                                ${kReconSummaryRow}
                            </tbody>
                        </table>
                    </div>

                    ${productEntries.length > 0 ? `
                        <div class="prebble-section-card">
                        <h4>Annual Product Summary</h4>
                        <table class="gilba-int-table prebble-summary-table">
                            <thead>
                                <tr>
                                    <th class="prebble-th prebble-th--left">Product</th>
                                    <th class="prebble-th">Applications</th>
                                    <th class="prebble-th">Total Rate</th>
                                    <th class="prebble-th">N</th>
                                    <th class="prebble-th">P</th>
                                    <th class="prebble-th">K</th>
                                </tr>
                                <tr class="prebble-unit-row">
                                    <th colspan="3"></th>
                                    <th colspan="3">kg/ha delivered</th>
                                </tr>
                            </thead>
                            <tbody>
                                ${summaryRows}
                                ${this._buildKReconAnnualSummaryRow(kReconResult, useGM2)}
                            </tbody>
                            <tfoot>
                                <tr class="prebble-totals-row">
                                    <td class="prebble-cell prebble-cell--left" colspan="3"><strong>Total Delivered</strong></td>
                                    <td class="prebble-cell prebble-cell--num prebble-cell--mono"><strong>${Math.round(nutrientTotals.N)}</strong></td>
                                    <td class="prebble-cell prebble-cell--num prebble-cell--mono"><strong>${Math.round(nutrientTotals.P * 10) / 10}</strong></td>
                                    <td class="prebble-cell prebble-cell--num prebble-cell--mono"><strong>${Math.round(nutrientTotals.K)}</strong></td>
                                </tr>
                                <tr class="prebble-required-row">
                                    <td class="prebble-cell prebble-cell--left" colspan="3"><em>Required (kg/ha)</em></td>
                                    <td class="prebble-cell prebble-cell--num prebble-cell--mono"><em>${Math.round(nutrientRequired.N)}</em></td>
                                    <td class="prebble-cell prebble-cell--num prebble-cell--mono"><em>${Math.round(nutrientRequired.P * 10) / 10}</em></td>
                                    <td class="prebble-cell prebble-cell--num prebble-cell--mono"><em>${Math.round(nutrientRequired.K)}</em></td>
                                </tr>
                                <tr class="${(nutrientTotals.N - nutrientRequired.N) >= 0 ? 'prebble-balance-row--positive' : 'prebble-balance-row--negative'}">
                                    <td class="prebble-cell prebble-cell--left" colspan="3"><strong>Balance</strong></td>
                                    <td class="prebble-cell prebble-cell--num prebble-cell--mono ${(nutrientTotals.N - nutrientRequired.N) >= 0 ? 'prebble-positive' : 'prebble-negative'}"><strong>${(nutrientTotals.N - nutrientRequired.N) >= 0 ? '+' : ''}${Math.round(nutrientTotals.N - nutrientRequired.N)}</strong></td>
                                    <td class="prebble-cell prebble-cell--num prebble-cell--mono ${(nutrientTotals.P - nutrientRequired.P) >= 0 ? 'prebble-positive' : 'prebble-negative'}"><strong>${(nutrientTotals.P - nutrientRequired.P) >= 0 ? '+' : ''}${Math.round((nutrientTotals.P - nutrientRequired.P) * 10) / 10}</strong></td>
                                    <td class="prebble-cell prebble-cell--num prebble-cell--mono ${(nutrientTotals.K - nutrientRequired.K) >= 0 ? 'prebble-positive' : 'prebble-negative'}"><strong>${(nutrientTotals.K - nutrientRequired.K) >= 0 ? '+' : ''}${Math.round(nutrientTotals.K - nutrientRequired.K)}</strong></td>
                                </tr>
                            </tfoot>
                        </table>
                        </div>
                    ` : ''}

                    <div class="prebble-disclaimer">
                        <strong>Note:</strong> These recommendations are based on nutrient requirements
                        calculated from ${(function(){
                            const m = (meta && meta.methodology || 'ammonium_acetate').toUpperCase();
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

        // ====================================================================
        // b35fix399 — K-Reconciliation Live Preview
        // b35fix399b — Soil-state architecture fix
        // ====================================================================
        // Surfaces the export-time _synthesiseKReconDecision SSOT (b35fix324a,
        // defined in word-export.js) into the Prebbles live preview so the
        // user can see whether spot-K will fire at export time, instead of
        // staring at a red "K balance -28" flag with no context.
        //
        // The SSOT applies two gates:
        //   Gate 1: programme balance < BALANCE_THRESHOLD (default -20 kg/ha)
        //   Gate 2: soilK < (thresholds.K.min - nearFloorBuffer) (default 5 ppm)
        //
        // Both must trip for spot-K to apply. Returns one of four states:
        //   'will-apply'    — both gates trip; preview shows provisional spot-K
        //   'soil-suppress' — gate 1 trips, gate 2 suppresses (soil K above floor)
        //   'no-soil'       — soil sample not loaded; SSOT cannot evaluate
        //   'balanced'      — gate 1 doesn't trip (delivery within threshold)
        //
        // b35fix399b architectural fix. The original b35fix399 read soil from
        // window.GAIP_STATE.inputs.soil → window.GAIP_STATE.soil and expected
        // soil.thresholds to be pre-attached. Production probe on Shirley GC
        // (Hill Labs AA, K req=69, K del=41) showed:
        //   - GAIP_STATE.inputs has 'soil' as a key but reads as null/undef
        //     at runtime (proxy-defined parent slot, no payload)
        //   - GAIP_STATE.soil doesn't exist
        //   - Soil sample lives at window.GAIP_NUTRITION_SOIL_CACHE with
        //     ppm sub-object (cache.ppm.K), methodology, surfaceType, etc.
        //   - Thresholds are NOT pre-attached to the cache. They are
        //     computed at runtime by the methodology engine.
        //
        // b35fix399b walks the canonical fallback chain (matching
        // extractSoilValues at nutrition-summary-integration.js:557), reads
        // soil K via the .ppm.K-or-.K shape, detects active methodology,
        // computes the K floor at call time via the appropriate engine,
        // and constructs a synthetic soil object in the SSOT-expected shape
        // {K, thresholds:{K:{min}}} to pass to _synthesiseKReconDecision.
        //
        // Pure render-side: does not mutate state, does not run code that
        // wasn't already running at Word export. The same SSOT decision the
        // Word export will produce is what's previewed here.
        // ====================================================================
        _evaluateKReconPreview: function(kRequired, kDelivered) {
            const result = {
                state: 'no-soil',
                decision: null,
                kRequired: kRequired,
                kDelivered: kDelivered,
                balance: kDelivered - kRequired,
                soilK: null,
                soilKFloor: null,
                methodology: null,
                splitEntries: [],
                hemisphere: null,
            };

            // Need the SSOT before doing anything else.
            const wx = window.GAIP_WordExport;
            if (!wx || typeof wx._synthesiseKReconDecision !== 'function') {
                return result;
            }

            // ---- Step 1: extract soil K via canonical fallback chain ----
            // Mirrors extractSoilValues() in nutrition-summary-integration.js:557.
            // Cache uses .ppm.K shape; state uses .K directly.
            const extractK = function(soil) {
                if (!soil) return null;
                const source = soil.ppm || soil;
                const k = source.K ?? source.k;
                if (k === null || k === undefined) return null;
                const v = parseFloat(k);
                return isFinite(v) ? v : null;
            };

            let soilK = null;
            let soilSource = null;
            let cache = null;

            // 1a. GAIP_STATE.soil
            if (window.GAIP_STATE && window.GAIP_STATE.soil) {
                soilK = extractK(window.GAIP_STATE.soil);
                if (soilK !== null) soilSource = window.GAIP_STATE.soil;
            }
            // 1b. GilbaHubOrchestrator state
            if (soilK === null && window.GilbaHubOrchestrator
                    && typeof window.GilbaHubOrchestrator.getState === 'function') {
                try {
                    const st = window.GilbaHubOrchestrator.getState();
                    if (st && st.soil) {
                        soilK = extractK(st.soil);
                        if (soilK !== null) soilSource = st.soil;
                    }
                    if (soilK === null && st && st.inputs && st.inputs.soil) {
                        soilK = extractK(st.inputs.soil);
                        if (soilK !== null) soilSource = st.inputs.soil;
                    }
                } catch (e) { /* defensive: orchestrator may throw */ }
            }
            // 1c. GAIP_STATE.inputs.soil (when populated)
            if (soilK === null && window.GAIP_STATE
                    && window.GAIP_STATE.inputs && window.GAIP_STATE.inputs.soil) {
                soilK = extractK(window.GAIP_STATE.inputs.soil);
                if (soilK !== null) soilSource = window.GAIP_STATE.inputs.soil;
            }
            // 1d. GAIP_NUTRITION_SOIL_CACHE — most common runtime path on
            //     this client (confirmed via b35fix399b production probe).
            if (soilK === null && window.GAIP_NUTRITION_SOIL_CACHE) {
                cache = window.GAIP_NUTRITION_SOIL_CACHE;
                soilK = extractK(cache);
                if (soilK !== null) soilSource = cache;
            }
            if (cache === null && window.GAIP_NUTRITION_SOIL_CACHE) {
                cache = window.GAIP_NUTRITION_SOIL_CACHE; // for methodology read below
            }

            if (soilK === null) {
                return result; // 'no-soil'
            }
            result.soilK = soilK;

            // ---- Step 2: detect active methodology ----
            // Methodology drives which K-floor to use. Order of precedence:
            //   (a) soilSource.methodology (cache or state-attached)
            //   (b) cache.methodology (when source was state but cache exists)
            //   (c) DOM <select.gaip-soil-methodology>
            //   (d) default to MLSN (most permissive floor — least likely to
            //       fire spot-K incorrectly)
            const methodologyRaw =
                (soilSource && soilSource.methodology)
                || (cache && cache.methodology)
                || (function() {
                    const el = document && document.querySelector
                        && document.querySelector('.gaip-soil-methodology');
                    return el ? el.value : null;
                })()
                || 'mlsn';
            const methodology = String(methodologyRaw).toUpperCase();
            result.methodology = methodology;

            // ---- Step 3: compute K floor for this methodology ----
            // AA (Ammonium Acetate / Hill Labs / Cotula S78): floor =
            //   ranges.medium[0]  (75 ppm sands, 100 ppm others)
            // SLAN: floor = slanRanges.K.low (75 ppm)
            // MLSN: floor = mlsnThresholds.K (37 ppm)
            //
            // Each methodology engine exposes its data differently. We try
            // the typed engine APIs first, fall back to scenario-presets
            // CONFIG, and finally fall back to documented constants so the
            // helper still works on stripped-down test contexts.
            let floor = null;

            if (methodology === 'AMMONIUM_ACETATE' || methodology === 'COTULA_S78') {
                // soilType: cache.soilTexture or 'others' default. AA defines
                // 'sands' vs 'others'. Texture string from cache may be e.g.
                // 'sand' / 'sandy loam' / 'loam' — match 'sand' prefix to map.
                const tx = String(
                    (cache && cache.soilTexture)
                    || (soilSource && soilSource.soilTexture)
                    || ''
                ).toLowerCase();
                const soilType = (tx.indexOf('sand') === 0) ? 'sands' : 'others';
                if (window.GAIP_AmmoniumAcetate
                        && typeof window.GAIP_AmmoniumAcetate.getSufficiencyRange === 'function') {
                    try {
                        const rangeData = window.GAIP_AmmoniumAcetate
                            .getSufficiencyRange('K', soilType);
                        if (rangeData && rangeData.ranges
                                && Array.isArray(rangeData.ranges.medium)
                                && typeof rangeData.ranges.medium[0] === 'number') {
                            floor = rangeData.ranges.medium[0];
                        }
                    } catch (e) { /* defensive */ }
                }
                // Documented fallback (from ammonium-acetate-methodology.js
                // AMMONIUM_ACETATE_RANGES.K.ranges).
                if (floor === null) {
                    floor = (soilType === 'sands') ? 75 : 100;
                }
            } else if (methodology === 'SLAN') {
                // Try GilbaScenarioPresets.getSLANRanges() (scenario-presets.js).
                if (window.GilbaScenarioPresets
                        && typeof window.GilbaScenarioPresets.getSLANRanges === 'function') {
                    try {
                        const r = window.GilbaScenarioPresets.getSLANRanges();
                        if (r && r.K && typeof r.K.low === 'number') floor = r.K.low;
                    } catch (e) { /* defensive */ }
                }
                // Documented fallback (Carrow et al. 2004, "other soils").
                if (floor === null) {
                    floor = 75;
                }
            } else {
                // MLSN (default).
                if (window.GilbaClassificationConstants
                        && window.GilbaClassificationConstants.MLSN_THRESHOLDS
                        && typeof window.GilbaClassificationConstants
                            .MLSN_THRESHOLDS.K === 'number') {
                    floor = window.GilbaClassificationConstants.MLSN_THRESHOLDS.K;
                }
                if (floor === null && window.GilbaScenarioPresets
                        && typeof window.GilbaScenarioPresets.getMLSNThresholds === 'function') {
                    try {
                        const t = window.GilbaScenarioPresets.getMLSNThresholds();
                        if (t && typeof t.K === 'number') floor = t.K;
                    } catch (e) { /* defensive */ }
                }
                // Documented fallback (Woods 2014 MLSN K threshold).
                if (floor === null) {
                    floor = 37;
                }
            }

            if (typeof floor !== 'number' || !isFinite(floor)) {
                return result; // unable to compute floor: 'no-soil'
            }
            result.soilKFloor = floor;

            // ---- Step 4: replicate Gate 1 locally ----
            // SSOT returns null in BOTH the gate-1-not-trip case AND the
            // gate-2-suppress case. Helper must reproduce gate 1 locally so
            // the UI can tell the user whether soil suppression is what's
            // happening.
            const BALANCE_THRESHOLD = -20;
            if (!(result.balance < BALANCE_THRESHOLD)) {
                result.state = 'balanced';
                return result;
            }

            // ---- Step 5: build synthetic soil object and call SSOT ----
            // The SSOT only reads soilData.K and soilData.thresholds.K.min.
            // Build the minimum shape it needs.
            const synthSoil = {
                K: soilK,
                thresholds: { K: { min: floor } }
            };
            const decision = wx._synthesiseKReconDecision(synthSoil, kRequired, kDelivered);
            if (decision) {
                result.state = 'will-apply';
                result.decision = decision;

                // ---- Step 6 (b35fix399c): resolve monthly split entries ----
                // The SSOT decision describes the spot-K total. The Word export
                // splits it across 3 peak K-uptake months (Sep/Nov/Jan south,
                // Mar/May/Jul north) via _amendmentDecisionsToProducts. The
                // monthly preview rows need the same split resolution so the
                // user can see WHICH months will get the SOP applications.
                //
                // Defensive: if the helper isn't exposed (older word-export
                // build) or throws, the will-apply state still produces the
                // annual summary row — only the monthly inline rows are lost.
                result.splitEntries = [];
                if (typeof wx._amendmentDecisionsToProducts === 'function') {
                    try {
                        const hemisphere =
                            (typeof this.getHemisphere === 'function'
                                ? this.getHemisphere()
                                : null)
                            || (window.GAIP_STATE
                                && window.GAIP_STATE.location
                                && window.GAIP_STATE.location.hemisphere)
                            || 'south';
                        const out = wx._amendmentDecisionsToProducts(
                            [decision], synthSoil, hemisphere
                        );
                        if (out && Array.isArray(out.granularEntries)) {
                            result.splitEntries = out.granularEntries.slice();
                            result.hemisphere = hemisphere;
                        }
                    } catch (e) {
                        // _amendmentDecisionsToProducts can fail on missing
                        // helper deps (parseAnalysisLabel, etc.) — leave
                        // splitEntries empty; monthly rows will skip.
                    }
                }
            } else {
                // Gate 1 tripped but SSOT returned null — so Gate 2 (soil K
                // sufficiency) must be suppressing. Soil K is at-or-above floor
                // (within near-floor buffer).
                result.state = 'soil-suppress';
            }
            return result;
        },

        /**
         * b35fix399 — Build the Spot-K Reconciliation row HTML for the
         * Nutrient Delivery Summary table. Returns empty string when
         * nothing useful to show (balanced K) or when the SSOT cannot
         * evaluate (no soil loaded).
         */
        _buildKReconSummaryRow: function(reconResult) {
            if (!reconResult || reconResult.state === 'balanced') {
                return ''; // K is in balance — no row needed.
            }
            if (reconResult.state === 'no-soil') {
                // Educational hint when soil isn't loaded but K balance is short.
                if (reconResult.balance < -20) {
                    return `
                        <tr class="krecon-info">
                            <td colspan="5" style="font-style: italic; font-size: 12px; color: var(--gaip-text-secondary); padding: 8px 12px;">
                                <svg class="gilba-icon-inline" width="12" height="12" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"/><path stroke-linecap="round" d="M12 16v-4M12 8h.01"/></svg>
                                K balance is short by ${Math.abs(reconResult.balance).toFixed(0)} kg/ha. Load a soil sample to see whether spot-K reconciliation will fire at export.
                            </td>
                        </tr>`;
                }
                return '';
            }
            if (reconResult.state === 'soil-suppress') {
                return `
                    <tr class="krecon-suppress">
                        <td colspan="5" style="font-style: italic; font-size: 12px; color: var(--gaip-text-secondary); padding: 8px 12px;">
                            <svg class="gilba-icon-inline" width="12" height="12" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"/><path stroke-linecap="round" d="M12 16v-4M12 8h.01"/></svg>
                                K balance ${reconResult.balance.toFixed(0)} kg/ha; soil K (${reconResult.soilK.toFixed(0)} ppm) at or above floor (${reconResult.soilKFloor} ppm), not supplementing per soil-K sufficiency gate.
                        </td>
                    </tr>`;
            }
            if (reconResult.state === 'will-apply' && reconResult.decision) {
                const d = reconResult.decision;
                // Extract the spot-K kg from the decision rate text "X kg K/ha (Y kg product/ha)"
                const m = (d.rate || '').match(/^(\d+)\s*kg K\/ha/);
                const spotK = m ? parseInt(m[1], 10) : null;
                const spotKText = spotK !== null ? `+${spotK} kg K/ha` : 'spot-K';
                return `
                    <tr class="krecon-apply" style="background: var(--gaip-warning-bg, rgba(245, 158, 11, 0.08));">
                        <td><strong>K (provisional)</strong></td>
                        <td>,</td>
                        <td style="font-style: italic;">${spotKText} at export</td>
                        <td colspan="2" style="font-style: italic; font-size: 12px; color: var(--gaip-text-secondary);">
                            <svg class="gilba-icon-inline" width="11" height="11" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"/><circle cx="12" cy="12" r="3"/></svg>
                            Spot-K reconciliation will fire at Word export. ${d.product} ${d.analysis}, ${d.rate.replace(/^\d+\s*kg K\/ha\s*\([^)]*\)\s*—\s*/, '').replace(/Programme delivers.*$/, '').trim()}
                        </td>
                    </tr>`;
            }
            return '';
        },

        /**
         * b35fix399 — Build the provisional spot-K row for the
         * Annual Product Summary table. Only renders when state is
         * 'will-apply'. Italicised + amber-tinted to distinguish from
         * confirmed-applied products.
         */
        _buildKReconAnnualSummaryRow: function(reconResult, useGM2) {
            if (!reconResult || reconResult.state !== 'will-apply' || !reconResult.decision) return '';
            const d = reconResult.decision;
            const m = (d.rate || '').match(/^(\d+)\s*kg K\/ha\s*\((\d+)\s*kg product\/ha\)/);
            if (!m) return '';
            const spotK = parseInt(m[1], 10);
            const productKgHa = parseInt(m[2], 10);
            const splitCount = 3; // SSOT splits across 3 peak K-uptake months
            const perAppKgHa = Math.round(productKgHa / splitCount);
            const rateDisplay = useGM2
                ? `${(perAppKgHa / 10).toFixed(1)} g/m² × ${splitCount}`
                : `${perAppKgHa} kg/ha × ${splitCount}`;
            return `
                <tr style="background: var(--gaip-warning-bg, rgba(245, 158, 11, 0.08)); font-style: italic;">
                    <td>
                        ${d.product} <em>(provisional, applied at export)</em>
                        <div style="font-size: 11px; color: var(--gaip-text-secondary); font-style: normal;">Analysis: ${d.analysis}</div>
                    </td>
                    <td>${splitCount}</td>
                    <td>${rateDisplay}</td>
                    <td style="text-align: right; font-family: monospace;">0</td>
                    <td style="text-align: right; font-family: monospace;">0</td>
                    <td style="text-align: right; font-family: monospace;">${spotK}</td>
                </tr>`;
        },

        // ====================================================================
        // b35fix399c — Monthly inline rendering for K-recon split entries
        // ====================================================================
        // The Annual Product Summary row (b35fix399) shows the spot-K total.
        // The user feedback was that this doesn't tell them WHICH months
        // get the SOP applications. The Word export splits the spot-K total
        // into 3 entries placed in peak K-uptake months (Sep/Nov/Jan south,
        // Mar/May/Jul north) via _amendmentDecisionsToProducts. b35fix399c
        // renders the same split entries inline in the monthly programme
        // table so the user can see the placement.
        //
        // SOP for K-recon is dissolved in the spray tank (form: 'soluble' in
        // Prebble convention — same as SOL-SOP). The span renders into the
        // liquid column to match how Prebbles displays all soluble products
        // (kg/ha rate + 💧 marker). The Word export classifies it as a
        // granularEntry for spreader compatibility, but the live preview
        // convention is liquid column for solubles.
        //
        // Returns the HTML span(s) for any K-recon SOP application(s) that
        // fall in the given month, or empty string if no match.
        // ====================================================================
        _buildKReconMonthlySpan: function(reconResult, monthName, useGM2) {
            if (!reconResult || reconResult.state !== 'will-apply') return '';
            if (!Array.isArray(reconResult.splitEntries) || !reconResult.splitEntries.length) {
                return '';
            }
            const MONTH_NAMES_SHORT = ['Jan','Feb','Mar','Apr','May','Jun',
                                        'Jul','Aug','Sep','Oct','Nov','Dec'];
            const MONTH_NAMES_LONG  = ['January','February','March','April','May','June',
                                        'July','August','September','October','November','December'];
            // Match either short or long form, case-insensitive (defensive
            // against differing month formats across calendar/integration).
            const monthLower = String(monthName || '').toLowerCase();
            const idxShort = MONTH_NAMES_SHORT.findIndex(n => n.toLowerCase() === monthLower);
            const idxLong  = MONTH_NAMES_LONG.findIndex(n => n.toLowerCase() === monthLower);
            const monthIdx = idxShort >= 0 ? idxShort : idxLong;
            if (monthIdx < 0) return '';

            // Find any split entries that target this month.
            const matches = reconResult.splitEntries.filter(e => e._monthIndex === monthIdx);
            if (!matches.length) return '';

            // Render each as a soluble-style span (matches the liquid-column
            // convention for form:'soluble' products elsewhere in Prebbles —
            // see liquidList map at the rate handling for `p.form === 'soluble'`).
            // SOP is delivered as soluble in spray tank: kg/ha rate, 💧 marker.
            return matches.map(e => {
                const rateDisplay = useGM2
                    ? `${e.rateGM2}g/m²`
                    : `${e.rateKgHa}kg/ha`;
                const kDelivered = (e.delivers && typeof e.delivers.K === 'number')
                    ? e.delivers.K.toFixed(0)
                    : '?';
                const sDelivered = (e.delivers && typeof e.delivers.S === 'number')
                    ? e.delivers.S.toFixed(0)
                    : null;
                const tooltipParts = [
                    `Spot-K reconciliation (b35fix324a SSOT).`,
                    `Provisional, applied at Word export.`,
                    `Delivers ${kDelivered} kg K/ha`
                ];
                if (sDelivered) tooltipParts.push(`+ ${sDelivered} kg S/ha`);
                tooltipParts.push(`(soluble, dissolve in spray tank).`);
                if (e.notes) tooltipParts.push(e.notes);
                const tooltip = tooltipParts.join(' ');
                // b35fix400: e.npk is region-aware (set by
                // _amendmentDecisionsToProducts via _detectKDisplayRegion).
                // AU/NZ shows "0-0-41.5" elemental, UK/EU shows "0-0-50" oxide.
                const npkLabel = e.npk || '0-0-41.5';
                return `<span class="prebble-product liquid krecon-monthly" ` +
                       `style="background: var(--gaip-warning-bg, rgba(245, 158, 11, 0.08)); ` +
                       `font-style: italic; border: 1px dashed var(--gaip-warning, #f59e0b); ` +
                       `padding: 2px 6px;" ` +
                       `title="${tooltip.replace(/"/g, '&quot;')}">` +
                       `${e.name} (${npkLabel}) @ ${rateDisplay} <svg class="gilba-icon-inline" width="10" height="10" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2" title="Dissolve in spray tank"><path stroke-linecap="round" stroke-linejoin="round" d="M12 2.25c-5.385 0-9 3.56-9 7.5C3 14.69 7.5 19.5 12 21.75c4.5-2.25 9-7.06 9-12C21 5.81 17.385 2.25 12 2.25z"/></svg> ` +
                       `<small style="font-style: normal; opacity: 0.85;">(provisional, at export)</small>` +
                       `</span>`;
            }).join(' + ');
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
        .gilba-prebble-recommendations { margin-top: 0; }

        .gilba-prebble-panel { background: none; border: none; padding: 0; }

        /* ── Section cards ─────────────────────────────────────────────────── */
        .prebble-section-card {
            background: #fff;
            border: 1px solid var(--gaip-border-light, #e5e7eb);
            border-radius: 8px;
            overflow: hidden;
            margin-bottom: 14px;
        }
        .prebble-section-card h4 {
            margin: 0;
            padding: 10px 14px;
            background: var(--gaip-surface-muted, #f8fafc);
            border-bottom: 1px solid var(--gaip-border-light, #e5e7eb);
            font-size: 11px;
            font-weight: 700;
            text-transform: uppercase;
            letter-spacing: 0.06em;
            color: var(--gaip-text-muted, #6b7280);
        }
        .prebble-section-card .gilba-table-scroll { margin-bottom: 0; }
        .prebble-section-card .gilba-int-table { border-radius: 0; }
        .prebble-section-card tbody tr:last-child .prebble-cell { border-bottom: none; }

        .prebble-meta {
            display: flex;
            gap: 16px;
            flex-wrap: wrap;
            padding: 10px 14px;
            background: var(--gaip-surface-muted, #f8fafc);
            border: 1px solid var(--gaip-border-light, #e5e7eb);
            border-radius: 8px;
            font-size: 13px;
            margin-bottom: 14px;
        }

        /* ── Monthly programme table ────────────────────────────────────────── */
        .prebble-program-table { font-size: 13px; width: 100%; }

        .prebble-program-table col.col-month    { width: 56px; }
        .prebble-program-table col.col-season   { width: 80px; }
        .prebble-program-table col.col-req      { width: 130px; }
        .prebble-program-table col.col-granular { width: auto; }
        .prebble-program-table col.col-liquid   { width: 300px; }
        .prebble-program-table col.col-notes    { width: 190px; }

        .prebble-program-table td { vertical-align: middle; }

        /* GP row accent — left border on month cell */
        .gilba-gp-high  > td:first-child { border-left: 3px solid var(--gaip-good, #16a34a); }
        .gilba-gp-medium > td:first-child { border-left: 3px solid var(--gaip-warning, #d97706); }
        .gilba-gp-low   > td:first-child { border-left: 3px solid var(--gaip-border, #d1d5db); }

        .prebble-program-table tbody tr:hover td { background: var(--gaip-surface-muted, #f8fafc); }

        .prebble-program-table .prebble-product {
            display: inline-block;
            background: #f1f5f9;
            color: #1e293b;
            border: 1px solid #cbd5e1;
            padding: 3px 10px;
            border-radius: 20px;
            margin: 2px 2px;
            font-size: 12px;
            font-weight: 500;
        }

        .prebble-program-table .prebble-product.liquid {
            background: #eff6ff;
            color: #1e40af;
            border-color: #bfdbfe;
        }

        .prebble-program-table .prebble-none { color: var(--gaip-text-muted, #9ca3af); font-size: 13px; }

        /* Requirements column — more readable */
        .prebble-req {
            font-size: 13px;
            font-weight: 600;
            white-space: nowrap;
            color: var(--gaip-text, #111827);
            font-variant-numeric: tabular-nums;
        }


        /* Notes column */
        .prebble-cell--notes { vertical-align: middle; }

        .prebble-inline-note {
            display: block;
            font-size: 12px;
            color: var(--gaip-text, #111827);
            line-height: 1.4;
        }

        .prebble-notes { color: var(--gaip-text, #111827); font-size: 12px; }

        .prebble-covered, .prebble-active {
            display: inline-block;
            font-size: 11px;
            color: var(--gaip-text-muted, #9ca3af);
            margin-top: 3px;
        }

        /* ── Shared table base ─────────────────────────────────────────────── */
        .gilba-int-table { width: 100%; border-collapse: collapse; font-size: 13px; }
        .gilba-table-scroll { overflow-x: auto; }

        .prebble-th {
            text-align: right;
            font-size: 11px;
            font-weight: 700;
            text-transform: uppercase;
            letter-spacing: 0.04em;
            color: var(--gaip-text-muted, #6b7280);
            padding: 9px 12px;
            border-bottom: 2px solid var(--gaip-border, #e2e8f0);
            white-space: nowrap;
            background: var(--gaip-surface-muted, #f8fafc);
        }
        .prebble-th--left { text-align: left; }

        .prebble-unit-row th {
            font-size: 11px; font-weight: 400; font-style: italic;
            color: var(--gaip-text-muted, #6b7280); text-transform: none; letter-spacing: 0;
            border-bottom: 1px solid var(--gaip-border-light, #f1f5f9);
            padding: 3px 12px; text-align: right;
            background: var(--gaip-surface-muted, #f8fafc);
        }

        .prebble-cell {
            padding: 11px 12px;
            border-bottom: 1px solid var(--gaip-border-light, #f1f5f9);
            color: var(--gaip-text, #111827);
            vertical-align: middle;
        }
        .prebble-cell--left { text-align: left; }
        .prebble-cell--num { text-align: right; }
        .prebble-cell--mono { font-variant-numeric: tabular-nums; }
        .prebble-cell--month { font-weight: 700; white-space: nowrap; font-size: 13px; }
        .prebble-cell--season { color: var(--gaip-text-muted, #6b7280); white-space: nowrap; font-size: 12px; }
        .prebble-cell-sub { font-size: 11px; color: var(--gaip-text-muted, #6b7280); margin-top: 2px; }

        .prebble-positive { color: var(--gaip-good, #16a34a); font-weight: 600; }
        .prebble-negative { color: var(--gaip-critical, #dc2626); font-weight: 600; }

        /* ── Nutrient delivery summary ──────────────────────────────────────── */
        .prebble-nutrient-summary .nutrient-diff { font-weight: 600; }
        .prebble-nutrient-summary .nutrient-diff.positive { color: var(--gaip-good, #16a34a); }
        .prebble-nutrient-summary .nutrient-diff.negative { color: var(--gaip-critical, #dc2626); }
        .prebble-npk-delivered { font-size: 12px; font-variant-numeric: tabular-nums; }

        /* Status badges in nutrient summary */
        .nutrient-status-badge {
            display: inline-block;
            padding: 3px 9px;
            border-radius: 12px;
            font-size: 11px;
            font-weight: 700;
            white-space: nowrap;
        }
        .nutrient-status-sufficient { background: var(--gaip-good-bg, #f0fdf4); color: var(--gaip-good, #16a34a); border: 1px solid var(--gaip-good-border, #bbf7d0); }
        .nutrient-status-marginal   { background: var(--gaip-warning-bg, #fffbeb); color: var(--gaip-warning, #d97706); border: 1px solid #fde68a; }
        .nutrient-status-deficit    { background: #fef2f2; color: var(--gaip-critical, #dc2626); border: 1px solid #fecaca; }

        .prebble-totals-row td { background: var(--gaip-good-bg, #f0fdf4); font-weight: 700; border-top: 2px solid var(--gaip-border, #e2e8f0); padding: 10px 12px; }
        .prebble-required-row td { background: var(--gaip-surface-muted, #f8fafc); color: var(--gaip-text-muted, #6b7280); padding: 9px 12px; }
        .prebble-balance-row--positive td { background: var(--gaip-good-bg, #f0fdf4); }
        .prebble-balance-row--negative td { background: #fef2f2; }

        /* ── Summary table ─────────────────────────────────────────────────── */
        .prebble-summary-table { width: 100%; }

        /* ── Disclaimer ────────────────────────────────────────────────────── */
        .prebble-disclaimer {
            margin-top: 0;
            padding: 10px 14px;
            background: var(--gaip-warning-bg, #fffbeb);
            border: 1px solid var(--gaip-warning-border, #fde68a);
            border-left: 3px solid var(--gaip-warning, #d97706);
            border-radius: 8px;
            font-size: 13px;
            line-height: 1.5;
            color: var(--gaip-text, #111827);
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

/**
 * Nutrition Calendar ↔ Australian Fertiliser Recommender Integration
 * 
 * Wires the Australian fertiliser product database to the Nutrition Calendar.
 * Automatically generates product recommendations when the calendar generates.
 * 
 * REGION RESTRICTION: Only activates for Australian locations.
 * Australian distributors: Nuturf, Oasis Turf, Living Turf, K&B Adams, GTS
 * 
 * Dependencies:
 *   - nutrition-calendar.js (GilbaNutritionCalendar)
 *   - au-fertiliser-products.js (AuFertiliserRecommender)
 *   - regional-profiles.js (for AU detection)
 *   - Hub state (GAIP_STATE.soil.surfaceType)
 * 
 * @package Gilba_Hub
 * @version 1.0.0
 * @since 10.2.0
 */

(function() {
    'use strict';

    // ========================================================================
    // INTEGRATION MODULE
    // ========================================================================

    const NutritionAuFertiliserIntegration = {
        
        version: '1.3.0',
        
        // Store last generated program
        lastProgram: null,
        
        // Store last calendar data for regeneration
        lastCalendarData: null,
        
        // Current distributor filter selection (persists across regenerations)
        selectedDistributor: 'all',
        
        /**
         * Initialize integration
         * Hooks into NutritionCalendar's render pipeline
         * Only activates for Australian locations
         */
        init: function() {
            // Wait for AuFertiliserRecommender to be available
            if (!window.AuFertiliserRecommender) {
                console.warn('[NutritionAuFertiliserIntegration] Waiting for AuFertiliserRecommender...');
                setTimeout(() => this.init(), 100);
                return;
            }
            
            // v1.0.1: Always listen for calendar generation, check region at generation time
            // This handles location changes after page load
            document.addEventListener('gaip:nutrition-calendar-generated', (e) => {
                // Check region at generation time, not init time
                if (!this.isAustralia()) {
                    // Hide any existing AU recommendations
                    this.hideRecommendations();
                    return;
                }
                this.lastCalendarData = e.detail.program;
                this.generateAndRender(e.detail.program);
            });
            
        },
        
        /**
         * Hide existing recommendations (when region changes)
         */
        hideRecommendations: function() {
            const container = document.querySelector('[data-au-fertiliser-recommendations]');
            if (container) {
                container.style.display = 'none';
            }
        },
        
        /**
         * Check if current location is in Australia
         * Uses RegionalProfiles if available, otherwise checks coordinates directly
         */
        isAustralia: function() {
            // Method 1: Check RegionalProfiles detection
            if (window.GAIP_RegionalProfiles?.detectRegionFromHub) {
                const region = window.GAIP_RegionalProfiles.detectRegionFromHub();
                return region && region.startsWith('australia');
            }
            
            // Method 2: Check GAIP_STATE for region
            if (window.GAIP_STATE?.location?.region) {
                return window.GAIP_STATE.location.region.startsWith('australia');
            }
            
            // Method 3: Direct coordinate check (Australia: lat -44 to -10, lon 113 to 154)
            const lat = window.GAIP_STATE?.location?.lat || 
                        window.GAIP_HUB_CONFIG?.savedLocation?.lat;
            const lon = window.GAIP_STATE?.location?.lon || 
                        window.GAIP_HUB_CONFIG?.savedLocation?.lon;
            
            if (lat && lon) {
                return (lon >= 113 && lon <= 154 && lat >= -44 && lat <= -10);
            }
            
            // Method 4: GAIP_SiteConfig saved location for active site
            try {
                var SC = window.GAIP_SiteConfig || window.GAIP_SiteContext;
                var siteId = window.GAIP_SiteContext ? window.GAIP_SiteContext.getSiteId() : null;
                if (SC && siteId && typeof SC.getConfig === 'function') {
                    var cfg = SC.getConfig(siteId);
                    var cfgLat = cfg && cfg.location && cfg.location.lat;
                    var cfgLon = cfg && cfg.location && cfg.location.lon;
                    if (cfgLat && cfgLon) {
                        return (cfgLon >= 113 && cfgLon <= 154 && cfgLat >= -44 && cfgLat <= -10);
                    }
                }
            } catch(e) {}

            // Default: not Australia
            return false;
        },
        
        /**
         * Detect Australian state from Hub location
         * @returns {string|null} State code (VIC, NSW, QLD, etc.) or null
         */
        getDetectedState: function() {
            const lat = window.GAIP_STATE?.location?.lat || 
                        window.GAIP_HUB_CONFIG?.savedLocation?.lat;
            const lon = window.GAIP_STATE?.location?.lon || 
                        window.GAIP_HUB_CONFIG?.savedLocation?.lon;
            
            if (lat && lon && window.AuFertiliserRecommender?.detectState) {
                return window.AuFertiliserRecommender.detectState(lat, lon);
            }
            return null;
        },
        
        /**
         * Get surface type from Hub state
         * Cascades through possible locations
         */
        getSurfaceType: function() {
            // Cotula/bowls: map to bowling_greens regardless of what soil.surfaceType says
            const turfState = window.GaipTurfProfile?.state || window.GAIP_STATE?.turf || {};
            if (turfState.cotula === true ||
                turfState.turfType === 'bowls' ||
                window.GAIP_STATE?.turf?.cotula === true) {
                return 'bowling_greens';
            }

            // Primary: GAIP_STATE.soil.surfaceType
            if (window.GAIP_STATE?.soil?.surfaceType) {
                const st = window.GAIP_STATE.soil.surfaceType;
                // Map cotula_bowling_green in case flag wasn't set
                if (st === 'cotula_bowling_green') return 'bowling_greens';
                return st;
            }
            
            // Fallback: turf profile subCategory
            if (window.GaipTurfProfile?.state?.subCategory) {
                return window.GaipTurfProfile.state.subCategory;
            }
            if (window.gaipTurfProfile?.state?.subCategory) {
                return window.gaipTurfProfile.state.subCategory;
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
        getMethodology: function(calendarData) {
            // b35fix276: extended fallback chain — calendarData available at render time
            // so we can read extractant/methodology directly from soil data.

            // 1. GAIP_STATE (most authoritative — set by orchestrator)
            if (window.GAIP_STATE?.soil?.methodology) {
                const m = window.GAIP_STATE.soil.methodology;
                if (m === 'cotula_s78' || m === 'cotula') return 'ammonium_acetate';
                return m;
            }

            // 2. Cotula turfType
            if (window.GAIP_STATE?.turf?.cotula === true ||
                window.GaipTurfProfile?.state?.turfType === 'bowls') {
                return 'ammonium_acetate';
            }

            // 3. calendarData soil methodology/extractant (passed at render time)
            if (calendarData && calendarData.soil) {
                const m = calendarData.soil.methodology || calendarData.soil.extractant;
                if (m) {
                    if (m === 'cotula_s78' || m === 'cotula') return 'ammonium_acetate';
                    return m;
                }
            }

            // 4. GAIP_CANONICAL_STATE (populated by orchestrator before programmes tab renders)
            if (window.GAIP_CANONICAL_STATE?.soil?.methodology) {
                const m = window.GAIP_CANONICAL_STATE.soil.methodology;
                if (m === 'cotula_s78' || m === 'cotula') return 'ammonium_acetate';
                return m;
            }

            // 5. DOM methodology selector
            const methodSelect = document.querySelector('[name="methodology"]') ||
                                 document.querySelector('.gaip-soil-methodology') ||
                                 document.querySelector('#gaip-methodology');
            if (methodSelect?.value) return methodSelect.value;

            // 6. Active sample extractant from SampleManager
            try {
                const SM = window.GAIP_SampleManager;
                if (SM && typeof SM.getActiveSample === 'function') {
                    const s = SM.getActiveSample('soil');
                    if (s && s.extractant) return s.extractant;
                }
            } catch(e) {}

            return 'mlsn'; // genuine default when no methodology is set
        },
        
        /**
         * Generate product program from calendar data
         */
        generateAndRender: function(calendarData) {
            const context = {
                surfaceType: this.getSurfaceType(),
                methodology: this.getMethodology(calendarData), // b35fix276: pass calendarData for fallback
            };

            // b35fix266: Run Mulder's interaction analysis on soil ppm data before
            // generating the programme. Flags feed into product scoring via muldersFlags
            // in the options object passed to generateAnnualProgram.
            // Methodology-aware: AA values are converted cmol/kg -> mg/kg inside GilbaMulders.
            var _muldersFlags = {};
            if (window.GilbaMulders) {
                try {
                    // b35fix284: read from active soil sample directly via SampleManager.
                    // calendarData.soil.ppm is populated by syncSoilFromDOM which reads DOM
                    // inputs — those are absent on the Programmes tab, yielding all zeros.
                    // The active sample has the real lab values regardless of which tab is active.
                    var _mNutrients = [];
                    var _soilSrc = null;

                    // Priority 1: active soil sample from SampleManager
                    var _SM = window.GAIP_SampleManager;
                    if (_SM && typeof _SM.getActiveSample === 'function') {
                        _soilSrc = _SM.getActiveSample('soil');
                    }

                    if (_soilSrc) {
                        // Sample structure: { id, label, date, rawData, normalized: {P, K, Fe, Mn...} }
                        // normalized has clean symbol keys (Fe, Mn etc) — use this for ratio checks
                        var _normData = _soilSrc.normalized || _soilSrc.rawData || {};
                        Object.keys(_normData).forEach(function(sym) {
                            var val = parseFloat(_normData[sym]);
                            if (!isNaN(val) && val > 0) {
                                _mNutrients.push({ nutrient: sym, actual: val });
                            }
                        });
                    }

                    // Priority 2: calendarData.soil.ppm fallback (non-zero values only)
                    if (_mNutrients.length === 0 && calendarData && calendarData.soil && calendarData.soil.ppm) {
                        Object.keys(calendarData.soil.ppm).forEach(function(sym) {
                            var val = parseFloat(calendarData.soil.ppm[sym]);
                            if (!isNaN(val) && val > 0) {
                                _mNutrients.push({ nutrient: sym, actual: val });
                            }
                        });
                    }
                    if (_mNutrients.length > 0) {
                        var _mContext = {
                            methodology: context.methodology || 'mlsn',
                            soilPH: (calendarData.soil.pH_water || calendarData.soil.pH_cacl2 || calendarData.soil.pH || null),
                            // b35fix267: extractant for P-ratio incompatibility check
                            extractant: (calendarData.soil.extractant || calendarData.soil.methodology || null),
                        };
                        var _mResult = window.GilbaMulders.analyse(_mNutrients, _mContext);
                        _muldersFlags = _mResult.flags || {};
                        console.log('[NutritionAuFertiliserIntegration] Mulder flags:', Object.keys(_muldersFlags));
                    }
                } catch(e) {
                    console.warn('[NutritionAuFertiliserIntegration] Mulder analysis failed:', e);
                }
            }
            
            
            try {
                context.muldersFlags = _muldersFlags;
                const program = this.generateProgram(calendarData, context);
                
                if (program.error) {
                    console.error('[NutritionAuFertiliserIntegration]', program.error);
                    return;
                }
                
                this.lastProgram = program;
                
                // v10.3.38: Store program globally for Word export, tagged with site
                program._generatedForSite = (window.GAIP_SampleManager && window.GAIP_SampleManager.getActiveSiteId) 
                    ? window.GAIP_SampleManager.getActiveSiteId() : 'unknown';
                window.GAIP_NUTRITION_PROGRAM = program;
                
                this.renderProductRecommendations(program);
                
                // Dispatch event for other modules (Word export, etc.)
                document.dispatchEvent(new CustomEvent('gaip:au-fertiliser-program-generated', {
                    detail: { program: program, context: context }
                }));
                
            } catch (error) {
                console.error('[NutritionAuFertiliserIntegration] Error generating program:', error);
            }
        },
        
        /**
         * Generate full program from calendar data
         * Uses intelligent release-duration tracking
         */
        generateProgram: function(calendarData, context) {
            if (!calendarData || !calendarData.program?.monthly) {
                return { error: 'Invalid calendar data' };
            }
            
            const monthly = calendarData.program.monthly;
            const surfaceType = context.surfaceType || 'sports';
            const methodology = context.methodology || 'mlsn';
            const distributorFilter = this.selectedDistributor || 'all';
            
            // Use new annual program generator if available
            if (window.AuFertiliserRecommender.generateAnnualProgram) {
                const program = window.AuFertiliserRecommender.generateAnnualProgram(monthly, {
                    surfaceType: surfaceType,
                    methodology: methodology,
                    distributorFilter: distributorFilter,
                    muldersFlags: context.muldersFlags || {},
                });
                
                // Add product usage summary
                const productUsage = {};
                program.monthly.forEach(m => {
                    m.granular.forEach(p => {
                        if (!productUsage[p.id]) {
                            productUsage[p.id] = {
                                product: p,
                                brandName: p.brand,
                                applications: 0,
                                totalKgHa: 0,
                                totalDelivered: { N: 0, P: 0, K: 0 },
                            };
                        }
                        productUsage[p.id].applications++;
                        productUsage[p.id].totalKgHa += p.rateKgHa;
                        productUsage[p.id].totalDelivered.N += p.delivers.N;
                        productUsage[p.id].totalDelivered.P += p.delivers.P;
                        productUsage[p.id].totalDelivered.K += p.delivers.K;
                    });
                    m.liquid.forEach(p => {
                        if (!productUsage[p.id]) {
                            productUsage[p.id] = {
                                product: p,
                                brandName: p.brand,
                                applications: 0,
                                totalLHa: 0,
                                totalDelivered: { N: 0, P: 0, K: 0 },
                            };
                        }
                        productUsage[p.id].applications++;
                        // b35fix282: solubles use kg/ha not L/ha — track separately
                        if (p.form === 'soluble') {
                            productUsage[p.id].totalKgHa = (productUsage[p.id].totalKgHa || 0) + (p.rateLHa || 0);
                        } else {
                            productUsage[p.id].totalLHa = (productUsage[p.id].totalLHa || 0) + (p.rateLHa || 0);
                        }
                        productUsage[p.id].totalDelivered.N += p.delivers.N;
                        productUsage[p.id].totalDelivered.P += p.delivers.P;
                        productUsage[p.id].totalDelivered.K += p.delivers.K;
                    });
                });
                
                return {
                    meta: program.meta,
                    monthly: program.monthly,
                    annualSummary: { products: productUsage },
                    targets: program.targets,
                    delivered: program.delivered,
                    balance: program.balance,
                    deficits: calendarData.soil?.deficits || {},
                    muldersFlags: context.muldersFlags || {}, // b35fix276: surface flags for UI rendering
                };
            }
            
            // Fallback to old monthly method
            console.warn('[NutritionAuFertiliserIntegration] Falling back to legacy monthly generation');
            return this.generateProgramLegacy(calendarData, context);
        },
        
        /**
         * Legacy program generation (deprecated)
         */
        generateProgramLegacy: function(calendarData, context) {
            const monthly = calendarData.program.monthly;
            const surfaceType = context.surfaceType || 'sports';
            const methodology = context.methodology || 'mlsn';
            const deficits = calendarData.soil?.deficits || {};
            
            const programMonths = [];
            const productUsage = {};
            
            monthly.forEach((month, idx) => {
                // Skip minimal months
                if (month.N < 2 && month.K < 2) {
                    programMonths.push({
                        month_name: month.month_name,
                        season: month.season,
                        gp: month.gp,
                        requirements: { N: month.N, P: month.P, K: month.K },
                        granular: [],
                        notes: ['Minimal nutrient requirements - no application recommended'],
                    });
                    return;
                }
                
                // Get recommendation for this month
                const rec = window.AuFertiliserRecommender.getMonthlyRecommendation(month, {
                    surfaceType: surfaceType,
                    methodology: methodology,
                });
                
                const granularProducts = [];
                const notes = [];
                
                if (rec.product) {
                    const p = rec.product;
                    const brandName = window.AuFertiliserProducts.brands[p.brand]?.name || p.brand;
                    
                    granularProducts.push({
                        id: p.id,
                        name: p.name,
                        brand: brandName,
                        npk: `${p.analysis.N || 0}-${p.analysis.P || 0}-${p.analysis.K || 0}`,
                        rateKgHa: rec.rateKgHa,
                        rateGM2: Math.round(rec.rateKgHa / 10), // kg/ha to g/m²
                        delivers: rec.delivers,
                        notes: p.notes || '',
                    });
                    
                    // Track usage
                    if (!productUsage[p.id]) {
                        productUsage[p.id] = {
                            product: p,
                            brandName: brandName,
                            applications: 0,
                            totalKgHa: 0,
                        };
                    }
                    productUsage[p.id].applications++;
                    productUsage[p.id].totalKgHa += rec.rateKgHa;
                }
                
                // Add notes for special conditions
                if (month.gp < 0.15) {
                    notes.push('Low growth potential - consider skipping or reducing rate');
                }
                if (deficits.K > 30 && (rec.product?.analysis?.K || 0) < 15) {
                    notes.push('K deficit detected - consider supplemental K application');
                }
                
                programMonths.push({
                    month_name: month.month_name,
                    season: month.season,
                    gp: month.gp,
                    requirements: { N: month.N, P: month.P, K: month.K },
                    granular: granularProducts,
                    liquid: [], // Future: add liquid products
                    notes: notes,
                });
            });
            
            // Build annual summary
            const annualSummary = {
                products: productUsage,
                totalApplications: Object.values(productUsage).reduce((sum, p) => sum + p.applications, 0),
            };
            
            return {
                meta: {
                    surfaceType: surfaceType,
                    methodology: methodology,
                    generated: new Date().toISOString(),
                    region: 'australia',
                },
                monthly: programMonths,
                annualSummary: annualSummary,
                deficits: deficits,
            };
        },
        
        /**
         * Render product recommendations UI
         */
        renderProductRecommendations: function(program) {
            // Find or create the container
            let container = document.querySelector('[data-au-fertiliser-recommendations]');
            
            if (!container) {
                // Create container after calendar results
                const calendarResults = document.querySelector('[data-nutrition-results]');
                if (calendarResults) {
                    container = document.createElement('div');
                    container.setAttribute('data-au-fertiliser-recommendations', '');
                    container.className = 'gilba-au-fertiliser-recommendations';
                    calendarResults.appendChild(container);
                }
            }
            
            if (!container) {
                console.warn('[NutritionAuFertiliserIntegration] No container found for recommendations');
                return;
            }
            
            // Render
            container.innerHTML = this.buildRecommendationsHTML(program);
            
            // Bind distributor dropdown event
            this.bindDistributorDropdown();
        },
        
        /**
         * Bind event listener to distributor dropdown
         * Regenerates program when selection changes
         */
        bindDistributorDropdown: function() {
            const select = document.getElementById('au-fert-distributor-select');
            if (!select) return;
            
            select.addEventListener('change', (e) => {
                const newDistributor = e.target.value;
                
                this.selectedDistributor = newDistributor;
                
                // Regenerate with new filter using cached calendar data
                if (this.lastCalendarData) {
                    this.generateAndRender(this.lastCalendarData);
                } else {
                    // Fallback: try to get from calendar
                    const calendar = window.GilbaNutritionCalendar;
                    if (calendar?.program) {
                        this.generateAndRender(calendar.program);
                    }
                }
            });
        },
        
        /**
         * Build HTML for product recommendations
         */
        buildRecommendationsHTML: function(program) {
            const meta = program.meta;
            const monthly = program.monthly;
            const summary = program.annualSummary;
            
            // ================================================================
            // Use pre-calculated totals if available (from new generator)
            // Otherwise calculate from monthly data
            // ================================================================
            let nutrientTotals, nutrientRequired;
            
            if (program.delivered && program.targets) {
                // New format with pre-calculated values
                nutrientTotals = { ...program.delivered };
                nutrientRequired = { ...program.targets };
            } else {
                // Calculate from monthly data
                nutrientTotals = { N: 0, P: 0, K: 0 };
                nutrientRequired = { N: 0, P: 0, K: 0 };
                
                monthly.forEach(m => {
                    nutrientRequired.N += m.requirements?.N || 0;
                    nutrientRequired.P += m.requirements?.P || 0;
                    nutrientRequired.K += m.requirements?.K || 0;
                    
                    m.granular.forEach(p => {
                        if (p.delivers) {
                            nutrientTotals.N += p.delivers.N || 0;
                            nutrientTotals.P += p.delivers.P || 0;
                            nutrientTotals.K += p.delivers.K || 0;
                        } else {
                            const rate = p.rateKgHa || 0;
                            const analysis = p.product?.analysis || p.analysis || {};
                            nutrientTotals.N += rate * (analysis.N || 0) / 100;
                            nutrientTotals.P += rate * (analysis.P || 0) / 100;
                            nutrientTotals.K += rate * (analysis.K || 0) / 100;
                        }
                    });
                    
                    (m.liquid || []).forEach(p => {
                        if (p.delivers) {
                            nutrientTotals.N += p.delivers.N || 0;
                            nutrientTotals.P += p.delivers.P || 0;
                            nutrientTotals.K += p.delivers.K || 0;
                        }
                    });
                });
            }
            
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
                const statusColor = pct >= 90 ? '#059669' : pct >= 70 ? '#d97706' : '#dc2626';
                return `
                    <tr>
                        <td style="padding: 8px; border: 1px solid var(--gaip-border);"><strong>${nutrient}</strong></td>
                        <td style="padding: 8px; border: 1px solid var(--gaip-border); text-align: right;">${required}</td>
                        <td style="padding: 8px; border: 1px solid var(--gaip-border); text-align: right;">${delivered}</td>
                        <td style="padding: 8px; border: 1px solid var(--gaip-border); text-align: right; color: ${diff >= 0 ? '#059669' : '#dc2626'}; font-weight: 600;">${diff >= 0 ? '+' : ''}${diff.toFixed(1)}</td>
                        <td style="padding: 8px; border: 1px solid var(--gaip-border); text-align: center; color: ${statusColor}; font-weight: 600;">${statusIcon} ${pct}%</td>
                    </tr>
                `;
            }).join('');
            
            // Build monthly rows
            // Check surface type for units
            const useGM2 = meta.useGM2 || ['greens', 'golf_greens', 'bowling_greens', 'tees', 'cricket_wickets'].includes(meta.surfaceType);
            
            const monthlyRows = monthly.map(m => {
                const granularList = m.granular.map(p => {
                    // Use appropriate unit based on surface
                    const rateStr = p.rateDisplay 
                        ? `${p.rateDisplay.value} ${p.rateDisplay.unit}`
                        : (useGM2 ? `${p.rateGM2}g/m²` : `${p.rateKgHa}kg/ha`);
                    const releaseTag = p.release === 'slow' || p.release === 'controlled' 
                        ? ` <span style="font-size: 10px; padding: 1px 4px; background: var(--gaip-info-bg); color: #1e40af; border-radius: 3px;">${p.release?.toUpperCase()}</span>` 
                        : '';
                    return `<span class="au-fert-product" title="${p.notes || ''}">${p.name} (${p.npk}) @ ${rateStr}${releaseTag}</span>`;
                }).join(' + ') || '<span class="au-fert-none">—</span>';
                
                const liquidList = m.liquid?.map(p => {
                    // b35fix282: use pre-formatted rate string (includes applications count if >1)
                    // rateUnit is 'kg/ha' for solubles, 'L/ha' for true liquids
                    const rateStr = p.rate || (p.rateLHa ? `${p.rateLHa} ${p.rateUnit || (p.form === 'soluble' ? 'kg/ha' : 'L/ha')}` : '—');
                    return `<span class="au-fert-product liquid" title="${p.notes || ''}">${p.name} @ ${rateStr}</span>`;
                }).join(' + ') || '';
                
                // Build notes with active nutrients if present
                let notesArr = [...(m.notes || [])];
                if (m.activeFromPrevious && (m.activeFromPrevious.N > 0.5 || m.activeFromPrevious.K > 0.5)) {
                    notesArr.unshift(`Active from previous: N:${Math.round(m.activeFromPrevious.N)} K:${Math.round(m.activeFromPrevious.K)}`);
                }
                
                const notesHtml = notesArr.length > 0 
                    ? `<div class="au-fert-notes">${notesArr.join('. ')}</div>` 
                    : '';
                
                const gpClass = m.gp >= 0.5 ? 'high' : (m.gp >= 0.25 ? 'medium' : 'low');
                
                return `
                    <tr class="gp-${gpClass}">
                        <td style="padding: 8px; border: 1px solid var(--gaip-border); font-weight: 500;">${m.month_name}</td>
                        <td style="padding: 8px; border: 1px solid var(--gaip-border);">${m.season}</td>
                        <td style="padding: 8px; border: 1px solid var(--gaip-border);">
                            <span class="au-fert-req">N:${Math.round(m.requirements.N)} P:${Math.round(m.requirements.P)} K:${Math.round(m.requirements.K)}</span>
                        </td>
                        <td style="padding: 8px; border: 1px solid var(--gaip-border);">${granularList}</td>
                        <td style="padding: 8px; border: 1px solid var(--gaip-border);">${liquidList || '—'}</td>
                    </tr>
                    ${notesHtml ? `<tr class="au-fert-note-row"><td colspan="5" style="padding: 4px 8px; background: #fffde7; border: 1px solid var(--gaip-border); font-size: 12px; font-style: italic;">${notesHtml}</td></tr>` : ''}
                `;
            }).join('');
            
            // Build product summary with NPK delivered
            const productEntries = Object.values(summary.products);
            // useGM2 already declared above for monthly rows
            
            const summaryRows = productEntries.map(p => {
                const product = p.product || {};
                const analysis = product.analysis || {};
                const npk = product.npk || `${analysis.N || 0}-${analysis.P || 0}-${analysis.K || 0}`;
                
                // Use pre-calculated delivered values if available
                const nDelivered = p.totalDelivered?.N ?? Math.round((p.totalKgHa || 0) * (analysis.N || 0) / 100);
                const pDelivered = p.totalDelivered?.P ?? Math.round((p.totalKgHa || 0) * (analysis.P || 0) / 100 * 10) / 10;
                const kDelivered = p.totalDelivered?.K ?? Math.round((p.totalKgHa || 0) * (analysis.K || 0) / 100);
                
                // Format rate based on surface type and product type
                // b35fix281: solubles are powders — always kg/ha, never L/ha
                const isSoluble = product && product.form === 'soluble';
                let rateStr;
                if (p.totalLHa && !isSoluble) {
                    rateStr = `${Math.round(p.totalLHa)} L/ha`;
                } else if (useGM2 && !isSoluble) {
                    rateStr = `${Math.round((p.totalKgHa || 0) / 10 * 10) / 10} g/m²`;
                } else {
                    rateStr = `${Math.round(p.totalKgHa || 0)} kg/ha`;
                }
                
                return `
                    <tr>
                        <td style="padding: 8px; border: 1px solid var(--gaip-border);">
                            <strong>${product.name || p.brandName}</strong>
                            <div style="font-size: 11px; color: var(--gaip-text-secondary);">Analysis: ${npk}</div>
                        </td>
                        <td style="padding: 8px; border: 1px solid var(--gaip-border); text-align: center;">${p.applications}</td>
                        <td style="padding: 8px; border: 1px solid var(--gaip-border); text-align: right;">${rateStr}</td>
                        <td style="padding: 8px; border: 1px solid var(--gaip-border); text-align: right; font-family: monospace; font-size: 12px;">${Math.round(nDelivered)}</td>
                        <td style="padding: 8px; border: 1px solid var(--gaip-border); text-align: right; font-family: monospace; font-size: 12px;">${Math.round(pDelivered * 10) / 10}</td>
                        <td style="padding: 8px; border: 1px solid var(--gaip-border); text-align: right; font-family: monospace; font-size: 12px;">${Math.round(kDelivered)}</td>
                    </tr>
                `;
            }).join('');
            
            // Total row with units based on surface
            const totalKgHa = productEntries.reduce((sum, p) => sum + (p.totalKgHa || 0), 0);
            const totalLHa = productEntries.reduce((sum, p) => sum + (p.totalLHa || 0), 0);
            const totalApps = productEntries.reduce((sum, p) => sum + (p.applications || 0), 0);
            
            let totalRateStr = '';
            if (totalKgHa > 0) {
                totalRateStr = useGM2 ? `${Math.round(totalKgHa / 10 * 10) / 10} g/m²` : `${Math.round(totalKgHa)} kg/ha`;
            }
            if (totalLHa > 0) {
                totalRateStr += (totalRateStr ? ' + ' : '') + `${Math.round(totalLHa)} L/ha`;
            }
            
            const balanceN = nutrientTotals.N - nutrientRequired.N;
            const balanceP = nutrientTotals.P - nutrientRequired.P;
            const balanceK = nutrientTotals.K - nutrientRequired.K;
            
            const totalRow = `
                <tr style="background: var(--gaip-good-bg); font-weight: 600;">
                    <td style="padding: 8px; border: 1px solid var(--gaip-border);">TOTAL DELIVERED</td>
                    <td style="padding: 8px; border: 1px solid var(--gaip-border); text-align: center;">${totalApps}</td>
                    <td style="padding: 8px; border: 1px solid var(--gaip-border); text-align: right;">${totalRateStr}</td>
                    <td style="padding: 8px; border: 1px solid var(--gaip-border); text-align: right; font-family: monospace;">${Math.round(nutrientTotals.N)}</td>
                    <td style="padding: 8px; border: 1px solid var(--gaip-border); text-align: right; font-family: monospace;">${Math.round(nutrientTotals.P * 10) / 10}</td>
                    <td style="padding: 8px; border: 1px solid var(--gaip-border); text-align: right; font-family: monospace;">${Math.round(nutrientTotals.K)}</td>
                </tr>
                <tr style="background: var(--gaip-surface-muted);">
                    <td style="padding: 8px; border: 1px solid var(--gaip-border);" colspan="3"><em>Required (kg/ha)</em></td>
                    <td style="padding: 8px; border: 1px solid var(--gaip-border); text-align: right; font-family: monospace;"><em>${Math.round(nutrientRequired.N)}</em></td>
                    <td style="padding: 8px; border: 1px solid var(--gaip-border); text-align: right; font-family: monospace;"><em>${Math.round(nutrientRequired.P * 10) / 10}</em></td>
                    <td style="padding: 8px; border: 1px solid var(--gaip-border); text-align: right; font-family: monospace;"><em>${Math.round(nutrientRequired.K)}</em></td>
                </tr>
                <tr style="background: ${balanceN >= 0 ? 'var(--gaip-good-bg)' : 'var(--gaip-critical-bg)'};">
                    <td style="padding: 8px; border: 1px solid var(--gaip-border);" colspan="3"><strong>Balance</strong></td>
                    <td style="padding: 8px; border: 1px solid var(--gaip-border); text-align: right; font-family: monospace; color: ${balanceN >= 0 ? '#059669' : '#dc2626'};">
                        <strong>${balanceN >= 0 ? '+' : ''}${Math.round(balanceN)}</strong>
                    </td>
                    <td style="padding: 8px; border: 1px solid var(--gaip-border); text-align: right; font-family: monospace; color: ${balanceP >= 0 ? '#059669' : '#dc2626'};">
                        <strong>${balanceP >= 0 ? '+' : ''}${Math.round(balanceP * 10) / 10}</strong>
                    </td>
                    <td style="padding: 8px; border: 1px solid var(--gaip-border); text-align: right; font-family: monospace; color: ${balanceK >= 0 ? '#059669' : '#dc2626'};">
                        <strong>${balanceK >= 0 ? '+' : ''}${Math.round(balanceK)}</strong>
                    </td>
                </tr>
            `;
            
            // Build distributor dropdown options (filtered by detected state)
            const detectedState = this.getDetectedState();
            const distributorOptions = window.AuFertiliserRecommender.getDistributorOptions?.(detectedState) || [
                { value: 'all', label: 'All Products (best match)' }
            ];
            const distributorOptionsHtml = distributorOptions.map(opt => 
                `<option value="${opt.value}" ${opt.value === this.selectedDistributor ? 'selected' : ''}>${opt.label}</option>`
            ).join('');
            
            // Get current distributor display label
            const currentDistributorLabel = this.selectedDistributor === 'all' 
                ? '' 
                : distributorOptions.find(o => o.value === this.selectedDistributor)?.label || this.selectedDistributor;
            
            return `
                <div class="gilba-au-fert-panel">
                    <h3 style="margin: 0 0 1rem 0; color: #b45309; font-size: 1.25rem; display: flex; align-items: center; gap: 8px;">
                        <span style="font-size: 24px;">🇦🇺</span>
                        Australian Fertiliser Recommendations
                    </h3>
                    
                    <div class="au-fert-supplier-filter" style="margin-bottom: 1rem; padding: 0.75rem; background: var(--gaip-warning-bg); border: 1px solid var(--gaip-warning-border); border-radius: 6px;">
                        <label style="display: flex; align-items: center; gap: 0.75rem; flex-wrap: wrap;">
                            <strong style="white-space: nowrap;">Supplier:</strong>
                            <select id="au-fert-distributor-select" 
                                    style="flex: 1; min-width: 200px; max-width: 400px; padding: 0.5rem; border: 1px solid var(--gaip-border); border-radius: 4px; font-size: 0.9rem; background: var(--gaip-surface);">
                                ${distributorOptionsHtml}
                            </select>
                            <span style="font-size: 0.8rem; color: var(--gaip-text);">
                                ${this.selectedDistributor === 'all' 
                                    ? 'Recommending best products across all distributors' 
                                    : `Showing only ${currentDistributorLabel} products`}
                            </span>
                        </label>
                    </div>
                    
                    <div class="au-fert-meta" style="display: flex; gap: 1.5rem; padding: 0.75rem; background: var(--gaip-warning-bg); border-radius: 4px; font-size: 0.9rem; margin-bottom: 1rem;">
                        <span class="meta-item">
                            <strong>Surface:</strong> ${this.formatSurfaceType(meta.surfaceType)}
                        </span>
                        <span class="meta-item">
                            <strong>Methodology:</strong> ${meta.methodology.toUpperCase()}
                        </span>
                        ${this.selectedDistributor !== 'all' ? `
                        <span class="meta-item" style="color: #b45309;">
                            <strong>Supplier:</strong> ${this.selectedDistributor}
                        </span>
                        ` : ''}
                    </div>
                    
                    ${(function() {
                        // b35fix284: flags is keyed by suppressed nutrient (e.g. "Mn"),
                        // each value is an array of flag objects with ratio, message, detail, citation.
                        const flags = program.muldersFlags || {};
                        // Flatten to array of individual flag objects
                        const allFlags = [];
                        Object.keys(flags).forEach(function(sym) {
                            const arr = Array.isArray(flags[sym]) ? flags[sym] : [flags[sym]];
                            arr.forEach(function(f) { if (f) allFlags.push(f); });
                        });
                        if (allFlags.length === 0) return '';
                        const rows = allFlags.map(function(f) {
                            const sev = f.severity === 'high' ? '#dc2626' : f.severity === 'moderate' ? '#d97706' : '#6b7280';
                            const ratio = f.ratio || (f.suppressor + ':' + f.suppressed);
                            const pair = f.suppressor + ' → ' + f.suppressed;
                            const ratioVal = f.value ? f.value.toFixed(1) : '—';
                            return '<div style="display:flex;align-items:flex-start;gap:10px;padding:8px 0;border-bottom:1px solid #e5e7eb;">' +
                                '<span style="font-size:16px;line-height:1.2;">⚡</span>' +
                                '<div style="flex:1;">' +
                                    '<span style="font-weight:600;color:' + sev + ';">' + pair + '</span>' +
                                    '<span style="margin-left:8px;font-size:11px;color:#6b7280;">ratio: ' + ratioVal + ' (threshold: ' + f.threshold + ')</span>' +
                                    '<div style="font-size:12px;color:#374151;margin-top:2px;">' + (f.message || '') + '</div>' +
                                    (f.citation ? '<div style="font-size:10px;color:#9ca3af;margin-top:2px;">📖 ' + f.citation + '</div>' : '') +
                                '</div>' +
                            '</div>';
                        }).join('');
                        const count = allFlags.length;
                        return '<div style="margin:0 0 1.25rem 0;padding:0.75rem 1rem;background:#fefce8;border:1px solid #fde047;border-left:4px solid #ca8a04;border-radius:6px;">' +
                            '<div style="font-weight:600;color:#92400e;margin-bottom:8px;font-size:0.9rem;">⚗️ Mulder\'s Nutrient Interactions Detected — ' + count + ' interaction' + (count > 1 ? 's' : '') + '</div>' +
                            '<div style="font-size:11px;color:#78350f;margin-bottom:8px;">Product selection has been adjusted to avoid aggravating the following antagonisms. Ref: Marschner (2012), Havlin et al. (2014).</div>' +
                            rows +
                        '</div>';
                    }).call(this)}
                    
                    <h4 style="margin: 1.5rem 0 0.75rem 0; font-size: 1rem; border-bottom: 1px solid var(--gaip-border); padding-bottom: 0.5rem;">Monthly Program</h4>
                    <div class="gilba-table-scroll" style="overflow-x: auto;">
                        <table class="gilba-calendar-table au-fert-program-table" style="width: 100%; border-collapse: collapse; font-size: 13px;">
                            <thead>
                                <tr style="background: var(--gaip-surface-hover);">
                                    <th style="padding: 8px; text-align: left; border: 1px solid var(--gaip-border);">Month</th>
                                    <th style="padding: 8px; text-align: left; border: 1px solid var(--gaip-border);">Season</th>
                                    <th style="padding: 8px; text-align: left; border: 1px solid var(--gaip-border);">Requirements</th>
                                    <th style="padding: 8px; text-align: left; border: 1px solid var(--gaip-border);">Granular Products</th>
                                    <th style="padding: 8px; text-align: left; border: 1px solid var(--gaip-border);">Liquid/Foliar</th>
                                </tr>
                            </thead>
                            <tbody>
                                ${monthlyRows}
                            </tbody>
                        </table>
                    </div>
                    
                    ${productEntries.length > 0 ? `
                        <h4 style="margin: 1.5rem 0 0.75rem 0; font-size: 1rem; border-bottom: 1px solid var(--gaip-border); padding-bottom: 0.5rem;">Nutrient Delivery Summary</h4>
                        <table class="gilba-totals-table au-fert-nutrient-summary" style="width: 100%; max-width: 500px; border-collapse: collapse; font-size: 13px; margin-bottom: 1.5rem;">
                            <thead>
                                <tr style="background: var(--gaip-surface-hover);">
                                    <th style="padding: 8px; text-align: left; border: 1px solid var(--gaip-border);">Nutrient</th>
                                    <th style="padding: 8px; text-align: right; border: 1px solid var(--gaip-border);">Required (kg/ha)</th>
                                    <th style="padding: 8px; text-align: right; border: 1px solid var(--gaip-border);">Delivered (kg/ha)</th>
                                    <th style="padding: 8px; text-align: right; border: 1px solid var(--gaip-border);">Balance</th>
                                    <th style="padding: 8px; text-align: center; border: 1px solid var(--gaip-border);">Status</th>
                                </tr>
                            </thead>
                            <tbody>
                                ${nutrientSummaryRows}
                            </tbody>
                        </table>
                        
                        <h4 style="margin: 1.5rem 0 0.75rem 0; font-size: 1rem; border-bottom: 1px solid var(--gaip-border); padding-bottom: 0.5rem;">Annual Product Summary</h4>
                        <table class="gilba-totals-table au-fert-summary-table" style="width: 100%; max-width: 700px; border-collapse: collapse; font-size: 13px;">
                            <thead>
                                <tr style="background: var(--gaip-surface-hover);">
                                    <th style="padding: 8px; text-align: left; border: 1px solid var(--gaip-border);">Product</th>
                                    <th style="padding: 8px; text-align: center; border: 1px solid var(--gaip-border);">Applications</th>
                                    <th style="padding: 8px; text-align: right; border: 1px solid var(--gaip-border);">Total Rate</th>
                                    <th style="padding: 8px; text-align: right; border: 1px solid var(--gaip-border);">N</th>
                                    <th style="padding: 8px; text-align: right; border: 1px solid var(--gaip-border);">P</th>
                                    <th style="padding: 8px; text-align: right; border: 1px solid var(--gaip-border);">K</th>
                                </tr>
                                <tr style="background: var(--gaip-surface-muted);">
                                    <th colspan="3" style="padding: 2px 8px; text-align: right; border: 1px solid var(--gaip-border); font-weight: 400; font-size: 11px; color: var(--gaip-text-secondary);"></th>
                                    <th colspan="3" style="padding: 2px 8px; text-align: center; border: 1px solid var(--gaip-border); font-weight: 400; font-size: 11px; color: var(--gaip-text-secondary);">kg/ha delivered</th>
                                </tr>
                            </thead>
                            <tbody>
                                ${summaryRows}
                                ${totalRow}
                            </tbody>
                        </table>
                    ` : ''}
                    
                    <div class="au-fert-disclaimer" style="margin-top: 1.5rem; padding: 0.75rem; background: var(--gaip-warning-bg); border-left: 3px solid #f59e0b; font-size: 0.85rem; color: var(--gaip-text);">
                        <strong>Note:</strong> These recommendations are based on nutrient requirements 
                        calculated from ${meta.methodology.toUpperCase()} methodology. ${this.selectedDistributor === 'all' 
                            ? 'Products are selected from all Australian distributors for best agronomic fit. Use the Supplier dropdown to filter to a single distributor if you prefer consolidated ordering.' 
                            : `Products filtered to ${this.selectedDistributor} range only. Select "All Products" for best-match recommendations across distributors.`}
                        Actual rates may need adjustment based on site conditions, weather, and turf response. 
                        Always verify SGN compatibility with your spreader settings.
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
        .gilba-au-fertiliser-recommendations {
            margin-top: 2rem;
        }
        
        .gilba-au-fert-panel {
            background: var(--gaip-surface);
            border: 1px solid var(--gaip-border);
            border-radius: 8px;
            padding: 1.5rem;
        }
        
        .au-fert-program-table .au-fert-product {
            display: inline-block;
            background: var(--gaip-warning-bg);
            padding: 2px 8px;
            border-radius: 4px;
            margin: 2px;
            font-size: 0.85rem;
        }
        
        .au-fert-program-table .au-fert-product.liquid {
            background: var(--gaip-info-bg);
        }
        
        .au-fert-program-table .au-fert-none {
            color: var(--gaip-text-muted);
        }
        
        .au-fert-program-table .au-fert-req {
            font-family: monospace;
            font-size: 0.85rem;
            white-space: nowrap;
        }
        
        .au-fert-note-row td {
            padding: 0.25rem 0.5rem !important;
            background: #fffde7 !important;
            font-size: 0.85rem;
            font-style: italic;
        }
        
        .au-fert-notes {
            color: #b45309;
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
    window.NutritionAuFertiliserIntegration = NutritionAuFertiliserIntegration;
    
    // Also expose via GAIP namespace
    window.GAIP_NUTRITION_AU_FERTILISER = NutritionAuFertiliserIntegration;

    // Auto-init when DOM ready
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', () => NutritionAuFertiliserIntegration.init());
    } else {
        NutritionAuFertiliserIntegration.init();
    }

})();

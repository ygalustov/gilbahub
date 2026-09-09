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
 * @version 1.0.1
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

            // GH-321: "late-render" catch-up -- if the calendar's program
            // was already restored (NutritionCalendar.restoreFromPersisted(),
            // e.g. on page reload/navigation) before this script finished
            // initialising, the live 'gaip:nutrition-calendar-generated'
            // event above never fires and this region's recommendations
            // panel silently stays empty. Same fix as
            // nutrition-nz-fertiliser-integration.js's init() already has
            // (present there from the start; this file never had it).
            const _existingCalendar = window.GilbaNutritionCalendar;
            if (_existingCalendar && _existingCalendar.program && this.isAustralia()) {
                this.lastCalendarData = _existingCalendar.program;
                setTimeout(() => this.generateAndRender(_existingCalendar.program), 200);
            }
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
            const tpcState  = window.GaipTurfProfile?.state || window.gaipTurfProfile?.state || {};
            const gaipTurf  = window.GAIP_STATE?.turf || {};

            // Cotula/bowls check first
            if (tpcState.cotula === true || gaipTurf.cotula === true ||
                tpcState.turfType === 'bowls' || gaipTurf.turfType === 'bowls' ||
                tpcState.species === 'cotula' || gaipTurf.grassSpecies === 'cotula') {
                return 'bowling_greens';
            }

            // Map turfType + subCategory → canonical surface key.
            // GH-387: this mapping now lives in the shared input adapter
            // (nutrition-program-inputs.js mapSurfaceKey), which the Word
            // export's own recommender call resolves through too — so the Plan
            // page and the export cannot answer this differently for the same
            // site, which is exactly what they were doing (Plan 'golf_greens'
            // vs export 'golf', different products from the same catalogue).
            // The local copy below is the fallback for a page that has not
            // loaded the adapter.
            function _mapTurfType(turfType, subCategory) {
                var _NPI = window.GAIP_NutritionProgramInputs;
                if (_NPI && typeof _NPI.mapSurfaceKey === 'function') {
                    return _NPI.mapSurfaceKey(turfType, subCategory);
                }
                if (!turfType) return null;
                if (turfType === 'golf') {
                    if (subCategory === 'greens') return 'golf_greens';
                    if (subCategory === 'tees')   return 'tees';
                    if (subCategory === 'fairways') return 'fairways';
                    if (subCategory === 'surrounds') return 'fairways';
                    return 'golf_greens';
                }
                if (turfType === 'bowling' || turfType === 'bowls') return 'bowling_greens';
                if (turfType === 'cricket') return 'cricket_wickets';
                if (subCategory) return subCategory;
                return turfType;
            }

            // Primary: legacy turf profile component
            if (tpcState.turfType) {
                return _mapTurfType(tpcState.turfType, tpcState.subCategory);
            }

            // Secondary: GAIP_STATE.turf (set by plan page data bridge)
            if (gaipTurf.turfType) {
                return _mapTurfType(gaipTurf.turfType, gaipTurf.subCategory);
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
        getMethodology: function(calendarData) {
            // b35fix276: extended fallback chain — calendarData available at render time
            // so we can read extractant/methodology directly from soil data.

            // ────────────────────────────────────────────────────────────────
            // b35fix446 / C55: soil methodology read prefers inputs.soil shelf.
            // ────────────────────────────────────────────────────────────────
            // Pre-fix this branch read window.GAIP_STATE.soil.methodology
            // (top-level legacy slot) only. The hub-store proxy synthesiser
            // at gilba-hub-v2.js:1399 auto-aliases inputs.turf to top-level
            // .turf, but does NOT auto-alias inputs.soil to top-level .soil.
            // The flat .soil shelf is only populated by the analysis-end
            // writeback at hub-tissue-v3.js:6966. Canonical writers, including
            // the b35fix443 routed-write helper _b35fix393_setSoilField in
            // assets/ammonium-acetate-methodology.js, all land at
            // GAIP_STATE.inputs.soil.methodology. Pre-b35fix446, on a fresh
            // session or any state where the post-tissue writeback had not
            // run, the flat shelf was undefined and this branch fell through
            // to the cotula heuristic at priority 2, the calendarData read at
            // priority 3, the GAIP_CANONICAL_STATE read at priority 4, the
            // DOM read at priority 5 or the SampleManager read at priority 6,
            // any of which could disagree with the canonical inputs.soil
            // value the user just set in the site-settings panel. Same defect
            // class as the b35fix442 read-shelf asymmetry on the turf axis,
            // but on the soil axis. Per b35fix442 lesson #33 the fix shape
            // is a tolerant read priority chain.
            // 1. GAIP_STATE (most authoritative, set by orchestrator)
            const _b35fix446_soilM = (window.GAIP_STATE && window.GAIP_STATE.inputs && window.GAIP_STATE.inputs.soil && window.GAIP_STATE.inputs.soil.methodology)
                || (window.GAIP_STATE && window.GAIP_STATE.soil && window.GAIP_STATE.soil.methodology)
                || null;
            if (_b35fix446_soilM) {
                const m = _b35fix446_soilM;
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
            // GH-245: calendar.program is null when NutritionCalendar couldn't
            // resolve real monthly climate normals (Hoxton audit D02/D03) —
            // say so in this panel rather than silently doing nothing (or,
            // pre-fix, falling through to generateProgram()'s generic
            // "Invalid calendar data" error with no program ever rendered
            // here). Message kept non-technical — client-facing panel.
            if (!calendarData) {
                const _unavailEl = document.querySelector('[data-au-fertiliser-recommendations]');
                if (_unavailEl) {
                    _unavailEl.style.display = '';
                    _unavailEl.innerHTML = '<div class="gilba-nut-banner gilba-nut-banner--warning">' +
                        '<strong>Climate data unavailable</strong> We couldn\'t load climate data for this site. ' +
                        'Please try again in a moment.' +
                        '</div>';
                }
                return;
            }

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
                var _nc = window.GilbaNutritionCalendar;
                program._generatedForSite = (_nc && _nc.getActiveSiteId && _nc.getActiveSiteId()) || 'unknown';

                // b35fix379 DEBUG: Log GAIP_NUTRITION_PROGRAM assignment
                console.log('[NutritionAuFertiliserIntegration b35fix379] Setting GAIP_NUTRITION_PROGRAM:', {
                    siteId: program._generatedForSite,
                    hasAnnualSummary: !!(program.annualSummary),
                    hasProducts: !!(program.annualSummary && program.annualSummary.products),
                    productCount: program.annualSummary && program.annualSummary.products ? Object.keys(program.annualSummary.products).length : 0,
                    productIds: program.annualSummary && program.annualSummary.products ? Object.keys(program.annualSummary.products) : []
                });
                
                window.GAIP_NUTRITION_PROGRAM = program;
                window.GAIP_NUTRITION_PROGRAM_UNAVAILABLE = false;

                // Persist the generated program to the per-site server config so it
                // survives navigation to Reports > Export, which loads a fresh page
                // (window.GAIP_NUTRITION_PROGRAM would otherwise be empty there).
                if (_nc && typeof _nc.persistSiteConfigPatch === 'function'
                        && program._generatedForSite !== 'unknown') {
                    _nc.persistSiteConfigPatch({ nutritionProgram: program });
                }

                this.renderProductRecommendations(program);

                // Hide competing regional panels
                if (window.NutritionUkFertiliserIntegration && typeof window.NutritionUkFertiliserIntegration.hideRecommendations === 'function') {
                    window.NutritionUkFertiliserIntegration.hideRecommendations();
                }
                if (window.NutritionNzFertiliserIntegration && typeof window.NutritionNzFertiliserIntegration.hideRecommendations === 'function') {
                    window.NutritionNzFertiliserIntegration.hideRecommendations();
                }

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
                // b35fix381 INSTRUMENTATION — log the input monthly profile and
                // resolved options BEFORE calling the recommender, then the
                // resolved product set AFTER. The combined export per-sample
                // path in word-export-combined.js carries an identical block
                // ([CombinedExport b35fix381] tag) so the two side by side
                // show whether the divergence is in inputs or selection.
                console.log('[NutritionAuFertiliserIntegration b35fix381] PRE-recommender input snapshot:', {
                    path: 'live-preview-integration',
                    siteId: (window.GAIP_SampleManager && window.GAIP_SampleManager.getActiveSiteId)
                        ? window.GAIP_SampleManager.getActiveSiteId() : 'unknown',
                    sampleId: (window.GAIP_SampleManager && window.GAIP_SampleManager.getActiveSampleId)
                        ? window.GAIP_SampleManager.getActiveSampleId('soil') : 'unknown',
                    annualK: monthly.reduce(function(s, m) { return s + (m.K || 0); }, 0),
                    annualN: monthly.reduce(function(s, m) { return s + (m.N || 0); }, 0),
                    annualP: monthly.reduce(function(s, m) { return s + (m.P || 0); }, 0),
                    monthlyK: monthly.map(function(m) {
                        return { month: m.month_name || m.month, K: +(m.K || 0).toFixed(2), gp: +(m.gp || 0).toFixed(2) };
                    }),
                    options: {
                        surfaceType: surfaceType,
                        methodology: methodology,
                        distributorFilter: distributorFilter,
                        muldersFlagsCount: Object.keys(context.muldersFlags || {}).length,
                        muldersFlagsKeys: Object.keys(context.muldersFlags || {}),
                    },
                });

                const program = window.AuFertiliserRecommender.generateAnnualProgram(monthly, {
                    surfaceType: surfaceType,
                    methodology: methodology,
                    distributorFilter: distributorFilter,
                    muldersFlags: context.muldersFlags || {},
                });

                // b35fix381 INSTRUMENTATION — POST-recommender product set,
                // ordered by total contribution. Compare against the matching
                // [CombinedExport b35fix381] POST log for the same sampleId to
                // locate which product the per-sample path dropped vs the live
                // preview, and at what monthly K target.
                try {
                    var _sel = [];
                    program.monthly.forEach(function(m) {
                        (m.granular || []).forEach(function(p) {
                            _sel.push({ id: p.id, name: p.name, kind: 'granular',
                                month: m.month_name || m.month, rateKgHa: p.rateKgHa || 0 });
                        });
                        (m.liquid || []).forEach(function(p) {
                            _sel.push({ id: p.id, name: p.name, kind: 'liquid',
                                month: m.month_name || m.month, rateLHa: p.rateLHa || 0 });
                        });
                    });
                    console.log('[NutritionAuFertiliserIntegration b35fix381] POST-recommender selection:', {
                        path: 'live-preview-integration',
                        productIds: Array.from(new Set(_sel.map(function(s) { return s.id; }))),
                        applications: _sel,
                    });
                } catch (_e) {
                    console.warn('[NutritionAuFertiliserIntegration b35fix381] POST-instrument failed:', _e && _e.message);
                }

                // b35fix379 DEBUG: Log nutrition program generation details
                console.log('[NutritionAuFertiliserIntegration b35fix379] Generated program:', {
                    monthlyCount: program.monthly.length,
                    hasMonthlyProducts: program.monthly.some(m => m.granular.length > 0 || m.liquid.length > 0),
                    surfaceType: surfaceType,
                    methodology: methodology,
                    distributorFilter: distributorFilter
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
                                totalDelivered: { N: 0, P: 0, K: 0, Ca: 0, Mg: 0, S: 0 },
                            };
                        }
                        productUsage[p.id].applications++;
                        productUsage[p.id].totalKgHa += p.rateKgHa;
                        productUsage[p.id].totalDelivered.N += p.delivers.N || 0;
                        productUsage[p.id].totalDelivered.P += p.delivers.P || 0;
                        productUsage[p.id].totalDelivered.K += p.delivers.K || 0;
                        // b35fix379: Include Ca, Mg, S for consistency with liquid products
                        productUsage[p.id].totalDelivered.Ca += p.delivers.Ca || 0;
                        productUsage[p.id].totalDelivered.Mg += p.delivers.Mg || 0;
                        productUsage[p.id].totalDelivered.S += p.delivers.S || 0;
                    });
                    m.liquid.forEach(p => {
                        if (!productUsage[p.id]) {
                            productUsage[p.id] = {
                                product: p,
                                brandName: p.brand,
                                applications: 0,
                                totalLHa: 0,
                                totalDelivered: { N: 0, P: 0, K: 0, Ca: 0, Mg: 0, S: 0 },
                            };
                        }
                        productUsage[p.id].applications++;
                        // b35fix282: solubles use kg/ha not L/ha — track separately
                        if (p.form === 'soluble') {
                            productUsage[p.id].totalKgHa = (productUsage[p.id].totalKgHa || 0) + (p.rateLHa || 0);
                        } else {
                            productUsage[p.id].totalLHa = (productUsage[p.id].totalLHa || 0) + (p.rateLHa || 0);
                        }
                        productUsage[p.id].totalDelivered.N += p.delivers.N || 0;
                        productUsage[p.id].totalDelivered.P += p.delivers.P || 0;
                        productUsage[p.id].totalDelivered.K += p.delivers.K || 0;
                        // b35fix379: Include Ca, Mg, S for nitrate products (SOL-CANO3, SOL-MGNO3)
                        productUsage[p.id].totalDelivered.Ca += p.delivers.Ca || 0;
                        productUsage[p.id].totalDelivered.Mg += p.delivers.Mg || 0;
                        productUsage[p.id].totalDelivered.S += p.delivers.S || 0;
                    });
                });
                
                // b35fix379 DEBUG: Log collected products
                const nitrateProducts = Object.keys(productUsage).filter(id => 
                    id.includes('SOL-') || id.includes('NO3') || 
                    (productUsage[id].product && productUsage[id].product.name && 
                     productUsage[id].product.name.toLowerCase().includes('nitrate'))
                );
                console.log('[NutritionAuFertiliserIntegration b35fix379] Product collection complete:', {
                    totalProducts: Object.keys(productUsage).length,
                    nitrateProducts: nitrateProducts,
                    productIds: Object.keys(productUsage)
                });
                if (nitrateProducts.length > 0) {
                    nitrateProducts.forEach(id => {
                        const prod = productUsage[id];
                        console.log('[NutritionAuFertiliserIntegration b35fix379] Nitrate product details:', {
                            id: id,
                            name: prod.product ? prod.product.name : 'unknown',
                            totalKgHa: prod.totalKgHa,
                            totalLHa: prod.totalLHa,
                            totalDelivered: prod.totalDelivered,
                            applications: prod.applications
                        });
                    });
                }
                
                return {
                    meta: program.meta,
                    monthly: program.monthly,
                    annualSummary: { products: productUsage },
                    targets: program.targets,
                    delivered: program.delivered,
                    balance: program.balance,
                    deficits: calendarData.soil?.deficits || {},
                    muldersFlags: context.muldersFlags || {}, // b35fix276: surface flags for UI rendering
                    // GH-311: carried through from calendarData (nutrition-
                    // calendar.js's computeProgram() output) so
                    // buildRecommendationsHTML() can compute the "excess
                    // delivery" check (Current + Delivered vs ceiling) without
                    // re-resolving soil state independently.
                    soil: calendarData.soil,
                    annual_totals_range: calendarData.annual_totals_range,
                    // GH-312: Removal/Lift, needed for the unified Balance/Status model.
                    annual_removal: calendarData.annual_removal,
                    annual_lift: calendarData.annual_lift,
                    // GH-338: which nutrients have no real soil sample at all
                    // -- Required for these is removal-only, not a confirmed
                    // reading, so the table should say so explicitly.
                    missing_soil_data: calendarData.missing_soil_data || {},
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

            // b35fix308: reset the hidden state on every render. hideRecommendations()
            // sets display:none when isAustralia() returns false (e.g. during a brief
            // region-toggle or site-cycle race). Once hidden, the container stayed
            // hidden forever — even on subsequent renders where innerHTML was
            // correctly rebuilt. Clear any prior inline hide here so the panel
            // becomes visible whenever we render real content into it.
            container.style.display = '';

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
            
            // GH-311/312: soil ppm + bulkDensity/soilDepth + resolved AA
            // range + Removal/Lift, carried through from calendarData via
            // this file's own generateProgram(). Same fix as
            // nutrition-prebble-integration.js (this file's byte-identical
            // twin) -- see that file for the full GH-312 rationale (Woods
            // 2013 mass-balance + Carrow 2004 SLAN floor/ceiling).
            const soilInfo = program.soil || {};
            const soilBulkDensity = soilInfo.bulkDensity;
            const soilDepthCm = soilInfo.soilDepth;
            const soilPpmMap = soilInfo.ppm || {};
            const rangeMap = program.annual_totals_range || {};
            const removalMap = program.annual_removal || {};
            const missingSoilDataMap = program.missing_soil_data || {};

            // GH-312: unified Balance/Status model -- see
            // nutrition-prebble-integration.js's classifyBalance() for the
            // full rationale (same fix, byte-identical twin).
            function classifyBalance(nutrient, required, delivered) {
                // GH-338: no real soil sample for this nutrient at all --
                // Required is removal-only (no deficit/lift was computable),
                // not a confirmed reading. Say so plainly rather than letting
                // it fall into the pct-based fallback below and look like a
                // real Deficit/On Track verdict.
                if (missingSoilDataMap[nutrient]) {
                    return { currentDisplay: '—', rangeDisplay: '—', diff: delivered - required, statusClass: 'no-data', statusLabel: 'No Soil Data' };
                }
                const range = rangeMap[nutrient];
                const currentPpm = soilPpmMap[nutrient];
                const removal = removalMap[nutrient];
                const canCompute = range && typeof range.max === 'number' && typeof range.min === 'number'
                    && typeof currentPpm === 'number' && typeof removal === 'number'
                    && typeof soilBulkDensity === 'number' && typeof soilDepthCm === 'number';
                if (!canCompute) {
                    // GH-314: label renamed 'Met' -> 'On Track' to match the
                    // pct-based branch just below, same as
                    // nutrition-prebble-integration.js.
                    if (required === 0) {
                        return { currentDisplay: '—', rangeDisplay: '—', diff: delivered - required, statusClass: 'sufficient', statusLabel: 'On Track' };
                    }
                    const pct = Math.round((delivered / required) * 100);
                    const statusClass = pct >= 90 ? 'sufficient' : pct >= 70 ? 'marginal' : 'deficit';
                    // GH-333 follow-up: was `(${pct}%)` on every tier
                    // including On Track -- a completion ratio (100% = fully
                    // delivered) inconsistent with the range-based branch
                    // below. Confirmed with the user: the number only
                    // matters for Monitor/Deficit (how far off target); On
                    // Track stays a plain label, no number, same as the
                    // range-based branch's On Track.
                    const deltaPct = pct - 100;
                    const statusLabel = pct >= 90
                        ? 'On Track'
                        : (pct >= 70 ? 'Monitor' : 'Deficit') + ` (${deltaPct >= 0 ? '+' : ''}${deltaPct}%)`;
                    return { currentDisplay: '—', rangeDisplay: '—', diff: delivered - required, statusClass, statusLabel };
                }
                const unit = soilBulkDensity * soilDepthCm * 0.1;
                const currentKgHa = currentPpm * unit;
                const floorKgHa = range.min * unit;
                const ceilingKgHa = range.max * unit;
                const balanceKgHa = currentKgHa + delivered - removal;
                const currentDisplay = (Math.round(currentKgHa * 10) / 10).toString();
                // GH-313: shows what Balance is actually being compared against.
                const rangeDisplay = `${Math.round(floorKgHa * 10) / 10}–${Math.round(ceilingKgHa * 10) / 10}`;
                if (ceilingKgHa > 0 && balanceKgHa > ceilingKgHa) {
                    // GH-333: was statusClass: 'deficit' -- Excess and Deficit
                    // shared one class, so both painted the same alarming red,
                    // even though Excess (soil already above ceiling, nothing
                    // being added) and Deficit (intentionally corrected over
                    // several years via Lift, see GH-308/309) are not the same
                    // kind of "problem". Split into its own class so it can be
                    // coloured distinctly.
                    //
                    // GH-333 follow-up: was a (${pct}%) suffix computed as
                    // Balance/ceiling*100 (e.g. "266%") -- looked far more
                    // alarming than the real overshoot, since it expressed
                    // the whole Balance as a fraction of the ceiling rather
                    // than just the excess itself. Now expresses only the
                    // overage (balanceKgHa - ceilingKgHa) as a % of the
                    // ceiling.
                    const over = Math.round((balanceKgHa - ceilingKgHa) * 10) / 10;
                    const overPct = Math.round((over / ceilingKgHa) * 100);
                    return { currentDisplay, rangeDisplay, diff: balanceKgHa, statusClass: 'excess', statusLabel: `Excess (+${overPct}%)` };
                }
                if (balanceKgHa < floorKgHa) {
                    // GH-314: 'Low' -> 'Deficit', same vocabulary as the
                    // fallback branch above. GH-333 follow-up: same change as
                    // the Excess branch above -- expresses only the shortfall
                    // (floorKgHa - balanceKgHa) as a % of the floor, not the
                    // whole Balance as a % of the floor.
                    const short = Math.round((floorKgHa - balanceKgHa) * 10) / 10;
                    const shortPct = floorKgHa > 0 ? Math.round((short / floorKgHa) * 100) : 0;
                    return { currentDisplay, rangeDisplay, diff: balanceKgHa, statusClass: 'deficit', statusLabel: `Deficit (-${shortPct}%)` };
                }
                // GH-314: 'Met' -> 'On Track', same reasoning. GH-333
                // follow-up: briefly tried a "distance from nearer edge"
                // number here too, but confirmed with the user that On
                // Track should just stay a plain label -- the number only
                // matters once something is actually Deficit or Excess.
                return { currentDisplay, rangeDisplay, diff: balanceKgHa, statusClass: 'sufficient', statusLabel: 'On Track' };
            }

            // GH-333: 'sufficient' -> green, 'excess' -> red (genuinely
            // over-supplied, nothing corrects it automatically), everything
            // else ('deficit', fallback's 'marginal') -> amber -- a planned,
            // gradual correction (Lift spread over yearsToCorrect) isn't the
            // same urgency as a true excess and shouldn't share its red.
            // GH-338: 'no-data' -> neutral grey -- genuinely unknown, not a
            // verdict of any kind, shouldn't share Deficit's amber either.
            function statusVisualClass(statusClass) {
                if (statusClass === 'sufficient') return 'positive';
                if (statusClass === 'excess') return 'negative';
                if (statusClass === 'no-data') return 'neutral';
                return 'warning';
            }

            // Build nutrient summary rows
            const nutrientSummaryRows = ['N', 'P', 'K'].map(nutrient => {
                const required = nutrientRequired[nutrient];
                const delivered = nutrientTotals[nutrient];
                const removal = removalMap[nutrient];
                // GH-333: Removal is back -- without it, Balance (Current +
                // Delivered - Removal) can't be verified from the table
                // alone; it was hidden in GH-326 as "redundant with
                // Required", but Required only carries Removal + Lift
                // blended together, not Removal on its own.
                const removalDisplay = (typeof removal === 'number') ? removal.toString() : '—';
                const { currentDisplay, rangeDisplay, diff, statusClass, statusLabel } = classifyBalance(nutrient, required, delivered);
                return `
                    <tr class="nutrient-${statusClass}">
                        <td class="au-fert-cell au-fert-cell--left"><strong>${nutrient}</strong></td>
                        <td class="au-fert-cell au-fert-cell--num">${currentDisplay}</td>
                        <td class="au-fert-cell au-fert-cell--num">${removalDisplay}</td>
                        <td class="au-fert-cell au-fert-cell--num">${required}</td>
                        <td class="au-fert-cell au-fert-cell--num au-fert-cell--delivered">${delivered}</td>
                        <td class="au-fert-cell au-fert-cell--num">${rangeDisplay}</td>
                        <td class="au-fert-cell au-fert-cell--num nutrient-diff ${statusVisualClass(statusClass)}">${diff.toFixed(1)}</td>
                        <td class="au-fert-cell au-fert-cell--num"><span class="nutrient-status-badge nutrient-status-${statusClass}">${statusLabel}</span></td>
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
                        ? ` <span class="au-fert-release-tag">${p.release?.toUpperCase()}</span>` 
                        : '';
                    return `<span class="au-fert-product" title="${p.notes || ''}">${p.name} (${p.npk}) @ ${rateStr}${releaseTag}</span>`;
                }).join(' + ') || '<span class="au-fert-none">—</span>';
                
                const liquidList = m.liquid?.map(p => {
                    // b35fix282: use pre-formatted rate string (includes applications count if >1)
                    // rateUnit is 'kg/ha' for solubles, 'L/ha' for true liquids
                    const rateStr = p.rate || (p.rateLHa ? `${p.rateLHa} ${p.rateUnit || (p.form === 'soluble' ? 'kg/ha' : 'L/ha')}` : '-');
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
                
                // GH-257: canonical GP colour thresholds — see gp-status.js.
                // Was 50/25 (as a 0-1 fraction); now 70/40 to match the
                // dashboard/analysis/Word export.
                const gpLevel = window.GAIP_GPStatus ? window.GAIP_GPStatus.getLevelFrac(m.gp) : (m.gp >= 0.7 ? 'high' : (m.gp >= 0.4 ? 'moderate' : 'low'));
                const gpClass = gpLevel === 'moderate' ? 'medium' : gpLevel;
                
                return `
                    <tr class="gp-${gpClass}">
                        <td class="au-fert-cell au-fert-cell--month">${m.month_name}</td>
                        <td class="au-fert-cell au-fert-cell--season">${m.season}</td>
                        <td class="au-fert-cell">
                            <span class="au-fert-req">N:${Math.round(m.requirements.N)} P:${Math.round(m.requirements.P)} K:${Math.round(m.requirements.K)}</span>
                        </td>
                        <td class="au-fert-cell">${granularList}</td>
                        <td class="au-fert-cell">${liquidList || '<span class="au-fert-none">—</span>'}</td>
                        <td class="au-fert-cell au-fert-cell--notes">${notesArr.length ? `<span class="au-fert-inline-note">${notesArr.join(' · ')}</span>` : ''}</td>
                    </tr>
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
                        <td class="au-fert-cell au-fert-cell--left">
                            <strong>${product.name || p.brandName}</strong>
                            <div class="au-fert-cell-sub">Analysis: ${npk}</div>
                        </td>
                        <td class="au-fert-cell au-fert-cell--num">${p.applications}</td>
                        <td class="au-fert-cell au-fert-cell--num">${rateStr}</td>
                        <td class="au-fert-cell au-fert-cell--num au-fert-cell--mono">${Math.round(nDelivered)}</td>
                        <td class="au-fert-cell au-fert-cell--num au-fert-cell--mono">${Math.round(pDelivered)}</td>
                        <td class="au-fert-cell au-fert-cell--num au-fert-cell--mono">${Math.round(kDelivered)}</td>
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
            
            // GH-316: this row used the naive Delivered-Required formula
            // GH-311/312 already fixed in the Nutrient Delivery Summary
            // table above -- same page, same fix as
            // nutrition-prebble-integration.js (this file's byte-identical
            // twin). Reuse classifyBalance() so both tables agree.
            const nBal = classifyBalance('N', nutrientRequired.N, nutrientTotals.N);
            const pBal = classifyBalance('P', nutrientRequired.P, nutrientTotals.P);
            const kBal = classifyBalance('K', nutrientRequired.K, nutrientTotals.K);

            const totalRow = `
                <tr class="au-fert-totals-row">
                    <td class="au-fert-cell au-fert-cell--left">Total Delivered</td>
                    <td class="au-fert-cell au-fert-cell--num">${totalApps}</td>
                    <td class="au-fert-cell au-fert-cell--num">${totalRateStr}</td>
                    <td class="au-fert-cell au-fert-cell--num au-fert-cell--mono">${Math.round(nutrientTotals.N)}</td>
                    <td class="au-fert-cell au-fert-cell--num au-fert-cell--mono">${Math.round(nutrientTotals.P)}</td>
                    <td class="au-fert-cell au-fert-cell--num au-fert-cell--mono">${Math.round(nutrientTotals.K)}</td>
                </tr>
                <tr class="au-fert-required-row">
                    <td class="au-fert-cell au-fert-cell--left" colspan="3"><em>Required (kg/ha)</em></td>
                    <td class="au-fert-cell au-fert-cell--num au-fert-cell--mono"><em>${Math.round(nutrientRequired.N)}</em></td>
                    <td class="au-fert-cell au-fert-cell--num au-fert-cell--mono"><em>${Math.round(nutrientRequired.P)}</em></td>
                    <td class="au-fert-cell au-fert-cell--num au-fert-cell--mono"><em>${Math.round(nutrientRequired.K)}</em></td>
                </tr>
                <tr class="au-fert-balance-row--${statusVisualClass(nBal.statusClass)}">
                    <td class="au-fert-cell au-fert-cell--left" colspan="3"><strong>Balance</strong></td>
                    <td class="au-fert-cell au-fert-cell--num au-fert-cell--mono au-fert-${statusVisualClass(nBal.statusClass)}"><strong>${Math.round(nBal.diff)}</strong></td>
                    <td class="au-fert-cell au-fert-cell--num au-fert-cell--mono au-fert-${statusVisualClass(pBal.statusClass)}"><strong>${Math.round(pBal.diff)}</strong></td>
                    <td class="au-fert-cell au-fert-cell--num au-fert-cell--mono au-fert-${statusVisualClass(kBal.statusClass)}"><strong>${Math.round(kBal.diff)}</strong></td>
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
                    <div class="gilba-int-header">
                        <svg class="gilba-int-header-icon" width="16" height="16" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"/><path stroke-linecap="round" d="M2 12h20M12 2a15.3 15.3 0 014 10 15.3 15.3 0 01-4 10 15.3 15.3 0 01-4-10 15.3 15.3 0 014-10z"/></svg>
                        Australian Fertiliser Recommendations
                        <span class="gilba-int-region-badge">AU</span>
                    </div>
                    
                    <div class="au-fert-supplier-filter">
                        <label class="au-fert-supplier-label">Supplier</label>
                        <div class="au-fert-supplier-row">
                            <select id="au-fert-distributor-select" class="plan-form-select au-fert-supplier-select">
                                ${distributorOptionsHtml}
                            </select>
                            <span class="au-fert-supplier-hint">
                                ${this.selectedDistributor === 'all' 
                                    ? 'Best match across all distributors' 
                                    : `Filtered to ${currentDistributorLabel} only`}
                            </span>
                        </div>
                    </div>
                    
                    <div class="au-fert-meta">
                        <span class="meta-item">
                            <strong>Surface:</strong> ${this.formatSurfaceType(meta.surfaceType)}
                        </span>
                        <span class="meta-item">
                            <strong>Methodology:</strong> ${meta.methodology.toUpperCase()}
                        </span>
                        ${this.selectedDistributor !== 'all' ? `
                        <span class="meta-item au-fert-meta-supplier">
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
                            const ratioVal = f.value ? f.value.toFixed(1) : '-';
                            return '<div class="gilba-mulders-row">' +
                                '<svg class="gilba-mulders-icon" width="14" height="14" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2"><path stroke-linecap="round" stroke-linejoin="round" d="M13 10V3L4 14h7v7l9-11h-7z"/></svg>' +
                                '<div style="flex:1;">' +
                                    '<span class="gilba-mulders-pair" style="color:' + sev + ';">' + pair + '</span>' +
                                    '<span class="gilba-mulders-ratio">ratio: ' + ratioVal + ' (threshold: ' + f.threshold + ')</span>' +
                                    '<div class="gilba-mulders-msg">' + (f.message || '') + '</div>' +
                                    (f.citation ? '<div class="gilba-mulders-citation">' + f.citation + '</div>' : '') +
                                '</div>' +
                            '</div>';
                        }).join('');
                        const count = allFlags.length;
                        return '<div class="gilba-mulders-panel">' +
                            '<div class="gilba-mulders-title">' +
                                '<svg width="13" height="13" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2" style="flex-shrink:0"><path stroke-linecap="round" stroke-linejoin="round" d="M9 3H5a2 2 0 00-2 2v4m6-6h10a2 2 0 012 2v4M9 3v18m0 0h10a2 2 0 002-2V9M9 21H5a2 2 0 01-2-2V9m0 0h18"/></svg>' +
                                'Mulder\'s Nutrient Interactions — ' + count + ' interaction' + (count > 1 ? 's' : '') +
                            '</div>' +
                            '<div class="gilba-mulders-subtitle">Product selection adjusted to avoid aggravating antagonisms. Ref: Marschner (2012), Havlin et al. (2014).</div>' +
                            rows +
                        '</div>';
                    }).call(this)}
                    
                    <div class="prebble-section-card">
                        <h4>Monthly Program</h4>
                        <div class="gilba-table-scroll">
                            <table class="gilba-int-table au-fert-program-table">
                                <colgroup>
                                    <col class="col-month">
                                    <col class="col-season">
                                    <col class="col-req">
                                    <col>
                                    <col class="col-liquid">
                                    <col class="col-notes">
                                </colgroup>
                                <thead>
                                    <tr>
                                        <th class="au-fert-th au-fert-th--left">Month</th>
                                        <th class="au-fert-th au-fert-th--left">Season</th>
                                        <th class="au-fert-th au-fert-th--left">Requirements</th>
                                        <th class="au-fert-th au-fert-th--left">Granular</th>
                                        <th class="au-fert-th au-fert-th--left">Liquid / Foliar</th>
                                        <th class="au-fert-th au-fert-th--left">Notes</th>
                                    </tr>
                                </thead>
                                <tbody>${monthlyRows}</tbody>
                            </table>
                        </div>
                    </div>

                    ${productEntries.length > 0 ? `
                        <div class="prebble-section-card">
                        <h4>Nutrient Delivery Summary <button class="db-info-icon" data-info="prebble-nutrient-delivery-summary" tabindex="0" aria-label="Learn more">i</button></h4>
                        <table class="gilba-int-table au-fert-nutrient-summary">
                            <thead>
                                <tr>
                                    <th class="au-fert-th au-fert-th--left">Nutrient</th>
                                    <th class="au-fert-th">Current (kg/ha)</th>
                                    <th class="au-fert-th">Removal (kg/ha)</th>
                                    <th class="au-fert-th">Required (kg/ha)</th>
                                    <th class="au-fert-th">Delivered (kg/ha)</th>
                                    <th class="au-fert-th">Range (kg/ha)</th>
                                    <th class="au-fert-th">Balance</th>
                                    <th class="au-fert-th">Status</th>
                                </tr>
                            </thead>
                            <tbody>${nutrientSummaryRows}</tbody>
                        </table>
                        </div>

                        <div class="prebble-section-card">
                        <h4>Annual Product Summary</h4>
                        <table class="gilba-int-table au-fert-summary-table">
                            <thead>
                                <tr>
                                    <th class="au-fert-th au-fert-th--left">Product</th>
                                    <th class="au-fert-th">Applications</th>
                                    <th class="au-fert-th">Total Rate</th>
                                    <th class="au-fert-th">N</th>
                                    <th class="au-fert-th">P</th>
                                    <th class="au-fert-th">K</th>
                                </tr>
                                <tr class="au-fert-unit-row">
                                    <th class="au-fert-th" colspan="3"></th>
                                    <th class="au-fert-th" colspan="3">kg/ha delivered</th>
                                </tr>
                            </thead>
                            <tbody>
                                ${summaryRows}
                                ${totalRow}
                            </tbody>
                        </table>
                        </div>
                    ` : ''}
                    
                    <div class="au-fert-disclaimer">
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
        .gilba-au-fertiliser-recommendations { margin-top: 0; }

        .gilba-au-fert-panel { background: none; border: none; padding: 0; }

        .gilba-au-fert-panel h4 {
            font-size: 11px;
            font-weight: 700;
            text-transform: uppercase;
            letter-spacing: 0.05em;
            color: var(--gaip-text-muted);
            margin: 18px 0 8px;
            padding-bottom: 6px;
            border-bottom: 1px solid var(--gaip-border-light);
        }

        .au-fert-supplier-filter {
            margin-bottom: 14px;
        }
        .au-fert-supplier-label {
            display: block;
            font-size: 11px;
            font-weight: 600;
            color: var(--gaip-text-muted);
            text-transform: uppercase;
            letter-spacing: 0.04em;
            margin-bottom: 5px;
        }
        .au-fert-supplier-row {
            display: flex;
            align-items: center;
            gap: 10px;
            flex-wrap: wrap;
        }
        .au-fert-supplier-select {
            flex: 1;
            min-width: 160px;
            max-width: 360px;
        }
        .au-fert-supplier-hint {
            font-size: 11px;
            color: var(--gaip-text-muted);
        }

        .au-fert-meta {
            display: flex; gap: 16px; flex-wrap: wrap;
            padding: 10px 14px;
            background: var(--gaip-surface-muted, #f8fafc);
            border: 1px solid var(--gaip-border-light, #e5e7eb);
            border-radius: 8px;
            font-size: 13px;
            margin-bottom: 14px;
        }

        /* ── Monthly programme table ── */
        .au-fert-program-table { font-size: 13px; width: 100%; table-layout: fixed; min-width: 800px; }

        .au-fert-program-table col.col-month  { width: 6%; }
        .au-fert-program-table col.col-season { width: 8%; }
        .au-fert-program-table col.col-req    { width: 13%; }
        .au-fert-program-table col.col-liquid { width: 25%; }
        .au-fert-program-table col.col-notes  { width: 21%; }

        .au-fert-program-table .au-fert-product {
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

        .au-fert-program-table .au-fert-product.liquid {
            background: #eff6ff;
            color: #1e40af;
            border-color: #bfdbfe;
        }

        .au-fert-program-table td { word-break: break-word; }
        .au-fert-program-table .au-fert-none { color: var(--gaip-text-muted, #9ca3af); font-size: 13px; }
        .au-fert-program-table .au-fert-req  { font-size: 13px; font-weight: 600; white-space: nowrap; color: var(--gaip-text, #111827); font-variant-numeric: tabular-nums; }

        /* GP row accent */
        .au-fert-program-table .gp-high  > td:first-child { border-left: 3px solid var(--gaip-good, #16a34a); }
        .au-fert-program-table .gp-medium > td:first-child { border-left: 3px solid var(--gaip-warning, #d97706); }
        .au-fert-program-table .gp-low   > td:first-child { border-left: 3px solid var(--gaip-border, #d1d5db); }

        .au-fert-program-table tbody tr:hover td { background: var(--gaip-surface-muted, #f8fafc); }

        .au-fert-cell--notes { vertical-align: middle; text-align: left; word-break: break-word; }

        .au-fert-inline-note {
            display: block;
            font-size: 12px;
            color: var(--gaip-text, #111827);
            line-height: 1.4;
        }

        .au-fert-notes { color: var(--gaip-text, #111827); font-size: 12px; }

        /* ── Nutrient summary ── */
        .au-fert-nutrient-summary .nutrient-diff { font-weight: 600; }
        .au-fert-nutrient-summary .nutrient-diff.positive { color: var(--gaip-good, #16a34a); }
        .au-fert-nutrient-summary .nutrient-diff.negative { color: var(--gaip-critical, #dc2626); }
        .au-fert-nutrient-summary .nutrient-diff.warning { color: var(--gaip-warning, #d97706); }
        .au-fert-nutrient-summary .nutrient-diff.neutral { color: var(--gaip-text-muted, #6b7280); }

        .gilba-table-scroll { overflow-x: auto; }

        .au-fert-release-tag {
            display: inline-block;
            font-size: 11px;
            font-weight: 700;
            padding: 2px 6px;
            background: #eff6ff;
            color: #1e40af;
            border: 1px solid #bfdbfe;
            border-radius: 20px;
            margin-left: 4px;
            vertical-align: middle;
        }
        .au-fert-meta-supplier { color: var(--gaip-warning, #d97706); }

        /* Shared table base */
        .gilba-int-table { width: 100%; border-collapse: collapse; font-size: 13px; }

        .au-fert-th {
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

        .au-fert-th--left { text-align: left; }

        .au-fert-unit-row th {
            font-size: 11px; font-weight: 400;
            color: var(--gaip-text-muted, #6b7280); text-transform: none; letter-spacing: 0;
            border-bottom: 1px solid var(--gaip-border-light, #f1f5f9);
            padding: 3px 12px; text-align: right;
            background: var(--gaip-surface-muted, #f8fafc);
        }

        .au-fert-cell {
            padding: 11px 12px;
            border-bottom: 1px solid var(--gaip-border-light, #f1f5f9);
            color: var(--gaip-text, #111827);
            vertical-align: middle;
        }

        .au-fert-cell--left { text-align: left; }
        .au-fert-cell--num { text-align: right; }
        /* GH-334: bold Delivered, matching Balance's weight, no colour --
           the one figure a user needs to act on at a glance among the
           surrounding calculated context, without implying a status. */
        .au-fert-cell--delivered { font-weight: 700; }
        .au-fert-cell--month { text-align: left; font-weight: 700; white-space: nowrap; font-size: 13px; }
        .au-fert-cell--season { text-align: left; color: var(--gaip-text-muted, #6b7280); white-space: nowrap; font-size: 12px; }
        .au-fert-cell--mono { font-variant-numeric: tabular-nums; }
        .au-fert-cell-sub { font-size: 11px; color: var(--gaip-text-muted, #6b7280); margin-top: 2px; }

        .au-fert-positive { color: var(--gaip-good, #16a34a); font-weight: 600; }
        .au-fert-negative { color: var(--gaip-critical, #dc2626); font-weight: 600; }
        .au-fert-warning { color: var(--gaip-warning, #d97706); font-weight: 600; }
        .au-fert-neutral { color: var(--gaip-text-muted, #6b7280); font-weight: 600; }

        .au-fert-totals-row td { background: var(--gaip-good-bg, #f0fdf4); font-weight: 700; border-top: 2px solid var(--gaip-border, #e2e8f0); padding: 10px 12px; }
        .au-fert-required-row td { background: var(--gaip-surface-muted, #f8fafc); color: var(--gaip-text-muted, #6b7280); padding: 9px 12px; }
        .au-fert-balance-row--positive td { background: var(--gaip-good-bg, #f0fdf4); }
        .au-fert-balance-row--negative td { background: #fef2f2; }
        .au-fert-balance-row--warning td { background: var(--gaip-warning-bg, #fffbeb); }
        .au-fert-balance-row--neutral td { background: var(--gaip-surface-muted, #f8fafc); }

        .prebble-section-card tbody tr:last-child .au-fert-cell { border-bottom: none; }

        .au-fert-disclaimer {
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

    // GH-312: same glossary key as nutrition-prebble-integration.js (this
    // file's byte-identical twin) -- Object.assign merge is idempotent, so
    // whichever of the two files loads first registers it, harmless if both
    // do (both always load together per plan.blade.php/hub.blade.php).
    window.GAIP_GLOSSARY = Object.assign(window.GAIP_GLOSSARY || {}, {
        'prebble-nutrient-delivery-summary': {
            title: 'Nutrient Delivery Summary',
            body: 'Current — soil reserve now (ppm→kg/ha).\n' +
                'Removal — turf uptake this year (research-based).\n' +
                'Lift — correction toward the floor; 0 once soil ≥ floor.\n' +
                'Required — Removal + Lift; 0 once soil ≥ ceiling.\n' +
                'Balance — projected reserve at season end: Current + Delivered − Removal.\n' +
                'Range — the floor–ceiling Balance is checked against.\n' +
                'Status — Deficit (below floor) / On Track (in range) / Excess (above ceiling).',
        },
    });

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

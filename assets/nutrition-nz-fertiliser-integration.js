/**
 * Nutrition Calendar ↔ NZ Fertiliser Integration (Unified)
 *
 * Uses PrebbleRecommender (existing NZ algorithm) for ALL NZ distributors:
 *   - Prebble's
 *   - PGG Wrightson Turf
 *   - Stamina / Aqua Aid
 *
 * Product selection: temporarily swap PrebbleProducts with the filtered
 * NZ product pool (by distributor), call PrebbleRecommender.generateProgram(),
 * then restore. Rendering via NutritionPrebbleIntegration.buildRecommendationsHTML().
 *
 * Dependencies:
 *   - prebbles-products.js      (PrebbleProducts, PrebbleRecommender)
 *   - nz-fertiliser-products.js (GAIP_NZ_FERTILISER)
 *   - nutrition-prebble-integration.js (NutritionPrebbleIntegration)
 *   - regional-profiles.js      (GAIP_RegionalProfiles)
 *
 * @package Gilba_Hub
 * @version 2.0.0
 */

(function() {
    'use strict';

    // ========================================================================
    // DISTRIBUTOR DISPLAY NAMES
    // ========================================================================
    var DISTRIBUTOR_DISPLAY = {
        'all':           'All (best match)',
        'prebble':       "Prebble's",
        'pgg_wrightson': 'PGG Wrightson Turf',
    };

    // ========================================================================
    // INTEGRATION MODULE
    // ========================================================================

    var NutritionNzFertiliserIntegration = {

        version:             '2.0.0',
        lastProgram:         null,
        lastCalendarData:    null,
        selectedDistributor: 'all',
        _distributorRestored: false,

        init: function() {
            if (!window.PrebbleRecommender || !window.PrebbleProducts) {
                setTimeout(function() { NutritionNzFertiliserIntegration.init(); }, 100);
                return;
            }
            if (!window.GAIP_NZ_FERTILISER) {
                setTimeout(function() { NutritionNzFertiliserIntegration.init(); }, 100);
                return;
            }

            var self = this;

            document.addEventListener('gaip:nutrition-calendar-generated', function(e) {
                if (!self.isNZ()) {
                    self.hideRecommendations();
                    return;
                }
                self.lastCalendarData = e.detail.program;
                self.generateAndRender(e.detail.program);
            });

            // Late-render: calendar already generated before this script loaded
            var _existingCalendar = window.GilbaNutritionCalendar;
            if (_existingCalendar && _existingCalendar.program && self.isNZ()) {
                self.lastCalendarData = _existingCalendar.program;
                setTimeout(function() { self.generateAndRender(_existingCalendar.program); }, 200);
            }

            var nzG = (window.GAIP_NZ_FERTILISER.products.granular || []).length;
            var nzL = (window.GAIP_NZ_FERTILISER.products.liquid   || []).length;
            console.log('[NutritionNzFertiliserIntegration] Initialised (unified NZ). Prebble:',
                (window.PrebbleProducts.granular || []).length, 'granular +',
                'NZ extra:', nzG, 'granular,', nzL, 'liquid');
        },

        hideRecommendations: function() {
            var container = document.querySelector('[data-nz-fertiliser-recommendations]');
            if (container) container.style.display = 'none';
        },

        // ====================================================================
        // REGION DETECTION
        // ====================================================================

        isNZ: function() {
            if (window.GAIP_RegionalProfiles && typeof window.GAIP_RegionalProfiles.detectRegionFromHub === 'function') {
                var region = window.GAIP_RegionalProfiles.detectRegionFromHub();
                if (region === 'nz' || region === 'new_zealand') return true;
                if (region && region !== 'unknown' && region !== 'nz') return false;
            }
            if (window.GAIP_STATE && window.GAIP_STATE.region) {
                var r = window.GAIP_STATE.region;
                if (r === 'nz' || r === 'new_zealand') return true;
                if (r && r !== 'unknown') return false;
            }
            var lat = (window.GAIP_STATE && window.GAIP_STATE.location && window.GAIP_STATE.location.lat) ||
                      (window.GAIP_HUB_CONFIG && window.GAIP_HUB_CONFIG.savedLocation && window.GAIP_HUB_CONFIG.savedLocation.lat);
            var lon = (window.GAIP_STATE && window.GAIP_STATE.location && window.GAIP_STATE.location.lon) ||
                      (window.GAIP_HUB_CONFIG && window.GAIP_HUB_CONFIG.savedLocation && window.GAIP_HUB_CONFIG.savedLocation.lon);
            if (lat && lon) {
                return (lat >= -47 && lat <= -34 && lon >= 166 && lon <= 178);
            }
            try {
                var SC     = window.GAIP_SiteConfig || window.GAIP_SiteContext;
                var siteId = window.GAIP_SiteContext ? window.GAIP_SiteContext.getSiteId() : null;
                if (SC && siteId && typeof SC.getConfig === 'function') {
                    var cfg    = SC.getConfig(siteId);
                    var cfgLat = cfg && cfg.location && cfg.location.lat;
                    var cfgLon = cfg && cfg.location && cfg.location.lon;
                    if (cfgLat && cfgLon) {
                        return (cfgLat >= -47 && cfgLat <= -34 && cfgLon >= 166 && cfgLon <= 178);
                    }
                }
            } catch (e) {}
            return false;
        },

        getSurfaceType: function() {
            var turfState = (window.GaipTurfProfile && window.GaipTurfProfile.state) ||
                            (window.GAIP_STATE && window.GAIP_STATE.turf) || {};
            if (turfState.cotula === true || turfState.turfType === 'bowls' ||
                (window.GAIP_STATE && window.GAIP_STATE.turf && window.GAIP_STATE.turf.cotula === true)) {
                return 'bowling_greens';
            }
            if (window.GAIP_STATE && window.GAIP_STATE.soil && window.GAIP_STATE.soil.surfaceType) {
                var st = window.GAIP_STATE.soil.surfaceType;
                if (st === 'cotula_bowling_green') return 'bowling_greens';
                return st;
            }
            // b35fix428: window.GAIP_STATE.soil (legacy flat slot) is never populated
            // on plan.blade.php — the canonical slot is GAIP_STATE.inputs.soil (see
            // b35fix386 in nutrition-calendar.js). Without this check, every call on
            // Plan fell through the branch above and hit the 'sports' default below
            // regardless of the real surface, which silently disabled the recommender's
            // multi-month coverage/carryover window for greens (spoonfeeding is greens-
            // only — see the isGreens branch in prebbles-products.js generateProgram) —
            // producing a fresh granular application every month in exports instead of
            // matching the carryover shown on screen.
            var canonicalSoil = window.GAIP_STATE && window.GAIP_STATE.inputs && window.GAIP_STATE.inputs.soil;
            if (canonicalSoil && canonicalSoil.surfaceType) {
                var cst = canonicalSoil.surfaceType;
                if (cst === 'cotula_bowling_green') return 'bowling_greens';
                return cst;
            }
            if (window.GaipTurfProfile && window.GaipTurfProfile.state && window.GaipTurfProfile.state.subCategory) {
                return window.GaipTurfProfile.state.subCategory;
            }
            var surfaceSelect = document.querySelector('.gaip-surface-type');
            if (surfaceSelect && surfaceSelect.value) return surfaceSelect.value;
            return 'sports';
        },

        // ====================================================================
        // DISTRIBUTOR CHOICE PERSISTENCE
        // ====================================================================

        // Restores the last distributor the user picked on this site, so a
        // page reload (or the Reports > Export page, which recomputes this
        // program per-sample from scratch) uses the same product pool that
        // was actually shown on screen instead of silently resetting to
        // 'all'. Only runs once per page load, and only before the dropdown
        // has been touched, so it can't clobber a manual mid-session change.
        restoreSelectedDistributor: function() {
            if (this._distributorRestored) return;
            this._distributorRestored = true;
            try {
                var _nc = window.GilbaNutritionCalendar;
                var siteId = _nc && typeof _nc.getActiveSiteId === 'function' ? _nc.getActiveSiteId() : null;
                // Two sources depending on the page — same split as
                // NutritionCalendar.restoreFromPersisted() / persistSiteConfigPatch():
                //   - window.GAIP_SiteConfig.getConfig(siteId) — full-stack pages
                //     (old hub, Reports > Export), where the SiteConfig module exists.
                //   - window.GAIP_SITE_CONFIG — plan.blade.php, a lightweight page
                //     that never loads that module; the server-rendered config lives
                //     directly on this global instead (and is what persistSiteConfigPatch
                //     mutates in place on that page).
                var cfg = siteId && window.GAIP_SiteConfig && typeof window.GAIP_SiteConfig.getConfig === 'function'
                    ? window.GAIP_SiteConfig.getConfig(siteId) : null;
                if (!cfg && window.GAIP_SITE_CONFIG && window.GAIP_SITE_CONFIG.nzDistributor) {
                    cfg = window.GAIP_SITE_CONFIG;
                }
                if (cfg && cfg.nzDistributor) {
                    this.selectedDistributor = cfg.nzDistributor;
                }
            } catch (e) {}
        },

        // ====================================================================
        // PRODUCT POOL BY DISTRIBUTOR
        // ====================================================================

        getProductsForDistributor: function(distributorFilter) {
            var nzProds = window.GAIP_NZ_FERTILISER ? window.GAIP_NZ_FERTILISER.products : { granular: [], liquid: [] };
            var nzG     = nzProds.granular || [];
            var nzL     = nzProds.liquid   || [];

            var prebbleG = (window.PrebbleProducts && window.PrebbleProducts.granular) || [];
            var prebbleL = (window.PrebbleProducts && window.PrebbleProducts.liquid)   || [];

            var usePrebble  = (distributorFilter === 'all' || distributorFilter === 'prebble');
            var usePgg      = (distributorFilter === 'all' || distributorFilter === 'pgg_wrightson');

            var granular = [];
            var liquid   = [];

            if (usePrebble) {
                granular = granular.concat(prebbleG);
                liquid   = liquid.concat(prebbleL);
            }

            if (usePgg) {
                // Exclude wetting-agent-only brands (Stamina, Qualibra, Aqua Aid) — zero NPK
                granular = granular.concat(nzG.filter(function(p) {
                    return !p.id.startsWith('PGG-STAMINA') && !p.id.startsWith('PGG-QUALIBRA') &&
                           !p.id.startsWith('PGG-REMEDIATOR') && !p.id.startsWith('PGG-OARS');
                }));
                liquid = liquid.concat(nzL.filter(function(p) {
                    return !p.id.startsWith('PGG-STAMINA') && !p.id.startsWith('PGG-QUALIBRA') &&
                           !p.id.startsWith('PGG-REMEDIATOR') && !p.id.startsWith('PGG-OARS');
                }));
            }

            return { granular: granular, liquid: liquid };
        },

        // ====================================================================
        // GENERATE & RENDER
        // ====================================================================

        generateAndRender: function(calendarData) {
            if (!window.PrebbleRecommender || !window.PrebbleProducts || !window.NutritionPrebbleIntegration) {
                console.warn('[NutritionNzFertiliserIntegration] Missing dependencies (PrebbleRecommender / NutritionPrebbleIntegration)');
                return;
            }

            // GH-245: calendar.program is null when NutritionCalendar
            // couldn't resolve real monthly climate normals (Hoxton audit
            // D02/D03). Say so here rather than silently doing nothing.
            // Message kept non-technical — client-facing panel.
            if (!calendarData) {
                var _unavailEl = document.querySelector('[data-nz-fertiliser-recommendations]');
                if (_unavailEl) {
                    _unavailEl.style.display = '';
                    _unavailEl.innerHTML = '<div class="gilba-nut-banner gilba-nut-banner--warning">' +
                        '<strong>Climate data unavailable</strong> We couldn\'t load climate data for this site. ' +
                        'Please try again in a moment.' +
                        '</div>';
                }
                return;
            }

            this.restoreSelectedDistributor();

            var pi = window.NutritionPrebbleIntegration;

            // Sync soil state to GAIP_STATE (same as Prebble integration does)
            if (typeof pi.syncSoilState === 'function') pi.syncSoilState();

            var soilPpm    = typeof pi.getSoilPpm === 'function'          ? pi.getSoilPpm()            : {};
            var methodology = typeof pi.getMethodology === 'function'     ? pi.getMethodology()        : 'ammonium_acetate';
            var pThreshold  = methodology === 'mlsn' ? 21 : 30;

            var context = {
                surfaceType:         this.getSurfaceType(),
                methodology:         methodology,
                // GH-422: the CEC THIS programme was computed against
                // (computeProgram() -> soil.CEC), handed in rather than
                // re-read from the page. On this page the old page-read
                // resolved a hardcoded 8 for every New Zealand site.
                soilCEC:             typeof pi.getSoilCEC === 'function'             ? pi.getSoilCEC(calendarData) : null,
                irrigationFrequency: typeof pi.getIrrigationFrequency === 'function' ? pi.getIrrigationFrequency() : null,
                soilTemp:            typeof pi.getSoilTemperature === 'function'     ? pi.getSoilTemperature()     : null,
                latitude:            typeof pi.getLatitude === 'function'            ? pi.getLatitude()            : null,
                hemisphere:          'southern',
                soilPpm:             soilPpm,
                pDeficient:          soilPpm && soilPpm.P !== null && soilPpm.P < pThreshold,
                tissueStatus:        typeof pi.getTissueStatus === 'function'        ? pi.getTissueStatus()        : null,
                establishment:       false,
                seeding:             false,
                renovation:          false,
            };

            // Build filtered product pool for selected distributor
            var products = this.getProductsForDistributor(this.selectedDistributor);

            console.log('[NutritionNzFertiliserIntegration] nzdist-debug UI generate:', {
                siteId: (window.GilbaNutritionCalendar && window.GilbaNutritionCalendar.getActiveSiteId
                    && window.GilbaNutritionCalendar.getActiveSiteId()) || null,
                selectedDistributor: this.selectedDistributor,
                granularCount: products.granular.length,
                liquidCount: products.liquid.length,
                granularIds: products.granular.map(function(p) { return p.id; }),
            });

            // Temporarily swap PrebbleProducts so PrebbleRecommender uses the right pool
            var origGranular = window.PrebbleProducts.granular;
            var origLiquid   = window.PrebbleProducts.liquid;
            window.PrebbleProducts.granular = products.granular;
            window.PrebbleProducts.liquid   = products.liquid;

            // b35fix426 INSTRUMENTATION — pairs with [CombinedExport b35fix426] in
            // word-export-combined.js. Diff this PRE block (same tag, path:'live-ui')
            // against the report's PRE block for the same site/sample to find which
            // input still differs between the on-screen calc and the report recompute.
            var _b426Monthly = (calendarData.program && calendarData.program.monthly) || [];
            // GH-423: `monthlyNKP` is a REDUCED view — month, gp, N, K, P — and
            // for a year it was the only thing this pair compared besides the
            // context. generateProgram() reads more than that off each row
            // (`temp`, `month_num`, `season`) and more than that off the
            // calendar (`meta.hemisphere`, `meta.latitude`, `soil.methodology`),
            // and it reads the product pool, which the two surfaces build
            // separately. A difference in any of those was invisible: two
            // surfaces could be handed different inputs and this snapshot pair
            // would report "no differences". `monthlyFull`, `calendarMeta` and
            // `pool` below are everything generateProgram() actually consults,
            // so the comparison is now of the inputs rather than of a summary
            // of them. `monthlyNKP` is kept so the existing readers of this log
            // still work.
            console.log('[NutritionNzFertiliserIntegration b35fix426] PRE-recommender input snapshot:\n' + JSON.stringify({
                path: 'live-ui',
                siteId: (window.GilbaNutritionCalendar && window.GilbaNutritionCalendar.getActiveSiteId
                    && window.GilbaNutritionCalendar.getActiveSiteId()) || null,
                context: context,
                monthlyNKP: _b426Monthly.map(function(m) {
                    return { month: m.month_name || m.month, gp: +(m.gp || 0).toFixed(2), N: +(m.N || 0).toFixed(1), K: +(m.K || 0).toFixed(1), P: +(m.P || 0).toFixed(1) };
                }),
                monthlyFull: _b426Monthly,
                calendarMeta: {
                    hemisphere: calendarData.meta && calendarData.meta.hemisphere,
                    latitude: calendarData.meta && calendarData.meta.lat,
                    methodology: calendarData.soil && calendarData.soil.methodology,
                    CEC: calendarData.soil && calendarData.soil.CEC,
                },
                pool: {
                    granular: (window.PrebbleProducts.granular || []).map(function(p) { return p.id; }),
                    liquid: (window.PrebbleProducts.liquid || []).map(function(p) { return p.id; }),
                },
            }, null, 2));

            var program;
            try {
                program = window.PrebbleRecommender.generateProgram(calendarData, context);
            } finally {
                window.PrebbleProducts.granular = origGranular;
                window.PrebbleProducts.liquid   = origLiquid;
            }

            // GH-311 follow-up: this is a SECOND, independent generateProgram()
            // call (nutrition-prebble-integration.js's own generateAndRender has
            // its own copy of this same merge) -- confirmed live via
            // [GH311-DEBUG] that THIS path is the one that actually renders on
            // screen once a distributor is selected (see the comment below,
            // "the distributor-aware program the user actually sees on
            // screen"), so it needs the same carry-through or the "Current
            // (kg/ha)" column and excess check silently degrade to empty/Met
            // even when soil/range data is available.
            if (program && !program.error) {
                program.soil = calendarData.soil;
                // GH-403: the engine's own annual requirement per nutrient
                // (computeProgram()'s `annual_totals`), carried through so the
                // panel's "Required" column can print THE number the Word
                // document prints instead of re-deriving it by summing twelve
                // separately-rounded monthly rows.
                program.annual_requirements = calendarData.annual_totals;
                program.annual_totals_range = calendarData.annual_totals_range;
                // GH-312: Removal/Lift, needed for the unified Balance/Status model.
                program.annual_removal = calendarData.annual_removal;
                program.annual_lift = calendarData.annual_lift;
                // GH-338: which nutrients have no real soil sample at all --
                // Required for these is removal-only, not a confirmed
                // reading, so the table should say so explicitly.
                program.missing_soil_data = calendarData.missing_soil_data || {};
                // GH-422: the CEC this programme's product selection was
                // scored against, carried so the panel and the Word document
                // can print it — and, when it is null, name it as missing
                // instead of showing a figure that looks measured.
                program.soilCEC = context.soilCEC;
            }

            if (!program || program.error) {
                console.error('[NutritionNzFertiliserIntegration] Program error:', program && program.error);
                return;
            }

            // b35fix426 INSTRUMENTATION — POST product set + coveredBy state per
            // month, paired with the PRE block above.
            try {
                console.log('[NutritionNzFertiliserIntegration b35fix426] POST-recommender monthly:\n' + JSON.stringify({
                    path: 'live-ui',
                    monthly: (program.monthly || []).map(function(m) {
                        return {
                            month: m.month_name || m.month,
                            granular: (m.granular || []).map(function(p) { return p.name + ' @ ' + (p.rateKgHa || 0) + 'kg/ha'; }),
                            liquid: (m.liquid || []).map(function(p) { return p.name + ' @ ' + (p.rateLHa || 0) + 'L/ha'; }),
                            coveredBy: m.coveredBy ? (m.coveredBy.product + ' (' + m.coveredBy.month + ')') : null,
                        };
                    }),
                }, null, 2));
            } catch (_e) {
                console.warn('[NutritionNzFertiliserIntegration b35fix426] POST-instrument failed: ' + (_e && _e.message));
            }

            this.lastProgram = program;

            // This is the distributor-aware program the user actually sees on screen
            // (selectedDistributor may differ from the Prebble-only default), so it
            // must win as the canonical window.GAIP_NUTRITION_PROGRAM — the standalone
            // Prebble integration (hidden below) may have already set this global to
            // its own Prebble-only program for the same event; overwrite it here so
            // Word export and the persisted site config match what's on screen.
            var _nc = window.GilbaNutritionCalendar;
            program._generatedForSite = (_nc && _nc.getActiveSiteId && _nc.getActiveSiteId()) || 'unknown';
            window.GAIP_NUTRITION_PROGRAM = program;
            window.GAIP_NUTRITION_PROGRAM_UNAVAILABLE = false;
            if (_nc && typeof _nc.persistSiteConfigPatch === 'function'
                    && program._generatedForSite !== 'unknown') {
                _nc.persistSiteConfigPatch({ nutritionProgram: program });
            }

            var contentHtml = window.NutritionPrebbleIntegration.buildRecommendationsHTML(program);
            this.renderPanel(contentHtml);

            // Hide standalone Prebble panel (now integrated here)
            if (typeof pi.hideRecommendations === 'function') {
                pi.hideRecommendations();
            }
            // Hide AU and UK panels
            if (window.NutritionAuFertiliserIntegration && typeof window.NutritionAuFertiliserIntegration.hideRecommendations === 'function') {
                window.NutritionAuFertiliserIntegration.hideRecommendations();
            }
            if (window.NutritionUkFertiliserIntegration && typeof window.NutritionUkFertiliserIntegration.hideRecommendations === 'function') {
                window.NutritionUkFertiliserIntegration.hideRecommendations();
            }

            document.dispatchEvent(new CustomEvent('gaip:nz-fertiliser-program-generated', {
                detail: { program: program }
            }));
        },

        renderPanel: function(contentHtml) {
            var container = document.querySelector('[data-nz-fertiliser-recommendations]');
            if (!container) {
                var calendarResults = document.querySelector('[data-nutrition-results]');
                if (!calendarResults) {
                    console.warn('[NutritionNzFertiliserIntegration] No [data-nutrition-results] container');
                    return;
                }
                container = document.createElement('div');
                container.setAttribute('data-nz-fertiliser-recommendations', '');
                container.className = 'gilba-nz-fertiliser-recommendations';
                calendarResults.appendChild(container);
            }
            container.style.display = '';
            container.innerHTML = this.buildPanelShell(contentHtml);
            this.bindDistributorDropdown();
        },

        buildPanelShell: function(contentHtml) {
            var self = this;
            var distributorOptions = (window.GAIP_NZ_FERTILISER && window.GAIP_NZ_FERTILISER.recommender)
                ? window.GAIP_NZ_FERTILISER.recommender.getDistributorOptions()
                : [
                    { value: 'all',           label: 'All (best match)'   },
                    { value: 'pgg_wrightson', label: 'PGG Wrightson Turf' },
                    { value: 'prebble',       label: "Prebble's"          }
                ];

            var optionsHtml = distributorOptions.map(function(opt) {
                return '<option value="' + opt.value + '"' +
                    (opt.value === self.selectedDistributor ? ' selected' : '') + '>' +
                    opt.label + '</option>';
            }).join('');

            var hintText = this.selectedDistributor === 'all'
                ? 'Best match across all distributors'
                : 'Filtered to ' + (DISTRIBUTOR_DISPLAY[this.selectedDistributor] || this.selectedDistributor) + ' only';

            return '<div class="gilba-nz-fert-panel">' +
                '<div class="nz-fert-distributor-filter">' +
                    '<label class="nz-fert-distributor-label">Distributor</label>' +
                    '<div class="nz-fert-distributor-row">' +
                        '<select id="nz-fert-distributor-select" class="nz-fert-distributor-select">' +
                            optionsHtml +
                        '</select>' +
                        '<span class="nz-fert-distributor-hint">' + hintText + '</span>' +
                    '</div>' +
                '</div>' +
                contentHtml +
            '</div>';
        },

        bindDistributorDropdown: function() {
            var select = document.getElementById('nz-fert-distributor-select');
            if (!select) return;
            var self = this;
            select.addEventListener('change', function(e) {
                self.selectedDistributor = e.target.value;
                var _nc = window.GilbaNutritionCalendar;
                if (_nc && typeof _nc.persistSiteConfigPatch === 'function') {
                    _nc.persistSiteConfigPatch({ nzDistributor: self.selectedDistributor });
                }
                var data = self.lastCalendarData;
                if (!data) {
                    var cal = window.GilbaNutritionCalendar;
                    if (cal && cal.program) data = cal.program;
                }
                if (data) self.generateAndRender(data);
            });
        },
    };

    // ========================================================================
    // STYLES
    // ========================================================================
    (function() {
        var styles = [
            '.gilba-nz-fertiliser-recommendations { margin-top: 20px; }',
            '.gilba-nz-fert-panel { background: none; border: none; padding: 0; }',
            '.nz-fert-distributor-filter { margin-bottom: 14px; }',
            '.nz-fert-distributor-label {',
            '    display: block; font-size: 11px; font-weight: 600;',
            '    color: var(--gaip-text-muted, #6b7280); text-transform: uppercase;',
            '    letter-spacing: 0.04em; margin-bottom: 5px;',
            '}',
            '.nz-fert-distributor-row { display: flex; align-items: center; gap: 10px; flex-wrap: wrap; }',
            '.nz-fert-distributor-select {',
            '    flex: 1; min-width: 180px; max-width: 360px;',
            '    height: 34px; padding: 0 28px 0 10px;',
            '    font-size: 13px; font-family: inherit;',
            '    border: 1px solid var(--gaip-border, #d1d5db);',
            '    border-radius: var(--gaip-radius-sm, 5px);',
            '    background: var(--gaip-surface, #fff);',
            '    color: var(--gaip-text, #111);',
            '    appearance: none; -webkit-appearance: none;',
            '    background-image: url("data:image/svg+xml,%3Csvg xmlns=\'http://www.w3.org/2000/svg\' width=\'12\' height=\'12\' viewBox=\'0 0 24 24\' fill=\'none\' stroke=\'%236b7280\' stroke-width=\'2\'%3E%3Cpath d=\'M6 9l6 6 6-6\'/%3E%3C/svg%3E");',
            '    background-repeat: no-repeat; background-position: right 8px center;',
            '    cursor: pointer;',
            '}',
            '.nz-fert-distributor-hint { font-size: 11px; color: var(--gaip-text-muted, #6b7280); }',
        ].join('\n');
        var styleEl = document.createElement('style');
        styleEl.textContent = styles;
        document.head.appendChild(styleEl);
    })();

    // ========================================================================
    // BOOTSTRAP
    // ========================================================================
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', function() { NutritionNzFertiliserIntegration.init(); });
    } else {
        NutritionNzFertiliserIntegration.init();
    }

    window.NutritionNzFertiliserIntegration = NutritionNzFertiliserIntegration;

})();

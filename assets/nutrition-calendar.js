/**
 * Gilba Nutrition Calendar Module v2.1.0
 * 
 * Full annual nutrition programming with GP-weighted distribution.
 * Integrates with Hub's SSOT architecture - reads from GAIP_STATE.
 * 
 * Features:
 * - 12-month nutrient calendar (N, P, K, Ca, Mg, S)
 * - GP-weighted distribution using Climate Engine data
 * - MLSN deficit correction spread over years
 * - N-driven nutrient demand (research-backed ratios)
 * - Clipping management awareness (collected vs returned)
 * 
 * Research basis:
 * - Zhou & Soldat (2021): Tissue N ~3.9% in bentgrass, clipping removal = primary N output
 * - Kussow et al. (2012): N removal scales linearly with N input up to very high rates
 * - Law et al. (2016): ~73% N recovery in clippings at moderate fertility
 * - Soldat & Petrovic (2008): P removal 2-15 kg/ha/yr depending on management
 * - PACE Turf GP model: Temperature-based growth potential for distribution
 * 
 * @package Gilba_Hub
 * @version 2.5.0
 * @since 10.2.0
 *
 * Changelog:
 *   2.5.0 (b35fix304): Extract pure computeProgram(inputs). generate() is now a
 *                      thin wrapper. getThresholds / calculateDeficit accept an
 *                      explicit aaTextureKey so callers (e.g. word-export-combined
 *                      per-sample loop) can drive the calendar without DOM access.
 */

(function() {
    'use strict';

    // ========================================================================
    // CONFIGURATION
    // ========================================================================

    const CONFIG = {
        version: '2.5.0',
        
        // Threshold tables (MLSN / SLAN / AA)
        // b35fix301a: sourced from gaip-classification-constants.js when loaded.
        //             MLSN S value changes from 6 to 7 here as part of the
        //             standardisation onto the published MLSN guideline
        //             (Woods, Stowell, Gelernter 2016, PeerJ Preprints 4:e2144v1).
        //             Fallback literals retained for Node-test contexts without
        //             the constants module loaded.
        mlsnThresholds:
            ((typeof window !== 'undefined' && window.GilbaClassificationConstants) ||
             (typeof globalThis !== 'undefined' && globalThis.GilbaClassificationConstants) || {}).MLSN_THRESHOLDS ||
            { P: 21, K: 37, Ca: 331, Mg: 47, S: 7 },
        
        slanThresholds:
            ((typeof window !== 'undefined' && window.GilbaClassificationConstants) ||
             (typeof globalThis !== 'undefined' && globalThis.GilbaClassificationConstants) || {}).SLAN_THRESHOLDS ||
            { P: 40, K: 117, Ca: 750, Mg: 120, S: 12 },

        aaThresholds:
            ((typeof window !== 'undefined' && window.GilbaClassificationConstants) ||
             (typeof globalThis !== 'undefined' && globalThis.GilbaClassificationConstants) || {}).AA_THRESHOLDS ||
            {
                sands:  { P: 12, K: 75,  Ca: 500, Mg: 100, S: 30 },
                others: { P: 12, K: 100, Ca: 500, Mg: 140, S: 30 }
            },
        
        // Years to spread deficit correction
        yearsToCorrect: { P: 2, K: 2, Ca: 3, Mg: 3, S: 2 },
        
        // Default soil parameters
        defaultSoilDepth: 10,  // cm
        defaultBulkDensity: 1.4,  // g/cm³
        
        // Minimum GP to allocate nutrients
        minGpThreshold: 0.10,
        
        // ====================================================================
        // ANNUAL N REFERENCE VALUES (for user guidance only)
        // ====================================================================
        // These are NOT defaults - user must enter their target.
        // Shown as hints in the UI to help users choose appropriate values.
        //
        // Research basis:
        // - Schlossberg & Schmidt (2007): 244+ kg N/ha for quality on push-up greens
        // - Wisconsin research: 140-190 kg N/ha for good quality
        // - STRI (UK): 200-300 kg N/ha for intensively used PRG sports turf
        // - PACE Turf GP model: scales with growth potential
        //
        // Actual requirements vary significantly by:
        // - Soil type / CEC / leaching potential
        // - Species (PRG needs more than bent)
        // - Use intensity and quality expectations
        // - Budget constraints
        // ====================================================================
        annualNDefaults: {
            // Reference values only - user enters actual target
            greens:         100,   // Typical range: 80-150
            golf_greens:    100,
            tees:           150,   // Typical range: 120-180
            fairways:       150,   // Typical range: 150-250
            sports:         180,   // Typical range: 180-350
            cricket_wickets: 120,
            bowling_greens: 100,
            landscaping:    120,
            lawn:           100,
        },
        
        // ====================================================================
        // NUTRIENT RATIOS RELATIVE TO N (research-backed)
        // ====================================================================
        // Tissue composition determines nutrient demand ratios
        // When you apply N, plant demands other nutrients proportionally
        //
        // Research basis:
        // - Typical cool-season tissue: 4% N, 0.4% P, 2% K (Turner & Hummel 1992)
        // - N:P:K tissue ratio approximately 10:1:5
        // - Ca, Mg, S from various extension sources
        // ====================================================================
        nutrientRatiosToN: {
            P: 0.10,    // P = 10% of N (tissue ~0.4% P vs 4% N)
            K: 0.55,    // K = 55% of N (tissue ~2% K vs 4% N) 
            Ca: 0.17,   // Ca = 17% of N
            Mg: 0.08,   // Mg = 8% of N
            S: 0.05,    // S = 5% of N
        },
        
        // ====================================================================
        // CLIPPING MANAGEMENT IMPACT
        // ====================================================================
        // When clippings are returned, nutrients are recycled
        // Research: Kopp & Guillard (2002), Qian et al. (2003)
        // 
        // NOTE: N factor is 1.0 for both modes. The user's N target already
        // accounts for their site conditions (clipping management, leaching,
        // soil type, etc.). We don't second-guess their input.
        // P/K factors remain for informational purposes only.
        // ====================================================================
        clippingManagement: {
            collected: {
                // All removed nutrients must be replaced
                nFactor: 1.0,
                pFactor: 1.0,
                kFactor: 1.0,
            },
            returned: {
                // User's N target is respected - no automatic reduction
                // P/K factors for reference only (not currently applied)
                nFactor: 1.0,   // No adjustment - user knows their site
                pFactor: 0.4,   // Reference: 60% recycling efficiency
                kFactor: 0.5,   // Reference: 50% recycling efficiency
            },
        },
        
        // Traffic modifiers (affects wear/recovery, hence nutrient demand)
        trafficModifiers: { low: 0.85, moderate: 1.0, high: 1.15, extreme: 1.3 },
        
        // Month names
        monthNames: ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'],
        
        // Season mapping (Southern Hemisphere)
        seasonsSouth: {
            0: 'Summer', 1: 'Summer', 2: 'Autumn', 3: 'Autumn', 4: 'Autumn',
            5: 'Winter', 6: 'Winter', 7: 'Winter', 8: 'Spring', 9: 'Spring', 10: 'Spring', 11: 'Summer'
        },
        // Season mapping (Northern Hemisphere)
        seasonsNorth: {
            0: 'Winter', 1: 'Winter', 2: 'Spring', 3: 'Spring', 4: 'Spring',
            5: 'Summer', 6: 'Summer', 7: 'Summer', 8: 'Autumn', 9: 'Autumn', 10: 'Autumn', 11: 'Winter'
        }
    };

    // ========================================================================
    // MODULE STATE
    // ========================================================================

    const NutritionCalendar = {
        program: null,
        elements: {},
        config: CONFIG,
    };

    // ========================================================================
    // INITIALIZATION
    // ========================================================================

    NutritionCalendar.init = function() {
        const container = document.querySelector('[data-nutrition-calendar-module]');
        if (!container) {
            return;
        }

        this.elements = {
            container: container,
            results: container.querySelector('[data-nutrition-results]'),
            calendar: container.querySelector('[data-nutrition-calendar]'),
            summary: container.querySelector('[data-nutrition-summary]'),
            generateBtn: container.querySelector('[data-nutrition-generate]'),
            distributionSelect: container.querySelector('.gaip-nutrition-distribution'),
            annualNInput: container.querySelector('.gaip-nutrition-annual-n'),
            maxNInput: container.querySelector('.gaip-nutrition-max-n'),
            clippingSelect: container.querySelector('.gaip-nutrition-clipping'),
            // "Current Monthly N Rate" — feeds the report's N Program Validation
            // section (Applied N vs uptake capacity). Was previously never read by
            // any JS at all (dead input) — see restoreFromPersisted() and
            // persistSiteConfigPatch() calls below.
            monthlyNInput: container.querySelector('#plan-nut-monthly-n'),
        };

        this.bindEvents();

        // On pages that never load site-config-persistence.js (plan.blade.php),
        // window.GAIP_SITE_CONFIG is already available synchronously at this
        // point (server-rendered) — no need to wait for gaip:site-config-applied.
        this.restoreFromPersisted();

        this.initSamplePicker();
    };

    /**
     * Sample picker — lets the user choose which soil sample (zone) the
     * Nutrition Program is generated for. Only present on plan.blade.php
     * (#plan-nut-sample-picker doesn't exist elsewhere, so this is a no-op
     * everywhere else — old hub / Analysis already have their own real
     * sample switcher wired to the full orchestrator).
     *
     * Plan is deliberately a lightweight page (no sample-manager.js, no
     * orchestrator) — see plan.blade.php's script list. Rather than pull in
     * that whole stack just to pick a sample, this reads the same /api/samples
     * list the Combined Report itself iterates over and writes the chosen
     * sample's raw payload ppm straight into GAIP_STATE.inputs.soil, which
     * collectFromState() already reads. Reuses the exact dropdown widget
     * from Analysis > Soil & Nutrition (soil-nutrition-analysis.js) so the
     * UI matches pixel-for-pixel.
     */
    NutritionCalendar.initSamplePicker = function() {
        var mount = document.getElementById('plan-nut-sample-picker');
        if (!mount) return;
        if (!window.GAIP_SoilNutritionAnalysis || typeof window.GAIP_SoilNutritionAnalysis.mountSampleDropdown !== 'function') {
            console.warn('[NutritionCalendar] Sample picker mount present but soil-nutrition-analysis.js not loaded');
            return;
        }

        var self = this;
        var labelEl = document.getElementById('plan-nut-sample-label');

        function storageKey() {
            var siteId = window.GAIP_HUB_CONFIG && window.GAIP_HUB_CONFIG.activeSiteId;
            return 'gilba_plan_nutrition_sample' + (siteId ? '_' + siteId : '');
        }

        // Writes this sample's raw P/K/Ca/Mg/S(+micros) ppm into the canonical
        // GAIP_STATE.inputs.soil slot (see collectFromState() above). Sample
        // payload keys are already canonical (P/K/Ca/...) — the same shape
        // SampleAnalysisController::run() reads server-side — so no client-side
        // normalisation step is needed here.
        function applySample(sample) {
            var pl = sample.payload || {};
            var existingSoil = (window.GAIP_STATE && window.GAIP_STATE.inputs && window.GAIP_STATE.inputs.soil) || {};
            var ppm = {
                P: pl.P, K: pl.K, Ca: pl.Ca, Mg: pl.Mg, S: pl.S,
                Fe: pl.Fe, Mn: pl.Mn, Zn: pl.Zn, Cu: pl.Cu,
            };
            var soil = Object.assign({}, ppm, {
                ppm: ppm,
                methodology: pl.methodology || existingSoil.methodology,
                bulkDensity: pl.bulkDensity || existingSoil.bulkDensity,
                depth: pl.depth || existingSoil.depth,
                surfaceType: existingSoil.surfaceType,
            });

            if (!window.GAIP_STATE) window.GAIP_STATE = {};
            window.GAIP_STATE.inputs = Object.assign({}, window.GAIP_STATE.inputs || {}, { soil: soil });

            if (labelEl) {
                labelEl.textContent = pl._label || sample.client_uid || 'Sample';
            }
        }

        window.GAIP_SoilNutritionAnalysis.mountSampleDropdown(mount, {
            sampleType: 'soil',
            getPersistedId: function() {
                try { return localStorage.getItem(storageKey()); } catch (e) { return null; }
            },
            onReady: function(samples, activeIdx) {
                applySample(samples[activeIdx]);
            },
            onSelect: function(sample) {
                try { localStorage.setItem(storageKey(), sample.id); } catch (e) {}
                applySample(sample);
                // Convenience: if the form is already filled in, re-generate
                // immediately so switching samples updates the visible program
                // without an extra click. If Annual N Target is still empty,
                // don't auto-fire generate() — it would pop the validation
                // alert on every sample switch, which has nothing to do with
                // picking a sample.
                if (self.elements.annualNInput && parseFloat(self.elements.annualNInput.value) >= 50) {
                    self.generate();
                }
            },
            onEmpty: function() {
                if (labelEl) labelEl.textContent = 'No soil samples for this site';
            },
        });
    };

    NutritionCalendar.bindEvents = function() {
        if (this.elements.generateBtn) {
            this.elements.generateBtn.addEventListener('click', async (e) => {
                e.preventDefault();
                await this.generate();
            });
        }
        if (this.elements.monthlyNInput) {
            var self = this;
            this.elements.monthlyNInput.addEventListener('change', function() {
                var val = parseFloat(self.elements.monthlyNInput.value);
                if (!(val >= 0)) return;
                self.persistSiteConfigPatch({ appliedMonthlyN: val });
            });
        }
    };

    // ========================================================================
    // DATA EXTRACTION FROM HUB STATE
    // ========================================================================

    /**
     * Extract all required data from GAIP_STATE
     */
    NutritionCalendar.collectFromState = function() {
        const state = window.GAIP_STATE || {};
        const climate = window.climateMetrics || state.climate || {};
        
        // Location — DOM is always authoritative for current site lat.
        // state.location is never populated; climateMetrics.latitude may be stale
        // (still holding the previous site's weather data before the climate engine re-runs).
        const domLat = parseFloat(document.querySelector('.gaip-lat')?.value);
        const lat = (!isNaN(domLat) && domLat !== 0 ? domLat : null) ||
                    (state.inputs?.site?.latitude != null ? state.inputs?.site?.latitude : null) ||
                    climate.latitude ||
                    null;
        // Only treat as southern if we have a real negative lat — never assume hemisphere.
        const hemisphere = (lat !== null && lat < 0) ? 'south' : 'north';
        
        // Species - prioritize effectiveSpecies from turf profile (set by orchestrator)
        // b35fix309 item 5: track whether we landed on the silent IIFE fallback so
        // downstream code (UI, exports) can flag it. Previously this defaulted to
        // 'creepingBentgrass' with no warning, indistinguishable from a genuine
        // creeping bent sample. Surfaced during b35fix306 debugging.
        let _speciesFallbackUsed = false;
        let _speciesFallbackDomValue = null;
        const rawSpecies = state.turf?.effectiveSpecies ||
                          state.turf?.grassSpecies ||
                          state.grassSpecies ||
                          window.GAIP_CANONICAL_STATE?.turf?.effectiveSpeciesKey ||
                          window.GAIP_CANONICAL_STATE?.turf?.speciesKey ||
                          // Do NOT default to ryegrass — read from DOM as last resort
                          (function() {
                              const domSpecies = document.querySelector('.gaip-grass-species')?.value ||
                                               document.querySelector('[name="grassSpecies"]')?.value;
                              _speciesFallbackDomValue = domSpecies || null;
                              if (!domSpecies) {
                                  _speciesFallbackUsed = true;
                              }
                              return domSpecies || 'creepingBentgrass'; // neutral fallback, not C3 ryegrass
                          })();
        const species = this.normalizeSpecies(rawSpecies);
        const isC4 = this.isC4Species(species);

        // b35fix309 item 5: warn once per generate when the silent fallback fired.
        // Includes the raw value (null/undefined if missing entirely), the active
        // sample id (best-effort lookup), and the resolved fallback species.
        if (_speciesFallbackUsed) {
            let _activeSampleId = null;
            try {
                if (window.GAIP_SampleManager && typeof window.GAIP_SampleManager.getActiveSampleId === 'function') {
                    _activeSampleId = window.GAIP_SampleManager.getActiveSampleId();
                }
            } catch (e) { /* sample manager unavailable; carry on with null */ }
            console.warn(
                '[NutritionCalendar] Species missing in state and DOM, defaulted to creepingBentgrass.',
                'sampleId:', _activeSampleId,
                'rawSpecies:', rawSpecies,
                'domValue:', _speciesFallbackDomValue
            );
        }

        // b35fix306: preserve the human-facing species string for the summary strip.
        // `species` above is the nutrient-engine key (SpeciesController.toNutrientKey
        // collapses browntop → creepingBentgrass for tissue % reuse per line 558 of
        // species-controller.js). `speciesDisplay` is what the user actually sees —
        // the original raw site label. Keep both; do not unify.
        const speciesDisplay = (function(s) {
            if (typeof s === 'string' && s.trim()) return s.trim();
            if (s && typeof s === 'object') {
                return s.name || s.species || s.grassSpecies || '';
            }
            return '';
        })(rawSpecies);
        
        // Soil values (ppm)
        // b35fix282: include micronutrients so Mulder's interaction checker
        // has the full nutrient panel (Fe, Mn, Zn, Cu needed for ratio checks)
        // b35fix386: read from `state.inputs.soil` first — that's where the
        // hub-store routes writes via its setter contract. `state.soil` alone
        // is always undefined on the synthesiser getter's view. The legacy
        // `state.soil` fallback is preserved in case any other call site
        // populates the legacy slot directly (none currently do, but it
        // costs nothing to keep the read tolerant). Pairs with the writeback
        // fix in syncSoilFromDOM above.
        const soil = (state.inputs && state.inputs.soil) || state.soil || {};
        const soilPpm = {
            P: this.extractPpm(soil, 'P'),
            K: this.extractPpm(soil, 'K'),
            Ca: this.extractPpm(soil, 'Ca'),
            Mg: this.extractPpm(soil, 'Mg'),
            S: this.extractPpm(soil, 'S'),
            Fe: this.extractPpm(soil, 'Fe'),
            Mn: this.extractPpm(soil, 'Mn'),
            Zn: this.extractPpm(soil, 'Zn'),
            Cu: this.extractPpm(soil, 'Cu'),
        };
        
        // Soil parameters
        const bulkDensity = parseFloat(soil.bulkDensity) || CONFIG.defaultBulkDensity;
        const soilDepth = parseFloat(soil.depth) || CONFIG.defaultSoilDepth;
        
        // Methodology
        // Cotula/bowls: force ammonium_acetate regardless of what soil.methodology says.
        // The HubStore initialises inputs.soil.methodology as 'mlsn' and it may not
        // be updated by the time the calendar runs. Read from DOM select directly
        // as the reliable source for NZ sites with AA auto-selected.
        let methodology = (soil.methodology || 'mlsn').toLowerCase();
        // Map cotula_s78 to ammonium_acetate
        if (methodology === 'cotula_s78' || methodology === 'cotula') {
            methodology = 'ammonium_acetate';
        }
        // If turfType is bowls or cotula is active, force AA regardless
        if (methodology === 'mlsn') {
            const _tpc = window.GaipTurfProfile?.state || window.gaipTurfProfile?.state || {};
            const _gt  = window.GAIP_STATE?.turf || {};
            if (_tpc.turfType === 'bowls' || _gt.turfType === 'bowls' || _gt.cotula === true) {
                methodology = 'ammonium_acetate';
            } else {
                // Also read DOM select as fallback — most reliable for AA auto-select
                const _ms = document.querySelector('.gaip-soil-methodology');
                if (_ms && _ms.value && _ms.value !== 'mlsn') {
                    methodology = _ms.value;
                } else {
                    // New hub: read from GAIP_HUB_CONFIG (set by PHP controller) or
                    // GAIP_DASHBOARD_DATA.computed.soilNutrition (from analysis cache)
                    const _cfgMeth = (window.GAIP_HUB_CONFIG?.turfMethodology || '').toLowerCase();
                    const _snMeth  = (window.GAIP_DASHBOARD_DATA?.computed?.soilNutrition?.methodology || '').toLowerCase();
                    const _newHubMeth = _cfgMeth || _snMeth;
                    if (_newHubMeth && _newHubMeth !== 'mlsn') {
                        methodology = _newHubMeth;
                    }
                }
            }
        }
        
        // Monthly temperatures from climate engine
        const monthlyTemps = this.extractMonthlyTemps(climate, state);
        
        // User overrides from form
        const annualNOverride = parseFloat(this.elements.annualNInput?.value) || null;
        const maxNPerMonth = parseFloat(this.elements.maxNInput?.value) || 50;
        const distribution = this.elements.distributionSelect?.value || 'gp_weighted';
        
        // Traffic
        const traffic = state.turf?.traffic || 'moderate';
        
        // Clipping management - default based on surface type
        // Greens typically collect, fairways/sports typically return
        // b35fix386: read surfaceType from the locally-resolved `soil` const
        // (above), not `state.soil` which is undefined on the synthesised
        // state view. `soil` already prefers `state.inputs.soil`.
        const surfaceType = soil.surfaceType || state.turf?.subCategory || 'sports';
        const defaultClippingMgmt = ['greens', 'golf_greens', 'bowling_greens', 'tees'].includes(surfaceType) 
            ? 'collected' : 'returned';
        const clippingManagement = this.elements.clippingSelect?.value || state.turf?.clippingManagement || defaultClippingMgmt;
        
        return {
            hemisphere,
            latitude: lat,
            species,
            speciesDisplay,
            isC4,
            soilPpm,
            bulkDensity,
            soilDepth,
            methodology,
            monthlyTemps,
            annualNOverride,
            maxNPerMonth,
            distribution,
            traffic,
            surfaceType,
            clippingManagement,
            _speciesDefaulted: _speciesFallbackUsed,  // b35fix309 item 5: true when silent creepingBentgrass fallback fired
        };
    };

    /**
     * Extract ppm value handling nested structure
     */
    NutritionCalendar.extractPpm = function(soil, nutrient) {
        // Try direct ppm object
        if (soil.ppm && soil.ppm[nutrient] !== undefined) {
            return parseFloat(soil.ppm[nutrient]) || 0;
        }
        // Try direct property
        if (soil[nutrient] !== undefined) {
            return parseFloat(soil[nutrient]) || 0;
        }
        return 0;
    };

    /**
     * Sync soil data from DOM inputs and SampleManager active sample to GAIP_STATE
     * Ensures state is current before generating program.
     *
     * b35fix383: Source of truth is SampleManager.getActiveSample('soil').normalized
     * (where the lab values actually live). DOM inputs are a fallback for
     * manually-typed values that haven't been persisted to a sample yet.
     *
     * Pre-fix this function only read DOM `[data-mlsn="X"]` fields. When the
     * user wasn't on the soil tab those inputs were empty/unrendered, so
     * `soilState.ppm.K` ended up undefined. The live preview then computed
     * annual K targets as if soil K = 0 (treated as deficient by SLAN below
     * the 75 ppm floor → triggered lift correction → inflated annualK from
     * the correct ~52 to ~105). The recommender saw spurious K demand and
     * pulled in specialty K products (SOL-KNO3) that the agronomic situation
     * did NOT warrant.
     *
     * The combined export pathway (`word-export.js` line ~6188) already reads
     * `GAIP_STATE.soil.ppm` which gets correctly populated when SampleManager
     * activates a sample — that's why exports got K=141 for 14th_green while
     * the live preview got K=0. Closes the asymmetric-readers bug class.
     */
    NutritionCalendar.syncSoilFromDOM = function() {
        // Ensure GAIP_STATE exists and has a writable soil object
        if (!window.GAIP_STATE) window.GAIP_STATE = {};

        // Always create a fresh local soil object to avoid frozen/replaced state issues
        var soilState = {};
        try {
            // Carry over existing values if present.
            // b35fix386: read from `state.inputs.soil` first (canonical store
            // path), fall back to `state.soil` for legacy compat. Pre-fix
            // this read `state.soil` only — which is always undefined on the
            // hub-store getter's synthesised view, so the carry-over branch
            // never fired. Same root cause as the writeback fix below.
            //
            // b35fix429: carry over the WHOLE existing soil object (methodology,
            // bulkDensity, depth, surfaceType, CEC, EC, OM, ...), not just `.ppm`.
            // Pre-fix this rebuilt soilState as `{ ppm: existing.ppm }` only, so
            // every other field set by the page bridge (e.g. plan.blade.php's
            // surfaceType: turf.subCategory||turf.turfType) was silently dropped
            // the moment generate() ran — collectFromState()'s own surfaceType
            // read is correct, but by the time it runs the value is already gone.
            // Concretely: NutritionNzFertiliserIntegration.getSurfaceType() (and
            // the calendar's own surfaceType default logic) then always fell
            // through to 'sports', disabling the recommender's greens/carryover
            // branch regardless of the site's real surface.
            var existing = (window.GAIP_STATE.inputs && window.GAIP_STATE.inputs.soil)
                || window.GAIP_STATE.soil;
            if (existing) {
                soilState = Object.assign({}, existing, { ppm: Object.assign({}, existing.ppm) });
            } else {
                soilState = { ppm: {} };
            }
        } catch(e) {
            soilState = { ppm: {} };
        }

        // b35fix383: PRIORITY 1 — pull from SampleManager active sample
        // (authoritative lab values, present regardless of which tab the user
        // is currently viewing). This was the missing branch that caused the
        // live preview to compute K=0 when the soil tab DOM was empty.
        try {
            var SM = window.GAIP_SampleManager;
            var activeSoil = (SM && typeof SM.getActiveSample === 'function')
                ? SM.getActiveSample('soil') : null;
            if (activeSoil) {
                // Sample structure: { id, label, date, rawData, normalized: {P, K, Ca, Mg, S, Fe, Mn, Zn, Cu, Na, ...} }
                var src = activeSoil.normalized || activeSoil.rawData || {};
                var nutKeys = ['P', 'K', 'Ca', 'Mg', 'S', 'Fe', 'Mn', 'Cu', 'Zn', 'Na'];
                nutKeys.forEach(function(nut) {
                    var v = parseFloat(src[nut]);
                    if (!isNaN(v) && v > 0) {
                        soilState.ppm[nut] = v;
                        soilState[nut] = v;
                    }
                });
                // Also lift methodology, pH, OM, CEC, bulkDensity if the
                // sample carries them — same precedence rule (sample first,
                // DOM-derived fallback below).
                if (src.methodology) soilState.methodology = src.methodology;
                if (src.pH_water != null) soilState.pH_water = parseFloat(src.pH_water);
                if (src.pH_cacl2 != null) soilState.pH_cacl2 = parseFloat(src.pH_cacl2);
                if (src.OM != null) soilState.OM = parseFloat(src.OM);
                if (src.CEC != null) soilState.CEC = parseFloat(src.CEC);
                if (src.bulkDensity != null) soilState.bulkDensity = parseFloat(src.bulkDensity);
            }
        } catch (e) {
            console.warn('[NutritionCalendar b35fix383] SampleManager soil read failed, falling back to DOM:', e && e.message);
        }

        // PRIORITY 2 — DOM inputs override sample values when the user has
        // typed a positive non-zero value into the soil panel. Empty inputs
        // and literal-zero inputs do NOT overwrite the SampleManager values
        // populated above.
        //
        // b35fix384: Pre-fix the DOM scan accepted parseFloat('0') = 0 as a
        // valid value and zeroed out the SampleManager K=141 override — net
        // effect was b35fix383's SampleManager priority block silently
        // produced no behaviour change. The `> 0` guard mirrors the
        // SampleManager block's own guard above, keeping the two halves of
        // this function symmetric on what counts as "real data".
        const nutrients = ['P', 'K', 'Ca', 'Mg', 'S', 'Fe', 'Mn', 'Cu', 'Zn', 'Na'];
        nutrients.forEach(nutrient => {
            const input = document.querySelector(`[data-mlsn="${nutrient}"]`);
            if (input && input.value) {
                const value = parseFloat(input.value);
                if (!isNaN(value) && value > 0) {
                    soilState.ppm[nutrient] = value;
                    soilState[nutrient] = value;
                }
            }
        });

        // Read remaining soil fields into soilState BEFORE write-back
        // b35fix409 (C3+C5): three fixes here.
        //   1. CEC writeback was `soilState.cec = ...` (lowercase). Renderers
        //      and downstream readers all consult uppercase `soilState.CEC`,
        //      so the lowercase write was silently dropped. Now writes the
        //      canonical uppercase key.
        //   2. EC had no DOM fallback at all. The single-export path at
        //      `word-export.js:6505` reads it directly from DOM, but the
        //      combined-export path relies on `soilState.EC` from this
        //      function. Without it, every per-zone iteration in combined
        //      export saw EC=null. Now reads `.gaip-soil-ec` and writes
        //      `soilState.EC`.
        //   3. OM had no DOM fallback either. Same reasoning. Reads
        //      `.gaip-loi` (the actual UI selector — confirmed against
        //      sample-manager.js SOIL_FIELD_MAP) and writes `soilState.OM`.
        const cecInput = document.querySelector('.gaip-cec');
        if (cecInput && cecInput.value) {
            const cec = parseFloat(cecInput.value);
            if (!isNaN(cec)) soilState.CEC = cec;
        }

        const ecInput = document.querySelector('.gaip-soil-ec');
        if (ecInput && ecInput.value) {
            const ec = parseFloat(ecInput.value);
            if (!isNaN(ec)) soilState.EC = ec;
        }

        const omInput = document.querySelector('.gaip-loi');
        if (omInput && omInput.value) {
            const om = parseFloat(omInput.value);
            if (!isNaN(om)) soilState.OM = om;
        }

        const bdInput = document.querySelector('.gaip-bulk-density, [name="bulk-density"]');
        if (bdInput && bdInput.value) {
            const bd = parseFloat(bdInput.value);
            if (!isNaN(bd)) soilState.bulkDensity = bd;
        }

        const methodSelect = document.querySelector('[name="soil-methodology"], .gaip-soil-methodology');
        if (methodSelect && methodSelect.value) {
            // Don't downgrade ammonium_acetate to mlsn if bridge already set it correctly
            const _existing = soilState.methodology;
            const _domVal = methodSelect.value;
            if (!(_existing === 'ammonium_acetate' && _domVal === 'mlsn')) {
                soilState.methodology = _domVal;
            }
        }

        const surfaceSelect = document.querySelector('.gaip-surface-type');
        if (surfaceSelect && surfaceSelect.value) {
            soilState.surfaceType = surfaceSelect.value;
        }

        // b35fix386: route the writeback through the hub-store setter's
        // `e.inputs` branch. The legacy `window.GAIP_STATE.soil = ...` write
        // appears to succeed (no exception) but is silently dropped because
        // `window.GAIP_STATE` is a getter/setter pair, not a data property.
        // The getter synthesises a fresh object on every read from
        // `c.peek('inputs')`, `c.peek('computed')`, etc.; assignments to
        // top-level `.soil` land on that ephemeral object and are GC'd. Only
        // assignments that match the setter's `e.inputs` branch reach the
        // actual store.
        //
        // Pre-fix (b35fix383+384): SampleManager-priority block correctly
        // built `soilState.ppm.K = 141`, then `window.GAIP_STATE.soil =
        // soilState` was a no-op. `collectFromState` then read `state.soil`
        // → undefined → `extractPpm(soil, 'K')` → 0 (via `parseFloat(undef.ppm)
        // || 0`). soilSeenK=0 across every site, every sample, every click.
        // Live preview agronomically wrong on every K-sufficient soil.
        // Word export survived only because it constructs perSampleInputs
        // as a plain local object handed straight to computeProgram(), never
        // round-tripping through window.GAIP_STATE.
        //
        // Post-fix: assigning `window.GAIP_STATE = { inputs: { soil: soilState
        // } }` triggers the setter's transaction path — `c.transaction((t)
        // => t.set('inputs.soil', soilState, 'legacy-state-write'))`. The
        // store accepts the write; subsequent reads of `state.inputs.soil`
        // return what we wrote. Verified at the console: probe 2 shows
        // `inputs.soil` carrying `{ppm:{K:999}, K:999, methodology:'mlsn'}`
        // after the routed write, and the run-count probe confirms no
        // analysis-cascade re-trigger (safe to write from inside generate()).
        //
        // The matched read fix lives in collectFromState below — `state.soil`
        // alone returns undefined; the canonical read is `state.inputs.soil`.
        try {
            // Merge soil state into existing GAIP_STATE instead of replacing the whole
            // object — a full replacement wipes state.turf (set by plan page bridge)
            // which integration scripts need for getSurfaceType().
            var _gs = window.GAIP_STATE;
            if (_gs && typeof _gs === 'object' && !Array.isArray(_gs)) {
                var _inp = Object.assign({}, _gs.inputs || {}, { soil: soilState });
                Object.assign(_gs, { inputs: _inp });
            } else {
                window.GAIP_STATE = { inputs: { soil: soilState } };
            }
        } catch (e) {
            console.warn('[NutritionCalendar b35fix386] state writeback failed:', e && e.message);
        }
    };

    /**
     * GH-245: extract monthly temperatures from real climate normals.
     *
     * Real data (NASA POWER climatology, then Open-Meteo archive average as
     * fallback — resolved by ClimateFetchCoordinator.ensureMonthlyNormals in
     * climate-engine-v2.js) is keyed 1-12 (Jan=1). This file's internal
     * convention is 0-11 (Jan=0) throughout calculateMonthlyGP and the
     * calendar renderers — re-index once here so every downstream consumer
     * keeps working unchanged.
     *
     * Returns null — never a latitude-guessed regional profile — when
     * neither real source has resolved. Callers must treat null as "climate
     * data unavailable" and show that explicitly. The previous fallback
     * (mean temp by latitude band + cosine seasonal amplitude) produced a
     * fabricated profile that was wrong by design for maritime sites like
     * Auckland — see the Hoxton audit, D03.
     */
    NutritionCalendar.extractMonthlyTemps = function(climate, state) {
        const real = (climate.monthlyTemps && Object.keys(climate.monthlyTemps).length === 12)
            ? climate.monthlyTemps
            : (state.climate?.monthlyTemps || null);

        if (!real) return null;

        const reindexed = {};
        for (let m = 0; m < 12; m++) reindexed[m] = real[m + 1];
        return reindexed;
    };

    /**
     * Normalize species name to key
     */
    NutritionCalendar.normalizeSpecies = function(species) {
        // Delegate to SpeciesController (single source of truth for species identity)
        // Then map to the nutrition calendar's internal keys
        if (window.SpeciesController) {
            const canonical = window.SpeciesController.normalize(species);
            // Map SpeciesController canonical keys to nutrient demand engine keys
            return window.SpeciesController.toNutrientKey(canonical);
        }
        
        // Fallback if SpeciesController not loaded (shouldn't happen in production)
        if (!species) return 'perennialRyegrass';
        if (typeof species === 'object') {
            species = species.name || species.species || species.grassSpecies || 'perennialRyegrass';
        }
        if (typeof species !== 'string') return 'perennialRyegrass';
        
        const cleanedKey = species.toLowerCase().replace(/\s*\([^)]*\)/g, '').replace(/[\s-]+/g, '');
        const mapping = {
            'perennialryegrass': 'perennialRyegrass',
            'creepingbentgrass': 'bentgrass',
            'creepingbent': 'bentgrass',
            'browntopbent': 'bentgrass',
            'bentgrass': 'bentgrass',
            'annualbluegrass': 'poaAnnua',
            'poaannua': 'poaAnnua',
            'kentuckybluegrass': 'kentuckyBluegrass',
            'tallfescue': 'tallFescue',
            'finefescue': 'fineFescue',
            'bermuda': 'bermuda',
            'couch': 'couch',
            'zoysia': 'zoysiagrass',
            'kikuyu': 'kikuyu',
            'buffalo': 'buffalo',
            'paspalum': 'seashorePaspalum',
        };
        return mapping[cleanedKey] || 'perennialRyegrass';
    };

    /**
     * Check if species is C4
     */
    NutritionCalendar.isC4Species = function(species) {
        const c4Species = ['bermuda', 'couch', 'zoysiagrass', 'kikuyu', 'buffalo', 'seashorePaspalum', 'mixedWarm'];
        return c4Species.includes(species);
    };

    /**
     * Get surface type modifier for removal rates
     * Greens have lower removal rates due to:
     * - Very low height of cut (less biomass)
     * - Clippings often removed (less nutrient cycling)
     * - Slower growth rates maintained
     * 
     * Research basis: 
     * - Greens typically need 100-150 kg N/ha/yr vs 150-200 for fairways
     * - USGA recommends 73-146 kg N/ha/yr for bentgrass greens
     * 
     * @deprecated v2.1.0 - Now using direct N defaults by surface type (CONFIG.annualNDefaults)
     */
    NutritionCalendar.getSurfaceModifier = function(surfaceType) {
        // DEPRECATED: Kept for backwards compatibility
        // v2.1+ uses CONFIG.annualNDefaults directly
        if (!surfaceType) return 1.0;
        
        const surface = surfaceType.toLowerCase().replace(/[\s-]/g, '_');
        
        // Surface modifiers based on typical management intensity and biomass removal
        const modifiers = {
            // Fine turf - very low HOC, intensive management
            'greens': 0.7,
            'golf_greens': 0.7,
            'putting_green': 0.7,
            'bowling_greens': 0.75,
            'cricket_wickets': 0.75,
            
            // Medium turf
            'tees': 0.85,
            'low_cut': 0.85,
            'approaches': 0.85,
            
            // Standard turf - baseline
            'fairways': 1.0,
            'sports': 1.0,
            'sports_fields': 1.0,
            'landscaping': 0.9,
            'lawns': 0.9,
        };
        
        return modifiers[surface] || 1.0;
    };

    // ========================================================================
    // CALCULATIONS
    // ========================================================================

    /**
     * Calculate Growth Potential for a temperature
     */
    NutritionCalendar.calculateGP = function(temp, isC4) {
        var GPE = (typeof window !== 'undefined' && window.GilbaGrowthPotentialEngine)
               || (typeof global !== 'undefined' && global.GilbaGrowthPotentialEngine)
               || null;
        if (!GPE) return 0;
        var gp = GPE.compute(temp, { model: 'pace', species: isC4 ? 'c4' : 'c3' });
        return gp != null ? gp : 0;
    };

    /**
     * Calculate monthly GP values
     */
    NutritionCalendar.calculateMonthlyGP = function(monthlyTemps, isC4) {
        // GH-245: defensive — computeProgram() already guards
        // climateDataUnavailable before reaching here, but never silently
        // treat a missing month as 15degC (Hoxton audit D02/D03 root cause).
        if (!monthlyTemps) return null;
        const gp = {};
        for (let m = 0; m < 12; m++) {
            if (typeof monthlyTemps[m] !== 'number') return null;
            gp[m] = this.calculateGP(monthlyTemps[m], isC4);
        }
        return gp;
    };

    /**
     * Calculate deficit for a nutrient based on methodology (MLSN or SLAN)
     * @param {number} currentPpm - Current soil level
     * @param {string} nutrient - Nutrient name (P, K, Ca, Mg, S)
     * @param {number} bulkDensity - Soil bulk density (g/cm³)
     * @param {number} soilDepth - Soil depth (cm)
     * @param {string} methodology - 'mlsn' or 'slan'
     * @returns {number} Deficit in kg/ha (0 if at or above threshold)
     */
    NutritionCalendar.calculateDeficit = function(currentPpm, nutrient, bulkDensity, soilDepth, methodology = 'mlsn', aaTextureKey = null) {
        // Select threshold based on methodology
        const thresholds = this.getThresholds(methodology, aaTextureKey);
        
        const threshold = thresholds[nutrient];
        if (!threshold || currentPpm >= threshold) return 0;
        
        const deficit = threshold - currentPpm;
        // Convert ppm deficit to kg/ha: ppm × bulk density × depth × 0.1
        const kgHa = deficit * bulkDensity * soilDepth * 0.1;
        return kgHa;
    };
    
    /**
     * Get threshold values for a methodology
     * @param {string} methodology - 'mlsn', 'slan', or 'ammonium_acetate'
     * @param {string|null} aaTextureKey - optional precomputed AA texture key
     *                                     ('sands' | 'others'). When null and
     *                                     methodology is AA, falls back to DOM
     *                                     read. Supply the key to keep this
     *                                     function pure (b35fix304).
     * @returns {object} Threshold values for each nutrient
     */
    NutritionCalendar.getThresholds = function(methodology = 'mlsn', aaTextureKey = null) {
        const m = (methodology || 'mlsn').toLowerCase();
        if (m === 'slan') {
            return { ...CONFIG.slanThresholds };
        }
        if (m === 'ammonium_acetate' || m === 'ammoniumacetate' || m === 'aa') {
            // b35fix304 Task 2: prefer the explicit aaTextureKey when supplied so
            // callers can drive this function without DOM access. Fall back to the
            // DOM read when no key is provided (legacy behaviour).
            let key = aaTextureKey;
            if (key == null && typeof document !== 'undefined') {
                const textureEl = document.querySelector('.gaip-aa-soil-texture');
                key = (textureEl?.value || 'sands').toLowerCase();
            }
            key = (key === 'others') ? 'others' : 'sands';
            return { ...CONFIG.aaThresholds[key] };
        }
        return { ...CONFIG.mlsnThresholds };
    };

    /**
     * Distribute annual amount by GP weighting
     */
    NutritionCalendar.distributeByGP = function(annualAmount, monthlyGP, method = 'gp_weighted') {
        const allocations = {};
        
        if (method === 'even') {
            // Even distribution
            const monthly = annualAmount / 12;
            for (let m = 0; m < 12; m++) {
                allocations[m] = monthly;
            }
        } else if (method === 'front_loaded') {
            // 60% in spring (months 8-10 south, 2-4 north)
            // Simplified: weight first half more
            const total = annualAmount;
            for (let m = 0; m < 12; m++) {
                const gp = monthlyGP[m] || 0;
                allocations[m] = gp >= CONFIG.minGpThreshold ? total / 10 : 0;
            }
            // Boost spring months
            [8, 9, 10].forEach(m => { allocations[m] *= 1.5; });
        } else {
            // GP-weighted (default)
            let totalGP = 0;
            for (let m = 0; m < 12; m++) {
                if (monthlyGP[m] >= CONFIG.minGpThreshold) {
                    totalGP += monthlyGP[m];
                }
            }
            
            if (totalGP === 0) {
                // Fallback to even
                const monthly = annualAmount / 12;
                for (let m = 0; m < 12; m++) {
                    allocations[m] = monthly;
                }
            } else {
                for (let m = 0; m < 12; m++) {
                    if (monthlyGP[m] >= CONFIG.minGpThreshold) {
                        allocations[m] = annualAmount * (monthlyGP[m] / totalGP);
                    } else {
                        allocations[m] = 0;
                    }
                }
            }
        }
        
        return allocations;
    };

    /**
     * Apply monthly N cap with overflow redistribution.
     *
     * null / undefined / 0 / '' / NaN → "no cap" (Infinity).
     * Overflow is redistributed into months that already carry a non-zero
     * allocation (dormant months are never eligible). If the cap is too low
     * to absorb the overflow, the remainder is reported as `unschedulable`.
     */
    NutritionCalendar.applyNCap = function(nAllocations, maxN) {
        const cap = (typeof maxN === 'number' && isFinite(maxN) && maxN > 0) ? maxN : Infinity;

        const result = {};
        let originalTotal = 0;
        let overflow = 0;

        for (let m = 0; m < 12; m++) {
            const alloc = nAllocations[m] || 0;
            originalTotal += alloc;
            if (alloc > cap) {
                result[m] = cap;
                overflow += alloc - cap;
            } else {
                result[m] = alloc;
            }
        }

        let redistributed = 0;
        let unschedulable = 0;

        if (overflow > 0.001) {
            let remaining = overflow;
            let iterations = 0;
            while (remaining > 0.001 && iterations < 20) {
                iterations++;
                const eligible = [];
                let totalHeadroom = 0;
                for (let m = 0; m < 12; m++) {
                    const headroom = cap - result[m];
                    if ((nAllocations[m] || 0) > 0 && headroom > 0.001) {
                        eligible.push({ m, headroom });
                        totalHeadroom += headroom;
                    }
                }
                if (totalHeadroom < 0.001) break;
                const toPlace = Math.min(remaining, totalHeadroom);
                for (const { m, headroom } of eligible) {
                    result[m] = Math.min(cap, result[m] + toPlace * (headroom / totalHeadroom));
                }
                redistributed += toPlace;
                remaining -= toPlace;
            }
            unschedulable = Math.max(0, remaining);
        }

        const scheduledTotal = Object.values(result).reduce((s, v) => s + v, 0);

        return {
            allocations: result,
            capApplied: overflow > 0.001,
            redistributed: Math.round(redistributed * 10) / 10,
            unschedulable: Math.round(unschedulable * 10) / 10,
            originalTotal: Math.round(originalTotal * 10) / 10,
            scheduledTotal: Math.round(scheduledTotal * 10) / 10,
        };
    };

    // ========================================================================
    // PROGRAM GENERATION
    // ========================================================================

    /**
     * Generate the full nutrition program
     * 
     * N-driven approach based on research:
     * - Annual N is primary driver (user input or surface-type default)
     * - Other nutrients calculated as ratios of N (tissue composition)
     * - Clipping management affects all nutrient requirements
     * - MLSN deficits added on top for P, K, Ca, Mg, S
     */
    /**
     * b35fix304 Task 2: DOM-free helper to read ammonium-acetate soil texture key.
     * Used by the wrapper to populate inputs.aaTextureKey so computeProgram stays pure.
     */
    NutritionCalendar._collectAATexture = function() {
        if (typeof document === 'undefined') return null;
        const textureEl = document.querySelector('.gaip-aa-soil-texture');
        return (textureEl?.value || 'sands').toLowerCase();
    };

    /**
     * b35fix304 Task 2: Pure programme compute.
     *
     * No DOM reads, no global writes, no event dispatch.
     *
     * @param {object} inputs - Shape returned by collectFromState(), plus
     *                          optional aaTextureKey for AA methodology.
     *   { hemisphere, latitude, species, isC4, soilPpm, bulkDensity, soilDepth,
     *     methodology, monthlyTemps, annualNOverride, maxNPerMonth, distribution,
     *     traffic, surfaceType, clippingManagement, aaTextureKey? }
     *
     * @returns {object} Program object on success:
     *   { meta, soil, annual_totals, adjustments, program: { monthly } }
     * or an error object on invalid input:
     *   { error: '<message>' }
     */
    NutritionCalendar.computeProgram = function(inputs) {
        // STEP 1: Validate Annual N (REQUIRED)
        if (!inputs || !inputs.annualNOverride || inputs.annualNOverride < 50) {
            return { error: 'Annual N target required (>= 50 kg/ha)' };
        }

        // GH-245: no real monthly climate normals resolved — do not compute
        // a monthly program against a fabricated regional guess. Hoxton
        // audit D02/D03. GH-245 follow-up 3: carry along why (site has no
        // coordinates, the fetch hasn't resolved yet, or NASA POWER and the
        // Open-Meteo fallback both genuinely failed) — callers that only
        // ever set monthlyTemps default to the last of those, the original
        // documented case.
        if (!inputs.monthlyTemps) {
            return { climateDataUnavailable: true, climateDataUnavailableReason: inputs.monthlyTempsUnavailableReason || 'fetch-failed' };
        }

        const baseAnnualN = inputs.annualNOverride;

        // Traffic modifier - only applies if explicitly high/extreme
        const trafficMod = CONFIG.trafficModifiers[inputs.traffic] || 1.0;
        const annualN = Math.round(baseAnnualN * trafficMod);

        // ================================================================
        // STEP 2: Calculate base nutrient removal (N-driven ratios)
        // ================================================================
        const baseRemoval = {
            N: annualN,
            P: Math.round(annualN * CONFIG.nutrientRatiosToN.P),
            K: Math.round(annualN * CONFIG.nutrientRatiosToN.K),
            Ca: Math.round(annualN * CONFIG.nutrientRatiosToN.Ca),
            Mg: Math.round(annualN * CONFIG.nutrientRatiosToN.Mg),
            S: Math.round(annualN * CONFIG.nutrientRatiosToN.S),
        };

        // ================================================================
        // STEP 3: Apply clipping management factor
        // ================================================================
        const clipMgmt = CONFIG.clippingManagement[inputs.clippingManagement] || CONFIG.clippingManagement.collected;
        const adjustedRemoval = {
            N: Math.round(baseRemoval.N * clipMgmt.nFactor),
            P: Math.round(baseRemoval.P * clipMgmt.pFactor),
            K: Math.round(baseRemoval.K * clipMgmt.kFactor),
            Ca: Math.round(baseRemoval.Ca * clipMgmt.kFactor), // Use K factor for Ca/Mg/S
            Mg: Math.round(baseRemoval.Mg * clipMgmt.kFactor),
            S: Math.round(baseRemoval.S * clipMgmt.kFactor),
        };

        // ================================================================
        // STEP 4: Calculate deficits and correction based on methodology
        // ================================================================
        const deficits = {};
        const annualCorrection = {};
        const methodologyUsed = inputs.methodology || 'mlsn';
        const aaTextureKey = inputs.aaTextureKey != null ? inputs.aaTextureKey : null;

        ['P', 'K', 'Ca', 'Mg', 'S'].forEach(nutrient => {
            const deficit = this.calculateDeficit(
                inputs.soilPpm[nutrient],
                nutrient,
                inputs.bulkDensity,
                inputs.soilDepth,
                methodologyUsed,
                aaTextureKey
            );
            deficits[nutrient] = deficit;
            annualCorrection[nutrient] = deficit / (CONFIG.yearsToCorrect[nutrient] || 2);
        });

        // ================================================================
        // STEP 5: Calculate final annual requirements
        // ================================================================
        // Research: Kopp & Guillard (2002) - 33-50% N reduction with clipping return
        const adjustedAnnualN = Math.round(annualN * clipMgmt.nFactor);

        const annualRequirements = {
            N: adjustedAnnualN,
            P: Math.round(adjustedRemoval.P + annualCorrection.P),
            K: Math.round(adjustedRemoval.K + annualCorrection.K),
            Ca: Math.round(adjustedRemoval.Ca + annualCorrection.Ca),
            Mg: Math.round(adjustedRemoval.Mg + annualCorrection.Mg),
            S: Math.round(adjustedRemoval.S + annualCorrection.S),
        };

        // Calculate monthly GP
        const monthlyGP = this.calculateMonthlyGP(inputs.monthlyTemps, inputs.isC4);
        const distributions = {};
        Object.keys(annualRequirements).forEach(nutrient => {
            distributions[nutrient] = this.distributeByGP(
                annualRequirements[nutrient],
                monthlyGP,
                inputs.distribution
            );
        });

        // Apply N cap
        const nCapResult = this.applyNCap(distributions.N, inputs.maxNPerMonth);
        distributions.N = nCapResult.allocations;

        // Build monthly program
        const seasons = inputs.hemisphere === 'south' ? CONFIG.seasonsSouth : CONFIG.seasonsNorth;
        const monthly = [];

        for (let m = 0; m < 12; m++) {
            monthly.push({
                month_num: m,
                month_name: CONFIG.monthNames[m],
                season: seasons[m],
                gp: Math.round(monthlyGP[m] * 100) / 100,
                temp: Math.round((inputs.monthlyTemps[m] || 15) * 10) / 10,
                N: Math.round(distributions.N[m] * 10) / 10,
                P: Math.round(distributions.P[m] * 10) / 10,
                K: Math.round(distributions.K[m] * 10) / 10,
                Ca: Math.round(distributions.Ca[m] * 10) / 10,
                Mg: Math.round(distributions.Mg[m] * 10) / 10,
                S: Math.round(distributions.S[m] * 10) / 10,
            });
        }

        return {
            meta: {
                generated: new Date().toISOString(),
                version: CONFIG.version,
                methodology: (inputs.methodology || 'mlsn').toUpperCase(),
                species: inputs.species,
                speciesDisplay: inputs.speciesDisplay || null,
                surfaceType: inputs.surfaceType,
                hemisphere: inputs.hemisphere,
                distribution: inputs.distribution,
                clippingManagement: inputs.clippingManagement,
            },
            soil: {
                ppm: inputs.soilPpm,
                deficits: deficits,
                methodology: inputs.methodology,
            },
            annual_totals: annualRequirements,
            adjustments: {
                n_cap_applied: nCapResult.capApplied,
                original_n_total: nCapResult.originalTotal,
                scheduled_n_total: nCapResult.scheduledTotal,
                n_redistributed: nCapResult.redistributed,
                n_unschedulable: nCapResult.unschedulable,
                traffic_modifier: trafficMod,
                clipping_management: inputs.clippingManagement,
                clipping_factors: clipMgmt,
                target_n: annualN,           // Pre-clipping target
                applied_n: adjustedAnnualN,  // Post-clipping (what's actually applied)
                n_recycled: annualN - adjustedAnnualN, // N returned via clippings
            },
            program: {
                monthly: monthly,
            },
        };
    };

    // GH-246: busy state for the Generate button while an on-demand climate
    // fetch is in flight — same disable+label-swap pattern as the Re-run
    // button (dashboard-ui.js), no spinner since this button is plain text.
    NutritionCalendar._setGenerateBusy = function(isBusy) {
        const btn = this.elements.generateBtn;
        if (!btn) return;
        if (isBusy) {
            btn.dataset.origText = btn.textContent;
            btn.disabled = true;
            btn.textContent = 'Fetching climate data…';
        } else {
            btn.disabled = false;
            if (btn.dataset.origText) btn.textContent = btn.dataset.origText;
        }
    };

    /**
     * Thin wrapper: DOM/state → computeProgram → render + dispatch.
     *
     * Keep this function small. All programme math lives in computeProgram().
     */
    NutritionCalendar.generate = async function() {
        // Sync soil data from DOM to GAIP_STATE first
        this.syncSoilFromDOM();

        let inputs = this.collectFromState();
        inputs.aaTextureKey = this._collectAATexture();

        // Keep the original user-facing validation (alert + focus) in the wrapper.
        // computeProgram() also rejects annualNOverride < 50 via error object, but
        // we short-circuit here so the user sees the alert with suggested ranges.
        if (!inputs.annualNOverride || inputs.annualNOverride < 50) {
            alert('Please enter your Annual N Target (kg/ha).\n\nTypical ranges:\n• Greens: 80-150\n• Tees: 120-180\n• Fairways: 150-250\n• Sports fields: 180-350');
            if (this.elements.annualNInput) {
                this.elements.annualNInput.focus();
            }
            return;
        }

        // GH-246: pages that opt out of climate-normals-service.js's eager
        // on-load fetch (Plan — see GAIP_CLIMATE_NORMALS_SKIP_AUTOTRIGGER)
        // never have monthlyTemps in memory yet at this point. Fetch it now,
        // on demand, the same way exportToWord() already does via
        // ensureFromPage() — a no-op if normals already resolved this page
        // load (in-memory per-coordinate cache in climate-normals-service.js).
        if (!inputs.monthlyTemps && window.GilbaClimateNormalsService &&
            typeof window.GilbaClimateNormalsService.ensureFromPage === 'function') {
            this._setGenerateBusy(true);
            try {
                await window.GilbaClimateNormalsService.ensureFromPage();
            } finally {
                this._setGenerateBusy(false);
            }
            inputs = this.collectFromState();
            inputs.aaTextureKey = this._collectAATexture();
        }

        // b35fix382 INSTRUMENTATION — paired with [CombinedExport b35fix382]
        // calendar PRE-compute log in word-export-combined.js. Same shape,
        // different `path` tag, lets us diff calendar inputs per path.
        try {
            var _activeSampleId = null;
            try {
                if (window.GAIP_SampleManager && typeof window.GAIP_SampleManager.getActiveSampleId === 'function') {
                    _activeSampleId = window.GAIP_SampleManager.getActiveSampleId('soil');
                }
            } catch (e) { /* ignore */ }
            console.log('[NutritionCalendar b35fix382] calendar PRE-compute inputs:', {
                path: 'live-preview-calendar',
                sampleId: _activeSampleId,
                soilPpm: inputs.soilPpm,
                bulkDensity: inputs.bulkDensity,
                soilDepth: inputs.soilDepth,
                methodology: inputs.methodology,
                annualNOverride: inputs.annualNOverride,
                species: inputs.species,
                clippingManagement: inputs.clippingManagement,
                traffic: inputs.traffic,
                surfaceType: inputs.surfaceType,
            });
        } catch (_e) {
            console.warn('[NutritionCalendar b35fix382] PRE-compute log failed:', _e && _e.message);
        }

        const program = this.computeProgram(inputs);
        if (program.climateDataUnavailable) {
            this.renderClimateUnavailableBanner();
            return;
        }
        if (program.error) {
            console.warn('[NutritionCalendar]', program.error);
            return;
        }

        // b35fix382 INSTRUMENTATION — POST-compute calendar output. Diff
        // annualK between this and the [CombinedExport b35fix382] POST log
        // for the same sampleId to find where the K target diverges.
        try {
            console.log('[NutritionCalendar b35fix382] calendar POST-compute output:', {
                path: 'live-preview-calendar',
                annualN: program.annual_totals && program.annual_totals.N,
                annualK: program.annual_totals && program.annual_totals.K,
                annualP: program.annual_totals && program.annual_totals.P,
                soilSeenK: program.soil && program.soil.ppm && program.soil.ppm.K,
                methodology: program.meta && program.meta.methodology,
                adjustments_K: program.adjustments && program.adjustments.K,
            });
        } catch (_e) {
            console.warn('[NutritionCalendar b35fix382] POST-compute log failed:', _e && _e.message);
        }

        this.program = program;

        // Persist so the results panel can be redisplayed after a page reload
        // without re-entering inputs (see restoreFromPersisted() below). Keyed
        // separately from the regional-integration "nutritionProgram" (product
        // recommendations, different shape — see nutrition-prebble/au/uk/nz-
        // fertiliser-integration.js) which is what Word export reads.
        //
        // maxNPerMonth is persisted alongside it (not embedded in `program` —
        // computeProgram()'s adjustments only carry the RESULT of the cap
        // — n_cap_applied, n_unschedulable — not the cap threshold itself).
        // distribution/clippingManagement don't need a separate key: they're
        // already on program.meta, read from there by the per-sample
        // recompute fallback in word-export-combined.js.
        this.persistSiteConfigPatch({
            nutritionCalendarProgram: program,
            maxNPerMonth: inputs.maxNPerMonth
        });

        // Render results
        this.renderResults();
        this.showResults();

        // Dispatch event for Prebble integration
        console.log('[NutritionCalendar] Dispatching gaip:nutrition-calendar-generated, program keys:', Object.keys(this.program || {}));
        document.dispatchEvent(new CustomEvent('gaip:nutrition-calendar-generated', {
            detail: { program: this.program }
        }));

        return this.program;
    };

    // ========================================================================
    // RENDERING
    // ========================================================================

    NutritionCalendar.renderResults = function() {
        if (!this.program) return;
        
        this.renderSummary();
        this.renderCalendar();
    };

    NutritionCalendar.renderSummary = function() {
        const summary = this.elements.summary;
        if (!summary) return;

        const p = this.program;
        const totals = p.annual_totals;
        const meta = p.meta;

        const clipLabel = meta.clippingManagement === 'collected' ? 'Collected' : 'Returned';

        summary.innerHTML = `
            <div class="gilba-nut-summary">
                <div class="gilba-nut-meta-grid">
                    <div class="gilba-nut-meta-item">
                        <div class="gilba-nut-meta-label">Species</div>
                        <div class="gilba-nut-meta-val">${this.formatSpecies(meta.speciesDisplay || meta.species)}</div>
                    </div>
                    <div class="gilba-nut-meta-item">
                        <div class="gilba-nut-meta-label">Methodology</div>
                        <div class="gilba-nut-meta-val">${this.formatMethodology(meta.methodology)}</div>
                    </div>
                    <div class="gilba-nut-meta-item">
                        <div class="gilba-nut-meta-label">Distribution</div>
                        <div class="gilba-nut-meta-val">${this.formatDistribution(meta.distribution)}</div>
                    </div>
                    <div class="gilba-nut-meta-item">
                        <div class="gilba-nut-meta-label">Clippings</div>
                        <div class="gilba-nut-meta-val">${clipLabel}${p.adjustments.n_recycled > 0 ? ` <span class="gilba-nut-recycled-badge">${p.adjustments.n_recycled} kg N recycled</span>` : ''}</div>
                    </div>
                </div>

                ${p.adjustments.n_recycled > 0 ? `
                    <div class="gilba-nut-banner gilba-nut-banner--good">
                        <strong>Clipping Recycling:</strong> Target ${p.adjustments.target_n} kg N/ha reduced to
                        <strong>${p.adjustments.applied_n} kg N/ha</strong> applied
                        (${p.adjustments.n_recycled} kg N/ha returned via clippings).
                        <em>Ref: Kopp &amp; Guillard 2002</em>
                    </div>
                ` : ''}

                <div class="gilba-nut-section-label">Annual Requirements (kg/ha)</div>
                <div class="gilba-nut-totals-row">
                    ${['N','P','K','Ca','Mg','S'].map(el => `
                        <div class="gilba-nut-total${el === 'N' ? ' gilba-nut-total--n' : ''}">
                            <div class="gilba-nut-total-val">${totals[el]}</div>
                            <div class="gilba-nut-total-name">${el}</div>
                            <div class="gilba-nut-total-unit">kg/ha/yr</div>
                        </div>
                    `).join('')}
                </div>

                ${p.adjustments.n_cap_applied ? (
                    p.adjustments.n_unschedulable > 0 ? `
                    <div class="gilba-nut-banner gilba-nut-banner--warning">
                        <strong>Monthly N cap too low:</strong>
                        Target ${p.adjustments.original_n_total} kg/ha — ${p.adjustments.n_unschedulable} kg/ha cannot be scheduled within the cap. Scheduled: ${p.adjustments.scheduled_n_total} kg/ha.
                    </div>
                ` : `
                    <div class="gilba-nut-banner gilba-nut-banner--good">
                        <strong>Monthly N cap applied:</strong>
                        Peak months trimmed, ${p.adjustments.n_redistributed} kg/ha redistributed to shoulder months. Full target of ${p.adjustments.original_n_total} kg/ha delivered.
                    </div>
                `) : ''}
            </div>
        `;
    };

    /**
     * GH-245: shown instead of the monthly table when neither real
     * climate-normals source (NASA POWER, Open-Meteo fallback) resolved for
     * this site. No fabricated Monthly Schedule is rendered — see Hoxton
     * audit D03. Message is deliberately non-technical (client-facing) —
     * source/provenance detail lives in the opt-in "i" tooltip instead.
     */
    NutritionCalendar.renderClimateUnavailableBanner = function() {
        const calendar = this.elements.calendar;
        this.program = null;
        // Read by every product recommender (AU/NZ/UK/Prebble integrations)
        // that consumes calendar.program — they receive null and must not
        // treat that as "just no program yet". Also read by word-export.js
        // so the docx Nutrition Program section explains the gap instead of
        // silently vanishing. Cleared by each recommender once it produces a
        // real program again. See Hoxton audit D02/D03.
        window.GAIP_NUTRITION_PROGRAM_UNAVAILABLE = true;
        if (!calendar) return;
        calendar.innerHTML = `
            <div class="gilba-nut-banner gilba-nut-banner--warning">
                <strong>Climate data unavailable</strong>
                We couldn't load climate data for this site. Please try again in a moment.
            </div>
        `;
    };

    NutritionCalendar.renderCalendar = function() {
        const calendar = this.elements.calendar;
        if (!calendar || !this.program) return;

        const monthly = this.program.program.monthly;

        const rows = monthly.map(m => {
            const gpPct = Math.round(m.gp * 100);
            const gpClass = gpPct >= 50 ? 'high' : (gpPct >= 25 ? 'medium' : 'low');
            return `
                <tr class="gilba-nut-row">
                    <td class="gilba-nut-cell gilba-nut-cell--month">${m.month_name}</td>
                    <td class="gilba-nut-cell gilba-nut-cell--season">${m.season}</td>
                    <td class="gilba-nut-cell gilba-nut-cell--gp">
                        <span class="gilba-nut-gp-badge gilba-nut-gp-badge--${gpClass}">${gpPct}%</span>
                    </td>
                    <td class="gilba-nut-cell gilba-nut-cell--val gilba-nut-cell--n">${m.N.toFixed(1)}</td>
                    <td class="gilba-nut-cell gilba-nut-cell--val">${m.P.toFixed(1)}</td>
                    <td class="gilba-nut-cell gilba-nut-cell--val">${m.K.toFixed(1)}</td>
                    <td class="gilba-nut-cell gilba-nut-cell--val">${m.Ca.toFixed(1)}</td>
                    <td class="gilba-nut-cell gilba-nut-cell--val">${m.Mg.toFixed(1)}</td>
                    <td class="gilba-nut-cell gilba-nut-cell--val">${m.S.toFixed(1)}</td>
                </tr>
            `;
        }).join('');

        calendar.innerHTML = `
            <div class="gilba-nut-section-label" style="display: flex; align-items: center; gap: 6px;">
                Monthly Nutrient Program (kg/ha)
                <span class="db-info-icon" data-info="monthly-climate-normals" tabindex="0" role="button" aria-label="About the monthly temperatures used here">i</span>
            </div>
            <div class="gilba-nut-table-wrap">
                <table class="gilba-nut-table">
                    <thead>
                        <tr>
                            <th class="gilba-nut-th gilba-nut-th--left">Month</th>
                            <th class="gilba-nut-th gilba-nut-th--left">Season</th>
                            <th class="gilba-nut-th">GP</th>
                            <th class="gilba-nut-th">N</th>
                            <th class="gilba-nut-th">P</th>
                            <th class="gilba-nut-th">K</th>
                            <th class="gilba-nut-th">Ca</th>
                            <th class="gilba-nut-th">Mg</th>
                            <th class="gilba-nut-th">S</th>
                        </tr>
                    </thead>
                    <tbody>${rows}</tbody>
                </table>
            </div>
            <div class="gilba-nut-actions">
                <button type="button" class="plan-btn-secondary gilba-nut-export-btn" onclick="GilbaNutritionCalendar.exportCSV()">
                    <svg width="12" height="12" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2"><path stroke-linecap="round" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4"/></svg>
                    Export CSV
                </button>
            </div>
        `;
    };

    NutritionCalendar.showResults = function() {
        if (this.elements.results) {
            this.elements.results.style.display = 'block';
        }
    };

    // ========================================================================
    // UTILITIES
    // ========================================================================

    NutritionCalendar.formatSpecies = function(species) {
        const names = {
            perennialRyegrass: 'Perennial Ryegrass',
            kentuckyBluegrass: 'Kentucky Bluegrass',
            bentgrass: 'Creeping Bentgrass',
            // b35fix306: defensive — SpeciesController.toNutrientKey produces these
            // camelCase nutrient-engine keys. Without entries they leaked raw to UI.
            creepingBentgrass: 'Creeping Bentgrass',
            browntopBent: 'Browntop Bent',
            fineFescue: 'Fine Fescue',
            tallFescue: 'Tall Fescue',
            bermuda: 'Bermudagrass',
            couch: 'Couch',
            zoysiagrass: 'Zoysiagrass',
            kikuyu: 'Kikuyu',
            buffalo: 'Buffalo',
            seashorePaspalum: 'Seashore Paspalum',
        };
        return names[species] || species;
    };

    NutritionCalendar.formatDistribution = function(method) {
        const labels = {
            gp_weighted: 'GP-Weighted',
            even: 'Even Monthly',
            front_loaded: 'Front-Loaded',
        };
        return labels[method] || method;
    };

    NutritionCalendar.formatMethodology = function(methodology) {
        const m = (methodology || 'mlsn').toLowerCase();
        if (m === 'ammonium_acetate' || m === 'ammoniumacetate' || m === 'aa') {
            return 'Ammonium Acetate';
        }
        return (methodology || 'MLSN').toUpperCase();
    };

    NutritionCalendar.exportCSV = function() {
        if (!this.program) {
            alert('No program to export. Generate first.');
            return;
        }

        const p = this.program;
        let csv = 'Month,Season,GP (%),N (kg/ha),P (kg/ha),K (kg/ha),Ca (kg/ha),Mg (kg/ha),S (kg/ha)\n';

        p.program.monthly.forEach(m => {
            csv += [
                m.month_name,
                m.season,
                Math.round(m.gp * 100),
                m.N.toFixed(1),
                m.P.toFixed(1),
                m.K.toFixed(1),
                m.Ca.toFixed(1),
                m.Mg.toFixed(1),
                m.S.toFixed(1),
            ].join(',') + '\n';
        });

        // Totals row
        const t = p.annual_totals;
        csv += `TOTAL,,,"${t.N}","${t.P}","${t.K}","${t.Ca}","${t.Mg}","${t.S}"\n`;

        // Download
        const blob = new Blob([csv], { type: 'text/csv' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `nutrition-program-${new Date().toISOString().split('T')[0]}.csv`;
        a.click();
        URL.revokeObjectURL(url);
    };

    /**
     * Persist a patch into the active site's server-side "gaip" config, without
     * clobbering other keys already saved there (turf, location, etc.).
     *
     * Two call sites exist for this data (this module's own generate(), and the
     * regional nutrition-prebble/au/uk/nz-fertiliser-integration.js modules), and
     * two very different pages run them:
     *   - Hub pages (Reports > Export's hidden runner, /hub) load
     *     site-config-persistence.js, which owns an in-memory config cache +
     *     localStorage + debounced server sync — route through its
     *     GAIP_SiteConfig.mergeConfig() so this stays consistent with everything
     *     else that module already persists.
     *   - Plan > Nutrition (plan.blade.php) is a lightweight page that never loads
     *     site-config-persistence.js (confirmed via console: GAIP_SiteConfig is
     *     undefined there) — but it already has the current config server-rendered
     *     into window.GAIP_SITE_CONFIG and the site id in
     *     window.GAIP_HUB_CONFIG.activeSiteId, so PUT directly to the same
     *     /sites/{id}/config/gaip endpoint (SiteController::updateConfig — a full
     *     replace of the config column, hence merging into GAIP_SITE_CONFIG first).
     */
    /**
     * Resolve the active site id regardless of which page/script-stack is
     * running: GAIP_SampleManager on hub pages, GAIP_HUB_CONFIG.activeSiteId
     * (server-rendered on every db-shell page, see layouts/db-shell.blade.php)
     * as the fallback for lightweight pages like plan.blade.php.
     */
    NutritionCalendar.getActiveSiteId = function() {
        if (window.GAIP_SampleManager && typeof window.GAIP_SampleManager.getActiveSiteId === 'function') {
            const id = window.GAIP_SampleManager.getActiveSiteId();
            if (id) return id;
        }
        const hub = window.GAIP_HUB_CONFIG || {};
        return hub.activeSiteId || null;
    };

    NutritionCalendar.persistSiteConfigPatch = function(patch) {
        const siteId = this.getActiveSiteId();
        console.log('[NutritionCalendar] persist-debug: persistSiteConfigPatch siteId=', siteId,
            'GAIP_SiteConfig?', !!window.GAIP_SiteConfig);
        if (!siteId) {
            console.warn('[NutritionCalendar] persist-debug: SKIPPED — no active site id');
            return false;
        }
        try {
            if (window.GAIP_SiteConfig && typeof window.GAIP_SiteConfig.mergeConfig === 'function') {
                const ok = window.GAIP_SiteConfig.mergeConfig(siteId, patch);
                console.log('[NutritionCalendar] persist-debug: mergeConfig() returned', ok);
                return ok;
            }

            const hub = window.GAIP_HUB_CONFIG || {};
            if (!hub.restUrl) {
                console.warn('[NutritionCalendar] persist-debug: SKIPPED — no GAIP_HUB_CONFIG.restUrl');
                return false;
            }

            window.GAIP_SITE_CONFIG = Object.assign({}, window.GAIP_SITE_CONFIG || {}, patch, {
                savedAt: new Date().toISOString()
            });

            var _putUrl = hub.restUrl.replace(/\/?$/, '/') + 'sites/' + encodeURIComponent(siteId) + '/config/gaip';
            console.log('[NutritionCalendar] persist-debug: PUT', _putUrl, 'body keys=',
                Object.keys(window.GAIP_SITE_CONFIG), 'csrfTokenPresent=', !!hub.csrfToken);
            fetch(_putUrl, {
                method: 'PUT',
                credentials: 'same-origin',
                headers: {
                    'Content-Type': 'application/json',
                    'Accept': 'application/json',
                    'X-CSRF-TOKEN': hub.csrfToken || ''
                },
                body: JSON.stringify({ config: window.GAIP_SITE_CONFIG })
            }).then(function(r) {
                r.text().then(function(bodyText) {
                    console.log('[NutritionCalendar] persist-debug: direct PUT response status', r.status,
                        'ok=', r.ok, 'body=', bodyText.slice(0, 500));
                });
            }).catch(function(err) {
                console.warn('[NutritionCalendar] persist-debug: direct PUT failed', err && err.message);
            });
            return true;
        } catch (e) {
            console.warn('[NutritionCalendar] persistSiteConfigPatch threw', e && e.message);
            return false;
        }
    };

    NutritionCalendar.getProgram = function() {
        return this.program;
    };

    /**
     * Re-render the results panel from a previously generated (and persisted)
     * program, e.g. after a page reload — without requiring the user to
     * re-enter Annual N Target and click Generate again.
     *
     * Two sources depending on the page (see persistSiteConfigPatch() above for
     * why there are two paths):
     *   - window.GAIP_NUTRITION_CALENDAR_PROGRAM — set by site-config-persistence.js
     *     restoreConfig() once its page-load cascade completes (hub pages only).
     *   - window.GAIP_SITE_CONFIG.nutritionCalendarProgram — server-rendered
     *     directly into the page on load, available synchronously (plan.blade.php,
     *     which never loads site-config-persistence.js).
     * Deliberately NOT window.GAIP_NUTRITION_PROGRAM — that's the regional
     * integrations' product-recommendation object (different shape, see
     * nutrition-prebble/au/uk/nz-fertiliser-integration.js), consumed by Word
     * export, not by this panel.
     */
    NutritionCalendar.restoreFromPersisted = function() {
        // Independent of the program restore below — repopulate "Current Monthly
        // N Rate" whenever we have a persisted value, whether or not a program
        // was ever generated this session.
        if (this.elements.monthlyNInput && !this.elements.monthlyNInput.value) {
            const _persistedMonthlyN = window.GAIP_SITE_CONFIG && window.GAIP_SITE_CONFIG.appliedMonthlyN;
            if (_persistedMonthlyN != null) {
                this.elements.monthlyNInput.value = _persistedMonthlyN;
            }
        }

        const program = window.GAIP_NUTRITION_CALENDAR_PROGRAM
            || (window.GAIP_SITE_CONFIG && window.GAIP_SITE_CONFIG.nutritionCalendarProgram);
        console.log('[NutritionCalendar] persist-debug: restoreFromPersisted() called. ' +
            'this.program already set? ' + !!this.program +
            ' persisted program present? ' + !!program);
        if (this.program) {
            console.log('[NutritionCalendar] persist-debug: SKIPPED — this.program already set (user already generated this session)');
            return; // don't clobber a program the user just generated
        }
        if (!program || !program.annual_totals) {
            console.log('[NutritionCalendar] persist-debug: SKIPPED — no persisted program, or missing annual_totals. program=', program);
            return;
        }

        if (!this.elements.results) this.init();
        if (!this.elements.results) {
            console.warn('[NutritionCalendar] persist-debug: SKIPPED — [data-nutrition-results] element not found even after init()');
            return;
        }

        console.log('[NutritionCalendar] persist-debug: restoring panel from persisted program', program);
        this.program = program;
        if (this.elements.annualNInput && program.adjustments) {
            this.elements.annualNInput.value = Math.round(program.adjustments.target_n);
        }
        if (this.elements.distributionSelect && program.meta && program.meta.distribution) {
            this.elements.distributionSelect.value = program.meta.distribution;
        }
        if (this.elements.clippingSelect && program.meta && program.meta.clippingManagement) {
            this.elements.clippingSelect.value = program.meta.clippingManagement;
        }
        if (this.elements.maxNInput && window.GAIP_SITE_CONFIG && window.GAIP_SITE_CONFIG.maxNPerMonth > 0) {
            this.elements.maxNInput.value = window.GAIP_SITE_CONFIG.maxNPerMonth;
        }

        this.renderResults();
        this.showResults();
    };

    // ========================================================================
    // EXPORT
    // ========================================================================

    window.GilbaNutritionCalendar = NutritionCalendar;

    // Auto-init on DOM ready and on analysis complete
    function tryInit() {
        NutritionCalendar.init();
    }

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', tryInit);
    } else {
        tryInit();
    }

    // Re-init when results section becomes visible
    document.addEventListener('gaip:analysis-complete', () => {
        setTimeout(tryInit, 100);
    });

    // Restore last-generated program once site-config-persistence.js has finished
    // restoring the active site's saved config (which now includes nutritionProgram).
    document.addEventListener('gaip:site-config-applied', () => {
        console.log('[NutritionCalendar] persist-debug: gaip:site-config-applied received');
        NutritionCalendar.restoreFromPersisted();
    });

})();

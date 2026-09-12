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
 *                      thin wrapper.
 *   GH-384/GH-388:     computeProgram()'s per-nutrient arithmetic delegates to
 *                      assets/nutrition-requirement-core.js and its sufficiency
 *                      ranges to assets/nutrition-program-inputs.js, so this
 *                      file and the Word export compute from one implementation.
 *                      The private threshold tables, calculateDeficit(),
 *                      getThresholds() and the aaTextureKey plumbing went with
 *                      the cutover.
 */

(function() {
    'use strict';

    // ========================================================================
    // CONFIGURATION
    // ========================================================================

    const CONFIG = {
        version: '2.5.0',
        
        // GH-388: the MLSN / SLAN / AA threshold tables that used to live here
        // are gone. They were this file's private second copy of the numbers
        // assets/nutrition-requirement-core.js holds (MLSN_THRESHOLDS,
        // SLAN_RANGES_FALLBACK) and that the shared resolver
        // assets/nutrition-program-inputs.js resolveSufficiencyRanges() reads
        // from gaip-classification-constants.js — a second copy of exactly the
        // arithmetic D31 exists to de-duplicate, left behind by GH-384's
        // cutover with no caller anywhere in assets/, app/ or tests/. The AA
        // texture-only single-value table went with them: the certificate /
        // generic-band resolution replaced it at GH-308.

        // Years to spread deficit correction
        yearsToCorrect: { P: 2, K: 2, Ca: 3, Mg: 3, S: 2 },
        
        // Default soil parameters
        defaultSoilDepth: 10,  // cm
        defaultBulkDensity: 1.4,  // g/cm³
        
        // GH-398 (D31 stage 4): CONFIG.minGpThreshold is gone. The 0.10
        // activity threshold was written here AND in
        // nutrition-requirement-engine.js as MIN_GP_THRESHOLD, one number in
        // two files deciding which months a programme touches. It now lives
        // once, in assets/nutrition-monthly-distribution.js, with the
        // weighting that reads it.

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
        // GH-384 (decision D-5): RETIRED. This one flat set was applied to
        // every species, while nutrition-requirement-engine.js used the
        // per-species REMOVAL_RATES table for the same quantity — one of the
        // divergences the D31 audit is about. Both surfaces now use the
        // species table, in assets/nutrition-requirement-core.js. The numbers
        // are kept here, unreferenced, as the record of what the Plan page
        // printed before the cutover: K moves by -3% on bentgrass and +14% on
        // buffalo, Ca/Mg/S move on every site, P is unchanged (P/N is 0.10 in
        // every row of the species table too).
        _retiredNutrientRatiosToN_gh384: {
            P: 0.10, K: 0.55, Ca: 0.17, Mg: 0.08, S: 0.05,
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
        //
        // GH-383 comment correction: the P/K factors below were described here
        // as "for informational purposes only... not currently applied". That
        // was FALSE of this file's own code — computeProgram()'s STEP 3 has
        // always applied them to adjustedRemoval, unconditionally, and Ca/Mg/S
        // reuse the K factor. The claim mattered: it is why
        // nutrition-requirement-engine.js was left with a different (uncited,
        // MLSN-only, opposite-polarity) clipping model for years. Both engines
        // now share this exact table via
        // assets/nutrition-requirement-core.js CLIPPING_FACTORS.
        // ====================================================================
        clippingManagement: {
            collected: {
                // All removed nutrients must be replaced
                nFactor: 1.0,
                pFactor: 1.0,
                kFactor: 1.0,
            },
            returned: {
                // The N target is the user's own and is not reduced; P and K
                // ARE reduced, here and in the shared core.
                nFactor: 1.0,   // No adjustment - user knows their site
                pFactor: 0.4,   // Reference: 60% recycling efficiency
                kFactor: 0.5,   // Reference: 50% recycling efficiency
            },
        },
        
        // Traffic modifiers (affects wear/recovery, hence nutrient demand).
        // GH-383: this table is now the SSOT copy in
        // assets/nutrition-program-inputs.js TRAFFIC_MODIFIERS, which scales
        // the annual N once for both surfaces, sports turf only (decisions
        // D-2/D-3). Kept here only for the pre-adapter fallback path below;
        // it must stay numerically identical to the adapter's copy, which
        // tests/gh383-nutrition-program-inputs.test.js asserts.
        trafficModifiers: { low: 0.85, moderate: 1.0, high: 1.15, extreme: 1.3 },
        
        // Month names
        monthNames: ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'],

        // GH-398: the two season maps that used to sit here are gone. They
        // were the same twelve labels nutrition-requirement-engine.js held in
        // its own getSeason(), written once in 0-11 and once in 1-12; the
        // shared distribution module now owns the single copy.
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
    // GH-383/GH-384/GH-398 — the three shared modules this file computes
    // through.
    //
    // Resolved lazily rather than captured at load time: the browser loads
    // them as plain <script>s (see the blade script lists), Node tests require
    // them, and a page that enqueued them after this file would otherwise lose
    // GilbaNutritionCalendar entirely instead of failing on first use with a
    // message that names the cause.
    // ========================================================================
    let _coreCached = null;
    function _requirementCore() {
        if (_coreCached) return _coreCached;
        _coreCached = (typeof window !== 'undefined' && window.NutritionRequirementCore) ||
            (typeof globalThis !== 'undefined' && globalThis.NutritionRequirementCore) || null;
        if (!_coreCached && typeof module !== 'undefined' && module.exports && typeof require === 'function') {
            try { _coreCached = require('./nutrition-requirement-core.js'); } catch (e) { /* not resolvable */ }
        }
        if (!_coreCached) {
            console.warn('[NutritionCalendar] GH-384: nutrition-requirement-core.js is not loaded — ' +
                'the nutrition programme cannot be computed. It must be enqueued before this file.');
        }
        return _coreCached;
    }

    let _inputsCached = null;
    function _programInputsAdapter() {
        if (_inputsCached) return _inputsCached;
        _inputsCached = (typeof window !== 'undefined' && window.GAIP_NutritionProgramInputs) ||
            (typeof globalThis !== 'undefined' && globalThis.GAIP_NutritionProgramInputs) || null;
        if (!_inputsCached && typeof module !== 'undefined' && module.exports && typeof require === 'function') {
            try { _inputsCached = require('./nutrition-program-inputs.js'); } catch (e) { /* not resolvable */ }
        }
        return _inputsCached;
    }

    // GH-398 (D31 stage 4): the GP-weighted monthly distribution, the monthly
    // N cap and the C3/C4 blend. This file held one copy and
    // nutrition-requirement-engine.js the other, which is why the Word export
    // could print an uncapped monthly series for a site whose Plan programme
    // was clamped at 15 kg N/month.
    let _distributionCached = null;
    function _monthlyDistribution() {
        if (_distributionCached) return _distributionCached;
        _distributionCached = (typeof window !== 'undefined' && window.GAIP_NutritionMonthlyDistribution) ||
            (typeof globalThis !== 'undefined' && globalThis.GAIP_NutritionMonthlyDistribution) || null;
        if (!_distributionCached && typeof module !== 'undefined' && module.exports && typeof require === 'function') {
            try { _distributionCached = require('./nutrition-monthly-distribution.js'); } catch (e) { /* not resolvable */ }
        }
        if (!_distributionCached) {
            console.warn('[NutritionCalendar] GH-398: nutrition-monthly-distribution.js is not loaded — ' +
                'the monthly programme cannot be built. It must be enqueued before this file.');
        }
        return _distributionCached;
    }

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
    /**
     * GH-414 — this site's tissue analyses, all of them, with the zone each was
     * taken from.
     *
     * The Plan page has never had this list. plan.blade.php's GH-366 bridge
     * carries ONE tissue reading (PageController::topbarData() takes the site's
     * most recent) and no zone label at all, so there was nothing to match
     * against even in principle, and collectFromState() handed that one reading
     * to every soil sample on the site. Same endpoint and same shape the soil
     * picker already uses (soil-nutrition-analysis.js mountSampleDropdown), one
     * fetch per page load.
     *
     * `_tissueSamples` stays null until the fetch resolves, and null means "not
     * known", never "this site has none" — resolveZoneTissue() falls back to the
     * pre-GH-414 chain in that case rather than silently dropping a tissue gate
     * because a request had not come back yet.
     */
    NutritionCalendar._tissueSamples = null;
    NutritionCalendar._tissueZoneMatch = null;

    NutritionCalendar.loadTissueSamples = function() {
        var self = this;
        var siteId = this.getActiveSiteId();
        if (!siteId || typeof fetch !== 'function') return Promise.resolve(null);
        return fetch('/api/samples?site_id=' + encodeURIComponent(siteId) + '&sample_type=tissue&limit=100',
            { headers: { Accept: 'application/json' }, credentials: 'same-origin' })
            .then(function (r) { return r.ok ? r.json() : Promise.reject(r.status); })
            .then(function (res) {
                var rows = (res && res.data) || [];
                self._tissueSamples = rows.map(function (s) {
                    var pl = s.payload || {};
                    return {
                        id: s.id,
                        label: pl._label || s.client_uid || String(s.id),
                        date: s.lab_date || s.sample_date || '',
                        N: pl.N, P: pl.P, K: pl.K
                    };
                });
                console.log('[NutritionCalendar] GH-414: ' + self._tissueSamples.length +
                    ' tissue sample(s) on this site: ' +
                    self._tissueSamples.map(function (t) { return t.label; }).join(', '));
                return self._tissueSamples;
            })
            .catch(function (e) {
                self._tissueSamples = null;
                console.warn('[NutritionCalendar] GH-414: tissue sample list could not be loaded (' + e +
                    '); falling back to the site-wide tissue reading, which is not zone-matched.');
                return null;
            });
    };

    /**
     * GH-414 — the tissue analysis for THIS soil sample's zone, or none.
     *
     * Returns `{ applies: false }` when the rule cannot be applied at all (list
     * not loaded, zone-key.js absent, or a soil analysis typed in by hand with
     * no zone), in which case the caller keeps its pre-GH-414 resolution.
     */
    NutritionCalendar.resolveZoneTissue = function(zoneLabel) {
        var list = this._tissueSamples;
        var NPI = window.GAIP_NutritionProgramInputs;
        if (!Array.isArray(list) || !NPI || typeof NPI.matchSampleToZone !== 'function' ||
            typeof window.GaipZoneKey === 'undefined') {
            this._tissueZoneMatch = null;
            return { applies: false };
        }
        if (!zoneLabel) {
            this._tissueZoneMatch = null;
            return { applies: false };
        }
        var hit = NPI.matchSampleToZone(list, zoneLabel);
        var num = function (v) { var n = parseFloat(v); return (isNaN(n) || n <= 0) ? null : n; };
        this._tissueZoneMatch = {
            zoneLabel: zoneLabel,
            matchedLabel: hit ? hit.label : null,
            siteHasTissue: list.length > 0
        };
        if (!hit) {
            if (list.length > 0) {
                console.log('[NutritionCalendar] GH-414: no tissue sample for zone "' + zoneLabel +
                    '" (site has ' + list.map(function (t) { return '"' + t.label + '"'; }).join(', ') +
                    ') — generic per-species P/K removal ratios used.');
            }
            return { applies: true, percent: null };
        }
        var src = hit.sample || {};
        return { applies: true, percent: { N: num(src.N), P: num(src.P), K: num(src.K) } };
    };

    NutritionCalendar.initSamplePicker = function() {
        var mount = document.getElementById('plan-nut-sample-picker');
        if (!mount) return;
        // GH-414: kicked off alongside the soil picker, on the one page that has
        // a picker at all, so the zone match has the list by the time Generate
        // is pressed.
        try { this.loadTissueSamples(); } catch (e) {
            console.warn('[NutritionCalendar] GH-414: tissue sample load failed:', e && e.message);
        }
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
            // GH-413: pH, CEC and the sample's own texture snapshot travel with
            // the ppm figures. Until this ticket only the nutrients were copied,
            // so collectFromState()'s `soil.pH_water ?? soil.pH` read resolved
            // null on EVERY generation and the pH-adjusted P floor (the SLAN
            // Spencer ladder and the MLSN D-7 ladder, both applied by
            // nutrition-program-inputs.js resolveSufficiencyRanges()) was dead
            // on this page while the Word export applied it — two Required P
            // figures for one sample (New test - location / Green 5, pH 8.26:
            // 15.6 on the Plan against 32.4 in the document).
            //
            // Key order is the export's own: `pH_Water` is the water-suspension
            // reading both surfaces prefer (word-export.js _pHForSlanP,
            // nutrition-calendar.js collectFromState), `pH` is the fallback for
            // a payload that carries only the generic key. `pH_CaCl2` is
            // deliberately NOT a fallback — it is a different measurement on a
            // different scale, and the ladders are defined against water pH.
            //
            // `soilTexture` is preserved from the existing state rather than
            // dropped: it is the site's own override, bridged in by
            // plan.blade.php (GH-294), and rebuilding the soil object without
            // it was silently removing the site texture on every sample switch.
            // `soilTextureSnapshot` is this sample's recorded texture, which
            // resolveSoilTexture() ranks BELOW the site override (GH-414).
            var soil = Object.assign({}, ppm, {
                ppm: ppm,
                methodology: pl.methodology || existingSoil.methodology,
                bulkDensity: pl.bulkDensity || existingSoil.bulkDensity,
                depth: pl.depth || existingSoil.depth,
                surfaceType: existingSoil.surfaceType,
                pH: pl.pH_Water != null ? pl.pH_Water : (pl.pH != null ? pl.pH : null),
                pH_water: pl.pH_Water != null ? pl.pH_Water : (pl.pH != null ? pl.pH : null),
                CEC: pl.CEC != null ? pl.CEC : (pl.CEC_meq100g != null ? pl.CEC_meq100g : null),
                soilTexture: existingSoil.soilTexture,
                soilTextureSnapshot: sample.soil_texture_snapshot || null,
                // GH-414: the zone this sample was taken from, so the tissue
                // match below can require the same zone.
                zoneLabel: pl._label || sample.client_uid || null,
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
                // GH-386: stored as a string, explicitly — the picker compares
                // the remembered id as a string (see soil-nutrition-analysis.js
                // _snSampleIdMatches), and relying on localStorage's implicit
                // coercion is what hid the mismatch in the first place.
                try { localStorage.setItem(storageKey(), String(sample.id)); } catch (e) {}
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
        // climateMetrics.latitude may be stale (still holding the previous
        // site's weather data before the climate engine re-runs).
        //
        // GH-371 (D01): "state.location is never populated" was true of the
        // legacy hub this comment originally described, but plan.blade.php's
        // own GAIP_STATE bridge (GH-366-era) now sets state.location.{lat,lon}
        // from $activeSite->latitude/longitude every page load — the one
        // reliably fresh, server-authoritative source on a page (like Plan)
        // that has no .gaip-lat/.gaip-lon DOM inputs at all. Added as a
        // fallback tier here, not a replacement for the DOM-first priority.
        const domLat = parseFloat(document.querySelector('.gaip-lat')?.value);
        const domLon = parseFloat(document.querySelector('.gaip-lon')?.value);
        const lat = (!isNaN(domLat) && domLat !== 0 ? domLat : null) ||
                    (state.inputs?.site?.latitude != null ? state.inputs?.site?.latitude : null) ||
                    (state.location?.lat != null ? state.location.lat : null) ||
                    (state.location?.latitude != null ? state.location.latitude : null) ||
                    climate.latitude ||
                    null;
        // GH-371 (D01): longitude was never resolved here at all before this
        // fix — nothing in this function needed it (hemisphere only needs
        // latitude's sign) until computeProgram() started stamping the
        // coordinates a programme was computed against, to detect a stale
        // cached copy surviving a site-record coordinate write. Same
        // priority chain as latitude, mirrored.
        const lon = (!isNaN(domLon) && domLon !== 0 ? domLon : null) ||
                    (state.inputs?.site?.longitude != null ? state.inputs?.site?.longitude : null) ||
                    (state.location?.lon != null ? state.location.lon : null) ||
                    (state.location?.lng != null ? state.location.lng : null) ||
                    (state.location?.longitude != null ? state.location.longitude : null) ||
                    climate.longitude ||
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

        // GH-361 (Hoxton audit D07a): tissue percentages, when a tissue
        // sample exists, so computeProgram() can derive the K/P removal
        // ratio from what this plant actually contains instead of always
        // falling back to the generic per-species removal-rate table's
        // composition.
        //
        // GH-362: reading `state.tissue` alone was not enough. Confirmed live
        // on the Plan page (Test5-NZ, a site that HAS a tissue sample on file):
        // GAIP_STATE carries turf/climate/location/inputs only, inputs holds
        // `soil` and nothing else, so `state.tissue` was undefined and the gate
        // never fired there — the export half applied it and the on-screen half
        // did not, which is precisely the UI-vs-export divergence the audit
        // raises at D31. Tissue is sourced the same way soil is (see
        // syncSoilFromDOM's PRIORITY 1 block, b35fix383): the active sample in
        // SampleManager is the real store; the state slots are checked first
        // in case a page bridge did populate them. Both legacy wrappers seen
        // in the wild are unwrapped — tissue-ui.js writes `{ tissue: {...},
        // units: {...} }` (word-export.js:8372 unwraps the same way) and the
        // hub store defaults `inputs.tissue` to `{ sampleDate, nutrients: {} }`.
        //
        // GH-414: and the sample it comes from must be the SAME GREEN as the
        // soil sample being computed. Neither of the two sources above knows
        // which green it is describing: `state.inputs.tissue` is the site's
        // single most recent tissue analysis (plan.blade.php's GH-366 bridge,
        // from PageController::topbarData()), and SampleManager's "active"
        // tissue sample is whichever one was loaded last. Measured live, that
        // meant Russley built Green 1's and Green 13's programmes from Green
        // 18's tissue, and Burns built all twenty-six from Green 15's. The Word
        // export has paired tissue to soil by zone since b35fix_greentissue;
        // this is that rule, from the same shared implementation
        // (GAIP_NutritionProgramInputs.matchSampleToZone -> GaipZoneKey.derive),
        // applied here. No pair -> no tissue, and the generic per-species
        // removal ratio, which is the owner's rule: pairing a green with
        // another green's tissue is worse than having none.
        const _zoneTissue = this.resolveZoneTissue(soil.zoneLabel || null);
        let tissuePercent;
        if (_zoneTissue.applies) {
            tissuePercent = _zoneTissue.percent || { N: null, P: null, K: null };
        } else {
            const _tissueSlot = (state.inputs && state.inputs.tissue) || state.tissue || {};
            const _tissueUnwrapped = _tissueSlot.tissue || _tissueSlot.nutrients || _tissueSlot;
            tissuePercent = {
                N: this.extractPpm(_tissueUnwrapped, 'N'),
                P: this.extractPpm(_tissueUnwrapped, 'P'),
                K: this.extractPpm(_tissueUnwrapped, 'K'),
            };
            if (tissuePercent.N == null || tissuePercent.P == null || tissuePercent.K == null) {
                try {
                    const SM = window.GAIP_SampleManager;
                    const activeTissue = (SM && typeof SM.getActiveSample === 'function')
                        ? SM.getActiveSample('tissue') : null;
                    if (activeTissue) {
                        const tSrc = activeTissue.normalized || activeTissue.rawData || {};
                        ['N', 'P', 'K'].forEach(function (nut) {
                            if (tissuePercent[nut] == null) {
                                const v = parseFloat(tSrc[nut]);
                                if (!isNaN(v) && v > 0) tissuePercent[nut] = v;
                            }
                        });
                    }
                } catch (e) {
                    console.warn('[NutritionCalendar] GH-362: SampleManager tissue read failed:', e && e.message);
                }
            }
        }

        // Soil parameters
        const bulkDensity = parseFloat(soil.bulkDensity) || CONFIG.defaultBulkDensity;
        const soilDepth = parseFloat(soil.depth) || CONFIG.defaultSoilDepth;
        // GH-438: whether each of those two is the sample's own reading or the
        // engine's default. They set the ppm->kg/ha factor and through it every
        // lift and headroom term, so "which one is this" is a real question
        // about the figures, not a diagnostic. nutrition-program-inputs.js's
        // validateSampleInputs() already computed exactly this pair for the
        // export path and nothing on the Plan page could see it, so the Plan's
        // calculation-trace row had to name both possibilities and let the
        // reader guess. Same test as the line above it, so the flag cannot
        // disagree with the value it describes.
        const _bulkDensityDefaulted = !(parseFloat(soil.bulkDensity) > 0);
        const _soilDepthDefaulted = !(parseFloat(soil.depth) > 0);
        
        // Methodology
        // Cotula/bowls: force ammonium_acetate regardless of what soil.methodology says.
        // The HubStore initialises inputs.soil.methodology as 'mlsn' and it may not
        // be updated by the time the calendar runs. Read from DOM select directly
        // as the reliable source for NZ sites with AA auto-selected.
        // GH-377: track whether ANY real source actually supplied the
        // methodology, or whether the 'mlsn' below is purely the default this
        // chain lands on when nothing did. The resolution order and every
        // resolved value are unchanged — this only adds the flag. A bare
        // soil.methodology of 'mlsn' is deliberately NOT counted as resolved:
        // the hub store initialises inputs.soil.methodology to 'mlsn' before
        // anything real is loaded (see the comment above), so on its own it is
        // indistinguishable from "not loaded yet". The stale-cache check in
        // restoreFromPersisted() must treat an unresolved methodology as
        // "unknown, trust the cached programme", never as "changed to MLSN".
        let _methodologyResolved = !!(soil.methodology && String(soil.methodology).toLowerCase() !== 'mlsn');
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
                _methodologyResolved = true;
            } else {
                // Also read DOM select as fallback — most reliable for AA auto-select
                const _ms = document.querySelector('.gaip-soil-methodology');
                if (_ms && _ms.value && _ms.value !== 'mlsn') {
                    methodology = _ms.value;
                    _methodologyResolved = true;
                } else {
                    // GH-377: an explicit 'mlsn' chosen in the DOM select is a
                    // real answer, unlike the hub store's placeholder default.
                    if (_ms && _ms.value === 'mlsn') _methodologyResolved = true;
                    // New hub: read from GAIP_HUB_CONFIG (set by PHP controller) or
                    // GAIP_DASHBOARD_DATA.computed.soilNutrition (from analysis cache)
                    const _cfgMeth = (window.GAIP_HUB_CONFIG?.turfMethodology || '').toLowerCase();
                    const _snMeth  = (window.GAIP_DASHBOARD_DATA?.computed?.soilNutrition?.methodology || '').toLowerCase();
                    const _newHubMeth = _cfgMeth || _snMeth;
                    if (_newHubMeth) _methodologyResolved = true;
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
        // GH-398: the raw form values. They are handed to the shared adapter
        // below as `planForm` and come back resolved, because the Word export
        // now runs the SAME cap and the SAME mode and has no form to read them
        // from — see the maxNPerMonth/distribution consts after the adapter
        // call.
        const _formMaxN = parseFloat(this.elements.maxNInput?.value) || null;
        const _formDistribution = this.elements.distributionSelect?.value || null;

        // b35fix386: read surfaceType from the locally-resolved `soil` const
        // (above), not `state.soil` which is undefined on the synthesised
        // state view. `soil` already prefers `state.inputs.soil`.
        const surfaceType = soil.surfaceType || state.turf?.subCategory || 'sports';
        const defaultClippingMgmt = ['greens', 'golf_greens', 'bowling_greens', 'tees'].includes(surfaceType)
            ? 'collected' : 'returned';

        // GH-383 (D31 stage 1): clipping management, traffic and turf type are
        // resolved by the ONE shared adapter, assets/nutrition-program-inputs.js
        // — the same module word-export.js's _buildEngineInputs() resolves them
        // from. This page's own live form is handed IN as `planForm` (rather
        // than the adapter reaching for the DOM itself) so the adapter's
        // precedence — live form > this site's persisted programme > default —
        // is applied once, in one place, on whichever page the calendar runs.
        //
        // Deliberately NOT taken from the adapter: annualNOverride. The adapter
        // has a fallback chain (Settings > Turf, then the species default) that
        // the EXPORT needs for a site with no generated programme, but seeding
        // the Plan's own input from Settings was explicitly declined (decision
        // D-4b) — an empty Annual N Target must keep prompting the user, not
        // silently compute against a number they never entered.
        let _programInputs = null;
        try {
            const _NPI = window.GAIP_NutritionProgramInputs;
            if (_NPI) {
                _programInputs = _NPI.resolveSiteProgramInputs({
                    siteId: this.getActiveSiteId(),
                    soil: soil,
                    sample: {
                        species: rawSpecies || undefined,
                        methodology: methodology || undefined,
                        CEC: soil.CEC ?? soil.cec,
                        pH: soil.pH_water ?? soil.pH,
                        // GH-414: this sample's own recorded texture, handed in
                        // the same way the Word export hands it (word-export-
                        // combined.js's per-sample resolveSiteProgramInputs
                        // call). resolveSoilTexture() ranks it BELOW the site's
                        // override — GAIP_SampleManager, the other place it
                        // reads a snapshot from, is not loaded on this page, so
                        // without this the Plan and the export were resolving
                        // texture from two different chains.
                        soilTexture: soil.soilTextureSnapshot || undefined
                    },
                    planForm: {
                        annualN: parseFloat(this.elements.annualNInput?.value) || null,
                        clippingManagement: this.elements.clippingSelect?.value || null,
                        maxNPerMonth: _formMaxN,
                        distributionMode: _formDistribution
                    }
                });
            }
        } catch (e) {
            console.warn('[NutritionCalendar] GH-383: programme input resolution failed:', e && e.message);
        }

        const clippingManagement = (_programInputs && _programInputs.clippingManagement) ||
            this.elements.clippingSelect?.value || state.turf?.clippingManagement || defaultClippingMgmt;
        const traffic = (_programInputs && _programInputs.trafficIntensity) || state.turf?.traffic || 'moderate';
        const trafficModifier = (_programInputs && _programInputs.trafficModifier) || 1.0;
        const turfType = (_programInputs && _programInputs.turfType) || state.turf?.turfType || null;
        // GH-398 (D31 stage 4): from the adapter, for the same reason clipping
        // and traffic are — the Word export's Monthly N Distribution table
        // applies this cap and this mode now, and it resolves them through the
        // same call. Read straight from the form here and from the site config
        // there, they would drift the moment the form was blank.
        const maxNPerMonth = (_programInputs && _programInputs.maxNPerMonth) || _formMaxN || 50;
        const distribution = (_programInputs && _programInputs.distributionMode) || _formDistribution || 'gp_weighted';

        return {
            hemisphere,
            latitude: lat,
            // GH-371 (D01): threaded through to computeProgram() so it can
            // stamp the coordinates that actually drove this computation.
            longitude: lon,
            species,
            speciesDisplay,
            isC4,
            soilPpm,
            tissuePercent,
            bulkDensity,
            soilDepth,
            methodology,
            // GH-300 (D07 item 6 follow-up): general soil-texture value (sites.
            // soil_texture_override, via the GH-294 Plan-page bridge into
            // state.inputs.soil.soilTexture) — needed for deriveCode(species,
            // soilTexture) to resolve a certificate-backed AA ceiling. Distinct
            // GH-388: distinct from the AA sands/others BUCKET, which the
            // shared resolver derives from this same value — this is the
            // site's real texture, not a bucket.
            // GH-414: the value the SHARED resolver settled on, not this page's
            // own read of one link in the chain. Both surfaces now report the
            // texture that actually produced their ranges.
            soilTexture: (_programInputs && _programInputs.soilTexture) || soil.soilTexture || null,
            CEC: soil.CEC ?? soil.cec ?? null,
            // GH-382 (D31 divergence item 2): pH_water preferred over a
            // generic .pH, matching word-export.js's own established
            // _pHForSlanP resolution order (word-export.js:8398-8400) — this
            // is the same field, read the same way, not a new convention.
            // Feeds getThresholds()'s SLAN pH-adjusted P floor (Spencer
            // scaled-ladder) below; null when no reading exists, which
            // getThresholds() treats as "use the pH-independent baseline",
            // never as "assume a pH".
            pH: soil.pH_water ?? soil.pH ?? null,
            monthlyTemps,
            // GH-425: where `monthlyTemps` came from, as climate-normals-
            // service.js stamped it (`nasa-power`, `open-meteo-fallback`,
            // `unavailable`) and the climatology window it covers. The series
            // drives every month's growth potential and therefore the whole
            // shape of the programme, and nothing on the page said which of the
            // two providers answered. Provenance only; no value moves.
            monthlyTempsSource: climate.monthlyTempsSource ||
                (state.climate && state.climate.monthlyTempsSource) || null,
            monthlyTempsPeriod: climate.monthlyTempsPeriod ||
                (state.climate && state.climate.monthlyTempsPeriod) || null,
            annualNOverride,
            maxNPerMonth,
            distribution,
            traffic,
            trafficModifier,
            turfType,
            surfaceType,
            clippingManagement,
            // GH-383: the sufficiency ranges and per-field provenance the
            // shared adapter resolved. computeProgram() persists the
            // provenance as meta.inputSources so the E2E harness can compare
            // the two surfaces' resolved input objects field by field instead
            // of chasing a numeric difference three tables later.
            ranges: _programInputs ? _programInputs.ranges : null,
            rangeSources: _programInputs ? _programInputs.rangeSources : null,
            inputSources: _programInputs ? _programInputs.sources : null,
            // GH-438: deliberately NOT folded into inputSources. That map is
            // compared field for field between the Plan page and the Word
            // export by tests/e2e/ui-vs-export-parity.test.js, and the export
            // resolves these two flags on its own path
            // (nutrition-program-inputs.js validateSampleInputs()), so adding
            // keys to one side only would fail parity on a provenance
            // difference that is not one. They travel as their own fields.
            bulkDensityDefaulted: _bulkDensityDefaulted,
            soilDepthDefaulted: _soilDepthDefaulted,
            annualNBase: annualNOverride,
            _speciesDefaulted: _speciesFallbackUsed,  // b35fix309 item 5: true when silent creepingBentgrass fallback fired
            // GH-377: true when no real source supplied a methodology and the
            // 'mlsn' above is only the chain's default — see the comment at the
            // top of the methodology block. Consumed by the stale-cache check.
            _methodologyDefaulted: !_methodologyResolved,
        };
    };

    /**
     * Extract ppm value handling nested structure
     */
    NutritionCalendar.extractPpm = function(soil, nutrient) {
        // GH-338: was `|| 0` on every branch, including "field doesn't exist
        // at all" -- that collapsed "no soil sample" into "measured 0 ppm",
        // and 0 ppm reads as maximally deficient against every floor,
        // silently triggering the largest possible Lift correction for a
        // site that was never actually tested. Return null when the field is
        // genuinely absent so computeProgram() can tell "no data" apart from
        // a real (if unlikely) 0 reading and skip deficit/lift for that
        // nutrient instead of assuming the worst case. Matches
        // nutrition-requirement-engine.js's calculateAllRequirements(),
        // which already omits a nutrient entirely rather than defaulting it.
        if (soil.ppm && soil.ppm[nutrient] !== undefined && soil.ppm[nutrient] !== null && soil.ppm[nutrient] !== '') {
            const v = parseFloat(soil.ppm[nutrient]);
            return isNaN(v) ? null : v;
        }
        if (soil[nutrient] !== undefined && soil[nutrient] !== null && soil[nutrient] !== '') {
            const v = parseFloat(soil[nutrient]);
            return isNaN(v) ? null : v;
        }
        return null;
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

        // GH-302 (D07 item 6 follow-up): existing.soilTexture (carried over
        // above from GAIP_STATE.inputs.soil) can be lost by the time
        // generate() runs -- confirmed live: plan.blade.php's page-load
        // bridge correctly sets it (GH-294/301), but a later soil-sample
        // load (site-selector-ui.js's "Loaded soil sample" cascade, which
        // rebuilds GAIP_STATE.inputs.soil from the sample's own P/K/Ca/Mg/S
        // values) has no concept of site-level soil texture and silently
        // drops the field when it overwrites the soil object. window.
        // GAIP_HUB_CONFIG.soilTexture is a more stable source for the same
        // value -- a plain top-level config object set once by the page
        // bridge, never touched by sample-load code -- so fall back to it
        // here rather than trying to make every sample-load call site
        // preserve a field it doesn't know exists.
        console.log('[GH302-DEBUG] before soilTexture fallback | soilState.soilTexture:', soilState.soilTexture,
            '| GAIP_HUB_CONFIG exists:', !!window.GAIP_HUB_CONFIG,
            '| GAIP_HUB_CONFIG.soilTexture:', window.GAIP_HUB_CONFIG && window.GAIP_HUB_CONFIG.soilTexture);
        if (!soilState.soilTexture && window.GAIP_HUB_CONFIG && window.GAIP_HUB_CONFIG.soilTexture) {
            soilState.soilTexture = window.GAIP_HUB_CONFIG.soilTexture;
        }
        console.log('[GH302-DEBUG] after soilTexture fallback | soilState.soilTexture:', soilState.soilTexture);

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
        console.log('[GH302-DEBUG] syncSoilFromDOM done | soilState.soilTexture:', soilState.soilTexture, '| GAIP_STATE.inputs.soil.soilTexture:', window.GAIP_STATE.inputs && window.GAIP_STATE.inputs.soil && window.GAIP_STATE.inputs.soil.soilTexture);
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
     *
     * GH-248: this list must match normalizeSpecies()'s actual output keys —
     * SpeciesController.toNutrientKey()'s canonical→nutrient-key map produces
     * 'zoysia' (unchanged, not remapped) and 'buffalograss' (remapped from
     * 'buffalo'), not 'zoysiagrass'/'buffalo'. The two wrong keys previously
     * here silently misclassified pure Zoysia and Buffalograss sites as C3
     * (isC4Species returned false), applying the C3 GP curve (optimum 20degC)
     * instead of C4 (optimum 31degC) to the live Monthly Nutrient Program for
     * those two real, selectable turf species.
     */
    NutritionCalendar.isC4Species = function(species) {
        const c4Species = ['bermuda', 'couch', 'zoysia', 'kikuyu', 'buffalograss', 'seashorePaspalum', 'mixedWarm'];
        return c4Species.includes(species);
    };

    // ========================================================================
    // GH-377 — cached-programme input staleness (species / methodology)
    // ========================================================================
    //
    // GH-371 (D01) stamps the coordinates a programme was computed against
    // (meta.lat/lon) and refuses a cached copy whose stamp no longer matches
    // the site. Coordinates are not the only input computeProgram() depends
    // on: `species` drives the C3/C4 growth-potential curve (two different
    // temperature optima — switching inverts the whole annual N shape), and
    // `methodology` selects which threshold/ceiling family (MLSN / SLAN /
    // AA certificate ranges) every deficit and sufficiency ceiling is judged
    // against. Both are already recorded in meta by computeProgram()
    // (meta.species = the nutrient-engine key collectFromState() resolved,
    // meta.methodology = the same inputs.methodology, upper-cased), so this
    // is a second comparison next to the coordinate one, reading fields that
    // were already there — not a new mechanism.
    //
    // What is deliberately NOT compared, and why:
    //   - meta.surfaceType: computeProgram() does not consume it (it is only
    //     echoed into meta/summary); and it resolves differently per page
    //     (`soil.surfaceType || turf.subCategory || 'sports'`), so comparing
    //     it would nag on every load for sites like Westview (subCategory
    //     null, surfaceType 'lawns' on Plan) without any real staleness.
    //   - meta.distribution / meta.clippingManagement: Plan-form inputs that
    //     restoreFromPersisted() itself sets INTO the form FROM meta after
    //     the check — at check time the selects still hold their defaults,
    //     so comparing them would flag every non-default choice as stale.
    //   - meta.hemisphere: derived from latitude's sign; fully covered by the
    //     coordinate check (any hemisphere flip is far more than 0.01°).
    //   - meta.speciesDisplay: the human label; the key is what computes.
    //     deriveCode() (Hill Labs certificate ranges) normalises the label
    //     through SpeciesController too, so a label change that maps to the
    //     same key changes nothing the engine sees.
    //
    // Forward-looking, not retroactive (same rule as GH-371): a meta with no
    // `species` / `methodology` field, or a current state that could not
    // positively resolve one (collectFromState()'s _speciesDefaulted /
    // _methodologyDefaulted, or an empty site-config field), means "unknown,
    // trust the cached programme" — never "invalidate". Checked against the
    // real dev DB before choosing this: all 10 cached programmes already
    // carry species/speciesDisplay/methodology in meta (only 3 carry the
    // GH-371 lat/lon stamp), so the comparison is live for existing data
    // without any migration, and the absent-field rule costs nothing today.
    //
    // Over-invalidation guards (the main risk — a check that is too eager
    // shows "please regenerate" on every load for a normal site):
    //   1. Species is compared as the nutrient-engine KEY, with the current
    //      side normalised through the same normalizeSpecies() chain that
    //      produced the stamp (SpeciesController.normalize → toNutrientKey).
    //      The stamped key itself is NOT re-normalised: toNutrientKey() is
    //      not idempotent (browntop → 'creepingBentgrass', but feeding
    //      'creepingBentgrass' back in yields 'bentgrass'), so re-normalising
    //      the stamp would flag every browntop site (Russley in the dev DB).
    //   2. The current species is a SET of acceptable keys, not one value:
    //      the resolved effective species plus the site config's base and
    //      overseed species. On hub pages hub-tissue-v3.js writes the
    //      overseed species into GAIP_STATE.turf.effectiveSpecies for an
    //      overseed-dominant C4 site (and SpeciesController.getEffective
    //      Species() has the same semantics), while plan.blade.php's bridge
    //      always feeds the base species — so the same site can legitimately
    //      stamp either key depending on which page generated. Only a stamp
    //      matching NONE of the site's current species is stale.
    //   3. Methodology is compared case-insensitively with the aliases
    //      collectFromState()/computeProgram() already accept folded to one
    //      key (cotula_s78/cotula/aa → ammonium_acetate), and a site-config
    //      value of empty/'mlsn' on an NZ site resolves to ammonium_acetate,
    //      the identical rule plan.blade.php's bridge and ammonium-acetate-
    //      methodology.js's auto-select both apply before generation.

    /**
     * GH-377: fold every spelling of a methodology this engine accepts to one
     * comparison key. '' when nothing usable was supplied.
     */
    NutritionCalendar.normalizeMethodology = function(methodology) {
        if (methodology === null || methodology === undefined) return '';
        let key = String(methodology).trim().toLowerCase();
        if (!key) return '';
        key = key.replace(/[\s-]+/g, '_');
        if (key === 'aa' || key === 'ammoniumacetate' || key === 'ammonium_acetate' ||
            key === 'cotula_s78' || key === 'cotula') {
            return 'ammonium_acetate';
        }
        return key;
    };

    /**
     * GH-377: the NZ bounding box plan.blade.php's GAIP_STATE bridge and
     * ammonium-acetate-methodology.js's isNewZealand() both use to auto-
     * select AA. Kept numerically identical to those two on purpose.
     */
    NutritionCalendar.isNZCoordinates = function(lat, lon) {
        const la = parseFloat(lat);
        const lo = parseFloat(lon);
        if (isNaN(la) || isNaN(lo)) return false;
        return (lo >= 166 && lo <= 179 && la >= -47 && la <= -34);
    };

    /**
     * GH-377: what a site config's turf.methodology means once the page-side
     * NZ rule is applied — empty or 'mlsn' on an NZ site becomes
     * ammonium_acetate, exactly as the Plan bridge does before generating.
     * '' when the site config carries no usable value (unknown).
     */
    NutritionCalendar.resolveSiteMethodology = function(turfMethodology, lat, lon) {
        const key = this.normalizeMethodology(turfMethodology);
        if ((!key || key === 'mlsn') && this.isNZCoordinates(lat, lon)) return 'ammonium_acetate';
        return key;
    };

    /**
     * GH-377: the site-config turf block for the active site, from whichever
     * store this page has: window.GAIP_SITE_CONFIG (server-rendered on Plan)
     * or GAIP_SiteConfig's in-memory config (hub pages). null when neither.
     */
    NutritionCalendar.getSiteConfigTurf = function() {
        try {
            const direct = window.GAIP_SITE_CONFIG;
            if (direct && direct.turf && typeof direct.turf === 'object' && !Array.isArray(direct.turf)) {
                return direct.turf;
            }
            const siteId = this.getActiveSiteId();
            if (siteId && window.GAIP_SiteConfig && typeof window.GAIP_SiteConfig.getConfig === 'function') {
                const cfg = window.GAIP_SiteConfig.getConfig(siteId);
                if (cfg && cfg.turf && typeof cfg.turf === 'object' && !Array.isArray(cfg.turf)) {
                    return cfg.turf;
                }
            }
        } catch (e) { /* unavailable — caller treats as unknown */ }
        return null;
    };

    /**
     * GH-377: build the set of species keys / methodology keys the site is
     * CURRENTLY configured with, for programInputsDrift(). Every source is
     * optional; an empty resulting array means "unknown" for that field.
     *
     * @param {object} opts
     *   fresh  - collectFromState() output (its resolved species/methodology
     *            are added unless the corresponding _xDefaulted flag says
     *            the value is only a fallback).
     *   turfs  - one site-config turf object, or an array of them (base
     *            species + overseed species + methodology are read from each;
     *            raw labels are normalised through normalizeSpecies()).
     *   lat/lon - site coordinates, for the NZ methodology rule.
     * @returns {{ speciesKeys: string[], methodologies: string[] }}
     */
    NutritionCalendar.collectProgramInputCandidates = function(opts) {
        opts = opts || {};
        const speciesKeys = [];
        const methodologies = [];
        const addSpecies = (key) => {
            if (typeof key === 'string' && key && speciesKeys.indexOf(key) === -1) speciesKeys.push(key);
        };
        const addMethodology = (m) => {
            const key = this.normalizeMethodology(m);
            if (key && methodologies.indexOf(key) === -1) methodologies.push(key);
        };

        const fresh = opts.fresh;
        if (fresh && typeof fresh === 'object') {
            if (!fresh._speciesDefaulted && typeof fresh.species === 'string') addSpecies(fresh.species);
            if (!fresh._methodologyDefaulted) addMethodology(fresh.methodology);
        }

        const turfs = Array.isArray(opts.turfs) ? opts.turfs : (opts.turfs ? [opts.turfs] : []);
        turfs.forEach((turf) => {
            if (!turf || typeof turf !== 'object') return;
            // Base species, then the overseed species under both key spellings
            // in use (overseedSpecies = hub key, coolOverseed = settings-form
            // key — see site-config-persistence.js restoreConfig()), then the
            // warm-season base a cool overseed sits on. All acceptable: see
            // guard 2 in the block comment above.
            [turf.species, turf.overseedSpecies, turf.coolOverseed, turf.warmBase].forEach((raw) => {
                if (typeof raw === 'string' && raw.trim()) addSpecies(this.normalizeSpecies(raw.trim()));
            });
            addMethodology(this.resolveSiteMethodology(turf.methodology, opts.lat, opts.lon));
        });

        return { speciesKeys: speciesKeys, methodologies: methodologies };
    };

    /**
     * GH-377: which of a cached programme's own computation inputs no longer
     * match what the site is configured with now.
     *
     * @param {object} meta - program.meta as stamped by computeProgram()
     *   (species = nutrient-engine key, methodology = upper-cased key).
     *   A missing/empty field is "unknown" and never reported as drift.
     * @param {{speciesKeys: string[], methodologies: string[]}} candidates -
     *   from collectProgramInputCandidates(); an empty array is "unknown"
     *   and never reported as drift.
     * @returns {Array<{field: string, was: string, now: string}>} empty when
     *   nothing comparable has drifted.
     */
    NutritionCalendar.programInputsDrift = function(meta, candidates) {
        const drift = [];
        if (!meta || typeof meta !== 'object' || !candidates || typeof candidates !== 'object') return drift;

        const stampedSpecies = (typeof meta.species === 'string') ? meta.species.trim() : '';
        const speciesKeys = Array.isArray(candidates.speciesKeys)
            ? candidates.speciesKeys.filter((k) => typeof k === 'string' && k) : [];
        if (stampedSpecies && speciesKeys.length && speciesKeys.indexOf(stampedSpecies) === -1) {
            drift.push({ field: 'species', was: stampedSpecies, now: speciesKeys[0] });
        }

        const stampedMethodology = this.normalizeMethodology(meta.methodology);
        const methodologies = (Array.isArray(candidates.methodologies) ? candidates.methodologies : [])
            .map((m) => this.normalizeMethodology(m))
            .filter(Boolean);
        if (stampedMethodology && methodologies.length && methodologies.indexOf(stampedMethodology) === -1) {
            drift.push({ field: 'methodology', was: stampedMethodology, now: methodologies[0] });
        }

        return drift;
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
     * Calculate monthly GP values (0-11).
     *
     * GH-398 (D31 stage 4): delegated to the shared distribution module, which
     * builds the series through the GP engine's per-month C3 fraction rather
     * than a whole-year C3/C4 boolean (decision 3). For a sward that is not
     * overseeded the two are bit-for-bit identical — 'blend' computes
     * `f * c3GP + (1 - f) * c4GP`, so f = 1 IS the C3 curve and f = 0 the C4
     * curve — so no site without an overseed configuration moves. What the
     * Plan page gains is the ability to describe an overseeded sward at all:
     * a warm-season base carrying summer with oversown ryegrass carrying
     * winter, instead of twelve months of one curve.
     *
     * `overseedConfig` and `hemisphere` are optional; omitted, this behaves
     * exactly as the isC4-only signature always did.
     *
     * GH-245: a missing or non-numeric month still returns null for the whole
     * series rather than defaulting to 15 degC (Hoxton audit D02/D03).
     */
    NutritionCalendar.calculateMonthlyGP = function(monthlyTemps, isC4, overseedConfig, hemisphere) {
        const D = _monthlyDistribution();
        if (!D) return null;
        // The C3-on-C3 guard is inside monthlyC3Fractions() — one rule, not
        // one per caller.
        const overseed = (overseedConfig && overseedConfig.isOverseed)
            ? overseedConfig
            : { isOverseed: false, baseIsC4: !!isC4 };
        const fractions = D.monthlyC3Fractions(overseed, hemisphere || 'south');
        // 'zeros', not 'null', when the GP engine is absent: this file's own
        // calculateGP() has always returned 0 in that case and distribute()'s
        // dormancy fallback has always turned that into an even split. It is a
        // load-order failure that cannot happen in the browser (every page that
        // enqueues this file also enqueues growth-potential-engine.js) and
        // changing it is not this ticket's decision to make.
        return D.monthlyGP(monthlyTemps, fractions, { gpEngineUnavailable: 'zeros' });
    };

    // GH-388: NutritionCalendar.calculateDeficit() and .getThresholds() are
    // gone. GH-384 routed computeProgram() through the shared core and the
    // shared range resolver, which left these two as an unreachable second
    // implementation of the same deficit arithmetic and the same threshold
    // tables. Verified before removal: no caller in assets/, app/ or tests/ —
    // the only remaining references were prose in three test file headers and
    // one source-text assertion, which now points at the core's equivalent
    // (see tests/gh338-missing-soil-data.test.js). The behaviour they carried
    // lives on: the null-not-zero guard is
    // nutrition-requirement-core.js's `typeof currentLevel !== 'number'`
    // branch, and the ppm -> kg/ha conversion is its ppmToKgHaFactor.

    // ========================================================================
    // GH-398 (D31 stage 4) — the monthly distribution moved out of this file.
    //
    // distributeByGP() and applyNCap() were the Plan page's half of the last
    // duplicated engine: nutrition-requirement-engine.js carried its own
    // distributeNGPWeighted() for the Word export's "Monthly N Distribution"
    // table, with the same GP weighting, the same 0.10 activity threshold and
    // the same dormancy fallback, and with no cap at all. Both now call
    // assets/nutrition-monthly-distribution.js.
    //
    // The two below stay as thin delegations because they are public API —
    // GH-279's info-icon copy, GH-354's regression test and any future caller
    // read them by name — not because there is a second implementation left.
    // Anything that computes a per-month share belongs in the shared module.
    // ========================================================================

    /** Distribute an annual amount across 12 months (0-11). Values are raw. */
    NutritionCalendar.distributeByGP = function(annualAmount, monthlyGP, method = 'gp_weighted') {
        return _monthlyDistribution().distribute(annualAmount, monthlyGP, method);
    };

    /**
     * Apply the monthly N cap with overflow redistribution.
     *
     * null / undefined / 0 / '' / NaN → "no cap" (Infinity).
     */
    NutritionCalendar.applyNCap = function(nAllocations, maxN) {
        return _monthlyDistribution().applyNCap(nAllocations, maxN);
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
    // GH-388: NutritionCalendar._collectAATexture() is gone with the AA
    // threshold table it fed. Its whole job was to pick a 'sands' | 'others'
    // bucket for getThresholds()'s AA branch; since GH-384 the AA range comes
    // from the shared resolver, which does its own (identical) bucketing in
    // nutrition-program-inputs.js aaTextureKey() off a texture resolved
    // through one chain. `inputs.aaTextureKey` was still being computed and
    // passed by both callers and read by nobody.

    /**
     * b35fix304 Task 2: Pure programme compute.
     *
     * No DOM reads, no global writes, no event dispatch.
     *
     * @param {object} inputs - Shape returned by collectFromState().
     *   { hemisphere, latitude, species, isC4, soilPpm, bulkDensity, soilDepth,
     *     methodology, monthlyTemps, annualNOverride, maxNPerMonth, distribution,
     *     traffic, surfaceType, clippingManagement, ranges?, rangeSources?,
     *     overseedConfig? }
     *
     *   GH-398: `overseedConfig` ({ isOverseed, baseIsC4, summerIntent }) is
     *   optional and blends the monthly GP curve between C3 and C4 by season
     *   for an oversown warm-season sward (decision 3). Omitted — which is
     *   every caller on the Plan page, since no overseed state exists there —
     *   `isC4` alone drives a constant fraction and the series is unchanged.
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
        //
        // GH-354: this only checked `inputs.monthlyTemps` was truthy, not
        // that all 12 months actually had a numeric value. calculateMonthlyGP()
        // does the real per-month check and returns null on the first missing/
        // non-numeric month -- that null then reached distributeByGP()
        // unchecked (`monthlyGP[m]` on null), crashing with "Cannot read
        // properties of null (reading '0')" deep inside the per-sample loop,
        // instead of surfacing here as the intended climateDataUnavailable
        // result. Confirmed live: combined export per-sample recompute for a
        // real site threw exactly this error. Now validates completeness the
        // same way calculateMonthlyGP() does, so an incomplete monthlyTemps
        // object is caught here instead of crashing three calls deeper.
        const _monthlyTempsComplete = inputs.monthlyTemps &&
            [0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11].every(m => typeof inputs.monthlyTemps[m] === 'number');
        if (!_monthlyTempsComplete) {
            return { climateDataUnavailable: true, climateDataUnavailableReason: inputs.monthlyTempsUnavailableReason || 'fetch-failed' };
        }

        const baseAnnualN = inputs.annualNOverride;

        // Traffic modifier. GH-383 (plan pitfall 4): the modifier is resolved
        // ONCE, by assets/nutrition-program-inputs.js, and arrives as
        // inputs.trafficModifier. The CONFIG.trafficModifiers lookup below is
        // the pre-adapter fallback for callers that have not been migrated —
        // numerically identical (both tables are the same five numbers) and
        // 1.0 everywhere until stage 3 of the D31 plan wires the Settings >
        // Traffic & Wear schedule into the site config. The modifier must be
        // applied HERE and nowhere else: the shared core deliberately has no
        // traffic term, because P/K/Ca/Mg/S removal already scales with
        // annualN and a second application would double-count it.
        const trafficMod = (typeof inputs.trafficModifier === 'number' && inputs.trafficModifier > 0)
            ? inputs.trafficModifier
            : (CONFIG.trafficModifiers[inputs.traffic] || 1.0);
        const annualN = Math.round(baseAnnualN * trafficMod);

        // ================================================================
        // STEPS 2-5: removal, clipping, correction, ceiling — DELEGATED
        // ================================================================
        // GH-384 (D31 stage 2). Everything from "base nutrient removal" to
        // "final annual requirements" used to be computed here, independently
        // of nutrition-requirement-engine.js, which computed the same three
        // quantities its own way for the Word export. That is the audit's D31
        // finding in one sentence ("two requirement engines, one product"), and
        // it is what this delegation ends: both surfaces now call
        // assets/nutrition-requirement-core.js.
        //
        // WHAT THIS PAGE'S NUMBERS DO, AND WHY (all four are settled decisions
        // on files/fixes/26-08-17-hoxton-v6/PLAN-D31-unify-engines.md section 9):
        //
        //   D-5  The generic (non-tissue) removal ratio is now the per-species
        //        REMOVAL_RATES table (Carrow/Waddington/Rieke 2001;
        //        Christians/Patton/Law 2017), not the one flat set this file
        //        applied to every species (P 0.10 / K 0.55 / Ca 0.17 / Mg 0.08 /
        //        S 0.05, Turner & Hummel 1992 — a single cool-season tissue
        //        composition). P/N is 0.10 in every table row so P does not
        //        move; K moves by -3% on bentgrass sites and +14% on buffalo;
        //        Ca/Mg/S move on every site, since tissue never governs them.
        //   D-6  Below the floor, the lift target is the floor itself — this
        //        page's own long-standing rule, now the export's too.
        //   D-7  The MLSN P threshold gains the pH ladder (35/28/21/32/40 by
        //        pH) it never had here. No stored dev sample is outside the
        //        6.0-7.5 band, so nothing moves today; it is latent, not
        //        cosmetic.
        //   D-8  A reading exactly AT the ceiling applies zero (`>=`), which is
        //        what this file already did.
        //
        // Rounding: the core is canonical at 0.1 kg/ha, and since GH-403 so is
        // `annual_totals`. This function used to round the core's answer twice
        // — removal to whole kg, then the total to whole kg — which left the
        // Plan page and the export up to 1 kg/ha apart on the same nutrient.
        // The total's rounding is gone (see the GH-403 note at
        // annualRequirements below); `annual_removal` keeps its whole-kg
        // rounding, because it is a reported quantity that nothing downstream
        // does further arithmetic on. tests/gh376-three-way-nutrition-parity.
        // test.js asserts the two surfaces' annual requirement now agrees
        // exactly rather than within 1 kg/ha.
        const _core = _requirementCore();
        if (!_core) {
            return { error: 'nutrition-requirement-core.js is not loaded — the nutrition programme cannot be computed' };
        }

        const methodologyUsed = this.normalizeMethodology(inputs.methodology) || 'mlsn';

        // Sufficiency ranges: resolved ONCE, by the shared adapter, for all
        // three methodologies (AA certificate/generic band, SLAN Carrow 2004 +
        // the Spencer pH ladder, MLSN Woods 2016 + the D-7 ladder). This file
        // used to resolve them itself, in a block that had to be kept in step
        // with word-export.js's own copy by hand — GH-352/353/355/357/364/379.
        // collectFromState() normally hands them in already resolved; the
        // fallback covers direct callers (the Combined export's per-sample
        // recompute, tests) so there is still only ONE resolver.
        let aaRanges = inputs.ranges || null;
        let annualRangeSource = inputs.rangeSources || null;
        if (!aaRanges) {
            const _NPI = _programInputsAdapter();
            if (!_NPI) {
                return { error: 'nutrition-program-inputs.js is not loaded — sufficiency ranges cannot be resolved' };
            }
            const _resolved = _NPI.resolveSufficiencyRanges({
                methodology: methodologyUsed,
                speciesDisplay: inputs.speciesDisplay,
                speciesKey: inputs.species,
                soilTexture: inputs.soilTexture,
                CEC: inputs.CEC,
                pH: inputs.pH
            });
            aaRanges = _resolved.ranges;
            annualRangeSource = _resolved.sources;
        }

        const _coreResult = _core.compute({
            soilValues: inputs.soilPpm,
            species: inputs.species || inputs.speciesDisplay,
            ph: inputs.pH,
            methodology: methodologyUsed,
            ranges: aaRanges,
            tissuePercent: inputs.tissuePercent,
            // Already traffic-adjusted (see the modifier block above). The core
            // has no traffic term of its own, so it cannot be applied twice.
            annualN: annualN,
            bulkDensity: inputs.bulkDensity,
            soilDepth: inputs.soilDepth,
            clippingManagement: inputs.clippingManagement
        });

        // `annual_totals_range` keeps its published {min,max} shape — the core's
        // ranges also carry a methodology label and a citation, which are
        // internal to the computation and are not part of this output contract
        // (nutrition-prebble-integration.js's excess-delivery check and the
        // persisted programme both read {min,max}).
        const annualTotalsRange = { P: null, K: null, Ca: null, Mg: null, S: null };
        ['P', 'K', 'Ca', 'Mg', 'S'].forEach(function (n) {
            const r = aaRanges[n];
            annualTotalsRange[n] = r ? { min: r.min, max: r.max } : null;
        });

        const _per = _coreResult.perSample;
        const _tissueGateEligible = _coreResult.tissueGateApplied;
        const missingSoilData = _coreResult.missingSoilData;

        // GH-361/362 diagnostics, unchanged in intent: say when this plant's
        // own measured composition governed the P/K ratio, and what the generic
        // ratio would have been for THIS species (D-5 — no longer one flat pair
        // for every species).
        if (_tissueGateEligible) {
            const _tp = inputs.tissuePercent || {};
            console.log('[NutritionCalendar] GH-361 tissue gate applied: P/N=' + (_tp.P / _tp.N).toFixed(3) +
                ' K/N=' + (_tp.K / _tp.N).toFixed(3) + ' (species-table generic would have been P/N=' +
                (_per.P ? _per.P.removal / annualN : 0).toFixed(3) + ' K/N=' +
                (_per.K ? _per.K.removal / annualN : 0).toFixed(3) + ')');
        }

        // Clipping factors are reported in `adjustments` exactly as before —
        // the core applied them, this is the record of which pair it used.
        const clipMgmt = CONFIG.clippingManagement[inputs.clippingManagement] || CONFIG.clippingManagement.collected;

        const NUTRIENTS = ['P', 'K', 'Ca', 'Mg', 'S'];
        const deficits = {};
        const annualCorrection = {};
        const adjustedRemoval = { N: Math.round(annualN * clipMgmt.nFactor) };
        const annualRequirements = { N: Math.round(annualN * clipMgmt.nFactor) };
        NUTRIENTS.forEach(function (nutrient) {
            const r = _per[nutrient];
            adjustedRemoval[nutrient] = Math.round(r.removal);
            annualCorrection[nutrient] = r.correctionRequired;
            // `soil.deficits` is the raw kg/ha shortfall, before it is spread
            // over yearsToCorrect — the same quantity calculateDeficit()
            // returned. Consumers (the Soil page, the persisted programme) read
            // it as such.
            deficits[nutrient] = r.correctionRequired * (CONFIG.yearsToCorrect[nutrient] || 2);
            // GH-403: NOT rounded. This used to snap the core's annual
            // requirement to a whole kilogram before it was distributed across
            // the twelve months — an intermediate rounding of a value used in
            // further arithmetic, which is exactly what GH-401 removed
            // everywhere else. It moved the whole programme by up to 0.5 kg/ha
            // (Westview's sulphur: 12.5 scheduled as 13) and it is why the Plan
            // page and the Word document printed two different "Required"
            // figures under one column name. `annual_totals` is now the core's
            // own canonical 0.1 kg/ha answer — the same number the document's
            // Annual Nutrient Requirements table prints — and every renderer
            // rounds it once, at output.
            annualRequirements[nutrient] = r.annualRequirement;
        });

        const adjustedAnnualN = annualRequirements.N;
        console.log('[GH302-DEBUG] final annualRequirements:', annualRequirements);
        // ================================================================
        // MONTHLY DISTRIBUTION — DELEGATED (GH-398, D31 stage 4)
        // ================================================================
        // The GP-weighted split, the 0.10 activity threshold, the dormancy
        // fallback and the monthly N cap all live in
        // assets/nutrition-monthly-distribution.js, which
        // nutrition-requirement-engine.js now calls too. Until this ticket the
        // export's "Monthly N Distribution" table ran a second copy of the
        // weighting with no cap, so a site clamped at 15 kg N/month on this
        // page printed an unclamped series in its own report.
        //
        // Every nutrient goes through the same call (decision 4). Values come
        // back raw and are rounded once, at the display step below (decision
        // 2) — the engine used to round GP to 2 dp before weighting and each
        // month to 1 dp afterwards, which is where the two series drifted.
        const _dist = _monthlyDistribution();
        if (!_dist) {
            return { error: 'nutrition-monthly-distribution.js is not loaded — the monthly programme cannot be built' };
        }
        const monthlyGP = this.calculateMonthlyGP(
            inputs.monthlyTemps, inputs.isC4, inputs.overseedConfig, inputs.hemisphere);
        const _distributed = _dist.distributeProgram({
            annualAmounts: annualRequirements,
            gp: monthlyGP,
            mode: inputs.distribution,
            maxNPerMonth: inputs.maxNPerMonth
        });
        const distributions = _distributed.distributions;
        const nCapResult = _distributed.nCap;

        // Build monthly program
        const seasons = _dist.seasons(inputs.hemisphere);
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
                // GH-379: the folded key that actually drove this computation
                // (upper-cased, this stamp's existing convention), never the
                // caller's raw spelling.
                methodology: methodologyUsed.toUpperCase(),
                species: inputs.species,
                speciesDisplay: inputs.speciesDisplay || null,
                surfaceType: inputs.surfaceType,
                hemisphere: inputs.hemisphere,
                distribution: inputs.distribution,
                clippingManagement: inputs.clippingManagement,
                // GH-383 (D31): the annual N the user actually entered, BEFORE
                // the traffic modifier. adjustments.target_n below stays the
                // adjusted figure (existing consumers read it), but the restore
                // path and the export's per-site N both read this one — without
                // it, restoring the adjusted value into the input and
                // regenerating would compound the modifier every time.
                annualNBase: baseAnnualN,
                trafficIntensity: inputs.traffic || 'moderate',
                trafficSource: (inputs.inputSources && inputs.inputSources.trafficIntensity) || null,
                // GH-383: where each programme-level input came from, as
                // resolved by the shared adapter. Provenance is data: the Word
                // export carries the same map on engineInputs.sources, and the
                // E2E harness compares the two with toEqual, so a fourth
                // instance of the "both surfaces read the same concept from
                // different places" bug fails a named row rather than a
                // numeric tolerance three tables later.
                inputSources: inputs.inputSources || null,
                // GH-438: whether bulk density and sampling depth are the
                // sample's own readings or the engine's defaults. They set the
                // ppm->kg/ha factor, so the Plan's calculation-trace block can
                // now name the source of the two numbers behind every lift and
                // headroom term instead of offering the reader both options.
                // Derived here as well as carried: collectFromState() resolves
                // them for the Plan page's own generate(), but computeProgram()
                // is also called directly (the export path, the tests), and a
                // flag that is only sometimes populated is worse than none --
                // it would read as "measured" wherever it was simply absent.
                // Same `> 0` test the value itself is resolved by, so the flag
                // and the number it describes cannot disagree.
                bulkDensityDefaulted: (inputs.bulkDensityDefaulted === true) ||
                    !(parseFloat(inputs.bulkDensity) > 0),
                soilDepthDefaulted: (inputs.soilDepthDefaulted === true) ||
                    !(parseFloat(inputs.soilDepth) > 0),
                // GH-371 (D01): the coordinates that actually drove THIS
                // computation — i.e. inputs.latitude/longitude, which
                // collectFromState() resolved from the DOM/state.location at
                // the moment generate() ran, the same values that determined
                // which climate normals resolved inputs.monthlyTemps. Not a
                // separately re-read "current" value — this is a record of
                // what was actually used, so a later coordinate change can be
                // detected by comparing against it, not by re-deriving
                // "current" a second time and hoping the two reads agree.
                // null (not omitted) when the caller couldn't resolve real
                // coordinates, so a stale-check consumer can tell "unknown"
                // apart from "0,0" rather than silently skipping the check.
                lat: typeof inputs.latitude === 'number' ? inputs.latitude : null,
                lon: typeof inputs.longitude === 'number' ? inputs.longitude : null,
                // GH-425: the monthly-normals provenance that produced
                // `monthlyTemps` — i.e. the series every `program.monthly[m].gp`
                // was computed from. climate-normals-service.js publishes it on
                // window.climateMetrics, which this pure function cannot read,
                // so collectFromState() hands it in. null for a caller that
                // supplies its own temperatures without saying where from.
                monthlyTempsSource: inputs.monthlyTempsSource || null,
                monthlyTempsPeriod: inputs.monthlyTempsPeriod || null,
                // GH-425: the cap as CONFIGURED. adjustments.max_n_per_month is
                // the cap the distributor actually clamped at and is null when
                // no cap was supplied at all; this is the input either way.
                maxNPerMonth: inputs.maxNPerMonth,
            },
            soil: {
                ppm: inputs.soilPpm,
                deficits: deficits,
                methodology: methodologyUsed, // GH-379: folded key, see meta.methodology
                bulkDensity: inputs.bulkDensity,
                soilDepth: inputs.soilDepth,
                // GH-421: the cation exchange capacity this programme was
                // computed against, carried on the programme itself so a
                // consumer does not have to go looking for it. The product
                // recommenders score leaching risk on CEC, and the only way
                // they had to obtain it was to re-read the page — a read that
                // succeeded on one surface and fell through to an invented
                // number on the other. Whatever route the sample took into the
                // calendar, the value that drove THIS programme is here.
                // `null` means no reading, and stays null: this is a soil
                // measurement, and there is no such thing as a default one.
                CEC: (typeof inputs.CEC === 'number' && isFinite(inputs.CEC))
                    ? inputs.CEC
                    : (inputs.CEC != null && isFinite(parseFloat(inputs.CEC)) ? parseFloat(inputs.CEC) : null),
                // GH-425: the two remaining sample-level inputs that select a
                // sufficiency range but were nowhere on the programme. pH picks
                // the MLSN / SLAN phosphorus floor off its ladder, and the
                // texture picks the Hill Labs certificate (or the generic band)
                // under Ammonium Acetate. Both already drove this computation;
                // neither could be read back off its result.
                pH: (typeof inputs.pH === 'number' && isFinite(inputs.pH)) ? inputs.pH
                    : (inputs.pH != null && isFinite(parseFloat(inputs.pH)) ? parseFloat(inputs.pH) : null),
                soilTexture: inputs.soilTexture || null,
            },
            // GH-338: { P: true, K: true, ... } for nutrients with no real
            // soil ppm reading -- Required for these is removal-only (no
            // deficit/lift, since neither is computable without a sample),
            // not a confirmed "soil is sufficient" number. Consumers should
            // show "No soil data" rather than presenting it as measured.
            missing_soil_data: missingSoilData,
            annual_totals: annualRequirements,
            // GH-361: true when the P/K removal ratio came from this site's
            // own tissue sample rather than the generic textbook constant —
            // consumers (export disclosure, debugging) can tell the two
            // apart without re-deriving it.
            tissue_gate_applied: _tissueGateEligible,
            // GH-425: the tissue reading the gate above was judged on, so a
            // reader can see the two ratios rather than only the verdict. null
            // when the site has no tissue analysis — the ordinary case.
            tissue_percent: inputs.tissuePercent || null,
            // GH-425: the shared requirement core's own per-nutrient working —
            // the branch it took ('lift-to-floor' / 'maintain-floor' /
            // 'suppress-above-ceiling' / 'removal-only' / 'removal-only-
            // unverified' / 'removal-only-no-soil-data'), the floor and ceiling
            // it compared against, the removal ratio and where it came from, the
            // clipping factor, the ppm->kg/ha unit, the correction period and the
            // lift. Everything above is a TOTAL; this is how each total was
            // reached. Published so a consumer can show the derivation without
            // owning a second copy of the arithmetic — see assets/plan-calc-
            // trace.js, which is temporary, while this field is not: it is the
            // engine describing its own result.
            requirement_detail: _per,
            // GH-304: 'certificate' | 'texture-fallback' per P/K/Ca/Mg/S nutrient
            // (N excluded -- it has no AA sufficiency-range concept at all).
            // Only meaningful under AA; stays all-'texture-fallback' for MLSN/SLAN
            // sites too, but renderSummary() only reads this when isAA, so it's
            // inert there.
            annual_totals_range_source: annualRangeSource,
            // GH-311: the resolved {min,max} ppm range per P/K/Ca/Mg/S nutrient
            // (certificate-first, generic fallback -- same object STEP 4 uses
            // for the floor/ceiling above), exposed so downstream consumers
            // (nutrition-prebble-integration.js's "excess delivery" check)
            // can convert the ceiling to kg/ha without re-resolving it
            // independently. null per nutrient under MLSN/SLAN or when
            // uncovered -- same graceful-degradation shape as aaRanges itself.
            annual_totals_range: annualTotalsRange,
            // GH-312: Removal and Lift exposed separately (previously only
            // their sum, annual_totals/"Required", was returned). Required
            // conflates three different things depending on branch (pure
            // removal / removal+lift / forced 0 above ceiling), which made
            // the "Nutrient Delivery Summary" table's Balance calculation
            // ambiguous -- see the GH-311 follow-up discussion. Removal
            // (research-backed baseline uptake, Kopp & Guillard 2002 etc.,
            // the per-species REMOVAL_RATES table) is a physical quantity that happens
            // regardless of methodology/ceiling/floor status; Lift (deficit
            // correction spread over yearsToCorrect, "Gilba practice
            // consistent with Carrow et al. 2001") is 0 whenever current >=
            // floor. annual_totals ("Required") stays exactly as before --
            // Removal + Lift, except forced to 0 above the AA ceiling -- so
            // downstream consumers (K-recon floor, PrebbleRecommender's
            // product-selection scoring) are unaffected by this addition.
            annual_removal: adjustedRemoval,
            annual_lift: annualCorrection,
            adjustments: {
                n_cap_applied: nCapResult.capApplied,
                // GH-398: the cap this programme was clamped at, null when
                // uncapped. Additive: the Word export's Monthly N Distribution
                // table now runs the same cap, and a reader comparing the two
                // surfaces needs to see which number did the clamping, not
                // only that something did.
                max_n_per_month: nCapResult.maxNPerMonth,
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

    /**
     * GH-403 — the one rounding step applied to an annual requirement on this
     * page.
     *
     * `annual_totals` carries the shared core's canonical 0.1 kg/ha figure now
     * that computeProgram() no longer snaps it to a whole kilogram, so every
     * surface that PRINTS it has to round it itself, once, here. One decimal is
     * the precision the Word export's Annual Nutrient Requirements table has
     * always printed this quantity at, and the precision the Plan's own
     * Nutrient Delivery Summary prints beside it — so all three now read the
     * same number rather than three roundings of it.
     */
    function _annualTotalForDisplay(value) {
        const v = parseFloat(value);
        if (!isFinite(v)) return '—';
        return v.toFixed(1);
    }

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

        // GH-416 (decision D-5): a programme built with no soil analysis behind
        // it says so, on the page, in the same place the monthly-cap banner
        // appears. Canberra and Test1 - Sports have no soil samples at all and
        // Westview and test4 - USA have one carrying nothing but pH; all four
        // produced a full seven-product programme with nothing on screen to say
        // the P/K/Ca/Mg/S figures behind it are removal estimates rather than
        // measurements. Generate is deliberately NOT blocked — the nitrogen
        // calendar is correct without a soil test, and "N now, sample later" is
        // a scenario the product supports.
        //
        // The condition is the engine's own `missing_soil_data`, not a sample
        // count: no sample and a pH-only sample reach the engine as the same
        // thing (`intent: 'removal-only-no-soil-data'` on every nutrient) and
        // must read the same way here. Both P and K, because a sample missing
        // just one of them is a different, narrower statement.
        const _msd = p.missing_soil_data || {};
        const _noSoilTest = !!(_msd.P && _msd.K);

        // GH-414: this zone has no tissue analysis of its own, so the P and K
        // removal ratios came from the species table rather than from the
        // plant. Only shown when the SITE has tissue results — on a site with
        // none the generic ratio is not a fact worth reporting, it is the norm.
        const _tz = this._tissueZoneMatch;
        const _noZoneTissue = !!(_tz && _tz.siteHasTissue && !_tz.matchedLabel);

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

                ${_noSoilTest ? `
                    <div class="gilba-nut-banner gilba-nut-banner--warning">
                        <strong>Built without a soil test:</strong>
                        P/K/Ca/Mg/S are removal-only estimates; add a soil sample to size them.
                    </div>
                ` : ''}

                ${_noZoneTissue ? `
                    <div class="gilba-nut-banner gilba-nut-banner--warning">
                        No tissue sample for this zone — generic P/K removal ratios used.
                    </div>
                ` : ''}

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
                    ${['N','P','K','Ca','Mg','S'].map(el => {
                        // GH-304: same rangeSource concept as the Soil page's
                        // .sn-generic-badge (hub-tissue-v3.js/soil-nutrition-
                        // analysis.js) -- label, don't hide, when this
                        // nutrient's ceiling used the texture-only generic
                        // range instead of a printed certificate value (e.g.
                        // S on an S277/S279 site, which prints no Sulphur
                        // range at all). N has no AA range concept, never
                        // gets the badge.
                        const isAA = this.normalizeMethodology(meta.methodology) === 'ammonium_acetate'; // GH-379
                        const rangeSource = p.annual_totals_range_source || {};
                        const isGeneric = isAA && el !== 'N' && rangeSource[el] === 'texture-fallback';
                        const genericBadge = isGeneric
                            ? `<span class="gilba-nut-generic-badge" title="No Hill Labs certificate range for this nutrient on this sample type -- this figure uses a generic soil-texture estimate instead.">Generic</span>`
                            : '';
                        return `
                        <div class="gilba-nut-total${el === 'N' ? ' gilba-nut-total--n' : ''}">
                            <div class="gilba-nut-total-val">${_annualTotalForDisplay(totals[el])}</div>
                            <div class="gilba-nut-total-name">${el}${genericBadge}</div>
                            <div class="gilba-nut-total-unit">kg/ha/yr</div>
                        </div>
                    `;}).join('')}
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

    /**
     * GH-371 (D01) — a persisted nutrition programme's stamped coordinates
     * no longer match this site's current coordinates (restoreFromPersisted()
     * checked and found the drift). Tell the user why the panel is empty and
     * what to do, the same honest-gap shape as renderClimateUnavailableBanner()
     * rather than silently rendering nothing or, worse, the stale numbers.
     */
    NutritionCalendar.renderStaleOnCoordinateChangeBanner = function() {
        this._renderStaleProgramBanner(
            'Site coordinates changed',
            'This site\'s location was updated since the last nutrition programme was generated. ' +
            'Click "Generate" to recompute it for the current coordinates.'
        );
    };

    /**
     * GH-377 — the persisted programme's stamped species and/or methodology
     * (program.meta, see the GH-377 block above isC4Species()) no longer
     * match what this site is configured with. Same shape and same
     * "please regenerate" outcome as the GH-371 coordinate banner; names
     * exactly which input changed, from what to what.
     *
     * @param {Array<{field, was, now}>} drift - programInputsDrift() output
     * @param {object} [meta] - the stamped meta, for its human species label
     */
    NutritionCalendar.renderStaleOnInputChangeBanner = function(drift, meta) {
        const esc = (s) => String(s == null ? '' : s)
            .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
        const fmtMethodology = (m) => String(m || '').toUpperCase().replace(/_/g, ' ');
        // Prefer the label the site config actually carries for the current
        // species (what the user picked in Settings, e.g. "Couch") over the
        // engine key's generic name ("Bermudagrass") when it maps to that key.
        const siteTurf = this.getSiteConfigTurf();
        const currentLabelFor = (key) => {
            const raws = siteTurf ? [siteTurf.species, siteTurf.overseedSpecies, siteTurf.coolOverseed, siteTurf.warmBase] : [];
            const match = raws.find((raw) => typeof raw === 'string' && raw.trim() && this.normalizeSpecies(raw.trim()) === key);
            return match ? match.trim() : this.formatSpecies(key);
        };
        const parts = (drift || []).map((d) => {
            if (d.field === 'species') {
                const was = (meta && typeof meta.speciesDisplay === 'string' && meta.speciesDisplay.trim())
                    ? meta.speciesDisplay.trim() : this.formatSpecies(d.was);
                return 'grass species (' + esc(was) + ' to ' + esc(currentLabelFor(d.now)) + ')';
            }
            if (d.field === 'methodology') {
                return 'soil test methodology (' + esc(fmtMethodology(d.was)) + ' to ' + esc(fmtMethodology(d.now)) + ')';
            }
            return esc(d.field);
        });
        this._renderStaleProgramBanner(
            'Site configuration changed',
            'This site\'s ' + (parts.length ? parts.join(' and ') : 'configuration') +
            ' changed since the last nutrition programme was generated. ' +
            'Click "Generate" to recompute it for the current configuration.'
        );
    };

    /**
     * Shared body of the two stale-programme banners above (GH-371
     * coordinates, GH-377 species/methodology) — one place that clears the
     * programme, raises the "unavailable" signal and paints the warning.
     */
    NutritionCalendar._renderStaleProgramBanner = function(title, body) {
        const calendar = this.elements.calendar;
        this.program = null;
        // Same signal renderClimateUnavailableBanner() sets — every consumer
        // (regional integrations, word-export.js) already treats this as
        // "no real programme, don't substitute anything" regardless of which
        // reason produced it.
        window.GAIP_NUTRITION_PROGRAM_UNAVAILABLE = true;
        if (!calendar) return;
        if (this.elements.results) this.showResults();
        calendar.innerHTML = `
            <div class="gilba-nut-banner gilba-nut-banner--warning">
                <strong>${title}</strong>
                ${body}
            </div>
        `;
    };

    NutritionCalendar.renderCalendar = function() {
        const calendar = this.elements.calendar;
        if (!calendar || !this.program) return;

        const monthly = this.program.program.monthly;

        const rows = monthly.map(m => {
            const gpPct = Math.round(m.gp * 100);
            // GH-257: canonical GP colour thresholds — see gp-status.js. Was
            // 50/25; now 70/40 to match the dashboard/analysis/Word export.
            // GH-346: pass the raw fraction (m.gp), not the pre-rounded
            // gpPct -- gp-status.js's toPct() treats any value <= 1 as a
            // fraction and multiplies by 100 to normalise it. gpPct=1 (a
            // genuine 1%) collided with that heuristic and got re-multiplied
            // to 100 -> "high"/green, the opposite of correct (confirmed
            // live: three winter months at GP=1% rendered green while
            // GP=3-4% correctly rendered red). m.gp is never in the [0,1]
            // ambiguous integer zone except at true 0/100%, where both
            // interpretations agree, so passing it directly sidesteps the
            // collision without touching the shared helper (other callers
            // of GAIP_GPStatus already pass the raw fraction the same way,
            // e.g. nutrition-au-fertiliser-integration.js, nutrition-prebble-integration.js).
            const gpLevel = window.GAIP_GPStatus ? window.GAIP_GPStatus.getLevelFrac(m.gp) : (gpPct >= 70 ? 'high' : (gpPct >= 40 ? 'moderate' : 'low'));
            const gpClass = gpLevel === 'moderate' ? 'medium' : gpLevel;
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
        // GH-403: one decimal, the same step renderSummary() applies — the CSV
        // must not print the unrounded double now that annual_totals is
        // canonical at 0.1 kg/ha.
        csv += `TOTAL,,,"${_annualTotalForDisplay(t.N)}","${_annualTotalForDisplay(t.P)}","${_annualTotalForDisplay(t.K)}","${_annualTotalForDisplay(t.Ca)}","${_annualTotalForDisplay(t.Mg)}","${_annualTotalForDisplay(t.S)}"\n`;

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

        // GH-371 (D01): stamp which coordinates the just-persisted
        // nutritionCalendarProgram was actually computed against (its own
        // meta.lat/meta.lon, set by computeProgram() from the exact
        // collectFromState() inputs that drove that computation) into the
        // patch itself, BEFORE branching into either persistence path below —
        // this is the one place both paths this function documents (hub
        // pages via GAIP_SiteConfig.mergeConfig(), and Plan/plan.blade.php's
        // own direct PUT fallback, which never loads site-config-
        // persistence.js at all) actually share. Stamping only inside
        // mergeConfig() would leave Plan's own direct-PUT path — the exact
        // page D01 is about — completely unstamped (confirmed live: a
        // programme generated from Plan produced a NULL nutritionProgramCoords
        // server-side). nutritionProgram (the regional-integration product
        // object, persisted moments later via the gaip:nutrition-calendar-
        // generated event chain) is always generated from this same
        // calendarProgram, so it shares this one stamp rather than needing
        // its own. Only set when the incoming programme actually carries
        // real coordinates — never overwrites a good existing stamp with a
        // blank one from an unrelated patch (e.g. { nzDistributor: ... }).
        if (patch && patch.nutritionCalendarProgram && patch.nutritionCalendarProgram.meta &&
            typeof patch.nutritionCalendarProgram.meta.lat === 'number' &&
            typeof patch.nutritionCalendarProgram.meta.lon === 'number') {
            patch = Object.assign({}, patch, {
                nutritionProgramCoords: {
                    lat: patch.nutritionCalendarProgram.meta.lat,
                    lon: patch.nutritionCalendarProgram.meta.lon
                }
            });
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

        // GH-371 (D01): a coordinate write invalidates this cached programme.
        // Compare what it was actually computed against (program.meta.lat/lon,
        // stamped by computeProgram() itself — see that function's own
        // comment) with the site's real current coordinates, resolved the
        // same way the live generate() path does. On a genuine mismatch,
        // don't render the stale copy.
        //
        // A live recompute here (the alternative the client asked to
        // consider) isn't attempted: this runs from init(), before
        // restoreConfig()'s own staggered setTimeout chain has necessarily
        // finished populating turf identity into the DOM/state that
        // collectFromState() would need for a trustworthy recompute, and it
        // would need an async climate-normals fetch this function isn't
        // structured to await. Falls back to the same "please regenerate"
        // shape GH-245 already established for climate-unavailable, which is
        // both safe and honest about why the panel is empty.
        // GH-377: resolved once here and shared by both stale checks (the
        // GH-371 coordinate one directly below, then species/methodology).
        const _freshCoords = this.collectFromState();
        if (program.meta && typeof program.meta.lat === 'number' && typeof program.meta.lon === 'number') {
            if (typeof _freshCoords.latitude === 'number' && typeof _freshCoords.longitude === 'number') {
                const _latDrift = Math.abs(program.meta.lat - _freshCoords.latitude);
                const _lonDrift = Math.abs(program.meta.lon - _freshCoords.longitude);
                // 0.01 degree (~1km at the equator) absorbs floating-point/
                // display rounding noise, not a real site relocation — same
                // tolerance used in site-config-persistence.js's carry-forward
                // check (mergeConfig()/snapshotConfig()), kept in step
                // deliberately.
                if (_latDrift > 0.01 || _lonDrift > 0.01) {
                    console.warn('[NutritionCalendar] GH-371: persisted programme was computed for (' +
                        program.meta.lat + ',' + program.meta.lon + ') but this site\'s current ' +
                        'coordinates are (' + _freshCoords.latitude + ',' + _freshCoords.longitude +
                        ') — coordinates changed since this programme was generated. Not rendering the ' +
                        'stale copy.');
                    this.renderStaleOnCoordinateChangeBanner();
                    return;
                }
            }
        }

        // GH-377: the same check for the programme's own computation inputs —
        // species and methodology, both stamped in program.meta by
        // computeProgram() (see the GH-377 block above isC4Species() for what
        // is and is not compared, and why). The current side is what a
        // regenerate would use right now: collectFromState()'s resolved
        // values (skipped when they are only fallbacks) plus the site
        // config's own base/overseed species and methodology. Absent stamp
        // fields or an unresolvable current state mean "trust it" — same
        // forward-looking rule as the coordinate check.
        if (program.meta) {
            const _candidates = this.collectProgramInputCandidates({
                fresh: _freshCoords,
                turfs: this.getSiteConfigTurf(),
                lat: _freshCoords.latitude,
                lon: _freshCoords.longitude,
            });
            const _drift = this.programInputsDrift(program.meta, _candidates);
            if (_drift.length) {
                console.warn('[NutritionCalendar] GH-377: persisted programme was computed for ' +
                    _drift.map((d) => d.field + '=' + d.was).join(', ') +
                    ' but this site is now configured with ' +
                    _drift.map((d) => d.field + '=' + d.now).join(', ') +
                    ' — species/methodology changed since this programme was generated. ' +
                    'Not rendering the stale copy.');
                this.renderStaleOnInputChangeBanner(_drift, program.meta);
                return;
            }
        }

        if (!this.elements.results) this.init();
        if (!this.elements.results) {
            console.warn('[NutritionCalendar] persist-debug: SKIPPED — [data-nutrition-results] element not found even after init()');
            return;
        }

        console.log('[NutritionCalendar] persist-debug: restoring panel from persisted program', program);
        this.program = program;
        if (this.elements.annualNInput && program.adjustments) {
            // GH-383: restore the PRE-traffic base, not adjustments.target_n
            // (which is base x modifier). Restoring the adjusted figure into
            // the input and regenerating would multiply the modifier in again
            // on every cycle. meta.annualNBase is written by computeProgram();
            // programmes generated before GH-383 carry only target_n, so the
            // modifier is divided back out for those.
            const _meta = program.meta || {};
            const _mod = (program.adjustments.traffic_modifier > 0) ? program.adjustments.traffic_modifier : 1;
            const _base = (_meta.annualNBase > 0)
                ? _meta.annualNBase
                : (program.adjustments.target_n / _mod);
            this.elements.annualNInput.value = Math.round(_base);
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

        // GH-322 follow-up: restoreFromPersisted() never dispatched this
        // event, only generate() did -- so any consumer relying on it to
        // know "a program is now available" (plan-ui.js's Monthly N Need
        // KPI card) never fired on the restore path. Confirmed live via
        // [GH322-DEBUG]: on plan.blade.php specifically, restoreFromPersisted()
        // is called directly from init() (line ~214, no
        // 'gaip:site-config-applied' event exists on this page at all --
        // see the comment there), so listening for that event was a dead
        // end; this dispatch is the one signal every consumer can rely on
        // regardless of which path (live generate vs restore) populated
        // this.program. Safe for the regional integrations (NZ/AU/UK),
        // which already have their own independent "late-render catch-up"
        // self-check at their own init() time -- they render at most once
        // either way, whichever mechanism reaches them first.
        console.log('[GH322-DEBUG] restoreFromPersisted() dispatching gaip:nutrition-calendar-generated');
        document.dispatchEvent(new CustomEvent('gaip:nutrition-calendar-generated', {
            detail: { program: this.program }
        }));
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

/**
 * NUTRITION PROGRAMME INPUT ADAPTER — SHARED (GH-383)
 *
 * The ONE module allowed to read site config, sample state or the DOM for the
 * programme-level inputs of a nutrition requirement computation. Both surfaces
 * call it, so "the Plan page and the export read the same concept from
 * different places" — the bug class behind GH-352..357, GH-379, the clipping
 * gap and the annual-N gap — cannot recur field by field.
 *
 *   Settings / samples / site config / Plan form
 *                     |
 *                     v
 *   nutrition-program-inputs.js   (this file)
 *                     |
 *                     v
 *   nutrition-requirement-core.js  (pure; per-nutrient removal + correction
 *                     |             + ceiling/floor — no globals at all)
 *          .----------'----------.
 *          v                     v
 *   nutrition-calendar.js   nutrition-requirement-engine.js (facade)
 *   computeProgram()        compute() -> word-export*.js, old hub panel
 *
 * WHAT LIVES HERE, AND WHY IT IS ONE MODULE AND NOT TWO ADAPTERS
 *
 *   resolveSufficiencyRanges()  the AA certificate / generic-band, SLAN
 *                               (Carrow 2004 + Spencer pH ladder) and MLSN
 *                               (Woods 2016 + the D-7 pH ladder) floors and
 *                               ceilings. Before GH-383 this existed twice:
 *                               nutrition-calendar.js computeProgram()'s STEP 4
 *                               and word-export.js _buildEngineInputs()'s IIFE,
 *                               each with its own texture chain and its own
 *                               species spelling. Six tickets went into keeping
 *                               those two in step; this is the single copy.
 *
 *   resolveSiteProgramInputs()  annual N (with provenance), clipping
 *                               management, traffic, turf type, species key +
 *                               display name, methodology, texture, CEC, pH —
 *                               resolved once per site, per sample.
 *
 *   deriveTrafficIntensity()    stage 3 of the D31 plan. Returns
 *                               moderate / 1.0 / 'not-wired' until the
 *                               Settings > Traffic & Wear schedule is actually
 *                               persisted in the site config; decision D-10
 *                               (matches/week > 3 -> extreme, > 1 -> high, else
 *                               moderate; unsaved schedule -> moderate; sports
 *                               turf only) is settled but deliberately NOT
 *                               implemented in this ticket.
 *
 *   resolveAnnualN()            base x traffic modifier, rounded — the
 *                               calendar's own semantics, in one place, so the
 *                               modifier can never be applied twice.
 *
 *   validateSampleInputs()      the Plan page's null-not-zero rule (GH-338)
 *                               enforced for every caller, retiring
 *                               word-export-combined.js's `parseFloat(...) || 0`
 *                               which turned a missing reading into 0 ppm, i.e.
 *                               maximally deficient against every floor.
 *
 * Every resolved field carries a `sources.<field>` stamp saying where it came
 * from. The calendar persists them as meta.inputSources and the export carries
 * them on engineInputs.sources, so the E2E harness compares two resolved input
 * objects field by field instead of chasing a numeric difference three tables
 * later.
 *
 * Console prefix is '[NutritionInputs]' — the E2E harness's fail-loud regex
 * must not start matching adapter chatter.
 *
 * @provides GAIP_NutritionProgramInputs
 */

(function (global) {
    'use strict';

    const VERSION = '1.0.0-gh383';

    let _coreCached = null;
    function _core() {
        if (_coreCached) return _coreCached;
        _coreCached = (typeof global !== 'undefined' && global.NutritionRequirementCore) ||
            (typeof window !== 'undefined' && window.NutritionRequirementCore) || null;
        if (!_coreCached && typeof module !== 'undefined' && module.exports && typeof require === 'function') {
            // CommonJS (jest) — the browser loads the core as a plain <script>
            // that publishes window.NutritionRequirementCore, but under Node
            // there is no such global unless a test set one up.
            try { _coreCached = require('./nutrition-requirement-core.js'); } catch (e) { /* not resolvable */ }
        }
        return _coreCached;
    }

    function _win() {
        return (typeof window !== 'undefined') ? window : (global || {});
    }

    function _doc() {
        return (typeof document !== 'undefined') ? document : null;
    }

    // ==========================================================================
    // Traffic — decisions D-2 (calendar's table), D-3 (sports only), D-10
    // (thresholds; stage 3). The table is here rather than in the pure core
    // because it scales the ANNUAL N, upstream of every nutrient, and applying
    // it per nutrient as well would double-count it.
    // ==========================================================================
    const TRAFFIC_MODIFIERS = { low: 0.85, moderate: 1.0, high: 1.15, extreme: 1.3 };

    /**
     * deriveTrafficIntensity(schedule, turfType)
     *
     * STAGE 3 OF THE D31 PLAN — NOT WIRED IN THIS TICKET. The Settings >
     * Traffic & Wear schedule currently lives only in
     * localStorage['gilba_traffic_state_<siteId>'] and never reaches the site
     * config, so there is nothing to derive from; every site resolves
     * moderate / 1.0 today, exactly as both engines already did.
     *
     * When stage 3 lands, this function gets decision D-10's rule and nothing
     * else changes: matches/week > 3 -> extreme, > 1 -> high, otherwise
     * moderate; an empty or unsaved schedule -> moderate (never read a form
     * placeholder or the legacy `.gaip-matches-week` DOM input, which carries
     * value="2"); and the whole thing applies only to
     * turf.turfType === 'sports'.
     */
    function deriveTrafficIntensity(schedule, turfType) {
        if (turfType !== 'sports') {
            return { level: 'moderate', modifier: 1.0, source: 'not-sports' };
        }
        return { level: 'moderate', modifier: 1.0, source: 'not-wired' };
    }

    /**
     * The calendar's own semantics (nutrition-calendar.js computeProgram():
     * `Math.round(baseAnnualN * trafficMod)`), in one place.
     */
    function resolveAnnualN(args) {
        const base = args && args.base;
        const modifier = (args && typeof args.trafficModifier === 'number' && args.trafficModifier > 0)
            ? args.trafficModifier : 1.0;
        if (typeof base !== 'number' || !(base > 0)) return null;
        return Math.round(base * modifier);
    }

    // ==========================================================================
    // Species / methodology folding
    // ==========================================================================

    // ==========================================================================
    // Surface type — GH-387. TWO values, because two vocabularies are genuinely
    // in use and collapsing them would be a guess:
    //
    //   `surfaceType`            the raw surface the calendar works in
    //                            ('greens', 'soccer', ...). This is what
    //                            nutrition-calendar.js's collectFromState()
    //                            resolves and stamps as meta.surfaceType, and
    //                            what the NZ/Prebble recommender is given.
    //   `recommenderSurfaceType` the canonical surface key the AU product
    //                            recommender keys on ('golf_greens', 'tees',
    //                            'fairways', 'bowling_greens', ...), mapped
    //                            from turfType + subCategory.
    //
    // Both surfaces must agree on both. GH-383 assigned `turfType` ('golf',
    // 'sports') into the export's `surfaceType`, which is a third thing again —
    // see this ticket's changelog for what that did to product selection.
    // ==========================================================================

    /**
     * turfType + subCategory -> the canonical surface key the product
     * recommenders switch on. Ported from nutrition-au-fertiliser-integration.js
     * `getSurfaceType()`'s own `_mapTurfType`, which now calls this instead, so
     * the mapping exists once and the Plan page and the Word export cannot
     * resolve it differently.
     */
    function mapSurfaceKey(turfType, subCategory) {
        if (!turfType) return null;
        if (turfType === 'golf') {
            if (subCategory === 'greens') return 'golf_greens';
            if (subCategory === 'tees') return 'tees';
            if (subCategory === 'fairways') return 'fairways';
            if (subCategory === 'surrounds') return 'fairways';
            return 'golf_greens';
        }
        if (turfType === 'bowling' || turfType === 'bowls') return 'bowling_greens';
        if (turfType === 'cricket') return 'cricket_wickets';
        if (subCategory) return subCategory;
        return turfType;
    }

    /**
     * The raw surface the calendar works in. Same chain, same order and the
     * same 'sports' default nutrition-calendar.js's collectFromState() has
     * always used — a per-sample soil reading first, then the site's
     * sub-category.
     */
    function resolveSurfaceType(opts) {
        opts = opts || {};
        const fromSample = (opts.soil && opts.soil.surfaceType) || opts.sampleSurfaceType || null;
        if (fromSample) {
            return fromSample === 'cotula_bowling_green' ? 'bowling_greens' : fromSample;
        }
        return opts.subCategory || 'sports';
    }

    /**
     * ONE species resolution, producing BOTH values the two downstream
     * consumers need (plan pitfall 9): the nutrient key the core's
     * REMOVAL_RATES table is indexed by, and the display name Hill Labs'
     * deriveCode() expects. `poaAnnua` and `cotula` have no removal-rate row
     * and fold to `mixedCool` inside the core — today's export behaviour, kept.
     */
    function resolveSpeciesKey(raw) {
        const w = _win();
        if (w.SpeciesController && typeof w.SpeciesController.normalize === 'function' &&
            typeof w.SpeciesController.toNutrientKey === 'function') {
            return w.SpeciesController.toNutrientKey(w.SpeciesController.normalize(raw));
        }
        const core = _core();
        return core ? core._normalizeSpecies(raw) : (raw || null);
    }

    function resolveSpeciesDisplay(raw) {
        if (typeof raw === 'string' && raw.trim()) return raw.trim();
        if (raw && typeof raw === 'object') {
            return raw.name || raw.species || raw.grassSpecies || '';
        }
        return '';
    }

    /**
     * The calendar's normaliser (lower_snake: 'ammonium_acetate' | 'slan' |
     * 'mlsn'), folded once. GH-379: word-export.js stamps the methodology
     * UPPER-CASED, the calendar works in lower snake, and a caller's spelling
     * must never route a methodology branch.
     */
    function normalizeMethodology(methodology) {
        if (methodology === null || methodology === undefined) return '';
        let key = String(methodology).trim().toLowerCase();
        if (!key) return '';
        key = key.replace(/[\s-]+/g, '_');
        if (key === 'aa' || key === 'ammoniumacetate' || key === 'ammonium_acetate' ||
            key === 'cotula_s78' || key === 'cotula') {
            return 'ammonium_acetate';
        }
        return key;
    }

    // ==========================================================================
    // Soil texture — ONE chain, GH-364's order: this sample's own recorded
    // snapshot, then the sample/soil object, then the site's configured
    // texture, then the construction bucket as a last resort. Before GH-383
    // the Plan page read only the middle two and the export read all four in
    // a different order, which is the GH-352..364 seam.
    // ==========================================================================
    function resolveSoilTexture(opts) {
        opts = opts || {};
        const w = _win();
        let sampleTexture = opts.sampleTextureSnapshot || null;
        if (!sampleTexture) {
            try {
                const SM = w.GAIP_SampleManager;
                const active = (SM && typeof SM.getActiveSample === 'function') ? SM.getActiveSample('soil') : null;
                sampleTexture = (active && active.soilTextureSnapshot) || null;
            } catch (e) {
                console.warn('[NutritionInputs] per-sample soil texture read failed:', e && e.message);
            }
        }
        const soil = opts.soil || {};
        const turf = opts.turf || {};
        const constructionTexture = (turf.construction === 'sand_profile' || turf.construction === 'sand profile')
            ? 'sand' : null;

        if (sampleTexture) return { value: sampleTexture, source: 'sample-snapshot' };
        const fromSoil = soil.soilTexture || soil.texture || null;
        if (fromSoil) return { value: fromSoil, source: 'sample-soil' };
        const fromHub = (w.GAIP_HUB_CONFIG && w.GAIP_HUB_CONFIG.soilTexture) || null;
        if (fromHub) return { value: fromHub, source: 'site-config' };
        if (constructionTexture) return { value: constructionTexture, source: 'turf-construction' };
        return { value: null, source: 'unresolved' };
    }

    function aaTextureKey(soilTexture) {
        return String(soilTexture || '').toLowerCase().indexOf('sand') !== -1 ? 'sands' : 'others';
    }

    // ==========================================================================
    // Sufficiency ranges — the single resolver for all three methodologies.
    // ==========================================================================

    const NUTRIENTS = ['P', 'K', 'Ca', 'Mg', 'S'];

    /**
     * resolveSufficiencyRanges({ methodology, speciesDisplay, speciesKey,
     *                            soilTexture, CEC, pH })
     *   -> { ranges: { P: {min,max,label,citation}|null, ... },
     *        sources: { P: 'certificate'|'texture-fallback', ... },
     *        certificateCode }
     *
     * AA   — Hill Labs certificate first (deriveCode -> getRangesPpm), then
     *        AmmoniumAcetateMethodology's generic sands/others medium band
     *        (GH-305: an uncertified-but-clearly-high nutrient must still get a
     *        ceiling). `sources` stays 'texture-fallback' for the generic path,
     *        which is what drives the "Generic" badge (GH-304).
     * SLAN — Carrow et al. (2004) ranges from GilbaClassificationConstants
     *        (SSOT) with the published fallback, and the Spencer scaled-ladder
     *        pH adjustment on the P floor (GH-382, b35fix334).
     * MLSN — Woods, Stowell & Gelernter (2016) minima from the same SSOT, with
     *        the pH-adjusted P ladder (decision D-7 — kept, and now live on the
     *        Plan page too, where it never was). Ceiling = minimum x 1.5, the
     *        hub-wide convention (GH-319); MLSN publishes no ceiling.
     */
    function resolveSufficiencyRanges(opts) {
        opts = opts || {};
        const core = _core();
        if (!core) throw new Error('[NutritionInputs] resolveSufficiencyRanges: nutrition-requirement-core.js is not loaded');

        const w = _win();
        const methodology = normalizeMethodology(opts.methodology) || 'mlsn';
        const ranges = { P: null, K: null, Ca: null, Mg: null, S: null };
        const sources = { P: 'texture-fallback', K: 'texture-fallback', Ca: 'texture-fallback', Mg: 'texture-fallback', S: 'texture-fallback' };
        const ph = (opts.pH != null && !isNaN(opts.pH)) ? parseFloat(opts.pH) : null;
        let certificateCode = null;

        if (methodology === 'ammonium_acetate') {
            const hlst = w.HillLabsSampleTypes || null;
            const aam = w.AmmoniumAcetateMethodology || null;
            const texKey = aaTextureKey(opts.soilTexture);
            const speciesForCode = opts.speciesDisplay || opts.speciesKey || null;
            certificateCode = (hlst && typeof hlst.deriveCode === 'function')
                ? hlst.deriveCode(speciesForCode, opts.soilTexture || null)
                : null;
            NUTRIENTS.forEach(function (n) {
                let r = (certificateCode && hlst && typeof hlst.getRangesPpm === 'function')
                    ? hlst.getRangesPpm(certificateCode, n, opts.CEC != null ? opts.CEC : undefined)
                    : null;
                if (r) {
                    sources[n] = 'certificate';
                } else if (aam && typeof aam.getSufficiencyRange === 'function') {
                    const generic = aam.getSufficiencyRange(n, texKey);
                    if (generic && generic.ranges && Array.isArray(generic.ranges.medium) &&
                        typeof generic.ranges.medium[1] === 'number' && isFinite(generic.ranges.medium[1])) {
                        r = { min: generic.ranges.medium[0], max: generic.ranges.medium[1] };
                    }
                }
                ranges[n] = r ? {
                    min: r.min, max: r.max,
                    label: 'AMMONIUM_ACETATE',
                    citation: sources[n] === 'certificate'
                        ? ('Hill Laboratories sufficiency certificate ' + certificateCode)
                        : 'Ammonium-acetate generic sufficiency band (' + texKey + ')'
                } : null;
            });
            return { ranges: ranges, sources: sources, certificateCode: certificateCode };
        }

        if (methodology === 'slan') {
            const gcc = w.GilbaClassificationConstants || null;
            const slan = (gcc && gcc.SLAN_RANGES) || core.SLAN_RANGES_FALLBACK;
            NUTRIENTS.forEach(function (n) {
                const r = slan[n];
                if (!r || typeof r.floor !== 'number' || typeof r.ceiling !== 'number') return;
                let floor = r.floor;
                let label = r.methodology || 'SLAN-Carrow-2004-range';
                let citation = r.citation || 'Carrow et al. (2004). GCM 72(1):194-198.';
                if (n === 'P' && ph !== null) {
                    floor = core._getSlanTargetP(ph);
                    label = 'SLAN-Carrow-2004-range-PH-ADJUSTED';
                    citation = 'Carrow et al. (2004) GCM 72(1):194-198 (floor); Carrow, Waddington & Rieke (2001) (pH adjustment ratios via Spencer scaled-ladder)';
                }
                ranges[n] = { min: floor, max: r.ceiling, label: label, citation: citation };
                // Not a "generic estimate vs certificate" axis the way AA has
                // one — this is simply the one published range. Tagged
                // 'certificate' so the AA-gated "Generic" badge never fires.
                sources[n] = 'certificate';
            });
            return { ranges: ranges, sources: sources, certificateCode: null };
        }

        // MLSN (default)
        const gcc = w.GilbaClassificationConstants || null;
        const mlsn = (gcc && gcc.MLSN_THRESHOLDS) || core.MLSN_THRESHOLDS;
        NUTRIENTS.forEach(function (n) {
            let floor = mlsn[n];
            if (typeof floor !== 'number') return;
            // Decision D-7: keep the pH ladder for the MLSN P threshold
            // (35/28/21/32/40). It was in the engine and the core all along and
            // missing from the calendar, so a Plan-page MLSN site away from
            // pH 6.0-7.5 silently used the flat 21 while the export used the
            // ladder. Resolved here once, so both surfaces get it.
            if (n === 'P' && ph !== null) {
                floor = core._getMLSNThreshold('P', ph);
            }
            ranges[n] = {
                min: floor,
                max: floor * core.MLSN_CEILING_MULTIPLIER,
                label: 'MLSN',
                citation: 'Woods, Stowell & Gelernter (2016), PACE Turf MLSN guidelines.'
            };
            sources[n] = 'certificate';
        });
        return { ranges: ranges, sources: sources, certificateCode: null };
    }

    // ==========================================================================
    // Site config access
    // ==========================================================================

    function getActiveSiteId() {
        const w = _win();
        try {
            if (w.GAIP_SampleManager && typeof w.GAIP_SampleManager.getActiveSiteId === 'function') {
                const id = w.GAIP_SampleManager.getActiveSiteId();
                if (id) return id;
            }
        } catch (e) { /* fall through */ }
        return (w.GAIP_HUB_CONFIG && w.GAIP_HUB_CONFIG.activeSiteId) || null;
    }

    /**
     * The site's persisted `gaip` config. Hub pages have GAIP_SiteConfig
     * (per-site store); plan.blade.php has only the server-rendered
     * window.GAIP_SITE_CONFIG for the ACTIVE site.
     *
     * Fails loud when neither resolves for the requested site. Silently
     * substituting the active site's config for another site is the exact
     * mechanism behind the cross-site annual-N leak (REVIEW open question 12)
     * and must not be reachable from here.
     */
    function getSiteConfig(siteId) {
        const w = _win();
        if (w.GAIP_SiteConfig && typeof w.GAIP_SiteConfig.getConfig === 'function') {
            const cfg = w.GAIP_SiteConfig.getConfig(siteId);
            if (cfg) return cfg;
        }
        if (siteId && siteId === getActiveSiteId() && w.GAIP_SITE_CONFIG) {
            return w.GAIP_SITE_CONFIG;
        }
        if (!siteId && w.GAIP_SITE_CONFIG) return w.GAIP_SITE_CONFIG;
        return null;
    }

    // ==========================================================================
    // Sample-level validation — the Plan page's null-not-zero rule for everyone
    // ==========================================================================

    function toPpm(v) {
        if (v === undefined || v === null || v === '') return null;
        const n = parseFloat(v);
        return isNaN(n) ? null : n;
    }

    /**
     * validateSampleInputs({ soilPpm|soil, tissuePercent, bulkDensity, soilDepth })
     *
     * GH-338: a field that is genuinely absent is `null`, never 0 — 0 ppm
     * reads as maximally deficient against every floor and silently triggers
     * the largest possible lift for a site that was never tested. This
     * replaces word-export-combined.js's `parseFloat(...) || 0` block.
     */
    function validateSampleInputs(raw) {
        raw = raw || {};
        const src = raw.soilPpm || raw.soil || {};
        const soilPpm = {};
        ['P', 'K', 'Ca', 'Mg', 'S', 'Fe', 'Mn', 'Zn', 'Cu'].forEach(function (n) {
            const nested = (src.ppm && src.ppm[n] !== undefined) ? src.ppm[n] : undefined;
            soilPpm[n] = toPpm(nested !== undefined ? nested : src[n]);
        });
        const tp = raw.tissuePercent || null;
        let tissuePercent = null;
        if (tp) {
            tissuePercent = { N: toPpm(tp.N), P: toPpm(tp.P), K: toPpm(tp.K) };
            if (tissuePercent.N == null && tissuePercent.P == null && tissuePercent.K == null) tissuePercent = null;
        }
        const bd = parseFloat(raw.bulkDensity);
        const sd = parseFloat(raw.soilDepth);
        const core = _core();
        return {
            soilPpm: soilPpm,
            tissuePercent: tissuePercent,
            bulkDensity: (!isNaN(bd) && bd > 0) ? bd : (core ? core.DEFAULT_BULK_DENSITY_G_CM3 : 1.4),
            soilDepth: (!isNaN(sd) && sd > 0) ? sd : (core ? core.DEFAULT_SOIL_DEPTH_CM : 10),
            bulkDensityDefaulted: !(!isNaN(bd) && bd > 0),
            soilDepthDefaulted: !(!isNaN(sd) && sd > 0)
        };
    }

    // ==========================================================================
    // The programme-level input contract
    // ==========================================================================

    /**
     * The Plan page's own live form, read ONLY when the requested site is the
     * active one and the Plan form is actually on the page (#plan-nut-annual-n
     * exists on plan.blade.php and nowhere else — the `.gaip-nutrition-annual-n`
     * CLASS is also on the legacy hidden input, so the class alone cannot tell
     * the two pages apart).
     */
    function readPlanForm(siteId) {
        const d = _doc();
        if (!d || (siteId && siteId !== getActiveSiteId())) return null;
        const nEl = d.getElementById('plan-nut-annual-n');
        if (!nEl) return null;
        const clipEl = d.getElementById('plan-nut-clipping');
        const n = parseFloat(nEl.value);
        return {
            annualN: (isFinite(n) && n > 0) ? n : null,
            clippingManagement: (clipEl && clipEl.value) ? clipEl.value : null
        };
    }

    /**
     * resolveSiteProgramInputs({ siteId, siteConfig?, sample?, planForm? })
     *
     * Returns every programme-level input both surfaces need, plus a
     * `sources` stamp per field. Sample-level values (soil ppm, tissue, bulk
     * density, depth) stay with the callers' own per-sample pipelines and go
     * through validateSampleInputs() instead.
     *
     * `sample` is the optional per-sample override object:
     *   { species, turfType, soilTexture, CEC, pH, methodology }
     * (b35fix367's multi-site turf profile, and the per-sample soil snapshot
     * word-export.js already resolves).
     */
    function resolveSiteProgramInputs(opts) {
        opts = opts || {};
        const core = _core();
        if (!core) throw new Error('[NutritionInputs] resolveSiteProgramInputs: nutrition-requirement-core.js is not loaded');

        const siteId = opts.siteId || getActiveSiteId();
        const cfg = opts.siteConfig || getSiteConfig(siteId);
        if (!cfg) {
            throw new Error('[NutritionInputs] no gaip site config resolved for site ' + siteId +
                ' — refusing to fall back to another site\'s configuration.');
        }
        const sample = opts.sample || {};
        const turf = cfg.turf || {};
        const persisted = cfg.nutritionCalendarProgram || null;
        const persistedMeta = (persisted && persisted.meta) || null;
        const persistedAdj = (persisted && persisted.adjustments) || null;

        const sources = {};

        // ── turf type (b35fix367 per-sample override accepted) ──
        let turfType = sample.turfType || turf.turfType || turf.type || null;
        sources.turfType = sample.turfType ? 'sample' : (turf.turfType || turf.type ? 'site-config' : 'unresolved');

        // ── surface type: the raw one the calendar uses, and the canonical key
        //    the product recommenders switch on. GH-387. ──
        const subCategory = sample.subCategory || turf.subCategory || null;
        const surfaceType = resolveSurfaceType({
            soil: opts.soil || null,
            sampleSurfaceType: sample.surfaceType || null,
            subCategory: subCategory
        });
        const recommenderSurfaceType = mapSurfaceKey(turfType, subCategory) || surfaceType;
        sources.surfaceType = (opts.soil && opts.soil.surfaceType) || sample.surfaceType
            ? 'sample' : (subCategory ? 'site-config' : 'default');

        // ── species ──
        const rawSpecies = sample.species || turf.species ||
            ((_win().GAIP_HUB_CONFIG || {}).turfSpecies) || null;
        sources.species = sample.species ? 'sample'
            : (turf.species ? 'site-config' : (rawSpecies ? 'hub-config' : 'unresolved'));
        const speciesKey = resolveSpeciesKey(rawSpecies);
        const speciesDisplay = resolveSpeciesDisplay(rawSpecies);

        // ── methodology ──
        const rawMethodology = sample.methodology || turf.methodology ||
            ((_win().GAIP_HUB_CONFIG || {}).turfMethodology) || null;
        sources.methodology = sample.methodology ? 'sample'
            : (turf.methodology ? 'site-config' : (rawMethodology ? 'hub-config' : 'default'));
        const methodology = normalizeMethodology(rawMethodology) || 'mlsn';

        // ── texture / CEC / pH ──
        const tex = resolveSoilTexture({
            sampleTextureSnapshot: sample.soilTexture || null,
            soil: opts.soil || null,
            turf: turf
        });
        sources.soilTexture = tex.source;
        const CEC = (sample.CEC != null) ? sample.CEC
            : ((opts.soil && (opts.soil.CEC != null ? opts.soil.CEC : opts.soil.cec)) != null
                ? (opts.soil.CEC != null ? opts.soil.CEC : opts.soil.cec) : null);
        const pH = (sample.pH != null) ? sample.pH
            : ((opts.soil && (opts.soil.pH_water != null ? opts.soil.pH_water : opts.soil.pH)) != null
                ? (opts.soil.pH_water != null ? opts.soil.pH_water : opts.soil.pH) : null);

        // ── clipping management ──
        // Live Plan select > this site's persisted programme > 'collected'
        // (the Plan select's first option, and the calendar's own default).
        // The legacy boolean GAIP_STATE.turf.clippingsCollected is NOT a
        // source: it has no writer anywhere in assets/ or app/, so it was
        // always false, i.e. "no information", and mapping false to 'returned'
        // would silently halve K removal for every caller that still passes it.
        const planForm = (opts.planForm !== undefined) ? opts.planForm : readPlanForm(siteId);
        let clippingManagement = null;
        if (planForm && planForm.clippingManagement) {
            clippingManagement = planForm.clippingManagement;
            sources.clippingManagement = 'plan';
        } else if (persistedMeta && persistedMeta.clippingManagement) {
            clippingManagement = persistedMeta.clippingManagement;
            sources.clippingManagement = 'plan-persisted';
        } else {
            clippingManagement = 'collected';
            sources.clippingManagement = 'default';
        }
        clippingManagement = core._resolveClippingManagement(clippingManagement);

        // ── traffic (stage 3; neutral today) ──
        const trafficSchedule = (cfg.traffic && cfg.traffic.schedule) || null;
        const traffic = deriveTrafficIntensity(trafficSchedule, turfType);
        sources.trafficIntensity = traffic.source;

        // ── annual N base, with provenance (decision D-4/D-4b) ──
        let annualNBase = null;
        if (planForm && planForm.annualN > 0) {
            annualNBase = planForm.annualN;
            sources.annualN = 'plan';
        } else if (persistedMeta && persistedMeta.annualNBase > 0) {
            annualNBase = persistedMeta.annualNBase;
            sources.annualN = 'plan-persisted';
        } else if (persistedAdj && persistedAdj.target_n > 0) {
            // Programmes generated before GH-383 carry only the
            // traffic-ADJUSTED target. Divide the modifier back out so the
            // base can never compound across regenerations.
            const mod = (persistedAdj.traffic_modifier > 0) ? persistedAdj.traffic_modifier : 1;
            annualNBase = persistedAdj.target_n / mod;
            sources.annualN = 'plan-persisted';
        } else if (turf.nProgram > 0) {
            annualNBase = parseFloat(turf.nProgram);
            sources.annualN = 'settings-turf';
        } else {
            const table = core.REMOVAL_RATES[core._normalizeSpecies(speciesKey || speciesDisplay)] ||
                core.REMOVAL_RATES.mixedCool;
            annualNBase = table.N;
            sources.annualN = 'species-default';
        }
        const annualN = resolveAnnualN({ base: annualNBase, trafficModifier: traffic.modifier });

        // ── sufficiency ranges ──
        const resolved = resolveSufficiencyRanges({
            methodology: methodology,
            speciesDisplay: speciesDisplay,
            speciesKey: speciesKey,
            soilTexture: tex.value,
            CEC: CEC,
            pH: pH
        });

        return {
            siteId: siteId,
            turfType: turfType,
            subCategory: subCategory,
            surfaceType: surfaceType,
            recommenderSurfaceType: recommenderSurfaceType,
            speciesKey: speciesKey,
            speciesDisplay: speciesDisplay,
            methodology: methodology,
            soilTexture: tex.value,
            CEC: CEC,
            pH: pH,
            clippingManagement: clippingManagement,
            trafficIntensity: traffic.level,
            trafficModifier: traffic.modifier,
            annualNBase: annualNBase,
            annualN: annualN,
            ranges: resolved.ranges,
            rangeSources: resolved.sources,
            certificateCode: resolved.certificateCode,
            sources: sources
        };
    }

    const API = {
        VERSION: VERSION,
        TRAFFIC_MODIFIERS: TRAFFIC_MODIFIERS,
        resolveSiteProgramInputs: resolveSiteProgramInputs,
        resolveSufficiencyRanges: resolveSufficiencyRanges,
        deriveTrafficIntensity: deriveTrafficIntensity,
        resolveAnnualN: resolveAnnualN,
        validateSampleInputs: validateSampleInputs,
        getSiteConfig: getSiteConfig,
        getActiveSiteId: getActiveSiteId,
        normalizeMethodology: normalizeMethodology,
        resolveSpeciesKey: resolveSpeciesKey,
        resolveSpeciesDisplay: resolveSpeciesDisplay,
        resolveSoilTexture: resolveSoilTexture,
        resolveSurfaceType: resolveSurfaceType,
        mapSurfaceKey: mapSurfaceKey,
        aaTextureKey: aaTextureKey,
        _readPlanForm: readPlanForm
    };

    if (typeof window !== 'undefined') {
        window.GAIP_NutritionProgramInputs = API;
    }
    if (typeof module !== 'undefined' && module.exports) {
        module.exports = API;
    }

    if (typeof console !== 'undefined' && console.log) {
        console.log('[NutritionInputs] v' + VERSION + ' loaded (GH-383 — shared programme input adapter)');
    }
})(typeof window !== 'undefined' ? window : (typeof globalThis !== 'undefined' ? globalThis : this));

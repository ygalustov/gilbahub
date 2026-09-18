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
 *   deriveTrafficIntensity()    GH-394 (D31 stage 3): decision D-10's rule on
 *                               the schedule Settings > Traffic & Wear now
 *                               persists in the site config as
 *                               config.traffic.schedule — matches/week > 3 ->
 *                               extreme, > 1 -> high, else moderate; an unsaved
 *                               or empty schedule -> moderate; sports turfType
 *                               only. The modifier scales the ANNUAL N once,
 *                               upstream, and never a nutrient.
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

    // GH-398: the two monthly-distribution defaults, taken from
    // nutrition-calendar.js collectFromState()'s own `|| 50` and
    // `|| 'gp_weighted'` so an unmigrated caller lands where the Plan page has
    // always landed.
    const DEFAULT_MAX_N_PER_MONTH = 50;
    const DEFAULT_DISTRIBUTION_MODE = 'gp_weighted';

    /**
     * deriveTrafficIntensity(schedule, turfType)  — GH-394 (D31 stage 3)
     *
     * The traffic modifier stopped being inert here. Until GH-394 the Settings
     * > Traffic & Wear schedule reached only
     * localStorage['gilba_traffic_state_<siteId>'], so nothing reached the
     * server, the export or a second device and every site resolved
     * moderate / 1.0. GH-394 persists the schedule in the site's gaip config
     * as `config.traffic.schedule` and derives the level from it HERE, once,
     * so the Plan page and the Word export can never derive it differently —
     * precisely the input-divergence class this adapter exists to close.
     *
     * Decision D-10, as settled by the user:
     *   matches/week > 3 -> extreme, > 1 -> high, otherwise moderate.
     *   An empty or unsaved schedule -> moderate, so no existing site moves
     *   until someone actually saves a schedule.
     *   Sports turf only (decision D-3): `turf.turfType === 'sports'`. Golf,
     *   lawns and anything else are 1.0 whatever the schedule says, and an
     *   absent or unrecognised turf type counts as not-sports. This is
     *   `turfType` (golf / sports / lawns), NOT `surfaceType` (greens /
     *   fairways / tees / sports) — GH-387 was caused by exactly that mix-up.
     *
     * `low` (0.85) is in the table but unreachable by this rule: the rule has
     * no rung below `moderate`, and "nothing entered" must stay neutral rather
     * than cut a site's nitrogen. The table keeps the level so a later rule can
     * use it without a second table appearing somewhere else.
     *
     * NEVER derive from a form placeholder or from the legacy DOM input
     * `.gaip-matches-week` (`legacy-hub-markup.blade.php` hard-codes
     * `value="2"`, which under the `> 1` rule would silently make every sports
     * site `high`). The only input is the SAVED schedule: settings-init.js's
     * getNum() writes `null` for an empty field, so an untouched form persists
     * nulls and lands on 'no-schedule' here.
     */
    function deriveTrafficIntensity(schedule, turfType) {
        if (turfType !== 'sports') {
            return { level: 'moderate', modifier: TRAFFIC_MODIFIERS.moderate, source: 'not-sports', matchesPerWeek: null };
        }
        const raw = (schedule && schedule.matchesPerWeek !== undefined) ? schedule.matchesPerWeek : null;
        const matches = (raw === null || raw === undefined || raw === '') ? NaN : parseFloat(raw);
        if (!isFinite(matches)) {
            return { level: 'moderate', modifier: TRAFFIC_MODIFIERS.moderate, source: 'no-schedule', matchesPerWeek: null };
        }
        let level = 'moderate';
        if (matches > 3) level = 'extreme';
        else if (matches > 1) level = 'high';
        return { level: level, modifier: TRAFFIC_MODIFIERS[level], source: 'schedule', matchesPerWeek: matches };
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
    // Soil texture — ONE chain, two links: the site's own column, then the
    // account's setting. Nothing else.
    //
    // GH-482, closing question 10.8(17) with the owner's decision: the sample's
    // recorded snapshot is NOT in this chain, at any position. Her reason is
    // that the mark on a sample can be wrong — the methodology or the texture
    // may have been changed in Settings after the row was written — and what a
    // report interprets against is what the settings say now. The same reason
    // that ruled out the snapshot rules out the other two rungs that used to
    // stand below it: a texture off the sample's own soil object, and a bucket
    // guessed from the construction type ('sand_profile' read as 'sand'),
    // which was a substitution rather than a setting anybody made.
    //
    // What replaced the page-wide read: `sites.soil_texture_override` has
    // existed since the initial schema and the PATCH endpoint accepts it, but
    // `/api/sites` never returned it, so there was nothing to read by id and
    // the resolver took the page's own copy — the texture of whatever site the
    // page was rendered for. The column is returned now, with the account's
    // setting beside it as the second link, which is the rule the server
    // applies to itself (`$site->soil_texture_override ?: $site->account->soil_texture`).
    // ==========================================================================
    function resolveSoilTexture(opts) {
        opts = opts || {};
        if (opts.siteTextureOverride) return { value: opts.siteTextureOverride, source: 'site-override' };
        if (opts.accountTexture) return { value: opts.accountTexture, source: 'account' };
        return { value: null, source: 'unresolved' };
    }

    /**
     * The texture settings of a site, read from the row that owns them: the
     * site's own column and the account's setting, the two links the server
     * itself uses. GH-482 (was GH-414's read of the page's copy, which could
     * only answer for the page's own site).
     */
    function siteTextureSettingFor(siteId) {
        const none = { siteTextureOverride: null, accountTexture: null };
        if (!siteId) return none;
        const w = _win();
        const SC = w.GAIP_SiteConfig;
        const row = (SC && typeof SC.getSite === 'function') ? SC.getSite(siteId) : null;
        if (row) {
            return {
                siteTextureOverride: row.soil_texture_override || null,
                accountTexture: row.account_soil_texture || null
            };
        }
        // The Plan page does not load the site store, so there is no row to
        // read there. What it does have is the SAME two links, already walked
        // by the server for that page's own site: PageController.php:66 renders
        // `$site->soil_texture_override ?: $site->account->soil_texture` into
        // GAIP_HUB_CONFIG.soilTexture. Reading it is reading the same owner
        // through a different transport — and only ever for the site the page
        // was rendered for, because that is the only site it describes.
        const hub = w.GAIP_HUB_CONFIG || {};
        if (!hub.soilTexture) return none;
        if (hub.activeSiteId && String(hub.activeSiteId) !== String(siteId)) return none;
        return { siteTextureOverride: hub.soilTexture, accountTexture: null };
    }

    function aaTextureKey(soilTexture) {
        return String(soilTexture || '').toLowerCase().indexOf('sand') !== -1 ? 'sands' : 'others';
    }

    // ==========================================================================
    // Zone matching — GH-414.
    //
    // The owner's rule: a tissue result belongs to the green its soil sample
    // came from, and to no other green. The Word export has applied that rule
    // since b35fix_greentissue, through zone-key.js and a local buildZoneMap();
    // the Plan page applied no rule at all — it took the site's single latest
    // tissue analysis (plan.blade.php's GH-366 bridge, from PageController's
    // `$tissuePercent`) and handed it to every soil sample on the site. Live on
    // Russley that meant all three greens' programmes were built from Green 18's
    // tissue, and on Burns all twenty-six from Green 15's.
    //
    // Same key derivation on both surfaces (GaipZoneKey.derive: lower-cased,
    // dates/months/seasons stripped), same "latest wins" tie-break, one
    // implementation. There is deliberately NO "the site has only one tissue
    // sample, use it" fallback: that is precisely what would pair Green 1 with
    // 18th Green, which the rule forbids.
    // ==========================================================================

    function zoneKeyFor(sampleLike) {
        const w = _win();
        const ZK = w.GaipZoneKey ||
            (typeof global !== 'undefined' && global.GaipZoneKey) || null;
        if (ZK && typeof ZK.derive === 'function') return ZK.derive(sampleLike);
        console.warn('[NutritionInputs] GH-414: zone-key.js is not loaded — zone matching ' +
            'cannot run, so no tissue sample will be paired with a soil sample on this page.');
        return null;
    }

    /**
     * buildZoneMap([{ id, label, date }]) -> { zoneKey: entry }, latest date wins.
     * The shape word-export-combined.js's own buildZoneMap() produced, extracted
     * so the Plan page runs the same selection rather than a second copy of it.
     */
    function buildZoneMap(samples) {
        const map = {};
        (samples || []).forEach(function (s) {
            if (!s) return;
            const key = zoneKeyFor(s);
            if (!key) return;
            const date = s.date || '';
            if (!map[key] || date > map[key].date) {
                map[key] = { id: s.id, label: s.label, date: date, sample: s.sample !== undefined ? s.sample : s };
            }
        });
        return map;
    }

    /**
     * The one sample in `samples` that belongs to the same zone as `zoneLabel`
     * (latest, when a zone has several), or null when the zone has none.
     */
    function matchSampleToZone(samples, zoneLabel) {
        if (!zoneLabel) return null;
        const wanted = zoneKeyFor(zoneLabel);
        if (!wanted) return null;
        const map = buildZoneMap(samples);
        return map[wanted] || null;
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
        // GH-469: the server's injected config, used only when it says it is
        // about the site being asked about.
        //
        // What stood here compared the asked-for id with the page's LIVE
        // pointer — GAIP_SampleManager's, then GAIP_HUB_CONFIG.activeSiteId,
        // which is rewritten in place by the setup wizard and by Account. The
        // object itself is written once, when the page is rendered, and never
        // changes. So the comparison could be true while the object described
        // a third site: the pointer had moved to the site being asked about,
        // and the config was still the one the page was drawn with.
        //
        // The object now carries its own stamp, the same idea as a run stamp
        // in layer II, and the comment "this is a COMPARISON, not a
        // substitution" is true.
        if (siteId && w.GAIP_SITE_CONFIG && siteId === w.GAIP_SITE_CONFIG_SITE_ID) {
            return w.GAIP_SITE_CONFIG;
        }
        // GH-468: the `!siteId` arm is gone. It answered for the page's site
        // whenever the caller had not named one — the substitution this
        // refinement removes, one level down from the two resolvers.
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
        const maxEl = d.getElementById('plan-nut-max-n');
        const distEl = d.getElementById('plan-nut-distribution');
        const n = parseFloat(nEl.value);
        // GH-398: the monthly cap and the distribution mode join the contract,
        // because the Word export's Monthly N Distribution now runs both and
        // must run the SAME two the Plan page did.
        const maxN = maxEl ? parseFloat(maxEl.value) : NaN;
        return {
            annualN: (isFinite(n) && n > 0) ? n : null,
            clippingManagement: (clipEl && clipEl.value) ? clipEl.value : null,
            maxNPerMonth: (isFinite(maxN) && maxN > 0) ? maxN : null,
            distributionMode: (distEl && distEl.value) ? distEl.value : null
        };
    }

    /**
     * GH-471 (PLAN-GH439 section 10.6, eleventh refinement) — where every
     * resolved field is read from, as a path in a named store object.
     *
     * This table IS the document about what comes from where. Each entry is
     * `[source, path]`; the resolver reads by the path and writes the source
     * itself, so a source cannot be claimed that the read does not support.
     *
     * `notInStore` marks a path no live site actually has — checked against
     * tests/fixtures/store-shapes.json, which is the union of every site this
     * login carries. Three of them are recorded rather than removed, because
     * removing a read changes what a site that grew the key would get:
     *
     *   timezone  — no config carries it; the server derives it (section 2.5)
     *   areaHa    — lives in the /hub DOM only; question 2 of section 10.8
     *   warmBase  — zero of twelve configs have it, measured in the database
     *
     * The keys this table stopped reading are the other half of the same
     * measurement: `turf.grassSpecies`, `turf.percentC3` and
     * `cfg.locationName` exist on no site at all, and each was the right-hand
     * side of an `||` that made the read agree with any store.
     */
    const FIELD_PATHS = Object.freeze({
        // GH-473: the facts about the SITE come from the site row, which owns
        // them. All three write paths reach those columns — site creation,
        // PATCH /api/sites/{id}, and the mirror out of a config patch — while
        // the copy in `config.location` is reached by one. A site created
        // through store() has the column filled and the config empty by
        // construction, so a resolver reading the copy is a write path behind
        // on every new site; that is the state Russley was found in.
        siteName: ['site-row', 'name'],
        locationName: ['site-row', 'location_name'],
        lat: ['site-row', 'latitude'],
        lon: ['site-row', 'longitude'],
        timezone: ['site-row', 'timezone'],
        // GH-474: no column exists for it, so the config owns it — which is
        // not an exception to the rule but the other half of it. A field with
        // no column has one owner too; it simply is not a column.
        // Not in the config of any site today — nobody has saved one — but
        // the Settings form sends it and the config is its owner, so the read
        // stays and the absence is recorded rather than mistaken for a
        // decision. Checked in the owner's own shape, which is the only shape
        // it could be in.
        elevation: ['site-config', 'location.elevation', 'notInStore'],
        // The zone area is in no store at all: not on the site row, not in the
        // config, not on a sample — checked against every shape recorded in
        // store-shapes.json, not against one of them. It lives in the /hub DOM
        // and where it belongs by id is question 2 of section 10.8.
        areaHa: ['site-row', 'area_ha', 'notInStore'],
        species: ['site-config', 'turf.species'],
        turfType: ['site-config', 'turf.turfType'],
        subCategory: ['site-config', 'turf.subCategory'],
        variety: ['site-config', 'turf.variety'],
        construction: ['site-config', 'turf.construction'],
        hoc: ['site-config', 'turf.hoc'],
        percentC3: ['site-config', 'turf.c3Cover'],
        // Likewise in no store: zero of twelve configs carry it, and it is not
        // a column either. Kept as a read so that a site which grows the key
        // is answered for, and recorded here so that nobody mistakes the
        // silence for a decision.
        warmBase: ['site-config', 'turf.warmBase', 'notInStore'],
        coolOverseed: ['site-config', 'turf.coolOverseed'],
        overseedSpecies: ['site-config', 'turf.overseedSpecies'],
        overseedVariety: ['site-config', 'turf.overseedVariety'],
        // A lookup of the two above in the variety table, not a key of its own.
        overseedVarietyDisplay: ['site-config', 'turf.overseedVariety', 'derived'],
        summerIntent: ['site-config', 'turf.summerIntent'],
        soilSample: ['sample', 'soil'],
        tissueSample: ['sample', 'tissue'],
        waterSample: ['sample', 'water']
    });

    /**
     * GH-468 — the site a resolver answers for is always named by its caller.
     *
     * Both resolvers used to end `opts.siteId || getActiveSiteId()`. The
     * fallback is not a convenience: `getActiveSiteId()` answers for the site
     * the PAGE currently points at, and during a combined export that is a
     * different site from the one whose sample is being printed on every
     * iteration but the last. Measured on the stand: with the page pointing at
     * a Christchurch site while a Test5 sample was exported, the document said
     * "Species: Couch" in seven places and carried no nutrition programme table
     * at all. The refusal added in GH-467 does not catch this — inputs DID
     * arrive, they were simply another site's.
     *
     * A throw rather than a null, because every caller of these two has a site
     * id in hand: the combined loop has `entry.siteId`, and the single export
     * reads the active site deliberately, at the one point where the page's
     * site IS the document's site.
     */
    function _requiredSiteId(opts, fn) {
        const siteId = opts && opts.siteId;
        if (siteId === undefined || siteId === null || siteId === '') {
            throw new Error('[NutritionInputs] ' + fn + ': siteId is required. ' +
                'Resolving by the page\'s active site would answer for whichever site the page ' +
                'happens to point at, which is not the site of the sample being printed.');
        }
        return siteId;
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

        const siteId = _requiredSiteId(opts, 'resolveSiteProgramInputs');
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
        // GH-521: one link, one owner. Three went:
        //
        //   `sample.methodology`      — the caller's own object, which is how a
        //                               report for one site was built on another
        //                               site's answer;
        //   `GAIP_HUB_CONFIG.turfMethodology` — what the SERVER injected for
        //                               whichever site the PAGE is standing on,
        //                               not the site being asked about;
        //   `|| 'mlsn'`               — a methodology for a site that has none.
        //
        // What remains is `turf.methodology`, and `turf` comes from
        // getSiteConfig(siteId) — the config of the site asked about, by id.
        const rawMethodology = turf.methodology || null;
        sources.methodology = turf.methodology ? 'site-config' : 'empty';
        const methodology = normalizeMethodology(rawMethodology) || null;

        // ── texture / CEC / pH ──
        const tex = resolveSoilTexture(siteTextureSettingFor(siteId));
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

        // ── monthly distribution: the cap and the mode (GH-398, D31 stage 4) ──
        // Both used to be Plan-page-only DOM reads, which is why the Word
        // export's monthly table ran an uncapped, always-GP-weighted split.
        // Same precedence as every other field: this page's live form, then
        // what the site saved, then the default the Plan form itself shows.
        // `maxNPerMonth` sits at the top level of the gaip config, written by
        // nutrition-calendar.js alongside the programme; the mode is stamped
        // on the programme's own meta.
        let maxNPerMonth = null;
        if (planForm && planForm.maxNPerMonth > 0) {
            maxNPerMonth = planForm.maxNPerMonth;
            sources.maxNPerMonth = 'plan';
        } else if (cfg.maxNPerMonth > 0) {
            maxNPerMonth = parseFloat(cfg.maxNPerMonth);
            sources.maxNPerMonth = 'site-config';
        } else {
            // nutrition-calendar.js collectFromState()'s own `|| 50` — the
            // value a Plan page with an empty "Max N per application" field
            // has always computed with.
            maxNPerMonth = DEFAULT_MAX_N_PER_MONTH;
            sources.maxNPerMonth = 'default';
        }

        let distributionMode = null;
        if (planForm && planForm.distributionMode) {
            distributionMode = planForm.distributionMode;
            sources.distributionMode = 'plan';
        } else if (persistedMeta && persistedMeta.distribution) {
            distributionMode = persistedMeta.distribution;
            sources.distributionMode = 'plan-persisted';
        } else {
            distributionMode = DEFAULT_DISTRIBUTION_MODE;
            sources.distributionMode = 'default';
        }

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
            maxNPerMonth: maxNPerMonth,
            distributionMode: distributionMode,
            ranges: resolved.ranges,
            rangeSources: resolved.sources,
            certificateCode: resolved.certificateCode,
            sources: sources
        };
    }

    // ==========================================================================
    // GH-461 — every input a document needs about a site, resolved BY ID
    // ==========================================================================
    //
    // Section 10 of PLAN-GH439: a document about site X was assembled out of
    // the page's state, and the page's state carries no mark saying which site
    // it describes. Coordinates, species, variety, overseed, the turf type —
    // all of them exist independently of any page, keyed by the site id, and
    // all of them were being read off whatever the browser had last painted.
    // The owner's report printed one site's programme on another's climate;
    // the same document printed "Species: Couch" three paragraphs from its own
    // sample header reading "Perennial Ryegrass".
    //
    // This is the single border for those inputs. The export BUILDS its site
    // and turf sections from what this returns; it does not read them
    // anywhere else and then patch them here. Patching was tried and it is the
    // wrong shape twice over: the page's value arrives first and any field not
    // in the patch list stays leaked, and a guard like `if (!data.turf.species)`
    // is false exactly during a leak, because the field is not empty — it is
    // full of the other site's answer.
    //
    // What is NOT here: results of a calculation (mlsnResults, climateMetrics,
    // tissueResults and the rest). Those do not exist by id — they exist only
    // as the output of a run — and they need a run stamp instead, which is a
    // separate layer.
    //
    // Absent is `null` with `sources.<field> === 'unresolved'`. No default
    // species, no default variety, no 'generic' standing in for an answer: a
    // name printed by default is indistinguishable from a name that leaked.
    function resolveExportInputs(opts) {
        opts = opts || {};
        const w = _win();
        const siteId = _requiredSiteId(opts, 'resolveExportInputs');
        const cfg = getSiteConfig(siteId);
        const turf = (cfg && cfg.turf) || {};
        const sources = {};
        const provenance = {};

        // GH-471 (eleventh refinement): the source of a field is WORKED OUT
        // from the read, never written beside it.
        //
        // `take(field, value, 'site-config')` let the author declare where a
        // value came from, and nothing checked the claim. It cost a client a
        // printed line: `take('locationName', cfg.locationName, 'site-config')`
        // reads a key no site config has — the name lives at `location.name` —
        // so the map recorded a documented key with the legal value
        // 'unresolved', the completeness test stayed green, and the document
        // printed "Location: -35.2285452, 149.0022925" instead of the place.
        //
        // Now each read goes through a path in one named object. The source is
        // the object the path was read from; 'unresolved' means the path was
        // absent or the value empty, and nothing else can be written there.
        const readPath = (obj, dotted) => {
            let cur = obj;
            const parts = String(dotted).split('.');
            for (let i = 0; i < parts.length; i++) {
                if (cur === null || cur === undefined || typeof cur !== 'object') return undefined;
                if (!Object.prototype.hasOwnProperty.call(cur, parts[i])) return undefined;
                cur = cur[parts[i]];
            }
            return cur;
        };
        const record = (field, value, from) => {
            const empty = value === undefined || value === null || value === '';
            sources[field] = empty ? 'unresolved' : from;
            return empty ? null : value;
        };
        // Each reader answers for its own store, and refuses a field the table
        // says belongs to another one: the table and the read cannot disagree
        // about where a value came from, which is the whole point of the
        // table. GH-471.
        // The site row, chosen by the id this call was given.
        let siteRow = null;
        try {
            const SC = w.GAIP_SiteConfig;
            siteRow = (SC && typeof SC.getSite === 'function') ? SC.getSite(siteId) : null;
        } catch (e) { siteRow = null; }

        // GH-473: a read operation takes an IDENTIFIER and picks the record
        // itself, then says which record it read — `provenance[field].recordKey`.
        //
        // `fromSiteList(field, row)` took the row as an argument, so it proved
        // which STORE a value came from and nothing about which RECORD: hand
        // it another site's row and every check still passed. Choosing the
        // record inside the operation makes that mutation impossible to write,
        // and the recordKey makes a wrong choice inside the operation visible.
        const readerFor = (field, source, id, obj) => {
            const entry = FIELD_PATHS[field];
            if (!entry) throw new Error('[NutritionInputs] no path recorded for ' + field);
            if (entry[0] !== source) {
                throw new Error('[NutritionInputs] ' + field + ' is recorded as coming from ' +
                    entry[0] + ', but is being read from ' + source);
            }
            const value = record(field, readPath(obj, entry[1]), source);
            provenance[field] = {
                source: sources[field],
                path: entry[1],
                recordKey: obj ? (obj.id != null ? obj.id : id) : null
            };
            return value;
        };
        const fromConfig = (field) => readerFor(field, 'site-config', siteId, cfg);
        const fromSite = (field) => readerFor(field, 'site-row', siteId, siteRow);


        const latRaw = fromSite('lat');
        const lonRaw = fromSite('lon');
        const lat = parseFloat(latRaw);
        const lon = parseFloat(lonRaw);
        const hasCoords = isFinite(lat) && isFinite(lon);

        let climateNormals = null;
        let climateReason = 'no-coordinates';
        if (hasCoords) {
            const svc = w.GilbaClimateNormalsService;
            if (svc && typeof svc.getResolvedSync === 'function') {
                const resolved = svc.getResolvedSync(lat, lon);
                climateNormals = resolved || null;
                climateReason = resolved ? null
                    : ((typeof svc.getReason === 'function') ? svc.getReason(lat, lon) : 'unresolved');
            } else {
                climateReason = 'service-unavailable';
            }
        }

        // Samples by id, out of the manager's own per-site stores — not out of
        // whichever sample the page currently has loaded in its form.
        const samples = { soil: null, tissue: null, water: null };
        try {
            const SM = w.GAIP_SampleManager;
            const all = (SM && typeof SM.getAllSamples === 'function') ? SM.getAllSamples() : null;
            const store = (all && all.allSites && all.allSites[siteId]) || null;
            const active = (all && all.allActive && all.allActive[siteId]) || {};
            ['soil', 'tissue', 'water'].forEach((kind) => {
                const wanted = opts[kind + 'SampleId'] || active[kind] || null;
                const bucket = (store && store[kind]) || null;
                if (!bucket || !wanted) return;
                samples[kind] = Array.isArray(bucket)
                    ? (bucket.filter((x) => x && (x.id === wanted || x.clientId === wanted))[0] || null)
                    : (bucket[wanted] || null);
            });
        } catch (e) { /* leaves nulls, reported through sources below */ }
        // GH-474: a sample records WHICH sample, like every other read. The
        // three lines that stood here wrote only the store's name, so nothing
        // said which record answered — and the check that was meant to say it
        // compared the key with the id of the sample the resolver had just
        // chosen, out of a basket holding one.
        ['soil', 'tissue', 'water'].forEach((kind) => {
            const field = kind + 'Sample';
            sources[field] = samples[kind] ? 'sample' : 'unresolved';
            provenance[field] = {
                source: sources[field],
                path: FIELD_PATHS[field][1],
                recordKey: samples[kind] ? samples[kind].id : null
            };
        });

        let program = null;
        try {
            program = resolveSiteProgramInputs({
                siteId: siteId,
                siteConfig: cfg,
                // GH-471: the one key the live store has. `values || payload
                // || samples.soil` agreed with any store, which is what made a
                // stub written from memory undetectable.
                soil: (samples.soil && samples.soil.values) || null,
                sample: {},
                // GH-470: never the Plan page's live form. This is the EXPORT's
                // border; the export's own page has no such form, and a hidden
                // legacy input carrying the same class is the cross-site read
                // this whole section exists to remove. The Plan page resolves
                // through resolveSiteProgramInputs directly and keeps its form.
                planForm: null
            });
        } catch (e) {
            program = null;
        }

        const speciesRaw = fromConfig('species');

        return Object.freeze({
            site: Object.freeze({
                id: siteId || null,
                name: fromSite('siteName'),
                location: Object.freeze({
                    // GH-471: `location.name`, which is where every site's name
                    // for its place actually is. What to print when a site has
                    // none is question 10 of section 10.8 and unchanged here.
                    name: fromSite('locationName'),
                    // GH-471: read — and therefore recorded — in both cases.
                    // The provenance of these two used to be written only when
                    // the site had NO coordinates, so a site that had them had
                    // no entry in the map at all: a field whose source is
                    // recorded sometimes is a field whose source is unchecked.
                    lat: hasCoords ? lat : latRaw,
                    lon: hasCoords ? lon : lonRaw
                }),
                timezone: fromSite('timezone'),
                elevation: fromConfig('elevation'),
                // Zone area lives only in the /hub DOM today; where it belongs
                // by id is question 2 of section 10.8 and is the owner's to
                // answer. Until then it is absent, and the document takes its
                // existing "missing area" branch rather than a number off a
                // form belonging to another site.
                areaHa: fromSite('areaHa')
            }),
            turf: Object.freeze({
                type: fromConfig('turfType'),
                subCategory: fromConfig('subCategory'),
                species: speciesRaw,
                speciesKey: speciesRaw ? resolveSpeciesKey(speciesRaw) : null,
                speciesDisplay: speciesRaw ? resolveSpeciesDisplay(speciesRaw) : null,
                variety: fromConfig('variety'),
                construction: fromConfig('construction'),
                hoc: fromConfig('hoc'),
                percentC3: fromConfig('percentC3'),
                warmBase: fromConfig('warmBase'),
                coolOverseed: fromConfig('coolOverseed'),
                overseedSpecies: fromConfig('overseedSpecies'),
                overseedVariety: fromConfig('overseedVariety'),
                // GH-464: the label printed beside the key. A pure lookup in
                // the variety table the page already carries, falling back to
                // the key itself when the table has no name for it — which is
                // question 9 of section 10.8 and the owner's to settle. It
                // lives here rather than in the export because the export read
                // it off a DOM select and off GAIP_CLIMATE_V2_RESULT, both of
                // which describe whichever site the page last painted.
                overseedVarietyDisplay: record('overseedVarietyDisplay',
                    _varietyDisplay(readPath(cfg, FIELD_PATHS.overseedSpecies[1]),
                        readPath(cfg, FIELD_PATHS.overseedVariety[1])), 'site-config'),
                summerIntent: fromConfig('summerIntent'),
                // Derived, never a source of its own: the curve follows the
                // species, and two independent inputs is how a report came to
                // print the right grass on the wrong curve.
                isC4: speciesRaw ? _isC4FromSpecies(speciesRaw) : null
            }),
            program: program,
            samples: Object.freeze(samples),
            climateNormals: climateNormals,
            climateReason: climateReason,
            sources: Object.freeze(sources),
            provenance: Object.freeze(provenance)
        });
    }

    /** The variety table's own name for a key, or the key when it has none. */
    function _varietyDisplay(species, variety) {
        if (!variety) return null;
        const w = _win();
        try {
            const table = w.GAIP_VarietyTraits;
            if (table && typeof table.getVarietyTraits === 'function') {
                const traits = table.getVarietyTraits(species || null, variety);
                if (traits && (traits.displayName || traits.name)) return traits.displayName || traits.name;
            }
        } catch (e) { /* the key is the answer below */ }
        return variety;
    }

    /** The C3/C4 answer of whichever engine is loaded — never a local table. */
    function _isC4FromSpecies(species) {
        const w = _win();
        try {
            if (w.NutritionCalendar && typeof w.NutritionCalendar.isC4Species === 'function') {
                return !!w.NutritionCalendar.isC4Species(w.NutritionCalendar.normalizeSpecies(species));
            }
            if (w.GilbaNutritionCalendar && typeof w.GilbaNutritionCalendar.isC4Species === 'function') {
                return !!w.GilbaNutritionCalendar.isC4Species(
                    w.GilbaNutritionCalendar.normalizeSpecies(species));
            }
            if (w.SpeciesController && typeof w.SpeciesController.isC4Species === 'function') {
                return !!w.SpeciesController.isC4Species(species);
            }
        } catch (e) { /* fall through */ }
        return null;
    }

    const API = {
        VERSION: VERSION,
        TRAFFIC_MODIFIERS: TRAFFIC_MODIFIERS,
        DEFAULT_MAX_N_PER_MONTH: DEFAULT_MAX_N_PER_MONTH,
        DEFAULT_DISTRIBUTION_MODE: DEFAULT_DISTRIBUTION_MODE,
        resolveSiteProgramInputs: resolveSiteProgramInputs,
        resolveExportInputs: resolveExportInputs,
        resolveSufficiencyRanges: resolveSufficiencyRanges,
        deriveTrafficIntensity: deriveTrafficIntensity,
        resolveAnnualN: resolveAnnualN,
        validateSampleInputs: validateSampleInputs,
        getSiteConfig: getSiteConfig,
        getActiveSiteId: getActiveSiteId,
        FIELD_PATHS: FIELD_PATHS,
        normalizeMethodology: normalizeMethodology,
        resolveSpeciesKey: resolveSpeciesKey,
        resolveSpeciesDisplay: resolveSpeciesDisplay,
        resolveSoilTexture: resolveSoilTexture,
        siteTextureSettingFor: siteTextureSettingFor,
        zoneKeyFor: zoneKeyFor,
        buildZoneMap: buildZoneMap,
        matchSampleToZone: matchSampleToZone,
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

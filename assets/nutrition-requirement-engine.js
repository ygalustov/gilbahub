/**
 * NUTRITION REQUIREMENT ENGINE - PURE v1.2.0
 *
 * Pure-function nutrition requirement engine.
 * f({ soil, turf, climate, overseedConfig }) → { perSample, facility }
 *
 * Extracted from nutrition-summary-integration.js v1.1.3 (b35fix302).
 * All DOM reads and window globals REMOVED.
 * State resolution (overseed detection, soil extraction) stays in integration layer.
 *
 * Architecture:
 *   perSample: P/K/S/Ca/Mg annual requirements driven by THIS sample's soil chemistry.
 *              Different per green/sportsground. Supers treat these individually.
 *   facility:  Annual N budget + monthly N distribution driven by turf config + climate.
 *              Same across all samples on a facility. Supers treat N programme as one.
 *
 * Dependencies:
 *   - GilbaGrowthPotentialEngine (assets/growth-potential-engine.js) — canonical GP.
 *     Wired in Task 6. Must be enqueued before this engine (see PHP enqueue order).
 *
 * References:
 *   - Woods, Stowell & Gelernter (2016) MLSN guidelines, PACE Turf
 *   - Gelernter & Stowell (2005) PACE Turf Growth Potential Model (via GP engine)
 *   - Carrow, Waddington & Rieke (2001) Turfgrass Soil Fertility & Chemical Problems
 *   - Christians, Patton & Law (2017) Fundamentals of Turfgrass Management (5th ed.)
 *
 * @provides NutritionRequirementEngine_Pure.compute({ soil, turf, climate, overseedConfig })
 */

(function(global) {
    'use strict';

    const CONFIG = {
        version: '1.2.0',
        debug: false
    };

    // MLSN minimum soil level thresholds (ppm Mehlich-3 / ammonium acetate).
    // Source: Woods, Stowell & Gelernter (2016), PACE Turf MLSN guidelines.
    const MLSN_THRESHOLDS = { P: 21, K: 37, Ca: 331, Mg: 47, S: 7 };
    const TARGET_MULTIPLIER = 1.5;

    // pH-adjusted P thresholds — Gilba augmentation accounting for reduced P
    // availability at pH extremes. Uses ≤ semantics (inclusive upper bound on
    // each band, first match wins). A divergence exists in hub-tissue-v3.js
    // which uses strict inequalities; harmonisation is a separate build.
    // Preserving ≤ semantics here matches nutrition-summary-integration.js
    // v1.1.3, the source being extracted.
    const P_PH_ADJUSTMENTS = [
        { maxPh: 5.5, threshold: 35 },
        { maxPh: 6.0, threshold: 28 },
        { maxPh: 7.5, threshold: 21 },
        { maxPh: 8.0, threshold: 32 },
        { maxPh: 99,  threshold: 40 }
    ];

    function getMLSNThreshold(nutrient, ph) {
        if (nutrient === 'P' && ph) {
            for (const adj of P_PH_ADJUSTMENTS) {
                if (ph <= adj.maxPh) return adj.threshold;
            }
        }
        return MLSN_THRESHOLDS[nutrient] || 0;
    }

    function getMLSNTarget(nutrient, ph) {
        return getMLSNThreshold(nutrient, ph) * TARGET_MULTIPLIER;
    }

    // Removal rates: kg/ha/yr for each macronutrient by species.
    // Source: nutrition-summary-integration.js v1.1.3 NUTRITION_CONFIG.removalRates,
    // which was derived from Carrow, Waddington & Rieke (2001) Turfgrass Soil
    // Fertility & Chemical Problems and Christians, Patton & Law (2017)
    // Fundamentals of Turfgrass Management (5th ed.) — both cited in the
    // engine header. Duplicate 'couch' key in source (lines 87–88) dropped
    // here; values were identical so no behaviour change.
    const REMOVAL_RATES = {
        bentgrass:         { N: 150, P: 15, K: 80,  Ca: 25, Mg: 12, S: 8 },
        perennialRyegrass: { N: 180, P: 18, K: 100, Ca: 30, Mg: 15, S: 10 },
        kentuckyBluegrass: { N: 160, P: 16, K: 90,  Ca: 28, Mg: 14, S: 9 },
        fineFescue:        { N: 100, P: 10, K: 60,  Ca: 20, Mg: 10, S: 6 },
        tallFescue:        { N: 140, P: 14, K: 80,  Ca: 25, Mg: 12, S: 8 },
        couch:             { N: 200, P: 20, K: 120, Ca: 35, Mg: 18, S: 12 },
        zoysiagrass:       { N: 120, P: 12, K: 70,  Ca: 22, Mg: 11, S: 7 },
        kikuyu:            { N: 250, P: 25, K: 140, Ca: 40, Mg: 20, S: 14 },
        buffalo:           { N: 80,  P: 8,  K: 50,  Ca: 15, Mg: 8,  S: 5 },
        seashorePaspalum:  { N: 160, P: 16, K: 90,  Ca: 28, Mg: 14, S: 9 },
        mixedCool:         { N: 160, P: 16, K: 85,  Ca: 26, Mg: 13, S: 8 },
        mixedWarm:         { N: 180, P: 18, K: 100, Ca: 32, Mg: 16, S: 10 }
    };

    // Species alias map — maps user-supplied species strings (after normalisation
    // to lowercase, whitespace/dash/underscore stripped, trailing 'grass' stripped)
    // to canonical REMOVAL_RATES keys.
    //
    // Latent-bug fixes vs nutrition-summary-integration.js v1.1.3:
    //   - 'zoysia'   was mapped to 'zoysia'           (no such key → fell to mixedCool)
    //               now mapped to 'zoysiagrass'       (correct key)
    //   - 'paspalum' was mapped to 'seashore_paspalum' (no such key → fell to mixedCool)
    //               now mapped to 'seashorePaspalum'  (correct key)
    // Behaviour change: zoysia and seashore paspalum sites now receive species-
    // correct removal rates instead of cool-season defaults. Self-identity
    // aliases added for robustness (bentgrass, kikuyu, buffalo, etc.).
    //
    // b35fix302b Task 11 additions: production code stores species as compact
    // CamelCase strings (browntopBent, colonialBentgrass, chewingsFescue,
    // hardFescue, sheepFescue, slenderCreepingRedFescue, strongCreepingRedFescue,
    // tetraploidRyegrass, zoysiaJaponica, zoysiaMatrella, hybridcouch).
    // Without aliases these silently fall to mixedCool/mixedWarm defaults.
    // Alias each to the canonical REMOVAL_RATES key based on closest published
    // turf-removal-rate match. Sources: Carrow/Waddington/Rieke (2001),
    // Christians/Patton/Law (2017). Where no exact removal-rate study exists
    // (e.g. browntop bent vs creeping bent), alias to the closest related
    // species — flagged in comments where this is an approximation.
    const SPECIES_ALIASES = {
        'couch': 'couch', 'bermuda': 'couch', 'bermudagrass': 'couch', 'cynodon': 'couch',
        'hybridcouch': 'couch',  // Hybrid couch (e.g. Tifway, OZ-TUFF) — same removal rates as couch
        'bent': 'bentgrass', 'creepingbent': 'bentgrass', 'agrostis': 'bentgrass', 'bentgrass': 'bentgrass',
        'creepingbentgrass': 'bentgrass',
        'browntopbent': 'bentgrass',  // Browntop bent (Agrostis capillaris) — bentgrass family, similar removal
        'colonialbent': 'bentgrass', 'colonialbentgrass': 'bentgrass',  // Colonial bent (A. capillaris)
        'velvetbent': 'bentgrass', 'velvetbentgrass': 'bentgrass',  // Velvet bent (A. canina)
        'prg': 'perennialRyegrass', 'rye': 'perennialRyegrass', 'ryegrass': 'perennialRyegrass',
        'perennialrye': 'perennialRyegrass', 'perennialryegrass': 'perennialRyegrass',
        'tetraploidryegrass': 'perennialRyegrass', 'tetraploidrye': 'perennialRyegrass',  // Diploid/tetraploid same removal
        'kbg': 'kentuckyBluegrass', 'bluegrass': 'kentuckyBluegrass', 'poa': 'kentuckyBluegrass',
        'kentuckybluegrass': 'kentuckyBluegrass',
        'fescue': 'fineFescue', 'finefescue': 'fineFescue',
        'chewings': 'fineFescue', 'chewingsfescue': 'fineFescue',
        'hardfescue': 'fineFescue',  // Hard fescue (Festuca brevipila) — fine fescue group
        'sheepfescue': 'fineFescue',  // Sheep fescue (F. ovina) — fine fescue group
        'slendercreepingredfescue': 'fineFescue', 'slenderredfescue': 'fineFescue',
        'strongcreepingredfescue': 'fineFescue', 'strongredfescue': 'fineFescue',
        'redfescue': 'fineFescue', 'creepingredfescue': 'fineFescue',
        'tallfescue': 'tallFescue',
        'zoysia': 'zoysiagrass', 'zoysiagrass': 'zoysiagrass',
        'zoysiajaponica': 'zoysiagrass',  // Z. japonica — coarse-textured zoysia
        'zoysiamatrella': 'zoysiagrass',  // Z. matrella — fine-textured zoysia, same removal class
        'kikuyu': 'kikuyu', 'kikuyugrass': 'kikuyu',
        'buffalo': 'buffalo',
        'paspalum': 'seashorePaspalum', 'seashore': 'seashorePaspalum', 'seashorepaspalum': 'seashorePaspalum'
    };

    function isC4Species(species) {
        if (!species) return false;
        const s = String(species).toLowerCase();
        return s.includes('couch') || s.includes('bermuda') ||
               s.includes('kikuyu') || s.includes('buffalo') ||
               s.includes('zoysia') || s.includes('paspalum') ||
               s.includes('c4') || s.includes('warm');
    }

    function normalizeSpecies(species) {
        if (!species) return 'mixedCool';
        // b35fix303: strip parenthetical surface-type qualifiers like "(Greens)",
        // "(Tees)", "(Fairways)" etc. before alias matching. Without this,
        // production strings like "Creeping Bentgrass (Greens)" fall through
        // to mixedCool instead of bentgrass. Caught in production after b35fix302b.
        const s = String(species).toLowerCase()
            .replace(/\s*\([^)]*\)\s*/g, '')
            .replace(/[\s\-_]+/g, '')
            .replace(/grass$/, '');
        if (SPECIES_ALIASES[s]) return SPECIES_ALIASES[s];
        for (const key of Object.keys(REMOVAL_RATES)) {
            if (key.toLowerCase() === s) return key;
        }
        return isC4Species(species) ? 'mixedWarm' : 'mixedCool';
    }

    // GH-368: same plausibility band nutrition-calendar.js applies to a
    // tissue-derived ratio. Tissue macros can be entered in mg/kg as well as
    // %, and a mixed-unit sample yields a ratio orders of magnitude too large.
    const TISSUE_RATIO_BANDS = { P: { min: 0.03, max: 0.30 }, K: { min: 0.15, max: 1.50 } };

    /**
     * GH-369 follow-up (independent review) — resolve the tissue-ratio gate
     * ONCE per sample, using nutrition-calendar.js's own all-or-nothing
     * eligibility rule, not a separate per-nutrient check.
     *
     * Pre-fix, this engine decided P and K's eligibility INDEPENDENTLY of
     * each other (each nutrient checked only its own ratio against its own
     * band), while nutrition-calendar.js requires ALL of N/P/K present AND
     * BOTH P/N and K/N in-band before either ratio governs — a single
     * implausible reading (e.g. P entered in mg/kg) disables the WHOLE gate
     * there, not just P's half of it. That divergence is live-reachable: a
     * tissue sample with P/N implausible and K/N plausible would have this
     * engine report K as tissue-informed while nutrition-calendar.js (and
     * the Monthly Schedule it drives) fell back to the generic ratio for
     * the exact same site — the ANR table and the Monthly Schedule
     * disagreeing on whether tissue governs at all, in the same document,
     * which is precisely the UI-vs-export divergence class GH-362 exists to
     * close. Resolving eligibility once, by the same rule, makes the two
     * engines agree on WHETHER tissue governs (what ratio it produces was
     * already identical, per GH-368).
     *
     * Returns { eligible, pRatio, kRatio }. pRatio/kRatio are only
     * meaningful when eligible is true.
     */
    function resolveTissueGate(tissuePercent) {
        const tp = tissuePercent || {};
        const measured = typeof tp.N === 'number' && tp.N > 0 &&
                          typeof tp.P === 'number' && tp.P > 0 &&
                          typeof tp.K === 'number' && tp.K > 0;
        if (!measured) return { eligible: false, pRatio: null, kRatio: null };

        const pRatio = tp.P / tp.N;
        const kRatio = tp.K / tp.N;
        const pBand = TISSUE_RATIO_BANDS.P, kBand = TISSUE_RATIO_BANDS.K;
        const plausible = pRatio >= pBand.min && pRatio <= pBand.max &&
                           kRatio >= kBand.min && kRatio <= kBand.max;
        if (!plausible) {
            console.warn('[NutritionRequirementEngine] GH-369: tissue P/N=' + pRatio.toFixed(3) +
                ' K/N=' + kRatio.toFixed(3) + ' is outside the plausibility band (P ' + pBand.min + '-' +
                pBand.max + ', K ' + kBand.min + '-' + kBand.max + ') — most likely mixed units on the ' +
                'tissue sample. Using the generic ratio for both P and K, matching ' +
                'nutrition-calendar.js\'s all-or-nothing rule.');
        }
        return { eligible: plausible, pRatio: pRatio, kRatio: kRatio };
    }

    function getRemovalRate(species, nutrient, tissueGate) {
        const normalized = normalizeSpecies(species);
        const table = REMOVAL_RATES[normalized] || REMOVAL_RATES.mixedCool;
        const generic = table[nutrient] || REMOVAL_RATES.mixedCool[nutrient];

        // GH-368 (Hoxton audit D07a, second engine): REMOVAL_RATES encodes a
        // generic tissue composition -- perennialRyegrass P 18 / K 100 against
        // N 180 is P/N 0.10 and K/N 0.556, the same textbook assumption
        // nutrition-calendar.js's CONFIG.nutrientRatiosToN carries, and the
        // literal figures the audit quotes from E3 ("K req 100.0", "P 18.0").
        // GH-361 replaced that assumption with the site's own tissue analysis
        // in the calendar engine but not here, so this engine -- the one
        // feeding the Annual Nutrient Requirements table the client complained
        // about -- still answered with the generic figure, and the two engines
        // diverged further than before the fix. Same rule, same scope (P and K
        // only, per D07a); eligibility itself now comes from resolveTissueGate()
        // above so both engines agree on WHETHER tissue governs, not just what
        // ratio it produces.
        if ((nutrient === 'P' || nutrient === 'K') && tissueGate && tissueGate.eligible) {
            const ratio = (nutrient === 'P') ? tissueGate.pRatio : tissueGate.kRatio;
            // Scale against this table's own N basis, exactly as the
            // calendar scales against the user's annual N target.
            return { value: Math.round(table.N * ratio * 10) / 10, tissueInformed: true };
        }

        return { value: generic, tissueInformed: false };
    }

    // Years to correct a deficit. Mobile nutrients (P, K, S) correct in 2 yr;
    // immobile cations (Ca, Mg) in 3 yr. Source: Gilba practice, consistent
    // with Carrow et al. (2001) chapter on base saturation correction rates.
    const YEARS_TO_CORRECT = { P: 2, K: 2, Ca: 3, Mg: 3, S: 2 };

    // GH-370: same defaults nutrition-calendar.js's CONFIG.defaultBulkDensity/
    // defaultSoilDepth use, so a caller that hasn't threaded a real per-sample
    // reading through gets the identical fallback assumption the sibling
    // engine already makes -- not a second, independently-invented default.
    const DEFAULT_BULK_DENSITY_G_CM3 = 1.4;
    const DEFAULT_SOIL_DEPTH_CM = 10;

    // Clippings-collected amplifier — clippings removed from site take
    // nutrients with them; 2.5× accounts for the full removal not replaced
    // by decomposition. Source: nutrition-summary-integration.js v1.1.3.
    const CLIPPING_COLLECTION_FACTOR = 2.5;

    // Traffic intensity modifiers on removal rate.
    // Source: nutrition-summary-integration.js v1.1.3.
    const TRAFFIC_MODIFIERS = { low: 0.8, moderate: 1.0, high: 1.2, extreme: 1.5 };

    // Legacy SLAN_TARGET — pre-b35fix325 single-midpoint constants (Carrow 2001).
    //
    // b35fix325 NOTE: K and S branches now use SLAN sufficiency ranges sourced
    // from GilbaClassificationConstants.SLAN_RANGES.
    // b35fix333 NOTE: those ranges were corrected from a fabricated "Throssell
    // USGA 2009" citation to the actual published source — Carrow et al. (2004)
    // GCM 72(1):194-198. Numbers shifted slightly: P 25-50 → 27-54; K 75-150 →
    // 75-176; Ca 500-1000 → 500-750; Mg 60-200 → 70-140; S 12-30 → 15-40.
    // (Option 1: single ranges set, "other soils" / high-CEC values. Sand vs
    // other soil-type split deferred to b35fix335.)
    // b35fix334 NOTE: P branch pH ladder (getSlanTargetP) rebased onto the
    // Carrow 2004 floor of 27 ppm via Spencer scaled-ladder method — preserves
    // Carrow 2001 P × pH ratios (1.676/1.324/1.000/1.514/1.892), applies them
    // to the Carrow 2004 floor instead of the Carrow 2001 midpoint of 37. New
    // ladder: 45/36/27/41/51 ppm at pH ≤5.5/≤6.0/6.0-7.5/≤8.0/>8.0.
    //
    // SLAN_TARGET is now USED ONLY as a backward-compat reference for any
    // external readers that might import it directly — getSlanTargetP no
    // longer references SLAN_TARGET.P (it now anchors to 27 directly).
    //
    // Pre-b35fix325 K target was 112 ppm — Carrow 2001 midpoint. Now superseded
    // by SLAN_RANGES.K.{floor:75, ceiling:176} via the constants module.
    const SLAN_TARGET = { P: 37, K: 112, S: 18 };

    /**
     * SLAN P target adjusted for pH availability.
     *
     * b35fix334 — Spencer scaled-ladder rebased on Carrow 2004 floor.
     * Pre-b35fix334 this returned 37/49/62/56/70 ppm (Carrow 2001 midpoints
     * at pH 5.5/6.0/6.5+/8.0/>8.0) — i.e. anchored on a Carrow 2001 midpoint
     * that didn't match the post-b35fix333 published Carrow 2004 floor of 27.
     *
     * Spencer scaled-ladder method preserves the pH-availability ratios from
     * the Carrow 2001 P×pH adjustment (which encodes well-established physical
     * chemistry — P availability minimum at pH 6.0-7.5, fixation by Fe/Al at
     * acidic pH and by Ca at alkaline pH), and rebases them on the Carrow
     * 2004 published floor of 27 ppm Mehlich-3 (the value now in
     * gaip-classification-constants.js SLAN_RANGES.P.floor).
     *
     * Carrow 2001 ratios (relative to pH 6.0-7.5 baseline of 37):
     *   pH ≤ 5.5:        62/37 = 1.676 (Fe/Al fixation peak)
     *   pH ≤ 6.0:        49/37 = 1.324
     *   6.0 < pH ≤ 7.5:  37/37 = 1.000 (baseline = minimum fixation)
     *   7.5 < pH ≤ 8.0:  56/37 = 1.514 (Ca fixation onset)
     *   pH > 8.0:        70/37 = 1.892 (Ca-phosphate precipitation)
     *
     * Applied to Carrow 2004 floor of 27 ppm:
     *   pH ≤ 5.5:        27 × 1.676 = 45 ppm
     *   pH ≤ 6.0:        27 × 1.324 = 36 ppm
     *   6.0 < pH ≤ 7.5:  27 ppm (Carrow 2004 baseline floor — Mehlich-3)
     *   7.5 < pH ≤ 8.0:  27 × 1.514 = 41 ppm
     *   pH > 8.0:        27 × 1.892 = 51 ppm
     *
     * pH-independent return = SLAN_RANGES.P.floor (27) when pH is missing —
     * the published baseline floor with no pH adjustment, which is the
     * most defensible default.
     *
     * Sources:
     *   - Floor: Carrow, R.N., Stowell, L., Gelernter, W., Davis, S.,
     *     Duncan, R.R., Skorulski, J. (2004). "Clarifying soil testing:
     *     III. SLAN sufficiency ranges and recommendations." Golf Course
     *     Management 72(1):194-198. Mehlich-3 extractant, "other soils"
     *     value (Option 1 per b35fix333 Spencer decision).
     *   - pH adjustment ratios: Carrow, Waddington & Rieke (2001) Turfgrass
     *     Soil Fertility & Chemical Problems, P × pH adjustment table —
     *     ratios extracted by Spencer scaled-ladder method (b35fix303),
     *     rebased on Carrow 2004 floor (b35fix334).
     *   - Underlying physical chemistry: Penn & Camberato (2019) Crit Rev
     *     Soil Sci on pH-fixation curves; classical view — P availability
     *     maximum at pH 6.0-7.5, with Fe/Al fixation at acidic pH and Ca
     *     fixation at alkaline pH.
     */
    function getSlanTargetP(ph) {
        // b35fix334: pH-independent default = Carrow 2004 floor (27 ppm Mehlich-3).
        // Pre-b35fix334 this returned SLAN_TARGET.P (37) — Carrow 2001 midpoint.
        if (ph == null || isNaN(ph)) return 27;
        if (ph <= 5.5) return 45;            // 27 × 1.676 (Fe/Al fixation)
        if (ph <= 6.0) return 36;            // 27 × 1.324
        if (ph <= 7.5) return 27;            // Carrow 2004 baseline floor
        if (ph <= 8.0) return 41;            // 27 × 1.514 (Ca fixation onset)
        return 51;                           // 27 × 1.892 (Ca-phosphate precipitation)
    }

    /**
     * Normalise methodology key. Accepts case-insensitive variants and the
     * common spellings used in soil lab outputs and turf-config UIs.
     *   MLSN family:  'mlsn', 'MLSN', undefined/null (default)
     *   AA family:    'AA', 'aa', 'ammonium acetate', 'ammonium_acetate', 'AMMONIUM_ACETATE'
     *   SLAN family:  'slan', 'SLAN'
     * Returns one of: 'MLSN' | 'AMMONIUM_ACETATE' | 'SLAN'
     */
    function normaliseMethodology(methodology) {
        if (!methodology) return 'MLSN';
        const s = String(methodology).toUpperCase().replace(/[\s\-]+/g, '_');
        if (s === 'AA' || s === 'AMMONIUM_ACETATE') return 'AMMONIUM_ACETATE';
        if (s === 'SLAN') return 'SLAN';
        return 'MLSN';
    }

    /**
     * Per-nutrient annual requirement. Methodology dispatcher:
     *
     *   MLSN (default) — strict three-tier:
     *     Above target (threshold × 1.5):  apply 0
     *     Between threshold and target:    apply removal only
     *     Below threshold:                 apply removal + deficit correction
     *     pH-adjusted P threshold applies (MLSN only)
     *     Status bands: Very Low / Low / Adequate / High / Excessive
     *     Clippings + traffic modifiers APPLIED
     *
     *   AMMONIUM_ACETATE (AA) — removal-only:
     *     Returns base species removal rate. AA-extractant thresholds aren't
     *     calibrated to MLSN values, so deficit correction can't be derived.
     *     Status always 'Adequate'.
     *     Clippings + traffic modifiers NOT APPLIED (matches source).
     *
     *   SLAN — sufficiency-range correction:
     *     Targets {P:37, K:112, S:18}. NO pH adjustment for P (lab-level standard).
     *     Above target:                   apply 0
     *     Below target:                   apply removal + (target-current)/years
     *     Status bands: Very Low / Low / Adequate / High (no Excessive band)
     *     Clippings + traffic modifiers NOT APPLIED (matches source).
     *
     * Returns kg/ha/yr rounded to 1 decimal place.
     */
    function calculateNutrientRequirement(nutrient, currentLevel, config) {
        const methodology = normaliseMethodology(config.methodology);
        // GH-369: getRemovalRate() now returns { value, tissueInformed } (see
        // its own comment) -- unpack once here so every return site below can
        // report whether ITS annualRequirement was tissue-ratio-derived,
        // without re-deriving the ratio/plausibility check.
        // config.tissueGate is the pre-resolved gate calculateAllRequirements()
        // computes once per sample (see resolveTissueGate()'s own comment).
        // Fall back to resolving it here for callers that invoke this
        // function directly with only config.tissuePercent set (e.g. a
        // single-nutrient check) -- resolveTissueGate() itself is cheap and
        // still requires all of N/P/K, so this can't reintroduce the
        // per-nutrient-independent bug the pre-resolved path exists to avoid.
        const _tissueGate = config.tissueGate || resolveTissueGate(config.tissuePercent);
        const _removalInfo = getRemovalRate(config.species, nutrient, _tissueGate);
        const removal = _removalInfo.value;
        const removalTissueInformed = _removalInfo.tissueInformed;
        const yearsToCorrect = YEARS_TO_CORRECT[nutrient] || 2;

        // GH-370: every below-floor/below-threshold correction term below is
        // a ppm DEFICIT (soil-test units: mg nutrient per kg soil) — it is
        // not already a kg/ha quantity, and treating it as one silently
        // skips the conversion nutrition-calendar.js's calculateDeficit()
        // performs correctly (`deficit_ppm * bulkDensity * soilDepth * 0.1`,
        // a real unit conversion via the known mass of soil under one
        // hectare to the sample depth, not an empirical multiplier). Missed
        // here in all three methodology branches since this engine was
        // extracted from nutrition-summary-integration.js (b35fix302),
        // which never had this conversion either — confirmed by grep: zero
        // occurrences of `bulkDensity` or `* 0.1` anywhere in this file
        // before this fix. Doesn't bite on the Hoxton fixture because its
        // P/K/Ca/Mg/S all sit above ceiling (correction term = 0 either
        // way) -- live-wrong by roughly the missing bulkDensity x depth x
        // 0.1 factor (order of magnitude 2-3x for a typical sand profile at
        // 15cm) the first time a real site is genuinely below floor on this
        // engine's path, per the D31 verification that found this.
        const _ppmToKgHaFactor =
            (config.bulkDensity || DEFAULT_BULK_DENSITY_G_CM3) *
            (config.soilDepth || DEFAULT_SOIL_DEPTH_CM) * 0.1;

        // ── AMMONIUM_ACETATE ──
        // GH-299 (D07 item 6): D07's reported bug was the Annual K Requirement
        // figure never returning 0 for an AA site whose soil K is already HIGH
        // per the certificate range — this branch previously had no ceiling at
        // all, always returning pure removal regardless of currentLevel. When
        // config.aaRange ({min,max} ppm, resolved by the caller per nutrient via
        // HillLabsSampleTypes.deriveCode()/getRangesPpm() — this engine stays a
        // pure function, no window/DOM reads) is present and currentLevel has
        // reached the certificate ceiling, mirror the MLSN tier's "above target
        // -> 0" shape.
        //
        // GH-309 (D07 follow-up): the below-floor half was still missing —
        // this branch always fell through to pure removal for a low reading,
        // never adding a deficit/lift correction the way MLSN and SLAN
        // (above) both do. That was checked against old-hub parity, not
        // assumed: nutrition-calendar.js is the only AA-aware engine present
        // since this repo's initial commit (i.e. what the old hub actually
        // shipped), and it has always added a below-floor lift correction
        // for AA, same shape as MLSN/SLAN (deficit / yearsToCorrect) — this
        // engine didn't exist in the old hub at all (extracted from
        // nutrition-summary-integration.js at b35fix302, which itself never
        // had an AA branch), so its "no lift, ever" behaviour was a fresh
        // SaaS-era decision, not inherited legacy behaviour. It also left
        // this engine and nutrition-calendar.js returning different annual
        // requirements for the same site/nutrient — a direct miss against
        // the Hoxton audit's own regression-fixture assertion 20 ("UI and
        // export return identical annual N, P and K requirements for the
        // same site"). Adding the same lift shape here closes both gaps.
        // Absent config.aaRange (uncovered species/texture, or a nutrient
        // the matched sample-type code has no range for) keeps today's
        // unconditional pure-removal behaviour -- the graceful-degradation
        // path, unchanged.
        if (methodology === 'AMMONIUM_ACETATE') {
            const aaRange = config.aaRange;
            if (aaRange && typeof aaRange.max === 'number' && currentLevel >= aaRange.max) {
                return {
                    nutrient: nutrient,
                    currentLevel: currentLevel,
                    threshold: (typeof aaRange.min === 'number') ? aaRange.min : null,
                    target: aaRange.max,
                    removal: removal,
                    correctionRequired: 0,
                    annualRequirement: 0,
                    intent: 'suppress-above-ceiling',
                    status: 'High',
                    methodology: 'AMMONIUM_ACETATE',
                    tissueInformed: removalTissueInformed
                };
            }
            if (aaRange && typeof aaRange.min === 'number' && currentLevel < aaRange.min) {
                // GH-370: ppm deficit converted to kg/ha before the yearly
                // spread — see this function's own comment on _ppmToKgHaFactor.
                const aaCorrection = (aaRange.min - currentLevel) * _ppmToKgHaFactor / yearsToCorrect;
                return {
                    nutrient: nutrient,
                    currentLevel: currentLevel,
                    threshold: aaRange.min,
                    target: (typeof aaRange.max === 'number') ? aaRange.max : null,
                    removal: removal,
                    correctionRequired: aaCorrection,
                    annualRequirement: Math.round((removal + aaCorrection) * 10) / 10,
                    intent: 'lift-to-floor',
                    status: 'Low',
                    methodology: 'AMMONIUM_ACETATE',
                    tissueInformed: removalTissueInformed
                };
            }
            return {
                nutrient: nutrient,
                currentLevel: currentLevel,
                threshold: (aaRange && typeof aaRange.min === 'number') ? aaRange.min : null,
                target: (aaRange && typeof aaRange.max === 'number') ? aaRange.max : null,
                removal: removal,
                correctionRequired: 0,
                annualRequirement: Math.round(removal * 10) / 10,
                // GH-351: within-range AA soil is semantically identical to
                // SLAN's 'removal-only' intent (sufficient soil, this figure
                // is pure clipping-removal replacement, not a deficit) -- but
                // this branch never set `intent` at all, so
                // _classifyKReconState() (word-export.js) could never tell
                // "sufficient soil, programme is mining reserves" (state
                // 'trend', amber) apart from "deficient soil, spot-K gate
                // should have fired" (state 'advisory', red). Confirmed live:
                // an AA sample with K=276ppm (well above the AA sufficiency
                // ceiling context) showed K req=100 (pure removal, correct)
                // but the K Reconciliation table's negative balance rendered
                // as a red "Advisory (~94 kg/ha), review N programme" instead
                // of the correct amber "Trend ... soil sufficient" state.
                // GH-365: only claim sufficiency when a range was actually
                // resolved. This branch is reached in two semantically
                // different cases -- soil sits inside a real aaRange
                // (genuinely 'removal-only'), or no aaRange resolved at all
                // (uncovered species/texture, deriveCode() returned null, the
                // methodology modules not loaded). Labelling the second case
                // 'removal-only'/'Adequate' makes _classifyKReconState()
                // print "soil sufficient, programme replenishment
                // recommended" to the client on a soil level that was never
                // compared to anything. 'removal-only-unverified' keeps the
                // same arithmetic (removal, no correction -- there is nothing
                // to correct against) while letting consumers tell the two
                // apart; status stays 'Adequate' so existing readers that
                // only branch on status are unaffected.
                intent: aaRange ? 'removal-only' : 'removal-only-unverified',
                rangeResolved: !!aaRange,
                status: 'Adequate',
                methodology: 'AMMONIUM_ACETATE',
                tissueInformed: removalTissueInformed
            };
        }

        // ── SLAN: Carrow et al. 2004 sufficiency-range methodology ──
        // b35fix333: provenance correction. PRE-b35fix333 this block cited
        // "Throssell USGA 2009" for the SLAN ranges, but verification
        // 2026-04-25 confirmed the Throssell papers do not contain SLAN
        // ranges (they are GCSAA environmental-profile survey papers). The
        // numbers were LLM-generated approximations. Source corrected to the
        // actual published SLAN ranges paper. Numbers shifted (Option 1, single
        // ranges set, "other soils" / high-CEC values from Carrow 2004 Table 1):
        //   P:  25-50  → 27-54
        //   K:  75-150 → 75-176  (floor unchanged)
        //   Ca: 500-1000 → 500-750
        //   Mg: 60-200 → 70-140
        //   S:  12-30  → 15-40
        //
        // b35fix325: methodology consolidation. Replaces the pre-b35fix325
        // single-midpoint Carrow-2001 SLAN (target=112 ppm K, deficit-corrected
        // toward midpoint) with sufficiency-band:
        //
        //   below floor:    deficit — apply removal + lift to floor (yearsToCorrect)
        //   floor..ceiling: sufficient — apply removal only (within range)
        //   above ceiling:  high — apply 0 (suppress)
        //
        // Status terminology (Spencer 2026 decision): single Deficient band
        // below floor, Sufficient within range, Excessive above ceiling.
        // Distinct from MLSN's Very Low / Low / Adequate / High / Excessive bands.
        //
        // Source: Carrow, R.N., Stowell, L., Gelernter, W., Davis, S.,
        //         Duncan, R.R., Skorulski, J. (2004). "Clarifying soil testing:
        //         III. SLAN sufficiency ranges and recommendations." Golf
        //         Course Management 72(1):194-198.
        //
        // Range data is sourced from GilbaClassificationConstants.SLAN_RANGES
        // (single source of truth). If the constants module isn't loaded,
        // fall back to inline Carrow 2004 values rather than failing — the
        // engine must remain runnable in test contexts.
        if (methodology === 'SLAN') {
            // Resolve SLAN_RANGES from the canonical constants module.
            const _gcc = (typeof window !== 'undefined' && window.GilbaClassificationConstants) ||
                         (typeof global !== 'undefined' && global.GilbaClassificationConstants) ||
                         null;
            const SLAN_RANGES_FALLBACK = {
                P:  { floor: 27,  ceiling: 54,  citation: 'Carrow et al. (2004). GCM 72(1):194-198.', methodology: 'SLAN-Carrow-2004-range' },
                K:  { floor: 75,  ceiling: 176, citation: 'Carrow et al. (2004). GCM 72(1):194-198.', methodology: 'SLAN-Carrow-2004-range' },
                Ca: { floor: 500, ceiling: 750, citation: 'Carrow et al. (2004). GCM 72(1):194-198.', methodology: 'SLAN-Carrow-2004-range' },
                Mg: { floor: 70,  ceiling: 140, citation: 'Carrow et al. (2004). GCM 72(1):194-198.', methodology: 'SLAN-Carrow-2004-range' },
                S:  { floor: 15,  ceiling: 40,  citation: 'Carrow et al. (2004). GCM 72(1):194-198.', methodology: 'SLAN-Carrow-2004-range' }
            };
            const SLAN_RANGES = (_gcc && _gcc.SLAN_RANGES) || SLAN_RANGES_FALLBACK;

            // P pH-adjustment: the FLOOR shifts with pH (physical chemistry —
            // P availability minimum at pH 6.0-7.5; Fe/Al fixation at acidic
            // pH and Ca fixation at alkaline pH). Apply Spencer scaled-ladder
            // method, anchored on the Carrow 2004 published floor.
            //
            // b35fix334: getSlanTargetP() rebased onto the Carrow 2004 floor
            // of 27 ppm. Pre-b35fix334 was anchored on Carrow 2001 midpoint of
            // 37 ppm — partly orphaned post-b35fix333 because the SSOT floor
            // moved to 27 but the pH ladder still anchored on 37. New ladder
            // returns 45/36/27/41/51 at pH ≤5.5/≤6.0/6.0-7.5/≤8.0/>8.0.
            //
            // Citation field for P branch carries compound provenance because
            // floor source (Carrow 2004 GCM) and pH-adjustment ratio source
            // (Carrow 2001 textbook via Spencer scaled-ladder method) are
            // different. This is the honest description of the methodology;
            // grouping under one citation would obscure the fact that two
            // independent sources contribute.
            let rangeFloor, rangeCeiling, methodLabel, citation;
            if (nutrient === 'P') {
                rangeFloor   = getSlanTargetP(config.ph);  // pH-adjusted Carrow 2004 floor
                rangeCeiling = (SLAN_RANGES.P && SLAN_RANGES.P.ceiling) || 54;
                methodLabel  = (config.ph != null && !isNaN(config.ph))
                    ? 'SLAN-Carrow-2004-range-PH-ADJUSTED'
                    : 'SLAN-Carrow-2004-range';
                citation     = (config.ph != null && !isNaN(config.ph))
                    ? 'Carrow et al. (2004) GCM 72(1):194-198 (floor); Carrow, Waddington & Rieke (2001) (pH adjustment ratios via Spencer scaled-ladder)'
                    : ((SLAN_RANGES.P && SLAN_RANGES.P.citation) || 'Carrow et al. (2004). GCM 72(1):194-198.');
            } else {
                const r = SLAN_RANGES[nutrient];
                if (!r) {
                    // Nutrient outside Carrow 2004's published ranges — fall through
                    // with removal-only and a defensible 'Sufficient' status.
                    return {
                        nutrient: nutrient,
                        currentLevel: currentLevel,
                        threshold: null,
                        target: null,
                        floor: null,
                        ceiling: null,
                        removal: removal,
                        correctionRequired: 0,
                        annualRequirement: Math.round(removal * 10) / 10,
                        intent: 'removal-only',
                        status: 'Sufficient',
                        methodology: 'SLAN-Carrow-2004-range',
                        citation: 'Carrow et al. (2004). GCM 72(1):194-198.',
                        tissueInformed: removalTissueInformed
                    };
                }
                rangeFloor   = r.floor;
                rangeCeiling = r.ceiling;
                methodLabel  = r.methodology || 'SLAN-Carrow-2004-range';
                citation     = r.citation || 'Carrow et al. (2004). GCM 72(1):194-198.';
            }

            // Sufficiency-band dispatch.
            let slanAnnual, slanCorrection, slanIntent, slanStatus;
            if (currentLevel > rangeCeiling) {
                slanAnnual     = 0;
                slanCorrection = 0;
                slanIntent     = 'suppress-above-ceiling';
                slanStatus     = 'Excessive';
            } else if (currentLevel >= rangeFloor) {
                // INCLUSIVE on both bounds: at-floor and at-ceiling are Sufficient.
                slanAnnual     = removal;
                slanCorrection = 0;
                slanIntent     = 'removal-only';
                slanStatus     = 'Sufficient';
            } else {
                // Below floor: deficit. Lift to floor over yearsToCorrect.
                // GH-370: ppm deficit converted to kg/ha first — see
                // calculateNutrientRequirement()'s own comment on _ppmToKgHaFactor.
                slanCorrection = (rangeFloor - currentLevel) * _ppmToKgHaFactor / yearsToCorrect;
                slanAnnual     = Math.max(0, removal + slanCorrection);
                slanIntent     = 'lift-to-floor';
                slanStatus     = 'Deficient';
            }

            return {
                nutrient: nutrient,
                currentLevel: currentLevel,
                threshold: null,            // SLAN uses range, not single threshold
                target: null,               // legacy field — null under range methodology
                floor: rangeFloor,          // structured intent fields (b35fix325)
                ceiling: rangeCeiling,
                removal: removal,
                correctionRequired: slanCorrection,
                annualRequirement: Math.round(slanAnnual * 10) / 10,
                intent: slanIntent,
                status: slanStatus,
                methodology: methodLabel,
                citation: citation,
                tissueInformed: removalTissueInformed
            };
        }

        // ── MLSN (default) ──
        const threshold = getMLSNThreshold(nutrient, config.ph);
        const target = getMLSNTarget(nutrient, config.ph);
        const clippingFactor = config.clippingsCollected ? CLIPPING_COLLECTION_FACTOR : 1;
        const trafficMod = TRAFFIC_MODIFIERS[config.trafficIntensity] || 1;
        const adjustedRemoval = removal * clippingFactor * trafficMod;
        // GH-370: ppm deficit converted to kg/ha before the yearly spread —
        // see calculateNutrientRequirement()'s own comment on _ppmToKgHaFactor.
        const correctionRequired = currentLevel < threshold
            ? (target - currentLevel) * _ppmToKgHaFactor / yearsToCorrect
            : 0;

        let annualRequirement;
        if (currentLevel > target) {
            annualRequirement = 0;
        } else {
            annualRequirement = Math.max(0, adjustedRemoval + correctionRequired);
        }

        let status = 'Adequate';
        if (currentLevel < threshold * 0.5) status = 'Very Low';
        else if (currentLevel < threshold) status = 'Low';
        else if (currentLevel > target * 2) status = 'Excessive';
        else if (currentLevel > target) status = 'High';

        return {
            nutrient: nutrient,
            currentLevel: currentLevel,
            threshold: threshold,
            target: target,
            removal: adjustedRemoval,
            correctionRequired: correctionRequired,
            annualRequirement: Math.round(annualRequirement * 10) / 10,
            // GH-365: MLSN returned no `intent` at all, so every MLSN site hit
            // _classifyKReconState()'s "unknown intent" fall-through and a
            // sufficient soil with a negative programme balance rendered as a
            // red "Advisory (~N kg/ha), review N programme". GH-351 fixed
            // exactly this for the AA branches and left the DEFAULT
            // methodology (getThresholds() falls through to MLSN) with the
            // original bug. Mapped from the same numbers this branch already
            // computes: above target -> requirement suppressed; below the
            // threshold -> a real lift; in between -> removal replacement on
            // sufficient soil.
            intent: (currentLevel > target)
                ? 'suppress-above-ceiling'
                : (currentLevel < threshold ? 'lift-to-floor' : 'removal-only'),
            status: status,
            methodology: 'MLSN',
            tissueInformed: removalTissueInformed
        };
    }

    function calculateAllRequirements(soilValues, config) {
        const nutrients = ['P', 'K', 'Ca', 'Mg', 'S'];
        const results = {};
        // GH-369 follow-up: resolve the tissue gate ONCE for this sample
        // (see resolveTissueGate()'s own comment for why this must not be
        // decided per-nutrient) and hand the SAME resolved gate to every
        // nutrient's config below.
        const tissueGate = resolveTissueGate(config.tissuePercent);
        for (const nutrient of nutrients) {
            const currentLevel = soilValues[nutrient];
            if (currentLevel !== undefined && currentLevel !== null) {
                // GH-299: config.aaRanges (a per-nutrient {P:{min,max}, K:{...}, ...}
                // map, resolved by the caller) must be narrowed to a single
                // config.aaRange for THIS nutrient before calling
                // calculateNutrientRequirement() -- the SSOT's ranges differ per
                // nutrient (e.g. S277's K range and Ca range are different
                // me/100g bounds), so passing the same config unmodified to all
                // five nutrients would apply the wrong ceiling to four of them.
                const nutrientConfig = Object.assign({}, config, {
                    aaRange: config.aaRanges ? (config.aaRanges[nutrient] || null) : undefined,
                    tissueGate: tissueGate
                });
                results[nutrient] = calculateNutrientRequirement(nutrient, currentLevel, nutrientConfig);
            }
        }
        return results;
    }

    // ==========================================================================
    // GROWTH POTENTIAL + MONTHLY N DISTRIBUTION
    // ==========================================================================
    // GP math is delegated to GilbaGrowthPotentialEngine (b35fix302a).
    // This engine keeps the nutrition-programme concepts that GP doesn't own:
    // seasonal C3/C4 fractions, N distribution weighting, active-month gating.
    //
    // Source: nutrition-summary-integration.js v1.1.3. Previously used inline
    // Gaussian math with σ=5.5/7 (matching PACE). Now delegates to the canonical
    // GP engine so all GP consumers share one σ set.

    const MIN_GP_THRESHOLD = 0.10;

    // Summer intent profiles for overseeded sites.
    // Source: nutrition-summary-integration.js v1.1.3 NUTRITION_CONFIG.summerIntentProfiles.
    const SUMMER_INTENT_PROFILES = {
        transition: { summerC3: 0.10, transitionC3: 0.40, winterC3: 0.90 },
        maintain:   { summerC3: 0.35, transitionC3: 0.60, winterC3: 0.90 },
        establish:  { summerC3: 0.05, transitionC3: 0.30, winterC3: 0.85 },
        dormant:    { summerC3: 0.10, transitionC3: 0.50, winterC3: 0.95 }
    };

    function getSeason(month, hemisphere) {
        hemisphere = hemisphere || 'south';
        const seasonsNorth = {
            12: 'Winter', 1: 'Winter', 2: 'Winter',
            3: 'Spring', 4: 'Spring', 5: 'Spring',
            6: 'Summer', 7: 'Summer', 8: 'Summer',
            9: 'Autumn', 10: 'Autumn', 11: 'Autumn'
        };
        const seasonsSouth = {
            6: 'Winter', 7: 'Winter', 8: 'Winter',
            9: 'Spring', 10: 'Spring', 11: 'Spring',
            12: 'Summer', 1: 'Summer', 2: 'Summer',
            3: 'Autumn', 4: 'Autumn', 5: 'Autumn'
        };
        return String(hemisphere).toLowerCase().includes('south')
            ? seasonsSouth[month]
            : seasonsNorth[month];
    }

    function calculateMonthlyC3Fractions(overseedConfig, hemisphere) {
        const result = {};
        if (!overseedConfig || !overseedConfig.isOverseed) {
            const fraction = overseedConfig && overseedConfig.baseIsC4 ? 0 : 1;
            for (let m = 1; m <= 12; m++) result[m] = fraction;
            return result;
        }
        const intent = overseedConfig.summerIntent || 'transition';
        const profile = SUMMER_INTENT_PROFILES[intent] || SUMMER_INTENT_PROFILES.transition;
        for (let month = 1; month <= 12; month++) {
            const season = getSeason(month, hemisphere);
            if      (season === 'Winter') result[month] = profile.winterC3;
            else if (season === 'Summer') result[month] = profile.summerC3;
            else                          result[month] = profile.transitionC3;
        }
        return result;
    }

    /**
     * Monthly GP via GilbaGrowthPotentialEngine. Uses model='pace',
     * species='blend' with per-month c3Fraction — supports pure-C3, pure-C4,
     * and overseed scenarios through one code path. Rounds to 2dp to match
     * source behaviour (nutrition-summary-integration.js lines 444–452).
     * Returns null if the GP engine is not loaded (fails fast rather than
     * producing silent zeros).
     */
    function computeMonthlyGP(monthlyTemps, monthlyC3Fractions) {
        const GP = global && global.GilbaGrowthPotentialEngine;
        if (!GP || typeof GP.compute !== 'function') return null;
        // GH-245: no real per-site monthlyTemps — do not default missing
        // months to 15degC. That silently fabricated a flat ~66% GP profile
        // for every site lacking climate data (Hoxton audit D02/D03 root
        // cause). Fail to null instead; compute() surfaces this as
        // facility.climateDataUnavailable.
        if (!monthlyTemps) return null;
        const result = {};
        for (let month = 1; month <= 12; month++) {
            if (typeof monthlyTemps[month] !== 'number') return null;
            const c3Frac = monthlyC3Fractions ? (monthlyC3Fractions[month] ?? 1.0) : 1.0;
            const gp = GP.compute(monthlyTemps[month], { model: 'pace', species: 'blend', c3Fraction: c3Frac });
            result[month] = Math.round(gp * 100) / 100;
        }
        return result;
    }

    /**
     * Distributes annualN across 12 months weighted by monthly GP. Months with
     * GP below MIN_GP_THRESHOLD (0.10) receive zero. If ALL months are below
     * threshold (total dormancy), falls back to equal distribution so some
     * programme still exists — matches source behaviour
     * (nutrition-summary-integration.js lines 474–481).
     */
    function distributeNGPWeighted(annualN, monthlyGP) {
        let totalGP = 0;
        for (let month = 1; month <= 12; month++) {
            if (monthlyGP[month] >= MIN_GP_THRESHOLD) totalGP += monthlyGP[month];
        }
        const result = {};
        if (totalGP === 0) {
            const perMonth = annualN / 12;
            for (let month = 1; month <= 12; month++) {
                result[month] = Math.round(perMonth * 10) / 10;
            }
            return result;
        }
        for (let month = 1; month <= 12; month++) {
            if (monthlyGP[month] >= MIN_GP_THRESHOLD) {
                const fraction = monthlyGP[month] / totalGP;
                result[month] = Math.round(annualN * fraction * 10) / 10;
            } else {
                result[month] = 0;
            }
        }
        return result;
    }

    function compute(inputs) {
        if (!inputs) throw new Error('NutritionRequirementEngine.compute: inputs required');
        const soil = inputs.soil || {};
        const turf = inputs.turf || {};
        const climate = inputs.climate || {};
        const overseedConfig = inputs.overseedConfig ||
            { isOverseed: false, baseIsC4: false, summerIntent: 'transition' };

        // Per-sample: P/K/S/Ca/Mg based on THIS sample's soil chemistry.
        // Different per green/sportsground — drives the fix for Jerry's
        // reported bug where every green got identical fert recs.
        //
        // Methodology routes (b35fix302b extension):
        //   MLSN (default)    → strict 3-tier with pH-adjusted P, modifiers applied
        //   AMMONIUM_ACETATE  → removal-only, no modifiers, status always Adequate
        //   SLAN              → sufficiency-range targets, no pH adjust, no modifiers
        // Read from soil.methodology — case-insensitive, accepts AA/MLSN/SLAN
        // and 'ammonium acetate'. Unknown values fall through to MLSN.
        const nutrientConfig = {
            ph: soil.pH != null ? soil.pH : 7,
            species: turf.species,
            clippingsCollected: turf.clippingsCollected || false,
            trafficIntensity: turf.trafficIntensity || 'moderate',
            methodology: soil.methodology || 'MLSN',
            // GH-299 (D07 item 6): optional {P:{min,max}, K:{...}, ...} ppm map,
            // resolved by the caller via HillLabsSampleTypes.deriveCode()/
            // getRangesPpm() only when methodology is AA -- this engine stays
            // pure (no window/DOM/HillLabsSampleTypes reads of its own).
            aaRanges: inputs.aaRanges || null,
            // GH-368: {N,P,K} tissue percentages when the site has a tissue
            // sample, so the P/K removal rate comes from this plant's own
            // composition instead of REMOVAL_RATES' generic one (D07a). Engine
            // stays pure -- the caller resolves the sample.
            tissuePercent: inputs.tissuePercent || null,
            // GH-370: soil bulk density (g/cm3) and sample depth (cm), needed
            // to convert a ppm deficit into kg/ha (see
            // calculateNutrientRequirement()'s own comment on this). Engine
            // stays pure -- defaults to nutrition-calendar.js's own
            // CONFIG.defaultBulkDensity/defaultSoilDepth (1.4, 10) when the
            // caller doesn't have a real per-sample reading, exactly as that
            // engine already does, rather than inventing a different default.
            bulkDensity: (typeof soil.bulkDensity === 'number' && soil.bulkDensity > 0) ? soil.bulkDensity : null,
            soilDepth: (typeof soil.depth === 'number' && soil.depth > 0) ? soil.depth : null
        };
        const perSample = calculateAllRequirements(soil, nutrientConfig);

        // Facility: annual N + monthly distribution. Same across all samples
        // on the same site (climate + species + overseed config are site-wide).
        //
        // annualN resolution (matches source extractAnnualNRate three-tier logic,
        // but the engine is pure — orchestrator/DOM lookups happen in the
        // integration layer which passes the result in as turf.nProgramKgHaYr):
        //   1. turf.nProgramKgHaYr (explicit override — e.g. client-specific programme)
        //   2. REMOVAL_RATES[species].N (species default)
        //   3. mixedCool.N (final fallback = 160)
        const normalizedSpecies = normalizeSpecies(turf.species);
        const annualN = (turf.nProgramKgHaYr != null)
            ? turf.nProgramKgHaYr
            : (REMOVAL_RATES[normalizedSpecies]?.N || REMOVAL_RATES.mixedCool.N);

        // C3-on-C3 misconfiguration guard: if isOverseed=true but baseIsC4=false,
        // the "overseed" is a C3 grass on a C3 base — no seasonal C3/C4 split
        // is meaningful. Treat as pure C3 (not overseeded). Source bug fixed.
        const effectiveOverseed = (overseedConfig.isOverseed && overseedConfig.baseIsC4)
            ? overseedConfig
            : { isOverseed: false, baseIsC4: overseedConfig.baseIsC4 || false };

        // GH-245: no fallback to {} — an empty object here silently made
        // every month read as 15degC downstream. null propagates instead,
        // and callers must treat facility.climateDataUnavailable as an
        // explicit signal, not compute against an invented series (Hoxton
        // audit D02/D03).
        const monthlyTemps = climate.monthlyTemps || null;
        const hemisphere = climate.hemisphere || 'south';
        const monthlyC3Fractions = calculateMonthlyC3Fractions(effectiveOverseed, hemisphere);
        const monthlyGP = computeMonthlyGP(monthlyTemps, monthlyC3Fractions);
        const nAllocations = (monthlyGP !== null)
            ? distributeNGPWeighted(annualN, monthlyGP)
            : null;

        // Build monthlyN array (12 entries, Jan=0 through Dec=11). Matches
        // source format consumed by word-export and panel rendering.
        const monthlyN = [];
        let activeMonths = 0;
        for (let month = 1; month <= 12; month++) {
            const n = (nAllocations && nAllocations[month] != null) ? nAllocations[month] : 0;
            const gp = (monthlyGP && monthlyGP[month] != null) ? monthlyGP[month] : 0;
            // != null is correct here — c3Frac of 0 (pure C4) is legitimate.
            // Source uses || 1 which is a silent bug for pure-C4 sites.
            const c3Frac = (monthlyC3Fractions[month] != null) ? monthlyC3Fractions[month] : 1;
            monthlyN.push({ n: n, gp: gp, c3Frac: c3Frac });
            if (n > 0) activeMonths++;
        }

        return {
            perSample: perSample,
            facility: {
                annualN: annualN,
                totalN: annualN,
                monthlyGP: monthlyGP,
                monthlyC3Fractions: monthlyC3Fractions,
                monthlyN: monthlyN,
                activeMonths: activeMonths,
                // true when no real monthly climate normals were supplied —
                // monthlyN above is all-zero, not a computed dormancy result.
                // Renderers must show this explicitly, not a silent empty table.
                climateDataUnavailable: !monthlyTemps
            },
            version: CONFIG.version
        };
    }

    const API = {
        compute: compute,
        _getMLSNThreshold: getMLSNThreshold,
        _getMLSNTarget: getMLSNTarget,
        _normalizeSpecies: normalizeSpecies,
        _isC4Species: isC4Species,
        _getRemovalRate: getRemovalRate,
        _resolveTissueGate: resolveTissueGate,
        _calculateNutrientRequirement: calculateNutrientRequirement,
        _calculateAllRequirements: calculateAllRequirements,
        _normaliseMethodology: normaliseMethodology,
        _getSlanTargetP: getSlanTargetP,
        _getSeason: getSeason,
        _calculateMonthlyC3Fractions: calculateMonthlyC3Fractions,
        _computeMonthlyGP: computeMonthlyGP,
        _distributeNGPWeighted: distributeNGPWeighted,
        MLSN_THRESHOLDS: MLSN_THRESHOLDS,
        REMOVAL_RATES: REMOVAL_RATES,
        SLAN_TARGET: SLAN_TARGET,
        SUMMER_INTENT_PROFILES: SUMMER_INTENT_PROFILES,
        CONFIG: CONFIG
    };

    if (typeof window !== 'undefined') {
        window.NutritionRequirementEngine_Pure = API;
    }
    if (typeof module !== 'undefined' && module.exports) {
        module.exports = API;
    }

    // One-time load confirmation (matches convention in other engines).
    // Jerry's production protocol expects this line on page load.
    if (typeof console !== 'undefined' && console.log) {
        console.log('[NutritionRequirementEngine_Pure] v' + CONFIG.version + ' loaded');
    }
})(typeof window !== 'undefined' ? window : (typeof globalThis !== 'undefined' ? globalThis : this));

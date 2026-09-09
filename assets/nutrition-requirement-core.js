/**
 * NUTRITION REQUIREMENT CORE — PURE, SHARED (GH-376)
 *
 * Hoxton audit D31 ("UI derives K and P as fixed ratios off the monthly N
 * series. The export derives them from removal-replacement in the
 * requirements engine. The two land 10% apart on the same site. Two
 * requirement engines, one product.") — STAGE 1 of the unification the
 * client approved (PLAN-remaining-defects.md D31, Decision 11, Option 1).
 *
 * This module is the removal + correction + ceiling/floor computation that
 * both `assets/nutrition-calendar.js` (`computeProgram()`) and
 * `assets/nutrition-requirement-engine.js` (`NutritionRequirementEngine_Pure
 * .compute()`) currently implement independently, extracted into one pure
 * core they COULD both call.
 *
 * STAGE 1 SCOPE — do not skip this: this module is landed ALONGSIDE the two
 * existing engines. Neither engine's call sites, output shapes, or runtime
 * behaviour change in this stage. Nothing in the app routes through this
 * module yet. `tests/gh376-three-way-nutrition-parity.test.js` proves where
 * this core agrees/disagrees with each existing engine; the cutover itself
 * (making `nutrition-calendar.js`/`nutrition-requirement-engine.js` actually
 * call this core, or retiring one of them) is a later, separate stage that
 * needs the E2E UI-vs-export parity harness as a gate.
 *
 * IN SCOPE: methodology branching (AMMONIUM_ACETATE / SLAN / MLSN), the
 * pH-adjusted P threshold/floor ladder, the tissue-ratio gate (GH-361/368/
 * 369), the ppm->kg/ha deficit conversion (GH-370), the ceiling/floor/
 * removal-only three-way dispatch per nutrient, ONE clipping-collection
 * model and ONE traffic-modifier model (see "DISPUTED CONSTANTS" below).
 *
 * OUT OF SCOPE (deliberately, per this ticket): the facility-level annual-N
 * resolution chain, GP-weighted monthly-N distribution, and the C3/C4
 * seasonal-fraction math. Both `nutrition-calendar.js`
 * (`calculateMonthlyGP`/`distributeByGP`) and `nutrition-requirement-
 * engine.js` (`computeMonthlyGP`/`distributeNGPWeighted`) carry their own,
 * genuinely near-identical, copy of this — confirmed while extracting this
 * core (see this ticket's report / REVIEW-GH349-onward.md GH-376 row for the
 * side-by-side). That is a real, separate duplication and a plausible
 * candidate for a second shared-core module later, but folding it in here
 * was explicitly out of scope for this ticket and has NOT been done.
 *
 * ---------------------------------------------------------------------
 * DISPUTED CONSTANTS — how each was resolved for this core, and why.
 * Per this ticket's brief: "do not silently pick a winner... take the value
 * defensible from the code's own cited sources and say why; where neither
 * is cited, flag it as needing the client's ruling." Full reasoning is in
 * this ticket's report; summarised here so the constant and its rationale
 * live next to each other in source.
 *
 * 1. N BASIS (which "annual N" the generic/tissue P:N and K:N ratios scale
 *    against) — RESOLVED, not actually agronomic. `nutrition-calendar.js`
 *    scales against the site's real, resolved annual N target (whatever the
 *    caller/user actually entered). `nutrition-requirement-engine.js`
 *    scales the TISSUE-governed ratio against `table.N` (a static
 *    per-species constant, e.g. 180 for perennial ryegrass) while its own
 *    FACILITY N resolution three tiers down to the very same kind of real
 *    target when available (`turf.nProgramKgHaYr`) — i.e. that engine
 *    already treats "the real target, when known" as authoritative for one
 *    of its two internal uses of N and a hardcoded constant for the other,
 *    which is an internal inconsistency, not a considered agronomic
 *    position. This core always requires a real, caller-resolved `annualN`
 *    (see `compute()`) and scales every ratio against it — reproduces the
 *    client's own D31 evidence almost exactly: species-table P=18/N=180 at
 *    Hoxton's real N=200 is 18 * 200/180 = 20.0 kg/ha, the audit's own
 *    quoted UI figure, against the export's flat 18.0 — see
 *    tests/gh376-three-way-nutrition-parity.test.js.
 *
 * 2. GENERIC (non-tissue) P/K/Ca/Mg/S : N RATIO — RESOLVED, engineering not
 *    agronomic. `nutrition-calendar.js` uses one FLAT ratio pair for every
 *    species (P 0.10, K 0.55, Ca 0.17, Mg 0.08, S 0.05 — cited to Turner &
 *    Hummel 1992 for "typical cool-season tissue", a single composition).
 *    `nutrition-requirement-engine.js`'s REMOVAL_RATES table is
 *    species-specific (12 species, each individually tuned, cited to
 *    Carrow/Waddington/Rieke 2001 and Christians/Patton/Law 2017) — e.g.
 *    fine fescue K/N is 60/100=0.60, kikuyu is 140/250=0.56, not the one
 *    universal 0.55 nutrition-calendar.js applies regardless of species.
 *    The species-differentiated table is the more complete, still
 *    similarly-cited source, and it is what this core uses (ratio =
 *    table[nutrient]/table.N per species) — this is an ADDITIONAL
 *    divergence beyond the three named in the audit/plan, found while
 *    extracting this core; see the report.
 *
 * 3. CLIPPING-COLLECTION FACTOR — chosen, but flagged, not a clean win.
 *    `nutrition-calendar.js`'s clippingManagement table cites real
 *    literature for the general concept (Kopp & Guillard 2002; Qian et al.
 *    2003) and expresses "collected" as the unmultiplied baseline (factor
 *    1.0 — full replacement) with "returned" REDUCING P/K need (0.4/0.5,
 *    "reference: 60%/50% recycling efficiency"). `nutrition-requirement-
 *    engine.js`'s CLIPPING_COLLECTION_FACTOR (2.5) does the opposite —
 *    "not-collected" is the unmultiplied baseline and "collected" AMPLIFIES
 *    need — and its only citation is its own predecessor file
 *    (`nutrition-summary-integration.js` v1.1.3), which carries the bare
 *    literal `clippingCollectionFactor: 2.5` with no citation of its own
 *    anywhere. Traced further: that predecessor file has NO AA or SLAN
 *    branch at all (MLSN-only) — `nutrition-requirement-engine.js`'s own
 *    comment "Clippings + traffic modifiers NOT APPLIED (matches source)"
 *    for AA/SLAN is a true statement about extraction history (those
 *    branches didn't exist yet to apply it to), not a demonstrated
 *    agronomic reason clipping shouldn't matter under AA/SLAN. Because one
 *    side has an actual external citation and the other does not, this core
 *    uses `nutrition-calendar.js`'s model (collected P/K 1.0, returned P/K
 *    0.4/0.5, Ca/Mg/S reuse the K factor — matching that file's own STEP 3
 *    "Use K factor for Ca/Mg/S" — applied uniformly across all three
 *    methodologies, matching that file's real behaviour for the actual
 *    disputed case, AA). CAVEAT, stated plainly rather than smoothed over:
 *    `nutrition-calendar.js`'s own comment block claims these P/K factors
 *    are "for informational purposes only... not currently applied" —
 *    which is FALSE of its own code (`computeProgram()` STEP 3 applies them
 *    to `adjustedRemoval` unconditionally). That self-contradiction means
 *    the citation-based tiebreak here is not fully clean; flagged in the
 *    report as worth the client's explicit confirmation before cutover,
 *    same as the traffic modifier below.
 *
 * 4. TRAFFIC MODIFIER — NOT resolved, deliberately neutral pending ruling.
 *    Neither file cites anything for its specific values.
 *    `nutrition-calendar.js`: `{low:0.85, moderate:1.0, high:1.15,
 *    extreme:1.3}`, comment reads only "affects wear/recovery, hence
 *    nutrient demand" — no source at all, and (checked against this
 *    engine's own extraction lineage) this exact set of numbers does not
 *    appear anywhere else in the codebase — it looks like an independently
 *    invented deviation. `nutrition-requirement-engine.js`:
 *    `{low:0.8, moderate:1.0, high:1.2, extreme:1.5}`, byte-identical to
 *    `nutrition-summary-integration.js`'s original (uncited) literal — at
 *    least provably the OLDER, unmodified figure, but still uncited. Since
 *    neither is defensible over the other, this core does NOT silently pick
 *    either one: TRAFFIC_MODIFIERS below is neutral (1.0 at every tier), so
 *    the core's output does not silently inherit either candidate's
 *    specific numbers. Both real candidates are exported (see
 *    TRAFFIC_MODIFIERS_CALENDAR_CANDIDATE / _ENGINE_CANDIDATE) so a test or
 *    a future caller can compare against either explicitly via
 *    `config.trafficModifierOverride`. This needs the client's ruling.
 * ---------------------------------------------------------------------
 *
 * @provides NutritionRequirementCore.compute({ soilValues, species, ph,
 *   methodology, aaRanges, tissuePercent, annualN, bulkDensity, soilDepth,
 *   clippingsCollected, trafficIntensity, trafficModifierOverride,
 *   nutrients? })
 */

(function (global) {
    'use strict';

    const CONFIG = {
        version: '1.0.0-gh376',
        debug: false
    };

    // ==========================================================================
    // MLSN thresholds + pH-adjusted P (ported from
    // nutrition-requirement-engine.js — cited, and nutrition-calendar.js has
    // no competing pH ladder of its own to arbitrate against, just an
    // omission; see DISPUTED CONSTANTS note above the module docblock).
    // Source: Woods, Stowell & Gelernter (2016), PACE Turf MLSN guidelines.
    // ==========================================================================
    const MLSN_THRESHOLDS = { P: 21, K: 37, Ca: 331, Mg: 47, S: 7 };
    const TARGET_MULTIPLIER = 1.5;

    const P_PH_ADJUSTMENTS = [
        { maxPh: 5.5, threshold: 35 },
        { maxPh: 6.0, threshold: 28 },
        { maxPh: 7.5, threshold: 21 },
        { maxPh: 8.0, threshold: 32 },
        { maxPh: 99, threshold: 40 }
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

    // ==========================================================================
    // Species-specific removal rates (kg/ha/yr) — ported from
    // nutrition-requirement-engine.js, the more complete of the two source
    // tables (see DISPUTED CONSTANTS item 2 above). Source: Carrow,
    // Waddington & Rieke (2001); Christians, Patton & Law (2017).
    // ==========================================================================
    const REMOVAL_RATES = {
        bentgrass: { N: 150, P: 15, K: 80, Ca: 25, Mg: 12, S: 8 },
        perennialRyegrass: { N: 180, P: 18, K: 100, Ca: 30, Mg: 15, S: 10 },
        kentuckyBluegrass: { N: 160, P: 16, K: 90, Ca: 28, Mg: 14, S: 9 },
        fineFescue: { N: 100, P: 10, K: 60, Ca: 20, Mg: 10, S: 6 },
        tallFescue: { N: 140, P: 14, K: 80, Ca: 25, Mg: 12, S: 8 },
        couch: { N: 200, P: 20, K: 120, Ca: 35, Mg: 18, S: 12 },
        zoysiagrass: { N: 120, P: 12, K: 70, Ca: 22, Mg: 11, S: 7 },
        kikuyu: { N: 250, P: 25, K: 140, Ca: 40, Mg: 20, S: 14 },
        buffalo: { N: 80, P: 8, K: 50, Ca: 15, Mg: 8, S: 5 },
        seashorePaspalum: { N: 160, P: 16, K: 90, Ca: 28, Mg: 14, S: 9 },
        mixedCool: { N: 160, P: 16, K: 85, Ca: 26, Mg: 13, S: 8 },
        mixedWarm: { N: 180, P: 18, K: 100, Ca: 32, Mg: 16, S: 10 }
    };

    const SPECIES_ALIASES = {
        'couch': 'couch', 'bermuda': 'couch', 'bermudagrass': 'couch', 'cynodon': 'couch',
        'hybridcouch': 'couch',
        'bent': 'bentgrass', 'creepingbent': 'bentgrass', 'agrostis': 'bentgrass', 'bentgrass': 'bentgrass',
        'creepingbentgrass': 'bentgrass',
        'browntopbent': 'bentgrass', 'colonialbent': 'bentgrass', 'colonialbentgrass': 'bentgrass',
        'velvetbent': 'bentgrass', 'velvetbentgrass': 'bentgrass',
        'prg': 'perennialRyegrass', 'rye': 'perennialRyegrass', 'ryegrass': 'perennialRyegrass',
        'perennialrye': 'perennialRyegrass', 'perennialryegrass': 'perennialRyegrass',
        'tetraploidryegrass': 'perennialRyegrass', 'tetraploidrye': 'perennialRyegrass',
        'kbg': 'kentuckyBluegrass', 'bluegrass': 'kentuckyBluegrass', 'poa': 'kentuckyBluegrass',
        'kentuckybluegrass': 'kentuckyBluegrass',
        'fescue': 'fineFescue', 'finefescue': 'fineFescue',
        'chewings': 'fineFescue', 'chewingsfescue': 'fineFescue',
        'hardfescue': 'fineFescue', 'sheepfescue': 'fineFescue',
        'slendercreepingredfescue': 'fineFescue', 'slenderredfescue': 'fineFescue',
        'strongcreepingredfescue': 'fineFescue', 'strongredfescue': 'fineFescue',
        'redfescue': 'fineFescue', 'creepingredfescue': 'fineFescue',
        'tallfescue': 'tallFescue',
        'zoysia': 'zoysiagrass', 'zoysiagrass': 'zoysiagrass',
        'zoysiajaponica': 'zoysiagrass', 'zoysiamatrella': 'zoysiagrass',
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

    // ==========================================================================
    // Tissue-ratio gate — ported verbatim from nutrition-requirement-engine.js
    // (GH-368/369). Already cross-validated to compute the identical
    // eligible/ratio decision nutrition-calendar.js's own inline equivalent
    // makes (tests/gh368-two-engines-tissue-parity.test.js) — not part of the
    // D31 divergence, this is the one piece already unified.
    // ==========================================================================
    const TISSUE_RATIO_BANDS = { P: { min: 0.03, max: 0.30 }, K: { min: 0.15, max: 1.50 } };

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
        return { eligible: plausible, pRatio: pRatio, kRatio: kRatio };
    }

    /**
     * Removal rate for one nutrient, scaled against the CALLER'S real
     * `annualN` — not a static species-table constant. This is the D31
     * N-basis fix (DISPUTED CONSTANTS item 1 above): both the tissue-derived
     * ratio and the generic species-table ratio scale against the same real
     * `annualN`, so a site's actual annual N target — not REMOVAL_RATES'
     * fixed per-species N figure — drives P/K/Ca/Mg/S removal, matching
     * nutrition-calendar.js's principle while keeping
     * nutrition-requirement-engine.js's species-specific ratio table
     * (DISPUTED CONSTANTS item 2).
     */
    function getRemovalRate(species, nutrient, tissueGate, annualN) {
        const normalized = normalizeSpecies(species);
        const table = REMOVAL_RATES[normalized] || REMOVAL_RATES.mixedCool;
        const genericRatio = table[nutrient] / table.N;

        if ((nutrient === 'P' || nutrient === 'K') && tissueGate && tissueGate.eligible) {
            const ratio = (nutrient === 'P') ? tissueGate.pRatio : tissueGate.kRatio;
            return { value: Math.round(annualN * ratio * 10) / 10, tissueInformed: true, ratio: ratio };
        }

        return { value: Math.round(annualN * genericRatio * 10) / 10, tissueInformed: false, ratio: genericRatio };
    }

    // ==========================================================================
    // Clipping-collection model — DISPUTED CONSTANTS item 3. Chosen:
    // nutrition-calendar.js's model (cited; "collected" is the unmultiplied
    // 1.0 baseline, "returned" reduces P/K need). Ca/Mg/S reuse the K
    // factor, matching that file's own STEP 3 comment ("Use K factor for
    // Ca/Mg/S") — not this core inventing a fourth number.
    // Source: Kopp & Guillard (2002); Qian et al. (2003).
    // ==========================================================================
    const CLIPPING_FACTORS = {
        collected: { P: 1.0, K: 1.0 },
        returned: { P: 0.4, K: 0.5 }
    };
    function getClippingFactor(nutrient, clippingsCollected) {
        const mode = clippingsCollected ? 'collected' : 'returned';
        const table = CLIPPING_FACTORS[mode];
        if (nutrient === 'P' || nutrient === 'K') return table[nutrient];
        return table.K; // Ca/Mg/S reuse the K factor (nutrition-calendar.js STEP 3 parity).
    }

    // ==========================================================================
    // Traffic modifier — DISPUTED CONSTANTS item 4. Deliberately neutral
    // (no silent winner). Both real candidates exported for comparison/
    // override; see compute()'s trafficModifierOverride.
    // ==========================================================================
    const TRAFFIC_MODIFIERS = { low: 1.0, moderate: 1.0, high: 1.0, extreme: 1.0 };
    const TRAFFIC_MODIFIERS_CALENDAR_CANDIDATE = { low: 0.85, moderate: 1.0, high: 1.15, extreme: 1.3 };
    const TRAFFIC_MODIFIERS_ENGINE_CANDIDATE = { low: 0.8, moderate: 1.0, high: 1.2, extreme: 1.5 };

    // Years to correct a deficit — identical in both source engines, no
    // divergence. Mobile nutrients (P, K, S) correct in 2 yr; immobile
    // cations (Ca, Mg) in 3 yr. Source: Gilba practice, consistent with
    // Carrow et al. (2001) chapter on base saturation correction rates.
    const YEARS_TO_CORRECT = { P: 2, K: 2, Ca: 3, Mg: 3, S: 2 };

    // ppm -> kg/ha conversion defaults — identical in both source engines
    // post-GH-370, no divergence.
    const DEFAULT_BULK_DENSITY_G_CM3 = 1.4;
    const DEFAULT_SOIL_DEPTH_CM = 10;

    // ==========================================================================
    // SLAN — Carrow et al. (2004) sufficiency ranges. Identical fallback
    // table in both source engines, no divergence. P floor uses the same
    // pH-adjusted Spencer scaled-ladder method as MLSN (only present in
    // nutrition-requirement-engine.js — see module docblock note on item 2's
    // sibling, the pH-ladder omission in nutrition-calendar.js).
    // Source: Carrow, R.N., Stowell, L., Gelernter, W., Davis, S., Duncan,
    // R.R., Skorulski, J. (2004). "Clarifying soil testing: III. SLAN
    // sufficiency ranges and recommendations." GCM 72(1):194-198.
    // ==========================================================================
    const SLAN_RANGES_FALLBACK = {
        P: { floor: 27, ceiling: 54, citation: 'Carrow et al. (2004). GCM 72(1):194-198.', methodology: 'SLAN-Carrow-2004-range' },
        K: { floor: 75, ceiling: 176, citation: 'Carrow et al. (2004). GCM 72(1):194-198.', methodology: 'SLAN-Carrow-2004-range' },
        Ca: { floor: 500, ceiling: 750, citation: 'Carrow et al. (2004). GCM 72(1):194-198.', methodology: 'SLAN-Carrow-2004-range' },
        Mg: { floor: 70, ceiling: 140, citation: 'Carrow et al. (2004). GCM 72(1):194-198.', methodology: 'SLAN-Carrow-2004-range' },
        S: { floor: 15, ceiling: 40, citation: 'Carrow et al. (2004). GCM 72(1):194-198.', methodology: 'SLAN-Carrow-2004-range' }
    };

    function getSlanTargetP(ph) {
        if (ph == null || isNaN(ph)) return 27;
        if (ph <= 5.5) return 45;
        if (ph <= 6.0) return 36;
        if (ph <= 7.5) return 27;
        if (ph <= 8.0) return 41;
        return 51;
    }

    function normaliseMethodology(methodology) {
        if (!methodology) return 'MLSN';
        const s = String(methodology).toUpperCase().replace(/[\s\-]+/g, '_');
        if (s === 'AA' || s === 'AMMONIUM_ACETATE') return 'AMMONIUM_ACETATE';
        if (s === 'SLAN') return 'SLAN';
        return 'MLSN';
    }

    /**
     * Per-nutrient annual requirement — the shared removal + correction +
     * ceiling/floor dispatch. Same three-methodology shape as
     * nutrition-requirement-engine.js's calculateNutrientRequirement(); see
     * the module docblock for exactly which constants were ported as-is
     * (no divergence) vs. resolved (N basis, generic ratio table) vs. left
     * deliberately neutral (traffic modifier).
     */
    function calculateNutrientRequirement(nutrient, currentLevel, config) {
        const methodology = normaliseMethodology(config.methodology);
        const tissueGate = config.tissueGate || resolveTissueGate(config.tissuePercent);
        const removalInfo = getRemovalRate(config.species, nutrient, tissueGate, config.annualN);

        const clippingFactor = getClippingFactor(nutrient, !!config.clippingsCollected);
        const trafficTable = config.trafficModifierOverride || TRAFFIC_MODIFIERS;
        const trafficMod = trafficTable[config.trafficIntensity] != null ? trafficTable[config.trafficIntensity] : 1.0;
        const removal = Math.round(removalInfo.value * clippingFactor * trafficMod * 10) / 10;
        const removalTissueInformed = removalInfo.tissueInformed;

        const yearsToCorrect = YEARS_TO_CORRECT[nutrient] || 2;
        const ppmToKgHaFactor =
            (config.bulkDensity || DEFAULT_BULK_DENSITY_G_CM3) *
            (config.soilDepth || DEFAULT_SOIL_DEPTH_CM) * 0.1;

        // ── AMMONIUM_ACETATE ──
        if (methodology === 'AMMONIUM_ACETATE') {
            const aaRange = config.aaRange;
            if (aaRange && typeof aaRange.max === 'number' && currentLevel >= aaRange.max) {
                return {
                    nutrient: nutrient, currentLevel: currentLevel,
                    threshold: (typeof aaRange.min === 'number') ? aaRange.min : null,
                    target: aaRange.max, removal: removal, correctionRequired: 0,
                    annualRequirement: 0, intent: 'suppress-above-ceiling', status: 'High',
                    methodology: 'AMMONIUM_ACETATE', tissueInformed: removalTissueInformed
                };
            }
            if (aaRange && typeof aaRange.min === 'number' && currentLevel < aaRange.min) {
                const aaCorrection = (aaRange.min - currentLevel) * ppmToKgHaFactor / yearsToCorrect;
                return {
                    nutrient: nutrient, currentLevel: currentLevel, threshold: aaRange.min,
                    target: (typeof aaRange.max === 'number') ? aaRange.max : null,
                    removal: removal, correctionRequired: aaCorrection,
                    annualRequirement: Math.round((removal + aaCorrection) * 10) / 10,
                    intent: 'lift-to-floor', status: 'Low',
                    methodology: 'AMMONIUM_ACETATE', tissueInformed: removalTissueInformed
                };
            }
            return {
                nutrient: nutrient, currentLevel: currentLevel,
                threshold: (aaRange && typeof aaRange.min === 'number') ? aaRange.min : null,
                target: (aaRange && typeof aaRange.max === 'number') ? aaRange.max : null,
                removal: removal, correctionRequired: 0,
                annualRequirement: Math.round(removal * 10) / 10,
                intent: aaRange ? 'removal-only' : 'removal-only-unverified',
                rangeResolved: !!aaRange, status: 'Adequate',
                methodology: 'AMMONIUM_ACETATE', tissueInformed: removalTissueInformed
            };
        }

        // ── SLAN ──
        if (methodology === 'SLAN') {
            const _gcc = (typeof window !== 'undefined' && window.GilbaClassificationConstants) ||
                (typeof global !== 'undefined' && global.GilbaClassificationConstants) || null;
            const SLAN_RANGES = (_gcc && _gcc.SLAN_RANGES) || SLAN_RANGES_FALLBACK;

            let rangeFloor, rangeCeiling, methodLabel, citation;
            if (nutrient === 'P') {
                rangeFloor = getSlanTargetP(config.ph);
                rangeCeiling = (SLAN_RANGES.P && SLAN_RANGES.P.ceiling) || 54;
                methodLabel = (config.ph != null && !isNaN(config.ph))
                    ? 'SLAN-Carrow-2004-range-PH-ADJUSTED' : 'SLAN-Carrow-2004-range';
                citation = (config.ph != null && !isNaN(config.ph))
                    ? 'Carrow et al. (2004) GCM 72(1):194-198 (floor); Carrow, Waddington & Rieke (2001) (pH adjustment ratios via Spencer scaled-ladder)'
                    : ((SLAN_RANGES.P && SLAN_RANGES.P.citation) || 'Carrow et al. (2004). GCM 72(1):194-198.');
            } else {
                const r = SLAN_RANGES[nutrient];
                if (!r) {
                    return {
                        nutrient: nutrient, currentLevel: currentLevel, threshold: null, target: null,
                        floor: null, ceiling: null, removal: removal, correctionRequired: 0,
                        annualRequirement: Math.round(removal * 10) / 10, intent: 'removal-only',
                        status: 'Sufficient', methodology: 'SLAN-Carrow-2004-range',
                        citation: 'Carrow et al. (2004). GCM 72(1):194-198.', tissueInformed: removalTissueInformed
                    };
                }
                rangeFloor = r.floor; rangeCeiling = r.ceiling;
                methodLabel = r.methodology || 'SLAN-Carrow-2004-range';
                citation = r.citation || 'Carrow et al. (2004). GCM 72(1):194-198.';
            }

            let slanAnnual, slanCorrection, slanIntent, slanStatus;
            if (currentLevel > rangeCeiling) {
                slanAnnual = 0; slanCorrection = 0; slanIntent = 'suppress-above-ceiling'; slanStatus = 'Excessive';
            } else if (currentLevel >= rangeFloor) {
                slanAnnual = removal; slanCorrection = 0; slanIntent = 'removal-only'; slanStatus = 'Sufficient';
            } else {
                slanCorrection = (rangeFloor - currentLevel) * ppmToKgHaFactor / yearsToCorrect;
                slanAnnual = Math.max(0, removal + slanCorrection);
                slanIntent = 'lift-to-floor'; slanStatus = 'Deficient';
            }

            return {
                nutrient: nutrient, currentLevel: currentLevel, threshold: null, target: null,
                floor: rangeFloor, ceiling: rangeCeiling, removal: removal,
                correctionRequired: slanCorrection, annualRequirement: Math.round(slanAnnual * 10) / 10,
                intent: slanIntent, status: slanStatus, methodology: methodLabel, citation: citation,
                tissueInformed: removalTissueInformed
            };
        }

        // ── MLSN (default) ──
        const threshold = getMLSNThreshold(nutrient, config.ph);
        const target = getMLSNTarget(nutrient, config.ph);
        const correctionRequired = currentLevel < threshold
            ? (target - currentLevel) * ppmToKgHaFactor / yearsToCorrect
            : 0;

        let annualRequirement;
        if (currentLevel > target) {
            annualRequirement = 0;
        } else {
            annualRequirement = Math.max(0, removal + correctionRequired);
        }

        let status = 'Adequate';
        if (currentLevel < threshold * 0.5) status = 'Very Low';
        else if (currentLevel < threshold) status = 'Low';
        else if (currentLevel > target * 2) status = 'Excessive';
        else if (currentLevel > target) status = 'High';

        return {
            nutrient: nutrient, currentLevel: currentLevel, threshold: threshold, target: target,
            removal: removal, correctionRequired: correctionRequired,
            annualRequirement: Math.round(annualRequirement * 10) / 10,
            intent: (currentLevel > target) ? 'suppress-above-ceiling'
                : (currentLevel < threshold ? 'lift-to-floor' : 'removal-only'),
            status: status, methodology: 'MLSN', tissueInformed: removalTissueInformed
        };
    }

    function calculateAllRequirements(soilValues, config) {
        const nutrients = config.nutrients || ['P', 'K', 'Ca', 'Mg', 'S'];
        const results = {};
        const missingSoilData = {};
        const tissueGate = resolveTissueGate(config.tissuePercent);
        for (const nutrient of nutrients) {
            const currentLevel = soilValues[nutrient];
            if (currentLevel === undefined || currentLevel === null || typeof currentLevel !== 'number') {
                missingSoilData[nutrient] = true;
                continue;
            }
            const nutrientConfig = Object.assign({}, config, {
                aaRange: config.aaRanges ? (config.aaRanges[nutrient] || null) : undefined,
                tissueGate: tissueGate
            });
            results[nutrient] = calculateNutrientRequirement(nutrient, currentLevel, nutrientConfig);
        }
        return { results: results, missingSoilData: missingSoilData, tissueGate: tissueGate };
    }

    /**
     * compute(inputs) -> { perSample, meta }
     *
     * Pure. No window/DOM reads. `aaRanges` (per-nutrient {min,max} ppm map)
     * and `tissuePercent` must be resolved by the caller, same contract
     * nutrition-requirement-engine.js already uses — methodology resolution
     * from HillLabsSampleTypes/AmmoniumAcetateMethodology/
     * GilbaClassificationConstants stays out of this core, per this
     * ticket's brief (that belongs in a later cutover-stage adapter).
     *
     * `annualN` is REQUIRED and must be the caller's real, already-resolved
     * annual N target — this core does not fall back to a species-table
     * constant (see DISPUTED CONSTANTS item 1). Fails loud, same convention
     * nutrition-calendar.js's computeProgram() already uses for its own
     * required annualNOverride, rather than silently substituting a
     * species default the way nutrition-requirement-engine.js's OWN
     * facility-N resolution would (that fallback chain belongs to the
     * facility/monthly-N concern this core deliberately excludes — see
     * module docblock "OUT OF SCOPE").
     */
    function compute(inputs) {
        if (!inputs) throw new Error('NutritionRequirementCore.compute: inputs required');
        if (typeof inputs.annualN !== 'number' || !(inputs.annualN > 0)) {
            return { error: 'annualN (real, caller-resolved annual N target) required and must be > 0' };
        }
        const soilValues = inputs.soilValues || {};
        const config = {
            ph: inputs.ph != null ? inputs.ph : 7,
            species: inputs.species,
            annualN: inputs.annualN,
            clippingsCollected: !!inputs.clippingsCollected,
            trafficIntensity: inputs.trafficIntensity || 'moderate',
            trafficModifierOverride: inputs.trafficModifierOverride || null,
            methodology: inputs.methodology || 'MLSN',
            aaRanges: inputs.aaRanges || null,
            tissuePercent: inputs.tissuePercent || null,
            bulkDensity: (typeof inputs.bulkDensity === 'number' && inputs.bulkDensity > 0) ? inputs.bulkDensity : null,
            soilDepth: (typeof inputs.soilDepth === 'number' && inputs.soilDepth > 0) ? inputs.soilDepth : null,
            nutrients: inputs.nutrients || null
        };
        const all = calculateAllRequirements(soilValues, config);
        return {
            perSample: all.results,
            missingSoilData: all.missingSoilData,
            tissueGateApplied: all.tissueGate.eligible,
            meta: { version: CONFIG.version, annualNUsed: inputs.annualN }
        };
    }

    const API = {
        compute: compute,
        _getMLSNThreshold: getMLSNThreshold,
        _getMLSNTarget: getMLSNTarget,
        _normalizeSpecies: normalizeSpecies,
        _isC4Species: isC4Species,
        _getRemovalRate: getRemovalRate,
        _getClippingFactor: getClippingFactor,
        _resolveTissueGate: resolveTissueGate,
        _calculateNutrientRequirement: calculateNutrientRequirement,
        _calculateAllRequirements: calculateAllRequirements,
        _normaliseMethodology: normaliseMethodology,
        _getSlanTargetP: getSlanTargetP,
        MLSN_THRESHOLDS: MLSN_THRESHOLDS,
        REMOVAL_RATES: REMOVAL_RATES,
        YEARS_TO_CORRECT: YEARS_TO_CORRECT,
        CLIPPING_FACTORS: CLIPPING_FACTORS,
        TRAFFIC_MODIFIERS: TRAFFIC_MODIFIERS,
        TRAFFIC_MODIFIERS_CALENDAR_CANDIDATE: TRAFFIC_MODIFIERS_CALENDAR_CANDIDATE,
        TRAFFIC_MODIFIERS_ENGINE_CANDIDATE: TRAFFIC_MODIFIERS_ENGINE_CANDIDATE,
        SLAN_RANGES_FALLBACK: SLAN_RANGES_FALLBACK,
        DEFAULT_BULK_DENSITY_G_CM3: DEFAULT_BULK_DENSITY_G_CM3,
        DEFAULT_SOIL_DEPTH_CM: DEFAULT_SOIL_DEPTH_CM,
        CONFIG: CONFIG
    };

    if (typeof window !== 'undefined') {
        window.NutritionRequirementCore = API;
    }
    if (typeof module !== 'undefined' && module.exports) {
        module.exports = API;
    }

    if (typeof console !== 'undefined' && console.log) {
        console.log('[NutritionRequirementCore] v' + CONFIG.version + ' loaded (GH-376, stage 1 — not yet called by either engine)');
    }
})(typeof window !== 'undefined' ? window : (typeof globalThis !== 'undefined' ? globalThis : this));

/**
 * NUTRITION REQUIREMENT CORE — PURE, SHARED (GH-376, finished in GH-383)
 *
 * Hoxton audit D31 ("UI derives K and P as fixed ratios off the monthly N
 * series. The export derives them from removal-replacement in the
 * requirements engine. The two land 10% apart on the same site. Two
 * requirement engines, one product.").
 *
 * GH-376 extracted this module alongside the two existing engines and routed
 * nothing through it. GH-383 finishes it and makes it THE per-nutrient
 * requirement computation for both surfaces:
 *
 *   assets/nutrition-program-inputs.js   resolves every programme-level input
 *                                        (annual N, clipping, traffic, species,
 *                                        methodology, sufficiency ranges) ONCE,
 *                                        for both callers
 *          |                    |
 *          v                    v
 *   nutrition-calendar.js   nutrition-requirement-engine.js  (facade)
 *   computeProgram()        compute()  -> word-export*.js, old hub panel
 *          \                    /
 *           `--> THIS MODULE <-'      removal + correction + ceiling/floor
 *
 * IN SCOPE: the per-nutrient removal + correction + ceiling/floor dispatch,
 * the species removal-rate table, the tissue-ratio gate (GH-361/368/369), the
 * ppm->kg/ha deficit conversion (GH-370), the clipping-collection model, and
 * the pH ladders for the MLSN / SLAN P floors (exported as pure helpers for
 * the input adapter to call — this module no longer resolves ranges itself).
 *
 * OUT OF SCOPE (deliberately): the facility-level annual-N resolution chain,
 * traffic (see item 4 below), GP-weighted monthly-N distribution and the
 * C3/C4 seasonal-fraction math. Those stay with the callers.
 *
 * ---------------------------------------------------------------------
 * RESOLVED CONSTANTS AND BEHAVIOURS — every one of these is a user decision
 * recorded on PLAN-D31-unify-engines.md section 9; none is picked here.
 *
 * 1. N BASIS (D31/GH-381) — every ratio, tissue-derived or generic, scales
 *    against the caller's real, already-resolved `annualN`, never against
 *    REMOVAL_RATES' own per-species N constant. `annualN` is REQUIRED.
 *
 * 2. GENERIC (non-tissue) P/K/Ca/Mg/S : N RATIO — decision D-5: the
 *    species-specific REMOVAL_RATES table (ratio = table[nutrient]/table.N),
 *    not nutrition-calendar.js's one flat set (P 0.10 / K 0.55 / Ca 0.17 /
 *    Mg 0.08 / S 0.05, Turner & Hummel 1992). Sources for the table: Carrow,
 *    Waddington & Rieke (2001); Christians, Patton & Law (2017).
 *
 * 3. CLIPPING-COLLECTION MODEL — decision D-1: nutrition-calendar.js's cited
 *    table ("collected" is the unmultiplied 1.0 baseline; "returned" reduces
 *    P by 0.4 and K by 0.5; Ca/Mg/S reuse the K factor, matching that file's
 *    own STEP 3), applied uniformly to all three methodologies. Sources:
 *    Kopp & Guillard (2002); Qian et al. (2003). The vocabulary is the
 *    calendar's string, 'collected' | 'returned', and an absent/unknown value
 *    resolves to 'collected' — GH-383 fixed the inverted default this module
 *    shipped with at GH-376 (`!!clippingsCollected`, i.e. absent = returned,
 *    which silently halved P/K removal).
 *
 * 4. TRAFFIC — decisions D-2/D-3: the traffic modifier scales the ANNUAL N
 *    upstream, in nutrition-program-inputs.js, and only for
 *    turf.turfType === 'sports'. It is therefore NOT in this module at all:
 *    P/K/Ca/Mg/S removal already scales with `annualN`, so applying a traffic
 *    factor per nutrient here as well would double-count it.
 *
 * 5. SUFFICIENCY RANGES — resolved by the caller (nutrition-program-inputs.js
 *    `resolveSufficiencyRanges()`) and passed in as `ranges`, for ALL THREE
 *    methodologies. This module reads no window global of any kind; it is
 *    fully pure. The pH ladders it used to apply internally are still here,
 *    exported, so the adapter has one implementation to call rather than a
 *    third copy.
 *
 * 6. BELOW-FLOOR LIFT TARGET — decision D-6: lift to the floor itself (the
 *    Plan page's rule), for every methodology, never to 1.5 x the MLSN
 *    minimum. This is what moves the export's MLSN calcium figure from
 *    ~125 to ~48 kg/ha on the dev sites; approved, and the whole point of
 *    aligning the export to the Plan the client has been validating.
 *
 * 7. MLSN P pH LADDER — decision D-7: kept (35/28/21/32/40 by pH), and now
 *    live on the Plan page too, via the adapter.
 *
 * 8. CEILING COMPARISON — decision D-8: `>=` everywhere. A reading exactly at
 *    the ceiling applies zero, on AA, SLAN and MLSN alike.
 *
 * 9. MISSING SOIL DATUM — decision D-9: a nutrient with no soil reading is
 *    RETURNED (removal-only, `missingSoilData: true`, intent
 *    'removal-only-no-soil-data'), not omitted. Both surfaces then print the
 *    same "no soil data" note against the same removal-only figure.
 * ---------------------------------------------------------------------
 *
 * @provides NutritionRequirementCore.compute({ soilValues, species, ph,
 *   methodology, ranges, tissuePercent, annualN, bulkDensity, soilDepth,
 *   clippingManagement, nutrients? })
 */

(function (global) {
    'use strict';

    const CONFIG = {
        version: '2.0.0-gh383',
        debug: false
    };

    // ==========================================================================
    // MLSN thresholds + the pH-adjusted P ladder (decision D-7 — kept).
    // Exported for nutrition-program-inputs.js to build `ranges` from; this
    // module's own dispatch never calls them (see RESOLVED item 5).
    // Source: Woods, Stowell & Gelernter (2016), PACE Turf MLSN guidelines.
    // ==========================================================================
    const MLSN_THRESHOLDS = { P: 21, K: 37, Ca: 331, Mg: 47, S: 7 };

    // The hub-wide convention for an MLSN "ceiling" — MLSN itself publishes a
    // floor only. Used by the adapter to build ranges[n].max; NOT a lift
    // target any more (decision D-6).
    const MLSN_CEILING_MULTIPLIER = 1.5;

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

    function getMLSNCeiling(nutrient, ph) {
        return getMLSNThreshold(nutrient, ph) * MLSN_CEILING_MULTIPLIER;
    }

    // ==========================================================================
    // SLAN — Carrow et al. (2004) sufficiency ranges, and the Spencer
    // scaled-ladder pH adjustment for the P floor (b35fix334). Same role as
    // the MLSN block above: exported for the adapter, not used here.
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

    // ==========================================================================
    // Species-specific removal rates (kg/ha/yr) — decision D-5.
    // Source: Carrow, Waddington & Rieke (2001); Christians, Patton & Law (2017).
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

    // GH-383 (pitfall 9 of the plan): `poaAnnua` and `cotula` have no row of
    // their own and fall to `mixedCool` through normalizeSpecies()' final
    // branch — that is today's export behaviour, kept deliberately, not an
    // oversight. SpeciesController.toNutrientKey() emits both.
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
    // Tissue-ratio gate (GH-368/369) — all-or-nothing: all of N/P/K present
    // and BOTH ratios in band, or the gate is off for both nutrients.
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
     * `annualN` (RESOLVED item 1), from this plant's own tissue ratio where
     * the gate is eligible (P and K only) and the species table otherwise
     * (RESOLVED item 2).
     */
    function getRemovalRate(species, nutrient, tissueGate, annualN) {
        const normalized = normalizeSpecies(species);
        const table = REMOVAL_RATES[normalized] || REMOVAL_RATES.mixedCool;
        const genericRatio = table[nutrient] / table.N;

        if ((nutrient === 'P' || nutrient === 'K') && tissueGate && tissueGate.eligible) {
            const ratio = (nutrient === 'P') ? tissueGate.pRatio : tissueGate.kRatio;
            return { value: Math.round(annualN * ratio * 10) / 10, raw: annualN * ratio, tissueInformed: true, ratio: ratio };
        }

        const ratio = isFinite(genericRatio) ? genericRatio
            : (REMOVAL_RATES.mixedCool[nutrient] / REMOVAL_RATES.mixedCool.N);
        return { value: Math.round(annualN * ratio * 10) / 10, raw: annualN * ratio, tissueInformed: false, ratio: ratio };
    }

    // ==========================================================================
    // Clipping-collection model — RESOLVED item 3. String vocabulary, and
    // 'collected' is the default for an absent/unknown value.
    // ==========================================================================
    const CLIPPING_FACTORS = {
        collected: { N: 1.0, P: 1.0, K: 1.0 },
        returned: { N: 1.0, P: 0.4, K: 0.5 }
    };

    function resolveClippingManagement(value) {
        const s = String(value == null ? '' : value).trim().toLowerCase();
        return (s === 'returned') ? 'returned' : 'collected';
    }

    function getClippingFactor(nutrient, clippingManagement) {
        const table = CLIPPING_FACTORS[resolveClippingManagement(clippingManagement)];
        if (nutrient === 'N' || nutrient === 'P' || nutrient === 'K') return table[nutrient];
        return table.K; // Ca/Mg/S reuse the K factor (nutrition-calendar.js STEP 3 parity).
    }

    // Years to correct a deficit — identical in both source engines. Mobile
    // nutrients (P, K, S) correct in 2 yr; immobile cations (Ca, Mg) in 3 yr.
    // Source: Gilba practice, consistent with Carrow et al. (2001).
    const YEARS_TO_CORRECT = { P: 2, K: 2, Ca: 3, Mg: 3, S: 2 };

    // ppm -> kg/ha conversion defaults — identical in both source engines
    // post-GH-370.
    const DEFAULT_BULK_DENSITY_G_CM3 = 1.4;
    const DEFAULT_SOIL_DEPTH_CM = 10;

    function normaliseMethodology(methodology) {
        if (!methodology) return 'MLSN';
        const s = String(methodology).toUpperCase().replace(/[\s\-]+/g, '_');
        if (s === 'AA' || s === 'AMMONIUMACETATE' || s === 'AMMONIUM_ACETATE') return 'AMMONIUM_ACETATE';
        if (s === 'COTULA' || s === 'COTULA_S78') return 'AMMONIUM_ACETATE';
        if (s === 'SLAN') return 'SLAN';
        return 'MLSN';
    }

    function round1(v) {
        return Math.round(v * 10) / 10;
    }

    /**
     * Status label for a reading against its resolved range. The three
     * methodologies keep their own established vocabularies (existing
     * consumers branch on these strings) but share ONE set of boundaries —
     * the same `>=` ceiling and `<` floor the requirement dispatch uses
     * (decision D-8), so a printed status can never contradict a printed
     * requirement at the exact ceiling.
     */
    function statusFor(methodology, currentLevel, floor, ceiling) {
        const hasCeiling = typeof ceiling === 'number';
        const hasFloor = typeof floor === 'number';
        if (methodology === 'AMMONIUM_ACETATE') {
            if (hasCeiling && currentLevel >= ceiling) return 'High';
            if (hasFloor && currentLevel < floor) return 'Low';
            return 'Adequate';
        }
        if (methodology === 'SLAN') {
            if (hasCeiling && currentLevel >= ceiling) return 'Excessive';
            if (hasFloor && currentLevel < floor) return 'Deficient';
            return 'Sufficient';
        }
        // MLSN keeps its five-band vocabulary.
        if (hasFloor && currentLevel < floor * 0.5) return 'Very Low';
        if (hasFloor && currentLevel < floor) return 'Low';
        if (hasCeiling && currentLevel >= ceiling * 2) return 'Excessive';
        if (hasCeiling && currentLevel >= ceiling) return 'High';
        return 'Adequate';
    }

    /**
     * Per-nutrient annual requirement — ONE dispatch for all three
     * methodologies (the ranges differ, the arithmetic does not, once D-6/D-8
     * are applied):
     *
     *   currentLevel >= ceiling  -> 0                      'suppress-above-ceiling'
     *   currentLevel <  floor    -> removal + lift-to-floor 'lift-to-floor'
     *   otherwise                -> removal                'removal-only'
     *
     * with `lift = (floor - currentLevel) * bulkDensity * soilDepth * 0.1 /
     * yearsToCorrect` (GH-370's real unit conversion, not a multiplier).
     */
    function calculateNutrientRequirement(nutrient, currentLevel, config) {
        const methodology = normaliseMethodology(config.methodology);
        const tissueGate = config.tissueGate || resolveTissueGate(config.tissuePercent);
        const removalInfo = getRemovalRate(config.species, nutrient, tissueGate, config.annualN);

        const clippingManagement = resolveClippingManagement(config.clippingManagement);
        const clippingFactor = getClippingFactor(nutrient, clippingManagement);
        // `removal` is the canonical 0.1 kg/ha figure and is what every
        // downstream sum uses — the same convention (and the same rounding
        // point) nutrition-requirement-engine.js has always applied, so the
        // export's live-verified figures do not move by a rounding tenth on
        // the cutover. `removalRaw` is exposed alongside it purely as a
        // diagnostic for callers that want to do their own rounding.
        const removalRaw = removalInfo.raw * clippingFactor;
        const removal = round1(removalInfo.value * clippingFactor);

        const range = config.range || null;
        const floor = (range && typeof range.min === 'number') ? range.min : null;
        const ceiling = (range && typeof range.max === 'number') ? range.max : null;
        const methodLabel = (range && range.label) ||
            (methodology === 'SLAN' ? 'SLAN-Carrow-2004-range' : methodology);
        const citation = (range && range.citation) || null;

        const base = {
            nutrient: nutrient,
            currentLevel: currentLevel,
            // Both vocabularies for the same two numbers: the AA/MLSN branches
            // of the pre-GH-383 engine printed threshold/target, the SLAN
            // branch floor/ceiling, and consumers read one or the other.
            threshold: floor,
            target: ceiling,
            floor: floor,
            ceiling: ceiling,
            removalBase: removalInfo.value,
            clippingManagement: clippingManagement,
            clippingFactor: clippingFactor,
            removal: removal,
            removalRaw: removalRaw,
            rangeResolved: !!range,
            methodology: methodLabel,
            citation: citation,
            tissueInformed: removalInfo.tissueInformed
        };

        // Decision D-9: no soil reading — removal-only, flagged, never omitted
        // and never treated as 0 ppm (which would read as maximally deficient
        // against every floor; GH-338).
        if (typeof currentLevel !== 'number' || isNaN(currentLevel)) {
            return Object.assign(base, {
                currentLevel: null,
                correctionRequired: 0,
                correctionRaw: 0,
                annualRequirement: removal,
                intent: 'removal-only-no-soil-data',
                status: 'Unknown',
                missingSoilData: true
            });
        }

        const yearsToCorrect = YEARS_TO_CORRECT[nutrient] || 2;
        const ppmToKgHaFactor =
            (config.bulkDensity || DEFAULT_BULK_DENSITY_G_CM3) *
            (config.soilDepth || DEFAULT_SOIL_DEPTH_CM) * 0.1;

        // Decision D-8: `>=`, on every methodology.
        if (ceiling !== null && currentLevel >= ceiling) {
            return Object.assign(base, {
                correctionRequired: 0,
                correctionRaw: 0,
                annualRequirement: 0,
                intent: 'suppress-above-ceiling',
                status: statusFor(methodology, currentLevel, floor, ceiling),
                missingSoilData: false
            });
        }

        // Decision D-6: lift to the FLOOR itself, on every methodology.
        if (floor !== null && currentLevel < floor) {
            const correction = (floor - currentLevel) * ppmToKgHaFactor / yearsToCorrect;
            return Object.assign(base, {
                correctionRequired: correction,
                correctionRaw: correction,
                annualRequirement: round1(Math.max(0, removal + correction)),
                intent: 'lift-to-floor',
                status: statusFor(methodology, currentLevel, floor, ceiling),
                missingSoilData: false
            });
        }

        return Object.assign(base, {
            correctionRequired: 0,
            correctionRaw: 0,
            annualRequirement: removal,
            // GH-365: "soil sits inside a real range" and "no range resolved at
            // all" are different answers and must not both print as sufficiency.
            intent: range ? 'removal-only' : 'removal-only-unverified',
            status: statusFor(methodology, currentLevel, floor, ceiling),
            missingSoilData: false
        });
    }

    function calculateAllRequirements(soilValues, config) {
        const nutrients = config.nutrients || ['P', 'K', 'Ca', 'Mg', 'S'];
        const results = {};
        const missingSoilData = {};
        const tissueGate = resolveTissueGate(config.tissuePercent);
        for (const nutrient of nutrients) {
            const raw = soilValues[nutrient];
            const currentLevel = (typeof raw === 'number' && !isNaN(raw)) ? raw : null;
            if (currentLevel === null) missingSoilData[nutrient] = true;
            const nutrientConfig = Object.assign({}, config, {
                range: config.ranges ? (config.ranges[nutrient] || null) : null,
                tissueGate: tissueGate
            });
            results[nutrient] = calculateNutrientRequirement(nutrient, currentLevel, nutrientConfig);
        }
        return { results: results, missingSoilData: missingSoilData, tissueGate: tissueGate };
    }

    // Every input key compute() understands. Anything else is a stale caller
    // (e.g. one still passing the retired `clippingsCollected` boolean or
    // `trafficIntensity`) and is reported once — silently ignoring it is how
    // the clipping and N-source gaps survived three tickets.
    const KNOWN_INPUT_KEYS = {
        soilValues: 1, species: 1, ph: 1, methodology: 1, ranges: 1,
        tissuePercent: 1, annualN: 1, bulkDensity: 1, soilDepth: 1,
        clippingManagement: 1, nutrients: 1
    };
    const _warnedUnknownKeys = {};

    /**
     * compute(inputs) -> { perSample, missingSoilData, tissueGateApplied, meta }
     *
     * Pure: no window/DOM/global reads at all. Every programme-level input is
     * REQUIRED and must already be resolved by nutrition-program-inputs.js —
     * this module has no `||` fallback for any of them, deliberately, because
     * a silent default here is exactly how the two surfaces drifted apart.
     */
    function compute(inputs) {
        if (!inputs || typeof inputs !== 'object') {
            throw new Error('NutritionRequirementCore.compute: inputs object required');
        }
        Object.keys(inputs).forEach(function (k) {
            if (!KNOWN_INPUT_KEYS[k] && !_warnedUnknownKeys[k]) {
                _warnedUnknownKeys[k] = true;
                if (typeof console !== 'undefined' && console.warn) {
                    console.warn('[NutritionRequirementCore] GH-383: unknown input "' + k +
                        '" ignored. Programme-level inputs are resolved by ' +
                        'nutrition-program-inputs.js; traffic scales annualN upstream and ' +
                        'clipping is the string `clippingManagement`.');
                }
            }
        });

        const missing = [];
        if (typeof inputs.annualN !== 'number' || !(inputs.annualN > 0)) missing.push('annualN (real, caller-resolved, traffic-adjusted target > 0)');
        if (!inputs.species) missing.push('species');
        if (!inputs.methodology) missing.push('methodology');
        if (!inputs.soilValues || typeof inputs.soilValues !== 'object') missing.push('soilValues');
        if (!inputs.ranges || typeof inputs.ranges !== 'object') missing.push('ranges (resolved by nutrition-program-inputs.js resolveSufficiencyRanges())');
        if (missing.length) {
            throw new Error('NutritionRequirementCore.compute: missing required input(s): ' + missing.join(', '));
        }

        const config = {
            ph: inputs.ph != null ? inputs.ph : null,
            species: inputs.species,
            annualN: inputs.annualN,
            clippingManagement: resolveClippingManagement(inputs.clippingManagement),
            methodology: normaliseMethodology(inputs.methodology),
            ranges: inputs.ranges,
            tissuePercent: inputs.tissuePercent || null,
            bulkDensity: (typeof inputs.bulkDensity === 'number' && inputs.bulkDensity > 0) ? inputs.bulkDensity : null,
            soilDepth: (typeof inputs.soilDepth === 'number' && inputs.soilDepth > 0) ? inputs.soilDepth : null,
            nutrients: inputs.nutrients || null
        };
        const all = calculateAllRequirements(inputs.soilValues, config);
        return {
            perSample: all.results,
            missingSoilData: all.missingSoilData,
            tissueGateApplied: all.tissueGate.eligible,
            meta: {
                version: CONFIG.version,
                annualNUsed: inputs.annualN,
                clippingManagement: config.clippingManagement,
                methodology: config.methodology
            }
        };
    }

    const API = {
        compute: compute,
        _getMLSNThreshold: getMLSNThreshold,
        _getMLSNCeiling: getMLSNCeiling,
        _normalizeSpecies: normalizeSpecies,
        _isC4Species: isC4Species,
        _getRemovalRate: getRemovalRate,
        _resolveClippingManagement: resolveClippingManagement,
        _getClippingFactor: getClippingFactor,
        _resolveTissueGate: resolveTissueGate,
        _calculateNutrientRequirement: calculateNutrientRequirement,
        _calculateAllRequirements: calculateAllRequirements,
        _normaliseMethodology: normaliseMethodology,
        _getSlanTargetP: getSlanTargetP,
        _statusFor: statusFor,
        MLSN_THRESHOLDS: MLSN_THRESHOLDS,
        MLSN_CEILING_MULTIPLIER: MLSN_CEILING_MULTIPLIER,
        REMOVAL_RATES: REMOVAL_RATES,
        YEARS_TO_CORRECT: YEARS_TO_CORRECT,
        CLIPPING_FACTORS: CLIPPING_FACTORS,
        TISSUE_RATIO_BANDS: TISSUE_RATIO_BANDS,
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
        console.log('[NutritionRequirementCore] v' + CONFIG.version + ' loaded (GH-383 — the shared per-nutrient requirement engine)');
    }
})(typeof window !== 'undefined' ? window : (typeof globalThis !== 'undefined' ? globalThis : this));

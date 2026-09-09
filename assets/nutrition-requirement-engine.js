/**
 * NUTRITION REQUIREMENT ENGINE - PURE v2.0.0 (GH-383: a facade over
 * assets/nutrition-requirement-core.js)
 *
 * Pure-function nutrition requirement engine.
 * f({ soil, turf, climate, ranges|aaRanges, tissuePercent, overseedConfig })
 *   → { perSample, facility }
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
        version: '2.0.0-gh383',
        debug: false
    };

    // ==========================================================================
    // GH-383 (D31 stage 1) — THIS FILE IS NOW A FACADE.
    //
    // Every per-nutrient constant and every branch of the removal + correction
    // + ceiling/floor computation that used to live here has moved to
    // assets/nutrition-requirement-core.js, which nutrition-calendar.js also
    // calls. There is one implementation of that arithmetic in the product;
    // this file keeps the public API its callers depend on (the Word export,
    // the old hub's Nutrition Summary panel, a dozen test files) and adds the
    // facility-level annual N + GP-weighted monthly distribution the core
    // deliberately excludes.
    //
    // What that cutover changed, and what it did not:
    //   - MLSN below-threshold correction now lifts to the MLSN MINIMUM, not
    //     to 1.5 x the minimum (decision D-6). This is the one deliberate
    //     numeric move: the export is being aligned to the Plan page the
    //     client has been validating. On the dev sites it takes MLSN calcium
    //     from ~125 to ~48 kg/ha.
    //   - Clipping management is now applied to ALL THREE methodologies, from
    //     the calendar's cited table, keyed by the string 'collected' |
    //     'returned' (decision D-1). The old flat CLIPPING_COLLECTION_FACTOR
    //     of 2.5 — uncited, MLSN-only, and the opposite polarity (it AMPLIFIED
    //     on collected instead of reducing on returned) — is gone. The legacy
    //     boolean `turf.clippingsCollected` is IGNORED, not aliased: it has no
    //     writer anywhere in assets/ or app/, so it has always been false, i.e.
    //     "no information", and mapping false to 'returned' would silently
    //     halve K removal in the old hub's panel and in every existing test
    //     that passes it. Ignored means factor 1.0 — exactly today's number.
    //   - Traffic is no longer applied per nutrient. The modifier scales the
    //     annual N once, upstream, in nutrition-program-inputs.js (decisions
    //     D-2/D-3); applying it here as well would double-count it. Both
    //     tables always resolved to 1.0 in practice (nothing has ever written
    //     an intensity), so no number moves today.
    //   - The ceiling comparison is `>=` on every methodology (decision D-8).
    //   - A nutrient with no soil reading is returned as removal-only with
    //     missingSoilData set, instead of being omitted (decision D-9).
    //   - Sufficiency ranges are resolved by nutrition-program-inputs.js and
    //     passed in as `ranges`. Callers that still pass only `aaRanges` keep
    //     working: see _rangesForCompute() below.
    // ==========================================================================

    let _coreCached = null;
    function _core() {
        if (_coreCached) return _coreCached;
        _coreCached = (global && global.NutritionRequirementCore) ||
            (typeof window !== 'undefined' && window.NutritionRequirementCore) || null;
        if (!_coreCached && typeof module !== 'undefined' && module.exports && typeof require === 'function') {
            try { _coreCached = require('./nutrition-requirement-core.js'); } catch (e) { /* not resolvable */ }
        }
        if (!_coreCached) {
            throw new Error('[NutritionRequirementEngine] nutrition-requirement-core.js is not loaded — ' +
                'it must be enqueued before this file (see the blade script lists).');
        }
        return _coreCached;
    }

    let _inputsCached = null;
    function _inputs() {
        if (_inputsCached) return _inputsCached;
        _inputsCached = (global && global.GAIP_NutritionProgramInputs) ||
            (typeof window !== 'undefined' && window.GAIP_NutritionProgramInputs) || null;
        if (!_inputsCached && typeof module !== 'undefined' && module.exports && typeof require === 'function') {
            try { _inputsCached = require('./nutrition-program-inputs.js'); } catch (e) { /* not resolvable */ }
        }
        return _inputsCached;
    }

    // Re-exports: one table, one normaliser, one ladder — the core's, resolved
    // LAZILY. Resolving at module-evaluation time would make this file's own
    // load order a hard dependency, and a page that enqueued the core after
    // this script would lose NutritionRequirementEngine_Pure entirely instead
    // of failing on first use with a message that names the cause.
    function REMOVAL_RATES_() { return _core().REMOVAL_RATES; }

    function getMLSNThreshold(nutrient, ph) { return _core()._getMLSNThreshold(nutrient, ph); }
    function getMLSNTarget(nutrient, ph) { return _core()._getMLSNCeiling(nutrient, ph); }
    function normalizeSpecies(species) { return _core()._normalizeSpecies(species); }
    function isC4Species(species) { return _core()._isC4Species(species); }
    function resolveTissueGate(tp) { return _core()._resolveTissueGate(tp); }
    function normaliseMethodology(m) { return _core()._normaliseMethodology(m); }
    function getSlanTargetP(ph) { return _core()._getSlanTargetP(ph); }
    function getClippingFactor(n, mode) { return _core()._getClippingFactor(n, mode); }

    // Legacy SLAN_TARGET — pre-b35fix325 single-midpoint constants (Carrow
    // 2001). Kept only as a backward-compat reference for external readers;
    // nothing in this file or the core reads it.
    const SLAN_TARGET = { P: 37, K: 112, S: 18 };

    function getRemovalRate(species, nutrient, tissueGate, annualN) {
        // The pre-GH-383 signature allowed a missing annualN and fell back to
        // the species table's own N. Direct callers (tests/gh368, tests/gh369)
        // still rely on that; the core itself has no such fallback, by design.
        const RR = REMOVAL_RATES_();
        const table = RR[normalizeSpecies(species)] || RR.mixedCool;
        const basis = (typeof annualN === 'number' && annualN > 0) ? annualN : table.N;
        return _core()._getRemovalRate(species, nutrient, tissueGate, basis);
    }

    /**
     * The sufficiency ranges one compute()/_calculateNutrientRequirement()
     * call should use.
     *
     * `ranges` (adapter-shaped) wins outright — that is what word-export.js
     * and word-export-combined.js now pass. Otherwise:
     *   AA   — exactly the caller's `aaRanges` map, nutrient for nutrient, so
     *          a legacy caller's behaviour (including "this nutrient has no
     *          range, so no ceiling ever fires") is byte-identical to before.
     *   SLAN — the adapter's Carrow 2004 + Spencer pH ladder resolution.
     *   MLSN — the adapter's Woods 2016 minima + the D-7 pH ladder, ceiling at
     *          the hub-wide x1.5.
     */
    function _rangesForCompute(methodology, aaRanges, ph, explicitRanges) {
        if (explicitRanges) return explicitRanges;
        const folded = normaliseMethodology(methodology);
        if (folded === 'AMMONIUM_ACETATE') {
            const out = { P: null, K: null, Ca: null, Mg: null, S: null };
            if (aaRanges) {
                ['P', 'K', 'Ca', 'Mg', 'S'].forEach(function (n) {
                    const r = aaRanges[n];
                    if (r) out[n] = { min: r.min, max: r.max, label: 'AMMONIUM_ACETATE', citation: r.citation || null };
                });
            }
            return out;
        }
        const A = _inputs();
        if (!A) {
            throw new Error('[NutritionRequirementEngine] nutrition-program-inputs.js is not loaded — ' +
                'SLAN/MLSN sufficiency ranges are resolved there (GH-383).');
        }
        return A.resolveSufficiencyRanges({ methodology: folded, pH: ph }).ranges;
    }

    let _warnedClippingBoolean = false;
    function _clippingFromConfig(config) {
        if (config && config.clippingManagement) return config.clippingManagement;
        if (config && config.clippingsCollected !== undefined && !_warnedClippingBoolean) {
            _warnedClippingBoolean = true;
            console.warn('[NutritionRequirementEngine] GH-383: the legacy boolean ' +
                '`clippingsCollected` is ignored — clipping management is the string ' +
                '`clippingManagement` (\'collected\' | \'returned\'), resolved by ' +
                'nutrition-program-inputs.js from the site\'s persisted programme. ' +
                'Ignoring it keeps the factor at 1.0, which is what this caller already got.');
        }
        return 'collected';
    }

    /**
     * Per-nutrient annual requirement — delegates to the core. Kept as a
     * public re-export because a dozen test files and the old hub's panel call
     * it directly with the pre-GH-383 config shape
     * ({ methodology, species, aaRange, ph, tissuePercent, bulkDensity,
     *    soilDepth, annualN? }).
     */
    function calculateNutrientRequirement(nutrient, currentLevel, config) {
        config = config || {};
        const methodology = normaliseMethodology(config.methodology);
        const tissueGate = config.tissueGate || resolveTissueGate(config.tissuePercent);
        const RR = REMOVAL_RATES_();
        const table = RR[normalizeSpecies(config.species)] || RR.mixedCool;
        const annualN = (typeof config.annualN === 'number' && config.annualN > 0) ? config.annualN : table.N;

        let range = config.range;
        if (range === undefined) {
            if (config.aaRange !== undefined) {
                range = config.aaRange
                    ? { min: config.aaRange.min, max: config.aaRange.max, label: 'AMMONIUM_ACETATE' }
                    : null;
            } else {
                range = _rangesForCompute(methodology, null, config.ph, null)[nutrient] || null;
            }
        }

        return _core()._calculateNutrientRequirement(nutrient, currentLevel, {
            methodology: methodology,
            species: config.species,
            annualN: annualN,
            ph: config.ph,
            range: range,
            tissueGate: tissueGate,
            tissuePercent: config.tissuePercent,
            bulkDensity: config.bulkDensity,
            soilDepth: config.soilDepth,
            clippingManagement: _clippingFromConfig(config)
        });
    }

    function calculateAllRequirements(soilValues, config) {
        const nutrients = ['P', 'K', 'Ca', 'Mg', 'S'];
        const results = {};
        const tissueGate = resolveTissueGate(config.tissuePercent);
        const ranges = _rangesForCompute(config.methodology, config.aaRanges, config.ph, config.ranges);
        for (const nutrient of nutrients) {
            const currentLevel = soilValues[nutrient];
            // GH-383 / decision D-9: a nutrient with no soil reading is
            // computed as removal-only and flagged, so both surfaces can print
            // the same "no soil data" note against the same figure. Pre-GH-383
            // this engine omitted the nutrient entirely while the Plan page
            // showed removal-only — the same number, presented as absent.
            results[nutrient] = calculateNutrientRequirement(nutrient, currentLevel, Object.assign({}, config, {
                range: ranges[nutrient] || null,
                tissueGate: tissueGate
            }));
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

        // GH-381 (D31, N-basis divergence): resolved ONCE, before the
        // per-sample config is built, so removal (below) and the facility
        // N target (further down) can never see two different values for
        // "this site's annual N". Same three-tier resolution as before
        // (explicit override -> species default -> mixedCool fallback),
        // just moved earlier and no longer duplicated.
        //
        // GH-383: `turf.nProgramKgHaYr` is now what nutrition-program-inputs.js
        // resolved for THIS site — the Plan page's own base N, already scaled
        // by the traffic modifier. `turf.annualNBase` and `turf.trafficModifier`
        // come with it so the facility object below can report the provenance
        // of the number the export prints. Callers that do not go through the
        // adapter (the old hub's Nutrition Summary panel, direct test calls)
        // keep the species-table fallback they have always had.
        const normalizedSpecies = normalizeSpecies(turf.species);
        const _RR = REMOVAL_RATES_();
        const annualN = (turf.nProgramKgHaYr != null)
            ? turf.nProgramKgHaYr
            : (_RR[normalizedSpecies]?.N || _RR.mixedCool.N);
        const trafficModifier = (typeof turf.trafficModifier === 'number' && turf.trafficModifier > 0)
            ? turf.trafficModifier : 1;
        const baseAnnualN = (typeof turf.annualNBase === 'number' && turf.annualNBase > 0)
            ? turf.annualNBase : annualN;

        // Per-sample: P/K/S/Ca/Mg based on THIS sample's soil chemistry.
        // Different per green/sportsground — drives the fix for Jerry's
        // reported bug where every green got identical fert recs.
        //
        // GH-383: the three methodologies now differ only in WHICH range they
        // are given and WHICH status vocabulary they print — the removal +
        // correction + ceiling/floor arithmetic is one dispatch in the core,
        // and clipping management applies to all three. Read from
        // soil.methodology — case-insensitive, accepts AA/MLSN/SLAN and
        // 'ammonium acetate'. Unknown values fall through to MLSN.
        const nutrientConfig = {
            ph: soil.pH != null ? soil.pH : 7,
            species: turf.species,
            // GH-383 (decision D-1): the string, resolved by
            // nutrition-program-inputs.js from the site's persisted
            // programme. The legacy boolean is ignored — see the facade
            // banner at the top of this file for why aliasing it would be
            // wrong.
            clippingManagement: turf.clippingManagement,
            clippingsCollected: turf.clippingsCollected,
            methodology: soil.methodology || 'MLSN',
            // GH-383: sufficiency ranges resolved once by the shared adapter,
            // for all three methodologies. `aaRanges` remains accepted for
            // callers that have not been migrated (the old hub's panel, direct
            // test calls) and is applied nutrient-for-nutrient, exactly as
            // before.
            ranges: inputs.ranges || null,
            aaRanges: inputs.aaRanges || null,
            // GH-368: {N,P,K} tissue percentages when the site has a tissue
            // sample, so the P/K removal rate comes from this plant's own
            // composition instead of REMOVAL_RATES' generic one (D07a). Engine
            // stays pure -- the caller resolves the sample.
            tissuePercent: inputs.tissuePercent || null,
            // GH-381 (D31): the site's real annual N target (same value
            // facility.annualN below reports), threaded into removal-rate
            // scaling. See getRemovalRate()'s own comment for what this
            // replaces and why.
            annualN: annualN,
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

        // Facility: monthly distribution of the same annualN resolved above
        // (GH-381) — annualN itself is not re-derived here, so this and the
        // per-sample removal calculation can never disagree about it.

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
                // GH-383: additive provenance for the printed N. `annualN` is
                // the traffic-adjusted figure both the ANR table and the
                // monthly distribution use; `baseAnnualN` is the Plan page's
                // own input before the modifier. Identical today (every
                // modifier is 1.0 until stage 3 wires the traffic schedule),
                // and read by the E2E harness so a future modifier cannot be
                // applied twice unnoticed.
                baseAnnualN: baseAnnualN,
                trafficModifier: trafficModifier,
                trafficIntensity: turf.trafficIntensity || 'moderate',
                annualNSource: (turf.annualNSource || null),
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
        // GH-383: clipping management, re-exported from the core so callers and
        // tests read ONE table rather than a second copy that can drift.
        _getClippingFactor: getClippingFactor,
        _resolveClippingManagement: function (v) { return _core()._resolveClippingManagement(v); },
        _rangesForCompute: _rangesForCompute,
        _getSeason: getSeason,
        _calculateMonthlyC3Fractions: calculateMonthlyC3Fractions,
        _computeMonthlyGP: computeMonthlyGP,
        _distributeNGPWeighted: distributeNGPWeighted,
        get MLSN_THRESHOLDS() { return _core().MLSN_THRESHOLDS; },
        get REMOVAL_RATES() { return _core().REMOVAL_RATES; },
        get YEARS_TO_CORRECT() { return _core().YEARS_TO_CORRECT; },
        get CLIPPING_FACTORS() { return _core().CLIPPING_FACTORS; },
        get DEFAULT_BULK_DENSITY_G_CM3() { return _core().DEFAULT_BULK_DENSITY_G_CM3; },
        get DEFAULT_SOIL_DEPTH_CM() { return _core().DEFAULT_SOIL_DEPTH_CM; },
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
        console.log('[NutritionRequirementEngine_Pure] v' + CONFIG.version + ' loaded (GH-383 — facade over nutrition-requirement-core.js)');
    }
})(typeof window !== 'undefined' ? window : (typeof globalThis !== 'undefined' ? globalThis : this));

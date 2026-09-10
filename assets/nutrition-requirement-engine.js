/**
 * NUTRITION REQUIREMENT ENGINE - PURE v2.0.0 (GH-383: a facade over
 * assets/nutrition-requirement-core.js)
 *
 * Pure-function nutrition requirement engine.
 * f({ soil, turf, climate, ranges|aaRanges, tissuePercent, overseedConfig,
 *     distribution })
 *   → { perSample, facility, monthlyNutrients }
 *
 * `distribution` is GH-398's addition: { mode, maxNPerMonth } — the monthly
 * distribution mode and "Max N per application" cap the site's own Plan
 * programme was built with, resolved by nutrition-program-inputs.js. Omitted,
 * the engine behaves as it did before that ticket (gp_weighted, no cap).
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
        // GH-398 bumped this: the monthly series this engine returns is now
        // capped and mode-aware, so a stored result stamped 2.0.0-gh383 was
        // produced by the uncapped distribution and is not comparable.
        version: '2.1.0-gh398',
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
    //
    // GH-398 (D31 stage 4) finished the job at the other end: the GP-weighted
    // MONTHLY distribution — the last thing this file and nutrition-calendar.js
    // each implemented separately — moved to
    // assets/nutrition-monthly-distribution.js, along with the monthly N cap
    // that only the calendar had. The visible consequence is that the Word
    // export's "Monthly N Distribution" table now honours the site's own
    // "Max N per application" limit and its own distribution mode instead of
    // printing an uncapped GP-weighted series beside a Plan page that had
    // clamped it.
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
    // GROWTH POTENTIAL + MONTHLY N DISTRIBUTION — GH-398 (D31 stage 4)
    // ==========================================================================
    // This section used to be the export's own copy of the monthly programme:
    // its own 0.10 activity threshold, its own GP-weighted split, its own
    // dormancy fallback, its own season table, and no monthly N cap at all —
    // against nutrition-calendar.js's copy of the same four things plus the
    // cap. One document printed both series.
    //
    // All of it now lives in assets/nutrition-monthly-distribution.js. What
    // changed here, by the settled decisions:
    //   - The monthly N cap is APPLIED (decision 1). Four of the ten dev sites
    //     carry a 15 kg N/month cap and it binds on all four; this table used
    //     to print the unclamped series for those sites while the Plan page
    //     showed the clamped one.
    //   - The distribution MODE is honoured (gp_weighted / even /
    //     front_loaded), taken from the same site programme the Plan page
    //     saved it in. Every current site is gp_weighted.
    //   - GP is no longer rounded to 2 dp before weighting and the monthly
    //     figures are no longer rounded inside the split (decision 2). Rounding
    //     intermediates was the source of the ≤0.2 kg/month drift between the
    //     two series; the values are rounded once, where they are built into
    //     facility.monthlyN.
    //   - The C3/C4 blend is unchanged, fractions included (decision 3) — it
    //     is this engine's model that the Plan page adopted, not the reverse.
    //
    // Month indexing: this file's public shapes stay 1-12 (facility.monthlyGP,
    // facility.monthlyC3Fractions, _computeMonthlyGP, _getSeason). The shared
    // module works in 0-11 and owns the converters, so the reindex has one
    // implementation rather than an inline one per call site — GH-363 was an
    // inline one.

    let _distributionCached = null;
    function _distribution() {
        if (_distributionCached) return _distributionCached;
        _distributionCached = (global && global.GAIP_NutritionMonthlyDistribution) ||
            (typeof window !== 'undefined' && window.GAIP_NutritionMonthlyDistribution) || null;
        if (!_distributionCached && typeof module !== 'undefined' && module.exports && typeof require === 'function') {
            try { _distributionCached = require('./nutrition-monthly-distribution.js'); } catch (e) { /* not resolvable */ }
        }
        if (!_distributionCached) {
            throw new Error('[NutritionRequirementEngine] nutrition-monthly-distribution.js is not loaded — ' +
                'it must be enqueued before this file (see the blade script lists).');
        }
        return _distributionCached;
    }

    /** 1-12 season lookup, kept for callers; the table is the shared one. */
    function getSeason(month, hemisphere) {
        return _distribution().seasonFor(month - 1, hemisphere || 'south');
    }

    /** 1-12 keyed C3 fractions. */
    function calculateMonthlyC3Fractions(overseedConfig, hemisphere) {
        const arr = _distribution().monthlyC3Fractions(overseedConfig, hemisphere || 'south');
        return _distribution().toMonthMap(arr);
    }

    /**
     * Monthly GP, 1-12 keyed, via GilbaGrowthPotentialEngine (model='pace',
     * species='blend' with a per-month c3Fraction — one code path for pure-C3,
     * pure-C4 and overseed).
     *
     * GH-398: no longer rounded to 2 dp. Rounding before the weighting was one
     * half of the drift between this table and the Plan page's; the printed GP
     * percentage is rounded at render, as it always was.
     *
     * Returns null if the GP engine is not loaded, or if any month's
     * temperature is missing — GH-245: never default a missing month to 15degC,
     * which silently fabricated a flat ~66% profile for every site with no
     * climate data (Hoxton audit D02/D03). compute() surfaces that as
     * facility.climateDataUnavailable.
     */
    function computeMonthlyGP(monthlyTemps, monthlyC3Fractions) {
        const D = _distribution();
        const temps = D.fromMonthMap(monthlyTemps);
        if (!temps) return null;
        const fractions = monthlyC3Fractions ? D.fromMonthMap(monthlyC3Fractions) : null;
        const gp = D.monthlyGP(temps, fractions);
        return gp ? D.toMonthMap(gp) : null;
    }

    /**
     * Distributes annualN across 12 months (1-12 keyed) weighted by monthly
     * GP. GH-398: raw values — the caller rounds at output.
     */
    function distributeNGPWeighted(annualN, monthlyGP) {
        const D = _distribution();
        const gp = D.fromMonthMap(monthlyGP);
        return D.toMonthMap(D.distribute(annualN, gp, 'gp_weighted'));
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
        //
        // GH-398: the guard itself moved into the shared module's
        // monthlyC3Fractions(), because nutrition-calendar.js had to apply the
        // same rule the moment it adopted this blended model, and one rule
        // written twice is the whole subject of D31.

        // GH-245: no fallback to {} — an empty object here silently made
        // every month read as 15degC downstream. null propagates instead,
        // and callers must treat facility.climateDataUnavailable as an
        // explicit signal, not compute against an invented series (Hoxton
        // audit D02/D03).
        const monthlyTemps = climate.monthlyTemps || null;
        const hemisphere = climate.hemisphere || 'south';
        const monthlyC3Fractions = calculateMonthlyC3Fractions(overseedConfig, hemisphere);
        const monthlyGP = computeMonthlyGP(monthlyTemps, monthlyC3Fractions);

        // GH-398 (D31 stage 4): the distribution mode and the monthly N cap
        // this site's Plan programme was built with, resolved by
        // nutrition-program-inputs.js from the same site config the Plan page
        // saved them in. Absent — a caller that has not been migrated, e.g.
        // the old hub's Nutrition Summary panel — the mode defaults to
        // gp_weighted and there is no cap, which is exactly what this engine
        // did before this ticket, so no unmigrated caller's numbers move.
        const _dist = _distribution();
        const distributionIn = inputs.distribution || {};
        const distributionMode = _dist.normalizeMode(distributionIn.mode);
        const maxNPerMonth = (typeof distributionIn.maxNPerMonth === 'number' && distributionIn.maxNPerMonth > 0)
            ? distributionIn.maxNPerMonth : null;

        // Every nutrient through the one function (decision 4). The document
        // prints N only today; P/K/Ca/Mg/S are computed here so there is no
        // second place left that could compute them differently.
        const annualAmounts = { N: annualN };
        ['P', 'K', 'Ca', 'Mg', 'S'].forEach(function (n) {
            const r = perSample[n];
            if (r && typeof r.annualRequirement === 'number') annualAmounts[n] = r.annualRequirement;
        });

        const distributed = (monthlyGP !== null)
            ? _dist.distributeProgram({
                annualAmounts: annualAmounts,
                gp: _dist.fromMonthMap(monthlyGP),
                mode: distributionMode,
                maxNPerMonth: maxNPerMonth
            })
            : null;
        const nAllocations = distributed ? distributed.distributions.N : null;

        // Build monthlyN array (12 entries, Jan=0 through Dec=11). Matches
        // source format consumed by word-export and panel rendering.
        //
        // GH-398: the 0.1 kg rounding that used to happen inside the split
        // happens HERE, once, on the way out — the Plan page's convention
        // (decision 2). It is the same rounding, one step later, so a month's
        // printed figure is unchanged except where the pre-rounded GP had
        // shifted it.
        const monthlyN = [];
        let activeMonths = 0;
        for (let month = 1; month <= 12; month++) {
            const raw = (nAllocations && nAllocations[month - 1] != null) ? nAllocations[month - 1] : 0;
            const n = Math.round(raw * 10) / 10;
            const gp = (monthlyGP && monthlyGP[month] != null) ? monthlyGP[month] : 0;
            // != null is correct here — c3Frac of 0 (pure C4) is legitimate.
            // Source uses || 1 which is a silent bug for pure-C4 sites.
            const c3Frac = (monthlyC3Fractions[month] != null) ? monthlyC3Fractions[month] : 1;
            monthlyN.push({ n: n, gp: gp, c3Frac: c3Frac });
            if (n > 0) activeMonths++;
        }

        // The other five nutrients, 12 entries each, Jan=0 — unprinted today.
        const monthlyNutrients = {};
        if (distributed) {
            Object.keys(distributed.distributions).forEach(function (nutrient) {
                const series = distributed.distributions[nutrient];
                const out = [];
                for (let m = 0; m < 12; m++) out.push(Math.round((series[m] || 0) * 10) / 10);
                monthlyNutrients[nutrient] = out;
            });
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
                // GH-398: what the monthly series was built with, and what the
                // cap did to it. `nCap` is the shared module's own result
                // object — the same fields nutrition-calendar.js persists as
                // adjustments.n_cap_applied / original_n_total /
                // scheduled_n_total / n_redistributed / n_unschedulable — so
                // the Word export can state a clamped programme in the Plan
                // page's own terms instead of printing a series that silently
                // exceeds the site's own limit. null when the climate series
                // was unavailable and nothing was distributed.
                distributionMode: distributionMode,
                maxNPerMonth: maxNPerMonth,
                nCap: distributed ? distributed.nCap : null,
                // true when no real monthly climate normals were supplied —
                // monthlyN above is all-zero, not a computed dormancy result.
                // Renderers must show this explicitly, not a silent empty table.
                climateDataUnavailable: !monthlyTemps
            },
            // GH-398 (decision 4): N plus P/K/Ca/Mg/S, each 12 entries Jan=0.
            // N is the facility figure; the other five are THIS sample's, since
            // that is what perSample resolved. Nothing renders them yet —
            // whether the document should show them is a separate decision —
            // but they exist so no caller has to distribute them itself.
            monthlyNutrients: monthlyNutrients,
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
        // GH-398: re-exported from the shared distribution module (lazily, as
        // the core's tables are) — one copy of the four overseed profiles.
        get SUMMER_INTENT_PROFILES() { return _distribution().SUMMER_INTENT_PROFILES; },
        get MIN_GP_THRESHOLD() { return _distribution().MIN_GP_THRESHOLD; },
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

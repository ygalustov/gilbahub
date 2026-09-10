/**
 * NUTRITION MONTHLY DISTRIBUTION — SHARED (GH-398, D31 stage 4)
 *
 * The ONE implementation of "spread an annual kg/ha figure across twelve
 * months by growth potential". Before this file it existed twice:
 *
 *   nutrition-calendar.js   distributeByGP() + applyNCap()   — the Plan page's
 *                           Monthly Nutrient Program, 0-11 month indexing,
 *                           three distribution modes, a monthly N cap with
 *                           overflow redistribution, raw values until display.
 *   nutrition-requirement-engine.js  distributeNGPWeighted() — the Word
 *                           export's "Monthly N Distribution" table, 1-12
 *                           indexing, GP-weighted only, no cap, GP rounded to
 *                           2 dp before weighting and each month to 1 dp.
 *
 * The shared half was real — GP weighting with a 0.10 activity threshold and
 * an even-split dormancy fallback — and the threshold itself was a third
 * duplicate (`CONFIG.minGpThreshold` / `MIN_GP_THRESHOLD`). Everything around
 * it differed, which is why the two produced different monthly series for the
 * same site in the same document. D31 stage 4's settled decisions, implemented
 * here:
 *
 *   1. THE CAP IS PART OF THE DISTRIBUTION. `applyNCap()` moved here from the
 *      calendar unchanged and both surfaces run it, so the export's table can
 *      no longer print an uncapped series for a site whose Plan programme is
 *      clamped. Four of the ten dev sites carry a cap of 15 kg N/month and it
 *      binds on all four.
 *   2. FULL PRECISION THROUGH THE CALCULATION, ROUNDING ONLY AT OUTPUT. The
 *      engine's pre-allocation GP rounding and per-month rounding are gone;
 *      the calendar's convention wins because rounding intermediates was the
 *      source of the drift between the two series.
 *   3. ONE C3/C4 MODEL — the engine's. An overseeded sward is blended per
 *      month between the C3 and C4 GP curves by a C3 fraction from the four
 *      summer-intent profiles, rather than treated as pure C3 or pure C4 for
 *      all twelve months. The fractions are carried across unchanged; they
 *      carry no external citation and are flagged for the agronomist, but they
 *      are not this ticket's to move. For a NON-overseeded sward the blend is
 *      exact: GilbaGrowthPotentialEngine's 'blend' species computes
 *      `f * c3GP + (1 - f) * c4GP`, so f = 1 is bit-for-bit the C3 curve and
 *      f = 0 the C4 curve. No site without an overseed configuration moves.
 *   4. EVERY NUTRIENT THROUGH THE SAME PATH. distributeProgram() takes a map
 *      of annual amounts, so N, P, K, Ca, Mg and S are distributed by one
 *      function. Whether the Word export prints anything but N is a separate
 *      decision; today it prints N only.
 *   6. `front_loaded` IS CARRIED ACROSS UNCHANGED, DEFECT AND ALL — see
 *      distribute()'s own comment. It does not conserve the annual total and
 *      its boost months are hard-coded to southern spring. Deferred
 *      deliberately: no site uses the mode, and normalising it would settle a
 *      question the user has not been asked.
 *
 * MONTH INDEXING. This module works in 0-11 (index 0 = January), the
 * calendar's convention and the convention of every array it hands back.
 * GilbaClimateNormalsService and nutrition-requirement-engine.js work in 1-12,
 * so the two converters below exist for that boundary — ONE implementation of
 * the reindex, because doing it inline is what GH-363 was.
 *
 * @provides GAIP_NutritionMonthlyDistribution
 */

(function (global) {
    'use strict';

    const VERSION = '1.0.0-gh398';

    /** Below this GP a month is dormant and receives nothing. */
    const MIN_GP_THRESHOLD = 0.10;

    const MONTH_NAMES = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun',
                         'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

    /**
     * Seasons, 0-11. The calendar held these as 0-11 maps and the engine as a
     * 1-12 map; they were the same twelve labels written twice.
     */
    const SEASONS_SOUTH = ['Summer', 'Summer', 'Autumn', 'Autumn', 'Autumn', 'Winter',
                           'Winter', 'Winter', 'Spring', 'Spring', 'Spring', 'Summer'];
    const SEASONS_NORTH = ['Winter', 'Winter', 'Spring', 'Spring', 'Spring', 'Summer',
                           'Summer', 'Summer', 'Autumn', 'Autumn', 'Autumn', 'Winter'];

    /**
     * Summer-intent profiles for an overseeded (cool-season grass oversown on
     * a warm-season base) sward. Source: nutrition-summary-integration.js
     * v1.1.3 NUTRITION_CONFIG.summerIntentProfiles, via
     * nutrition-requirement-engine.js. Decision 3: unchanged.
     */
    const SUMMER_INTENT_PROFILES = {
        transition: { summerC3: 0.10, transitionC3: 0.40, winterC3: 0.90 },
        maintain:   { summerC3: 0.35, transitionC3: 0.60, winterC3: 0.90 },
        establish:  { summerC3: 0.05, transitionC3: 0.30, winterC3: 0.85 },
        dormant:    { summerC3: 0.10, transitionC3: 0.50, winterC3: 0.95 }
    };

    const DISTRIBUTION_MODES = ['gp_weighted', 'even', 'front_loaded'];

    const MODE_LABELS = {
        gp_weighted: 'GP-Weighted',
        even: 'Even',
        front_loaded: 'Front-loaded'
    };

    // ==========================================================================
    // Month-index conversion — the 0-11 / 1-12 boundary, in one place
    // ==========================================================================

    /** { 1..12: v } -> [v(Jan) .. v(Dec)]. Returns null if any month is absent. */
    function fromMonthMap(map) {
        if (!map) return null;
        const out = new Array(12);
        for (let m = 1; m <= 12; m++) {
            if (map[m] === undefined || map[m] === null) return null;
            out[m - 1] = map[m];
        }
        return out;
    }

    /** [v(Jan) .. v(Dec)] -> { 1..12: v }. */
    function toMonthMap(arr) {
        if (!arr) return null;
        const out = {};
        for (let m = 0; m < 12; m++) out[m + 1] = arr[m];
        return out;
    }

    /**
     * No default hemisphere here on purpose. nutrition-calendar.js has always
     * read an absent hemisphere as northern (`inputs.hemisphere === 'south'`)
     * and nutrition-requirement-engine.js as southern (`climate.hemisphere ||
     * 'south'`); the engine's default is applied at its own call site, where
     * it belongs, so this function is the pure lookup both share.
     */
    function isSouth(hemisphere) {
        return String(hemisphere || '').toLowerCase().indexOf('south') !== -1;
    }

    function seasonFor(monthIndex, hemisphere) {
        return (isSouth(hemisphere) ? SEASONS_SOUTH : SEASONS_NORTH)[monthIndex];
    }

    function seasons(hemisphere) {
        return (isSouth(hemisphere) ? SEASONS_SOUTH : SEASONS_NORTH).slice();
    }

    // ==========================================================================
    // Growth potential
    // ==========================================================================

    /**
     * Per-month C3 fraction, 0-11.
     *
     * Not overseeded: a constant 1 (pure C3) or 0 (pure C4) for all twelve
     * months — which is what BOTH surfaces did for a non-overseeded sward, and
     * what the Plan page did for every sward.
     *
     * Overseeded: the C3 share moves through the year by season, from the
     * summer-intent profile. A warm-season base carries summer and the oversown
     * ryegrass carries winter; a single whole-year boolean describes turf that
     * does not exist. Decision 3.
     *
     * The `isOverseed && !baseIsC4` guard lives HERE, not at the call sites: a
     * C3 oversow on a C3 base is not a blend of anything, so no seasonal split
     * is meaningful and the fraction stays flat at 1. Both callers used to
     * apply that rule themselves — nutrition-requirement-engine.js as
     * `effectiveOverseed`, nutrition-calendar.js in its own guard — which is
     * one rule written twice, the shape of every defect this stage exists to
     * close.
     */
    function monthlyC3Fractions(overseedConfig, hemisphere) {
        const cfg = overseedConfig || {};
        const out = new Array(12);
        if (!cfg.isOverseed || !cfg.baseIsC4) {
            const fraction = cfg.baseIsC4 ? 0 : 1;
            for (let m = 0; m < 12; m++) out[m] = fraction;
            return out;
        }
        const profile = SUMMER_INTENT_PROFILES[cfg.summerIntent] || SUMMER_INTENT_PROFILES.transition;
        for (let m = 0; m < 12; m++) {
            const season = seasonFor(m, hemisphere);
            if      (season === 'Winter') out[m] = profile.winterC3;
            else if (season === 'Summer') out[m] = profile.summerC3;
            else                          out[m] = profile.transitionC3;
        }
        return out;
    }

    function _gpEngine() {
        return (typeof global !== 'undefined' && global.GilbaGrowthPotentialEngine) ||
            (typeof window !== 'undefined' && window.GilbaGrowthPotentialEngine) || null;
    }

    /**
     * monthlyGP(monthlyTemps, c3Fractions, opts) -> number[12] | null
     *
     * `monthlyTemps` is anything indexable 0-11 (the calendar's array, or a
     * 0-11 map). Use fromMonthMap() first for a 1-12 series.
     *
     * GH-245: a missing or non-numeric month returns null for the whole series
     * rather than defaulting to 15 degC — that default silently printed a flat
     * ~66% GP profile for every site with no climate data (Hoxton audit
     * D02/D03). Values are RAW (decision 2); callers round at display.
     *
     * `opts.gpEngineUnavailable` decides what a MISSING GilbaGrowthPotential
     * Engine means, because the two callers genuinely differ and this ticket
     * did not settle it:
     *   'null'  (default) — the whole series is null, which the Word export
     *                       surfaces as climateDataUnavailable rather than
     *                       printing a fabricated table.
     *   'zeros' — twelve zeros, which nutrition-calendar.js has always
     *                       produced (its calculateGP() returns 0 with no
     *                       engine) and which its own dormancy fallback then
     *                       turns into an even split. Preserved so this ticket
     *                       moves no number; it is a load-order failure that
     *                       cannot occur in the browser, since every page that
     *                       loads the calendar also loads the GP engine.
     */
    function monthlyGP(monthlyTemps, c3Fractions, opts) {
        if (!monthlyTemps) return null;
        // `typeof !== 'number'` exactly, not isFinite: both callers used this
        // test, and a NaN month reaches GilbaGrowthPotentialEngine, is rejected
        // by its own validity check and scores 0 for that month. Tightening it
        // here would turn a single bad reading into a null series and a crash
        // one call deeper.
        for (let m = 0; m < 12; m++) {
            if (typeof monthlyTemps[m] !== 'number') return null;
        }
        const GP = _gpEngine();
        if (!GP || typeof GP.compute !== 'function') {
            return (opts && opts.gpEngineUnavailable === 'zeros') ? new Array(12).fill(0) : null;
        }
        const out = new Array(12);
        for (let m = 0; m < 12; m++) {
            const frac = c3Fractions ? (c3Fractions[m] != null ? c3Fractions[m] : 1) : 1;
            const gp = GP.compute(monthlyTemps[m], { model: 'pace', species: 'blend', c3Fraction: frac });
            out[m] = (gp != null) ? gp : 0;
        }
        return out;
    }

    // ==========================================================================
    // Distribution
    // ==========================================================================

    function normalizeMode(mode) {
        const m = String(mode || '').trim().toLowerCase().replace(/[\s-]+/g, '_');
        return DISTRIBUTION_MODES.indexOf(m) !== -1 ? m : 'gp_weighted';
    }

    function modeLabel(mode) {
        return MODE_LABELS[normalizeMode(mode)];
    }

    /**
     * distribute(annualAmount, gp, mode) -> number[12], RAW (unrounded).
     *
     * `gp` is indexable 0-11. Deliberately NOT null-guarded: GH-354's
     * regression test pins that a null GP series throws here rather than
     * silently producing a programme, and computeProgram() checks the
     * temperature series for completeness before it ever gets this far.
     *
     * gp_weighted — each active month (GP >= 0.10) takes its share of the
     *               total GP of the active months. If every month is dormant,
     *               fall back to an even split so some programme still exists.
     * even        — a twelfth each.
     * front_loaded— CARRIED ACROSS UNCHANGED FROM nutrition-calendar.js,
     *               INCLUDING TWO KNOWN DEFECTS, by decision 6:
     *                 (a) it does not conserve the annual total. Each active
     *                     month gets total/10 and months 8-10 are then
     *                     multiplied by 1.5, so the year sums to
     *                     (activeMonths + 1.5) / 10 of the target — 312.5
     *                     against a stated 250 on a twelve-active-month
     *                     southern series, 200 on a shorter northern one —
     *                     while annual_totals still prints the target.
     *                 (b) months 8, 9, 10 are September-November, i.e.
     *                     southern spring, hard-coded; on a northern site the
     *                     boost lands in autumn.
     *               No site uses this mode (all ten dev sites are
     *               gp_weighted). The user deferred it explicitly rather than
     *               have it normalised as a side effect of unification, since
     *               either repair — rescale to the target, or hemisphere-aware
     *               boost months — changes what a user who picks it gets.
     */
    function distribute(annualAmount, gp, mode) {
        const method = normalizeMode(mode);
        const out = new Array(12);

        if (method === 'even') {
            const monthly = annualAmount / 12;
            for (let m = 0; m < 12; m++) out[m] = monthly;
            return out;
        }

        if (method === 'front_loaded') {
            for (let m = 0; m < 12; m++) {
                const v = gp[m] || 0;
                out[m] = v >= MIN_GP_THRESHOLD ? annualAmount / 10 : 0;
            }
            [8, 9, 10].forEach(function (m) { out[m] *= 1.5; });
            return out;
        }

        let totalGP = 0;
        for (let m = 0; m < 12; m++) {
            if (gp[m] >= MIN_GP_THRESHOLD) totalGP += gp[m];
        }
        if (totalGP === 0) {
            const monthly = annualAmount / 12;
            for (let m = 0; m < 12; m++) out[m] = monthly;
            return out;
        }
        for (let m = 0; m < 12; m++) {
            out[m] = (gp[m] >= MIN_GP_THRESHOLD) ? annualAmount * (gp[m] / totalGP) : 0;
        }
        return out;
    }

    /**
     * Apply the monthly N cap with overflow redistribution.
     *
     * Moved here from nutrition-calendar.js unchanged (GH-398): the Word
     * export used to print an uncapped series for a site whose Plan programme
     * was clamped. Federal Golf's stored programme is
     * [15, 15, 15, 12.7, 9.9, 0, 0, 0, 10.1, 12.3, 15, 15] — five months at
     * the cap, annual total 120 preserved by redistribution — against an
     * unclamped peak of ~19 in the document for the same site.
     *
     * null / undefined / 0 / '' / NaN -> "no cap" (Infinity).
     * Overflow is redistributed into months that already carry a non-zero
     * allocation (dormant months are never eligible). If the cap is too low to
     * absorb the overflow, the remainder is reported as `unschedulable` — the
     * months then sum to less than the annual target, which is a real outcome
     * both surfaces must state rather than hide.
     */
    function applyNCap(allocations, maxN) {
        const cap = (typeof maxN === 'number' && isFinite(maxN) && maxN > 0) ? maxN : Infinity;

        const result = {};
        let originalTotal = 0;
        let overflow = 0;

        for (let m = 0; m < 12; m++) {
            const alloc = allocations[m] || 0;
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
                    if ((allocations[m] || 0) > 0 && headroom > 0.001) {
                        eligible.push({ m: m, headroom: headroom });
                        totalHeadroom += headroom;
                    }
                }
                if (totalHeadroom < 0.001) break;
                const toPlace = Math.min(remaining, totalHeadroom);
                for (const e of eligible) {
                    result[e.m] = Math.min(cap, result[e.m] + toPlace * (e.headroom / totalHeadroom));
                }
                redistributed += toPlace;
                remaining -= toPlace;
            }
            unschedulable = Math.max(0, remaining);
        }

        const scheduledTotal = Object.values(result).reduce(function (s, v) { return s + v; }, 0);

        return {
            allocations: result,
            capApplied: overflow > 0.001,
            maxNPerMonth: (cap === Infinity) ? null : cap,
            redistributed: Math.round(redistributed * 10) / 10,
            unschedulable: Math.round(unschedulable * 10) / 10,
            originalTotal: Math.round(originalTotal * 10) / 10,
            scheduledTotal: Math.round(scheduledTotal * 10) / 10
        };
    }

    /**
     * distributeProgram({ annualAmounts, gp, mode, maxNPerMonth })
     *   -> { distributions: { <nutrient>: number[12] }, nCap, mode }
     *
     * The single entry point both surfaces call. Every nutrient in
     * `annualAmounts` goes through the same weighting (decision 4); the cap is
     * applied to N only, because it is a "max N per application" limit and no
     * other nutrient has one. Values are RAW — round at display.
     */
    function distributeProgram(args) {
        args = args || {};
        const amounts = args.annualAmounts || {};
        const mode = normalizeMode(args.mode);
        const distributions = {};
        Object.keys(amounts).forEach(function (nutrient) {
            distributions[nutrient] = distribute(amounts[nutrient], args.gp, mode);
        });
        let nCap = null;
        if (distributions.N) {
            nCap = applyNCap(distributions.N, args.maxNPerMonth);
            distributions.N = nCap.allocations;
        }
        return { distributions: distributions, nCap: nCap, mode: mode };
    }

    const API = {
        VERSION: VERSION,
        MIN_GP_THRESHOLD: MIN_GP_THRESHOLD,
        MONTH_NAMES: MONTH_NAMES,
        SEASONS_SOUTH: SEASONS_SOUTH,
        SEASONS_NORTH: SEASONS_NORTH,
        SUMMER_INTENT_PROFILES: SUMMER_INTENT_PROFILES,
        DISTRIBUTION_MODES: DISTRIBUTION_MODES,
        fromMonthMap: fromMonthMap,
        toMonthMap: toMonthMap,
        seasonFor: seasonFor,
        seasons: seasons,
        monthlyC3Fractions: monthlyC3Fractions,
        monthlyGP: monthlyGP,
        normalizeMode: normalizeMode,
        modeLabel: modeLabel,
        distribute: distribute,
        applyNCap: applyNCap,
        distributeProgram: distributeProgram
    };

    if (typeof window !== 'undefined') {
        window.GAIP_NutritionMonthlyDistribution = API;
    }
    if (typeof module !== 'undefined' && module.exports) {
        module.exports = API;
    }
})(typeof window !== 'undefined' ? window : (typeof globalThis !== 'undefined' ? globalThis : this));

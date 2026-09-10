/**
 * Gilba — shared product-delivery accumulator ("how much of each nutrient do
 * the chosen products actually supply").
 *
 * GH-399. The delivery half of the nutrition calculation, as
 * nutrition-requirement-core.js is the requirement half (GH-383…GH-398).
 *
 * WHAT THIS IS. One function over the recommender's monthly application list —
 * the object every surface already holds — producing the per-product rows, the
 * per-nutrient annual totals and the per-application ledger those rows are made
 * of. Its input is the programme, not the site: no adapter, no site state, no
 * catalogue lookup (every application carries its own `analysis`).
 *
 * WHY IT EXISTS. Five hand-maintained accumulators computed this same quantity
 * and disagreed:
 *
 *   A1  nutrition-prebble-integration.js       NZ Plan totals — recomputed
 *                                              rate x splitCount x analysis
 *   B2  nutrition-au-fertiliser-integration.js AU Plan product rows — sum of
 *                                              the declared `delivers` vectors
 *   B3  nutrition-uk-fertiliser-integration.js UK Plan product rows — the same
 *   C   word-export-combined.js                per-sample export — declared
 *                                              `delivers` ONLY when > 0, else
 *                                              analysis x rate, and blind to
 *                                              splitCount / applications
 *   E   word-export.js _extractEntryNutrients  export rows — topped P up from
 *                                              analysis whenever the entry's
 *                                              P was zero
 *
 * The visible symptom was phosphorus on the SLAN fixture ("New test - location"
 * / Putter Green): the Plan printed Delivered P 14.0 and the document 14.5, so
 * one verdict rendered as -7% on one surface and -5% on the other. The 0.5 kg
 * is two liquid sprays whose `delivers.P` the AU recommender declares as a hard
 * zero while their analysis carries 1.7% and 2% P. C's `fromDelivers > 0`
 * guard read that declared zero as "absent" and substituted the analysis
 * figure; E did the same one level down, which is why the single-sample
 * document's own Annual Product Summary rows and its ANR Delivered column
 * disagreed with each other.
 *
 * THE RULE, and why it is this one:
 *
 *   nutrients[n] = the recommender's declared `delivers[n]` WHERE IT DECLARES
 *                  ONE, and the physical content (mass x analysis) where it
 *                  does not.
 *
 * A DECLARED ZERO IS A ZERO. That is the whole defect: `> 0` is not a test for
 * "was a value declared". The declaration is also the quantity the recommender
 * paces itself against (`netP`, the GH-342/343 caps, `balance`), so printing a
 * different number beside its own Balance column would re-open GH-391's
 * "over-delivery reported as on-target" in reverse.
 *
 * And it must be the declaration, not the physical content, because a
 * slow-release product is LISTED in every month it covers while declaring only
 * that month's share of its content (the UK recommender's `rate x pct /
 * monthsCovered`, nutrition-uk-fertiliser-integration.js). Summing physical
 * content over the listed applications would triple-count it — on Test6 - UK
 * that is 294.5 kg N against a true 199.8. Whether the UK model should list a
 * covered month at all is a recommender question (PLAN-delivery-unification.md
 * finding F-2), and this module must not answer it by accident.
 *
 * Where nothing is declared, physical is the only answer available and is what
 * the NZ path always did: the Prebble recommender stamps no `delivers` vector
 * at all, so all six keys come from rate x count x analysis, exactly as A1.
 *
 * MASS is `rate x (splitCount ?? applications ?? 1)` — C ignored the count
 * entirely, which is how a "x 2" in the schedule became one bag in the
 * purchasing summary.
 *
 * GH-401 removed the `liquidVolume: 'per-month'` escape hatch GH-399 shipped
 * with. Until then a liquid sprayed four times in one month contributed ONE
 * spray's volume to "Total Rate" and counted as ONE application, on both
 * surfaces — while the Monthly Schedule beside it printed "4x 7 L/ha" and the
 * client ordered fertiliser off the under-stated column. `applications` is the
 * Australian recommender's word for that count (`splitCount` is the New
 * Zealand one), and both are now honoured, as the New Zealand path always
 * honoured its own. Nutrient totals do not move with it: an Australian liquid
 * DECLARES its `delivers` vector for all of its applications together, so only
 * the volume and the count were ever short.
 *
 * NOT ROUNDED. Anywhere — `roundAtOutput()` below is offered TO callers and is
 * never applied inside `accumulate()`. Rounding an intermediate here would
 * re-create by hand, in three renderers, the artefact this module exists to
 * remove.
 *
 * GH-403 added `formatDelivered()` beside it: the PRECISION every Annual Product
 * Summary nutrient cell prints at, row and caption alike, so that a caption can
 * never again read 126 above rows reading 113 + 7 + 5. Same rule as
 * roundAtOutput(), stated once instead of in four renderers — see its own
 * docblock for why the rows gained the decimal rather than the caption giving up
 * the true total.
 *
 * AMENDMENTS. Entries flagged `_isAmendment` (the export's soil-deficit and
 * K-reconciliation additions) stay in `applications` and `products` — the
 * document renders them — and are excluded from `totals`, which is what
 * "programme delivery" has meant since b35fix322 and what word-export.js's
 * `_computeProgrammeDelivered` skip already assumed.
 *
 * KNOWN, DELIBERATE GAP. When the NZ recommender's Phase-3 surplus reduction
 * fires it rounds each product's `nutrients` to 1 dp and each month's rate to a
 * whole kg (prebbles-products.js), so this module's `monthly`-derived totals
 * can differ from `program.meta.annualPlan.delivered` by up to ~0.15 kg per
 * product. `monthly` wins: it is what the Monthly Schedule prints and what the
 * client applies. It has not fired on any development site.
 *
 * Pure: no DOM, no `window` reads, no globals, no I/O beyond one
 * console.error for a malformed entry.
 *
 * @package Gilba_Hub
 */

(function (root) {
    'use strict';

    var CONFIG = { version: '1.2.0-gh403' };

    /** The six keys every surface accounts for. Fe and the micros are not
     *  part of any printed "delivered" total and are left to the renderers'
     *  own analysis reads. */
    var NUTRIENTS = ['N', 'P', 'K', 'Ca', 'Mg', 'S'];

    function _num(v) {
        var n = parseFloat(v);
        return isFinite(n) ? n : 0;
    }

    function _zeroVector() {
        return { N: 0, P: 0, K: 0, Ca: 0, Mg: 0, S: 0 };
    }

    /**
     * Is `delivers[n]` a declaration? A finite number is — INCLUDING ZERO.
     * Anything else (undefined, null, NaN, a string) is an absent declaration
     * and falls through to the physical content.
     */
    function _isDeclared(delivers, nutrient) {
        if (!delivers || typeof delivers !== 'object') return false;
        var v = delivers[nutrient];
        return typeof v === 'number' && isFinite(v);
    }

    /**
     * How many times this application is applied within its month.
     *
     * Two recommenders, two words for one thing: `splitCount` is the New
     * Zealand recommender's, `applications` the Australian one's ("4x 7 L/ha"
     * in the Monthly Schedule). GH-401: both count. Before it, `applications`
     * was ignored unless the caller asked for `liquidVolume: 'total'`, and no
     * caller ever did, so a four-spray month was purchased as one spray.
     */
    function _count(entry) {
        if (typeof entry.splitCount === 'number' && isFinite(entry.splitCount) && entry.splitCount > 0) {
            return entry.splitCount;
        }
        if (typeof entry.applications === 'number' && isFinite(entry.applications) && entry.applications > 0) {
            return entry.applications;
        }
        return 1;
    }

    /**
     * GH-401 — the ONE rounding step a renderer applies to a figure that came
     * out of this module, and the only rounding this file contains.
     *
     * Why it lives here rather than in each renderer: all three regional
     * integrations used to round a total to 1 dp for the Nutrient Delivery
     * Summary and then round THAT to a whole number for the panel's caption,
     * so a true total anywhere in [n + 0.45, n + 0.5) printed as n + 1 — the
     * caption disagreeing with its own rows for no reason a reader could see.
     * Rounding once, from the raw sum, is the fix; having one implementation of
     * it is what stops the artefact being reintroduced by hand in the fourth
     * renderer.
     *
     * THE 1e-9 SNAP IS A POLICY, NOT ARITHMETIC, so it is stated rather than
     * hidden. These totals are sums of ten to thirty doubles, and a sum whose
     * exact decimal value is n + 0.5 lands on either side of it depending only
     * on the order the applications happened to be added: New test - location's
     * potassium is 48.3 + 29.8 + 12.5 + 1.1 + 2.8 + 10, which is 104.5 exactly
     * in decimal and 104.49999999999999 in binary. Without the snap that
     * printed 104 while the panel's own rows printed 48 + 30 + 13 + 1 + 3 + 10
     * = 105 and its Delivered column printed 104.5 — three figures disagreeing
     * in one panel, which is worse than the artefact being removed. With it,
     * an exact half rounds the way `Math.round` rounds every other figure the
     * product prints, and a genuine 104.46 still prints 104. The snap is the
     * same sign for negative values for exactly that reason: this helper is
     * "`Math.round` of the value's own decimal reading", not a new rounding
     * rule. It is ~1e-4 of the smallest quantity ever printed here and far
     * larger than the ~1e-13 of representation error it exists to absorb.
     *
     * @param {number} value
     * @param {number} [decimals=0]
     * @returns {number}
     */
    function roundAtOutput(value, decimals) {
        var v = parseFloat(value);
        if (!isFinite(v)) return 0;
        var dp = (typeof decimals === 'number' && isFinite(decimals) && decimals > 0) ? Math.floor(decimals) : 0;
        var f = Math.pow(10, dp);
        return Math.round(v * f + 1e-9) / f;
    }

    /**
     * GH-403 — the precision every Annual Product Summary nutrient cell prints
     * at, row and caption alike, so that the caption is the sum of the rows
     * above it as printed.
     *
     * THE DEFECT. Burns' caption read 126 kg N above rows reading 113 + 7 + 5 =
     * 125. Both figures were "correct": the true total is 125.5, so rounding it
     * once gives 126, while rounding each row once and adding gives 125. On one
     * page they are a contradiction, and the client reads them on one page.
     *
     * WHY NOT MAKE THE CAPTION THE SUM OF THE ROUNDED ROWS. Because that
     * caption would then be wrong in the other direction, and measurably so:
     * on Test6 - UK six potassium rows all round up, and the sum of the printed
     * rows is 127 against a true 125.4 — a caption 1.6 kg above the programme's
     * actual delivery, sitting in the same document as an Annual Nutrient
     * Requirements table that prints 125.4 for the same quantity. Test6's
     * phosphorus is 29 against 27.8, Westview's potassium 155 against 154.1.
     * Rounding-up bias accumulates with the number of rows; the true total does
     * not.
     *
     * SO THE ROWS GAIN THE DECIMAL INSTEAD. At 0.1 kg/ha the rows add up to the
     * caption exactly on every development site — every recommender declares
     * its `delivers` vectors at 1 dp — and the figure now matches the Nutrient
     * Delivery Summary's own Delivered column and the document's Annual
     * Nutrient Requirements table, which have both printed 1 dp all along.
     * Three tables, one number, instead of three roundings of it.
     *
     * @param {number} value  kg/ha
     * @returns {string}
     */
    var DELIVERED_DP = 1;
    function formatDelivered(value) {
        return roundAtOutput(value, DELIVERED_DP).toFixed(DELIVERED_DP);
    }

    /**
     * The rate of one application. Granular and UK/AU solubles carry kg/ha in
     * `rateKgHa`; AU/UK liquids carry L/ha in `rateLHa`; AU solubles carry
     * kg/ha in `rateLHa` (the b35fix282 catalogue convention), which is why the
     * UNIT decision below branches on `form`, never on which array the entry
     * came from.
     */
    function _rate(entry) {
        var kg = _num(entry.rateKgHa);
        if (kg) return kg;
        return _num(entry.rateLHa);
    }

    /**
     * Accumulate a recommender's monthly application list.
     *
     * GH-401: takes no options. The one it had (`liquidVolume`) existed to keep
     * the pre-GH-401 under-count of multi-spray liquids available while that
     * decision was open; it is settled, so the alternative is gone rather than
     * left as a switch nobody sets.
     *
     * @param {Array}  monthly  program.monthly — twelve months, each with
     *                          `granular` and `liquid` arrays.
     * @returns {{applications: Array, products: Object, totals: Object}}
     */
    function accumulate(monthly) {
        var out = { applications: [], products: {}, totals: _zeroVector() };
        if (!Array.isArray(monthly)) return out;

        monthly.forEach(function (m, monthIndex) {
            if (!m || typeof m !== 'object') return;
            [
                { list: m.granular, fromLiquidArray: false },
                { list: m.liquid, fromLiquidArray: true }
            ].forEach(function (bucket) {
                if (!Array.isArray(bucket.list)) return;
                bucket.list.forEach(function (entry) {
                    if (!entry || typeof entry !== 'object') return;
                    var id = entry.id || entry.name;
                    if (!id) {
                        console.error('[NutritionDelivery] application with neither id nor name in month ' +
                            (m.month || monthIndex) + ' — skipped');
                        return;
                    }

                    var rate = _rate(entry);
                    var count = _count(entry);
                    var mass = rate * count;
                    var analysis = entry.analysis || (entry.product && entry.product.analysis) || {};
                    var delivers = entry.delivers;

                    var nutrients = _zeroVector();
                    var source = {};
                    NUTRIENTS.forEach(function (n) {
                        if (_isDeclared(delivers, n)) {
                            nutrients[n] = delivers[n];
                            source[n] = 'declared';
                        } else {
                            nutrients[n] = mass * _num(analysis[n]) / 100;
                            source[n] = 'analysis';
                        }
                    });

                    // Two separate questions, deliberately not collapsed.
                    //
                    // `isLiquid` is the FLAG the renderers read, and it keeps
                    // the NZ annual summary's rule exactly (form liquid or
                    // soluble, or a rate expressed in L/ha) — the NZ Plan row
                    // prints "L/ha" off it for the Sportsmaster WSF solubles
                    // today, and this ticket moves no printed figure.
                    //
                    // The UNIT BUCKET below is the other question, and it
                    // branches on `form` alone: b35fix282, an AU soluble is a
                    // powder listed in the liquid column carrying kg/ha in
                    // `rateLHa`, so its mass belongs in `totalKgHa` however it
                    // was listed.
                    var isSoluble = entry.form === 'soluble';
                    var isLiquid = bucket.fromLiquidArray || isSoluble ||
                        entry.form === 'liquid' || !!entry.rateLHa;
                    var isAmendment = !!entry._isAmendment;
                    var isBalancing = !!entry.isBalancing;

                    out.applications.push({
                        monthIndex: monthIndex,
                        month: m.month || m.month_name || null,
                        id: id,
                        name: entry.name || null,
                        form: entry.form || null,
                        isLiquid: isLiquid,
                        isSoluble: isSoluble,
                        rate: rate,
                        count: count,
                        mass: mass,
                        rateUnit: entry.rateUnit || (isLiquid ? 'L/ha' : 'kg/ha'),
                        nutrients: nutrients,
                        source: source,
                        isBalancing: isBalancing,
                        isAmendment: isAmendment
                    });

                    var p = out.products[id];
                    if (!p) {
                        // The NZ recommender names its precision-balancing
                        // top-ups after the base product and distinguishes them
                        // only by an `isBalancing` flag and an `-BAL` id; its
                        // own annual summary appends " (Balance)" to the label,
                        // and both the Plan row and the parity harness's
                        // rendered-name match depend on that text.
                        var label = (entry.name || String(id)) + (isBalancing ? ' (Balance)' : '');
                        p = out.products[id] = {
                            id: id,
                            name: label,
                            label: label,
                            rawName: entry.name || null,
                            product: entry,
                            brandName: entry.brand || null,
                            form: entry.form || null,
                            isLiquid: isLiquid,
                            isSoluble: isSoluble,
                            // The NZ annual summary defaults a balancing entry's
                            // release to 'quick', which its renderer prints with
                            // no tag at all; everything else defaults to
                            // 'standard', which prints "(QR)".
                            release: entry.release || (isBalancing ? 'quick' : 'standard'),
                            releaseTech: entry.releaseTech || 'standard',
                            analysis: analysis,
                            applications: 0,
                            totalKgHa: 0,
                            totalLHa: 0,
                            totalKg: 0,
                            nutrients: _zeroVector(),
                            rateReduced: false,
                            isBalancing: isBalancing,
                            isAmendment: isAmendment
                        };
                        if (isAmendment) p._isAmendment = true;
                    }

                    p.applications += count;
                    p.totalKg += mass;
                    if (isLiquid && !isSoluble) p.totalLHa += mass; else p.totalKgHa += mass;
                    if (entry.rateReduced) p.rateReduced = true;
                    NUTRIENTS.forEach(function (n) { p.nutrients[n] += nutrients[n]; });
                });
            });
        });

        Object.keys(out.products).forEach(function (id) {
            var p = out.products[id];
            // The renderers read one of two names for the same vector:
            // `nutrients` (the NZ annual summary's word, and what
            // _extractEntryNutrients prefers for N/P/K) and `totalDelivered`
            // (the AU/UK word, and what it prefers for S/Ca/Mg). Publish both,
            // equal by construction, so no consumer has to choose.
            p.totalDelivered = {
                N: p.nutrients.N, P: p.nutrients.P, K: p.nutrients.K,
                Ca: p.nutrients.Ca, Mg: p.nutrients.Mg, S: p.nutrients.S
            };
            if (p.isAmendment) return;   // catalogue-only, by definition
            NUTRIENTS.forEach(function (n) { out.totals[n] += p.nutrients[n]; });
        });

        return out;
    }

    /** Catalogue-only view of `accumulate().products` — what a programme's own
     *  Annual Product Summary is built from before the export merges any
     *  amendment into it. */
    function catalogueProducts(products) {
        var out = {};
        Object.keys(products || {}).forEach(function (id) {
            if (products[id] && products[id].isAmendment) return;
            out[id] = products[id];
        });
        return out;
    }

    var API = {
        accumulate: accumulate,
        catalogueProducts: catalogueProducts,
        roundAtOutput: roundAtOutput,
        formatDelivered: formatDelivered,
        DELIVERED_DP: DELIVERED_DP,
        NUTRIENTS: NUTRIENTS,
        CONFIG: CONFIG
    };

    if (typeof window !== 'undefined') {
        window.GAIP_NutritionDelivery = API;
    }
    if (typeof module !== 'undefined' && module.exports) {
        module.exports = API;
    }
})(typeof window !== 'undefined' ? window : (typeof globalThis !== 'undefined' ? globalThis : this));

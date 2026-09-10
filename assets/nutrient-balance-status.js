/**
 * Gilba — shared nutrient Balance / Status classifier.
 *
 * GH-396. One implementation of the Plan page's "Nutrient Delivery Summary"
 * verdict, so the Plan page and the Word export cannot describe the same
 * sample in different words.
 *
 * WHAT THIS IS. The model GH-312 settled on, unchanged: Balance is the
 * PROJECTED SOIL LEVEL at season end,
 *
 *     Balance = Current + Delivered - Removal
 *
 * judged against the sufficiency range (floor / ceiling). Removal, not
 * Required, is what is subtracted: Required already bakes Current into itself
 * through the Lift term for below-floor nutrients, so subtracting Required
 * would count Current twice. Removal is the physical uptake figure, true
 * regardless of floor / ceiling status. Sources are the ones GH-312 verified
 * and cited on the Plan page: Woods (2013) "A Method for Estimating Turfgrass
 * Nutrient Requirements" (F = target + Harvest - Soiltest, inverted here to
 * predict the end-of-season level) and Carrow et al. (2004), GCM 72(1):194-198
 * for the two-sided sufficiency range.
 *
 * It is NOT the export's K-reconciliation quantity (Delivered - Required,
 * "does the N programme's incidental K cover the requirement"). Those two are
 * different questions and both are printed, under different names — see the
 * K Reconciliation table's own "Programme vs required" column.
 *
 * WHY IT MOVED HERE. The identical function lived twice, as a closure inside
 * nutrition-prebble-integration.js (NZ) and nutrition-au-fertiliser-
 * integration.js (AU) — byte-identical apart from comment wording — and the
 * Word export had no copy at all, which is why the exported report showed a
 * subset of the Plan's columns in different units under different names
 * (Hoxton v6 build-order item 4). Three consumers, one implementation.
 *
 * Pure: no DOM, no globals, no rounding policy beyond what the Plan page
 * already printed. Callers pass the numbers their own surface resolved.
 *
 * @package Gilba_Hub
 */

(function (root) {
    'use strict';

    const CONFIG = { version: '1.0.0-gh396' };

    /**
     * ppm -> kg/ha for a soil pool of the given bulk density and depth.
     * The hub's one conversion: kg/ha = ppm x bulkDensity x depthCm x 0.1.
     * (40 ppm x 1.4 x 10 x 0.1 = 56 kg/ha — the very pair of numbers that
     * read as a data divergence before this ticket.)
     */
    function ppmToKgHa(ppm, bulkDensity, soilDepthCm) {
        return ppm * bulkDensity * soilDepthCm * 0.1;
    }

    function round1(v) {
        return Math.round(v * 10) / 10;
    }

    /**
     * Classify one nutrient row.
     *
     * @param {Object} o
     * @param {string} o.nutrient          'N' | 'P' | 'K' | ...
     * @param {number} o.required          kg/ha/yr, the Required column
     * @param {number} o.delivered         kg/ha/yr, the Delivered column
     * @param {number} [o.currentPpm]      soil reading, ppm
     * @param {number} [o.removal]         kg/ha/yr clipping uptake
     * @param {Object} [o.range]           {min, max} in ppm
     * @param {number} [o.bulkDensity]     g/cm3
     * @param {number} [o.soilDepth]       cm
     * @param {boolean} [o.missingSoilData] no real soil reading for this nutrient
     * @returns {{currentDisplay: string, rangeDisplay: string, diff: number,
     *            statusClass: string, statusLabel: string, canCompute: boolean,
     *            currentPpm: (number|null), currentKgHa: (number|null),
     *            floorKgHa: (number|null), ceilingKgHa: (number|null)}}
     */
    function classify(o) {
        o = o || {};
        const nutrient = o.nutrient;
        const required = o.required;
        const delivered = o.delivered;
        const missingSoilData = !!o.missingSoilData;
        const range = o.range;
        const currentPpm = o.currentPpm;
        const removal = o.removal;
        const soilBulkDensity = o.bulkDensity;
        const soilDepthCm = o.soilDepth;

        // Below this line the body is the Plan page's classifyBalance() as it
        // stood at GH-338, moved verbatim — same branches, same order, same
        // labels, same rounding. Only the inputs changed from closure
        // variables to parameters.

        // GH-338: no real soil sample for this nutrient at all --
        // Required is removal-only (no deficit/lift was computable),
        // not a confirmed reading. Say so plainly rather than letting
        // it fall into the pct-based fallback below and look like a
        // real Deficit/On Track verdict.
        if (missingSoilData) {
            return { nutrient, currentDisplay: '—', rangeDisplay: '—', diff: delivered - required, statusClass: 'no-data', statusLabel: 'No Soil Data', canCompute: false, currentPpm: null, currentKgHa: null };
        }
        const canCompute = range && typeof range.max === 'number' && typeof range.min === 'number'
            && typeof currentPpm === 'number' && typeof removal === 'number'
            && typeof soilBulkDensity === 'number' && typeof soilDepthCm === 'number';
        if (!canCompute) {
            // Pre-GH-312 fallback. GH-314: label renamed 'Met' ->
            // 'On Track' to match the pct-based branch just below,
            // same reasoning as the canCompute branch's rename. This is
            // also the branch every N row takes: nitrogen has no soil
            // sufficiency range at all.
            if (required === 0) {
                return { nutrient, currentDisplay: '—', rangeDisplay: '—', diff: delivered - required, statusClass: 'sufficient', statusLabel: 'On Track', canCompute: false, currentPpm: null, currentKgHa: null };
            }
            const pct = Math.round((delivered / required) * 100);
            const statusClass = pct >= 90 ? 'sufficient' : pct >= 70 ? 'marginal' : 'deficit';
            // GH-333 follow-up: was `(${pct}%)` on every tier
            // including On Track -- a completion ratio (100% = fully
            // delivered) inconsistent with the range-based branch
            // below. Confirmed with the user: the number only
            // matters for Monitor/Deficit (how far off target); On
            // Track stays a plain label, no number, same as the
            // range-based branch's On Track.
            const deltaPct = pct - 100;
            const statusLabel = pct >= 90
                ? 'On Track'
                : (pct >= 70 ? 'Monitor' : 'Deficit') + ` (${deltaPct >= 0 ? '+' : ''}${deltaPct}%)`;
            return { nutrient, currentDisplay: '—', rangeDisplay: '—', diff: delivered - required, statusClass, statusLabel, canCompute: false, currentPpm: null, currentKgHa: null };
        }
        const unit = soilBulkDensity * soilDepthCm * 0.1;
        const currentKgHa = currentPpm * unit;
        const floorKgHa = range.min * unit;
        const ceilingKgHa = range.max * unit;
        const balanceKgHa = currentKgHa + delivered - removal;
        const currentDisplay = (Math.round(currentKgHa * 10) / 10).toString();
        // GH-313: shows what Balance is actually being compared against
        // -- previously the Status % implied a floor/ceiling without
        // ever printing it, so there was no way to verify the
        // classification without reading the source.
        const rangeDisplay = `${Math.round(floorKgHa * 10) / 10}–${Math.round(ceilingKgHa * 10) / 10}`;
        if (ceilingKgHa > 0 && balanceKgHa > ceilingKgHa) {
            // GH-333: was statusClass: 'deficit' -- Excess and Deficit
            // shared one class, so both painted the same alarming red,
            // even though Excess (soil already above ceiling, nothing
            // being added) and Deficit (intentionally corrected over
            // several years via Lift, see GH-308/309) are not the same
            // kind of "problem". Split into its own class so it can be
            // coloured distinctly.
            //
            // GH-333 follow-up: was a (${pct}%) suffix computed as
            // Balance/ceiling*100 (e.g. "266%") -- looked far more
            // alarming than the real overshoot, since it expressed
            // the whole Balance as a fraction of the ceiling rather
            // than just the excess itself. Now expresses only the
            // overage (balanceKgHa - ceilingKgHa) as a % of the
            // ceiling.
            const over = Math.round((balanceKgHa - ceilingKgHa) * 10) / 10;
            const overPct = Math.round((over / ceilingKgHa) * 100);
            return { nutrient, currentDisplay, rangeDisplay, diff: balanceKgHa, statusClass: 'excess', statusLabel: `Excess (+${overPct}%)`, canCompute: true, currentPpm, currentKgHa, floorKgHa, ceilingKgHa };
        }
        if (balanceKgHa < floorKgHa) {
            // GH-314: 'Low' renamed to 'Deficit' to share the same
            // vocabulary as the pct-based fallback branch above
            // (On Track / Monitor / Deficit) instead of introducing
            // a second, new set of words for the same idea. GH-333
            // follow-up: same change as the Excess branch above --
            // expresses only the shortfall (floorKgHa - balanceKgHa)
            // as a % of the floor, not the whole Balance as a % of
            // the floor.
            const short = Math.round((floorKgHa - balanceKgHa) * 10) / 10;
            const shortPct = floorKgHa > 0 ? Math.round((short / floorKgHa) * 100) : 0;
            return { nutrient, currentDisplay, rangeDisplay, diff: balanceKgHa, statusClass: 'deficit', statusLabel: `Deficit (-${shortPct}%)`, canCompute: true, currentPpm, currentKgHa, floorKgHa, ceilingKgHa };
        }
        // GH-314: 'Met' renamed to 'On Track', same reasoning --
        // shares the fallback branch's "everything's fine" word
        // instead of a second synonym. GH-333 follow-up: briefly
        // tried a "distance from nearer edge" number here too, but
        // confirmed with the user that On Track should just stay a
        // plain label -- the number only matters once something is
        // actually Deficit or Excess.
        return { nutrient, currentDisplay, rangeDisplay, diff: balanceKgHa, statusClass: 'sufficient', statusLabel: 'On Track', canCompute: true, currentPpm, currentKgHa, floorKgHa, ceilingKgHa };
    }

    /**
     * GH-333/GH-338 colour intent, shared so the Plan's badge and the
     * export's cell colour cannot disagree about what amber means.
     * 'sufficient' -> green, 'excess' -> red (genuinely over-supplied,
     * nothing corrects it automatically), 'no-data' -> neutral grey
     * (genuinely unknown, not a verdict), everything else -> amber (a
     * planned, gradual correction is not a true excess).
     */
    function visualClass(statusClass) {
        if (statusClass === 'sufficient') return 'positive';
        if (statusClass === 'excess') return 'negative';
        if (statusClass === 'no-data') return 'neutral';
        return 'warning';
    }

    /** Word-export hex for the same three intents. */
    const VISUAL_COLOURS = { positive: '16A34A', negative: 'DC2626', neutral: '6B7280', warning: 'D97706' };

    function statusColour(statusClass) {
        return VISUAL_COLOURS[visualClass(statusClass)] || VISUAL_COLOURS.neutral;
    }

    /**
     * GH-403 — the Required half of the pair this module classifies, resolved
     * from a generated programme.
     *
     * WHY IT IS HERE. Required appeared on the Plan page and in the Word
     * document as two different quantities under one column name: the document
     * printed the shared engine's `annualRequirement`, while all three regional
     * panels re-derived it by SUMMING the twelve monthly rows the calendar had
     * already rounded to 1 dp. Those two agree only by luck — measured live,
     * New test - location's phosphorus read 14.0 on the Plan and 14.2 in the
     * document, Federal Golf's potassium 63.9 against 64.0, Burns' phosphorus
     * 14.0 against 14.1.
     *
     * The twelve monthly rows are the SCHEDULE. This is the requirement the
     * schedule delivers, and it is the engine's own figure — the same number,
     * from the same shared core (nutrition-requirement-core.js), that the
     * document's Annual Nutrient Requirements table prints. Rounding it once at
     * output is the renderer's job, not this function's.
     *
     * GH-403 also removed the whole-kilogram rounding nutrition-calendar.js
     * applied to that figure before distributing it, so `annual_totals` is now
     * canonical at 0.1 kg/ha — which is why summing the rounded months can no
     * longer stand in for it even approximately.
     *
     * FALLBACKS, in order, for a programme generated before this ticket and
     * restored from the persisted site config: the recommender's own `targets`
     * vector, then the sum of the monthly requirement rows. Both are the
     * pre-GH-403 behaviour of the panel that is asking, so an old programme
     * renders exactly as it used to rather than blank.
     *
     * @param {Object} program  a regional recommender's programme, with
     *                          `annual_requirements` carried through from
     *                          nutrition-calendar.js's `annual_totals`.
     * @returns {{N:number,P:number,K:number,Ca:number,Mg:number,S:number}}
     */
    function annualRequired(program) {
        const NUTRIENTS = ['N', 'P', 'K', 'Ca', 'Mg', 'S'];
        const out = { N: 0, P: 0, K: 0, Ca: 0, Mg: 0, S: 0 };
        const p = program || {};

        const engine = p.annual_requirements;
        if (engine && typeof engine === 'object') {
            let any = false;
            NUTRIENTS.forEach(function (n) {
                const v = parseFloat(engine[n]);
                if (isFinite(v)) { out[n] = v; any = true; }
            });
            if (any) return out;
        }

        const targets = p.targets;
        if (targets && typeof targets === 'object') {
            let any = false;
            NUTRIENTS.forEach(function (n) {
                const v = parseFloat(targets[n]);
                if (isFinite(v)) { out[n] = v; any = true; }
            });
            if (any) return out;
        }

        (Array.isArray(p.monthly) ? p.monthly : []).forEach(function (m) {
            const req = (m && m.requirements) || {};
            NUTRIENTS.forEach(function (n) {
                const v = parseFloat(req[n]);
                if (isFinite(v)) out[n] += v;
            });
        });
        return out;
    }

    /**
     * GH-396 (a): one soil level, printed once, in both units — kg/ha first
     * because every rate on both surfaces is kg/ha, with the certificate's
     * own ppm in brackets because that is what the client cross-checks the
     * document against. `56 (40 ppm)` under a `Current (kg/ha, ppm)` header.
     */
    function formatCurrent(currentDisplay, currentPpm) {
        if (currentDisplay === '—' || currentDisplay == null) return '—';
        if (typeof currentPpm !== 'number' || isNaN(currentPpm)) return String(currentDisplay);
        return String(currentDisplay) + ' (' + round1(currentPpm) + ' ppm)';
    }

    const API = {
        classify: classify,
        annualRequired: annualRequired,
        visualClass: visualClass,
        statusColour: statusColour,
        formatCurrent: formatCurrent,
        ppmToKgHa: ppmToKgHa,
        VISUAL_COLOURS: VISUAL_COLOURS,
        CONFIG: CONFIG
    };

    if (typeof window !== 'undefined') {
        window.GAIP_NutrientBalanceStatus = API;
    }
    if (typeof module !== 'undefined' && module.exports) {
        module.exports = API;
    }
})(typeof window !== 'undefined' ? window : (typeof globalThis !== 'undefined' ? globalThis : this));

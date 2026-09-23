'use strict';

/**
 * GH-609 — COMPARING WHAT THE ROW STATES WITH WHAT THE SAMPLE MEASURED,
 * AT THE PRECISION THE ROW STATES IT.
 *
 * WHY THIS IS A FILE OF ITS OWN. It used to be four lines inside the live
 * restoration probe, and a live probe can only be exercised by pressing Re-run
 * on the stand — so the one check nobody could run without announcing a press
 * was the check most likely to be wrong. It was: `Number(onScreen) !==
 * Number(measured)` called eight nutrients disagreeing on a site where the row
 * was correct, because the row prints `18.8` and the sample carries `18.84`.
 * `Cu` was the only one that agreed, and only because `2.0 === 2`. That false
 * red opened a queue item for a defect that does not exist.
 *
 * WHAT IT DOES INSTEAD. The row's own text decides the precision: a value
 * printed with one decimal is compared to one decimal, a value printed whole is
 * compared whole. The tolerance is therefore READ OFF THE SURFACE rather than
 * chosen — nothing here picks an epsilon, and a surface that starts printing
 * two decimals tightens the comparison by itself.
 *
 * THE BOUNDARY, and it is real: a genuine disagreement smaller than half the
 * printed precision is invisible to this. That is the price of comparing a
 * rendered number with a measured one at all, and the alternative — comparing
 * the stored row instead of the screen — is a different check, because what the
 * client reads is the screen. A value DROPPED on the way is a separate question
 * and is answered by `droppedBy`, which needs no precision at all.
 */

/** Decimal places in a printed value, as printed. `'240.8'` → 1, `'2'` → 0. */
function printedPrecision(text) {
    const m = /\.(\d+)\s*$/.exec(String(text));
    return m ? m[1].length : 0;
}

/**
 * Nutrients the row and the sample both state, where they disagree ONCE THE
 * MEASURED VALUE IS READ AT THE PRECISION THE ROW PRINTS.
 *
 * @param {Object} rowSurface what the page states, keyed as the sample is
 * @param {Object} readings   what the sample measured, from `readingsOf`
 * @returns {{shared: string[], disagreed: string[], dropped: string[]}}
 */
function judge(rowSurface, readings) {
    const shared = Object.keys(readings || {}).filter((k) => k in (rowSurface || {}));

    const dropped = shared.filter((k) => {
        const a = rowSurface[k];
        return a === '-' || a === '' || a === null || a === undefined;
    });

    const disagreed = shared.filter((k) => {
        if (dropped.indexOf(k) !== -1) return false;
        const shown = Number(rowSurface[k]);
        const measured = Number(readings[k]);
        if (isNaN(shown) || isNaN(measured)) return true;
        const p = printedPrecision(rowSurface[k]);
        return shown.toFixed(p) !== measured.toFixed(p);
    });

    return { shared, disagreed, dropped };
}

module.exports = { judge, printedPrecision };

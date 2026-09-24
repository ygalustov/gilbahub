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
/**
 * @param {Object} rowSurface what the page states, keyed as the sample is
 * @param {Object} readings   what the sample measured, from `readingsOf`
 * @param {Object} [nameMap]  GH-626: what the PRODUCER calls each reading, as
 *        measured rather than written down — `{ Na: {field:'soilNa',
 *        kind:'same'}, EC: {field:'ECe', kind:'derived'} }`. Omitted, the judge
 *        behaves as before and compares by name alone.
 */
function judge(rowSurface, readings, nameMap) {
    const surface = rowSurface || {};
    const measured = readings || {};
    const names = nameMap || {};

    // GH-626 — THE ROW'S OWN NAME FOR A READING, AND WHETHER IT IS THE READING
    // AT ALL.
    //
    // A sample says `Na` and the row says `soilNa`; a sample says `EC` and the
    // row carries `ECe`, which is that reading times a texture factor of five
    // to ten. Comparing by spelling called the first a lost reading and would
    // have called the second a disagreement of sevenfold. Both false, and a
    // judge that cries wolf gets switched off.
    //
    // The correspondence is not stored here. It is measured from the producer
    // — change one reading, run the chain, see which field moved and by how
    // much — and handed in. A name that changes tomorrow is found without
    // anyone remembering; a reading that starts being stored appears by itself.
    const fieldFor = (k) => (names[k] && names[k].field) || k;
    const isDerived = (k) => !!(names[k] && names[k].kind === 'derived');

    // Derived fields are judged on PRESENCE only: the reading was measured, so
    // the derived field must not be empty. Equality is not asked, because the
    // two are different quantities.
    const derived = Object.keys(measured).filter((k) => isDerived(k));

    const shared = Object.keys(measured).filter((k) => !isDerived(k) && fieldFor(k) in surface);

    // GH-617 — WHAT IS MISSING IS COUNTED FROM THE SAMPLE, NOT FROM THE SCREEN.
    //
    // `dropped` used to be a subset of `shared`, and `shared` is the ROW's
    // vocabulary — so a reading the page has no cell for at all fell out of
    // both answers and was named nowhere. Measured: `judge({K:'18.8'},
    // {K:18.84, Zn:5})` returned `{shared:['K'], disagreed:[], dropped:[]}`,
    // and the zinc the lab measured simply vanished. A judge that reports
    // "nothing missing" about a row missing a reading is worse than no judge,
    // because its silence is read as a verdict.
    //
    // AND ITS NAME PROMISED WHAT ITS VALUE DID NOT. The caller states this as
    // `measuredBySampleButNotInTheRow` — measured by the sample and not in the
    // row — while the value was computed by walking what IS in the row. The
    // name is true now, and that is the repair: the question is asked of the
    // sample's readings, and a reading is missing when the row has no cell for
    // it OR the cell it has is empty.
    const dropped = Object.keys(measured).filter((k) => {
        if (isDerived(k)) return false;
        const f = fieldFor(k);
        if (!(f in surface)) return true;
        const a = surface[f];
        return a === '-' || a === '' || a === null || a === undefined;
    });

    const disagreed = shared.filter((k) => {
        if (dropped.indexOf(k) !== -1) return false;
        const f = fieldFor(k);
        const shown = Number(surface[f]);
        const lab = Number(measured[k]);
        if (isNaN(shown) || isNaN(lab)) return true;
        const p = printedPrecision(surface[f]);
        return shown.toFixed(p) !== lab.toFixed(p);
    });

    // A derived field that the row does not state at all is still missing, and
    // says so — presence is the only thing asked of it.
    const derivedMissing = derived.filter((k) => {
        const f = fieldFor(k);
        const a = surface[f];
        return !(f in surface) || a === '-' || a === '' || a === null || a === undefined;
    });

    return { shared, disagreed, dropped, derived, derivedMissing };
}

module.exports = { judge, printedPrecision };

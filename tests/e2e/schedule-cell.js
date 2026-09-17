/**
 * GH-455 — reading a Monthly Schedule product cell.
 *
 * The cell is built by word-export.js from nutrition-delivery-core.js's
 * applicationRate(), and reads:
 *
 *     "Product A @ 8.3 g/m², Product B @ 1.5 g/m² [×2] · Covered by X (Jan)"
 *
 * Two things the parity harness needs from it, and both have to come from the
 * text itself rather than from a number chosen once by hand:
 *
 *   - the RATE, as kilograms per hectare, so a greens document (g/m², the unit
 *     GH-406/GH-409 settled for fine turf) and a fairway document (kg/ha) are
 *     compared as the same quantity;
 *   - the TOLERANCE that rate deserves, which is half of its last printed
 *     digit. A cell printing one decimal of g/m² can be out by 0.05 g/m² for
 *     rounding alone, which is 0.5 kg/ha; a cell printing whole g/m² can be out
 *     by 5 kg/ha; a whole kg/ha figure by 0.5. One constant cannot be right for
 *     all three, and the constant that was here (1 kg/ha) was right only for the
 *     documents the three fixtures happen to produce -- 6.7% of the smallest
 *     rate in the set, and looser than rounding needs on every other row.
 *
 * Anything that does not match the printed form end to end is refused rather
 * than guessed at. The refusal matters: the earlier reader stripped a trailing
 * "[×2]" and let anything else through, so a marker written without brackets
 * ("12.5 g/m² x2") was read as the number 12.52 -- a difference small enough
 * for a loose tolerance to absorb in silence.
 *
 * Kept in its own file so that tests/gh455-schedule-cell.test.js can exercise
 * these two rules directly. The live harness cannot: every rate in the current
 * catalogues prints exactly, so no run of it ever reaches the rounding boundary
 * the tolerance exists for.
 */
'use strict';

/** kg/ha per one unit of the printed quantity. */
const UNIT_TO_KG_HA = { 'kg/ha': 1, 'g/m²': 10 };

/**
 * The finest tolerance each unit's cell may earn, as decimal places: one
 * deeper than the precision the unit is actually printed to.
 *
 * The precision itself comes from the module that prints it --
 * nutrition-delivery-core.js formatRate() rounds g/m² to one decimal and
 * kg/ha to whole numbers -- and the extra place is the room a rate has to be
 * finer than its own unit's rounding without leaving the range anything here
 * actually writes.
 *
 * The cap exists because applicationRate(), which builds the Monthly
 * Schedule's text, writes String(value) with no rounding at all: whatever
 * arithmetic produced the number arrives verbatim. A value carrying the
 * residue of its own binary representation -- "8.300000000000001 g/m²",
 * "1666.67333332 kg/ha" -- would otherwise be read as eight or fifteen
 * decimals of precision and earn a tolerance of 5e-9 or 5e-15, which is
 * narrower than the gap between neighbouring doubles at that magnitude. The
 * last bits of a floating-point number would then be reported as the two
 * surfaces disagreeing: a false red, which costs more than a missed difference
 * of half a printed digit, because it reads as a parity defect and sends the
 * next person looking for a fault that is not there.
 *
 * A cap rather than a test on the digits, because it is one rule instead of a
 * threshold and two branches. A threshold on significant digits stood here
 * first and let through any residue with a short enough written form:
 * 1666.67333332 is twelve significant digits, fewer than a double can carry,
 * and it collapsed the tolerance to 5e-9 just the same.
 */
const MAX_TOLERANCE_DECIMALS = { 'kg/ha': 1, 'g/m²': 2 };

// <number> <unit>, optionally followed by the split marker applicationRate()
// appends ("[×2]") or the UK panel's spelling ("[x2]"). Anchored at both ends:
// a leading count ("4x 7 L/ha", which the AU recommender writes for LIQUIDS),
// a unit this cell should not carry, or any trailing text is not a rate this
// function claims to read.
const PRINTED_RATE = /^([0-9]+(?:\.[0-9]+)?)\s*(kg\/ha|g\/m²)(?:\s*\[[×x]\s*([0-9]+)\]\s*)?$/;

/**
 * One printed rate → { value, unit, decimals, kgHa, tolKgHa, count }, or null
 * when the text is not a rate in the printed form.
 */
function parsePrintedRate(rateText) {
    const m = PRINTED_RATE.exec(String(rateText == null ? '' : rateText).trim());
    if (!m) return null;
    const digits = m[1];
    const unit = m[2];
    const factor = UNIT_TO_KG_HA[unit];
    const dot = digits.indexOf('.');
    const decimals = dot < 0 ? 0 : digits.length - dot - 1;
    const toleranceDecimals = Math.min(decimals, MAX_TOLERANCE_DECIMALS[unit]);
    // Half of the last printed digit, in the printed unit, carried into kg/ha.
    const halfDigit = 0.5 * Math.pow(10, -toleranceDecimals);
    return {
        value: parseFloat(digits),
        unit: unit,
        decimals: decimals,
        toleranceDecimals: toleranceDecimals,
        kgHa: parseFloat(digits) * factor,
        tolKgHa: halfDigit * factor,
        count: m[3] ? parseInt(m[3], 10) : 1
    };
}

/**
 * A whole cell → one entry per product.
 *
 * `rateKgHa` and `tolKgHa` are null on an entry whose rate could not be read;
 * `unreadable` says so, and the caller reports it instead of comparing a
 * number it had to invent.
 */
function scheduleEntries(cell) {
    return String(cell == null ? '' : cell).split(/,\s+/)
        .map((part) => part.split(' · ')[0].trim())
        .map((part) => {
            const at = part.lastIndexOf(' @ ');
            if (at < 0) return null;
            const name = part.slice(0, at).trim();
            const rateText = part.slice(at + 3).trim();
            const rate = parsePrintedRate(rateText);
            return {
                name: name,
                rateText: rateText,
                rateKgHa: rate ? rate.kgHa : null,
                tolKgHa: rate ? rate.tolKgHa : null,
                printedDecimals: rate ? rate.decimals : null,
                unreadable: !rate
            };
        })
        .filter((e) => e && e.name);
}

module.exports = { parsePrintedRate, scheduleEntries, UNIT_TO_KG_HA, MAX_TOLERANCE_DECIMALS };

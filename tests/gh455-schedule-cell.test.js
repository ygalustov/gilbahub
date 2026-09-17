/**
 * GH-455 — the two rules the parity harness reads a Monthly Schedule cell by.
 *
 * Neither can be shown on a live run. Every rate in the AU, NZ and UK
 * catalogues prints exactly at the precision the document uses, so no export
 * this stack can produce puts a rate near the rounding boundary the tolerance
 * exists for; and no recommender currently writes a split marker without
 * brackets, which is the shape the old reader turned into a wrong number in
 * silence. Both are exercised here, on the text itself.
 */
'use strict';

const { parsePrintedRate, scheduleEntries } = require('./e2e/schedule-cell');

describe('GH-455 — the tolerance a printed rate earns', () => {
    test('one decimal of g/m² earns half a printed digit: 0.05 g/m² = 0.5 kg/ha', () => {
        const r = parsePrintedRate('8.3 g/m²');
        expect({ kgHa: r.kgHa, decimals: r.decimals, tolKgHa: r.tolKgHa })
            .toEqual({ kgHa: 83, decimals: 1, tolKgHa: 0.5 });
    });

    test('whole g/m² earns ten times that, because the printed digit is worth ten times as much', () => {
        const r = parsePrintedRate('4 g/m²');
        expect({ kgHa: r.kgHa, decimals: r.decimals, tolKgHa: r.tolKgHa })
            .toEqual({ kgHa: 40, decimals: 0, tolKgHa: 5 });
    });

    test('a floating-point tail earns no more than one place deeper than the unit is printed to', () => {
        // applicationRate() writes String(value) with no rounding, so whatever
        // arithmetic produced the number arrives verbatim -- including the
        // residue of its own binary representation. Half of a fifteenth decimal
        // is 5e-15, narrower than the gap between neighbouring doubles, so the
        // noise itself would be reported as the two surfaces disagreeing.
        const r = parsePrintedRate('8.300000000000001 g/m²');
        expect({ decimals: r.decimals, toleranceDecimals: r.toleranceDecimals, tolKgHa: r.tolKgHa })
            .toEqual({ decimals: 15, toleranceDecimals: 2, tolKgHa: 0.05 });
        const k = parsePrintedRate('193.00000000000003 kg/ha');
        expect({ decimals: k.decimals, toleranceDecimals: k.toleranceDecimals, tolKgHa: k.tolKgHa })
            .toEqual({ decimals: 14, toleranceDecimals: 1, tolKgHa: 0.05 });
    });

    test('a residue with a short written form is capped like any other', () => {
        // Twelve significant digits: fewer than a double can carry, so a rule
        // that asked how many significant digits a number had let this one
        // through and handed it 5e-9. The cap does not ask.
        const r = parsePrintedRate('1666.67333332 kg/ha');
        expect({ decimals: r.decimals, toleranceDecimals: r.toleranceDecimals, tolKgHa: r.tolKgHa })
            .toEqual({ decimals: 8, toleranceDecimals: 1, tolKgHa: 0.05 });
    });

    test('whole kg/ha earns 0.5, and an honestly printed decimal earns 0.05', () => {
        expect(parsePrintedRate('193 kg/ha').tolKgHa).toBe(0.5);
        // One decimal in a kg/ha cell: a number somebody computed and rounded,
        // within the one place the cap allows past the unit's own precision.
        // Its last printed digit is real, and half of it is what it earns.
        expect(parsePrintedRate('193.6 kg/ha').tolKgHa).toBe(0.05);
    });

    /**
     * The boundary itself, stated as the harness uses it: a difference wider
     * than the tolerance is a difference, and a narrower one is the rounding
     * the document had to do.
     */
    test('a difference just over half a printed digit is a difference; just under it is rounding', () => {
        const tol = parsePrintedRate('8.3 g/m²').tolKgHa;   // 0.5 kg/ha
        const printed = parsePrintedRate('8.3 g/m²').kgHa;  // 83
        expect(Math.abs(83.6 - printed) > tol).toBe(true);
        expect(Math.abs(83.4 - printed) > tol).toBe(false);
        // And the number that stood here before earned neither verdict: it
        // called both of them rounding.
        expect(Math.abs(83.6 - printed) > 1).toBe(false);
    });
});

describe('GH-455 — a rate the reader refuses rather than guesses', () => {
    test('the split marker in both spellings is not part of the rate', () => {
        expect(parsePrintedRate('193 kg/ha [×2]').kgHa).toBe(193);
        expect(parsePrintedRate('193 kg/ha [x2]').kgHa).toBe(193);
        expect(parsePrintedRate('193 kg/ha [×2]').count).toBe(2);
    });

    test('a trailing marker written without brackets is refused, not glued onto the number', () => {
        // The shape the old reader read as 12.52: it stripped "[...]" and
        // handed everything else to a scanner that dropped the letters.
        expect(parsePrintedRate('12.5 g/m² x2')).toBeNull();
        const entries = scheduleEntries('Sportsmaster WSF 20-0-0 @ 12.5 g/m² x2');
        expect(entries.length).toBe(1);
        expect({ name: entries[0].name, rateKgHa: entries[0].rateKgHa, unreadable: entries[0].unreadable })
            .toEqual({ name: 'Sportsmaster WSF 20-0-0', rateKgHa: null, unreadable: true });
    });

    test('a leading application count — the AU recommender\'s own liquid wording — is refused too', () => {
        expect(parsePrintedRate('4x 7 L/ha')).toBeNull();
        expect(parsePrintedRate('4x 7 kg/ha')).toBeNull();
    });

    test('a unit this cell should not carry is refused', () => {
        expect(parsePrintedRate('7 L/ha')).toBeNull();
        expect(parsePrintedRate('7 tonnes')).toBeNull();
    });

    test('a whole cell splits into one entry per product, dropping the coverage note', () => {
        const entries = scheduleEntries('Product A @ 8.3 g/m², Product B @ 1.5 g/m² [×2] · Covered by Product C (Jan)');
        expect(entries.map((e) => [e.name, e.rateKgHa, e.tolKgHa]))
            .toEqual([['Product A', 83, 0.5], ['Product B', 15, 0.5]]);
    });

    test('an empty cell and a cell with no rate yield nothing to compare', () => {
        expect(scheduleEntries('')).toEqual([]);
        expect(scheduleEntries('-')).toEqual([]);
        expect(scheduleEntries(null)).toEqual([]);
        expect(scheduleEntries('Covered by Product C (Jan)')).toEqual([]);
    });
});

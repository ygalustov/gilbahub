/**
 * GH-337 — a live retest on a Canberra golf_greens/MLSN site showed
 * Required N=200, Delivered=159.3 (a ~20% shortfall) even though the
 * per-month breakdown (via GH-336-DEBUG logs) showed each month's own
 * requirement nominally "met". Root cause, surfaced by the user's own
 * question ("how can 35 applied + 17 carryover = 52 from a 35kg dose?"):
 * selectNitrogenSource() sized a slow/controlled-release granular batch
 * using `rateKgHa = Math.round(nRequired / nPct)` -- nRequired (netN) is
 * only ONE month's share of what a multi-month-release batch needs to
 * deliver in total. The batch then gets credited as satisfying the FULL
 * requirement in the month applied (delivered.N += the whole batch) AND
 * ALSO carries half its content into the next month via activeNutrients
 * (monthlyN = nDelivered / monthsCovered) -- crediting the same finite N
 * content toward two months' worth of requirement.
 *
 * Confirmed concretely: January's Country Club IV (18% N, 8-week/2-month
 * release) was sized for nRequired=35.3 (January's own target), delivering
 * 35.3kg total. February then received a further 17.65kg carryover credit
 * from that SAME batch -- crediting 52.95kg of satisfied requirement from a
 * batch that only contains 35.3kg of actual N.
 *
 * FIX: scale the sizing target by monthsCovered (`nTarget = nRequired *
 * monthsCovered`) so the batch's per-month release (nDelivered /
 * monthsCovered) matches nRequired, not the whole batch. monthsCovered is
 * always a whole number (`Math.max(1, Math.ceil(releaseWeeks / 4))`), so
 * quick/standard-release products (monthsCovered === 1) are unaffected
 * (nTarget === nRequired, same as before).
 */

'use strict';

const fs = require('fs');
const path = require('path');

describe('GH-337 — slow-release rate scaling (au-fertiliser-products.js)', () => {
    let src;
    beforeAll(() => {
        src = fs.readFileSync(path.join(__dirname, '../assets/au-fertiliser-products.js'), 'utf8');
    });

    test('monthsCovered is computed before the rate calculation, not after', () => {
        const bestMatchIdx = src.indexOf('const { product, labelRates, nPct } = bestMatch;');
        expect(bestMatchIdx).toBeGreaterThan(-1);
        const monthsCoveredIdx = src.indexOf('const monthsCovered = Math.max(1, Math.ceil(releaseWeeks / 4));', bestMatchIdx);
        const rateCalcIdx = src.indexOf('let rateKgHa = Math.round(nTarget / nPct);', bestMatchIdx);
        expect(monthsCoveredIdx).toBeGreaterThan(bestMatchIdx);
        expect(rateCalcIdx).toBeGreaterThan(monthsCoveredIdx);
    });

    test('rate target is scaled by monthsCovered (nTarget = nRequired * monthsCovered)', () => {
        expect(src).toMatch(/const nTarget = nRequired \* monthsCovered;/);
        expect(src).toMatch(/let rateKgHa = Math\.round\(nTarget \/ nPct\);/);
        expect(src).toMatch(/let actualNDelivered = nTarget;/);
    });

    test('label min/max capping and shortfall notes use nTarget, not the old unscaled nRequired', () => {
        const idx = src.indexOf('const nTarget = nRequired * monthsCovered;');
        const block = src.slice(idx, idx + 900);
        expect(block).toMatch(/const shortfall = nTarget - actualNDelivered;/);
        expect(block).toMatch(/Label max rate: \$\{rateKgHa\} kg\/ha \(delivers \$\{actualNDelivered\.toFixed\(1\)\} of \$\{nTarget\.toFixed\(1\)\} kg N\)/);
    });

    test('regression: the old unscaled rate formula is gone', () => {
        expect(src).not.toMatch(/let rateKgHa = Math\.round\(nRequired \/ nPct\);/);
    });
});

describe('GH-337 — standalone reimplementation of the scaled formula (real numbers)', () => {
    function sizeRate(nRequired, nPct, monthsCovered, labelMin, labelMax) {
        const nTarget = nRequired * monthsCovered;
        let rateKgHa = Math.round(nTarget / nPct);
        let actualNDelivered = nTarget;
        if (rateKgHa < labelMin) {
            rateKgHa = labelMin;
            actualNDelivered = rateKgHa * nPct;
        } else if (rateKgHa > labelMax) {
            rateKgHa = labelMax;
            actualNDelivered = rateKgHa * nPct;
        }
        return { rateKgHa, actualNDelivered, monthlyShare: actualNDelivered / monthsCovered };
    }

    test('Canberra January (Country Club IV 18% N, 2-month release, netN=35.3, unconstrained label range): monthly share matches netN, not half of it', () => {
        const r = sizeRate(35.3, 0.18, 2, 0, 1000);
        expect(r.rateKgHa).toBe(392); // was 196 pre-fix (half the correct batch size)
        expect(r.actualNDelivered).toBeCloseTo(70.56, 1);
        expect(r.monthlyShare).toBeCloseTo(35.28, 1); // matches netN=35.3, not 17.65
    });

    test('quick/standard release (monthsCovered=1) is unaffected -- same as the pre-fix formula', () => {
        const r = sizeRate(35.3, 0.18, 1, 0, 1000);
        expect(r.rateKgHa).toBe(196);
        expect(r.monthlyShare).toBeCloseTo(35.3, 1);
    });

    test('when the doubled target exceeds the label max, it caps and honestly reports a shortfall instead of silently under-dosing', () => {
        // Same Jan scenario, but a tighter greens label max (e.g. 200 kg/ha)
        const r = sizeRate(35.3, 0.18, 2, 0, 200);
        expect(r.rateKgHa).toBe(200);
        expect(r.actualNDelivered).toBeCloseTo(36, 1);
        expect(r.monthlyShare).toBeCloseTo(18, 1); // still short of 35.3, but now visible via the shortfall note, not hidden
    });
});

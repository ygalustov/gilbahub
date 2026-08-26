/**
 * GH-343 — same fix as GH-342, applied to K. netK only capped against
 * release-window carry-over (activeK), not the annual K budget. Three
 * non-overlapping granular N-carrier picks (Canberra: Country Club IV
 * 18-9-18 twice, Sierraform GT All Seasons once) each delivered K based on
 * their own raw monthly slice, landing at 131.2kg against a 110kg annual
 * target.
 */

'use strict';

const fs = require('fs');
const path = require('path');

describe('GH-343 — au-fertiliser-products.js: netK caps against the remaining annual K budget', () => {
    let src;
    beforeAll(() => {
        src = fs.readFileSync(path.join(__dirname, '../assets/au-fertiliser-products.js'), 'utf8');
    });

    test('netK nets against release-window carry-over (activeK) AND the remaining annual K budget (annualTargets.K - delivered.K)', () => {
        expect(src).toMatch(/const netK = Math\.min\(\s*\n\s*Math\.max\(0, \(month\.K \|\| 0\) - activeK\),\s*\n\s*Math\.max\(0, annualTargets\.K - delivered\.K\)\s*\n\s*\);/);
    });

    test('netK is computed before netP (both feed the same granular/liquid calls)', () => {
        const kIdx = src.indexOf('const netK = Math.min(');
        const pIdx = src.indexOf('const netP = Math.min(');
        expect(kIdx).toBeGreaterThan(-1);
        expect(pIdx).toBeGreaterThan(kIdx);
    });
});

describe('GH-343 — standalone reimplementation: Canberra-shaped scenario caps cumulative K', () => {
    function computeNetK(monthK, activeK, annualTargetK, deliveredKSoFar) {
        return Math.min(
            Math.max(0, monthK - activeK),
            Math.max(0, annualTargetK - deliveredKSoFar)
        );
    }

    test('January: no prior delivery, own monthly slice passes through unconstrained', () => {
        const janNetK = computeNetK(21.9, 0, 110, 0);
        expect(janNetK).toBe(21.9);
    });

    test('once cumulative deliveries approach the annual target, the cap binds below the raw monthly slice (activeK=0, release window long expired)', () => {
        // Canberra-shaped: by October, prior granular picks (Jan Country Club
        // IV 41.8kg + Mar Sierraform GT All Seasons 29.8kg + liquid K from
        // Feb/May/Sep) have already delivered most of the 110kg annual target.
        const deliveredByOct = 95; // close to the 110kg annual target
        const octRawMonthlyK = 20;
        const octNetK = computeNetK(octRawMonthlyK, 0, 110, deliveredByOct);
        expect(octNetK).toBe(15); // 110 - 95, capped below the raw 20kg slice
        expect(octNetK).toBeLessThan(octRawMonthlyK);
    });
});

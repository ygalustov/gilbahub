/**
 * GH-342 — P had no annual carry-over tracking in au-fertiliser-products.js
 * (unlike N/K's activeN/activeK), so each month's pScore compared against
 * the raw monthly P slice with no memory of P already delivered. A repeated
 * P-rich granular pick (Country Club IV 18-9-18, P=9%) could compound
 * across months. Fixed by adding activeP/netP, mirroring activeN/activeK.
 */

'use strict';

const fs = require('fs');
const path = require('path');

describe('GH-342 — au-fertiliser-products.js: activeP/netP carry-over', () => {
    let src;
    beforeAll(() => {
        src = fs.readFileSync(path.join(__dirname, '../assets/au-fertiliser-products.js'), 'utf8');
    });

    test('generateAnnualProgram() tracks activeP alongside activeN/activeK', () => {
        const idx = src.indexOf('let activeN = 0, activeK = 0, activeP = 0;');
        expect(idx).toBeGreaterThan(-1);
        const block = src.slice(idx, idx + 300);
        expect(block).toMatch(/activeP \+= a\.monthlyP \|\| 0;/);
    });

    test('netP nets against release-window carry-over (activeP) AND the remaining annual P budget (annualTargets.P - delivered.P)', () => {
        expect(src).toMatch(/const netP = Math\.min\(\s*\n\s*Math\.max\(0, \(month\.P \|\| 0\) - activeP\),\s*\n\s*Math\.max\(0, annualTargets\.P - delivered\.P\)\s*\n\s*\);/);
    });

    test('granular call site passes P: netP instead of raw month.P', () => {
        expect(src).toMatch(/this\.selectNitrogenSource\(granular, \{ N: netN, K: netK, P: netP \}, \{/);
    });

    test('liquid call site nets remainingP against carry-over and this month\'s own granular P delivery', () => {
        expect(src).toMatch(/const granularPDelivered = monthResult\.granular\.reduce\(\(sum, g\) => sum \+ \(g\.delivers\?\.P \|\| 0\), 0\);/);
        expect(src).toMatch(/const remainingP = Math\.max\(0, netP - granularPDelivered\);/);
        expect(src).toMatch(/this\.selectFoliarNitrogen\(all, \{ \.\.\.month, N: remainingN, K: netK, P: remainingP, gp \}, \{/);
    });

    test('activeNutrients entries carry monthlyP forward for future months', () => {
        expect(src).toMatch(/monthlyP: granularRec\.pDelivered \/ monthsCovered,/);
    });

    test('pScore "not needed" branch gates on pRequired <= 0 in both scoring functions, not the annual soilPSufficient flag', () => {
        const occurrences = (src.match(/\} else if \(pRequired <= 0 && pPct > 0\) \{/g) || []).length;
        expect(occurrences).toBe(2);
        expect(src).not.toMatch(/\} else if \(soilPSufficient && pPct > 0\) \{/);
    });
});

describe('GH-342 — standalone reimplementation: netP carries a prior month\'s P delivery forward', () => {
    function computeNetP(monthP, activeNutrients, idx) {
        let activeP = 0;
        activeNutrients.forEach(a => {
            if (a.endsIdx > idx) activeP += a.monthlyP || 0;
        });
        return Math.max(0, monthP - activeP);
    }

    test('a slow-release batch applied in month 0 covering 2 months reduces month 1\'s netP', () => {
        // Country Club IV 18-9-18 delivers pDelivered=25.2 over monthsCovered=2
        const activeNutrients = [{ endsIdx: 2, monthlyN: 25.2, monthlyK: 25.2, monthlyP: 25.2 / 2 }];
        const netPMonth1 = computeNetP(19.9, activeNutrients, 1);
        expect(netPMonth1).toBe(19.9 - 12.6);
    });

    test('once carry-over exceeds the month\'s own P requirement, netP floors at 0 (not negative)', () => {
        const activeNutrients = [{ endsIdx: 2, monthlyN: 30, monthlyK: 30, monthlyP: 30 }];
        expect(computeNetP(5, activeNutrients, 1)).toBe(0);
    });
});

describe('GH-342 follow-up — netP also caps against the remaining annual P budget (non-overlapping release windows)', () => {
    function computeNetP(monthP, activeP, annualTargetP, deliveredPSoFar) {
        return Math.min(
            Math.max(0, monthP - activeP),
            Math.max(0, annualTargetP - deliveredPSoFar)
        );
    }

    test('Canberra-shaped scenario: three non-overlapping granular P picks (Jan/Mar/Oct) no longer compound past the annual target', () => {
        const annualTargetP = 19.9;
        // Jan: no carry-over yet, own monthly slice is well under the annual target
        const janNetP = computeNetP(6, 0, annualTargetP, 0);
        expect(janNetP).toBe(6);
        // Jan's granular pick delivers 25.2kg P (Country Club IV, chosen for N, P rides along)
        const deliveredAfterJan = 25.2;
        // By March, Jan's release window has long expired (activeP=0), but the
        // annual budget is already exhausted -- netP must be 0, not raw month.P
        const marNetP = computeNetP(6, 0, annualTargetP, deliveredAfterJan);
        expect(marNetP).toBe(0);
    });
});

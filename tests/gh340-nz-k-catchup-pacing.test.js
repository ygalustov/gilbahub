/**
 * GH-340 — user flagged K over-delivery on an NZ site (Required=110.1kg,
 * Delivered=144.7kg, +31%) -- same symptom family as GH-339 but a different
 * root cause, since prebbles-products.js has no pScore equivalent.
 *
 * Traced to selectNitrogenSource()'s K-catch-up bonus (kDeficitBonus, up to
 * 50 unweighted points for K>=15% products): kRunningBehind compared K
 * delivered-so-far against the FULL annual K requirement, which is
 * trivially true in January (0 / annualTotal < 0.7) before any month has
 * had a chance to deliver anything -- "behind" by definition, not by an
 * actual missed schedule. Confirmed live: fired in both Jan and Feb on a
 * Browntop Bent greens site, both months picking Sierraform GT Anti-Stress
 * (K=21.6%) at 200kg/ha (43.2kg K each) -- 86.4kg (78% of the 110.1kg
 * annual target) delivered in the first 2 of 12 months.
 *
 * FIX: compute annualKRequiredToDate (pro-rata sum of monthData.K for the
 * months processed so far, inclusive) in generateProgram()'s month loop,
 * and compare annualKDelivered against that instead of the full-year
 * total -- "behind" now means behind the actual elapsed-year schedule.
 */

'use strict';

const fs = require('fs');
const path = require('path');

describe('GH-340 — prebbles-products.js: K catch-up bonus paced against elapsed-year requirement', () => {
    let src;
    beforeAll(() => {
        src = fs.readFileSync(path.join(__dirname, '../assets/prebbles-products.js'), 'utf8');
    });

    test('generateProgram() computes a pro-rata kRequiredToDate per month and passes it as annualKRequiredToDate', () => {
        const idx = src.indexOf('monthlyData.forEach((monthData, index) => {');
        expect(idx).toBeGreaterThan(-1);
        const block = src.slice(idx, idx + 2000);
        expect(block).toMatch(/const kRequiredToDate = monthlyData\s*\n\s*\.slice\(0, index \+ 1\)\s*\n\s*\.reduce\(\(sum, m\) => sum \+ \(m\.K \|\| 0\), 0\);/);
        expect(block).toMatch(/annualKRequiredToDate: kRequiredToDate,/);
    });

    test('selectNitrogenSource() compares delivered-so-far against annualKRequiredToDate, not the full annual total', () => {
        const idx = src.indexOf("Check if K is running behind schedule - if so, boost high-K products");
        expect(idx).toBeGreaterThan(-1);
        const block = src.slice(idx, idx + 1500);
        expect(block).toMatch(/const annualKRequiredToDate = context\.annualKRequiredToDate \|\| 0;/);
        expect(block).toMatch(/const kRunningBehind = annualKRequiredToDate > 0 && \(annualKDelivered \/ annualKRequiredToDate\) < 0\.7;/);
        // regression: not comparing against the full annual total anymore
        expect(block).not.toMatch(/const kRunningBehind = annualKRequired > 0 && \(annualKDelivered \/ annualKRequired\) < 0\.7;/);
    });
});

describe('GH-340 — standalone reimplementation: pacing against real NZ site numbers', () => {
    // K required per month, taken verbatim from the live log (annual total 110.1kg)
    const monthlyK = { Jan: 21.9, Feb: 21.2, Mar: 16.4, Apr: 8.3, May: 3.5, Jun: 0, Jul: 0, Aug: 0, Sep: 3.2, Oct: 6, Nov: 11.4, Dec: 18.2 };
    const months = Object.keys(monthlyK);

    function kRequiredToDate(index) {
        return months.slice(0, index + 1).reduce((sum, m) => sum + monthlyK[m], 0);
    }

    test('January still trivially triggers the catch-up bonus (nothing delivered before the year\'s first month)', () => {
        const deliveredBeforeJan = 0;
        const ratio = deliveredBeforeJan / kRequiredToDate(0); // 0 / 21.9
        expect(ratio).toBeLessThan(0.7);
    });

    test('February no longer triggers the bonus once January\'s (over-)delivery already covers its own pro-rata pace', () => {
        const deliveredAfterJan = 43.2; // Sierraform GT Anti-Stress @ 200kg/ha * 21.6% K, from the live log
        const ratio = deliveredAfterJan / kRequiredToDate(1); // 43.2 / (21.9+21.2)
        expect(ratio).toBeGreaterThanOrEqual(0.7);
    });

    test('regression: under the OLD full-annual-total comparison, February would have still shown as "behind"', () => {
        const deliveredAfterJan = 43.2;
        const annualKRequired = 110.1;
        const oldRatio = deliveredAfterJan / annualKRequired;
        expect(oldRatio).toBeLessThan(0.7); // 0.392 -- old formula kept boosting high-K products into Feb too
    });
});

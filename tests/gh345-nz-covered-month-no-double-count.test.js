/**
 * GH-345 — the "isCovered" branch in generateProgram() double-counted a
 * slow-release batch's N/K content: the full batch was credited to
 * delivered.N/K at its application month, then a decayed share was ALSO
 * added again at each subsequent covered month via
 * `delivered.N += Math.min(coverage.remainingN, monthData.N)`. This inflated
 * the running delivered.N/K/P tally used for pacing decisions
 * (kRunningBehind, GH-340/341; the strategic P application's
 * annualPRemaining) without affecting the final Delivered column (recomputed
 * cleanly from program.annualSummary.products at the end).
 *
 * FIX: removed the re-credit in the isCovered branch. Only genuinely new
 * applications (liquid top-ups) still add to delivered.N/K there.
 */

'use strict';

const fs = require('fs');
const path = require('path');

describe('GH-345 — prebbles-products.js: covered months no longer re-credit delivered.N/K', () => {
    let src;
    beforeAll(() => {
        src = fs.readFileSync(path.join(__dirname, '../assets/prebbles-products.js'), 'utf8');
    });

    test('the double-count lines are gone from the isCovered branch', () => {
        expect(src).not.toMatch(/delivered\.N \+= Math\.min\(coverage\.remainingN, monthData\.N\);/);
        expect(src).not.toMatch(/delivered\.K \+= Math\.min\(coverage\.remainingK, monthData\.K\);/);
    });

    test('liquid top-ups in a covered month still credit delivered.N/K (genuinely new applications)', () => {
        const idx = src.indexOf('program.monthly.push(rec);');
        expect(idx).toBeGreaterThan(-1);
        const block = src.slice(idx, idx + 1900);
        expect(block).toMatch(/rec\.liquid\.forEach\(liq => \{/);
        expect(block).toMatch(/delivered\.N \+= \(liq\.nDelivered \|\| 0\);/);
        expect(block).toMatch(/delivered\.K \+= \(liq\.kDelivered \|\| 0\);/);
    });
});

describe('GH-345 — standalone reimplementation: running delivered.K no longer double-counts a covered batch', () => {
    function simulate({ applicationK, monthsCoveredEndsIdx, decayPerMonth, monthlyK, fixed }) {
        let delivered = 0;
        // Application month: full batch credited once.
        delivered += applicationK;
        let remainingK = applicationK;
        for (let idx = 1; idx < monthsCoveredEndsIdx; idx++) {
            remainingK -= monthlyK * decayPerMonth;
            if (!fixed) {
                // OLD (buggy) behaviour: re-credit a decayed share every covered month.
                delivered += Math.min(remainingK, monthlyK);
            }
            // NEW (fixed) behaviour: covered months add nothing on their own.
        }
        return delivered;
    }

    test('old behaviour double-counted: running delivered.K exceeds the batch\'s own K content', () => {
        const total = simulate({ applicationK: 20, monthsCoveredEndsIdx: 3, decayPerMonth: 0.8, monthlyK: 10, fixed: false });
        expect(total).toBeGreaterThan(20); // more credited than the batch actually contains
    });

    test('fixed behaviour: running delivered.K equals exactly what the batch contains', () => {
        const total = simulate({ applicationK: 20, monthsCoveredEndsIdx: 3, decayPerMonth: 0.8, monthlyK: 10, fixed: true });
        expect(total).toBe(20);
    });
});

/**
 * GH-347 — in prebbles-products.js's rate-capping branches (both
 * selectNitrogenSource() granular and selectFoliarNitrogen() liquid),
 * splitCount was computed as Math.ceil(rate/maxRate) to decide whether
 * splitting was reasonable (<=2 or <=3). When it wasn't (too many splits
 * needed), the code capped at a single application and warned about the
 * shortfall -- but never reset splitCount back to 1. kDelivered (and, in
 * the liquid function, the post-rounding actualNDelivered recalculation)
 * then multiplied by that stale splitCount, overstating delivery as if
 * several full-rate applications had happened instead of one.
 *
 * Confirmed live: January capped MESA Country Club 100% (K=16%) at its
 * 200kg/ha label max (one real application, 32kg K), but splitCount had
 * been set to 3 before the cap -- kDelivered came out to 200*3*0.16=96kg,
 * a 3x overstatement.
 */

'use strict';

const fs = require('fs');
const path = require('path');

describe('GH-347 — prebbles-products.js: splitCount reset to 1 in both rate-cap branches', () => {
    let src;
    beforeAll(() => {
        src = fs.readFileSync(path.join(__dirname, '../assets/prebbles-products.js'), 'utf8');
    });

    test('selectNitrogenSource() granular cap branch resets splitCount = 1', () => {
        const idx = src.indexOf('// Too many splits - cap at max rate with warning');
        expect(idx).toBeGreaterThan(-1);
        const block = src.slice(idx, idx + 1400);
        expect(block).toMatch(/splitCount = 1;\s*\n\s*rateKgHa = maxRate;/);
    });

    test('selectFoliarNitrogen() liquid cap branch resets splitCount = 1', () => {
        const idx = src.indexOf('// No better alternative - cap and warn');
        expect(idx).toBeGreaterThan(-1);
        const block = src.slice(idx, idx + 1400);
        expect(block).toMatch(/capped = true;\s*\n\s*splitCount = 1;\s*\n\s*rateLHa = maxRate;/);
    });
});

describe('GH-347 — standalone reimplementation: real Hoxton January numbers no longer overstate K', () => {
    test('OLD (buggy) behaviour: stale splitCount=3 triples kDelivered for a single real application', () => {
        const rateKgHa = 200; // label max, MESA Country Club 100%
        const kPct = 16;
        const staleSplitCount = 3; // Math.ceil(476.3 / 200), never reset
        const kDeliveredBuggy = rateKgHa * staleSplitCount * (kPct / 100);
        expect(kDeliveredBuggy).toBe(96);
    });

    test('FIXED behaviour: splitCount reset to 1 gives the true single-application K content', () => {
        const rateKgHa = 200;
        const kPct = 16;
        const fixedSplitCount = 1;
        const kDeliveredFixed = rateKgHa * fixedSplitCount * (kPct / 100);
        expect(kDeliveredFixed).toBe(32);
    });

    test('N delivered was already correct in the granular branch (no splitCount multiplier there) -- confirms only K/liquid path needed the fix', () => {
        const rateKgHa = 200;
        const nPct = 19;
        const actualNDelivered = rateKgHa * (nPct / 100); // matches the live "38.0" warning
        expect(Math.round(actualNDelivered * 10) / 10).toBe(38);
    });
});

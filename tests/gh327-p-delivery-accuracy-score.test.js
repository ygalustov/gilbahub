/**
 * GH-327 — follow-up to GH-326. Fixing the arbitrary `< 15` P-sufficiency
 * threshold (GH-326) stopped genuine P deficits from being penalized, but a
 * live check showed P was still never actually delivered (Required=14,
 * Delivered=0 persisted). Root cause: `selectNitrogenSource()` never received
 * P as a magnitude at all -- only `monthData.N`/`monthData.K` existed, and P
 * was scored purely as a penalty (soilPSufficient, a boolean) with no reward
 * for matching a real deficit, unlike K's `kScore`.
 *
 * FIX: added `pRequired` (from a new `monthData.P`), and replaced the old
 * penalty-only "SCORE 4: P-conscious penalty" block with a `pScore` that
 * mirrors `kScore`'s exact delivery-ratio-banded structure (confirmed with
 * the user this is a deliberate, non-scientific hand-tuned heuristic, same
 * as the rest of this file's scoring system -- reusing its shape for
 * consistency, not because the shape itself is independently validated).
 * `pScore` is weighted the same as `kScore` (×0.35) in the final totalScore.
 */

'use strict';

const fs = require('fs');
const path = require('path');

describe('GH-327 — P Delivery Accuracy score in au-fertiliser-products.js', () => {
    let src;
    beforeAll(() => {
        src = fs.readFileSync(path.join(__dirname, '../assets/au-fertiliser-products.js'), 'utf8');
    });

    test('selectNitrogenSource() reads pRequired from monthData.P', () => {
        const idx = src.indexOf('selectNitrogenSource: function(products, monthData, context) {');
        expect(idx).toBeGreaterThan(-1);
        const block = src.slice(idx, idx + 700);
        expect(block).toMatch(/const pRequired = monthData\.P \|\| 0;/);
    });

    test('the granular call site passes P: netP into monthData (GH-342: netted against carry-over)', () => {
        expect(src).toMatch(/this\.selectNitrogenSource\(granular, \{ N: netN, K: netK, P: netP \}, \{/);
    });

    test('pScore mirrors kScore\'s delivery-ratio bands for the "needed" case', () => {
        const idx = src.indexOf('// SCORE 4: P Delivery Accuracy');
        expect(idx).toBeGreaterThan(-1);
        const block = src.slice(idx, idx + 2200);
        expect(block).toMatch(/if \(pRequired > 0 && pPct > 0\) \{/);
        expect(block).toMatch(/pScore = 100; \/\/ Perfect P delivery/);
        expect(block).toMatch(/pScore = -20; \/\/ Severe P overshoot - penalize/);
    });

    test('pScore still penalizes P when genuinely not needed (GH-342: gated on pRequired <= 0, not the annual soilPSufficient flag)', () => {
        const idx = src.indexOf('// SCORE 4: P Delivery Accuracy');
        const block = src.slice(idx, idx + 2200);
        expect(block).toMatch(/\} else if \(pRequired <= 0 && pPct > 0\) \{/);
        expect(block).toMatch(/pScore = -30;\s*\/\/ Heavy P when none needed/);
    });

    test('the old penalty-only pPenalty block is gone from the granular scoring function', () => {
        const startIdx = src.indexOf('selectNitrogenSource: function(products, monthData, context) {');
        const endIdx = src.indexOf('CALCULATE RATE WITHIN LABEL LIMITS');
        const fnBlock = src.slice(startIdx, endIdx);
        expect(fnBlock).not.toMatch(/P-conscious penalty/);
        expect(fnBlock).not.toMatch(/let pPenalty = 0;/);
    });

    test('totalScore weights pScore the same as kScore (×0.35)', () => {
        expect(src).toMatch(/const totalScore = kScore \* 0\.35 \+ releaseScore \* 0\.20 \+ nScore \* 0\.25 \+ pScore \* 0\.35 \+/);
    });

    test('regression: the sibling liquid-product scoring function was also fixed (GH-328) -- no pPenalty remains anywhere', () => {
        const matches = src.match(/let pPenalty = 0;/g) || [];
        expect(matches.length).toBe(0);
    });
});

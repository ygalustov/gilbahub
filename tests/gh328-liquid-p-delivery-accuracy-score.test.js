/**
 * GH-328 — same fix as GH-327 (P Delivery Accuracy scoring), applied to the
 * sibling liquid/soluble product scoring function `selectFoliarNitrogen()`,
 * so granular and liquid selection use the same algorithm for P (and
 * already did for K's autumn-hardening gate, GH-326 having only needed to
 * fix the granular side there since liquid was already correct).
 */

'use strict';

const fs = require('fs');
const path = require('path');

describe('GH-328 — P Delivery Accuracy score in selectFoliarNitrogen() (liquid)', () => {
    let src;
    beforeAll(() => {
        src = fs.readFileSync(path.join(__dirname, '../assets/au-fertiliser-products.js'), 'utf8');
    });

    test('selectFoliarNitrogen() reads pRequired from monthData.P', () => {
        const idx = src.indexOf('selectFoliarNitrogen: function(liquidProducts, monthData, context) {');
        expect(idx).toBeGreaterThan(-1);
        const block = src.slice(idx, idx + 700);
        expect(block).toMatch(/const pRequired = monthData\.P \|\| 0;/);
    });

    test('the call site passes P: remainingP (GH-342 -- netted against carry-over and this month\'s own granular pick)', () => {
        expect(src).toMatch(/this\.selectFoliarNitrogen\(all, \{ \.\.\.month, N: remainingN, K: netK, P: remainingP, gp \}, \{/);
    });

    test('pScore mirrors this function\'s own kScore bands for the "needed" case', () => {
        const idx = src.indexOf('// SCORE 7: P Delivery Accuracy');
        expect(idx).toBeGreaterThan(-1);
        const block = src.slice(idx, idx + 2000);
        expect(block).toMatch(/if \(pRequired > 0 && pPct > 0\) \{/);
        expect(block).toMatch(/pScore = 100; \/\/ Perfect P delivery/);
        expect(block).toMatch(/pScore = -25; \/\/ Severe P overshoot/);
    });

    test('pScore still penalizes P when genuinely not needed (GH-342: gated on pRequired <= 0, not the annual soilPSufficient flag)', () => {
        const idx = src.indexOf('// SCORE 7: P Delivery Accuracy');
        const block = src.slice(idx, idx + 2000);
        expect(block).toMatch(/\} else if \(pRequired <= 0 && pPct > 0\) \{/);
        expect(block).toMatch(/if \(pAtRate > 10\) pScore = -20;/);
    });

    test('totalScore weights pScore the same as kScore (×0.25) in this function', () => {
        const idx = src.indexOf('selectFoliarNitrogen: function(liquidProducts, monthData, context) {');
        const endIdx = src.indexOf('if (!bestProduct)', idx);
        const block = src.slice(idx, endIdx);
        expect(block).toMatch(/\(kScore \* 0\.25\)/);
        expect(block).toMatch(/\(pScore \* 0\.25\)/);
    });

    test('regression: no pPenalty remains in either scoring function', () => {
        expect(src).not.toMatch(/let pPenalty = 0;/);
    });
});

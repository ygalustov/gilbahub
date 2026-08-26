/**
 * GH-344 — the low-GP (<0.3) winter branch in getMonthlyRecommendation()
 * bypasses selectNitrogenSource() entirely (no clean-K/P filter, no
 * ratioScore) and picked the highest-K% candidate unconditionally,
 * regardless of whether K was needed that month. Confirmed live on Test5
 * (soccer, K already excess): July picked MESA Country Club 100% (K=16%)
 * over MESA Proscape 51% (K=4.2%) despite monthData.K=0.
 *
 * FIX: scoring is now two-sided -- prefer high K when monthData.K > 0
 * (winter hardening intent preserved), prefer low/no K otherwise.
 */

'use strict';

const fs = require('fs');
const path = require('path');

describe('GH-344 — prebbles-products.js: winter branch K preference respects monthData.K', () => {
    let src;
    beforeAll(() => {
        src = fs.readFileSync(path.join(__dirname, '../assets/prebbles-products.js'), 'utf8');
    });

    test('score is two-sided: high-K preferred only when monthData.K > 0, low-K preferred otherwise', () => {
        const idx = src.indexOf("const bestMesa = winterCandidates.reduce((best, p) => {");
        expect(idx).toBeGreaterThan(-1);
        const block = src.slice(idx, idx + 500);
        expect(block).toMatch(/const score = monthData\.K > 0\s*\n\s*\? \(kPct >= 10 \? 20 : kPct > 0 \? 10 : 0\)/);
        expect(block).toMatch(/: \(kPct === 0 \? 20 : kPct <= 5 \? 10 : 0\);/);
    });

    test('regression: old unconditional high-K-always-wins formula is gone', () => {
        expect(src).not.toMatch(/const score = kPct >= 10 \? 20 : kPct > 0 \? 10 : 0;/);
    });
});

describe('GH-344 — standalone reimplementation: real Test5 July candidates flip winner when K not needed', () => {
    function scoreCandidate(kPct, monthK) {
        return monthK > 0
            ? (kPct >= 10 ? 20 : kPct > 0 ? 10 : 0)
            : (kPct === 0 ? 20 : kPct <= 5 ? 10 : 0);
    }

    const candidates = [
        { name: 'MESA Proscape 51%', kPct: 4.2 },
        { name: 'MESA Country Club 100%', kPct: 16 },
        { name: 'Proscape Starter', kPct: 10 },
    ];

    function pickWinner(monthK) {
        return candidates.reduce((best, c) => {
            const score = scoreCandidate(c.kPct, monthK);
            return !best || score > best.score ? { ...c, score } : best;
        }, null);
    }

    test('when K is not needed (monthData.K=0, Test5 July), the low-K candidate wins instead of the highest-K one', () => {
        const winner = pickWinner(0);
        expect(winner.name).toBe('MESA Proscape 51%');
        expect(winner.kPct).toBe(4.2);
    });

    test('when K genuinely is needed, the original high-K preference still applies', () => {
        const winner = pickWinner(15);
        expect(winner.name).toBe('MESA Country Club 100%');
        expect(winner.kPct).toBe(16);
    });
});

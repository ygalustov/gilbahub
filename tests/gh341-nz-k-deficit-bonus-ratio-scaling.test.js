/**
 * GH-341 — follow-up to GH-340. User asked why K over-delivery on Russley
 * (Delivered=124.2kg of 110.1kg required, +12.7%) wasn't fully resolved by
 * GH-340's pacing fix.
 *
 * [GH341-DEBUG] score-breakdown logging (added to selectNitrogenSource())
 * showed February onward now selects correctly (kRunningBehind: false,
 * best-ratioScore candidate wins). But January -- where kRunningBehind is
 * unavoidably true, nothing delivered before the year's first month --
 * still picked Sierraform GT Anti-Stress (ratioScore=38.2,
 * effectiveTechScore=4.4, a poor fit) over CC MD Greens STD 16-0-6.7
 * (ratioScore=76.1, effectiveTechScore=100, a much better fit), purely
 * because kDeficitBonus (up to 50 unweighted points) was large enough to
 * override a 30-point deficit on the weighted core score. Sierraform alone
 * delivered 43.2kg K against January's own 21.9kg need -- nearly the
 * entire annual overshoot traced to this one month's pick.
 *
 * FIX: scale kDeficitBonus by ratioScore/100, so a well-matched candidate
 * still gets close to the full bonus while a poorly-matched one gets
 * proportionally discounted instead of overriding a better fit outright.
 */

'use strict';

const fs = require('fs');
const path = require('path');

describe('GH-341 — prebbles-products.js: kDeficitBonus scaled by ratioScore', () => {
    let src;
    beforeAll(() => {
        src = fs.readFileSync(path.join(__dirname, '../assets/prebbles-products.js'), 'utf8');
    });

    test('kDeficitBonus is computed as baseKDeficitBonus scaled by ratioScore/100', () => {
        const idx = src.indexOf('let kDeficitBonus = 0;');
        expect(idx).toBeGreaterThan(-1);
        const block = src.slice(idx, idx + 1400);
        expect(block).toMatch(/const baseKDeficitBonus = Math\.min\(50, kPct \* 2\);/);
        expect(block).toMatch(/kDeficitBonus = baseKDeficitBonus \* \(ratioScore \/ 100\);/);
        // regression: not the old flat, unscaled bonus
        expect(block).not.toMatch(/kDeficitBonus = Math\.min\(50, kPct \* 2\);\s*\n\s*\}/);
    });

    test('the gate (kRunningBehind && kPct >= 15) is unchanged', () => {
        const idx = src.indexOf('let kDeficitBonus = 0;');
        const block = src.slice(idx, idx + 200);
        expect(block).toMatch(/if \(kRunningBehind && kPct >= 15\) \{/);
    });
});

describe('GH-341 — standalone reimplementation: real Russley January numbers flip the winner', () => {
    function scoreCandidate({ ratioScore, releaseScore, effectiveTechScore, rateScore, kPct, kRunningBehind }) {
        let kDeficitBonus = 0;
        if (kRunningBehind && kPct >= 15) {
            const baseKDeficitBonus = Math.min(50, kPct * 2);
            kDeficitBonus = baseKDeficitBonus * (ratioScore / 100);
        }
        return (ratioScore * 0.35) + (releaseScore * 0.25) + (effectiveTechScore * 0.30) + (rateScore * 0.10) + kDeficitBonus;
    }

    // Real January candidate data from the live [GH341-DEBUG] log (Russley, Browntop Bent greens)
    const sierraform = { ratioScore: 38.2, releaseScore: 100, effectiveTechScore: 4.4, rateScore: 3, kPct: 21.6, kRunningBehind: true };
    const ccmdStd = { ratioScore: 76.1, releaseScore: 50, effectiveTechScore: 100, rateScore: 6, kPct: 6.7, kRunningBehind: true };
    const ccmd12 = { ratioScore: 33, releaseScore: 100, effectiveTechScore: 4.4, rateScore: 3, kPct: 20, kRunningBehind: true };
    const ccmd22 = { ratioScore: 93.1, releaseScore: 100, effectiveTechScore: 4.4, rateScore: 6, kPct: 13, kRunningBehind: true };

    test('OLD unscaled bonus would have picked Sierraform (score 83.2), the actual pre-fix live result', () => {
        const oldBonus = Math.min(50, sierraform.kPct * 2); // 43.2, unscaled
        const oldTotal = (sierraform.ratioScore * 0.35) + (sierraform.releaseScore * 0.25) + (sierraform.effectiveTechScore * 0.30) + (sierraform.rateScore * 0.10) + oldBonus;
        expect(Math.round(oldTotal * 10) / 10).toBe(83.2);
    });

    test('NEW scaled bonus: Sierraform drops well below CC MD Greens STD 16-0-6.7', () => {
        const sierraformScore = scoreCandidate(sierraform);
        const ccmdStdScore = scoreCandidate(ccmdStd);
        expect(Math.round(sierraformScore * 10) / 10).toBe(56.5);
        expect(Math.round(ccmdStdScore * 10) / 10).toBe(69.7);
        expect(ccmdStdScore).toBeGreaterThan(sierraformScore);
    });

    test('NEW scaled bonus: CC MD Greens STD 16-0-6.7 wins January outright among all 4 real candidates', () => {
        const scores = {
            'CC MD Greens STD 16-0-6.7': scoreCandidate(ccmdStd),
            'Sierraform GT Anti-Stress': scoreCandidate(sierraform),
            'CC MD Greens 12-0-20': scoreCandidate(ccmd12),
            'CC MD Greens 22-0-13': scoreCandidate(ccmd22),
        };
        const winner = Object.entries(scores).sort((a, b) => b[1] - a[1])[0][0];
        expect(winner).toBe('CC MD Greens STD 16-0-6.7');
    });
});

/**
 * GH-326 — live client report on a real MLSN/AU site ("Bernss"): N came out
 * close to exact, but P and K looked "way out" in the Nutrient Delivery
 * Summary once fertiliser products were selected -- P showed Required=14,
 * Delivered=0 (a genuine 45% deficit that got zero correction); K showed
 * Required=0, Delivered=70 (soil already at 356% of its ceiling, yet more K
 * still got recommended). Two independent root causes in
 * au-fertiliser-products.js's generateAnnualProgram():
 *
 * 1. `soilPSufficient = annualTargets.P < 15` -- an arbitrary, uncited kg/ha
 *    cutoff on the annual REQUIREMENT figure. Required=14 landed just under
 *    it, so a genuine deficit got treated as "sufficient" and P-containing
 *    products were penalized instead of recommended. Fixed to
 *    `annualTargets.P <= 0` -- reuses nutrition-calendar.js's own,
 *    already-validated convention (GH-300/305/319) that Required is exactly
 *    0 only when soil is at/above the methodology's ceiling.
 *
 * 2. The granular-product "Autumn K boost for winter hardening" score was
 *    unconditional on kRequired (only checked isAutumn && kPct > 0) --
 *    unlike the sibling liquid-product scoring function a few hundred lines
 *    below, which already gated the same bonus on kRequired > 0. A soil
 *    already far above its K ceiling (Required = 0) could still receive the
 *    full autumn hardening bonus on a high-K granular product. Fixed by
 *    adding the same `kRequired > 0` gate the liquid path already had.
 */

'use strict';

const fs = require('fs');
const path = require('path');

describe('GH-326 — au-fertiliser-products.js P/K selection fixes', () => {
    let src;
    beforeAll(() => {
        src = fs.readFileSync(path.join(__dirname, '../assets/au-fertiliser-products.js'), 'utf8');
    });

    test('soilPSufficient no longer uses the arbitrary "< 15" cutoff', () => {
        expect(src).not.toMatch(/soilPSufficient\s*=\s*annualTargets\.P\s*<\s*15/);
    });

    test('soilPSufficient is now keyed off Required actually being 0 (the real ceiling signal)', () => {
        expect(src).toMatch(/const soilPSufficient = annualTargets\.P <= 0;/);
    });

    test('granular autumn K bonus is gated on kRequired > 0, matching the liquid path', () => {
        const idx = src.indexOf('// SCORE 5: Autumn K boost for winter hardening');
        expect(idx).toBeGreaterThan(-1);
        const block = src.slice(idx, idx + 1600);
        expect(block).toMatch(/if \(isAutumn && kRequired > 0\) \{/);
        // regression: the old unconditional form must be gone
        expect(block).not.toMatch(/if \(isAutumn\) \{\s*\n\s*if \(kPct > 0\) \{/);
    });

    test('the pre-existing liquid-product autumn K bonus (the correct reference implementation) is unchanged', () => {
        expect(src).toMatch(/if \(isAutumn && kPct > 0 && kRequired > 0\) \{/);
    });

    test('regression: the old arbitrary P threshold is no longer live code (only mentioned in the fix comment)', () => {
        const liveAssignments = src.match(/const soilPSufficient = [^;]+;/g) || [];
        liveAssignments.forEach((line) => {
            expect(line).not.toMatch(/annualTargets\.P\s*<\s*15/);
        });
        expect(liveAssignments.length).toBeGreaterThan(0);
    });
});

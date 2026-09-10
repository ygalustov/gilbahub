/**
 * GH-331 — a live retest on the original "Burns" AU/MLSN golf_greens site
 * showed a genuine, confirmed P deficit (Required P=14 kg/ha every month)
 * still delivering zero P all year. Root cause: AU had no mechanism at all
 * to actively ADD P when needed -- selectNitrogenSource()/
 * selectFoliarNitrogen() only ever deliver P as an accidental byproduct of
 * whichever product wins the N-delivery competition. A genuine P-correction
 * product (SOL-MAP, 12-22-0, deliberately rate-capped to 15 kg/ha on
 * greens) can never win that competition on N-delivery grounds -- it simply
 * cannot supply enough N. Confirmed live: both products actually selected
 * (Sportsmaster WSF 20-0-0, Ammonium Sulphate 21-0-0) carry no P at all.
 *
 * FIX: ported the same strategic-month approach already proven in
 * prebbles-products.js (NZ) -- compute the full annual P requirement up
 * front, and if genuinely deficient (annualTargets.P > 5, same threshold NZ
 * uses), designate ONE agronomically sensible month (first spring month,
 * hemisphere-aware, with GP >= 0.4 -- same season logic NZ uses) to begin
 * applying via a new selectPhosphorusSource() (mirrors NZ's tiered P%
 * preference: dedicated >=20% source preferred, then moderate 2-15%, then
 * any with P; MAP preferred by name match -- adapted to this file's product
 * shape: maxRateKgHa/greensMaxRateKgHa/maxRateLHa fields directly on the
 * product, not a `rates` sub-object). AU's gate is actually more robust than
 * NZ's own: it uses annualTargets.P (a magnitude, already computed up front
 * for the ceiling logic) rather than NZ's separately-computed boolean
 * context.pDeficient, which has its own documented history of being fed
 * incorrect soil data (see b35fix427 in nutrition-prebble-integration.js).
 *
 * GH-331 follow-up 3: a single application at pApplicationMonth wasn't
 * always enough -- confirmed live on golf_greens: SOL-MAP capped at its
 * 15 kg/ha greens rate limit (agronomically correct, prevents burn) can
 * only deliver ~3.3 kg P per visit, far short of a 14 kg/ha annual deficit.
 * Changed from a one-shot check at exactly pApplicationMonth to repeating
 * every month from pApplicationMonth onward (each still capped by
 * selectPhosphorusSource()'s own rate limit) until the annual target is met
 * or the season ends -- same spirit as a real spoon-feeding programme.
 */

'use strict';

const fs = require('fs');
const path = require('path');

/**
 * The P SUPPLEMENTATION block, bounded by the two section markers that
 * actually delimit it rather than by a fixed character count.
 *
 * GH-391: the count-based slices (2800 / 3200 chars) failed the moment the
 * block gained a comment, which is a test that breaks on prose rather than on
 * behaviour. The markers below are the block's real start and end.
 */
function pSupplementationBlock(src) {
    const start = src.indexOf('// P SUPPLEMENTATION (GH-331 -- strategic month, repeats if capped)');
    const end = src.indexOf('// K SUPPLEMENTATION — REMOVED b35fix330');
    expect(start).toBeGreaterThan(-1);
    expect(end).toBeGreaterThan(start);
    return src.slice(start, end);
}

describe('GH-331 — AU P supplementation (au-fertiliser-products.js)', () => {
    let src;
    beforeAll(() => {
        src = fs.readFileSync(path.join(__dirname, '../assets/au-fertiliser-products.js'), 'utf8');
    });

    test('selectPhosphorusSource() is defined with the tiered P% preference', () => {
        const idx = src.indexOf('selectPhosphorusSource: function(granular, liquidAndSoluble, pRequired, isGreens) {');
        expect(idx).toBeGreaterThan(-1);
        const block = src.slice(idx, idx + 1600);
        expect(block).toMatch(/pSources = allProducts\.filter\(p => \(p\.analysis\?\.P \|\| 0\) >= 20\)/);
        expect(block).toMatch(/pPct >= 2 && pPct <= 15/);
        expect(block).toMatch(/p\.id \|\| ''\)\.toUpperCase\(\)\.includes\('MAP'\)/);
    });

    test('selectPhosphorusSource() respects a greens-specific max rate', () => {
        const idx = src.indexOf('selectPhosphorusSource: function(granular, liquidAndSoluble, pRequired, isGreens) {');
        const block = src.slice(idx, idx + 1600);
        expect(block).toMatch(/const maxRate = isGreens/);
        expect(block).toMatch(/greensMaxRateKgHa/);
    });

    test('pApplicationMonth is chosen up front, gated on annualTargets.P > 5 (same threshold NZ uses)', () => {
        const idx = src.indexOf('// GH-331: same strategic-month P-application approach');
        expect(idx).toBeGreaterThan(-1);
        const block = src.slice(idx, idx + 1100);
        expect(block).toMatch(/const springMonths = hemisphere === 'south' \? \[8, 9, 10\] : \[2, 3, 4\];/);
        expect(block).toMatch(/if \(annualTargets\.P > 5\) \{/);
        expect(block).toMatch(/pApplicationMonth = springMonths\.find\(idx => monthlyData\[idx\] && monthlyData\[idx\]\.gp >= 0\.4\) \?\? springMonths\[0\];/);
    });

    test('pApplicationMonth is computed before the month loop starts', () => {
        const idx = src.indexOf('let pApplicationMonth = null;');
        expect(idx).toBeGreaterThan(-1);
        const monthLoopIdx = src.indexOf('monthlyData.forEach((month, idx) => {');
        expect(monthLoopIdx).toBeGreaterThan(idx);
    });

    test('the month loop repeats P application from the designated month onward until the annual target is met', () => {
        const idx = src.indexOf('// P SUPPLEMENTATION (GH-331 -- strategic month, repeats if capped)');
        expect(idx).toBeGreaterThan(-1);
        const block = pSupplementationBlock(src);
        expect(block).toMatch(/if \(pApplicationMonth !== null && idx >= pApplicationMonth\) \{/);
        expect(block).toMatch(/const annualPRemaining = Math\.max\(0, annualTargets\.P - delivered\.P\);/);
        expect(block).toMatch(/if \(annualPRemaining > 2\) \{/);
        expect(block).toMatch(/this\.selectPhosphorusSource\(granular, all, annualPRemaining, isGreens\)/);
        expect(block).toMatch(/delivered\.P \+= pProduct\.pDelivered;/);
    });

    test('falls back to a "no suitable P source found" note rather than silently doing nothing', () => {
        expect(pSupplementationBlock(src)).toMatch(/no suitable P source found/);
    });

    test('P supplementation trigger runs inside the month loop, after granular/liquid N selection, before the K-supplementation removal comment', () => {
        const supplementIdx = src.indexOf('// P SUPPLEMENTATION (GH-331 -- strategic month, repeats if capped)');
        const liquidSectionIdx = src.indexOf('// LIQUID APPLICATION');
        const kRemovedIdx = src.indexOf('// K SUPPLEMENTATION — REMOVED b35fix330');
        expect(liquidSectionIdx).toBeGreaterThan(-1);
        expect(supplementIdx).toBeGreaterThan(liquidSectionIdx);
        expect(kRemovedIdx).toBeGreaterThan(supplementIdx);
    });

    test('regression: no reactive accumulator remains', () => {
        expect(src).not.toMatch(/cumulativePShortfall/);
    });
});

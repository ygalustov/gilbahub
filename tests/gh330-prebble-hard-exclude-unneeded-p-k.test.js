/**
 * GH-330 — GH-329 fixed this exact bug class in au-fertiliser-products.js,
 * but a live retest on an NZ site (selectedDistributor: 'prebble') showed
 * identical over-delivery: Ezyreno (QR), analysis 6-2.5-3.7, kept winning
 * granular selection on an AA site with Required P=0 and Required K=0
 * (soil P=40ppm above its 20-30 certificate range, soil K=199ppm above its
 * 78.2-195.5 range). Root cause: `prebbles-products.js` is a completely
 * separate, independently-written recommendation engine (NZ/Prebble
 * catalog, own selectNitrogenSource()/selectFoliarNitrogen()) — none of
 * GH-326/327/328/329's fixes to au-fertiliser-products.js applied here.
 *
 * This file's P defense was only the "starter product" filter
 * (`pPct > 8 && pPct > nPct/2`), which excludes high-P starter blends but
 * lets a low-%-P product like Ezyreno (2.5%) straight through. K's only
 * defense was a token `ratioScore = 80 - kPct` penalty (e.g. -3.7 raw,
 * weighted x0.35 = ~-1.3) inside the N:K ratio scoring, far too weak to
 * outweigh a strong N-match/release/tech-efficiency score. Neither had any
 * hard filter.
 *
 * FIX: same GH-329 pattern -- hard-exclude candidates that would deliver
 * more than CLEAN_NUTRIENT_KGHA (2 kg/ha at the rate needed for N) of an
 * unneeded nutrient, provided a clean alternative remains viable for N
 * delivery; falls back to keeping them when no clean alternative exists.
 * Applied to both selectNitrogenSource() (granular) and
 * selectFoliarNitrogen() (liquid/soluble).
 */

'use strict';

const fs = require('fs');
const path = require('path');

describe('GH-330 — hard-exclude unneeded P/K in prebbles-products.js', () => {
    let src;
    beforeAll(() => {
        src = fs.readFileSync(path.join(__dirname, '../assets/prebbles-products.js'), 'utf8');
    });

    test('selectNitrogenSource() reads pRequired from monthData.P', () => {
        const idx = src.indexOf('selectNitrogenSource: function(products, monthData, context) {');
        expect(idx).toBeGreaterThan(-1);
        const block = src.slice(idx, idx + 2700);
        expect(block).toMatch(/const pRequired = monthData\.P \|\| 0;/);
    });

    test('selectNitrogenSource(): hard filter runs before the scoring loop, gated on pRequired <= 0 / kRequired <= 0', () => {
        const idx = src.indexOf('// GH-330: hard-exclude candidates that would deliver a non-trivial');
        expect(idx).toBeGreaterThan(-1);
        const block = src.slice(idx, idx + 3000);
        expect(block).toMatch(/const CLEAN_NUTRIENT_KGHA = 2;/);
        expect(block).toMatch(/if \(pRequired <= 0\) \{/);
        expect(block).toMatch(/if \(cleanP\.length > 0\) nProducts = cleanP;/);
        expect(block).toMatch(/if \(kRequired <= 0\) \{/);
        expect(block).toMatch(/if \(cleanK\.length > 0\) nProducts = cleanK;/);
        const scoringIdx = src.indexOf('nProducts.forEach(product => {');
        expect(scoringIdx).toBeGreaterThan(idx);
    });

    test('selectFoliarNitrogen() reads pRequired and has the same hard filter', () => {
        const idx = src.indexOf('selectFoliarNitrogen: function(liquidProducts, monthData, context) {');
        expect(idx).toBeGreaterThan(-1);
        const block = src.slice(idx, idx + 3000);
        expect(block).toMatch(/const pRequired = monthData\.P \|\| 0; \/\/ GH-330/);
        expect(block).toMatch(/if \(pRequired <= 0\) \{/);
        expect(block).toMatch(/if \(cleanP\.length > 0\) nLiquids = cleanP;/);
        expect(block).toMatch(/if \(kRequired <= 0\) \{/);
        expect(block).toMatch(/if \(cleanK\.length > 0\) nLiquids = cleanK;/);
        const scoringIdx = src.indexOf('nLiquids.forEach(product => {');
        expect(scoringIdx).toBeGreaterThan(idx);
    });

    test('the pre-existing starter-product (high-P) filter is untouched by this fix', () => {
        const matches = src.match(/const isStarterProduct = pPct > 8 && pPct > nPct \/ 2;/g) || [];
        expect(matches.length).toBe(2); // one in each function, unchanged
    });

    test('this engine is genuinely separate from au-fertiliser-products.js -- confirms GH-326/327/328/329 never applied here', () => {
        expect(src).not.toMatch(/soilPSufficient/);
        expect(src).not.toMatch(/annualTargets\.P/);
    });
});

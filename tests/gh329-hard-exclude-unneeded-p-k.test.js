/**
 * GH-329 — GH-326/327/328 gave P and K a proper score (reward when needed,
 * penalty when not), but a soft score term can still be outweighed by a
 * strong N-match. Confirmed live: Ezyreno (QR), analysis 6-2.5-3.7 -- a
 * dilute 6% N product needing a large total application mass to hit N
 * targets -- kept winning 9 of 12 months over a concentrated, P/K-free
 * alternative (Lo Biuret Urea 46-0-0) despite Required P/K = 0, because its
 * excellent N-delivery accuracy outweighed the P/K "not needed" penalty.
 * Delivered P=67 kg/ha (Required 0, Range 28-42) and K=99+18=117 kg/ha
 * (Required 0, Range 109.5-273.7) on a real site.
 *
 * User's own diagnosis, confirmed correct: "P/K not needed" isn't a soft
 * trade-off like release-type-vs-GP -- it's a hard constraint, same class
 * as the existing herbicide/N-content pre-filter (which already excludes
 * entirely via `return`, not via score). FIX: hard-exclude candidates that
 * would deliver a non-trivial amount (> CLEAN_NUTRIENT_KGHA = 2 kg/ha
 * effective monthly, the same "minimal" cutoff pScore/kScore's own "not
 * needed" bands already used) of an unneeded nutrient, PROVIDED a clean
 * alternative exists -- falls back to keeping them (so N need is still met)
 * when no clean alternative is viable that month. Applied to both
 * selectNitrogenSource() (granular) and selectFoliarNitrogen() (liquid) for
 * the parity established in GH-328. The pScore/kScore soft penalty stays in
 * place as a secondary tie-breaker among whatever survives the hard filter.
 */

'use strict';

const fs = require('fs');
const path = require('path');

describe('GH-329 — hard-exclude P/K when not needed, in both scoring functions', () => {
    let src;
    beforeAll(() => {
        src = fs.readFileSync(path.join(__dirname, '../assets/au-fertiliser-products.js'), 'utf8');
    });

    test('granular: viableProducts is reassignable (let, not const) so the hard filter can narrow it', () => {
        const idx = src.indexOf('selectNitrogenSource: function(products, monthData, context) {');
        const block = src.slice(idx, idx + 1300);
        expect(block).toMatch(/let viableProducts = \[\];/);
    });

    test('granular: GH-329 hard filter runs before scoring, gated on soilPSufficient / kRequired <= 0', () => {
        const idx = src.indexOf('// GH-329: hard-exclude P/K when not needed');
        expect(idx).toBeGreaterThan(-1);
        const block = src.slice(idx, idx + 1900);
        expect(block).toMatch(/const CLEAN_NUTRIENT_KGHA = 2;/);
        expect(block).toMatch(/if \(soilPSufficient\) \{/);
        expect(block).toMatch(/const cleanP = viableProducts\.filter\(e => effectiveMonthlyOf\(e, 'P'\) <= CLEAN_NUTRIENT_KGHA\);/);
        expect(block).toMatch(/if \(cleanP\.length > 0\) viableProducts = cleanP;/);
        expect(block).toMatch(/if \(kRequired <= 0\) \{/);
        expect(block).toMatch(/if \(cleanK\.length > 0\) viableProducts = cleanK;/);
        // must appear before the scoring loop starts
        const scoringIdx = src.indexOf('viableProducts.forEach(({ product, labelRates, rateNeeded, nPct, monthsCovered, effectiveMonthlyN }) => {');
        expect(scoringIdx).toBeGreaterThan(idx);
    });

    test('granular: falls back to keeping candidates when no clean alternative exists (no unconditional filter)', () => {
        const idx = src.indexOf('// GH-329: hard-exclude P/K when not needed');
        const block = src.slice(idx, idx + 1900);
        // the `if (cleanX.length > 0)` guard is what implements the fallback --
        // an empty clean list leaves viableProducts untouched
        expect(block).toMatch(/if \(cleanP\.length > 0\)/);
        expect(block).toMatch(/if \(cleanK\.length > 0\)/);
    });

    test('liquid: candidates hard filter mirrors the granular one, gated the same way', () => {
        const idx = src.indexOf('// GH-329: same hard exclusion as selectNitrogenSource() (granular)');
        expect(idx).toBeGreaterThan(-1);
        const block = src.slice(idx, idx + 1500);
        expect(block).toMatch(/const CLEAN_NUTRIENT_KGHA = 2;/);
        expect(block).toMatch(/if \(soilPSufficient\) \{/);
        expect(block).toMatch(/if \(cleanP\.length > 0\) candidates = cleanP;/);
        expect(block).toMatch(/if \(kRequired <= 0\) \{/);
        expect(block).toMatch(/if \(cleanK\.length > 0\) candidates = cleanK;/);
    });

    test('liquid: hard filter runs before SCORE CANDIDATES', () => {
        const filterIdx = src.indexOf('// GH-329: same hard exclusion as selectNitrogenSource() (granular)');
        const scoreSectionIdx = src.indexOf('// SCORE CANDIDATES');
        expect(filterIdx).toBeGreaterThan(-1);
        expect(scoreSectionIdx).toBeGreaterThan(filterIdx);
    });

    test('pScore/kScore soft penalties remain in place as secondary tie-breakers (not removed by the hard filter)', () => {
        expect(src).toMatch(/\/\/ SCORE 4: P Delivery Accuracy/);
        expect(src).toMatch(/\/\/ SCORE 7: P Delivery Accuracy/);
    });
});

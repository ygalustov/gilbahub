/**
 * GH-393 — the export and the live page resolve the Prebble recommender's
 * methodology from DIFFERENT sources, under different rules.
 *
 * THIS TEST DOES NOT FIX THE DIVERGENCE. It pins it, so that the day either
 * side moves the suite says so instead of the two surfaces drifting apart in
 * silence. The fix needs a product decision that has not been made — see
 * "WHY NOTHING WAS ALIGNED" below.
 *
 * THE THREE RULES, ALL LIVE TODAY
 *
 *   1. nutrition-calendar.js (drives the Plan page's own requirement figures)
 *      Starts at `soil.methodology`, but treats a bare 'mlsn' as the hub
 *      store's PLACEHOLDER rather than an answer (GH-377's
 *      `_methodologyResolved`), and falls through to the `.gaip-soil-methodology`
 *      DOM select and then `GAIP_HUB_CONFIG.turfMethodology`.
 *
 *   2. nutrition-program-inputs.js `resolveSiteProgramInputs()` (what the
 *      Combined export calls) — `sample.methodology || turf.methodology ||
 *      GAIP_HUB_CONFIG.turfMethodology`, first non-empty wins. No placeholder
 *      concept: a raw 'mlsn' beats the site config outright.
 *
 *   3. NutritionPrebbleIntegration.getMethodology() (what the live Prebble /
 *      NZ panels call) — reads ONLY `GAIP_HUB_CONFIG.turfMethodology`, never
 *      the sample, and folds everything except 'slan' to 'ammonium_acetate'.
 *      It can therefore never return 'mlsn', so the live P threshold is
 *      always 30.
 *
 * The consequence is the P-deficiency threshold `methodology === 'mlsn' ? 21 : 30`,
 * which is duplicated in three files and fed by rule 2 in the export and rule 3
 * on screen. An NZ site whose soil stamp genuinely read MLSN would get 21 in
 * the exported document and 30 on screen for the same sample. Before GH-379 the
 * export's comparison could never match either (word-export.js upper-cases the
 * stamp), so both were 30 by accident.
 *
 * NOT REACHABLE TODAY: NZ coordinates auto-select ammonium acetate, and both
 * NZ sites in the dev DB resolve to 'ammonium_acetate' on both surfaces.
 *
 * WHY NOTHING WAS ALIGNED
 *
 *   "Align the export to the page" is the obvious move and is wrong on its own
 *   terms: rule 3 folds MLSN into AA, and adopting it would cement that fold
 *   while contradicting `normalizeMethodology()` and `prebbles-products.js`
 *   `generateProgram()`, both of which deliberately preserve 'mlsn' and fold
 *   only cotula/bowls to AA. "Align the page to the shared resolver" is equally
 *   wrong: the shared resolver has no placeholder concept, so on data where
 *   every stored sample carries 'mlsn' it would flip NZ AA sites to MLSN.
 *
 *   Underneath both is a question the data cannot currently answer: this hub
 *   cannot distinguish a GENUINE MLSN choice from the hub store's default,
 *   because 'mlsn' is both. All 109 soil samples in the dev DB are stamped
 *   `methodology_snapshot = 'mlsn'`, which is plainly the default and not 109
 *   deliberate choices — which is exactly why nutrition-calendar.js grew the
 *   `_methodologyResolved` heuristic in the first place. Deciding what an NZ
 *   site with a genuine MLSN stamp should use requires first deciding how a
 *   genuine choice is recorded at all. That is a product call, so it is being
 *   handed back rather than picked here.
 */

'use strict';

const fs = require('fs');
const path = require('path');

const read = (rel) => fs.readFileSync(path.join(__dirname, '..', rel), 'utf8');
const NPI = require('../assets/nutrition-program-inputs.js');

describe('GH-393 — the canonical resolver preserves mlsn (rule 2)', () => {
    test('normalizeMethodology folds case, spacing and cotula, but never mlsn', () => {
        expect(NPI.normalizeMethodology('mlsn')).toBe('mlsn');
        expect(NPI.normalizeMethodology('MLSN')).toBe('mlsn');
        expect(NPI.normalizeMethodology('slan')).toBe('slan');
        expect(NPI.normalizeMethodology('AMMONIUM ACETATE')).toBe('ammonium_acetate');
        expect(NPI.normalizeMethodology('cotula_s78')).toBe('ammonium_acetate');
        expect(NPI.normalizeMethodology('')).toBe('');
        expect(NPI.normalizeMethodology(null)).toBe('');
    });

    test('its source chain is sample-first with no placeholder concept', () => {
        const src = read('assets/nutrition-program-inputs.js');
        expect(src).toMatch(
            /const rawMethodology = sample\.methodology \|\| turf\.methodology \|\|\s*\n\s*\(\(_win\(\)\.GAIP_HUB_CONFIG \|\| \{\}\)\.turfMethodology\) \|\| null;/
        );
        // If a placeholder heuristic is ever added here, this divergence has
        // moved and the note above needs rewriting rather than silently ageing.
        const start = src.indexOf('// ── methodology ──');
        const body = src.slice(start, start + 500);
        expect(body).not.toMatch(/_methodologyResolved|placeholder/);
    });
});

describe('GH-393 — the live Prebble panel uses its own rule (rule 3)', () => {
    const src = read('assets/nutrition-prebble-integration.js');

    test('getMethodology() reads only the site config, never the sample', () => {
        const start = src.indexOf('getMethodology: function()');
        expect(start).toBeGreaterThan(-1);
        const body = src.slice(start, src.indexOf('\n        },', start));
        expect(body).toMatch(/GAIP_HUB_CONFIG\?\.turfMethodology/);
        expect(body).not.toMatch(/getActiveSample|sample\./);
    });

    test('getMethodology() folds everything except slan to ammonium_acetate, so it can never return mlsn', () => {
        const start = src.indexOf('getMethodology: function()');
        const body = src.slice(start, src.indexOf('\n        },', start));
        expect(body).toMatch(/if \(_hubMeth === 'slan'\) return 'slan';/);
        expect(body).toMatch(/return 'ammonium_acetate';/);
        // The only two values it can produce.
        const returns = body.match(/return '[a-z_]+';/g) || [];
        expect(returns.sort()).toEqual(["return 'ammonium_acetate';", "return 'slan';"]);
    });
});

describe('GH-393 — the P threshold is one rule written in three places', () => {
    // Duplicated constants are how the two surfaces came to disagree without
    // anyone noticing. Until they are unified, at least make an edit to one
    // copy fail here rather than pass silently.
    const copies = [
        ['assets/nutrition-prebble-integration.js', /const pThreshold = methodology === 'mlsn' \? 21 : 30;/],
        ['assets/nutrition-nz-fertiliser-integration.js', /var pThreshold\s+= methodology === 'mlsn' \? 21 : 30;/],
        ['assets/word-export-combined.js', /var _pThreshold = \(perSampleInputs\.methodology === 'mlsn'\) \? 21 : 30;/]
    ];

    test.each(copies.map(([f]) => [f]))('%s still carries the 21/30 threshold', (file) => {
        const [, re] = copies.find(([f]) => f === file);
        expect(read(file)).toMatch(re);
    });

    test('the export copy is fed from the sample-derived inputs, the page copies from getMethodology()', () => {
        expect(read('assets/word-export-combined.js')).toMatch(/methodology: perSampleInputs\.methodology,/);
        expect(read('assets/nutrition-prebble-integration.js')).toMatch(/const methodology = this\.getMethodology\(\);/);
        expect(read('assets/nutrition-nz-fertiliser-integration.js')).toMatch(/pi\.getMethodology\(\)/);
    });
});

describe('GH-393 — the recommender below both surfaces preserves mlsn', () => {
    test('prebbles-products.js generateProgram() folds only cotula/bowls to AA', () => {
        const src = read('assets/prebbles-products.js');
        const start = src.indexOf('generateProgram: function(calendar, context) {');
        expect(start).toBeGreaterThan(-1);
        // Bounded by the meta block's own end rather than a character count.
        const end = src.indexOf('surfaceType: context.surfaceType,', start);
        expect(end).toBeGreaterThan(start);
        const body = src.slice(start, end);
        expect(body).toMatch(/if \(raw === 'cotula_s78' \|\| raw === 'cotula'\) return 'ammonium_acetate';/);
        expect(body).toMatch(/if \(_isCotula\) return 'ammonium_acetate';/);
        // No blanket fold — an mlsn context reaches the recommender as mlsn.
        expect(body).toMatch(/return raw;/);
    });
});

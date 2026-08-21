/**
 * GH-286 — Nutrient card's expanded "Why?" section rounds the AA
 * "Sufficiency range" row to 1dp, instead of printing raw floating-point
 * noise from the upstream me/100g -> ppm conversion.
 *
 * Confirmed live: Mg card's "Why?" panel showed "Sufficiency range
 * 36.6-85.39999999999999 ppm" (the top-of-card "AA: 36.6-85.4 ppm" line was
 * fine -- that reads a pre-formatted `n.mlsn` string; the "Why?" row reads
 * the raw n.rangeMin/n.rangeMax numbers directly, unrounded, unlike the
 * Soil reserve / Est. annual demand rows right below it which already use
 * .toFixed(1)).
 */

const vm = require('vm');
const fs = require('fs');
const path = require('path');

function loadModule() {
    const realSrc = fs.readFileSync(path.join(__dirname, '../assets/soil-nutrition-analysis.js'), 'utf8');
    const exportLine = 'global.GAIP_SoilNutritionAnalysis = { init: init, mountSampleDropdown: mountSampleDropdown };';
    expect(realSrc).toContain(exportLine);
    const testSrc = realSrc.replace(
        exportLine,
        'global.GAIP_SoilNutritionAnalysis = { init: init, mountSampleDropdown: mountSampleDropdown, __test_renderNutrientCards: renderNutrientCards };'
    );

    const sandbox = {
        window: {},
        document: { createElement: () => ({ textContent: '' }), querySelector: () => null, addEventListener: () => {} },
        console: { log: () => {}, warn: () => {} },
        localStorage: { getItem: () => null },
    };
    sandbox.window.GAIP_DASHBOARD_DATA = {};
    sandbox.global = sandbox;
    sandbox.globalThis = sandbox;
    const ctx = vm.createContext(sandbox);
    vm.runInContext(testSrc, ctx, { filename: 'soil-nutrition-analysis.js' });
    return ctx.window.GAIP_SoilNutritionAnalysis.__test_renderNutrientCards;
}

describe('GH-286 — Sufficiency range row rounds away float noise', () => {
    let renderNutrientCards;
    beforeAll(() => { renderNutrientCards = loadModule(); });

    test('rangeMax with floating-point noise (85.39999999999999) renders as 85.4', () => {
        const html = renderNutrientCards({
            methodology: 'ammonium_acetate',
            nutrients: [
                { nutrient: 'Mg', actual: '40.1', mlsn: '36.6-85.4', statusClass: 'adequate', rangeMin: 36.6, rangeMax: 85.39999999999999 },
            ],
        });
        expect(html).toMatch(/Sufficiency range<\/span><span class="sn-why-val">36\.6–85\.4 ppm/);
        expect(html).not.toMatch(/85\.39999999999999/);
    });

    test('regression — a clean rangeMin/rangeMax still renders as expected (no double rounding artefacts)', () => {
        const html = renderNutrientCards({
            methodology: 'ammonium_acetate',
            nutrients: [
                { nutrient: 'Ca', actual: '600', mlsn: '400-800', statusClass: 'adequate', rangeMin: 400, rangeMax: 800 },
            ],
        });
        expect(html).toMatch(/Sufficiency range<\/span><span class="sn-why-val">400\.0–800\.0 ppm/);
    });
});

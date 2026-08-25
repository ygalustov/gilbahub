/**
 * GH-315 — user was cross-checking the Soil page's AA sufficiency range
 * ("AA: 78.2-195.5 ppm") against the Nutrition Program's "Nutrient Delivery
 * Summary" table's new "Range (kg/ha)" column (GH-312/313, "109.5–273.7")
 * for the same K nutrient on the same site, and the two numbers looked like
 * a mismatch. They're the same range in different units (78.2ppm x 1.4 =
 * 109.5, same bulkDensity*depth*0.1 factor both tables already use) -- not
 * a bug, just no visible unit bridge between the two pages.
 *
 * Rather than add a unit-toggle control to the Nutrition Program table
 * (considered, rejected by the user as more UI than needed), the Soil
 * page's existing ppm range display now also shows the kg/ha equivalent
 * alongside it, using the depthFactor conversion this file already computes
 * for "Soil reserve"/"Est. annual demand" a few lines below.
 *
 * FIX: added to both the main card's visible "AA: {ppm range}" line and the
 * "Why?" panel's "Sufficiency range" row.
 */

'use strict';

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

describe('GH-315 — AA range shows a kg/ha equivalent alongside the ppm range', () => {
    let renderNutrientCards;
    beforeAll(() => { renderNutrientCards = loadModule(); });

    test('K (S277 worked example, 78.2-195.5ppm) shows "(109.5–273.7 kg/ha)" on the main card line', () => {
        const html = renderNutrientCards({
            methodology: 'ammonium_acetate',
            depthCm: 10,
            bulkDensity: 1.4,
            nutrients: [
                { nutrient: 'K', actual: '199', mlsn: '78.2-195.5', statusClass: 'high', rangeMin: 78.2, rangeMax: 195.5 },
            ],
        });
        expect(html).toMatch(/AA: 78\.2-195\.5 ppm \(109\.5–273\.7 kg\/ha\)/);
    });

    test('the same kg/ha equivalent appears in the "Why?" panel Sufficiency range row', () => {
        const html = renderNutrientCards({
            methodology: 'ammonium_acetate',
            depthCm: 10,
            bulkDensity: 1.4,
            nutrients: [
                { nutrient: 'K', actual: '199', mlsn: '78.2-195.5', statusClass: 'high', rangeMin: 78.2, rangeMax: 195.5 },
            ],
        });
        expect(html).toMatch(/Sufficiency range<\/span><span class="sn-why-val">78\.2–195\.5 ppm \(109\.5–273\.7 kg\/ha\)/);
    });

    test('falls back to site defaults (depth 10cm, bulkDensity 1.4) when not supplied, matching Mg from GH-286\'s fixture', () => {
        const html = renderNutrientCards({
            methodology: 'ammonium_acetate',
            nutrients: [
                { nutrient: 'Mg', actual: '40.1', mlsn: '36.6-85.4', statusClass: 'adequate', rangeMin: 36.6, rangeMax: 85.39999999999999 },
            ],
        });
        expect(html).toMatch(/AA: 36\.6-85\.4 ppm \(51\.2–119\.6 kg\/ha\)/);
    });

    test('GH-315 follow-up ("do for all"): MLSN\'s single threshold also gets a kg/ha suffix, using the same mlsnKgHa already computed for the Why-panel rows', () => {
        const html = renderNutrientCards({
            methodology: 'mlsn',
            depthCm: 10,
            bulkDensity: 1.4,
            nutrients: [
                { nutrient: 'K', actual: '50', mlsn: '37', statusClass: 'adequate' },
            ],
        });
        expect(html).toMatch(/<div class="sn-card-threshold">MLSN: 37 ppm \(51\.8 kg\/ha\)<\/div>/);
    });

    test('MLSN threshold with no numeric mlsn value renders without a kg/ha suffix (no crash)', () => {
        const html = renderNutrientCards({
            methodology: 'mlsn',
            nutrients: [
                { nutrient: 'K', actual: '50', mlsn: null, statusClass: 'adequate' },
            ],
        });
        expect(html).toMatch(/<div class="sn-card-threshold">MLSN: — ppm<\/div>/);
    });

    test('regression: generic-range badge still renders after the kg/ha text', () => {
        const html = renderNutrientCards({
            methodology: 'ammonium_acetate',
            depthCm: 10,
            bulkDensity: 1.4,
            nutrients: [
                { nutrient: 'S', actual: '75', mlsn: '30-60', statusClass: 'high', rangeMin: 30, rangeMax: 60, rangeSource: 'texture-fallback' },
            ],
        });
        expect(html).toMatch(/AA: 30-60 ppm \(42\.0–84\.0 kg\/ha\).*sn-generic-badge/);
    });
});

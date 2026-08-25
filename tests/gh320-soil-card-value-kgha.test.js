/**
 * GH-320 — the Soil page card's threshold/range line already shows a kg/ha
 * equivalent alongside ppm (GH-315), but the card's main measured value
 * (n.actual, the large number at the top of the card) did not, even though
 * its kg/ha equivalent (reserveKgHa) was already computed for the hidden
 * "Why?" panel's "Soil reserve" row.
 *
 * FIX: append the same kg/ha equivalent to the main visible value line.
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

describe('GH-320 — main card value shows a kg/ha equivalent alongside ppm', () => {
    let renderNutrientCards;
    beforeAll(() => { renderNutrientCards = loadModule(); });

    test('AA: K at 199ppm shows "(278.6 kg/ha)" on the main value line', () => {
        const html = renderNutrientCards({
            methodology: 'ammonium_acetate',
            depthCm: 10,
            bulkDensity: 1.4,
            nutrients: [
                { nutrient: 'K', actual: '199', mlsn: '78.2-195.5', statusClass: 'high', rangeMin: 78.2, rangeMax: 195.5 },
            ],
        });
        expect(html).toMatch(/<div class="sn-card-value">199 <span>ppm<\/span> <span>\(278\.6 kg\/ha\)<\/span><\/div>/);
    });

    test('MLSN: K at 50ppm shows "(70.0 kg/ha)" on the main value line', () => {
        const html = renderNutrientCards({
            methodology: 'mlsn',
            depthCm: 10,
            bulkDensity: 1.4,
            nutrients: [
                { nutrient: 'K', actual: '50', mlsn: '37', statusClass: 'adequate' },
            ],
        });
        expect(html).toMatch(/<div class="sn-card-value">50 <span>ppm<\/span> <span>\(70\.0 kg\/ha\)<\/span><\/div>/);
    });

    test('non-numeric actual value renders without a kg/ha suffix, no crash', () => {
        const html = renderNutrientCards({
            methodology: 'mlsn',
            nutrients: [
                { nutrient: 'K', actual: 'N/A', mlsn: '37', statusClass: 'adequate' },
            ],
        });
        expect(html).toMatch(/<div class="sn-card-value">N\/A <span>ppm<\/span><\/div>/);
    });
});

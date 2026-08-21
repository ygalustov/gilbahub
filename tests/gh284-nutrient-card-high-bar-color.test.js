/**
 * GH-284 — Nutrient Status card progress bar now uses a distinct blue for
 * HIGH, matching the card's own border/badge, instead of falling through
 * to the same green used for Sufficient.
 *
 * Confirmed live (Russley, AA): P/K/Ca/Mg/S/Fe/Zn cards all showed the blue
 * "high" card border + blue "▲ HIGH" badge, but the progress bar inside
 * each was green -- barClr's ternary only branched on 'deficient' (red)
 * and 'borderline' (amber); every other status class, including 'high',
 * fell through to the same '#22c55e' green used for 'adequate'/'sufficient'.
 *
 * Fix: barClr now also branches on sc==='high' -> '#3b82f6' (the same blue
 * family as .sn-card.high's border-color:#93c5fd / .sn-badge.high's
 * color:#1e40af elsewhere in this file's CSS).
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

describe('GH-284 — Nutrient Status card bar colour matches HIGH status', () => {
    let renderNutrientCards;
    beforeAll(() => { renderNutrientCards = loadModule(); });

    function cardFor(nutrients) {
        return renderNutrientCards({
            methodology: 'ammonium_acetate',
            nutrients: nutrients,
        });
    }

    test('a HIGH nutrient gets the blue bar fill (#3b82f6), not green', () => {
        const html = cardFor([
            { nutrient: 'P', actual: '40.0', statusClass: 'high', rangeMin: 20, rangeMax: 30 },
        ]);
        expect(html).toMatch(/width:100\.0%;background:#3b82f6/);
        expect(html).not.toMatch(/width:100\.0%;background:#22c55e/);
    });

    test('regression — deficient, borderline, and sufficient bar colours are unaffected', () => {
        const html = cardFor([
            { nutrient: 'B', actual: '0.2', statusClass: 'deficient', rangeMin: 0.4, rangeMax: 1.5 },
            { nutrient: 'Mn', actual: '28.3', statusClass: 'borderline', rangeMin: 10, rangeMax: 50 },
            { nutrient: 'Cu', actual: '1.3', statusClass: 'adequate', rangeMin: 0.5, rangeMax: 3.0 },
        ]);
        expect(html).toMatch(/background:#ef4444/); // deficient
        expect(html).toMatch(/background:#f59e0b/); // borderline
        expect(html).toMatch(/background:#22c55e/); // adequate/sufficient
    });
});

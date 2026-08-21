/**
 * GH-289 — Soil–Tissue Cross-Validation's antagonism findings no longer
 * show JSON.stringify() artefact quotes.
 *
 * Confirmed live (seen at the very start of this session's Tissue Test
 * Results review): "Antagonism: "High P with low Zn (possible P→Zn
 * antagonism)" interaction detected in tissue." -- the double-quoted,
 * redundant-sounding text was a real bug, not intentional formatting.
 *
 * Root cause: tissue-engine.js's detectAntagonisms() returns an array of
 * plain, already-complete sentence strings (e.g. "High P with low Zn
 * (possible P→Zn antagonism)"), not objects. renderCrossValidation() tried
 * ant.element || ant.pair (neither exists on a string) and fell through to
 * JSON.stringify(ant), which just wraps the string in quotes. Fixed to use
 * the string directly -- it already reads as a complete sentence, so the
 * old "Antagonism: ... interaction detected in tissue." wrapper is dropped
 * too (it was redundant on top of being broken).
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
        'global.GAIP_SoilNutritionAnalysis = { init: init, mountSampleDropdown: mountSampleDropdown, __test_renderCrossValidation: renderCrossValidation };'
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
    return ctx.window.GAIP_SoilNutritionAnalysis.__test_renderCrossValidation;
}

describe('GH-289 — Cross-Validation antagonism messages', () => {
    let renderCrossValidation;
    beforeAll(() => { renderCrossValidation = loadModule(); });

    test('a real detectAntagonisms()-shaped string renders as-is, no quotes, no redundant wrapper', () => {
        const sn = {
            // renderCrossValidation() early-returns '' unless soilNutrients.length
            // is truthy -- a nutrient with no matching tissue.normalized entry
            // satisfies that guard without producing its own finding.
            nutrients: [{ nutrient: 'P', actual: '40', statusClass: 'adequate' }],
            tissue: {
                normalized: {},
                antagonisms: ['High P with low Zn (possible P→Zn antagonism)'],
            },
        };
        const html = renderCrossValidation(sn);
        expect(html).toContain('High P with low Zn (possible P&Zn antagonism)'.replace('&', '→'));
        expect(html).not.toMatch(/&quot;High P/);
        expect(html).not.toMatch(/Antagonism:.*interaction detected in tissue/);
    });

    test('multiple antagonisms each render as their own clean finding', () => {
        const sn = {
            nutrients: [{ nutrient: 'K', actual: '150', statusClass: 'adequate' }],
            tissue: {
                normalized: {},
                antagonisms: [
                    'High K with low Mg (possible K→Mg antagonism)',
                    'High Ca with low Mg (possible Ca→Mg antagonism)',
                ],
            },
        };
        const html = renderCrossValidation(sn);
        expect(html).toContain('High K with low Mg (possible K→Mg antagonism)');
        expect(html).toContain('High Ca with low Mg (possible Ca→Mg antagonism)');
    });

    test('regression — soil-vs-tissue findings (not antagonisms) are unaffected', () => {
        const sn = {
            nutrients: [
                { nutrient: 'K', actual: '150', statusClass: 'adequate' },
            ],
            tissue: {
                normalized: { K: 1.5 }, // well below a typical K range -> tissue deficient
            },
        };
        const html = renderCrossValidation(sn);
        expect(html).toMatch(/Soil K adequate \(150 ppm\) but tissue deficient/);
    });
});

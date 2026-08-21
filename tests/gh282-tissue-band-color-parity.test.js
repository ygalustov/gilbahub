/**
 * GH-282 — Tissue Test Results badge label and colour now come from ONE
 * classification, matching the old hub instead of two disagreeing ones.
 *
 * Bug: renderTissue() sourced `band` (the text) from `statusMap[nut].band`
 * (tissue-engine.js's classify() -- a 4-tier scheme: Deficient <lo,
 * Marginal lo-lo*1.10, Sufficient, High >hi) but sourced `cls` (the badge
 * colour) from this file's own, separately-thresholded tissueBand() -- a
 * 5-tier scheme (Deficient <lo*0.9, Marginal lo*0.9-lo, Sufficient,
 * Elevated >hi, High >hi*1.1). For a value in the lo*0.9-lo gap (e.g. K at
 * 2% against a 2.2-3.5% range), classify() already calls it "Deficient" but
 * the old tissueBand() called the same value "Marginal" -- producing a
 * badge that read "Deficient" in amber/borderline styling instead of red.
 *
 * Confirmed against the old hub: tissue-progressive-disclosure.js (loaded
 * in hub.blade.php, the actual headless-compute path) only ever renders 4
 * statuses -- Deficient/Marginal/Sufficient/High, no "Elevated" -- and
 * derives both label and CSS class from the SAME band value via one
 * getTissueStatus(band) switch. tissueBand()'s old 5-tier scheme was a
 * new-hub-only invention with no old-hub equivalent.
 *
 * Fix: tissueBand() now uses the same 4-tier thresholds as classify()
 * (dropping "Elevated" and the lo*0.9/hi*1.1 grace bands), and both the
 * live-data path (statusMap present) and the fallback path derive `cls`
 * from `band` via a single bandToClass() map, not a second calculation.
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
        'global.GAIP_SoilNutritionAnalysis = { init: init, mountSampleDropdown: mountSampleDropdown, __test_renderTissue: renderTissue };'
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
    return ctx.window.GAIP_SoilNutritionAnalysis.__test_renderTissue;
}

describe('GH-282 — tissue band/colour parity with the old hub', () => {
    let renderTissue;
    beforeAll(() => { renderTissue = loadModule(); });

    test('K at 2% (Bentgrass range 2.2-3.5%) reads "Deficient" with the deficient (red) badge class, not borderline', () => {
        const tissue = {
            normalized: { K: 2 },
            status: { K: { band: 'Deficient', score: 0 } }, // real classify() output for this value
        };
        const html = renderTissue(tissue);
        expect(html).toMatch(/<span class="sn-badge deficient">[^<]*Deficient<\/span>/);
        expect(html).not.toMatch(/sn-badge borderline">[^<]*Deficient/);
    });

    test('a value just above lo (Marginal band) gets the borderline class, matching its own label', () => {
        // Bentgrass K range 2.2-3.5; 2.25 is between lo and lo*1.10 (2.42) -> Marginal.
        const tissue = {
            normalized: { K: 2.25 },
            status: { K: { band: 'Marginal', score: 1 } },
        };
        const html = renderTissue(tissue);
        expect(html).toMatch(/<span class="sn-badge borderline">[^<]*Marginal<\/span>/);
    });

    test('fallback path (no statusMap entry) uses the same 4-tier thresholds as classify(), not the old 5-tier scheme', () => {
        // No `status` object at all -- forces the local tissueBand() fallback.
        const tissue = { normalized: { K: 2 } };
        const html = renderTissue(tissue);
        // Old 5-tier tissueBand() would have said "Marginal"/borderline here
        // (2 >= 2.2*0.9=1.98). Corrected 4-tier says Deficient (2 < 2.2), same
        // as classify() would.
        expect(html).toMatch(/<span class="sn-badge deficient">[^<]*Deficient<\/span>/);
    });

    test('"Elevated" no longer appears anywhere -- the old hub never had this band', () => {
        const tissue = {
            // Bentgrass Fe range 50-300; 320 is >hi but <=hi*1.1(330) -- old
            // scheme called this "Elevated"/borderline.
            normalized: { Fe: 320 },
        };
        const html = renderTissue(tissue);
        expect(html).not.toMatch(/Elevated/);
        expect(html).toMatch(/<span class="sn-badge high">[^<]*High<\/span>/);
    });

    test('regression — clearly sufficient and clearly high values are unaffected', () => {
        const tissue = { normalized: { K: 2.8, Fe: 500 } }; // both well inside/above range
        const html = renderTissue(tissue);
        expect(html).toMatch(/<span class="sn-badge adequate">[^<]*Sufficient<\/span>/);
        expect(html).toMatch(/<span class="sn-badge high">[^<]*High<\/span>/);
    });
});

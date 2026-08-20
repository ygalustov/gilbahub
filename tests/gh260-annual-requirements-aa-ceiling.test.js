/**
 * Test GH-260 — renderAnnualRequirements() uses the real AA ceiling
 * (D07 item 3, third piece: the Soil page's own "Annual Nutrient
 * Requirements" panel, not nutrition-requirement-engine.js's separate
 * Nutrition Program figure — that's D07 item 6, not this one).
 *
 * BUG: this function already had a ceiling-to-zero mechanism
 * (`isHigh -> rounded = 0`), but for AA it compared `actual` against
 * `nObj.targetPpm`, which — before mlsnEngine's AA branch fix (this same
 * GH-260) — was always populated from the broken MLSN-fallthrough formula,
 * not a real AA ceiling. Now that mlsnEngine sets `targetPpm` to the AA
 * range's floor (matching SLAN's convention) and separately carries
 * `rangeMax` (the real ceiling), this function must read `rangeMax`
 * specifically for AA, not `targetPpm`.
 *
 * `renderAnnualRequirements` is not exported by soil-nutrition-analysis.js
 * (only `init`/`mountSampleDropdown` are, via `global.GAIP_SoilNutritionAnalysis`).
 * This test loads the file under `vm` and splices one extra test-only export
 * onto that same object in an in-memory copy of the source (the file on disk
 * is never modified) so the internal function can be called directly.
 */

const vm = require('vm');
const fs = require('fs');
const path = require('path');

function loadModule() {
    const realSrc = fs.readFileSync(path.join(__dirname, '../assets/soil-nutrition-analysis.js'), 'utf8');
    const exportLine = 'global.GAIP_SoilNutritionAnalysis = { init: init, mountSampleDropdown: mountSampleDropdown };';
    expect(realSrc).toContain(exportLine); // fails loudly if the export line ever changes shape
    const testSrc = realSrc.replace(
        exportLine,
        'global.GAIP_SoilNutritionAnalysis = { init: init, mountSampleDropdown: mountSampleDropdown, __test_renderAnnualRequirements: renderAnnualRequirements };'
    );

    const sandbox = {
        window: {},
        document: { createElement: () => ({ textContent: '' }), querySelector: () => null },
        console: { log: () => {}, warn: () => {} },
        localStorage: { getItem: () => null },
    };
    sandbox.window.GAIP_DASHBOARD_DATA = {};
    sandbox.global = sandbox;
    sandbox.globalThis = sandbox;
    const ctx = vm.createContext(sandbox);
    vm.runInContext(testSrc, ctx, { filename: 'soil-nutrition-analysis.js' });
    return ctx.window.GAIP_SoilNutritionAnalysis.__test_renderAnnualRequirements;
}

describe('GH-260 — renderAnnualRequirements() AA ceiling', () => {
    let renderAnnualRequirements;
    beforeAll(() => {
        renderAnnualRequirements = loadModule();
    });

    test('module loads and exposes the internal function via the test splice', () => {
        expect(typeof renderAnnualRequirements).toBe('function');
    });

    describe('AA methodology', () => {
        function aaSn(actualK, rangeMaxK) {
            return {
                methodology: 'ammonium_acetate',
                annualDemand: { K: 40 },
                nutrients: [
                    { nutrient: 'K', actual: String(actualK), mlsn: '78.2-195.5', targetPpm: '78.2', status: 'HIGH', statusClass: 'high', rangeMin: 78.2, rangeMax: rangeMaxK },
                ],
            };
        }

        test('actual >= rangeMax -> requirement is zeroed (HIGH/ceiling reached)', () => {
            const html = renderAnnualRequirements(aaSn(199, 195.5));
            expect(html).toMatch(/sn-annual-value">0</);
            expect(html).toMatch(/exceeds AA sufficiency range/);
        });

        test('actual just below rangeMax -> NOT zeroed, normal demand figure used', () => {
            const html = renderAnnualRequirements(aaSn(150, 195.5));
            expect(html).toMatch(/sn-annual-value">40</);
            expect(html).not.toMatch(/exceeds AA sufficiency range/);
        });

        test('does NOT fall back to the MLSN ×1.5 wording/threshold for AA', () => {
            const html = renderAnnualRequirements(aaSn(199, 195.5));
            expect(html).not.toMatch(/exceeds MLSN target/);
        });
    });

    describe('MLSN methodology — REGRESSION, untouched by the AA-specific branch', () => {
        function mlsnSn(actualK, mlsnV) {
            return {
                methodology: 'mlsn',
                annualDemand: { K: 40 },
                nutrients: [
                    { nutrient: 'K', actual: String(actualK), mlsn: String(mlsnV), targetPpm: '', status: 'HIGH', statusClass: 'high' },
                ],
            };
        }

        test('still ceilings at 1.5x MLSN when targetPpm is absent (pre-existing fallback, unchanged)', () => {
            // mlsnV=37 -> ceiling at 37*1.5=55.5; actual=60 is above it.
            const html = renderAnnualRequirements(mlsnSn(60, 37));
            expect(html).toMatch(/sn-annual-value">0</);
            expect(html).toMatch(/exceeds MLSN target/);
        });

        test('below the 1.5x MLSN ceiling -> normal demand figure, unchanged', () => {
            const html = renderAnnualRequirements(mlsnSn(40, 37));
            expect(html).toMatch(/sn-annual-value">40</);
        });
    });
});

/**
 * Test GH-277 — renderAnnualRequirements() no longer claims "Application
 * required to meet annual demand" for a nutrient that was never measured.
 *
 * BUG: `demandVal` (the displayed kg/ha/yr figure) comes from
 * `calcAnnualDemand()` — a pure function of turf type + growth potential +
 * N program, independent of whether the nutrient was actually tested. That
 * part is fine. But `isHigh` (the ceiling check) requires a real `actual`
 * value (`!isNaN(actual)`), so an untested nutrient can never be flagged
 * HIGH -- correct instinct, don't claim a ceiling you can't verify. The bug
 * was in the `else` branch: `noteText` unconditionally said "Application
 * required to meet annual demand." whenever `isHigh` was false, which
 * includes the untested case -- so a "Not measured" status badge sat next
 * to a confident soil-based recommendation for a nutrient whose actual
 * level is genuinely unknown (could be HIGH too, same as P was before the
 * ceiling fix, just unverifiable). Confirmed live on Russley: S showed
 * "Not measured" + "5.4 kg/ha/yr" + "Application required to meet annual
 * demand" side by side.
 *
 * FIX: when the nutrient's status resolves to 'no-data' (not measured) and
 * isHigh is false, show an honest "Not measured" note instead. Measured
 * nutrients (Low/Sufficient/Borderline) keep the existing note text
 * unchanged. This branch is shared across AA/MLSN/SLAN (not AA-gated), so
 * all three are covered by the same fix.
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

describe('GH-277 — renderAnnualRequirements() honest note for not-measured nutrients', () => {
    let renderAnnualRequirements;
    beforeAll(() => {
        renderAnnualRequirements = loadModule();
    });

    function snWithS(methodology, sStatus) {
        return {
            methodology: methodology,
            annualDemand: { K: 40, S: 5.4 },
            nutrients: [
                { nutrient: 'K', actual: '150', mlsn: '78.2-195.5', targetPpm: '78.2', status: 'SUFFICIENT', statusClass: 'sufficient', rangeMin: 78.2, rangeMax: 195.5 },
                sStatus,
            ],
        };
    }

    describe('AA methodology', () => {
        test('not-measured nutrient shows the honest note, not "Application required"', () => {
            const sn = snWithS('ammonium_acetate', { nutrient: 'S', actual: null, status: 'No data', statusClass: 'no-data' });
            const html = renderAnnualRequirements(sn);
            // S's card specifically
            const sCard = html.split('<div class="sn-annual-card">').find(c => c.includes('>S<'));
            expect(sCard).toMatch(/Not measured.*annual removal estimate only, soil status unknown/);
            expect(sCard).not.toMatch(/Application required to meet annual demand/);
        });

        test('still shows the demand figure (5.4) for the not-measured nutrient -- value unaffected, only the note text changes', () => {
            const sn = snWithS('ammonium_acetate', { nutrient: 'S', actual: null, status: 'No data', statusClass: 'no-data' });
            const html = renderAnnualRequirements(sn);
            expect(html).toMatch(/sn-annual-value">5\.4</);
        });

        test('measured Sufficient nutrient (K) keeps the existing "Application required" text, unchanged', () => {
            const sn = snWithS('ammonium_acetate', { nutrient: 'S', actual: null, status: 'No data', statusClass: 'no-data' });
            const html = renderAnnualRequirements(sn);
            const kCard = html.split('<div class="sn-annual-card">').find(c => c.includes('>K<'));
            expect(kCard).toMatch(/Application required to meet annual demand/);
        });

        test('measured Low nutrient still gets "Application required", not the not-measured note', () => {
            const sn = {
                methodology: 'ammonium_acetate',
                annualDemand: { Ca: 9 },
                nutrients: [
                    { nutrient: 'Ca', actual: '220', mlsn: '400.0-800.0', targetPpm: '400.0', status: 'LOW', statusClass: 'deficient', rangeMin: 400.0, rangeMax: 800.0 },
                ],
            };
            const html = renderAnnualRequirements(sn);
            expect(html).toMatch(/Application required to meet annual demand/);
            expect(html).not.toMatch(/Not measured/);
        });
    });

    describe('MLSN methodology — same fix applies (branch is not AA-gated)', () => {
        test('not-measured nutrient shows the honest note under MLSN too', () => {
            const sn = {
                methodology: 'mlsn',
                annualDemand: { S: 5.4 },
                nutrients: [
                    { nutrient: 'S', actual: null, mlsn: '', targetPpm: '', status: 'No data', statusClass: 'no-data' },
                ],
            };
            const html = renderAnnualRequirements(sn);
            expect(html).toMatch(/Not measured.*annual removal estimate only, soil status unknown/);
            expect(html).not.toMatch(/Application required to meet annual demand/);
        });
    });

    describe('regression — HIGH/ceiling messaging untouched', () => {
        test('AA HIGH nutrient still shows the ceiling message, not the not-measured note', () => {
            const sn = {
                methodology: 'ammonium_acetate',
                annualDemand: { K: 40 },
                nutrients: [
                    { nutrient: 'K', actual: '199', mlsn: '78.2-195.5', targetPpm: '78.2', status: 'HIGH', statusClass: 'high', rangeMin: 78.2, rangeMax: 195.5 },
                ],
            };
            const html = renderAnnualRequirements(sn);
            expect(html).toMatch(/exceeds AA sufficiency range/);
            expect(html).not.toMatch(/Not measured/);
        });
    });
});

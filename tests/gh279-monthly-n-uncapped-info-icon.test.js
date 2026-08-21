/**
 * GH-279 — Monthly N Distribution (Soil page) gets an "i" info icon
 * clarifying it is NOT capped by "Max N per month".
 *
 * Context (GH-278 investigation): this chart and the Nutrition Program
 * page's "Monthly Nutrient Program" table both split the same site-level
 * Annual N Program total across months by growth potential, and read the
 * exact same underlying annual figure -- but Nutrition Program additionally
 * applies NutritionCalendar.applyNCap() (a user-configured "Max N per
 * month" cap, redistributing overflow into other active months), while
 * this chart shows the raw, uncapped GP-weighted split. Same annual total,
 * different per-month numbers by design -- without an explanation, a peak
 * month here reads as a bigger number than Nutrition Program's capped
 * figure for the same month, which looks like a bug but isn't.
 *
 * Fix: add a 'sn-monthly-n-uncapped' GAIP_GLOSSARY entry and a
 * `.db-info-icon` button (the same info-icon component already used
 * elsewhere on this page, e.g. 'sn-status'/'sn-compliance') next to the
 * chart's section title.
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
        'global.GAIP_SoilNutritionAnalysis = { init: init, mountSampleDropdown: mountSampleDropdown, __test_renderMonthlyN: renderMonthlyN };'
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
    return ctx;
}

describe('GH-279 — Monthly N Distribution uncapped-info icon', () => {
    let ctx, renderMonthlyN;

    beforeAll(() => {
        ctx = loadModule();
        renderMonthlyN = ctx.window.GAIP_SoilNutritionAnalysis.__test_renderMonthlyN;
    });

    test('GAIP_GLOSSARY has an sn-monthly-n-uncapped entry explaining the cap difference', () => {
        const entry = ctx.window.GAIP_GLOSSARY['sn-monthly-n-uncapped'];
        expect(entry).toBeTruthy();
        expect(entry.title).toMatch(/Monthly N Distribution/i);
        expect(entry.body).toMatch(/Max N per month/i);
        expect(entry.body).toMatch(/Nutrition Program/i);
    });

    test('renderMonthlyN() output includes the info-icon button wired to that glossary key', () => {
        const sn = { monthlyN: [
            { n: 24, gp: 90 }, { n: 23, gp: 87 }, { n: 18, gp: 67 }, { n: 9, gp: 34 },
            { n: 4, gp: 14 }, { n: 0, gp: 5 }, { n: 0, gp: 4 }, { n: 0, gp: 6 },
            { n: 4, gp: 13 }, { n: 7, gp: 25 }, { n: 13, gp: 47 }, { n: 20, gp: 75 },
        ] };
        const html = renderMonthlyN(sn);

        expect(html).toMatch(/class="db-info-icon"\s+data-info="sn-monthly-n-uncapped"/);
        // Icon sits inside the chart's own section title, not floating elsewhere.
        const titleIdx = html.indexOf('Monthly N Distribution (GP-Weighted)');
        const iconIdx = html.indexOf('data-info="sn-monthly-n-uncapped"');
        expect(titleIdx).toBeGreaterThan(-1);
        expect(iconIdx).toBeGreaterThan(titleIdx);
        expect(iconIdx - titleIdx).toBeLessThan(150);
    });

    test('regression — chart bars and total/active-months line are unaffected by the icon addition', () => {
        const sn = { monthlyN: [
            { n: 24, gp: 90 }, { n: 23, gp: 87 }, { n: 18, gp: 67 }, { n: 9, gp: 34 },
            { n: 4, gp: 14 }, { n: 0, gp: 5 }, { n: 0, gp: 4 }, { n: 0, gp: 6 },
            { n: 4, gp: 13 }, { n: 7, gp: 25 }, { n: 13, gp: 47 }, { n: 20, gp: 75 },
        ] };
        const html = renderMonthlyN(sn);
        expect(html).toMatch(/Total: 122 kg N\/ha\/yr · 9 active growing months/);
    });
});

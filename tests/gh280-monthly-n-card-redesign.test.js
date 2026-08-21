/**
 * GH-280 — Monthly N Distribution restyled to match the rest of the Soil
 * page's card-based design language, instead of the flat pastel-season-fill
 * block style it had (visually inconsistent with .sn-card/.sn-annual-card
 * elsewhere on the same page -- flagged by the user as "looks like it's
 * from the old hub").
 *
 * Old style: solid pastel background per season (inline
 * style="background:#fef9c3" etc.), current month marked with a heavy
 * black outline+offset.
 *
 * New style: white bordered card per month (matching .sn-card/.sn-annual-card),
 * with a 3px colour-accented top border per season -- the same accent-strip
 * idiom already used by the KPI cards (kpiCard()'s border-left-color) on
 * this same page, not a new pattern. Current month gets a solid dark border
 * instead of an outline. Inactive (0 kg) months get a distinct `.inactive`
 * class instead of an inline opacity style.
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
    return ctx.window.GAIP_SoilNutritionAnalysis.__test_renderMonthlyN;
}

describe('GH-280 — Monthly N Distribution card-based redesign', () => {
    let renderMonthlyN;
    const sn = { monthlyN: [
        { n: 24, gp: 90 }, { n: 23, gp: 87 }, { n: 18, gp: 67 }, { n: 9, gp: 34 },
        { n: 4, gp: 14 }, { n: 0, gp: 5 }, { n: 0, gp: 4 }, { n: 0, gp: 6 },
        { n: 4, gp: 13 }, { n: 7, gp: 25 }, { n: 13, gp: 47 }, { n: 20, gp: 75 },
    ] };

    beforeAll(() => {
        renderMonthlyN = loadModule();
    });

    test('active months carry a season-* accent class, not an inline pastel background', () => {
        const html = renderMonthlyN(sn);
        expect(html).toMatch(/class="sn-month-col season-(summer|autumn|winter|spring)"/);
        expect(html).not.toMatch(/style="background:#fef9c3/);
        expect(html).not.toMatch(/style="background:#ffedd5/);
        expect(html).not.toMatch(/style="background:#eff6ff/);
        expect(html).not.toMatch(/style="background:#f0fdf4/);
    });

    test('zero-value months get an .inactive class, not an inline opacity style', () => {
        const html = renderMonthlyN(sn);
        expect(html).toMatch(/class="sn-month-col inactive"/);
        expect(html).not.toMatch(/opacity:0?\.5/);
        expect(html).toMatch(/class="sn-month-val inactive"/);
    });

    test('current month is marked with a "Now" dot indicator, not a border/outline (GH-281 -- a border read as a warning, not "you are here")', () => {
        const html = renderMonthlyN(sn);
        expect(html).not.toMatch(/outline:2px solid/);
        expect(html).not.toMatch(/class="sn-month-col[^"]*\bcurrent\b/);
        // Exactly one non-empty "Now" indicator across all 12 columns.
        const nowMatches = html.match(/class="sn-month-now"/g) || [];
        expect(nowMatches).toHaveLength(1);
        const emptyMatches = html.match(/class="sn-month-now sn-month-now-empty"/g) || [];
        expect(emptyMatches).toHaveLength(11);
    });

    test('the card-per-month CSS (white background, bordered, top accent) is defined', () => {
        const src = fs.readFileSync(path.join(__dirname, '../assets/soil-nutrition-analysis.js'), 'utf8');
        expect(src).toMatch(/\.sn-month-col\{[^}]*background:#fff[^}]*border:1px solid #d8e0dc[^}]*border-top-width:3px/);
        expect(src).toMatch(/\.sn-month-col\.season-summer\{border-top-color:#eab308\}/);
        expect(src).toMatch(/\.sn-month-now\{[^}]*color:#16a34a/);
    });

    test('regression — total, active count, and per-month values unaffected by the restyle', () => {
        const html = renderMonthlyN(sn);
        expect(html).toMatch(/Total: 122 kg N\/ha\/yr · 9 active growing months/);
        expect(html).toMatch(/>24</);
        expect(html).toMatch(/>20</);
    });
});

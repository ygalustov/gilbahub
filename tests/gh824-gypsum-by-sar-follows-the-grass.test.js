/**
 * GH-824 (queue item 3di) — GYPSUM BY SAR FOLLOWS THE SITE'S GRASS, ON THE PAGE AS IN THE REPORT.
 *
 * The report judged the water's SAR by threshold set 2, which depends on the grass; the Analysis page and the water
 * engine judged every grass by 3 / 6 / 9. Now one shared file (`water-levels-by-grass.js`) holds the set, the grass
 * type and the scale; the report and the engine read it, the engine saves the SAR level, and the page prints what was
 * saved. Every expectation is read from that module -- the declaration -- not written here.
 *
 * Two cases the reviewer named, because a number would say how many sites change today and a case keeps it from
 * changing silently tomorrow: a species the resolver calls warm-season and the old substring list called cool-season
 * (`St Augustine` -- measured the only such name; the key `mixedWarm` is reached by no species name), and
 * the resolver giving no answer (`isC4 === null`), whose expectation is named: no grass type, no set, no level -- the
 * water is not judged by a grass nobody named.
 *
 * NOT here, named: the page's water verdict (`wbVerdict`) reads `wb.sar`, a key the saved result does not have, so SAR
 * does not reach that verdict today; and the SAR scale tooltip keeps its words -- both wait for a decision.
 */
'use strict';

const fs = require('fs');
const path = require('path');
const vm = require('vm');
const { renderPage } = require('./lib/page-render-bench');
const { loadPage, SITE_ID } = require('./helpers/export-page-sandbox');

const ROOT = path.join(__dirname, '..');
const read = (f) => fs.readFileSync(path.join(ROOT, f), 'utf8');

function say(s) { process.stdout.write(s + '\n'); }

/** The module and the water engine in one context, as the runner loads them. */
function engine() {
    const sb = { console: { log() {}, warn() {}, error() {} }, Math, JSON, Object, Array, String, Number, isFinite };
    sb.window = sb;
    sb.document = { addEventListener() {}, getElementById: () => null, querySelector: () => null, querySelectorAll: () => [] };
    const ctx = vm.createContext(sb);
    vm.runInContext(read('assets/water-levels-by-grass.js'), ctx);
    vm.runInContext(read('assets/water-progressive-disclosure-WITH-SOIL-INTERACTION.js'), ctx);
    return ctx;
}
const ENGINE = engine();
const WL = ENGINE.GAIP_WaterLevels;

/** A water of this SAR with no bicarbonate (Ca 2 meq, Mg 1 meq). */
function ionsFor(sar) { return { Ca: 40, Mg: 12.15, Na: sar * Math.sqrt(1.5) * 23.0 }; }

function diagnostics(sar, turf) {
    return vm.runInContext('calculateWaterDiagnostics(' + JSON.stringify(ionsFor(sar)) + ', 0.8, 7.0, ' + JSON.stringify(turf) + ')', ENGINE);
}

function pagePrinted(wb) {
    return renderPage({
        file: 'water-balance-analysis.js', entry: 'render', container: 'wb-page-content', argumentIsNone: true,
        shared: ['dashboard-ui.js', 'water-levels-by-grass.js'],
        globals: { GAIP_DASHBOARD_DATA: { computed: { waterBalance: wb, soilNutrition: null } } },
    }).printed;
}

/** The page's three readers of gypsum by SAR, each by itself. */
function pageSays(sar, turf) {
    const text = pagePrinted({ SAR: sar, diagnostics: diagnostics(sar, turf) });
    return { card: text.indexOf('Gypsum Recommendation') !== -1, recommendation: text.indexOf('High Sodium Hazard') !== -1 };
}

describe('GH-824 — gypsum by SAR follows the grass', () => {
    jest.setTimeout(300000);
    let page;
    beforeAll(() => { page = loadPage({ errors: [], warnings: [], alerts: [] }); expect(page.failures).toEqual([]); });

    async function reportFor(species, sar) {
        page.putSiteMethodology('mlsn');
        page.putSiteSpecies(species);
        page.putWaterReadings(Object.assign({ pH: 7.0, EC: 0.8, K: 4, Cl: 44, SO4: 12, HCO3: 0, CO3: 0, B: 0.2, Fe: 0.3, NO3: 2, PO4: 0.5, Mn: 0.1 }, ionsFor(sar)));
        const data = page.sandbox.GAIP_WordExport.collectData(page.sandbox.GAIP_NutritionProgramInputs.resolveExportInputs({ siteId: SITE_ID }));
        const gv = data._gypsumVerdict || {};
        return { isC4: data.turf.isC4, basis: gv.basis || null, sar: data.water && data.water.SAR,
            level: gv.SAR ? gv.SAR.level : null, gypsum: !!(gv.gypsum && gv.gypsum.causes.indexOf('sar') !== -1) };
    }

    const CASES = [['Perennial Ryegrass', false, 3.5], ['Perennial Ryegrass', false, 4.5], ['Couch', true, 5],
        ['Perennial Ryegrass', false, 10], ['Couch', true, 10]];
    const want = (isC4, sar) => WL.gypsumBySar(WL.waterLevel('SAR', sar, WL.speciesBasis({ isC4: isC4 })));

    test('the boundaries themselves, from the module: no gypsum at 3.5 on C3 and at 5 on C4; gypsum at 4.5 on C3', () => {
        expect(CASES.map(([, isC4, sar]) => want(isC4, sar))).toEqual([false, true, false, true, true]);
    });

    test('the page\'s soil structure card follows the module', () => {
        const got = CASES.map(([sp, isC4, sar]) => [sp, sar, pageSays(sar, { isC4: isC4 }).card]);
        say('[gh824] card: ' + JSON.stringify(got));
        expect(got).toEqual(CASES.map(([sp, isC4, sar]) => [sp, sar, want(isC4, sar)]));
    });

    test('the page\'s recommendation follows the module', () => {
        const got = CASES.map(([sp, isC4, sar]) => [sp, sar, pageSays(sar, { isC4: isC4 }).recommendation]);
        say('[gh824] recommendation: ' + JSON.stringify(got));
        expect(got).toEqual(CASES.map(([sp, isC4, sar]) => [sp, sar, want(isC4, sar)]));
    });

    test('the report follows the module', async () => {
        const got = [];
        for (const [sp, isC4, sar] of CASES) {
            const r = await reportFor(sp, sar);
            got.push([sp, sar, r.basis, r.gypsum]);
        }
        say('[gh824] report: ' + JSON.stringify(got));
        expect(got).toEqual(CASES.map(([sp, isC4, sar]) => [sp, sar, WL.speciesBasis({ isC4: isC4 }), want(isC4, sar)]));
    });

    test('St Augustine: the resolver says warm-season (the old list said cool), so the report judges it as C4', async () => {
        const r = await reportFor('St Augustine', 5);
        say('[gh824] St Augustine: ' + JSON.stringify(r));
        expect([r.isC4, r.basis]).toEqual([true, WL.speciesBasis({ isC4: true })]);
        expect(r.level).toBe(WL.waterLevel('SAR', r.sar, 'C4'));
    });

    test('the resolver gave no answer: no grass type, no level -- on the engine, the page and the report', async () => {
        const d = diagnostics(10, { isC4: null }).filter((x) => x.parameter === 'SAR')[0];
        const p = pageSays(10, { isC4: null });
        const r = await reportFor('', 10);
        say('[gh824] no answer from the resolver: engine level ' + JSON.stringify(d.level) + ', page ' + JSON.stringify(p) + ', report ' + JSON.stringify(r));
        expect({ engine: d.level, page: p, report: [r.isC4, r.basis, r.level, r.gypsum] })
            .toEqual({ engine: null, page: { card: false, recommendation: false }, report: [null, null, null, false] });
    });

    test('the SARadj card keeps its own scale (only SAR is judged by the grass)', () => {
        const adj = diagnostics(5, { isC4: false }).filter((x) => x.parameter === 'SARadj')[0];
        say('[gh824] SARadj card at SAR 5 on C3: ' + JSON.stringify({ status: adj.status, recommendation: adj.recommendation }));
        expect({ status: adj.status, recommendation: adj.recommendation })
            .toEqual({ status: 'Marginal', recommendation: 'Consider preventative gypsum (Suarez 1981 method)' });
    });

    test('the report reads the module: what the module answers is the report\'s level', async () => {
        const wl = page.sandbox.GAIP_WaterLevels;
        const real = wl.waterLevel;
        wl.waterLevel = (indicator, value, basis) => (indicator === 'SAR' ? 'critical' : real(indicator, value, basis));
        let r;
        try { r = await reportFor('Perennial Ryegrass', 1); } finally { wl.waterLevel = real; }
        say('[gh824] report with the module answering critical: ' + JSON.stringify(r));
        expect([r.level, r.gypsum]).toEqual(['critical', true]);
    });

    test('every view that loads the page or the engine loads the module before it', () => {
        const dir = path.join(ROOT, 'app/resources/views');
        const views = [];
        (function walk(d) { fs.readdirSync(d).forEach((f) => { const p = path.join(d, f); if (fs.statSync(p).isDirectory()) walk(p); else if (f.endsWith('.blade.php')) views.push(p); }); })(dir);
        const users = views.filter((v) => /water-balance-analysis\.js|water-progressive-disclosure-WITH-SOIL-INTERACTION\.js/.test(fs.readFileSync(v, 'utf8')));
        const missing = users.filter((v) => {
            const s = fs.readFileSync(v, 'utf8');
            const m = s.indexOf('water-levels-by-grass.js');
            const u = Math.min(...['water-balance-analysis.js', 'water-progressive-disclosure-WITH-SOIL-INTERACTION.js'].map((x) => (s.indexOf(x) === -1 ? Infinity : s.indexOf(x))));
            return m === -1 || m > u;
        }).map((v) => path.relative(dir, v));
        say('[gh824] views loading the page or the engine: ' + users.length + ' ' + JSON.stringify(users.map((v) => path.relative(dir, v))) + '; without the module first: ' + JSON.stringify(missing));
        expect(users.length).toBeGreaterThan(0);
        expect(missing).toEqual([]);
    });
});

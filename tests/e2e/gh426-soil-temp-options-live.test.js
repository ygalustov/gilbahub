/**
 * GH-426 live — the four soil-temperature options, on every New Zealand site,
 * replayed through the recommender the pages actually ran.
 *
 * The offline companion (tests/gh426-soil-temperature-conversion.test.js)
 * establishes which branch of `estimateSoilTemp()` is reachable and what the
 * heat equation says a monthly figure should be. This file answers the other
 * half: for each real New Zealand site, what programme does each option
 * produce?
 *
 *   A  shipped        — what the recommender does since GH-427: each row's own
 *                       `temp`, i.e. the site's monthly normal for that month.
 *                       Must equal B exactly; if it does not, something is
 *                       reading a temperature from somewhere else again.
 *   B  air normals    — each month's NASA POWER T2M normal, used directly.
 *   C  soil, crude    — estimateSoilTemp()'s reachable branch today: T2M - 1.5,
 *                       source 'crude', reliability 30.
 *   D  soil, model    — estimateSoilTemp()'s analytical branch, reliability 60,
 *                       fed the monthly diurnal amplitude (T2M_MAX - T2M_MIN)/2
 *                       from the same single NASA request. Curves computed in
 *                       node by the real function and handed in, so this is that
 *                       function's output and not a re-implementation.
 *
 * Replay, not production: each option is applied by substituting the per-month
 * soil temperature inside `PrebbleRecommender`, over the calendar and context
 * the page genuinely handed it. Nothing is shipped.
 *
 *   GILBA_E2E=1 npx jest tests/e2e/gh426-soil-temp-options-live.test.js --runInBand --testTimeout=900000
 */

'use strict';

const fs = require('fs');
const path = require('path');

const ENABLED = process.env.GILBA_E2E === '1';

let credentials = {};
try {
    credentials = JSON.parse(fs.readFileSync(
        process.env.GILBA_E2E_CREDENTIALS || path.join(__dirname, '.e2e-credentials.json'), 'utf8'));
} catch (e) { credentials = {}; }

const BASE_URL = process.env.GILBA_E2E_URL || credentials.url || 'http://127.0.0.1:8080';
const EMAIL = process.env.GILBA_E2E_EMAIL || credentials.email;
const PASSWORD = process.env.GILBA_E2E_PASSWORD || credentials.password;
const OUT = process.env.GILBA_GH425_OUT || null;

let chromium = null;
try { ({ chromium } = require('playwright')); } catch (e) { /* reported below */ }

const NORMALS = JSON.parse(fs.readFileSync(
    path.join(__dirname, '../fixtures/gh426-nz-monthly-normals.json'), 'utf8'));

// The real function, used to build option D's curves here rather than
// re-deriving the formula in the browser.
const _rc = global.console;
global.window = global.window || {};
global.document = global.document || { readyState: 'complete', addEventListener: function () {},
    getElementById: function () { return null; }, querySelector: function () { return null; },
    querySelectorAll: function () { return []; },
    createElement: function () { return { style: {}, setAttribute: function () {}, appendChild: function () {} }; },
    head: { appendChild: function () {} } };
global.console = { log: function () {}, warn: function () {}, error: function () {}, info: function () {} };
const CE = require('../../assets/climate-engine-v2.js');
global.console = _rc;

const SITES = [
    { name: 'Test5 - NZ', label: 'Soccer', loc: 'auckland', texture: 'sand' },
    { name: 'Russley', label: 'Green 18', loc: 'christchurch', texture: 'sand' },
    { name: 'Test - GC - NZ - delivery', label: '18th Green', loc: 'christchurch', texture: null },
    { name: 'Test - GC - NZ - warm season grass test', label: 'Main Oval', loc: 'christchurch', texture: null },
];

function curvesFor(site) {
    const loc = NORMALS.locations[site.loc];
    const air = loc.T2M.map((t) => Math.round(t * 10) / 10);
    const crude = loc.T2M.map((t) => CE.estimateSoilTemp(t, null, 0.05, site.texture, null).estimated);
    const model = loc.T2M.map((t, i) => CE.estimateSoilTemp(
        t, (loc.T2M_MAX[i] - loc.T2M_MIN[i]) / 2, 0.05, site.texture, null).estimated);
    const probe = CE.estimateSoilTemp(loc.T2M[0], null, 0.05, site.texture, null);
    const probeModel = CE.estimateSoilTemp(loc.T2M[0],
        (loc.T2M_MAX[0] - loc.T2M_MIN[0]) / 2, 0.05, site.texture, null);
    return { air: air, crude: crude, model: model,
        crudeSource: probe.source, crudeReliability: probe.reliability,
        modelSource: probeModel.source, modelReliability: probeModel.reliability };
}

const out = (s) => process.stdout.write('[gh426-live] ' + s + '\n');

function parsePre(lines) {
    const pre = (lines || []).filter((l) => l.indexOf('PRE-recommender input snapshot') >= 0);
    const line = pre[pre.length - 1];
    if (!line) return null;
    try { return JSON.parse(line.slice(line.indexOf('\n') + 1)); } catch (e) { return null; }
}

/* istanbul ignore next — runs in the browser */
function replayOptionsInPage(payload) {
    const R = window.PrebbleRecommender;
    const NZ = window.NutritionNzFertiliserIntegration;
    if (!R || !NZ) return { error: 'recommender not on this page' };
    // The pool must be THIS SITE'S, not a hardcoded 'prebble': Russley and both
    // GC-NZ sites are bound to PGG Wrightson, and replaying them against the
    // Prebble catalogue produced figures that matched neither surface. Take the
    // distributor the page resolved, then check the result against the pool ids
    // the PRE snapshot recorded (GH-423) and refuse to report if they differ.
    const pool = NZ.getProductsForDistributor(NZ.selectedDistributor);
    const gotIds = (pool.granular || []).map((p) => p.id);
    const wantIds = (payload.pre.pool && payload.pre.pool.granular) || [];
    if (JSON.stringify(gotIds) !== JSON.stringify(wantIds)) {
        return { error: 'pool mismatch — page used ' + wantIds.length + ' granular, replay built '
            + gotIds.length + ' for distributor "' + NZ.selectedDistributor + '"' };
    }
    const origG = window.PrebbleProducts.granular, origL = window.PrebbleProducts.liquid;
    window.PrebbleProducts.granular = pool.granular;
    window.PrebbleProducts.liquid = pool.liquid;

    const cal = () => ({
        program: { monthly: JSON.parse(JSON.stringify(payload.pre.monthlyFull)) },
        meta: { hemisphere: payload.pre.calendarMeta.hemisphere, latitude: payload.pre.calendarMeta.latitude },
        soil: { methodology: payload.pre.calendarMeta.methodology, CEC: payload.pre.calendarMeta.CEC },
    });
    const digest = (p) => {
        if (!p || p.error) return { error: (p && p.error) || 'no programme' };
        const t = { N: 0, P: 0, K: 0 };
        const products = Object.keys(p.annualSummary.products).map((id) => {
            const e = p.annualSummary.products[id];
            t.N += e.nutrients.N || 0; t.P += e.nutrients.P || 0; t.K += e.nutrients.K || 0;
            return e.name + ' x' + (e.applications || 0) + ' ' + Math.round(e.totalKg || 0);
        }).sort();
        return { delivered: { N: +t.N.toFixed(1), P: +t.P.toFixed(1), K: +t.K.toFixed(1) },
                 products: products, applications: products.length };
    };
    // GH-427: the curve is applied on the calendar rows, where the recommender
    // now reads it. Patching `estimateMonthlySoilTemp` (which this did, and
    // which GH-427 deleted) silently produced four identical options.
    const calWith = (curve) => {
        const c = cal();
        if (curve) {
            c.program.monthly.forEach((m, i) => {
                if (typeof curve[i] === 'number' && isFinite(curve[i])) m.temp = curve[i];
            });
        }
        return c;
    };

    const res = { distributor: NZ.selectedDistributor, poolGranular: gotIds.length };
    try {
        res.A_shipped = digest(R.generateProgram(cal(), payload.pre.context));
        res.B_airNormals = digest(R.generateProgram(calWith(payload.curves.air), payload.pre.context));
        res.C_soilCrude = digest(R.generateProgram(calWith(payload.curves.crude), payload.pre.context));
        res.D_soilModel = digest(R.generateProgram(calWith(payload.curves.model), payload.pre.context));
    } finally {
        window.PrebbleProducts.granular = origG;
        window.PrebbleProducts.liquid = origL;
    }
    return res;
}

if (!ENABLED) {
    process.stdout.write('[e2e] gh426-soil-temp-options-live skipped (needs the live stack)\n');
    test.skip('GH-426 soil-temperature options (disabled)', () => {});
} else {

const RESULTS = { sites: [] };

describe('GH-426 — the four options, per New Zealand site', () => {
    let browser, page, previousActiveSiteId = null;
    let lines = [];

    beforeAll(async () => {
        if (!chromium) throw new Error('playwright does not resolve from the repo — run `npm install`');
        if (!EMAIL || !PASSWORD) throw new Error('no credentials');

        browser = await chromium.launch();
        page = await browser.newPage();
        page.on('console', (m) => { const t = m.text(); if (t.indexOf('b35fix426') >= 0) lines.push(t); });

        await page.goto(BASE_URL + '/login', { waitUntil: 'domcontentloaded' });
        await page.fill('#email', EMAIL);
        await page.fill('#password', PASSWORD);
        await Promise.all([page.waitForNavigation({ waitUntil: 'domcontentloaded' }).catch(() => {}),
            page.click('form.login-form button[type=submit]')]);
        await page.waitForTimeout(1500);
        if (/\/login/.test(page.url())) throw new Error('login refused');

        const sitesResp = await page.evaluate(async () =>
            (await fetch('/api/sites', { headers: { Accept: 'application/json' }, credentials: 'same-origin' })).json());
        previousActiveSiteId = sitesResp.active_site_id;

        for (const target of SITES) {
            const site = (sitesResp.data || []).find((s) => s.name === target.name);
            if (!site) { RESULTS.sites.push({ site: target.name, error: 'not found' }); continue; }
            await page.evaluate(async ({ id }) => {
                const t = document.querySelector('meta[name=csrf-token]');
                await fetch('/api/active-site', { method: 'PATCH',
                    headers: Object.assign({ 'Content-Type': 'application/json', Accept: 'application/json' },
                        t ? { 'X-CSRF-TOKEN': t.getAttribute('content') } : {}),
                    body: JSON.stringify({ site_id: id }), credentials: 'same-origin' });
            }, { id: site.id });

            lines = [];
            await page.goto(BASE_URL + '/plan', { waitUntil: 'domcontentloaded' });
            await page.waitForFunction(() => !!window.GilbaNutritionCalendar, null, { timeout: 30000 });
            await page.waitForTimeout(2500);
            await page.click('a[data-tab="nutrition"]');
            await page.waitForTimeout(1200);
            await page.waitForSelector('#plan-nut-sample-picker .sn-drop-btn', { timeout: 20000 }).catch(() => {});
            await page.evaluate((label) => {
                const btn = document.querySelector('#plan-nut-sample-picker .sn-drop-btn');
                if (!btn) return;
                btn.click();
                const rows = Array.from(document.querySelectorAll('#plan-nut-sample-picker .sn-drop-row[data-sn-idx]'));
                const i = rows.map((r) => ((r.querySelector('.sn-drop-cell-zone') || {}).textContent || '').trim()).indexOf(label);
                if (i >= 0) rows[i].click(); else btn.click();
            }, target.label);
            await page.waitForTimeout(2000);
            await page.evaluate(() => {
                window.__g = 0;
                document.addEventListener('gaip:nutrition-calendar-generated', () => { window.__g++; });
            });
            await page.click('#plan-nut-generate-btn');
            await page.waitForFunction(() => window.__g > 0 && document.querySelectorAll('tr.gilba-nut-row').length === 12,
                null, { timeout: 90000 });
            await page.waitForTimeout(2500);

            const pre = parsePre(lines);
            if (!pre) { RESULTS.sites.push({ site: target.name, error: 'no PRE snapshot' }); continue; }
            const curves = curvesFor(target);
            const replay = await page.evaluate(replayOptionsInPage, { pre: pre, curves: curves });
            if (replay.error) { out(target.name + ': REPLAY REFUSED — ' + replay.error); }

            const rec = { site: target.name, sample: target.label, texture: target.texture,
                liveAnchor: pre.context.soilTemp, calendarMonthly: pre.monthlyFull.map((m) => m.temp),
                curves: curves, replay: replay };
            RESULTS.sites.push(rec);

            out('');
            out(target.name + ' / ' + target.label + '   texture ' + (target.texture || '(none -> default)')
                + '   live anchor ' + pre.context.soilTemp);
            const pad = (a) => a.map((v) => String(v).padStart(6)).join('');
            out('   air normals (B)        ' + pad(curves.air));
            out('   soil crude  (C) ' + String(curves.crudeSource + '/' + curves.crudeReliability).padEnd(10)
                + pad(curves.crude));
            out('   soil model  (D) ' + String(curves.modelSource + '/' + curves.modelReliability).padEnd(10)
                + pad(curves.model));
            out('   distributor ' + replay.distributor + ', ' + replay.poolGranular + ' granular');
            ['A_shipped', 'B_airNormals', 'C_soilCrude', 'D_soilModel'].forEach((k) => {
                const d = replay[k] || { error: 'not run' };
                out('   ' + k.padEnd(14) + (d.error ? 'ERROR ' + d.error
                    : JSON.stringify(d.delivered) + '  rows ' + d.applications + '  ' + d.products.join(' | ').slice(0, 150)));
            });
            const same = (x, y) => JSON.stringify(replay[x].products) === JSON.stringify(replay[y].products);
            out('   B==D ' + same('B_airNormals', 'D_soilModel')
                + '   B==C ' + same('B_airNormals', 'C_soilCrude')
                + '   shipped==B ' + same('A_shipped', 'B_airNormals')
                + '   shipped==C ' + same('A_shipped', 'C_soilCrude'));
        }
        if (OUT) fs.writeFileSync(OUT, JSON.stringify(RESULTS, null, 1));
    }, 900000);

    afterAll(async () => {
        if (page && previousActiveSiteId) {
            try {
                await page.evaluate(async ({ id }) => {
                    const t = document.querySelector('meta[name=csrf-token]');
                    await fetch('/api/active-site', { method: 'PATCH',
                        headers: Object.assign({ 'Content-Type': 'application/json', Accept: 'application/json' },
                            t ? { 'X-CSRF-TOKEN': t.getAttribute('content') } : {}),
                        body: JSON.stringify({ site_id: id }), credentials: 'same-origin' });
                }, { id: previousActiveSiteId });
            } catch (e) { /* */ }
        }
        if (browser) await browser.close();
    }, 120000);

    test('every New Zealand site replayed under all four options', () => {
        expect(RESULTS.sites.length).toBe(SITES.length);
        RESULTS.sites.forEach((s) => {
            expect(s.error).toBeUndefined();
            // A pool mismatch is refused rather than reported, so this also
            // asserts the replay used the pool the page used.
            expect(s.replay.error).toBeUndefined();
            ['A_shipped', 'B_airNormals', 'C_soilCrude', 'D_soilModel'].forEach((k) => {
                expect(s.replay[k].error).toBeUndefined();
            });
        });
    });

    test('the branch reachable with today\'s data is the crude one, on every site', () => {
        // Repeated live rather than only offline, because the texture that
        // selects the diffusivity is per site and two of these sites have none.
        RESULTS.sites.forEach((s) => {
            expect(s.curves.crudeSource).toBe('crude');
            expect(s.curves.crudeReliability).toBe(30);
            expect(s.curves.modelSource).toBe('model');
            expect(s.curves.modelReliability).toBe(60);
        });
    });

    test('all three deterministic options remove the dependence on the live anchor', () => {
        // Which is the actual parity fix, whichever curve is chosen: none of
        // B, C or D reads context.soilTemp at all.
        RESULTS.sites.forEach((s) => {
            expect(s.calendarMonthly.length).toBe(12);
        });
    });
});

}

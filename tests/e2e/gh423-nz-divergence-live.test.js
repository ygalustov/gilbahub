/**
 * GH-423 — WHY Test5 - NZ's Plan page and its document print different
 * Delivered figures, established by replay rather than by inspection.
 *
 * THE SYMPTOM. Identical requirement (250.0 N / 5.9 P / 136.1 K) and an
 * identical twelve-month series, but Delivered 247.6 N / 180.7 K on the Plan
 * against 249.7 / 163.5 in the document: the Plan's November foliar top-up is
 * Sportsmaster WSF High K at 20 L/ha, the document's is Lo Biuret Urea at
 * 20 kg/ha, and the January N-balancing Ammos 22 is 50 L/ha against 45.
 *
 * HOW THIS FILE WORKS, AND WHY NOT THE OBVIOUS WAY. `PrebbleRecommender
 * .generateProgram(calendar, context)` is a pure function of three things: the
 * twelve rows of `calendar.program.monthly`, the `context` object, and the
 * `window.PrebbleProducts` pool. So the cause has to be in one of those three,
 * and it can be found by REPLAY: capture what each surface actually handed the
 * recommender (the b35fix426 PRE snapshots, extended under GH-423 to carry the
 * whole monthly row rather than a month/gp/N/K/P summary of it), then run the
 * recommender again here over every combination and see which swap turns one
 * surface's output into the other's.
 *
 * A field that merely DIFFERS is not a cause — that was the mistake this file
 * exists to avoid repeating. `context.soilCEC` differed for a year and was
 * reported as the cause; it could not have been, because 5.9 and 8 sit inside
 * the same band of both functions that read CEC (tests/gh422-soil-cec-input.test.js).
 * Nothing here is called a cause until swapping it alone moves the output.
 *
 *   GILBA_E2E=1 npx jest tests/e2e/gh423-nz-divergence-live.test.js --runInBand --testTimeout=600000
 */

'use strict';

const fs = require('fs');
const os = require('os');
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
const SITE = process.env.GILBA_PARITY_SITE || 'Test5 - NZ';
const LABEL = process.env.GILBA_PARITY_LABEL || 'Soccer';
const OUT = process.env.GILBA_GH423_OUT || null;

let chromium = null;
try { ({ chromium } = require('playwright')); } catch (e) { /* reported below */ }

const out = (s) => process.stdout.write('[gh423] ' + s + '\n');

/** The last PRE snapshot carrying `tag` in a batch of console lines. */
function parsePre(lines, tag) {
    const pre = (lines || []).filter((l) => l.indexOf('PRE-recommender input snapshot') >= 0
        && l.indexOf(tag) >= 0);
    const line = pre[pre.length - 1];
    if (!line) return null;
    try { return JSON.parse(line.slice(line.indexOf('\n') + 1)); }
    catch (e) { return { parseError: String(e && e.message) }; }
}

/* istanbul ignore next — runs in the browser */
function replayInPage(payload) {
    const R = window.PrebbleRecommender;
    const NZ = window.NutritionNzFertiliserIntegration;
    if (!R || !NZ) return { error: 'recommender or NZ integration not loaded on this page' };

    const pool = NZ.getProductsForDistributor('prebble');
    const origG = window.PrebbleProducts.granular;
    const origL = window.PrebbleProducts.liquid;
    window.PrebbleProducts.granular = pool.granular;
    window.PrebbleProducts.liquid = pool.liquid;

    // generateProgram() reads exactly these off the calendar: program.monthly,
    // meta.hemisphere / meta.latitude (both overridden by the context here) and
    // soil.methodology (likewise). Rebuilt rather than re-fetched so the replay
    // uses the captured inputs and nothing of the page it happens to run on.
    const calendarOf = (pre) => ({
        program: { monthly: pre.monthlyFull },
        meta: {
            hemisphere: pre.calendarMeta && pre.calendarMeta.hemisphere,
            latitude: pre.calendarMeta && pre.calendarMeta.latitude,
        },
        soil: {
            methodology: pre.calendarMeta && pre.calendarMeta.methodology,
            CEC: pre.calendarMeta && pre.calendarMeta.CEC,
        },
    });

    const digest = (p) => {
        if (!p || p.error) return { error: (p && p.error) || 'no programme' };
        const totals = { N: 0, P: 0, K: 0 };
        const products = Object.keys(p.annualSummary.products).map((id) => {
            const e = p.annualSummary.products[id];
            totals.N += e.nutrients.N || 0;
            totals.P += e.nutrients.P || 0;
            totals.K += e.nutrients.K || 0;
            return e.name + ' x' + (e.applications || 0) + ' ' + Math.round(e.totalKg || 0)
                + ' [' + (e.nutrients.N || 0).toFixed(1) + '/' + (e.nutrients.P || 0).toFixed(1)
                + '/' + (e.nutrients.K || 0).toFixed(1) + ']';
        }).sort();
        return {
            delivered: { N: +totals.N.toFixed(1), P: +totals.P.toFixed(1), K: +totals.K.toFixed(1) },
            products: products,
            monthly: (p.monthly || []).map((m) => (m.month_name || '?') + ': '
                + (m.granular || []).map((g) => g.name + '@' + g.rateKgHa).join(' + ')
                + ' | ' + (m.liquid || []).map((l) => l.name + '@' + (l.rateLHa != null ? l.rateLHa + 'L' : l.rateKgHa + 'kg')).join(' + ')),
        };
    };

    const plan = payload.plan;
    const doc = payload.document;
    const results = {};
    const run = (name, pre, ctx) => { results[name] = digest(R.generateProgram(calendarOf(pre), ctx)); };

    try {
        // The 2x2: which of the two inputs carries the difference.
        run('planCalendar+planContext', plan, plan.context);
        run('planCalendar+docContext', plan, doc.context);
        run('docCalendar+planContext', doc, plan.context);
        run('docCalendar+docContext', doc, doc.context);

        // One field at a time, plan context with the document's value for it.
        const fields = Array.from(new Set(
            Object.keys(plan.context || {}).concat(Object.keys(doc.context || {}))))
            .filter((k) => JSON.stringify(plan.context[k]) !== JSON.stringify(doc.context[k]));
        results._differingContextFields = fields;
        fields.forEach((f) => {
            const ctx = Object.assign({}, plan.context);
            ctx[f] = doc.context[f];
            run('planContext with doc ' + f, plan, ctx);
        });

        // And the monthly rows: which keys differ, row by row.
        const rowDiffs = [];
        const pm = plan.monthlyFull || [], dm = doc.monthlyFull || [];
        for (let i = 0; i < Math.max(pm.length, dm.length); i++) {
            const a = pm[i] || {}, b = dm[i] || {};
            Array.from(new Set(Object.keys(a).concat(Object.keys(b)))).forEach((k) => {
                if (JSON.stringify(a[k]) !== JSON.stringify(b[k])) {
                    rowDiffs.push({ row: i, key: k, plan: a[k], document: b[k] });
                }
            });
        }
        results._differingMonthlyKeys = rowDiffs;
        results._poolSame = JSON.stringify((plan.pool || {}).granular) === JSON.stringify((doc.pool || {}).granular)
            && JSON.stringify((plan.pool || {}).liquid) === JSON.stringify((doc.pool || {}).liquid);
        results._calendarMeta = { plan: plan.calendarMeta, document: doc.calendarMeta };
    } finally {
        window.PrebbleProducts.granular = origG;
        window.PrebbleProducts.liquid = origL;
    }
    return results;
}

if (!ENABLED) {
    process.stdout.write('[e2e] gh423-nz-divergence-live skipped (needs the live stack)\n');
    test.skip('GH-423 NZ divergence replay (disabled)', () => {});
} else {

const R = { plan: null, document: null, replay: null };

describe('GH-423 — the Test5 - NZ divergence, located by replay', () => {
    let browser, page, previousActiveSiteId = null;
    const planLines = [];
    const docLines = [];
    let planDone = false;

    beforeAll(async () => {
        if (!chromium) throw new Error('playwright does not resolve from the repo — run `npm install`');
        if (!EMAIL || !PASSWORD) throw new Error('no credentials');

        browser = await chromium.launch();
        page = await browser.newPage({ acceptDownloads: true });
        page.on('console', (m) => {
            const t = m.text();
            if (t.indexOf('b35fix426') >= 0) (planDone ? docLines : planLines).push(t);
        });

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
        const site = (sitesResp.data || []).find((s) => s.name === SITE);
        if (!site) throw new Error('site not found: ' + SITE);
        await page.evaluate(async ({ id }) => {
            const t = document.querySelector('meta[name=csrf-token]');
            await fetch('/api/active-site', {
                method: 'PATCH',
                headers: Object.assign({ 'Content-Type': 'application/json', Accept: 'application/json' },
                    t ? { 'X-CSRF-TOKEN': t.getAttribute('content') } : {}),
                body: JSON.stringify({ site_id: id }), credentials: 'same-origin'
            });
        }, { id: site.id });

        // ── Plan ────────────────────────────────────────────────────────────
        await page.goto(BASE_URL + '/plan', { waitUntil: 'domcontentloaded' });
        await page.waitForFunction(() => !!window.GilbaNutritionCalendar, null, { timeout: 30000 });
        await page.waitForTimeout(3000);
        await page.click('a[data-tab="nutrition"]');
        await page.waitForTimeout(1200);
        await page.waitForSelector('#plan-nut-sample-picker .sn-drop-btn', { timeout: 20000 });
        await page.evaluate((label) => {
            const btn = document.querySelector('#plan-nut-sample-picker .sn-drop-btn');
            btn.click();
            const rows = Array.from(document.querySelectorAll('#plan-nut-sample-picker .sn-drop-row[data-sn-idx]'));
            const i = rows.map((r) => ((r.querySelector('.sn-drop-cell-zone') || {}).textContent || '').trim()).indexOf(label);
            if (i >= 0) rows[i].click(); else btn.click();
        }, LABEL);
        await page.waitForTimeout(2500);
        await page.evaluate(() => {
            window.__gen = 0;
            document.addEventListener('gaip:nutrition-calendar-generated', () => { window.__gen++; });
        });
        await page.click('#plan-nut-generate-btn');
        await page.waitForFunction(() => window.__gen > 0 && document.querySelectorAll('tr.gilba-nut-row').length === 12,
            null, { timeout: 90000 });
        await page.waitForTimeout(3000);
        R.plan = parsePre(planLines, 'NutritionNzFertiliserIntegration');
        // Every source getSoilTemperature() consulted, as they stand on the Plan
        // at the moment Generate ran — so "the Plan has no live reading" is read
        // rather than inferred from the resolution order.
        R.planTempSources = await page.evaluate(() => ({
            soilTempModel: window.GAIP_SOIL_TEMP ? window.GAIP_SOIL_TEMP.T_50mm_mean : undefined,
            sensor: window.GAIP_STATE && window.GAIP_STATE.sensor && window.GAIP_STATE.sensor.soilTemp,
            climateMetrics: window.climateMetrics ? window.climateMetrics.temperature : undefined,
            stateClimate: window.GAIP_STATE && window.GAIP_STATE.climate && window.GAIP_STATE.climate.temperature,
            analysisCache: window.GAIP_DASHBOARD_DATA && window.GAIP_DASHBOARD_DATA.computed
                && window.GAIP_DASHBOARD_DATA.computed.climate
                && window.GAIP_DASHBOARD_DATA.computed.climate.temperature,
            // GH-428: the getter is deleted. Kept probed-if-present so this
            // file reports "gone" rather than throwing, and so the sources
            // above are still recorded — they are the evidence for WHICH of
            // them used to answer.
            resolved: (window.NutritionPrebbleIntegration
                && typeof window.NutritionPrebbleIntegration.getSoilTemperature === 'function')
                ? window.NutritionPrebbleIntegration.getSoilTemperature() : 'deleted in GH-428',
        }));
        planDone = true;

        // ── Export ──────────────────────────────────────────────────────────
        await page.goto(BASE_URL + '/reports/export', { waitUntil: 'domcontentloaded' });
        await page.waitForFunction(() => !!(window.GilbaNutritionCalendar && window.GAIP_SampleManager),
            null, { timeout: 30000 });
        // Without this the per-sample recompute is skipped and the only
        // snapshot on this page is its own hidden hub panel — see GH-422.
        await page.waitForFunction(() => {
            const el = document.querySelector('.gaip-nutrition-annual-n');
            return !!(el && el.value);
        }, null, { timeout: 20000 }).catch(() => {});
        await page.waitForTimeout(2500);
        await page.click('text=Generate & Download Word');
        await page.waitForSelector('.gaip-bulk-area-backdrop', { timeout: 15000 });
        await page.waitForTimeout(500);
        await page.click('text=Deselect all');
        await page.waitForTimeout(300);
        await page.evaluate(({ id }) => {
            const boxes = Array.from(document.querySelectorAll('input[data-sample-uid]'))
                .filter((c) => String(c.getAttribute('data-sample-uid') || '').indexOf(id + '::') === 0);
            if (boxes.length) { boxes[0].checked = true; boxes[0].dispatchEvent(new Event('change', { bubbles: true })); }
        }, { id: site.id });
        const [download] = await Promise.all([
            page.waitForEvent('download', { timeout: 180000 }),
            page.locator('button:has-text("Generate & Download")').last().click()
        ]);
        const p = path.join(os.tmpdir(), 'gh423-' + Date.now() + '.docx');
        await download.saveAs(p);
        try { fs.unlinkSync(p); } catch (e) { /* */ }

        R.document = parsePre(docLines, 'CombinedExport');
        if (!R.document) throw new Error('the export produced no [CombinedExport b35fix426] snapshot — '
            + 'the per-sample recompute did not run, so there is nothing to compare the Plan against');

        // ── Replay, on this page (it carries the recommender and the pool) ──
        R.replay = await page.evaluate(replayInPage, { plan: R.plan, document: R.document });

        R.docTempSources = await page.evaluate(() => ({
            soilTempModel: window.GAIP_SOIL_TEMP ? window.GAIP_SOIL_TEMP.T_50mm_mean : undefined,
            sensor: window.GAIP_STATE && window.GAIP_STATE.sensor && window.GAIP_STATE.sensor.soilTemp,
            climateMetrics: window.climateMetrics ? window.climateMetrics.temperature : undefined,
            stateClimate: window.GAIP_STATE && window.GAIP_STATE.climate && window.GAIP_STATE.climate.temperature,
            analysisCache: window.GAIP_DASHBOARD_DATA && window.GAIP_DASHBOARD_DATA.computed
                && window.GAIP_DASHBOARD_DATA.computed.climate
                && window.GAIP_DASHBOARD_DATA.computed.climate.temperature,
            // GH-428: the getter is deleted. Kept probed-if-present so this
            // file reports "gone" rather than throwing, and so the sources
            // above are still recorded — they are the evidence for WHICH of
            // them used to answer.
            resolved: (window.NutritionPrebbleIntegration
                && typeof window.NutritionPrebbleIntegration.getSoilTemperature === 'function')
                ? window.NutritionPrebbleIntegration.getSoilTemperature() : 'deleted in GH-428',
        }));
        out('soil-temperature sources on the PLAN:     ' + JSON.stringify(R.planTempSources));
        out('soil-temperature sources on the EXPORT:   ' + JSON.stringify(R.docTempSources));
        out('pool identical on both surfaces: ' + R.replay._poolSame);
        out('calendar meta: ' + JSON.stringify(R.replay._calendarMeta));
        out('context fields that differ: ' + JSON.stringify(R.replay._differingContextFields));
        out('monthly row keys that differ: ' + JSON.stringify(R.replay._differingMonthlyKeys));
        Object.keys(R.replay).forEach((k) => {
            if (k.charAt(0) === '_') return;
            const d = R.replay[k];
            out(k.padEnd(38) + ' -> ' + JSON.stringify(d.delivered) + (d.error ? ' ERROR ' + d.error : ''));
        });
        const base = R.replay['planCalendar+planContext'];
        const target = R.replay['docCalendar+docContext'];
        out('PLAN  products: ' + JSON.stringify(base && base.products));
        out('DOC   products: ' + JSON.stringify(target && target.products));
        // GH-427: only meaningful when the two surfaces actually disagree.
        // Printed unconditionally, every combination "reproduced the document"
        // once they converged, which read as a finding and was noise.
        if (JSON.stringify(base && base.products) === JSON.stringify(target && target.products)) {
            out('the two surfaces agree — no divergence to explain');
        } else {
            Object.keys(R.replay).forEach((k) => {
                if (k.charAt(0) === '_' || k === 'planCalendar+planContext') return;
                const d = R.replay[k];
                if (d && d.products && JSON.stringify(d.products) === JSON.stringify(target.products)) {
                    out('EXPLAINS THE DIVERGENCE: ' + k + ' reproduces the document exactly');
                }
            });
        }
        if (OUT) fs.writeFileSync(OUT, JSON.stringify(R, null, 1));
    }, 600000);

    afterAll(async () => {
        if (page && previousActiveSiteId) {
            try {
                await page.evaluate(async ({ id }) => {
                    const t = document.querySelector('meta[name=csrf-token]');
                    await fetch('/api/active-site', {
                        method: 'PATCH',
                        headers: Object.assign({ 'Content-Type': 'application/json', Accept: 'application/json' },
                            t ? { 'X-CSRF-TOKEN': t.getAttribute('content') } : {}),
                        body: JSON.stringify({ site_id: id }), credentials: 'same-origin'
                    });
                }, { id: previousActiveSiteId });
            } catch (e) { /* */ }
        }
        if (browser) await browser.close();
    }, 120000);

    test('both surfaces were captured, and the document snapshot is the export\'s own recompute', () => {
        expect(R.plan && R.plan.context).toBeTruthy();
        expect(R.document && R.document.context).toBeTruthy();
        expect(R.document.path).toBe('combined-export-per-sample');
    });

    test('the replay ran and produced a programme for each surface', () => {
        // If this fails, generateProgram() depends on something outside
        // (calendar, context, pool) and the replay cannot locate anything.
        expect(R.replay['planCalendar+planContext'].products).toBeTruthy();
        expect(R.replay['docCalendar+docContext'].products).toBeTruthy();
    });

    test('the product pool and the twelve monthly rows are the same on both surfaces', () => {
        // Deliberately asserted rather than printed: these are the other two
        // inputs generateProgram() reads, and until GH-423 extended the
        // b35fix426 snapshot neither was compared at all. The monthly rows are
        // compared WHOLE here — `temp`, `month_num` and `season` included —
        // not through the month/gp/N/K/P summary that used to stand in for them.
        expect(R.replay._poolSame).toBe(true);
        expect(R.replay._differingMonthlyKeys).toEqual([]);
    });

    test('any divergence in the printed programme is accounted for by a named input', () => {
        // This file locates a cause; it does not require one to exist. It is
        // green when the two surfaces agree, and green when they disagree for a
        // reason it can name. It fails only when they disagree and NOTHING in
        // the captured inputs reproduces it — which would mean generateProgram()
        // is reading something neither surface recorded, and the whole
        // replay-based method is unsound.
        const base = R.replay['planCalendar+planContext'];
        const target = R.replay['docCalendar+docContext'];
        if (JSON.stringify(base.products) === JSON.stringify(target.products)) return;

        const explanations = Object.keys(R.replay).filter((k) => k.charAt(0) !== '_'
            && k !== 'planCalendar+planContext'
            && JSON.stringify(R.replay[k].products) === JSON.stringify(target.products));
        // `docCalendar+docContext` is the document itself and explains nothing;
        // a single-field swap that reproduces it is the finding.
        const singleField = explanations.filter((k) => k.indexOf('planContext with doc ') === 0);
        expect({ divergence: true, explainedBySingleField: singleField })
            .toEqual({ divergence: true, explainedBySingleField: expect.arrayContaining([expect.any(String)]) });
    });
});

}

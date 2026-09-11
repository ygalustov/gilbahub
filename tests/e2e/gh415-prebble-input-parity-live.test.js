/**
 * GH-415 follow-up — the New Zealand recommender's INPUTS, compared field by
 * field between the Plan page and the document.
 *
 * THIS FILE IS A MEASUREMENT, LIKE THE AUDIT HARNESSES. A failure here is a
 * finding, not a build break. It has been red twice and is green now: on
 * `context.soilCEC` until GH-422, then on `context.soilTemp` until GH-427.
 *
 * WHAT IT FOUND, and what came of it. It was written red on one field:
 *
 *     context.soilCEC — Plan 8, document 5.9 (the sample's measured value)
 *
 * `NutritionPrebbleIntegration.getSoilCEC()` read `GAIP_STATE.soil.cec`
 * (lower-case, a slot nothing on the Plan writes), then a `.gaip-cec` DOM input
 * (which lives in partials/legacy-hub-markup.blade.php — on /reports/export,
 * never on /plan), then a construction-type guess, and finally returned a
 * hardcoded 8. Every New Zealand site therefore reached the recommender with
 * CEC 8 on the Plan whatever the certificate said, while the export's hidden
 * hub markup carried the real field and passed 5.9. GH-422 closed that: both
 * surfaces now read the CEC the calendar computed the programme against
 * (computeProgram()'s `soil.CEC`, GH-421), and that row is green.
 *
 * GH-422 ALSO FIXED THIS FILE'S OWN BLIND SPOT, which is why it is red again.
 * It started the export before the page had resolved the site's annual N, so
 * the per-sample recompute was skipped and the only "document" snapshot it
 * could capture was the export page's OWN hidden hub panel — the same
 * NutritionNzFertiliserIntegration code as the Plan's, agreeing with it by
 * construction. With the annual-N wait the snapshot is `[CombinedExport
 * b35fix426]`, the code that actually built the .docx, and a second input
 * divergence appears: `context.soilTemp`, Plan 13 against the document's 12.8.
 * Left red and named, exactly as the CEC row was. See the last test.
 *
 * WHAT THIS FILE DOES NOT SAY, AND WAS ONCE READ AS SAYING. It does not say the
 * CEC gap is why Test5 - NZ's two surfaces printed different Delivered figures
 * (Plan 247.6 N / 180.7 K against the document's 249.7 / 163.5, the document
 * choosing Lo Biuret Urea where the Plan chose Sportsmaster WSF High K). It
 * cannot: CEC reaches product selection through exactly two functions in
 * prebbles-products.js, getReleasePreference() (bands <5 / <12 / >=12, crossed
 * with irrigation frequency) and estimateLongevity() (bands <5 / <10 / >=10),
 * and 5.9 and 8 are inside the same band of both — pinned in
 * tests/gh422-soil-cec-input.test.js. Closing the gap made the two contexts
 * identical and left those Delivered figures exactly where they were. The
 * Delivered divergence has a different cause and is still open; see GH-422 in
 * docs/instructions.md.
 *
 * The distributor pool was eliminated as a cause too — both surfaces resolve
 * `prebble`, 31 granular / 24 liquid.
 *
 * WHAT IT COMPARES. Both sides are read from the snapshot the integration that
 * actually ran logs on its way into PrebbleRecommender.generateProgram()
 * (b35fix426) — the Plan page's and then the export page's. Rebuilding either
 * context by calling the getters from the test would measure a path the page
 * never took: an NZ site is rendered by the distributor-aware
 * nutrition-nz-fertiliser-integration.js, not by NutritionPrebbleIntegration,
 * and not by word-export-combined.js's own Prebble branch either.
 *
 *   GILBA_E2E=1 jest tests/e2e/gh415-prebble-input-parity-live.test.js --runInBand --testTimeout=600000
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

let chromium = null;
try { ({ chromium } = require('playwright')); } catch (e) { /* reported below */ }

const out = (s) => process.stdout.write('[gh415-inputs] ' + s + '\n');

/** The last "PRE-recommender input snapshot" in a batch of console lines. */
function parsePre(lines) {
    const pre = (lines || []).filter((l) => l.indexOf('PRE-recommender input snapshot') >= 0);
    const line = pre[pre.length - 1];
    if (!line) return null;
    try { return JSON.parse(line.slice(line.indexOf('\n') + 1)); }
    catch (e) { return { parseError: String(e && e.message) }; }
}

function diff(a, b, prefix, acc) {
    const keys = Array.from(new Set(Object.keys(a || {}).concat(Object.keys(b || {})))).sort();
    keys.forEach((k) => {
        const x = a ? a[k] : undefined, y = b ? b[k] : undefined;
        const sx = JSON.stringify(x), sy = JSON.stringify(y);
        if (sx !== sy) acc.push({ field: prefix + k, plan: sx, document: sy });
    });
    return acc;
}

if (!ENABLED) {
    process.stdout.write('[e2e] gh415-prebble-input-parity-live skipped (needs the live stack)\n');
    test.skip('prebble recommender input parity (disabled)', () => {});
} else {

const RESULT = { plan: null, document: null, differences: [] };

describe('GH-415 — the NZ recommender is handed the same inputs on both surfaces', () => {
    let browser, page, previousActiveSiteId = null;
    const consoleLines = [];
    const otherLines = [];
    let planLineCount = 0;
    const poolLines = [];
    let planDone = false;

    beforeAll(async () => {
        if (!chromium) throw new Error('playwright does not resolve from the repo — run `npm install`');
        if (!EMAIL || !PASSWORD) throw new Error('no credentials');

        browser = await chromium.launch();
        page = await browser.newPage({ acceptDownloads: true });
        page.on('console', (m) => {
            const t = m.text();
            if (t.indexOf('b35fix426') >= 0) consoleLines.push(t);
            else if (/nzdist-debug/.test(t)) { poolLines.push({ atPlan: !planDone, text: t.replace(/\s+/g, ' ').slice(0, 600) }); }
            else if (/GH-362 branch|per-sample ANR|no programme inputs|skipping this sample/.test(t)) {
                otherLines.push(t.slice(0, 240));
            }
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

        // NOT rebuilt by calling the getters from the test: the panel that
        // actually renders an NZ site is the distributor-aware one
        // (nutrition-nz-fertiliser-integration.js), not
        // NutritionPrebbleIntegration, and reconstructing a context here would
        // measure a code path the page never took. The real one is read out of
        // the snapshot that integration logs on its way into the recommender,
        // which is the same log the export's own copy emits — so the two sides
        // of this comparison are both what ran.
        RESULT.plan = parsePre(consoleLines);
        planLineCount = consoleLines.length;
        planDone = true;

        // ── Export ──────────────────────────────────────────────────────────
        await page.goto(BASE_URL + '/reports/export', { waitUntil: 'domcontentloaded' });
        await page.waitForFunction(() => !!(window.GilbaNutritionCalendar && window.GAIP_SampleManager),
            null, { timeout: 30000 });
        // GH-422: wait for this site's annual N the way the audit harnesses do.
        // Without it the export can be started before the page has soil for the
        // sample, the per-sample recompute is skipped entirely, and the only
        // "document" snapshot this file captures is the export page's OWN hidden
        // hub panel — the same NutritionNzFertiliserIntegration code path as the
        // Plan's, which is not what produced the .docx.
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
        const p = path.join(os.tmpdir(), 'gh415-inputs-' + Date.now() + '.docx');
        await download.saveAs(p);
        try { fs.unlinkSync(p); } catch (e) { /* */ }

        out('recommender snapshots: ' + consoleLines.length + ' (' + planLineCount + ' from the Plan page)');
        otherLines.slice(0, 12).forEach(function (l) { out('  console: ' + l); });
        consoleLines.forEach(function (l, i) {
            out('  snapshot[' + i + '] ' + (i < planLineCount ? 'PLAN    ' : 'DOCUMENT') + ': ' +
                l.split(String.fromCharCode(10))[0].slice(0, 90));
        });
        RESULT.document = parsePre(consoleLines.slice(planLineCount));

        poolLines.forEach(function (p) { out((p.atPlan ? 'PLAN     pool: ' : 'DOCUMENT pool: ') + p.text); });
        out('plan context:     ' + JSON.stringify(RESULT.plan && RESULT.plan.context));
        out('document context: ' + JSON.stringify(RESULT.document && RESULT.document.context));
        diff((RESULT.plan || {}).context, (RESULT.document || {}).context, 'context.', RESULT.differences);
        const pm = (RESULT.plan && RESULT.plan.monthlyNKP) || [];
        const dm = (RESULT.document && RESULT.document.monthlyNKP) || [];
        for (let i = 0; i < Math.max(pm.length, dm.length); i++) {
            diff(pm[i], dm[i], 'monthly[' + i + '].', RESULT.differences);
        }
        RESULT.differences.forEach((d) => out('DIFFERS  ' + d.field + '  plan ' + d.plan + '  document ' + d.document));
        if (!RESULT.differences.length) out('no differences');
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

    test('both surfaces captured a recommender input snapshot', () => {
        expect(RESULT.plan && RESULT.plan.context).toBeTruthy();
        expect(RESULT.document && RESULT.document.context).toBeTruthy();
    });

    test('the twelve monthly rows handed to the recommender are the same series on both surfaces', () => {
        // The requirement half. This is green, and is what says the divergence
        // below is an input to PRODUCT SELECTION and not a second requirement
        // engine.
        expect(RESULT.differences.filter((d) => d.field.indexOf('monthly[') === 0)).toEqual([]);
    });

    test('a soil reading is a soil reading on both surfaces, not a hardcoded stand-in', () => {
        // EXCLUDED, both of them checked against prebbles-products.js rather
        // than assumed:
        //
        //   context.soilPpm — the Plan's getSoilPpm() returns the figures as
        //     the strings the payload stores and the export's
        //     validateSampleInputs() parses them, and the export's object
        //     additionally carries Fe/Mn/Zn/Cu. The recommender reads exactly
        //     two of these keys, `.P` and `.K`, and only in numeric
        //     comparisons, which coerce.
        //   context.muldersFlags — `{}` against absent. prebbles-products.js
        //     never mentions the field; it is the Australian recommender's.
        //   context.soilTemp — GH-427 removed the last thing that read it. The
        //     per-month temperature now comes from each calendar row's own
        //     monthly normal, and `tests/gh424-soil-temp-basis.test.js` sweeps
        //     this field from 8.0 to 20.0 degC in tenths and gets exactly ONE
        //     product set out, which is the evidence for calling it inert rather
        //     than an assumption. It still differs between the surfaces (13
        //     against 12.8 — a persisted analysis cache against a live forecast
        //     mean) and that difference no longer reaches any figure. It is
        //     vestigial in the three context objects that still carry it; worth
        //     removing, but removing it is not what makes the surfaces agree.
        const IGNORED = ['context.soilPpm', 'context.muldersFlags', 'context.soilTemp'];
        const real = RESULT.differences.filter((d) => IGNORED.indexOf(d.field) < 0
            && d.field.indexOf('monthly[') !== 0);
        // WAS red on `context.soilCEC` — Plan 8 (a hardcoded default) against
        // the sample's measured 5.9. Closed by GH-422.
        //
        // WAS THEN RED ON `context.soilTemp` — Plan 13, document 12.8 — which
        // GH-427 closed by removing the reader rather than the difference.
        //
        // It could not be seen before GH-422: without the annual-N wait added
        // above, this file's "document" snapshot was the export page's own
        // hidden hub panel, which runs the SAME NutritionNzFertiliserIntegration
        // code as the Plan and so agreed with it by construction. With the wait,
        // the snapshot compared is `[CombinedExport b35fix426]` — the code that
        // actually produced the .docx.
        //
        // The two resolve soil temperature from different places:
        // getSoilTemperature() prefers window.climateMetrics.temperature.mean
        // (live, full stack, 12.8) and falls through on the Plan to the
        // persisted analysis cache, GAIP_DASHBOARD_DATA.computed.climate
        // .temperature.mean (13). Soil temperature feeds
        // getReleaseTechEfficiency() and estimateMonthlySoilTemp(), so it is a
        // product-selection input, not a display value — it WAS, until GH-427
        // put the per-month temperature on the site's monthly climate normals
        // and deleted the curve that consumed this field.
        expect(real).toEqual([]);
    });
});

}

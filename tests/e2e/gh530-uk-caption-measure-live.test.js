/**
 * GH-530 — A MEASUREMENT, not a fix. Nothing in the product is changed by this
 * file, whatever it finds.
 *
 * GH-529 made the Annual Product Summary caption the sum of the rows printed
 * above it, on the New Zealand and Australian panels and in the Word document,
 * after measuring a caption of 245.5 kg N over rows adding to 245.6 on
 * Test5 - NZ. The United Kingdom panel was found printing the caption the old
 * way and deliberately left alone: what was known about it was its SHAPE, read
 * off the source. Whether it actually disagrees with its own rows was never
 * measured, and a form is not a defect.
 *
 * The question, and the only question: on Test6 - UK, does the caption differ
 * from the sum of the printed rows?
 *
 * SITE: Test6 - UK (019e971b-ec9d-7076-a34d-601bfcc7cb81), 52.24 / 0.38, which
 * is what makes `isUK()` true and this panel the one that renders.
 *
 * SAMPLE: the site holds none, so the panel has nothing to draw. This file
 * creates its own (`gh530-uk-probe`) and the runner removes it afterwards —
 * the same shape as gh526. No `_label` in the payload: that would reach
 * mergeZoneNameIntoSite() and rewrite the site's attributes_json.
 *
 * An outcome of "no difference" is a real answer and is reported as one. A
 * panel that does not render is NOT that answer, and is reported as a
 * measurement that did not happen.
 *
 * STAND PROTECTION (GH-532). The first version of this file carried none, and
 * it presses Generate on a real site: the programme persists itself, and
 * Test6 - UK's configuration had to be put back by hand afterwards. The remedy
 * here is capture-and-restore rather than interception, chosen by what the file
 * needs: `guardStand` would hold the POST that creates the probe sample, and
 * without that sample the picker is empty and the panel has nothing to draw —
 * the writes have to land for the measurement to exist at all. So they land and
 * are undone: the configuration is captured before anything opens a page and
 * put back at the end of the run, and the probe sample is deleted through the
 * product's own route, which is taking back what this run added rather than
 * editing the stand.
 */

'use strict';

const fs = require('fs');
const path = require('path');
const { captureConfigsOnce, restoreConfigs } = require('./lib/stand-guard');

const ENABLED = process.env.GILBA_E2E === '1';

let credentials = {};
try {
    credentials = JSON.parse(fs.readFileSync(
        process.env.GILBA_E2E_CREDENTIALS || path.join(__dirname, '.e2e-credentials.json'), 'utf8'));
} catch (e) { credentials = {}; }

const BASE_URL = process.env.GILBA_E2E_URL || credentials.url || 'http://127.0.0.1:8080';
const EMAIL = process.env.GILBA_E2E_EMAIL || credentials.email;
const PASSWORD = process.env.GILBA_E2E_PASSWORD || credentials.password;

const SITE = { name: 'Test6 - UK', id: '019e971b-ec9d-7076-a34d-601bfcc7cb81' };
const CLIENT_UID = 'gh530-uk-probe';

let chromium = null;
try { ({ chromium } = require('playwright')); } catch (e) { /* reported below */ }

const out = (s) => process.stdout.write('[gh530] ' + s + '\n');

if (!ENABLED) {
    process.stdout.write('[e2e] gh530-uk-caption-measure-live skipped (needs the live stack)\n');
    test.skip('GH-530 UK caption measurement (disabled)', () => {});
} else {
    describe('GH-530 — does the UK caption disagree with its own rows', () => {
        let browser, page;
        const M = {};

        beforeAll(async () => {
            if (!chromium) throw new Error('playwright does not resolve — run `npm install`');
            if (!EMAIL || !PASSWORD) throw new Error('no credentials');
            // GH-532: before anything opens a page. Opening one is already a
            // write on some routes, and a capture taken after the first write
            // restores the moved state and reports success.
            captureConfigsOnce();
            browser = await chromium.launch();
            page = await browser.newPage();
            await page.goto(BASE_URL + '/login', { waitUntil: 'domcontentloaded' });
            await page.fill('#email', EMAIL);
            await page.fill('#password', PASSWORD);
            await Promise.all([
                page.waitForNavigation({ waitUntil: 'domcontentloaded' }).catch(() => {}),
                page.click('form.login-form button[type=submit]')
            ]);
            await page.waitForTimeout(1200);
            if (/\/login/.test(page.url())) throw new Error('login refused');

            M.created = await page.evaluate(async ({ siteId, uid }) => {
                const t = document.querySelector('meta[name=csrf-token]');
                const H = Object.assign({ 'Content-Type': 'application/json', Accept: 'application/json' },
                    t ? { 'X-CSRF-TOKEN': t.getAttribute('content') } : {});
                await fetch('/api/active-site', { method: 'PATCH', headers: H,
                    credentials: 'same-origin', body: JSON.stringify({ site_id: siteId }) });
                const r = await fetch('/api/samples', { method: 'POST', headers: H,
                    credentials: 'same-origin', body: JSON.stringify({
                        site_id: siteId, sample_type: 'soil', client_uid: uid,
                        lab_date: '2026-09-18',
                        payload: { K: 95, P: 22, pH_water: 6.2, zoneType: 'green' },
                    }) });
                return { status: r.status, json: await r.json().catch(() => null) };
            }, { siteId: SITE.id, uid: CLIENT_UID });
            out('sample created → ' + M.created.status
                + ' id=' + (M.created.json && M.created.json.data ? M.created.json.data.id : '<none>'));

            await page.goto(BASE_URL + '/plan', { waitUntil: 'domcontentloaded' });
            await page.waitForFunction(() => !!window.GilbaNutritionCalendar, null, { timeout: 30000 });
            await page.waitForTimeout(2500);
            await page.click('a[data-tab="nutrition"]');
            await page.waitForTimeout(1200);
            await page.waitForSelector('#plan-nut-sample-picker .sn-drop-btn', { timeout: 20000 }).catch(() => {});
            M.picked = await page.evaluate(() => {
                const btn = document.querySelector('#plan-nut-sample-picker .sn-drop-btn');
                if (!btn) return { ok: false, why: 'no picker' };
                btn.click();
                const rows = Array.from(document.querySelectorAll('#plan-nut-sample-picker .sn-drop-row'));
                if (!rows.length) return { ok: false, why: 'picker empty' };
                const label = ((rows[0].querySelector('.sn-drop-cell-zone') || {}).textContent || '').trim();
                rows[0].click();
                return { ok: true, label: label, of: rows.length };
            });
            out('sample pinned: ' + JSON.stringify(M.picked));
            await page.waitForTimeout(1200);

            await page.evaluate(() => { window.__gh530 = 0;
                document.addEventListener('gaip:nutrition-calendar-generated', () => { window.__gh530++; }); });
            await page.click('#plan-nut-generate-btn').catch(() => {});
            await page.waitForFunction(() => window.__gh530 > 0, null, { timeout: 150000 }).catch(() => {});
            await page.waitForTimeout(8000);

            M.table = await page.evaluate(() => {
                const num = (t) => {
                    const v = parseFloat(String(t || '').replace(/[^0-9.\-]/g, ''));
                    return Number.isFinite(v) ? v : null;
                };
                // The UK panel's own table. Located by its class prefix rather
                // than by position, so a layout change reports "not found"
                // instead of reading some other table's numbers.
                const totalsRow = document.querySelector('.uk-fert-totals-row');
                if (!totalsRow) return { rendered: false, why: 'no .uk-fert-totals-row on the page' };
                const table = totalsRow.closest('table');
                if (!table) return { rendered: false, why: 'totals row has no table' };
                const bodyRows = Array.from(table.querySelectorAll('tbody tr'));
                const rows = bodyRows.map((tr) => {
                    const c = Array.from(tr.querySelectorAll('td')).map((td) => td.textContent.trim());
                    return { cells: c, N: num(c[c.length - 3]), P: num(c[c.length - 2]), K: num(c[c.length - 1]) };
                }).filter((r) => r.N !== null || r.P !== null || r.K !== null);
                const tc = Array.from(totalsRow.querySelectorAll('td')).map((td) => td.textContent.trim());
                return {
                    rendered: true,
                    caption: { N: num(tc[tc.length - 3]), P: num(tc[tc.length - 2]), K: num(tc[tc.length - 1]) },
                    captionCells: tc,
                    rows: rows,
                };
            });

            if (!M.table.rendered) {
                out('PANEL DID NOT RENDER: ' + M.table.why + ' — this is a measurement that did not happen, '
                    + 'not an answer of "no difference"');
            } else {
                out('rows printed (' + M.table.rows.length + '):');
                M.table.rows.forEach((r) => out('   ' + JSON.stringify(r.cells)));
                out('caption cells: ' + JSON.stringify(M.table.captionCells));
            }

            // ── take back what this run added ───────────────────────────────
            // The probe sample goes through the product's own delete route
            // (GH-526), not through SQL: it is a record this run created and the
            // product knows how to remove one.
            const probeId = M.created.json && M.created.json.data ? M.created.json.data.id : null;
            if (probeId) {
                M.removed = await page.evaluate(async ({ id }) => {
                    const t = document.querySelector('meta[name=csrf-token]');
                    const r = await fetch('/api/samples/' + id, {
                        method: 'DELETE',
                        headers: Object.assign({ 'Content-Type': 'application/json', Accept: 'application/json' },
                            t ? { 'X-CSRF-TOKEN': t.getAttribute('content') } : {}),
                        credentials: 'same-origin',
                        body: JSON.stringify({ source: 'hub' }),
                    });
                    return r.status;
                }, { id: probeId });
                out('probe sample deleted → HTTP ' + M.removed);
            }

            // And the configuration the Generate press rewrote, put back with
            // its bytes and its timestamp, checked against the database's own
            // md5 by the restore itself. Here rather than in afterAll: afterAll
            // runs after every test, so a test asking whether the stand was put
            // back would read a report that does not exist yet.
            try { M.restore = restoreConfigs(); }
            catch (e) { M.restore = { restored: [], failed: ['the restore threw: ' + (e && e.message)] }; }
            out('GH-519 restore: ' + JSON.stringify(M.restore));
        }, 600000);

        afterAll(async () => { if (browser) await browser.close(); }, 60000);

        test('the stand was put back, and the instrument that put it back says so', () => {
            // GH-532: stated as an assertion rather than left to the teardown, so
            // a run that failed to restore is a red test and not a quiet line on
            // stdout. `failed` empty is the restore's own verdict, taken from the
            // database's md5 per row.
            expect(M.removed).toBe(200);
            expect(M.restore).toBeTruthy();
            expect(M.restore.failed).toEqual([]);
        });

        test('the panel rendered, so there is something to measure', () => {
            expect(M.created.status).toBe(201);
            expect(M.table.rendered).toBe(true);
            expect(M.table.rows.length).toBeGreaterThan(0);
        });

        test('THE MEASUREMENT: caption against the sum of the printed rows', () => {
            expect(M.table.rendered).toBe(true);
            const report = [];
            ['N', 'P', 'K'].forEach((n) => {
                const sum = Math.round(M.table.rows.reduce((a, r) => a + (r[n] || 0), 0) * 10) / 10;
                const cap = M.table.caption[n];
                const diff = Math.round((cap - sum) * 10) / 10;
                report.push({ nutrient: n, caption: cap, sumOfRows: sum, difference: diff });
            });
            report.forEach((r) => out('MEASURED ' + JSON.stringify(r)));
            const differing = report.filter((r) => Math.abs(r.difference) > 1e-9);
            out(differing.length
                ? 'ANSWER: the caption DOES differ — ' + JSON.stringify(differing)
                : 'ANSWER: no difference on this site. The form is unchanged and produces no disagreement here.');
            // This file measures; it does not judge. The assertion is that the
            // measurement was taken and printed, not that it came out either way.
            expect(report).toHaveLength(3);
            report.forEach((r) => expect(typeof r.difference).toBe('number'));
        });
    });
}

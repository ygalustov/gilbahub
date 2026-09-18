/**
 * GH-526 (PLAN-samples-sync-FINAL stage 1) — the server routes, on the real
 * stack.
 *
 * Stage 1 is server-side, so the offline suites see the code and not the wiring:
 * whether the route is registered, whether the old one is really gone, whether
 * the response carries `meta`, and whether a delete leaves the row signed. That
 * is what this file checks, and nothing else.
 *
 * SITE: Test6 - UK (019e971b-ec9d-7076-a34d-601bfcc7cb81), chosen because it
 * holds ZERO samples — any row under its site_id after this run is this run's,
 * with nothing to confuse it with.
 *
 * SAMPLE: none of the stand's. This file CREATES its own
 * (client_uid `gh526-live-probe`) and deletes that one. The payload carries no
 * `_label` on purpose: a label would reach mergeZoneNameIntoSite() and rewrite
 * the site's attributes_json, which is the site's data, not this test's.
 *
 * NOT TOUCHED: `clearSiteData` is never exercised here. Stage 1 made it hide a
 * site's spray_logs and field_log_entries rather than destroy them, and the
 * stand holds exactly three live spray_logs (ids 3, 13, 14) with nothing to
 * replace them. The one-site rule is proved in PHPUnit
 * (Gh526SampleDeleteRouteTest); a live run would add nothing but risk.
 *
 * The row this file creates is removed afterwards by the runner, outside the
 * test, so the stand ends as it began.
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

const SITE = { name: 'Test6 - UK', id: '019e971b-ec9d-7076-a34d-601bfcc7cb81' };
const CLIENT_UID = 'gh526-live-probe';

let chromium = null;
try { ({ chromium } = require('playwright')); } catch (e) { /* reported below */ }

const out = (s) => process.stdout.write('[gh526] ' + s + '\n');

if (!ENABLED) {
    process.stdout.write('[e2e] gh526-stage1-routes-live skipped (needs the live stack)\n');
    test.skip('GH-526 stage 1 routes (disabled)', () => {});
} else {
    describe('GH-526 — stage 1 routes on the real stack', () => {
        let browser, page;
        const R = {};

        beforeAll(async () => {
            if (!chromium) throw new Error('playwright does not resolve — run `npm install`');
            if (!EMAIL || !PASSWORD) throw new Error('no credentials');
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

            R.all = await page.evaluate(async ({ siteId, uid }) => {
                const t = document.querySelector('meta[name=csrf-token]');
                const H = Object.assign(
                    { 'Content-Type': 'application/json', Accept: 'application/json' },
                    t ? { 'X-CSRF-TOKEN': t.getAttribute('content') } : {});
                const call = async (method, url, body) => {
                    const r = await fetch(url, {
                        method, headers: H, credentials: 'same-origin',
                        body: body === undefined ? undefined : JSON.stringify(body),
                    });
                    let json = null;
                    try { json = await r.json(); } catch (e) { json = null; }
                    return { status: r.status, json: json };
                };

                const created = await call('POST', '/api/samples', {
                    site_id: siteId,
                    sample_type: 'soil',
                    client_uid: uid,
                    lab_date: '2026-09-18',
                    payload: { K: 100, zoneType: 'green' },
                });

                const listed = await call('GET', '/api/samples?limit=1');

                const id = created.json && created.json.data ? created.json.data.id : null;
                const removed = id
                    ? await call('DELETE', '/api/samples/' + id, { source: 'hub' })
                    : { status: null, json: { skipped: 'no id to delete' } };

                // The route stage 1 removed. It must not answer.
                const oldRoute = id
                    ? await call('DELETE', '/api/data/entry/' + id, {})
                    : { status: null };

                return { created, listed, removed, oldRoute, id };
            }, { siteId: SITE.id, uid: CLIENT_UID });

            out('POST   → ' + R.all.created.status
                + ' id=' + R.all.id
                + ' methodology_snapshot=' + JSON.stringify(
                    R.all.created.json && R.all.created.json.data
                        ? R.all.created.json.data.methodology_snapshot : '<none>'));
            out('GET    → ' + R.all.listed.status
                + ' meta=' + JSON.stringify(R.all.listed.json && R.all.listed.json.meta));
            out('DELETE → ' + R.all.removed.status
                + ' ' + JSON.stringify(R.all.removed.json && R.all.removed.json.data));
            out('old /api/data/entry → ' + R.all.oldRoute.status);
        }, 300000);

        afterAll(async () => { if (browser) await browser.close(); }, 60000);

        test('the sample was created on the named site', () => {
            expect(R.all.created.status).toBe(201);
            expect(R.all.id).toBeTruthy();
            expect(R.all.created.json.data.site_id).toBe(SITE.id);
            expect(R.all.created.json.data.client_uid).toBe(CLIENT_UID);
        });

        test('index says how much it is holding back', () => {
            expect(R.all.listed.status).toBe(200);
            expect(R.all.listed.json.meta).toBeTruthy();
            expect(R.all.listed.json.meta.returned).toBe(1);
            expect(R.all.listed.json.meta.total).toBeGreaterThan(1);
        });

        test('the per-record delete answers, and says which surface asked', () => {
            expect(R.all.removed.status).toBe(200);
            expect(R.all.removed.json.data.id).toBe(R.all.id);
            expect(R.all.removed.json.data.delete_source).toBe('hub');
        });

        test('the route stage 1 removed no longer answers', () => {
            // 404 (no route) or 405 (method not allowed on a surviving path).
            expect([404, 405]).toContain(R.all.oldRoute.status);
        });
    });
}

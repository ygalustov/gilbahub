/**
 * Question 31 — WHAT ARRIVES AT THE ANALYSIS-CACHE WRITE WHEN A PAGE IS MERELY
 * OPENED. A measurement. No fix, and no direction for one.
 *
 * THE RECORD. Three rows shrank on the stand in one day with no action but a
 * page being opened: Russley 174 093 -> 1 325 bytes, Federal Golf 1 716 -> 783,
 * Canberra 168 087 -> 167 807. What nobody has is WHAT was sent.
 *
 * WHAT IS ESTABLISHED BY READING BEFORE THE RUN, so this file measures only
 * what reading cannot answer:
 *
 *   The row has ONE server writer. `POST /api/analysis-cache` ->
 *   `AnalysisCacheController@store`, and it REPLACES rather than merges — its
 *   closure is `fn () => ['metrics' => …, 'computed' => …]` and never looks at
 *   what is there. So the row becomes exactly what the client sent, and the
 *   size of the row is the size of the payload.
 *
 *   It has THREE client writers, all in `hub-persistence.js`, all sending the
 *   same shape (`metrics: <dashboard>`, `computed: <computed || null>`):
 *   `:134` and `:205` on the Re-run path, and `:2217` `syncToServer()`, which
 *   is the only one carrying the `GILBA_REPORTS_EXPORT` guard. Nothing outside
 *   that file names the route: measured, 0 occurrences.
 *
 *   `syncToServer()` returns early on `!cache.dashboard`, so a wholly empty
 *   dashboard sends nothing at all.
 *
 *   AND THE SHRUNKEN ROWS ARE NOT "computed missing". Read from the database:
 *   a full row is `metrics` 13 keys / `computed` 16-17 keys; Russley and
 *   Federal Golf after the event are `metrics` 5 keys / `computed` 11-12 keys.
 *   Both halves are present and both are thin. Any explanation that turns on
 *   `computed` being null is already ruled out.
 *
 * SO THE QUESTION THIS FILE ANSWERS: what is in `metrics` and `computed` at the
 * moment the request leaves, on a page that was only opened.
 *
 * THE SAFETY, AND WHY NO ROW IS COPIED. `guardStand` intercepts
 * `POST /api/analysis-cache` (and `/api/predictions`, the other thing an opened
 * page writes) and answers it without letting it reach the server. The payload
 * is recorded on the way past. Nothing is written, so nothing needs restoring
 * and no row is put at risk — which is why this measurement does not damage the
 * stand the way the Question 39 round trips had to.
 *
 * THE DISEASE PAGE IS NOT OPENED. Russley's case was on /analysis/disease, and
 * that page is under a standing instruction not to open. /analysis alone
 * reproduces the event — it is what moved Canberra's row — so the measurement
 * does not need it, and its absence is a named limit of this run rather than an
 * oversight.
 *
 * SITE: Test - GC - NZ - delivery, 01a08b0b-4d6a-736d-a184-2fa1e04394b6.
 * Its `analysis_cache` row is currently FULL — md5 c768aa1b…, 171 798 bytes,
 * `metrics` 13 keys, `computed` 17 keys — so a thin payload is visible against
 * it. It is none of the rows under protection: not one of the four marked
 * configurations, not the Test5 - NZ trace, not Canberra, not Test1 - Sports or
 * test4 - USA, which were the Question 39 round trips.
 *
 * WHAT WAS EXPECTED, WRITTEN DOWN BEFORE THE RUN, BOTH OUTCOMES NAMED.
 *   A: opening /analysis produces at least one POST to /api/analysis-cache, and
 *      its payload is SMALLER and THINNER than the row already stored — fewer
 *      `metrics` keys than 13, a `computed` far under the stored size. That
 *      reproduces the event and says what the page sent.
 *   B: no POST is produced, or the payload matches the stored row in shape. Then
 *      opening /analysis is not the writer in this case, the three recorded
 *      losses came from somewhere else, and that is the finding.
 *
 * Any other outcome is reported as the measurement it is. The run prints every
 * intercepted payload, so a quiet result cannot be read as "it did not look".
 *
 * Run: GILBA_E2E=1 npx jest tests/e2e/gh539-empty-analysis-cache-write-live.test.js
 */

'use strict';

const fs = require('fs');
const path = require('path');
const { execFileSync } = require('child_process');

const ENABLED = process.env.GILBA_E2E === '1';

let credentials = {};
try {
    credentials = JSON.parse(fs.readFileSync(
        process.env.GILBA_E2E_CREDENTIALS || path.join(__dirname, '.e2e-credentials.json'), 'utf8'));
} catch (e) { credentials = {}; }

const BASE_URL = process.env.GILBA_E2E_URL || credentials.url || 'http://127.0.0.1:8080';
const EMAIL = process.env.GILBA_E2E_EMAIL || credentials.email;
const PASSWORD = process.env.GILBA_E2E_PASSWORD || credentials.password;

const SITE = { name: 'Test - GC - NZ - delivery', id: '01a08b0b-4d6a-736d-a184-2fa1e04394b6' };

let chromium = null;
try { ({ chromium } = require('playwright')); } catch (e) { /* reported below */ }
let guardStand = null;
try { ({ guardStand } = require('./lib/stand-guard')); } catch (e) { /* reported below */ }

function sql(query) {
    return execFileSync('docker', ['exec', '-i', 'gilba_mysql', 'mysql', '-ugilba', '-pgilba_secret',
        'gilba', '--batch', '--raw', '--skip-column-names'],
        { input: query, encoding: 'utf8', maxBuffer: 256 * 1024 * 1024 }).trim();
}

function storedShape(site) {
    const out = sql("SELECT CONCAT(MD5(config),'~',LENGTH(config),'~',"
        + "JSON_LENGTH(JSON_EXTRACT(config,'$.metrics')),'~',"
        + "IFNULL(JSON_LENGTH(JSON_EXTRACT(config,'$.computed')),-1),'~',"
        + "LENGTH(JSON_EXTRACT(config,'$.computed'))) "
        + "FROM site_configs WHERE site_id='" + site + "' AND namespace='analysis_cache';");
    const p = out.split('~');
    return { md5: p[0], length: Number(p[1]), metricsKeys: Number(p[2]),
             computedKeys: Number(p[3]), computedBytes: Number(p[4]) };
}

if (!ENABLED) {
    process.stdout.write('[e2e] gh539-empty-analysis-cache-write skipped (needs the live stack)\n');
    test.skip('Question 31 (disabled)', () => {});
} else {
    describe('Question 31 — what an opened page sends to the analysis cache', () => {
        let browser, context, guard, page, previousActiveSiteId = null;
        let stored = null, posts = [], pageSaw = null;
        const perPage = {};

        beforeAll(async () => {
            if (!chromium) throw new Error('playwright does not resolve from the repo — run `npm install`');
            if (!guardStand) throw new Error('tests/e2e/lib/stand-guard.js does not resolve');
            if (!EMAIL || !PASSWORD) throw new Error('no credentials');

            stored = storedShape(SITE.id);
            process.stdout.write('[q31] stored row BEFORE: ' + JSON.stringify(stored) + '\n');

            browser = await chromium.launch();
            context = await browser.newContext();
            guard = await guardStand(context);

            // Record the payload on its way past the guard. The guard answers
            // it; nothing reaches the server either way.
            await context.route('**/api/analysis-cache**', async (route) => {
                const req = route.request();
                if (req.method() !== 'GET') {
                    let body = null;
                    try { body = JSON.parse(req.postData() || 'null'); } catch (e) { body = { unparseable: true }; }
                    posts.push({ url: req.url(), bytes: (req.postData() || '').length, body: body });
                }
                await route.fulfill({ status: 200, contentType: 'application/json',
                    body: JSON.stringify({ ok: true, held: 'q31: not written to the stand' }) });
            });

            page = await context.newPage();
            await page.goto(BASE_URL + '/login', { waitUntil: 'domcontentloaded' });
            await page.fill('#email', EMAIL);
            await page.fill('#password', PASSWORD);
            await Promise.all([
                page.waitForNavigation({ waitUntil: 'domcontentloaded' }).catch(() => {}),
                page.click('form.login-form button[type=submit]')
            ]);
            await page.waitForTimeout(1500);
            if (/\/login/.test(page.url())) throw new Error('login refused for ' + EMAIL);

            const sites = await page.evaluate(async () => {
                const r = await fetch('/api/sites', { headers: { Accept: 'application/json' }, credentials: 'same-origin' });
                return r.json();
            });
            previousActiveSiteId = sites.active_site_id;

            await page.evaluate(async ({ id }) => {
                const t = document.querySelector('meta[name=csrf-token]');
                await fetch('/api/active-site', {
                    method: 'PATCH',
                    headers: Object.assign({ 'Content-Type': 'application/json', Accept: 'application/json' },
                        t ? { 'X-CSRF-TOKEN': t.getAttribute('content') } : {}),
                    body: JSON.stringify({ site_id: id }),
                    credentials: 'same-origin',
                });
            }, { id: SITE.id });

            // Open them. Nothing else — no button, no form. The list is the
            // same walk that moved Canberra's row: /analysis produced nothing,
            // so the remaining candidates from that walk are measured too.
            // /reports/export is excluded by reading, not by omission: it sets
            // GILBA_REPORTS_EXPORT, which syncToServer() checks before writing.
            for (const p of ['/analysis', '/data', '/hub']) {
                const mark = posts.length;
                await page.goto(BASE_URL + p, { waitUntil: 'domcontentloaded' });
                await page.waitForTimeout(20000);
                perPage[p] = posts.length - mark;
                process.stdout.write('[q31] ' + p + ' -> ' + perPage[p] + ' POST(s)\n');
            }

            pageSaw = await page.evaluate(() => {
                const P = window.GilbaPersistence;
                let cache = null;
                try {
                    cache = (P && typeof P.collectData === 'function') ? null : null;
                } catch (e) { /* not exposed; the payload above is the measurement */ }
                const body = document.body ? document.body.innerText : '';
                return {
                    noDataMessage: /no analysis data/i.test(body),
                    hasHubConfig: !!window.GAIP_HUB_CONFIG,
                    activeSiteId: (window.GAIP_HUB_CONFIG || {}).activeSiteId || null,
                    reportsExportFlag: !!window.GILBA_REPORTS_EXPORT,
                };
            });

            process.stdout.write('[q31] page: ' + JSON.stringify(pageSaw) + '\n');
            process.stdout.write('[q31] POSTs to /api/analysis-cache: ' + posts.length + '\n');
            posts.forEach((p, i) => {
                const m = (p.body && p.body.metrics) || null;
                const c = (p.body && p.body.computed) || null;
                process.stdout.write('[q31]   #' + (i + 1) + ' bytes=' + p.bytes
                    + '  metrics keys=' + (m ? Object.keys(m).length : 'ABSENT')
                    + '  computed keys=' + (c ? Object.keys(c).length : (c === null ? 'null' : 'ABSENT'))
                    + '  computed bytes=' + (c ? JSON.stringify(c).length : 0) + '\n');
                if (m) process.stdout.write('[q31]      metrics: ' + JSON.stringify(Object.keys(m)) + '\n');
                if (c) process.stdout.write('[q31]      computed: ' + JSON.stringify(Object.keys(c)) + '\n');
                if (m) {
                    const empties = Object.keys(m).filter((k) => m[k] === null || m[k] === '' ||
                        (Array.isArray(m[k]) && !m[k].length) ||
                        (m[k] && typeof m[k] === 'object' && !Object.keys(m[k]).length));
                    process.stdout.write('[q31]      metrics keys carrying nothing: ' + JSON.stringify(empties) + '\n');
                }
            });
            if (!posts.length) {
                process.stdout.write('[q31]   nothing was posted. Routes watched: **/api/analysis-cache** ; '
                    + 'the guard also saw ' + guard.reached.length + ' request(s) reach the server\n');
            }
        }, 300000);

        afterAll(async () => {
            if (page && previousActiveSiteId) {
                await page.evaluate(async ({ id }) => {
                    const t = document.querySelector('meta[name=csrf-token]');
                    await fetch('/api/active-site', {
                        method: 'PATCH',
                        headers: Object.assign({ 'Content-Type': 'application/json', Accept: 'application/json' },
                            t ? { 'X-CSRF-TOKEN': t.getAttribute('content') } : {}),
                        body: JSON.stringify({ site_id: id }),
                        credentials: 'same-origin',
                    });
                }, { id: previousActiveSiteId }).catch(() => {});
            }
            if (browser) await browser.close();
            const after = storedShape(SITE.id);
            process.stdout.write('[q31] stored row AFTER: ' + JSON.stringify(after) + '\n');
            process.stdout.write('[q31] row unchanged: ' + (after.md5 === stored.md5 ? 'YES' : 'NO') + '\n');
            if (guard) process.stdout.write('[q31] ' + guard.report() + '\n');
        }, 60000);

        test('the stored row is intact — the measurement wrote nothing', () => {
            expect(storedShape(SITE.id).md5).toBe(stored.md5);
        });

        test('the walk finds which opened page writes, and which do not', () => {
            // /analysis produced nothing on the first run of this file — the
            // named outcome B for that page, and the reason the walk exists.
            process.stdout.write('[q31] POSTs by page: ' + JSON.stringify(perPage) + '\n');
            expect(Object.keys(perPage)).toEqual(['/analysis', '/data', '/hub']);
            expect(posts.length).toBeGreaterThan(0);
        });

        test('/hub is the one that writes, and the other two do not', () => {
            expect(perPage['/hub']).toBeGreaterThan(0);
            expect(perPage['/analysis']).toBe(0);
            expect(perPage['/data']).toBe(0);
        });

        /**
         * Question 31, third measurement — IS THE WRITE THE POINT OF RE-RUN, OR
         * A SIDE EFFECT OF IT.
         *
         * Read first, so this run measures only what reading cannot settle:
         *   `_signalRerunComplete()` is called from the POST's `.then` AND its
         *   `.catch` (hub-persistence.js :146, :150) — the signal that releases
         *   the parent is tied to the request finishing, either way. The parent
         *   (dashboard-ui.js `initRerun`) answers that message by removing the
         *   iframe and calling `location.reload()`, and the reloaded page reads
         *   the row from the server. So the chain is press -> hidden /hub ->
         *   POST -> signal -> reload -> server read.
         *
         * What is asserted here is that the chain actually runs end to end on a
         * real press, because "the signal is wired to the POST" is a reading of
         * two lines and the claim is about a button.
         */
        test('pressing Re-run produces the write, and the page reloads behind it', async () => {
            const before = posts.length;
            const p = await context.newPage();
            await p.goto(BASE_URL + '/dashboard', { waitUntil: 'domcontentloaded' });
            await p.waitForTimeout(8000);

            const hasButton = await p.evaluate(() => !!document.getElementById('db-rerun-btn'));
            let reloaded = false;
            p.on('framenavigated', (f) => { if (f === p.mainFrame()) reloaded = true; });

            if (hasButton) {
                await p.click('#db-rerun-btn');
                await p.waitForTimeout(45000);
            }
            const made = posts.slice(before);
            process.stdout.write('[q31] Re-run: button present=' + hasButton
                + ', POSTs produced=' + made.length
                + ', page navigated after the press=' + reloaded + '\n');
            made.forEach((x) => {
                const m = (x.body && x.body.metrics) || null;
                process.stdout.write('[q31]   press payload: ' + x.bytes + ' bytes, metrics keys='
                    + (m ? Object.keys(m).length : 'ABSENT') + '\n');
            });
            await p.close();

            expect(hasButton).toBe(true);
            expect(made.length).toBeGreaterThan(0);
        }, 180000);

        test('what it sends is whatever the engines produced on that load', () => {
            // An earlier draft of this assertion demanded the payload be
            // THINNER than the stored row, and went red: on this site it is the
            // same shape, 13 metrics keys and 17 computed keys against 13 and
            // 17 stored, 153 144 bytes against 171 798. That is the finding,
            // not a broken test — the writer does not send something
            // systematically reduced. It sends this load's result, whole.
            //
            // The contrast is on the stand itself and needs no run: Russley and
            // Federal Golf after their event carry metrics 5 keys and computed
            // 11-12 keys in 783-1325 bytes. Same writer, same route, same
            // server closure, which REPLACES rather than merges — so a load
            // that computed little writes little over whatever was there.
            const worst = posts.reduce((a, p) => (p.bytes < a.bytes ? p : a), posts[0]);
            const m = (worst.body && worst.body.metrics) || {};
            const c = (worst.body && worst.body.computed) || null;
            process.stdout.write('[q31] payload: ' + worst.bytes + ' bytes against '
                + stored.length + ' stored; metrics ' + Object.keys(m).length
                + '/' + stored.metricsKeys + ', computed '
                + (c ? Object.keys(c).length : 'null') + '/' + stored.computedKeys + '\n');
            expect(Object.keys(m).length).toBeGreaterThan(0);
            expect(c).not.toBeNull();
        });
    });
}

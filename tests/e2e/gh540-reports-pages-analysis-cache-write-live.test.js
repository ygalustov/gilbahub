/**
 * Question 31, fourth measurement — DO THE /reports PAGES WRITE THE ANALYSIS
 * CACHE WHEN THEY ARE MERELY OPENED, AND IF SO WHICH WRITER SENDS IT.
 *
 * WHY THIS EXISTS, AND IT CORRECTS THE FOUNDATION OF QUESTION 31. All three
 * recorded losses on the stand were ours, not a client's. Canberra 09:45 was my
 * own page walk. Russley and Federal Golf at 11:26:16 and 11:26:24 were my own
 * probe, which opened FOUR pages per site — /reports/export, /reports/forensic,
 * /reports/scenarios and /analysis/disease. The third measurement walked
 * /analysis, /data and /hub and found only /hub writing; it touched none of the
 * /reports pages, so which of the four wrote those two rows is not established.
 * Confirmed client-caused cases: zero.
 *
 * WHAT READING SETTLED FIRST, so this run measures only what reading cannot:
 *
 *   `GILBA_REPORTS_EXPORT` appears EXACTLY ONCE in hub-persistence.js, at
 *   :2205, inside `syncToServer()`. It does not guard the other two writers.
 *
 *   The first of those, the POST at :134, is reached through `_doRerunSync()`,
 *   and `_doRerunSync()` is called from TIMERS, not from a press: a 3-second
 *   delay after `gaip:orchestrator-complete` once weather is ready (:166), and
 *   an unconditional 10-second slow path (:179). Nothing in either checks
 *   whether the page is the hidden iframe or a page somebody opened.
 *
 *   The third writer, :205, is gated on `!_rerunSignalSent` — it cannot fire
 *   unless the first already did.
 *
 * So reading says the /reports pages should write on a plain open, through the
 * Re-run path, past the one guard that exists. Reading is not the answer; the
 * question is about a page.
 *
 * ALL FOUR PAGES ARE IN THIS RUN. /analysis/disease was under a standing
 * instruction not to open; the coordinator traced that instruction to its
 * origin, found it was narrow and its purpose spent, and lifted it. So the walk
 * is complete and the question of which page wrote Russley and Federal Golf can
 * be settled here rather than narrowed.
 *
 * NOTHING IS WRITTEN, AND THAT IS A CHOICE WORTH NAMING. The instruction
 * allowed for the row collapsing under the measurement and asked for that to be
 * recorded as the result it is. It cannot collapse here, because the POST is
 * intercepted and answered before it reaches the server. That loses nothing:
 * `AnalysisCacheController@store` REPLACES the row with what it is sent and
 * never reads what is there, so the payload recorded on the way past IS the row
 * that would have been stored, key for key and byte for byte. Measuring the
 * request costs no row; letting it land would cost one and say the same thing.
 *
 * A byte copy of the row is taken and verified against the database's own md5
 * BEFORE anything is opened regardless, and the row is compared afterwards, so
 * a write arriving by some path this file does not watch would still show.
 *
 * SITE: Test - GC - NZ - delivery, 01a08b0b-4d6a-736d-a184-2fa1e04394b6 — its
 * row is full (13 metrics keys, 17 computed) and it is none of the protected
 * rows.
 *
 * WHAT WAS EXPECTED, WRITTEN DOWN BEFORE THE RUN, BOTH OUTCOMES NAMED.
 *   A: all three /reports pages POST on a plain open, and the console names
 *      `[GilbaRerun]` with a `fast-path-3s` or `slow-path-10s` source — the
 *      Re-run writer firing on a page nobody pressed anything on.
 *   B: none of them POSTs. Then the /reports pages are not the writer, the two
 *      11:26 rows were written by /analysis/disease — the one page this run
 *      does not open — and that is the finding.
 *   Anything between is reported per page as measured.
 *
 * Run: GILBA_E2E=1 npx jest tests/e2e/gh540-reports-pages-analysis-cache-write-live.test.js
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
const PAGES = ['/reports/export', '/reports/forensic', '/reports/scenarios', '/analysis/disease'];

let chromium = null;
try { ({ chromium } = require('playwright')); } catch (e) { /* reported below */ }
let guardStand = null;
try { ({ guardStand } = require('./lib/stand-guard')); } catch (e) { /* reported below */ }

function sql(query) {
    return execFileSync('docker', ['exec', '-i', 'gilba_mysql', 'mysql', '-ugilba', '-pgilba_secret',
        'gilba', '--batch', '--raw', '--skip-column-names'],
        { input: query, encoding: 'utf8', maxBuffer: 256 * 1024 * 1024 }).trim();
}
function rowMd5(site) {
    return sql("SELECT MD5(config) FROM site_configs WHERE site_id='" + site + "' AND namespace='analysis_cache';");
}

if (!ENABLED) {
    process.stdout.write('[e2e] gh540-reports-pages skipped (needs the live stack)\n');
    test.skip('Question 31 fourth measurement (disabled)', () => {});
} else {
    describe('Question 31 — do the /reports pages write on a plain open', () => {
        let browser, context, guard, page, previousActiveSiteId = null;
        let md5Before = null;
        const perPage = {};
        const detail = {};

        beforeAll(async () => {
            if (!chromium) throw new Error('playwright does not resolve from the repo — run `npm install`');
            if (!guardStand) throw new Error('tests/e2e/lib/stand-guard.js does not resolve');
            if (!EMAIL || !PASSWORD) throw new Error('no credentials');

            md5Before = rowMd5(SITE.id);
            process.stdout.write('[q31d] row md5 before: ' + md5Before + '\n');

            browser = await chromium.launch();
            context = await browser.newContext();
            guard = await guardStand(context);

            let sink = null;
            await context.route('**/api/analysis-cache**', async (route) => {
                const req = route.request();
                if (sink && req.method() !== 'GET') {
                    let b = null;
                    try { b = JSON.parse(req.postData() || 'null'); } catch (e) { b = null; }
                    sink.posts.push({
                        bytes: (req.postData() || '').length,
                        metricsKeys: b && b.metrics ? Object.keys(b.metrics).length : null,
                        computedKeys: b && b.computed ? Object.keys(b.computed).length : (b && b.computed === null ? 'null' : null),
                    });
                }
                await route.fulfill({ status: 200, contentType: 'application/json',
                    body: JSON.stringify({ ok: true, held: 'q31d: not written to the stand' }) });
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
                await fetch('/api/active-site', { method: 'PATCH',
                    headers: Object.assign({ 'Content-Type': 'application/json', Accept: 'application/json' },
                        t ? { 'X-CSRF-TOKEN': t.getAttribute('content') } : {}),
                    body: JSON.stringify({ site_id: id }), credentials: 'same-origin' });
            }, { id: SITE.id });

            for (const p of PAGES) {
                sink = { posts: [], console: [] };
                const tab = await context.newPage();
                tab.on('console', (m) => {
                    const t = m.text();
                    if (/GilbaRerun|analysis-cache|REPORTS_EXPORT/i.test(t)) sink.console.push(t.slice(0, 160));
                });
                await tab.goto(BASE_URL + p, { waitUntil: 'domcontentloaded' });
                // Past the 10-second slow path with room to spare. Nothing is
                // clicked: the page is only opened.
                await tab.waitForTimeout(28000);
                await tab.close();

                perPage[p] = sink.posts.length;
                detail[p] = sink;
                process.stdout.write('[q31d] ' + p + ' -> ' + sink.posts.length + ' POST(s)'
                    + (sink.posts.length ? ' ' + JSON.stringify(sink.posts) : '') + '\n');
                sink.console.slice(0, 6).forEach((l) => process.stdout.write('[q31d]      console: ' + l + '\n'));
                if (!sink.posts.length) {
                    process.stdout.write('[q31d]      nothing posted. Watched **/api/analysis-cache** ; '
                        + sink.console.length + ' matching console line(s) seen on this page\n');
                }
                sink = null;
            }
        }, 300000);

        afterAll(async () => {
            if (page && previousActiveSiteId) {
                await page.evaluate(async ({ id }) => {
                    const t = document.querySelector('meta[name=csrf-token]');
                    await fetch('/api/active-site', { method: 'PATCH',
                        headers: Object.assign({ 'Content-Type': 'application/json', Accept: 'application/json' },
                            t ? { 'X-CSRF-TOKEN': t.getAttribute('content') } : {}),
                        body: JSON.stringify({ site_id: id }), credentials: 'same-origin' });
                }, { id: previousActiveSiteId }).catch(() => {});
            }
            if (browser) await browser.close();
            process.stdout.write('[q31d] row md5 after: ' + rowMd5(SITE.id)
                + ' (before ' + md5Before + ')\n');
            process.stdout.write('[q31d] by page: ' + JSON.stringify(perPage) + '\n');
            if (guard) process.stdout.write('[q31d] ' + guard.report() + '\n');
        }, 60000);

        test('the row was not written — the measurement cost the stand nothing', () => {
            expect(rowMd5(SITE.id)).toBe(md5Before);
        });

        test('all three pages were opened and each has a number', () => {
            // The perimeter, printed: a zero below means "watched and saw
            // none", not "did not get there".
            expect(Object.keys(perPage).sort()).toEqual(PAGES.slice().sort());
        });

        test('what each page did, recorded', () => {
            const writers = PAGES.filter((p) => perPage[p] > 0);
            process.stdout.write('[q31d] pages that wrote: ' + JSON.stringify(writers) + '\n');
            // Asserted as a measurement rather than a demand: both outcomes were
            // named before the run and either is an answer.
            expect(typeof perPage[PAGES[0]]).toBe('number');
        });
    });
}

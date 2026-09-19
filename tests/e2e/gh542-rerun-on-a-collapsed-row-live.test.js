/**
 * Question 31 — DOES PRESSING RE-RUN BRING A COLLAPSED ROW BACK. A measurement.
 *
 * WHY IT DECIDES THE WEIGHT OF THE WHOLE DEFECT. Russley and Federal Golf have
 * been sitting thin since yesterday and nobody has pressed anything on them. If
 * Re-run returns a full row, the loss is temporary and a user's own action
 * repairs it. If it returns thin, the loss is real.
 *
 * The third measurement established that the press is the direct route to this
 * answer rather than a guess: one press produced 2 POSTs and a reload.
 *
 * THIS RUN LETS THE WRITE LAND, and that is the only reason it is allowed to.
 * The earlier measurements intercepted it, because what the client sends is
 * what the server stores and no row needed risking. Here the question IS what
 * ends up in the row after a real press, so `/api/analysis-cache` is let
 * through while `guardStand` holds everything else — site configs, samples,
 * predictions. The route added after the guard wins, which is how the one
 * exception is made without opening the rest.
 *
 * SITE: Russley, 019f35f0-d912-73e5-82bd-3de0bfd4f6ce. Its `analysis_cache` is
 * one of the two collapsed rows: 1 325 bytes, `metrics` 5 keys, `computed` 12.
 *
 * ITS `gaip` ROW IS ONE OF THE FOUR MARKED CONFIGURATIONS, md5
 * 06ea3a716a1bbdb385fdb114c2d81c6d. The press writes `analysis_cache`, not that
 * row, and the guard holds site-config writes anyway — but a copy of it was
 * taken and verified alongside the other, and this file asserts it is untouched
 * afterwards. A marked row is not protected by the expectation that nothing
 * will touch it.
 *
 * WHAT WAS EXPECTED, WRITTEN DOWN BEFORE THE RUN, BOTH OUTCOMES NAMED.
 *   A: the row comes back FULL — on the order of 13 `metrics` keys and 16-17
 *      `computed`, tens of kilobytes, like every site that has not collapsed.
 *      The loss is then self-healing and a press repairs it.
 *   B: the row comes back THIN again — 5 keys or thereabouts. The loss is real,
 *      a press does not repair it, and that is the finding. This is a RESULT,
 *      not a failed run: it is recorded with its numbers and the row is left as
 *      the measurement found it rather than re-run "clean".
 *
 * Run: GILBA_E2E=1 npx jest tests/e2e/gh542-rerun-on-a-collapsed-row-live.test.js
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

const SITE = { name: 'Russley', id: '019f35f0-d912-73e5-82bd-3de0bfd4f6ce' };
const MARKED_GAIP_MD5 = '06ea3a716a1bbdb385fdb114c2d81c6d';

let chromium = null;
try { ({ chromium } = require('playwright')); } catch (e) { /* reported below */ }
let guardStand = null;
try { ({ guardStand } = require('./lib/stand-guard')); } catch (e) { /* reported below */ }

function sql(q) {
    return execFileSync('docker', ['exec', '-i', 'gilba_mysql', 'mysql', '-ugilba', '-pgilba_secret',
        'gilba', '--batch', '--raw', '--skip-column-names'],
        { input: q, encoding: 'utf8', maxBuffer: 256 * 1024 * 1024 }).trim();
}
function shape(ns) {
    const out = sql("SELECT CONCAT(MD5(config),'~',LENGTH(config),'~',"
        + "IFNULL(JSON_LENGTH(JSON_EXTRACT(config,'$.metrics')),-1),'~',"
        + "IFNULL(JSON_LENGTH(JSON_EXTRACT(config,'$.computed')),-1),'~',UNIX_TIMESTAMP(updated_at)) "
        + "FROM site_configs WHERE site_id='" + SITE.id + "' AND namespace='" + ns + "';");
    const p = out.split('~');
    return { md5: p[0], bytes: Number(p[1]), metricsKeys: Number(p[2]),
             computedKeys: Number(p[3]), updated: p[4] };
}

if (!ENABLED) {
    process.stdout.write('[e2e] gh542-rerun-on-a-collapsed-row skipped (needs the live stack)\n');
    test.skip('Question 31 Re-run on a collapsed row (disabled)', () => {});
} else {
    describe('Question 31 — Re-run on a row that collapsed', () => {
        let browser, context, guard, page, previousActiveSiteId = null;
        let before = null, after = null, gaipBefore = null, gaipAfter = null;
        let posts = [], pressed = false;

        beforeAll(async () => {
            if (!chromium) throw new Error('playwright does not resolve from the repo — run `npm install`');
            if (!guardStand) throw new Error('tests/e2e/lib/stand-guard.js does not resolve');
            if (!EMAIL || !PASSWORD) throw new Error('no credentials');

            before = shape('analysis_cache');
            gaipBefore = shape('gaip');
            process.stdout.write('[q31e] BEFORE analysis_cache: ' + JSON.stringify(before) + '\n');
            process.stdout.write('[q31e] BEFORE gaip (marked):  ' + JSON.stringify(gaipBefore) + '\n');

            browser = await chromium.launch();
            context = await browser.newContext();
            guard = await guardStand(context);

            // The one exception: this write is the measurement, so it is let
            // through. Registered after the guard, so it takes precedence.
            await context.route('**/api/analysis-cache**', async (route) => {
                const req = route.request();
                if (req.method() !== 'GET') {
                    let b = null;
                    try { b = JSON.parse(req.postData() || 'null'); } catch (e) { b = null; }
                    posts.push({
                        bytes: (req.postData() || '').length,
                        metricsKeys: b && b.metrics ? Object.keys(b.metrics).length : null,
                        computedKeys: b && b.computed ? Object.keys(b.computed).length : 'null',
                    });
                }
                await route.continue();
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

            await page.goto(BASE_URL + '/dashboard', { waitUntil: 'domcontentloaded' });
            await page.waitForTimeout(8000);

            const hasBtn = await page.evaluate(() => !!document.getElementById('db-rerun-btn'));
            if (hasBtn) {
                await page.click('#db-rerun-btn');
                pressed = true;
                await page.waitForTimeout(50000);
            }

            after = shape('analysis_cache');
            gaipAfter = shape('gaip');

            process.stdout.write('[q31e] pressed: ' + pressed + ', POSTs seen: ' + posts.length
                + (posts.length ? ' ' + JSON.stringify(posts) : '') + '\n');
            process.stdout.write('[q31e] AFTER  analysis_cache: ' + JSON.stringify(after) + '\n');
            process.stdout.write('[q31e] AFTER  gaip (marked):  ' + JSON.stringify(gaipAfter) + '\n');
            process.stdout.write('[q31e] VERDICT: bytes ' + before.bytes + ' -> ' + after.bytes
                + ', metrics ' + before.metricsKeys + ' -> ' + after.metricsKeys
                + ', computed ' + before.computedKeys + ' -> ' + after.computedKeys + '\n');
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
            if (guard) process.stdout.write('[q31e] ' + guard.report() + '\n');
        }, 60000);

        test('the marked gaip row was not touched', () => {
            expect(gaipBefore.md5).toBe(MARKED_GAIP_MD5);
            expect(gaipAfter.md5).toBe(MARKED_GAIP_MD5);
            expect(gaipAfter.updated).toBe(gaipBefore.updated);
        });

        test('the press happened and produced a write', () => {
            expect(pressed).toBe(true);
            expect(posts.length).toBeGreaterThan(0);
        });

        test('what the row became, recorded', () => {
            // Both outcomes were named before the run and either is an answer,
            // so this asserts that the measurement exists rather than which way
            // it came out. The verdict line above carries the numbers.
            expect(typeof after.bytes).toBe('number');
            expect(after.updated).not.toBe(before.updated);
        });
    });
}

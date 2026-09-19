/**
 * GH-541 — on a real page: the Account site list shows each site's OWN
 * methodology.
 *
 * WHY THE LIVE RUN IS ABOUT TWO SITES AND NOT ONE. `AccountController::show()`
 * resolves `$turfMethodology` for the ACTIVE site; `buildSitesTableData()`
 * builds one row per site. Reaching for the first from the second would print
 * the active site's setting under every other site's name — GH-459's shape,
 * one object's data beside another object's label. With ONE site on screen the
 * right reading and the wrong one agree, so one site cannot tell them apart.
 * This opens the page on a site with one methodology and reads the rows of
 * sites with the other two.
 *
 * THE SITES AND WHAT THEY ARE SET TO, read from the stand before the run:
 *   Burns                       mlsn              -> the column should read MLSN
 *   Test - GC - NZ - delivery   ammonium_acetate  -> Ammonium Acetate
 *   Federal Golf                slan              -> SLAN
 * The ACTIVE site for the run is Burns, so if the builder used the active
 * site's value every row would read MLSN and the other two assertions fail.
 *
 * Nothing is written: the page is read-only and `guardStand` holds anything
 * that tries otherwise.
 *
 * WHAT WAS EXPECTED, WRITTEN DOWN BEFORE THE RUN, BOTH OUTCOMES NAMED.
 *   A: a Methodology column exists, and the three rows read MLSN, Ammonium
 *      Acetate and SLAN respectively — each its own.
 *   B: the three read the same thing, or the column is absent. Then the value
 *      is coming from the active site and the change has not done its job.
 *
 * Run: GILBA_E2E=1 npx jest tests/e2e/gh541-account-methodology-column-live.test.js
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

const ACTIVE = { name: 'Burns', id: '019e96d8-97b7-714c-9bd6-d65b16ec7f2e' };
const EXPECT = {
    'Burns': 'MLSN',
    'Test - GC - NZ - delivery': 'Ammonium Acetate',
    'Federal Golf': 'SLAN',
};

let chromium = null;
try { ({ chromium } = require('playwright')); } catch (e) { /* reported below */ }
let guardStand = null;
try { ({ guardStand } = require('./lib/stand-guard')); } catch (e) { /* reported below */ }

if (!ENABLED) {
    process.stdout.write('[e2e] gh541-account-methodology-column skipped (needs the live stack)\n');
    test.skip('GH-541 methodology column (disabled)', () => {});
} else {
    describe('GH-541 — the Account list prints each site\'s own methodology', () => {
        let browser, context, guard, page, previousActiveSiteId = null;
        let seen = null;

        beforeAll(async () => {
            if (!chromium) throw new Error('playwright does not resolve from the repo — run `npm install`');
            if (!guardStand) throw new Error('tests/e2e/lib/stand-guard.js does not resolve');
            if (!EMAIL || !PASSWORD) throw new Error('no credentials');

            browser = await chromium.launch();
            context = await browser.newContext();
            guard = await guardStand(context);
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
            }, { id: ACTIVE.id });

            await page.goto(BASE_URL + '/account', { waitUntil: 'domcontentloaded' });
            await page.waitForTimeout(6000);

            seen = await page.evaluate(() => {
                const heads = Array.from(document.querySelectorAll('#stg-sites-table thead th'))
                    .map((th) => th.textContent.trim());
                const col = heads.findIndex((h) => /methodology/i.test(h));
                const rows = {};
                document.querySelectorAll('#stg-sites-table tbody tr.stg-row-main').forEach((tr) => {
                    const cells = Array.from(tr.querySelectorAll('td')).map((td) => td.textContent.trim());
                    const name = (tr.querySelector('.stg-st-name') || {}).textContent || '';
                    if (name) rows[name.trim()] = col >= 0 ? cells[col] : null;
                });
                return { headers: heads, methodologyColumn: col, rows: rows, rowCount: Object.keys(rows).length };
            });

            process.stdout.write('[gh541] headers: ' + JSON.stringify(seen.headers) + '\n');
            process.stdout.write('[gh541] methodology column index: ' + seen.methodologyColumn + '\n');
            process.stdout.write('[gh541] rows on screen: ' + seen.rowCount + '\n');
            Object.keys(EXPECT).forEach((n) => {
                process.stdout.write('[gh541]   ' + n.padEnd(30) + ' -> '
                    + JSON.stringify(seen.rows[n]) + '  (expected ' + EXPECT[n] + ')\n');
            });
            const unset = Object.keys(seen.rows).filter((n) => /not set/i.test(seen.rows[n] || ''));
            process.stdout.write('[gh541] rows printing "methodology not set": ' + JSON.stringify(unset) + '\n');
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
            if (guard) process.stdout.write('[gh541] ' + guard.report() + '\n');
        }, 60000);

        test('the column is on the page, between Grass and Soil', () => {
            expect(seen.methodologyColumn).toBeGreaterThan(-1);
            expect(seen.headers[seen.methodologyColumn - 1]).toMatch(/Grass/);
            expect(seen.headers[seen.methodologyColumn + 1]).toMatch(/Soil/);
        });

        test('each of the three sites shows ITS OWN methodology, not the active one\'s', () => {
            // The active site is Burns/MLSN. Two of these three must therefore
            // NOT read MLSN, or the row is printing the page's value.
            Object.keys(EXPECT).forEach((name) => {
                expect(seen.rows[name]).toBe(EXPECT[name]);
            });
            const distinct = new Set(Object.keys(EXPECT).map((n) => seen.rows[n]));
            expect(distinct.size).toBe(3);
        });

        test('and the rows were really read — not an empty table agreeing with everything', () => {
            expect(seen.rowCount).toBeGreaterThanOrEqual(3);
        });
    });
}

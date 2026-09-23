/**
 * GH-591 (item 2) — RESTORING A STORED ROW, AND SAYING WHAT THE PROBE SAW.
 *
 * WHY. Every row the stand serves was written by a bundle that no longer exists.
 * Measured on 23.09.2026, in the database: of the ten sites that have a row at
 * all, ALL TEN serve a row carrying zero measured nutrients. Seven of those ten
 * have a live soil sample with numbers in it, so seven rows are wrong rather
 * than empty. `Test5 - NZ` row 52 is the shape exactly: `pH 6` and `CEC 5.9`
 * arrived, and all ten nutrients read `-`.
 *
 * The calculation lives in the browser (owner's decision, 22.09.2026), so there
 * is no server-side recompute and the only instrument is the product's own
 * Re-run button. This presses it ONCE, for one site, and reports what it saw.
 *
 * NOT A REGRESSION TEST. It is a restoration action with a witness, written as a
 * test rather than a scratch script so that the remaining sites are restored by
 * the same instrument and the next reader can see what it did. It is skipped
 * unless `GILBA_E2E=1`, like every other live file here, and EVERY RUN OF IT
 * PRESSES A BUTTON ON THE STAND — which is announced to the coordinator before
 * each press, one press at a time.
 *
 *   GILBA_E2E=1 GILBA_RESTORE_SITE='Test5 - NZ' npx jest tests/e2e/gh591-restore-a-row-live.test.js --runInBand --testTimeout=300000
 *
 * WHAT IT DOES NOT DO: it does not judge the restoration. Whether the new row
 * differs is decided in the DATABASE, before and after, by whoever pressed —
 * because "different" must be two rows side by side, and a probe that also
 * graded itself would be comparing the product with a copy of itself.
 */

'use strict';

const fs = require('fs');
const path = require('path');

const ENABLED = process.env.GILBA_E2E === '1';
const SITE_NAME = process.env.GILBA_RESTORE_SITE || 'Test5 - NZ';

let credentials = {};
try {
    credentials = JSON.parse(fs.readFileSync(
        process.env.GILBA_E2E_CREDENTIALS || path.join(__dirname, '.e2e-credentials.json'), 'utf8'));
} catch (e) { credentials = {}; }

const BASE_URL = process.env.GILBA_E2E_URL || credentials.url || 'http://127.0.0.1:8080';
const EMAIL = process.env.GILBA_E2E_EMAIL || credentials.email;
const PASSWORD = process.env.GILBA_E2E_PASSWORD || credentials.password;

let chromium = null;
try { ({ chromium } = require('playwright')); } catch (e) { /* reported below */ }

if (!ENABLED) {
    process.stdout.write('[e2e] gh591-restore-a-row-live skipped (presses Re-run on the stand — announce first)\n');
    test.skip('GH-591 restoring a row (disabled)', () => {});
} else {
    describe('GH-591 — one announced Re-run, and what the probe saw', () => {
        jest.setTimeout(300000);
        let browser, page;
        const seen = [];
        const say = (line) => { seen.push(line); process.stdout.write('[probe] ' + line + '\n'); };

        beforeAll(async () => {
            if (!chromium) throw new Error('playwright does not resolve from the repo — run `npm install`');
            if (!EMAIL || !PASSWORD) throw new Error('no credentials — see tests/e2e/.e2e-credentials.example.json');
            browser = await chromium.launch();
            page = await browser.newPage();
            page.on('console', (m) => {
                const t = m.text();
                if (/GH-589|GilbaRun|GilbaRerun|cascade|soil sample/i.test(t)) say('console: ' + t.slice(0, 200));
            });

            await page.goto(BASE_URL + '/login', { waitUntil: 'domcontentloaded' });
            await page.fill('#email', EMAIL);
            await page.fill('#password', PASSWORD);
            await Promise.all([
                page.waitForNavigation({ waitUntil: 'domcontentloaded' }).catch(() => {}),
                page.click('form.login-form button[type=submit]'),
            ]);
            await page.waitForTimeout(1500);
            if (/\/login/.test(page.url())) throw new Error('login refused for ' + EMAIL);
            say('logged in as ' + EMAIL);
        });

        afterAll(async () => {
            if (browser) await browser.close();
        });

        test('the button is pressed once, for the named site, and the run reports its outcome', async () => {
            await page.goto(BASE_URL + '/dashboard', { waitUntil: 'domcontentloaded' });
            await page.waitForTimeout(2500);

            // WHICH SITE THE PAGE IS STANDING ON — read, not assumed. The run is
            // filed against `GAIP_HUB_CONFIG.activeSiteId`, so this is the fact
            // that decides which row is restored.
            const before = await page.evaluate(() => ({
                activeSiteId: (window.GAIP_HUB_CONFIG || {}).activeSiteId || null,
                label: (document.getElementById('db-site-switcher-btn') || {}).textContent || null,
            }));
            say('page opened on site ' + before.activeSiteId + ' — "' + String(before.label).trim().slice(0, 60) + '"');

            // Switch through the product's own switcher if it is a different site.
            if (!String(before.label).includes(SITE_NAME)) {
                say('switching to "' + SITE_NAME + '" through the site switcher');
                await page.click('#db-site-switcher-btn');
                await page.waitForTimeout(600);
                const clicked = await page.evaluate((name) => {
                    const dd = document.getElementById('db-site-dropdown');
                    if (!dd) return 'no dropdown';
                    const items = Array.from(dd.querySelectorAll('a,button,[data-site-id],li'));
                    const hit = items.find((el) => (el.textContent || '').trim().includes(name));
                    if (!hit) return 'not in the list: ' + items.map((e) => (e.textContent || '').trim()).join(' | ').slice(0, 300);
                    hit.click();
                    return 'clicked';
                }, SITE_NAME);
                say('switcher: ' + clicked);
                expect(clicked).toBe('clicked');
                await page.waitForTimeout(4000);
                await page.goto(BASE_URL + '/dashboard', { waitUntil: 'domcontentloaded' });
                await page.waitForTimeout(2500);
            }

            const standing = await page.evaluate(() => ({
                activeSiteId: (window.GAIP_HUB_CONFIG || {}).activeSiteId || null,
                label: (document.getElementById('db-site-switcher-btn') || {}).textContent || null,
            }));
            say('standing on site ' + standing.activeSiteId + ' — "' + String(standing.label).trim().slice(0, 60) + '"');
            expect(String(standing.label)).toContain(SITE_NAME);

            // What the button says before the press, and that there IS one.
            const btnBefore = await page.evaluate(() => {
                const b = document.getElementById('db-rerun-btn');
                return b ? { text: (b.textContent || '').trim(), disabled: !!b.disabled } : null;
            });
            say('Re-run button before: ' + JSON.stringify(btnBefore));
            expect(btnBefore).not.toBeNull();

            // THE ONE PRESS. The opener asks the server for the soil sample and
            // then starts the hidden runner; the page reloads on success and does
            // not reload on a failure (GH-547/548).
            const pressedAt = Date.now();
            await page.click('#db-rerun-btn');
            say('pressed at ' + new Date(pressedAt).toISOString());

            // Wait for either: the page to have reloaded (success), or the
            // opener to have filed an outcome on the page (failure/partial).
            let outcome = null;
            for (let i = 0; i < 60; i += 1) {
                await page.waitForTimeout(1000);
                outcome = await page.evaluate(() => ({
                    filed: window.GilbaRerunOutcome || null,
                    stillRunning: (document.getElementById('db-rerun-btn') || {}).dataset
                        ? (document.getElementById('db-rerun-btn').dataset.running === '1') : null,
                    noticeText: (document.getElementById('db-analysis-notice-text') || {}).textContent || null,
                    pill: (document.getElementById('db-analysis-ts') || {}).textContent || null,
                })).catch(() => null) || outcome;
                if (outcome && (outcome.filed || outcome.stillRunning === false)) break;
            }
            say('after the press: ' + JSON.stringify(outcome));

            // WHAT THE SCREEN NOW SHOWS for the soil nutrients — the numbers a
            // person reads, taken off the rendered page rather than out of the
            // row, so the two can be compared by whoever presses.
            await page.goto(BASE_URL + '/analysis', { waitUntil: 'domcontentloaded' });
            await page.waitForTimeout(6000);
            const cards = await page.evaluate(() => {
                const out = {};
                const sn = (window.GAIP_DASHBOARD_DATA || {}).computed || {};
                const rows = (sn.soilNutrition && sn.soilNutrition.nutrients) || [];
                rows.forEach((r) => { out[r.nutrient] = r.actual; });
                return {
                    fromTheRow: out,
                    verdict: (sn.soilNutrition || {}).verdict || null,
                    pH: (sn.soilNutrition || {}).pH != null ? sn.soilNutrition.pH : null,
                    CEC: (sn.soilNutrition || {}).CEC != null ? sn.soilNutrition.CEC : null,
                    label: (sn.soilNutrition || {}).sampleLabel || null,
                    notMeasuredOnScreen: (document.body.innerText.match(/NOT MEASURED/g) || []).length,
                };
            });
            say('the analysis page now serves: ' + JSON.stringify(cards));

            // The probe's job is to press and to report. The only thing it
            // asserts is that it got as far as a decided outcome, because a probe
            // that timed out and said nothing is not evidence of anything.
            expect(outcome).not.toBeNull();
            process.stdout.write('\n[probe] everything this run saw:\n  ' + seen.join('\n  ') + '\n');
        });
    });
}

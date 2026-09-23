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

const { realReadingsOf } = require('../lib/sample-readings');
const { judge: judgeRowAgainstSample } = require('../lib/row-vs-sample');
const { openTranscript } = require('./lib/transcript');

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
        // GH-613: the run writes its own transcript. Reading this output must
        // never require running the file again — that is a press on the stand,
        // and it is exactly how an unannounced third press happened.
        const transcript = openTranscript('probe');
        const say = (line) => { seen.push(line); transcript.say(line); };

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
                // GH-593: every SCALAR reading the row states about the soil
                // beside the cards — `pH`, `CEC`, `ECe`, `soilNa` today. Taken
                // from the row's own shape, not from a list written here, so a
                // reading the row starts carrying is judged without anyone
                // remembering to add it.
                const scalars = {};
                Object.keys(sn.soilNutrition || {}).forEach((k) => {
                    const v = sn.soilNutrition[k];
                    if (typeof v === 'number' || v === null) scalars[k] = v;
                });
                return {
                    fromTheRow: out,
                    scalars: scalars,
                    verdict: (sn.soilNutrition || {}).verdict || null,
                    pH: (sn.soilNutrition || {}).pH != null ? sn.soilNutrition.pH : null,
                    CEC: (sn.soilNutrition || {}).CEC != null ? sn.soilNutrition.CEC : null,
                    label: (sn.soilNutrition || {}).sampleLabel || null,
                    notMeasuredOnScreen: (document.body.innerText.match(/NOT MEASURED/g) || []).length,
                };
            });
            say('the analysis page now serves: ' + JSON.stringify(cards));

            // ─────────────────────────────────────────────────────────────────
            // GH-593 — AND THE ROW IS JUDGED AGAINST THE SAMPLE, THROUGH THE
            // PRODUCT'S OWN NORMALISER.
            //
            // WHAT WAS WRONG WITH THE JUDGING, and it is the reason this is
            // here rather than in a query. The restoration was checked by
            // resolving the sample's columns with LITERAL JSON PATHS — `$.pH`,
            // `$.CEC`. Two of the seven samples keep those readings under their
            // lab column names, `pH_Water` and `CEC_meq100g`, so the check saw
            // nothing and the expectation written from it said "this site has
            // no pH". The product's reader resolves those aliases and returned
            // the values, so the error fell on the safe side — BY LUCK. Had the
            // product dropped them, "the product lost a value" and "my query
            // cannot see the value" would have been the same answer, and the
            // run would have been reported as correct.
            //
            // The same shape caught a second person the same hour, checking the
            // first one's cells with `$.pH_Water` and getting NULL where the
            // table held a number. What tells the two apart is ENUMERATING the
            // keys, not guessing a path — so the readings come from
            // `readingsOf`, the sample manager's own normaliser (GH-484/490),
            // which is what the run itself reads the sample with.
            //
            // The sample comes from the SERVER, by this page's own session, so
            // the row and the fact it is judged against do not both come from
            // the browser.
            const apiSample = await page.evaluate(async (siteId) => {
                const r = await fetch('/api/samples?sample_type=soil&site_id='
                    + encodeURIComponent(siteId) + '&limit=1', {
                    headers: { Accept: 'application/json' }, credentials: 'same-origin',
                });
                if (!r.ok) return null;
                const j = await r.json();
                const rows = (j && (j.data || j.samples)) || [];
                return rows.length ? rows[0] : null;
            }, standing.activeSiteId);

            if (!apiSample) {
                say('the server has no soil sample for this site — nothing to judge the row against');
            } else {
                // `readingsOf` takes a SAMPLE; the API hands the lab row under
                // `payload`, which is the same object the store keeps as `values`.
                const readings = realReadingsOf()('soil', { values: apiSample.payload || {} }) || {};
                say('the sample the server named: ' + apiSample.id
                    + ' — readings it carries: ' + JSON.stringify(readings));

                // The set to compare is derived from BOTH sides and from no list
                // written here: a reading the sample carries AND a place the row
                // states it — a nutrient card, or a scalar beside the cards.
                //
                // THE CARDS ALONE WERE NOT ENOUGH, and the first control run
                // said so: it judged three readings of the seven the sample
                // carries, and `pH` and `CEC` — whose lab aliases are the whole
                // reason this check exists — were not among them, because the
                // row states them beside the cards rather than in one. A judge
                // that resolves the aliases correctly and then never looks
                // where those two live would have passed the very loss that
                // GH-591 found.
                // GH-609: the comparison is a pure function now, in
                // `tests/lib/row-vs-sample.js`, with its own cases. It used to
                // be written here as `Number(a) !== Number(b)`, and on a site
                // whose readings carry two decimals that called EIGHT correct
                // nutrients wrong — the page prints `18.8`, the sample holds
                // `18.84`. The check that could only be exercised by pressing
                // Re-run was the one that was wrong, so it no longer lives in
                // a file nobody can run without a press.
                const rowSurface = Object.assign({}, cards.scalars || {}, cards.fromTheRow);
                const { shared, disagreed, dropped } = judgeRowAgainstSample(rowSurface, readings);
                expect(shared.length).toBeGreaterThan(0);

                expect({ nutrientsWhereTheRowDisagreesWithTheSample: disagreed })
                    .toEqual({ nutrientsWhereTheRowDisagreesWithTheSample: [] });

                // And nothing the sample measured is missing from the row: a
                // value dropped on the way is exactly what the literal-path
                // check could not see.
                expect({ measuredBySampleButNotInTheRow: dropped })
                    .toEqual({ measuredBySampleButNotInTheRow: [] });

                say('judged ' + shared.length + ' readings against sample ' + apiSample.id
                    + ': ' + shared.map((k) => k + '=' + readings[k]).join(' '));
            }

            // The probe got as far as a decided outcome: a probe that timed out
            // and said nothing is not evidence of anything.
            expect(outcome).not.toBeNull();
            process.stdout.write('\n[probe] everything this run saw:\n  ' + seen.join('\n  ') + '\n');
        });
    });
}

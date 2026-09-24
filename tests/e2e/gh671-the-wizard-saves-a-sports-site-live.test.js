/**
 * GH-671 (queue item 3aa) — DOES A PERSON WHO SETS UP A SPORTS FIELD THROUGH THE
 * WIZARD END UP WITH A SAVED SITE, AND DOES THE SCREEN TELL THEM THE TRUTH?
 *
 * WHY THIS AND NOT ANOTHER BENCH CASE. The item's own record carries the gap
 * verbatim: "what a person sees at that moment in the browser is confirmed only by
 * the code of the `alert`, not by observation — after the repair the request is
 * known to go out correctly, and what the person sees is not known". The subject of
 * the item is a client setting up a site and it not being saved. That cannot be
 * closed by a statement about code.
 *
 * WHAT IT DOES TO THE STAND, said plainly: it CREATES ONE NEW SITE, through the
 * product's own Add site form on `/account`, and then runs the wizard on it. That
 * is the client's path. Nothing existing is edited: the wizard patches the ACTIVE
 * site, so a fresh one is made active first — running it on any of the eight live
 * provisional sites would overwrite a real config instead.
 *
 * ONE PRESS. There is no second one under either outcome; the output is read from
 * the transcript file.
 *
 * BOTH OUTCOMES, NAMED BEFORE THE RUN:
 *   - the site is saved — a `site_configs` row with `wizard.complete` and
 *     `turf.turfType: sports` — and the screen shows no failure: GH-630 holds on
 *     the live path and the item's gap is closed by observation;
 *   - it is not saved, or the connection `alert` appears: the defect survives the
 *     live path, and the wizard's own screen misnames the cause. That is a finding
 *     to carry up, not a reason to edit the alert's text, which is the owner's.
 *
 * WHAT IS WATCHED, because a silent failure is the whole point: every native
 * dialog (that is where the `alert` would appear), every non-GET request, and the
 * database on both sides.
 *
 * LAWNS ARE NOT IN THIS PRESS. A second turf type is a second site and a second
 * press; it is named as not done rather than folded in.
 *
 * Run: GILBA_E2E=1 npx jest tests/e2e/gh671-the-wizard-saves-a-sports-site-live.test.js --runInBand
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
/**
 * PROBE-ONLY MODE, and it exists because the first press was spent on a probe that
 * could not reach the subject. With `GILBA_WIZARD_PROBE_ONLY=1` and
 * `GILBA_WIZARD_SITE=<name>` this run switches to an EXISTING site, opens the
 * wizard, prints what it sees and STOPS — no walk, no save, no new site. It is the
 * positive control the coordinator required before the second press: if the probe
 * cannot see a wizard here, it would not see one there either.
 */
const PROBE_ONLY = process.env.GILBA_WIZARD_PROBE_ONLY === '1';
const SITE_NAME = process.env.GILBA_WIZARD_SITE
    || ('GH-671 wizard press ' + new Date().toISOString().slice(11, 19).replace(/:/g, ''));

let chromium = null;
try { ({ chromium } = require('playwright')); } catch (e) { /* reported below */ }
const { openTranscript } = require('./lib/transcript');

function query(sql) {
    return execFileSync('docker', ['exec', 'gilba_mysql', 'mysql', '-ugilba', '-pgilba_secret',
        'gilba', '-N', '-e', sql], { encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] })
        .split('\n').map((l) => l.trim()).filter((l) => l);
}

if (!ENABLED) {
    process.stdout.write('[e2e] gh671 skipped (needs the live stack; it creates one site and presses once)\n');
    test.skip('GH-671 the wizard saves a sports site (disabled)', () => {});
} else {
    describe('GH-671 — the wizard, on a sports field, as a person walks it', () => {
        jest.setTimeout(420000);
        let browser, page;
        const transcript = openTranscript('gh671-live');
        const say = (line) => transcript.say(line);
        const dialogs = [];
        const writes = [];
        let created = null;      // the site the Add site form made
        let saved = null;        // what the database holds afterwards
        let screenAfter = null;
        let walked = [];

        beforeAll(async () => {
            if (!chromium) throw new Error('playwright does not resolve from the repo — run `npm install`');
            if (!EMAIL || !PASSWORD) throw new Error('no credentials — see tests/e2e/.e2e-credentials.example.json');

            browser = await chromium.launch();
            page = await browser.newPage();
            // The `alert` lives here and nowhere else: without this it would be
            // auto-dismissed and the run would look clean.
            page.on('dialog', async (d) => {
                dialogs.push({ type: d.type(), message: d.message() });
                say('DIALOG (' + d.type() + '): ' + d.message());
                await d.dismiss().catch(() => {});
            });
            page.on('request', (r) => {
                if (r.method() !== 'GET') writes.push(r.method() + ' ' + r.url().replace(BASE_URL, ''));
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

            // ── A fresh site, through the product's own form ──────────────────
            if (PROBE_ONLY) {
                const row = query("SELECT CONCAT(id,'|',site_type,'|',IFNULL(latitude,''),'|',provisional_name) "
                    + "FROM sites WHERE name='" + SITE_NAME + "'")[0] || '';
                const [id0, type0, lat0, prov0] = row.split('|');
                created = { id: id0, type: type0, lat: lat0, provisional: prov0 };
                say('PROBE ONLY: using the site that already exists — ' + JSON.stringify(created));
                expect(created.id).toBeTruthy();
            } else {
            await page.goto(BASE_URL + '/account', { waitUntil: 'domcontentloaded' });
            await page.waitForTimeout(2500);
            await page.evaluate(() => {
                const tab = document.querySelector('[data-tab="sites"], #stg-tab-sites-btn');
                if (tab) tab.click();
                const add = document.getElementById('stg-add-site-btn');
                if (add) add.click();
            });
            await page.waitForTimeout(800);
            await page.fill('#stg-new-site-name', SITE_NAME);
            await page.selectOption('#stg-new-site-type', 'sports');
            say('creating a site named ' + JSON.stringify(SITE_NAME) + ', type sports');
            await page.click('#stg-add-site-save-btn');
            await page.waitForTimeout(4000);

            const row = query("SELECT CONCAT(id,'|',site_type,'|',IFNULL(latitude,''),'|',provisional_name) "
                + "FROM sites WHERE name='" + SITE_NAME + "'")[0] || '';
            const [id, type, lat, provisional] = row.split('|');
            created = { id, type, lat, provisional };
            say('the site the form created: ' + JSON.stringify(created));
            expect(created.id).toBeTruthy();
            }

            // Make it the active one, the way a person does.
            await page.goto(BASE_URL + '/dashboard', { waitUntil: 'domcontentloaded' });
            await page.waitForTimeout(2500);
            const switched = await page.evaluate((name) => {
                const btn = document.getElementById('db-site-switcher-btn');
                if (!btn) return 'no switcher';
                btn.click();
                const dd = document.getElementById('db-site-dropdown');
                if (!dd) return 'no dropdown';
                const hit = Array.from(dd.querySelectorAll('a,button,[data-site-id],li'))
                    .find((el) => (el.textContent || '').trim().includes(name));
                if (!hit) return 'not in the list';
                hit.click();
                return 'clicked';
            }, SITE_NAME);
            say('site switcher: ' + switched);
            expect(switched).toBe('clicked');
            await page.waitForTimeout(5000);

            // ── THE WIZARD, walked ───────────────────────────────────────────
            await page.goto(BASE_URL + '/dashboard?setup=1', { waitUntil: 'domcontentloaded' });
            await page.waitForTimeout(5000);

            // THE PROBE THAT COST THE FIRST PRESS, and it was mine. It looked for
            // `#wiz-loc-search` and `.wiz-type-btn` — elements of steps ONE and TWO.
            // Step zero is a welcome screen and carries no `wiz-` element at all, so
            // the probe answered "not open" about a wizard whose state was never
            // established, the walk never started, and the press measured nothing.
            //
            // What the wizard actually does on opening, read from `show()`: it
            // appends an overlay with `zIndex: 9999` and sets `body.style.overflow`
            // to `hidden`. Both are asked, and what was found is printed — so "not
            // open" can no longer be confused with "looked for the wrong thing".
            const open = await page.evaluate(() => {
                const overlay = Array.from(document.body.children)
                    .find((el) => el.style && el.style.zIndex === '9999');
                const stepText = (document.body.innerText.match(/Step \d+ of \d+/) || [])[0] || null;
                return {
                    overlayPresent: !!overlay,
                    bodyLocked: document.body.style.overflow === 'hidden',
                    stepIndicator: stepText,
                    buttons: Array.from(document.querySelectorAll('button'))
                        .map((b) => (b.textContent || '').trim()).filter((t) => t).slice(-4),
                };
            });
            say('the wizard on screen: ' + JSON.stringify(open));
            expect(open.overlayPresent || open.stepIndicator !== null).toBe(true);
            if (PROBE_ONLY) {
                say('PROBE ONLY: the probe reached the wizard; stopping before the walk. '
                    + 'Nothing was saved and no site was created.');
                return;
            }

            const nextButton = async (label) => {
                const clicked = await page.evaluate(() => {
                    const btns = Array.from(document.querySelectorAll('button'));
                    const next = btns.reverse().find((b) => /Next|Go to Dashboard/i.test(b.textContent || ''));
                    if (!next) return 'no next button';
                    next.click();
                    return (next.textContent || '').trim();
                });
                walked.push(label + ' -> ' + clicked);
                say('   step: ' + label + ' -> pressed ' + JSON.stringify(clicked));
                await page.waitForTimeout(2500);
            };

            await nextButton('welcome');
            // Location by hand, so no geocoding service decides whether this runs.
            await page.evaluate(() => {
                const lat = document.getElementById('wiz-lat');
                const lon = document.getElementById('wiz-lon');
                if (lat && lon) {
                    lat.value = '-37.8136';
                    lon.value = '144.9631';
                    lat.dispatchEvent(new Event('change', { bubbles: true }));
                    lon.dispatchEvent(new Event('change', { bubbles: true }));
                }
            });
            await page.waitForTimeout(500);
            await nextButton('location');
            const pickedType = await page.evaluate(() => {
                const el = document.querySelector('[data-type="sports"]');
                if (!el) return 'no sports tile';
                el.click();
                return 'sports';
            });
            say('   turf type chosen: ' + pickedType);
            expect(pickedType).toBe('sports');
            await page.waitForTimeout(800);
            await nextButton('turf type');
            const picked = await page.evaluate(() => {
                const sel = document.getElementById('wiz-species');
                if (!sel) return 'no species select';
                const option = Array.from(sel.options).find((o) => o.value);
                if (!option) return 'no species offered';
                sel.value = option.value;
                sel.dispatchEvent(new Event('change', { bubbles: true }));
                const method = document.querySelector('.wiz-method-btn');
                if (method) method.click();
                return option.value;
            });
            say('   species chosen: ' + JSON.stringify(picked));
            await page.waitForTimeout(800);
            await nextButton('species and methodology');
            await nextButton('finish');
            await page.waitForTimeout(8000);

            // ── What the screen says, and what the database holds ────────────
            screenAfter = await page.evaluate(() => ({
                url: location.pathname + location.search,
                wizardStillOpen: !!document.querySelector('#wiz-loc-search, .wiz-type-btn'),
                visibleError: (document.body.innerText.match(/could not save[^\n]*/i) || [])[0] || null,
            }));
            say('the screen afterwards: ' + JSON.stringify(screenAfter));
            say('native dialogs seen: ' + JSON.stringify(dialogs));
            say('non-GET requests: ' + JSON.stringify(writes));

            const cfg = query("SELECT CONCAT(IFNULL(JSON_EXTRACT(c.config,'$.turf.turfType'),'-'),'|',"
                + "IFNULL(JSON_EXTRACT(c.config,'$.turf.species'),'-'),'|',"
                + "IFNULL(JSON_EXTRACT(c.config,'$.wizard.complete'),'-'),'|',"
                + "IFNULL(JSON_EXTRACT(c.config,'$.turf.subCategory'),'(absent)')) "
                + "FROM site_configs c WHERE c.site_id='" + created.id + "' AND c.namespace='gaip'")[0] || '';
            const [turfType, species, wizardComplete, subCategory] = cfg.split('|');
            const site = query("SELECT CONCAT(IFNULL(latitude,''),'|',IFNULL(longitude,''),'|',provisional_name) "
                + "FROM sites WHERE id='" + created.id + "'")[0] || '';
            saved = { configRow: cfg !== '', turfType, species, wizardComplete, subCategory, site };
            say('what the database holds for that site: ' + JSON.stringify(saved));
        });

        afterAll(async () => {
            if (browser) await browser.close();
            transcript.close();
        });

        test('POSITIVE CONTROL: the wizard was reached and walked to the end', () => {
            say('steps walked: ' + JSON.stringify(walked));
            if (PROBE_ONLY) {
                say('PROBE ONLY: the walk is not part of this run.');
                expect(created.id).toBeTruthy();

                return;
            }
            expect(walked.length).toBeGreaterThanOrEqual(5);
            expect(created.id).toBeTruthy();
        });

        test('THE ANSWER: is the sports site saved', () => {
            if (PROBE_ONLY) {
                // The repo asserts `expect.hasAssertions()` for every case, so a
                // branch that claims nothing fails — correctly. What this branch can
                // claim is the positive control itself: the probe reached a wizard.
                say('PROBE ONLY: nothing was saved; what is claimed is that the probe reached the wizard.');
                expect(created.id).toBeTruthy();

                return;
            }
            say('ANSWER — config row written: ' + saved.configRow
                + ' | turfType: ' + saved.turfType + ' | species: ' + saved.species
                + ' | wizard.complete: ' + saved.wizardComplete
                + ' | subCategory: ' + saved.subCategory);
            expect(saved.configRow).toBe(true);
            expect(saved.turfType).toBe('"sports"');
            // GH-630: the key the wizard never asked for is not sent, so it is not
            // in the saved config either.
            expect(saved.subCategory).toBe('(absent)');
        });

        test('AND WHAT THE PERSON SEES: no failure dialog, and the wizard closed', () => {
            if (PROBE_ONLY) {
                say('PROBE ONLY: the wizard was left open on purpose; no dialog is expected either way.');
                expect(dialogs.filter((d) => /could not save/i.test(d.message))).toEqual([]);

                return;
            }
            // The item's gap: the connection `alert` was known only from the code.
            expect(dialogs.filter((d) => /could not save/i.test(d.message))).toEqual([]);
            expect(screenAfter.visibleError).toBeNull();
            expect(screenAfter.wizardStillOpen).toBe(false);
        });
    });
}

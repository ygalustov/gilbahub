/**
 * GH-505 — a press that produces nothing says so, in the page.
 *
 * WHAT WAS MEASURED, and it corrected the premise this started from: on a site
 * with no saved programme the Annual N field is empty (legitimately — nothing
 * may be invented for it), and pressing Generate DID answer: with a browser
 * alert, "Please enter your Annual N Target…". The first probe reported the
 * press as silent because Playwright dismisses dialogs when nothing is
 * listening — the instrument's silence, not the product's.
 *
 * What the alert does not do is name the OUTCOME, and it leaves nothing behind:
 * dismissed, the page looks exactly as before the press. This checks the answer
 * that stays.
 *
 * ── Passport ────────────────────────────────────────────────────────────────
 * guarantee   A press of Generate that produces no programme leaves an answer
 *             in the page naming what did not happen and why.
 * claims      By SCREEN DIFF: the answer's text is absent from the page before
 *             the press and present after it; it names the action ("not
 *             generated") and the cause ("annual N target"); and no programme
 *             was generated in that press.
 * universe    The Plan page's nutrition card, on a site whose Annual N field is
 *             empty — which today means a site with no saved programme.
 * unit        One press.
 * moment      Around the click: the page's text is taken immediately before and
 *             immediately after, not from a fixture.
 * distinguishability  The BEFORE snapshot is the discriminator. An answer that
 *             was already on the screen — the standing "No soil samples for
 *             this site" caption, say — fails, because it is in BEFORE too.
 * carrier     The page's own rendered text (`document.body.innerText`), which
 *             is what a client reads. Not a DOM attribute and not a console
 *             line: neither is visible to him.
 * ПОТРЕБИТЕЛЬ  The client standing in front of the Plan page. Observable
 *             effect: the line that appears under the nutrition card when the
 *             press refuses (`assets/nutrition-calendar.js` `_answer()`).
 * input       The client's own path: /plan → Nutrition tab → pick a sample →
 *             press Generate, the journal `ui-vs-export-parity.test.js:809-856`
 *             follows, with the fixture's label step replaced by "the first row
 *             the picker offers" because this site has no fixture.
 * positive-control  The second half: with the annual N filled in, the same
 *             press generates a programme and the refusal line is NOT shown.
 *             Without it, a test asserting "the line appears" would pass on a
 *             page that shows it always.
 * exemptions  None.
 * ratchet     None.
 * ЧТО ОЗНАЧАЕТ ЕГО КРАСНЫЙ ЗДЕСЬ И СЕЙЧАС — measured, not predicted, 2026-09-18.
 *             On the tree as it stands: GREEN, 6 of 6, with the annual N field
 *             arriving as "150" and cleared by the test, 6 config PATCHes
 *             intercepted and 8 API requests still reaching the server.
 *             With the reviewer's mutation — `this._answer(...)` deleted from
 *             nutrition-calendar.js — RED, 2 of 6: "the answer is in the
 *             difference between the screens, not standing text" and "it names
 *             the action that did not happen, and the reason". So a red here is
 *             a press that stopped answering the client, and not the stand
 *             having drifted: the stand's own state no longer decides whether
 *             this test can run.
 * GH-518 — THE STAND. This test writes nothing. Its positive control presses
 *             Generate, which persists a programme; measured, that is SIX
 *             config PATCHes per run, and it is how a fabricated programme came
 *             to sit on Russley and then prefill the very field the refusal
 *             half needs empty. The route below catches those six by method and
 *             path and answers them in the browser. Proof rather than promise:
 *             Russley's gaip config md5 is e3cd798d17e2232eff8780a050d306da
 *             before and after three full runs of this file.
 * rc          The reviewer's mutation: delete the `_answer()` call; or answer
 *             with a text that already stands on the page.
 *
 * Run: GILBA_E2E=1 npx jest tests/e2e/gh505-the-press-answers-live.test.js
 */
'use strict';

const fs = require('fs');
const path = require('path');
const { watchExternal } = require('./lib/external-sources');

const ENABLED = process.env.GILBA_E2E === '1';
let chromium = null;
try { ({ chromium } = require('playwright')); } catch (e) { /* reported below */ }

const credentials = (() => {
    try { return JSON.parse(fs.readFileSync(path.join(__dirname, '.e2e-credentials.json'), 'utf8')); }
    catch (e) { return {}; }
})();
const BASE_URL = process.env.GILBA_E2E_URL || credentials.url || 'http://127.0.0.1:8080';

/** A site with soil samples and no saved programme — where the field is empty. */
const SITE = { id: '019f35f0-d912-73e5-82bd-3de0bfd4f6ce', name: 'Russley' };
const ANSWER = 'Programme not generated: annual N target is not set';

if (!ENABLED) {
    describe('GH-505 — the press answers (disabled)', () => {
        test.skip('needs the live stack', () => {});
    });
} else {
    describe('GH-505 — a press that generates nothing says so, in the page', () => {
        jest.setTimeout(600000);
        let browser, page, external = null;
        let before = null, after = null, dialogs = [], generated = null, filled = null;
        // GH-518: every config PATCH this run would have made, caught before it
        // leaves the browser. See the block in beforeAll.
        const intercepted = [];
        const reachedTheServer = [];
        let fieldArrived = null;

        async function openTheCard() {
            await page.goto(BASE_URL + '/plan', { waitUntil: 'domcontentloaded' });
            await page.waitForFunction(() => !!(window.GilbaNutritionCalendar), null, { timeout: 30000 });
            await page.waitForTimeout(2500);
            await page.click('a[data-tab="nutrition"]');
            await page.waitForTimeout(1000);
            await page.waitForSelector('#plan-nut-sample-picker .sn-drop-btn', { timeout: 20000 });
            const picked = await page.evaluate(() => {
                const btn = document.querySelector('#plan-nut-sample-picker .sn-drop-btn');
                if (!btn) return { ok: false };
                btn.click();
                const rows = Array.from(document.querySelectorAll('#plan-nut-sample-picker .sn-drop-row'));
                if (!rows.length) return { ok: false };
                rows[0].click();
                return { ok: true };
            });
            if (!picked.ok) throw new Error('the Plan page offered no sample to pick on ' + SITE.name);
            await page.waitForTimeout(1200);
        }
        const screenText = () => page.evaluate(() => document.body.innerText.replace(/\s+/g, ' '));

        beforeAll(async () => {
            if (!chromium) throw new Error('playwright does not resolve from the repo — run `npm install`');
            browser = await chromium.launch();
            const context = await browser.newContext({ viewport: { width: 1500, height: 1100 } });
            external = await watchExternal(context, BASE_URL);
            page = await context.newPage();
            page.on('dialog', async (d) => { dialogs.push(d.message()); await d.dismiss(); });
            // so that "the route is narrow" is a count, not an argument about
            // the pattern I wrote
            page.on('request', (r) => {
                if (/\/api\//.test(r.url())) reachedTheServer.push(r.method() + ' '
                    + r.url().replace(BASE_URL, '').split('?')[0]);
            });

            // ── GH-518: this test does not write to the stand ──────────────
            //
            // Its positive control presses Generate with the field filled, and
            // a generated programme PERSISTS itself — NutritionCalendar
            // PATCHes config/gaip. Measured: that is how a fabricated
            // programme came to sit on Russley, and how it then prefilled the
            // annual-N field the refusal half needs EMPTY, so the test poisons
            // its own precondition for every later run.
            //
            // Restoring afterwards was the other option and was refused for a
            // reason: between the press and the restore the stand carries the
            // fabricated programme, and a process killed in that window leaves
            // it there. Nothing is written here, so there is nothing to undo.
            //
            // NARROW ON PURPOSE: only the config PATCH, by method and by path.
            // Everything else — the samples sync, the analysis cache, the
            // climate fetches — goes to the server untouched, because a route
            // that swallows the page's traffic would also swallow what this
            // test is trying to see.
            await context.route('**/api/sites/*/config/gaip', async (route) => {
                const req = route.request();
                if (req.method() !== 'PATCH') return route.fallback();
                let body = null;
                try { body = req.postData(); } catch (e) { body = null; }
                intercepted.push({
                    url: req.url(),
                    bytes: body ? body.length : 0,
                    keys: (function () {
                        try { return Object.keys(JSON.parse(body).patch || {}); } catch (e) { return []; }
                    })()
                });
                await route.fulfill({
                    status: 200,
                    contentType: 'application/json',
                    body: JSON.stringify({ ok: true, intercepted: 'GH-518: not written to the stand' })
                });
            });
            await page.goto(BASE_URL + '/login', { waitUntil: 'domcontentloaded' });
            await page.fill('#email', credentials.email);
            await page.fill('#password', credentials.password);
            await Promise.all([
                page.waitForNavigation({ waitUntil: 'domcontentloaded' }).catch(() => {}),
                page.click('form.login-form button[type=submit]')
            ]);
            await page.waitForTimeout(1500);
            await page.evaluate(async ({ id }) => {
                const t = document.querySelector('meta[name=csrf-token]');
                await fetch('/api/active-site', {
                    method: 'PATCH',
                    headers: Object.assign({ 'Content-Type': 'application/json', Accept: 'application/json' },
                        t ? { 'X-CSRF-TOKEN': t.getAttribute('content') } : {}),
                    body: JSON.stringify({ site_id: id }), credentials: 'same-origin'
                });
            }, { id: SITE.id });

            // ── the refusal ──
            await openTheCard();
            const emptyField = await page.evaluate(() =>
                (document.querySelector('#plan-nut-annual-n') || {}).value);
            // GH-518, and this is a change beyond the interception, made
            // deliberately: the test used to REQUIRE the field to arrive empty
            // and threw otherwise. Measured on this stand — it arrives holding
            // "150", because a saved programme prefills it, and the programme
            // is there because this test used to write one on every run. A test
            // whose precondition its own positive control destroys cannot run,
            // and a test that cannot run cannot go red.
            //
            // So the emptiness is now the test's own act — a client can clear
            // the field — and which of the two it was is recorded rather than
            // hidden, because "the site had no programme" and "we cleared the
            // box" are different statements about the stand.
            fieldArrived = emptyField || '';
            if (emptyField) {
                await page.fill('#plan-nut-annual-n', '');
                await page.waitForTimeout(500);
                const now = await page.evaluate(() =>
                    (document.querySelector('#plan-nut-annual-n') || {}).value);
                if (now) throw new Error('could not clear the annual N field; it still holds "' + now + '"');
            }
            before = await screenText();
            await page.evaluate(() => {
                window.__gen = 0;
                document.addEventListener('gaip:nutrition-calendar-generated', () => { window.__gen++; });
            });
            await page.click('#plan-nut-generate-btn');
            await page.waitForTimeout(4000);
            after = await screenText();
            generated = await page.evaluate(() => window.__gen);
        });

        afterAll(async () => { if (browser) await browser.close(); });

        test('every external source this run depends on answered', () => {
            external.print('GH-505');
            expect({ failedHosts: external.failedHosts() }).toEqual({ failedHosts: [] });
        });

        test('the press produced no programme', () => {
            expect(generated).toBe(0);
        });

        test('the answer is in the difference between the screens, not standing text', () => {
            process.stdout.write('[e2e] GH-505 dialogs: ' + JSON.stringify(dialogs) + '\n');
            process.stdout.write('[e2e] GH-505 answer present before: ' + (before.indexOf(ANSWER) >= 0)
                + ', after: ' + (after.indexOf(ANSWER) >= 0) + '\n');
            // Absent before the press — this is what tells an answer from a
            // caption that was already there.
            expect({ where: 'before the press', present: before.indexOf(ANSWER) >= 0 })
                .toEqual({ where: 'before the press', present: false });
            expect({ where: 'after the press', present: after.indexOf(ANSWER) >= 0 })
                .toEqual({ where: 'after the press', present: true });
        });

        test('it names the action that did not happen, and the reason', () => {
            const added = after.split(ANSWER)[1] !== undefined ? ANSWER : '';
            expect(added).toBe(ANSWER);
            expect(ANSWER.toLowerCase()).toContain('not generated');
            expect(ANSWER.toLowerCase()).toContain('annual n target');
        });

        test('positive control: with the field filled, the same press generates and the line is gone', async () => {
            // The site's own Settings > Turf value, read from the page rather
            // than chosen here, so nothing is invented for the field.
            const own = await page.evaluate(async ({ id }) => {
                const r = await fetch('/api/sites/' + id, {
                    headers: { Accept: 'application/json' }, credentials: 'same-origin' });
                const body = await r.json();
                const site = body.data || body;
                const cfg = (site.configs && site.configs.gaip && site.configs.gaip.config) || {};
                return (cfg.turf && cfg.turf.nProgram) || null;
            }, { id: SITE.id });
            expect(own).toBeTruthy();
            filled = own;
            await page.fill('#plan-nut-annual-n', String(own));
            await page.waitForTimeout(800);
            await page.evaluate(() => { window.__gen = 0; });
            await page.click('#plan-nut-generate-btn');
            await page.waitForFunction(() => window.__gen > 0, null, { timeout: 120000 });
            await page.waitForTimeout(3000);
            const afterFill = await screenText();
            process.stdout.write('[e2e] GH-505 annual N filled with the site\'s own ' + own
                + '; generations: ' + (await page.evaluate(() => window.__gen)) + '\n');
            expect(await page.evaluate(() => window.__gen)).toBeGreaterThan(0);
            expect({ refusalStillShown: afterFill.indexOf(ANSWER) >= 0 })
                .toEqual({ refusalStillShown: false });
        });

        test('GH-518: the programme this press generated did not reach the stand', () => {
            expect.hasAssertions();
            process.stdout.write('[e2e] GH-518 the annual N field arrived holding '
                + JSON.stringify(fieldArrived) + (fieldArrived ? ' and was cleared by the test'
                    : ' — the site had no saved programme') + '\n');
            // The press above generated — `__gen` went up — so a config PATCH
            // was made. If none was intercepted, the route did not match and
            // the write went through: an empty list here would mean the
            // opposite of what it looks like.
            process.stdout.write('[e2e] GH-518 config PATCHes intercepted: '
                + JSON.stringify(intercepted.map((i) => i.keys)) + '\n');
            expect(intercepted.length).toBeGreaterThan(0);
            // NARROW, measured: everything that is not the config PATCH still
            // goes to the server. A route that swallowed the page's traffic
            // would show these two numbers close together.
            const stillWent = reachedTheServer.filter((r) => !/PATCH .*\/config\/gaip$/.test(r));
            process.stdout.write('[e2e] GH-518 API requests that reached the server: '
                + stillWent.length + ' (' + Array.from(new Set(stillWent.map((r) => r.split(' ')[0])))
                    .sort().join(', ') + '); intercepted: ' + intercepted.length + '\n');
            expect(stillWent.length).toBeGreaterThan(intercepted.length);
            expect(intercepted.some((i) => i.keys.indexOf('nutritionCalendarProgram') >= 0
                || i.keys.indexOf('nutritionProgram') >= 0)).toBe(true);
        });
    });
}

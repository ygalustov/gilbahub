/**
 * GH-655 — WHAT A PERSON SEES ON THE WATER BALANCE PAGE: IS THERE A LIST OF
 * SAMPLES, IS THE ONE THE CALCULATION USED MARKED IN IT, AND WHAT HAPPENS WHEN
 * ANOTHER ONE IS CHOSEN.
 *
 * WHY A LIVE FILE AND NOT A READING OF THE CODE. The owner described how she
 * thinks it works and asked whether it does. Her points 2 and 3 are about the
 * screen, and the code can only say what it intends: the mark is drawn from
 * three candidate sources in order, and which of them wins on a real page,
 * after a real load, is not visible in the source.
 *
 * WHAT THIS SITE HOLDS, measured in the database before the run (read-only):
 * `Russley` has exactly two live water samples, and their readings are far
 * apart, which is what makes the second half of this measurable at all —
 *
 *     114  "Bore water"    2026-07-19   EC 0.5   Na 1
 *     115  "Bore water 2"  2026-07-20   EC 90    Na 2
 *
 * Five more water rows exist and are all soft-deleted, so a list of more than
 * two would itself be a finding.
 *
 * IT PRESSES, AND THE PRESS IS DECLARED. Choosing a water sample is not a
 * display change: the page clicks `#db-rerun-btn` for you, so one selection is
 * one Re-run and one new analysis row for `Russley`. The press is authorised.
 * Nothing else is written: no sample is edited and none is deleted.
 *
 * BOTH OUTCOMES ARE NAMED HERE, BEFORE THE RUN, so that neither can be read as
 * the expected one afterwards:
 *   - the page's water numbers become 114's (EC 0.5) -> her point 3 holds, the
 *     selection recalculates by the chosen sample;
 *   - they stay 115's (EC 90) -> it does not hold, and what happened instead is
 *     printed rather than guessed at.
 * The same for point 2: the marked row either is the sample the run used, or it
 * is not, and in the second case the transcript carries what decided the mark.
 *
 * ASSERTIONS ARE POSITIVE CONTROLS ONLY. This file is a measurement for the
 * owner, not a guard over today's behaviour: it asserts that the page, the tab,
 * the list and the numbers were actually reached, because "no list" and "the
 * page never rendered" are otherwise the same output. The answers themselves are
 * printed.
 *
 * Run: GILBA_E2E=1 npx jest tests/e2e/gh655-the-water-sample-list-on-screen-live.test.js --runInBand
 */

'use strict';

const fs = require('fs');
const path = require('path');

const ENABLED = process.env.GILBA_E2E === '1';
const SITE_NAME = process.env.GILBA_WB_SITE || 'Russley';
/** The sample to choose: 114, the one the run did NOT use if it used the latest. */
const CHOOSE_LABEL = process.env.GILBA_WB_CHOOSE || 'Bore water';

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

const { openTranscript } = require('./lib/transcript');

if (!ENABLED) {
    process.stdout.write('[e2e] gh655-the-water-sample-list-on-screen skipped (needs the live stack; it presses once)\n');
    test.skip('GH-655 the water sample list on screen (disabled)', () => {});
} else {
    describe('GH-655 — the water sample list a person sees', () => {
        jest.setTimeout(420000);
        let browser, page;
        const transcript = openTranscript('gh655-live');
        const say = (line) => transcript.say(line);
        /** Every request the page made, so "a recalculation happened" is not a guess. */
        const posts = [];
        let before = null;
        let listBefore = null;
        let after = null;
        let listAfter = null;
        let clicked = 'not attempted';

        /** What the page itself says about the water it computed, and the list beside it. */
        const readScreen = () => page.evaluate(() => {
            const d = window.GAIP_DASHBOARD_DATA || {};
            const wb = (d.computed && d.computed.waterBalance) || null;
            const rows = Array.from(document.querySelectorAll('#wb-drop-list-water .sn-drop-row'))
                .map((r) => ({
                    text: (r.textContent || '').trim().replace(/\s+/g, ' '),
                    marked: r.classList.contains('active'),
                    idx: r.dataset.wbIdx,
                }));
            let stored = null;
            try { stored = localStorage.getItem('gilba_wb_active_water'); } catch (e) { stored = 'unreadable'; }
            const num = (id) => {
                const el = document.getElementById(id);
                return el ? (el.textContent || '').trim() : null;
            };
            // The ion table is the page's own printing of the water's readings.
            const ions = Array.from(document.querySelectorAll('.wb-ion-table tbody tr'))
                .map((tr) => Array.from(tr.querySelectorAll('td')).map((td) => td.textContent.trim()).join(' | '));
            return {
                selectorPresent: !!document.getElementById('wb-water-selector'),
                selectorHtmlLength: (document.getElementById('wb-water-selector') || { innerHTML: '' }).innerHTML.length,
                buttonLabel: (document.getElementById('wb-drop-label-water') || {}).textContent || null,
                rows,
                storedSelection: stored,
                runSays: wb ? {
                    sourceLabel: wb.sourceLabel === undefined ? '(absent)' : wb.sourceLabel,
                    source: wb.source === undefined ? '(absent)' : wb.source,
                    testDate: wb.testDate === undefined ? '(absent)' : wb.testDate,
                    EC: wb.EC === undefined ? '(absent)' : wb.EC,
                    SAR: wb.SAR === undefined ? '(absent)' : wb.SAR,
                    sodiumPpm: wb.Na === undefined ? '(absent)' : wb.Na,
                } : null,
                ions,
                status: num('wb-water-status'),
            };
        });

        beforeAll(async () => {
            if (!chromium) throw new Error('playwright does not resolve from the repo — run `npm install`');
            if (!EMAIL || !PASSWORD) throw new Error('no credentials — see tests/e2e/.e2e-credentials.example.json');
            browser = await chromium.launch();
            page = await browser.newPage();
            page.on('request', (r) => {
                if (r.method() !== 'GET') posts.push(r.method() + ' ' + r.url().replace(BASE_URL, ''));
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

            await page.goto(BASE_URL + '/dashboard', { waitUntil: 'domcontentloaded' });
            await page.waitForTimeout(2500);
            const standing = await page.evaluate(() => ({
                label: (document.getElementById('db-site-switcher-btn') || {}).textContent || '',
            }));
            say('standing on: ' + standing.label.trim().replace(/\s+/g, ' '));
            if (!String(standing.label).includes(SITE_NAME)) {
                await page.click('#db-site-switcher-btn');
                await page.waitForTimeout(600);
                const hit = await page.evaluate((name) => {
                    const dd = document.getElementById('db-site-dropdown');
                    if (!dd) return 'no dropdown';
                    const items = Array.from(dd.querySelectorAll('a,button,[data-site-id],li'));
                    const el = items.find((x) => (x.textContent || '').trim().includes(name));
                    if (!el) return 'not in the list';
                    el.click();
                    return 'clicked';
                }, SITE_NAME);
                say('site switcher: ' + hit);
                expect(hit).toBe('clicked');
                await page.waitForTimeout(5000);
            }

            await page.goto(BASE_URL + '/analysis', { waitUntil: 'domcontentloaded' });
            await page.waitForTimeout(7000);
            const tab = await page.evaluate(() => {
                const a = document.querySelector('[data-tab="water-balance"]');
                if (!a) return 'no tab link';
                a.click();
                return 'clicked';
            });
            say('water-balance tab: ' + tab);
            expect(tab).toBe('clicked');
            await page.waitForTimeout(7000);

            before = await readScreen();
            listBefore = before.rows;
            say('--- BEFORE ANY SELECTION ---');
            say('water selector on the page: ' + before.selectorPresent
                + ' | rendered characters: ' + before.selectorHtmlLength);
            say('the button says: ' + JSON.stringify(before.buttonLabel));
            say('rows in the list (' + before.rows.length + '):');
            before.rows.forEach((r) => say('   ' + (r.marked ? '[MARKED] ' : '[      ] ') + r.text));
            say('the browser had a stored selection: ' + JSON.stringify(before.storedSelection));
            say('the run says it used: ' + JSON.stringify(before.runSays));
            say('ion table before: ' + JSON.stringify(before.ions));

            // THE PRESS. One selection of "Bore water" (114). The page turns this
            // into a Re-run on its own; that is the declared press.
            clicked = await page.evaluate((label) => {
                const btn = document.getElementById('wb-drop-btn-water');
                if (!btn) return 'no dropdown button';
                btn.click();
                const rows = Array.from(document.querySelectorAll('#wb-drop-list-water .sn-drop-row'));
                if (!rows.length) return 'dropdown opened but no rows';
                // EXACT, on the name cell alone. `includes` was wrong and the
                // first run proved it: "Bore water 2" contains "Bore water", so
                // the search found the row that was already marked, reported
                // itself as "already the marked one", and pressed nothing. A
                // substring match between two samples whose names differ by a
                // suffix is the same class of silent miss this measurement is
                // about.
                const nameOf = (r) => ((r.querySelector('.sn-drop-cell-zone') || {}).textContent || '').trim();
                const hit = rows.find((r) => nameOf(r) === label);
                if (!hit) return 'no row named exactly ' + label + ' among ' + JSON.stringify(rows.map(nameOf));
                if (hit.classList.contains('active')) return 'that row is already the marked one';
                hit.click();
                return 'clicked';
            }, CHOOSE_LABEL);
            say('--- SELECTION OF "' + CHOOSE_LABEL + '": ' + clicked + ' ---');

            if (clicked === 'clicked') {
                // The re-run runs the calculation in the hidden page and then the
                // tab re-renders; the wait is generous because this is one press
                // and there is no second one.
                await page.waitForTimeout(90000);
                await page.evaluate(() => {
                    const a = document.querySelector('[data-tab="water-balance"]');
                    if (a) a.click();
                });
                await page.waitForTimeout(6000);
            }

            after = await readScreen();
            listAfter = after.rows;
            say('--- AFTER THE SELECTION ---');
            say('the button says: ' + JSON.stringify(after.buttonLabel));
            say('rows in the list (' + after.rows.length + '):');
            after.rows.forEach((r) => say('   ' + (r.marked ? '[MARKED] ' : '[      ] ') + r.text));
            say('the browser now stores: ' + JSON.stringify(after.storedSelection));
            say('the run says it used: ' + JSON.stringify(after.runSays));
            say('ion table after: ' + JSON.stringify(after.ions));
            say('non-GET requests the page made: ' + JSON.stringify(posts));
        });

        afterAll(async () => {
            if (browser) await browser.close();
            transcript.close();
        });

        test('POSITIVE CONTROL: the page rendered, the water balance has numbers, and the list is on it', () => {
            // Without this, every line above could be the output of a page that
            // never loaded, and "no list" would be indistinguishable from "no page".
            expect(before).not.toBeNull();
            expect(before.runSays).not.toBeNull();
            expect(before.ions.length).toBeGreaterThan(0);
            expect(before.selectorPresent).toBe(true);
        });

        test('POINT 2 — the list exists and one row is marked; what it is, is printed', () => {
            expect(Array.isArray(listBefore)).toBe(true);
            const marked = listBefore.filter((r) => r.marked);
            say('POINT 2 ANSWER: rows=' + listBefore.length + ' marked=' + marked.length
                + ' marked row=' + JSON.stringify(marked.map((r) => r.text))
                + ' | the run used ' + JSON.stringify(before.runSays && before.runSays.sourceLabel)
                + ' dated ' + JSON.stringify(before.runSays && before.runSays.testDate));
            // Exactly one mark, or the page is telling a person two different things.
            expect(marked.length).toBe(1);
        });

        test('POINT 3 — what the selection did, printed as a comparison', () => {
            const sameNumbers = JSON.stringify(before.runSays) === JSON.stringify(after.runSays);
            say('POINT 3 ANSWER: selection=' + clicked
                + ' | the run\'s water changed: ' + (!sameNumbers)
                + ' | before EC=' + JSON.stringify(before.runSays && before.runSays.EC)
                + ' after EC=' + JSON.stringify(after.runSays && after.runSays.EC)
                + ' | marked before=' + JSON.stringify(listBefore.filter((r) => r.marked).map((r) => r.text))
                + ' after=' + JSON.stringify(listAfter.filter((r) => r.marked).map((r) => r.text)));
            // The press either happened or the reason it did not is in `clicked`.
            expect(['clicked', 'that row is already the marked one']).toContain(clicked);
        });
    });
}

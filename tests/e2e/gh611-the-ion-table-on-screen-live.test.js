/**
 * GH-611 — WHAT THE ION TABLE ACTUALLY SHOWS, READ OFF THE PAGE.
 *
 * WHY A LIVE FILE. The unit case renders `renderIons` against a record shaped
 * by hand; this reads the table a client reads, on a row the product wrote
 * itself. The difference has mattered here before: a bench more forgiving than
 * the run proves nothing about the run (GH-595).
 *
 * IT PRESSES NOTHING. No Re-run, no save, no write of any kind — it logs in,
 * stands on a site and reads. Every press on this stand is announced one at a
 * time, and a file that reads must not become a file that presses: that is how
 * an unannounced press happened earlier today, when a live file was re-run
 * merely to re-read its output.
 *
 * WHAT IT EXPECTS AND WHY THIS SITE. `Burns` is the only one of the eight live
 * water samples whose carbonate is a measured zero (sample 54, `CO3: 0`), and
 * its row was rewritten after the change, so it carries `measuredIons`. Before
 * the change that row drew no carbonate line, and the table could not say
 * whether the water had been tested for it.
 *
 * Run: GILBA_E2E=1 npx jest tests/e2e/gh611-the-ion-table-on-screen-live.test.js --runInBand
 */

'use strict';

const fs = require('fs');
const path = require('path');

const ENABLED = process.env.GILBA_E2E === '1';
const SITE_NAME = process.env.GILBA_ION_SITE || 'Burns';

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

/**
 * THE STAND REMEDY, APPLIED RATHER THAN EXEMPTED (GH-532).
 *
 * This file only reads, so `guardStand` costs it nothing — and that is the
 * argument for using it instead of asking for an exemption: if this page ever
 * starts writing site state while being merely looked at, the guard holds the
 * write and says so, instead of the stand quietly moving under a test that
 * claims to be passive. An exemption would have recorded the intention; the
 * remedy checks it.
 */
const { openTranscript } = require('./lib/transcript');

let guardStand = null;
try { ({ guardStand } = require('./lib/stand-guard')); } catch (e) { /* reported below */ }

if (!ENABLED) {
    process.stdout.write('[e2e] gh611-the-ion-table-on-screen skipped (needs the live stack; it presses nothing)\n');
    test.skip('GH-611 the ion table on screen (disabled)', () => {});
} else {
    describe('GH-611 — the ion table on screen', () => {
        jest.setTimeout(300000);
        let browser, page;
        let heldWrites = [];
        // GH-613: written to a file as well as the stream, so this run never
        // has to be repeated merely to be read.
        const transcript = openTranscript('gh611-live');
        const say = (line) => transcript.say(line);

        beforeAll(async () => {
            if (!chromium) throw new Error('playwright does not resolve from the repo — run `npm install`');
            if (!EMAIL || !PASSWORD) throw new Error('no credentials — see tests/e2e/.e2e-credentials.example.json');
            if (!guardStand) throw new Error('tests/e2e/lib/stand-guard.js does not resolve');
            browser = await chromium.launch();
            page = await browser.newPage();
            const guard = await guardStand(page);
            heldWrites = guard.held;

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
            if (!String(standing.label).includes(SITE_NAME)) {
                await page.click('#db-site-switcher-btn');
                await page.waitForTimeout(600);
                const clicked = await page.evaluate((name) => {
                    const dd = document.getElementById('db-site-dropdown');
                    if (!dd) return 'no dropdown';
                    const items = Array.from(dd.querySelectorAll('a,button,[data-site-id],li'));
                    const hit = items.find((el) => (el.textContent || '').trim().includes(name));
                    if (!hit) return 'not in the list';
                    hit.click();
                    return 'clicked';
                }, SITE_NAME);
                say('switcher: ' + clicked);
                expect(clicked).toBe('clicked');
                await page.waitForTimeout(4000);
            }
            // The table lives on the Water Balance TAB of /analysis, and the
            // tab renders on demand (`analysis-router.js:52`). Opened through
            // the page's own tab link rather than by calling the module, so
            // what is read is what a person reaching it would see.
            await page.goto(BASE_URL + '/analysis', { waitUntil: 'domcontentloaded' });
            await page.waitForTimeout(6000);
            const tab = await page.evaluate(() => {
                const a = document.querySelector('[data-tab="water-balance"]');
                if (!a) return 'no tab link';
                a.click();
                return 'clicked';
            });
            say('water-balance tab: ' + tab);
            expect(tab).toBe('clicked');
            await page.waitForTimeout(5000);
        });

        afterAll(async () => {
            if (browser) await browser.close();
            // GH-614: the path, last, so a filtered terminal still has it.
            transcript.close();
        });

        test('the carbonate the lab measured as zero has a row, and it carries no badge', async () => {
            const table = await page.evaluate(() => {
                const t = document.querySelector('.wb-ion-table');
                if (!t) return null;
                return Array.from(t.querySelectorAll('tbody tr')).map((tr) =>
                    Array.from(tr.querySelectorAll('td')).map((td) => td.textContent.trim()));
            });

            // Positive control first: the table is on the page at all, or every
            // claim below would be about an absence.
            expect(table).not.toBeNull();
            say('rows on screen: ' + JSON.stringify(table));

            const co3 = table.find((r) => /Carbonate/.test(r[0]));
            expect(co3).toBeTruthy();
            // The number is shown...
            expect(co3[1]).toBe('0.00');
            // ...and the status cell is empty, because the wording for
            // "measured, and there is none" does not exist yet.
            expect(co3[3]).toBe('');

            // And an ion with a real reading still carries its badge, or this
            // would pass on a table that stopped badging altogether.
            const hco3 = table.find((r) => /Bicarbonate/.test(r[0]));
            expect(hco3).toBeTruthy();
            expect(hco3[3]).not.toBe('');
        });

        test('and nothing was written to the stand while it was being read', () => {
            // Printed rather than only asserted: a held write is a finding
            // about the page, not about this file, and it should be readable.
            heldWrites.forEach((w) => say('HELD WRITE: ' + JSON.stringify(w).slice(0, 200)));
            expect(heldWrites).toEqual([]);
        });
    });
}

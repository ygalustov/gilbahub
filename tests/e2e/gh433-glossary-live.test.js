/**
 * GH-433 live — the legend the reader actually gets when the popover opens.
 *
 * The offline pins (tests/gh433-one-glossary-entry.test.js) prove there is one
 * registration and that it carries GH-415's sentence. They cannot prove what
 * reaches the browser, because the defect WAS the browser: two files registered
 * the same key with Object.assign and the one loaded second won. So this reads
 * window.GAIP_GLOSSARY on the real page, after every script on it has run, and
 * on a New Zealand site — the surface where the stale Australian copy was most
 * obviously wrong, because GH-415's non-zero Required figures are printed there.
 *
 * Run: GILBA_E2E=1 npx jest tests/e2e/gh433-glossary-live.test.js --runInBand --testTimeout=300000
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

const KEY = 'prebble-nutrient-delivery-summary';
const GH415_SENTENCE = 'above the ceiling, only what keeps the';
const STALE_SENTENCE = '0 once soil ≥ ceiling';

let chromium = null;
try { ({ chromium } = require('playwright')); } catch (e) { /* reported below */ }

if (!ENABLED) {
    process.stdout.write('[e2e] gh433-glossary-live skipped (needs the live stack)\n');
    test.skip('GH-433 live legend check (disabled)', () => {});
} else {
    describe('GH-433 — the legend on the page says what the table does', () => {
        let browser, page;
        let entry = null;
        let registrations = null;

        beforeAll(async () => {
            if (!chromium) throw new Error('playwright does not resolve from the repo — run `npm install`');
            if (!EMAIL || !PASSWORD) throw new Error('no credentials — see tests/e2e/.e2e-credentials.example.json');

            browser = await chromium.launch();
            page = await browser.newPage();
            await page.goto(BASE_URL + '/login', { waitUntil: 'domcontentloaded' });
            await page.fill('#email', EMAIL);
            await page.fill('#password', PASSWORD);
            await Promise.all([
                page.waitForNavigation({ waitUntil: 'domcontentloaded' }).catch(() => {}),
                page.click('form.login-form button[type=submit]'),
            ]);
            await page.waitForTimeout(1200);
            if (/\/login/.test(page.url())) throw new Error('login refused for ' + EMAIL);

            // Counting the writers, not just reading the winner: a second
            // registration that happens to agree today is the same defect
            // waiting for the next edit, so the page is instrumented before its
            // scripts run.
            await page.addInitScript((key) => {
                window.__gh433Writes = [];
                let store = {};
                Object.defineProperty(window, 'GAIP_GLOSSARY', {
                    configurable: true,
                    get() { return store; },
                    set(v) {
                        if (v && Object.prototype.hasOwnProperty.call(v, key)) {
                            window.__gh433Writes.push({ how: 'assign', body: String(v[key] && v[key].body || '') });
                        }
                        store = v;
                    },
                });
                // A direct `GAIP_GLOSSARY[key] = ...` does not go through the
                // setter, so the object itself is watched too, once it exists.
                const tick = setInterval(() => {
                    if (store && store[key] && !window.__gh433Seen) {
                        window.__gh433Seen = true;
                        window.__gh433Writes.push({ how: 'key', body: String(store[key].body || '') });
                    }
                }, 50);
                window.addEventListener('load', () => setTimeout(() => clearInterval(tick), 4000));
            }, KEY);

            await page.goto(BASE_URL + '/plan', { waitUntil: 'domcontentloaded' });
            await page.waitForFunction(() => !!window.GAIP_NutrientBalanceStatus, null, { timeout: 60000 });
            await page.waitForTimeout(3000);

            entry = await page.evaluate((key) => {
                const g = window.GAIP_GLOSSARY || {};
                return g[key] ? { title: g[key].title, body: g[key].body } : null;
            }, KEY);
            registrations = await page.evaluate(() => window.__gh433Writes || []);

            process.stdout.write('[gh433] registrations seen: ' + JSON.stringify(registrations.map((r) => r.how)) + '\n');
            process.stdout.write('[gh433] legend on the page:\n' +
                String((entry && entry.body) || '(none)').split('\n').map((l) => '      ' + l).join('\n') + '\n');
        }, 300000);

        afterAll(async () => { if (browser) await browser.close(); });

        test('the popover has a legend at all', () => {
            expect(entry).not.toBeNull();
            expect(entry.title).toBe('Nutrient Delivery Summary');
        });

        test('it carries GH-415\'s rule for Required above the ceiling', () => {
            expect(entry.body).toContain(GH415_SENTENCE);
        });

        test('and not the sentence the Australian twin used to overwrite it with', () => {
            expect(entry.body).not.toContain(STALE_SENTENCE);
        });

        test('exactly one script on the page registered it', () => {
            // The defect was two writers, not a wrong body: the body was only
            // wrong because the second writer won. This is the assertion that
            // stays true if someone re-adds a copy that happens to agree.
            expect(registrations.length).toBe(1);
        });
    });
}

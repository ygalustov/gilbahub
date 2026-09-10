/**
 * GH-404 live check — the Settings Site form, in a real browser, refuses to save
 * a site whose coordinates have been cleared.
 *
 * The structural test next door (tests/gh404-settings-requires-location.test.js)
 * pins the source. It cannot see the half that matters here: the form carries
 * `novalidate`, so the `required` attribute does nothing on its own, and whether
 * the save is actually stopped depends on the JS handler running, finding the
 * fields, and returning before the PATCH goes out. That is what this test reads.
 *
 * It clears the coordinate inputs the way a user would — selecting the contents
 * and deleting them — then submits, and asserts three things: an error message
 * appears, no request reaches PATCH /api/sites/{id}, and the site's stored
 * coordinates are unchanged afterwards.
 *
 * The site's real coordinates are never written to; only the form inputs are
 * touched, and the page is reloaded at the end. Burns is used because it is the
 * control site elsewhere in the harness and has settled coordinates.
 *
 * Credentials come from tests/e2e/.e2e-credentials.json, same as the parity
 * harness. Run: npm run test:e2e:location
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

const SITE = { name: 'Burns', id: '019e96d8-97b7-714c-9bd6-d65b16ec7f2e' };

let chromium = null;
try { ({ chromium } = require('playwright')); } catch (e) { /* reported below */ }

if (!ENABLED) {
    process.stdout.write('[e2e] gh404-settings-location-required-live skipped (needs the live stack) — npm run test:e2e:location\n');
    test.skip('GH-404 live gate (disabled)', () => {});
} else {
    describe('GH-404 — the rendered Site form will not save without coordinates', () => {
        let browser, page, previousActiveSiteId = null;
        let storedBefore = null;

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
                await fetch('/api/active-site', {
                    method: 'PATCH',
                    headers: Object.assign({ 'Content-Type': 'application/json', Accept: 'application/json' },
                        t ? { 'X-CSRF-TOKEN': t.getAttribute('content') } : {}),
                    body: JSON.stringify({ site_id: id }),
                    credentials: 'same-origin',
                });
            }, { id: SITE.id });

            await page.goto(BASE_URL + '/settings', { waitUntil: 'domcontentloaded' });
            await page.waitForSelector('#stg-latitude', { state: 'visible', timeout: 30000 });
            storedBefore = await page.evaluate(() => ({
                lat: document.getElementById('stg-latitude').value,
                lon: document.getElementById('stg-longitude').value,
            }));
            process.stdout.write('[gh404] ' + SITE.name + ' coordinates as rendered: '
                + JSON.stringify(storedBefore) + '\n');
        }, 180000);

        afterAll(async () => {
            if (page && previousActiveSiteId) {
                await page.evaluate(async ({ id }) => {
                    const t = document.querySelector('meta[name=csrf-token]');
                    await fetch('/api/active-site', {
                        method: 'PATCH',
                        headers: Object.assign({ 'Content-Type': 'application/json', Accept: 'application/json' },
                            t ? { 'X-CSRF-TOKEN': t.getAttribute('content') } : {}),
                        body: JSON.stringify({ site_id: id }),
                        credentials: 'same-origin',
                    });
                }, { id: previousActiveSiteId });
            }
            if (browser) await browser.close();
        }, 120000);

        test('the site actually has coordinates to begin with, or this test proves nothing', () => {
            expect(storedBefore.lat).not.toBe('');
            expect(storedBefore.lon).not.toBe('');
        });

        test('clearing the coordinates by hand blocks the save, and nothing is sent', async () => {
            const patches = [];
            const onRequest = (req) => {
                if (req.method() === 'PATCH' && /\/api\/sites\//.test(req.url())) patches.push(req.url());
            };
            page.on('request', onRequest);

            // Clear them the way a user would, so the input events the page
            // listens for actually fire.
            for (const id of ['stg-latitude', 'stg-longitude']) {
                await page.click('#' + id, { clickCount: 3 });
                await page.keyboard.press('Backspace');
            }
            const cleared = await page.evaluate(() => ({
                lat: document.getElementById('stg-latitude').value,
                lon: document.getElementById('stg-longitude').value,
            }));
            expect(cleared).toEqual({ lat: '', lon: '' });

            await page.click('#stg-site-form button[type=submit]');
            await page.waitForTimeout(2000);

            const message = await page.evaluate(() => {
                const el = document.querySelector('#stg-site-msg');
                return el ? { text: (el.textContent || '').trim(), cls: el.className } : null;
            });
            process.stdout.write('[gh404] message after submit: ' + JSON.stringify(message) + '\n');
            process.stdout.write('[gh404] PATCH /api/sites requests observed: ' + patches.length + '\n');

            page.off('request', onRequest);

            expect(message).not.toBeNull();
            expect(message.text).toMatch(/coordinates|Location/i);
            expect(patches).toHaveLength(0);
        }, 180000);

        test('the stored coordinates are untouched afterwards', async () => {
            const stored = await page.evaluate(async ({ id }) => {
                const r = await fetch('/api/sites/' + id, {
                    headers: { Accept: 'application/json' }, credentials: 'same-origin',
                });
                const j = await r.json();
                const d = j.data || j;
                return { lat: String(d.latitude ?? ''), lon: String(d.longitude ?? '') };
            }, { id: SITE.id });
            process.stdout.write('[gh404] stored on the server after the blocked save: '
                + JSON.stringify(stored) + '\n');
            expect(parseFloat(stored.lat)).toBeCloseTo(parseFloat(storedBefore.lat), 4);
            expect(parseFloat(stored.lon)).toBeCloseTo(parseFloat(storedBefore.lon), 4);
        }, 180000);
    });
}

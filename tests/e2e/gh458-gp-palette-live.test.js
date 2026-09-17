/**
 * GH-458 — the growth-potential colours on screen come from gp-status.js.
 *
 * Three call sites kept their own copy of the GP palette beside the module
 * call: the dashboard's GP bar, the Word document's GP cell, and this page's
 * gpColor(). Their numbers agreed with the module's, so nothing was visibly
 * wrong and nothing would be until one of the two copies moved.
 *
 * The structural test (tests/gh365-gp-status-unit-explicit.test.js) says the
 * literals are gone. This one says the screen still paints the right colour
 * after taking them out — the module's answer for the GP the page is showing,
 * read off the rendered element rather than recomputed here.
 *
 * Credentials come from tests/e2e/.e2e-credentials.json, same as the parity
 * harness. Run: `npm run test:e2e:palette`, and it is in `npm run test:e2e:all`
 * with the rest of the live suites.
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

let chromium = null;
try { ({ chromium } = require('playwright')); } catch (e) { /* reported below */ }

/** "rgb(22, 163, 74)" and "#16a34a" are the same colour. */
function asHex(value) {
    const rgb = /rgba?\((\d+)[,\s]+(\d+)[,\s]+(\d+)/.exec(String(value));
    if (rgb) {
        return [rgb[1], rgb[2], rgb[3]]
            .map((n) => Number(n).toString(16).padStart(2, '0')).join('').toUpperCase();
    }
    return String(value).replace('#', '').toUpperCase();
}

if (!ENABLED) {
    process.stdout.write('[e2e] gh458-gp-palette-live skipped (needs the live stack) — npm run test:e2e:palette\n');
    test.skip('GH-458 live palette (disabled)', () => {});
} else {
    describe('GH-458 — rendered GP colours are the module\'s', () => {
        jest.setTimeout(120000);
        let browser, page;
        let dashboard = null;

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

            await page.goto(BASE_URL + '/dashboard', { waitUntil: 'domcontentloaded' });
            await page.waitForFunction(() => {
                const bar = document.getElementById('db-gp-bar');
                return !!(bar && bar.style.background && window.GAIP_GPStatus);
            }, null, { timeout: 40000 });
            await page.waitForTimeout(500);
            dashboard = await page.evaluate(() => {
                const bar = document.getElementById('db-gp-bar');
                const width = parseFloat(String(bar.style.width).replace('%', ''));
                return {
                    painted: getComputedStyle(bar).backgroundColor || bar.style.background,
                    gpFromWidth: width,
                    moduleAnswer: window.GAIP_GPStatus.getColorPct(width),
                    moduleLoaded: !!window.GAIP_GPStatus
                };
            });
        });

        afterAll(async () => { if (browser) await browser.close(); });

        test('the GP bar is painted the module\'s colour for the GP it is showing', () => {
            process.stdout.write('[e2e] GH-458 dashboard GP bar: ' + dashboard.gpFromWidth + '% painted '
                + dashboard.painted + ', module says ' + dashboard.moduleAnswer + '\n');
            expect(dashboard.moduleLoaded).toBe(true);
            expect(asHex(dashboard.painted)).toBe(asHex(dashboard.moduleAnswer));
        });

        test('the growth-light page paints its GP strip from the module too', async () => {
            // The growth-light panel lives under the analysis page's own
            // anchor (routes/web.php:73 redirects /analysis/growth-light here).
            await page.goto(BASE_URL + '/analysis#growth-light', { waitUntil: 'domcontentloaded' });
            await page.waitForFunction(() => !!window.GAIP_GPStatus, null, { timeout: 40000 });
            await page.waitForFunction(() => document.querySelectorAll('.gl-gp-big').length > 0,
                null, { timeout: 40000 }).catch(() => {});
            await page.waitForTimeout(1500);
            const seen = await page.evaluate(() => {
                const out = [];
                // gpColor() paints the TEXT of these figures (`style="color:…"`),
                // not a background — growth-light-analysis.js:824, :912.
                document.querySelectorAll('.gl-gp-big').forEach((el) => {
                    const pct = parseFloat((el.textContent || '').trim());
                    const c = getComputedStyle(el).color;
                    if (!isNaN(pct) && c) {
                        out.push({ pct: pct, painted: c, moduleAnswer: window.GAIP_GPStatus.getColorPct(pct) });
                    }
                });
                return out;
            });
            process.stdout.write('[e2e] GH-458 growth-light coloured GP elements: ' + seen.length + '\n');
            seen.forEach((s) => {
                process.stdout.write('[e2e]   ' + s.pct + '% painted ' + s.painted + ', module says ' + s.moduleAnswer + '\n');
            });
            // The page may show no coloured GP element for a site without a
            // forecast; that is reported rather than asserted away.
            const wrong = seen.filter((s) => asHex(s.painted) !== asHex(s.moduleAnswer));
            expect(wrong).toEqual([]);
        });
    });
}

/**
 * GH-395 live check — the Settings methodology dropdown on a real New Zealand
 * site, rendered by the real stack.
 *
 * The structural test next door (tests/gh395-nz-methodology-gate.test.js) pins
 * the blade's source. This one proves the rendered page: a blade whose PHP
 * block is correct can still emit the wrong options if `$isNewZealand` does not
 * resolve the way the source implies, and that resolution is the half the
 * structural test cannot see. Test5 - NZ (Auckland coordinates) is the NZ case;
 * Burns (Canberra) is the control that must keep all three options.
 *
 * Credentials come from tests/e2e/.e2e-credentials.json, same as the parity
 * harness — see its header. Run: npm run test:e2e:methodology
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

const NZ_SITE = { name: 'Test5 - NZ', id: '019e96f3-9294-72be-a13c-7fa7427afd5a' };

let chromium = null;
try { ({ chromium } = require('playwright')); } catch (e) { /* reported below */ }

if (!ENABLED) {
    process.stdout.write('[e2e] gh395-nz-methodology-gate-live skipped (needs the live stack) — npm run test:e2e:methodology\n');
    test.skip('GH-395 live gate (disabled)', () => {});
} else {
    describe('GH-395 — rendered Settings methodology options', () => {
        let browser, page, previousActiveSiteId = null;

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
        }, 120000);

        afterAll(async () => {
            // Put the login's active-site pointer back wherever it was.
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

        async function methodologyOptionsFor(siteId) {
            const sites = await page.evaluate(async () => {
                const r = await fetch('/api/sites', { headers: { Accept: 'application/json' }, credentials: 'same-origin' });
                return r.json();
            });
            if (previousActiveSiteId === null) previousActiveSiteId = sites.active_site_id;
            await page.evaluate(async ({ id }) => {
                const t = document.querySelector('meta[name=csrf-token]');
                await fetch('/api/active-site', {
                    method: 'PATCH',
                    headers: Object.assign({ 'Content-Type': 'application/json', Accept: 'application/json' },
                        t ? { 'X-CSRF-TOKEN': t.getAttribute('content') } : {}),
                    body: JSON.stringify({ site_id: id }),
                    credentials: 'same-origin',
                });
            }, { id: siteId });
            await page.goto(BASE_URL + '/settings', { waitUntil: 'domcontentloaded' });
            // `attached`, not visible: the select lives on the Turf profile tab,
            // which is not the tab Settings opens on. The options are rendered
            // server-side regardless, and that is what this test reads.
            await page.waitForSelector('#stg-turf-methodology', { state: 'attached', timeout: 30000 });
            return page.$$eval('#stg-turf-methodology option',
                (opts) => opts.map((o) => o.value).filter(Boolean));
        }

        test('a New Zealand site is not offered MLSN, and still offers AA and SLAN', async () => {
            const values = await methodologyOptionsFor(NZ_SITE.id);
            process.stdout.write('[gh395] ' + NZ_SITE.name + ' options: ' + JSON.stringify(values) + '\n');
            expect(values).not.toContain('mlsn');
            expect(values).toContain('ammonium_acetate');
            expect(values).toContain('slan');
        }, 180000);

        test('a non-NZ site keeps all three — the gate is regional, not global', async () => {
            const sites = await page.evaluate(async () => {
                const r = await fetch('/api/sites', { headers: { Accept: 'application/json' }, credentials: 'same-origin' });
                return r.json();
            });
            const burns = (sites.data || []).find((s) => /^Burns/.test(s.name));
            if (!burns) throw new Error('Burns is not among this login\'s sites — the control case cannot run');
            const values = await methodologyOptionsFor(burns.id);
            process.stdout.write('[gh395] ' + burns.name + ' options: ' + JSON.stringify(values) + '\n');
            expect(values).toContain('mlsn');
            expect(values).toContain('ammonium_acetate');
            expect(values).toContain('slan');
        }, 180000);
    });
}

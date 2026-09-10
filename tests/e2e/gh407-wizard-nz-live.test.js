/**
 * GH-407 live check — the setup wizard's methodology step, driven in a real
 * browser on a real page.
 *
 * The structural test next door pins the source. It cannot see whether the
 * filter actually runs: `isNewZealandLocation()` reads `this.data.location`,
 * which is populated by earlier wizard steps, and the buttons are built into a
 * grid that only exists once the step has rendered. This drives the real object
 * on the real page and reads back which buttons a user is offered.
 *
 * Three cases: NZ with nothing chosen, NZ with MLSN chosen earlier (the case the
 * user hit — coordinates set at step 1, MLSN still selectable at step 2), and an
 * Australian location where MLSN must survive untouched.
 *
 * Run: npm run test:e2e:wizard
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

const AUCKLAND = { lat: -36.8508827, lon: 174.7644881 };
const CANBERRA = { lat: -35.3042086, lon: 149.0898141 };

let chromium = null;
try { ({ chromium } = require('playwright')); } catch (e) { /* reported below */ }

if (!ENABLED) {
    process.stdout.write('[e2e] gh407-wizard-nz-live skipped (needs the live stack) \u2014 npm run test:e2e:wizard\n');
    test.skip('GH-407 live gate (disabled)', () => {});
} else {
    describe('GH-407 \u2014 methodology buttons the wizard actually offers', () => {
        let browser, page;

        beforeAll(async () => {
            if (!chromium) throw new Error('playwright does not resolve from the repo \u2014 run `npm install`');
            if (!EMAIL || !PASSWORD) throw new Error('no credentials \u2014 see tests/e2e/.e2e-credentials.example.json');
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
            // GH-407: the dashboard's own onboarding wizard (window.GilbaWizard,
            // onboarding-wizard.js) is the one a user meets. site-setup-wizard.js
            // is a second, older wizard with the same step, reachable only from
            // /hub and the report pages; both carry this fix and both are read
            // below. The first draft of this test drove only the old one and
            // reported green while the wizard the user was looking at still
            // offered MLSN.
            await page.goto(BASE_URL + '/dashboard', { waitUntil: 'domcontentloaded' });
            await page.waitForSelector('body', { timeout: 30000 });
            await page.waitForTimeout(3000);
        }, 180000);

        afterAll(async () => { if (browser) await browser.close(); }, 60000);

        async function offeredAt(loc, preset) {
            return page.evaluate(({ lat, lon, preset }) => {
                const out = {};

                // The dashboard's onboarding wizard — the one a user meets.
                const W = window.GilbaWizard;
                if (!W) { out.onboarding = { error: 'GilbaWizard is not on this page' }; }
                else {
                    W.d.location = { lat, lon, name: 'probe' };
                    W.d.turfType = 'golf';
                    W.d.subCategory = 'greens';
                    W.d.methodology = preset;
                    const host = document.createElement('div');
                    document.body.appendChild(host);
                    try { W._step3_Species(host); } catch (e) { out.onboardingError = e.message; }
                    const btns = Array.from(host.querySelectorAll('[data-method]'))
                        .map((el) => el.getAttribute('data-method'));
                    const note = host.querySelector('.wiz-method-note');
                    out.onboarding = {
                        offered: btns,
                        selected: W.d.methodology,
                        note: note ? (note.textContent || '').trim() : null
                    };
                    host.remove();
                }

                // The older wizard on /hub and the report pages, if present.
                const S = window.GaipSetupWizard;
                if (S) {
                    if (typeof S.show === 'function') S.show();
                    S.data.location = { lat, lon, name: 'probe' };
                    S.data.turfType = 'golf';
                    S.data.subCategory = 'greens';
                    S.data.species = S.data.species || 'Creeping Bentgrass';
                    S.data.methodology = preset;
                    if (typeof S.renderStep === 'function') { S.currentStep = 3; try { S.renderStep(); } catch (e) {} }
                    if (typeof S.renderMethodologyButtons === 'function') S.renderMethodologyButtons();
                    const grid = document.getElementById('gaip-wizard-method-grid');
                    out.legacy = grid
                        ? Array.from(grid.children).map((el) => (el.textContent || '').trim().split('\n')[0].trim())
                        : null;
                }
                return out;
            }, { lat: loc.lat, lon: loc.lon, preset });
        }

        test('a New Zealand location is not offered MLSN', async () => {
            const r = await offeredAt(AUCKLAND, null);
            process.stdout.write('[gh407] NZ, nothing chosen: ' + JSON.stringify(r) + '\n');
            expect(r.onboarding.error).toBeUndefined();
            expect(r.onboarding.offered).toEqual(['slan', 'ammonium_acetate']);
            expect(r.onboarding.selected).toBe('ammonium_acetate');
        }, 180000);

        test('MLSN chosen before the location was NZ is normalised, and the user is told', async () => {
            const r = await offeredAt(AUCKLAND, 'mlsn');
            process.stdout.write('[gh407] NZ, MLSN preset: ' + JSON.stringify(r) + '\n');
            expect(r.onboarding.offered).not.toContain('mlsn');
            expect(r.onboarding.selected).toBe('ammonium_acetate');
            expect(r.onboarding.note || '').toMatch(/not offered for New Zealand/);
        }, 180000);

        test('an Australian location keeps MLSN exactly as before', async () => {
            const r = await offeredAt(CANBERRA, 'mlsn');
            process.stdout.write('[gh407] AU, MLSN preset: ' + JSON.stringify(r) + '\n');
            expect(r.onboarding.offered).toContain('mlsn');
            expect(r.onboarding.selected).toBe('mlsn');
        }, 180000);
    });
}

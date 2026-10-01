/**
 * GH-797 (queue item 3ashch) live check — THE SIGN OF DELIVERY ON SCREEN, in a real browser.
 *
 * The plan's sign of delivery is four screens. The structural cases next door
 * (`app/tests/Feature/Gh797TheTextureIsHeldByTheSiteRowTest.php`,
 * `tests/gh797-the-wizard-asks-for-the-texture-and-the-import-keeps-it.test.js`) hold the server's
 * refusal, the lock's answer and what the browser sends. They cannot see the half this file reads:
 * whether the rendered page actually redirects, whether the step the user is looking at carries the
 * field, and whether the words of the refusal reach the screen.
 *
 * WHICH SITE, and this is a named boundary of the delivery rather than a detail. The two sites the
 * plan named for these screens carry a client's live data and were ruled out by the coordinator; the
 * 67 scratch sites offered instead are all soft-deleted (`deleted_at IS NOT NULL`, measured: 67 of
 * 67), so no page opens for one. So this file MAKES ITS OWN SITE through the product's own route,
 * walks the screens on it, and removes it again — the remedy of first resort of GH-519, declared for
 * this file in `tests/gh532-no-live-test-without-stand-protection.test.js`. No site that belongs to
 * anybody is touched: the site is created in `beforeAll` and deleted in `afterAll`, and the account's
 * active site is put back where it was.
 *
 * Run: GILBA_E2E=1 npx jest tests/e2e/gh797-the-texture-is-required-live.test.js --runInBand
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

const TEXTURE = 'sites.soil_texture_override';
const CHOSEN = 'sand';
const CHOSEN_LABEL = 'Sand / Sand rootzone';

let chromium = null;
try { ({ chromium } = require('playwright')); } catch (e) { /* reported below */ }

if (!ENABLED) {
    process.stdout.write('[e2e] gh797-the-texture-is-required-live skipped (needs the live stack)\n');
    test.skip('GH-797 live sign of delivery (disabled)', () => {});
} else {
    describe('GH-797 — a site with no soil texture is held, and the field is where a site is made', () => {
        let browser, page, previousActiveSiteId = null, siteId = null;

        /** Through the page, so the request carries the session and the token the product uses. */
        const api = (method, path, body) => page.evaluate(async ({ method, path, body }) => {
            const t = document.querySelector('meta[name=csrf-token]');
            const r = await fetch(path, {
                method,
                headers: Object.assign({ Accept: 'application/json' },
                    body ? { 'Content-Type': 'application/json' } : {},
                    t ? { 'X-CSRF-TOKEN': t.getAttribute('content') } : {}),
                body: body ? JSON.stringify(body) : undefined,
                credentials: 'same-origin',
            });

            return { status: r.status, body: await r.json().catch(() => null) };
        }, { method, path, body: body || null });

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
            await page.waitForTimeout(1500);
            if (/\/login/.test(page.url())) throw new Error('login refused for ' + EMAIL);

            const sites = await api('GET', '/api/sites');
            previousActiveSiteId = sites.body && sites.body.active_site_id;

            const made = await api('POST', '/api/sites', {
                name: 'GH-797 live check ' + Date.now(),
                location_name: 'Auckland, New Zealand',
                latitude: -36.8508827,
                longitude: 174.7644881,
                site_type: 'sports',
            });
            siteId = made.body && made.body.data && made.body.data.id;
            if (!siteId) throw new Error('could not make a site for this check: ' + JSON.stringify(made));
            await api('PATCH', '/api/active-site', { site_id: siteId });
            process.stdout.write('[gh797-live] made the site ' + siteId
                + ', previous active site ' + previousActiveSiteId + '\n');
        }, 240000);

        afterAll(async () => {
            if (page && siteId) {
                if (previousActiveSiteId) await api('PATCH', '/api/active-site', { site_id: previousActiveSiteId });
                const gone = await api('DELETE', '/api/sites/' + siteId);
                process.stdout.write('[gh797-live] removed the site: ' + gone.status + '\n');
            }
            if (browser) await browser.close();
        }, 180000);

        test('SIGN 1 — a site with no texture gets no Settings: every page goes to the wizard', async () => {
            const seen = {};
            for (const where of ['/settings', '/analysis', '/reports/export', '/plan']) {
                await page.goto(BASE_URL + where, { waitUntil: 'domcontentloaded' });
                seen[where] = page.url().replace(BASE_URL, '');
            }
            process.stdout.write('[gh797-live] where each page landed: ' + JSON.stringify(seen) + '\n');

            /**
             * `/dashboard`, with or without `?setup=1`: the server redirects WITH the parameter and the
             * wizard then cleans it out of the address, so a reload does not carry it around
             * (`onboarding-wizard.js`, `init`). Measured here: all four land on `/dashboard`.
             */
            Object.entries(seen).forEach(([asked, landed]) => {
                expect(landed).toMatch(/^\/dashboard(\?setup=1)?$/);
                expect(landed).not.toBe(asked);
            });
        }, 240000);

        test('SIGN 1 — the server names the texture as the thing it is missing', async () => {
            await page.goto(BASE_URL + '/dashboard', { waitUntil: 'domcontentloaded' });
            await page.waitForTimeout(2500);
            const setup = await page.evaluate(() => {
                const cfg = window.GAIP_HUB_CONFIG || {};
                const s = cfg.setup || {};

                return {
                    missing: s.missing,
                    step3: (s.byStepByTurfType && s.byStepByTurfType.sports && s.byStepByTurfType.sports[3]) || null,
                    textures: (s.soilTextureValues || []).map((v) => v.id),
                    label: (s.labels || {})['sites.soil_texture_override'],
                };
            });
            process.stdout.write('[gh797-live] the page was told: ' + JSON.stringify(setup) + '\n');

            expect(setup.missing).toContain(TEXTURE);
            expect(setup.step3).toContain(TEXTURE);
            expect(setup.textures).toEqual(['sand', 'loamy_sand', 'sandy_loam', 'loam', 'clay_loam', 'clay']);
            expect(setup.label).toBe('the soil texture');
        }, 240000);

        test('SIGN 4 — step 3 of the wizard carries the field, and will not pass while it is empty', async () => {
            const walked = await page.evaluate(({ chosen }) => {
                const W = window.GilbaWizard;
                if (!W) return { error: 'GilbaWizard is not on this page' };

                W.d.location = { lat: -36.8508827, lon: 174.7644881, name: 'Auckland, New Zealand' };
                W.d.turfType = 'sports';
                W.d.species = 'Perennial Ryegrass';
                W.d.variety = 'generic';
                W.d.construction = 'sand_profile';
                W.d.methodology = 'ammonium_acetate';
                W.d.matchesPerWeek = 0;
                W.d.sessionsPerWeek = 0;
                W.d.soilTexture = null;

                const host = document.createElement('div');
                document.body.appendChild(host);
                const out = {};
                try { W._step3_Species(host); } catch (e) { out.renderError = e.message; }
                const select = host.querySelector('#wiz-soil-texture');
                out.fieldIsThere = !!select;
                out.boundTo = select ? select.getAttribute('data-input') : null;
                out.offers = select ? Array.from(select.options).map((o) => o.value) : [];
                out.labels = select ? Array.from(select.options).map((o) => o.textContent.trim()) : [];
                out.opensEmpty = select ? select.value : null;

                W.step = 3;
                out.withoutIt = { canProceed: W._canProceed(), names: W._missingOfStep(3) };
                W.d.soilTexture = chosen;
                out.withIt = { canProceed: W._canProceed(), names: W._missingOfStep(3) };
                host.remove();

                return out;
            }, { chosen: CHOSEN });
            process.stdout.write('[gh797-live] step 3 as it renders: ' + JSON.stringify(walked) + '\n');

            expect(walked.error).toBeUndefined();
            expect(walked.fieldIsThere).toBe(true);
            expect(walked.boundTo).toBe(TEXTURE);
            expect(walked.offers).toEqual(['', 'sand', 'loamy_sand', 'sandy_loam', 'loam', 'clay_loam', 'clay']);
            expect(walked.labels).toContain(CHOSEN_LABEL);
            expect(walked.opensEmpty).toBe('');
            expect(walked.withoutIt.canProceed).toBe(false);
            expect(walked.withoutIt.names).toContain(TEXTURE);
            expect(walked.withIt.canProceed).toBe(true);
        }, 240000);

        test('SIGN 1 and 2 — after the wizard saves the texture, the pages open and Settings shows it as Required', async () => {
            const saved = await page.evaluate(async ({ chosen }) => {
                const W = window.GilbaWizard;
                W.d.soilTexture = chosen;
                try { await W._save(); } catch (e) { return { error: e.message }; }

                return { ok: true };
            }, { chosen: CHOSEN });
            expect(saved.error).toBeUndefined();
            await page.waitForTimeout(1500);

            const row = await api('GET', '/api/sites/' + siteId);
            process.stdout.write('[gh797-live] the column after the wizard: '
                + JSON.stringify(row.body && row.body.data && row.body.data.soil_texture_override) + '\n');
            expect(row.body.data.soil_texture_override).toBe(CHOSEN);

            await page.goto(BASE_URL + '/settings', { waitUntil: 'domcontentloaded' });
            // The field lives on the Turf profile tab, which is not the one Settings opens on.
            await page.click('.stg-tab[data-tab=turf]');
            await page.waitForSelector('#stg-turf-soil-texture', { state: 'visible', timeout: 30000 });
            const field = await page.evaluate(() => {
                const sel = document.getElementById('stg-turf-soil-texture');
                const label = document.querySelector('label[for="stg-turf-soil-texture"]');
                const note = label && label.nextElementSibling;

                return {
                    landed: window.location.pathname,
                    value: sel.value,
                    options: Array.from(sel.options).map((o) => o.value),
                    chosenLabel: sel.options[sel.selectedIndex].textContent.trim(),
                    boundTo: sel.getAttribute('data-input'),
                    requiredNote: note && note.className === 'gilba-required-note' ? note.textContent.trim() : null,
                };
            });
            process.stdout.write('[gh797-live] the Settings field: ' + JSON.stringify(field) + '\n');

            expect(field.landed).toBe('/settings');
            expect(field.value).toBe(CHOSEN);
            expect(field.chosenLabel).toBe(CHOSEN_LABEL);
            expect(field.boundTo).toBe(TEXTURE);
            expect(field.requiredNote).toBe('Required');
            expect(field.options).toEqual(['', 'sand', 'loamy_sand', 'sandy_loam', 'loam', 'clay_loam', 'clay']);
        }, 240000);

        test('SIGN 3 — emptying it in Settings is refused by name, and nothing on the tab is saved', async () => {
            const before = await api('GET', '/api/sites/' + siteId);
            const speciesBefore = before.body.data.configs.gaip.config.turf.species;

            // The way a person does it: open the tab, choose "— select —", change something else too,
            // press Save.
            await page.click('.stg-tab[data-tab=turf]');
            await page.waitForSelector('#stg-turf-soil-texture', { state: 'visible', timeout: 30000 });
            await page.selectOption('#stg-turf-soil-texture', '');
            const otherField = await page.evaluate(() => {
                const sel = document.getElementById('stg-turf-species');
                const other = Array.from(sel.options).map((o) => o.value)
                    .filter((v) => v && v !== sel.value)[0];
                if (other) sel.value = other;

                return { from: sel.getAttribute('data-saved-species'), to: sel.value };
            });
            await page.click('#stg-turf-form button[type=submit]');
            await page.waitForTimeout(2500);

            const shown = await page.evaluate(() => {
                const box = document.getElementById('stg-turf-msg');
                const sel = document.getElementById('stg-turf-soil-texture');

                /**
                 * How the shared marker shows a field (`GilbaRequiredFields.mark`, `dashboard-ui.js`):
                 * a red outline on the control itself, and the `Required` note beside the label turned
                 * red rather than doubled. Read as the marker writes it, not by a class name.
                 */
                const label = document.querySelector('label[for="stg-turf-soil-texture"]');
                const note = label && label.nextElementSibling;

                return {
                    message: box ? (box.textContent || '').trim() : null,
                    fieldOutline: sel ? sel.style.outline : null,
                    noteClass: note ? note.className : null,
                    noteColour: note ? note.style.color : null,
                };
            });
            const after = await api('GET', '/api/sites/' + siteId);
            process.stdout.write('[gh797-live] the refusal on screen: ' + JSON.stringify(shown)
                + '\n[gh797-live] the species the tab also carried: ' + JSON.stringify(otherField)
                + '\n[gh797-live] the column after the refusal: '
                + JSON.stringify(after.body.data.soil_texture_override)
                + ' | the species in the config: '
                + JSON.stringify(after.body.data.configs.gaip.config.turf.species) + '\n');

            expect(shown.message).toContain('fill in the soil texture');
            // And the page points AT the field, which is the rest of the plan's sign 3.
            expect(shown.fieldOutline).toMatch(/rgb\(220, 38, 38\)|#dc2626/);
            expect(shown.noteClass).toBe('gilba-required-note');
            expect(shown.noteColour).toMatch(/rgb\(220, 38, 38\)|#dc2626/);
            // The column kept its value, and the OTHER field of the same tab was not saved either:
            // the column goes first and the config was never written.
            expect(after.body.data.soil_texture_override).toBe(CHOSEN);
            expect(after.body.data.configs.gaip.config.turf.species).toBe(speciesBefore);
        }, 240000);
    });
}

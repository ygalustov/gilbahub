/**
 * GH-807 (queue item 3vya) live check — AFTER A REAL RUN, THE STORED ROW CARRIES "Primo MAXX".
 *
 * WHAT IT PROVES, and it is the one thing the offline cases cannot: the name travels the whole chain —
 * the journal's word, the code the server answers with, the module's record, the row the run stores, the
 * dashboard's own text. The offline cases hold each link; this holds them joined.
 *
 * WHICH SITE, and this is the coordinator's refusal of 02.10.2026 rather than a preference. The owner's
 * own site holds the application the owner complained about, and it is on the protected list: a run
 * writes an analysis row, which is a change to her data. So the state is built on a site of ours, with
 * the same application typed the same way, and removed again. WHAT THAT LEAVES UNPROVEN is written in
 * the delivery: the six stored rows of her site keep the old name until she runs her own site again.
 *
 * Run: GILBA_E2E=1 npx jest tests/e2e/gh807-the-stored-name-after-a-run-live.test.js --runInBand
 *      GILBA_E2E=1 GH807_REMOVE=<site id> npx jest … (takes the site away again)
 */

'use strict';

const fs = require('fs');
const path = require('path');

const ENABLED = process.env.GILBA_E2E === '1';
const REMOVE = process.env.GH807_REMOVE || '';

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

if (!ENABLED) {
    process.stdout.write('[e2e] gh807-the-stored-name-after-a-run skipped (needs the live stack)\n');
    test.skip('GH-807 live sign of delivery (disabled)', () => {});
} else {
    describe('GH-807 — the name a real run stores', () => {
        let browser, page, previousActiveSiteId = null, siteId = null;

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
        }, 300000);

        afterAll(async () => {
            if (page && siteId && !REMOVE) {
                // Samples, then zones, then the site -- the order part 1 of the zones work requires.
                const list = await api('GET', '/api/samples?site_id=' + siteId + '&limit=2000');
                for (const row of ((list.body && list.body.data) || [])) {
                    await api('DELETE', '/api/samples/' + row.id);
                }
                /**
                 * AND THE JOURNAL ENTRY, which the first green run left behind: `spray_logs` is a table
                 * the reviewer counts whole (five rows on the stand), so an entry of ours sitting in it
                 * is a number somebody else has to explain. The route of the product deletes it.
                 */
                const journal = await api('GET', '/api/spray-log?site_id=' + siteId);
                const sprayGone = [];
                for (const entry of ((journal.body && journal.body.entries) || [])) {
                    sprayGone.push((await api('DELETE', '/api/spray-log/' + entry.log_id)).status);
                }
                process.stdout.write('[gh807-live] journal entries removed: '
                    + JSON.stringify(sprayGone) + '\n');
                expect(sprayGone.filter((s) => s !== 200)).toEqual([]);
                const zones = ((await api('GET', '/api/sites/' + siteId)).body.data.zones || []).map((z) => z.id);
                const zonesGone = zones.length
                    ? await api('PATCH', '/api/sites/' + siteId + '/zones', { deleted: zones })
                    : { status: 200 };
                if (previousActiveSiteId) await api('PATCH', '/api/active-site', { site_id: previousActiveSiteId });
                const gone = await api('DELETE', '/api/sites/' + siteId);
                process.stdout.write('[gh807-live] cleaned up: ' + ((list.body && list.body.data) || []).length
                    + ' samples, ' + zones.length + ' zones -> ' + zonesGone.status
                    + ', site -> ' + gone.status + '\n');
                expect(zonesGone.status).toBe(200);
                expect(gone.status).toBe(200);
            }
            if (browser) await browser.close();
        }, 300000);

        test(REMOVE ? 'takes a site away again' : 'a run on our own site stores "Primo MAXX"', async () => {
            if (REMOVE) {
                const gone = await api('DELETE', '/api/sites/' + REMOVE);
                process.stdout.write('[gh807-live] removed ' + REMOVE + ' -> ' + gone.status + '\n');
                expect(gone.status).toBe(200);

                return;
            }

            const made = await api('POST', '/api/sites', {
                name: 'GH-807 pgr name ' + Date.now(),
                location_name: 'Auckland, New Zealand',
                latitude: -36.8508827, longitude: 174.7644881, site_type: 'golf',
            });
            siteId = made.body && made.body.data && made.body.data.id;
            if (!siteId) throw new Error('could not make a site: ' + JSON.stringify(made));
            await api('PATCH', '/api/active-site', { site_id: siteId });

            // The wizard's own save, so the pages of this site open (the setup lock, GH-797/GH-804).
            await page.goto(BASE_URL + '/dashboard', { waitUntil: 'domcontentloaded' });
            await page.waitForTimeout(2500);
            const setup = await page.evaluate(async () => {
                const W = window.GilbaWizard;
                if (!W) return { error: 'GilbaWizard is not on this page' };
                W.d.location = { lat: -36.8508827, lon: 174.7644881, name: 'Auckland, New Zealand' };
                W.d.turfType = 'golf';
                W.d.golfSurface = 'greens';
                W.d.subCategory = 'greens';
                W.d.species = 'Creeping Bentgrass (Greens)';
                W.d.variety = 'generic';
                W.d.construction = 'sand_profile';
                W.d.methodology = 'ammonium_acetate';
                W.d.soilTexture = 'sand';
                try { await W._save(); } catch (e) { return { error: e.message }; }

                return { ok: true };
            });
            if (setup.error) throw new Error('could not set the site up: ' + setup.error);
            await page.waitForTimeout(1500);

            // A soil sample, so there is something to compute, and the application the owner reported —
            // typed exactly as she typed it.
            await api('POST', '/api/samples', { site_id: siteId, sample_type: 'soil',
                lab_date: '2026-09-01',
                payload: { _label: 'Green 1', P: 40, K: 120, Ca: 900, Mg: 130, S: 11, pH: 6.2, CEC: 12 } });
            const spray = await api('POST', '/api/spray-log', {
                site_id: siteId,
                application_date: new Date(Date.now() - 20 * 86400000).toISOString().split('T')[0],
                product_name: 'Primo Maxx 120', product_category: 'pgr',
                active_ingredient: 'trinexapac-ethyl', rate: 0.4, rate_unit: 'L/ha',
                target: 'growth', notes: null, zones: ['greens'],
            });
            const context = await api('GET', '/api/spray-log/context?site_id=' + siteId);
            process.stdout.write('[gh807-live] the application: ' + spray.status
                + ', and the code the server answers: '
                + JSON.stringify(context.body && context.body.lastPGR && context.body.lastPGR.product_key) + '\n');
            expect(spray.status).toBe(201);
            expect(context.body.lastPGR.product_key).toBe('PRIMO_MAXX');

            // THE RUN, by the product's own button: it opens the hidden runner, which computes and
            // stores the row.
            await page.goto(BASE_URL + '/dashboard', { waitUntil: 'domcontentloaded' });
            await page.waitForTimeout(3000);
            /**
             * THE POINTER IS SETTLED BEFORE THE PRESS, and that is not care but a measured requirement:
             * the first attempt stored a row with `outcome: failed, reason: site-mismatch` — the runner
             * is told which site it is for (GH-547) and refuses to write when the server's active site
             * has moved under it. So the page's own idea of the active site is checked against the site
             * this case made, and the pointer is set again if they differ.
             */
            let active = await page.evaluate(
                () => (window.GAIP_HUB_CONFIG && window.GAIP_HUB_CONFIG.activeSiteId) || null);
            if (active !== siteId) {
                await api('PATCH', '/api/active-site', { site_id: siteId });
                await page.goto(BASE_URL + '/dashboard', { waitUntil: 'domcontentloaded' });
                await page.waitForTimeout(3000);
                active = await page.evaluate(
                    () => (window.GAIP_HUB_CONFIG && window.GAIP_HUB_CONFIG.activeSiteId) || null);
            }
            process.stdout.write('[gh807-live] the page says its active site is '
                + JSON.stringify(active) + ', and this case made ' + JSON.stringify(siteId) + '\n');
            expect(active).toBe(siteId);

            const pressed = await page.evaluate(() => {
                const btn = document.getElementById('db-rerun-btn');
                if (!btn) return false;
                btn.click();

                return true;
            });
            expect(pressed).toBe(true);
            // The runner is a page of its own in a frame; it needs real time.
            await page.waitForTimeout(90000);

            // What the dashboard says about the PGR after the run, read as the page prints it.
            await page.goto(BASE_URL + '/dashboard', { waitUntil: 'domcontentloaded' });
            await page.waitForTimeout(6000);
            const onScreen = await page.evaluate(() => {
                const text = document.body.innerText || '';
                const pgr = (window.GAIP_DASHBOARD_DATA && window.GAIP_DASHBOARD_DATA.computed
                    && window.GAIP_DASHBOARD_DATA.computed.pgr) || null;

                return {
                    storedName: pgr && pgr.product ? (pgr.product.name || pgr.product) : null,
                    storedCode: pgr && pgr.product ? pgr.product.code : null,
                    gdd: pgr && pgr.gdd ? pgr.gdd.accumulated : null,
                    threshold: pgr && pgr.gdd ? pgr.gdd.threshold : null,
                    saysPrimoMaxx: text.includes('Primo MAXX'),
                    saysIndigoAmigo: text.includes('Indigo Amigo'),
                    saysTheCode: text.includes('PRIMO_MAXX'),
                };
            });
            process.stdout.write('[gh807-live] what the stored row and the screen say: '
                + JSON.stringify(onScreen) + '\n');

            // THE EXACT STRING, and not the code: the stored row carries the name of the product itself.
            expect(onScreen.storedName).toBe('Primo MAXX');
            /**
             * THE CODE IS NOT IN THE STORED ROW, measured here on the first green run: the row carries
             * `pgr.product.name` and no `code` (null). That the code is `PRIMO_MAXX` is held by the
             * offline case over the module's own answer; what this live case is about is the NAME, which
             * is what a person reads. Said rather than asserted, so the claim stays the size of the fact.
             */
            expect(onScreen.storedCode).toBeFalsy();
            expect(onScreen.saysPrimoMaxx).toBe(true);
            expect(onScreen.saysIndigoAmigo).toBe(false);
            // "PRIMO_MAXX" printed where a name belongs is the code, and is not this repair.
            expect(onScreen.saysTheCode).toBe(false);
        }, 600000);
    });
}

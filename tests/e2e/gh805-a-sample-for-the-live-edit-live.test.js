/**
 * GH-805 (queue item "Zones", part 2) — THE SITE AND THE SAMPLES THE COORDINATOR'S LIVE EDIT NEEDS.
 *
 * WHY THIS FILE EXISTS AND WHY IT IS NOT A SCRATCH SCRIPT. The live half of part 2 is one save made by
 * hand in the Edit window, and it needs a sample that carries the five keys the window has no field for
 * (`pH_Water`, `CEC_meq100g`, `EC1_5`, `OM_Percent`, `pH_CaCl2`) and a water sample with `PO4` and no
 * `P`. Measured on the stand: the only two sites that hold such samples are both held by the setup lock
 * for want of a soil texture, so no page of theirs opens — and giving one a texture would be a change to
 * a stand site's data, which is the owner's to decide. (Those two are not named here on purpose: a live
 * file that names a stand site is declared in the inventory of
 * `gh703-live-tests-name-stand-sites-only-where-listed`, and this one uses none.) So the state is built
 * on a site of our own, through the product's own routes, and removed again.
 *
 * TWO RUNS, BY DESIGN:
 *   `GILBA_E2E=1 npx jest tests/e2e/gh805-a-sample-for-the-live-edit-live.test.js --runInBand`
 *       makes the site, passes its wizard, saves the samples and PRINTS what to open. It leaves the
 *       site standing on purpose: the coordinator's window comes between the two runs.
 *   `GILBA_E2E=1 GH805_REMOVE=<site id> npx jest …`
 *       takes it away again — samples, then zones, then the site, which is the order part 1 requires.
 */

'use strict';

const fs = require('fs');
const path = require('path');

const ENABLED = process.env.GILBA_E2E === '1';
const REMOVE = process.env.GH805_REMOVE || '';
/**
 * GH-805: the third mode, and it exists because the first run left the site one input short. The
 * wizard was handed `golfSurface`, and the input the list declares for a golf site is
 * `turf.subCategory` -- so the setup lock still held every page of the site and `/data` redirected.
 * This mode writes that one field THROUGH THE PRODUCT'S OWN ROAD, the config route the Settings Turf
 * tab saves with, rather than into the database: a site brought to a state the interface cannot reach
 * would prove a repair on a state no client can be in.
 */
const FINISH_SETUP = process.env.GH805_FINISH_SETUP || '';

let credentials = {};
try {
    credentials = JSON.parse(fs.readFileSync(
        process.env.GILBA_E2E_CREDENTIALS || path.join(__dirname, '.e2e-credentials.json'), 'utf8'));
} catch (e) { credentials = {}; }

const BASE_URL = process.env.GILBA_E2E_URL || credentials.url || 'http://127.0.0.1:8080';
const EMAIL = process.env.GILBA_E2E_EMAIL || credentials.email;
const PASSWORD = process.env.GILBA_E2E_PASSWORD || credentials.password;

/** The five the Edit window cannot see, and the readings it can. */
const SOIL = {
    _label: 'Green 2', P: 40, K: 27.74, Ca: 900, Mg: 130, S: 11,
    pH_Water: 5.97, CEC_meq100g: 2.16, EC1_5: 0.093, OM_Percent: 1.59, pH_CaCl2: 5.4,
};
const WATER = { _label: 'Bore 1', _zone: 'bore', EC: 0.42, PO4: 0.07, pH: 7.1 };

let chromium = null;
try { ({ chromium } = require('playwright')); } catch (e) { /* reported below */ }

if (!ENABLED) {
    process.stdout.write('[e2e] gh805-a-sample-for-the-live-edit skipped (needs the live stack)\n');
    test.skip('GH-805 live edit fixture (disabled)', () => {});
} else {
    describe('GH-805 — the state the live edit needs', () => {
        let browser, page, previousActiveSiteId = null;

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

        afterAll(async () => { if (browser) await browser.close(); }, 120000);

        const makeIt = async () => {
            const made = await api('POST', '/api/sites', {
                name: 'GH-805 live edit ' + Date.now(),
                location_name: 'Auckland, New Zealand',
                latitude: -36.8508827, longitude: 174.7644881, site_type: 'golf',
            });
            const siteId = made.body && made.body.data && made.body.data.id;
            if (!siteId) throw new Error('could not make a site: ' + JSON.stringify(made));
            await api('PATCH', '/api/active-site', { site_id: siteId });

            // The wizard's own save, so the setup lock lets the pages of this site open. Without it
            // `/data` redirects, which is exactly what holds the stand's two sites shut.
            await page.goto(BASE_URL + '/dashboard', { waitUntil: 'domcontentloaded' });
            await page.waitForTimeout(2500);
            const setup = await page.evaluate(async () => {
                const W = window.GilbaWizard;
                if (!W) return { error: 'GilbaWizard is not on this page' };
                W.d.location = { lat: -36.8508827, lon: 174.7644881, name: 'Auckland, New Zealand' };
                W.d.turfType = 'golf';
                W.d.golfSurface = 'greens';
                // The name the inputs list uses for a golf site's surface, and the one the lock asks
                // for: `golfSurface` alone left the site held (measured 02.10).
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

            const soil = await api('POST', '/api/samples', {
                site_id: siteId, sample_type: 'soil', lab_date: '2026-05-01', payload: SOIL });
            const water = await api('POST', '/api/samples', {
                site_id: siteId, sample_type: 'water', lab_date: '2026-05-02', payload: WATER });
            if (soil.status !== 201 || water.status !== 201) {
                throw new Error('samples refused: ' + JSON.stringify([soil.status, water.status]));
            }
            const list = await api('GET', '/api/samples?site_id=' + siteId + '&limit=50');
            const rows = (list.body && list.body.data) || [];

            // Settings → Zones needs a type on every zone, or its own tab refuses to save (GH-801); the
            // Data page and the Edit window do not care, and this is what the coordinator opens.
            const zones = ((await api('GET', '/api/sites/' + siteId)).body.data.zones || []);
            await api('PATCH', '/api/sites/' + siteId + '/zones',
                { typed: zones.map((z) => ({ id: z.id, zoneType: 'green' })) });

            /** What to open, and the numbers to take before the edit. */
            process.stdout.write('[gh805-live] SITE ' + siteId
                + '\n[gh805-live] samples: ' + JSON.stringify(rows.map((r) => ({
                    id: r.id, type: r.sample_type, label: (r.payload || {})._label,
                    keys: Object.keys(r.payload || {}).sort(),
                })), null, 1)
                + '\n[gh805-live] open: ' + BASE_URL + '/data (this site is already the active one)\n');

            return { siteId, rows };
        };

        const removeIt = async (siteId) => {
            const list = await api('GET', '/api/samples?site_id=' + siteId + '&limit=2000');
            const sampleIds = ((list.body && list.body.data) || []).map((r) => r.id);
            const gone = [];
            for (const id of sampleIds) {
                gone.push((await api('DELETE', '/api/samples/' + id)).status);
            }
            const zones = ((await api('GET', '/api/sites/' + siteId)).body.data.zones || []).map((z) => z.id);
            const zonesGone = zones.length
                ? await api('PATCH', '/api/sites/' + siteId + '/zones', { deleted: zones })
                : { status: 200 };
            if (previousActiveSiteId) await api('PATCH', '/api/active-site', { site_id: previousActiveSiteId });
            const siteGone = await api('DELETE', '/api/sites/' + siteId);
            const left = ((await api('GET', '/api/sites/' + siteId)).body?.data?.zones || []).length;
            process.stdout.write('[gh805-live] removed: ' + sampleIds.length + ' samples -> '
                + JSON.stringify(Array.from(new Set(gone))) + ', ' + zones.length + ' zones -> '
                + zonesGone.status + ', zones left ' + left + ', site -> ' + siteGone.status + '\n');

            // The same four assertions as the other live file: a silent cleanup is not a cleanup.
            expect(Array.from(new Set(gone)).filter((s) => s !== 200)).toEqual([]);
            expect(zonesGone.status).toBe(200);
            expect(left).toBe(0);
            expect(siteGone.status).toBe(200);
        };

        test(REMOVE ? 'takes the site away again'
            : (FINISH_SETUP ? 'finishes the setup of a site through the product'
                : 'makes the site and the samples and says what to open'),
            async () => {
                if (REMOVE) {
                    await removeIt(REMOVE);

                    return;
                }
                if (FINISH_SETUP) {
                    // The Settings Turf tab's own road: the config route, one field.
                    const saved = await api('PATCH', '/api/sites/' + FINISH_SETUP + '/config/gaip',
                        { place: 'settings.turf', patch: { turf: { subCategory: 'greens' } } });
                    const open = await page.goto(BASE_URL + '/data', { waitUntil: 'domcontentloaded' });
                    process.stdout.write('[gh805-live] the config route answered ' + saved.status
                        + ', and /data landed on ' + page.url().replace(BASE_URL, '')
                        + ' (' + (open ? open.status() : '?') + ')\n');
                    const rows = await page.evaluate(
                        () => document.querySelectorAll('#dat-soil-table tbody tr, .dat-table tbody tr').length);
                    process.stdout.write('[gh805-live] rows the Data page drew: ' + rows + '\n');

                    expect(saved.status).toBe(200);
                    expect(page.url().replace(BASE_URL, '')).toBe('/data');
                    expect(rows).toBeGreaterThan(0);

                    return;
                }
                const { rows } = await makeIt();
                const soil = rows.filter((r) => r.sample_type === 'soil')[0];
                const water = rows.filter((r) => r.sample_type === 'water')[0];
                /**
                 * WHAT A SAMPLE SAVED THROUGH THE PRODUCT ACTUALLY KEEPS, measured here rather than
                 * assumed: `saveSampleRecord` canonicalises on write, so the lab spellings this file
                 * sends arrive as the canonical names — `pH_Water` as `pH`, `CEC_meq100g` as `CEC`,
                 * `OM_Percent` as `OM`, `EC1_5` as `EC`. All four of those DO have a field in the Edit
                 * window, so they are not what a live edit can lose.
                 *
                 * `pH_CaCl2` survives as itself and the window has no field for it, and the water
                 * sample keeps `PO4` with no `P` beside it. Those two are what the live edit proves;
                 * the five lab spellings of the stand's older rows are the fixture's business
                 * (`Gh805AnEditMergesAndDoesNotReplaceTest`, built by model for that reason).
                 */
                process.stdout.write('[gh805-live] the soil sample as the product stored it: '
                    + JSON.stringify(soil.payload) + '\n[gh805-live] keys the Edit window cannot see: '
                    + JSON.stringify(['pH_CaCl2']) + '\n');
                expect(soil.payload.pH_CaCl2).toBe(SOIL.pH_CaCl2);
                expect(soil.payload.pH).toBe(SOIL.pH_Water);
                expect(soil.payload.CEC).toBe(SOIL.CEC_meq100g);
                expect(water.payload.PO4).toBe(0.07);
                expect(water.payload.P).toBeUndefined();
            }, 600000);
    });
}

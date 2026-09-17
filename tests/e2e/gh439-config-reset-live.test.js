/**
 * GH-439 live investigation — a site's own configuration (name, location,
 * methodology) reverting to defaults on a live client's site.
 *
 * This file is a measurement, not a fix. Every scenario runs against a scratch
 * site the test creates itself and deletes at the end; no existing site is
 * touched, and the login's active-site pointer is put back afterwards. Each
 * scenario prints what the product actually wrote (request bodies, DB rows) so
 * the report can quote it, and asserts the behaviour a user is entitled to —
 * a failing assertion here IS the reproduction.
 *
 * Scenarios:
 *   A. Plan > Generate on a freshly loaded page keeps turf.methodology.
 *   B. Plan tab loaded BEFORE a Settings change, Generate pressed AFTER it —
 *      does the Plan tab's whole-config PUT put the old methodology back?
 *   C. Same flow, same tab (Settings save, then navigate to Plan, Generate).
 *   D. Re-run from /analysis — every /api/sites* and /api/analysis-cache write
 *      the hidden /hub iframe makes, and a before/after diff of the site row.
 *   E. /analysis loaded while GET /api/sites fails (what a non-admin saw before
 *      GH-359) — does the legacy registry push rename the site to its own ID?
 *   F. POST /api/sites/sync with an ID that is not in the database — the
 *      documented signature of syncRegistry(): a site named by its ID, with
 *      timezone Australia/Sydney and no coordinates.
 *   H1. A hub page (/reports/forensic) whose GET /api/sites answers late —
 *      what site-config-persistence.js pushes back for the active site.
 *      Split in two by GH-439 stage 0: H1a asks whether the wizard section
 *      survives (the server guard answers for that now), H1b whether the
 *      identity fields are untouched — which the guard cannot answer, because
 *      the snapshot carries turf.nProgram as a non-empty value and a server
 *      cannot tell that from a deliberate edit. H1b stays red until the
 *      pages stop pushing snapshots at all (stage 2).
 *   H2. A hub page opened on ANOTHER site, in a browser that still holds an
 *      old copy of this site's config — what it pushes for this site. Split
 *      the same way and for the same reason: the stale copy's methodology is
 *      non-empty too.
 *
 * Run: GILBA_E2E=1 npx jest tests/e2e/gh439-config-reset-live.test.js --runInBand --testTimeout=600000
 */

'use strict';

const fs = require('fs');
const path = require('path');
const { execFileSync } = require('child_process');

const ENABLED = process.env.GILBA_E2E === '1';

let credentials = {};
try {
    credentials = JSON.parse(fs.readFileSync(
        process.env.GILBA_E2E_CREDENTIALS || path.join(__dirname, '.e2e-credentials.json'), 'utf8'));
} catch (e) { credentials = {}; }

const BASE_URL = process.env.GILBA_E2E_URL || credentials.url || 'http://127.0.0.1:8080';
const EMAIL = process.env.GILBA_E2E_EMAIL || credentials.email;
const PASSWORD = process.env.GILBA_E2E_PASSWORD || credentials.password;

const SCRATCH_NAME = 'GH-439 config-reset scratch';
const AUCKLAND = { name: 'Auckland, New Zealand', lat: -36.8508827, lon: 174.7644881 };
const UNKNOWN_ID = '019e0000-0000-7000-8000-0000004390ff'; // never in the DB; scenario F

let chromium = null;
try { ({ chromium } = require('playwright')); } catch (e) { /* reported below */ }

function sql(query) {
    const out = execFileSync('docker', [
        'exec', 'gilba_mysql', 'mysql', '-ugilba', '-pgilba_secret', 'gilba',
        '--batch', '--raw', '--skip-column-names', '-e', query,
    ], { encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] });
    return out.trim().split('\n').filter(Boolean).map((line) => line.split('\t'));
}

function siteRow(id) {
    const rows = sql("SELECT name, IFNULL(latitude,'NULL'), IFNULL(longitude,'NULL'), IFNULL(timezone,'NULL'), "
        + "IFNULL(location_name,'NULL'), IFNULL(deleted_at,'NULL') FROM sites WHERE id = '" + id + "';");
    if (!rows.length) return null;
    const [name, lat, lon, tz, locName, deleted] = rows[0];
    return { name, latitude: lat, longitude: lon, timezone: tz, location_name: locName, deleted_at: deleted };
}

function gaipConfig(id) {
    const rows = sql("SELECT config FROM site_configs WHERE site_id = '" + id + "' AND namespace = 'gaip';");
    if (!rows.length) return null;
    try { return JSON.parse(rows[0].join('\t')); } catch (e) { return { _unparsed: rows[0].join('\t') }; }
}

function analysisCacheMethodology(id) {
    const rows = sql("SELECT IFNULL(JSON_UNQUOTE(JSON_EXTRACT(config,'$.computed.soilNutrition.methodology')),'NULL'), "
        + "IFNULL(synced_at,'NULL') FROM site_configs WHERE site_id = '" + id + "' AND namespace = 'analysis_cache';");
    return rows.length ? { methodology: rows[0][0], synced_at: rows[0][1] } : null;
}

function identity(cfg) {
    // The fields a user calls "my configuration"; programme caches and savedAt excluded.
    const t = (cfg && cfg.turf) || {};
    const l = (cfg && cfg.location) || {};
    return {
        species: t.species, methodology: t.methodology, turfType: t.turfType, nProgram: t.nProgram,
        locName: l.name, lat: l.lat, lon: l.lon,
    };
}

function out(line) { process.stdout.write('[gh439] ' + line + '\n'); }

if (!ENABLED) {
    process.stdout.write('[e2e] gh439-config-reset-live skipped (needs the live stack)\n');
    test.skip('GH-439 live investigation (disabled)', () => {});
} else {
    describe('GH-439 — what regenerates, re-runs and syncs actually write to a site', () => {
        let browser, context, page;
        let scratchSiteId = null;
        let previousActiveSiteId = null;
        const writes = []; // every non-GET request to /api/sites* | /api/analysis-cache | /api/active-site

        function attachWriteLog(p) {
            p.on('request', (req) => {
                const url = req.url();
                if (req.method() === 'GET') return;
                if (!/\/api\/(sites|analysis-cache|active-site|samples)/.test(url)) return;
                let body = req.postData() || '';
                writes.push({ method: req.method(), url: url.replace(BASE_URL, ''), body, frame: req.frame().url().replace(BASE_URL, '') });
            });
        }

        function writesSince(from, filter) {
            return writes.slice(from).filter((w) => !filter || filter.test(w.url));
        }

        function summarise(w) {
            let b = w.body;
            try {
                const j = JSON.parse(b);
                if (j.config) {
                    const t = j.config.turf || {}; const l = j.config.location || {};
                    b = 'config{turf.methodology=' + t.methodology + ', turf.species=' + t.species
                        + ', location=' + JSON.stringify(l) + ', keys=' + Object.keys(j.config).join('|') + '}';
                } else if (j.sites) {
                    b = 'sites=' + JSON.stringify(j.sites);
                } else if (j.allSites) {
                    b = 'allSites keys=' + Object.keys(j.allSites).join('|');
                } else {
                    b = JSON.stringify(j).slice(0, 300);
                }
            } catch (e) { b = String(b).slice(0, 200); }
            return w.method + ' ' + w.url + ' (from ' + w.frame + ') ' + b;
        }

        async function api(p, method, url, body) {
            return p.evaluate(async ({ method, url, body }) => {
                const t = document.querySelector('meta[name=csrf-token]');
                const r = await fetch(url, {
                    method,
                    headers: Object.assign(
                        { Accept: 'application/json' },
                        body ? { 'Content-Type': 'application/json' } : {},
                        t ? { 'X-CSRF-TOKEN': t.getAttribute('content') } : {}),
                    body: body ? JSON.stringify(body) : undefined,
                    credentials: 'same-origin',
                });
                let json = null;
                try { json = await r.json(); } catch (e) { json = null; }
                return { status: r.status, json };
            }, { method, url, body: body || null });
        }

        async function login(p) {
            await p.goto(BASE_URL + '/login', { waitUntil: 'domcontentloaded' });
            await p.fill('#email', EMAIL);
            await p.fill('#password', PASSWORD);
            await Promise.all([
                p.waitForNavigation({ waitUntil: 'domcontentloaded' }).catch(() => {}),
                p.click('form.login-form button[type=submit]'),
            ]);
            await p.waitForTimeout(1500);
            if (/\/login/.test(p.url())) throw new Error('login refused for ' + EMAIL);
        }

        async function setActive(p, id) {
            const r = await api(p, 'PATCH', '/api/active-site', { site_id: id });
            if (r.status !== 200) throw new Error('could not set active site: ' + JSON.stringify(r));
        }

        // GH-442 (GH-439 stage 3): the scenarios below need a site to be in a
        // known state before the product touches it. That used to be done with
        // the whole-object PUT, which now answers 410 — and rightly: setting a
        // site's entire config in one request is exactly what no client may do.
        // Test SETUP is not a client, so it writes the row directly instead of
        // reaching for a product write path that should not exist.
        function seedConfig(siteId, cfg) {
            const json = JSON.stringify(cfg).replace(/\\/g, '\\\\').replace(/'/g, "\\'");
            sql("UPDATE site_configs SET config = '" + json + "', synced_at = NOW() "
                + "WHERE site_id = '" + siteId + "' AND namespace = 'gaip';");
        }

        async function putConfig(p, cfg) {
            seedConfig(scratchSiteId, cfg);
        }

        function baseConfig(methodology) {
            return {
                turf: { turfType: 'sports', subCategory: '', species: 'Perennial Ryegrass', variety: 'generic',
                    methodology, nProgram: 200 },
                location: { name: AUCKLAND.name, lat: AUCKLAND.lat, lon: AUCKLAND.lon },
                savedAt: new Date().toISOString(),
            };
        }

        // Plan > Nutrition: fill Annual N and press Generate; resolve once the page's
        // config PUT has landed (plus a grace period for the follow-up PUTs the
        // regional integration fires from the same event chain).
        async function generateOnPlan(p) {
            await p.waitForFunction(() => !!window.GilbaNutritionCalendar, null, { timeout: 30000 });
            await p.waitForTimeout(2500);
            const tab = await p.$('a[data-tab="nutrition"]');
            if (tab) { await tab.click(); await p.waitForTimeout(1200); }
            await p.waitForSelector('#plan-nut-annual-n', { state: 'attached', timeout: 30000 });
            await p.evaluate(() => {
                const el = document.getElementById('plan-nut-annual-n');
                el.value = '200';
                el.dispatchEvent(new Event('input', { bubbles: true }));
                el.dispatchEvent(new Event('change', { bubbles: true }));
            });
            const from = writes.length;
            const saved = p.waitForResponse((r) => /\/config\/gaip$/.test(r.url()) && r.request().method() === 'PATCH',
                { timeout: 120000 });
            await p.click('#plan-nut-generate-btn');
            const res = await saved;
            await p.waitForTimeout(4000);
            return { status: res.status(), writes: writesSince(from, /\/api\/sites/) };
        }

        // Settings > Turf profile: pick a methodology and save the form.
        async function saveMethodologyInSettings(p, methodology) {
            await p.goto(BASE_URL + '/settings', { waitUntil: 'domcontentloaded' });
            await p.waitForSelector('#stg-turf-methodology', { state: 'attached', timeout: 30000 });
            const options = await p.$$eval('#stg-turf-methodology option', (o) => o.map((x) => x.value).filter(Boolean));
            out('Settings methodology options: ' + JSON.stringify(options));
            const from = writes.length;
            const saved = p.waitForResponse((r) => /\/config\/gaip$/.test(r.url()) && r.request().method() === 'PATCH',
                { timeout: 60000 });
            await p.evaluate((m) => {
                const sel = document.getElementById('stg-turf-methodology');
                sel.value = m;
                sel.dispatchEvent(new Event('change', { bubbles: true }));
                document.getElementById('stg-turf-form').requestSubmit();
            }, methodology);
            const res = await saved;
            await p.waitForTimeout(1500);
            return { status: res.status(), writes: writesSince(from, /\/api\/sites/) };
        }

        // Press Re-run and wait for the page to reload itself (the iframe posts
        // gilba:analysis-complete, or the 30 s safety timer fires).
        async function rerun(p) {
            await p.waitForSelector('#db-rerun-btn', { timeout: 30000 });
            await p.evaluate(() => { window.__gh439_marker = 1; });
            const from = writes.length;
            await p.click('#db-rerun-btn');
            const deadline = Date.now() + 45000;
            while (Date.now() < deadline) {
                await p.waitForTimeout(500);
                const still = await p.evaluate(() => window.__gh439_marker === 1).catch(() => false);
                if (!still) break;
            }
            await p.waitForTimeout(3000);
            return writesSince(from);
        }

        beforeAll(async () => {
            if (!chromium) throw new Error('playwright does not resolve from the repo — run `npm install`');
            if (!EMAIL || !PASSWORD) throw new Error('no credentials — see tests/e2e/.e2e-credentials.example.json');

            browser = await chromium.launch();
            context = await browser.newContext();
            page = await context.newPage();
            page.on('dialog', (d) => { out('DIALOG: ' + d.message().slice(0, 120)); d.accept(); });
            attachWriteLog(page);
            await login(page);

            const sites = await api(page, 'GET', '/api/sites');
            previousActiveSiteId = sites.json.active_site_id;

            const created = await api(page, 'POST', '/api/sites', {
                name: SCRATCH_NAME,
                location_name: AUCKLAND.name,
                latitude: AUCKLAND.lat,
                longitude: AUCKLAND.lon,
                // No timezone: GH-439 derives it from the coordinates, and
                // the row printed below is where that is read back.
                site_type: 'sports',
            });
            if (created.status !== 201) throw new Error('could not create the scratch site: ' + JSON.stringify(created));
            scratchSiteId = created.json.data.id;
            out('scratch site ' + scratchSiteId);
            await putConfig(page, baseConfig('ammonium_acetate'));
            await setActive(page, scratchSiteId);
            // The API row is provisional (store() sets provisional_name=1) and the
            // dashboard would redirect into the setup wizard; the pages used here
            // (/plan, /settings, /analysis) do not, so leave it.
            out('site row at start: ' + JSON.stringify(siteRow(scratchSiteId)));
            out('config at start: ' + JSON.stringify(identity(gaipConfig(scratchSiteId))));
        }, 180000);

        afterAll(async () => {
            try {
                if (page && scratchSiteId) {
                    const del = await api(page, 'DELETE', '/api/sites/' + scratchSiteId);
                    out('scratch site deleted: ' + JSON.stringify(del.json));
                }
                if (page) {
                    // Scenario F may have created a site under UNKNOWN_ID; remove it.
                    const rows = sql("SELECT id FROM sites WHERE id = '" + UNKNOWN_ID + "';");
                    if (rows.length) {
                        const del2 = await api(page, 'DELETE', '/api/sites/' + UNKNOWN_ID);
                        out('unknown-id site deleted: ' + JSON.stringify(del2.json));
                    }
                }
                if (page && previousActiveSiteId) await setActive(page, previousActiveSiteId);
                if (scratchSiteId) {
                    // Rows the API's site delete leaves behind: the scenario-E sample
                    // and the summaries the sample store wrote for it. Scratch-only.
                    sql("DELETE FROM site_summaries WHERE site_id = '" + scratchSiteId + "';");
                    sql("DELETE FROM samples WHERE site_id = '" + scratchSiteId + "';");
                }
            } finally {
                if (browser) await browser.close();
            }
        }, 180000);

        test('A. Plan > Generate on a fresh page keeps the saved methodology', async () => {
            await page.goto(BASE_URL + '/plan', { waitUntil: 'domcontentloaded' });
            const r = await generateOnPlan(page);
            r.writes.forEach((w) => out('A ' + summarise(w)));
            const cfg = gaipConfig(scratchSiteId);
            out('A config after: ' + JSON.stringify(identity(cfg)) + ' keys=' + Object.keys(cfg).join('|'));
            out('A site row after: ' + JSON.stringify(siteRow(scratchSiteId)));
            expect(r.status).toBe(200);
            expect(cfg.turf.methodology).toBe('ammonium_acetate');
            expect(siteRow(scratchSiteId).name).toBe(SCRATCH_NAME);
        }, 240000);

        // Green from GH-440 (stage 1): the Plan tab sends only the programme
        // keys it just computed, and re-reads the site's config before
        // computing them. Red through stage 0, where the tab still sent its
        // whole load-time copy.
        test('B. a Plan tab opened BEFORE a Settings methodology change: Generate must not put the old value back', async () => {
            // Start as the client did: site saved as SLAN.
            const cur = gaipConfig(scratchSiteId);
            cur.turf.methodology = 'slan';
            await putConfig(page, cur);
            expect(gaipConfig(scratchSiteId).turf.methodology).toBe('slan');

            const planTab = await context.newPage();
            planTab.on('dialog', (d) => { out('DIALOG(plan): ' + d.message().slice(0, 120)); d.accept(); });
            attachWriteLog(planTab);
            await planTab.goto(BASE_URL + '/plan', { waitUntil: 'domcontentloaded' });
            await planTab.waitForSelector('#plan-nut-annual-n', { state: 'attached', timeout: 30000 });
            const planSaw = await planTab.evaluate(() => (window.GAIP_SITE_CONFIG || {}).turf && window.GAIP_SITE_CONFIG.turf.methodology);
            out('B Plan tab loaded with GAIP_SITE_CONFIG.turf.methodology=' + planSaw);

            // Then the client sets Ammonium Acetate in Settings (other tab) and saves.
            const s = await saveMethodologyInSettings(page, 'ammonium_acetate');
            s.writes.forEach((w) => out('B settings ' + summarise(w)));
            const afterSettings = gaipConfig(scratchSiteId).turf.methodology;
            out('B DB after Settings save: turf.methodology=' + afterSettings);
            expect(afterSettings).toBe('ammonium_acetate');

            // Then presses Generate in the Plan tab that was already open.
            const r = await generateOnPlan(planTab);
            r.writes.forEach((w) => out('B plan ' + summarise(w)));
            const afterGenerate = gaipConfig(scratchSiteId).turf.methodology;
            out('B DB after Generate in the stale Plan tab: turf.methodology=' + afterGenerate);
            await planTab.close();
            expect(afterGenerate).toBe('ammonium_acetate');
        }, 300000);

        test('S1. nothing on Plan or Settings sends a whole config', async () => {
            // GH-440 (GH-439 stage 1): the point of the stage, stated as a
            // rule rather than a symptom. Every write these two pages make is
            // a PATCH naming the sections the user just touched; a single PUT
            // from either is the defect coming back.
            const from = writes.length;

            await saveMethodologyInSettings(page, 'ammonium_acetate');
            await page.goto(BASE_URL + '/plan', { waitUntil: 'domcontentloaded' });
            await generateOnPlan(page);

            const configWrites = writesSince(from, /\/config\/gaip/);
            configWrites.forEach((w) => out('S1 ' + summarise(w)));
            expect(configWrites.length).toBeGreaterThan(0);
            expect(configWrites.filter((w) => w.method === 'PUT')).toEqual([]);

            // And each body is a patch of named sections, never a config.
            configWrites.forEach((w) => {
                const body = JSON.parse(w.body || '{}');
                expect(body.config).toBeUndefined();
                expect(Object.keys(body.patch || {}).length + (body.clear || []).length).toBeGreaterThan(0);
            });

            // The Settings save names turf and nothing else; Plan names only
            // the programme keys it just computed.
            const fromSettings = configWrites.filter((w) => /\/settings/.test(w.frame));
            expect(fromSettings.length).toBeGreaterThan(0);
            fromSettings.forEach((w) => {
                const keys = Object.keys(JSON.parse(w.body || '{}').patch || {});
                out('S1 settings patch keys: ' + keys.join('|'));
                expect(keys.every((k) => ['turf', 'location', 'irrigation', 'weatherOverride'].indexOf(k) !== -1)).toBe(true);
            });

            const fromPlan = configWrites.filter((w) => /\/plan/.test(w.frame));
            expect(fromPlan.length).toBeGreaterThan(0);
            fromPlan.forEach((w) => {
                const keys = Object.keys(JSON.parse(w.body || '{}').patch || {});
                out('S1 plan patch keys: ' + keys.join('|'));
                expect(keys.every((k) => [
                    'nutritionCalendarProgram', 'nutritionProgram', 'nutritionProgramCoords',
                    'maxNPerMonth', 'appliedMonthlyN', 'nzDistributor',
                ].indexOf(k) !== -1)).toBe(true);
            });
        }, 300000);

        test('C. same tab: Settings save, then navigate to Plan and Generate', async () => {
            const s = await saveMethodologyInSettings(page, 'ammonium_acetate');
            s.writes.forEach((w) => out('C settings ' + summarise(w)));
            expect(gaipConfig(scratchSiteId).turf.methodology).toBe('ammonium_acetate');
            await page.goto(BASE_URL + '/plan', { waitUntil: 'domcontentloaded' });
            const r = await generateOnPlan(page);
            r.writes.forEach((w) => out('C plan ' + summarise(w)));
            const after = gaipConfig(scratchSiteId).turf.methodology;
            out('C DB after Generate: turf.methodology=' + after);
            expect(after).toBe('ammonium_acetate');
        }, 300000);

        test('D. Re-run from /analysis: what the hidden /hub iframe writes', async () => {
            const rowBefore = siteRow(scratchSiteId);
            const cfgBefore = identity(gaipConfig(scratchSiteId));
            await page.goto(BASE_URL + '/analysis', { waitUntil: 'domcontentloaded' });
            await page.waitForTimeout(4000); // let sample-persistence finish its own page-load push
            const w = await rerun(page);
            w.forEach((x) => out('D ' + summarise(x)));
            const rowAfter = siteRow(scratchSiteId);
            const cfgAfter = identity(gaipConfig(scratchSiteId));
            out('D site row before=' + JSON.stringify(rowBefore) + ' after=' + JSON.stringify(rowAfter));
            out('D config before=' + JSON.stringify(cfgBefore) + ' after=' + JSON.stringify(cfgAfter));
            out('D analysis cache: ' + JSON.stringify(analysisCacheMethodology(scratchSiteId)));
            const pills = await page.$$eval('#db-context-pills .db-pill', (els) => els.map((e) => e.textContent.trim()));
            const shownName = await page.$eval('#db-site-name', (e) => e.textContent.trim()).catch(() => null);
            out('D topbar after reload: name=' + shownName + ' pills=' + JSON.stringify(pills));
            expect(rowAfter).toEqual(rowBefore);
            expect(cfgAfter).toEqual(cfgBefore);
        }, 300000);

        test('E. /analysis while GET /api/sites fails (non-admin before GH-359): the legacy registry push', async () => {
            // The site needs at least one sample on the server: the registry entry
            // whose label is examined is built by fetchSamplesFromServer(), and only
            // for sites that have samples.
            const seeded = await api(page, 'POST', '/api/samples', {
                site_id: scratchSiteId, sample_type: 'soil', client_uid: 'gh439_soil_a',
                sample_date: '2026-03-10', lab_date: '2026-03-10',
                payload: { _label: 'GH439 soil', _zone: 'field', zone: 'Field', pH: 6.2, K: 60, P: 30, Ca: 800, Mg: 110, CEC: 9, OM: 3.2 },
            });
            out('E seeded sample -> ' + seeded.status);

            const ctx = await browser.newContext(); // a browser with no legacy state at all
            const p = await ctx.newPage();
            attachWriteLog(p);
            await p.route(/\/api\/sites(\?.*)?$/, (route) => {
                if (route.request().method() === 'GET') return route.fulfill({ status: 500, body: 'emulated GH-359' });
                return route.continue();
            });
            // Safety: the registry push names EVERY site the login can see. Keep
            // the request real but confined to the scratch site so no other row
            // on this stack can be renamed by the reproduction.
            // GH-441 (GH-439 stage 2): the request body is no longer rewritten
            // on the way past. It used to be confined to the scratch site so a
            // reproduction could not rename anything else; there is nothing to
            // protect now, because the endpoint writes no names and the page
            // no longer calls it at all. Whether it is called is the assertion.
            let syncBodySeen = null;
            await p.route(/\/api\/sites\/sync$/, (route) => {
                let body = {};
                try { body = JSON.parse(route.request().postData() || '{}'); } catch (e) { body = {}; }
                syncBodySeen = body.sites || {};
                return route.continue();
            });
            await login(p);
            const from = writes.length;
            await p.goto(BASE_URL + '/analysis', { waitUntil: 'domcontentloaded' });
            // Wait the same 40 s, but for nothing in particular: a sync that
            // never arrives is the point. S3 below asserts that directly.
            const deadline = Date.now() + 40000;
            while (Date.now() < deadline && !syncBodySeen) await p.waitForTimeout(500);
            await p.waitForTimeout(3000);
            const w = writesSince(from, /\/api\/sites\/sync|\/api\/samples\/sync/);
            w.forEach((x) => out('E ' + summarise(x)));
            out('E labels the page wanted to push (all sites): ' + JSON.stringify(
                Object.keys(syncBodySeen || {}).map((id) => id.slice(0, 8) + '=' + (syncBodySeen[id].label || '').slice(0, 30))));
            const registry = await p.evaluate(() => {
                const SM = window.GAIP_SampleManager;
                return SM && SM.getSiteList ? SM.getSiteList().map((s) => s.id.slice(0, 8) + '=' + s.label.slice(0, 30)) : null;
            });
            out('E legacy registry in the page: ' + JSON.stringify(registry));
            const row = siteRow(scratchSiteId);
            out('E site row after: ' + JSON.stringify(row));
            await ctx.close();
            await api(page, 'DELETE', '/api/samples/' + seeded.json.data.id).catch(() => {});
            expect(row.name).toBe(SCRATCH_NAME);
        }, 240000);

        // Hub pages (/hub, /reports/export|forensic|scenarios, /morning-briefing,
        // /stadium) load site-config-persistence.js, which keeps its own copy of
        // EVERY site's config in localStorage and PUTs all of them back to the
        // server, wholesale, whenever anything triggers pushConfigsToServer().
        // H1: what a hub page pushes when the server's own config arrives late.
        // H2: what it pushes for a site that is NOT the active one, from a copy
        //     the browser has held since an earlier session.
        // GH-441 (review): a page that did not open writes nothing either, so
        // every scenario that counts writes has to prove the page was there.
        // Five cases in this file were green on that technicality; this is what
        // they call now.
        async function assertPageRendered(p, response, label) {
            expect({ label: label, status: response ? response.status() : null })
                .toEqual({ label: label, status: 200 });
            // The topbar is server-rendered on both layouts, so its presence
            // means the document arrived and executed, not merely that a
            // status line came back.
            const rendered = await p.evaluate(() => ({
                title: document.title || '',
                // Both layouts: db-shell pages have .db-shell, layouts.app
                // pages (/hub, /morning-briefing) have .shell with the topbar.
                hasShell: !!(document.querySelector('.db-shell') || document.querySelector('.shell > .topbar, .shell .topbar')),
                bodyLength: (document.body && document.body.innerHTML.length) || 0,
            }));
            expect({ label: label, hasShell: rendered.hasShell, empty: rendered.bodyLength < 500 })
                .toEqual({ label: label, hasShell: true, empty: false });
            return rendered;
        }

        async function hubPageWrites(label, pageUrl, prepare, delaySitesMs) {
            const ctx = await browser.newContext();
            const p = await ctx.newPage();
            p.on('dialog', (d) => { out(label + ' DIALOG: ' + d.message().slice(0, 100)); d.accept(); });
            attachWriteLog(p);
            if (delaySitesMs) {
                await p.route(/\/api\/sites(\?.*)?$/, async (route) => {
                    if (route.request().method() === 'GET') await new Promise((r) => setTimeout(r, delaySitesMs));
                    return route.continue();
                });
            }
            await login(p);
            if (prepare) await prepare(p);
            const from = writes.length;
            const response = await p.goto(BASE_URL + pageUrl, { waitUntil: 'domcontentloaded' });
            await assertPageRendered(p, response, label + ' ' + pageUrl);
            await p.waitForTimeout(25000);
            const w = writesSince(from, /\/api\/sites\/[^/]+\/config|\/api\/sites\/[^/]+$|\/api\/sites\/sync/);
            w.forEach((x) => out(label + ' ' + summarise(x)));
            await ctx.close();
            return w;
        }

        async function seedFullConfig() {
            const full = baseConfig('ammonium_acetate');
            full.wizard = { complete: true, completedAt: '2026-09-01T00:00:00.000Z', version: '1.0' };
            full.pgr = { enabled: true, gddThreshold: 250 };
            await putConfig(page, full);
            return full;
        }

        test('H1a. a hub page whose GET /api/sites answers late must not delete the wizard section', async () => {
            const full = await seedFullConfig();
            const before = gaipConfig(scratchSiteId);
            out('H1a server config before: keys=' + Object.keys(before).join('|') + ' ' + JSON.stringify(identity(before)));
            await hubPageWrites('H1a', '/reports/forensic', null, 7000);
            const after = gaipConfig(scratchSiteId);
            out('H1a server config after: keys=' + Object.keys(after).join('|') + ' ' + JSON.stringify(identity(after)) + ' wizard=' + JSON.stringify(after.wizard));
            out('H1a pgr before=' + JSON.stringify(before.pgr) + ' after=' + JSON.stringify(after.pgr));
            expect(after.wizard).toEqual(full.wizard);
        }, 300000);

        // Green from GH-441 (stage 2). Measured red through stage 1: the
        // snapshot carried a pgr section of the legacy form's own defaults
        // (enabled false, every field null), and a site with PGR configured
        // lost that configuration to any hub page load. No server rule could
        // tell those defaults from a person switching PGR off; the fix was the
        // page not sending them.
        test('H1c. a hub page must not overwrite the pgr section with the legacy form defaults', async () => {
            const full = await seedFullConfig();
            await hubPageWrites('H1c', '/reports/forensic', null, 7000);
            const after = gaipConfig(scratchSiteId);
            out('H1c pgr expected=' + JSON.stringify(full.pgr) + ' actual=' + JSON.stringify(after.pgr));
            expect(after.pgr).toEqual(full.pgr);
        }, 300000);

        // Green from GH-441 (stage 2): the page sends no config at all, so
        // there is no snapshot to compare. Red through stages 0 and 1, where
        // turf.nProgram = "250" from the legacy form's own default reached the
        // database as a real value.
        test('H1b. a hub page whose GET /api/sites answers late must not change the identity fields', async () => {
            await seedFullConfig();
            const before = gaipConfig(scratchSiteId);
            await hubPageWrites('H1b', '/reports/forensic', null, 7000);
            const after = gaipConfig(scratchSiteId);
            out('H1b identity before=' + JSON.stringify(identity(before)) + ' after=' + JSON.stringify(identity(after)));
            expect(identity(after)).toEqual(identity(before));
        }, 300000);

        // H2, rewritten for GH-441 (stage 2). The scenario is unchanged --
        // a browser holding an old copy of a site it is not looking at, on a
        // page whose GET /api/sites answers late -- but the question is no
        // longer "does the server refuse the bad write". It is "does the page
        // write at all", and the answer has to be no. The held copy is what it
        // always was: methodology 'slan', no coordinates, no wizard.
        test('H2. a hub page opened on ANOTHER site writes nothing for this one', async () => {
            const full = baseConfig('ammonium_acetate');
            full.wizard = { complete: true, completedAt: '2026-09-01T00:00:00.000Z', version: '1.0' };
            full.pgr = { enabled: true, gddThreshold: 250 };
            await putConfig(page, full);
            const before = gaipConfig(scratchSiteId);

            const other = await api(page, 'POST', '/api/sites', {
                name: SCRATCH_NAME + ' (other)', location_name: 'Wollongong',
                latitude: -34.437, longitude: 150.8994, site_type: 'golf',
            });
            const otherId = other.json.data.id;
            seedConfig(otherId, {
                turf: { turfType: 'golf', subCategory: 'greens', species: 'Creeping Bentgrass (Greens)', methodology: 'mlsn' },
                location: { name: 'Wollongong', lat: -34.437, lon: 150.8994 },
                savedAt: new Date().toISOString(),
            });
            await setActive(page, otherId);

            let seen = [];
            try {
                seen = await hubPageWrites('H2', '/reports/forensic', async (p) => {
                    await p.goto(BASE_URL + '/settings', { waitUntil: 'domcontentloaded' });
                    await p.evaluate((id) => {
                        localStorage.setItem('gilba_hub_site_configs', JSON.stringify({
                            [id]: { turf: { turfType: 'sports', subCategory: '', species: 'Perennial Ryegrass', variety: '', methodology: 'slan' },
                                location: { lat: null, lon: null, name: '' }, savedAt: '2026-06-01T00:00:00.000Z' },
                        }));
                    }, scratchSiteId);
                }, 7000);
            } finally {
                await setActive(page, scratchSiteId);
                await api(page, 'DELETE', '/api/sites/' + otherId);
            }

            const after = gaipConfig(scratchSiteId);
            const writesForThisSite = seen.filter((w) => w.url.indexOf('/api/sites/' + scratchSiteId) === 0);
            out('H2 writes for this site: ' + writesForThisSite.length);
            out('H2 config before=' + JSON.stringify(identity(before)) + ' after=' + JSON.stringify(identity(after)));

            expect(writesForThisSite).toEqual([]);
            expect(identity(after)).toEqual(identity(before));
            expect(after.wizard).toEqual(full.wizard);
            expect(after.pgr).toEqual(full.pgr);
        }, 300000);

        // NOTE — this scenario measures a page whose GET /api/sites is stalled
        // by 7 s, and that is the only thing it can claim. Read on its own it
        // once looked like proof that "the pages write nothing", and it was
        // not: the programme chain does not finish inside that window, so the
        // writes it would have made fell outside the measurement. What it
        // does prove is the case it was written for — a page that loads
        // BEFORE its config arrives must not push its own form defaults.
        // The plain-load claim belongs to S8, which uses no delay at all.
        test('S2. five hub pages whose GET /api/sites is stalled 7 s write nothing in that window', async () => {
            // GH-441 (GH-439 stage 2): the measurement this whole stage exists
            // for. Before it, one load of /reports/forensic fired fourteen
            // config PUTs plus a registry sync, and the body for the active
            // site carried another site's species. Opening five pages must now
            // write nothing at all: no PUT, no POST to /api/sites*, and every
            // site's savedAt untouched in the database.
            const savedAtBefore = sql("SELECT site_id, IFNULL(JSON_UNQUOTE(JSON_EXTRACT(config,'$.savedAt')),'-') "
                + "FROM site_configs WHERE namespace = 'gaip';");

            const pages = ['/hub', '/reports/export', '/reports/forensic', '/reports/scenarios', '/morning-briefing'];
            const from = writes.length;

            const ctx = await browser.newContext();
            const p = await ctx.newPage();
            p.on('dialog', (d) => { out('S2 DIALOG: ' + d.message().slice(0, 100)); d.accept(); });
            attachWriteLog(p);
            await p.route(/\/api\/sites(\?.*)?$/, async (route) => {
                if (route.request().method() === 'GET') await new Promise((r) => setTimeout(r, 7000));
                return route.continue();
            });
            await login(p);
            for (const url of pages) {
                const response = await p.goto(BASE_URL + url, { waitUntil: 'domcontentloaded' });
                await assertPageRendered(p, response, 'S2 ' + url);
                await p.waitForTimeout(6000);
            }
            await p.waitForTimeout(8000);
            await ctx.close();

            const siteWrites = writesSince(from, /\/api\/sites/)
                // PATCH /api/active-site is intent, not state: a page saying
                // which site the user is looking at.
                .filter((w) => !/\/api\/active-site/.test(w.url));
            siteWrites.forEach((w) => out('S2 ' + summarise(w)));
            expect(siteWrites).toEqual([]);

            const savedAtAfter = sql("SELECT site_id, IFNULL(JSON_UNQUOTE(JSON_EXTRACT(config,'$.savedAt')),'-') "
                + "FROM site_configs WHERE namespace = 'gaip';");
            out('S2 savedAt rows before=' + savedAtBefore.length + ' after=' + savedAtAfter.length);
            expect(savedAtAfter).toEqual(savedAtBefore);
        }, 300000);

        test('S3. GET /api/sites fails on /analysis: no registry push, no invented names, and the page says so', async () => {
            const rowBefore = siteRow(scratchSiteId);
            const from = writes.length;

            const ctx = await browser.newContext();
            const p = await ctx.newPage();
            p.on('dialog', (d) => d.accept());
            attachWriteLog(p);
            await p.route(/\/api\/sites(\?.*)?$/, (route) => {
                if (route.request().method() === 'GET') return route.fulfill({ status: 500, body: 'emulated failure' });
                return route.continue();
            });
            await login(p);
            await p.goto(BASE_URL + '/analysis', { waitUntil: 'domcontentloaded' });
            await p.waitForTimeout(20000);

            const errorState = await p.evaluate(() => {
                const banner = document.getElementById('db-settings-unavailable');
                return {
                    bannerShown: !!banner,
                    bannerText: banner ? banner.textContent.slice(0, 120) : null,
                    configFailed: window.GAIP_SITE_CONFIG_FAILED === true,
                    registry: (window.GAIP_SampleManager && window.GAIP_SampleManager.getSiteList)
                        ? window.GAIP_SampleManager.getSiteList().map((s) => s.id.slice(0, 8) + '=' + (s.label || ''))
                        : null,
                };
            });
            await ctx.close();

            const syncs = writesSince(from, /\/api\/sites\/sync/);
            syncs.forEach((w) => out('S3 ' + summarise(w)));
            out('S3 page state: ' + JSON.stringify(errorState).slice(0, 300));

            expect(syncs).toEqual([]);
            // /analysis is a db-shell page and does not load
            // site-config-persistence.js, so what has to be visible here is the
            // shared banner, raised from the site-list failure itself.
            expect(errorState.bannerShown).toBe(true);
            // And the registry was not rebuilt out of this browser's samples:
            // the only entry is the client-side 'default' placeholder.
            expect((errorState.registry || []).filter((r) => !/^default/.test(r))).toEqual([]);
            expect(siteRow(scratchSiteId).name).toBe(rowBefore.name);
        }, 240000);

        // GH-441 (review): the failure path, seen on the pages it matters on.
        //
        // S3 above goes to /analysis, which loads neither
        // site-config-persistence.js nor the orchestrator, so it could never
        // have shown whether the analysis is held back. These two do:
        // /morning-briefing is a page a client opens and sits on layouts.app
        // (where the banner used not to load at all), and /reports/forensic
        // runs the legacy engine.
        async function failureStateFor(pageUrl, label, screenshotPath) {
            const ctx = await browser.newContext();
            const p = await ctx.newPage();
            p.on('dialog', (d) => d.accept());
            attachWriteLog(p);

            const computeLog = [];
            p.on('console', (msg) => {
                const text = msg.text();
                if (/computeAll|Orchestrator|site settings|site-config|Auto-run/i.test(text)) {
                    computeLog.push(text.slice(0, 160));
                }
            });

            await p.route(/\/api\/sites(\?.*)?$/, (route) => {
                if (route.request().method() === 'GET') return route.fulfill({ status: 500, body: 'emulated failure' });
                return route.continue();
            });
            await login(p);
            const response = await p.goto(BASE_URL + pageUrl, { waitUntil: 'domcontentloaded' });
            await assertPageRendered(p, response, label + ' ' + pageUrl);
            await p.waitForTimeout(25000);

            const state = await p.evaluate(() => {
                const banner = document.getElementById('db-settings-unavailable');
                return {
                    failed: window.GAIP_SITE_CONFIG_FAILED === true,
                    banner: !!banner,
                    bannerText: banner ? banner.textContent.trim().slice(0, 200) : null,
                    // GAIP_STATE.computed is an empty scaffold created at load,
                    // so its presence proves nothing. These are written only by
                    // a run that actually happened.
                    diseaseResult: !!window.GAIP_DISEASE_RESULT,
                    trajectory: !!(window.GAIP_STATE && window.GAIP_STATE.computed
                        && window.GAIP_STATE.computed.stressTrajectory),
                    growthPotential: (window.GAIP_STATE && window.GAIP_STATE.computed
                        && window.GAIP_STATE.computed.growthPotential) || null,
                };
            });

            if (screenshotPath) await p.screenshot({ path: screenshotPath, fullPage: false });
            await ctx.close();

            // The run leaves a trail in the console too; a green result here
            // has to mean no run started, not that its output was tidied away.
            state.ranAnalysis = computeLog.some((line) =>
                /computeAll triggered|Auto-running analysis on page load|Clicking run button/i.test(line));

            out(label + ' state: ' + JSON.stringify(state));
            computeLog.slice(0, 10).forEach((l) => out(label + ' console: ' + l));
            return state;
        }

        test('S4a. /morning-briefing: the client-facing page says the settings are missing and computes nothing', async () => {
            const shot = (process.env.GILBA_E2E_SHOTS || '/tmp') + '/gh441-morning-briefing-failure.png';
            const state = await failureStateFor('/morning-briefing', 'S4a', shot);
            out('S4a screenshot: ' + shot);

            expect(state.failed).toBe(true);
            expect(state.banner).toBe(true);
            expect(state.bannerText).toContain('could not be loaded');
            expect({ ranAnalysis: state.ranAnalysis, disease: state.diseaseResult, trajectory: state.trajectory })
                .toEqual({ ranAnalysis: false, disease: false, trajectory: false });
        }, 300000);

        test('S4b. /reports/forensic: the analysis does not run on the legacy form defaults', async () => {
            const state = await failureStateFor('/reports/forensic', 'S4b', null);

            expect(state.failed).toBe(true);
            expect(state.banner).toBe(true);
            expect({ ranAnalysis: state.ranAnalysis, disease: state.diseaseResult, trajectory: state.trajectory })
                .toEqual({ ranAnalysis: false, disease: false, trajectory: false });
        }, 300000);

        test('S6. after a tour of every page, the browser holds no copy of any site config', async () => {
            // GH-442 (GH-439 stage 3). The key is planted first, as a browser
            // upgrading from an older version would carry it: the page has to
            // delete it, not merely stop writing it.
            const ctx = await browser.newContext();
            const p = await ctx.newPage();
            p.on('dialog', (d) => d.accept());
            attachWriteLog(p);
            await login(p);

            await p.goto(BASE_URL + '/settings', { waitUntil: 'domcontentloaded' });
            await p.evaluate((id) => {
                localStorage.setItem('gilba_hub_site_configs', JSON.stringify({
                    [id]: { turf: { species: 'Left over from an older version' }, savedAt: '2026-01-01T00:00:00.000Z' },
                }));
                localStorage.setItem('gilba_gaip_gilba_hub_site_configs', JSON.stringify({
                    [id]: { turf: { species: 'Namespaced leftover' } },
                }));
            }, scratchSiteId);

            const planted = await p.evaluate(() => ({
                bare: localStorage.getItem('gilba_hub_site_configs'),
                namespaced: localStorage.getItem('gilba_gaip_gilba_hub_site_configs'),
            }));
            expect(planted.bare).not.toBeNull();

            const pages = ['/hub', '/reports/export', '/reports/forensic', '/reports/scenarios',
                '/morning-briefing', '/analysis', '/plan', '/field-log'];
            for (const url of pages) {
                const response = await p.goto(BASE_URL + url, { waitUntil: 'domcontentloaded' });
                await assertPageRendered(p, response, 'S6 ' + url);
                await p.waitForTimeout(4000);
            }
            await p.waitForTimeout(4000);

            const after = await p.evaluate(() => {
                const keys = [];
                for (let i = 0; i < localStorage.length; i++) {
                    const key = localStorage.key(i);
                    if (/gilba_hub_site_configs/.test(key)) keys.push(key);
                }
                return {
                    bare: localStorage.getItem('gilba_hub_site_configs'),
                    namespaced: localStorage.getItem('gilba_gaip_gilba_hub_site_configs'),
                    anyMatching: keys,
                };
            });
            await ctx.close();

            out('S6 site-config keys left in localStorage: ' + JSON.stringify(after.anyMatching));
            expect(after.bare).toBeNull();
            expect(after.namespaced).toBeNull();
            expect(after.anyMatching).toEqual([]);
        }, 300000);

        test('S7. /morning-briefing names the real active site, on a healthy load', async () => {
            // GH-444: the page used to build its card list out of sample
            // snapshots in localStorage, which this page never writes -- so a
            // client with a configured site saw "My Site / Species not set"
            // while /field-log, same login, showed the real one.
            await setActive(page, scratchSiteId);
            seedConfig(scratchSiteId, baseConfig('ammonium_acetate'));

            const ctx = await browser.newContext();
            const p = await ctx.newPage();
            p.on('dialog', (d) => d.accept());
            await login(p);
            const response = await p.goto(BASE_URL + '/morning-briefing', { waitUntil: 'domcontentloaded' });
            await assertPageRendered(p, response, 'S7 /morning-briefing');
            await p.waitForTimeout(12000);

            const shown = await p.evaluate(() => {
                const root = document.getElementById('gaip-morning-briefing');
                const text = root ? root.textContent.replace(/\s+/g, ' ').trim() : '';
                const active = document.querySelector('#gaip-morning-briefing [id^="gaip-brief-card-"]');
                return { text: text, firstCard: active ? active.textContent.replace(/\s+/g, ' ').trim().slice(0, 120) : null };
            });
            const shot = (process.env.GILBA_E2E_SHOTS || '/tmp') + '/gh444-morning-briefing-healthy.png';
            await p.screenshot({ path: shot, fullPage: false });
            await ctx.close();

            out('S7 briefing text: ' + shown.text.slice(0, 260));
            out('S7 first card: ' + shown.firstCard);
            out('S7 screenshot: ' + shot);

            expect(shown.text).toContain(SCRATCH_NAME);
            expect(shown.text).not.toContain('My Site');
            expect(shown.text).not.toContain('Species not set');
        }, 300000);

        test('S8. an ordinary load of /reports/export and /plan writes nothing', async () => {
            // GH-444, and the measurement the owner asked for: NO artificial
            // delay anywhere in this scenario. S2 opens the same pages behind a
            // 7 s stall on GET /api/sites, which is a window the programme
            // chain does not finish inside -- it measured the window, not the
            // product. This one generates a real programme first (a person
            // pressing Generate, which SHOULD write), then loads the pages as a
            // person does and asserts that loading writes nothing.
            await setActive(page, scratchSiteId);
            seedConfig(scratchSiteId, baseConfig('ammonium_acetate'));

            await page.goto(BASE_URL + '/plan', { waitUntil: 'domcontentloaded' });
            const genFrom = writes.length;
            await generateOnPlan(page);
            writesSince(genFrom, /\/config\/gaip/).forEach((w) => {
                let keys = '?';
                try { keys = Object.keys(JSON.parse(w.body || '{}').patch || {}).join('|'); } catch (e) { /* printed as ? */ }
                // The site id is printed too: an earlier run of this scenario
                // found no calendar in the database afterwards, and "which
                // site did it go to" is the first thing worth knowing if that
                // recurs.
                out('S8 Generate sent: ' + keys + ' to ' + w.url);
            });

            // Generate fires two writes of one chain (the calendar, then the
            // product programme); wait for the database to hold both rather
            // than racing the second one.
            let stored = gaipConfig(scratchSiteId);
            const timeline = [];
            for (let i = 0; i < 20; i++) {
                timeline.push((stored.nutritionCalendarProgram ? 'C' : '-') + (stored.nutritionProgram ? 'P' : '-'));
                if (stored.nutritionCalendarProgram && stored.nutritionProgram) break;
                await page.waitForTimeout(1000);
                stored = gaipConfig(scratchSiteId);
            }
            out('S8 calendar/programme in the database, once a second: ' + timeline.join(' '));
            out('S8 programme stored by Generate: calendar=' + !!stored.nutritionCalendarProgram
                + ' programme=' + !!stored.nutritionProgram + ' savedAt=' + stored.savedAt);
            out('S8 site row: ' + JSON.stringify(siteRow(scratchSiteId))
                + ' stamp=' + JSON.stringify(stored.nutritionProgramCoords)
                + ' config keys=' + Object.keys(stored).join('|'));
            expect(stored.nutritionCalendarProgram).toBeTruthy();

            const savedAtBefore = sql("SELECT site_id, IFNULL(JSON_UNQUOTE(JSON_EXTRACT(config,'$.savedAt')),'-') "
                + "FROM site_configs WHERE namespace = 'gaip';");

            const ctx = await browser.newContext();
            const p = await ctx.newPage();
            p.on('dialog', (d) => d.accept());
            attachWriteLog(p);

            // What started any write, in the page's own words.
            const trail = [];
            p.on('console', (msg) => {
                const t = msg.text();
                if (/restoring panel from persisted|restored programme|persist-debug: PATCH|Dispatching gaip:nutrition-calendar-generated/i.test(t)) {
                    trail.push(t.slice(0, 150));
                }
            });

            await login(p);
            const from = writes.length;

            for (const url of ['/reports/export', '/plan']) {
                const response = await p.goto(BASE_URL + url, { waitUntil: 'networkidle' });
                await assertPageRendered(p, response, 'S8 ' + url);
                await p.waitForTimeout(15000);
            }

            const siteWrites = writesSince(from, /\/api\/sites/)
                .filter((w) => !/\/api\/active-site/.test(w.url));
            await ctx.close();

            siteWrites.forEach((w) => out('S8 write on load: ' + summarise(w)));
            trail.slice(0, 10).forEach((t) => out('S8 trail: ' + t));

            const savedAtAfter = sql("SELECT site_id, IFNULL(JSON_UNQUOTE(JSON_EXTRACT(config,'$.savedAt')),'-') "
                + "FROM site_configs WHERE namespace = 'gaip';");

            expect(siteWrites).toEqual([]);
            expect(savedAtAfter).toEqual(savedAtBefore);
        }, 420000);

        test('S9. concurrent patches all land — none is lost to a read-merge-write race', async () => {
            // GH-442 (review): Generate sends three patches within the same
            // second, and in a failing run the first one vanished whole --
            // calendar AND the maxNPerMonth that travelled with it -- while
            // all three answered 200. patchConfig() reads the config, merges
            // in PHP and writes the whole column back, so two requests that
            // overlap each read the row before the other has written it, and
            // the last writer wins with a merge built on stale content.
            //
            // This sends six patches of six different keys at once. Every one
            // must be in the row afterwards; a lost patch is a change the user
            // made, acknowledged with a 200, and silently discarded.
            seedConfig(scratchSiteId, baseConfig('ammonium_acetate'));

            const sent = await page.evaluate(async ({ siteId }) => {
                const token = document.querySelector('meta[name=csrf-token]');
                const patches = [
                    { turf: { hoc: 11 } },
                    { maxNPerMonth: 31 },
                    { appliedMonthlyN: 13 },
                    { nzDistributor: 'prebble' },
                    { multiSiteTurf: true },
                    { alertQuietHours: false },
                ];
                const results = await Promise.all(patches.map((patch) =>
                    fetch('/api/sites/' + siteId + '/config/gaip', {
                        method: 'PATCH',
                        credentials: 'same-origin',
                        headers: Object.assign(
                            { 'Content-Type': 'application/json', Accept: 'application/json' },
                            token ? { 'X-CSRF-TOKEN': token.getAttribute('content') } : {}),
                        body: JSON.stringify({ patch }),
                    }).then((r) => r.status)));
                return results;
            }, { siteId: scratchSiteId });

            out('S9 response statuses: ' + JSON.stringify(sent));
            expect(sent.every((status) => status === 200)).toBe(true);

            const stored = gaipConfig(scratchSiteId);
            const landed = {
                'turf.hoc': stored.turf && stored.turf.hoc,
                maxNPerMonth: stored.maxNPerMonth,
                appliedMonthlyN: stored.appliedMonthlyN,
                nzDistributor: stored.nzDistributor,
                multiSiteTurf: stored.multiSiteTurf,
                alertQuietHours: stored.alertQuietHours,
            };
            out('S9 in the database afterwards: ' + JSON.stringify(landed));

            expect(landed).toEqual({
                'turf.hoc': 11,
                maxNPerMonth: 31,
                appliedMonthlyN: 13,
                nzDistributor: 'prebble',
                multiSiteTurf: true,
                alertQuietHours: false,
            });

            // And the site's own settings are untouched by any of them.
            expect(stored.turf.species).toBe('Perennial Ryegrass');
            expect(stored.turf.methodology).toBe('ammonium_acetate');
        }, 120000);

        test('S10. the Settings pair — PATCH /sites/{id} and PATCH config together — loses neither', async () => {
            // GH-442 (review): the other read-modify-write on this row.
            // Settings saves its Site form with Promise.all of exactly these
            // two requests, so they arrive together by design: one updates the
            // site row and clears the cached programme, the other merges a
            // config patch. Both read the config, both write it back.
            seedConfig(scratchSiteId, Object.assign(baseConfig('ammonium_acetate'), {
                nutritionProgram: { products: ['stale'] },
                nutritionCalendarProgram: { months: { jan: 1 }, meta: { lat: AUCKLAND.lat, lon: AUCKLAND.lon } },
                nutritionProgramCoords: { lat: AUCKLAND.lat, lon: AUCKLAND.lon },
                traffic: { schedule: { mon: 4 } },
            }));

            const statuses = await page.evaluate(async ({ siteId }) => {
                const token = document.querySelector('meta[name=csrf-token]');
                const headers = Object.assign(
                    { 'Content-Type': 'application/json', Accept: 'application/json' },
                    token ? { 'X-CSRF-TOKEN': token.getAttribute('content') } : {});
                const [siteRes, configRes] = await Promise.all([
                    // Moving the site: this clears the cached programme.
                    fetch('/api/sites/' + siteId, {
                        method: 'PATCH', credentials: 'same-origin', headers,
                        body: JSON.stringify({ latitude: -33.8688, longitude: 151.2093, location_name: 'Sydney' }),
                    }),
                    // And the same save's config patch, in flight at the same moment.
                    fetch('/api/sites/' + siteId + '/config/gaip', {
                        method: 'PATCH', credentials: 'same-origin', headers,
                        body: JSON.stringify({ patch: { irrigation: { method: 'pop-up', efficiency: 80 } } }),
                    }),
                ]);
                return [siteRes.status, configRes.status];
            }, { siteId: scratchSiteId });

            out('S10 statuses: ' + JSON.stringify(statuses));
            expect(statuses).toEqual([200, 200]);

            const stored = gaipConfig(scratchSiteId);
            out('S10 stored keys: ' + Object.keys(stored).join('|')
                + ' irrigation=' + JSON.stringify(stored.irrigation));

            // The config patch must be there...
            expect(stored.irrigation).toEqual({ method: 'pop-up', efficiency: 80 });
            // ...the move must still have cleared the programme computed for
            // the old location (GH-371)...
            expect(stored.nutritionProgram).toBeUndefined();
            expect(stored.nutritionCalendarProgram).toBeUndefined();
            // ...and nothing either request never mentioned may be lost.
            expect(stored.traffic).toEqual({ schedule: { mon: 4 } });
            expect(stored.turf.species).toBe('Perennial Ryegrass');

            // Put the site back where the rest of the file expects it.
            await api(page, 'PATCH', '/api/sites/' + scratchSiteId, {
                latitude: AUCKLAND.lat, longitude: AUCKLAND.lon, location_name: AUCKLAND.name,
            });
        }, 120000);

        test('S11. no emoji on the two client-facing pages', async () => {
            // GH-445: the project rule is inline SVG in the style of the
            // neighbouring pages, or nothing -- never emoji. /field-log used
            // them for its five type tabs and its recent-entry list;
            // /morning-briefing used them for its action rows.
            const EMOJI = /[\u{1F300}-\u{1FAFF}\u{2600}-\u{27BF}\u{FE0F}]/u;

            const ctx = await browser.newContext();
            const p = await ctx.newPage();
            p.on('dialog', (d) => d.accept());
            await login(p);

            const seen = {};
            for (const [name, url] of [['field-log', '/field-log'], ['briefing', '/morning-briefing']]) {
                const response = await p.goto(BASE_URL + url, { waitUntil: 'domcontentloaded' });
                await assertPageRendered(p, response, 'S11 ' + url);
                await p.waitForTimeout(8000);
                const state = await p.evaluate(() => ({
                    text: (document.body.innerText || '').slice(0, 4000),
                    svgCount: document.querySelectorAll('svg').length,
                }));
                seen[name] = state;
                await p.screenshot({ path: (process.env.GILBA_E2E_SHOTS || '/tmp') + '/gh445-' + name + '.png' });
                out('S11 ' + name + ': svg=' + state.svgCount
                    + ' emoji=' + (state.text.match(EMOJI) || []).join(''));
            }
            await ctx.close();

            expect(EMOJI.test(seen['field-log'].text)).toBe(false);
            expect(EMOJI.test(seen.briefing.text)).toBe(false);
            // And the icons were replaced, not merely deleted.
            expect(seen['field-log'].svgCount).toBeGreaterThan(0);
        }, 180000);

        // GH-451 (GH-439 stage 4b): the same three questions asked twice --
        // in a browser that has already opened a hub page (so
        // gilba_turf_profiles is full, which used to suppress the overlay
        // everywhere) and in a clean context. The two runs must agree; that
        // agreement IS the proof that localStorage no longer takes part.
        //
        // Neither run stalls anything: both are ordinary loads.
        async function wizardOverlayFor(label, wizardRecord, warmBrowser) {
            if (wizardRecord === null) {
                sql("UPDATE site_configs SET config = JSON_REMOVE(config, '$.wizard') "
                    + "WHERE site_id = '" + scratchSiteId + "' AND namespace = 'gaip';");
            } else {
                sql("UPDATE site_configs SET config = JSON_SET(config, '$.wizard', CAST('"
                    + JSON.stringify(wizardRecord).replace(/'/g, "\\'") + "' AS JSON)) "
                    + "WHERE site_id = '" + scratchSiteId + "' AND namespace = 'gaip';");
            }

            const ctx = await browser.newContext();
            const p = await ctx.newPage();
            p.on('dialog', (d) => d.accept());
            await login(p);

            if (warmBrowser) {
                // An ordinary browser: one hub page visit is all it takes for
                // turf-profile-controller.js to fill gilba_turf_profiles.
                // /reports/export writes gilba_turf_profiles (it loads
                // turf-profile-controller.js) and never shows this wizard
                // itself, so it warms the browser exactly the way an ordinary
                // session does.
                const warm = await p.goto(BASE_URL + '/reports/export', { waitUntil: 'domcontentloaded' });
                await assertPageRendered(p, warm, label + ' /reports/export (warm-up)');
                await p.waitForTimeout(10000);
                const profiles = await p.evaluate(() => {
                    try { return (localStorage.getItem('gilba_turf_profiles') || '').slice(0, 40); }
                    catch (e) { return 'unreadable'; }
                });
                out(label + ' profiles in this browser: ' + (profiles || '(none)'));
                // The whole point of this half of the pair: the browser must
                // actually hold profiles, or it is not testing anything the
                // clean run does not.
                expect(profiles).toMatch(/__site__/);
            }

            // /hub, and only /hub. Four views load site-setup-wizard.js --
            // hub, reports/export, reports/forensic, reports/scenarios -- and
            // three of those are db-shell pages, where initWhenReady() returns
            // on its first line. /morning-briefing and /stadium do not load it
            // at all, in any layout. So /hub is the single page where this
            // gate executes, and the only place its behaviour can be observed.
            const response = await p.goto(BASE_URL + '/hub', { waitUntil: 'domcontentloaded' });
            await assertPageRendered(p, response, label + ' /hub');
            await p.waitForTimeout(12000);

            const state = await p.evaluate(() => {
                const overlay = document.getElementById('gaip-wizard-overlay');
                return {
                    overlay: !!overlay && overlay.style.display !== 'none',
                    injected: !!(window.GAIP_WIZARD_CONFIG || {}).wizardComplete,
                };
            });
            await ctx.close();
            out(label + ': ' + JSON.stringify(state));
            return state;
        }

        test('S5b. the wizard follows the database in an ordinary browser', async () => {
            const noRecord = await wizardOverlayFor('S5b/ordinary, no record', null, true);
            const skipped = await wizardOverlayFor('S5b/ordinary, skipped', { skipped: true }, true);
            const complete = await wizardOverlayFor('S5b/ordinary, complete',
                { complete: true, completedAt: '2026-09-01T00:00:00.000Z', version: '1.0' }, true);

            // No record in the database: the overlay appears, even though this
            // browser is full of turf profiles. Before stage 4b those profiles
            // suppressed it and this assertion was red.
            expect(noRecord).toEqual({ overlay: true, injected: false });
            // Deliberately skipped counts as answered (GH-450).
            expect(skipped).toEqual({ overlay: false, injected: true });
            expect(complete).toEqual({ overlay: false, injected: true });
        }, 600000);

        test('S5b. the wizard follows the database in a clean context, identically', async () => {
            const noRecord = await wizardOverlayFor('S5b/clean, no record', null, false);
            const skipped = await wizardOverlayFor('S5b/clean, skipped', { skipped: true }, false);
            const complete = await wizardOverlayFor('S5b/clean, complete',
                { complete: true, completedAt: '2026-09-01T00:00:00.000Z', version: '1.0' }, false);

            expect(noRecord).toEqual({ overlay: true, injected: false });
            expect(skipped).toEqual({ overlay: false, injected: true });
            expect(complete).toEqual({ overlay: false, injected: true });

            // Put the site back the way the rest of the file expects it.
            seedConfig(scratchSiteId, baseConfig('ammonium_acetate'));
        }, 600000);

        test('S5. the setup wizard on Reports follows the database, not this browser', async () => {
            // The wizard used to decide from localStorage on every page except
            // /hub, so a clean browser showed it on a site that had completed
            // it — and completing it again wrote a fresh config over the real
            // one. The wizard record now travels with the page.
            const full = baseConfig('ammonium_acetate');
            full.wizard = { complete: true, completedAt: '2026-09-01T00:00:00.000Z', version: '1.0' };
            await putConfig(page, full);

            async function wizardVisibleOnCleanBrowser() {
                const ctx = await browser.newContext();
                const p = await ctx.newPage();
                p.on('dialog', (d) => d.accept());
                await login(p);
                await p.goto(BASE_URL + '/reports/export', { waitUntil: 'domcontentloaded' });
                await p.waitForTimeout(12000);
                const state = await p.evaluate(() => {
                    const overlay = document.getElementById('gaip-wizard-overlay');
                    let profiles = null;
                    try { profiles = localStorage.getItem('gilba_turf_profiles'); } catch (e) { profiles = 'unreadable'; }
                    return {
                        overlay: !!overlay && overlay.style.display !== 'none',
                        injectedComplete: !!(window.GAIP_WIZARD_CONFIG || {}).wizardComplete,
                        // The other gates site-setup-wizard.js checks before it
                        // decides to show itself.
                        gates: {
                            wizardModulePresent: !!window.GaipSetupWizard || !!window.GAIP_SetupWizard,
                            legacyFlag: (function () {
                                try { return localStorage.getItem('gilba_wizard_complete'); } catch (e) { return 'unreadable'; }
                            })(),
                            turfProfiles: profiles ? profiles.slice(0, 60) : null,
                            hasTurfTypeInput: !!document.querySelector('.gaip-turf-type'),
                        },
                    };
                });
                await ctx.close();
                return state;
            }

            const withWizard = await wizardVisibleOnCleanBrowser();
            out('S5 with wizard in the database: ' + JSON.stringify(withWizard));
            expect(withWizard.injectedComplete).toBe(true);
            expect(withWizard.overlay).toBe(false);

            // With the record gone, the injected flag follows the database.
            // Whether the overlay then APPEARS is a separate question, and the
            // measurement below is deliberately printed rather than asserted:
            // see the note under it.
            sql("UPDATE site_configs SET config = JSON_REMOVE(config, '$.wizard') "
                + "WHERE site_id = '" + scratchSiteId + "' AND namespace = 'gaip';");
            const withoutWizard = await wizardVisibleOnCleanBrowser();
            out('S5 without wizard in the database: ' + JSON.stringify(withoutWizard));
            expect(withoutWizard.injectedComplete).toBe(false);

            // MEASURED, NOT ASSERTED (GH-441 review): on /reports/export the
            // overlay does not appear even with no wizard record at all. The
            // injected flag is now correct in both directions -- which is what
            // this stage was asked to fix and what the two assertions above
            // cover -- but something further down still holds the overlay
            // back. Changing that would change what stage 4's wizard repair is
            // expected to achieve, so it is reported, not altered.
            out('S5 overlay without wizard record: ' + withoutWizard.overlay
                + ' (expected true by the stage-4 plan; measured false)');
            out('S5 what else the wizard consults: ' + JSON.stringify(withoutWizard.gates));
        }, 300000);

        test('F. POST /api/sites/sync is not answered at all, and creates nothing', async () => {
            // Through stages 0-2 this endpoint answered and refused to do harm:
            // it stopped writing names, stopped creating sites, and counted an
            // unknown ID as `saved: 0`. GH-442 withdraws the route. The path
            // still matches GET /api/sites/{site}, so a POST to it is refused
            // as a method rather than as a path -- either way nothing reads
            // this payload.
            const before = siteRow(UNKNOWN_ID);
            const r = await api(page, 'POST', '/api/sites/sync', { sites: { [UNKNOWN_ID]: { label: '' } } });
            out('F response: ' + JSON.stringify(r).slice(0, 200));

            expect(before).toBeNull();
            expect(siteRow(UNKNOWN_ID)).toBeNull();
            expect([404, 405]).toContain(r.status);
        }, 60000);

        test('F2. and an existing site cannot be renamed through it', async () => {
            const before = siteRow(scratchSiteId);
            const r = await api(page, 'POST', '/api/sites/sync',
                { sites: { [scratchSiteId]: { label: 'Renamed by the registry' } } });
            const after = siteRow(scratchSiteId);
            out('F2 status=' + r.status + ' name before=' + before.name + ' after=' + after.name);

            expect(after.name).toBe(SCRATCH_NAME);
            expect([404, 405]).toContain(r.status);
        }, 60000);

    });
}

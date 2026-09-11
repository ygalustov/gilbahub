/**
 * GH-430 live check — POST /api/samples/sync must not delete a sample merely
 * because it was absent from the browser's push.
 *
 * The defect, reproduced on this stack before the fix: the endpoint treated the
 * payload as "here is my complete picture, make the database match" and
 * soft-deleted every sample of that (site, sample_type) the push did not name.
 * The push is never the complete picture — samples restored from the server
 * carry `values`, and sync() reads only `rawData`, so a tab that has just added
 * one sample sends a keep-list of exactly one. One ordinary add wiped a site.
 *
 * This test works on its own scratch site, so the reproduction destroys nothing
 * that belongs to anybody: it creates the site, seeds samples through
 * POST /api/samples, drives a real browser through the real hub, and removes
 * both the site and its rows at the end. It asserts against the `samples` table
 * directly (docker exec) because soft-deleted rows are invisible to the API, and
 * "nothing was deleted" is exactly a statement about those rows.
 *
 * Four paths reach the same endpoint and are all checked: the page-load push,
 * Capture ("Save as Sample"), an edit of a restored sample, and a CSV lab
 * import. It also pins that a row already soft-deleted is not resurrected, and
 * that no sample outside the scratch site changes state at all.
 *
 * Note while this is the state of things: hub-side deletion of a sample is
 * INERT. It used to reach the database only through this same mechanism (the
 * sample went missing from the next push), so with the mechanism gone a deleted
 * sample comes back on reload. That is deliberate — better not-deleted than
 * over-deleted — until per-record writes land.
 *
 * Run: npm run test:e2e:samples
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

const SCRATCH_NAME = 'GH-430 sync scratch';
const SEED_UIDS = ['gh430_a', 'gh430_b', 'gh430_c', 'gh430_d', 'gh430_e', 'gh430_f'];
const PRE_TRASHED_UID = 'gh430_already_deleted';
const CAPTURE_NAME = 'GH430 Capture';
const IMPORT_UIDS = ['GH430 Import 1', 'GH430 Import 2'];

let chromium = null;
try { ({ chromium } = require('playwright')); } catch (e) { /* reported below */ }

function sql(query) {
    const out = execFileSync('docker', [
        'exec', 'gilba_mysql', 'mysql', '-ugilba', '-pgilba_secret', 'gilba',
        '--batch', '--skip-column-names', '-e', query,
    ], { encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] });
    return out.trim().split('\n').filter(Boolean).map((line) => line.split('\t'));
}

// id -> deleted_at for every sample that is not ours, so "we changed nothing
// else" is a comparison of rows and not of a total that could cancel out.
function corpusState(excludeSiteId) {
    const rows = sql("SELECT id, IFNULL(deleted_at,'-') FROM samples WHERE site_id <> '"
        + excludeSiteId + "' ORDER BY id;");
    const map = {};
    rows.forEach(([id, del]) => { map[id] = del; });
    return map;
}

function siteCounts(siteId) {
    const [row] = sql("SELECT COUNT(*), SUM(deleted_at IS NULL), SUM(deleted_at IS NOT NULL) "
        + "FROM samples WHERE site_id = '" + siteId + "';");
    return { total: Number(row[0]), live: Number(row[1] || 0), trashed: Number(row[2] || 0) };
}

function liveUids(siteId) {
    return sql("SELECT client_uid FROM samples WHERE site_id = '" + siteId
        + "' AND deleted_at IS NULL ORDER BY client_uid;").map((r) => r[0]);
}

if (!ENABLED) {
    process.stdout.write('[e2e] gh430-samples-sync-no-snapshot-delete-live skipped (needs the live stack) — npm run test:e2e:samples\n');
    test.skip('GH-430 live gate (disabled)', () => {});
} else {
    describe('GH-430 — a push that omits a sample must not delete it', () => {
        let browser, page;
        let scratchSiteId = null;
        let previousActiveSiteId = null;
        let corpusBefore = null;
        let totalsBefore = null;

        const syncCalls = [];

        async function api(method, url, body) {
            return page.evaluate(async ({ method, url, body }) => {
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

        // Runs `action`, then waits for at least one new POST /api/samples/sync
        // and returns every sync response that action produced.
        async function syncsCausedBy(label, action) {
            const from = syncCalls.length;
            await action();
            const deadline = Date.now() + 30000;
            while (Date.now() < deadline && syncCalls.length === from) {
                await page.waitForTimeout(250);
            }
            await page.waitForTimeout(2000); // let a follow-up push, if any, land too
            const produced = syncCalls.slice(from);
            process.stdout.write('[gh430] ' + label + ' -> ' + (produced.length
                ? produced.map((c) => JSON.stringify(c.body)).join(' , ')
                : 'NO SYNC OBSERVED') + '\n');
            return produced;
        }

        beforeAll(async () => {
            if (!chromium) throw new Error('playwright does not resolve from the repo — run `npm install`');
            if (!EMAIL || !PASSWORD) throw new Error('no credentials — see tests/e2e/.e2e-credentials.example.json');

            const [t] = sql('SELECT COUNT(*), SUM(deleted_at IS NOT NULL) FROM samples;');
            totalsBefore = { total: Number(t[0]), trashed: Number(t[1] || 0) };
            process.stdout.write('[gh430] samples table before: total ' + totalsBefore.total
                + ', soft-deleted ' + totalsBefore.trashed + '\n');

            browser = await chromium.launch();
            page = await browser.newPage();
            page.on('dialog', (d) => d.accept(CAPTURE_NAME)); // nothing should prompt; do not hang if it does
            page.on('response', async (res) => {
                if (!/\/api\/samples\/sync$/.test(res.url())) return;
                let body = null;
                try { body = await res.json(); } catch (e) { body = null; }
                syncCalls.push({ status: res.status(), body: body && body.data ? body.data : body });
            });

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
            previousActiveSiteId = sites.json.active_site_id;

            const created = await api('POST', '/api/sites', {
                name: SCRATCH_NAME,
                location_name: 'Sydney, NSW',
                latitude: -33.8688,
                longitude: 151.2093,
                timezone: 'Australia/Sydney',
            });
            if (created.status !== 201) throw new Error('could not create the scratch site: ' + JSON.stringify(created));
            scratchSiteId = created.json.data.id;
            process.stdout.write('[gh430] scratch site ' + scratchSiteId + '\n');

            const seed = SEED_UIDS.concat([PRE_TRASHED_UID]);
            for (let i = 0; i < seed.length; i++) {
                const day = String(10 + i).padStart(2, '0');
                const res = await api('POST', '/api/samples', {
                    site_id: scratchSiteId,
                    sample_type: 'soil',
                    client_uid: seed[i],
                    sample_date: '2026-03-' + day,
                    lab_date: '2026-03-' + day,
                    payload: {
                        _label: 'GH430 ' + seed[i],
                        _zone: 'green',
                        zone: 'Greens',
                        pH: 6.4 + i / 10,
                        K: 40 + i,
                        P: 30 + i,
                        Ca: 900 + i,
                        Mg: 120 + i,
                        CEC: 8 + i,
                        OM: 3 + i / 10,
                    },
                    notes: 'GH-430 seed',
                });
                if (res.status !== 201) throw new Error('seed failed: ' + JSON.stringify(res));
            }

            // One row is soft-deleted up front: nothing in this run may bring it back.
            sql("UPDATE samples SET deleted_at = NOW() WHERE site_id = '" + scratchSiteId
                + "' AND client_uid = '" + PRE_TRASHED_UID + "';");

            corpusBefore = corpusState(scratchSiteId);
            process.stdout.write('[gh430] seeded; scratch counts ' + JSON.stringify(siteCounts(scratchSiteId))
                + ', rows elsewhere ' + Object.keys(corpusBefore).length + '\n');

            await api('PATCH', '/api/active-site', { site_id: scratchSiteId });
        }, 300000);

        afterAll(async () => {
            if (page && previousActiveSiteId) {
                await api('PATCH', '/api/active-site', { site_id: previousActiveSiteId }).catch(() => {});
            }
            if (browser) await browser.close();
            if (scratchSiteId) {
                sql("DELETE FROM site_summaries WHERE site_id = '" + scratchSiteId + "';");
                sql("DELETE FROM samples WHERE site_id = '" + scratchSiteId + "';");
                sql("DELETE FROM site_configs WHERE site_id = '" + scratchSiteId + "';");
                sql("DELETE FROM site_user WHERE site_id = '" + scratchSiteId + "';");
                sql("DELETE FROM sites WHERE id = '" + scratchSiteId + "';");
                const [t] = sql('SELECT COUNT(*), SUM(deleted_at IS NOT NULL) FROM samples;');
                process.stdout.write('[gh430] samples table after cleanup: total ' + t[0]
                    + ', soft-deleted ' + (t[1] || 0) + '\n');
            }
        }, 300000);

        test('the scratch site really starts with several live samples', () => {
            const counts = siteCounts(scratchSiteId);
            process.stdout.write('[gh430] precondition: ' + JSON.stringify(counts)
                + ' live uids ' + JSON.stringify(liveUids(scratchSiteId)) + '\n');
            expect(counts.live).toBe(SEED_UIDS.length);
            expect(counts.trashed).toBe(1);
        });

        test('the hub restores them values-shaped, and the page-load push deletes nothing', async () => {
            await page.goto(BASE_URL + '/reports/export', { waitUntil: 'domcontentloaded' });
            await page.waitForFunction(() => !!(window.GAIP_SampleManager && window._gaipSamplePersistenceReady),
                null, { timeout: 60000 });
            await page.waitForTimeout(5000);

            const store = await page.evaluate((siteId) => {
                const snap = window.GAIP_SampleManager.getAllSamples();
                const soil = (snap.allSites[siteId] || {}).soil || {};
                return Object.keys(soil).map((k) => ({
                    key: k,
                    hasRawData: !!(soil[k] && soil[k].rawData && Object.keys(soil[k].rawData).length),
                    hasValues: !!(soil[k] && soil[k].values && Object.keys(soil[k].values).length),
                }));
            }, scratchSiteId);
            process.stdout.write('[gh430] restored into the tab: ' + JSON.stringify(store) + '\n');
            process.stdout.write('[gh430] page-load syncs: ' + JSON.stringify(syncCalls) + '\n');

            // The premise of the whole defect: what the tab holds is not what it
            // can push, because these carry `values` and sync() reads `rawData`.
            expect(store).toHaveLength(SEED_UIDS.length);
            expect(store.every((s) => s.hasValues && !s.hasRawData)).toBe(true);

            expect(siteCounts(scratchSiteId)).toEqual({ total: SEED_UIDS.length + 1, live: SEED_UIDS.length, trashed: 1 });
        }, 300000);

        // The hub form and its sample switcher are present on this page but sit
        // inside #rp-hub-runner, which is display:none — the db-shell pages run
        // the hub headless. So Capture and the edit are driven by calling the
        // very functions the two buttons' click handlers call
        // (sample-switcher-ui.js: saveBtn.onclick -> captureFromForm,
        // .gaip-sample-update-btn -> captureRawForm + updateSample), with the
        // form filled through real input/change events first. The CSV import
        // below is driven by putting a file on the hub's own file input, which
        // is the whole of what that button does.
        test('Capture — Save as Sample adds one and destroys none', async () => {
            const produced = await syncsCausedBy('capture', async () => {
                const filled = await page.evaluate((name) => {
                    const set = (sel, v) => {
                        const el = document.querySelector(sel);
                        if (!el) return null;
                        el.value = v;
                        el.dispatchEvent(new Event('input', { bubbles: true }));
                        el.dispatchEvent(new Event('change', { bubbles: true }));
                        return v;
                    };
                    set('.gaip-soil-date', '2026-05-05');
                    set('.gaip-soil-ph', '6.8');
                    set('.gaip-cec', '11');
                    const mlsn = Array.from(document.querySelectorAll('[data-mlsn]')).slice(0, 4);
                    mlsn.forEach((el, i) => {
                        el.value = String(30 + i * 7);
                        el.dispatchEvent(new Event('input', { bubbles: true }));
                        el.dispatchEvent(new Event('change', { bubbles: true }));
                    });
                    const sample = window.GAIP_SampleManager.captureFromForm('soil', name);
                    return { mlsn: mlsn.map((el) => el.dataset.mlsn), id: sample.id, raw: Object.keys(sample.rawData) };
                }, CAPTURE_NAME);
                process.stdout.write('[gh430] captured: ' + JSON.stringify(filled) + '\n');
            });

            expect(produced.length).toBeGreaterThan(0);
            produced.forEach((c) => expect(c.body.deleted).toBe(0));

            const uids = liveUids(scratchSiteId);
            process.stdout.write('[gh430] live uids after capture: ' + JSON.stringify(uids) + '\n');
            SEED_UIDS.forEach((uid) => expect(uids).toContain(uid));
            expect(uids).toContain(CAPTURE_NAME);
            expect(siteCounts(scratchSiteId).live).toBe(SEED_UIDS.length + 1);
        }, 300000);

        test('an edit of a restored sample destroys none', async () => {
            const produced = await syncsCausedBy('edit', async () => {
                const edited = await page.evaluate((uid) => {
                    const SM = window.GAIP_SampleManager;
                    SM.loadSample('soil', uid);
                    const ph = document.querySelector('.gaip-soil-ph');
                    ph.value = '7.1';
                    ph.dispatchEvent(new Event('input', { bubbles: true }));
                    ph.dispatchEvent(new Event('change', { bubbles: true }));
                    const values = SM.captureRawForm ? SM.captureRawForm('soil') : null;
                    SM.updateSample('soil', uid, values);
                    return { uid, keys: values ? Object.keys(values).length : 0 };
                }, SEED_UIDS[0]);
                process.stdout.write('[gh430] edited: ' + JSON.stringify(edited) + '\n');
            });

            expect(produced.length).toBeGreaterThan(0);
            produced.forEach((c) => expect(c.body.deleted).toBe(0));

            const uids = liveUids(scratchSiteId);
            process.stdout.write('[gh430] live uids after edit: ' + JSON.stringify(uids) + '\n');
            SEED_UIDS.forEach((uid) => expect(uids).toContain(uid));
            expect(siteCounts(scratchSiteId).live).toBe(SEED_UIDS.length + 1);
        }, 300000);

        test('a CSV lab import adds its rows and destroys none', async () => {
            const csv = 'Sample ID,Date,pH,CEC,K,P\n'
                + IMPORT_UIDS[0] + ',2026-04-01,6.2,9,45,31\n'
                + IMPORT_UIDS[1] + ',2026-04-02,6.5,10,48,33\n';
            const produced = await syncsCausedBy('import', async () => {
                await page.setInputFiles('.gaip-sample-switcher[data-type="soil"] .gaip-sample-file-input', {
                    name: 'gh430-lab.csv',
                    mimeType: 'text/csv',
                    buffer: Buffer.from(csv, 'utf8'),
                });
            });

            expect(produced.length).toBeGreaterThan(0);
            produced.forEach((c) => expect(c.body.deleted).toBe(0));

            const uids = liveUids(scratchSiteId);
            process.stdout.write('[gh430] live uids after import: ' + JSON.stringify(uids) + '\n');
            SEED_UIDS.forEach((uid) => expect(uids).toContain(uid));
            IMPORT_UIDS.forEach((uid) => expect(uids).toContain(uid));
            expect(uids).toContain(CAPTURE_NAME);
        }, 300000);

        test('a row that was already soft-deleted is not resurrected', () => {
            const [row] = sql("SELECT IFNULL(deleted_at,'-') FROM samples WHERE site_id = '"
                + scratchSiteId + "' AND client_uid = '" + PRE_TRASHED_UID + "';");
            process.stdout.write('[gh430] pre-trashed row deleted_at: ' + row[0] + '\n');
            expect(row[0]).not.toBe('-');
        });

        test('no sample outside the scratch site changed state', () => {
            const after = corpusState(scratchSiteId);
            const changed = Object.keys(corpusBefore)
                .filter((id) => corpusBefore[id] !== after[id])
                .map((id) => id + ': ' + corpusBefore[id] + ' -> ' + after[id]);
            const appeared = Object.keys(after).filter((id) => !(id in corpusBefore));
            process.stdout.write('[gh430] rows elsewhere: ' + Object.keys(after).length
                + ', changed ' + changed.length + ', appeared ' + appeared.length + '\n');
            expect(changed).toEqual([]);
            expect(appeared).toEqual([]);
        });
    });
}

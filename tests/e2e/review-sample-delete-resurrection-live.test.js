/**
 * REVIEW PROBE (pre-release review, not a shipped ticket).
 *
 * Question: after GH-430 removed reconcileMissingSnapshotSamples(), does a
 * sample deleted through the NEW HUB's Data page (DELETE /api/data/entry/{id},
 * a soft delete) stay deleted when the browser's sample store — which still
 * holds that sample with `rawData` — makes its next ordinary push to
 * POST /api/samples/sync?
 *
 * Why it might not: SampleController::saveSampleRecord() looks the row up with
 * Sample::withTrashed()->firstOrNew([site_id, sample_type, client_uid]) and
 * calls $sample->restore() when it is trashed. sync() runs that for every
 * pushed sample that carries a non-empty `rawData`. Samples restored FROM the
 * server arrive shaped as `values` and are skipped, but a sample that was
 * created in this browser (CSV / Hill Labs import, "Save as Sample") keeps its
 * `rawData` in localStorage and is pushed on every mutation event and every
 * site switch.
 *
 * This probe uses only HTTP: it seeds through /api/samples/sync (so the row is
 * created exactly as a browser-side sample is), deletes it the way the Data
 * page does, then replays the identical push. No production code is touched.
 * It works on its own scratch site and removes it at the end.
 *
 * Run: GILBA_E2E=1 npx jest tests/e2e/review-sample-delete-resurrection-live.test.js --runInBand --testTimeout=300000
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

const SCRATCH_NAME = 'REVIEW resurrection scratch';
const UID = 'review_resurrect_a';

let chromium = null;
try { ({ chromium } = require('playwright')); } catch (e) { /* reported below */ }

function sql(query) {
    const out = execFileSync('docker', [
        'exec', 'gilba_mysql', 'mysql', '-ugilba', '-pgilba_secret', 'gilba',
        '--batch', '--skip-column-names', '-e', query,
    ], { encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] });
    return out.trim().split('\n').filter(Boolean).map((line) => line.split('\t'));
}

if (!ENABLED) {
    process.stdout.write('[review] sample-delete-resurrection probe skipped (needs the live stack)\n');
    test.skip('review probe (disabled)', () => {});
} else {
    describe('REVIEW — does a Data-page delete survive the next sample sync?', () => {
        let browser, page;
        let scratchSiteId = null;
        let previousActiveSiteId = null;
        let dbId = null;
        const out = (s) => process.stdout.write('[review] ' + s + '\n');

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

        // Exactly what sample-persistence.js syncSamplesToServer() sends for a
        // sample the browser owns: keyed by its own id, carrying `rawData`.
        function pushBody() {
            return {
                allSites: {
                    [scratchSiteId]: {
                        soil: {
                            [UID]: {
                                id: UID,
                                label: 'Review Resurrection',
                                date: '2026-03-11',
                                zoneType: 'green',
                                rawData: { pH: 6.4, K: 44, P: 33, Ca: 900, Mg: 120, CEC: 8 },
                            },
                        },
                        water: {}, tissue: {}, loi: {},
                    },
                },
            };
        }

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

            const sites = await api('GET', '/api/sites');
            previousActiveSiteId = sites.json.active_site_id;

            const created = await api('POST', '/api/sites', {
                name: SCRATCH_NAME,
                location_name: 'Sydney, NSW',
                latitude: -33.8688,
                longitude: 151.2093,
                timezone: 'Australia/Sydney',
            });
            if (created.status !== 201) throw new Error('scratch site not created: ' + JSON.stringify(created));
            scratchSiteId = created.json.data.id;
            out('scratch site ' + scratchSiteId);
            await api('PATCH', '/api/active-site', { site_id: scratchSiteId });
        }, 300000);

        afterAll(async () => {
            try {
                if (previousActiveSiteId) await api('PATCH', '/api/active-site', { site_id: previousActiveSiteId });
                if (scratchSiteId) {
                    sql("DELETE FROM site_summaries WHERE site_id = '" + scratchSiteId + "';");
                    sql("DELETE FROM samples WHERE site_id = '" + scratchSiteId + "';");
                    sql("DELETE FROM site_configs WHERE site_id = '" + scratchSiteId + "';");
                    sql("DELETE FROM site_user WHERE site_id = '" + scratchSiteId + "';");
                    sql("DELETE FROM sites WHERE id = '" + scratchSiteId + "';");
                    out('scratch site removed');
                }
            } catch (e) { out('cleanup warning: ' + e.message); }
            if (browser) await browser.close();
        }, 300000);

        test('the browser-owned sample lands through /api/samples/sync', async () => {
            const res = await api('POST', '/api/samples/sync', pushBody());
            out('first push -> ' + JSON.stringify(res.json && res.json.data));
            expect(res.status).toBe(200);

            const rows = sql("SELECT id, IFNULL(deleted_at,'-') FROM samples WHERE site_id = '"
                + scratchSiteId + "' AND client_uid = '" + UID + "';");
            expect(rows.length).toBe(1);
            dbId = rows[0][0];
            expect(rows[0][1]).toBe('-');
            out('db row ' + dbId + ' live');
        }, 300000);

        test('the Data page delete soft-deletes it', async () => {
            const res = await api('DELETE', '/api/data/entry/' + dbId);
            out('DELETE /api/data/entry/' + dbId + ' -> ' + res.status + ' ' + JSON.stringify(res.json));
            expect(res.status).toBe(200);

            const [row] = sql("SELECT IFNULL(deleted_at,'-') FROM samples WHERE id = " + dbId + ";");
            out('deleted_at after the Data page delete: ' + row[0]);
            expect(row[0]).not.toBe('-');
        }, 300000);

        test('the next ordinary push must not bring the deleted sample back', async () => {
            const res = await api('POST', '/api/samples/sync', pushBody());
            out('second push (same body the browser still holds) -> ' + JSON.stringify(res.json && res.json.data));
            expect(res.status).toBe(200);

            const [row] = sql("SELECT IFNULL(deleted_at,'-') FROM samples WHERE id = " + dbId + ";");
            out('deleted_at after the push: ' + row[0]
                + (row[0] === '-' ? '  <-- RESURRECTED' : '  <-- stayed deleted'));
            expect(row[0]).not.toBe('-');
        }, 300000);
    });
}

/**
 * GH-533 (PLAN-samples-sync-FINAL, stage 2) — the hub, on a real page, sends
 * one request per action.
 *
 * WHAT THIS FILE MEASURES AND WHAT IT LEAVES TO OTHERS
 *
 *   Here: the SHAPE OF THE TRAFFIC a real browser produces on a real site.
 *   How many requests one action makes, which method, which path, which record
 *   they name, and that the snapshot push is gone from the wire and not merely
 *   from the source.
 *
 *   Not here: that the server accepts those bodies. That is PHPUnit
 *   (SiteApiTest::test_store_does_not_resurrect_a_deleted_sample posts the same
 *   shape; Gh526SampleDeleteRouteTest covers the DELETE), and it is a better
 *   instrument for it — it can assert the row.
 *
 *   Not here either: that the restored store agrees with the database row by
 *   row. This reads what the page restored, not what the table holds.
 *
 * THE REMEDY (GH-519 / GH-532): `guardStand` on the context.
 *
 * Chosen rather than capture-and-restore because this file's subject IS the
 * request, not its effect: the guard records each write and answers it without
 * letting it reach the stand, which is exactly the measurement, and the stand
 * is untouched for the whole run rather than put back at the end. A run killed
 * half way leaves nothing behind.
 *
 * The consequence is stated rather than left to be found: a held POST answers
 * with the guard's canned body, which carries no `id`, so the sample this run
 * adds never receives a `serverId`. Every PATCH and DELETE below is therefore
 * made against a sample RESTORED FROM THE SERVER, whose `serverId` came from a
 * GET the guard let through.
 *
 * SITE: Burns — 019e96d8-97b7-714c-9bd6-d65b16ec7f2e. Chosen because it holds
 * real soil samples; a site without them cannot answer the PATCH and DELETE
 * half, and inventing lab data is what this project refuses to do.
 *
 * SAMPLE: whichever soil sample the restore puts first. Which one it was is
 * printed, so the run is not describing a sample it never names. It is not
 * chosen by name because this file's claim is about the traffic, not about a
 * particular record.
 *
 * WHAT WAS EXPECTED, WRITTEN DOWN BEFORE THE RUN
 *
 *   1. Restored samples carry `serverId` and a `rawData` holding lab keys with
 *      no `_label` / `_zone` / `_turfProfile` among them — those are raised to
 *      fields of their own. `values` is still there as the stage-3 alias.
 *   2. addSample        -> exactly 1 held POST   /api/samples
 *   3. setZoneType      -> exactly 1 held PATCH  /api/samples/{serverId}
 *   4. deleteSample     -> exactly 1 held DELETE /api/samples/{serverId}
 *   5. switching sites  -> 0 further writes
 *   6. no held path is /api/samples/sync and no held body names `allSites`
 *
 * Any other outcome is reported as the measurement it is. In particular, if
 * (1) came back with `rawData` empty the rest would still "pass" while proving
 * nothing, so (1) is asserted before anything else runs.
 *
 * Run: GILBA_E2E=1 npx jest tests/e2e/gh533-per-record-writes-live.test.js
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
const OTHER_SITE_NAME = 'Test5 - NZ';

let chromium = null;
try { ({ chromium } = require('playwright')); } catch (e) { /* reported below */ }
let guardStand = null;
try { ({ guardStand } = require('./lib/stand-guard')); } catch (e) { /* reported below */ }

/** Held writes to /api/samples, in order, with the local paths only. */
function sampleWrites(held) {
    return held.filter((h) => /^\/api\/samples(\/|$)/.test(h.path));
}

if (!ENABLED) {
    process.stdout.write('[e2e] gh533-per-record-writes-live skipped (needs the live stack)\n');
    test.skip('GH-533 per-record writes (disabled)', () => {});
} else {
    describe('GH-533 — one action, one request, on a real page', () => {
        let browser, page, guard, previousActiveSiteId = null;
        const journal = [];
        const measured = {
            restored: null,
            add: null,
            patch: null,
            del: null,
            afterSwitch: null,
        };

        beforeAll(async () => {
            if (!chromium) throw new Error('playwright does not resolve from the repo — run `npm install`');
            if (!guardStand) throw new Error('tests/e2e/lib/stand-guard.js does not resolve');
            if (!EMAIL || !PASSWORD) throw new Error('no credentials');

            browser = await chromium.launch();
            const context = await browser.newContext();
            guard = await guardStand(context);
            page = await context.newPage();

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
            const other = (sites.data || []).filter((s) => s.name === OTHER_SITE_NAME)[0];

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

            await page.goto(BASE_URL + '/analysis', { waitUntil: 'domcontentloaded' });
            await page.waitForFunction(() => !!window.GAIP_SampleManager && !!window.GAIP_SamplePersistence,
                null, { timeout: 60000 });
            // The restore is server-first and asynchronous; it announces itself.
            await page.waitForFunction(() => window._gaipSamplePersistenceReady === true,
                null, { timeout: 60000 }).catch(() => {});
            await page.waitForTimeout(4000);

            // (1) What the restore produced.
            measured.restored = await page.evaluate(({ siteId }) => {
                const SM = window.GAIP_SampleManager;
                const snap = SM.getAllSamples();
                const soil = ((snap.allSites || {})[siteId] || {}).soil || {};
                const keys = Object.keys(soil);
                const first = keys.length ? soil[keys[0]] : null;
                return {
                    activeSite: SM.getActiveSiteId(),
                    count: keys.length,
                    firstKey: keys[0] || null,
                    firstLabel: first ? (first.label || null) : null,
                    serverId: first ? (first.serverId || null) : null,
                    rawDataKeys: first ? Object.keys(first.rawData || {}) : [],
                    hasValuesAlias: !!(first && first.values),
                    zoneType: first ? first.zoneType || null : null,
                    source: first ? first.source || null : null,
                    canEdit: (window.GAIP_HUB_CONFIG || {}).canEditActiveSite,
                };
            }, { siteId: SITE.id });
            journal.push('restore on /analysis → ' + measured.restored.count + ' soil samples; first "'
                + measured.restored.firstLabel + '" serverId=' + measured.restored.serverId
                + ' rawData keys=' + JSON.stringify(measured.restored.rawDataKeys)
                + ' canEditActiveSite=' + measured.restored.canEdit);

            if (!measured.restored.count) {
                throw new Error('GH-533: ' + SITE.name + ' restored no soil samples — the PATCH and DELETE '
                    + 'half of this run has no subject. Measurement not taken.');
            }

            // (2) Add.
            let before = guard.held.length;
            await page.evaluate(() => {
                window.GAIP_SampleManager.addSample('soil', {
                    label: 'gh533-probe',
                    date: '2026-09-18',
                    values: { K: 41, P: 19 },
                });
            });
            await page.waitForTimeout(2500);
            measured.add = sampleWrites(guard.held.slice(before));
            journal.push('addSample → ' + measured.add.length + ' write(s): '
                + JSON.stringify(measured.add.map((w) => w.method + ' ' + w.path)));

            // (3) Change the zone of a RESTORED sample — it has a serverId.
            before = guard.held.length;
            await page.evaluate(({ key }) => {
                window.GAIP_SampleManager.setZoneType('soil', key, 'fairway');
            }, { key: measured.restored.firstKey });
            await page.waitForTimeout(2500);
            measured.patch = sampleWrites(guard.held.slice(before));
            journal.push('setZoneType → ' + measured.patch.length + ' write(s): '
                + JSON.stringify(measured.patch.map((w) => w.method + ' ' + w.path)));

            // (4) Delete the same restored sample. Held, so the row survives.
            before = guard.held.length;
            await page.evaluate(({ key }) => {
                window.GAIP_SampleManager.deleteSample('soil', key);
            }, { key: measured.restored.firstKey });
            await page.waitForTimeout(2500);
            measured.del = sampleWrites(guard.held.slice(before));
            journal.push('deleteSample → ' + measured.del.length + ' write(s): '
                + JSON.stringify(measured.del.map((w) => w.method + ' ' + w.path)));

            // (5) Switching sites is not an edit.
            before = guard.held.length;
            if (other) {
                await page.evaluate(({ id }) => { window.GAIP_SampleManager.setActiveSite(id); }, { id: other.id });
                await page.waitForTimeout(3000);
                await page.evaluate(({ id }) => { window.GAIP_SampleManager.setActiveSite(id); }, { id: SITE.id });
                await page.waitForTimeout(3000);
            }
            measured.afterSwitch = sampleWrites(guard.held.slice(before));
            journal.push('two site switches (' + (other ? OTHER_SITE_NAME : 'skipped, site not found')
                + ') → ' + measured.afterSwitch.length + ' write(s)');

            process.stdout.write('[gh533] journal:\n  ' + journal.join('\n  ') + '\n');
        }, 600000);

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
                }, { id: previousActiveSiteId }).catch(() => {});
            }
            if (browser) await browser.close();
        }, 180000);

        test('the restore unwraps the envelope and carries the row address', () => {
            expect.hasAssertions();
            process.stdout.write('[gh533] restored: ' + JSON.stringify(measured.restored) + '\n');
            expect(measured.restored.count).toBeGreaterThan(0);
            // The address PATCH and DELETE are made against.
            //
            // Asserted as a value rather than as a string: the first run of
            // this file expected /^\d+$/ and went red on `53`, because the
            // stand's `samples.id` is an integer column and the offline
            // fixture had it as a string. The product concatenates it into a
            // URL, so both work, and pinning the JSON type would have been
            // this test insisting on a shape the product never promised.
            expect(measured.restored.serverId).not.toBeNull();
            expect(String(measured.restored.serverId)).toMatch(/^\d+$/);
            // The lab readings are in rawData ...
            expect(measured.restored.rawDataKeys.length).toBeGreaterThan(0);
            // ... and the envelope's meta keys are not among them.
            ['_label', '_zone', '_source', '_turfProfile', 'zone'].forEach((k) => {
                expect(measured.restored.rawDataKeys).not.toContain(k);
            });
            // The stage-3 alias is still in place; stage 2 does not remove it.
            expect(measured.restored.hasValuesAlias).toBe(true);
        });

        test('adding a sample sends exactly one POST naming one record', () => {
            expect.hasAssertions();
            process.stdout.write('[gh533] add: ' + JSON.stringify(measured.add) + '\n');
            expect(measured.add.length).toBe(1);
            expect(measured.add[0].method).toBe('POST');
            expect(measured.add[0].path).toBe('/api/samples');
            expect(measured.add[0].keys).toEqual(
                expect.arrayContaining(['site_id', 'sample_type', 'client_uid', 'payload']));
        });

        test('changing a zone sends exactly one PATCH addressed by the row id', () => {
            expect.hasAssertions();
            process.stdout.write('[gh533] patch: ' + JSON.stringify(measured.patch) + '\n');
            expect(measured.patch.length).toBe(1);
            expect(measured.patch[0].method).toBe('PATCH');
            expect(measured.patch[0].path).toBe('/api/samples/' + measured.restored.serverId);
            expect(measured.patch[0].keys).toEqual(expect.arrayContaining(['payload']));
            // GH-533: the re-import key is not moved by an edit.
            expect(measured.patch[0].keys).not.toContain('client_uid');
        });

        test('deleting a sample sends exactly one DELETE addressed by the row id', () => {
            expect.hasAssertions();
            process.stdout.write('[gh533] delete: ' + JSON.stringify(measured.del) + '\n');
            expect(measured.del.length).toBe(1);
            expect(measured.del[0].method).toBe('DELETE');
            expect(measured.del[0].path).toBe('/api/samples/' + measured.restored.serverId);
        });

        test('switching sites writes nothing', () => {
            expect.hasAssertions();
            process.stdout.write('[gh533] after switches: ' + JSON.stringify(measured.afterSwitch) + '\n');
            expect(measured.afterSwitch).toEqual([]);
        });

        test('the snapshot push is gone from the wire, not only from the source', () => {
            expect.hasAssertions();
            const all = guard.held;
            process.stdout.write('[gh533] ' + guard.report() + '\n');
            process.stdout.write('[gh533] every held write: '
                + JSON.stringify(all.map((h) => h.method + ' ' + h.path)) + '\n');
            expect(all.length).toBeGreaterThan(0);
            all.forEach((h) => {
                expect(h.path).not.toBe('/api/samples/sync');
                expect(h.keys).not.toContain('allSites');
            });
        });

        test('negative control: reads still reached the server', () => {
            // Without it, every count above is equally consistent with a guard
            // that answered the whole API and a page that never loaded.
            expect.hasAssertions();
            const reached = guard.reached || [];
            expect(reached.length).toBeGreaterThan(0);
            expect(reached.some((r) => /^GET \/api\/samples/.test(r))).toBe(true);
        });
    });
}

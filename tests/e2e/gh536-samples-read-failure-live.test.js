/**
 * GH-536 (PLAN-samples-sync-FINAL, stage 3) — on a real page: the browser keeps
 * no copy, and a read that failed says so.
 *
 * WHAT THIS FILE MEASURES AND WHAT IT LEAVES TO OTHERS
 *
 *   Here: what a REAL BROWSER on a REAL SITE does when GET /api/samples
 *   succeeds and when it fails. Which localStorage keys exist afterwards, what
 *   the store holds, whether the lock bites, and whether the banner is on the
 *   page with the words the plan specifies.
 *
 *   Not here: the outcome logic itself. That is measured off the wire in
 *   tests/gh536-browser-copy-removed.test.js, which can drive `meta` to shapes a
 *   live server will not produce (201 rows on a stand that holds 148).
 *
 *   Not here either: that the samples on screen agree with the table row by
 *   row. This reads what the page restored.
 *
 * THE REMEDY (GH-519 / GH-532), and there are two.
 *
 *   `guardStand` on the context: any write this run produces is recorded and
 *   answered without reaching the stand. Expected to record NOTHING — the run
 *   performs no edit, and the one edit it attempts is supposed to be refused
 *   before it becomes a request. An empty held list is therefore a measurement
 *   in its own right and is printed rather than assumed.
 *
 *   `page.route` on GET /api/samples: the failure is manufactured in the
 *   browser and never reaches the server. Nothing on the stand is touched to
 *   produce it, which is the only honest way to test a failed read against a
 *   stand that works.
 *
 * SITE: Burns — 019e96d8-97b7-714c-9bd6-d65b16ec7f2e. It holds real soil
 * samples; a site without them cannot show the difference between "read
 * nothing" and "read failed", which is the entire subject.
 *
 * SAMPLE: Soil_1_y6pb, server id 28 — the first soil sample of Burns, read from
 * the stand before the run. It is named so the run cannot be described in terms
 * of a record it never identified.
 *
 * WHAT WAS EXPECTED, WRITTEN DOWN BEFORE THE RUN
 *
 *   A. An ordinary load of /analysis:
 *        ready detail       -> source 'server'
 *        SM.isReadOnly()    -> false
 *        Soil_1_y6pb        -> present, serverId '28'
 *        localStorage        -> NO `gilba_samples` key, before or after
 *        banner             -> not on the page
 *
 *   B. The same load with GET /api/samples aborted:
 *        ready detail       -> source 'error'
 *        _gaipSamplePersistenceReady -> still true
 *        SM.isReadOnly()    -> true
 *        addSample          -> throws 'Samples are not loaded — retry first'
 *        soil samples       -> 0
 *        banner             -> present, text exactly
 *          'Samples could not be loaded from the server. Nothing has been changed.'
 *        localStorage        -> STILL no `gilba_samples`
 *
 *   C. The same, with a stale `gilba_samples` planted in localStorage first:
 *        the planted sample does NOT appear in the store. This is the defect
 *        itself — before this stage that copy was read, and its samples had no
 *        serverId, so every later edit was dropped in silence.
 *
 *   D. Retry once the route is let through again:
 *        banner goes, source 'server', Soil_1_y6pb back, store unlocked.
 *
 * Any other outcome is reported as the measurement it is.
 *
 * Run: GILBA_E2E=1 npx jest tests/e2e/gh536-samples-read-failure-live.test.js
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
const SAMPLE_UID = 'Soil_1_y6pb';
const SAMPLE_SERVER_ID = '28';

const BANNER_TEXT = 'Samples could not be loaded from the server. Nothing has been changed.';
const LOCK_MESSAGE = 'Samples are not loaded — retry first';

let chromium = null;
try { ({ chromium } = require('playwright')); } catch (e) { /* reported below */ }
let guardStand = null;
try { ({ guardStand } = require('./lib/stand-guard')); } catch (e) { /* reported below */ }

if (!ENABLED) {
    process.stdout.write('[e2e] gh536-samples-read-failure-live skipped (needs the live stack)\n');
    test.skip('GH-536 read failure (disabled)', () => {});
} else {
    describe('GH-536 — a failed read of the samples, on a real page', () => {
        let browser, context, page, guard, previousActiveSiteId = null;
        let blockSamples = false;
        const journal = [];
        const measured = { ok: null, failed: null, stale: null, retried: null, held: null };

        /** Read everything this stage is about, in one pass, off the live page. */
        const probe = (tryAdd) => page.evaluate((doAdd) => {
            const SM = window.GAIP_SampleManager;
            let soil = [];
            try { soil = SM.getSamples('soil').map((s) => ({ id: s.id, serverId: s.serverId ? String(s.serverId) : null })); } catch (e) {}
            // The add is attempted ONLY where the lock is expected to refuse
            // it. On an open store it would succeed, dispatch gaip:sample-added
            // and put a POST on the wire against the stand -- a write this run
            // has no business making, and one whose absence from the guard's
            // held list would then depend on the page closing before the
            // request left rather than on anything being measured.
            let threw = null;
            if (doAdd) {
                try {
                    SM.addSample('soil', { id: 'gh536_probe_' + Date.now(), values: { K: 1 } });
                } catch (e) { threw = e.message; }
            }
            const banner = document.getElementById('db-samples-unavailable');
            const bannerText = document.getElementById('db-samples-unavailable-text');
            let copy = null;
            try { copy = window.localStorage.getItem('gilba_samples'); } catch (e) {}
            return {
                ready: window._gaipSamplePersistenceReady === true,
                readySource: window.__gh536_lastReady ? window.__gh536_lastReady.source : null,
                readyDetail: window.__gh536_lastReady || null,
                readOnly: typeof SM.isReadOnly === 'function' ? SM.isReadOnly() : null,
                soil,
                addThrew: threw,
                bannerOnPage: !!banner,
                bannerText: bannerText ? bannerText.textContent : null,
                localCopy: copy,
                localKeys: Object.keys(window.localStorage).filter((k) => /sample/i.test(k)),
                addAttempted: !!doAdd,
            };
        }, tryAdd === true);

        /** A fresh page with the ready event recorded from before the module runs. */
        const openAnalysis = async (plant) => {
            const p = await context.newPage();
            await p.addInitScript(({ stale }) => {
                document.addEventListener('gaip:samples-persistence-ready', (e) => {
                    window.__gh536_lastReady = e.detail;
                });
                if (stale) {
                    try { window.localStorage.setItem('gilba_samples', stale); } catch (e) {}
                }
            }, { stale: plant || null });
            await p.goto(BASE_URL + '/analysis', { waitUntil: 'domcontentloaded' });
            await p.waitForTimeout(6000);
            return p;
        };

        beforeAll(async () => {
            if (!chromium) throw new Error('playwright does not resolve from the repo — run `npm install`');
            if (!guardStand) throw new Error('tests/e2e/lib/stand-guard.js does not resolve');
            if (!EMAIL || !PASSWORD) throw new Error('no credentials in tests/e2e/.e2e-credentials.json');

            browser = await chromium.launch();
            context = await browser.newContext();
            guard = await guardStand(context);

            // The manufactured failure. It is a flag rather than a route added
            // and removed, so the same context can be used for the retry.
            await context.route('**/api/samples?**', (route) => {
                if (blockSamples) { journal.push('aborted ' + route.request().url()); return route.abort('failed'); }
                return route.continue();
            });

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

            // A — the ordinary load.
            const okPage = await openAnalysis();
            const savedPage = page; page = okPage;
            measured.ok = await probe(false);
            await okPage.close(); page = savedPage;

            // B — the read fails.
            blockSamples = true;
            const failPage = await openAnalysis();
            page = failPage;
            measured.failed = await probe(true);

            // D — retry, on the same page, with the route let through again.
            blockSamples = false;
            await failPage.evaluate(() => window.GAIP_SamplePersistence.restore());
            await failPage.waitForTimeout(5000);
            measured.retried = await probe(false);
            await failPage.close(); page = savedPage;

            // C — the stale copy is planted, and the read fails again.
            blockSamples = true;
            const stale = JSON.stringify({
                sites: { [SITE.id]: { label: 'Burns' } },
                allSites: { [SITE.id]: { soil: { gh536_ghost: { id: 'gh536_ghost', label: 'Ghost', rawData: { K: 7 } } } } },
                currentSite: SITE.id,
            });
            const stalePage = await openAnalysis(stale);
            page = stalePage;
            measured.stale = await probe(true);
            await stalePage.close(); page = savedPage;
            blockSamples = false;

            measured.held = guard.held.slice();

            process.stdout.write('\n[gh536] site: ' + SITE.name + ' (' + SITE.id + ')\n');
            process.stdout.write('[gh536] A ordinary load: ' + JSON.stringify({
                source: measured.ok.readySource, readOnly: measured.ok.readOnly,
                soil: measured.ok.soil.length, copy: measured.ok.localCopy === null ? 'absent' : 'PRESENT',
                banner: measured.ok.bannerOnPage,
            }) + '\n');
            process.stdout.write('[gh536] B read aborted: ' + JSON.stringify({
                source: measured.failed.readySource, ready: measured.failed.ready,
                readOnly: measured.failed.readOnly, soil: measured.failed.soil.length,
                addThrew: measured.failed.addThrew, banner: measured.failed.bannerOnPage,
                copy: measured.failed.localCopy === null ? 'absent' : 'PRESENT',
            }) + '\n');
            process.stdout.write('[gh536] C stale copy planted: ' + JSON.stringify({
                source: measured.stale.readySource,
                ghostInStore: measured.stale.soil.some((s) => s.id === 'gh536_ghost'),
                soil: measured.stale.soil.length,
            }) + '\n');
            process.stdout.write('[gh536] D after retry: ' + JSON.stringify({
                source: measured.retried.readySource, readOnly: measured.retried.readOnly,
                soil: measured.retried.soil.length, banner: measured.retried.bannerOnPage,
            }) + '\n');
            process.stdout.write('[gh536] sample-ish localStorage keys after the run: '
                + JSON.stringify(measured.ok.localKeys) + '\n');
            process.stdout.write('[gh536] writes held by the guard: ' + measured.held.length
                + (measured.held.length ? ' -> ' + JSON.stringify(measured.held.map((h) => h.method + ' ' + h.path)) : '')
                + '\n');
            process.stdout.write('[gh536] routes aborted: ' + journal.length + '\n');
        }, 300000);

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
        }, 60000);

        // ---- A ----------------------------------------------------------------

        test('A: the ordinary load reads the server and names the named sample', () => {
            expect(measured.ok.readySource).toBe('server');
            expect(measured.ok.readOnly).toBe(false);
            const named = measured.ok.soil.filter((s) => s.id === SAMPLE_UID)[0];
            expect(named).toBeTruthy();
            expect(named.serverId).toBe(SAMPLE_SERVER_ID);
        });

        test('A: no banner on a page whose read worked', () => {
            expect(measured.ok.bannerOnPage).toBe(false);
        });

        test('A: the browser copy is not written — the key does not exist', () => {
            // The whole subject of the stage, measured on a real page rather
            // than argued from the source.
            expect(measured.ok.localCopy).toBeNull();
            expect(measured.ok.localKeys).not.toContain('gilba_samples');
        });

        // ---- B ----------------------------------------------------------------

        test('B: a failed read says error rather than showing an empty page', () => {
            expect(measured.failed.readySource).toBe('error');
            expect(measured.failed.soil.length).toBe(0);
        });

        test('B: the ready flag is still set, so the page is not half dead', () => {
            expect(measured.failed.ready).toBe(true);
        });

        test('B: the store is locked and the lock bites', () => {
            expect(measured.failed.readOnly).toBe(true);
            expect(measured.failed.addThrew).toBe(LOCK_MESSAGE);
        });

        test('B: the banner is on the page, with the words the plan specifies', () => {
            expect(measured.failed.bannerOnPage).toBe(true);
            expect(measured.failed.bannerText).toBe(BANNER_TEXT);
        });

        test('B: a failed read writes no copy either', () => {
            expect(measured.failed.localCopy).toBeNull();
        });

        // ---- C ----------------------------------------------------------------

        test('C: a copy left in the browser by an older build is NOT read', () => {
            // This is the defect, stated as a measurement. Every existing client
            // has this key on the day the change ships.
            expect(measured.stale.soil.some((s) => s.id === 'gh536_ghost')).toBe(false);
            expect(measured.stale.soil.length).toBe(0);
            expect(measured.stale.readySource).toBe('error');
            expect(measured.stale.addThrew).toBe(LOCK_MESSAGE);
        });

        // ---- D ----------------------------------------------------------------

        test('D: Retry re-reads the server, clears the banner and unlocks the store', () => {
            expect(measured.retried.readySource).toBe('server');
            expect(measured.retried.readOnly).toBe(false);
            expect(measured.retried.bannerOnPage).toBe(false);
            expect(measured.retried.soil.some((s) => s.id === SAMPLE_UID)).toBe(true);
        });

        // ---- the guard's own report -------------------------------------------

        test('the run sent no write to the stand', () => {
            // Stated as an assertion rather than left implicit: a run that
            // quietly wrote would still have passed every test above.
            //
            // And it means what it says only because the only add this run
            // attempts is made against a LOCKED store, which refuses it before
            // it becomes a request. The two probes that run against an open
            // store attempt nothing -- see `probe(tryAdd)`.
            expect(measured.ok.addAttempted).toBe(false);
            expect(measured.retried.addAttempted).toBe(false);
            expect(measured.failed.addAttempted).toBe(true);
            expect(measured.held).toEqual([]);
        });
    });
}

/**
 * GH-536 — THE RE-RUN IFRAME, measured on its own.
 *
 * WHY A SECOND FILE-LEVEL BLOCK. Two removals in this delivery land on the same
 * path and neither is visible from the pages above:
 *
 *   dashboard-ui.js stamped the active site id into `gilba_samples.currentSite`
 *   before opening the hidden /hub iframe, so the old hub would restore the
 *   right site out of the browser copy. The stamp went with the key.
 *
 *   hub-persistence.js set the active site inside `if (samples)`, where
 *   `samples` was that same copy. Deleting the key without lifting the block
 *   out would have stopped /hub setting its active site AT ALL -- and /hub is
 *   the hidden calculation runner, so nobody would have seen it happen. That
 *   is Н3 in the stage-3 worksheet, and this is the run that checks the lift.
 *
 * WHAT WAS EXPECTED, WRITTEN DOWN BEFORE THE RUN
 *
 *   Opening /hub with the server's active site set to Burns:
 *     - GAIP_SampleManager.getActiveSiteId() -> the Burns UUID, NOT 'default'
 *     - the soil store for that site is not empty
 *     - localStorage still holds no `gilba_samples`
 *
 *   'default' is the specific wrong answer: it is what the manager starts on,
 *   and it is what the page would be left holding if the lifted block never
 *   ran.
 */
if (ENABLED) {
    describe('GH-536 — /hub, the calculation iframe, still lands on the right site', () => {
        let browser, context, page, previousActiveSiteId = null;
        let seen = null;

        beforeAll(async () => {
            browser = await chromium.launch();
            context = await browser.newContext();
            await guardStand(context);
            page = await context.newPage();

            await page.goto(BASE_URL + '/login', { waitUntil: 'domcontentloaded' });
            await page.fill('#email', EMAIL);
            await page.fill('#password', PASSWORD);
            await Promise.all([
                page.waitForNavigation({ waitUntil: 'domcontentloaded' }).catch(() => {}),
                page.click('form.login-form button[type=submit]')
            ]);
            await page.waitForTimeout(1500);

            const sites = await page.evaluate(async () => {
                const r = await fetch('/api/sites', { headers: { Accept: 'application/json' }, credentials: 'same-origin' });
                return r.json();
            });
            previousActiveSiteId = sites.active_site_id;

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

            const hub = await context.newPage();
            await hub.goto(BASE_URL + '/hub', { waitUntil: 'domcontentloaded' });
            await hub.waitForTimeout(9000);

            seen = await hub.evaluate(() => {
                const SM = window.GAIP_SampleManager;
                let soil = 0;
                try { soil = SM.getSamples('soil').length; } catch (e) {}
                let copy = null;
                try { copy = window.localStorage.getItem('gilba_samples'); } catch (e) {}
                return {
                    activeSiteId: SM && typeof SM.getActiveSiteId === 'function' ? SM.getActiveSiteId() : null,
                    configSiteId: (window.GAIP_HUB_CONFIG || {}).activeSiteId || null,
                    soil,
                    copy,
                    ready: window._gaipSamplePersistenceReady === true,
                };
            });
            await hub.close();

            process.stdout.write('[gh536] /hub iframe: ' + JSON.stringify(seen) + '\n');
        }, 300000);

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
        }, 60000);

        test('the active site is the server\'s, not the manager\'s starting default', () => {
            expect(seen.configSiteId).toBe(SITE.id);
            expect(seen.activeSiteId).not.toBe('default');
            expect(seen.activeSiteId).toBe(SITE.id);
        });

        test('the samples for that site are there, restored from the server', () => {
            expect(seen.ready).toBe(true);
            expect(seen.soil).toBeGreaterThan(0);
        });

        test('and /hub writes no browser copy either', () => {
            expect(seen.copy).toBeNull();
        });
    });
}

/**
 * GH-536 — /field-log, which lost the most code in this delivery and shows the
 * least of it.
 *
 * WHAT WAS REMOVED THERE. SiteLoader kept three members that existed only to
 * keep the `gilba_samples` blob in step: _injectIntoStorage() wrote the server's
 * site list into it, setActive() wrote currentSite into it on every switch, and
 * _fromStorage() read the list back out when GET /api/sites failed. getSiteList()
 * had a fourth copy of the same read.
 *
 * AND WHAT REPLACED THE FALLBACK: nothing. Rebuilt from the browser copy,
 * _fromStorage() returned real sites; with the copy gone it could only ever
 * have returned its own last resort, `{id: 'default', label: 'Default Site'}` --
 * a site that does not exist, offered to the client as if it did. That is the
 * shape GH-441 removed from the site registry for the same reason. A failed read
 * now renders a disabled "Sites could not be loaded".
 *
 * WHAT WAS EXPECTED, WRITTEN DOWN BEFORE THE RUN
 *   - the page loads and the site selector is present and ENABLED
 *   - it lists more than one site, and Burns is among them by NAME (not by id,
 *     which is what the removed fallback would have produced)
 *   - no `gilba_samples` key afterwards
 */
if (ENABLED) {
    describe('GH-536 — /field-log still lists real sites without the browser copy', () => {
        let browser, context, page, seen = null;

        beforeAll(async () => {
            browser = await chromium.launch();
            context = await browser.newContext();
            await guardStand(context);
            page = await context.newPage();

            await page.goto(BASE_URL + '/login', { waitUntil: 'domcontentloaded' });
            await page.fill('#email', EMAIL);
            await page.fill('#password', PASSWORD);
            await Promise.all([
                page.waitForNavigation({ waitUntil: 'domcontentloaded' }).catch(() => {}),
                page.click('form.login-form button[type=submit]')
            ]);
            await page.waitForTimeout(1500);

            await page.goto(BASE_URL + '/field-log', { waitUntil: 'domcontentloaded' });
            await page.waitForTimeout(7000);

            seen = await page.evaluate(() => {
                const sel = document.getElementById('gaip-fl-site')
                    || document.querySelector('.gaip-fl-select--site');
                const opts = sel ? Array.from(sel.options || []).map((o) => ({ value: o.value, text: o.textContent.trim() })) : [];
                let copy = null;
                try { copy = window.localStorage.getItem('gilba_samples'); } catch (e) {}
                return {
                    selectorPresent: !!sel,
                    disabled: sel ? !!sel.disabled : null,
                    optionCount: opts.length,
                    names: opts.map((o) => o.text),
                    copy,
                };
            });
            process.stdout.write('[gh536] /field-log: ' + JSON.stringify({
                present: seen.selectorPresent, disabled: seen.disabled,
                options: seen.optionCount, copy: seen.copy === null ? 'absent' : 'PRESENT',
            }) + '\n');
            process.stdout.write('[gh536] /field-log first names: ' + JSON.stringify(seen.names.slice(0, 5)) + '\n');
        }, 300000);

        afterAll(async () => { if (browser) await browser.close(); }, 60000);

        test('the selector is there and enabled', () => {
            expect(seen.selectorPresent).toBe(true);
            expect(seen.disabled).toBe(false);
        });

        test('it lists real sites by name, which the removed fallback could not have done', () => {
            expect(seen.optionCount).toBeGreaterThan(1);
            expect(seen.names).toContain(SITE.name);
            // The specific wrong answer the fallback would have produced.
            expect(seen.names).not.toEqual(['Default Site']);
        });

        test('and no browser copy is left behind', () => {
            expect(seen.copy).toBeNull();
        });
    });
}

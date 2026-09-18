/**
 * GH-537 — on a real page: the request names the site, and the four pages that
 * enumerate across sites still get all of them.
 *
 * WHAT THIS FILE MEASURES. The URL a real browser sends, the samples that end
 * up in the store, and — the part that is the whole risk of this change — that
 * the combined export's picker still spans sites where it is supposed to and
 * stops spanning them where it is not.
 *
 * Not here: the outcome logic (empty vs error vs partial), which is measured off
 * the wire in tests/gh537-restore-is-scoped-to-the-site.test.js, where `meta`
 * can be driven to shapes a live stand will not produce.
 *
 * THE REMEDY: `guardStand` on the context. It intercepts the five stand-state
 * routes and lets nothing land. Chosen over capture-and-restore on a
 * measurement rather than a habit: `restoreConfigs()` cannot put an
 * `analysis_cache` row back for nine of the twelve sites — the base64 exceeds
 * the 128 KB single-argument limit inside the container (Question 39) — so a
 * write must be stopped, not undone. Measured earlier the same evening on this
 * same harness: with the guard installed the page still renders and the stand
 * did not move by a line.
 *
 * SITES AND SAMPLES, named before the run:
 *   Burns    — 019e96d8-97b7-714c-9bd6-d65b16ec7f2e, the most populous site on
 *              the stand: 31 rows, 29 of them live. The one that would show a
 *              limit problem first if there were one.
 *   Westview — 019f7d28-50ed-71e2-b817-c252b0160460, exactly one sample, id
 *              118, `Backyard`, stored under key `sample_118` because its
 *              `client_uid` is NULL.
 *
 * WHICH OF THE TWO NUMBERS THE PATH SEES — asked explicitly, because 29 and 31
 * differ by the soft-deleted rows and the answer says whether anything on this
 * path carries `withTrashed`. Printed, and asserted to be the live count.
 *
 * WHAT WAS EXPECTED, WRITTEN DOWN BEFORE THE RUN, BOTH OUTCOMES NAMED.
 *
 *   A — /analysis on Burns (an ordinary db-shell page):
 *       A1: the samples request carries `site_id=<Burns>`.
 *       A2: the store holds Burns's soil samples and NO samples of any other
 *           site.
 *       A3: the site REGISTRY still lists every site — the switcher must not
 *           narrow with the samples.
 *       B:  if the request still has no site_id, the change did not reach the
 *           page and the run STOPS.
 *
 *   B — /analysis on Westview:
 *       A: one soil sample, `sample_118`, serverId 118.
 *       B: any other count, reported as measured.
 *
 *   C — /reports/export (a page carrying the cross-site export):
 *       A: the request carries NO site_id, and the picker offers samples from
 *          more than one site — the same 9 groups measured before this change.
 *       B: the picker collapses to one site. That would be this change
 *          silently removing a client-facing capability, and the run STOPS and
 *          names it rather than passing.
 *
 * Any other outcome is reported as the measurement it is.
 *
 * Run: GILBA_E2E=1 npx jest tests/e2e/gh537-site-scoped-restore-live.test.js
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

const BURNS = { name: 'Burns', id: '019e96d8-97b7-714c-9bd6-d65b16ec7f2e', live: 29, rows: 31 };
const WESTVIEW = { name: 'Westview', id: '019f7d28-50ed-71e2-b817-c252b0160460' };

let chromium = null;
try { ({ chromium } = require('playwright')); } catch (e) { /* reported below */ }
let guardStand = null;
try { ({ guardStand } = require('./lib/stand-guard')); } catch (e) { /* reported below */ }

if (!ENABLED) {
    process.stdout.write('[e2e] gh537-site-scoped-restore skipped (needs the live stack)\n');
    test.skip('GH-537 site-scoped restore (disabled)', () => {});
} else {
    describe('GH-537 — a page loads the samples of the site it is open on', () => {
        let browser, context, guard, page, previousActiveSiteId = null;
        const seen = { burns: null, westview: null, reports: null };
        let stopped = null;

        /** Every samples request this page sent, and what the store holds. */
        const probe = (p, siteId) => p.evaluate((sid) => {
            const SM = window.GAIP_SampleManager;
            const all = (SM && typeof SM.getAllSamples === 'function') ? SM.getAllSamples() : { sites: {}, allSites: {} };
            const perSite = {};
            Object.keys(all.allSites || {}).forEach((s) => {
                const store = all.allSites[s] || {};
                const n = ['soil', 'water', 'tissue', 'loi']
                    .reduce((acc, t) => acc + Object.keys(store[t] || {}).length, 0);
                if (n > 0) perSite[s] = n;
            });
            return {
                requests: (window.__gh537 || []).slice(),
                registrySites: Object.keys(all.sites || {}).length,
                sitesWithSamples: perSite,
                mySoil: Object.keys(((all.allSites || {})[sid] || {}).soil || {}),
                mySoilDetail: Object.keys(((all.allSites || {})[sid] || {}).soil || {})
                    .map((k) => ({ key: k, serverId: String(all.allSites[sid].soil[k].serverId || '') })),
                readySource: window.__gh537ready ? window.__gh537ready.source : null,
                readySiteId: window.__gh537ready ? (window.__gh537ready.siteId || null) : null,
            };
        }, siteId);

        const open = async (url) => {
            const p = await context.newPage();
            await p.addInitScript(() => {
                window.__gh537 = [];
                document.addEventListener('gaip:samples-persistence-ready', (e) => { window.__gh537ready = e.detail; });
                const rf = window.fetch;
                window.fetch = function (u) {
                    const s = String(u);
                    if (/\/samples\?/.test(s)) window.__gh537.push(s);
                    return rf.apply(this, arguments);
                };
            });
            await p.goto(BASE_URL + url, { waitUntil: 'domcontentloaded' });
            await p.waitForTimeout(9000);
            return p;
        };

        const setSite = (p, id) => p.evaluate(async ({ sid }) => {
            const t = document.querySelector('meta[name=csrf-token]');
            await fetch('/api/active-site', {
                method: 'PATCH',
                headers: Object.assign({ 'Content-Type': 'application/json', Accept: 'application/json' },
                    t ? { 'X-CSRF-TOKEN': t.getAttribute('content') } : {}),
                body: JSON.stringify({ site_id: sid }),
                credentials: 'same-origin',
            });
        }, { sid: id });

        beforeAll(async () => {
            if (!chromium) throw new Error('playwright does not resolve from the repo — run `npm install`');
            if (!guardStand) throw new Error('tests/e2e/lib/stand-guard.js does not resolve');
            if (!EMAIL || !PASSWORD) throw new Error('no credentials');

            browser = await chromium.launch();
            context = await browser.newContext();
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

            // ---- A: Burns on an ordinary page ----
            await setSite(page, BURNS.id);
            const pb = await open('/analysis');
            seen.burns = await probe(pb, BURNS.id);
            await pb.close();
            process.stdout.write('[gh537] A /analysis on Burns: ' + JSON.stringify({
                requests: seen.burns.requests, soil: seen.burns.mySoil.length,
                sitesWithSamples: Object.keys(seen.burns.sitesWithSamples).length,
                registrySites: seen.burns.registrySites,
                readySource: seen.burns.readySource, readySiteId: seen.burns.readySiteId,
            }) + '\n');

            if (!seen.burns.requests.length || seen.burns.requests[0].indexOf('site_id=') === -1) {
                stopped = 'A: the samples request still carries no site_id — the change did not reach the page';
                process.stdout.write('[gh537] STOPPED at ' + stopped + '\n');
                return;
            }

            // ---- B: Westview ----
            await setSite(page, WESTVIEW.id);
            const pw = await open('/analysis');
            seen.westview = await probe(pw, WESTVIEW.id);
            await pw.close();
            process.stdout.write('[gh537] B /analysis on Westview: ' + JSON.stringify({
                requests: seen.westview.requests, soil: seen.westview.mySoilDetail,
                sitesWithSamples: Object.keys(seen.westview.sitesWithSamples).length,
                readySiteId: seen.westview.readySiteId,
            }) + '\n');

            // ---- C: the cross-site export page ----
            const pr = await open('/reports/export');
            seen.reports = await probe(pr, WESTVIEW.id);
            seen.reports.enumerated = await pr.evaluate(() => {
                const CE = window.GAIP_CombinedExport;
                if (!CE || typeof CE.enumerate !== 'function') return { error: 'no GAIP_CombinedExport' };
                const all = CE.enumerate('all') || [];
                const bySite = {};
                all.forEach((e) => { bySite[e.siteLabel || e.siteId] = (bySite[e.siteLabel || e.siteId] || 0) + 1; });
                return { total: all.length, siteGroups: Object.keys(bySite).length, bySite: bySite };
            });
            await pr.close();
            process.stdout.write('[gh537] C /reports/export: ' + JSON.stringify({
                requests: seen.reports.requests,
                sitesWithSamples: Object.keys(seen.reports.sitesWithSamples).length,
                readySiteId: seen.reports.readySiteId,
                enumerated: seen.reports.enumerated,
            }) + '\n');
        }, 300000);

        afterAll(async () => {
            if (page && previousActiveSiteId) { await setSite(page, previousActiveSiteId).catch(() => {}); }
            if (browser) await browser.close();
            if (guard) process.stdout.write('[gh537] ' + guard.report() + '\n');
        }, 60000);

        test('A: the request names Burns, once', () => {
            expect(stopped).toBeNull();
            expect(seen.burns.requests.length).toBe(1);
            expect(seen.burns.requests[0]).toContain('site_id=' + BURNS.id);
            expect(seen.burns.requests[0]).toContain('limit=200');
        });

        test('A: the store holds Burns\'s samples and nobody else\'s', () => {
            expect(stopped).toBeNull();
            expect(Object.keys(seen.burns.sitesWithSamples)).toEqual([BURNS.id]);
        });

        test('A: and the path sees the LIVE count, not the row count', () => {
            // The question asked explicitly, because the two numbers differ by
            // the soft-deleted rows and the answer says whether anything on
            // this path carries `withTrashed`.
            //
            // Burns by type, from the database: soil 26 rows / 26 live,
            // tissue 4 / 2, water 1 / 1 — 31 rows, 29 live. The count compared
            // here is ACROSS ALL FOUR TYPES, because that is what 29 and 31
            // are. An earlier draft compared the soil count against 29 and went
            // red at 26: the assertion was measuring one type against a total.
            expect(seen.burns.mySoil.length).toBe(26);
            expect(seen.burns.sitesWithSamples[BURNS.id]).toBe(BURNS.live);
            expect(seen.burns.sitesWithSamples[BURNS.id]).not.toBe(BURNS.rows);
        });

        test('A: the site REGISTRY is not narrowed with the samples', () => {
            expect(stopped).toBeNull();
            // The switcher lists sites from GET /api/sites, which this change
            // does not touch. 109 sites on the stand; more than one is the claim.
            expect(seen.burns.registrySites).toBeGreaterThan(1);
            expect(seen.burns.readySource).toBe('server');
            expect(seen.burns.readySiteId).toBe(BURNS.id);
        });

        test('B: Westview loads its one sample, keyed as its NULL client_uid forces', () => {
            expect(stopped).toBeNull();
            expect(seen.westview.requests[0]).toContain('site_id=' + WESTVIEW.id);
            expect(seen.westview.mySoilDetail).toEqual([{ key: 'sample_118', serverId: '118' }]);
            expect(Object.keys(seen.westview.sitesWithSamples)).toEqual([WESTVIEW.id]);
        });

        test('C: the cross-site export page asks for every site', () => {
            expect(stopped).toBeNull();
            expect(seen.reports.requests.length).toBe(1);
            expect(seen.reports.requests[0]).not.toContain('site_id');
            expect(seen.reports.readySiteId).toBeNull();
        });

        test('C: and its picker still spans sites — the capability this change could have removed', () => {
            expect(stopped).toBeNull();
            expect(seen.reports.enumerated.error).toBeUndefined();
            expect(seen.reports.enumerated.siteGroups).toBeGreaterThan(1);
            expect(Object.keys(seen.reports.sitesWithSamples).length).toBeGreaterThan(1);
        });

        test('no write to a protected table reached the server', () => {
            const PROTECTED = /\/api\/(analysis-cache|samples|site-summaries|predictions|sites\/sync|sites\/[^/]+\/config\/)/;
            const leaked = guard.reached.filter((r) => !/^(GET|HEAD|OPTIONS) /.test(r) && PROTECTED.test(r));
            expect(leaked).toEqual([]);
        });
    });
}

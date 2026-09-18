/**
 * GH-521 live check — what each layer answers for the methodology, on the five
 * sites whose stored value is 'mlsn'.
 *
 * WHY THIS FILE EXISTS. Two statements were made about the same five sites and
 * they cannot both be true: that they "stop reading as methodology unknown"
 * (an improvement, on the calendar) and that they "read as not set instead of
 * MLSN" (a regression, on the page). The second was written from a number
 * carried over from the first measurement with the wrong consequence attached
 * to it. This test answers the question per layer, on the real stack, so the
 * answer is a set of printed values rather than an argument.
 *
 * The three layers, and what reads what after GH-520/521:
 *   1. The server pages. `$turfMethodology` comes from the site's own config
 *      through AppServiceProvider. A site with no methodology prints
 *      "Methodology: not set"; a site with one prints it.
 *   2. The calendar, `collectFromState()`. It reports `_methodologyDefaulted`
 *      alongside the value, which is the flag that used to be raised for a
 *      stored 'mlsn' because the hub store seeded that same string.
 *   3. The document, through `resolveExportInputs({siteId})` — the same
 *      resolver the Combined export's per-sample hand-off uses.
 *
 * Measured in the database before this ran, and printed below so the run can be
 * read without it: all twelve sites carry a methodology, and NONE carries an
 * empty one. The "not set" population is zero.
 *
 * Writes: none of its own. The active-site pointer is moved to render each
 * site's pages and put back in afterAll; the GH-519 stand guard holds anything
 * a page tries to save on its way past.
 *
 * Run: GILBA_E2E=1 npx jest tests/e2e/gh521-methodology-per-layer-live.test.js
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

// Named before the run, with what the database says each one stores.
const SITES = [
    { name: 'Burns',          id: '019e96d8-97b7-714c-9bd6-d65b16ec7f2e', stored: 'mlsn', soilSamples: 26 },
    { name: 'Canberra',       id: null, stored: 'mlsn', soilSamples: 0 },
    { name: 'Test1 - Sports', id: null, stored: 'mlsn', soilSamples: 0 },
    { name: 'Test6 - UK',     id: null, stored: 'mlsn', soilSamples: 0 },
    { name: 'Westview',       id: '019f7d28-50ed-71e2-b817-c252b0160460', stored: 'mlsn', soilSamples: 1 },
    // Not one of the five. Added because the Prebble panel runs only on NZ
    // sites, so a null from getMethodology() on an Australian site says nothing
    // about it. Stored value measured in the database the same way.
    { name: 'Test5 - NZ',     id: '019e96f3-9294-72be-a13c-7fa7427afd5a', stored: 'ammonium_acetate', soilSamples: null },
];

let chromium = null;
try { ({ chromium } = require('playwright')); } catch (e) { /* reported below */ }

let guardStand = null;
try { ({ guardStand } = require('./lib/stand-guard')); } catch (e) { /* reported below */ }

if (!ENABLED) {
    process.stdout.write('[e2e] gh521-methodology-per-layer-live skipped (needs the live stack)\n');
    test.skip('GH-521 per-layer methodology (disabled)', () => {});
} else {
    describe('GH-521 — the methodology each layer answers, on the five stored-mlsn sites', () => {
        let browser, page, guard, previousActiveSiteId = null;
        const results = [];

        beforeAll(async () => {
            if (!chromium) throw new Error('playwright does not resolve from the repo — run `npm install`');
            if (!guardStand) throw new Error('tests/e2e/lib/stand-guard.js does not resolve');
            if (!EMAIL || !PASSWORD) throw new Error('no credentials — see .e2e-credentials.example.json');
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
            SITES.forEach((s) => {
                if (s.id) return;
                const found = (sites.data || []).find((x) => x.name === s.name);
                if (!found) throw new Error('site not among this login\'s sites: ' + s.name);
                s.id = found.id;
            });
        }, 180000);

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
            if (guard) process.stdout.write('[gh521] ' + guard.report() + '\n');
            if (browser) await browser.close();
        }, 180000);

        async function switchTo(siteId) {
            await page.evaluate(async ({ id }) => {
                const t = document.querySelector('meta[name=csrf-token]');
                await fetch('/api/active-site', {
                    method: 'PATCH',
                    headers: Object.assign({ 'Content-Type': 'application/json', Accept: 'application/json' },
                        t ? { 'X-CSRF-TOKEN': t.getAttribute('content') } : {}),
                    body: JSON.stringify({ site_id: id }),
                    credentials: 'same-origin',
                });
            }, { id: siteId });
        }

        /** Layer 1: the server-rendered label, read off growth-light's pill. */
        async function pageLayer(siteId) {
            await page.goto(BASE_URL + '/analysis/growth-light', { waitUntil: 'domcontentloaded' });
            await page.waitForTimeout(1200);
            return page.evaluate(() => {
                const pills = Array.from(document.querySelectorAll('.db-pill')).map((p) => p.textContent.trim());
                return {
                    injected: (window.GAIP_HUB_CONFIG || {}).turfMethodology === undefined
                        ? '<<absent>>' : (window.GAIP_HUB_CONFIG || {}).turfMethodology,
                    notSetPill: pills.filter((t) => /Methodology: not set/.test(t)),
                    pills: pills,
                };
            });
        }

        /** Layers 2 and 3, both read on the Plan page where the calendar lives. */
        async function planLayers(siteId) {
            await page.goto(BASE_URL + '/plan', { waitUntil: 'domcontentloaded' });
            await page.waitForTimeout(6000);
            return page.evaluate(({ id }) => {
                const out = { calendar: null, resolver: null, calendarError: null, resolverError: null };
                try {
                    const NC = window.GilbaNutritionCalendar || window.NutritionCalendar;
                    if (NC && typeof NC.collectFromState === 'function') {
                        const c = NC.collectFromState();
                        out.calendar = { methodology: c.methodology, defaulted: c._methodologyDefaulted };
                    } else {
                        out.calendarError = 'collectFromState not on the page';
                    }
                } catch (e) { out.calendarError = String(e && e.message).slice(0, 160); }
                try {
                    const NPI = window.GAIP_NutritionProgramInputs;
                    if (NPI && typeof NPI.resolveExportInputs === 'function') {
                        const r = NPI.resolveExportInputs({ siteId: id });
                        // The keys are recorded, not assumed. The first run of
                        // this test read `r.soil.methodology` and got null on a
                        // site storing 'mlsn', because there is no `soil` key —
                        // which is how the defect in getMethodology() was found.
                        out.resolver = {
                            keys: Object.keys(r || {}),
                            methodology: r && r.program ? (r.program.methodology || null) : null,
                            source: r && r.program && r.program.sources
                                ? r.program.sources.methodology : null,
                        };
                    } else {
                        out.resolverError = 'resolveExportInputs not on the page';
                    }
                } catch (e) { out.resolverError = String(e && e.message).slice(0, 160); }
                // And the product's own function, where the page carries it.
                // `getMethodology()` resolves the id ITSELF, from
                // GAIP_SampleManager.getActiveSiteId(), so a null answer has two
                // possible causes — the panel is not on this page, or the id it
                // resolved is not the site being viewed. They are recorded
                // separately, because "not observed" would otherwise be a claim
                // about the probe.
                try {
                    const PI = window.NutritionPrebbleIntegration || window.GAIP_NutritionPrebble;
                    out.prebblePresent = !!(PI && typeof PI.getMethodology === 'function');
                    out.prebble = out.prebblePresent ? PI.getMethodology() : '<<not on this page>>';
                    const SM = window.GAIP_SampleManager;
                    out.activeSiteId = (SM && typeof SM.getActiveSiteId === 'function')
                        ? SM.getActiveSiteId() : '<<no getActiveSiteId>>';
                    out.idMatchesSiteViewed = out.activeSiteId === id;
                } catch (e) { out.prebbleError = String(e && e.message).slice(0, 160); }
                return out;
            }, { id: siteId });
        }

        test('every one of the five is measured, and the first divergence stops the run', async () => {
            expect.hasAssertions();
            for (const site of SITES) {
                await switchTo(site.id);
                const l1 = await pageLayer(site.id);
                const l23 = await planLayers(site.id);
                const row = { site: site.name, stored: site.stored, page: l1, plan: l23 };
                results.push(row);
                process.stdout.write('[gh521] ' + JSON.stringify(row) + '\n');

                // Layer 1 — the claim under test. A site that stores a
                // methodology must print it, and must NOT print "not set".
                expect(l1.notSetPill).toEqual([]);
                expect(String(l1.injected).toLowerCase()).toBe(site.stored);

                // Layer 2 — the stored value is an answer, not a placeholder.
                if (l23.calendar) {
                    expect(l23.calendar.methodology).toBe(site.stored);
                    expect(l23.calendar.defaulted).toBe(false);
                }

                // Layer 3 — the resolver the document goes through agrees, and
                // says the site config is where it came from.
                if (l23.resolver) {
                    expect(l23.resolver.methodology).toBe(site.stored);
                    expect(l23.resolver.source).toBe('site-config');
                    // The key it reads must be one the object has. Two defects
                    // in this delivery were a key and a function that did not
                    // exist, each swallowed by its own guard.
                    expect(l23.resolver.keys).toContain('program');
                    expect(l23.resolver.keys).not.toContain('soil');
                }

                // Layer 3b — the product's own function, not a path re-derived
                // here. It answered null on every site until the id source and
                // the key were corrected; a green run above with this absent
                // would have proved nothing about the panel a user sees.
                expect(l23.prebblePresent).toBe(true);
                expect(l23.prebble).toBe(site.stored);
            }
            expect(results.length).toBe(SITES.length);
        }, 900000);

        test('the "not set" population on this stand is empty, which is what the claim rested on', () => {
            expect.hasAssertions();
            const notSet = results.filter((r) => r.page.notSetPill.length > 0);
            process.stdout.write('[gh521] sites printing "Methodology: not set": '
                + JSON.stringify(notSet.map((r) => r.site)) + '\n');
            expect(notSet).toEqual([]);
        });
    });
}

/**
 * GH-523 — who actually consumes the resolver whose climate does not resolve.
 *
 * GH-522 measured that `resolveExportInputs()` answers `climateNormals: null`,
 * `climateReason: 'no-coordinates'` on the Plan page for every site, because
 * FIELD_PATHS reads the site ROW (nutrition-program-inputs.js:682, GH-473) and
 * plan.blade.php loads no store to serve it. That is a fact about a function.
 *
 * It is not yet a fact about a client. A defect in a function nobody on that
 * page reads is a different thing from one whose numbers are printed, and the
 * difference decides what the fix has to be. This file measures what a person
 * would SEE — on the page and in the document — for a site in that state, and
 * names which of three outcomes holds:
 *
 *   A. The figures are printed and the temperatures behind them are the site's
 *      real normals — so the Plan page gets its climate somewhere else and this
 *      resolver is not its supplier.
 *   B. The figures are printed and the temperatures are NOT the site's normals
 *      — the worst case: plausible numbers for the wrong place.
 *   C. Nothing is computed and the screen says the climate is unavailable — the
 *      defect is visible and does not lie.
 *
 * A and B are told apart against the NASA POWER normals recorded in
 * tests/fixtures/gh426-nz-monthly-normals.json, which is an independent source
 * (see gh426-soil-temp-options-live).
 *
 * Site: Test5 - NZ, the site the 'no-coordinates' answer was measured on.
 * This file MEASURES. It asserts only that the measurement was taken and that
 * one of the three outcomes is named; it does not decide whether the product is
 * right, which is with the analyst.
 *
 * Run: GILBA_E2E=1 npx jest tests/e2e/gh523-climate-consumer-live.test.js
 */

'use strict';

const fs = require('fs');
const path = require('path');
const { guardStand } = require('./lib/stand-guard');

const ENABLED = process.env.GILBA_E2E === '1';

let credentials = {};
try {
    credentials = JSON.parse(fs.readFileSync(
        process.env.GILBA_E2E_CREDENTIALS || path.join(__dirname, '.e2e-credentials.json'), 'utf8'));
} catch (e) { credentials = {}; }

const BASE_URL = process.env.GILBA_E2E_URL || credentials.url || 'http://127.0.0.1:8080';
const EMAIL = process.env.GILBA_E2E_EMAIL || credentials.email;
const PASSWORD = process.env.GILBA_E2E_PASSWORD || credentials.password;

const SITE = { name: 'Test5 - NZ', id: '019e96f3-9294-72be-a13c-7fa7427afd5a' };
const NORMALS = JSON.parse(fs.readFileSync(
    path.join(__dirname, '../fixtures/gh426-nz-monthly-normals.json'), 'utf8'));
const AUCKLAND = NORMALS.locations.auckland.T2M.map((t) => Math.round(t * 10) / 10);

let chromium = null;
try { ({ chromium } = require('playwright')); } catch (e) { /* reported below */ }

const out = (s) => process.stdout.write('[gh523] ' + s + '\n');

if (!ENABLED) {
    process.stdout.write('[e2e] gh523-climate-consumer-live skipped (needs the live stack)\n');
    test.skip('GH-523 climate consumer (disabled)', () => {});
} else {
    describe('GH-523 — what a client sees when the climate does not resolve', () => {
        let browser, page, guard, previousActiveSiteId = null;
        const M = { resolver: null, plan: null, sample: null, doc: null, verdict: null };

        beforeAll(async () => {
            if (!chromium) throw new Error('playwright does not resolve — run `npm install`');
            if (!EMAIL || !PASSWORD) throw new Error('no credentials');
            browser = await chromium.launch();
            const context = await browser.newContext({ acceptDownloads: true });
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
            if (/\/login/.test(page.url())) throw new Error('login refused');

            const sites = await page.evaluate(async () => {
                const r = await fetch('/api/sites', { headers: { Accept: 'application/json' }, credentials: 'same-origin' });
                return r.json();
            });
            previousActiveSiteId = sites.active_site_id;
            await page.evaluate(async ({ id }) => {
                const t = document.querySelector('meta[name=csrf-token]');
                await fetch('/api/active-site', { method: 'PATCH',
                    headers: Object.assign({ 'Content-Type': 'application/json', Accept: 'application/json' },
                        t ? { 'X-CSRF-TOKEN': t.getAttribute('content') } : {}),
                    body: JSON.stringify({ site_id: id }), credentials: 'same-origin' });
            }, { id: SITE.id });

            // ── the Plan page, as a person meets it ─────────────────────────
            await page.goto(BASE_URL + '/plan', { waitUntil: 'domcontentloaded' });
            await page.waitForFunction(() => !!window.GilbaNutritionCalendar, null, { timeout: 30000 });
            await page.waitForTimeout(2500);
            await page.click('a[data-tab="nutrition"]');
            await page.waitForTimeout(1200);
            await page.waitForSelector('#plan-nut-sample-picker .sn-drop-btn', { timeout: 20000 });
            M.sample = await page.evaluate(() => {
                const btn = document.querySelector('#plan-nut-sample-picker .sn-drop-btn');
                if (!btn) return { ok: false };
                btn.click();
                const rows = Array.from(document.querySelectorAll('#plan-nut-sample-picker .sn-drop-row'));
                if (!rows.length) return { ok: false, reason: 'no rows' };
                const label = ((rows[0].querySelector('.sn-drop-cell-zone') || {}).textContent || '').trim();
                rows[0].click();
                return { ok: true, label: label, of: rows.length };
            });
            out('sample pinned: ' + JSON.stringify(M.sample));
            await page.waitForTimeout(1200);

            M.resolver = await page.evaluate(() => {
                try {
                    const NPI = window.GAIP_NutritionProgramInputs;
                    const id = NPI.getActiveSiteId();
                    const r = NPI.resolveExportInputs({ siteId: id });
                    return { siteId: id, climateNormals: r.climateNormals ? 'present' : null,
                        climateReason: r.climateReason,
                        lat: r.site && r.site.location ? r.site.location.lat : null };
                } catch (e) { return { error: String(e && e.message).slice(0, 160) }; }
            });
            out('resolver on this page: ' + JSON.stringify(M.resolver));

            await page.evaluate(() => { window.__gh523 = 0;
                document.addEventListener('gaip:nutrition-calendar-generated', () => { window.__gh523++; }); });
            await page.click('#plan-nut-generate-btn');
            await page.waitForFunction(() => window.__gh523 > 0, null, { timeout: 120000 }).catch(() => {});
            await page.waitForTimeout(4000);

            M.plan = await page.evaluate(() => {
                const cells = Array.from(document.querySelectorAll('td.gilba-nut-cell--n'))
                    .map((td) => parseFloat(td.textContent.trim()));
                const NC = window.GilbaNutritionCalendar;
                const p = (NC && NC.program) || null;
                const rows = (p && p.program && Array.isArray(p.program.monthly)) ? p.program.monthly : null;
                const banners = Array.from(document.querySelectorAll('.gilba-nut-banner, .db-empty, .plan-warning'))
                    .map((b) => b.textContent.replace(/\s+/g, ' ').trim()).filter(Boolean).slice(0, 6);
                const bodyText = (document.body.textContent || '').replace(/\s+/g, ' ');
                return {
                    nCells: cells.length, cells: cells,
                    temps: rows ? rows.map((r) => r.temp) : null,
                    banners: banners,
                    saysClimateUnavailable: /climate (data )?(is )?unavailable|no climate|climate normals unavailable/i.test(bodyText),
                };
            });
            out('plan: ' + JSON.stringify({ nCells: M.plan.nCells, temps: M.plan.temps,
                saysClimateUnavailable: M.plan.saysClimateUnavailable }));
            out('plan banners: ' + JSON.stringify(M.plan.banners));

            // ── the document ────────────────────────────────────────────────
            await page.goto(BASE_URL + '/reports/export', { waitUntil: 'domcontentloaded' });
            await page.waitForTimeout(9000);
            const dl = page.waitForEvent('download', { timeout: 600000 }).catch(() => null);
            await page.evaluate(() => {
                const CE = window.GAIP_CombinedExport;
                if (CE && typeof CE.exportCurrentSite === 'function') CE.exportCurrentSite();
            });
            const download = await dl;
            if (!download) { M.doc = { built: false }; return; }
            const docPath = path.join('/private/tmp/claude-501/-Users-katep-Documents-Work-gilba/'
                + '851f6013-c2b2-43ea-9e74-92be35e8fc2a/scratchpad', 'gh523-test5.docx');
            await download.saveAs(docPath);
            const { execFileSync } = require('child_process');
            const xml = execFileSync('unzip', ['-p', docPath, 'word/document.xml'],
                { maxBuffer: 256 * 1024 * 1024, encoding: 'utf8' });
            const text = xml.replace(/<[^>]+>/g, '').replace(/&amp;/g, '&');
            M.doc = { built: true, bytes: fs.statSync(docPath).size, chars: text.length,
                hasANR: /Annual Nutrient Requirements/.test(text),
                hasMonthly: /Monthly N Distribution/.test(text),
                saysUnavailable: /climate (data )?(is )?unavailable|climate normals unavailable/i.test(text) };
            out('document: ' + JSON.stringify(M.doc));
        }, 1200000);

        afterAll(async () => {
            if (page && previousActiveSiteId) {
                await page.evaluate(async ({ id }) => {
                    const t = document.querySelector('meta[name=csrf-token]');
                    await fetch('/api/active-site', { method: 'PATCH',
                        headers: Object.assign({ 'Content-Type': 'application/json', Accept: 'application/json' },
                            t ? { 'X-CSRF-TOKEN': t.getAttribute('content') } : {}),
                        body: JSON.stringify({ site_id: id }), credentials: 'same-origin' });
                }, { id: previousActiveSiteId }).catch(() => {});
            }
            if (guard) out(guard.report());
            if (browser) await browser.close();
        }, 180000);

        test('the measurement was taken', () => {
            expect.hasAssertions();
            expect(M.resolver).toBeTruthy();
            expect(M.plan).toBeTruthy();
        });

        test('which of the three outcomes holds, named against the recorded normals', () => {
            expect.hasAssertions();
            const printed = M.plan.nCells === 12;
            const temps = M.plan.temps;
            const matchesNormals = Array.isArray(temps) && temps.length === 12
                && temps.every((t, m) => Math.abs(Number(t) - AUCKLAND[m]) <= 1.0);
            out('Auckland normals (fixture): ' + JSON.stringify(AUCKLAND));
            out('temperatures the Plan table was built on: ' + JSON.stringify(temps));
            if (!printed) {
                M.verdict = 'C — nothing computed';
            } else if (matchesNormals) {
                M.verdict = 'A — printed, on the site\'s real normals: this resolver is not the Plan page\'s climate supplier';
            } else {
                M.verdict = 'B — printed, NOT on the site\'s normals: plausible figures for the wrong place';
            }
            out('VERDICT: ' + M.verdict);
            out('resolver said: climateNormals=' + M.resolver.climateNormals
                + ', climateReason=' + M.resolver.climateReason);
            out('document: ' + JSON.stringify(M.doc));
            expect(['A', 'B', 'C']).toContain(M.verdict[0]);
        });
    });
}

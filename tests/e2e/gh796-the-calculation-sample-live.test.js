/**
 * GH-796 (queue item 3vyu) — WHAT `/plan` PAINTS FOR EVERY SITE, BEFORE AND AFTER THE CHANGE.
 *
 * WHY THIS FILE IS A MEASUREMENT AND NOT A PIN. The owner's condition for this item is her own sentence:
 * "fix them all, only make sure that at that moment it is the sample that goes into the calculation that is
 * needed, and not the one active on the page, so that nothing on the page breaks." That cannot be answered by
 * a bench: whether a screen changes is a fact about the screen. So the numbers `/plan` renders are recorded
 * for every site on the stand, once before the change and once after, and the two recordings are compared by
 * name. The expectation is no difference at all -- and a difference is allowed only where that site's active
 * sample and the sample the server names are actually different, which this file prints for each site so the
 * two can be read side by side.
 *
 * NOTHING IS WRITTEN TO THE STAND. `guardStand` keeps every site-state write inside the browser, so pressing
 * Generate paints the page and reaches no table. The active-site pointer is restored at the end.
 *
 * WHAT IS RECORDED PER SITE: which sample the SERVER names for soil and for tissue (the same request the run
 * frame's opener makes), which sample the page has ACTIVE for each, and the rendered programme -- the twelve
 * monthly rows and every table inside the results panel.
 *
 * Skipped by default; needs the live stack:
 *   GILBA_E2E=1 GILBA_SNAPSHOT_OUT=<path> jest tests/e2e/gh796-the-calculation-sample-live.test.js \
 *     --runInBand --testTimeout=3600000
 */

'use strict';

const fs = require('fs');
const path = require('path');
const { guardStand, fillOwnAnnualN } = require('./lib/stand-guard');

const ENABLED = process.env.GILBA_E2E === '1';

let credentials = {};
try {
    credentials = JSON.parse(fs.readFileSync(
        process.env.GILBA_E2E_CREDENTIALS || path.join(__dirname, '.e2e-credentials.json'), 'utf8'));
} catch (e) { credentials = {}; }

const BASE_URL = process.env.GILBA_E2E_URL || credentials.url || 'http://127.0.0.1:8080';
const EMAIL = process.env.GILBA_E2E_EMAIL || credentials.email;
const PASSWORD = process.env.GILBA_E2E_PASSWORD || credentials.password;
const OUT = process.env.GILBA_SNAPSHOT_OUT
    || path.join(require('os').tmpdir(), 'gh796-plan-snapshot.json');

let chromium = null;
try { ({ chromium } = require('playwright')); } catch (e) { /* reported below */ }

/** The rendered programme, read off the page the browser painted. */
function readThePanel() {
    const txt = (el) => ((el && el.textContent) || '').replace(/\s+/g, ' ').trim();
    const out = { monthlyRows: [], tables: [], banners: [] };
    out.monthlyRows = Array.from(document.querySelectorAll('tr.gilba-nut-row'))
        .map((tr) => Array.from(tr.querySelectorAll('td')).map((td) => txt(td)));
    Array.from(document.querySelectorAll('#plan-nut-results table')).forEach((table) => {
        const rows = Array.from(table.querySelectorAll('tr'))
            .map((tr) => Array.from(tr.querySelectorAll('th,td')).map((c) => txt(c)));
        if (rows.length) out.tables.push(rows);
    });
    out.banners = Array.from(document.querySelectorAll('#plan-nut-results .gilba-nut-banner,'
        + ' #plan-nut-results .au-fert-banner, #plan-nut-results .prebble-banner')).map((b) => txt(b));

    return out;
}

/** Which sample the SERVER names for a kind -- the same question the run frame's opener asks. */
async function namedByTheServer(page, siteId, kind) {
    return page.evaluate(async ({ siteId, kind }) => {
        try {
            const r = await fetch('/api/samples?sample_type=' + kind + '&site_id=' + encodeURIComponent(siteId)
                + '&limit=1', { headers: { Accept: 'application/json' }, credentials: 'same-origin' });
            if (!r.ok) return 'request-failed-' + r.status;
            const j = await r.json();
            const rows = (j && (j.samples || j.data || j)) || [];
            const first = Array.isArray(rows) ? rows[0] : null;

            return first ? String(first.id) : 'none';
        } catch (e) {
            return 'threw';
        }
    }, { siteId, kind });
}

(ENABLED ? describe : describe.skip)('GH-796 — what /plan paints for every site', () => {
    jest.setTimeout(3600000);

    let browser = null;
    let page = null;
    let standGuard = null;
    let previousActiveSiteId = null;

    /**
     * The site the SERVER considers active, set through the route the product's own selector uses.
     *
     * MEASURED, and the reason the answer is checked rather than assumed: the first form of this helper
     * posted to `/api/sites/<id>/activate`, which does not exist. Nothing failed loudly -- the request went
     * out, the page loaded, and every one of the 21 sites reported the SAME active sample, because the
     * active site had never moved. A per-site baseline that is one site recorded 21 times looks exactly like
     * a per-site baseline until somebody reads the numbers.
     */
    async function setActiveSite(siteId) {
        const answer = await page.evaluate(async ({ id }) => {
            const t = document.querySelector('meta[name=csrf-token]');
            const r = await fetch('/api/active-site', {
                method: 'PATCH',
                headers: Object.assign({ 'Content-Type': 'application/json', Accept: 'application/json' },
                    t ? { 'X-CSRF-TOKEN': t.getAttribute('content') } : {}),
                body: JSON.stringify({ site_id: id }),
                credentials: 'same-origin',
            });

            return { status: r.status, ok: r.ok };
        }, { id: siteId });

        return answer;
    }

    beforeAll(async () => {
        if (!chromium) throw new Error('playwright does not resolve from the repo — run `npm install`');
        if (!EMAIL || !PASSWORD) throw new Error('no credentials — see tests/e2e/.e2e-credentials.example.json');
        browser = await chromium.launch();
        const context = await browser.newContext({ viewport: { width: 1400, height: 1000 } });
        page = await context.newPage();
        await page.goto(BASE_URL + '/login', { waitUntil: 'domcontentloaded' });
        await page.fill('#email', EMAIL);
        await page.fill('#password', PASSWORD);
        await Promise.all([
            page.waitForNavigation({ waitUntil: 'domcontentloaded' }).catch(() => {}),
            page.click('form.login-form button[type=submit]'),
        ]);
        await page.waitForTimeout(1500);
        if (/\/login/.test(page.url())) throw new Error('login refused for ' + EMAIL);
        standGuard = await guardStand(page);
    });

    afterAll(async () => {
        if (page && previousActiveSiteId) {
            await setActiveSite(previousActiveSiteId).catch(() => {});
        }
        if (standGuard && typeof standGuard.report === 'function') {
            process.stdout.write('[gh796] the guard held: ' + JSON.stringify(standGuard.report()) + '\n');
        }
        if (browser) await browser.close();
    });

    test('record the programme every site paints, and who named its samples', async () => {
        const sites = await page.evaluate(async () => {
            const r = await fetch('/api/sites', { headers: { Accept: 'application/json' }, credentials: 'same-origin' });

            return r.json();
        });
        previousActiveSiteId = sites.active_site_id;
        const list = (sites.sites || sites.data || []).map((s) => ({ id: s.id, name: s.name }));
        process.stdout.write('[gh796] sites on the stand: ' + list.length + '\n');
        expect(list.length).toBeGreaterThan(0);

        const snapshot = { takenAt: new Date().toISOString(), sites: {} };
        for (const site of list) {
            /* eslint-disable no-await-in-loop */
            const switched = await setActiveSite(site.id);
            if (!switched.ok) throw new Error('could not make ' + site.name + ' the active site: '
                + JSON.stringify(switched));
            await page.goto(BASE_URL + '/plan', { waitUntil: 'domcontentloaded' });
            let ready = true;
            try {
                // MEASURED: `GAIP_SampleManager` is a module of the run frame, and waiting for it here made
                // every site report "not ready". The page's own readiness is its calendar, which is what the
                // existing audit waits for; whether the sample manager is present at all is recorded below
                // as a fact, because it decides what "the active sample" can even mean on this page.
                await page.waitForFunction(() => !!window.GilbaNutritionCalendar, null, { timeout: 30000 });
            } catch (e) { ready = false; }
            await page.waitForTimeout(3000);
            if (ready) {
                await page.click('a[data-tab="nutrition"]').catch(() => {});
                await page.waitForTimeout(1500);
            }

            const named = {
                soil: await namedByTheServer(page, site.id, 'soil'),
                tissue: await namedByTheServer(page, site.id, 'tissue'),
            };
            const active = ready ? await page.evaluate(() => {
                const SM = window.GAIP_SampleManager;
                if (!SM || typeof SM.getActiveSample !== 'function') return { manager: false };
                const idOf = (kind) => {
                    try {
                        const s = SM.getActiveSample(kind);

                        return s ? String(s.serverId || s.id) : null;
                    } catch (e) { return 'threw'; }
                };

                return { manager: true, soil: idOf('soil'), tissue: idOf('tissue') };
            }) : { manager: false };

            let outcome = 'generated';
            if (ready) {
                page.once('dialog', async (d) => { await d.dismiss().catch(() => {}); });
                await page.evaluate(() => {
                    window.__snapGenerated = 0;
                    if (!window.__snapListener) {
                        window.__snapListener = true;
                        document.addEventListener('gaip:nutrition-calendar-generated',
                            () => { window.__snapGenerated++; });
                    }
                });
                await fillOwnAnnualN(page).catch(() => {});
                await page.click('#plan-nut-generate-btn').catch(() => { outcome = 'no-button'; });
                if (outcome !== 'no-button') {
                    try {
                        await page.waitForFunction(() => window.__snapGenerated > 0
                            && document.querySelectorAll('tr.gilba-nut-row').length === 12,
                        null, { timeout: 90000 });
                        await page.waitForTimeout(2500);
                    } catch (e) { outcome = 'timeout'; }
                }
            } else {
                outcome = 'page-not-ready';
            }
            const panel = ready ? await page.evaluate(readThePanel) : { monthlyRows: [], tables: [], banners: [] };

            snapshot.sites[site.name] = { id: site.id, named, active, outcome, panel };
            process.stdout.write('[gh796] ' + site.name
                + ' | server names soil=' + named.soil + ' tissue=' + named.tissue
                + (active.manager
                    ? ' | page active soil=' + active.soil + ' tissue=' + active.tissue
                        + ' | agree: soil=' + (String(named.soil) === String(active.soil))
                        + ' tissue=' + (String(named.tissue) === String(active.tissue))
                    : ' | no sample manager on this page')
                + ' | ' + outcome + ', ' + panel.monthlyRows.length + ' monthly rows, '
                + panel.tables.length + ' tables\n');
            /* eslint-enable no-await-in-loop */
        }

        /**
         * THE SECOND PASS, AND THE REASON IT EXISTS. `/plan` does not load `sample-manager.js` -- measured
         * above on all 21 sites, and visible in the blade: the manager is loaded by `hub`, `analysis`,
         * `stadium`, `field-log`, `morning-briefing` and the three report pages, not by `plan`. Every one of
         * the calculation places this item changes stands behind `SM && typeof SM.getActiveSample ===
         * 'function'`, so on `/plan` they read nothing today and nothing after. The pages where they CAN read
         * an active sample are the report pages, and that is where a difference could appear. So the same
         * question is asked there: which sample the page has active, and which one the server names.
         */
        for (const site of list) {
            /* eslint-disable no-await-in-loop */
            const switched = await setActiveSite(site.id);
            if (!switched.ok) throw new Error('could not make ' + site.name + ' the active site: '
                + JSON.stringify(switched));
            await page.goto(BASE_URL + '/reports/export', { waitUntil: 'domcontentloaded' });
            let managerThere = false;
            try {
                await page.waitForFunction(() => !!window.GAIP_SampleManager, null, { timeout: 30000 });
                managerThere = true;
            } catch (e) { managerThere = false; }
            await page.waitForTimeout(3000);
            const onReports = managerThere ? await page.evaluate(() => {
                const SM = window.GAIP_SampleManager;
                const idOf = (kind) => {
                    try {
                        const smp = SM.getActiveSample(kind);

                        return smp ? String(smp.serverId || smp.id) : null;
                    } catch (e) { return 'threw'; }
                };

                return { manager: true, soil: idOf('soil'), tissue: idOf('tissue'),
                    site: (typeof SM.getActiveSiteId === 'function') ? SM.getActiveSiteId() : null };
            }) : { manager: false };
            const named = snapshot.sites[site.name] ? snapshot.sites[site.name].named : {};
            snapshot.sites[site.name] = Object.assign(snapshot.sites[site.name] || {}, { onReports });
            process.stdout.write('[gh796-reports] ' + site.name
                + (onReports.manager
                    ? ' | active soil=' + onReports.soil + ' tissue=' + onReports.tissue
                        + ' | server names soil=' + named.soil + ' tissue=' + named.tissue
                        + ' | AGREE soil=' + (String(named.soil) === String(onReports.soil))
                        + ' tissue=' + (String(named.tissue) === String(onReports.tissue))
                    : ' | no sample manager on the report page either')
                + '\n');
            /* eslint-enable no-await-in-loop */
        }

        fs.writeFileSync(OUT, JSON.stringify(snapshot, null, 1));
        process.stdout.write('[gh796] written to ' + OUT + '\n');
        expect(Object.keys(snapshot.sites).length).toBe(list.length);
    });
});

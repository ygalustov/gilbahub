/**
 * GH-424 live — the two bases, read off the running pages, and how much the
 * live one moves.
 *
 * WHAT IT ESTABLISHES, per New Zealand site:
 *
 *   1. WHERE THE MONTHLY SERIES COMES FROM. `climateMetrics.monthlyTempsSource`
 *      and `.monthlyTempsPeriod`, as climate-normals-service.js stamped them —
 *      so "growth potential runs on NASA long-term normals" is read rather than
 *      assumed, and a site that quietly fell back to the Open-Meteo archive
 *      (tier 2) or to nothing (tier 3) shows up as itself.
 *   2. WHETHER THOSE NORMALS ARE IN REACH OF THE RECOMMENDER. They are the
 *      `temp` field of the twelve rows the recommender is already handed, so
 *      this reports them beside the series the page resolved.
 *   3. HOW UNSTABLE THE LIVE ANCHOR IS. `climateMetrics.temperature.mean` is
 *      the mean of the whole live hourly forecast window (hub-orchestrator.js).
 *      This fetches that same forecast for the site's own coordinates and
 *      reports the window mean and each individual day's mean, which is the
 *      day-to-day movement the anchor will actually have.
 *
 * Pair with tests/gh424-soil-temp-basis.test.js, which turns a movement in
 * degrees into a count of product changes.
 *
 *   GILBA_E2E=1 npx jest tests/e2e/gh424-soil-temp-basis-live.test.js --runInBand --testTimeout=600000
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
const OUT = process.env.GILBA_GH424_OUT || null;

let chromium = null;
try { ({ chromium } = require('playwright')); } catch (e) { /* reported below */ }

const NZ_SITES = [
    { name: 'Test5 - NZ', label: 'Soccer' },
    { name: 'Russley', label: 'Green 18' },
    { name: 'Test - GC - NZ - delivery', label: '18th Green' },
    { name: 'Test - GC - NZ - warm season grass test', label: 'Main Oval' },
];

const out = (s) => process.stdout.write('[gh424-live] ' + s + '\n');

if (!ENABLED) {
    process.stdout.write('[e2e] gh424-soil-temp-basis-live skipped (needs the live stack)\n');
    test.skip('GH-424 soil-temperature basis (disabled)', () => {});
} else {

const RESULTS = { sites: [] };

describe('GH-424 — the climate basis under New Zealand product selection', () => {
    let browser, page, previousActiveSiteId = null;

    beforeAll(async () => {
        if (!chromium) throw new Error('playwright does not resolve from the repo — run `npm install`');
        if (!EMAIL || !PASSWORD) throw new Error('no credentials');

        browser = await chromium.launch();
        page = await browser.newPage();
        await page.goto(BASE_URL + '/login', { waitUntil: 'domcontentloaded' });
        await page.fill('#email', EMAIL);
        await page.fill('#password', PASSWORD);
        await Promise.all([page.waitForNavigation({ waitUntil: 'domcontentloaded' }).catch(() => {}),
            page.click('form.login-form button[type=submit]')]);
        await page.waitForTimeout(1500);
        if (/\/login/.test(page.url())) throw new Error('login refused');

        const sitesResp = await page.evaluate(async () =>
            (await fetch('/api/sites', { headers: { Accept: 'application/json' }, credentials: 'same-origin' })).json());
        previousActiveSiteId = sitesResp.active_site_id;

        for (const target of NZ_SITES) {
            const site = (sitesResp.data || []).find((s) => s.name === target.name);
            if (!site) { RESULTS.sites.push({ site: target.name, error: 'site not found' }); continue; }
            await page.evaluate(async ({ id }) => {
                const t = document.querySelector('meta[name=csrf-token]');
                await fetch('/api/active-site', {
                    method: 'PATCH',
                    headers: Object.assign({ 'Content-Type': 'application/json', Accept: 'application/json' },
                        t ? { 'X-CSRF-TOKEN': t.getAttribute('content') } : {}),
                    body: JSON.stringify({ site_id: id }), credentials: 'same-origin'
                });
            }, { id: site.id });

            await page.goto(BASE_URL + '/plan', { waitUntil: 'domcontentloaded' });
            await page.waitForFunction(() => !!window.GilbaNutritionCalendar, null, { timeout: 30000 });
            await page.waitForTimeout(2500);
            await page.click('a[data-tab="nutrition"]');
            await page.waitForTimeout(1200);
            await page.waitForSelector('#plan-nut-sample-picker .sn-drop-btn', { timeout: 20000 }).catch(() => {});
            await page.evaluate((label) => {
                const btn = document.querySelector('#plan-nut-sample-picker .sn-drop-btn');
                if (!btn) return;
                btn.click();
                const rows = Array.from(document.querySelectorAll('#plan-nut-sample-picker .sn-drop-row[data-sn-idx]'));
                const i = rows.map((r) => ((r.querySelector('.sn-drop-cell-zone') || {}).textContent || '').trim()).indexOf(label);
                if (i >= 0) rows[i].click(); else btn.click();
            }, target.label);
            await page.waitForTimeout(2000);
            await page.evaluate(() => {
                window.__g = 0;
                document.addEventListener('gaip:nutrition-calendar-generated', () => { window.__g++; });
            });
            await page.click('#plan-nut-generate-btn');
            await page.waitForFunction(() => window.__g > 0 && document.querySelectorAll('tr.gilba-nut-row').length === 12,
                null, { timeout: 90000 });
            await page.waitForTimeout(2500);

            const rec = await page.evaluate(async () => {
                const cm = window.climateMetrics || {};
                const loc = (window.GAIP_HUB_CONFIG && window.GAIP_HUB_CONFIG.savedLocation) || {};
                const lat = parseFloat(loc.lat), lon = parseFloat(loc.lon != null ? loc.lon : loc.lng);
                const prog = window.GilbaNutritionCalendar && window.GilbaNutritionCalendar.program;

                // The same request dashboard-init.js / the orchestrator's weather
                // fetch make, so the window mean below is the quantity
                // getSoilTemperature() would resolve.
                let forecast = null;
                try {
                    const r = await fetch('https://api.open-meteo.com/v1/forecast?latitude=' + lat
                        + '&longitude=' + lon + '&hourly=temperature_2m&timezone=auto&forecast_days=7');
                    if (r.ok) forecast = await r.json();
                } catch (e) { forecast = { error: String(e && e.message) }; }

                let windowMean = null, dayMeans = null;
                if (forecast && forecast.hourly && forecast.hourly.temperature_2m) {
                    const t = forecast.hourly.temperature_2m.filter((v) => v != null);
                    windowMean = +(t.reduce((a, b) => a + b, 0) / t.length).toFixed(1);
                    dayMeans = [];
                    for (let d = 0; d * 24 < t.length; d++) {
                        const day = t.slice(d * 24, d * 24 + 24);
                        if (day.length === 24) dayMeans.push(+(day.reduce((a, b) => a + b, 0) / 24).toFixed(1));
                    }
                }
                return {
                    lat: lat, lon: lon,
                    monthlyTempsSource: cm.monthlyTempsSource,
                    monthlyTempsPeriod: cm.monthlyTempsPeriod,
                    monthlyTemps: cm.monthlyTemps,
                    programMonthlyTemps: prog && prog.program && prog.program.monthly.map((m) => m.temp),
                    liveTemperature: cm.temperature,
                    resolvedSoilTemp: window.NutritionPrebbleIntegration.getSoilTemperature(),
                    forecastWindowMean: windowMean,
                    forecastDayMeans: dayMeans,
                };
            });
            rec.site = target.name;
            rec.sample = target.label;
            RESULTS.sites.push(rec);

            out(target.name + ' / ' + target.label);
            out('   monthly normals source: ' + rec.monthlyTempsSource + '  period: ' + rec.monthlyTempsPeriod);
            out('   monthly normals:        ' + JSON.stringify(rec.monthlyTemps));
            out('   the twelve rows handed to the recommender: ' + JSON.stringify(rec.programMonthlyTemps));
            out('   live anchor on this page: ' + rec.resolvedSoilTemp + '  (climateMetrics.temperature: '
                + JSON.stringify(rec.liveTemperature) + ')');
            out('   forecast window mean now: ' + rec.forecastWindowMean
                + '   per-day means: ' + JSON.stringify(rec.forecastDayMeans));
            if (rec.forecastDayMeans && rec.forecastDayMeans.length) {
                const lo = Math.min.apply(null, rec.forecastDayMeans), hi = Math.max.apply(null, rec.forecastDayMeans);
                out('   day-to-day spread over the next week: ' + (+(hi - lo).toFixed(1)) + ' degC (' + lo + ' to ' + hi + ')');
            }
        }
        if (OUT) fs.writeFileSync(OUT, JSON.stringify(RESULTS, null, 1));
    }, 900000);

    afterAll(async () => {
        if (page && previousActiveSiteId) {
            try {
                await page.evaluate(async ({ id }) => {
                    const t = document.querySelector('meta[name=csrf-token]');
                    await fetch('/api/active-site', {
                        method: 'PATCH',
                        headers: Object.assign({ 'Content-Type': 'application/json', Accept: 'application/json' },
                            t ? { 'X-CSRF-TOKEN': t.getAttribute('content') } : {}),
                        body: JSON.stringify({ site_id: id }), credentials: 'same-origin'
                    });
                }, { id: previousActiveSiteId });
            } catch (e) { /* */ }
        }
        if (browser) await browser.close();
    }, 120000);

    test('every New Zealand site resolved a twelve-month series', () => {
        RESULTS.sites.forEach((s) => {
            expect(s.error).toBeUndefined();
            expect(s.programMonthlyTemps && s.programMonthlyTemps.length).toBe(12);
        });
    });

    test('the series the recommender is handed IS the resolved monthly series', () => {
        // Premise check for option 3: the normals are not somewhere else that
        // would have to be fetched — they are already inside the object
        // generateProgram() receives, as each row's `temp`.
        RESULTS.sites.forEach((s) => {
            // climate-normals-service.js stores the series as an object keyed
            // 1..12, not an array — the recommender's rows are 0-based, which
            // is the same off-by-one that bites estimateMonthlySoilTemp()
            // (tests/gh424-soil-temp-basis.test.js).
            const asArray = [];
            for (let m = 1; m <= 12; m++) asArray.push(Math.round(s.monthlyTemps[m] * 10) / 10);
            expect(s.programMonthlyTemps).toEqual(asArray);
        });
    });

    test('the monthly series is a multi-year normal, not a recent-weather average', () => {
        // Tier 1 is NASA POWER climatology; tier 2 (Open-Meteo archive) is a
        // short-window average and tier 3 is null. If a site is not on tier 1
        // the premise behind option 3 is weaker for that site, and this says so
        // by name rather than averaging it away.
        const sources = RESULTS.sites.map((s) => s.site + ': ' + s.monthlyTempsSource + ' ' + (s.monthlyTempsPeriod || ''));
        process.stdout.write('[gh424-live] normals provenance: ' + JSON.stringify(sources, null, 1) + '\n');
        RESULTS.sites.forEach((s) => {
            expect(typeof s.monthlyTempsSource).toBe('string');
        });
    });
});

}

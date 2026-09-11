/**
 * GH-428 live — the outer soil temperature, and what the trace block says about it.
 *
 * THE QUESTION. After GH-427 there are two soil temperatures in the New Zealand
 * path. An OUTER one, resolved once when the integration assembles its context
 * (`NutritionPrebbleIntegration.getSoilTemperature()`), and a PER-MONTH one the
 * recommender builds inside its own loop from each calendar row's `temp` — the
 * site's monthly climate normals. `generateProgram()` spreads the outer context
 * and then overwrites `soilTemp` with the month's own figure, so the outer value
 * reaches no decision. The Plan page's calculation-trace block nevertheless read
 * exactly the outer value and presented it as the figure driving product
 * selection.
 *
 * WHAT THIS FILE ESTABLISHES, per New Zealand site, off the running page:
 *
 *   1. WHAT THE OUTER VALUE WAS AND WHERE IT CAME FROM. Every source
 *      `getSoilTemperature()` consulted, probed individually, rather than
 *      inferred from the resolution order. MEASURED, and it corrects the
 *      ticket's premise: the outer value was NOT a hardcoded fallback. On all
 *      four sites the first four live sources are null and the persisted
 *      analysis cache answers — Test5 13, Russley 10.4, both GC-NZ sites 9.6 —
 *      so the getter's trailing 15 is never reached. The figure on screen was
 *      a real reading from a real source. It just was not the one doing the
 *      work, which is what made it hard to see.
 *   2. WHAT THE RECOMMENDER ACTUALLY RAN ON. The twelve `temp` fields of the
 *      rows it was handed, beside the twelve the recommender now publishes as
 *      the series it used (`program.soilTempSeries`) — the trace block's new
 *      source. They must be the same twelve.
 *   3. WHAT THE TRACE BLOCK PRINTS. The rendered "Soil temperature (product
 *      selection)" row, and the "Monthly temperature normals" row above it. The
 *      whole point of the ticket is that a reader can see the first follows the
 *      second.
 *   4. THAT NOTHING MOVED. A full snapshot of each site's programme — the
 *      delivery summary table, every monthly product row with its rate, the
 *      annual product tally and the delivery totals — compared against
 *      tests/fixtures/gh428-nz-plan-snapshot.json, recorded before the change.
 *
 * Record the baseline (before the change):
 *   GILBA_E2E=1 GILBA_GH428_RECORD=1 npx jest tests/e2e/gh428-outer-soil-temp-live.test.js \
 *       --runInBand --testTimeout=900000
 * Verify (after the change), same command without GILBA_GH428_RECORD.
 */

'use strict';

const fs = require('fs');
const path = require('path');

const ENABLED = process.env.GILBA_E2E === '1';
const RECORD = process.env.GILBA_GH428_RECORD === '1';
const SNAPSHOT = path.join(__dirname, '..', 'fixtures', 'gh428-nz-plan-snapshot.json');

let credentials = {};
try {
    credentials = JSON.parse(fs.readFileSync(
        process.env.GILBA_E2E_CREDENTIALS || path.join(__dirname, '.e2e-credentials.json'), 'utf8'));
} catch (e) { credentials = {}; }

const BASE_URL = process.env.GILBA_E2E_URL || credentials.url || 'http://127.0.0.1:8080';
const EMAIL = process.env.GILBA_E2E_EMAIL || credentials.email;
const PASSWORD = process.env.GILBA_E2E_PASSWORD || credentials.password;

let chromium = null;
try { ({ chromium } = require('playwright')); } catch (e) { /* reported below */ }

// The four New Zealand sites on the development database, with the sample each
// was measured on in GH-422/GH-424 so the figures are comparable across tickets.
const NZ_SITES = [
    { key: 'test5', name: 'Test5 - NZ', pick: 'Soccer' },
    { key: 'russley', name: 'Russley', pick: 'Green 18' },
    { key: 'gc-delivery', name: 'Test - GC - NZ - delivery', pick: '18th Green' },
    { key: 'gc-warm', name: 'Test - GC - NZ - warm season grass test', pick: 'Main Oval' },
];

const out = (s) => process.stdout.write('[gh428] ' + s + '\n');

/* istanbul ignore next — evaluated in the page, not in node */
function probeInPage() {
    function num(v) { return (v === null || v === undefined || v === '') ? null : (isFinite(parseFloat(v)) ? parseFloat(v) : null); }

    var pi = window.NutritionPrebbleIntegration || {};
    var sources = {
        // The four live checks the deleted getter made, in its own order.
        'GAIP_SOIL_TEMP.T_50mm_mean': num(window.GAIP_SOIL_TEMP && window.GAIP_SOIL_TEMP.T_50mm_mean),
        'GAIP_STATE.sensor.soilTemp': num(window.GAIP_STATE && window.GAIP_STATE.sensor && window.GAIP_STATE.sensor.soilTemp),
        'climateMetrics.temperature.mean': num(window.climateMetrics && window.climateMetrics.temperature
            && window.climateMetrics.temperature.mean),
        'GAIP_STATE.climate.temperature': num(window.GAIP_STATE && window.GAIP_STATE.climate && window.GAIP_STATE.climate.temperature),
        // The persisted analysis cache it fell through to.
        'GAIP_DASHBOARD_DATA.computed.climate.temperature.mean': num(window.GAIP_DASHBOARD_DATA
            && window.GAIP_DASHBOARD_DATA.computed && window.GAIP_DASHBOARD_DATA.computed.climate
            && window.GAIP_DASHBOARD_DATA.computed.climate.temperature
            && window.GAIP_DASHBOARD_DATA.computed.climate.temperature.mean),
    };
    var firstResolved = null;
    Object.keys(sources).forEach(function (k) { if (firstResolved === null && sources[k] !== null) firstResolved = k; });

    var cal = (window.GilbaNutritionCalendar && window.GilbaNutritionCalendar.program) || null;
    var prog = window.GAIP_NUTRITION_PROGRAM || null;
    var ctx = window.__gh428ctx || null;

    // The rendered trace block, row by row.
    var inputRows = {};
    var host = document.querySelector('[data-gaip-calc-trace-host]');
    if (host) {
        var firstTable = host.querySelector('table');
        if (firstTable) {
            Array.prototype.slice.call(firstTable.querySelectorAll('tbody tr')).forEach(function (tr) {
                var tds = tr.children;
                if (!tds || tds.length < 2) return;
                // The row's explanatory note is a child div of the value cell;
                // split it off so `value` is the value the row states.
                var cell = tds[1].cloneNode(true);
                var noteEl = cell.querySelector('.gaip-ctrace-note');
                var noteTxt = noteEl ? (noteEl.textContent || '').replace(/\s+/g, ' ').trim() : null;
                if (noteEl && noteEl.parentNode) noteEl.parentNode.removeChild(noteEl);
                inputRows[(tds[0].textContent || '').trim()] = {
                    value: (cell.textContent || '').replace(/\s+/g, ' ').trim(),
                    source: tds[2] ? (tds[2].textContent || '').replace(/\s+/g, ' ').trim() : null,
                    note: noteTxt,
                };
            });
        }
    }

    // The summary card the trace block explains.
    var summary = {};
    Array.prototype.slice.call(document.querySelectorAll('h4')).forEach(function (h) {
        if (!/Nutrient Delivery Summary/i.test(h.textContent || '')) return;
        var card = h.parentElement;
        var t = card && card.querySelector('table');
        if (!t) return;
        Array.prototype.slice.call(t.querySelectorAll('tbody tr')).forEach(function (tr) {
            var tds = Array.prototype.slice.call(tr.children).map(function (td) {
                return (td.textContent || '').replace(/\s+/g, ' ').trim();
            });
            if (tds.length) summary[tds[0]] = tds.slice(1);
        });
    });

    function rate(p) {
        if (p.rateKgHa != null) return p.rateKgHa + ' kg/ha';
        if (p.rateLHa != null) return p.rateLHa + ' L/ha';
        return '?';
    }

    return {
        sources: sources,
        firstResolvedSource: firstResolved,
        getterPresent: typeof pi.getSoilTemperature === 'function',
        // Kept callable-or-not: after GH-428 the getter is gone and this is null.
        getterValue: typeof pi.getSoilTemperature === 'function' ? pi.getSoilTemperature() : null,
        contextKeys: ctx ? Object.keys(ctx).sort() : null,
        contextSoilTemp: ctx && Object.prototype.hasOwnProperty.call(ctx, 'soilTemp') ? ctx.soilTemp : undefined,
        contextHasSoilTemp: !!(ctx && Object.prototype.hasOwnProperty.call(ctx, 'soilTemp')),
        monthlyTempsSource: window.climateMetrics && window.climateMetrics.monthlyTempsSource,
        calendarRowTemps: cal && cal.program && cal.program.monthly ? cal.program.monthly.map(function (m) { return m.temp; }) : null,
        publishedSeries: prog && prog.soilTempSeries ? prog.soilTempSeries : null,
        traceRows: inputRows,
        traceFound: !!host,
        snapshot: {
            annualRequired: cal ? cal.annual_totals : null,
            summaryTable: summary,
            deliveryTotals: (prog && window.GAIP_NutritionDelivery)
                ? window.GAIP_NutritionDelivery.accumulate(prog.monthly || []).totals : null,
            monthly: prog && prog.monthly ? prog.monthly.map(function (m) {
                return {
                    month: m.month || m.month_name,
                    granular: (m.granular || []).map(function (p) { return p.name + ' x' + (p.splitCount || 1) + ' @ ' + rate(p); }),
                    liquid: (m.liquid || []).map(function (p) { return p.name + ' x' + (p.splitCount || 1) + ' @ ' + rate(p); }),
                    coveredBy: m.coveredBy ? (m.coveredBy.product + ' (' + m.coveredBy.month + ')') : null,
                };
            }) : null,
            annualProducts: prog && prog.annualSummary ? Object.keys(prog.annualSummary.products).sort().map(function (id) {
                var e = prog.annualSummary.products[id];
                return id + ': ' + e.name + ' x' + (e.applications || 0) + ' ' + Math.round(e.totalKg || 0);
            }) : null,
        },
    };
}

if (!ENABLED) {
    process.stdout.write('[e2e] gh428-outer-soil-temp-live skipped (needs the live stack)\n');
    test.skip('GH-428 outer soil temperature (disabled)', () => {});
} else {

let browser = null;
let page = null;
let previousActiveSiteId = null;
const RESULTS = {};

async function setActiveSite(id) {
    await page.evaluate(async ({ id }) => {
        const t = document.querySelector('meta[name=csrf-token]');
        await fetch('/api/active-site', {
            method: 'PATCH',
            headers: Object.assign({ 'Content-Type': 'application/json', Accept: 'application/json' },
                t ? { 'X-CSRF-TOKEN': t.getAttribute('content') } : {}),
            body: JSON.stringify({ site_id: id }), credentials: 'same-origin'
        });
    }, { id });
}

describe('GH-428 live — the outer soil temperature and the trace block', () => {
    beforeAll(async () => {
        if (!chromium) throw new Error('playwright does not resolve from the repo — run `npm install`');
        if (!EMAIL || !PASSWORD) throw new Error('no credentials — see tests/e2e/.e2e-credentials.json');

        browser = await chromium.launch();
        page = await browser.newPage();
        page.on('pageerror', (e) => out('pageerror: ' + (e && e.message)));

        await page.goto(BASE_URL + '/login', { waitUntil: 'domcontentloaded' });
        await page.fill('#email', EMAIL);
        await page.fill('#password', PASSWORD);
        await Promise.all([
            page.waitForNavigation({ waitUntil: 'domcontentloaded' }).catch(() => {}),
            page.click('form.login-form button[type=submit]')
        ]);
        await page.waitForTimeout(1500);
        if (/\/login/.test(page.url())) throw new Error('login refused for ' + EMAIL);

        const sites = await page.evaluate(async () =>
            (await fetch('/api/sites', { headers: { Accept: 'application/json' }, credentials: 'same-origin' })).json());
        previousActiveSiteId = sites.active_site_id;
        const byName = {};
        (sites.data || sites.sites || []).forEach((s) => { byName[s.name] = s.id; });

        for (const site of NZ_SITES) {
            const id = byName[site.name];
            if (!id) throw new Error('site not on this database: ' + site.name);
            await setActiveSite(id);
            await page.goto(BASE_URL + '/plan', { waitUntil: 'domcontentloaded' });
            await page.waitForFunction(() => !!window.GilbaNutritionCalendar, null, { timeout: 30000 });
            await page.waitForTimeout(2500);
            await page.click('a[data-tab="nutrition"]');
            await page.waitForTimeout(1200);
            await page.waitForSelector('#plan-nut-sample-picker .sn-drop-btn', { timeout: 20000 });

            const picked = await page.evaluate((needle) => {
                const btn = document.querySelector('#plan-nut-sample-picker .sn-drop-btn');
                if (!btn) return { ok: false, reason: 'no picker' };
                btn.click();
                const rows = Array.from(document.querySelectorAll('#plan-nut-sample-picker .sn-drop-row[data-sn-idx]'));
                const zones = rows.map((r) => ((r.querySelector('.sn-drop-cell-zone') || {}).textContent || '')
                    .replace(/^●\s*/, '').trim());
                const i = zones.indexOf(needle);
                if (i < 0) { btn.click(); return { ok: false, reason: 'zone not in picker', zones: zones }; }
                rows[i].click();
                return { ok: true, zone: zones[i] };
            }, site.pick);
            if (!picked.ok) throw new Error('could not pin "' + site.pick + '" on ' + site.name + ': ' + JSON.stringify(picked));
            await page.waitForTimeout(1200);

            await page.evaluate(() => {
                window.__gh428 = 0;
                window.__gh428ctx = null;
                document.addEventListener('gaip:nutrition-calendar-generated', () => { window.__gh428++; });
                document.addEventListener('gaip:prebble-program-generated', (e) => {
                    window.__gh428ctx = (e && e.detail && e.detail.context) || window.__gh428ctx;
                });
            });
            await page.click('#plan-nut-generate-btn');
            await page.waitForFunction(() => window.__gh428 > 0
                && document.querySelectorAll('tr.gilba-nut-row').length === 12, null, { timeout: 90000 });
            await page.waitForTimeout(3500);

            const rec = await page.evaluate(probeInPage);
            RESULTS[site.key] = rec;

            out('');
            out('=== ' + site.name + ' / ' + site.pick);
            out('  monthly normals source:  ' + rec.monthlyTempsSource);
            out('  calendar row temps:      ' + JSON.stringify(rec.calendarRowTemps));
            out('  published series used:   ' + JSON.stringify(rec.publishedSeries
                && rec.publishedSeries.map((e) => (e && e.temp !== undefined ? e.temp : e))));
            out('  outer getter present:    ' + rec.getterPresent + '   value: ' + rec.getterValue);
            Object.keys(rec.sources).forEach((k) => out('    source ' + k.padEnd(52) + ' ' + rec.sources[k]));
            out('  first source to resolve: ' + rec.firstResolvedSource);
            out('  context carries soilTemp: ' + rec.contextHasSoilTemp + '  (' + rec.contextSoilTemp + ')');
            out('  trace "Monthly temperature normals": '
                + JSON.stringify(rec.traceRows['Monthly temperature normals'] || null));
            out('  trace "Soil temperature (product selection)": '
                + JSON.stringify(rec.traceRows['Soil temperature (product selection)'] || null));
            out('  delivery totals: ' + JSON.stringify(rec.snapshot.deliveryTotals));
        }

        if (RECORD) {
            const payload = {
                _source: 'tests/e2e/gh428-outer-soil-temp-live.test.js with GILBA_GH428_RECORD=1',
                _recorded: new Date().toISOString(),
                _what: 'Each New Zealand site\'s Plan-page programme, recorded so GH-428 can prove '
                     + 'that removing the dead outer soil temperature moved no printed figure.',
                sites: {},
            };
            Object.keys(RESULTS).forEach((k) => { payload.sites[k] = RESULTS[k].snapshot; });
            fs.writeFileSync(SNAPSHOT, JSON.stringify(payload, null, 1));
            out('');
            out('recorded baseline -> ' + SNAPSHOT);
        }
    }, 1800000);

    afterAll(async () => {
        if (page && previousActiveSiteId) {
            try { await setActiveSite(previousActiveSiteId); } catch (e) { /* */ }
        }
        if (browser) await browser.close();
    }, 120000);

    test('every New Zealand site rendered a twelve-month programme and the trace block', () => {
        NZ_SITES.forEach((s) => {
            const r = RESULTS[s.key];
            expect(r).toBeDefined();
            expect(r.traceFound).toBe(true);
            expect(r.calendarRowTemps && r.calendarRowTemps.length).toBe(12);
            r.calendarRowTemps.forEach((t) => expect(typeof t).toBe('number'));
        });
    });

    test('the recommender publishes the twelve temperatures it ran on, and they ARE the normals', () => {
        // The trace block's new source. If this is null the recommender is not
        // publishing what it used, and the block would be back to guessing.
        NZ_SITES.forEach((s) => {
            const r = RESULTS[s.key];
            expect(Array.isArray(r.publishedSeries)).toBe(true);
            expect(r.publishedSeries.length).toBe(12);
            expect(r.publishedSeries.map((e) => e.temp)).toEqual(r.calendarRowTemps);
        });
    });

    test('no recommender context carries an outer soilTemp any more', () => {
        NZ_SITES.forEach((s) => {
            const r = RESULTS[s.key];
            expect(r.contextKeys).not.toBeNull();
            expect(r.contextKeys).not.toContain('soilTemp');
            expect(r.getterPresent).toBe(false);
        });
    });

    test('the trace block prints the twelve monthly figures, and they match the normals row', () => {
        NZ_SITES.forEach((s) => {
            const r = RESULTS[s.key];
            const normals = r.traceRows['Monthly temperature normals'];
            const used = r.traceRows['Soil temperature (product selection)'];
            expect(normals).toBeDefined();
            expect(used).toBeDefined();
            // Twelve figures, not one.
            const nums = (used.value.match(/-?\d+(\.\d+)?/g) || []).map(Number);
            expect(nums.length).toBe(12);
            // Visibly the same values as the row above, which is the point.
            expect(used.value.replace(/\s+/g, ' ').trim()).toBe(normals.value.replace(/\s+/g, ' ').trim());
            expect(nums).toEqual(r.calendarRowTemps.map((t) => Math.round(t * 10) / 10));
            // And it no longer claims its source is unknown.
            expect(used.source).not.toMatch(/SOURCE NOT AVAILABLE/);
        });
    });

    test('nothing in any programme moved', () => {
        if (RECORD) {
            out('baseline recorded — comparison skipped on this run');
            return;
        }
        const base = JSON.parse(fs.readFileSync(SNAPSHOT, 'utf8'));
        NZ_SITES.forEach((s) => {
            expect(RESULTS[s.key].snapshot).toEqual(base.sites[s.key]);
        });
    });
});

}

/**
 * Calculation audit — every site, every live soil sample, one Generate each,
 * read off the Plan page the browser painted.
 *
 * This file is a MEASUREMENT, not a regression pin. It drives /plan for each
 * site on the development database, presses Generate once per soil sample the
 * picker offers, and records, per generation:
 *
 *   - the form as the page resolved it (annual N, cap, mode, clipping);
 *   - the calendar's own programme object (annual_totals, annual_removal,
 *     annual_lift, adjustments, monthly rows, soil ppm, missing_soil_data);
 *   - the twelve RENDERED rows of "Monthly Nutrient Program" (all six nutrient
 *     cells, not only N);
 *   - the regional panel's RENDERED "Nutrient Delivery Summary" (Current,
 *     Removal, Required, Delivered, Range, Balance, Status per N/P/K);
 *   - the RENDERED "Annual Product Summary" rows and its Total Delivered /
 *     Required / Balance footer;
 *   - the visible Monthly Schedule cells (requirement string, granular, liquid,
 *     notes) so a shortfall can be traced to the month it happened in;
 *   - the recommender's programme object (per-month applications with rate,
 *     split count, analysis, declared delivery, rateReduced) — the raw
 *     material behind the rows above;
 *   - the calendar's collectFromState() output — what the engine was actually
 *     handed (soil ppm, pH, methodology, species, surface, ranges, C4 flag);
 *   - the console lines the recommenders emit when they cap or skip something.
 *
 * Everything is written to one JSON file (GILBA_AUDIT_OUT) and the tests
 * below assert the arithmetic invariants the audit brief asks for. A failing
 * test here is a finding, not a build break.
 *
 * Skipped by default; needs the live stack:
 *   GILBA_E2E=1 jest tests/e2e/calc-audit-all-sites-live.test.js --runInBand --testTimeout=3600000
 * Optional: GILBA_AUDIT_SITES="Burns,Westview" (substring match on name),
 *           GILBA_AUDIT_MAX_SAMPLES=3 (per site), GILBA_AUDIT_OUT=<path>.
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
// GH-437: the default output lives in a gitignored directory. It used to be
// written to the repository root as a TRACKED file, so every run of this
// harness put a 2.1 MB diff in `git status` alongside the code change it was
// measuring -- a measurement artefact presented as a source edit.
const OUT = process.env.GILBA_AUDIT_OUT || path.join(__dirname, '../../calc-audit/results.json');
const SITE_FILTER = (process.env.GILBA_AUDIT_SITES || '').split(',').map((s) => s.trim()).filter(Boolean);
const MAX_SAMPLES = parseInt(process.env.GILBA_AUDIT_MAX_SAMPLES || '0', 10) || 0;
// The UK integration is out of scope by the owner's decision.
const SKIP_NAMES = /Test6 - UK/i;

let chromium = null;
try { ({ chromium } = require('playwright')); } catch (e) { /* reported below */ }

function num(v) {
    const n = parseFloat(String(v == null ? '' : v).replace(/[^0-9.\-]/g, ''));
    return isFinite(n) ? n : null;
}

/* ───────────────────────── in-page readers ───────────────────────── */

/* istanbul ignore next — runs in the browser */
function readPlanInPage() {
    const out = {};
    const $ = (s) => document.querySelector(s);
    const txt = (el) => (el ? (el.textContent || '').replace(/\s+/g, ' ').trim() : '');

    out.form = {
        annualN: ($('#plan-nut-annual-n') || {}).value || null,
        maxN: ($('#plan-nut-max-n') || {}).value || null,
        distribution: ($('#plan-nut-distribution') || {}).value || null,
        clipping: ($('#plan-nut-clipping') || {}).value || null,
        sampleLabel: txt($('#plan-nut-sample-label')),
        monthlyN: ($('#plan-nut-monthly-n') || {}).value || null
    };

    const NC = window.GilbaNutritionCalendar;
    const p = NC && NC.program;
    out.program = p ? {
        meta: p.meta, soil: p.soil, annual_totals: p.annual_totals, annual_removal: p.annual_removal,
        annual_lift: p.annual_lift, annual_totals_range: p.annual_totals_range,
        annual_totals_range_source: p.annual_totals_range_source,
        missing_soil_data: p.missing_soil_data, tissue_gate_applied: p.tissue_gate_applied,
        adjustments: p.adjustments, monthly: (p.program && p.program.monthly) || null,
        error: p.error || null, climateDataUnavailable: p.climateDataUnavailable || false
    } : null;

    try {
        const inp = NC && typeof NC.collectFromState === 'function' ? NC.collectFromState() : null;
        out.inputs = inp ? {
            soilPpm: inp.soilPpm, pH: inp.pH, CEC: inp.CEC, soilTexture: inp.soilTexture,
            methodology: inp.methodology, species: inp.species, speciesDisplay: inp.speciesDisplay,
            surfaceType: inp.surfaceType, annualNOverride: inp.annualNOverride, maxNPerMonth: inp.maxNPerMonth,
            distribution: inp.distribution, clippingManagement: inp.clippingManagement, isC4: inp.isC4,
            hemisphere: inp.hemisphere, latitude: inp.latitude, longitude: inp.longitude,
            traffic: inp.traffic, trafficModifier: inp.trafficModifier, bulkDensity: inp.bulkDensity,
            soilDepth: inp.soilDepth, tissuePercent: inp.tissuePercent, ranges: inp.ranges,
            rangeSources: inp.rangeSources, inputSources: inp.inputSources,
            monthlyTemps: inp.monthlyTemps || null, overseedConfig: inp.overseedConfig || null
        } : null;
    } catch (e) { out.inputs = { error: String(e && e.message) }; }

    out.stateSoil = (window.GAIP_STATE && window.GAIP_STATE.inputs && window.GAIP_STATE.inputs.soil) || null;

    // Rendered Monthly Nutrient Program rows (all six nutrient cells).
    out.calendarRows = Array.from(document.querySelectorAll('tr.gilba-nut-row')).map((tr) => {
        const c = Array.from(tr.querySelectorAll('td')).map((td) => (td.textContent || '').trim());
        return { month: c[0], season: c[1], gp: c[2], N: c[3], P: c[4], K: c[5], Ca: c[6], Mg: c[7], S: c[8] };
    });

    out.banners = Array.from(document.querySelectorAll('#plan-nut-results .gilba-nut-banner, #plan-nut-results .au-fert-banner, #plan-nut-results .prebble-banner'))
        .filter((b) => b.offsetParent !== null)
        .map((b) => txt(b));

    const results = $('#plan-nut-results');
    out.resultsVisible = !!(results && results.style.display !== 'none');
    out.resultsText = results ? (results.innerText || '').slice(0, 60000) : '';

    out.regionBadge = Array.from(document.querySelectorAll('.gilba-int-region-badge'))
        .filter((b) => b.offsetParent !== null).map((b) => txt(b));

    // Rendered Nutrient Delivery Summary (visible table whose header begins "Nutrient").
    out.summary = null;
    out.productTable = null;
    out.schedule = [];
    const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
    Array.from(document.querySelectorAll('#plan-nut-results table')).forEach((table) => {
        if (table.offsetParent === null) return; // the hidden standalone Prebble panel keeps a twin
        const rows = Array.from(table.querySelectorAll('tr'));
        const header = rows.length ? Array.from(rows[0].querySelectorAll('th,td')).map((c) => txt(c)) : [];
        if (/^Nutrient$/i.test(header[0] || '') && !out.summary) {
            out.summary = { header: header, rows: {} };
            rows.slice(1).forEach((tr) => {
                const c = Array.from(tr.querySelectorAll('td')).map((td) => txt(td));
                if (c.length >= 8 && /^(N|P|K)$/.test(c[0])) {
                    out.summary.rows[c[0]] = { current: c[1], removal: c[2], required: c[3], delivered: c[4],
                                               range: c[5], balance: c[6], status: c[7] };
                } else if (c.length) {
                    (out.summary.extra = out.summary.extra || []).push(c);
                }
            });
        } else if (/^Product$/i.test(header[0] || '') && !out.productTable) {
            const idx = { N: header.indexOf('N'), P: header.indexOf('P'), K: header.indexOf('K') };
            out.productTable = { header: header, rows: [], footer: {} };
            rows.slice(1).forEach((tr) => {
                const cells = Array.from(tr.querySelectorAll('td'));
                if (!cells.length) return;
                const first = cells[0];
                const label = (((first.querySelector('strong') || first).textContent) || '')
                    .replace(/\s*Analysis:.*$/, '').replace(/\s+/g, ' ').trim();
                const sub = txt(first.querySelector('.au-fert-cell-sub, .prebble-cell-sub, div, small'));
                const n = (i) => (i >= 0 && cells[i] ? txt(cells[i]) : null);
                // footer rows have colspan so the nutrient cells sit at the end
                if (/^(Total Delivered|Required|Balance)/i.test(label)) {
                    const tail = cells.slice(-3).map((c) => txt(c));
                    out.productTable.footer[label.replace(/\s*\(.*$/, '')] = {
                        N: tail[0], P: tail[1], K: tail[2],
                        applications: cells.length >= 6 ? txt(cells[1]) : null,
                        rate: cells.length >= 6 ? txt(cells[2]) : null
                    };
                    return;
                }
                out.productTable.rows.push({
                    name: label, sub: sub, applications: txt(cells[1]), rate: txt(cells[2]),
                    N: n(idx.N), P: n(idx.P), K: n(idx.K)
                });
            });
        } else if (/^Month$/i.test(header[0] || '')) {
            rows.slice(1).forEach((tr) => {
                const c = Array.from(tr.querySelectorAll('td')).map((td) => txt(td));
                if (c.length >= 5 && MONTHS.some((m) => (c[0] || '').indexOf(m) === 0) && /@|—|N:/.test(c.join(' '))) {
                    out.schedule.push({ month: c[0], season: c[1], req: c[2], granular: c[3], liquid: c[4], notes: c[5] || '' });
                }
            });
        }
    });

    // The recommender's own programme object.
    const ip = window.GAIP_NUTRITION_PROGRAM;
    out.integration = ip ? {
        meta: ip.meta, annual_requirements: ip.annual_requirements,
        monthly: Array.isArray(ip.monthly) ? ip.monthly.map((m) => ({
            month: m.month, gp: m.gp, requirements: m.requirements, notes: m.notes,
            coveredBy: m.coveredBy || null,
            granular: (m.granular || []).map((g) => ({
                id: g.id, name: g.name, npk: g.npk, analysis: g.analysis, delivers: g.delivers || null,
                rateKgHa: g.rateKgHa, rateGM2: g.rateGM2, rateLHa: g.rateLHa, splitCount: g.splitCount,
                splitRequired: g.splitRequired, rateReduced: g.rateReduced || false, form: g.form || null,
                release: g.release, isBalancing: g.isBalancing || false, notes: g.notes || null,
                maxRateKgHa: g.maxRateKgHa || (g.product && g.product.maxRateKgHa) || null
            })),
            liquid: (m.liquid || []).map((g) => ({
                id: g.id, name: g.name, npk: g.npk, analysis: g.analysis, delivers: g.delivers || null,
                rateKgHa: g.rateKgHa, rateGM2: g.rateGM2, rateLHa: g.rateLHa, splitCount: g.splitCount,
                splitRequired: g.splitRequired, rateReduced: g.rateReduced || false, form: g.form || null,
                isBalancing: g.isBalancing || false, notes: g.notes || null
            }))
        })) : null
    } : null;

    return out;
}

/* istanbul ignore next — runs in the browser */
function listPickerRowsInPage() {
    const btn = document.querySelector('#plan-nut-sample-picker .sn-drop-btn');
    if (!btn) return { hasPicker: false, rows: [] };
    btn.click();
    const rows = Array.from(document.querySelectorAll('#plan-nut-sample-picker .sn-drop-row[data-sn-idx]')).map((r) => ({
        idx: parseInt(r.getAttribute('data-sn-idx'), 10),
        zone: ((r.querySelector('.sn-drop-cell-zone') || {}).textContent || '').trim(),
        ref: ((r.querySelector('.sn-drop-cell-ref') || {}).textContent || '').trim(),
        file: ((r.querySelector('.sn-drop-cell-file') || {}).textContent || '').trim(),
        date: ((r.querySelector('.sn-drop-cell-date') || {}).textContent || '').trim()
    }));
    btn.click();
    return { hasPicker: true, rows: rows, buttonText: (btn.textContent || '').trim() };
}

/* ───────────────────────── driver ───────────────────────── */

if (!ENABLED) {
    process.stdout.write('[e2e] calc-audit-all-sites-live skipped (needs the live stack)\n');
    test.skip('calculation audit (disabled)', () => {});
} else {

const RESULTS = { generatedAt: new Date().toISOString(), baseUrl: BASE_URL, sites: [] };

async function setActiveSite(page, id) {
    await page.evaluate(async ({ id }) => {
        const t = document.querySelector('meta[name=csrf-token]');
        await fetch('/api/active-site', {
            method: 'PATCH',
            headers: Object.assign({ 'Content-Type': 'application/json', Accept: 'application/json' },
                t ? { 'X-CSRF-TOKEN': t.getAttribute('content') } : {}),
            body: JSON.stringify({ site_id: id }),
            credentials: 'same-origin'
        });
    }, { id });
}

async function generateAndRead(page, consoleLines) {
    consoleLines.length = 0;
    await page.evaluate(() => {
        window.__auditGenerated = 0;
        if (!window.__auditListener) {
            window.__auditListener = true;
            document.addEventListener('gaip:nutrition-calendar-generated', () => { window.__auditGenerated++; });
        }
        // Clear any prior render so we never read a stale panel as fresh.
        const r = document.querySelector('#plan-nut-results');
        if (r) { r.style.display = 'none'; }
    });
    // Dismiss the validation alert if annual N is empty, rather than hanging.
    page.once('dialog', async (d) => { consoleLines.push('dialog: ' + d.message()); await d.dismiss().catch(() => {}); });
    await page.click('#plan-nut-generate-btn');
    let outcome = 'generated';
    try {
        await page.waitForFunction(() => {
            if (window.__auditGenerated > 0) {
                const el = document.querySelector('#plan-nut-results');
                if (!el || el.style.display === 'none') return false;
                // Either a regional panel finished (summary present) or there is
                // no regional integration for these coordinates — in which case
                // the calendar table alone is the whole result. Give the
                // integration a moment by requiring the calendar first.
                return document.querySelectorAll('tr.gilba-nut-row').length === 12;
            }
            // The other endings: climate unavailable banner, or an alert.
            const banner = document.querySelector('#plan-nut-results .gilba-nut-banner');
            return !!(banner && /climate/i.test(banner.textContent || ''));
        }, null, { timeout: 90000 });
    } catch (e) {
        outcome = 'timeout';
    }
    // Let the regional integration render (it listens to the same event).
    await page.waitForTimeout(3500);
    const read = await page.evaluate(readPlanInPage);
    read.outcome = outcome;
    read.console = consoleLines.slice(0, 80);
    return read;
}

describe('Calculation audit — every site, every live soil sample, on the Plan page', () => {
    let browser, page, previousActiveSiteId = null;
    const consoleLines = [];

    beforeAll(async () => {
        if (!chromium) throw new Error('playwright does not resolve from the repo — run `npm install`');
        if (!EMAIL || !PASSWORD) throw new Error('no credentials — see tests/e2e/.e2e-credentials.example.json');

        browser = await chromium.launch();
        page = await browser.newPage();
        page.on('console', (m) => {
            const t = m.text();
            if (/Rate capped|Capped|capped|[Ss]kipp|no product|No product|not loaded|GH-\d+|PrebbleRecommender\]|AuFertiliserRecommender|NutritionCalendar\]|NutritionRequirementCore|climate|Climate|warn|error|GH302-DEBUG|GH341-DEBUG|tissue gate|traffic|excess|surplus|balanc/i.test(t)
                && !/GH322-DEBUG|Dispatching gaip/.test(t)) {
                consoleLines.push(m.type() + ': ' + t.slice(0, 400));
            }
        });
        page.on('pageerror', (e) => { consoleLines.push('pageerror: ' + (e && e.message)); });

        await page.goto(BASE_URL + '/login', { waitUntil: 'domcontentloaded' });
        await page.fill('#email', EMAIL);
        await page.fill('#password', PASSWORD);
        await Promise.all([
            page.waitForNavigation({ waitUntil: 'domcontentloaded' }).catch(() => {}),
            page.click('form.login-form button[type=submit]')
        ]);
        await page.waitForTimeout(1500);
        if (/\/login/.test(page.url())) throw new Error('login refused for ' + EMAIL);

        const sitesResp = await page.evaluate(async () => {
            const r = await fetch('/api/sites', { headers: { Accept: 'application/json' }, credentials: 'same-origin' });
            return r.json();
        });
        previousActiveSiteId = sitesResp.active_site_id;
        let sites = (sitesResp.sites || sitesResp.data || sitesResp || []).map((s) => ({ id: s.id, name: s.name }));
        if (!Array.isArray(sites) || !sites.length) throw new Error('no sites from /api/sites: ' + JSON.stringify(sitesResp).slice(0, 300));
        sites = sites.filter((s) => !SKIP_NAMES.test(s.name));
        if (SITE_FILTER.length) sites = sites.filter((s) => SITE_FILTER.some((f) => s.name.toLowerCase().includes(f.toLowerCase())));
        RESULTS.siteListFromApi = sites;

        for (const site of sites) {
            const rec = { id: site.id, name: site.name, generations: [] };
            RESULTS.sites.push(rec);
            const line = (s) => process.stdout.write('[audit] ' + site.name + ': ' + s + '\n');
            try {
                await setActiveSite(page, site.id);
                await page.goto(BASE_URL + '/plan', { waitUntil: 'domcontentloaded' });
                await page.waitForFunction(() => !!window.GilbaNutritionCalendar, null, { timeout: 30000 });
                await page.waitForTimeout(3000); // site-config restore cascade
                await page.click('a[data-tab="nutrition"]');
                await page.waitForTimeout(1500);
                await page.waitForSelector('#plan-nut-sample-picker .sn-drop-btn', { timeout: 8000 }).catch(() => {});
                const picker = await page.evaluate(listPickerRowsInPage);
                rec.picker = picker;
                rec.hubConfig = await page.evaluate(() => {
                    const c = window.GAIP_HUB_CONFIG || {};
                    const sc = window.GAIP_SITE_CONFIG || {};
                    return { activeSiteId: c.activeSiteId, turf: sc.turf || null, location: sc.location || null,
                             maxNPerMonth: sc.maxNPerMonth || null, nzDistributor: sc.nzDistributor || null };
                });
                line('picker rows=' + picker.rows.length + (picker.hasPicker ? '' : ' (no picker)'));

                let rows = picker.rows.length ? picker.rows : [null];
                if (MAX_SAMPLES > 0) rows = rows.slice(0, MAX_SAMPLES);
                for (const row of rows) {
                    const gen = { sample: row };
                    rec.generations.push(gen);
                    if (row) {
                        const picked = await page.evaluate((idx) => {
                            const btn = document.querySelector('#plan-nut-sample-picker .sn-drop-btn');
                            if (!btn) return false;
                            btn.click();
                            const r = document.querySelector('#plan-nut-sample-picker .sn-drop-row[data-sn-idx="' + idx + '"]');
                            if (!r) { btn.click(); return false; }
                            r.click();
                            return true;
                        }, row.idx);
                        gen.picked = picked;
                        await page.waitForTimeout(3000); // onSelect may auto-regenerate; let it settle
                    }
                    const read = await generateAndRead(page, consoleLines);
                    Object.assign(gen, read);
                    const s = read.summary && read.summary.rows;
                    line('sample "' + (row ? row.zone : '(none)') + '" -> ' + read.outcome +
                        (read.program ? ' | annual N/P/K=' + [read.program.annual_totals.N, read.program.annual_totals.P, read.program.annual_totals.K].join('/') : ' | no programme') +
                        (s ? ' | delivered N/P/K=' + ['N', 'P', 'K'].map((k) => (s[k] || {}).delivered).join('/') : ' | no summary') +
                        (read.regionBadge.length ? ' | ' + read.regionBadge.join(',') : ' | no region panel'));
                }
            } catch (e) {
                rec.error = String(e && e.stack || e);
                line('ERROR ' + rec.error.split('\n')[0]);
            }
            fs.mkdirSync(path.dirname(OUT), { recursive: true });
            fs.writeFileSync(OUT, JSON.stringify(RESULTS, null, 1));
        }
        fs.mkdirSync(path.dirname(OUT), { recursive: true });
            fs.writeFileSync(OUT, JSON.stringify(RESULTS, null, 1));
        process.stdout.write('[audit] wrote ' + OUT + '\n');
    }, 3600000);

    afterAll(async () => {
        if (page && previousActiveSiteId) {
            try { await setActiveSite(page, previousActiveSiteId); } catch (e) { /* best effort */ }
        }
        if (browser) await browser.close();
    }, 120000);

    /* ───────────── invariants, evaluated over everything collected ───────────── */

    function eachGeneration(fn) {
        const bad = [];
        RESULTS.sites.forEach((site) => site.generations.forEach((g) => {
            const label = site.name + ' / ' + (g.sample ? g.sample.zone : '(no sample)');
            const r = fn(g, label);
            if (r) bad.push(Object.assign({ site: label }, r));
        }));
        return bad;
    }

    test('every site produced a programme, or the page said why', () => {
        const bad = eachGeneration((g, label) => {
            if (g.program && g.program.monthly && g.program.monthly.length === 12) return null;
            const banner = (g.banners || []).join(' | ');
            return { outcome: g.outcome, banner: banner, console: (g.console || []).slice(0, 5) };
        });
        expect(bad).toEqual([]);
    });

    test('monthly N rows sum to the scheduled total, and the cap redistributes rather than loses N', () => {
        const bad = eachGeneration((g) => {
            if (!g.program || !g.program.adjustments) return null;
            const a = g.program.adjustments;
            const cells = g.calendarRows.map((r) => num(r.N));
            const sum = cells.reduce((s, v) => s + (v || 0), 0);
            const problems = {};
            if (Math.abs(sum - a.scheduled_n_total) > 0.15) problems.sumVsScheduled = { sum: +sum.toFixed(2), scheduled: a.scheduled_n_total };
            if (Math.abs(a.original_n_total - g.program.annual_totals.N) > 0.11) problems.originalVsAnnual = { original: a.original_n_total, annual: g.program.annual_totals.N };
            if (a.n_cap_applied && Math.abs((a.scheduled_n_total + a.n_unschedulable) - a.original_n_total) > 0.15) problems.capBalance = a;
            if (a.max_n_per_month && cells.some((v) => v > a.max_n_per_month + 0.05)) problems.monthOverCap = cells;
            return Object.keys(problems).length ? problems : null;
        });
        expect(bad).toEqual([]);
    });

    test('monthly P and K rows sum back to the annual requirement', () => {
        const bad = eachGeneration((g) => {
            if (!g.program || !g.calendarRows.length) return null;
            const problems = {};
            ['P', 'K', 'Ca', 'Mg', 'S'].forEach((n) => {
                const sum = g.calendarRows.reduce((s, r) => s + (num(r[n]) || 0), 0);
                const annual = g.program.annual_totals[n];
                if (typeof annual === 'number' && Math.abs(sum - annual) > 0.35) problems[n] = { sum: +sum.toFixed(2), annual: annual };
            });
            return Object.keys(problems).length ? problems : null;
        });
        expect(bad).toEqual([]);
    });

    test('Required in the delivery summary is the annual requirement, rounded once', () => {
        const bad = eachGeneration((g) => {
            if (!g.summary || !g.program) return null;
            const problems = {};
            ['N', 'P', 'K'].forEach((n) => {
                const row = g.summary.rows[n];
                if (!row) return;
                const annual = g.program.annual_totals[n];
                if (Math.abs(num(row.required) - annual) > 0.051) problems[n] = { printed: row.required, annual: annual };
            });
            return Object.keys(problems).length ? problems : null;
        });
        expect(bad).toEqual([]);
    });

    test('Delivered equals the sum of the product rows and the Total Delivered footer', () => {
        const bad = eachGeneration((g) => {
            if (!g.summary || !g.productTable) return null;
            const problems = {};
            const rows = g.productTable.rows;
            const tol = 0.051 * rows.length + 0.051;
            ['N', 'P', 'K'].forEach((n) => {
                const col = num((g.summary.rows[n] || {}).delivered);
                const foot = num((g.productTable.footer['Total Delivered'] || {})[n]);
                const sum = rows.reduce((s, r) => s + (num(r[n]) || 0), 0);
                if (col == null) return;
                if (foot != null && Math.abs(col - foot) > 0.051) problems[n + '_footer'] = { column: col, footer: foot };
                if (rows.length && Math.abs(col - sum) > tol) problems[n + '_rows'] = { column: col, rowsSum: +sum.toFixed(2) };
            });
            return Object.keys(problems).length ? problems : null;
        });
        expect(bad).toEqual([]);
    });

    test('Balance = Current + Delivered - Removal where the row prints all three', () => {
        const bad = eachGeneration((g) => {
            if (!g.summary) return null;
            const problems = {};
            ['N', 'P', 'K'].forEach((n) => {
                const row = g.summary.rows[n];
                if (!row) return;
                const m = /\(([\d.]+)\s*kg\/ha\)/.exec(row.current || '');
                const currentKg = m ? parseFloat(m[1]) : null;
                const removal = num(row.removal), delivered = num(row.delivered), balance = num(row.balance);
                if (currentKg == null || removal == null || delivered == null || balance == null) return;
                if (Math.abs((currentKg + delivered - removal) - balance) > 0.16) {
                    problems[n] = { current: row.current, removal: removal, delivered: delivered, balance: balance, expected: +(currentKg + delivered - removal).toFixed(1) };
                }
            });
            return Object.keys(problems).length ? problems : null;
        });
        expect(bad).toEqual([]);
    });

    test('the programme delivers at least what it was asked for (informational — see the report)', () => {
        const short = eachGeneration((g) => {
            if (!g.summary) return null;
            const problems = {};
            ['N', 'P', 'K'].forEach((n) => {
                const row = g.summary.rows[n];
                if (!row) return;
                const req = num(row.required), del = num(row.delivered);
                if (req == null || del == null) return;
                if (req > 0 && del < req - 0.05) problems[n] = { required: req, delivered: del, gap: +(del - req).toFixed(1), status: row.status };
                if (del > req + 0.05) problems[n] = { required: req, delivered: del, over: +(del - req).toFixed(1), status: row.status };
            });
            return Object.keys(problems).length ? problems : null;
        });
        process.stdout.write('[audit] delivery vs requirement mismatches: ' + JSON.stringify(short, null, 1) + '\n');
        expect(Array.isArray(short)).toBe(true);
    });
});

}

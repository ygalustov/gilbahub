/**
 * Calculation audit, second half — the Word document against the Plan page,
 * one soil sample per site, chosen to hit the edge shapes the audit brief
 * names (a sample with pH outside 6.0-7.5, a sample with no P/K, a
 * warm-season sward at a cool latitude, an AA site with no pH at all).
 *
 * For every (site, sample) pair this file:
 *   1. pins the sample on /plan, presses Generate, and reads the rendered
 *      Nutrient Delivery Summary (Required / Delivered / Balance / Status),
 *      the twelve rendered monthly N cells and GP badges, and the resolved
 *      engine inputs (pH, ranges) the calendar actually used;
 *   2. exports that one sample from /reports/export and parses, out of
 *      word/document.xml, the Annual Nutrient Requirements rows for the
 *      sample, the Monthly N Distribution row (N and GP per month), and the
 *      Annual Product Summary rows;
 *   3. prints both side by side and asserts they agree.
 *
 * Generalises tests/e2e/gh399-delivery-live.test.js (one fixture) to a list.
 *
 *   GILBA_E2E=1 jest tests/e2e/calc-audit-export-parity-live.test.js --runInBand --testTimeout=3600000
 * Optional: GILBA_AUDIT_PAIRS="New test - location::Green 5;Burns::12th Fairway"
 *           GILBA_AUDIT_OUT=<path to write the JSON>
 */

'use strict';

const fs = require('fs');
const os = require('os');
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
const OUT = process.env.GILBA_AUDIT_OUT || path.join(__dirname, '../../calc-audit-export-results.json');

const DEFAULT_PAIRS = [
    'New test - location::Green 5',      // SLAN, pH 8.26 — the pH ladder should move the P floor
    'New test - location::Putter Green', // SLAN, the harness fixture, pH 6.21
    'Burns::12th Fairway',               // MLSN, pH 6.6 / pH_Water 5.5 disagree
    'Burns::Green 13',                   // MLSN, P 109 ppm — far above ceiling
    'Federal Golf::Green 1',             // SLAN, cap 15, traffic enabled
    'test4 - USA::Green 13',             // pH only, no P/K, no regional catalogue
    'Test5 - NZ::Soccer',                // AA sports, Prebble
    'Russley::Green 18',                 // AA, no pH on the sample, PGG Wrightson
    'Test - GC - NZ - delivery::18th Green',
    'Test - GC - NZ - warm season grass test::Main Oval', // Couch at Christchurch
    'Westview::Backyard'                 // pH only, Buffalo lawn
];
const PAIRS = (process.env.GILBA_AUDIT_PAIRS || DEFAULT_PAIRS.join(';')).split(';')
    .map((s) => s.trim()).filter(Boolean)
    .map((s) => { const [site, label, uid] = s.split('::'); return { site: site.trim(), label: (label || '').trim(), uidHint: (uid || '').trim() || null }; });

let chromium = null;
try { ({ chromium } = require('playwright')); } catch (e) { /* reported below */ }

function num(v) {
    const n = parseFloat(String(v == null ? '' : v).replace(/[^0-9.\-]/g, ''));
    return isFinite(n) ? n : null;
}
function decodeEntities(s) {
    return s.replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>')
        .replace(/&quot;/g, '"').replace(/&apos;/g, "'")
        .replace(/&#(\d+);/g, (m, d) => String.fromCharCode(parseInt(d, 10)));
}
function fragmentText(xml) {
    const parts = [];
    const re = /<w:t(?:\s[^>]*)?>([^<]*)<\/w:t>/g;
    let m;
    while ((m = re.exec(xml))) parts.push(m[1]);
    return decodeEntities(parts.join(''));
}
function docxTables(xml) {
    const tables = [];
    const tblRe = /<w:tbl>([\s\S]*?)<\/w:tbl>/g;
    let t;
    while ((t = tblRe.exec(xml))) {
        const rows = [];
        const trRe = /<w:tr(?:\s[^>]*)?>([\s\S]*?)<\/w:tr>/g;
        let r;
        while ((r = trRe.exec(t[1]))) {
            const cells = [];
            const tcRe = /<w:tc(?:\s[^>]*)?>([\s\S]*?)<\/w:tc>/g;
            let c;
            while ((c = tcRe.exec(r[1]))) {
                const paras = c[1].split('</w:p>').map((p) => fragmentText(p).trim()).filter(Boolean);
                cells.push(paras.join('\n'));
            }
            rows.push(cells);
        }
        tables.push(rows);
    }
    return tables;
}
function findTable(tables, header) {
    return (tables || []).find((rows) => {
        const h = (rows[0] || []).map((c) => String(c).trim());
        return header.every((want, i) => h[i] === want);
    }) || null;
}
function docxText(xml) {
    return decodeEntities(xml.replace(/<\/w:p>/g, '\n').replace(/<\/w:tc>/g, '\t').replace(/<[^>]+>/g, ''))
        .replace(/[ \t]+\n/g, '\n');
}
const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

/* istanbul ignore next — runs in the browser */
function readPlanInPage() {
    const txt = (el) => (el ? (el.textContent || '').replace(/\s+/g, ' ').trim() : '');
    const NC = window.GilbaNutritionCalendar;
    const p = NC && NC.program;
    let inputs = null;
    try {
        const i = NC && NC.collectFromState ? NC.collectFromState() : null;
        inputs = i ? { pH: i.pH, CEC: i.CEC, soilTexture: i.soilTexture, methodology: i.methodology, species: i.species,
                       surfaceType: i.surfaceType, isC4: i.isC4, ranges: i.ranges, soilPpm: i.soilPpm,
                       annualNOverride: i.annualNOverride, maxNPerMonth: i.maxNPerMonth, trafficModifier: i.trafficModifier } : null;
    } catch (e) { inputs = { error: String(e && e.message) }; }
    const out = {
        program: p ? { annual_totals: p.annual_totals, annual_removal: p.annual_removal, annual_lift: p.annual_lift,
                       adjustments: p.adjustments, missing_soil_data: p.missing_soil_data, meta: p.meta,
                       range: p.annual_totals_range, rangeSource: p.annual_totals_range_source } : null,
        inputs: inputs,
        monthly: Array.from(document.querySelectorAll('tr.gilba-nut-row')).map((tr) => {
            const c = Array.from(tr.querySelectorAll('td')).map((td) => (td.textContent || '').trim());
            return { month: c[0], gp: c[2], N: c[3], P: c[4], K: c[5] };
        }),
        summary: null, products: null, regionBadge: Array.from(document.querySelectorAll('.gilba-int-region-badge')).filter((b) => b.offsetParent !== null).map(txt)
    };
    Array.from(document.querySelectorAll('#plan-nut-results table')).forEach((table) => {
        if (table.offsetParent === null) return;
        const rows = Array.from(table.querySelectorAll('tr'));
        const header = rows.length ? Array.from(rows[0].querySelectorAll('th,td')).map(txt) : [];
        if (/^Nutrient$/i.test(header[0] || '') && !out.summary) {
            out.summary = {};
            rows.slice(1).forEach((tr) => {
                const c = Array.from(tr.querySelectorAll('td')).map(txt);
                if (c.length >= 8 && /^(N|P|K)$/.test(c[0])) out.summary[c[0]] = { current: c[1], removal: c[2], required: c[3], delivered: c[4], range: c[5], balance: c[6], status: c[7] };
            });
        } else if (/^Product$/i.test(header[0] || '') && !out.products) {
            const idx = { N: header.indexOf('N'), P: header.indexOf('P'), K: header.indexOf('K') };
            out.products = { header, rows: [], footer: {} };
            rows.slice(1).forEach((tr) => {
                const cells = Array.from(tr.querySelectorAll('td'));
                if (!cells.length) return;
                const label = (((cells[0].querySelector('strong') || cells[0]).textContent) || '').replace(/\s*Analysis:.*$/, '').replace(/\s+/g, ' ').trim();
                if (/^(Total Delivered|Required|Balance)/i.test(label)) {
                    const tail = cells.slice(-3).map(txt);
                    out.products.footer[label.replace(/\s*\(.*$/, '')] = { N: tail[0], P: tail[1], K: tail[2], rate: cells.length >= 6 ? txt(cells[2]) : null };
                    return;
                }
                out.products.rows.push({ name: label, applications: txt(cells[1]), rate: txt(cells[2]), N: txt(cells[idx.N]), P: txt(cells[idx.P]), K: txt(cells[idx.K]) });
            });
        }
    });
    return out;
}

if (!ENABLED) {
    process.stdout.write('[e2e] calc-audit-export-parity-live skipped (needs the live stack)\n');
    test.skip('calculation audit — export parity (disabled)', () => {});
} else {

const RESULTS = { generatedAt: new Date().toISOString(), pairs: [] };

async function setActiveSite(page, id) {
    await page.evaluate(async ({ id }) => {
        const t = document.querySelector('meta[name=csrf-token]');
        await fetch('/api/active-site', {
            method: 'PATCH',
            headers: Object.assign({ 'Content-Type': 'application/json', Accept: 'application/json' }, t ? { 'X-CSRF-TOKEN': t.getAttribute('content') } : {}),
            body: JSON.stringify({ site_id: id }), credentials: 'same-origin'
        });
    }, { id });
}

describe('Calculation audit — the document against the Plan, one sample per site', () => {
    let browser, page, previousActiveSiteId = null;
    const consoleLines = [];

    beforeAll(async () => {
        if (!chromium) throw new Error('playwright does not resolve from the repo — run `npm install`');
        if (!EMAIL || !PASSWORD) throw new Error('no credentials');
        execFileSync('unzip', ['-v'], { stdio: 'ignore' });

        browser = await chromium.launch();
        page = await browser.newPage({ acceptDownloads: true });
        page.on('console', (m) => {
            const t = m.text();
            if (/is not loaded|\[WordExport\]|\[CombinedExport\]|pageerror|GH-4\d\d|Capped|capped/i.test(t)) consoleLines.push(m.type() + ': ' + t.slice(0, 300));
        });
        page.on('pageerror', (e) => { consoleLines.push('pageerror: ' + (e && e.message)); });

        await page.goto(BASE_URL + '/login', { waitUntil: 'domcontentloaded' });
        await page.fill('#email', EMAIL);
        await page.fill('#password', PASSWORD);
        await Promise.all([page.waitForNavigation({ waitUntil: 'domcontentloaded' }).catch(() => {}), page.click('form.login-form button[type=submit]')]);
        await page.waitForTimeout(1500);
        if (/\/login/.test(page.url())) throw new Error('login refused');

        const sitesResp = await page.evaluate(async () => (await fetch('/api/sites', { headers: { Accept: 'application/json' }, credentials: 'same-origin' })).json());
        previousActiveSiteId = sitesResp.active_site_id;
        const sites = (sitesResp.sites || sitesResp.data || sitesResp || []);

        for (const pair of PAIRS) {
            const site = sites.find((s) => s.name === pair.site);
            const rec = { site: pair.site, label: pair.label, siteId: site && site.id };
            RESULTS.pairs.push(rec);
            const line = (s) => process.stdout.write('[audit-export] ' + pair.site + ' / ' + pair.label + ': ' + s + '\n');
            if (!site) { rec.error = 'site not in /api/sites'; line(rec.error); continue; }
            try {
                consoleLines.length = 0;
                await setActiveSite(page, site.id);

                // ── Plan ────────────────────────────────────────────────
                await page.goto(BASE_URL + '/plan', { waitUntil: 'domcontentloaded' });
                await page.waitForFunction(() => !!window.GilbaNutritionCalendar, null, { timeout: 30000 });
                await page.waitForTimeout(3000);
                await page.click('a[data-tab="nutrition"]');
                await page.waitForTimeout(1200);
                await page.waitForSelector('#plan-nut-sample-picker .sn-drop-btn', { timeout: 20000 });
                const picked = await page.evaluate((label) => {
                    const btn = document.querySelector('#plan-nut-sample-picker .sn-drop-btn');
                    btn.click();
                    const rows = Array.from(document.querySelectorAll('#plan-nut-sample-picker .sn-drop-row[data-sn-idx]'));
                    const labels = rows.map((r) => ((r.querySelector('.sn-drop-cell-zone') || {}).textContent || '').trim());
                    // Prefer the LAST row with this label (latest sample, as the picker sorts newest first? — record which).
                    const i = labels.indexOf(label);
                    if (i < 0) { btn.click(); return { ok: false, labels }; }
                    rows[i].click();
                    return { ok: true, index: i, date: ((rows[i].querySelector('.sn-drop-cell-date') || {}).textContent || '').trim(), labels };
                }, pair.label);
                if (!picked.ok) throw new Error('label not in picker: ' + JSON.stringify(picked.labels));
                rec.pickerRow = { index: picked.index, date: picked.date };
                await page.waitForTimeout(3000);
                await page.evaluate(() => {
                    window.__auditGen = 0;
                    document.addEventListener('gaip:nutrition-calendar-generated', () => { window.__auditGen++; });
                });
                page.once('dialog', async (d) => { consoleLines.push('dialog: ' + d.message()); await d.dismiss().catch(() => {}); });
                await page.click('#plan-nut-generate-btn');
                await page.waitForFunction(() => window.__auditGen > 0 && document.querySelectorAll('tr.gilba-nut-row').length === 12, null, { timeout: 90000 });
                await page.waitForTimeout(3500);
                rec.plan = await page.evaluate(readPlanInPage);

                // ── Export ──────────────────────────────────────────────
                await page.goto(BASE_URL + '/reports/export', { waitUntil: 'domcontentloaded' });
                await page.waitForFunction(() => !!(window.GilbaNutritionCalendar && window.NutritionRequirementEngine_Pure && window.GAIP_SampleManager), null, { timeout: 30000 });
                await page.waitForFunction(() => { const el = document.querySelector('.gaip-nutrition-annual-n'); return !!(el && el.value); }, null, { timeout: 20000 }).catch(() => {});
                await page.waitForTimeout(2500);
                rec.exportAnnualN = await page.evaluate(() => (document.querySelector('.gaip-nutrition-annual-n') || {}).value || null);
                await page.click('text=Generate & Download Word');
                await page.waitForSelector('.gaip-bulk-area-backdrop', { timeout: 15000 });
                await page.waitForTimeout(500);
                await page.click('text=Deselect all');
                await page.waitForTimeout(300);
                // The export picker keys its checkboxes by `<siteId>::<client_uid|label|sample_<id>>`
                // (sample-persistence.js); the row carries no readable text, so match on the uid.
                const pick = await page.evaluate(({ id, label, uidHint }) => {
                    const boxes = Array.from(document.querySelectorAll('input[data-sample-uid]'));
                    const uidOf = (c) => String(c.getAttribute('data-sample-uid') || '');
                    const rowText = (c) => (((c.closest('label,tr,li,div') || c.parentElement) || {}).textContent || '').trim().replace(/\s+/g, ' ');
                    const mine = boxes.filter((c) => uidOf(c).indexOf(id + '::') === 0);
                    let cb = null;
                    if (uidHint) cb = mine.find((c) => uidOf(c) === id + '::' + uidHint) || null;
                    if (!cb) cb = mine.find((c) => uidOf(c) === id + '::' + label) || null;
                    if (!cb) { const t = mine.filter((c) => rowText(c).indexOf(label) >= 0); if (t.length === 1) cb = t[0]; }
                    if (!cb && mine.length === 1) cb = mine[0];
                    if (!cb) return { found: false, available: mine.map((c) => uidOf(c) + ' | ' + rowText(c).slice(0, 60)) };
                    cb.checked = true; cb.dispatchEvent(new Event('change', { bubbles: true }));
                    return { found: true, uid: uidOf(cb), text: rowText(cb).slice(0, 80), checked: document.querySelectorAll('input[data-sample-uid]:checked').length };
                }, { id: site.id, label: pair.label, uidHint: pair.uidHint });
                rec.exportPick = pick;
                if (!pick.found) throw new Error('no export checkbox: ' + JSON.stringify(pick));
                const [download] = await Promise.all([
                    page.waitForEvent('download', { timeout: 180000 }),
                    page.locator('button:has-text("Generate & Download")').last().click()
                ]);
                const docxPath = path.join(os.tmpdir(), 'gilba-audit-' + Date.now() + '.docx');
                await download.saveAs(docxPath);
                const xml = execFileSync('unzip', ['-p', docxPath, 'word/document.xml'], { maxBuffer: 64 * 1024 * 1024 }).toString();
                try { fs.unlinkSync(docxPath); } catch (e) { /* */ }
                const tables = docxTables(xml);
                const text = docxText(xml);

                const anrT = findTable(tables, ['Sample', 'Nutrient', 'Current (kg/ha, ppm)', 'Removal', 'Required', 'Delivered', 'Range', 'Balance', 'Status']);
                rec.docx = { anr: {}, anrAllSamples: [], monthly: null, products: null, capText: null, headings: [] };
                if (anrT) {
                    anrT.slice(1).forEach((r) => {
                        rec.docx.anrAllSamples.push(r.slice(0, 2).join(' / '));
                        if (String(r[0]).trim() !== pair.label) return;
                        rec.docx.anr[String(r[1]).trim()] = { current: r[2], removal: r[3], required: r[4], delivered: r[5], range: r[6], balance: r[7], status: r[8] };
                    });
                }
                const monthT = tables.find((rows) => rows.length >= 2 && rows[0].length === 12 && rows[0].every((c, i) => (c || '').trim() === MONTHS[i]));
                if (monthT) rec.docx.monthly = monthT[1].map((cell) => { const parts = String(cell).split('\n'); return { N: parts[0], gp: (parts[1] || '').trim() }; });
                const prodT = findTable(tables, ['Product', 'Applications', 'Total Rate', 'N']);
                if (prodT) {
                    const header = prodT[0].map((h) => String(h).trim());
                    rec.docx.products = { header, rows: prodT.slice(1).map((r) => ({ name: String(r[0]).trim(), applications: r[1], rate: r[2], N: r[header.indexOf('N')], P: header.indexOf('P') >= 0 ? r[header.indexOf('P')] : null, K: r[header.indexOf('K')] })) };
                }
                const capM = /Monthly N cap[^\n]*/.exec(text);
                rec.docx.capText = capM ? capM[0] : null;
                const gpM = /Growth Potential[^\n]{0,200}/g; let g; const gps = [];
                while ((g = gpM.exec(text)) && gps.length < 8) gps.push(g[0].trim());
                rec.docx.gpMentions = gps;
                const distM = /Monthly N Distribution \([^)]*\)/.exec(text);
                rec.docx.distributionHeading = distM ? distM[0] : null;
                // Section headings and any "no soil data"-type wording, so a
                // missing table can be told apart from a table under another name.
                rec.docx.headings = text.split('\n').map((l) => l.trim())
                    .filter((l) => /^(Annual|Monthly|Nutrient|Fertiliser|Soil|Growth|Product|Recommend|Executive|Summary|Programme|Program)\b/i.test(l) && l.length < 90)
                    .filter((l, i, a) => a.indexOf(l) === i).slice(0, 60);
                rec.docx.noDataWording = (text.match(/[^\n]{0,80}(no soil|No soil|not available|insufficient|missing soil|no sample|No sample|could not|cannot be)[^\n]{0,80}/g) || []).slice(0, 10);
                // GH-414/GH-415: the Annual Nutrient Requirements caption, which
                // is where both tickets put their explanation of a figure the
                // reader has not seen before — a zone computed on the generic
                // removal ratio, and a soil above its ceiling still asking for
                // fertiliser. Captured whole so a missing sentence is visible
                // here rather than only in the .docx.
                rec.docx.anrCaption = (text.split('\n').map((l) => l.trim())
                    .filter((l) => /Required is the annual removal-replacement estimate/.test(l))[0] || null);
                rec.docx.tableHeaders = tables.map((rows) => (rows[0] || []).slice(0, 6).join('|')).filter((h, i, a) => a.indexOf(h) === i).slice(0, 40);
                const pHM = /pH[^\n]{0,80}/g; const phs = []; let h;
                while ((h = pHM.exec(text)) && phs.length < 6) phs.push(h[0].trim());
                rec.docx.pHMentions = phs;
                rec.console = consoleLines.slice(0, 30);

                const s = rec.plan.summary || {};
                line('plan req N/P/K=' + ['N', 'P', 'K'].map((k) => (s[k] || {}).required).join('/') +
                     ' del=' + ['N', 'P', 'K'].map((k) => (s[k] || {}).delivered).join('/') +
                     ' | docx req=' + ['N', 'P', 'K'].map((k) => (rec.docx.anr[k] || {}).required).join('/') +
                     ' del=' + ['N', 'P', 'K'].map((k) => (rec.docx.anr[k] || {}).delivered).join('/') +
                     ' | plan pH=' + (rec.plan.inputs && rec.plan.inputs.pH) + ' P floor=' + (rec.plan.inputs && rec.plan.inputs.ranges && rec.plan.inputs.ranges.P && rec.plan.inputs.ranges.P.min));
            } catch (e) {
                rec.error = String(e && e.stack || e);
                rec.console = consoleLines.slice(0, 30);
                line('ERROR ' + rec.error.split('\n')[0]);
            }
            fs.writeFileSync(OUT, JSON.stringify(RESULTS, null, 1));
        }
        process.stdout.write('[audit-export] wrote ' + OUT + '\n');
    }, 3600000);

    afterAll(async () => {
        if (page && previousActiveSiteId) { try { await setActiveSite(page, previousActiveSiteId); } catch (e) { /* */ } }
        if (browser) await browser.close();
    }, 120000);

    // GH-423: the pairs that legitimately produce no comparison. test4 - USA is
    // outside both the Australian and the New Zealand catalogue boxes, so its
    // Plan page shows no regional panel at all and there is no Delivered column
    // to compare (GH-416 decided that deliberately). Anything else appearing in
    // this list means a pair was silently NOT COMPARED, which is the shape this
    // assertion exists to catch.
    const EXPECTED_INCOMPLETE = ['test4 - USA / Green 13'];

    test('every pair produced both a Plan panel and a document ANR block', () => {
        const bad = RESULTS.pairs.filter((r) => r.error || !r.plan || !r.plan.summary || !r.docx || !Object.keys(r.docx.anr).length)
            .map((r) => ({ site: r.site, label: r.label, error: (r.error || '').split('\n')[0], hasPlanSummary: !!(r.plan && r.plan.summary), docxAnrKeys: r.docx ? Object.keys(r.docx.anr) : null, anrSamples: r.docx ? r.docx.anrAllSamples : null }));
        process.stdout.write('[audit-export] incomplete pairs: ' + JSON.stringify(bad, null, 1) + '\n');
        // WAS `expect(Array.isArray(bad)).toBe(true)` — which is true of every
        // array and so could not fail. A pair whose export degraded (the
        // per-sample recompute skipped, no Annual Nutrient Requirements table)
        // contributed no comparisons to the test below, which skips a nutrient
        // whenever either side is missing, and the run still reported green for
        // it. Name the exceptions instead, so a new one is a failure.
        expect(bad.map((b) => b.site + ' / ' + b.label).sort()).toEqual(EXPECTED_INCOMPLETE.slice().sort());
    });

    test('every pair that should be comparable actually was compared', () => {
        // The companion to the above: not "was there data" but "did a
        // comparison happen". Three nutrients per comparable pair.
        const counted = RESULTS.pairs.map((r) => {
            if (!r.plan || !r.plan.summary || !r.docx) return { pair: r.site + ' / ' + r.label, compared: 0 };
            const n = ['N', 'P', 'K'].filter((k) => r.plan.summary[k] && r.docx.anr[k]).length;
            return { pair: r.site + ' / ' + r.label, compared: n };
        });
        process.stdout.write('[audit-export] nutrients compared per pair: ' + JSON.stringify(counted) + '\n');
        const under = counted.filter((c) => c.compared < 3 && EXPECTED_INCOMPLETE.indexOf(c.pair) < 0);
        expect(under).toEqual([]);
    });

    test('Required, Delivered, Balance and Status agree between the Plan and the document', () => {
        const bad = [];
        RESULTS.pairs.forEach((r) => {
            if (!r.plan || !r.plan.summary || !r.docx) return;
            ['N', 'P', 'K'].forEach((n) => {
                const p = r.plan.summary[n], d = r.docx.anr[n];
                if (!p || !d) return;
                const cmp = (what, a, b, tol) => { const x = num(a), y = num(b); if (x != null && y != null && Math.abs(x - y) > tol) bad.push({ site: r.site, label: r.label, nutrient: n, what, plan: a, document: b }); };
                cmp('required', p.required, d.required, 0.051);
                cmp('delivered', p.delivered, d.delivered, 0.051);
                cmp('balance', p.balance, d.balance, 0.16);
                if (p.status && d.status && p.status.toLowerCase() !== String(d.status).toLowerCase()) bad.push({ site: r.site, label: r.label, nutrient: n, what: 'status', plan: p.status, document: d.status });
            });
        });
        expect(bad).toEqual([]);
    });

    test('the twelve monthly N figures and GP badges are the same series in both', () => {
        const bad = [];
        RESULTS.pairs.forEach((r) => {
            if (!r.plan || !r.docx || !r.docx.monthly || r.plan.monthly.length !== 12) return;
            for (let m = 0; m < 12; m++) {
                const pn = num(r.plan.monthly[m].N), dn = num(r.docx.monthly[m].N);
                if (pn != null && dn != null && Math.round(pn) !== dn) bad.push({ site: r.site, label: r.label, month: MONTHS[m], what: 'N', plan: pn, document: dn });
                const pg = num(r.plan.monthly[m].gp), dg = num(r.docx.monthly[m].gp);
                if (pg != null && dg != null && Math.abs(pg - dg) > 1) bad.push({ site: r.site, label: r.label, month: MONTHS[m], what: 'GP', plan: pg, document: dg });
            }
        });
        expect(bad).toEqual([]);
    });
});

}

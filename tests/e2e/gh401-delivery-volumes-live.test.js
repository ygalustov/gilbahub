/**
 * GH-401 live check — the volumes, the counts, the caption and the export's
 * new total row, read back off the two surfaces a user actually looks at.
 *
 * Every figure asserted here comes out of the painted Plan page or out of the
 * generated .docx's word/document.xml. Nothing recomputes a programme;
 * tests/gh401-delivery-volumes-and-rounding.test.js does that offline against
 * the real recommender, and this file exists to show that what the offline
 * pins say is what the product prints.
 *
 * What each site proves:
 *
 *   New test - location / Putter Green — golf greens, SLAN. Long Paddock Rapid
 *     Uptake is 7 L/ha sprayed four times: the Plan and the document used to
 *     print "1 application, 7 L/ha" beside a Monthly Schedule reading
 *     "4x 7 L/ha". Now 4 and 28. Also the site whose potassium sum sits on an
 *     exact half (104.5), so its caption is the one the rounding snap exists
 *     for: 105, not 104.
 *   Federal Golf / Green 1 — golf greens, SLAN. The soluble case: Urea Tech is
 *     listed in the liquid column but carries kg/ha, twice in each of two
 *     months. 2 applications / 30 kg/ha becomes 4 / 60, and it must stay
 *     kg/ha, not become L/ha (b35fix282).
 *   Burns / 12th Fairway — the control. Its liquid column is Ammonium Sulphate
 *     Tech at one application a month, so NOTHING on it may move.
 *   Test5 - NZ / Soccer — the second control, and the parity reference. The
 *     New Zealand recommender says `splitCount`, which was already honoured,
 *     and never says `applications`.
 *
 * GH-403 extended this file rather than starting another, because it is the
 * same four sites and the same two tables. Two things it now also reads:
 *
 *   - REQUIRED, plan against document. GH-401 measured them disagreeing on
 *     every site that had a decimal to disagree about (New test - location P
 *     14.0/14.2, Federal Golf P 11.9/12.0 and K 63.9/64.0, Burns P 14.0/14.1,
 *     Test5 K 136.0/136.1) and recorded it as a separate question. They are one
 *     quantity now, and the assertion is string equality, not a tolerance.
 *   - THE CAPTION AGAINST ITS OWN ROWS. Burns' Annual Product Summary printed a
 *     Total Delivered of 126 kg N above rows reading 113 + 7 + 5. Rows and
 *     caption are both at 1 dp now and add up exactly, on the Plan page and in
 *     the document.
 *
 * Run: npm run test:e2e:volumes
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

let chromium = null;
try { ({ chromium } = require('playwright')); } catch (e) { /* reported below */ }

const SITES = [
    {
        key: 'new-test-location',
        siteId: '01a00d5b-c67a-7281-8f0f-2d8de6676a0f',
        siteName: 'New test - location',
        sampleClientId: 'Soil_1_3cbn',
        sampleLabel: 'Putter Green',
        delivered: { N: 137.6, P: 18.7, K: 104.5 },
        // GH-403: Required is the engine's annual requirement now, the figure the
        // document prints — P was 14.0 here against 14.2 there.
        required: { N: 120.0, P: 14.2, K: 103.0 },
        // GH-403: the caption is the same 1 dp figure as Delivered, and the rows
        // above it add up to it.
        footer: { N: 137.6, P: 18.7, K: 104.5 },
        // product, applications, printed total rate, and that rate as the
        // per-hectare quantity the programme is built from.
        //
        // GH-409: `rate` is what the two surfaces PRINT and `perHa` is what the
        // recommender computed, and they are no longer the same number on a
        // greens site — 60 kg/ha prints as "6 g/m²". They were the same before,
        // which is why the arithmetic check below used to read the printed
        // string; it reads `perHa` now.
        multiSpray: [{ name: 'Long Paddock Rapid Uptake', applications: 4, rate: '28 L/ha', perHa: 28 }]
    },
    {
        key: 'federal-golf',
        siteId: '019e96d7-36aa-707a-9879-68ab28726e12',
        siteName: 'Federal Golf',
        sampleClientId: 'Green 1',
        sampleLabel: 'Green 1',
        delivered: { N: 135.1, P: 13.2, K: 73.4 },
        // GH-403: was P 11.9 / K 63.9 against a document printing 12.0 / 64.0.
        required: { N: 120.0, P: 12.0, K: 64.0 },
        footer: { N: 135.1, P: 13.2, K: 73.4 },
        // GH-409: Green 1 is a greens surface, so this soluble powder now
        // prints in the surface's unit like every other mass rate in the table
        // — "6 g/m²", the same 60 kg/ha it always was. It used to be the one
        // row in kilograms in a table of g/m² rows.
        multiSpray: [{ name: 'Urea Tech (soluble)', applications: 4, rate: '6 g/m²', perHa: 60 }]
    },
    {
        key: 'burns',
        siteId: '019e96d8-97b7-714c-9bd6-d65b16ec7f2e',
        siteName: 'Burns',
        sampleClientId: 'Soil_25_zo0t',
        sampleLabel: '12th Fairway',
        delivered: { N: 125.5, P: 12.3, K: 0 },
        // GH-403: was N 120.1 / P 14.0 against a document printing 120 / 14.1.
        required: { N: 120.0, P: 14.1, K: 0 },
        // GH-403: the case that exposed defect 2 — this caption read 126 above
        // rows of 113 + 7 + 5.
        footer: { N: 125.5, P: 12.3, K: 0 },
        multiSpray: []
    },
    {
        key: 'test5-nz',
        siteId: '019e96f3-9294-72be-a13c-7fa7427afd5a',
        siteName: 'Test5 - NZ',
        sampleClientId: null,
        sampleLabel: 'Soccer',
        delivered: { N: 237.4, P: 0, K: 175.2 },
        // GH-403: was K 136.0 against a document printing 136.1.
        required: { N: 250.0, P: 0, K: 136.1 },
        footer: { N: 237.4, P: 0, K: 175.2 },
        multiSpray: []
    }
];

const ONLY = process.env.GILBA_E2E_SITE;
const RUN = ONLY ? SITES.filter((s) => s.key === ONLY) : SITES;

function num(v) {
    const n = parseFloat(String(v == null ? '' : v).replace(/[^0-9.\-]/g, ''));
    return isFinite(n) ? n : null;
}
/**
 * GH-409 — a "Total Rate" cell as kilograms (or litres) per hectare.
 *
 * The document used to print a bare number under a header that said "Total
 * kg/ha" for every row. It now prints the Plan page's own per-row unit, which
 * on a greens site is g/m² — a tenth of the same figure — so anything that
 * compares this cell to a per-hectare quantity has to read the unit first.
 */
function rateKgHa(text) {
    const v = num(text);
    if (v == null) return null;
    return /g\/m/.test(String(text)) ? v * 10 : v;
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
function planDeliverySummary(text) {
    const out = {};
    text.split('\n').forEach((line) => {
        const cells = line.split('\t').map((s) => s.trim());
        if (cells.length >= 8 && ['N', 'P', 'K'].includes(cells[0]) && !(cells[0] in out)) {
            out[cells[0]] = { requiredText: cells[3], deliveredText: cells[4],
                              required: num(cells[3]), delivered: num(cells[4]),
                              balance: num(cells[6]), status: cells[7] };
        }
    });
    return out;
}

/**
 * The Plan's Annual Product Summary — every column this ticket touches:
 * the product name, its application COUNT and its printed Total Rate, plus the
 * footer's own three of the same.
 */
/* istanbul ignore next — evaluated in the page, not in node */
function readPlanProductTableInPage() {
    const out = { rows: [], footer: null };
    const tables = Array.from(document.querySelectorAll('#plan-nut-results table'));
    for (const table of tables) {
        const headCells = Array.from(table.querySelectorAll('tr')).map((tr) =>
            Array.from(tr.querySelectorAll('th,td')).map((c) => c.textContent.trim()));
        const headerRow = headCells.find((cells) => /^Product$/i.test(cells[0] || ''));
        if (!headerRow) continue;
        const find = (n) => headerRow.findIndex((c) => c.toUpperCase() === n);
        const idx = { N: find('N'), P: find('P'), K: find('K') };
        if (!(idx.N > 0 && idx.P > 0 && idx.K > 0)) continue;
        Array.from(table.querySelectorAll('tr')).forEach((tr) => {
            const cells = Array.from(tr.querySelectorAll('th,td'));
            if (!cells.length) return;
            // The name cell carries the product in a <strong> and its analysis
            // in a sibling <div>; textContent runs the two together, and the
            // New Zealand panel also appends a release tag to the name.
            const first = cells[0];
            const label = (((first.querySelector('strong') || first).textContent) || '')
                .replace(/\s*Analysis:.*$/, '').trim();
            if (/^Product$/i.test(label)) return;
            const nOf = (cell) => {
                const v = parseFloat((cell.textContent || '').replace(/[^0-9.\-]/g, ''));
                return isFinite(v) ? v : null;
            };
            if (/^Total Delivered$/i.test(label)) {
                // The New Zealand footer merges the first three columns into
                // one colspan cell, so the nutrients are the last three either
                // way; applications and total rate exist only where they were
                // not merged away.
                const tail = cells.slice(-3);
                out.footer = {
                    applicationsText: cells.length > 4 ? (cells[1].textContent || '').trim() : null,
                    rateText: cells.length > 4 ? (cells[2].textContent || '').trim() : null,
                    N: nOf(tail[0]), P: nOf(tail[1]), K: nOf(tail[2])
                };
                return;
            }
            if (/^Required/i.test(label) || /^Balance/i.test(label)) return;
            if (cells.length <= idx.K) return;
            const vec = {
                applicationsText: (cells[1].textContent || '').trim(),
                rateText: (cells[2].textContent || '').trim(),
                N: nOf(cells[idx.N]), P: nOf(cells[idx.P]), K: nOf(cells[idx.K])
            };
            if (vec.N === null && vec.P === null && vec.K === null) return;
            out.rows.push(Object.assign({ name: label }, vec));
        });
        if (out.rows.length) return out;
    }
    return out;
}

if (!ENABLED) {
    process.stdout.write('[e2e] gh401-delivery-volumes-live skipped (needs the live stack) — npm run test:e2e:volumes\n');
    test.skip('GH-401 live volume/rounding check (disabled)', () => {});
} else {

RUN.forEach((site) => {
describe('GH-401 live — ' + site.siteName, () => {
    let browser, page, previousActiveSiteId = null;
    let planSummary = null, planProducts = null, planAnnualCards = null;
    let docxAnr = null, docxProducts = null, docxTotalRow = null;
    let programLiquids = null;
    let hasAnr = false;
    const consoleLines = [];

    beforeAll(async () => {
        if (!chromium) throw new Error('playwright does not resolve from the repo — run `npm install`');
        if (!EMAIL || !PASSWORD) throw new Error('no credentials — see tests/e2e/.e2e-credentials.example.json');
        try { execFileSync('unzip', ['-v'], { stdio: 'ignore' }); }
        catch (e) { throw new Error('`unzip` is not on PATH (used to read word/document.xml out of the .docx)'); }

        browser = await chromium.launch();
        page = await browser.newPage({ acceptDownloads: true });
        page.on('console', (m) => {
            const t = m.text();
            if (/is not loaded|\[NutritionDelivery\]|GH-401/i.test(t)) consoleLines.push(m.type() + ': ' + t);
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

        const sites = await page.evaluate(async () => {
            const r = await fetch('/api/sites', { headers: { Accept: 'application/json' }, credentials: 'same-origin' });
            return r.json();
        });
        previousActiveSiteId = sites.active_site_id;
        if (previousActiveSiteId !== site.siteId) {
            await page.evaluate(async ({ id }) => {
                const t = document.querySelector('meta[name=csrf-token]');
                await fetch('/api/active-site', {
                    method: 'PATCH',
                    headers: Object.assign({ 'Content-Type': 'application/json', Accept: 'application/json' },
                        t ? { 'X-CSRF-TOKEN': t.getAttribute('content') } : {}),
                    body: JSON.stringify({ site_id: id }),
                    credentials: 'same-origin',
                });
            }, { id: site.siteId });
        }

        // ── Plan page ───────────────────────────────────────────────────────
        await page.goto(BASE_URL + '/plan', { waitUntil: 'domcontentloaded' });
        await page.waitForFunction(() => !!window.GilbaNutritionCalendar, null, { timeout: 30000 });
        await page.waitForTimeout(2500);
        await page.click('a[data-tab="nutrition"]');
        await page.waitForTimeout(1000);
        await page.waitForSelector('#plan-nut-sample-picker .sn-drop-btn', { timeout: 20000 });
        const picked = await page.evaluate((label) => {
            const btn = document.querySelector('#plan-nut-sample-picker .sn-drop-btn');
            if (!btn) return { ok: false, reason: 'no picker' };
            btn.click();
            const rows = Array.from(document.querySelectorAll('#plan-nut-sample-picker .sn-drop-row'));
            const labels = rows.map((r) => ((r.querySelector('.sn-drop-cell-zone') || {}).textContent || '').trim());
            const i = label ? labels.indexOf(label) : 0;
            if (i < 0) return { ok: false, reason: 'label not in picker', available: labels };
            rows[i].click();
            return { ok: true, label: labels[i] };
        }, site.sampleLabel);
        if (!picked.ok) throw new Error('could not pin "' + site.sampleLabel + '" in the Plan sample picker: ' + JSON.stringify(picked));
        site.resolvedSampleLabel = picked.label;
        await page.waitForTimeout(1200);

        await page.evaluate(() => {
            window.__gh401Generated = 0;
            document.addEventListener('gaip:nutrition-calendar-generated', () => { window.__gh401Generated++; });
        });
        await page.click('#plan-nut-generate-btn');
        await page.waitForFunction(() => {
            const el = document.querySelector('#plan-nut-results');
            if (!(window.__gh401Generated > 0 && el && el.style.display !== 'none')) return false;
            return /Nutrient Delivery Summary/i.test(el.innerText || '');
        }, null, { timeout: 90000 });
        await page.waitForTimeout(2000);

        const planText = await page.evaluate(() => (document.querySelector('#plan-nut-results') || document.body).innerText);
        planSummary = planDeliverySummary(planText);
        planProducts = await page.evaluate(readPlanProductTableInPage);

        // GH-403: the "Annual Requirements (kg/ha)" cards at the top of the
        // Plan's own summary. They print `annual_totals`, which is no longer a
        // whole number, so they are read back here to show they render the
        // engine's figure rather than an unrounded double.
        planAnnualCards = await page.evaluate(() => {
            const out = {};
            document.querySelectorAll('.gilba-nut-totals-row .gilba-nut-total').forEach((el) => {
                const name = ((el.querySelector('.gilba-nut-total-name') || {}).textContent || '').trim();
                const val = ((el.querySelector('.gilba-nut-total-val') || {}).textContent || '').trim();
                if (name) out[name.replace(/Generic$/, '').trim()] = val;
            });
            return out;
        });

        // The programme object the page just generated — the `applications`
        // count the printed volume is supposed to be a multiple of.
        programLiquids = await page.evaluate(() => {
            const prog = window.GAIP_NUTRITION_PROGRAM;
            if (!prog || !prog.monthly) return null;
            const out = [];
            prog.monthly.forEach((m) => (m.liquid || []).forEach((p) => out.push({
                month: m.month_name, name: p.name, form: p.form,
                rateLHa: p.rateLHa, rateKgHa: p.rateKgHa,
                applications: p.applications, splitCount: p.splitCount
            })));
            return out;
        });

        // ── Word export, that one sample ────────────────────────────────────
        await page.goto(BASE_URL + '/reports/export', { waitUntil: 'domcontentloaded' });
        await page.waitForFunction(() => !!(window.GilbaNutritionCalendar && window.NutritionRequirementEngine_Pure &&
            (window.PrebbleRecommender || window.AuFertiliserRecommender) && window.GAIP_SampleManager),
            null, { timeout: 30000 });
        await page.waitForFunction(() => {
            const el = document.querySelector('.gaip-nutrition-annual-n');
            return !!(el && el.value);
        }, null, { timeout: 20000 }).catch(() => {});
        await page.waitForTimeout(2500);

        await page.click('text=Generate & Download Word');
        await page.waitForSelector('.gaip-bulk-area-backdrop', { timeout: 15000 });
        await page.waitForTimeout(500);
        await page.click('text=Deselect all');
        await page.waitForTimeout(300);
        const pick = await page.evaluate(({ id, clientId, label }) => {
            const boxes = Array.from(document.querySelectorAll('input[data-sample-uid]'));
            const rowText = (c) => (((c.closest('label') || c.parentElement) || {}).textContent || '').trim().replace(/\s+/g, ' ');
            const available = boxes.map((c) => ({ uid: c.getAttribute('data-sample-uid'), text: rowText(c) }));
            const mine = boxes.filter((c) => String(c.getAttribute('data-sample-uid') || '').indexOf(id) === 0);
            let cb = clientId ? mine.find((c) => c.getAttribute('data-sample-uid') === id + '::' + clientId) : null;
            if (!cb && label) cb = mine.find((c) => rowText(c).indexOf(label) >= 0);
            if (!cb && mine.length === 1) cb = mine[0];
            if (!cb) return { found: false, available };
            cb.checked = true;
            cb.dispatchEvent(new Event('change', { bubbles: true }));
            return { found: true, uid: cb.getAttribute('data-sample-uid'), text: rowText(cb),
                     checked: document.querySelectorAll('input[data-sample-uid]:checked').length };
        }, { id: site.siteId, clientId: site.sampleClientId, label: site.resolvedSampleLabel });
        if (!pick.found) throw new Error('no sample checkbox for ' + site.siteName + ' in the export picker: ' + JSON.stringify(pick));
        site.exportedUid = pick.uid;
        site.exportedRowText = pick.text;
        if (pick.checked !== 1) throw new Error('expected exactly one ticked sample, got ' + pick.checked);

        const [download] = await Promise.all([
            page.waitForEvent('download', { timeout: 180000 }),
            page.locator('button:has-text("Generate & Download")').last().click()
        ]);
        const docxPath = path.join(os.tmpdir(), 'gilba-gh401-' + site.key + '-' + Date.now() + '.docx');
        await download.saveAs(docxPath);
        const xml = execFileSync('unzip', ['-p', docxPath, 'word/document.xml'],
            { maxBuffer: 64 * 1024 * 1024 }).toString();
        const tables = docxTables(xml);

        const anrT = findTable(tables, ['Sample', 'Nutrient', 'Current (kg/ha, ppm)', 'Removal',
                                        'Required', 'Delivered', 'Range', 'Balance', 'Status']);
        docxAnr = {};
        if (anrT) {
            anrT.slice(1).forEach((r) => {
                const nutrient = String(r[1]).trim();
                if (!['N', 'P', 'K'].includes(nutrient) || docxAnr[nutrient]) return;
                docxAnr[nutrient] = {
                    requiredText: String(r[4]).trim(),
                    deliveredText: String(r[5]).trim(),
                    required: num(r[4]),
                    delivered: String(r[5]).trim() === '—' ? null : num(r[5]),
                    status: String(r[8]).trim()
                };
            });
        }
        hasAnr = Object.keys(docxAnr).length === 3;

        // GH-409: the header is the Plan page's own "Total Rate" now — the unit
        // moved onto each row, because it is not the same on every row.
        const prodT = findTable(tables, ['Product', 'Applications', 'Total Rate', 'N']);
        docxProducts = [];
        docxTotalRow = null;
        if (prodT) {
            const header = prodT[0].map((h) => String(h).trim());
            const col = (n) => header.indexOf(n);
            prodT.slice(1).forEach((r) => {
                const row = {
                    name: String(r[0]).trim(),
                    applicationsText: String(r[1]).trim(),
                    rateText: String(r[2]).trim(),
                    N: num(r[col('N')]),
                    P: col('P') >= 0 ? num(r[col('P')]) : 0,
                    K: num(r[col('K')])
                };
                if (!row.name) return;
                if (/^Total Delivered$/i.test(row.name)) { docxTotalRow = row; return; }
                docxProducts.push(row);
            });
        }

        if (process.env.GILBA_E2E_KEEP === '1') process.stdout.write('[gh401] kept ' + docxPath + '\n');
        else { try { fs.unlinkSync(docxPath); } catch (e) { /* best effort */ } }

        const line = (s) => process.stdout.write('[gh401] ' + s + '\n');
        line(site.siteName + ' / ' + site.resolvedSampleLabel + (site.multiSpray.length ? '' : '  (control — no multi-spray liquid)'));
        line('  exported sample: ' + site.exportedUid + '  "' + site.exportedRowText + '"');
        ['N', 'P', 'K'].forEach((n) => {
            const p = planSummary[n] || {}, d = docxAnr[n] || {};
            line('    ' + n + ':  required plan "' + p.requiredText + '" / document "' + d.requiredText +
                 '"   delivered plan "' + p.deliveredText + '" / document "' + d.deliveredText + '"');
        });
        line('  Plan "Annual Requirements (kg/ha)" cards: ' + JSON.stringify(planAnnualCards));
        line('  Plan Annual Product Summary (applications / total rate / N / P / K):');
        planProducts.rows.forEach((r) => line('      ' + r.name + '  ' + r.applicationsText + '  ' +
            r.rateText + '  ' + r.N + ' / ' + r.P + ' / ' + r.K));
        line('    footer: ' + (planProducts.footer ? planProducts.footer.applicationsText + '  ' +
            planProducts.footer.rateText + '  ' + planProducts.footer.N + ' / ' + planProducts.footer.P +
            ' / ' + planProducts.footer.K : '(none)'));
        line('  Document Annual Product Summary:');
        docxProducts.forEach((r) => line('      ' + r.name + '  ' + r.applicationsText + '  ' +
            r.rateText + '  ' + r.N + ' / ' + r.P + ' / ' + r.K));
        line('    Total Delivered row: ' + (docxTotalRow ? docxTotalRow.applicationsText + '  ' +
            docxTotalRow.rateText + '  ' + docxTotalRow.N + ' / ' + docxTotalRow.P + ' / ' +
            docxTotalRow.K : '(MISSING)'));
        if (consoleLines.length) line('  console: ' + JSON.stringify(consoleLines.slice(0, 20)));
    }, 400000);

    afterAll(async () => {
        if (page && previousActiveSiteId && previousActiveSiteId !== site.siteId) {
            await page.evaluate(async ({ id }) => {
                const t = document.querySelector('meta[name=csrf-token]');
                await fetch('/api/active-site', {
                    method: 'PATCH',
                    headers: Object.assign({ 'Content-Type': 'application/json', Accept: 'application/json' },
                        t ? { 'X-CSRF-TOKEN': t.getAttribute('content') } : {}),
                    body: JSON.stringify({ site_id: id }),
                    credentials: 'same-origin',
                });
            }, { id: previousActiveSiteId });
        }
        if (browser) await browser.close();
    }, 120000);

    test('both surfaces rendered the tables this file reads', () => {
        expect(Object.keys(planSummary).sort()).toEqual(['K', 'N', 'P']);
        expect(planProducts.rows.length).toBeGreaterThan(0);
        expect(planProducts.footer).not.toBeNull();
        expect(docxProducts.length).toBeGreaterThan(0);
        expect(consoleLines.filter((l) => /is not loaded/i.test(l))).toEqual([]);
    });

    test('a multi-spray liquid prints every spray it costs', () => {
        if (!site.multiSpray.length) {
            // Control: nothing on this site carries an `applications` count
            // above one, so there is nothing for this stage to move. New
            // Zealand's `splitCount` is deliberately NOT part of the check —
            // it was already honoured before this ticket, and Test5's Pro
            // Balance is applied twice.
            const repeated = (programLiquids || []).filter((l) => (l.applications || 1) > 1);
            expect(repeated).toEqual([]);
            return;
        }
        const bad = [];
        site.multiSpray.forEach((want) => {
            const planRow = planProducts.rows.find((r) => r.name === want.name);
            const docRow = docxProducts.find((r) => r.name === want.name);
            if (!planRow) { bad.push({ surface: 'plan', name: want.name, why: 'row missing' }); return; }
            if (!docRow) { bad.push({ surface: 'document', name: want.name, why: 'row missing' }); return; }
            if (planRow.applicationsText !== String(want.applications)) {
                bad.push({ surface: 'plan', name: want.name, what: 'applications', got: planRow.applicationsText, want: String(want.applications) });
            }
            if (planRow.rateText !== want.rate) {
                bad.push({ surface: 'plan', name: want.name, what: 'total rate', got: planRow.rateText, want: want.rate });
            }
            if (docRow.applicationsText !== String(want.applications)) {
                bad.push({ surface: 'document', name: want.name, what: 'applications', got: docRow.applicationsText, want: String(want.applications) });
            }
            // GH-409: the two cells are now the same string, unit and all. They
            // were the same number under different labels — the document's
            // column was headed "Total kg/ha" and printed a bare number, which
            // on a greens site was ten times what the Plan showed beside it.
            if (docRow.rateText !== want.rate) {
                bad.push({ surface: 'document', name: want.name, what: 'total rate', got: docRow.rateText, want: want.rate });
            }
        });
        expect(bad).toEqual([]);
    });

    test('the printed volume is the recommender\'s rate times its own application count', () => {
        // Derived from the programme the page generated, so this cannot pass
        // by the renderer and the recommender sharing a wrong number.
        //
        // GH-409: compared against `perHa`, the per-hectare quantity, and the
        // PRINTED cell is converted into that unit rather than parsed as a bare
        // number. The two used to be the same figure; on a greens site they are
        // a factor of ten apart, and reading "6 g/m²" as 6 kg/ha is precisely
        // the mistake this ticket exists to stop anyone making.
        if (!site.multiSpray.length) return;
        const bad = [];
        site.multiSpray.forEach((want) => {
            const apps = (programLiquids || []).filter((l) => l.name === want.name);
            if (!apps.length) { bad.push({ name: want.name, why: 'not in the programme' }); return; }
            const total = apps.reduce((a, l) => a + (l.rateLHa || l.rateKgHa || 0) * (l.applications || 1), 0);
            const count = apps.reduce((a, l) => a + (l.applications || 1), 0);
            if (Math.abs(total - want.perHa) > 0.51) bad.push({ name: want.name, what: 'volume', programme: total, expected: want.perHa });
            if (Math.abs(rateKgHa(want.rate) - want.perHa) > 0.51) {
                bad.push({ name: want.name, what: 'the printed cell is not that quantity', printed: want.rate, perHa: want.perHa });
            }
            if (count !== want.applications) bad.push({ name: want.name, what: 'count', programme: count, printed: want.applications });
        });
        expect(bad).toEqual([]);
    });

    test('Delivered and Required print at one decimal on both surfaces, and agree', () => {
        const bad = [];
        ['N', 'P', 'K'].forEach((n) => {
            const p = planSummary[n] || {};
            if (!/^-?\d+\.\d$/.test(p.deliveredText || '')) bad.push({ nutrient: n, what: 'plan delivered format', got: p.deliveredText });
            if (!/^-?\d+\.\d$/.test(p.requiredText || '')) bad.push({ nutrient: n, what: 'plan required format', got: p.requiredText });
            if (Math.abs(p.delivered - site.delivered[n]) > 0.05) bad.push({ nutrient: n, what: 'plan delivered', got: p.delivered, want: site.delivered[n] });
            if (Math.abs(p.required - site.required[n]) > 0.05) bad.push({ nutrient: n, what: 'plan required', got: p.required, want: site.required[n] });
            if (!hasAnr) return;
            const d = docxAnr[n] || {};
            if (d.delivered != null && Math.abs(p.delivered - d.delivered) > 0.05) {
                bad.push({ nutrient: n, what: 'delivered disagrees', plan: p.delivered, document: d.delivered });
            }
        });
        expect(bad).toEqual([]);
    });

    test('GH-403 — Required is ONE quantity: the plan cell and the document cell are the same string', () => {
        // Not a tolerance. Both surfaces round the shared core's
        // `annualRequirement` once, at 1 dp, so the characters must match.
        // GH-405: nitrogen is no longer excluded. It used to be — the document's
        // ANR table printed the programme's own annual N at 0 dp ("120" against
        // the Plan's "120.0") — which was a precision difference in one cell
        // rather than a second quantity, but a difference all the same. That
        // cell now rounds like the P and K cells beside it, so all three
        // nutrients are held to the same string equality here.
        if (!hasAnr) { expect(hasAnr).toBe(true); return; }
        const bad = [];
        ['N', 'P', 'K'].forEach((n) => {
            const p = planSummary[n] || {};
            const d = docxAnr[n] || {};
            if (p.requiredText !== d.requiredText) {
                bad.push({ nutrient: n, what: 'required disagrees', plan: p.requiredText, document: d.requiredText });
            }
            if (Math.abs(p.required - d.required) > 1e-9) {
                bad.push({ nutrient: n, what: 'required disagrees numerically', plan: p.required, document: d.required });
            }
        });
        expect(bad).toEqual([]);
    });

    test('GH-403 — the Annual Requirements cards print the same Required the two tables do', () => {
        // The cards used to print a whole kilogram (`${totals[el]}` straight off
        // annual_totals). With the whole-kilogram rounding gone they would print
        // a raw double if nothing rounded them, so this reads the painted text.
        const bad = [];
        ['N', 'P', 'K'].forEach((n) => {
            const card = (planAnnualCards || {})[n];
            if (!/^-?\d+\.\d$/.test(card || '')) { bad.push({ nutrient: n, what: 'card format', got: card }); return; }
            const p = planSummary[n] || {};
            if (card !== p.requiredText) bad.push({ nutrient: n, what: 'card vs table', card: card, table: p.requiredText });
        });
        expect(bad).toEqual([]);
    });

    test('GH-403 — the caption is the sum of the rows printed above it, on both surfaces', () => {
        const bad = [];
        [['plan', planProducts.rows, planProducts.footer],
         ['document', docxProducts.slice(0, planProducts.rows.length), docxTotalRow]].forEach(([surface, rows, footer]) => {
            if (!footer) { bad.push({ surface, why: 'no Total Delivered row' }); return; }
            ['N', 'P', 'K'].forEach((n) => {
                const sum = Math.round(rows.reduce((a, r) => a + (r[n] || 0), 0) * 10) / 10;
                if (Math.abs(sum - footer[n]) > 1e-9) {
                    bad.push({ surface, nutrient: n, rows: sum, caption: footer[n] });
                }
            });
        });
        expect(bad).toEqual([]);
    });

    test('the Plan caption is the rounded total, and the document now carries the same row', () => {
        // Stage 5. Before this ticket the document's Annual Product Summary
        // simply ended at the last product.
        expect(docxTotalRow).not.toBeNull();
        const bad = [];
        ['N', 'P', 'K'].forEach((n) => {
            if (planProducts.footer[n] !== site.footer[n]) {
                bad.push({ nutrient: n, surface: 'plan footer', got: planProducts.footer[n], want: site.footer[n] });
            }
            if (docxTotalRow[n] !== site.footer[n]) {
                bad.push({ nutrient: n, surface: 'document total row', got: docxTotalRow[n], want: site.footer[n] });
            }
        });
        expect(bad).toEqual([]);
    });

    test("the document's own two tables agree: total row against ANR Delivered", () => {
        if (!hasAnr) { expect(docxTotalRow).not.toBeNull(); return; }
        const bad = [];
        ['N', 'P', 'K'].forEach((n) => {
            const d = docxAnr[n];
            if (d.delivered == null) return;
            if (Math.abs(docxTotalRow[n] - d.delivered) > 0.5) {
                bad.push({ nutrient: n, totalRow: docxTotalRow[n], anrDelivered: d.delivered });
            }
        });
        expect(bad).toEqual([]);
    });

    test('the total row counts the catalogue programme, not the amendments beside it', () => {
        // The document renders the catalogue programme first, in the Plan's
        // own order, and appends whatever amendments it decided on (b35fix322/
        // 323) — so the first N rows are the catalogue, N being the number of
        // rows the Plan shows. Matching by position rather than by name is
        // deliberate: the two surfaces render the same product under slightly
        // different labels (the Plan appends the release tag), and comparing
        // the FIGURES by position is the stronger check anyway.
        const catalogue = docxProducts.slice(0, planProducts.rows.length);
        const amendmentRows = docxProducts.slice(planProducts.rows.length);

        const mismatched = [];
        planProducts.rows.forEach((pr, i) => {
            ['N', 'P', 'K'].forEach((n) => {
                if (pr[n] !== catalogue[i][n]) {
                    mismatched.push({ row: i, plan: pr.name, document: catalogue[i].name, nutrient: n, planValue: pr[n], documentValue: catalogue[i][n] });
                }
            });
        });
        expect(mismatched).toEqual([]);

        const catalogueSum = { N: 0, P: 0, K: 0 };
        catalogue.forEach((r) => {
            catalogueSum.N += r.N || 0; catalogueSum.P += r.P || 0; catalogueSum.K += r.K || 0;
        });
        const bad = [];
        ['N', 'P', 'K'].forEach((n) => {
            // Whole-kg rows against a once-rounded total: half a kilo per row.
            const tol = 0.5 * catalogue.length + 0.5;
            if (Math.abs(docxTotalRow[n] - catalogueSum[n]) > tol) {
                bad.push({ nutrient: n, totalRow: docxTotalRow[n], catalogueRows: catalogueSum[n], tolerance: tol });
            }
        });
        expect(bad).toEqual([]);

        if (amendmentRows.length) {
            // ...and the amendments really are outside it: their mass is not
            // in the total row's rate cell.
            //
            // GH-409: read in kilograms per hectare, because the cells now
            // carry their own units and a greens row is in g/m². Only the mass
            // rows are summed — the total row states litres separately, after a
            // "+", precisely so the two are never added together, and an
            // amendment is never a spray.
            const massOnly = (rows) => rows.filter((r) => !/L\/ha/.test(r.rateText || ''))
                                           .reduce((a, r) => a + (rateKgHa(r.rateText) || 0), 0);
            const amendmentMass = massOnly(amendmentRows);
            expect(amendmentMass).toBeGreaterThan(0);
            const allMass = massOnly(docxProducts);
            expect(rateKgHa(String(docxTotalRow.rateText).split('+')[0])).toBeLessThan(allMass);
            process.stdout.write('[gh401]   amendment rows excluded from the total: ' +
                amendmentRows.map((r) => r.name).join(', ') + '\n');
        }
    });
});
});

}

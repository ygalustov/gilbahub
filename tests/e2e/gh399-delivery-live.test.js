/**
 * GH-399 live check — "Delivered" is ONE number on both surfaces, and each
 * surface agrees with itself.
 *
 * What this reads, all of it rendered rather than computed:
 *
 *   - the Plan page's Nutrient Delivery Summary "Delivered" column (N/P/K) and
 *     its Annual Product Summary rows, out of the DOM the browser painted;
 *   - the generated .docx's Annual Nutrient Requirements "Delivered" column and
 *     its Annual Product Summary rows, parsed out of word/document.xml.
 *
 * Then four questions, in order of what they would tell you:
 *
 *   1. Do the two surfaces print the same Delivered figure? This is the
 *      ticket. Before GH-399 the SLAN site printed 14.0 on the Plan and 14.5 in
 *      the document, and the same phosphorus verdict rendered as -7% on one and
 *      -5% on the other, because five hand-maintained accumulators computed
 *      this quantity and disagreed about whether a declared zero was a zero.
 *   2. Does the DOCUMENT agree with itself — its product rows against its own
 *      ANR total? Its rows and its total came from two different accumulators
 *      (_extractEntryNutrients topped a zero P up from analysis; the ANR column
 *      read the honest zero), so one page could contradict the next.
 *   3. Does the PLAN agree with itself — its Delivered column against its own
 *      "Total Delivered" footer?
 *   4. Do the two surfaces' per-product phosphorus rows match?
 *
 * The parity harness (ui-vs-export-parity.test.js) asserts 1-4 as pass/fail
 * across its three fixtures. This file exists to PRINT the figures as well, so
 * a run leaves the actual rendered numbers behind rather than only a verdict —
 * and so the phosphorus rows of the two Australian liquids that caused the
 * defect can be read directly.
 *
 * Defaults to the SLAN fixture (New test - location / Putter Green), the site
 * the divergence was found on. Point GILBA_E2E_FIXTURE elsewhere to run it on
 * another. Credentials come from tests/e2e/.e2e-credentials.json.
 *
 * Run: npm run test:e2e:delivery
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
const FIXTURE_PATH = process.env.GILBA_E2E_FIXTURE
    || path.join(__dirname, '../fixtures/e2e-parity-new-test-location-slan.json');

let chromium = null;
try { ({ chromium } = require('playwright')); } catch (e) { /* reported below */ }

if (!ENABLED) {
    process.stdout.write('[e2e] gh399-delivery-live skipped (needs the live stack) — npm run test:e2e:delivery\n');
    test.skip('GH-399 live delivery-parity check (disabled)', () => {});
} else {

const fixture = JSON.parse(fs.readFileSync(FIXTURE_PATH, 'utf8'));
const SITE_ID = fixture.site.id;
const SITE_NAME = fixture.site.name;
const SAMPLE_LABEL = fixture.soilSample.label;
const SAMPLE_UID = SITE_ID + '::' + fixture.soilSample.clientId;

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

/** The first table whose header row starts with these column names. */
function findTable(tables, header) {
    return (tables || []).find((rows) => {
        const h = (rows[0] || []).map((c) => String(c).trim());
        return header.every((want, i) => h[i] === want);
    }) || null;
}

// ── the Plan page's two tables, read from innerText (tab-separated cells) ──

/** Nutrient Delivery Summary: Nutrient | Current | Removal | Required |
 *  Delivered | Range | Balance | Status. */
function planDeliverySummary(text) {
    const out = {};
    text.split('\n').forEach((line) => {
        const cells = line.split('\t').map((s) => s.trim());
        if (cells.length >= 8 && ['N', 'P', 'K'].includes(cells[0]) && !(cells[0] in out)) {
            out[cells[0]] = { required: num(cells[3]), delivered: num(cells[4]),
                              balance: num(cells[6]), status: cells[7] };
        }
    });
    return out;
}

/**
 * Annual Product Summary rows and footer, from the rendered <table> rather
 * than from innerText.
 *
 * innerText will not do here, and finding that out is worth writing down: each
 * product's name cell carries a second line ("Analysis: 18-9-18", the release
 * tag), so a row is not one line of text and a tab-split read comes back with
 * the numbers correct and every NAME empty. The figures then look right while
 * the row-by-row comparison silently matches nothing.
 *
 * Column-indexed off the table's own header, because the two panels differ and
 * the parity harness has been bitten by assuming N/P/K sit at cells 1-3
 * (GH-387): the AU header is "Product | Applications | Total Rate | N | P | K",
 * so that assumption reads the application COUNT as delivered N.
 *
 * Runs in the browser; returns plain data.
 */
/* istanbul ignore next — evaluated in the page, not in node */
function readPlanProductTableInPage() {
    const out = { rows: [], footer: {} };
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
            if (cells.length <= idx.K) return;
            // First line only: the name cell carries "Analysis: ..." beneath.
            const label = (cells[0].textContent || '').trim().split('\n')[0].trim();
            if (/^Product$/i.test(label)) return;
            const n = (i) => {
                const v = parseFloat((cells[i].textContent || '').replace(/[^0-9.\-]/g, ''));
                return isFinite(v) ? v : null;
            };
            const vec = { N: n(idx.N), P: n(idx.P), K: n(idx.K) };
            if (vec.N === null && vec.P === null && vec.K === null) return;
            if (/^Total Delivered$/i.test(label)) { out.footer.delivered = vec; return; }
            if (/^Required/i.test(label) || /^Balance/i.test(label)) return;
            out.rows.push(Object.assign({ name: label }, vec));
        });
        if (out.rows.length) return out;
    }
    return out;
}

describe('GH-399 — one "Delivered" on both surfaces (' + SITE_NAME + ' / ' + SAMPLE_LABEL + ')', () => {
    let browser, page, previousActiveSiteId = null;
    let planSummary = null, planProducts = null;
    let docxAnr = null, docxProducts = null;
    const consoleLines = [];

    beforeAll(async () => {
        if (!chromium) throw new Error('playwright does not resolve from the repo — run `npm install`');
        if (!EMAIL || !PASSWORD) throw new Error('no credentials — see tests/e2e/.e2e-credentials.example.json');
        try {
            execFileSync('unzip', ['-v'], { stdio: 'ignore' });
        } catch (e) {
            throw new Error('`unzip` is not on PATH (used to read word/document.xml out of the .docx)');
        }

        browser = await chromium.launch();
        page = await browser.newPage({ acceptDownloads: true });
        // The module's own load-order guard is a console.error. A run where it
        // fires produced zeros from a fallback, not agreement, and the two
        // surfaces would agree on nothing being delivered at all.
        page.on('console', (m) => {
            const t = m.text();
            if (/GH-399|is not loaded|\[NutritionDelivery\]/i.test(t)) consoleLines.push(m.type() + ': ' + t);
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
        if (previousActiveSiteId !== SITE_ID) {
            await page.evaluate(async ({ id }) => {
                const t = document.querySelector('meta[name=csrf-token]');
                await fetch('/api/active-site', {
                    method: 'PATCH',
                    headers: Object.assign({ 'Content-Type': 'application/json', Accept: 'application/json' },
                        t ? { 'X-CSRF-TOKEN': t.getAttribute('content') } : {}),
                    body: JSON.stringify({ site_id: id }),
                    credentials: 'same-origin',
                });
            }, { id: SITE_ID });
        }

        // ── Plan page ───────────────────────────────────────────────────────
        await page.goto(BASE_URL + '/plan', { waitUntil: 'domcontentloaded' });
        await page.waitForFunction(() => !!window.GilbaNutritionCalendar, null, { timeout: 30000 });
        await page.waitForTimeout(2500); // site-config restore cascade
        await page.click('a[data-tab="nutrition"]');
        await page.waitForTimeout(1000);
        await page.waitForSelector('#plan-nut-sample-picker .sn-drop-btn', { timeout: 20000 });
        const picked = await page.evaluate((label) => {
            const btn = document.querySelector('#plan-nut-sample-picker .sn-drop-btn');
            if (!btn) return { ok: false, reason: 'no picker' };
            btn.click();
            const rows = Array.from(document.querySelectorAll('#plan-nut-sample-picker .sn-drop-row'));
            const row = rows.find((r) => ((r.querySelector('.sn-drop-cell-zone') || {}).textContent || '').trim() === label);
            if (!row) {
                return { ok: false, reason: 'label not in picker',
                         available: rows.map((r) => ((r.querySelector('.sn-drop-cell-zone') || {}).textContent || '').trim()) };
            }
            row.click();
            return { ok: true };
        }, SAMPLE_LABEL);
        if (!picked.ok) throw new Error('could not pin "' + SAMPLE_LABEL + '" in the Plan sample picker: ' + JSON.stringify(picked));
        await page.waitForTimeout(1200);

        await page.evaluate(() => {
            window.__gh399Generated = 0;
            document.addEventListener('gaip:nutrition-calendar-generated', () => { window.__gh399Generated++; });
        });
        await page.click('#plan-nut-generate-btn');
        // Wait for the recommendation panel, not just the calendar: the
        // Delivered column this file reads is rendered by the regional
        // integration, one step after the calendar event.
        await page.waitForFunction(() => {
            const el = document.querySelector('#plan-nut-results');
            if (!(window.__gh399Generated > 0 && el && el.style.display !== 'none')) return false;
            return /Nutrient Delivery Summary/i.test(el.innerText || '');
        }, null, { timeout: 90000 });
        await page.waitForTimeout(2000);

        const planText = await page.evaluate(() => (document.querySelector('#plan-nut-results') || document.body).innerText);
        planSummary = planDeliverySummary(planText);
        planProducts = await page.evaluate(readPlanProductTableInPage);

        // ── Word export, one sample ─────────────────────────────────────────
        await page.goto(BASE_URL + '/reports/export', { waitUntil: 'domcontentloaded' });
        await page.waitForFunction(() => !!(window.GilbaNutritionCalendar && window.NutritionRequirementEngine_Pure &&
            (window.PrebbleRecommender || window.AuFertiliserRecommender) && window.GAIP_SampleManager),
            null, { timeout: 30000 });
        // Exporting before the site-config restore lands produces a document
        // with no Annual Nutrient Requirements section at all, which reads
        // exactly like "the table regressed".
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
        const pick = await page.evaluate(({ uid }) => {
            const cb = document.querySelector('input[data-sample-uid="' + uid + '"]');
            if (!cb) {
                return { found: false, available: Array.from(document.querySelectorAll('input[data-sample-uid]'))
                    .map((c) => c.getAttribute('data-sample-uid')) };
            }
            cb.checked = true;
            cb.dispatchEvent(new Event('change', { bubbles: true }));
            return { found: true, checked: document.querySelectorAll('input[data-sample-uid]:checked').length };
        }, { uid: SAMPLE_UID });
        if (!pick.found) throw new Error('fixture sample ' + SAMPLE_UID + ' not in the export picker: ' + JSON.stringify(pick));
        if (pick.checked !== 1) throw new Error('expected exactly one ticked sample, got ' + pick.checked);

        const [download] = await Promise.all([
            page.waitForEvent('download', { timeout: 180000 }),
            page.locator('button:has-text("Generate & Download")').last().click()
        ]);
        const docxPath = path.join(os.tmpdir(), 'gilba-gh399-' + Date.now() + '.docx');
        await download.saveAs(docxPath);
        const xml = execFileSync('unzip', ['-p', docxPath, 'word/document.xml'],
            { maxBuffer: 64 * 1024 * 1024 }).toString();
        const tables = docxTables(xml);

        const anrT = findTable(tables, ['Sample', 'Nutrient', 'Current (kg/ha, ppm)', 'Removal',
                                        'Required', 'Delivered', 'Range', 'Balance', 'Status']);
        docxAnr = {};
        if (anrT) {
            anrT.slice(1).forEach((r) => {
                if (!r[0] || r[0].trim() !== SAMPLE_LABEL) return;
                docxAnr[String(r[1]).trim()] = {
                    required: num(r[4]),
                    delivered: String(r[5]).trim() === '—' ? null : num(r[5]),
                    balance: String(r[7]).trim() === '—' ? null : num(r[7]),
                    status: String(r[8]).trim()
                };
            });
        }

        const prodT = findTable(tables, ['Product', 'Applications', 'Total kg/ha', 'N']);
        docxProducts = [];
        if (prodT) {
            const header = prodT[0].map((h) => String(h).trim());
            const col = (n) => header.indexOf(n);
            docxProducts = prodT.slice(1).map((r) => ({
                name: String(r[0]).trim(),
                N: num(r[col('N')]),
                P: col('P') >= 0 ? num(r[col('P')]) : 0,
                K: num(r[col('K')])
            })).filter((r) => r.name && !/^Total/i.test(r.name));
        }

        if (process.env.GILBA_E2E_KEEP === '1') {
            process.stdout.write('[gh399] kept ' + docxPath + '\n');
        } else {
            try { fs.unlinkSync(docxPath); } catch (e) { /* best effort */ }
        }

        // The point of the file: leave the rendered figures behind.
        const line = (s) => process.stdout.write('[gh399] ' + s + '\n');
        line(SITE_NAME + ' / ' + SAMPLE_LABEL);
        line('  Delivered — Plan "Nutrient Delivery Summary" vs document "Annual Nutrient Requirements"');
        ['N', 'P', 'K'].forEach((n) => {
            const p = planSummary[n] || {}, d = docxAnr[n] || {};
            line('    ' + n + ':  plan ' + p.delivered + ' (' + p.status + ')' +
                 '   document ' + d.delivered + ' (' + d.status + ')' +
                 '   required plan ' + p.required + ' / document ' + d.required);
        });
        line('  Plan "Total Delivered" footer: ' + JSON.stringify(planProducts.footer.delivered));
        line('  Annual Product Summary rows (N / P / K):');
        line('    plan:');
        planProducts.rows.forEach((r) => line('      ' + r.name + '  ' + r.N + ' / ' + r.P + ' / ' + r.K));
        line('    document:');
        docxProducts.forEach((r) => line('      ' + r.name + '  ' + r.N + ' / ' + r.P + ' / ' + r.K));
        if (consoleLines.length) line('  console: ' + JSON.stringify(consoleLines.slice(0, 20)));
    }, 300000);

    afterAll(async () => {
        if (page && previousActiveSiteId && previousActiveSiteId !== SITE_ID) {
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
        expect(Object.keys(docxAnr).sort()).toEqual(expect.arrayContaining(['K', 'N', 'P']));
        expect(planProducts.rows.length).toBeGreaterThan(0);
        expect(docxProducts.length).toBeGreaterThan(0);
    });

    test('the delivery module was loaded on both pages — no guard fired', () => {
        // Its absence would print zeros on both surfaces, which "agree".
        expect(consoleLines.filter((l) => /is not loaded/i.test(l))).toEqual([]);
    });

    test('1. the Plan and the document print the SAME Delivered figure', () => {
        const bad = [];
        ['N', 'P', 'K'].forEach((n) => {
            const p = (planSummary[n] || {}).delivered;
            const d = (docxAnr[n] || {}).delivered;
            if (p == null || d == null) { bad.push({ nutrient: n, plan: p, document: d, why: 'missing' }); return; }
            if (Math.abs(p - d) > 0.05) bad.push({ nutrient: n, plan: p, document: d, diff: +(p - d).toFixed(3) });
        });
        expect(bad).toEqual([]);
    });

    test('1b. and therefore the same verdict — Balance and Status agree too', () => {
        // The figure is what the ticket is about; the verdict is what a reader
        // acts on. Before GH-399 the SLAN site's phosphorus was "-7%" on the
        // Plan and "-5%" in the document off the same programme.
        const bad = [];
        ['N', 'P', 'K'].forEach((n) => {
            const p = planSummary[n] || {}, d = docxAnr[n] || {};
            if (p.balance != null && d.balance != null && Math.abs(p.balance - d.balance) > 0.05) {
                bad.push({ nutrient: n, what: 'balance', plan: p.balance, document: d.balance });
            }
            if (p.status && d.status && p.status.toLowerCase() !== d.status.toLowerCase()) {
                bad.push({ nutrient: n, what: 'status', plan: p.status, document: d.status });
            }
        });
        expect(bad).toEqual([]);
    });

    test('2. the document agrees with itself: its product rows sum to its own ANR Delivered', () => {
        // Amendment rows are not programme delivery, so compare only rows the
        // Plan page also lists — the Plan renders the catalogue programme.
        const planNames = new Set(planProducts.rows.map((r) => r.name));
        const rows = docxProducts.filter((r) => planNames.has(r.name));
        expect(rows.length).toBeGreaterThan(0);
        const tol = 0.5 * rows.length + 0.5;   // each row prints at a whole kg
        const bad = [];
        ['N', 'P', 'K'].forEach((n) => {
            const sum = rows.reduce((s, r) => s + (r[n] || 0), 0);
            const anr = (docxAnr[n] || {}).delivered;
            if (anr == null) return;
            if (Math.abs(sum - anr) > tol) bad.push({ nutrient: n, rows: sum, anrDelivered: anr, tolerance: tol });
        });
        expect(bad).toEqual([]);
    });

    test('3. the Plan agrees with itself: its Delivered column vs its own "Total Delivered" footer', () => {
        const f = planProducts.footer.delivered;
        expect(f).toBeDefined();
        const bad = [];
        ['N', 'P', 'K'].forEach((n) => {
            const col = (planSummary[n] || {}).delivered;
            if (col == null || f[n] == null) return;
            // The footer prints whole kg from a figure already rounded to 1 dp
            // — the double-rounding step deliberately left to GH-401 — so a
            // whole kg of slack is what this can assert today.
            if (Math.abs(col - f[n]) > 1) bad.push({ nutrient: n, column: col, footer: f[n] });
        });
        expect(bad).toEqual([]);
    });

    test('4. per-product phosphorus is the same on both surfaces', () => {
        // The retired export row helper topped a zero P up from
        // `analysis x mass`, so an Australian liquid carried phosphorus in the
        // document's table and none in the Plan's.
        const byName = {};
        docxProducts.forEach((r) => { (byName[r.name] = byName[r.name] || []).push(r); });
        const bad = [];
        planProducts.rows.forEach((pr) => {
            const candidates = byName[pr.name];
            if (!candidates || !candidates.length) return;   // amendment-only rows
            const dr = candidates.shift();
            ['N', 'P', 'K'].forEach((n) => {
                if (pr[n] == null || dr[n] == null) return;
                if (Math.abs(pr[n] - dr[n]) > 1) bad.push({ product: pr.name, nutrient: n, plan: pr[n], document: dr[n] });
            });
        });
        expect(bad).toEqual([]);
    });
});

}

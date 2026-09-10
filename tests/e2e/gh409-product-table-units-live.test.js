/**
 * GH-409 live check — the document's product tables against the screen they
 * came from, read off both surfaces.
 *
 * Two reports from the product owner, both of the same shape: the .docx did not
 * match the Plan page.
 *
 *   COLUMNS — the Annual Product Summary rendered "N | P | K | Mg | S" on one
 *   site, and a different set on the next, because the column list was decided
 *   from whichever products the recommender happened to pick. The Plan page has
 *   only ever had N, P and K.
 *
 *   UNITS — on a golf greens site the Plan's "Total Rate" column reads 40 g/m²,
 *   90 L/ha, 61.6 g/m², 2 g/m², 90 L/ha, and the document printed 400, 616 and
 *   20 under a header saying "Total kg/ha". Same quantities, ten times the
 *   figure, on every fine-turf site. The Fertiliser Purchasing Summary had it
 *   too.
 *
 * WHY THIS FILE EXISTS RATHER THAN A SOURCE PIN. tests/gh409-product-table-units.test.js
 * pins the rule offline, against the real persisted programmes. This one proves
 * the rule reaches the page and the paper: it drives a real browser, generates a
 * real document, and compares the PAINTED Plan cells with the cells of
 * word/document.xml, string for string. The rate column is not asserted against
 * a number this file carries — it is asserted against whatever the Plan printed
 * on the day, which is the actual claim.
 *
 * THE SITES. Both golf greens, both reported by the owner, both New Zealand.
 * The Australian half of the same check — where a soluble powder used to be the
 * one row printed in kilograms in a table of g/m² rows — is on Federal Golf in
 * tests/e2e/gh401-delivery-volumes-live.test.js, which now expects "6 g/m²"
 * there. The unit is a property of the surface, so the region is not part of
 * the rule and neither file asserts one.
 *
 * ALSO READ, AND NOT YET ASSERTED: the Monthly Schedule's granular cell, which
 * prints the same rate per application. The Plan says "@ 20.0g/m²" where the
 * document says "@ 200 kg/ha" — the same divergence, one table lower, in a
 * table nobody has reported yet and whose liquid column carries a second
 * question (the Plan prints a soluble there in kg/ha even on greens, disagreeing
 * with its own product table). Both surfaces' cells are printed on every run so
 * that whoever takes that decision has the evidence in front of them.
 *
 *   Test - GC - NZ - delivery / 18th Green — Creeping Bentgrass, Christchurch.
 *   Test - GC - NZ - warm season grass test / Main Oval — the same shape, Couch.
 *     (The owner referred to this site as "Test - GC - NZ"; that is the only
 *      site of that name on the development database.)
 *
 * Run: npm run test:e2e:units
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
        key: 'nz-delivery',
        siteId: '01a08b0b-4d6a-736d-a184-2fa1e04394b6',
        siteName: 'Test - GC - NZ - delivery',
        sampleLabel: '18th Green'
    },
    {
        key: 'nz-warm',
        siteId: '01a08ae6-8a43-7004-99a6-8cddfc69b9cb',
        siteName: 'Test - GC - NZ - warm season grass test',
        sampleLabel: 'Main Oval'
    }
];

const ONLY = process.env.GILBA_E2E_SITE;
const RUN = ONLY ? SITES.filter((s) => s.key === ONLY) : SITES;

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

/** The Plan's Annual Product Summary: its header, its rows' printed rates, and
 *  the nutrient columns it offers. */
/* istanbul ignore next — evaluated in the page, not in node */
function readPlanProductTableInPage() {
    const out = { header: null, rows: [] };
    const tables = Array.from(document.querySelectorAll('#plan-nut-results table'));
    for (const table of tables) {
        const rowCells = Array.from(table.querySelectorAll('tr')).map((tr) =>
            Array.from(tr.querySelectorAll('th,td')).map((c) => c.textContent.trim()));
        const headerRow = rowCells.find((cells) => /^Product$/i.test(cells[0] || ''));
        if (!headerRow) continue;
        out.header = headerRow;
        Array.from(table.querySelectorAll('tbody tr')).forEach((tr) => {
            const cells = Array.from(tr.querySelectorAll('th,td'));
            if (cells.length < 6) return;
            const first = cells[0];
            const label = (((first.querySelector('strong') || first).textContent) || '')
                .replace(/\s*Analysis:.*$/, '').trim();
            if (!label || /^(Product|Total Delivered|Required|Balance)/i.test(label)) return;
            out.rows.push({
                name: label,
                applicationsText: (cells[1].textContent || '').trim(),
                rateText: (cells[2].textContent || '').trim().replace(/\s+/g, ' ')
            });
        });
        if (out.rows.length) return out;
    }
    return out;
}

/** The Plan's Monthly Schedule: the granular cell of each month, which prints a
 *  per-application rate in the same unit the product table's rows use. */
/* istanbul ignore next — evaluated in the page, not in node */
function readPlanMonthlyInPage() {
    const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
    const out = [];
    document.querySelectorAll('#plan-nut-results table tbody tr').forEach((tr) => {
        // The page keeps the standalone Prebble panel in the DOM with its own
        // copy of this table and hides it; only the visible one is the screen.
        if (tr.offsetParent === null) return;
        const cells = tr.querySelectorAll('td');
        if (cells.length < 6) return;
        const first = (cells[0].textContent || '').trim();
        if (!MONTHS.some((m) => first.indexOf(m) === 0)) return;
        const granular = (cells[3].textContent || '').trim().replace(/\s+/g, ' ');
        // The requirement table shares this shape; the schedule's granular cell
        // names a product and a rate, so an all-numeric cell is the other table.
        if (!/@/.test(granular) && !/^—|^-$/.test(granular)) return;
        out.push({
            month: first,
            granular: granular,
            liquid: (cells[4].textContent || '').trim().replace(/\s+/g, ' ')
        });
    });
    return out;
}

if (!ENABLED) {
    process.stdout.write('[e2e] gh409-product-table-units-live skipped (needs the live stack) — npm run test:e2e:units\n');
    test.skip('GH-409 live column/unit check (disabled)', () => {});
} else {

RUN.forEach((site) => {
describe('GH-409 live — ' + site.siteName, () => {
    let browser, page, previousActiveSiteId = null;
    let planTable = null, planMonthly = null;
    let docxHeader = null, docxRows = null, docxTotalRow = null, docxMonthly = null;
    let purchasing = null;
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
            if (/is not loaded|GH-409|no surface type/i.test(t)) consoleLines.push(m.type() + ': ' + t);
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
            window.__gh409Generated = 0;
            document.addEventListener('gaip:nutrition-calendar-generated', () => { window.__gh409Generated++; });
        });
        await page.click('#plan-nut-generate-btn');
        await page.waitForFunction(() => {
            const el = document.querySelector('#plan-nut-results');
            if (!(window.__gh409Generated > 0 && el && el.style.display !== 'none')) return false;
            return /Annual Product Summary/i.test(el.innerText || '');
        }, null, { timeout: 90000 });
        await page.waitForTimeout(2000);

        planTable = await page.evaluate(readPlanProductTableInPage);
        planMonthly = await page.evaluate(readPlanMonthlyInPage);

        // ── Word export, that one sample ────────────────────────────────────
        await page.goto(BASE_URL + '/reports/export', { waitUntil: 'domcontentloaded' });
        await page.waitForFunction(() => !!(window.GilbaNutritionCalendar && window.NutritionRequirementEngine_Pure &&
            (window.PrebbleRecommender || window.AuFertiliserRecommender) && window.GAIP_SampleManager),
            null, { timeout: 30000 });
        // The same settle gh401's harness waits for: the page has to have
        // resolved this site's annual N before the export can recompute anything
        // per sample.
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
        const pick = await page.evaluate(({ id, label }) => {
            const boxes = Array.from(document.querySelectorAll('input[data-sample-uid]'));
            const rowText = (c) => (((c.closest('label') || c.parentElement) || {}).textContent || '').trim().replace(/\s+/g, ' ');
            const available = boxes.map((c) => ({ uid: c.getAttribute('data-sample-uid'), text: rowText(c) }));
            const mine = boxes.filter((c) => String(c.getAttribute('data-sample-uid') || '').indexOf(id) === 0);
            let cb = label ? mine.find((c) => rowText(c).indexOf(label) >= 0) : null;
            if (!cb && mine.length === 1) cb = mine[0];
            if (!cb) return { found: false, available };
            cb.checked = true;
            cb.dispatchEvent(new Event('change', { bubbles: true }));
            return { found: true, uid: cb.getAttribute('data-sample-uid'), text: rowText(cb),
                     checked: document.querySelectorAll('input[data-sample-uid]:checked').length };
        }, { id: site.siteId, label: site.resolvedSampleLabel });
        if (!pick.found) throw new Error('no sample checkbox for ' + site.siteName + ' in the export picker: ' + JSON.stringify(pick));
        site.exportedUid = pick.uid;
        if (pick.checked !== 1) throw new Error('expected exactly one ticked sample, got ' + pick.checked);

        const [download] = await Promise.all([
            page.waitForEvent('download', { timeout: 180000 }),
            page.locator('button:has-text("Generate & Download")').last().click()
        ]);
        const docxPath = path.join(os.tmpdir(), 'gilba-gh409-' + site.key + '-' + Date.now() + '.docx');
        await download.saveAs(docxPath);
        const xml = execFileSync('unzip', ['-p', docxPath, 'word/document.xml'],
            { maxBuffer: 64 * 1024 * 1024 }).toString();
        const tables = docxTables(xml);

        const prodT = findTable(tables, ['Product', 'Applications', 'Total Rate', 'N']);
        docxRows = [];
        docxTotalRow = null;
        if (prodT) {
            docxHeader = prodT[0].map((h) => String(h).trim());
            prodT.slice(1).forEach((r) => {
                const row = { name: String(r[0]).trim(), applicationsText: String(r[1]).trim(),
                              rateText: String(r[2]).trim().replace(/\s+/g, ' ') };
                if (!row.name) return;
                if (/^Total Delivered$/i.test(row.name)) { docxTotalRow = row; return; }
                docxRows.push(row);
            });
        }

        // The Monthly Schedule's granular cell — the same rate, per application,
        // in the table directly below the product summary.
        const monthT = findTable(tables, ['Month', 'GP%', 'Granular Products']);
        docxMonthly = monthT ? monthT.slice(1).map((r) => ({
            month: String(r[0]).trim(),
            granular: String(r[2]).trim().replace(/\s+/g, ' '),
            liquid: String(r[3] || '').trim().replace(/\s+/g, ' ')
        })) : [];

        // The Fertiliser Purchasing Summary — same defect, its own table. Its
        // rate column is "Rate avg" when the samples carry an area and "Total
        // rate" when they do not; both are read.
        const purchT = findTable(tables, ['Product', 'Total', 'Rate avg']) ||
                       findTable(tables, ['Product', 'Total rate', 'Samples']);
        if (purchT) {
            const hdr = purchT[0].map((h) => String(h).trim());
            const rateCol = hdr.indexOf('Rate avg') >= 0 ? hdr.indexOf('Rate avg') : hdr.indexOf('Total rate');
            purchasing = {
                header: hdr,
                rows: purchT.slice(1).map((r) => ({
                    name: String(r[0]).trim(),
                    rateText: String(r[rateCol]).trim().replace(/\s+/g, ' ')
                })).filter((r) => r.name)
            };
        }

        if (process.env.GILBA_E2E_KEEP === '1') process.stdout.write('[gh409] kept ' + docxPath + '\n');
        else { try { fs.unlinkSync(docxPath); } catch (e) { /* best effort */ } }

        const line = (s) => process.stdout.write('[gh409] ' + s + '\n');
        line(site.siteName + ' / ' + site.resolvedSampleLabel);
        line('  Plan header:     ' + JSON.stringify(planTable.header));
        line('  Document header: ' + JSON.stringify(docxHeader));
        line('  Plan Annual Product Summary (product / applications / total rate):');
        planTable.rows.forEach((r) => line('      ' + r.name + '  |  ' + r.applicationsText + '  |  ' + r.rateText));
        line('  Document Annual Product Summary:');
        docxRows.forEach((r) => line('      ' + r.name + '  |  ' + r.applicationsText + '  |  ' + r.rateText));
        line('    Total Delivered row rate: ' + (docxTotalRow ? docxTotalRow.rateText : '(MISSING)'));
        line('  Monthly Schedule, granular cell — plan / document:');
        planMonthly.forEach((pm, i) => {
            const dm = (docxMonthly || [])[i] || {};
            if (!pm.granular || pm.granular === '—') return;
            line('      ' + pm.month + '   plan "' + pm.granular + '"   document "' + (dm.granular || '') + '"');
        });
        line('  Fertiliser Purchasing Summary: ' + (purchasing
            ? JSON.stringify(purchasing.header) + ' ' +
              purchasing.rows.map((r) => r.name + ' = ' + r.rateText).join('; ')
            : '(not in this document)'));
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

    test('both surfaces rendered the table this file reads', () => {
        expect(planTable && planTable.rows.length).toBeGreaterThan(0);
        expect(docxRows && docxRows.length).toBeGreaterThan(0);
        expect(consoleLines.filter((l) => /is not loaded|no surface type/i.test(l))).toEqual([]);
    });

    test('defect 1 — the document prints the Plan\'s columns: N, P, K and nothing else', () => {
        expect(planTable.header.slice(0, 6)).toEqual(['Product', 'Applications', 'Total Rate', 'N', 'P', 'K']);
        expect(docxHeader).toEqual(['Product', 'Applications', 'Total Rate', 'N', 'P', 'K']);
        // Said again the other way round, because "N | P | K | Mg | S" is what
        // was actually reported.
        expect(docxHeader.filter((h) => ['Ca', 'Mg', 'S'].includes(h))).toEqual([]);
    });

    test('defect 2 — every rate cell is the same string on both surfaces', () => {
        // Matched by position: the document renders the catalogue programme in
        // the Plan's own order and appends any soil amendments after it, and the
        // two surfaces label the same product slightly differently (the NZ panel
        // adds a release tag to the name).
        const bad = [];
        planTable.rows.forEach((pr, i) => {
            const dr = docxRows[i];
            if (!dr) { bad.push({ row: i, plan: pr.name, why: 'no matching document row' }); return; }
            if (pr.rateText !== dr.rateText) {
                bad.push({ row: i, plan: pr.name + ' = ' + pr.rateText, document: dr.name + ' = ' + dr.rateText });
            }
            if (pr.applicationsText !== dr.applicationsText) {
                bad.push({ row: i, what: 'applications', plan: pr.applicationsText, document: dr.applicationsText });
            }
        });
        expect(bad).toEqual([]);
    });

    test('defect 2 — this is a greens site, so no mass rate is printed in kg/ha', () => {
        // The reported symptom, stated directly: "400 kg/ha" where the screen
        // said "40 g/m²". Every row on these two sites is either a spray volume
        // or a fine-turf mass rate; a bare kg/ha row would be the defect back.
        const planUnits = planTable.rows.map((r) => r.rateText.replace(/[0-9.\s]/g, ''));
        const docUnits = docxRows.map((r) => r.rateText.replace(/[0-9.\s]/g, ''));
        expect(planUnits.every((u) => u === 'g/m²' || u === 'L/ha')).toBe(true);
        expect(docUnits).toEqual(planUnits);
    });

    test('the total row states its litres apart from its kilograms', () => {
        expect(docxTotalRow).not.toBeNull();
        // A greens site's mass total is in g/m², and any spray volume follows a
        // "+" rather than being added into it.
        expect(docxTotalRow.rateText).toMatch(/g\/m²|L\/ha/);
        if (/\+/.test(docxTotalRow.rateText)) {
            expect(docxTotalRow.rateText).toMatch(/g\/m².*\+.*L\/ha/);
        }
    });

    test('the Fertiliser Purchasing Summary follows the same rule', () => {
        if (!purchasing) {
            // Not every export contains one (it needs a fresh sample and a
            // programme). Say so rather than passing silently.
            process.stdout.write('[gh409] no Fertiliser Purchasing Summary in this document — nothing to check\n');
            return;
        }
        const planByName = {};
        planTable.rows.forEach((r) => { planByName[r.name] = r.rateText; });
        const bad = [];
        purchasing.rows.forEach((r) => {
            const unit = r.rateText.replace(/[0-9.\s]/g, '');
            if (unit !== 'g/m²' && unit !== 'L/ha') {
                bad.push({ product: r.name, rate: r.rateText, why: 'a greens site\'s rate is g/m² or L/ha' });
            }
        });
        expect(bad).toEqual([]);
    });
});
});

}

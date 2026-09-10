/**
 * GH-400 live check — the phosphorus Australian liquid applications carry is
 * counted, on the screen and in the document.
 *
 * Every figure this file asserts is READ BACK from something a user would look
 * at: the Plan page's rendered "Nutrient Delivery Summary" and "Annual Product
 * Summary" out of the painted DOM, and the generated .docx's "Annual Nutrient
 * Requirements" and "Annual Product Summary" out of word/document.xml. Nothing
 * here recomputes the programme; tests/gh400-au-liquid-phosphorus.test.js does
 * that offline, and this file exists to show that what the offline pins say is
 * what the two surfaces actually print.
 *
 * Four Australian sites, chosen for what each one proves:
 *
 *   New test - location / Putter Green — golf greens, SLAN. The site the defect
 *     was found on. Greenmaster Liquid Spring & Summer (1.7% P) and Long Paddock
 *     Rapid Uptake (2% P) declared no phosphorus at all. Delivered P moves
 *     14.0 -> 18.7 and the product set changes.
 *   Westview / Backyard — lawns, MLSN, liquid-heavy. The largest selection move.
 *   Burns / 12th Fairway and Federal Golf / Green 1 — the controls. Their
 *     liquid columns are Ammonium Sulphate Tech (21-0-0) and Urea Tech (46-0-0),
 *     so there is no liquid phosphorus to count and NOTHING may move.
 *
 * Regenerating each site's programme through the Plan page is part of the check:
 * the persisted programme has to be rewritten by the fixed recommender before
 * the export can read it.
 *
 * Run: npm run test:e2e:phosphorus
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

/**
 * Expected Delivered N/P/K, per site, at 1 dp — the same figures the offline
 * suite pins, here to be compared against rendered cells rather than derived.
 * `movesOnGh400` records whether GH-400 was expected to change this site at all.
 */
const SITES = [
    {
        key: 'new-test-location',
        siteId: '01a00d5b-c67a-7281-8f0f-2d8de6676a0f',
        siteName: 'New test - location',
        sampleClientId: 'Soil_1_3cbn',
        sampleLabel: 'Putter Green',
        movesOnGh400: true,
        expected: { N: 137.6, P: 18.7, K: 104.5 },
        // Phosphorus-bearing sprays that used to declare a flat zero.
        liquidsWithP: ['Greenmaster Liquid Spring & Summer', 'Long Paddock Rapid Uptake'],
        // Granular picks GH-400 stopped buying, because the sprays already
        // covered the phosphorus they were bought for.
        droppedProducts: ['Country Club IV 17-0-17', 'MAP Tech'],
    },
    {
        key: 'westview',
        siteId: '019f7d28-50ed-71e2-b817-c252b0160460',
        siteName: 'Westview',
        sampleClientId: null,          // resolved from the picker by label
        sampleLabel: 'Backyard',
        movesOnGh400: true,
        expected: { N: 224.8, P: 21.4, K: 154.1 },
        liquidsWithP: ['Greenmaster Liquid Spring & Summer'],
        droppedProducts: ['TPG Ratio', 'MAP Tech (soluble)'],
    },
    {
        key: 'burns',
        siteId: '019e96d8-97b7-714c-9bd6-d65b16ec7f2e',
        siteName: 'Burns',
        sampleClientId: 'Soil_25_zo0t',
        sampleLabel: '12th Fairway',   // the parity fixture's sample
        movesOnGh400: false,
        expected: { N: 125.5, P: 12.3, K: 0 },
        liquidsWithP: [],
        droppedProducts: [],
    },
    {
        key: 'federal-golf',
        siteId: '019e96d7-36aa-707a-9879-68ab28726e12',
        siteName: 'Federal Golf',
        sampleClientId: 'Green 1',
        sampleLabel: 'Green 1',
        movesOnGh400: false,
        expected: { N: 135.1, P: 13.2, K: 73.4 },
        liquidsWithP: [],
        droppedProducts: [],
    },
];

const ONLY = process.env.GILBA_E2E_SITE;
const RUN = ONLY ? SITES.filter((s) => s.key === ONLY) : SITES;

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

if (!ENABLED) {
    process.stdout.write('[e2e] gh400-au-liquid-phosphorus-live skipped (needs the live stack) — npm run test:e2e:phosphorus\n');
    test.skip('GH-400 live phosphorus check (disabled)', () => {});
} else {

RUN.forEach((site) => {
describe('GH-400 live — ' + site.siteName, () => {
    let browser, page, previousActiveSiteId = null;
    let planSummary = null, planProducts = null;
    let docxAnr = null, docxProducts = null;
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
            if (/is not loaded|\[NutritionDelivery\]/i.test(t)) consoleLines.push(m.type() + ': ' + t);
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

        // ── Plan page: regenerate and read the rendered tables ──────────────
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
            window.__gh400Generated = 0;
            document.addEventListener('gaip:nutrition-calendar-generated', () => { window.__gh400Generated++; });
        });
        await page.click('#plan-nut-generate-btn');
        await page.waitForFunction(() => {
            const el = document.querySelector('#plan-nut-results');
            if (!(window.__gh400Generated > 0 && el && el.style.display !== 'none')) return false;
            return /Nutrient Delivery Summary/i.test(el.innerText || '');
        }, null, { timeout: 90000 });
        await page.waitForTimeout(2000);

        const planText = await page.evaluate(() => (document.querySelector('#plan-nut-results') || document.body).innerText);
        planSummary = planDeliverySummary(planText);
        planProducts = await page.evaluate(readPlanProductTableInPage);

        // The programme object the page just generated, for the 1 dp liquid
        // phosphorus figures the whole-kg tables round away.
        programLiquids = await page.evaluate(() => {
            const prog = window.GAIP_NUTRITION_PROGRAM;
            if (!prog || !prog.monthly) return null;
            const out = [];
            prog.monthly.forEach((m) => (m.liquid || []).forEach((p) => out.push({
                month: m.month_name, name: p.name, rateLHa: p.rateLHa,
                applications: p.applications, analysisP: (p.analysis || {}).P || 0,
                deliversP: (p.delivers || {}).P
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
        // Never fall back to "the first checkbox": the picker lists samples
        // from every site, so a missed match silently exports a different
        // site's programme and every figure below is then someone else's.
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
        const docxPath = path.join(os.tmpdir(), 'gilba-gh400-' + site.key + '-' + Date.now() + '.docx');
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
                    required: num(r[4]),
                    delivered: String(r[5]).trim() === '—' ? null : num(r[5]),
                    balance: String(r[7]).trim() === '—' ? null : num(r[7]),
                    status: String(r[8]).trim()
                };
            });
        }

        hasAnr = Object.keys(docxAnr).length === 3;

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

        if (process.env.GILBA_E2E_KEEP === '1') process.stdout.write('[gh400] kept ' + docxPath + '\n');
        else { try { fs.unlinkSync(docxPath); } catch (e) { /* best effort */ } }

        const line = (s) => process.stdout.write('[gh400] ' + s + '\n');
        line(site.siteName + ' / ' + site.resolvedSampleLabel + (site.movesOnGh400 ? '' : '  (control — must not move)'));
        line('  exported sample: ' + site.exportedUid + '  "' + site.exportedRowText + '"');
        line('  Delivered — Plan vs document' + (hasAnr ? '' :
            '   (this sample carries no soil analysis, so the document has no Annual Nutrient Requirements section)'));
        ['N', 'P', 'K'].forEach((n) => {
            const p = planSummary[n] || {}, d = docxAnr[n] || {};
            line('    ' + n + ':  plan ' + p.delivered + ' (' + p.status + ')   document ' + d.delivered +
                 ' (' + d.status + ')   required plan ' + p.required + ' / document ' + d.required +
                 '   expected ' + site.expected[n]);
        });
        line('  Plan "Total Delivered" footer: ' + JSON.stringify(planProducts.footer.delivered));
        line('  Liquid applications, phosphorus at 1 dp (rate x applications x analysis.P):');
        (programLiquids || []).forEach((l) => line('    ' + l.month + '  ' + l.name + '  ' + l.rateLHa +
            ' x' + l.applications + '  analysis.P ' + l.analysisP + '%  ->  delivers.P ' + l.deliversP));
        line('  Annual Product Summary rows (N / P / K):');
        line('    plan:');
        planProducts.rows.forEach((r) => line('      ' + r.name + '  ' + r.N + ' / ' + r.P + ' / ' + r.K));
        line('    document:');
        docxProducts.forEach((r) => line('      ' + r.name + '  ' + r.N + ' / ' + r.P + ' / ' + r.K));
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
        expect(docxProducts.length).toBeGreaterThan(0);
        expect(consoleLines.filter((l) => /is not loaded/i.test(l))).toEqual([]);
    });

    test('the rendered Delivered figures are the ones GH-400 pins offline', () => {
        const bad = [];
        ['N', 'P', 'K'].forEach((n) => {
            const p = (planSummary[n] || {}).delivered;
            if (Math.abs(p - site.expected[n]) > 0.05) bad.push({ nutrient: n, surface: 'plan', got: p, want: site.expected[n] });
            // A sample with no soil analysis (Westview carries a pH and
            // nothing else) gets no Annual Nutrient Requirements section in
            // the document at all — its Annual Product Summary is then the
            // only rendered delivery figure the document has, and the row-by-
            // row test below is what covers it.
            if (!hasAnr) return;
            const d = (docxAnr[n] || {}).delivered;
            if (Math.abs(d - site.expected[n]) > 0.05) bad.push({ nutrient: n, surface: 'document', got: d, want: site.expected[n] });
        });
        expect(bad).toEqual([]);
    });

    test('the Plan and the document print the same Annual Product Summary rows', () => {
        // Available on every site, soil data or not, and the table the client
        // orders fertiliser from. Amendment rows exist only in the document.
        const planNames = new Set(planProducts.rows.map((r) => r.name));
        const docRows = docxProducts.filter((r) => planNames.has(r.name));
        expect(docRows.map((r) => r.name).sort()).toEqual(planProducts.rows.map((r) => r.name).sort());
        const bad = [];
        planProducts.rows.forEach((pr) => {
            const dr = docRows.find((r) => r.name === pr.name);
            ['N', 'P', 'K'].forEach((n) => {
                if (pr[n] !== dr[n]) bad.push({ product: pr.name, nutrient: n, plan: pr[n], document: dr[n] });
            });
        });
        expect(bad).toEqual([]);
    });

    test('every liquid application declares the phosphorus its analysis carries', () => {
        // The declaration half, read off the programme the page generated —
        // not off a recomputation. A spray whose analysis has phosphorus and
        // whose delivers.P is 0 is the exact defect GH-400 fixed.
        expect(Array.isArray(programLiquids)).toBe(true);
        const wrong = (programLiquids || []).filter((l) => {
            const want = Math.round((l.rateLHa || 0) * (l.applications || 1) * (l.analysisP || 0) / 100 * 10) / 10;
            return l.deliversP !== want;
        });
        expect(wrong).toEqual([]);
    });

    if (site.liquidsWithP.length) {
        test('the phosphorus-bearing sprays no longer declare zero', () => {
            const bad = [];
            site.liquidsWithP.forEach((name) => {
                const hits = (programLiquids || []).filter((l) => l.name === name);
                if (!hits.length) { bad.push({ name, why: 'not in the programme' }); return; }
                hits.forEach((h) => {
                    if (!(h.analysisP > 0)) bad.push({ name, why: 'analysis has no P', analysisP: h.analysisP });
                    if (!(h.deliversP > 0)) bad.push({ name, why: 'still declares zero', deliversP: h.deliversP });
                });
            });
            expect(bad).toEqual([]);
        });
    }

    if (site.droppedProducts.length) {
        test('the granular picks the sprays made unnecessary are gone from both surfaces', () => {
            const planNames = planProducts.rows.map((r) => r.name);
            const docNames = docxProducts.map((r) => r.name);
            site.droppedProducts.forEach((name) => {
                expect({ surface: 'plan', name, present: planNames.includes(name) })
                    .toEqual({ surface: 'plan', name, present: false });
                expect({ surface: 'document', name, present: docNames.includes(name) })
                    .toEqual({ surface: 'document', name, present: false });
            });
        });
    }

    test('the Plan and the document still print the same Delivered figure and verdict', () => {
        // GH-399's invariant, re-checked because GH-400 moved the number both
        // surfaces read: a change that moved only one of them would be a
        // regression of the previous ticket.
        if (!hasAnr) { expect(docxProducts.length).toBeGreaterThan(0); return; }
        const bad = [];
        ['N', 'P', 'K'].forEach((n) => {
            const p = planSummary[n] || {}, d = docxAnr[n] || {};
            if (p.delivered == null || d.delivered == null) { bad.push({ nutrient: n, why: 'missing' }); return; }
            if (Math.abs(p.delivered - d.delivered) > 0.05) bad.push({ nutrient: n, plan: p.delivered, document: d.delivered });
            if (p.status && d.status && p.status.toLowerCase() !== d.status.toLowerCase()) {
                bad.push({ nutrient: n, what: 'status', plan: p.status, document: d.status });
            }
        });
        expect(bad).toEqual([]);
    });
});
});

}

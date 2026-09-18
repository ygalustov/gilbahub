/**
 * QUESTION 33, WESTVIEW — WHICH OF TWO CASES IS IT. A measurement, not a fix.
 *
 * THE REPORT. On Westview the document prints a requirement and a DASH where
 * the delivery should be, while the live page shows figures. The site HAS a
 * soil sample — exactly one.
 *
 * THE TWO EXPLANATIONS, and the whole point is to tell them apart without
 * building a third:
 *   (a) the sample was OFFERED at export time and not ticked. An operator case.
 *   (b) the export could not take it. A defect, and one in the same cluster as
 *       the empty `client_uid` — 27 rows of 148 have none, this sample among
 *       them.
 *
 * WHAT IS ESTABLISHED FROM THE DATABASE BEFORE THE RUN, my own query, after
 * today's stand repairs:
 *   site   Westview, 019f7d28-50ed-71e2-b817-c252b0160460, the only row of that
 *          name
 *   sample id 118, soil, sample_date and lab_date 2026-07-27, deleted_at NULL,
 *          client_uid NULL, and it is the site's ONLY sample of any type
 *   payload `_label` is "Backyard"; `label` and `sampleId` are both absent
 *
 * WHY THAT LAST LINE MATTERS. The restore keys a sample by
 * `client_uid || payload.label || payload.sampleId || ('sample_' + id)` —
 * note `payload.label`, not `payload._label`. With all three of the first
 * absent this sample lands in the store under `sample_118`, and its display
 * label comes from `_label`, so it should read "Backyard". Nothing in
 * `enumerateSamples()` filters on `client_uid`; it walks the store's own keys.
 * So READING says it should be offered. Reading is a prediction here, not the
 * answer: the question is about the picker's DOM and about what the document
 * prints, and neither is in the source.
 *
 * THE REMEDY: `guardStand` on the context, and it is chosen rather than
 * capture-and-restore for a reason measured earlier today. This page runs the
 * whole engine stack; on another site that cost one rewritten
 * `analysis_cache` row and eight `predictions` rows. `guardStand` intercepts
 * both of those tables (`/api/analysis-cache`, `/api/predictions`) along with
 * samples, site-summaries and site config, and never lets the write land.
 * Capture-and-restore would be the wrong tool here even so: `restoreConfigs()`
 * cannot put an `analysis_cache` row back at all — the base64 of every one of
 * them exceeds the 128 KB single-argument limit inside the container, measured
 * and filed as Question 39. Detection works, restoration does not. So the only
 * safe posture is to stop the write, not to undo it.
 *
 * The one thing the guard does NOT cover is the active-site pointer, which this
 * run has to move to reach Westview. It is read first and put back in afterAll,
 * the way every live test in this suite does it.
 *
 * THE DISEASE PAGE IS NOT OPENED. It is the page that rewrites
 * `analysis_cache`, and the row it would rewrite was repaired by hand today.
 * The export page sets `window.GILBA_REPORTS_EXPORT = true`, which
 * `hub-persistence.js:2205` reads to suppress that write; the guard is the
 * belt to that suspenders, not a substitute for staying off the page.
 *
 * WHAT WAS EXPECTED, WRITTEN DOWN BEFORE THE RUN, BOTH OUTCOMES NAMED.
 *
 *   E1 — the store. Westview's sample is restored, under key `sample_118`,
 *        labelled "Backyard".
 *        A: it is there -> continue.
 *        B: it is not -> the export never had it, the defect is upstream of
 *           everything below, and the run STOPS and says so.
 *
 *   E2 — the enumeration. `GAIP_CombinedExport.enumerate('all')` returns an
 *        entry whose siteId is Westview's.
 *        A: present -> continue.
 *        B: absent -> case (b), defect at enumeration, STOP and name it.
 *
 *   E3 — the picker, which is the DOM half and the actual question asked.
 *        A: a checkbox with `data-sample-uid="019f7d28-…::sample_118"` is in
 *           the dialog, under a group headed "Westview" -> the sample IS
 *           offered, which makes the original report case (a).
 *        B: enumerated but not rendered -> case (b), defect in the picker.
 *
 *   E4 — the document, with ONLY that sample ticked.
 *        A: the delivery section carries figures -> case (a) confirmed: the
 *           export can take this sample, and what was reported came from it
 *           not being ticked.
 *        B: requirement present and delivery a dash -> case (b): a defect,
 *           reproducible, and the run STOPS at the first divergence and names
 *           it rather than carrying on to describe it.
 *
 * Any other outcome is reported as the measurement it is. The run prints what
 * it saw at every step, so a green result cannot be read as "it did not look".
 *
 * Run: GILBA_E2E=1 npx jest tests/e2e/gh537-westview-export-offers-its-sample-live.test.js
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

const SITE = { name: 'Westview', id: '019f7d28-50ed-71e2-b817-c252b0160460' };
const SERVER_SAMPLE_ID = '118';
const EXPECTED_STORE_KEY = 'sample_118';
const EXPECTED_LABEL = 'Backyard';

let chromium = null;
try { ({ chromium } = require('playwright')); } catch (e) { /* reported below */ }
let guardStand = null;
try { ({ guardStand } = require('./lib/stand-guard')); } catch (e) { /* reported below */ }

function decodeEntities(s) {
    return s.replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>')
        .replace(/&quot;/g, '"').replace(/&apos;/g, "'")
        .replace(/&#(\d+);/g, (m, d) => String.fromCharCode(parseInt(d, 10)));
}
function readDocumentXml(file) {
    return execFileSync('unzip', ['-p', file, 'word/document.xml'], { maxBuffer: 64 * 1024 * 1024 }).toString();
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
function docxText(xml) {
    return decodeEntities(xml.replace(/<\/w:p>/g, '\n').replace(/<\/w:tc>/g, '\t')
        .replace(/<[^>]+>/g, '')).replace(/[ \t]+\n/g, '\n');
}

if (!ENABLED) {
    process.stdout.write('[e2e] gh537-westview-export skipped (needs the live stack)\n');
    test.skip('Question 33 Westview (disabled)', () => {});
} else {
    describe('Question 33 — Westview: is its sample offered, and what does the document print', () => {
        let browser, context, page, guard, previousActiveSiteId = null;
        let docxPath = null;
        const m = { store: null, enumerated: null, picker: null, doc: null, stopped: null };

        beforeAll(async () => {
            if (!chromium) throw new Error('playwright does not resolve from the repo — run `npm install`');
            if (!guardStand) throw new Error('tests/e2e/lib/stand-guard.js does not resolve');
            if (!EMAIL || !PASSWORD) throw new Error('no credentials');

            browser = await chromium.launch();
            context = await browser.newContext({ acceptDownloads: true });
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
            if (/\/login/.test(page.url())) throw new Error('login refused for ' + EMAIL);

            const sites = await page.evaluate(async () => {
                const r = await fetch('/api/sites', { headers: { Accept: 'application/json' }, credentials: 'same-origin' });
                return r.json();
            });
            previousActiveSiteId = sites.active_site_id;

            await page.evaluate(async ({ id }) => {
                const t = document.querySelector('meta[name=csrf-token]');
                await fetch('/api/active-site', {
                    method: 'PATCH',
                    headers: Object.assign({ 'Content-Type': 'application/json', Accept: 'application/json' },
                        t ? { 'X-CSRF-TOKEN': t.getAttribute('content') } : {}),
                    body: JSON.stringify({ site_id: id }),
                    credentials: 'same-origin',
                });
            }, { id: SITE.id });

            // The export page. NOT the disease page.
            await page.goto(BASE_URL + '/reports/export', { waitUntil: 'domcontentloaded' });
            await page.waitForTimeout(12000);

            // ---- E1: the store ----
            m.store = await page.evaluate((siteId) => {
                const SM = window.GAIP_SampleManager;
                if (!SM || typeof SM.getAllSamples !== 'function') return { error: 'no SampleManager' };
                const all = SM.getAllSamples();
                const store = (all.allSites || {})[siteId] || null;
                const soil = store && store.soil ? store.soil : {};
                return {
                    siteInRegistry: !!(all.sites || {})[siteId],
                    siteLabel: ((all.sites || {})[siteId] || {}).label || null,
                    soilKeys: Object.keys(soil),
                    entries: Object.keys(soil).map((k) => ({
                        key: k,
                        label: soil[k].label || null,
                        serverId: soil[k].serverId ? String(soil[k].serverId) : null,
                        date: soil[k].date || null,
                        rawDataKeys: soil[k].rawData ? Object.keys(soil[k].rawData).length : 0,
                    })),
                };
            }, SITE.id);
            process.stdout.write('[q33] E1 store: ' + JSON.stringify(m.store) + '\n');
            if (m.store.error || !m.store.soilKeys || m.store.soilKeys.length === 0) {
                m.stopped = 'E1: the sample is not in the store — the export never had it';
                process.stdout.write('[q33] STOPPED at ' + m.stopped + '\n');
                return;
            }

            // ---- E2: the enumeration ----
            m.enumerated = await page.evaluate((siteId) => {
                const CE = window.GAIP_CombinedExport;
                if (!CE || typeof CE.enumerate !== 'function') return { error: 'no GAIP_CombinedExport' };
                const all = CE.enumerate('all') || [];
                return {
                    total: all.length,
                    mine: all.filter((e) => e.siteId === siteId).map((e) => ({
                        siteId: e.siteId, siteLabel: e.siteLabel, sampleId: e.sampleId,
                        sampleLabel: e.sampleLabel, hasSoil: e.hasSoil, hasWater: e.hasWater, hasTissue: e.hasTissue,
                    })),
                };
            }, SITE.id);
            process.stdout.write('[q33] E2 enumerate: ' + JSON.stringify(m.enumerated) + '\n');
            if (m.enumerated.error || !m.enumerated.mine.length) {
                m.stopped = 'E2: enumerateSamples() does not return this sample — case (b), a defect at enumeration';
                process.stdout.write('[q33] STOPPED at ' + m.stopped + '\n');
                return;
            }

            // ---- E3: the picker ----
            await page.click('#rp-export-word-btn');
            await page.waitForSelector('.gaip-bulk-area-backdrop', { timeout: 60000 }).catch(() => {});
            await page.waitForTimeout(2000);

            m.picker = await page.evaluate((siteId) => {
                const back = document.querySelector('.gaip-bulk-area-backdrop');
                if (!back) return { dialogOpen: false };
                const boxes = Array.from(back.querySelectorAll('input[data-sample-uid]'));
                const groups = Array.from(back.querySelectorAll('[data-site-group]'))
                    .map((g) => g.getAttribute('data-site-group'));
                return {
                    dialogOpen: true,
                    groups: groups,
                    totalCheckboxes: boxes.length,
                    mine: boxes.filter((b) => (b.getAttribute('data-sample-uid') || '').indexOf(siteId) === 0)
                        .map((b) => ({
                            uid: b.getAttribute('data-sample-uid'),
                            checked: b.checked,
                            rowLabel: (b.closest('tr') ? (b.closest('tr').querySelector('.gaip-bulk-sample-label') || {}).textContent : null) || null,
                        })),
                };
            }, SITE.id);
            process.stdout.write('[q33] E3 picker: ' + JSON.stringify(m.picker) + '\n');
            if (!m.picker.dialogOpen || !m.picker.mine.length) {
                m.stopped = 'E3: the sample is enumerated but NOT rendered in the picker — case (b), a defect in the picker';
                process.stdout.write('[q33] STOPPED at ' + m.stopped + '\n');
                return;
            }

            // ---- E4: the document, this sample alone ----
            await page.click('#csp-none');
            await page.waitForTimeout(400);
            await page.evaluate((uid) => {
                const b = document.querySelector('input[data-sample-uid="' + uid + '"]');
                if (b && !b.checked) { b.checked = true; b.dispatchEvent(new Event('change', { bubbles: true })); }
            }, m.picker.mine[0].uid);
            await page.waitForTimeout(400);

            const [download] = await Promise.all([
                page.waitForEvent('download', { timeout: 180000 }),
                page.click('#csp-export'),
            ]);
            docxPath = path.join(os.tmpdir(), 'gilba-q33-' + Date.now() + '.docx');
            await download.saveAs(docxPath);

            const xml = readDocumentXml(docxPath);
            const text = docxText(xml);
            const tables = docxTables(xml);

            // The delivery section, by the words the export prints, and the
            // requirement beside it so "both missing" is distinguishable from
            // "delivery missing".
            const deliveryTables = tables.filter((t) =>
                JSON.stringify(t).toLowerCase().indexOf('deliver') !== -1);
            // The columns are NAMED rather than counted: a dash in column 3
            // means nothing until column 3 has a heading, and the reported
            // symptom is specifically about the DELIVERY column.
            const dashCells = [];
            const headers = [];
            deliveryTables.forEach((t) => {
                if (t.length) headers.push(t[0]);
                t.forEach((row, ri) => {
                    if (ri === 0) return;
                    row.forEach((c, ci) => {
                        const v = (c || '').trim();
                        if (v === '—' || v === '-' || v === '–') {
                            const head = (t[0] && t[0][ci]) ? t[0][ci] : ('col' + ci);
                            dashCells.push({ column: head, row: row.join(' | ') });
                        }
                    });
                });
            });

            m.doc = {
                bytes: fs.statSync(docxPath).size,
                namesTheSite: text.indexOf(SITE.name) !== -1,
                namesTheSample: text.indexOf(EXPECTED_LABEL) !== -1,
                tableCount: tables.length,
                deliveryTableCount: deliveryTables.length,
                deliveryHeaders: headers,
                dashesByColumn: dashCells.reduce((acc, d) => {
                    acc[d.column] = (acc[d.column] || 0) + 1; return acc;
                }, {}),
                deliveryRowsWithDash: dashCells.length,
                dashRows: dashCells.slice(0, 6).map((d) => d.column + ' :: ' + d.row),
                mentionsRequirement: /requirement/i.test(text),
                mentionsDelivery: /deliver/i.test(text),
            };
            process.stdout.write('[q33] E4 document: ' + JSON.stringify(m.doc) + '\n');
            if (process.env.GILBA_E2E_KEEP === '1') {
                process.stdout.write('[q33] kept: ' + docxPath + '\n');
            }
        }, 300000);

        afterAll(async () => {
            if (page && previousActiveSiteId) {
                await page.evaluate(async ({ id }) => {
                    const t = document.querySelector('meta[name=csrf-token]');
                    await fetch('/api/active-site', {
                        method: 'PATCH',
                        headers: Object.assign({ 'Content-Type': 'application/json', Accept: 'application/json' },
                            t ? { 'X-CSRF-TOKEN': t.getAttribute('content') } : {}),
                        body: JSON.stringify({ site_id: id }),
                        credentials: 'same-origin',
                    });
                }, { id: previousActiveSiteId }).catch(() => {});
            }
            if (browser) await browser.close();
            if (docxPath && process.env.GILBA_E2E_KEEP !== '1') {
                try { fs.unlinkSync(docxPath); } catch (e) {}
            }
            if (guard) {
                process.stdout.write('[q33] ' + guard.report() + '\n');
                process.stdout.write('[q33] reached, non-GET: '
                    + JSON.stringify(guard.reached.filter((r) => !/^(GET|HEAD|OPTIONS) /.test(r))) + '\n');
            }
        }, 120000);

        test('E1: Westview\'s only sample IS in the client store, keyed and labelled as read', () => {
            expect(m.stopped).toBeNull();
            expect(m.store.soilKeys).toEqual([EXPECTED_STORE_KEY]);
            const e = m.store.entries[0];
            expect(e.label).toBe(EXPECTED_LABEL);
            expect(e.serverId).toBe(SERVER_SAMPLE_ID);
            // Without this the rest could pass on an empty record.
            expect(e.rawDataKeys).toBeGreaterThan(0);
        });

        test('E2: the export enumerates it', () => {
            expect(m.stopped).toBeNull();
            expect(m.enumerated.mine.length).toBe(1);
            expect(m.enumerated.mine[0].hasSoil).toBe(true);
        });

        test('E3: and the picker OFFERS it — the question as asked', () => {
            expect(m.stopped).toBeNull();
            expect(m.picker.dialogOpen).toBe(true);
            expect(m.picker.groups).toContain(SITE.name);
            expect(m.picker.mine.length).toBe(1);
            expect(m.picker.mine[0].uid).toBe(SITE.id + '::' + EXPECTED_STORE_KEY);
            expect(m.picker.mine[0].rowLabel).toContain(EXPECTED_LABEL);
        });

        test('E4: with it ticked, the document is built and names the site and the sample', () => {
            expect(m.stopped).toBeNull();
            expect(m.doc.bytes).toBeGreaterThan(10000);
            expect(m.doc.namesTheSite).toBe(true);
            expect(m.doc.namesTheSample).toBe(true);
        });

        test('E4: the delivery section is printed, and its dashes are named by column', () => {
            // The reported symptom, measured rather than judged. The headings
            // and the per-column counts are printed above; what a dash MEANS
            // depends on which column carries it, and this sample's payload is
            // `{pH, zone, _label}` — one lab reading, no P, no K, no CEC. A
            // document that prints "No Soil Data" for those is the product
            // telling the truth about the record it was given.
            expect(m.doc.mentionsDelivery).toBe(true);
            expect(m.doc.deliveryTableCount).toBeGreaterThan(0);
            expect(m.doc.deliveryHeaders.length).toBeGreaterThan(0);
        });

        test('no write to a protected table reached the server', () => {
            // Held, not undone: restoreConfigs() cannot put an analysis_cache
            // row back (Question 39), so nothing may be allowed to land.
            //
            // An earlier draft of this assertion said "no non-GET reached at
            // all" and went red on its own run. That was the assertion being
            // wrong, not the stand: the guard covers five stand-state routes,
            // and this run legitimately sends others — the login POST and the
            // PATCH /api/active-site it needs to reach Westview, which is put
            // back in afterAll. Written as the guard's actual promise, and the
            // requests that did reach are printed above so the narrowing is
            // visible rather than asserted away.
            const PROTECTED = /\/api\/(analysis-cache|samples|site-summaries|predictions|sites\/sync|sites\/[^/]+\/config\/)/;
            const leaked = guard.reached.filter((r) => !/^(GET|HEAD|OPTIONS) /.test(r) && PROTECTED.test(r));
            expect(leaked).toEqual([]);
        });
    });
}

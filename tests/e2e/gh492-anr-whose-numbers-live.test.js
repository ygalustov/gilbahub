/**
 * GH-492 — a MEASUREMENT on the live stack, not a fix.
 *
 * The question: the Annual Nutrient Requirements section prints for a site with
 * no soil sample (measured in GH-490: Phosphorus 24.4 kg/ha/yr on a site whose
 * soil block was not printed at all). Whose numbers are they?
 *
 * HOW IT IS READ: ONE DOCUMENT PER SITE. For every live site the export is
 * collected and built on its own (`collectData(inputs-for-that-site)` →
 * `buildSections` → its own .docx), and every reading is taken from THAT site's
 * own `word/document.xml`. The combined export, which puts several reports in
 * one file, is not used, so no reading can answer about another site's report.
 *
 * ── BOTH OUTCOMES, NAMED BEFORE THE RUN ─────────────────────────────────────
 *
 * A — the numbers are not bound to the site at all. Sites with materially
 *     different turf, climate and annual-N settings print the SAME P/K/S
 *     requirement rows. Then "no sample → do not print" would hide half of the
 *     defect, and the right answer is to stop and report, not to patch.
 *
 * B — the numbers are bound to the site: they differ between sites in step with
 *     those sites' own inputs, and the fault is only that a site with no soil
 *     sample still prints a full requirements table, computed with no soil
 *     reading behind it. Then the section is not printed for such a site, and
 *     its absence is registered the way GH-490 registers the soil block's.
 *
 * C — a third possibility this run can also produce: the numbers come neither
 *     from the site nor from a per-site computation, but from a programme the
 *     PAGE holds (`window.GAIP_NUTRITION_PROGRAM` and the caches around it).
 *     That is A's answer with a different cause — stop and report.
 *
 * The decision between them is made by the numbers below, and by nothing else.
 * It asserts only that the measurement was taken.
 *
 * Run: GILBA_E2E=1 npx jest tests/e2e/gh492-anr-whose-numbers-live.test.js --verbose
 */

'use strict';

const fs = require('fs');
const path = require('path');

let chromium = null;
try { ({ chromium } = require('playwright')); } catch (e) { /* reported below */ }

const ENABLED = process.env.GILBA_E2E === '1';
const OUT = process.env.GILBA_GH492_OUT || '/tmp/gilba-pw-test/gh492-anr.json';

const credentials = (() => {
    try { return JSON.parse(fs.readFileSync(path.join(__dirname, '.e2e-credentials.json'), 'utf8')); }
    catch (e) { return {}; }
})();
const BASE_URL = process.env.GILBA_E2E_URL || credentials.url || 'http://127.0.0.1:8080';

if (!ENABLED) {
    describe('GH-492 — whose numbers the ANR prints (disabled)', () => {
        test.skip('needs the live stack', () => {});
    });
} else {
    describe('GH-492 — whose numbers the Annual Nutrient Requirements section prints', () => {
        jest.setTimeout(900000);
        let live, browser;

        beforeAll(async () => {
            if (!chromium) throw new Error('playwright does not resolve from the repo — run `npm install`');
            browser = await chromium.launch();
            const page = await (await browser.newContext({ viewport: { width: 1400, height: 1000 } })).newPage();
            await page.goto(BASE_URL + '/login', { waitUntil: 'domcontentloaded' });
            await page.fill('#email', credentials.email);
            await page.fill('#password', credentials.password);
            await Promise.all([
                page.waitForNavigation({ waitUntil: 'domcontentloaded' }).catch(() => {}),
                page.click('form.login-form button[type=submit]')
            ]);
            await page.waitForTimeout(1500);
            await page.goto(BASE_URL + '/reports/export', { waitUntil: 'domcontentloaded' });
            await page.waitForFunction(
                () => !!(window.GAIP_SampleManager && window.GAIP_NutritionProgramInputs && window.GAIP_WordExport),
                null, { timeout: 30000 });
            await page.waitForTimeout(8000);

            live = await page.evaluate(async () => {
                const NPI = window.GAIP_NutritionProgramInputs;
                const WE = window.GAIP_WordExport;
                const SM = window.GAIP_SampleManager;
                const all = SM.getAllSamples();
                // What the PAGE holds, once, so outcome C can be told from B.
                const pageProgramme = (() => {
                    const p = window.GAIP_NUTRITION_PROGRAM;
                    if (!p) return null;
                    return {
                        annualN: p.annualN != null ? p.annualN : (p.targets && p.targets.N) || null,
                        keys: Object.keys(p).slice(0, 12)
                    };
                })();
                const out = [];
                // The climate pre-pass the real export runs before it collects
                // anything (`word-export-combined.js`): each site's normals are
                // resolved from that site's own row coordinates. Without it
                // this measurement would be of a page whose climate was never
                // warmed, which is the harness's shape and not the product's.
                const SC = window.GAIP_SiteConfig;
                const CN = window.GilbaClimateNormalsService;
                for (const row of SM.getSiteList()) {
                    try {
                        const r = SC && SC.getSite ? SC.getSite(row.id) : null;
                        const lat = r && parseFloat(r.latitude);
                        const lon = r && parseFloat(r.longitude);
                        if (CN && typeof CN.resolveFor === 'function' && isFinite(lat) && isFinite(lon) && lat && lon) {
                            await CN.resolveFor(lat, lon);
                        }
                    } catch (e) { /* recorded per site below as an absent climate */ }
                }
                for (const row of SM.getSiteList()) {
                    const rec = { id: row.id, name: row.label };
                    try {
                        const inputs = NPI.resolveExportInputs({ siteId: row.id });
                        const store = ((all.allSites || {})[row.id] || {}).soil || {};
                        rec.soilOnFile = Object.keys(store).length;
                        rec.soilSelected = !!(inputs.samples && inputs.samples.soil);
                        const data = WE.collectData(inputs);
                        rec.soilState = data.soil.state;
                        rec.soilRecord = data.soil.recordKey;
                        rec.soilPKS = { P: data.soil.P, K: data.soil.K, S: data.soil.S };
                        const ei = data.engineInputs || {};
                        const temps = ei.climate && ei.climate.monthlyTemps;
                        rec.engine = {
                            species: ei.turf && ei.turf.species,
                            turfType: ei.turf && ei.turf.turfType,
                            clipping: ei.turf && ei.turf.clippingManagement,
                            annualN: ei.turf && ei.turf.nProgramKgHaYr,
                            annualNBase: ei.turf && ei.turf.annualNBase,
                            annualNSource: ei.turf && ei.turf.annualNSource,
                            climateSource: ei.climate && ei.climate.source,
                            climateReason: ei.climate && ei.climate.unavailableReason,
                            // The shape is not always an array — recorded as it
                            // comes, three values or the keys it answers with.
                            firstTemps: Array.isArray(temps) ? temps.slice(0, 3)
                                : (temps && typeof temps === 'object'
                                    ? Object.keys(temps).slice(0, 4).map((k) => k + '=' + temps[k])
                                    : temps || null)
                        };
                        const ns = data.nutritionSummary || {};
                        rec.summary = {
                            hasData: !!ns.hasData,
                            P: ns.annualP, K: ns.annualK, S: ns.annualS,
                            totalN: ns.totalN, activeMonths: ns.activeMonths,
                            monthlyN: ns.monthlyN ? ns.monthlyN.map((m) => (typeof m === 'number' ? m : (m && m.n))) : null
                        };
                        // THIS site's own document.
                        const sections = WE.buildSections(data, {});
                        const doc = new window.docx.Document({ sections: [{ properties: {}, children: sections }] });
                        const blob = await window.docx.Packer.toBlob(doc);
                        const zip = await window.JSZip.loadAsync(await blob.arrayBuffer());
                        const xml = await zip.file('word/document.xml').async('string');
                        rec.text = xml.replace(/<\/w:p>/g, '\n').replace(/<\/w:tc>/g, '\t')
                            .replace(/<[^>]+>/g, '').replace(/&amp;/g, '&');
                    } catch (e) {
                        rec.error = String((e && e.message) || e).slice(0, 200);
                    }
                    out.push(rec);
                }
                return { pageProgramme: pageProgramme, sites: out };
            });
            await browser.close();
            browser = null;
            fs.mkdirSync(path.dirname(OUT), { recursive: true });
            fs.writeFileSync(OUT, JSON.stringify(live, null, 1));
        });

        afterAll(async () => { if (browser) await browser.close(); });

        test('every site was measured on its own document, and the table is printed', () => {
            const sites = live.sites;
            expect(Array.isArray(sites)).toBe(true);
            expect(sites.length).toBeGreaterThan(0);

            /**
             * The printed rows of THIS site's ANR section, from its own text.
             *
             * The heading's name appears twice: once in the Contents list as
             * "• Annual Nutrient Requirements" and once as the section. Taking
             * the first occurrence lands in the contents and then reads the
             * SOIL table's ppm rows below it — measured on Test5, where that
             * returned nothing at all because those rows are ppm and this
             * reader wants kg/ha/yr. The section is the occurrence that is not
             * a contents bullet.
             */
            const printedRows = (text) => {
                let at = -1;
                for (let i = text.indexOf('Annual Nutrient Requirements'); i >= 0;
                    i = text.indexOf('Annual Nutrient Requirements', i + 1)) {
                    if (text.slice(Math.max(0, i - 2), i) !== '\u2022 ') { at = i; break; }
                }
                if (at < 0) return null;
                const slice = text.slice(at, at + 4000);
                const rows = {};
                [['Phosphorus (P)', 'P'], ['Potassium (K)', 'K'], ['Sulphur (S)', 'S']].forEach(([label, key]) => {
                    const m = new RegExp(label.replace(/[()]/g, '\\$&') + '\\s*\\n?\\t?([\\d.]+) kg/ha/yr').exec(slice);
                    if (m) rows[key] = parseFloat(m[1]);
                });
                return rows;
            };

            const lines = [];
            lines.push('');
            lines.push('GH-492 — one document per site; every reading is from that site\'s own document.');
            lines.push('What the PAGE holds as a programme: ' + JSON.stringify(live.pageProgramme));
            lines.push('');
            lines.push(['site', 'soil', 'soil P/K/S', 'annualN (source)', 'climate',
                'summary P/K/S', 'PRINTED P/K/S', 'section'].join(' | '));

            sites.forEach((s) => {
                const printed = s.text ? printedRows(s.text) : null;
                s._printed = printed;
                if (!s.engine || !s.summary) {
                    lines.push(s.name + ' | ERROR: ' + s.error);
                    return;
                }
                lines.push([
                    s.name,
                    s.soilState + (s.soilOnFile ? ' (' + s.soilOnFile + ' on file)' : ''),
                    [s.soilPKS.P, s.soilPKS.K, s.soilPKS.S].map((v) => (v === undefined ? '—' : v)).join('/'),
                    s.engine.annualN + ' (' + s.engine.annualNSource + ')',
                    (s.engine.climateSource || '—') + (s.engine.climateReason ? ':' + s.engine.climateReason : '')
                        + ' ' + JSON.stringify(s.engine.firstTemps),
                    [s.summary.P, s.summary.K, s.summary.S]
                        .map((v) => (v == null ? '—' : Number(v).toFixed(1))).join('/'),
                    printed ? ['P', 'K', 'S'].map((k) => (printed[k] === undefined ? '—' : printed[k])).join('/') : 'no section',
                    printed ? 'printed' : 'absent'
                ].join(' | '));
            });

            // Are they the same numbers everywhere?
            const fingerprints = {};
            sites.filter((s) => s._printed).forEach((s) => {
                const f = JSON.stringify(s._printed);
                (fingerprints[f] = fingerprints[f] || []).push(s.name);
            });
            lines.push('');
            lines.push('Distinct printed P/K/S sets across sites: ' + Object.keys(fingerprints).length);
            Object.keys(fingerprints).forEach((f) => lines.push('  ' + f + ' — ' + fingerprints[f].join(', ')));

            const noSample = sites.filter((s) => s.soilState !== 'selected');
            const withSample = sites.filter((s) => s.soilState === 'selected');
            lines.push('');
            lines.push('Sites with a selected soil sample: ' + withSample.length
                + '; without: ' + noSample.length);
            lines.push('Of the sites WITHOUT a sample, printing the ANR section: '
                + noSample.filter((s) => s._printed).length);
            lines.push('Of the sites WITH a sample, printing the ANR section: '
                + withSample.filter((s) => s._printed).length);

            // Do the no-sample sites' numbers vary with their own settings?
            lines.push('');
            lines.push('No-sample sites, their own inputs against their printed numbers:');
            noSample.filter((s) => s.engine).forEach((s) => {
                lines.push('  ' + s.name + ' | species ' + s.engine.species + ' | annualN '
                    + s.engine.annualN + ' (' + s.engine.annualNSource + ') | temps '
                    + JSON.stringify(s.engine.firstTemps) + ' | printed '
                    + JSON.stringify(s._printed));
            });
            lines.push('');
            lines.push('Saved: ' + OUT);
            process.stdout.write(lines.join('\n') + '\n');

            sites.forEach((s) => expect([s.name, s.error]).toEqual([s.name, undefined]));
        });
    });
}

/**
 * GH-492, second half — THE PRODUCT'S OWN PATH.
 *
 * The measurement above builds each site's document by calling
 * `buildSections` directly. That is a harness shape, and two things follow
 * from it that a client never sees:
 *
 *   - `window.GAIP_COMBINED_EXPORT_ACTIVE` is false, so word-export.js prints
 *     its own per-report Annual Nutrient Requirements section. In the product
 *     the ONLY caller of `buildSections` is the combined builder
 *     (`word-export-combined.js:3329`), which sets that flag, and the section
 *     is suppressed;
 *   - the page's active-site pointer never moves, while the combined loop
 *     moves it to each entry's site before collecting.
 *
 * So this half drives the export the way a client does — the picker on
 * /reports/export, two entries — and reads each report from ITS OWN slice of
 * the combined document, by the `Report n of m` marker the loop writes.
 *
 * The pair is chosen so the two questions can be told apart:
 *   - Russley's WATER sample: a report whose site has soil records on file but
 *     none selected, so the report carries no soil readings at all;
 *   - Test5's soil sample: a report that does carry them.
 *
 * It asserts only that the measurement was taken; the numbers are printed.
 */
if (ENABLED) {
    describe('GH-492 — what the client\'s own export prints for a report with no soil', () => {
        jest.setTimeout(600000);
        const os = require('os');
        let browser, page, docxPath = null, previousActiveSiteId = null;
        let picker = null, slices = null, facility = null;

        /** The body's top-level blocks — paragraphs and tables — in order. */
        function bodyBlocks(xml) {
            const from = xml.indexOf('<w:body>');
            const body = from >= 0 ? xml.slice(from + '<w:body>'.length, xml.lastIndexOf('</w:body>')) : xml;
            const open = /<w:(p|tbl)(?:\s[^>]*)?(\/?)>/g;
            const blocks = [];
            let m;
            while ((m = open.exec(body))) {
                const tag = m[1];
                if (m[2] === '/') { blocks.push({ tag: tag, xml: m[0] }); continue; }
                const openRe = new RegExp('<w:' + tag + '(?:\\s[^>]*)?>', 'g');
                const closeRe = new RegExp('</w:' + tag + '>', 'g');
                let depth = 1, at = open.lastIndex, end = -1;
                while (depth > 0) {
                    closeRe.lastIndex = at;
                    const close = closeRe.exec(body);
                    if (!close) break;
                    openRe.lastIndex = at;
                    let nested = openRe.exec(body);
                    while (nested && nested.index < close.index) {
                        depth++;
                        openRe.lastIndex = nested.index + nested[0].length;
                        nested = openRe.exec(body);
                    }
                    depth--;
                    at = close.index + close[0].length;
                    if (depth === 0) end = at;
                }
                if (end < 0) break;
                blocks.push({ tag: tag, xml: body.slice(m.index, end) });
                open.lastIndex = end;
            }
            return blocks;
        }
        const blockText = (b) => (b.xml.match(/<w:t[^>]*>([\s\S]*?)<\/w:t>/g) || [])
            .map((t) => t.replace(/<[^>]+>/g, '')).join('').trim();
        function rowsOf(tblXml) {
            const rows = [];
            const trRe = /<w:tr(?:\s[^>]*)?>([\s\S]*?)<\/w:tr>/g;
            let r;
            while ((r = trRe.exec(tblXml))) {
                const cells = [];
                const tcRe = /<w:tc(?:\s[^>]*)?>([\s\S]*?)<\/w:tc>/g;
                let c;
                while ((c = tcRe.exec(r[1]))) {
                    cells.push((c[1].match(/<w:t[^>]*>([\s\S]*?)<\/w:t>/g) || [])
                        .map((t) => t.replace(/<[^>]+>/g, '')).join('').trim());
                }
                rows.push(cells);
            }
            return rows;
        }

        beforeAll(async () => {
            if (!chromium) throw new Error('playwright does not resolve from the repo — run `npm install`');
            browser = await chromium.launch();
            const context = await browser.newContext({ acceptDownloads: true, viewport: { width: 1400, height: 1000 } });
            page = await context.newPage();
            await page.goto(BASE_URL + '/login', { waitUntil: 'domcontentloaded' });
            await page.fill('#email', credentials.email);
            await page.fill('#password', credentials.password);
            await Promise.all([
                page.waitForNavigation({ waitUntil: 'domcontentloaded' }).catch(() => {}),
                page.click('form.login-form button[type=submit]')
            ]);
            await page.waitForTimeout(1500);
            previousActiveSiteId = await page.evaluate(async () => {
                const r = await fetch('/api/sites', { headers: { Accept: 'application/json' }, credentials: 'same-origin' });
                return (await r.json()).active_site_id;
            });
            await page.goto(BASE_URL + '/reports/export', { waitUntil: 'domcontentloaded' });
            await page.waitForFunction(() => !!(window.GilbaNutritionCalendar && window.GAIP_SampleManager),
                null, { timeout: 30000 });
            await page.waitForTimeout(2500);

            await page.click('text=Generate & Download Word');
            await page.waitForSelector('.gaip-bulk-area-backdrop', { timeout: 15000 });
            await page.waitForTimeout(600);
            await page.click('text=Deselect all');
            await page.waitForTimeout(300);

            picker = await page.evaluate(({ waterSite, soilUid }) => {
                const rowText = (cb) => {
                    let el = cb;
                    for (let i = 0; i < 6 && el; i++) { el = el.parentElement; if (el && el.innerText) break; }
                    return (el && el.innerText ? el.innerText : '').replace(/\s+/g, ' ').trim().slice(0, 90);
                };
                const boxes = Array.from(document.querySelectorAll('input[data-sample-uid]'));
                const all = boxes.map((c) => ({ uid: c.getAttribute('data-sample-uid'), text: rowText(c) }));
                // Russley's WATER entry: its own site, and the row says water.
                const water = boxes.filter((c) => String(c.getAttribute('data-sample-uid') || '')
                    .indexOf(waterSite + '::') === 0 && /water|bore/i.test(rowText(c)))[0];
                const soil = document.querySelector('input[data-sample-uid="' + soilUid + '"]');
                [water, soil].forEach((cb) => {
                    if (!cb) return;
                    cb.checked = true;
                    cb.dispatchEvent(new Event('change', { bubbles: true }));
                });
                return {
                    all: all,
                    waterUid: water ? water.getAttribute('data-sample-uid') : null,
                    waterText: water ? rowText(water) : null,
                    soilUid: soil ? soil.getAttribute('data-sample-uid') : null,
                    checked: document.querySelectorAll('input[data-sample-uid]:checked').length
                };
            }, {
                waterSite: '019f35f0-d912-73e5-82bd-3de0bfd4f6ce',
                soilUid: '019e96f3-9294-72be-a13c-7fa7427afd5a::sample_141'
            });
            if (picker.checked !== 2) {
                throw new Error('expected two ticked entries, got ' + picker.checked
                    + ' — available: ' + JSON.stringify(picker.all));
            }

            const [download] = await Promise.all([
                page.waitForEvent('download', { timeout: 300000 }),
                page.locator('button:has-text("Generate & Download")').last().click()
            ]);
            docxPath = path.join(os.tmpdir(), 'gilba-gh492-' + Date.now() + '.docx');
            await download.saveAs(docxPath);

            const { execFileSync } = require('child_process');
            const xml = execFileSync('unzip', ['-p', docxPath, 'word/document.xml'],
                { maxBuffer: 64 * 1024 * 1024 }).toString();
            const blocks = bodyBlocks(xml);
            const marks = [];
            blocks.forEach((b, i) => {
                if (b.tag !== 'p') return;
                const m = /^Report (\d+) of (\d+)$/.exec(blockText(b));
                if (m) marks.push({ at: i, n: Number(m[1]) });
            });
            slices = marks.map((mark, k) => ({
                n: mark.n,
                header: blockText(blocks[Math.max(0, mark.at - 1)]),
                blocks: blocks.slice(Math.max(0, mark.at - 1),
                    k + 1 < marks.length ? Math.max(0, marks[k + 1].at - 1) : blocks.length)
            }));
            // The facility-wide ANR table the combined export appends after the
            // loop: the table whose header row starts with "Sample".
            facility = [];
            blocks.filter((b) => b.tag === 'tbl').forEach((b) => {
                const rows = rowsOf(b.xml);
                if (rows.length && /^Sample$/i.test(rows[0][0] || '')) facility.push(rows);
            });
        });

        afterAll(async () => {
            try {
                if (page && previousActiveSiteId) {
                    await page.evaluate(async ({ id }) => {
                        const t = document.querySelector('meta[name=csrf-token]');
                        await fetch('/api/active-site', {
                            method: 'PATCH',
                            headers: Object.assign({ 'Content-Type': 'application/json', Accept: 'application/json' },
                                t ? { 'X-CSRF-TOKEN': t.getAttribute('content') } : {}),
                            body: JSON.stringify({ site_id: id }), credentials: 'same-origin'
                        });
                    }, { id: previousActiveSiteId });
                }
            } catch (e) { /* best effort */ }
            if (browser) await browser.close();
            if (docxPath && fs.existsSync(docxPath) && process.env.GILBA_KEEP_DOCX !== '1') fs.unlinkSync(docxPath);
        });

        test('the client\'s document, read report by report', () => {
            const lines = [];
            lines.push('');
            lines.push('GH-492 second half — the picker\'s own export, read per report slice.');
            lines.push('Picked: ' + picker.waterUid + ' (' + picker.waterText + ') and ' + picker.soilUid);
            lines.push('');
            lines.push('Everything the picker offered (' + picker.all.length + ' entries):');
            picker.all.forEach((e) => lines.push('  ' + e.uid + ' | ' + e.text));
            lines.push('');
            slices.forEach((r) => {
                const headings = r.blocks
                    .filter((b) => b.tag === 'p' && /w:outlineLvl w:val="0"/.test(b.xml) && blockText(b))
                    .map((b) => blockText(b));
                lines.push('Report ' + r.n + ' — ' + r.header);
                lines.push('  headings: ' + JSON.stringify(headings));
                lines.push('  own ANR section printed: '
                    + (headings.indexOf('Annual Nutrient Requirements') >= 0 ? 'YES' : 'no'));
                const soilRow = r.blocks.filter((b) => b.tag === 'tbl')
                    .map((b) => rowsOf(b.xml))
                    .filter((rows) => rows.some((c) => /^Phosphorus \(P\)$/.test(c[0] || '')))[0];
                lines.push('  a Phosphorus row inside this report: '
                    + (soilRow ? JSON.stringify(soilRow.filter((c) => /^(Phosphorus|Potassium|Sulphur)/.test(c[0] || ''))) : 'none'));
                lines.push('  "Not included: soil readings" in this report: '
                    + r.blocks.some((b) => blockText(b).indexOf('Not included: soil readings') >= 0));
            });
            lines.push('');
            lines.push('Facility-wide Annual Nutrient Requirements tables: ' + facility.length);
            facility.forEach((rows) => {
                rows.slice(0, 14).forEach((cells) => lines.push('  ' + JSON.stringify(cells)));
            });
            lines.push('');
            lines.push('Document kept: ' + (process.env.GILBA_KEEP_DOCX === '1' ? docxPath : 'no'));
            process.stdout.write(lines.join('\n') + '\n');
            expect(slices.length).toBeGreaterThan(0);
        });
    });
}

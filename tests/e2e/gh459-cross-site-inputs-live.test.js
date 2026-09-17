/**
 * GH-459 / GH-460 — a report is computed for the site of the sample it prints,
 * and it prints what the database holds.
 *
 * This is the owner's scenario, and it is deliberately run in a DIRTY profile:
 * the page is opened on one site and switched to another through the same
 * selector a client uses, before exporting. Every other live suite here starts
 * clean, which is why none of them could ever see this defect — a leak out of
 * a previously opened site cannot happen where no site was opened before. A
 * clean run proves nothing about the conditions users work in.
 *
 * Three things are asserted, and each fails on a different fault:
 *
 *   1. the GP column of the document's Monthly Schedule is the printed
 *      sample's own — it goes wrong when any calculation input leaks from the
 *      site the page was on (coordinates, species, the C3/C4 curve itself);
 *   2. that column matches the programme SAVED IN THE DATABASE for that site,
 *      read back from the API rather than from the browser — the only check in
 *      this repo comparing what is stored with what is printed, everything
 *      else compares two numbers the same browser just produced;
 *   3. the series is the expected one, month by month.
 *
 * Run: `npm run test:e2e:crosssite`.
 */
'use strict';

const fs = require('fs');
const os = require('os');
const path = require('path');
const { execFileSync } = require('child_process');
// GH-497: what this run asks of hosts we do not own, and whether they answered.
const { watchExternal } = require('./lib/external-sources');

const ENABLED = process.env.GILBA_E2E === '1';
let credentials = {};
try {
    credentials = JSON.parse(fs.readFileSync(
        process.env.GILBA_E2E_CREDENTIALS || path.join(__dirname, '.e2e-credentials.json'), 'utf8'));
} catch (e) { credentials = {}; }

const BASE_URL = process.env.GILBA_E2E_URL || credentials.url || 'http://127.0.0.1:8080';
const EMAIL = process.env.GILBA_E2E_EMAIL || credentials.email;
const PASSWORD = process.env.GILBA_E2E_PASSWORD || credentials.password;

// The other site is a Christchurch one (-43.50, 172.56); the sample printed
// belongs to Test5 - NZ, in Auckland (-36.85, 174.76). Two hemispherically
// identical but climatically different places, which is what makes the GP
// curve a usable witness.
const OTHER_SITE = { id: '019f35f0-d912-73e5-82bd-3de0bfd4f6ce', name: 'Russley (Christchurch)' };
const SAMPLE_SITE = { id: '019e96f3-9294-72be-a13c-7fa7427afd5a', name: 'Test5 - NZ (Auckland)' };
const SAMPLE_UID = SAMPLE_SITE.id + '::sample_141';
// A soil sample on the OTHER site, so that S7 below can export two sites at
// once — the case where the page's site and a report's site really differ.
const OTHER_SAMPLE_UID = OTHER_SITE.id + '::sample_105';
// GH-493: a THIRD report, and its only job is to stand last.
//
// The slice of the last report in a combined document has no right-hand
// boundary — there is no next `Report n of m` marker — so it runs to the end
// of the body and swallows the facility-wide sections, which print other
// sites' names (`<site>, Fertiliser Purchasing Summary`). Nothing about the
// content of the LAST slice can therefore be asserted. Adding a third entry
// does not fix that; it moves it. The two reports this scenario is about get a
// marker on both sides and can be asserted whole, and the unbounded slice
// becomes one nobody is asking a question about.
//
// Westview because it stands after both of them in the picker's own order, and
// because its sward is C4 where theirs are C3 — a third GP curve that neither
// of the other two could be mistaken for.
const THIRD_SITE = { id: '019f7d28-50ed-71e2-b817-c252b0160460', name: 'Westview' };
const THIRD_SAMPLE_UID = THIRD_SITE.id + '::sample_118';
// S9 moves this one between countries and puts it back. A site with no samples
// of its own, so nothing else in the suite depends on where it is.
const MOVING_SITE = { id: '019f457d-987c-7013-9dfe-e9d2bc1d972d', name: 'Canberra' };

let chromium = null;
try { ({ chromium } = require('playwright')); } catch (e) { /* reported below */ }

const MONTHS = ['January', 'February', 'March', 'April', 'May', 'June',
    'July', 'August', 'September', 'October', 'November', 'December'];

/** The Monthly Schedule's GP column, in month order. */
function monthlyGpFrom(docxPath) {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'gh459-'));
    execFileSync('unzip', ['-o', '-q', docxPath, 'word/document.xml', '-d', dir]);
    const xml = fs.readFileSync(path.join(dir, 'word', 'document.xml'), 'utf8');
    fs.rmSync(dir, { recursive: true, force: true });

    // Same shape the parity harness reads tables in: tables, rows, cells, and
    // the cell's text is its runs joined.
    const cellText = (tc) => (tc.match(/<w:t[^>]*>([\s\S]*?)<\/w:t>/g) || [])
        .map((t) => t.replace(/<[^>]+>/g, '')).join('').trim();
    const out = {};
    const tblRe = /<w:tbl>([\s\S]*?)<\/w:tbl>/g;
    let t;
    while ((t = tblRe.exec(xml))) {
        const trRe = /<w:tr(?:\s[^>]*)?>([\s\S]*?)<\/w:tr>/g;
        let r;
        while ((r = trRe.exec(t[1]))) {
            const cells = [];
            const tcRe = /<w:tc(?:\s[^>]*)?>([\s\S]*?)<\/w:tc>/g;
            let c;
            while ((c = tcRe.exec(r[1]))) cells.push(cellText(c[1]));
            if (cells.length < 2) continue;
            const month = MONTHS.filter((m) => cells[0] === m || cells[0] === m.slice(0, 3))[0];
            if (!month || out[month] !== undefined) continue;
            const gp = parseFloat(String(cells[1]).replace('%', ''));
            if (!isNaN(gp)) out[month] = gp;
        }
    }
    return MONTHS.map((m) => (out[m] === undefined ? null : out[m]));
}

/**
 * ── The combined document is SEVERAL REPORTS, and a report is the unit ──────
 *
 * The combined export writes one report after another into a single
 * `word/document.xml`. Reading "the document" for a value therefore answers
 * about whichever report came first, not about the site a check is asking
 * about. The reviewer's measurement of 17.09 is the proof: with Christchurch's
 * climate switched off, Russley's programme vanished, Test5's table became the
 * first one in the file, and a whole-document read returned Auckland's column
 * — the check stayed green twice over a document that no longer contained the
 * thing it was about.
 *
 * WHAT SEPARATES ONE REPORT FROM THE NEXT, and why the boundary holds:
 * `word-export-combined.js` pushes, for every report in the loop and before
 * any of that report's own sections, a page break, a header paragraph naming
 * the site and the sample, and a paragraph reading exactly
 * `Report <n> of <total>`. That last paragraph is written by the LOOP, not by
 * any section, and it is unconditional — no branch inside a report can remove
 * it, so a site that loses a section (or all of them) still keeps its marker
 * and its slice. A section disappearing only makes a slice shorter; it cannot
 * move a boundary. Nothing else in the document produces that text.
 *
 * The slice for report n therefore runs from its own header paragraph (the
 * block before the marker, which carries the site label) up to the header of
 * report n+1 — and for the LAST report, to the end of the body.
 *
 * That last bound is loose: the facility-wide sections the combined export
 * appends after the loop fall inside it, and one of them — Monthly N
 * Distribution — is a month-keyed table per site. So the GP column is not read
 * as "the first month-keyed table in the slice" either. It is read from the
 * table that identifies ITSELF: the Monthly Schedule's header row is
 * `Month | GP% | …`, which the Monthly N Distribution table does not have.
 * Two independent bounds, and a check that a slice holds at most one such
 * table.
 */

/** The body's top-level blocks — paragraphs and tables — in document order. */
function bodyBlocks(xml) {
    const from = xml.indexOf('<w:body>');
    const body = from >= 0 ? xml.slice(from + '<w:body>'.length, xml.lastIndexOf('</w:body>')) : xml;
    const open = /<w:(p|tbl)(?:\s[^>]*)?(\/?)>/g;
    const blocks = [];
    let m;
    while ((m = open.exec(body))) {
        const tag = m[1];
        if (m[2] === '/') {                      // <w:p/> — an empty paragraph
            blocks.push({ tag: tag, xml: m[0] });
            continue;
        }
        const openRe = new RegExp('<w:' + tag + '(?:\\s[^>]*)?>', 'g');
        const closeRe = new RegExp('</w:' + tag + '>', 'g');
        let depth = 1;
        let at = open.lastIndex;
        let end = -1;
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

/** A block's text: its runs, joined, the way the reader below wants them. */
function blockText(block) {
    return (block.xml.match(/<w:t[^>]*>([\s\S]*?)<\/w:t>/g) || [])
        .map((t) => t.replace(/<[^>]+>/g, '')).join('').trim();
}

/** One entry per report in a combined document: its own header and its blocks. */
function reportSlices(xml) {
    const blocks = bodyBlocks(xml);
    const marks = [];
    blocks.forEach((b, i) => {
        if (b.tag !== 'p') return;
        const m = /^Report (\d+) of (\d+)$/.exec(blockText(b));
        if (m) marks.push({ at: i, n: Number(m[1]), of: Number(m[2]) });
    });
    return marks.map((mark, k) => {
        // The header paragraph stands immediately before the marker and carries
        // "<site label> ,  <sample label>".
        const start = Math.max(0, mark.at - 1);
        const end = k + 1 < marks.length ? Math.max(0, marks[k + 1].at - 1) : blocks.length;
        return {
            n: mark.n, of: mark.of,
            header: blockText(blocks[start]),
            lastOfDocument: k + 1 === marks.length,
            blocks: blocks.slice(start, end)
        };
    });
}

/** The cells of one table row. */
function rowCells(trXml) {
    const cells = [];
    const tcRe = /<w:tc(?:\s[^>]*)?>([\s\S]*?)<\/w:tc>/g;
    let c;
    while ((c = tcRe.exec(trXml))) {
        cells.push((c[1].match(/<w:t[^>]*>([\s\S]*?)<\/w:t>/g) || [])
            .map((t) => t.replace(/<[^>]+>/g, '')).join('').trim());
    }
    return cells;
}

/** Every Monthly Schedule table in these blocks, named by its own header row. */
function monthlyScheduleTables(blocks) {
    const found = [];
    blocks.filter((b) => b.tag === 'tbl').forEach((b) => {
        const rows = [];
        const trRe = /<w:tr(?:\s[^>]*)?>([\s\S]*?)<\/w:tr>/g;
        let r;
        while ((r = trRe.exec(b.xml))) rows.push(rowCells(r[1]));
        if (!rows.length) return;
        const head = rows[0];
        // The table says what it is: word-export.js prints "Month | GP% | …".
        // The Monthly N Distribution table, also month-keyed, does not.
        if (head[0] !== 'Month' || head[1] !== 'GP%') return;
        const out = {};
        rows.slice(1).forEach((cells) => {
            if (cells.length < 2) return;
            const month = MONTHS.filter((m) => cells[0] === m || cells[0] === m.slice(0, 3))[0];
            if (!month || out[month] !== undefined) return;
            const gp = parseFloat(String(cells[1]).replace('%', ''));
            if (!isNaN(gp)) out[month] = gp;
        });
        found.push(MONTHS.map((m) => (out[m] === undefined ? null : out[m])));
    });
    return found;
}

/** The document part itself, for anything that needs the structure. */
function documentXmlFrom(docxPath) {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'gh468-'));
    execFileSync('unzip', ['-o', '-q', docxPath, 'word/document.xml', '-d', dir]);
    const xml = fs.readFileSync(path.join(dir, 'word', 'document.xml'), 'utf8');
    fs.rmSync(dir, { recursive: true, force: true });
    return xml;
}

/**
 * The Site Information table of a report — the block where the report states
 * whose it is. The first table in the slice whose first row reads
 * `Site | <name>`; the facility-wide sections the combined export appends
 * after the last report have no such table, so this reading is not affected by
 * the last slice's loose end bound.
 */
function siteInformationIn(blocks) {
    const tables = blocks.filter((b) => b.tag === 'tbl');
    for (const b of tables) {
        const rows = [];
        const trRe = /<w:tr(?:\s[^>]*)?>([\s\S]*?)<\/w:tr>/g;
        let r;
        while ((r = trRe.exec(b.xml))) rows.push(rowCells(r[1]));
        if (!rows.length || rows[0][0] !== 'Site') continue;
        const out = {};
        rows.forEach((cells) => { if (cells.length >= 2) out[cells[0]] = cells[1]; });
        return out;
    }
    return null;
}

/** Everything the document says, as plain text. */
function documentTextFrom(docxPath) {
    const xml = documentXmlFrom(docxPath);
    return (xml.match(/<w:t[^>]*>([\s\S]*?)<\/w:t>/g) || [])
        .map((t) => t.replace(/<[^>]+>/g, '')).join(' ');
}

if (!ENABLED) {
    process.stdout.write('[e2e] gh459-cross-site-inputs-live skipped (needs the live stack) — npm run test:e2e:crosssite\n');
    test.skip('GH-459 cross-site inputs (disabled)', () => {});
    test.skip('GH-468 S7 the document is the sample\'s site (disabled)', () => {});
    test.skip('GH-469 S8 a refused site switch (disabled)', () => {});
    test.skip('GH-474 S9 a site that moved country (disabled)', () => {});
} else {
    describe('GH-459 — the exported programme belongs to the sample\'s own site', () => {
        jest.setTimeout(300000);
        let browser, page, docxPath = null, previousActiveSiteId = null;
        let gpSeries = null;
        let savedMonthly = null;
        // GH-497: this run's dependence on hosts we do not own, recorded so a
        // failure caused by one of them cannot look like a failure of ours.
        let external = null;

        async function setActiveSite(id) {
            await page.evaluate(async ({ siteId }) => {
                const t = document.querySelector('meta[name=csrf-token]');
                await fetch('/api/active-site', {
                    method: 'PATCH',
                    headers: Object.assign({ 'Content-Type': 'application/json', Accept: 'application/json' },
                        t ? { 'X-CSRF-TOKEN': t.getAttribute('content') } : {}),
                    body: JSON.stringify({ site_id: siteId }),
                    credentials: 'same-origin'
                });
            }, { siteId: id });
        }

        beforeAll(async () => {
            if (!chromium) throw new Error('playwright does not resolve from the repo — run `npm install`');
            if (!EMAIL || !PASSWORD) throw new Error('no credentials — see tests/e2e/.e2e-credentials.example.json');
            browser = await chromium.launch();
            const context = await browser.newContext({ acceptDownloads: true, viewport: { width: 1400, height: 1000 } });
            external = await watchExternal(context, BASE_URL);
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

            // Dirty profile, step 1: the page opens on the OTHER site, so its
            // state, its globals and its form fields are all loaded and live.
            await setActiveSite(OTHER_SITE.id);
            await page.goto(BASE_URL + '/reports/export', { waitUntil: 'domcontentloaded' });
            await page.waitForFunction(() => !!(window.GilbaNutritionCalendar && window.GAIP_SampleManager),
                null, { timeout: 30000 });
            await page.waitForTimeout(2500);

            // Step 2: switch to the sample's site the way a client does —
            // through the selector in the top bar, not by reloading the page
            // on it. This is what leaves the previous site's values behind.
            const switched = await page.evaluate(({ siteId }) => {
                const sel = document.getElementById('gaip-site-select-top');
                if (!sel) return { ok: false, why: 'no site selector on the page' };
                sel.value = siteId;
                sel.dispatchEvent(new Event('change', { bubbles: true }));
                return { ok: sel.value === siteId, why: sel.value === siteId ? null :
                    ('the selector holds ' + JSON.stringify(Array.from(sel.options).map((o) => o.value))) };
            }, { siteId: SAMPLE_SITE.id });
            if (!switched.ok) throw new Error('could not switch sites in the page: ' + (switched.why || 'value did not take'));
            await page.waitForFunction((id) => window.GAIP_SampleManager &&
                window.GAIP_SampleManager.getActiveSiteId() === id, SAMPLE_SITE.id, { timeout: 30000 });
            await page.waitForTimeout(2500);

            // What the DATABASE holds for this site, read through the API —
            // not through the browser's own store, which is where the printed
            // numbers come from.
            savedMonthly = await page.evaluate(async ({ siteId }) => {
                const r = await fetch('/api/sites/' + siteId, {
                    headers: { Accept: 'application/json' }, credentials: 'same-origin' });
                const body = await r.json();
                const site = body.data || body;
                // SiteController::sitePayload() keys configs by namespace and
                // wraps each in { config, ... }.
                const configs = site.configs || {};
                const gaip = (configs.gaip && configs.gaip.config) || null;
                const prog = gaip && gaip.nutritionCalendarProgram;
                const monthly = (prog && prog.program && prog.program.monthly) || [];
                return monthly.map((m) => ({ month: m.month_name, gp: m.gp, temp: m.temp, N: m.N }));
            }, { siteId: SAMPLE_SITE.id });

            await page.click('text=Generate & Download Word');
            await page.waitForSelector('.gaip-bulk-area-backdrop', { timeout: 15000 });
            await page.waitForTimeout(600);
            await page.click('text=Deselect all');
            await page.waitForTimeout(300);
            const picked = await page.evaluate(({ uid }) => {
                const cb = document.querySelector('input[data-sample-uid="' + uid + '"]');
                if (!cb) {
                    return { found: false, available: Array.from(document.querySelectorAll('input[data-sample-uid]'))
                        .map((c) => c.getAttribute('data-sample-uid')) };
                }
                cb.checked = true;
                cb.dispatchEvent(new Event('change', { bubbles: true }));
                return { found: true, checked: document.querySelectorAll('input[data-sample-uid]:checked').length };
            }, { uid: SAMPLE_UID });
            if (!picked.found) throw new Error('sample not in the picker: ' + JSON.stringify(picked.available));
            if (picked.checked !== 1) throw new Error('expected exactly one checked sample, got ' + picked.checked);

            const [download] = await Promise.all([
                page.waitForEvent('download', { timeout: 180000 }),
                page.locator('button:has-text("Generate & Download")').last().click()
            ]);
            docxPath = path.join(os.tmpdir(), 'gilba-gh459-' + Date.now() + '.docx');
            await download.saveAs(docxPath);
            gpSeries = monthlyGpFrom(docxPath);
        });

        afterAll(async () => {
            try {
                if (page && previousActiveSiteId) await setActiveSite(previousActiveSiteId);
            } catch (e) { /* best effort */ }
            if (browser) await browser.close();
            if (docxPath && fs.existsSync(docxPath)) fs.unlinkSync(docxPath);
        });

        // GH-497: the discriminator, and it is a test NAME rather than a
        // sentence in a log. Red here means a host we do not own did not
        // answer, and the value tests below are a consequence of that rather
        // than a statement about the export.
        test('every external source this run depends on answered', () => {
            external.print('GH-459/GH-460');
            expect({ failedHosts: external.failedHosts(), firstFailures: external.failures().slice(0, 3) })
                .toEqual({ failedHosts: [], firstFailures: [] });
        });

        test('the Monthly Schedule GP column is the sample\'s own site, after switching to it in the page', () => {
            process.stdout.write('[e2e] GH-459 page opened on: ' + OTHER_SITE.name + ', switched in-page to: ' + SAMPLE_SITE.name + '\n');
            process.stdout.write('[e2e] GH-459 GP column printed: ' + JSON.stringify(gpSeries) + '\n');
            // GH-497: the network's verdict travels INSIDE what this assertion
            // compares, so its own diff says whether the sources answered —
            // the reader does not have to go and find that out elsewhere.
            expect({ external: external.verdict(), gp: gpSeries })
                .toEqual({
                    external: 'all external sources answered',
                    gp: [100, 100, 99, 86, 63, 41, 29, 33, 44, 58, 77, 95]
                });
        });

        test('the printed GP column is the programme SAVED IN THE DATABASE, not one the browser just computed', () => {
            // GH-460: both sides of every other comparison in this repo come
            // out of the same browser session, so a document computed from a
            // stale page and a page holding the same stale values agree with
            // each other perfectly. This side is the stored programme, fetched
            // from the API.
            process.stdout.write('[e2e] GH-460 saved months in the database: ' + savedMonthly.length + '\n');
            expect(savedMonthly.length).toBe(12);
            const saved = savedMonthly.map((m) => Math.round((m.gp <= 1 ? m.gp * 100 : m.gp)));
            process.stdout.write('[e2e] GH-460 saved GP: ' + JSON.stringify(saved) + '\n');
            process.stdout.write('[e2e] GH-460 printed GP: ' + JSON.stringify(gpSeries) + '\n');
            const rows = saved.map((v, i) => ({ month: savedMonthly[i].month, saved: v, printed: gpSeries[i] }))
                .filter((r) => Math.abs(r.saved - r.printed) > 1);
            // GH-497: `printed: null, saved: 100` was the whole of what this
            // failure used to say. The verdict now stands beside the rows.
            expect({ external: external.verdict(), rows: rows })
                .toEqual({ external: 'all external sources answered', rows: [] });
        });
    });

    /**
     * S7 (PLAN-GH439 section 10.6, seventh refinement) — a combined export
     * across TWO sites, with the page pointing at one of them.
     *
     * Measured while writing this, and it changed the scenario: with ONE
     * sample the loop's own `setActiveSite(entry.siteId)` moves the page onto
     * that sample's site before it collects, so a resolver falling back to the
     * page's site still gets the right answer. A single-sample S7 is green
     * with the defect restored — it proves nothing, and saying so is cheaper
     * than a scenario that looks like a proof.
     *
     * Two samples on two sites is where the page's site and a report's site
     * can differ: the loop prints one report per site. Both species are named
     * in the document, and if either report took its identity from the page,
     * one of them would be missing.
     *
     * WHAT THIS SCENARIO DOES NOT PROVE, measured on the stand both ways:
     * restoring the defect — the `opts.siteId || getActiveSiteId()` fallback in
     * the resolver AND the bare `collectData()` in the loop — leaves all of S7
     * GREEN. The loop calls `setActiveSite(entry.siteId)` and then waits for
     * that site's analysis before it collects, so the page's site has caught up
     * with the entry by the time anything resolves. The conditions under which
     * the reviewer's live measurement printed "Species: Couch" seven times are
     * not reproduced here, and are his to state.
     *
     * So S7 is a standing scenario, not the red proof for GH-468. What goes red
     * on the defect is the resolver's refusal and the two call-site assertions
     * in tests/gh468-document-site-is-named.test.js, each shown red.
     */
    describe('GH-468 S7 — the page points at another site for the whole export', () => {
        jest.setTimeout(300000);
        let browser, page, docxPath = null, previousActiveSiteId = null;
        let gpSeries = null, text = null, activeDuringExport = null;
        // GH-491: the document read as REPORTS, and the species each site is
        // configured with — taken from the API rather than written down here,
        // so the expectation is the product's own answer.
        let slices = null, speciesBySite = null;
        let external = null;   // GH-497
        // GH-493: the GP series each site's own data produces, computed BEFORE
        // the export and from the site row's coordinates — not read out of the
        // document this test is checking.
        let expectedGp = null;

        async function setActiveSite(id) {
            await page.evaluate(async ({ siteId }) => {
                const t = document.querySelector('meta[name=csrf-token]');
                await fetch('/api/active-site', {
                    method: 'PATCH',
                    headers: Object.assign({ 'Content-Type': 'application/json', Accept: 'application/json' },
                        t ? { 'X-CSRF-TOKEN': t.getAttribute('content') } : {}),
                    body: JSON.stringify({ site_id: siteId }),
                    credentials: 'same-origin'
                });
            }, { siteId: id });
        }

        beforeAll(async () => {
            if (!chromium) throw new Error('playwright does not resolve from the repo — run `npm install`');
            if (!EMAIL || !PASSWORD) throw new Error('no credentials — see tests/e2e/.e2e-credentials.example.json');
            browser = await chromium.launch();
            const context = await browser.newContext({ acceptDownloads: true, viewport: { width: 1400, height: 1000 } });
            external = await watchExternal(context, BASE_URL);
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

            // The page points at the OTHER site and stays there.
            await setActiveSite(OTHER_SITE.id);
            await page.goto(BASE_URL + '/reports/export', { waitUntil: 'domcontentloaded' });
            await page.waitForFunction(() => !!(window.GilbaNutritionCalendar && window.GAIP_SampleManager),
                null, { timeout: 30000 });
            await page.waitForTimeout(2500);

            await page.click('text=Generate & Download Word');
            await page.waitForSelector('.gaip-bulk-area-backdrop', { timeout: 15000 });
            await page.waitForTimeout(600);
            await page.click('text=Deselect all');
            await page.waitForTimeout(300);
            const picked = await page.evaluate(({ uids }) => {
                const missing = [];
                uids.forEach((uid) => {
                    const cb = document.querySelector('input[data-sample-uid="' + uid + '"]');
                    if (!cb) { missing.push(uid); return; }
                    cb.checked = true;
                    cb.dispatchEvent(new Event('change', { bubbles: true }));
                });
                return {
                    missing: missing,
                    available: Array.from(document.querySelectorAll('input[data-sample-uid]'))
                        .map((c) => c.getAttribute('data-sample-uid')),
                    checked: document.querySelectorAll('input[data-sample-uid]:checked').length
                };
            }, { uids: [OTHER_SAMPLE_UID, SAMPLE_UID, THIRD_SAMPLE_UID] });
            if (picked.missing.length) throw new Error('samples not in the picker: ' +
                JSON.stringify(picked.missing) + ' — available: ' + JSON.stringify(picked.available));
            if (picked.checked !== 3) throw new Error('expected exactly three checked samples, got ' + picked.checked);

            // GH-493: what each site's OWN data says its GP curve is, built
            // before the export runs. The temperatures come from that site's
            // row coordinates through the product's climate service, and the
            // curve from the calendar's own `calculateMonthlyGP` with that
            // site's C4/overseed answer. Nothing here reads the document, so
            // comparing a printed column with this is not the document being
            // compared with itself.
            expectedGp = await page.evaluate(async ({ ids }) => {
                const SC = window.GAIP_SiteConfig;
                const CN = window.GilbaClimateNormalsService;
                const NC = window.GilbaNutritionCalendar;
                const NPI = window.GAIP_NutritionProgramInputs;
                const out = {};
                for (const id of ids) {
                    const rec = { id: id };
                    try {
                        const row = SC && SC.getSite ? SC.getSite(id) : null;
                        const lat = row && parseFloat(row.latitude);
                        const lon = row && parseFloat(row.longitude);
                        rec.lat = lat; rec.lon = lon;
                        // Which curve this site's sward is on, decided the way
                        // the product decides it — by asking the species
                        // classifier about the site's OWN species. Taking it
                        // from `resolveSiteProgramInputs` was wrong and the run
                        // said so: that function does not answer `isC4` at all,
                        // so `!!undefined` put Westview's buffalograss on the
                        // C3 curve and the expectation missed by fifty points.
                        const inputs = NPI.resolveExportInputs({ siteId: id });
                        const species = (inputs.turf
                            && (inputs.turf.speciesDisplay || inputs.turf.species)) || null;
                        rec.species = species;
                        let isC4 = false;
                        const SPC = window.SpeciesController;
                        const NRC = window.NutritionRequirementCore;
                        if (SPC && typeof SPC.isC4Species === 'function') {
                            isC4 = !!SPC.isC4Species(species);
                        } else if (NRC && typeof NRC._isC4Species === 'function') {
                            isC4 = !!NRC._isC4Species(species);
                        } else {
                            rec.classifierMissing = true;
                        }
                        rec.isC4 = isC4;
                        // An overseeded sward runs a blended curve, and this
                        // expectation does not build one. Recorded per site so
                        // the scenario can assert that none of its three is
                        // overseeded rather than quietly computing the wrong
                        // curve for one that is.
                        const cfg = SC && SC.getConfig ? SC.getConfig(id) : null;
                        rec.overseedSpecies = (cfg && cfg.turf && cfg.turf.overseedSpecies) || null;
                        rec.overseed = !!(isC4 && rec.overseedSpecies);
                        const overseedConfig = {
                            isOverseed: rec.overseed,
                            baseSpecies: species,
                            overseedSpecies: rec.overseedSpecies,
                            summerIntent: (cfg && cfg.turf && cfg.turf.summerIntent) || 'transition',
                            baseIsC4: isC4
                        };
                        const normals = await CN.resolveFor(lat, lon);
                        const t = normals && normals.monthlyTemps;
                        rec.temps = t ? [1,2,3,4,5,6,7,8,9,10,11,12].map((m) => t[m]) : null;
                        const gp = rec.temps
                            ? NC.calculateMonthlyGP(rec.temps, isC4, overseedConfig, lat < 0 ? 'south' : 'north')
                            : null;
                        rec.gp = gp ? gp.map((v) => (v == null ? null : Math.round(v <= 1 ? v * 100 : v))) : null;
                    } catch (e) {
                        rec.error = String((e && e.message) || e).slice(0, 160);
                    }
                    out[id] = rec;
                }
                return out;
            }, { ids: [OTHER_SITE.id, SAMPLE_SITE.id, THIRD_SITE.id] });

            // What the page said its site was at the moment the export began —
            // recorded rather than assumed, because the whole scenario rests
            // on it being the OTHER site.
            activeDuringExport = await page.evaluate(() =>
                (window.GAIP_SampleManager && window.GAIP_SampleManager.getActiveSiteId()) || null);

            const [download] = await Promise.all([
                page.waitForEvent('download', { timeout: 180000 }),
                page.locator('button:has-text("Generate & Download")').last().click()
            ]);
            docxPath = path.join(os.tmpdir(), 'gilba-gh468-' + Date.now() + '.docx');
            await download.saveAs(docxPath);
            gpSeries = monthlyGpFrom(docxPath);
            text = documentTextFrom(docxPath);
            slices = reportSlices(documentXmlFrom(docxPath));
            speciesBySite = await page.evaluate(async ({ ids }) => {
                const r = await fetch('/api/sites', { headers: { Accept: 'application/json' }, credentials: 'same-origin' });
                const j = await r.json();
                const out = {};
                (j.data || []).forEach((row) => {
                    if (ids.indexOf(row.id) < 0) return;
                    const cfg = (row.configs && row.configs.gaip && row.configs.gaip.config) || {};
                    out[row.id] = { name: row.name, species: (cfg.turf && cfg.turf.species) || null };
                });
                return out;
            }, { ids: [OTHER_SITE.id, SAMPLE_SITE.id, THIRD_SITE.id] });
        });

        afterAll(async () => {
            try {
                if (page && previousActiveSiteId) await setActiveSite(previousActiveSiteId);
            } catch (e) { /* best effort */ }
            if (browser) await browser.close();
            // GILBA_KEEP_DOCX=1 leaves the combined document on disk, for
            // reading a slice by hand when a boundary has to be measured
            // rather than argued about.
            if (docxPath && fs.existsSync(docxPath) && process.env.GILBA_KEEP_DOCX !== '1') {
                fs.unlinkSync(docxPath);
            } else if (docxPath) {
                process.stdout.write('[e2e] S7 document kept at ' + docxPath + '\n');
            }
        });

        // GH-497: the discriminator for this scenario. jest prints a failing
        // test's full name, so which assertion went red says whether the cause
        // was somebody else's host or our own arithmetic.
        test('every external source this run depends on answered', () => {
            external.print('S7');
            expect({ failedHosts: external.failedHosts(), firstFailures: external.failures().slice(0, 3) })
                .toEqual({ failedHosts: [], firstFailures: [] });
        });

        test('the page really was pointing at the other site when the export ran', () => {
            // If this ever stops being true the rest of S7 proves nothing, so
            // it is asserted rather than trusted.
            process.stdout.write('[e2e] S7 page pointed at: ' + activeDuringExport + ' (' + OTHER_SITE.name + ')\n');
            expect(activeDuringExport).toBe(OTHER_SITE.id);
        });

        test('the document is two reports, and each slice is one of them', () => {
            // GH-491: the unit every assertion below is about. Named first,
            // because a slice that does not exist would make each of them pass
            // vacuously.
            process.stdout.write('[e2e] S7 slices: ' + JSON.stringify(
                slices.map((r) => 'Report ' + r.n + ' of ' + r.of + ' — ' + r.header)) + '\n');
            expect(slices.length).toBe(3);
            slices.forEach((r) => expect(r.of).toBe(3));
            expect(slices.map((r) => r.n)).toEqual([1, 2, 3]);
            // Each slice's header names one of the three sites, and not the
            // same one twice.
            const named = slices.map((r) => Object.keys(speciesBySite)
                .filter((id) => r.header.indexOf(speciesBySite[id].name) === 0)[0]);
            expect(named.filter((id) => !!id).length).toBe(3);
            expect(new Set(named).size).toBe(3);
            // GH-493: and the report standing LAST — the one whose slice has no
            // right-hand boundary and therefore cannot be asserted — is the
            // third site, the one added for that job. If the export's own order
            // ever changes, this fails rather than quietly leaving one of the
            // two reports this scenario is about unasserted.
            expect([slices[2].header, named[2]]).toEqual([slices[2].header, THIRD_SITE.id]);
        });

        test('each report states its own site, in its own Site Information', () => {
            // The report's own identity statement, not "the name appears
            // somewhere in the document": the Site row of the Site Information
            // table inside this report's slice.
            slices.forEach((r) => {
                const siteId = Object.keys(speciesBySite)
                    .filter((id) => r.header.indexOf(speciesBySite[id].name) === 0)[0];
                const own = speciesBySite[siteId];
                const info = siteInformationIn(r.blocks);
                process.stdout.write('[e2e] S7 report ' + r.n + ' Site Information says: '
                    + JSON.stringify(info && { Site: info.Site, Species: info.Species }) + '\n');
                expect([r.n, info && info.Site]).toEqual([r.n, own.name]);
            });
        });

        test('each report names its own site\'s species, inside its own report', () => {
            // If either report takes its identity from the page rather than
            // from its own entry, the species inside that report's slice is
            // the other site's. Read per slice, and from the report's own
            // Site Information row: both species appear SOMEWHERE in a
            // two-report document whatever went wrong.
            slices.forEach((r) => {
                const siteId = Object.keys(speciesBySite)
                    .filter((id) => r.header.indexOf(speciesBySite[id].name) === 0)[0];
                const own = speciesBySite[siteId];
                const info = siteInformationIn(r.blocks);
                expect([own.name, info && info.Species]).toEqual([own.name, own.species]);
            });
            // and no two reports state the same species, so "each names its
            // own" is a claim with a difference behind it.
            const stated = slices.map((r) => (siteInformationIn(r.blocks) || {}).Species);
            expect(new Set(stated).size).toBe(3);
        });

        test('the last slice runs past its report, and it is said where', () => {
            // Named rather than left implicit: the boundary between two
            // reports is the `Report n of m` marker, and for the LAST report
            // there is no next marker, so its slice ends at the end of the
            // body — the facility-wide sections the combined export appends
            // after the loop (its own Annual Nutrient Requirements, the
            // per-site Fertiliser Purchasing Summaries, References, Glossary)
            // fall inside it. Every assertion above is therefore read from a
            // block that the tail cannot supply: the report's own Site
            // Information table, and a table whose header row says Month | GP%.
            const last = slices[slices.length - 1];
            const others = Object.keys(speciesBySite)
                .filter((id) => last.header.indexOf(speciesBySite[id].name) !== 0)
                .map((id) => speciesBySite[id].name);
            others.forEach((name) => {
                const hits = last.blocks.filter((b) => blockText(b).indexOf(name) >= 0);
                process.stdout.write('[e2e] S7 last slice also names "' + name + '" in '
                    + hits.length + ' block(s)'
                    + (hits.length ? ', first at index ' + last.blocks.indexOf(hits[0])
                        + ' of ' + last.blocks.length + ': '
                        + JSON.stringify(blockText(hits[0]).slice(0, 90)) : '') + '\n');
            });
            // The tail is only in the last slice: an earlier report's slice is
            // bounded on both sides by markers and holds its report alone.
            slices.slice(0, -1).forEach((r) => {
                const foreign = Object.keys(speciesBySite)
                    .filter((id) => r.header.indexOf(speciesBySite[id].name) !== 0)
                    .map((id) => speciesBySite[id].name)
                    .filter((name) => r.blocks.some((b) => blockText(b).indexOf(name) >= 0));
                expect([r.n, foreign]).toEqual([r.n, []]);
            });
        });

        test('each report prints ITS OWN monthly programme, not the first one in the file', () => {
            // The reviewer's finding, closed: this used to read one GP column
            // for the whole document. With Christchurch's climate off, Russley
            // printed no programme at all, Test5's table became the first in
            // the file, and the assertion passed on Auckland's column.
            slices.forEach((r) => {
                const tables = monthlyScheduleTables(r.blocks);
                process.stdout.write('[e2e] S7 report ' + r.n + ' (' + r.header + ') Monthly Schedule GP: '
                    + JSON.stringify(tables[0] || null) + (tables.length > 1 ? ' [' + tables.length + ' tables]' : '') + '\n');
                // At most one — the bound on the last slice is the end of the
                // body, so a facility-wide month table appearing there would
                // show up here rather than be read as this report's.
                expect([r.n, tables.length]).toEqual([r.n, 1]);
                expect([r.n, tables[0].filter((v) => v === null)]).toEqual([r.n, []]);
            });
        });

        test('each report\'s GP column is its OWN site\'s series, and a swap is caught', () => {
            // GH-493. What stood here asserted that the two columns DIFFER
            // (`new Set(columns).size === 2`). Difference is not ownership:
            // exchanging the two reports' columns leaves them just as
            // different, and that assertion stayed green. Each column is now
            // compared with the series its own site's data produces.
            //
            // WHERE THE EXPECTED SERIES COMES FROM, and why it is not the
            // document: it is computed in the page before the export, from the
            // site ROW's latitude and longitude through the product's climate
            // service, and turned into a curve by the calendar's own
            // `calculateMonthlyGP` with that site's C4/overseed answer. For
            // Test5 there is a second, fully independent witness in the same
            // run: GH-460 above compares the same twelve numbers with the
            // programme SAVED IN THE DATABASE, read back through the API.
            // Russley and Westview have no saved programme (measured: their
            // `nutritionCalendarProgram` is absent), so for them the site's own
            // coordinates are the outside source.
            const byId = {};
            slices.forEach((r) => {
                const id = Object.keys(speciesBySite)
                    .filter((k) => r.header.indexOf(speciesBySite[k].name) === 0)[0];
                byId[id] = monthlyScheduleTables(r.blocks)[0];
            });
            Object.keys(expectedGp).forEach((id) => {
                const e = expectedGp[id];
                process.stdout.write('[e2e] S7 ' + speciesBySite[id].name + ' expected GP (from its own row '
                    + e.lat + ',' + e.lon + ', species ' + JSON.stringify(e.species)
                    + ', isC4=' + e.isC4 + ', overseed=' + e.overseed + '): '
                    + JSON.stringify(e.gp) + '\n');
                process.stdout.write('[e2e] S7 ' + speciesBySite[id].name + ' printed  GP: '
                    + JSON.stringify(byId[id]) + '\n');
            });
            // positive control: the expected series exist at all, and they are
            // three different curves.
            Object.keys(expectedGp).forEach((id) => {
                expect([speciesBySite[id].name, expectedGp[id].error]).toEqual([speciesBySite[id].name, undefined]);
                expect([speciesBySite[id].name, expectedGp[id].classifierMissing])
                    .toEqual([speciesBySite[id].name, undefined]);
                // The precondition this expectation rests on: none of the three
                // swards is overseeded, so each runs one curve rather than a
                // blend of two.
                expect([speciesBySite[id].name, expectedGp[id].overseed])
                    .toEqual([speciesBySite[id].name, false]);
                expect([speciesBySite[id].name, (expectedGp[id].gp || []).length])
                    .toEqual([speciesBySite[id].name, 12]);
            });
            expect(new Set(Object.keys(expectedGp).map((id) => JSON.stringify(expectedGp[id].gp))).size).toBe(3);

            // The claim itself, report by report. One percentage point of
            // tolerance, the same GH-460 allows for rounding either side.
            const off = (printed, expected) => printed.map((v, i) => ({
                month: MONTHS[i], printed: v, expected: expected[i]
            })).filter((x) => x.expected == null || x.printed == null
                || Math.abs(x.printed - x.expected) > 1);
            Object.keys(expectedGp).forEach((id) => {
                expect([speciesBySite[id].name, off(byId[id], expectedGp[id].gp)])
                    .toEqual([speciesBySite[id].name, []]);
            });

            // THE RED PROOF, carried in the file rather than run once by hand:
            // exchange two reports' columns and show what each criterion says.
            // The old one cannot tell the difference; this one can.
            const ids = Object.keys(expectedGp);
            const swapped = {};
            ids.forEach((id, i) => { swapped[id] = byId[ids[(i + 1) % ids.length]]; });
            const oldCriterion = new Set(ids.map((id) => JSON.stringify(swapped[id]))).size === ids.length;
            const newCriterion = ids.every((id) => off(swapped[id], expectedGp[id].gp).length === 0);
            process.stdout.write('[e2e] S7 columns exchanged between reports — old criterion (columns differ): '
                + (oldCriterion ? 'GREEN' : 'red') + '; new criterion (each is its own site\'s): '
                + (newCriterion ? 'green' : 'RED') + '\n');
            expect({ old: oldCriterion, new: newCriterion }).toEqual({ old: true, new: false });
        });
    });

    /**
     * S7's POSITIVE CONTROL, reached by DATA — no product code is changed and
     * nothing in the checks above is edited.
     *
     * The question a per-report reading has to answer: if one site's monthly
     * programme is NOT printed, does that site's own check go red? The old
     * whole-document reading answered no, twice, and this is the state it
     * answered no in — the reviewer's: Christchurch's climate off, Russley's
     * programme gone, Test5's table first in the file.
     *
     * The climate is switched off the way the product itself decides there is
     * none: `word-export-combined.js` treats a site whose latitude or longitude
     * is missing or zero as `no-coordinates`, and the per-sample calendar then
     * declares the monthly programme uncomputable and skips the table. So the
     * site row is moved to 0/0 through the same API route S9 uses, the export
     * is run, and the row is put back.
     *
     * What is asserted: Russley's own slice holds no Monthly Schedule, Test5's
     * still holds a full one — and, printed beside it, what the whole-document
     * reading returns in this very document, which is Auckland's column under
     * a check that is asking about Christchurch.
     */
    describe('GH-491 S7 positive control — one site loses its programme, and its own check goes red', () => {
        jest.setTimeout(300000);
        let browser, page, docxPath = null, previousActiveSiteId = null, restore = null;
        let slices = null, wholeDocumentGp = null, restoredRow = null;
        let external = null;   // GH-497

        async function csrfPatch(url, body) {
            return page.evaluate(async ({ u, payload }) => {
                const t = document.querySelector('meta[name=csrf-token]');
                const r = await fetch(u, {
                    method: 'PATCH',
                    headers: Object.assign({ 'Content-Type': 'application/json', Accept: 'application/json' },
                        t ? { 'X-CSRF-TOKEN': t.getAttribute('content') } : {}),
                    body: JSON.stringify(payload),
                    credentials: 'same-origin'
                });
                return { status: r.status, body: await r.json().catch(() => null) };
            }, { u: url, payload: body });
        }

        async function siteRow(id) {
            const sites = await page.evaluate(async () => {
                const r = await fetch('/api/sites', { headers: { Accept: 'application/json' }, credentials: 'same-origin' });
                return r.json();
            });
            return { active: sites.active_site_id, row: (sites.data || []).filter((x) => x.id === id)[0] || null };
        }

        beforeAll(async () => {
            if (!chromium) throw new Error('playwright does not resolve from the repo — run `npm install`');
            if (!EMAIL || !PASSWORD) throw new Error('no credentials — see tests/e2e/.e2e-credentials.example.json');
            browser = await chromium.launch();
            const context = await browser.newContext({ acceptDownloads: true, viewport: { width: 1400, height: 1000 } });
            external = await watchExternal(context, BASE_URL);
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

            const before = await siteRow(OTHER_SITE.id);
            previousActiveSiteId = before.active;
            if (!before.row) throw new Error('the control needs site ' + OTHER_SITE.id + ' on this login');
            restore = {
                latitude: before.row.latitude,
                longitude: before.row.longitude,
                location_name: before.row.location_name
            };

            // The data change: no coordinates, which is what the product reads
            // as "no climate for this site".
            await csrfPatch('/api/sites/' + OTHER_SITE.id, {
                latitude: 0, longitude: 0, location_name: restore.location_name
            });
            await csrfPatch('/api/active-site', { site_id: OTHER_SITE.id });

            await page.goto(BASE_URL + '/reports/export', { waitUntil: 'domcontentloaded' });
            await page.waitForFunction(() => !!(window.GilbaNutritionCalendar && window.GAIP_SampleManager),
                null, { timeout: 30000 });
            await page.waitForTimeout(2500);

            await page.click('text=Generate & Download Word');
            await page.waitForSelector('.gaip-bulk-area-backdrop', { timeout: 15000 });
            await page.waitForTimeout(600);
            await page.click('text=Deselect all');
            await page.waitForTimeout(300);
            const picked = await page.evaluate(({ uids }) => {
                const missing = [];
                uids.forEach((uid) => {
                    const cb = document.querySelector('input[data-sample-uid="' + uid + '"]');
                    if (!cb) { missing.push(uid); return; }
                    cb.checked = true;
                    cb.dispatchEvent(new Event('change', { bubbles: true }));
                });
                return { missing: missing, checked: document.querySelectorAll('input[data-sample-uid]:checked').length };
            }, { uids: [OTHER_SAMPLE_UID, SAMPLE_UID] });
            if (picked.missing.length) throw new Error('samples not in the picker: ' + JSON.stringify(picked.missing));
            if (picked.checked !== 2) throw new Error('expected exactly two checked samples, got ' + picked.checked);

            const [download] = await Promise.all([
                page.waitForEvent('download', { timeout: 180000 }),
                page.locator('button:has-text("Generate & Download")').last().click()
            ]);
            docxPath = path.join(os.tmpdir(), 'gilba-gh491-' + Date.now() + '.docx');
            await download.saveAs(docxPath);
            slices = reportSlices(documentXmlFrom(docxPath));
            // The reading this ticket replaces, run on the same document.
            wholeDocumentGp = monthlyGpFrom(docxPath);

            // Put the site back before anything is asserted, so a failing
            // assertion cannot leave the stand moved.
            await csrfPatch('/api/sites/' + OTHER_SITE.id, restore);
            restoredRow = (await siteRow(OTHER_SITE.id)).row;
        });

        afterAll(async () => {
            try {
                if (page && restore) await csrfPatch('/api/sites/' + OTHER_SITE.id, restore);
                if (page && previousActiveSiteId) await csrfPatch('/api/active-site', { site_id: previousActiveSiteId });
            } catch (e) { /* best effort */ }
            if (browser) await browser.close();
            if (docxPath && fs.existsSync(docxPath) && process.env.GILBA_KEEP_DOCX !== '1') fs.unlinkSync(docxPath);
        });

        // GH-497: the discriminator for this scenario. jest prints a failing
        // test's full name, so which assertion went red says whether the cause
        // was somebody else's host or our own arithmetic.
        test('every external source this run depends on answered', () => {
            external.print('S7 positive control');
            expect({ failedHosts: external.failedHosts(), firstFailures: external.failures().slice(0, 3) })
                .toEqual({ failedHosts: [], firstFailures: [] });
        });

        test('the site was put back where it was', () => {
            process.stdout.write('[e2e] S7c site restored to: ' + JSON.stringify(restoredRow && {
                latitude: restoredRow.latitude, longitude: restoredRow.longitude,
                location_name: restoredRow.location_name
            }) + '\n');
            expect(Number(restoredRow.latitude)).toBeCloseTo(Number(restore.latitude), 6);
            expect(Number(restoredRow.longitude)).toBeCloseTo(Number(restore.longitude), 6);
        });

        test('the document still holds both reports', () => {
            process.stdout.write('[e2e] S7c slices: ' + JSON.stringify(
                slices.map((r) => 'Report ' + r.n + ' of ' + r.of + ' — ' + r.header)) + '\n');
            expect(slices.length).toBe(2);
        });

        test('the site with no climate prints no Monthly Schedule of its own', () => {
            const mine = slices.filter((r) => r.header.indexOf(OTHER_SITE.name.split(' (')[0]) === 0)[0];
            expect(mine).toBeDefined();
            const tables = monthlyScheduleTables(mine.blocks);
            process.stdout.write('[e2e] S7c ' + mine.header + ' Monthly Schedule tables: ' + tables.length + '\n');
            // This is the red the per-report reading gives: the assertion in
            // S7 above requires exactly one, and here there is none.
            expect(tables.length).toBe(0);
        });

        test('the other site still prints its own, in full', () => {
            const other = slices.filter((r) => r.header.indexOf(SAMPLE_SITE.name.split(' (')[0]) === 0)[0];
            expect(other).toBeDefined();
            const tables = monthlyScheduleTables(other.blocks);
            process.stdout.write('[e2e] S7c ' + other.header + ' Monthly Schedule GP: '
                + JSON.stringify(tables[0] || null) + '\n');
            expect(tables.length).toBe(1);
            expect(tables[0].filter((v) => v === null)).toEqual([]);
        });

        test('and the whole-document reading answers about the wrong site, which is why it is gone', () => {
            // The measurement this ticket exists for. The old reader takes the
            // first month-keyed table in the file; with Christchurch's
            // programme missing, that table is Auckland's — so a check asking
            // about Christchurch was handed Auckland's column and passed.
            const other = slices.filter((r) => r.header.indexOf(SAMPLE_SITE.name.split(' (')[0]) === 0)[0];
            const auckland = monthlyScheduleTables(other.blocks)[0];
            process.stdout.write('[e2e] S7c whole-document GP: ' + JSON.stringify(wholeDocumentGp) + '\n');
            process.stdout.write('[e2e] S7c that column belongs to: ' + other.header + '\n');
            expect(wholeDocumentGp.filter((v) => v === null)).toEqual([]);
            expect(wholeDocumentGp).toEqual(auckland);
        });
    });

    /**
     * S8 (PLAN-GH439 section 10.6, eighth refinement) — the sample manager
     * refuses the switch, and nothing is printed against the site the page is
     * still on.
     *
     * `setActiveSite()` returns false for a site it does not know and leaves
     * the pointer where it was (sample-manager.js:2443). The combined loop
     * ignored the answer, so the rest of that iteration ran against the
     * previous sample's site — the trigger that made a stale `isC4` reach a
     * client's document with the right name and species over the wrong curve.
     *
     * The refusal is induced here rather than waited for: the page's own
     * setActiveSite is replaced with one that refuses the sample's site and
     * answers truthfully for every other. What is asserted is the outcome the
     * amendment allows — the sample is skipped and said so — and the one it
     * forbids: the other site's curve under this sample's name.
     */
    describe('GH-469 S8 — a refused site switch skips the sample, it does not borrow a site', () => {
        jest.setTimeout(300000);
        let browser, page, docxPath = null, previousActiveSiteId = null;
        let external = null;   // GH-497
        let text = null, warnings = [], gpSeries = null, downloaded = false;

        async function setActiveSite(id) {
            await page.evaluate(async ({ siteId }) => {
                const t = document.querySelector('meta[name=csrf-token]');
                await fetch('/api/active-site', {
                    method: 'PATCH',
                    headers: Object.assign({ 'Content-Type': 'application/json', Accept: 'application/json' },
                        t ? { 'X-CSRF-TOKEN': t.getAttribute('content') } : {}),
                    body: JSON.stringify({ site_id: siteId }),
                    credentials: 'same-origin'
                });
            }, { siteId: id });
        }

        beforeAll(async () => {
            if (!chromium) throw new Error('playwright does not resolve from the repo — run `npm install`');
            if (!EMAIL || !PASSWORD) throw new Error('no credentials — see tests/e2e/.e2e-credentials.example.json');
            browser = await chromium.launch();
            const context = await browser.newContext({ acceptDownloads: true, viewport: { width: 1400, height: 1000 } });
            external = await watchExternal(context, BASE_URL);
            page = await context.newPage();
            page.on('console', (m) => { if (m.type() === 'warning') warnings.push(m.text()); });
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

            await setActiveSite(OTHER_SITE.id);
            await page.goto(BASE_URL + '/reports/export', { waitUntil: 'domcontentloaded' });
            await page.waitForFunction(() => !!(window.GilbaNutritionCalendar && window.GAIP_SampleManager),
                null, { timeout: 30000 });
            await page.waitForTimeout(2500);

            // The refusal, induced on the page's own manager.
            await page.evaluate(({ refuseSiteId }) => {
                const sm = window.GAIP_SampleManager;
                const original = sm.setActiveSite.bind(sm);
                window.__gh469Refused = [];
                sm.setActiveSite = function (id) {
                    if (id === refuseSiteId) { window.__gh469Refused.push(id); return false; }
                    return original(id);
                };
            }, { refuseSiteId: SAMPLE_SITE.id });

            await page.click('text=Generate & Download Word');
            await page.waitForSelector('.gaip-bulk-area-backdrop', { timeout: 15000 });
            await page.waitForTimeout(600);
            await page.click('text=Deselect all');
            await page.waitForTimeout(300);
            const picked = await page.evaluate(({ uid }) => {
                const cb = document.querySelector('input[data-sample-uid="' + uid + '"]');
                if (!cb) return { found: false };
                cb.checked = true;
                cb.dispatchEvent(new Event('change', { bubbles: true }));
                return { found: true };
            }, { uid: SAMPLE_UID });
            if (!picked.found) throw new Error('sample not in the picker');

            try {
                const [download] = await Promise.all([
                    page.waitForEvent('download', { timeout: 90000 }),
                    page.locator('button:has-text("Generate & Download")').last().click()
                ]);
                docxPath = path.join(os.tmpdir(), 'gilba-gh469-' + Date.now() + '.docx');
                await download.saveAs(docxPath);
                downloaded = true;
                text = documentTextFrom(docxPath);
                gpSeries = monthlyGpFrom(docxPath);
            } catch (e) {
                // No document at all is a legitimate outcome when the only
                // sample asked for was skipped. It is recorded, not treated as
                // a failure of the run.
                downloaded = false;
            }
        });

        afterAll(async () => {
            try {
                if (page && previousActiveSiteId) await setActiveSite(previousActiveSiteId);
            } catch (e) { /* best effort */ }
            if (browser) await browser.close();
            if (docxPath && fs.existsSync(docxPath)) fs.unlinkSync(docxPath);
        });

        // GH-497: the discriminator for this scenario. jest prints a failing
        // test's full name, so which assertion went red says whether the cause
        // was somebody else's host or our own arithmetic.
        test('every external source this run depends on answered', () => {
            external.print('S8');
            expect({ failedHosts: external.failedHosts(), firstFailures: external.failures().slice(0, 3) })
                .toEqual({ failedHosts: [], firstFailures: [] });
        });

        test('the switch really was refused', async () => {
            const refused = await page.evaluate(() => window.__gh469Refused || []);
            process.stdout.write('[e2e] S8 refusals seen by the page: ' + JSON.stringify(refused) + '\n');
            expect(refused.length).toBeGreaterThan(0);
        });

        test('the export says it skipped the sample rather than printing it', () => {
            const said = warnings.filter((w) => /GH-469/.test(w) && /refused to switch/.test(w));
            process.stdout.write('[e2e] S8 document produced: ' + downloaded +
                '; skip warnings: ' + said.length + '\n');
            expect(said.length).toBeGreaterThan(0);
        });

        test('nothing carries the other site\'s curve', () => {
            // The forbidden outcome, stated as a value: if a document exists at
            // all, it must not hold the Christchurch site's growth curve — that
            // is the number a client would have read under the Auckland site's
            // name.
            if (!downloaded) {
                process.stdout.write('[e2e] S8 no document was produced — the sample was skipped\n');
                expect(downloaded).toBe(false);
                return;
            }
            process.stdout.write('[e2e] S8 GP column printed: ' + JSON.stringify(gpSeries) + '\n');
            const isOtherSiteCurve = JSON.stringify(gpSeries) === JSON.stringify([90, 87, 67, 34, 14, 5, 4, 6, 13, 25, 47, 75]);
            expect({ borrowedTheOtherSitesCurve: isOtherSiteCurve }).toEqual({ borrowedTheOtherSitesCurve: false });
        });
    });

    /**
     * S9 (PLAN-GH439 section 10.6, thirteenth refinement) — a site that moves
     * between countries gets the new country's catalogue.
     *
     * Three regional integrations decide which recommender and which product
     * list a client is given from the site's coordinates, and they took them
     * from `config.location` — a copy written by whichever client last saved a
     * config. `PATCH /api/sites/{id}` moves a site by writing the columns, and
     * it did not touch the copy, so the catalogue stayed behind. The copy is
     * derived from the columns by the server now, and the readers ask the
     * owner directly; this checks both from the outside.
     *
     * The site is moved and moved back, so the stand is left as it was found.
     */
    describe('GH-474 S9 — a site moved from Australia to New Zealand gets the NZ catalogue', () => {
        jest.setTimeout(300000);
        let browser, page, previousActiveSiteId = null, restore = null;
        let external = null;   // GH-497
        let beforeMove = null, afterMove = null;

        async function csrfPatch(path, body) {
            return page.evaluate(async ({ url, payload }) => {
                const t = document.querySelector('meta[name=csrf-token]');
                const r = await fetch(url, {
                    method: 'PATCH',
                    headers: Object.assign({ 'Content-Type': 'application/json', Accept: 'application/json' },
                        t ? { 'X-CSRF-TOKEN': t.getAttribute('content') } : {}),
                    body: JSON.stringify(payload),
                    credentials: 'same-origin'
                });
                return { status: r.status, body: await r.json().catch(() => null) };
            }, { url: path, payload: body });
        }

        /**
         * What the page decides about the region, after a fresh load ON THIS
         * SITE.
         *
         * Measured the hard way first: asking `isNZ()` while the page was on a
         * different site answered about THAT site — the function consults the
         * page's own region, its state and its saved location before it ever
         * reaches the site row. It is a question about the page, so the page
         * has to be on the site being asked about.
         */
        async function regionVerdict() {
            await csrfPatch('/api/active-site', { site_id: MOVING_SITE.id });
            await page.goto(BASE_URL + '/reports/export', { waitUntil: 'domcontentloaded' });
            await page.waitForFunction(() => !!(window.GAIP_SiteConfig
                && window.NutritionNzFertiliserIntegration), null, { timeout: 30000 });
            await page.waitForTimeout(4000);
            return page.evaluate(({ siteId }) => {
                const SC = window.GAIP_SiteConfig;
                const row = SC && SC.getSite ? SC.getSite(siteId) : null;
                const cfg = SC && SC.getConfig ? SC.getConfig(siteId) : null;
                const rp = window.GAIP_RegionalProfiles;
                const latEl = document.querySelector('.gaip-lat');
                return {
                    isNZ: window.NutritionNzFertiliserIntegration.isNZ(),
                    // Which link of isNZ()'s chain answered, measured rather
                    // than assumed.
                    // GH-476: by site id, from the site's own coordinates.
                    regionForSite: rp && rp.detectRegionForSite ? rp.detectRegionForSite(siteId) : null,
                    domLat: latEl ? latEl.value : '(no .gaip-lat on the page)',
                    stateRegion: (window.GAIP_STATE && window.GAIP_STATE.region) || null,
                    savedLat: (window.GAIP_HUB_CONFIG && window.GAIP_HUB_CONFIG.savedLocation
                        && window.GAIP_HUB_CONFIG.savedLocation.lat) || null,
                    rowLat: row ? Number(row.latitude) : null,
                    rowLon: row ? Number(row.longitude) : null,
                    copyLat: cfg && cfg.location ? Number(cfg.location.lat) : null,
                    copyLon: cfg && cfg.location ? Number(cfg.location.lon) : null
                };
            }, { siteId: MOVING_SITE.id });
        }

        beforeAll(async () => {
            if (!chromium) throw new Error('playwright does not resolve from the repo — run `npm install`');
            if (!EMAIL || !PASSWORD) throw new Error('no credentials — see tests/e2e/.e2e-credentials.example.json');
            browser = await chromium.launch();
            const context = await browser.newContext({ viewport: { width: 1400, height: 1000 } });
            external = await watchExternal(context, BASE_URL);
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
            const row = (sites.data || []).filter((s) => s.id === MOVING_SITE.id)[0];
            if (!row) throw new Error('S9 needs site ' + MOVING_SITE.id + ' on this login');
            restore = {
                latitude: row.latitude, longitude: row.longitude, location_name: row.location_name
            };

            // Put it firmly in Australia first, whatever it was.
            await csrfPatch('/api/sites/' + MOVING_SITE.id, {
                latitude: -33.8688, longitude: 151.2093, location_name: 'Sydney, NSW'
            });
            beforeMove = await regionVerdict();

            // And move it to New Zealand, through the route that owns the
            // coordinates and touches no config.
            await csrfPatch('/api/sites/' + MOVING_SITE.id, {
                latitude: -36.8508827, longitude: 174.7644881, location_name: 'Auckland, New Zealand'
            });
            afterMove = await regionVerdict();
        });

        afterAll(async () => {
            try {
                if (page && restore) await csrfPatch('/api/sites/' + MOVING_SITE.id, restore);
                if (page && previousActiveSiteId) {
                    await csrfPatch('/api/active-site', { site_id: previousActiveSiteId });
                }
            } catch (e) { /* best effort */ }
            if (browser) await browser.close();
        });

        // GH-497: the discriminator for this scenario. jest prints a failing
        // test's full name, so which assertion went red says whether the cause
        // was somebody else's host or our own arithmetic.
        test('every external source this run depends on answered', () => {
            external.print('S9');
            expect({ failedHosts: external.failedHosts(), firstFailures: external.failures().slice(0, 3) })
                .toEqual({ failedHosts: [], firstFailures: [] });
        });

        test('the site row follows the move', () => {
            process.stdout.write('[e2e] S9 before the move: ' + JSON.stringify(beforeMove) + '\n');
            process.stdout.write('[e2e] S9 after the move:  ' + JSON.stringify(afterMove) + '\n');
            expect(beforeMove.rowLat).toBeCloseTo(-33.8688, 4);
            expect(afterMove.rowLat).toBeCloseTo(-36.8508827, 4);
        });

        test('the copy the old readers use is derived from the columns, without any config being saved', () => {
            // The part GH-474 fixed: nothing on the page wrote a config, and
            // the copy moved with the columns anyway.
            expect(afterMove.copyLat).toBeCloseTo(afterMove.rowLat, 4);
            expect(afterMove.copyLon).toBeCloseTo(afterMove.rowLon, 4);
            expect(Number(afterMove.savedLat)).toBeCloseTo(afterMove.rowLat, 4);
        });

        /**
         * GH-476 — these two were `PINNED, not approved` and are now
         * assertions.
         *
         * What they pinned, on this stand, after the move: the row, the copy
         * and the server's injection all said Auckland while `.gaip-lat` still
         * said −33.8688, `detectRegionFromHub()` answered
         * 'australia_temperate' and `isNZ()` was false — a client offered the
         * old country's products. The pins existed so that the day the chain
         * was fixed they would go red and somebody would update them
         * deliberately instead of finding them already green. That day is
         * this one.
         *
         * What changed in the expectation, exactly:
         *   - `detectRegionFromHub` is gone, so the pin naming it is gone with
         *     it; the region is asked for by site id.
         *   - the DOM field is no longer asked, so what it holds is no longer
         *     part of the answer — it is still recorded, because it is what
         *     made the old answer wrong and its presence is the point.
         *   - `isNZ()` was pinned `false` after a move to New Zealand; it is
         *     asserted `true`.
         */
        test('after the move the region is New Zealand — asked by site id', () => {
            process.stdout.write('[e2e] S9 after the move, DOM still holds: ' + afterMove.domLat + '\n');
            expect(afterMove.regionForSite).toBe('new_zealand');
        });

        test('so the catalogue follows the site', () => {
            expect(afterMove.isNZ).toBe(true);
            expect(beforeMove.isNZ).toBe(false);
        });

        test('and the page\'s own coordinate field is not what answered', () => {
            // It still holds the previous site's number, and the answer is
            // right anyway. That is the whole difference.
            expect(afterMove.domLat).toBe('-33.8688');
            expect(afterMove.rowLat).toBeCloseTo(-36.8508827, 4);
        });

    });
}
/**
 * GH-490 — a MEASUREMENT on the live stack, not a guard.
 *
 * HOW IT IS READ, stated because it decides whether the numbers mean anything:
 * ONE DOCUMENT PER SITE. For each live site the export is collected and built
 * separately (`collectData(inputs-for-that-site)` → `buildSections` → a .docx of
 * its own), and every string search runs against THAT site's own
 * `word/document.xml`. Nothing is searched "in the document" across sites, so a
 * first match cannot be another site's report. The combined export, which puts
 * all sites in one file, is not used here.
 *
 * What it answers: after GH-490, does each site's report carry the readings of
 * its OWN soil record and nothing else, and do the sites with no record say so?
 *
 * It asserts only that the measurement was taken; the numbers are printed.
 *
 * Run: GILBA_E2E=1 npx jest tests/e2e/gh490-soil-by-id-live.test.js --verbose
 */

'use strict';

const fs = require('fs');
const path = require('path');
const { execFileSync } = require('child_process');

let chromium = null;
try { ({ chromium } = require('playwright')); } catch (e) { /* reported below */ }

const ENABLED = process.env.GILBA_E2E === '1';
const OUT = process.env.GILBA_GH490_OUT || '/tmp/gilba-pw-test/gh490-soil-by-id.json';

const credentials = (() => {
    try { return JSON.parse(fs.readFileSync(path.join(__dirname, '.e2e-credentials.json'), 'utf8')); }
    catch (e) { return {}; }
})();
const BASE_URL = process.env.GILBA_E2E_URL || credentials.url || 'http://127.0.0.1:8080';

/** The soil records the database holds, per site — the other end of the chain. */
function soilRowsFromDatabase() {
    const sql = `
      SELECT JSON_ARRAYAGG(JSON_OBJECT(
        'id', s.id, 'site_id', s.site_id, 'client_uid', s.client_uid,
        'sample_date', s.sample_date, 'payload', s.payload
      )) FROM samples s
      WHERE s.sample_type = 'soil' AND s.deleted_at IS NULL;`;
    const raw = execFileSync('docker', ['exec', 'gilba_mysql', 'mysql', '-ugilba', '-pgilba_secret', 'gilba',
        '-N', '-B', '-e', sql], { encoding: 'utf8', maxBuffer: 64 * 1024 * 1024 });
    const json = raw.split('\n').filter((l) => l.trim().startsWith('[')).pop();
    return json ? JSON.parse(json) : [];
}

if (!ENABLED) {
    describe('GH-490 — soil readings by id, live (disabled)', () => {
        test.skip('needs the live stack', () => {});
    });
} else {
    describe('GH-490 — every report\'s soil numbers are its own record\'s', () => {
        jest.setTimeout(900000);
        let live, dbSoil, browser;

        beforeAll(async () => {
            dbSoil = soilRowsFromDatabase();
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
                const out = [];
                for (const row of SM.getSiteList()) {
                    const rec = { id: row.id, name: row.label };
                    try {
                        const inputs = NPI.resolveExportInputs({ siteId: row.id });
                        const sample = inputs.samples ? inputs.samples.soil : null;
                        const store = ((all.allSites || {})[row.id] || {}).soil || {};
                        rec.onFile = Object.keys(store).length;
                        rec.chosenId = sample ? (sample.id || null) : null;
                        rec.recordReadings = sample ? SM.readingsOf('soil', sample) : null;
                        const data = WE.collectData(inputs);
                        rec.state = data.soil.state;
                        rec.recordKey = data.soil.recordKey;
                        rec.sampleLabel = data.soil.sampleLabel;
                        rec.testDate = data.soil.testDate;
                        rec.collected = {};
                        (SM.readingKeysFor('soil') || []).forEach((k) => {
                            if (data.soil[k] !== undefined) rec.collected[k] = data.soil[k];
                        });
                        rec.availability = (data.availability || [])
                            .filter((e) => (e.sections || []).indexOf('Soil Nutrition') >= 0)
                            .map((e) => e.field);
                        // THIS site's own document, built on its own.
                        const sections = WE.buildSections(data, {});
                        const doc = new window.docx.Document({ sections: [{ properties: {}, children: sections }] });
                        const blob = await window.docx.Packer.toBlob(doc);
                        const zip = await window.JSZip.loadAsync(await blob.arrayBuffer());
                        const xml = await zip.file('word/document.xml').async('string');
                        rec.text = xml.replace(/<\/w:p>/g, '\n').replace(/<\/w:tc>/g, '\t')
                            .replace(/<[^>]+>/g, '').replace(/&amp;/g, '&');
                        // The raw paragraphs, so a report can QUOTE the
                        // document rather than describe it: the registry row's
                        // first cell and the "Not included:" paragraph, taken
                        // out of this site's own word/document.xml.
                        rec.xmlQuotes = [];
                        ['Soil readings', 'Not included: soil readings'].forEach(function (needle) {
                            var at = xml.indexOf(needle);
                            if (at < 0) return;
                            var from = xml.lastIndexOf('<w:p ', at);
                            if (from < 0) from = xml.lastIndexOf('<w:p>', at);
                            var to = xml.indexOf('</w:p>', at);
                            if (from >= 0 && to > from) rec.xmlQuotes.push(xml.slice(from, to + 6));
                        });
                    } catch (e) {
                        rec.error = String((e && e.message) || e).slice(0, 200);
                    }
                    out.push(rec);
                }
                return out;
            });
            await browser.close();
            browser = null;
            fs.mkdirSync(path.dirname(OUT), { recursive: true });
            fs.writeFileSync(OUT, JSON.stringify({ dbSoil: dbSoil, live: live }, null, 1));
        });

        afterAll(async () => { if (browser) await browser.close(); });

        test('every site was measured on its own document, and the table is printed', () => {
            expect(Array.isArray(live)).toBe(true);
            expect(live.length).toBeGreaterThan(0);

            // The readings each site's own record carries, keyed by site.
            const readingsBySite = {};
            live.forEach((l) => { readingsBySite[l.id] = l.recordReadings || {}; });

            const lines = [];
            lines.push('');
            lines.push('GH-490 — one document per site; every search below runs on that site\'s own document.');
            lines.push('soil records in the database: ' + dbSoil.length + ' over '
                + new Set(dbSoil.map((r) => r.site_id)).size + ' sites');
            lines.push('');
            lines.push(['site', 'onFile', 'state', 'record', 'readings', 'printed in ppm rows',
                'registry row', 'foreign numbers'].join(' | '));

            const foreignEverywhere = [];
            live.forEach((l) => {
                const text = l.text || '';
                const own = l.recordReadings || {};
                const ownVals = Object.keys(own).map((k) => own[k]);
                // A ppm row is "<name> (X)\t<value> ppm" in the soil table.
                const ppmRows = (text.match(/\n\t?[^\n\t]*\([A-Za-z]{1,3}\)\n?\t?[\d.]+ ppm/g) || [])
                    .map((s) => s.replace(/\s+/g, ' ').trim());
                // Numbers belonging to ANOTHER site's record and not to this one.
                const foreign = [];
                Object.keys(readingsBySite).forEach((sid) => {
                    if (sid === l.id) return;
                    const other = readingsBySite[sid];
                    Object.keys(other).forEach((k) => {
                        const v = other[k];
                        if (ownVals.indexOf(v) >= 0) return;          // ambiguous, not evidence
                        const asPpm = new RegExp('\\n\\t?' + String(v).replace('.', '\\.') + ' ppm');
                        if (asPpm.test(text)) foreign.push(sid.slice(0, 8) + ' ' + k + '=' + v);
                    });
                });
                if (foreign.length) foreignEverywhere.push(l.name + ': ' + foreign.join(', '));
                lines.push([
                    l.name, l.onFile, l.state || '—', l.recordKey || '—',
                    Object.keys(own).length ? Object.keys(own).join(',') : '—',
                    ppmRows.length,
                    (l.availability || []).join(' / ') || '—',
                    foreign.length ? foreign.join(', ') : 'none'
                ].join(' | '));
            });

            lines.push('');
            lines.push('Sites with no soil record: ' + live.filter((l) => l.onFile === 0).length);
            live.filter((l) => l.onFile === 0 || l.state !== 'selected').forEach((l) => {
                const text = l.text || '';
                lines.push('  ' + l.name + ' | soil section printed: '
                    + (/Soil Nutrition \(/.test(text) ? 'YES' : 'no')
                    + ' | registry row: ' + (/Soil readings/.test(text) ? 'YES' : 'no')
                    + ' | not-included paragraph: '
                    + (/Not included: soil readings/.test(text) ? 'YES' : 'no'));
            });
            lines.push('');
            lines.push('Foreign soil numbers found: ' + (foreignEverywhere.length || 'none'));
            foreignEverywhere.forEach((f) => lines.push('  ' + f));
            lines.push('');
            const lost = live.filter((l) => l.state !== 'selected' && (l.xmlQuotes || []).length)[0];
            if (lost) {
                lines.push('');
                lines.push('word/document.xml, verbatim, for a site that lost its soil block ('
                    + lost.name + '):');
                lost.xmlQuotes.forEach((q) => lines.push('  ' + q));
            }
            lines.push('');
            lines.push('Saved: ' + OUT);
            process.stdout.write(lines.join('\n') + '\n');

            live.forEach((l) => expect([l.name, l.error]).toEqual([l.name, undefined]));
        });
    });
}

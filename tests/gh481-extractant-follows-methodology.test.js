/**
 * GH-481 — the extractant a report speaks about is the one its site's
 * methodology implies, and a site with no methodology is told nothing.
 *
 * What this closes, measured on the stand before it was written: in one
 * combined export over four sites, `data.soil.extractant` came back `(unset)`
 * for all three that are not on Ammonium Acetate, and the Hill Labs literal
 * for the one that is. Unset, four consumers answer for themselves:
 * `_traceExtractant()` walks its ladder to the last rung and returns
 * 'mehlich3', which chooses the trace-element sufficiency TABLE and its
 * printed caption; two narrative lines print the methodology in the
 * extractant's place; and the soil block prints "Extraction method not
 * specified" in amber.
 *
 * The field's only writer outside the Ammonium Acetate branch had been a read
 * of `.gaip-soil-extractant`, an element no page renders — so the field has
 * been empty for non-AA sites since long before GH-480 removed that read. That
 * was checked rather than assumed: the same live export was run with the
 * pre-GH-480 file in place and produced the same four rows, `(unset)` included.
 *
 * ── Passport ────────────────────────────────────────────────────────────────
 * guarantee   The extractant a report prints, and the trace table it
 *             classifies against, follow the methodology of the site the
 *             report is about.
 * claims      By VALUE: an AA site's report says ammonium acetate and
 *             classifies against the ammonium-acetate ranges; a site on any
 *             other methodology says Mehlich-3 and classifies against the
 *             Mehlich-3 ranges; a site with no methodology at all derives
 *             nothing and keeps the "not specified" notice. Structurally: one
 *             rule, used by both the printed field and the ladder.
 * universe    collectData() and the sections built from it — the border every
 *             printed soil figure passes, reached from both entry points.
 * unit        One report.
 * moment      During collection, per report, after the methodology is
 *             resolved by site id.
 * distinguishability  Two methodologies that choose DIFFERENT tables
 *             ('ammonium_acetate' against 'mlsn'), and a third case with no
 *             methodology at all, so "followed the site" is distinguishable
 *             from "fell to the ladder's last rung" — which for a non-AA site
 *             lands on the same table, and would make a one-case test pass
 *             without meaning anything.
 * carrier     `data.soil.extractant`, the value every one of the four
 *             consumers reads, and the amber "Extraction method not
 *             specified" notice in the finished document, which is the one
 *             rendered sentence that turns on it. The trace chart's own
 *             caption is drawn into an SVG that needs a canvas to become an
 *             image, and the sandbox has none, so the table's choice is held
 *             here by the value the ladder reads plus the structural fact that
 *             the field and the ladder apply one rule; the rendered caption is
 *             the live harness's to see.
 * input       The resolver by site id, which is what both entry points hand
 *             collectData.
 * positive-control  The third case asserts the notice IS printed when the
 *             methodology is unknown; without it, "the notice is gone" would
 *             pass on a document that failed to build its soil block at all.
 * exemptions  None.
 * ratchet     None.
 * rc          The reviewer's mutation: derive nothing (leave the field unset),
 *             or derive 'Mehlich-3' for every methodology including AA.
 * ────────────────────────────────────────────────────────────────────────────
 *
 * Not in scope, and named: what a document should say when the methodology is
 * genuinely unknown is a domain question with the owner. Until she answers,
 * nothing is invented for that case — the field stays empty and the existing
 * notice stands.
 */

'use strict';

const fs = require('fs');
const path = require('path');
const { loadPage, SITE_ID, OTHER_SITE_ID } = require('./helpers/export-page-sandbox');
const { EMPTY } = require('./lib/empty-inputs');

const TRACES = { Fe: 80, Mn: 20, Zn: 4, Cu: 1.2, B: 0.5 };

async function documentText(sandbox, data) {
    const sections = sandbox.GAIP_WordExport.buildSections(data, {});
    const doc = new sandbox.docx.Document({ sections: [{ properties: {}, children: sections }] });
    const blob = await sandbox.docx.Packer.toBlob(doc);
    const zip = await sandbox.JSZip.loadAsync(Buffer.from(await blob.arrayBuffer()));
    const xml = await zip.file('word/document.xml').async('string');
    return xml.replace(/<\/w:p>/g, '\n').replace(/<[^>]+>/g, '').replace(/&amp;/g, '&');
}

describe('GH-481 — the extractant follows the site\'s methodology', () => {
    jest.setTimeout(120000);
    let page, npi, we;

    beforeAll(() => {
        page = loadPage({ errors: [], warnings: [], alerts: [] });
        expect(page.failures).toEqual([]);
        npi = page.sandbox.GAIP_NutritionProgramInputs;
        we = page.sandbox.GAIP_WordExport;
        // Trace readings on both samples, loaded into the page's form the way
        // the product loads them, so the trace section exists at all.
        [SITE_ID, OTHER_SITE_ID].forEach((siteId) => {
            expect(page.sandbox.GAIP_SampleManager.setActiveSite(siteId)).toBe(true);
            const store = page.sandbox.GAIP_SampleManager.getAllSamples().allSites[siteId].soil;
            const id = Object.keys(store)[0];
            const sample = page.sandbox.GAIP_SampleManager.getActiveSample('soil');
            Object.keys(TRACES).forEach((k) => { sample.values[k] = TRACES[k]; });
            expect(page.sandbox.GAIP_SampleManager.loadSample('soil', id).success).toBe(true);
        });
        expect(page.sandbox.GAIP_SampleManager.setActiveSite(SITE_ID)).toBe(true);
        page.sandbox.GAIP_SampleManager.loadSample('soil',
            Object.keys(page.sandbox.GAIP_SampleManager.getAllSamples().allSites[SITE_ID].soil)[0]);
    });

    test('an ammonium-acetate site says so, and its trace table is the ammonium-acetate one', async () => {
        const data = we.collectData(npi.resolveExportInputs({ siteId: SITE_ID }));
        expect(data.soil.methodology).toBe('AMMONIUM_ACETATE');
        // The AA branch owns this field for an AA site and writes the fuller
        // wording; the derivation deliberately declines the case rather than
        // stating the same fact twice. What must not happen is an AA site
        // being told Mehlich-3.
        expect(String(data.soil.extractant).toLowerCase()).toContain('nh\u2084oac');
        expect(String(data.soil.extractant)).not.toContain('Mehlich');
        const text = await documentText(page.sandbox, data);
        expect(text).not.toContain('Extraction method not specified');
    });

    test('a site on another methodology says Mehlich-3, and gets the Mehlich-3 table', async () => {
        const data = we.collectData(npi.resolveExportInputs({ siteId: OTHER_SITE_ID }));
        expect(data.soil.methodology).toBe('MLSN');
        expect(data.soil.extractant).toBe('Mehlich-3');
        const text = await documentText(page.sandbox, data);
        expect(text).not.toContain('Extraction method not specified');
    });

    test('a site with no methodology derives nothing, and keeps the notice', async () => {
        // GH-490: the notice stands inside the Soil Nutrition section, and that
        // section is printed only where there are soil readings to print. Until
        // GH-490 an all-empty input set printed it anyway, because the readings
        // came off the page's form — the defect this ticket removed. The case
        // is therefore built as it actually occurs: a site holding a soil
        // sample, with no methodology resolved anywhere.
        const sm = page.sandbox.GAIP_SampleManager;
        const store = sm.getAllSamples().allSites[SITE_ID].soil;
        const data = we.collectData(Object.assign({}, EMPTY, {
            samples: { soil: store[Object.keys(store)[0]], tissue: null, water: null }
        }));
        expect(data.soil.methodology).toBeNull();
        expect(data.soil.extractant).toBeUndefined();
        const text = await documentText(page.sandbox, data);
        expect(text).toContain('Extraction method not specified');
    });

    test('the printed value and the ladder apply ONE rule, not two', () => {
        const src = fs.readFileSync(path.join(__dirname, '..', 'assets', 'word-export.js'), 'utf8');
        expect(src).toMatch(/function _extractantForMethodology\(methodology\)/);
        // collectData fills the field through it …
        expect(src).toMatch(/_extractantForMethodology\(data\.soil\.methodology\)/);
        // and it declines the case the AA branch owns, rather than stating it
        // twice: measured, the AA branch always runs for an AA site, so a
        // second answer here would be dead code claiming to be a rule.
        const helper = src.slice(src.indexOf('function _extractantForMethodology(methodology)'),
            src.indexOf('function _traceExtractant(soilData)'));
        expect(helper).toMatch(/if \(m\.indexOf\('AMMONIUM'\) >= 0\) return null;/);
        // … and the ladder's own last two rungs are the same two answers
        const ladder = src.slice(src.indexOf('function _traceExtractant(soilData)'), src.indexOf('function _classifyTrace'));
        expect(ladder).toMatch(/if \(meth\.indexOf\('AMMONIUM'\) >= 0\) return 'aa';/);
        expect(ladder).toMatch(/return 'mehlich3';/);
    });
});

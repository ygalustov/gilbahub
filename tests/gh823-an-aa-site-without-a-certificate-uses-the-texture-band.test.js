/**
 * GH-823 (queue item 3dz) — AN AMMONIUM-ACETATE SITE WITHOUT A CERTIFICATE CODE IS JUDGED BY THE TEXTURE BAND.
 *
 * The export stood in the Hill Labs certificate S277 for every AA site whose species and texture derive no
 * certificate, and judged the sample by it -- while the Analysis page judges the same sample by the general band of
 * its soil texture. The owner's decision, variant (a): as the page. Without a code the thresholds are the band the
 * programme inputs already resolved; the S277 stand-in and its "falling back to S277" branch go.
 *
 * The expected bounds are read from `assets/aa-ranges.json` (`bySoilType.sands`), the declaration -- not written here.
 * Not changed and not asserted: the `P = 21` floor where acidity is not measured (a permitted exception).
 */
'use strict';

const fs = require('fs');
const path = require('path');
const { loadPage, SITE_ID } = require('./helpers/export-page-sandbox');
const { documentParts, flatText } = require('./helpers/word-document-reading');

const BANDS = JSON.parse(fs.readFileSync(path.join(__dirname, '../assets/aa-ranges.json'), 'utf8')).bySoilType;
const SAMPLE_155 = { K: 85, P: 18, S: 12, Ca: 820, Mg: 95, CEC: 6 };
const ELEMENTS = ['P', 'K', 'Ca', 'Mg', 'S'];

function say(s) { process.stdout.write(s + '\n'); }

async function build(page, species) {
    page.putSiteMethodology('ammonium_acetate');
    page.putSiteSpecies(species);
    page.putSoilReadings(SAMPLE_155);
    page.putPageProgram(undefined);
    const data = page.sandbox.GAIP_WordExport.collectData(
        page.sandbox.GAIP_NutritionProgramInputs.resolveExportInputs({ siteId: SITE_ID }));
    return data;
}

function rowsOf(data) {
    const out = {};
    ELEMENTS.forEach((n) => {
        const t = (data.soil.thresholds || {})[n];
        const v = data._soilVerdicts && data._soilVerdicts.elements[n];
        out[n] = { min: t ? t.min : null, max: t ? t.max : null, source: t ? (t.source || 'certificate') : null, status: v ? v.status : null };
    });
    return out;
}

/** The band expectation for every element, read from aa-ranges.json. */
function bandRows(texture) {
    return ELEMENTS.map((n) => [n, BANDS[texture][n].lo, BANDS[texture][n].hi, 'texture-band']);
}

describe('GH-823 — an AA site without a certificate code is judged by its texture band', () => {
    jest.setTimeout(300000);
    let page;
    beforeAll(() => {
        page = loadPage({ errors: [], warnings: [], alerts: [] });
        expect(page.failures).toEqual([]);
    });

    test('Creeping Bentgrass on sand (no code): each element bounded and judged by the sands band', async () => {
        const data = await build(page, 'Creeping Bentgrass');
        const got = rowsOf(data);
        const expected = {};
        ELEMENTS.forEach((n) => {
            const b = BANDS.sands[n];
            const value = SAMPLE_155[n];
            expected[n] = { min: b.lo, max: b.hi, status: value < b.lo ? 'apply' : (value > b.hi ? 'high' : 'adequate') };
        });
        say('[gh823] texture ' + JSON.stringify(data.soil.aaSoilTexture) + ', certificate ' + JSON.stringify(data.soil.aaSampleType)
            + ', source ' + JSON.stringify(data.soil.aaSampleTypeSource));
        say('[gh823] rows (element: bound, verdict): ' + JSON.stringify(got));
        say('[gh823] expected from aa-ranges.json sands: ' + JSON.stringify(expected));
        expect({ certificate: data.soil.aaSampleType, source: data.soil.aaSampleTypeSource })
            .toEqual({ certificate: null, source: 'texture-band' });
        // Bounds compared as declared; the verdict compared by side of the band (a deficit may be `apply` or
        // `monitor` by its size, so "below" is asserted as not adequate and not high).
        // Row by row, with its source: a single element bounded by another source is named by its row.
        expect(ELEMENTS.map((n) => [n, got[n].min, got[n].max, got[n].source])).toEqual(bandRows('sands'));
        // The rows the band does not bound have no bound -- asserted, so "no bound" is told from "no row".
        const bounded = Object.keys(data.soil.thresholds).sort();
        say('[gh823] elements bounded for a site without a code: ' + JSON.stringify(bounded));
        expect(bounded).toEqual(ELEMENTS.slice().sort());
        const side = (s) => (s === 'adequate' ? 'within' : s === 'high' ? 'above' : 'below');
        expect(ELEMENTS.map((n) => [n, side(got[n].status)])).toEqual(ELEMENTS.map((n) => [n, side(expected[n].status)]));
    });

    test('the table caption of a site without a code names no certificate', async () => {
        const data = await build(page, 'Creeping Bentgrass');
        const parts = await documentParts(page.sandbox, data);
        const text = flatText(parts);
        const got = { S277: (text.match(/S277/g) || []).length, certificateWords: (text.match(/sample-type sufficiency thresholds applied/g) || []).length };
        say('[gh823] caption of a site without a code: ' + JSON.stringify(got));
        expect(got).toEqual({ S277: 0, certificateWords: 0 });
    });

    test('a code the sample-type table does not know is no certificate: the texture band, not S277', async () => {
        const hl = page.sandbox.HillLabsSampleTypes;
        const derive = hl.deriveCode;
        hl.deriveCode = () => 'S999';
        let data;
        try { data = await build(page, 'Creeping Bentgrass'); } finally { hl.deriveCode = derive; }
        const got = rowsOf(data);
        say('[gh823] unknown code S999: certificate ' + JSON.stringify(data.soil.aaSampleType) + ', source '
            + JSON.stringify(data.soil.aaSampleTypeSource) + ', rows ' + JSON.stringify(got));
        expect({ certificate: data.soil.aaSampleType, source: data.soil.aaSampleTypeSource }).toEqual({ certificate: null, source: 'texture-band' });
        expect(ELEMENTS.map((n) => [n, got[n].min, got[n].max, got[n].source])).toEqual(bandRows('sands'));
    });

    test('the combined export captions a site without a code by its band, naming no certificate', async () => {
        const data = await build(page, 'Creeping Bentgrass');
        const src = fs.readFileSync(path.join(__dirname, '../assets/word-export-combined.js'), 'utf8');
        const a = src.indexOf("} else if (methodStr === 'AA') {");
        const b = src.indexOf("} else if (methodStr === 'S78') {", a);
        expect([a > -1, b > a]).toEqual([true, true]);
        const vm = require('vm');
        const ctx = vm.createContext({ anrReports: [{ data: data }], _gh396Tail: '', subtitleText: null });
        vm.runInContext(src.slice(a + "} else if (methodStr === 'AA') {".length, b), ctx);
        say('[gh823] combined caption: ' + JSON.stringify(ctx.subtitleText) + ' (methodology ' + JSON.stringify(data.soil.methodology) + ')');
        expect(ctx.subtitleText.match(/S277|sample-type sufficiency thresholds applied/g) || []).toEqual([]);
        expect(ctx.subtitleText.indexOf(data.soil.thresholds.P.citation)).toBe(0);
    });

    test('the half of the exception that stays: an MLSN sample without pH keeps the flat P floor', async () => {
        page.putSiteMethodology('mlsn');
        page.putSiteSpecies('Creeping Bentgrass');
        page.putSoilReadings({ K: 85, P: 18, S: 12, Ca: 820, Mg: 95, CEC: 6 });
        const data = page.sandbox.GAIP_WordExport.collectData(
            page.sandbox.GAIP_NutritionProgramInputs.resolveExportInputs({ siteId: SITE_ID }));
        const gcc = page.sandbox.GilbaClassificationConstants;
        const declared = gcc && gcc.MLSN_THRESHOLDS ? gcc.MLSN_THRESHOLDS.P : null;
        say('[gh823] MLSN without pH: P floor ' + JSON.stringify(data.soil.thresholds.P) + '; declared MLSN P ' + declared);
        expect(data.soil.thresholds.P.min).toBe(declared);
    });

    test('control: perennial ryegrass on sand derives S277 and keeps the certificate thresholds', async () => {
        const data = await build(page, 'Perennial Ryegrass');
        say('[gh823] ryegrass on sand: certificate ' + JSON.stringify(data.soil.aaSampleType) + ', source '
            + JSON.stringify(data.soil.aaSampleTypeSource) + ', rows ' + JSON.stringify(rowsOf(data)));
        expect({ certificate: data.soil.aaSampleType, source: data.soil.aaSampleTypeSource }).toEqual({ certificate: 'S277', source: 'derived' });
    });
});

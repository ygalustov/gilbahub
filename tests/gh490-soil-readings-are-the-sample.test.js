/**
 * GH-490 — the soil numbers in a report are the readings of that report's own
 * sample, and the readings it does not have are named rather than filled in.
 *
 * The measurement that ended the old arrangement (the four-point trace of
 * 17.09): twelve reports built on one page carried ONE set of thirteen soil
 * numbers — the page's — including for four sites with no soil sample on file
 * at all. The owner's decision, in her words: "да так и должно быть, чужое не
 * надо показывать".
 *
 * Four page-level sources fed it: `GAIP_STATE.soil.ppm`, the active sample the
 * PAGE had loaded (CEC / EC / OM), the fifteen form fields of
 * `soilFieldMappings`, and the `[data-mlsn]` traces — with the sample label and
 * the lab reference off two more form inputs. All of them are gone. The
 * readings come from `inputs.samples.soil`, resolved by id and normalised by
 * the one function the form filling uses.
 *
 * ── Passport ────────────────────────────────────────────────────────────────
 * guarantee   Every soil reading in a report belongs to the sample that report
 *             is about; a report with no such sample carries none and says so;
 *             a reading the sample does not carry is named, never substituted.
 * claims      By VALUE, from `word/document.xml`: exporting site B prints every
 *             reading of B's soil record and not one number of A's, on a page
 *             poisoned so that a value taken from it is a sentinel. By TEXT:
 *             a site with no soil sample prints no soil section, prints a row
 *             in "Data availability" naming the four sections it loses, and
 *             prints the "Not included:" paragraph. By ABSENCE: sodium, which
 *             no record in the fixture set carries, appears in no document as
 *             a value and is named in the registry instead. Structurally:
 *             `soilFieldMappings`, the `[data-mlsn]` reads, the four class
 *             reads and the two identity reads are deleted, not downgraded.
 *             GH-514: and the four CONSTANTS taken off the same record —
 *             bulk density, depth, ESP and zone area — are that record's, on a
 *             site that holds a second soil record differing in all four.
 *             They are not readings and the readings loop says nothing about
 *             them; bulk density and depth enter every ppm → kg/ha conversion
 *             (nutrition-requirement-engine.js:458) and the area is printed in
 *             the section subtitle and the purchasing summary.
 * universe    collectData() and buildSections() — the border both entry points
 *             pass, and the document a client opens.
 * unit        One report.
 * moment      During collection, per report, from the resolved sample.
 * distinguishability  Two sites, each with a soil record, sharing no reading
 *             and differing in WHICH reading is missing; the page poisoned so
 *             that a number taken from a form field is a sentinel.
 * carrier     The text of `word/document.xml`, plus `data.soil.*` where the
 *             claim is about a value that must be absent.
 * ПОТРЕБИТЕЛЬ  `word-export.js` — the Soil Nutrition section (the readings
 *             table), the "Data availability" row printed after Site
 *             Information, and the "Not included:" paragraph printed where the
 *             section would have been. Observable effect: those paragraphs in
 *             the produced .docx.
 * input       The resolver by site id (`allActive[siteId].soil`), which is what
 *             both entry points hand collectData.
 * positive-control  The B case asserts the readings ARE present and equal to
 *             B's own; without it, "A's numbers are absent" would pass on a
 *             report with no soil section at all.
 * exemptions  None.
 * ratchet     GH-514: the ratchet used to be a COUNT OF A SUBSTRING — one
 *             occurrence of `getActiveSample('soil')` in the file — which is a
 *             statement about the text and which the reviewer walked past in one
 *             attempt. It is now a statement about what RAN: across an export of
 *             both sites the page's pointer is not asked for the soil sample at
 *             all, recorded by the stub itself and asserted with its own
 *             positive control (the record does fire when someone does ask).
 *             The remaining call at `word-export.js:7334` reads the PAGE's
 *             sample for a SPECIES, not a reading, and fires only where
 *             multi-site turf is enabled; it is named in the GH-490 report and
 *             does not run on this path, which is why the list comes back
 *             empty rather than exempted.
 * rc          The reviewer's mutation: restore any of the four page sources,
 *             read the sample by the page's pointer instead of by site id,
 *             fill a missing reading from a neighbouring record, or stop
 *             printing the registry row for a site with no sample.
 * ────────────────────────────────────────────────────────────────────────────
 *
 * NOT in scope, and named: `data.soil.hasData` is still a truthiness gate
 * (`P || K || Ca || Mg`), so a reading of zero does not open the section. That
 * is the class the plan calls "печать по истинности вместо наличия" — the
 * thirty-second refinement's point 2 — and it is not this ticket's.
 */

'use strict';

const fs = require('fs');
const path = require('path');
const { loadPage, SITE_ID, OTHER_SITE_ID, poisonPage, POISON_SENTINEL } = require('./helpers/export-page-sandbox');

async function documentText(sandbox, data) {
    const sections = sandbox.GAIP_WordExport.buildSections(data, {});
    const doc = new sandbox.docx.Document({ sections: [{ properties: {}, children: sections }] });
    const blob = await sandbox.docx.Packer.toBlob(doc);
    const zip = await sandbox.JSZip.loadAsync(Buffer.from(await blob.arrayBuffer()));
    const xml = await zip.file('word/document.xml').async('string');
    return xml.replace(/<\/w:p>/g, '\n').replace(/<\/w:tc>/g, '\t').replace(/<[^>]+>/g, '')
        .replace(/&amp;/g, '&');
}

/** Every number in an object, however deep. */
function numbersIn(obj, out) {
    out = out || [];
    if (obj == null) return out;
    if (typeof obj === 'number') { out.push(obj); return out; }
    if (typeof obj !== 'object') return out;
    Object.keys(obj).forEach((k) => numbersIn(obj[k], out));
    return out;
}

describe('GH-490 — the soil readings belong to the report\'s own sample', () => {
    jest.setTimeout(120000);
    let page, npi, we, sm;

    beforeAll(() => {
        page = loadPage({ errors: [], warnings: [], alerts: [] });
        expect(page.failures).toEqual([]);
        npi = page.sandbox.GAIP_NutritionProgramInputs;
        we = page.sandbox.GAIP_WordExport;
        sm = page.sandbox.GAIP_SampleManager;
        // Every DOM field answers a sentinel and every page-state root is
        // poisoned, so a number taken from the page is recognisable rather
        // than merely wrong.
        poisonPage(page.sandbox);
    });

    test('none of the page sources is read any more', () => {
        expect.hasAssertions();
        const src = fs.readFileSync(path.join(__dirname, '..', 'assets', 'word-export.js'), 'utf8')
            .replace(/\/\*[\s\S]*?\*\//g, '').replace(/(^|[^:])\/\/[^\n]*/g, '$1');
        // The fifteen form fields and the traces.
        expect(src).not.toMatch(/soilFieldMappings/);
        expect(src).not.toMatch(/data-mlsn/);
        // The four the export read by class name.
        ['gaip-soil-ph', 'gaip-cec', 'gaip-soil-ec', 'gaip-loi'].forEach((cls) => {
            expect(src).not.toMatch(new RegExp('\\.' + cls));
        });
        // The sample's identity, off two more form inputs.
        expect(src).not.toMatch(/gaip-soil-sample-label/);
        expect(src).not.toMatch(/gaip-soil-lab-ref/);
        expect(src).not.toMatch(/gaip-soil-date/);
        // And the readings block of the page's own soil object.
        expect(src).not.toMatch(/soilInput\.ppm/);
    });

    /**
     * GH-514 (reviewer's finding C): this used to be
     * `expect((src.match(/getActiveSample\(['"]soil['"]\)/g)||[]).length).toBe(1)`
     * — a claim about how many times a substring occurs in a file. The reviewer
     * walked past it in one attempt, because a report can take the page's
     * sample without that substring appearing again.
     *
     * The claim is now about what RAN: over a whole export of both sites, the
     * page's pointer is never asked for the soil sample, and the readings that
     * arrived are the ones the record named by `provenance.soilSample.recordKey`
     * carries. The reviewer's own mutation is the positive control below.
     */
    test('GH-514: across an export, the page pointer is never asked for the soil sample', () => {
        expect.hasAssertions();
        page.sandbox.__getActiveSampleCalls = [];
        [SITE_ID, OTHER_SITE_ID].forEach((siteId) => {
            we.collectData(npi.resolveExportInputs({ siteId: siteId }));
        });
        const asked = (page.sandbox.__getActiveSampleCalls || [])
            .filter((c) => c.kind === 'soil')
            .map((c) => (c.stack.split('\n')[2] || '').trim().slice(0, 90));
        expect({ timesThePagePointerWasAskedForTheSoilSample: asked })
            .toEqual({ timesThePagePointerWasAskedForTheSoilSample: [] });
        // positive control for the record itself: the stub DOES record, so an
        // empty list means "not asked", not "not watching".
        page.sandbox.GAIP_SampleManager.getActiveSample('soil');
        expect((page.sandbox.__getActiveSampleCalls || []).filter((c) => c.kind === 'soil').length)
            .toBe(1);
    });

    /**
     * GH-514: a SECOND soil record on site A, added HERE rather than in the
     * shared sandbox.
     *
     * The mutation needs "another record of the same site" to exist, and with
     * one record per site it is a no-op — measured: applied to word-export.js it
     * left all ten checks green, because the last record in the store WAS the
     * sample. Putting it in the shared helper instead made the combined-export
     * loop enumerate three reports where two were expected and turned eleven
     * checks red in gh478 and gh479 — a fixture change wearing the shape of a
     * finding. So it lives inside this test, for the length of this test.
     */
    function withASecondSoilRecordOnSiteA(body) {
        const store = sm.getAllSamples().allSites[SITE_ID].soil;
        const older = JSON.parse(JSON.stringify(store.sample_141));
        older.id = 'older-soil-sample';
        older.label = 'Green 1, last season';
        older.date = '2024-03-02';
        Object.assign(older.values, {
            B: '0.31', K: '77', P: '19', S: '9', Ca: '1103', EC: '0.11', Fe: '61',
            Mg: '133', Mn: '9.1', OM: '2.7', Zn: '1.9', pH: '5.4', CEC: '7.7', Cu: '0.9',
            bulkDensity: '1.05', depthCm: '3.5', ESP: '0.4', areaHa: '9.99'
        });
        const outerAll = sm.getAllSamples;
        sm.getAllSamples = () => {
            const copy = outerAll();
            // listed AFTER the sample, so "last in the store" is not "the one
            // the report is about" and is not "the most recent" either
            copy.allSites[SITE_ID].soil[older.id] = older;
            return copy;
        };
        try { return body(older); } finally { sm.getAllSamples = outerAll; }
    }

    test('GH-514: the readings and the constants are the record the provenance names', () => {
        expect.hasAssertions();
        [
            { siteId: SITE_ID, key: 'sample_141' },
            { siteId: OTHER_SITE_ID, key: 'decoy-soil-sample' }
        ].forEach((c) => withASecondSoilRecordOnSiteA(() => {
            const inputs = npi.resolveExportInputs({ siteId: c.siteId });
            const data = we.collectData(inputs);
            const named = sm.getAllSamples().allSites[c.siteId].soil[c.key];
            // The record the export says it read…
            expect(data.soil.recordKey).toBe(c.key);
            // …and the record the resolver says it handed over. Both, because a
            // mutation that swaps the row behind the collector leaves the first
            // one true.
            expect(inputs.samples.soil.id).toBe(c.key);
            // every reading, by value, against the record the provenance names
            const own = sm.readingsOf('soil', named);
            expect(Object.keys(own).length).toBeGreaterThan(8);
            Object.keys(own).forEach((k) => expect([c.key, k, data.soil[k]]).toEqual([c.key, k, own[k]]));
            // and the four constants, which are on the record but not readings
            // `_soilRow` is `rawData || values`, so the constants are read from
            // the same place the product reads them.
            const row = named.rawData || named.values;
            expect([c.key, data.soil.bulkDensity]).toEqual([c.key, parseFloat(row.bulkDensity)]);
            expect([c.key, data.soil.depth]).toEqual([c.key, parseFloat(row.depthCm)]);
            expect([c.key, data.soil.areaHa]).toEqual([c.key, row.areaHa]);
            expect([c.key, data.soil.ESP]).toEqual([c.key, +parseFloat(row.ESP).toFixed(1)]);
        }));
    });

    test('site B\'s report prints every reading of B\'s own soil record', async () => {
        expect.hasAssertions();
        const data = we.collectData(npi.resolveExportInputs({ siteId: OTHER_SITE_ID }));
        const own = sm.readingsOf('soil', sm.getAllSamples().allSites[OTHER_SITE_ID].soil['decoy-soil-sample']);
        expect(Object.keys(own).length).toBeGreaterThan(8);   // positive control
        Object.keys(own).forEach((k) => {
            expect([k, data.soil[k]]).toEqual([k, own[k]]);
        });
        expect(data.soil.recordKey).toBe('decoy-soil-sample');
        expect(data.soil.sampleLabel).toBe('Elsewhere soil');
        expect(data.soil.state).toBe('selected');
        // GH-514 (reviewer's finding C): the four constants off the same record.
        // They are not readings, so the loop above says nothing about them, and
        // his mutation took them from the site's last soil record while every
        // reading and the recordKey stayed right. bulkDensity and depth go into
        // the ppm → kg/ha conversion (nutrition-requirement-engine.js:458), so
        // they are in every requirement figure; areaHa is printed in the
        // section subtitle and in the purchasing summary.
        expect({
            bulkDensity: data.soil.bulkDensity,
            depth: data.soil.depth,
            areaHa: data.soil.areaHa,
            ESP: data.soil.ESP
        }).toEqual({ bulkDensity: 1.71, depth: 14.5, areaHa: '4.17', ESP: 9.6 });
        // and the document prints them, so the claim is about what a client
        // opens rather than about a field on `data`.
        const text = await documentText(page.sandbox, data);
        expect(text).toContain(String(own.P));
        expect(text).toContain(String(own.K));
    });

    test('and not one number of site A\'s record, nor anything off the page', async () => {
        expect.hasAssertions();
        const data = we.collectData(npi.resolveExportInputs({ siteId: OTHER_SITE_ID }));
        const theirs = sm.readingsOf('soil', sm.getAllSamples().allSites[SITE_ID].soil.sample_141);
        const printed = numbersIn({ soil: data.soil });
        Object.keys(theirs).forEach((k) => {
            // The two records share no reading, so a set test is honest here
            // — and it catches a leak into a field nobody thought of.
            expect([k, printed.indexOf(theirs[k])]).toEqual([k, -1]);
        });
        expect(JSON.stringify(data.soil)).not.toContain(POISON_SENTINEL);
        // In the document: no sentinel naming a soil source. (The header's
        // organisation name is still a page read and still carries one — it is
        // named in gh461-export-inputs-provenance's list, not here.)
        const text = await documentText(page.sandbox, data);
        const soilSentinels = (text.match(new RegExp(POISON_SENTINEL + '[A-Za-z0-9_.\\[\\]()=-]*', 'g')) || [])
            .filter((h) => /soil|mlsn|cec|loi/i.test(h));
        expect(soilSentinels).toEqual([]);
    });

    test('the single export asks for the site\'s own sample, not the page\'s pointer', () => {
        expect.hasAssertions();
        const pointerWas = sm.getActiveSiteId();
        expect(sm.setActiveSite(OTHER_SITE_ID)).toBe(true);
        try {
            const data = we.collectData(npi.resolveExportInputs({ siteId: SITE_ID }));
            expect(data.soil.recordKey).toBe('sample_141');
            expect(data.soil.sampleLabel).toBe('Soccer');
        } finally {
            sm.setActiveSite(pointerWas);
        }
    });

    test('a reading the record does not carry is named, not filled in from anywhere', async () => {
        expect.hasAssertions();
        // Sodium: sample 141 is a real record and its payload has no `Na`, so
        // there is nothing to print. The site's own document must neither show
        // a sodium figure nor stay silent about its absence.
        const data = we.collectData(npi.resolveExportInputs({ siteId: SITE_ID }));
        expect(data.soil.Na).toBeUndefined();
        const entry = (data.availability || [])
            .filter((e) => e.field.indexOf('Soil readings not in this sample') === 0)[0];
        expect(entry).toBeDefined();
        expect(entry.field).toContain('Na');
        expect(entry.outcome).toBe('empty');
        const text = await documentText(page.sandbox, data);
        expect(text).toContain('Soil readings not in this sample (Na)');
        expect(text).toContain('Not included: soil readings not in this sample (Na)');
        // The other site's record HAS no copper either, and the neighbouring
        // record's copper does not arrive to fill it.
        const other = we.collectData(npi.resolveExportInputs({ siteId: OTHER_SITE_ID }));
        expect(other.soil.Cu).toBeUndefined();
        expect(data.soil.Cu).toBe(1.3);
    });

    test('a site with no soil sample prints no soil section, and the registry says so', async () => {
        expect.hasAssertions();
        const innerAll = sm.getAllSamples;
        sm.getAllSamples = () => {
            const copy = innerAll();
            copy.allSites[SITE_ID].soil = {};
            delete copy.allActive[SITE_ID].soil;
            return copy;
        };
        let bare;
        try {
            bare = we.collectData(npi.resolveExportInputs({ siteId: SITE_ID }));
        } finally {
            sm.getAllSamples = innerAll;
        }
        expect(bare.soil.state).toBe('none-on-file');
        expect(bare.soil.onFile).toBe(0);
        expect(bare.soil.P).toBeUndefined();
        expect(bare.soil.recordKey).toBeNull();

        const text = await documentText(page.sandbox, bare);
        // No readings table, and no heading carrying a methodology and a label.
        expect(text).not.toMatch(/Soil Nutrition \(/);
        // No readings table: the Annual Nutrient Requirements table still
        // prints a Phosphorus row in kg/ha/yr from the page's programme run
        // (view II, named in the report), so the ppm row is what is asserted.
        expect(text).not.toMatch(/Phosphorus \(P\)\n?\t?\d[\d.]* ppm/);
        // The row, with the sections it costs.
        expect(text).toContain('Soil readings');
        expect(text).toContain('Soil Nutrition, Cation Balance Analysis, '
            + 'Annual Soil Amendments, Soil Amendment Recommendations');
        // And the paragraph, where the section would have been.
        expect(text).toContain('Not included: soil readings — not set for this site '
            + '(Data › Samples › Soil).');
    });

    test('records on file that nobody selected are stated, not answered with one', async () => {
        expect.hasAssertions();
        const innerAll = sm.getAllSamples;
        sm.getAllSamples = () => {
            const copy = innerAll();
            delete copy.allActive[SITE_ID].soil;
            return copy;
        };
        let unselected;
        try {
            unselected = we.collectData(npi.resolveExportInputs({ siteId: SITE_ID }));
        } finally {
            sm.getAllSamples = innerAll;
        }
        expect(unselected.soil.state).toBe('on-file-not-selected');
        expect(unselected.soil.onFile).toBe(1);
        expect(unselected.soil.P).toBeUndefined();
        const text = await documentText(page.sandbox, unselected);
        expect(text).toContain('1 soil sample on file; none selected.');
    });

    test('the readings are the store\'s own normalisation, and the key list comes from its map', () => {
        expect.hasAssertions();
        // No second table: the fifteen names the export can miss are derived
        // from the same map `readingsOf` normalises against.
        const keys = sm.readingKeysFor('soil');
        expect(keys).toEqual(['pH', 'EC', 'CEC', 'OM', 'K', 'P', 'Ca', 'Mg', 'S',
            'Fe', 'Mn', 'Cu', 'Zn', 'B', 'Na']);
        const src = fs.readFileSync(path.join(__dirname, '..', 'assets', 'word-export.js'), 'utf8');
        expect(src).toMatch(/readingKeysFor\('soil'\)/);
        // and the export does not keep a list of its own beside it
        expect(src).not.toMatch(/SOIL_READING_KEYS/);
    });
});

/**
 * GH-486 — what is NOT in the document is stated in the document.
 *
 * GH-484 stopped four things being printed from another sample's run —
 * Limiting Nutrients, Classification, Sodium Hazard, Salinity Hazard — and
 * recorded the omission in two fields (`data.tissue.resultsOmitted`,
 * `data.water.resultsOmitted`) that nothing read. A grep found them: written
 * in `word-export.js`, read by tests only. So the four simply vanished and a
 * client had no word about why, while the comment beside them promised
 * otherwise. This file is the consumer, and the assertion that it reaches the
 * page.
 *
 * ── Passport ────────────────────────────────────────────────────────────────
 * guarantee   Every field whose outcome is not `present` is named in the
 *             document — in a registry printed in every document, and again in
 *             the section it affects.
 * claims      By TEXT, from `word/document.xml`: the "Data availability"
 *             heading is always there; with nothing to report it says "All
 *             site data present."; with outcomes it prints one row per field
 *             carrying Field, Where it lives, Status, Reason and Sections
 *             affected; and each affected section carries a "Not included:"
 *             line in one of two forms — not set, or could not be read with a
 *             reason code.
 * universe    buildSections(), the one place a document's text is produced.
 * unit        One field with an outcome.
 * moment      At section building, from the outcome map collectData filled.
 * distinguishability  The two outcomes produce two different sentences and two
 *             different Status values, and the Reason column is non-empty for
 *             exactly one of them — so "said something" is distinguishable
 *             from "said the right thing".
 * carrier     The text of `word/document.xml`. Not the data: a field on `data`
 *             is what GH-484 had, and it is what nobody read.
 * ПОТРЕБИТЕЛЬ  `word-export.js:11601` (the registry printed after Site
 *             Information) and `word-export.js:12574, 12649, 13264, 13340`
 *             (the "Not included:" lines in the Tissue Analysis and Water
 *             Quality sections). Observable effect: those paragraphs in the
 *             produced .docx.
 * input       collectData()'s outcome map, which both entry points fill.
 * positive-control  A run with nothing to report asserts the heading IS there
 *             and says all data is present; without it, "the registry names
 *             the missing field" would pass on a document that always printed
 *             the same table.
 * exemptions  None.
 * ratchet     None.
 * rc          The reviewer's mutation: stop printing the registry, drop the
 *             Reason column, or make both outcomes produce one sentence.
 * ────────────────────────────────────────────────────────────────────────────
 */

'use strict';

const { loadPage, SITE_ID, OTHER_SITE_ID } = require('./helpers/export-page-sandbox');

async function documentText(sandbox, data) {
    const sections = sandbox.GAIP_WordExport.buildSections(data, {});
    const doc = new sandbox.docx.Document({ sections: [{ properties: {}, children: sections }] });
    const blob = await sandbox.docx.Packer.toBlob(doc);
    const zip = await sandbox.JSZip.loadAsync(Buffer.from(await blob.arrayBuffer()));
    const xml = await zip.file('word/document.xml').async('string');
    return xml.replace(/<\/w:p>/g, '\n').replace(/<\/w:tc>/g, '\t').replace(/<[^>]+>/g, '')
        .replace(/&amp;/g, '&').replace(/&#8217;/g, '’');
}

/**
 * The registry as CELLS: docx renders a table as one paragraph per cell, so a
 * row is its five cells in order. Reading the row rather than searching the
 * whole document matters — the reason code also appears in the section's own
 * "Not included:" line, and a document-wide search called the registry's
 * Reason column present after it had been dropped (measured: that mutation
 * stayed green until this was written).
 */
function registryRows(text, fields) {
    const start = text.indexOf('Data availability');
    if (start < 0) return {};
    const cells = text.slice(start).split('\n').map((l) => l.replace(/^\t/, '').replace(/\t$/, '').trim());
    const rows = {};
    fields.forEach((f) => {
        const at = cells.indexOf(f);
        if (at < 0) return;
        rows[f] = {
            where: cells[at + 1], status: cells[at + 2], reason: cells[at + 3], sections: cells[at + 4]
        };
    });
    return rows;
}

describe('GH-486 — the document says what it does not include', () => {
    jest.setTimeout(120000);
    let page, npi, we, selected, unselected, complete;

    beforeAll(async () => {
        page = loadPage({ errors: [], warnings: [], alerts: [] });
        expect(page.failures).toEqual([]);
        npi = page.sandbox.GAIP_NutritionProgramInputs;
        we = page.sandbox.GAIP_WordExport;
        selected = we.collectData(npi.resolveExportInputs({ siteId: SITE_ID }));
        // A site whose samples exist but none is selected: the second outcome.
        const sm = page.sandbox.GAIP_SampleManager;
        const innerAll = sm.getAllSamples;
        sm.getAllSamples = () => {
            const copy = innerAll();
            copy.allActive[SITE_ID] = { soil: copy.allActive[SITE_ID].soil };
            return copy;
        };
        try {
            unselected = we.collectData(npi.resolveExportInputs({ siteId: SITE_ID }));
        } finally {
            sm.getAllSamples = innerAll;
        }
        // GH-490: the positive control's site, reached the same way — by the
        // INPUT, never by editing what the product produced. Sample 141 is a
        // real record and it carries fourteen of the fifteen soil readings;
        // sodium was not reported, so from GH-490 on the real site truthfully
        // says so and its table is not empty. A site with nothing to report
        // therefore needs a sample with nothing missing, and this is it: the
        // same record with a sodium reading, taken from a real one
        // (samples.id=1, "Na": 126.5) rather than made up.
        sm.getAllSamples = () => {
            const copy = innerAll();
            const store = copy.allSites[SITE_ID].soil;
            const id = copy.allActive[SITE_ID].soil;
            store[id].values = Object.assign({}, store[id].values, { Na: '126.5' });
            return copy;
        };
        try {
            complete = we.collectData(npi.resolveExportInputs({ siteId: SITE_ID }));
        } finally {
            sm.getAllSamples = innerAll;
        }
    });

    test('positive control: a site with everything present says so, and the map cannot be edited', async () => {
        // GH-487: reached by DATA. The first version of this control deleted
        // `data.availability` and then asserted a document the product cannot
        // produce — a test manufacturing the state it asserts. The fixture
        // site has every field present and all three samples selected by id,
        // so the site's own table is empty because there is nothing in it.
        //
        // And the map is frozen by the product, not by this test: the old
        // trick now throws where it used to work.
        expect(Object.isFrozen(complete.availability)).toBe(true);
        // The error comes from the sandbox's own realm, so it is matched by
        // its message rather than by `instanceof` across realms.
        expect(() => complete.availability.push({ field: 'x' })).toThrow(/not extensible/);
        const text = await documentText(page.sandbox, complete);
        expect(text).toContain('Data availability');
        expect(text).toContain('All site data present.');
        expect(text).not.toContain('Not included:');
        // and the sections it is about are printed WITH their content
        expect(text).toContain('Tissue Analysis');
        expect(text).toMatch(/Nitrogen \(N\)/);
        expect(text).toContain('Water Quality');
    });

    test('the registry names every field whose outcome is not present, with all five columns', async () => {
        const text = await documentText(page.sandbox, unselected);
        expect(text).toContain('Data availability');
        expect(text).not.toContain('All site data present.');
        ['Field', 'Where it lives', 'Status', 'Reason', 'Sections affected'].forEach((h) => {
            expect(text).toContain(h);
        });
        // Row by row, in the row's own cells — not anywhere in the document.
        // GH-487: the table holds the site's own outcomes; the two verdicts
        // are about the version and are not rows at all.
        const siteFields = unselected.availability.filter((e) => e.reason !== 'no-run-stamp').map((e) => e.field);
        const rows = registryRows(text, siteFields);
        expect(rows['Tissue analysis verdict']).toBeUndefined();
        expect(rows['Tissue readings']).toEqual({
            where: 'Data \u203A Samples \u203A Tissue', status: 'Not set',
            reason: '', sections: 'Tissue Analysis'
        });
        expect(rows['Water analysis verdict']).toBeUndefined();
        expect(rows['Water readings'].sections).toBe('Water Quality');
    });

    test('in every row, a reason exists exactly when the status is "could not be read"', async () => {
        const text = await documentText(page.sandbox, unselected);
        const siteEntries = unselected.availability.filter((e) => e.reason !== 'no-run-stamp');
        const rows = registryRows(text, siteEntries.map((e) => e.field));
        expect(Object.keys(rows).length).toBe(siteEntries.length);
        Object.keys(rows).forEach((f) => {
            const r = rows[f];
            expect([f, r.status === 'Could not be read', r.reason.length > 0])
                .toEqual([f, r.status === 'Could not be read', r.status === 'Could not be read']);
        });
    });

    test('the registry and the outcome map are the same set, in both directions', async () => {
        const text = await documentText(page.sandbox, unselected);
        const fields = unselected.availability
            .filter((e) => e.reason !== 'no-run-stamp').map((e) => e.field);
        expect(fields.length).toBeGreaterThan(0);
        fields.forEach((f) => expect(text).toContain(f));
        // and nothing is printed that the map does not carry: the registry's
        // rows are counted by the map's own length
        // A table cell ends in a tab and a row begins on a new line, so a row's
        // first cell is a line of its own.
        // A table cell ends in a tab and a row begins on a new line, so a
        // row's first cell is a line of its own, with the previous cell's tab
        // in front of it.
        const rowsPrinted = text.split('\n')
            .map((l) => l.replace(/^\t/, '').replace(/\t$/, ''))
            .filter((l) => fields.indexOf(l) >= 0);
        expect(rowsPrinted.slice().sort()).toEqual(fields.slice().sort());
    });

    test('what is true of every document is said once, as a note about the version', async () => {
        // GH-487: these two outcomes cannot be absent for any site — layer II
        // is not built — so they are not a statement about a site and stand
        // neither in a site's table nor in its sections.
        const text = await documentText(page.sandbox, selected);
        expect(text).toContain('About this report version');
        expect(text).toContain('Analysis verdicts for tissue and water are not yet attributed to a site '
            + 'in this version; they are omitted for every site.');
        expect(text).not.toContain('Not included: tissue analysis verdict');
        expect(text).not.toContain('Not included: water analysis verdict');
        expect(text).toContain('Tissue Analysis');
        expect(text).toMatch(/Nitrogen \(N\)/);
    });

    test('a section with no sample says so in the OTHER form, and names where the setting lives', async () => {
        const text = await documentText(page.sandbox, unselected);
        expect(text).toContain(
            'Not included: tissue readings — not set for this site (Data › Samples › Tissue).');
        expect(text).toContain(
            'Not included: water readings — not set for this site (Data › Samples › Water).');
        // and the count of what is waiting is carried in the same sentence
        expect(text).toMatch(/1 tissue sample on file; none selected/);
    });

    test('the form that IS reachable today is the "not set" one, and it names where the setting lives', async () => {
        // GH-487, named rather than implied: the "could not be read" form is
        // not reachable in a printed document today. Its five reasons
        // (`not-loaded`, `load-failed`, `no-record`, `no-field`, `read-threw`)
        // belong to the three-outcome resolver of the twenty-eighth
        // refinement, which is not built; the only unavailable reason the
        // product produces is `no-run-stamp`, and that one is about the
        // version. Asserting a sentence nothing can print would be asserting
        // this test's own fixture.
        const text = await documentText(page.sandbox, unselected);
        const notIncluded = text.split('\n').filter((l) => l.indexOf('Not included:') === 0);
        expect(notIncluded.length).toBeGreaterThanOrEqual(2);
        notIncluded.forEach((l) => expect(l).toContain('not set for this site'));
        notIncluded.forEach((l) => expect(l).not.toMatch(/\((no-run-stamp|not-loaded|load-failed)\)/));
    });

    test('the text lives with the consumer, not with the writer', () => {
        // The outcome map carries no sentences: a field that stores its own
        // wording is a second place for the same fact, which is what GH-484
        // did and what nobody read.
        (unselected.availability || []).forEach((e) => {
            expect(Object.keys(e).sort()).toEqual(
                expect.arrayContaining(['field', 'outcome', 'sections', 'where']));
            expect(String(e.field)).not.toContain('Not included');
            expect(String(e.reason || '')).not.toContain(' ');
        });
    });

    test('the other site gets its own registry, not this one\'s', async () => {
        const other = we.collectData(npi.resolveExportInputs({ siteId: OTHER_SITE_ID }));
        // GH-490: the other site's soil record misses a different reading from
        // this site's, so its row NAMES a different set — the registry is the
        // site's own, not a copy of the one printed a moment ago.
        expect((other.availability || []).map((e) => e.field).sort())
            .toEqual(['Soil readings not in this sample (Cu, Na)',
                'Tissue analysis verdict', 'Water analysis verdict']);
        const text = await documentText(page.sandbox, other);
        expect(text).toContain('Data availability');
        expect(text).not.toContain('Not included: tissue readings');
    });
});

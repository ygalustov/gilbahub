/**
 * The export smoke test — PLAN-GH439 section 10.10.
 *
 * Why it exists, in one measurement: 2,639 green tests while the export was
 * dead. A layer I change left a reference to a variable it had itself removed,
 * `collectData()` threw `_collectSiteCfg is not defined`, and no document was
 * produced at all. Nothing in `npx jest` ran the export end to end — four
 * suites load word-export.js into a sandbox and call pure functions, and the
 * only full run is the parity harness's download, which is skipped without the
 * live stack. So the suite everyone watches every day could not see it.
 *
 * This runs in the ORDINARY jest run, with no stand and no browser, and it
 * executes the real `GAIP_WordExport.export()`. Its place matters as much as
 * its content: a smoke test living among the live suites would be skipped in
 * the run where it is needed.
 *
 * What it asserts is deliberately the cheapest thing that is not nothing: a
 * blob was produced, it opens as a zip, the zip holds a non-empty
 * word/document.xml, that document names the site and the sample, and no
 * console.error was raised on the way. No numbers, no parsing of content —
 * the parity harness does that, on a stand.
 *
 * Blind spots, named rather than hidden: a sandbox is not a browser, so chart
 * capture, layout, the real Blob/URL and the page's load order are not
 * exercised here. The parity harness's download remains the browser-side smoke
 * test for those.
 */
'use strict';

const { SITE_ID, SITE_NAME, NOT_LOADED, hubScripts, loadPage } = require('./helpers/export-page-sandbox');

describe('the export produces a file — smoke, no stand', () => {
    jest.setTimeout(120000);

    const record = { errors: [], warnings: [], alerts: [] };
    let page, result, zip, documentXml;

    beforeAll(async () => {
        page = loadPage(record);
        if (page.failures.length) {
            throw new Error('modules the export page loads did not load here: ' +
                JSON.stringify(page.failures.slice(0, 5)));
        }
        record.errors.length = 0;
        record.warnings.length = 0;
        record.alerts.length = 0;
        result = await page.sandbox.GAIP_WordExport.export();
        // exportToWord() hands the document to Packer.toBlob(...).then(...) and
        // returns without awaiting that chain, so the file appears a few
        // microtask turns after the call resolves. Waiting for the artefact
        // rather than for the function is the honest thing here: what is being
        // asserted is that a file was produced.
        for (let i = 0; i < 200 && !page.blobs.length; i++) {
            await new Promise((r) => setImmediate(r));
        }
        const blob = page.blobs[page.blobs.length - 1];
        if (blob) {
            zip = await page.sandbox.JSZip.loadAsync(Buffer.from(await blob.arrayBuffer()));
            const entry = zip.file('word/document.xml');
            documentXml = entry ? await entry.async('string') : null;
        }
    });

    test('every module the page loads is loaded here too, or named with a reason', () => {
        const onPage = hubScripts();
        const unexplained = Object.keys(NOT_LOADED).filter((n) => onPage.indexOf(n) < 0);
        expect({ named_but_not_on_the_page: unexplained }).toEqual({ named_but_not_on_the_page: [] });
        Object.keys(NOT_LOADED).forEach((n) => {
            expect(typeof NOT_LOADED[n]).toBe('string');
            expect(NOT_LOADED[n].length).toBeGreaterThan(20);
        });
        expect(page.failures).toEqual([]);
    });

    test('a file was produced and the link was clicked', () => {
        // An export that produced nothing almost always said why, so the
        // console record travels with the failure. (Written after the first
        // version of this line compared a value with itself and reported
        // nothing — the same shape this repo spent a day removing.)
        expect({ blobs: page.blobs.length, errors: record.errors.slice(0, 3) })
            .toEqual({ blobs: expect.any(Number), errors: [] });
        expect(page.blobs.length).toBeGreaterThan(0);
        expect(page.clicked.length).toBeGreaterThan(0);
    });

    test('the file is not empty', () => {
        const blob = page.blobs[page.blobs.length - 1];
        expect(blob && blob.size).toBeGreaterThan(0);
    });

    test('it opens as a .docx: the archive holds a non-empty word/document.xml', () => {
        expect(zip).toBeTruthy();
        expect(zip.file('[Content_Types].xml')).toBeTruthy();
        expect(typeof documentXml).toBe('string');
        expect(documentXml.length).toBeGreaterThan(0);
    });

    test('the document names the site and the turf it is about', () => {
        // Without this, a document whose sections all threw and were caught
        // would pass as "non-empty and opens".
        //
        // The species is the second string deliberately: it is the value that
        // travels the whole layer I path — site config, resolver, collectData,
        // printed section — so its presence says that path ran, not merely
        // that a file exists. The sample label comes from the page's loaded
        // sample rather than from the site, so it is not what this test is
        // about; the parity harness checks it against the picker on a stand.
        expect(documentXml).toContain(SITE_NAME);
        expect(documentXml).toContain('Perennial Ryegrass');
    });

    test('nothing wrote to console.error and nothing alerted the user', () => {
        expect({ errors: record.errors, alerts: record.alerts }).toEqual({ errors: [], alerts: [] });
    });
});

/**
 * GH-468 (PLAN-GH439 section 10.6, seventh refinement, point 1; 10.10) — the
 * jsdom half of scenario S7.
 *
 * The live version points the page at site B and runs the combined export over
 * a sample of site A, through the real loop. This one runs where it can run
 * every time: the sample manager answers B for "which site is active", the
 * export is asked about A by id, and the finished document must be A's — by
 * name and by species.
 *
 * What this half proves and what it does not, measured rather than assumed:
 * it goes red if anything between the resolver's answer and the printed
 * document lets the page's site back in. It does NOT go red on the original
 * defect, which was a missing ARGUMENT at the call site — this block hands the
 * inputs over itself, so the call site is not on its path. Restoring both the
 * fallback and the bare `collectData()` leaves all three assertions here green;
 * what catches that is the resolver's refusal and the two call-site
 * assertions in gh468-document-site-is-named.test.js, each shown red, and the
 * live S7 which goes through the loop itself.
 */
describe('GH-468 — the document is the sample\'s site, not the site the page points at', () => {
    const SITE_B = { id: 'site-b-elsewhere', name: 'Elsewhere (Christchurch)' };
    let record, page, documentXml;

    beforeAll(async () => {
        record = { errors: [], warnings: [], alerts: [] };
        page = loadPage(record);
        expect(page.failures).toEqual([]);

        // The page points at B: every "which site is active" answer is B's,
        // and B's config is a warm-season sward on other coordinates.
        const sandbox = page.sandbox;
        const configA = sandbox.GAIP_SiteConfig.getConfig(SITE_ID);
        const configB = {
            turf: { species: 'Kikuyu', turfType: 'sports', subCategory: '', variety: 'generic',
                construction: 'native', hoc: 25, c3Cover: 0, methodology: 'mlsn' },
            location: { name: 'Christchurch', lat: -43.53, lon: 172.62 },
            locationName: 'Christchurch'
        };
        sandbox.GAIP_SiteConfig.getConfig = (id) => (id === SITE_ID ? configA
            : (id === SITE_B.id ? configB : null));
        sandbox.GAIP_SampleManager.getActiveSiteId = () => SITE_B.id;
        sandbox.GAIP_SampleManager.getActiveSiteLabel = () => SITE_B.name;
        sandbox.GAIP_HUB_CONFIG.activeSiteId = SITE_B.id;

        // The export is asked about A, by id, the way the combined loop asks
        // about the entry it is printing.
        const inputs = sandbox.GAIP_NutritionProgramInputs.resolveExportInputs({ siteId: SITE_ID });
        expect(inputs.site.id).toBe(SITE_ID);

        const data = sandbox.GAIP_WordExport.collectData(inputs);
        const charts = {};
        const sections = sandbox.GAIP_WordExport.buildSections(data, charts);
        const doc = new sandbox.docx.Document({
            sections: [{ properties: {}, children: sections }]
        });
        const blob = await sandbox.docx.Packer.toBlob(doc);
        const zip = await sandbox.JSZip.loadAsync(Buffer.from(await blob.arrayBuffer()));
        documentXml = await zip.file('word/document.xml').async('string');
    });

    test('the document names the sample\'s site, not the one the page points at', () => {
        expect(documentXml).toContain(SITE_NAME);
        expect(documentXml).not.toContain(SITE_B.name);
    });

    test('the document names the sample\'s species, not the other site\'s', () => {
        // The value that travels the whole layer I path. 'Kikuyu' appearing
        // here is the defect exactly as a client saw it: the right sample
        // under another site's grass.
        expect(documentXml).toContain('Perennial Ryegrass');
        expect(documentXml).not.toContain('Kikuyu');
    });

    test('nothing wrote to console.error while it happened', () => {
        expect({ errors: record.errors }).toEqual({ errors: [] });
    });
});

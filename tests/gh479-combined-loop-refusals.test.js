/**
 * GH-479 (PLAN-GH439 section 10.6, sixteenth refinement, point 1) — the
 * combined loop's refusal branch, which nothing had ever run.
 *
 * `sm.setActiveSite(entry.siteId) === false` means the sample manager does not
 * know that site and left the page's pointer where it was
 * (sample-manager.js:2443). The eighth refinement made the loop read that
 * answer and skip the sample instead of printing it against whichever site the
 * page was still on. The branch has been in the product since, unexecuted by
 * any test: the sandbox had no `setActiveSite` at all, so the call threw
 * before the branch could be reached, and the live scenario needs a stand.
 *
 * ── Passport ────────────────────────────────────────────────────────────────
 * guarantee   A sample whose site the page refuses to switch to is left out of
 *             the document, rather than printed against another site.
 * claims      By VALUE: the refused site's name appears nowhere in the
 *             produced document, the loop says why in a warning that names the
 *             site, and the document still contains the sample that was not
 *             refused.
 * universe    The combined export — the entry point /reports/export runs.
 * unit        One sample in the loop.
 * moment      During a whole combined export, at the switch, not at collection.
 * distinguishability  Three sites go into the enumeration: one refused, one
 *             accepted, and one more accepted beside it, so "skipped the right
 *             one" is distinguishable from "skipped everything" and from
 *             "printed everything".
 * carrier     The produced word/document.xml and the console warning — a
 *             printed absence and a stated reason, because an absence alone
 *             cannot say whether the loop refused or simply failed.
 * input       The refusal is produced by the product, not by a wrapper: a site
 *             the SAMPLE store knows and the SITE registry does not, which is
 *             the live shape of "Site not found".
 * positive-control  The accepted sites in the same run, asserted present. An
 *             assertion of absence with nothing asserted present passes on a
 *             document that failed to build at all.
 * exemptions  None.
 * ratchet     None.
 * rc          The reviewer's mutation: drop the `=== false` check, or make it
 *             `continue` unconditionally.
 * ────────────────────────────────────────────────────────────────────────────
 */

'use strict';

const { loadPage, SITE_ID, SITE_NAME, OTHER_SITE_ID } = require('./helpers/export-page-sandbox');

const GHOST_SITE = 'site-the-registry-does-not-know';
const GHOST_LABEL = 'Ghost Links';
const GHOST_SAMPLE = 'ghost-soil-sample';

function documentText(xml) {
    return xml.replace(/<\/w:p>/g, '\n').replace(/<\/w:tc>/g, '\t').replace(/<[^>]+>/g, '');
}

describe('GH-479 — a site the page will not switch to is left out of the document', () => {
    jest.setTimeout(300000);
    let record, page, xml, refused;

    beforeAll(async () => {
        record = { errors: [], warnings: [], alerts: [] };
        page = loadPage(record);
        expect(page.failures).toEqual([]);
        const sandbox = page.sandbox;

        // A site the sample store enumerates and the site registry has never
        // heard of. The product's own setActiveSite answers false for it —
        // nothing here wraps or fakes that answer.
        const innerAll = sandbox.GAIP_SampleManager.getAllSamples;
        sandbox.GAIP_SampleManager.getAllSamples = () => {
            const all = innerAll();
            all.sites[GHOST_SITE] = { label: GHOST_LABEL, createdAt: '2026-01-01T00:00:00.000Z' };
            all.allSites[GHOST_SITE] = {
                soil: { [GHOST_SAMPLE]: { id: GHOST_SAMPLE, label: GHOST_LABEL, date: '2026-01-01', values: { P: 11, K: 12 } } },
                tissue: {}, water: {}
            };
            all.allActive[GHOST_SITE] = { soil: GHOST_SAMPLE };
            return all;
        };
        refused = sandbox.GAIP_SampleManager.setActiveSite(GHOST_SITE);

        await sandbox.GAIP_CombinedExport.exportAll();
        for (let i = 0; i < 400 && !page.blobs.length; i++) {
            await new Promise((r) => setImmediate(r));
        }
        const blob = page.blobs[page.blobs.length - 1];
        expect(blob && blob.size).toBeGreaterThan(0);
        const zip = await sandbox.JSZip.loadAsync(Buffer.from(await blob.arrayBuffer()));
        xml = await zip.file('word/document.xml').async('string');
    });

    test('the store refuses the site, and refusing leaves the pointer where it was', () => {
        expect(refused).toBe(false);
        expect(page.sandbox.GAIP_SampleManager.getActiveSiteId()).toBe(SITE_ID);
    });

    test('the refused site is not in the document', () => {
        expect(documentText(xml)).not.toContain(GHOST_LABEL);
    });

    test('the sites it did not refuse are', () => {
        // The positive control: without it, a document that failed to build
        // would pass the assertion above.
        const text = documentText(xml);
        expect(text).toContain(SITE_NAME);
        expect(text.length).toBeGreaterThan(1000);
    });

    test('the loop says which sample it skipped and why', () => {
        const spoken = record.warnings.filter((w) => w.indexOf(GHOST_SITE) >= 0);
        expect(spoken.length).toBeGreaterThan(0);
        expect(spoken.join(' ')).toMatch(/refused to switch to site/);
    });

    test('nothing wrote to console.error while it happened', () => {
        expect({ errors: record.errors }).toEqual({ errors: [] });
    });
});

/**
 * GH-479 (sixteenth refinement, point 1) — the readings the document prints
 * come out of the form the loop filled for THAT sample.
 *
 * ── Passport ────────────────────────────────────────────────────────────────
 * guarantee   Each report in a combined document carries the soil readings of
 *             its own sample.
 * claims      By VALUE: the P and K in each collected report equal that
 *             entry's own sample, and not the other entry's.
 * universe    The combined export.
 * unit        One sample in the loop.
 * moment      At collection, per iteration — not once for the document.
 * distinguishability  The two samples share no reading: the fixture's are its
 *             real lab numbers, the decoy's share no value with them (GH-490
 *             gave it the whole payload shape, so -1 in five fields became
 *             fourteen readings of its own).
 * carrier     `data.soil`, the object every printed soil figure and the ANR
 *             engine read, captured at the border by wrapping collectData.
 * input       The combined export, driven end to end; the form is filled only
 *             by the product's own loadSample() call inside the loop.
 * positive-control  Both reports are asserted to have readings at all before
 *             they are compared, so "no readings anywhere" cannot pass.
 * exemptions  None.
 * ratchet     None.
 * rc          The reviewer's mutation: stop filling the form in loadSample, or
 *             fill it once before the loop.
 * ────────────────────────────────────────────────────────────────────────────
 *
 * Measured, and the reason this test exists: with the form filled once at page
 * load and never again, a combined document over two sites printed the first
 * site's readings under both. That is the same shape as the climate defect one
 * field further along, and the sandbox could not show it until loadSample
 * filled the form the way the live one does.
 */
describe('GH-479 — each report carries its own sample\'s readings', () => {
    jest.setTimeout(300000);
    let collected, record;

    beforeAll(async () => {
        record = { errors: [], warnings: [], alerts: [] };
        const page = loadPage(record);
        expect(page.failures).toEqual([]);
        const sandbox = page.sandbox;
        collected = [];
        const innerCollect = sandbox.GAIP_WordExport.collectData;
        sandbox.GAIP_WordExport.collectData = function (inputs) {
            const data = innerCollect.call(this, inputs);
            collected.push({ siteId: inputs.site.id, P: data.soil.P, K: data.soil.K });
            return data;
        };
        await sandbox.GAIP_CombinedExport.exportAll();
    });

    test('both sites were collected, and both have readings', () => {
        expect(collected.map((c) => c.siteId).sort()).toEqual([OTHER_SITE_ID, SITE_ID].sort());
        collected.forEach((c) => {
            expect([c.siteId, typeof c.P, typeof c.K]).toEqual([c.siteId, 'number', 'number']);
        });
    });

    test('the fixture site\'s report carries the fixture sample\'s readings', () => {
        const mine = collected.filter((c) => c.siteId === SITE_ID)[0];
        expect({ P: mine.P, K: mine.K }).toEqual({ P: 40, K: 40 });
    });

    test('the other site\'s report carries the other sample\'s, which share no value with it', () => {
        const other = collected.filter((c) => c.siteId === OTHER_SITE_ID)[0];
        expect({ P: other.P, K: other.K }).toEqual({ P: 412, K: 411 });
    });
});

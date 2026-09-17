/**
 * GH-484 — the tissue and water numbers in a report are the readings of that
 * report's own sample.
 *
 * The measurement that ended the old arrangement (the four-point trace of
 * 17.09): twelve reports built on one page carried ONE set of tissue readings
 * and ONE set of water ions — the page's — including for sites with no sample
 * of that kind on file at all. A client was shown another site's laboratory
 * results under his own site's name.
 *
 * Five page-level sources fed that: `GAIP_STATE.tissue`, the tissue form's
 * `input[data-val]` fields, `__GAIP_TISSUE_LAST__`, `GAIP_STATE.water` (with
 * the hub store and blender ahead of it) and `window._GAIP_EXPORT_BLEND_WATER`,
 * plus a DOM fallback over the water form. All of them are gone; the readings
 * come from `inputs.samples.tissue/water`, resolved by id, normalised by the
 * one function the form filling uses.
 *
 * ── Passport ────────────────────────────────────────────────────────────────
 * guarantee   Every tissue reading and every water ion in a report belongs to
 *             the sample that report is about, and a report with no such
 *             sample carries none.
 * claims      By VALUE: exporting site B yields every reading of B's tissue
 *             sample and every ion of B's water sample, and not one number
 *             from A's samples, from the page, or from a poisoned page field.
 *             Structurally: none of the five page sources is read any more.
 *             By STATE: the three states are carried and the middle one is
 *             printed, so "on file but not selected" is never answered with
 *             the latest record.
 * universe    collectData(), the border both entry points pass.
 * unit        One report.
 * moment      During collection, per report, from the resolved sample.
 * distinguishability  Two sites, each with its own tissue and water sample,
 *             sharing no reading; the page poisoned so that a value taken from
 *             it is a sentinel rather than a plausible number.
 * carrier     `data.tissue.*` and `data.water.*` — the objects every printed
 *             reading, colour and index are computed from — plus the state and
 *             the record key beside them.
 * input       The resolver by site id (allActive[siteId][kind]), which is what
 *             both entry points hand collectData.
 * positive-control  The B case asserts the readings ARE present and equal to
 *             B's own; an assertion that A's numbers are absent would pass on
 *             a report with no tissue section at all.
 * exemptions  None.
 * ratchet     None.
 * rc          The reviewer's mutation: restore GAIP_STATE.tissue, read the
 *             active sample by the page's pointer instead of by site id, or
 *             take the last sample of the store when none is selected.
 * ────────────────────────────────────────────────────────────────────────────
 *
 * OPEN, not changed here: where more than one water sample is on file and none
 * is selected, the resolver's own choice is the last key of the store —
 * question 10.8(20). This file states the three states; it does not change
 * that choice.
 */

'use strict';

const fs = require('fs');
const path = require('path');
const { loadPage, SITE_ID, OTHER_SITE_ID, poisonPage, POISON_SENTINEL } = require('./helpers/export-page-sandbox');

const TISSUE_KEYS = ['N', 'P', 'K', 'Ca', 'Mg', 'S', 'Fe', 'Mn', 'Zn', 'Cu'];
const ION_KEYS = ['pH', 'EC', 'Ca', 'Mg', 'Na', 'K', 'Cl', 'SO4', 'HCO3', 'CO3', 'B'];

/** Every number in an object, however deep. */
function numbersIn(obj, out) {
    out = out || [];
    if (obj == null) return out;
    if (typeof obj === 'number') { out.push(obj); return out; }
    if (typeof obj !== 'object') return out;
    Object.keys(obj).forEach((k) => numbersIn(obj[k], out));
    return out;
}

describe('GH-484 — the readings belong to the report\'s own sample', () => {
    let page, npi, we, sm;

    beforeAll(() => {
        page = loadPage({ errors: [], warnings: [], alerts: [] });
        expect(page.failures).toEqual([]);
        npi = page.sandbox.GAIP_NutritionProgramInputs;
        we = page.sandbox.GAIP_WordExport;
        sm = page.sandbox.GAIP_SampleManager;
        // Every DOM field answers a sentinel and every page-state root is
        // poisoned: a number taken from the page is then recognisable rather
        // than merely wrong.
        poisonPage(page.sandbox);
    });

    test('none of the five page sources is read any more', () => {
        const src = fs.readFileSync(path.join(__dirname, '..', 'assets', 'word-export.js'), 'utf8')
            .replace(/\/\*[\s\S]*?\*\//g, '').replace(/(^|[^:])\/\/[^\n]*/g, '$1');
        expect(src).not.toMatch(/GAIP_STATE\.tissue\b/);
        expect(src).not.toMatch(/GAIP_STATE\.tissueResults/);
        expect(src).not.toMatch(/__GAIP_TISSUE_LAST__/);
        expect(src).not.toMatch(/GAIP_STATE\.water\b/);
        expect(src).not.toMatch(/GAIP_STATE\.waterResults/);
        expect(src).not.toMatch(/_GAIP_EXPORT_BLEND_WATER/);
        expect(src).not.toMatch(/input\[data-val\]/);
        // and the water form's DOM fallback went with them
        expect(src).not.toMatch(/waterFieldMappings/);
    });

    test('site B\'s report carries every reading of B\'s own tissue sample', () => {
        const data = we.collectData(npi.resolveExportInputs({ siteId: OTHER_SITE_ID }));
        const own = sm.readingsOf('tissue', sm.getAllSamples().allSites[OTHER_SITE_ID].tissue['tissue-b']);
        expect(Object.keys(own).length).toBeGreaterThan(5);   // positive control
        TISSUE_KEYS.forEach((k) => {
            if (own[k] === undefined) return;
            expect([k, data.tissue[k]]).toEqual([k, own[k]]);
        });
        expect(data.tissue.recordKey).toBe('tissue-b');
        expect(data.tissue.sampleLabel).toBe('Elsewhere tissue');
        // GH-511 (reviewer's finding C): the DATE travels with the readings.
        // Nothing asserted it for any kind, and his mutation — B's numbers
        // printed under A's sampling date — was green across all 2912.
        expect(data.tissue.testDate).toBe('2001-02-02');
        expect(data.tissue.state).toBe('selected');
    });

    test('and not one number from site A\'s tissue sample, or from the page', () => {
        const data = we.collectData(npi.resolveExportInputs({ siteId: OTHER_SITE_ID }));
        const theirs = sm.readingsOf('tissue', sm.getAllSamples().allSites[SITE_ID].tissue['tissue-a']);
        const printed = numbersIn({ tissue: data.tissue });
        Object.keys(theirs).forEach((k) => {
            // A's readings share no value with B's, so a set test is honest
            // here — and it catches a leak into a field nobody thought of.
            expect([k, printed.indexOf(theirs[k])]).toEqual([k, -1]);
        });
        expect(JSON.stringify(data.tissue)).not.toContain(POISON_SENTINEL);
    });

    test('site B\'s report carries every ion of B\'s own water sample, and none of A\'s', () => {
        const data = we.collectData(npi.resolveExportInputs({ siteId: OTHER_SITE_ID }));
        const own = sm.readingsOf('water', sm.getAllSamples().allSites[OTHER_SITE_ID].water['water-b']);
        const theirs = sm.readingsOf('water', sm.getAllSamples().allSites[SITE_ID].water['water-a']);
        expect(Object.keys(own).length).toBeGreaterThan(8);   // positive control
        ION_KEYS.forEach((k) => {
            if (own[k] === undefined) return;
            expect([k, data.water[k]]).toEqual([k, own[k]]);
        });
        // Key by key rather than by set membership: two different readings
        // can legitimately be the same number, and a set test would call that
        // a leak.
        ION_KEYS.forEach((k) => {
            if (theirs[k] === undefined || own[k] === theirs[k]) return;
            expect([k, data.water[k]]).not.toEqual([k, theirs[k]]);
        });
        expect(data.water.recordKey).toBe('water-b');
        // GH-511 (reviewer's finding C): the source's NAME and the sampling
        // date, beside the record key. `water.sourceLabel` was asserted
        // nowhere, so ions of one site could be printed under the name of
        // another's bore and nothing would notice.
        expect(data.water.sourceLabel).toBe('Dam B');
        expect(data.water.testDate).toBe('2001-03-03');
        expect(JSON.stringify(data.water)).not.toContain(POISON_SENTINEL);
    });

    test('the indices are computed from those ions, not taken from a page run', () => {
        const data = we.collectData(npi.resolveExportInputs({ siteId: OTHER_SITE_ID }));
        // SAR from B's own ions, by the definition the file states.
        const Na = data.water.Na / 23, Ca = data.water.Ca / 20, Mg = data.water.Mg / 12.15;
        expect(data.water.SAR).toBeCloseTo(Na / Math.sqrt((Ca + Mg) / 2), 6);
        // and the page's verdict is not printed at all
        expect(data.water.classification).toBeUndefined();
        expect(data.water.sodiumHazard).toBeUndefined();
        expect(data.water.salinityHazard).toBeUndefined();
        expect(data.water.isBlended).toBe(false);
        // GH-486: the omission is an OUTCOME in a map now, not a sentence on
        // the section, and the sentence is written by the consumer that prints
        // it. What is asserted here is the outcome; that it reaches the
        // document is gh486's own assertion, against word/document.xml.
        const omitted = (data.availability || []).filter((e) => e.reason === 'no-run-stamp');
        expect(omitted.map((e) => e.field).sort())
            .toEqual(['Tissue analysis verdict', 'Water analysis verdict']);
        // GH-488: the outcome of a verdict left out is `omitted` — the word the
        // twenty-eighth refinement gave it — not `unavailable`, which is about
        // a read that failed.
        omitted.forEach((e) => expect(e.outcome).toBe('omitted'));
    });

    test('three states: selected, on file but not selected, nothing on file', () => {
        const all = sm.getAllSamples();
        const selected = we.collectData(npi.resolveExportInputs({ siteId: SITE_ID }));
        expect(selected.tissue.state).toBe('selected');
        expect(selected.water.state).toBe('selected');

        // Nothing selected, records on file: the readings are absent AND the
        // document says how many are waiting — it does not reach for one.
        const innerAll = sm.getAllSamples;
        sm.getAllSamples = () => {
            const copy = innerAll();
            copy.allActive[SITE_ID] = { soil: copy.allActive[SITE_ID].soil };
            return copy;
        };
        try {
            const unselected = we.collectData(npi.resolveExportInputs({ siteId: SITE_ID }));
            expect(unselected.tissue.state).toBe('on-file-not-selected');
            expect(unselected.tissue.onFile).toBe(1);
            expect(unselected.tissue.N).toBeUndefined();
            expect(unselected.water.state).toBe('on-file-not-selected');
            expect(unselected.water.onFile).toBe(1);
            expect(unselected.water.EC).toBeUndefined();
            const sections = we.buildSections(unselected, {});
            expect(JSON.stringify(sections)).toContain('on file; none selected');
        } finally {
            sm.getAllSamples = innerAll;
        }
    });

    test('nothing on file is a third state, and prints nothing', () => {
        const innerAll = sm.getAllSamples;
        sm.getAllSamples = () => {
            const copy = innerAll();
            copy.allSites[SITE_ID] = { soil: copy.allSites[SITE_ID].soil, tissue: {}, water: {} };
            copy.allActive[SITE_ID] = { soil: copy.allActive[SITE_ID].soil };
            return copy;
        };
        try {
            const bare = we.collectData(npi.resolveExportInputs({ siteId: SITE_ID }));
            expect(bare.tissue.state).toBe('none-on-file');
            expect(bare.water.state).toBe('none-on-file');
            expect(bare.tissue.onFile).toBe(0);
            expect(JSON.stringify(we.buildSections(bare, {}))).not.toContain('on file; none selected');
        } finally {
            sm.getAllSamples = innerAll;
        }
    });

    test('the single export asks for the site\'s own active sample, not the page\'s pointer', () => {
        // The pointer is moved to site B while the report is about site A.
        const pointerWas = sm.getActiveSiteId();
        expect(sm.setActiveSite(OTHER_SITE_ID)).toBe(true);
        try {
            const data = we.collectData(npi.resolveExportInputs({ siteId: SITE_ID }));
            expect(data.tissue.recordKey).toBe('tissue-a');
            expect(data.water.recordKey).toBe('water-a');
            // GH-511: and the identity that travels with them, on this side too.
            expect(data.tissue.testDate).toBe('2026-08-08');
            expect(data.tissue.sampleLabel).toBe('Soccer tissue');
            expect(data.water.sourceLabel).toBe('Bore A');
            expect(data.water.testDate).toBe('2026-08-09');
            // The soil record's own date, the third kind: GH-490 moved it off
            // the page's active sample and nothing held it either.
            expect(data.soil.testDate).toBe('2026-08-17');
            expect(data.soil.sampleLabel).toBe('Soccer');
        } finally {
            sm.setActiveSite(pointerWas);
        }
    });

    test('the normalisation is one function, and the form uses it too', () => {
        const smSrc = fs.readFileSync(path.join(__dirname, '..', 'assets', 'sample-manager.js'), 'utf8');
        expect(smSrc).toMatch(/function readingsOf\(kind, sample\)/);
        expect(smSrc).toMatch(/readingsOf\('tissue', \{ values: row \|\| \{\} \}\)/);
        expect(typeof sm.readingsOf).toBe('function');
        // pure: no sample, no answer — and no reading invented for one
        expect(sm.readingsOf('tissue', null)).toBeNull();
        expect(sm.readingsOf('tissue', { values: {} })).toEqual({});
    });
});

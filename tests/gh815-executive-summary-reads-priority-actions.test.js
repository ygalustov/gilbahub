/**
 * GH-815 (queue item 3gy, client requirement R2) — THE FIRST LINE OF THE REPORT READS THE PRIORITY ACTIONS.
 *
 * The executive summary decided "is action needed" by flags of its own -- disease, stress, shade,
 * irrigation, water sodium, wear -- and was built before the Priority Actions, so a report whose
 * Priority Actions carried an immediate action opened with "No immediate action required". The owner's
 * decision, variant (a): an immediate action makes the line an alarm, planned actions only make it a
 * calm list, and the words are the Priority Actions' own -- no new wording.
 *
 * Every case prints what it examined: the lengths of the three arrays, the sources the Priority Actions
 * name, and the summary's own flags (the items of the printed line that are not Priority Actions lines).
 * "immediate 0" is then a number on the page, not a silence.
 *
 * Expected lines are written out here by hand -- the fixture -- and are not read off the document's
 * Priority Actions section: two surfaces that drift together would agree with each other.
 */
'use strict';

const { loadPage, SITE_ID } = require('./helpers/export-page-sandbox');
const { documentParts, flatText } = require('./helpers/word-document-reading');

function say(s) { process.stdout.write(s + '\n'); }

/** Soil 141 of the stand with the readings a case names; nothing short under MLSN unless the case says so. */
const SOIL = { B: 0.2, K: 40, P: 40, S: 75, Ca: 803, Cu: 1.3, EC: 0.16, Fe: 168, Mg: 129, Mn: 28.3,
    OM: 3.7, Zn: 5.7, CEC: 5.9, pH: 6.5 };
/** The sandbox's own water sample as it starts, put back after every case. */
const SANDBOX_WATER = { pH: 7.2, EC: 0.41, Ca: 22, Mg: 11, Na: 33, K: 4, Cl: 44, SO4: 12, HCO3: 55, CO3: 1, B: 0.2,
    Fe: 0.3, NO3: 2, PO4: 0.5, Mn: 0.1 };

async function build(page, st) {
    page.putSiteMethodology(st.methodology || 'mlsn');
    page.putSiteSpecies(st.species || 'Perennial Ryegrass');
    page.putSoilReadings(Object.assign({}, SOIL, st.soil || {}));
    page.putWaterReadings(Object.assign({}, SANDBOX_WATER, st.water || {}));
    if (st.disease) page.sandbox.GAIP_DISEASE_RESULT = st.disease;
    try {
        const WE = page.sandbox.GAIP_WordExport;
        const data = WE.collectData(page.sandbox.GAIP_NutritionProgramInputs.resolveExportInputs({ siteId: SITE_ID }));
        const parts = await documentParts(page.sandbox, data);
        const pa = WE.generatePriorityActions(data);
        return { data: data, parts: parts, text: flatText(parts), pa: pa };
    } finally {
        delete page.sandbox.GAIP_DISEASE_RESULT;
        page.putWaterReadings(SANDBOX_WATER);
    }
}

/**
 * Which source wrote an item, read off the item's own words. It is the other side of `sources`: a source
 * on the list with no item of its own would silence the summary's flag with nothing behind it, and an
 * item whose source is missing from the list would let the flag repeat it. Each case compares the two.
 */
const ITEM_OF_SOURCE = {
    disease: /disease risk/,
    irrigation: /Soil moisture/,
    traffic: /^Traffic load exceeds/,
    shade: /light deficit/
};

/** The printed summary line, and what it was made of. */
function readSummary(d) {
    const line = d.parts.map((p) => p.text.trim()).filter((t) => /^EXECUTIVE SUMMARY: /.test(t));
    const text = line.length === 1 ? line[0].replace(/^EXECUTIVE SUMMARY: /, '') : null;
    const paLines = [].concat(d.pa.immediate, d.pa.shortTerm, d.pa.mediumTerm).map((s) => s.replace(/\.$/, ''));
    let items = [];
    const m = text && text.match(/^(ATTENTION REQUIRED|Items to monitor): (.*)\.$/);
    if (m) items = m[2].split('. ');
    return {
        lines: line.length,
        text: text,
        examined: {
            immediate: d.pa.immediate.length, shortTerm: d.pa.shortTerm.length, mediumTerm: d.pa.mediumTerm.length,
            sources: d.pa.sources || null,
            ownFlags: items.filter((i) => paLines.indexOf(i) === -1)
        },
        sourcesByItems: Object.keys(ITEM_OF_SOURCE).filter((k) => paLines.some((l) => ITEM_OF_SOURCE[k].test(l))),
        prioritySection: d.parts.filter((p) => p.text.trim() === 'Priority Actions').length
    };
}

describe('GH-815 — the executive summary reads the Priority Actions', () => {
    jest.setTimeout(300000);
    let page;
    beforeAll(() => {
        page = loadPage({ errors: [], warnings: [], alerts: [] });
        expect(page.failures).toEqual([]);
    });

    test('sign 1 — an immediate action makes the first line an alarm, in the Priority Actions\' words', async () => {
        expect.hasAssertions();
        // Potassium below half the MLSN floor (severe band), bicarbonate water (gypsum to offset calcium removal).
        const d = await build(page, { soil: { K: 15 }, water: { EC: 0.4, Ca: 20, Mg: 12.15, Na: 46, HCO3: 150 } });
        const s = readSummary(d);
        say('[gh815] sign 1 examined: ' + JSON.stringify(s.examined) + '; summary: ' + JSON.stringify(s.text));
        // precondition: the immediate action is printed in the document's own section
        expect(d.text).toMatch(/Severe K deficiency - apply potassium sulphate promptly\./);
        expect(s.text).toBe('ATTENTION REQUIRED: Severe K deficiency - apply potassium sulphate promptly. Apply gypsum to offset calcium removal.');
        expect(s.examined).toEqual({ immediate: 1, shortTerm: 1, mediumTerm: 0, sources: [], ownFlags: [] });
        expect(s.sourcesByItems).toEqual([]);
    });

    test('sign 2 — planned actions only make it a calm list, every planned item in array order', async () => {
        expect.hasAssertions();
        // SAR 5.0: above the warning and below the critical of set 2 for a cool-season grass (4 / 6).
        const d = await build(page, { water: { EC: 0.4, Ca: 20, Mg: 12.15, Na: 115 } });
        const s = readSummary(d);
        say('[gh815] sign 2 examined: ' + JSON.stringify(s.examined) + '; summary: ' + JSON.stringify(s.text));
        expect(d.data._gypsumVerdict.SAR.level).toBe('warning');
        expect(s.text).toBe('Items to monitor: SAR elevated (5.0). Apply gypsum to protect Perennial Ryegrass.');
        expect(s.examined).toEqual({ immediate: 0, shortTerm: 2, mediumTerm: 0, sources: [], ownFlags: [] });
        expect(s.sourcesByItems).toEqual([]);
    });

    test('sign 3 — positive control: nothing to do, and the summary says so', async () => {
        expect.hasAssertions();
        const d = await build(page, {});
        const s = readSummary(d);
        say('[gh815] sign 3 examined: ' + JSON.stringify(s.examined) + '; summary: ' + JSON.stringify(s.text)
            + '; Priority Actions headings: ' + s.prioritySection);
        // One comparison, so a break shows on every part at once: what was examined, the section, the line.
        expect({ examined: s.examined, sourcesByItems: s.sourcesByItems, prioritySection: s.prioritySection, text: s.text }).toEqual({
            examined: { immediate: 0, shortTerm: 0, mediumTerm: 0, sources: [], ownFlags: [] },
            sourcesByItems: [],
            prioritySection: 0,
            text: 'All parameters within acceptable ranges. No immediate action required.'
        });
    });

    test('sign 4 — moderate disease risk: one item, the Priority Actions\' own, not the summary\'s flag beside it', async () => {
        expect.hasAssertions();
        const d = await build(page, { disease: { overallRisk: 'MODERATE', overallScore: 45, diseases: [] } });
        const s = readSummary(d);
        say('[gh815] sign 4 examined: ' + JSON.stringify(s.examined) + '; summary: ' + JSON.stringify(s.text));
        // precondition: the disease state reached the Priority Actions
        expect(d.pa.shortTerm).toContain('Moderate disease risk - schedule fungicide application, increase monitoring frequency.');
        expect(s.text).toBe('Items to monitor: Moderate disease risk - schedule fungicide application, increase monitoring frequency.');
        expect(s.examined).toEqual({ immediate: 0, shortTerm: 1, mediumTerm: 0, sources: ['disease'], ownFlags: [] });
        expect(s.sourcesByItems).toEqual(['disease']);
    });

    /**
     * THE READERS THAT WERE REMOVED STAY REMOVED. The water sodium flag of the summary and three rows of the
     * water table read keys nothing has written since GH-484. A grep shows they are gone today; this case
     * is what notices a reader coming back: the keys are put into the model the printer is handed, with
     * values no other part of the document carries, and the document prints none of them.
     */
    test('the water verdict keys put back into the model are printed nowhere (summary flag, water table)', async () => {
        expect.hasAssertions();
        const SENTINELS = { classification: 'GH815-CLASSIFICATION', sodiumHazard: 'GH815-SODIUM', salinityHazard: 'GH815-SALINITY' };
        page.putSiteMethodology('mlsn');
        page.putSiteSpecies('Perennial Ryegrass');
        page.putSoilReadings(SOIL);
        page.putWaterReadings(SANDBOX_WATER);
        const WE = page.sandbox.GAIP_WordExport;
        const data = WE.collectData(page.sandbox.GAIP_NutritionProgramInputs.resolveExportInputs({ siteId: SITE_ID }));
        Object.assign(data.water, SENTINELS);
        const parts = await documentParts(page.sandbox, data);
        const text = flatText(parts);
        const printed = Object.keys(SENTINELS).filter((k) => text.indexOf(SENTINELS[k]) !== -1)
            .concat(/Water sodium hazard/.test(text) ? ['summary flag'] : []);
        say('[gh815] dead keys put back: printed ' + JSON.stringify(printed)
            + '; water table printed: ' + /Bicarbonate \(HCO₃\)/.test(text));
        // precondition: the water table is in the document, so "nothing printed" is not "no table"
        expect(text).toMatch(/Bicarbonate \(HCO₃\)/);
        expect(printed).toEqual([]);
    });
});

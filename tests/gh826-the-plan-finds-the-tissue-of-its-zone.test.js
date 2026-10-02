/**
 * GH-826 (the owner's finding, a remainder of "Zones") — THE PLAN PAGE FINDS THE TISSUE SAMPLE OF ITS ZONE.
 *
 * The Plan page loaded the site's tissue samples from `/api/samples` and kept `{ id, label, date, N, P, K }` -- no
 * zone. The pair (`matchSampleToZone`) keys a soil sample by its zone (`zone:<id>`) and a tissue sample without a zone
 * by itself (`sample:<id>`), so the two never met: every zone printed "No tissue sample for this zone — generic P/K
 * removal ratios used." on every site with tissue, and the programme used the species table's ratios.
 *
 * THE TISSUE GOES IN THE WAY THE PAGE GETS IT -- the server's answer through `loadTissueSamples`, `fetch` stubbed with
 * a row of the shape `samplePayload` returns -- not as a ready list carrying `zoneId`. The cases of GH-803 handed the
 * pair a list with `zoneId` already in it, a shape the page never builds, and compared two surfaces of its own.
 */
'use strict';

global.window = global.window || {};
global.document = global.document || {
    addEventListener: function () {}, querySelector: function () { return null; },
    querySelectorAll: function () { return []; }, getElementById: function () { return null; },
};
global.localStorage = { getItem: function () { return null; }, setItem: function () {} };
const realConsole = global.console;
global.console = { log() {}, warn() {}, error() {}, info() {} };
require('../assets/zone-key.js');
global.window.GaipZoneKey = global.GaipZoneKey || global.window.GaipZoneKey;
const NPI = require('../assets/nutrition-program-inputs.js');
global.window.GAIP_NutritionProgramInputs = NPI;
global.window.GilbaGrowthPotentialEngine = require('../assets/growth-potential-engine.js');
require('../assets/nutrition-calendar.js');
const CAL = global.window.GilbaNutritionCalendar;
global.console = realConsole;

const SOCCER = '01a0f500-0000-7000-8000-00000000000a';
const ELSEWHERE = '01a0f500-0000-7000-8000-00000000000b';

/** A tissue row as the server answers it (`SampleController::samplePayload`): snake-cased zone, resolved readings. */
const serverTissue = (id, label, zoneId) => ({
    id: id, client_uid: null, sample_type: 'tissue', lab_date: '2026-09-20', sample_date: null,
    zone_id: zoneId, zone_name: 'Soccer', payload: { _label: label }, readings: { N: 4.1, P: 0.42, K: 2.3 },
});

/** The banner as the page prints it: `renderSummary` drawn over a minimal programme, its HTML read. */
function bannerPrinted() {
    const summary = { innerHTML: '' };
    const before = { elements: CAL.elements, program: CAL.program };
    CAL.elements = Object.assign({}, CAL.elements, { summary: summary });
    const totals = {}; ['N', 'P', 'K', 'Ca', 'Mg', 'S'].forEach((e) => { totals[e] = 10; });
    CAL.program = { annual_totals: totals, meta: { clippingManagement: 'returned', methodology: 'mlsn' },
        adjustments: { n_recycled: 0 }, missing_soil_data: {}, annual_totals_range_source: {} };
    try { CAL.renderSummary(); } finally { CAL.elements = before.elements; CAL.program = before.program; }
    return summary.innerHTML.indexOf('No tissue sample for this zone') !== -1;
}

async function planFor(soilZoneId, tissueZoneId) {
    const before = { fetch: global.fetch, site: CAL.getActiveSiteId };
    const row = serverTissue(331, 'Soccer', tissueZoneId);
    global.fetch = () => Promise.resolve({ ok: true, json: () => Promise.resolve({ data: [row] }) });
    CAL.getActiveSiteId = () => 'site-under-test';
    try {
        const list = await CAL.loadTissueSamples();
        const r = CAL.resolveZoneTissue(soilZoneId);
        const tz = CAL._tissueZoneMatch || {};
        return { row: row, percent: r.percent || null, banner: bannerPrinted(),
            examined: { soilZone: soilZoneId, tissueOnSite: (list || []).length, matched: tz.matchedLabel || null } };
    } finally {
        global.fetch = before.fetch;
        CAL.getActiveSiteId = before.site;
    }
}

describe('GH-826 — the Plan page finds the tissue sample of its zone', () => {
    test('tissue in the soil sample\'s zone: its own P/K, no banner', async () => {
        const got = await planFor(SOCCER, SOCCER);
        process.stdout.write('[gh826] same zone: ' + JSON.stringify({ percent: got.percent, banner: got.banner, examined: got.examined }) + '\n');
        // Expected from the server's row itself, not written out a second time.
        const rd = got.row.readings;
        expect(got.examined).toEqual({ soilZone: SOCCER, tissueOnSite: 1, matched: got.row.payload._label });
        expect({ percent: got.percent, banner: got.banner }).toEqual({ percent: { N: rd.N, P: rd.P, K: rd.K }, banner: false });
    });

    test('control, the banner: tissue in another zone -- the page prints it', async () => {
        const got = await planFor(SOCCER, ELSEWHERE);
        process.stdout.write('[gh826] another zone, banner: ' + JSON.stringify({ banner: got.banner, examined: got.examined }) + '\n');
        expect({ banner: got.banner, examined: got.examined }).toEqual({ banner: true, examined: { soilZone: SOCCER, tissueOnSite: 1, matched: null } });
    });

    test('control, no zone: a tissue sample the server gives no zone is paired with no zone', async () => {
        const got = await planFor(SOCCER, null);
        process.stdout.write('[gh826] tissue without a zone: ' + JSON.stringify({ percent: got.percent, banner: got.banner, examined: got.examined }) + '\n');
        expect({ percent: got.percent, banner: got.banner, matched: got.examined.matched }).toEqual({ percent: null, banner: true, matched: null });
    });

    test('control, the ratios: tissue in another zone -- no tissue ratios', async () => {
        const got = await planFor(SOCCER, ELSEWHERE);
        process.stdout.write('[gh826] another zone, ratios: ' + JSON.stringify(got.percent) + '\n');
        expect(got.percent).toBeNull();
    });
});

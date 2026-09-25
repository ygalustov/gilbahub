/**
 * GH-731 (queue item 3g) — EACH DOOR THAT ASSEMBLES WATER KEEPS A MEASURED ZERO, AND NAMES ITSELF.
 *
 * WHY THIS FILE EXISTS, and it is the reviewer's finding rather than the author's. The repair of
 * this class put `!== null` on four gates in `hub-persistence.js`. Reverting three of them to the
 * old `> 0` left the set green at 16 passed: only the run-parameter door had a case, so three
 * repairs rested on nothing. The three are the SAMPLE-STORE fallback, the DOM fallback and the
 * lab's own reported SAR.
 *
 * WHAT EACH CASE PRINTS. The door it actually reached, by the `source` the producer stamps on the
 * row it assembles. A case that asserts a zero without saying which door produced it is the same
 * as no case at all: the run-parameter door answers for all three if nobody looks.
 *
 * THE PRODUCER IS EXECUTED, not read, on the bench eleven other files use, and it is handed the
 * product's own reading normaliser rather than a stub.
 */

'use strict';

const vm = require('vm');
const fs = require('fs');
const path = require('path');

const { loadManager } = require('./lib/sample-form-bench');

const ASSETS = path.join(__dirname, '..', 'assets');
const SRC = fs.readFileSync(path.join(ASSETS, 'hub-persistence.js'), 'utf8');
const MAP = JSON.parse(fs.readFileSync(path.join(ASSETS, 'lab-reading-names.json'), 'utf8'));
const LIVE = require('./fixtures/gh764-live-water-samples.json');

/**
 * One bench, three doors. `search` decides whether the run parameter names a sample; `store`
 * decides what the sample store holds for the active site; `ecwField` decides whether the page
 * carries a conductivity field at all.
 */
function produce({ search, store, ecwField }) {
    const exportLine = 'global.GilbaPersistence = GilbaPersistence;';
    expect(SRC).toContain(exportLine);
    const testSrc = SRC.replace(exportLine,
        exportLine + '\n    global.__test_cacheAnalysisResults = cacheAnalysisResults;');

    const el = (value) => ({ value, getAttribute: () => null });
    const sandbox = {
        console: { log() {}, warn() {}, error() {} },
        setTimeout: () => 0, clearTimeout() {}, setInterval: () => 0, clearInterval() {},
        document: {
            readyState: 'complete', addEventListener() {},
            getElementById: () => null,
            querySelector: (sel) => (sel === '.gaip-ecw' && ecwField !== undefined ? el(ecwField) : null),
            querySelectorAll: () => [],
            body: { appendChild() {}, removeChild() {} },
        },
        location: { search },
        URLSearchParams, Date, JSON, Math, Object, Array, String, Number,
        parseFloat, parseInt, isNaN, Promise,
        fetch: () => Promise.resolve({ ok: true, status: 200, json: () => Promise.resolve({}) }),
    };
    sandbox.window = sandbox;
    sandbox.global = sandbox;
    sandbox.globalThis = sandbox;
    sandbox.GAIP_HUB_CONFIG = { activeSiteId: 'site-1' };
    sandbox.GAIP_STATE = { inputs: { soil: {}, water: {} }, computed: {} };
    // The product's OWN readers, both of them. A bench that omits `labReadingOf` answers `null`
    // for every lab reading and the answer describes the bench, not the run: that is how the first
    // draft of this file reported a lab SAR of zero as absent.
    const { sm } = loadManager(MAP);
    sandbox.GAIP_SampleManager = {
        readingsOf: sm.readingsOf,
        labReadingOf: sm.labReadingOf,
        getSamples: () => [],
        getActiveSample: () => null,
        getActiveSiteId: () => 'site-1',
        getAllSamples: () => ({
            allSites: store ? { 'site-1': { water: store } } : {},
            allActive: {}, allMeta: {}, sites: {},
        }),
    };
    sandbox.GaipOrchestrator = {
        noteSkipped() {}, recordProblem() {}, getState: () => ({ computed: {} }),
    };

    const ctx = vm.createContext(sandbox);
    vm.runInContext(testSrc, ctx, { filename: 'hub-persistence.js' });
    const snap = ctx.__test_cacheAnalysisResults();
    return (snap.computed && snap.computed.waterBalance) || null;
}

/** A tank of rainwater: the lab looked at conductivity and found zero. */
const EC_ZERO = {
    id: 'sample_w7',
    rawData: { _label: 'Rainwater tank', EC: '0', Ca: '3', Mg: '5', Na: '2', pH: '7.1', HCO3: '2' },
};
/**
 * A lab that measured sodium adsorption and reported zero for it, AND NO CALCIUM OR MAGNESIUM.
 * The ions matter to the case rather than to the water: with them present the row's SAR is
 * computed from them and the lab's own number is never consulted, so a case carrying ions is green
 * whatever the gate on the lab reading says. That is how the first draft of this case passed under
 * the reviewer's mutation -- it never reached the path it was written to guard.
 */
const SAR_ZERO = {
    id: 'sample_w8',
    rawData: { _label: 'Rainwater tank', EC: '0.4', pH: '7.1', SAR: '0' },
};

describe('GH-731 — the three doors that had no case', () => {
    test('THE SAMPLE-STORE DOOR: a stored sample whose conductivity is zero reaches the row, and the row says it was that door', () => {
        const wb = produce({ search: '?rerun=r&site=site-1', store: { w0: EC_ZERO } });
        process.stdout.write('[gh731] store door -> ' + JSON.stringify(wb && { ecw: wb.ecw, source: wb.source }) + '\n');

        expect(wb).not.toBeNull();
        expect(wb.source).toBe('sample-store-fallback');
        expect(wb.ecw).toBe(0);
    });

    test('THE DOM DOOR: a page field holding zero reaches the row, and the row says it was that door', () => {
        const wb = produce({ search: '?rerun=r&site=site-1', store: null, ecwField: '0' });
        process.stdout.write('[gh731] DOM door -> ' + JSON.stringify(wb && { ecw: wb.ecw, source: wb.source }) + '\n');

        expect(wb).not.toBeNull();
        expect(wb.source).toBe('dom-fallback');
        expect(wb.ecw).toBe(0);
    });

    test('THE DOM DOOR, the other half: no field at all is silence, not a zero', () => {
        const wb = produce({ search: '?rerun=r&site=site-1', store: null });
        process.stdout.write('[gh731] DOM door, no field -> ' + JSON.stringify(wb && { ecw: wb.ecw, source: wb.source }) + '\n');

        expect(wb === null || wb.ecw === null).toBe(true);
    });

    test('THE LAB SAR: a lab that reports SAR 0 has measured it, and the row carries the zero', () => {
        const wb = produce({ search: '?rerun=r&site=site-1', store: { w0: SAR_ZERO } });
        process.stdout.write('[gh731] lab SAR -> ' + JSON.stringify(wb && { SAR: wb.SAR, ecw: wb.ecw, source: wb.source }) + '\n');

        expect(wb).not.toBeNull();
        expect(wb.SAR).toBe(0);
    });
});

/**
 * GH-764 — THE REPAIRED DOOR, AGAINST EVERY LIVE WATER SAMPLE ON THE STAND.
 *
 * The door assembled nothing at all until GH-764, so the cases above are the first to reach it.
 * These drive it with the real payloads rather than invented ones, one sample at a time, which
 * also sidesteps a question this file does not answer: which of three same-date samples the
 * door's comparator picks is undetermined, and asserting one of them would be asserting a defect.
 *
 * THE COST OF THE REPAIR, MEASURED AND CARRIED IN THE FIXTURE RATHER THAN IN PROSE: no live site
 * depends on this door today. Three sites hold a water sample; each produced rows after the door
 * died on 22.09 08:33, and every one of those rows carried a conductivity. What the census cannot
 * see is listed beside it in the fixture, including the one that matters most -- the database
 * keeps no record of whether the page carried water, which is what decides the door taken.
 *
 * WHAT THESE EIGHT CASES DO NOT GUARD, measured rather than assumed: the `> 0` gate one line above
 * the assembly. Not one live water sample carries a conductivity of zero -- the eight run from 0.31
 * to 90 -- so reverting that gate leaves all eight green. They guard that the door hands over the
 * sample's OWN conductivity; the zero rule is guarded by the case above them, which is written for
 * a reading of zero and reddens on that revert. Both are needed, and neither covers the other.
 */
describe('GH-764 — the store door, on the live samples it is for', () => {
    test('every live water sample reaches the row through this door, with its own conductivity', () => {
        const seen = LIVE.samples.map((s) => {
            const wb = produce({
                search: '?rerun=r&site=site-1',
                store: { w0: { id: 'sample_' + s.id, rawData: s.payload } },
            });
            return { site: s.site, id: s.id, expected: s.EC, ecw: wb && wb.ecw, source: wb && wb.source };
        });
        seen.forEach((r) => process.stdout.write('[gh764] ' + r.site + ' #' + r.id
            + ' | EC in the sample ' + r.expected + ' -> row ecw ' + JSON.stringify(r.ecw)
            + ' | door ' + JSON.stringify(r.source) + '\n'));

        expect(seen.map((r) => [r.id, r.ecw, r.source]))
            .toEqual(LIVE.samples.map((s) => [s.id, s.EC, 'sample-store-fallback']));
    });

    test('the census of who depends on this door is carried with what it cannot see', () => {
        const c = LIVE.dependency_census;
        process.stdout.write('[gh764] sites with a water sample: ' + c.sites_with_a_water_sample
            + ' | rows after the door died: ' + JSON.stringify(c.rows_after_that_per_site)
            + ' | of them carrying water: ' + JSON.stringify(c.rows_after_that_carrying_water_per_site) + '\n');

        // Not the count: the list, site by site. A count of 16 would be the same number if one
        // site had lost its water and another had gained a run.
        expect(c.rows_after_that_carrying_water_per_site).toEqual(c.rows_after_that_per_site);

        // The reviewer's return, and it is the same move as the line above: the BOUNDARIES are
        // guarded by their list, not by how many there are. A count of three stays three when one
        // boundary is dropped and another invented, which is the case worth catching -- a census
        // that loses "the database does not record the page's state" has lost the boundary that
        // decides what the number means. The wording stays in the fixture so it can be improved
        // without touching this case; the keys are what this case holds.
        process.stdout.write('[gh764] boundaries it names: '
            + JSON.stringify(c.what_this_does_not_see.map((b) => b.key)) + '\n');
        expect(c.what_this_does_not_see.map((b) => b.key)).toEqual([
            'page-state-not-recorded', 'sample-only-in-a-browser', 'today-not-reachability',
        ]);
        // And the EXPLANATION is a second subject in the same place, guarded the way the tree
        // already guards a reason rather than a list: by its length. `gh471-sources-are-read-not-
        // declared` asks more than 40 characters of `_why` and `gh546-analysis-results-single-owner`
        // more than 20 of each exemption, because a boundary reduced to "not measured" is present
        // in the list and says nothing -- being named and being explained fail separately.
        c.what_this_does_not_see.forEach((b) => {
            expect(String(b.why).length).toBeGreaterThan(40);
        });
    });
});

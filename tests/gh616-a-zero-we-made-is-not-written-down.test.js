/**
 * GH-616 — A ZERO THE CODE PRODUCED IS NOT A READING, AND IS NOT WRITTEN DOWN.
 *
 * THE OWNER SETTLED IT: write nothing. Her word was emptiness, in her own
 * language, for a zero that arrived from nowhere; the key is simply absent
 * unless the sample carried the reading.
 *
 * WHAT WAS WRONG, COUNTED. `_meq` answers `(parseFloat(x) || 0) / factor`, so
 * an ion nobody measured came out 0 and the key sat in the stored object all
 * the same. Across the ten rows that carry any ions at all there are 80 values
 * and 62 of them are zero: TWO measured — carbonate on `Burns` and on
 * `New test - location` — and SIXTY produced on the way, 56 of those on seven
 * sites with no water sample at all. The record said "zero" where the truth was
 * "nobody measured it", and from the row the two were the same thing.
 *
 * WHAT THIS DOES NOT CHANGE, AND IT WAS THE CONDITION OF DOING IT AT ALL. SAR,
 * RSC, LSI and the sodium percentage need a number for every term. They read
 * the plain variables `_Ca`, `_Mg`, `_Na` and the rest, which are still numbers
 * and still zero for an absent reading; only the stored object is narrowed. The
 * last case here asserts that, because a repair that quietly turned those into
 * `undefined` would show up as arithmetic silently not running.
 *
 * AND NOTHING ON SCREEN MOVES — measured before the work rather than hoped.
 * Every reader of the stored object takes each ion as `ions.X || 0`, or asks
 * `parseFloat(ions.X) > 0`, which is false for `undefined` exactly as it was
 * for 0; the row's own ion table asks `measuredIons` since GH-611. The sixty
 * zeros were never on a screen: with all eight zero, `renderIons` returns
 * nothing at all and the section is absent, which is why the coordinator's
 * first description — rows of zeros a client could see — did not survive
 * measurement.
 */

'use strict';

const vm = require('vm');
const fs = require('fs');
const path = require('path');

const { realReadingsOf } = require('./lib/sample-readings');

const ASSETS = path.join(__dirname, '..', 'assets');
const SRC = fs.readFileSync(path.join(ASSETS, 'hub-persistence.js'), 'utf8');

/** `Burns` sample 54: carbonate measured, and it is zero. */
const MEASURED_ZERO_CO3 = {
    id: 'sample_w1',
    rawData: { _label: 'Dam', EC: '0.5', Ca: '46', Mg: '14.6', Na: '20.7', pH: '7.1', HCO3: '150', CO3: '0' },
};
/** `Russley` 115: no carbonate key, no chloride, no sulphate, no potassium. */
const NO_CO3 = {
    id: 'sample_w2',
    rawData: { _label: 'Bore', EC: '0.5', Ca: '46', Mg: '14.6', Na: '20.7', pH: '7.1', HCO3: '150' },
};

function produce(sample) {
    const exportLine = 'global.GilbaPersistence = GilbaPersistence;';
    expect(SRC).toContain(exportLine);
    const testSrc = SRC.replace(exportLine,
        exportLine + '\n    global.__test_cacheAnalysisResults = cacheAnalysisResults;');

    const sandbox = {
        console: { log() {}, warn() {}, error() {} },
        setTimeout: () => 0, clearTimeout() {}, setInterval: () => 0, clearInterval() {},
        document: {
            readyState: 'complete', addEventListener() {},
            getElementById: () => null, querySelector: () => null, querySelectorAll: () => [],
            body: { appendChild() {}, removeChild() {} },
        },
        location: { search: '?rerun=r&site=site-1&water=' + sample.id },
        URLSearchParams, Date, JSON, Math, Object, Array, String, Number,
        parseFloat, parseInt, isNaN, Promise,
        fetch: () => Promise.resolve({ ok: true, status: 200, json: () => Promise.resolve({}) }),
    };
    sandbox.window = sandbox;
    sandbox.global = sandbox;
    sandbox.globalThis = sandbox;
    sandbox.GAIP_HUB_CONFIG = { activeSiteId: 'site-1' };
    sandbox.GAIP_STATE = { inputs: { soil: {}, water: {} }, computed: {} };
    sandbox.GAIP_SampleManager = {
        readingsOf: realReadingsOf(),
        getSamples: () => [],
        getActiveSample: () => null,
        getActiveSiteId: () => 'site-1',
        getAllSamples: () => ({
            allSites: { 'site-1': { water: { w0: sample } } },
            allActive: {}, allMeta: {}, sites: {},
        }),
    };
    sandbox.GaipOrchestrator = {
        noteSkipped() {}, recordProblem() {}, note() {}, getState: () => ({ computed: {} }),
    };

    const ctx = vm.createContext(sandbox);
    vm.runInContext(testSrc, ctx, { filename: 'hub-persistence.js' });
    const snap = ctx.__test_cacheAnalysisResults();
    return (snap.computed && snap.computed.waterBalance) || null;
}

describe('GH-616 — the record carries the ions the lab measured, and no others', () => {
    test('the bench reached the water block at all', () => {
        // Positive control: without it every absence below could be the
        // absence of a whole water balance rather than of one key.
        const wb = produce(MEASURED_ZERO_CO3);
        expect(wb).toBeTruthy();
        process.stdout.write('[gh616] keys written for a full sample: '
            + Object.keys(wb.ions).sort().join(', ') + '\n');
    });

    test('an ion nobody measured gets no key — the sixty zeros', () => {
        const wb = produce(NO_CO3);
        process.stdout.write('[gh616] keys written when CO3, Cl, SO4 and K were never tested: '
            + Object.keys(wb.ions).sort().join(', ') + '\n');

        expect(wb.ions).not.toHaveProperty('CO3');
        expect(wb.ions).not.toHaveProperty('Cl');
        expect(wb.ions).not.toHaveProperty('SO4');
        expect(wb.ions).not.toHaveProperty('K');
        // And what WAS measured is still there, or "writes nothing" would be
        // true of a producer that stopped writing anything.
        expect(wb.ions.Ca).toBeCloseTo(46 / 20.04, 5);
        expect(wb.ions.HCO3).toBeCloseTo(150 / 61.0, 5);
    });

    test('a measured zero keeps its key, which is the other half of the rule', () => {
        // The distinction the whole day was about: absent says nothing,
        // measured says zero.
        const wb = produce(MEASURED_ZERO_CO3);
        expect(wb.ions).toHaveProperty('CO3');
        expect(wb.ions.CO3).toBe(0);
    });

    test('the arithmetic still runs on a number for every term', () => {
        // The reviewer's condition, asserted rather than promised: SAR, RSC and
        // the sodium percentage read the plain variables, not the stored
        // object, so narrowing the object must not silence them.
        const wb = produce(NO_CO3);

        expect(wb.SAR).not.toBeNull();
        expect(Number.isNaN(wb.SAR)).toBe(false);
        expect(wb.RSC).not.toBeNull();
        expect(Number.isNaN(wb.RSC)).toBe(false);
        expect(wb.naPct).not.toBeNull();
        // RSC is HCO3 + CO3 - Ca - Mg, and the absent carbonate must count as
        // zero there — the same number it always was.
        expect(wb.RSC).toBeCloseTo(
            Math.round((150 / 61.0 + 0 - 46 / 20.04 - 14.6 / 12.15) * 100) / 100, 5);
    });

    test('what the table draws is decided by measuredIons, not by this narrowing', () => {
        // Stated so the two changes are not confused: GH-611 moved the screen
        // onto `measuredIons`, and this one narrows `ions`. Both describe the
        // same sample, and if they ever disagree the row says two things.
        const wb = produce(NO_CO3);
        expect(Object.keys(wb.ions).sort())
            .toEqual(Object.keys(wb.measuredIons).filter((k) => k in wb.ions).sort());
        expect(wb.measuredIons).not.toHaveProperty('CO3');
    });
});

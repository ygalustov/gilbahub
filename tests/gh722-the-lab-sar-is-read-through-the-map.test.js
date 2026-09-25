/**
 * GH-722 (delivery 5) — THE STORED ROW'S LAB SAR IS READ THROUGH THE LAB READING NAMES MAP.
 *
 * The row's water block takes SAR from the ions; only when it cannot (`_SAR === null`) does it fall
 * back to a SAR the lab reported, and only when that is above zero. That rule is unchanged here and
 * is the owner's to change (whether a lab SAR should win over the ions is an open question). What
 * changed is how the lab SAR is FOUND: by name through the map (`labReadingOf`), not by the chain
 * `SAR || sar || SAR_ppm` written in `hub-persistence.js`.
 *
 * Run on the producer itself, as `gh608` does, with the real sample manager handed the map. The
 * cases are the rule's own: a lab SAR with no ions arrives, in either case of its name; with ions it
 * does not decide; a sample without one leaves SAR as the ions left it.
 */

'use strict';

const vm = require('vm');
const fs = require('fs');
const path = require('path');
const { loadManager } = require('./lib/sample-form-bench');

const ASSETS = path.join(__dirname, '..', 'assets');
const SRC = fs.readFileSync(path.join(ASSETS, 'hub-persistence.js'), 'utf8');
const MAP = JSON.parse(fs.readFileSync(path.join(ASSETS, 'lab-reading-names.json'), 'utf8'));

function produce(rawData, named = true, activeOther = null) {
    const exportLine = 'global.GilbaPersistence = GilbaPersistence;';
    expect(SRC).toContain(exportLine);
    const testSrc = SRC.replace(exportLine, exportLine + '\n    global.__test_cacheAnalysisResults = cacheAnalysisResults;');
    const { sm } = loadManager(MAP);
    const sample = { id: 'sample_w1', rawData };
    const sandbox = {
        console: { log() {}, warn() {}, error() {} },
        setTimeout: () => 0, clearTimeout() {}, setInterval: () => 0, clearInterval() {},
        document: {
            readyState: 'complete', addEventListener() {},
            getElementById: () => null, querySelector: () => null, querySelectorAll: () => [],
            body: { appendChild() {}, removeChild() {} },
        },
        // Named: the water the run was told about (`&water=`), read as the chosen sample.
        // Not named: the row's own fallback finds the site's water sample in the store.
        location: { search: '?rerun=r&site=site-1' + (named ? '&water=' + sample.id : '') },
        URLSearchParams, Date, JSON, Math, Object, Array, String, Number, parseFloat, parseInt, isNaN, Promise,
        fetch: () => Promise.resolve({ ok: true, status: 200, json: () => Promise.resolve({}) }),
    };
    sandbox.window = sandbox; sandbox.global = sandbox; sandbox.globalThis = sandbox;
    sandbox.GAIP_HUB_CONFIG = { activeSiteId: 'site-1' };
    sandbox.GAIP_STATE = { inputs: { soil: {}, water: {} }, computed: {} };
    sandbox.GAIP_SampleManager = {
        readingsOf: sm.readingsOf,
        labReadingOf: sm.labReadingOf,
        getSamples: () => [],
        getActiveSample: () => null,
        getActiveSiteId: () => 'site-1',
        // `activeOther`: a second water sample on the site, marked active, so the row's own
        // fallback finds IT and not the named one — the named road is then the only road.
        getAllSamples: () => (activeOther
            ? { allSites: { 'site-1': { water: { w0: sample, w9: { id: 'sample_w9', rawData: activeOther } } } },
                allActive: { 'site-1': { water: 'w9' } }, allMeta: {}, sites: {} }
            : { allSites: { 'site-1': { water: { w0: sample } } }, allActive: {}, allMeta: {}, sites: {} }),
    };
    sandbox.GaipOrchestrator = { noteSkipped() {}, recordProblem() {}, getState: () => ({ computed: {} }) };
    const ctx = vm.createContext(sandbox);
    vm.runInContext(testSrc, ctx, { filename: 'hub-persistence.js' });
    const snap = ctx.__test_cacheAnalysisResults();

    return (snap.computed && snap.computed.waterBalance) || null;
}

describe('GH-722 — the row\'s lab SAR is found through the map, and its rule is unchanged', () => {
    test('with no ions, the lab SAR arrives on both roads, however its column is cased', () => {
        const got = [true, false].map((named) => ['SAR', 'sar'].map((col) => {
            const wb = produce({ _label: 'Bore', EC: '0.5', pH: '7.1', [col]: '4.2' }, named);
            return wb && wb.SAR;
        }));
        process.stdout.write('[gh722] lab SAR, no ions, [named water, store fallback] x [SAR, sar] -> ' + JSON.stringify(got) + '\n');
        expect(got).toEqual([[4.2, 4.2], [4.2, 4.2]]);
    });

    test('the named water\'s lab SAR arrives by its own road, when the store\'s active water has none', () => {
        const wb = produce({ _label: 'Bore', EC: '0.5', pH: '7.1', SAR: '4.2' }, true, { _label: 'Dam', EC: '0.4', pH: '7.0' });
        process.stdout.write('[gh722] named water with SAR, active water without -> ' + JSON.stringify(wb && wb.SAR) + '\n');
        expect(wb.SAR).toBe(4.2);
    });

    test('with no lab SAR and no ions, SAR stays empty — nothing is made up', () => {
        const none = produce({ _label: 'Bore', EC: '0.5', pH: '7.1' });
        process.stdout.write('[gh722] no SAR at all -> ' + JSON.stringify(none && none.SAR) + '\n');
        expect(none.SAR).toBeNull();
    });

    test('with ions present, the ions decide and the lab SAR does not', () => {
        const both = produce({ _label: 'Bore', EC: '0.5', pH: '7.1', Na: '46', Ca: '40', Mg: '12', SAR: '9.9' });
        process.stdout.write('[gh722] ions and a lab SAR -> ' + JSON.stringify(both && both.SAR) + '\n');
        // The ions reached the block, or this case is about nothing.
        expect(both.ions && both.ions.Na).toBeTruthy();
        expect(typeof both.SAR).toBe('number');
        expect(both.SAR).not.toBe(9.9);
    });
});

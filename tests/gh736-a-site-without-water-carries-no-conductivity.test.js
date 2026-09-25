/**
 * GH-736 — A SITE WITH NO WATER SAMPLE CARRIES NO CONDUCTIVITY, AND NOTHING IS DERIVED FROM ONE.
 *
 * `gaip_build_state` assembled the run's water as `ecw: sample ? (sample.ecw || 0) : 0`: a site that
 * has never had its water tested was handed a conductivity of zero, which is the reading of the
 * purest water there is. For as long as the row's last gate in `hub-persistence.js` collapsed every
 * zero into absence, that zero died there. GH-731 made a measured zero a measurement at that gate,
 * correctly, and the substituted zero started to pass with it: the row was about to say `ecw 0` and
 * `leachingFraction 10` for every site without a water sample, and the water page prints the second
 * as "Leaching fraction required 10%".
 *
 * Run on the two real producers, in the order the run uses them: the assembly as the file declares
 * it, then the row's water block (`cacheAnalysisResults`). The case the change is about is a site
 * with no sample; its neighbours are a sample with a conductivity and a sample that measured zero,
 * which must arrive as they were measured — the second is GH-731's own meaning and stays.
 *
 * NOT HERE, and said: the water `pH` of the same block is still substituted with 7 when there is no
 * sample. What a site without water should show is the owner's to decide (GH-735); this file does
 * not assert it either way.
 */

'use strict';

const vm = require('vm');
const fs = require('fs');
const path = require('path');
const { stubSampleManager } = require('./lib/sample-readings');
const { loadManager } = require('./lib/sample-form-bench');

const ASSETS = path.join(__dirname, '..', 'assets');
const HUB = fs.readFileSync(path.join(ASSETS, 'hub-tissue-v3.js'), 'utf8');
const PERSIST = fs.readFileSync(path.join(ASSETS, 'hub-persistence.js'), 'utf8');
const MAP = JSON.parse(fs.readFileSync(path.join(ASSETS, 'lab-reading-names.json'), 'utf8'));

const ASSEMBLY = ['safeNum', 'collectGridValues', 'convertDateToISO', 'calculateEndDate', 'gaip_readSoilForm',
    'gaip_soilFromActiveSample', 'gaip_soilStateFrom', 'gaip_namedSample', 'gaip_sampleReadings',
    'gaip_waterFromActiveSample', 'calculateC3C4Fractions', 'enforceHemisphereTurfRules', 'gaip_build_state'];

function declared(name) {
    const at = HUB.indexOf('function ' + name + '(');
    expect(at).toBeGreaterThan(-1);
    let depth = 0;
    for (let j = HUB.indexOf('{', at); j < HUB.length; j++) {
        if (HUB[j] === '{') depth++;
        else if (HUB[j] === '}') { depth--; if (!depth) return HUB.slice(at, j + 1); }
    }
    throw new Error('unbalanced ' + name);
}

/** The run's water block, from `gaip_build_state` itself, with the site's water sample or none. */
function assembledWater(sample) {
    const sandbox = {
        console: { log() {}, warn() {}, error() {} },
        document: { querySelector: () => null, querySelectorAll: () => [] },
        location: { search: '' }, URLSearchParams,
        Date, JSON, Math, Object, Array, String, Number, parseFloat, parseInt, isNaN,
    };
    sandbox.window = sandbox; sandbox.global = sandbox; sandbox.globalThis = sandbox;
    sandbox.GAIP_SampleManager = stubSampleManager(sample ? { water: sample } : {});
    const ctx = vm.createContext(sandbox);
    ASSEMBLY.forEach((name) => vm.runInContext(declared(name), ctx, { filename: name }));
    const hub = { querySelector: () => null, querySelectorAll: () => [] };

    return ctx.gaip_build_state(hub).water;
}

/** The row's water block, built by the real producer from that water. */
function rowWater(water, sample) {
    const exportLine = 'global.GilbaPersistence = GilbaPersistence;';
    expect(PERSIST).toContain(exportLine);
    const src = PERSIST.replace(exportLine, exportLine + '\n    global.__test_cacheAnalysisResults = cacheAnalysisResults;');
    const { sm } = loadManager(MAP);
    const sandbox = {
        console: { log() {}, warn() {}, error() {} },
        setTimeout: () => 0, clearTimeout() {}, setInterval: () => 0, clearInterval() {},
        document: {
            readyState: 'complete', addEventListener() {},
            getElementById: () => null, querySelector: () => null, querySelectorAll: () => [],
            body: { appendChild() {}, removeChild() {} },
        },
        location: { search: '?rerun=r&site=site-1' },
        URLSearchParams, Date, JSON, Math, Object, Array, String, Number, parseFloat, parseInt, isNaN, Promise,
        fetch: () => Promise.resolve({ ok: true, status: 200, json: () => Promise.resolve({}) }),
    };
    sandbox.window = sandbox; sandbox.global = sandbox; sandbox.globalThis = sandbox;
    sandbox.GAIP_HUB_CONFIG = { activeSiteId: 'site-1' };
    sandbox.GAIP_STATE = { inputs: { soil: {}, water }, computed: {} };
    const store = sample ? { w0: { id: 'sample_w0', rawData: sample } } : {};
    sandbox.GAIP_SampleManager = {
        readingsOf: sm.readingsOf,
        labReadingOf: sm.labReadingOf,
        getSamples: () => [],
        getActiveSample: () => null,
        getActiveSiteId: () => 'site-1',
        getAllSamples: () => ({ allSites: { 'site-1': { water: store } }, allActive: {}, allMeta: {}, sites: {} }),
    };
    sandbox.GaipOrchestrator = { noteSkipped() {}, recordProblem() {}, getState: () => ({ computed: {} }) };
    vm.runInContext(src, vm.createContext(sandbox), { filename: 'hub-persistence.js' });
    const wb = sandbox.__test_cacheAnalysisResults().computed.waterBalance;

    return { ecw: wb.ecw, leachingFraction: wb.leachingFraction };
}

function run(sample) {
    const water = assembledWater(sample);
    const row = rowWater(water, sample);
    process.stdout.write('[gh736] sample ' + JSON.stringify(sample || null) + ' -> assembly ecw '
        + JSON.stringify(water.ecw) + ' -> row ' + JSON.stringify(row) + '\n');

    return { water, row };
}

describe('GH-736 — no water sample, no conductivity: the assembly carries absence to the row', () => {
    test('a site with no water sample: the assembly hands over no conductivity, and the row derives nothing from one', () => {
        const { water, row } = run(null);
        expect(water.ecw).toBeNull();
        expect(row).toEqual({ ecw: null, leachingFraction: null });
    });

    test('a sample with a conductivity arrives as measured, with the leaching fraction it earns', () => {
        const { water, row } = run({ _label: 'Bore', EC: '0.72', Na: '20' });
        expect(water.ecw).toBe(0.72);
        expect(row).toEqual({ ecw: 0.72, leachingFraction: 12 });
    });

    test('a sample that measured zero keeps its zero — GH-731\'s meaning is not undone', () => {
        const { water, row } = run({ _label: 'Tank', EC: '0', Na: '1' });
        expect(water.ecw).toBe(0);
        expect(row.ecw).toBe(0);
    });
});

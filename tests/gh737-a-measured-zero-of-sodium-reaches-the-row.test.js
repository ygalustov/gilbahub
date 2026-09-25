/**
 * GH-737 — A SODIUM THE LAB MEASURED AT ZERO REACHES THE ROW AS ZERO, THROUGH EITHER DOOR.
 *
 * The row's `soilNutrition.soilNa` is written by two doors of `cacheAnalysisResults`:
 *   - the pass's own soil (`_si`), `(_si.ppm && _si.ppm.Na) || _si.Na_ppm || null`;
 *   - the sample-store fallback (`fromSample`), `_smPpm.Na || (readingsOf(...).Na || 0) || _smNaDom || null`.
 * Both are `||` chains, so a measured zero fell through them: to `null` in the first, and in the
 * second to the page's Na field and then to `null`. The same class as GH-731's four places, where
 * a value that parses is a reading whatever it is.
 *
 * No stored sample carries a zero sodium today (113 soil samples on the stand, 103 with Na, none
 * at zero), so nothing on a screen moves; this is a trap closed before a lab reports one.
 *
 * Run on the real producers. The first door is fed by `gaip_build_state` itself, as the run feeds
 * it; the second by the sample store, with no pass state, which is the only way that door opens.
 * Each door has its neighbours: a measured sodium arrives as measured, and a sample without one
 * keeps `null` — absence is not turned into a zero on the way.
 *
 * NOT HERE, and said: when the sample has no sodium, the second door still reads the page's Na
 * field (`_smNaDom`). That is a read of the page, a different class, and its behaviour is unchanged.
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

/** The pass's soil, from `gaip_build_state` with the site's soil sample. */
function passSoil(sample) {
    const sandbox = {
        console: { log() {}, warn() {}, error() {} },
        document: { querySelector: () => null, querySelectorAll: () => [] },
        location: { search: '' }, URLSearchParams,
        Date, JSON, Math, Object, Array, String, Number, parseFloat, parseInt, isNaN,
    };
    sandbox.window = sandbox; sandbox.global = sandbox; sandbox.globalThis = sandbox;
    sandbox.GAIP_SampleManager = stubSampleManager({ soil: sample });
    const ctx = vm.createContext(sandbox);
    ASSEMBLY.forEach((name) => vm.runInContext(declared(name), ctx, { filename: name }));

    return ctx.gaip_build_state({ querySelector: () => null, querySelectorAll: () => [] }).soil;
}

function soilNutrition({ state, store }) {
    const exportLine = 'global.GilbaPersistence = GilbaPersistence;';
    expect(PERSIST).toContain(exportLine);
    const src = PERSIST.replace(exportLine, exportLine + '\n    global.__test_cacheAnalysisResults = cacheAnalysisResults;');
    const { sm } = loadManager(MAP);
    const sandbox = {
        console: { log() {}, warn() {}, error() {} },
        localStorage: { getItem: () => null, setItem() {}, removeItem() {} },
        setTimeout: () => 0, clearTimeout() {}, setInterval: () => 0, clearInterval() {},
        document: {
            readyState: 'complete', addEventListener() {},
            getElementById: () => null, querySelector: () => null, querySelectorAll: () => [],
            body: { appendChild() {}, removeChild() {} },
        },
        location: { search: '' },
        URLSearchParams, Date, JSON, Math, Object, Array, String, Number, parseFloat, parseInt, isNaN, Promise,
        fetch: () => Promise.resolve({ ok: true, status: 200, json: () => Promise.resolve({}) }),
    };
    sandbox.window = sandbox; sandbox.global = sandbox; sandbox.globalThis = sandbox;
    sandbox.GAIP_HUB_CONFIG = { activeSiteId: 'site-1' };
    sandbox.GAIP_STATE = state;
    sandbox.GaipOrchestrator = { getState: () => sandbox.GAIP_STATE };
    sandbox.GAIP_SampleManager = {
        readingsOf: sm.readingsOf,
        getSamples: () => [],
        getActiveSample: () => null,
        getActiveSiteId: () => 'site-1',
        getAllSamples: () => ({ allSites: { 'site-1': { soil: store || {} } }, allActive: {}, allMeta: {}, sites: {} }),
    };
    sandbox.mlsnEngine = () => ({ html: '', nutrients: [] });
    vm.runInContext(src, vm.createContext(sandbox), { filename: 'hub-persistence.js' });

    return sandbox.__test_cacheAnalysisResults().computed.soilNutrition || null;
}

/** First door: the pass's soil, built by the run from the sample. */
function throughThePass(sample) {
    const sn = soilNutrition({ state: { inputs: { soil: passSoil(sample) }, computed: {} } });
    process.stdout.write('[gh737] pass door   ' + JSON.stringify(sample) + ' -> soilNa ' + JSON.stringify(sn && sn.soilNa)
        + ', fromSample ' + JSON.stringify(sn && sn.fromSample) + '\n');

    return sn;
}

/** Second door: no pass state, the site's soil sample in the store. */
function throughTheStore(sample) {
    const sn = soilNutrition({ state: { inputs: {}, computed: {} }, store: { s1: { date: '2026-08-01', rawData: sample } } });
    process.stdout.write('[gh737] store door  ' + JSON.stringify(sample) + ' -> soilNa ' + JSON.stringify(sn && sn.soilNa)
        + ', fromSample ' + JSON.stringify(sn && sn.fromSample) + '\n');

    return sn;
}

describe('GH-737 — a measured zero of sodium is a reading, through both doors of the row', () => {
    test('each bench opens the door it is named for', () => {
        expect(throughThePass({ Na: '40', pH: '6.2' }).fromSample).toBeUndefined();
        expect(throughTheStore({ Na: '40', pH: '6.2' }).fromSample).toBe(true);
    });

    test('the pass door: zero arrives as zero; a measured sodium as measured; none stays null', () => {
        expect(throughThePass({ Na: '0', pH: '6.2' }).soilNa).toBe(0);
        expect(throughThePass({ Na: '40', pH: '6.2' }).soilNa).toBe(40);
        expect(throughThePass({ K: '40', pH: '6.2' }).soilNa).toBeNull();
    });

    test('the store door: zero arrives as zero; a measured sodium as measured; none stays null', () => {
        expect(throughTheStore({ Na: '0', pH: '6.2' }).soilNa).toBe(0);
        expect(throughTheStore({ Na_ppm: '0', pH: '6.2' }).soilNa).toBe(0);
        expect(throughTheStore({ Na: '40', pH: '6.2' }).soilNa).toBe(40);
        expect(throughTheStore({ K: '40', pH: '6.2' }).soilNa).toBeNull();
    });
});

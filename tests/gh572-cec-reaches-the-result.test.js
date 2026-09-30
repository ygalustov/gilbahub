/**
 * GH-572 — THE MEASURED CEC REACHES THE RESULT.
 *
 * `analysis_results` id 31 stored `CEC: null` while the site's own soil sample
 * held 5.9. The producer read CEC from the hub form alone — `_si.CEC || _si.cec
 * || null` — and had no path to the sample, alone among the four values in that
 * block: `pH`, `ECe` and `soilNa` all fall through to `_soilSmpPH`, `_soilSmpECe`
 * and `_soilSmpNa`. So `pH = 6` and `ECe = 1.12` arrived from the sample and the
 * CEC beside them in the same sample did not.
 *
 * This is the mirror of what the question has spent its time removing. A
 * substitution puts a number where there was none; this dropped a number that
 * had been measured. The repair is a path to the sample, not a default: when
 * nothing measured a CEC, the result keeps its null.
 *
 * GH-589 CHANGED THE ROAD, NOT THE CLAIM. The path added here read the sample
 * store a SECOND time, at the moment the body was assembled — which is a
 * different moment from the one the nutrient list beside it was computed at,
 * and that is link 4's whole defect: one row in which pH and CEC were the
 * sample's real numbers and all ten cards said "NOT MEASURED". The second read
 * is gone. The measured CEC now arrives the way the list does, through the
 * state the cascade pass collected, and this file executes that chain: the
 * sample goes through `gaip_soilFromActiveSample` — the run's own reader — and
 * the result of THAT is what the producer is given.
 *
 * HOW IT BITES: drop `CEC` from what the reader returns, or drop `_si.CEC` from
 * the producer's CEC line, and the first cases go red with `null` where 5.9
 * belongs, while the control cases stay green.
 */

'use strict';

const vm = require('vm');
const fs = require('fs');
const path = require('path');

const { stubSampleManager } = require('./lib/sample-readings');

const ASSETS = path.join(__dirname, '..', 'assets');
const read = (f) => fs.readFileSync(path.join(ASSETS, f), 'utf8');

/**
 * The site's own soil sample, `samples` id 141, read with SELECT and written
 * down — the same numbers `gh568` measures the engine against. Values are
 * STRINGS because that is how `samples.payload` holds them.
 */
const SAMPLE_AS_STORED = {
    B: '0.2', K: '40', P: '40', S: '75', Ca: '803', Cu: '1.3', EC: '0.16',
    Fe: '168', Mg: '129', Mn: '28.3', OM: '3.7', Zn: '5.7', pH: '6', CEC: '5.9',
    zone: 'Other', _label: 'Soccer',
};

/**
 * `cacheAnalysisResults()` is internal, so it is exposed by splicing the export
 * line — the shape eleven other test files use. The assertion on that line is
 * the positive control: a rename would otherwise leave this testing an empty
 * sandbox.
 */
/**
 * The soil block as the RUN builds it, from the sample, using the run's own
 * reader rather than a hand-written object. A literal here would be this file
 * agreeing with itself about what a sample turns into.
 */
function passSoilFrom(sample) {
    const hub = read('hub-tissue-v3.js');
    const slice = (name) => {
        const at = hub.indexOf('function ' + name + '(');
        expect(at).toBeGreaterThan(-1);
        let depth = 0;
        for (let j = hub.indexOf('{', at); j < hub.length; j++) {
            if (hub[j] === '{') depth++;
            else if (hub[j] === '}') { depth--; if (!depth) return hub.slice(at, j + 1); }
        }
        throw new Error('unbalanced ' + name);
    };
    const box = { console: { log() {}, warn() {} }, Object, Array, String, Number, parseFloat, isNaN, JSON };
    box.window = box; box.global = box; box.globalThis = box;
    // GH-591: the product's own normaliser, not a stub of it — see
    // `tests/lib/sample-readings.js`.
    box.GAIP_SampleManager = stubSampleManager(sample ? { soil: sample } : {});
    const ctx = vm.createContext(box);
    // GH-778: the soil block asks `gaip_sampleInHand` for the run's own sample now — the server names it on
    // the frame's address and one function in the frame reads that answer. A bench lifting the block alone
    // would be measuring a block with no reader.
    ['gaip_namedSample', 'gaip_sampleInHand'].forEach((n) => vm.runInContext(slice(n), ctx, { filename: n }));
    vm.runInContext(slice('gaip_soilFromActiveSample'), ctx, { filename: 'gaip_soilFromActiveSample' });
    expect(typeof ctx.gaip_soilFromActiveSample).toBe('function');
    const read141 = ctx.gaip_soilFromActiveSample();
    if (!read141) return {};
    // The four names `gaip_build_state` gives them, and the ECe it derives from
    // EC and the site's texture — the same expression, so this file does not
    // invent a second one.
    return {
        ppm: read141.ppm,
        pH_water: read141.pH_water,
        CEC: read141.CEC,
        EC1_5: read141.EC,
        ECe: read141.EC === null || read141.EC === undefined ? null : read141.EC * 7,
    };
}

function produce({ form, sample }) {
    const src = read('hub-persistence.js');
    const exportLine = 'global.GilbaPersistence = GilbaPersistence;';
    expect(src).toContain(exportLine);
    const testSrc = src.replace(exportLine,
        exportLine + '\n    global.__test_cacheAnalysisResults = cacheAnalysisResults;');

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
        URLSearchParams, Date, JSON, Math, Object, Array, String, Number,
        parseFloat, parseInt, isNaN,
    };
    sandbox.window = sandbox;
    sandbox.global = sandbox;
    sandbox.globalThis = sandbox;
    sandbox.GAIP_SampleManager = stubSampleManager(sample ? { soil: sample } : {});
    // The producer reads `global.GAIP_STATE`, which is what the orchestrator
    // publishes; the shape is the one its own comment documents.
    sandbox.GAIP_STATE = { inputs: { soil: form }, computed: {} };
    sandbox.GaipOrchestrator = { getState: () => sandbox.GAIP_STATE };

    const ctx = vm.createContext(sandbox);
    vm.runInContext(testSrc, ctx, { filename: 'hub-persistence.js' });
    const snap = ctx.__test_cacheAnalysisResults();
    return (snap.computed && snap.computed.soilNutrition) || null;
}

describe('GH-572 — a CEC that was measured is not dropped', () => {
    test('the sandbox reaches the block at all, and the pass carries the sample’s siblings', () => {
        // Positive control. `pH` and `ECe` arriving is what tells us the block
        // was entered — without this, a null CEC below would be
        // indistinguishable from a bench that never got there.
        const sn = produce({ form: passSoilFrom(SAMPLE_AS_STORED), sample: SAMPLE_AS_STORED });
        expect(sn).not.toBeNull();
        expect(sn.pH).toBe(6);
        expect(sn.ECe).toBeCloseTo(0.16 * 7, 5);
    });

    test('the sample has a CEC — the measured value arrives in the result', () => {
        const sn = produce({ form: passSoilFrom(SAMPLE_AS_STORED), sample: SAMPLE_AS_STORED });
        expect(sn.CEC).toBe(5.9);
    });

    test('the value that arrives is the SAMPLE’s, read the way the run reads it', () => {
        // Compared with the stored sample, not with a number written here: the
        // producer and the reader are two of our own surfaces, and two of our
        // surfaces agreeing proves only that they agree.
        const sn = produce({ form: passSoilFrom(SAMPLE_AS_STORED), sample: SAMPLE_AS_STORED });
        expect(sn.CEC).toBe(parseFloat(SAMPLE_AS_STORED.CEC));
        expect(sn.pH).toBe(parseFloat(SAMPLE_AS_STORED.pH));
    });

    test('nothing measured one — the result keeps its null, and nothing is put in its place', () => {
        // The rule this repair had to be careful of. An absent CEC stays
        // absent; it does not acquire a plausible number because a path now
        // exists.
        const { CEC, ...rest } = SAMPLE_AS_STORED;
        const sn = produce({ form: passSoilFrom(rest), sample: rest });
        expect(sn.CEC).toBeNull();
        // and the run is otherwise intact, so the null is about CEC and not
        // about the block having failed
        expect(sn.pH).toBe(6);
    });

    test('a sample with no soil data at all leaves every one of the four null', () => {
        const sn = produce({ form: passSoilFrom({}), sample: {} });
        expect([sn.CEC, sn.pH, sn.ECe, sn.soilNa]).toEqual([null, null, null, null]);
    });
});

/**
 * GH-608 — A MEASURED ZERO IS A READING; AN ABSENT KEY IS SILENCE.
 *
 * THE OWNER'S RULE, and it is not about boron. A reading that arrived is
 * printed, whatever it is; a key that never arrived says nothing, because
 * nobody measured it. Two states, and they had collapsed into one:
 * `parseFloat(x) || null` in the row producer turned a measured 0 into `null`,
 * which is exactly what an untested water gives, so a lab that looked for boron
 * and found none was indistinguishable from a lab that never looked.
 *
 * THE BOUNDARY, also the owner's, and it is asserted here rather than left in
 * prose: printing the zero is about a reading that came FROM THE LAB, not about a
 * zero this code produced on the way — by a substitution, a fallback, or an
 * engine that did not run. Those zeros are still untrue and belong to their own
 * subject. So the case below that matters most is the one with NO KEY: it must
 * stay silent, or the repair has caught the wrong thing entirely and is to be
 * withdrawn rather than adjusted.
 *
 * MEASURED ON THE STAND BEFORE ANY OF THIS WAS WRITTEN. Eight live water
 * samples. Boron is carried by exactly one — `Burns`, sample 54, `payload.B = 0`
 * — and the other seven have no `B` key at all. The stored row for `Burns`
 * (`analysis_results` 63, 23.09.2026 02:53) carried `waterBalance.B = null`
 * beside a sample whose boron is 0, which is the collapse in a client's data.
 * Iron travels with it: `Burns` has `Fe = 1.3`, the five `New test - location`
 * samples have iron and no boron, and `Russley` has neither.
 *
 * The producer is executed, not read. The bench is the one eleven other files
 * use, and it is handed the PRODUCT's own normaliser rather than a stub, for
 * the reason GH-595 established: a bench more forgiving than the run proves
 * nothing about the run.
 */

'use strict';

const vm = require('vm');
const fs = require('fs');
const path = require('path');

const { realReadingsOf } = require('./lib/sample-readings');

const ASSETS = path.join(__dirname, '..', 'assets');
const SRC = fs.readFileSync(path.join(ASSETS, 'hub-persistence.js'), 'utf8');

/** `Burns` sample 54 as the store holds it: boron measured, and it is zero. */
const MEASURED_ZERO = {
    id: 'sample_w1',
    rawData: { _label: 'Dam Water', EC: '0.5', Ca: '3', Mg: '5', Na: '2', pH: '7.1', HCO3: '2', B: '0', Fe: '1.3' },
};
/** A `New test - location` sample: no boron key anywhere, iron present. */
const NOT_MEASURED = {
    id: 'sample_w2',
    rawData: { _label: 'Bore', EC: '0.5', Ca: '3', Mg: '5', Na: '2', pH: '7.1', HCO3: '2', Fe: '0.33' },
};
/** An ordinary reading, so "keeps zero" is not confused with "keeps nothing". */
const ORDINARY = {
    id: 'sample_w3',
    rawData: { _label: 'Bore', EC: '0.5', Ca: '3', Mg: '5', Na: '2', pH: '7.1', HCO3: '2', B: '0.4', Fe: '0' },
};

/**
 * GH-731 (queue items 3g and 3am) — the same rule, on the CONDUCTIVITY and on a reported SAR.
 *
 * The boron above proved the rule for a trace ion. These two are the places it had not reached:
 * a conductivity of zero was thrown away by a `> 0` gate and by a `||` chain, and a lab that
 * reports SAR 0 was treated as a lab that reported nothing.
 */
const EC_MEASURED_ZERO = {
    id: 'sample_w4',
    rawData: { _label: 'Rainwater tank', EC: '0', Ca: '3', Mg: '5', Na: '2', pH: '7.1', HCO3: '2', B: '0.4', Fe: '1' },
};
/** The other half: no EC key at all, which must stay silent rather than become a zero. */
const EC_NOT_MEASURED = {
    id: 'sample_w5',
    rawData: { _label: 'Bore', Ca: '3', Mg: '5', Na: '2', pH: '7.1', HCO3: '2', B: '0.4', Fe: '1' },
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
        noteSkipped() {}, recordProblem() {}, getState: () => ({ computed: {} }),
    };

    const ctx = vm.createContext(sandbox);
    vm.runInContext(testSrc, ctx, { filename: 'hub-persistence.js' });
    const snap = ctx.__test_cacheAnalysisResults();
    return (snap.computed && snap.computed.waterBalance) || null;
}

describe('GH-608 — the row keeps a measured zero and stays silent about an absent key', () => {
    test('the bench reaches the water block at all', () => {
        // Positive control. Without it every claim below would hold over a
        // producer that never got as far as the water, and both halves of the
        // rule would read as satisfied by nothing happening.
        const wb = produce(MEASURED_ZERO);
        expect(wb).toBeTruthy();
        expect(wb.ions).toBeTruthy();
        process.stdout.write('[gh608] water block reached; ions: ' + Object.keys(wb.ions).join(', ') + '\n');
    });

    test('a measured zero is kept as zero', () => {
        const wb = produce(MEASURED_ZERO);
        process.stdout.write('[gh608] boron measured as 0 -> ' + JSON.stringify(wb.B) + '\n');

        expect(wb.B).toBe(0);
        // Asserted separately, because `null == 0` is false but `!0` is true,
        // and the defect was written with the second.
        expect(wb.B).not.toBeNull();
    });

    test('an absent key stays silent, which is the half that must not be over-caught', () => {
        const wb = produce(NOT_MEASURED);
        process.stdout.write('[gh608] boron never measured -> ' + JSON.stringify(wb.B) + '\n');

        expect(wb.B).toBeNull();
    });

    test('and the two states are now distinguishable, which is the whole rule', () => {
        // Stated as one assertion so it cannot be lost among the others: before
        // this change both sides of it were `null`.
        expect(produce(MEASURED_ZERO).B).not.toBe(produce(NOT_MEASURED).B);
    });

    test('iron travels with boron, under the same rule and in both directions', () => {
        // The owner's rule is about the two states, not about one element, so
        // the second exposure is asserted rather than assumed to follow.
        expect(produce(ORDINARY).Fe).toBe(0);
        expect(produce(MEASURED_ZERO).Fe).toBe(1.3);
        expect(produce(NOT_MEASURED).Fe).toBe(0.33);
    });

    test('GH-731: a conductivity measured as zero reaches the row as zero', () => {
        const wb = produce(EC_MEASURED_ZERO);
        process.stdout.write('[gh731] EC measured as 0 -> ecw ' + JSON.stringify(wb && wb.ecw)
            + ' | the block was reached: ' + !!(wb && wb.ions) + '\n');
        // The block must be reached at all: the old gate skipped it entirely on a zero, so a
        // silent row and a zero row were the same thing.
        expect(wb).toBeTruthy();
        expect(wb.ecw).toBe(0);
        expect(wb.ecw).not.toBeNull();
    });

    test('GH-731: and an absent conductivity stays silent, which is the half not to over-catch', () => {
        const wb = produce(EC_NOT_MEASURED);
        process.stdout.write('[gh731] EC absent -> ecw ' + JSON.stringify(wb && wb.ecw) + '\n');
        expect(wb === null || wb.ecw === null).toBe(true);
    });

    test('an ordinary non-zero reading is untouched', () => {
        // The control for the repair itself: a change that kept zeros by
        // breaking everything else would pass every case above.
        expect(produce(ORDINARY).B).toBe(0.4);
    });
});

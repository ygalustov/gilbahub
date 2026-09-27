/**
 * GH-735 (queue item 3bh) — THE pH A SITE NEVER MEASURED, PRINTED AS A VERDICT.
 *
 * `gaip_build_state` puts `pH: 7` where a site has no water reading, and the seven travels into the
 * stored row: measured on the stand, 50 of 86 rows carry `waterBalance.pH = 7`, and in 46 of them
 * `ecw` is JSON null and `diagnostics` is null -- the seven reaches storage where the zero beside it
 * does not.
 *
 * WHAT THE PAGE DOES WITH IT, executed here rather than read: the water page has no diagnostics in
 * such a row, so it builds its own (`_buildFallbackDiagnostics`), and that function prints a pH row
 * whenever `wb.pH != null`. The fixture below is a real stored row of a site with no water sample at
 * all (`analysis_results` 81, read 28.09), reduced to the water fields.
 *
 * The owner's rule for this class, twice recorded: a reading that arrived is printed; a key that
 * never arrived says nothing, "because we did not measure it". A seven this code produced is not a
 * reading, so a verdict resting on it -- "Suitable", "No adjustment required" -- is a verdict about
 * nothing.
 *
 * WHAT THIS FILE DOES NOT DECIDE: whether the person should see the row vanish or see an explicit
 * "no water sample". That is the owner's, and it is open. This holds the measurable half: the words
 * of a positive verdict are not printed for a pH nobody measured.
 */
'use strict';

const vm = require('vm');
const fs = require('fs');
const path = require('path');

const { stubSampleManager } = require('./lib/sample-readings');

const SRC = fs.readFileSync(path.join(__dirname, '..', 'assets', 'water-balance-analysis.js'), 'utf8');
const HUB = fs.readFileSync(path.join(__dirname, '..', 'assets', 'hub-tissue-v3.js'), 'utf8');

/** The functions `gaip_build_state` needs, as `gh736` runs them: the assembly, executed. */
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

/** The run's water block, from `gaip_build_state` itself, with a water sample or none. */
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

    return ctx.gaip_build_state({ querySelector: () => null, querySelectorAll: () => [] }).water;
}

/** `_buildFallbackDiagnostics` is internal, so it is exposed beside the module's own export line. */
function fallbackDiagnostics(wb) {
    const exportLine = 'global.GAIP_WaterBalanceAnalysis = {';
    expect(SRC).toContain(exportLine);
    const testSrc = SRC.replace(exportLine,
        'global.__test_buildFallbackDiagnostics = _buildFallbackDiagnostics;\n    ' + exportLine);

    const sandbox = {
        console: { log() {}, warn() {}, error() {} },
        setTimeout: () => 0, clearTimeout() {}, setInterval: () => 0, clearInterval() {},
        document: {
            readyState: 'complete', addEventListener() {},
            getElementById: () => null, querySelector: () => null, querySelectorAll: () => [],
            createElement: () => ({ style: {}, appendChild() {}, setAttribute() {} }),
            body: { appendChild() {}, removeChild() {} },
        },
        JSON, Math, Object, Array, String, Number, Date,
        parseFloat, parseInt, isNaN, Promise, RegExp,
        fetch: () => Promise.resolve({ ok: true, json: () => Promise.resolve({}) }),
    };
    sandbox.window = sandbox;
    sandbox.global = sandbox;
    sandbox.globalThis = sandbox;

    const ctx = vm.createContext(sandbox);
    vm.runInContext(testSrc, ctx, { filename: 'water-balance-analysis.js' });
    return ctx.__test_buildFallbackDiagnostics(wb);
}

/** `analysis_results` 81 — a site with no water sample, reduced to the water fields. */
const NO_WATER_SAMPLE = {
    pH: 7, ecw: null, SAR: null, SARadj: null, RSC: 0, LSI: null, naPct: null,
    B: null, Fe: null, ions: [], measuredIons: [], traceIons: [], diagnostics: null,
    salinity: null, source: null, sourceLabel: null, testDate: null, leachingFraction: null,
};

const rowFor = (diags, label) => (diags || []).filter((d) => d.label === label);

describe('GH-735 — a pH nobody measured is not a verdict', () => {
    test('a site with no water sample is assembled with no pH, as it is assembled with no conductivity', () => {
        const water = assembledWater(null);
        process.stdout.write('[gh735] the run assembles, for a site with no water sample: '
            + JSON.stringify({ pH: water.pH, ecw: water.ecw }) + '\n');

        // The conductivity's zero went in GH-736 and the seven stayed; both are absences now.
        expect(water.pH).toBeNull();
        expect(water.ecw).toBeNull();
    });

    test('a sample that carries a pH still hands it over, which is the half not to over-catch', () => {
        const water = assembledWater({ _label: 'Bore', pH: '6.2', EC: '0.5' });
        process.stdout.write('[gh735] and with a sample whose pH is 6.2: '
            + JSON.stringify({ pH: water.pH, ecw: water.ecw }) + '\n');

        expect(water.pH).toBe(6.2);
    });

    test('with no pH in the row the page builds no pH verdict, and prints what it does build', () => {
        const withoutSeven = Object.assign({}, NO_WATER_SAMPLE, { pH: null, RSC: null });
        const diags = fallbackDiagnostics(withoutSeven);
        process.stdout.write('[gh735] rows for a row carrying no water figure at all: '
            + JSON.stringify(diags) + '\n');

        expect(rowFor(diags, 'pH')).toEqual([]);
        expect(rowFor(diags, 'Residual Sodium Carbonate')).toEqual([]);
    });

    test('MEASURED FIRST: what the page builds today for a row whose only water figure is the seven', () => {
        const diags = fallbackDiagnostics(NO_WATER_SAMPLE);
        process.stdout.write('[gh735] rows the page builds: ' + JSON.stringify(diags) + '\n');

        expect(Array.isArray(diags)).toBe(true);
    });
});

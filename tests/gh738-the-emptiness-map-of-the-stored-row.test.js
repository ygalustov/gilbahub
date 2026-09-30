/**
 * GH-738 (queue item 3bshch) — WHICH KEYS OF THE STORED ROW ARE EMPTY, DECLARED AND COMPARED.
 *
 * WHY THIS EXISTS, and the case that called for it is not hypothetical. `GH-731` repaired the
 * choice of sample and passed its acceptance; a neighbouring item then measured that the stored
 * row had changed from `ecw null, leachingFraction null` to `ecw 0, leachingFraction 10`. Nothing
 * was wrong with either repair: a stand-in from a different place stopped being blocked and began
 * to arrive. The suite was green throughout, because every case looked at the subject of its own
 * item, and "a repair here woke a default there" is nobody's subject.
 *
 * WHAT IS COMPARED, and it is deliberately not the values. Values move for lawful reasons on
 * every run — weather, a sample, a season. What must not move quietly is whether a key is EMPTY:
 * `null -> 0` means a number appeared where the row used to say "not known", and that is a
 * different sentence to whoever reads it. So the map is `key -> null | filled`, declared in a
 * fixture and asserted per key.
 *
 * IT DOES NOT NEED THE DATABASE. The map is taken from what the run ASSEMBLED, before the write,
 * which is what makes it answer the case above: there were no stored rows after the repair yet.
 *
 * WHAT IT DOES NOT SEE, said rather than left: it measures one assembled row on the bench, so a
 * key that only appears on another branch — another turf type, another set of samples — is not in
 * the map and its drift is not caught here. The map names what it measured.
 */

'use strict';

const fs = require('fs');
const path = require('path');
const vm = require('vm');
const { load, computeAll } = require('./lib/orchestrator-bench');
const { stubSampleManager } = require('./lib/sample-readings');

/**
 * GH-738 (the reviewer's return) — THE RUN'S STATE IS ASSEMBLED THE WAY THE PRODUCT ASSEMBLES IT.
 *
 * The map used to be taken over a state the bench made up: an object with `soil`, `water`, `tissue`
 * as empty literals. The product does not build it that way — `gaip_build_state` in
 * `hub-tissue-v3.js` does, out of the site's samples and the form — so a substitution written in
 * that assembly could not move a single key of the map, and the reviewer of this item proved it
 * with one that stayed green. A map of a state nobody assembles is a map of the bench.
 *
 * So the state comes from `gaip_build_state` itself, the shape `gh736` already uses: the named
 * functions are lifted from the file and run, and what they return is what the run is given.
 */
const ASSEMBLY = ['safeNum', 'collectGridValues', 'convertDateToISO', 'calculateEndDate',
    'gaip_readSoilForm', 'gaip_soilFromActiveSample', 'gaip_soilStateFrom', 'gaip_namedSample',
    'gaip_sampleInHand', 'gaip_sampleReadings', 'gaip_waterFromActiveSample', 'calculateC3C4Fractions',
    'enforceHemisphereTurfRules', 'gaip_lastPgrForThisRun', 'gaip_build_state'];

/**
 * The samples the assembly is given: real lab spellings, so `gaip_sampleReadings` recognises them
 * through the map rather than through a name invented here. The water one carries a conductivity,
 * which is what makes `computed.waterBalance.ecw` a FILLED key and therefore a key a substitution
 * in the water assembly can move.
 */
const SAMPLES = {
    soil: { pH_Water: 6.4, CEC: 12.5, K: 95, P: 28, Ca: 1450, Mg: 210, S: 14, Fe: 180, Mn: 22, Zn: 3.1, Cu: 1.4, B: 0.4 },
    // NO conductivity on purpose. `computed.waterBalance.ecw` is then `null`, which is the state the
    // case that called for this map was about: a stand-in of 0 appearing where the row used to say
    // "not known". A water sample WITH an EC makes that key filled either way, and a substitution
    // in the water assembly becomes invisible — measured, the reviewer'''s mutation stayed green.
    water: { pH: 7.1, Na: 48, Ca: 22, Mg: 9, K: 4, HCO3: 110, Cl: 55, SO4: 18 },
};

/** One function's source, taken from `hub-tissue-v3.js` by its own declaration. */
function declaredIn(src, name) {
    const at = src.indexOf('function ' + name + '(');
    expect(at).toBeGreaterThan(-1);
    let depth = 0;
    for (let j = src.indexOf('{', at); j < src.length; j++) {
        if (src[j] === '{') depth++;
        else if (src[j] === '}') { depth--; if (!depth) return src.slice(at, j + 1); }
    }
    throw new Error('unbalanced ' + name);
}

/** The run's state, built by the product's own assembly out of a site's samples. */
function stateFromTheProduct(samples) {
    const hubSrc = fs.readFileSync(path.join(__dirname, '..', 'assets', 'hub-tissue-v3.js'), 'utf8');
    const sandbox = {
        console: { log() {}, warn() {}, error() {} },
        document: { querySelector: () => null, querySelectorAll: () => [] },
        location: { search: '' }, URLSearchParams,
        Date, JSON, Math, Object, Array, String, Number, parseFloat, parseInt, isNaN,
    };
    sandbox.window = sandbox; sandbox.global = sandbox; sandbox.globalThis = sandbox;
    sandbox.GAIP_SampleManager = stubSampleManager(samples || {});
    const ctx = vm.createContext(sandbox);
    ASSEMBLY.forEach((name) => vm.runInContext(declaredIn(hubSrc, name), ctx, { filename: name }));

    return ctx.gaip_build_state({ querySelector: () => null, querySelectorAll: () => [] });
}

jest.setTimeout(180000);

const FIXTURE = path.join(__dirname, 'fixtures', 'gh738-emptiness-map.json');

/**
 * GH-738, on the reviewer's return — THE BOUNDARY IS PRINTED BY THE RUN, not only written in the
 * item. A tool prints what it inspected, not just its verdict; without that, "green" and "it never
 * reached the subject" read the same. This map has a real edge — it walks ONE path — and whoever
 * reads a green here should read that edge in the same breath.
 */
const BOUNDARY = '[gh738] BOUNDARY: this map covers the ONE path the bench executes. A key that only'
    + ' appears on another branch — another turf type, another set of samples, the DOM assembly in'
    + ' hub-tissue-v3.js — is not in the map at all, and a substitution written there passes green.'
    + ' The map names what it measured.';

/**
 * `hub-persistence.js` keeps both to itself, and they are not in the same scope: the assembly is
 * a module function and reachable where the module exports itself, while `_bodyMetrics` is
 * declared INSIDE another function and is not in scope there — measured, it came back `undefined`
 * and the map had no `metrics.*` at all. So each gets a point of access beside its own
 * declaration, which is the shape `gh588` already uses.
 */
function exposeAssembly() {
    const exportLine = '    global.GilbaPersistence = GilbaPersistence;';
    const afterMetrics = '        /** The one write. Reached only when the run completed. */';

    return {
        'hub-persistence.js': (src) => {
            expect(src).toContain(exportLine);
            expect(src).toContain(afterMetrics);

            /**
             * AND THE BENCH MUST BE A RUN FRAME, which is the real condition of this assembly and
             * not a trick to get at it. `_bodyMetrics` and the write live inside the branch taken
             * only when the address carries `?rerun=&site=`; with the bench's empty `location`
             * that branch never runs and the function does not exist — measured, it came back
             * `undefined` twice before this was found. A row is assembled by a run, so the map of
             * that row is measured in a run.
             */
            return "location.search = '?rerun=gh738&site=gh738-site';\n" + src
                .replace(exportLine, exportLine + '\n    global.__gh738_assemble = cacheAnalysisResults;')
                .replace(afterMetrics, '        global.__gh738_metrics = _bodyMetrics;\n' + afterMetrics);
        },
    };
}

/**
 * `null | filled`, per key, DOWN TO THE LEAVES — because the case this exists for is a leaf.
 *
 * The first version mapped the top sections only, and `ecw` lives inside `computed.waterBalance`:
 * the very drift that called for this — `ecw null -> 0` — would have passed under a map of
 * sections. A device that cannot find the case it was built for is not a device.
 *
 * Arrays are taken as one value rather than walked: their length moves with the season and every
 * element would enter the map as its own key, which is a map of the weather, not of the row.
 */
function emptinessMap(snapshot, metrics) {
    const out = {};
    const walk = (value, prefix, depth) => {
        if (value === null || value === undefined) { out[prefix] = 'null'; return; }
        if (Array.isArray(value) || typeof value !== 'object' || depth >= 4) {
            out[prefix] = 'filled';

            return;
        }
        const keys = Object.keys(value);
        if (!keys.length) { out[prefix] = 'filled'; return; }
        keys.sort().forEach((k) => walk(value[k], prefix + '.' + k, depth + 1));
    };
    Object.keys(metrics || {}).sort().forEach((k) => walk(metrics[k], 'metrics.' + k, 1));
    const computed = (snapshot && snapshot.computed) || {};
    Object.keys(computed).sort().forEach((k) => walk(computed[k], 'computed.' + k, 1));

    return out;
}

describe('GH-738 — the emptiness of the stored row is declared, not discovered later', () => {
    let map = null;
    let failures = [];

    beforeAll(async () => {
        const bench = load({ expose: exposeAssembly() });
        failures = bench.failed;
        /**
         * THE SCHEMA IS WHAT THE PAGE IS GIVEN, so the bench gives the same. `_bodyMetrics`
         * returns `null` without it and the map came back with no `metrics.*` at all — a map
         * missing the very section this is about, which the positive control caught rather than
         * letting it read as "those keys are fine".
         */
        const schema = JSON.parse(fs.readFileSync(
            path.join(__dirname, '..', 'assets', 'analysis-result.schema.json'), 'utf8'));
        bench.ctx.GAIP_ANALYSIS_SCHEMA = schema;
        if (bench.ctx.window) bench.ctx.window.GAIP_ANALYSIS_SCHEMA = schema;
        // The state the product would hand the run, not one this file invented.
        const built = stateFromTheProduct(SAMPLES);
        process.stdout.write('[gh738] state assembled by gaip_build_state — sections: '
            + JSON.stringify(Object.keys(built)) + ' | water.ecw: ' + JSON.stringify(built.water && built.water.ecw)
            + ' | soil keys: ' + Object.keys(built.soil || {}).length + '\n');
        await computeAll(bench, { climateMetrics: { daily: {}, hourly: {} }, state: built });
        const assemble = bench.ctx.__gh738_assemble;
        const bodyMetrics = bench.ctx.__gh738_metrics;
        const snapshot = typeof assemble === 'function' ? assemble() : null;
        const metrics = (typeof bodyMetrics === 'function' && snapshot)
            ? bodyMetrics(snapshot.dashboard) : null;
        process.stdout.write('[gh738] diag | assemble: ' + typeof assemble
            + ' | bodyMetrics: ' + typeof bodyMetrics
            + ' | snapshot: ' + (snapshot ? Object.keys(snapshot).join(',') : 'null')
            + ' | dashboard keys: ' + (snapshot && snapshot.dashboard ? Object.keys(snapshot.dashboard).length : 'none')
            + ' | metrics: ' + (metrics ? Object.keys(metrics).length : 'null')
            + ' | schema.required: ' + (schema.metrics && schema.metrics.required ? schema.metrics.required.length : 'none') + '\n');
        map = emptinessMap(snapshot, metrics);
    });

    test('POSITIVE CONTROL: the assembly was reached and produced keys to judge', () => {
        const counts = Object.values(map).reduce((a, v) => {
            a[v] = (a[v] || 0) + 1;

            return a;
        }, {});
        /**
         * WHAT IS ASSERTED IS THE PRINTED TEXT, not the constant. Measured on the reviewer's own
         * first attempt: deleting the boundary from what gets written left the case green, because
         * the assertion read `BOUNDARY` itself — a statement about a string in this file, not about
         * what the run said. The output is built once, printed once, and judged as printed.
         */
        const printed = '\n[gh738] load failures: ' + failures.length
            + ' | keys in the map: ' + Object.keys(map).length
            + ' | by state: ' + JSON.stringify(counts) + '\n'
            + BOUNDARY + '\n'
            + '[gh738] the map: ' + JSON.stringify(map, null, 0) + '\n';
        process.stdout.write(printed);

        // A map over nothing would agree with an empty fixture forever.
        // Scripts the bench could not load are NAMED rather than asserted away: a missing file is
        // a fact about the tree, and swallowing it would make the map quietly narrower.
        expect(Object.keys(map).length).toBeGreaterThan(5);
        expect(Object.keys(map).some((k) => k.indexOf('metrics.') === 0)).toBe(true);
        // The boundary is part of what this run says, so its absence is a failure of the run
        // rather than a detail of its prose.
        expect(printed).toMatch(/BOUNDARY: this map covers the ONE path the bench executes/);
        expect(printed).toMatch(/not in the map at all/);
    });

    test('every key is as empty as it was declared to be, and no key appeared or vanished', () => {
        const declared = JSON.parse(fs.readFileSync(FIXTURE, 'utf8')).map;
        const changed = Object.keys(map).filter((k) => declared[k] && declared[k] !== map[k])
            .map((k) => k + ': ' + declared[k] + ' -> ' + map[k]);
        const appeared = Object.keys(map).filter((k) => !(k in declared));
        const vanished = Object.keys(declared).filter((k) => !(k in map));
        process.stdout.write('[gh738] emptiness changed: ' + JSON.stringify(changed) + '\n'
            + '[gh738] keys that appeared: ' + JSON.stringify(appeared)
            + ' | keys that vanished: ' + JSON.stringify(vanished) + '\n');

        expect({ emptinessChanged: changed, appeared, vanished })
            .toEqual({ emptinessChanged: [], appeared: [], vanished: [] });
    });
});

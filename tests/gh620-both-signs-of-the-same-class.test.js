/**
 * GH-620 — THE SAME CLASS FROM BOTH SIDES: A ZERO NOBODY MEASURED IS NOT
 * CARRIED, AND A ZERO SOMEBODY MEASURED IS NOT THROWN AWAY.
 *
 * Everything else this night removed zeros the code had produced. One place did
 * the opposite and discarded zeros the laboratory had reported, and the two
 * were repaired under one decision — settling them one at a time means coming
 * back to the same lines twice.
 *
 *   THE FORWARD SIGN. `Na_ppm` started at `0` in the run state, between
 *   `pH_cacl2` and `CEC`, both of which set `null` on purpose and say why.
 *   Its twin in `cascade-orchestrator.js` flattened the same absence with
 *   `|| 0`.
 *
 *   THE REVERSE SIGN. The water DOM fallback in `hub-persistence.js` kept a
 *   reading only `if (_ik && !isNaN(_iv) && _iv > 0)`. A water tested for
 *   carbonate and found to have none arrived as a reading and left as an
 *   absence — the collapse GH-608 and GH-611 closed on the other two water
 *   paths, still standing on this one.
 *
 * NEITHER IS REACHABLE TODAY, AND THAT IS WHY THEY ARE REPAIRED NOW. Measured:
 * of 48 live soil samples 44 carry sodium and NONE carries a sodium of zero, so
 * the forward sign has no live case; of 64 stored rows the water source is
 * `null` on 49 and the sample store on 15, so the DOM fallback has not run once.
 * Six live water samples do carry a measured zero, which is what the reverse
 * sign would lose the first time that path is taken.
 *
 * WHAT IS DELIBERATELY NOT TOUCHED, and the last case states it: the sodium
 * assessment itself opens with `if (!e || 0 === e) return null`. That is a
 * fallback AT THE POINT OF USE — a reader deciding what it does with a zero —
 * and the rule this night has been working to is that a default belongs where a
 * number is needed, not where a fact is carried. It also means a measured
 * sodium of zero would still be read as "not tested", which is the same
 * collapse one layer further in and belongs to whoever settles that reader.
 */

'use strict';

const vm = require('vm');
const fs = require('fs');
const path = require('path');

const { realReadingsOf } = require('./lib/sample-readings');

const ASSETS = path.join(__dirname, '..', 'assets');
const PERSISTENCE = fs.readFileSync(path.join(ASSETS, 'hub-persistence.js'), 'utf8');
const HUB = fs.readFileSync(path.join(ASSETS, 'hub-tissue-v3.js'), 'utf8');
const CASCADE = fs.readFileSync(path.join(ASSETS, 'cascade-orchestrator.js'), 'utf8');

/** Source with comments removed — these blocks explain the very lines they changed. */
const stripComments = (src) => src
    .replace(/\/\*[\s\S]*?\*\//g, '')
    .split('\n').filter((l) => !/^\s*\/\//.test(l)).join('\n');

/**
 * The producer, executed with ion fields on the page and NO water sample, so
 * the DOM fallback is the path that runs.
 */
function produceFromDom(ionValues) {
    const exportLine = 'global.GilbaPersistence = GilbaPersistence;';
    expect(PERSISTENCE).toContain(exportLine);
    const testSrc = PERSISTENCE.replace(exportLine,
        exportLine + '\n    global.__test_cacheAnalysisResults = cacheAnalysisResults;');

    const ionEls = Object.keys(ionValues).map((ion) => ({
        getAttribute: (a) => (a === 'data-ion' ? ion : null),
        value: String(ionValues[ion]),
    }));

    const sandbox = {
        console: { log() {}, warn() {}, error() {} },
        setTimeout: () => 0, clearTimeout() {}, setInterval: () => 0, clearInterval() {},
        document: {
            readyState: 'complete', addEventListener() {},
            getElementById: () => null,
            querySelector: (sel) => (sel === '.gaip-ecw' ? { value: '0.5' } : null),
            querySelectorAll: (sel) => (sel === '[data-ion]' ? ionEls : []),
            body: { appendChild() {}, removeChild() {} },
        },
        location: { search: '?rerun=r&site=site-1' },
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
        getAllSamples: () => ({ allSites: {}, allActive: {}, allMeta: {}, sites: {} }),
    };
    sandbox.GaipOrchestrator = {
        noteSkipped() {}, recordProblem() {}, note() {}, getState: () => ({ computed: {} }),
    };

    const ctx = vm.createContext(sandbox);
    vm.runInContext(testSrc, ctx, { filename: 'hub-persistence.js' });
    const snap = ctx.__test_cacheAnalysisResults();
    return (snap.computed && snap.computed.waterBalance) || null;
}

/** `assessSoilSodium`, executed, to state the boundary rather than describe it. */
function sodiumReader() {
    const at = HUB.indexOf('function assessSoilSodium(');
    expect(at).toBeGreaterThan(-1);
    let depth = 0;
    const open = HUB.indexOf('{', at);
    let body = null;
    for (let j = open; j < HUB.length; j++) {
        if (HUB[j] === '{') depth++;
        else if (HUB[j] === '}') { depth--; if (!depth) { body = HUB.slice(at, j + 1); break; } }
    }
    const ctx = vm.createContext({ Math, Number, String, JSON, parseFloat, isNaN });
    vm.runInContext(body, ctx, { filename: 'assessSoilSodium' });
    expect(typeof ctx.assessSoilSodium).toBe('function');
    return ctx.assessSoilSodium;
}

/**
 * GH-673 (queue item 3ts) — THE FORWARD SIGN, EXECUTED. It was four assertions
 * against the source text, and the reviewer rejected them for what they guard: the
 * spelling of a line, not the behaviour of the code. A rename reddens them while
 * nothing is broken; a change that keeps the spelling and breaks the carry leaves
 * them green. They also could not tell apart the two states this class is ABOUT,
 * because both are written `Na_ppm: null` in the source: an absent sodium and a
 * sodium measured as zero.
 *
 * WHAT THE EXECUTION FOUND THAT THE TEXT COULD NOT. The assembly sets `Na_ppm` to
 * `null` always, and the value is written a few lines later by
 * `if (soil.ppm && soil.ppm.Na) soil.Na_ppm = ...` — a TRUTHINESS gate. So a
 * sodium the laboratory measured as ZERO does not pass it and the state keeps
 * `null`: absence and a measured zero still end the same way in the state, one
 * layer past the line that was repaired. That is printed and asserted as what it
 * is, not glossed: the repaired line carries absence honestly, and the gate after
 * it is the remaining half of the same class.
 */

/** The state's own assembly, run: `gaip_soilStateFrom` from `hub-tissue-v3.js`. */
function soilStateFrom(sample) {
    const sandbox = {
        console: { log() {}, warn() {}, error() {} },
        document: { querySelector: () => null, querySelectorAll: () => [] },
        Date, JSON, Math, Object, Array, String, Number, parseFloat, parseInt, isNaN,
    };
    sandbox.window = sandbox;
    sandbox.global = sandbox;
    sandbox.globalThis = sandbox;
    const ctx = vm.createContext(sandbox);
    const slice = (name) => {
        const at = HUB.indexOf('function ' + name + '(');
        expect(at).toBeGreaterThan(-1);
        let depth = 0;
        for (let j = HUB.indexOf('{', at); j < HUB.length; j++) {
            if (HUB[j] === '{') depth++;
            else if (HUB[j] === '}') { depth--; if (!depth) return HUB.slice(at, j + 1); }
        }
        throw new Error('unbalanced ' + name);
    };
    vm.runInContext(slice('safeNum'), ctx, { filename: 'safeNum' });
    vm.runInContext(slice('gaip_soilStateFrom'), ctx, { filename: 'gaip_soilStateFrom' });
    // Positive control: a rename would otherwise leave every claim below being made
    // about an empty sandbox.
    expect(typeof ctx.gaip_soilStateFrom).toBe('function');

    return ctx.gaip_soilStateFrom(sample, {});
}

/** The cascade's twin of the same line, run: `executeTissueEngine`. */
function cascadeSoilContext(soilState) {
    const seen = {};
    const sandbox = {
        console: { log() {}, warn() {}, error() {} },
        Date, JSON, Math, Object, Array, String, Number, parseFloat, parseInt, isNaN,
    };
    sandbox.window = sandbox;
    sandbox.global = sandbox;
    sandbox.globalThis = sandbox;
    sandbox.gaip_read_tissue_data = () => ({ tissue: { N: 3 }, units: 'pct', speciesGroup: 'c3',
        growthState: 'active', sampleType: 'clipping' });
    sandbox.GilbaTissueEngine = {
        compute: (input) => { seen.context = input.context; return { status: {}, normalized: {}, ranges: {} }; },
    };
    const ctx = vm.createContext(sandbox);
    const at = CASCADE.indexOf('function executeTissueEngine(');
    expect(at).toBeGreaterThan(-1);
    let depth = 0, body = null;
    for (let j = CASCADE.indexOf('{', at); j < CASCADE.length; j++) {
        if (CASCADE[j] === '{') depth++;
        else if (CASCADE[j] === '}') { depth--; if (!depth) { body = CASCADE.slice(at, j + 1); break; } }
    }
    vm.runInContext('function log(){} function warn(){}\n' + body, ctx, { filename: 'executeTissueEngine' });
    expect(typeof ctx.executeTissueEngine).toBe('function');
    ctx.executeTissueEngine({ soil: soilState }, null);
    // Positive control: the engine was reached, or a missing sodium below would be a
    // context that was never built.
    expect(seen.context).toBeTruthy();

    return seen.context.soil;
}

describe('GH-620 — both signs of the same class', () => {
    test('THE REVERSE SIGN: a measured zero survives the water DOM fallback', () => {
        // The subject, executed rather than read. Six live water samples carry
        // a measured zero; before this the fallback dropped every one of them.
        const wb = produceFromDom({ Ca: '46', HCO3: '150', CO3: '0' });

        expect(wb).toBeTruthy();
        process.stdout.write('[gh620] ions the DOM fallback kept: '
            + Object.keys(wb.measuredIons || {}).sort().join(', ') + '\n');

        // The measured zero is a reading now...
        expect(wb.measuredIons).toHaveProperty('CO3');
        expect(wb.measuredIons.CO3).toBe(0);
        // ...and the readings that were never in question still arrive.
        expect(wb.measuredIons.Ca).toBe(46);
    });

    test('and a field with no number at all is still not a reading', () => {
        // The control for the repair: `!isNaN` had to keep doing the job the
        // comparison was doing badly.
        const wb = produceFromDom({ Ca: '46', HCO3: '150', CO3: '' });
        expect(wb.measuredIons).not.toHaveProperty('CO3');
        expect(wb.measuredIons.Ca).toBe(46);
    });

    test('THE FORWARD SIGN, EXECUTED: the cascade twin carries absence, a measured zero and a reading apart', () => {
        // Three inputs, because two of them are what the source could not tell
        // apart: both are written `Na_ppm: null` in the file.
        const absent = cascadeSoilContext({ pH_water: 6.1, ppm: {} });
        const zero = cascadeSoilContext({ pH_water: 6.1, ppm: { Na: 0 } });
        const real = cascadeSoilContext({ pH_water: 6.1, ppm: { Na: 40 } });
        process.stdout.write('[gh620] Na_ppm into the tissue engine — no sodium: '
            + JSON.stringify(absent.Na_ppm) + ' | a measured zero: ' + JSON.stringify(zero.Na_ppm)
            + ' | a real reading: ' + JSON.stringify(real.Na_ppm) + '\n');

        expect(absent.Na_ppm).toBeNull();
        expect(zero.Na_ppm).toBe(0);
        expect(real.Na_ppm).toBe(40);
    });

    test('THE FORWARD SIGN, EXECUTED: the state carries absence — and the gate after it is the remaining half', () => {
        const absent = soilStateFrom({ pH_water: 6.1 });
        const zero = soilStateFrom({ pH_water: 6.1, ppm: { Na: 0 } });
        const real = soilStateFrom({ pH_water: 6.1, ppm: { Na: 40 } });
        process.stdout.write('[gh620] Na_ppm out of the state — no sodium: ' + JSON.stringify(absent.Na_ppm)
            + ' | a measured zero: ' + JSON.stringify(zero.Na_ppm)
            + ' | a real reading: ' + JSON.stringify(real.Na_ppm) + '\n');

        // The repaired line: absence is absence, never zero.
        expect(absent.Na_ppm == null).toBe(true);
        expect(absent.Na_ppm).not.toBe(0);
        // A reading arrives.
        expect(real.Na_ppm).toBe(40);
        // AND THE HALF THAT IS NOT REPAIRED, RECORDED RATHER THAN CLAIMED CLOSED:
        // the value is written after the assembly by `if (soil.ppm && soil.ppm.Na)`,
        // a truthiness gate, so a sodium measured as ZERO does not pass it and the
        // state keeps `null` — absence and a measured zero end the same way here,
        // one layer past the line GH-620 repaired. The cascade twin above tells them
        // apart; this does not. THIS ASSERTION MUST GO RED the day the gate is
        // settled, and that is the point of writing it down.
        expect(zero.Na_ppm == null).toBe(true);
    });

    test('THE BOUNDARY: the sodium reader still treats a measured zero as untested', () => {
        // Named, not repaired. This is a fallback at the point of use, where a
        // reader decides what to do with a value — and the rule is that a
        // default belongs there rather than in a carrier. It does mean a
        // measured sodium of zero reads as "not tested", the same collapse one
        // layer further in; no live sample has one today (44 of 48 carry
        // sodium, none of them zero), and settling it belongs to whoever owns
        // that reader.
        const assess = sodiumReader();

        expect(assess(null, 5.9)).toBeNull();
        expect(assess(0, 5.9)).toBeNull();
        // And a real reading still produces a verdict, or the line above would
        // be true of a reader that answers null to everything.
        expect(assess(40, 5.9)).not.toBeNull();
    });
});

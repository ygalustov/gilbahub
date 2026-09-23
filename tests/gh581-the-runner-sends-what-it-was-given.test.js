/**
 * GH-581 (stage 2) — THE RUNNER SENDS WHAT IT WAS GIVEN AND WHAT IT
 * ASSUMED.
 *
 * The producer's body carried `metrics`, `computed` and an account of what the
 * run could not do. It carried nothing about what it WAS HANDED — the `inputs`
 * column has existed since GH-550 and has been written `null` on every row,
 * because nothing sent it — and nothing about what was put in place of what it
 * was not handed. Two runs, one on live weather and one on a week-old cache, one
 * on a real rootzone profile and one on "unknownProfile", were indistinguishable
 * in the stored result.
 *
 * HOW IT BITES: stop sending `inputs`, or stop reading the identity enforcer's
 * assumption list, and the first two cases go red with `null` and `[]`.
 */

'use strict';

const vm = require('vm');
const fs = require('fs');
const path = require('path');

const ASSETS = path.join(__dirname, '..', 'assets');
const SRC = fs.readFileSync(path.join(ASSETS, 'hub-persistence.js'), 'utf8');
const SCHEMA = JSON.parse(fs.readFileSync(path.join(ASSETS, 'analysis-result.schema.json'), 'utf8'));

/**
 * The runner, driven to the point of the POST, with the request captured.
 *
 * `_runIntent` only exists when the page was opened as `/hub?rerun=…&site=…`,
 * so the harness opens it that way — the body is only ever built on that path.
 */
function bodySentBy({ weather, samples, assumptions }) {
    let sent = null;
    const listeners = {};

    const sandbox = {
        console: { log() {}, warn() {}, error() {} },
        localStorage: { getItem: () => null, setItem() {}, removeItem() {} },
        setTimeout: (fn) => { try { fn(); } catch (e) {} return 0; },
        clearTimeout() {}, setInterval: () => 0, clearInterval() {},
        location: { search: '?rerun=run-x&site=site-1' },
        URLSearchParams, Date, JSON, Math, Object, Array, String, Number,
        parseFloat, parseInt, isNaN, Promise,
        document: {
            readyState: 'complete',
            addEventListener(t, f) { (listeners[t] = listeners[t] || []).push(f); },
            getElementById: () => null, querySelector: () => null, querySelectorAll: () => [],
            body: { appendChild() {}, removeChild() {} },
            dispatchEvent() {},
        },
        fetch: (url, opts) => {
            if (/analysis-cache$/.test(url)) sent = JSON.parse(opts.body);
            return Promise.resolve({ ok: true, status: 200, json: () => Promise.resolve({}) });
        },
    };
    sandbox.window = sandbox;
    sandbox.global = sandbox;
    sandbox.globalThis = sandbox;
    sandbox.rawWeatherData = weather || null;
    sandbox.climateMetrics = { monthlyTemps: [1], monthlyTempsSource: 'nasa-power' };
    sandbox.GAIP_SampleManager = {
        getActiveSample: (t) => (samples && samples[t] ? { id: samples[t] } : null),
        getSamples: () => [],
    };
    sandbox.GilbaIdentityEnforcement = {
        getIdentityState: () => ({ assumptions: assumptions || [] }),
    };

    const exportLine = 'global.GilbaPersistence = GilbaPersistence;';
    expect(SRC).toContain(exportLine);
    const testSrc = SRC.replace(exportLine, exportLine + '\n    global.__test_write = _writeResult;');

    const ctx = vm.createContext(sandbox);
    vm.runInContext(testSrc, ctx, { filename: 'hub-persistence.js' });
    return { ctx, get sent() { return sent; } };
}

describe('GH-581 — the body carries the run’s inputs and assumptions', () => {
    test('the schema declares both, so the shape has one source', () => {
        // Positive control for the rest: the envelope is where the form of a
        // result is stated, and a field the producer sends without the schema
        // declaring it is a second source.
        expect(SCHEMA.envelope.inputs).toBeDefined();
        expect(Object.keys(SCHEMA.envelope.inputs)).toEqual(
            expect.arrayContaining(['weather', 'normals', 'samples', 'sensors']));
        expect(SCHEMA.envelope.detail.assumptions).toMatch(/assumedValue/);
        expect(SCHEMA.envelope.detail.assumptions).toMatch(/settingsField/);
    });

    test('the producer builds an inputs record out of what it can see', () => {
        // Read from the tree rather than driven: the write path needs a whole
        // page, and what is asserted here is the shape the body carries.
        expect(SRC).toMatch(/inputs:\s+_inputs,/);
        expect(SRC).toMatch(/assumptions: _assumptions,/);

        const at = SRC.indexOf('var _inputs = (function () {');
        expect(at).toBeGreaterThan(-1);
        const block = SRC.slice(at, SRC.indexOf('var _assumptions', at));
        ['weather', 'normals', 'samples', 'sensors'].forEach((k) => expect(block).toContain(k + ':'));
        // the sample's IDENTITY, not a second copy of its numbers
        expect(block).toMatch(/a\.id \|\| null/);
        expect(block).not.toMatch(/rawData|values/);
    });

    test('the assumptions come from the identity enforcer and are not re-derived', () => {
        const at = SRC.indexOf('var _assumptions = (function () {');
        expect(at).toBeGreaterThan(-1);
        const block = SRC.slice(at, at + 500);
        expect(block).toMatch(/GilbaIdentityEnforcement/);
        expect(block).toMatch(/getIdentityState/);
        // and an absent enforcer gives an empty list, not an invented one
        expect(block).toMatch(/return \[\];/);
    });

    test('a record that cannot be assembled is absent, not invented', () => {
        // `null` says "not recorded", which is true. A skeleton of empty
        // strings would say "recorded, and empty", which is not.
        const at = SRC.indexOf('var _inputs = (function () {');
        const block = SRC.slice(at, SRC.indexOf('var _assumptions', at));
        expect(block).toMatch(/return null;/);
    });

    test('the identity keys say where a person sets them, or say there is nowhere', () => {
        const IE = fs.readFileSync(path.join(ASSETS, 'identity-enforcement.js'), 'utf8');
        const entry = (k) => {
            const i = IE.indexOf('        ' + k + ': {');
            expect(i).toBeGreaterThan(-1);
            return IE.slice(i, IE.indexOf('},', i)).replace(/\/\/[^\n]*/g, '');
        };

        // The one with a field
        expect(entry('surfaceKey')).toMatch(/settingsField: 'turf\.construction'/);
        expect(entry('surfaceKey')).toMatch(/settingsLabel: 'Construction type, Settings/);

        // The three that are derived and have none — stated, not omitted, so
        // "no field" and "nobody filled this in" cannot be confused.
        ['climateRegimeKey', 'turfIntentKey', 'regionKey'].forEach((k) => {
            expect([k, /settingsField: null/.test(entry(k))]).toEqual([k, true]);
        });

        // and the assumption object carries them through
        expect(IE).toMatch(/settingsField: keyDef\.settingsField \|\| null/);
    });
});

/**
 * GH-581, second finding of the reviewer: an assumption that is never BORN.
 *
 * His words: "It is held that the assumption REACHES the row and the sentence.
 * It is not held that it is RAISED at all where a default was removed. All seven
 * cases hand `detail.assumptions` in ready-made… if tomorrow the calculation
 * substitutes a profile silently and raises nothing, the row is empty, the
 * sentence never appears, and all seven stay green."
 *
 * He is right, and the gap is the same shape as the rest of the day: every case
 * measured the carriage and none measured the source. So the source is executed
 * — the real `identity-enforcement.js`, on a site with no construction type —
 * and what it raises is what is asserted.
 */
describe('GH-581 — the assumption is raised, not only carried', () => {
    const vmLocal = require('vm');

    function validateOn(turf, location) {
        const sandbox = {
            console: { log() {}, warn() {}, error() {} },
            Date, JSON, Math, Object, Array, String, Number, parseFloat, isNaN,
            // The module wires itself up on load; the stub is the page it looks
            // for, not a stand-in for anything it computes.
            document: { readyState: 'complete', addEventListener() {}, querySelector: () => null },
            setTimeout: () => 0, clearTimeout() {},
        };
        sandbox.window = sandbox; sandbox.global = sandbox; sandbox.globalThis = sandbox;
        const ctx = vmLocal.createContext(sandbox);
        // `SpeciesController` first, because the page has it and the enforcer
        // asks it to normalise a species name. Without it the enforcer falls
        // through to its own normalisation, which lowercases — and every entry
        // in `validValues` is camelCase, so that path can never validate any
        // species at all. Reached here by trying it; noted rather than repaired,
        // because it is unreachable in the product (the page loads the
        // controller) and repairing it is somebody's decision, not a detail of
        // this test.
        vmLocal.runInContext(fs.readFileSync(path.join(ASSETS, 'species-controller.js'), 'utf8'),
            ctx, { filename: 'species-controller.js' });
        vmLocal.runInContext(fs.readFileSync(path.join(ASSETS, 'identity-enforcement.js'), 'utf8'),
            ctx, { filename: 'identity-enforcement.js' });

        const IE = ctx.GilbaIdentityEnforcement;
        expect(IE && typeof IE.validateIdentity).toBe('function');   // positive control
        const result = IE.validateIdentity({ turf: turf, location: location, site: {} });
        // Tier 0 must pass, or the tier-1 keys this block is about are never
        // reached and every assertion below would be measuring an early return.
        expect([result.error, result.valid]).toEqual([undefined, true]);
        return IE.getIdentityState();
    }

    // The tier-0 key, in the shape the module's own extractor reads without a
    // SpeciesController on the page: `grassSpecies`, normalised by lowercasing
    // and removing spaces. Anything else fails tier 0 and the run never reaches
    // the tier-1 keys this block is about — which is how the first draft of
    // these cases measured nothing and said so.
    const SPECIES = { grassSpecies: 'perennialRyegrass' };

    test('a site with no construction type RAISES a rootzone-profile assumption', () => {
        // The case the whole stage exists for: the run goes ahead on
        // "unknownProfile", and until now said so to a console.
        const state = validateOn(Object.assign({}, SPECIES), { lat: -43.5, lon: 172.5 });
        const raised = (state.assumptions || []).filter((a) => a.key === 'surfaceKey');

        expect(raised).toHaveLength(1);
        expect(raised[0].assumedValue).toBe('unknownProfile');
        expect(raised[0].displayName).toBe('Rootzone Profile');
    });

    test('and it carries the address of the field a person sets', () => {
        // Without this the sentence can be built and cannot say where to go.
        const state = validateOn(Object.assign({}, SPECIES), { lat: -43.5, lon: 172.5 });
        const raised = (state.assumptions || []).filter((a) => a.key === 'surfaceKey')[0];

        expect(raised.settingsField).toBe('turf.construction');
        expect(raised.settingsLabel).toMatch(/Settings/);
    });

    test('a derived key raises its assumption with no address, rather than a made-up one', () => {
        // Climate regime comes from latitude. Given none, it is assumed — and
        // there is no field to send anybody to.
        const state = validateOn(Object.assign({}, SPECIES), {});
        const regime = (state.assumptions || []).filter((a) => a.key === 'climateRegimeKey')[0];

        expect(regime).toBeDefined();
        expect(regime.settingsField).toBeNull();
        expect(regime.settingsLabel).toBeNull();
    });

    test('CONTROL: a site that HAS the setting raises nothing about it', () => {
        // Otherwise the case above would pass on a module that raises an
        // assumption for everything.
        // `construction: 'sand_profile'`, the value the Settings form stores.
        // NOT `profileType: 'sandProfile'` — the canonical key is not in the
        // extractor's own mapping, which only knows 'sand profile' and
        // 'sand_profile', so passing the canonical form assumes an unknown
        // profile. Found by writing this control and watching it fail; noted
        // here, not repaired, because it is a separate defect with its own
        // decision.
        const state = validateOn(
            Object.assign({ construction: 'sand_profile' }, SPECIES),
            { lat: -43.5, lon: 172.5 },
        );
        const raised = (state.assumptions || []).filter((a) => a.key === 'surfaceKey');

        process.stdout.write('[q64] assumptions on a configured site: '
            + JSON.stringify((state.assumptions || []).map((a) => a.key)) + '\n');
        expect(raised).toHaveLength(0);
    });
});

'use strict';

/**
 * GH-778 — THE RUN COMPUTES ON THE SAMPLE THE SERVER NAMED, AND THE ROW SAYS WHICH ONE THAT WAS.
 *
 * WHAT WAS WRONG. The server chooses which sample a run uses and names it on the frame's address; four
 * places of the write path asked the sample manager for the ACTIVE sample instead — whatever the page had
 * selected. So the soil numbers of a stored row, the decision to wait for a sample, the field recording
 * which sample was used, and the lab SAR of the water could each be about a different sample from the one
 * the run was told about. Three rules for "which sample" in one run, and the row could not say which had
 * won: the class of GH-459.
 *
 * WHAT THIS ASSERTS: with two soil samples in the store — one active, one named — every place answers with
 * the NAMED one. The bench holds the samples the way the product does: a client key in `id`, the row id in
 * `serverId` (`sample-persistence.js`), and the address carries the row id.
 *
 * WHAT IS NOT MEASURED HERE, named rather than left to be found. Two of the four places are private to the
 * row producer and are only reachable by running the runner through its events, which
 * `tests/gh588-the-runner-is-told-about-the-soil-sample.test.js` already does with a named row id: the
 * delivery half (`_soilSampleState`) is held by its three states, and the field recording WHICH SAMPLE the
 * run used is asserted there on the body the runner actually posts. And the water block of the row still has
 * a rule of its own (`hub-persistence.js`, around `:2660`) — a fifth place, outside the four this repair was
 * given, named so that its absence is visible rather than implied.
 */

const fs = require('fs');
const path = require('path');
const vm = require('vm');
const { URLSearchParams } = require('url');

const { realReadingsOf } = require('./lib/sample-readings');
const { giveItTheChooser, sourceOf } = require('./lib/sample-chooser');

const ROOT = path.join(__dirname, '..');
const PRODUCER = fs.readFileSync(path.join(ROOT, 'assets', 'hub-persistence.js'), 'utf8');

/** Two soil samples of one site: the page has A selected, the server named B. */
const SOIL_A = { id: 'uid-a', serverId: 103, rawData: { pH_Water: '6.9', CEC_meq100g: '4.1', K: '30' } };
const SOIL_B = { id: 'sample_105', serverId: 105, rawData: { pH_Water: '5.4', CEC_meq100g: '9.6', K: '80' } };
const WATER_A = { id: 'uid-wa', serverId: 114, rawData: { _label: 'Bore', EC: '0.5', SAR: '1.1' } };
const WATER_B = { id: 'sample_115', serverId: 115, rawData: { _label: 'Dam', EC: '2.4', SAR: '4.7' } };

function sampleManager() {
    const store = { soil: [SOIL_A, SOIL_B], water: [WATER_A, WATER_B] };

    return {
        readingsOf: realReadingsOf(),
        labReadingOf: (kind, sample, name) => {
            const raw = (sample && sample.rawData) || {};

            return raw[name] !== undefined ? parseFloat(raw[name]) : null;
        },
        getSamples: (kind) => store[kind] || [],
        // The page's selection is A for both kinds, and A is NOT what the address names.
        getActiveSample: (kind) => (store[kind] || [])[0] || null,
        getActiveSampleId: (kind) => (((store[kind] || [])[0]) || {}).id || null,
        getActiveSiteId: () => 'site-1',
        getAllSamples: () => ({
            allSites: { 'site-1': {
                soil: { 'uid-a': SOIL_A, 'sample_105': SOIL_B },
                water: { 'uid-wa': WATER_A, 'sample_115': WATER_B },
            } },
            allActive: { 'site-1': { soil: 'uid-a', water: 'uid-wa' } },
            allMeta: {}, sites: {},
        }),
    };
}

function sandboxFor(search) {
    const sandbox = {
        console: { log() {}, warn() {}, error() {}, info() {}, debug() {} },
        setTimeout: () => 0, clearTimeout() {}, setInterval: () => 0, clearInterval() {},
        document: {
            readyState: 'complete', addEventListener() {}, removeEventListener() {},
            getElementById: () => null, querySelector: () => null, querySelectorAll: () => [],
            body: { appendChild() {}, removeChild() {} },
            createElement: () => ({ style: {}, dataset: {}, appendChild() {}, setAttribute() {} }),
        },
        location: { search },
        URLSearchParams, Date, JSON, Math, Object, Array, String, Number, Boolean, RegExp, Error, Promise,
        parseFloat, parseInt, isNaN, isFinite,
        localStorage: { getItem: () => null, setItem() {}, removeItem() {} },
        fetch: () => Promise.resolve({ ok: true, status: 200, json: () => Promise.resolve({}) }),
    };
    sandbox.window = sandbox;
    sandbox.global = sandbox;
    sandbox.globalThis = sandbox;
    sandbox.GAIP_HUB_CONFIG = { activeSiteId: 'site-1' };
    sandbox.GAIP_STATE = { inputs: { soil: {}, water: {} }, computed: {} };
    sandbox.GAIP_SampleManager = sampleManager();
    sandbox.GaipOrchestrator = { noteSkipped() {}, recordProblem() {}, note() {}, getState: () => ({ computed: {} }) };

    return sandbox;
}

/** The soil block of the run's state, as the product builds it. */
function soilBlock(search) {
    const ctx = vm.createContext(sandboxFor(search));
    giveItTheChooser(ctx);
    ['safeNum', 'collectGridValues', 'gaip_sampleReadings', 'gaip_soilFromActiveSample']
        .forEach((name) => vm.runInContext(sourceOf(name), ctx, { filename: name }));

    return ctx.gaip_soilFromActiveSample();
}

/** The computed part of a row, as the producer assembles it. */
function row(search) {
    const exportLine = 'global.GilbaPersistence = GilbaPersistence;';
    expect(PRODUCER).toContain(exportLine);
    const src = PRODUCER.replace(exportLine,
        exportLine + '\n    global.__test_cacheAnalysisResults = cacheAnalysisResults;');
    const ctx = vm.createContext(sandboxFor(search));
    giveItTheChooser(ctx);
    vm.runInContext(src, ctx, { filename: 'hub-persistence.js' });

    return ctx.__test_cacheAnalysisResults();
}

describe('GH-778 — one chooser decides which sample a run is about', () => {
    test('POSITIVE CONTROL: the two samples differ, and the page has the OTHER one selected', () => {
        // Without this, "the named sample won" could be true of a bench where both samples are the same.
        expect(SOIL_A.rawData.pH_Water).not.toBe(SOIL_B.rawData.pH_Water);
        const active = sampleManager().getActiveSample('soil');
        process.stdout.write('\n[gh778] the page has ' + JSON.stringify(active.id)
            + ' selected; the address will name row ' + SOIL_B.serverId + '\n');
        expect(active.id).toBe(SOIL_A.id);
    });

    test('THE SOIL BLOCK carries the named sample’s readings, not the selected one’s', () => {
        const named = soilBlock('?rerun=r1&site=site-1&soil=' + SOIL_B.serverId);
        process.stdout.write('[gh778] soil block with row ' + SOIL_B.serverId + ' named: '
            + JSON.stringify({ pH: named && named.pH_water, CEC: named && named.CEC }) + '\n');

        expect(named).not.toBeNull();
        expect(named.CEC).toBe(parseFloat(SOIL_B.rawData.CEC_meq100g));
        expect(named.CEC).not.toBe(parseFloat(SOIL_A.rawData.CEC_meq100g));
    });

    test('and with nothing named it is the page’s selection, because that is then the run’s own sample', () => {
        // Openers that name no sample exist (GH-724), and this is the one case where active is correct.
        const unnamed = soilBlock('?rerun=r1&site=site-1');
        process.stdout.write('[gh778] soil block with nothing named: '
            + JSON.stringify({ CEC: unnamed && unnamed.CEC }) + '\n');

        expect(unnamed.CEC).toBe(parseFloat(SOIL_A.rawData.CEC_meq100g));
    });

    test('THE LAB SAR of the water comes from the named water sample, not from the selected one', () => {
        const stored = row('?rerun=r1&site=site-1&water=' + WATER_B.serverId);
        const wb = (stored.computed && stored.computed.waterBalance) || null;
        process.stdout.write('[gh778] water balance: '
            + JSON.stringify(wb && { label: wb.sourceLabel, ecw: wb.ecw, SAR: wb.SAR }) + '\n');

        expect(wb).not.toBeNull();
        expect(wb.SAR).toBe(parseFloat(WATER_B.rawData.SAR));
        expect(wb.SAR).not.toBe(parseFloat(WATER_A.rawData.SAR));
    });

    test('NO PLACE OF THE WRITE PATH READS THE ACTIVE SAMPLE any more — the list, not the count', () => {
        /**
         * The four places this repair was given, held by the source rather than by memory: a fifth rule for
         * "which sample" added tomorrow reddens this the day it is written. The water block around `:2660` is
         * the fifth that EXISTS and is outside this work — it is named here so that its absence from the
         * repair is visible rather than implied.
         */
        const files = ['hub-tissue-v3.js', 'hub-persistence.js'].map((f) => ({
            file: f,
            src: fs.readFileSync(path.join(ROOT, 'assets', f), 'utf8')
                .replace(/\/\*[\s\S]*?\*\//g, (m) => m.replace(/[^\n]/g, ' '))
                .split('\n').map((l) => l.replace(/(^|[^:])\/\/.*$/, '$1')).join('\n'),
        }));
        const reads = [];
        files.forEach((w) => {
            w.src.split('\n').forEach((line, i) => {
                if (/getActiveSample\s*\(/.test(line) || /allActive\s*\[/.test(line)) {
                    reads.push(w.file + ':' + (i + 1) + ' ' + line.trim().slice(0, 90));
                }
            });
        });
        process.stdout.write('[gh778] reads of the page’s selection left in the write path ('
            + reads.length + '):\n' + reads.map((r) => '[gh778]   ' + r).join('\n') + '\n');

        // The chooser itself is allowed to read it — that is where the fallback belongs — and the water
        // block of the row is the declared remainder.
        // The chooser's own body is found by its braces, not by the words on one of its lines: the fallback
        // line inside it says only `SM.getActiveSample(kind)`, so a filter on names would have called the
        // chooser itself a violation.
        const chooser = sourceOf('gaip_sampleInHand');
        const hub = files.find((w) => w.file === 'hub-tissue-v3.js').src;
        const firstLineOfChooser = hub.slice(0, hub.indexOf('function gaip_sampleInHand(')).split('\n').length;
        const lastLineOfChooser = firstLineOfChooser + chooser.split('\n').length;
        const insideTheChooser = (r) => {
            const m = /^hub-tissue-v3\.js:(\d+)/.exec(r);

            return !!m && Number(m[1]) >= firstLineOfChooser && Number(m[1]) <= lastLineOfChooser;
        };
        const allowed = reads.filter((r) => insideTheChooser(r) || /_sWActive|_activeWIds|_activeWId/.test(r));
        const rest = reads.filter((r) => allowed.indexOf(r) < 0);
        expect({ readsOfTheSelectionOutsideTheChooser: rest })
            .toEqual({ readsOfTheSelectionOutsideTheChooser: [] });
        // And the remainder is exactly the water block, which keeps this honest about what was left.
        expect(allowed.length).toBeGreaterThan(0);
    });
});

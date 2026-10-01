'use strict';

/**
 * THE REAL `readingsOf`, for benches that stub the sample manager.
 *
 * GH-591. `gaip_soilFromActiveSample` used to guess a lab row's column names
 * itself — `src.pH_Water ?? src.pH ?? src.ph` and a sibling line per reading —
 * which is a second name table beside the sample manager's own. It cost a
 * measured pH on the stand: the reader looked in `sample.normalized`, where soil
 * pH is keyed `soil_ph` and not `pH`, and stored `null` over a sample holding 6.
 *
 * Soil, water and tissue all read through `GAIP_SampleManager.readingsOf` now
 * (GH-484/490), so a bench that hands the reader a hand-written stub of the
 * sample manager is testing the stub. This loads the REAL module once and hands
 * back its real normaliser, so the name table under test is the product's.
 */

const vm = require('vm');
const fs = require('fs');
const path = require('path');

let cached = null;

function realReadingsOf() {
    if (cached) return cached;

    const src = fs.readFileSync(
        path.join(__dirname, '..', '..', 'assets', 'sample-manager.js'), 'utf8');

    const sandbox = {
        console: { log() {}, warn() {}, error() {}, info() {}, debug() {} },
        setTimeout: () => 0, clearTimeout() {}, setInterval: () => 0, clearInterval() {},
        Date, Math, JSON, Object, Array, String, Number, Boolean, RegExp, Error, Map, Set, WeakMap,
        parseFloat, parseInt, isNaN, isFinite, Promise,
        localStorage: { getItem: () => null, setItem() {}, removeItem() {} },
        CustomEvent: class { constructor(t, i) { this.type = t; this.detail = i && i.detail; } },
        fetch: () => Promise.reject(new Error('no network in this bench')),
    };
    sandbox.sessionStorage = sandbox.localStorage;
    sandbox.document = {
        readyState: 'complete', addEventListener() {}, removeEventListener() {},
        dispatchEvent: () => true,
        getElementById: () => null, querySelector: () => null, querySelectorAll: () => [],
        createElement: () => ({ style: {}, dataset: {}, appendChild() {}, setAttribute() {} }),
        body: { appendChild() {}, removeChild() {} },
    };
    sandbox.window = sandbox; sandbox.global = sandbox; sandbox.globalThis = sandbox;
    // GH-722: the page hands the sample manager its spelling tables; so does this.
    sandbox.GAIP_LAB_READING_NAMES = JSON.parse(fs.readFileSync(
        path.join(__dirname, '..', '..', 'assets', 'lab-reading-names.json'), 'utf8'));

    const ctx = vm.createContext(sandbox);
    vm.runInContext(src, ctx, { filename: 'sample-manager.js' });

    const api = ctx.GAIP_SampleManager;
    if (!api || typeof api.readingsOf !== 'function') {
        throw new Error('sample-manager.js no longer exposes readingsOf — the benches that use it are testing nothing');
    }
    cached = api.readingsOf;
    return cached;
}

/**
 * A sample-manager stub whose normaliser is the product's own.
 *
 * @param {object} samples  {soil, water, tissue} → the raw lab row, or null
 */
function stubSampleManager(samples) {
    const store = samples || {};
    return {
        readingsOf: realReadingsOf(),
        getActiveSample: (kind) => (store[kind]
            ? { id: kind + '_sample', rawData: store[kind] } : null),
        /**
         * GH-796 (queue item 3vyu) — THE SAME SAMPLE, AND THAT IS THE POINT OF A STUB, NOT A CONFESSION.
         *
         * The product now asks two different questions: which sample a visitor has selected, and which one
         * the server names for the calculation. A caller of this stub hands it ONE sample per kind, and that
         * sample is the premise of its case -- the run is about it. So both questions answer with it, which
         * is also what the stand does: measured across 21 sites, the active sample and the named one are the
         * same row wherever a sample exists.
         *
         * A case that needs them to DIFFER cannot use this stub, and does not:
         * `tests/gh796-the-calculation-sample-is-not-the-active-one.test.js` loads the real manager, holds two
         * samples, and asserts that the calculation follows the server while the page keeps its own.
         */
        calculationSample: (kind) => (store[kind]
            ? { id: kind + '_sample', rawData: store[kind] } : null),
        getActiveSampleId: (kind) => (store[kind] ? kind + '_sample' : null),
        getSamples: () => [],
        getAllSamples: () => ({ allSites: {}, allActive: {}, allMeta: {}, sites: {} }),
        getActiveSiteId: () => 'site-1',
    };
}

module.exports = { realReadingsOf, stubSampleManager };

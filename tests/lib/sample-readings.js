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
        getActiveSampleId: (kind) => (store[kind] ? kind + '_sample' : null),
        getSamples: () => [],
        getAllSamples: () => ({ allSites: {}, allActive: {}, allMeta: {}, sites: {} }),
        getActiveSiteId: () => 'site-1',
    };
}

module.exports = { realReadingsOf, stubSampleManager };

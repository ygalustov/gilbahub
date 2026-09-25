'use strict';

/**
 * GH-722 — THE SAMPLE MANAGER ON A BENCH WHERE EVERY FORM FIELD RECORDS WHAT IT WAS GIVEN.
 *
 * `loadManager(map)` loads the real `assets/sample-manager.js` in a sandbox, handing it `map` as
 * `window.GAIP_LAB_READING_NAMES` exactly as the server hands it to the page (pass `undefined` to
 * hand nothing). `outputsOf` answers, for one row of a sample, what the runner makes of it through
 * each of its three reading paths: `readingsOf`, `normalizeValues`, and the form `loadSample` fills.
 */

const fs = require('fs');
const path = require('path');
const vm = require('vm');

function loadManager(map) {
    const fields = new Map();
    const stubInput = (sel) => {
        if (!fields.has(sel)) {
            fields.set(sel, {
                value: '', style: {}, dataset: {}, placeholder: '',
                dispatchEvent() { return true; }, setAttribute() {}, getAttribute: () => null,
                classList: { add() {}, remove() {}, toggle() {}, contains: () => false },
                closest: () => null,
            });
        }
        return fields.get(sel);
    };
    const said = [];
    const sandbox = {
        console: { log() {}, warn() {}, error: (...a) => said.push(a.join(' ')), info() {}, debug() {} },
        setTimeout: () => 0, clearTimeout() {}, setInterval: () => 0, clearInterval() {},
        Date, Math, JSON, Object, Array, String, Number, Boolean, RegExp, Error, Map, Set, WeakMap,
        parseFloat, parseInt, isNaN, isFinite, Promise,
        localStorage: { getItem: () => null, setItem() {}, removeItem() {} },
        CustomEvent: class { constructor(t, i) { this.type = t; this.detail = i && i.detail; } },
        Event: class { constructor(t) { this.type = t; } },
        fetch: () => Promise.reject(new Error('no network in this bench')),
    };
    sandbox.sessionStorage = sandbox.localStorage;
    sandbox.document = {
        readyState: 'complete', addEventListener() {}, removeEventListener() {},
        dispatchEvent: () => true,
        getElementById: () => null,
        // Every form field the loader asks for exists and records what it was given; the
        // container selector answers nothing, so the loader falls back to the document.
        querySelector: (sel) => (sel === '.gaip-hub-container' ? null : stubInput(sel)),
        querySelectorAll: () => [],
        createElement: () => ({ style: {}, dataset: {}, appendChild() {}, setAttribute() {} }),
        body: { appendChild() {}, removeChild() {} },
    };
    sandbox.window = sandbox; sandbox.global = sandbox; sandbox.globalThis = sandbox;
    if (map !== undefined) sandbox.GAIP_LAB_READING_NAMES = map;
    const ctx = vm.createContext(sandbox);
    vm.runInContext(fs.readFileSync(path.join(__dirname, '..', '..', 'assets', 'sample-manager.js'), 'utf8'),
        ctx, { filename: 'sample-manager.js' });

    return { sm: ctx.GAIP_SampleManager, fields, ctx, said };
}

/** What `loadSample` wrote into each form field, as `selector -> value`. */
function formFill(sm, fields, kind, row, n) {
    fields.clear();
    const id = 'gh722_case_' + n;
    sm.addSample(kind, { id, label: id, values: row });
    sm.loadSample(kind, id);
    const out = {};
    fields.forEach((input, sel) => {
        if (input.value !== '' && !/sample-label|-date$/.test(sel)) out[sel] = input.value;
    });
    sm.deleteSample(kind, id);

    return out;
}

function outputsOf(sm, fields, c, n) {
    const out = {
        readingsOf: sm.readingsOf(c.kind, { values: c.row }),
        normalizeValues: sm.normalizeValues(c.row, c.kind),
    };
    // Tissue fills its form through `readingsOf`, already compared above.
    if (c.kind !== 'tissue') out.loadSample = formFill(sm, fields, c.kind, c.row, n);

    return JSON.parse(JSON.stringify(out));
}

function sortKeys(v) {
    if (!v || typeof v !== 'object' || Array.isArray(v)) return v;
    const o = {};
    Object.keys(v).sort().forEach((k) => { o[k] = v[k]; });

    return o;
}

module.exports = { loadManager, outputsOf, sortKeys };

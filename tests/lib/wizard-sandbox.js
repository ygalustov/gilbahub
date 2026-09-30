'use strict';

/**
 * THE SETUP WIZARD, LOADED THE WAY A PAGE LOADS IT — one sandbox, read by every guard that has
 * something to ask of it.
 *
 * It was written inside `gh630-the-wizard-sends-no-key-it-never-asked-for.test.js` and moved here by
 * GH-789 (queue item 7), when a second file needed the same thing. Each decision in it was made by a
 * measurement, and the reasons travel with the code rather than being summarised: the listeners are
 * recorded because a control is told from a decoration by what its click does; `textContent` reaches
 * `innerHTML` because the wizard escapes labels by writing them into a throwaway element; the species
 * tables are here because without them a step draws nothing and a case counts the emptiness as a pass.
 *
 * WHAT IT GIVES BACK: `ctx` (the loaded page context), `sent` (every request, with its parsed body),
 * `created` (every element the page made, with its listeners) and `documentListeners`.
 */

const fs = require('fs');
const path = require('path');
const vm = require('vm');

const SRC = fs.readFileSync(path.join(__dirname, '../../assets/onboarding-wizard.js'), 'utf8');
// GH-684: the page loads this first, from the db-shell layout, and it carries the ONE producer of
// the cultivar list that both Settings and the wizard read, and (GH-789) the shared marker that says
// a field is required. A sandbox without it measures a wizard no browser has.
const SHARED = fs.readFileSync(path.join(__dirname, '../../assets/dashboard-ui.js'), 'utf8');

function stubElement(tag) {
    // Listeners are RECORDED rather than discarded (GH-684): a control is told apart from a
    // decoration by what its click does, and a stub that drops the handler cannot tell them apart.
    /**
     * GH-684: `textContent` REACHES `innerHTML`, because the wizard escapes every label by writing
     * it into a throwaway element and reading the element's HTML back. A stub where the two are
     * unrelated properties returns an empty string for every escaped value, and the cultivar list
     * came out as `<option value=""></option>` twice -- which looks exactly like a product that
     * offers nothing.
     */
    let text = '';
    let html = '';
    const el = {
        tag: tag || null, listeners: [],
        get textContent() { return text; },
        set textContent(v) {
            text = v === null || v === undefined ? '' : String(v);
            html = text.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
        },
        get innerHTML() { return html; },
        set innerHTML(v) { html = v === null || v === undefined ? '' : String(v); },
        style: {}, dataset: {}, value: '',
        classList: { add() {}, remove() {}, contains: () => false, toggle() {} },
        addEventListener(type, fn) { el.listeners.push({ type, fn }); },
        removeEventListener() {}, appendChild() {}, removeChild() {},
        setAttribute() {}, getAttribute: () => null, insertAdjacentHTML() {},
        querySelector: () => stubElement(), querySelectorAll: () => [],
        parentNode: null, disabled: false,
    };
    return el;
}

/** The wizard, loaded the way a page loads it, with every request captured. */
function wizardSandbox(opts) {
    const sent = [];
    const sandbox = {
        console: { log() {}, warn() {}, error() {}, info() {} },
        Date, Math, JSON, Object, Array, String, Number, Boolean, RegExp, Error, Promise,
        parseFloat, parseInt, isNaN, isFinite, setTimeout: (f) => { f(); return 0; }, clearTimeout() {},
        encodeURIComponent, decodeURIComponent,
        URLSearchParams: require('url').URLSearchParams,
        localStorage: { getItem: () => null, setItem() {}, removeItem() {} },
        fetch: (url, opts) => {
            sent.push({ url, method: opts && opts.method, body: opts && opts.body ? JSON.parse(opts.body) : null });
            return Promise.resolve({
                ok: true,
                status: 200,
                json: () => Promise.resolve({ data: { id: 'site-1' } }),
            });
        },
    };
    sandbox.window = sandbox;
    sandbox.global = sandbox;
    sandbox.globalThis = sandbox;
    const created = [];
    const documentListeners = [];
    sandbox.document = {
        readyState: 'complete',
        addEventListener(type) { documentListeners.push(type); },
        removeEventListener() {},
        querySelector: () => null, querySelectorAll: () => [],
        // GH-684: the steps look their own controls up by id after writing the markup. A document
        // without this throws inside `_render`, which reads as the wizard being broken rather than
        // as the stub being short of a method.
        getElementById: () => null,
        createElement: (tag) => {
            const el = stubElement(tag);
            created.push(el);

            return el;
        },
        body: stubElement('body'),
    };
    sandbox.__created = created;
    sandbox.__documentListeners = documentListeners;
    sandbox.location = { search: '', pathname: '/dashboard', hash: '', href: '' };
    sandbox.history = { replaceState() {} };
    // An active site, so `_ensureSite()` does not create one — the subject is
    // the config PATCH, and a site creation in between would only add noise.
    sandbox.GAIP_HUB_CONFIG = Object.assign(
        { activeSiteId: 'site-1', restUrl: '/api/', csrfToken: 't' },
        (opts && opts.hubConfig) || {}
    );
    // GH-684: the cultivar list comes from the shared species key and the traits table, exactly as
    // the page provides them. Two entries are enough to tell "offered" from "not offered".
    sandbox.GAIP_SpeciesTraitsKey = { 'Perennial Ryegrass': 'perennialRyegrass' };
    // GH-684, the reviewer's third condition: WITHOUT THIS THE STEP DRAWS NO SPECIES AT ALL.
    // `_speciesOptions()` reads this table, and with it absent every draft came back with an empty
    // list -- the step was rendered over nothing and the cases counted it as a pass. The same class
    // as a green that never reached its subject, in a sandbox.
    sandbox.GAIP_SpeciesData = { speciesByType: {
        sports: { c3: [{ value: 'Perennial Ryegrass', label: 'Perennial Ryegrass', type: 'C3' }],
                  c4: [{ value: 'Couch', label: 'Couch', type: 'C4' }] },
        lawns:  { c3: [{ value: 'Tall Fescue', label: 'Tall Fescue', type: 'C3' }] },
        golf:   {
            greens:   { c3: [{ value: 'Creeping Bentgrass', label: 'Creeping Bentgrass', type: 'C3' }] },
            fairways: { c3: [{ value: 'Perennial Ryegrass', label: 'Perennial Ryegrass', type: 'C3' }] },
        },
    } };
    sandbox.GAIP_VARIETY_TRAITS = {
        perennialRyegrass: { _meta: {}, colosseum: { displayName: 'Colosseum' }, barextreme: {} },
    };

    const ctx = vm.createContext(sandbox);
    // The shared file first, exactly as the layout loads it. Its own page wiring finds nothing in
    // this document and that is fine — what is wanted from it is the producer.
    vm.runInContext(SHARED, ctx, { filename: 'dashboard-ui.js' });
    vm.runInContext(SRC, ctx, { filename: 'onboarding-wizard.js' });
    return { ctx, sent, created, documentListeners };
}


module.exports = { wizardSandbox, stubElement, wizardSource: SRC };

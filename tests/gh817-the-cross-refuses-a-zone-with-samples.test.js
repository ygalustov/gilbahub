/**
 * GH-817 (queue item "Zones") — THE CROSS OF THE ZONES TAB REFUSES A ZONE THAT STILL HAS SAMPLES.
 *
 * The owner's decision of 01.10.2026, variant (a): the remove button refuses and says how many samples are
 * linked; the samples are moved or deleted first. The tab decides by the number the server gave the zone and
 * prints the server's sentence as it came -- it holds no words about samples of its own. What the save would
 * send is read from the call the tab makes on Save, so "nothing is deleted" is asserted on the request, not
 * on the absence of a click.
 *
 * HOW IT IS RUN: the tab's own block is taken out of `settings-init.js` and run as it stands, as in
 * `gh804-the-page-does-not-guess-the-obligation`; the page around it is stubbed down to what it touches.
 */
'use strict';

const fs = require('fs');
const path = require('path');
const vm = require('vm');

const SRC = fs.readFileSync(path.join(__dirname, '../assets/settings-init.js'), 'utf8');

function zonesBlock() {
    const start = SRC.indexOf('    /* ── Zones ─');
    const end = SRC.indexOf('    /* ── Sensor integrations');
    if (start === -1 || end === -1) throw new Error('the Zones block moved in settings-init.js');
    const declaration = SRC.match(/^ {4}var zones .*$/m);
    if (!declaration) throw new Error('settings-init.js no longer declares `zones` from STG_DATA');

    return declaration[0] + '\n' + SRC.slice(start, end);
}

function element(id) {
    // Setting `innerHTML` drops the children, as it does in a browser: the tab redraws its list that way.
    let html = '';
    const el = {
        get innerHTML() { return html; },
        set innerHTML(v) { html = v; this.children = []; },
        id: id, textContent: '', className: '', hidden: true, value: '',
        style: {}, dataset: {}, children: [], listeners: {},
        appendChild(child) { this.children.push(child); },
        removeChild() {}, setAttribute() {}, getAttribute: () => null,
        addEventListener(type, fn) { (this.listeners[type] = this.listeners[type] || []).push(fn); },
        fire(type, event) { (this.listeners[type] || []).forEach((fn) => fn(event)); },
        querySelector: () => null, querySelectorAll: () => [],
        classList: { add() {}, remove() {} }, focus() {}, click() { this.fire('click', { target: this }); },
    };
    return el;
}

/** Runs the tab with this STG_DATA; returns handles to press the cross, change a type and save. */
function theTab(data) {
    const nodes = {};
    ['stg-zone-list', 'stg-zone-input', 'stg-zone-type-input', 'stg-zone-add-btn',
        'stg-zones-save', 'stg-zones-msg', 'stg-zones-form'].forEach((id) => { nodes[id] = element(id); });
    const sent = [];
    const sandbox = {
        D: data, siteId: 'site-under-test',
        document: { getElementById: (id) => nodes[id] || null, createElement: (tag) => element(tag), addEventListener() {} },
        setMsg: (el, text, type) => { if (el) { el.textContent = text; el.hidden = !text; el.className = type; } },
        setSaving() {}, markDirty() {}, _checkAfterSave() {},
        apiFetch: (method, url, body) => { sent.push({ method, url, body }); return new Promise(() => {}); },
        console: { log() {}, warn() {} },
    };
    sandbox.window = sandbox; sandbox.global = sandbox; sandbox.globalThis = sandbox;
    vm.runInContext('(function(){' + zonesBlock() + '})()', vm.createContext(sandbox));
    const list = nodes['stg-zone-list'];
    const rows = () => list.children.map((c) => c.innerHTML);
    return {
        rows,
        names: () => rows().map((h) => (h.match(/value="([^"]*)"/) || [])[1]),
        cross(idx) { list.fire('click', { target: { closest: (sel) => (sel === '.stg-zone-del' ? { dataset: { idx: String(idx) } } : null) } }); },
        type(idx, value) {
            list.fire('change', { target: { closest: (sel) => (sel === '.stg-zone-type'
                ? { dataset: { idx: String(idx) }, value: value, parentNode: null } : null) } });
        },
        save() { nodes['stg-zones-save'].click(); return sent[sent.length - 1]; },
    };
}

const TYPES = [{ id: 'green', label: 'Green' }, { id: 'tee', label: 'Tee' }];
const FIELD = { label: 'the zone type', required: true, place: 'Settings -> Zones' };
const REFUSAL = 'green 1 has 1 sample. Move or delete them first.';
// As the server gives them: in name order, each with its live samples and, when it has some, the sentence.
const ZONES = [
    { id: 'z1', name: 'green 1', zoneType: null, samples: 1, removeRefusal: REFUSAL },
    { id: 'z2', name: 'Green 2', zoneType: null, samples: 0, removeRefusal: null },
    { id: 'z3', name: 'Green 10', zoneType: null, samples: 0, removeRefusal: null },
];

describe('GH-817 — the cross of the Zones tab', () => {
    test('a zone with a sample: the row stays, the server\'s sentence is printed as it came, nothing is deleted', () => {
        const tab = theTab({ zones: ZONES, zoneTypes: TYPES, zoneTypeField: FIELD });
        tab.cross(0);
        const body = tab.save().body;
        const got = { rows: tab.names(), printed: tab.rows().filter((h) => h.indexOf(REFUSAL) !== -1).length, deleted: body.deleted };
        process.stdout.write('[gh817] cross on a zone with 1 sample: ' + JSON.stringify(got) + '\n');
        expect(got).toEqual({ rows: ['green 1', 'Green 2', 'Green 10'], printed: 1, deleted: [] });
    });

    // GH-817, the reviewer's return: in ZONES the number and the sentence agree, so a cross deciding by the
    // sentence passed the case above. Here they disagree -- one sample, no sentence -- and the row must stay:
    // the decision is the number's, and the tab prints only what the server said, which is nothing.
    test('a zone with a sample and no sentence: the row still stays -- the number decides, not the sentence', () => {
        const zones = [{ id: 'z1', name: 'green 1', zoneType: null, samples: 1, removeRefusal: null }].concat(ZONES.slice(1));
        const tab = theTab({ zones: zones, zoneTypes: TYPES, zoneTypeField: FIELD });
        tab.cross(0);
        const body = tab.save().body;
        const got = { rows: tab.names(), printed: tab.rows().filter((h) => h.indexOf('stg-zone-refusal') !== -1).length, deleted: body.deleted };
        process.stdout.write('[gh817] cross on a zone with 1 sample and no sentence: ' + JSON.stringify(got) + '\n');
        expect(got).toEqual({ rows: ['green 1', 'Green 2', 'Green 10'], printed: 0, deleted: [] });
    });

    test('a zone with no samples: the row goes, and Save sends it as deleted', () => {
        const tab = theTab({ zones: ZONES, zoneTypes: TYPES, zoneTypeField: FIELD });
        tab.cross(2);
        const body = tab.save().body;
        const got = { rows: tab.names(), deleted: body.deleted };
        process.stdout.write('[gh817] cross on a zone with no samples: ' + JSON.stringify(got) + '\n');
        expect(got).toEqual({ rows: ['green 1', 'Green 2'], deleted: ['z3'] });
    });

    test('the type of the second row changes the zone shown second -- the order is the server\'s, the index is its', () => {
        const tab = theTab({ zones: ZONES, zoneTypes: TYPES, zoneTypeField: FIELD });
        tab.type(1, 'green');
        const body = tab.save().body;
        process.stdout.write('[gh817] type of row 2: ' + JSON.stringify({ rows: tab.names(), typed: body.typed }) + '\n');
        expect(body.typed).toEqual([{ id: 'z2', zoneType: 'green' }]);
    });
});

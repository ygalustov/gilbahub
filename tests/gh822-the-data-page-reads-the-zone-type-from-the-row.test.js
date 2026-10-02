/**
 * GH-822 (queue item "Zones", stage C4) — THE DATA PAGE READS A SAMPLE'S ZONE TYPE FROM ITS ROW, AND ASKS NOTHING.
 *
 * The browser half of the stage. The area window guessed a type from the start of a word ("green..." -> green)
 * and titled its groups from a list of its own (plural, ten of the dictionary's twelve types) with area hints of
 * its own (four of five apart from the dictionary). The forms asked a "Zone type" and sent it; a CSV upload
 * guessed one from the sample's name. Now the row carries the type, its label and its area hint, given by the
 * server from the one dictionary; the window groups by them; the forms neither ask nor send a zone.
 *
 * Every expected label and hint is read out of `assets/zone-types.json`, the declaration -- not written here.
 *
 * HOW IT IS RUN: each piece is taken out of `data.blade.php` as it stands and executed with the page stubbed, as in
 * `gh805-the-edit-window-sends-the-change`.
 */
'use strict';

const fs = require('fs');
const path = require('path');
const vm = require('vm');

const BLADE = fs.readFileSync(path.join(__dirname, '../app/resources/views/data.blade.php'), 'utf8');
const DICTIONARY = JSON.parse(fs.readFileSync(path.join(__dirname, '../assets/zone-types.json'), 'utf8')).zoneTypes;
const NOT_SET = 'Type not set';

function between(from, to) {
    const a = BLADE.indexOf(from);
    const b = BLADE.indexOf(to, a + 1);
    if (a === -1 || b === -1) throw new Error('data.blade.php no longer has ' + JSON.stringify(from) + ' ... ' + JSON.stringify(to));
    return BLADE.slice(a + from.length, b);
}

/** The rows as the server gives them after this stage: the link's type, its label and its hint. */
function aRow(id, name, word, type, label) {
    return { id: id, name: name, zone: label, zoneType: type,
        zoneHint: type ? (DICTIONARY[type].areaGuidance || {}).example || null : null,
        payload: { _label: name, zone: word } };
}

function theWindow(rows) {
    const body = { innerHTML: '', querySelectorAll: () => [] };
    const sandbox = {
        document: {
            querySelectorAll: (sel) => (sel === '#dat-table .dat-row' ? rows.map((r) => ({ dataset: { row: JSON.stringify(r) } })) : []),
        },
        modalBody: body, modalMsg: {}, console: { log() {}, warn() {} }, updateApplyLabel() {},
    };
    sandbox.globalThis = sandbox;
    const ctx = vm.createContext(sandbox);
    // From after the window's own guard to its next function: the vars and the two functions under test.
    vm.runInContext(between('if (!areaBtn || !modal) return;', '    function updateApplyLabel() {')
        + '\nvar __rows = collectRows(); renderModal(__rows);', ctx);
    const groups = {};
    body.innerHTML.split('<div class="dat-area-group" ').slice(1).forEach((chunk) => {
        const name = (chunk.match(/<span class="dat-area-group-name">([^<]*)<\/span>/) || [])[1];
        const hint = (chunk.match(/<span class="dat-area-bulk-hint">([^<]*)<\/span>/) || [])[1] || null;
        const ids = (chunk.match(/<div class="dat-area-row" data-id="([^"]+)"/g) || []).map((s) => s.replace(/.*data-id="([^"]+)".*/, '$1'));
        groups[name] = { hint: hint, ids: ids };
    });
    return groups;
}

describe('GH-822 — the Data page reads the zone type from the row', () => {
    test('the area window: one group per type, titled and hinted from the dictionary; "Type not set" and "—" apart', () => {
        const rows = Object.keys(DICTIONARY).map((key) => aRow('r-' + key, 'Zone ' + key, 'Greens', key, DICTIONARY[key].label));
        rows.push(aRow('r-mismatch', 'Green 3', 'Greens', 'fairway', DICTIONARY.fairway.label));
        rows.push(aRow('r-notset', 'Green 9', 'Greens', null, NOT_SET));
        rows.push(aRow('r-none', 'Loose 1', 'Other', null, '—'));
        const groups = theWindow(rows);
        process.stdout.write('[gh822] area window groups: ' + JSON.stringify(groups) + '\n');

        const expected = {};
        Object.keys(DICTIONARY).forEach((key) => {
            expected[DICTIONARY[key].label] = { hint: (DICTIONARY[key].areaGuidance || {}).example || null, ids: ['r-' + key] };
        });
        expected[DICTIONARY.fairway.label].ids.push('r-mismatch');   // the name says "Green", the link says fairway
        expected[NOT_SET] = { hint: null, ids: ['r-notset'] };
        expected['—'] = { hint: null, ids: ['r-none'] };
        process.stdout.write('[gh822] dictionary types: ' + Object.keys(DICTIONARY).length + '\n');
        expect(groups).toEqual(expected);
    });

    test('the forms ask no zone type: none of soil, tissue and loi has the field', () => {
        const ctx = vm.createContext({});
        vm.runInContext('var MANUAL_FORMS = {' + between('    var MANUAL_FORMS = {', '\n    var ZONES ') + '; var __forms = MANUAL_FORMS;', ctx);
        const asked = {};
        ['soil', 'tissue', 'loi'].forEach((s) => { asked[s] = ctx.__forms[s].meta.filter((f) => f.id === 'zone' || f.type === 'zone').map((f) => f.label); });
        process.stdout.write('[gh822] zone fields in the forms: ' + JSON.stringify(asked) + '\n');
        expect(asked).toEqual({ soil: [], tissue: [], loi: [] });
    });

    const FIELDS = { 'dat-f-zone': 'Fairways', 'dat-f-uid': 'Green 3', 'dat-n-K': '120' };
    const q = (id) => (Object.prototype.hasOwnProperty.call(FIELDS, id) ? { value: FIELDS[id] } : null);
    const FORMS = { soil: { meta: [], nutrients: [{ id: 'K' }] } };

    test('the edit sends no zone (changedLabPayload)', () => {
        const edit = vm.createContext({ SECTION: 'soil', MANUAL_FORMS: FORMS, _editingBaseline: { _label: 'Green 3', K: 120, zone: 'Greens' }, q: q });
        vm.runInContext('function changedLabPayload() {' + between('    function changedLabPayload() {', '\n    function collectSprayData() {')
            + '\nvar __out = changedLabPayload();', edit);
        process.stdout.write('[gh822] what the edit sends: ' + JSON.stringify(edit.__out) + '\n');
        expect(edit.__out).toEqual({});
    });

    test('the add sends no zone (collectLabData)', () => {
        const add = vm.createContext({ SECTION: 'soil', SITE_ID: 's', MANUAL_FORMS: FORMS, _activeTab: 'manual', q: q, setMsg() {}, document: { getElementById: q } });
        vm.runInContext('function collectLabData() {' + between('    function collectLabData() {', '\n    /**\n     * GH-805')
            + '\nvar __out = collectLabData();', add);
        process.stdout.write('[gh822] what the add sends: ' + JSON.stringify(add.__out && add.__out.payload) + '\n');
        expect(add.__out && add.__out.payload).toEqual({ K: '120', _label: 'Green 3' });
    });

    test('a CSV row writes no guessed word; a Zone column in the file is kept as it is', () => {
        const ctx = vm.createContext({});
        vm.runInContext('var CSV_MAPS = {' + between('    var CSV_MAPS = {', '\n    };') + '\n    };'
            + 'function csvToPayload(section, row) {' + between('    function csvToPayload(section, row) {', '\n    // ── Open / close'), ctx);
        const uidCol = Object.keys(ctx.CSV_MAPS.soil).find((k) => ctx.CSV_MAPS.soil[k] === '__uid');
        const zoneCol = Object.keys(ctx.CSV_MAPS.soil).find((k) => ctx.CSV_MAPS.soil[k] === 'zone');
        const plain = ctx.csvToPayload('soil', { [uidCol]: 'Green 3', K: '120' });
        const withZone = zoneCol ? ctx.csvToPayload('soil', { [uidCol]: 'Green 3', [zoneCol]: 'Tees', K: '120' }) : null;
        process.stdout.write('[gh822] CSV columns: uid ' + JSON.stringify(uidCol) + ', zone ' + JSON.stringify(zoneCol)
            + '; payloads: ' + JSON.stringify({ plain: plain.payload, withZone: withZone && withZone.payload }) + '\n');
        expect(Object.prototype.hasOwnProperty.call(plain.payload, 'zone')).toBe(false);
        expect(zoneCol ? withZone.payload.zone : 'no Zone column').toBe(zoneCol ? 'Tees' : 'no Zone column');
    });
});

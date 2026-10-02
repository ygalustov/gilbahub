/**
 * GH-805 (queue item "Zones", part 2) — WHAT THE EDIT WINDOW SENDS.
 *
 * The window collected the FORM and sent it as the sample's whole payload, so every key the form has no
 * field for was erased by any edit: `pH_Water`, `CEC_meq100g`, `EC1_5`, `OM_Percent`, `pH_CaCl2`, and
 * `PO4` on the water samples that carry no `P`. The server merges now (part 2, place 1), and the window
 * sends the CHANGE — which is the other half, and without it the merge would keep a value the person
 * deleted for ever, because "did not send it" and "cleared it" would be one request.
 *
 * THREE ANSWERS PER FIELD, and the third is the one this case is mostly about: changed, unchanged, and
 * EMPTIED — the last travelling as an explicit `null`.
 *
 * HOW IT IS RUN: the function is taken out of `data.blade.php` as it stands and executed with the form
 * around it stubbed. The window itself is a template, so the alternative would be asserting its source,
 * and the subject here is what it would send.
 */

'use strict';

const fs = require('fs');
const path = require('path');
const vm = require('vm');

const BLADE = fs.readFileSync(path.join(__dirname, '../app/resources/views/data.blade.php'), 'utf8');

function theFunction() {
    const start = BLADE.indexOf('    function changedLabPayload() {');
    const end = BLADE.indexOf('    function collectSprayData() {');
    if (start === -1 || end === -1) throw new Error('changedLabPayload is not where it was in data.blade.php');

    return BLADE.slice(start, end);
}

/**
 * @param {object} baseline what the server answered for this sample
 * @param {object} form what the fields hold now (id => value); a key absent here means an empty field
 */
function whatItWouldSend(baseline, form) {
    const sandbox = {
        SECTION: 'soil',
        MANUAL_FORMS: { soil: { nutrients: [
            { id: 'P' }, { id: 'K' }, { id: 'Ca' }, { id: 'Mg' }, { id: 'S' },
        ] } },
        _editingBaseline: baseline,
        q: (id) => (Object.prototype.hasOwnProperty.call(form, id) ? { value: form[id] } : { value: '' }),
        console: { log() {}, warn() {} },
    };
    sandbox.globalThis = sandbox;
    const ctx = vm.createContext(sandbox);
    vm.runInContext(theFunction() + '\nvar __out = changedLabPayload();', ctx);

    return ctx.__out;
}

// A sample of the shape the stand holds: the form's readings plus five keys the form cannot see.
const STORED = {
    _label: 'Green 1', P: 40, K: 120, Ca: 900, Mg: 130, S: 11,
    pH_Water: 6.2, CEC_meq100g: 12.4, EC1_5: 0.18, OM_Percent: 3.1, pH_CaCl2: 5.8,
};
const ASitting = {
    'dat-n-P': '40', 'dat-n-K': '120', 'dat-n-Ca': '900', 'dat-n-Mg': '130', 'dat-n-S': '11',
    'dat-f-uid': 'Green 1', 'dat-f-zone': '', 'dat-f-source': '',
};

describe('GH-805 — the Edit window sends the change', () => {
    test('a changed name travels alone: not one reading goes with it', () => {
        const sent = whatItWouldSend(STORED, Object.assign({}, ASitting, { 'dat-f-uid': 'Green 2' }));
        process.stdout.write('[gh805] editing only the name sends: ' + JSON.stringify(sent) + '\n');

        // The perechen, not its length: one key, and it is the name.
        expect(Object.keys(sent)).toEqual(['_label']);
        expect(sent._label).toBe('Green 2');
        // And none of the five the window cannot see is mentioned at all -- it has nothing to say
        // about them, which is what lets the server keep them.
        ['pH_Water', 'CEC_meq100g', 'EC1_5', 'OM_Percent', 'pH_CaCl2'].forEach(
            (key) => expect(Object.prototype.hasOwnProperty.call(sent, key)).toBe(false));
    });

    test('a reading the person edited travels, and the ones they did not do not', () => {
        const sent = whatItWouldSend(STORED, Object.assign({}, ASitting, { 'dat-n-P': '44' }));
        process.stdout.write('[gh805] editing P sends: ' + JSON.stringify(sent) + '\n');

        expect(sent).toEqual({ P: '44' });
    });

    test('an EMPTIED field travels as an explicit null, which is how clearing is said at all', () => {
        const sent = whatItWouldSend(STORED, Object.assign({}, ASitting, { 'dat-n-K': '' }));
        process.stdout.write('[gh805] clearing K sends: ' + JSON.stringify(sent) + '\n');

        // `null` and not an absence: with the server merging, an absence means "leave it as it is".
        expect(Object.keys(sent)).toEqual(['K']);
        expect(sent.K).toBeNull();
        expect('K' in sent).toBe(true);
    });

    test('an empty field that was empty before says nothing', () => {
        const sent = whatItWouldSend({ _label: 'Green 1', P: 40 },
            { 'dat-n-P': '40', 'dat-f-uid': 'Green 1', 'dat-n-K': '' });
        process.stdout.write('[gh805] an untouched empty field sends: ' + JSON.stringify(sent) + '\n');

        // There is nothing to clear, so claiming a clear would be the window inventing an edit.
        expect(sent).toEqual({});
    });

    test('a form nobody touched sends nothing at all', () => {
        const sent = whatItWouldSend(STORED, ASitting);
        process.stdout.write('[gh805] an untouched form sends: ' + JSON.stringify(sent) + '\n');

        // The point of a change rather than a state: a save that changes nothing cannot undo anything.
        expect(sent).toEqual({});
    });

    test('a number and its text are the same value: 120 is not an edit of "120"', () => {
        const sent = whatItWouldSend({ K: 120 }, { 'dat-n-K': ' 120 ' });
        process.stdout.write('[gh805] whitespace around the same number sends: ' + JSON.stringify(sent) + '\n');

        // The server answers with numbers and a form holds text; comparing them strictly would have
        // made every field look edited and sent the whole form back under another name.
        expect(sent).toEqual({});
    });
});

/**
 * AND THAT THE SAVE ACTUALLY USES IT — the reviewer's mutation E5 is "the window sends the whole payload
 * again", and the cases above would not have seen it: they ask the function what it would answer, not
 * what the save does with the answer. So this one takes the EDIT BRANCH of the save out of the template
 * and runs it, with the two collectors stubbed, and reads the body it built.
 */
describe('GH-805 — and the save sends what that function answered', () => {
    function theEditBranch() {
        const start = BLADE.indexOf("                    data = collectLabData();");
        const end = BLADE.indexOf("                    method = 'PATCH';", start);
        if (start === -1 || end === -1) throw new Error('the edit branch moved in data.blade.php');

        return BLADE.slice(start, end);
    }

    test('the body of the PATCH carries the change, not the state of the form', () => {
        const theWholeForm = { P: '40', K: '120', _label: 'Green 1' };
        const theChange = { _label: 'Green 2' };
        const sandbox = {
            _editingId: 'sample-1',
            collectLabData: () => ({ sample_type: 'soil', payload: theWholeForm, notes: null }),
            changedLabPayload: () => theChange,
            saveBtn: { disabled: false, textContent: '' },
            console: { log() {}, warn() {} },
        };
        sandbox.globalThis = sandbox;
        const ctx = vm.createContext(sandbox);
        // Wrapped in a function because the branch carries the early `return` of the real handler.
        vm.runInContext('var data, url;\nfunction __run(){' + theEditBranch()
            + '}\n__run();\nvar __body = data;', ctx);

        process.stdout.write('[gh805] the body the save would send: ' + JSON.stringify(ctx.__body)
            + '\n[gh805] and the address: ' + JSON.stringify(ctx.url) + '\n');

        // The change, and not the form: this is what E5 breaks and what the cases above cannot see.
        expect(ctx.__body.payload).toEqual(theChange);
        expect(ctx.__body.payload).not.toEqual(theWholeForm);
        // The rest of the record still travels as it did -- the kind of sample, the notes, the address.
        expect(ctx.__body.sample_type).toBe('soil');
        expect(ctx.url).toBe('/api/samples/sample-1');
    });
});

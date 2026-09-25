/**
 * GH-744 (the reviewer's return) — THE WIZARD'S LAST STEP NAMES THE METHODOLOGY WITH THE LIST'S WORD.
 *
 * Step 4 (`_step4_WhatNow`) built the word out of the key — `toUpperCase().replace('_', ' ')` — so
 * it printed `AMMONIUM ACETATE` where the list says `Ammonium Acetate`, and an undeclared key came
 * out as `SOMETHING NOBODY_DECLARED`: the same made-up word the topbar stopped printing. It takes the
 * name the server delivered with the setup state now, as the rest of the wizard does.
 *
 * Run, not read: the wizard is loaded with the setup state built from the inputs list in the shape
 * `CalculationInputs::methodologyValuesForWizard()` gives it, and the step is drawn into a container.
 */

'use strict';

const vm = require('vm');
const fs = require('fs');
const path = require('path');

const ROOT = path.join(__dirname, '..');
const LIST = JSON.parse(fs.readFileSync(path.join(ROOT, 'assets', 'calculation-inputs.schema.json'), 'utf8'))
    .inputs['turf.methodology'].values;

/**
 * What the server hands the wizard, in the shape `CalculationInputs::methodologyValuesForWizard()`
 * gives it. Built FROM the list on purpose: this stands in for the server, and the server reads the
 * list. It is the INPUT of this case, not its expectation.
 */
const SETUP = Object.keys(LIST).map((id) => ({ id, label: LIST[id].label, description: LIST[id].description }));

/**
 * GH-759 (queue item 3vzh) — AND THE EXPECTATION IS NOT THE LIST AGAIN.
 *
 * The first version of this case read its expectation out of `LIST` — the same file it had just
 * built `SETUP` from. Two of its own surfaces, compared with each other: measured, renaming all
 * three labels in the list left the case GREEN while the wizard printed `MLSN (moved)`,
 * `SLAN (moved)`, `Ammonium Acetate (moved)`. That is the class of GH-409, where four tests agreed
 * with themselves while the product had moved.
 *
 * So the expectation is the WORDS ON THE SCREEN, written here as a person reads them. They are an
 * outside reference: the list can be renamed, and this case says so. Their agreement with the list
 * is a separate claim, made once, below — and made against these same literals rather than against
 * the list's own copy of itself.
 *
 * WHY LITERALS AND NOT A FIXTURE FILE: a fixture generated from the list would be the same trap one
 * step further away. These words came off the wizard's own step 4 before the move, and the item
 * that moved them (GH-744) kept them unchanged on purpose.
 */
const ON_THE_SCREEN = {
    mlsn: 'MLSN',
    slan: 'SLAN',
    ammonium_acetate: 'Ammonium Acetate',
};

function stepFour(methodology) {
    const box = {
        console: { log() {}, warn() {}, error() {} },
        document: {
            readyState: 'loading', addEventListener() {}, querySelector: () => null, querySelectorAll: () => [],
            getElementById: () => null, createElement: () => ({ style: {}, appendChild() {}, addEventListener() {} }),
            body: { appendChild() {} },
        },
        setTimeout: () => 0, clearTimeout() {}, fetch: () => Promise.resolve({ ok: true, json: () => Promise.resolve({}) }),
        Date, JSON, Math, Object, Array, String, Number, Promise,
    };
    box.window = box; box.global = box; box.globalThis = box;
    box.GAIP_HUB_CONFIG = { setup: { methodologyValues: SETUP } };
    vm.runInContext(fs.readFileSync(path.join(ROOT, 'assets', 'onboarding-wizard.js'), 'utf8'), vm.createContext(box),
        { filename: 'onboarding-wizard.js' });
    const W = box.GilbaWizard;
    expect(typeof W._step4_WhatNow).toBe('function');
    const self = Object.create(W);
    self.d = { methodology, location: { name: 'Words Site' } };
    const c = { innerHTML: '' };
    W._step4_WhatNow.call(self, c);
    const m = /Hub applies (.*?) ranges\./.exec(c.innerHTML);
    return m ? m[1] : null;
}

describe('GH-744 — the wizard\'s last step names the methodology with the list\'s word', () => {
    test('each declared methodology is named by its label, and an undeclared one by its own value', () => {
        const got = {
            mlsn: stepFour('mlsn'),
            slan: stepFour('slan'),
            ammonium_acetate: stepFour('ammonium_acetate'),
            something_nobody_declared: stepFour('something_nobody_declared'),
        };
        process.stdout.write('[gh744] wizard step 4 says: ' + JSON.stringify(got) + '\n');
        expect(got).toEqual({
            mlsn: ON_THE_SCREEN.mlsn,
            slan: ON_THE_SCREEN.slan,
            ammonium_acetate: ON_THE_SCREEN.ammonium_acetate,
            something_nobody_declared: 'something_nobody_declared',
        });
    });

    test('and the list still says what the screen says — one claim, made against the screen', () => {
        /**
         * The other half of the same rule. The case above proves the wizard prints what it was
         * HANDED; this proves what it is handed is still the words a person knows. Both are stated
         * against the same outside reference, so the list cannot move without one of them saying so.
         */
        /**
         * GH-759 (the reviewer's return) — AND THE COMPARISON GOES BOTH WAYS OVER THE KEYS.
         *
         * The first version walked the keys of the SCREEN, so the list could not move a word — but
         * it could GROW: measured, adding a fourth methodology with a label of its own passed green,
         * 2 of 2, and that word would have reached step 4 with nobody having weighed in on it. The
         * device saw only what was already listed, which is the class of GH-761 seen from the other
         * side: a guard blind to ADDITION.
         *
         * So the keys are compared as sets before the words are compared at all. A methodology
         * arriving in the list now obliges someone to decide what it says on the screen.
         */
        const fromTheList = Object.fromEntries(Object.keys(LIST).map((id) => [id, LIST[id].label]));
        process.stdout.write('[gh744] the list\u2019s labels: ' + JSON.stringify(fromTheList)
            + ' | the screen\u2019s: ' + JSON.stringify(ON_THE_SCREEN) + '\n');

        expect(Object.keys(LIST).sort()).toEqual(Object.keys(ON_THE_SCREEN).sort());
        expect(fromTheList).toEqual(ON_THE_SCREEN);
    });
});

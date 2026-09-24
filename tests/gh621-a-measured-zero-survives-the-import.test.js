/**
 * GH-621 — A MEASURED ZERO SURVIVES THE IMPORT.
 *
 * THE ITEM AS IT STOOD was "the import path can carry a non-numeric value", and
 * measured end to end it does not reach the database: `captureSoilForm` reads
 * the field with a plain `parseFloat`, so anything unparseable becomes `NaN`
 * and serialises to `null`. Counted across all 60 live samples — 812 readings,
 * every one of them a number; the only strings are `_label`, `zone`, `_source`
 * and `_zone`, which are labels, not readings. And the importer itself already
 * files an unparseable cell as "Not a valid number" rather than dropping it
 * silently.
 *
 * WHAT WAS REAL, AND IT WAS THE OTHER HALF OF THE SAME LINE. The field was
 * filled with `parseFloat(row[col]) || row[col]`, and zero is falsy — so a
 * laboratory that measured and reported `0` had its number discarded and the
 * raw cell put in its place. The same collapse as GH-608, GH-611 and GH-620,
 * this time on the way IN. Six live water samples carry a measured zero today.
 *
 * WHAT IS DELIBERATELY KEPT: a cell that does not parse at all still shows the
 * raw text. The importer has already reported it as a problem, and a person
 * looking at the form should see what the file said rather than an empty box.
 *
 * HOW THIS FILE IS BUILT, AND WHY THAT MATTERS TODAY. It asserts WHAT THE FIELD
 * RECEIVES, by executing the function — not what the source text looks like.
 * The reviewer has just found `gh577` red for no product reason at all: it
 * slices a fixed window of characters around an anchor, and a docblock added
 * between two lines pushed the rest of the window out of range. A case tied to
 * the shape of the source goes red when someone writes a comment.
 */

'use strict';

const vm = require('vm');
const fs = require('fs');
const path = require('path');

const SRC = fs.readFileSync(
    path.join(__dirname, '..', 'assets', 'lab-import.js'), 'utf8');

/** One function, taken by brace matching from its name — no character windows. */
function slice(name) {
    const at = SRC.indexOf('function ' + name + '(');
    expect(at).toBeGreaterThan(-1);
    let depth = 0;
    const open = SRC.indexOf('{', at);
    for (let j = open; j < SRC.length; j++) {
        if (SRC[j] === '{') depth++;
        else if (SRC[j] === '}') { depth--; if (!depth) return SRC.slice(at, j + 1); }
    }
    throw new Error('unbalanced ' + name);
}

/**
 * Run one populate function against a row and report what each field received.
 * The document is a stub that hands out a fresh input per selector and keeps it.
 */
function fieldsAfter(fnName, row) {
    const fields = {};
    const makeInput = (sel) => (fields[sel] = fields[sel] || {
        value: undefined, dispatchEvent() {}, style: {}, classList: { add() {}, remove() {} },
    });

    // The function asks for its container first and falls back to `document`;
    // a stub that answers every selector with an input gives it one of those
    // as a container and it dies on `container.querySelector`. Measured, not
    // guessed — the first run of this file failed exactly there.
    const CONTAINER = '.gaip-hub-container';
    const sandbox = {
        console: { log() {}, warn() {}, error() {} },
        Event: function Event() {},
        document: {
            querySelector: (sel) => (sel === CONTAINER ? null : makeInput(sel)),
            querySelectorAll: () => [],
            getElementById: () => null,
        },
        JSON, Math, Object, Array, String, Number, parseFloat, parseInt, isNaN,
    };
    sandbox.window = sandbox;
    sandbox.global = sandbox;
    sandbox.globalThis = sandbox;

    const ctx = vm.createContext(sandbox);
    // The maps the function reads, taken from the module rather than rewritten
    // here — a bench with its own name table tests the bench (GH-591).
    ['SOIL_FIELD_MAP', 'WATER_FIELD_MAP'].forEach((name) => {
        const at = SRC.indexOf('var ' + name + ' = {');
        expect(at).toBeGreaterThan(-1);
        const end = SRC.indexOf('\n    };', at);
        vm.runInContext(SRC.slice(at, end + 7), ctx, { filename: name });
    });
    vm.runInContext(slice(fnName), ctx, { filename: fnName });
    expect(typeof ctx[fnName]).toBe('function');
    ctx[fnName](row);

    // What ended up in the fields, keyed by the value rather than the selector:
    // the selector table is the product's business and changes without warning.
    return Object.keys(fields).map((sel) => fields[sel].value).filter((v) => v !== undefined);
}

describe('GH-621 — what the import puts into a field', () => {
    test('the function ran and filled something at all', () => {
        // Positive control: an empty result below must mean "nothing matched",
        // not "the function never executed".
        const got = fieldsAfter('populateSoilFields', { pH: '6.1', OM: '2.9' });
        process.stdout.write('[gh621] values placed for a plain row: ' + JSON.stringify(got) + '\n');
        expect(got.length).toBeGreaterThan(0);
    });

    test('a measured zero arrives as the NUMBER zero, not as text', () => {
        // The subject. `parseFloat(x) || x` handed the raw cell over whenever
        // the number was zero, because zero is falsy.
        const got = fieldsAfter('populateSoilFields', { pH: '0' });

        process.stdout.write('[gh621] a lab zero becomes: ' + JSON.stringify(got) + '\n');
        expect(got).toContain(0);
        expect(got).not.toContain('0');
    });

    test('an ordinary reading is unchanged', () => {
        // The control for the repair: keeping zeros must not change anything
        // else about how numbers arrive.
        expect(fieldsAfter('populateSoilFields', { pH: '6.1' })).toContain(6.1);
    });

    test('a cell that does not parse still shows what the file said', () => {
        // Deliberate, not an oversight: the importer has already filed it as
        // "Not a valid number", and an empty box would hide the evidence.
        expect(fieldsAfter('populateSoilFields', { pH: 'ND' })).toContain('ND');
    });

    test('and the water half of the importer behaves the same way', () => {
        // Two places carried the identical line; a repair to one of them only
        // would be the kind of half-fix this night has been removing.
        const zero = fieldsAfter('populateWaterFields', { pH: '0' });
        expect(zero).toContain(0);
        expect(zero).not.toContain('0');
        expect(fieldsAfter('populateWaterFields', { pH: 'ND' })).toContain('ND');
    });
});

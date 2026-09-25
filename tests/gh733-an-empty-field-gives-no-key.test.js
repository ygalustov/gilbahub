/**
 * GH-733 (queue item 3e) — SETTINGS STOPS TELLING THE DATABASE AN ANSWER NOBODY GAVE.
 *
 * Saving the Turf tab put a default into the config wherever the form field was empty:
 * `overseedVariety` became `'generic'`, `overseedStatus` became `'none'`, `summerIntent` became
 * `'transition'`. The owner's rule is that a field absent from the data stays absent, and a
 * default is a sign that something was not filled in rather than a value to send.
 *
 * WHY THIS IS A TRAP AND NOT A LIVE DEFECT, and the reviewer's warning is the reason the case
 * exists at all: no site has overseed today, so the repair moves nothing now — and it turns a
 * silent default into a silent EMPTINESS, which is the same class from the other side. The half
 * that keeps the emptiness visible is the calculation inputs list, and all three fields are in it
 * already (measured: `turf.overseedStatus`, `turf.overseedVariety`, `turf.summerIntent`, each with
 * `filledIn: ["settings.turf"]`, and `summerIntent` declaring its second name `readAs`).
 *
 * WHAT THIS FILE ASSERTS is the writer's half in both directions: an answered field travels, an
 * empty one produces NO KEY. The text is read rather than executed, because the block is inside a
 * page module that boots itself on load; what is checked is the shape the patch is built from,
 * which is what decides the key's presence.
 */

'use strict';

const fs = require('fs');
const path = require('path');

const ROOT = path.join(__dirname, '..');
const SRC = fs.readFileSync(path.join(ROOT, 'assets/settings-init.js'), 'utf8');
const LIST = JSON.parse(fs.readFileSync(path.join(ROOT, 'assets/calculation-inputs.schema.json'), 'utf8'));

/** The `turf` object literal the save builds, cut at its own brace. */
function turfLiteral() {
    const at = SRC.indexOf('var turf = {');
    if (at < 0) return '';
    let depth = 0;
    for (let i = SRC.indexOf('{', at); i < SRC.length; i++) {
        if (SRC[i] === '{') depth++;
        else if (SRC[i] === '}') { depth--; if (!depth) return SRC.slice(at, i + 1); }
    }

    return '';
}

/** The block that adds a field only when it has a value, and the fields it names. */
function conditionalGroup() {
    const at = SRC.indexOf("[['overseedVariety', 'stg-turf-overseed-variety']");
    if (at < 0) return { src: '', fields: [] };
    const end = SRC.indexOf('});', at);
    const src = end > -1 ? SRC.slice(at, end + 3) : '';

    return { src, fields: [...src.matchAll(/\['(\w+)', '([\w-]+)'\]/g)].map((m) => m[1]) };
}

const THREE = ['overseedVariety', 'overseedStatus', 'summerIntent'];

describe('GH-733 — an empty Turf field gives no key', () => {
    test('POSITIVE CONTROL: the literal and the conditional group were both found', () => {
        const literal = turfLiteral();
        const group = conditionalGroup();
        process.stdout.write('\n[gh733] turf literal: ' + literal.length + ' characters'
            + ' | conditional group names: ' + JSON.stringify(group.fields) + '\n');

        expect(literal.length).toBeGreaterThan(200);
        expect(group.src.length).toBeGreaterThan(100);
        // Without this the assertions below would hold over a file where neither exists.
        expect(literal).toContain('methodology:');
    });

    test('the three fields carry no default in the literal any more', () => {
        const literal = turfLiteral();
        THREE.forEach((f) => {
            // Each one by name: a single regexp over all three would let two through.
            expect(literal).not.toMatch(new RegExp(f + ':\\s*document\\.getElementById'));
        });
        expect(literal).not.toContain("'generic'");
        expect(literal).not.toContain("'none'");
        expect(literal).not.toContain("'transition'");
    });

    test('and each is added only when the field has a value', () => {
        const group = conditionalGroup();
        expect(group.fields.sort()).toEqual(THREE.slice().sort());
        // The condition itself, so "the group exists" is not mistaken for "the group guards".
        expect(group.src).toMatch(/if \(v !== ''\) turf\[pair\[0\]\] = v;/);
        expect(group.src).toMatch(/\.value === 'string' \? el\.value\.trim\(\) : ''/);
    });

    test('THE OTHER HALF: all three are declared in the inputs list, or the emptiness is silent', () => {
        /**
         * The reviewer's condition, and it is the reason this item grew: with the writer repaired,
         * a field left empty is empty, and the check that says what the calculation is missing can
         * only ask about an input the list carries. His claim of 12:23 was that they are not in the
         * list; measured now, all three are.
         */
        const named = THREE.map((f) => 'turf.' + f);
        const missing = named.filter((k) => !LIST.inputs[k]);
        const places = {};
        named.forEach((k) => { places[k] = (LIST.inputs[k] || {}).filledIn || null; });
        process.stdout.write('[gh733] in the inputs list: ' + JSON.stringify(places) + '\n'
            + '[gh733] `summerIntent` second name: '
            + JSON.stringify((LIST.inputs['turf.summerIntent'] || {}).readAs) + '\n');

        expect({ declaredNowhere: missing }).toEqual({ declaredNowhere: [] });
        named.forEach((k) => expect(LIST.inputs[k].filledIn).toContain('settings.turf'));
        // The two names the analyst found: written as `summerIntent`, read as
        // `overseedSummerIntent`. The list has to carry both or the equality guard cannot see it.
        expect(LIST.inputs['turf.summerIntent'].readAs).toContain('turf.overseedSummerIntent');
    });

    test('the neighbours are untouched, so the scope of this item is visible', () => {
        // `|| '0'` and `|| ''` are a different family and were deliberately left; asserting that
        // keeps a later reader from thinking they were missed.
        const literal = turfLiteral();
        expect(literal).toMatch(/poaPercent:\s*document\.getElementById\('stg-turf-poa'\)\.value \|\| '0'/);
        expect(literal).toMatch(/coolOverseed:\s*document\.getElementById\('stg-turf-cool-overseed'\)\.value \|\| ''/);
    });
});

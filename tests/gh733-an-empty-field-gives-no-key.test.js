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

const { codeOf } = require('./lib/source-without-comments');

/** The `turf` object literal the save builds, cut at its own brace. */
function turfLiteral() {
    /**
     * GH-789 (queue item 7): READ AS CODE. The literal carries a note explaining which substitution was
     * taken out of it and why, and that note quotes the expression -- so a window over the raw text finds
     * `|| '0'` in a sentence about `|| '0'` and reports the substitution as still standing. GH-788 built
     * this reader for exactly that, twice over in one day.
     */
    const src = codeOf(SRC, 'settings-init.js');
    const at = src.indexOf('var turf = {');
    if (at < 0) return '';
    let depth = 0;
    for (let i = src.indexOf('{', at); i < src.length; i++) {
        if (src[i] === '{') depth++;
        else if (src[i] === '}') { depth--; if (!depth) return src.slice(at, i + 1); }
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

    /**
     * GH-789 (queue item 7) — ONE OF THE TWO NEIGHBOURS IS NO LONGER A NEIGHBOUR.
     *
     * This case recorded the boundary of GH-733: `|| '0'` on the Poa figure and the C3 cover, and `|| ''` on
     * the overseed species, were "a different family and were deliberately left". The first of those two has
     * been taken up, and by the coordinator's own criterion: a person can mean nought in both of those
     * boxes -- the C3 hint on the page says "0 = pure C4" in as many words -- so the default could not be
     * told from an answer. Measured on the stand, 30.09.2026: all 13 configured sites carry
     * `poaPercent: "0"` and 10 of 13 carry `c3Cover: "0"`, stored as strings, which is that expression's own
     * fingerprint.
     *
     * `|| ''` STAYS, and stays asserted: an empty string is not a value that means something else, so it
     * says the same thing as no key, and the rule below drops it either way.
     *
     * AND THE REST OF THE SETTINGS DEFAULTS STAY BY THE OWNER'S DECISION of 30.09.2026 -- eight fields of
     * the four forms still travel with a value nobody chose, and she answered "leave it as it is, we will
     * decide later". Named here so a green in this area reads as what it is: a decided deferral, not a
     * field this item overlooked. Three were taken up and are asserted above and in
     * `Gh789TheFormAsksByTheListTest`: the Poa figure, the C3 cover and the soil moisture -- each one a
     * value a person can mean, so the default could not be told from an answer.
     */
    test('the boundary of this item, and where it has since moved', () => {
        const literal = turfLiteral();
        const zeroDefault = /\|\| '0'/.test(literal);
        process.stdout.write('[gh733] a nought still substituted in the turf literal: ' + zeroDefault + '\n');

        expect(zeroDefault).toBe(false);
        expect(literal).toMatch(/poaPercent:\s*document\.getElementById\('stg-turf-poa'\)\.value,/);
        expect(literal).toMatch(/c3Cover:\s*document\.getElementById\('stg-turf-c3'\)\.value,/);
        // The neighbour that is still one.
        expect(literal).toMatch(/coolOverseed:\s*document\.getElementById\('stg-turf-cool-overseed'\)\.value \|\| ''/);
    });
});

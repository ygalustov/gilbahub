/**
 * GH-749 (queue item 3ay) — THE PAIRS AN ABSENT READING COSTS, DECLARED ONCE AND RECORDED BY WHOEVER
 * MEETS THEM.
 *
 * Four modules knew what they lacked and told nobody. The analyst's device for it is a guard over
 * PAIRS `{input, effect}` rather than over modules: the pairs are derived from `whenAbsent` in the
 * inputs list, the pairs the code records are held against them IN BOTH DIRECTIONS, and each
 * declared pair has a case that RUNS the module and reads the pair back — the case naming which
 * module records it, so no list of modules is kept anywhere.
 *
 * WHAT THIS GUARD DOES NOT SEE, in her words and kept here rather than in prose beside it: a module
 * that substitutes silently and declares nothing. Seeing those belongs to the graph's `uses`, which
 * is item 6a and waits for the owner.
 *
 * WHY THE MODULE WRITES ONLY HALF A PAIR: the inputs list is read by the server alone, and this
 * resolver is a browser module. It records the READING it did not have, by the name the list
 * declares; the EFFECT is completed from `whenAbsent` where the words live. One half each, so the
 * two cannot drift and a module cannot invent an effect.
 */

'use strict';

const fs = require('fs');
const path = require('path');

const ROOT = path.join(__dirname, '..');
const LIST = JSON.parse(fs.readFileSync(path.join(ROOT, 'assets/calculation-inputs.schema.json'), 'utf8'));

// The AA branch needs the certificate table the page gives it.
global.window = global;
global.document = global.document || { addEventListener() {}, querySelector: () => null,
    querySelectorAll: () => [], getElementById: () => null, readyState: 'complete' };
require(path.join(ROOT, 'assets/species-controller.js'));
global.window.HillLabsSampleTypes = require(path.join(ROOT, 'assets/hill-labs-sample-types.js'));
const Inputs = require(path.join(ROOT, 'assets/nutrition-program-inputs.js'));

/** Every declared pair, as {input, effect}, derived from the list and from nothing else. */
function declaredPairs() {
    const out = [];
    Object.entries(LIST.inputs).forEach(([key, entry]) => {
        Object.entries(entry.whenAbsent || {}).forEach(([input, effects]) => {
            effects.forEach((effect) => out.push({ owner: key, input, effect }));
        });
    });

    return out;
}

/** The inputs the code records as absent, by scanning the calls rather than trusting a list. */
function recordedInputs() {
    const dir = path.join(ROOT, 'assets');
    const found = {};
    fs.readdirSync(dir).filter((f) => f.endsWith('.js')).forEach((f) => {
        const src = fs.readFileSync(path.join(dir, f), 'utf8')
            .replace(/\/\*[\s\S]*?\*\//g, ' ').replace(/^[ \t]*\/\/.*$/gm, ' ');
        for (const m of src.matchAll(/noteAbsent\(\s*'([^']+)'\s*\)/g)) {
            (found[m[1]] = found[m[1]] || []).push('assets/' + f);
        }
    });

    return found;
}

describe('GH-749 — the declared pairs and the recorded ones agree, both ways', () => {
    test('the list really declares pairs, and each names a reading the entry itself declares', () => {
        const pairs = declaredPairs();
        process.stdout.write('[gh749] declared pairs:\n'
            + pairs.map((p) => '[gh749]    ' + p.input + ' -> ' + p.effect + '   (declared on ' + p.owner + ')\n').join(''));

        // Positive control: an empty declaration agrees with any code at all.
        expect(pairs.length).toBeGreaterThan(0);
        // A pair may not name an input its own entry does not declare, or it names nothing.
        const undeclaredInput = pairs.filter((p) => {
            const e = LIST.inputs[p.owner];
            const names = (e.readAs || []).concat(Object.keys(e.values || {}));

            return !names.includes(p.input);
        });
        expect(undeclaredInput).toEqual([]);
        // And an effect is a sentence about a consequence, not a code.
        pairs.forEach((p) => expect(p.effect.split(' ').length).toBeGreaterThan(3));
    });

    test('BOTH DIRECTIONS: a recorded input that is not declared, and a declared one nobody records', () => {
        const declared = [...new Set(declaredPairs().map((p) => p.input))].sort();
        const recorded = recordedInputs();
        process.stdout.write('[gh749] inputs the code records as absent, and where:\n'
            + Object.entries(recorded).map(([i, files]) => '[gh749]    ' + i + ' <- ' + [...new Set(files)].join(', ') + '\n').join(''));

        const recordedNotDeclared = Object.keys(recorded).filter((i) => !declared.includes(i)).sort();
        const declaredNotRecorded = declared.filter((i) => !(i in recorded));
        recordedNotDeclared.forEach((i) => process.stdout.write('[gh749]    RECORDED, NOT DECLARED: ' + i + '\n'));
        declaredNotRecorded.forEach((i) => process.stdout.write('[gh749]    DECLARED, NOBODY RECORDS: ' + i + '\n'));

        expect({ recordedNotDeclared, declaredNotRecorded }).toEqual({ recordedNotDeclared: [], declaredNotRecorded: [] });
    });
});

describe('GH-749 — every declared pair has a case that runs the module and reads the pair back', () => {
    /**
     * The case names the module, which is why no list of modules is kept: `soil.pH_water` and
     * `soil.CEC` are both met by the shared programme resolver, `nutrition-program-inputs.js`.
     */
    test('soil.pH_water — the resolver records it when there is no pH, and not when there is', () => {
        const withPh = Inputs.resolveSufficiencyRanges({ methodology: 'mlsn', pH: 8.3 });
        const without = Inputs.resolveSufficiencyRanges({ methodology: 'mlsn' });
        process.stdout.write('[gh749] resolver, pH 8.3  -> P floor ' + withPh.ranges.P.min
            + ', absent ' + JSON.stringify(withPh.absent) + '\n'
            + '[gh749] resolver, no pH   -> P floor ' + without.ranges.P.min
            + ', absent ' + JSON.stringify(without.absent) + '\n');

        // The input removed: the pair is recorded. The input present: no pair.
        expect(without.absent).toContain('soil.pH_water');
        expect(withPh.absent).toEqual([]);
        // And the number really did move, or the pair would be about nothing.
        expect(without.ranges.P.min).not.toBe(withPh.ranges.P.min);
    });

    test('soil.CEC — recorded where a band rests on the CEC, and NOT where every band is absolute', () => {
        /**
         * Both directions of the pair on one reading, and the measurement that shaped it: the
         * certificates differ. `S81` (fescue, native or amended soil) holds K, Ca and Mg as a
         * PROPORTION of the CEC, so without a CEC those bands cannot be computed; `S277` (ryegrass
         * on sand) holds every band absolutely, so a missing CEC costs it nothing and the pair must
         * NOT be recorded there. A guard that fired on both would call a harmless absence a loss.
         */
        const fescue = (cec) => Inputs.resolveSufficiencyRanges(Object.assign(
            { methodology: 'ammonium_acetate', speciesDisplay: 'Fescue', speciesKey: 'fescue',
                soilTexture: 'loam', pH: 6 }, cec === null ? {} : { CEC: cec }));
        const ryegrass = (cec) => Inputs.resolveSufficiencyRanges(Object.assign(
            { methodology: 'ammonium_acetate', speciesDisplay: 'Perennial Ryegrass',
                speciesKey: 'perennialRyegrass', soilTexture: 'sand', pH: 6 }, cec === null ? {} : { CEC: cec }));

        const f1 = fescue(12), f0 = fescue(null), r1 = ryegrass(5.9), r0 = ryegrass(null);
        process.stdout.write('[gh749] S81 fescue,  CEC 12  -> code ' + f1.certificateCode + ', K '
            + JSON.stringify(f1.ranges.K) + ', source ' + f1.sources.K + ', absent ' + JSON.stringify(f1.absent) + '\n'
            + '[gh749] S81 fescue,  no CEC  -> code ' + f0.certificateCode + ', K '
            + JSON.stringify(f0.ranges.K) + ', source ' + f0.sources.K + ', absent ' + JSON.stringify(f0.absent) + '\n'
            + '[gh749] S277 ryegrass, no CEC -> code ' + r0.certificateCode + ', K '
            + JSON.stringify(r0.ranges.K) + ', source ' + r0.sources.K + ', absent ' + JSON.stringify(r0.absent) + '\n');

        // The subject is real: the certificate resolved at all.
        expect(f1.certificateCode).toBe('S81');
        expect(r1.certificateCode).toBe('S277');
        // The input removed: the pair is recorded, and the declared effect is what happened.
        expect(f0.absent).toContain('soil.CEC');
        expect(f1.absent).toEqual([]);
        expect(f1.sources.K).toBe('certificate');
        expect(f0.sources.K).toBe('texture-fallback');
        // And where every band is absolute the absence costs nothing, so no pair is recorded.
        expect(r0.absent).toEqual([]);
        expect(r0.sources.K).toBe('certificate');
    });
});

/**
 * GH-667 (queue item 3ag, condition M4) — THE EMPTINESS PREDICATE EXISTS THREE
 * TIMES, AND FROM THIS TICKET ON THE SERVER'S COPY KNOWS SOMETHING THE OTHER TWO
 * DO NOT.
 *
 * THE THREE COPIES ARE NOT REPAIRED HERE — that is item 3as, by the coordinator's
 * decision. What this ticket owes is that the divergence is MEASURED AND NAMED in
 * the hand-in rather than found in a week, and that is what this file does.
 *
 * WHAT IS ASSERTED AND WHAT IS ONLY PRINTED, on purpose. Asserted: all three still
 * exist, because a copy silently deleted or renamed would make every statement
 * about "three" false. Printed: what each one decides on the shape the producer
 * writes for a site with no soil sample. A case asserting that the three AGREE
 * would go red the day 3as repairs one of them, which is the opposite of what a
 * guard should do.
 *
 * AND 3as HAS NOW HAPPENED — GH-704, the coordinator's item, and the two cases below are
 * turned over rather than deleted so the reversal is visible.
 *
 * What changed: there is ONE producer in the browser, `GAIP_producedSomething` in
 * `hub-orchestrator.js`, and the copy in `cascade-orchestrator.js` became a delegate that
 * refuses by name when the producer is not loaded. So the two claims this file made about the
 * state of play stopped being true BY DECISION, not by drift:
 *
 *   - "the divergence between the two browser copies" — there is no second browser answer left
 *     to diverge. What is measured instead is that the delegate carries no rules of its own:
 *     with the producer loaded it returns exactly the producer's answer, and without it, it
 *     refuses instead of answering something plausible;
 *   - "the two browser copies are each other's twins" — they are no longer twins and must not
 *     be. The case now asserts the shape that replaced the twinning.
 *
 * THE SERVER'S SIDE IS UNCHANGED and still the reason this file exists: `AnalysisResults`
 * reads the marker the result form declares, and the browser has no schema to read. That
 * difference is printed, as it always was.
 */

'use strict';

const fs = require('fs');
const path = require('path');

const ROOT = path.join(__dirname, '..');
const read = (p) => fs.readFileSync(path.join(ROOT, p), 'utf8');

const SERVER = read('app/app/Support/AnalysisResults.php');
const CASCADE = read('assets/cascade-orchestrator.js');
const HUB = read('assets/hub-orchestrator.js');

/** The browser copies, lifted out and run — they are plain functions. */
function browserCopy(src, label) {
    const at = src.indexOf('function producedSomething(value)');
    expect([label, at > -1]).toEqual([label, true]);
    let depth = 0, body = null;
    for (let j = src.indexOf('{', at); j < src.length; j++) {
        if (src[j] === '{') depth++;
        else if (src[j] === '}') { depth--; if (!depth) { body = src.slice(at, j + 1); break; } }
    }
    // eslint-disable-next-line no-new-func
    return new Function(body + '; return producedSomething;')();
}

/** The shape the producer writes when nothing was measured — the live row's. */
const EMPTY_SOIL = {
    pH: null, CEC: null, ECe: null, soilNa: null, ratios: {}, depthCm: 10, mulders: {},
    species: 'browntopBent', verdict: 'NO DATA', turfType: 'golf',
    nutrients: new Array(10).fill(null).map((_, i) => ({
        nutrient: 'N' + i, actual: '-', status: 'NOT MEASURED', statusClass: 'no-data',
    })),
    sampleDate: null, validation: {}, bulkDensity: 1.4, methodology: 'mlsn',
    sampleLabel: null, annualDemand: {},
};

describe('GH-667 — M4: the three copies, measured and named', () => {
    test('all three still exist, or "three copies" is not a true statement', () => {
        expect(SERVER).toMatch(/public static function producedSomething\(/);
        expect(CASCADE).toMatch(/function producedSomething\(value\)/);
        expect(HUB).toMatch(/function producedSomething\(value\)/);
    });

    test('THE ONE BROWSER ANSWER, printed: the delegate has no rules of its own (GH-704)', () => {
        const cascade = browserCopy(CASCADE, 'cascade-orchestrator.js');
        const hub = browserCopy(HUB, 'hub-orchestrator.js');
        const had = Object.prototype.hasOwnProperty.call(global, 'GAIP_producedSomething');
        const before = global.GAIP_producedSomething;

        // WITHOUT THE PRODUCER: it must refuse by name. A delegate that answered anything here
        // would be a second opinion wearing a delegate's coat, which is what GH-704 removed.
        delete global.GAIP_producedSomething;
        let refusal = null;
        try { cascade(EMPTY_SOIL); } catch (err) { refusal = err.message; }

        // WITH IT: the delegate's answer IS the producer's answer, for the same block.
        global.GAIP_producedSomething = hub;
        const delegated = cascade(EMPTY_SOIL);
        const produced = hub(EMPTY_SOIL);

        const actuals = EMPTY_SOIL.nutrients.map((c) => c.actual);
        process.stdout.write('\n[gh667] the block under measurement: verdict '
            + JSON.stringify(EMPTY_SOIL.verdict) + ', ' + Object.keys(EMPTY_SOIL).length
            + ' keys, actual per card ' + JSON.stringify(actuals) + '\n'
            + '[gh667] with the producer absent, the cascade delegate answers: '
            + JSON.stringify(refusal) + '\n'
            + '[gh667] with it loaded, delegate=' + JSON.stringify(delegated)
            + ' and producer=' + JSON.stringify(produced) + '\n'
            + '[gh667] the server (AnalysisResults, with the key) says produced=false — it reads the '
            + 'marker the result form declares; the browser has no schema to read it from\n'
            + '[gh667] SO: one browser answer since GH-704, and the server still knows something '
            + 'it does not.\n');

        if (had) global.GAIP_producedSomething = before;
        else delete global.GAIP_producedSomething;

        expect(refusal).toMatch(/GH-704/);
        expect(typeof produced).toBe('boolean');
        expect(delegated).toBe(produced);
    });

    /**
     * TURNED OVER BY GH-704, and kept rather than deleted so the reversal can be read.
     *
     * It asserted that the two browser copies were character-identical, and the reasoning was
     * sound while both were copies: had they already drifted, repairing them would have been two
     * jobs rather than one. GH-704 made it one producer and one delegate, so identical bodies are
     * now the thing that must NOT be true — that would mean the delegate had grown its own rules
     * back.
     */
    test('the two browser copies are no longer twins, because one of them is a delegate (GH-704)', () => {
        const strip = (s) => s.replace(/\s+/g, ' ').replace(/const /g, 'var ');
        const body = (src) => {
            const at = src.indexOf('function producedSomething(value)');
            let depth = 0;
            for (let j = src.indexOf('{', at); j < src.length; j++) {
                if (src[j] === '{') depth++;
                else if (src[j] === '}') { depth--; if (!depth) return strip(src.slice(at, j + 1)); }
            }
            return '';
        };
        const a = body(CASCADE);
        const b = body(HUB);
        process.stdout.write('[gh667] the cascade body now reads: ' + JSON.stringify(a) + '\n'
            + '[gh667] the hub body still carries the rules, ' + b.length + ' characters, '
            + 'character-identical to the cascade: ' + JSON.stringify(a === b) + '\n');
        expect(a.length).toBeGreaterThan(50);   // positive control: a body was found
        expect(b.length).toBeGreaterThan(50);
        expect(a).not.toBe(b);
        // And the shape that replaced the twinning, named rather than implied: the cascade body
        // reaches the producer through the global and decides nothing itself.
        expect(a).toMatch(/global\.GAIP_producedSomething/);
        expect(a).not.toMatch(/Not available/);
        expect(b).toMatch(/Not available/);
    });
});

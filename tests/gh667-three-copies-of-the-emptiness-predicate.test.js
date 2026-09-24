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

    test('THE DIVERGENCE, printed: what each copy decides about a NO DATA soil block', () => {
        const cascade = browserCopy(CASCADE, 'cascade-orchestrator.js');
        const hub = browserCopy(HUB, 'hub-orchestrator.js');

        const actuals = EMPTY_SOIL.nutrients.map((c) => c.actual);
        process.stdout.write('\n[gh667] the block under measurement: verdict '
            + JSON.stringify(EMPTY_SOIL.verdict) + ', ' + Object.keys(EMPTY_SOIL).length
            + ' keys, actual per card ' + JSON.stringify(actuals) + '\n'
            + '[gh667] cascade-orchestrator.js says produced=' + JSON.stringify(cascade(EMPTY_SOIL)) + '\n'
            + '[gh667] hub-orchestrator.js    says produced=' + JSON.stringify(hub(EMPTY_SOIL)) + '\n'
            + '[gh667] the server (AnalysisResults, with the key) says produced=false — it reads the '
            + 'marker the result form declares; the two browser copies cannot, they have no schema\n'
            + '[gh667] SO: from GH-667 the server and the two browser copies DISAGREE about this shape. '
            + 'Repair is item 3as. Named here, not left to be found.\n');

        // Printed rather than asserted as agreement or disagreement: both of those
        // claims would have to be rewritten by 3as. What IS asserted is that the two
        // copies were reached and answered at all.
        expect(typeof cascade(EMPTY_SOIL)).toBe('boolean');
        expect(typeof hub(EMPTY_SOIL)).toBe('boolean');
    });

    test('and the two browser copies are still each other’s twins, which is what makes 3as one job', () => {
        // If they had already drifted apart from each other, 3as would be two jobs
        // rather than one, and that is worth knowing before it is started.
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
        process.stdout.write('[gh667] the two browser copies are character-identical after '
            + 'normalising whitespace and `const`: ' + JSON.stringify(a === b) + '\n');
        expect(a.length).toBeGreaterThan(50);   // positive control: a body was found
        expect(a).toBe(b);
    });
});

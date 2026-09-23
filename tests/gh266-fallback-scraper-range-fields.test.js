/**
 * GH-266 — the sample-fallback path carries the same fields as the primary one.
 *
 * THE DEFECT THIS FILE WAS WRITTEN FOR. `hub-persistence.js` had TWO scrapers of
 * `mlsnEngine`'s table: the primary one in `cacheAnalysisResults`, and a second
 * inside the "empty hub form" sample fallback. GH-260 fixed `rangeMin`/
 * `rangeMax` in the first and nobody noticed the second, structurally identical
 * copy — so a site that went through the fallback lost the AA ceiling and
 * `renderAnnualRequirements()`'s `isHigh` check fell through.
 *
 * GH-574 removed both scrapers: the engine returns its rows and each path copies
 * them. The failure mode this file exists for is a copy that carries fewer
 * fields than its sibling, and that is what it now checks — against each other
 * rather than against a regex over markup.
 *
 * HOW IT BITES: drop a field from either copy and the first case goes red naming
 * it.
 */

'use strict';

const fs = require('fs');
const path = require('path');

const PRODUCER = fs.readFileSync(path.join(__dirname, '..', 'assets', 'hub-persistence.js'), 'utf8');

/** The field names one copy maps out of the engine's row. */
function fieldsOf(startAnchor) {
    const at = PRODUCER.indexOf(startAnchor);
    expect(at).toBeGreaterThan(-1);
    const block = PRODUCER.slice(at, PRODUCER.indexOf('});', at));
    return [...block.matchAll(/(\w+):\s*r\.(\w+)/g)].map((m) => m[1]).sort();
}

describe('GH-266 — the two copies carry the same fields', () => {
    test('the primary path and the sample fallback map the same names', () => {
        const primary  = fieldsOf('var _nutrients = (_mlsnRows || []).map(function (r) {');
        const fallback = fieldsOf('var _smNutrients = (_smRows || []).map(function (r) {');

        // Positive control: both lists are real before they are compared.
        expect(primary.length).toBeGreaterThan(8);
        expect(primary).toEqual(fallback);
    });

    test('and the fields include the ones the defect was about', () => {
        const primary = fieldsOf('var _nutrients = (_mlsnRows || []).map(function (r) {');
        ['rangeMin', 'rangeMax', 'rangeSource', 'status', 'statusClass', 'recommendation']
            .forEach((f) => expect(primary).toContain(f));
    });

    test('neither copy parses markup any more', () => {
        expect(PRODUCER).not.toMatch(/parseFromString/);
        expect(PRODUCER).not.toMatch(/gaip-mlsn-table tbody tr/);
        expect(PRODUCER).not.toMatch(/row\.dataset/);
    });
});

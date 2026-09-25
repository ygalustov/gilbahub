/**
 * GH-722 — THE RUNNER READS A SAMPLE THE SAME WAY AFTER ITS SPELLING TABLES MOVED INTO ONE FILE.
 *
 * The sample manager used to carry its own four tables of lab column spellings
 * (`SOIL_FIELD_MAP`, `WATER_FIELD_MAP`, `TISSUE_FIELD_MAP`, `LOI_FIELD_MAP`) and its own list of
 * extraction-method suffixes. They now come from `assets/lab-reading-names.json`, handed to the
 * page by the server. A move like that can change a number without any test about the move
 * noticing, because the precedence between two spellings of one reading is ORDER, and order is
 * exactly what a rewritten table loses.
 *
 * So what the runner produced BEFORE the move was recorded from the old code into
 * `tests/fixtures/gh722-runner-readings-before-the-move.json`, and this compares the current code
 * against it, case by case. The cases are:
 *   - every distinct set of payload keys stored in the stand's `samples` table, live and deleted
 *     (a deleted sample can be restored), with a distinct value per column so that precedence is
 *     visible — keys only were read from the database, never values;
 *   - one row per spelling, alone — the runner's own spellings and the upload page's;
 *   - one row per form field with ALL the spellings that fill it at once, which is where order
 *     decides;
 *   - rows with the tolerant forms the resolver accepts (case, method suffix).
 * Per case it compares three things: `readingsOf`, `normalizeValues` and what `loadSample` writes
 * into each form field; and, once, `readingKeysFor` for every kind.
 *
 * WHAT IS ALLOWED TO DIFFER, and nothing else:
 *   - soil rows that carry a layered organic column (`LOI_0_2` and its spellings): the soil table
 *     no longer knows them. Layered organic matter has one source, the LOI sample (the owner,
 *     24.09.2026); no stored soil payload carries such a column;
 *   - rows that carry a spelling the runner did not know before (`potassium`, `organic_matter`,
 *     `ECw`, ...), taken from the upload page: one map means the runner reads what the upload
 *     accepts. No stored payload carries one.
 * A case that differs for any other reason reddens, by name, with both outputs printed.
 */

'use strict';

const fs = require('fs');
const path = require('path');
const { loadManager, outputsOf, sortKeys } = require('./lib/sample-form-bench');

const FIXTURE = path.join(__dirname, 'fixtures', 'gh722-runner-readings-before-the-move.json');
const MAP_FILE = path.join(__dirname, '..', 'assets', 'lab-reading-names.json');

describe('GH-722 — the runner reads a sample the same way after the spelling tables moved', () => {
    const before = JSON.parse(fs.readFileSync(FIXTURE, 'utf8'));
    const map = JSON.parse(fs.readFileSync(MAP_FILE, 'utf8'));
    const { sm, fields, said } = loadManager(map);

    // What the move is allowed to change, derived rather than listed: the layered organic
    // spellings the old soil table carried, and every spelling the map gives a kind that the
    // old runner table of that kind did not have.
    const layered = Object.keys(before.oldRunnerSpellings.soil)
        .filter((s) => before.oldRunnerSpellings.soil[s].indexOf('.gaip-loi-') === 0);
    const added = {};
    Object.keys(map.types).forEach((kind) => {
        const t = map.types[kind];
        const all = [];
        [t.readings, t.attributes || {}].forEach((group) => Object.keys(group)
            .forEach((key) => group[key].forEach((s) => all.push(s))));
        added[kind] = all.filter((s) => !(s in (before.oldRunnerSpellings[kind] || {})));
    });
    const whyAllowed = (c) => {
        const cols = Object.keys(c.row);
        if (c.kind === 'soil' && cols.some((col) => layered.includes(col))) return 'layered organic column in a soil row';
        // Compared without case: the runner's resolver matches a column to a spelling
        // case-insensitively, so `Potassium` is the spelling `potassium`.
        const addedLower = added[c.kind].map((x) => x.toLowerCase());
        if (cols.some((col) => addedLower.includes(col.toLowerCase()))) return 'a spelling the runner did not know before';

        return null;
    };

    test('the manager was handed the map and did not report it missing', () => {
        expect(said.filter((l) => /LabReadingNames|lab reading names/i.test(l))).toEqual([]);
        expect(typeof sm.readingsOf).toBe('function');
    });

    test('readingKeysFor names the same readings, in the same order, for every kind', () => {
        const now = {};
        ['soil', 'water', 'tissue', 'loi'].forEach((k) => { now[k] = sm.readingKeysFor(k); });
        process.stdout.write('[gh722] readingKeysFor now: ' + JSON.stringify(now) + '\n');
        expect(now).toEqual(before.readingKeysFor);
    });

    test('every recorded case reads the same, except the ones the move is allowed to change', () => {
        const differs = [];
        let same = 0;
        before.cases.forEach((c, n) => {
            const now = outputsOf(sm, fields, c, n);
            const parts = Object.keys(c.outputs)
                .filter((p) => JSON.stringify(sortKeys(now[p])) !== JSON.stringify(sortKeys(c.outputs[p])));
            if (!parts.length) { same += 1; return; }
            const was = {}; const is = {};
            parts.forEach((p) => { was[p] = c.outputs[p]; is[p] = now[p]; });
            differs.push({ name: c.name, why: whyAllowed(c), parts, was, is });
        });
        process.stdout.write('[gh722] cases compared: ' + before.cases.length + ' (kinds '
            + JSON.stringify(countBy(before.cases, 'kind')) + '); same ' + same + ', differ ' + differs.length + '\n');
        process.stdout.write('[gh722] spellings the runner did not know before: ' + JSON.stringify(added) + '\n');
        differs.forEach((d) => process.stdout.write('[gh722]    differs: ' + d.name + ' — '
            + (d.why || 'NOT ALLOWED') + ' | in ' + d.parts.join(', ')
            + ' | was ' + JSON.stringify(d.was) + ' | now ' + JSON.stringify(d.is) + '\n'));

        expect(before.cases.length).toBeGreaterThan(100);
        expect({ differNotAllowed: differs.filter((d) => !d.why).map((d) => d.name) })
            .toEqual({ differNotAllowed: [] });
        // The comparison reaches its subject: the one change that is certain — the soil table
        // no longer carries layered organic columns — shows up as a difference.
        expect(differs.some((d) => d.why === 'layered organic column in a soil row')).toBe(true);
    });
});

function countBy(list, key) {
    const o = {};
    list.forEach((x) => { o[x[key]] = (o[x[key]] || 0) + 1; });

    return o;
}

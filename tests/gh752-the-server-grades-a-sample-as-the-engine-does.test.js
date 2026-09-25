/**
 * GH-752 (queue item 3bl, part C) — THE SERVER GRADES A SAMPLE AS THE ENGINE DOES: THE ENGINE SIDE.
 *
 * A SLAN site's sample was graded twice on one page: by the run (`mlsnEngine`, SLAN ranges by soil
 * type) and by the server's analysis of the sample (`SampleAnalysisController`, which knew only AA
 * and "everything else" and judged everything else by MLSN's thresholds). The meeting point is a
 * fixture, `app/tests/fixtures/gh752-grade-grid.json`: this file holds the ENGINE equal to it, and
 * `Gh752TheServerGradesASampleAsTheEngineDoesTest` holds the SERVER equal to it. Two soil types
 * (through the construction) by three methodologies, one sample per cell whose readings fall below,
 * inside and above the ranges.
 *
 * Grade and threshold are recorded apart, per nutrient, because the right answer and the wrong one
 * can differ by one of them only. The soil type each cell was judged by is printed.
 *
 * `GH752_RECORD=1` rewrites the fixture from the engine. Recording is a decision, not a repair: a
 * changed engine output is a change in what the product says.
 */
'use strict';

const fs = require('fs');
const path = require('path');
const { buildContext } = require('./helpers/mlsn-engine-harness');

const FIXTURE = path.join(__dirname, '..', 'app', 'tests', 'fixtures', 'gh752-grade-grid.json');
const INPUT = {
    ppm: { P: 10, K: 60, Ca: 600, Mg: 150, S: 20, Fe: 70, Mn: 40, Zn: 4, Cu: 1, B: 0.2 },
    pH: 7.4, soilTexture: 'loam', species: 'perennialRyegrass', CEC: 15,
};
const CELLS = [];
['sand_profile', 'soil'].forEach((construction) => ['slan', 'ammonium_acetate', 'mlsn']
    .forEach((methodology) => CELLS.push({ construction, methodology })));

/** A column like "12.0-28.0" is a range; a bare number is a single threshold. */
function threshold(r) {
    if (r.rangeMin != null && r.rangeMax != null) return { lo: r.rangeMin, hi: r.rangeMax };
    const m = /^(-?[\d.]+)-(-?[\d.]+)$/.exec(String(r.mlsn));
    return m ? { lo: Number(m[1]), hi: Number(m[2]) } : { single: Number(r.mlsn) };
}

function engineGrid() {
    const ctx = buildContext();
    return CELLS.map((c) => {
        const state = {
            soil: { ppm: INPUT.ppm, methodology: c.methodology, soilTexture: INPUT.soilTexture, CEC: INPUT.CEC,
                pH_water: INPUT.pH, depthCm: 10, bulkDensity: 1.4 },
            turf: { grassSpecies: INPUT.species, construction: c.construction, warmBase: false, percentC3Cover: 100, turfType: 'green' },
            fertility: { monthlyN: 0 }, climate: { latitude: -43 },
        };
        const out = ctx.mlsnEngine(state, null);
        const rows = {};
        (out.nutrients || []).forEach((r) => { rows[r.nutrient] = { grade: r.statusClass, threshold: threshold(r) }; });
        return Object.assign({}, c, { rows });
    });
}

describe('GH-752 part C — the engine side of the grade grid', () => {
    test('the engine grades the grid as the fixture records', () => {
        const got = { input: INPUT, cells: engineGrid() };
        if (process.env.GH752_RECORD) {
            fs.writeFileSync(FIXTURE, JSON.stringify(Object.assign({
                $comment: ['GH-752 - the grade grid, recorded from mlsnEngine by tests/gh752-the-server-grades-a-sample-as-the-engine-does.test.js (GH752_RECORD=1).',
                    'The engine test holds the engine equal to it; Gh752TheServerGradesASampleAsTheEngineDoesTest holds the server equal to it.'],
            }, got), null, 2) + '\n');
        }
        got.cells.forEach((c) => process.stdout.write('[gh752c] engine ' + c.construction + ' / ' + c.methodology
            + ': K ' + JSON.stringify(c.rows.K.threshold) + ' | grades ' + JSON.stringify(Object.fromEntries(
                Object.entries(c.rows).map(([n, r]) => [n, r.grade]))) + '\n'));
        const fixture = JSON.parse(fs.readFileSync(FIXTURE, 'utf8'));
        expect({ input: fixture.input, cells: fixture.cells }).toEqual(got);
    });
});

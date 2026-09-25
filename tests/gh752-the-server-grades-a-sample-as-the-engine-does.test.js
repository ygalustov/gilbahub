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
/**
 * GH-768 (queue item 3vm) — A SECOND INPUT, BECAUSE THE FIRST ONE AGREED BY ACCIDENT.
 *
 * The first input's micronutrients fall inside both judgements at once: Fe 70, Mn 40, Zn 4 and Cu 1
 * are inside the AA range AND above MLSN's single threshold, and B 0.2 is below both. So the grid
 * said the server and the engine agreed about AA micronutrients while the server was judging them
 * by a different methodology entirely. The second input separates the two: each of the five sits
 * OUTSIDE the AA range and on the agreeing side of MLSN's threshold, so a server that reaches for
 * MLSN is named rather than hidden. Fe 168, Zn 5.7 and B 0.3 are live readings from the stand (AA
 * sites `Test5 - NZ` sample 141, `Hoxton Soccer - Kate's test` samples 324 and 325, and
 * `Test - GC - NZ - warm season grass test` sample 154); Mn 60 and Cu 4 are not carried by any live
 * sample and are put here at the same remove above the range.
 */
const INPUTS = [
    {
        name: 'inside both judgements',
        ppm: { P: 10, K: 60, Ca: 600, Mg: 150, S: 20, Fe: 70, Mn: 40, Zn: 4, Cu: 1, B: 0.2 },
        pH: 7.4, soilTexture: 'loam', species: 'perennialRyegrass', CEC: 15,
    },
    {
        name: 'micronutrients outside the AA range',
        ppm: { P: 10, K: 60, Ca: 600, Mg: 150, S: 20, Fe: 168, Mn: 60, Zn: 5.7, Cu: 4, B: 0.3 },
        pH: 7.4, soilTexture: 'loam', species: 'perennialRyegrass', CEC: 15,
    },
    /**
     * GH-768, on the reviewer's return — AND TWO INPUTS ON THE BOUNDARIES THEMSELVES.
     *
     * The inputs above sit inside the range and outside it, and neither tells `<` from `<=`. The
     * upper bound is inclusive in the engine (GH-276) and in the server, and the only input that
     * asserts it is one standing exactly on it; the same holds at the lower bound, where a reading
     * equal to `lo` is sufficient rather than low. So each micronutrient is put exactly on its own
     * bound: Fe 40-100, Mn 10-50, Cu 0.5-3, Zn 1-5, B 0.4-1.5.
     *
     * The macronutrients keep the first input's readings in both, so a boundary that moves is named
     * by the nutrient whose bound it is and not by five others changing with it.
     */
    {
        name: 'each micronutrient exactly on its AA upper bound',
        ppm: { P: 10, K: 60, Ca: 600, Mg: 150, S: 20, Fe: 100, Mn: 50, Zn: 5, Cu: 3, B: 1.5 },
        pH: 7.4, soilTexture: 'loam', species: 'perennialRyegrass', CEC: 15,
    },
    {
        name: 'each micronutrient exactly on its AA lower bound',
        ppm: { P: 10, K: 60, Ca: 600, Mg: 150, S: 20, Fe: 40, Mn: 10, Zn: 1, Cu: 0.5, B: 0.4 },
        pH: 7.4, soilTexture: 'loam', species: 'perennialRyegrass', CEC: 15,
    },
    /**
     * GH-768, on the reviewer's second return — AND A SANDY ROOTZONE, BECAUSE THE AA BUCKET COMES
     * FROM THE TEXTURE AND NOT FROM THE CONSTRUCTION.
     *
     * The cells vary the construction, and SLAN's soil type does come from it. AA's does not: the
     * engine takes `state.soil.soilTexture` and asks whether it contains "sand"
     * (`hub-tissue-v3.js`, `const aaSoilTexture = String(generalSoilTexture)`), and the server
     * applies the same rule to the same field (`SampleAnalysisController`, `$texKey  = (stripos(`).
     * Every input above carries `loam`, so both AA cells took the `others` bucket and the `sands`
     * half of the table was judged by nothing at all: measured, a mutation of `sands.K.hi` in
     * `aa-ranges.json` left this grid at 3 passed while the file-against-literal check caught it.
     *
     * So the texture is what this input changes, and the bucket it selects is the subject. K and Mg
     * are the two nutrients whose AA range differs between the buckets -- 75-175 against 100-235 for
     * K -- which is why the reading of K is kept from the first input rather than moved: the label is
     * what separates the two, and the label is asserted.
     *
     * AND THE SPECIES IS PART OF THE SUBJECT, measured rather than chosen for looks. A sandy rootzone
     * under `perennialRyegrass` resolves the certificate code S277, and the certificate overrides K
     * and Mg -- both bucket mutations stayed green through it, at 78.2-195.5 instead of either bucket.
     * `kentuckyBluegrass` carries no certificate on any rootzone, so the ranges come from the file and
     * the bucket is what the label shows.
     */
    {
        name: 'a sandy rootzone with no certificate, where the AA bucket is sands',
        ppm: { P: 10, K: 60, Ca: 600, Mg: 150, S: 20, Fe: 70, Mn: 40, Zn: 4, Cu: 1, B: 0.2 },
        pH: 7.4, soilTexture: 'sand', species: 'kentuckyBluegrass', CEC: 15,
    },
];
const CELLS = [];
INPUTS.forEach((_, input) => ['sand_profile', 'soil'].forEach((construction) =>
    ['slan', 'ammonium_acetate', 'mlsn'].forEach((methodology) =>
        CELLS.push({ input, construction, methodology }))));

/** A column like "12.0-28.0" is a range; a bare number is a single threshold. */
function threshold(r) {
    if (r.rangeMin != null && r.rangeMax != null) return { lo: r.rangeMin, hi: r.rangeMax };
    const m = /^(-?[\d.]+)-(-?[\d.]+)$/.exec(String(r.mlsn));
    return m ? { lo: Number(m[1]), hi: Number(m[2]) } : { single: Number(r.mlsn) };
}

function engineGrid() {
    const ctx = buildContext();
    return CELLS.map((c) => {
        const inp = INPUTS[c.input];
        const state = {
            soil: { ppm: inp.ppm, methodology: c.methodology, soilTexture: inp.soilTexture, CEC: inp.CEC,
                pH_water: inp.pH, depthCm: 10, bulkDensity: 1.4 },
            turf: { grassSpecies: inp.species, construction: c.construction, warmBase: false, percentC3Cover: 100, turfType: 'green' },
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
        const got = { inputs: INPUTS, cells: engineGrid() };
        if (process.env.GH752_RECORD) {
            fs.writeFileSync(FIXTURE, JSON.stringify(Object.assign({
                $comment: ['GH-752 - the grade grid, recorded from mlsnEngine by tests/gh752-the-server-grades-a-sample-as-the-engine-does.test.js (GH752_RECORD=1).',
                    'The engine test holds the engine equal to it; Gh752TheServerGradesASampleAsTheEngineDoesTest holds the server equal to it.'],
            }, got), null, 2) + '\n');
        }
        got.cells.forEach((c) => process.stdout.write('[gh752c] engine [' + INPUTS[c.input].name + '] '
            + c.construction + ' / ' + c.methodology
            + ': K ' + JSON.stringify(c.rows.K.threshold) + ' | grades ' + JSON.stringify(Object.fromEntries(
                Object.entries(c.rows).map(([n, r]) => [n, r.grade]))) + '\n'));
        const fixture = JSON.parse(fs.readFileSync(FIXTURE, 'utf8'));
        expect({ inputs: fixture.inputs, cells: fixture.cells }).toEqual(got);
    });
});

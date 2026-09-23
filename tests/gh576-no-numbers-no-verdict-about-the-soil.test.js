/**
 * GH-576 — NO NUMBERS, NO VERDICT — the second door.
 *
 * THE RULE IS OURS AND IT ALREADY HAD A GUARD. `gh511-no-number-no-verdict.js`
 * says: where nothing was computed, nothing is asserted about the turf. Its
 * universe is the properties of `calcMixedGrowthPotential`'s returned object,
 * and its carrier is `word/document.xml` — the growth-potential producer and
 * the climate section of the Word document. One producer, one surface.
 *
 * WHAT CAME THROUGH THE OTHER DOOR, measured on the stand rather than imagined:
 * `analysis_results` id 37, Test5 - NZ, 22.09 10:12:52 — ten nutrient rows,
 * every one of them `status: "NOT MEASURED"` with `actual: "-"`, and
 * `verdict: "ACCEPTABLE"`. The page printed "Soil Nutrition: Acceptable —
 * Operate normally. Routine monitoring only. No immediate action required."
 * over ten dashes. `gh511` was green throughout, and correctly so: it was never
 * looking here. One rule, two doors, a guard on one of them.
 *
 * WHAT THIS FILE GUARDS: the soil verdict, in both places `hub-persistence.js`
 * derives one. Not the cards — a dash is honest and stays.
 *
 * HOW IT BITES: derive the verdict from all rows again instead of the measured
 * ones, in either copy, and the first case goes red with ACCEPTABLE where NO
 * DATA belongs.
 */

'use strict';

const vm = require('vm');
const fs = require('fs');
const path = require('path');

const ASSETS = path.join(__dirname, '..', 'assets');
const read = (f) => fs.readFileSync(path.join(ASSETS, f), 'utf8');
const { buildContext } = require('./helpers/mlsn-engine-harness');
const { runSampleFallback, readSource } = require('./helpers/sample-fallback-harness');

/** A row the engine could not measure: its own `!wasMeasured` shape. */
const notMeasured = (n) => ({
    nutrient: n, actual: '-', mlsn: 12, uptakePpm: 0, targetPpm: 0,
    status: 'NOT MEASURED', statusClass: 'no-data',
    recommendation: 'Not tested in this sample',
});

/** A row it could. */
const measured = (n, actual, statusClass, status) => ({
    nutrient: n, actual: String(actual), mlsn: 37, uptakePpm: 4, targetPpm: 41,
    status: status || 'ADEQUATE', statusClass: statusClass || 'adequate',
    recommendation: 'Maintain',
});

/** The ten rows of `analysis_results` id 37, in their own shape. */
const ID_37_ROWS = ['P', 'K', 'Ca', 'Mg', 'S', 'Fe', 'Mn', 'Zn', 'Cu', 'B'].map(notMeasured);

function produce(rows) {
    const src = read('hub-persistence.js');
    const exportLine = 'global.GilbaPersistence = GilbaPersistence;';
    expect(src).toContain(exportLine);
    const testSrc = src.replace(exportLine,
        exportLine + '\n    global.__test_cacheAnalysisResults = cacheAnalysisResults;');

    const sandbox = {
        console: { log() {}, warn() {}, error() {} },
        localStorage: { getItem: () => null, setItem() {}, removeItem() {} },
        setTimeout: () => 0, clearTimeout() {}, setInterval: () => 0, clearInterval() {},
        document: {
            readyState: 'complete', addEventListener() {},
            getElementById: () => null, querySelector: () => null, querySelectorAll: () => [],
            body: { appendChild() {}, removeChild() {} },
        },
        location: { search: '' },
        URLSearchParams, Date, JSON, Math, Object, Array, String, Number,
        parseFloat, parseInt, isNaN,
    };
    sandbox.window = sandbox;
    sandbox.global = sandbox;
    sandbox.globalThis = sandbox;
    sandbox.GAIP_SampleManager = { getSamples: () => [], getActiveSample: () => null, getActiveSiteId: () => 's' };
    sandbox.GAIP_STATE = { inputs: { soil: {} }, computed: { mlsn: '', mlsnRows: rows } };

    const ctx = vm.createContext(sandbox);
    vm.runInContext(testSrc, ctx, { filename: 'hub-persistence.js' });
    const snap = ctx.__test_cacheAnalysisResults();
    return (snap.computed && snap.computed.soilNutrition) || null;
}

describe('GH-576 — the soil verdict is about measured values or it is not made', () => {
    test('the live case: ten rows, none measured, and no verdict is claimed', () => {
        const sn = produce(ID_37_ROWS);

        expect(sn.nutrients).toHaveLength(10);
        // The cards stay. The dash is honest.
        expect(sn.nutrients.every((n) => n.actual === '-')).toBe(true);
        expect(sn.verdict).toBe('NO DATA');
        expect(sn.verdict).not.toBe('ACCEPTABLE');
    });

    test('positive control: one measured row and the ladder works as it always did', () => {
        const fine = produce([measured('K', 40), ...ID_37_ROWS.slice(1)]);
        expect(fine.verdict).toBe('ACCEPTABLE');

        const low = produce([measured('K', 10, 'deficient', 'LOW'), ...ID_37_ROWS.slice(1)]);
        expect(low.verdict).toBe('HIGH_RISK');

        const borderline = produce([measured('K', 35, 'borderline', 'BORDERLINE'), ...ID_37_ROWS.slice(1)]);
        expect(borderline.verdict).toBe('MONITOR');
    });

    test('an unmeasured row cannot hide a deficient one', () => {
        // The other direction: the filter must not swallow a real finding.
        const sn = produce([...ID_37_ROWS.slice(0, 9), measured('B', 0.1, 'critical', 'Very Low')]);
        expect(sn.verdict).toBe('HIGH_RISK');
    });

    test('an empty list is still NO DATA, as it was before there were rows at all', () => {
        expect(produce([]).verdict).toBe('NO DATA');
        expect(produce(null).verdict).toBe('NO DATA');
    });

    describe('the second ladder, EXECUTED — Venya\'s finding', () => {
        /**
         * HIS MEASUREMENT, and it was right: he removed `_smMeasured.length > 0`
         * from the sample-fallback ladder at `hub-persistence.js:1636` and all
         * nineteen cases stayed green. The only thing standing over that copy
         * was a count of occurrences in the source, and a count does not notice
         * a condition being removed while the counted text stays put. The defect
         * this whole ticket is about could have come back into the second copy
         * without a single red — in a file whose own comment names GH-266 as the
         * time one copy was fixed and the other was not, unnoticed for months.
         *
         * So the second ladder is now run, on the same case as the first.
         */
        let engineCtx, src;
        beforeAll(() => {
            engineCtx = buildContext();
            src = readSource();
        });

        test('ten rows, none measured, and the fallback path claims no verdict either', () => {
            // An empty sample: the engine answers with a row per nutrient, every
            // one of them NOT MEASURED — the live shape, reached through the
            // other door.
            const sn = runSampleFallback(engineCtx, {
                src, siteId: 'site1', configMethodology: 'ammonium_acetate',
                textureDom: 'sand', sampleRaw: {},
            });

            expect(sn).toBeDefined();
            // Positive control: this path really did build the list, so "NO DATA"
            // is not the verdict of a path that never ran.
            expect(sn.nutrients.length).toBeGreaterThan(0);
            expect(sn.nutrients.every((n) => n.actual === '-')).toBe(true);
            expect(sn.verdict).toBe('NO DATA');
        });

        test('positive control on the same path: one measured row and the ladder speaks', () => {
            const sn = runSampleFallback(engineCtx, {
                src, siteId: 'site1', configMethodology: 'ammonium_acetate',
                textureDom: 'sand', sampleRaw: { K_ppm: 199, P_ppm: 25, Ca_ppm: 400, Mg_ppm: 60, S_ppm: 10 },
            });

            expect(sn.nutrients.some((n) => n.actual !== '-')).toBe(true);
            expect(sn.verdict).not.toBe('NO DATA');
        });
    });

    test('both copies of the ladder carry the rule, not just the one that was looked at', () => {
        // `hub-persistence.js` derives a soil verdict twice — the primary path
        // and the "empty hub form" sample fallback. GH-266 is this file's
        // cautionary tale: a fix applied to one copy and not the other, unnoticed
        // for months.
        const src = read('hub-persistence.js');
        const ladders = [...src.matchAll(/_(?:sm)?(?:soil)?[Vv]erdict = _(?:sm)?(?:has)?Def/g)];
        expect(ladders.length).toBeGreaterThanOrEqual(2);
        expect((src.match(/\.filter\(function\(n\) \{\s*\n\s*return n && n\.actual !== '-'/g) || []).length).toBe(2);
    });

    test('the rule’s other door is guarded elsewhere, and this one was not', () => {
        // Stated as a fact about the tree so the pair cannot be forgotten: the
        // growth-potential door has gh511, whose universe is the producer in
        // hub-tissue-v3.js and whose carrier is the Word document. Neither
        // mentions the soil verdict, which is why it was green while this was
        // broken.
        const gh511 = fs.readFileSync(path.join(__dirname, 'gh511-no-number-no-verdict.test.js'), 'utf8');
        expect(gh511).toMatch(/calcMixedGrowthPotential/);
        expect(gh511).not.toMatch(/soilNutrition|_soilVerdict/);
    });
});

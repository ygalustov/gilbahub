/**
 * GH-574 — THE NUTRIENT CARDS COME FROM THE ENGINE'S RESULT, NOT FROM ITS HTML.
 *
 * GH-595 — WHAT THIS FILE IS NOT ABOUT. The subject is WHERE the rows come from
 * once the engine has produced them — its own result, not its markup read back
 * through a parser. It begins after the reading of the sample has happened, so
 * `getActiveSample` returns null here and this file stays green when the sample
 * reader returns nothing. That is correct: how a sample's columns are resolved
 * is `gh490` and `gh577`, and a green here says nothing about it.
 *
 * `mlsnEngine` builds `nutrientResults` — a row per nutrient with its value, its
 * threshold, its status class, its recommendation and its AA range — renders
 * them into a table and returned only the table. `hub-persistence.js` then ran
 * that HTML back through `DOMParser` and read the cells BY POSITION to rebuild
 * the rows it had just been denied.
 *
 * That is the class this project banned after GH-459: what a document or a
 * screen prints is taken from the DATA of the object it is about, never from the
 * state of the page it was drawn on. There it cost a client another site's
 * climate in a report. Here it cost the owner her soil analysis: the engine
 * threw, the cascade caught it and returned an object instead of a string, the
 * markup was empty, and `nutrients` came back `[]` with `verdict` "NO DATA" and
 * nothing anywhere saying a computation had failed.
 *
 * WHAT CHANGED: the engine returns `{ html, nutrients }`. `computed.mlsn` still
 * holds the HTML, so every reader and every stored row keeps its shape. The
 * producer reads the rows.
 *
 * HOW THIS FILE BITES: the producer is given rows and NO markup. Put the scrape
 * back and every card assertion goes red with an empty list, because there is
 * nothing to scrape.
 */

'use strict';

const vm = require('vm');
const fs = require('fs');
const path = require('path');

const ASSETS = path.join(__dirname, '..', 'assets');
const read = (f) => fs.readFileSync(path.join(ASSETS, f), 'utf8');

/** The rows the engine produces, in its own shape. */
const ROWS = [
    { nutrient: 'K', actual: '40.0', mlsn: '37', uptakePpm: 12, targetPpm: 49,
      status: 'ADEQUATE', statusClass: 'adequate', recommendation: 'Maintain',
      deficitPpm: 0, deficitKgHa: 0 },
    { nutrient: 'P', actual: '40.0', mlsn: '21', uptakePpm: 4, targetPpm: 25,
      status: 'ADEQUATE', statusClass: 'adequate', recommendation: 'Maintain',
      deficitPpm: 0, deficitKgHa: 0 },
    { nutrient: 'Ca', actual: '803.0', mlsn: '331', uptakePpm: 9, targetPpm: 340,
      status: 'DEFICIENT', statusClass: 'deficient', recommendation: 'Apply lime',
      rangeMin: 500, rangeMax: 750, rangeSource: 'certificate',
      deficitPpm: 0, deficitKgHa: 12.4 },
];

/**
 * The producer, given a state the way the page publishes one.
 *
 * `cacheAnalysisResults()` is internal, so it is exposed by splicing the export
 * line — the shape eleven other test files use. The assertion on that line is
 * the positive control.
 */
function produce({ rows, html, soil }) {
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
        // Deliberately absent: DOMParser. A producer that still scraped would
        // throw here rather than quietly return an empty list.
    };
    sandbox.window = sandbox;
    sandbox.global = sandbox;
    sandbox.globalThis = sandbox;
    sandbox.GAIP_SampleManager = {
        getSamples: () => [],
        getActiveSample: () => null,
        getActiveSiteId: () => 'site-1',
    };
    sandbox.GAIP_STATE = {
        inputs: { soil: soil || {} },
        computed: { mlsn: html === undefined ? '' : html, mlsnRows: rows || null },
    };

    const ctx = vm.createContext(sandbox);
    vm.runInContext(testSrc, ctx, { filename: 'hub-persistence.js' });
    const snap = ctx.__test_cacheAnalysisResults();
    return (snap.computed && snap.computed.soilNutrition) || null;
}

describe('GH-574 — the producer reads rows, not markup', () => {
    test('rows and no markup at all still produce the cards', () => {
        // The bite. There is no HTML to scrape and no DOMParser in the sandbox.
        const sn = produce({ rows: ROWS, html: '' });

        expect(sn).not.toBeNull();
        expect(sn.nutrients).toHaveLength(3);
        expect(sn.nutrients.map((n) => n.nutrient)).toEqual(['K', 'P', 'Ca']);
    });

    test('every field the scrape used to recover arrives, including the ones it got wrong', () => {
        // The seven-column table read its `recommendation` out of the deficit
        // cell. Taken from the row, it is the recommendation.
        const sn = produce({ rows: ROWS, html: '' });
        const ca = sn.nutrients.filter((n) => n.nutrient === 'Ca')[0];

        expect(ca.actual).toBe('803.0');
        expect(ca.mlsn).toBe('331');
        expect(ca.status).toBe('DEFICIENT');
        expect(ca.statusClass).toBe('deficient');
        expect(ca.recommendation).toBe('Apply lime');
        expect(ca.rangeMin).toBe(500);
        expect(ca.rangeMax).toBe(750);
        expect(ca.rangeSource).toBe('certificate');
    });

    test('the verdict is derived from the rows the engine gave', () => {
        const deficient = produce({ rows: ROWS, html: '' });
        expect(deficient.verdict).toBe('HIGH_RISK');

        const fine = produce({ rows: ROWS.slice(0, 2), html: '' });
        expect(fine.verdict).toBe('ACCEPTABLE');
    });

    test('no rows means an empty list and NO DATA — nothing is invented', () => {
        // The engine threw, or never ran. The producer says so by having
        // nothing, which is what the third outcome and the run's own skip list
        // are for; it does not fill the gap.
        const sn = produce({ rows: null, html: '', soil: { pH: 6 } });
        expect(sn.nutrients).toEqual([]);
        expect(sn.verdict).toBe('NO DATA');
    });

    test('markup alone is no longer a source — the scrape is gone from the tree', () => {
        // A guard on the file rather than on a run: a later edit that puts
        // `DOMParser` back would restore the read this fix removed, and every
        // test above would still pass because it would never reach that branch.
        const src = read('hub-persistence.js');
        expect(src).not.toMatch(/gaip-mlsn-table tbody tr/);
        expect(src).not.toMatch(/parseFromString/);
    });
});

describe('GH-574 — the engine hands back both halves', () => {
    test('mlsnEngine returns an object carrying html and nutrients', () => {
        // Read from the tree rather than run: the engine needs the whole hub to
        // execute, and what is asserted here is its contract with three callers.
        const src = read('hub-tissue-v3.js');
        expect(src).toMatch(/return \{ html: html, nutrients: nutrientResults \};/);
    });

    test('every caller takes the half it wants, and none of them assumes a string', () => {
        const cascade = read('cascade-orchestrator.js');
        expect(cascade).toMatch(/computed\.mlsn = mlsnOut\.status \? mlsnOut : mlsnOut\.html;/);
        expect(cascade).toMatch(/computed\.mlsnRows = mlsnOut\.nutrients;/);

        const disclosure = read('mlsn-progressive-disclosure.js');
        expect(disclosure).toMatch(/_mlsnOut && _mlsnOut\.html/);

        const producer = read('hub-persistence.js');
        expect(producer).toMatch(/_smOut && _smOut\.html/);
    });

    test('computed.mlsn is still the HTML, so no stored row changes shape', () => {
        // The reason the engine did not simply start returning data. Rows in
        // `analysis_results` carry `computed.mlsn` as a string, and
        // `hub-tissue-v3.js` hands it on as `mlsnResults`.
        const producer = read('hub-persistence.js');
        expect(producer).toMatch(/typeof _gaipState\.computed\.mlsn === 'string'/);
    });
});

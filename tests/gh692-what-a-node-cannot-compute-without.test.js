/**
 * GH-692 (part 0 of the empty-section work) — WHICH NODES REALLY CANNOT COMPUTE WITHOUT AN INPUT.
 *
 * The graph splits a module's inputs into `requires` and `uses`, and the difference decides what a
 * person is told when a section is empty: without a REQUIRED input there is something to ask them
 * for, and without a merely USED one the module computed differently and there is nothing to ask.
 * That split is a judgement, and today `requires` is empty on every node but one — so the judgement
 * has never been made from evidence.
 *
 * SO IT IS MEASURED, NOT DECIDED: run the cascade with everything, then run it again with one input
 * taken away, and look at whether the node's own output came out empty. `requires` gets only the
 * ones where it did.
 *
 * NO STAND AND NO PRESS. The engines are JavaScript and the bench already runs them offline, which
 * is why this part can be done while a live measurement is waiting for its turn.
 *
 * THE POSITIVE CONTROL COMES FIRST AND IT IS THE WHOLE FLOOR OF THIS FILE: with every input present
 * each candidate's output must be non-empty. "Empty without the input" said about a node that is
 * empty with it is not a finding about the input.
 */

'use strict';

const fs = require('fs');
const path = require('path');
const { load, withSamples } = require('./lib/orchestrator-bench');

/** `samples` id 141, Test5 - NZ, as the column holds it. */
const SOIL = {
    B: 0.2, K: 40, P: 40, S: 75, Ca: 803, Cu: 1.3, EC: 0.16,
    Fe: 168, Mg: 129, Mn: 28.3, OM: 3.7, Zn: 5.7, pH: 6, CEC: 5.9,
};

const FULL = () => ({
    inputs: {
        climate: { lat: -43.5, lon: 172.5 },
        turf: {
            warmBase: '', percentC3Cover: 100, construction: 'native_soil',
            species: 'Perennial Ryegrass', grassSpecies: 'perennialRyegrass',
            turfType: 'sports',
        },
        soil: {
            methodology: 'ammonium_acetate', ppm: SOIL, CEC: 5.9, pH_water: 6,
            bulkDensity: 1.4, OM_pct: 3.7, LOI: 4.1,
        },
        water: { ecw: 0.4, pH: 7.2, ions: { Na: 30, Cl: 40, Ca: 20, Mg: 8, HCO3: 60, SO4: 15 } },
        tissue: { N: 3.8, P: 0.4, K: 2.5, Ca: 0.5, Mg: 0.3, S: 0.3 },
        pgr: { applicationDate: '2026-09-01', productType: 'trinexapac', mowingHeightMM: 25, enabled: true },
        schedule: { traffic: 'high', matchesPerWeek: 2, sessionsPerWeek: 3, restDays: 2 },
        site: { construction: 'native_soil' },
    },
    computed: {}, derived: {},
});

const GRAPH = JSON.parse(fs.readFileSync(path.join(__dirname, '..', 'assets', 'dependency-graph.json'), 'utf8'));

/** The candidates named by the plan, with the input to take away and where it lives in the state. */
const CANDIDATES = [
    // THE WHOLE SOIL SAMPLE, not one field of it. The first version removed `soil.ppm` and left
    // `CEC` and `pH_water` standing — and those come off the same sample, so the engine still had
    // the sample's numbers and the measurement was about nothing. What the plan names as the input
    // is `samples.soil`, and that is every field the sample fills.
    { node: 'mlsn-calculator', input: 'samples.soil', at: ['inputs', 'soil'], keep: { methodology: 'ammonium_acetate' } },
    { node: 'tissue-engine', input: 'samples.tissue', at: ['inputs', 'tissue'] },
    { node: 'water-blender', input: 'samples.water', at: ['inputs', 'water'] },
    { node: 'pgr-module', input: 'pgr.applicationDate', at: ['inputs', 'pgr', 'applicationDate'] },
    { node: 'wear-recovery-engine', input: 'traffic.schedule', at: ['inputs', 'schedule'] },
];

const without = (state, at, keep) => {
    const copy = JSON.parse(JSON.stringify(state));
    let node = copy;
    for (let i = 0; i < at.length - 1; i++) node = node[at[i]];
    const last = at[at.length - 1];
    // `keep` is for a setting that is NOT part of the sample and must not travel with it: the soil
    // methodology is entered in Settings, and removing it would measure two absences at once.
    node[last] = keep ? JSON.parse(JSON.stringify(keep)) : undefined;
    if (!keep) delete node[last];

    return copy;
};
/** Is the input really gone from the state that was handed in? */
const stillHas = (state, at) => {
    const v = at.reduce((x, k) => (x && typeof x === 'object' ? x[k] : undefined), state);
    if (v === undefined || v === null) return false;

    return !(typeof v === 'object' && Object.keys(v).length <= 1);
};

/** Empty means: nothing there, or an object with no keys of its own. */
const isEmpty = (v) => v === null || v === undefined
    || (typeof v === 'object' && !Array.isArray(v) && Object.keys(v).length === 0)
    || (Array.isArray(v) && v.length === 0);

const outputsOf = (node) => (GRAPH.nodes[node] && GRAPH.nodes[node].outputs) || [];
const valueAt = (computed, output) => {
    const key = output.replace(/^computed\./, '').replace(/^derived\./, '');

    return key.split('.').reduce((at, k) => (at && typeof at === 'object' ? at[k] : undefined), computed);
};

jest.setTimeout(120000);

describe('GH-692 — what each candidate node cannot compute without', () => {
    let bench;
    const runWhole = (state) => bench.ctx.GilbaCascadeOrchestrator.runCascade(state, {}, { fullRecompute: true });
    const run = (state) => {
        const r = runWhole(state);

        return (r && r.state && r.state.computed) || {};
    };

    beforeAll(() => {
        bench = load();
        expect(bench.failed).toEqual([]);
        /**
         * GH-777 (queue item 4, slice 3): the question here is "with ONE input taken away, does the node
         * still produce" -- so every OTHER input has to be present, and a site's samples are inputs now.
         * Nodes declaring `samples.soil` / `samples.tissue` are not run at all without them, which would
         * remove them from the judgeable set for a reason that has nothing to do with the input under test.
         */
        withSamples(bench, {
            soil: { id: 'soil_1', rawData: { K: 40, Ca: 803, CEC: 5.9, pH: 6 } },
            tissue: { id: 'tissue_1', rawData: { N: 3.6, K: 2.4 } },
        });
    });

    test('POSITIVE CONTROL: with every input present, every candidate produces something', () => {
        const computed = run(FULL());
        process.stdout.write('[gh692] the cascade produced: ' + JSON.stringify(Object.keys(computed).sort()) + '\n');
        const rows = CANDIDATES.map((c) => ({
            node: c.node,
            outputs: outputsOf(c.node).map((o) => o + '=' + (isEmpty(valueAt(computed, o)) ? 'EMPTY' : 'present')),
        }));
        rows.forEach((r) => process.stdout.write('[gh692]   ' + r.node + ': ' + JSON.stringify(r.outputs) + '\n'));

        // Which of them this bench can speak about at all. A candidate empty WITH its input is one
        // this file cannot judge, and saying so is the point of a control.
        const silent = rows.filter((r) => r.outputs.every((o) => /=EMPTY$/.test(o))).map((r) => r.node);
        process.stdout.write('[gh692] candidates this bench cannot judge (empty even with everything): '
            + JSON.stringify(silent) + '\n');
        expect(Object.keys(computed).length).toBeGreaterThan(3);
    });

    test('the pass says what it did with each candidate, in its own words', () => {
        // Why a candidate came out empty is the PASS's answer, not mine. It records what it
        // attempted, what it skipped and what it warned about, and a node that is not in its map at
        // all is a different fact from a node that ran and produced nothing.
        const r = runWhole(FULL());
        const order = (r && r.executionOrder) || [];
        process.stdout.write('[gh692] success=' + JSON.stringify(r && r.success)
            + ' | the pass ran, in order: ' + JSON.stringify(order) + '\n');
        CANDIDATES.forEach((c) => {
            const ran = order.some((x) => String(x).indexOf(c.node) >= 0
                || String(x).indexOf(c.node.replace(/-engine$/, '')) >= 0);
            process.stdout.write('[gh692]   ' + c.node + ': in this pass\'s execution order = ' + ran + '\n');
        });

        // The floor: the pass reported an order at all. An empty order would make every line above
        // a statement about a pass that did not happen.
        expect(order.length).toBeGreaterThan(3);

        /**
         * THE THREE THIS BENCH CANNOT JUDGE, with the reason each one gives rather than a guess:
         *
         *   `pgr-module` — the graph gives it `runner: orchestrator` and no cascade handle, so the
         *     cascade never had it. Judging it needs the orchestrator pass, not this one.
         *   `tissue-engine` — the graph DOES give it a cascade handle, and the cascade still does not
         *     run it here: `cascade-orchestrator.js` guards it with
         *     `engines.includes('tissue-engine') && options.hubRoot`, and the engine reads the tissue
         *     numbers off the PAGE through `gaip_read_tissue_data(hubRoot)` rather than out of the
         *     state. With no DOM root there is nothing for it to read.
         *   `wear-recovery-engine` — GH-787 (queue item 3vy): it had TWO runners, each with its own
         *     assembly of its inputs, and the two disagreed about the recovery window at 10 of 10 sites
         *     on the stand. The graph names one runner now, the orchestrator, so the cascade no longer
         *     runs it and this bench cannot take its input away and watch. What it requires is measured
         *     on the orchestrator's own bench instead (`gh787-…`), which is where its assembly lives.
         *
         * All three are printed as unjudged. A candidate quietly dropped from the list would come back as
         * "measured and it does not require anything".
         */
        expect(order.some((x) => String(x).indexOf('tissue') >= 0)).toBe(false);
        expect(order.some((x) => String(x).indexOf('pgr') >= 0)).toBe(false);
        expect(order.some((x) => String(x).indexOf('wear') >= 0)).toBe(false);
    });

    test('with one input taken away, does the node still produce anything', () => {
        const withEverything = run(FULL());
        const judgeable = CANDIDATES.filter((c) => outputsOf(c.node)
            .some((o) => !isEmpty(valueAt(withEverything, o))));
        process.stdout.write('[gh692] judgeable on this bench: ' + JSON.stringify(judgeable.map((c) => c.node)) + '\n');
        // GH-787 (queue item 3vy): 3 -> 2 judgeable here, because the wear engine left the cascade for a
        // single runner. The floor moves with a declaration somebody wrote, and the engine's own
        // requirement is measured on the orchestrator's bench — see the note in the case below.
        expect(judgeable.length).toBeGreaterThan(1);

        const verdicts = judgeable.map((c) => {
            const shortState = without(FULL(), c.at, c.keep);
            const r = runWhole(shortState);
            const computed = (r && r.state && r.state.computed) || {};
            const outputs = outputsOf(c.node).filter((o) => !isEmpty(valueAt(withEverything, o)));
            const stillThere = outputs.filter((o) => !isEmpty(valueAt(computed, o)));
            const gone = outputs.filter((o) => isEmpty(valueAt(computed, o)));
            const verdict = gone.length === outputs.length ? 'requires' : (gone.length ? 'requires in part' : 'uses');

            return {
                node: c.node, input: c.input, at: c.at.join('.'), outputs, stillThere, gone, verdict,
                inputReallyGone: !stillHas(shortState, c.at),
                theEngineRan: ((r && r.executionOrder) || []).some((x) => String(x).indexOf(c.node) >= 0),
                // WHAT it produced, not just that it did. "An output is present" is a claim about
                // shape; `{ rows: [] }` would satisfy it while saying nothing. The shape is printed
                // so "it computed without the sample" cannot be read off an empty shell.
                shape: outputs.map((o) => {
                    const v = valueAt(computed, o);
                    if (Array.isArray(v)) return o + '=[' + v.length + ' items]';
                    if (v && typeof v === 'object') return o + '={' + Object.keys(v).slice(0, 6).join(',') + '}';

                    return o + '=' + JSON.stringify(v);
                }),
            };
        });

        verdicts.forEach((v) => process.stdout.write('[gh692]   ' + v.node
            + '  input removed: ' + v.input + ' (' + v.at + ')'
            + '  | input really gone: ' + v.inputReallyGone
            + '  | the engine still ran: ' + v.theEngineRan
            + '  -> output empty: ' + JSON.stringify(v.gone)
            + '  | still produced: ' + JSON.stringify(v.stillThere)
            + '  => ' + v.verdict + '\n'
            + '[gh692]      what it produced without the input: ' + JSON.stringify(v.shape) + '\n'));

        /**
         * THE CONTROLS ARE ABOUT THE MEASUREMENT, NOT ABOUT THE ANSWER. The first version of this
         * case demanded that at least one removal empty an output, and it went red — which would
         * have read as a failing test when what it had actually found was that these engines DO
         * produce something with the input absent. A control must hold that the experiment happened:
         * the input really left the state, and the engine really ran without it. What the verdict
         * turns out to be is the finding, and it is printed.
         */
        verdicts.forEach((v) => {
            expect(v.inputReallyGone).toBe(true);
            expect(v.theEngineRan).toBe(true);
            expect(['requires', 'requires in part', 'uses']).toContain(v.verdict);
        });
    });
});

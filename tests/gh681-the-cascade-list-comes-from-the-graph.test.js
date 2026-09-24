/**
 * GH-681 (queue item 6a, item 2) — THE CASCADE'S ENGINE LIST IS DERIVED, NOT DECLARED TWICE.
 *
 * Three places declared the cascade's engines by hand: the adapter's own `engineMap`,
 * `GAIP_CASCADE_ENGINES` in the run's state builder, and the export's `detectEnginesUsed`.
 * Two of them had already drifted — the map carried `climate-engine`, `dew-prediction-engine`
 * and `disease-engine`, none of which this adapter has a branch for, and the list named
 * `mlsn-engine` and `water-engine` while the graph calls those nodes `mlsn-calculator` and
 * `water-blender`. Nothing compared either with the code, so neither could be wrong out loud.
 *
 * Both now come from the graph: the cascade's engines are the nodes whose handle is declared
 * IN THE ADAPTER'S FILE, which the data states, and the `computed` key each writes is the root
 * of its first declared output. One owner for both facts.
 *
 * THE THIRD PLACE IS NOT DERIVED, and the reason is measured rather than preferred: the
 * export's detector emits ids that are keys into the CITATION REGISTRY, and the graph's ids
 * are not the same vocabulary. On a real row of 34 keys the derived form would add fourteen
 * engines to a client's document and remove three, among them `water-quality` — which is a
 * citation key carrying `ayers-westcot`, so the reference would vanish from the document. That
 * is a change to what a client reads and it is the owner's, not mine.
 */

'use strict';

const fs = require('fs');
const path = require('path');
const vm = require('vm');

const ROOT = path.join(__dirname, '..');
const GRAPH = JSON.parse(fs.readFileSync(path.join(ROOT, 'assets', 'dependency-graph.json'), 'utf8'));
const ADAPTER = fs.readFileSync(path.join(ROOT, 'assets', 'cascade-orchestrator.js'), 'utf8');
const STATE = fs.readFileSync(path.join(ROOT, 'assets', 'hub-tissue-v3.js'), 'utf8');

/** The engines of the adapter, as the DATA states them. */
function fromTheGraph() {
    const out = {};
    Object.entries(GRAPH.nodes).forEach(([id, n]) => {
        const handles = Array.isArray(n.handle) ? n.handle : (n.handle ? [n.handle] : []);
        if (!handles.some((h) => typeof h === 'string'
            && h.indexOf('assets/cascade-orchestrator.js:') === 0)) return;
        const first = (n.outputs || []).find((o) => typeof o === 'string' && o.indexOf('computed.') === 0);
        if (first) out[id] = first.slice('computed.'.length).split('.')[0];
    });

    return out;
}

/** The adapter in a fresh context, with whatever the page was given. */
function loadAdapter(injected) {
    const sandbox = {
        console: { log() {}, warn() {}, error() {} },
        document: { addEventListener() {}, dispatchEvent() {} },
        Date, JSON, Math, Object, Array, parseFloat, isNaN,
    };
    sandbox.window = sandbox;
    sandbox.global = sandbox;
    sandbox.globalThis = sandbox;
    if (injected !== undefined) sandbox.GAIP_DEPENDENCY_GRAPH = injected;
    vm.runInNewContext(ADAPTER, sandbox, { filename: 'assets/cascade-orchestrator.js' });

    return sandbox;
}

describe('GH-681 — the adapter takes its engine list from the graph', () => {
    test('POSITIVE CONTROL: with the graph injected the map is the graph\'s own, key for key', () => {
        const expected = fromTheGraph();
        const box = loadAdapter(GRAPH);
        const actual = box.GilbaCascadeOrchestrator.getEngineMap();
        process.stdout.write('[gh681] engines the adapter declares (' + Object.keys(actual).length
            + '): ' + JSON.stringify(actual) + '\n');

        // Lists, not lengths: two maps of one size can name different engines.
        expect(Object.keys(actual).sort()).toEqual(Object.keys(expected).sort());
        expect(actual).toEqual(expected);
        expect(Object.keys(actual).length).toBeGreaterThan(10);
    });

    test('the three entries that had stopped being true are gone, by name', () => {
        // Each of these was in the hand-written map and this adapter has no branch for it:
        // they run in the orchestrator. A map nothing compares with cannot be wrong out loud.
        const actual = loadAdapter(GRAPH).GilbaCascadeOrchestrator.getEngineMap();
        const stale = ['climate-engine', 'dew-prediction-engine', 'disease-engine']
            .filter((id) => Object.prototype.hasOwnProperty.call(actual, id));
        process.stdout.write('[gh681] stale entries still in the map: ' + JSON.stringify(stale) + '\n');

        expect({ staleEntriesStillDeclared: stale }).toEqual({ staleEntriesStillDeclared: [] });
    });

    test('every id the run loop tests for is an id the graph declares', () => {
        /**
         * The rename that had to come with the derivation: the loop tested `mlsn-engine` and
         * `water-engine`, which the graph calls `mlsn-calculator` and `water-blender`. With the
         * list derived and the loop still testing the old names, MLSN and the water engine
         * would simply stop running — the list would be right and the pass would be empty.
         */
        const tested = [...ADAPTER.matchAll(/engines\.includes\('([^']+)'\)/g)].map((m) => m[1]);
        const unknown = [...new Set(tested)].filter((id) => !GRAPH.nodes[id]).sort();
        process.stdout.write('[gh681] ids the run loop tests (' + tested.length + '): '
            + JSON.stringify([...new Set(tested)].sort()) + '\n'
            + '[gh681] of those, unknown to the graph: ' + JSON.stringify(unknown) + '\n');

        expect(tested.length).toBeGreaterThan(10);
        expect({ idsTheRunLoopTestsThatTheGraphDoesNotDeclare: unknown })
            .toEqual({ idsTheRunLoopTestsThatTheGraphDoesNotDeclare: [] });
    });

    test('and the run\'s own list is the SAME set, because both read one place', () => {
        // The second hand-written declaration. Derived from the same fact, the two cannot
        // drift — which is what they had done: one named `mlsn-engine`, the other did not.
        const box = { window: { GAIP_DEPENDENCY_GRAPH: GRAPH } };
        const fn = /function gaip_cascadeEnginesFromTheGraph\(\)[\s\S]*?\n}/.exec(STATE);
        expect(fn).not.toBeNull();
        vm.runInNewContext(fn[0] + '\nresult = gaip_cascadeEnginesFromTheGraph();', box,
            { filename: 'assets/hub-tissue-v3.js' });
        process.stdout.write('[gh681] the run passes these engines: ' + JSON.stringify(box.result) + '\n');

        expect(box.result.slice().sort()).toEqual(Object.keys(fromTheGraph()).sort());
    });
});

describe('GH-681 — and with no graph the adapter refuses instead of running an empty pass', () => {
    test('the map is empty and the pass is refused with a reason', () => {
        // An empty engine list would produce a result with no modules in it and report
        // success: "a run that answered nothing and said nothing". The refusal names itself.
        const box = loadAdapter(undefined);
        const map = box.GilbaCascadeOrchestrator.getEngineMap();
        const out = box.GilbaCascadeOrchestrator.runCascade({ inputs: {} }, {});
        process.stdout.write('[gh681] with no graph — engines: ' + JSON.stringify(Object.keys(map))
            + ' | runCascade: ' + JSON.stringify({ success: out.success,
                refusedWithoutTheGraph: out.refusedWithoutTheGraph }) + '\n');

        expect(Object.keys(map)).toEqual([]);
        expect(out.success).toBe(false);
        // Not a CODE: a refusal the runner reports must carry a sentence a client reads, and
        // the words are the owner's. The fact is recorded in the pass's journal instead.
        expect(out.refusedWithoutTheGraph).toBe(true);
        expect(out.reason).toBeUndefined();
    });
});

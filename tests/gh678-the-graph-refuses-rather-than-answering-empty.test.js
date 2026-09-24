/**
 * GH-678 (queue item 6, place 3 — the gates; the analyst's 59.5 item 3 and 59.6) —
 * A GRAPH WITH NO DATA INSTALLS NOTHING, INSTEAD OF ANSWERING "AFFECTS NOTHING".
 *
 * WHAT THE DEFECT WOULD BE. `dependency-graph.js` used to carry the graph itself:
 * twenty-six engines declared by hand in this file, and the same facts declared again
 * in three other places. The data moved out (GH-676) and was filled in from the test's
 * own output (GH-677), so the file now reads `window.GAIP_DEPENDENCY_GRAPH`. A file
 * that reads injected data has a new failure the hand-written one did not: the data
 * can be absent. Built from nothing, every query answers with an empty list —
 * `getAffectedEngines('soil.CEC')` returns `[]` — and the warning the page is about to
 * build from it would read "changing this affects nothing". That is not a caveat with
 * a caveat's shape; it is a false statement wearing a correct answer's clothes, and it
 * is the class this repository has spent two days removing.
 *
 * SO ABSENCE IS AN OUTCOME. No `GilbaDependencyGraph` is installed at all, and a
 * marker says which absence it was. Every caller in the run already tests for the
 * object and falls back to recomputing EVERYTHING, so the fallback computes more
 * rather than guessing less.
 *
 * THE UNIVERSE IS THE FILE ON DISK, executed in a fresh context per case (`vm`), so
 * one case cannot leave a graph installed for the next — which is exactly the shape
 * this test is about.
 *
 * WHAT IS NOT CLAIMED HERE, and it is named rather than left to be noticed: the run
 * does not yet REFUSE a write when the graph is missing, the way it refuses on a
 * missing result schema (`schema-unavailable`). That needs a new reason code; a reason
 * code must carry a sentence a client reads, or `Gh638TheClassDecidesTheOffer` reddens;
 * and the words are the owner's. This test covers the silent empty graph, which is the
 * defect. The refusal is a separate claim with a separate owner decision.
 */

'use strict';

const fs = require('fs');
const path = require('path');
const vm = require('vm');

const ROOT = path.join(__dirname, '..');
const SOURCE = fs.readFileSync(path.join(ROOT, 'assets', 'dependency-graph.js'), 'utf8');
const DATA = JSON.parse(fs.readFileSync(path.join(ROOT, 'assets', 'dependency-graph.json'), 'utf8'));

/** The file, run in a fresh context with whatever the page was given. */
function load(injected) {
    const sandbox = { console: { error() {}, warn() {}, log() {} }, Date };
    sandbox.window = sandbox;
    if (injected !== undefined) sandbox.GAIP_DEPENDENCY_GRAPH = injected;
    vm.runInNewContext(SOURCE, sandbox, { filename: 'assets/dependency-graph.js' });

    return sandbox;
}

describe('GH-678 — the graph takes its data from the page', () => {
    test('POSITIVE CONTROL: with the data injected it installs, and it ANSWERS A REAL QUESTION', () => {
        const box = load(DATA);
        const graph = box.GilbaDependencyGraph;
        const affected = graph.getAffectedEngines('turf.construction');
        process.stdout.write('[gh678] engines installed: ' + graph.getAllEngines().length
            + ' | version ' + graph.version + '\n'
            + '[gh678] `turf.construction` affects, BY NAME: ' + JSON.stringify(affected) + '\n');

        // Named, not counted: a count of 8 would be the same number if it were eight
        // wrong engines, and the whole purpose of the graph is which ones.
        expect(affected).toContain('firmness-engine');
        expect(affected).toContain('wear-recovery-engine');
        expect(affected).toContain('irrigation-scheduler');
        expect(graph.getAllEngines().length).toBe(Object.keys(DATA.nodes).length);
    });

    test('the definitions are a TRANSFORM of the data, compared node by node', () => {
        const graph = load(DATA).GilbaDependencyGraph;
        const drifted = [];
        Object.entries(DATA.nodes).forEach(([id, node]) => {
            const def = graph.getEngine(id);
            if (!def) { drifted.push(id + ' is in the data and not in the graph'); return; }
            const inputs = [].concat(node.requires || [], node.uses || []);
            if (JSON.stringify(def.inputs) !== JSON.stringify(inputs)) {
                drifted.push(id + ' inputs: ' + JSON.stringify(def.inputs) + ' against ' + JSON.stringify(inputs));
            }
            if (JSON.stringify(def.engines) !== JSON.stringify(node.after || [])) {
                drifted.push(id + ' after: ' + JSON.stringify(def.engines) + ' against ' + JSON.stringify(node.after));
            }
        });
        process.stdout.write('[gh678] nodes compared: ' + Object.keys(DATA.nodes).length
            + ' | drifted: ' + JSON.stringify(drifted) + '\n');

        expect({ theGraphDisagreesWithItsData: drifted }).toEqual({ theGraphDisagreesWithItsData: [] });
    });

    test('and no second declaration of the same facts is left in the file', () => {
        // The file carried 335 lines of hand-written engine definitions. A dead copy
        // is still a copy: nothing reads it, so nothing notices when it drifts.
        const literals = SOURCE.match(/^\s*'[a-z][a-z0-9-]*-(?:engine|calculator|module|scheduler|forecast)'\s*:\s*\{/gm) || [];
        process.stdout.write('[gh678] engine literals left in the file: ' + literals.length + '\n');

        expect({ handWrittenDefinitionsLeft: literals }).toEqual({ handWrittenDefinitionsLeft: [] });
    });
});

describe('GH-678 — and with no data it installs NOTHING, rather than answering nothing', () => {
    test('the page was not given a graph at all', () => {
        const box = load(undefined);
        process.stdout.write('[gh678] with no injected data — installed: '
            + (box.GilbaDependencyGraph === undefined ? 'nothing' : typeof box.GilbaDependencyGraph)
            + ' | marker: ' + JSON.stringify(box.GAIP_DEPENDENCY_GRAPH_UNAVAILABLE) + '\n');

        expect(box.GilbaDependencyGraph).toBeUndefined();
        expect(box.GAIP_DEPENDENCY_GRAPH_UNAVAILABLE.reason)
            .toBe('the page was not given a dependency graph');
    });

    test('the page was given a graph with no nodes — the OTHER absence, told apart', () => {
        // Two absences, two sentences. A deploy that ships the injection but an empty
        // data file is not the same fault as one that ships no injection, and a single
        // message would send a reader to the wrong place.
        const box = load({ version: 1, nodes: {} });
        process.stdout.write('[gh678] with an empty graph — marker: '
            + JSON.stringify(box.GAIP_DEPENDENCY_GRAPH_UNAVAILABLE) + '\n');

        expect(box.GilbaDependencyGraph).toBeUndefined();
        expect(box.GAIP_DEPENDENCY_GRAPH_UNAVAILABLE.reason)
            .toBe('the injected graph carried no nodes');
    });

    test('THE DEFECT ITSELF: an empty graph would have answered "affects nothing"', () => {
        // The measurement that makes the case above worth making. The same module,
        // given an empty graph and forced to install anyway, answers every question
        // with an empty list — indistinguishable on screen from a true "nothing
        // depends on this". This is what the refusal above prevents, executed rather
        // than argued.
        const forced = SOURCE.replace(
            'if (!INJECTED_NODES || !Object.keys(INJECTED_NODES).length) {',
            'if (false) {');
        const sandbox = { console: { error() {}, warn() {}, log() {} }, Date };
        sandbox.window = sandbox;
        sandbox.GAIP_DEPENDENCY_GRAPH = { version: 1, nodes: {} };
        vm.runInNewContext(forced, sandbox, { filename: 'assets/dependency-graph.js (gate removed)' });
        const answer = sandbox.GilbaDependencyGraph.getAffectedEngines('turf.construction');
        process.stdout.write('[gh678] with the gate removed, `turf.construction` affects: '
            + JSON.stringify(answer) + ' — and the real graph says '
            + JSON.stringify(load(DATA).GilbaDependencyGraph.getAffectedEngines('turf.construction').length)
            + ' engines\n');

        expect(sandbox.GilbaDependencyGraph).toBeDefined();
        expect(answer).toEqual([]);
    });
});

/**
 * GH-763 (queue item 3vl) — DO THE TWO NODES REACH THEIR OWN DECLARED HANDLES, MEASURED BY WHAT RAN.
 *
 * `dependency-graph.json` declares `irrigation-scheduler` with the handle `buildIrrigationInputs`
 * and `pgr-module` with `buildPGRInputs`, both with `runner: "orchestrator"`. GH-755 measured that
 * the only call site of either sits inside `executeEngine` — an export with no caller and no entry —
 * and the caller walk then reports both handles as reached by nobody. That report is a reading of
 * text; this is the behaviour.
 *
 * BOTH OUTCOMES WERE NAMED BEFORE THE RUN, and this file prints whichever happened:
 *   A — a handle is entered from somewhere other than `executeEngine`. Then the node is alive, the
 *       graph is right, and the removal of `executeEngine` orphans nothing: item 3bz proceeds and the
 *       caller walk's red was about something else.
 *   B — a handle is entered from nowhere, and its only call site is inside `executeEngine`. Then the
 *       graph declares a handle that, once the dead export goes, nothing reaches — and what the graph
 *       should say about it is the analyst's decision, not this file's.
 *
 * WHAT THIS DOES NOT SEE, said rather than left to be discovered: branches the bench does not
 * execute and views it does not load. A stack proves that something ran, never that nothing can; the
 * absence claim rests on the call sites, and the sites are printed beside the entries.
 */

'use strict';

const fs = require('fs');
const path = require('path');

const ROOT = path.join(__dirname, '..');

/**
 * The two nodes and the functions their handles used to name. Kept as a map so the case names both
 * the node and the handle it promised, and so a third node joining this state is added here rather
 * than discovered.
 */
const HANDLES = {
    'irrigation-scheduler': 'buildIrrigationInputs',
    'pgr-module': 'buildPGRInputs',
};

describe('GH-763 — the two nodes declare no handle, and the functions that were their handles are gone', () => {
    test('the graph promises nothing it cannot keep, and the reason is written where the node is', () => {
        /**
         * WHAT THIS FILE MEASURED BEFORE THE DECISION, and the numbers are kept because they are the
         * reason for it: each handle had exactly ONE call site in the tree, both inside `executeEngine`
         * (`buildIrrigationInputs` at hub-orchestrator.js:5780, `buildPGRInputs` at :5821), nothing
         * outside it, and neither was ever entered on the bench — 6987 entries, no load failures. All
         * four writes of `computed.irrigation` and `computed.pgr` were inside the same dead export, so
         * the pass produced neither output.
         *
         * THE ANALYST'S DECISION (queue item 3vl): the nodes stay as declarations of an output, since
         * both outputs are in the stored row and both forecast nodes name them in `after`, and the
         * promise goes — `runner: null`, `handle: null`, with the reason at the node. GH-755 then
         * removed the two builders with the path that called them.
         *
         * So what is asserted now is the state that decision produced, in both directions: the nodes
         * are there, they promise no runner and no handle, the reason is written down, and the two
         * functions do not exist anywhere in the tree.
         */
        const graph = JSON.parse(fs.readFileSync(path.join(ROOT, 'assets/dependency-graph.json'), 'utf8'));
        const orch = fs.readFileSync(path.join(ROOT, 'assets/hub-orchestrator.js'), 'utf8');
        const rows = Object.entries(HANDLES).map(([node, handle]) => {
            const n = graph.nodes[node];

            return {
                node,
                handle,
                runner: n && n.runner,
                declaredHandle: n && n.handle,
                why: n && n.noRunnerBecause ? n.noRunnerBecause.slice(0, 60) + '…' : null,
                outputs: n && n.outputs,
                definedInTheTree: new RegExp('function\\s+' + handle + '\\b').test(orch),
            };
        });
        process.stdout.write('[gh763] the two nodes after the decision:\n'
            + rows.map((r) => '[gh763]    ' + r.node + ': runner ' + JSON.stringify(r.runner)
                + ', handle ' + JSON.stringify(r.declaredHandle)
                + ', outputs ' + JSON.stringify(r.outputs)
                + ', `' + r.handle + '` still defined: ' + r.definedInTheTree
                + '\n[gh763]       why: ' + r.why).join('\n') + '\n');

        // The nodes are real, and named, or the claims below would be about nothing. Compared as a
        // LIST rather than counted: a third node arriving in this state is red and named here.
        expect(rows.map((r) => r.node)).toEqual(['irrigation-scheduler', 'pgr-module']);
        rows.forEach((r) => {
            expect([r.node, r.runner]).toEqual([r.node, null]);
            expect([r.node, r.declaredHandle]).toEqual([r.node, null]);
            // A null handle without a reason is a silence, which is what this item was opened against.
            expect(r.why).toBeTruthy();
            // The output stays declared: that is why the node stays at all.
            expect(r.outputs.length).toBeGreaterThan(0);
            // And the function that was the handle is gone from the tree.
            expect([r.handle, r.definedInTheTree]).toEqual([r.handle, false]);
        });
    });
});

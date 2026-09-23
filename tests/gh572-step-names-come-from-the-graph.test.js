/**
 * GH-572 — THE NAMES IN THE PANEL'S SENTENCE COME FROM THE DEPENDENCY GRAPH.
 *
 * The panel used to print the module's own identifier at the reader —
 * "wear were not computed". `AnalysisNotice::STEP_NAMES` gives each module the
 * words a person reads. Those words are not invented in the PHP: every engine
 * in `assets/dependency-graph.js` already declares a `label` and the
 * `computed.*` key it writes, and the entry for a module is taken from the label
 * of the engine that writes the key of the same name.
 *
 * WHAT KIND OF CHECK THIS IS, said plainly: it is a declaration checked against
 * a declaration, not a measurement of behaviour. What the panel actually prints
 * is measured in `Gh570WhatThePanelSaysOnTheLiveRowsTest`. This file exists for
 * the other failure — the two lists drifting apart, quietly, months from now.
 *
 * HOW IT BITES: rename an engine's label in the graph, or add a module to
 * `hub-orchestrator.js` that warns under a name nobody has given words to, and
 * this goes red naming the module.
 */

'use strict';

const fs = require('fs');
const vm = require('vm');
const path = require('path');

const ROOT = path.join(__dirname, '..');
const NOTICE = fs.readFileSync(path.join(ROOT, 'app/app/Support/AnalysisNotice.php'), 'utf8');
const ORCH = fs.readFileSync(path.join(ROOT, 'assets/hub-orchestrator.js'), 'utf8');

/** `STEP_NAMES` as the PHP declares it. */
function stepNames() {
    const block = NOTICE.match(/private const STEP_NAMES = \[([\s\S]*?)\n    \];/);
    expect(block).not.toBeNull();
    const out = {};
    for (const m of block[1].matchAll(/'([^']+)'\s*=>\s*'([^']*)'/g)) out[m[1]] = m[2];
    return out;
}

/** Every engine the graph knows, by the `computed.*` key it writes. */
function labelsByComputedKey() {
    const sb = { console: { log() {}, warn() {}, error() {} } };
    sb.window = sb; sb.global = sb; sb.globalThis = sb;
    vm.runInNewContext(fs.readFileSync(path.join(ROOT, 'assets/dependency-graph.js'), 'utf8'), sb,
        { filename: 'dependency-graph.js' });
    const graph = sb.GilbaDependencyGraph;
    expect(graph && typeof graph.getAllEngines).toBe('function');

    const out = {};
    for (const id of graph.getAllEngines()) {
        const e = graph.getEngine(id);
        for (const o of e.outputs || []) {
            const m = /^computed\.([A-Za-z]+)$/.exec(o);
            if (m && !out[m[1]]) out[m[1]] = e.label;
        }
    }
    return out;
}

/** "Wear & Recovery Engine" -> "wear and recovery engine" */
const normalise = (s) => s.toLowerCase().replace(/&/g, 'and').replace(/\s+/g, ' ').trim();

/**
 * The modules in `STEP_NAMES` that deliberately have no engine of their own:
 * the orchestrator talking about itself, or a step that is not a graph node.
 * Listed here rather than inferred, so that a module which SHOULD have had a
 * graph entry cannot slip in by simply not having one.
 */
const NO_ENGINE_OF_ITS_OWN = ['cascade', 'water', 'canonical', 'confidence', 'dmi', 'engine', 'isolated', 'selective', 'orchestrator'];

/**
 * Four modules whose `warn` name is not the `computed.*` key their engine
 * writes. The alias is a fact about the two files and belongs to the check
 * between them, not to either side: the panel's map is about words a reader
 * sees, and the graph is about what an engine writes.
 */
const GRAPH_KEY = {
    // GH-586: the water quality result has no engine of its own in the graph —
    // the graph declares `water-blender` (`computed.waterBlend`) and nothing for
    // `computed.water`, which the cascade adapter writes. So the module is named
    // in the list below rather than checked against a label that does not exist.

    'forecast': 'diseaseForecast',
    'pre-emergent': 'preEmergent',
    'stress-trajectory': 'stressTrajectory',
    'tissue-corrective': 'tissue',
};
const graphKeyOf = (module) => GRAPH_KEY[module] || module;

describe('GH-572 — the words a module is called', () => {
    test('the two sources are real — both parse and are not empty', () => {
        // Positive control. An empty map and an empty graph agree perfectly.
        const names = stepNames();
        const labels = labelsByComputedKey();
        expect(Object.keys(names).length).toBeGreaterThan(15);
        expect(Object.keys(labels).length).toBeGreaterThan(15);
        expect(labels.wear).toBe('Wear & Recovery Engine');
    });

    test('every named module with an engine takes its words from that engine’s label', () => {
        const names = stepNames();
        const labels = labelsByComputedKey();

        Object.entries(names).forEach(([module, words]) => {
            if (NO_ENGINE_OF_ITS_OWN.includes(module)) return;
            const label = labels[graphKeyOf(module)];
            expect([module, label]).not.toEqual([module, undefined]);
            expect([module, normalise(label)]).toEqual([module, expect.stringContaining(normalise(words))]);
        });
    });

    test('the modules with no engine are exactly the ones listed as having none', () => {
        const names = stepNames();
        const labels = labelsByComputedKey();
        const without = Object.keys(names).filter((m) => !labels[graphKeyOf(m)]).sort();
        expect(without).toEqual([...NO_ENGINE_OF_ITS_OWN].sort());
    });

    test('every module the orchestrator warns under has words', () => {
        // The fill for this map, and it is the reason it will not rot: add a
        // `warn("newthing", …)` and this goes red naming it.
        const names = stepNames();
        const used = new Set();
        for (const m of ORCH.matchAll(/(?:^|[^.\w])(?:warn|note)\(\s*\n?\s*["']([a-z][a-z-]*)["']/gm)) used.add(m[1]);
        for (const m of ORCH.matchAll(/noteSkipped\(\s*["']([a-z-]+)["']\s*,\s*["']([a-z-]+)["']/g)) {
            used.add(m[1]); used.add(m[2]);
        }
        expect(used.size).toBeGreaterThan(10);
        const unnamed = [...used].filter((m) => !names[m]).sort();
        expect(unnamed).toEqual([]);
    });
});

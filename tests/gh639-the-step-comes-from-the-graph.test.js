/**
 * GH-639 (link 11) — THE COMPOSER READS THE GRAPH, AND THIS CHECKS THAT ITS
 * READING STILL AGREES WITH THE GRAPH.
 *
 * WHY IT EXISTS. `AnalysisNotice::stepWriting()` decides which step writes a
 * section by asking two declared sources: the graph, for whether any engine
 * writes `computed.<key>`, and `STEP_NAMES`, for whether the run warns under
 * that step. This side runs the graph — the only place that can, since it is
 * JavaScript — and states which declared consumer keys therefore get a step and
 * which do not. The other side of the check is in PHP
 * (`Gh639SectionSentenceTest`), where the composer's own reading is compared
 * with a second, independent count of `computed.*` in the same file, so a
 * reformat that hides an engine from it is red rather than silent on screen.
 *
 * THE SAME SHAPE `gh572` USES for the step vocabulary; this is its other half,
 * about the keys rather than the words.
 */

'use strict';

const fs = require('fs');
const path = require('path');
const vm = require('vm');

const ROOT = path.join(__dirname, '..');
const GRAPH_SRC = fs.readFileSync(path.join(ROOT, 'assets/dependency-graph.js'), 'utf8');
const NOTICE = fs.readFileSync(path.join(ROOT, 'app/app/Support/AnalysisNotice.php'), 'utf8');
const SCHEMA = JSON.parse(fs.readFileSync(path.join(ROOT, 'assets/analysis-result.schema.json'), 'utf8'));

/** What the graph itself says, by running it. */
function keysByRunningTheGraph() {
    const sb = { console: { log() {}, warn() {}, error() {} } };
    // GH-678 (place 3 -- the gates): the graph's facts live in
    // `assets/dependency-graph.json` and reach the page as
    // `window.GAIP_DEPENDENCY_GRAPH`. The module no longer carries them, and given
    // nothing it installs NOTHING rather than answering "affects nothing" -- so a
    // sandbox that wants a graph has to hand it the data, exactly as a page does.
    // This is not the graph comparing with itself: the other side of every claim
    // below is elsewhere (the notice's step names, the bucket census, the composer).
    sb.window = sb;
    sb.GAIP_DEPENDENCY_GRAPH = JSON.parse(
    fs.readFileSync(path.join(ROOT, 'assets/dependency-graph.json'), 'utf8'));
    sb.window = sb; sb.global = sb; sb.globalThis = sb;
    vm.runInNewContext(GRAPH_SRC, sb, { filename: 'dependency-graph.js' });
    const graph = sb.GilbaDependencyGraph;
    expect(graph && typeof graph.getAllEngines).toBe('function');

    const out = {};
    for (const id of graph.getAllEngines()) {
        for (const o of graph.getEngine(id).outputs || []) {
            const m = /^computed\.([A-Za-z]+)$/.exec(o);
            if (m && !out[m[1]]) out[m[1]] = id;
        }
    }
    return out;
}

/** `STEP_NAMES`, as the PHP declares it. */
function stepNames() {
    const block = NOTICE.match(/private const STEP_NAMES = \[([\s\S]*?)\n    \];/);
    expect(block).not.toBeNull();
    const out = {};
    for (const m of block[1].matchAll(/'([^']+)'\s*=>\s*'([^']*)'/g)) out[m[1]] = m[2];
    return out;
}

const kebab = (key) => key.replace(/(?!^)[A-Z]/g, (c) => '-' + c).toLowerCase();

describe('GH-639 — the composer’s reading of the graph', () => {
    test('POSITIVE CONTROL: the graph runs and declares its keys', () => {
        // An empty reading agrees with an empty graph perfectly, which is the
        // failure this guards against.
        const byRun = keysByRunningTheGraph();
        process.stdout.write('\n[gh639] the graph declares ' + Object.keys(byRun).length + ' computed keys\n');
        expect(Object.keys(byRun).length).toBeGreaterThan(15);
        expect(byRun.pgr).toBe('pgr-module');
    });

    test('and it says which declared consumer keys get a step and which do not', () => {
        // The boundary, printed. A key with no step answers `not-recorded`
        // rather than being given a plausible one, and this is the list of them.
        const byRun = keysByRunningTheGraph();
        const names = stepNames();
        const withStep = [];
        const withoutStep = [];
        (SCHEMA.computed.readByConsumers || []).forEach((key) => {
            const step = [key, kebab(key)].find((c) => names[c]);
            if (byRun[key] && step) withStep.push(key);
            else withoutStep.push(key);
        });
        process.stdout.write('[gh639] consumer keys with a step (' + withStep.length + '): '
            + withStep.join(' ') + '\n[gh639] with no step (' + withoutStep.length + '): '
            + withoutStep.join(' ') + '\n');

        expect(withStep).toContain('pgr');
        expect(withStep).toContain('stressTrajectory');
        expect(withoutStep).toEqual(
            // GH-677: `forecast` HAS LEFT THIS LIST, and it left because the graph
            // stopped being wrong. The `disease-forecast` node declared
            // `computed.diseaseForecast`, a key no pass has ever written, so the
            // composer could find no step for the `computed.forecast` the pass really
            // writes. The node declares what it writes now, so the key gets a step.
            // GH-734: `soilTempPhysics` HAS LEFT IT TOO, and for the same kind of reason — the
            // declarations stopped disagreeing. `STEP_NAMES` had no word for `soil-temp-physics`,
            // so the composer could name no step for the key that engine writes; the map takes the
            // graph's own label for it now, and the key resolves by the first declared path.
            // GH-777 (queue item 4, slice 2): `confidence` HAS LEFT IT, third time for the same kind of
            // reason. The pass has called the confidence summary since v1.3.0 and its result is in 14 of
            // 14 stored rows, while the graph said nothing about it at all — so the composer had no step
            // to name for the key. The node is declared now, measured from that call site, and the key
            // resolves like any other.
            ['applicationWindow', 'soilNutrition', 'tissue', 'waterBalance']);
    });
});

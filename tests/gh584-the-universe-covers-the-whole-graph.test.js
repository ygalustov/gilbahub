/**
 * GH-584 (was GH-582) — THE UNIVERSE OF THE SWEEP COMES FROM SOMEWHERE ELSE,
 * AND IT COVERS THE WHOLE GRAPH.
 *
 * FIRST FINDING (Venya, 22.09.2026). The end-of-pass sweep decided what to look
 * for from `computed.attempted` — a list the pass writes about itself. A step
 * that never registered was in neither `attempted` nor `skipped`, so the report
 * said "everything I took on, I produced" and was silent about work it never
 * took on. The universe was taken from the witness.
 *
 * SECOND FINDING (Venya, same night, on the first fix). The independent list was
 * read through `/^computed\.([A-Za-z]+)$/`, which is one shape out of four. The
 * graph declares FIFTY outputs; that pattern caught TWENTY-ONE. Missed:
 * `derived.growthPotential` and three more under `derived.*`; twenty-four nested
 * `computed.a.b`; one `window.*`. Four engines — firmness, nopt, traffic, turf
 * manager — declare no single-segment `computed.*` output at all and were
 * invisible to the universe entirely. "Independent of the witness" and
 * "complete" are two different properties, and only the first had been checked.
 *
 * SO THE UNIT IS THE ENGINE, NOT THE PATH. An engine is accounted for however it
 * writes: one segment, three, `derived.*` or a window global. Twenty-six engines,
 * every one of them in exactly one named bucket, and a bucket that stops naming
 * a real engine fails the test — an excuse list is not a hiding place.
 *
 * HOW IT BITES: add an engine to the graph and it lands in no bucket, red with
 * its id. Take a step out of `attempting()` and it leaves the attempted bucket,
 * red with its id. Rename a graph engine and the bucket holding it names
 * nothing, red.
 */

'use strict';

const fs = require('fs');
const vm = require('vm');
const path = require('path');
const { load, computeAll } = require('./lib/orchestrator-bench');

const ROOT = path.join(__dirname, '..');
const FIXTURE = JSON.parse(fs.readFileSync(
    path.join(__dirname, 'fixtures', 'q31-federal-golf-climate.json'), 'utf8'));

const FEDERAL_GOLF = {
    turf: { species: 'Creeping Bentgrass (Greens)', methodology: 'slan', surface: 'greens' },
    site: { lat: -35.3317, lon: 149.11, latitude: -35.3317, longitude: 149.11 },
};

/**
 * Every engine the graph declares, with the `computed.*` ROOTS it writes —
 * `computed.firmness.FI` counts as `firmness` — and everything it writes that
 * is not under `computed` at all, kept rather than dropped so a `derived.*`-only
 * engine cannot slip out of the universe.
 */
function declaredEngines() {
    const sb = { console: { log() {}, warn() {}, error() {} } };
    sb.window = sb; sb.global = sb; sb.globalThis = sb;
    vm.runInNewContext(fs.readFileSync(path.join(ROOT, 'assets/dependency-graph.js'), 'utf8'), sb,
        { filename: 'dependency-graph.js' });
    const graph = sb.GilbaDependencyGraph;
    expect(graph && typeof graph.getAllEngines).toBe('function');

    const out = {};
    for (const id of graph.getAllEngines()) {
        const roots = new Set(), elsewhere = [];
        for (const o of graph.getEngine(id).outputs || []) {
            const m = /^computed\.([A-Za-z]+)/.exec(o);      // no `$`: nested paths count
            if (m) roots.add(m[1]); else elsewhere.push(o);
        }
        out[id] = { roots: [...roots], elsewhere };
    }
    return out;
}

/**
 * GH-585 — AND THE CENSUS IS OF OUTPUTS, NOT ONLY OF ENGINES.
 *
 * Third finding on this same guard, and the sharpest: the accounting was BY
 * ENGINE. Add `derived.venyaGhost` as a new output of an engine that is already
 * in a bucket and the suite stayed green, six of six — the engine was accounted
 * for, its new result was named by nobody. The printed output count moved from
 * 31 to 32 and no assertion was tied to that number, so the growth woke nobody.
 *
 * The buckets closed the ENTRANCE to the graph and left EXPANSION INSIDE IT
 * open. So every declared output is pinned here, by engine, exactly as the graph
 * states it today. A new output on an existing engine goes red naming both.
 *
 * This list is meant to be edited — deliberately, when the graph really gains an
 * output, in the same change that gives it a home. That is the difference
 * between a deliberate act and a silent one, which is the whole subject.
 */
const DECLARED_OUTPUTS = {
    'ambient-dli-engine': ['computed.ambientDLI'],
    'bipolaris-curvularia-engine': ['computed.disease.leafSpot'],
    'climate-engine': ['computed.climate', 'derived.growthPotential'],
    'dew-prediction-engine': ['computed.dew', 'computed.dew.leafWetness'],
    'disease-engine': ['computed.disease', 'computed.disease.overallRisk'],
    'disease-forecast': ['computed.diseaseForecast'],
    'firmness-engine': [
        'computed.firmness.FI',
        'computed.firmness.hardnessClass',
        'computed.firmness.softnessRisk',
        'computed.firmness.surfaceHardness',
    ],
    'irrigation-forecast': ['computed.irrigationForecast'],
    'irrigation-scheduler': ['computed.irrigation'],
    'mlsn-calculator': ['computed.mlsn'],
    'nopt-engine': [
        'computed.nitrogen.applied',
        'computed.nitrogen.growthData',
        'computed.nitrogen.opt',
        'computed.nitrogen.status',
    ],
    'nutrient-demand-engine': ['computed.nutrientDemand'],
    'pgr-forecast': ['computed.pgrForecast'],
    'pgr-module': ['computed.pgr'],
    'phytotoxicity-engine': ['computed.phytotoxicity'],
    'pre-emergent-engine': [
        'computed.preEmergent',
        'computed.preEmergent.aggregateStatus',
        'computed.preEmergent.results',
        'window.GAIP_PRE_EMERGENT_RESULT',
    ],
    'salinity-penalty-engine': ['computed.salinity', 'computed.salinity.growthPenaltyPct'],
    'shade-engine': ['computed.shade', 'computed.shade.dli', 'computed.shade.stressFactor'],
    'soil-tissue-integration': ['computed.soilTissueIntegration'],
    'stress-aggregator': [
        'computed.stress',
        'derived.combinedGrowthModifier',
        'derived.environmentalStressIndex',
    ],
    'stress-trajectory-engine': ['computed.stressTrajectory'],
    'tissue-engine': ['computed.tissue'],
    'traffic-engine': [
        'computed.traffic.TrafficRisk',
        'computed.traffic.recoveryProb',
        'computed.traffic.recoveryWindow',
        'computed.traffic.trafficLevel',
    ],
    'turf-manager-engine': [
        'computed.turfManager.cutbackPercent',
        'computed.turfManager.playability',
        'computed.turfManager.playerRisk',
        'computed.turfManager.renovationTrigger',
    ],
    'water-blender': ['computed.waterBlend'],
    'wear-recovery-engine': ['computed.wear', 'derived.adjustedRecoveryDays'],
};

/** The pass declares this engine's work under a different name than the graph does. */
const NAMED_DIFFERENTLY = { 'disease-forecast': 'forecast' };

/** Run by the cascade adapter, which sweeps its own results (GH-573). */
const RUN_BY_THE_CASCADE = [
    'mlsn-calculator', 'water-blender', 'phytotoxicity-engine',
    'firmness-engine', 'nopt-engine', 'traffic-engine', 'turf-manager-engine',
];

/**
 * Produced by THIS pass and never declared by it — the hole the first finding is
 * about, written down so it cannot grow quietly. They are written inside
 * `executeEngine()`, a switch that marks no attempt. Giving it one turns a site
 * with no PGR configured into a partial run, which is the owner's decision and
 * not a repair; her answer on 22.09.2026 was not to declare them.
 */
const PRODUCED_BUT_NEVER_DECLARED = [
    'irrigation-scheduler', 'pgr-module', 'tissue-engine', 'salinity-penalty-engine',
];

/** Declared by the graph and not run on this path at all. */
const NOT_RUN_HERE = [
    'ambient-dli-engine', 'irrigation-forecast', 'pgr-forecast',
    'nutrient-demand-engine', 'soil-tissue-integration',
];

jest.setTimeout(60000);

describe('GH-584 — every engine the graph declares is in exactly one named bucket', () => {
    let engines, attempted, produced;

    beforeAll(async () => {
        const bench = load();
        expect(bench.failed).toEqual([]);           // positive control
        engines = declaredEngines();
        const out = await computeAll(bench, Object.assign({ climateMetrics: FIXTURE.climate }, FEDERAL_GOLF));
        attempted = new Set((out.state.computed.attempted || []).map((a) => a.resultKey));
        produced = new Set(Object.keys(out.state.computed)
            // The pass's own bookkeeping, which is not a result: what it said,
            // what it skipped, what it took on, when it began and — GH-589 —
            // which input objects it read.
            .filter((k) => !['warnings', 'skipped', 'attempted', 'passStartedAt', 'passInputs'].includes(k)));

        process.stdout.write('[q64] graph declares ' + Object.keys(engines).length + ' engines, '
            + Object.values(engines).reduce((n, e) => n + e.roots.length + e.elsewhere.length, 0)
            + ' outputs; the pass declares ' + attempted.size + ' results\n');
    });

    test('both sides are real before they are compared', () => {
        expect(Object.keys(engines).length).toBeGreaterThan(20);
        expect(attempted.size).toBeGreaterThan(4);
        expect(engines['wear-recovery-engine']).toBeTruthy();
    });

    test('the universe covers every output shape the graph uses, not one of four', () => {
        // The second finding, as an assertion. `derived.*`, nested `computed.a.b`
        // and a `window.*` global are all declarations of work; an engine that
        // writes only those is still an engine.
        const shapes = new Set();
        Object.values(engines).forEach((e) => {
            e.roots.forEach(() => shapes.add('computed'));
            e.elsewhere.forEach((o) => shapes.add(o.split('.')[0]));
        });
        expect([...shapes].sort()).toEqual(['computed', 'derived', 'window']);

        // and no engine is invisible: every one of the twenty-six has at least
        // one output the universe can see it by.
        const invisible = Object.entries(engines)
            .filter(([, e]) => !e.roots.length && !e.elsewhere.length)
            .map(([id]) => id);
        expect({ enginesTheUniverseCannotSee: invisible })
            .toEqual({ enginesTheUniverseCannotSee: [] });
    });

    test('every engine falls into exactly one bucket, and none falls through', () => {
        const buckets = (id) => {
            const e = engines[id];
            const inAttempted = e.roots.some((r) => attempted.has(r))
                || (NAMED_DIFFERENTLY[id] && attempted.has(NAMED_DIFFERENTLY[id]));
            return [
                inAttempted ? 'attempted' : null,
                RUN_BY_THE_CASCADE.includes(id) ? 'cascade' : null,
                PRODUCED_BUT_NEVER_DECLARED.includes(id) ? 'undeclared' : null,
                NOT_RUN_HERE.includes(id) ? 'not-run' : null,
            ].filter(Boolean);
        };

        const homeless = Object.keys(engines).filter((id) => buckets(id).length === 0).sort();
        const doubled = Object.keys(engines).filter((id) => buckets(id).length > 1).sort();

        expect({ enginesInNoBucket: homeless }).toEqual({ enginesInNoBucket: [] });
        expect({ enginesInTwoBuckets: doubled }).toEqual({ enginesInTwoBuckets: [] });
    });

    test('every output the graph declares is pinned, by the engine that writes it', () => {
        // The census, tied to assertions rather than printed. An output added to
        // an engine that is already in a bucket used to change nothing here.
        // Read the graph again, in FULL PATHS this time: the bucket map above
        // keeps roots, and roots are exactly what hid the new output.
        const sb = { console: { log() {}, warn() {}, error() {} } };
        sb.window = sb; sb.global = sb; sb.globalThis = sb;
        vm.runInNewContext(fs.readFileSync(path.join(ROOT, 'assets/dependency-graph.js'), 'utf8'), sb,
            { filename: 'dependency-graph.js' });
        const graph = sb.GilbaDependencyGraph;

        const declared = {};
        graph.getAllEngines().slice().sort().forEach((id) => {
            declared[id] = (graph.getEngine(id).outputs || []).slice().sort();
        });

        expect(declared).toEqual(DECLARED_OUTPUTS);
    });

    test('the pinned census and the running total agree', () => {
        // Two ways of counting the same thing, so a pinned list that quietly
        // loses an entry cannot pass by agreeing with itself.
        const pinned = Object.values(DECLARED_OUTPUTS).reduce((n, o) => n + o.length, 0);
        const live = Object.values(engines).reduce((n, e) => n + e.roots.length + e.elsewhere.length, 0);

        process.stdout.write('[q64] outputs pinned: ' + pinned + '\n');
        expect(pinned).toBe(50);
        // `live` counts ROOTS, so nested paths collapse — it is the smaller
        // number and must never exceed the pinned one.
        expect(live).toBeLessThanOrEqual(pinned);
        expect(Object.keys(DECLARED_OUTPUTS).sort()).toEqual(Object.keys(engines).sort());
    });

    test('no bucket entry names an engine that no longer exists', () => {
        // A bucket that has stopped matching anything is a hole nobody can see.
        const stale = [...RUN_BY_THE_CASCADE, ...PRODUCED_BUT_NEVER_DECLARED, ...NOT_RUN_HERE,
            ...Object.keys(NAMED_DIFFERENTLY)].filter((id) => !(id in engines)).sort();
        expect({ bucketEntriesNamingNothing: stale }).toEqual({ bucketEntriesNamingNothing: [] });
    });

    test('THE HOLE, named: four results are produced without ever being declared', () => {
        const silent = [...produced].filter((k) => !attempted.has(k)).sort();

        expect(silent).toEqual(['irrigation', 'pgr', 'salinity', 'tissue']);
        process.stdout.write('[q64] produced but never declared: ' + JSON.stringify(silent) + '\n');
        // A fifth joining them, or one of them starting to declare itself, goes
        // red here and the list is brought up to date deliberately.
    });

    test('a step removed by notApplicable does not vanish — it says so in the journal', () => {
        // The other half of the first finding: `notApplicable` takes a module out
        // of `attempted`, so a step wrongly marked inapplicable would disappear
        // from the account. It cannot: the function writes a note at the same
        // time, and the note is what remains.
        const src = fs.readFileSync(path.join(ROOT, 'assets/hub-orchestrator.js'), 'utf8');
        const at = src.indexOf('function notApplicable(module, why)');
        expect(at).toBeGreaterThan(-1);
        const body = src.slice(at, src.indexOf('function producedSomething', at));

        expect(body).toMatch(/filter\(\(a\) => a\.module !== module\)/);
        expect(body).toMatch(/note\(module, why/);
    });
});

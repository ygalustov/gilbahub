'use strict';

/**
 * GH-781, delivery 1 — THE CENSUS BEFORE THE JOURNAL SURVIVES: WHICH ENGINE OF THE CASCADE PRODUCES
 * NOTHING, ON WHICH SHAPE OF SITE.
 *
 * WHY THIS COMES FIRST, and it is the analyst's condition rather than caution. Today the cascade writes its
 * account of what it could not produce and the next pass of the orchestrator wipes it: `runComputePass` sets
 * `warnings`, `skipped`, `notApplicable` and `attempted` to `[]` at its start (GH-557, "the journal is per
 * pass"). The moment those records survive, EVERYTHING the cascade already writes and loses appears in a
 * stored row — including `engine-produced-nothing` for engines that simply have no input to work from. That
 * would read to a client as "our fault, try again" on a site that has, say, no water test.
 *
 * So this file changes no product code. It runs the real cascade over shapes of site and PRINTS which engine
 * gave nothing on which shape, so that each line can be decided before the journal changes: either the node
 * declares `requires` (an inapplicability, which does not make a run partial) or it is a real defect and
 * becomes visible, as queue item 4 promised.
 *
 * AND THE SECOND HALF OF THE CENSUS, the analyst's addition: what `_hubState.inputs` actually holds at the
 * moment a pass runs. `schedule`, `site` and `pgr` are read by seven builders of the orchestrator and, by
 * her reading, nothing ever publishes them. This prints what is there, for each of the eight sections.
 */

const fs = require('fs');
const path = require('path');

const { load, withSamples, computeAll } = require('./lib/orchestrator-bench');

const ROOT = path.join(__dirname, '..');
const GRAPH = JSON.parse(fs.readFileSync(path.join(ROOT, 'assets', 'dependency-graph.json'), 'utf8'));

/** Every node the cascade runs, with the `computed` key it writes and the name it is recorded under. */
function cascadeNodes() {
    return Object.entries(GRAPH.nodes)
        .filter(([, n]) => {
            const runners = Array.isArray(n.runner) ? n.runner : [n.runner];

            return runners.indexOf('cascade') >= 0
                && (n.handle || '').toString().indexOf('assets/cascade-orchestrator.js:') === 0;
        })
        .map(([id, n]) => ({
            id,
            module: typeof n.module === 'string' ? n.module : null,
            requires: n.requires || [],
            key: ((n.outputs || []).find((o) => String(o).indexOf('computed.') === 0) || '')
                .replace('computed.', '').split('.')[0] || null,
        }));
}

/** The shapes of site this stand holds, named by what they lack rather than by a site's name. */
const SHAPES = [
    {
        name: 'greens, no samples at all',
        search: '?rerun=r1&site=s&soil=none&water=none&tissue=none',
        samples: {},
        state: { turf: { turfType: 'greens', species: 'bentgrass' }, soil: {}, water: {}, schedule: {} },
    },
    {
        name: 'greens, soil only',
        search: '?rerun=r1&site=s&soil=103&water=none&tissue=none',
        samples: { soil: { id: 'uid-a', serverId: 103, rawData: { pH_Water: '6.2', CEC_meq100g: '5.4', K: '40' } } },
        state: { turf: { turfType: 'greens', species: 'bentgrass' }, soil: {}, water: {}, schedule: {} },
    },
    {
        name: 'sports, soil and water and tissue',
        search: '?rerun=r1&site=s&soil=103&water=114&tissue=142',
        samples: {
            soil: { id: 'uid-a', serverId: 103, rawData: { pH_Water: '6.2', CEC_meq100g: '5.4', K: '40' } },
            water: { id: 'uid-w', serverId: 114, rawData: { EC: '0.5', Ca: '20', Mg: '8', Na: '15', pH: '7.2' } },
            tissue: { id: 'uid-t', serverId: 142, rawData: { N: 4.2, K: 2.5, P: 0.38 } },
        },
        state: {
            turf: { turfType: 'sports', species: 'ryegrass' }, soil: {}, water: {},
            schedule: { matchesPerWeek: 2, sessionsPerWeek: 3 },
        },
    },
    {
        name: 'sports, no water, with a schedule',
        search: '?rerun=r1&site=s&soil=103&water=none&tissue=none',
        samples: { soil: { id: 'uid-a', serverId: 103, rawData: { pH_Water: '6.2', CEC_meq100g: '5.4' } } },
        state: {
            turf: { turfType: 'sports', species: 'ryegrass' }, soil: {}, water: {},
            schedule: { matchesPerWeek: 2, sessionsPerWeek: 3 },
        },
    },
];

const CLIMATE = { current: { airTemp: 18, soilTemp: 16 }, gp: { c3: 0.7 }, monthlyTemps: null };

/** Did this engine produce anything? The cascade's own predicate, taken from its source. */
function producedSomething(value) {
    if (value === null || value === undefined) return false;
    if (typeof value === 'string') return value.trim() !== '';
    if (Array.isArray(value)) return value.length > 0;
    if (typeof value === 'object') {
        if (Object.keys(value).length === 0) return false;
        if (value.status === 'Not available' || value.status === 'Not computed') return false;
        if (value.success === false) return false;
    }

    return true;
}

describe('GH-781 delivery 1 — the census: what the cascade gives, and what the pass is handed', () => {
    jest.setTimeout(300000);

    test('POSITIVE CONTROL: the graph declares the cascade’s engines, and their names are read here', () => {
        const nodes = cascadeNodes();
        process.stdout.write('\n[gh781] cascade engines (' + nodes.length + '):\n'
            + nodes.map((n) => '[gh781]   ' + n.id + ' -> key ' + JSON.stringify(n.key)
                + ' | module ' + JSON.stringify(n.module)
                + ' | requires ' + JSON.stringify(n.requires)).join('\n') + '\n');

        expect(nodes.length).toBeGreaterThan(5);
        /**
         * EVERY ENGINE OF THE CASCADE DECLARES THE NAME IT IS RECORDED UNDER.
         *
         * Six did not (`soil-structure-engine`, `phytotoxicity-engine`, `firmness-engine`, `nopt-engine`,
         * `traffic-engine`, `turf-manager-engine`), and delivery 2 gave them one — because when the journal
         * of the cascade starts surviving the pass, a record under a name no section knows is printed to a
         * person as an identifier. An engine added later without a name reddens this the day it is written.
         */
        const noModule = nodes.filter((n) => !n.module).map((n) => n.id);
        process.stdout.write('[gh781] cascade engines with no declared `module` (' + noModule.length + '): '
            + JSON.stringify(noModule) + '\n');
        expect({ cascadeEnginesWithNoName: noModule }).toEqual({ cascadeEnginesWithNoName: [] });
    });

    test('THE CENSUS: which engine produces nothing, on which shape', () => {
        const nodes = cascadeNodes();
        const table = [];
        SHAPES.forEach((shape) => {
            const bench = load();
            bench.ctx.location.search = shape.search;
            withSamples(bench, shape.samples);
            bench.ctx.GAIP_STATE = Object.assign({ climate: CLIMATE }, shape.state);
            const out = bench.ctx.GilbaCascadeOrchestrator.runCascade(
                { inputs: shape.state, computed: {}, derived: {} }, {},
                { fullRecompute: true, includeEngines: nodes.map((n) => n.id) });
            const computed = (out && out.state && out.state.computed) || {};
            const ran = out.executionOrder || [];

            nodes.forEach((n) => {
                const gated = ran.indexOf(n.id) < 0 && n.requires.length > 0;
                const value = n.key ? computed[n.key] : undefined;
                const gave = producedSomething(value);
                table.push({
                    shape: shape.name,
                    engine: n.id,
                    verdict: gated ? 'gated (requires ' + n.requires.join(', ') + ')'
                        : (ran.indexOf(n.id) < 0 ? 'not called by this adapter'
                            : (gave ? 'produced' : 'PRODUCED NOTHING')),
                });
            });
        });

        const nothing = table.filter((r) => r.verdict === 'PRODUCED NOTHING');
        process.stdout.write('[gh781] the census, line by line:\n'
            + table.map((r) => '[gh781]   ' + r.shape + ' | ' + r.engine + ' | ' + r.verdict).join('\n')
            + '\n[gh781] engines producing nothing (' + nothing.length + '): '
            + JSON.stringify(nothing.map((r) => r.engine + ' on ' + r.shape)) + '\n');

        // This case DECIDES nothing: it prints, so that each line can be decided before the journal
        // starts carrying these records. What it holds is that the census reached the engines at all.
        expect(table.length).toBe(SHAPES.length * nodes.length);
        expect(table.some((r) => r.verdict === 'produced')).toBe(true);
    });

    test('DELIVERY 3: the reason the cascade recorded is still there after the passes that follow it', async () => {
        /**
         * THE SUBJECT OF THIS ITEM, in the order a real run has. The cascade gates tissue and MLSN on a site
         * with neither sample and records why; then passes of the orchestrator run — after the weather, after
         * a config apply — and each used to empty all four lists of the journal (GH-557). So 9 sites of the
         * stand with no tissue sample and 3 with no soil sample stored an empty section with no cause: 0 of 3
         * fresh rows carried one. Now a pass clears its own entries and leaves the cascade's.
         */
        const bench = load();
        const ctx = bench.ctx;
        ctx.location.search = '?rerun=r1&site=s&soil=none&water=none&tissue=none';
        withSamples(bench, {});
        const hubRoot = { querySelector: () => null, querySelectorAll: () => [] };

        ctx.gaip_runCascadePass('run-button', hubRoot, CLIMATE, null);
        const named = (list) => (list || []).map((e) => e.module + (e.producer ? '/' + e.producer : ''));
        const afterCascade = named(ctx.GaipOrchestrator.getState().computed.notApplicable);

        await computeAll(bench, { climateMetrics: CLIMATE, turf: SHAPES[0].state.turf, site: {} });
        await computeAll(bench, { climateMetrics: CLIMATE, turf: SHAPES[0].state.turf, site: {} });
        const afterPasses = named(ctx.GaipOrchestrator.getState().computed.notApplicable);

        process.stdout.write('[gh781] not applicable after the cascade: ' + JSON.stringify(afterCascade)
            + '\n[gh781] after two passes of the orchestrator: ' + JSON.stringify(afterPasses) + '\n');

        // The two the cascade gated are recorded, and they are still recorded when the passes are done.
        expect(afterCascade).toContain('tissue/cascade');
        expect(afterCascade).toContain('mlsn/cascade');
        expect(afterPasses).toContain('tissue/cascade');
        expect(afterPasses).toContain('mlsn/cascade');
        // And the orchestrator's own record of this site is there too, under its own name.
        expect(afterPasses.some((n) => n.indexOf('/orchestrator') > 0)).toBe(true);
        // A repeat of the cascade replaces its own records rather than stacking them.
        ctx.gaip_runCascadePass('samples-arrived', hubRoot, CLIMATE, null);
        const afterRepeat = named(ctx.GaipOrchestrator.getState().computed.notApplicable);
        process.stdout.write('[gh781] after a repeat of the cascade: ' + JSON.stringify(afterRepeat) + '\n');
        expect(afterRepeat.filter((n) => n === 'tissue/cascade')).toHaveLength(1);
    });

    test('AND WHAT THE PASS IS HANDED: the eight sections of `_hubState.inputs`, per pass', async () => {
        /**
         * The analyst's addition. Seven builders of the orchestrator read `schedule` and `site`, and by her
         * reading nothing publishes either — nor `pgr`, which is why the PGR note has never reached a row
         * (0 of 108 stored rows). This prints what is actually there when a pass runs, so the size of that
         * question is a number rather than a reading.
         */
        const bench = load();
        bench.ctx.location.search = SHAPES[0].search;
        withSamples(bench, {});
        const seen = [];
        for (let pass = 1; pass <= 2; pass += 1) {
            await computeAll(bench, { climateMetrics: CLIMATE, turf: SHAPES[0].state.turf, site: {} });
            const inputs = bench.ctx.GaipOrchestrator.getState().inputs || {};
            const shape = {};
            ['climate', 'turf', 'soil', 'water', 'tissue', 'schedule', 'site', 'pgr'].forEach((k) => {
                const v = inputs[k];
                shape[k] = (v === undefined) ? 'absent'
                    : (v === null) ? 'null'
                        : (typeof v === 'object' ? Object.keys(v).length + ' keys' : typeof v);
            });
            seen.push({ pass, shape });
        }
        process.stdout.write('[gh781] what `_hubState.inputs` holds when a pass runs:\n'
            + seen.map((s) => '[gh781]   pass ' + s.pass + ': ' + JSON.stringify(s.shape)).join('\n') + '\n');

        // Again: printed, not judged. The claim is only that the census looked at real passes — and it is
        // stated as the LIST of what was looked at, not as its size (the rule of `gh746`).
        expect(seen.map((s) => s.pass)).toEqual([1, 2]);
        expect(Object.keys(seen[0].shape))
            .toEqual(['climate', 'turf', 'soil', 'water', 'tissue', 'schedule', 'site', 'pgr']);
    });
});

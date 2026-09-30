/**
 * GH-777 (queue item 4, slice 2, the analyst's 4.11 decision 3) — WHAT DOES NOT APPLY TO THIS SITE IS
 * RECORDED BY THE PASS AND TRAVELS IN THE BODY.
 *
 * THE THIRD ANSWER EXISTED IN PROSE ONLY. `notApplicable()` has been in the orchestrator since GH-573
 * and it wrote one journal sentence: the module left the list of things the pass expected, and nothing
 * anywhere said WHY. Measured on the stand before this: `detail.notApplicable` is non-empty in 0 of 76
 * stored rows, so the server's judgement of it (GH-675 — was the input there when the run started, or
 * did the client never enter it) has never once run on a real body, and a module that does not apply to
 * a site looked exactly like a module that failed.
 *
 * WHAT IS ASSERTED, and it is the consequence rather than the wiring: after a pass, the run's own
 * account carries the module and the inputs whose absence made it inapplicable; the completion event
 * carries the same list, because the runner hears the event and not the state; and the body the runner
 * posts carries it beside the other two accounts, in the shape the server's rules declare.
 *
 * `missing: []` IS A CASE OF ITS OWN, not an omission: dew's engine runs on everything it needs and
 * answers "not here". No input is missing, so none is named, and a client is told nothing. An input
 * NAMED here is the client's own data or our delivery, and the server decides which.
 */

'use strict';

const fs = require('fs');
const path = require('path');
const { load: loadOrchestrator, computeAll } = require('./lib/orchestrator-bench');
const { load, SCHEMA, SITE, RUN } = require('./lib/runner-bench');

const ROOT = path.join(__dirname, '..');
const ORCHESTRATOR = fs.readFileSync(path.join(ROOT, 'assets/hub-orchestrator.js'), 'utf8');
const GRAPH = JSON.parse(fs.readFileSync(path.join(ROOT, 'assets/dependency-graph.json'), 'utf8'));

jest.setTimeout(120000);

/** A site whose dew engine answers "not a case for this site". */
function passWhereDewDoesNotApply() {
    const bench = loadOrchestrator();
    expect(bench.failed).toEqual([]);
    bench.ctx.gaip_dew_prediction = () => ({ applicable: false });

    return bench;
}

describe('GH-777 — the pass records what does not apply to the site', () => {
    let state;

    beforeAll(async () => {
        const bench = passWhereDewDoesNotApply();
        const out = await computeAll(bench, {
            turf: { species: 'Creeping Bentgrass (Greens)', methodology: 'slan', surface: 'greens' },
            site: { lat: -35.3317, lon: 149.11, latitude: -35.3317, longitude: 149.11 },
        });
        state = out.state;
    });

    test('POSITIVE CONTROL: the pass took modules on, so the account below is about a pass that ran', () => {
        const attempted = (state.computed.attempted || []).map((a) => a.module);
        process.stdout.write('[gh777] attempted: ' + JSON.stringify(attempted) + '\n');
        expect(attempted.length).toBeGreaterThan(3);
    });

    test('a module the engine answered `not here` about is recorded, with nothing blamed on an input', () => {
        const declared = state.computed.notApplicable || [];
        process.stdout.write('[gh777] the pass says these do not apply: ' + JSON.stringify(declared) + '\n');

        const dew = declared.filter((e) => e.module === 'dew')[0];
        expect(dew).toBeDefined();
        expect(dew.missing).toEqual([]);
        // and it is not ALSO reported as a gap: the two answers are exclusive
        expect((state.computed.skipped || []).map((s) => s.module)).not.toContain('dew');
        expect((state.computed.attempted || []).map((a) => a.module)).not.toContain('dew');
    });

    test('the account is per pass and does not accumulate', () => {
        const declared = state.computed.notApplicable || [];
        const modules = declared.map((e) => e.module);
        expect(modules.length).toBe(new Set(modules).size);
    });

    test('the completion event carries it, because the runner hears the event and not the state', async () => {
        const bench = passWhereDewDoesNotApply();
        const heard = [];
        bench.ctx.document.addEventListener('gaip:orchestrator-complete', (e) => heard.push(e.detail));
        await computeAll(bench, { turf: {}, site: {} });

        expect(heard.length).toBeGreaterThan(0);
        const last = heard[heard.length - 1];
        process.stdout.write('[gh777] the event carries: ' + JSON.stringify(last.notApplicable) + '\n');
        expect(Array.isArray(last.notApplicable)).toBe(true);
        expect(last.notApplicable.map((e) => e.module)).toContain('dew');
    });
});

describe('GH-777 — the body the runner posts carries the third account', () => {
    /**
     * The shape is taken FROM THE PRODUCER, which is the reviewer's condition on slice 1's own
     * judgement (the analyst's 76.2 C): a server test that builds the body by hand measures the test's
     * idea of the shape, not the shape. The runner is driven to its POST in the sandbox GH-547 built for
     * exactly this — the harness moved to `tests/lib/runner-bench.js` in this work so that the two
     * questions share one copy of it.
     */
    afterEach(() => {
        jest.clearAllTimers();
        jest.useRealTimers();
        delete global.fetch;
    });

    /** A finished run whose pass declared `notApplicable`, and the body it posted. */
    /**
     * GH-781 (delivery 6): the body is built from the journal AS THE PASS KEEPS IT, at the moment the row is
     * assembled, not from the arrays the completion event handed over. On a page those are the same arrays;
     * what changed is that a record written after the event now reaches the row instead of landing in an
     * array nobody reads. So the account is put where the pass keeps it, and the event keeps its own job.
     */
    function bodyAfterAPassThatDeclared(notApplicable) {
        const h = load({ search: '?rerun=' + RUN + '&site=' + SITE, framed: true });
        const account = { skipped: [], warnings: [],
            notApplicable: notApplicable === undefined ? [] : notApplicable };
        global.GaipOrchestrator = { getState: () => ({ computed: account }), passInProgress: () => false };
        global.window.GaipOrchestrator = global.GaipOrchestrator;
        h.doc._fire('gaip:weather-ready', {});
        h.doc._fire('gaip:orchestrator-complete', notApplicable === undefined
            ? {} : { skipped: [], warnings: [], notApplicable: notApplicable });
        h.doc._fire('gaip:analysis-complete', { state: {} });

        return h;
    }

    test('the envelope declares it, so the producer and the server read one declaration', () => {
        // Positive control for the two below: a field the producer sends and the form does not declare
        // is a second source, which is the thing the inputs list exists against.
        expect(SCHEMA.envelope.detail.notApplicable).toBeDefined();
        expect(SCHEMA.envelope.detail.notApplicable).toMatch(/\{module, missing\}/);
        expect(SCHEMA.envelope.detail.notApplicable).toMatch(/EMPTY when the engine itself ran/);
    });

    test('the runner sends the third account, in the shape the envelope declares', async () => {
        const declared = [{ module: 'salinity', missing: ['water.ecw'] }, { module: 'dew', missing: [] }];
        const h = bodyAfterAPassThatDeclared(declared);
        await h.settle();

        const posts = h.cachePosts();
        process.stdout.write('[gh777] the body the runner built: '
            + JSON.stringify(posts.length ? posts[0].body.detail.notApplicable : null) + '\n');

        // POSITIVE CONTROL: the run posted at all. Without it, "the body carries it" and "there was no
        // body" are the same green.
        expect(posts.length).toBe(1);
        expect(posts[0].body.detail.notApplicable).toEqual(declared);
        // beside the other two accounts, not instead of one
        // GH-781 (delivery 6): and `journal`, which says which pass each account belongs to.
        expect(Object.keys(posts[0].body.detail).sort())
            .toEqual(['assumptions', 'journal', 'notApplicable', 'nulls', 'skipped', 'warnings']);
    });

    test('a pass that declared nothing sends an empty list, not a missing key', async () => {
        const h = bodyAfterAPassThatDeclared([]);
        await h.settle();

        const posts = h.cachePosts();
        expect(posts.length).toBe(1);
        expect(posts[0].body.detail.notApplicable).toEqual([]);
    });

    test('and a pass from an older page, whose event carries no such key, sends an empty list', async () => {
        // The transitional state, named rather than left to chance: a frame still running the previous
        // orchestrator fires an event without the key, and the runner must send `[]` — not `undefined`,
        // which would reach the server as a missing field, and not a guess.
        const h = bodyAfterAPassThatDeclared(undefined);
        await h.settle();

        const posts = h.cachePosts();
        expect(posts.length).toBe(1);
        expect(posts[0].body.detail.notApplicable).toEqual([]);
    });
});

describe('GH-777 — the gate is the graph, and the pass no longer declares itself', () => {
    /**
     * THE ACCEPTANCE CONDITION OF THIS ITEM, held as a case rather than as a command to run by hand:
     * one declaration and one call, and the call inside the walk. Eleven steps used to open with their
     * own, each behind a condition of its own, so a module whose input was absent said nothing at all —
     * and a silence is what makes "no data" and "the data did not arrive" the same fact in a row.
     */
    test('there are two `attempting` in the file: the function, and one call inside the walk', () => {
        const calls = ORCHESTRATOR.split('\n')
            .map((line, i) => ({ line, n: i + 1 }))
            .filter(({ line }) => /attempting\(/.test(line));
        process.stdout.write('[gh777] `attempting(` in hub-orchestrator.js: '
            + JSON.stringify(calls.map((c) => c.n + ': ' + c.line.trim())) + '\n');

        expect(calls.map((c) => c.line.trim().slice(0, 40))).toEqual([
            'function attempting(module, resultKey) {',
            'attempting(module, resultKey);',
        ]);
        // and the one call is the walk's, not a step's: the nearest enclosing function is the gate
        const at = ORCHESTRATOR.indexOf(calls[1].line);
        const before = ORCHESTRATOR.slice(0, at);
        expect(before.lastIndexOf('function gateFromTheGraph()'))
            .toBeGreaterThan(before.lastIndexOf('async function runComputePass'));
    });

    test('every module the walk can register is a module some node declares', () => {
        // The name is the node's, declared (`module`), and not derived here — the derivation the server
        // used is wrong for one node and was wrong silently. This holds the universe: a node of this
        // pass with no `module` cannot be registered at all, and the walk says so.
        const passNodes = Object.entries(GRAPH.nodes).filter(([, n]) => {
            const runners = Array.isArray(n.runner) ? n.runner : (n.runner ? [n.runner] : []);

            return runners.includes('orchestrator')
                && (n.outputs || []).some((o) => String(o).startsWith('computed.'));
        });
        const withoutAName = passNodes.filter(([, n]) => typeof n.module !== 'string').map(([id]) => id);
        process.stdout.write('[gh777] nodes the walk registers (' + passNodes.length + '): '
            + JSON.stringify(passNodes.map(([id, n]) => id + ' -> ' + n.module)) + '\n');

        expect(passNodes.map(([id]) => id)).toEqual([
            'confidence', 'climate-engine', 'soil-temp-physics', 'dew-prediction-engine', 'shade-engine',
            'salinity-penalty-engine', 'stress-aggregator', 'disease-engine', 'wear-recovery-engine',
            'stress-trajectory-engine', 'disease-forecast', 'pre-emergent-engine',
        ]);
        expect(withoutAName).toEqual([]);
    });

    test('a site with no water reading: salinity is not applicable, with the input named', async () => {
        const bench = loadOrchestrator();
        expect(bench.failed).toEqual([]);
        const out = await computeAll(bench, { turf: { species: 'Creeping Bentgrass (Greens)' }, site: {} });

        const declared = out.state.computed.notApplicable || [];
        process.stdout.write('[gh777] no water: ' + JSON.stringify(declared) + '\n');

        const salinity = declared.filter((e) => e.module === 'salinity')[0];
        expect(salinity).toBeDefined();
        expect(salinity.missing).toEqual(['water.ecw']);
        // It is NOT also a gap, and it is not attempted: the two answers are exclusive.
        expect((out.state.computed.skipped || []).map((s) => s.module)).not.toContain('salinity');
        expect((out.state.computed.attempted || []).map((a) => a.module)).not.toContain('salinity');
    });

    test('a site WITH a water reading: salinity is taken on, and nothing is called missing', async () => {
        // The neighbour that must stay green, or the case above is about a walk that refuses everything.
        const bench = loadOrchestrator();
        const out = await computeAll(bench, {
            turf: { species: 'Creeping Bentgrass (Greens)' }, site: {},
            state: { water: { ecw: 1.2 } },
        });
        process.stdout.write('[gh777] with water: attempted '
            + JSON.stringify((out.state.computed.attempted || []).map((a) => a.module))
            + ' | notApplicable ' + JSON.stringify(out.state.computed.notApplicable || []) + '\n');

        expect((out.state.computed.attempted || []).map((a) => a.module)).toContain('salinity');
        expect((out.state.computed.notApplicable || []).map((e) => e.module)).not.toContain('salinity');
    });

    test('a node with no key of its own is not registered at all — the ambient DLI engine', async () => {
        // The finding that would have turned every site partial: the node is a member of the pass by
        // `runner`, and its number never becomes a key of the row — 0 of 94 stored rows. The walk
        // registers a node only when it declares a `computed.*` output, so this one is in neither list.
        const bench = loadOrchestrator();
        const out = await computeAll(bench, { turf: {}, site: {} });
        const names = (out.state.computed.attempted || []).map((a) => a.module)
            .concat((out.state.computed.skipped || []).map((s) => s.module))
            .concat((out.state.computed.notApplicable || []).map((e) => e.module));
        process.stdout.write('[gh777] every name this pass used: ' + JSON.stringify(names) + '\n');

        expect(names).not.toContain('ambient-dli');
        expect(names).not.toContain('ambient-dli-engine');
        expect(names).not.toContain('ambientDLI');

        // AND THE RULE THAT KEEPS IT OUT IS THE ONE UNDER TEST, not the node's missing name. Measured
        // with a mutation: dropping the `computed.*` requirement from the walk left the three
        // assertions above green, because the walk then refused the node for having no `module` and
        // said so in the journal. That sentence is the difference, so it is what is asserted.
        const complaints = (out.state.computed.warnings || [])
            .filter((w) => /declares no `module`/.test(String(w.message || '')));
        process.stdout.write('[gh777] nodes the walk could not name: '
            + JSON.stringify(complaints.map((w) => w.message)) + '\n');
        expect(complaints).toEqual([]);
    });

    /**
     * GH-777 (queue item 4, slice 2, the reviewer's return) — A MEASURED ZERO IS A VALUE, AND NOTHING
     * HELD THAT.
     *
     * The walk decides whether a declared input is THERE, and the rule of this repository is that only
     * an absence is an absence: `null`, nothing at all, an empty string, an empty list. A zero is a
     * measurement — fresh water reads 0 for salinity — and treating it as missing would tell the client
     * it had entered nothing about water it had entered. The reviewer broke the rule and ran the whole
     * universe: 3848 passed, 0 failed. Nothing was watching it.
     *
     * WHAT IS ASSERTED IS THE CONSEQUENCE, per input shape, through the one gate the graph declares
     * today (`salinity-penalty-engine` requires `water.ecw`): what the run SAYS about the site. A zero
     * gives the engine's own answer with no input blamed; an absence names the input. The shapes are
     * taken from the rule, and the boundary is printed: one declared gate is all there is to drive it
     * with, and a second declared `requires` would join this case without it being rewritten.
     */
    test('a zero is a reading: the site is not told it entered nothing', async () => {
        const shapes = [
            ['a measured zero', 0],
            ['an empty string', ''],
            ['nothing at all', null],
        ];
        const said = [];
        for (const [what, ecw] of shapes) {
            const bench = loadOrchestrator();
            expect(bench.failed).toEqual([]);
            // eslint-disable-next-line no-await-in-loop
            const out = await computeAll(bench, {
                turf: { species: 'Creeping Bentgrass (Greens)' }, site: {},
                state: { water: { ecw: ecw } },
            });
            const salinity = (out.state.computed.notApplicable || [])
                .filter((e) => e.module === 'salinity')[0] || null;
            said.push([what, salinity ? salinity.missing : '(not declared inapplicable)']);
        }
        process.stdout.write('[gh777] what the run says about the water, by the shape of the reading: '
            + JSON.stringify(said) + '\n'
            + '[gh777]   the gate driving this is the one the graph declares today: '
            + JSON.stringify(GRAPH.nodes['salinity-penalty-engine'].requires) + '\n');

        expect(said).toEqual([
            // The zero is a reading: the module does not apply because the water carries no salt, and
            // NO input is named — so the server never tells this client it entered nothing.
            ['a measured zero', []],
            // The two absences name the input, and the server judges that name against the start.
            ['an empty string', ['water.ecw']],
            ['nothing at all', ['water.ecw']],
        ]);
    });

    test('a module that recorded its own cause is not given a second one', async () => {
        /**
         * The analyst's finding B, and it is a case only now: the sweep at the end of the pass looked at
         * the RESULT alone, so a step that had already said why — the soil temperature says
         * `setting-missing` without a construction and `soil-moisture-unavailable` without a measured
         * moisture (GH-734) — would get `engine-produced-nothing` on top of it. One empty section with
         * two causes is one section whose cause nobody can read. It could not happen before this slice
         * because the pass did not register that module at all.
         */
        const bench = loadOrchestrator();
        bench.ctx.GAIP_HUB_CONFIG = Object.assign({}, bench.ctx.GAIP_HUB_CONFIG, {
            construction: { value: 'sand_profile', known: true, resolves: { thermalProfile: 'sand' } },
        });
        const out = await computeAll(bench, {
            // The hourly series the step reads (`climateMetrics.hourlyData`), with air temperatures and
            // NO soil moisture — which is the second of the two causes the step knows how to say.
            climateMetrics: {
                monthlyTemps: [12], monthlyTempsSource: 'nasa-power',
                hourlyData: { temperature_2m: [10, 11, 12, 13], shortwave_radiation: [0, 100, 200, 50] },
            },
            turf: {}, site: {},
        });
        const forThePhysics = (out.state.computed.skipped || [])
            .filter((s) => s.module === 'soil-temp-physics');
        process.stdout.write('[gh777] causes recorded for the soil temperature: '
            + JSON.stringify(forThePhysics) + '\n');

        /**
         * WHAT THIS CASE DOES AND DOES NOT REACH, measured rather than assumed, because it passed once
         * for the wrong reason and that is worth writing down.
         *
         * It holds that the module gets ONE cause. It does NOT yet exercise the skip that finding B
         * added: on this bench the physics step is never entered — the soil temperature block runs
         * inside `populateCanonicalState` behind conditions this stub state does not satisfy, so the
         * step says nothing of its own and the single cause here is the sweep's own
         * `engine-produced-nothing`. The reason is asserted, so the day the bench does reach the step
         * this case changes colour instead of passing quietly.
         *
         * What would exercise it: a pass in which the step records `setting-missing` or
         * `soil-moisture-unavailable` AND the walk has registered the module. On the stand that is the
         * ordinary state — the model's result is in the last row of all 13 sites — and on this bench it
         * is not reachable through the public doors the orchestrator exposes (`attempting` is internal).
         * Named to the coordinator rather than left as a green.
         */
        expect(forThePhysics.map((s) => s.reason)).toEqual(['engine-produced-nothing']);
    });
});

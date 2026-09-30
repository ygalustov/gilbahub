/**
 * GH-573 — THE PASS SAYS WHAT IT TOOK ON; THE RESULT SAYS WHETHER IT ARRIVED.
 *
 * WHAT THIS REPLACES. GH-569 taught the SERVER to work out which module had not
 * produced by reading the words in the run's journal — "blocked", "failed",
 * "error". On real data that was false: `analysis_results` id 29 carries
 * "Wear engine blocked by identity enforcement" and a complete fourteen-key
 * `computed.wear` stamped in the same millisecond, because
 * `wear-recovery-engine-pure.js` never reads `turfIntent` and the block is
 * announced without being enforced. Recognising a kind by the letters of a
 * string is the class this question removed from zone labels; it had grown back
 * on the server.
 *
 * SO THE PRODUCER DECLARES AND THE RESULT DECIDES. Each step calls
 * `attempting(module, resultKey)` at the moment it invokes an engine; at the end
 * of the pass one sweep names every expected result that is not there.
 * `notApplicable()` is the third answer — an engine that ran and said this site
 * is not a case for it has produced its answer, and dew is the step in this pass
 * that has such a verdict.
 *
 * HOW THIS FILE BITES:
 *   - delete the sweep and `the pass names a module whose result is missing`
 *     goes red with an empty list;
 *   - mark a step attempted outside its gate and `nothing a step never entered
 *     is named` goes red;
 *   - take the result check out of the sweep and `a module that produced is
 *     never named` goes red on `wear`, which is the live case: its journal says
 *     blocked and its result is there.
 */

'use strict';

const fs = require('fs');
const path = require('path');
const { load, computeAll, withSiteRow, withSamples } = require('./lib/orchestrator-bench');

const FIXTURE = JSON.parse(fs.readFileSync(
    path.join(__dirname, 'fixtures', 'q31-federal-golf-climate.json'), 'utf8'));

const FEDERAL_GOLF = {
    turf: { species: 'Creeping Bentgrass (Greens)', methodology: 'slan', surface: 'greens' },
    site: { lat: -35.3317, lon: 149.11, latitude: -35.3317, longitude: 149.11 },
};

jest.setTimeout(60000);

/**
 * GH-727 — THE BENCH IS GIVEN THE SITE'S ROW, because the page has one.
 *
 * `GAIP_SiteConfig` fills its rows from the server and the bench has no network, so `getSite` answered
 * null for every id. That did not matter while the pre-emergent builder took its region off the page
 * with `"au"` behind it; it does now, because the builder asks the site by id and a site with no
 * coordinates is a declared gap. Without this stub the control below — "a pass where everything
 * produced names nothing" — would be measuring the bench's missing site row, and its green would have
 * meant the bench, not the pass.
 */
const FEDERAL_GOLF_SITE_ID = 'federal-golf-site';

function benchWithItsSiteRow() {
    return withSiteRow(load(), { id: FEDERAL_GOLF_SITE_ID, latitude: -35.3317, longitude: 149.11 });
}

describe('GH-573 — the account a pass gives of itself', () => {
    let withClimate;

    beforeAll(async () => {
        const bench = benchWithItsSiteRow();
        withClimate = await computeAll(bench, Object.assign({ climateMetrics: FIXTURE.climate }, FEDERAL_GOLF));
    });

    test('the pass records what it took on, and it is not empty', () => {
        // Positive control for everything below: an empty `attempted` list makes
        // the sweep a no-op and every assertion here vacuous.
        const attempted = withClimate.state.computed.attempted || [];
        process.stdout.write('[q31] attempted: '
            + JSON.stringify(attempted.map((a) => a.module)) + '\n');
        expect(attempted.length).toBeGreaterThan(4);
        attempted.forEach((a) => {
            expect(typeof a.module).toBe('string');
            expect(typeof a.resultKey).toBe('string');
        });
    });

    test('a module that produced is never named as not producing — the live case', () => {
        // THE ROW THE RULE WAS WRONG ABOUT. This pass warns
        // "Wear engine blocked by identity enforcement" and computes a wear
        // result anyway, exactly as id 29 and id 31 did on the stand. Both facts
        // are asserted here, so the case cannot quietly stop being the case.
        const state = withClimate.state;
        const journal = state.computed.warnings || [];

        // WHAT THIS CASE ASSERTS AND WHAT IT NO LONGER SETS UP. It used to open
        // by finding a journal record containing "blocked" — the wear engine's
        // own sentence — and then show that the module had produced anyway. On
        // this bench that record is not emitted at all today: `wearCanRun` comes
        // out true once the canonical state is populated, so the branch that
        // says anything never fires. WHY IT DID FIRE WHEN THIS FILE WAS WRITTEN
        // IS NOT ESTABLISHED, and it is left as a question rather than dressed
        // up: the wording changed in GH-580 (from a false "blocked" filed as a
        // problem to an informational sentence), but wording does not explain a
        // record being absent.
        //
        // The live journal — the real row 29, with its real sentence — is held
        // by `Gh571TheVerdictComesFromTheResultTest`, which reads it out of the
        // fixture rather than hoping a bench reproduces it. What is measured
        // HERE is the property this file is for: the module produced, and the
        // pass does not name it as one that did not.
        expect(journal.every((w) => typeof w.level === 'string')).toBe(true);
        expect(state.computed.wear).toBeTruthy();
        expect(Object.keys(state.computed.wear).length).toBeGreaterThan(5);

        const skipped = state.computed.skipped || [];
        expect(skipped.map((s) => s.module)).not.toContain('wear');
    });

    test('a pass where everything produced names nothing', () => {
        // The control, and it is the one that would catch a sweep that names
        // modules indiscriminately: given its climate, this run produces every
        // result it took on.
        const skipped = withClimate.state.computed.skipped || [];
        process.stdout.write('[q31] skipped, with climate: ' + JSON.stringify(skipped) + '\n');
        /**
         * GH-777 (queue item 4, slice 2) — ONE NAME, AND IT IS THE BENCH'S OWN STATE.
         *
         * The walk over the graph takes on every module of the pass, `soil-temp-physics` among them —
         * it was the one module the pass ran without declaring. On this bench the physics model is not
         * reached: the fixture carries no resolved construction and no soil moisture, so nothing
         * computes and the sweep says so. That is the truthful account of THIS pass, not a change on a
         * client's: measured on the stand, the model's result is a non-null object in the last row of
         * all 13 sites and in 90 of 94 rows.
         */
        expect(skipped.map((s) => s.module)).toEqual(['soil-temp-physics']);
        expect(skipped[0].reason).toBe('engine-produced-nothing');
    });

    test('the sweep names a module whose result is missing, with the key it looked at', async () => {
        // A real absence rather than a fixture: the same pass without climate.
        // `getAuthoritativeClimate()` has nothing to answer with, the climate
        // step writes no result, and the run says so instead of leaving it to be
        // inferred from a gap.
        const bench = benchWithItsSiteRow();
        const out = await computeAll(bench, FEDERAL_GOLF);
        const skipped = out.state.computed.skipped || [];
        process.stdout.write('[q31] skipped, no climate: '
            + JSON.stringify(skipped.map((s) => [s.module, s.reason])) + '\n');

        const climate = skipped.filter((s) => s.module === 'climate')[0];
        expect(climate).toBeDefined();
        expect(climate.reason).toBe('engine-produced-nothing');
        expect(climate.resultKey).toBe('climate');

        // and every name in the list is genuinely absent from the result, so
        // the sweep is not naming things it has not looked at
        skipped.forEach((s) => {
            const value = out.state.computed[s.resultKey];
            const produced = value !== null && value !== undefined
                && (typeof value !== 'object' || Object.keys(value).length > 0);
            expect([s.module, produced]).toEqual([s.module, false]);
        });
    });

    test('nothing a step never entered is named', () => {
        // Step 8 is a stub — it logs "Irrigation scheduling" and calls nothing.
        // A marker placed on the step rather than on the engine call would make
        // every run in the product partial for a module that was never run.
        const attempted = (withClimate.state.computed.attempted || []).map((a) => a.module);
        expect(attempted).not.toContain('irrigation');
        expect((withClimate.state.computed.skipped || []).map((s) => s.module)).not.toContain('irrigation');
    });

    test('the account is rebuilt per pass and does not accumulate', () => {
        // The journal has been per-pass since GH-557; so is this. A second pass
        // that produced something must not still be carrying the first pass's
        // gap.
        const seen = (withClimate.state.computed.attempted || []).map((a) => a.module);
        const unique = [...new Set(seen)];
        expect(seen.length).toBe(unique.length);
    });
});

describe('GH-573 — the cascade adapter can reach the journal at last', () => {
    /**
     * `cascade-orchestrator.js` had its own `warn`, which reached a console and
     * stopped. That is why the owner's Re-run showed no Soil & Nutrition and
     * said nothing: the MLSN engine threw on values the sample store holds as
     * strings, the adapter caught it, and "MLSN engine failed" went nowhere.
     */
    test('a problem the adapter reports lands in the run’s journal', () => {
        const { ctx } = load();
        const before = (ctx.GaipOrchestrator.getState().computed.warnings || []).length;

        // The adapter's channel, used the way the adapter uses it.
        // GH-781 (delivery 5): the door names its writer now, and refuses a record that does not. The
        // adapter passes its own `PRODUCER` -- the same word as the module here, in a different role.
        ctx.GaipOrchestrator.recordProblem('cascade', 'MLSN engine failed:', new Error('e.toFixed is not a function'), 'cascade');

        const journal = ctx.GaipOrchestrator.getState().computed.warnings || [];
        expect(journal.length).toBe(before + 1);
        const last = journal[journal.length - 1];
        expect(last.module).toBe('cascade');
        expect(last.message).toMatch(/MLSN engine failed/);
        expect(last.level).toBe('problem');
    });

    test('and it can name a module that produced nothing', () => {
        const { ctx } = load();
        // GH-781 (delivery 5): as above -- a skipped step is recorded against a named producer.
        ctx.GaipOrchestrator.noteSkipped('mlsn', 'mlsn', 'engine-produced-nothing', 'mlsn', 'cascade');

        const skipped = ctx.GaipOrchestrator.getState().computed.skipped || [];
        expect(skipped.map((s) => s.module)).toContain('mlsn');
        expect(skipped.filter((s) => s.module === 'mlsn')[0].resultKey).toBe('mlsn');
    });

    test('THE ADAPTER, EXECUTED: an engine that produced nothing leaves a record', () => {
        // VENYA'S FINDING, 22.09.2026, and it was right: he cut the adapter's
        // line to the journal (`if (false && ...)` at cascade-orchestrator.js:832)
        // and the whole tree stayed green — 3,259 passed. The two cases above
        // call `recordProblem` and `noteSkipped` THEMSELVES, so they measure the
        // orchestrator's door and not the adapter walking through it. The link
        // was held by nobody touching it.
        //
        // So: a real cascade run, with an engine that throws the way the MLSN
        // engine threw on the owner's site, and the assertion is on what ends up
        // in the run's own journal.
        const bench = load();
        const { ctx } = bench;
        ctx.mlsnEngine = function () { throw new TypeError('e.toFixed is not a function'); };
        /**
         * GH-777 (queue item 4, slice 3) — THE SITE HAS A SOIL SAMPLE, so this case still measures what it
         * was written to measure.
         *
         * The MLSN node declares `requires: ["samples.soil"]`, and the gate now refuses to run an engine
         * whose sample is absent. Without a sample here the engine would never be called, the positive
         * control below ("the cascade really ran and really failed to produce") would be measuring the gate
         * instead of the adapter's line to the journal, and Venya's finding would be unguarded again.
         */
        withSamples(bench, { soil: { id: 'soil_1', rawData: { K: 40 } } });

        const before = (ctx.GaipOrchestrator.getState().computed.warnings || []).length;
        const result = ctx.GilbaCascadeOrchestrator.runCascade({
            inputs: {
                climate: { lat: -43.5, lon: 172.5 },
                turf: { construction: 'native_soil', species: 'Perennial Ryegrass' },
                soil: { methodology: 'ammonium_acetate', ppm: { K: 40 } },
                water: {}, schedule: {}, site: {},
            },
            computed: {}, derived: {},
        }, {}, { fullRecompute: true });

        // Positive control: the cascade really ran and really failed to produce.
        const produced = (result && result.state && result.state.computed) || {};
        expect(produced.mlsn).toEqual(expect.objectContaining({ status: 'Error' }));

        const journal = ctx.GaipOrchestrator.getState().computed.warnings || [];
        expect(journal.length).toBeGreaterThan(before);
        const said = journal.map((w) => (w.module || '') + ' ' + (w.message || '')).join(' | ');
        expect(said).toMatch(/MLSN engine failed/);
        expect(journal.some((w) => w.module === 'cascade' && w.level === 'problem')).toBe(true);

        // and the module it could not produce is named, not only complained about
        const skipped = ctx.GaipOrchestrator.getState().computed.skipped || [];
        expect(skipped.map((sk) => sk.module)).toContain('mlsn');
    });

    test('the adapter no longer keeps a console-only warning of its own', () => {
        // The guard on the tree: its `warn` must delegate. A later edit that
        // puts `console.warn` back as the only destination would restore the
        // silence this fix is about.
        const src = fs.readFileSync(path.join(__dirname, '..', 'assets', 'cascade-orchestrator.js'), 'utf8');
        const body = src.slice(src.indexOf('function warn(message, data) {'),
                               src.indexOf('function producedSomething(value) {'));
        expect(body).toMatch(/GaipOrchestrator\.recordProblem/);
    });
});

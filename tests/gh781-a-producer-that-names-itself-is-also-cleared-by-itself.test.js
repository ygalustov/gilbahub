'use strict';

/**
 * GH-781 (delivery 5, the reviewer's condition of 30.09.2026) — A NAME IS HALF THE DEVICE. THE OTHER HALF IS
 * THE MOMENT THE PRODUCER REMOVES ITS OWN RECORDS.
 *
 * WHAT WAS WRONG, and it is the one account this item had not reached: `recordProblem` had no producer
 * parameter at all, so a problem the cascade recorded was filed with no producer and the next
 * `runComputePass` removed it as one of its own. A cascade whose MLSN engine threw on the first pass
 * reported nothing at all after the second — the same silence GH-781 exists to close, on the `warnings`
 * account rather than on `notApplicable`.
 *
 * WHAT THIS FILE ASSERTS, in the form the reviewer asked for: every producer name that appears in a record
 * has a cleanup call of its own. So the two halves are one case: the record survives another producer's
 * passes, AND a repeat of the producer that wrote it replaces its own copy instead of stacking a second.
 * A name without its own moment is the same leak pointing the other way.
 *
 * DRIVEN THROUGH THE PRODUCT'S OWN PATH: the engine is made to throw, and the adapter's own handler decides
 * what to record and under whose name. Nothing here calls the journal directly — a test that wrote the
 * record itself would be agreeing with its own arrangement.
 */

const { load, computeAll, withSamples } = require('./lib/orchestrator-bench');

const CLIMATE = { current: { airTemp: 18, soilTemp: 16 }, gp: { c3: 0.7 }, monthlyTemps: null };
const TURF = { turfType: 'greens', species: 'bentgrass' };

/** Every journal entry, as "module/producer", so an unnamed one is visible as such. */
function named(list) {
    return (list || []).map((e) => String(e && e.module) + '/' + ((e && e.producer) || 'NO PRODUCER'));
}

describe('GH-781 delivery 5 — the cascade\'s own problems survive another pass and are cleared by its own', () => {
    jest.setTimeout(300000);

    test('a problem the cascade recorded is STILL THERE after two passes of the orchestrator', async () => {
        const bench = load();
        expect(bench.failed).toEqual([]);
        const ctx = bench.ctx;
        ctx.location.search = '?rerun=r1&site=s&soil=103&water=none&tissue=none';
        // The engine of the cascade fails. Its own handler is what records that, and under which name is
        // the subject here.
        ctx.mlsnEngine = () => { throw new Error('the soil engine threw, on purpose, from this test'); };

        ctx.GAIP_STATE = { climate: CLIMATE, turf: TURF, soil: { ppm: { K: 40 } }, water: {}, schedule: {} };
        ctx.GilbaCascadeOrchestrator.runCascade(
            { inputs: { turf: TURF, soil: { ppm: { K: 40 } }, water: {}, schedule: {} }, computed: {}, derived: {} },
            {}, { fullRecompute: true, includeEngines: ['mlsn-calculator'] });

        const afterCascade = named(ctx.GaipOrchestrator.getState().computed.warnings);
        process.stdout.write('\n[gh781] warnings after the cascade: ' + JSON.stringify(afterCascade) + '\n');
        const cascadeOwn = afterCascade.filter((n) => n.indexOf('/cascade') > 0);
        expect(cascadeOwn.length).toBeGreaterThan(0);
        // NOT an unnamed entry, which is what the orchestrator's pass takes for its own.
        expect(afterCascade.filter((n) => n.indexOf('/NO PRODUCER') > 0)).toEqual([]);

        await computeAll(bench, { climateMetrics: CLIMATE, turf: TURF, site: {} });
        await computeAll(bench, { climateMetrics: CLIMATE, turf: TURF, site: {} });
        const afterPasses = named(ctx.GaipOrchestrator.getState().computed.warnings);
        process.stdout.write('[gh781] after two passes of the orchestrator: '
            + JSON.stringify(afterPasses.filter((n) => n.indexOf('/cascade') > 0)) + '\n');

        // The PROBLEMS the cascade recorded, by name — not how many of them there were.
        expect(afterPasses.filter((n) => n.indexOf('/cascade') > 0)).toEqual(cascadeOwn);
    });

    test('and its OWN next pass replaces them, so a repeat does not stack a second copy', async () => {
        /**
         * The other half. The moment is the END of the pass (`commitPass`, delivery 7), and
         * up to three repeats run in one frame (GH-589) — without the moment this is where the same problem
         * would be listed three times.
         */
        const bench = load();
        expect(bench.failed).toEqual([]);
        const ctx = bench.ctx;
        ctx.location.search = '?rerun=r1&site=s&soil=103&water=none&tissue=none';
        ctx.mlsnEngine = () => { throw new Error('the soil engine threw, on purpose, from this test'); };
        const hubRoot = { querySelector: () => null, querySelectorAll: () => [] };

        ctx.gaip_runCascadePass('run-button', hubRoot, CLIMATE, null);
        const once = named(ctx.GaipOrchestrator.getState().computed.warnings).filter((n) => n.indexOf('/cascade') > 0);
        ctx.gaip_runCascadePass('samples-arrived', hubRoot, CLIMATE, null);
        ctx.gaip_runCascadePass('samples-arrived', hubRoot, CLIMATE, null);
        const thrice = named(ctx.GaipOrchestrator.getState().computed.warnings).filter((n) => n.indexOf('/cascade') > 0);

        process.stdout.write('[gh781] after one cascade pass : ' + JSON.stringify(once)
            + '\n[gh781] after three of them  : ' + JSON.stringify(thrice) + '\n');

        expect(once.length).toBeGreaterThan(0);
        // The same list, not a longer one: the producer removed its own before writing again.
        expect(thrice).toEqual(once);
    });

    test('WHAT IS FILED INSTEAD when a writer has no name: the record itself, printed', () => {
        /**
         * GH-781 — THE REGRESSION THIS DELIVERY'S OWN THIRD SLICE INTRODUCED, measured rather than argued.
         *
         * Since that slice the exported `note` refuses an entry whose producer is not named, and
         * `hub-tissue-v3.js` calls it with three arguments on the one path that says WHICH of two things
         * happened to the soil sample (GH-612: it arrived and carried no reading the map recognises, or it
         * had not arrived when the run budget ran out). So that fact is no longer written, and what is
         * written in its place is a complaint about the writer. This case executes both and prints them, so
         * the sentence a reader would find is a measurement and not a paraphrase.
         *
         * ON THE STAND it is reachable and has not been reached: of 111 stored runs, 0 carry
         * `soil-sample-not-loaded`, 0 carry either GH-612 sentence and 0 carry the complaint — the path
         * needs a run that was told there IS a soil sample and did not get it inside 15 s, and the samples
         * arrive in about 2. So no client has lost this yet; the write is gone, not the run.
         */
        const bench = load();
        expect(bench.failed).toEqual([]);
        const ctx = bench.ctx;
        const journal = () => (ctx.GaipOrchestrator.getState().computed.warnings || []);
        const before = journal().length;

        // Exactly the call `hub-tissue-v3.js` makes on that path: three arguments, no producer.
        ctx.GaipOrchestrator.note('mlsn',
            'no soil sample was present when the run budget ran out', 'delivered=false readings=0');
        const filed = journal().slice(before);

        process.stdout.write('[gh781] what an unnamed note files, verbatim:\n'
            + filed.map((e) => '[gh781]   ' + JSON.stringify({
                module: e.module, level: e.level, producer: e.producer || null, message: e.message,
            })).join('\n') + '\n');

        // The fact offered is not in the journal under the module it is about.
        expect(filed.filter((e) => e.module === 'mlsn')).toEqual([]);
        // And what IS there is the orchestrator talking about the writer.
        expect(filed.map((e) => e.module)).toEqual(['orchestrator']);
        expect(filed[0].message).toContain('was not written');
        expect(filed[0].message).toContain('mlsn');
    });

    test('WHAT HAPPENED TO THE SOIL SAMPLE is said by the pass, and the two states are two records', () => {
        /**
         * GH-781 (delivery 5, the analyst's choice (b)) — the three records that used to be written from the
         * run's WAIT (`_gaipSoilSampleReadyOrGivenUp`) are written by the pass. They were unnamed there, so
         * the orchestrator's next pass removed them; and once `note` began refusing an unnamed writer, the
         * fact of WHICH state it was stopped being written at all.
         *
         * The two states are still two records, and this is where that is measured now. `gh578` holds the
         * other half — that the gate waits and then steps aside without filing anything.
         */
        const namedButAbsent = (() => {
            const bench = load();
            expect(bench.failed).toEqual([]);
            const ctx = bench.ctx;
            ctx.location.search = '?rerun=r1&site=s&soil=103&water=none&tissue=none';
            withSamples(bench, {});
            ctx.gaip_runCascadePass('run-button',
                { querySelector: () => null, querySelectorAll: () => [] },
                { current: { airTemp: 18 } }, null);

            return ctx.GaipOrchestrator.getState().computed;
        })();

        const notes = (namedButAbsent.warnings || []).filter((e) => e && e.module === 'mlsn');
        const skips = (namedButAbsent.skipped || []).filter((e) => e && e.module === 'mlsn');
        process.stdout.write('[gh781] named 103, store empty -> notes '
            + JSON.stringify(notes.map((e) => e.producer + ': ' + e.message))
            + '\n[gh781]                            skipped '
            + JSON.stringify(skips.map((e) => e.producer + '/' + e.reason)) + '\n');

        // Under the cascade's name, which is the producer whose moment of cleanup exists.
        expect(notes.map((e) => e.producer)).toEqual(['cascade']);
        expect(notes[0].message).toContain('was not in the store');
        expect(skips.map((e) => e.producer + '/' + e.reason)).toEqual(['cascade/soil-sample-not-loaded']);

        // THE CONTROL: a run told there is no soil sample says nothing here — the gate of the pass records
        // the module as not applicable, and a delivery complaint about a sample nobody promised would be
        // the false partial this item exists to remove.
        const toldNone = (() => {
            const bench = load();
            const ctx = bench.ctx;
            ctx.location.search = '?rerun=r1&site=s&soil=none&water=none&tissue=none';
            withSamples(bench, {});
            ctx.gaip_runCascadePass('run-button',
                { querySelector: () => null, querySelectorAll: () => [] },
                { current: { airTemp: 18 } }, null);

            return ctx.GaipOrchestrator.getState().computed;
        })();
        const noneSkips = (toldNone.skipped || []).filter((e) => e && e.reason === 'soil-sample-not-loaded');
        process.stdout.write('[gh781] told `soil=none`        -> skipped ' + JSON.stringify(noneSkips) + '\n');
        expect(noneSkips).toEqual([]);
    });

    test('THE SECOND BRANCH: a sample that ARRIVED and carries no reading the map knows', () => {
        /**
         * GH-781 (delivery 5, the reviewer's M-H2 of 30.09.2026) - THE BRANCH NOTHING WAS WATCHING.
         *
         * His measurement, and it is why this case exists: he collapsed the two-way choice onto the
         * branch the existing case asserts and ran the whole suite - 3921 passed, 0 failed. So the
         * state "the sample arrived and nothing in it is a reading the map recognises" (GH-612's
         * second half) could be deleted outright and no case in the tree would notice. A branch with
         * no case is a branch that can be removed by accident, which is how the regression before it
         * was found by eye rather than by a test.
         *
         * THE FIXTURE IS THE PRODUCT'S OWN SHAPE: a soil sample the store HOLDS, named on the frame's
         * address, whose readings the product's own normaliser turns into nothing - `Note` is not a
         * reading. So `gaip_sampleInHand` answers with the sample and `gaip_sampleReadings` answers
         * with an empty map, which is exactly the state this branch is about.
         */
        const bench = load();
        expect(bench.failed).toEqual([]);
        const ctx = bench.ctx;
        ctx.location.search = '?rerun=r1&site=s&soil=103&water=none&tissue=none';
        withSamples(bench, { soil: { id: 'uid-a', serverId: 103, rawData: { Note: 'see attached' } } });
        ctx.gaip_runCascadePass('run-button',
            { querySelector: () => null, querySelectorAll: () => [] },
            { current: { airTemp: 18 } }, null);

        const computed = ctx.GaipOrchestrator.getState().computed;
        const notes = (computed.warnings || []).filter((e) => e && e.module === 'mlsn');
        process.stdout.write('[gh781] delivered, unreadable -> '
            + JSON.stringify(notes.map((e) => e.producer + ': ' + e.message)) + '\n'
            + '[gh781]   its data: ' + JSON.stringify(notes.map((e) => e.data)) + '\n');

        // Two entries about this module, both the cascade's: the pass's note and the gate's verdict.
        expect(notes.map((e) => e.producer)).toEqual(['cascade', 'cascade']);
        const note = notes.filter((e) => e.data)[0];
        // THE BRANCH ITSELF: the sentence is the one about a sample that came and said nothing,
        // not the one about a sample that never arrived.
        expect(note.message).toContain('was delivered and carried no reading');
        expect(note.message).not.toContain('was not in the store');
        // And the fact travels with it, so a reader can tell the two apart without the words.
        expect(String(note.data)).toContain('"delivered":true');
        /**
         * FOUND HERE AND NOT FIXED HERE, printed so it is not mistaken for agreement: the GATE's own
         * sentence beside this note says "this site has no samples.soil", and the site HAS the sample
         * - what it has is a sample with nothing readable in it. The gate asks one question (are
         * there readings) and answers with another (is there a sample), so the two sentences in one
         * journal disagree. Naming it is this case's business; deciding what the gate should say is
         * not, because it changes what a person reads.
         */
        const gate = notes.filter((e) => !e.data)[0];
        process.stdout.write('[gh781] and the gate says beside it: ' + JSON.stringify(gate.message)
            + '\n[gh781]   (the sample IS there; this is named, not fixed)\n');
        expect(gate.message).toContain('has no samples.soil');
    });

    test('THE PERIMETER: no journal writer is left without a producer', () => {
        /**
         * The six calls this delivery was about, listed by their own text so that a name coming back is
         * printed rather than counted. Three of them (the soil block) moved into the pass under the
         * cascade's name; two (the runner's water facts) stopped going through the shared journal at all and
         * travel in the row's body instead; one (`:1071`) went, because the pass records that skip now.
         *
         * This is a search of the source, and it says so: it sees the call as written, not a call assembled
         * at run time. The behaviour is measured by the cases above and in
         * `gh781-the-runners-own-facts-reach-the-row.test.js`.
         */
        const fs = require('fs');
        const path = require('path');
        const ROOT = path.join(__dirname, '..');
        const remaining = [
            // The old three-argument call, which is the unnamed form. The pass writes the same fact with
            // `"cascade"` as its fourth argument, and that call is not this text.
            ['assets/hub-tissue-v3.js', 'note("mlsn", delivered'],
            ['assets/hub-tissue-v3.js', 'noteSkipped("mlsn", "mlsn", "soil-sample-not-loaded", "mlsn")'],
            ['assets/hub-tissue-v3.js', 'recordProblem("mlsn"'],
            ['assets/hub-persistence.js', "noteSkipped('water', 'water', reason, 'water')"],
            ['assets/hub-persistence.js', "recordProblem('water'"],
            ['assets/hub-persistence.js', "noteSkipped('mlsn', 'mlsn', 'soil-sample-not-loaded', 'mlsn')"],
        ];
        const found = remaining.filter(([file, needle]) =>
            fs.readFileSync(path.join(ROOT, file), 'utf8').indexOf(needle) >= 0)
            .map(([file, needle]) => file + ' | ' + needle);

        process.stdout.write('[gh781] journal writers still without a producer (' + found.length + '):\n'
            + (found.length ? found.map((f) => '[gh781]   ' + f).join('\n') : '[gh781]   (none)') + '\n');

        // NONE of them is left: the soil block's three moved into the pass under the cascade's name, and the
        // runner's two stopped going through the journal at all. The list, not its length — a name that
        // comes back is printed here by its own text.
        expect(found).toEqual([]);
    });
});

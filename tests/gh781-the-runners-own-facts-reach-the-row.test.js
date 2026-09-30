'use strict';

/**
 * GH-781 (delivery 5, the analyst's amendment and the reviewer's condition, 30.09.2026) — WHAT THE RUNNER
 * ITSELF FOUND REACHES THE BODY OF THE ROW.
 *
 * WHAT WAS WRONG, measured: the runner captures the journal by reference on `gaip:orchestrator-complete`
 * (`_passSkipped = d.skipped`), and every cleanup replaces those arrays with a filtered copy. A record
 * written after the capture lands in the new array and the row never sees it. On the stand both rows that
 * mention an unusable water sample carry the problem in `warnings` and an EMPTY `skipped`. Delivery 4 makes
 * that interleaving ordinary rather than rare: the repeat of the cascade now also listens to
 * `gaip:spray-context-loaded`, which arrives after the capture and before the row is written.
 *
 * THE DEVICE, and this file is its measurement: the facts of one row-write travel in the row's body, not
 * through the shared journal. `cacheAnalysisResults` starts the list empty and returns it; `_writeResult`
 * copies it beside the pass's own account. No name, therefore no moment of cleanup to get wrong.
 *
 * WHAT IS ASSERTED HERE AND WHAT IS NOT, in the reviewer's division: this file asserts what the runner SENT
 * — `body.detail.skipped` — which needs no stand. Whether the SAVED row keeps it is a separate measurement
 * in a live window; if the body carries it and the row does not, the subject is a server-side filter and has
 * its own number rather than being a debt of this delivery.
 */

const path = require('path');
const fs = require('fs');
const vm = require('vm');
const { load, SITE, RUN } = require('./lib/runner-bench');
const { makeSandbox, hubScripts, load: loadHub, withSamples } = require('./lib/orchestrator-bench');

const ASSETS = path.join(__dirname, '..', 'assets');

describe('GH-781 delivery 5 — the runner\'s own facts travel in the row, not in the journal', () => {
    afterEach(() => { jest.useRealTimers(); });

    test('a frame named a water sample the store does not hold: the BODY carries the skip and the problem', async () => {
        const bench = load({ search: '?rerun=' + RUN + '&site=' + SITE + '&water=114' });
        await bench.complete();

        const posts = bench.cachePosts();
        // The writes themselves, named by their address rather than counted.
        expect(posts.map((p) => p.url)).toEqual(['/api/analysis-cache']);
        const detail = posts[0].body.detail;
        const water = (detail.skipped || []).filter((e) => e && e.module === 'water');
        const problems = (detail.warnings || []).filter((e) => e && e.module === 'water');

        process.stdout.write('\n[gh781] body.detail.skipped  : ' + JSON.stringify(detail.skipped)
            + '\n[gh781] body.detail.warnings : ' + JSON.stringify((detail.warnings || [])
                .map((e) => e && e.module + '/' + e.level)) + '\n');

        // The skip, which is what makes the server call the run partial with a named cause.
        expect(water.map((e) => e.reason)).toEqual(['water-samples-not-loaded']);
        expect(water[0].resultKey).toBe('water');
        // And the sentence a reader would find, beside it rather than instead of it.
        expect(problems).toHaveLength(1);
        expect(problems[0].message).toContain('114');
    });

    test('CONTROL: a frame that named no water sample sends no such record', async () => {
        const bench = load({ search: '?rerun=' + RUN + '&site=' + SITE });
        await bench.complete();

        const detail = bench.cachePosts()[0].body.detail;
        const water = (detail.skipped || []).filter((e) => e && e.module === 'water');
        process.stdout.write('[gh781] no `?water=` -> water records in the body: '
            + JSON.stringify(water) + '\n');

        expect(water).toEqual([]);
    });

    test('THE ROW SAYS WHICH SAMPLES THE PASS READ, and the sample\'s own numbers prove it is that one', () => {
        /**
         * GH-781 (delivery 7, the analyst's amendment (13)) - THE FINGERPRINT IN THE BODY, CHECKED AGAINST THE
         * SAMPLE ITSELF AND NOT AGAINST A SECOND SURFACE OF OURS.
         *
         * `detail.journal.cascadeSampleIds` is what two writers' conditions are judged by, so it has to be the
         * pass's own answer rather than a guess: the first condition written for them asked whether the soil
         * block came out, which can agree with itself. This case feeds the sample through the STORE'S OWN DOOR
         * and then requires the row's soil numbers to be that sample's readings, indicator by indicator - if a
         * different id were recorded, the numbers would not match.
         *
         * SECOND BRANCH: the run is named a sample the store does not hold, the body says `soil:not-found`, and
         * there are no soil numbers to find.
         *
         * The reviewer's mutation for it: write the fingerprint as of the moment of writing rather than the
         * accepted pass's.
         */
        const SOIL_103 = { pH_Water: '6.2', CEC_meq100g: '5.4', K: '40', Ca: '803', Mg: '129' };

        /**
         * GH-781 (second return, the reviewer's first finding) - THE BODY'S OWN FIELD, not the pass's return.
         *
         * The first form of this case read `pass.sampleIds` - the pass's output - so the one new place in the
         * BODY was not covered at all: he emptied `detail.journal.cascadeSampleIds` and the suite stayed green.
         * Worse than a gap: with that field empty both conditions of the reconciliation go to "open", which
         * reads as healthy silence. So the body is assembled here, through the producer's own function, and the
         * field is read from it.
         */
        const assemble = (store, search) => {
            const sandbox = makeSandbox();
            const failed = [];
            const ctx = vm.createContext(sandbox);
            hubScripts().forEach((name) => {
                const file = path.join(ASSETS, name);
                if (!fs.existsSync(file)) { failed.push(name + ': missing'); return; }
                let src = fs.readFileSync(file, 'utf8');
                if (name === 'hub-persistence.js') {
                    src = src.replace('global.GilbaPersistence = GilbaPersistence;',
                        'global.GilbaPersistence = GilbaPersistence;'
                        + '\n    global.__test_journalAtWrite = _journalAtWrite;');
                }
                try { vm.runInContext(src, ctx, { filename: name }); }
                catch (e) { failed.push(name + ': ' + String(e && e.message).slice(0, 120)); }
            });
            expect(failed).toEqual([]);
            expect(typeof ctx.__test_journalAtWrite).toBe('function');

            ctx.location = { search: search };
            ctx.GAIP_HUB_CONFIG = Object.assign({}, ctx.GAIP_HUB_CONFIG || {}, { activeSiteId: 'site-1' });
            const realReadings = ctx.GAIP_SampleManager && ctx.GAIP_SampleManager.readingsOf;
            ctx.GAIP_SampleManager = {
                readingsOf: realReadings || require('./lib/sample-readings').realReadingsOf(),
                getSamples: (kind) => (store[kind] ? [store[kind]] : []),
                getActiveSample: (kind) => store[kind] || null,
                getActiveSampleId: (kind) => (store[kind] ? store[kind].id : null),
                getAllSamples: () => ({ allSites: {}, allActive: {}, allMeta: {}, sites: {} }),
                getActiveSiteId: () => 'site-1',
            };
            const pass = ctx.gaip_runCascadePass('run-button',
                { querySelector: () => null, querySelectorAll: () => [] },
                { current: { airTemp: 18, soilTemp: 16 } }, null);
            // THE BODY'S OWN FIELD, through the function that fills it for the row.
            const marks = ctx.__test_journalAtWrite().marks;

            return { ctx: ctx, pass: pass, inTheBody: marks.cascadeSampleIds };
        };

        // THROUGH THE STORE'S DOOR: the sample the run was named is the one the store holds.
        const given = assemble({ soil: { id: 'uid-a', serverId: 103, rawData: SOIL_103 } },
            '?rerun=r1&site=site-1&soil=103&water=none&tissue=none');
        const idsGiven = given.inTheBody;
        const readBack = given.ctx.GAIP_SampleManager.readingsOf('soil',
            { id: 'uid-a', serverId: 103, rawData: SOIL_103 });

        // NOT GIVEN: named, and the store does not hold it.
        const withheld = assemble({}, '?rerun=r1&site=site-1&soil=103&water=none&tissue=none');
        const idsWithheld = withheld.inTheBody;

        process.stdout.write('\n[gh781] given    -> ' + idsGiven
            + '\n[gh781] withheld -> ' + idsWithheld
            + '\n[gh781] the sample\'s own readings, by the store\'s normaliser: '
            + JSON.stringify(readBack) + '\n');

        // THE FIELD OF THE BODY, not the pass's return: emptying it must redden this case.
        expect(typeof idsGiven).toBe('string');
        expect(idsGiven.length).toBeGreaterThan(0);
        // The row carries the pass's own answer, and it names THIS sample by its row id.
        expect(idsGiven).toContain('soil:103');
        expect(idsWithheld).toContain('soil:not-found');
        /**
         * AND IT IS THAT SAMPLE, proved against the sample rather than against another surface of ours: the
         * store's own normaliser returns these readings for it, indicator by indicator, so a fingerprint that
         * named a different id would be describing numbers that are not here.
         */
        /**
         * Indicator by indicator, against the FIXTURE's own figures. The store's normaliser renames the lab's
         * column into the engine's key (`pH_Water` -> `pH`), so the names are stated here once and the numbers
         * are the sample's. A first form of this compared each reading with itself through a fallback and would
         * have passed on any sample at all - which is the fault this file keeps finding elsewhere.
         */
        expect(readBack).toEqual({ pH: 6.2, CEC: 5.4, K: 40, Ca: 803, Mg: 129 });
        // The two answers are not the same string, which is what makes the condition able to tell them apart.
        expect(idsGiven).not.toBe(idsWithheld);
        /**
         * AND THE TWO HALVES ARE ONE CLAIM, which the reviewer said had come apart: the id the BODY names is
         * the id of the sample whose readings these are. Stated as one expression so that a body naming another
         * sample cannot pass beside numbers that belong to this one.
         */
        const namedInTheBody = /soil:(\d+)/.exec(idsGiven);
        expect(namedInTheBody).not.toBeNull();
        expect(Number(namedInTheBody[1])).toBe(103);
        expect(given.ctx.GAIP_SampleManager.readingsOf('soil',
            given.ctx.GAIP_SampleManager.getActiveSample('soil'))).toEqual(readBack);
    });

    test('the list lives ONE row-write: a second assembly carries only its own facts', () => {
        /**
         * The reviewer's accumulation case. A name with no moment of cleanup accumulates; this device has no
         * name, and what stands in for the moment is that the list is created by the function that assembles
         * a row. Measured by assembling twice with a write in between, which is the shape a second row-write
         * in one page life would have.
         */
        const sandbox = makeSandbox();
        const failed = [];
        const ctx = vm.createContext(sandbox);
        hubScripts().forEach((name) => {
            const file = path.join(ASSETS, name);
            if (!fs.existsSync(file)) { failed.push(name + ': missing'); return; }
            let src = fs.readFileSync(file, 'utf8');
            if (name === 'hub-persistence.js') {
                const exportLine = 'global.GilbaPersistence = GilbaPersistence;';
                expect(src).toContain(exportLine);
                src = src.replace(exportLine, exportLine
                    + '\n    global.__test_cacheAnalysisResults = cacheAnalysisResults;'
                    + '\n    global.__test_noteWaterSampleUnresolved = noteWaterSampleUnresolved;');
            }
            try { vm.runInContext(src, ctx, { filename: name }); }
            catch (e) { failed.push(name + ': ' + String(e && e.message).slice(0, 120)); }
        });
        expect(failed).toEqual([]);
        expect(typeof ctx.__test_cacheAnalysisResults).toBe('function');

        const first = ctx.__test_cacheAnalysisResults();
        ctx.__test_noteWaterSampleUnresolved('water-sample-not-found', '114');
        const firstFacts = JSON.parse(JSON.stringify(first.runnerFacts));
        const second = ctx.__test_cacheAnalysisResults();
        const secondFacts = JSON.parse(JSON.stringify(second.runnerFacts));

        process.stdout.write('[gh781] first assembly, after its write: '
            + JSON.stringify(firstFacts.skipped.map((e) => e.module + '/' + e.reason))
            + '\n[gh781] second assembly, before any write: '
            + JSON.stringify(secondFacts.skipped) + '\n');

        expect(firstFacts.skipped.map((e) => e.reason)).toEqual(['water-sample-not-found']);
        // Not the previous write's fact, and not a copy of it: a fresh list.
        expect(secondFacts).toEqual({ skipped: [], warnings: [] });
    });

    test('a cascade pass BETWEEN the capture and the write: WHICH note reaches the row, and which does not', () => {
        /**
         * GH-781 (delivery 5) — THE ANALYST'S CLAIM BY READING, MEASURED, AND IT IS TRUE IN ONE ORDER ONLY.
         *
         * She said a note written by a repeat after the capture would not reach the row. Measured here in
         * both orders, and the difference is which pass WROTE it:
         *
         *  - the journal answered BEFORE the first pass: that pass writes the note, the capture holds it, and
         *    a later repeat replacing the array changes nothing, because the fact is already in the captured
         *    copy. This is the stand's order — rows 111 and 112 of `Test5 - NZ` carry the note;
         *  - the journal answered only AFTER the capture: the first pass had nothing to write, so the note
         *    exists only in the array the repeat created, and a row built from the earlier reference has no
         *    trace of it.
         *
         * WHY THIS MATTERS FOR THE FIX WE KEPT: the second order is exactly the class the fingerprint and the
         * third event were built for. So a repeat ordered by a late journal answer does compute with it, and
         * its NOTE still cannot reach the row. Said here rather than left in a claim.
         */
        const WEATHER = { current: { airTemp: 18, soilTemp: 16 } };
        const ANSWER = {
            log_id: 3, site_id: 'site-1', application_date: '2026-06-16',
            product_name: 'Primo 250EC', product_key: 'TE250', rate: 0.4,
        };
        const hubRoot = { querySelector: () => null, querySelectorAll: () => [] };

        /** One frame, one order of arrival, and what the row would carry. */
        const run = (answerBeforeTheFirstPass) => {
            const bench = loadHub();
            expect(bench.failed).toEqual([]);
            const ctx = bench.ctx;
            ctx.location.search = '?rerun=r1&site=site-1&soil=none&water=none&tissue=none';
            ctx.GAIP_HUB_CONFIG = Object.assign({}, ctx.GAIP_HUB_CONFIG, { activeSiteId: 'site-1' });
            if (answerBeforeTheFirstPass) ctx.GAIP_LAST_PGR = ANSWER;

            ctx.gaip_runCascadePass('run-button', hubRoot, WEATHER, null);
            // The runner captures the account here, by reference, as `gaip:orchestrator-complete` hands it.
            const captured = ctx.GaipOrchestrator.getState().computed.warnings;
            if (!answerBeforeTheFirstPass) ctx.GAIP_LAST_PGR = ANSWER;
            ctx.gaip_runCascadePass('samples-arrived', hubRoot, WEATHER, null);

            const of = (list) => (list || []).filter((e) => e && e.module === 'pgr').map((e) => e.producer);

            return {
                // WHAT THE ROW CARRIES is the journal read at the moment the body is assembled (delivery 6),
                // not the array the runner captured on the completion event.
                inTheRow: of(ctx.GaipOrchestrator.getState().computed.warnings),
                // Kept beside it: what the old source would have had, so the difference is visible.
                inTheOldCapture: of(captured),
            };
        };

        const early = run(true);
        const late = run(false);
        process.stdout.write('[gh781] answered before the first pass -> row ' + JSON.stringify(early.inTheRow)
            + ', old capture ' + JSON.stringify(early.inTheOldCapture)
            + '\n[gh781] answered after the capture    -> row ' + JSON.stringify(late.inTheRow)
            + ', old capture ' + JSON.stringify(late.inTheOldCapture) + '\n');

        // BOTH ORDERS NOW REACH THE ROW, and that is what deliveries 6 and 7 are for together: the body reads
        // the accepted pass's account where the pass keeps it, so a note written by a repeat after the capture
        // is in the row instead of in an array nobody reads.
        expect(early.inTheRow).toEqual(['cascade']);
        expect(late.inTheRow).toEqual(['cascade']);
        // And exactly one copy of it: the accepted pass's, not one per pass -- as the LIST, so that a second
        // copy is printed by its own producer rather than turning a 1 into a 2 (the rule of `gh746`).
        expect(early.inTheRow).toEqual(['cascade']);
        /**
         * THE OLD SOURCE, printed rather than asserted away: with no clearing at the start of a pass, the
         * captured array accumulates a copy per pass in one order and holds the repeat's own in the other. It
         * is no longer what the row carries, and this line is why it must not become so again.
         */
        expect(early.inTheOldCapture).toEqual(['cascade', 'cascade']);
    });

    test('and nothing of this went into the shared journal, which is what the capture would have lost', () => {
        /**
         * The other half of the device, stated as its own case: the facts do NOT pass through
         * `_hubState.computed`, so no cleanup of any producer can take them and no capture can miss them.
         */
        const sandbox = makeSandbox();
        const ctx = vm.createContext(sandbox);
        const failed = [];
        hubScripts().forEach((name) => {
            const file = path.join(ASSETS, name);
            if (!fs.existsSync(file)) { failed.push(name + ': missing'); return; }
            let src = fs.readFileSync(file, 'utf8');
            if (name === 'hub-persistence.js') {
                src = src.replace('global.GilbaPersistence = GilbaPersistence;',
                    'global.GilbaPersistence = GilbaPersistence;'
                    + '\n    global.__test_cacheAnalysisResults = cacheAnalysisResults;'
                    + '\n    global.__test_noteWaterSampleUnresolved = noteWaterSampleUnresolved;');
            }
            try { vm.runInContext(src, ctx, { filename: name }); }
            catch (e) { failed.push(name + ': ' + String(e && e.message).slice(0, 120)); }
        });
        expect(failed).toEqual([]);

        ctx.__test_cacheAnalysisResults();
        ctx.__test_noteWaterSampleUnresolved('water-sample-not-found', '114');
        const journal = ctx.GaipOrchestrator.getState().computed;
        const inJournal = []
            .concat((journal.skipped || []).map((e) => 'skipped:' + e.module))
            .concat((journal.warnings || []).map((e) => 'warnings:' + e.module))
            .filter((n) => n.indexOf('water') > 0);

        process.stdout.write('[gh781] water records in the shared journal: ' + JSON.stringify(inJournal) + '\n');
        expect(inJournal).toEqual([]);
    });
});

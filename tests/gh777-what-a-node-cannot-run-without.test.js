'use strict';

/**
 * GH-777 (queue item 4, slice 3) — A NODE OF THE CASCADE DECLARES WHAT IT CANNOT RUN WITHOUT, AND THE
 * SAME GATE ANSWERS FOR BOTH PASSES.
 *
 * WHAT WAS WRONG, measured on the stand before this: the tissue section was empty in 13 of 13 stored
 * rows and not one of them said why. The tissue engine ran whatever happened, asked the sample, received
 * nothing and returned nothing, and the sweep recorded `engine-produced-nothing` -- our side, a re-run
 * offered, and a re-run changes nothing for a site that has no tissue test. The soil half had the other
 * shape of the same fault: one check written by hand in the row producer said `no-soil-sample`, so one
 * declaration existed for one module and nothing for the rest.
 *
 * THE DECLARATION IS THE GRAPH'S, and the requirement is of the "sample key" kind: `samples.tissue`, an
 * input of the calculation list. The gate asks it through `gaip_sampleReadings` -- THE SAME FUNCTION THE
 * ENGINE'S OWN BODY ASKS -- so the gate cannot disagree with the calculation, and it judges the sample
 * THIS RUN WAS GIVEN rather than what the database holds: a site whose only tissue sample was deleted is
 * correctly absent, and that is the case `Federal Golf` presented (its sample deleted 02.07, its run of
 * 29.09 given `tissue=none`).
 *
 * WHAT IS ASSERTED HERE IS THE CONSEQUENCE, on the real orchestrator and the real adapter loaded the way
 * `/hub` loads them: which modules the cascade ran, and what the pass recorded for the ones it did not.
 */

const fs = require('fs');
const path = require('path');
const { load, withSamples } = require('./lib/orchestrator-bench');
const { balancedEnd } = require('./lib/anchored-slice');

const ROOT = path.join(__dirname, '..');
const GRAPH = JSON.parse(fs.readFileSync(path.join(ROOT, 'assets', 'dependency-graph.json'), 'utf8'));

/** One cascade pass, with the frame's address and the site's samples as they would be. */
function cascadePass({ search, rows }) {
    const bench = load();
    bench.ctx.location.search = search;
    // The samples this run was given, through the bench's one helper: a named sample is found by id, which
    // is how the frame's address names one, and the normaliser is the sample manager's own.
    withSamples(bench, rows || {});
    const out = bench.ctx.GilbaCascadeOrchestrator.runCascade({ inputs: {}, turf: {}, soil: {} }, {});
    const state = bench.ctx.GaipOrchestrator.getState();
    const recorded = (state.computed && state.computed.notApplicable) || [];

    process.stdout.write('[gh777] address ' + JSON.stringify(search)
        + ' -> ran: ' + JSON.stringify(out.executionOrder || [])
        + '\n[gh777]   not applicable: ' + JSON.stringify(recorded) + '\n');

    return { out, recorded, ran: out.executionOrder || [], said: bench.said };
}

const entryFor = (recorded, module) => recorded.find((e) => e && e.module === module) || null;

describe('GH-777 slice 3 — the sample a run was given decides whether the module applies', () => {
    test('POSITIVE CONTROL: the graph declares the two requirements, of the sample-key kind', () => {
        // Without this the cases below could be green because nothing requires anything.
        const requiring = Object.entries(GRAPH.nodes)
            .filter(([, n]) => (n.requires || []).length)
            .map(([id, n]) => id + ' -> ' + JSON.stringify(n.requires));
        process.stdout.write('[gh777] nodes with a requirement: ' + JSON.stringify(requiring) + '\n');

        expect(GRAPH.nodes['tissue-engine'].requires).toEqual(['samples.tissue']);
        expect(GRAPH.nodes['mlsn-calculator'].requires).toEqual(['samples.soil']);
        // And each of them can be recorded against a name, which the walk refuses to do without.
        expect(GRAPH.nodes['tissue-engine'].module).toBe('tissue');
        expect(GRAPH.nodes['mlsn-calculator'].module).toBe('mlsn');
    });

    test('told there is NO tissue sample: the engine is not run and the module is named, with its input', () => {
        const { ran, recorded } = cascadePass({ search: '?tissue=none&soil=none' });

        expect(ran).not.toContain('tissue-engine');
        // GH-781: the entry says who wrote it -- and, since delivery 6, which DOOR it came through,
        // because a record's list and level cannot tell the outside door from the internal one.
        expect(entryFor(recorded, 'tissue'))
            .toEqual({ module: 'tissue', missing: ['samples.tissue'], producer: 'cascade', door: 'notApplicable', pass: null });
    });

    test('and the soil half is the same declaration, not a check written by hand', () => {
        const { ran, recorded } = cascadePass({ search: '?tissue=none&soil=none' });

        expect(ran).not.toContain('mlsn-calculator');
        expect(entryFor(recorded, 'mlsn'))
            .toEqual({ module: 'mlsn', missing: ['samples.soil'], producer: 'cascade', door: 'notApplicable', pass: null });
    });

    test('given a tissue sample that carries readings: the module applies and nothing is recorded', () => {
        const { recorded } = cascadePass({
            search: '?tissue=142',
            rows: { tissue: { id: 'sample_142', serverId: 142, rawData: { N: 3.6, K: 2.4, P: 0.45 } } },
        });

        expect(entryFor(recorded, 'tissue')).toBeNull();
    });

    test('given a tissue sample with nothing readable in it: not applicable, and honestly so', () => {
        // The analyst's third case. `gaip_sampleReadings` answers `null` for a sample whose readings the
        // manager does not recognise, and the gate says what the body would have found: nothing.
        const { ran, recorded } = cascadePass({
            search: '?tissue=143',
            rows: { tissue: { id: 'sample_143', serverId: 143, rawData: { somethingNobodyDeclared: 1 } } },
        });

        expect(ran).not.toContain('tissue-engine');
        // GH-781: the entry says who wrote it, so a pass of the orchestrator no longer clears the cascade's.
        expect(entryFor(recorded, 'tissue'))
            .toEqual({ module: 'tissue', missing: ['samples.tissue'], producer: 'cascade', door: 'notApplicable', pass: null });
    });

    test('a sample the site owns but the run was NOT given is absent, which is the stand\'s own case', () => {
        // `Federal Golf` holds a tissue sample in the database, deleted 02.07, and its run of 29.09 was
        // given `tissue=none`. What decides is the run's own address, not the row in the table.
        const { recorded } = cascadePass({
            search: '?tissue=none',
            rows: { tissue: { id: 'sample_142', serverId: 142, rawData: { N: 3.6, K: 2.4 } } },
        });

        // GH-781: the entry says who wrote it, so a pass of the orchestrator no longer clears the cascade's.
        expect(entryFor(recorded, 'tissue'))
            .toEqual({ module: 'tissue', missing: ['samples.tissue'], producer: 'cascade', door: 'notApplicable', pass: null });
    });

    test('A SAMPLE NAMED BUT NOT IN THE STORE YET IS DELIVERY, NOT ABSENCE — the live case of 29.09', () => {
        /**
         * WHAT THE STAND SHOWED, and no offline case had it: the cascade runs twice in a frame -- on the
         * button, and again when the samples arrive (GH-589) -- and on the first pass the store is empty
         * while the address already names a sample. The first form of this gate read that as "the client
         * has no soil test" and gated MLSN out of a run on a site with three of them; the consumer of the
         * MLSN table then threw, and both sites of the window were stored as `failed`.
         *
         * So: named and not in the store is left to the delivery wait, which has its own reason.
         */
        const { ran, recorded } = cascadePass({ search: '?soil=143&tissue=121', rows: {} });

        expect(ran).toContain('mlsn-calculator');
        expect(entryFor(recorded, 'mlsn')).toBeNull();
        expect(entryFor(recorded, 'tissue')).toBeNull();
    });

    test('and a run told nothing at all, with no active sample, is not blamed for it either', () => {
        // An opener that names no sample (they exist -- GH-724 says so) leaves the run knowing nothing
        // about this kind. Nothing known is not "the client entered nothing", so the gate opens and the
        // engine answers for itself.
        const { ran, recorded } = cascadePass({ search: '?rerun=r1&site=A', rows: {} });

        expect(ran).toContain('mlsn-calculator');
        expect(entryFor(recorded, 'mlsn')).toBeNull();
    });

    test('WITH NOTHING TO ASK, THE GATE OPENS AND SAYS SO — a missing reader is not a missing sample', () => {
        /**
         * The reviewer aimed a mutation at this branch and reported that it could not reach it. It is the
         * branch that decides who is blamed when this project's own script is not on the page: answering
         * "absent" would file `input-not-entered` against a person who entered everything. So the gate opens,
         * the engine answers for itself, and the pass carries a warning naming the input.
         */
        const bench = load();
        bench.ctx.location.search = '?soil=none&tissue=none';
        withSamples(bench, {});
        // The readers themselves are taken off the page, which is what a script that failed to load means.
        bench.ctx.gaip_namedSample = undefined;
        bench.ctx.gaip_sampleReadings = undefined;
        const out = bench.ctx.GilbaCascadeOrchestrator.runCascade(
            { inputs: {}, turf: {}, soil: {} }, {});
        const state = bench.ctx.GaipOrchestrator.getState();
        const recorded = (state.computed && state.computed.notApplicable) || [];
        const warned = (state.computed && state.computed.warnings || [])
            .filter((w) => /sample reader|samples\./.test(String(w.message || '')));
        process.stdout.write('[gh777] with no reader on the page — ran: '
            + JSON.stringify(out.executionOrder || []) + '\n[gh777]   not applicable: '
            + JSON.stringify(recorded) + '\n[gh777]   warned: '
            + JSON.stringify(warned.map((w) => w.module + ': ' + w.message)) + '\n');

        // Told `none` on the address, yet nothing is recorded against the client: the gate could not judge.
        expect(entryFor(recorded, 'tissue')).toBeNull();
        expect(entryFor(recorded, 'mlsn')).toBeNull();
        expect(out.executionOrder || []).toContain('mlsn-calculator');
        // And the run says why it could not judge, rather than judging silently.
        expect(warned.length).toBeGreaterThan(0);
    });

    test('and a reader that THROWS is the same answer: the gate opens, with the failure named', () => {
        const bench = load();
        bench.ctx.location.search = '?soil=141&tissue=144';
        withSamples(bench, {});
        bench.ctx.gaip_namedSample = () => null;
        bench.ctx.gaip_sampleReadings = () => { throw new Error('the store blew up'); };
        const out = bench.ctx.GilbaCascadeOrchestrator.runCascade(
            { inputs: {}, turf: {}, soil: {} }, {});
        const state = bench.ctx.GaipOrchestrator.getState();
        const recorded = (state.computed && state.computed.notApplicable) || [];
        const warned = (state.computed && state.computed.warnings || [])
            .filter((w) => /blew up|sample reader/.test(String(w.message || '')));
        process.stdout.write('[gh777] with a reader that throws — not applicable: '
            + JSON.stringify(recorded) + ' | warned: '
            + JSON.stringify(warned.map((w) => w.message)) + '\n');

        expect(entryFor(recorded, 'tissue')).toBeNull();
        expect(out.executionOrder || []).toContain('mlsn-calculator');
        expect(warned.length).toBeGreaterThan(0);
    });

    test('ONE GATE: the adapter has no requirement check of its own, and the producer has none either', () => {
        /**
         * The second declaration is what this item removes. The adapter asks the orchestrator's
         * `absentRequirementsOf`; if it grew its own reading of `requires`, or the row producer kept its
         * hand-written soil check, one fact would be stated in two places and they would drift.
         */
        const adapter = fs.readFileSync(path.join(ROOT, 'assets', 'cascade-orchestrator.js'), 'utf8');
        /**
         * THE UNIVERSE IS EVERY FILE THAT COULD WRITE THE FACT, and it was one file short. The reviewer
         * found the second writer outside it: the soil wait in `hub-tissue-v3.js` files
         * `soil-sample-not-loaded` when its budget runs out, and for a site with no sample at all that is
         * the very fact the graph declares -- reachable on 3 of the stand's 13 sites. A case that names its
         * universe as one file cannot redden on a copy in another, which is what this was.
         */
        /**
         * COMMENTS ARE NOT CODE, and the first form of this case proved why: it found the phrase
         * `soil-sample-not-loaded` inside a DOCBLOCK of this very slice, failed to cut a function around it
         * and reported a fault that does not exist. Blanked character for character so every index and
         * every brace balance still lines up with the real file.
         */
        const withoutComments = (text) => text
            .replace(/\/\*[\s\S]*?\*\//g, (m) => m.replace(/[^\n]/g, ' '))
            .split('\n')
            .map((l) => l.replace(/(^|[^:])(\/\/.*)$/, (m, head, tail) => head + tail.replace(/./g, ' ')))
            .join('\n');
        const writers = ['hub-persistence.js', 'hub-tissue-v3.js']
            .map((f) => ({ file: f, src: withoutComments(fs.readFileSync(path.join(ROOT, 'assets', f), 'utf8')) }));
        const producer = writers.map((w) => w.src).join('\n');
        const asksThePass = (adapter.match(/absentRequirementsOf/g) || []).length;
        const ownReading = (adapter.match(/node\.requires|\.requires\s*\|\|/g) || []).length;
        // `no-soil-sample` ALONE. `soil-sample-not-loaded`, which the producer still writes, is a fact
        // about THIS RUN -- the sample arrived and no cascade pass began after it -- and no declaration in
        // the graph can state it, so counting it here would demand the removal of something true.
        const byHand = (producer.match(/'no-soil-sample'/g) || []).length;
        process.stdout.write('[gh777] the adapter asks the pass ' + asksThePass + ' time(s), reads'
            + ' `requires` itself ' + ownReading + ' time(s); the row producer writes `no-soil-sample` by hand '
            + byHand + ' time(s), and still writes `soil-sample-not-loaded` '
            + (producer.match(/'soil-sample-not-loaded'/g) || []).length + ' time(s)\n');

        /**
         * AND THE BODY THAT WRITES A SOIL REASON DOES NOT JUDGE BY THE ACTIVE SAMPLE.
         *
         * The gate asks the sample THIS RUN WAS GIVEN; `getActiveSample("soil")` answers about whatever the
         * page happens to have selected, which is the read this slice took out of the gate and the class of
         * GH-459. THE SUBJECT IS THE WRITER, not the file: `gaip_soilFromActiveSample` reads the active
         * sample to ASSEMBLE the state, and that is a different fact, outside this slice and named in the
         * report rather than asserted here. So each body that writes the reason is cut out by brace balance
         * and read on its own.
         */
        const judgingBodies = [];
        writers.forEach((w) => {
            let from = 0;
            for (;;) {
                const at = w.src.indexOf("'soil-sample-not-loaded'", from) >= 0
                    ? w.src.indexOf("'soil-sample-not-loaded'", from)
                    : w.src.indexOf('"soil-sample-not-loaded"', from);
                if (at < 0) break;
                from = at + 1;
                /**
                 * THE ENCLOSING NAMED FUNCTION, not the nearest `function` token: the nearest one is the
                 * `setTimeout(function () {...})` of the retry, whose block ends before the write. So every
                 * named declaration is tried and the innermost one whose braces CONTAIN the write is the
                 * body. The first form took the callback, found nothing and printed an empty list -- a
                 * guard answering green because its slice missed.
                 */
                let body = null;
                let name = null;
                for (const m of w.src.slice(0, at).matchAll(/function\s*([\w$]*)\s*\(/g)) {
                    const cut = w.src.slice(m.index, balancedEnd(w.src, m.index));
                    if (m.index + cut.length <= at) continue;
                    // Innermost first-to-last: each later match that still contains the write is deeper.
                    body = cut;
                    name = m[1] || name || '(anonymous, line '
                        + (w.src.slice(0, m.index).split('\n').length) + ')';
                }
                if (body === null) {
                    judgingBodies.push(w.file + ': the enclosing function could not be cut out');
                    continue;
                }
                if (/getActiveSample\s*\(\s*["']soil["']\s*\)/.test(body)) {
                    judgingBodies.push(w.file + ':' + name);
                }
            }
        });
        process.stdout.write('[gh777] bodies writing a soil reason while judging by the ACTIVE sample: '
            + JSON.stringify(judgingBodies) + '\n');

        expect(asksThePass).toBeGreaterThan(0);
        expect(ownReading).toBe(0);
        expect(byHand).toBe(0);
        expect(judgingBodies).toEqual([]);
    });
});

/**
 * GH-588 (link 4) — THREE SOIL STATES, EXECUTED.
 *
 * WHAT WAS MEASURED, and it is why this is built the way it is. Probing inside
 * the runner's own frame: the soil grid and the sample store are both empty at
 * ~150 ms; both fill at ~2,170 ms; the analysis runs before that. The engine was
 * handed no soil and answered with ten rows of "NOT MEASURED" over a sample
 * holding K 40 and Ca 803 — WRONG numbers, not missing ones, which is the
 * owner's reason for waiting at all.
 *
 * Awaiting the sample inside the run button's own handler was tried and stops
 * the weather from ever being fetched (GH-587); the run then dies on its budget
 * having written nothing. So the question is asked BEFORE anything starts, by
 * the page that opens the runner, and the answer arrives as a parameter.
 *
 * WHAT IS ASSERTED HERE IS THE EFFECT. Both halves are EXECUTED — the opener's
 * question against a stubbed server, the runner against a stubbed store and a
 * clock this file controls — and the results are compared with the answers the
 * server gave, not with literals written into this file. The first version read
 * both sources with `readFileSync` and matched regular expressions: it would
 * have stayed green against code renamed into uselessness.
 */

'use strict';

const RealDate = Date;
const vm = require('vm');
const fs = require('fs');
const path = require('path');

const { pressRerun, queryOf } = require('./lib/rerun-opener');
const { giveItTheChooser } = require('./lib/sample-chooser');
const { realReadingsOf } = require('./lib/sample-readings');

const ASSETS = path.join(__dirname, '..', 'assets');

// ─────────────────────────────────────────────────────────────────────────────
// The opener's question, executed against a stubbed server
// ─────────────────────────────────────────────────────────────────────────────

/**
 * `askServerForSample` is module-private, so it is exposed beside the module's own export line.
 * The assertion on that line is the positive control.
 *
 * GH-724: it used to be `askServerForSoilSample`, a wrapper of one line. When the opener began
 * asking about tissue as well, the wrapper lost its last caller and stayed only because this file
 * named it — a function kept alive by its test. It is gone, and this asks the surviving function
 * for the soil sample by naming the kind.
 */
function loadOpener(serverAnswer) {
    const src = fs.readFileSync(path.join(ASSETS, 'dashboard-ui.js'), 'utf8');
    // The module is an IIFE with no export of its own; the function is put on
    // the sandbox at the point where its body ends. The assertion below that it
    // IS a function is the positive control for the splice.
    // Exposed at the TOP of the module, not the bottom: the module boots itself
    // on load and a stub page can make that throw, which would take the export
    // with it. Function declarations hoist, so this reaches the real one.
    const anchor = '    function initRerun() {';
    expect(src).toContain(anchor);
    const testSrc = src.replace(anchor,
        '    globalThis.__test_askServerForSoilSample = function (siteId) {\n'
        + '        return askServerForSample(\'soil\', siteId);\n'
        + '    };\n\n' + anchor);

    const requested = [];
    const sandbox = {
        console: { log() {}, warn() {}, error() {} },
        document: {
            readyState: 'complete', addEventListener() {}, removeEventListener() {},
            getElementById: () => null, querySelector: () => null, querySelectorAll: () => [],
            createElement: () => ({ style: {}, dataset: {}, setAttribute() {}, appendChild() {} }),
            head: { appendChild() {} }, body: { appendChild() {}, removeChild() {} },
        },
        setTimeout: () => 0, clearTimeout() {}, setInterval: () => 0, clearInterval() {},
        location: { search: '', reload() {} },
        URLSearchParams, Date, JSON, Math, Object, Array, String, Number, parseFloat, isNaN, Promise,
        encodeURIComponent,
        fetch: (url) => {
            requested.push(url);
            if (serverAnswer === 'throw') return Promise.reject(new Error('offline'));
            if (serverAnswer === 'http-500') return Promise.resolve({ ok: false, status: 500 });
            return Promise.resolve({ ok: true, status: 200, json: () => Promise.resolve(serverAnswer) });
        },
    };
    sandbox.window = sandbox; sandbox.global = sandbox; sandbox.globalThis = sandbox;
    const ctx = vm.createContext(sandbox);
    // GH-778: the write path asks one function which sample this run computes on, and that function lives
    // in `hub-tissue-v3.js`. A bench executing the producer alone has none, and every such place answers
    // `null`. The product's own chooser is lifted in, not stubbed.
    giveItTheChooser(ctx);
    vm.runInContext(testSrc, ctx, { filename: 'dashboard-ui.js' });
    expect(typeof ctx.__test_askServerForSoilSample).toBe('function');
    return { ask: ctx.__test_askServerForSoilSample, requested };
}

describe('GH-588 — the opener asks the server, and three answers stay three', () => {
    test('it asks the server, and the question names the site and the type', async () => {
        // Positive control plus the shape of the question, taken from what was
        // actually requested rather than from the source text.
        const { ask, requested } = loadOpener({ data: [{ id: 'sample_141' }] });
        await ask('019e-site');

        expect(requested).toHaveLength(1);
        expect(requested[0]).toContain('sample_type=soil');
        expect(requested[0]).toContain('site_id=019e-site');
    });

    test('a site WITH a sample answers with that sample’s id, from the server’s reply', async () => {
        const { ask } = loadOpener({ data: [{ id: 'sample_141' }, { id: 'sample_9' }] });
        await expect(ask('s')).resolves.toBe('sample_141');
    });

    test('a site with NO samples answers "none"', async () => {
        const { ask } = loadOpener({ data: [] });
        await expect(ask('s')).resolves.toBe('none');
    });

    test('a question that could not be put answers "unknown", NEVER "none"', async () => {
        // The substitution wearing a helpful face: a failed request answered as
        // "you have no sample" would tell the run to stop waiting, and a site
        // WITH a sample would be reported as one without.
        for (const failure of ['throw', 'http-500', { data: 'not-an-array' }, null]) {
            const { ask } = loadOpener(failure);
            const answer = await ask('s');
            expect([JSON.stringify(failure), answer]).toEqual([JSON.stringify(failure), 'unknown']);
        }
        // and with no site at all there is nothing to ask about
        const { ask, requested } = loadOpener({ data: [] });
        await expect(ask('')).resolves.toBe('unknown');
        expect(requested).toHaveLength(0);
    });
});

// ─────────────────────────────────────────────────────────────────────────────
// The runner, executed with the answer and a clock this file controls
// ─────────────────────────────────────────────────────────────────────────────

/**
 * The runner, driven to its decision. The run budget is the product's own —
 * this file does not invent a second one; it controls WHEN the deadline fires by
 * holding the timer the runner sets.
 */
function runRunner({ soilParam, sampleArrivesAt, search, sampleColumns = { K: 40, Ca: 803 } }) {
                // GH-778: the store keys a sample by the client's own key and holds its row id in
                // `serverId`; the address names the row, which is a sample's one name.
    const src = fs.readFileSync(path.join(ASSETS, 'hub-persistence.js'), 'utf8');
    const exportLine = 'global.GilbaPersistence = GilbaPersistence;';
    expect(src).toContain(exportLine);

    const listeners = {};
    const timers = [];
    const skipped = [];
    const posted = [];
    let now = 0;
    let sampleThere = sampleArrivesAt === 0;
    const said = [];

    const sandbox = {
        console: { log(...a) { said.push(a.join(' ')); }, warn(...a) { said.push(a.join(' ')); }, error(...a) { said.push(a.join(' ')); } },
        setTimeout: (fn, ms) => { timers.push({ fn, at: now + (ms || 0) }); return timers.length; },
        clearTimeout() {},
        // A repeating timer that fires once is not a repeating timer: the soil
        // poll must keep looking, or a sample that lands later is never seen.
        setInterval: (fn, ms) => { timers.push({ fn, at: now + (ms || 0), every: ms || 100 }); return 0; },
        clearInterval() {},
        // A real Date, with only `now` under this file's control: the runner
        // constructs dates for its timestamps, and a bare `{ now }` breaks it in
        // a way that has nothing to do with what is being measured.
        Date: Object.assign(function (...a) { return new RealDate(...a); }, {
            now: () => now,
            parse: RealDate.parse,
            UTC: RealDate.UTC,
            prototype: RealDate.prototype,
        }),
        document: {
            readyState: 'complete',
            addEventListener(t, f) { (listeners[t] = listeners[t] || []).push(f); },
            getElementById: () => null, querySelector: () => null, querySelectorAll: () => [],
            body: { appendChild() {}, removeChild() {} },
            dispatchEvent() {},
        },
        // `search` is for the join case below, which does not write an address:
        // it hands over the one the opener built.
        location: { search: search || ('?rerun=r1&site=site-1' + (soilParam === undefined ? '' : '&soil=' + soilParam)) },
        URLSearchParams, JSON, Math, Object, Array, String, Number, parseFloat, parseInt, isNaN, Promise,
        fetch: (url, opts) => {
            if (/analysis-cache\/runs$/.test(url)) posted.push(['failure', JSON.parse(opts.body)]);
            else if (/analysis-cache$/.test(url)) posted.push(['result', JSON.parse(opts.body)]);
            return Promise.resolve({ ok: true, status: 200, json: () => Promise.resolve({}) });
        },
    };
    sandbox.window = sandbox; sandbox.global = sandbox; sandbox.globalThis = sandbox;
    sandbox.GAIP_HUB_CONFIG = { activeSiteId: 'site-1' };
    // The DECLARED form of a result, from the file that owns it — the page is
    // handed this by the server, and a hand-written stand-in here would be a
    // second source of the very thing that exists to have one.
    sandbox.GAIP_ANALYSIS_SCHEMA = (function () {
        const schema = JSON.parse(fs.readFileSync(path.join(ASSETS, 'analysis-result.schema.json'), 'utf8'));
        return {
            version: schema.version,
            metrics: {
                required: schema.metrics.required,
                conditional: Object.keys(schema.metrics.conditional || {}).filter((k) => k !== '$comment'),
                branchDependent: Object.keys(schema.metrics.branchDependent || {}).filter((k) => k !== '$comment'),
            },
        };
    })();
    sandbox.GAIP_STATE = { inputs: { soil: {}, water: {} }, computed: {} };
    // GH-604: the PRODUCT's normaliser, and a lab row for a fixture. The
    // arrival check reads a sample through `readingsOf` now, so a hand-written
    // sample manager here would be a bench testing itself — which is how these
    // fixtures came to describe a sample shape the run never meets.
    sandbox.GAIP_SampleManager = {
        readingsOf: realReadingsOf(),
        // GH-778: a named sample is looked up in the store BY ITS ROW ID, so a bench whose store is empty
        // describes a page that holds nothing — which is not the state these three cases are about.
        getSamples: (t) => ((t === 'soil' && sampleThere)
            ? [{ id: 'sample_141', serverId: 141, rawData: sampleColumns }] : []),
        getAllSamples: () => ({ allSites: {}, allActive: {}, allMeta: {}, sites: {} }),
        getActiveSample: (t) => (t === 'soil' && sampleThere
            ? { id: 'sample_141', serverId: 141, rawData: sampleColumns } : null),
    };
    sandbox.GaipOrchestrator = { noteSkipped: (...a) => skipped.push(a), recordProblem() {}, getState: () => ({ computed: {} }) };

    const ctx = vm.createContext(sandbox);
    // GH-778: this bench executes the row producer too, so it needs the product's chooser of a sample.
    giveItTheChooser(ctx);
    vm.runInContext(src.replace(exportLine, exportLine + '\n    global.__test_state = function () { return { skipped: skipped }; };'),
        ctx, { filename: 'hub-persistence.js' });

    const fire = (name, detail) => (listeners[name] || []).forEach((f) => f({ detail: detail || {} }));
    const advance = (ms) => {
        const target = now + ms;
        for (let guard = 0; guard < 5000 && now < target; guard += 1) {
            const due = timers.filter((t) => t.at <= target).sort((a, b) => a.at - b.at)[0];
            if (!due) break;
            timers.splice(timers.indexOf(due), 1);
            now = Math.max(now, due.at);
            if (due.every) timers.push({ fn: due.fn, at: now + due.every, every: due.every });
            if (sampleArrivesAt !== null && now >= sampleArrivesAt) sampleThere = true;
            try { due.fn(); } catch (e) { /* the runner's own guards */ }
        }
        now = target;
        if (sampleArrivesAt !== null && now >= sampleArrivesAt) sampleThere = true;
    };

    return { fire, advance, posted, skipped, said, listeners, nowOf: () => now };
}

/** Everything a completed run needs except the soil. */
/** The write path posts inside a promise chain; nothing is visible until it runs. */
async function settle() {
    await new Promise((r) => setImmediate(r));
    await new Promise((r) => setImmediate(r));
}

function driveAnOrdinaryPass(h) {
    // All three events the runner counts as completion (GH-547): the weather,
    // a pass that began after it, and the analysis reporting itself done.
    h.advance(100);
    h.fire('gaip:weather-ready');
    h.advance(10);
    h.fire('gaip:orchestrator-complete', { passStartedAt: h.nowOf(), skipped: [], warnings: [] });
    h.advance(10);
    h.fire('gaip:analysis-complete', {});
}

describe('GH-588 — the runner receives a fact and the three states end differently', () => {
    test('STATE 2: told there is a sample, and it is there — the result is written', async () => {
        // The control the other two are read against. Without it "nothing was
        // written" below could mean the harness never got that far.
        const h = runRunner({ soilParam: '141', sampleArrivesAt: 0 });
        driveAnOrdinaryPass(h);
        await settle();

        expect(h.posted.map((p) => p[0])).toEqual(['result']);

        /**
         * GH-778 — AND THE BODY SAYS WHICH SAMPLE THE RUN USED, by its row id.
         *
         * The field used to carry the NAMED id where there was one, so it said what the opener asked for
         * rather than what the engines read; with nothing named it carried the client store's own key, so the
         * field held two kinds of name depending on the path. It carries the row id of the sample the chooser
         * handed to the calculation, and what the run was told stays separately in `detail.runStart.named`.
         */
        const body = h.posted[0][1];
        process.stdout.write('[gh588] the body says it computed on: '
            + JSON.stringify(body && body.inputs && body.inputs.samples) + '\n');
        expect(body.inputs.samples.soil).toBe('141');
    });

    test('STATE 1: told there is NO sample — the run still completes, and says why the soil is absent', async () => {
        const h = runRunner({ soilParam: 'none', sampleArrivesAt: null });
        driveAnOrdinaryPass(h);
        await settle();

        expect(h.posted.map((p) => p[0])).toEqual(['result']);
        /**
         * GH-777 (queue item 4, slice 3) — WHO SAYS IT HAS CHANGED, AND THE CONSEQUENCE HAS NOT.
         *
         * The row producer used to write `no-soil-sample` here by hand. The MLSN node declares
         * `requires: ["samples.soil"]` now, and the gate of the pass records the module as not applicable
         * with the input named -- one declaration for every module of the cascade instead of one check for
         * the soil half alone. This bench executes the PRODUCER only, with a stub orchestrator, so the
         * record cannot appear in it; what it can hold, and does, is that the producer no longer states the
         * fact itself. The recorded reason is measured on the real adapter in
         * `tests/gh777-what-a-node-cannot-run-without.test.js`.
         */
        expect(h.skipped.map((s) => s.slice(0, 3))).not.toContainEqual(['mlsn', 'mlsn', 'no-soil-sample']);
    });

    test('STATE 3: told there is one and it never arrives — the run FAILS on delivery, writing nothing', async () => {
        const h = runRunner({ soilParam: '141', sampleArrivesAt: null });
        driveAnOrdinaryPass(h);
        await settle();
        h.advance(20000);
        await settle();                       // past the runner's own budget

        const kinds = h.posted.map((p) => p[0]);
        expect(kinds).not.toContain('result');
        expect(kinds).toContain('failure');
        const failure = h.posted.filter((p) => p[0] === 'failure')[0][1];
        expect(failure.reason).toBe('soil-sample-not-delivered');
    });

    test('STATE 3 becomes STATE 2 when the sample lands inside the budget', async () => {
        // The distinguisher: two runs differing only in whether the sample
        // arrives, and they end differently.
        const h = runRunner({ soilParam: '141', sampleArrivesAt: 2200 });
        driveAnOrdinaryPass(h);
        await settle();
        h.advance(3000);
        h.fire('gaip:orchestrator-complete', { passStartedAt: h.nowOf(), skipped: [], warnings: [] });

        expect
        await settle();

        expect(h.posted.map((p) => p[0])).toContain('result');
        expect(h.posted.map((p) => p[0])).not.toContain('failure');
    });

    test('GH-612: a sample the map cannot read is told apart IN THE RECORD, and still reads the same on screen', async () => {
        // READ THE NAME OF THIS CASE BEFORE ITS COLOUR. It is green because the
        // two states are the SAME today, and that is what it records. It is not
        // evidence that they have been told apart.
        //
        // A lab row whose column headings the map does not recognise yields no
        // readings, so the arrival check says "not here" about a sample that IS
        // here; the run waits for it and fails with `soil-sample-not-delivered`
        // — untrue, because it was delivered and not understood. Delivered and
        // unreadable is a third state, and GH-588 exists because states must not
        // collapse into each other.
        //
        // GH-612 SETTLED THE HALF THAT NEEDED NO WORDS. This case used to pin
        // the collapse whole and said it must go red the day it was settled —
        // and it did, here: the record now carries `delivered`, and the two
        // states are two answers rather than one. What is NOT settled is the
        // sentence a person reads: that needs a third wording, the wording has
        // a single author who has not written it, and inventing one here is
        // what the owner's rule forbids. So this case now holds BOTH facts at
        // once — the record tells them apart, the screen does not yet — and it
        // must go red again the day the screen half lands.
        //
        // The declared reader finds nothing in those columns — proved against
        // the reader itself rather than asserted.
        expect(Object.keys(realReadingsOf()('soil', { values: { Potassium_as_K_Mehlich: '40' } }))).toEqual([]);

        const unreadable = runRunner({
            soilParam: '141',
            sampleArrivesAt: 0,
            sampleColumns: { Potassium_as_K_Mehlich: '40', Note: 'see attached' },
        });
        driveAnOrdinaryPass(unreadable);
        unreadable.advance(20000);

        const absent = runRunner({ soilParam: '141', sampleArrivesAt: null });
        driveAnOrdinaryPass(absent);
        absent.advance(20000);
        await settle();

        const postedFailure = (h) => (h.posted.filter((p) => p[0] === 'failure')[0] || [, {}])[1];
        const failureOf = (h) => (postedFailure(h) || {}).detail || {};
        const reasonOf = (h) => (postedFailure(h) || {}).reason;

        // The control: a sample that never came fails on delivery.
        expect(reasonOf(absent)).toBe('soil-sample-not-delivered');

        // GH-612 — AND HERE THE TWO HALVES PART COMPANY, WHICH IS WHY THIS CASE
        // IS REWRITTEN RATHER THAN DELETED.
        //
        // THE SENTENCE IS STILL THE SAME ONE, and that is the half still open:
        // the owner has not decided what a person should read, the wording has
        // one author and he has not written it, so the failure code is
        // unchanged and the panel says exactly what it said before.
        expect(reasonOf(unreadable)).toBe(reasonOf(absent));

        // THE RECORD, HOWEVER, NOW KNOWS. `delivered` answers the question the
        // reason cannot: one sample arrived and could not be read, the other
        // never arrived at all.
        expect(failureOf(unreadable).delivered).toBe(true);
        expect(failureOf(unreadable).readableColumns).toBe(0);
        expect(failureOf(absent).delivered).toBe(false);

        // And the two are distinguishable — stated on its own, because this is
        // the whole point and both sides above are falsy-adjacent values that a
        // careless rewrite could collapse again.
        expect(failureOf(unreadable).delivered).not.toBe(failureOf(absent).delivered);
    });

    test('a run NOBODY told about the sample is not gated at all', async () => {
        // The export and report pages open `/hub` without the parameter, as did
        // every opener before this ticket. Gating on a fact nobody supplied
        // means never completing — measured: the first draft did, and
        // twenty-four runner tests stopped writing a result.
        const h = runRunner({ soilParam: undefined, sampleArrivesAt: null });
        driveAnOrdinaryPass(h);
        await settle();

        expect(h.posted.map((p) => p[0])).toEqual(['result']);
    });

    test('"unknown" waits like an id, because it is not a "no"', async () => {
        const h = runRunner({ soilParam: 'unknown', sampleArrivesAt: null });
        driveAnOrdinaryPass(h);
        await settle();
        h.advance(20000);
        await settle();

        expect(h.posted.map((p) => p[0])).not.toContain('result');
        expect(h.posted.filter((p) => p[0] === 'failure')[0][1].reason).toBe('soil-sample-not-delivered');
    });
});

/**
 * THE JOIN. Every case above hands the runner an address this file wrote.
 *
 * Found by the reviewer, 23.09.2026. The path has three links — the server
 * answered, the address was assembled, the runner parsed a parameter — and the
 * middle one was executed by nothing. `&soil=` appears once in this file, inside
 * a sandbox, in a string the file builds itself. So an opener that stopped
 * appending it, or spelled it differently, or encoded the answer twice, left all
 * ten cases green while the runner in the product landed in `told: 'absent'` —
 * the branch that does not wait for the sample at all, which is the defect link
 * 4 exists to remove.
 *
 * THE CLAIM IS THE STRONG ONE. Not "the address contains `&soil=`": what the
 * server replied became the value of the parameter, and the runner is waiting
 * for THAT sample. The runner names the id it was told about when it gives up
 * on delivery, so the identity is read back out of the runner's own report
 * rather than out of the string.
 */
describe('GH-588 — the join: the server’s answer becomes the parameter the runner waits on', () => {
    test('the id the server replied with is the id the runner reports waiting for', async () => {
        const pressed = await pressRerun({
            siteId: 'site-1',
            serverAnswer: { data: [{ id: 'sample_141' }, { id: 'sample_9' }] },
            chosenWaterId: null,
        });
        // Positive control: no address, and everything below is vacuous.
        expect(typeof pressed.url).toBe('string');

        /**
         * GH-724 — THE ASSERTION IS ABOUT THE QUESTION THIS CASE GUARDS, NOT ABOUT HOW MANY
         * QUESTIONS THERE ARE.
         *
         * It read `toHaveLength(1)` and went red the day the opener began asking about tissue as
         * well (queue item 19): two requests where the case expected one. A count is a fact about
         * the batch, and this case is about the SOIL question -- that it was asked, of this site,
         * and that the answer became the parameter the runner waits on. Pinning the count would
         * break again on the third kind of sample and would say nothing more each time.
         *
         * So what is asserted is that the soil question is AMONG the requests and is named, and
         * the requests are printed, because "the soil question is there" and "the opener asked
         * nothing at all" would otherwise read the same.
         */
        process.stdout.write('[GH-588 join] the opener asked: ' + JSON.stringify(pressed.requested) + '\n');
        expect(pressed.requested.length).toBeGreaterThan(0);
        const soilQuestions = pressed.requested.filter((u) => u.indexOf('sample_type=soil') > -1);
        expect(soilQuestions).toEqual(['/api/samples?sample_type=soil&site_id=site-1&limit=1']);

        // The runner is given the address the OPENER built, and the sample never
        // arrives, so it must say which one it was waiting for.
        const h = runRunner({ search: '?' + queryOf(pressed.url).toString(), sampleArrivesAt: null });
        driveAnOrdinaryPass(h);
        await settle();
        h.advance(20000);
        await settle();

        const failures = h.posted.filter((p) => p[0] === 'failure').map((p) => p[1]);
        expect(failures).toHaveLength(1);
        expect(failures[0].reason).toBe('soil-sample-not-delivered');
        // THE JOIN ITSELF: the server said `sample_141`, and that is what the
        // runner names — through the address, which nothing here wrote.
        expect(failures[0].detail.toldBy).toBe('id');
        expect(failures[0].detail.soilSampleId).toBe('sample_141');
        // and it is the site the page was standing on, not one read off a pointer
        expect(failures[0].site_id).toBe('site-1');

        process.stdout.write('[GH-588 join] the opener built: ' + pressed.url + '\n');
    });

    test('a site with no samples travels as "none", and the runner does NOT wait', async () => {
        // The other end of the same wire. Two presses differing only in the
        // server's reply must end differently, or the reply is not travelling.
        const pressed = await pressRerun({
            siteId: 'site-1', serverAnswer: { data: [] }, chosenWaterId: null,
        });
        expect(typeof pressed.url).toBe('string');

        const h = runRunner({ search: '?' + queryOf(pressed.url).toString(), sampleArrivesAt: null });
        driveAnOrdinaryPass(h);
        await settle();

        expect(h.posted.map((p) => p[0])).toEqual(['result']);
        // The same change as in STATE 1 above: the producer states no soil reason of its own, and what does
        // state it is the node's declaration, held on the real adapter (GH-777).
        expect(h.skipped.map((s) => s.slice(0, 3))).not.toContainEqual(['mlsn', 'mlsn', 'no-soil-sample']);
    });
});

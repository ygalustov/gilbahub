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

const ASSETS = path.join(__dirname, '..', 'assets');

// ─────────────────────────────────────────────────────────────────────────────
// The opener's question, executed against a stubbed server
// ─────────────────────────────────────────────────────────────────────────────

/**
 * `askServerForSoilSample` is module-private, so it is exposed beside the
 * module's own export line. The assertion on that line is the positive control.
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
        '    globalThis.__test_askServerForSoilSample = askServerForSoilSample;\n\n' + anchor);

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
function runRunner({ soilParam, sampleArrivesAt, search }) {
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
    sandbox.GAIP_SampleManager = {
        getSamples: () => [],
        getAllSamples: () => ({ allSites: {}, allActive: {}, allMeta: {}, sites: {} }),
        getActiveSample: (t) => (t === 'soil' && sampleThere ? { id: 'sample_141', rawData: { K: 40, Ca: 803 } } : null),
    };
    sandbox.GaipOrchestrator = { noteSkipped: (...a) => skipped.push(a), recordProblem() {}, getState: () => ({ computed: {} }) };

    const ctx = vm.createContext(sandbox);
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
        const h = runRunner({ soilParam: 'sample_141', sampleArrivesAt: 0 });
        driveAnOrdinaryPass(h);
        await settle();

        expect(h.posted.map((p) => p[0])).toEqual(['result']);
    });

    test('STATE 1: told there is NO sample — the run still completes, and says why the soil is absent', async () => {
        const h = runRunner({ soilParam: 'none', sampleArrivesAt: null });
        driveAnOrdinaryPass(h);
        await settle();

        expect(h.posted.map((p) => p[0])).toEqual(['result']);
        expect(h.skipped.map((s) => s.slice(0, 3))).toContainEqual(['mlsn', 'mlsn', 'no-soil-sample']);
    });

    test('STATE 3: told there is one and it never arrives — the run FAILS on delivery, writing nothing', async () => {
        const h = runRunner({ soilParam: 'sample_141', sampleArrivesAt: null });
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
        const h = runRunner({ soilParam: 'sample_141', sampleArrivesAt: 2200 });
        driveAnOrdinaryPass(h);
        await settle();
        h.advance(3000);
        h.fire('gaip:orchestrator-complete', { passStartedAt: h.nowOf(), skipped: [], warnings: [] });

        expect
        await settle();

        expect(h.posted.map((p) => p[0])).toContain('result');
        expect(h.posted.map((p) => p[0])).not.toContain('failure');
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
        expect(pressed.requested).toHaveLength(1);

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
        expect(h.skipped.map((s) => s.slice(0, 3))).toContainEqual(['mlsn', 'mlsn', 'no-soil-sample']);
    });
});

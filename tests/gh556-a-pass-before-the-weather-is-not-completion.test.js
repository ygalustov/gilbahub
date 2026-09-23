/**
 * GH-556 (section 15) — THE ROOT, MEASURED BEFORE ANYTHING IS BUILT ON IT.
 *
 * The analyst's finding, in one sentence: the runner writes when
 * `_weatherReady && _orchestratorDone`, and `_orchestratorDone` is set by ANY
 * `gaip:orchestrator-complete` — including the pass that ran before the weather
 * arrived, in which the disease step is skipped, the forecast step is skipped
 * behind it, and the only record of either is a console line. The orchestrator
 * re-runs itself once the weather lands, but by then the runner has already
 * posted the first pass's body.
 *
 * That is a claim about ORDER, so it is measured by firing the events in that
 * order and reading what was posted — not by reading either file.
 *
 * WHAT IT ASSERTED FIRST, and why that is still written down here: the defect.
 * A pass that finished before the weather satisfied the runner; the runner never
 * looked at when a pass began; the completion event carried no account of what
 * had been skipped. Those three went RED on the first run after GH-557, which is
 * what they were written for, and this is what they became.
 */

'use strict';

const SCHEMA = JSON.parse(require('fs').readFileSync(
    require('path').join(__dirname, '..', 'assets', 'analysis-result.schema.json'), 'utf8'));

const RUN = 'run-order';
const SITE = 'site-order';

function makeDocument() {
    const listeners = {};
    return {
        readyState: 'complete',
        addEventListener(t, f) { (listeners[t] = listeners[t] || []).push(f); },
        removeEventListener() {},
        dispatchEvent(e) { (listeners[e.type] || []).forEach((f) => f(e)); },
        _fire(type, detail) { this.dispatchEvent({ type, detail }); },
        getElementById: () => null,
        querySelector: () => null,
        querySelectorAll: () => [],
        body: { appendChild() {}, removeChild() {} },
        head: { appendChild() {} },
        createElement: () => ({ style: {}, setAttribute() {} }),
    };
}

/** Load the runner as the page loads it, and record what it posts. */
function runner() {
    jest.useFakeTimers();
    jest.resetModules();

    const posts = [];
    const messages = [];
    const win = {};
    global.window = win;
    global.document = makeDocument();
    global.localStorage = { getItem: () => null, setItem() {}, removeItem() {} };
    global.sessionStorage = global.localStorage;
    global.CustomEvent = global.CustomEvent || class { constructor(t, i) { this.type = t; this.detail = i && i.detail; } };
    win.CustomEvent = global.CustomEvent;
    win.addEventListener = () => {};
    win.location = { search: '?rerun=' + RUN + '&site=' + SITE, href: 'http://localhost/hub', origin: 'http://localhost' };
    win.localStorage = global.localStorage;
    win.parent = { postMessage(m) { messages.push(m); } };
    global.GAIP_HUB_CONFIG = win.GAIP_HUB_CONFIG = { restUrl: '/api/', csrfToken: 't', activeSiteId: SITE, userId: 1 };
    global.GAIP_ANALYSIS_SCHEMA = win.GAIP_ANALYSIS_SCHEMA = {
        version: SCHEMA.version,
        metrics: {
            required: SCHEMA.metrics.required,
            conditional: Object.keys(SCHEMA.metrics.conditional).filter((k) => k !== '$comment'),
            branchDependent: Object.keys(SCHEMA.metrics.branchDependent).filter((k) => k !== '$comment'),
        },
    };
    global.fetch = (url, init) => {
        const m = ((init || {}).method || 'GET').toUpperCase();
        if (m !== 'GET') posts.push({ url: String(url), body: JSON.parse(init.body) });
        return Promise.resolve({ ok: true, status: 200, json: () => Promise.resolve({ ok: true }) });
    };
    win.fetch = global.fetch;
    global.URLSearchParams = global.URLSearchParams || require('url').URLSearchParams;

    require('../assets/hub-persistence.js');

    const settle = async () => { for (let i = 0; i < 20; i += 1) await Promise.resolve(); };
    return {
        doc: global.document, posts, messages, settle,
        results: () => posts.filter((p) => /\/analysis-cache$/.test(p.url)),
        failures: () => posts.filter((p) => /\/analysis-cache\/runs$/.test(p.url)),
    };
}

afterEach(() => {
    jest.clearAllTimers();
    jest.useRealTimers();
    ['fetch', 'window', 'document', 'localStorage', 'sessionStorage',
     'GAIP_HUB_CONFIG', 'GAIP_ANALYSIS_SCHEMA'].forEach((k) => { delete global[k]; });
});

describe('GH-556 — a pass that ran before the weather counts as completion', () => {
    test('control: the ordinary order writes exactly one result', async () => {
        // Without this, "it wrote" below would not distinguish the defect from
        // a harness that writes whatever happens.
        const h = runner();
        h.doc._fire('gaip:weather-ready', {});
        h.doc._fire('gaip:orchestrator-complete', {});
        h.doc._fire('gaip:analysis-complete', { state: {} });
        await h.settle();
        expect(h.results().length).toBe(1);
    });

    test('a pass that finished BEFORE the weather no longer satisfies the runner', async () => {
        const h = runner();

        // The order measured on the stand: the orchestrator's first pass
        // finishes while the weather fetch is still in flight.
        h.doc._fire('gaip:orchestrator-complete', {});
        await h.settle();
        expect(h.results().length).toBe(0);

        h.doc._fire('gaip:weather-ready', {});
        await h.settle();

        process.stdout.write('[q31/15] results after a pre-weather pass + weather-ready: '
            + h.results().length + '\n');

        // Nothing is written on the strength of that pass. The orchestrator
        // re-runs when the weather lands, and THAT pass is the one that counts.
        expect(h.results()).toEqual([]);

        h.doc._fire('gaip:orchestrator-complete', { passStartedAt: Date.now() + 1000 });
        h.doc._fire('gaip:analysis-complete', { state: {} });
        await h.settle();
        expect(h.results().length).toBe(1);
    });

    test('a pass that BEGAN before the weather does not count either, however it ends', async () => {
        // The case `passStartedAt` exists for: a slow first pass that happens to
        // finish after the weather is the same stale pass with better timing.
        const h = runner();

        h.doc._fire('gaip:weather-ready', {});
        await h.settle();
        h.doc._fire('gaip:orchestrator-complete', { passStartedAt: 1 });
        h.doc._fire('gaip:analysis-complete', { state: {} });
        await h.settle();

        expect(h.results()).toEqual([]);
    });

    test('a run whose weather arrived and whose pass never did says climate-late', async () => {
        const h = runner();
        h.doc._fire('gaip:weather-ready', {});
        await h.settle();
        jest.advanceTimersByTime(16000);
        await h.settle();

        expect(h.results()).toEqual([]);
        expect(h.failures().length).toBe(1);
        expect(h.failures()[0].body.reason).toBe('climate-late');
    });

    test('a build that does not say when its pass began is accepted, and the gap is recorded', async () => {
        // Refusing it would make the runner depend on a bundle version it cannot
        // check; accepting it silently would make "we could not check" look like
        // "we checked". It is accepted and the uncertainty travels with it.
        const h = runner();
        h.doc._fire('gaip:weather-ready', {});
        h.doc._fire('gaip:orchestrator-complete', {});
        h.doc._fire('gaip:analysis-complete', { state: {} });
        await h.settle();

        expect(h.results().length).toBe(1);
        const skipped = h.results()[0].body.detail.skipped;
        expect(skipped.map((s) => s.reason)).toContain('pass-start-unknown');
    });

    test('the completion event carries the account, and the body carries it on', async () => {
        const h = runner();
        h.doc._fire('gaip:weather-ready', {});
        h.doc._fire('gaip:orchestrator-complete', {
            passStartedAt: Date.now() + 1000,
            skipped: [{ step: 'disease', module: 'disease', reason: 'climate-late' }],
            warnings: [{ module: 'disease', message: 'Skipping disease computeAll pass', at: 1, data: null }],
        });
        h.doc._fire('gaip:analysis-complete', { state: {} });
        await h.settle();

        const detail = h.results()[0].body.detail;
        expect(detail.skipped).toEqual([{ step: 'disease', module: 'disease', reason: 'climate-late' }]);
        expect(detail.warnings[0].message).toMatch(/Skipping disease/);
        // and the body says which required values have no number
        expect(Array.isArray(detail.nulls)).toBe(true);
    });

    test('the orchestrator’s completion event is what carries it', () => {
        // The link the runner depends on, asserted at the source: without these
        // three fields on the event, everything above is measuring the harness.
        const src = require('fs').readFileSync(
            require('path').join(__dirname, '..', 'assets', 'hub-orchestrator.js'), 'utf8');
        const at = src.indexOf('"gaip:orchestrator-complete"');
        expect(at).toBeGreaterThan(-1);
        const dispatch = src.slice(at, at + 900);
        expect(dispatch).toMatch(/warnings: _hubState\.computed\.warnings/);
        expect(dispatch).toMatch(/skipped: _hubState\.computed\.skipped/);
        expect(dispatch).toMatch(/passStartedAt:/);
    });
});

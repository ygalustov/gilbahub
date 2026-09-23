/**
 * GH-547 (stage 2) — the runner writes once, on completion, and only when
 * it was opened as a runner.
 *
 * WHAT THIS REPLACES, in the three properties that made the row untrustworthy:
 *
 *   WHO. The page decided it was the analysis runner from
 *   `window.parent !== window` — true in any frame at all. That is a
 *   circumstance, not an intention, and `/reports/forensic` and
 *   `/reports/scenarios` wrote a result on every ordinary open because the one
 *   prohibition that existed, `GILBA_REPORTS_EXPORT`, was set in one view out of
 *   four.
 *
 *   WHEN. A timer. Three seconds after `gaip:orchestrator-complete` if the
 *   weather had arrived, or ten seconds after load whether it had or not, or
 *   again when late sensor data turned up. The ten-second path is the likeliest
 *   author of the row on the stand carrying twelve keys instead of thirteen: it
 *   fires before the weather, and `weatherSource` is written from the weather's
 *   own answer.
 *
 *   WHAT. `save()` posted the result on every state save — every `input` and
 *   `change` inside `#gaip-hub`, plus fourteen `gaip:*` events including a site
 *   switch — with a body of "everything the page holds at this instant".
 *
 * HOW IT IS MEASURED. The real `hub-persistence.js` is loaded into a fake DOM
 * with a recording `fetch`, once per situation, and the events are fired by
 * hand. Live tests are banned for this work; this is the plan's own sandbox.
 *
 * The URL is the situation: `/hub` plain, `/hub` in a frame, and
 * `/hub?rerun=…&site=…`. The third is the only one that may write.
 */

'use strict';

const SCHEMA = JSON.parse(require('fs').readFileSync(
    require('path').join(__dirname, '..', 'assets', 'analysis-result.schema.json'), 'utf8'));

const SITE = 'site-under-test-uuid';
const OTHER_SITE = 'some-other-site-uuid';
const RUN = 'run-1234-abcdef';

function makeDocument() {
    const listeners = {};
    return {
        readyState: 'complete',
        addEventListener(t, fn) { (listeners[t] = listeners[t] || []).push(fn); },
        removeEventListener(t, fn) { listeners[t] = (listeners[t] || []).filter((f) => f !== fn); },
        dispatchEvent(ev) { (listeners[ev.type] || []).slice().forEach((fn) => fn.call(this, ev)); return true; },
        querySelector() { return null; },
        querySelectorAll() { return []; },
        getElementById() { return null; },
        createElement() { return { style: {}, classList: { add() {}, remove() {} }, appendChild() {} }; },
        head: { appendChild() {} },
        body: { appendChild() {}, removeChild() {} },
        _fire(type, detail) { this.dispatchEvent({ type, detail }); },
    };
}

/**
 * @param {object} o
 *   o.search   the query string the page was opened with
 *   o.framed   whether window.parent !== window
 */
function load(o) {
    const opts = o || {};
    jest.useFakeTimers();
    jest.resetModules();

    const state = { posts: [], messages: [] };

    const win = {};
    global.window = win;
    global.document = makeDocument();
    global.localStorage = { getItem() { return null; }, setItem() {}, removeItem() {} };
    global.sessionStorage = global.localStorage;
    if (typeof global.CustomEvent !== 'function') {
        global.CustomEvent = class { constructor(t, i) { this.type = t; this.detail = i && i.detail; } };
    }
    win.CustomEvent = global.CustomEvent;
    win.addEventListener = () => {};
    win.location = { search: opts.search || '', href: 'http://localhost/hub' + (opts.search || ''), origin: 'http://localhost' };
    win.localStorage = global.localStorage;
    // The circumstance the old code mistook for an intention.
    win.parent = opts.framed ? { postMessage(m) { state.messages.push(m); } } : win;
    if (!opts.framed) win.postMessage = (m) => state.messages.push(m);

    //  reads GAIP_HUB_CONFIG bare in one place
    // (CONFIG.keys), so it has to be a real global, not only a window property.
    global.GAIP_HUB_CONFIG = win.GAIP_HUB_CONFIG = {
        restUrl: '/api/', csrfToken: 'tok',
        // Deliberately NOT the site in the parameters: the result must be filed
        // under the site the opener named, not under wherever the pointer is.
        activeSiteId: OTHER_SITE,
        userId: 1,
    };

    // GH-553: the page is handed the declared form of a result
    // (`layouts/app.blade.php`), and the runner builds its body from it. A
    // harness that does not supply it describes a page that does not exist — and
    // the runner correctly refuses to write without one, which has its own case
    // in gh552.
    global.GAIP_ANALYSIS_SCHEMA = win.GAIP_ANALYSIS_SCHEMA = {
        version: SCHEMA.version,
        metrics: {
            required: SCHEMA.metrics.required,
            conditional: Object.keys(SCHEMA.metrics.conditional).filter((k) => k !== '$comment'),
            branchDependent: Object.keys(SCHEMA.metrics.branchDependent).filter((k) => k !== '$comment'),
        },
    };

    global.fetch = function (url, init) {
        const m = ((init || {}).method || 'GET').toUpperCase();
        if (m !== 'GET') {
            state.posts.push({ url: String(url), body: init.body ? JSON.parse(init.body) : null });
        }
        const failing = opts.postStatus && opts.postStatus !== 200;
        return Promise.resolve({
            ok: !failing,
            status: opts.postStatus || 200,
            json: () => Promise.resolve({ ok: true }),
            text: () => Promise.resolve('{}'),
        });
    };
    win.fetch = global.fetch;
    global.URLSearchParams = global.URLSearchParams || require('url').URLSearchParams;

    require('../assets/hub-persistence.js');

    return {
        state,
        doc: global.document,
        // GH-548 (stage 3) added a SECOND route to the same storage --
        // `/api/analysis-cache/runs`, where a run says it did not finish. The
        // filter that stood here was `/analysis-cache/`, which matches both, so
        // a failure report would have counted as a result write and this file
        // would have gone quietly green on the wrong thing.
        cachePosts: () => state.posts.filter((p) => /\/analysis-cache$/.test(p.url)),
        runPosts:   () => state.posts.filter((p) => /\/analysis-cache\/runs$/.test(p.url)),
        settle: async () => {
            for (let i = 0; i < 10; i += 1) {
                await Promise.resolve();
                await Promise.resolve();
            }
        },
        /** Everything a completed run reports. */
        complete: async function () {
            this.doc._fire('gaip:weather-ready', {});
            this.doc._fire('gaip:orchestrator-complete', {});
            this.doc._fire('gaip:analysis-complete', { state: {} });
            await this.settle();
        },
    };
}

afterEach(() => {
    jest.clearAllTimers();
    jest.useRealTimers();
    delete global.fetch;
});

describe('GH-547 — who may write', () => {

    test('a plain page writes nothing, however much happens on it', async () => {
        const h = load({ search: '', framed: false });
        await h.complete();
        h.doc._fire('gaip:site-changed', {});
        h.doc._fire('gaip:sensor-upgrade-complete', {});
        jest.advanceTimersByTime(30000);
        await h.settle();
        expect(h.cachePosts()).toEqual([]);
    });

    test('a page in a frame WITHOUT the parameters writes nothing', async () => {
        // The old rule said this one was the runner. It is the rule that let
        // /reports/export post a result on a night when the weather hung.
        const h = load({ search: '', framed: true });
        await h.complete();
        jest.advanceTimersByTime(30000);
        await h.settle();
        expect(h.cachePosts()).toEqual([]);
        expect(h.state.messages).toEqual([]);
    });

    test('one parameter is not enough — both are the intention', async () => {
        for (const search of ['?rerun=' + RUN, '?site=' + SITE]) {
            const h = load({ search, framed: true });
            await h.complete();
            jest.advanceTimersByTime(30000);
            await h.settle();
            expect([search, h.cachePosts().length]).toEqual([search, 0]);
        }
    });
});

describe('GH-547 — when it writes, and what', () => {

    test('a completed run writes exactly once', async () => {
        const h = load({ search: '?rerun=' + RUN + '&site=' + SITE, framed: true });
        await h.complete();
        const posts = h.cachePosts();
        expect(posts.length).toBe(1);
        expect(posts[0].url).toContain('/api/analysis-cache');
    });

    test('and it files the result under the site the OPENER named', async () => {
        // GAIP_HUB_CONFIG.activeSiteId is a different site on purpose: the
        // pointer belongs to whatever the user is looking at now.
        const h = load({ search: '?rerun=' + RUN + '&site=' + SITE, framed: true });
        await h.complete();
        expect(h.cachePosts()[0].body.site_id).toBe(SITE);
        expect(h.cachePosts()[0].body.site_id).not.toBe(OTHER_SITE);
    });

    test('completion is the three events, not a clock', async () => {
        const h = load({ search: '?rerun=' + RUN + '&site=' + SITE, framed: true });

        // Weather only: nothing.
        h.doc._fire('gaip:weather-ready', {});
        await h.settle();
        expect(h.cachePosts()).toEqual([]);

        // Orchestrator too: this is where the old three-second timer started.
        h.doc._fire('gaip:orchestrator-complete', {});
        await h.settle();
        expect(h.cachePosts().length).toBe(1);
    });

    test('the ten-second path is gone: no weather, no write', async () => {
        // The likeliest author of the twelve-key row on the stand. It fired at
        // ten seconds whether the weather had arrived or not, and
        // `weatherSource` is written from the weather's own answer.
        const h = load({ search: '?rerun=' + RUN + '&site=' + SITE, framed: true });
        h.doc._fire('gaip:orchestrator-complete', {});
        jest.advanceTimersByTime(14000);
        await h.settle();
        expect(h.cachePosts()).toEqual([]);
    });

    test('saving state no longer posts a result', async () => {
        const h = load({ search: '?rerun=' + RUN + '&site=' + SITE, framed: true });
        const P = global.window.GilbaPersistence;
        expect(P).toBeTruthy();
        expect(typeof P.syncToServer).toBe('undefined');
        try { P.save(); } catch (e) { /* the fake DOM is thin; the point is the absence of a post */ }
        await h.settle();
        expect(h.cachePosts()).toEqual([]);
    });

    test('a late sensor reading does not produce a second result', async () => {
        const h = load({ search: '?rerun=' + RUN + '&site=' + SITE, framed: true });
        await h.complete();
        expect(h.cachePosts().length).toBe(1);
        h.doc._fire('gaip:sensor-upgrade-complete', {});
        jest.advanceTimersByTime(30000);
        await h.settle();
        expect(h.cachePosts().length).toBe(1);
    });
});

describe('GH-547 — a run that did not finish', () => {

    const failed = (h) => h.state.messages.filter((m) => m && m.type === 'gilba:analysis-failed');
    const done = (h) => h.state.messages.filter((m) => m && m.type === 'gilba:analysis-complete');

    /**
     * GH-557 split this case in two, because the two states it used to cover
     * turned out to be different findings.
     *
     * A run whose WEATHER arrived and which then saw no orchestrator pass is the
     * exact shape that produced Federal Golf's row, and it is now named
     * `climate-late` rather than folded into a generic timeout. A run that saw
     * nothing at all is still `run-not-completed`.
     */
    test('out of budget with the weather in and no pass after it: climate-late', async () => {
        const h = load({ search: '?rerun=' + RUN + '&site=' + SITE, framed: true });
        h.doc._fire('gaip:weather-ready', {});
        jest.advanceTimersByTime(16000);
        await h.settle();

        expect(h.cachePosts()).toEqual([]);
        expect(failed(h).length).toBe(1);
        expect(failed(h)[0].reason).toBe('climate-late');
        expect(failed(h)[0].runId).toBe(RUN);
        expect(failed(h)[0].siteId).toBe(SITE);
        // And it does NOT claim success, which is what the old code did at
        // twenty seconds whatever had happened.
        expect(done(h)).toEqual([]);
        expect(h.runPosts().length).toBe(1);
        expect(h.runPosts()[0].body.reason).toBe('climate-late');
    });

    test('out of budget with nothing at all: run-not-completed', async () => {
        const h = load({ search: '?rerun=' + RUN + '&site=' + SITE, framed: true });
        jest.advanceTimersByTime(16000);
        await h.settle();

        expect(h.cachePosts()).toEqual([]);
        expect(failed(h)[0].reason).toBe('run-not-completed');
        expect(h.runPosts()[0].body.reason).toBe('run-not-completed');
    });

    test('a calculation error is a failure with its message, not a completion', async () => {
        const h = load({ search: '?rerun=' + RUN + '&site=' + SITE, framed: true });
        h.doc._fire('gaip:weather-ready', {});
        h.doc._fire('gaip:analysis-complete', { error: true, message: 'cascade exploded' });
        await h.settle();

        expect(h.cachePosts()).toEqual([]);
        expect(failed(h).length).toBe(1);
        expect(failed(h)[0].reason).toBe('calculation-error');
        expect(failed(h)[0].detail.message).toBe('cascade exploded');

        // GH-548: and the reason is FILED, not only announced to the opener. A
        // console warning and a message to one tab are gone on the next reload
        // and were never on a second device.
        expect(h.runPosts().length).toBe(1);
        expect(h.runPosts()[0].body).toEqual({
            site_id: SITE,
            run_id:  RUN,
            outcome: 'failed',
            reason:  'calculation-error',
            detail:  { message: 'cascade exploded' },
        });
    });

    test('settings that did not load stop the run before it starts', async () => {
        const h = load({ search: '?rerun=' + RUN + '&site=' + SITE, framed: true });
        h.doc._fire('gaip:site-config-failed', { reason: 'sites-fetch' });
        await h.settle();
        expect(h.cachePosts()).toEqual([]);
        expect(failed(h)[0].reason).toBe('site-settings-unavailable');
        // GH-548: filed under the site the opener named, with the run's own id.
        expect(h.runPosts().length).toBe(1);
        expect(h.runPosts()[0].body.site_id).toBe(SITE);
        expect(h.runPosts()[0].body.run_id).toBe(RUN);
        expect(h.runPosts()[0].body.reason).toBe('site-settings-unavailable');
    });

    test('a server refusal is a failure, not a success', async () => {
        // The old code called the parent's reload on both answers, so a 403 —
        // which a viewer now gets — reloaded the page onto the previous result
        // while the button reported success.
        const h = load({ search: '?rerun=' + RUN + '&site=' + SITE, framed: true, postStatus: 403 });
        await h.complete();
        expect(h.cachePosts().length).toBe(1);
        expect(failed(h).length).toBe(1);
        expect(failed(h)[0].reason).toBe('rejected');
        expect(done(h)).toEqual([]);
        // GH-548: the refusal is filed too -- one result write that was
        // refused, one run report saying so.
        expect(h.runPosts().length).toBe(1);
        expect(h.runPosts()[0].body.reason).toBe('rejected');
    });

    test('a completed run reports completion, once, naming its run', async () => {
        const h = load({ search: '?rerun=' + RUN + '&site=' + SITE, framed: true });
        await h.complete();
        expect(done(h).length).toBe(1);
        expect(done(h)[0].runId).toBe(RUN);
        expect(failed(h)).toEqual([]);
        // GH-548: a run that finished files NO failure, and the result it wrote
        // is signed with the run's own id -- so the row can say which attempt
        // its numbers came from, and a `failed` mark left by an earlier attempt
        // is replaced rather than left standing beside new numbers.
        expect(h.runPosts()).toEqual([]);
        expect(h.cachePosts()[0].body.run_id).toBe(RUN);
    });

    /**
     * GH-549 (reviewer's finding on GH-548): the producer's end of the same
     * rule. The server refuses a body with no `run_id`
     * (`Gh546AnalysisResultsOwnerTest`); this is the half that says the runner
     * never sends one — otherwise a rule held only on the server turns every
     * real run into a 422 and nothing here notices.
     */
    test('every body the runner sends names its run', async () => {
        const ok = load({ search: '?rerun=' + RUN + '&site=' + SITE, framed: true });
        await ok.complete();

        const bad = load({ search: '?rerun=' + RUN + '&site=' + SITE, framed: true });
        bad.doc._fire('gaip:analysis-complete', { error: true, message: 'boom' });
        await bad.settle();

        const bodies = ok.state.posts.concat(bad.state.posts)
            .filter((p) => /analysis-cache/.test(p.url))
            .map((p) => p.body);
        expect(bodies.length).toBe(2);
        bodies.forEach((b) => {
            expect(b.run_id).toBe(RUN);
            expect(b.site_id).toBe(SITE);
        });
    });
});

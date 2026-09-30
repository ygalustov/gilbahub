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

// GH-777 (queue item 4, slice 2): the harness moved to `tests/lib/runner-bench.js` unchanged, because
// a second question needed the same body and a second copy of it would drift. Nothing about what this
// file measures changed with the move.
const { load, SCHEMA, SITE, OTHER_SITE, RUN } = require('./lib/runner-bench');

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

    test('and it files the result under the site the OPENER named, not under the pointer', async () => {
        // THE HALF THAT SURVIVES GH-663: the address is the parameter's. The
        // pointer does not appear here at all any more, and that IS the repair —
        // the frame is rendered for `?site=` on the server, so the browser is
        // never handed the pointer to prefer. Nothing in this harness can stand
        // for it, and inventing a field that nothing reads would describe a page
        // that does not exist.
        const h = load({ search: '?rerun=' + RUN + '&site=' + SITE, framed: true });
        await h.complete();
        expect(h.cachePosts()[0].body.site_id).toBe(SITE);
        expect(h.cachePosts()[0].body.site_id).not.toBe(OTHER_SITE);
        // and it declares what it computed, so the server can compare (29.3 layer 3)
        expect(h.cachePosts()[0].body.inputs.site).toBe(SITE);
    });

    test('GH-663 — and a document built for ANOTHER site files nothing, with a reason', async () => {
        // The case the repair adds, and the one the old default made impossible to
        // state: the numbers on this page belong to `OTHER_SITE` while the opener
        // asked for `SITE`. Filing them would be GH-459 with a second address.
        const h = load({ search: '?rerun=' + RUN + '&site=' + SITE, framed: true,
            documentSite: OTHER_SITE });
        await h.complete();
        expect(h.cachePosts()).toEqual([]);
        // and the opener is told why, rather than being left with a silent nothing
        const failures = h.state.posts.filter((p) => /analysis-cache\/runs/.test(p.url));
        expect(failures.length).toBe(1);
        expect(failures[0].body.reason).toBe('site-mismatch');
        expect(failures[0].body.detail.rendered).toBe(OTHER_SITE);
        expect(failures[0].body.detail.requested).toBe(SITE);
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

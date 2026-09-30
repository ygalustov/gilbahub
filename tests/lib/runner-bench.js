/**
 * THE RUNNER, DRIVEN TO ITS WRITE — the sandbox GH-547 built, in one place.
 *
 * WHY IT MOVED HERE. `hub-persistence.js` decides for itself whether it is the analysis runner and when
 * it may post: the address it was opened with, whether it sits in a frame, the weather, the samples and
 * a write latch all take part. A test that wants to see THE BODY has to satisfy all of it, and GH-547
 * had already done that work in its own file. GH-777 (queue item 4, slice 2) needed the same body for a
 * different question — does the run's third account travel — and a second copy of a hundred lines of
 * harness is the duplication this repository spends its days removing. One copy, two callers.
 *
 * WHAT IT IS NOT: not a page. A stub DOM with no elements answers differently from a real one, and every
 * claim made with this says which of the two it is.
 *
 * `load()` returns the recorder; `complete()` fires the three events a finished run fires, in order.
 * Fake timers are installed by `load()` — the caller restores them, as GH-547 does in its `afterEach`.
 */

'use strict';

const SCHEMA = JSON.parse(require('fs').readFileSync(
    require('path').join(__dirname, '..', '..', 'assets', 'analysis-result.schema.json'), 'utf8'));

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
        // GH-663 — THE DEFAULT IS A DOCUMENT THAT AGREES, AND THAT IS THE CHANGE
        // OF MEANING THIS FILE OWES.
        //
        // It used to be `OTHER_SITE` for every case, on the grounds that the
        // address must not come from the pointer. Half of that is still true and
        // still asserted below. The other half — that a frame may COMPUTE another
        // site and file the numbers anyway — was measured on the stand and is the
        // defect GH-663 removes: a held write carried one site's `site_id` with
        // another site's samples, soil temperature and disease (GH-661). The frame
        // is rendered for `?site=` now, so a document agreeing with the run is the
        // ordinary state, and the disagreement is set deliberately in the one case
        // that is about it.
        activeSiteId: opts.documentSite !== undefined
            ? opts.documentSite
            : (new URLSearchParams(opts.search || '')).get('site'),
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

    require('../../assets/hub-persistence.js');

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

module.exports = { load, makeDocument, SCHEMA, SITE, OTHER_SITE, RUN };

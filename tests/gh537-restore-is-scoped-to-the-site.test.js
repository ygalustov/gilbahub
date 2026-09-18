/**
 * GH-537 — a page loads the samples of the site it is open on.
 *
 * WHAT IT REPLACES. Every page asked for `samples?limit=200` with no site at
 * all: the whole account, first 200 rows, on a page showing one site. The
 * owner's decision is that the request names the site. The server half needed
 * nothing — `site_id` has been a `nullable` rule in `SampleController::index`
 * since GH-526 and is applied to the query when present. Nothing is tightened
 * there; the client stops asking for everything.
 *
 * AND WHAT THE LIMIT NOW MEANS. `restoreLimit` stops being a cap on the account
 * and becomes a cap on one site. The partial-read detection that stage 3 added
 * is NOT removed — a truncated read is still a truncated read — but the case
 * where the truncation was caused by the SIZE OF THE ACCOUNT is gone.
 *
 * THE PART THAT IS A JUDGEMENT, and it is asserted from both sides here rather
 * than described. Four views — /hub and the three /reports pages — load
 * `word-export-combined.js`, whose `enumerateSamples('all')` walks every site
 * in the store and offers them in one picker; the same four are the only ones
 * carrying a control that changes site without reloading the page. Those keep
 * the all-sites load. The decision is read off `window.GAIP_CombinedExport`,
 * which those four views define and no other view does — the page's own
 * composition, not a new flag somebody has to remember to set.
 */

'use strict';

const fs = require('fs');
const path = require('path');

const SITE_A = 'site-a-uuid';
const SITE_B = 'site-b-uuid';
const LAB = { K: 41, P: 19, Ca: 1180 };

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
        body: { appendChild() {} },
    };
}

function serverSample(over) {
    return Object.assign({
        id: '900', site_id: SITE_A, sample_type: 'soil', client_uid: 'green_1',
        lab_date: '2026-04-25', sample_date: '2026-04-25', notes: '',
        payload: Object.assign({ _label: 'Green 1', _zone: 'green' }, LAB),
    }, over || {});
}

function buildHarness(opts) {
    const o = opts || {};
    jest.useFakeTimers();
    jest.resetModules();

    const state = { urls: [] };

    global.window = {};
    global.document = makeDocument();
    global.localStorage = { getItem() { return null; }, setItem() {}, removeItem() {} };
    global.sessionStorage = global.localStorage;
    if (typeof global.CustomEvent !== 'function') {
        global.CustomEvent = class { constructor(t, i) { this.type = t; this.detail = i && i.detail; } };
    }
    global.window.CustomEvent = global.CustomEvent;
    global.window.addEventListener = () => {};

    // The fact the module reads: this page carries the cross-site export.
    // `lateCombinedExport` defines it AFTER sample-persistence.js has loaded and
    // started its restore — see the ordering tests at the foot of this file.
    if (o.combinedExport) global.window.GAIP_CombinedExport = { enumerate() { return []; } };

    global.fetch = function (url) {
        state.urls.push(String(url));
        if (/\/sites$/.test(String(url))) {
            return Promise.resolve({ ok: true, status: 200,
                text: () => Promise.resolve(JSON.stringify({ data: [
                    { id: SITE_A, name: 'Site A' }, { id: SITE_B, name: 'Site B' }] })) });
        }
        const rows = o.rows === undefined ? [serverSample()] : o.rows;
        return Promise.resolve({ ok: true, status: 200,
            text: () => Promise.resolve(JSON.stringify({
                data: rows, meta: { total: o.total === undefined ? rows.length : o.total, returned: rows.length } })) });
    };
    global.window.fetch = global.fetch;

    global.window.GAIP_HUB_CONFIG = {
        restUrl: '/api/', csrfToken: 't',
        activeSiteId: o.activeSiteId === undefined ? SITE_A : o.activeSiteId,
        canEditActiveSite: true,
    };

    const ready = [];
    global.document.addEventListener('gaip:samples-persistence-ready', (e) => ready.push(e.detail));

    require('../assets/sample-manager.js');
    require('../assets/sample-persistence.js');
    if (o.lateCombinedExport) global.window.GAIP_CombinedExport = { enumerate() { return []; } };
    jest.advanceTimersByTime(2000);

    return {
        SM: global.window.GAIP_SampleManager,
        P: global.window.GAIP_SamplePersistence,
        state,
        sampleUrls: () => state.urls.filter((u) => /\/samples\?/.test(u)),
        lastReady: () => ready[ready.length - 1],
        settle: async () => {
            for (let i = 0; i < 12; i += 1) {
                jest.advanceTimersByTime(100);
                await Promise.resolve();
                await Promise.resolve();
            }
        },
    };
}

afterEach(() => {
    jest.clearAllTimers();
    jest.useRealTimers();
    delete global.fetch;
});

describe('GH-537 — the request names the site', () => {

    test('an ordinary page asks for the active site, not the account', async () => {
        const h = buildHarness({});
        await h.settle();
        const urls = h.sampleUrls();
        expect(urls.length).toBe(1);
        expect(urls[0]).toContain('site_id=' + SITE_A);
        expect(urls[0]).toContain('limit=200');
    });

    test('the site travels out on the ready event, so a consumer can tell whose samples these are', async () => {
        const h = buildHarness({});
        await h.settle();
        expect(h.lastReady().source).toBe('server');
        expect(h.lastReady().siteId).toBe(SITE_A);
    });

    test('a site with no samples is EMPTY, not an error — the store stays open', async () => {
        // This is the case the change creates: the account may hold plenty and
        // this site none. It must not read as a failed load.
        const h = buildHarness({ rows: [], total: 0 });
        await h.settle();
        expect(h.lastReady().source).toBe('empty');
        expect(h.lastReady().siteId).toBe(SITE_A);
        expect(h.SM.isReadOnly()).toBe(false);
    });

    test('no active site on the page: the request falls back to asking for everything', async () => {
        // Rather than sending `site_id=` empty or `site_id=null`, which the
        // route would reject with a 422 and the page would read as "could not
        // load" — correct outcome, wrong reason, on every load.
        const h = buildHarness({ activeSiteId: null });
        await h.settle();
        const urls = h.sampleUrls();
        expect(urls.length).toBe(1);
        expect(urls[0]).not.toContain('site_id');
        expect(h.lastReady().siteId).toBeNull();
    });
});

describe('GH-537 — the four pages that still need every site', () => {

    test('a page carrying the cross-site export asks for all of them', async () => {
        const h = buildHarness({ combinedExport: true });
        await h.settle();
        const urls = h.sampleUrls();
        expect(urls.length).toBe(1);
        expect(urls[0]).not.toContain('site_id');
    });

    test('and such a page restores samples of a site that is NOT the active one', async () => {
        // The measurement behind the exception: the combined export's picker
        // offers samples across sites in one dialog. Narrow the load and it
        // silently becomes a one-site picker.
        const h = buildHarness({
            combinedExport: true,
            rows: [serverSample(), serverSample({ id: '901', site_id: SITE_B, client_uid: 'green_2' })],
        });
        await h.settle();
        const all = h.SM.getAllSamples();
        expect(Object.keys(all.allSites[SITE_A].soil)).toEqual(['green_1']);
        expect(Object.keys(all.allSites[SITE_B].soil)).toEqual(['green_2']);
    });

    test('an ordinary page keeps the whole site REGISTRY and only the active site\'s SAMPLES', async () => {
        // The two halves travel separately and must keep doing so: the site
        // list comes from GET /api/sites and is what the site switcher renders,
        // so narrowing the samples must not narrow the list. An earlier draft
        // of this test asserted the other site was absent from the store
        // entirely and went red — `addSiteWithId` creates its empty buckets,
        // which is the registry doing its job.
        const h = buildHarness({ rows: [serverSample()] });
        await h.settle();
        const all = h.SM.getAllSamples();

        // Both real sites are in the registry. Asserted by presence rather
        // than as an exact list: sample-manager.js starts with a built-in
        // 'default' site of its own, which predates any of this.
        expect(Object.keys(all.sites)).toEqual(expect.arrayContaining([SITE_A, SITE_B]));
        expect(Object.keys(all.allSites[SITE_A].soil)).toEqual(['green_1']);
        expect(Object.keys(all.allSites[SITE_B].soil || {})).toEqual([]);
    });
});

describe('GH-537 — what stage 3 added is NOT removed', () => {

    test('a short read is still a short read, and still says N of M', async () => {
        const h = buildHarness({ rows: [serverSample()], total: 201 });
        await h.settle();
        const d = h.lastReady();
        expect(d.source).toBe('error');
        expect(d.partial).toBe(true);
        expect(d.count).toBe(1);
        expect(d.total).toBe(201);
        expect(d.siteId).toBe(SITE_A);
        expect(h.SM.isReadOnly()).toBe(true);
    });

    test('a failed read still locks the store', async () => {
        jest.useFakeTimers();
        const h = buildHarness({});
        global.fetch = function (url) {
            if (/\/sites$/.test(String(url))) {
                return Promise.resolve({ ok: true, status: 200,
                    text: () => Promise.resolve(JSON.stringify({ data: [{ id: SITE_A, name: 'A' }] })) });
            }
            return Promise.reject(new Error('network down'));
        };
        global.window.fetch = global.fetch;
        h.P.restore();
        await h.settle();
        expect(h.lastReady().source).toBe('error');
        expect(h.SM.isReadOnly()).toBe(true);
    });
});

describe('GH-537 — the exception is pinned to what the views actually load', () => {

    const view = (f) => fs.readFileSync(path.join(__dirname, '..', 'app', 'resources', 'views', f), 'utf8');

    /**
     * The whole exception rests on `GAIP_CombinedExport` existing on exactly the
     * views that enumerate across sites. If a fifth view starts loading
     * `word-export-combined.js`, or one of these four stops, the rule silently
     * changes meaning — so the set is asserted rather than described.
     */
    const WITH = ['hub.blade.php', 'reports/export.blade.php',
                  'reports/scenarios.blade.php', 'reports/forensic.blade.php'];
    const WITHOUT = ['layouts/db-shell.blade.php', 'analysis.blade.php',
                     'field-log.blade.php', 'stadium.blade.php', 'morning-briefing.blade.php'];

    test.each(WITH)('%s loads word-export-combined.js and so asks for every site', (f) => {
        expect(view(f)).toContain('word-export-combined.js');
    });

    test.each(WITHOUT)('%s does not, and so asks for its own site', (f) => {
        expect(view(f)).not.toContain('word-export-combined.js');
    });

    test('stadium loads the site-switching controls but no persistence at all', () => {
        // Named because it looks like a counter-example and is not: nothing
        // restores there, so the scope question never arises.
        const v = view('stadium.blade.php');
        expect(v).toContain('site-selector-ui.js');
        expect(v).not.toContain('sample-persistence.js');
    });
});

/**
 * GH-537 — DOES THE EXCEPTION DEPEND ON SCRIPT ORDER? Raised by the coordinator
 * as a judgement, not a finding, and measured rather than argued.
 *
 * THE WORRY, and it was a good one. The exception is read off
 * `window.GAIP_CombinedExport`. On all four views that carry it, every script
 * including this one is emitted with `defer` — so `document.readyState` is
 * 'interactive' when sample-persistence.js runs, `init()` fires IMMEDIATELY
 * rather than on DOMContentLoaded, and the restore starts before the rest of
 * the deferred queue has executed. Move `word-export-combined.js` below
 * `sample-persistence.js` and the global might be missing when the decision is
 * taken; the exception would vanish and the cross-site picker would quietly
 * become a one-site picker.
 *
 * WHAT THE MEASUREMENT FOUND, and it is not what either of us expected: THAT IS
 * ALREADY THE ORDER. `sample-persistence.js` is loaded FIRST in all four views
 * and `word-export-combined.js` after it — hub 200/205, reports/export 276/287,
 * scenarios 147/156, forensic 128/137. The global does not exist when this
 * module loads, on any of them, today.
 *
 * It works anyway, and structurally rather than by luck: `restoreSiteId()` is
 * called inside `fetchSamplesFromServer`, which runs only after
 * `GET /api/sites` has come back. The whole deferred queue executes as one
 * uninterrupted run before any network response can be delivered, so the global
 * is always there by the time the decision is taken. The first test below
 * defines it AFTER the module has loaded and started, which is the live case.
 *
 * THE ORDER IS PINNED AS IT IS. Not as a requirement that combined load first —
 * it does not — but so that a change to either side of the pair is visible
 * instead of silent, and so the next reader meets this paragraph.
 */
describe('GH-537 — the exception does not rest on script order', () => {

    test('the flag defined AFTER the module started is still honoured', async () => {
        // This is the LIVE case on all four views, not a hypothetical one.
        const h = buildHarness({ lateCombinedExport: true });
        await h.settle();
        const urls = h.sampleUrls();
        expect(urls.length).toBe(1);
        expect(urls[0]).not.toContain('site_id');
    });

    test('the decision is taken after the site list comes back, not at load time', () => {
        // What the test above rests on: the read is inside the samples fetch,
        // which is inside the site-list callback. Move it to module scope and
        // script order starts to matter again — this pin says so.
        const src = fs.readFileSync(path.join(__dirname, '..', 'assets', 'sample-persistence.js'), 'utf8');
        const decl = src.indexOf('function restoreSiteId()');
        const use = src.indexOf('var scopeSiteId = restoreSiteId();');
        const fetchFn = src.indexOf('function fetchSamplesFromServer(');
        expect(decl).toBeGreaterThan(-1);
        expect(use).toBeGreaterThan(fetchFn);
    });

    test.each([
        ['hub.blade.php'],
        ['reports/export.blade.php'],
        ['reports/scenarios.blade.php'],
        ['reports/forensic.blade.php'],
    ])('%s: the load order of the pair is what it is, and a change to it is visible', (f) => {
        const v = fs.readFileSync(path.join(__dirname, '..', 'app', 'resources', 'views', f), 'utf8');
        // The QUOTED name, so a mention in a comment is not mistaken for a
        // script entry — scenarios and forensic both name the file in a comment
        // on line 8, which is what an earlier draft of this pin measured.
        const combined = v.indexOf("'word-export-combined.js'");
        const persistence = v.indexOf("'sample-persistence.js'");
        expect(combined).toBeGreaterThan(-1);
        expect(persistence).toBeGreaterThan(-1);
        expect(persistence).toBeLessThan(combined);
    });
});

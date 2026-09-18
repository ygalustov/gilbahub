/**
 * GH-536 (PLAN-samples-sync-FINAL, stage 3) — Н3: the /hub active-site block
 * still RUNS, not merely still exists.
 *
 * WHY THIS FILE EXISTS, and it exists because a mutation did not go red.
 *
 * hub-persistence.js kept the active-site handling inside `if (samples)`, where
 * `samples` was the browser copy read from `CONFIG.keys.samples`. What the block
 * actually does has nothing to do with samples: it honours
 * `gilba_import_active_site` when an import has just run, and otherwise makes
 * the store's active site match the server's. Deleting the key without lifting
 * the block would have stopped /hub setting its active site at all — silently,
 * because /hub is the hidden calculation runner and nobody watches it.
 *
 * The lift was pinned by a SOURCE check: the strings `gilba_import_active_site`
 * and `/api/active-site` are still in the file. During the self-check that pin
 * was mutated — the call put back behind a dead condition — and it stayed
 * GREEN. Of course it did: the code was still there, it just never ran. A pin on
 * the text of a block proves the text.
 *
 * So the block is RUN here, with the real file, and what it did is read off the
 * store. `setActiveSite` being called with the server's id is the measurement;
 * everything else in this legacy file is stubbed away.
 */

'use strict';

function makeDocument() {
    const listeners = {};
    const el = () => ({
        style: {}, dataset: {}, classList: { add() {}, remove() {}, contains() { return false; }, toggle() {} },
        appendChild() {}, addEventListener() {}, querySelector() { return null; },
        querySelectorAll() { return []; }, setAttribute() {}, getAttribute() { return null; },
        value: '', textContent: '', innerHTML: '', checked: false, options: [],
    });
    return {
        readyState: 'complete',
        head: el(),
        body: el(),
        addEventListener(t, fn) { (listeners[t] = listeners[t] || []).push(fn); },
        removeEventListener() {},
        dispatchEvent(ev) { (listeners[ev.type] || []).slice().forEach((fn) => fn(ev)); return true; },
        createElement: () => el(),
        getElementById: () => null,
        querySelector: () => null,
        querySelectorAll: () => [],
        _fire(type, detail) { this.dispatchEvent({ type, detail }); },
    };
}

const SITE = 'server-site-uuid';

function load(opts) {
    const o = opts || {};
    jest.resetModules();
    jest.useFakeTimers();

    const calls = { setActiveSite: [], patched: [] };

    global.window = {};
    global.document = makeDocument();
    global.localStorage = { getItem() { return null; }, setItem() {}, removeItem() {} };
    global.sessionStorage = {
        getItem: (k) => (k === 'gilba_import_active_site' ? (o.importSite || null) : null),
        setItem() {}, removeItem() {},
    };
    global.CustomEvent = global.CustomEvent || class { constructor(t, i) { this.type = t; this.detail = i && i.detail; } };
    global.window.CustomEvent = global.CustomEvent;
    global.window.addEventListener = () => {};
    global.window.localStorage = global.localStorage;
    global.window.sessionStorage = global.sessionStorage;

    global.fetch = (url, init) => {
        calls.patched.push({ url, body: init && init.body ? JSON.parse(init.body) : null });
        return Promise.resolve({ ok: true, status: 200, json: () => Promise.resolve({}), text: () => Promise.resolve('{}') });
    };
    global.window.fetch = global.fetch;

    // The file reads `GAIP_HUB_CONFIG` bare in one place (`CONFIG.keys`), so it
    // has to be a real global and not only a property of the window stub.
    global.GAIP_HUB_CONFIG = { restUrl: '/api/', csrfToken: 't', activeSiteId: SITE, userId: 1 };
    global.window.GAIP_HUB_CONFIG = global.GAIP_HUB_CONFIG;
    global.window.GAIP_SampleManager = {
        setActiveSite(id) { calls.setActiveSite.push(id); },
        getSiteList() { return (o.siteList || [SITE, o.importSite].filter(Boolean)).map((id) => ({ id })); },
        getAllSamples() { return { sites: {}, allSites: {}, allActive: {}, allMeta: {} }; },
        restoreFromPersistence() { return true; },
        getActiveSiteId() { return SITE; },
    };
    global.window._gaipSamplePersistenceReady = o.readyBefore !== false;

    require('../assets/hub-persistence.js');
    return { calls, P: global.window.GilbaPersistence, doc: global.document };
}

afterEach(() => {
    jest.clearAllTimers();
    jest.useRealTimers();
    delete global.fetch;
});

describe('GH-536 — Н3: the active-site block runs after the samples key is gone', () => {

    test('restore() sets the active site from the server config', () => {
        const h = load({ readyBefore: true });
        h.P.restore();
        jest.advanceTimersByTime(1000);

        // The whole point of the lift. Before it, this list was empty unless
        // the browser happened to hold a `gilba_hub_samples` blob.
        expect(h.calls.setActiveSite).toContain(SITE);
    });

    test('an import in flight wins over the server config, and tells the server so', () => {
        const IMPORTED = 'just-imported-uuid';
        const h = load({ readyBefore: true, importSite: IMPORTED, siteList: [SITE, IMPORTED] });
        h.P.restore();
        jest.advanceTimersByTime(1000);

        expect(h.calls.setActiveSite).toContain(IMPORTED);
        expect(h.calls.setActiveSite).not.toContain(SITE);
        expect(h.calls.patched.some((c) => /\/api\/active-site/.test(c.url) && c.body && c.body.site_id === IMPORTED)).toBe(true);
    });

    test('a restore that has not finished yet is waited for, not missed', () => {
        // The 200 ms timer this replaced was a guess at how long the server read
        // takes. It was covered until this stage by the browser copy underneath
        // it; there is no copy now, so a miss would be permanent.
        const h = load({ readyBefore: false });
        h.P.restore();
        jest.advanceTimersByTime(2000);
        expect(h.calls.setActiveSite).toEqual([]);

        global.window._gaipSamplePersistenceReady = true;
        h.doc._fire('gaip:samples-persistence-ready', { source: 'server', count: 3 });
        jest.advanceTimersByTime(500);

        expect(h.calls.setActiveSite).toContain(SITE);
    });
});

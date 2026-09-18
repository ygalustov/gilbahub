/**
 * GH-536 (PLAN-samples-sync-FINAL, stage 3) — the browser copy is gone, and a
 * failed read says so instead of pretending.
 *
 * THE DEFECT THIS CLOSES, in the order the code ran it.
 *
 *   fetchSamplesFromServer() called onComplete(false) in three situations: no
 *   API on the page, an empty list, and a request that threw. An empty account
 *   and a failed read were the same answer.
 *
 *   restore() answered that `false` with restoreFromLocalFallback(), which
 *   filled the store out of `gilba_samples` in localStorage.
 *
 *   Those samples have no `serverId` — only a server restore writes one — so
 *   every later edit stopped inside writeUpdate() at `if (!sample.serverId)`
 *   with a line in the console and nothing on the wire.
 *
 * The screen looked right for all three steps. That is the whole defect: the
 * client kept working and lost the work without being told.
 *
 * WHAT IS ASSERTED AND WHY EACH ONE IS HERE
 *
 *   The three outcomes are distinguishable, and the two that are not failures
 *   leave the store OPEN. An empty account is a successful read of nothing.
 *
 *   A failed read locks the store and the lock BITES: addSample throws. A lock
 *   that is only a flag is a lock that does nothing.
 *
 *   The ready flag is set on the failing path too. turf-profile-controller.js
 *   gates its site switch on it; leaving it unset would hang a second defect
 *   off the first.
 *
 *   THE LOCK IS NOT ON BY DEFAULT. morning-briefing.blade.php and
 *   stadium.blade.php load sample-manager.js WITHOUT sample-persistence.js. A
 *   lock that defaults to closed and is opened only by a successful restore
 *   would shut both of those pages permanently, and nothing on them would ever
 *   call the opener. This is asserted against sample-manager.js on its own,
 *   loaded the way those two pages load it.
 *
 *   The short read is detected. `meta.total` has been served since stage 1 and
 *   nothing read it. With the copy gone, 200 of 201 is a sample the client
 *   cannot see and is not told about.
 *
 *   A source-pin on the key itself. The copy could come back through any future
 *   helper; the string `gilba_samples` is what identifies it.
 */

'use strict';

const fs = require('fs');
const path = require('path');

const SITE_A = 'site-a-uuid';
const LAB_VALUES = { K: 41, P: 19, Ca: 1180, thatch: 12.4 };

function makeDocument() {
    const listeners = {};
    return {
        readyState: 'complete',
        addEventListener(type, fn) { (listeners[type] = listeners[type] || []).push(fn); },
        removeEventListener(type, fn) { listeners[type] = (listeners[type] || []).filter((f) => f !== fn); },
        dispatchEvent(ev) {
            (listeners[ev.type] || []).slice().forEach((fn) => fn.call(this, ev));
            return true;
        },
        querySelector() { return null; },
        querySelectorAll() { return []; },
        getElementById() { return null; },
        createElement() { return { style: {}, classList: { add() {}, remove() {} }, appendChild() {} }; },
        body: { appendChild() {} },
    };
}

function serverSample(overrides) {
    return Object.assign({
        id: '900',
        site_id: SITE_A,
        sample_type: 'soil',
        client_uid: 'green_1',
        lab_date: '2026-04-25',
        sample_date: '2026-04-25',
        notes: 'from the lab',
        methodology_snapshot: 'mlsn',
        soil_texture_snapshot: 'sands',
        payload: Object.assign({ _label: 'Green 1', _zone: 'green', _source: 'import' }, LAB_VALUES),
    }, overrides || {});
}

/**
 * `opts.samplesAnswer` is the whole JSON body of GET /api/samples, so a test can
 * hand back a body with no `data` array, or a `meta` that disagrees with the
 * rows — both of which are the point.
 */
function buildHarness(options) {
    const opts = options || {};
    jest.useFakeTimers();
    jest.resetModules();

    const state = {
        requests: [],
        nextId: 1000,
        localWrites: [],
        readyEvents: [],
    };

    global.window = {};
    global.document = makeDocument();

    const lsStore = Object.assign({}, opts.localStorage || {});
    global.localStorage = {
        getItem(k) { return Object.prototype.hasOwnProperty.call(lsStore, k) ? lsStore[k] : null; },
        setItem(k, v) { state.localWrites.push(k); lsStore[k] = v; },
        removeItem(k) { delete lsStore[k]; },
    };
    global.sessionStorage = { getItem() { return null; }, setItem() {}, removeItem() {} };

    if (typeof global.CustomEvent !== 'function') {
        global.CustomEvent = class CustomEvent { constructor(type, init) { this.type = type; this.detail = init && init.detail; } };
    }
    if (typeof global.Event !== 'function') {
        global.Event = class Event { constructor(type) { this.type = type; } };
    }
    global.window.CustomEvent = global.CustomEvent;
    global.window.Event = global.Event;
    global.window.addEventListener = () => {};
    global.window.localStorage = global.localStorage;

    global.fetch = function fetchStub(url, options2) {
        const o = options2 || {};
        const method = (o.method || 'GET').toUpperCase();
        if (method !== 'GET') state.requests.push({ method, url, body: o.body ? JSON.parse(o.body) : null });

        if (method === 'GET' && /\/sites$/.test(url)) {
            if (opts.sitesFail) return Promise.reject(new Error('network down'));
            return Promise.resolve({ ok: true, status: 200,
                text: () => Promise.resolve(JSON.stringify({ data: [{ id: SITE_A, name: 'Site A', created_at: '2026-01-01' }] })) });
        }
        if (method === 'GET' && /\/samples\?/.test(url)) {
            state.samplesUrl = url;
            if (opts.samplesReject) return Promise.reject(new Error('network down'));
            if (opts.samplesStatus && opts.samplesStatus !== 200) {
                return Promise.resolve({ ok: false, status: opts.samplesStatus,
                    text: () => Promise.resolve(JSON.stringify({ message: 'nope' })) });
            }
            if (opts.samplesRawBody !== undefined) {
                return Promise.resolve({ ok: true, status: 200, text: () => Promise.resolve(opts.samplesRawBody) });
            }
            return Promise.resolve({ ok: true, status: 200,
                text: () => Promise.resolve(JSON.stringify(opts.samplesAnswer || { data: [], meta: { total: 0, returned: 0 } })) });
        }
        if (method === 'POST') {
            state.nextId += 1;
            return Promise.resolve({ ok: true, status: 201, text: () => Promise.resolve(JSON.stringify({ data: { id: String(state.nextId) } })) });
        }
        if (opts.writeStatus) {
            return Promise.resolve({ ok: false, status: opts.writeStatus, text: () => Promise.resolve(JSON.stringify({ message: 'refused' })) });
        }
        return Promise.resolve({ ok: true, status: 200, text: () => Promise.resolve(JSON.stringify({ data: {} })) });
    };
    global.window.fetch = global.fetch;

    global.window.GAIP_HUB_CONFIG = {
        restUrl: '/api/', csrfToken: 'test-token', activeSiteId: SITE_A, canEditActiveSite: true,
    };

    global.document.addEventListener('gaip:samples-persistence-ready', (e) => state.readyEvents.push(e.detail));

    require('../assets/sample-manager.js');
    if (!opts.managerOnly) require('../assets/sample-persistence.js');
    jest.advanceTimersByTime(2000);

    return {
        SM: global.window.GAIP_SampleManager,
        P: global.window.GAIP_SamplePersistence,
        state,
        doc: global.document,
        settle: async () => {
            for (let i = 0; i < 12; i += 1) {
                jest.advanceTimersByTime(100);
                await Promise.resolve();
                await Promise.resolve();
            }
        },
        lastReady: () => state.readyEvents[state.readyEvents.length - 1],
    };
}

afterEach(() => {
    jest.clearAllTimers();
    jest.useRealTimers();
    delete global.fetch;
});

describe('GH-536 — "could not read" and "nothing there" are different answers', () => {

    test('rows came back: source server, store open, samples carry serverId', async () => {
        const h = buildHarness({ samplesAnswer: { data: [serverSample()], meta: { total: 1, returned: 1 } } });
        await h.settle();

        expect(h.lastReady().source).toBe('server');
        expect(h.SM.isReadOnly()).toBe(false);
        const s = h.SM.getSample('soil', 'green_1');
        expect(s).toBeTruthy();
        expect(String(s.serverId)).toBe('900');
    });

    test('an empty account: source empty, and the store stays OPEN', async () => {
        const h = buildHarness({ samplesAnswer: { data: [], meta: { total: 0, returned: 0 } } });
        await h.settle();

        expect(h.lastReady().source).toBe('empty');
        expect(h.SM.isReadOnly()).toBe(false);
        // The whole point: a working account with no samples can still add one.
        expect(() => h.SM.addSample('soil', { id: 'new_1', values: LAB_VALUES })).not.toThrow();
    });

    test('a failed read: source error, store LOCKED, and the lock bites', async () => {
        const h = buildHarness({ samplesReject: true });
        await h.settle();

        expect(h.lastReady().source).toBe('error');
        expect(h.SM.isReadOnly()).toBe(true);
        expect(() => h.SM.addSample('soil', { id: 'new_1', values: LAB_VALUES }))
            .toThrow('Samples are not loaded — retry first');
        expect(() => h.SM.clearSamples('soil')).toThrow('Samples are not loaded — retry first');
    });

    test('a non-2xx read is an error, not an empty account', async () => {
        const h = buildHarness({ samplesStatus: 500 });
        await h.settle();
        expect(h.lastReady().source).toBe('error');
        expect(h.lastReady().status).toBe(500);
        expect(h.SM.isReadOnly()).toBe(true);
    });

    test('a 200 whose body is not JSON is an error, not an empty account', async () => {
        const h = buildHarness({ samplesRawBody: '<html>login</html>' });
        await h.settle();
        // This is the shape a session timeout takes on a page that redirects:
        // status 200, an HTML login page in the body. Read as "no samples" it
        // would have emptied the screen with no explanation.
        expect(h.lastReady().source).toBe('error');
        expect(h.SM.isReadOnly()).toBe(true);
    });

    test('the ready flag is set on the failing path too', async () => {
        const h = buildHarness({ samplesReject: true });
        await h.settle();
        // turf-profile-controller.js will not switch sites without this.
        expect(global.window._gaipSamplePersistenceReady).toBe(true);
        expect(h.state.readyEvents.length).toBeGreaterThan(0);
    });

    test('a failed site list locks the store and keeps reason sites-list', async () => {
        const h = buildHarness({ sitesFail: true });
        await h.settle();
        expect(h.lastReady().source).toBe('error');
        expect(h.lastReady().reason).toBe('sites-list');
        expect(h.SM.isReadOnly()).toBe(true);
    });
});

describe('GH-536 — the short read', () => {

    test('returned < total is an error, and it says how many of how many', async () => {
        const h = buildHarness({ samplesAnswer: { data: [serverSample()], meta: { total: 201, returned: 1 } } });
        await h.settle();

        const d = h.lastReady();
        expect(d.source).toBe('error');
        expect(d.partial).toBe(true);
        expect(d.count).toBe(1);
        expect(d.total).toBe(201);
        expect(h.SM.isReadOnly()).toBe(true);
    });

    test('the rows that did arrive are kept on screen, not thrown away as well', async () => {
        const h = buildHarness({ samplesAnswer: { data: [serverSample()], meta: { total: 201, returned: 1 } } });
        await h.settle();
        expect(h.SM.getSample('soil', 'green_1')).toBeTruthy();
    });

    test('returned === total is not a short read', async () => {
        const h = buildHarness({ samplesAnswer: { data: [serverSample()], meta: { total: 1, returned: 1 } } });
        await h.settle();
        expect(h.lastReady().source).toBe('server');
        expect(h.lastReady().partial).toBeFalsy();
    });

    test('the request asks for the limit the module declares', async () => {
        const h = buildHarness({ samplesAnswer: { data: [], meta: { total: 0, returned: 0 } } });
        await h.settle();
        expect(h.state.samplesUrl).toContain('limit=' + h.P.CONFIG.restoreLimit);
    });
});

describe('GH-536 — the lock is set by a failed restore, not by default', () => {

    test('sample-manager.js on its own, without persistence, is NOT locked', () => {
        // morning-briefing.blade.php and stadium.blade.php load exactly this
        // much. Nothing on either page ever calls setReadOnly, so a lock that
        // defaulted to closed would never open.
        const h = buildHarness({ managerOnly: true });
        expect(h.SM.isReadOnly()).toBe(false);
        expect(() => h.SM.addSample('soil', { id: 'a', values: LAB_VALUES })).not.toThrow();
    });

    test('a successful retry re-opens a store an earlier failure closed', async () => {
        const h = buildHarness({ samplesReject: true });
        await h.settle();
        expect(h.SM.isReadOnly()).toBe(true);

        // What the banner's Retry does, and the only thing it does.
        global.fetch = function (url) {
            if (/\/sites$/.test(url)) {
                return Promise.resolve({ ok: true, status: 200,
                    text: () => Promise.resolve(JSON.stringify({ data: [{ id: SITE_A, name: 'Site A' }] })) });
            }
            return Promise.resolve({ ok: true, status: 200,
                text: () => Promise.resolve(JSON.stringify({ data: [serverSample()], meta: { total: 1, returned: 1 } })) });
        };
        global.window.fetch = global.fetch;

        h.P.restore();
        await h.settle();

        expect(h.lastReady().source).toBe('server');
        expect(h.SM.isReadOnly()).toBe(false);
    });
});

describe('GH-536 — nothing is written to the browser', () => {

    test('a successful restore writes no localStorage key at all', async () => {
        const h = buildHarness({ samplesAnswer: { data: [serverSample()], meta: { total: 1, returned: 1 } } });
        await h.settle();
        expect(h.state.localWrites).toEqual([]);
    });

    test('a localStorage copy left by an older build is NOT read', async () => {
        // The exact situation every existing client is in on the day this
        // ships: the key is still in their browser. It must not come back.
        const stale = JSON.stringify({
            sites: { [SITE_A]: { label: 'Site A' } },
            allSites: { [SITE_A]: { soil: { ghost: { id: 'ghost', label: 'Ghost', rawData: LAB_VALUES } } } },
            currentSite: SITE_A,
        });
        const h = buildHarness({ samplesReject: true, localStorage: { gilba_samples: stale } });
        await h.settle();

        expect(h.SM.getSample('soil', 'ghost')).toBeNull();
        expect(h.lastReady().source).toBe('error');
    });

    test('the public API no longer offers the copy', () => {
        const h = buildHarness({});
        expect(h.P.StorageAdapter).toBeUndefined();
        expect(h.P.clear).toBeUndefined();
        expect(h.P.getStorageSize).toBeUndefined();
        expect(h.P.getStorageSizeFormatted).toBeUndefined();
        expect(typeof h.P.restore).toBe('function');
        expect(typeof h.P.retryRecord).toBe('function');
    });
});

describe('GH-536 — source-pin on the key', () => {

    const read = (f) => fs.readFileSync(path.join(__dirname, '..', 'assets', f), 'utf8');
    /** The file without its prose: the comments explain what was removed and
     *  name the key while doing so. A pin that reads them pins the explanation. */
    const code = (src) => src.replace(/\/\/[^\n]*/g, '').replace(/\/\*[\s\S]*?\*\//g, '');

    const FILES = [
        'sample-persistence.js',
        'sample-manager.js',
        'dashboard-ui.js',
        'settings-init.js',
        'gaip-field-log.js',
        'gilba-storage-migrate.js',
    ];

    test.each(FILES)('%s does not name gilba_samples in code', (f) => {
        expect(code(read(f))).not.toContain('gilba_samples');
    });

    test('hub-persistence.js keeps neither gilba_hub_samples nor keys.samples', () => {
        const c = code(read('hub-persistence.js'));
        expect(c).not.toContain('gilba_hub_samples');
        expect(c).not.toContain('keys.samples');
        expect(c).not.toContain('collectSamples');
        expect(c).not.toContain('restoreSamples');
    });

    test('the /hub active-site block survived the key it used to sit under', () => {
        // Н3 in the worksheet: `gilba_import_active_site` and the setActiveSite
        // call lived inside `if (samples)`. Deleting the key without lifting
        // them out would have stopped /hub setting its active site at all.
        const c = code(read('hub-persistence.js'));
        expect(c).toContain('gilba_import_active_site');
        expect(c).toContain('/api/active-site');
    });

    test('site-dashboard.js keeps its own StorageAdapter, which is a different object', () => {
        // The trap: the name is declared in two files. Removing "StorageAdapter"
        // by name would have emptied the wrong one.
        expect(read('site-dashboard.js')).toContain('var StorageAdapter = {');
        expect(code(read('sample-persistence.js'))).not.toContain('StorageAdapter');
    });
});

describe('GH-536 — the unsaved marker', () => {

    test('a failed write leaves _dirty with the status, and retryRecord resends it', async () => {
        const h = buildHarness({ samplesAnswer: { data: [serverSample()], meta: { total: 1, returned: 1 } } });
        await h.settle();

        // Refuse the PATCH.
        const seen = [];
        global.fetch = function (url, o) {
            const m = ((o || {}).method || 'GET').toUpperCase();
            if (m === 'PATCH') {
                seen.push(url);
                return Promise.resolve({ ok: false, status: 403, text: () => Promise.resolve(JSON.stringify({ message: 'no' })) });
            }
            return Promise.resolve({ ok: true, status: 200, text: () => Promise.resolve(JSON.stringify({ data: {} })) });
        };
        global.window.fetch = global.fetch;

        h.SM.updateSample('soil', 'green_1', { K: 99 });
        await h.settle();

        const s = h.SM.getSample('soil', 'green_1');
        expect(s._dirty).toBeTruthy();
        expect(s._dirty.op).toBe('update');
        expect(seen.length).toBe(1);

        // Retry sends it again — which is what nothing did before this stage.
        h.P.retryRecord('soil', 'green_1');
        await h.settle();
        expect(seen.length).toBe(2);
    });

    test('retryRecord on a sample that is not dirty sends nothing', async () => {
        const h = buildHarness({ samplesAnswer: { data: [serverSample()], meta: { total: 1, returned: 1 } } });
        await h.settle();
        expect(h.P.retryRecord('soil', 'green_1')).toBe(false);
    });
});

/**
 * GH-536 — WHY THE `values` ALIAS DID NOT COME OUT IN THIS DELIVERY.
 *
 * The plan's stage 3 ends with "remove the `values` alias from stage 2". It is
 * not removed, and this is the measurement that stopped it rather than an
 * opinion about it.
 *
 * `values` is written in exactly one place: the server restore in
 * sample-persistence.js, as `values: pld`. Every reader in the tree reads
 * `rawData || values` and would be unaffected -- except one.
 * nutrition-calendar.js reads `(sample && sample.values) || null` with NO
 * fallback; GH-471 removed the fallback chain on purpose.
 *
 * So the alias is load-bearing for the nutrition program, and removing it
 * would have to move that reader to `rawData` in the same change -- a
 * calculation path, in a delivery whose subject is the browser copy.
 *
 * The tests below record what is true today. The second one is a live defect
 * that predates this stage and is reported, not fixed here: a sample the user
 * typed in has no `values`, so the nutrition calendar reads nothing from it.
 */
describe('GH-536 — the values alias, measured', () => {

    test('a SERVER-restored sample carries both rawData and the values alias', async () => {
        const h = buildHarness({ samplesAnswer: { data: [serverSample()], meta: { total: 1, returned: 1 } } });
        await h.settle();
        const s = h.SM.getSample('soil', 'green_1');
        expect(s.rawData.K).toBe(41);
        expect(s.values).toBeTruthy();
    });

    test('a MANUALLY ADDED sample has rawData and NO values — so the calendar reads null from it', async () => {
        const h = buildHarness({ samplesAnswer: { data: [], meta: { total: 0, returned: 0 } } });
        await h.settle();

        h.SM.addSample('soil', { id: 'typed_1', values: LAB_VALUES });
        const s = h.SM.getSample('soil', 'typed_1');

        expect(s.rawData.K).toBe(41);
        expect(s.values).toBeUndefined();

        // nutrition-calendar.js:701, copied exactly:
        const readings = (sample) => (sample && sample.values) || null;
        expect(readings(s)).toBeNull();
    });
});

/**
 * GH-533 (PLAN-samples-sync-FINAL, stage 2) — the hub writes one record at a
 * time.
 *
 * Until this stage every sample mutation scheduled a 500 ms debounce and then
 * sent POST /api/samples/sync carrying a snapshot of every sample of every
 * site, assembled in the browser. Adding one sample sent the whole collection.
 * The project rule it broke is in CLAUDE.md and is one sentence: send the
 * change, not the state.
 *
 * These tests load the REAL sample-manager.js and the REAL
 * sample-persistence.js on a fake DOM with a working event bus and a recording
 * `fetch`, then perform the actions a user performs and read the requests off
 * the wire. Same loading convention as
 * tests/gh378-no-duplicate-site-changed-during-export.test.js.
 *
 * WHAT IS ASSERTED AND WHY EACH ONE IS HERE
 *
 *   One action, one request, naming one record. The shape of the defect.
 *
 *   No request body contains `allSites`. The plan asks for this as a guard
 *   rather than as a consequence: the snapshot could come back through any
 *   future helper, and the key is what identifies it.
 *
 *   A PATCH carries the WHOLE payload, including keys no form on the page can
 *   show. The fixture has `thatch` for this reason — an update assembled from
 *   the visible fields would silently drop it, and the loss would only show on
 *   the next export.
 *
 *   The site comes from the event. The test switches sites while a create is
 *   in flight and checks which site the request named. This is GH-459 in the
 *   write direction and is the reason the site is read at dispatch time.
 *
 *   gaip:site-changed sends nothing. Looking at a site is not editing it, and
 *   until this stage it pushed the whole collection.
 *
 *   canEditActiveSite:false sends nothing at all.
 */

'use strict';

const SITE_A = 'site-a-uuid';
const SITE_B = 'site-b-uuid';

/** A soil payload with a key no input on the page renders. */
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

/**
 * The recording fetch. GETs are answered from `state`; writes are recorded and
 * answered with the shape the real routes return.
 */
function makeFetch(state) {
    return function fetchStub(url, options) {
        const opts = options || {};
        const method = (opts.method || 'GET').toUpperCase();
        const body = opts.body ? JSON.parse(opts.body) : null;

        if (method !== 'GET') {
            state.requests.push({ method, url, body });
        }

        let payload = {};
        if (method === 'GET' && /\/sites$/.test(url)) {
            payload = { data: state.sites };
        } else if (method === 'GET' && /\/samples\?/.test(url)) {
            payload = { data: state.samples, meta: { total: state.samples.length, returned: state.samples.length } };
        } else if (method === 'POST') {
            state.nextId += 1;
            payload = { data: { id: String(state.nextId) } };
        } else {
            payload = { data: {} };
        }

        if (state.fail && state.fail(method, url)) {
            return Promise.resolve({
                ok: false,
                status: 403,
                text: () => Promise.resolve(JSON.stringify({ message: 'This action is unauthorized.' })),
            });
        }

        return Promise.resolve({
            ok: true,
            status: method === 'POST' ? 201 : 200,
            text: () => Promise.resolve(JSON.stringify(payload)),
        });
    };
}

/**
 * One server sample, in the shape SampleController::samplePayload() returns.
 * `_turfProfile` rides in the payload because that is how stage 2 sends it.
 */
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
        payload: Object.assign({
            _label: 'Green 1',
            _zone: 'green',
            _source: 'import',
            _turfProfile: { turfType: 'golf', species: 'bentgrass', companionSpecies: 'poa_annua' },
            zone: 'Greens',
        }, LAB_VALUES),
    }, overrides || {});
}

function buildHarness(options) {
    const opts = options || {};
    jest.useFakeTimers();
    jest.resetModules();

    const state = {
        requests: [],
        nextId: 1000,
        sites: opts.sites || [
            { id: SITE_A, name: 'Site A', created_at: '2026-01-01' },
            { id: SITE_B, name: 'Site B', created_at: '2026-01-01' },
        ],
        samples: opts.samples || [],
        fail: opts.fail || null,
    };

    global.window = {};
    global.document = makeDocument();
    global.localStorage = { getItem() { return null; }, setItem() {}, removeItem() {} };
    global.sessionStorage = global.localStorage;
    if (typeof global.CustomEvent !== 'function') {
        global.CustomEvent = class CustomEvent { constructor(type, init) { this.type = type; this.detail = init && init.detail; } };
    }
    if (typeof global.Event !== 'function') {
        global.Event = class Event { constructor(type) { this.type = type; } };
    }
    global.window.CustomEvent = global.CustomEvent;
    global.window.Event = global.Event;
    global.window.addEventListener = () => {};
    global.fetch = makeFetch(state);
    global.window.fetch = global.fetch;

    global.window.GAIP_HUB_CONFIG = {
        restUrl: '/api/',
        csrfToken: 'test-token',
        activeSiteId: SITE_A,
        canEditActiveSite: opts.canEdit === undefined ? true : opts.canEdit,
    };

    require('../assets/sample-manager.js');
    require('../assets/sample-persistence.js');
    jest.advanceTimersByTime(2000);

    const SM = global.window.GAIP_SampleManager;

    return {
        SM,
        state,
        doc: global.document,
        /** Let every queued promise settle, then read the wire. */
        settle: async () => {
            for (let i = 0; i < 12; i += 1) {
                jest.advanceTimersByTime(100);
                await Promise.resolve();
                await Promise.resolve();
            }
        },
        writes: () => state.requests.filter((r) => /\/samples(\/|$)/.test(r.url)),
    };
}

afterEach(() => {
    jest.clearAllTimers();
    jest.useRealTimers();
    delete global.fetch;
});

describe('GH-533 — one action, one request', () => {
    test('addSample sends exactly one POST naming one record, and records the id it comes back with', async () => {
        const h = buildHarness();
        await h.settle();
        h.SM.setActiveSite(SITE_A);
        h.state.requests.length = 0;

        h.SM.addSample('soil', { label: 'Green 1', date: '2026-05-01', values: LAB_VALUES });
        await h.settle();

        const writes = h.writes();
        expect(writes.length).toBe(1);
        expect(writes[0].method).toBe('POST');
        expect(writes[0].url).toMatch(/\/api\/samples$/);
        expect(writes[0].body.site_id).toBe(SITE_A);
        expect(writes[0].body.sample_type).toBe('soil');
        expect(writes[0].body.client_uid).toBe('green_1');
        expect(writes[0].body.sample_date).toBe('2026-05-01');
        expect(writes[0].body.payload).toEqual(Object.assign({}, LAB_VALUES, {
            _label: 'Green 1',
            _zone: 'green',
            _source: 'manual',
        }));

        // The address the server gave back is on the record, so the next
        // action on it has somewhere to go.
        expect(h.SM.getSample('soil', 'green_1').serverId).toBe('1001');
    });

    test('updateSample on a restored sample sends one PATCH carrying the WHOLE payload', async () => {
        const h = buildHarness({ samples: [serverSample()] });
        await h.settle();
        h.state.requests.length = 0;

        // The restore unwrapped the envelope: the readings are rawData, and
        // the meta keys became fields.
        const restored = h.SM.getSample('soil', 'green_1');
        expect(restored.serverId).toBe('900');
        expect(restored.rawData).toEqual(LAB_VALUES);
        expect(restored.label).toBe('Green 1');
        expect(restored.zoneType).toBe('green');
        expect(restored.source).toBe('import');
        expect(restored.turfProfile).toEqual({ turfType: 'golf', species: 'bentgrass', companionSpecies: 'poa_annua' });

        h.SM.setZoneType('soil', 'green_1', 'fairway');
        await h.settle();

        const writes = h.writes();
        expect(writes.length).toBe(1);
        expect(writes[0].method).toBe('PATCH');
        expect(writes[0].url).toMatch(/\/api\/samples\/900$/);

        // `thatch` is the key no input on the page renders. An update built
        // from the visible fields would have dropped it here, and nothing on
        // screen would have said so.
        expect(writes[0].body.payload.thatch).toBe(12.4);
        expect(writes[0].body.payload).toEqual(Object.assign({}, LAB_VALUES, {
            _label: 'Green 1',
            _zone: 'fairway',
            _source: 'import',
            _turfProfile: { turfType: 'golf', species: 'bentgrass', companionSpecies: 'poa_annua' },
        }));

        // GH-533: `client_uid` is not sent. The route would accept and write
        // it, and it is the key a re-import matches on.
        expect(writes[0].body).not.toHaveProperty('client_uid');
    });

    test('setSampleTurfProfile sends one PATCH and the profile is in the payload', async () => {
        const h = buildHarness({ samples: [serverSample()] });
        await h.settle();
        h.state.requests.length = 0;

        h.SM.setSampleTurfProfile('soil', 'green_1', {
            turfType: 'bowls', subCategory: 'greens', species: 'cotula', variety: null, companionSpecies: null,
        });
        await h.settle();

        const writes = h.writes();
        expect(writes.length).toBe(1);
        expect(writes[0].method).toBe('PATCH');
        expect(writes[0].body.payload._turfProfile.species).toBe('cotula');
    });

    test('deleteSample sends one DELETE addressed by serverId', async () => {
        const h = buildHarness({ samples: [serverSample()] });
        await h.settle();
        h.state.requests.length = 0;

        h.SM.deleteSample('soil', 'green_1');
        await h.settle();

        const writes = h.writes();
        expect(writes.length).toBe(1);
        expect(writes[0].method).toBe('DELETE');
        expect(writes[0].url).toMatch(/\/api\/samples\/900$/);
        expect(writes[0].body.source).toBe('hub');
    });

    test('clearSamples sends one DELETE per row, and the addresses survive the store being emptied', async () => {
        const h = buildHarness({
            samples: [
                serverSample({ id: '901', client_uid: 'green_1' }),
                serverSample({ id: '902', client_uid: 'green_2', lab_date: '2026-04-26' }),
                serverSample({ id: '903', client_uid: 'green_3', lab_date: '2026-04-27' }),
            ],
        });
        await h.settle();
        expect(h.SM.getSampleCount('soil')).toBe(3);
        h.state.requests.length = 0;

        h.SM.clearSamples('soil');
        await h.settle();

        const writes = h.writes();
        expect(writes.map((w) => w.method)).toEqual(['DELETE', 'DELETE', 'DELETE']);
        expect(writes.map((w) => w.url.replace(/^.*\/samples\//, '')).sort()).toEqual(['901', '902', '903']);
    });

    test('a create names the site the sample was added to, even when the user switches while it is in flight', async () => {
        const h = buildHarness();
        await h.settle();
        h.SM.setActiveSite(SITE_A);
        h.state.requests.length = 0;

        h.SM.addSample('soil', { label: 'Green 1', values: LAB_VALUES });
        // The switch happens before any promise resolves — the request is
        // assembled, but nothing has come back.
        h.SM.setActiveSite(SITE_B);
        await h.settle();

        const creates = h.writes().filter((w) => w.method === 'POST');
        expect(creates.length).toBe(1);
        expect(creates[0].body.site_id).toBe(SITE_A);
    });

    /**
     * The test above proves one half and was measured to prove only that half.
     *
     * Self-check before delivery: moving the site read from the event into the
     * REQUEST (`site_id: getActiveSiteId()` inside the promise) turns it red,
     * which is the defect it exists for. Moving the read to the top of the
     * HANDLER does not, and cannot: the event is dispatched synchronously from
     * the mutation, so the pointer has not moved yet when the listener runs.
     * That mutation preserves behaviour rather than escaping the test.
     *
     * What neither version proves is the rule itself — that the event's word
     * beats the pointer's. This one states it directly: the two disagree, and
     * the request has to follow the event.
     */
    test('the site in the event wins over the active-site pointer', async () => {
        const h = buildHarness();
        await h.settle();
        h.SM.setActiveSite(SITE_A);
        h.SM.addSample('soil', { label: 'Green 1', values: LAB_VALUES });
        await h.settle();
        h.state.requests.length = 0;

        expect(h.SM.getActiveSiteId()).toBe(SITE_A);
        h.doc.dispatchEvent(new CustomEvent('gaip:sample-added', {
            detail: {
                dataType: 'soil',
                sampleId: 'green_1',
                siteId: SITE_B,
                sample: { id: 'green_1', label: 'Green 1', zoneType: 'green', source: 'manual', rawData: LAB_VALUES },
            },
        }));
        await h.settle();

        const creates = h.writes().filter((w) => w.method === 'POST');
        expect(creates.length).toBe(1);
        expect(creates[0].body.site_id).toBe(SITE_B);
    });
});

describe('GH-533 — what must not be sent', () => {
    test('no request body from this file contains allSites', async () => {
        const h = buildHarness({ samples: [serverSample()] });
        await h.settle();

        h.SM.addSample('soil', { label: 'Green 2', values: LAB_VALUES });
        h.SM.setZoneType('soil', 'green_1', 'tee');
        h.SM.deleteSample('soil', 'green_1');
        h.SM.clearSamples('soil');
        await h.settle();

        expect(h.state.requests.length).toBeGreaterThan(0);
        h.state.requests.forEach((r) => {
            expect(JSON.stringify(r.body || {})).not.toContain('allSites');
            expect(r.url).not.toMatch(/samples\/sync/);
        });
    });

    test('switching sites sends nothing', async () => {
        const h = buildHarness({ samples: [serverSample()] });
        await h.settle();
        h.state.requests.length = 0;

        h.SM.setActiveSite(SITE_B);
        h.SM.setActiveSite(SITE_A);
        await h.settle();

        expect(h.writes()).toEqual([]);
    });

    test('the migration announcing itself as an update sends nothing', async () => {
        const h = buildHarness({ samples: [serverSample()] });
        await h.settle();
        h.state.requests.length = 0;

        // sample-manager.js's b35fix411 migration raises this on page load,
        // once per stale sample. Without the `reason` guard, opening a page
        // would PATCH every one of them, every time.
        h.doc.dispatchEvent(new CustomEvent('gaip:sample-updated', {
            detail: { dataType: 'soil', sampleId: 'green_1', siteId: SITE_A, reason: 'b35fix411-migration' },
        }));
        await h.settle();

        expect(h.writes()).toEqual([]);
    });

    test('a viewer who may not edit the site sends nothing at all', async () => {
        const h = buildHarness({ canEdit: false, samples: [serverSample()] });
        await h.settle();
        h.state.requests.length = 0;

        h.SM.addSample('soil', { label: 'Green 9', values: LAB_VALUES });
        h.SM.setZoneType('soil', 'green_1', 'tee');
        h.SM.deleteSample('soil', 'green_1');
        await h.settle();

        expect(h.writes()).toEqual([]);
    });
});

describe('GH-533 — a refused write is visible', () => {
    test('a 403 marks the record and raises an error event, and does not remove it from the store', async () => {
        const h = buildHarness({ fail: (method) => method === 'POST' });
        await h.settle();
        h.SM.setActiveSite(SITE_A);

        const errors = [];
        h.doc.addEventListener('gaip:samples-persistence-error', (e) => errors.push(e.detail));

        h.SM.addSample('soil', { label: 'Green 1', values: LAB_VALUES });
        await h.settle();

        expect(errors.length).toBe(1);
        expect(errors[0].op).toBe('create');
        expect(errors[0].sampleId).toBe('green_1');
        expect(errors[0].status).toBe(403);

        const sample = h.SM.getSample('soil', 'green_1');
        expect(sample).not.toBeNull();
        expect(sample._dirty.op).toBe('create');
        expect(sample.serverId).toBeUndefined();
    });
});

/**
 * GH-378 — a cross-site Combined export blanked the soil section of the first
 * sample after every site switch ("No soil test data - MLSN recommendations
 * estimated", no Annual Nutrient Requirements row) while the data sat in the
 * DB. This is the mechanism the REVIEW's open question 8 (Burns "Rye Nursery"
 * K=7.6 / "12th Fairway" K=195) turned out to be.
 *
 * Mechanism, traced live with a value-setter hook on the `[data-mlsn="K"]`
 * input and a stack hook on document.dispatchEvent (see the GH-378 changelog
 * entry for the run):
 *
 *   t+0     word-export-combined.js: sm.setActiveSite(B)
 *             -> sample-manager.js dispatches gaip:site-changed #1
 *             -> gaip-clear-data.js clears the soil/water inputs (fine, the
 *                sample is not loaded yet)
 *             -> site-selector-ui.js's listener returns early
 *                (GAIP_COMBINED_EXPORT_ACTIVE) WITHOUT updating its private
 *                _lastDispatchedSiteId shadow
 *             -> site-config-persistence.js schedules restoreNewSiteConfig(B)
 *   t+1     sm.loadSample('soil', <sample>) populates the inputs (K = 7.6)
 *   t+300   restoreNewSiteConfig(B) runs, schedules gaip:site-config-applied
 *   t+450   gaip:site-config-applied
 *             -> site-selector-ui.js updateUI(): active site B !==
 *                _lastDispatchedSiteId (still A) -> dispatches a DUPLICATE
 *                gaip:site-changed for B
 *             -> gaip-clear-data.js clears the inputs AGAIN -> K = ""
 *   t+~8s   collectData(): DOM fallback finds nothing -> soil.hasData unset
 *
 * The fix (site-selector-ui.js): the gaip:site-changed listener records the
 * announced site into _lastDispatchedSiteId before its export early-return,
 * so updateUI() never re-announces a switch SampleManager already announced.
 * updateUI()'s own dispatch is kept -- it is still the only announcement on
 * the page-load restore path (restoreFromPersistence() switches silently).
 *
 * These tests load the REAL sample-manager.js (the dispatcher whose
 * "announce only when changed" rule matters), the REAL site-selector-ui.js
 * and the REAL gaip-clear-data.js on a small fake DOM with a working event
 * bus, and replay the export loop's exact ordering above. Same loading
 * convention as gh372's test (manual window/document stubs, node test env).
 *
 * Manual red check against the pre-fix module:
 *   git show a1ec2d6:assets/site-selector-ui.js > /tmp/ssu-prefix.js
 *   GH378_SITE_SELECTOR_PATH=/tmp/ssu-prefix.js npx jest tests/gh378
 * (the export-ordering and top-bar tests fail there, the page-load one passes).
 */

'use strict';

const path = require('path');

const SITE_SELECTOR_PATH = process.env.GH378_SITE_SELECTOR_PATH
    ? path.resolve(process.env.GH378_SITE_SELECTOR_PATH)
    : path.resolve(__dirname, '../assets/site-selector-ui.js');

const SITE_A = 'site_a_uuid';
const SITE_B = 'site_b_uuid';

/** Minimal element: value, event target, container queries over `children`. */
function makeElement(overrides) {
    const listeners = {};
    const el = {
        value: '',
        style: {},
        children: [],
        classList: { add() {}, remove() {}, contains() { return false; }, toggle() {} },
        addEventListener(type, fn) { (listeners[type] = listeners[type] || []).push(fn); },
        removeEventListener(type, fn) { listeners[type] = (listeners[type] || []).filter((f) => f !== fn); },
        dispatchEvent(ev) { (listeners[ev.type] || []).slice().forEach((fn) => fn.call(el, ev)); return true; },
        setAttribute() {}, getAttribute() { return null; },
        appendChild(child) { el.children.push(child); return child; },
        insertBefore() {}, remove() {},
        querySelector(sel) { return el.children.find((c) => c.matches(sel)) || null; },
        querySelectorAll(sel) { return el.children.filter((c) => c.matches(sel)); },
        matches(sel) { return (el.selectors || []).indexOf(sel) !== -1; },
        parentNode: null,
        options: [],
        selectedIndex: 0,
    };
    return Object.assign(el, overrides || {});
}

/**
 * Fake document: a registry of selector -> element plus a real event bus.
 * Both modules under test only ever reach the DOM through querySelector /
 * querySelectorAll / getElementById / createElement / add|dispatchEvent.
 */
function makeDocument(registry) {
    const listeners = {};
    const created = [];   // elements the modules build themselves (site bar, its <select>, badge)
    return {
        readyState: 'complete',
        body: makeElement({ contains() { return false; } }),
        addEventListener(type, fn) { (listeners[type] = listeners[type] || []).push(fn); },
        removeEventListener(type, fn) { listeners[type] = (listeners[type] || []).filter((f) => f !== fn); },
        dispatchEvent(ev) {
            (listeners[ev.type] || []).slice().forEach((fn) => fn.call(this, ev));
            return true;
        },
        querySelector(sel) { return registry[sel] || null; },
        querySelectorAll(sel) { return registry[sel] ? [registry[sel]] : []; },
        // updateUI() only reaches its dispatch once the site bar it builds in
        // inject() is findable by id, so ids assigned by the modules resolve too.
        getElementById(id) { return registry['#' + id] || created.find((e) => e.id === id) || null; },
        createElement() { const el = makeElement(); created.push(el); return el; },
    };
}

function buildHarness() {
    jest.useFakeTimers();
    jest.resetModules();

    // The soil grid holds one MLSN input (K); gaip-clear-data.js clears every
    // `input[type="number"]` inside `.gaip-soil-grid`, site-selector-ui.js's
    // clearSoilForm() clears `input[data-mlsn]` inside the same grid.
    const kInput = makeElement({ selectors: ['input[type="number"]', 'input[data-mlsn]', '[data-mlsn="K"]'] });
    const soilGrid = makeElement({ selectors: ['.gaip-soil-grid'] });
    soilGrid.appendChild(kInput);
    // PHP-rendered top-bar site <select>, the real user's switch surface.
    const selectTop = makeElement({ selectors: ['#gaip-site-select-top'] });
    // An injection anchor, so inject() actually builds the site bar (updateUI()
    // returns before its dispatch while `#gaip-site-select` does not exist).
    const anchor = makeElement({ selectors: ['#gaip-hub-container'], parentNode: makeElement() });

    const registry = {
        '.gaip-soil-grid': soilGrid,
        '[data-mlsn="K"]': kInput,
        '#gaip-site-select-top': selectTop,
        '#gaip-hub-container': anchor,
    };

    global.window = {};
    global.document = makeDocument(registry);
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

    const siteChanged = [];
    global.document.addEventListener('gaip:site-changed', (e) => {
        siteChanged.push((e.detail && e.detail.siteId) || null);
        if (process.env.GH378_DEBUG) console.log('[gh378 dispatch]', e.detail && e.detail.siteId, new Error().stack.split('\n').slice(2, 8).join('\n'));
    });

    require('../assets/sample-manager.js');
    require(SITE_SELECTOR_PATH);
    require('../assets/gaip-clear-data.js');
    // Both UI modules register their listeners from a deferred init()
    // (setTimeout 200 / 500 when readyState is already 'complete').
    jest.advanceTimersByTime(2000);

    const SM = global.window.GAIP_SampleManager;
    SM.addSiteWithId(SITE_A, 'Site A');
    SM.addSiteWithId(SITE_B, 'Site B');
    SM.setActiveSite(SITE_A);
    // Flush the reloadActiveSample() timers the setup switches scheduled, so a
    // test only ever sees the timers its own actions create.
    jest.advanceTimersByTime(1000);
    siteChanged.length = 0; // discard the harness's own setup switches

    return { SM, kInput, selectTop, siteChanged, doc: global.document };
}

afterEach(() => {
    jest.clearAllTimers();
    jest.useRealTimers();
});

describe('GH-378 — Combined export cross-site switch is announced exactly once', () => {
    test('the export loop ordering: switch, load sample, config-applied -> the loaded soil value survives', () => {
        const h = buildHarness();
        global.window.GAIP_COMBINED_EXPORT_ACTIVE = true;

        // t+0: word-export-combined.js switches to the sample's own site.
        expect(h.SM.setActiveSite(SITE_B)).toBe(true);
        expect(h.siteChanged).toEqual([SITE_B]);          // announced once, by SampleManager
        expect(h.kInput.value).toBe('');                  // gaip-clear-data cleared the stale grid -- fine

        // t+1: sm.loadSample('soil', ...) populates the inputs.
        h.kInput.value = '7.6';

        // t+450: site-config-persistence.js's restoreNewSiteConfig() announces
        // that the arriving site's config has been applied.
        h.doc.dispatchEvent(new CustomEvent('gaip:site-config-applied', { detail: { siteId: SITE_B, source: 'site-switch' } }));

        // Pre-fix: updateUI() re-dispatched gaip:site-changed here and the grid
        // was wiped before collectData() ever ran.
        expect(h.siteChanged).toEqual([SITE_B]);
        expect(h.kInput.value).toBe('7.6');

        // A second sample on the same site: SampleManager announces nothing,
        // nothing clears (this is the case that always worked, kept pinned).
        h.kInput.value = '195';
        expect(h.SM.setActiveSite(SITE_B)).toBe(true);
        h.doc.dispatchEvent(new CustomEvent('gaip:site-config-applied', { detail: { siteId: SITE_B, source: 'site-switch' } }));
        expect(h.siteChanged).toEqual([SITE_B]);
        expect(h.kInput.value).toBe('195');

        global.window.GAIP_COMBINED_EXPORT_ACTIVE = false;
    });

    test('after the export restores the original site, the next real switch is still announced', () => {
        const h = buildHarness();
        global.window.GAIP_COMBINED_EXPORT_ACTIVE = true;
        h.SM.setActiveSite(SITE_B);
        global.window.GAIP_COMBINED_EXPORT_ACTIVE = false;
        h.SM.setActiveSite(SITE_A);   // the loop's finally{} restore
        expect(h.siteChanged).toEqual([SITE_B, SITE_A]);

        h.siteChanged.length = 0;
        h.SM.setActiveSite(SITE_B);
        expect(h.siteChanged).toEqual([SITE_B]);
    });
});

describe('GH-378 — the announcements that must NOT regress', () => {
    test('page-load restore path: SampleManager switches silently, updateUI() is still the one announcement', () => {
        const h = buildHarness();
        // restoreFromPersistence() sets the current site without any event;
        // sample-persistence.js then calls setActiveSite(<same site>), which
        // announces nothing. site-selector-ui.js's gaip:samples-restored
        // listener is what tells the rest of the page (b35fix98).
        h.SM.restoreFromPersistence({
            sites: { [SITE_A]: { label: 'Site A' }, [SITE_B]: { label: 'Site B' } },
            allSites: { [SITE_A]: { soil: {}, water: {}, tissue: {}, loi: {} }, [SITE_B]: { soil: {}, water: {}, tissue: {}, loi: {} } },
            allActive: {}, allMeta: {}, currentSite: SITE_B,
        });
        h.SM.setActiveSite(SITE_B);
        expect(h.siteChanged).toEqual([]);

        h.doc.dispatchEvent(new CustomEvent('gaip:samples-restored', { detail: { count: 0, site: SITE_B } }));
        expect(h.siteChanged).toEqual([SITE_B]);

        // ...and the follow-up site-config-applied does not double it.
        h.doc.dispatchEvent(new CustomEvent('gaip:site-config-applied', { detail: { siteId: SITE_B, restored: true } }));
        expect(h.siteChanged).toEqual([SITE_B]);
    });

    test('top-bar user switch: announced exactly once, and the arriving site\'s samples are still reloaded', () => {
        const h = buildHarness();
        h.selectTop.value = SITE_B;
        h.selectTop.dispatchEvent({ type: 'change' });

        expect(h.SM.getActiveSiteId()).toBe(SITE_B);
        // Pre-fix this was [SITE_B, SITE_B]: SampleManager's announcement plus
        // updateUI()'s re-announcement of the same switch.
        expect(h.siteChanged).toEqual([SITE_B]);

        // The listener's deferred reloadActiveSample() still fires for a real switch.
        const ready = [];
        h.doc.addEventListener('gaip:site-samples-ready', (e) => ready.push(e.detail.siteId));
        jest.advanceTimersByTime(300);
        expect(ready).toEqual([SITE_B]);
    });

    test('top-bar re-select of the SAME site still forces one announcement (refresh semantics)', () => {
        const h = buildHarness();
        h.selectTop.value = SITE_A;   // already active -> SampleManager announces nothing
        h.selectTop.dispatchEvent({ type: 'change' });
        expect(h.siteChanged).toEqual([SITE_A]);
    });
});

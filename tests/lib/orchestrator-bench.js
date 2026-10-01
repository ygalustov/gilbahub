'use strict';

/**
 * THE ORCHESTRATOR, LOADED THE WAY /hub LOADS IT.
 *
 * WHY THIS EXISTS. The open question was why Federal Golf's Re-run produced a row
 * with no disease, stress or forecast in it. That is a question about what RAN,
 * and it cannot be answered by reading: the orchestrator's steps are gated, the
 * gates read state that other steps fill, and the difference between "the engine
 * returned nothing" and "the engine was never called" is invisible in the stored
 * row — both leave `null`. So the engines get run.
 *
 * WHAT IT DOES. Loads every script `/hub` loads, in the order
 * `hub.blade.php` lists them, up to and including `hub-orchestrator.js`, into one
 * `vm` context with a DOM stub. Nothing reaches the network: `fetch` rejects, and
 * a bench run that needs weather is given it as data.
 *
 * WHAT IT IS NOT. Not a live test — nothing here opens a browser or touches the
 * stand. Not a replacement for one either: a context with a stubbed DOM is not a
 * page, and a step that needs a real element behaves differently here. Every
 * claim made with this bench says which of the two it is.
 *
 * The positive control belongs to the caller and is not optional: `load()`
 * reports the scripts that threw, and a bench where something failed to load is
 * a bench whose green answers mean "nothing ran".
 */

const vm = require('vm');
const { realReadingsOf } = require('./sample-readings');
const fs = require('fs');
const path = require('path');

const ROOT = path.join(__dirname, '..', '..');
const ASSETS = path.join(ROOT, 'assets');

/**
 * Every script /hub loads, in its order.
 *
 * ALL of them, not "up to the orchestrator" — which is what this did first, and
 * it was wrong in a way that quietly changed what the bench measured.
 * `engine-confidence.js` is listed at 110 and the orchestrator at 108, so a
 * bench that stopped at the orchestrator ran `computeAll` without a module the
 * real page has by then, and the pass died on `getConfidenceSummary` BEFORE
 * dispatching its completion event. Every claim about that event was measuring
 * the bench's own truncation.
 *
 * The page loads these with `defer`, so order is preserved and all of them are
 * present before anything runs.
 */
function hubScripts() {
    const blade = fs.readFileSync(path.join(ROOT, 'app/resources/views/hub.blade.php'), 'utf8');
    const block = blade.match(/\$hubScripts\s*=\s*\[([\s\S]*?)\n\s*\];/);
    if (!block) throw new Error('hub.blade.php no longer declares $hubScripts — the bench cannot know what /hub loads');
    const names = [...block[1].matchAll(/'([^']+\.js)'/g)].map((m) => m[1]);
    if (names.indexOf('hub-orchestrator.js') < 0) throw new Error('hub.blade.php no longer loads hub-orchestrator.js');
    return names;
}

function stubElement() {
    return {
        style: {}, dataset: {},
        classList: { add() {}, remove() {}, contains: () => false, toggle() {} },
        textContent: '', innerHTML: '', value: '', checked: false, hidden: false,
        addEventListener() {}, removeEventListener() {}, appendChild() {}, removeChild() {},
        setAttribute() {}, getAttribute: () => null,
        querySelector: () => null, querySelectorAll: () => [],
        closest: () => null, remove() {}, insertAdjacentHTML() {},
        getBoundingClientRect: () => ({ top: 0, left: 0, width: 0, height: 0 }),
    };
}

function makeSandbox() {
    const listeners = {};
    const s = {
        console: { log() {}, warn() {}, error() {}, info() {}, debug() {}, table() {}, group() {}, groupEnd() {} },
        setTimeout: () => 0, clearTimeout() {}, setInterval: () => 0, clearInterval() {},
        requestAnimationFrame: () => 0,
        Date, Math, JSON, Object, Array, String, Number, Boolean, RegExp, Error, Map, Set, WeakMap,
        parseFloat, parseInt, isNaN, isFinite, Promise, Intl,
        encodeURIComponent, decodeURIComponent,
        // Nothing in a bench run may reach the network. A step that needs
        // weather is handed it as data, so that what is measured is the step
        // and not the internet.
        fetch: () => Promise.reject(new Error('the bench has no network')),
        URLSearchParams: require('url').URLSearchParams,
        localStorage: { getItem: () => null, setItem() {}, removeItem() {}, key: () => null, length: 0 },
        performance: { now: () => Date.now() },
        navigator: { userAgent: 'orchestrator-bench' },
        CustomEvent: class { constructor(t, i) { this.type = t; this.detail = i && i.detail; } },
        Event: class { constructor(t) { this.type = t; } },
        // Part of the DOM, not of the calculation: `confidence-ui-integration.js`
        // watches the page for elements to decorate. Stubbed so the bench can
        // load the whole page rather than a prefix of it — a truncated bench
        // measures its own truncation.
        MutationObserver: class { observe() {} disconnect() {} takeRecords() { return []; } },
    };
    s.sessionStorage = s.localStorage;
    s.document = {
        readyState: 'complete',
        addEventListener(t, f) { (listeners[t] = listeners[t] || []).push(f); },
        removeEventListener() {},
        dispatchEvent(e) { (listeners[e.type] || []).forEach((f) => { try { f(e); } catch (x) { /* a stub DOM is not a page */ } }); return true; },
        getElementById: () => null,
        querySelector: () => null,
        querySelectorAll: () => [],
        createElement: stubElement,
        createTextNode: () => ({}),
        body: stubElement(),
        head: stubElement(),
        documentElement: stubElement(),
    };
    s.window = s; s.global = s; s.globalThis = s; s.self = s;
    /**
     * GH-681: THE BENCH IS HANDED THE DEPENDENCY GRAPH, because the page is.
     *
     * The cascade adapter's engine list used to be written inside the adapter; it comes from
     * `window.GAIP_DEPENDENCY_GRAPH` now, and given nothing the adapter REFUSES the pass
     * rather than running an empty one. A bench that stands in for the page has to give what
     * the page gives — the alternative is a bench measuring the absence of its own setup.
     * Found by the gate's first full run: six suites went red at once, all of them here.
     */
    /**
     * GH-782 (queue item 3ga) - THE SITE'S METHODOLOGY, because a site without one cannot exist.
     *
     * The owner settled on 24.09.2026 that methodology is a required field: the setup wizard cannot be closed
     * without it and no calculation runs for a site until then. The soil engine now computes NOTHING when it is
     * absent, instead of falling into the SLAN table - which is the defect of this item: the converter dropped
     * the field, every ammonium-acetate site was computed by the wrong table, and the row still declared AA. So a
     * bench with no methodology describes a site the product does not allow, and it supplies one here. A case
     * about a particular methodology sets its own.
     */
    s.GAIP_HUB_CONFIG = { gaipConfig: { turf: { methodology: 'slan' } } };

    s.GAIP_DEPENDENCY_GRAPH = JSON.parse(require('fs').readFileSync(
        require('path').join(__dirname, '..', '..', 'assets', 'dependency-graph.json'), 'utf8'));
    // GH-722: and the lab reading names, for the same reason — the sample manager builds its
    // spelling tables from what the page is handed, and given nothing it reads no sample.
    s.GAIP_LAB_READING_NAMES = JSON.parse(require('fs').readFileSync(
        require('path').join(__dirname, '..', '..', 'assets', 'lab-reading-names.json'), 'utf8'));
    s.location = { href: 'http://localhost/hub', search: '', origin: 'http://localhost', hostname: 'localhost' };
    return s;
}

/**
 * @returns {{ctx: object, sandbox: object, failed: string[], said: string[]}}
 *   `failed` — scripts that threw while loading. `said` — everything the run
 *   wrote to the console, which is the only place the orchestrator's warnings go.
 */
/**
 * GH-626: an optional hook, so a caller can reach a function the module keeps
 * to itself.
 *
 * `cacheAnalysisResults` is internal to `hub-persistence.js` and is the one
 * place that builds the stored row's soil surface — the thing the restoration
 * judge has to measure. Eleven other files expose it by rewriting the module's
 * own export line before executing it; this lets the bench do the same without
 * every caller re-reading and re-running the whole of `/hub`.
 *
 * Default behaviour is unchanged: no `expose`, no rewriting, and the four sets
 * already using this bench see exactly what they saw.
 */
function load(options) {
    const expose = (options && options.expose) || {};
    const sandbox = makeSandbox();
    const said = [];
    sandbox.console.warn = (...a) => said.push('WARN ' + a.map(String).join(' '));
    sandbox.console.error = (...a) => said.push('ERR  ' + a.map(String).join(' '));

    const ctx = vm.createContext(sandbox);
    const failed = [];
    hubScripts().forEach((name) => {
        const file = path.join(ASSETS, name);
        if (!fs.existsSync(file)) { failed.push(name + ': missing from assets/'); return; }
        try {
            let src = fs.readFileSync(file, 'utf8');
            if (expose[name]) src = expose[name](src);
            vm.runInContext(src, ctx, { filename: name });
        } catch (e) {
            failed.push(name + ': ' + String(e && e.message).slice(0, 120));
        }
    });

    return { ctx, sandbox, failed, said };
}

/**
 * Run `computeAll` with the inputs a site would have.
 *
 * `climateMetrics` is the global `populateCanonicalState` reads; passing it is
 * how a run reaches the steps that need weather without any.
 */
async function computeAll(bench, inputs) {
    const { ctx } = bench;
    const o = inputs || {};

    if (o.climateMetrics) {
        ctx.climateMetrics = o.climateMetrics;
        ctx.rawWeatherData = o.rawWeatherData || { _weatherStatus: 'live', forecast: { hourly: {} } };
    }
    ctx.GAIP_STATE = Object.assign({
        climate: o.climateMetrics || {},
        turf: o.turf || {},
        site: o.site || {},
        soil: {}, water: {}, tissue: {}, schedule: {}, pgr: {},
    }, o.state || {});

    let threw = null;
    try {
        await ctx.GaipOrchestrator.computeAll();
    } catch (e) {
        // A bench run can die downstream of the step being measured — the
        // confidence summary needs a page. The caller decides whether that
        // matters for its claim, so it is reported rather than swallowed.
        threw = e && e.message;
    }

    return { state: ctx.GaipOrchestrator.getState(), threw, said: bench.said };
}

/**
 * GH-727: GIVE THE BENCH THE SITE'S ROW, the way the page has one.
 *
 * `GAIP_SiteConfig` fills its rows from the server, and nothing here reaches the network, so `getSite`
 * answers null for every id. That did not matter while the region of a pass came off the page's
 * coordinate fields with `"au"` behind them. It does now: the pre-emergent builder asks
 * `detectRegionForSite(activeSiteId())`, and a site with no row has no place, which the pass declares
 * as a gap. A bench without a row therefore measures its own missing setup — so the callers that need
 * a site to exist say so with this, and the row's coordinates are visible in the test that sets them.
 *
 * @param {object} bench  the loaded bench
 * @param {{id: string, latitude: number, longitude: number}} row  the site row the server would send
 */
/**
 * GH-790 (queue item 9): THE SITE'S OWN CONFIG, as the server gives it to the page, and THE FIELDS OF THE
 * `/hub` MARKUP, separately.
 *
 * The two used to be one thing: the run read the markup, and the markup was refilled from a snapshot in the
 * browser. A case about which of them wins has to be able to set them to different values, which is what
 * these two do. `fields` is keyed by selector, exactly as the assembly asks for them.
 */
function withSiteConfig(bench, siteId, config) {
    const { ctx } = bench;
    if (!siteId) throw new Error('withSiteConfig needs a site id — a config that answers for nobody is not a config');
    if (!ctx.GAIP_SiteConfig) throw new Error('the bench has no GAIP_SiteConfig: the page did not load');
    const before = ctx.GAIP_SiteConfig.getConfig;
    ctx.GAIP_SiteConfig.getConfig = (id) => (id === siteId ? config : (before ? before(id) : null));
    ctx.GAIP_HUB_CONFIG = Object.assign({}, ctx.GAIP_HUB_CONFIG, { activeSiteId: siteId });
    if (ctx.GAIP_SampleManager) ctx.GAIP_SampleManager.getActiveSiteId = () => siteId;

    return bench;
}

/** A `/hub` root whose fields hold what a case says they hold, and nothing else. */
function pageWithFields(fields) {
    const map = fields || {};

    return {
        querySelector: (sel) => {
            if (!Object.prototype.hasOwnProperty.call(map, sel)) return null;
            const v = map[sel];

            return { value: v, checked: v === true, dataset: {}, type: 'text' };
        },
        querySelectorAll: () => [],
    };
}

function withSiteRow(bench, row) {
    const { ctx } = bench;
    if (!row || !row.id) throw new Error('withSiteRow needs a row with an id — a bench site without one answers for nobody');
    if (ctx.GAIP_SiteConfig) ctx.GAIP_SiteConfig.getSite = (id) => (id === row.id ? row : null);
    ctx.GAIP_HUB_CONFIG = Object.assign({}, ctx.GAIP_HUB_CONFIG, { activeSiteId: row.id });
    if (ctx.GAIP_SampleManager) ctx.GAIP_SampleManager.getActiveSiteId = () => row.id;

    return bench;
}

/**
 * GH-777 (queue item 4, slice 3): GIVE THE BENCH THE SAMPLES THE RUN WAS GIVEN.
 *
 * Nodes declare requirements of the "sample key" kind now -- `samples.soil` for MLSN, `samples.tissue` for
 * the tissue engine -- and the gate asks `gaip_sampleReadings`, which asks the sample manager. A bench with
 * no manager is a site with no samples, so those engines are correctly not run; a case whose subject is
 * what one of them PRODUCES therefore has to say which samples the run had, out loud, here.
 *
 * `rows` is keyed by kind: `{ soil: { id, serverId, rawData }, tissue: {...} }`. The normaliser is the
 * product's own (`realReadingsOf`), so the reading names are the sample manager's and not a bench's
 * invention.
 *
 * GH-777: A NAMED SAMPLE IS FOUND BY ITS ROW ID, which the store keeps in `serverId` while `id` holds the
 * client store's own key (`client_uid`, a label, else `sample_<id>`). A caller that wants a sample to be
 * findable by name gives it a `serverId`; nothing is invented here, so a row without one is simply not
 * found by name — which is what the product does.
 *
 * @param {object} bench  the loaded bench
 * @param {Object<string,{id: string, rawData: object}>} rows  the samples this run was given, by kind
 */
function withSamples(bench, rows) {
    const store = rows || {};
    bench.ctx.GAIP_SampleManager = {
        /**
         * GH-796 (queue item 3vyu) — THE STUB ANSWERS THE CALCULATION'S QUESTION TOO, because the product's
         * manager now does and a stub that lags behind makes the bench measure the absence of its own setup.
         *
         * The contract is the real one's, minus the half a bench has no server for: in a run frame the
         * address answers, through the frame's own chooser; with nothing named, the real function asks the
         * server, and here there is none -- so the answer is "no sample", never the one the page has open.
         * A bench case that wants a sample computed therefore names it on the address, which is what a run
         * frame does.
         */
        calculationSample: (kind) => {
            const chooser = bench.ctx.gaip_namedSample;
            if (typeof chooser !== 'function') return null;
            const told = chooser(kind);
            if (told === 'none' || told === 'unknown' || told === 'not-found') return null;

            return told || null;
        },
        readingsOf: realReadingsOf(),
        getSamples: (kind) => (store[kind] ? [store[kind]] : []),
        getActiveSample: (kind) => store[kind] || null,
        getActiveSampleId: (kind) => (store[kind] ? store[kind].id : null),
        getAllSamples: () => ({ allSites: {}, allActive: {}, allMeta: {}, sites: {} }),
        getActiveSiteId: () => 'site-1',
    };

    return bench;
}

module.exports = { load, computeAll, hubScripts, makeSandbox, withSiteRow, withSamples,
    withSiteConfig, pageWithFields };

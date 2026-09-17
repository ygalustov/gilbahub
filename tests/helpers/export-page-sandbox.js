/**
 * The export page in a sandbox — shared by the smoke test and the provenance
 * guard (PLAN-GH439 sections 10.6 and 10.10).
 *
 * Loading the page's real modules in the page's own order is fiddly enough
 * that two copies would drift: the libraries need working timers at load time
 * while the page modules need inert ones, JSZip needs setImmediate and a
 * FileReader, and the export's error handler calls alert(). All of it was
 * measured rather than assumed, and each line says which failure it answers.
 */
'use strict';

const fs = require('fs');
const path = require('path');
const vm = require('vm');

const ASSETS = path.join(__dirname, '..', '..', 'assets');
const BLADE = path.join(__dirname, '..', '..', 'app', 'resources', 'views', 'reports', 'export.blade.php');
const FIXTURE = JSON.parse(fs.readFileSync(path.join(__dirname, '..', 'fixtures', 'e2e-parity-test5-soccer.json'), 'utf8'));

/**
 * The real shape of the page's own state, captured once from a live run.
 *
 * The poisoning below answers Object.keys() from this. Without it the proxy
 * reported no own keys at all, so code that copies a result by ENUMERATION
 * copied nothing — and a copy of nothing looks exactly like a read that never
 * happened. The reviewer's mutation went that way and only the static guard
 * caught it, which made the dynamic half depend on the static one.
 *
 * Its limit is recorded rather than implied: a shape that is not in this
 * fixture still enumerates as empty, and that case belongs to the static
 * reader. The fixture is a list, so its completeness is checked against the
 * page-state roots.
 */
const PAGE_STATE_SHAPES = JSON.parse(fs.readFileSync(
    path.join(__dirname, '..', 'fixtures', 'page-state-shapes.json'), 'utf8'));

const SITE_ID = FIXTURE.site.id;
/** The other site every store carries, so that a choice by key is observable. */
const OTHER_SITE_ID = 'other-site-so-the-choice-is-visible';

/**
 * The coordinates of the two sites, in one place, because three things are
 * keyed by them: the site row, the config's copy of the location, and the
 * climate normals store below.
 */
const SITE_LAT = -36.8508827;
const SITE_LON = 174.7644881;
const OTHER_SITE_LAT = -33.8688;
const OTHER_SITE_LON = 151.2093;

/**
 * The key the climate normals service files a resolved row under, copied from
 * assets/climate-normals-service.js (`coordKey`). A test asserts the two are
 * still the same expression: a stub keyed differently from the service is a
 * stub that answers null to every call the product makes.
 */
function coordKey(lat, lon) {
    return lat.toFixed(2) + ',' + lon.toFixed(2);
}

/**
 * Twelve monthly normals for each site. They differ in EVERY month and share
 * no value at all, so a report carrying the wrong site's climate says so in
 * each of its twelve numbers rather than in some of them.
 */
const MONTHLY_TEMPS_FIXTURE = [18.5, 18.7, 17.4, 15.2, 12.8, 10.6, 9.8, 10.5, 12.1, 13.9, 15.6, 17.4];
const MONTHLY_TEMPS_DECOY = [22.8, 22.9, 21.6, 19.3, 15.9, 13.4, 12.5, 13.8, 16.4, 18.6, 20.1, 21.8];
const SITE_NAME = FIXTURE.site.name;
const SAMPLE_LABEL = FIXTURE.soilSample.label;

/**
 * Modules on the export page that this sandbox does not load, each with the
 * reason. The list is asserted against the page's own script array below, so a
 * module added to the page and not to this test fails rather than quietly
 * sitting outside the smoke test.
 */
const NOT_LOADED = {
    'sample-persistence.js': 'binds window listeners at load; the sample data it would provide is stubbed here by id'
};

const noop = () => {};

function stubEl() {
    const el = {
        style: {}, dataset: {}, options: [], children: [], value: '', textContent: '',
        innerHTML: '', innerText: '', checked: false, href: '', download: '',
        classList: { add: noop, remove: noop, contains: () => false, toggle: noop },
        appendChild: noop, removeChild: noop, insertBefore: noop, remove: noop,
        addEventListener: noop, removeEventListener: noop, dispatchEvent: noop,
        setAttribute: noop, getAttribute: () => null, removeAttribute: noop,
        querySelector: () => null, querySelectorAll: () => [], closest: () => null,
        insertAdjacentHTML: noop, focus: noop, blur: noop, click: noop,
        getContext: () => null, toDataURL: () => ''
    };
    return el;
}

/** The page's own script list, in the page's own order. */
function hubScripts() {
    const src = fs.readFileSync(BLADE, 'utf8');
    const m = /\$hubScripts\s*=\s*\[([\s\S]*?)\];/.exec(src);
    if (!m) throw new Error('reports/export.blade.php no longer declares $hubScripts — the smoke test reads the page\'s own list rather than keeping a copy');
    const body = m[1].replace(/\/\/[^\n]*/g, '');
    return (body.match(/'([^']+\.js)'/g) || []).map((q) => q.replace(/'/g, ''));
}

function buildSandbox(record) {
    if (!record.alerts) record.alerts = [];
    const clicked = [];
    const blobs = [];
    /** GH-498: listeners registered on the sandbox's `document`, by type. */
    const docListeners = {};
    const sandbox = {
        console: {
            log: noop, info: noop, debug: noop, group: noop, groupEnd: noop, groupCollapsed: noop, table: noop,
            warn: (...a) => record.warnings.push(a.map(String).join(' ')),
            error: (...a) => record.errors.push(a.map(String).join(' '))
        },
        document: {
            head: stubEl(), body: stubEl(), documentElement: stubEl(), readyState: 'complete', cookie: '',
            getElementById: () => null, querySelector: () => null, querySelectorAll: () => [],
            createElement: (tag) => {
                const el = stubEl();
                el.tagName = String(tag || '').toUpperCase();
                el.click = () => clicked.push({ href: el.href, download: el.download });
                return el;
            },
            createTextNode: () => stubEl(),
            // GH-498: a real listener registry on `document`, because the
            // export's loop now waits for an EVENT — the announcement that the
            // arriving site's configuration has been applied — instead of
            // counting milliseconds. With `dispatchEvent` a no-op, as it was,
            // no event can ever be delivered here and every wait times out.
            // Only what this sandbox itself dispatches is delivered; no page
            // module dispatches anything on this path.
            addEventListener: (type, fn) => {
                if (typeof fn !== 'function') return;
                (docListeners[type] = docListeners[type] || []).push(fn);
            },
            removeEventListener: (type, fn) => {
                const list = docListeners[type];
                if (!list) return;
                const at = list.indexOf(fn);
                if (at >= 0) list.splice(at, 1);
            },
            dispatchEvent: (evt) => {
                const list = (docListeners[evt && evt.type] || []).slice();
                list.forEach((fn) => { try { fn(evt); } catch (e) { /* a listener's own fault */ } });
                return true;
            }
        },
        // Timers are not run: several page modules schedule themselves in a
        // loop, and firing callbacks synchronously turns that into infinite
        // recursion. The export's own path does not need them.
        setTimeout: () => 0,
        clearTimeout: noop, setInterval: () => 0, clearInterval: noop, requestAnimationFrame: () => 0,
        addEventListener: noop, removeEventListener: noop, dispatchEvent: noop,
        Date, Math, JSON, parseFloat, parseInt, isFinite, isNaN, Intl,
        // GH-488: the page has it (every browser this product runs in does),
        // and the export's printing border is built on it.
        structuredClone,
        encodeURIComponent, decodeURIComponent, atob: global.atob, btoa: global.btoa,
        localStorage: { getItem: () => null, setItem: noop, removeItem: noop, clear: noop, key: () => null, length: 0 },
        sessionStorage: { getItem: () => null, setItem: noop, removeItem: noop },
        navigator: { userAgent: 'node', language: 'en' },
        location: { href: 'http://localhost/reports/export', search: '', hostname: 'localhost', protocol: 'http:' },
        fetch: () => Promise.resolve({ ok: true, json: () => Promise.resolve({}), text: () => Promise.resolve('') }),
        CustomEvent: function (t, o) { this.type = t; this.detail = o && o.detail; },
        Event: function (t) { this.type = t; },
        MutationObserver: function () { return { observe: noop, disconnect: noop }; },
        performance: { now: () => Date.now() },
        // The export's own catch handler calls alert(). Without it the sandbox
        // throws "alert is not defined" from inside the handler and buries the
        // error that got there — which is exactly what happened the first time
        // this red proof was run.
        alert: (msg) => record.alerts.push(String(msg)),
        Blob: global.Blob, Uint8Array, ArrayBuffer, Promise, Error, TypeError, RangeError,
        // The packer's pipeline (JSZip) schedules its own work on these. Their
        // absence is why Packer.toBlob() was called and its promise never
        // settled in the first version of this test — measured against a
        // minimal sandbox that differed only by these.
        setImmediate: global.setImmediate, clearImmediate: global.clearImmediate,
        // The export re-opens its own .docx to renumber images
        // (fixDuplicateImageIds), and JSZip reads a Blob through FileReader.
        // Without this the export still produces a file, but logs
        // "Can't read the data of 'the loaded zip file'" — a sandbox gap, not
        // a product fault, and it would otherwise be reported by the
        // console.error assertion as if it were one.
        FileReader: function () {
            this.readAsArrayBuffer = (blob) => {
                blob.arrayBuffer().then((buf) => {
                    this.result = buf;
                    if (typeof this.onload === 'function') this.onload({ target: this });
                }, (err) => { if (typeof this.onerror === 'function') this.onerror(err); });
            };
            this.readAsText = (blob) => {
                blob.text().then((text) => {
                    this.result = text;
                    if (typeof this.onload === 'function') this.onload({ target: this });
                }, (err) => { if (typeof this.onerror === 'function') this.onerror(err); });
            };
        },
        process: { nextTick: process.nextTick.bind(process) },
        TextEncoder: global.TextEncoder, TextDecoder: global.TextDecoder,
        URL: { createObjectURL: (b) => { blobs.push(b); return 'blob:smoke/' + blobs.length; }, revokeObjectURL: noop }
    };
    sandbox.window = sandbox;
    sandbox.self = sandbox;
    sandbox.globalThis = sandbox;
    sandbox.global = sandbox;
    sandbox.top = sandbox;
    sandbox.parent = sandbox;
    return { sandbox: sandbox, clicked: clicked, blobs: blobs };
}

/**
 * Stubs for DATA PROVIDERS only — never for anything inside the export. Each
 * answers for the fixture's site, by id, the way the page's own modules do.
 */
/**
 * GH-471 (PLAN-GH439 section 10.6, tenth refinement) — the stubs are BUILT
 * from the shape the live stores were measured to have.
 *
 * They used to be written from memory and repaired one key at a time, and the
 * two sides were never compared as SETS: readings under `payload` here and
 * `values` live, a site-list row `{id, name}` here and `{id, label, createdAt}`
 * live, `methodologySnapshot` and `soilTextureSnapshot` live and absent here.
 * Each repair was local and neither side was visible. The first repair made it
 * worse — the stub grew `values` AND `payload`, a stub that agrees with any
 * reading, which is the same pliancy `row.name || row.label` had in the
 * product.
 *
 * Now the key set comes from tests/fixtures/store-shapes.json, recorded from a
 * live page, and a test asserts the two sets are equal in both directions. The
 * VALUES stay the fixture's real numbers; only the shape is imported.
 */
const STORE_SHAPES = JSON.parse(fs.readFileSync(
    path.join(__dirname, '..', 'fixtures', 'store-shapes.json'), 'utf8')).shapes;

/**
 * An object with exactly the recorded keys: the caller's values where it has
 * them, and a typed filler where it does not — so a key the live store has is
 * present here too, and code that starts reading it sees the same thing in
 * both places.
 */
/** The empty value of each recorded type — what the primary record fills with. */
function emptyFiller(key, type) {
    return type === 'number' ? 0 : type === 'boolean' ? false : type === 'array' ? []
        : type === 'object' ? {} : type === 'null' ? null : '';
}

/**
 * GH-477: the filler for the DECOY record. It answers the same types, and
 * differs from `emptyFiller` in every one of them, so that two records built
 * from one shape differ at every key the live store ever filled — including
 * the keys neither record was given a value for. `null` is the exception and
 * stays null: the recorder saw nothing else there, so a difference would be a
 * shape this store has never held.
 */
function decoyFiller(key, type) {
    return type === 'number' ? -1 : type === 'boolean' ? true : type === 'array' ? ['decoy-' + key]
        : type === 'object' ? { decoy: key } : type === 'null' ? null : 'decoy-' + key;
}

function shapedAs(shapeName, values, filler) {
    // `answers.<method>` reads the recorded shape of a method's ANSWER; the
    // bookkeeping keys the recorder adds are not part of it.
    const raw = shapeName.indexOf('answers.') === 0
        ? (STORE_SHAPES.answers || {})[shapeName.slice('answers.'.length)]
        : STORE_SHAPES[shapeName];
    const shape = {};
    Object.keys(raw || {}).forEach((k) => { if (k.indexOf('_') !== 0) shape[k] = raw[k]; });
    const out = {};
    const fill = filler || emptyFiller;
    Object.keys(shape).forEach((k) => {
        if (values && Object.prototype.hasOwnProperty.call(values, k)) { out[k] = values[k]; return; }
        out[k] = fill(k, shape[k]);
    });
    return out;
}

/**
 * GH-477: the site-keyed stores of the most recently installed stubs, filled
 * by installDataStubs() and read by the structural test that holds every one
 * of them to the two-record rule.
 */
let KEYED_STORES = [];
/** The climate row store of the most recent install, for the tests about it. */
let CLIMATE_STORE = null;

/**
 * GH-479 (sixteenth refinement, point 2) — the stores are wrapped BEFORE the
 * first page script runs.
 *
 * A module that takes its reference to a store at the top level
 * (`gaip-evidence-ui.js:68`, `sensor-api-specconnect.js`) holds whatever the
 * global was at the moment it loaded. A wrapper put on afterwards is not that
 * object, and those modules call straight past it — so a reconciliation of
 * "what an export reaches" could be missing exactly the callers that took
 * their reference early. Wrapping first closes the case by construction
 * instead of by checking for it.
 *
 * The targets are filled later by installDataStubs(); the binding the page
 * sees never changes.
 */
/**
 * GH-479 (sixteenth refinement) — the page's soil form, in the shape the live
 * page has it.
 *
 * Measured, not assumed: on a live /reports/export `GAIP_STATE.soil` is
 * undefined throughout a real combined export (wrapped `collectData`, one
 * call, `stateSoil: undefined`), and every reading in the document comes from
 * these fields instead — word-export.js's `soilFieldMappings` fallback. Which
 * fields exist is recorded from the page (`soilForm` in store-shapes.json,
 * enumerated from `[data-mlsn]` plus the four the export reads by class), not
 * listed here.
 *
 * Without it the combined document had no Annual Nutrient Requirements and no
 * Monthly N table at all — `_anrEligible` needs `data.soil` — so the entry
 * point a client uses could not be asserted about at all.
 */
const SOIL_FORM_SELECTORS = Object.keys(STORE_SHAPES.soilForm || {});
const SOIL_FORM_BY_CLASS = { '.gaip-soil-ph': 'pH', '.gaip-cec': 'CEC', '.gaip-soil-ec': 'EC', '.gaip-loi': 'OM' };

/** The reading a form field shows: `[data-mlsn="K"]` shows K. */
function soilFieldOf(selector) {
    const attr = /^\[data-mlsn="([^"]+)"\]$/.exec(selector);
    if (attr) return attr[1];
    return SOIL_FORM_BY_CLASS[selector] || null;
}

function installStoreRecorders(sandbox) {
    const targets = { GAIP_SampleManager: {}, GAIP_SiteConfig: {} };
    const reached = [];
    Object.keys(targets).forEach((name) => {
        const target = targets[name];
        const proxy = new Proxy(target, {
            get(t, key) {
                const value = t[key];
                if (typeof value === 'function' && typeof key === 'string') {
                    reached.push(name + '.' + key);
                    return value.bind(t);
                }
                return value;
            },
            set(t, key, value) { t[key] = value; return true; },
            deleteProperty(t, key) { delete t[key]; return true; }
        });
        // The BINDING never changes; what changes is what stands behind it.
        // The page's own module assigns the global as it loads and the stubs
        // assign it again afterwards, and each assignment replaces the
        // contents of the target — the last writer wins, exactly as it did
        // when the global itself was replaced, while every reference anyone
        // took at any moment still points at the wrapper.
        Object.defineProperty(sandbox, name, {
            configurable: true,
            enumerable: true,
            get() { return proxy; },
            set(value) {
                Object.keys(target).forEach((k) => { delete target[k]; });
                if (value) Object.assign(target, value);
            }
        });
    });
    return { targets: targets, reached: reached };
}

function installDataStubs(sandbox) {
    // The form's fields, empty until a sample is loaded into them. A field the
    // sample has no reading for stays empty: the export reads a blank as "no
    // value", which is what it is.
    const soilForm = {};
    SOIL_FORM_SELECTORS.forEach((sel) => {
        const el = stubEl();
        el.getAttribute = (name) => (name === 'data-mlsn' ? soilFieldOf(sel) : null);
        soilForm[sel] = el;
    });
    const fillSoilForm = (sample) => {
        const values = (sample && sample.values) || {};
        SOIL_FORM_SELECTORS.forEach((sel) => {
            const field = soilFieldOf(sel);
            const v = field && values[field];
            soilForm[sel].value = (v === null || v === undefined || v === '') ? '' : String(v);
        });
    };
    const innerQuerySelector = sandbox.document.querySelector;
    sandbox.document.querySelector = (selector) => {
        const sel = String(selector);
        if (Object.prototype.hasOwnProperty.call(soilForm, sel)) return soilForm[sel];
        return innerQuerySelector ? innerQuerySelector.call(sandbox.document, selector) : null;
    };
    sandbox.document.querySelectorAll = (selector) => {
        const sel = String(selector);
        if (sel === '[data-mlsn]') {
            return SOIL_FORM_SELECTORS.filter((s2) => /^\[data-mlsn=/.test(s2)).map((s2) => soilForm[s2]);
        }
        return [];
    };
    const siteConfig = shapedAs('siteConfigUnion', {
        turf: shapedAs('siteConfigTurfUnion', {
            species: 'Perennial Ryegrass', turfType: 'sports', subCategory: '',
            variety: 'generic', construction: 'native', hoc: 25, c3Cover: 100,
            methodology: 'ammonium_acetate'
        }),
        location: shapedAs('siteConfigLocationUnion', {
            name: 'Auckland', lat: SITE_LAT, lon: SITE_LON
        })
    });
    sandbox.GAIP_HUB_CONFIG = { activeSiteId: SITE_ID, savedLocation: { lat: siteConfig.location.lat, lon: siteConfig.location.lon } };
    // GH-473: the site ROW, shaped as the live `getSite(id)` answers — the
    // owner of the facts about the site itself. Built from the recorded
    // answer shape, so a key the live row has is present here too.
    const siteRow = shapedAs('answers.getSite(id)', {
        id: SITE_ID,
        name: SITE_NAME,
        location_name: 'Auckland',
        latitude: SITE_LAT,
        longitude: SITE_LON,
        timezone: 'Pacific/Auckland',
        // GH-482: the two settings this row owns, with the account's texture
        // as the second link. The fixture site's real values, read from the
        // live row: its own texture is 'sand' and the account's is 'loam'.
        soil_texture_override: 'sand',
        account_soil_texture: 'loam',
        methodology_override: null
    });
    // GH-477 (fifteenth refinement, point 2) — every store from which
    // something is chosen by key holds at least TWO records, and the second
    // differs in every field.
    //
    // A single-record store cannot tell "chose by id" from "took the first
    // one": the mutation reads the same either way. This was fixed twice by
    // hand — for the site rows and for the samples — and the config store was
    // left, so the mutation "take the first config instead of the config for
    // this id" left the whole set green. Fixed by hand twice is not a rule, so
    // it is a rule here: the OTHER site's record is built beside every one of
    // them, and a structural test below refuses a store with fewer than two.
    const otherSiteConfig = shapedAs('siteConfigUnion', {
        turf: shapedAs('siteConfigTurfUnion', {
            species: 'Kikuyu', turfType: 'golf', subCategory: 'greens',
            variety: 'other-variety', construction: 'usga', hoc: 4, c3Cover: 0,
            methodology: 'mlsn'
        }, decoyFiller),
        location: shapedAs('siteConfigLocationUnion', {
            name: 'Elsewhere', lat: OTHER_SITE_LAT, lon: OTHER_SITE_LON
        }, decoyFiller)
    }, decoyFiller);
    const otherSiteRow = shapedAs('answers.getSite(id)', {
        id: OTHER_SITE_ID,
        name: 'Elsewhere',
        location_name: 'Elsewhere',
        latitude: OTHER_SITE_LAT,
        longitude: OTHER_SITE_LON,
        timezone: 'Australia/Sydney',
        // A texture that is not the fixture's and is not sand-based, so the
        // two sites resolve different buckets and different certificates.
        soil_texture_override: 'clay_loam',
        account_soil_texture: 'clay'
    }, decoyFiller);
    const configs = { [OTHER_SITE_ID]: otherSiteConfig };
    configs[SITE_ID] = siteConfig;
    const rows = { [OTHER_SITE_ID]: otherSiteRow };
    rows[SITE_ID] = siteRow;

    sandbox.GAIP_SiteConfig = {
        // The other site stands FIRST in both stores, so "the first record" is
        // the wrong record wherever something walks instead of asking by id.
        getConfig: (id) => configs[id] || null,
        getAllConfigs: () => Object.assign({}, configs),
        getSite: (id) => rows[id] || null,
        isMultiSiteTurfEnabled: () => false
    };
    // GH-490: the record's own payload, verbatim from samples.id=141 — the
    // fourteen readings the lab reported, as strings, because that is how the
    // column stores them. Five of them used to be enough here: the export took
    // the other ten off the page's soil form, so a sandbox sample that did not
    // carry them still produced a document that printed them. It cannot now.
    const soilSample = shapedAs('soilSample', {
        id: FIXTURE.soilSample.clientId,
        label: SAMPLE_LABEL,
        date: FIXTURE.soilSample.sampleDate,
        values: shapedAs('soilSampleValues',
            Object.assign({}, FIXTURE.soilSample.payload, { _label: SAMPLE_LABEL }))
    });
    // GH-477: the other site's sample, so the per-site sample store is keyed
    // too. Its readings are the decoy filler's, which no fixture number
    // matches, so a reading that reaches the document from here is recognisable
    // on sight rather than merely wrong.
    // GH-490: it carries all fourteen too, and not one of them equals its
    // opposite number in the record above — a soil figure printed from here is
    // recognisable in every digit rather than in five of fourteen.
    const otherSoilSample = shapedAs('soilSample', {
        id: 'decoy-soil-sample',
        label: 'Elsewhere soil',
        date: '2001-01-01',
        values: shapedAs('soilSampleValues', {
            _label: 'Elsewhere soil', zone: 'Elsewhere',
            B: '9.1', K: '411', P: '412', S: '751', Ca: '8031',
            EC: '1.61', Fe: '1681', Mg: '1291', Mn: '283.1', OM: '37.1',
            Zn: '57.1', pH: '8.9', CEC: '59.1',
            // GH-490: and one reading this record does NOT carry, which the
            // other one does. Real records differ in which readings the lab
            // reported — samples.id=1 has Na and no S, Cu, Fe, Mn, Zn, B or OM
            // — so the two sites differ in their availability tables as well
            // as in their numbers, and "the other site's registry" is a claim
            // with a difference behind it. Copper, because site A reports it.
            Cu: ''
        }, decoyFiller)
    }, decoyFiller);
    // GH-514 (reviewer's finding C): the four constants word-export.js:8708-8724
    // takes off the SAME record — bulk density, depth, ESP, zone area. They are
    // not readings and have no column in the reading map, so the readings check
    // above says nothing about them, and his mutation took them from the last
    // record in the site's soil store while every reading, the label, the date
    // and the recordKey stayed the sample's own.
    //
    // Named rather than implied: these four keys are NOT in the recorded live
    // shape of `soilSampleValues` (tests/fixtures/store-shapes.json), and
    // measured in the database, 0 of 48 live soil records carry any of them —
    // `depth_mm` is NULL on all 48 as well. So they are attached here AFTER
    // shapedAs, deliberately outside the recorded shape, and the claim they
    // support is about the code path rather than about today's data: the day a
    // lab record carries a bulk density, the wrong record's constant would
    // otherwise enter every ppm → kg/ha conversion silently.
    //
    // The two records differ in every one of the four, so a constant that
    // arrives from the wrong record is recognisable in its digits.
    // They sit on `values`, which is what word-export.js:8690 resolves
    // `_soilRow` to (`_soilSample.rawData || _soilSample.values`).
    Object.assign(soilSample.values, {
        bulkDensity: '1.32', depthCm: '7.5', ESP: '2.4', areaHa: '0.83'
    });
    Object.assign(otherSoilSample.values, {
        bulkDensity: '1.71', depthCm: '14.5', ESP: '9.6', areaHa: '4.17'
    });

    const siteRows = [
        shapedAs('siteListRow', { id: OTHER_SITE_ID, label: 'Elsewhere' }, decoyFiller),
        shapedAs('siteListRow', { id: SITE_ID, label: SITE_NAME })
    ];
    // GH-478: the per-site sample stores are MAPS of id -> sample, and
    // `sites` is a map of id -> {label, createdAt}, which is the shape
    // sample-manager.js's getAllSamples() actually answers
    // (`_allSiteStores`, `_sites`). They stood here as arrays, and the
    // combined export's enumerateSamples() walks `Object.keys(sites)` and
    // then indexes `stores[siteId]`, so with an array of ids it enumerated
    // '0' and '1', found no store for either, and returned an empty list:
    // the combined entry point could not be reached in this sandbox at all.
    // GH-484: the tissue and water baskets get the same two-record rule the
    // other stores have. Site A holds t1/w1 and site B holds t2/w2, and the two
    // share no reading, so a document carrying the other site's laboratory
    // numbers says so in every figure rather than in some of them. Both are
    // shaped from the live records (`tissueSample`/`waterSample` and their
    // value shapes, recorded from the page).
    const tissueSampleA = shapedAs('tissueSample', {
        id: 'tissue-a',
        label: 'Soccer tissue',
        date: FIXTURE.tissueSample.sampleDate,
        values: shapedAs('tissueSampleValues', Object.assign(
            { _label: 'Soccer tissue', zone: 'Other' }, FIXTURE.currentInputs.tissuePercent || {}))
    });
    const tissueSampleB = shapedAs('tissueSample', {
        id: 'tissue-b',
        label: 'Elsewhere tissue',
        date: '2001-02-02',
        values: shapedAs('tissueSampleValues', {
            _label: 'Elsewhere tissue', zone: 'Elsewhere',
            N: 1.11, P: 0.11, K: 1.12, Ca: 0.13, Mg: 0.14, S: 0.15,
            Fe: 111, Mn: 112, Zn: 113, Cu: 114
        }, decoyFiller)
    }, decoyFiller);
    const waterSampleA = shapedAs('waterSample', {
        id: 'water-a',
        label: 'Bore A',
        date: '2026-08-09',
        values: shapedAs('waterSampleValues', {
            _label: 'Bore A', zone: 'Other', _zone: 'Other', _source: 'bore',
            pH: 7.2, EC: 0.41, Ca: 22, Mg: 11, Na: 33, K: 4, Cl: 44, SO4: 12,
            HCO3: 55, CO3: 1, B: 0.2, Fe: 0.3, NO3: 2, PO4: 0.5, Mn: 0.1
        })
    });
    const waterSampleB = shapedAs('waterSample', {
        id: 'water-b',
        label: 'Dam B',
        date: '2001-03-03',
        values: shapedAs('waterSampleValues', {
            _label: 'Dam B', zone: 'Elsewhere', _zone: 'Elsewhere', _source: 'dam',
            pH: 8.7, EC: 1.91, Ca: 221, Mg: 111, Na: 331, K: 41, Cl: 441, SO4: 121,
            HCO3: 551, CO3: 13, B: 1.2, Fe: 1.3, NO3: 21, PO4: 1.5, Mn: 1.1
        }, decoyFiller)
    }, decoyFiller);
    const samplesBySite = {
        [OTHER_SITE_ID]: {
            soil: { [otherSoilSample.id]: otherSoilSample },
            tissue: { [tissueSampleB.id]: tissueSampleB },
            water: { [waterSampleB.id]: waterSampleB }
        },
        [SITE_ID]: {
            soil: { [soilSample.id]: soilSample },
            tissue: { [tissueSampleA.id]: tissueSampleA },
            water: { [waterSampleA.id]: waterSampleA }
        }
    };
    const siteIndex = {
        [OTHER_SITE_ID]: { label: 'Elsewhere', createdAt: '2001-01-01T00:00:00.000Z' },
        [SITE_ID]: { label: SITE_NAME, createdAt: '2026-08-17T00:00:00.000Z' }
    };
    // GH-484: the page module's own normalisation, captured before the stubs
    // take the binding. The sandbox answers with the REAL function, so the
    // export and the form are checked against one rule here too — a stub of
    // its own would be the second implementation this ticket removes.
    const realReadingsOf = (sandbox.GAIP_SampleManager && sandbox.GAIP_SampleManager.readingsOf) || null;
    // GH-490: same reasoning for the list of readings a kind can carry — the
    // real derivation off the real map, not a list retyped here.
    const realReadingKeysFor = (sandbox.GAIP_SampleManager && sandbox.GAIP_SampleManager.readingKeysFor) || null;

    // GH-479: the page's own pointer, which setActiveSite() moves and every
    // "which site is active" answer follows. It used to be the constant
    // SITE_ID, so a loop that switches sites switched nothing.
    let pointer = SITE_ID;
    const activeSampleIds = {
        [OTHER_SITE_ID]: { soil: otherSoilSample.id, tissue: tissueSampleB.id, water: waterSampleB.id },
        [SITE_ID]: { soil: soilSample.id, tissue: tissueSampleA.id, water: waterSampleA.id }
    };
    const sampleOf = (siteId, kind) => {
        const id = (activeSampleIds[siteId] || {})[kind];
        return id ? (samplesBySite[siteId][kind] || {})[id] || null : null;
    };
    // The page arrives with its active sample already in the form, the way the
    // live page restores it on load.
    fillSoilForm(sampleOf(pointer, 'soil'));
    sandbox.GAIP_SampleManager = {
        getActiveSiteId: () => pointer,
        getActiveSiteLabel: () => (siteIndex[pointer] || {}).label || null,
        getSiteList: () => siteRows.slice(),
        // GH-514: a reachability record, so "the page's pointer is not asked for
        // the soil sample" can be said by VALUE — what ran — instead of by a
        // count of a substring in the source, which the reviewer walked past in
        // one attempt.
        getActiveSample: (kind) => {
            (sandbox.__getActiveSampleCalls = sandbox.__getActiveSampleCalls || []).push({
                kind: kind,
                at: Date.now(),
                stack: (new Error()).stack || ''
            });
            return sampleOf(pointer, kind);
        },
        getSampleTurfProfile: () => null,
        readingsOf: (kind, sample) => (realReadingsOf ? realReadingsOf(kind, sample) : null),
        readingKeysFor: (kind) => (realReadingKeysFor ? realReadingKeysFor(kind) : null),
        // Keyed by data type, so "the samples" is never an answer: a caller
        // asking for tissue and being handed soil is visible here.
        getSamples: (kind) => Object.values(samplesBySite[pointer][kind] || {}),
        getAllSamples: () => ({
            allSites: JSON.parse(JSON.stringify(samplesBySite)),
            allActive: JSON.parse(JSON.stringify(activeSampleIds)),
            allMeta: {}, sites: JSON.parse(JSON.stringify(siteIndex)), currentSite: pointer
        }),
        // GH-479 (sixteenth refinement, point 1): the two methods the
        // combined export drives the page with. They were recorded as
        // "called by the page, never reached by an export", which was true
        // of the single export only — the entry point a client uses on
        // /reports/export is the combined one, and it calls both per sample.
        //
        // The answers are the recorded live ones: a boolean, and
        // {success, dataType, sampleId, sample, populatedFields}.
        setActiveSite: (siteId) => {
            // sample-manager.js:2443 — a site it does not know leaves the
            // pointer where it was and answers false. The combined loop reads
            // that answer and skips the sample (GH-469).
            if (!siteIndex[siteId]) return false;
            const changed = pointer !== siteId;
            pointer = siteId;
            // GH-498: the page answers a switch with `gaip:site-config-applied`
            // once the arriving site's configuration has been written — and
            // only when the site actually CHANGED, which is what the live
            // sample manager does (it dispatches gaip:site-changed on a change
            // and nothing on a repeat). The combined loop now waits for that
            // announcement instead of counting 300 ms, so a sandbox that never
            // makes it would leave the loop waiting for something that never
            // comes. It is deferred by a turn, not dispatched inline, so the
            // loop's listener is exercised rather than short-circuited.
            if (changed) {
                // Inline, because this sandbox's page modules run on inert
                // timers on purpose (see liveTimers/inertTimers below) — a
                // deferred announcement would never arrive and the loop would
                // wait for it forever. The consumer is still exercised: it
                // attaches its listener before asking for the switch and checks
                // the site id on the event. What this sandbox cannot exercise
                // is the ASYNCHRONOUS case; gh499-config-before-analysis does
                // that deliberately, with a live timer.
                sandbox.document.dispatchEvent(
                    new sandbox.CustomEvent('gaip:site-config-applied', {
                        detail: { siteId: siteId, restored: true, source: 'site-switch' }
                    }));
            }
            return true;
        },
        loadSample: (kind, sampleId) => {
            const sample = (samplesBySite[pointer][kind] || {})[sampleId];
            if (!sample) return { success: false, error: 'Sample not found' };
            activeSampleIds[pointer] = activeSampleIds[pointer] || {};
            activeSampleIds[pointer][kind] = sampleId;
            // This is what the live one does: it fills the page's form from
            // the sample (sample-manager.js:1364). The export reads that form,
            // so a loop that loads the wrong sample prints the wrong readings.
            if (kind === 'soil') fillSoilForm(sample);
            return {
                success: true, dataType: kind, sampleId: sampleId, sample: sample,
                populatedFields: Object.keys(sample.values || {}).filter((k) => k.indexOf('_') !== 0)
            };
        }
    };
    // GH-477: the stores this sandbox keys by SITE, named once so a test can
    // hold them to the two-record rule instead of each store being checked by
    // hand when someone remembers.
    // `recordKey` is how a record names the key it belongs to, where it names
    // it at all: a site row and a site-list row carry the site id, a config and
    // a sample do not.
    // `fixtureKey` and `decoyKey` name the two records in each store's OWN
    // key space: four of them are keyed by site id, and the climate normals
    // (GH-478) by a pair of coordinates.
    const bySite = { fixtureKey: SITE_ID, decoyKey: OTHER_SITE_ID };
    KEYED_STORES = [
        Object.assign({ name: 'GAIP_SiteConfig.getConfig(id)', keys: Object.keys(configs),
          byKey: (id) => sandbox.GAIP_SiteConfig.getConfig(id), recordKey: null }, bySite),
        Object.assign({ name: 'GAIP_SiteConfig.getSite(id)', keys: Object.keys(rows),
          byKey: (id) => sandbox.GAIP_SiteConfig.getSite(id), recordKey: (r) => r.id }, bySite),
        Object.assign({ name: 'GAIP_SampleManager.getSiteList()', keys: siteRows.map((r) => r.id),
          byKey: (id) => sandbox.GAIP_SampleManager.getSiteList().filter((r) => r.id === id)[0],
          recordKey: (r) => r.id }, bySite),
        Object.assign({ name: 'GAIP_SampleManager.getAllSamples().allSites', keys: Object.keys(samplesBySite),
          byKey: (id) => Object.values(sandbox.GAIP_SampleManager.getAllSamples().allSites[id].soil)[0],
          recordKey: null }, bySite)
    ];
    // GH-478 (twenty-second refinement) — the climate normals are a store
    // keyed by COORDINATES, and it holds a row for each of the two sites.
    //
    // What stood here answered one row to any argument, and was declared
    // without parameters at all: `getResolvedSync: () => ({ monthlyTemps:
    // temps, … })`. The product calls `getResolvedSync(_lat, _lon)`
    // (word-export.js:7347), so the defect the owner reported — one site's
    // report printed on another site's temperatures — could be planted at that
    // call site and every suite stayed green: 27/27, 42/42, 16/16, 9/9, 12/12.
    // The store could not tell the two sites apart, so no assertion about
    // which site's climate was used could exist. Same axis as the
    // single-record store in the fifteenth refinement, one level down.
    const temps = {};
    MONTHLY_TEMPS_FIXTURE.forEach((t, i) => { temps[i + 1] = t; });
    const otherTemps = {};
    MONTHLY_TEMPS_DECOY.forEach((t, i) => { otherTemps[i + 1] = t; });
    const climateRows = {};
    climateRows[coordKey(OTHER_SITE_LAT, OTHER_SITE_LON)] =
        { monthlyTemps: otherTemps, source: 'decoy-climate' };
    climateRows[coordKey(SITE_LAT, SITE_LON)] =
        { monthlyTemps: temps, source: 'smoke-fixture' };
    const rowForCoords = (lat, lon) => {
        if (lat == null || lon == null || !isFinite(lat) || !isFinite(lon)) return null;
        const row = climateRows[coordKey(lat, lon)];
        return row || null;
    };
    // What the PAGE has resolved for itself: the site its own pointer names,
    // which is not always the site a sample belongs to. That difference is the
    // whole of GH-459, so the stub keeps it.
    const pageRow = () => {
        const loc = sandbox.GAIP_HUB_CONFIG && sandbox.GAIP_HUB_CONFIG.savedLocation;
        return loc ? rowForCoords(parseFloat(loc.lat), parseFloat(loc.lon)) : null;
    };
    sandbox.GilbaClimateNormalsService = {
        getResolvedSync: (lat, lon) => rowForCoords(parseFloat(lat), parseFloat(lon)),
        getReason: (lat, lon) => (rowForCoords(parseFloat(lat), parseFloat(lon)) ? 'resolved' : 'not-attempted'),
        resolveFor: (lat, lon) => Promise.resolve(rowForCoords(parseFloat(lat), parseFloat(lon))),
        // exportToWord() awaits this before collecting anything (GH-245). It
        // resolves for the PAGE's own site, which is what the live one does.
        ensureFromPage: () => Promise.resolve(pageRow())
    };
    CLIMATE_STORE = {
        name: 'GilbaClimateNormalsService.getResolvedSync(lat, lon)',
        keys: Object.keys(climateRows),
        byKey: (key) => climateRows[key] || null,
        recordKey: null,
        fixtureKey: coordKey(SITE_LAT, SITE_LON),
        decoyKey: coordKey(OTHER_SITE_LAT, OTHER_SITE_LON)
    };
    KEYED_STORES.push(CLIMATE_STORE);
}

function loadPage(record) {
    const built = buildSandbox(record);
    const sandbox = built.sandbox;
    vm.createContext(sandbox);
    const failures = [];
    // docx and jszip capture the timer they find at load time for their own
    // async pipeline, so they are loaded with a working one. The page modules
    // that follow get an inert timer, because several of them reschedule
    // themselves and a live timer turns that into an endless loop in a sandbox
    // with no page to settle against. Both facts were measured, not assumed:
    // with an inert timer throughout, Packer.toBlob() is called and its promise
    // never settles; with a live one throughout, loading never finishes.
    const liveTimers = () => {
        sandbox.setTimeout = (fn, ms) => setTimeout(fn, ms || 0);
        sandbox.clearTimeout = (id) => clearTimeout(id);
        sandbox.setInterval = (fn, ms) => setInterval(fn, ms || 0);
        sandbox.clearInterval = (id) => clearInterval(id);
    };
    const inertTimers = () => {
        sandbox.setTimeout = () => 0;
        sandbox.clearTimeout = noop;
        sandbox.setInterval = () => 0;
        sandbox.clearInterval = noop;
    };

    // GH-479: the stores are wrapped here, before the first page script, so
    // that a module which takes its reference at the top level takes the
    // wrapper.
    const recorders = installStoreRecorders(sandbox);

    liveTimers();
    ['docx.min.js', 'jszip.min.js'].forEach((name) => {
        vm.runInContext(fs.readFileSync(path.join(ASSETS, name), 'utf8'), sandbox, { filename: name });
    });
    inertTimers();

    const scripts = hubScripts().filter((n) => !Object.prototype.hasOwnProperty.call(NOT_LOADED, n));
    scripts.forEach((name) => {
        const file = path.join(ASSETS, name);
        if (!fs.existsSync(file)) { failures.push({ name: name, why: 'file missing' }); return; }
        try {
            vm.runInContext(fs.readFileSync(file, 'utf8'), sandbox, { filename: name });
        } catch (e) {
            failures.push({ name: name, why: (e && e.message) || String(e) });
        }
    });
    installDataStubs(sandbox);
    // Timers become real only now. During loading they are inert, because
    // several page modules reschedule themselves on a timer and a live one
    // turns that into an endless loop in a sandbox with no page to settle
    // against; but the packer's own pipeline (JSZip) is genuinely async and
    // never completes without them, which is why the first version of this
    // test saw Packer.toBlob() called and no file appear.
    liveTimers();
    try {
        vm.runInContext(fs.readFileSync(path.join(ASSETS, 'word-export.js'), 'utf8'), sandbox, { filename: 'word-export.js' });
    } catch (e) {
        failures.push({ name: 'word-export.js', why: (e && e.message) || String(e) });
    }
    return {
        sandbox: sandbox, failures: failures, clicked: built.clicked, blobs: built.blobs,
        // Every method called on either store since the page began loading,
        // in order — the set an export REACHES, measured rather than listed.
        reached: recorders.reached
    };
}


/**
 * The shape of the resolver's object, by name, section by section.
 *
 * Pinned because the seventh mutation the reviewer chose is a NEW KEY rather
 * than a changed value: a default added as a new field of `inputs` changes
 * nothing any value assertion is looking at. This is the same enumeration check
 * `data.turf` gets on the way out of collectData(), applied at the border on
 * the way in — a key the resolver starts returning must be written down here
 * together with what it holds when nothing is resolved.
 *
 * `site`, `turf`, `samples` and the top level are the same under any inputs.
 * `sources` is a provenance map whose membership follows what was asked for, so
 * it is pinned as the set a key must belong to rather than as an exact set;
 * `program` is null when nothing resolved, and carries these keys when it does.
 *
 * Kept beside the loader rather than inside one test so that the empty-inputs
 * run and the dataflow guard's ratchet read the same list.
 */
const RESOLVER_KEYS = {
    top: ['site', 'turf', 'program', 'samples', 'climateNormals', 'climateReason', 'sources',
        // GH-473: which RECORD each field was read from, beside which store.
        'provenance'],
    site: ['id', 'name', 'location', 'timezone', 'elevation', 'areaHa'],
    'site.location': ['name', 'lat', 'lon'],
    turf: ['type', 'subCategory', 'species', 'speciesKey', 'speciesDisplay', 'variety',
        'construction', 'hoc', 'percentC3', 'warmBase', 'coolOverseed', 'overseedSpecies',
        'overseedVariety', 'overseedVarietyDisplay', 'summerIntent', 'isC4'],
    samples: ['soil', 'tissue', 'water'],
    program: ['siteId', 'turfType', 'subCategory', 'surfaceType', 'recommenderSurfaceType',
        'speciesKey', 'speciesDisplay', 'methodology', 'soilTexture', 'CEC', 'pH',
        'clippingManagement', 'trafficIntensity', 'trafficModifier', 'annualNBase', 'annualN',
        'maxNPerMonth', 'distributionMode', 'ranges', 'rangeSources', 'certificateCode', 'sources'],
    sources: ['soilSample', 'tissueSample', 'waterSample', 'species', 'siteName', 'locationName',
        'lat', 'lon', 'timezone', 'elevation', 'areaHa', 'turfType', 'subCategory', 'variety',
        'construction', 'hoc', 'percentC3', 'warmBase', 'coolOverseed', 'overseedSpecies',
        'overseedVariety', 'overseedVarietyDisplay', 'summerIntent']
};

/**
 * Site B, written into every shape the page holds state in — AFTER the page's
 * own modules have loaded, so this is what collectData() would find if it
 * reached for any of them.
 *
 * Shared by the provenance guard and the empty-inputs run. The second one is
 * why the booleans here are all `true` and the numbers are 99 and 77: on a site
 * with nothing resolved the truth for `isC4`, `effectiveIsC4`, `useC3Targets`
 * and `hasOverseed` is `false`, and a leak into a boolean field is invisible on
 * a neutral page — `false` and `false` agree. Poisoned the other way round, a
 * leak arrives as `true` where the truth is `false` and the comparison sees it.
 * The same reasoning gives the numbers: a shifted number is distinguishable, a
 * zero is not.
 */
const POISON_SENTINEL = 'SENTINEL-B-';

/**
 * Which paths must answer with a number or a boolean rather than a sentinel
 * string — DERIVED from the types measured on the live page, not kept as a
 * list here.
 *
 * A hand-kept list names the fields somebody thought of: the reviewer measured
 * 21 paths the export reads that were not in it (`turf.nProgramKgHaYr` a
 * number, `turf.clippingsCollected` a boolean). Reading the types out of the
 * same capture the shapes come from removes the question.
 *
 * Booleans are INVERTED against the truth for a site with nothing resolved,
 * where every one of them is legitimately false, and numbers are shifted: on a
 * neutral page a leak into a boolean agrees with the truth by accident.
 */
function typeOfPath(path) {
    const t = PAGE_STATE_SHAPES.types && PAGE_STATE_SHAPES.types[path];
    return t || null;
}

/** Field names measured as numbers or booleans ANYWHERE in the capture. */
const POISON_BY_TYPE = (function () {
    const numbers = new Set();
    const booleans = new Set();
    const types = (PAGE_STATE_SHAPES && PAGE_STATE_SHAPES.types) || {};
    Object.keys(types).forEach((p) => {
        const field = p.slice(p.lastIndexOf('.') + 1);
        if (types[p] === 'number') numbers.add(field);
        else if (types[p] === 'boolean') booleans.add(field);
    });
    return { numbers: numbers, booleans: booleans };
}());

/**
 * Properties a proxy must NOT answer, because answering them changes what the
 * object IS rather than what it says: `then` makes it thenable and an await on
 * it never settles, `toJSON` redirects serialisation, `constructor` and symbols
 * are used by the runtime itself.
 */
const POISON_PASS_THROUGH = ['then', 'toJSON', 'constructor', 'prototype', '__proto__',
    'length', 'nodeType', 'splice'];

/**
 * A page-state root that answers ANY property, at any depth, with a sentinel
 * built from the path to it.
 *
 * It replaces six hand-written objects with fixed key lists. The reviewer
 * measured what those were worth: a read of a key nobody had listed
 * (`GAIP_STATE.mlsnResults.speciesName`) came back `undefined`, the sweep
 * counted that as absence, and 26 of 26 assertions stayed green while the
 * export read a value that in a browser carries the PREVIOUS site's answer.
 * The keys that were missing were exactly the result containers — the ones
 * layer II has not reached yet.
 *
 * With a proxy, what the poisoning covers and what the test claims to check
 * are the same thing, and neither is maintained by hand.
 */
/** The keys the real thing at this path has, or none when nothing was captured. */
function shapeKeys(path) {
    const known = PAGE_STATE_SHAPES.shapes[path];
    return Array.isArray(known) ? known : [];
}

function poisonProxy(path) {
    const answer = (key) => {
        const t = typeOfPath(path + '.' + key);
        if (t === 'number' || (!t && POISON_BY_TYPE.numbers.has(key))) return 99;
        if (t === 'boolean' || (!t && POISON_BY_TYPE.booleans.has(key))) return true;
        return POISON_SENTINEL + path + '.' + key;
    };
    const target = function () { return POISON_SENTINEL + path; };
    return new Proxy(target, {
        get(_t, key) {
            if (typeof key === 'symbol') return undefined;
            if (POISON_PASS_THROUGH.indexOf(key) >= 0) return undefined;
            // A concatenation of the object itself still carries the sentinel.
            if (key === 'toString' || key === 'valueOf') return () => POISON_SENTINEL + path;
            const value = answer(key);
            if (typeof value !== 'string') return value;
            // A nested object with a captured shape stays a container, so its
            // own keys enumerate too.
            if (shapeKeys(path + '.' + key).length) return poisonProxy(path + '.' + key);
            // A nested read continues the path; a read used as a value is the
            // sentinel. Both at once: a proxy whose string form is the
            // sentinel and whose properties are proxies one level deeper.
            return poisonLeaf(path + '.' + key);
        },
        has() { return true; },
        apply() { return poisonLeaf(path + '()'); },
        ownKeys(t) {
            // The keys this object really has, from the fixture — so that a
            // copy by enumeration copies sentinels. A function target carries
            // its own non-configurable `prototype`, which the invariant
            // requires be listed; the descriptor below keeps it non-enumerable
            // so Object.keys() does not report it.
            return Object.getOwnPropertyNames(t)
                .concat(shapeKeys(path).filter((k) => !Object.prototype.hasOwnProperty.call(t, k)));
        },
        getOwnPropertyDescriptor(t, key) {
            if (typeof key !== 'symbol' && shapeKeys(path).indexOf(key) >= 0
                && !Object.prototype.hasOwnProperty.call(t, key)) {
                return { value: poisonLeaf(path + '.' + key), enumerable: true, configurable: true, writable: true };
            }
            return Object.getOwnPropertyDescriptor(t, key);
        }
    });
}

/**
 * Collection methods the page's own code calls on values it reads. A poisoned
 * value answers them so that the SENTINEL TRAVELS rather than so that the call
 * survives: a `filter` that returned [] would put the reader back where the key
 * list had it — a read that looks like absence.
 */
function poisonCollection(path) {
    const one = () => poisonLeaf(path + '[0]');
    return {
        filter: () => [one()], slice: () => [one()], concat: () => [one()],
        sort: () => [one()], reverse: () => [one()], flat: () => [one()],
        map: (fn) => [typeof fn === 'function' ? fn(one(), 0, [one()]) : one()],
        forEach: (fn) => { if (typeof fn === 'function') fn(one(), 0, [one()]); },
        find: () => one(), pop: () => one(), shift: () => one(),
        reduce: (fn, init) => (init === undefined ? one() : init),
        some: () => true, every: () => true, includes: () => true,
        indexOf: () => 0, join: () => POISON_SENTINEL + path,
        push: () => 1, keys: () => [], values: () => [one()], entries: () => []
    };
}

/**
 * A value that reads as the sentinel string wherever a string is wanted, and
 * still answers further property reads as a proxy.
 */
function poisonLeaf(path) {
    const text = POISON_SENTINEL + path;
    const collection = poisonCollection(path);
    // A function target rather than a String wrapper: a String's indexed
    // properties are read-only and non-configurable, and a proxy that answers
    // them with anything else throws before the value reaches the document.
    const target = function () { return text; };
    return new Proxy(target, {
        get(t, key) {
            if (typeof key === 'symbol') {
                if (key === Symbol.toPrimitive) return () => text;
                if (key === Symbol.iterator) return function* () { yield poisonLeaf(path + '[0]'); };
                return undefined;
            }
            if (key === 'toString' || key === 'valueOf') return () => text;
            if (POISON_PASS_THROUGH.indexOf(key) >= 0) return undefined;
            if (Object.prototype.hasOwnProperty.call(collection, key)) return collection[key];
            if (key === 'length') return 1;
            if (/^\d+$/.test(key)) return poisonLeaf(path + '[' + key + ']');
            if (typeof String.prototype[key] === 'function') return String.prototype[key].bind(text);
            if (POISON_BY_TYPE.numbers.has(key)) return 99;
            if (POISON_BY_TYPE.booleans.has(key)) return true;
            return poisonLeaf(path + '.' + String(key));
        },
        has() { return true; },
        apply() { return text; }
    });
}

/**
 * Site B, in every shape the page holds state in — installed AFTER the page's
 * own modules have loaded, so this is what collectData() finds if it reaches
 * for any of them.
 *
 * Booleans are inverted and numbers shifted on purpose: on a site with nothing
 * resolved the truth for `isC4`, `effectiveIsC4`, `useC3Targets` and
 * `hasOverseed` is `false`, and a leak into a boolean is invisible on a neutral
 * page because `false` and `false` agree.
 */
const POISON_ROOTS = ['GAIP_STATE', 'GAIP_CANONICAL_STATE', 'GAIP_OVERSEED_STATE',
    'GaipTurfProfile', 'GAIP_CLIMATE_V2_RESULT', 'climateMetrics', 'GAIP_TRAJECTORY_RESULT',
    'GAIP_PHYTOTOXICITY_RESULT', 'GAIP_COMPANION_DISEASE_RESULT'];

function poisonPage(sandbox) {
    // GH-471: DEFINED, not assigned. `GAIP_STATE` is an accessor on the page
    // (gilba-hub-v2.js defines it with a getter and a setter), so
    // `sandbox.GAIP_STATE = proxy` went through the hub's own setter and the
    // poison never landed — the single most important root was not poisoned at
    // all, and every assertion that depended on it was passing on that. Found
    // by a mutation that routed a config read through GAIP_STATE.turf and
    // stayed green.
    POISON_ROOTS.forEach((name) => {
        const proxy = poisonProxy(name);
        try {
            Object.defineProperty(sandbox, name, {
                value: proxy, writable: true, configurable: true, enumerable: true
            });
        } catch (e) {
            sandbox[name] = proxy;
        }
    });
    const s = (field) => POISON_SENTINEL + field;
    const el = (key) => ({
        value: s('dom-' + key), textContent: s('dom-' + key), checked: true,
        options: [{ text: s('dom-' + key), value: s('dom-' + key) }], selectedIndex: 0,
        selectedOptions: [{ text: s('dom-' + key) }],
        dataset: { type: s('dom-' + key), surface: s('dom-' + key), sport: s('dom-' + key) },
        getAttribute: () => 'true', closest: () => null, querySelector: () => null,
        querySelectorAll: () => [], classList: { contains: () => true }, style: {}
    });
    sandbox.document.querySelector = (sel) => el(String(sel));
    sandbox.document.getElementById = (id) => el(String(id));
}

module.exports = {
    SITE_ID: SITE_ID,
    SITE_NAME: SITE_NAME,
    SAMPLE_LABEL: SAMPLE_LABEL,
    NOT_LOADED: NOT_LOADED,
    hubScripts: hubScripts,
    loadPage: loadPage,
    stubEl: stubEl,
    RESOLVER_KEYS: RESOLVER_KEYS,
    OTHER_SITE_ID: OTHER_SITE_ID,
    POISON_SENTINEL: POISON_SENTINEL,
    POISON_ROOTS: POISON_ROOTS,
    STORE_SHAPES: STORE_SHAPES,
    shapedAs: shapedAs,
    decoyFiller: decoyFiller,
    keyedStores: () => KEYED_STORES.slice(),
    climateStore: () => CLIMATE_STORE,
    coordKey: coordKey,
    SITE_LAT: SITE_LAT,
    SITE_LON: SITE_LON,
    OTHER_SITE_LAT: OTHER_SITE_LAT,
    OTHER_SITE_LON: OTHER_SITE_LON,
    MONTHLY_TEMPS_FIXTURE: MONTHLY_TEMPS_FIXTURE,
    MONTHLY_TEMPS_DECOY: MONTHLY_TEMPS_DECOY,
    PAGE_STATE_SHAPES: PAGE_STATE_SHAPES,
    poisonPage: poisonPage,
    poisonProxy: poisonProxy
};

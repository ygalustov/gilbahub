/**
 * GH-471 (PLAN-GH439 section 10.6, tenth refinement) — the shape of the
 * sample manager's and the site config's own stores, taken from the live page.
 *
 * Why it exists, measured three times over: the sandbox's stubs were written
 * from memory and repaired one key at a time. The readings sat under `payload`
 * in the stub and `values` live; a site-list row was `{id, label, createdAt}`
 * live and `{id, name}` in the stub; a sample carried `methodologySnapshot`
 * and `soilTextureSnapshot` live and `clientId`/`sampleDate`/`payload` in the
 * stub. Each repair was local, nothing compared the two SETS, and both sides
 * stayed invisible. The first repair made it worse: the stub grew `values` AND
 * `payload`, a stub that agrees with any reading — and the same pliancy sat in
 * the product, where `row.name || row.label` agrees with any store.
 *
 * Two modes:
 *   - GILBA_RECORD=1 rewrites tests/fixtures/store-shapes.json from the page.
 *   - GILBA_E2E=1 alone compares the page against the fixture and fails on any
 *     difference, naming the keys. This is the one place where "live" and "in
 *     the sandbox" are brought together, so it is not optional.
 */
'use strict';

const fs = require('fs');
const os = require('os');
const path = require('path');

let chromium = null;
try { ({ chromium } = require('playwright')); } catch (e) { /* reported below */ }

const ENABLED = process.env.GILBA_E2E === '1';
const RECORD = process.env.GILBA_RECORD === '1';
const FIXTURE_PATH = path.join(__dirname, '..', 'fixtures', 'store-shapes.json');

const credentials = (() => {
    try { return JSON.parse(fs.readFileSync(path.join(__dirname, '.e2e-credentials.json'), 'utf8')); }
    catch (e) { return {}; }
})();
const BASE_URL = process.env.GILBA_E2E_URL || credentials.url || 'http://127.0.0.1:8080';
const EMAIL = process.env.GILBA_E2E_EMAIL || credentials.email;
const PASSWORD = process.env.GILBA_E2E_PASSWORD || credentials.password;

/** The shape of one object: its keys, and the type of each value. */
function shapeOf(obj) {
    if (obj === null || obj === undefined) return null;
    if (typeof obj !== 'object') return { _type: typeof obj };
    const out = {};
    Object.keys(obj).forEach((k) => {
        const v = obj[k];
        out[k] = Array.isArray(v) ? 'array' : (v === null ? 'null' : typeof v);
    });
    return out;
}

if (!ENABLED) {
    process.stdout.write('[e2e] store-shapes-live skipped (needs the live stack) — npm run test:e2e:shapes\n');
    describe('GH-471 — store shapes (disabled)', () => {
        test.skip('needs the live stack', () => {});
    });
} else {
    describe('GH-471 — the sandbox\'s stores have the shape the live page\'s do', () => {
        jest.setTimeout(300000);
        let browser, page, live = null;

        beforeAll(async () => {
            if (!chromium) throw new Error('playwright does not resolve from the repo — run `npm install`');
            if (!EMAIL || !PASSWORD) throw new Error('no credentials — see tests/e2e/.e2e-credentials.example.json');
            browser = await chromium.launch();
            const context = await browser.newContext({ viewport: { width: 1400, height: 1000 } });
            page = await context.newPage();
            await page.goto(BASE_URL + '/login', { waitUntil: 'domcontentloaded' });
            await page.fill('#email', EMAIL);
            await page.fill('#password', PASSWORD);
            await Promise.all([
                page.waitForNavigation({ waitUntil: 'domcontentloaded' }).catch(() => {}),
                page.click('form.login-form button[type=submit]')
            ]);
            await page.waitForTimeout(1500);
            if (/\/login/.test(page.url())) throw new Error('login refused for ' + EMAIL);
            await page.goto(BASE_URL + '/reports/export', { waitUntil: 'domcontentloaded' });
            await page.waitForFunction(() => !!(window.GAIP_SampleManager && window.GAIP_SiteConfig),
                null, { timeout: 30000 });
            await page.waitForTimeout(8000);

            live = await page.evaluate(() => {
                const shape = (obj) => {
                    if (obj === null || obj === undefined) return null;
                    if (typeof obj !== 'object') return { _type: typeof obj };
                    const out = {};
                    Object.keys(obj).forEach((k) => {
                        const v = obj[k];
                        out[k] = Array.isArray(v) ? 'array' : (v === null ? 'null' : typeof v);
                    });
                    return out;
                };
                const SM = window.GAIP_SampleManager;
                const SC = window.GAIP_SiteConfig;
                const siteId = SM && SM.getActiveSiteId ? SM.getActiveSiteId() : null;
                const list = (SM && SM.getSiteList) ? (SM.getSiteList() || []) : [];
                const sampleOf = (kind) => {
                    try { return SM && SM.getActiveSample ? SM.getActiveSample(kind) : null; }
                    catch (e) { return null; }
                };
                // GH-484: the active site does not always have a sample of
                // every kind — on this login it has no water sample at all, and
                // `waterSample` was recorded as null, which is not a shape. A
                // sample of a kind is looked for across every site's store, so
                // the form comes from a real record wherever it lives.
                const anySampleOf = (kind) => {
                    const direct = sampleOf(kind);
                    if (direct) return direct;
                    try {
                        const all = SM && SM.getAllSamples ? SM.getAllSamples() : null;
                        const stores = (all && all.allSites) || {};
                        for (const id of Object.keys(stores)) {
                            const bucket = (stores[id] || {})[kind] || {};
                            const keys = Object.keys(bucket);
                            if (keys.length) return bucket[keys[0]];
                        }
                    } catch (e) { /* recorded as null below */ }
                    return null;
                };
                const soil = sampleOf('soil');
                const anyTissue = anySampleOf('tissue');
                const anyWater = anySampleOf('water');
                // The config shape is the UNION over every site this login
                // has, not one site's. A key that only an oversown site
                // carries is still a live key, and a form taken from one site
                // would call a legitimate read a dead one.
                const all = (SC && SC.getAllConfigs) ? (SC.getAllConfigs() || {}) : {};
                const union = (pick) => {
                    const out = {};
                    Object.keys(all).forEach((id) => {
                        const part = shape(pick(all[id]));
                        if (part) Object.keys(part).forEach((k) => { if (!(k in out)) out[k] = part[k]; });
                    });
                    return Object.keys(out).length ? out : null;
                };
                const cfg = (SC && SC.getConfig) ? SC.getConfig(siteId) : null;
                // GH-473: the shapes of the METHOD ANSWERS, not only of the
                // records inside them. The sandbox's stubs are built from
                // these, so a stub that answers a different shape than the
                // page does fails instead of agreeing with itself.
                const answerShape = (v) => {
                    if (v === null || v === undefined) return { _answer: 'null' };
                    if (Array.isArray(v)) return { _answer: 'array', _rowKeys: shape(v[0] || null) };
                    if (typeof v !== 'object') return { _answer: typeof v };
                    return Object.assign({ _answer: 'object' }, shape(v));
                };
                const answers = {
                    'getSiteList()': answerShape(list),
                    'getAllSamples()': answerShape(SM && SM.getAllSamples ? SM.getAllSamples() : null),
                    'getAllConfigs()': answerShape(SC && SC.getAllConfigs ? SC.getAllConfigs() : null),
                    'getConfig(id)': answerShape(cfg),
                    'getSite(id)': answerShape(SC && SC.getSite ? SC.getSite(siteId) : null),
                    'getActiveSample(soil)': answerShape(soil),
                    // GH-474: four more the sandbox stubs and nothing recorded.
                    // A stub of a method whose answer shape nobody has seen is
                    // a stub written from memory, which is the whole class.
                    'getSamples(soil)': answerShape(SM && SM.getSamples ? SM.getSamples('soil') : null),
                    'getActiveSiteLabel()': answerShape(SM && SM.getActiveSiteLabel ? SM.getActiveSiteLabel() : null),
                    'getSampleTurfProfile()': answerShape(
                        SM && SM.getSampleTurfProfile ? SM.getSampleTurfProfile() : null),
                    'isMultiSiteTurfEnabled(id)': answerShape(
                        SC && SC.isMultiSiteTurfEnabled ? SC.isMultiSiteTurfEnabled(siteId) : null),
                    'getActiveSiteId()': answerShape(siteId),
                    // GH-479 (sixteenth refinement, point 1): the two methods
                    // the combined export — the entry point a client uses —
                    // drives the page with. Both were in "called elsewhere,
                    // the export does not reach them", which was true only of
                    // the single export.
                    //
                    // Both calls here are chosen to change nothing: the site
                    // asked for is the one already active (sample-manager.js
                    // dispatches gaip:site-changed only when it CHANGES), the
                    // id that does not exist only warns, and the sample loaded
                    // back into the form is the one already in it.
                    'setActiveSite(id)': answerShape(
                        SM && SM.setActiveSite && siteId ? SM.setActiveSite(siteId) : null),
                    'setActiveSite(unknown id)': answerShape(
                        SM && SM.setActiveSite ? SM.setActiveSite('gh479-no-such-site') : null),
                    'loadSample(soil, id)': answerShape(
                        SM && SM.loadSample && soil && soil.id ? SM.loadSample('soil', soil.id) : null),
                    // GH-484: the normalisation both the form and the export
                    // apply to a sample's readings. Recorded for both kinds,
                    // from a real record of that kind wherever it lives.
                    'readingsOf(tissue, sample)': answerShape(
                        SM && SM.readingsOf ? SM.readingsOf('tissue', anyTissue) : null),
                    'readingsOf(water, sample)': answerShape(
                        SM && SM.readingsOf ? SM.readingsOf('water', anyWater) : null),
                    // GH-490: soil joined the other two — the export takes its
                    // readings through the same function now, so its answer is
                    // recorded like theirs. `readingKeysFor` is the list of
                    // readings a kind can carry, which is how the export names
                    // the ones a sample does not have.
                    'readingsOf(soil, sample)': answerShape(
                        SM && SM.readingsOf ? SM.readingsOf('soil', soil) : null),
                    'readingKeysFor(soil)': answerShape(
                        SM && SM.readingKeysFor ? SM.readingKeysFor('soil') : null)
                };
                // The soil form the export reads when the sample store has not
                // filled `GAIP_STATE.soil` — measured, because on a live
                // /reports/export `GAIP_STATE.soil` is undefined THROUGHOUT an
                // export and every reading in the document comes from these
                // fields (word-export.js's `soilFieldMappings` fallback).
                // Enumerated from the page rather than listed here, except for
                // the four fields the export reads by class name
                // (word-export.js:8613-8618).
                const soilForm = {};
                Array.prototype.forEach.call(document.querySelectorAll('[data-mlsn]'), (el) => {
                    const key = el.getAttribute('data-mlsn');
                    if (key) soilForm['[data-mlsn="' + key + '"]'] = typeof el.value;
                });
                ['.gaip-soil-ph', '.gaip-cec', '.gaip-soil-ec', '.gaip-loi'].forEach((sel) => {
                    const el = document.querySelector(sel);
                    if (el) soilForm[sel] = typeof el.value;
                });
                return {
                    answers: answers,
                    soilForm: soilForm,
                    _sitesUnioned: Object.keys(all).length,
                    siteConfigUnion: union((c) => c),
                    siteConfigTurfUnion: union((c) => c && c.turf),
                    siteConfigLocationUnion: union((c) => c && c.location),
                    siteListRow: shape(list[0] || null),
                    soilSample: shape(soil),
                    soilSampleValues: shape(soil && (soil.values || soil.payload) || null),
                    tissueSample: shape(anyTissue),
                    tissueSampleValues: shape(anyTissue && (anyTissue.values || anyTissue.rawData) || null),
                    waterSample: shape(anyWater),
                    waterSampleValues: shape(anyWater && (anyWater.values || anyWater.rawData) || null),
                    siteConfig: shape(cfg),
                    siteConfigTurf: shape(cfg && cfg.turf),
                    siteConfigLocation: shape(cfg && cfg.location)
                };
            });
        });

        afterAll(async () => { if (browser) await browser.close(); });

        test('the shapes are recorded, or they agree with what was recorded', () => {
            if (RECORD) {
                const out = {
                    _why: 'The shape of the sample manager\'s and site config\'s own stores, taken from a live '
                        + '/reports/export. The sandbox builds its stubs from this, and the resolver is checked '
                        + 'against it, so a stub written from memory and a read of a key that does not exist '
                        + 'both fail instead of agreeing with each other.',
                    _captured: new Date().toISOString().slice(0, 10),
                    _page: '/reports/export, after the sample manager and site config had loaded',
                    shapes: live
                };
                fs.writeFileSync(FIXTURE_PATH, JSON.stringify(out, null, 1) + '\n');
                process.stdout.write('[e2e] store shapes RECORDED to tests/fixtures/store-shapes.json\n');
                expect(Object.keys(live).length).toBeGreaterThan(0);
                return;
            }
            const recorded = JSON.parse(fs.readFileSync(FIXTURE_PATH, 'utf8')).shapes;
            const differences = [];
            const compare = (label, a, b) => {
                Object.keys(a).forEach((k) => {
                    if (!(k in b)) differences.push(label + '.' + k + ': in the fixture, not on the page');
                    else if (a[k] !== b[k]) differences.push(label + '.' + k + ': fixture ' + a[k] + ', page ' + b[k]);
                });
                Object.keys(b).forEach((k) => {
                    if (!(k in a)) differences.push(label + '.' + k + ': on the page, not in the fixture');
                });
            };
            Object.keys(recorded).forEach((name) => {
                // `answers` holds one shape per method, so it is compared a
                // level deeper; comparing it flat compared objects as strings
                // and every method looked different from itself.
                if (name === 'answers') {
                    Object.keys(recorded[name] || {}).forEach((method) => {
                        const ra = recorded[name][method] || {};
                        const pa = (live[name] || {})[method] || {};
                        // getAllConfigs() is keyed by site id, so its keys are
                        // this login's sites and not a shape at all. What it
                        // answers WITH is the shape; the ids are data.
                        if (method === 'getAllConfigs()') {
                            if (ra._answer !== pa._answer) {
                                differences.push('answers.' + method + ': fixture ' + ra._answer + ', page ' + pa._answer);
                            }
                            return;
                        }
                        if (ra._rowKeys || pa._rowKeys) {
                            compare('answers.' + method + ' row', ra._rowKeys || {}, pa._rowKeys || {});
                        }
                        const strip = (o) => {
                            const out = {};
                            Object.keys(o).forEach((k) => { if (k !== '_rowKeys') out[k] = o[k]; });
                            return out;
                        };
                        compare('answers.' + method, strip(ra), strip(pa));
                    });
                    return;
                }
                const a = recorded[name] || {};
                const b = live[name] || {};
                if (typeof a !== 'object' || typeof b !== 'object') {
                    if (a !== b) differences.push(name + ': fixture ' + a + ', page ' + b);
                    return;
                }
                compare(name, a, b);
            });
            process.stdout.write('[e2e] store shapes compared: ' + Object.keys(recorded).length +
                ' objects, ' + differences.length + ' differences\n');
            expect({ differences: differences }).toEqual({ differences: [] });
        });
    });
}

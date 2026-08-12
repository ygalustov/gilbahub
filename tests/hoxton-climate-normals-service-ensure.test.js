/**
 * Hoxton audit D02/D03 (follow-up) — GilbaClimateNormalsService.ensure()
 * caching + writeback, and the auto-trigger that fires without any
 * GilbaHub/ClimateFetchCoordinator dependency.
 *
 * Root cause this covers: on a real Hoxton-style attempt, the Network tab
 * showed zero requests to NASA POWER or Open-Meteo — window.climateMetrics
 * only ever had {latitude: ...}. climate-engine-v2.js's ClimateFetchCoordinator
 * (the thing that was supposed to trigger the fetch) is never loaded on
 * plan.blade.php at all — that page is deliberately lightweight. This file
 * must self-trigger from whatever coordinate source a given page actually
 * has, with zero dependency on GilbaHub.
 */

'use strict';

function freshEnv() {
    jest.resetModules();
    global.window = {};
    var dispatched = [];
    global.document = {
        readyState: 'complete',
        addEventListener: function () {},
        querySelector: function () { return null; },
        dispatchEvent: function (evt) { dispatched.push(evt); }
    };
    global.CustomEvent = function (name, opts) { this.type = name; this.detail = opts && opts.detail; };
    global.console = { log: function () {}, warn: function () {}, error: function () {}, info: function () {} };
    return dispatched;
}

var AUCKLAND_C = { 1: 20.0, 2: 20.5, 3: 18.9, 4: 16.6, 5: 14.2, 6: 12.1,
                    7: 11.2, 8: 11.7, 9: 13.1, 10: 14.6, 11: 16.2, 12: 18.5 };

function nasaOk() {
    return {
        ok: true,
        json: function () {
            return Promise.resolve({
                properties: { parameter: { T2M: { JAN: 20, FEB: 20.5, MAR: 18.9, APR: 16.6, MAY: 14.2, JUN: 12.1,
                                                    JUL: 11.2, AUG: 11.7, SEP: 13.1, OCT: 14.6, NOV: 16.2, DEC: 18.5 } } },
                header: { range: '2001-2020' }
            });
        }
    };
}

describe('GilbaClimateNormalsService.ensure — writeback', function () {
    beforeEach(function () { freshEnv(); });
    afterEach(function () { delete global.fetch; });

    test('writes result onto window.climateMetrics.monthlyTemps/.monthlyTempsSource', async function () {
        global.fetch = jest.fn().mockResolvedValue(nasaOk());
        var svc = require('../assets/climate-normals-service.js');

        await svc.ensure(-36.8485, 174.7633);

        expect(global.window.climateMetrics).toBeDefined();
        expect(global.window.climateMetrics.monthlyTemps[1]).toBeCloseTo(20.0, 5);
        expect(global.window.climateMetrics.monthlyTempsSource).toBe('nasa-power');
    });

    test('mirrors the result onto GAIP_STATE.climate.monthlyTemps when GAIP_STATE exists', async function () {
        global.fetch = jest.fn().mockResolvedValue(nasaOk());
        global.window.GAIP_STATE = { turf: { species: 'bentgrass' } };
        var svc = require('../assets/climate-normals-service.js');

        await svc.ensure(-36.8485, 174.7633);

        expect(global.window.GAIP_STATE.climate.monthlyTemps[1]).toBeCloseTo(20.0, 5);
        // Must not have clobbered unrelated GAIP_STATE fields.
        expect(global.window.GAIP_STATE.turf.species).toBe('bentgrass');
    });

    test('dispatches gaip:monthly-normals-ready with available=true on success', async function () {
        global.fetch = jest.fn().mockResolvedValue(nasaOk());
        var dispatched = freshEnv();
        global.fetch = jest.fn().mockResolvedValue(nasaOk());
        var svc = require('../assets/climate-normals-service.js');

        await svc.ensure(-36.8485, 174.7633);

        var evt = dispatched.find(function (e) { return e.type === 'gaip:monthly-normals-ready'; });
        expect(evt).toBeDefined();
        expect(evt.detail.available).toBe(true);
        expect(evt.detail.source).toBe('nasa-power');
    });

    test('dispatches gaip:monthly-normals-ready with available=false when both tiers fail', async function () {
        var dispatched = freshEnv();
        global.fetch = jest.fn().mockResolvedValue({ ok: false, status: 500 });
        var svc = require('../assets/climate-normals-service.js');

        await svc.ensure(-36.8485, 174.7633);

        var evt = dispatched.find(function (e) { return e.type === 'gaip:monthly-normals-ready'; });
        expect(evt).toBeDefined();
        expect(evt.detail.available).toBe(false);
        expect(global.window.climateMetrics.monthlyTemps).toBeNull();
    });

    test('does not re-fetch for the same coordinates once resolved (idempotent)', async function () {
        global.fetch = jest.fn().mockResolvedValue(nasaOk());
        var svc = require('../assets/climate-normals-service.js');

        await svc.ensure(-36.8485, 174.7633);
        await svc.ensure(-36.8485, 174.7633);
        await svc.ensure(-36.85, 174.76); // same rounded key (2 decimals)

        expect(global.fetch).toHaveBeenCalledTimes(1);
    });

    test('does re-fetch when coordinates genuinely change (different site)', async function () {
        global.fetch = jest.fn().mockResolvedValue(nasaOk());
        var svc = require('../assets/climate-normals-service.js');

        await svc.ensure(-36.8485, 174.7633);   // Auckland
        await svc.ensure(-43.5321, 172.6362);   // Christchurch

        expect(global.fetch).toHaveBeenCalledTimes(2);
    });
});

describe('GilbaClimateNormalsService.ensure — never touches GAIP_SiteConfig (regression)', function () {
    // GH-245 follow-up. This service used to persist results via
    // GAIP_SiteConfig.mergeConfig(siteId, {climateNormals: ...}) for
    // cross-page-load caching. That caused real data loss in production:
    // GAIP_SiteConfig.mergeConfig is callable as soon as site-config-
    // persistence.js parses, but its in-memory _configs (turf, species,
    // location) isn't populated until init() runs 500ms later (and later
    // still if it falls through to an async server pull). This service's
    // auto-trigger fires on DOMContentLoaded with no such delay, so a fast
    // NASA POWER response could land inside that window. mergeConfig's
    // `_configs[siteId] || {turf:{}, location:{}}` fallback then wrote a
    // near-empty config over the site's real one, and
    // pushConfigsToServer() — a full PUT, not a partial patch — persisted
    // that empty config to the database, wiping the site's turf identity
    // (visible on Settings as species/turf type/cultivar reverting to
    // "— select —"). Fixed by dropping the cross-page-load cache entirely —
    // these tests guard against it coming back.
    beforeEach(function () { freshEnv(); });
    afterEach(function () { delete global.fetch; });

    test('GAIP_SiteConfig.mergeConfig is never called, even when GAIP_SiteConfig is present', async function () {
        global.fetch = jest.fn().mockResolvedValue(nasaOk());
        global.window.GAIP_SampleManager = { getActiveSiteId: function () { return 'site-1'; } };
        var mergeConfig = jest.fn();
        global.window.GAIP_SiteConfig = { getConfig: jest.fn(), mergeConfig: mergeConfig };
        var svc = require('../assets/climate-normals-service.js');

        await svc.ensure(-36.8485, 174.7633);

        expect(mergeConfig).not.toHaveBeenCalled();
    });

    test('GAIP_SiteConfig.getConfig is never called either — no read-side dependency on it', async function () {
        global.fetch = jest.fn().mockResolvedValue(nasaOk());
        global.window.GAIP_SampleManager = { getActiveSiteId: function () { return 'site-1'; } };
        var getConfig = jest.fn();
        global.window.GAIP_SiteConfig = { getConfig: getConfig, mergeConfig: jest.fn() };
        var svc = require('../assets/climate-normals-service.js');

        await svc.ensure(-36.8485, 174.7633);

        expect(getConfig).not.toHaveBeenCalled();
    });

    test('works identically whether or not GAIP_SiteConfig exists on window at all', async function () {
        global.fetch = jest.fn().mockResolvedValue(nasaOk());
        // No GAIP_SiteConfig, no GAIP_SampleManager — matches plan.blade.php.
        var svc = require('../assets/climate-normals-service.js');

        await svc.ensure(-36.8485, 174.7633);

        expect(global.window.climateMetrics.monthlyTemps[1]).toBeCloseTo(20.0, 5);
    });

    test('source code never calls .mergeConfig( in executable code (the word may still appear in the removal comment explaining why)', function () {
        var fs = require('fs');
        var path = require('path');
        var src = fs.readFileSync(path.join(__dirname, '../assets/climate-normals-service.js'), 'utf8');
        var codeOnly = src.split('\n')
            .filter(function (line) { return line.trim().indexOf('//') !== 0; })
            .join('\n');
        expect(codeOnly).not.toMatch(/\.mergeConfig\(/);
    });
});

describe('GilbaClimateNormalsService — auto-trigger without GilbaHub', function () {
    afterEach(function () { delete global.fetch; });

    test('self-triggers from GAIP_STATE.location on load (plan.blade.php has no .gaip-lat DOM input)', async function () {
        freshEnv();
        global.fetch = jest.fn().mockResolvedValue(nasaOk());
        global.window.GAIP_STATE = { location: { lat: -36.8485, lon: 174.7633 } };

        require('../assets/climate-normals-service.js');
        // autoTrigger fires synchronously (readyState === 'complete') but
        // ensure() itself is async — flush microtasks.
        await new Promise(function (resolve) { setImmediate(resolve); });
        await new Promise(function (resolve) { setImmediate(resolve); });

        expect(global.fetch).toHaveBeenCalled();
        expect(global.window.climateMetrics.monthlyTemps).toBeDefined();
    });

    test('falls back to .gaip-lat/.gaip-lon DOM inputs when present (hub.blade.php convention)', async function () {
        freshEnv();
        global.fetch = jest.fn().mockResolvedValue(nasaOk());
        global.document.querySelector = function (sel) {
            if (sel === '.gaip-lat') return { value: '-36.8485' };
            if (sel === '.gaip-lon') return { value: '174.7633' };
            return null;
        };

        require('../assets/climate-normals-service.js');
        await new Promise(function (resolve) { setImmediate(resolve); });
        await new Promise(function (resolve) { setImmediate(resolve); });

        expect(global.fetch).toHaveBeenCalled();
    });

    test('does nothing at load when no coordinate source is available (no crash)', function () {
        freshEnv();
        global.fetch = jest.fn();
        expect(function () { require('../assets/climate-normals-service.js'); }).not.toThrow();
        expect(global.fetch).not.toHaveBeenCalled();
    });
});

describe('GilbaClimateNormalsService.ensureFromPage — awaitable, for export flows', function () {
    // Regression: a user reported the docx export saying "climate data
    // unavailable" for Monthly N Distribution while the Nutrition Program
    // (fertiliser schedule, generated on an earlier page load and persisted)
    // clearly had real data. Root cause: exportToWord() read
    // window.climateMetrics.monthlyTemps synchronously; the page-load
    // auto-trigger is fire-and-forget, so if Export was clicked before that
    // fetch resolved, the data genuinely wasn't there *yet*, not
    // unavailable. ensureFromPage() lets export flows await the same
    // resolution before reading climate data.
    afterEach(function () { delete global.fetch; });

    test('resolves window.climateMetrics.monthlyTemps by the time it returns', async function () {
        freshEnv();
        global.fetch = jest.fn().mockResolvedValue(nasaOk());
        global.document.querySelector = function (sel) {
            if (sel === '.gaip-lat') return { value: '-36.8485' };
            if (sel === '.gaip-lon') return { value: '174.7633' };
            return null;
        };
        var svc = require('../assets/climate-normals-service.js');

        await svc.ensureFromPage();

        expect(global.window.climateMetrics.monthlyTemps).toBeDefined();
        expect(global.window.climateMetrics.monthlyTemps[1]).toBeCloseTo(20.0, 5);
    });

    test('does not re-fetch if the page-load auto-trigger already resolved it', async function () {
        freshEnv();
        global.fetch = jest.fn().mockResolvedValue(nasaOk());
        global.document.querySelector = function (sel) {
            if (sel === '.gaip-lat') return { value: '-36.8485' };
            if (sel === '.gaip-lon') return { value: '174.7633' };
            return null;
        };
        var svc = require('../assets/climate-normals-service.js');
        // Let the page-load auto-trigger (fired synchronously at require time,
        // readyState === 'complete') finish first.
        await new Promise(function (resolve) { setImmediate(resolve); });
        await new Promise(function (resolve) { setImmediate(resolve); });

        await svc.ensureFromPage();

        expect(global.fetch).toHaveBeenCalledTimes(1);
    });

    test('resolves without throwing when no coordinate source exists on the page', async function () {
        freshEnv();
        global.fetch = jest.fn();
        var svc = require('../assets/climate-normals-service.js');

        await expect(svc.ensureFromPage()).resolves.toBeUndefined();
        expect(global.fetch).not.toHaveBeenCalled();
    });
});

describe('GilbaClimateNormalsService.resolveFor / getResolvedSync — per-site, for combined export', function () {
    // GH-245 follow-up 2. Combined export can span genuinely different
    // sites in one document (a Vietnam couch course + a Bowral bentgrass
    // green + a Sydney fairway, per the b35fix313 rationale in word-export-
    // combined.js). window.climateMetrics is a single slot — ensure()
    // overwrites it with whichever site asked last. resolveFor() must cache
    // per-coordinate without touching that slot, and getResolvedSync() must
    // read back the RIGHT site's answer for each set of coordinates, not
    // whatever the "current" one is.
    var CHRISTCHURCH_C = { 1: 17.1, 2: 16.9, 3: 14.9, 4: 11.9, 5: 9.3, 6: 6.4,
                            7: 6.0, 8: 7.3, 9: 9.3, 10: 11.3, 11: 13.2, 12: 15.7 };

    function nasaFor(monthly) {
        return {
            ok: true,
            json: function () {
                return Promise.resolve({
                    properties: { parameter: { T2M: {
                        JAN: monthly[1], FEB: monthly[2], MAR: monthly[3], APR: monthly[4],
                        MAY: monthly[5], JUN: monthly[6], JUL: monthly[7], AUG: monthly[8],
                        SEP: monthly[9], OCT: monthly[10], NOV: monthly[11], DEC: monthly[12]
                    } } },
                    header: { range: '2001-2020' }
                });
            }
        };
    }

    afterEach(function () { delete global.fetch; });

    test('resolveFor() does not touch window.climateMetrics at all', async function () {
        freshEnv();
        global.fetch = jest.fn().mockResolvedValue(nasaOk());
        var svc = require('../assets/climate-normals-service.js');

        await svc.resolveFor(-36.8485, 174.7633);

        expect(global.window.climateMetrics).toBeUndefined();
    });

    test('getResolvedSync() returns the right site\'s data for each of two different sites', async function () {
        freshEnv();
        global.fetch = jest.fn()
            .mockResolvedValueOnce(nasaFor(AUCKLAND_C))
            .mockResolvedValueOnce(nasaFor(CHRISTCHURCH_C));
        var svc = require('../assets/climate-normals-service.js');

        await Promise.all([
            svc.resolveFor(-36.8485, 174.7633),  // Auckland
            svc.resolveFor(-43.5321, 172.6362)   // Christchurch
        ]);

        var auckland = svc.getResolvedSync(-36.8485, 174.7633);
        var christchurch = svc.getResolvedSync(-43.5321, 172.6362);

        expect(auckland.monthlyTemps[7]).toBeCloseTo(11.2, 5);   // Auckland July
        expect(christchurch.monthlyTemps[7]).toBeCloseTo(6.0, 5); // Christchurch July — genuinely different
    });

    test('getResolvedSync() returns null (not the wrong site\'s data) for coordinates never resolved', function () {
        freshEnv();
        var svc = require('../assets/climate-normals-service.js');
        expect(svc.getResolvedSync(-33.8688, 151.2093)).toBeNull(); // Sydney, never queried
    });

    test('resolveFor() caches per coordinate — two sites sharing the same site only fetch once', async function () {
        freshEnv();
        global.fetch = jest.fn().mockResolvedValue(nasaOk());
        var svc = require('../assets/climate-normals-service.js');

        // Simulates multiple samples (greens) belonging to the same site.
        await svc.resolveFor(-36.8485, 174.7633);
        await svc.resolveFor(-36.8485, 174.7633);
        await svc.resolveFor(-36.85, 174.76); // same rounded key

        expect(global.fetch).toHaveBeenCalledTimes(1);
    });

    test('a site resolved via resolveFor() is then visible to a same-page ensure() call for that site, without re-fetching', async function () {
        freshEnv();
        global.fetch = jest.fn().mockResolvedValue(nasaOk());
        var svc = require('../assets/climate-normals-service.js');

        await svc.resolveFor(-36.8485, 174.7633);
        await svc.ensure(-36.8485, 174.7633); // e.g. single-export's ensureFromPage(), same coords

        expect(global.fetch).toHaveBeenCalledTimes(1);
        expect(global.window.climateMetrics.monthlyTemps[1]).toBeCloseTo(20.0, 5);
    });

    test('confirmed-unavailable (both tiers failed) is cached too — not re-queried on every sample of a broken site', async function () {
        freshEnv();
        global.fetch = jest.fn().mockResolvedValue({ ok: false, status: 500 });
        var svc = require('../assets/climate-normals-service.js');

        await svc.resolveFor(-36.8485, 174.7633);
        await svc.resolveFor(-36.8485, 174.7633);

        expect(svc.getResolvedSync(-36.8485, 174.7633)).toBeNull();
        // Two tiers attempted once, not twice.
        expect(global.fetch).toHaveBeenCalledTimes(2);
    });
});

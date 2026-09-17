/**
 * GH-362 (Hoxton audit v6, D30 root cause) — NutritionPrebbleIntegration
 * .isNewZealand() accepted regional-profiles.js detectRegionFromHub()'s answer
 * unconditionally. That function reads the global `.gaip-lat`/`.gaip-lon` DOM
 * inputs and, when they are missing or non-numeric, returns its 'uk_ireland'
 * DEFAULT rather than signalling "unknown" (regional-profiles.js:1312-1322).
 * So a genuine NZ site whose coordinate inputs weren't populated resolved as
 * not-NZ, and Methods 2 and 3 — which read GAIP_STATE.location.region and
 * GAIP_HUB_CONFIG.savedLocation and would have answered correctly — were never
 * reached, because Method 1 had already returned.
 *
 * Downstream (word-export-combined.js) that answer picked the product
 * catalogue for the whole document, which is how an NZ/Prebbles site's Word
 * export came back carrying AU-catalogue products — the audit's D30 evidence.
 *
 * These tests pin the fall-through: Method 1 is only trusted when the DOM
 * inputs it reads actually hold usable coordinates.
 */

'use strict';

function makeDom(latValue, lonValue) {
    return {
        // 'loading' keeps the module's auto-init behind a DOMContentLoaded
        // listener (a no-op here) instead of running it at require time.
        // init() re-schedules itself on a 100ms timer while
        // window.PrebbleRecommender is absent, and that timer outlives the
        // test run; isNewZealand() is a plain method and needs no init.
        readyState: 'loading',
        addEventListener: function () {},
        querySelectorAll: function () { return []; },
        querySelector: function (sel) {
            if (sel === '.gaip-lat') return latValue === null ? null : { value: latValue };
            if (sel === '.gaip-lon') return lonValue === null ? null : { value: lonValue };
            return null;
        },
        getElementById: function () { return null; },
        createElement: function () {
            return { id: '', textContent: '', style: {}, appendChild: function () {} };
        },
        head: { appendChild: function () {} },
        body: { appendChild: function () {} },
    };
}

function loadIntegration(dom, windowExtras) {
    jest.resetModules();
    global.document = dom;
    global.window = Object.assign({}, windowExtras);
    global.window.document = dom;
    require('../assets/nutrition-prebble-integration.js');
    return global.window.NutritionPrebbleIntegration;
}

// detectRegionFromHub() stands in for the real one: it returns its
// 'uk_ireland' default whenever the DOM coordinates are unusable, exactly as
// regional-profiles.js:1312-1322 does.
/**
 * GH-476: the region is derived from the SITE's coordinates, by id, so the
 * stub answers the way the real function does — out of a site store — and the
 * DOM plays no part. The property this file protects is unchanged: an answer
 * that cannot be derived must not stop the later methods from being asked.
 * What changed is that there is no longer a 'uk_ireland' default to swallow —
 * an underivable region is `null`, which is what "unknown" should always have
 * looked like.
 */
function regionalProfilesStub(siteRow) {
    return {
        activeSiteId: function () { return siteRow ? siteRow.id : null; },
        detectRegionForSite: function (siteId) {
            if (!siteRow || siteId !== siteRow.id) return null;
            var lat = parseFloat(siteRow.latitude);
            var lon = parseFloat(siteRow.longitude);
            if (isNaN(lat) || isNaN(lon)) return null;
            if (lat === 0 && lon === 0) return null;
            if (lon >= 166 && lon <= 179 && lat >= -47 && lat <= -34) return 'new_zealand';
            return 'australia';
        },
    };
}

/** A site row with the coordinates under test, or without any. */
function siteAt(latitude, longitude) {
    return { id: 'site-under-test', latitude: latitude, longitude: longitude };
}

describe('GH-362/GH-476 — a region that cannot be derived does not stop the later methods', function () {
    test('empty coordinate inputs + NZ region in GAIP_STATE -> true (Method 2 is now reached)', function () {
        var dom = makeDom('', '');
        var integration = loadIntegration(dom, {
            GAIP_RegionalProfiles: regionalProfilesStub(siteAt(null, null)),
            GAIP_STATE: { location: { region: 'new_zealand' } },
        });
        expect(integration.isNewZealand()).toBe(true);
    });

    test('missing coordinate inputs entirely + NZ coordinates on GAIP_HUB_CONFIG -> true (Method 3 is now reached)', function () {
        var dom = makeDom(null, null);
        var integration = loadIntegration(dom, {
            GAIP_RegionalProfiles: regionalProfilesStub(siteAt(null, null)),
            GAIP_HUB_CONFIG: { savedLocation: { lat: '-36.8508827', lon: '174.7644881' } },
        });
        expect(integration.isNewZealand()).toBe(true);
    });

    test('populated NZ coordinate inputs -> true via Method 1, unchanged behaviour', function () {
        // The coordinates are the SITE's; the DOM holds nothing relevant.
        var dom = makeDom('', '');
        var integration = loadIntegration(dom, {
            GAIP_RegionalProfiles: regionalProfilesStub(siteAt(-36.8508827, 174.7644881)),
        });
        expect(integration.isNewZealand()).toBe(true);
    });

    test('populated AU coordinate inputs -> false via Method 1, and the NZ fallbacks must NOT override a real answer', function () {
        var dom = makeDom('', '');
        var integration = loadIntegration(dom, {
            GAIP_RegionalProfiles: regionalProfilesStub(siteAt(-33.8688, 151.2093)),
            // A stale NZ region left in state must not win over this sample's
            // real Sydney coordinates -- the inverse leak (AU site served the
            // NZ catalogue) the audit also asks to be asserted.
            GAIP_STATE: { location: { region: 'new_zealand' } },
        });
        expect(integration.isNewZealand()).toBe(false);
    });

    test('0,0 coordinates are treated as unusable, not as a real location', function () {
        var dom = makeDom('', '');
        var integration = loadIntegration(dom, {
            GAIP_RegionalProfiles: regionalProfilesStub(siteAt(0, 0)),
            GAIP_STATE: { location: { region: 'new_zealand' } },
        });
        expect(integration.isNewZealand()).toBe(true);
    });

    test('no coordinates anywhere and no region anywhere -> false, unchanged conservative default', function () {
        var dom = makeDom('', '');
        var integration = loadIntegration(dom, {
            GAIP_RegionalProfiles: regionalProfilesStub(siteAt(null, null)),
        });
        expect(integration.isNewZealand()).toBe(false);
    });
});

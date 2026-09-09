/**
 * GH-385 — `snapshotConfig()` compared two different sites and threw away
 * both their nutrition programmes on every site switch.
 *
 * `saveCurrentSiteConfig()` snapshots the site being switched AWAY from, but by
 * the time it runs `GAIP_SampleManager` and the DOM already describe the site
 * being switched TO. The carry-forward block at the bottom of `snapshotConfig()`
 * read `_configs[getActiveSiteId()]` — the ARRIVING site's stored config,
 * including its nutrition-programme coordinate stamp — and compared that stamp
 * against `.gaip-lat`/`.gaip-lon`, which still held the DEPARTING site's
 * coordinates. Two different sites on the two sides of one comparison: GH-371's
 * "the coordinates moved, drop the cached programme" rule fired every time, and
 * the result was written into the departing site's slot.
 *
 * Reproduced live on a two-site Combined export (Test5 - NZ + Burns,
 * 2026-09-09), instrumented in the browser:
 *
 *   t=0      test5: prog targetN=250   burns: prog targetN=120
 *   t=1382   (switch to Burns)  test5: NO-PROGRAMME
 *   t=5042   (switch to Test5)  burns: NO-PROGRAMME
 *
 * and the instrumented snapshot itself:
 *
 *   [GH-371 (D01)] coordinates changed for site <Burns>
 *       (-35.2285452,149.0022925 -> -36.8508827,174.7644881) — dropping cached
 *       nutrition programmes
 *   activeSiteId=<Burns> existingHasProgramme=true dropCoord=true
 *       stampSpecies=bentgrass  (while previousSiteId=<Test5>)
 *
 * That is Burns' stamp against Test5's DOM coordinates.
 *
 * Latent since GH-371, and load-bearing since GH-383: the Word export now takes
 * each site's annual N from the persisted programme, so a transient drop gave
 * both a wrong annual N (Settings > Turf instead of the client's own target)
 * and a client-facing note saying "no nutrition programme has been generated"
 * printed on a site that has one.
 *
 * FIX: `snapshotConfig(forSiteId)`. The carry-forward reads the config of the
 * site the snapshot is FOR, and when that is not the active site the location
 * comes from that site's stored record rather than from a DOM that is
 * describing somebody else. Every call site now names its site — most were
 * already the active one, but several run inside `setTimeout` callbacks where
 * the active site can have moved on before they fire.
 */

'use strict';

function makeDomStub(overrides) {
    const values = Object.assign({}, overrides);
    return {
        addEventListener: function () {},
        querySelector: function (sel) {
            if (Object.prototype.hasOwnProperty.call(values, sel)) {
                const v = values[sel];
                return v === null ? null : { value: v };
            }
            return null;
        },
        querySelectorAll: function () { return []; },
        getElementById: function () { return null; },
        dispatchEvent: function () {},
        createElement: function () { return { style: {}, classList: { add() {}, remove() {} } }; },
    };
}

if (typeof global.CustomEvent === 'undefined') {
    global.CustomEvent = function (type, params) { this.type = type; this.detail = params && params.detail; };
}

const AUCKLAND = { lat: -36.8508827, lon: 174.7644881 };   // Test5 - NZ
const CANBERRA = { lat: -35.2285452, lon: 149.0022925 };   // Burns

/**
 * Loads the module with `activeSiteId` active and the DOM showing
 * `domCoords` — i.e. mid-switch, when the DOM still holds the departing
 * site's coordinates.
 */
function load(activeSiteId, domCoords) {
    jest.resetModules();
    global.window = {};
    global.console = { log() {}, warn() {}, error() {}, info() {} };
    global.localStorage = { getItem() { return null; }, setItem() {}, removeItem() {} };
    global.fetch = jest.fn(() => Promise.resolve({ ok: true, json: () => Promise.resolve({}) }));
    global.document = makeDomStub({
        '.gaip-lat': String(domCoords.lat),
        '.gaip-lon': String(domCoords.lon),
    });
    global.window.GAIP_SampleManager = { getActiveSiteId: () => activeSiteId };
    require('../assets/site-config-persistence.js');
    return global.window.GAIP_SiteConfig;
}

function seed(SiteConfig, siteId, coords, targetN, species) {
    SiteConfig.mergeConfig(siteId, {
        turf: { species: species, methodology: 'mlsn' },
        location: { lat: coords.lat, lon: coords.lon, name: siteId },
        nutritionCalendarProgram: {
            meta: { lat: coords.lat, lon: coords.lon, species: species, methodology: 'MLSN', annualNBase: targetN },
            adjustments: { target_n: targetN, traffic_modifier: 1 },
            annual_totals: { N: targetN }
        },
        nutritionProgram: { monthly: [{ N: 16 }] },
        nutritionProgramCoords: { lat: coords.lat, lon: coords.lon },
    });
}

describe('GH-385 — the departing site keeps its own programme across a site switch', () => {
    test('the live regression: Burns active, Test5\'s coordinates in the DOM, snapshot taken FOR Test5', () => {
        // Exactly the instrumented state quoted in this file's header.
        const SiteConfig = load('burns', AUCKLAND);
        seed(SiteConfig, 'test5', AUCKLAND, 250, 'perennialRyegrass');
        seed(SiteConfig, 'burns', CANBERRA, 120, 'bentgrass');

        const snap = SiteConfig.snapshot('test5');
        expect(snap.nutritionCalendarProgram).toBeTruthy();
        expect(snap.nutritionCalendarProgram.adjustments.target_n).toBe(250);
        expect(snap.nutritionCalendarProgram.meta.annualNBase).toBe(250);
        expect(snap.nutritionProgram).toBeTruthy();
        expect(snap.nutritionProgramCoords).toEqual(AUCKLAND);
    });

    test('it carries forward the DEPARTING site\'s programme, never the arriving site\'s — in both directions', () => {
        // Leaving Test5 for Burns: the DOM still shows Auckland.
        const leavingTest5 = load('burns', AUCKLAND);
        seed(leavingTest5, 'test5', AUCKLAND, 250, 'perennialRyegrass');
        seed(leavingTest5, 'burns', CANBERRA, 120, 'bentgrass');
        // 250 is Test5's own target; 120 would mean Burns' programme was
        // copied onto Test5 — the same cross-site read, just as wrong.
        expect(leavingTest5.snapshot('test5').nutritionCalendarProgram.adjustments.target_n).toBe(250);

        // ...and back: leaving Burns for Test5, the DOM now shows Canberra.
        const leavingBurns = load('test5', CANBERRA);
        seed(leavingBurns, 'test5', AUCKLAND, 250, 'perennialRyegrass');
        seed(leavingBurns, 'burns', CANBERRA, 120, 'bentgrass');
        expect(leavingBurns.snapshot('burns').nutritionCalendarProgram.adjustments.target_n).toBe(120);
    });

    test('the snapshot saves the named site\'s own location, not whatever the DOM is showing', () => {
        const SiteConfig = load('test5', AUCKLAND);   // Test5 active, Auckland in the DOM
        seed(SiteConfig, 'burns', CANBERRA, 120, 'bentgrass');
        const snap = SiteConfig.snapshot('burns');    // ...snapshot taken FOR Burns
        expect(snap.location.lat).toBe(CANBERRA.lat);
        expect(snap.location.lon).toBe(CANBERRA.lon);
    });

    test('a site with no stored location gets an empty one, never the active site\'s coordinates', () => {
        // First visit to the departing site: there is nothing to carry
        // forward, and stamping the arriving site's coordinates would drive
        // the climate normals and the regional product catalogue off another
        // site's position.
        const SiteConfig = load('burns', CANBERRA);
        const snap = SiteConfig.snapshot('brand-new-site');
        expect(snap.location).toEqual({ lat: null, lon: null, name: '' });
        expect(snap.nutritionCalendarProgram).toBeUndefined();
    });
});

describe('GH-385 — GH-371\'s real invalidation still fires (this is not a blanket "always carry forward")', () => {
    test('the ACTIVE site\'s coordinates moving still drops its cached programmes', () => {
        // The user re-pins the map: .gaip-lat/.gaip-lon are the active site's
        // own, freshly moved, and they no longer match the stamp.
        const SiteConfig = load('test5', CANBERRA);
        seed(SiteConfig, 'test5', AUCKLAND, 250, 'perennialRyegrass');
        const snap = SiteConfig.snapshot();
        expect(snap.nutritionCalendarProgram).toBeUndefined();
        expect(snap.nutritionProgram).toBeUndefined();
        expect(snap.nutritionProgramCoords).toBeUndefined();
    });

    test('naming the active site explicitly behaves identically to omitting the argument', () => {
        const SiteConfig = load('test5', CANBERRA);
        seed(SiteConfig, 'test5', AUCKLAND, 250, 'perennialRyegrass');
        expect(SiteConfig.snapshot('test5').nutritionCalendarProgram).toBeUndefined();
    });

    test('a NAMED non-active site whose own stored coordinates moved away from its stamp is still dropped', () => {
        // Location updated (a real re-pin persisted for that site) but the
        // programme was computed for the old position: the stamp check is
        // against that site's own two values, so it still catches it.
        const SiteConfig = load('burns', CANBERRA);
        seed(SiteConfig, 'test5', AUCKLAND, 250, 'perennialRyegrass');
        SiteConfig.mergeConfig('test5', { location: { lat: CANBERRA.lat, lon: CANBERRA.lon, name: 'moved' } });
        expect(SiteConfig.snapshot('test5').nutritionCalendarProgram).toBeUndefined();
    });
});

describe('GH-385 — every call site names the site it is snapshotting', () => {
    const fs = require('fs');
    const path = require('path');
    const src = fs.readFileSync(path.join(__dirname, '../assets/site-config-persistence.js'), 'utf8');
    // Comments name the bare form when describing the old behaviour.
    const code = src.replace(/\/\*[\s\S]*?\*\//g, '').replace(/(^|[^:])\/\/[^\n]*/g, '$1');

    test('no bare snapshotConfig() call survives — several run inside setTimeout callbacks', () => {
        expect(code).not.toMatch(/snapshotConfig\(\)/);
    });

    test('the site switch snapshots FOR the departing site', () => {
        expect(code).toMatch(/var freshSnap = snapshotConfig\(_previousSiteId\);/);
        expect(code).toMatch(/var config = snapshotConfig\(_previousSiteId\);/);
    });

    test('an explicit save snapshots FOR the site it names', () => {
        expect(code).toMatch(/_configs\[siteId\] = snapshotConfig\(siteId\);/);
    });
});

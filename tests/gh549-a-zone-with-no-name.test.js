/**
 * GH-549 — A SOIL ZONE WITH NO NAME IS NOT GIVEN ONE.
 *
 * WHAT WAS THERE. `cacheAnalysisResults()` built its zone list keyed by
 * `s.label || sid` and stored that same string as the zone's NAME. Two things
 * were wrong and only one of them is the substitution:
 *
 *   - the name was substituted, and the substitute reached both the screen
 *     (/analysis, Soil & Nutrition: the alert list and the comparison chart)
 *     and the server, inside `computed.soilNutrition.zones`;
 *   - the substitute was not even an identifier. `GAIP_SampleManager.getSamples()`
 *     returns `Object.values(...)`, an ARRAY, so `sid` is the array index. An
 *     unnamed sample was charted as a zone called "0", and the entry's `id`
 *     field carried the same index.
 *
 * THE OWNER'S DECISION, 22.09.2026, in two parts. First: "do not substitute —
 * on screen 'a zone with no name', and group by identifier internally without
 * showing it." Then, extending it to the report: "it must be the same as in the
 * interface. If there is no name, there is none in the interface either, but the
 * sample itself is displayed." Skipping unnamed samples was ruled out by name.
 *
 * So: the key is the shared zone identity (`GaipZoneKey.derive`), the name is
 * the label or nothing, and the sample is drawn either way.
 *
 * WHAT THIS FILE DOES NOT COVER, named rather than left to be noticed: the Word
 * export carries the same substitution in its own words (`word-export-combined.js`)
 * and is a separate delivery, carried in the main defects document. So is
 * `nutrient-trend.js`, whose surfaces are /hub and the three reports pages.
 */

'use strict';

const vm = require('vm');
const fs = require('fs');
const path = require('path');

const ASSETS = path.join(__dirname, '..', 'assets');
const read = (f) => fs.readFileSync(path.join(ASSETS, f), 'utf8');

// ─────────────────────────────────────────────────────────────────────────────
// The shared answer
// ─────────────────────────────────────────────────────────────────────────────

describe('GH-549 — one answer for "what is this zone called", shared by both surfaces', () => {
    let ZoneKey;
    beforeAll(() => {
        const sandbox = { window: {}, console: { warn() {} } };
        sandbox.global = sandbox;
        vm.runInContext(read('zone-key.js'), vm.createContext(sandbox), { filename: 'zone-key.js' });
        ZoneKey = sandbox.window.GaipZoneKey;
    });

    test('a named zone is called by its name, trimmed', () => {
        expect(ZoneKey.displayName({ label: '  Green 1 ' })).toBe('Green 1');
        expect(ZoneKey.displayName('Fairway 7')).toBe('Fairway 7');
    });

    test('an unnamed zone is called nothing — not its id, not a number', () => {
        expect(ZoneKey.displayName({ label: null, id: 'soil-42' })).toBe('');
        expect(ZoneKey.displayName({ label: '   ', id: 'soil-42' })).toBe('');
        expect(ZoneKey.displayName(null)).toBe('');
        expect(ZoneKey.displayName({})).toBe('');
        // The decision itself, so that changing it is a decision and not a typo.
        expect(ZoneKey.UNNAMED).toBe('');
    });

    test('grouping still works on a sample with no label at all', () => {
        // The identity survives the name going away — that is the half of the
        // owner's sentence that keeps the sample on the screen.
        // The deriver normalises hyphens to spaces, as it always has for
        // labels; what matters here is that it answers at all and answers the
        // same thing twice for the same sample.
        expect(ZoneKey.derive({ label: null, id: 'soil-42' })).toBe('soil 42');
        expect(ZoneKey.derive({ label: '', id: 'soil-42' }))
            .toBe(ZoneKey.derive({ label: null, id: 'soil-42' }));
        expect(ZoneKey.derive({ label: 'Green 1 (June 2025)' }))
            .toBe(ZoneKey.derive({ label: 'Green 1 Q1 2024' }));
    });
});

// ─────────────────────────────────────────────────────────────────────────────
// The producer
// ─────────────────────────────────────────────────────────────────────────────

/**
 * `cacheAnalysisResults()` is internal, so it is exposed the way eleven other
 * test files reach into `soil-nutrition-analysis.js`: by splicing the export
 * line. The assertion on the line being present is the positive control — a
 * rename would otherwise leave this whole block testing an empty sandbox.
 */
function loadProducer(samples, opts) {
    const src = read('hub-persistence.js');
    const exportLine = 'global.GilbaPersistence = GilbaPersistence;';
    expect(src).toContain(exportLine);
    const testSrc = src.replace(exportLine,
        exportLine + '\n    global.__test_cacheAnalysisResults = cacheAnalysisResults;');

    const listeners = {};
    const sandbox = {
        window: {},
        console: { log() {}, warn() {}, error() {} },
        localStorage: { getItem: () => null, setItem() {}, removeItem() {} },
        setTimeout: () => 0,
        clearTimeout() {},
        setInterval: () => 0,
        document: {
            readyState: 'complete',
            addEventListener(t, f) { (listeners[t] = listeners[t] || []).push(f); },
            getElementById: () => null,
            querySelector: () => null,
            querySelectorAll: () => [],
            body: { appendChild() {}, removeChild() {} },
        },
        location: { search: '' },
        URLSearchParams,
        Date,
        JSON,
        Math,
        Object,
        Array,
        String,
        Number,
        parseFloat,
        parseInt,
        isNaN,
    };
    sandbox.global = sandbox;
    sandbox.globalThis = sandbox;
    sandbox.window = sandbox;
    sandbox.GAIP_SampleManager = {
        getSamples: (type) => (type === 'soil' ? samples : []),
        getActiveSiteId: () => 'site-1',
    };
    sandbox.GaipOrchestrator = {
        getState: () => ({
            computed: {
                soilNutrition: {
                    nutrients: [
                        { nutrient: 'K', mlsn: '100' },
                        { nutrient: 'P', mlsn: '30' },
                    ],
                },
            },
        }),
    };
    if (!opts || opts.zoneKey !== false) {
        vm.runInContext(read('zone-key.js'), vm.createContext(sandbox), { filename: 'zone-key.js' });
    }
    const ctx = vm.createContext(sandbox);
    vm.runInContext(testSrc, ctx, { filename: 'hub-persistence.js' });
    const snap = ctx.__test_cacheAnalysisResults();
    return (snap.computed && snap.computed.soilNutrition && snap.computed.soilNutrition.zones) || [];
}

const NAMED = { id: 'soil-1', label: 'Green 1', date: '2026-03-01', rawData: { K_ppm: 90, P_ppm: 40 } };
const UNNAMED = { id: 'soil-9', label: '', date: '2026-03-02', rawData: { K_ppm: 120, P_ppm: 25 } };

describe('GH-549 — the producer stores no name rather than a made-up one', () => {
    test('the sandbox reaches the zone block at all', () => {
        // Positive control: without it, every assertion below would pass on an
        // empty list.
        const zones = loadProducer([NAMED, UNNAMED]);
        expect(zones.length).toBe(2);
    });

    test('an unnamed sample keeps its numbers and gains no name', () => {
        const zones = loadProducer([NAMED, UNNAMED]);
        const anon = zones.filter((z) => !z.label)[0];
        expect(anon).toBeDefined();
        expect(anon.label).toBeNull();
        // The requirement the owner stated twice: the sample is still there.
        expect(anon.ppm.K).toBe(120);
        expect(anon.ppm.P).toBe(25);
        // and it is judged like any other zone: P 25 is under its MLSN of 30,
        // K 120 is over its 100.
        expect(anon.alerts).toEqual(['P']);
    });

    test('nothing in the stored entry carries the array index', () => {
        // `sid` was `"0"` / `"1"`, and it went into both `label` and `id`.
        const zones = loadProducer([NAMED, UNNAMED]);
        zones.forEach((z) => {
            expect(z.label).not.toBe('0');
            expect(z.label).not.toBe('1');
            expect(z.id).not.toBe('0');
            expect(z.id).not.toBe('1');
        });
        // and `id` is the sample's own
        expect(zones.map((z) => z.id).sort()).toEqual(['soil-1', 'soil-9']);
    });

    test('two unnamed samples stay two zones — grouping is by identity, not by name', () => {
        const other = { id: 'soil-10', label: null, date: '2026-03-03', rawData: { K_ppm: 200, P_ppm: 50 } };
        const zones = loadProducer([UNNAMED, other]);
        expect(zones.length).toBe(2);
        expect(zones.map((z) => z.id).sort()).toEqual(['soil-10', 'soil-9']);
    });

    test('a named zone sampled twice is still one zone, latest wins', () => {
        const older = { id: 'soil-2', label: 'Green 1 Q1 2024', date: '2024-02-01', rawData: { K_ppm: 10, P_ppm: 10 } };
        const newer = { id: 'soil-3', label: 'Green 1 (June 2025)', date: '2025-06-01', rawData: { K_ppm: 150, P_ppm: 45 } };
        const zones = loadProducer([older, newer, UNNAMED]);
        const green = zones.filter((z) => (z.label || '').indexOf('Green 1') === 0);
        expect(green.length).toBe(1);
        expect(green[0].ppm.K).toBe(150);
    });

    test('named zones sort above unnamed ones once alerts are equal', () => {
        // Sorting an absent name as an empty string put it at the TOP, above
        // every named zone.
        const a = { id: 'soil-a', label: 'Zulu', date: '2026-01-01', rawData: { K_ppm: 500, P_ppm: 500 } };
        const b = { id: 'soil-b', label: null, date: '2026-01-01', rawData: { K_ppm: 500, P_ppm: 500 } };
        const zones = loadProducer([b, a]);
        expect(zones.map((z) => z.label)).toEqual(['Zulu', null]);
    });

    test('without the zone-key module the block still produces zones and still names nobody', () => {
        // zone-key.js is enqueued separately; a missing one must not take the
        // chart down, and must not bring the substitution back either.
        const zones = loadProducer([NAMED, UNNAMED], { zoneKey: false });
        expect(zones.length).toBe(2);
        expect(zones.filter((z) => !z.label)[0].label).toBeNull();
    });
});

// ─────────────────────────────────────────────────────────────────────────────
// The screen
// ─────────────────────────────────────────────────────────────────────────────

function loadScreen(withZoneKey) {
    const realSrc = read('soil-nutrition-analysis.js');
    const exportLine = 'global.GAIP_SoilNutritionAnalysis = { init: init, mountSampleDropdown: mountSampleDropdown };';
    expect(realSrc).toContain(exportLine);
    const testSrc = realSrc.replace(exportLine, exportLine
        + '\n        global.GAIP_SoilNutritionAnalysis.__test_renderZoneAlerts = renderZoneAlerts;'
        + '\n        global.GAIP_SoilNutritionAnalysis.__test_renderZoneComparison = renderZoneComparison;');

    const sandbox = {
        window: {},
        document: { createElement: () => ({ textContent: '', innerHTML: '' }), querySelector: () => null },
        console: { log() {}, warn() {} },
        localStorage: { getItem: () => null, setItem() {} },
    };
    sandbox.global = sandbox;
    sandbox.globalThis = sandbox;
    sandbox.window.GAIP_DASHBOARD_DATA = {};
    const ctx = vm.createContext(sandbox);
    if (withZoneKey !== false) vm.runInContext(read('zone-key.js'), ctx, { filename: 'zone-key.js' });
    vm.runInContext(testSrc, ctx, { filename: 'soil-nutrition-analysis.js' });
    return ctx.window.GAIP_SoilNutritionAnalysis;
}

describe('GH-549 — the screen prints the name or nothing', () => {
    const ZONES = [
        { id: 'soil-1', label: 'Green 1', date: '2026-03-01', ppm: { K: 90, P: 40 }, alerts: ['K'] },
        { id: 'soil-9', label: null, date: '2026-03-02', ppm: { K: 120, P: 25 }, alerts: ['P'] },
    ];
    const SN = { zones: ZONES, nutrients: [{ nutrient: 'K', mlsn: '100' }, { nutrient: 'P', mlsn: '30' }] };

    test('the alert list shows the unnamed zone, with its nutrients and no invented name', () => {
        const api = loadScreen();
        const html = api.__test_renderZoneAlerts(ZONES);
        // Positive control: the named one is there, so an empty answer cannot
        // pass the assertions below.
        expect(html).toContain('Green 1');
        // Both rows are drawn — the unnamed sample does not disappear.
        expect((html.match(/sn-alert-item/g) || []).length).toBe(2);
        expect(html).toContain('P at/below threshold');
        // and nothing stands where its name would be
        expect(html).not.toContain('soil-9');
        expect(html).not.toContain('Unnamed');
        expect(html).toContain('<span class="sn-alert-zone"></span>');
    });

    test('the comparison chart draws the unnamed zone’s bar and leaves its label empty', () => {
        const api = loadScreen();
        const html = api.__test_renderZoneComparison(SN);
        expect(html).toContain('Green 1');
        expect((html.match(/sn-bar-row/g) || []).length).toBeGreaterThanOrEqual(2);
        // its value is on the screen
        expect(html).toContain('>120<');
        // the identifier is nowhere, including the hover text
        expect(html).not.toContain('soil-9');
        expect(html).toContain('title=""');
    });

    test('a page that did not load zone-key.js answers the same way', () => {
        const api = loadScreen(false);
        const html = api.__test_renderZoneAlerts(ZONES);
        expect(html).toContain('Green 1');
        expect(html).not.toContain('soil-9');
        expect(html).toContain('<span class="sn-alert-zone"></span>');
    });

    test('/analysis loads the module the name comes from', () => {
        const blade = fs.readFileSync(
            path.join(__dirname, '..', 'app', 'resources', 'views', 'analysis.blade.php'), 'utf8');
        expect(blade).toContain("legacyAssetUrl('zone-key.js')");
        // before the file that uses it
        expect(blade.indexOf("legacyAssetUrl('zone-key.js')"))
            .toBeLessThan(blade.indexOf("legacyAssetUrl('soil-nutrition-analysis.js')"));
    });
});

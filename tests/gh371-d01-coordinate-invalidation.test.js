/**
 * GH-371 (Hoxton audit D01) — a site-record coordinate write invalidates
 * nothing. computeProgram()'s output (the Monthly Schedule / Monthly N
 * Distribution / Nutrition Program) was cached client-side
 * (site-config-persistence.js's `_configs[siteId]`) with no record of what
 * coordinates it was computed against, so:
 *   - snapshotConfig()'s carry-forward step (every subsequent site-config
 *     save) blindly copied the cached programme forward, unconditionally.
 *   - restoreConfig() (page load) restored it into window.GAIP_NUTRITION_
 *     PROGRAM / window.GAIP_NUTRITION_CALENDAR_PROGRAM unconditionally.
 *   - nutrition-calendar.js's own restoreFromPersisted() rendered whatever
 *     it found unconditionally.
 * The audit's own D01 evidence (nine-month renormalisation table, section
 * "Proof that the UI shares the stale copy") showed the on-screen Prebbles
 * monthly programme reproducing a pre-coordinate-correction GP series to
 * within 0.3 kg across nine months, while the Monthly N Distribution panel
 * on the same page had already picked up the corrected coordinates —
 * exactly this mechanism.
 *
 * FIX: computeProgram() stamps the coordinates it was actually computed
 * against (inputs.latitude/longitude, themselves traced back to
 * collectFromState()'s DOM/state.location resolution) into program.meta.lat/
 * lon. mergeConfig() records that stamp against the site
 * (nutritionProgramCoords) whenever a nutritionCalendarProgram patch carries
 * one. snapshotConfig()'s carry-forward, restoreConfig(), and
 * restoreFromPersisted() each compare the stamp against the site's current
 * coordinates (0.01 degree tolerance for float/display noise) before
 * carrying forward / restoring / rendering the cached programme, and drop or
 * refuse it on a real mismatch instead. word-export.js's Monthly Schedule/
 * Nutrition Program read gets the same check. SiteController::update()
 * additionally clears the cached fields server-side on a real coordinate
 * change (Option 3, belt-and-braces).
 */

'use strict';

// ─────────────────────────────────────────────────────────────────────────
// Shared DOM/window scaffolding
// ─────────────────────────────────────────────────────────────────────────

function makeDomStub(overrides) {
    var values = Object.assign({}, overrides);
    return {
        addEventListener: function () {},
        querySelector: function (sel) {
            if (Object.prototype.hasOwnProperty.call(values, sel)) {
                var v = values[sel];
                return v === null ? null : { value: v };
            }
            return null;
        },
        querySelectorAll: function () { return []; },
        getElementById: function () { return null; },
        dispatchEvent: function () {},
        createElement: function () { return { style: {}, classList: { add: function () {}, remove: function () {} } }; },
    };
}

if (typeof global.CustomEvent === 'undefined') {
    global.CustomEvent = function (type, params) {
        this.type = type;
        this.detail = params && params.detail;
    };
}

var MONTHLY_TEMPS_0_11 = [20, 20, 18, 15, 12, 9, 8, 9, 11, 14, 17, 19];

function baseInputs(overrides) {
    return Object.assign({
        annualNOverride: 200,
        traffic: 'moderate',
        clippingManagement: 'collected',
        bulkDensity: 1.4,
        soilDepth: 10,
        methodology: 'mlsn',
        species: 'perennialRyegrass',
        speciesDisplay: 'Perennial Ryegrass',
        isC4: false,
        distribution: 'gp_weighted',
        monthlyTemps: MONTHLY_TEMPS_0_11,
        soilPpm: { P: 20, K: 45, Ca: 400, Mg: 60, S: 20 },
    }, overrides);
}

describe('GH-371 — nutrition-calendar.js: collectFromState() resolves longitude, and both lat/lon gain a state.location fallback tier', () => {
    let NutritionCalendar;
    beforeEach(() => {
        jest.resetModules();
        global.window = {};
        global.console = { log: function () {}, warn: function () {}, error: function () {}, info: function () {} };
        global.localStorage = { getItem: function () { return null; }, setItem: function () {} };
        global.window.GilbaGrowthPotentialEngine = require('../assets/growth-potential-engine.js');
    });

    test('DOM .gaip-lat/.gaip-lon take priority when present', () => {
        global.document = makeDomStub({ '.gaip-lat': '-36.85', '.gaip-lon': '174.76' });
        global.window.GAIP_STATE = { location: { lat: 1, lon: 2 } }; // must be ignored, DOM wins
        require('../assets/nutrition-calendar.js');
        NutritionCalendar = global.window.GilbaNutritionCalendar;
        const inputs = NutritionCalendar.collectFromState();
        expect(inputs.latitude).toBeCloseTo(-36.85, 5);
        expect(inputs.longitude).toBeCloseTo(174.76, 5);
    });

    test('falls back to state.location.{lat,lon} when there is no DOM input at all — the plan.blade.php bridge shape', () => {
        global.document = makeDomStub({}); // no .gaip-lat/.gaip-lon element on this page
        global.window.GAIP_STATE = { location: { lat: -36.8508827, lon: 174.7644881, lng: 174.7644881 } };
        require('../assets/nutrition-calendar.js');
        NutritionCalendar = global.window.GilbaNutritionCalendar;
        const inputs = NutritionCalendar.collectFromState();
        expect(inputs.latitude).toBeCloseTo(-36.8508827, 5);
        expect(inputs.longitude).toBeCloseTo(174.7644881, 5);
    });

    test('falls back to state.location.{latitude,longitude} (long-form keys) too', () => {
        global.document = makeDomStub({});
        global.window.GAIP_STATE = { location: { latitude: 51.5, longitude: -0.12 } };
        require('../assets/nutrition-calendar.js');
        NutritionCalendar = global.window.GilbaNutritionCalendar;
        const inputs = NutritionCalendar.collectFromState();
        expect(inputs.latitude).toBeCloseTo(51.5, 5);
        expect(inputs.longitude).toBeCloseTo(-0.12, 5);
    });

    test('resolves to null (not 0 or NaN) when nothing at all is available', () => {
        global.document = makeDomStub({});
        global.window.GAIP_STATE = {};
        require('../assets/nutrition-calendar.js');
        NutritionCalendar = global.window.GilbaNutritionCalendar;
        const inputs = NutritionCalendar.collectFromState();
        expect(inputs.latitude).toBeNull();
        expect(inputs.longitude).toBeNull();
    });
});

describe('GH-371 — nutrition-calendar.js: computeProgram() stamps meta.lat/meta.lon from inputs', () => {
    let NutritionCalendar;
    beforeAll(() => {
        global.window = global.window || {};
        global.document = global.document || makeDomStub({});
        global.console = { log: function () {}, warn: function () {}, error: function () {}, info: function () {} };
        global.localStorage = { getItem: function () { return null; }, setItem: function () {} };
        global.window.GilbaGrowthPotentialEngine = require('../assets/growth-potential-engine.js');
        require('../assets/nutrition-calendar.js');
        NutritionCalendar = global.window.GilbaNutritionCalendar;
    });

    test('real coordinates on the input are stamped onto program.meta.lat/lon', () => {
        const program = NutritionCalendar.computeProgram(baseInputs({ latitude: -36.85, longitude: 174.76 }));
        expect(program.meta.lat).toBeCloseTo(-36.85, 5);
        expect(program.meta.lon).toBeCloseTo(174.76, 5);
    });

    test('missing coordinates stamp explicit null, not 0 or undefined — a consumer must be able to tell "unknown" from "0,0"', () => {
        const program = NutritionCalendar.computeProgram(baseInputs({ latitude: null, longitude: null }));
        expect(program.meta.lat).toBeNull();
        expect(program.meta.lon).toBeNull();
    });

    test('two computations for genuinely different coordinates carry genuinely different stamps', () => {
        const auckland = NutritionCalendar.computeProgram(baseInputs({ latitude: -36.85, longitude: 174.76 }));
        const canberra = NutritionCalendar.computeProgram(baseInputs({ latitude: -35.28, longitude: 149.13 }));
        expect(auckland.meta.lat).not.toBeCloseTo(canberra.meta.lat, 1);
    });
});

describe('GH-371 — site-config-persistence.js: mergeConfig() handles an already-stamped nutritionProgramCoords patch generically', () => {
    // The stamp itself is computed upstream, in NutritionCalendar.
    // persistSiteConfigPatch() (see the dedicated describe block below for
    // why THAT is the real shared chokepoint, not this function) — these
    // tests confirm mergeConfig()'s existing generic per-key merge handles
    // an already-computed nutritionProgramCoords key correctly, with no
    // special-casing of its own.
    let SiteConfig;
    beforeEach(() => {
        jest.resetModules();
        global.window = {};
        global.document = makeDomStub({});
        global.console = { log: function () {}, warn: function () {}, error: function () {}, info: function () {} };
        global.localStorage = { getItem: function () { return null; }, setItem: function () {}, removeItem: function () {} };
        global.fetch = jest.fn(() => Promise.resolve({ ok: true, json: () => Promise.resolve({}) }));
        require('../assets/site-config-persistence.js');
        SiteConfig = global.window.GAIP_SiteConfig;
    });

    test('a patch carrying a pre-computed nutritionProgramCoords key persists it', () => {
        SiteConfig.mergeConfig('site-1', {
            nutritionCalendarProgram: { meta: { lat: -36.85, lon: 174.76 }, annual_totals: {} },
            nutritionProgramCoords: { lat: -36.85, lon: 174.76 },
        });
        const cfg = SiteConfig.getConfig('site-1');
        expect(cfg.nutritionProgramCoords).toEqual({ lat: -36.85, lon: 174.76 });
    });

    test('a patch with no nutritionProgramCoords key at all (e.g. an unrelated nzDistributor patch) does not touch an existing stamp', () => {
        SiteConfig.mergeConfig('site-1', {
            nutritionCalendarProgram: { meta: { lat: -36.85, lon: 174.76 }, annual_totals: {} },
            nutritionProgramCoords: { lat: -36.85, lon: 174.76 },
        });
        SiteConfig.mergeConfig('site-1', { nzDistributor: 'prebble' });
        const cfg = SiteConfig.getConfig('site-1');
        expect(cfg.nutritionProgramCoords).toEqual({ lat: -36.85, lon: 174.76 });
    });
});

describe('GH-371 — nutrition-calendar.js: persistSiteConfigPatch() is the real shared stamping chokepoint (both persistence paths)', () => {
    // REGRESSION COVERAGE for a gap a live Playwright run against the real
    // dev stack found: stamping only inside site-config-persistence.js's
    // mergeConfig() left Plan (plan.blade.php) completely unstamped, because
    // that page never loads site-config-persistence.js at all and
    // persistSiteConfigPatch() falls through to its OWN direct-PUT fallback
    // — confirmed live via a direct DB read after generating a programme
    // from Plan: nutritionProgramCoords was NULL server-side. Moved the
    // stamping computation into persistSiteConfigPatch() itself, the one
    // function this file's own comment already documents as the shared
    // chokepoint for both pages.
    function setupWindow(withSiteConfig) {
        jest.resetModules();
        global.window = { GAIP_HUB_CONFIG: { activeSiteId: 'site-1', restUrl: 'https://example.test/api/' } };
        global.document = makeDomStub({});
        global.console = { log: function () {}, warn: function () {}, error: function () {}, info: function () {} };
        global.localStorage = { getItem: function () { return null; }, setItem: function () {} };
        global.window.GilbaGrowthPotentialEngine = require('../assets/growth-potential-engine.js');
        if (withSiteConfig) {
            global.window.GAIP_SiteConfig = { mergeConfig: jest.fn(() => true) };
        }
        require('../assets/nutrition-calendar.js');
        return global.window.GilbaNutritionCalendar;
    }

    test('hub-page path (GAIP_SiteConfig present): mergeConfig() receives a patch already carrying nutritionProgramCoords', () => {
        const NC = setupWindow(true);
        NC.persistSiteConfigPatch({
            nutritionCalendarProgram: { meta: { lat: -36.85, lon: 174.76 }, annual_totals: {} },
        });
        expect(global.window.GAIP_SiteConfig.mergeConfig).toHaveBeenCalledWith('site-1', expect.objectContaining({
            nutritionProgramCoords: { lat: -36.85, lon: 174.76 },
        }));
    });

    test('Plan-page path (GAIP_SiteConfig absent, the exact regression the live run found): the direct-PUT body carries nutritionProgramCoords too', () => {
        const NC = setupWindow(false);
        global.fetch = jest.fn(() => Promise.resolve({ text: () => Promise.resolve('{}') }));
        NC.persistSiteConfigPatch({
            nutritionCalendarProgram: { meta: { lat: -36.85, lon: 174.76 }, annual_totals: {} },
        });
        expect(global.fetch).toHaveBeenCalled();
        const putBody = JSON.parse(global.fetch.mock.calls[0][1].body);
        expect(putBody.config.nutritionProgramCoords).toEqual({ lat: -36.85, lon: 174.76 });
    });

    test('a patch with no real coordinates on nutritionCalendarProgram.meta does not add a nutritionProgramCoords key at all', () => {
        const NC = setupWindow(true);
        NC.persistSiteConfigPatch({ nutritionCalendarProgram: { meta: {}, annual_totals: {} } });
        const calledWith = global.window.GAIP_SiteConfig.mergeConfig.mock.calls[0][1];
        expect(calledWith).not.toHaveProperty('nutritionProgramCoords');
    });

    test('an unrelated patch (no nutritionCalendarProgram at all) does not add a nutritionProgramCoords key', () => {
        const NC = setupWindow(true);
        NC.persistSiteConfigPatch({ nzDistributor: 'prebble' });
        const calledWith = global.window.GAIP_SiteConfig.mergeConfig.mock.calls[0][1];
        expect(calledWith).not.toHaveProperty('nutritionProgramCoords');
    });
});

describe('GH-371 — site-config-persistence.js: snapshotConfig() drops cached programmes on a coordinate mismatch, carries them forward on a match', () => {
    let SiteConfig;

    function setup() {
        jest.resetModules();
        global.window = {};
        global.console = { log: function () {}, warn: function () {}, error: function () {}, info: function () {} };
        global.localStorage = { getItem: function () { return null; }, setItem: function () {}, removeItem: function () {} };
        global.fetch = jest.fn(() => Promise.resolve({ ok: true, json: () => Promise.resolve({}) }));
    }

    test('coordinates unchanged since the cached programme was generated — carried forward', () => {
        setup();
        global.document = makeDomStub({ '.gaip-lat': '-36.85', '.gaip-lon': '174.76' });
        global.window.GAIP_SampleManager = { getActiveSiteId: function () { return 'site-1'; } };
        require('../assets/site-config-persistence.js');
        SiteConfig = global.window.GAIP_SiteConfig;

        SiteConfig.mergeConfig('site-1', {
            nutritionCalendarProgram: { meta: { lat: -36.85, lon: 174.76 }, annual_totals: { N: 200 } },
            nutritionProgram: { monthly: [{ N: 16 }] },
            // Computed upstream by persistSiteConfigPatch() in real use (see
            // its own dedicated describe block) — supplied directly here
            // since this block is testing snapshotConfig(), not the stamp
            // computation itself.
            nutritionProgramCoords: { lat: -36.85, lon: 174.76 },
        });

        const snapshot = SiteConfig.snapshot();
        expect(snapshot.nutritionCalendarProgram).toBeTruthy();
        expect(snapshot.nutritionProgram).toBeTruthy();
        expect(snapshot.nutritionProgramCoords).toEqual({ lat: -36.85, lon: 174.76 });
    });

    test('coordinates changed since the cached programme was generated — dropped, not carried forward (the D01 regression case)', () => {
        setup();
        // Programme was generated for Auckland; the DOM (this snapshot's own
        // fresh read) now shows Canberra — a real site-record coordinate
        // write happened in between, same as the audit's E2->E3 delta.
        global.document = makeDomStub({ '.gaip-lat': '-35.2809', '.gaip-lon': '149.1300' });
        global.window.GAIP_SampleManager = { getActiveSiteId: function () { return 'site-1'; } };
        require('../assets/site-config-persistence.js');
        SiteConfig = global.window.GAIP_SiteConfig;

        SiteConfig.mergeConfig('site-1', {
            nutritionCalendarProgram: { meta: { lat: -36.8508827, lon: 174.7644881 }, annual_totals: { N: 200 } },
            nutritionProgram: { monthly: [{ N: 16 }] },
            nutritionProgramCoords: { lat: -36.8508827, lon: 174.7644881 },
        });

        const snapshot = SiteConfig.snapshot();
        expect(snapshot.nutritionCalendarProgram).toBeUndefined();
        expect(snapshot.nutritionProgram).toBeUndefined();
        expect(snapshot.nutritionProgramCoords).toBeUndefined();
    });

    test('a sub-0.01-degree drift (rounding noise, not a real move) is still carried forward', () => {
        setup();
        global.document = makeDomStub({ '.gaip-lat': '-36.8509', '.gaip-lon': '174.7645' }); // ~0.0001 off
        global.window.GAIP_SampleManager = { getActiveSiteId: function () { return 'site-1'; } };
        require('../assets/site-config-persistence.js');
        SiteConfig = global.window.GAIP_SiteConfig;

        SiteConfig.mergeConfig('site-1', {
            nutritionCalendarProgram: { meta: { lat: -36.8508827, lon: 174.7644881 }, annual_totals: { N: 200 } },
            nutritionProgramCoords: { lat: -36.8508827, lon: 174.7644881 },
        });

        const snapshot = SiteConfig.snapshot();
        expect(snapshot.nutritionCalendarProgram).toBeTruthy();
    });

    test('no stamp on the cached programme (legacy data, saved before this fix) is trusted as-is — forward-looking guard, not retroactive', () => {
        setup();
        global.document = makeDomStub({ '.gaip-lat': '-35.2809', '.gaip-lon': '149.1300' });
        global.window.GAIP_SampleManager = { getActiveSiteId: function () { return 'site-1'; } };
        require('../assets/site-config-persistence.js');
        SiteConfig = global.window.GAIP_SiteConfig;

        // Simulate legacy stored data with no nutritionProgramCoords at all —
        // written by mergeConfig() directly bypassing the stamp (as if from
        // before GH-371 shipped).
        SiteConfig.mergeConfig('site-1', { nutritionCalendarProgram: { meta: {}, annual_totals: { N: 200 } } });

        const snapshot = SiteConfig.snapshot();
        expect(snapshot.nutritionCalendarProgram).toBeTruthy();
    });
});

describe('GH-371 — site-config-persistence.js: restoreConfig() refuses to restore a coordinate-mismatched cached programme', () => {
    function setup() {
        jest.resetModules();
        global.window = {};
        global.document = makeDomStub({});
        global.console = { log: function () {}, warn: function () {}, error: function () {}, info: function () {} };
        global.localStorage = { getItem: function () { return null; }, setItem: function () {}, removeItem: function () {} };
        global.fetch = jest.fn(() => Promise.resolve({ ok: true, json: () => Promise.resolve({}) }));
        require('../assets/site-config-persistence.js');
        return global.window.GAIP_SiteConfig;
    }

    test('matching coordinates — both globals are set', () => {
        const SiteConfig = setup();
        SiteConfig.restore({
            location: { lat: -36.85, lon: 174.76 },
            nutritionProgramCoords: { lat: -36.85, lon: 174.76 },
            nutritionCalendarProgram: { meta: { lat: -36.85, lon: 174.76 }, annual_totals: { N: 200 } },
            nutritionProgram: { monthly: [] },
        }, 'site-1');
        expect(global.window.GAIP_NUTRITION_CALENDAR_PROGRAM).toBeTruthy();
        expect(global.window.GAIP_NUTRITION_PROGRAM).toBeTruthy();
    });

    test('mismatched coordinates — neither global is set (the D01 regression case)', () => {
        const SiteConfig = setup();
        delete global.window.GAIP_NUTRITION_CALENDAR_PROGRAM;
        delete global.window.GAIP_NUTRITION_PROGRAM;
        SiteConfig.restore({
            location: { lat: -35.2809, lon: 149.1300 }, // site record now says Canberra
            nutritionProgramCoords: { lat: -36.8508827, lon: 174.7644881 }, // cached programme was for Auckland
            nutritionCalendarProgram: { meta: { lat: -36.8508827, lon: 174.7644881 }, annual_totals: { N: 200 } },
            nutritionProgram: { monthly: [] },
        }, 'site-1');
        expect(global.window.GAIP_NUTRITION_CALENDAR_PROGRAM).toBeUndefined();
        expect(global.window.GAIP_NUTRITION_PROGRAM).toBeUndefined();
    });

    test('no stamp at all (legacy config) — restored as before, not retroactively blocked', () => {
        const SiteConfig = setup();
        delete global.window.GAIP_NUTRITION_CALENDAR_PROGRAM;
        SiteConfig.restore({
            location: { lat: -35.2809, lon: 149.1300 },
            nutritionCalendarProgram: { meta: {}, annual_totals: { N: 200 } },
        }, 'site-1');
        expect(global.window.GAIP_NUTRITION_CALENDAR_PROGRAM).toBeTruthy();
    });
});

describe('GH-371 — nutrition-calendar.js: restoreFromPersisted() does not render a coordinate-mismatched persisted programme', () => {
    function setup(domCoords) {
        jest.resetModules();
        global.window = {};
        global.document = makeDomStub(domCoords);
        global.console = { log: function () {}, warn: function () {}, error: function () {}, info: function () {} };
        global.localStorage = { getItem: function () { return null; }, setItem: function () {} };
        global.window.GilbaGrowthPotentialEngine = require('../assets/growth-potential-engine.js');
        require('../assets/nutrition-calendar.js');
        var NC = global.window.GilbaNutritionCalendar;
        // Minimal DOM so init() finds its container without throwing, and
        // renderResults()/renderCalendar() have somewhere to write.
        var resultsEl = { style: {}, innerHTML: '' };
        var calendarEl = { innerHTML: '' };
        var summaryEl = { innerHTML: '' };
        NC.elements = {
            container: {},
            results: resultsEl,
            calendar: calendarEl,
            summary: summaryEl,
            generateBtn: null, distributionSelect: null, annualNInput: null,
            maxNInput: null, clippingSelect: null, monthlyNInput: null,
        };
        return NC;
    }

    test('coordinates match — the persisted programme renders (this.program gets set)', () => {
        const NC = setup({ '.gaip-lat': '-36.85', '.gaip-lon': '174.76' });
        global.window.GAIP_NUTRITION_CALENDAR_PROGRAM = {
            meta: { lat: -36.85, lon: 174.76, hemisphere: 'south' },
            annual_totals: { N: 200, P: 20, K: 100 },
            adjustments: { target_n: 200, n_recycled: 0 },
            program: { monthly: [] },
        };
        NC.restoreFromPersisted();
        expect(NC.program).toBeTruthy();
        expect(NC.program.annual_totals.N).toBe(200);
    });

    test('coordinates mismatch — the persisted programme is NOT rendered, stale-coordinates banner shown instead (the D01 regression case)', () => {
        const NC = setup({ '.gaip-lat': '-35.2809', '.gaip-lon': '149.1300' }); // now Canberra
        global.window.GAIP_NUTRITION_CALENDAR_PROGRAM = {
            meta: { lat: -36.8508827, lon: 174.7644881, hemisphere: 'south' }, // cached for Auckland
            annual_totals: { N: 200, P: 20, K: 100 },
            adjustments: { target_n: 200, n_recycled: 0 },
            program: { monthly: [] },
        };
        NC.restoreFromPersisted();
        expect(NC.program).toBeNull();
        expect(NC.elements.calendar.innerHTML).toMatch(/coordinates changed/i);
        expect(global.window.GAIP_NUTRITION_PROGRAM_UNAVAILABLE).toBe(true);
    });

    test('no stamp on the persisted programme (legacy) — renders as before, not retroactively blocked', () => {
        const NC = setup({ '.gaip-lat': '-35.2809', '.gaip-lon': '149.1300' });
        global.window.GAIP_NUTRITION_CALENDAR_PROGRAM = {
            meta: { hemisphere: 'south' }, // no lat/lon at all
            annual_totals: { N: 200, P: 20, K: 100 },
            adjustments: { target_n: 200, n_recycled: 0 },
            program: { monthly: [] },
        };
        NC.restoreFromPersisted();
        expect(NC.program).toBeTruthy();
    });
});

describe('GH-371 — audit D01 scenario shape: a stale cached series does not survive a coordinate-driven recompute', () => {
    // The audit's own nine-month renormalisation table (D01) shows the
    // UI/export sharing a pre-coordinate-correction GP series to within 0.3
    // kg across nine months while a sibling surface had already picked up
    // the corrected coordinates. Reproduced here at the mechanism level:
    // two computeProgram() calls for genuinely different coordinates (a
    // stand-in for "before" and "after" the operator's coordinate
    // correction) must not silently collapse to the same cached result once
    // the staleness check is in the loop -- i.e. the stamp actually
    // discriminates the two real cases the audit's evidence rests on.
    let NutritionCalendar;
    beforeAll(() => {
        global.window = global.window || {};
        global.document = global.document || makeDomStub({});
        global.console = { log: function () {}, warn: function () {}, error: function () {}, info: function () {} };
        global.localStorage = { getItem: function () { return null; }, setItem: function () {} };
        global.window.GilbaGrowthPotentialEngine = require('../assets/growth-potential-engine.js');
        require('../assets/nutrition-calendar.js');
        NutritionCalendar = global.window.GilbaNutritionCalendar;
    });

    test('a wrong-coordinate (pre-correction) computation and a corrected computation carry distinguishable stamps, so a restore/carry-forward check downstream can tell them apart', () => {
        // "Before": operator's site record still has an inland/wrong
        // coordinate (audit's own description: "a real inland record, on
        // the wrong site" — annual mean 14.0C, range 17.2 -- represented
        // here just by its coordinate, not by re-deriving that climate).
        const preCorrection = NutritionCalendar.computeProgram(
            baseInputs({ latitude: -33.8688, longitude: 151.2093 }) // Sydney-ish, wrong site
        );
        // "After": operator corrects the site record to the real Auckland
        // coordinates (audit's own corrected value).
        const postCorrection = NutritionCalendar.computeProgram(
            baseInputs({ latitude: -36.8508827, longitude: 174.7644881 })
        );

        expect(preCorrection.meta.lat).not.toBeCloseTo(postCorrection.meta.lat, 1);
        // This is exactly the pair of numbers snapshotConfig()/restoreConfig()/
        // restoreFromPersisted() now diff against 0.01 degrees to decide
        // whether a cached copy survives — assert the drift comfortably
        // clears that threshold for this real pair, so the "before" stamp
        // could never be mistaken for "after".
        const drift = Math.abs(preCorrection.meta.lat - postCorrection.meta.lat);
        expect(drift).toBeGreaterThan(0.01);
    });
});

describe('GH-371 follow-up (independent review) — settings-init.js: neither Settings save handler can send stale cache fields back to updateConfig()', () => {
    // Structural pin, matching this repo's established convention for this
    // file (settings-init.js runs a large amount of DOM-querying setup code
    // immediately as one top-level IIFE across many independent widgets —
    // too many unrelated DOM dependencies to functionally load in a unit
    // test sandbox without also having to stub every other section on the
    // page, mirroring the same reasoning already used above for
    // word-export.js). The three keys' removal is unconditional, unbranched
    // JS (no arithmetic/conditional logic to mis-test), and the actual
    // end-to-end behaviour is covered functionally by the PHP feature tests
    // in GH371CoordinateInvalidationTest.php plus this project's live
    // verification against the real dev stack.
    let src;
    beforeAll(() => {
        const fs = require('fs');
        const path = require('path');
        src = fs.readFileSync(path.join(__dirname, '../assets/settings-init.js'), 'utf8');
    });

    test('the site form clones D.gaipConfig, then strips all three cache keys before building the location update', () => {
        const cloneIdx = src.indexOf("var cfg = JSON.parse(JSON.stringify(D.gaipConfig || {}));");
        expect(cloneIdx).toBeGreaterThan(-1);
        const putIdx = src.indexOf("apiFetch('PUT', '/sites/' + encodeURIComponent(siteId) + '/config/gaip', { config: cfg }),");
        expect(putIdx).toBeGreaterThan(cloneIdx);
        const between = src.slice(cloneIdx, putIdx);
        expect(between).toMatch(/delete cfg\.nutritionProgram;/);
        expect(between).toMatch(/delete cfg\.nutritionCalendarProgram;/);
        expect(between).toMatch(/delete cfg\.nutritionProgramCoords;/);
    });

    test('both config/gaip PUT call sites built from a D.gaipConfig clone are preceded by the strip (site form and turf form)', () => {
        const cloneMarker = "var cfg = JSON.parse(JSON.stringify(D.gaipConfig || {}));";
        // Both handlers PUT `{ config: cfg }` where cfg traces back to the
        // nearest preceding D.gaipConfig clone — walk each clone site
        // forward to its own PUT call and assert the strip sits between.
        const cloneSites = [];
        let from = 0;
        while (true) {
            const idx = src.indexOf(cloneMarker, from);
            if (idx === -1) break;
            cloneSites.push(idx);
            from = idx + cloneMarker.length;
        }
        expect(cloneSites.length).toBe(2); // site form + turf form

        cloneSites.forEach(function (cloneIdx) {
            const putIdx = src.indexOf('config: cfg }', cloneIdx);
            expect(putIdx).toBeGreaterThan(cloneIdx);
            const between = src.slice(cloneIdx, putIdx);
            expect(between).toMatch(/delete cfg\.nutritionProgram;/);
            expect(between).toMatch(/delete cfg\.nutritionCalendarProgram;/);
            expect(between).toMatch(/delete cfg\.nutritionProgramCoords;/);
        });
    });

    test('the strip runs unconditionally in BOTH handlers (not gated behind a coordinate-changed check) — these keys are never legitimately needed by either form', () => {
        // Regression coverage for a real gap an independent review found in
        // the first cut of this test: indexOf() alone only ever finds the
        // FIRST occurrence (the site form's), so this assertion silently
        // never covered the turf form's own strip at all. Walk every
        // occurrence explicitly instead.
        const marker = 'delete cfg.nutritionProgram;';
        const occurrences = [];
        let from = 0;
        while (true) {
            const idx = src.indexOf(marker, from);
            if (idx === -1) break;
            occurrences.push(idx);
            from = idx + marker.length;
        }
        expect(occurrences.length).toBe(2); // site form + turf form

        occurrences.forEach(function (idx) {
            const precedingLines = src.slice(0, idx).split('\n').slice(-6).join('\n');
            expect(precedingLines).not.toMatch(/if\s*\(/);
        });
    });
});

describe('GH-371 — word-export.js: Nutrition Program / Monthly Schedule read gains a coordinate-staleness check alongside the existing cross-site check', () => {
    let src;
    beforeAll(() => {
        const fs = require('fs');
        const path = require('path');
        src = fs.readFileSync(path.join(__dirname, '../assets/word-export.js'), 'utf8');
    });

    // Structural pin, matching this repo's established convention for this
    // file (too many docx/DOM/global dependencies to functionally exercise
    // collectData()'s full run in a unit-test sandbox) — the underlying
    // comparison logic (drift > 0.01 degrees) is the exact same code shape
    // already functionally tested above for nutrition-calendar.js/site-
    // config-persistence.js, so a structural pin here is checking that this
    // read site was actually wired to it, not re-testing the arithmetic.
    test('the nutritionProgram accept-condition now also requires !_coordsStale', () => {
        // GH-377 amended this pin: the same accept-condition gained a second
        // staleness flag (!_inputsStale, species/methodology) next to the
        // coordinate one — see tests/gh377-program-input-invalidation.test.js.
        expect(src).toMatch(/if \(\(!progSiteId \|\| !currentSiteId \|\| progSiteId === currentSiteId\) && !_coordsStale && !_inputsStale\)/);
    });

    test('_coordsStale is derived from GAIP_SiteConfig\'s nutritionProgramCoords stamp vs collectFromState()\'s current coordinates', () => {
        expect(src).toMatch(/window\.GAIP_SiteConfig\.getConfig\(currentSiteId\)/);
        expect(src).toMatch(/window\.GilbaNutritionCalendar\.collectFromState/);
        expect(src).toMatch(/nutritionProgramCoords/);
    });

    test('the check is defensive (try/catch) so a lookup failure degrades to "not stale" rather than breaking the export', () => {
        const idx = src.indexOf('var _coordsStale = false;');
        expect(idx).toBeGreaterThan(-1);
        const nearby = src.slice(idx, idx + 1600);
        expect(nearby).toMatch(/try \{/);
        expect(nearby).toMatch(/catch \(_coordCheckErr\)/);
    });
});

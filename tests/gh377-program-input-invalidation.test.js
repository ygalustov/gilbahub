/**
 * GH-377 — follow-up to GH-371 (Hoxton audit D01). GH-371 stamps the
 * coordinates a cached nutrition programme was computed against and refuses
 * the cached copy when the site's coordinates no longer match. Coordinates
 * are not the only input computeProgram() depends on: species drives the
 * C3/C4 growth-potential curve and the per-species removal/certificate
 * resolution, methodology selects the MLSN/SLAN/AA threshold family. Both
 * were already stamped in program.meta on every compute (meta.species = the
 * nutrient-engine key collectFromState() resolved, meta.methodology = the
 * same value upper-cased) but never compared, so a cached programme computed
 * under the old species/methodology kept rendering after a change. The
 * concrete resurrecting path is GH-371's own follow-up: a config/gaip PUT
 * carrying a new `turf` but no fresh stamp (Settings' turf form, the
 * import-bundle flow) makes the server carry the existing DB programme
 * forward next to the new turf.
 *
 * FIX: a second comparison next to the coordinate one, at the same points —
 * restoreFromPersisted() (nutrition-calendar.js), restoreConfig() and
 * snapshotConfig()'s carry-forward (site-config-persistence.js), and the
 * Monthly Schedule read in word-export.js — sharing one pair of helpers
 * (collectProgramInputCandidates / programInputsDrift). Forward-looking, not
 * retroactive: absent stamp fields or an unresolvable current state mean
 * "trust as-is". Over-invalidation guards: species compared as the nutrient
 * KEY with only the current side normalised (toNutrientKey is not
 * idempotent), the current species is a SET (effective + base + overseed),
 * methodology aliases are folded and the NZ auto-AA rule applied.
 *
 * Every real-shape fixture below was read from the dev DB
 * (site_configs.config, namespace gaip) on 2026-09-09 — the exact
 * turf.species display labels, lower-case turf.methodology values and the
 * meta block computeProgram() actually stamped for those sites.
 */

'use strict';

const fs = require('fs');
const path = require('path');
const vm = require('vm');

// ─────────────────────────────────────────────────────────────────────────
// Shared DOM/window scaffolding (same shape as gh371's tests)
// ─────────────────────────────────────────────────────────────────────────

function makeDomStub(overrides) {
    var values = Object.assign({}, overrides);
    return {
        readyState: 'complete',
        addEventListener: function () {},
        removeEventListener: function () {},
        querySelector: function (sel) {
            if (Object.prototype.hasOwnProperty.call(values, sel)) {
                var v = values[sel];
                // dispatchEvent: site-config-persistence.js's setDomVal() fires a
                // change Event on every element it writes during restore().
                return v === null ? null : { value: v, dispatchEvent: function () { return true; } };
            }
            return null;
        },
        querySelectorAll: function () { return []; },
        getElementById: function () { return null; },
        dispatchEvent: function () { return true; },
        createElement: function () { return { style: {}, classList: { add: function () {}, remove: function () {} } }; },
    };
}

if (typeof global.CustomEvent === 'undefined') {
    global.CustomEvent = function (type, params) {
        this.type = type;
        this.detail = params && params.detail;
    };
}
if (typeof global.Event === 'undefined') {
    global.Event = function (type, params) {
        this.type = type;
        this.bubbles = !!(params && params.bubbles);
    };
}

function resetSandbox(domValues) {
    jest.resetModules();
    global.window = {};
    global.document = makeDomStub(domValues || {});
    global.console = { log: function () {}, warn: function () {}, error: function () {}, info: function () {} };
    global.localStorage = { getItem: function () { return null; }, setItem: function () {}, removeItem: function () {} };
    global.fetch = jest.fn(() => Promise.resolve({ ok: true, json: () => Promise.resolve({}) }));
}

// The real SpeciesController — every production page that runs these checks
// loads it (plan, hub, reports/export, scenarios, forensic), and the
// normalisation under test is normalizeSpecies() delegating to it.
function loadSpeciesController() {
    require('../assets/species-controller.js');
    expect(global.window.SpeciesController).toBeTruthy();
}

function loadCalendar() {
    global.window.GilbaGrowthPotentialEngine = require('../assets/growth-potential-engine.js');
    require('../assets/nutrition-calendar.js');
    return global.window.GilbaNutritionCalendar;
}

function loadSiteConfig() {
    require('../assets/site-config-persistence.js');
    return global.window.GAIP_SiteConfig;
}

// The REAL plan.blade.php GAIP_STATE bridge (the inline IIFE that turns
// GAIP_SITE_CONFIG/GAIP_HUB_CONFIG into the GAIP_STATE shape collectFromState()
// reads on /plan), extracted from the blade source and run as-is — not a
// re-implementation. Same vm technique gh375's tests established.
function runRealPlanBridge() {
    const blade = fs.readFileSync(path.join(__dirname, '../app/resources/views/plan.blade.php'), 'utf8');
    const marker = '// Bridge: populate GAIP_STATE for nutrition-calendar.js';
    const markerIdx = blade.indexOf(marker);
    expect(markerIdx).toBeGreaterThan(-1);
    const start = blade.indexOf('(function () {', markerIdx);
    const end = blade.indexOf('})();', start) + '})();'.length;
    expect(start).toBeGreaterThan(markerIdx);
    expect(end).toBeGreaterThan(start);
    vm.runInNewContext(blade.slice(start, end), {
        window: global.window,
        console: global.console,
    });
    expect(global.window.GAIP_STATE).toBeTruthy();
}

function calendarElements(NC) {
    NC.elements = {
        container: {},
        results: { style: {}, innerHTML: '' },
        calendar: { innerHTML: '' },
        summary: { innerHTML: '' },
        generateBtn: null, distributionSelect: null, annualNInput: null,
        maxNInput: null, clippingSelect: null, monthlyNInput: null,
    };
}

// ─────────────────────────────────────────────────────────────────────────
// Real cached programmes from the dev DB (trimmed to the fields under test)
// ─────────────────────────────────────────────────────────────────────────

const REAL_SITES = [
    {
        name: 'Burns',
        turf: { species: 'Creeping Bentgrass (Greens)', methodology: 'mlsn', turfType: 'golf', subCategory: 'greens' },
        location: { lat: -35.2285452, lon: 149.0022925 },
        meta: { species: 'bentgrass', speciesDisplay: 'Creeping Bentgrass (Greens)', methodology: 'MLSN', surfaceType: 'greens',
            hemisphere: 'south', distribution: 'gp_weighted', clippingManagement: 'collected', lat: -35.2285452, lon: 149.0022925 },
    },
    {
        // Browntop: the non-idempotent toNutrientKey() case (browntopBent -> creepingBentgrass)
        name: 'Russley',
        turf: { species: 'Browntop Bent (Greens)', methodology: 'ammonium_acetate', turfType: 'golf', subCategory: 'greens' },
        location: { lat: -43.495388, lon: 172.5560607 },
        meta: { species: 'creepingBentgrass', speciesDisplay: 'Browntop Bent (Greens)', methodology: 'AMMONIUM_ACETATE', surfaceType: 'greens',
            hemisphere: 'south', distribution: 'gp_weighted', clippingManagement: 'collected' },
    },
    {
        name: 'Test5 - NZ',
        turf: { species: 'Perennial Ryegrass', methodology: 'ammonium_acetate', turfType: 'sports', subCategory: 'soccer' },
        location: { lat: -36.8508827, lon: 174.7644881 },
        meta: { species: 'perennialRyegrass', speciesDisplay: 'Perennial Ryegrass', methodology: 'AMMONIUM_ACETATE', surfaceType: 'soccer',
            hemisphere: 'south', distribution: 'gp_weighted', clippingManagement: 'collected', lat: -36.8508827, lon: 174.7644881 },
    },
    {
        // subCategory null, surfaceType resolved to 'lawns' — the shape that would nag on every load if surfaceType were compared
        name: 'Westview',
        turf: { species: 'Buffalograss', methodology: 'mlsn', turfType: 'lawns', subCategory: null },
        location: { lat: -34.0745713, lon: 150.7828294 },
        meta: { species: 'buffalograss', speciesDisplay: 'Buffalograss', methodology: 'MLSN', surfaceType: 'lawns',
            hemisphere: 'south', distribution: 'gp_weighted', clippingManagement: 'collected' },
    },
    {
        // Generated before GH-371 shipped: no lat/lon in meta, no nutritionProgramCoords
        name: 'New test - location',
        turf: { species: 'Creeping Bentgrass (Greens)', methodology: 'slan', turfType: 'golf', subCategory: 'greens' },
        location: { lat: -34.437, lon: 150.8994 },
        meta: { species: 'bentgrass', speciesDisplay: 'Creeping Bentgrass (Greens)', methodology: 'SLAN', surfaceType: 'greens',
            hemisphere: 'south', distribution: 'gp_weighted', clippingManagement: 'collected' },
    },
    {
        name: 'Test1 - Sports',
        turf: { species: 'Perennial Ryegrass', methodology: 'mlsn', turfType: 'sports', subCategory: 'soccer' },
        location: { lat: -35.2213, lon: 149.0002 },
        meta: { species: 'perennialRyegrass', speciesDisplay: 'Perennial Ryegrass', methodology: 'MLSN', surfaceType: 'soccer',
            hemisphere: 'south', distribution: 'gp_weighted', clippingManagement: 'collected' },
    },
];

function programFor(site, metaOverrides) {
    return {
        meta: Object.assign({}, site.meta, metaOverrides || {}),
        annual_totals: { N: 200, P: 20, K: 100 },
        adjustments: { target_n: 200, n_recycled: 0 },
        program: { monthly: [] },
    };
}

function siteConfigFor(site, overrides) {
    const cfg = {
        turf: Object.assign({}, site.turf),
        location: Object.assign({}, site.location),
        nutritionCalendarProgram: programFor(site),
        nutritionProgram: { monthly: [{ N: 16 }], _generatedForSite: 'site-1' },
    };
    if (typeof site.meta.lat === 'number' && typeof site.meta.lon === 'number') {
        cfg.nutritionProgramCoords = { lat: site.meta.lat, lon: site.meta.lon };
    }
    return Object.assign(cfg, overrides || {});
}

// ─────────────────────────────────────────────────────────────────────────
// 1. The comparison itself (pure helpers, real SpeciesController)
// ─────────────────────────────────────────────────────────────────────────

describe('GH-377 — nutrition-calendar.js: collectProgramInputCandidates() + programInputsDrift()', () => {
    let NC;
    beforeEach(() => {
        resetSandbox({});
        loadSpeciesController();
        NC = loadCalendar();
    });

    test('precondition: the production normalisation chain maps every real turf.species label to the key the DB shows stamped in meta', () => {
        REAL_SITES.forEach((site) => {
            expect(NC.normalizeSpecies(site.turf.species)).toBe(site.meta.species);
        });
    });

    test('precondition pin: toNutrientKey() is NOT idempotent — re-normalising a stamped browntop key would NOT round-trip, which is why the stamp is compared raw', () => {
        expect(NC.normalizeSpecies('Browntop Bent (Greens)')).toBe('creepingBentgrass');
        expect(NC.normalizeSpecies('creepingBentgrass')).toBe('bentgrass'); // the trap
    });

    test('no-change case on every real cached programme in the dev DB: nothing drifts (the "nag on every load" regression guard)', () => {
        REAL_SITES.forEach((site) => {
            const candidates = NC.collectProgramInputCandidates({ turfs: site.turf, lat: site.location.lat, lon: site.location.lon });
            expect({ site: site.name, drift: NC.programInputsDrift(site.meta, candidates) })
                .toEqual({ site: site.name, drift: [] });
        });
    });

    test('species change: Burns re-configured from Creeping Bentgrass to Perennial Ryegrass drifts on species only', () => {
        const burns = REAL_SITES[0];
        const candidates = NC.collectProgramInputCandidates({
            turfs: Object.assign({}, burns.turf, { species: 'Perennial Ryegrass' }),
            lat: burns.location.lat, lon: burns.location.lon,
        });
        expect(NC.programInputsDrift(burns.meta, candidates)).toEqual([
            { field: 'species', was: 'bentgrass', now: 'perennialRyegrass' },
        ]);
    });

    test('species change to a C4 (the GP-curve-inverting case) is caught the same way', () => {
        const test1 = REAL_SITES[5];
        const candidates = NC.collectProgramInputCandidates({
            turfs: Object.assign({}, test1.turf, { species: 'Couch' }),
            lat: test1.location.lat, lon: test1.location.lon,
        });
        const drift = NC.programInputsDrift(test1.meta, candidates);
        expect(drift.length).toBe(1);
        expect(drift[0]).toEqual({ field: 'species', was: 'perennialRyegrass', now: 'bermuda' });
        expect(NC.isC4Species(drift[0].now)).toBe(true);
        expect(NC.isC4Species(drift[0].was)).toBe(false);
    });

    test('methodology change: "New test - location" switched from SLAN to MLSN drifts on methodology only', () => {
        const site = REAL_SITES[4];
        const candidates = NC.collectProgramInputCandidates({
            turfs: Object.assign({}, site.turf, { methodology: 'mlsn' }),
            lat: site.location.lat, lon: site.location.lon,
        });
        expect(NC.programInputsDrift(site.meta, candidates)).toEqual([
            { field: 'methodology', was: 'slan', now: 'mlsn' },
        ]);
    });

    test('both changed at once: both fields reported, species first', () => {
        const burns = REAL_SITES[0];
        const candidates = NC.collectProgramInputCandidates({
            turfs: { species: 'Perennial Ryegrass', methodology: 'slan' },
            lat: burns.location.lat, lon: burns.location.lon,
        });
        expect(NC.programInputsDrift(burns.meta, candidates).map((d) => d.field)).toEqual(['species', 'methodology']);
    });

    test('methodology is compared case-insensitively with every accepted alias folded (no false positive between MLSN/mlsn, AMMONIUM_ACETATE/aa/cotula_s78)', () => {
        expect(NC.normalizeMethodology('MLSN')).toBe('mlsn');
        expect(NC.normalizeMethodology('  Slan ')).toBe('slan');
        ['AMMONIUM_ACETATE', 'ammonium_acetate', 'ammonium-acetate', 'Ammonium Acetate', 'aa', 'ammoniumacetate', 'cotula_s78', 'cotula']
            .forEach((alias) => expect(NC.normalizeMethodology(alias)).toBe('ammonium_acetate'));
        expect(NC.normalizeMethodology('')).toBe('');
        expect(NC.normalizeMethodology(null)).toBe('');
        expect(NC.normalizeMethodology(undefined)).toBe('');

        const aaMeta = { species: 'cotula', methodology: 'AMMONIUM_ACETATE' };
        expect(NC.programInputsDrift(aaMeta, { speciesKeys: ['cotula'], methodologies: ['cotula_s78'] })).toEqual([]);
        expect(NC.programInputsDrift(aaMeta, { speciesKeys: ['cotula'], methodologies: ['aa'] })).toEqual([]);
        expect(NC.programInputsDrift({ methodology: 'MLSN' }, { speciesKeys: [], methodologies: ['mlsn'] })).toEqual([]);
    });

    test('absent meta fields (a programme cached before species/methodology were stamped) never drift, even when the site clearly differs — forward-looking, not retroactive', () => {
        const candidates = NC.collectProgramInputCandidates({ turfs: { species: 'Couch', methodology: 'slan' } });
        expect(NC.programInputsDrift({}, candidates)).toEqual([]);
        expect(NC.programInputsDrift({ hemisphere: 'south', lat: -36.85, lon: 174.76 }, candidates)).toEqual([]);
        expect(NC.programInputsDrift({ species: '', methodology: '' }, candidates)).toEqual([]);
        expect(NC.programInputsDrift(null, candidates)).toEqual([]);
        expect(NC.programInputsDrift(undefined, candidates)).toEqual([]);
    });

    test('partial meta: only the stamped field is compared (methodology-only stamp ignores a species difference, and vice versa)', () => {
        const candidates = NC.collectProgramInputCandidates({ turfs: { species: 'Couch', methodology: 'slan' } });
        expect(NC.programInputsDrift({ methodology: 'SLAN' }, candidates)).toEqual([]);
        expect(NC.programInputsDrift({ species: 'bermuda' }, candidates)).toEqual([]);
        expect(NC.programInputsDrift({ methodology: 'MLSN' }, candidates)).toEqual([{ field: 'methodology', was: 'mlsn', now: 'slan' }]);
    });

    test('an unresolvable current state (no species / no methodology anywhere) never drifts — unknown is not "changed"', () => {
        const meta = REAL_SITES[0].meta;
        expect(NC.programInputsDrift(meta, { speciesKeys: [], methodologies: [] })).toEqual([]);
        expect(NC.programInputsDrift(meta, NC.collectProgramInputCandidates({}))).toEqual([]);
        expect(NC.programInputsDrift(meta, NC.collectProgramInputCandidates({ turfs: { species: '', methodology: '' } }))).toEqual([]);
        expect(NC.programInputsDrift(meta, NC.collectProgramInputCandidates({ turfs: [null, undefined, 'not-an-object'] }))).toEqual([]);
        expect(NC.programInputsDrift(meta, null)).toEqual([]);
    });

    test('collectFromState() fallbacks are excluded from the candidates: _speciesDefaulted / _methodologyDefaulted values are not treated as the current configuration', () => {
        const fresh = { species: 'creepingBentgrass', _speciesDefaulted: true, methodology: 'mlsn', _methodologyDefaulted: true };
        expect(NC.collectProgramInputCandidates({ fresh })).toEqual({ speciesKeys: [], methodologies: [] });
        const real = { species: 'perennialRyegrass', _speciesDefaulted: false, methodology: 'slan', _methodologyDefaulted: false };
        expect(NC.collectProgramInputCandidates({ fresh: real })).toEqual({ speciesKeys: ['perennialRyegrass'], methodologies: ['slan'] });
    });

    test('overseed tolerance: a programme stamped with the overseed species (hub pages feed the effective species) is still valid against a config whose BASE is the C4 — and stale once no overseed is configured', () => {
        // hub-tissue-v3.js writes o.turf.effectiveSpecies = coolOverseed for an
        // overseed-dominant C4 site; plan.blade.php's bridge always feeds the
        // base species. The same site can legitimately stamp either key.
        const hubStampedMeta = { species: 'perennialRyegrass', methodology: 'MLSN' };
        const overseeded = NC.collectProgramInputCandidates({ turfs: { species: 'Couch', coolOverseed: 'Perennial Ryegrass', methodology: 'mlsn' } });
        expect(overseeded.speciesKeys).toEqual(['bermuda', 'perennialRyegrass']);
        expect(NC.programInputsDrift(hubStampedMeta, overseeded)).toEqual([]);
        // the hub key spelling of the same field
        const overseededHubKey = NC.collectProgramInputCandidates({ turfs: { species: 'Couch', overseedSpecies: 'Perennial Ryegrass', methodology: 'mlsn' } });
        expect(NC.programInputsDrift(hubStampedMeta, overseededHubKey)).toEqual([]);
        // and the base-stamped programme (generated on Plan) is equally valid on that site
        expect(NC.programInputsDrift({ species: 'bermuda', methodology: 'MLSN' }, overseeded)).toEqual([]);
        // no overseed configured at all -> a ryegrass stamp on a couch site IS stale
        const plainCouch = NC.collectProgramInputCandidates({ turfs: { species: 'Couch', methodology: 'mlsn' } });
        expect(NC.programInputsDrift(hubStampedMeta, plainCouch)).toEqual([{ field: 'species', was: 'perennialRyegrass', now: 'bermuda' }]);
    });

    test('NZ rule: a site config carrying methodology "mlsn" (or none) on NZ coordinates resolves to ammonium_acetate — the same rule plan.blade.php\'s bridge and ammonium-acetate-methodology.js apply before generating — so an AA-stamped programme is not flagged there, but IS on AU coordinates', () => {
        const aaMeta = { species: 'perennialRyegrass', methodology: 'AMMONIUM_ACETATE' };
        const nz = REAL_SITES[2].location; // Test5 - NZ, Auckland
        const au = REAL_SITES[0].location; // Burns, Canberra
        expect(NC.isNZCoordinates(nz.lat, nz.lon)).toBe(true);
        expect(NC.isNZCoordinates(au.lat, au.lon)).toBe(false);
        expect(NC.isNZCoordinates(null, null)).toBe(false);
        expect(NC.resolveSiteMethodology('mlsn', nz.lat, nz.lon)).toBe('ammonium_acetate');
        expect(NC.resolveSiteMethodology('', nz.lat, nz.lon)).toBe('ammonium_acetate');
        expect(NC.resolveSiteMethodology('slan', nz.lat, nz.lon)).toBe('slan'); // an explicit non-MLSN choice is respected on NZ too
        expect(NC.resolveSiteMethodology('mlsn', au.lat, au.lon)).toBe('mlsn');
        expect(NC.resolveSiteMethodology('', au.lat, au.lon)).toBe('');

        const nzTurf = { species: 'Perennial Ryegrass', methodology: 'mlsn' };
        expect(NC.programInputsDrift(aaMeta, NC.collectProgramInputCandidates({ turfs: nzTurf, lat: nz.lat, lon: nz.lon }))).toEqual([]);
        expect(NC.programInputsDrift(aaMeta, NC.collectProgramInputCandidates({ turfs: nzTurf, lat: au.lat, lon: au.lon })))
            .toEqual([{ field: 'methodology', was: 'ammonium_acetate', now: 'mlsn' }]);
    });

    test('the deliberately un-compared meta fields (surfaceType, hemisphere, distribution, clippingManagement, speciesDisplay) never cause drift on their own', () => {
        const westview = REAL_SITES[3];
        const candidates = NC.collectProgramInputCandidates({ turfs: westview.turf, lat: westview.location.lat, lon: westview.location.lon });
        const relabelled = Object.assign({}, westview.meta, {
            surfaceType: 'sports', hemisphere: 'north', distribution: 'even', clippingManagement: 'returned', speciesDisplay: 'BUFFALO GRASS (renamed)',
        });
        expect(NC.programInputsDrift(relabelled, candidates)).toEqual([]);
    });
});

// ─────────────────────────────────────────────────────────────────────────
// 2. collectFromState()'s new _methodologyDefaulted flag (values unchanged)
// ─────────────────────────────────────────────────────────────────────────

describe('GH-377 — nutrition-calendar.js: collectFromState() reports _methodologyDefaulted without changing what it resolves', () => {
    function collect(domValues, setup) {
        resetSandbox(domValues);
        if (setup) setup();
        const NC = loadCalendar();
        return NC.collectFromState();
    }

    test('nothing anywhere: methodology falls to the chain\'s default "mlsn" and is flagged as defaulted', () => {
        const out = collect({}, () => { global.window.GAIP_STATE = {}; });
        expect(out.methodology).toBe('mlsn');
        expect(out._methodologyDefaulted).toBe(true);
    });

    test('the hub store\'s placeholder inputs.soil.methodology = "mlsn" alone is still "defaulted" (indistinguishable from not-loaded-yet)', () => {
        const out = collect({}, () => { global.window.GAIP_STATE = { inputs: { soil: { methodology: 'mlsn' } } }; });
        expect(out.methodology).toBe('mlsn');
        expect(out._methodologyDefaulted).toBe(true);
    });

    test('a real non-MLSN soil methodology is resolved and not defaulted', () => {
        const out = collect({}, () => { global.window.GAIP_STATE = { inputs: { soil: { methodology: 'slan' } } }; });
        expect(out.methodology).toBe('slan');
        expect(out._methodologyDefaulted).toBe(false);
    });

    test('an explicit MLSN from the new hub\'s GAIP_HUB_CONFIG.turfMethodology (Plan page) is a real answer: not defaulted, value unchanged', () => {
        const out = collect({}, () => {
            global.window.GAIP_STATE = { inputs: { soil: { methodology: 'mlsn' } } };
            global.window.GAIP_HUB_CONFIG = { turfMethodology: 'MLSN' };
        });
        expect(out.methodology).toBe('mlsn');
        expect(out._methodologyDefaulted).toBe(false);
    });

    test('an explicit "mlsn" chosen in the hub DOM select is a real answer too', () => {
        const out = collect({ '.gaip-soil-methodology': 'mlsn' }, () => { global.window.GAIP_STATE = {}; });
        expect(out.methodology).toBe('mlsn');
        expect(out._methodologyDefaulted).toBe(false);
    });

    test('parity: the DOM select still overrides the placeholder exactly as before (AA auto-selected for an NZ hub site)', () => {
        const out = collect({ '.gaip-soil-methodology': 'ammonium_acetate' }, () => {
            global.window.GAIP_STATE = { inputs: { soil: { methodology: 'mlsn' } } };
        });
        expect(out.methodology).toBe('ammonium_acetate');
        expect(out._methodologyDefaulted).toBe(false);
    });

    test('parity: bowls/cotula still forces ammonium_acetate, and counts as resolved', () => {
        const out = collect({}, () => { global.window.GAIP_STATE = { turf: { turfType: 'bowls' } }; });
        expect(out.methodology).toBe('ammonium_acetate');
        expect(out._methodologyDefaulted).toBe(false);
    });

    test('parity: GAIP_HUB_CONFIG.turfMethodology non-MLSN still wins over the placeholder', () => {
        const out = collect({}, () => {
            global.window.GAIP_STATE = { inputs: { soil: { methodology: 'mlsn' } } };
            global.window.GAIP_HUB_CONFIG = { turfMethodology: 'SLAN' };
        });
        expect(out.methodology).toBe('slan');
        expect(out._methodologyDefaulted).toBe(false);
    });
});

// ─────────────────────────────────────────────────────────────────────────
// 3. restoreFromPersisted() on the Plan page, through the REAL plan.blade.php bridge
// ─────────────────────────────────────────────────────────────────────────

describe('GH-377 — nutrition-calendar.js: restoreFromPersisted() refuses a species/methodology-mismatched persisted programme on /plan', () => {
    function setupPlan(siteConfig) {
        resetSandbox({});
        loadSpeciesController();
        global.window.GAIP_HUB_CONFIG = {
            activeSiteId: 'site-1',
            savedLocation: siteConfig.location,
            turfSpecies: siteConfig.turf && siteConfig.turf.species,
            // PageController::topbarData(): strtoupper(config.turf.methodology) or null
            turfMethodology: (siteConfig.turf && siteConfig.turf.methodology) ? String(siteConfig.turf.methodology).toUpperCase() : null,
        };
        global.window.GAIP_SITE_CONFIG = siteConfig;
        runRealPlanBridge();
        const NC = loadCalendar();
        calendarElements(NC);
        global.document.dispatchEvent = jest.fn(() => true);
        return NC;
    }
    function dispatchedGenerated() {
        return global.document.dispatchEvent.mock.calls.some((c) => c[0] && c[0].type === 'gaip:nutrition-calendar-generated');
    }

    test('no change (Burns, real shape): the persisted programme renders and the generated event fires — no nag', () => {
        const NC = setupPlan(siteConfigFor(REAL_SITES[0]));
        NC.restoreFromPersisted();
        expect(NC.program).toBeTruthy();
        expect(NC.program.annual_totals.N).toBe(200);
        expect(NC.elements.calendar.innerHTML).not.toMatch(/configuration changed/i);
        expect(dispatchedGenerated()).toBe(true);
    });

    test('no change on every real DB shape, including the NZ/AA and browntop ones', () => {
        REAL_SITES.forEach((site) => {
            const NC = setupPlan(siteConfigFor(site));
            NC.restoreFromPersisted();
            // A restored programme renders its calendar table into the same
            // element the banners use — so "no nag" means no warning banner
            // in there, not an empty element.
            expect({ site: site.name, restored: !!NC.program, staleBanner: /gilba-nut-banner--warning/.test(NC.elements.calendar.innerHTML) })
                .toEqual({ site: site.name, restored: true, staleBanner: false });
        });
    });

    test('species changed after generation (Settings turf form / import): banner names the species change, programme not rendered, unavailable flag raised, no generated event', () => {
        const burns = REAL_SITES[0];
        const NC = setupPlan(siteConfigFor(burns, { turf: Object.assign({}, burns.turf, { species: 'Perennial Ryegrass' }) }));
        NC.restoreFromPersisted();
        expect(NC.program).toBeNull();
        expect(global.window.GAIP_NUTRITION_PROGRAM_UNAVAILABLE).toBe(true);
        expect(NC.elements.calendar.innerHTML).toMatch(/Site configuration changed/);
        expect(NC.elements.calendar.innerHTML).toMatch(/grass species \(Creeping Bentgrass \(Greens\) to Perennial Ryegrass\)/);
        expect(NC.elements.calendar.innerHTML).toMatch(/Click "Generate"/);
        expect(dispatchedGenerated()).toBe(false);
    });

    test('methodology changed after generation ("New test - location", SLAN -> MLSN): banner names the methodology change', () => {
        const site = REAL_SITES[4];
        const NC = setupPlan(siteConfigFor(site, { turf: Object.assign({}, site.turf, { methodology: 'mlsn' }) }));
        NC.restoreFromPersisted();
        expect(NC.program).toBeNull();
        expect(NC.elements.calendar.innerHTML).toMatch(/soil test methodology \(SLAN to MLSN\)/);
        expect(NC.elements.calendar.innerHTML).not.toMatch(/grass species/);
    });

    test('the coordinate check (GH-371) still runs first and keeps its own banner when both drifted', () => {
        const test5 = REAL_SITES[2];
        const NC = setupPlan(siteConfigFor(test5, {
            location: { lat: 51.5, lon: -0.12 }, // moved to London
            turf: Object.assign({}, test5.turf, { species: 'Couch' }),
        }));
        NC.restoreFromPersisted();
        expect(NC.program).toBeNull();
        expect(NC.elements.calendar.innerHTML).toMatch(/Site coordinates changed/);
    });

    test('legacy meta with no species/methodology stamped renders as before, even though the turf differs (forward-looking guard)', () => {
        const burns = REAL_SITES[0];
        const cfg = siteConfigFor(burns, { turf: Object.assign({}, burns.turf, { species: 'Perennial Ryegrass', methodology: 'slan' }) });
        cfg.nutritionCalendarProgram.meta = { hemisphere: 'south', distribution: 'gp_weighted' };
        const NC = setupPlan(cfg);
        NC.restoreFromPersisted();
        expect(NC.program).toBeTruthy();
    });

    test('species stamped but the page cannot resolve one (no turf anywhere, collectFromState() fell back): trusted as-is, not invalidated', () => {
        const burns = REAL_SITES[0];
        const cfg = siteConfigFor(burns, { turf: { methodology: 'mlsn' } }); // no species in config -> bridge sets none -> fallback fires
        const NC = setupPlan(cfg);
        NC.restoreFromPersisted();
        expect(NC.program).toBeTruthy();
    });

    test('import-bundle path (settings-init.js applySiteConfig): the exact post-import blob — turf replaced by the bundle, programme carried forward by the server — is refused on the next Plan load', () => {
        // Pre-import: Burns, programme stamped bentgrass/MLSN. The import PUTs
        // { turf, location, pgr } only; resolveGaipConfigWrite() carries the
        // DB programme + stamp forward unchanged (GH-371 follow-up). This is
        // what /plan then server-renders into GAIP_SITE_CONFIG.
        const burns = REAL_SITES[0];
        const postImport = siteConfigFor(burns, {
            turf: { species: 'Tall Fescue', methodology: 'mlsn', turfType: 'sports', subCategory: 'soccer', variety: '' },
            pgr: {},
        });
        const NC = setupPlan(postImport);
        NC.restoreFromPersisted();
        expect(NC.program).toBeNull();
        expect(NC.elements.calendar.innerHTML).toMatch(/grass species \(Creeping Bentgrass \(Greens\) to Tall Fescue\)/);
    });

    test('import-bundle path, same species re-imported: nothing to invalidate, programme restored', () => {
        const burns = REAL_SITES[0];
        const sameSpeciesImport = siteConfigFor(burns, {
            turf: { species: 'Creeping Bentgrass (Greens)', methodology: 'mlsn', turfType: 'golf', subCategory: 'greens', variety: 'Penncross' },
            pgr: {},
        });
        const NC = setupPlan(sameSpeciesImport);
        NC.restoreFromPersisted();
        expect(NC.program).toBeTruthy();
    });
});

// ─────────────────────────────────────────────────────────────────────────
// 4. restoreConfig() (site-config-persistence.js) — same-blob comparison
// ─────────────────────────────────────────────────────────────────────────

describe('GH-377 — site-config-persistence.js: restoreConfig() refuses to restore a species/methodology-mismatched cached programme', () => {
    function setup(opts) {
        resetSandbox({});
        loadSpeciesController();
        if (!(opts && opts.withoutCalendar)) loadCalendar();
        const SiteConfig = loadSiteConfig();
        delete global.window.GAIP_NUTRITION_CALENDAR_PROGRAM;
        delete global.window.GAIP_NUTRITION_PROGRAM;
        return SiteConfig;
    }

    test('no change on every real DB shape: both globals restored', () => {
        REAL_SITES.forEach((site) => {
            const SiteConfig = setup();
            SiteConfig.restore(siteConfigFor(site), 'site-1');
            expect({ site: site.name, cal: !!global.window.GAIP_NUTRITION_CALENDAR_PROGRAM, prog: !!global.window.GAIP_NUTRITION_PROGRAM })
                .toEqual({ site: site.name, cal: true, prog: true });
        });
    });

    test('species changed (the post-import / post-Settings blob): neither global is set', () => {
        const SiteConfig = setup();
        const burns = REAL_SITES[0];
        SiteConfig.restore(siteConfigFor(burns, { turf: Object.assign({}, burns.turf, { species: 'Perennial Ryegrass' }) }), 'site-1');
        expect(global.window.GAIP_NUTRITION_CALENDAR_PROGRAM).toBeUndefined();
        expect(global.window.GAIP_NUTRITION_PROGRAM).toBeUndefined();
    });

    test('methodology changed: neither global is set', () => {
        const SiteConfig = setup();
        const site = REAL_SITES[4];
        SiteConfig.restore(siteConfigFor(site, { turf: Object.assign({}, site.turf, { methodology: 'mlsn' }) }), 'site-1');
        expect(global.window.GAIP_NUTRITION_CALENDAR_PROGRAM).toBeUndefined();
        expect(global.window.GAIP_NUTRITION_PROGRAM).toBeUndefined();
    });

    test('NZ site whose config says "mlsn" but whose programme was (correctly) computed under AA: restored, no false positive', () => {
        const SiteConfig = setup();
        const test5 = REAL_SITES[2];
        SiteConfig.restore(siteConfigFor(test5, { turf: Object.assign({}, test5.turf, { methodology: 'mlsn' }) }), 'site-1');
        expect(global.window.GAIP_NUTRITION_CALENDAR_PROGRAM).toBeTruthy();
    });

    test('config.location has no coordinates but GAIP_HUB_CONFIG.savedLocation does (b35fix506 lag case): the NZ rule still resolves from the DB coordinates', () => {
        const SiteConfig = setup();
        const test5 = REAL_SITES[2];
        global.window.GAIP_HUB_CONFIG = { activeSiteId: 'site-1', savedLocation: { lat: test5.location.lat, lon: test5.location.lon } };
        const cfg = siteConfigFor(test5, { turf: Object.assign({}, test5.turf, { methodology: 'mlsn' }), location: { name: 'Auckland' } });
        delete cfg.nutritionProgramCoords; // keep the GH-371 check out of the way
        SiteConfig.restore(cfg, 'site-1');
        expect(global.window.GAIP_NUTRITION_CALENDAR_PROGRAM).toBeTruthy();
    });

    test('legacy meta with no species/methodology: restored as before', () => {
        const SiteConfig = setup();
        const burns = REAL_SITES[0];
        const cfg = siteConfigFor(burns, { turf: Object.assign({}, burns.turf, { species: 'Couch' }) });
        cfg.nutritionCalendarProgram.meta = {};
        SiteConfig.restore(cfg, 'site-1');
        expect(global.window.GAIP_NUTRITION_CALENDAR_PROGRAM).toBeTruthy();
    });

    test('nutrition-calendar.js not loaded on this page (morning-briefing/stadium shape): the check is unavailable and the programme is restored as before, not blocked', () => {
        const SiteConfig = setup({ withoutCalendar: true });
        expect(global.window.GilbaNutritionCalendar).toBeUndefined();
        const burns = REAL_SITES[0];
        SiteConfig.restore(siteConfigFor(burns, { turf: Object.assign({}, burns.turf, { species: 'Couch' }) }), 'site-1');
        expect(global.window.GAIP_NUTRITION_CALENDAR_PROGRAM).toBeTruthy();
    });

    test('the coordinate mismatch (GH-371) still wins on its own when the inputs are unchanged', () => {
        const SiteConfig = setup();
        const burns = REAL_SITES[0];
        SiteConfig.restore(siteConfigFor(burns, { location: { lat: 51.5, lon: -0.12 } }), 'site-1');
        expect(global.window.GAIP_NUTRITION_CALENDAR_PROGRAM).toBeUndefined();
    });
});

// ─────────────────────────────────────────────────────────────────────────
// 5. snapshotConfig()'s carry-forward (site-config-persistence.js)
// ─────────────────────────────────────────────────────────────────────────

describe('GH-377 — site-config-persistence.js: snapshotConfig() drops a known-stale cached programme, but never on a transient DOM read', () => {
    function setup(domValues) {
        resetSandbox(domValues);
        loadSpeciesController();
        loadCalendar();
        global.window.GAIP_SampleManager = { getActiveSiteId: function () { return 'site-1'; } };
        const SiteConfig = loadSiteConfig();
        return SiteConfig;
    }
    function seed(SiteConfig, site, turfOverrides) {
        SiteConfig.mergeConfig('site-1', {
            turf: Object.assign({}, site.turf, turfOverrides || {}),
            nutritionCalendarProgram: programFor(site),
            nutritionProgram: { monthly: [{ N: 16 }] },
            nutritionProgramCoords: { lat: site.location.lat, lon: site.location.lon },
        });
    }
    const burns = REAL_SITES[0];
    const burnsDom = { '.gaip-lat': String(burns.location.lat), '.gaip-lon': String(burns.location.lon) };

    test('unchanged (DOM and saved identity both match the stamp): carried forward, stamp intact', () => {
        const SiteConfig = setup(Object.assign({ '.gaip-species': 'Creeping Bentgrass (Greens)', '.gaip-soil-methodology': 'mlsn' }, burnsDom));
        seed(SiteConfig, burns);
        const snap = SiteConfig.snapshot();
        expect(snap.nutritionCalendarProgram).toBeTruthy();
        expect(snap.nutritionProgram).toBeTruthy();
        expect(snap.nutritionProgramCoords).toEqual({ lat: burns.location.lat, lon: burns.location.lon });
    });

    test('known-stale (DOM AND the previously saved identity both disagree with the stamp): both programmes and the stamp are dropped, like a coordinate move', () => {
        const SiteConfig = setup(Object.assign({ '.gaip-species': 'Perennial Ryegrass', '.gaip-soil-methodology': 'mlsn' }, burnsDom));
        seed(SiteConfig, burns, { species: 'Perennial Ryegrass' }); // saved identity already moved on
        const snap = SiteConfig.snapshot();
        expect(snap.nutritionCalendarProgram).toBeUndefined();
        expect(snap.nutritionProgram).toBeUndefined();
        expect(snap.nutritionProgramCoords).toBeUndefined();
        expect(snap.turf.species).toBe('Perennial Ryegrass');
    });

    test('methodology known-stale the same way', () => {
        const SiteConfig = setup(Object.assign({ '.gaip-species': 'Creeping Bentgrass (Greens)', '.gaip-soil-methodology': 'slan' }, burnsDom));
        seed(SiteConfig, burns, { methodology: 'slan' });
        const snap = SiteConfig.snapshot();
        expect(snap.nutritionCalendarProgram).toBeUndefined();
    });

    test('transient DOM (the b35fix504 cross-site cascade race: DOM still shows another site\'s species, saved identity matches the stamp): carried forward, NOT dropped', () => {
        const SiteConfig = setup(Object.assign({ '.gaip-species': 'Perennial Ryegrass', '.gaip-soil-methodology': 'mlsn' }, burnsDom));
        seed(SiteConfig, burns); // saved identity still Creeping Bentgrass = the stamp
        const snap = SiteConfig.snapshot();
        expect(snap.nutritionCalendarProgram).toBeTruthy();
        expect(snap.nutritionProgram).toBeTruthy();
    });

    test('empty DOM species (select not yet populated): carried forward', () => {
        const SiteConfig = setup(Object.assign({ '.gaip-species': '', '.gaip-soil-methodology': '' }, burnsDom));
        seed(SiteConfig, burns);
        expect(SiteConfig.snapshot().nutritionCalendarProgram).toBeTruthy();
    });

    test('while a restore cascade is in flight (isRestoring), no input-based drop happens even if everything disagrees', () => {
        const SiteConfig = setup(Object.assign({ '.gaip-species': 'Perennial Ryegrass', '.gaip-soil-methodology': 'slan' }, burnsDom));
        seed(SiteConfig, burns, { species: 'Perennial Ryegrass', methodology: 'slan' });
        SiteConfig.restore({ turf: { species: 'Perennial Ryegrass' }, location: burns.location }, 'site-1'); // sets _isRestoring until its cascade ends
        expect(SiteConfig.isRestoring()).toBe(true);
        expect(SiteConfig.snapshot().nutritionCalendarProgram).toBeTruthy();
    });

    test('legacy stamp-less meta: carried forward regardless of the turf', () => {
        const SiteConfig = setup(Object.assign({ '.gaip-species': 'Couch', '.gaip-soil-methodology': 'slan' }, burnsDom));
        SiteConfig.mergeConfig('site-1', {
            turf: { species: 'Couch', methodology: 'slan' },
            nutritionCalendarProgram: { meta: {}, annual_totals: { N: 200 } },
        });
        expect(SiteConfig.snapshot().nutritionCalendarProgram).toBeTruthy();
    });
});

// ─────────────────────────────────────────────────────────────────────────
// 6. word-export.js + settings-init.js — structural pins (this repo's
//    established convention for these two DOM-heavy modules, see gh371)
// ─────────────────────────────────────────────────────────────────────────

describe('GH-377 — word-export.js: the Monthly Schedule / Nutrition Program read gains the species/methodology check next to GH-371\'s coordinate one', () => {
    let src;
    beforeAll(() => {
        src = fs.readFileSync(path.join(__dirname, '../assets/word-export.js'), 'utf8');
    });

    test('the accept-condition requires both !_coordsStale and !_inputsStale', () => {
        expect(src).toMatch(/if \(\(!progSiteId \|\| !currentSiteId \|\| progSiteId === currentSiteId\) && !_coordsStale && !_inputsStale\)/);
    });

    test('_inputsStale comes from the shared nutrition-calendar.js helpers, fed the cached calendar meta and the current state + site turf', () => {
        const idx = src.indexOf('var _inputsStale = false;');
        expect(idx).toBeGreaterThan(-1);
        const block = src.slice(idx, src.indexOf('// Accept if:', idx));
        expect(block).toMatch(/programInputsDrift\(/);
        expect(block).toMatch(/collectProgramInputCandidates\(\{/);
        expect(block).toMatch(/nutritionCalendarProgram/);
        expect(block).toMatch(/collectFromState\(\)/);
        expect(block).toMatch(/turfs: _siteCfg377\.turf/);
    });

    test('the check is in its own try/catch so a failure degrades to "not stale" independently of the GH-371 check', () => {
        const idx = src.indexOf('var _inputsStale = false;');
        const block = src.slice(idx, src.indexOf('// Accept if:', idx));
        expect(block).toMatch(/try \{/);
        expect(block).toMatch(/catch \(_inputCheckErr\)/);
        // and GH-371's own block is untouched
        expect(src).toMatch(/catch \(_coordCheckErr\)/);
    });

    test('a skipped stale programme is logged under GH-377, distinct from the coordinate and cross-site reasons', () => {
        expect(src).toMatch(/else if \(_inputsStale\) \{\s*console\.warn\('\[WordExport\] GH-377: Skipping stale nutrition program/);
    });
});

describe('GH-377 — settings-init.js: the import-bundle flow still hand-builds its config PUT without the cache keys, so the read-side check is what closes that path', () => {
    let src;
    beforeAll(() => {
        src = fs.readFileSync(path.join(__dirname, '../assets/settings-init.js'), 'utf8');
    });

    test('applySiteConfig() PUTs exactly { turf, location, pgr } — a turf change with no fresh stamp, which the server answers by carrying the DB programme forward', () => {
        const fnIdx = src.indexOf('function applySiteConfig(bundle)');
        expect(fnIdx).toBeGreaterThan(-1);
        const body = src.slice(fnIdx, src.indexOf('return Promise.all(tasks);', fnIdx));
        expect(body).toMatch(/config: \{ turf: t, location: cfg\.location \|\| \{\}, pgr: cfg\.pgr \|\| \{\} \}/);
        expect(body).not.toMatch(/nutritionProgram(?!Coords)\b/);
        expect(body).toMatch(/GH-377/); // the closure is documented at the site of the hazard
    });
});

// ─────────────────────────────────────────────────────────────────────────
// 7. pullConfigsFromServer() (site-config-persistence.js) — review fix.
//    The programme keys are ALWAYS taken from the server on a pull, but the
//    turf fields the GH-377 comparison reads were not all in the "server is
//    newer" identity list: `methodology` and the overseed/base-species
//    fields were missing. A browser whose cached config predates a Settings
//    change (a second device, or a cache from before the change) then held
//    the NEW programme next to the OLD turf, and restoreConfig()'s same-blob
//    check refused a perfectly fresh programme. Reproduced live on
//    /reports/export ("computed for methodology=mlsn but this site's saved
//    config now says methodology=slan") before the fix; gone after it.
// ─────────────────────────────────────────────────────────────────────────

describe('GH-377 (review fix) — site-config-persistence.js: pullConfigsFromServer() keeps every turf field the staleness check reads as current as the programme keys it always takes', () => {
    const SITE = 'site-1';
    const OLD_SAVED_AT = '2026-08-26T00:46:46.653Z'; // the real "New test - location" row
    const NEW_SAVED_AT = '2026-09-09T01:18:34.932Z'; // what Plan's own direct PUT stamps on regenerate
    const NT = REAL_SITES[4];

    function localStorageStub(seed) {
        const store = Object.assign({}, seed || {});
        return {
            getItem: (k) => (Object.prototype.hasOwnProperty.call(store, k) ? store[k] : null),
            setItem: (k, v) => { store[k] = String(v); },
            removeItem: (k) => { delete store[k]; },
        };
    }

    function calendarProgram(site, metaOverrides) {
        return programFor(site, metaOverrides);
    }

    // Boots the REAL module the way a hub page does: localStorage already holds
    // this browser's cached config for the site, and GET /api/sites answers with
    // what the DB holds now. init() is the module's own deferred boot (500ms).
    async function bootWithServer(localCfg, serverCfg) {
        jest.useFakeTimers();
        resetSandbox({});
        loadSpeciesController();
        loadCalendar();
        global.localStorage = localStorageStub({ gilba_hub_site_configs: JSON.stringify({ [SITE]: localCfg }) });
        global.window.GAIP_HUB_CONFIG = { restUrl: '/api/', activeSiteId: SITE, csrfToken: 't' };
        global.window.GAIP_SampleManager = {
            getActiveSiteId: () => SITE,
            getSiteList: () => [{ id: SITE, label: 'Site 1' }],
        };
        global.fetch = jest.fn((url) => {
            const body = /\/sites$/.test(String(url))
                ? { data: [{ id: SITE, name: 'Site 1', configs: { gaip: { config: serverCfg } } }] }
                : {};
            return Promise.resolve({ ok: true, status: 200, text: () => Promise.resolve(JSON.stringify(body)) });
        });
        const SiteConfig = loadSiteConfig();
        jest.advanceTimersByTime(500);
        for (let i = 0; i < 25; i++) await Promise.resolve(); // drain fetch().then(text).then(merge)
        expect(global.fetch.mock.calls.some((c) => /\/sites$/.test(String(c[0])))).toBe(true);
        return SiteConfig;
    }

    afterEach(() => {
        jest.clearAllTimers();
        jest.useRealTimers();
    });

    test('the live case: methodology changed in Settings + regenerated on Plan (server newer, programme stamped with the new methodology) — the pull now syncs turf.methodology, so the fresh programme is not refused', async () => {
        const local = {
            turf: Object.assign({}, NT.turf),                       // methodology 'slan'
            location: Object.assign({}, NT.location),
            nutritionCalendarProgram: calendarProgram(NT),          // meta.methodology 'SLAN'
            nutritionProgram: { monthly: [{ N: 16 }], _generatedForSite: SITE },
            savedAt: OLD_SAVED_AT,
        };
        const server = {
            turf: Object.assign({}, NT.turf, { methodology: 'mlsn' }),
            location: Object.assign({}, NT.location),
            nutritionCalendarProgram: calendarProgram(NT, { methodology: 'MLSN' }),
            nutritionProgram: { monthly: [{ N: 18 }], _generatedForSite: SITE },
            savedAt: NEW_SAVED_AT,
        };
        const SiteConfig = await bootWithServer(local, server);
        const NC = global.window.GilbaNutritionCalendar;
        const cfg = SiteConfig.getConfig(SITE);

        // The programme keys were always taken from the server...
        expect(cfg.nutritionCalendarProgram.meta.methodology).toBe('MLSN');
        expect(cfg.nutritionProgram.monthly[0].N).toBe(18);
        // ...and now so is the methodology they were computed under.
        expect(cfg.turf.methodology).toBe('mlsn');
        expect(cfg.turf.species).toBe('Creeping Bentgrass (Greens)');

        // The same-blob comparison every hub page runs on this config: nothing drifts.
        const drift = NC.programInputsDrift(cfg.nutritionCalendarProgram.meta,
            NC.collectProgramInputCandidates({ turfs: cfg.turf, lat: cfg.location.lat, lon: cfg.location.lon }));
        expect(drift).toEqual([]);
        delete global.window.GAIP_NUTRITION_CALENDAR_PROGRAM;
        delete global.window.GAIP_NUTRITION_PROGRAM;
        SiteConfig.restore(cfg, SITE);
        expect(global.window.GAIP_NUTRITION_CALENDAR_PROGRAM).toBeTruthy();
        expect(global.window.GAIP_NUTRITION_PROGRAM).toBeTruthy();

        // What the pre-fix merge produced (server programme next to the local
        // turf) is exactly the blob the check refuses — the trap this pins.
        const preFixShape = Object.assign({}, local, { nutritionCalendarProgram: server.nutritionCalendarProgram });
        expect(NC.programInputsDrift(preFixShape.nutritionCalendarProgram.meta,
            NC.collectProgramInputCandidates({ turfs: preFixShape.turf, lat: NT.location.lat, lon: NT.location.lon })))
            .toEqual([{ field: 'methodology', was: 'mlsn', now: 'slan' }]);
    });

    test('overseed fields sync the same way: a hub-stamped overseed programme (meta.species = the overseed key) arriving with a newer server turf that names the overseed is not refused on a device whose cached turf predates it', async () => {
        const couchSite = { turf: { species: 'Couch', methodology: 'mlsn', turfType: 'sports', subCategory: 'soccer', coolOverseed: '' },
            location: { lat: -35.2213, lon: 149.0002 },
            meta: { species: 'perennialRyegrass', speciesDisplay: 'Perennial Ryegrass', methodology: 'MLSN' } };
        const local = {
            turf: Object.assign({}, couchSite.turf),
            location: Object.assign({}, couchSite.location),
            nutritionCalendarProgram: { meta: { species: 'bermuda', methodology: 'MLSN' }, annual_totals: { N: 200 }, adjustments: { target_n: 200 } },
            savedAt: OLD_SAVED_AT,
        };
        const server = {
            turf: Object.assign({}, couchSite.turf, { coolOverseed: 'Perennial Ryegrass', warmBase: 'Couch' }),
            location: Object.assign({}, couchSite.location),
            nutritionCalendarProgram: { meta: couchSite.meta, annual_totals: { N: 200 }, adjustments: { target_n: 200 } },
            savedAt: NEW_SAVED_AT,
        };
        const SiteConfig = await bootWithServer(local, server);
        const NC = global.window.GilbaNutritionCalendar;
        const cfg = SiteConfig.getConfig(SITE);
        expect(cfg.turf.coolOverseed).toBe('Perennial Ryegrass');
        expect(cfg.turf.warmBase).toBe('Couch');
        expect(NC.programInputsDrift(cfg.nutritionCalendarProgram.meta,
            NC.collectProgramInputCandidates({ turfs: cfg.turf, lat: cfg.location.lat, lon: cfg.location.lon }))).toEqual([]);
    });

    test('the "server is newer" rule itself is unchanged: an OLDER server savedAt leaves the local turf alone (methodology included) while the programme keys are still taken from the server', async () => {
        const local = {
            turf: Object.assign({}, NT.turf, { methodology: 'mlsn' }),
            location: Object.assign({}, NT.location),
            nutritionCalendarProgram: calendarProgram(NT, { methodology: 'MLSN' }),
            savedAt: NEW_SAVED_AT,
        };
        const server = {
            turf: Object.assign({}, NT.turf),                       // 'slan', but older
            location: Object.assign({}, NT.location),
            nutritionCalendarProgram: calendarProgram(NT, { methodology: 'MLSN', generated: 'server-copy' }),
            savedAt: OLD_SAVED_AT,
        };
        const SiteConfig = await bootWithServer(local, server);
        const cfg = SiteConfig.getConfig(SITE);
        expect(cfg.turf.methodology).toBe('mlsn');                                     // local wins, as before
        expect(cfg.nutritionCalendarProgram.meta.generated).toBe('server-copy');      // programme keys: server, as before
    });
});

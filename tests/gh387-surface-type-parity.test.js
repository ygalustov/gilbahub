/**
 * GH-387 — the Plan page and the Word export handed their product recommender
 * different SURFACE TYPES, so the same sample got different products out of the
 * same catalogue.
 *
 * Observed live on Burns "12th Fairway" (2026-09-10), with the AU recommender
 * hooked on both surfaces. Identical monthly nutrient series on both sides
 * (N 120.1, P 14.0, K 0.0 over 12 months), identical methodology ('mlsn'),
 * identical distributor filter ('all') — and:
 *
 *   Plan   surfaceType 'golf_greens' -> Sportsmaster WSF 20-0-0 + Seaweed,
 *                                       Ammonium Sulphate Tech (soluble),
 *                                       MAP Tech
 *   export surfaceType 'golf'        -> MESA 30 (30-0-0), Greenmaster Liquid
 *                                       Spring & Summer, Greenmaster Liquid
 *                                       High N, Wilbur Ellis GroMaxx 46,
 *                                       MAP Tech, FoliMAX N-Hancer-N
 *
 * Every one of those products is in the SAME Australian catalogue, so this was
 * never the regional-catalogue question (GH-362/D30) it was first reported as.
 *
 * Root cause: GH-383's rewiring of the Combined export's per-sample calendar
 * inputs assigned `_siteInputs.turfType` into `perSampleInputs.surfaceType`.
 * Those are different fields — turfType is 'golf' | 'sports' | 'lawns', while
 * surfaceType is the surface ('greens', 'soccer', ...) and the recommenders key
 * on a third, canonical form ('golf_greens', 'tees', 'fairways').
 *
 * The same defect was live on Test5 - NZ in a quieter form: export 'sports'
 * against the Plan's 'soccer'. It changed no products there — the Prebble
 * recommender's selection happens to be insensitive to that value at those
 * figures — which is exactly why it went unnoticed while the harness stayed
 * green.
 *
 * FIX: the shared input adapter resolves BOTH values, once, for both surfaces:
 * `surfaceType` (the raw surface the calendar works in, matching what
 * nutrition-calendar.js's collectFromState() has always resolved) and
 * `recommenderSurfaceType` (the canonical key, mapped from turfType +
 * subCategory). `nutrition-au-fertiliser-integration.js`'s own `_mapTurfType`
 * now delegates to the adapter's mapping, so one implementation answers for
 * both pages.
 */

'use strict';

global.window = global;
global.document = global.document || {
    readyState: 'complete',
    addEventListener() {},
    getElementById() { return null; },
    querySelector() { return null; },
    querySelectorAll() { return []; },
};
global.console = { log() {}, warn() {}, error() {}, info() {} };

const Core = require('../assets/nutrition-requirement-core.js');
global.window.NutritionRequirementCore = Core;
const Inputs = require('../assets/nutrition-program-inputs.js');

const SITE = 'site-under-test';

function resolve(turf, extra) {
    const saved = global.GAIP_HUB_CONFIG;
    global.GAIP_HUB_CONFIG = { activeSiteId: SITE };
    try {
        return Inputs.resolveSiteProgramInputs(Object.assign({
            siteId: SITE,
            siteConfig: { turf: Object.assign({ species: 'Creeping Bentgrass (Greens)', methodology: 'mlsn', nProgram: 120 }, turf) },
            planForm: null,
        }, extra || {}));
    } finally {
        if (saved === undefined) delete global.GAIP_HUB_CONFIG; else global.GAIP_HUB_CONFIG = saved;
    }
}

describe('GH-387 — turfType, surfaceType and the recommender key are three different things', () => {
    test('the live Burns case: golf + greens', () => {
        const r = resolve({ turfType: 'golf', subCategory: 'greens' });
        expect(r.turfType).toBe('golf');                    // what the traffic gate uses
        expect(r.surfaceType).toBe('greens');               // what the calendar works in
        expect(r.recommenderSurfaceType).toBe('golf_greens'); // what the AU recommender keys on
    });

    test('the live Test5 case: sports + soccer — the quiet half of the same defect', () => {
        const r = resolve({ turfType: 'sports', subCategory: 'soccer' });
        expect(r.turfType).toBe('sports');
        expect(r.surfaceType).toBe('soccer');
        expect(r.recommenderSurfaceType).toBe('soccer');
        // Never 'sports', which is what GH-383 put in the export's surfaceType.
        expect(r.surfaceType).not.toBe(r.turfType);
    });

    test('the canonical mapping covers every golf sub-category and the named turf types', () => {
        expect(Inputs.mapSurfaceKey('golf', 'greens')).toBe('golf_greens');
        expect(Inputs.mapSurfaceKey('golf', 'tees')).toBe('tees');
        expect(Inputs.mapSurfaceKey('golf', 'fairways')).toBe('fairways');
        expect(Inputs.mapSurfaceKey('golf', 'surrounds')).toBe('fairways');
        expect(Inputs.mapSurfaceKey('golf', null)).toBe('golf_greens');
        expect(Inputs.mapSurfaceKey('bowling', null)).toBe('bowling_greens');
        expect(Inputs.mapSurfaceKey('bowls', null)).toBe('bowling_greens');
        expect(Inputs.mapSurfaceKey('cricket', null)).toBe('cricket_wickets');
        expect(Inputs.mapSurfaceKey('sports', 'soccer')).toBe('soccer');
        expect(Inputs.mapSurfaceKey('lawns', null)).toBe('lawns');
        expect(Inputs.mapSurfaceKey(null, 'greens')).toBeNull();
    });

    test('the raw surface follows the calendar\'s own chain, including its "sports" default', () => {
        // nutrition-calendar.js collectFromState(): soil.surfaceType ->
        // turf.subCategory -> 'sports'.
        expect(Inputs.resolveSurfaceType({ soil: { surfaceType: 'tees' }, subCategory: 'greens' })).toBe('tees');
        expect(Inputs.resolveSurfaceType({ subCategory: 'greens' })).toBe('greens');
        expect(Inputs.resolveSurfaceType({})).toBe('sports');
        // The cotula special case the calendar and the AU integration share.
        expect(Inputs.resolveSurfaceType({ soil: { surfaceType: 'cotula_bowling_green' } })).toBe('bowling_greens');
    });

    test('a site with no sub-category still resolves a recommender key from its turf type', () => {
        const r = resolve({ turfType: 'lawns', subCategory: null });
        expect(r.surfaceType).toBe('sports');           // the calendar's default
        expect(r.recommenderSurfaceType).toBe('lawns'); // mapped from turfType
    });

    test('the resolution is stamped, like every other programme-level input', () => {
        expect(resolve({ turfType: 'golf', subCategory: 'greens' }).sources.surfaceType).toBe('site-config');
        expect(resolve({ turfType: 'golf', subCategory: null }).sources.surfaceType).toBe('default');
        expect(resolve({ turfType: 'golf', subCategory: 'greens' }, { soil: { surfaceType: 'tees' } }).sources.surfaceType).toBe('sample');
    });
});

describe('GH-387 — both surfaces read the one resolution', () => {
    const fs = require('fs');
    const path = require('path');
    const read = (f) => fs.readFileSync(path.join(__dirname, '../assets/' + f), 'utf8');
    const strip = (src) => src.replace(/\/\*[\s\S]*?\*\//g, '').replace(/(^|[^:])\/\/[^\n]*/g, '$1');

    test('the Combined export no longer puts turfType into surfaceType', () => {
        const combined = strip(read('word-export-combined.js'));
        expect(combined).not.toMatch(/perSampleInputs\.surfaceType = _siteInputs\.turfType/);
        expect(combined).toMatch(/perSampleInputs\.surfaceType = _siteInputs\.surfaceType \|\| perSampleInputs\.surfaceType;/);
    });

    test('the export hands the AU recommender the canonical key, as the Plan page does', () => {
        const combined = strip(read('word-export-combined.js'));
        expect(combined).toMatch(/surfaceType: _siteInputs\.recommenderSurfaceType \|\| perSampleInputs\.surfaceType,/);
    });

    test('the AU integration delegates its mapping to the adapter, so there is one copy', () => {
        const au = read('nutrition-au-fertiliser-integration.js');
        expect(au).toMatch(/_NPI\.mapSurfaceKey === 'function'/);
        expect(au).toMatch(/return _NPI\.mapSurfaceKey\(turfType, subCategory\);/);
    });

    test('the adapter\'s mapping and the AU integration\'s local fallback agree, rung for rung', () => {
        // The fallback exists for a page that has not loaded the adapter; if
        // the two ever disagree the bug comes straight back.
        const au = read('nutrition-au-fertiliser-integration.js');
        const body = au.slice(au.indexOf('function _mapTurfType'), au.indexOf('// Primary: legacy turf profile component'));
        [['golf', 'greens', 'golf_greens'], ['golf', 'tees', 'tees'], ['golf', 'fairways', 'fairways'],
         ['golf', 'surrounds', 'fairways'], ['bowling', null, 'bowling_greens'], ['cricket', null, 'cricket_wickets']]
            .forEach(([, sub, expected]) => {
                expect(body).toContain("'" + expected + "'");
                if (sub) expect(body).toContain("'" + sub + "'");
                expect(Inputs.mapSurfaceKey.length).toBe(2);
            });
    });
});

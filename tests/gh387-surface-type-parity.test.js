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

    /**
     * GH-436: this test used to slice `_mapTurfType`'s body out of the file and
     * assert `body.toContain("'golf_greens'")` — substring presence. It never
     * called either mapping and never compared them, and its third assertion
     * was `Inputs.mapSurfaceKey.length === 2`, an arity check, repeated six
     * times inside the loop. Proven vacuous by mutation: swapping the `greens`
     * and `tees` rungs in the fallback, so a golf green resolves to 'tees' and
     * draws a different product set from the same catalogue, left every
     * assertion green.
     *
     * The fallback is a nested function inside a closure, so it cannot simply
     * be imported. It is EVALUATED from its own source instead — the real text,
     * not a transcription — with the adapter absent, which is the only
     * condition under which that branch runs in production.
     */
    function loadFallbackMapper() {
        const au = read('nutrition-au-fertiliser-integration.js');
        const start = au.indexOf('function _mapTurfType');
        const end = au.indexOf('// Primary: legacy turf profile component');
        if (start === -1 || end === -1 || end <= start) {
            throw new Error('GH-436: _mapTurfType was not found in nutrition-au-fertiliser-integration.js — '
                + 'if it was renamed or moved, update this anchor rather than deleting the comparison.');
        }
        const body = au.slice(start, end);
        // `window` with no adapter on it: the fallback branch, which is the
        // half this test exists to compare.
        // eslint-disable-next-line no-new-func
        const make = new Function('window', body + '; return _mapTurfType;');
        return { fn: make({}), body };
    }

    test('the adapter\'s mapping and the AU integration\'s local fallback agree, rung for rung', () => {
        const { fn: fallback } = loadFallbackMapper();

        // Every rung, plus the shapes that decide the default arms: an
        // unlisted golf sub-category, a bare turf type, a missing turf type,
        // and the 'bowls' spelling the adapter also accepts.
        const CASES = [
            ['golf', 'greens'], ['golf', 'tees'], ['golf', 'fairways'], ['golf', 'surrounds'],
            ['golf', 'rough'], ['golf', null], ['golf', undefined], ['golf', ''],
            ['bowling', null], ['bowling', 'greens'], ['bowls', null],
            ['cricket', null], ['cricket', 'wickets'],
            ['sports', null], ['sports', 'soccer'], ['lawns', null], ['lawns', 'backyard'],
            [null, 'greens'], [undefined, undefined], ['', 'greens'],
        ];

        const disagreements = [];
        CASES.forEach(([turf, sub]) => {
            const a = Inputs.mapSurfaceKey(turf, sub);
            const b = fallback(turf, sub);
            if (a !== b) disagreements.push(JSON.stringify([turf, sub]) + ': adapter ' + a + ' vs fallback ' + b);
        });
        if (disagreements.length) {
            process.stdout.write('[gh387] adapter/fallback disagreements:\n      '
                + disagreements.join('\n      ') + '\n');
        }
        expect(disagreements).toEqual([]);

        // And the mapping is the one the catalogue is keyed on, so "they agree"
        // cannot be satisfied by both being wrong in the same way.
        expect(Inputs.mapSurfaceKey('golf', 'greens')).toBe('golf_greens');
        expect(Inputs.mapSurfaceKey('golf', 'tees')).toBe('tees');
        expect(Inputs.mapSurfaceKey('golf', 'fairways')).toBe('fairways');
        expect(Inputs.mapSurfaceKey('golf', 'surrounds')).toBe('fairways');
        expect(Inputs.mapSurfaceKey('bowling', null)).toBe('bowling_greens');
        expect(Inputs.mapSurfaceKey('cricket', null)).toBe('cricket_wickets');
    });

    test('the fallback really is the no-adapter branch — it delegates when one is there', () => {
        // Otherwise the comparison above could be measuring the delegation
        // rather than the local rungs, and a broken fallback would hide behind
        // a working adapter.
        const { body } = loadFallbackMapper();
        // eslint-disable-next-line no-new-func
        const withAdapter = new Function('window', body + '; return _mapTurfType;')(
            { GAIP_NutritionProgramInputs: { mapSurfaceKey: () => '__delegated__' } });
        expect(withAdapter('golf', 'greens')).toBe('__delegated__');
    });
});

/**
 * GH-300 (D07 item 6 follow-up) — nutrition-calendar.js's computeProgram() is
 * a structurally separate implementation from nutrition-requirement-engine.js
 * (GH-299) — its own getThresholds()/calculateDeficit(), never routed through
 * the shared engine — so GH-299's AA ceiling fix never reached it. Confirmed
 * live: after GH-299 shipped, a user regenerated the Nutrition Program on a
 * HIGH AA site (K=199ppm, well above the S277 certificate ceiling of
 * 195.7ppm) and annualK still showed 110 — calculateDeficit() only ever adds
 * a correction when soil is BELOW the floor; it has no ceiling concept, so a
 * HIGH-classified nutrient always fell through to pure removal, identical to
 * the pre-GH-299 bug in the other engine.
 *
 * FIX: after STEP 5 builds annualRequirements, resolve a per-nutrient
 * {min,max} ppm range via HillLabsSampleTypes.deriveCode()/getRangesPpm()
 * (same SSOT items 3-5/GH-299 already use) when methodology is AA, and
 * override annualRequirements[nutrient] to 0 when soilPpm[nutrient] >=
 * range.max. Certificate-backed only — graceful-degradation to today's
 * uncapped behaviour when deriveCode() finds no match (uncovered species/
 * texture). Deliberately does NOT touch calculateDeficit()'s existing
 * below-floor correction logic (a separate, real algorithmic difference from
 * nutrition-requirement-engine.js's AA branch, which never adds deficit
 * correction at all — out of scope here, not to be changed without
 * confirming which behaviour is correct).
 */

'use strict';

global.window = global.window || {};
global.document = global.document || {
    addEventListener: function () {},
    querySelector: function () { return null; },
    querySelectorAll: function () { return []; }
};
global.console = { log: function () {}, warn: function () {}, error: function () {}, info: function () {} };
global.localStorage = { getItem: function () { return null; }, setItem: function () {} };

global.window.GilbaGrowthPotentialEngine = require('../assets/growth-potential-engine.js');
require('../assets/nutrition-calendar.js');
var NutritionCalendar = global.window.GilbaNutritionCalendar;

var MONTHLY_TEMPS_0_11 = [20, 20, 18, 15, 12, 9, 8, 9, 11, 14, 17, 19];

function baseInputs(overrides) {
    return Object.assign({
        annualNOverride: 200,
        traffic: 'moderate',
        clippingManagement: 'returned',
        bulkDensity: 1.4,
        soilDepth: 10,
        methodology: 'ammonium_acetate',
        species: 'perennialRyegrass',
        speciesDisplay: 'Perennial Ryegrass',
        soilTexture: 'sand',
        isC4: false,
        distribution: 'gp_weighted',
        monthlyTemps: MONTHLY_TEMPS_0_11,
        soilPpm: { P: 40, K: 199, Ca: 803, Mg: 129, S: 75 },
    }, overrides);
}

function fakeHillLabsSampleTypes() {
    return {
        deriveCode: function (species, texture) {
            var isSandy = String(texture || '').toLowerCase().indexOf('sand') !== -1;
            if (species === 'Perennial Ryegrass' && isSandy) return 'S277';
            return null;
        },
        getRangesPpm: function (code, nutrient) {
            if (code !== 'S277') return null;
            var ranges = {
                K: { min: 58.7, max: 195.7 },
                Ca: { min: 800, max: 1600 },
            };
            return ranges[nutrient] || null;
        },
    };
}

describe('GH-300 — computeProgram() AA ceiling', function () {
    test('soil K (199ppm) above the S277 certificate ceiling (195.7ppm) -> annualK 0, not pure removal', function () {
        global.window.HillLabsSampleTypes = fakeHillLabsSampleTypes();
        var program = NutritionCalendar.computeProgram(baseInputs());
        expect(program.error).toBeUndefined();
        expect(program.annual_totals.K).toBe(0);
    });

    test('a nutrient below its certificate ceiling is unaffected (Ca at 803ppm, ceiling 1600)', function () {
        global.window.HillLabsSampleTypes = fakeHillLabsSampleTypes();
        var program = NutritionCalendar.computeProgram(baseInputs());
        expect(program.annual_totals.Ca).toBeGreaterThan(0);
    });

    test('MLSN methodology never touches the AA certificate path (deriveCode/getRangesPpm), but gets its own MLSN ceiling (GH-319: floor x1.5) at this K level', function () {
        var deriveCodeCalled = false;
        global.window.HillLabsSampleTypes = {
            deriveCode: function () { deriveCodeCalled = true; return 'S277'; },
            getRangesPpm: function () { return { min: 1, max: 2 }; },
        };
        // K=199ppm is well above the MLSN ceiling (37 x 1.5 = 55.5ppm), so
        // GH-319's own MLSN branch (not the AA certificate path) zeroes it.
        var program = NutritionCalendar.computeProgram(baseInputs({ methodology: 'mlsn', soilPpm: { P: 40, K: 199, Ca: 803, Mg: 129, S: 75 } }));
        expect(program.error).toBeUndefined();
        expect(deriveCodeCalled).toBe(false);
        expect(program.annual_totals.K).toBe(0);
    });

    test('MLSN methodology: a K level within the floor..ceiling band (37-55.5ppm) gets removal only, not zeroed', function () {
        var program = NutritionCalendar.computeProgram(baseInputs({ methodology: 'mlsn', soilPpm: { P: 40, K: 45, Ca: 803, Mg: 129, S: 75 } }));
        expect(program.error).toBeUndefined();
        expect(program.annual_totals.K).toBeGreaterThan(0);
    });

    test('graceful degradation: uncovered species/texture (deriveCode returns null) keeps today\'s uncapped AA behaviour', function () {
        global.window.HillLabsSampleTypes = fakeHillLabsSampleTypes();
        var program = NutritionCalendar.computeProgram(baseInputs({ speciesDisplay: 'Kikuyu', soilTexture: 'loam' }));
        expect(program.error).toBeUndefined();
        expect(program.annual_totals.K).toBeGreaterThan(0);
    });

    test('graceful degradation: HillLabsSampleTypes not loaded at all -> unchanged AA behaviour, no throw', function () {
        global.window.HillLabsSampleTypes = undefined;
        var program = NutritionCalendar.computeProgram(baseInputs());
        expect(program.error).toBeUndefined();
        expect(program.annual_totals.K).toBeGreaterThan(0);
    });
});

/**
 * GH-308 (D07 follow-up) — nutrition-calendar.js's computeProgram() resolved
 * the AA below-floor deficit/lift correction and the AA above-ceiling
 * zeroing from two DIFFERENT sources: the floor came from the old
 * CONFIG.aaThresholds texture-only single-value table (sands/others), the
 * ceiling came from HillLabsSampleTypes.deriveCode()/getRangesPpm() (GH-300/
 * 305 — certificate-first, generic fallback). Those tables only agreed in
 * the generic-fallback case; for certificate-covered sites they could
 * disagree substantially — e.g. S277/S279's real Mg certificate range is
 * ~37-85ppm, but the old generic floor used for the deficit calc was 100ppm
 * (sands), so a certificate-'Sufficient' Mg reading (e.g. 60ppm — inside the
 * real 37-85 range) still triggered an unwanted lift correction, even though
 * the Soil page (mlsnEngine(), GH-260) correctly showed no correction needed
 * for the exact same sample.
 *
 * FIX: resolve each nutrient's AA range ONCE (certificate-first, generic
 * fallback), use .min for the floor (deficit/lift) and .max for the ceiling
 * (zeroing) — both ends now always agree.
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

// Real S277/S279 Mg certificate range, 0.30-0.70 me/100g -> ppm via the
// codebase's own Mg conversion factor (122, hill-labs-sample-types.js).
var S277_MG_FLOOR_PPM = 36.6;
var S277_MG_CEILING_PPM = 85.4;

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
        soilPpm: { P: 40, K: 199, Ca: 803, Mg: 60, S: 75 },
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
                Mg: { min: S277_MG_FLOOR_PPM, max: S277_MG_CEILING_PPM },
            };
            return ranges[nutrient] || null;
        },
    };
}

describe('GH-308 — computeProgram() AA floor and ceiling use the same resolved range', function () {
    test('a certificate-"Sufficient" Mg reading (60ppm, inside 36.6-85.4) gets removal only, same total as a reading right at the floor', function () {
        global.window.HillLabsSampleTypes = fakeHillLabsSampleTypes();
        var atFloor = NutritionCalendar.computeProgram(baseInputs({ soilPpm: { P: 40, K: 199, Ca: 803, Mg: S277_MG_FLOOR_PPM, S: 75 } }));
        var midRange = NutritionCalendar.computeProgram(baseInputs({ soilPpm: { P: 40, K: 199, Ca: 803, Mg: 60, S: 75 } }));

        expect(atFloor.error).toBeUndefined();
        expect(midRange.error).toBeUndefined();
        // Both readings sit inside the certificate's sufficiency range, so
        // neither should get a deficit/lift correction -- the annual Mg
        // total is pure removal in both cases and must be identical.
        expect(midRange.annual_totals.Mg).toBe(atFloor.annual_totals.Mg);
        expect(midRange.annual_totals.Mg).toBeGreaterThan(0);
    });

    test('a Mg reading below the certificate floor (20ppm) gets a lift correction on top of removal', function () {
        global.window.HillLabsSampleTypes = fakeHillLabsSampleTypes();
        var belowFloor = NutritionCalendar.computeProgram(baseInputs({ soilPpm: { P: 40, K: 199, Ca: 803, Mg: 20, S: 75 } }));
        var sufficient = NutritionCalendar.computeProgram(baseInputs({ soilPpm: { P: 40, K: 199, Ca: 803, Mg: 60, S: 75 } }));

        expect(belowFloor.error).toBeUndefined();
        expect(belowFloor.annual_totals.Mg).toBeGreaterThan(sufficient.annual_totals.Mg);
    });

    test('a Mg reading above the certificate ceiling (90ppm) is zeroed, not given removal-only', function () {
        global.window.HillLabsSampleTypes = fakeHillLabsSampleTypes();
        var aboveCeiling = NutritionCalendar.computeProgram(baseInputs({ soilPpm: { P: 40, K: 199, Ca: 803, Mg: 90, S: 75 } }));

        expect(aboveCeiling.error).toBeUndefined();
        expect(aboveCeiling.annual_totals.Mg).toBe(0);
    });

    test('graceful degradation: uncovered species/texture still uses the generic sands/others range for both floor and ceiling (unchanged behaviour)', function () {
        global.window.HillLabsSampleTypes = fakeHillLabsSampleTypes();
        var program = NutritionCalendar.computeProgram(baseInputs({
            speciesDisplay: 'Kikuyu',
            soilTexture: 'loam',
            soilPpm: { P: 40, K: 199, Ca: 803, Mg: 60, S: 75 },
        }));
        expect(program.error).toBeUndefined();
        // Kikuyu/loam has no certificate; AmmoniumAcetateMethodology's
        // generic "others" Mg range floor is 140ppm, so 60ppm is below floor
        // and should still receive a lift correction on the generic path.
        expect(program.annual_totals.Mg).toBeGreaterThan(0);
    });

    test('MLSN methodology never touches aaRanges/deriveCode at all', function () {
        var deriveCodeCalled = false;
        global.window.HillLabsSampleTypes = {
            deriveCode: function () { deriveCodeCalled = true; return 'S277'; },
            getRangesPpm: function () { return { min: 1, max: 2 }; },
        };
        var program = NutritionCalendar.computeProgram(baseInputs({ methodology: 'mlsn' }));
        expect(program.error).toBeUndefined();
        expect(deriveCodeCalled).toBe(false);
    });
});

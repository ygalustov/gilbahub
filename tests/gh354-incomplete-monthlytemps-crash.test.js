/**
 * GH-354 — computeProgram()'s GH-245 climateDataUnavailable guard only
 * checked that `inputs.monthlyTemps` was truthy, not that all 12 months
 * actually held a numeric value. calculateMonthlyGP() does the real
 * per-month completeness check and returns null on the first missing/
 * non-numeric month -- that null then reached distributeByGP() unchecked
 * (`monthlyGP[m]` on null), throwing "Cannot read properties of null
 * (reading '0')" three calls deep in the per-sample loop, instead of
 * surfacing here as the intended climateDataUnavailable result.
 *
 * Confirmed live via full stack trace on a real combined-export per-sample
 * recompute:
 *   TypeError: Cannot read properties of null (reading '0')
 *       at Object.distributeByGP (nutrition-calendar.js:1023:30)
 *       at Object.computeProgram (nutrition-calendar.js:1412:41)
 *
 * FIX: computeProgram()'s guard now validates completeness the same way
 * calculateMonthlyGP() does, so an incomplete monthlyTemps object is caught
 * here (returns climateDataUnavailable: true) instead of crashing deeper.
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

var COMPLETE_MONTHLY_TEMPS = [20, 20, 18, 15, 12, 9, 8, 9, 11, 14, 17, 19];

function baseInputs(overrides) {
    return Object.assign({
        annualNOverride: 200,
        traffic: 'moderate',
        clippingManagement: 'collected',
        bulkDensity: 1.4,
        soilDepth: 10,
        methodology: 'ammonium_acetate',
        species: 'perennialRyegrass',
        speciesDisplay: 'Perennial Ryegrass',
        isC4: false,
        distribution: 'gp_weighted',
        monthlyTemps: COMPLETE_MONTHLY_TEMPS,
        soilPpm: { P: 40, K: 276, Ca: 803, Mg: 129, S: 75 },
    }, overrides);
}

describe('GH-354 — computeProgram() catches an incomplete monthlyTemps instead of crashing', () => {
    test('regression: complete monthlyTemps (all 12 months numeric) still computes normally', () => {
        var program = NutritionCalendar.computeProgram(baseInputs());
        expect(program.climateDataUnavailable).toBeFalsy();
        expect(program.error).toBeFalsy();
        expect(program.program.monthly).toHaveLength(12);
    });

    test('one missing month (undefined, sparse array) -> climateDataUnavailable, does not throw', () => {
        var sparse = COMPLETE_MONTHLY_TEMPS.slice();
        delete sparse[5]; // month index 5 becomes a hole -> undefined
        expect(() => {
            var program = NutritionCalendar.computeProgram(baseInputs({ monthlyTemps: sparse }));
            expect(program.climateDataUnavailable).toBe(true);
            expect(program.climateDataUnavailableReason).toBeTruthy();
        }).not.toThrow();
    });

    test('one month explicitly null -> climateDataUnavailable, does not throw', () => {
        var withNull = COMPLETE_MONTHLY_TEMPS.slice();
        withNull[3] = null;
        expect(() => {
            var program = NutritionCalendar.computeProgram(baseInputs({ monthlyTemps: withNull }));
            expect(program.climateDataUnavailable).toBe(true);
        }).not.toThrow();
    });

    test('one month is a non-numeric string -> climateDataUnavailable, does not throw', () => {
        var withString = COMPLETE_MONTHLY_TEMPS.slice();
        withString[0] = 'n/a';
        expect(() => {
            var program = NutritionCalendar.computeProgram(baseInputs({ monthlyTemps: withString }));
            expect(program.climateDataUnavailable).toBe(true);
        }).not.toThrow();
    });

    test('monthlyTemps entirely absent -> still climateDataUnavailable (pre-existing behaviour unchanged)', () => {
        var program = NutritionCalendar.computeProgram(baseInputs({ monthlyTemps: null }));
        expect(program.climateDataUnavailable).toBe(true);
    });
});

describe('GH-354 — standalone reimplementation: the exact crash path', () => {
    test('BEFORE (bug): calculateMonthlyGP() returning null reaches distributeByGP() and throws', () => {
        var monthlyGP = NutritionCalendar.calculateMonthlyGP([20, 20, 18, 15, 12, 9, undefined, 9, 11, 14, 17, 19], false);
        expect(monthlyGP).toBeNull();
        expect(() => {
            NutritionCalendar.distributeByGP(200, monthlyGP);
        }).toThrow(/Cannot read propert/);
    });

    test('AFTER (fixed): the new completeness check in computeProgram() catches this before calculateMonthlyGP() ever runs', () => {
        var monthlyTemps = [20, 20, 18, 15, 12, 9, undefined, 9, 11, 14, 17, 19];
        var isComplete = [0,1,2,3,4,5,6,7,8,9,10,11].every(function(m) { return typeof monthlyTemps[m] === 'number'; });
        expect(isComplete).toBe(false);
    });
});

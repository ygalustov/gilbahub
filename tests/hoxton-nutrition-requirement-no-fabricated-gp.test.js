/**
 * Hoxton audit D02/D03 — nutrition-requirement-engine.js must never default a
 * missing month's temperature to 15degC.
 *
 * Background: even after the two latitude-guess fallbacks were removed from
 * the extraction layer (nutrition-summary-integration.js, nutrition-
 * calendar.js), the engine itself had a second, deeper silent fallback:
 *   const monthlyTemps = climate.monthlyTemps || {};
 *   ... const temp = (typeof monthlyTemps[month] === 'number') ? monthlyTemps[month] : 15;
 * Any missing or absent monthlyTemps silently became "every month is 15degC",
 * which for the PACE C3 model (sigma=5.5, optimum=20) is GP=exp(-0.5*((15-20)/5.5)^2)
 * ~= 66% — every month, for every site with unresolved climate data, printed as
 * if it were a real computed result. This test pins the fixed behaviour:
 * facility.climateDataUnavailable=true and monthlyGP=null when monthlyTemps is
 * missing or incomplete, with monthlyN reading as all-zero (not silently
 * computed), and a normal result when a complete series is supplied.
 */

'use strict';

global.window = global.window || {};
global.document = global.document || { addEventListener: function () {} };
global.console = { log: function () {}, warn: function () {}, error: function () {}, info: function () {} };

global.window.GilbaGrowthPotentialEngine = require('../assets/growth-potential-engine.js');
var Engine = require('../assets/nutrition-requirement-engine.js');

function baseInputs(climateOverride) {
    return {
        soil: { P: 30, K: 150, Ca: 800, Mg: 150, S: 20, pH: 6.5, methodology: 'MLSN' },
        turf: { species: 'perennialRyegrass', clippingsCollected: false, trafficIntensity: 'moderate' },
        climate: Object.assign({ hemisphere: 'south' }, climateOverride),
        overseedConfig: { isOverseed: false, baseIsC4: false, summerIntent: 'transition' }
    };
}

var COMPLETE_TEMPS = { 1: 20, 2: 20, 3: 20, 4: 20, 5: 20, 6: 20, 7: 20, 8: 20, 9: 20, 10: 20, 11: 20, 12: 20 };

describe('computeMonthlyGP — never defaults a missing month to 15degC', function () {
    test('null monthlyTemps returns null (not a 15degC-everywhere series)', function () {
        var result = Engine._computeMonthlyGP(null, null);
        expect(result).toBeNull();
    });

    test('empty-object monthlyTemps returns null', function () {
        var result = Engine._computeMonthlyGP({}, null);
        expect(result).toBeNull();
    });

    test('partial monthlyTemps (one month missing) returns null, not 11 real + 1 fabricated', function () {
        var partial = Object.assign({}, COMPLETE_TEMPS);
        delete partial[7]; // July missing
        var result = Engine._computeMonthlyGP(partial, null);
        expect(result).toBeNull();
    });

    test('complete monthlyTemps returns a real 1-12 keyed GP series', function () {
        var result = Engine._computeMonthlyGP(COMPLETE_TEMPS, null);
        expect(result).not.toBeNull();
        for (var m = 1; m <= 12; m++) {
            // Constant 20degC input, pure C3 optimum -> GP should read ~100%
            // for every month (matches the D02 probe the audit doc proposed).
            expect(result[m]).toBeCloseTo(1, 1);
        }
    });
});

describe('NutritionRequirementEngine_Pure.compute() — facility.climateDataUnavailable', function () {
    test('missing climate.monthlyTemps: climateDataUnavailable=true, monthlyGP=null, monthlyN all-zero', function () {
        var result = Engine.compute(baseInputs({ monthlyTemps: null }));

        expect(result.facility.climateDataUnavailable).toBe(true);
        expect(result.facility.monthlyGP).toBeNull();
        expect(result.facility.monthlyN).toHaveLength(12);
        result.facility.monthlyN.forEach(function (entry) {
            expect(entry.n).toBe(0);
            expect(entry.gp).toBe(0);
        });
        expect(result.facility.activeMonths).toBe(0);
    });

    test('climate.monthlyTemps entirely absent (undefined) behaves the same as null', function () {
        var inputs = baseInputs({});
        delete inputs.climate.monthlyTemps;
        var result = Engine.compute(inputs);

        expect(result.facility.climateDataUnavailable).toBe(true);
        expect(result.facility.monthlyGP).toBeNull();
    });

    test('real monthlyTemps: climateDataUnavailable=false, monthlyN carries a real programme', function () {
        var result = Engine.compute(baseInputs({ monthlyTemps: COMPLETE_TEMPS }));

        expect(result.facility.climateDataUnavailable).toBe(false);
        expect(result.facility.monthlyGP).not.toBeNull();
        var totalN = result.facility.monthlyN.reduce(function (s, e) { return s + e.n; }, 0);
        expect(totalN).toBeGreaterThan(0);
        expect(result.facility.activeMonths).toBeGreaterThan(0);
    });

    test('per-sample P/K/S requirements are computed independently of climate availability', function () {
        // Soil-driven perSample calc must not be gated on climate — only the
        // facility-level (site-wide) monthly N distribution is climate-dependent.
        var withClimate = Engine.compute(baseInputs({ monthlyTemps: COMPLETE_TEMPS }));
        var withoutClimate = Engine.compute(baseInputs({ monthlyTemps: null }));

        expect(withoutClimate.perSample.P.annualRequirement).toEqual(withClimate.perSample.P.annualRequirement);
        expect(withoutClimate.perSample.K.status).toEqual(withClimate.perSample.K.status);
    });
});

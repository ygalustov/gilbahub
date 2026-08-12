/**
 * Hoxton audit D02/D03 — NutritionCalendar.extractMonthlyTemps()
 *
 * Two things pinned here:
 *
 * 1. The latitude-band mean + cosine-seasonal-amplitude guess
 *    (estimateMonthlyTemps) is gone. For Auckland (lat ~-36.85, absLat > 35
 *    "temperate fallback" band) that formula produced amplitude=13.5degC —
 *    a continental swing, not the ~4.6degC a maritime site like Auckland
 *    actually has — which is exactly what printed the Monthly Schedule's
 *    three impossible 0% winter months in the Hoxton report. Fix: this
 *    function returns null when no real source resolved. No regional guess.
 *
 * 2. Real climate normals (ClimateFetchCoordinator, climate-engine-v2.js)
 *    are keyed 1-12 (Jan=1). This file's internal convention — calculateMonthlyGP,
 *    the calendar renderers — is 0-11 (Jan=0). extractMonthlyTemps is the one
 *    place that must re-index between them; get this wrong and the file reads
 *    monthlyTemps[0..11] off a 1-12 object, silently gets undefined for every
 *    key, and (pre this fix's sibling change) used to default every month to
 *    15degC — the exact same fabrication bug, via an off-by-one instead of a
 *    missing source.
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

describe('NutritionCalendar.extractMonthlyTemps — real source, re-indexed 1-12 -> 0-11', function () {
    test('climate.monthlyTemps (1-12 keyed, real source) is re-indexed to 0-11', function () {
        var real = { 1: 20.0, 2: 20.5, 3: 18.9, 4: 16.6, 5: 14.2, 6: 12.1,
                      7: 11.2, 8: 11.7, 9: 13.1, 10: 14.6, 11: 16.2, 12: 18.5 };

        var out = NutritionCalendar.extractMonthlyTemps({ monthlyTemps: real }, {});

        expect(out).not.toBeNull();
        expect(out[0]).toBe(20.0);   // Jan: key 1 -> index 0
        expect(out[6]).toBe(11.2);   // Jul: key 7 -> index 6
        expect(out[11]).toBe(18.5);  // Dec: key 12 -> index 11
        expect(out[1]).toBe(20.5);   // Feb: key 2 -> index 1
    });

    test('falls back to state.climate.monthlyTemps when climate.monthlyTemps is absent', function () {
        var real = { 1: 10, 2: 10, 3: 10, 4: 10, 5: 10, 6: 10, 7: 10, 8: 10, 9: 10, 10: 10, 11: 10, 12: 10 };
        var out = NutritionCalendar.extractMonthlyTemps({}, { climate: { monthlyTemps: real } });

        expect(out).not.toBeNull();
        expect(out[0]).toBe(10);
        expect(out[11]).toBe(10);
    });

    test('partial climate.monthlyTemps (not 12 keys) is treated as unavailable, not partially trusted', function () {
        var partial = { 1: 20, 2: 20, 3: 20 }; // only 3 months
        var out = NutritionCalendar.extractMonthlyTemps({ monthlyTemps: partial }, {});

        expect(out).toBeNull();
    });

    test('no real source anywhere returns null — no latitude-guessed regional profile', function () {
        // Pre-fix this would have called estimateMonthlyTemps(absLat, isSouthern)
        // and returned a fabricated 12-month series. That function no longer
        // exists at all.
        var out = NutritionCalendar.extractMonthlyTemps({}, {});
        expect(out).toBeNull();
        expect(typeof NutritionCalendar.estimateMonthlyTemps).toBe('undefined');
    });
});

describe('NutritionCalendar.computeProgram — climateDataUnavailable short-circuit', function () {
    test('returns { climateDataUnavailable: true } instead of computing against null temps', function () {
        var inputs = {
            annualNOverride: 200,
            traffic: 'moderate',
            clippingManagement: 'collected',
            distribution: 'gp_weighted',
            monthlyTemps: null,
            isC4: false,
            hemisphere: 'south',
            soilPpm: { P: 30, K: 150, Ca: 800, Mg: 150, S: 20 },
            bulkDensity: 1.4,
            soilDepth: 10,
            methodology: 'mlsn',
            maxNPerMonth: 50
        };

        var result = NutritionCalendar.computeProgram(inputs);

        expect(result.climateDataUnavailable).toBe(true);
        expect(result.error).toBeUndefined();
        expect(result.monthly).toBeUndefined();
    });

    test('does not throw when monthlyTemps is null (pre-fix: calculateMonthlyGP would read null[m])', function () {
        var inputs = {
            annualNOverride: 200,
            traffic: 'moderate',
            clippingManagement: 'collected',
            distribution: 'gp_weighted',
            monthlyTemps: null,
            isC4: false,
            hemisphere: 'south',
            soilPpm: { P: 30, K: 150, Ca: 800, Mg: 150, S: 20 },
            bulkDensity: 1.4,
            soilDepth: 10,
            methodology: 'mlsn',
            maxNPerMonth: 50
        };

        expect(function () { NutritionCalendar.computeProgram(inputs); }).not.toThrow();
    });
});

describe('NutritionCalendar.calculateMonthlyGP — defensive null guard', function () {
    test('null monthlyTemps returns null rather than throwing on null[m]', function () {
        expect(NutritionCalendar.calculateMonthlyGP(null, false)).toBeNull();
    });

    test('a complete 0-11 keyed series still computes normally', function () {
        var temps = {};
        for (var m = 0; m < 12; m++) temps[m] = 20;
        var gp = NutritionCalendar.calculateMonthlyGP(temps, false);
        expect(gp).not.toBeNull();
        expect(gp[0]).toBeGreaterThan(0.9);
    });
});

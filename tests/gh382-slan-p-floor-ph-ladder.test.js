/**
 * GH-382 (D31 divergence item 2) — nutrition-calendar.js's SLAN P floor was
 * flat (27 ppm, the pH-INDEPENDENT Carrow 2004 baseline) at every soil pH,
 * while nutrition-requirement-engine.js (and the GH-376 shared core) have
 * long applied a real, cited pH adjustment -- the "Spencer scaled-ladder"
 * method, Carrow et al. (2004) GCM 72(1):194-198 for the 27ppm floor,
 * Carrow, Waddington & Rieke (2001) for the pH x P-availability ratios --
 * so a Plan-page SLAN site away from neutral pH silently used a different
 * floor than the export did for the exact same sample. Part of the audit's
 * own D31 finding ("UI and export ... land 10% apart").
 *
 * First attempt at this fix touched NutritionCalendar.getThresholds()'s SLAN
 * branch -- traced live to be DEAD CODE for this specific bug: SLAN's P
 * floor for the actual correction-term calculation comes from a separate
 * block in computeProgram() (the one this file exercises) that populates
 * `aaRanges.P` unconditionally, so `calculateDeficit()`/`getThresholds()`
 * (the code getThresholds() lives in) is never reached for SLAN's P at all.
 * Reverted that dead branch; the real fix is in the `aaRanges` population
 * block itself, calling the engine's own exported, already-cited
 * `_getSlanTargetP(ph)` (word-export.js:8397-8404 already does exactly this,
 * same reason) rather than copying the ladder a third time. Degrades to the
 * pH-independent flat floor already in place when the engine script isn't
 * loaded or pH isn't a usable number -- never guesses a pH.
 *
 * Runs the REAL modules -- nutrition-requirement-engine.js loaded so
 * window.NutritionRequirementEngine_Pure._getSlanTargetP is the genuine
 * function, not a re-implementation of its ratio table.
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
var Engine = require('../assets/nutrition-requirement-engine.js');

var MONTHLY_TEMPS_0_11 = [20, 20, 18, 15, 12, 9, 8, 9, 11, 14, 17, 19];

function baseInputs(overrides) {
    return Object.assign({
        annualNOverride: 200,
        traffic: 'moderate',
        clippingManagement: 'collected',
        bulkDensity: 1.4,
        soilDepth: 10,
        methodology: 'slan',
        species: 'perennialRyegrass',
        speciesDisplay: 'Perennial Ryegrass',
        isC4: false,
        distribution: 'gp_weighted',
        monthlyTemps: MONTHLY_TEMPS_0_11,
        soilPpm: { P: 40, K: 199, Ca: 803, Mg: 129, S: 75 },
    }, overrides);
}

describe('GH-382 — SLAN P floor follows soil pH (Spencer scaled-ladder), matching the engine exactly', () => {
    test('sanity: the engine\'s real ladder is what this test compares against, not a re-implementation', () => {
        expect(typeof window.NutritionRequirementEngine_Pure._getSlanTargetP).toBe('function');
        expect(window.NutritionRequirementEngine_Pure._getSlanTargetP(5.0)).toBe(45);
        expect(window.NutritionRequirementEngine_Pure._getSlanTargetP(6.5)).toBe(27);
        expect(window.NutritionRequirementEngine_Pure._getSlanTargetP(8.5)).toBe(51);
    });

    test('acidic pH (5.0) raises the floor to 45ppm — a sample at 40ppm P now reads BELOW floor, not above', () => {
        var acidic = NutritionCalendar.computeProgram(baseInputs({ soilPH: undefined, pH: 5.0 }));
        expect(acidic.annual_totals_range.P).toEqual({ min: 45, max: 54 });
        expect(acidic.annual_lift.P).toBeGreaterThan(0);
    });

    test('neutral pH (6.5, inside 6.0-7.5) keeps the unadjusted 27ppm baseline floor — same sample now reads ABOVE floor', () => {
        var neutral = NutritionCalendar.computeProgram(baseInputs({ pH: 6.5 }));
        expect(neutral.annual_totals_range.P).toEqual({ min: 27, max: 54 });
        expect(neutral.annual_lift.P).toBe(0);
    });

    test('alkaline pH (8.5) raises the floor to 51ppm', () => {
        var alkaline = NutritionCalendar.computeProgram(baseInputs({ pH: 8.5 }));
        expect(alkaline.annual_totals_range.P).toEqual({ min: 51, max: 54 });
    });

    test('no pH supplied (null/undefined) degrades to the pre-fix flat 27ppm floor — never guesses a pH', () => {
        var noPh = NutritionCalendar.computeProgram(baseInputs({ pH: null }));
        expect(noPh.annual_totals_range.P).toEqual({ min: 27, max: 54 });
    });

    test('K/Ca/Mg/S ranges are completely unaffected by pH — this fix is scoped to P only, matching the engine', () => {
        var acidic = NutritionCalendar.computeProgram(baseInputs({ pH: 5.0 }));
        var neutral = NutritionCalendar.computeProgram(baseInputs({ pH: 6.5 }));
        ['K', 'Ca', 'Mg', 'S'].forEach(function (n) {
            expect(acidic.annual_totals_range[n]).toEqual(neutral.annual_totals_range[n]);
        });
    });

    test('cross-check against the real engine: calendar and engine now resolve the IDENTICAL P floor at five pH bands', () => {
        [4.9, 5.6, 7.0, 7.8, 9.0].forEach(function (ph) {
            var program = NutritionCalendar.computeProgram(baseInputs({ pH: ph }));
            var engineFloor = Engine._getSlanTargetP(ph);
            expect(program.annual_totals_range.P.min).toBe(engineFloor);
        });
    });

    test('defensive degradation: if the engine script were unavailable, the flat floor is used rather than crashing', () => {
        var saved = global.window.NutritionRequirementEngine_Pure;
        try {
            global.window.NutritionRequirementEngine_Pure = undefined;
            var program = NutritionCalendar.computeProgram(baseInputs({ pH: 5.0 }));
            expect(program.error).toBeUndefined();
            expect(program.annual_totals_range.P).toEqual({ min: 27, max: 54 });
        } finally {
            global.window.NutritionRequirementEngine_Pure = saved;
        }
    });

    test('collectFromState() prefers pH_water over a generic pH, matching word-export.js\'s own established resolution order', () => {
        global.window.GAIP_STATE = {
            inputs: { soil: { ppm: {}, pH_water: 5.4, pH: 6.9 } },
            turf: {}, climate: {},
        };
        var inputs = NutritionCalendar.collectFromState();
        expect(inputs.pH).toBe(5.4);
        delete global.window.GAIP_STATE;
    });

    test('collectFromState() falls back to a generic pH field when pH_water is absent, and to null when neither exists', () => {
        global.window.GAIP_STATE = { inputs: { soil: { ppm: {}, pH: 6.9 } }, turf: {}, climate: {} };
        expect(NutritionCalendar.collectFromState().pH).toBe(6.9);
        global.window.GAIP_STATE = { inputs: { soil: { ppm: {} } }, turf: {}, climate: {} };
        expect(NutritionCalendar.collectFromState().pH).toBeNull();
        delete global.window.GAIP_STATE;
    });
});

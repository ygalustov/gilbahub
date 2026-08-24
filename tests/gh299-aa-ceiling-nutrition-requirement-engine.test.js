/**
 * GH-299 (D07 item 6) — nutrition-requirement-engine.js's AMMONIUM_ACETATE
 * branch never had a ceiling: calculateNutrientRequirement() always returned
 * pure removal for AA sites, regardless of how far above the certificate's
 * sufficiency range the soil already was. This is the actual reported D07
 * symptom (Annual K Requirement flip-flopping instead of settling at 0 for a
 * HIGH-classified AA site) — items 3-5 already fixed the Soil page's own
 * classification/display; this is the last piece, the Nutrition Program's
 * separate annual-fertiliser-planning engine.
 *
 * FIX: an optional config.aaRange ({min,max} ppm) on the AMMONIUM_ACETATE
 * branch — when present and currentLevel >= aaRange.max, mirror the MLSN
 * tier's "above target -> 0" shape (annualRequirement: 0, status: 'High').
 * Absent config.aaRange (uncovered species/texture, or a nutrient the SSOT
 * has no range for) keeps today's unconditional pure-removal behaviour.
 * calculateAllRequirements() resolves config.aaRange **per nutrient** from a
 * config.aaRanges map (the SSOT's ranges differ per nutrient), and compute()
 * threads inputs.aaRanges through — the engine itself never calls
 * HillLabsSampleTypes, staying a pure function; callers resolve the ranges.
 */

'use strict';

global.window = global.window || {};
global.document = global.document || { addEventListener: function () {} };
global.console = { log: function () {}, warn: function () {}, error: function () {}, info: function () {} };

global.window.GilbaGrowthPotentialEngine = require('../assets/growth-potential-engine.js');
var Engine = require('../assets/nutrition-requirement-engine.js');

describe('GH-299 — AMMONIUM_ACETATE ceiling in calculateNutrientRequirement()', function () {
    test('currentLevel >= aaRange.max returns annualRequirement 0, status High (mirrors MLSN "above target" shape)', function () {
        var result = Engine._calculateNutrientRequirement('K', 250, {
            methodology: 'AMMONIUM_ACETATE',
            species: 'perennialRyegrass',
            aaRange: { min: 58.7, max: 195.7 }
        });
        expect(result.annualRequirement).toBe(0);
        expect(result.status).toBe('High');
        expect(result.methodology).toBe('AMMONIUM_ACETATE');
        expect(result.target).toBe(195.7);
        expect(result.threshold).toBe(58.7);
    });

    test('currentLevel exactly at aaRange.max also triggers the ceiling (>=, not >)', function () {
        var result = Engine._calculateNutrientRequirement('K', 195.7, {
            methodology: 'AMMONIUM_ACETATE',
            aaRange: { min: 58.7, max: 195.7 }
        });
        expect(result.annualRequirement).toBe(0);
        expect(result.status).toBe('High');
    });

    test('currentLevel below aaRange.max keeps pure-removal behaviour, status Adequate', function () {
        var result = Engine._calculateNutrientRequirement('K', 100, {
            methodology: 'AMMONIUM_ACETATE',
            species: 'perennialRyegrass',
            aaRange: { min: 58.7, max: 195.7 }
        });
        expect(result.status).toBe('Adequate');
        expect(result.annualRequirement).toBeGreaterThan(0);
    });

    test('a non-K nutrient (Ca) also gets the ceiling — not a K-only carve-out', function () {
        var high = Engine._calculateNutrientRequirement('Ca', 900, {
            methodology: 'AMMONIUM_ACETATE',
            aaRange: { min: 400, max: 800 }
        });
        expect(high.annualRequirement).toBe(0);
        expect(high.status).toBe('High');

        var low = Engine._calculateNutrientRequirement('Ca', 500, {
            methodology: 'AMMONIUM_ACETATE',
            aaRange: { min: 400, max: 800 }
        });
        expect(low.status).toBe('Adequate');
        expect(low.annualRequirement).toBeGreaterThan(0);
    });

    test('config.aaRange absent -> unchanged unconditional pure-removal behaviour (graceful degradation for uncovered species/texture)', function () {
        var result = Engine._calculateNutrientRequirement('K', 999999, {
            methodology: 'AMMONIUM_ACETATE',
            species: 'kikuyu'
        });
        expect(result.status).toBe('Adequate');
        expect(result.threshold).toBeNull();
        expect(result.target).toBeNull();
        expect(result.annualRequirement).toBeGreaterThan(0);
    });
});

describe('GH-299 — calculateAllRequirements() resolves aaRange per nutrient from config.aaRanges', function () {
    test('different nutrients get their own range from the aaRanges map (K ceiling does not leak onto Ca)', function () {
        var config = {
            methodology: 'AMMONIUM_ACETATE',
            species: 'perennialRyegrass',
            aaRanges: {
                K: { min: 58.7, max: 195.7 },
                Ca: { min: 400, max: 800 }
                // Mg/P/S deliberately absent -- SSOT has no range for them here.
            }
        };
        var soilValues = { K: 250, Ca: 500, Mg: 100, P: 30, S: 15 };
        var results = Engine._calculateAllRequirements(soilValues, config);

        expect(results.K.status).toBe('High');
        expect(results.K.annualRequirement).toBe(0);

        expect(results.Ca.status).toBe('Adequate');
        expect(results.Ca.annualRequirement).toBeGreaterThan(0);

        // Mg has no entry in aaRanges -> graceful degradation, unconditional removal.
        expect(results.Mg.status).toBe('Adequate');
        expect(results.Mg.threshold).toBeNull();
    });

    test('config.aaRanges absent entirely -> every nutrient falls back to unconditional pure removal', function () {
        var config = { methodology: 'AMMONIUM_ACETATE', species: 'kikuyu' };
        var results = Engine._calculateAllRequirements({ K: 999999, Ca: 999999 }, config);
        expect(results.K.status).toBe('Adequate');
        expect(results.Ca.status).toBe('Adequate');
    });
});

describe('GH-299 — compute() threads inputs.aaRanges through to perSample results', function () {
    function baseInputs(aaRanges) {
        return {
            soil: { K: 250, Ca: 900, Mg: 100, P: 30, S: 15, pH: 6.5, methodology: 'AMMONIUM_ACETATE' },
            turf: { species: 'perennialRyegrass', clippingsCollected: false, trafficIntensity: 'moderate' },
            climate: { hemisphere: 'south' },
            overseedConfig: { isOverseed: false, baseIsC4: false, summerIntent: 'transition' },
            aaRanges: aaRanges
        };
    }

    test('with aaRanges supplied, a HIGH nutrient shows 0 in perSample', function () {
        var result = Engine.compute(baseInputs({
            K: { min: 58.7, max: 195.7 },
            Ca: { min: 400, max: 800 }
        }));
        expect(result.perSample.K.annualRequirement).toBe(0);
        expect(result.perSample.K.status).toBe('High');
        expect(result.perSample.Ca.annualRequirement).toBe(0);
        expect(result.perSample.Ca.status).toBe('High');
    });

    test('without aaRanges, the same HIGH-level soil still returns pure removal (today\'s behaviour, unchanged)', function () {
        var result = Engine.compute(baseInputs(null));
        expect(result.perSample.K.status).toBe('Adequate');
        expect(result.perSample.K.annualRequirement).toBeGreaterThan(0);
    });
});

describe('GH-299 — MLSN and SLAN branches are byte-identical to before this fix (regression pin)', function () {
    test('MLSN: currentLevel > target still returns 0 with the existing Very Low/Low/Adequate/High/Excessive bands, untouched', function () {
        var high = Engine._calculateNutrientRequirement('K', 500, { methodology: 'MLSN', ph: 6.5, species: 'perennialRyegrass' });
        expect(high.methodology).toBe('MLSN');
        expect(high.annualRequirement).toBe(0);

        var veryLow = Engine._calculateNutrientRequirement('K', 5, { methodology: 'MLSN', ph: 6.5, species: 'perennialRyegrass' });
        expect(veryLow.status).toBe('Very Low');
        expect(veryLow.annualRequirement).toBeGreaterThan(0);
    });

    test('SLAN: above-ceiling suppression and floor/ceiling shape untouched', function () {
        var high = Engine._calculateNutrientRequirement('K', 300, { methodology: 'SLAN', species: 'perennialRyegrass' });
        expect(high.methodology).toMatch(/SLAN/);
        expect(high.annualRequirement).toBe(0);
        expect(high.floor).toBe(75);
        expect(high.ceiling).toBe(176);
    });
});

/**
 * GH-309 (D07 follow-up) — nutrition-requirement-engine.js's AMMONIUM_ACETATE
 * branch (GH-299) had a ceiling (currentLevel >= aaRange.max -> 0) but no
 * below-floor deficit/lift correction — a low AA reading always fell through
 * to pure removal, unlike MLSN and SLAN in the same file, which both add
 * (floor/target - currentLevel) / yearsToCorrect below their floor.
 *
 * Checked against old-hub parity before fixing (not assumed): git history
 * shows nutrition-calendar.js is the only AA-aware engine present since this
 * repo's initial commit (what the old hub actually shipped), and it has
 * always added the same below-floor lift correction for AA. This engine
 * (nutrition-requirement-engine.js) didn't exist in the old hub at all
 * (SaaS-era extraction, b35fix302) — its previous "no lift, ever" behaviour
 * was a fresh decision, not inherited legacy behaviour, and it left this
 * engine and nutrition-calendar.js disagreeing on the same site/nutrient —
 * a miss against the Hoxton audit's regression-fixture assertion 20 ("UI and
 * export return identical annual N, P and K requirements for the same
 * site").
 *
 * FIX: when config.aaRange is present and currentLevel < aaRange.min, add
 * (aaRange.min - currentLevel) / yearsToCorrect on top of removal, status
 * 'Low' — same shape as the MLSN/SLAN below-floor branches in this file.
 */

'use strict';

global.window = global.window || {};
global.document = global.document || { addEventListener: function () {} };
global.console = { log: function () {}, warn: function () {}, error: function () {}, info: function () {} };

global.window.GilbaGrowthPotentialEngine = require('../assets/growth-potential-engine.js');
var Engine = require('../assets/nutrition-requirement-engine.js');

describe('GH-309 — AMMONIUM_ACETATE below-floor lift in calculateNutrientRequirement()', function () {
    test('currentLevel below aaRange.min gets removal + lift correction, status Low', function () {
        var result = Engine._calculateNutrientRequirement('Mg', 20, {
            methodology: 'AMMONIUM_ACETATE',
            species: 'perennialRyegrass',
            aaRange: { min: 36.6, max: 85.4 }
        });
        expect(result.status).toBe('Low');
        expect(result.correctionRequired).toBeCloseTo((36.6 - 20) / 3, 5); // Mg yearsToCorrect = 3
        expect(result.annualRequirement).toBeCloseTo(result.removal + result.correctionRequired, 1);
        expect(result.threshold).toBe(36.6);
        expect(result.target).toBe(85.4);
    });

    test('currentLevel exactly at aaRange.min does NOT trigger lift (>= floor is sufficient, matches SLAN\'s inclusive-floor convention)', function () {
        var result = Engine._calculateNutrientRequirement('Mg', 36.6, {
            methodology: 'AMMONIUM_ACETATE',
            aaRange: { min: 36.6, max: 85.4 }
        });
        expect(result.status).toBe('Adequate');
        expect(result.correctionRequired).toBe(0);
    });

    test('a mid-range reading (36.6-85.4) still gets pure removal only, unaffected by the new branch', function () {
        var result = Engine._calculateNutrientRequirement('Mg', 60, {
            methodology: 'AMMONIUM_ACETATE',
            aaRange: { min: 36.6, max: 85.4 }
        });
        expect(result.status).toBe('Adequate');
        expect(result.correctionRequired).toBe(0);
        expect(result.annualRequirement).toBe(result.removal);
    });

    test('a non-K nutrient (K itself, low) also gets lift — not a Mg-only carve-out', function () {
        var result = Engine._calculateNutrientRequirement('K', 40, {
            methodology: 'AMMONIUM_ACETATE',
            species: 'perennialRyegrass',
            aaRange: { min: 58.7, max: 195.7 }
        });
        expect(result.status).toBe('Low');
        expect(result.correctionRequired).toBeCloseTo((58.7 - 40) / 2, 5); // K yearsToCorrect = 2
    });

    test('config.aaRange absent -> unchanged unconditional pure-removal behaviour, no lift ever fires (graceful degradation)', function () {
        var result = Engine._calculateNutrientRequirement('Mg', 1, {
            methodology: 'AMMONIUM_ACETATE',
            species: 'kikuyu'
        });
        expect(result.status).toBe('Adequate');
        expect(result.correctionRequired).toBe(0);
        expect(result.threshold).toBeNull();
    });

    test('calculateAllRequirements() applies lift per-nutrient from the aaRanges map', function () {
        var config = {
            methodology: 'AMMONIUM_ACETATE',
            species: 'perennialRyegrass',
            aaRanges: {
                K: { min: 58.7, max: 195.7 },
                Mg: { min: 36.6, max: 85.4 }
                // Ca/P/S deliberately absent -- SSOT has no range for them here.
            }
        };
        var soilValues = { K: 40, Mg: 20, Ca: 500, P: 30, S: 15 };
        var results = Engine._calculateAllRequirements(soilValues, config);

        expect(results.K.status).toBe('Low');
        expect(results.Mg.status).toBe('Low');
        // Ca has no entry in aaRanges -> graceful degradation, unconditional removal.
        expect(results.Ca.status).toBe('Adequate');
        expect(results.Ca.correctionRequired).toBe(0);
    });

    test('compute() threads a below-floor lift through to perSample results', function () {
        var result = Engine.compute({
            soil: { K: 40, Ca: 900, Mg: 100, P: 30, S: 15, pH: 6.5, methodology: 'AMMONIUM_ACETATE' },
            turf: { species: 'perennialRyegrass', clippingsCollected: false, trafficIntensity: 'moderate' },
            climate: { hemisphere: 'south' },
            overseedConfig: { isOverseed: false, baseIsC4: false, summerIntent: 'transition' },
            aaRanges: { K: { min: 58.7, max: 195.7 }, Ca: { min: 400, max: 800 } }
        });
        expect(result.perSample.K.status).toBe('Low');
        expect(result.perSample.K.annualRequirement).toBeGreaterThan(0);
        // Ca is above its ceiling -> still 0, unaffected by the lift addition.
        expect(result.perSample.Ca.status).toBe('High');
        expect(result.perSample.Ca.annualRequirement).toBe(0);
    });
});

describe('GH-309 — MLSN and SLAN branches remain byte-identical (regression pin)', function () {
    test('MLSN below-threshold correction shape untouched', function () {
        var result = Engine._calculateNutrientRequirement('K', 5, { methodology: 'MLSN', ph: 6.5, species: 'perennialRyegrass' });
        expect(result.status).toBe('Very Low');
        expect(result.annualRequirement).toBeGreaterThan(0);
    });

    test('SLAN below-floor lift-to-floor shape untouched', function () {
        var result = Engine._calculateNutrientRequirement('K', 10, { methodology: 'SLAN', species: 'perennialRyegrass' });
        expect(result.status).toBe('Deficient');
        expect(result.floor).toBe(75);
    });
});

/**
 * GH-248 — C3/C4 species misclassification for pure (non-overseed) sites.
 *
 * Found while auditing why the live Plan-page GP series and the exported
 * report's GP series could disagree even with correct climate data: the
 * codebase has several independent, hand-written C3/C4 classifiers feeding
 * GilbaGrowthPotentialEngine.compute(), and two of them disagreed with the
 * canonical SpeciesController for real, selectable single-species turf
 * types — no overseed/blend involved.
 *
 * Bug 1 — nutrition-calendar.js:isC4Species() (live "Monthly Nutrient
 * Program"/"Monthly Schedule"): its hardcoded C4 list used 'zoysiagrass'
 * and 'buffalo', but normalizeSpecies() (which delegates to
 * SpeciesController.normalize() -> toNutrientKey()) actually produces
 * 'zoysia' and 'buffalograss' for those species. Pure Zoysia and pure
 * Buffalograss sites were silently computed with the C3 GP curve
 * (optimum 20degC) instead of C4 (optimum 31degC).
 *
 * Bug 2 — hub-tissue-v3.js's inline "Current Growth Conditions" GP species
 * check matched only "bent"/"rye"/"fescue" as C3, defaulting everything
 * else (including a missing species name) to C4. Kentucky Bluegrass and
 * Annual Bluegrass (Poa annua) — both real C3 species, both absent from
 * that substring list — were misclassified as C4. This is also the only
 * classifier in the codebase whose default direction was C4 rather than
 * C3 for an unrecognized/missing species.
 *
 * Fix: nutrition-calendar.js's C4 list corrected to match normalizeSpecies()'s
 * actual output keys; hub-tissue-v3.js's inline check now delegates to
 * SpeciesController.isC4Species() (the canonical classifier, already loaded
 * before hub-tissue-v3.js on every page that reaches this code), falling
 * back to the old substring check only if SpeciesController isn't loaded.
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

require('../assets/species-controller.js');
var SpeciesController = global.window.SpeciesController;

require('../assets/nutrition-calendar.js');
var NutritionCalendar = global.window.GilbaNutritionCalendar;

// ─────────────────────────────────────────────────────────────────────────────
// 1. SpeciesController.isC4Species — the canonical classifier
// ─────────────────────────────────────────────────────────────────────────────

describe('GH-248 — SpeciesController.isC4Species (canonical)', function () {
    test.each([
        ['Couch', true],
        ['Kikuyu', true],
        ['Seashore Paspalum', true],
        ['Buffalograss', true],
        ['Zoysia', true],
    ])('%s is classified C4', function (species, expected) {
        expect(SpeciesController.isC4Species(species)).toBe(expected);
    });

    test.each([
        ['Perennial Ryegrass', false],
        ['Kentucky Bluegrass', false],
        ['Tall Fescue', false],
        ['Creeping Bentgrass (Greens)', false],
        ['Browntop Bent (Fairways)', false],
        ['Annual Bluegrass (Greens)', false],
    ])('%s is classified C3', function (species, expected) {
        expect(SpeciesController.isC4Species(species)).toBe(expected);
    });

    test('unrecognized species name defaults to C3 (false), not C4', function () {
        expect(SpeciesController.isC4Species('Some Unknown Cultivar XYZ')).toBe(false);
    });
});

// ─────────────────────────────────────────────────────────────────────────────
// 2. NutritionCalendar.isC4Species(normalizeSpecies(...)) — regression pin
//    for the live Monthly Nutrient Program / Monthly Schedule path
// ─────────────────────────────────────────────────────────────────────────────

describe('GH-248 — NutritionCalendar isC4Species/normalizeSpecies round-trip', function () {
    function isC4For(rawSpecies) {
        return NutritionCalendar.isC4Species(NutritionCalendar.normalizeSpecies(rawSpecies));
    }

    test('Buffalograss round-trips to C4 (was silently C3 pre-fix — key mismatch buffalo vs buffalograss)', function () {
        expect(NutritionCalendar.normalizeSpecies('Buffalograss')).toBe('buffalograss');
        expect(isC4For('Buffalograss')).toBe(true);
    });

    test('Zoysia round-trips to C4 (was silently C3 pre-fix — key mismatch zoysiagrass vs zoysia)', function () {
        expect(NutritionCalendar.normalizeSpecies('Zoysia')).toBe('zoysia');
        expect(isC4For('Zoysia')).toBe(true);
    });

    test('Couch/Bermuda still round-trips to C4 (no regression)', function () {
        expect(isC4For('Couch')).toBe(true);
    });

    test('Kikuyu still round-trips to C4 (no regression)', function () {
        expect(isC4For('Kikuyu')).toBe(true);
    });

    test('Seashore Paspalum still round-trips to C4 (no regression)', function () {
        expect(isC4For('Seashore Paspalum')).toBe(true);
    });

    test('Perennial Ryegrass round-trips to C3 (sanity — cool-season stays cool-season)', function () {
        expect(isC4For('Perennial Ryegrass')).toBe(false);
    });

    test('Kentucky Bluegrass round-trips to C3 (sanity)', function () {
        expect(isC4For('Kentucky Bluegrass')).toBe(false);
    });
});

// ─────────────────────────────────────────────────────────────────────────────
// 3. hub-tissue-v3.js "Current Growth Conditions" GP species check —
//    source-pattern pin (file is not require()-able as a module; same
//    technique used by tests/hub-tissue-analysis-writeback-merge-b35fix391.test.js)
// ─────────────────────────────────────────────────────────────────────────────

describe('GH-248 — hub-tissue-v3.js GP species check delegates to SpeciesController', function () {
    var fs = require('fs');
    var path = require('path');
    var src = fs.readFileSync(path.join(__dirname, '../assets/hub-tissue-v3.js'), 'utf8');

    test('GP species selection calls SpeciesController.isC4Species', function () {
        expect(src).toMatch(/window\.SpeciesController\s*&&\s*typeof\s+window\.SpeciesController\.isC4Species\s*===\s*['"]function['"]/);
        expect(src).toMatch(/window\.SpeciesController\.isC4Species\(r\.turf\.grassSpecies\)/);
    });

    test('old bent/rye/fescue-only substring check survives only as the no-SpeciesController fallback', function () {
        // Must still exist (defensive fallback), but no longer be the sole/primary path —
        // i.e. it must appear on the falsy branch of the SpeciesController guard, not standalone.
        var idx = src.indexOf('window.SpeciesController.isC4Species(r.turf.grassSpecies)');
        expect(idx).toBeGreaterThan(-1);
        var nearby = src.slice(idx, idx + 700);
        expect(nearby).toMatch(/indexOf\("bent"\)/);
        expect(nearby).toMatch(/indexOf\("rye"\)/);
        expect(nearby).toMatch(/indexOf\("fescue"\)/);
    });
});

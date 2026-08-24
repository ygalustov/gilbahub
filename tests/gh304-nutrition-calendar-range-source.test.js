/**
 * GH-304 (D07 item 7 follow-up, 2026-08-24) — computeProgram()'s AA ceiling
 * (GH-300) has the same "certificate vs texture-fallback" gap the rest of
 * item 7 already closed on the Soil page (hub-tissue-v3.js/soil-nutrition-
 * analysis.js) and the sample-switcher (SampleAnalysisController.php): it
 * silently computed a number from the texture-only fallback whenever
 * getRangesPpm() found no range for a specific nutrient, with no way for the
 * "Annual Requirements (kg/ha)" card (nutrition-calendar.js's renderSummary(),
 * the Plan page's own card -- a 5th, structurally separate implementation
 * from the Soil page's Annual Requirements) to tell the difference.
 *
 * Confirmed live: on an S277 (Hagley Oval) site, P/K/Ca/Mg all correctly zero
 * (soil values above the certificate ceiling) but S stays at 10 kg/ha/yr with
 * no indication that S277 prints no Sulphur range at all -- indistinguishable
 * from a genuine "below ceiling, needs fertiliser" case.
 *
 * FIX: computeProgram() now returns annual_totals_range_source (per P/K/Ca/
 * Mg/S, 'certificate' | 'texture-fallback' -- N excluded, no AA range concept
 * applies to it), set the same way hub-tissue-v3.js's aaRangeSource is:
 * defaults to 'texture-fallback', flips to 'certificate' whenever
 * getRangesPpm() resolves a range for that nutrient, independent of whether
 * the ceiling actually fires (a certificate-backed range that wasn't
 * exceeded is still 'certificate'). renderSummary() reads it to show a
 * "Generic" badge next to the nutrient name -- number unchanged, only the
 * framing changes, per the user's "label, don't remove" decision.
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

// Same fake SSOT as gh300's test: S277 has ranges for K/Ca but (matching the
// real hill-labs-sample-types.js/JSON data) no range for S at all.
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
            return ranges[nutrient] || null; // P, Mg, S deliberately absent -> null
        },
    };
}

describe('GH-304 — computeProgram() tags annual_totals_range_source', function () {
    test('certificate-matched nutrients (K, Ca) are tagged certificate', function () {
        global.window.HillLabsSampleTypes = fakeHillLabsSampleTypes();
        var program = NutritionCalendar.computeProgram(baseInputs());
        expect(program.annual_totals_range_source.K).toBe('certificate');
        expect(program.annual_totals_range_source.Ca).toBe('certificate');
    });

    test('S277 site with Sulphur: S is tagged texture-fallback even though K/Ca on the same site are certificate', function () {
        global.window.HillLabsSampleTypes = fakeHillLabsSampleTypes();
        var program = NutritionCalendar.computeProgram(baseInputs());
        expect(program.annual_totals_range_source.S).toBe('texture-fallback');
        // Not zeroed -- no certificate ceiling to compare against -- but now labelled.
        expect(program.annual_totals.S).toBeGreaterThan(0);
    });

    test('P and Mg (no range in the fake SSOT either) are also tagged texture-fallback', function () {
        global.window.HillLabsSampleTypes = fakeHillLabsSampleTypes();
        var program = NutritionCalendar.computeProgram(baseInputs());
        expect(program.annual_totals_range_source.P).toBe('texture-fallback');
        expect(program.annual_totals_range_source.Mg).toBe('texture-fallback');
    });

    test('uncovered species/texture: every nutrient stays texture-fallback', function () {
        global.window.HillLabsSampleTypes = fakeHillLabsSampleTypes();
        var program = NutritionCalendar.computeProgram(baseInputs({ speciesDisplay: 'Kikuyu', soilTexture: 'loam' }));
        ['P', 'K', 'Ca', 'Mg', 'S'].forEach(function (nut) {
            expect(program.annual_totals_range_source[nut]).toBe('texture-fallback');
        });
    });

    test('MLSN methodology: range_source object still present (all texture-fallback) but never consulted for a ceiling', function () {
        var program = NutritionCalendar.computeProgram(baseInputs({ methodology: 'mlsn' }));
        expect(program.annual_totals_range_source.K).toBe('texture-fallback');
        expect(program.annual_totals.K).toBeGreaterThan(0);
    });

    test('HillLabsSampleTypes not loaded at all: graceful degradation, all texture-fallback, no throw', function () {
        global.window.HillLabsSampleTypes = undefined;
        var program = NutritionCalendar.computeProgram(baseInputs());
        expect(program.error).toBeUndefined();
        expect(program.annual_totals_range_source.K).toBe('texture-fallback');
    });
});

describe('GH-304 — renderSummary() renders the generic badge from annual_totals_range_source', function () {
    let src;
    beforeAll(() => {
        src = require('fs').readFileSync(require('path').join(__dirname, '../assets/nutrition-calendar.css'), 'utf8');
    });

    test('CSS class gilba-nut-generic-badge is defined', () => {
        expect(src).toMatch(/\.gilba-nut-generic-badge\s*\{/);
    });

    test('renderSummary structural pin: badge only rendered for AA, never for N, gated on rangeSource', () => {
        const jsSrc = require('fs').readFileSync(require('path').join(__dirname, '../assets/nutrition-calendar.js'), 'utf8');
        const block = jsSrc.slice(jsSrc.indexOf("Annual Requirements (kg/ha)"), jsSrc.indexOf("n_recycled > 0 ?", jsSrc.indexOf("Annual Requirements (kg/ha)")));
        expect(block).toMatch(/const isAA = \(meta\.methodology \|\| ''\)\.toUpperCase\(\) === 'AMMONIUM_ACETATE';/);
        expect(block).toMatch(/const isGeneric = isAA && el !== 'N' && rangeSource\[el\] === 'texture-fallback';/);
        expect(block).toMatch(/gilba-nut-generic-badge/);
    });
});

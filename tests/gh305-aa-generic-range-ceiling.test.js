/**
 * GH-305 (D07 item 6, "correction for generic numbers too" -- explicit user
 * decision, 2026-08-24) — computeProgram()'s AA ceiling (GH-300/303) was
 * certificate-only: an uncertified nutrient (uncovered species/texture, or a
 * covered sample-type code whose certificate simply prints no range for one
 * specific nutrient -- e.g. Sulphur on S277) could never be zeroed, even when
 * clearly high per the generic texture-only band, because there was no
 * ceiling to compare against at all.
 *
 * Confirmed live: after GH-304 added the "Generic" label, the user asked
 * directly why S stayed at 10 kg/ha/yr instead of 0 despite the Soil page
 * showing HIGH for the same nutrient -- "it will be incorrect to recommend
 * adding fertilizers if we have already high numbers". This is a genuine
 * algorithm change (today: certificate-only ceiling; after: certificate OR
 * generic texture-only ceiling), explicitly confirmed by the user before
 * implementing, per the project's algorithm-parity rule.
 *
 * FIX: when the certificate path (HillLabsSampleTypes.deriveCode()/
 * getRangesPpm()) doesn't cover a specific nutrient, fall back to
 * AmmoniumAcetateMethodology.getSufficiencyRange(nutrient, soilTypeKey) --
 * the SAME generic sands/others SSOT hub-tissue-v3.js's texture-only
 * aaRanges and SampleAnalysisController.php's AA_RANGES already use -- and
 * apply the same >= ceiling->0 rule. rangeSource (GH-304) intentionally
 * stays 'texture-fallback' for these: the ceiling now fires, but the
 * "Generic" label still applies, since it's still not a certificate value.
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

// S277 has certificate ranges for K/Ca only -- P, Mg, S deliberately absent,
// matching the real hill-labs-sample-types.js/JSON data exactly (S277 prints
// no Sulphur range at all).
function fakeHillLabsSampleTypes() {
    return {
        deriveCode: function (species, texture) {
            var isSandy = String(texture || '').toLowerCase().indexOf('sand') !== -1;
            if (species === 'Perennial Ryegrass' && isSandy) return 'S277';
            return null;
        },
        getRangesPpm: function (code, nutrient) {
            if (code !== 'S277') return null;
            var ranges = { K: { min: 58.7, max: 195.7 }, Ca: { min: 800, max: 1600 } };
            return ranges[nutrient] || null;
        },
    };
}

// Same numbers as the real ammonium-acetate-methodology.js's AMMONIUM_ACETATE_RANGES.
function fakeAmmoniumAcetateMethodology() {
    var RANGES = {
        P: { all: { medium: [12, 28] } },
        K: { sands: { medium: [75, 175] }, others: { medium: [100, 235] } },
        Ca: { all: { medium: [500, 750] } },
        Mg: { sands: { medium: [100, 200] }, others: { medium: [140, 250] } },
        S: { all: { medium: [30, 60] } },
    };
    return {
        getSufficiencyRange: function (nutrient, soilType) {
            var config = RANGES[nutrient];
            if (!config) return null;
            var band = config[soilType] || config.all;
            if (!band) return null;
            return { ranges: { medium: band.medium } };
        },
    };
}

describe('GH-305 — computeProgram() AA ceiling also fires on the generic texture-only range', function () {
    test('S277 site with Sulphur (75ppm, no certificate range): generic ceiling (30-60) now zeroes it', function () {
        global.window.HillLabsSampleTypes = fakeHillLabsSampleTypes();
        global.window.AmmoniumAcetateMethodology = fakeAmmoniumAcetateMethodology();
        var program = NutritionCalendar.computeProgram(baseInputs());
        expect(program.annual_totals.S).toBe(0);
        // Still labelled generic, not certificate -- the ceiling firing
        // doesn't change where the range actually came from.
        expect(program.annual_totals_range_source.S).toBe('texture-fallback');
    });

    test('certificate-backed K (S277, 199ppm > 195.7ppm ceiling) still zeroes via the certificate path, unaffected by the new fallback', function () {
        global.window.HillLabsSampleTypes = fakeHillLabsSampleTypes();
        global.window.AmmoniumAcetateMethodology = fakeAmmoniumAcetateMethodology();
        var program = NutritionCalendar.computeProgram(baseInputs());
        expect(program.annual_totals.K).toBe(0);
        expect(program.annual_totals_range_source.K).toBe('certificate');
    });

    test('a generic-range nutrient below its ceiling is unaffected (S=20ppm vs generic ceiling 60ppm)', function () {
        global.window.HillLabsSampleTypes = fakeHillLabsSampleTypes();
        global.window.AmmoniumAcetateMethodology = fakeAmmoniumAcetateMethodology();
        var program = NutritionCalendar.computeProgram(baseInputs({ soilPpm: { P: 10, K: 199, Ca: 803, Mg: 129, S: 20 } }));
        // S=20 < generic ceiling 60 -> not zeroed, still texture-fallback labelled.
        expect(program.annual_totals.S).toBeGreaterThan(0);
        expect(program.annual_totals_range_source.S).toBe('texture-fallback');
    });

    test('uncovered species/texture (deriveCode returns null): generic ceiling still applies to ALL of P/K/Ca/Mg/S now, not just uncapped', function () {
        global.window.HillLabsSampleTypes = fakeHillLabsSampleTypes();
        global.window.AmmoniumAcetateMethodology = fakeAmmoniumAcetateMethodology();
        // Kikuyu/loam -> deriveCode() null -> every nutrient falls to the generic "others" band.
        // K=199 vs others medium ceiling 235 -> NOT high enough to zero (still below).
        // Ca=803 vs others/all medium ceiling 750 -> zeroed.
        var program = NutritionCalendar.computeProgram(baseInputs({
            speciesDisplay: 'Kikuyu', soilTexture: 'loam',
            soilPpm: { P: 40, K: 199, Ca: 803, Mg: 129, S: 75 },
        }));
        expect(program.annual_totals_range_source.K).toBe('texture-fallback');
        expect(program.annual_totals.K).toBeGreaterThan(0); // 199 < 235 (others ceiling)
        expect(program.annual_totals.Ca).toBe(0); // 803 >= 750
        expect(program.annual_totals.S).toBe(0); // 75 >= 60
    });

    test('regression: MLSN methodology never touches AmmoniumAcetateMethodology (the AA generic-fallback path); it gets its own MLSN ceiling instead (GH-319)', function () {
        var aamCalled = false;
        global.window.HillLabsSampleTypes = fakeHillLabsSampleTypes();
        global.window.AmmoniumAcetateMethodology = {
            getSufficiencyRange: function () { aamCalled = true; return { ranges: { medium: [1, 2] } }; },
        };
        // K=199ppm (baseInputs default) is above the MLSN ceiling (37 x 1.5
        // = 55.5ppm), so GH-319's own MLSN branch zeroes it -- via a
        // completely different code path from the AA one this test guards.
        var program = NutritionCalendar.computeProgram(baseInputs({ methodology: 'mlsn' }));
        expect(aamCalled).toBe(false);
        expect(program.annual_totals.K).toBe(0);
    });

    test('graceful degradation: neither HillLabsSampleTypes nor AmmoniumAcetateMethodology loaded -> unchanged uncapped behaviour, no throw', function () {
        global.window.HillLabsSampleTypes = undefined;
        global.window.AmmoniumAcetateMethodology = undefined;
        var program = NutritionCalendar.computeProgram(baseInputs());
        expect(program.error).toBeUndefined();
        expect(program.annual_totals.S).toBeGreaterThan(0);
        expect(program.annual_totals_range_source.S).toBe('texture-fallback');
    });

    test('graceful degradation: AmmoniumAcetateMethodology loaded but HillLabsSampleTypes is not -- generic fallback still fires for every nutrient', function () {
        global.window.HillLabsSampleTypes = undefined;
        global.window.AmmoniumAcetateMethodology = fakeAmmoniumAcetateMethodology();
        var program = NutritionCalendar.computeProgram(baseInputs());
        // No certificate source at all -> every nutrient falls straight to generic.
        expect(program.annual_totals.K).toBe(0); // 199 >= sands generic ceiling 175
        expect(program.annual_totals.S).toBe(0); // 75 >= generic ceiling 60
        expect(program.annual_totals_range_source.K).toBe('texture-fallback');
    });
});

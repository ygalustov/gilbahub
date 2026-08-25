/**
 * GH-319 ("do for all") — the D07/AA ceiling work (GH-300 onward) never
 * extended to MLSN/SLAN in nutrition-calendar.js's computeProgram(): that
 * function's below-floor deficit/lift and above-ceiling zeroing were gated
 * to `isAAMethodology` specifically, so MLSN/SLAN sites always got pure
 * removal, never a ceiling, and the Nutrient Delivery Summary table's
 * Current/Range columns (GH-311/313) always showed "—" for them (no
 * resolved range to compute Current/Balance/Status from).
 *
 * FIX: resolve a real floor/ceiling range for MLSN and SLAN too, in the same
 * `aaRanges` object AA already populates, then remove the `isAAMethodology`
 * gates from both the deficit-calc loop and the ceiling-zeroing block so any
 * methodology with a resolved range gets the same three-tier treatment.
 *
 *   SLAN: Carrow, R.N. et al. (2004). GCM 72(1):194-198 — a real, published,
 *   two-sided range, already used by nutrition-requirement-engine.js via
 *   GilbaClassificationConstants.SLAN_RANGES. This calendar previously only
 *   read the single-value floor (SLAN_THRESHOLDS, itself SLAN_RANGES.floor).
 *
 *   MLSN: Woods, Stowell & Gelernter (2016) publish a floor only, no
 *   published ceiling exists. Reused nutrition-requirement-engine.js's own
 *   established hub-wide convention (ceiling = floor x 1.5, TARGET_MULTIPLIER)
 *   rather than inventing a new number.
 *
 * Consumer side (nutrition-prebble-integration.js/nutrition-au-fertiliser-
 * integration.js's classifyBalance()) needed NO changes — it was already
 * written generically against program.annual_totals_range/annual_removal/
 * annual_lift with no methodology check of its own, so MLSN/SLAN sites start
 * getting Current/Removal/Lift/Range/Balance/Status automatically once
 * nutrition-calendar.js populates that data for them.
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
        clippingManagement: 'collected',
        bulkDensity: 1.4,
        soilDepth: 10,
        methodology: 'mlsn',
        species: 'perennialRyegrass',
        speciesDisplay: 'Perennial Ryegrass',
        isC4: false,
        distribution: 'gp_weighted',
        monthlyTemps: MONTHLY_TEMPS_0_11,
        soilPpm: { P: 40, K: 199, Ca: 803, Mg: 129, S: 75 },
    }, overrides);
}

describe('GH-319 — MLSN ceiling (floor x 1.5)', () => {
    test('K far above ceiling (199ppm vs 37x1.5=55.5ppm) -> annualK 0, range tagged, no lift', () => {
        var program = NutritionCalendar.computeProgram(baseInputs());
        expect(program.error).toBeUndefined();
        expect(program.annual_totals.K).toBe(0);
        expect(program.annual_totals_range.K).toEqual({ min: 37, max: 55.5 });
        expect(program.annual_lift.K).toBe(0);
    });

    test('K within floor..ceiling (45ppm, between 37 and 55.5) -> removal only, not zeroed, no lift', () => {
        var program = NutritionCalendar.computeProgram(baseInputs({ soilPpm: { P: 40, K: 45, Ca: 803, Mg: 129, S: 75 } }));
        expect(program.annual_totals.K).toBeGreaterThan(0);
        expect(program.annual_lift.K).toBe(0);
    });

    test('K below floor (20ppm, below 37) -> lift correction added on top of removal', () => {
        var atFloor = NutritionCalendar.computeProgram(baseInputs({ soilPpm: { P: 40, K: 37, Ca: 803, Mg: 129, S: 75 } }));
        var belowFloor = NutritionCalendar.computeProgram(baseInputs({ soilPpm: { P: 40, K: 20, Ca: 803, Mg: 129, S: 75 } }));
        expect(belowFloor.annual_lift.K).toBeGreaterThan(0);
        expect(belowFloor.annual_totals.K).toBeGreaterThan(atFloor.annual_totals.K);
    });

    test('annual_removal is exposed and identical regardless of soil K level (physical constant, not policy)', () => {
        var high = NutritionCalendar.computeProgram(baseInputs({ soilPpm: { P: 40, K: 199, Ca: 803, Mg: 129, S: 75 } }));
        var low = NutritionCalendar.computeProgram(baseInputs({ soilPpm: { P: 40, K: 20, Ca: 803, Mg: 129, S: 75 } }));
        expect(high.annual_removal.K).toBe(low.annual_removal.K);
    });
});

describe('GH-319 — SLAN ceiling (Carrow et al. 2004)', () => {
    test('K far above ceiling (199ppm vs 176ppm) -> annualK 0', () => {
        var program = NutritionCalendar.computeProgram(baseInputs({ methodology: 'slan' }));
        expect(program.annual_totals.K).toBe(0);
        expect(program.annual_totals_range.K).toEqual({ min: 75, max: 176 });
    });

    test('K within floor..ceiling (100ppm, between 75 and 176) -> removal only', () => {
        var program = NutritionCalendar.computeProgram(baseInputs({ methodology: 'slan', soilPpm: { P: 40, K: 100, Ca: 803, Mg: 129, S: 75 } }));
        expect(program.annual_totals.K).toBeGreaterThan(0);
        expect(program.annual_lift.K).toBe(0);
    });

    test('K below floor (50ppm, below 75) -> lift correction added', () => {
        var program = NutritionCalendar.computeProgram(baseInputs({ methodology: 'slan', soilPpm: { P: 40, K: 50, Ca: 803, Mg: 129, S: 75 } }));
        expect(program.annual_lift.K).toBeGreaterThan(0);
    });

    test('Ca range matches Carrow 2004 (500-750), not the old single-value SLAN_THRESHOLDS.Ca (750)', () => {
        var program = NutritionCalendar.computeProgram(baseInputs({ methodology: 'slan' }));
        expect(program.annual_totals_range.Ca).toEqual({ min: 500, max: 750 });
    });
});

describe('GH-319 — AA methodology completely unchanged (regression pin)', () => {
    function fakeHillLabsSampleTypes() {
        return {
            deriveCode: function (species, texture) {
                var isSandy = String(texture || '').toLowerCase().indexOf('sand') !== -1;
                if (species === 'Perennial Ryegrass' && isSandy) return 'S277';
                return null;
            },
            getRangesPpm: function (code, nutrient) {
                if (code !== 'S277') return null;
                var ranges = { K: { min: 78.2, max: 195.5 } };
                return ranges[nutrient] || null;
            },
        };
    }

    test('AA still resolves via deriveCode()/getRangesPpm(), not the new MLSN/SLAN branches', () => {
        global.window.HillLabsSampleTypes = fakeHillLabsSampleTypes();
        var program = NutritionCalendar.computeProgram(baseInputs({ methodology: 'ammonium_acetate', soilTexture: 'sand' }));
        expect(program.annual_totals_range.K).toEqual({ min: 78.2, max: 195.5 });
        expect(program.annual_totals.K).toBe(0); // 199 >= 195.5
    });
});

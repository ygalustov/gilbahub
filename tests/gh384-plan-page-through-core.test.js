/**
 * GH-384 — D31 stage 2: the Plan page's computeProgram() delegates its
 * per-nutrient arithmetic to the shared core, so there is ONE requirement
 * engine in the product.
 *
 * GH-383 put the Word export on assets/nutrition-requirement-core.js and gave
 * both surfaces one input adapter. This ticket does the other half: STEPS 2-5
 * of nutrition-calendar.js's computeProgram() — base removal, the clipping
 * factor, the deficit/lift correction and the ceiling — no longer exist as an
 * independent implementation.
 *
 * The four settled decisions that move Plan-page numbers, each asserted here
 * against a figure derived by hand rather than read off the new code:
 *
 *   D-5  generic removal ratio: the per-species REMOVAL_RATES table, not one
 *        flat set for every species;
 *   D-6  below the floor, lift to the floor itself (already this page's rule —
 *        asserted so the cutover cannot silently adopt the engine's 1.5x);
 *   D-7  the MLSN P threshold gains the pH ladder it never had here;
 *   D-8  a reading exactly at the ceiling applies zero.
 *
 * See tests/gh376-three-way-nutrition-parity.test.js for the surface-to-surface
 * comparison and tests/e2e/ui-vs-export-parity.test.js for the live gate.
 */

'use strict';

const fs = require('fs');
const path = require('path');

global.window = global.window || {};
global.document = global.document || {
    readyState: 'complete',
    addEventListener: function () {},
    getElementById: function () { return null; },
    querySelector: function () { return null; },
    querySelectorAll: function () { return []; }
};
global.console = { log: function () {}, warn: function () {}, error: function () {}, info: function () {} };
global.localStorage = { getItem: function () { return null; }, setItem: function () {} };

const Core = require('../assets/nutrition-requirement-core.js');
global.window.NutritionRequirementCore = Core;
global.window.GAIP_NutritionProgramInputs = require('../assets/nutrition-program-inputs.js');
global.window.GilbaGrowthPotentialEngine = require('../assets/growth-potential-engine.js');
require('../assets/nutrition-calendar.js');
const Calendar = global.window.GilbaNutritionCalendar;

const MONTHLY_TEMPS_0_11 = [20, 20, 18, 15, 12, 9, 8, 9, 11, 14, 17, 19];

function inputs(overrides) {
    return Object.assign({
        annualNOverride: 200,
        traffic: 'moderate',
        trafficModifier: 1.0,
        clippingManagement: 'collected',
        bulkDensity: 1.4,
        soilDepth: 10,
        methodology: 'mlsn',
        species: 'perennialRyegrass',
        speciesDisplay: 'Perennial Ryegrass',
        soilTexture: 'loam',
        isC4: false,
        distribution: 'gp_weighted',
        monthlyTemps: MONTHLY_TEMPS_0_11,
        soilPpm: { P: 25, K: 45, Ca: 400, Mg: 60, S: 20 },
        tissuePercent: null
    }, overrides);
}

describe('GH-384 — the Plan page computes through the shared core, not its own arithmetic', () => {
    const src = fs.readFileSync(path.join(__dirname, '../assets/nutrition-calendar.js'), 'utf8');

    test('computeProgram() calls the core and no longer contains a second implementation', () => {
        expect(src).toMatch(/const _coreResult = _core\.compute\(\{/);
        // The four things the core now owns must not be recomputed here.
        expect(src).not.toMatch(/const baseRemoval = \{/);
        expect(src).not.toMatch(/const adjustedRemoval = \{\s*\n\s*N: Math\.round\(baseRemoval/);
        expect(src).not.toMatch(/annualCorrection\[nutrient\] = deficit \//);
        expect(src).not.toMatch(/annualRequirements\[nutrient\] = 0;/);
    });

    test('the flat per-nutrient ratio table is retired and unreferenced (decision D-5)', () => {
        // Not referenced anywhere in the file any more — including the two
        // comments that described it as the thing this page computes from.
        expect(src).not.toMatch(/CONFIG\.nutrientRatiosToN/);
        expect(src).not.toMatch(/nutrientRatiosToN:/);
        expect(src).toMatch(/_retiredNutrientRatiosToN_gh384/);
        // Retired, not deleted: the numbers stay as the record of what this
        // page printed before the cutover.
        expect(Calendar.config._retiredNutrientRatiosToN_gh384)
            .toEqual({ P: 0.10, K: 0.55, Ca: 0.17, Mg: 0.08, S: 0.05 });
    });

    test('the programme is refused, not silently computed, when the core is unavailable', () => {
        const saved = global.window.NutritionRequirementCore;
        try {
            global.window.NutritionRequirementCore = undefined;
            // The module caches its resolution, so this asserts the guard's
            // shape rather than re-resolving; the guard itself is the source
            // pin below.
            expect(src).toMatch(/return \{ error: 'nutrition-requirement-core\.js is not loaded/);
            expect(src).toMatch(/return \{ error: 'nutrition-program-inputs\.js is not loaded/);
        } finally {
            global.window.NutritionRequirementCore = saved;
        }
    });
});

describe('GH-384 — decision D-5: the Plan page\'s generic ratio is now the species table', () => {
    test('perennial ryegrass K removal is 200 x (100/180) = 111.1 -> 111, not 200 x 0.55 = 110', () => {
        const p = Calendar.computeProgram(inputs());
        expect(p.annual_removal.K).toBe(111);
        expect(p.annual_removal.P).toBe(20);   // 200 x (18/180) = 20.0, unchanged
    });

    test('a different species now gets a different figure on the Plan page', () => {
        const prg = Calendar.computeProgram(inputs());
        const fescue = Calendar.computeProgram(inputs({ species: 'fineFescue', speciesDisplay: 'Fine Fescue' }));
        // fine fescue K/N = 60/100 = 0.60 -> 200 x 0.60 = 120
        expect(fescue.annual_removal.K).toBe(120);
        expect(prg.annual_removal.K).toBe(111);
    });

    test('Ca/Mg/S move on every site, because tissue never governs them', () => {
        const p = Calendar.computeProgram(inputs());
        // Ca 200 x (30/180) = 33.3 -> 33  (was 200 x 0.17 = 34)
        // Mg 200 x (15/180) = 16.7 -> 17  (was 200 x 0.08 = 16)
        // S  200 x (10/180) = 11.1 -> 11  (was 200 x 0.05 = 10)
        expect(p.annual_removal.Ca).toBe(33);
        expect(p.annual_removal.Mg).toBe(17);
        expect(p.annual_removal.S).toBe(11);
    });
});

describe('GH-384 — decision D-6: below the floor, the Plan page still lifts to the floor itself', () => {
    test('MLSN K at 30 ppm against the 37 ppm minimum: lift 4.9, not the engine\'s old 17.85', () => {
        const p = Calendar.computeProgram(inputs({ soilPpm: { P: 25, K: 30, Ca: 400, Mg: 60, S: 20 } }));
        // (37 - 30) ppm x 1.4 g/cm3 x 10 cm x 0.1 = 9.8 kg/ha, over 2 years.
        expect(p.soil.deficits.K).toBeCloseTo(9.8, 6);
        expect(p.annual_lift.K).toBeCloseTo(4.9, 6);
        expect(p.annual_totals.K).toBe(Math.round(111.1 + 4.9));
    });

    test('MLSN calcium: the figure the export used to print (lift to 1.5x) is not what either surface produces now', () => {
        const p = Calendar.computeProgram(inputs({ soilPpm: { P: 25, K: 45, Ca: 300, Mg: 60, S: 20 } }));
        // (331 - 300) x 1.4 x 10 x 0.1 / 3 = 14.4667, removal 200 x (30/180) = 33.3
        expect(p.annual_lift.Ca).toBeCloseTo(14.4667, 3);
        // GH-403: annual_totals is the core's canonical 0.1 kg/ha figure now,
        // not a whole kilogram — 33.3 + 14.4667 = 47.8, which used to print 48.
        expect(p.annual_totals.Ca).toBeCloseTo(47.8, 1);
        // 1.5 x 331 would have given (496.5 - 300) x 1.4 / 3 = 91.7 -> 125.
        expect(Math.round(p.annual_totals.Ca)).not.toBe(125);
    });
});

describe('GH-384 — decision D-7: the MLSN P threshold now follows the pH ladder here too', () => {
    test('the floor moves with pH (35 / 28 / 21 / 32 / 40), where this page used a flat 21 at any pH', () => {
        expect(Calendar.computeProgram(inputs({ pH: 5.2 })).annual_totals_range.P.min).toBe(35);
        expect(Calendar.computeProgram(inputs({ pH: 5.8 })).annual_totals_range.P.min).toBe(28);
        expect(Calendar.computeProgram(inputs({ pH: 6.7 })).annual_totals_range.P.min).toBe(21);
        expect(Calendar.computeProgram(inputs({ pH: 7.8 })).annual_totals_range.P.min).toBe(32);
        expect(Calendar.computeProgram(inputs({ pH: 8.5 })).annual_totals_range.P.min).toBe(40);
    });

    test('no pH reading is never "assume a pH" — the unadjusted minimum is used', () => {
        expect(Calendar.computeProgram(inputs({ pH: null })).annual_totals_range.P.min).toBe(21);
    });

    test('the ladder is the core\'s, not a fourth copy', () => {
        [[5.2, 35], [5.8, 28], [6.7, 21], [7.8, 32], [8.5, 40]].forEach(([ph, floor]) => {
            expect(Core._getMLSNThreshold('P', ph)).toBe(floor);
        });
    });
});

describe('GH-384 — decision D-8: a reading exactly at the ceiling applies zero', () => {
    test('MLSN K exactly at 55.5 (37 x 1.5)', () => {
        const p = Calendar.computeProgram(inputs({ soilPpm: { P: 25, K: 55.5, Ca: 400, Mg: 60, S: 20 } }));
        expect(p.annual_totals.K).toBe(0);
    });

    test('SLAN K exactly at the Carrow 2004 ceiling of 176', () => {
        const p = Calendar.computeProgram(inputs({
            methodology: 'slan', soilPpm: { P: 25, K: 176, Ca: 400, Mg: 60, S: 20 }
        }));
        expect(p.annual_totals_range.K).toEqual({ min: 75, max: 176 });
        expect(p.annual_totals.K).toBe(0);
    });
});

describe('GH-384 — the published output shape is unchanged', () => {
    test('every field the downstream consumers read is still present, with the same meaning', () => {
        const p = Calendar.computeProgram(inputs());
        expect(Object.keys(p).sort()).toEqual([
            'adjustments', 'annual_lift', 'annual_removal', 'annual_totals',
            'annual_totals_range', 'annual_totals_range_source', 'meta',
            'missing_soil_data', 'program', 'soil', 'tissue_gate_applied'
        ].sort());
        expect(Object.keys(p.annual_totals).sort()).toEqual(['Ca', 'K', 'Mg', 'N', 'P', 'S']);
        // annual_totals_range keeps its {min,max} shape — the core's ranges also
        // carry a label and a citation, which are not part of this contract.
        expect(Object.keys(p.annual_totals_range.K).sort()).toEqual(['max', 'min']);
        expect(p.annual_totals_range_source.K).toBe('certificate');
        expect(p.adjustments.clipping_factors).toEqual({ nFactor: 1.0, pFactor: 1.0, kFactor: 1.0 });
        expect(p.adjustments.target_n).toBe(200);
        expect(p.meta.annualNBase).toBe(200);
        expect(p.program.monthly.length).toBe(12);
    });

    test('clipping still reduces P and K on this page, by the same factors as the export', () => {
        const collected = Calendar.computeProgram(inputs());
        const returned = Calendar.computeProgram(inputs({ clippingManagement: 'returned' }));
        expect(returned.annual_removal.K).toBe(Math.round(111.1 * 0.5));
        expect(returned.annual_removal.P).toBe(Math.round(20 * 0.4));
        expect(returned.annual_removal.Ca).toBe(Math.round(33.3 * 0.5));
        expect(collected.adjustments.clipping_management).toBe('collected');
        expect(returned.adjustments.clipping_management).toBe('returned');
    });

    test('a nutrient with no soil reading is removal-only and flagged, on this page as in the export (D-9)', () => {
        const p = Calendar.computeProgram(inputs({ soilPpm: { P: 25, K: null, Ca: 400, Mg: 60, S: 20 } }));
        expect(p.missing_soil_data.K).toBe(true);
        expect(p.annual_lift.K).toBe(0);
        // GH-403: annual_totals keeps the core's decimal, annual_removal is
        // still reported at whole kg — same quantity with no lift on top of it.
        expect(Math.round(p.annual_totals.K)).toBe(p.annual_removal.K);
    });
});

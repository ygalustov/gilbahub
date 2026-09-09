/**
 * D31 engine parity — GH-376 (extraction) → GH-383 (the export routed through
 * the shared core) → GH-384 (the Plan page routed through it too).
 *
 * This file used to be a THREE-way comparison, because there were three
 * implementations of the per-nutrient requirement: nutrition-calendar.js's
 * computeProgram(), nutrition-requirement-engine.js's own branches, and the
 * extracted-but-unused core. It is now a TWO-way comparison of the two
 * SURFACES — the Plan page's calendar and the Word export's engine — both of
 * which delegate the arithmetic to assets/nutrition-requirement-core.js.
 *
 * ===========================================================================
 * WHAT EACH OF THE ORIGINAL FIVE DIVERGENCES BECAME
 * ===========================================================================
 *
 * | # | Cause                                    | Closed by | How |
 * |---|------------------------------------------|-----------|-----|
 * | 1 | N basis (real annualN vs the species table's own N) | GH-381 + GH-383 | one `annualN`, resolved by nutrition-program-inputs.js, scales every ratio on both surfaces |
 * | 2 | Generic ratio: the calendar's flat P 0.10 / K 0.55 for every species vs the per-species REMOVAL_RATES table | GH-384 (decision D-5) | the core's species table governs both surfaces |
 * | 3 | pH-adjusted P floor: engine had the Spencer ladder, the calendar had none | GH-382 (SLAN) + GH-384 (MLSN, decision D-7) | one ladder, in the core, applied by the shared range resolver |
 * | 4 | Clipping model: calendar's cited table vs the engine's uncited, MLSN-only, opposite-polarity 2.5x amplifier | GH-383 (decision D-1) | the calendar's table, in the core, on all three methodologies |
 * | 5 | Traffic modifier: two different tables applied at two different points | GH-383 (decisions D-2/D-3) | removed from the per-nutrient path entirely; it scales annualN once, upstream |
 * | 6 | MLSN below-threshold lift target: 1.5x the minimum vs the minimum itself | GH-383 (decision D-6) | the minimum itself, on both surfaces — the export's numbers drop, deliberately |
 * | 7 | Ceiling at exact equality: `>` vs `>=` | GH-383 (decision D-8) | `>=` everywhere |
 * | 8 | A nutrient with no soil reading: omitted vs removal-only | GH-383 (decision D-9) | returned as removal-only, flagged, on both |
 *
 * The remaining, documented, unavoidable difference is ROUNDING: the calendar
 * rounds removal to whole kg at STEP 2 and again at STEP 3 and totals to whole
 * kg, while the core is canonical at 0.1 kg/ha. That is ±1 kg/ha and is
 * asserted as such below — never widened.
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
const Inputs = require('../assets/nutrition-program-inputs.js');
global.window.GAIP_NutritionProgramInputs = Inputs;

global.window.GilbaGrowthPotentialEngine = require('../assets/growth-potential-engine.js');
require('../assets/nutrition-calendar.js');
const NutritionCalendar = global.window.GilbaNutritionCalendar;

const Engine = require('../assets/nutrition-requirement-engine.js');

const MONTHLY_TEMPS_0_11 = [20, 20, 18, 15, 12, 9, 8, 9, 11, 14, 17, 19];

function calendarInputs(overrides) {
    return Object.assign({
        annualNOverride: 200,
        traffic: 'moderate',
        trafficModifier: 1.0,
        clippingManagement: 'collected',
        bulkDensity: 1.4,
        soilDepth: 10,
        methodology: 'ammonium_acetate',
        species: 'perennialRyegrass',
        speciesDisplay: 'Perennial Ryegrass',
        soilTexture: 'sand',
        isC4: false,
        distribution: 'gp_weighted',
        monthlyTemps: MONTHLY_TEMPS_0_11,
        soilPpm: { P: 25, K: 150, Ca: 600, Mg: 60, S: 40 },
        tissuePercent: null,
    }, overrides);
}

function fakeHillLabsSampleTypes(rangesByNutrient) {
    return {
        deriveCode: function () { return 'S277'; },
        getRangesPpm: function (code, nutrient) {
            return rangesByNutrient[nutrient] || null;
        },
    };
}

/** The export path: engine.compute() with the adapter-shaped inputs. */
function exportPath(overrides) {
    const o = Object.assign({
        annualN: 200,
        species: 'perennialRyegrass',
        methodology: 'AMMONIUM_ACETATE',
        ph: 6,
        soilPpm: { P: 25, K: 150, Ca: 600, Mg: 60, S: 40 },
        bulkDensity: 1.4,
        soilDepth: 10,
        clippingManagement: 'collected',
        aaRanges: { P: { min: 20, max: 30 }, K: { min: 78.2, max: 195.5 } },
        tissuePercent: null,
    }, overrides);
    return Engine.compute({
        soil: Object.assign({ methodology: o.methodology, pH: o.ph, bulkDensity: o.bulkDensity, depth: o.soilDepth }, o.soilPpm),
        turf: { species: o.species, clippingManagement: o.clippingManagement, nProgramKgHaYr: o.annualN },
        climate: { monthlyTemps: null },
        aaRanges: o.aaRanges,
        tissuePercent: o.tissuePercent,
    });
}

describe('D31 Fixture A — real fixture (test5-soccer-sample141), every nutrient above ceiling', () => {
    const fixture = JSON.parse(fs.readFileSync(path.join(__dirname, 'fixtures/test5-soccer-sample141.json'), 'utf8'));
    const aaRanges = {};
    Object.keys(fixture.expected.ranges).forEach((n) => {
        aaRanges[n] = { min: fixture.expected.ranges[n].min, max: fixture.expected.ranges[n].max };
    });

    test.each(['P', 'K', 'Ca', 'Mg', 'S'])('%s: both surfaces suppress to 0', (nutrient) => {
        const eng = exportPath({
            annualN: fixture.inputs.annualNOverride, soilPpm: fixture.inputs.soilPpm,
            ph: fixture.inputs.pH, aaRanges: aaRanges
        });
        global.window.HillLabsSampleTypes = fakeHillLabsSampleTypes(aaRanges);
        const cal = NutritionCalendar.computeProgram(calendarInputs({
            annualNOverride: fixture.inputs.annualNOverride,
            soilPpm: fixture.inputs.soilPpm,
        }));
        expect(eng.perSample[nutrient].annualRequirement).toBe(0);
        expect(cal.annual_totals[nutrient]).toBe(0);
    });
});

describe('D31 Fixture B — AA, within range (removal-only), no tissue', () => {
    test('the export path scales every ratio against the site\'s REAL annual N (divergence 1, closed)', () => {
        const eng = exportPath({});
        // perennialRyegrass P/N = 18/180 = 0.10 -> 20.0 at N=200. The
        // pre-GH-381 engine printed the table's flat 18.0 here, which is the
        // exact figure the D31 audit quotes against the UI's 20.0.
        expect(eng.perSample.P.removal).toBe(20.0);
        expect(eng.perSample.K.removal).toBeCloseTo(200 * (100 / 180), 1);
    });

        // GH-384 (stage 2): computeProgram() now delegates to the shared core, so
    // this — the stage-2 gate, held as a `test.failing` through GH-383 — is a
    // plain assertion.
test('both surfaces agree on P and K removal and requirement, within the documented rounding', () => {
        const eng = exportPath({});
        global.window.HillLabsSampleTypes = fakeHillLabsSampleTypes({ P: { min: 20, max: 30 }, K: { min: 78.2, max: 195.5 } });
        const cal = NutritionCalendar.computeProgram(calendarInputs({}));
        ['P', 'K'].forEach((n) => {
            expect(Math.abs(eng.perSample[n].removal - cal.annual_removal[n])).toBeLessThanOrEqual(1);
            expect(Math.abs(eng.perSample[n].annualRequirement - cal.annual_totals[n])).toBeLessThanOrEqual(1);
        });
    });

        // GH-384 (stage 2): computeProgram() now delegates to the shared core, so
    // this — the stage-2 gate, held as a `test.failing` through GH-383 — is a
    // plain assertion.
test('decision D-5: the generic ratio is the species table on BOTH surfaces — fine fescue and PRG differ', () => {
        const prg = exportPath({ soilPpm: { K: 150 }, aaRanges: { K: { min: 78.2, max: 195.5 } } });
        const fescue = exportPath({ species: 'fineFescue', soilPpm: { K: 150 }, aaRanges: { K: { min: 78.2, max: 195.5 } } });
        expect(prg.perSample.K.removal).toBeCloseTo(200 * (100 / 180), 1);   // 111.1
        expect(fescue.perSample.K.removal).toBeCloseTo(200 * (60 / 100), 1); // 120.0

        global.window.HillLabsSampleTypes = fakeHillLabsSampleTypes({ K: { min: 78.2, max: 195.5 } });
        const calPrg = NutritionCalendar.computeProgram(calendarInputs({}));
        const calFescue = NutritionCalendar.computeProgram(calendarInputs({ species: 'fineFescue', speciesDisplay: 'Fine Fescue' }));
        expect(Math.abs(calPrg.annual_removal.K - prg.perSample.K.removal)).toBeLessThanOrEqual(1);
        expect(Math.abs(calFescue.annual_removal.K - fescue.perSample.K.removal)).toBeLessThanOrEqual(1);
        // The Plan page no longer prints one flat 0.55 for every species.
        expect(calPrg.annual_removal.K).not.toBe(calFescue.annual_removal.K);
    });
});

describe('D31 Fixture C — AA with a real tissue sample: the measured ratio governs both surfaces', () => {
    const TISSUE = { N: 4.57, P: 0.62, K: 1.05 };

    test('same ratio, same annual N basis, same figures on both surfaces', () => {
        const eng = exportPath({ tissuePercent: TISSUE });
        global.window.HillLabsSampleTypes = fakeHillLabsSampleTypes({ P: { min: 20, max: 30 }, K: { min: 78.2, max: 195.5 } });
        const cal = NutritionCalendar.computeProgram(calendarInputs({ tissuePercent: TISSUE }));
        expect(cal.tissue_gate_applied).toBe(true);
        // GH-368's own changelog quotes 46 kg K/ha for this tissue reading.
        expect(Math.round(eng.perSample.K.removal)).toBe(46);
        expect(Math.round(cal.annual_removal.K)).toBe(46);
        ['P', 'K'].forEach((n) => {
            expect(Math.abs(eng.perSample[n].removal - cal.annual_removal[n])).toBeLessThanOrEqual(1);
        });
    });
});

describe('D31 Fixture D — SLAN below floor: one pH ladder, both surfaces', () => {
    test('at pH 5.0 both resolve the Spencer scaled-ladder floor of 45 ppm and agree on the requirement', () => {
        const eng = exportPath({
            methodology: 'SLAN', ph: 5.0, soilPpm: { P: 20, K: 150, Ca: 600, Mg: 60, S: 40 }, aaRanges: null,
        });
        expect(eng.perSample.P.floor).toBe(45);
        expect(eng.perSample.P.intent).toBe('lift-to-floor');

        const cal = NutritionCalendar.computeProgram(calendarInputs({
            methodology: 'slan', pH: 5.0, soilPpm: { P: 20, K: 150, Ca: 600, Mg: 60, S: 40 },
        }));
        expect(cal.annual_totals_range.P.min).toBe(45);
        expect(Math.abs(eng.perSample.P.annualRequirement - cal.annual_totals.P)).toBeLessThanOrEqual(1);
    });

    test('at pH 6.8 the ladder returns the pH-independent baseline (27) — the adjustment is a pH-extremes effect only', () => {
        expect(Core._getSlanTargetP(6.8)).toBe(27);
        expect(Engine._getSlanTargetP(6.8)).toBe(27);
    });
});

describe('D31 Fixture E — MLSN below threshold (decision D-6): both surfaces lift to the minimum itself', () => {
    test('K at 30 ppm against the MLSN minimum of 37: correction 4.9, not 17.85', () => {
        const eng = exportPath({
            methodology: 'MLSN', ph: 6.8, soilPpm: { P: 25, K: 30, Ca: 600, Mg: 60, S: 40 }, aaRanges: null,
        });
        expect(eng.perSample.K.floor).toBe(37);
        expect(eng.perSample.K.correctionRequired).toBeCloseTo(4.9, 6);

        const cal = NutritionCalendar.computeProgram(calendarInputs({
            methodology: 'mlsn', pH: 6.8, soilPpm: { P: 25, K: 30, Ca: 600, Mg: 60, S: 40 },
        }));
        expect(cal.annual_lift.K).toBeCloseTo(4.9, 6);
        expect(Math.abs(eng.perSample.K.annualRequirement - cal.annual_totals.K)).toBeLessThanOrEqual(1);
    });

        // GH-384 (stage 2): computeProgram() now delegates to the shared core, so
    // this — the stage-2 gate, held as a `test.failing` through GH-383 — is a
    // plain assertion.
test('decision D-7: the MLSN P pH ladder now applies on both surfaces', () => {
        const eng = exportPath({
            methodology: 'MLSN', ph: 5.2, soilPpm: { P: 25 }, aaRanges: null,
        });
        expect(eng.perSample.P.floor).toBe(35);
        const cal = NutritionCalendar.computeProgram(calendarInputs({
            methodology: 'mlsn', pH: 5.2, soilPpm: { P: 25, K: 150, Ca: 600, Mg: 60, S: 40 },
        }));
        expect(cal.annual_totals_range.P.min).toBe(35);
    });
});

describe('D31 Fixture F — clipping and traffic: one model, applied once', () => {
        // GH-384 (stage 2): computeProgram() now delegates to the shared core, so
    // this — the stage-2 gate, held as a `test.failing` through GH-383 — is a
    // plain assertion.
test('decision D-1: "returned" reduces P and K on both surfaces, by the same factors', () => {
        const collected = exportPath({ clippingManagement: 'collected' });
        const returned = exportPath({ clippingManagement: 'returned' });
        expect(returned.perSample.K.removal).toBeCloseTo(collected.perSample.K.removal * 0.5, 0);
        expect(returned.perSample.P.removal).toBeCloseTo(collected.perSample.P.removal * 0.4, 0);

        global.window.HillLabsSampleTypes = fakeHillLabsSampleTypes({ P: { min: 20, max: 30 }, K: { min: 78.2, max: 195.5 } });
        const calCollected = NutritionCalendar.computeProgram(calendarInputs({ clippingManagement: 'collected' }));
        const calReturned = NutritionCalendar.computeProgram(calendarInputs({ clippingManagement: 'returned' }));
        expect(Math.abs(calReturned.annual_removal.K - returned.perSample.K.removal)).toBeLessThanOrEqual(1);
        expect(Math.abs(calCollected.annual_removal.K - collected.perSample.K.removal)).toBeLessThanOrEqual(1);
    });

    test('the old 2.5x amplifier is gone, and the retired boolean is ignored (factor 1.0, exactly today\'s number)', () => {
        expect(Engine.CLIPPING_COLLECTION_FACTOR).toBeUndefined();
        expect(Engine.CLIPPING_FACTORS).toEqual({
            collected: { N: 1.0, P: 1.0, K: 1.0 },
            returned: { N: 1.0, P: 0.4, K: 0.5 }
        });
        const withBoolean = Engine.compute({
            soil: { methodology: 'MLSN', K: 150, pH: 6.8 },
            turf: { species: 'perennialRyegrass', clippingsCollected: false, nProgramKgHaYr: 200 },
            climate: { monthlyTemps: null }
        });
        expect(withBoolean.perSample.K.clippingManagement).toBe('collected');
        expect(withBoolean.perSample.K.clippingFactor).toBe(1.0);
    });

    test('decision D-3: traffic is applied exactly once, on the annual N, and never inside the core', () => {
        // The core has no traffic term at all, so a second application is not
        // expressible: the same annualN gives the same removal whatever the
        // caller claims about traffic.
        const a = Core.compute({
            soilValues: { K: 150 }, species: 'perennialRyegrass', annualN: 200, methodology: 'MLSN',
            ranges: { K: { min: 37, max: 55.5 } }, clippingManagement: 'collected', nutrients: ['K']
        });
        expect(a.perSample.K.annualRequirement).toBe(0); // above the MLSN ceiling

        // The calendar applies it, once, to the annual N — and takes the
        // adapter's already-resolved modifier when one is supplied, so the
        // table cannot be applied twice.
        global.window.HillLabsSampleTypes = fakeHillLabsSampleTypes({});
        const moderate = NutritionCalendar.computeProgram(calendarInputs({ methodology: 'slan', traffic: 'moderate', trafficModifier: 1.0 }));
        const extreme = NutritionCalendar.computeProgram(calendarInputs({ methodology: 'slan', traffic: 'extreme', trafficModifier: 1.3 }));
        expect(moderate.adjustments.target_n).toBe(200);
        expect(extreme.adjustments.target_n).toBe(260);
        expect(extreme.annual_removal.K / moderate.annual_removal.K).toBeCloseTo(1.3, 1);
    });
});

describe('D31 — the rounding residual is bounded and documented', () => {
        // GH-384 (stage 2): computeProgram() now delegates to the shared core, so
    // this — the stage-2 gate, held as a `test.failing` through GH-383 — is a
    // plain assertion.
test('the calendar rounds to whole kg, the core to 0.1 — the gap is at most 1 kg/ha per nutrient', () => {
        global.window.HillLabsSampleTypes = fakeHillLabsSampleTypes({ P: { min: 20, max: 30 }, K: { min: 78.2, max: 195.5 } });
        const cal = NutritionCalendar.computeProgram(calendarInputs({}));
        const eng = exportPath({});
        ['P', 'K', 'Ca', 'Mg', 'S'].forEach((n) => {
            expect(Math.abs(eng.perSample[n].annualRequirement - cal.annual_totals[n])).toBeLessThanOrEqual(1);
        });
    });
});

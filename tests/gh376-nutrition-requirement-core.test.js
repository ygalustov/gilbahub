/**
 * GH-376 — unit tests for assets/nutrition-requirement-core.js, the new
 * shared removal/correction/ceiling core extracted from
 * nutrition-calendar.js + nutrition-requirement-engine.js as Stage 1 of the
 * D31 unification (see PLAN-remaining-defects.md's D31 section and Decision
 * 11). This file tests the core IN ISOLATION — see
 * tests/gh376-three-way-nutrition-parity.test.js for the cross-engine
 * parity/divergence proof against the two existing engines.
 *
 * Stage 1 note: this core is not wired into the app. Nothing here asserts
 * against any existing engine's call sites or output.
 */

'use strict';

const Core = require('../assets/nutrition-requirement-core.js');

describe('GH-376 — compute() input contract', () => {
    test('throws on missing inputs entirely', () => {
        expect(() => Core.compute()).toThrow();
    });

    test('fails loud (error object, not a fabricated fallback) when annualN is missing', () => {
        const r = Core.compute({ soilValues: { P: 40 }, species: 'perennialRyegrass', methodology: 'MLSN' });
        expect(r.error).toBeDefined();
        expect(r.perSample).toBeUndefined();
    });

    test('fails loud when annualN is zero or negative', () => {
        expect(Core.compute({ soilValues: {}, annualN: 0 }).error).toBeDefined();
        expect(Core.compute({ soilValues: {}, annualN: -10 }).error).toBeDefined();
    });

    test('a nutrient with no soil reading is reported as missing, not computed as zero/max deficit', () => {
        const r = Core.compute({
            soilValues: { P: 40 }, // K/Ca/Mg/S absent
            species: 'perennialRyegrass', annualN: 200, methodology: 'MLSN'
        });
        expect(r.perSample.P).toBeDefined();
        expect(r.perSample.K).toBeUndefined();
        expect(r.missingSoilData.K).toBe(true);
        expect(r.missingSoilData.P).toBeUndefined();
    });
});

describe('GH-376 — DISPUTED CONSTANT 1 (N basis): resolved against the real annualN', () => {
    test('generic (no tissue) P ratio scales against the real annualN, matching the audit\'s own quoted UI figure', () => {
        // perennialRyegrass table: P=18, N=180 -> ratio 0.10. At Hoxton's real
        // annualN=200: 18 * 200/180 = 20.0 -- the exact "P 20.0" the D31 audit
        // quotes from the UI (nutrition-calendar.js's own real-N-basis path),
        // not the export's flat table figure of 18.0.
        const r = Core.compute({
            soilValues: { P: 15 }, // below any ceiling so removal-only fires cleanly
            species: 'perennialRyegrass', annualN: 200, methodology: 'SLAN', ph: 6.5,
            clippingsCollected: true, // isolate the N-basis effect from clipping factor 3
            nutrients: ['P']
        });
        expect(r.perSample.P.removal).toBe(20.0);
    });

    test('at annualN === the species table N (180), the core reproduces the table\'s own flat figure exactly', () => {
        const r = Core.compute({
            soilValues: { P: 30, K: 90 }, species: 'perennialRyegrass', annualN: 180,
            methodology: 'SLAN', ph: 6.5, clippingsCollected: true, nutrients: ['P', 'K']
        });
        expect(r.perSample.P.removal).toBe(18.0);
        expect(r.perSample.K.removal).toBeCloseTo(100.0, 1);
    });

    test('removal scales linearly with annualN for a fixed species/nutrient (within the core\'s own per-call 1dp rounding)', () => {
        const at100 = Core.compute({ soilValues: { K: 90 }, species: 'perennialRyegrass', annualN: 100, methodology: 'SLAN', clippingsCollected: true, nutrients: ['K'] });
        const at400 = Core.compute({ soilValues: { K: 90 }, species: 'perennialRyegrass', annualN: 400, methodology: 'SLAN', clippingsCollected: true, nutrients: ['K'] });
        // Each call rounds to 1dp independently, so 4x the at100 figure and the
        // at400 figure can differ by up to ~0.2kg of double-rounding noise --
        // compare against the true unrounded ratio (100/180), not at100's
        // already-rounded output.
        expect(at400.perSample.K.removal).toBeCloseTo(400 * (100 / 180), 1);
        expect(at100.perSample.K.removal).toBeCloseTo(100 * (100 / 180), 1);
    });
});

describe('GH-376 — DISPUTED CONSTANT 2 (generic ratio table): species-specific, not one flat pair', () => {
    test('fine fescue and perennial ryegrass get different generic K ratios at the same annualN', () => {
        const prg = Core.compute({ soilValues: { K: 90 }, species: 'perennialRyegrass', annualN: 200, methodology: 'SLAN', clippingsCollected: true, nutrients: ['K'] });
        const fescue = Core.compute({ soilValues: { K: 90 }, species: 'fineFescue', annualN: 200, methodology: 'SLAN', clippingsCollected: true, nutrients: ['K'] });
        // PRG K/N = 100/180 = 0.5556; fine fescue K/N = 60/100 = 0.60.
        expect(prg.perSample.K.removal).not.toBeCloseTo(fescue.perSample.K.removal, 1);
        expect(fescue.perSample.K.removal).toBeCloseTo(200 * 0.60, 1);
        expect(prg.perSample.K.removal).toBeCloseTo(200 * (100 / 180), 1);
    });
});

describe('GH-376 — tissue gate (already-unified logic, ported verbatim, GH-368/369)', () => {
    const TISSUE = { N: 4.57, P: 0.62, K: 1.05 };

    test('tissue-eligible P/K scale the measured ratio against the real annualN', () => {
        const r = Core.compute({
            soilValues: { P: 15, K: 60 }, species: 'perennialRyegrass', annualN: 200,
            methodology: 'SLAN', ph: 6.5, tissuePercent: TISSUE, clippingsCollected: true,
            nutrients: ['P', 'K']
        });
        expect(r.tissueGateApplied).toBe(true);
        expect(r.perSample.P.removal).toBeCloseTo(200 * (0.62 / 4.57), 1);
        expect(r.perSample.K.removal).toBeCloseTo(200 * (1.05 / 4.57), 1);
        expect(r.perSample.P.tissueInformed).toBe(true);
    });

    test('Ca/Mg/S are never tissue-gated (D07a scope), even with an eligible tissue sample', () => {
        const r = Core.compute({
            soilValues: { Ca: 400, Mg: 60, S: 20 }, species: 'perennialRyegrass', annualN: 200,
            methodology: 'SLAN', ph: 6.5, tissuePercent: TISSUE, nutrients: ['Ca', 'Mg', 'S']
        });
        expect(r.perSample.Ca.tissueInformed).toBe(false);
        expect(r.perSample.Mg.tissueInformed).toBe(false);
        expect(r.perSample.S.tissueInformed).toBe(false);
    });

    test('a mixed-unit (implausible) tissue reading disables the gate, same plausibility band as both existing engines', () => {
        const r = Core.compute({
            soilValues: { P: 15 }, species: 'perennialRyegrass', annualN: 200, methodology: 'SLAN', ph: 6.5,
            tissuePercent: { N: 4.57, P: 6200, K: 1.05 }, nutrients: ['P']
        });
        expect(r.tissueGateApplied).toBe(false);
        expect(r.perSample.P.tissueInformed).toBe(false);
    });
});

describe('GH-376 — ceiling/floor dispatch, all three methodologies (ported, no divergence from either existing engine post-GH-370)', () => {
    test('AMMONIUM_ACETATE: above ceiling suppresses to 0', () => {
        const r = Core.compute({
            soilValues: { K: 250 }, species: 'perennialRyegrass', annualN: 200, methodology: 'AMMONIUM_ACETATE',
            aaRanges: { K: { min: 78.2, max: 195.5 } }, nutrients: ['K']
        });
        expect(r.perSample.K.intent).toBe('suppress-above-ceiling');
        expect(r.perSample.K.annualRequirement).toBe(0);
    });

    test('AMMONIUM_ACETATE: below floor lifts, with the ppm->kg/ha conversion applied (GH-370 parity)', () => {
        const r = Core.compute({
            soilValues: { K: 50 }, species: 'perennialRyegrass', annualN: 200, methodology: 'AMMONIUM_ACETATE',
            aaRanges: { K: { min: 78.2, max: 195.5 } }, bulkDensity: 1.4, soilDepth: 10, nutrients: ['K']
        });
        expect(r.perSample.K.intent).toBe('lift-to-floor');
        const expectedDeficitKgHa = (78.2 - 50) * 1.4 * 10 * 0.1;
        expect(r.perSample.K.correctionRequired).toBeCloseTo(expectedDeficitKgHa / 2, 5);
    });

    test('SLAN: below floor uses the pH-adjusted P ladder', () => {
        const r = Core.compute({
            soilValues: { P: 15 }, species: 'perennialRyegrass', annualN: 200, methodology: 'SLAN',
            ph: 5.0, nutrients: ['P']
        });
        expect(r.perSample.P.floor).toBe(45); // pH<=5.5 -> 45ppm ladder rung
        expect(r.perSample.P.intent).toBe('lift-to-floor');
    });

    test('MLSN: above target suppresses, below threshold lifts', () => {
        const above = Core.compute({ soilValues: { Mg: 200 }, species: 'perennialRyegrass', annualN: 200, methodology: 'MLSN', nutrients: ['Mg'] });
        const below = Core.compute({ soilValues: { Mg: 10 }, species: 'perennialRyegrass', annualN: 200, methodology: 'MLSN', nutrients: ['Mg'] });
        expect(above.perSample.Mg.annualRequirement).toBe(0);
        expect(below.perSample.Mg.status).toBe('Very Low');
        expect(below.perSample.Mg.correctionRequired).toBeGreaterThan(0);
    });
});

describe('GH-376 — DISPUTED CONSTANT 3 (clipping-collection factor): calendar\'s cited model, P/K only, Ca/Mg/S reuse K', () => {
    test('collected is the unmultiplied baseline (factor 1.0) — matches nutrition-calendar.js, opposite of nutrition-requirement-engine.js\'s amplify-on-collect model', () => {
        const notCollected = Core.compute({ soilValues: { K: 90 }, species: 'perennialRyegrass', annualN: 200, methodology: 'SLAN', clippingsCollected: false, nutrients: ['K'] });
        const collected = Core.compute({ soilValues: { K: 90 }, species: 'perennialRyegrass', annualN: 200, methodology: 'SLAN', clippingsCollected: true, nutrients: ['K'] });
        expect(collected.perSample.K.removal).toBeCloseTo(200 * (100 / 180), 1); // unmultiplied
        expect(notCollected.perSample.K.removal).toBeLessThan(collected.perSample.K.removal); // "returned" REDUCES need
    });

    test('returned reduces P by 0.4x and K by 0.5x exactly', () => {
        const r = Core.compute({
            soilValues: { P: 15, K: 90 }, species: 'perennialRyegrass', annualN: 200, methodology: 'SLAN', ph: 6.5,
            clippingsCollected: false, nutrients: ['P', 'K']
        });
        const genericP = 200 * (18 / 180);
        const genericK = 200 * (100 / 180);
        expect(r.perSample.P.removal).toBeCloseTo(genericP * 0.4, 1);
        expect(r.perSample.K.removal).toBeCloseTo(genericK * 0.5, 1);
    });

    test('Ca/Mg/S reuse the K clipping factor (matches nutrition-calendar.js STEP 3\'s own documented behaviour)', () => {
        const r = Core.compute({
            soilValues: { Ca: 400 }, species: 'perennialRyegrass', annualN: 200, methodology: 'SLAN',
            clippingsCollected: false, nutrients: ['Ca']
        });
        const genericCa = 200 * (30 / 180);
        expect(r.perSample.Ca.removal).toBeCloseTo(genericCa * 0.5, 1); // K's returned factor, 0.5
    });

    test('applies uniformly across AA too (not MLSN-only, unlike nutrition-requirement-engine.js pre-core)', () => {
        const r = Core.compute({
            soilValues: { K: 90 }, species: 'perennialRyegrass', annualN: 200, methodology: 'AMMONIUM_ACETATE',
            aaRanges: { K: { min: 30, max: 195.5 } }, clippingsCollected: false, nutrients: ['K']
        });
        const genericK = 200 * (100 / 180);
        expect(r.perSample.K.removal).toBeCloseTo(genericK * 0.5, 1);
    });
});

describe('GH-376 — DISPUTED CONSTANT 4 (traffic modifier): deliberately neutral, not a silent pick', () => {
    test('default TRAFFIC_MODIFIERS is 1.0 at every tier — low/high/extreme change nothing by default', () => {
        const moderate = Core.compute({ soilValues: { K: 90 }, species: 'perennialRyegrass', annualN: 200, methodology: 'SLAN', trafficIntensity: 'moderate', clippingsCollected: true, nutrients: ['K'] });
        const extreme = Core.compute({ soilValues: { K: 90 }, species: 'perennialRyegrass', annualN: 200, methodology: 'SLAN', trafficIntensity: 'extreme', clippingsCollected: true, nutrients: ['K'] });
        expect(extreme.perSample.K.removal).toBe(moderate.perSample.K.removal);
    });

    test('both real candidate tables are exported for comparison, and an override is honoured when a caller opts in', () => {
        expect(Core.TRAFFIC_MODIFIERS_CALENDAR_CANDIDATE.extreme).toBe(1.3);
        expect(Core.TRAFFIC_MODIFIERS_ENGINE_CANDIDATE.extreme).toBe(1.5);
        const withCalendarCandidate = Core.compute({
            soilValues: { K: 90 }, species: 'perennialRyegrass', annualN: 200, methodology: 'SLAN',
            trafficIntensity: 'extreme', trafficModifierOverride: Core.TRAFFIC_MODIFIERS_CALENDAR_CANDIDATE,
            clippingsCollected: true, nutrients: ['K']
        });
        const baseline = 200 * (100 / 180);
        expect(withCalendarCandidate.perSample.K.removal).toBeCloseTo(baseline * 1.3, 1);
    });
});

describe('GH-376 — real Hoxton-equivalent fixture (tests/fixtures/test5-soccer-sample141.json), above-ceiling case', () => {
    const fixture = require('./fixtures/test5-soccer-sample141.json');

    test('all five nutrients suppress to 0, matching the fixture\'s confirmed-live expectation, same as both existing engines', () => {
        const aaRanges = {};
        Object.keys(fixture.expected.ranges).forEach((n) => {
            aaRanges[n] = { min: fixture.expected.ranges[n].min, max: fixture.expected.ranges[n].max };
        });
        const r = Core.compute({
            soilValues: fixture.inputs.soilPpm, species: 'perennialRyegrass',
            annualN: fixture.inputs.annualNOverride, methodology: 'AMMONIUM_ACETATE',
            ph: fixture.inputs.pH, aaRanges: aaRanges, nutrients: ['P', 'K', 'Ca', 'Mg', 'S']
        });
        ['P', 'K', 'Ca', 'Mg', 'S'].forEach((n) => {
            const expected = fixture.expected.nutrientRequirement[n];
            expect(r.perSample[n].status).toBe(expected.status);
            expect(r.perSample[n].intent).toBe(expected.intent);
            expect(r.perSample[n].annualRequirement).toBe(expected.annualRequirement);
        });
    });
});

/**
 * GH-376 — Stage 1 of the D31 unification (PLAN-remaining-defects.md D31 /
 * Decision 11, approved by the client for Option 1). Runs the same inputs
 * through THREE implementations — the new shared, pure
 * `assets/nutrition-requirement-core.js`, and the two existing engines
 * (`nutrition-calendar.js`'s `computeProgram()`, `nutrition-requirement-
 * engine.js`'s `NutritionRequirementEngine_Pure.compute()`) — and pins
 * exactly where they agree and where they don't, per nutrient, per fixture.
 *
 * Stage 1 note: this does NOT change either existing engine. It proves the
 * new core is a faithful, provable extraction and documents precisely which
 * named constant is responsible for each remaining three-way delta, so the
 * later cutover stage knows exactly which numbers will move and why.
 *
 * ===========================================================================
 * DIVERGENCE TABLE — read this before reading the test bodies below.
 * ===========================================================================
 *
 * | # | Cause                          | Core & Calendar | Core & Engine | Calendar & Engine | Fixture |
 * |---|---------------------------------|-----------------|----------------|--------------------|---------|
 * | 1 | N basis (real annualN vs table.N) | AGREE (both real N) | DIVERGE (~annualN/table.N ratio, e.g. 200/180=11.1%) | DIVERGE (same ~11.1%) | B, C, D |
 * | 2 | Generic ratio: species-flat (calendar, P0.10/K0.55 for ALL species) vs species-specific table (core & engine) | DIVERGE (small, e.g. K: 0.5556 vs 0.55 = ~1%) | AGREE (both use REMOVAL_RATES table) | DIVERGE (same ~1%, PRG only — larger for other species, see "species ratio" test) | B |
 * | 2b| Same, but tissue-governed (P/K only) | Tissue ratio itself already unified (GH-368) — #2 does NOT apply when tissue governs | n/a | n/a | C |
 * | 3 | pH-adjusted P floor/threshold (Spencer scaled-ladder, core & engine) vs flat, unadjusted floor (calendar, no ladder at all) | DIVERGE (large away from pH 6.0-7.5, e.g. ~13kg/ha at pH 5.0) | AGREE (both pH-adjusted) | DIVERGE (same, large) | D |
 * | 4 | Clipping-collection model: calendar's cited model (collected=1.0 baseline, returned reduces P/K 0.4/0.5) ported into core AS-IS vs engine's uncited model (not-collected=1.0 baseline, collected AMPLIFIES 2.5x, MLSN-only) | AGREE (core ported calendar's model) | DIVERGE (opposite polarity + magnitude + methodology scope) | DIVERGE | E |
 * | 5 | Traffic modifier: core is deliberately NEUTRAL (1.0 all tiers, unresolved — see module docblock) vs calendar's (0.85-1.3, applied to annualN pre-ratio) vs engine's (0.8-1.5, applied to removal, MLSN-only) | DIVERGE whenever traffic != moderate | DIVERGE whenever traffic != moderate | DIVERGE (different magnitude AND different application point) | E |
 * | — | Ceiling/floor dispatch, AA/SLAN/MLSN three-tier logic, ppm->kg/ha conversion (GH-370), tissue-ratio gate (GH-368/369), YEARS_TO_CORRECT, MLSN target multiplier (1.5x), SLAN Carrow-2004 ranges | ALL THREE AGREE | ALL THREE AGREE | ALL THREE AGREE | A |
 *
 * Items 1-2 are exactly the two named in the audit's own D31 text (N basis,
 * "removal-rate table"). Item 3 (pH-adjusted P) and item 2's
 * species-vs-flat-ratio distinction were found DURING this extraction, not
 * previously named in the audit or PLAN-remaining-defects.md — reported as
 * new findings. Items 4-5 are the audit's named "clipping factors" and
 * "traffic modifiers" — item 4 was resolved (citation asymmetry, see the
 * core's own module docblock); item 5 was deliberately left unresolved
 * (neither side cited) and is flagged for the client's ruling.
 */

'use strict';

const fs = require('fs');
const path = require('path');

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
const NutritionCalendar = global.window.GilbaNutritionCalendar;

const Engine = require('../assets/nutrition-requirement-engine.js');
const Core = require('../assets/nutrition-requirement-core.js');

const MONTHLY_TEMPS_0_11 = [20, 20, 18, 15, 12, 9, 8, 9, 11, 14, 17, 19];

function calendarInputs(overrides) {
    return Object.assign({
        annualNOverride: 200,
        traffic: 'moderate',
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

function engineInputs(overrides) {
    const o = Object.assign({
        annualN: 200,
        species: 'perennialRyegrass',
        methodology: 'AMMONIUM_ACETATE',
        ph: 6,
        soilPpm: { P: 25, K: 150, Ca: 600, Mg: 60, S: 40 },
        bulkDensity: 1.4,
        soilDepth: 10,
        clippingsCollected: true,
        trafficIntensity: 'moderate',
        aaRanges: { P: { min: 20, max: 30 }, K: { min: 78.2, max: 195.5 } },
        tissuePercent: null,
    }, overrides);
    return {
        engine: {
            soil: Object.assign({ methodology: o.methodology, pH: o.ph, bulkDensity: o.bulkDensity, depth: o.soilDepth }, o.soilPpm),
            turf: { species: o.species, clippingsCollected: o.clippingsCollected, trafficIntensity: o.trafficIntensity },
            climate: { monthlyTemps: null },
            aaRanges: o.aaRanges,
            tissuePercent: o.tissuePercent,
        },
        core: {
            soilValues: o.soilPpm,
            species: o.species,
            annualN: o.annualN,
            methodology: o.methodology,
            ph: o.ph,
            aaRanges: o.aaRanges,
            tissuePercent: o.tissuePercent,
            bulkDensity: o.bulkDensity,
            soilDepth: o.soilDepth,
            clippingsCollected: o.clippingsCollected,
            trafficIntensity: o.trafficIntensity,
        },
    };
}

describe('GH-376 Fixture A — real Hoxton-equivalent fixture (test5-soccer-sample141), above ceiling: ALL THREE AGREE', () => {
    const fixture = JSON.parse(fs.readFileSync(path.join(__dirname, 'fixtures/test5-soccer-sample141.json'), 'utf8'));
    const aaRanges = {};
    Object.keys(fixture.expected.ranges).forEach((n) => {
        aaRanges[n] = { min: fixture.expected.ranges[n].min, max: fixture.expected.ranges[n].max };
    });

    test.each(['P', 'K', 'Ca', 'Mg', 'S'])('%s: core, calendar, and engine all suppress to 0 (above ceiling)', (nutrient) => {
        const coreR = Core.compute({
            soilValues: fixture.inputs.soilPpm, species: 'perennialRyegrass',
            annualN: fixture.inputs.annualNOverride, methodology: 'AMMONIUM_ACETATE',
            ph: fixture.inputs.pH, aaRanges: aaRanges, nutrients: [nutrient]
        });
        const engineR = Engine._calculateNutrientRequirement(nutrient, fixture.inputs.soilPpm[nutrient], {
            methodology: 'AMMONIUM_ACETATE', species: 'perennialRyegrass', aaRange: aaRanges[nutrient],
        });

        global.window.HillLabsSampleTypes = fakeHillLabsSampleTypes(aaRanges);
        const calProgram = NutritionCalendar.computeProgram(calendarInputs({
            annualNOverride: fixture.inputs.annualNOverride,
            soilPpm: fixture.inputs.soilPpm,
            methodology: 'ammonium_acetate',
        }));

        expect(coreR.perSample[nutrient].annualRequirement).toBe(0);
        expect(engineR.annualRequirement).toBe(0);
        expect(calProgram.annual_totals[nutrient]).toBe(0);
    });
});

describe('GH-376 Fixture B — AA, removal-only (within range), no tissue: N-basis (item 1) + species-ratio (item 2) isolated', () => {
    // annualN=200 (Hoxton's real target), species table N=180 (perennialRyegrass)
    // -> engine's non-tissue removal is FLAT (table value, unscaled); core/
    // calendar both scale to the real 200. Clipping neutralised (collected)
    // and traffic neutralised (moderate) so ONLY items 1/2 are visible.
    const inputs = engineInputs({});

    test('P: core and calendar AGREE (species P/N ratio 18/180=0.10 equals calendar\'s flat 0.10 exactly) -- both diverge from engine by the real N-basis fix, reproducing the audit\'s own quoted UI figure (20.0) vs export figure (18.0)', () => {
        const coreR = Core.compute(inputs.core);
        const engineR = Engine.compute(inputs.engine);

        expect(coreR.perSample.P.removal).toBe(20.0); // 18 * 200/180
        expect(engineR.perSample.P.removal).toBe(18.0); // table flat, unscaled -- the exact export figure the audit quotes
        expect(coreR.perSample.P.removal).toBeCloseTo(engineR.perSample.P.removal * (200 / 180), 5);

        global.window.HillLabsSampleTypes = fakeHillLabsSampleTypes(inputs.core.aaRanges);
        const calProgram = NutritionCalendar.computeProgram(calendarInputs({}));
        expect(calProgram.annual_removal.P).toBe(20); // matches core exactly (0.10 flat === 18/180)
        expect(calProgram.annual_totals.P).toBe(20);  // removal-only, no lift (25 is within 20-30)
    });

    test('K: core and calendar are CLOSE but not identical (species-specific ratio 0.5556 vs calendar\'s flat 0.55, item 2) -- both diverge from engine by the N-basis (item 1)', () => {
        const coreR = Core.compute(inputs.core);
        const engineR = Engine.compute(inputs.engine);

        expect(coreR.perSample.K.removal).toBeCloseTo(200 * (100 / 180), 1); // 111.1 -- species-specific table ratio
        expect(engineR.perSample.K.removal).toBe(100.0); // table flat, unscaled

        global.window.HillLabsSampleTypes = fakeHillLabsSampleTypes(inputs.core.aaRanges);
        const calProgram = NutritionCalendar.computeProgram(calendarInputs({}));
        expect(calProgram.annual_removal.K).toBe(110); // 200 * 0.55 (calendar's flat ratio) -- NOT 111.1

        // Item 2 in isolation: core vs calendar, same N basis, different ratio source.
        expect(Math.abs(coreR.perSample.K.removal - calProgram.annual_removal.K)).toBeGreaterThan(0.5);
        expect(Math.abs(coreR.perSample.K.removal - calProgram.annual_removal.K)).toBeLessThan(3);

        // Item 1 in isolation: calendar vs engine, same (flat-ish) ratio family, different N basis.
        // 110 (real N=200, flat 0.55) vs 100 (table N=180, flat 0.556) -- ~10% apart,
        // matching the audit's own "land 10% apart" wording almost exactly.
        const pctApart = Math.abs(calProgram.annual_totals.K - engineR.perSample.K.annualRequirement) / engineR.perSample.K.annualRequirement;
        expect(pctApart).toBeGreaterThan(0.08);
        expect(pctApart).toBeLessThan(0.12);
    });
});

describe('GH-376 Fixture C — AA, WITH a real tissue sample: tissue ratio itself is already unified (GH-368), but the two engines STILL land ~11% apart on the scaling basis', () => {
    // Same tissue reading nutrition-calendar.js's own GH-361 comment cites
    // for the real Hoxton capture (P/N 0.136, K/N 0.667-ish order) -- using
    // this repo's own cross-checked Test5-NZ tissue sample id 144 values
    // (same ones GH-368's own test file uses) since Hoxton's raw tissue
    // ppm/percent isn't in this repo's fixture set, only the audit's
    // summarised ratios.
    const TISSUE = { N: 4.57, P: 0.62, K: 1.05 };
    const inputs = engineInputs({ tissuePercent: TISSUE });

    test('P and K: tissue ratio agrees across all three inputs, but core/calendar (real N=200) vs engine (table N=180) still diverge by the N-basis alone -- this is the residual D31 gap even after the tissue-gate work', () => {
        const coreR = Core.compute(inputs.core);
        const engineR = Engine.compute(inputs.engine);
        global.window.HillLabsSampleTypes = fakeHillLabsSampleTypes(inputs.core.aaRanges);
        const calProgram = NutritionCalendar.computeProgram(calendarInputs({ tissuePercent: TISSUE }));

        expect(coreR.tissueGateApplied).toBe(true);
        expect(calProgram.tissue_gate_applied).toBe(true);

        // Core and calendar: same tissue ratio, same real N=200 basis -- agree closely.
        expect(coreR.perSample.P.removal).toBeCloseTo(calProgram.annual_removal.P, 0);
        expect(coreR.perSample.K.removal).toBeCloseTo(calProgram.annual_removal.K, 0);
        // K matches the exact figure GH-368's own changelog entry quotes for
        // this tissue reading ("the calendar answered 46 kg K/ha").
        expect(Math.round(coreR.perSample.K.removal)).toBe(46);
        expect(Math.round(calProgram.annual_removal.K)).toBe(46);

        // Engine: same tissue ratio, but scaled against table.N=180, not 200.
        const expectedEngineP = Math.round(180 * (0.62 / 4.57) * 10) / 10;
        const expectedEngineK = Math.round(180 * (1.05 / 4.57) * 10) / 10;
        expect(engineR.perSample.P.removal).toBe(expectedEngineP);
        expect(engineR.perSample.K.removal).toBe(expectedEngineK);

        // The residual gap: core vs engine, ~200/180 = 1.111x apart on BOTH
        // nutrients, despite identical tissue ratios -- this is D31's
        // symptom surviving the tissue-gate work exactly as
        // REVIEW-GH349-onward.md's cross-cutting question 1 already flags.
        expect(coreR.perSample.P.removal / engineR.perSample.P.removal).toBeCloseTo(200 / 180, 2);
        expect(coreR.perSample.K.removal / engineR.perSample.K.removal).toBeCloseTo(200 / 180, 2);
    });
});

describe('GH-376 Fixture D — SLAN, below floor: pH-adjusted P ladder (item 3, found during extraction, not previously named)', () => {
    test('at pH 5.0: core and engine both use the Spencer scaled-ladder floor (45ppm); calendar has no pH adjustment at all (flat 27ppm floor) -- a real, large (~13kg/ha) three-way divergence distinct from N-basis/clipping/traffic', () => {
        const inputs = engineInputs({
            methodology: 'SLAN', ph: 5.0, soilPpm: { P: 20, K: 150, Ca: 600, Mg: 60, S: 40 },
            aaRanges: null,
        });
        const coreR = Core.compute(Object.assign({}, inputs.core, { methodology: 'SLAN' }));
        const engineR = Engine.compute(Object.assign({}, inputs.engine, { soil: Object.assign({}, inputs.engine.soil, { methodology: 'SLAN' }) }));

        expect(coreR.perSample.P.floor).toBe(45); // pH<=5.5 rung
        expect(engineR.perSample.P.threshold).toBe(null); // SLAN uses floor/ceiling fields, not threshold
        // Engine exposes floor via the SLAN branch's own return shape -- confirm parity directly.
        const engineP = Engine._calculateNutrientRequirement('P', 20, { methodology: 'SLAN', species: 'perennialRyegrass', ph: 5.0 });
        expect(engineP.floor).toBe(45);

        const calProgram = NutritionCalendar.computeProgram(calendarInputs({
            methodology: 'slan', soilPpm: { P: 20, K: 150, Ca: 600, Mg: 60, S: 40 },
        }));
        expect(calProgram.annual_totals_range.P.min).toBe(27); // calendar's flat, non-pH-adjusted SLAN floor

        // Core and engine agree closely with each other (same pH-adjusted
        // floor; the only residual delta between them is the N-basis, small
        // here since collected+moderate neutralise clipping/traffic).
        expect(coreR.perSample.P.annualRequirement).toBeCloseTo(37.5, 1);
        expect(engineR.perSample.P.annualRequirement).toBeCloseTo(35.5, 1);

        // Calendar, using the unadjusted floor, lands far below both.
        expect(calProgram.annual_totals.P).toBe(25);

        const coreVsCalendarDelta = coreR.perSample.P.annualRequirement - calProgram.annual_totals.P;
        expect(coreVsCalendarDelta).toBeGreaterThan(10); // ~12.5kg, driven entirely by item 3
    });

    test('at pH 6.8 (inside the 6.0-7.5 baseline band): the pH ladder returns the SAME floor (27) as calendar\'s flat value -- item 3 disappears, confirming it is specifically a pH-extremes issue', () => {
        expect(Core._getSlanTargetP(6.8)).toBe(27);
        expect(Engine._getSlanTargetP(6.8)).toBe(27);
    });
});

describe('GH-376 Fixture E — clipping-collection model (item 4) and traffic modifier (item 5): documented, not silently resolved', () => {
    test('item 4: collected is core\'s (and calendar\'s) unmultiplied baseline; engine AMPLIFIES on collected instead -- opposite polarity, not just a different magnitude', () => {
        const notCollected = Core.compute({ soilValues: { K: 90 }, species: 'perennialRyegrass', annualN: 200, methodology: 'SLAN', clippingsCollected: false, trafficIntensity: 'moderate', nutrients: ['K'] });
        const collected = Core.compute({ soilValues: { K: 90 }, species: 'perennialRyegrass', annualN: 200, methodology: 'SLAN', clippingsCollected: true, trafficIntensity: 'moderate', nutrients: ['K'] });
        // Core: collected is the baseline (1.0x); "returned" (not collected) REDUCES.
        expect(collected.perSample.K.removal).toBeGreaterThan(notCollected.perSample.K.removal);

        const engineNotCollected = Engine._calculateNutrientRequirement('K', 90, { methodology: 'MLSN', species: 'perennialRyegrass', clippingsCollected: false, trafficIntensity: 'moderate' });
        const engineCollected = Engine._calculateNutrientRequirement('K', 90, { methodology: 'MLSN', species: 'perennialRyegrass', clippingsCollected: true, trafficIntensity: 'moderate' });
        // Engine: not-collected is the baseline (1.0x); collected AMPLIFIES 2.5x.
        expect(engineCollected.removal).toBeGreaterThan(engineNotCollected.removal);
        expect(engineCollected.removal).toBeCloseTo(engineNotCollected.removal * 2.5, 1);

        // Both models agree collected != not-collected changes K need, but in
        // OPPOSITE directions relative to their own baseline choice -- this
        // is a genuine, not-yet-resolved modelling disagreement (see the
        // core's module docblock, item 3/DISPUTED CONSTANT 3): the two
        // engines here are not measuring the same physical baseline at all.
    });

    test('item 5: core is neutral on traffic; calendar and engine both apply a modifier, at different magnitudes AND different points in the computation -- three-way divergence whenever traffic != moderate, by design (no silent pick)', () => {
        const coreExtreme = Core.compute({ soilValues: { K: 90 }, species: 'perennialRyegrass', annualN: 200, methodology: 'SLAN', clippingsCollected: true, trafficIntensity: 'extreme', nutrients: ['K'] });
        const coreModerate = Core.compute({ soilValues: { K: 90 }, species: 'perennialRyegrass', annualN: 200, methodology: 'SLAN', clippingsCollected: true, trafficIntensity: 'moderate', nutrients: ['K'] });
        expect(coreExtreme.perSample.K.removal).toBe(coreModerate.perSample.K.removal); // neutral by design

        global.window.HillLabsSampleTypes = fakeHillLabsSampleTypes({});
        const calExtreme = NutritionCalendar.computeProgram(calendarInputs({ traffic: 'extreme', methodology: 'slan' }));
        const calModerate = NutritionCalendar.computeProgram(calendarInputs({ traffic: 'moderate', methodology: 'slan' }));
        expect(calExtreme.annual_totals.K).not.toBe(calModerate.annual_totals.K); // calendar: real effect (1.3x on annualN)

        const engineExtreme = Engine._calculateNutrientRequirement('K', 90, { methodology: 'MLSN', species: 'perennialRyegrass', clippingsCollected: true, trafficIntensity: 'extreme' });
        const engineModerate = Engine._calculateNutrientRequirement('K', 90, { methodology: 'MLSN', species: 'perennialRyegrass', clippingsCollected: true, trafficIntensity: 'moderate' });
        expect(engineExtreme.removal).toBeCloseTo(engineModerate.removal * 1.5, 1); // engine: real effect (1.5x on removal)

        // Documented, not silently resolved: core's own two candidate tables
        // are exported precisely so a future decision doesn't have to
        // re-derive these numbers from the two source files again.
        expect(Core.TRAFFIC_MODIFIERS_CALENDAR_CANDIDATE).toEqual({ low: 0.85, moderate: 1.0, high: 1.15, extreme: 1.3 });
        expect(Core.TRAFFIC_MODIFIERS_ENGINE_CANDIDATE).toEqual({ low: 0.8, moderate: 1.0, high: 1.2, extreme: 1.5 });
    });
});

/**
 * GH-370 — the first REAL-PIPELINE below-floor evidence for the ppm -> kg/ha
 * correction-term fix, pinned as a regression fixture.
 *
 * tests/gh370-ppm-to-kgha-unit-conversion.test.js pins the fix on a
 * constructed reading because every stored Test5-NZ / Hoxton value sits above
 * ceiling (correction = 0 either way). This file pins the numbers that were
 * actually RENDERED when Test5-NZ's own sample 141 was temporarily pushed
 * below the S277 floor (K 276 -> 40, P 40 -> 10) and driven through both
 * live surfaces — the Plan page and a real Combined Word export — then
 * restored. See tests/fixtures/test5-soccer-sample141-belowfloor-gh370.json
 * for the DB mutation, the rendered figures, and how each was confirmed.
 *
 * What the live numbers originally proved (pre-GH-381): the correction term
 * is byte-identical across engine, calendar and the GH-376 shared core; the
 * residual UI-vs-export gap (K 84 vs 68.1, P 41 vs 31.4) was the removal
 * N-basis (real annualN 250 vs the species table's own N 180) -- GH-376
 * divergence item 1, larger here (250/180) than the audit's own 200/180
 * example. That WAS the audit's D31 defect (assertion 20: "UI and export
 * return identical annual N, P and K requirements for the same site").
 *
 * GH-381 closed it: nutrition-requirement-engine.js's getRemovalRate()
 * scaled removal (both branches) against the species table's own N instead
 * of the site's real annualN, which this same file's facility-level
 * calculation already resolved correctly -- an internal inconsistency
 * within one engine, not a different engineering choice from the calendar.
 * Fixed by threading the already-resolved annualN into the per-sample
 * config, matching nutrition-calendar.js's `annualN * ratio` exactly. Post-
 * fix the engine lands on K 84.1 / P 40.9 -- the same figures the GH-376
 * shared core already computed (see sharedCore below), and close to the
 * calendar's rounded 84/41 (the residual is generic-ratio precision,
 * 100/180=0.5556 vs the calendar's 0.55 constant, not a basis mismatch).
 * See the fixture's own `_gh381Note` for the original pre-fix live numbers.
 *
 * The parity assertion that used to sit here as `test.failing` now passes
 * and is promoted to a plain `test`, per its own instruction to do exactly
 * that "the moment the engines agree". Two GH-376 divergence items are
 * untouched by this fix and not exercised by this fixture (AA methodology
 * skips both): the pH-corrected P floor ladder only the engine has, and the
 * two engines' uncited, differing traffic modifiers.
 *
 * Runs the REAL modules (not re-implementations), with the same
 * HillLabsSampleTypes / AmmoniumAcetateMethodology / SpeciesController the
 * browser loads, so deriveCode('Perennial Ryegrass', 'sand') resolves S277
 * exactly as the live page does.
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

// deriveCode() canonicalises display names only via the SpeciesController the
// browser has on window -- bridge it onto the node global the resolver reads.
require('../assets/species-controller.js');
global.SpeciesController = global.window.SpeciesController;
const HLST = require('../assets/hill-labs-sample-types.js');
global.window.HillLabsSampleTypes = HLST;
// ammonium-acetate-methodology.js's load-time init() schedules a 1s DOM
// retry (setTimeout) that would otherwise keep the jest worker alive -- let it
// schedule, but unref'd, for the duration of this one require.
const _realSetTimeout = global.setTimeout;
global.setTimeout = function (fn, ms) {
    const t = _realSetTimeout(fn, ms);
    if (t && typeof t.unref === 'function') t.unref();
    return t;
};
require('../assets/ammonium-acetate-methodology.js');
global.setTimeout = _realSetTimeout;
global.window.AmmoniumAcetateMethodology = global.window.AmmoniumAcetateMethodology || global.AmmoniumAcetateMethodology;

global.window.GilbaGrowthPotentialEngine = require('../assets/growth-potential-engine.js');
require('../assets/nutrition-calendar.js');
const Calendar = global.window.GilbaNutritionCalendar;
const Engine = require('../assets/nutrition-requirement-engine.js');
const Core = require('../assets/nutrition-requirement-core.js');

const fixture = JSON.parse(fs.readFileSync(
    path.join(__dirname, 'fixtures/test5-soccer-sample141-belowfloor-gh370.json'), 'utf8'));
const IN = fixture.inputs;
const EX = fixture.expected;
const MONTHLY_TEMPS_0_11 = [19.8, 20.4, 19.1, 17, 14.7, 12.6, 11.4, 11.8, 12.9, 14.2, 16, 18.2];

function resolveAaRanges() {
    const code = HLST.deriveCode(IN.species, IN.soilTexture);
    const out = {};
    ['P', 'K', 'Ca', 'Mg', 'S'].forEach((n) => {
        let r = code ? HLST.getRangesPpm(code, n, IN.CEC) : null;
        if (!r) {
            const g = global.window.AmmoniumAcetateMethodology.getSufficiencyRange(n, 'sands');
            r = { min: g.ranges.medium[0], max: g.ranges.medium[1] };
        }
        out[n] = r;
    });
    return { code, aaRanges: out };
}

describe('GH-370 live-verified below-floor fixture (Test5-NZ sample 141 at K=40 / P=10)', () => {
    const { code, aaRanges } = resolveAaRanges();

    test('the floors the live surfaces resolved: S277 certificate, P 20 / K 78.2 ppm (display species name, as the browser passes it)', () => {
        expect(code).toBe(EX.certificateCode);
        expect(aaRanges.P.min).toBe(EX.floors.P);
        expect(aaRanges.P.max).toBe(EX.ceilings.P);
        expect(aaRanges.K.min).toBeCloseTo(EX.floors.K, 6);
        expect(aaRanges.K.max).toBeCloseTo(EX.ceilings.K, 6);
    });

    test('Combined export path (nutrition-requirement-engine.js): K req 84.1 / P req 40.9 follow the CONVERTED correction and the real-annualN removal basis (GH-370 + GH-381)', () => {
        const r = Engine.compute({
            soil: Object.assign({ methodology: 'AMMONIUM_ACETATE', pH: IN.pH, CEC: IN.CEC }, IN.soilPpm),
            turf: { species: IN.speciesKey, clippingManagement: 'collected', nProgramKgHaYr: IN.annualN },
            climate: { monthlyTemps: null },
            aaRanges: aaRanges,
            tissuePercent: IN.tissuePercent
        });
        const exp = EX.combinedExport.engineDecomposition;
        ['K', 'P'].forEach((n) => {
            expect(r.perSample[n].intent).toBe('lift-to-floor');
            expect(r.perSample[n].removal).toBe(exp[n].removal);
            expect(r.perSample[n].correctionRequired).toBeCloseTo(exp[n].correctionRequired, 6);
            expect(r.perSample[n].annualRequirement).toBe(exp[n].annualRequirement);
        });
        // The figures actually printed in the .docx ANR table.
        expect(r.perSample.K.annualRequirement).toBe(EX.combinedExport.annualNutrientRequirementsRow.K_req);
        expect(r.perSample.P.annualRequirement).toBe(EX.combinedExport.annualNutrientRequirementsRow.P_req);
        // And explicitly NOT the unconverted (deficit_ppm / years) figures.
        expect(r.perSample.K.annualRequirement).not.toBe(EX.combinedExport._ifUnconverted.K_req);
        expect(r.perSample.P.annualRequirement).not.toBe(EX.combinedExport._ifUnconverted.P_req);
        // Hand formula, from the fixture's own floors and the default factor.
        const factor = IN.bulkDensity * IN.soilDepth * 0.1;
        expect(r.perSample.K.correctionRequired).toBeCloseTo((EX.floors.K - IN.soilPpm.K) * factor / 2, 6);
        expect(r.perSample.P.correctionRequired).toBeCloseTo((EX.floors.P - IN.soilPpm.P) * factor / 2, 6);
    });

    // GH-403: the Plan's Required was 84 on the cards and 84.2 in the Nutrient
    // Delivery Summary while the document printed 84.1 — one column name, three
    // numbers, because the calendar rounded the core's annual requirement to a
    // whole kilogram before distributing it and the panel then re-derived
    // Required by summing the twelve rounded monthly rows. Both surfaces now
    // print the engine's own 84.1 / 40.9. The pre-GH-403 figures are kept in the
    // fixture under planPage._preGh403PlanRender.
    test('Plan page path (nutrition-calendar.js computeProgram): rendered K 84.1 / P 40.9, removal 57 / 34, lift 26.74 / 7.0, certificate-sourced range', () => {
        const p = Calendar.computeProgram({
            annualNOverride: IN.annualN,
            traffic: 'moderate',
            clippingManagement: 'collected',
            bulkDensity: IN.bulkDensity,
            soilDepth: IN.soilDepth,
            methodology: IN.methodology,
            species: IN.speciesKey,
            speciesDisplay: IN.species,
            soilTexture: IN.soilTexture,
            CEC: IN.CEC,
            isC4: false,
            distribution: 'gp_weighted',
            monthlyTemps: MONTHLY_TEMPS_0_11,
            soilPpm: IN.soilPpm,
            tissuePercent: IN.tissuePercent
        });
        const exp = EX.planPage.persistedNutritionCalendarProgram;
        expect(p.tissue_gate_applied).toBe(true);
        ['K', 'P'].forEach((n) => {
            expect(p.annual_totals[n]).toBe(exp.annual_totals[n]);
            expect(p.annual_removal[n]).toBe(exp.annual_removal[n]);
            expect(p.annual_lift[n]).toBeCloseTo(exp.annual_lift[n], 6);
            expect(p.annual_totals_range_source[n]).toBe('certificate');
        });
        expect(p.annual_totals_range.K.min).toBeCloseTo(EX.floors.K, 6);
        expect(p.annual_totals_range.P.min).toBe(EX.floors.P);
        expect(p.annual_totals.K).toBe(EX.planPage.annualRequirementCards.K);
        expect(p.annual_totals.P).toBe(EX.planPage.annualRequirementCards.P);
    });

    test('GH-376 shared core on the same inputs: same converted correction, removal on the real-N basis (K 84.1 / P 40.9)', () => {
        const c = Core.compute({
            soilValues: IN.soilPpm, species: IN.speciesKey, annualN: IN.annualN,
            // GH-383: the core takes caller-resolved `ranges` for all three
            // methodologies and the clipping STRING; traffic is gone from the
            // per-nutrient path (it scales annualN upstream in the adapter).
            methodology: 'AMMONIUM_ACETATE', ph: IN.pH, ranges: aaRanges,
            tissuePercent: IN.tissuePercent, bulkDensity: IN.bulkDensity, soilDepth: IN.soilDepth,
            clippingManagement: 'collected'
        });
        ['K', 'P'].forEach((n) => {
            expect(c.perSample[n].removal).toBe(EX.sharedCore[n].removal);
            expect(c.perSample[n].correctionRequired).toBeCloseTo(EX.sharedCore[n].correctionRequired, 6);
            expect(c.perSample[n].annualRequirement).toBe(EX.sharedCore[n].annualRequirement);
        });
    });

    function threeWay() {
        const e = Engine.compute({
            soil: Object.assign({ methodology: 'AMMONIUM_ACETATE', pH: IN.pH }, IN.soilPpm),
            turf: { species: IN.speciesKey, clippingManagement: 'collected', nProgramKgHaYr: IN.annualN },
            climate: { monthlyTemps: null }, aaRanges: aaRanges, tissuePercent: IN.tissuePercent
        }).perSample;
        const c = Core.compute({
            soilValues: IN.soilPpm, species: IN.speciesKey, annualN: IN.annualN, methodology: 'AMMONIUM_ACETATE',
            ph: IN.pH, ranges: aaRanges, tissuePercent: IN.tissuePercent,
            bulkDensity: IN.bulkDensity, soilDepth: IN.soilDepth, clippingManagement: 'collected'
        }).perSample;
        const p = Calendar.computeProgram({
            annualNOverride: IN.annualN, traffic: 'moderate', clippingManagement: 'collected',
            bulkDensity: IN.bulkDensity, soilDepth: IN.soilDepth, methodology: IN.methodology,
            species: IN.speciesKey, speciesDisplay: IN.species, soilTexture: IN.soilTexture, CEC: IN.CEC,
            isC4: false, distribution: 'gp_weighted', monthlyTemps: MONTHLY_TEMPS_0_11,
            soilPpm: IN.soilPpm, tissuePercent: IN.tissuePercent
        });
        return { e, c, p };
    }

    test('three-way: the converted correction term is identical in engine, shared core and calendar (GH-370 is not the source of any residual gap)', () => {
        const { e, c, p } = threeWay();
        ['K', 'P'].forEach((n) => {
            expect(e[n].correctionRequired).toBeCloseTo(c[n].correctionRequired, 9);
            expect(p.annual_lift[n]).toBeCloseTo(c[n].correctionRequired, 9);
        });
        // GH-380: this test used to go on to assert that the engine's removal
        // is the calendar's scaled by 180/250 -- i.e. it pinned the D31 N-basis
        // divergence (the audit's assertion-20 violation) as expected
        // behaviour. Removed; the honest assertion is the one below.
    });

    // D31 / Hoxton audit assertion 20 -- "UI and export return identical
    // annual N, P and K requirements for the same site". This used to be a
    // `test.failing`, declared "expected to fail until D31 stage 2" (the
    // GH-376 shared-core cutover). GH-381 closed the actual live gap first --
    // it turned out to be a one-engine internal inconsistency (removal scaled
    // against the wrong N basis), not something that needed the full engine
    // unification to fix. Per the `test.failing` comment's own instruction
    // ("promote it to a plain test... the moment the engines agree"), this is
    // now that plain test. It does NOT mean D31 is fully closed: the pH-
    // corrected P floor ladder and the two engines' traffic modifiers are
    // still open divergences (see the file header) -- this fixture's AA
    // methodology just doesn't exercise either, so this assertion passing
    // here is real but partial. The live gate remains
    // tests/e2e/ui-vs-export-parity.test.js against the running stack.
    test('D31 parity (removal N-basis, GH-381): the export engine\'s K/P removal and annual requirement equal the Plan calendar\'s on the same inputs', () => {
        const { e, p } = threeWay();
        ['K', 'P'].forEach((n) => {
            expect(e[n].removal).toBeCloseTo(p.annual_removal[n], 0);
            expect(e[n].annualRequirement).toBeCloseTo(p.annual_totals[n], 0);
        });
    });
});

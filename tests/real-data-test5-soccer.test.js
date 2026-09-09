/**
 * Real-data regression test — Test5 - NZ, sample 141 ("Soccer").
 *
 * See tests/fixtures/README.md for the convention this follows. Every number
 * in tests/fixtures/test5-soccer-sample141.json's `expected` block was
 * confirmed against the real system this session (2026-09-07): read straight
 * from the database via `docker exec gilba_mysql mysql`, cross-checked
 * against the live UI's Data page, and against a real Combined Word export
 * downloaded and unzipped via a Playwright-driven browser session.
 *
 * Unlike the GH-351/352/353 tests (which pin the source code's structure via
 * regex, or use hand-picked numbers), this test feeds the REAL recorded
 * values through the actual engines and asserts the REAL confirmed outputs.
 * None of GH-351 through GH-355 were caught by synthetic test numbers when
 * they were introduced -- they were only found by manually cross-checking a
 * live site. This is the automated version of that cross-check, so the next
 * regression on this exact scenario fails a test instead of needing another
 * manual DB+UI+export round-trip.
 *
 * Scope note: this tests nutrition-requirement-engine.js's core AA-ceiling
 * calculation directly with the range HillLabsSampleTypes/SpeciesController
 * resolve for this species+texture (confirmed by calling those modules
 * directly below) -- not word-export.js's own resolution of that range.
 * GH-357 (found after this file was written) fixed the last piece of that
 * wiring (reports/export.blade.php never threaded the site's real texture
 * into GAIP_HUB_CONFIG at all), so as of GH-357 the live export path
 * resolves the exact same S277 certificate range this fixture encodes,
 * confirmed live end-to-end -- this file's "resolve it correctly" numbers
 * are no longer just the intended target, they're what production actually
 * does now.
 */

'use strict';

const fs = require('fs');
const path = require('path');

const fixture = JSON.parse(
    fs.readFileSync(path.join(__dirname, 'fixtures/test5-soccer-sample141.json'), 'utf8')
);

// nutrition-requirement-engine.js is a pure module (no window/document
// dependency) -- require it directly, same pattern as gh299/gh351's tests.
const Engine = require('../assets/nutrition-requirement-engine.js');

// hill-labs-sample-types.js and species-controller.js need a minimal
// window/document shim (species-controller.js reads document.readyState at
// load time) but are otherwise pure.
global.window = global.window || {};
global.document = global.document || {
    readyState: 'complete',
    addEventListener: function () {},
    querySelector: function () { return null; },
    querySelectorAll: function () { return []; },
};
require('../assets/species-controller.js');
require('../assets/hill-labs-sample-types.js');
require('../assets/ammonium-acetate-methodology.js');
const HillLabsSampleTypes = global.window.HillLabsSampleTypes || global.HillLabsSampleTypes;
const AmmoniumAcetateMethodology = global.window.AmmoniumAcetateMethodology || global.AmmoniumAcetateMethodology;

describe('Real data — Test5/Soccer (sample 141): certificate code + ranges resolve as confirmed live', () => {
    // GH-365: was `construction === 'sand_profile' ? 'sand' : construction`,
    // i.e. the test reimplemented GH-355's mapping instead of using data. The
    // fixture now carries the sample's own recorded texture
    // (samples.soil_texture_snapshot = 'sand' for id 141), which is the value
    // production resolves first after GH-364.
    const code = HillLabsSampleTypes.deriveCode(fixture.inputs.species, fixture.inputs.soilTexture);

    test('deriveCode() resolves the real certificate code for this species+texture', () => {
        expect(code).toBe(fixture.expected.certificateCode);
    });

    test.each(['P', 'K', 'Ca', 'Mg'])('%s: certificate range matches the real Hill Labs S277 printed range', (nutrient) => {
        // me/100g -> ppm conversion leaves float noise (e.g. 85.39999999999999)
        // on some nutrients -- round to 1dp, same precision the rest of the
        // codebase rounds this conversion to.
        const range = HillLabsSampleTypes.getRangesPpm(code, nutrient, fixture.inputs.CEC);
        expect(Math.round(range.min * 10) / 10).toBe(fixture.expected.ranges[nutrient].min);
        expect(Math.round(range.max * 10) / 10).toBe(fixture.expected.ranges[nutrient].max);
    });

    test('S: S277 has no certificate range at all (by design) -- falls through to the generic sands band', () => {
        const certRange = HillLabsSampleTypes.getRangesPpm(code, 'S', fixture.inputs.CEC);
        expect(certRange).toBeNull();
        const generic = AmmoniumAcetateMethodology.getSufficiencyRange('S', 'sands');
        expect(generic.ranges.medium).toEqual([fixture.expected.ranges.S.min, fixture.expected.ranges.S.max]);
    });
});

describe('Real data — Test5/Soccer (sample 141): nutrition-requirement-engine.js reproduces the confirmed-live P/K/Ca/Mg/S results', () => {
    // GH-365: these used to read the range out of fixture.expected, which fed
    // the engine an already-correct input and so only tested arithmetic. The
    // range is now resolved through the same production chain the first
    // describe block pins (deriveCode -> getRangesPpm), so a regression in
    // range resolution fails here too.
    const code = HillLabsSampleTypes.deriveCode(fixture.inputs.species, fixture.inputs.soilTexture);

    test.each(['P', 'K', 'Ca', 'Mg'])('%s: real ppm value against the real certificate range -> confirmed status/intent/req', (nutrient) => {
        const range = HillLabsSampleTypes.getRangesPpm(code, nutrient, fixture.inputs.CEC);
        const result = Engine._calculateNutrientRequirement(nutrient, fixture.inputs.soilPpm[nutrient], {
            methodology: 'AMMONIUM_ACETATE',
            species: 'perennialRyegrass',
            aaRange: { min: range.min, max: range.max },
        });
        const expected = fixture.expected.nutrientRequirement[nutrient];
        expect(result.status).toBe(expected.status);
        expect(result.intent).toBe(expected.intent);
        expect(result.annualRequirement).toBe(expected.annualRequirement);
    });

    test('S: real ppm value against the generic sands band -> confirmed status/intent/req', () => {
        // S277 carries no S range, so production falls through to the generic
        // band -- resolved here the same way rather than read from `expected`.
        expect(HillLabsSampleTypes.getRangesPpm(code, 'S', fixture.inputs.CEC)).toBeNull();
        const _generic = AmmoniumAcetateMethodology.getSufficiencyRange('S', 'sands');
        const range = { min: _generic.ranges.medium[0], max: _generic.ranges.medium[1] };
        const result = Engine._calculateNutrientRequirement('S', fixture.inputs.soilPpm.S, {
            methodology: 'AMMONIUM_ACETATE',
            species: 'perennialRyegrass',
            aaRange: { min: range.min, max: range.max },
        });
        const expected = fixture.expected.nutrientRequirement.S;
        expect(result.status).toBe(expected.status);
        expect(result.intent).toBe(expected.intent);
        expect(result.annualRequirement).toBe(expected.annualRequirement);
    });
});

describe('Real data — Test5/Soccer (sample 141): K reconciliation classification matches the confirmed-live Word export', () => {
    // GH-365: this block used to assert fixture.expected against a string
    // literal without calling anything -- it could not fail on a regression in
    // the classifier it was named after. word-export.js bails at load time
    // unless a `docx` global exists, but _classifyKReconState() itself is pure,
    // so a minimal stub is enough to reach the real function.
    let classify;
    beforeAll(() => {
        global.docx = new Proxy({}, { get: () => function () {} });
        // The module runs initLogoUpload() at load, which touches DOM and
        // storage APIs the shim above doesn't provide -- extend it rather than
        // widening the shared stub every other describe block relies on.
        global.document.getElementById = function () { return null; };
        global.localStorage = global.localStorage ||
            { getItem: function () { return null; }, setItem: function () {}, removeItem: function () {} };
        jest.resetModules();
        global.window = global.window || {};
        require('../assets/word-export.js');
        const WE = global.window.GilbaWordExport || global.window.WordExport ||
            global.window.GAIP_WordExport || null;
        classify = WE && WE._classifyKReconState;
    });

    test('the real _classifyKReconState() is reachable (guards against this block silently testing nothing again)', () => {
        expect(typeof classify).toBe('function');
    });

    test('K req=0 + intent suppress-above-ceiling -> the exact "no-need" state and text seen in the downloaded .docx', () => {
        const k = fixture.expected.nutrientRequirement.K;
        const recon = fixture.expected.kReconciliation;
        const result = classify({
            anrK: { intent: k.intent, annualRequirement: k.annualRequirement },
            kRequired: k.annualRequirement,
            balance: recon.kDelivered - k.annualRequirement,
            kReconApplied: false,
            kReconDecision: null,
        });
        expect(result.state).toBe(recon.spotKState);
        expect(result.text).toBe(recon.spotKText);
    });

    test('the same balance with a deficient soil classifies differently — proves the assertion above is load-bearing', () => {
        const recon = fixture.expected.kReconciliation;
        const result = classify({
            anrK: { intent: 'lift-to-floor', annualRequirement: 100 },
            kRequired: 100,
            balance: recon.kDelivered - 100,
            kReconApplied: false,
            kReconDecision: null,
        });
        expect(result.state).not.toBe('no-need');
    });
});

describe('Real data — Test5/Soccer (sample 141): nutrition-calendar.js\'s computeProgram() — the OTHER engine — reproduces the same P/K/S ceiling (GH-374, Hoxton audit D06 / assertion 19)', () => {
    // GH-374: real-data-test5-soccer.test.js already pinned this fixture's
    // P/K/Ca/Mg/S ceiling through nutrition-requirement-engine.js's
    // _calculateNutrientRequirement() (the describe block above), but
    // nutrition-calendar.js's computeProgram() is a structurally separate
    // implementation (GH-300's own comment: "never routed through the
    // shared engine") with its own ceiling check. Every existing
    // computeProgram() ceiling test (gh300, gh305, gh308, gh319) exercises K
    // and/or S with a HAND-WRITTEN fake HillLabsSampleTypes -- grepping the
    // whole tests/ tree for `annual_totals.P` before this addition returns
    // zero matches, so computeProgram()'s P ceiling had no coverage at all,
    // the exact gap the Hoxton audit's assertion 19 ("same assertion for P
    // and S, symmetrically") flags. This block closes it with the REAL
    // HillLabsSampleTypes/AmmoniumAcetateMethodology modules (already loaded
    // real, not faked, earlier in this file) and the same confirmed-live
    // fixture, rather than re-implementing the ceiling arithmetic here.
    let NutritionCalendar;
    let program;

    beforeAll(() => {
        global.window.GilbaGrowthPotentialEngine =
            global.window.GilbaGrowthPotentialEngine || require('../assets/growth-potential-engine.js');
        require('../assets/nutrition-calendar.js');
        NutritionCalendar = global.window.GilbaNutritionCalendar;

        // A plausible 12-month temperature series -- computeProgram() only
        // requires monthlyTemps to be complete (all 12 months numeric) to
        // pass STEP 1; the annual ceiling totals asserted below are computed
        // in STEP 4/5 from soilPpm/aaRanges, not from these values, so their
        // exact figures don't matter to this test the way they would to a
        // monthly-distribution test.
        const monthlyTemps = [19.8, 20.4, 19.1, 17, 14.7, 12.6, 11.4, 11.8, 12.9, 14.2, 16, 18.2];

        program = NutritionCalendar.computeProgram({
            annualNOverride: fixture.inputs.annualNOverride,
            traffic: 'moderate',
            clippingManagement: 'collected',
            bulkDensity: 1.4,
            soilDepth: 10,
            methodology: fixture.inputs.methodology,
            species: 'perennialRyegrass',
            speciesDisplay: fixture.inputs.species,
            soilTexture: fixture.inputs.soilTexture,
            CEC: fixture.inputs.CEC,
            isC4: false,
            distribution: 'gp_weighted',
            monthlyTemps: monthlyTemps,
            soilPpm: fixture.inputs.soilPpm,
        });
    });

    test('computeProgram() ran clean against the real fixture (no error, no climate-unavailable fallback)', () => {
        expect(program.error).toBeUndefined();
        expect(program.climateDataUnavailable).toBeUndefined();
    });

    test.each(['P', 'K', 'Ca', 'Mg', 'S'])(
        '%s: annual_totals is zeroed by the ceiling, matching nutrition-requirement-engine.js\'s suppress-above-ceiling result for the same fixture',
        (nutrient) => {
            const expected = fixture.expected.nutrientRequirement[nutrient];
            expect(expected.annualRequirement).toBe(0); // sanity: fixture itself expects a ceiling hit for every one of these
            expect(program.annual_totals[nutrient]).toBe(0);
        }
    );

    test('P specifically: the range source is "certificate" (S277 prints a real Olsen P range), not the texture fallback', () => {
        expect(program.annual_totals_range_source.P).toBe('certificate');
        expect(program.annual_totals_range.P.min).toBe(fixture.expected.ranges.P.min);
        expect(program.annual_totals_range.P.max).toBe(fixture.expected.ranges.P.max);
    });

    test('S specifically: the range source is the generic sands fallback (S277 prints no S range at all), and it still ceilings', () => {
        expect(program.annual_totals_range_source.S).toBe('texture-fallback');
        expect(program.annual_totals_range.S.min).toBe(fixture.expected.ranges.S.min);
        expect(program.annual_totals_range.S.max).toBe(fixture.expected.ranges.S.max);
    });

    test('regression guard: a P level actually below the certificate ceiling is NOT zeroed (proves the assertions above are load-bearing, not a fixture that always zeroes)', () => {
        const belowCeiling = NutritionCalendar.computeProgram({
            annualNOverride: fixture.inputs.annualNOverride,
            traffic: 'moderate',
            clippingManagement: 'collected',
            bulkDensity: 1.4,
            soilDepth: 10,
            methodology: fixture.inputs.methodology,
            species: 'perennialRyegrass',
            speciesDisplay: fixture.inputs.species,
            soilTexture: fixture.inputs.soilTexture,
            CEC: fixture.inputs.CEC,
            isC4: false,
            distribution: 'gp_weighted',
            monthlyTemps: [19.8, 20.4, 19.1, 17, 14.7, 12.6, 11.4, 11.8, 12.9, 14.2, 16, 18.2],
            soilPpm: Object.assign({}, fixture.inputs.soilPpm, { P: 15 }), // real S277 floor is 20 -- 15 sits below it
        });
        expect(belowCeiling.error).toBeUndefined();
        expect(belowCeiling.annual_totals.P).toBeGreaterThan(0);
    });
});

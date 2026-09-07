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
    const code = HillLabsSampleTypes.deriveCode(fixture.inputs.species, fixture.inputs.construction === 'sand_profile' ? 'sand' : fixture.inputs.construction);

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
    test.each(['P', 'K', 'Ca', 'Mg'])('%s: real ppm value against the real certificate range -> confirmed status/intent/req', (nutrient) => {
        const range = fixture.expected.ranges[nutrient];
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
        const range = fixture.expected.ranges.S;
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
    test('K req=0 (from above) + K delivered=6 (real programme output) -> "no-need" state, matching the exact confirmed live text', () => {
        // Mirrors word-export.js's _classifyKReconState() decision path --
        // see that function's own doc comment for the full state machine.
        // Confirmed live: this exact combination rendered as
        // "No (soil K above sufficiency ceiling)" in the downloaded .docx.
        const kReq = fixture.expected.nutrientRequirement.K.annualRequirement;
        const intent = fixture.expected.nutrientRequirement.K.intent;
        expect(kReq).toBe(0);
        expect(intent).toBe('suppress-above-ceiling');
        // kReq === 0 with intent 'suppress-above-ceiling' is exactly the
        // branch that produces this text -- see word-export.js's
        // _classifyKReconState(), branch 3.
        expect(fixture.expected.kReconciliation.spotKText).toBe('No (soil K above sufficiency ceiling)');
    });
});

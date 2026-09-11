/**
 * GH-413 — the pH of the sample the user picked on the Plan page reaches the
 * engine, and the document's Range column is read off the same floor its
 * Required column was computed from.
 *
 * Two halves, both measured live before the fix (audit F3):
 *
 *   1. `NutritionCalendar.initSamplePicker`'s applySample() copied a sample's
 *      P/K/Ca/Mg/S and micros into GAIP_STATE and nothing else, so
 *      collectFromState()'s `soil.pH_water ?? soil.pH` resolved null on all
 *      fifty generations of the audit. Both pH ladders — SLAN's Spencer
 *      scaled ladder and MLSN's D-7 ladder, the two things that move a
 *      phosphorus floor — were therefore dead on the Plan page while the Word
 *      export applied them. New test - location / Green 5 (pH 8.26): Required
 *      P 15.6 on screen, 32.4 in the document, for one sample.
 *
 *   2. In the Combined export, `perSampleInputs` starts as a copy of the
 *      FACILITY collectFromState() snapshot and every programme-level field is
 *      overwritten per sample from the shared adapter — except `ranges`, which
 *      was left as the facility object. computeProgram() prefers
 *      `inputs.ranges`, so the per-sample programme (and `annual_totals_range`,
 *      which this table prints as Range) came from one sample's pH while
 *      Required came from the sample's own.
 *
 * The fixture is the real Green 5 record; its expected block is the DOCUMENT's
 * figures, the half that was already right.
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
const _quiet = { log: function () {}, warn: function () {}, error: function () {}, info: function () {} };
const _realConsole = global.console;
global.console = _quiet;

const Core = require('../assets/nutrition-requirement-core.js');
global.window.NutritionRequirementCore = Core;
require('../assets/species-controller.js');
require('../assets/hill-labs-sample-types.js');
require('../assets/ammonium-acetate-methodology.js');
require('../assets/gaip-classification-constants.js');
const NPI = require('../assets/nutrition-program-inputs.js');
global.window.GAIP_NutritionProgramInputs = NPI;

global.console = _realConsole;

const FIX = JSON.parse(fs.readFileSync(
    path.join(__dirname, 'fixtures/gh413-ntl-green5-ph826.json'), 'utf8'));
const CALENDAR_SRC = fs.readFileSync(path.join(__dirname, '../assets/nutrition-calendar.js'), 'utf8');
const COMBINED_SRC = fs.readFileSync(path.join(__dirname, '../assets/word-export-combined.js'), 'utf8');

function rangesFor(pH) {
    return NPI.resolveSufficiencyRanges({
        methodology: FIX.inputs.methodology,
        speciesDisplay: FIX.inputs.species,
        speciesKey: FIX.inputs.speciesKey,
        soilTexture: null,
        CEC: FIX.inputs.CEC,
        pH: pH
    }).ranges;
}

function computeWith(pH) {
    return Core.compute({
        soilValues: FIX.inputs.soilPpm,
        species: FIX.inputs.species,
        ph: pH,
        methodology: FIX.inputs.methodology,
        ranges: rangesFor(pH),
        tissuePercent: null,
        annualN: FIX.inputs.annualN,
        bulkDensity: FIX.inputs.bulkDensity,
        soilDepth: FIX.inputs.soilDepth,
        clippingManagement: FIX.inputs.clippingManagement
    });
}

describe('GH-413 — the real Green 5 record, computed with its own pH', () => {
    test('the SLAN P floor follows the sample pH of 8.26 to 51 ppm', () => {
        const r = rangesFor(FIX.inputs.pH);
        expect(r.P.min).toBe(FIX.expected.ranges.P.min);
        expect(r.P.max).toBe(FIX.expected.ranges.P.max);
        expect(r.K.min).toBe(FIX.expected.ranges.K.min);
        expect(r.K.max).toBe(FIX.expected.ranges.K.max);
    });

    test('Required P and K are the document\'s figures, 32.4 and 71.1', () => {
        const c = computeWith(FIX.inputs.pH);
        expect(c.perSample.P.annualRequirement).toBeCloseTo(FIX.expected.annualRequirement.P, 1);
        expect(c.perSample.K.annualRequirement).toBeCloseTo(FIX.expected.annualRequirement.K, 1);
        expect(c.perSample.P.removal).toBeCloseTo(FIX.expected.removal.P, 1);
        expect(c.perSample.K.removal).toBeCloseTo(FIX.expected.removal.K, 1);
        expect(c.perSample.P.intent).toBe(FIX.expected.intent.P);
        expect(c.perSample.K.intent).toBe(FIX.expected.intent.K);
    });

    test('with pH withheld — the Plan page\'s state before this ticket — the same record gives 15.6', () => {
        const c = computeWith(null);
        expect(rangesFor(null).P.min).toBe(FIX.expected.planBeforeGh413.pFloor);
        expect(c.perSample.P.annualRequirement)
            .toBeCloseTo(FIX.expected.planBeforeGh413.annualRequirementP, 1);
    });

    test('Range and Required come from one floor: the printed kg/ha range brackets the floor Required used', () => {
        const r = rangesFor(FIX.inputs.pH);
        const unit = FIX.inputs.bulkDensity * FIX.inputs.soilDepth * 0.1;
        expect(`${Math.round(r.P.min * unit * 10) / 10}–${Math.round(r.P.max * unit * 10) / 10}`)
            .toBe(FIX.expected.rangeKgHa.P);
        expect(`${Math.round(r.K.min * unit * 10) / 10}–${Math.round(r.K.max * unit * 10) / 10}`)
            .toBe(FIX.expected.rangeKgHa.K);
    });
});

describe('GH-413 — the picker writes the sample\'s pH into the state the calendar reads', () => {
    test('applySample() carries pH, pH_water and CEC alongside the ppm figures', () => {
        const idx = CALENDAR_SRC.indexOf('function applySample(sample) {');
        expect(idx).toBeGreaterThan(-1);
        const block = CALENDAR_SRC.slice(idx, idx + 3200);
        // `pH_water` is the key collectFromState() reads first; `pH` is the one
        // every other consumer of state.inputs.soil reads.
        expect(block).toMatch(/pH: pl\.pH_Water != null \? pl\.pH_Water : \(pl\.pH != null \? pl\.pH : null\)/);
        expect(block).toMatch(/pH_water: pl\.pH_Water != null \? pl\.pH_Water : \(pl\.pH != null \? pl\.pH : null\)/);
        expect(block).toMatch(/CEC: pl\.CEC != null \? pl\.CEC : \(pl\.CEC_meq100g != null \? pl\.CEC_meq100g : null\)/);
    });

    test('pH_CaCl2 is not a fallback for water pH — a different measurement on a different scale', () => {
        const idx = CALENDAR_SRC.indexOf('function applySample(sample) {');
        const block = CALENDAR_SRC.slice(idx, idx + 3200);
        expect(block).not.toMatch(/pl\.pH_CaCl2/);
    });

    test('rebuilding the soil object no longer drops the site texture the page bridged in', () => {
        const idx = CALENDAR_SRC.indexOf('function applySample(sample) {');
        const block = CALENDAR_SRC.slice(idx, idx + 3200);
        expect(block).toMatch(/soilTexture: existingSoil\.soilTexture/);
    });
});

describe('GH-413 — the export\'s per-sample programme uses the per-sample ranges', () => {
    test('ranges and their provenance are overlaid per sample, beside texture, CEC and pH', () => {
        const idx = COMBINED_SRC.indexOf('perSampleInputs.pH = _siteInputs.pH;');
        expect(idx).toBeGreaterThan(-1);
        const block = COMBINED_SRC.slice(idx, idx + 2000);
        expect(block).toMatch(/perSampleInputs\.ranges = _siteInputs\.ranges;/);
        expect(block).toMatch(/perSampleInputs\.rangeSources = _siteInputs\.rangeSources;/);
    });

    test('computeProgram() still prefers the ranges it is handed, which is what makes the overlay bite', () => {
        expect(CALENDAR_SRC).toMatch(/let aaRanges = inputs\.ranges \|\| null;/);
    });
});

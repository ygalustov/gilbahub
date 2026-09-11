/**
 * GH-415 — "Required 0.0" and "Deficit (-56%)" can no longer stand in one row.
 *
 * Thirteen rows across the audit's fifty generations said both at once: twelve
 * potassium rows on Burns and one phosphorus row on Test5. The requirement
 * model was saying apply nothing while the balance model said the season would
 * end below the floor, and the client could not tell which to believe.
 *
 * It is arithmetic, not presentation. Above the ceiling the requirement was a
 * flat zero, and that is only safe while the range is at least as wide in kg/ha
 * as the season's removal. Where it is narrower — MLSN potassium on greens is a
 * band of 25.9 kg/ha against a removal of 64 — a soil above the ceiling still
 * finishes below the floor.
 *
 * Decision B1, confirmed by the owner: Woods' formula in that branch,
 *
 *     Required = max(0, removal - (current - floor) x unit)
 *
 * applied identically on MLSN, SLAN and AA. Required is then 0 exactly when
 * `current - removal >= floor`, which is exactly when Balance lands on or above
 * the floor — so the two models share floor, removal and unit and cannot
 * disagree. Woods INSIDE the range (variant B2) was measured and deliberately
 * not taken.
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
const _realConsole = global.console;
global.console = { log: function () {}, warn: function () {}, error: function () {}, info: function () {} };

const Core = require('../assets/nutrition-requirement-core.js');
global.window.NutritionRequirementCore = Core;
require('../assets/species-controller.js');
require('../assets/hill-labs-sample-types.js');
require('../assets/ammonium-acetate-methodology.js');
require('../assets/gaip-classification-constants.js');
const NPI = require('../assets/nutrition-program-inputs.js');
global.window.GAIP_NutritionProgramInputs = NPI;
const Balance = require('../assets/nutrient-balance-status.js');

global.console = _realConsole;

const FIX = JSON.parse(fs.readFileSync(
    path.join(__dirname, 'fixtures/gh415-burns-green4-k-above-ceiling.json'), 'utf8'));

const UNIT = FIX.inputs.bulkDensity * FIX.inputs.soilDepth * 0.1;

function ranges() {
    return NPI.resolveSufficiencyRanges({
        methodology: FIX.inputs.methodology,
        speciesDisplay: FIX.inputs.species,
        speciesKey: 'bentgrass',
        soilTexture: 'loam',
        CEC: null,
        pH: FIX.inputs.pH
    }).ranges;
}

function computed() {
    return Core.compute({
        soilValues: FIX.inputs.soilPpm,
        species: FIX.inputs.species,
        ph: FIX.inputs.pH,
        methodology: FIX.inputs.methodology,
        ranges: ranges(),
        tissuePercent: null,
        annualN: FIX.inputs.annualN,
        bulkDensity: FIX.inputs.bulkDensity,
        soilDepth: FIX.inputs.soilDepth,
        clippingManagement: FIX.inputs.clippingManagement,
        nutrients: ['P', 'K']
    });
}

function classifyK(delivered) {
    const r = ranges();
    const c = computed();
    return Balance.classify({
        nutrient: 'K',
        required: c.perSample.K.annualRequirement,
        delivered: delivered,
        currentPpm: FIX.inputs.soilPpm.K,
        removal: c.perSample.K.removal,
        range: { min: r.K.min, max: r.K.max },
        bulkDensity: FIX.inputs.bulkDensity,
        soilDepth: FIX.inputs.soilDepth,
        missingSoilData: false
    });
}

describe('GH-415 — Burns Green 4, the row the audit found', () => {
    test('the range really is narrower than the season removal — the precondition for the contradiction', () => {
        const r = ranges();
        expect(r.K.min).toBe(FIX.expected.ranges.K.min);
        expect(r.K.max).toBe(FIX.expected.ranges.K.max);
        expect((r.K.max - r.K.min) * UNIT).toBeLessThan(FIX.expected.removal.K);
    });

    test('K Required is 29.0 with intent maintain-floor, where it used to be a flat 0', () => {
        const c = computed();
        expect(c.perSample.K.annualRequirement).toBeCloseTo(FIX.expected.annualRequirement.K, 1);
        expect(c.perSample.K.intent).toBe(FIX.expected.intent.K);
        expect(c.perSample.K.status).toBe(FIX.expected.status.K);
        expect(c.perSample.K.correctionRequired).toBe(0);
    });

    test('P on the same sample is still 0 — a soil that CAN spare the removal is unchanged', () => {
        const c = computed();
        expect(c.perSample.P.annualRequirement).toBe(FIX.expected.annualRequirement.P);
        expect(c.perSample.P.intent).toBe(FIX.expected.intent.P);
    });

    test('the contradiction is gone by construction: delivering Required lands Balance on the floor', () => {
        const withNothing = classifyK(0);
        expect(withNothing.rangeDisplay).toBe(FIX.expected.balance.rangeKgHa);
        expect(withNothing.diff).toBeCloseTo(FIX.expected.balance.deliveredZero.balanceKgHa, 1);
        expect(withNothing.statusLabel).toBe(FIX.expected.balance.deliveredZero.statusLabel);

        const withRequired = classifyK(computed().perSample.K.annualRequirement);
        expect(withRequired.diff).toBeCloseTo(FIX.expected.balance.deliveredEqualsRequired.balanceKgHa, 1);
        expect(withRequired.statusLabel).toBe(FIX.expected.balance.deliveredEqualsRequired.statusLabel);
    });
});

describe('GH-415 — the identity that makes the two models agree', () => {
    // Required == 0  <=>  current - removal >= floor  <=>  Balance >= floor
    // (with Delivered >= 0). Swept rather than argued.
    const cases = [];
    for (let k = 56; k <= 120; k += 2) cases.push(k);

    test.each(cases)('MLSN K at %s ppm: a zero Required implies a Balance at or above the floor', (k) => {
        const r = ranges();
        const c = Core.compute({
            soilValues: { K: k }, species: FIX.inputs.species, ph: FIX.inputs.pH,
            methodology: FIX.inputs.methodology, ranges: r, tissuePercent: null,
            annualN: FIX.inputs.annualN, bulkDensity: FIX.inputs.bulkDensity,
            soilDepth: FIX.inputs.soilDepth, clippingManagement: FIX.inputs.clippingManagement,
            nutrients: ['K']
        }).perSample.K;
        const cls = Balance.classify({
            nutrient: 'K', required: c.annualRequirement, delivered: c.annualRequirement,
            currentPpm: k, removal: c.removal, range: { min: r.K.min, max: r.K.max },
            bulkDensity: FIX.inputs.bulkDensity, soilDepth: FIX.inputs.soilDepth, missingSoilData: false
        });
        // Delivering exactly what is asked never leaves a Deficit any more.
        expect(cls.statusClass).not.toBe('deficit');
        if (c.annualRequirement === 0) {
            expect(k * UNIT - c.removal).toBeGreaterThanOrEqual(r.K.min * UNIT - 1e-9);
        }
    });
});

describe('GH-415 — the same rule on all three methodologies, and B2 not taken', () => {
    test('a wide range still gives zero above the ceiling (SLAN K, band 141.4 kg/ha against removal 64)', () => {
        const r = NPI.resolveSufficiencyRanges({
            methodology: 'slan', speciesDisplay: FIX.inputs.species, speciesKey: 'bentgrass',
            soilTexture: 'loam', CEC: null, pH: 6.9
        }).ranges;
        const c = Core.compute({
            soilValues: { K: 200 }, species: FIX.inputs.species, ph: 6.9, methodology: 'slan',
            ranges: r, tissuePercent: null, annualN: FIX.inputs.annualN,
            bulkDensity: 1.4, soilDepth: 10, clippingManagement: 'collected', nutrients: ['K']
        }).perSample.K;
        expect(c.annualRequirement).toBe(0);
        expect(c.intent).toBe('suppress-above-ceiling');
    });

    test('inside the range nothing moved — Required is still removal only (B2 was not taken)', () => {
        const r = ranges();
        const c = Core.compute({
            soilValues: { K: 45 }, species: FIX.inputs.species, ph: FIX.inputs.pH,
            methodology: FIX.inputs.methodology, ranges: r, tissuePercent: null,
            annualN: FIX.inputs.annualN, bulkDensity: 1.4, soilDepth: 10,
            clippingManagement: 'collected', nutrients: ['K']
        }).perSample.K;
        expect(c.intent).toBe('removal-only');
        expect(c.annualRequirement).toBeCloseTo(c.removal, 5);
    });

    test('below the floor nothing moved either — removal plus this year\'s lift', () => {
        const r = ranges();
        const c = Core.compute({
            soilValues: { K: 20 }, species: FIX.inputs.species, ph: FIX.inputs.pH,
            methodology: FIX.inputs.methodology, ranges: r, tissuePercent: null,
            annualN: FIX.inputs.annualN, bulkDensity: 1.4, soilDepth: 10,
            clippingManagement: 'collected', nutrients: ['K']
        }).perSample.K;
        expect(c.intent).toBe('lift-to-floor');
        expect(c.annualRequirement).toBeCloseTo(c.removal + (37 - 20) * UNIT / 2, 1);
    });

    test('the D-8 boundary is unchanged: a reading exactly at the ceiling takes the above-ceiling branch', () => {
        const r = ranges();
        const c = Core.compute({
            soilValues: { K: r.K.max }, species: FIX.inputs.species, ph: FIX.inputs.pH,
            methodology: FIX.inputs.methodology, ranges: r, tissuePercent: null,
            annualN: FIX.inputs.annualN, bulkDensity: 1.4, soilDepth: 10,
            clippingManagement: 'collected', nutrients: ['K']
        }).perSample.K;
        expect(c.intent).toBe('maintain-floor');
        expect(c.annualRequirement).toBeCloseTo(c.removal - (r.K.max - r.K.min) * UNIT, 1);
    });

    test('the intent renderers already branch on keeps its meaning: it appears only where the figure is 0', () => {
        // word-export.js gates its tissue explanation, and the K reconciliation
        // table its no-need state, on 'suppress-above-ceiling' meaning "the
        // printed Required is zero". B1 must not quietly break that reading.
        const r = ranges();
        [0, 20, 45, 55.5, 62, 80, 200].forEach((k) => {
            const c = Core.compute({
                soilValues: { K: k }, species: FIX.inputs.species, ph: FIX.inputs.pH,
                methodology: FIX.inputs.methodology, ranges: r, tissuePercent: null,
                annualN: FIX.inputs.annualN, bulkDensity: 1.4, soilDepth: 10,
                clippingManagement: 'collected', nutrients: ['K']
            }).perSample.K;
            if (c.intent === 'suppress-above-ceiling') expect(c.annualRequirement).toBe(0);
            if (c.intent === 'maintain-floor') expect(c.annualRequirement).toBeGreaterThan(0);
        });
    });
});

describe('GH-415 — the client-facing explanation exists', () => {
    test('the Delivery Summary popover says why a soil above the ceiling can still ask for fertiliser', () => {
        const prebble = fs.readFileSync(
            path.join(__dirname, '../assets/nutrition-prebble-integration.js'), 'utf8');
        expect(prebble).toMatch(/above the ceiling, only what keeps the/);
    });

    test('the document caption says it too, and no longer claims Required is 0 above the ceiling', () => {
        const combined = fs.readFileSync(
            path.join(__dirname, '../assets/word-export-combined.js'), 'utf8');
        expect(combined).toMatch(/above ceiling, Required = whatever keeps the season from ending below/);
        expect(combined).not.toMatch(/above ceiling, Required = 0\./);
    });
});

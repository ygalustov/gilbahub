/**
 * GH-351 — nutrition-requirement-engine.js's AMMONIUM_ACETATE branch of
 * calculateNutrientRequirement() never set an `intent` field on any of its
 * three return shapes, unlike the SLAN branch (which sets
 * 'suppress-above-ceiling' / 'lift-to-floor' / 'removal-only').
 *
 * Downstream, word-export.js's _classifyKReconState() (and the b35fix331 ANR
 * table dagger marker in word-export-combined.js) both key off
 * r._anr.K.intent === 'removal-only' to distinguish "soil already sufficient,
 * this K req is pure clipping-removal replacement -- programme mining
 * reserves is fine" (state 'trend', amber) from "soil is genuinely deficient
 * and spot-K should have fired but didn't" (state 'advisory', red). Without
 * `intent`, every AA sample with a negative K balance rendered as the
 * alarming red 'advisory' state regardless of actual soil sufficiency.
 *
 * Confirmed live: an AA (Hill Labs S277) soccer sample with K=276ppm (well
 * within/above the sufficiency range) showed K req=100.0 (correct — pure
 * removal) but the K Reconciliation table's -94.0 balance rendered as red
 * "Advisory (~94 kg/ha), review N programme" instead of the correct amber
 * "Trend ... soil sufficient, programme replenishment recommended".
 *
 * FIX: AA branch now sets intent to the SLAN-equivalent value in all three
 * cases: 'suppress-above-ceiling' (at/above ceiling), 'lift-to-floor' (below
 * floor), 'removal-only' (within range / no aaRange available).
 */

'use strict';

global.window = global.window || {};
global.document = global.document || { addEventListener: function () {} };
global.console = { log: function () {}, warn: function () {}, error: function () {}, info: function () {} };

global.window.GilbaGrowthPotentialEngine = require('../assets/growth-potential-engine.js');
var Engine = require('../assets/nutrition-requirement-engine.js');

describe('GH-351 — AMMONIUM_ACETATE branch now sets intent (matches SLAN pattern)', function () {
    test('within range (Adequate) -> intent "removal-only", same semantics as SLAN\'s sufficiency band', function () {
        var result = Engine._calculateNutrientRequirement('K', 276, {
            methodology: 'AMMONIUM_ACETATE',
            species: 'perennialRyegrass',
            aaRange: { min: 58.7, max: 400 }
        });
        expect(result.status).toBe('Adequate');
        expect(result.intent).toBe('removal-only');
        expect(result.annualRequirement).toBeGreaterThan(0); // pure removal, not zero
    });

    test('at/above ceiling (High) -> intent "suppress-above-ceiling", matches SLAN\'s ceiling band', function () {
        var result = Engine._calculateNutrientRequirement('K', 250, {
            methodology: 'AMMONIUM_ACETATE',
            species: 'perennialRyegrass',
            aaRange: { min: 58.7, max: 195.7 }
        });
        expect(result.status).toBe('High');
        expect(result.intent).toBe('suppress-above-ceiling');
    });

    test('below floor (Low) -> intent "lift-to-floor", matches SLAN\'s deficit band', function () {
        var result = Engine._calculateNutrientRequirement('K', 30, {
            methodology: 'AMMONIUM_ACETATE',
            species: 'perennialRyegrass',
            aaRange: { min: 58.7, max: 195.7 }
        });
        expect(result.status).toBe('Low');
        expect(result.intent).toBe('lift-to-floor');
    });

    test('no aaRange available -> still "removal-only" (graceful-degradation path unchanged in shape, now also carries intent)', function () {
        var result = Engine._calculateNutrientRequirement('K', 100, {
            methodology: 'AMMONIUM_ACETATE',
            species: 'perennialRyegrass'
        });
        expect(result.status).toBe('Adequate');
        expect(result.intent).toBe('removal-only');
    });
});

describe('GH-351 — standalone reimplementation: K-recon classifier now reaches "trend" for a sufficient AA sample', function () {
    // Mirrors word-export.js's _classifyKReconState() decision path for the
    // negative-balance branch only (the part this bug actually affects).
    function classify(intent, balance) {
        if (balance == null || balance >= -10) return 'no';
        if (intent === 'removal-only') return 'trend';
        return 'advisory';
    }

    test('BEFORE (bug): intent undefined/null -> misclassified as advisory even though soil is sufficient', () => {
        expect(classify(null, -94)).toBe('advisory');
    });

    test('AFTER (fixed): intent "removal-only" (from the AA Adequate branch) -> correctly classified as trend', () => {
        expect(classify('removal-only', -94)).toBe('trend');
    });
});

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

    test('within a resolved range -> "removal-only", the verified sufficiency claim', function () {
        var result = Engine._calculateNutrientRequirement('K', 100, {
            methodology: 'AMMONIUM_ACETATE',
            species: 'perennialRyegrass',
            aaRange: { min: 58.7, max: 195.7 }
        });
        expect(result.status).toBe('Adequate');
        expect(result.intent).toBe('removal-only');
        expect(result.rangeResolved).toBe(true);
    });

    // GH-365: this case used to return plain 'removal-only' as well, which made
    // _classifyKReconState() print "soil sufficient, programme replenishment
    // recommended" to the client for a soil level that was never compared to
    // any range (uncovered species/texture, deriveCode() null, methodology
    // modules not loaded). The arithmetic is unchanged -- removal, no
    // correction, because there is nothing to correct against -- but the claim
    // is now distinguishable.
    test('GH-365: no aaRange available -> "removal-only-unverified", same arithmetic, no sufficiency claim', function () {
        var result = Engine._calculateNutrientRequirement('K', 100, {
            methodology: 'AMMONIUM_ACETATE',
            species: 'perennialRyegrass'
        });
        expect(result.status).toBe('Adequate');
        expect(result.intent).toBe('removal-only-unverified');
        expect(result.rangeResolved).toBe(false);
        expect(result.correctionRequired).toBe(0);
    });
});

describe('GH-365 — MLSN branch carries intent too (it is the default methodology)', function () {
    // Pre-GH-365 the MLSN return had no `intent` at all, so every MLSN site
    // fell through _classifyKReconState()'s "unknown intent" case and a
    // sufficient soil with a negative programme balance rendered red
    // "Advisory (~N kg/ha), review N programme". GH-351 fixed this for the AA
    // branches only.
    function mlsn(level) {
        return Engine._calculateNutrientRequirement('K', level, {
            methodology: 'MLSN',
            species: 'perennialRyegrass'
        });
    }

    test('a level inside the band -> "removal-only"', function () {
        var r = mlsn(45);
        expect(r.methodology).toBe('MLSN');
        expect(r.intent).toBe('removal-only');
    });

    test('a level below the threshold -> "lift-to-floor"', function () {
        var r = mlsn(5);
        expect(r.intent).toBe('lift-to-floor');
    });

    test('a level above target -> "suppress-above-ceiling", matching its own zeroed requirement', function () {
        var r = mlsn(500);
        expect(r.intent).toBe('suppress-above-ceiling');
        expect(r.annualRequirement).toBe(0);
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

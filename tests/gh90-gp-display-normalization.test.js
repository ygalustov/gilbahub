/**
 * GH90 — Growth Potential display discrepancy: dashboard 100% vs analysis 1%
 *
 * Root cause: climate-engine.js stores dailyPattern GP values as integer percentages
 * (Math.round(100 * fractional)). At 2.9°C, C3 GP ≈ 0.0079 → stored as integer 1.
 * Dashboard used `gpRaw > 1` to normalise, which fails at exactly 1: treats it as
 * fractional → Math.round(1 * 100) = 100% instead of 1%.
 * Fix: changed to `gpRaw >= 1` so integer 1 is treated as already-percentage.
 *
 * Test anchors:
 *   calculateWeightedGrowth(2.9, 1, 0).c3 ≈ 0.0079 (fractional, from PACE model)
 *   Math.round(100 * 0.0079) = 1 (what climate-engine.js stores in dailyPattern)
 *   normalise(1)  = 1   (>= 1 → Math.round, correct)
 *   normalise(1)  ≠ 100 (> 1  → * 100, the bug)
 */

global.window   = global.window   || {};
global.document = global.document || { addEventListener: function () {}, documentElement: {} };
global.console  = { group: function () {}, groupEnd: function () {}, groupCollapsed: function () {},
                    log: function () {}, warn: function () {}, info: function () {}, error: function () {} };

var gpEngine = require('../assets/growth-potential-engine.js');
global.window.GilbaGrowthPotentialEngine = gpEngine;

// climate-engine.js attaches functions to window.gaip_climate_*
require('../assets/climate-engine.js');
var calculateWeightedGrowth = global.window.gaip_climate_weighted_growth;
var GPE = global.window.GilbaGrowthPotentialEngine;

// =========================================================================
// 1. Verify the raw engine output at Russley GC winter temperature
// =========================================================================

describe('PACE C3 GP at 2.9°C (Russley GC, Christchurch NZ, July winter)', function () {

    test('C3 GP is well below 1% as fraction at 2.9°C', function () {
        var gp = GPE.compute(2.9, { species: 'c3' });
        expect(gp).toBeGreaterThan(0);
        expect(gp).toBeLessThan(0.02); // must be < 2% as fraction
    });

    test('calculateWeightedGrowth at 2.9°C pure C3 site produces fractional c3 < 0.02', function () {
        var r = calculateWeightedGrowth(2.9, 1, 0);
        expect(r.c3).toBeGreaterThan(0);
        expect(r.c3).toBeLessThan(0.02);
        expect(r.weighted).toBeCloseTo(r.c3, 3); // pure C3 site: weighted = c3
    });

    test('climate-engine.js stores GP as integer: Math.round(100 * c3) = 1 at 2.9°C', function () {
        // This is what calculateGrowthMetrics stores in dailyPattern[i].c3
        var r = calculateWeightedGrowth(2.9, 1, 0);
        var storedC3 = Math.round(100 * r.c3);
        expect(storedC3).toBe(1); // 1% as integer, NOT 100
    });
});

// =========================================================================
// 2. Normalisation rule — mirrors dashboard-init.js displayGP logic
// =========================================================================

// Fixed rule (dashboard-init.js after GH90 fix):
function normalizeFixed(v) {
    if (v == null) return null;
    return v >= 1 ? Math.round(v) : Math.round(v * 100);
}

// Buggy rule (dashboard-init.js before GH90 fix):
function normalizeBuggy(v) {
    if (v == null) return null;
    return v > 1 ? Math.round(v) : Math.round(v * 100);
}

describe('GP normalisation — fixed rule (>= 1)', function () {

    test('integer 1 (1% stored by climate-engine) → 1%, not 100%', function () {
        expect(normalizeFixed(1)).toBe(1);
    });

    test('integer 0 (dormant) → 0%', function () {
        expect(normalizeFixed(0)).toBe(0);
    });

    test('integer 45 (typical moderate GP) → 45%', function () {
        expect(normalizeFixed(45)).toBe(45);
    });

    test('integer 100 (optimal conditions) → 100%', function () {
        expect(normalizeFixed(100)).toBe(100);
    });

    test('fractional 0.45 (legacy format from old engine) → 45%', function () {
        expect(normalizeFixed(0.45)).toBe(45);
    });

    test('fractional 0.0079 (raw PACE output at 2.9°C) → 1%', function () {
        expect(normalizeFixed(0.0079)).toBe(1);
    });
});

describe('GP normalisation — buggy rule (> 1) reproduces the GH90 defect', function () {

    test('integer 1 → 100% (the bug: treats 1% integer as fractional 100%)', function () {
        expect(normalizeBuggy(1)).toBe(100); // demonstrates the bug
    });

    test('integer 45 → 45% (not affected by the bug)', function () {
        expect(normalizeBuggy(45)).toBe(45);
    });

    test('fractional 0.45 → 45% (not affected by the bug)', function () {
        expect(normalizeBuggy(0.45)).toBe(45);
    });
});

// =========================================================================
// 3. Dashboard vitals section — end-to-end scenario contract
// =========================================================================

describe('Dashboard GP vitals — Russley GC winter scenario (GH90)', function () {

    // Simulate what climate-engine.js produces for dailyPattern[0] at 2.9°C
    var dailyPatternEntry = (function () {
        var r = calculateWeightedGrowth(2.9, 1, 0); // pure C3
        return {
            temp:     2.9,
            weighted: Math.round(100 * r.weighted), // = 1
            c3:       Math.round(100 * r.c3),       // = 1
            c4:       Math.round(100 * r.c4),       // = 0
        };
    })();

    test('dailyPattern[0].c3 = 1 at 2.9°C (integer percentage, not fractional)', function () {
        expect(dailyPatternEntry.c3).toBe(1);
    });

    test('dashboard must display 1% for pure C3 site with gpRaw=1 (fixed rule)', function () {
        var gpRaw = dailyPatternEntry.weighted; // = 1
        var gp = normalizeFixed(gpRaw);
        expect(gp).toBe(1); // correct: 1% GP for frozen conditions
    });

    test('buggy rule would incorrectly display 100% for same data', function () {
        var gpRaw = dailyPatternEntry.weighted; // = 1
        var gp = normalizeBuggy(gpRaw);
        expect(gp).toBe(100); // confirms the defect that was reported
    });

    test('gpStatus is Low for 1% GP (gpColor threshold >= 40)', function () {
        var gp = normalizeFixed(dailyPatternEntry.weighted);
        var status = gp >= 70 ? 'High' : gp >= 40 ? 'Moderate' : 'Low';
        expect(status).toBe('Low');
    });
});

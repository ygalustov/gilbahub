/**
 * GH-361 (Hoxton audit v6, D07a) — computeProgram()'s removal-replacement
 * baseline derived P and K from N by a fixed, generic ratio
 * (CONFIG.nutrientRatiosToN: P 0.10, K 0.55 — a textbook "tissue ~0.4% P,
 * ~2% K vs 4% N" composition) even when a real tissue sample for that exact
 * site was on file. Confirmed on the Hoxton dataset (same soil/tissue
 * profile as this repo's own Test5-NZ / Soccer sample, sample id 144:
 * tissue N 4.57%, P 0.62%, K 1.05% per `docker exec gilba_mysql` — the
 * audit's own Hoxton tissue K reads 3.05%, evidently a different capture of
 * a similar site, but N and P match exactly): the generic ratios read P/N
 * 0.10 and K/N 0.55, while the real tissue ratio was P/N 0.136 — under-
 * reading P removal by roughly a third, exactly matching the audit's D07a
 * finding ("the model is under-reading K uptake and under-reading P uptake
 * by a third").
 *
 * FIX: collectFromState() (live Plan page) and word-export-combined.js's
 * per-sample overlay now both thread `inputs.tissuePercent` ({N, P, K})
 * through to computeProgram(). STEP 2's base-removal ratio uses
 * tissuePercent.P / tissuePercent.N and .K / .N instead of the generic
 * constant whenever a real tissue sample (N > 0, P and K present) exists.
 * Ca/Mg/S deliberately stay on the generic ratio — D07a explicitly scopes
 * the tissue gate to P and K only ("Ca and Mg are not in this chain at all
 * ... via the amendment path"). No tissue data (the common case) falls
 * through unchanged to the pre-GH-361 generic ratio — this is additive, not
 * a behaviour change for sites without a tissue sample.
 */

'use strict';

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
var NutritionCalendar = global.window.GilbaNutritionCalendar;

var MONTHLY_TEMPS_0_11 = [20, 20, 18, 15, 12, 9, 8, 9, 11, 14, 17, 19];

function baseInputs(overrides) {
    return Object.assign({
        annualNOverride: 200,
        traffic: 'moderate',
        // 'collected' keeps every clipping-management factor at 1.0, so
        // annual_removal below equals the STEP 2 base-removal ratio
        // directly, with nothing else in the pipeline muddying the numbers
        // this test is isolating.
        clippingManagement: 'collected',
        bulkDensity: 1.4,
        soilDepth: 10,
        // MLSN, and a K/P level safely inside any floor..ceiling band, so
        // the GH-300/319 ceiling zero-out never fires here — this test is
        // isolated to STEP 2's base-removal ratio, not the ceiling logic
        // GH-300's own test file already covers.
        methodology: 'mlsn',
        species: 'perennialRyegrass',
        speciesDisplay: 'Perennial Ryegrass',
        soilTexture: 'sand',
        isC4: false,
        distribution: 'gp_weighted',
        monthlyTemps: MONTHLY_TEMPS_0_11,
        soilPpm: { P: 20, K: 45, Ca: 400, Mg: 60, S: 20 },
    }, overrides);
}

describe('GH-361 — computeProgram() P/K removal ratio governed by real tissue when present', function () {
    test('no tissue sample -> unchanged generic ratio (P/N 0.10, K/N 0.55) and tissue_gate_applied false', function () {
        var program = NutritionCalendar.computeProgram(baseInputs());
        expect(program.error).toBeUndefined();
        expect(program.tissue_gate_applied).toBe(false);
        // annual_removal.P/K are pre-correction, so they isolate the ratio
        // cleanly: round(200 * 0.10) = 20, round(200 * 0.55) = 110.
        expect(program.annual_removal.P).toBe(20);
        expect(program.annual_removal.K).toBe(110);
    });

    test('a real tissue sample governs instead (Test5-NZ / Hoxton-profile tissue: N 4.57, P 0.62, K 1.05)', function () {
        var program = NutritionCalendar.computeProgram(baseInputs({
            tissuePercent: { N: 4.57, P: 0.62, K: 1.05 },
        }));
        expect(program.error).toBeUndefined();
        expect(program.tissue_gate_applied).toBe(true);
        // P/N = 0.62/4.57 = 0.1357..., K/N = 1.05/4.57 = 0.2298...
        expect(program.annual_removal.P).toBe(Math.round(200 * (0.62 / 4.57)));
        expect(program.annual_removal.K).toBe(Math.round(200 * (1.05 / 4.57)));
        // Concretely: real tissue removal is HIGHER for P (27 vs the generic
        // 20) and LOWER for K (46 vs the generic 110) than the textbook
        // ratio this site would otherwise have used — the exact
        // under/over-reading direction D07a describes.
        expect(program.annual_removal.P).toBe(27);
        expect(program.annual_removal.K).toBe(46);
    });

    test('Ca/Mg/S stay on the generic ratio even with a real tissue sample present (D07a scopes the gate to P/K only)', function () {
        var withoutTissue = NutritionCalendar.computeProgram(baseInputs());
        var withTissue = NutritionCalendar.computeProgram(baseInputs({
            tissuePercent: { N: 4.57, P: 0.62, K: 1.05 },
        }));
        expect(withTissue.annual_removal.Ca).toBe(withoutTissue.annual_removal.Ca);
        expect(withTissue.annual_removal.Mg).toBe(withoutTissue.annual_removal.Mg);
        expect(withTissue.annual_removal.S).toBe(withoutTissue.annual_removal.S);
    });

    test('a partial tissue sample (K missing) does not engage the gate -- avoids dividing by an incomplete reading', function () {
        var program = NutritionCalendar.computeProgram(baseInputs({
            tissuePercent: { N: 4.57, P: 0.62, K: null },
        }));
        expect(program.tissue_gate_applied).toBe(false);
        expect(program.annual_removal.P).toBe(20);
        expect(program.annual_removal.K).toBe(110);
    });

    test('tissue N of 0 does not engage the gate -- avoids a divide-by-zero ratio', function () {
        var program = NutritionCalendar.computeProgram(baseInputs({
            tissuePercent: { N: 0, P: 0.62, K: 1.05 },
        }));
        expect(program.tissue_gate_applied).toBe(false);
        expect(program.annual_removal.P).toBe(20);
        expect(program.annual_removal.K).toBe(110);
    });

    // ── GH-362: plausibility clamp on the derived ratio ──────────────────
    // Tissue macros can be entered in mg/kg as well as %, so a mixed-unit
    // sample produces a ratio three to four orders of magnitude too large.
    // Without a clamp that ratio goes straight into the removal figure.

    test('GH-362: P entered in mg/kg against N in % (ratio 1357) is rejected, generic ratio used', function () {
        var program = NutritionCalendar.computeProgram(baseInputs({
            tissuePercent: { N: 4.57, P: 6200, K: 1.05 },
        }));
        expect(program.tissue_gate_applied).toBe(false);
        expect(program.annual_removal.P).toBe(20);
        expect(program.annual_removal.K).toBe(110);
        // The unclamped bug would have produced ~271,000 kg P/ha here.
        expect(program.annual_removal.P).toBeLessThan(100);
    });

    test('GH-362: K entered in mg/kg against N in % is rejected, generic ratio used', function () {
        var program = NutritionCalendar.computeProgram(baseInputs({
            tissuePercent: { N: 4.57, P: 0.62, K: 10500 },
        }));
        expect(program.tissue_gate_applied).toBe(false);
        expect(program.annual_removal.K).toBe(110);
    });

    test('GH-362: an implausibly low ratio is rejected too (N in mg/kg against P/K in %)', function () {
        var program = NutritionCalendar.computeProgram(baseInputs({
            tissuePercent: { N: 45700, P: 0.62, K: 1.05 },
        }));
        expect(program.tissue_gate_applied).toBe(false);
        expect(program.annual_removal.P).toBe(20);
        expect(program.annual_removal.K).toBe(110);
    });

    test('GH-362: a real zero tissue reading does not engage the gate (would zero the requirement)', function () {
        var program = NutritionCalendar.computeProgram(baseInputs({
            tissuePercent: { N: 4.57, P: 0, K: 1.05 },
        }));
        expect(program.tissue_gate_applied).toBe(false);
        expect(program.annual_removal.P).toBe(20);
    });

    test('GH-362: the real Test5-NZ sample sits inside the plausibility band and still passes', function () {
        var program = NutritionCalendar.computeProgram(baseInputs({
            tissuePercent: { N: 4.57, P: 0.62, K: 1.05 },
        }));
        expect(program.tissue_gate_applied).toBe(true);
    });

    test('GH-362: the audit\'s own Hoxton tissue capture (K 3.05%, K/N 0.667) also passes the band', function () {
        var program = NutritionCalendar.computeProgram(baseInputs({
            tissuePercent: { N: 4.57, P: 0.62, K: 3.05 },
        }));
        expect(program.tissue_gate_applied).toBe(true);
        expect(program.annual_removal.K).toBe(Math.round(200 * (3.05 / 4.57)));
    });
});

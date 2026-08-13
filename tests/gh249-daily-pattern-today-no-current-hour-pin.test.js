/**
 * GH-249 — dailyPattern[0] ("today") must stay daily-mean based, like every
 * other day in the 8-day Growth & Temperature strip, not get pinned back to
 * a current-hour-based value.
 *
 * Background:
 *   GH-183 (2026-07-14) deliberately renamed the dashboard's "Current Growth
 *   Potential" card to "Today's Growth Potential" and rewrote its tooltip to
 *   cite the PACE agronomy model (Gelernter & Stowell 2005): "GP is a daily
 *   metric and must use the daily mean, not the current-hour temperature."
 *   That fix relied on calculateGrowthMetrics() (climate-engine.js) building
 *   dailyPattern entirely from _dailyRows — each day mapped to its own
 *   e.temp.mean — for all 8 days uniformly, including day 0.
 *
 *   GH-223 (2026-07-28), while fixing an unrelated DLI bug, bundled in a
 *   change to hub-persistence.js's cacheAnalysisResults() that pinned
 *   dailyPattern[0].weighted/c3/c4 back to _existingGrowth (climateMetrics.
 *   growth), which hub-tissue-v3.js's Climate V2 override computes from
 *   CURRENT-HOUR temperature (climate-module-v2.js calculateDroughtStress(),
 *   "FIX v10.9.5: use current hour temp, not multi-day mean" — a deliberate
 *   choice there, for drought/dormancy assessment, not for display). The
 *   pin's own comment justified this by claiming dailyPattern[0] was
 *   "freshly rebuilt from _todayMean" and could drift from a race-protected
 *   value — but calculateGrowthMetrics()'s dailyPattern never actually reads
 *   the todayMean parameter; only the function's separate top-level
 *   weighted/c3/c4/gdd summary fields do, and nothing reading dailyPattern[0]
 *   consumes those. The premise was mistaken.
 *
 *   Symptom: the "Growth & Temperature" panel's TODAY tile showed a GP value
 *   computed from a different (current-hour, often much warmer/cooler)
 *   temperature than the "12.9°C avg" label displayed right next to it,
 *   while every other day's tile was internally consistent (temp label and
 *   GP both from that day's forecast mean) — undoing GH-183 for day 0 only.
 *
 * Fix: removed the pin. dailyPattern (all 8 entries) is left exactly as
 * calculateGrowthMetrics() built it — uniformly daily-mean based.
 */

'use strict';

const fs = require('fs');
const path = require('path');

const src = fs.readFileSync(
    path.join(__dirname, '../assets/hub-persistence.js'),
    'utf8'
);

describe('GH-249 — hub-persistence.js no longer pins dailyPattern[0] to current-hour growth', () => {
    test('source file is present', () => {
        expect(src.length).toBeGreaterThan(0);
    });

    test('dailyPattern[0] is no longer reassigned/overwritten after being set from _growthFull', () => {
        // Pre-fix pattern that must not reappear:
        //   cache.computed.climate.growth.dailyPattern[0] = Object.assign({}, _growthFull.dailyPattern[0], { weighted: _existingGrowth.weighted, ... });
        expect(src).not.toMatch(/dailyPattern\[0\]\s*=\s*Object\.assign\(\{\},\s*_growthFull\.dailyPattern\[0\]/);
    });

    test('no leftover _pureC3/_pureC4 pin-only locals', () => {
        // These were only ever used inside the removed pin block — their
        // presence would mean the removal was incomplete.
        expect(src).not.toMatch(/_pureC3\s*=\s*_c4f\s*<\s*0\.05/);
        expect(src).not.toMatch(/_pureC4\s*=\s*_c3f\s*<\s*0\.05/);
    });

    test('dailyPattern is still assigned from _growthFull.dailyPattern wholesale (all 8 days, uniform source)', () => {
        var idx = src.indexOf('_existingGrowth');
        expect(idx).toBeGreaterThan(-1);
        var window_ = src.slice(idx, idx + 400);
        expect(window_).toMatch(/dailyPattern:\s*_growthFull\.dailyPattern/);
    });

    test('_growthFull is still built from calculateGrowthMetrics(_todayMean, _minimalState, _dailyRows)', () => {
        // Regression guard on the call itself — todayMean/minimalState/dailyRows
        // wiring is untouched by this fix, only the post-hoc pin was removed.
        expect(src).toMatch(
            /_growthFull\s*=\s*calculateGrowthMetrics\(\s*_todayMean\s*,\s*_minimalState\s*,\s*_dailyRows\s*\)/
        );
    });
});

// ─────────────────────────────────────────────────────────────────────────────
// Confirms the underlying claim the removed pin's comment got wrong:
// calculateGrowthMetrics()'s dailyPattern entries are independent of the
// function's first (todayMean) argument — each day maps from its own row in
// the dailyRows array, not from the passed-in single temperature.
// ─────────────────────────────────────────────────────────────────────────────

describe('GH-249 — calculateGrowthMetrics() dailyPattern independent of todayMean argument', () => {
    global.window = global.window || {};
    global.window.GilbaGrowthPotentialEngine = require('../assets/growth-potential-engine.js');

    // climate-engine.js is a plain concatenated-minified script with no
    // module.exports — evaluate it in this process so its top-level function
    // declarations (calculateGrowthMetrics, in particular) become callable.
    // Same technique already relied on implicitly by requiring files that
    // attach to `window` as a side effect (e.g. nutrition-calendar.js tests).
    const vm = require('vm');
    const engineSrc = fs.readFileSync(path.join(__dirname, '../assets/climate-engine.js'), 'utf8');
    const sandbox = { window: global.window, console: console };
    vm.createContext(sandbox);
    vm.runInContext(engineSrc + '\nthis.calculateGrowthMetrics = calculateGrowthMetrics;', sandbox);

    const dailyRows = [
        { date: '2026-08-13', temp: { mean: 12.9, min: 8.0, max: 17.0 } },
        { date: '2026-08-14', temp: { mean: 11.7, min: 7.0, max: 15.5 } },
    ];
    const state = { turf: { species: { c3Fraction: 0, c4Fraction: 1 } } }; // pure C4

    test('dailyPattern[0].temp/c4 match dailyRows[0], regardless of the todayMean argument passed in', () => {
        const withLowTodayMean = sandbox.calculateGrowthMetrics(11.7, state, dailyRows);
        const withHighTodayMean = sandbox.calculateGrowthMetrics(25.0, state, dailyRows);

        expect(withLowTodayMean.dailyPattern[0].temp).toBeCloseTo(12.9, 1);
        expect(withHighTodayMean.dailyPattern[0].temp).toBeCloseTo(12.9, 1);
        // Same dailyRows in both calls -> identical dailyPattern[0].c4,
        // even though the top-level todayMean argument differs wildly.
        expect(withLowTodayMean.dailyPattern[0].c4).toBe(withHighTodayMean.dailyPattern[0].c4);
    });

    test('dailyPattern[0] and dailyPattern[1] both derive from their own row (today is not special-cased)', () => {
        const result = sandbox.calculateGrowthMetrics(12.9, state, dailyRows);
        expect(result.dailyPattern[0].temp).toBeCloseTo(12.9, 1);
        expect(result.dailyPattern[1].temp).toBeCloseTo(11.7, 1);
        // 12.9 vs 11.7 for pure C4 (optimum 31, sigma 7) — small, monotonic
        // GP difference expected; NOT the huge current-hour-vs-daily-mean
        // jump the pre-fix bug produced.
        expect(result.dailyPattern[0].c4).toBeGreaterThanOrEqual(result.dailyPattern[1].c4);
        expect(result.dailyPattern[0].c4 - result.dailyPattern[1].c4).toBeLessThan(5);
    });

    test('the top-level (non-dailyPattern) weighted/c3/c4 DO use the todayMean argument — confirms it is a real, separate field', () => {
        const result = sandbox.calculateGrowthMetrics(31.0, state, dailyRows); // pure C4 optimum
        // At the C4 optimum, top-level c4 should be ~100, while dailyPattern[0]
        // (12.9°C, far from optimum) stays low — proving the two are independent.
        expect(result.c4).toBeGreaterThan(95);
        expect(result.dailyPattern[0].c4).toBeLessThan(20);
    });
});

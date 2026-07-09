/**
 * Brown Patch forecast — Fidanza E2 regression tests
 *
 * Verifies correctness after replacing the Gilba heuristic with BrownPatchModel
 * in disease-forecast.js (calcBrownPatchDaily now delegates to BrownPatchModel.calculate).
 *
 * Three things under test:
 *   1. BrownPatchModel returns biologically correct values:
 *      cold-humid (Tmin 7°C, RH 92%) ≈ 4%  — heuristic returned ~35–45%
 *      warm-humid (Tmin 26°C, RH 95%) > 60% — both models agree
 *   2. Forecast series (via generateForecastFallback) matches BrownPatchModel for identical inputs
 *   3. resolveBrownPatchModel() is window-undefined safe (Node / SaaS require path)
 */

global.window   = global.window   || {};
global.document = global.document || { addEventListener: () => {}, documentElement: {}, querySelector: () => null };
global.console  = { group: () => {}, groupEnd: () => {}, groupCollapsed: () => {}, log: () => {}, warn: () => {}, info: () => {}, error: () => {} };

const DiseaseEnginePure = require('../assets/disease-engine-pure.js');
const BrownPatchModel   = DiseaseEnginePure.models.brownPatch;

// Wire engine so generateForecast uses the main DiseaseEnginePure path
global.window.DiseaseEnginePure       = DiseaseEnginePure;
global.window.GILBA_USE_PURE_DISEASE  = true;

require('../assets/disease-forecast.js');
const DiseaseForecast = global.window.DiseaseForecast;

// ── helpers ──────────────────────────────────────────────────────────────────

// Climate shape for BrownPatchModel.calculate():
//   getFidanzaE2 reads temperature.min and moisture.humidity.mean
function makeModelClimate(minTempC, rhPercent) {
    return {
        temperature: { min: minTempC, max: minTempC + 10, mean: minTempC + 5 },
        moisture:    { humidity: { mean: rhPercent } },
    };
}

// State shape for DiseaseForecast.generateForecast():
//   temperature.dailyPattern drives buildDailyClimate
//   moisture.dailyPattern gives per-day humidity (avoids period-mean fallback)
function makeForecastState(minTempC, rhPercent, days, species) {
    days    = days    || 8;
    species = species || 'perennialRyegrass';
    var dailyPattern = [];
    for (var i = 0; i < days; i++) {
        var d = new Date(Date.now() + i * 86400000);
        dailyPattern.push({
            min:  minTempC,
            max:  minTempC + 10,
            mean: minTempC + 5,
            date: d.toISOString().slice(0, 10),
        });
    }
    return {
        climateMetrics: {
            temperature: {
                min: minTempC, max: minTempC + 10, mean: minTempC + 5,
                dailyPattern: dailyPattern,
            },
            moisture: {
                humidity:     { mean: rhPercent },
                dailyPattern: Array(days).fill({ humidity: rhPercent }),
            },
        },
        turf: { grassSpecies: species },
    };
}

// Pull the Brown Patch disease entry from a generateForecast result.
// Match by key only — waiteaPatch also has displayName "Brown Patch" so
// matching by name would produce a false hit.
function getBrownPatch(result) {
    if (!result || !Array.isArray(result.diseases)) return null;
    return result.diseases.find(function (x) { return x.key === 'brownPatch'; }) || null;
}

// Run generateForecast via the fallback path (no engine on window).
// calcBrownPatchDaily in the fallback calls resolveBrownPatchModel() which
// falls through to require('./disease-engine-pure') in Node — same Fidanza E2
// model, no taperMultiplier from analyse().
function runFallback(state) {
    var savedEngine = global.window.DiseaseEnginePure;
    var savedFlag   = global.window.GILBA_USE_PURE_DISEASE;
    delete global.window.DiseaseEnginePure;
    delete global.window.GILBA_USE_PURE_DISEASE;
    var result = DiseaseForecast.generateForecast(state);
    global.window.DiseaseEnginePure      = savedEngine;
    global.window.GILBA_USE_PURE_DISEASE = savedFlag;
    return result;
}

// ── Fidanza E2 arithmetic reference ──────────────────────────────────────────
// E2 = -21.5 + 0.15·RH + 1.4·T - 0.033·T²
// Tmin 7°C, RH 92%:  E2 = -21.5 + 13.8 + 9.8 - 1.617 = 0.483  (well below 6 threshold)
// Tmin 26°C, RH 95%: E2 = -21.5 + 14.25 + 36.4 - 22.308 = 6.842 (above 6 threshold → ≥67%)


// =============================================================================
// 1. BrownPatchModel direct — Fidanza E2 correctness
// =============================================================================

describe('BrownPatchModel — Fidanza E2 correctness', () => {

    test('cold-humid (Tmin 7°C, RH 92%): riskScore < 15 — biological temperature gate', () => {
        // E2 ≈ 0.48 → infectionRisk ≈ 4% — Rhizoctonia solani cannot infect at 7°C
        const result = BrownPatchModel.calculate(makeModelClimate(7, 92), { status: 'adequate' }, null, null);
        expect(result.riskScore).toBeLessThan(15);
        expect(result.fidanzaE2).toBeLessThan(6);
        expect(result.infectionFlag).toBe(false);
    });

    test('cold-humid: riskScore is approximately 4% (not ~40% as the old heuristic produced)', () => {
        const result = BrownPatchModel.calculate(makeModelClimate(7, 92), { status: 'adequate' }, null, null);
        // E2 = 0.483 → (0.483/4)*33 ≈ 3.98 → rounds to 4
        expect(result.riskScore).toBeGreaterThanOrEqual(1);
        expect(result.riskScore).toBeLessThanOrEqual(8);
    });

    test('warm-humid (Tmin 26°C, RH 95%): riskScore > 60 — above Fidanza warning threshold', () => {
        // E2 ≈ 6.84 → above threshold 6 → infectionRisk ≈ 81%
        const result = BrownPatchModel.calculate(makeModelClimate(26, 95), { status: 'adequate' }, null, null);
        expect(result.riskScore).toBeGreaterThan(60);
        expect(result.fidanzaE2).toBeGreaterThanOrEqual(6);
        expect(result.infectionFlag).toBe(true);
    });

    test('warm-humid: infectionFlag true and E2 above threshold', () => {
        const result = BrownPatchModel.calculate(makeModelClimate(26, 95), { status: 'adequate' }, null, null);
        expect(result.fidanzaE2).toBeGreaterThan(6);
        expect(result.fidanzaActionThreshold).toBe(6);
        expect(result.infectionFlag).toBe(true);
    });

    test('E2 boundary: at E2 ≈ 6 riskScore is 67', () => {
        // Tmin 22°C, RH 95%: E2 = -21.5 + 14.25 + 30.8 - 15.972 = 7.578 → well above 6
        // Tmin 14°C, RH 95%: E2 = -21.5 + 14.25 + 19.6 - 6.468 = 5.882 → just below 6 → ~49%
        const below = BrownPatchModel.calculate(makeModelClimate(14, 95), { status: 'adequate' }, null, null);
        const above = BrownPatchModel.calculate(makeModelClimate(22, 95), { status: 'adequate' }, null, null);
        expect(below.riskScore).toBeLessThan(67);
        expect(above.riskScore).toBeGreaterThanOrEqual(67);
    });

    test('nitrogen excessive amplifies riskScore (N_MODIFIERS_BROWN_PATCH[excessive] = 1.8)', () => {
        const adequate  = BrownPatchModel.calculate(makeModelClimate(24, 92), { status: 'adequate'  }, null, null);
        const excessive = BrownPatchModel.calculate(makeModelClimate(24, 92), { status: 'excessive' }, null, null);
        expect(excessive.riskScore).toBeGreaterThan(adequate.riskScore);
    });

    test('missing T → degraded path, riskScore 0', () => {
        const result = BrownPatchModel.calculate(
            { temperature: {}, moisture: { humidity: { mean: 92 } } },
            { status: 'adequate' }, null, null
        );
        expect(result.degraded).toBe(true);
        expect(result.riskScore).toBe(0);
    });

    test('missing RH → degraded path, riskScore 0', () => {
        const result = BrownPatchModel.calculate(
            { temperature: { min: 22 }, moisture: {} },
            { status: 'adequate' }, null, null
        );
        expect(result.degraded).toBe(true);
        expect(result.riskScore).toBe(0);
    });

    test('result includes required fields', () => {
        const result = BrownPatchModel.calculate(makeModelClimate(20, 90), { status: 'adequate' }, null, null);
        expect(result.disease).toBe('brownPatch');
        expect(result.displayName).toBe('Brown Patch');
        expect(typeof result.riskScore).toBe('number');
        expect(result.fidanzaE2).not.toBeNull();
        expect(result.fidanzaInputs).toBeDefined();
        expect(result.fidanzaInputs.minAirTemp).toBeCloseTo(20, 0);
    });
});


// =============================================================================
// 2. Forecast series — biological correctness via generateForecast
// =============================================================================

describe('DiseaseForecast — brown patch series biological correctness', () => {

    test('cold-humid week (Tmin 7°C, RH 92%): brown patch absent from forecast diseases', () => {
        // riskScore ≈ 4% per day → peakRisk < 15 filter removes it from diseases array
        // Tests via fallback path where calcBrownPatchDaily returns BrownPatchModel.riskScore
        const result = runFallback(makeForecastState(7, 92));
        expect(result.error).toBeUndefined();
        const bp = getBrownPatch(result);
        expect(bp).toBeNull();
    });

    test('warm-humid week (Tmin 26°C, RH 95%): brown patch present with all days > 60%', () => {
        const result = runFallback(makeForecastState(26, 95));
        expect(result.error).toBeUndefined();
        const bp = getBrownPatch(result);
        expect(bp).not.toBeNull();
        bp.forecast.forEach(function (f) {
            expect(f.risk).toBeGreaterThan(60);
        });
    });

    test('warm-humid: fallback day values equal BrownPatchModel.riskScore × perennialRyegrass suscept (1.2)', () => {
        // Fallback path: calcBrownPatchDaily → BrownPatchModel.calculate().riskScore → × suscept
        // No taperMultiplier (that's only in analyse()); arithmetic must be exact.
        const directResult = BrownPatchModel.calculate(makeModelClimate(26, 95), { status: 'adequate' }, null, null);
        const expected = Math.min(100, Math.round(directResult.riskScore * 1.2));

        const fcResult = runFallback(makeForecastState(26, 95));
        const bp = getBrownPatch(fcResult);
        expect(bp).not.toBeNull();
        bp.forecast.forEach(function (f) {
            expect(f.risk).toBe(expected);
        });
    });

    test('poaAnnua (suscept 1.0): fallback forecast day 0 exactly equals BrownPatchModel.riskScore', () => {
        // poaAnnua brownPatch susceptibility = 1.0 → no scaling → direct parity
        const directResult = BrownPatchModel.calculate(makeModelClimate(26, 95), { status: 'adequate' }, null, null);

        const fcResult = runFallback(makeForecastState(26, 95, 8, 'poaAnnua'));
        const bp = getBrownPatch(fcResult);
        expect(bp).not.toBeNull();
        expect(bp.forecast[0].risk).toBe(directResult.riskScore);
    });

    test('forecast result structure includes disease, name, forecast array', () => {
        const result = DiseaseForecast.generateForecast(makeForecastState(26, 95));
        const bp = getBrownPatch(result);
        expect(bp).not.toBeNull();
        expect(bp.key).toBe('brownPatch');
        expect(bp.name).toBe('Brown Patch');
        expect(Array.isArray(bp.forecast)).toBe(true);
        expect(bp.forecast.length).toBeGreaterThan(0);
        bp.forecast.forEach(function (f) {
            expect(typeof f.day).toBe('number');
            expect(typeof f.risk).toBe('number');
        });
    });
});


// =============================================================================
// 3. Node / SaaS safety — window-undefined path
// =============================================================================

describe('BrownPatchModel — window-undefined safety (Node / SaaS)', () => {

    test('BrownPatchModel.calculate() works without window or document defined', () => {
        // BrownPatchModel is a pure function: no window/document reads anywhere in
        // the Fidanza E2 path (disease-engine-pure.js lines 1132–1700).
        // Simulate a SaaS Node context by temporarily clearing window.
        var savedWindow = global.window;
        delete global.window;

        var result;
        expect(function () {
            result = BrownPatchModel.calculate(
                makeModelClimate(26, 95),
                { status: 'adequate' },
                null,
                null
            );
        }).not.toThrow();

        expect(result).toBeDefined();
        expect(result.riskScore).toBeGreaterThan(60);

        global.window = savedWindow;
    });

    test('BrownPatchModel cold-humid produces same result with and without window', () => {
        const withWindow = BrownPatchModel.calculate(makeModelClimate(7, 92), { status: 'adequate' }, null, null);

        var savedWindow = global.window;
        delete global.window;
        const withoutWindow = BrownPatchModel.calculate(makeModelClimate(7, 92), { status: 'adequate' }, null, null);
        global.window = savedWindow;

        expect(withoutWindow.riskScore).toBe(withWindow.riskScore);
        expect(withoutWindow.fidanzaE2).toBeCloseTo(withWindow.fidanzaE2, 3);
    });

    test('resolveBrownPatchModel falls back to require path when window.DiseaseEnginePure is absent', () => {
        // When window.DiseaseEnginePure is cleared, resolveBrownPatchModel() must
        // fall through to require('./disease-engine-pure').models.brownPatch and
        // return the same model — not null, not the old heuristic.
        var savedEngine = global.window.DiseaseEnginePure;
        delete global.window.DiseaseEnginePure;

        // generateForecastFallback is called when hasEngine is false.
        // calcBrownPatchDaily inside fallback calls resolveBrownPatchModel().
        // In Node, require() resolves disease-engine-pure from module cache.
        var result = DiseaseForecast.generateForecast(makeForecastState(26, 95));

        global.window.DiseaseEnginePure = savedEngine;

        // Result must still show brown patch with biologically correct values
        var bp = getBrownPatch(result);
        expect(bp).not.toBeNull();
        bp.forecast.forEach(function (f) {
            expect(f.risk).toBeGreaterThan(60);
        });
    });
});


// =============================================================================
// 4. Regression guards — disease-forecast.js source changes (b35fix84)
// =============================================================================

const fs   = require('fs');
const path = require('path');

describe('disease-forecast.js regression guards (b35fix84)', () => {
    let forecastSrc;

    beforeAll(function () {
        forecastSrc = fs.readFileSync(path.join(__dirname, '../assets/disease-forecast.js'), 'utf8');
    });

    test('brownPatch is absent from CONSECUTIVE_DAY_DISEASES (unvalidated multiplier removed)', function () {
        // Fidanza E2 regression already accounts for multi-day persistence through
        // its T and RH inputs. Stacking an additional consecutive-day multiplier on
        // top of the published model is unvalidated and would over-amplify risk.
        var m = forecastSrc.match(/var CONSECUTIVE_DAY_DISEASES\s*=\s*\{([\s\S]*?)\}/);
        expect(m).toBeTruthy();
        expect(m[1]).not.toMatch(/brownPatch/);
    });

    test('calcBrownPatchDaily has a null guard — returns 0 when model unavailable', function () {
        // Ensures the fallback path (model not on window, require fails) never
        // throws or returns a fabricated value. Regression: pre-fix code had no guard.
        expect(forecastSrc).toMatch(/if\s*\(\s*!bpModel\s*\|\|[\s\S]{0,80}?calculate[\s\S]{0,40}?\)\s*\{[\s\S]{0,20}?return\s+0/);
    });

    test('analyse() includes brownPatch with Fidanza-correct risk under warm-humid conditions', function () {
        // End-to-end check: analyse() must dispatch brownPatch and the result must
        // reflect the Fidanza E2 model (Tmin 26°C, RH 95% → E2 ≈ 6.84 → >60%).
        // This fails if the dispatcher is broken or the wrong model is wired in.
        var result = DiseaseEnginePure.analyse({
            climate: {
                temperature: { min: 26, max: 36, mean: 31 },
                moisture:    { humidity: { mean: 95 } },
            },
            species: 'perennialRyegrass',
            region:  'AU',
        });
        var bp = result.diseases.find(function (d) { return d.disease === 'brownPatch'; });
        expect(bp).toBeDefined();
        expect(bp.adjustedRisk).toBeGreaterThan(60);
        expect(bp.riskLevel).not.toBe('none');
    });

    test('analyse() brownPatch has near-zero risk under cold winter conditions (Fidanza gate)', function () {
        // Tmin 2°C, RH 92% → E2 = -5.03 → well below threshold 6 → riskScore 0.
        var result = DiseaseEnginePure.analyse({
            climate: {
                temperature: { min: 2, max: 8, mean: 5 },
                moisture:    { humidity: { mean: 92 }, precipitation: { total: 8 } },
            },
            species: 'perennialRyegrass',
            region:  'AU',
        });
        var bp = result.diseases.find(function (d) { return d.disease === 'brownPatch'; });
        // At 0% risk brownPatch may be absent from diseases[] or present with adjustedRisk 0
        if (bp) {
            expect(bp.adjustedRisk).toBeLessThan(10);
        }
    });
});

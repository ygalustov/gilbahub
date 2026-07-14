/**
 * Unit tests for getFidanzaE2 — Fidanza, Dernoeden & Grybauskas (1996)
 * brown patch warning model.
 *
 * These tests catch the GH-180 root cause at the algorithm level:
 *   When climate.temperature.min is null (GH-180 shim wrote null defaults),
 *   getFidanzaE2 returns { e2: null } → BrownPatchModel.calculate returns
 *   riskScore=0 → Brown Patch is absent from Active Threats.
 *
 *   After the fix (global.climateMetrics updated with recovered temperature),
 *   climate.temperature.min is a real value, e.g. 12°C NZ July →
 *   e2 = 2.548 → infectionRisk ≈ 21% → Brown Patch appears in Active Threats.
 *
 * Published equation (paper p388):
 *   E2 = -21.5 + 0.15·RH + 1.4·T - 0.033·T²
 *   where T = minimum daily air temp (°C), RH = mean daily relative humidity (%)
 *
 * Thresholds (paper p388 Discussion):
 *   E2 ≥ 6 → high risk (spray warning)
 *   E2 = 5 → moderate risk
 *   E2 ≤ 4 → low risk
 *   E2 ≤ 0 → no risk → riskScore = 0 → absent from Active Threats
 */

'use strict';

const fs   = require('fs');
const path = require('path');

const src = fs.readFileSync(
    path.join(__dirname, '../assets/disease-engine-pure.js'),
    'utf8'
);

// Extract a named function's full source by brace-counting.
function extractFunctionSrc(source, fnName) {
    var start = source.indexOf('function ' + fnName + '(');
    if (start === -1) return null;
    var depth = 0, begun = false;
    for (var i = start; i < source.length; i++) {
        if (source[i] === '{') { depth++; begun = true; }
        if (source[i] === '}') depth--;
        if (begun && depth === 0) return source.slice(start, i + 1);
    }
    return null;
}

// Eval the extracted source to produce a callable function.
// Both functions are pure (no globals, no DOM) so eval is safe here.
const getFidanzaE2            = eval('(' + extractFunctionSrc(src, 'getFidanzaE2') + ')');
const shouldCancelFidanzaWarning = eval('(' + extractFunctionSrc(src, 'shouldCancelFidanzaWarning') + ')');

// Helper: build a minimal climate object for getFidanzaE2.
// RH supplied via moisture.humidity.mean (period fallback path).
function climate(tempMin, rh) {
    return {
        temperature: { min: tempMin },
        moisture: { humidity: { mean: rh } },
    };
}

// =============================================================================
// 1. Null-input behaviour — root cause of GH-180 Active Threats miss
// =============================================================================

describe('getFidanzaE2 — null inputs (GH-180 scenario)', () => {

    test('returns e2=null when temperature.min is null', () => {
        const result = getFidanzaE2(climate(null, 80));
        expect(result.e2).toBeNull();
        expect(result.T).toBeNull();
    });

    test('returns e2=null when RH is null', () => {
        const result = getFidanzaE2({ temperature: { min: 20 }, moisture: { humidity: { mean: null } } });
        expect(result.e2).toBeNull();
        expect(result.RH).toBeNull();
    });

    test('returns e2=null when both inputs missing', () => {
        const result = getFidanzaE2({});
        expect(result.e2).toBeNull();
    });

    test('returns e2=null when climate is null', () => {
        const result = getFidanzaE2(null);
        expect(result.e2).toBeNull();
    });

    test('e2=null when T=null even when RH is available (Brown Patch absent from Active Threats)', () => {
        // GH-180 scenario: no hourlyData and temperature.min is null, RH is present.
        // The contract: T==null → e2=null → BrownPatchModel riskScore=0 → absent from Active Threats.
        const result = getFidanzaE2(climate(null, 80));
        expect(result.e2).toBeNull();
        expect(result.T).toBeNull();
        // RH IS found (80 from moisture.humidity.mean), but T alone gates the result
        expect(result.RH).toBe(80);
    });

});

// =============================================================================
// 2. Published equation (Fidanza et al. 1996 p388)
//    E2 = -21.5 + 0.15·RH + 1.4·T - 0.033·T²
// =============================================================================

describe('getFidanzaE2 — published equation correctness', () => {

    test('T=12, RH=80 → E2 ≈ 2.548 (NZ July: Brown Patch low-risk but present)', () => {
        // -21.5 + 0.15*80 + 1.4*12 - 0.033*144 = -21.5 + 12 + 16.8 - 4.752 = 2.548
        const result = getFidanzaE2(climate(12, 80));
        expect(result.e2).toBeCloseTo(2.548, 2);
        expect(result.T).toBe(12);
        expect(result.RH).toBe(80);
    });

    test('T=20, RH=85 → E2 ≈ 5.55 (moderate risk)', () => {
        // -21.5 + 0.15*85 + 1.4*20 - 0.033*400 = -21.5 + 12.75 + 28 - 13.2 = 6.05
        // Recalculate: -21.5 + 12.75 + 28 - 13.2 = 6.05
        const result = getFidanzaE2(climate(20, 85));
        expect(result.e2).toBeCloseTo(6.05, 2);
        expect(result.e2).toBeGreaterThanOrEqual(6); // high risk threshold
    });

    test('T=25, RH=90 → E2 > 6 (high risk — paper warning threshold)', () => {
        // -21.5 + 0.15*90 + 1.4*25 - 0.033*625 = -21.5 + 13.5 + 35 - 20.625 = 6.375
        const result = getFidanzaE2(climate(25, 90));
        expect(result.e2).toBeCloseTo(6.375, 2);
        expect(result.e2).toBeGreaterThanOrEqual(6);
    });

    test('T=5, RH=80 → E2 < 0 (winter: Brown Patch impossible)', () => {
        // -21.5 + 12 + 7 - 0.033*25 = -21.5 + 12 + 7 - 0.825 = -3.325
        const result = getFidanzaE2(climate(5, 80));
        expect(result.e2).toBeLessThan(0);
    });

    test('T=15, RH=75 → E2 ≈ 0.8 (low risk, near zero)', () => {
        // -21.5 + 11.25 + 21 - 0.033*225 = -21.5 + 11.25 + 21 - 7.425 = 3.325
        const result = getFidanzaE2(climate(15, 75));
        expect(result.e2).toBeCloseTo(3.325, 2);
        expect(result.e2).toBeGreaterThan(0); // positive → some risk
        expect(result.e2).toBeLessThan(6);    // below warning threshold
    });

});

// =============================================================================
// 3. T source priority — hourly day-0 min preferred over period min
// =============================================================================

describe('getFidanzaE2 — T source selection (day-0 hourly vs period min)', () => {

    test('prefers hourly day-0 min over climate.temperature.min', () => {
        // period min = 6°C (cold snap on day 5) → E2 < 0 → Brown Patch hidden
        // hourly day-0 min = 12°C → E2 = 2.548 → Brown Patch shown
        // Active Threats must use day-0, same as buildDailyPatternFallback.
        const c = {
            temperature: { min: 6 },
            moisture: { humidity: { mean: 80 } },
            hourlyData: {
                temperature_2m: Array(24).fill(12).concat(Array(120).fill(6)), // day 0=12, days 1-5=6
            },
        };
        const result = getFidanzaE2(c);
        expect(result.T).toBe(12);
        expect(result.tSource).toBe('hourly day-0 min');
        expect(result.e2).toBeCloseTo(2.548, 2);
    });

    test('falls back to climate.temperature.min when hourlyData is absent', () => {
        const result = getFidanzaE2(climate(12, 80));
        expect(result.T).toBe(12);
        expect(result.tSource).toBe('period min (fallback)');
    });

    test('day-0 slice is exactly first 24 values, not influenced by later hours', () => {
        const c = {
            temperature: { min: 5 },
            moisture: { humidity: { mean: 80 } },
            hourlyData: {
                temperature_2m: Array(24).fill(15).concat(Array(144).fill(3)),
            },
        };
        const result = getFidanzaE2(c);
        expect(result.T).toBe(15);
        expect(result.e2).toBeGreaterThan(0);
    });

    test('accepts climate-engine-v2 key names (temperature / humidity) — GH-180 Active Threats fix', () => {
        // climate-engine-v2.js stores hourlyData under keys 'temperature' and 'humidity'
        // (not Open-Meteo 'temperature_2m' / 'relative_humidity_2m').
        // getAuthoritativeClimate() copies climateMetrics.hourly verbatim, so the
        // disease engine receives the v2 key names. Without dual-key support,
        // getFidanzaE2 silently fell back to climate.temperature.min = 7-day global
        // minimum (e.g. 6°C cold-snap day), giving E2 ≤ 0 and hiding Brown Patch
        // from Active Threats even when today's 12°C NZ July conditions support it.
        const c = {
            temperature: { min: 6 },       // 7-day global min — cold snap day 5
            moisture: { humidity: { mean: 80 } },
            hourlyData: {
                temperature: Array(24).fill(12).concat(Array(120).fill(6)), // v2 key
                humidity:    Array(24).fill(80),                            // v2 key
            },
        };
        const result = getFidanzaE2(c);
        expect(result.T).toBe(12);
        expect(result.tSource).toBe('hourly day-0 min');
        expect(result.RH).toBeCloseTo(80, 1);
        expect(result.rhSource).toBe('hourly 24-h avg');
        expect(result.e2).toBeCloseTo(2.548, 2);
    });

});

// =============================================================================
// 5. RH source priority — hourly 24-h average preferred over period mean
// =============================================================================

describe('getFidanzaE2 — RH source selection', () => {

    test('hourly 24-h average preferred over moisture.humidity.mean', () => {
        const c = {
            temperature: { min: 20 },
            moisture: { humidity: { mean: 99 } }, // would give wrong RH if used
            hourlyData: {
                relative_humidity_2m: Array(24).fill(80), // 24-h avg = 80
            },
        };
        const result = getFidanzaE2(c);
        expect(result.RH).toBeCloseTo(80, 1);
        expect(result.rhSource).toBe('hourly 24-h avg');
    });

    test('falls back to moisture.humidity.mean when hourly array is absent', () => {
        const result = getFidanzaE2(climate(20, 75));
        expect(result.RH).toBe(75);
        expect(result.rhSource).toBe('period mean (fallback)');
    });

    test('falls back to humidity.mean (flat shape) when moisture wrapper absent', () => {
        const result = getFidanzaE2({ temperature: { min: 20 }, humidity: { mean: 75 } });
        expect(result.RH).toBe(75);
        expect(result.rhSource).toBe('period mean (fallback)');
    });

    test('uses only last 24 hours of hourly array (not the full array)', () => {
        // First 24 hours all 99%, last 24 hours all 80% — result should be 80%
        const arr = Array(24).fill(99).concat(Array(24).fill(80));
        const c = {
            temperature: { min: 20 },
            hourlyData: { relative_humidity_2m: arr },
        };
        const result = getFidanzaE2(c);
        expect(result.RH).toBeCloseTo(80, 1);
    });

});

// =============================================================================
// 6. Cancel rule — shouldCancelFidanzaWarning (paper p390)
// =============================================================================

describe('shouldCancelFidanzaWarning — paper p390 cancel rule', () => {

    test('returns false when nextDayMinTemp is null (rule cannot be evaluated)', () => {
        expect(shouldCancelFidanzaWarning(null)).toBe(false);
    });

    test('returns true when nextDayMinTemp < 15°C (cancel warning)', () => {
        expect(shouldCancelFidanzaWarning(14)).toBe(true);
        expect(shouldCancelFidanzaWarning(0)).toBe(true);
    });

    test('returns false when nextDayMinTemp >= 15°C (keep warning)', () => {
        expect(shouldCancelFidanzaWarning(15)).toBe(false);
        expect(shouldCancelFidanzaWarning(20)).toBe(false);
    });

});

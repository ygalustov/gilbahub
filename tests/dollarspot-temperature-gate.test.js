/**
 * Dollar Spot Temperature Gate Tests
 * Verifies that DollarSpotModel.calculate returns an inactive result when
 * 5-day MEANAT is outside the 10–35°C active range, regardless of RH.
 */

global.window = global.window || {};
global.document = global.document || { addEventListener: () => {}, documentElement: {} };
global.console = global.console || { group: () => {}, log: () => {}, groupEnd: () => {} };

const DiseaseEnginePure = require('../assets/disease-engine-pure.js');
const DollarSpotModel = DiseaseEnginePure.models.dollarSpot;

// Build a minimal climate object where 5-day MEANAT comes from dailyPattern
// (rung 1 of get5DayAvgTemp — the primary path used in production).
// meanRH comes from hourlyData.relative_humidity_2m (24 hourly entries).
function makeClimate(avgTempC, rhPercent) {
    const dailyPattern = Array(5).fill({ mean: avgTempC });
    const hourlyRH = Array(24).fill(rhPercent);
    const hourlyTime = Array.from({ length: 24 }, (_, i) => `2024-01-01T${String(i).padStart(2,'0')}:00`);
    return {
        temperature: {
            mean: avgTempC, min: avgTempC - 3, max: avgTempC + 3,
            dailyPattern,
        },
        moisture: { humidity: { mean: rhPercent }, precipitation: { total: 0 } },
        hourlyData: {
            relative_humidity_2m: hourlyRH,
            temperature_2m: Array(24).fill(avgTempC),
            time: hourlyTime,
        },
    };
}

describe('DollarSpotModel temperature gate (10–35°C)', () => {

    // --- GATE FIRES: below 10°C ---

    test('returns inactive at 5°C even with RH 98%', () => {
        const result = DollarSpotModel.calculate(makeClimate(5, 98), null, null, null, null);
        expect(result.inactive).toBe(true);
        expect(result.actionRequired).toBe(false);
        expect(result.riskScore).toBe(0);
        expect(result.riskLevel).toBe('none');
        expect(result.inactiveReason).toMatch(/below the 10°C minimum/);
    });

    test('returns inactive at 9.9°C (just below boundary)', () => {
        const result = DollarSpotModel.calculate(makeClimate(9.9, 95), null, null, null, null);
        expect(result.inactive).toBe(true);
        expect(result.actionRequired).toBe(false);
        expect(result.riskScore).toBe(0);
    });

    test('suppressedProbability is numeric when gate fires at cold temp with high RH', () => {
        const result = DollarSpotModel.calculate(makeClimate(5, 98), null, null, null, null);
        // SK logistic with MEANAT=5, MEANRH=98: logit = -11.4041 + 0.0894*98 + 0.1932*5
        // = -11.4041 + 8.7612 + 0.966 = -1.6769 → prob ≈ 15.7%
        expect(result.suppressedProbability).not.toBeNull();
        expect(result.suppressedProbability).toBeGreaterThan(0);
    });

    // --- GATE FIRES: above 35°C ---

    test('returns inactive at 38°C even with RH 90%', () => {
        const result = DollarSpotModel.calculate(makeClimate(38, 90), null, null, null, null);
        expect(result.inactive).toBe(true);
        expect(result.actionRequired).toBe(false);
        expect(result.riskScore).toBe(0);
        expect(result.riskLevel).toBe('none');
        expect(result.inactiveReason).toMatch(/exceeds the 35°C maximum/);
    });

    test('returns inactive at 35.1°C (just above boundary)', () => {
        const result = DollarSpotModel.calculate(makeClimate(35.1, 85), null, null, null, null);
        expect(result.inactive).toBe(true);
        expect(result.actionRequired).toBe(false);
    });

    // --- GATE DOES NOT FIRE: inside active range ---

    test('returns active result at 10.0°C (lower boundary, inclusive)', () => {
        const result = DollarSpotModel.calculate(makeClimate(10, 80), null, null, null, null);
        expect(result.inactive).toBeFalsy();
        expect(result.disease).toBe('dollarSpot');
        expect(typeof result.riskScore).toBe('number');
    });

    test('returns active result at 35.0°C (upper boundary, inclusive)', () => {
        const result = DollarSpotModel.calculate(makeClimate(35, 80), null, null, null, null);
        expect(result.inactive).toBeFalsy();
        expect(result.disease).toBe('dollarSpot');
    });

    test('returns active result at typical NZ summer temp 20°C', () => {
        const result = DollarSpotModel.calculate(makeClimate(20, 82), null, null, null, null);
        expect(result.inactive).toBeFalsy();
        expect(result.smithKernsProbability).not.toBeNull();
        expect(result.riskScore).toBeGreaterThanOrEqual(0);
    });

    // --- Inactive result structure ---

    test('inactive result includes required diagnostic fields', () => {
        const result = DollarSpotModel.calculate(makeClimate(5, 98), null, null, null, null);
        expect(result.disease).toBe('dollarSpot');
        expect(result.displayName).toBe('Dollar Spot');
        expect(result.smithKernsActionThreshold).toBe(20);
        expect(result.drivers).toBeDefined();
        expect(result.drivers.temperature.value).toBeCloseTo(5, 0);
        expect(result.source).toMatch(/Smith-Kerns/);
    });

    test('suppressedProbability is null when gate fires but SK inputs missing', () => {
        // No RH data → SK returns null, but gate still fires on temp
        const minimalClimate = {
            temperature: { dailyPattern: Array(5).fill({ mean: 5 }) },
            moisture: {},
        };
        const result = DollarSpotModel.calculate(minimalClimate, null, null, null, null);
        expect(result.inactive).toBe(true);
        expect(result.suppressedProbability).toBeNull();
    });

    // --- Forecast per-day calls: no temperature data ---

    test('returns riskScore 0 when no temperature data at all (forecast day with only RH)', () => {
        // Simulates disease-forecast.js per-day call: hourly RH is populated but
        // the per-day climate object has no temperature fields (min/max/mean/current/dailyPattern).
        // avg5Day falls back to 20°C but avg5DayIsReal is false — should not produce
        // a false positive from the degraded path.
        const forecastDayClimate = {
            temperature: {},  // no min/max/mean/current/dailyPattern
            moisture: { humidity: { mean: 85 } },
            hourlyData: {
                relative_humidity_2m: Array(24).fill(85),
                temperature_2m: Array(24).fill(null),
                time: Array.from({ length: 24 }, (_, i) => `2024-07-01T${String(i).padStart(2,'0')}:00`),
            },
        };
        const result = DollarSpotModel.calculate(forecastDayClimate, null, null, null, null);
        expect(result.riskScore).toBe(0);
        expect(result.inactive).toBeFalsy();   // not inactive — just 0 from degraded path
        expect(result.degraded).toBe(true);
    });

    test('degraded path with real temperature still computes non-zero risk in active range', () => {
        // When temperature is real (e.g. from max/min) but RH is unavailable, the
        // degraded path should still produce a risk estimate (not zero).
        const climate = {
            temperature: { min: 16, max: 26 },  // real data, avg5Day = 21°C
            moisture: {},  // no RH → SK returns null → degraded path
        };
        const result = DollarSpotModel.calculate(climate, null, null, null, null);
        expect(result.degraded).toBe(true);
        expect(result.riskScore).toBeGreaterThan(0);
    });
});

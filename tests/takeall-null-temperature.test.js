/**
 * Take-all Patch — null temperature fallback tests
 *
 * When a forecast per-day call supplies no air temperature (climate.temperature.mean = null),
 * TakeAllModel currently falls back to airTemp = 15°C — the Gaussian optimum — and returns
 * a falsely inflated riskScore (up to 100%). The fix must zero out soilTempFactor when no
 * real temperature data is available (same pattern as the Dollar Spot avg5DayIsReal guard).
 */

global.window   = global.window   || {};
global.document = global.document || { addEventListener: () => {}, documentElement: {} };
global.console  = global.console  || { group: () => {}, log: () => {}, groupEnd: () => {} };

const DiseaseEnginePure = require('../assets/disease-engine-pure.js');
const TakeAllModel = DiseaseEnginePure.models.takeAll;

// ── helpers ────────────────────────────────────────────────────────────────

// Climate with known real air temperature, no direct soil temp
function makeClimateAir(meanTempC) {
    return {
        temperature: { mean: meanTempC, min: meanTempC - 3, max: meanTempC + 3 },
        moisture: { soilMoisture: { mean: 0.30 } },
    };
}

// Climate with null temperature — simulates disease-forecast.js per-day call
// where dayClimate.mean is null and no temperature fields are populated
const NULL_TEMP_CLIMATE = {
    temperature: {},    // no mean / min / max / current
    moisture: { soilMoisture: { mean: 0.30 } },
};

// Climate with direct soilTemp injection (highest-priority path)
function makeClimateWithSoilTemp(soilTempC) {
    return {
        temperature: {},    // no air temp
        soilTemp: { depths: { d100mm: soilTempC }, source: 'measured', mean: soilTempC },
        moisture: { soilMoisture: { mean: 0.30 } },
    };
}

describe('TakeAllModel — null air temperature (forecast per-day call)', () => {

    // ── DEGRADED PATH: no temperature data ────────────────────────────────

    test('null temperature: result is marked degraded', () => {
        const result = TakeAllModel.calculate(NULL_TEMP_CLIMATE, null, null);
        expect(result.degraded).toBe(true);
    });

    test('null temperature: soilTempFactor contribution is 0 (not inflated by 15°C fallback)', () => {
        const result = TakeAllModel.calculate(NULL_TEMP_CLIMATE, null, null);
        // soilTemperature.contribution must be 0 — the model must not inject 15°C
        expect(result.drivers.soilTemperature.contribution).toBe(0);
    });

    test('null temperature: riskScore does not include soilTempFactor (no false 100% spike)', () => {
        // With defaults (pH=6.5 → phFactor=0, Mn=10 → mnFactor≈33, soilMoisture=0.3 → moistureFactor=0)
        // and soilTempFactor=0, max riskScore = 0.30 * 0.33 * 100 ≈ 10.
        // Currently the bug returns ~100% because soilTemp is set to 15°C.
        const result = TakeAllModel.calculate(NULL_TEMP_CLIMATE, null, null);
        expect(result.riskScore).toBeLessThan(25);
    });

    // ── NORMAL PATH: real air temperature ─────────────────────────────────

    test('real temperature at optimal 15°C: not degraded, soilTempFactor > 0', () => {
        const result = TakeAllModel.calculate(makeClimateAir(15), null, null);
        expect(result.degraded).toBeFalsy();
        expect(result.drivers.soilTemperature.contribution).toBeGreaterThan(0);
    });

    test('real temperature at 20°C (near optimal): not degraded', () => {
        const result = TakeAllModel.calculate(makeClimateAir(20), null, null);
        expect(result.degraded).toBeFalsy();
        expect(result.disease).toBe('takeAll');
    });

    test('real temperature outside active range (25°C): soilTempFactor = 0, not degraded', () => {
        // Above 22°C soilTempFactor = 0 by the Gaussian curve (active 8-22°C).
        // Not degraded — we have real data, it just shows no temperature risk.
        const result = TakeAllModel.calculate(makeClimateAir(25), null, null);
        expect(result.degraded).toBeFalsy();
        expect(result.drivers.soilTemperature.contribution).toBe(0);
    });

    test('real temperature below active range (5°C): soilTempFactor = 0, not degraded', () => {
        const result = TakeAllModel.calculate(makeClimateAir(5), null, null);
        expect(result.degraded).toBeFalsy();
        expect(result.drivers.soilTemperature.contribution).toBe(0);
    });

    // ── DIRECT SOIL TEMP PATH: overrides air temp entirely ────────────────

    test('direct soilTemp injection at 15°C: soilTempFactor = 1.0 regardless of null air temp', () => {
        // When orchestrator injects real soil temp, it should take priority
        // and NOT be treated as degraded (measured soil temp is more accurate than air).
        const result = TakeAllModel.calculate(makeClimateWithSoilTemp(15), null, null);
        expect(result.degraded).toBeFalsy();
        expect(result.drivers.soilTemperature.contribution).toBeGreaterThan(90);
    });

    test('direct soilTemp outside active range: soilTempFactor = 0, not degraded', () => {
        const result = TakeAllModel.calculate(makeClimateWithSoilTemp(25), null, null);
        expect(result.degraded).toBeFalsy();
        expect(result.drivers.soilTemperature.contribution).toBe(0);
    });

    // ── RESULT STRUCTURE ──────────────────────────────────────────────────

    test('degraded result still includes all required fields', () => {
        const result = TakeAllModel.calculate(NULL_TEMP_CLIMATE, null, null);
        expect(result.disease).toBe('takeAll');
        expect(result.displayName).toBe('Take-all Patch');
        expect(typeof result.riskScore).toBe('number');
        expect(result.drivers).toBeDefined();
        expect(result.drivers.soilTemperature).toBeDefined();
    });
});

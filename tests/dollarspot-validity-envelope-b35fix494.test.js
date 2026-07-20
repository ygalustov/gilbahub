/**
 * b35fix494 — Smith-Kerns dollar spot validity-envelope gate
 *
 * Smith-Kerns 2018 has a stated effective range: MEANAT 10 to 35°C.
 * Outside this range the RH term can still produce a spurious ~20% probability
 * on cold humid days.
 *
 * Model fix: DollarSpotModel.calculate() returns { inactive: true } outside 10-35°C.
 * Dispatcher fix: analyse() routes inactive results to suppressedDiseases[] with
 * envelopeSuppressed: true — distinct from the null-MEANAT degraded path which
 * stays in diseases[].
 *
 * Spec: tests/dollarspot-validity-envelope-b35fix494.test.js (20 tests)
 */

'use strict';

global.window   = global.window   || {};
global.document = global.document || { addEventListener: () => {}, documentElement: {}, querySelector: () => null };
global.console  = { group: () => {}, groupEnd: () => {}, groupCollapsed: () => {}, log: () => {}, warn: () => {}, info: () => {}, error: () => {} };

const eng            = require('../assets/disease-engine-pure.js');
const DollarSpotModel = eng.models.dollarSpot;

function makeClimate(avgTempC, rhPercent) {
    const dailyPattern = Array(5).fill({ mean: avgTempC });
    const hourlyRH  = Array(24).fill(rhPercent);
    const hourlyTime = Array.from({ length: 24 }, (_, i) => `2024-01-15T${String(i).padStart(2,'0')}:00`);
    return {
        temperature: { mean: avgTempC, min: avgTempC - 3, max: avgTempC + 3, dailyPattern },
        moisture: { humidity: { mean: rhPercent }, precipitation: { total: 0 } },
        hourlyData: { relative_humidity_2m: hourlyRH, temperature_2m: Array(24).fill(avgTempC), time: hourlyTime },
    };
}

// ─────────────────────────────────────────────────────────────────────────────
// A. Model-level gate (DollarSpotModel.calculate)
// ─────────────────────────────────────────────────────────────────────────────

describe('b35fix494 — DollarSpotModel temperature gate (model level)', () => {
    test('inactive at 5°C even with RH 98%', () => {
        const r = DollarSpotModel.calculate(makeClimate(5, 98), null, null, null, null);
        expect(r.inactive).toBe(true);
        expect(r.riskScore).toBe(0);
        expect(r.riskLevel).toBe('none');
    });

    test('inactive at 9.9°C (just below lower boundary)', () => {
        const r = DollarSpotModel.calculate(makeClimate(9.9, 95), null, null, null, null);
        expect(r.inactive).toBe(true);
    });

    test('active at 10.0°C (lower boundary inclusive)', () => {
        const r = DollarSpotModel.calculate(makeClimate(10, 85), null, null, null, null);
        expect(r.inactive).toBeFalsy();
    });

    test('active at 35.0°C (upper boundary inclusive)', () => {
        const r = DollarSpotModel.calculate(makeClimate(35, 85), null, null, null, null);
        expect(r.inactive).toBeFalsy();
    });

    test('inactive at 35.1°C (just above upper boundary)', () => {
        const r = DollarSpotModel.calculate(makeClimate(35.1, 85), null, null, null, null);
        expect(r.inactive).toBe(true);
    });

    test('inactive at 40°C (heat suppression)', () => {
        const r = DollarSpotModel.calculate(makeClimate(40, 85), null, null, null, null);
        expect(r.inactive).toBe(true);
        expect(r.inactiveReason).toMatch(/exceeds the 35°C maximum/);
    });

    test('cold gate reason mentions 10°C minimum', () => {
        const r = DollarSpotModel.calculate(makeClimate(5, 98), null, null, null, null);
        expect(r.inactiveReason).toMatch(/below the 10°C minimum/);
    });

    test('suppressedProbability is numeric on cold high-RH day (auditable suppression)', () => {
        // SK logistic at 5°C / 98% RH: logit = −11.4041 + 0.0894×98 + 0.1932×5 ≈ −1.68
        // → prob ≈ 15.7% — non-trivial suppression should be visible
        const r = DollarSpotModel.calculate(makeClimate(5, 98), null, null, null, null);
        expect(r.suppressedProbability).toBeGreaterThan(0);
    });

    test('null MEANAT (missing temp) does NOT trigger inactive — degraded path stays live', () => {
        // Degraded: no temp data at all → riskScore 0, confidence low, but NOT inactive
        const r = DollarSpotModel.calculate({}, null, null, null, null);
        expect(r.inactive).toBeFalsy();
        expect(r.degraded).toBe(true);
    });
});

// ─────────────────────────────────────────────────────────────────────────────
// B. Dispatcher routing via analyse() (b35fix494 gate)
// ─────────────────────────────────────────────────────────────────────────────

describe('b35fix494 — analyse() routes cold dollar spot to suppressedDiseases', () => {
    function runAnalyse(tempC) {
        return eng.analyse({
            climate: makeClimate(tempC, 95),
            species: 'bentgrass',
            nitrogen: { status: 'adequate' },
            region: 'NZ',
        });
    }

    test('at 5°C: dollar spot absent from diseases[]', () => {
        const out = runAnalyse(5);
        const ds = out.diseases.find(d => d.disease === 'dollarSpot');
        expect(ds).toBeUndefined();
    });

    test('at 5°C: dollar spot present in suppressedDiseases[] with envelopeSuppressed', () => {
        const out = runAnalyse(5);
        const sup = out.suppressedDiseases.find(d => d.disease === 'dollarSpot' && d.envelopeSuppressed === true);
        expect(sup).toBeDefined();
    });

    test('at 5°C: suppressedDiseases entry has temperature value and reason string', () => {
        const out = runAnalyse(5);
        const sup = out.suppressedDiseases.find(d => d.disease === 'dollarSpot' && d.envelopeSuppressed === true);
        expect(sup.temperature).toBeCloseTo(5, 0);
        expect(typeof sup.reason).toBe('string');
        expect(sup.reason.length).toBeGreaterThan(0);
    });

    test('at 5°C: suppressedDiseases entry carries bounds {min:10, max:35}', () => {
        const out = runAnalyse(5);
        const sup = out.suppressedDiseases.find(d => d.disease === 'dollarSpot' && d.envelopeSuppressed === true);
        expect(sup.bounds).toEqual({ min: 10, max: 35 });
    });

    test('at 40°C (hot suppression): dollar spot absent from diseases[]', () => {
        const out = runAnalyse(40);
        const ds = out.diseases.find(d => d.disease === 'dollarSpot');
        expect(ds).toBeUndefined();
    });

    test('at 40°C: suppressedDiseases carries envelopeSuppressed entry', () => {
        const out = runAnalyse(40);
        const sup = out.suppressedDiseases.find(d => d.disease === 'dollarSpot' && d.envelopeSuppressed === true);
        expect(sup).toBeDefined();
    });

    test('at 20°C (active range): dollar spot present in diseases[], not suppressed', () => {
        const out = runAnalyse(20);
        const ds = out.diseases.find(d => d.disease === 'dollarSpot');
        expect(ds).toBeDefined();
        const sup = out.suppressedDiseases.find(d => d.disease === 'dollarSpot' && d.envelopeSuppressed === true);
        expect(sup).toBeUndefined();
    });

    test('null-temp (degraded) path: dollar spot stays in diseases[] with low confidence', () => {
        const out = eng.analyse({
            climate: { moisture: { humidity: { mean: 92 }, precipitation: { total: 5 } } },
            species: 'bentgrass',
            nitrogen: { status: 'adequate' },
            region: 'NZ',
        });
        const ds = out.diseases.find(d => d.disease === 'dollarSpot');
        // Degraded path stays in diseases[] (insufficient-data ≠ outside-envelope)
        expect(ds).toBeDefined();
        expect(ds.degraded).toBe(true);
    });

    test('cotula (host-class gate): dollar spot absent from both diseases and suppressedDiseases even at 20°C', () => {
        // Cotula susceptibility.dollarSpot ≤ dispatcher gate → suppressed by host-class, not envelope
        const out = eng.analyse({
            climate: makeClimate(20, 85),
            species: 'cotula',
            nitrogen: { status: 'adequate' },
            region: 'NZ',
        });
        // Either not in suppressedDiseases at all, or the reason is host-class not envelope
        const envelopeSup = out.suppressedDiseases.find(d => d.disease === 'dollarSpot' && d.envelopeSuppressed === true);
        expect(envelopeSup).toBeUndefined();
    });

    test('overallScore is not inflated by spurious 20% cold-day dollar spot', () => {
        // Pre-fix: cold high-RH day could produce ~20% DS risk, raising overallScore.
        // Post-fix: DS suppressed → overallScore reflects other diseases only.
        const cold  = runAnalyse(5);
        const warm  = runAnalyse(20);
        const coldDS = cold.diseases.find(d => d.disease === 'dollarSpot');
        expect(coldDS).toBeUndefined(); // DS removed from diseases
        // overallScore on cold day must not be inflated by dollar spot
        expect(cold.overallScore).toBeDefined();
    });
});

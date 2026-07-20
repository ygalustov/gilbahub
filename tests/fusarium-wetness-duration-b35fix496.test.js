/**
 * b35fix496 — Fusarium moisture: period-mean → wetness duration
 *
 * Pre-fix: moistureFactor derived from climate.moisture.humidity.mean on a
 * stepped ladder (>90→1, >80→0.6, else→0.2). Correct driver for Microdochium
 * is wetness DURATION, not a mean (Mattox et al. 2023: RH ≥90% for 20+ hours).
 *
 * Fix: FusariumModel.calculate() gains dewData as 4th arg. When a real
 * leaf-wetness signal exists, moistureFactor = min(1, lwHours/10). Falls back
 * to the prior humidity/precip ladder when no wetness signal available.
 * Confidence stays at moderate/60 (shared convention, not a validated cutpoint).
 *
 * Spec: tests/fusarium-wetness-duration-b35fix496.test.js (16 tests)
 */

'use strict';

global.window   = global.window   || {};
global.document = global.document || { addEventListener: () => {}, documentElement: {}, querySelector: () => null };
global.console  = { group: () => {}, groupEnd: () => {}, groupCollapsed: () => {}, log: () => {}, warn: () => {}, info: () => {}, error: () => {} };

const eng = require('../assets/disease-engine-pure.js');
const FM  = eng.models.fusarium;

const BASE_CLIMATE = {
    temperature: { mean: 8, min: 4, max: 12 },
    moisture: { humidity: { mean: 75 } },
    precipitation: { total: 3 },
};

function dewWith(hours) {
    return { leafWetness: { averageWetHours: hours } };
}

// ─────────────────────────────────────────────────────────────────────────────
// A. dewData wiring (3 tests)
// ─────────────────────────────────────────────────────────────────────────────

describe('b35fix496 — dewData wiring', () => {
    test('calculate() accepts 4th dewData argument without error', () => {
        expect(() => FM.calculate(BASE_CLIMATE, { status: 'adequate' }, {}, dewWith(8))).not.toThrow();
    });

    test('with dewData: moistureSource is "leaf wetness hours"', () => {
        const r = FM.calculate(BASE_CLIMATE, { status: 'adequate' }, {}, dewWith(8));
        expect(r.drivers.moisture.moistureSource).toBe('leaf wetness hours');
    });

    test('without dewData: moistureSource is "humidity/precip ladder"', () => {
        const r = FM.calculate(BASE_CLIMATE, { status: 'adequate' }, {});
        expect(r.drivers.moisture.moistureSource).toBe('humidity/precip ladder');
    });
});

// ─────────────────────────────────────────────────────────────────────────────
// B. Wetness ordering — high wetness > low wetness (4 tests)
//
// NOTE: getLeafWetnessHours() halves averageWetHours (daytime discount):
//   return Math.round(averageWetHours * 0.5)
// So dewWith(N) → lwHours = Math.round(N * 0.5). To get lwHours=10 (saturated),
// pass dewWith(20). To get lwHours=5 (half-saturated), pass dewWith(10).
// ─────────────────────────────────────────────────────────────────────────────

describe('b35fix496 — wetness duration ordering', () => {
    test('dewWith(20) → lwHours=10 → moistureFactor saturated (contribution=100), higher than dry', () => {
        // getLeafWetnessHours halves: round(20 * 0.5) = 10; min(1, 10/10) = 1
        const wet = FM.calculate(BASE_CLIMATE, { status: 'adequate' }, {}, dewWith(20));
        const dry = FM.calculate(BASE_CLIMATE, { status: 'adequate' }, {}, dewWith(0));
        expect(wet.drivers.moisture.contribution).toBe(100);
        expect(wet.riskScore).toBeGreaterThan(dry.riskScore);
    });

    test('dewWith(10) → lwHours=5 → moistureFactor = 0.5 (linear below saturation)', () => {
        // round(10 * 0.5) = 5; min(1, 5/10) = 0.5 → contribution = 50
        const r = FM.calculate(BASE_CLIMATE, { status: 'adequate' }, {}, dewWith(10));
        expect(r.drivers.moisture.contribution).toBe(50);
    });

    test('dewWith(20) → saturated moisture → riskScore 95 at 8°C', () => {
        // tempFactor(8°C) ≈ 0.8825; moistureFactor=1; riskScore = (0.40×0.8825 + 0.60×1)×100 ≈ 95
        const r = FM.calculate(BASE_CLIMATE, { status: 'adequate' }, {}, dewWith(20));
        expect(r.riskScore).toBe(95);
    });

    test('dewWith(0) falls back to humidity/precip ladder (averageWetHours=0 is falsy)', () => {
        const r = FM.calculate(BASE_CLIMATE, { status: 'adequate' }, {}, dewWith(0));
        // humidity=75 → not >80, precip=3 → not >5 → moistureFactor=0.2
        expect(r.drivers.moisture.moistureSource).toBe('humidity/precip ladder');
        expect(r.drivers.moisture.contribution).toBe(20);
    });
});

// ─────────────────────────────────────────────────────────────────────────────
// C. Fallback preserves prior anchor (3 tests)
// ─────────────────────────────────────────────────────────────────────────────

describe('b35fix496 — fallback preserves period-mean behaviour when no dew data', () => {
    const COOL_WET = {
        temperature: { mean: 6, min: 2, max: 10 },
        moisture: { humidity: { mean: 92 } },
        precipitation: { total: 15 },
    };

    test('no dewData: cool-wet anchor still produces riskScore 100', () => {
        // tempFactor(6°C)=1.0; humidity=92>90 → moistureFactor=1; (0.40+0.60)×100=100
        const r = FM.calculate(COOL_WET, { status: 'adequate' }, {});
        expect(r.riskScore).toBe(100);
    });

    test('no dewData, low humidity: fallback to precip ladder when humidity absent', () => {
        const noHumidity = { temperature: { mean: 8, min: 4, max: 12 }, precipitation: { total: 20 } };
        const r = FM.calculate(noHumidity, { status: 'adequate' }, {});
        expect(r.drivers.moisture.moistureSource).toBe('precip-only ladder');
        expect(r.drivers.moisture.humidity).toBeNull();
    });

    test('dewData availability does not affect too-warm suppression', () => {
        const warm = { temperature: { mean: 25 } };
        const r = FM.calculate(warm, { status: 'adequate' }, {}, dewWith(12));
        expect(r.riskScore).toBe(0);
    });
});

// ─────────────────────────────────────────────────────────────────────────────
// D. leafWetnessHours exposed in drivers (3 tests)
// ─────────────────────────────────────────────────────────────────────────────

describe('b35fix496 — leafWetnessHours in drivers.moisture', () => {
    test('drivers.moisture.leafWetnessHours is set when dewData used (value is halved average)', () => {
        // dewWith(8): getLeafWetnessHours returns Math.round(8 * 0.5) = 4
        const r = FM.calculate(BASE_CLIMATE, { status: 'adequate' }, {}, dewWith(8));
        expect(r.drivers.moisture.leafWetnessHours).toBe(4);
    });

    test('drivers.moisture.leafWetnessHours is null when fallback ladder used', () => {
        const r = FM.calculate(BASE_CLIMATE, { status: 'adequate' }, {});
        expect(r.drivers.moisture.leafWetnessHours).toBeNull();
    });

    test('drivers.moisture.contribution matches min(1,lwHours/10)×100 exactly', () => {
        // dewWith(6): getLeafWetnessHours returns Math.round(6 * 0.5) = 3
        // moistureFactor = min(1, 3/10) = 0.3; contribution = 30
        const r = FM.calculate(BASE_CLIMATE, { status: 'adequate' }, {}, dewWith(6));
        expect(r.drivers.moisture.contribution).toBe(30);
    });
});

// ─────────────────────────────────────────────────────────────────────────────
// E. Confidence unchanged at moderate/60 (3 tests)
// ─────────────────────────────────────────────────────────────────────────────

describe('b35fix496 — confidence stays moderate/60 (not upgraded by dew data)', () => {
    test('with high leaf wetness: confidence still moderate (convention, not validated cutpoint)', () => {
        const r = FM.calculate(BASE_CLIMATE, { status: 'adequate' }, {}, dewWith(10));
        expect(r.confidence).toBe('moderate');
        expect(r.confidenceScore).toBe(60);
    });

    test('without dew data: confidence still moderate', () => {
        const r = FM.calculate(BASE_CLIMATE, { status: 'adequate' }, {});
        expect(r.confidence).toBe('moderate');
    });

    test('too-warm return: confidence still moderate even when dewData provided', () => {
        const r = FM.calculate({ temperature: { mean: 25 } }, { status: 'adequate' }, {}, dewWith(10));
        expect(r.confidence).toBe('moderate');
    });
});

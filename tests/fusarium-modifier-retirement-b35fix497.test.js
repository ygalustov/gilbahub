/**
 * b35fix497 — Fusarium: retire four unverified modifiers
 *
 * All four were Gilba-chosen with no peer-reviewed calibration:
 *   1. Freeze-thaw factor (0.7/0.9/1.0 ladder)
 *   2. Diurnal-fluctuation modifier (range 8/10/15°C → 1.08/1.15/1.25)
 *   3. Snow-cover factor (snowDays/10)
 *   4. Numeric N multiplier (getFusariumNModifier)
 *
 * Clean formula: riskScore = (0.40 × tempFactor + 0.60 × moistureFactor) × 100
 *
 * At neutral inputs (adequate N, no freeze/snow, diurnal ≤8) every retired
 * modifier was at its identity value, so the cool-wet anchor is unchanged.
 *
 * getFusariumNModifier and N_MODIFIERS_FUSARIUM are RETAINED as an audit
 * record (defined + exported, no live caller).
 *
 * Spec: tests/fusarium-modifier-retirement-b35fix497.test.js (18 tests)
 */

'use strict';

global.window   = global.window   || {};
global.document = global.document || { addEventListener: () => {}, documentElement: {}, querySelector: () => null };
global.console  = { group: () => {}, groupEnd: () => {}, groupCollapsed: () => {}, log: () => {}, warn: () => {}, info: () => {}, error: () => {} };

const fs   = require('fs');
const path = require('path');
const eng  = require('../assets/disease-engine-pure.js');
const FM   = eng.models.fusarium;

// ─────────────────────────────────────────────────────────────────────────────
// A. Anchor invariance at neutral inputs (4 tests)
// These must be unchanged from pre-fix because all modifiers were at identity.
// ─────────────────────────────────────────────────────────────────────────────

describe('b35fix497 — anchor invariance at neutral inputs', () => {
    const COOL_WET = {
        temperature: { mean: 6, min: 2, max: 10 },
        moisture: { humidity: { mean: 92 } },
        precipitation: { total: 15 },
    };
    const DRAINED = {
        temperature: { mean: 8, min: 4, max: 12 },
        moisture: { humidity: { mean: 75 } },
        precipitation: { total: 3 },
    };

    test('cool-wet anchor: 6°C / RH 92% → riskScore 100', () => {
        const r = FM.calculate(COOL_WET, { status: 'adequate' }, {});
        expect(r.riskScore).toBe(100);
    });

    test('drained anchor: 8°C / RH 75% → riskScore 47', () => {
        // tempFactor(8°C)≈0.8825; humidity 75% (not >80, not >90) → moistureFactor=0.2
        // (0.40×0.8825 + 0.60×0.2)×100 = 47.3 → 47
        const r = FM.calculate(DRAINED, { status: 'adequate' }, {});
        expect(r.riskScore).toBe(47);
    });

    test('primary driver is "moisture" when moistureFactor ≥ tempFactor', () => {
        const r = FM.calculate(COOL_WET, { status: 'adequate' }, {});
        expect(r.primaryDriver).toBe('moisture');
    });

    test('primary driver is "temperature" when tempFactor > moistureFactor', () => {
        // At 6°C tempFactor=1.0, moistureFactor=0.2 → temp wins
        const dry = { temperature: { mean: 6, min: 2, max: 10 }, moisture: { humidity: { mean: 75 } }, precipitation: { total: 0 } };
        const r = FM.calculate(dry, { status: 'adequate' }, {});
        expect(r.primaryDriver).toBe('temperature');
    });
});

// ─────────────────────────────────────────────────────────────────────────────
// B. N-invariance of riskScore (4 tests)
// ─────────────────────────────────────────────────────────────────────────────

describe('b35fix497 — N-invariance of riskScore', () => {
    const CLIMATE = {
        temperature: { mean: 14, min: 10, max: 18 },
        moisture: { humidity: { mean: 75 } },
        precipitation: { total: 3 },
    };

    test('excessive N produces same riskScore as deficient N', () => {
        const excess  = FM.calculate(CLIMATE, { status: 'excessive' }, {}).riskScore;
        const deficit = FM.calculate(CLIMATE, { status: 'deficient' }, {}).riskScore;
        expect(excess).toBe(deficit);
    });

    test('high N produces same riskScore as adequate N', () => {
        const high = FM.calculate(CLIMATE, { status: 'high' }, {}).riskScore;
        const adq  = FM.calculate(CLIMATE, { status: 'adequate' }, {}).riskScore;
        expect(high).toBe(adq);
    });

    test('winterRisk flag true when high N + temp ≤ 15°C (qualitative only)', () => {
        const r = FM.calculate(CLIMATE, { status: 'high' }, {});
        expect(r.drivers.nitrogen.winterRisk).toBe(true);
    });

    test('winterRisk flag false when adequate N (regardless of temp)', () => {
        const r = FM.calculate(CLIMATE, { status: 'adequate' }, {});
        expect(r.drivers.nitrogen.winterRisk).toBe(false);
    });
});

// ─────────────────────────────────────────────────────────────────────────────
// C. Driver-object absence (3 tests) — retired modifiers not in result
// ─────────────────────────────────────────────────────────────────────────────

describe('b35fix497 — retired modifier drivers absent from result', () => {
    const FREEZE_CLIMATE = {
        temperature: { mean: 2, min: -3, max: 10 },
        moisture: { humidity: { mean: 90 } },
        precipitation: { total: 5 },
    };

    test('drivers.freezeThaw is not present', () => {
        const r = FM.calculate(FREEZE_CLIMATE, { status: 'adequate' }, {});
        expect(r.drivers).not.toHaveProperty('freezeThaw');
    });

    test('drivers.fluctuation is not present', () => {
        const r = FM.calculate(FREEZE_CLIMATE, { status: 'adequate' }, {});
        expect(r.drivers).not.toHaveProperty('fluctuation');
    });

    test('drivers.snow is not present', () => {
        const r = FM.calculate(FREEZE_CLIMATE, { status: 'adequate' }, {});
        expect(r.drivers).not.toHaveProperty('snow');
    });
});

// ─────────────────────────────────────────────────────────────────────────────
// D. Former modifier scenarios now score on core formula only (4 tests)
// ─────────────────────────────────────────────────────────────────────────────

describe('b35fix497 — modifier scenarios score on core formula only', () => {
    test('freeze-thaw day (min -3, max 10): same riskScore as non-freeze day same temp', () => {
        const freeze    = { temperature: { mean: 2, min: -3, max: 10 }, moisture: { humidity: { mean: 90 } }, precipitation: { total: 5 } };
        const noFreeze  = { temperature: { mean: 2, min: 1, max: 7 },   moisture: { humidity: { mean: 90 } }, precipitation: { total: 5 } };
        const r1 = FM.calculate(freeze,   { status: 'adequate' }, {}).riskScore;
        const r2 = FM.calculate(noFreeze, { status: 'adequate' }, {}).riskScore;
        // Both use same meanTemp ≈ 2°C; moistureFactor same; diurnalRange differs but
        // diurnal modifier retired → should produce equal or near-equal scores
        // (meanTemp is same; diurnal doesn't affect tempFactor or moistureFactor)
        expect(r1).toBe(r2);
    });

    test('large diurnal range (15°C) no longer inflates score vs small range', () => {
        const large = { temperature: { mean: 8, min: 0, max: 15 }, moisture: { humidity: { mean: 90 } }, precipitation: { total: 10 } };
        const small = { temperature: { mean: 8, min: 6, max: 10 }, moisture: { humidity: { mean: 90 } }, precipitation: { total: 10 } };
        expect(FM.calculate(large, { status: 'adequate' }, {}).riskScore)
            .toBe(FM.calculate(small, { status: 'adequate' }, {}).riskScore);
    });

    test('snow-cover flag has no effect on riskScore', () => {
        const snow   = { temperature: { mean: 2, min: -1, max: 4 }, moisture: { humidity: { mean: 85 } }, precipitation: { total: 5 }, snowCover: { present: true, consecutiveDays: 14 } };
        const noSnow = { temperature: { mean: 2, min: -1, max: 4 }, moisture: { humidity: { mean: 85 } }, precipitation: { total: 5 } };
        expect(FM.calculate(snow,   { status: 'adequate' }, {}).riskScore)
            .toBe(FM.calculate(noSnow, { status: 'adequate' }, {}).riskScore);
    });

    test('excessive N does not inflate riskScore vs adequate N on freeze-thaw day', () => {
        const climate = { temperature: { mean: 2, min: -3, max: 10 }, moisture: { humidity: { mean: 90 } }, precipitation: { total: 5 } };
        const excess = FM.calculate(climate, { status: 'excessive' }, {}).riskScore;
        const adq    = FM.calculate(climate, { status: 'adequate'  }, {}).riskScore;
        expect(excess).toBe(adq);
    });
});

// ─────────────────────────────────────────────────────────────────────────────
// E. Audit record retained (3 tests)
// ─────────────────────────────────────────────────────────────────────────────

describe('b35fix497 — getFusariumNModifier retained as audit record', () => {
    test('N_MODIFIERS_FUSARIUM is exported (audit record)', () => {
        expect(eng.N_MODIFIERS_FUSARIUM).toBeDefined();
        expect(typeof eng.N_MODIFIERS_FUSARIUM).toBe('object');
    });

    test('N_MODIFIERS_FUSARIUM has expected N-status keys', () => {
        const keys = Object.keys(eng.N_MODIFIERS_FUSARIUM);
        expect(keys).toContain('adequate');
        expect(keys).toContain('high');
        expect(keys).toContain('excessive');
    });

    test('getFusariumNModifier still defined in source (audit record, not live)', () => {
        const src = fs.readFileSync(path.join(__dirname, '../assets/disease-engine-pure.js'), 'utf8');
        expect(src).toContain('getFusariumNModifier');
    });
});

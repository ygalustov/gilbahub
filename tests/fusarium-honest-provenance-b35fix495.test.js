/**
 * b35fix495 — Fusarium honest provenance and confidence drop
 *
 * FusariumModel is a Gilba weighted-sum. Pre-fix claimed source:
 * 'Smith, Jackson & Woolhouse 1989' (incorrect — that paper provides the
 * temperature envelope/directions only, not the equation) and confidence:
 * 'high'/90 (overclaims; Smith-Kerns is the peer-validated reference at 90).
 *
 * Fix: FUSARIUM_MODEL_SOURCE names the Gilba weighted-sum and credits
 * Smith 1989 + CABI 2024 as basis only. FUSARIUM_MODEL_CONFIDENCE_LEVEL/
 * SCORE drop to 'moderate'/60 on computed and too-warm returns. No-temp path
 * keeps 'low'/20 (data absence < model ceiling). riskScore math unchanged.
 *
 * Spec: tests/fusarium-honest-provenance-b35fix495.test.js (16 tests)
 */

'use strict';

global.window   = global.window   || {};
global.document = global.document || { addEventListener: () => {}, documentElement: {}, querySelector: () => null };
global.console  = { group: () => {}, groupEnd: () => {}, groupCollapsed: () => {}, log: () => {}, warn: () => {}, info: () => {}, error: () => {} };

const fs   = require('fs');
const path = require('path');
const eng  = require('../assets/disease-engine-pure.js');
const FM   = eng.models.fusarium;

const EXPECTED_SOURCE = 'Gilba weighted-sum (Smith, Jackson & Woolhouse 1989 — temperature envelope only; CABI 2024 Box 6.17)';

function climate(meanTemp, humidity = 90, precip = 10) {
    return { temperature: { mean: meanTemp, min: meanTemp - 4, max: meanTemp + 4 }, moisture: { humidity: { mean: humidity } }, precipitation: { total: precip } };
}

// ─────────────────────────────────────────────────────────────────────────────
// Source string (3 tests)
// ─────────────────────────────────────────────────────────────────────────────

describe('b35fix495 — source attribution', () => {
    test('computed path carries honest Gilba source', () => {
        expect(FM.calculate(climate(8), { status: 'adequate' }, {}).source).toBe(EXPECTED_SOURCE);
    });

    test('too-warm path carries honest Gilba source', () => {
        expect(FM.calculate(climate(25), { status: 'adequate' }, {}).source).toBe(EXPECTED_SOURCE);
    });

    test('no-temperature path carries honest Gilba source', () => {
        expect(FM.calculate({}, { status: 'adequate' }, {}).source).toBe(EXPECTED_SOURCE);
    });
});

// ─────────────────────────────────────────────────────────────────────────────
// Confidence ceiling (5 tests)
// ─────────────────────────────────────────────────────────────────────────────

describe('b35fix495 — confidence ceiling moderate/60', () => {
    test('computed path: confidence is moderate', () => {
        expect(FM.calculate(climate(8), { status: 'adequate' }, {}).confidence).toBe('moderate');
    });

    test('computed path: confidenceScore is 60', () => {
        expect(FM.calculate(climate(8), { status: 'adequate' }, {}).confidenceScore).toBe(60);
    });

    test('too-warm path: confidence is moderate', () => {
        expect(FM.calculate(climate(25), { status: 'adequate' }, {}).confidence).toBe('moderate');
    });

    test('too-warm path: confidenceScore is 60', () => {
        expect(FM.calculate(climate(25), { status: 'adequate' }, {}).confidenceScore).toBe(60);
    });

    test('no-temperature path: confidence is low / confidenceScore 20 (data absence < model ceiling)', () => {
        const r = FM.calculate({}, { status: 'adequate' }, {});
        expect(r.confidence).toBe('low');
        expect(r.confidenceScore).toBe(20);
    });
});

// ─────────────────────────────────────────────────────────────────────────────
// Fusarium confidence ceiling below Smith-Kerns (1 test)
// ─────────────────────────────────────────────────────────────────────────────

describe('b35fix495 — Fusarium confidence below Smith-Kerns', () => {
    test('Fusarium confidenceScore (60) is below Smith-Kerns (90) — unvalidated must not claim parity', () => {
        const fusariumScore = FM.calculate(climate(8), { status: 'adequate' }, {}).confidenceScore;
        // Smith-Kerns (dollar spot) is the peer-validated benchmark at 90
        expect(fusariumScore).toBeLessThan(90);
        expect(fusariumScore).toBe(60);
    });
});

// ─────────────────────────────────────────────────────────────────────────────
// Risk-score anchors — math unchanged by b35fix495 (5 tests)
// ─────────────────────────────────────────────────────────────────────────────

describe('b35fix495 — risk-score anchors (math unchanged)', () => {
    test('cool-wet anchor: 6°C / RH 95% / precip 15mm → riskScore > 70', () => {
        // At peak temp (6°C) + max moisture ladder → (0.40×1.0 + 0.60×1.0)×100 = 100
        const r = FM.calculate(climate(6, 95, 15), { status: 'adequate' }, {});
        expect(r.riskScore).toBeGreaterThan(70);
    });

    test('too-warm anchor: 22°C → riskScore 0', () => {
        expect(FM.calculate(climate(22), { status: 'adequate' }, {}).riskScore).toBe(0);
    });

    test('no-temperature anchor: no temp → riskScore 0', () => {
        expect(FM.calculate({}, { status: 'adequate' }, {}).riskScore).toBe(0);
    });

    test('sub-zero anchor: -5°C → riskScore lower than 6°C (tempFactor=0 below range)', () => {
        const peak = FM.calculate(climate(6, 90, 10), { status: 'adequate' }, {}).riskScore;
        const cold = FM.calculate(climate(-5, 90, 10), { status: 'adequate' }, {}).riskScore;
        expect(cold).toBeLessThan(peak);
    });

    test('b35fix495 is a provenance-only fix: riskScore unchanged vs pre-fix at neutral inputs', () => {
        // Anchor: 8°C / RH 90% / precip 10mm.
        // tempFactor = exp(-0.5×((8-6)/4)²) ≈ 0.8825
        // humidity ladder: humidity > 90 is FALSE (90 is not strictly > 90) → > 80 TRUE → moistureFactor = 0.6
        // riskScore = (0.40×0.8825 + 0.60×0.6)×100 = (0.353 + 0.36)×100 = 71.3 → 71
        const r = FM.calculate(climate(8, 90, 10), { status: 'adequate' }, {});
        expect(r.riskScore).toBe(71);
    });
});

// ─────────────────────────────────────────────────────────────────────────────
// Source code constant structure (2 tests)
// ─────────────────────────────────────────────────────────────────────────────

describe('b35fix495 — provenance constants in source', () => {
    const src = fs.readFileSync(path.join(__dirname, '../assets/disease-engine-pure.js'), 'utf8');

    test('FUSARIUM_MODEL_SOURCE constant defined in source', () => {
        expect(src).toContain('FUSARIUM_MODEL_SOURCE');
        expect(src).toContain('Gilba weighted-sum');
    });

    test('FUSARIUM_MODEL_CONFIDENCE_LEVEL and FUSARIUM_MODEL_CONFIDENCE_SCORE constants defined', () => {
        expect(src).toContain('FUSARIUM_MODEL_CONFIDENCE_LEVEL');
        expect(src).toContain('FUSARIUM_MODEL_CONFIDENCE_SCORE');
    });
});

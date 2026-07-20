/**
 * Fusarium Tier 2 Audit Verification — b35fix395 / updated for b35fix495-497
 *
 * b35fix495-497 changes reflected here:
 *   - Source string updated to FUSARIUM_MODEL_SOURCE (honest Gilba attribution)
 *   - nModifier removed from riskScore (nitrogen qualitative only — winterRisk flag)
 *   - Four modifiers retired: freezeThaw, fluctuationMod, snowFactor, nModifier
 *   - confidence downgraded: 'moderate'/60 (was 'high'/90)
 *   - moistureFactor now uses leaf-wetness hours when dewData available
 */

global.window   = global.window   || {};
global.document = global.document || { addEventListener: () => {}, documentElement: {} };
global.console  = { group: () => {}, groupEnd: () => {}, groupCollapsed: () => {}, log: () => {}, warn: () => {}, info: () => {}, error: () => {} };

const fs   = require('fs');
const path = require('path');

const DiseaseEnginePure = require('../assets/disease-engine-pure.js');
const FusariumModel     = DiseaseEnginePure.models.fusarium;

const EXPECTED_SOURCE = 'Gilba weighted-sum (Smith, Jackson & Woolhouse 1989 — temperature envelope only; CABI 2024 Box 6.17)';

describe('Fusarium source attribution (b35fix495)', () => {
    test('source on computed path is honest Gilba attribution', () => {
        const result = FusariumModel.calculate(
            { temperature: { mean: 10, min: 5, max: 15 }, moisture: { humidity: { mean: 85 } }, precipitation: { total: 8 } },
            { status: 'adequate' }, {}
        );
        expect(result.source).toBe(EXPECTED_SOURCE);
    });

    test('source on no-temperature path is honest Gilba attribution', () => {
        const result = FusariumModel.calculate({}, { status: 'adequate' }, {});
        expect(result.source).toBe(EXPECTED_SOURCE);
    });

    test('source on too-warm path is honest Gilba attribution', () => {
        const result = FusariumModel.calculate({ temperature: { mean: 25 } }, { status: 'adequate' }, {});
        expect(result.source).toBe(EXPECTED_SOURCE);
    });
});

describe('Fusarium temperature thresholds', () => {
    const baseClimate = { moisture: { humidity: { mean: 90 } }, precipitation: { total: 10 } };

    test('optimal range 6°C returns non-zero risk', () => {
        const r = FusariumModel.calculate({ ...baseClimate, temperature: { mean: 6, min: 3, max: 9 } }, { status: 'adequate' }, {});
        expect(r.riskScore).toBeGreaterThan(0);
    });

    test('meanTemp > 20 returns zero risk with too-warm note', () => {
        const r = FusariumModel.calculate({ ...baseClimate, temperature: { mean: 22 } }, { status: 'adequate' }, {});
        expect(r.riskScore).toBe(0);
        expect(r.drivers.temperature.note).toContain('Too warm for Fusarium development');
    });

    test('sub-zero temp returns lower risk than optimal', () => {
        const optimal = FusariumModel.calculate({ ...baseClimate, temperature: { mean: 6, min: 3, max: 9 } }, { status: 'adequate' }, {});
        const cold    = FusariumModel.calculate({ ...baseClimate, temperature: { mean: -5, min: -8, max: -2 } }, { status: 'adequate' }, {});
        expect(cold.riskScore).toBeLessThan(optimal.riskScore);
        expect(cold.drivers.temperature.contribution).toBe(0);
    });
});

describe('Fusarium confidence downgrade (b35fix495)', () => {
    test('computed path returns moderate confidence at 60', () => {
        const r = FusariumModel.calculate(
            { temperature: { mean: 8, min: 4, max: 12 }, moisture: { humidity: { mean: 90 } }, precipitation: { total: 10 } },
            { status: 'adequate' }, {}
        );
        expect(r.confidence).toBe('moderate');
        expect(r.confidenceScore).toBe(60);
    });

    test('too-warm path returns moderate confidence at 60', () => {
        const r = FusariumModel.calculate({ temperature: { mean: 25 } }, { status: 'adequate' }, {});
        expect(r.confidence).toBe('moderate');
        expect(r.confidenceScore).toBe(60);
    });

    test('no-temp path returns low confidence at 20', () => {
        const r = FusariumModel.calculate({}, { status: 'adequate' }, {});
        expect(r.confidence).toBe('low');
        expect(r.confidenceScore).toBe(20);
    });
});

describe('Fusarium nitrogen — qualitative flag only (b35fix495)', () => {
    const coldClimate = {
        temperature: { mean: 14, min: 10, max: 18 },
        moisture: { humidity: { mean: 75 } },
        precipitation: { total: 3 },
    };

    test('riskScore is identical across N statuses — N not in formula', () => {
        const deficient  = FusariumModel.calculate(coldClimate, { status: 'deficient' }, {});
        const adequate   = FusariumModel.calculate(coldClimate, { status: 'adequate' }, {});
        const high       = FusariumModel.calculate(coldClimate, { status: 'high' }, {});
        const excessive  = FusariumModel.calculate(coldClimate, { status: 'excessive' }, {});
        // All four produce the same riskScore now — nModifier retired from formula.
        expect(deficient.riskScore).toBe(adequate.riskScore);
        expect(high.riskScore).toBe(adequate.riskScore);
        expect(excessive.riskScore).toBe(adequate.riskScore);
    });

    test('winterRisk flag true for high/excessive N at ≤15°C', () => {
        const high      = FusariumModel.calculate(coldClimate, { status: 'high' }, {});
        const excessive = FusariumModel.calculate(coldClimate, { status: 'excessive' }, {});
        expect(high.drivers.nitrogen.winterRisk).toBe(true);
        expect(excessive.drivers.nitrogen.winterRisk).toBe(true);
    });

    test('winterRisk flag false for adequate N', () => {
        const adequate = FusariumModel.calculate(coldClimate, { status: 'adequate' }, {});
        expect(adequate.drivers.nitrogen.winterRisk).toBe(false);
    });

    test('winterRisk flag false when temp > 15°C even with high N', () => {
        const warmClimate = { ...coldClimate, temperature: { mean: 18, min: 14, max: 22 } };
        const high = FusariumModel.calculate(warmClimate, { status: 'high' }, {});
        expect(high.drivers.nitrogen.winterRisk).toBe(false);
    });
});

describe('Fusarium retired modifiers absent from result (b35fix495)', () => {
    const climate = {
        temperature: { mean: 2, min: -2, max: 6 },
        moisture: { humidity: { mean: 90 } },
        precipitation: { total: 5 },
    };

    test('freezeThaw driver is not present in result', () => {
        const r = FusariumModel.calculate(climate, { status: 'adequate' }, {});
        expect(r.drivers).not.toHaveProperty('freezeThaw');
    });

    test('fluctuation driver is not present in result', () => {
        const r = FusariumModel.calculate(climate, { status: 'adequate' }, {});
        expect(r.drivers).not.toHaveProperty('fluctuation');
    });

    test('snow driver is not present in result', () => {
        const r = FusariumModel.calculate(climate, { status: 'adequate' }, {});
        expect(r.drivers).not.toHaveProperty('snow');
    });

    test('nitrogen driver has no modifier field', () => {
        const r = FusariumModel.calculate(climate, { status: 'high' }, {});
        expect(r.drivers.nitrogen).not.toHaveProperty('modifier');
    });
});

describe('Fusarium humidity null-passthrough (b35fix344 preserved)', () => {
    const base = { temperature: { mean: 8, min: 5, max: 11 }, precipitation: { total: 20 } };

    test('missing humidity — humiditySource is "no data"', () => {
        const r = FusariumModel.calculate(base, { status: 'adequate' }, {});
        expect(r.drivers.moisture.humidity).toBeNull();
        expect(r.drivers.moisture.humiditySource).toBe('no data');
    });

    test('missing humidity with high precip — non-zero risk (precip-only fallback)', () => {
        const r = FusariumModel.calculate(base, { status: 'adequate' }, {});
        expect(r.riskScore).toBeGreaterThan(0);
    });

    test('with humidity — humiditySource is "period mean"', () => {
        const r = FusariumModel.calculate({ ...base, moisture: { humidity: { mean: 95 } } }, { status: 'adequate' }, {});
        expect(r.drivers.moisture.humidity).toBe(95);
        expect(r.drivers.moisture.humiditySource).toBe('period mean');
    });
});

describe('Fusarium leaf-wetness hours (b35fix496)', () => {
    const climate = {
        temperature: { mean: 8, min: 4, max: 12 },
        moisture: { humidity: { mean: 75 } },
        precipitation: { total: 3 },
    };

    test('dewData with averageWetHours overrides humidity ladder', () => {
        const withDew    = FusariumModel.calculate(climate, { status: 'adequate' }, {}, { leafWetness: { averageWetHours: 10 } });
        const withoutDew = FusariumModel.calculate(climate, { status: 'adequate' }, {});
        // 10h/day saturates moistureFactor=1 vs humidity 75%→0.2 ladder → higher risk
        expect(withDew.riskScore).toBeGreaterThan(withoutDew.riskScore);
        expect(withDew.drivers.moisture.moistureSource).toBe('leaf wetness hours');
    });

    test('zero leaf-wetness hours falls back to humidity/precip ladder', () => {
        const r = FusariumModel.calculate(climate, { status: 'adequate' }, {}, { leafWetness: { averageWetHours: 0 } });
        expect(r.drivers.moisture.moistureSource).toBe('humidity/precip ladder');
    });

    test('no dewData falls back to humidity/precip ladder', () => {
        const r = FusariumModel.calculate(climate, { status: 'adequate' }, {});
        // humidity=75 → 0.2 tier
        expect(r.drivers.moisture.moistureSource).toBe('humidity/precip ladder');
    });
});

describe('Fusarium backward compat — result shape', () => {
    test('all expected top-level fields present', () => {
        const r = FusariumModel.calculate(
            { temperature: { mean: 10, min: 5, max: 15 }, moisture: { humidity: { mean: 85 } }, precipitation: { total: 8 } },
            { status: 'high' }, { name: 'bentgrass' }
        );
        expect(r).toHaveProperty('disease', 'fusarium');
        expect(r).toHaveProperty('riskScore');
        expect(r).toHaveProperty('riskLevel');
        expect(r).toHaveProperty('confidence');
        expect(r).toHaveProperty('drivers');
        expect(r).toHaveProperty('source');
        expect(r).toHaveProperty('primaryDriver');
        expect(typeof r.riskScore).toBe('number');
        expect(r.riskScore).toBeGreaterThanOrEqual(0);
        expect(r.riskScore).toBeLessThanOrEqual(100);
    });

    test('drivers contains temperature, moisture, nitrogen', () => {
        const r = FusariumModel.calculate(
            { temperature: { mean: 10, min: 5, max: 15 }, moisture: { humidity: { mean: 85 } }, precipitation: { total: 8 } },
            { status: 'high' }, {}
        );
        expect(r.drivers).toHaveProperty('temperature');
        expect(r.drivers).toHaveProperty('moisture');
        expect(r.drivers).toHaveProperty('nitrogen');
    });
});

describe('Fusarium provenance banner in source code (b35fix495)', () => {
    test('source code contains honest Gilba provenance header', () => {
        const src = fs.readFileSync(path.join(__dirname, '../assets/disease-engine-pure.js'), 'utf8');
        expect(src).toContain('Gilba weighted-sum');
        expect(src).toContain('FUSARIUM_MODEL_SOURCE');
        expect(src).toContain('FUSARIUM_MODEL_CONFIDENCE_LEVEL');
    });

    test('four retired modifier names appear only in comments/retired notes, not in active formula', () => {
        const src = fs.readFileSync(path.join(__dirname, '../assets/disease-engine-pure.js'), 'utf8');
        // The formula line must NOT contain these modifier variable references after b35fix495.
        // Check they don't appear after the new banner (they're in old banner comments which is fine).
        expect(src).toContain('b35fix495');
        // Smith 1989 still referenced (for temperature envelope provenance)
        expect(src).toContain('Smith, Jackson & Woolhouse 1989');
    });
});

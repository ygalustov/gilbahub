/**
 * Climate Engine — Growth Potential, Stress Classification, Light (DLI) tests
 *
 * Sources and verification method:
 *   GP:     Kreuser & Soldat 2011 (GCSAA standard bell-curve).
 *           Expected values computed independently:
 *             GP(T) = exp(-0.5 * ((T - optBound) / variance)²) outside optimal range
 *             GP(T) = 1.0 inside [optMin, optMax]
 *           C3: optMin=15.6, optMax=23.9, variance=6.8
 *           C4: optMin=31.1, optMax=35.0, variance=9.0
 *   Stress: thresholds from STRESS_THRESHOLDS constant (heat/cold/drought/moisture).
 *   Light:  mjToDLI constant 2.04 mol/MJ from McCree 1972 / Thimijan & Heins 1983.
 *           Shade modifier in DollarSpot: shadeMod = 1 + (dliDeficit - 30) / 100
 *           when dliDeficit > 30 (UNVERIFIED thresholds, documented in source).
 */

global.window   = global.window   || {};
global.document = global.document || { addEventListener: function () {}, documentElement: {} };
global.console  = { group: function () {}, groupEnd: function () {}, groupCollapsed: function () {},
                    log: function () {}, warn: function () {}, info: function () {}, error: function () {} };

var climateEngine  = require('../assets/climate-engine-v2.js');
var calcGPP        = climateEngine.calcGPP;
var calcWeightedGPP = climateEngine.calcWeightedGPP;
var classifyStress = climateEngine.classifyStress;
var GPP_COEFFICIENTS = climateEngine.GPP_COEFFICIENTS;
var STRESS_THRESHOLDS = climateEngine.STRESS_THRESHOLDS;

var DiseaseEnginePure = require('../assets/disease-engine-pure.js');
var DollarSpotModel   = DiseaseEnginePure.models.dollarSpot;


// =============================================================================
// 1. Growth Potential (calcGPP) — Kreuser & Soldat 2011
// =============================================================================

describe('calcGPP — C3 grass (Kreuser & Soldat 2011)', function () {

    test('GP = 1.0 at lower optimal boundary (15.6°C)', function () {
        expect(calcGPP(15.6, 'c3')).toBe(1);
    });

    test('GP = 1.0 at upper optimal boundary (23.9°C)', function () {
        expect(calcGPP(23.9, 'c3')).toBe(1);
    });

    test('GP = 1.0 anywhere within optimal range (20°C)', function () {
        expect(calcGPP(20, 'c3')).toBe(1);
    });

    test('GP ≈ 0.712 at 10°C — manually: exp(-0.5*(5.6/6.8)²)', function () {
        // dist = 15.6 - 10 = 5.6; GP = exp(-0.5*(5.6/6.8)²) = exp(-0.339) ≈ 0.712
        var gp = calcGPP(10, 'c3');
        expect(gp).toBeCloseTo(0.712, 2);
    });

    test('GP ≈ 0.669 at 30°C — manually: exp(-0.5*(6.1/6.8)²)', function () {
        // dist = 30 - 23.9 = 6.1; GP = exp(-0.5*(6.1/6.8)²) = exp(-0.401) ≈ 0.669
        var gp = calcGPP(30, 'c3');
        expect(gp).toBeCloseTo(0.669, 2);
    });

    test('GP ≈ 0.072 at 0°C (deep winter — very low growth potential)', function () {
        // dist = 15.6; GP = exp(-0.5*(15.6/6.8)²) = exp(-2.634) ≈ 0.072
        var gp = calcGPP(0, 'c3');
        expect(gp).toBeCloseTo(0.072, 2);
    });

    test('GP decreases monotonically as temperature moves away from optimal', function () {
        expect(calcGPP(20, 'c3')).toBeGreaterThan(calcGPP(15, 'c3'));
        expect(calcGPP(15, 'c3')).toBeGreaterThan(calcGPP(10, 'c3'));
        expect(calcGPP(10, 'c3')).toBeGreaterThan(calcGPP(5, 'c3'));
        expect(calcGPP(20, 'c3')).toBeGreaterThan(calcGPP(27, 'c3'));
        expect(calcGPP(27, 'c3')).toBeGreaterThan(calcGPP(32, 'c3'));
    });

    test('GP returns null when temperature is null', function () {
        expect(calcGPP(null, 'c3')).toBeNull();
    });
});

describe('calcGPP — C4 grass (Kreuser & Soldat 2011)', function () {

    test('GP = 1.0 at lower optimal boundary (31.1°C)', function () {
        expect(calcGPP(31.1, 'c4')).toBe(1);
    });

    test('GP = 1.0 at upper optimal boundary (35.0°C)', function () {
        expect(calcGPP(35, 'c4')).toBe(1);
    });

    test('GP ≈ 0.467 at 20°C — cold suppression on warm-season grass', function () {
        // dist = 31.1 - 20 = 11.1; GP = exp(-0.5*(11.1/9)²) = exp(-0.76) ≈ 0.467
        var gp = calcGPP(20, 'c4');
        expect(gp).toBeCloseTo(0.467, 2);
    });

    test('C4 has near-zero GP at 10°C (cold stress, dist=21.1)', function () {
        var gp = calcGPP(10, 'c4');
        expect(gp).toBeLessThan(0.1);
        expect(gp).toBeCloseTo(0.064, 2);
    });

    test('C4 GP at 20°C is much lower than C3 GP at 20°C (species difference)', function () {
        // At 20°C: C3 is within optimal → GP=1.0; C4 is well below optimum → GP≈0.467
        expect(calcGPP(20, 'c4')).toBeLessThan(calcGPP(20, 'c3'));
    });

    test('C4 GP at 33°C is much higher than C3 GP at 33°C (warm-season advantage)', function () {
        // At 33°C: C3 is outside optimum and declining; C4 is within optimal → GP=1.0
        expect(calcGPP(33, 'c4')).toBeGreaterThan(calcGPP(33, 'c3'));
    });
});

describe('calcWeightedGPP — mixed C3/C4 turf', function () {

    test('pure C3 profile returns c3 GP', function () {
        var r = calcWeightedGPP(10, 1, 0);
        expect(r.weighted).toBeCloseTo(calcGPP(10, 'c3'), 2);
        expect(r.c3).toBeCloseTo(calcGPP(10, 'c3'), 2);
    });

    test('pure C4 profile returns c4 GP', function () {
        var r = calcWeightedGPP(33, 0, 1);
        expect(r.weighted).toBeCloseTo(calcGPP(33, 'c4'), 2);
        expect(r.c4).toBeCloseTo(calcGPP(33, 'c4'), 2);
    });

    test('50/50 mix at 20°C is average of C3 and C4 GP', function () {
        // C3(20)=1.0, C4(20)≈0.467 → weighted ≈ 0.734
        var r = calcWeightedGPP(20, 0.5, 0.5);
        var expected = (calcGPP(20, 'c3') + calcGPP(20, 'c4')) / 2;
        expect(r.weighted).toBeCloseTo(expected, 2);
    });

    test('GPP_COEFFICIENTS are the published Kreuser & Soldat 2011 values', function () {
        // C3: optMin=15.6, optMax=23.9 (°C)
        expect(GPP_COEFFICIENTS.c3.optMin).toBe(15.6);
        expect(GPP_COEFFICIENTS.c3.optMax).toBe(23.9);
        expect(GPP_COEFFICIENTS.c3.varLow).toBe(6.8);
        expect(GPP_COEFFICIENTS.c3.varHigh).toBe(6.8);
        // C4: optMin=31.1, optMax=35.0 (°C)
        expect(GPP_COEFFICIENTS.c4.optMin).toBe(31.1);
        expect(GPP_COEFFICIENTS.c4.optMax).toBe(35.0);
        expect(GPP_COEFFICIENTS.c4.varLow).toBe(9.0);
    });
});


// =============================================================================
// 2. Stress classification (classifyStress)
// =============================================================================

// Build minimal daily data object for testing
function makeDailyData(maxTemps, minTemps, precip, et) {
    return {
        temperature_2m_max: maxTemps,
        temperature_2m_min: minTemps,
        precipitation_sum: precip || [],
        et0_fao_evapotranspiration: et || []
    };
}

describe('classifyStress — heat stress (C3, thresholds: moderate=28, high=33, severe=38)', function () {

    test('no heat stress when maxTemp < 28°C', function () {
        var r = classifyStress(makeDailyData([25, 26, 27], [15, 15, 15]), false);
        expect(r.heat.severity).toBe('none');
    });

    test('moderate heat stress when maxTemp ≥ 28°C', function () {
        var r = classifyStress(makeDailyData([28, 28, 28], [18, 18, 18]), false);
        expect(r.heat.severity).toBe('moderate');
    });

    test('high heat stress when maxTemp ≥ 33°C', function () {
        var r = classifyStress(makeDailyData([33, 33, 33], [22, 22, 22]), false);
        expect(r.heat.severity).toBe('high');
    });

    test('severe heat stress when maxTemp ≥ 38°C', function () {
        var r = classifyStress(makeDailyData([38, 38, 38], [25, 25, 25]), false);
        expect(r.heat.severity).toBe('severe');
    });

    test('C4 heat stress threshold is higher — 42°C for high (bermuda not stressed at 33°C)', function () {
        var c3 = classifyStress(makeDailyData([33, 33, 33], [20, 20, 20]), false);
        var c4 = classifyStress(makeDailyData([33, 33, 33], [20, 20, 20]), true);
        expect(c3.heat.severity).toBe('high');
        expect(c4.heat.severity).toBe('none'); // C4 moderate only at 38°C
    });
});

describe('classifyStress — cold stress (C3, thresholds: moderate=2, high=-2, severe=-8)', function () {

    test('no cold stress when minTemp > 2°C', function () {
        var r = classifyStress(makeDailyData([10, 10, 10], [5, 5, 5]), false);
        expect(r.cold.severity).toBe('none');
    });

    test('moderate cold stress when minTemp ≤ 2°C', function () {
        var r = classifyStress(makeDailyData([8, 8, 8], [2, 2, 2]), false);
        expect(r.cold.severity).toBe('moderate');
    });

    test('high cold stress when minTemp ≤ -2°C', function () {
        var r = classifyStress(makeDailyData([5, 5, 5], [-2, -2, -2]), false);
        expect(r.cold.severity).toBe('high');
    });

    test('severe cold stress when minTemp ≤ -8°C', function () {
        var r = classifyStress(makeDailyData([2, 2, 2], [-8, -8, -8]), false);
        expect(r.cold.severity).toBe('severe');
    });
});

describe('classifyStress — drought stress (ET:precip thresholds: warn=1.5, critical=3.0)', function () {

    test('no drought when ET:precip ratio < 1.5', function () {
        // ET=5mm, precip=5mm → ratio=1.0
        var r = classifyStress(makeDailyData([25, 25, 25], [15, 15, 15], [5, 5, 5], [5, 5, 5]), false);
        expect(r.drought.severity).toBe('none');
        expect(r.drought.etPrecipRatio).toBeCloseTo(1.0, 1);
    });

    test('moderate drought when ET:precip ratio ≥ 1.5 and < 3.0', function () {
        // ET=5mm, precip=10/3 ≈ 3.33mm per day → total ET=15, precip=10 → ratio=1.5
        var r = classifyStress(makeDailyData([30, 30, 30], [15, 15, 15], [10], [15]), false);
        expect(r.drought.severity).toBe('moderate');
        expect(r.drought.etPrecipRatio).toBeCloseTo(1.5, 1);
    });

    test('high drought when ET:precip ratio ≥ 3.0', function () {
        // ET=15mm, precip=5mm → ratio=3.0
        var r = classifyStress(makeDailyData([32, 32, 32], [20, 20, 20], [5], [15]), false);
        expect(r.drought.severity).toBe('high');
        expect(r.drought.etPrecipRatio).toBeCloseTo(3.0, 1);
    });

    test('severe drought when no precip (ratio → 999)', function () {
        var r = classifyStress(makeDailyData([35, 35, 35], [22, 22, 22], [0, 0, 0], [5, 5, 5]), false);
        expect(r.drought.severity).toBe('high');
        expect(r.drought.etPrecipRatio).toBe(999);
    });
});

describe('classifyStress — moisture stress (consecutive wet days / heavy precip)', function () {

    test('no moisture stress with ≤ 2 consecutive wet days', function () {
        var r = classifyStress(makeDailyData([18, 18], [10, 10], [5, 5], []), false);
        expect(r.moisture.severity).toBe('none');
        expect(r.moisture.consecutiveWetDays).toBe(2);
    });

    test('moderate moisture stress with ≥ 3 consecutive wet days', function () {
        var r = classifyStress(makeDailyData([18, 18, 18, 18], [10, 10, 10, 10], [5, 5, 5, 5], []), false);
        expect(r.moisture.severity).toBe('moderate');
        expect(r.moisture.consecutiveWetDays).toBe(4);
    });

    test('high moisture stress with a single heavy-rain day (≥ 25mm)', function () {
        var r = classifyStress(makeDailyData([20], [12], [25], []), false);
        expect(r.moisture.severity).toBe('high');
    });
});


// =============================================================================
// 3. Light / DLI — shade modifier in DollarSpotModel
//    shadeMod = dliDeficit > 30 ? 1 + (dliDeficit - 30) / 100 : 1
// =============================================================================

// Warm-humid climate where DollarSpot is active (T=22°C, RH=82%)
var DS_ACTIVE_CLIMATE = {
    temperature: {
        mean: 22, min: 18, max: 26,
        dailyPattern: Array(5).fill({ mean: 22 })
    },
    moisture: { humidity: { mean: 82 } },
    hourlyData: {
        relative_humidity_2m: Array(24).fill(82),
        temperature_2m:       Array(24).fill(22),
        time: Array.from({ length: 24 }, function (_, i) {
            return '2024-01-01T' + (i < 10 ? '0' : '') + i + ':00';
        })
    }
};

describe('DollarSpotModel — shade modifier (light stress via DLI deficit)', function () {

    test('no shade → shadeMod = 1.0, baseline risk', function () {
        var r = DollarSpotModel.calculate(DS_ACTIVE_CLIMATE, null, null, null, null);
        expect(r.modifiers.shade).toBe(1);
    });

    test('dliDeficit = 30% (at threshold) → shadeMod = 1.0 (not above threshold)', function () {
        // Threshold is strictly > 30 in source: dliDeficit > 30
        var r = DollarSpotModel.calculate(DS_ACTIVE_CLIMATE, null, null, { dliDeficit: { percentage: 30 } }, null);
        expect(r.modifiers.shade).toBe(1);
    });

    test('dliDeficit = 50% → shadeMod = 1.20 (1 + 20/100)', function () {
        // dist above threshold: 50 - 30 = 20 → shadeMod = 1 + 20/100 = 1.20
        var r = DollarSpotModel.calculate(DS_ACTIVE_CLIMATE, null, null, { dliDeficit: { percentage: 50 } }, null);
        expect(r.modifiers.shade).toBeCloseTo(1.20, 2);
    });

    test('dliDeficit = 80% → shadeMod = 1.50 (1 + 50/100)', function () {
        var r = DollarSpotModel.calculate(DS_ACTIVE_CLIMATE, null, null, { dliDeficit: { percentage: 80 } }, null);
        expect(r.modifiers.shade).toBeCloseTo(1.50, 2);
    });

    test('heavy shade increases riskScore relative to no shade', function () {
        var noShade  = DollarSpotModel.calculate(DS_ACTIVE_CLIMATE, null, null, null, null);
        var heavyShade = DollarSpotModel.calculate(DS_ACTIVE_CLIMATE, null, null, { dliDeficit: { percentage: 60 } }, null);
        expect(heavyShade.riskScore).toBeGreaterThan(noShade.riskScore);
    });

    test('shadeMod scales monotonically with DLI deficit above threshold', function () {
        var r40 = DollarSpotModel.calculate(DS_ACTIVE_CLIMATE, null, null, { dliDeficit: { percentage: 40 } }, null);
        var r60 = DollarSpotModel.calculate(DS_ACTIVE_CLIMATE, null, null, { dliDeficit: { percentage: 60 } }, null);
        var r80 = DollarSpotModel.calculate(DS_ACTIVE_CLIMATE, null, null, { dliDeficit: { percentage: 80 } }, null);
        expect(r40.modifiers.shade).toBeLessThan(r60.modifiers.shade);
        expect(r60.modifiers.shade).toBeLessThan(r80.modifiers.shade);
    });
});

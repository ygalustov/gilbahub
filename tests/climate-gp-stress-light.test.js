/**
 * Climate Engine — Growth Potential, Stress Classification, Light (DLI) tests
 *
 * Sources and verification method:
 *   GP:     PACE Turf Growth Potential Model — Gelernter & Stowell 2005.
 *           GP(T) = exp(-0.5 * ((T - T_opt) / sigma)^2)
 *           C3: T_opt=20.0°C, sigma=5.5   C4: T_opt=31.0°C, sigma=7.0
 *           Reference values from handover doc b35fix473 Section 2,
 *           independently verified against GilbaGrowthPotentialEngine.compute().
 *   Stress: thresholds from STRESS_THRESHOLDS constant (heat/cold/drought/moisture).
 *   Light:  mjToDLI constant 2.04 mol/MJ from McCree 1972 / Thimijan & Heins 1983.
 *           Shade modifier in DollarSpot: shadeMod = 1 + (dliDeficit - 30) / 100
 *           when dliDeficit > 30 (UNVERIFIED thresholds, documented in source).
 */

global.window   = global.window   || {};
global.document = global.document || { addEventListener: function () {}, documentElement: {} };
global.console  = { group: function () {}, groupEnd: function () {}, groupCollapsed: function () {},
                    log: function () {}, warn: function () {}, info: function () {}, error: function () {} };

// Load canonical GP engine so climate-engine-v2 can find it via window.GilbaGrowthPotentialEngine
// growth-potential-engine.js exports Engine directly: module.exports = Engine
var gpEngine = require('../assets/growth-potential-engine.js');
global.window.GilbaGrowthPotentialEngine = gpEngine;

var climateEngine   = require('../assets/climate-engine-v2.js');
var calcGPP         = climateEngine.calcGPP;
var calcWeightedGPP = climateEngine.calcWeightedGPP;
var classifyStress  = climateEngine.classifyStress;
var STRESS_THRESHOLDS = climateEngine.STRESS_THRESHOLDS;

var DiseaseEnginePure = require('../assets/disease-engine-pure.js');
var DollarSpotModel   = DiseaseEnginePure.models.dollarSpot;

var GPE = global.window.GilbaGrowthPotentialEngine;


// =============================================================================
// 1. GilbaGrowthPotentialEngine — canonical PACE model (b35fix473)
// =============================================================================

describe('GilbaGrowthPotentialEngine — PACE C3 (T_opt=20, sigma=5.5)', function () {

    test('GP = 1.0 at optimum (20°C)', function () {
        expect(GPE.compute(20, { species: 'c3' })).toBeCloseTo(1.0, 5);
    });

    test('GP ≈ 0.6616 at 15°C (symmetric: same distance from opt as 25°C)', function () {
        // Handover doc reference: 0.661551
        expect(GPE.compute(15, { species: 'c3' })).toBeCloseTo(0.6616, 3);
    });

    test('GP ≈ 0.6616 at 25°C (symmetric)', function () {
        expect(GPE.compute(25, { species: 'c3' })).toBeCloseTo(0.6616, 3);
    });

    test('GP ≈ 0.1915 at 10°C — handover doc reference value', function () {
        // Handover: 0.191496
        expect(GPE.compute(10, { species: 'c3' })).toBeCloseTo(0.1915, 3);
    });

    test('GP ≈ 0.0725 at 7.4°C — the production regression anchor', function () {
        // Handover: 0.072503; verified live: GilbaGrowthPotentialEngine.compute(7.4,{species:'c3'}) = 0.0725026...
        // This pin specifically rejects 15%, 45%, and 48% (the three wrong models from plugin era)
        var gp = GPE.compute(7.4, { species: 'c3' });
        expect(gp).toBeCloseTo(0.0725, 3);
        expect(gp).toBeLessThan(0.10);   // not the Kreuser 'plateau' range
        expect(gp).not.toBeCloseTo(0.45, 1); // not sigma=10 fabricated
        expect(gp).not.toBeCloseTo(0.48, 1); // not Kreuser
    });

    test('GP ≈ 0.0047 at 2°C (deep winter)', function () {
        // Handover: 0.004703
        expect(GPE.compute(2, { species: 'c3' })).toBeCloseTo(0.0047, 3);
    });

    test('GP returns null for null temperature', function () {
        expect(GPE.compute(null, { species: 'c3' })).toBeNull();
    });

    test('GP monotonically decreasing as temperature moves away from 20°C', function () {
        expect(GPE.compute(20, { species: 'c3' })).toBeGreaterThan(GPE.compute(15, { species: 'c3' }));
        expect(GPE.compute(15, { species: 'c3' })).toBeGreaterThan(GPE.compute(10, { species: 'c3' }));
        expect(GPE.compute(10, { species: 'c3' })).toBeGreaterThan(GPE.compute(5, { species: 'c3' }));
        expect(GPE.compute(20, { species: 'c3' })).toBeGreaterThan(GPE.compute(25, { species: 'c3' }));
        expect(GPE.compute(25, { species: 'c3' })).toBeGreaterThan(GPE.compute(30, { species: 'c3' }));
    });
});

describe('GilbaGrowthPotentialEngine — PACE C4 (T_opt=31, sigma=7.0)', function () {

    test('GP = 1.0 at optimum (31°C)', function () {
        expect(GPE.compute(31, { species: 'c4' })).toBeCloseTo(1.0, 5);
    });

    test('GP ≈ 0.2909 at 20°C — handover doc reference', function () {
        // Handover: 0.290923
        expect(GPE.compute(20, { species: 'c4' })).toBeCloseTo(0.2909, 3);
    });

    test('GP ≈ 0.6926 at 25°C', function () {
        // Handover: 0.692569
        expect(GPE.compute(25, { species: 'c4' })).toBeCloseTo(0.6926, 3);
    });

    test('GP ≈ 0.0113 at 10°C (cold suppression)', function () {
        // Handover: 0.011252
        expect(GPE.compute(10, { species: 'c4' })).toBeCloseTo(0.0113, 3);
    });

    test('C4 GP at 20°C is much lower than C3 GP at 20°C', function () {
        expect(GPE.compute(20, { species: 'c4' })).toBeLessThan(GPE.compute(20, { species: 'c3' }));
    });

    test('C4 GP at 33°C is much higher than C3 GP at 33°C (warm-season advantage)', function () {
        expect(GPE.compute(33, { species: 'c4' })).toBeGreaterThan(GPE.compute(33, { species: 'c3' }));
    });
});

describe('GilbaGrowthPotentialEngine — default model is pace, blend mode', function () {

    test('omitting model option equals explicit pace call (default has not drifted)', function () {
        var explicit = GPE.compute(15, { model: 'pace', species: 'c3' });
        var implicit = GPE.compute(15, { species: 'c3' });
        expect(explicit).toBeCloseTo(implicit, 5);
    });

    test('blend mode equals manual C3/C4 weighting at 0.7 C3 fraction', function () {
        var c3f = 0.7, c4f = 0.3;
        var blended = GPE.compute(18, { species: 'blend', c3Fraction: c3f });
        var manual  = c3f * GPE.compute(18, { species: 'c3' }) + c4f * GPE.compute(18, { species: 'c4' });
        expect(blended).toBeCloseTo(manual, 5);
    });

    test('PACE coefficients are exactly T_opt=20/sigma=5.5 for C3 and T_opt=31/sigma=7.0 for C4', function () {
        var c3coeff = GPE.getCoefficients('pace', 'c3');
        var c4coeff = GPE.getCoefficients('pace', 'c4');
        expect(c3coeff.optimum).toBe(20);
        expect(c3coeff.sigma).toBe(5.5);
        expect(c4coeff.optimum).toBe(31);
        expect(c4coeff.sigma).toBe(7.0);
    });
});


// =============================================================================
// 2. calcGPP (climate-engine-v2 wrapper) — delegates to canonical engine
// =============================================================================

describe('calcGPP — delegates to GilbaGrowthPotentialEngine (PACE)', function () {

    test('C3 at 20°C ≈ 1.0 (rounds to 3dp in engine wrapper)', function () {
        expect(calcGPP(20, 'c3')).toBeCloseTo(1.0, 2);
    });

    test('C3 at 7.4°C ≈ 0.073 — matches production anchor (calcGPP rounds to 3dp)', function () {
        // Engine returns 0.0725026; calcGPP rounds to 3dp → 0.073
        expect(calcGPP(7.4, 'c3')).toBeCloseTo(0.073, 2);
    });

    test('C3 at 10°C ≈ 0.191', function () {
        expect(calcGPP(10, 'c3')).toBeCloseTo(0.191, 2);
    });

    test('C4 at 31°C ≈ 1.0', function () {
        expect(calcGPP(31, 'c4')).toBeCloseTo(1.0, 2);
    });

    test('calcGPP returns null when temperature is null', function () {
        expect(calcGPP(null, 'c3')).toBeNull();
    });

    test('calcGPP C3/C4 ratio at 20°C matches engine directly', function () {
        var engineC3 = GPE.compute(20, { species: 'c3' });
        var engineC4 = GPE.compute(20, { species: 'c4' });
        expect(calcGPP(20, 'c3')).toBeCloseTo(engineC3, 2);
        expect(calcGPP(20, 'c4')).toBeCloseTo(engineC4, 2);
    });
});

describe('calcWeightedGPP — mixed C3/C4 turf', function () {

    test('pure C3 profile returns C3 GP', function () {
        var r = calcWeightedGPP(10, 1, 0);
        expect(r.weighted).toBeCloseTo(calcGPP(10, 'c3'), 2);
        expect(r.c3).toBeCloseTo(calcGPP(10, 'c3'), 2);
    });

    test('pure C4 profile returns C4 GP', function () {
        var r = calcWeightedGPP(31, 0, 1);
        expect(r.weighted).toBeCloseTo(calcGPP(31, 'c4'), 2);
        expect(r.c4).toBeCloseTo(calcGPP(31, 'c4'), 2);
    });

    test('50/50 mix at 20°C is average of C3 and C4 GP', function () {
        var r = calcWeightedGPP(20, 0.5, 0.5);
        var expected = (calcGPP(20, 'c3') + calcGPP(20, 'c4')) / 2;
        expect(r.weighted).toBeCloseTo(expected, 2);
    });
});


// =============================================================================
// 3. Single-source audit — no local GP Gaussian outside the canonical engine
//    (b35fix473 handover doc Section 8)
// =============================================================================

describe('GP single-source audit — no local Gaussian in assets', function () {

    var fs   = require('fs');
    var path = require('path');
    var ASSETS_DIR = path.join(__dirname, '../assets');

    // Files legitimately allowed to contain GP-shaped Gaussians (pathogen curves,
    // physical models, visual rendering helpers — not turf growth potential)
    var EXCLUDED = [
        'growth-potential-engine.js',   // canonical engine — the ONE allowed source
        'disease-engine-pure.js',       // pathogen temperature-response curves
        'disease-forecast.js',          // pathogen curves
        'red-thread-model.js',          // pathogen curve
        'bipolaris-curvularia-models.js', // pathogen curves
        'smith-kerns-model.js',         // pathogen model
        'growth-light-analysis.js',     // gaus() helper is for SVG bell-curve rendering only
        'gaip-scenario-engine.js',      // Math.exp in calculateDiseaseRisk() — pathogen curve, not turf GP
        'gssh-scenario-engine.js',      // same: disease risk Gaussian, not turf GP
        'docx.min.js',                  // minified library — sigma appears in Unicode table
        'uk-fertiliser-products.js',    // product IDs containing "sigma" in name
    ];

    test('no module outside the canonical engine reimplements the PACE Gaussian for turf GP', function () {
        var violations = [];

        var files = fs.readdirSync(ASSETS_DIR).filter(function (f) {
            return f.endsWith('.js') && !EXCLUDED.includes(f);
        });

        files.forEach(function (file) {
            var src = fs.readFileSync(path.join(ASSETS_DIR, file), 'utf8');
            // Pattern: Math.exp(-0.5 with a temperature offset around 20 or 31
            // (the PACE optima). A sigma=5.5 or 7.0 nearby is even more diagnostic.
            var hasGaussian = /Math\.exp\s*\(\s*-0\.5\s*\*\s*Math\.pow/.test(src);
            if (hasGaussian) {
                violations.push(file);
            }
        });

        if (violations.length > 0) {
            console.error('Files with local GP Gaussian (should use GilbaGrowthPotentialEngine):', violations);
        }
        expect(violations).toEqual([]);
    });

    test('gaip-scenario-engine uses GilbaGrowthPotentialEngine for getGrowthPotential', function () {
        var src = fs.readFileSync(path.join(ASSETS_DIR, 'gaip-scenario-engine.js'), 'utf8');
        expect(src).toContain('GilbaGrowthPotentialEngine');
    });

    test('gssh-scenario-engine uses GilbaGrowthPotentialEngine for getGrowthPotential', function () {
        var src = fs.readFileSync(path.join(ASSETS_DIR, 'gssh-scenario-engine.js'), 'utf8');
        expect(src).toContain('GilbaGrowthPotentialEngine');
    });

    test('hub-tissue-v3 uses GilbaGrowthPotentialEngine for calcC3/C4GrowthPotential', function () {
        var src = fs.readFileSync(path.join(ASSETS_DIR, 'hub-tissue-v3.js'), 'utf8');
        expect(src).toContain('GilbaGrowthPotentialEngine');
    });

    test('nutrition-summary-integration uses GilbaGrowthPotentialEngine', function () {
        var src = fs.readFileSync(path.join(ASSETS_DIR, 'nutrition-summary-integration.js'), 'utf8');
        expect(src).toContain('GilbaGrowthPotentialEngine');
    });
});


// =============================================================================
// 4. Stress classification (classifyStress)
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
// 5. Light / DLI — shade modifier in DollarSpotModel
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
        var noShade    = DollarSpotModel.calculate(DS_ACTIVE_CLIMATE, null, null, null, null);
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

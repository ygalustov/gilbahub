/**
 * DiseaseEnginePure integration tests — biological correctness across all models
 *
 * Covers models that have no dedicated test file:
 *   Pythium, Fusarium (analyse() path), brownPatch (via analyse()),
 *   dollarSpot (via analyse()), takeAll (via analyse())
 *
 * Two main angles:
 *   1. Individual model calculate() — temperature gates and humidity thresholds
 *   2. analyse() orchestration — disease list composition matches expected
 *      biology for cold-winter and warm-tropical climate scenarios
 */

global.window   = global.window   || {};
global.document = global.document || { addEventListener: () => {}, documentElement: {} };
global.console  = { group: () => {}, groupEnd: () => {}, groupCollapsed: () => {},
                    log: () => {}, warn: () => {}, info: () => {}, error: () => {} };

const DiseaseEnginePure = require('../assets/disease-engine-pure.js');

// ── helpers ───────────────────────────────────────────────────────────────────

function findDisease(result, key) {
    return (result.diseases || []).find(function (d) { return d.disease === key; }) || null;
}

// Minimal climate for warm-tropical AU conditions
// (brown patch + pythium both active; fusarium suppressed)
var WARM_TROPICAL = {
    temperature: { min: 26, max: 36, mean: 31 },
    moisture:    { humidity: { mean: 95 } },
};

// Cold NZ/UK winter conditions
// (fusarium highly active; brown patch, pythium, dollar spot suppressed)
var COLD_WINTER = {
    temperature: { min: 2, max: 8, mean: 5 },
    moisture:    { humidity: { mean: 92 }, precipitation: { total: 8 } },
};


// =============================================================================
// 1. PythiumModel — temperature gate and active range
// =============================================================================

describe('PythiumModel — night temperature gate', () => {
    var Pythium = DiseaseEnginePure.models.pythium;

    test('riskScore is 0 when nightMin < 20°C (outbreak gate not met)', function () {
        // Night temp gate: riskScore = 0 below 20°C minimum regardless of RH.
        // Warm-humid day but night stays at 18°C — gate must fire.
        var result = Pythium.calculate({
            temperature: { min: 18, max: 30, mean: 24, nightMin: 18 },
            moisture:    { humidity: { mean: 95 } },
        }, null, null, null);
        expect(result.riskScore).toBe(0);
    });

    test('riskScore > 0 when nightMin ≥ 20°C and RH ≥ 90%', function () {
        var result = Pythium.calculate({
            temperature: { min: 22, max: 32, mean: 27, nightMin: 22 },
            moisture:    { humidity: { mean: 95 } },
        }, null, null, null);
        expect(result.riskScore).toBeGreaterThan(0);
        expect(result.disease).toBe('pythiumBlight');
    });

    test('riskScore is 0 in cold winter conditions (T=5°C)', function () {
        var result = Pythium.calculate({
            temperature: { min: 2, max: 8, mean: 5, nightMin: 2 },
            moisture:    { humidity: { mean: 92 } },
        }, null, null, null);
        expect(result.riskScore).toBe(0);
    });

    test('result includes required fields', function () {
        var result = Pythium.calculate({
            temperature: { min: 22, max: 32, mean: 27, nightMin: 22 },
            moisture:    { humidity: { mean: 90 } },
        }, null, null, null);
        expect(result.disease).toBe('pythiumBlight');
        expect(result.displayName).toBe('Pythium Blight');
        expect(typeof result.riskScore).toBe('number');
        expect(result.riskScore).toBeGreaterThanOrEqual(0);
        expect(result.riskScore).toBeLessThanOrEqual(100);
        expect(result.nutterShaneForecast).toBeDefined();
    });

    test('nutterShaneForecast.available is false without hourly RH data', function () {
        // Nutter/Shane boolean requires ≥12 hourly RH entries to count >90% hours.
        // Without hourlyData, available must be false — never fabricates a verdict.
        var result = Pythium.calculate({
            temperature: { min: 22, max: 33, mean: 27, nightMin: 22 },
            moisture:    { humidity: { mean: 95 } },
        }, null, null, null);
        expect(result.nutterShaneForecast.available).toBe(false);
    });
});


// =============================================================================
// 2. FusariumModel — temperature gate (via analyse() path integration)
// =============================================================================

describe('FusariumModel — temperature suppression in warm conditions', () => {
    var Fusarium = DiseaseEnginePure.models.fusarium;

    test('riskScore is 0 at T ≥ 22°C (model gate fires above active range)', function () {
        var result = Fusarium.calculate({
            temperature: { mean: 22, min: 18, max: 26 },
            moisture:    { humidity: { mean: 90 } },
            precipitation: { total: 5 },
        }, { status: 'adequate' }, {});
        expect(result.riskScore).toBe(0);
        expect(result.drivers.temperature.note).toMatch(/Too warm for Fusarium/);
    });

    test('riskScore is high at optimal temperature (T=6°C, RH=92%)', function () {
        var result = Fusarium.calculate({
            temperature: { mean: 6, min: 3, max: 9 },
            moisture:    { humidity: { mean: 92 }, },
            precipitation: { total: 8 },
        }, { status: 'adequate' }, {});
        expect(result.riskScore).toBeGreaterThan(60);
    });

    test('temperature contribution is 0 at sub-zero but moisture can still drive risk', function () {
        var result = Fusarium.calculate({
            temperature: { mean: -5, min: -8, max: -2 },
            moisture:    { humidity: { mean: 90 } },
            precipitation: { total: 10 },
        }, { status: 'adequate' }, {});
        expect(result.drivers.temperature.contribution).toBe(0);
        expect(result.riskScore).toBeLessThan(50);
    });
});


// =============================================================================
// 3. analyse() — cold winter scenario (NZ/UK)
// =============================================================================

describe('analyse() — cold winter scenario (T=5°C, RH=92%)', () => {

    var coldResult;
    beforeAll(function () {
        coldResult = DiseaseEnginePure.analyse({
            climate: COLD_WINTER,
            species: 'perennialRyegrass',
            region:  'AU',
        });
    });

    test('returns a result with diseases array', function () {
        expect(coldResult).toBeDefined();
        expect(Array.isArray(coldResult.diseases)).toBe(true);
    });

    test('fusarium is present and high-risk (primary cold-season threat)', function () {
        var f = findDisease(coldResult, 'fusarium');
        expect(f).not.toBeNull();
        expect(f.adjustedRisk).toBeGreaterThan(50);
    });

    test('brownPatch is absent or near-zero (Fidanza E2 = -5 at Tmin 2°C)', function () {
        // E2 = -21.5 + 0.15*92 + 1.4*2 - 0.033*4 = -5.03 → well below threshold 6.
        var bp = findDisease(coldResult, 'brownPatch');
        if (bp) {
            expect(bp.adjustedRisk).toBeLessThan(10);
        } else {
            expect(bp).toBeNull();
        }
    });

    test('pythiumBlight is absent or zero (night temp gate: min 2°C < 20°C)', function () {
        var py = findDisease(coldResult, 'pythiumBlight');
        if (py) {
            expect(py.adjustedRisk).toBe(0);
        } else {
            expect(py).toBeNull();
        }
    });

    test('dollarSpot is absent or zero (temperature gate: 5°C < 10°C minimum)', function () {
        var ds = findDisease(coldResult, 'dollarSpot');
        if (ds) {
            expect(ds.adjustedRisk).toBe(0);
        } else {
            expect(ds).toBeNull();
        }
    });

    test('overall result has required fields', function () {
        expect(typeof coldResult.overallScore).toBe('number');
        expect(coldResult.overallRisk).toBeDefined();
        expect(coldResult.species).toBe('perennialRyegrass');
        expect(Array.isArray(coldResult.topThreats)).toBe(true);
    });
});


// =============================================================================
// 4. analyse() — warm tropical scenario (AU summer)
// =============================================================================

describe('analyse() — warm tropical scenario (T=31°C, RH=95%)', () => {

    var warmResult;
    beforeAll(function () {
        warmResult = DiseaseEnginePure.analyse({
            climate: WARM_TROPICAL,
            species: 'perennialRyegrass',
            region:  'AU',
        });
    });

    test('returns a result with diseases array', function () {
        expect(warmResult).toBeDefined();
        expect(Array.isArray(warmResult.diseases)).toBe(true);
        expect(warmResult.diseases.length).toBeGreaterThan(0);
    });

    test('brownPatch is present with high risk (Fidanza E2 ≈ 6.84 → >60%)', function () {
        var bp = findDisease(warmResult, 'brownPatch');
        expect(bp).not.toBeNull();
        expect(bp.adjustedRisk).toBeGreaterThan(60);
        expect(['moderate', 'high', 'severe']).toContain(bp.riskLevel);
    });

    test('pythiumBlight is present (night temp 26°C ≥ 20°C gate, RH 95%)', function () {
        var py = findDisease(warmResult, 'pythiumBlight');
        expect(py).not.toBeNull();
        expect(py.adjustedRisk).toBeGreaterThan(0);
    });

    test('fusarium is absent (T=22°C gate suppresses it at T=31°C)', function () {
        var f = findDisease(warmResult, 'fusarium');
        if (f) {
            expect(f.adjustedRisk).toBe(0);
        } else {
            expect(f).toBeNull();
        }
    });

    test('dollarSpot is present (T=31°C in active 10-35°C range, RH=95%)', function () {
        var ds = findDisease(warmResult, 'dollarSpot');
        expect(ds).not.toBeNull();
        expect(ds.adjustedRisk).toBeGreaterThan(0);
    });

    test('each disease object has required fields', function () {
        warmResult.diseases.forEach(function (d) {
            expect(typeof d.disease).toBe('string');
            expect(typeof d.adjustedRisk).toBe('number');
            expect(d.adjustedRisk).toBeGreaterThanOrEqual(0);
            expect(d.adjustedRisk).toBeLessThanOrEqual(100);
            expect(d.riskLevel).toBeDefined();
            expect(d.recommendation).toBeDefined();
        });
    });
});


// =============================================================================
// 5. analyse() — species suppression
// =============================================================================

describe('analyse() — brownPatch absent from species with zero susceptibility', () => {

    test('bentgrass has brownPatch susceptibility > 0 and receives risk at warm-humid', function () {
        var result = DiseaseEnginePure.analyse({
            climate: WARM_TROPICAL,
            species: 'bentgrass',
            region:  'AU',
        });
        var bp = findDisease(result, 'brownPatch');
        expect(bp).not.toBeNull();
        expect(bp.adjustedRisk).toBeGreaterThan(0);
    });

    test('poaAnnua at warm-humid: brownPatch present (suscept = 1.0, no scaling suppression)', function () {
        var result = DiseaseEnginePure.analyse({
            climate: WARM_TROPICAL,
            species: 'poaAnnua',
            region:  'AU',
        });
        var bp = findDisease(result, 'brownPatch');
        expect(bp).not.toBeNull();
        expect(bp.adjustedRisk).toBeGreaterThan(60);
    });
});


// =============================================================================
// 6. analyse() — soil Mn drives Take-all risk (full inputs vs partial)
// =============================================================================

// Take-all optimal temperature: 14.5°C ± 4.5°C (range ~10–19°C).
// Bentgrass susceptibility = 1.5 (passes dispatcher gate > 0.5).
var TAKEALL_CLIMATE = {
    temperature: { min: 10, max: 18, mean: 14 },
    moisture:    { humidity: { mean: 80 }, precipitation: { total: 3 } },
};

describe('TakeAllModel — soil Mn_ppm affects risk (b35fix84 full-inputs)', () => {

    test('Mn-deficient soil (5 ppm) gives higher Take-all risk than adequate (25 ppm)', function () {
        var highMn = DiseaseEnginePure.analyse({
            climate: TAKEALL_CLIMATE,
            species: 'bentgrass',
            soil:    { Mn_ppm: 25, pH: 6.5 },
            region:  'AU',
        });
        var lowMn = DiseaseEnginePure.analyse({
            climate: TAKEALL_CLIMATE,
            species: 'bentgrass',
            soil:    { Mn_ppm: 5, pH: 6.5 },
            region:  'AU',
        });
        var taHigh = findDisease(highMn, 'takeAll');
        var taLow  = findDisease(lowMn,  'takeAll');
        var scoreHigh = taHigh ? taHigh.adjustedRisk : 0;
        var scoreLow  = taLow  ? taLow.adjustedRisk  : 0;
        expect(scoreLow).toBeGreaterThan(scoreHigh);
    });

    test('Take-all drivers.manganese.value reflects actual soil Mn_ppm passed in', function () {
        var result = DiseaseEnginePure.analyse({
            climate: TAKEALL_CLIMATE,
            species: 'bentgrass',
            soil:    { Mn_ppm: 8, pH: 6.5 },
            region:  'AU',
        });
        var ta = findDisease(result, 'takeAll');
        expect(ta).not.toBeNull();
        expect(ta.drivers).toBeDefined();
        expect(ta.drivers.manganese).toBeDefined();
        expect(ta.drivers.manganese.value).toBe(8);
    });

    test('high pH (7.8) raises Take-all risk vs neutral pH (6.5) — reduces Mn availability', function () {
        var neutralPH = DiseaseEnginePure.analyse({
            climate: TAKEALL_CLIMATE,
            species: 'bentgrass',
            soil:    { Mn_ppm: 12, pH: 6.5 },
            region:  'AU',
        });
        var highPH = DiseaseEnginePure.analyse({
            climate: TAKEALL_CLIMATE,
            species: 'bentgrass',
            soil:    { Mn_ppm: 12, pH: 7.8 },
            region:  'AU',
        });
        var taNeutral = findDisease(neutralPH, 'takeAll');
        var taHigh    = findDisease(highPH,    'takeAll');
        var scoreNeutral = taNeutral ? taNeutral.adjustedRisk : 0;
        var scoreHigh    = taHigh    ? taHigh.adjustedRisk    : 0;
        expect(scoreHigh).toBeGreaterThan(scoreNeutral);
    });
});


// =============================================================================
// 7. analyse() — nitrogen status affects disease risk
// =============================================================================

// Fusarium is amplified by excess nitrogen (lush soft tissue).
// Optimal Fusarium climate: ~6°C mean, high RH.
var FUSARIUM_CLIMATE = {
    temperature: { min: 3, max: 10, mean: 6 },
    moisture:    { humidity: { mean: 92 }, precipitation: { total: 5 } },
};

describe('analyse() — nitrogen status modifies disease risk', () => {

    // b35fix495: nModifier retired from Fusarium riskScore — N is now qualitative only.
    // adjustedRisk is identical across N statuses; winterRisk flag distinguishes them.
    test('Fusarium adjustedRisk is N-neutral; winterRisk flag differs by N status', function () {
        var highN = DiseaseEnginePure.analyse({
            climate:  FUSARIUM_CLIMATE,
            species:  'perennialRyegrass',
            nitrogen: { status: 'excessive' },
            region:   'AU',
        });
        var lowN = DiseaseEnginePure.analyse({
            climate:  FUSARIUM_CLIMATE,
            species:  'perennialRyegrass',
            nitrogen: { status: 'deficient' },
            region:   'AU',
        });
        var fHigh = findDisease(highN, 'fusarium');
        var fLow  = findDisease(lowN,  'fusarium');
        expect(fHigh).not.toBeNull();
        expect(fLow).not.toBeNull();
        // Same formula output — N does not change riskScore since b35fix495
        expect(fHigh.adjustedRisk).toBe(fLow.adjustedRisk);
        // Qualitative flag: excessive N at ≤15°C triggers winterRisk
        expect(fHigh.drivers.nitrogen.winterRisk).toBe(true);
        expect(fLow.drivers.nitrogen.winterRisk).toBe(false);
    });

    test('nitrogen status object is accepted as { status } shape (mirrors buildDiseaseInputs output)', function () {
        // Verify the engine accepts the same nitrogen shape that disease-analysis.js now builds
        var result = DiseaseEnginePure.analyse({
            climate:  FUSARIUM_CLIMATE,
            species:  'perennialRyegrass',
            nitrogen: { status: 'adequate', value: 4.1, thresholds: { deficient: 3.0, low: 3.5, optimal: 4.25, high: 5.0, excessive: 5.5 } },
            region:   'AU',
        });
        var f = findDisease(result, 'fusarium');
        expect(f).not.toBeNull();
        expect(f.adjustedRisk).toBeGreaterThan(0);
    });
});

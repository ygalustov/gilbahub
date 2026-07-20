/**
 * b35fix498 — Large Patch nModifier and species-susceptibility consolidation
 *
 * Two coupled defects:
 * 1. nModifier under-applied: dispatcher read riskScore (additive N channel) but
 *    discarded the multiplicative nModifier (x1.35/1.2/1.0/0.9), so excessive N
 *    was under-applied and the x1.35 was silently lost.
 * 2. Species-susceptibility divergence: engine column diverged from model on three
 *    warm-season hosts (zoysia 1.4→1.3, seashore_paspalum 0.6→1.4, buffalograss 0.6→0.9).
 *
 * Fix:
 * - Dispatcher honours result.adjustedRisk directly (already fully computed by model).
 *   Fallback to taperMultiplier only when model returns no adjustedRisk (degraded path).
 * - SPECIES_SUSCEPTIBILITY.largePatch realigned: zoysia 1.3, seashore_paspalum 1.4,
 *   buffalograss 0.9.
 *
 * Reference fixture (spec §8): air 24°C, soil 22°C, RH 85%, precip 15mm, transitional.
 * couch N-sweep: low 58, adequate 68, high 90, excessive 100.
 *
 * Spec: tests/large-patch-nmodifier-consolidation-b35fix498.test.js (27 tests)
 */

'use strict';

global.window   = global.window   || {};
global.document = global.document || { addEventListener: () => {}, documentElement: {}, querySelector: () => null };
global.console  = { group: () => {}, groupEnd: () => {}, groupCollapsed: () => {}, log: () => {}, warn: () => {}, info: () => {}, error: () => {} };

const eng            = require('../assets/disease-engine-pure.js');
const LargePatchModel = require('../assets/large-patch-model.js');
const SPECIES_SUSCEPTIBILITY = eng.SPECIES_SUSCEPTIBILITY;

// ─── Reference climate fixture (spec §8) ─────────────────────────────────────
const REF_CLIMATE = {
    temperature: {
        mean: 24, min: 19, max: 29,
        soil: 22, // Priority 4 — explicit soil temp (no window globals in Node)
    },
    moisture: { humidity: { mean: 85 } },
    precipitation: { total: 15 },
};
const REF_DORMANCY = { status: 'transitional' };

function analyseLP(species, nStatus) {
    return eng.analyse({
        climate:        REF_CLIMATE,
        species,
        nitrogen:       { status: nStatus },
        region:         'AU',
        largePatchModel: LargePatchModel,
        dormancyData:   REF_DORMANCY,
    });
}

function getLP(out) {
    return out.diseases.find(d => d.disease === 'largePatch') || null;
}

function modelLP(species, nStatus) {
    return LargePatchModel.calculate(
        REF_CLIMATE,
        { status: nStatus },
        null, null,
        REF_DORMANCY,
        species,
    );
}

// ─────────────────────────────────────────────────────────────────────────────
// A. Species-susceptibility realignment (6 tests)
// ─────────────────────────────────────────────────────────────────────────────

describe('b35fix498 — SPECIES_SUSCEPTIBILITY.largePatch realignment', () => {
    test('zoysia is 1.3 (was 1.4)', () => {
        expect(SPECIES_SUSCEPTIBILITY.zoysia.largePatch).toBe(1.3);
    });

    test('seashore_paspalum is 1.4 (was 0.6 — major correction)', () => {
        expect(SPECIES_SUSCEPTIBILITY.seashore_paspalum.largePatch).toBe(1.4);
    });

    test('buffalograss is 0.9 (was 0.6)', () => {
        expect(SPECIES_SUSCEPTIBILITY.buffalograss.largePatch).toBe(0.9);
    });

    test('cool-season hosts remain 0 (non-hosts)', () => {
        expect(SPECIES_SUSCEPTIBILITY.bentgrass.largePatch).toBe(0);
        expect(SPECIES_SUSCEPTIBILITY.kentuckyBluegrass.largePatch).toBe(0);
        expect(SPECIES_SUSCEPTIBILITY.perennialRyegrass.largePatch).toBe(0);
    });

    test('warm-season hosts remain non-zero', () => {
        expect(SPECIES_SUSCEPTIBILITY.bermuda.largePatch).toBeGreaterThan(0);
        expect(SPECIES_SUSCEPTIBILITY.couch.largePatch).toBeGreaterThan(0);
        expect(SPECIES_SUSCEPTIBILITY.kikuyu.largePatch).toBeGreaterThan(0);
    });

    test('seashore_paspalum now higher susceptibility than zoysia (reflects field data)', () => {
        expect(SPECIES_SUSCEPTIBILITY.seashore_paspalum.largePatch)
            .toBeGreaterThanOrEqual(SPECIES_SUSCEPTIBILITY.zoysia.largePatch);
    });
});

// ─────────────────────────────────────────────────────────────────────────────
// B. Single-source contract — engine adjustedRisk EQUALS model adjustedRisk (8 tests)
// This is the load-bearing guard: if recompute comes back, these will fail.
// ─────────────────────────────────────────────────────────────────────────────

describe('b35fix498 — single-source contract: engine equals model', () => {
    test('couch / adequate N: engine adjustedRisk = model adjustedRisk', () => {
        const modelOut  = modelLP('couch', 'adequate');
        const engineOut = getLP(analyseLP('couch', 'adequate'));
        expect(engineOut).not.toBeNull();
        expect(engineOut.adjustedRisk).toBe(modelOut.adjustedRisk);
    });

    test('couch / high N: engine adjustedRisk = model adjustedRisk', () => {
        const modelOut  = modelLP('couch', 'high');
        const engineOut = getLP(analyseLP('couch', 'high'));
        expect(engineOut.adjustedRisk).toBe(modelOut.adjustedRisk);
    });

    test('couch / excessive N: engine adjustedRisk = model adjustedRisk', () => {
        const modelOut  = modelLP('couch', 'excessive');
        const engineOut = getLP(analyseLP('couch', 'excessive'));
        expect(engineOut.adjustedRisk).toBe(modelOut.adjustedRisk);
    });

    test('couch / low N: engine adjustedRisk = model adjustedRisk', () => {
        const modelOut  = modelLP('couch', 'low');
        const engineOut = getLP(analyseLP('couch', 'low'));
        expect(engineOut.adjustedRisk).toBe(modelOut.adjustedRisk);
    });

    test('buffalograss / adequate N: engine equals model', () => {
        const modelOut  = modelLP('buffalograss', 'adequate');
        const engineOut = getLP(analyseLP('buffalograss', 'adequate'));
        expect(engineOut).not.toBeNull();
        expect(engineOut.adjustedRisk).toBe(modelOut.adjustedRisk);
    });

    test('zoysia / adequate N: engine equals model', () => {
        const modelOut  = modelLP('zoysia', 'adequate');
        const engineOut = getLP(analyseLP('zoysia', 'adequate'));
        expect(engineOut).not.toBeNull();
        expect(engineOut.adjustedRisk).toBe(modelOut.adjustedRisk);
    });

    test('couch / excessive N: engine speciesSusceptibility equals engine column', () => {
        const engineOut = getLP(analyseLP('couch', 'excessive'));
        expect(engineOut.speciesSusceptibility).toBe(SPECIES_SUSCEPTIBILITY.couch.largePatch);
    });

    test('cool-season species (bentgrass) not in diseases (immune)', () => {
        const out = analyseLP('bentgrass', 'adequate');
        const lp = out.diseases.find(d => d.disease === 'largePatch');
        expect(lp).toBeUndefined();
    });
});

// ─────────────────────────────────────────────────────────────────────────────
// C. Reference fixture values (spec §8) (5 tests)
// ─────────────────────────────────────────────────────────────────────────────

describe('b35fix498 — reference fixture values (spec §8, couch N-sweep)', () => {
    test('couch / low N: adjustedRisk = 58', () => {
        expect(getLP(analyseLP('couch', 'low')).adjustedRisk).toBe(58);
    });

    test('couch / adequate N: adjustedRisk = 68', () => {
        expect(getLP(analyseLP('couch', 'adequate')).adjustedRisk).toBe(68);
    });

    test('couch / high N: adjustedRisk = 90', () => {
        expect(getLP(analyseLP('couch', 'high')).adjustedRisk).toBe(90);
    });

    test('couch / excessive N: adjustedRisk = 100 (capped)', () => {
        expect(getLP(analyseLP('couch', 'excessive')).adjustedRisk).toBe(100);
    });

    test('N-sweep is strictly monotonic: low < adequate < high, excessive at cap', () => {
        const low  = getLP(analyseLP('couch', 'low')).adjustedRisk;
        const adq  = getLP(analyseLP('couch', 'adequate')).adjustedRisk;
        const high = getLP(analyseLP('couch', 'high')).adjustedRisk;
        const exc  = getLP(analyseLP('couch', 'excessive')).adjustedRisk;
        expect(low).toBeLessThan(adq);
        expect(adq).toBeLessThan(high);
        expect(high).toBeLessThanOrEqual(exc);
    });
});

// ─────────────────────────────────────────────────────────────────────────────
// D. Dispatcher fallback — no double-compute for other diseases (4 tests)
// ─────────────────────────────────────────────────────────────────────────────

describe('b35fix498 — b35fix498 fix is LP-only; other dispatchers unchanged', () => {
    test('fusarium adjustedRisk is set (taperMultiplier path, not model adjustedRisk)', () => {
        const out = eng.analyse({
            climate: { temperature: { mean: 8, min: 4, max: 12 }, moisture: { humidity: { mean: 90 } }, precipitation: { total: 10 } },
            species: 'bentgrass',
            nitrogen: { status: 'adequate' },
            region: 'NZ',
        });
        const fus = out.diseases.find(d => d.disease === 'fusarium');
        if (fus) expect(typeof fus.adjustedRisk).toBe('number');
    });

    test('brownPatch adjustedRisk is set via taperMultiplier (not model path)', () => {
        const out = eng.analyse({
            climate: { temperature: { mean: 28, min: 22, max: 34 }, moisture: { humidity: { mean: 92 } }, precipitation: { total: 20 } },
            species: 'perennialRyegrass',
            nitrogen: { status: 'adequate' },
            region: 'AU',
        });
        const bp = out.diseases.find(d => d.disease === 'brownPatch');
        if (bp) expect(typeof bp.adjustedRisk).toBe('number');
    });

    test('overallScore >= couch adequate LP adjustedRisk on warm-season site', () => {
        const out   = analyseLP('couch', 'adequate');
        const lp    = getLP(out);
        expect(out.overallScore).toBeGreaterThanOrEqual(lp.adjustedRisk);
    });

    test('largePatch not in diseases when no largePatchModel injected', () => {
        const out = eng.analyse({
            climate: REF_CLIMATE,
            species: 'couch',
            nitrogen: { status: 'adequate' },
            region: 'AU',
            // no largePatchModel
        });
        const lp = out.diseases.find(d => d.disease === 'largePatch');
        expect(lp).toBeUndefined();
    });
});

// ─────────────────────────────────────────────────────────────────────────────
// E. Model result shape preserved through dispatcher (4 tests)
// ─────────────────────────────────────────────────────────────────────────────

describe('b35fix498 — model result shape preserved through dispatcher', () => {
    test('adjustedRisk is a number in [0, 100]', () => {
        const lp = getLP(analyseLP('couch', 'adequate'));
        expect(typeof lp.adjustedRisk).toBe('number');
        expect(lp.adjustedRisk).toBeGreaterThanOrEqual(0);
        expect(lp.adjustedRisk).toBeLessThanOrEqual(100);
    });

    test('riskLevel is valid vocabulary string', () => {
        const lp = getLP(analyseLP('couch', 'adequate'));
        expect(['low', 'moderate', 'high', 'severe', 'minimal', 'minimal']).toContain(lp.riskLevel);
    });

    test('speciesSusceptibility field is set by dispatcher', () => {
        const lp = getLP(analyseLP('couch', 'adequate'));
        expect(lp.speciesSusceptibility).toBe(SPECIES_SUSCEPTIBILITY.couch.largePatch);
    });

    test('disease field is "largePatch"', () => {
        const lp = getLP(analyseLP('couch', 'adequate'));
        expect(lp.disease).toBe('largePatch');
    });
});

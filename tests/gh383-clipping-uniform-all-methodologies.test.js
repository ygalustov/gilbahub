/**
 * GH-383 — the export engine adopts nutrition-calendar.js's cited, per-nutrient
 * clipping-management model, for ALL THREE methodologies (decision D-1).
 *
 * Before GH-383 `nutrition-requirement-engine.js` carried a flat
 * CLIPPING_COLLECTION_FACTOR = 2.5 that
 *   - AMPLIFIED removal when clippings were COLLECTED (the calendar treats
 *     collected as the unmultiplied baseline and REDUCES for returned),
 *   - was cited only to its own predecessor file
 *     (nutrition-summary-integration.js v1.1.3), which carries the bare literal
 *     with no citation of its own, and
 *   - was applied in the MLSN branch only, so an AA or SLAN site's export
 *     figure ignored clipping management entirely while the Plan page's
 *     calendar applied it to every methodology.
 *
 * GH-383 replaces it with the calendar's own CONFIG.clippingManagement table
 * (collected {N 1, P 1, K 1}; returned {N 1, P 0.4, K 0.5}; Ca/Mg/S reuse the
 * K factor — Kopp & Guillard 2002, Qian et al. 2003), living in the shared
 * core and applied ONCE, before the methodology dispatch. The vocabulary is the
 * calendar's string ('collected' | 'returned' — the value the Plan select
 * writes and the programme persists as meta.clippingManagement).
 *
 * The pre-GH-383 boolean `clippingsCollected` is IGNORED, not aliased. It has
 * no writer anywhere in assets/ or app/ (only a legacy READ in
 * nutrition-summary-integration.js), so it has always arrived as false — "no
 * information", not "returned". Aliasing false to 'returned' would silently
 * halve K removal in the old hub's Nutrition Summary panel and in every
 * existing test that passes it; ignoring it keeps the factor at 1.0, which is
 * the number those callers already get.
 *
 * Fixture: Test5-NZ sample 141 in its live-verified below-floor state
 * (tests/fixtures/test5-soccer-sample141-belowfloor-gh370.json) — the one
 * fixture in this repo whose figures were read off BOTH rendered surfaces, so
 * the `collected` expectations here are the numbers the Plan page and the
 * Combined .docx actually printed.
 *
 * Runs the REAL modules with the same HillLabsSampleTypes /
 * AmmoniumAcetateMethodology / SpeciesController the browser loads, so
 * deriveCode('Perennial Ryegrass', 'sand') resolves S277 exactly as live.
 */

'use strict';

const fs = require('fs');
const path = require('path');

global.window = global.window || {};
global.document = global.document || {
    readyState: 'complete',
    addEventListener: function () {},
    getElementById: function () { return null; },
    querySelector: function () { return null; },
    querySelectorAll: function () { return []; }
};
global.console = { log: function () {}, warn: function () {}, error: function () {}, info: function () {} };
global.localStorage = { getItem: function () { return null; }, setItem: function () {} };

require('../assets/species-controller.js');
global.SpeciesController = global.window.SpeciesController;
const HLST = require('../assets/hill-labs-sample-types.js');
global.window.HillLabsSampleTypes = HLST;
// ammonium-acetate-methodology.js's load-time init() schedules a 1s DOM retry
// (setTimeout) that would otherwise keep the jest worker alive.
const _realSetTimeout = global.setTimeout;
global.setTimeout = function (fn, ms) {
    const t = _realSetTimeout(fn, ms);
    if (t && typeof t.unref === 'function') t.unref();
    return t;
};
require('../assets/ammonium-acetate-methodology.js');
global.setTimeout = _realSetTimeout;
global.window.AmmoniumAcetateMethodology = global.window.AmmoniumAcetateMethodology || global.AmmoniumAcetateMethodology;

const Core = require('../assets/nutrition-requirement-core.js');
global.window.NutritionRequirementCore = Core;
global.window.GAIP_NutritionProgramInputs = require('../assets/nutrition-program-inputs.js');

global.window.GilbaGrowthPotentialEngine = require('../assets/growth-potential-engine.js');
require('../assets/nutrition-calendar.js');
const Calendar = global.window.GilbaNutritionCalendar;
const Engine = require('../assets/nutrition-requirement-engine.js');

const fixture = JSON.parse(fs.readFileSync(
    path.join(__dirname, 'fixtures/test5-soccer-sample141-belowfloor-gh370.json'), 'utf8'));
const IN = fixture.inputs;
const MONTHLY_TEMPS_0_11 = [19.8, 20.4, 19.1, 17, 14.7, 12.6, 11.4, 11.8, 12.9, 14.2, 16, 18.2];

function resolveAaRanges() {
    const code = HLST.deriveCode(IN.species, IN.soilTexture);
    const out = {};
    ['P', 'K', 'Ca', 'Mg', 'S'].forEach((n) => {
        let r = code ? HLST.getRangesPpm(code, n, IN.CEC) : null;
        if (!r) {
            const g = global.window.AmmoniumAcetateMethodology.getSufficiencyRange(n, 'sands');
            r = { min: g.ranges.medium[0], max: g.ranges.medium[1] };
        }
        out[n] = r;
    });
    return out;
}
const AA_RANGES = resolveAaRanges();

function engineCompute(turfExtra, methodology) {
    return Engine.compute({
        soil: Object.assign({ methodology: methodology || 'AMMONIUM_ACETATE', pH: IN.pH, CEC: IN.CEC }, IN.soilPpm),
        turf: Object.assign({ species: IN.speciesKey, nProgramKgHaYr: IN.annualN }, turfExtra || {}),
        climate: { monthlyTemps: null },
        aaRanges: AA_RANGES,
        tissuePercent: IN.tissuePercent
    });
}

function calendarProgram(clippingManagement) {
    return Calendar.computeProgram({
        annualNOverride: IN.annualN,
        traffic: 'moderate',
        trafficModifier: 1.0,
        clippingManagement: clippingManagement,
        bulkDensity: IN.bulkDensity,
        soilDepth: IN.soilDepth,
        methodology: IN.methodology,
        species: IN.speciesKey,
        speciesDisplay: IN.species,
        soilTexture: IN.soilTexture,
        CEC: IN.CEC,
        isC4: false,
        distribution: 'gp_weighted',
        monthlyTemps: MONTHLY_TEMPS_0_11,
        soilPpm: IN.soilPpm,
        tissuePercent: IN.tissuePercent
    });
}

// Direct per-nutrient call, methodology varied, with the SAME annualN basis
// compute() resolves — so `removal` is comparable across the three branches.
function nutrientDirect(nutrient, currentLevel, methodology, cfgExtra) {
    return Engine._calculateNutrientRequirement(nutrient, currentLevel, Object.assign({
        methodology: methodology,
        species: IN.speciesKey,
        annualN: IN.annualN,
        ph: IN.pH,
        aaRange: AA_RANGES[nutrient],
        tissuePercent: IN.tissuePercent,
        bulkDensity: IN.bulkDensity,
        soilDepth: IN.soilDepth
    }, cfgExtra || {}));
}

describe('GH-383 case 1 — "collected" is the unmultiplied baseline: the live-verified figures do not move', () => {
    test('AA compute() at clippingManagement "collected" reproduces the rendered K 84.1 / P 40.9 (removal 57.4 / 33.9)', () => {
        const r = engineCompute({ clippingManagement: 'collected' });
        expect(r.perSample.K.removal).toBe(57.4);
        expect(r.perSample.P.removal).toBe(33.9);
        expect(r.perSample.K.annualRequirement).toBe(84.1);
        expect(r.perSample.P.annualRequirement).toBe(40.9);
    });

    test('methodology does not change `removal`: AA, SLAN and MLSN all report 57.4 for K and 33.9 for P at "collected"', () => {
        ['AMMONIUM_ACETATE', 'SLAN', 'MLSN'].forEach((m) => {
            expect(nutrientDirect('K', IN.soilPpm.K, m, { clippingManagement: 'collected' }).removal).toBe(57.4);
            expect(nutrientDirect('P', IN.soilPpm.P, m, { clippingManagement: 'collected' }).removal).toBe(33.9);
        });
    });
});

describe('GH-383 case 2 — "returned" reduces P and K by the calendar\'s own factors', () => {
    test('engine at "returned": K removal 28.7 (57.4 x 0.5), P removal 13.6 (33.9 x 0.4); requirements 55.4 / 20.6', () => {
        const r = engineCompute({ clippingManagement: 'returned' });
        expect(r.perSample.K.removal).toBe(28.7);
        expect(r.perSample.P.removal).toBe(13.6);
        expect(r.perSample.K.annualRequirement).toBe(55.4);   // 28.7 + 26.74
        expect(r.perSample.P.annualRequirement).toBe(20.6);   // 13.6 + 7.0
    });

    test('the lift term is untouched by clipping management (26.74 K / 7.0 P in both modes)', () => {
        const collected = engineCompute({ clippingManagement: 'collected' });
        const returned = engineCompute({ clippingManagement: 'returned' });
        expect(returned.perSample.K.correctionRequired).toBeCloseTo(collected.perSample.K.correctionRequired, 9);
        expect(returned.perSample.K.correctionRequired).toBeCloseTo(26.74, 6);
        expect(returned.perSample.P.correctionRequired).toBeCloseTo(7.0, 6);
    });

    test('the calendar on the same inputs at "returned" lands within 1 kg/ha of the engine', () => {
        const p = calendarProgram('returned');
        const e = engineCompute({ clippingManagement: 'returned' }).perSample;
        // Both engines round: the calendar to whole kg (twice), the core to 0.1
        // once. Parity is "within 1 kg/ha", and is asserted as such rather than
        // by widening any tolerance in the E2E harness.
        expect(Math.abs(e.K.removal - p.annual_removal.K)).toBeLessThanOrEqual(1);
        expect(Math.abs(e.P.removal - p.annual_removal.P)).toBeLessThanOrEqual(1);
        expect(Math.abs(e.K.annualRequirement - p.annual_totals.K)).toBeLessThanOrEqual(1);
        expect(Math.abs(e.P.annualRequirement - p.annual_totals.P)).toBeLessThanOrEqual(1);
    });
});

describe('GH-383 case 3 — uniform across methodologies and across Ca/Mg/S', () => {
    test('"returned" reduces `removal` under AA and SLAN too — the branches that ignored clipping management before', () => {
        ['AMMONIUM_ACETATE', 'SLAN', 'MLSN'].forEach((m) => {
            const collected = nutrientDirect('K', IN.soilPpm.K, m, { clippingManagement: 'collected' });
            const returned = nutrientDirect('K', IN.soilPpm.K, m, { clippingManagement: 'returned' });
            expect(returned.removal).toBeLessThan(collected.removal);
            expect(returned.removal).toBeCloseTo(collected.removal * 0.5, 1);
        });
    });

    test('Ca, Mg and S follow the K factor (returned / collected = 0.5 each), matching the calendar\'s STEP 3', () => {
        const collected = engineCompute({ clippingManagement: 'collected' }).perSample;
        const returned = engineCompute({ clippingManagement: 'returned' }).perSample;
        ['Ca', 'Mg', 'S'].forEach((n) => {
            expect(collected[n].removal).toBeGreaterThan(0);
            expect(returned[n].removal / collected[n].removal).toBeCloseTo(0.5, 2);
        });
    });
});

describe('GH-383 case 4 — polarity, and the 2.5x amplifier is gone', () => {
    test('collected / returned is 2.0 for K (1/0.5) and ~2.5 for P (1/0.4) — a REDUCTION for returned, never an amplification for collected', () => {
        const collected = engineCompute({ clippingManagement: 'collected' }).perSample;
        const returned = engineCompute({ clippingManagement: 'returned' }).perSample;
        expect(collected.K.removal / returned.K.removal).toBeCloseTo(2.0, 6);
        // 33.9 / 13.6 = 2.4926 — the 0.1-rounding residual on the P factor.
        expect(collected.P.removal / returned.P.removal).toBeCloseTo(2.5, 1);
        expect(collected.K.removal).toBeGreaterThan(returned.K.removal);
    });

    test('no 2.5x anywhere, and applied exactly ONCE: the MLSN branch\'s `removal` equals the AA branch\'s in BOTH modes', () => {
        // At "collected" the factor is 1.0, so this pass alone cannot detect a
        // second application -- it is the "returned" pass that proves the MLSN
        // path does not re-multiply what the shared core already applied (a
        // second 0.5 would give 14.35, not 28.7).
        ['collected', 'returned'].forEach((mode) => {
            ['K', 'P', 'Ca', 'Mg', 'S'].forEach((n) => {
                const mlsn = nutrientDirect(n, IN.soilPpm[n], 'MLSN', { clippingManagement: mode });
                const aa = nutrientDirect(n, IN.soilPpm[n], 'AMMONIUM_ACETATE', { clippingManagement: mode });
                expect(mlsn.removal).toBeCloseTo(aa.removal, 6);
                expect(mlsn.removal).toBeCloseTo(mlsn.removalBase * Engine._getClippingFactor(n, mode), 1);
            });
        });
    });

    test('the old flat constant is no longer exported', () => {
        expect(Engine.CLIPPING_COLLECTION_FACTOR).toBeUndefined();
    });
});

describe('GH-383 case 5 — the input contract (string only; the boolean is ignored, not aliased)', () => {
    const K_COLLECTED = 57.4;
    const K_RETURNED = 28.7;

    test('omitted clipping input == "collected" (the calendar\'s own `|| collected` default), NOT "returned"', () => {
        expect(engineCompute({}).perSample.K.removal).toBe(K_COLLECTED);
    });

    test('the legacy boolean is IGNORED in both directions — false must not become "returned"', () => {
        // This is the behaviour-preserving choice for every existing caller.
        // `clippingsCollected` has no writer anywhere in assets/ or app/, so it
        // has always been false; those callers' factor is 1.0 today and stays
        // 1.0. Aliasing false -> 'returned' would halve their K removal.
        expect(engineCompute({ clippingsCollected: true }).perSample.K.removal).toBe(K_COLLECTED);
        expect(engineCompute({ clippingsCollected: false }).perSample.K.removal).toBe(K_COLLECTED);
    });

    test('an explicit string is honoured whatever the boolean says', () => {
        expect(engineCompute({ clippingManagement: 'returned', clippingsCollected: true }).perSample.K.removal).toBe(K_RETURNED);
        expect(engineCompute({ clippingManagement: 'collected', clippingsCollected: false }).perSample.K.removal).toBe(K_COLLECTED);
    });

    test('an unknown string falls back to collected', () => {
        expect(engineCompute({ clippingManagement: 'mulched-partially' }).perSample.K.removal).toBe(K_COLLECTED);
        expect(Engine._resolveClippingManagement('nonsense')).toBe('collected');
        expect(Engine._resolveClippingManagement(null)).toBe('collected');
    });

    test('every returned object carries the resolved mode, its factor and the pre-clipping base', () => {
        const returned = engineCompute({ clippingManagement: 'returned' }).perSample;
        expect(returned.K.clippingManagement).toBe('returned');
        expect(returned.K.clippingFactor).toBe(0.5);
        expect(returned.K.removalBase).toBe(57.4);
        expect(returned.P.clippingFactor).toBe(0.4);
        expect(returned.P.removalBase).toBe(33.9);
        // ...on every methodology branch, not just AA.
        ['SLAN', 'MLSN'].forEach((m) => {
            const r = nutrientDirect('K', IN.soilPpm.K, m, { clippingManagement: 'returned' });
            expect(r.clippingManagement).toBe('returned');
            expect(r.clippingFactor).toBe(0.5);
            expect(r.removalBase).toBe(57.4);
        });
    });
});

describe('GH-383 case 6 — the factor table itself', () => {
    test('CLIPPING_FACTORS matches nutrition-calendar.js CONFIG.clippingManagement', () => {
        expect(Engine.CLIPPING_FACTORS).toEqual({
            collected: { N: 1.0, P: 1.0, K: 1.0 },
            returned: { N: 1.0, P: 0.4, K: 0.5 }
        });
        const cal = Calendar.config.clippingManagement;
        expect(Engine.CLIPPING_FACTORS.returned.P).toBe(cal.returned.pFactor);
        expect(Engine.CLIPPING_FACTORS.returned.K).toBe(cal.returned.kFactor);
        expect(Engine.CLIPPING_FACTORS.returned.N).toBe(cal.returned.nFactor);
        expect(Engine.CLIPPING_FACTORS.collected.P).toBe(cal.collected.pFactor);
        expect(Engine.CLIPPING_FACTORS.collected.K).toBe(cal.collected.kFactor);
        // One table: the engine re-exports the core's, it does not keep a copy.
        expect(Engine.CLIPPING_FACTORS).toBe(Core.CLIPPING_FACTORS);
    });

    test('getClippingFactor: N 1.0, P 0.4, K 0.5 at returned; Ca/Mg/S reuse K', () => {
        expect(Engine._getClippingFactor('N', 'returned')).toBe(1.0);
        expect(Engine._getClippingFactor('P', 'returned')).toBe(0.4);
        expect(Engine._getClippingFactor('K', 'returned')).toBe(0.5);
        expect(Engine._getClippingFactor('Ca', 'returned')).toBe(0.5);
        expect(Engine._getClippingFactor('Mg', 'returned')).toBe(0.5);
        expect(Engine._getClippingFactor('S', 'returned')).toBe(0.5);
        ['N', 'P', 'K', 'Ca', 'Mg', 'S'].forEach((n) => {
            expect(Engine._getClippingFactor(n, 'collected')).toBe(1.0);
        });
    });
});

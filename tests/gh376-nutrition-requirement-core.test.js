/**
 * GH-376 / GH-383 — unit tests for assets/nutrition-requirement-core.js, the
 * shared removal + correction + ceiling/floor engine both surfaces now route
 * through (D31 stage 0). See tests/gh376-three-way-nutrition-parity.test.js
 * for the cross-engine parity proof and
 * tests/gh383-nutrition-program-inputs.test.js for the input adapter.
 *
 * GH-383 rewrote this file against the finished contract:
 *   - clipping is the STRING `clippingManagement`, and an absent value means
 *     'collected' (GH-376 shipped `!!clippingsCollected`, i.e. absent meant
 *     'returned', which silently halved P/K removal);
 *   - traffic is gone from the per-nutrient path entirely — it scales annualN
 *     upstream in nutrition-program-inputs.js (decisions D-2/D-3);
 *   - `ranges` is a REQUIRED, caller-resolved input for all three
 *     methodologies, so the core reads no window global at all;
 *   - a nutrient with no soil reading is RETURNED as removal-only rather than
 *     omitted (decision D-9);
 *   - below floor lifts TO THE FLOOR on every methodology (decision D-6);
 *   - the ceiling comparison is `>=` everywhere (decision D-8).
 */

'use strict';

const Core = require('../assets/nutrition-requirement-core.js');

const PRG = 'perennialRyegrass';
// Ranges wide enough that a mid reading is 'removal-only' — isolates removal.
const OPEN = { min: 0, max: 100000 };
function ranges(map) {
    const out = { P: OPEN, K: OPEN, Ca: OPEN, Mg: OPEN, S: OPEN };
    Object.keys(map || {}).forEach((k) => { out[k] = map[k]; });
    return out;
}
function base(extra) {
    return Object.assign({
        soilValues: {}, species: PRG, annualN: 200, methodology: 'SLAN',
        ranges: ranges({}), clippingManagement: 'collected'
    }, extra || {});
}

describe('GH-383 — compute() input contract fails loud, never defaults', () => {
    test('throws on no inputs at all', () => {
        expect(() => Core.compute()).toThrow(/inputs object required/);
    });

    test('throws, naming the field, when annualN is missing / zero / negative', () => {
        expect(() => Core.compute(base({ annualN: undefined }))).toThrow(/annualN/);
        expect(() => Core.compute(base({ annualN: 0 }))).toThrow(/annualN/);
        expect(() => Core.compute(base({ annualN: -10 }))).toThrow(/annualN/);
    });

    test('throws when species, methodology, soilValues or ranges are missing', () => {
        expect(() => Core.compute(base({ species: null }))).toThrow(/species/);
        expect(() => Core.compute(base({ methodology: null }))).toThrow(/methodology/);
        expect(() => Core.compute(base({ soilValues: null }))).toThrow(/soilValues/);
        expect(() => Core.compute(base({ ranges: null }))).toThrow(/ranges/);
    });

    test('a stale caller still passing a retired key is warned about once, not silently obeyed', () => {
        const warn = jest.spyOn(console, 'warn').mockImplementation(() => {});
        // trafficIntensity was removed from the core in GH-383 — the modifier
        // scales annualN upstream, so honouring it here would double-count.
        const r = Core.compute(base({
            soilValues: { K: 90 }, nutrients: ['K'], trafficIntensity: 'extreme'
        }));
        const msgs = warn.mock.calls.map((c) => String(c[0]));
        expect(msgs.some((m) => /unknown input "trafficIntensity"/.test(m))).toBe(true);
        // and it changed nothing
        expect(r.perSample.K.removal).toBeCloseTo(200 * (100 / 180), 1);
        warn.mockRestore();
    });
});

describe('GH-383 — decision D-9: a nutrient with no soil reading is returned, not omitted', () => {
    const r = Core.compute(base({ soilValues: { P: 40 }, methodology: 'MLSN', ranges: ranges({}) }));

    test('the nutrient is present in perSample with a removal-only requirement', () => {
        expect(r.perSample.K).toBeDefined();
        expect(r.perSample.K.intent).toBe('removal-only-no-soil-data');
        expect(r.perSample.K.missingSoilData).toBe(true);
        expect(r.perSample.K.currentLevel).toBeNull();
        expect(r.perSample.K.correctionRequired).toBe(0);
        expect(r.perSample.K.annualRequirement).toBe(r.perSample.K.removal);
    });

    test('missingSoilData still reports it, and a nutrient WITH a reading is not flagged', () => {
        expect(r.missingSoilData.K).toBe(true);
        expect(r.missingSoilData.P).toBeUndefined();
        expect(r.perSample.P.missingSoilData).toBe(false);
    });

    test('a missing reading never produces a lift (0 ppm would read as maximally deficient)', () => {
        const withFloor = Core.compute(base({
            soilValues: {}, methodology: 'MLSN', nutrients: ['K'],
            ranges: ranges({ K: { min: 37, max: 55.5 } })
        }));
        expect(withFloor.perSample.K.correctionRequired).toBe(0);
    });
});

describe('GH-383 — N basis (D31/GH-381): every ratio scales against the caller\'s real annualN', () => {
    test('generic P ratio at Hoxton\'s real N=200 gives the audit\'s own quoted 20.0, not the table\'s flat 18.0', () => {
        const r = Core.compute(base({ soilValues: { P: 15 }, nutrients: ['P'] }));
        expect(r.perSample.P.removal).toBe(20.0);
    });

    test('at annualN === the species table N the core reproduces the table figure exactly', () => {
        const r = Core.compute(base({ soilValues: { P: 30, K: 90 }, annualN: 180, nutrients: ['P', 'K'] }));
        expect(r.perSample.P.removal).toBe(18.0);
        expect(r.perSample.K.removal).toBeCloseTo(100.0, 1);
    });
});

describe('GH-383 — decision D-5: the generic ratio is the per-species table, not one flat set', () => {
    test('fine fescue (K/N 0.60) and perennial ryegrass (K/N 0.5556) differ at the same annualN', () => {
        const prg = Core.compute(base({ soilValues: { K: 90 }, nutrients: ['K'] }));
        const fescue = Core.compute(base({ soilValues: { K: 90 }, species: 'fineFescue', nutrients: ['K'] }));
        expect(fescue.perSample.K.removal).toBeCloseTo(200 * 0.60, 1);
        expect(prg.perSample.K.removal).toBeCloseTo(200 * (100 / 180), 1);
        expect(prg.perSample.K.removal).not.toBeCloseTo(fescue.perSample.K.removal, 1);
    });
});

describe('GH-383 — tissue gate (GH-368/369, unchanged)', () => {
    const TISSUE = { N: 4.57, P: 0.62, K: 1.05 };

    test('an eligible tissue sample scales the MEASURED ratio against the real annualN', () => {
        const r = Core.compute(base({ soilValues: { P: 15, K: 60 }, tissuePercent: TISSUE, nutrients: ['P', 'K'] }));
        expect(r.tissueGateApplied).toBe(true);
        expect(r.perSample.P.removal).toBeCloseTo(200 * (0.62 / 4.57), 1);
        expect(r.perSample.K.removal).toBeCloseTo(200 * (1.05 / 4.57), 1);
        expect(r.perSample.P.tissueInformed).toBe(true);
    });

    test('Ca/Mg/S are never tissue-gated (D07a scope)', () => {
        const r = Core.compute(base({ soilValues: { Ca: 400, Mg: 60, S: 20 }, tissuePercent: TISSUE, nutrients: ['Ca', 'Mg', 'S'] }));
        ['Ca', 'Mg', 'S'].forEach((n) => expect(r.perSample[n].tissueInformed).toBe(false));
    });

    test('a mixed-unit reading disables the WHOLE gate', () => {
        const r = Core.compute(base({ soilValues: { P: 15 }, tissuePercent: { N: 4.57, P: 6200, K: 1.05 }, nutrients: ['P'] }));
        expect(r.tissueGateApplied).toBe(false);
        expect(r.perSample.P.tissueInformed).toBe(false);
    });
});

describe('GH-383 — decision D-3: traffic is not in the core at all', () => {
    test('TRAFFIC_MODIFIERS and the override hook are gone from the core\'s exports', () => {
        expect(Core.TRAFFIC_MODIFIERS).toBeUndefined();
        expect(Core.TRAFFIC_MODIFIERS_CALENDAR_CANDIDATE).toBeUndefined();
        expect(Core.TRAFFIC_MODIFIERS_ENGINE_CANDIDATE).toBeUndefined();
    });

    test('the table lives in the input adapter, where it scales annualN once', () => {
        const Inputs = require('../assets/nutrition-program-inputs.js');
        expect(Inputs.TRAFFIC_MODIFIERS).toEqual({ low: 0.85, moderate: 1.0, high: 1.15, extreme: 1.3 });
    });
});

describe('GH-383 — decision D-1/D-3: clipping is a string, and "collected" is the default', () => {
    const K_COLLECTED = Math.round(200 * (100 / 180) * 10) / 10;

    test('an ABSENT clipping input means collected — the inverted GH-376 default is fixed', () => {
        const r = Core.compute(base({ soilValues: { K: 90 }, nutrients: ['K'], clippingManagement: undefined }));
        expect(r.perSample.K.clippingManagement).toBe('collected');
        expect(r.perSample.K.clippingFactor).toBe(1.0);
        expect(r.perSample.K.removal).toBe(K_COLLECTED);
    });

    test('an unknown string also means collected, never returned', () => {
        const r = Core.compute(base({ soilValues: { K: 90 }, nutrients: ['K'], clippingManagement: 'mulched-partially' }));
        expect(r.perSample.K.removal).toBe(K_COLLECTED);
        expect(Core._resolveClippingManagement(null)).toBe('collected');
        expect(Core._resolveClippingManagement('RETURNED')).toBe('returned');
    });

    test('"returned" reduces P by 0.4 and K by 0.5, and Ca/Mg/S reuse the K factor', () => {
        const r = Core.compute(base({
            soilValues: { P: 15, K: 90, Ca: 400, Mg: 60, S: 20 }, clippingManagement: 'returned'
        }));
        expect(r.perSample.P.removal).toBeCloseTo(200 * (18 / 180) * 0.4, 1);
        expect(r.perSample.K.removal).toBeCloseTo(200 * (100 / 180) * 0.5, 1);
        ['Ca', 'Mg', 'S'].forEach((n) => expect(r.perSample[n].clippingFactor).toBe(0.5));
        expect(r.perSample.Ca.removal).toBeCloseTo(200 * (30 / 180) * 0.5, 1);
    });

    test('every result carries the resolved mode, its factor and the pre-clipping base', () => {
        const r = Core.compute(base({ soilValues: { K: 90 }, nutrients: ['K'], clippingManagement: 'returned' }));
        expect(r.perSample.K.clippingManagement).toBe('returned');
        expect(r.perSample.K.clippingFactor).toBe(0.5);
        expect(r.perSample.K.removalBase).toBe(K_COLLECTED);
    });

    test('applied uniformly across all three methodologies, exactly once', () => {
        ['AMMONIUM_ACETATE', 'SLAN', 'MLSN'].forEach((m) => {
            const collected = Core.compute(base({ soilValues: { K: 90 }, methodology: m, nutrients: ['K'], clippingManagement: 'collected' }));
            const returned = Core.compute(base({ soilValues: { K: 90 }, methodology: m, nutrients: ['K'], clippingManagement: 'returned' }));
            expect(returned.perSample.K.removal).toBeCloseTo(collected.perSample.K.removal * 0.5, 0);
        });
    });
});

describe('GH-383 — one dispatch for all three methodologies (D-6 lift target, D-8 ceiling operator)', () => {
    test('decision D-6: below floor lifts to the FLOOR, on MLSN too — never to 1.5x the minimum', () => {
        // MLSN K: minimum 37, ceiling 55.5, reading 30, bd 1.4 / depth 10, 2 yr.
        const r = Core.compute(base({
            soilValues: { K: 30 }, methodology: 'MLSN', nutrients: ['K'],
            ranges: ranges({ K: { min: 37, max: 55.5 } }), bulkDensity: 1.4, soilDepth: 10
        }));
        expect(r.perSample.K.intent).toBe('lift-to-floor');
        // (37 - 30) * 1.4 * 10 * 0.1 / 2 = 4.9 — the Plan page's own figure.
        // The pre-GH-383 engine lifted to 55.5 and produced 17.85.
        expect(r.perSample.K.correctionRequired).toBeCloseTo(4.9, 6);
        expect(r.perSample.K.correctionRequired).not.toBeCloseTo(17.85, 1);
    });

    test('decision D-6 on calcium — the ~125 -> ~48 kg/ha shift the user approved', () => {
        const r = Core.compute(base({
            soilValues: { Ca: 300 }, methodology: 'MLSN', nutrients: ['Ca'],
            ranges: ranges({ Ca: { min: 331, max: 496.5 } }), bulkDensity: 1.4, soilDepth: 10
        }));
        // (331 - 300) * 1.4 * 10 * 0.1 / 3 = 14.4667; removal 200*(30/180) = 33.3
        expect(r.perSample.Ca.correctionRequired).toBeCloseTo(14.4667, 3);
        expect(r.perSample.Ca.annualRequirement).toBeCloseTo(47.8, 1);
    });

    test('decision D-8: a reading exactly AT the ceiling applies zero, on every methodology', () => {
        ['AMMONIUM_ACETATE', 'SLAN', 'MLSN'].forEach((m) => {
            const r = Core.compute(base({
                soilValues: { K: 176 }, methodology: m, nutrients: ['K'],
                ranges: ranges({ K: { min: 75, max: 176 } })
            }));
            expect(r.perSample.K.annualRequirement).toBe(0);
            expect(r.perSample.K.intent).toBe('suppress-above-ceiling');
        });
    });

    test('the lift term uses the real ppm -> kg/ha conversion (GH-370), not a raw ppm deficit', () => {
        const r = Core.compute(base({
            soilValues: { K: 50 }, methodology: 'AMMONIUM_ACETATE', nutrients: ['K'],
            ranges: ranges({ K: { min: 78.2, max: 195.5 } }), bulkDensity: 1.4, soilDepth: 10
        }));
        expect(r.perSample.K.correctionRequired).toBeCloseTo((78.2 - 50) * 1.4 * 10 * 0.1 / 2, 5);
    });

    test('no range resolved: AA says so explicitly, MLSN/SLAN stay removal-only', () => {
        const aa = Core.compute(base({ soilValues: { K: 90 }, methodology: 'AMMONIUM_ACETATE', nutrients: ['K'], ranges: { K: null } }));
        expect(aa.perSample.K.intent).toBe('removal-only-unverified');
        expect(aa.perSample.K.rangeResolved).toBe(false);
        // The same honesty applies to MLSN/SLAN — an unresolved range means
        // nothing was compared. Unreachable in practice (both tables cover all
        // five nutrients), asserted so it stays unreachable-by-design.
        const mlsn = Core.compute(base({ soilValues: { K: 90 }, methodology: 'MLSN', nutrients: ['K'], ranges: { K: null } }));
        expect(mlsn.perSample.K.intent).toBe('removal-only-unverified');
    });

    test('status vocabularies are preserved per methodology, and never contradict the printed requirement', () => {
        const r = { min: 37, max: 55.5 };
        expect(Core._statusFor('MLSN', 10, r.min, r.max)).toBe('Very Low');
        expect(Core._statusFor('MLSN', 30, r.min, r.max)).toBe('Low');
        expect(Core._statusFor('MLSN', 45, r.min, r.max)).toBe('Adequate');
        expect(Core._statusFor('MLSN', 55.5, r.min, r.max)).toBe('High');   // exactly at ceiling -> 0 applied
        expect(Core._statusFor('MLSN', 120, r.min, r.max)).toBe('Excessive');
        expect(Core._statusFor('SLAN', 176, 75, 176)).toBe('Excessive');
        expect(Core._statusFor('SLAN', 100, 75, 176)).toBe('Sufficient');
        expect(Core._statusFor('SLAN', 10, 75, 176)).toBe('Deficient');
        expect(Core._statusFor('AMMONIUM_ACETATE', 195.5, 78.2, 195.5)).toBe('High');
        expect(Core._statusFor('AMMONIUM_ACETATE', 100, 78.2, 195.5)).toBe('Adequate');
        expect(Core._statusFor('AMMONIUM_ACETATE', 10, 78.2, 195.5)).toBe('Low');
    });
});

describe('GH-383 — the core is pure: no window/global read anywhere', () => {
    test('the source file contains no window., document. or global. reads outside the module wrapper', () => {
        const fs = require('fs');
        const path = require('path');
        const src = fs.readFileSync(path.join(__dirname, '../assets/nutrition-requirement-core.js'), 'utf8');
        // Only the UMD tail may mention window/module.
        const body = src.slice(0, src.indexOf('const API = {'));
        expect(body).not.toMatch(/window\./);
        expect(body).not.toMatch(/document\./);
        expect(body).not.toMatch(/GilbaClassificationConstants/);
    });
});

describe('GH-383 — real fixture (tests/fixtures/test5-soccer-sample141.json), above-ceiling case', () => {
    const fixture = require('./fixtures/test5-soccer-sample141.json');

    test('all five nutrients suppress to 0, matching the fixture\'s confirmed-live expectation', () => {
        const rg = {};
        Object.keys(fixture.expected.ranges).forEach((n) => {
            rg[n] = { min: fixture.expected.ranges[n].min, max: fixture.expected.ranges[n].max };
        });
        const r = Core.compute({
            soilValues: fixture.inputs.soilPpm, species: PRG,
            annualN: fixture.inputs.annualNOverride, methodology: 'AMMONIUM_ACETATE',
            ph: fixture.inputs.pH, ranges: rg, clippingManagement: 'collected',
            nutrients: ['P', 'K', 'Ca', 'Mg', 'S']
        });
        ['P', 'K', 'Ca', 'Mg', 'S'].forEach((n) => {
            const expected = fixture.expected.nutrientRequirement[n];
            expect(r.perSample[n].status).toBe(expected.status);
            expect(r.perSample[n].intent).toBe(expected.intent);
            expect(r.perSample[n].annualRequirement).toBe(expected.annualRequirement);
        });
    });
});

describe('GH-383 — real fixture (below-floor, live-verified on both surfaces)', () => {
    const fixture = require('./fixtures/test5-soccer-sample141-belowfloor-gh370.json');
    const IN = fixture.inputs;
    const EXP = fixture.expected;

    function run(clippingManagement) {
        return Core.compute({
            soilValues: IN.soilPpm, species: IN.speciesKey, annualN: IN.annualN,
            methodology: 'AMMONIUM_ACETATE', ph: IN.pH, tissuePercent: IN.tissuePercent,
            bulkDensity: IN.bulkDensity, soilDepth: IN.soilDepth,
            clippingManagement: clippingManagement,
            ranges: {
                P: { min: EXP.floors.P, max: EXP.ceilings.P },
                K: { min: EXP.floors.K, max: EXP.ceilings.K },
                Ca: null, Mg: null, S: null
            },
            nutrients: ['P', 'K']
        });
    }

    test('at "collected" it reproduces the rendered K 84.1 / P 40.9 (removal 57.4 / 33.9)', () => {
        const r = run('collected').perSample;
        expect(r.K.removal).toBe(EXP.sharedCore.K.removal);
        expect(r.P.removal).toBe(EXP.sharedCore.P.removal);
        expect(r.K.annualRequirement).toBe(EXP.sharedCore.K.annualRequirement);
        expect(r.P.annualRequirement).toBe(EXP.sharedCore.P.annualRequirement);
        expect(r.K.correctionRequired).toBeCloseTo(EXP.handComputedCorrection.K, 2);
        expect(r.P.correctionRequired).toBeCloseTo(EXP.handComputedCorrection.P, 2);
    });

    test('at "returned" only removal moves — the lift term is untouched by clipping management', () => {
        const c = run('collected').perSample;
        const rr = run('returned').perSample;
        expect(rr.K.removal).toBeCloseTo(c.K.removal * 0.5, 1);
        expect(rr.P.removal).toBeCloseTo(c.P.removal * 0.4, 1);
        expect(rr.K.correctionRequired).toBeCloseTo(c.K.correctionRequired, 9);
        expect(rr.P.correctionRequired).toBeCloseTo(c.P.correctionRequired, 9);
    });
});

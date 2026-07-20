/**
 * Disease engine corrections — b35fix492-498
 *
 * Covers:
 *   b35fix492 — browntopBent species row + fineFescue row + normalizeSpecies fix
 *   b35fix493 — grayLeafSpot zeroed on bentgrass, KBG, poaAnnua (non-hosts)
 *   b35fix495-497 — Fusarium: retire 4 modifiers, leaf-wetness moisture, honest provenance
 *   b35fix498 — Large Patch: honour model adjustedRisk, realign zoysia/paspalum/buffalograss
 *   Waitea Patch — temperature gate: suppress when tempFactor=0
 */

'use strict';

global.window   = global.window   || {};
global.document = global.document || { addEventListener: () => {}, documentElement: {}, querySelector: () => null };
global.console  = { group: () => {}, groupEnd: () => {}, groupCollapsed: () => {}, log: () => {}, warn: () => {}, info: () => {}, error: () => {} };

const eng = require('../assets/disease-engine-pure.js');
const normalizeSpecies   = eng.utils.normalizeSpecies;
const SPECIES_SUSCEPTIBILITY = eng.SPECIES_SUSCEPTIBILITY;
const models             = eng.models;

// ─────────────────────────────────────────────────────────────────────────────
// b35fix492 — browntopBent + fineFescue species rows
// ─────────────────────────────────────────────────────────────────────────────

describe('b35fix492 — browntopBent species row', () => {
    test('normalizeSpecies: "browntop bent" → browntopBent', () => {
        expect(normalizeSpecies('browntop bent')).toBe('browntopBent');
    });
    test('normalizeSpecies: "browntop" → browntopBent', () => {
        expect(normalizeSpecies('browntop')).toBe('browntopBent');
    });
    test('normalizeSpecies: "colonial bent" → browntopBent', () => {
        expect(normalizeSpecies('colonial bent')).toBe('browntopBent');
    });
    test('normalizeSpecies: "Agrostis capillaris" → browntopBent', () => {
        expect(normalizeSpecies('Agrostis capillaris')).toBe('browntopBent');
    });
    test('normalizeSpecies: "capillaris" → browntopBent', () => {
        expect(normalizeSpecies('capillaris')).toBe('browntopBent');
    });
    test('normalizeSpecies: generic "bent" still → bentgrass (browntop checked first)', () => {
        expect(normalizeSpecies('creeping bent')).toBe('bentgrass');
        expect(normalizeSpecies('bentgrass')).toBe('bentgrass');
    });

    test('browntopBent row exists in SPECIES_SUSCEPTIBILITY', () => {
        expect(SPECIES_SUSCEPTIBILITY).toHaveProperty('browntopBent');
    });
    test('browntopBent dollarSpot susceptibility is 1.3', () => {
        expect(SPECIES_SUSCEPTIBILITY.browntopBent.dollarSpot).toBe(1.3);
    });
    test('browntopBent fusarium susceptibility is 1.4', () => {
        expect(SPECIES_SUSCEPTIBILITY.browntopBent.fusarium).toBe(1.4);
    });
    test('browntopBent grayLeafSpot is 0 (non-host)', () => {
        expect(SPECIES_SUSCEPTIBILITY.browntopBent.grayLeafSpot).toBe(0);
    });
    test('browntopBent largePatch is 0 (non-host)', () => {
        expect(SPECIES_SUSCEPTIBILITY.browntopBent.largePatch).toBe(0);
    });
    test('browntopBent redThread susceptibility is 0.9', () => {
        expect(SPECIES_SUSCEPTIBILITY.browntopBent.redThread).toBe(0.9);
    });
});

describe('b35fix492 — fineFescue species row', () => {
    test('fineFescue row exists in SPECIES_SUSCEPTIBILITY', () => {
        expect(SPECIES_SUSCEPTIBILITY).toHaveProperty('fineFescue');
    });
    test('fineFescue redThread is 1.5 (highly susceptible)', () => {
        expect(SPECIES_SUSCEPTIBILITY.fineFescue.redThread).toBe(1.5);
    });
    test('fineFescue fusarium is 1.1', () => {
        expect(SPECIES_SUSCEPTIBILITY.fineFescue.fusarium).toBe(1.1);
    });
    test('fineFescue grayLeafSpot is 0.2 (low susceptibility)', () => {
        expect(SPECIES_SUSCEPTIBILITY.fineFescue.grayLeafSpot).toBe(0.2);
    });
    test('fineFescue largePatch is 0 (non-host, cool-season)', () => {
        expect(SPECIES_SUSCEPTIBILITY.fineFescue.largePatch).toBe(0);
    });
    test('fineFescue takeAll is 0.5', () => {
        expect(SPECIES_SUSCEPTIBILITY.fineFescue.takeAll).toBe(0.5);
    });
});

// ─────────────────────────────────────────────────────────────────────────────
// b35fix493 — grayLeafSpot zeroed on documented non-hosts
// ─────────────────────────────────────────────────────────────────────────────

describe('b35fix493 — grayLeafSpot non-host zeros', () => {
    test('bentgrass grayLeafSpot is 0', () => {
        expect(SPECIES_SUSCEPTIBILITY.bentgrass.grayLeafSpot).toBe(0);
    });
    test('kentuckyBluegrass grayLeafSpot is 0', () => {
        expect(SPECIES_SUSCEPTIBILITY.kentuckyBluegrass.grayLeafSpot).toBe(0);
    });
    test('poaAnnua grayLeafSpot is 0', () => {
        expect(SPECIES_SUSCEPTIBILITY.poaAnnua.grayLeafSpot).toBe(0);
    });
    // Guard: actual GLS hosts remain non-zero
    test('perennialRyegrass grayLeafSpot is non-zero (true host)', () => {
        expect(SPECIES_SUSCEPTIBILITY.perennialRyegrass.grayLeafSpot).toBeGreaterThan(0);
    });
    test('tallFescue grayLeafSpot is non-zero (true host)', () => {
        expect(SPECIES_SUSCEPTIBILITY.tallFescue.grayLeafSpot).toBeGreaterThan(0);
    });
    test('bermuda grayLeafSpot is non-zero (true host)', () => {
        expect(SPECIES_SUSCEPTIBILITY.bermuda.grayLeafSpot).toBeGreaterThan(0);
    });
});

// ─────────────────────────────────────────────────────────────────────────────
// b35fix498 — Large Patch species susceptibility realignment
// ─────────────────────────────────────────────────────────────────────────────

describe('b35fix498 — Large Patch susceptibility realignment', () => {
    test('zoysia largePatch is 1.3 (was 1.4)', () => {
        expect(SPECIES_SUSCEPTIBILITY.zoysia.largePatch).toBe(1.3);
    });
    test('seashore_paspalum largePatch is 1.4 (was 0.6)', () => {
        expect(SPECIES_SUSCEPTIBILITY.seashore_paspalum.largePatch).toBe(1.4);
    });
    test('buffalograss largePatch is 0.9 (was 0.6)', () => {
        expect(SPECIES_SUSCEPTIBILITY.buffalograss.largePatch).toBe(0.9);
    });
    // Guard: warm-season hosts that ARE susceptible remain > 0.5
    test('bermuda largePatch > 0.5 (susceptible warm-season host)', () => {
        expect(SPECIES_SUSCEPTIBILITY.bermuda.largePatch).toBeGreaterThan(0.5);
    });
    // Guard: cool-season non-hosts remain 0
    test('bentgrass largePatch is 0', () => {
        expect(SPECIES_SUSCEPTIBILITY.bentgrass.largePatch).toBe(0);
    });
    test('kentuckyBluegrass largePatch is 0', () => {
        expect(SPECIES_SUSCEPTIBILITY.kentuckyBluegrass.largePatch).toBe(0);
    });
});

// ─────────────────────────────────────────────────────────────────────────────
// Waitea Patch — temperature gate
// ─────────────────────────────────────────────────────────────────────────────

describe('Waitea Patch — temperature gate (circinata / NZ variant)', () => {
    const WaiteaModel = models.waiteaPatch;

    function nzClimate(airTemp) {
        return {
            temperature: { mean: airTemp },
            moisture: { humidity: { mean: 80 } },
        };
    }

    test('at 8°C — gate suppresses: adjustedRisk=0, envelopeSuppressed=true', () => {
        const r = WaiteaModel.calculate(nzClimate(8), { status: 'adequate' }, null, null, null, 'bentgrass', 'NZ');
        expect(r.adjustedRisk).toBe(0);
        expect(r.riskScore).toBe(0);
        expect(r.envelopeSuppressed).toBe(true);
    });

    test('at 9°C (below 10°C active floor) — gate suppresses', () => {
        const r = WaiteaModel.calculate(nzClimate(9), { status: 'adequate' }, null, null, null, 'bentgrass', 'NZ');
        expect(r.adjustedRisk).toBe(0);
        expect(r.envelopeSuppressed).toBe(true);
    });

    test('at 11°C (inside active range) — risk > 0, no envelopeSuppressed', () => {
        const r = WaiteaModel.calculate(nzClimate(11), { status: 'adequate' }, null, null, null, 'bentgrass', 'NZ');
        expect(r.adjustedRisk).toBeGreaterThan(0);
        expect(r.envelopeSuppressed).toBeFalsy();
    });

    test('at 22°C (optimal circinata range) — risk > 0', () => {
        const r = WaiteaModel.calculate(nzClimate(22), { status: 'adequate' }, null, null, null, 'bentgrass', 'NZ');
        expect(r.adjustedRisk).toBeGreaterThan(0);
    });

    test('suppressed gate result has high confidence (confident suppression)', () => {
        const r = WaiteaModel.calculate(nzClimate(8), { status: 'adequate' }, null, null, null, 'bentgrass', 'NZ');
        expect(r.confidence).toBe('high');
        expect(r.confidenceScore).toBeGreaterThanOrEqual(80);
    });

    test('suppressed gate result preserves disease/variant shape', () => {
        const r = WaiteaModel.calculate(nzClimate(5), { status: 'adequate' }, null, null, null, 'bentgrass', 'NZ');
        expect(r.disease).toBe('waiteaPatch');
        expect(r.variant).toBe('circinata');
        expect(r.factors.temperature.note).toContain('Below active temperature range');
    });
});

describe('Waitea Patch — temperature gate (zeae / AU variant)', () => {
    const WaiteaModel = models.waiteaPatch;

    function auClimate(airTemp) {
        return {
            temperature: { mean: airTemp },
            moisture: { humidity: { mean: 80 } },
        };
    }

    test('at 18°C (below AU 20°C floor) — gate suppresses', () => {
        const r = WaiteaModel.calculate(auClimate(18), { status: 'adequate' }, null, null, null, 'bermuda', 'AU');
        expect(r.adjustedRisk).toBe(0);
        expect(r.envelopeSuppressed).toBe(true);
    });

    test('at 21°C (inside AU active range) — risk > 0', () => {
        const r = WaiteaModel.calculate(auClimate(21), { status: 'adequate' }, null, null, null, 'bermuda', 'AU');
        expect(r.adjustedRisk).toBeGreaterThan(0);
        expect(r.envelopeSuppressed).toBeFalsy();
    });
});

// ─────────────────────────────────────────────────────────────────────────────
// Fusarium inflation guard — Russley GC scenario (b35fix495)
// The pre-fix model emitted 82% (fluctuationMod 1.15 × 71%). Post-fix
// must produce ~57% (no modifier inflation).
// ─────────────────────────────────────────────────────────────────────────────

describe('Fusarium inflation guard — Russley GC 8°C scenario (b35fix495)', () => {
    const FusariumModel = models.fusarium;

    // Russley GC: 8°C clear sky, RH 80%, no significant rain, diurnal ~11°C
    const russleyClimate = {
        temperature: { mean: 8, min: 3, max: 14 },
        moisture: { humidity: { mean: 80 } },
        precipitation: { total: 0 },
    };

    test('riskScore is below 70% (no modifier inflation)', () => {
        const r = FusariumModel.calculate(russleyClimate, { status: 'adequate' }, {});
        // Pre-fix 82% was clearly inflated; honest formula at these inputs gives ~60%.
        expect(r.riskScore).toBeLessThan(70);
    });

    test('confidence is moderate, not high (honest provenance)', () => {
        const r = FusariumModel.calculate(russleyClimate, { status: 'adequate' }, {});
        expect(r.confidence).toBe('moderate');
    });

    test('formula is (0.40×tempFactor + 0.60×moistureFactor)×100', () => {
        // At 8°C: tempFactor = exp(-0.5×((8-6)/4)²) = exp(-0.125) ≈ 0.8825
        // humidity=80 is NOT >80 (strictly greater), precip=0 not >5
        // → moistureFactor = 0.2 (lowest ladder tier)
        // riskScore = (0.40×0.8825 + 0.60×0.2)×100 = (0.353 + 0.12)×100 = 47.3 → 47
        const r = FusariumModel.calculate(russleyClimate, { status: 'adequate' }, {});
        expect(r.riskScore).toBe(47);
    });
});

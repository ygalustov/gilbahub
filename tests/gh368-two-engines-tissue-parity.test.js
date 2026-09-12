/**
 * GH-368 (Hoxton audit D07a, second engine) — the tissue gate existed in only
 * one of the two engines that answer the same question.
 *
 * GH-361 made nutrition-calendar.js derive the P/K removal from the site's own
 * tissue analysis instead of a generic textbook composition. But
 * nutrition-requirement-engine.js carries its OWN removal table --
 * `perennialRyegrass: { N: 180, P: 18, K: 100 }`, i.e. P/N 0.10 and K/N 0.556,
 * the same generic assumption and literally the figures the audit quotes from
 * E3 ("K req 100.0", "P 18.0") -- and it is that engine which feeds the Annual
 * Nutrient Requirements table the client complained about. So after GH-361 the
 * two engines disagreed *more* than before: on this repo's own Test5-NZ tissue
 * the calendar answered 46 kg K/ha and this engine still answered 100.
 *
 * The audit's assertion 20 requires UI and export to return identical annual
 * N/P/K for the same site, and D07a is explicitly scoped to P and K only.
 */

'use strict';

const Engine = require('../assets/nutrition-requirement-engine.js');

// Real values from this repo's Test5-NZ / Soccer tissue sample (id 144),
// cross-checked against the DB. N and P match the audit's Hoxton figures.
const TISSUE = { N: 4.57, P: 0.62, K: 1.05 };

function removalFor(nutrient, tissuePercent) {
    // Soil far below any threshold so MLSN returns removal + correction; the
    // removal component is what this test is about, so read it directly off the
    // returned object rather than the total.
    const result = Engine._calculateNutrientRequirement(nutrient, 1, {
        methodology: 'MLSN',
        species: 'perennialRyegrass',
        tissuePercent: tissuePercent || null,
    });
    return result.removal;
}

describe('GH-368 — nutrition-requirement-engine.js honours the tissue gate too', () => {
    test('without a tissue sample the species table is unchanged (P 18, K 100 for perennial ryegrass)', () => {
        expect(removalFor('P', null)).toBe(18);
        expect(removalFor('K', null)).toBe(100);
    });

    test('with a real tissue sample the P/K removal is scaled to this plant\'s own composition', () => {
        // The table's own N basis (180) times the measured ratio.
        expect(removalFor('P', TISSUE)).toBe(Math.round(180 * (0.62 / 4.57) * 10) / 10);
        expect(removalFor('K', TISSUE)).toBe(Math.round(180 * (1.05 / 4.57) * 10) / 10);
    });

    test('the gate is scoped to P and K — Ca/Mg/S keep the species table (D07a excludes them)', () => {
        ['Ca', 'Mg', 'S'].forEach((n) => {
            expect(removalFor(n, TISSUE)).toBe(removalFor(n, null));
        });
    });

    test('N is not gated either — it is a site-level programme input, not a removal ratio', () => {
        const gated = Engine._calculateNutrientRequirement('P', 1, {
            methodology: 'MLSN', species: 'perennialRyegrass', tissuePercent: TISSUE,
        });
        expect(gated.removal).not.toBe(18);
        // sanity: the species table itself is untouched for the next call
        expect(removalFor('P', null)).toBe(18);
    });

    test('a mixed-unit tissue sample (P in mg/kg) is rejected, same clamp as the calendar engine', () => {
        expect(removalFor('P', { N: 4.57, P: 6200, K: 1.05 })).toBe(18);
        expect(removalFor('K', { N: 4.57, P: 0.62, K: 10500 })).toBe(100);
    });

    test('a partial or zero tissue reading does not engage the gate', () => {
        expect(removalFor('K', { N: 4.57, P: 0.62, K: null })).toBe(100);
        expect(removalFor('K', { N: 0, P: 0.62, K: 1.05 })).toBe(100);
        expect(removalFor('P', { N: 4.57, P: 0, K: 1.05 })).toBe(18);
    });
});

/**
 * GH-436 — this block claimed "the two engines now agree" while loading ONE of
 * them. `nutrition-calendar.js` was never required; `calendarRatio()` was a
 * hand transcription of the calendar's rule, with its own hardcoded generic
 * ratios {P: 0.10, K: 0.55} and its own plausibility bands, written into the
 * test file. So it compared one real engine against a copy of the other engine
 * frozen at the moment the test was written — the shape that cannot detect the
 * divergence it is named after, because the calendar can change and the copy
 * cannot. The `toBeLessThanOrEqual(1)` tolerance in the second test would have
 * absorbed a whole kilogram of drift on top.
 *
 * Since GH-383/384 there is a real shared answer to compare against:
 * `nutrition-requirement-core.js` owns the removal ratio and the tissue gate,
 * and BOTH engines route through it. The comparison is now engine against core,
 * both loaded, with no rule retyped here.
 */
describe('GH-368 — the two engines now agree, measured against the shared core', () => {
    const Core = require('../assets/nutrition-requirement-core.js');

    /** The core's own answer, through its own public entry points. */
    function coreRemoval(nutrient, tissuePercent, annualN) {
        const gate = Core._resolveTissueGate
            ? Core._resolveTissueGate(tissuePercent || null)
            : null;
        return Core._getRemovalRate('perennialRyegrass', nutrient, gate, annualN);
    }

    test('the core exposes the pieces this comparison needs — no silent no-op', () => {
        expect(typeof Core._getRemovalRate).toBe('function');
        expect(typeof Core._resolveTissueGate).toBe('function');
        expect(Core.REMOVAL_RATES.perennialRyegrass).toEqual(
            expect.objectContaining({ N: expect.any(Number), P: expect.any(Number), K: expect.any(Number) }));
    });

    test.each(['P', 'K'])('%s: with a tissue sample, engine and core return the same removal', (nutrient) => {
        const N = Core.REMOVAL_RATES.perennialRyegrass.N;
        const fromCore = coreRemoval(nutrient, TISSUE, N);
        const fromEngine = removalFor(nutrient, TISSUE);
        process.stdout.write('[gh368] ' + nutrient + ' with tissue — engine ' + fromEngine
            + ', core ' + fromCore.value + ' (ratio ' + fromCore.ratio.toFixed(4)
            + ', tissue-informed ' + fromCore.tissueInformed + ')\n');
        expect(fromEngine).toBe(fromCore.value);
        // and the gate really engaged, so "they agree" is not both declining it
        expect(fromCore.tissueInformed).toBe(true);
        expect(fromCore.ratio).toBeCloseTo(TISSUE[nutrient] / TISSUE.N, 6);
    });

    test.each(['P', 'K'])('%s: with no tissue, engine and core return the same species-table removal', (nutrient) => {
        const N = Core.REMOVAL_RATES.perennialRyegrass.N;
        const fromCore = coreRemoval(nutrient, null, N);
        const fromEngine = removalFor(nutrient, null);
        process.stdout.write('[gh368] ' + nutrient + ' no tissue — engine ' + fromEngine
            + ', core ' + fromCore.value + '\n');
        // Exact, not within a kilogram: one implementation cannot be a kilogram
        // away from itself, and the old tolerance is what let a real drift hide.
        expect(fromEngine).toBe(fromCore.value);
        expect(fromCore.tissueInformed).toBe(false);
    });

    test.each(['P', 'K'])('%s: a rejected tissue reading is rejected identically by both', (nutrient) => {
        const N = Core.REMOVAL_RATES.perennialRyegrass.N;
        const outOfBand = Object.assign({}, TISSUE, { [nutrient]: TISSUE[nutrient] * 10000 });
        const fromCore = coreRemoval(nutrient, outOfBand, N);
        expect(removalFor(nutrient, outOfBand)).toBe(fromCore.value);
        expect(fromCore.tissueInformed).toBe(false);
    });
});

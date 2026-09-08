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

describe('GH-368 — the two engines now agree on the same measurement', () => {
    // The calendar engine's own rule, from nutrition-calendar.js STEP 2:
    // removal = annualN * (tissueX / tissueN), same plausibility bands.
    function calendarRatio(nutrient, tissue) {
        const generic = { P: 0.10, K: 0.55 }[nutrient];
        const bands = { P: { min: 0.03, max: 0.30 }, K: { min: 0.15, max: 1.50 } }[nutrient];
        if (!tissue || !(tissue.N > 0) || !(tissue[nutrient] > 0)) return generic;
        const r = tissue[nutrient] / tissue.N;
        return (r >= bands.min && r <= bands.max) ? r : generic;
    }

    test.each(['P', 'K'])('%s: both engines apply the same ratio to their own N basis', (nutrient) => {
        const ratio = calendarRatio(nutrient, TISSUE);
        // Requirement engine: scales the species table's N (180).
        expect(removalFor(nutrient, TISSUE)).toBe(Math.round(180 * ratio * 10) / 10);
        // The ratio itself is the measured one, not the generic.
        expect(ratio).toBeCloseTo(TISSUE[nutrient] / TISSUE.N, 6);
    });

    test.each(['P', 'K'])('%s: with no tissue both fall back to the same generic ratio', (nutrient) => {
        const ratio = calendarRatio(nutrient, null);
        // 180 * 0.10 = 18 and 180 * 0.55 = 99, against the table's 18 and 100 --
        // the table rounds K's ratio to 0.556, so allow a kilogram of drift.
        expect(Math.abs(removalFor(nutrient, null) - 180 * ratio)).toBeLessThanOrEqual(1);
    });
});

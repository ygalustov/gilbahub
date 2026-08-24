/**
 * GH-307 — PrebbleRecommender never selected a granular N product for any
 * Soccer/AFL/Rugby Union/Rugby League site, regardless of how much N was
 * required.
 *
 * Found live while explaining why a real site's "Nutrient Delivery Summary"
 * showed only 46.2 kg N/ha delivered against 200 kg N/ha required (a
 * separate, tangential finding while investigating the D07 AA-ceiling work --
 * not AA-related, not soil-methodology-related).
 *
 * ROOT CAUSE: site-settings-panel.js's Sports sub-category grid
 * (populateTurfSubGrid()) sets context.surfaceType to one of 4 specific
 * values -- 'soccer', 'afl', 'rugby_union', 'rugby_league' -- not the parent
 * 'sports' category. normalizeSurfaceType() had no alias entries for any of
 * them (unlike 'sports_field'/'sportsfield', which WERE mapped to 'sports'),
 * so they passed through unchanged. Every granular product in
 * PrebbleProducts.granular tags itself with the umbrella 'sports' category in
 * its suitableFor list, never the specific sub-type -- so filterBySurface()
 * matched zero products for any of these 4 surface values, every month,
 * confirmed live via "[PrebbleRecommender] NO granular products match
 * surface: soccer" firing for all 12 months on a real site. Liquid fallback
 * only fires in the winter (GP<0.3) branch or for greens (isGreens && N>2) --
 * neither applies to a soccer field for most of the year -- so most months
 * got literally no N product at all.
 *
 * FIX: map 'soccer', 'afl', 'rugby_union', 'rugby_league', and the generic
 * 'rugby' to 'sports' in normalizeSurfaceType()'s alias table, same pattern
 * already used for 'sports_field'/'sportsfield'.
 */

'use strict';

global.window = global.window || {};
global.document = global.document || {};
global.console = { log: function () {}, warn: function () {}, error: function () {} };

require('../assets/prebbles-products.js');
var PrebbleRecommender = global.window.PrebbleRecommender;
var PrebbleProducts = global.window.PrebbleProducts;

describe('GH-307 — normalizeSurfaceType() maps Sports sub-categories to "sports"', () => {
    test.each(['soccer', 'afl', 'rugby_union', 'rugby_league', 'rugby'])(
        '%s -> sports',
        (input) => {
            expect(PrebbleRecommender.normalizeSurfaceType(input)).toBe('sports');
        }
    );

    test('case-insensitive (Settings UI values could plausibly vary in case)', () => {
        expect(PrebbleRecommender.normalizeSurfaceType('Soccer')).toBe('sports');
        expect(PrebbleRecommender.normalizeSurfaceType('RUGBY_UNION')).toBe('sports');
    });

    test('regression: pre-existing aliases still work unchanged', () => {
        expect(PrebbleRecommender.normalizeSurfaceType('golf')).toBe('golf_greens');
        expect(PrebbleRecommender.normalizeSurfaceType('bowls')).toBe('bowling_greens');
        expect(PrebbleRecommender.normalizeSurfaceType('sports_field')).toBe('sports');
        expect(PrebbleRecommender.normalizeSurfaceType('sportsfield')).toBe('sports');
    });

    test('regression: an already-canonical value passes through unchanged', () => {
        expect(PrebbleRecommender.normalizeSurfaceType('greens')).toBe('greens');
        expect(PrebbleRecommender.normalizeSurfaceType('sports')).toBe('sports');
    });

    test('regression: unknown/unmapped value still passes through unchanged (no throw)', () => {
        expect(PrebbleRecommender.normalizeSurfaceType('some_future_surface')).toBe('some_future_surface');
    });
});

describe('GH-307 — filterBySurface() now matches granular products for Sports sub-categories', () => {
    test('soccer resolves to a non-empty granular pool (was empty before the fix)', () => {
        const normalized = PrebbleRecommender.normalizeSurfaceType('soccer');
        const suitable = PrebbleRecommender.filterBySurface(PrebbleProducts.granular, normalized);
        expect(suitable.length).toBeGreaterThan(0);
    });

    test.each(['afl', 'rugby_union', 'rugby_league'])('%s also resolves to a non-empty granular pool', (surface) => {
        const normalized = PrebbleRecommender.normalizeSurfaceType(surface);
        const suitable = PrebbleRecommender.filterBySurface(PrebbleProducts.granular, normalized);
        expect(suitable.length).toBeGreaterThan(0);
    });
});

describe('GH-307 — end-to-end: getMonthlyRecommendation() now selects a granular N product for a Soccer field', () => {
    test('high-GP month with meaningful N requirement gets a granular product, not "no product selected"', () => {
        const monthData = {
            month_name: 'January', season: 'Summer', gp: 1,
            N: 72.4, P: 5, K: 20, Ca: 2, Mg: 1, S: 1,
        };
        const context = { surfaceType: 'soccer', methodology: 'mlsn', currentMonth: 1 };
        const rec = PrebbleRecommender.getMonthlyRecommendation(monthData, context);
        expect(rec.granular.length).toBeGreaterThan(0);
    });
});

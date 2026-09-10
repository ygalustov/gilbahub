/**
 * GH-399 — assets/nutrition-delivery-core.js, the one product-delivery
 * accumulator.
 *
 * Two halves, in this order:
 *
 *   1. The RULES, on inputs small enough to check by hand. Each test names the
 *      accumulator it replaces and the divergence that made the rule necessary.
 *   2. The REAL PROGRAMMES, from tests/fixtures/gh399-delivery-programme-*.json
 *      — six persisted `nutritionProgram` objects read out of the development
 *      database on 2026-09-10. Those fixtures deliberately carry `monthly` and
 *      the recommender's own `delivered` vector but NO `annualSummary`, so this
 *      suite cannot pass by copying the output of the accumulator it replaced.
 *
 * The invariant the second half exists for: on an Australian programme the
 * module's totals must equal the recommender's own `program.delivered` to the
 * last decimal. Both are the sum of the same declared `delivers` vectors, and
 * the recommender paces itself against `delivered` (the GH-342/343 netP/netK
 * caps, the strategic-P loop, `balance`). If the printed Delivered column ever
 * stops being that number, the Plan page's Balance column is describing a
 * different programme from the one it prints — which is GH-391 exactly.
 */

'use strict';

const fs = require('fs');
const path = require('path');
const delivery = require('../assets/nutrition-delivery-core.js');

function fixture(name) {
    return JSON.parse(fs.readFileSync(
        path.join(__dirname, 'fixtures/gh399-delivery-programme-' + name + '.json'), 'utf8'));
}

/** One month carrying whatever entries the test needs. */
function month(name, granular, liquid) {
    return { month: name, month_name: name, granular: granular || [], liquid: liquid || [] };
}

describe('GH-399 — a declared zero is a zero', () => {
    // THE defect. Every Australian liquid declared `delivers.P = 0`
    // (au-fertiliser-products.js) while its analysis carried real phosphorus.
    // word-export-combined.js asked `fromDelivers > 0` and, on a declared zero,
    // substituted `analysis x rate` — so the document counted phosphorus the
    // Plan page did not, and the SLAN fixture printed Delivered P 14.5 against
    // the Plan's 14.0, a -5% verdict against a -7% one.
    //
    // GH-400 has since made the AU recommender declare and accumulate that
    // phosphorus, so a freshly generated programme no longer carries a false
    // zero here. This entry and the frozen fixtures further down are kept
    // exactly as they were on purpose: the rule under test is "a declared zero
    // is a zero, whatever the analysis says", which has to keep holding for
    // any recommender that does declare one, and for every programme persisted
    // before GH-400. The GH-400 numbers live in gh400-au-liquid-phosphorus.test.js.
    const greenmaster = {
        id: 'ICL-GREENMASTERL',
        name: 'Greenmaster Liquid Spring & Summer',
        form: 'liquid',
        rateLHa: 21,
        applications: 1,
        analysis: { N: 12, P: 1.7, K: 5 },
        delivers: { N: 2.5, P: 0, K: 1.1 }
    };

    test('a declared P of 0 stays 0, even though the analysis carries 1.7%', () => {
        const acc = delivery.accumulate([month('Jul', [], [greenmaster])]);
        expect(acc.totals.P).toBe(0);
        expect(acc.applications[0].source.P).toBe('declared');
        // What the retired export accumulator produced from the same entry,
        // and the exact quantity this module must NOT invent:
        expect(21 * 1.7 / 100).toBeCloseTo(0.357, 3);
    });

    test('an ABSENT declaration still falls through to the physical content', () => {
        // The distinction the `> 0` guard could not make. Ca/Mg/S are the live
        // case: the Australian recommender's `delivers` vector carries N/P/K
        // only, so the secondary macros have no declaration at all and are
        // physical — which is what the export's row helper did by hand.
        const acc = delivery.accumulate([month('Jul', [], [greenmaster])]);
        expect(acc.applications[0].source.Ca).toBe('analysis');
        expect(acc.totals.Ca).toBe(0);          // not in this analysis

        const withS = Object.assign({}, greenmaster, { analysis: { N: 12, P: 1.7, K: 5, S: 4 } });
        const acc2 = delivery.accumulate([month('Jul', [], [withS])]);
        expect(acc2.applications[0].source.S).toBe('analysis');
        expect(acc2.totals.S).toBeCloseTo(21 * 4 / 100, 10);
    });

    test('a null, a NaN and a string are not declarations', () => {
        const odd = Object.assign({}, greenmaster, {
            delivers: { N: null, P: NaN, K: '1.1' }
        });
        const acc = delivery.accumulate([month('Jul', [], [odd])]);
        ['N', 'P', 'K'].forEach((n) => expect(acc.applications[0].source[n]).toBe('analysis'));
        expect(acc.totals.N).toBeCloseTo(21 * 12 / 100, 10);
        expect(acc.totals.K).toBeCloseTo(21 * 5 / 100, 10);
    });

    test('an entry with no `delivers` at all is physical on all six keys — the New Zealand path', () => {
        // The Prebble recommender stamps no `delivers` vector, so this is every
        // NZ application and is what nutrition-prebble-integration.js computed
        // by hand before this module existed.
        const mesa = {
            id: 'MESA19', name: 'MESA Country Club 100%', rateKgHa: 200, splitCount: 1,
            analysis: { N: 19, P: 0, K: 16, Ca: 5, Mg: 1.2, S: 6 }
        };
        const acc = delivery.accumulate([month('Jan', [mesa])]);
        ['N', 'P', 'K', 'Ca', 'Mg', 'S'].forEach((n) => {
            expect(acc.applications[0].source[n]).toBe('analysis');
            expect(acc.totals[n]).toBeCloseTo(200 * (mesa.analysis[n] || 0) / 100, 10);
        });
    });
});

describe('GH-399 — mass is rate x count', () => {
    test('splitCount is honoured — the count the combined export ignored', () => {
        // word-export-combined.js multiplied by nothing, so a product the
        // Monthly Schedule prints as "x 2" was purchased once.
        const entry = { id: 'P', name: 'P', rateKgHa: 50, splitCount: 2, analysis: { N: 15 } };
        const acc = delivery.accumulate([month('Mar', [entry])]);
        expect(acc.applications[0].count).toBe(2);
        expect(acc.applications[0].mass).toBe(100);
        expect(acc.products.P.applications).toBe(2);
        expect(acc.totals.N).toBeCloseTo(15, 10);
    });

    test("a liquid's `applications` count is honoured too — GH-401", () => {
        // Long Paddock Rapid Uptake: 7 L/ha sprayed four times in the month.
        // GH-399 shipped this suspended behind `liquidVolume: 'per-month'`
        // while D-3 was open; GH-401 settled it and deleted the option, so
        // there is one behaviour and no mode to pass. See
        // tests/gh401-delivery-volumes-and-rounding.test.js for the real-site
        // consequences.
        const longPaddock = {
            id: 'LP-RAPID', name: 'Long Paddock Rapid Uptake', form: 'liquid',
            rateLHa: 7, applications: 4, analysis: { N: 12, P: 2 }
        };
        const acc = delivery.accumulate([month('Aug', [], [longPaddock])]);
        expect(acc.applications[0].count).toBe(4);
        expect(acc.applications[0].mass).toBe(28);
        expect(acc.products['LP-RAPID'].totalLHa).toBe(28);
        expect(acc.products['LP-RAPID'].applications).toBe(4);
    });

    test('a stale second argument is ignored, it does not resurrect the old mode', () => {
        // GH-401: a caller left over from GH-399 must not be able to ask for
        // the under-count by passing the option that used to select it.
        const entry = { id: 'X', name: 'X', form: 'liquid', rateLHa: 10, applications: 3, analysis: { N: 10 } };
        expect(delivery.accumulate([month('Aug', [], [entry])], { liquidVolume: 'per-month' })
            .applications[0].count).toBe(3);
        expect(delivery.accumulate([month('Aug', [], [entry])], { liquidVolume: 'nonsense' })
            .applications[0].count).toBe(3);
    });
});

describe('GH-399 — units, labels and flags the renderers read', () => {
    test('a soluble listed in the liquid column carries kg/ha, not L/ha (b35fix282)', () => {
        // The Australian catalogue puts a soluble powder's kg/ha figure in
        // `rateLHa` and lists it among the liquids. The unit bucket therefore
        // branches on `form`, never on which array the entry came from — the
        // one rule both surfaces already had and could each have lost.
        const sol = { id: 'MAPTECH', name: 'MAP Tech', form: 'soluble', rateLHa: 10, analysis: { P: 27 } };
        const acc = delivery.accumulate([month('Sep', [], [sol])]);
        expect(acc.products.MAPTECH.totalKgHa).toBe(10);
        expect(acc.products.MAPTECH.totalLHa).toBe(0);
        expect(acc.products.MAPTECH.isSoluble).toBe(true);
    });

    test('a true liquid carries L/ha', () => {
        const liq = { id: 'L', name: 'L', form: 'liquid', rateLHa: 21, analysis: { N: 12 } };
        const acc = delivery.accumulate([month('Jul', [], [liq])]);
        expect(acc.products.L.totalLHa).toBe(21);
        expect(acc.products.L.totalKgHa).toBe(0);
    });

    test('a balancing entry keeps its "(Balance)" label and its quick-release default', () => {
        // The NZ recommender names its precision top-up after the base product
        // and distinguishes it only by an `-BAL` id and an `isBalancing` flag.
        // Both the Plan's row and the parity harness's rendered-name match
        // depend on the " (Balance)" text, and the harness resolves the two
        // same-named rows by nearest total.
        const bal = { id: 'AMMOS-BAL', name: 'Ammos 22 (Nitro 22)', rateKgHa: 50, splitCount: 1,
                      isBalancing: true, analysis: { N: 22 } };
        const base = { id: 'AMMOS', name: 'Ammos 22 (Nitro 22)', rateKgHa: 30, splitCount: 1,
                       analysis: { N: 22 } };
        const acc = delivery.accumulate([month('Jan', [bal, base])]);
        expect(acc.products['AMMOS-BAL'].name).toBe('Ammos 22 (Nitro 22) (Balance)');
        expect(acc.products['AMMOS-BAL'].release).toBe('quick');   // renders with no tag
        expect(acc.products.AMMOS.name).toBe('Ammos 22 (Nitro 22)');
        expect(acc.products.AMMOS.release).toBe('standard');       // renders "(QR)"
        // Two rows, not one: the id keys them apart.
        expect(Object.keys(acc.products).sort()).toEqual(['AMMOS', 'AMMOS-BAL']);
    });

    test("an explicit release tech survives for the Plan's release tag", () => {
        const slow = { id: 'S', name: 'S', rateKgHa: 100, release: 'slow', releaseTech: 'poly',
                       analysis: { N: 20 } };
        const acc = delivery.accumulate([month('Jan', [slow])]);
        expect(acc.products.S.release).toBe('slow');
        expect(acc.products.S.releaseTech).toBe('poly');
    });

    test('`nutrients` and `totalDelivered` are published as the same vector', () => {
        // The renderers read one of two names for this quantity —
        // word-export.js's row helper prefers `nutrients` for N/P/K and
        // `totalDelivered` for S/Ca/Mg, and the AU/UK Plan rows read
        // `totalDelivered`. Publishing both, equal by construction, is what
        // lets that helper be a reader instead of a sixth accumulator.
        const acc = delivery.accumulate([month('Jan', [{ id: 'A', name: 'A', rateKgHa: 100, analysis: { N: 20, S: 5 } }])]);
        expect(acc.products.A.totalDelivered).toEqual(acc.products.A.nutrients);
        expect(acc.products.A.totalDelivered.S).toBeCloseTo(5, 10);
    });
});

describe('GH-399 — amendments are rendered but are not programme delivery', () => {
    const catalogue = { id: 'C', name: 'Catalogue product', rateKgHa: 100, analysis: { N: 20, K: 10 } };
    const amendment = {
        id: 'amendment:K:potassium-sulphate', name: 'Potassium sulphate',
        rateKgHa: 92, splitCount: 1, _isAmendment: true,
        analysis: { K: 41.5, S: 18 }, delivers: { N: 0, P: 0, K: 0 }
    };

    test('an amendment appears in products and applications but not in totals', () => {
        const acc = delivery.accumulate([month('Apr', [catalogue, amendment])]);
        expect(acc.products['amendment:K:potassium-sulphate']).toBeDefined();
        expect(acc.applications.length).toBe(2);
        // Catalogue-only, which is what "programme delivery" has meant since
        // b35fix322 and what word-export.js's _computeProgrammeDelivered skip
        // already assumed.
        expect(acc.totals.N).toBeCloseTo(20, 10);
        expect(acc.totals.K).toBeCloseTo(10, 10);
        expect(acc.totals.S).toBe(0);
    });

    test('the amendment entry keeps `_isAmendment` so the export reader still skips it', () => {
        const acc = delivery.accumulate([month('Apr', [catalogue, amendment])]);
        expect(acc.products['amendment:K:potassium-sulphate']._isAmendment).toBe(true);
        expect(acc.products['amendment:K:potassium-sulphate'].isAmendment).toBe(true);
        expect(acc.products.C._isAmendment).toBeUndefined();
    });

    test('catalogueProducts() drops them for the export, which merges its own', () => {
        const acc = delivery.accumulate([month('Apr', [catalogue, amendment])]);
        expect(Object.keys(delivery.catalogueProducts(acc.products))).toEqual(['C']);
        expect(Object.keys(delivery.catalogueProducts(null))).toEqual([]);
    });
});

describe('GH-399 — no rounding, anywhere', () => {
    test('a long fraction survives the module intact', () => {
        // Chosen to have no short decimal representation: 7 x 3 x 1.7 / 100.
        const e = { id: 'X', name: 'X', form: 'liquid', rateLHa: 7, applications: 3, analysis: { P: 1.7 } };
        const acc = delivery.accumulate([month('Aug', [], [e])], { liquidVolume: 'total' });
        expect(acc.totals.P).toBe(21 * 1.7 / 100);
        expect(acc.totals.P).not.toBe(Math.round(acc.totals.P * 10) / 10);
    });

    test('the accumulator itself contains no rounding call at all', () => {
        // Structural, and deliberately so. Rounding an intermediate inside
        // accumulate() would re-create by hand, in four renderers, the
        // double-rounding artefact this module exists to remove. Callers round
        // at print — GH-401 gave them roundAtOutput() to round WITH, which is
        // the file's only rounding and lives outside accumulate() precisely so
        // this assertion can stay absolute.
        const src = fs.readFileSync(path.join(__dirname, '../assets/nutrition-delivery-core.js'), 'utf8');
        const code = src.replace(/\/\*[\s\S]*?\*\//g, '').replace(/(^|[^:])\/\/[^\n]*/g, '$1');
        const start = code.indexOf('function accumulate(');
        expect(start).toBeGreaterThan(-1);
        const end = code.indexOf('function catalogueProducts(');
        expect(end).toBeGreaterThan(start);
        expect(code.slice(start, end)).not.toMatch(/Math\.round|toFixed|Math\.ceil|Math\.floor/);
        // ...and nothing calls the display helper on its way through, either.
        expect(code.slice(start, end)).not.toMatch(/roundAtOutput/);
    });
});

describe('GH-399 — purity and fail-loud', () => {
    test('no DOM, no site state, no storage', () => {
        const src = fs.readFileSync(path.join(__dirname, '../assets/nutrition-delivery-core.js'), 'utf8');
        const code = src.replace(/\/\*[\s\S]*?\*\//g, '').replace(/(^|[^:])\/\/[^\n]*/g, '$1');
        expect(code).not.toMatch(/document\./);
        expect(code).not.toMatch(/localStorage|sessionStorage/);
        expect(code).not.toMatch(/GAIP_STATE|GAIP_SITE_CONFIG|GAIP_SampleManager/);
        expect(code).not.toMatch(/fetch\(/);
        // The only `window` mentions are the dual-export tail and the IIFE's
        // root argument — four in all, and none of them a read of site state.
        expect((code.match(/window/g) || []).length).toBeLessThanOrEqual(4);
        expect(code).toMatch(/window\.GAIP_NutritionDelivery = API;/);
    });

    test('a malformed entry is reported and skipped, not silently counted', () => {
        const spy = jest.spyOn(console, 'error').mockImplementation(() => {});
        const acc = delivery.accumulate([month('Jan', [{ rateKgHa: 100, analysis: { N: 20 } }])]);
        expect(acc.totals.N).toBe(0);
        expect(Object.keys(acc.products)).toEqual([]);
        expect(spy).toHaveBeenCalledWith(expect.stringContaining('[NutritionDelivery]'));
        spy.mockRestore();
    });

    test('its console prefix does not collide with the parity harness\'s fail-loud regex', () => {
        // tests/e2e/ui-vs-export-parity.test.js treats any console line matching
        // this as a failed run regardless of the numbers.
        const failLoud = /GH-36[0-9]:|GH-377 |climate data unavailable|per-sample programme failed|computeProgram error/;
        expect(failLoud.test('[NutritionDelivery] application with neither id nor name in month Jan — skipped')).toBe(false);
    });

    test('garbage input returns an empty accumulation instead of throwing', () => {
        [null, undefined, 'x', 42, {}].forEach((bad) => {
            const acc = delivery.accumulate(bad);
            expect(acc.totals).toEqual({ N: 0, P: 0, K: 0, Ca: 0, Mg: 0, S: 0 });
            expect(acc.applications).toEqual([]);
        });
        // A hole in the months array, and a month with neither array.
        const acc = delivery.accumulate([null, {}, { granular: null, liquid: undefined }]);
        expect(acc.applications).toEqual([]);
    });

    test('it exports the same dual shape as the requirement half', () => {
        expect(typeof delivery.accumulate).toBe('function');
        expect(typeof delivery.catalogueProducts).toBe('function');
        expect(delivery.NUTRIENTS).toEqual(['N', 'P', 'K', 'Ca', 'Mg', 'S']);
    });
});

// ===========================================================================
// Real programmes, read from the development database on 2026-09-10.
// ===========================================================================

describe('GH-399 — real persisted programmes: the module reproduces the recommender', () => {
    // The invariant. `program.delivered` is the recommender's own accumulator
    // and the quantity its pacing is built on; the module is the renderers'.
    // They are the same sum of the same declared vectors, so they must agree
    // exactly — not to a tolerance.
    [
        ['burns-mlsn', 'Burns / 12th Fairway'],
        ['canberra-mlsn', 'Canberra'],
        ['new-test-location-slan', 'New test - location / Putter Green'],
        ['test1-sports-mlsn', 'Test1 - Sports']
    ].forEach(([name, label]) => {
        test(label + ': module totals equal program.delivered to the last decimal', () => {
            const fx = fixture(name);
            expect(fx.region).toBe('au');
            const acc = delivery.accumulate(fx.monthly);
            ['N', 'P', 'K'].forEach((n) => {
                expect(acc.totals[n]).toBeCloseTo(fx.delivered[n], 6);
            });
        });
    });

    test('Burns: 125.5 N / 12.3 P / 0 K, and no liquid to disagree about', () => {
        const acc = delivery.accumulate(fixture('burns-mlsn').monthly);
        expect(+acc.totals.N.toFixed(1)).toBe(125.5);
        expect(+acc.totals.P.toFixed(1)).toBe(12.3);
        expect(acc.totals.K).toBe(0);
        // Ammonium Sulphate Tech is applied once per month, so this is also the
        // fixture that proves stage 1 cannot move a single-application site.
        expect(delivery.accumulate(fixture('burns-mlsn').monthly, { liquidVolume: 'total' }).totals.N)
            .toBeCloseTo(acc.totals.N, 10);
    });

    test('New test - location: P is 14.0, the Plan\'s figure — NOT the export\'s retired 14.5', () => {
        // The whole ticket, on the site that showed it. Two liquid sprays
        // declare P: 0 against analyses of 1.7% and 2%; the export's retired
        // fallback added 0.357 + 0.14 = 0.497 and printed 14.5.
        // 14.0 is this frozen programme's figure, not the site's current one:
        // GH-400 changed which products the recommender picks there, and the
        // regenerated programme delivers 18.7 (see gh400-au-liquid-phosphorus).
        const fx = fixture('new-test-location-slan');
        const acc = delivery.accumulate(fx.monthly);
        expect(+acc.totals.P.toFixed(1)).toBe(14.0);
        expect(+acc.totals.N.toFixed(1)).toBe(138.8);
        expect(+acc.totals.K.toFixed(1)).toBe(104.6);

        // The retired arithmetic, reproduced here so the number this module
        // must not print is written down rather than remembered.
        let retired = 0;
        fx.monthly.forEach((m) => {
            (m.granular || []).concat(m.liquid || []).forEach((p) => {
                const rate = p.rateKgHa || p.rateLHa || 0;
                const fromDelivers = (p.delivers && p.delivers.P) || 0;
                retired += fromDelivers > 0 ? fromDelivers : rate * ((p.analysis && p.analysis.P) || 0) / 100;
            });
        });
        expect(+retired.toFixed(1)).toBe(14.5);
        expect(+acc.totals.P.toFixed(1)).not.toBe(+retired.toFixed(1));
    });

    test('New test - location: the two phosphorus-bearing sprays contribute exactly zero', () => {
        const acc = delivery.accumulate(fixture('new-test-location-slan').monthly);
        expect(acc.products['ICL-GREENMASTERL'].nutrients.P).toBe(0);
        expect(acc.products['ICL-GREENMASTERL'].analysis.P).toBe(1.7);
        const lp = Object.values(acc.products).find((p) => /Long Paddock/i.test(p.name || ''));
        expect(lp).toBeDefined();
        expect(lp.nutrients.P).toBe(0);
        expect(lp.analysis.P).toBeGreaterThan(0);
    });

    test('Canberra: 184.7 / 22.6 / 110.9', () => {
        const acc = delivery.accumulate(fixture('canberra-mlsn').monthly);
        expect(+acc.totals.N.toFixed(1)).toBe(184.7);
        expect(+acc.totals.P.toFixed(1)).toBe(22.6);
        expect(+acc.totals.K.toFixed(1)).toBe(110.9);
    });

    test('Test1 - Sports: 149.0 / 12.1 / 88.4', () => {
        const acc = delivery.accumulate(fixture('test1-sports-mlsn').monthly);
        expect(+acc.totals.N.toFixed(1)).toBe(149.0);
        expect(+acc.totals.P.toFixed(1)).toBe(12.1);
        expect(+acc.totals.K.toFixed(1)).toBe(88.4);
    });

    test('Test5 - NZ: 237.4 N, no phosphorus, and the physical route on every key', () => {
        const fx = fixture('test5-nz-soccer');
        expect(fx.region).toBe('nz');
        const acc = delivery.accumulate(fx.monthly);
        expect(+acc.totals.N.toFixed(1)).toBe(237.4);
        expect(acc.totals.P).toBe(0);
        // The Prebble recommender declares nothing, so every catalogue key here
        // came from rate x splitCount x analysis — the arithmetic
        // nutrition-prebble-integration.js did in-line before this module.
        acc.applications
            .filter((a) => !a.isAmendment)
            .forEach((a) => ['N', 'P', 'K'].forEach((n) => expect(a.source[n]).toBe('analysis')));
        // splitCount is real on this programme and is the count the combined
        // export used to drop.
        expect(acc.applications.some((a) => a.count === 2)).toBe(true);
    });

    test('Test5 - NZ: this persisted programme carries an export-injected amendment, and it is excluded', () => {
        // Not a synthetic case. A previous Word export merged its potassium
        // sulphate decision into the LIVE programme object (b35fix323 injects
        // amendment granulars into `monthly`), and that object was then
        // persisted to the site config — so the stored programme is not what
        // the recommender returned. The module excludes it from `totals` by its
        // `_isAmendment` flag, which is what makes the accumulation depend on
        // the programme rather than on how many times a document was generated.
        const acc = delivery.accumulate(fixture('test5-nz-soccer').monthly);
        const amendment = acc.products['amendment:K:potassium-sulphate'];
        expect(amendment).toBeDefined();
        expect(amendment.isAmendment).toBe(true);
        expect(amendment.totalKg).toBe(92);
        // 92 kg/ha at 41.5% K is 38.18 kg of potassium that is an amendment,
        // not programme delivery — and would be counted twice the moment the
        // export merged its own amendment rows on top.
        expect(acc.totals.K).toBeCloseTo(175.2, 1);
        expect(acc.totals.K + 92 * 41.5 / 100).toBeCloseTo(213.4, 1);
        expect(Object.keys(delivery.catalogueProducts(acc.products)))
            .not.toContain('amendment:K:potassium-sulphate');
    });

    test('Test6 - UK: a slow release listed in every covered month is NOT triple-counted', () => {
        // The reason "delivered" is the declaration and not the physical
        // content. The UK recommender lists a controlled-release granular in
        // each month it covers and credits `rate x pct / monthsCovered`.
        // Summing the physical content of those listed applications instead
        // would print 294.5 kg of nitrogen against a true 199.8.
        const fx = fixture('test6-uk-mlsn');
        expect(fx.region).toBe('uk');
        const acc = delivery.accumulate(fx.monthly);
        expect(+acc.totals.N.toFixed(1)).toBe(199.8);

        let physical = 0;
        fx.monthly.forEach((m) => {
            (m.granular || []).concat(m.liquid || []).forEach((p) => {
                physical += (p.rateKgHa || p.rateLHa || 0) * ((p.analysis && p.analysis.N) || 0) / 100;
            });
        });
        expect(physical.toFixed(1)).toBe('294.5');
        // Not a rounding difference — the module credits barely two thirds of
        // the physical content, because the same bag is listed three times.
        expect(acc.totals.N).toBeLessThan(physical * 0.7);
    });

    test('Test6 - UK: the module and the UK recommender differ on P by its own 1 dp rounding', () => {
        // The one place in this ticket where the module's total and the
        // recommender's `delivered` are not the same number, and the reason
        // nutrition-uk-fertiliser-integration.js's Nutrient Delivery Summary
        // deliberately still prints `program.delivered`: the UK recommender
        // rounds each application's `delivers` vector to 1 dp when it stamps
        // it, but accumulates its own total from the unrounded values. Reading
        // the module there would make the panel self-consistent at 27.8 — and
        // would move a figure the Plan page prints today, which this ticket
        // does not do. Nitrogen and potassium are unaffected at 1 dp.
        const fx = fixture('test6-uk-mlsn');
        const acc = delivery.accumulate(fx.monthly);
        expect(+fx.delivered.P.toFixed(1)).toBe(27.9);
        expect(+acc.totals.P.toFixed(1)).toBe(27.8);
        expect(fx.delivered.P - acc.totals.P).toBeCloseTo(0.109, 3);
        // N and K agree at the printed precision.
        expect(+acc.totals.N.toFixed(1)).toBe(+fx.delivered.N.toFixed(1));
        expect(+acc.totals.K.toFixed(1)).toBe(+fx.delivered.K.toFixed(1));
    });

    test('every fixture accumulates without a console error', () => {
        const spy = jest.spyOn(console, 'error').mockImplementation(() => {});
        fs.readdirSync(path.join(__dirname, 'fixtures'))
            .filter((f) => f.startsWith('gh399-delivery-programme-'))
            .forEach((f) => {
                const fx = JSON.parse(fs.readFileSync(path.join(__dirname, 'fixtures', f), 'utf8'));
                const acc = delivery.accumulate(fx.monthly);
                expect(Object.keys(acc.products).length).toBeGreaterThan(0);
            });
        expect(spy).not.toHaveBeenCalled();
        spy.mockRestore();
    });
});

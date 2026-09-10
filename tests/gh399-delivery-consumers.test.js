/**
 * GH-399 — source-text guard: product-delivery arithmetic must not reappear
 * outside assets/nutrition-delivery-core.js.
 *
 * Modelled on tests/gh398-monthly-distribution-guard.test.js and
 * tests/gh383-input-contract-guard.test.js, which have each already caught a
 * revert of the contract they guard. The failure mode this file exists for is
 * the one that produced GH-399 in the first place, and no behavioural test can
 * see it coming: someone needs a delivered figure in a renderer, writes the
 * three lines that compute it there, and it agrees with the shared copy on
 * whatever fixture is under test. Five such copies accumulated. They disagreed
 * about whether a declared zero was a zero, and the Plan page printed 14.0
 * phosphorus beside a client document printing 14.5 — a -7% verdict beside a
 * -5% one, off the same programme, for as long as that lasted.
 *
 * So this file asserts three structural things:
 *   1. Each of the five consumers CALLS the module.
 *   2. The specific retired expressions are ABSENT from those files.
 *   3. Every blade that loads a consumer also enqueues the module, ahead of it.
 */

'use strict';

const fs = require('fs');
const path = require('path');

function readAsset(file) {
    return fs.readFileSync(path.join(__dirname, '../assets/' + file), 'utf8');
}
function readView(file) {
    return fs.readFileSync(path.join(__dirname, '../app/resources/views/' + file), 'utf8');
}

/**
 * Comments stripped. The retired arithmetic is DESCRIBED at length in the
 * comments that replaced it — which is the documentation a reader needs, and
 * exactly what a naive text search would trip over. This file asserts about
 * CODE.
 */
function code(src) {
    return src.replace(/\/\*[\s\S]*?\*\//g, '').replace(/(^|[^:])\/\/[^\n]*/g, '$1');
}

const MODULE = 'nutrition-delivery-core.js';

const CONSUMERS = [
    ['nutrition-prebble-integration.js', 'Plan page, New Zealand'],
    ['nutrition-au-fertiliser-integration.js', 'Plan page, Australia'],
    ['nutrition-uk-fertiliser-integration.js', 'Plan page, United Kingdom'],
    ['word-export-combined.js', 'Combined Word export, per sample'],
    ['word-export.js', 'single Word export']
];

describe('GH-399 — the accumulator exists exactly once', () => {
    const shared = code(readAsset(MODULE));

    test('the shared module holds the rule, the mass and the amendment exclusion', () => {
        // "A declared zero is a zero" — a finite number, INCLUDING zero, is a
        // declaration; the `> 0` guard was the defect.
        expect(shared).toMatch(/function _isDeclared\(delivers, nutrient\)/);
        expect(shared).toMatch(/typeof v === 'number' && isFinite\(v\)/);
        // ...and the physical fall-through where nothing is declared.
        expect(shared).toMatch(/mass \* _num\(analysis\[n\]\) \/ 100/);
        // mass = rate x count.
        expect(shared).toMatch(/var mass = rate \* count;/);
        expect(shared).toMatch(/function _count\(entry\)/);
        expect(shared).toMatch(/entry\.splitCount/);
        // Catalogue-only totals.
        expect(shared).toMatch(/if \(p\.isAmendment\) return;/);
    });

    test('the `> 0` guard is not in it', () => {
        // The single most important line of this file. If this ever passes
        // again the export is back to inventing phosphorus.
        expect(shared).not.toMatch(/fromDelivers > 0/);
        expect(shared).not.toMatch(/delivers\[[^\]]+\] > 0/);
    });

    test('and the liquid-volume option is gone, not left as a switch nobody sets', () => {
        // GH-401 settled it: `applications` always counts, so there is no
        // second behaviour to select. The option is deleted rather than
        // defaulted, because a mode with no caller is a mode nobody maintains.
        // The live assertion that the count is honoured is in
        // tests/gh401-delivery-volumes-and-rounding.test.js.
        expect(shared).not.toMatch(/liquidVolume/);
        expect(shared).not.toMatch(/per-month/);
    });
});

describe('GH-399 — every consumer calls the module', () => {
    CONSUMERS.forEach(([file, what]) => {
        test(what + ' (' + file + ')', () => {
            const src = code(readAsset(file));
            expect(src).toMatch(/GAIP_NutritionDelivery/);
            // ...and reports it rather than improvising when the blade has not
            // enqueued it. A silent fallback to a second local accumulator is
            // the thing this ticket removed.
            expect(src).toMatch(/is not loaded/);
        });
    });

    test('the three Plan integrations route through one named helper each', () => {
        ['nutrition-prebble-integration.js', 'nutrition-au-fertiliser-integration.js',
         'nutrition-uk-fertiliser-integration.js'].forEach((f) => {
            const src = code(readAsset(f));
            expect(src).toMatch(/accumulateDelivery: function\(monthly\)/);
            expect(src).toMatch(/this\.accumulateDelivery\(/);
        });
    });

    test('the combined export accumulates the CATALOGUE programme, before its amendment merge', () => {
        const src = code(readAsset('word-export-combined.js'));
        expect(src).toMatch(/_deliveryMod\.catalogueProducts\(/);
        // Order: the accumulation must precede the merge that adds amendment
        // rows, or the decisions are computed against a programme containing
        // the very products they produce.
        const accAt = src.indexOf('_deliveryMod.accumulate(');
        const mergeAt = src.indexOf('_computeAmendmentDecision');
        expect(accAt).toBeGreaterThan(-1);
        expect(mergeAt).toBeGreaterThan(accAt);
    });

    test('the single export REBUILDS from `monthly` rather than trusting a persisted annualSummary', () => {
        // window.GAIP_NUTRITION_PROGRAM is restored from the site config on a
        // fresh /reports/export page, so until every site regenerates it can
        // carry an annualSummary built by an older release. Rebuilding is what
        // makes the first export after a deploy right rather than a version
        // behind — and is the difference between "one implementation" being
        // true and being aspirational.
        const src = code(readAsset('word-export.js'));
        expect(src).toMatch(/_deliveryMod\.accumulate\(prog\.monthly\)/);
        expect(src).toMatch(/_deliveryMod\.catalogueProducts\(_acc\.products\)/);
    });
});

describe('GH-399 — the retired accumulators are gone, not commented out', () => {
    test('the combined export no longer prefers a declared value only when it is positive', () => {
        // word-export-combined.js: `fromDelivers > 0 ? fromDelivers :
        // analysis x rate`. THE defect — it read the Australian recommender's
        // deliberate `P: 0` as "absent" and substituted the analysis figure.
        const src = code(readAsset('word-export-combined.js'));
        expect(src).not.toMatch(/fromDelivers/);
    });

    test('the export row helper no longer tops phosphorus up from analysis', () => {
        // word-export.js _extractEntryNutrients: when an entry's P was exactly
        // zero it substituted `analysis x totalKg`, so a document's own product
        // rows showed phosphorus its ANR Delivered column did not. One
        // document, two answers, on facing pages.
        const src = code(readAsset('word-export.js'));
        const fn = src.slice(src.indexOf('function _extractEntryNutrients'),
                             src.indexOf('function _detectActiveNutrientColumns'));
        expect(fn.length).toBeGreaterThan(100);
        expect(fn).not.toMatch(/analysis/);
        expect(fn).not.toMatch(/totalKgHa|totalLHa|totalKg/);
        // It is a reader now, and must stay one that accepts BOTH names: the
        // amendment entries from _amendmentDecisionsToProducts carry
        // `totalDelivered` and no `nutrients`.
        expect(fn).toMatch(/entry\.nutrients/);
        expect(fn).toMatch(/entry\.totalDelivered/);
    });

    test('_computeProgrammeDelivered survives unchanged as the reader it always was', () => {
        // GH-396 pins this function; it keeps the _isAmendment skip and the
        // two-name read. It is not an accumulator over applications — it sums
        // a product map the module built.
        const src = code(readAsset('word-export.js'));
        const fn = src.slice(src.indexOf('function _computeProgrammeDelivered'),
                             src.indexOf('function _extractEntryNutrients'));
        expect(fn).toMatch(/if \(entry\._isAmendment\) return;/);
        expect(fn).toMatch(/entry\.nutrients \|\| entry\.totalDelivered/);
    });

    test('the product map each Plan panel renders IS the module\'s output', () => {
        // Pinned as expressions, not as "the file mentions the module".
        // Red-checked: putting the Australian panel's private accumulator loop
        // back while leaving accumulateDelivery() in the file for the totals
        // line passed every other assertion here. A consumer can call the
        // module for one figure and hand-roll the next one, which is precisely
        // how a document came to disagree with the page that produced it.
        expect(code(readAsset('nutrition-au-fertiliser-integration.js')))
            .toMatch(/const productUsage = this\.accumulateDelivery\(program\.monthly\)\.products;/);
        expect(code(readAsset('nutrition-uk-fertiliser-integration.js')))
            .toMatch(/var productUsage = this\.accumulateDelivery\(monthly\)\.products;/);
        expect(code(readAsset('nutrition-prebble-integration.js')))
            .toMatch(/const productEntries = Object\.entries\(_deliveryAcc\.products\);/);
    });

    test('nothing accumulates a `delivers` vector outside the module', () => {
        // The shape every one of the five had: walk the applications, add
        // `p.delivers[n]` into a running total. Stamping a `delivers` vector on
        // an entry is a different act — that is the UK recommender doing its
        // job, and it is a plain assignment, not a `+=`.
        CONSUMERS.forEach(([file]) => {
            const src = code(readAsset(file));
            const hits = src.match(/\+=[^;\n]*\bdelivers\b/g) || [];
            expect({ file, hits }).toEqual({ file, hits: [] });
        });
    });

    test('no Plan integration walks the monthly arrays to accumulate delivery any more', () => {
        // The shape all three had: iterate monthly, iterate granular/liquid,
        // add into a nutrientTotals vector. `nutrientTotals` itself stays —
        // GH-316 pins classifyBalance('N', nutrientRequired.N,
        // nutrientTotals.N) — but nothing may add into it from an application.
        ['nutrition-prebble-integration.js', 'nutrition-au-fertiliser-integration.js'].forEach((f) => {
            const src = code(readAsset(f));
            expect(src).not.toMatch(/nutrientTotals\.[NPK] \+=/);
            expect(src).not.toMatch(/nutrientTotals\[[^\]]+\] \+=/);
        });
    });

    test('and the totals line each of them prints comes FROM the module, not from anywhere else', () => {
        // GH-399 review found the gap this closes. The negative assertions
        // above only forbid the `+=` shape the old loops used; they say
        // nothing about where the totals line gets its numbers, so reverting
        // either integration to `program.delivered` — the pre-GH-399
        // behaviour — left the whole suite green. It happens to print the
        // same figures today (the module's totals equal `program.delivered`
        // on every AU programme, pinned on the real fixtures in
        // gh399-nutrition-delivery-core.test.js), so this is not a live bug;
        // it is a hole in the regression guard, which is the thing this
        // ticket exists to provide. Pin the source positively.
        const au = code(readAsset('nutrition-au-fertiliser-integration.js'));
        expect(au).toMatch(/N:\s*_deliveryAcc\.totals\.N,\s*P:\s*_deliveryAcc\.totals\.P,\s*K:\s*_deliveryAcc\.totals\.K/);
        expect(au).not.toMatch(/nutrientTotals\s*=\s*\{[^}]*program\.delivered/);

        const nz = code(readAsset('nutrition-prebble-integration.js'));
        expect(nz).toMatch(/const nutrientTotals = \{ \.\.\._deliveryAcc\.totals \};/);
        expect(nz).not.toMatch(/nutrientTotals\s*=\s*\{[^}]*program\.delivered/);
    });

    test("GH-403 closed GH-399's one documented exception: the UK panel reads the module too", () => {
        // GH-399 left nutrition-uk-fertiliser-integration.js's Nutrient
        // Delivery Summary printing `program.delivered` rather than the shared
        // accumulator, deliberately, because reading the module there would
        // have moved a figure the Plan prints and GH-399 moved nothing on the
        // Plan. It also recorded what that cost: the UK recommender rounds each
        // application's `delivers` vector to 1 dp when it stamps it but totals
        // the UNROUNDED values, so on Test6 its own P is 27.909 — printing 27.9
        // above rows of its own that sum to 27.8.
        //
        // That is the caption-contradicts-its-rows defect GH-403 exists to
        // remove, in the same table, so GH-403 took the one line. All four
        // surfaces now read one accumulation.
        const src = code(readAsset('nutrition-uk-fertiliser-integration.js'));
        expect(src).toMatch(/var nutrientTotals = this\.accumulateDelivery\(monthly\)\.totals;/);
        expect(src).not.toMatch(/nutrientTotals = \{ N: program\.delivered\.N/);
        expect(src).toMatch(/var productUsage = this\.accumulateDelivery\(monthly\)\.products;/);
        // ...and the history of the exception stays written down where the next
        // reader will be standing. (The comment wraps, so this tolerates the
        // line break and the leading `//`.)
        expect(readAsset('nutrition-uk-fertiliser-integration.js'))
            .toMatch(/rounds each[\s/*]*application's `delivers` vector to 1 dp/);
    });

    test('no consumer re-derives a nutrient from analysis x rate', () => {
        // The physical fall-through belongs in the module, where the
        // application count is known. Every hand-written copy of it dropped
        // that count.
        CONSUMERS.forEach(([file]) => {
            const src = code(readAsset(file));
            const hits = src.match(/analysis[^\n]{0,40}\* *(rate|total)[A-Za-z]* *\/ *100/g) || [];
            expect({ file, hits }).toEqual({ file, hits: [] });
        });
    });
});

describe('GH-399 — the module is enqueued in every blade that loads a consumer', () => {
    const BLADES = [
        ['plan.blade.php', 'nutrition-prebble-integration.js'],
        ['hub.blade.php', 'nutrition-prebble-integration.js'],
        ['reports/export.blade.php', 'nutrition-prebble-integration.js'],
        ['reports/scenarios.blade.php', 'nutrition-prebble-integration.js'],
        ['reports/forensic.blade.php', 'nutrition-prebble-integration.js']
    ];

    /**
     * The ENQUEUE, not a mention. Both blade shapes quote the filename —
     * `$legacyAssetUrl('x.js')` on plan.blade.php, `'x.js',` in the array the
     * other four build — while the comments that explain the load order name
     * the same files bare. Searching for the bare name finds the comment first
     * and reports a load order that is not the one the page uses.
     */
    const enqueueAt = (src, file) => src.indexOf("'" + file + "'");

    BLADES.forEach(([blade, consumer]) => {
        test(blade + ' enqueues it, ahead of its consumers', () => {
            const src = readView(blade);
            const at = enqueueAt(src, MODULE);
            expect(at).toBeGreaterThan(-1);
            // Load order is not decoration: the integrations resolve
            // window.GAIP_NutritionDelivery at call time, but the guard's
            // console.error is the only symptom of getting it wrong, and a
            // document full of zeros looks like a site with no programme.
            const consumerAt = enqueueAt(src, consumer);
            expect(consumerAt).toBeGreaterThan(-1);
            expect(at).toBeLessThan(consumerAt);
        });
    });

    test('and the five blades are the same five GH-396 enumerates for the balance classifier', () => {
        // Same consumers, same pages. If a sixth blade ever loads the
        // integrations, both modules need adding, and this is where that shows.
        BLADES.forEach(([blade]) => {
            const src = readView(blade);
            const balanceAt = enqueueAt(src, 'nutrient-balance-status.js');
            expect(balanceAt).toBeGreaterThan(-1);
            expect(balanceAt).toBeLessThan(enqueueAt(src, MODULE));
        });
    });
});

/**
 * GH-400 — the phosphorus Australian liquid applications actually carry.
 *
 * `au-fertiliser-products.js` pushed `delivers: { N, P: 0, K }` onto every
 * liquid application in the annual programme, with no comment justifying the
 * zero, while the same objects' `analysis.P` carried up to 2% phosphorus. The
 * granular sibling has computed `pDelivered = rate x analysis.P / 100` since
 * the file's first commit; the liquid path simply never computed it.
 *
 * TWO HALVES, and the second is the one that matters:
 *
 *   1. `selectFoliarNitrogen()` now returns `pDelivered`, and the application
 *      declares it — so the Plan page's Delivered column, its product rows and
 *      the Word export stop printing a zero for a spray that carries P.
 *
 *   2. `delivered.P += liquidRec.pDelivered` — the annual accumulator. This is
 *      what `netP` (GH-342's `annualTargets.P - delivered.P` cap), the
 *      strategic-P top-up's `annualPRemaining`, and through them both P-delivery
 *      scorers read. Declaring the phosphorus without accumulating it would make
 *      the report honest while leaving product selection working from a
 *      requirement inflated by exactly the phosphorus already applied.
 *
 * The "declaration only" tests below are not hypothetical: they run a copy of
 * the real source with half the fix removed and show what it costs — on
 * Westview the product rows would sum to 30.6 kg P while the annual total said
 * 20.1, which is GH-391's defect ("a row the total does not contain") in a new
 * nutrient.
 *
 * Region scope: Australian recommender only. Nothing in the New Zealand
 * (`prebbles-products.js`) or UK path is touched, and the guard at the bottom
 * asserts that.
 */

'use strict';

const fs = require('fs');
const path = require('path');
const vm = require('vm');

const SOURCE_PATH = path.join(__dirname, '../assets/au-fertiliser-products.js');
const SOURCE = fs.readFileSync(SOURCE_PATH, 'utf8');

/** The one line that carries half 2 of the fix. */
const ACCUMULATOR_LINE = 'delivered.P += liquidRec.pDelivered || 0;';
/** The one line that carries half 1. */
const DECLARATION_LINE = 'P: liquidRec.pDelivered || 0,';

function loadRecommender(src) {
    const noop = () => {};
    const sandbox = { window: {}, console: { log: noop, warn: noop, error: noop, info: noop } };
    vm.runInNewContext(src, sandbox, { filename: 'au-fertiliser-products.js' });
    return sandbox.window.AuFertiliserRecommender;
}

/**
 * A copy of the real recommender with the accumulator line removed and the
 * declaration left in place — i.e. "half the fix". Used to prove the second
 * half is load-bearing rather than a restatement of the first.
 */
function loadDeclarationOnlyRecommender() {
    if (SOURCE.indexOf(ACCUMULATOR_LINE) === -1) {
        throw new Error('GH-400: accumulator line not found in au-fertiliser-products.js — '
            + 'if it was reworded, reword the anchor here too, do not delete this test.');
    }
    return loadRecommender(SOURCE.replace(ACCUMULATOR_LINE, '/* GH-400 accumulator removed for this test */'));
}

const rec = loadRecommender(SOURCE);

const FIXTURE_DIR = path.join(__dirname, 'fixtures');
function fixture(slug) {
    return JSON.parse(fs.readFileSync(path.join(FIXTURE_DIR, 'gh400-au-requirements-' + slug + '.json'), 'utf8'));
}
function runSite(slug, recommender) {
    const fx = fixture(slug);
    return (recommender || rec).generateAnnualProgram(fx.requirements, fx.options);
}

/** Every application in the programme, granular and liquid alike. */
function allApplications(program) {
    const out = [];
    program.monthly.forEach((m, idx) => {
        (m.granular || []).forEach((p) => out.push(Object.assign({ _idx: idx, _liquid: false }, p)));
        (m.liquid || []).forEach((p) => out.push(Object.assign({ _idx: idx, _liquid: true }, p)));
    });
    return out;
}
function rowSum(program, nutrient) {
    return allApplications(program).reduce((s, p) => s + ((p.delivers && p.delivers[nutrient]) || 0), 0);
}
const r1 = (v) => Math.round(v * 10) / 10;

// ---------------------------------------------------------------------------
// Half 1 — selectFoliarNitrogen declares the phosphorus it applies
// ---------------------------------------------------------------------------

describe('GH-400 half 1 — the liquid selector returns pDelivered', () => {
    /**
     * Shaped on Long Paddock Rapid Uptake, the product from the live case:
     * 2% P, label max 7 L/ha, so a real N requirement forces the 4-application
     * cap and the phosphorus is four sprays' worth, not one.
     */
    const longPaddockShape = {
        id: 'TEST-LP', name: 'Test Rapid Uptake', brand: 'test',
        form: 'liquid', release: 'quick',
        analysis: { N: 11, P: 2, K: 10 },
        rates: { maxLHa: 7, greensLHa: 7 },
    };
    /** Shaped on Greenmaster Liquid Spring & Summer: 1.7% P, one application. */
    const greenmasterShape = {
        id: 'TEST-GM', name: 'Test Liquid Spring & Summer', brand: 'test',
        form: 'liquid', release: 'quick',
        analysis: { N: 12, P: 1.7, K: 5 },
        rates: { maxLHa: 30, greensLHa: 30 },
    };
    const context = { gp: 0.5, isGreens: true, surfaceType: 'golf_greens', season: 'Winter',
        monthNum: 8, hemisphere: 'south', soilPSufficient: false, muldersFlags: {} };

    test('multi-application spray: P counts every application, as N and K already did', () => {
        const pick = rec.selectFoliarNitrogen([longPaddockShape],
            { month_name: 'Aug', gp: 0.5, N: 20, P: 0.4, K: 3 }, context);
        expect(pick.name).toBe('Test Rapid Uptake');
        expect(pick.rateLHa).toBe(7);
        expect(pick.applications).toBe(4);
        // 7 L/ha x 4 x 2% = 0.56 -> 0.6, the same 1 dp rounding N and K get.
        expect(pick.pDelivered).toBe(0.6);
        // The multiplier is the same one N and K use — not one application's worth.
        expect(pick.nDelivered).toBe(r1(7 * 4 * 0.11));
        expect(pick.kDelivered).toBe(r1(7 * 4 * 0.10));
    });

    test('single-application spray: 21 L/ha at 1.7% P is 0.4, not 0', () => {
        const pick = rec.selectFoliarNitrogen([greenmasterShape],
            { month_name: 'Jul', gp: 0.5, N: 2.5, P: 0.3, K: 1 }, context);
        expect(pick.rateLHa).toBe(21);
        expect(pick.applications).toBe(1);
        expect(pick.pDelivered).toBe(0.4); // 21 x 1.7% = 0.357
    });

    test('a genuinely phosphorus-free spray still delivers zero', () => {
        const urea = { id: 'TEST-U', name: 'Test Urea', brand: 'test', form: 'soluble',
            release: 'quick', analysis: { N: 46, P: 0, K: 0 }, maxRateKgHa: 20, greensMaxRateKgHa: 15 };
        const pick = rec.selectFoliarNitrogen([urea],
            { month_name: 'Sep', gp: 0.5, N: 10, P: 3, K: 0 }, context);
        expect(pick.pDelivered).toBe(0);
    });

    test('every liquid application in a real programme declares rate x applications x analysis.P', () => {
        let checked = 0;
        ['new-test-location', 'test1-sports', 'canberra', 'westview'].forEach((slug) => {
            allApplications(runSite(slug)).filter((p) => p._liquid).forEach((p) => {
                const expected = r1((p.rateLHa || 0) * (p.applications || 1) * ((p.analysis && p.analysis.P) || 0) / 100);
                expect({ site: slug, name: p.name, P: p.delivers.P })
                    .toEqual({ site: slug, name: p.name, P: expected });
                checked++;
            });
        });
        expect(checked).toBeGreaterThan(5);
    });

    test('the phosphorus-bearing sprays of the live case no longer declare zero', () => {
        const liquids = allApplications(runSite('new-test-location')).filter((p) => p._liquid);
        const gm = liquids.find((p) => /Greenmaster Liquid Spring/.test(p.name));
        const lp = liquids.find((p) => /Long Paddock Rapid Uptake/.test(p.name));
        expect(gm).toBeDefined();
        expect(lp).toBeDefined();
        expect(gm.analysis.P).toBe(1.7);
        expect(lp.analysis.P).toBe(2);
        expect(gm.delivers.P).toBe(0.4); // 21 L/ha x 1
        expect(lp.delivers.P).toBe(0.6); // 7 L/ha x 4
    });
});

// ---------------------------------------------------------------------------
// Half 2 — the annual accumulator sees it, so the requirement is right
// ---------------------------------------------------------------------------

describe('GH-400 half 2 — delivered.P includes liquid phosphorus', () => {
    const SITES = ['federal-golf', 'test1-sports', 'burns', 'canberra', 'westview', 'new-test-location'];

    test.each(SITES)('%s: the annual total equals the sum of the rows (the GH-391 invariant)', (slug) => {
        const program = runSite(slug);
        ['N', 'P', 'K'].forEach((n) => {
            expect(`${slug} ${n} ${r1(program.delivered[n])}`)
                .toBe(`${slug} ${n} ${r1(rowSum(program, n))}`);
        });
    });

    /**
     * How far the product rows would out-run the annual total if only the
     * declaration half had been implemented — measured, per site, not argued.
     * Zero on the two sites whose liquid column carries no phosphorus at all.
     */
    const DECLARATION_ONLY_GAP_P = {
        'federal-golf': 0, 'burns': 0, 'test1-sports': 2.0,
        'canberra': 1.3, 'westview': 10.5, 'new-test-location': 1.0,
    };

    test.each(SITES)('%s: declaring without accumulating breaks that invariant', (slug) => {
        const half = runSite(slug, loadDeclarationOnlyRecommender());
        expect(r1(rowSum(half, 'P') - half.delivered.P)).toBe(DECLARATION_ONLY_GAP_P[slug]);
    });

    test('Test1 - Sports: the strategic P top-up buys half the MAP Tech it used to', () => {
        // The clearest demonstration that the accumulator feeds the requirement.
        // Two sprays (Long Paddock Sportsturf 10-2-6 and X Factor 18-3-6) put
        // 2.0 kg P/ha on the turf. `annualPRemaining = annualTargets.P -
        // delivered.P` is therefore 2.0 kg smaller when the strategic-P block
        // runs, and selectPhosphorusSource sizes its application from it.
        const both = runSite('test1-sports');
        const half = runSite('test1-sports', loadDeclarationOnlyRecommender());
        const mapOf = (p) => allApplications(p).find((x) => /^MAP Tech/.test(x.name));
        expect(mapOf(half).rateKgHa).toBe(15);
        expect(mapOf(half).delivers.P).toBe(4.1);
        expect(mapOf(both).rateKgHa).toBe(7);
        expect(mapOf(both).delivers.P).toBe(1.9);

        const liquidP = allApplications(both).filter((p) => p._liquid)
            .reduce((s, p) => s + p.delivers.P, 0);
        expect(r1(liquidP)).toBe(2.0);
        // Against a 12.0 kg annual target, the programme lands at 11.9 instead
        // of buying phosphorus the sprays had already supplied.
        expect(r1(both.targets.P)).toBe(12.0);
        expect(r1(both.delivered.P)).toBe(11.9);
        expect(r1(half.delivered.P)).toBe(12.1);
    });

    test('New test - location: the strategic P application is no longer needed at all', () => {
        // Before GH-400 this site ended September with a 10 kg/ha MAP Tech
        // top-up to close a 2.7 kg gap the sprays had in fact already narrowed.
        const both = runSite('new-test-location');
        const half = runSite('new-test-location', loadDeclarationOnlyRecommender());
        expect(allApplications(half).some((p) => /^MAP Tech/.test(p.name))).toBe(true);
        expect(allApplications(both).some((p) => /^MAP Tech/.test(p.name))).toBe(false);
    });
});

// ---------------------------------------------------------------------------
// Real-data pins: what each Australian dev site delivers after GH-400
// ---------------------------------------------------------------------------

describe('GH-400 real-data pins (dev sites, 2026-09-10)', () => {
    /**
     * `before` is the working tree with BOTH halves reverted — what these sites
     * delivered up to and including GH-399. `after` is what they deliver now.
     * Recorded so that a future change to the recommender that moves any of
     * these has to move the number here too, deliberately.
     */
    const EXPECTED = {
        'federal-golf':      { before: [135.1, 13.2, 73.4],  after: [135.1, 13.2, 73.4],  targets: [120.0, 11.9, 63.9] },
        'burns':             { before: [125.5, 12.3, 0],     after: [125.5, 12.3, 0],     targets: [120.1, 14.0, 0] },
        'test1-sports':      { before: [149.0, 12.1, 88.4],  after: [148.0, 11.9, 88.4],  targets: [120.0, 12.0, 66.9] },
        'canberra':          { before: [184.7, 22.6, 110.9], after: [184.7, 23.9, 110.9], targets: [200.0, 19.9, 110.0] },
        'westview':          { before: [218.6, 20.1, 139.0], after: [224.8, 21.4, 154.1], targets: [200.1, 20.0, 125.0] },
        'new-test-location': { before: [138.8, 14.0, 104.6], after: [137.6, 18.7, 104.5], targets: [120.0, 14.0, 103.0] },
    };

    /** Both halves reverted — the pre-GH-400 recommender, for the `before` column. */
    function loadPreFixRecommender() {
        if (SOURCE.indexOf(DECLARATION_LINE) === -1) {
            throw new Error('GH-400: declaration line not found in au-fertiliser-products.js — '
                + 'if it was reworded, reword the anchor here too, do not delete this test.');
        }
        return loadRecommender(SOURCE
            .replace(ACCUMULATOR_LINE, '/* GH-400 accumulator reverted for this test */')
            .replace(DECLARATION_LINE, 'P: 0,'));
    }

    Object.keys(EXPECTED).forEach((slug) => {
        test(`${slug}: delivered N/P/K`, () => {
            const e = EXPECTED[slug];
            const after = runSite(slug);
            const before = runSite(slug, loadPreFixRecommender());
            expect(['N', 'P', 'K'].map((n) => r1(after.delivered[n]))).toEqual(e.after);
            expect(['N', 'P', 'K'].map((n) => r1(before.delivered[n]))).toEqual(e.before);
            expect(['N', 'P', 'K'].map((n) => r1(after.targets[n]))).toEqual(e.targets);
        });
    });

    test('sites with no phosphorus in the liquid column do not move at all', () => {
        // Burns applies Ammonium Sulphate Tech (21-0-0); Federal Golf applies
        // Urea Tech (46-0-0). Nothing to count, nothing to change.
        ['burns', 'federal-golf'].forEach((slug) => {
            const after = runSite(slug);
            const before = runSite(slug, loadPreFixRecommender());
            expect(JSON.stringify(after.monthly)).toBe(JSON.stringify(before.monthly));
        });
    });

    test('New test - location: the product set that changed, and by how much', () => {
        const after = runSite('new-test-location');
        const before = runSite('new-test-location', loadPreFixRecommender());
        const names = (p) => allApplications(p).map((x) => x.name).sort();
        // Two granular picks stop being bought: the P-free Country Club IV
        // 17-0-17 (November) and the strategic MAP Tech top-up (September).
        expect(names(before)).toContain('Country Club IV 17-0-17');
        expect(names(before)).toContain('MAP Tech');
        expect(names(after)).not.toContain('Country Club IV 17-0-17');
        expect(names(after)).not.toContain('MAP Tech');
        expect(names(after).filter((n) => n === 'Country Club IV 18-9-18').length).toBe(2);
    });

    test('New test - location: phosphorus now over-delivers, and this is recorded, not hidden', () => {
        // Reported to the user as a candidate second defect and NOT repaired
        // here: November's remaining annual P budget is a correct 1.7 kg, but
        // selectNitrogenSource scores its candidates on
        // `effectiveMonthlyP = pAtRate / monthsCovered` against that
        // annual-capped figure, so Country Club IV 18-9-18's 6.4 kg reads as a
        // 1.9x "moderate" overshoot (pScore 30) rather than a 3.8x one
        // (pScore -20), and outscores the phosphorus-free alternative.
        const after = runSite('new-test-location');
        expect(r1(after.delivered.P - after.targets.P)).toBe(4.7);
        expect(r1(after.balance.P)).toBe(4.7);
    });
});

// ---------------------------------------------------------------------------
// Source and region guards
// ---------------------------------------------------------------------------

describe('GH-400 guards', () => {
    test('the liquid application no longer hard-codes a zero for phosphorus', () => {
        expect(SOURCE).toContain(DECLARATION_LINE);
        expect(SOURCE).not.toMatch(/delivers:\s*\{\s*\n\s*N: liquidRec\.nDelivered,\s*\n[^}]*P: 0,/);
    });

    test('the annual accumulator takes the liquid phosphorus', () => {
        expect(SOURCE).toContain(ACCUMULATOR_LINE);
        // …and it sits with its N and K siblings, in the same branch, so a
        // future edit cannot move one without seeing the others.
        const block = SOURCE.slice(SOURCE.indexOf('delivered.N += liquidRec.nDelivered;'));
        expect(block.slice(0, block.indexOf('monthResult.liquid.push'))).toContain(ACCUMULATOR_LINE);
    });

    test('selectFoliarNitrogen lists pDelivered in the contract it declares', () => {
        // The field has to appear in the returned-shape list itself, not only
        // in prose further down the block — the missing contract line is what
        // let the zero live in the code unremarked for as long as it did.
        const doc = SOURCE.slice(0, SOURCE.indexOf('selectFoliarNitrogen: function('));
        const block = doc.slice(doc.lastIndexOf('/**'));
        expect(block).toMatch(/@returns[\s\S]*nDelivered, kDelivered, pDelivered/);
    });

    test('GH-400 is confined to the Australian recommender', () => {
        // No New Zealand or UK figure may move on this ticket.
        const assets = path.join(__dirname, '../assets');
        const touched = fs.readdirSync(assets)
            .filter((f) => f.endsWith('.js'))
            .filter((f) => fs.readFileSync(path.join(assets, f), 'utf8').includes('GH-400'));
        expect(touched).toEqual(['au-fertiliser-products.js']);
    });
});

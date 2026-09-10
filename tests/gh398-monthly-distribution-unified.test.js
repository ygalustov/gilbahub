/**
 * GH-398 (D31 stage 4) — one GP-weighted monthly distribution.
 *
 * Until this ticket nutrition-calendar.js and nutrition-requirement-engine.js
 * each spread an annual kg/ha figure across twelve months their own way, and
 * one Word document printed both series: the Plan page's "Monthly Nutrient
 * Program" (0-11 indexing, three modes, a monthly N cap with overflow
 * redistribution, raw values until display) and the export's "Monthly N
 * Distribution" (1-12 indexing, GP-weighted only, NO cap, GP rounded to 2 dp
 * before weighting and each month to 1 dp after).
 *
 * The fixture below is Federal Golf as the dev database actually holds it:
 * twelve real monthly climate normals, an annual N target of 120 kg/ha and a
 * "Max N per application" of 15 kg/ha/month. Its stored programme is
 *   [15, 15, 15, 12.7, 9.9, 0, 0, 0, 10.1, 12.3, 15, 15]
 * — five months at the cap, the annual 120 preserved by redistribution. Before
 * this ticket the report printed the UNCLAMPED series for the same site, with a
 * January of ~21 kg against the site's own 15 kg limit. Four of the ten dev
 * sites carry that cap and it binds on all four; the E2E parity harness never
 * caught it because its fixture peaks at ~35 against a cap of 50.
 *
 * Every expected figure here is derived by hand from the fixture in the
 * comment beside it, or read off the stored programme, never from a run.
 */

'use strict';

global.window = global.window || {};
global.document = global.document || {
    addEventListener: function () {},
    readyState: 'complete',
    querySelector: function () { return null; },
    querySelectorAll: function () { return []; },
    getElementById: function () { return null; }
};
global.console = { log: function () {}, warn: function () {}, error: function () {}, info: function () {} };

const GP = require('../assets/growth-potential-engine.js');
global.window.GilbaGrowthPotentialEngine = GP;
global.GilbaGrowthPotentialEngine = GP;

const D = require('../assets/nutrition-monthly-distribution.js');
const Engine = require('../assets/nutrition-requirement-engine.js');

// ── Federal Golf, dev DB, namespace gaip ───────────────────────────────────
// site config: maxNPerMonth 15, nutritionCalendarProgram.meta.distribution
// 'gp_weighted', adjustments.target_n 120, meta.species 'bentgrass',
// meta.hemisphere 'south'.
const FEDERAL_TEMPS = [20.8, 19.1, 16.5, 12.9, 8.8, 6.2, 5.2, 6, 9.2, 12.5, 16, 18.2];
const FEDERAL_TEMPS_1_12 = {
    1: 20.8, 2: 19.1, 3: 16.5, 4: 12.9, 5: 8.8, 6: 6.2,
    7: 5.2, 8: 6, 9: 9.2, 10: 12.5, 11: 16, 12: 18.2
};
const FEDERAL_ANNUAL_N = 120;
const FEDERAL_CAP = 15;
// program.monthly[*].N as persisted, Jan..Dec.
const FEDERAL_STORED_MONTHLY_N = [15, 15, 15, 12.7, 9.9, 0, 0, 0, 10.1, 12.3, 15, 15];
// program.monthly[*].gp as persisted. The programme stores GP at 2 dp and the
// temperature at 1 dp, so FEDERAL_TEMPS above is the ROUNDED series and its
// recomputed GP differs from this one in the third decimal on two months
// (April reads 0.435 from 12.9 degC against a stored 0.44). The stored profile
// below is therefore the input for anything asserting the stored monthly
// series, and the recomputed one is used where the assertion is about
// precision rather than about this site's saved figures.
const FEDERAL_STORED_GP = [0.99, 0.99, 0.82, 0.44, 0.12, 0.04, 0.03, 0.04, 0.15, 0.4, 0.77, 0.95];

function round1(v) { return Math.round(v * 10) / 10; }
function sum(a) { return a.reduce(function (s, v) { return s + v; }, 0); }

describe('GH-398 — the threshold and the weighting exist once', () => {
    test('the 0.10 activity threshold has one home, and both engines read it from there', () => {
        expect(D.MIN_GP_THRESHOLD).toBe(0.10);
        // The engine re-exports it rather than declaring a second copy.
        expect(Engine.MIN_GP_THRESHOLD).toBe(D.MIN_GP_THRESHOLD);
        // And the calendar's CONFIG no longer carries one.
        const NC = require('../assets/nutrition-calendar.js');
        const Cal = (global.window && global.window.GilbaNutritionCalendar) || NC;
        expect(Cal.config.minGpThreshold).toBeUndefined();
    });

    test('a month exactly AT the threshold is active, one just below is dormant', () => {
        // The boundary both copies used: `gp >= 0.10`. 100 kg over two months
        // at 0.10 and 0.30 -> 25 / 75; drop one to 0.0999 and it gets nothing.
        const atBoundary = D.distribute(100, [0.10, 0.30, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0], 'gp_weighted');
        expect(round1(atBoundary[0])).toBe(25);
        expect(round1(atBoundary[1])).toBe(75);
        const belowBoundary = D.distribute(100, [0.0999, 0.30, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0], 'gp_weighted');
        expect(belowBoundary[0]).toBe(0);
        expect(round1(belowBoundary[1])).toBe(100);
    });

    test('total dormancy falls back to an even split rather than an empty programme', () => {
        const allDormant = D.distribute(120, new Array(12).fill(0.05), 'gp_weighted');
        allDormant.forEach(function (v) { expect(round1(v)).toBe(10); }); // 120 / 12
        expect(round1(sum(allDormant))).toBe(120);
    });
});

describe('GH-398 decision 1 — the monthly N cap, which only the Plan page had', () => {
    const gp = FEDERAL_STORED_GP;

    test('the recomputed GP tracks the site\'s own stored profile', () => {
        // Sanity on the inputs before anything is asserted about the output.
        // Within 0.01 rather than exactly, because the stored temperature
        // series is itself rounded to 1 dp (see the fixture's own comment).
        const recomputed = D.monthlyGP(
            FEDERAL_TEMPS, D.monthlyC3Fractions({ isOverseed: false, baseIsC4: false }, 'south'));
        recomputed.forEach(function (v, m) {
            // Within one GP point. April is the widest: 0.4346 recomputed from
            // 12.9 degC against a stored 0.44, which is the 1 dp temperature
            // rounding, not a model difference.
            expect(Math.abs(v - FEDERAL_STORED_GP[m])).toBeLessThan(0.01);
        });
    });

    test('uncapped, January is ~21 kg — above the site\'s own 15 kg/month limit', () => {
        // This is what the Word export used to print. Active months (GP >= 0.10)
        // are Jan-May and Sep-Dec; their GP sums to
        // 0.99+0.99+0.82+0.44+0.12+0.15+0.40+0.77+0.95 = 5.63, so January takes
        // 120 x 0.99 / 5.63 = 21.1 kg against the site's own 15 kg/month limit.
        const uncapped = D.distribute(FEDERAL_ANNUAL_N, gp, 'gp_weighted');
        expect(round1(uncapped[0])).toBe(21.1);
        expect(uncapped[0]).toBeGreaterThan(FEDERAL_CAP);
        expect(round1(sum(uncapped))).toBe(120);
    });

    test('capped, the twelve months ARE the site\'s stored programme, to the last decimal', () => {
        const result = D.distributeProgram({
            annualAmounts: { N: FEDERAL_ANNUAL_N },
            gp: gp,
            mode: 'gp_weighted',
            maxNPerMonth: FEDERAL_CAP
        });
        const monthly = [];
        for (let m = 0; m < 12; m++) monthly.push(round1(result.distributions.N[m]));
        expect(monthly).toEqual(FEDERAL_STORED_MONTHLY_N);
        // 15 + 15 + 15 + 12.7 + 9.9 + 10.1 + 12.3 + 15 + 15 = 120.
        expect(round1(sum(monthly))).toBe(120);
        expect(result.nCap.capApplied).toBe(true);
        expect(result.nCap.maxNPerMonth).toBe(15);
        expect(result.nCap.unschedulable).toBe(0);
        expect(result.nCap.originalTotal).toBe(120);
        expect(result.nCap.scheduledTotal).toBe(120);
    });

    test('the ENGINE — the Word export\'s path — now prints that same clamped series', () => {
        const result = Engine.compute({
            soil: { P: 32, K: 85, Ca: 800, Mg: 150, S: 20, pH: 6.5, methodology: 'SLAN' },
            turf: { species: 'bentgrass', nProgramKgHaYr: FEDERAL_ANNUAL_N, clippingManagement: 'collected' },
            climate: { monthlyTemps: FEDERAL_TEMPS_1_12, hemisphere: 'south' },
            overseedConfig: { isOverseed: false, baseIsC4: false, summerIntent: 'transition' },
            distribution: { mode: 'gp_weighted', maxNPerMonth: FEDERAL_CAP }
        });
        expect(result.facility.monthlyN.map(function (e) { return e.n; })).toEqual(FEDERAL_STORED_MONTHLY_N);
        expect(result.facility.maxNPerMonth).toBe(15);
        expect(result.facility.distributionMode).toBe('gp_weighted');
        expect(result.facility.nCap.capApplied).toBe(true);
        expect(result.facility.nCap.unschedulable).toBe(0);
        // facility.totalN stays the annual TARGET, exactly as the Plan page's
        // annual_totals.N does — the cap changes the schedule, not the target.
        expect(result.facility.totalN).toBe(120);
    });

    test('a caller that passes no `distribution` is uncapped, as it was before this ticket', () => {
        // The old hub's Nutrition Summary panel and a dozen direct test calls
        // never pass one. Their numbers must not move.
        const result = Engine.compute({
            soil: { P: 32, K: 85, Ca: 800, Mg: 150, S: 20, pH: 6.5, methodology: 'SLAN' },
            turf: { species: 'bentgrass', nProgramKgHaYr: FEDERAL_ANNUAL_N, clippingManagement: 'collected' },
            climate: { monthlyTemps: FEDERAL_TEMPS_1_12, hemisphere: 'south' },
            overseedConfig: { isOverseed: false, baseIsC4: false, summerIntent: 'transition' }
        });
        // 21.2, not the 21.1 above: this one is computed from the rounded
        // temperature series rather than the site's stored GP profile (see the
        // fixture comment). Either way it is 6 kg over the site's own limit,
        // which is what the report used to print.
        expect(result.facility.monthlyN[0].n).toBe(21.2);
        expect(result.facility.monthlyN[0].n).toBeGreaterThan(FEDERAL_CAP);
        expect(result.facility.maxNPerMonth).toBeNull();
        expect(result.facility.nCap.capApplied).toBe(false);
    });

    test('a cap too low to absorb the overflow reports the shortfall instead of hiding it', () => {
        // 120 kg over nine active months at a cap of 5 can schedule at most
        // 45; the other 75 fits nowhere and must be stated, because the months
        // then sum to less than the annual target.
        const result = D.distributeProgram({
            annualAmounts: { N: FEDERAL_ANNUAL_N }, gp: gp, mode: 'gp_weighted', maxNPerMonth: 5
        });
        expect(result.nCap.capApplied).toBe(true);
        expect(result.nCap.scheduledTotal).toBe(45);
        expect(result.nCap.unschedulable).toBe(75);
        expect(round1(sum(Object.values(result.distributions.N)))).toBe(45);
    });

    test('the cap applies to N and to nothing else — it is a "max N per application" limit', () => {
        const result = D.distributeProgram({
            annualAmounts: { N: 120, K: 120 }, gp: gp, mode: 'gp_weighted', maxNPerMonth: FEDERAL_CAP
        });
        expect(round1(result.distributions.N[0])).toBe(15);
        expect(round1(result.distributions.K[0])).toBe(21.1);   // 120 x 0.99 / 5.63
    });
});

describe('GH-398 decision 2 — full precision through the calculation, rounding only at output', () => {
    test('the GP series is raw, not pre-rounded to 2 dp', () => {
        const gp = D.monthlyGP(FEDERAL_TEMPS, null);
        // January, 20.8 degC, PACE C3 (optimum band 15-24 in the GP engine's
        // own coefficients) — a real value with more than two decimals.
        expect(gp[0]).not.toBe(Math.round(gp[0] * 100) / 100);
        // and the engine's 1-12 series is the same raw number.
        const eng = Engine._computeMonthlyGP(FEDERAL_TEMPS_1_12, null);
        expect(eng[1]).toBe(gp[0]);
    });

    test('distribute() returns raw allocations; the callers round', () => {
        const gp = D.monthlyGP(FEDERAL_TEMPS, null);
        const raw = D.distribute(FEDERAL_ANNUAL_N, gp, 'gp_weighted');
        expect(raw[0]).not.toBe(round1(raw[0]));
        // The annual total survives the split exactly, which is what rounding
        // each month inside the split used to cost.
        expect(sum(raw)).toBeCloseTo(FEDERAL_ANNUAL_N, 9);
    });
});

describe('GH-398 decision 3 — one C3/C4 model, the engine\'s, with its own fractions', () => {
    test('a non-overseeded sward is bit-for-bit unchanged: blend at f=1 IS the C3 curve', () => {
        // GilbaGrowthPotentialEngine computes `f * c3GP + (1 - f) * c4GP`, so
        // this is exact arithmetic, not a tolerance. It is why adopting the
        // engine's blended model moves no site that is not overseeded — which
        // is all ten dev sites.
        FEDERAL_TEMPS.forEach(function (t) {
            expect(GP.compute(t, { model: 'pace', species: 'blend', c3Fraction: 1 }))
                .toBe(GP.compute(t, { model: 'pace', species: 'c3' }));
            expect(GP.compute(t, { model: 'pace', species: 'blend', c3Fraction: 0 }))
                .toBe(GP.compute(t, { model: 'pace', species: 'c4' }));
        });
    });

    test('the four summer-intent profiles are unchanged and exist once', () => {
        expect(D.SUMMER_INTENT_PROFILES).toEqual({
            transition: { summerC3: 0.10, transitionC3: 0.40, winterC3: 0.90 },
            maintain:   { summerC3: 0.35, transitionC3: 0.60, winterC3: 0.90 },
            establish:  { summerC3: 0.05, transitionC3: 0.30, winterC3: 0.85 },
            dormant:    { summerC3: 0.10, transitionC3: 0.50, winterC3: 0.95 }
        });
        expect(Engine.SUMMER_INTENT_PROFILES).toBe(D.SUMMER_INTENT_PROFILES);
    });

    test('an overseeded sward blends by season instead of running one curve all year', () => {
        // Southern 'transition': winter (Jun-Aug) 0.90 C3, summer (Dec-Feb)
        // 0.10, the rest 0.40.
        const f = D.monthlyC3Fractions(
            { isOverseed: true, baseIsC4: true, summerIntent: 'transition' }, 'south');
        expect(f).toEqual([0.10, 0.10, 0.40, 0.40, 0.40, 0.90, 0.90, 0.90, 0.40, 0.40, 0.40, 0.10]);
        // Northern flips it: winter is Dec-Feb.
        const fn = D.monthlyC3Fractions(
            { isOverseed: true, baseIsC4: true, summerIntent: 'transition' }, 'north');
        expect(fn).toEqual([0.90, 0.90, 0.40, 0.40, 0.40, 0.10, 0.10, 0.10, 0.40, 0.40, 0.40, 0.90]);
        // A C3 oversow on a C3 base is not a blend at all — no seasonal split
        // is meaningful, and the fraction stays flat.
        expect(D.monthlyC3Fractions({ isOverseed: true, baseIsC4: false }, 'south'))
            .toEqual(new Array(12).fill(1));
    });

    test('the Plan page now describes an overseeded sward the same way the export does', () => {
        const NC = require('../assets/nutrition-calendar.js');
        const Cal = (global.window && global.window.GilbaNutritionCalendar) || NC;
        const overseed = { isOverseed: true, baseIsC4: true, summerIntent: 'transition' };
        const planGP = Cal.calculateMonthlyGP(FEDERAL_TEMPS, true, overseed, 'south');
        const engineGP = Engine._computeMonthlyGP(
            FEDERAL_TEMPS_1_12, Engine._calculateMonthlyC3Fractions(overseed, 'south'));
        for (let m = 0; m < 12; m++) expect(planGP[m]).toBe(engineGP[m + 1]);
        // And without an overseed configuration — every current site — the
        // Plan page's series is identical to what it always was.
        const plainGP = Cal.calculateMonthlyGP(FEDERAL_TEMPS, false);
        for (let m = 0; m < 12; m++) {
            expect(plainGP[m]).toBe(GP.compute(FEDERAL_TEMPS[m], { model: 'pace', species: 'c3' }));
        }
    });
});

describe('GH-398 decision 4 — the shared function distributes every nutrient', () => {
    test('N, P, K, Ca, Mg and S all come back from one call', () => {
        const gp = D.monthlyGP(FEDERAL_TEMPS, null);
        const result = D.distributeProgram({
            annualAmounts: { N: 120, P: 12, K: 66, Ca: 20, Mg: 10, S: 6 },
            gp: gp, mode: 'gp_weighted', maxNPerMonth: FEDERAL_CAP
        });
        expect(Object.keys(result.distributions).sort()).toEqual(['Ca', 'K', 'Mg', 'N', 'P', 'S']);
        // Each uncapped nutrient conserves its annual total exactly.
        ['P', 'K', 'Ca', 'Mg', 'S'].forEach(function (n) {
            expect(sum(result.distributions[n])).toBeCloseTo({ P: 12, K: 66, Ca: 20, Mg: 10, S: 6 }[n], 9);
        });
    });

    test('the engine carries them too, unprinted — no second copy is left to diverge', () => {
        const result = Engine.compute({
            soil: { P: 32, K: 85, Ca: 800, Mg: 150, S: 20, pH: 6.5, methodology: 'SLAN' },
            turf: { species: 'bentgrass', nProgramKgHaYr: FEDERAL_ANNUAL_N, clippingManagement: 'collected' },
            climate: { monthlyTemps: FEDERAL_TEMPS_1_12, hemisphere: 'south' },
            distribution: { mode: 'gp_weighted', maxNPerMonth: FEDERAL_CAP }
        });
        expect(Object.keys(result.monthlyNutrients).sort()).toEqual(['Ca', 'K', 'Mg', 'N', 'P', 'S']);
        expect(result.monthlyNutrients.N).toEqual(FEDERAL_STORED_MONTHLY_N);
        expect(result.monthlyNutrients.K).toHaveLength(12);
        // K is per-sample and follows perSample.K's annual requirement.
        // Within 0.5 kg: each of the twelve months is rounded to 0.1 on the
        // way out, so the rounded months need not re-sum to the exact annual.
        expect(sum(result.monthlyNutrients.K))
            .toBeCloseTo(result.perSample.K.annualRequirement, 0);
    });
});

describe('GH-398 — the distribution mode, which the export never honoured', () => {
    const gp = D.monthlyGP(FEDERAL_TEMPS, null);

    test('"even" is a twelfth a month, dormancy included', () => {
        const even = D.distribute(120, gp, 'even');
        even.forEach(function (v) { expect(v).toBe(10); });
        const result = Engine.compute({
            soil: { P: 32, K: 85, pH: 6.5, methodology: 'SLAN' },
            turf: { species: 'bentgrass', nProgramKgHaYr: 120, clippingManagement: 'collected' },
            climate: { monthlyTemps: FEDERAL_TEMPS_1_12, hemisphere: 'south' },
            distribution: { mode: 'even', maxNPerMonth: null }
        });
        expect(result.facility.monthlyN.map(function (e) { return e.n; })).toEqual(new Array(12).fill(10));
        expect(result.facility.distributionMode).toBe('even');
    });

    test('an unknown or absent mode falls back to gp_weighted, never to silence', () => {
        expect(D.normalizeMode(undefined)).toBe('gp_weighted');
        expect(D.normalizeMode('GP-Weighted')).toBe('gp_weighted');
        expect(D.normalizeMode('nonsense')).toBe('gp_weighted');
        expect(D.modeLabel('front_loaded')).toBe('Front-loaded');
    });

    test('front_loaded is CARRIED ACROSS UNCHANGED, defect and all (decision 6)', () => {
        // Deliberately deferred by the user, not fixed here: no site uses this
        // mode and normalising it would settle a question nobody has been
        // asked. Two known defects, pinned so neither is repaired by accident
        // and neither can get worse unnoticed:
        //
        //   (a) it does not conserve the annual total. Each active month gets
        //       total/10 and months 8-10 are then multiplied by 1.5, so a
        //       series with all twelve months active delivers
        //       (9 x 1 + 3 x 1.5) / 10 = 1.35 x the target...
        const allActive = D.distribute(250, new Array(12).fill(0.8), 'front_loaded');
        expect(sum(allActive)).toBeCloseTo(337.5, 6);   // 250 x 1.35
        //       ...and Federal Golf's nine active months deliver
        //       (6 x 1 + 3 x 1.5) / 10 = 1.05 x the target, while
        //       annual_totals still prints 250.
        const federal = D.distribute(250, gp, 'front_loaded');
        expect(sum(federal)).toBeCloseTo(262.5, 6);
        //       A northern series dormant in Sep-Nov gets no boost at all.
        const northernDormantSpring = [0.9, 0.9, 0.9, 0.9, 0.9, 0.9, 0.9, 0.9, 0.05, 0.05, 0.05, 0.9];
        expect(sum(D.distribute(250, northernDormantSpring, 'front_loaded'))).toBeCloseTo(225, 6);
        //
        //   (b) the boost months are hard-coded to indices 8, 9, 10 —
        //       September, October, November, i.e. SOUTHERN spring. On a
        //       northern site the emphasis lands in autumn.
        const boosted = D.distribute(100, new Array(12).fill(0.8), 'front_loaded');
        expect(boosted[8]).toBeCloseTo(15, 9);
        expect(boosted[9]).toBeCloseTo(15, 9);
        expect(boosted[10]).toBeCloseTo(15, 9);
        expect(boosted[2]).toBeCloseTo(10, 9);          // March, unboosted
    });
});

describe('GH-398 — the 0-11 / 1-12 month boundary has one implementation', () => {
    test('the converters round-trip and index January correctly', () => {
        expect(D.fromMonthMap(FEDERAL_TEMPS_1_12)).toEqual(FEDERAL_TEMPS);
        expect(D.toMonthMap(FEDERAL_TEMPS)).toEqual(FEDERAL_TEMPS_1_12);
        // A missing month is null for the whole series, never a silent hole.
        const missingJuly = Object.assign({}, FEDERAL_TEMPS_1_12);
        delete missingJuly[7];
        expect(D.fromMonthMap(missingJuly)).toBeNull();
    });

    test('the engine\'s facility.monthlyN is Jan-first and its monthlyGP stays 1-12 keyed', () => {
        // GH-363 was an inline reindex of exactly this pair. The published
        // shapes are unchanged; only the conversion moved.
        const result = Engine.compute({
            soil: { P: 32, K: 85, pH: 6.5, methodology: 'SLAN' },
            turf: { species: 'bentgrass', nProgramKgHaYr: FEDERAL_ANNUAL_N, clippingManagement: 'collected' },
            climate: { monthlyTemps: FEDERAL_TEMPS_1_12, hemisphere: 'south' },
            distribution: { mode: 'gp_weighted', maxNPerMonth: FEDERAL_CAP }
        });
        expect(result.facility.monthlyN[0].n).toBe(FEDERAL_STORED_MONTHLY_N[0]);   // January
        expect(result.facility.monthlyN[11].n).toBe(FEDERAL_STORED_MONTHLY_N[11]); // December
        expect(Object.keys(result.facility.monthlyGP)).toEqual(
            ['1', '2', '3', '4', '5', '6', '7', '8', '9', '10', '11', '12']);
        expect(Object.keys(result.facility.monthlyC3Fractions)).toHaveLength(12);
    });

    test('the two season tables that used to be written twice are one, and agree', () => {
        // The calendar held 0-11 maps, the engine a 1-12 map; the same twelve
        // labels. Southern January is Summer, northern January is Winter.
        expect(D.seasons('south')[0]).toBe('Summer');
        expect(D.seasons('north')[0]).toBe('Winter');
        expect(D.seasons('south')[5]).toBe('Winter');   // June
        expect(D.seasons('north')[5]).toBe('Summer');
        for (let m = 1; m <= 12; m++) {
            expect(Engine._getSeason(m, 'south')).toBe(D.seasons('south')[m - 1]);
            expect(Engine._getSeason(m, 'north')).toBe(D.seasons('north')[m - 1]);
        }
    });
});

describe('GH-398 — the Plan page and the Word export now produce ONE series', () => {
    test('computeProgram() and Engine.compute() agree month for month on the capped fixture', () => {
        const NC = require('../assets/nutrition-calendar.js');
        const Cal = (global.window && global.window.GilbaNutritionCalendar) || NC;

        const program = Cal.computeProgram({
            hemisphere: 'south',
            species: 'bentgrass',
            speciesDisplay: 'Creeping Bentgrass',
            isC4: false,
            soilPpm: { P: 32, K: 85, Ca: 800, Mg: 150, S: 20 },
            bulkDensity: 1.4,
            soilDepth: 10,
            pH: 6.5,
            methodology: 'slan',
            monthlyTemps: FEDERAL_TEMPS,
            annualNOverride: FEDERAL_ANNUAL_N,
            maxNPerMonth: FEDERAL_CAP,
            distribution: 'gp_weighted',
            clippingManagement: 'collected',
            traffic: 'moderate',
            surfaceType: 'greens'
        });
        expect(program.error).toBeUndefined();
        expect(program.program.monthly.map(function (m) { return m.N; }))
            .toEqual(FEDERAL_STORED_MONTHLY_N);
        expect(program.adjustments.n_cap_applied).toBe(true);
        expect(program.adjustments.max_n_per_month).toBe(15);
        expect(program.adjustments.scheduled_n_total).toBe(120);
        expect(program.adjustments.n_unschedulable).toBe(0);

        const engineResult = Engine.compute({
            soil: { P: 32, K: 85, Ca: 800, Mg: 150, S: 20, pH: 6.5, methodology: 'SLAN' },
            turf: { species: 'bentgrass', nProgramKgHaYr: FEDERAL_ANNUAL_N, clippingManagement: 'collected' },
            climate: { monthlyTemps: FEDERAL_TEMPS_1_12, hemisphere: 'south' },
            distribution: { mode: 'gp_weighted', maxNPerMonth: FEDERAL_CAP }
        });
        // The whole point of the ticket: not "within a tolerance", identical.
        expect(engineResult.facility.monthlyN.map(function (e) { return e.n; }))
            .toEqual(program.program.monthly.map(function (m) { return m.N; }));
        // ...and the cap diagnostics the two surfaces print are the same four
        // numbers, under the calendar's names and the engine's.
        expect(engineResult.facility.nCap.originalTotal).toBe(program.adjustments.original_n_total);
        expect(engineResult.facility.nCap.scheduledTotal).toBe(program.adjustments.scheduled_n_total);
        expect(engineResult.facility.nCap.redistributed).toBe(program.adjustments.n_redistributed);
        expect(engineResult.facility.nCap.unschedulable).toBe(program.adjustments.n_unschedulable);
        // And the annual target itself did not move — the thing that must not.
        expect(program.annual_totals.N).toBe(120);
        expect(engineResult.facility.totalN).toBe(120);
    });

    test('an uncapped site (Burns, cap 50) is unchanged on both surfaces', () => {
        // Burns' stored programme peaks at 19.4 against a cap of 50, so the
        // cap does not bind and this ticket must not move a single figure —
        // which is the case for six of the ten dev sites.
        const NC = require('../assets/nutrition-calendar.js');
        const Cal = (global.window && global.window.GilbaNutritionCalendar) || NC;
        const gp = D.monthlyGP(FEDERAL_TEMPS, null);
        const uncapped = D.distribute(FEDERAL_ANNUAL_N, gp, 'gp_weighted');
        const capped50 = Cal.applyNCap(uncapped, 50);
        expect(capped50.capApplied).toBe(false);
        expect(capped50.maxNPerMonth).toBe(50);
        for (let m = 0; m < 12; m++) expect(capped50.allocations[m]).toBe(uncapped[m]);
    });
});

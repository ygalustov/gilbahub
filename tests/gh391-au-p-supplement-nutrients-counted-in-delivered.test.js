/**
 * GH-391 — au-fertiliser-products.js: the strategic P application's N and K
 * were pushed into the monthly programme but never added to the annual
 * `delivered` accumulator.
 *
 * Symptom, reproduced live on Burns "12th Fairway" (fairways, MLSN, annual N
 * target 120): the Annual Product Summary's product rows read 113 + 7 + 5 =
 * 125 kg N/ha while its "Total Delivered" row read 120. The 5 kg row is MAP
 * Tech (VAR-MAPTECH, 12-27-0), pushed by the P SUPPLEMENTATION block. That
 * block did `delivered.P += pProduct.pDelivered` only, while the application
 * it pushed onto the month declared `delivers: { N, P, K }` in full — so the
 * product table (built from the monthly applications) counted MAP's N and the
 * total (built from `delivered`) did not.
 *
 * The 120 is NOT the site's annual N target, even though Burns' target is also
 * 120 — `nutrition-au-fertiliser-integration.js` prints the target in its own
 * separate "Required (kg/ha)" row and prints `program.delivered` here. See the
 * `delivered` vs `targets` assertions below, which hold them apart explicitly.
 *
 * The invariant asserted here is the one the two surfaces both depend on: the
 * annual `delivered` vector must be exactly the sum of what the monthly
 * applications say they deliver. Both the Plan page's Annual Product Summary
 * and the Word export's build their rows from the monthly applications, so any
 * nutrient that reaches an application without reaching `delivered` prints as
 * a row that the total does not contain.
 */

'use strict';

const fs = require('fs');
const path = require('path');
const vm = require('vm');

function loadRecommender() {
    const src = fs.readFileSync(path.join(__dirname, '../assets/au-fertiliser-products.js'), 'utf8');
    const noop = () => {};
    const sandbox = {
        window: {},
        console: { log: noop, warn: noop, error: noop, info: noop },
    };
    vm.runInNewContext(src, sandbox, { filename: 'au-fertiliser-products.js' });
    return sandbox.window.AuFertiliserRecommender;
}

/**
 * Burns-shaped monthly data: southern hemisphere fairways, annual N 120 spread
 * over a GP curve, annual P 14 (the fixture's real Required P — 12 removal +
 * 2.1 lift to the MLSN minimum), K suppressed to 0 (soil K 195 sits above the
 * ceiling on that site). P > 5 is what arms the strategic P application.
 */
function burnsShapedMonthlyData() {
    const gp = [0.95, 0.90, 0.75, 0.50, 0.30, 0.15, 0.10, 0.20, 0.45, 0.70, 0.88, 0.95];
    const names = ['January', 'February', 'March', 'April', 'May', 'June',
                   'July', 'August', 'September', 'October', 'November', 'December'];
    const seasons = ['summer', 'summer', 'autumn', 'autumn', 'autumn', 'winter',
                     'winter', 'winter', 'spring', 'spring', 'spring', 'summer'];
    const gpSum = gp.reduce((a, b) => a + b, 0);
    return gp.map((g, i) => ({
        month_name: names[i],
        month_num: i + 1,
        season: seasons[i],
        gp: g,
        N: 120 * (g / gpSum),
        P: 14 * (g / gpSum),
        K: 0,
    }));
}

function runBurnsProgram() {
    const rec = loadRecommender();
    return rec.generateAnnualProgram(burnsShapedMonthlyData(), {
        surfaceType: 'fairways',
        stateFilter: 'all',
        distributorFilter: 'all',
        methodology: 'mlsn',
        hemisphere: 'south',
    });
}

/** Sum of every `delivers` vector across every monthly application. */
function sumOfApplications(program) {
    const total = { N: 0, P: 0, K: 0 };
    (program.monthly || []).forEach((m) => {
        [].concat(m.granular || [], m.liquid || []).forEach((app) => {
            const d = app.delivers || {};
            total.N += d.N || 0;
            total.P += d.P || 0;
            total.K += d.K || 0;
        });
    });
    return total;
}

describe('GH-391 — AU recommender: annual `delivered` is a true partition of the monthly applications', () => {
    let program;
    beforeAll(() => { program = runBurnsProgram(); });

    test('the programme is generated and the strategic P application is present', () => {
        expect(program).toBeTruthy();
        expect(program.monthly).toHaveLength(12);
        const pApps = [];
        program.monthly.forEach((m) => {
            [].concat(m.granular || [], m.liquid || []).forEach((app) => {
                if (/Strategic P application/.test(app.notes || '')) pApps.push(app);
            });
        });
        expect(pApps.length).toBeGreaterThan(0);
        // The P source this catalogue picks is MAP (12-27-0 or the 12-22-0
        // soluble) — a real N carrier, which is why its N must be counted.
        expect(pApps.some((a) => (a.delivers || {}).N > 0)).toBe(true);
    });

    test('delivered.N equals the N of every application the programme pushed', () => {
        const sum = sumOfApplications(program);
        expect(program.delivered.N).toBeCloseTo(sum.N, 6);
    });

    test('delivered.P equals the P of every application the programme pushed', () => {
        const sum = sumOfApplications(program);
        expect(program.delivered.P).toBeCloseTo(sum.P, 6);
    });

    test('delivered.K equals the K of every application the programme pushed', () => {
        const sum = sumOfApplications(program);
        expect(program.delivered.K).toBeCloseTo(sum.K, 6);
    });

    test('`delivered` and `targets` are distinct objects — the total is a sum, not the annual target', () => {
        // Burns' annual N target is 120 and its delivered N lands near it by
        // design (the recommender aims at the target), which is exactly why
        // the defect was easy to misread as "the total is the target". They
        // are separate fields with separate provenance; `targets` is the sum
        // of the monthly requirements handed in, `delivered` is accumulated.
        expect(program.targets).not.toBe(program.delivered);
        expect(program.targets.N).toBeCloseTo(120, 6);
        expect(program.balance.N)
            .toBeCloseTo(Math.round((program.delivered.N - program.targets.N) * 10) / 10, 6);
    });
});

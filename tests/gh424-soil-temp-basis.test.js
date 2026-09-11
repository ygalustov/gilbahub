/**
 * GH-424 — what basis New Zealand product selection stands on, measured.
 *
 * THE QUESTION. The monthly distribution runs on multi-year climate normals
 * (climate-normals-service.js: NASA POWER climatology, 20-year 2001-2020
 * MERRA-2, per site coordinates; Open-Meteo historical archive as tier 2;
 * null as tier 3). Product selection runs on `context.soilTemp`, which resolves
 * to `climateMetrics.temperature.mean` — the mean of the LIVE HOURLY FORECAST
 * WINDOW (hub-orchestrator.js, "Temperature pinned to rawWeatherData (full
 * forecast window)"). Two bases in one product. This file measures what that
 * costs, and what option 3 — putting product selection on the same normals as
 * growth potential — would change.
 *
 * WHAT CHANGED UNDER IT. GH-427 took the decision this file measured: the
 * per-month temperature now comes from the site's own monthly normals, and
 * `estimateMonthlySoilTemp()` — the function whose behaviour the first half of
 * this file used to measure directly — is DELETED. Those measurements are not
 * lost: the curves it produced are recorded in the fixture under
 * `observed.beforeGH427`, and the tests below now assert against that record
 * and against the new behaviour, which is the direction that has regression
 * value. A test that could only run against the old code would have had to go
 * with it.
 *
 * THE FIXTURE is the exact object the recommender was handed on the Plan page
 * for Test5 - NZ / Soccer, captured live (tests/fixtures/gh424-test5-recommender-
 * inputs.json). Auckland, -36.85, whose NASA monthly normals are
 * 19.8 20.4 19.1 17.0 14.7 12.6 11.4 11.8 12.9 14.2 16.0 18.2.
 */

'use strict';

const fs = require('fs');
const path = require('path');

global.window = global.window || {};
global.document = global.document || {
    readyState: 'complete',
    addEventListener: function () {},
    getElementById: function () { return null; },
    createElement: function () { return { style: {}, setAttribute: function () {}, appendChild: function () {} }; },
    head: { appendChild: function () {} },
    querySelector: function () { return null; },
    querySelectorAll: function () { return []; },
};

const _realConsole = global.console;
global.console = { log: function () {}, warn: function () {}, error: function () {}, info: function () {} };
require('../assets/prebbles-products.js');
global.console = _realConsole;

const R = global.window.PrebbleRecommender;
const P = global.window.PrebbleProducts;

const FX = JSON.parse(fs.readFileSync(
    path.join(__dirname, 'fixtures/gh424-test5-recommender-inputs.json'), 'utf8'));

const NORMALS = FX.inputs.monthly.map((m) => m.temp);
const MONTHS = FX.inputs.monthly.map((m) => m.month_name);

function calendar() {
    return {
        program: { monthly: JSON.parse(JSON.stringify(FX.inputs.monthly)) },
        meta: { hemisphere: FX.inputs.calendarMeta.hemisphere, latitude: FX.inputs.calendarMeta.latitude },
        soil: { methodology: FX.inputs.calendarMeta.methodology, CEC: FX.inputs.calendarMeta.CEC },
    };
}
function contextAt(soilTemp) {
    return Object.assign({}, FX.inputs.context, { soilTemp: soilTemp });
}
/** The recommender logs a candidate score per product per month; muted. */
function run(cal, ctx) {
    const real = global.console;
    global.console = { log: function () {}, warn: function () {}, error: function () {}, info: function () {} };
    try { return R.generateProgram(cal, ctx); } finally { global.console = real; }
}
/** The product set a run produces, as a comparable string. */
function productSet(program) {
    return Object.keys(program.annualSummary.products).map((id) => {
        const e = program.annualSummary.products[id];
        return e.name + ' x' + (e.applications || 0) + ' ' + Math.round(e.totalKg || 0);
    }).sort().join(' | ');
}
function delivered(program) {
    const t = { N: 0, P: 0, K: 0 };
    Object.keys(program.annualSummary.products).forEach((id) => {
        const n = program.annualSummary.products[id].nutrients;
        t.N += n.N || 0; t.P += n.P || 0; t.K += n.K || 0;
    });
    return { N: +t.N.toFixed(1), P: +t.P.toFixed(1), K: +t.K.toFixed(1) };
}

describe('GH-424 — the pool the fixture was recorded against is still the pool', () => {
    test('the catalogue has not moved under the fixture', () => {
        // Every number below is only meaningful against the recorded pool.
        expect((P.granular || []).length).toBe(FX.inputs.poolGranularIds.length);
        expect((P.liquid || []).length).toBe(FX.inputs.poolLiquidIds.length);
    });
});

describe('GH-424 — what the deleted curve was, as recorded before it went', () => {
    const B4 = FX.observed.beforeGH427;

    test('the recorded curve is wrong-shaped, not merely offset', () => {
        // The defect that made it so: nutrition-calendar.js writes
        // `month_num: m` for m = 0..11, and estimateMonthlySoilTemp()'s pattern
        // objects were keyed 1..12. January read pattern[0] — undefined, `|| 0`
        // — so it got the anchor itself with no summer deviation, and every
        // other month got the PREVIOUS month's.
        expect(FX.inputs.monthly.map((m) => m.month_num)).toEqual([0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11]);
        // January == the anchor exactly, in both recorded curves.
        expect(B4.curveAtAnchor12_8[0]).toBe(12.8);
        expect(B4.curveAtAnchor13[0]).toBe(13);
        // And February, not January, carried the summer peak.
        expect(B4.curveIfGeneratedInJanuary[1]).toBeGreaterThan(B4.curveIfGeneratedInJanuary[0]);
    });

    test('against the site\'s own normals it was out by up to 7 degC', () => {
        const rows = NORMALS.map((normal, i) => ({
            month: MONTHS[i], normal: normal, modelled: B4.curveAtAnchor12_8[i],
            error: +(B4.curveAtAnchor12_8[i] - normal).toFixed(1)
        }));
        rows.forEach((r) => process.stdout.write('[gh424] ' + r.month.padEnd(4)
            + ' normal ' + String(r.normal).padStart(5)
            + '   was ' + String(r.modelled).padStart(5)
            + '   error ' + String(r.error).padStart(6) + '\n'));
        const worst = rows.reduce((a, b) => (Math.abs(b.error) > Math.abs(a.error) ? b : a));
        process.stdout.write('[gh424] largest error: ' + worst.month + ' ' + worst.error + ' degC\n');
        expect(worst.month).toBe('Jan');
        expect(Math.abs(worst.error)).toBeGreaterThan(5);
    });

    test('the curve moved bodily with the month of generation — 8.4 degC', () => {
        const spread = B4.curveIfGeneratedInJanuary.map((v, i) => +(v - B4.curveIfGeneratedInJuly[i]).toFixed(1));
        process.stdout.write('[gh424] January-minus-July, per month ' + JSON.stringify(spread) + '\n');
        expect(Array.from(new Set(spread)).length).toBe(1);
        expect(spread[0]).toBeCloseTo(NORMALS[0] - NORMALS[6], 1);
    });

    test('the function that produced all of the above is gone', () => {
        // The point of GH-427's deletion: an unreachable known-wrong function
        // is how it gets called again.
        expect(R.estimateMonthlySoilTemp).toBeUndefined();
        const src = fs.readFileSync(path.join(__dirname, '../assets/prebbles-products.js'), 'utf8');
        // Named only in the comment explaining what replaced it.
        expect(src.split('estimateMonthlySoilTemp').length - 1).toBe(1);
        expect(src).not.toMatch(/estimateMonthlySoilTemp:\s*function/);
    });
});

describe('GH-424 — the live anchor no longer reaches product selection', () => {
    const B4 = FX.observed.beforeGH427;

    test('sweeping the forecast mean 8.0-20.0 degC in tenths now gives ONE programme', () => {
        // BEFORE GH-427 this sweep produced four distinct product sets, with
        // boundaries at 8.65 / 10.05 / 12.85 degC and band widths 0.7, 1.4, 2.8
        // and 7.2 — recorded in the fixture. The live reading sat a tenth of a
        // degree from a boundary. This is the assertion that says that whole
        // failure mode is gone, and it is the one that would go red if anything
        // reintroduced a dependence on `context.soilTemp`.
        process.stdout.write('[gh424] before GH-427: boundaries at '
            + JSON.stringify(B4.productSetBandBoundariesDegC) + ', four product sets\n');
        const seen = new Set();
        for (let t = 80; t <= 200; t++) seen.add(productSet(run(calendar(), contextAt(t / 10))));
        process.stdout.write('[gh424] after  GH-427: distinct product sets across 8.0-20.0 degC: '
            + seen.size + '\n');
        expect(seen.size).toBe(1);
    });

    test('one week of this site\'s own forecast is now one programme, not two', () => {
        const days = FX.observed.forecastDayMeans.aucklandTest5;
        const distinct = new Set(days.map((t) => JSON.stringify(delivered(run(calendar(), contextAt(t))))));
        process.stdout.write('[gh424] day means ' + JSON.stringify(days)
            + ' -> ' + distinct.size + ' programme(s); before GH-427 it was '
            + B4.distinctProgrammesOverOneWeekOfForecast + '\n');
        expect(B4.distinctProgrammesOverOneWeekOfForecast).toBe(2);
        expect(distinct.size).toBe(1);
    });

    test('the two real readings a day apart, 13.0 and 12.8, now agree', () => {
        // The GH-423 divergence, at its root: these two landed in different
        // bands, which is why the Plan and the document printed different
        // programmes for one sample.
        const a = run(calendar(), contextAt(13));
        const b = run(calendar(), contextAt(12.8));
        process.stdout.write('[gh424] 13.0 -> ' + JSON.stringify(delivered(a))
            + '   12.8 -> ' + JSON.stringify(delivered(b)) + '\n');
        expect(productSet(a)).toBe(productSet(b));
        expect(delivered(a)).toEqual(delivered(b));
        // And the answer is the one the Plan was already printing.
        expect(delivered(a)).toEqual(B4.deliveredByBand['12.9-20.0']);
    });
});

describe('GH-424 — the month of generation no longer changes the year', () => {
    const B4 = FX.observed.beforeGH427;

    test('generating in any month now gives the same programme', () => {
        // BEFORE: `const annualMean = currentTemp || 15;` — one live reading
        // used as the year's mean, so the whole curve moved bodily with the
        // season it was generated in (8.4 degC between January and July), and
        // the sample yielded two distinct annual programmes across the twelve
        // possible months of generation.
        const sets = new Set(NORMALS.map((anchorForThatMonth) => productSet(run(calendar(), contextAt(anchorForThatMonth)))));
        process.stdout.write('[gh424] distinct annual programmes by month of generation: '
            + sets.size + '; before GH-427 it was ' + B4.distinctProgrammesByMonthOfGeneration + '\n');
        expect(B4.distinctProgrammesByMonthOfGeneration).toBe(2);
        expect(sets.size).toBe(1);
    });

    test('the per-month temperature used IS the site\'s monthly normal', () => {
        // The positive statement, so the suite says what the code does and not
        // only what it no longer does.
        const src = fs.readFileSync(path.join(__dirname, '../assets/prebbles-products.js'), 'utf8');
        expect(src).toMatch(/const monthlySoilTemp = monthData\.temp;/);
        // And the rows carry the normals, which is what makes that sound.
        expect(NORMALS).toEqual([19.8, 20.4, 19.1, 17, 14.7, 12.6, 11.4, 11.8, 12.9, 14.2, 16, 18.2]);
    });
});

describe('GH-424 — option 3: the same normals growth potential runs on', () => {
    /** Replaces the synthetic curve with the month's own recorded normal. */
    function withNormals(fn) {
        const orig = R.estimateMonthlySoilTemp;
        R.estimateMonthlySoilTemp = function (month) {
            const t = NORMALS[month];
            return (typeof t === 'number' && isFinite(t)) ? t : orig.apply(this, arguments);
        };
        try { return fn(); } finally { R.estimateMonthlySoilTemp = orig; }
    }

    test('what the programme becomes, and that it no longer depends on the anchor at all', () => {
        const base = run(calendar(), contextAt(12.8));
        const opt3a = withNormals(() => run(calendar(), contextAt(12.8)));
        const opt3b = withNormals(() => run(calendar(), contextAt(13)));
        const opt3c = withNormals(() => run(calendar(), contextAt(19)));
        process.stdout.write('[gh424] current (anchor 12.8): ' + JSON.stringify(delivered(base)) + '  ' + productSet(base) + '\n');
        process.stdout.write('[gh424] option 3            : ' + JSON.stringify(delivered(opt3a)) + '  ' + productSet(opt3a) + '\n');
        // The point of option 3: the live reading stops mattering.
        expect(productSet(opt3a)).toBe(productSet(opt3b));
        expect(productSet(opt3a)).toBe(productSet(opt3c));
        expect(delivered(opt3a)).toEqual(delivered(opt3c));
    });
});

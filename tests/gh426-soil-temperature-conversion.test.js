/**
 * GH-426 — should the New Zealand recommender be fed SOIL temperature, and does
 * the hub's existing air-to-soil model actually reach it?
 *
 * WHY THE QUESTION IS WELL FOUNDED, verified in the source rather than assumed:
 * the release-efficiency curves in prebbles-products.js are specified against
 * SOIL temperature and say so — methylene urea cites "Spencer 2008 Table 18;
 * Cornell Turf BMP" with the note `Cornell: "little N released unless soil temp
 * >50°F (10°C)"`, and its release mechanism is microbial. Feeding them an air
 * temperature is wrong on the curves' own terms, not as a matter of taste.
 *
 * THE MODEL. `estimateSoilTemp(airTempMean, airTempAmp, depth, texture,
 * apiSoilTemp)` in assets/climate-engine-v2.js has three branches:
 *
 *   1. `api`    reliability 85 — an Open-Meteo shallow soil reading.
 *   2. `model`  reliability 60 — the analytical solution for a semi-infinite
 *               solid under sinusoidal surface forcing (Hillel 1982):
 *               dampingLength = sqrt(2 alpha / omega) with alpha from
 *               SOIL_DIFFUSIVITY[texture] and omega the DAILY frequency
 *               (2*pi/86400); estimated = mean + amp * exp(-depth/L) * 0.5.
 *   3. `crude`  reliability 30 — airTempMean - 1.5.
 *
 * THE GAP THIS FILE EXISTS TO MAKE VISIBLE. Branch 2 needs a DIURNAL AMPLITUDE.
 * climate-normals-service.js requests `parameters: 'T2M'` and nothing else, and
 * there is no per-month API soil reading for a climatology — so on the data the
 * app has today, feeding monthly normals through estimateSoilTemp() runs
 * BRANCH 3, and "soil temperature" reduces to "air normal minus 1.5", at
 * reliability 30. That is measured below, not argued.
 *
 * It is closable: the same single NASA POWER request already made for T2M also
 * serves T2M_MAX and T2M_MIN (tests/fixtures/gh426-nz-monthly-normals.json was
 * fetched from it), so a monthly amplitude is two parameters away. Both the
 * with-amplitude and without-amplitude routes are measured here so the cost of
 * that addition is a number.
 *
 * MEASUREMENT ONLY. Nothing here changes production behaviour.
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
const CE = require('../assets/climate-engine-v2.js');
global.console = _realConsole;

const R = global.window.PrebbleRecommender;
const estimateSoilTemp = CE.estimateSoilTemp;
const SOIL_DIFFUSIVITY = CE.SOIL_DIFFUSIVITY;

const NORMALS_FX = JSON.parse(fs.readFileSync(
    path.join(__dirname, 'fixtures/gh426-nz-monthly-normals.json'), 'utf8'));
const TEST5 = JSON.parse(fs.readFileSync(
    path.join(__dirname, 'fixtures/gh424-test5-recommender-inputs.json'), 'utf8'));

const MONTHS = TEST5.inputs.monthly.map((m) => m.month_name);
const AIR = TEST5.inputs.monthly.map((m) => m.temp);   // what the calendar carries
const AUCK = NORMALS_FX.locations.auckland;

function amplitude(loc, m) { return (loc.T2M_MAX[m] - loc.T2M_MIN[m]) / 2; }

function run(cal, ctx) {
    const real = global.console;
    global.console = { log: function () {}, warn: function () {}, error: function () {}, info: function () {} };
    try { return R.generateProgram(cal, ctx); } finally { global.console = real; }
}
function calendar() {
    return {
        program: { monthly: JSON.parse(JSON.stringify(TEST5.inputs.monthly)) },
        meta: { hemisphere: TEST5.inputs.calendarMeta.hemisphere, latitude: TEST5.inputs.calendarMeta.latitude },
        soil: { methodology: TEST5.inputs.calendarMeta.methodology, CEC: TEST5.inputs.calendarMeta.CEC },
    };
}
function contextAt(t) { return Object.assign({}, TEST5.inputs.context, { soilTemp: t }); }
function productSet(p) {
    return Object.keys(p.annualSummary.products).map((id) => {
        const e = p.annualSummary.products[id];
        return e.name + ' x' + (e.applications || 0) + ' ' + Math.round(e.totalKg || 0);
    }).sort().join(' | ');
}
function delivered(p) {
    const t = { N: 0, P: 0, K: 0 };
    Object.keys(p.annualSummary.products).forEach((id) => {
        const n = p.annualSummary.products[id].nutrients;
        t.N += n.N || 0; t.P += n.P || 0; t.K += n.K || 0;
    });
    return { N: +t.N.toFixed(1), P: +t.P.toFixed(1), K: +t.K.toFixed(1) };
}
/** Replace the per-month soil temperature with a supplied twelve-month series.
 *
 *  GH-427: this used to swap `R.estimateMonthlySoilTemp`. That function is now
 *  deleted and generateProgram() reads each row's `temp` directly, so patching
 *  the method silently did nothing and every option came back identical — a
 *  test that could not fail. The curve is applied where the recommender now
 *  reads it: on the calendar rows. */
function calendarWithCurve(curve) {
    const c = calendar();
    c.program.monthly.forEach((m, i) => {
        if (typeof curve[i] === 'number' && isFinite(curve[i])) m.temp = curve[i];
    });
    return c;
}

describe('GH-426 — which branch of estimateSoilTemp() the app can actually reach', () => {
    test('with what the hub has monthly today, it is the crude branch at reliability 30', () => {
        // climate-normals-service.js fetches `parameters: 'T2M'` — a mean and
        // nothing else — and there is no per-month API soil reading for a
        // climatology. So both of the first two branches are unavailable.
        const got = estimateSoilTemp(AIR[0], null, 0.05, 'sand', null);
        process.stdout.write('[gh426] monthly mean only -> ' + JSON.stringify(got) + '\n');
        expect(got.source).toBe('crude');
        expect(got.reliability).toBe(30);
        expect(got.estimated).toBeCloseTo(AIR[0] - 1.5, 5);
        // i.e. "soil temperature" would be a flat -1.5 offset, no texture, no
        // diffusivity, no heat equation. The model is present but not reached.
        expect(got.depths).toEqual({});
    });

    test('with a monthly amplitude it is the model branch at reliability 60, and texture matters', () => {
        const amp = amplitude(AUCK, 0);
        const sand = estimateSoilTemp(AUCK.T2M[0], amp, 0.05, 'sand', null);
        const clay = estimateSoilTemp(AUCK.T2M[0], amp, 0.05, 'clay', null);
        process.stdout.write('[gh426] monthly mean + amplitude, sand -> ' + JSON.stringify(sand) + '\n');
        process.stdout.write('[gh426] monthly mean + amplitude, clay -> ' + JSON.stringify(clay) + '\n');
        expect(sand.source).toBe('model');
        expect(sand.reliability).toBe(60);
        expect(sand.depths.d50mm).toBeDefined();
        // Sand conducts better, so its damping length is longer and more of the
        // diurnal amplitude survives to 50 mm.
        expect(SOIL_DIFFUSIVITY.sand).toBeGreaterThan(SOIL_DIFFUSIVITY.clay);
        expect(sand.estimated).toBeGreaterThan(clay.estimated);
    });

    test('the two reachable branches disagree about the SIGN of the air-to-soil step', () => {
        // This is the finding that matters for the decision: without an
        // amplitude the model says soil is COOLER than air by a flat 1.5; with
        // one it says WARMER, because `estimated = mean + amp*exp(-d/L)*0.5` is
        // phase-averaged rather than mean-preserving. They are not two
        // estimates of the same number with different confidence — they point
        // opposite ways.
        const crude = estimateSoilTemp(AUCK.T2M[0], null, 0.05, 'sand', null).estimated;
        const model = estimateSoilTemp(AUCK.T2M[0], amplitude(AUCK, 0), 0.05, 'sand', null).estimated;
        process.stdout.write('[gh426] January Auckland: air ' + AUCK.T2M[0]
            + '  crude ' + crude + '  model ' + model + '  (spread ' + (+(model - crude).toFixed(1)) + ' degC)\n');
        expect(crude).toBeLessThan(AUCK.T2M[0]);
        expect(model).toBeGreaterThan(AUCK.T2M[0]);
    });
});

describe('GH-426 — what the heat equation says a MONTHLY figure should be', () => {
    test('the amplitude term is the diurnal residual: it decays to zero with depth', () => {
        // T(z,t) = Tmean + A*exp(-z/L)*sin(wt - z/L). Its average over a cycle
        // is Tmean; the exp(-z/L) term is the surviving daily swing, not an
        // offset. estimateSoilTemp() returns `mean + A*exp(-z/L)*0.5`, i.e. a
        // point roughly half-way up the surviving swing — a value at a PHASE of
        // the day, which is what it was written for.
        const amp = amplitude(AUCK, 0);
        const got = estimateSoilTemp(AUCK.T2M[0], amp, 0.05, 'sand', null);
        const d = got.depths;
        process.stdout.write('[gh426] air mean ' + AUCK.T2M[0] + ' | by depth: '
            + JSON.stringify(d) + '\n');
        // Monotonically approaching the air mean as depth increases — which is
        // the signature of a residual, not of a mean-level shift.
        expect(d.d20mm).toBeGreaterThan(d.d50mm);
        expect(d.d50mm).toBeGreaterThan(d.d100mm);
        expect(d.d100mm).toBeGreaterThan(d.d200mm);
        expect(d.d200mm).toBeGreaterThan(AUCK.T2M[0]);

        // Extrapolate the same formula deeper by hand and it converges on the
        // air mean, confirming there is no mean-level air-to-soil step in this
        // model at all.
        const alpha = SOIL_DIFFUSIVITY.sand * 1e-7;
        const L = Math.sqrt(2 * alpha / ((2 * Math.PI) / 86400));
        const deep = AUCK.T2M[0] + amp * Math.exp(-2.0 / L) * 0.5;
        process.stdout.write('[gh426] same formula at 2 m: ' + (Math.round(deep * 100) / 100)
            + ' against an air mean of ' + AUCK.T2M[0] + '\n');
        expect(deep).toBeCloseTo(AUCK.T2M[0], 3);
        // CONSEQUENCE: for a MONTHLY mean soil temperature this model's answer
        // IS the monthly mean air temperature. Plain option 3 is not an
        // approximation of the soil conversion — at monthly resolution it is
        // what the soil conversion reduces to, once the diurnal term is
        // averaged over the month rather than sampled at one phase of it.
    });
});

describe('GH-426 — the four candidate twelve-month curves', () => {
    test('Test5 - NZ (Auckland, sand)', () => {
        // GH-427 deleted estimateMonthlySoilTemp(); the curve it produced is
        // kept in the fixture so this comparison still has its "before" row.
        const today = TEST5.observed.beforeGH427.curveAtAnchor12_8;
        const crude = AUCK.T2M.map((t) => estimateSoilTemp(t, null, 0.05, 'sand', null).estimated);
        const model = AUCK.T2M.map((t, i) => estimateSoilTemp(t, amplitude(AUCK, i), 0.05, 'sand', null).estimated);
        process.stdout.write('[gh426] month                 ' + MONTHS.map((m) => m.padStart(6)).join('') + '\n');
        process.stdout.write('[gh426] today (live anchor)   ' + today.map((v) => String(v).padStart(6)).join('') + '\n');
        process.stdout.write('[gh426] air normals (opt 3)   ' + AIR.map((v) => String(v).padStart(6)).join('') + '\n');
        process.stdout.write('[gh426] soil, crude branch    ' + crude.map((v) => String(v).padStart(6)).join('') + '\n');
        process.stdout.write('[gh426] soil, model branch    ' + model.map((v) => String(v).padStart(6)).join('') + '\n');
        expect(crude.length).toBe(12);
        expect(model.length).toBe(12);
    });

    test('Russley / GC-NZ (Christchurch, sand) — the colder site, where the curves bite hardest', () => {
        const ch = NORMALS_FX.locations.christchurch;
        const crude = ch.T2M.map((t) => estimateSoilTemp(t, null, 0.05, 'sand', null).estimated);
        const model = ch.T2M.map((t, i) => estimateSoilTemp(t, amplitude(ch, i), 0.05, 'sand', null).estimated);
        process.stdout.write('[gh426] air normals (opt 3)   ' + ch.T2M.map((v) => String(v).padStart(6)).join('') + '\n');
        process.stdout.write('[gh426] soil, crude branch    ' + crude.map((v) => String(v).padStart(6)).join('') + '\n');
        process.stdout.write('[gh426] soil, model branch    ' + model.map((v) => String(v).padStart(6)).join('') + '\n');
        // Methylene urea is 0.10 efficient at 10 degC and 0.18 at 13; which side
        // of that a Christchurch winter lands on is the whole question.
        const below10 = (a) => a.filter((v) => v < 10).length;
        process.stdout.write('[gh426] months below 10 degC — air ' + below10(ch.T2M)
            + ', crude ' + below10(crude) + ', model ' + below10(model) + '\n');
        expect(crude.length).toBe(12);
    });
});

describe('GH-426 — does the 0-based/1-based defect survive the change?', () => {
    test('no: every row already carries a real normal, so the old curve becomes unreachable', () => {
        // computeProgram() refuses to produce a programme at all unless all
        // twelve monthlyTemps are real numbers — it returns
        // { climateDataUnavailable: true } instead (nutrition-calendar.js,
        // "_monthlyTempsComplete"). So by the time a row is written, `temp` is
        // always that month's resolved normal and the `|| 15` beside it is
        // unreachable. Any option that reads `monthData.temp` therefore never
        // falls through to estimateMonthlySoilTemp(), on any site.
        const src = fs.readFileSync(path.join(__dirname, '../assets/nutrition-calendar.js'), 'utf8');
        expect(src).toMatch(/_monthlyTempsComplete[\s\S]{0,400}climateDataUnavailable/);
        expect(src).toMatch(/temp:\s*Math\.round\(\(inputs\.monthlyTemps\[m\]\s*\|\|\s*15\)/);

        // Every row of the real captured programme carries a number.
        TEST5.inputs.monthly.forEach((m) => {
            expect(typeof m.temp).toBe('number');
            expect(isFinite(m.temp)).toBe(true);
        });

        // CONSEQUENCE for the decision: the off-by-one is not something the
        // change has to fix — it is something the change makes dead. Leaving
        // estimateMonthlySoilTemp() in place as an unreachable fallback keeps a
        // known-wrong function in the tree; it should be deleted with the
        // change rather than kept "just in case", because the case cannot arise.
    });
});

describe('GH-426 — what each option does to the programme', () => {
    test('Test5: today vs air normals vs soil-crude vs soil-model', () => {
        // Post-GH-427 this is the shipped behaviour, not "today's bug": the
        // per-month temperature is already each row's normal, so option B is
        // what the recommender now does and the row is labelled accordingly.
        const shipped = run(calendar(), contextAt(12.8));
        const optAir = run(calendarWithCurve(AIR), contextAt(12.8));
        const crudeCurve = AUCK.T2M.map((t) => estimateSoilTemp(t, null, 0.05, 'sand', null).estimated);
        const modelCurve = AUCK.T2M.map((t, i) => estimateSoilTemp(t, amplitude(AUCK, i), 0.05, 'sand', null).estimated);
        const optCrude = run(calendarWithCurve(crudeCurve), contextAt(12.8));
        const optModel = run(calendarWithCurve(modelCurve), contextAt(12.8));

        const show = (label, p) => process.stdout.write('[gh426] ' + label.padEnd(22)
            + JSON.stringify(delivered(p)) + '  ' + productSet(p) + '\n');
        show('shipped (air normals)', shipped);
        // The shipped route reads the rows, so it must equal option B exactly.
        expect(productSet(shipped)).toBe(productSet(optAir));
        show('air normals', optAir);
        show('soil crude (-1.5)', optCrude);
        show('soil model (+amp)', optModel);

        const same = (a, b) => productSet(a) === productSet(b);
        process.stdout.write('[gh426] air normals == soil crude ? ' + same(optAir, optCrude) + '\n');
        process.stdout.write('[gh426] air normals == soil model ? ' + same(optAir, optModel) + '\n');
        process.stdout.write('[gh426] soil crude == soil model  ? ' + same(optCrude, optModel) + '\n');
        // Recorded rather than pinned: this comparison IS the deliverable.
        expect(productSet(optAir)).toEqual(expect.any(String));
    });
});

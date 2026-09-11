/**
 * GH-428 — the outer soil temperature was dead, and the recommender now
 * publishes the twelve it actually runs on.
 *
 * THE DEFECT. After GH-427 the New Zealand path carried two soil temperatures.
 * An OUTER one, resolved once by the integration
 * (`NutritionPrebbleIntegration.getSoilTemperature()`) and put on the context
 * handed to `generateProgram()`. And a PER-MONTH one, which the recommender
 * builds inside its own loop from each calendar row's `temp` — the site's
 * monthly climate normals — and writes over `soilTemp` before any selector sees
 * the context. The outer one reached nothing. The Plan page's
 * calculation-trace block read exactly it and printed it as the figure driving
 * product selection: on Test5 - NZ it showed "13 degC" above a normals row
 * containing 19.8 / 20.4 / 19.1 / 17.0 / 14.7 / 12.6 / 11.4 / 11.8 / 12.9 /
 * 14.2 / 16.0 / 18.2 and no 13 at all.
 *
 * Measured live on all four New Zealand sites before the change, the outer
 * value was not a placeholder — it resolved from the persisted analysis cache
 * (`GAIP_DASHBOARD_DATA.computed.climate.temperature.mean`): Test5 13, Russley
 * 10.4, both GC-NZ sites 9.6. The hardcoded 15 at the end of the getter was
 * never reached on any of them. A real reading that drives nothing is worse to
 * print than an obvious placeholder, not better.
 *
 * WHAT THIS FILE ASSERTS, and why each one is here rather than argued in a
 * comment:
 *
 *   1. No selector ever sees the outer value — established by instrumenting the
 *      two functions that consume a temperature and reading what they were
 *      handed, not by reading the source.
 *   2. The programme is identical whether the outer field holds a wrong value
 *      or is absent entirely. (tests/gh424-soil-temp-basis.test.js sweeps it
 *      8.0-20.0 degC for one product set; "absent" is the case a sweep of
 *      finite values cannot reach, and is the case that now ships.)
 *   3. `program.soilTempSeries` is the twelve the selection ran on, and they are
 *      the calendar rows' own normals.
 *   4. The field and the getter are gone from the source, and no recommender
 *      context anywhere carries `soilTemp` again.
 *
 * THE FIXTURE is the exact object the recommender was handed on the Plan page
 * for Test5 - NZ / Soccer (tests/fixtures/gh424-test5-recommender-inputs.json),
 * whose `inputs.context` still carries the `soilTemp: 13` of the day it was
 * captured — which is what makes test 2 meaningful.
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

const FX = JSON.parse(fs.readFileSync(
    path.join(__dirname, 'fixtures/gh424-test5-recommender-inputs.json'), 'utf8'));
const NORMALS = FX.inputs.monthly.map((m) => m.temp);

function calendar() {
    return {
        program: { monthly: JSON.parse(JSON.stringify(FX.inputs.monthly)) },
        meta: { hemisphere: FX.inputs.calendarMeta.hemisphere, latitude: FX.inputs.calendarMeta.latitude },
        soil: { methodology: FX.inputs.calendarMeta.methodology, CEC: FX.inputs.calendarMeta.CEC },
    };
}
/** The context as the Plan really handed it over, on the day it was captured. */
function contextWithOuter(v) {
    return Object.assign({}, FX.inputs.context, { soilTemp: v });
}
/** The context as it is handed over after this ticket: no such field. */
function contextWithout() {
    const c = Object.assign({}, FX.inputs.context);
    delete c.soilTemp;
    return c;
}
function run(cal, ctx) {
    const real = global.console;
    global.console = { log: function () {}, warn: function () {}, error: function () {}, info: function () {} };
    try { return R.generateProgram(cal, ctx); } finally { global.console = real; }
}
function productSet(program) {
    return Object.keys(program.annualSummary.products).map((id) => {
        const e = program.annualSummary.products[id];
        return e.name + ' x' + (e.applications || 0) + ' ' + Math.round(e.totalKg || 0);
    }).sort().join(' | ');
}
/**
 * Every temperature a selector was actually handed, at the three places the
 * recommender reads one: the release-efficiency curve, and the two product
 * choosers that read `context.soilTemp` off whatever context they are given.
 * Instrumenting the consumers rather than the producer is the whole point — it
 * is what tells a live input apart from a decorative one.
 */
function instrument(seen) {
    const saved = {
        getReleaseTechEfficiency: R.getReleaseTechEfficiency,
        selectNitrogenSource: R.selectNitrogenSource,
        selectFoliarNitrogen: R.selectFoliarNitrogen,
    };
    R.getReleaseTechEfficiency = function (tech, soilTemp) {
        seen.push(soilTemp); return saved.getReleaseTechEfficiency.apply(this, arguments);
    };
    R.selectNitrogenSource = function (products, monthData, ctx) {
        if (ctx) seen.push(ctx.soilTemp); return saved.selectNitrogenSource.apply(this, arguments);
    };
    R.selectFoliarNitrogen = function (products, monthData, ctx) {
        if (ctx) seen.push(ctx.soilTemp); return saved.selectFoliarNitrogen.apply(this, arguments);
    };
    return function restore() { Object.keys(saved).forEach((k) => { R[k] = saved[k]; }); };
}
function temperaturesConsumedBy(ctx, cal) {
    const seen = [];
    const restore = instrument(seen);
    try { run(cal || calendar(), ctx); } finally { restore(); }
    return seen.filter((v) => typeof v === 'number');
}

describe('GH-428 — the outer value never reached a selector', () => {
    test('the recommender consumes the twelve normals, never the outer figure', () => {
        // 13 is not merely "one of several" — it is absent, and the normals are
        // all present. Instrumented at the point of consumption, which is the
        // only place that can tell a live input from a decorative one.
        const seen = temperaturesConsumedBy(contextWithOuter(13));
        const distinct = Array.from(new Set(seen)).sort((a, b) => a - b);
        process.stdout.write('[gh428] temperatures the efficiency curve was evaluated at: '
            + JSON.stringify(distinct) + '\n');
        expect(seen.length).toBeGreaterThan(0);
        expect(distinct).not.toContain(13);
        distinct.forEach((t) => expect(NORMALS).toContain(t));
    });

    test('an absurd outer value changes nothing it touches', () => {
        // 99 degC is off the top of every efficiency curve. If the field were
        // read anywhere the programme could not survive it unchanged.
        const a = run(calendar(), contextWithOuter(99));
        const b = run(calendar(), contextWithOuter(-40));
        expect(productSet(a)).toBe(productSet(b));
        const seen = Array.from(new Set(temperaturesConsumedBy(contextWithOuter(99))));
        expect(seen).not.toContain(99);
    });

    test('removing the field entirely gives the same programme as leaving it', () => {
        // This is the case the GH-424 sweep cannot reach — it sweeps finite
        // values — and it is the case that ships.
        const withField = run(calendar(), contextWithOuter(FX.inputs.context.soilTemp));
        const without = run(calendar(), contextWithout());
        expect(FX.inputs.context.soilTemp).toBe(13);   // the fixture still carries it
        expect(productSet(without)).toBe(productSet(withField));
        expect(JSON.stringify(without.monthly)).toBe(JSON.stringify(withField.monthly));
    });
});

describe('GH-428 — the recommender publishes what it ran on', () => {
    test('soilTempSeries is twelve months, and each is that month\'s own normal', () => {
        const p = run(calendar(), contextWithout());
        expect(Array.isArray(p.soilTempSeries)).toBe(true);
        expect(p.soilTempSeries.length).toBe(12);
        expect(p.soilTempSeries.map((e) => e.temp)).toEqual(NORMALS);
        expect(p.soilTempSeries.map((e) => e.month)).toEqual(FX.inputs.monthly.map((m) => m.month_name));
        expect(p.soilTempSeries.map((e) => e.month_num)).toEqual(FX.inputs.monthly.map((m) => m.month_num));
    });

    test('it is the series actually consumed, not a copy of the calendar rows', () => {
        // The published series must follow the month context, so that it cannot
        // agree with the rows by construction while selection runs on something
        // else. Move one month's temperature and both must move together.
        const cal = calendar();
        cal.program.monthly[0].temp = 9.9;   // January: never covered, always selected for
        const seen = temperaturesConsumedBy(contextWithout(), cal);
        const p = run((function () { const c = calendar(); c.program.monthly[0].temp = 9.9; return c; })(),
            contextWithout());
        expect(p.soilTempSeries[0].temp).toBe(9.9);
        expect(Array.from(new Set(seen))).toContain(9.9);
    });

    test('every published figure was handed to the selectors, and nothing else was', () => {
        const seen = Array.from(new Set(temperaturesConsumedBy(contextWithout())));
        const published = run(calendar(), contextWithout()).soilTempSeries.map((e) => e.temp);
        // Some months are covered by an earlier slow-release application and
        // never reach granular selection, so the consumed set may be smaller —
        // but it may never contain anything that was not published.
        seen.forEach((t) => expect(published).toContain(t));
    });
});

describe('GH-428 — the field and the getter are gone, and stay gone', () => {
    const ASSETS = path.join(__dirname, '..', 'assets');

    test('getSoilTemperature() exists nowhere in the shipped assets', () => {
        const hits = fs.readdirSync(ASSETS).filter((f) => /\.js$/.test(f)).filter((f) => {
            const src = fs.readFileSync(path.join(ASSETS, f), 'utf8');
            // Code only: the deletion is documented in comments in three files,
            // and a comment naming the thing that was removed is not a use of it.
            return src.split('\n').some((l) => {
                const t = l.trim();
                if (t.indexOf('//') === 0 || t.indexOf('*') === 0) return false;
                return /getSoilTemperature\s*[:(]/.test(l);
            });
        });
        // climate-engine.js has its OWN getSoilTemperature(climate, metrics) —
        // a different function, on a different module, that this ticket does not
        // touch. It is named here so the assertion is about the right thing.
        expect(hits).toEqual(['climate-engine.js']);
    });

    test('no recommender context is built with a soilTemp field', () => {
        // The three files that used to. A context literal with `soilTemp:` in
        // any of them is the defect coming back.
        ['nutrition-prebble-integration.js', 'nutrition-nz-fertiliser-integration.js',
         'word-export-combined.js'].forEach((f) => {
            const src = fs.readFileSync(path.join(ASSETS, f), 'utf8');
            const lines = src.split('\n')
                .filter((l) => /\bsoilTemp\s*:/.test(l) && !/^\s*(\/\/|\*)/.test(l.trim()));
            expect({ file: f, lines: lines }).toEqual({ file: f, lines: [] });
        });
    });

    test('the recommender still overwrites soilTemp per month — the reason the field was dead', () => {
        const src = fs.readFileSync(path.join(ASSETS, 'prebbles-products.js'), 'utf8');
        // The month context spreads the caller's context and then sets its own
        // temperature. If that order ever inverted, the outer field would matter
        // again and deleting it would have been wrong.
        const i = src.indexOf('const monthContext = {');
        expect(i).toBeGreaterThan(-1);
        const block = src.slice(i, src.indexOf('};', i));
        expect(block.indexOf('...context')).toBeGreaterThan(-1);
        expect(block.indexOf('soilTemp: monthlySoilTemp')).toBeGreaterThan(block.indexOf('...context'));
    });
});

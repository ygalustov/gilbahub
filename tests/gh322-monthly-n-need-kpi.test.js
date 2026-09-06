/**
 * GH-322 — the Plan page's "Monthly N Need" KPI card always showed 0. Root
 * cause: it read `soilN.annualDemand.n` (lowercase), but
 * calculateAnnualDemand() (mlsn-progressive-disclosure.js) only ever sets
 * `annualDemand.N` (uppercase) — `.n` was always undefined, for every site,
 * every month.
 *
 * Even with the casing fixed, the card computed `annualDemand.N / 12` — a
 * flat annual average — which would still disagree with the Monthly
 * Nutrient Program table's real, GP-weighted per-month value (e.g. a
 * cool-season site's August is a low-GP winter month, nowhere near
 * annual/12).
 *
 * FIX: source the card directly from the already-generated Nutrition
 * Program's own monthly array (window.GilbaNutritionCalendar.program.
 * program.monthly[currentMonthIndex].N) — the same data the Monthly
 * Nutrient Program table itself renders from, so the two can never
 * disagree.
 */

'use strict';

const vm = require('vm');
const fs = require('fs');
const path = require('path');

function loadAndRun(dashboardData, siteConfig, calendarProgram, elementRegistry, opts) {
    const src = fs.readFileSync(path.join(__dirname, '../assets/plan-ui.js'), 'utf8');

    const elements = elementRegistry || {};
    const listeners = {};

    const sandbox = {
        window: {},
        document: {
            readyState: 'complete',
            getElementById: (id) => elements[id] || null,
            querySelectorAll: () => [],
            querySelector: () => null,
            addEventListener: (name, fn) => { (listeners[name] = listeners[name] || []).push(fn); },
            createElement: () => ({ setAttribute() {}, appendChild() {}, style: {} }),
        },
        console: { log: () => {}, warn: () => {}, error: () => {} },
        localStorage: { getItem: () => null, setItem: () => {} },
        // synchronous for test determinism -- real code uses a 200ms delay
        setTimeout: (fn) => fn(),
        // vm.createContext() creates its own isolated realm with its own
        // built-in Date -- a test's `global.Date = class extends realDate...`
        // mock in the OUTER Node process never reaches code run via
        // vm.runInContext() unless explicitly passed through here. Without
        // this, plan-ui.js's `new Date().getMonth()` always saw the REAL
        // current month, so these tests only passed by coincidence when run
        // in August (array index 7) and failed every other month (e.g. a
        // September run computed index 8, "Mon8"/20, not "Mon7"/7.9).
        Date: global.Date,
    };
    sandbox.window.GAIP_DASHBOARD_DATA = { computed: dashboardData };
    sandbox.window.GAIP_SITE_CONFIG = siteConfig || {};
    sandbox.window.GilbaNutritionCalendar = calendarProgram ? { program: calendarProgram } : undefined;
    sandbox.window.addEventListener = () => {};
    sandbox.window.location = { hash: '' };
    sandbox.window.history = { pushState: () => {} };
    sandbox.global = sandbox;
    sandbox.globalThis = sandbox;

    const ctx = vm.createContext(sandbox);
    vm.runInContext(src, ctx, { filename: 'plan-ui.js' });
    ctx.__listeners = listeners;
    return ctx;
}

function headerEl() {
    let captured = '';
    return {
        el: { set innerHTML(v) { captured = v; }, get innerHTML() { return captured; } },
        get html() { return captured; },
    };
}

describe('GH-322 — Monthly N Need KPI card', () => {
    test('with a generated program, shows the real current-month N value (not a flat annual/12 average)', () => {
        const realDate = Date;
        global.Date = class extends realDate {
            getMonth() { return 7; } // August, 0-indexed
        };
        try {
            const header = headerEl();
            const monthly = new Array(12).fill(null).map((_, i) => ({ month_num: i, month_name: 'Mon' + i, N: i === 7 ? 7.9 : 20 }));
            loadAndRun(
                { soilNutrition: { annualDemand: { N: 200 } } }, // old flat-average source, present but should be ignored now
                {},
                { program: { monthly } },
                { 'plan-header-content': header.el }
            );
            expect(header.html).toMatch(/Monthly N Need/);
            expect(header.html).toMatch(/>7\.9</);
            expect(header.html).toMatch(/kg N\/ha in Mon7/);
        } finally {
            global.Date = realDate;
        }
    });

    test('regression: no longer reads the never-populated lowercase soilN.annualDemand.n', () => {
        const src = fs.readFileSync(path.join(__dirname, '../assets/plan-ui.js'), 'utf8');
        expect(src).not.toMatch(/safeNum\(soilN\.annualDemand\.n[,)]/);
    });

    test('no generated program available -> graceful "Generate a Nutrition Program" empty state, not 0', () => {
        const header = headerEl();
        loadAndRun(
            { soilNutrition: { annualDemand: { N: 200 } } },
            {},
            null,
            { 'plan-header-content': header.el }
        );
        expect(header.html).toMatch(/Generate a Nutrition Program/);
        expect(header.html).not.toMatch(/Monthly N Need/);
    });

    test('GH-322 follow-up: does NOT listen for gaip:site-config-applied (dead end on plan.blade.php, which never dispatches it -- fixed at the source in nutrition-calendar.js\'s restoreFromPersisted() instead, see gh322b test file)', () => {
        const header = headerEl();
        const ctx = loadAndRun({}, {}, null, { 'plan-header-content': header.el });
        expect(ctx.__listeners['gaip:site-config-applied']).toBeUndefined();
    });

    test('GH-322 follow-up: re-renders on gaip:nutrition-calendar-generated (live "Generate" click)', () => {
        const realDate = Date;
        global.Date = class extends realDate {
            getMonth() { return 7; }
        };
        try {
            const header = headerEl();
            const ctx = loadAndRun({}, {}, null, { 'plan-header-content': header.el });
            expect(header.html).toMatch(/Generate a Nutrition Program/);

            const monthly = new Array(12).fill(null).map((_, i) => ({ month_num: i, month_name: 'Mon' + i, N: i === 7 ? 7.9 : 20 }));
            ctx.window.GilbaNutritionCalendar = { program: { program: { monthly } } };
            const fns = ctx.__listeners['gaip:nutrition-calendar-generated'] || [];
            expect(fns.length).toBeGreaterThan(0);
            fns.forEach((fn) => fn());

            expect(header.html).toMatch(/Monthly N Need/);
            expect(header.html).toMatch(/>7\.9</);
        } finally {
            global.Date = realDate;
        }
    });
});

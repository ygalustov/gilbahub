/**
 * GH-278 — Monthly N Distribution's real data source (nutrition-summary-
 * integration.js's renderNutritionSummary()) never gets a chance to run
 * because it loses a race against the async climate-normals fetch, and
 * nothing ever retries once that fetch finishes.
 *
 * BUG: renderNutritionSummary() needs global.climateMetrics.monthlyTemps,
 * resolved asynchronously by climate-normals-service.js (NASA POWER/
 * Open-Meteo). It's called ~100ms after gaip:analysis-complete fires
 * (handleAnalysisComplete -> injectNutritionSummary), which is almost
 * always before that fetch resolves -- confirmed live (Russley site):
 * renderNutritionSummary() logged {hasData: true, hasMonthlyTemps: false}
 * and returned the "Climate data unavailable" placeholder, permanently,
 * because init() never subscribed to climate-normals-service.js's
 * 'gaip:monthly-normals-ready' event (only gaip:soil-data-update,
 * gaip:mlsn-calculated, gaip:turf-profile-change). global.__GAIP_MONTHLY_N__
 * was confirmed undefined even at hub-persistence.js's final _doRerunSync
 * save (3s later, by which point GH-251's bounded wait had already let
 * climateMetrics.monthlyTemps resolve) -- the data was available in time,
 * nothing was listening for it. soil-nutrition-analysis.js's renderMonthlyN()
 * then fell back to its own (separately buggy, see GH-278 backlog note) 8-9
 * day dailyPattern approximation, producing the observed "all 12 months'
 * worth of N crammed into 1 month" chart.
 *
 * FIX: init() now also listens for 'gaip:monthly-normals-ready' and calls
 * updateNutritionSummary(), same as the other reactive listeners -- once
 * climate-normals-service.js resolves monthlyTemps and fires that event,
 * the widget re-renders, this time past the monthlyTemps guard, and sets
 * __GAIP_MONTHLY_N__ correctly before the next persistence save.
 */

'use strict';

const fs = require('fs');
const path = require('path');
const vm = require('vm');

const srcPath = path.join(__dirname, '../assets/nutrition-summary-integration.js');
const src = fs.readFileSync(srcPath, 'utf8');

describe('GH-278 — nutrition-summary-integration.js reacts to monthly normals arriving late', () => {
    test('init() subscribes gaip:monthly-normals-ready to updateNutritionSummary, alongside the other reactive listeners', () => {
        const initIdx = src.indexOf('function init() {');
        expect(initIdx).toBeGreaterThan(-1);
        const initEndIdx = src.indexOf('\n    }', initIdx);
        const body = src.slice(initIdx, initEndIdx);

        expect(body).toMatch(/addEventListener\('gaip:soil-data-update',\s*updateNutritionSummary\)/);
        expect(body).toMatch(/addEventListener\('gaip:mlsn-calculated',\s*updateNutritionSummary\)/);
        expect(body).toMatch(/addEventListener\('gaip:turf-profile-change',\s*updateNutritionSummary\)/);
        // The actual fix:
        expect(body).toMatch(/addEventListener\('gaip:monthly-normals-ready',\s*updateNutritionSummary\)/);
    });

    function loadModule() {
        const exportLine = "global.GilbaNutritionSummary = NutritionSummary;";
        expect(src).toContain(exportLine);

        const listeners = {};
        const sandbox = {
            window: {},
            document: {
                readyState: 'complete',
                addEventListener: function (evt, fn) {
                    (listeners[evt] = listeners[evt] || []).push(fn);
                },
                querySelector: () => null,
                querySelectorAll: () => [],
                createElement: () => ({ style: {}, classList: { add() {} }, addEventListener() {} }),
                body: {},
            },
            console: { log: () => {}, warn: () => {}, error: () => {} },
            localStorage: { getItem: () => null },
            // No-op: the module self-inits via setTimeout(init, 100) at load
            // time, which would spawn its own retry timers (injectNutritionSummary's
            // container-polling loop) irrelevant to these tests and left dangling
            // after the test process exits. Tests call the exported functions
            // directly instead of relying on that auto-init.
            setTimeout: () => 0,
            MutationObserver: function () { this.observe = () => {}; },
            CustomEvent: function (type, opts) { this.type = type; this.detail = opts && opts.detail; },
        };
        sandbox.window.GAIP_DASHBOARD_DATA = {};
        sandbox.global = sandbox;
        sandbox.globalThis = sandbox;
        const ctx = vm.createContext(sandbox);
        vm.runInContext(src, ctx, { filename: 'nutrition-summary-integration.js' });
        return { ctx, listeners };
    }

    test('renderNutritionSummary() shows the "Climate data unavailable" placeholder and does not set __GAIP_MONTHLY_N__ when monthlyTemps is not yet resolved', () => {
        const { ctx } = loadModule();
        ctx.window.GAIP_STATE = { soil: { P: 20, K: 150, Ca: 800 } };
        // No ctx.window.climateMetrics set -- monthlyTemps unresolved, as at t=100ms live.

        const html = ctx.window.GilbaNutritionSummary.renderNutritionSummary();

        expect(html).toMatch(/Climate data unavailable/);
        expect(ctx.window.__GAIP_MONTHLY_N__).toBeUndefined();
    });

    test('renderNutritionSummary() computes real monthly N and sets __GAIP_MONTHLY_N__ once monthlyTemps has resolved', () => {
        const { ctx } = loadModule();
        ctx.window.GAIP_STATE = { soil: { P: 20, K: 150, Ca: 800 } };
        ctx.window.climateMetrics = {
            monthlyTemps: { 1: 20, 2: 20, 3: 18, 4: 15, 5: 12, 6: 9, 7: 8, 8: 9, 9: 11, 10: 14, 11: 17, 12: 19 },
        };

        const html = ctx.window.GilbaNutritionSummary.renderNutritionSummary();

        expect(html).not.toMatch(/Climate data unavailable/);
        expect(Array.isArray(ctx.window.__GAIP_MONTHLY_N__)).toBe(true);
        expect(ctx.window.__GAIP_MONTHLY_N__).toHaveLength(12);
        // Not every month crammed into one -- at least a few months share the load,
        // the exact bug this fix resolves (all 12 months' N in a single month).
        const monthsWithN = ctx.window.__GAIP_MONTHLY_N__.filter(m => m.n > 0).length;
        expect(monthsWithN).toBeGreaterThan(1);
    });

    test('updateNutritionSummary() (what the new listener calls) re-renders an existing wrapper in place', () => {
        const { ctx } = loadModule();
        ctx.window.GAIP_STATE = { soil: { P: 20, K: 150, Ca: 800 } };

        let currentHTML = '';
        const wrapper = {
            set innerHTML(v) { currentHTML = v; },
            get innerHTML() { return currentHTML; },
        };
        ctx.document.querySelector = (sel) => (sel === '.gaip-nutrition-summary-wrapper' ? wrapper : null);

        ctx.window.GilbaNutritionSummary.update();
        expect(currentHTML).toMatch(/Climate data unavailable/);
        expect(ctx.window.__GAIP_MONTHLY_N__).toBeUndefined();

        // Normals arrive; climate-normals-service.js would now dispatch
        // gaip:monthly-normals-ready, whose handler (per the structural pin
        // above) is exactly this update() call.
        ctx.window.climateMetrics = {
            monthlyTemps: { 1: 20, 2: 20, 3: 18, 4: 15, 5: 12, 6: 9, 7: 8, 8: 9, 9: 11, 10: 14, 11: 17, 12: 19 },
        };
        ctx.window.GilbaNutritionSummary.update();

        expect(currentHTML).not.toMatch(/Climate data unavailable/);
        expect(Array.isArray(ctx.window.__GAIP_MONTHLY_N__)).toBe(true);
        expect(ctx.window.__GAIP_MONTHLY_N__).toHaveLength(12);
    });
});

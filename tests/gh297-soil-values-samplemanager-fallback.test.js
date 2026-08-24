/**
 * GH-297 — live-reproduced via debug instrumentation (temporarily added for
 * GH-296, since removed): even after GH-295/296 fixed the climate-normals
 * persistence/wipe races, the user still saw the "all N in one month" bug on
 * a fresh site switch. The debug logs showed climateMetrics.monthlyTemps WAS
 * resolved and the .gaip-nutrition-summary-wrapper DID exist at render time
 * — yet __GAIP_MONTHLY_N__ stayed undefined after rendering. Not a climate
 * race at all.
 *
 * ROOT CAUSE: extractSoilValues() only checks GAIP_STATE.soil,
 * GilbaHubOrchestrator's state.soil/state.inputs.soil,
 * GAIP_NUTRITION_SOIL_CACHE, and DOM fields. On a fresh site switch, the
 * MLSN engine's rendered HTML table (which those first three sources
 * ultimately derive from) can still be empty at the moment
 * gaip:monthly-normals-ready/gaip:analysis-complete fire for the new site
 * — confirmed live: hub-persistence.js's own primary MLSN-scrape path
 * logged "verdict: NO DATA" for this exact site switch, while its
 * GAIP_SampleManager-based fallback (getAllSamples()-keyed by
 * GAIP_HUB_CONFIG.activeSiteId, falling back to getSamples()) found a real,
 * complete sample seconds later ("verdict: HIGH_RISK | nutrients: 10").
 * extractSoilValues() had no equivalent fallback, so renderNutritionSummary()
 * bailed on its `hasData` check before ever reaching the monthly-N
 * computation, regardless of climate data being ready.
 *
 * FIX: extractSoilValues() gains the same GAIP_SampleManager fallback
 * hub-persistence.js already uses (site-aware getAllSamples() first, same
 * _ppm/_me field-name cleanup), as a fifth tier before the DOM-field
 * fallback.
 */

'use strict';

const fs = require('fs');
const path = require('path');
const vm = require('vm');

const srcPath = path.join(__dirname, '../assets/nutrition-summary-integration.js');
const src = fs.readFileSync(srcPath, 'utf8');

describe('GH-297 — extractSoilValues() falls back to GAIP_SampleManager', () => {
    test('extractSoilValues() references GAIP_SampleManager between the cache check and the DOM fallback', () => {
        const fnIdx = src.indexOf('function extractSoilValues() {');
        expect(fnIdx).toBeGreaterThan(-1);
        const cacheIdx = src.indexOf('GAIP_NUTRITION_SOIL_CACHE', fnIdx);
        const domFallbackIdx = src.indexOf("const values = {};", fnIdx);
        const sampleManagerIdx = src.indexOf('GAIP_SampleManager', fnIdx);

        expect(cacheIdx).toBeGreaterThan(-1);
        expect(domFallbackIdx).toBeGreaterThan(-1);
        expect(sampleManagerIdx).toBeGreaterThan(cacheIdx);
        expect(sampleManagerIdx).toBeLessThan(domFallbackIdx);
    });

    function loadModule() {
        const sandbox = {
            window: {},
            document: {
                readyState: 'complete',
                addEventListener: function () {},
                querySelector: () => null,
                querySelectorAll: () => [],
                createElement: () => ({ style: {}, classList: { add() {} }, addEventListener() {} }),
                body: {},
            },
            console: { log: () => {}, warn: () => {}, error: () => {} },
            localStorage: { getItem: () => null },
            setTimeout: () => 0,
            MutationObserver: function () { this.observe = () => {}; },
            CustomEvent: function (type, opts) { this.type = type; this.detail = opts && opts.detail; },
        };
        sandbox.window.GAIP_DASHBOARD_DATA = {};
        sandbox.global = sandbox;
        sandbox.globalThis = sandbox;
        const ctx = vm.createContext(sandbox);
        vm.runInContext(src, ctx, { filename: 'nutrition-summary-integration.js' });
        return ctx;
    }

    const MONTHLY_TEMPS = { 1: 20, 2: 20, 3: 18, 4: 15, 5: 12, 6: 9, 7: 8, 8: 9, 9: 11, 10: 14, 11: 17, 12: 19 };

    test('renderNutritionSummary() computes real monthly N via the site-aware GAIP_SampleManager.getAllSamples() fallback when GAIP_STATE/orchestrator/cache all have no soil data', () => {
        const ctx = loadModule();
        // Deliberately empty/absent: GAIP_STATE.soil, GilbaHubOrchestrator, GAIP_NUTRITION_SOIL_CACHE.
        ctx.window.GAIP_STATE = {};
        ctx.window.climateMetrics = { monthlyTemps: MONTHLY_TEMPS };
        ctx.window.GAIP_HUB_CONFIG = { activeSiteId: 'site-1' };
        ctx.window.GAIP_SampleManager = {
            getAllSamples: () => ({
                allSites: {
                    'site-1': {
                        soil: {
                            's1': { date: '2026-01-01', rawData: { P_ppm: '20', K_ppm: '150', Ca_ppm: '800' } },
                            's2': { date: '2026-06-01', rawData: { P_ppm: '25', K_ppm: '160', Ca_ppm: '900' } },
                        },
                    },
                },
            }),
        };

        const html = ctx.window.GilbaNutritionSummary.renderNutritionSummary();

        expect(html).not.toMatch(/Enter soil test values/);
        expect(html).not.toMatch(/Climate data unavailable/);
        expect(Array.isArray(ctx.window.__GAIP_MONTHLY_N__)).toBe(true);
        expect(ctx.window.__GAIP_MONTHLY_N__).toHaveLength(12);
    });

    test('falls back to getSamples() when GAIP_HUB_CONFIG.activeSiteId or getAllSamples() site entry is unavailable', () => {
        const ctx = loadModule();
        ctx.window.GAIP_STATE = {};
        ctx.window.climateMetrics = { monthlyTemps: MONTHLY_TEMPS };
        ctx.window.GAIP_SampleManager = {
            getSamples: (type) => (type === 'soil' ? {
                's1': { date: '2026-01-01', values: { K: 150, Ca: 800 } },
            } : {}),
        };

        const html = ctx.window.GilbaNutritionSummary.renderNutritionSummary();

        expect(html).not.toMatch(/Enter soil test values/);
        expect(Array.isArray(ctx.window.__GAIP_MONTHLY_N__)).toBe(true);
    });

    test('still shows the placeholder when GAIP_SampleManager has no soil samples either', () => {
        const ctx = loadModule();
        ctx.window.GAIP_STATE = {};
        ctx.window.climateMetrics = { monthlyTemps: MONTHLY_TEMPS };
        ctx.window.GAIP_SampleManager = {
            getSamples: () => ({}),
        };

        const html = ctx.window.GilbaNutritionSummary.renderNutritionSummary();

        expect(html).toMatch(/Enter soil test values/);
        expect(ctx.window.__GAIP_MONTHLY_N__).toBeUndefined();
    });
});

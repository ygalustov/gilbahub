/**
 * GH-296 — GH-295 fixed the persistence side of the Monthly N Distribution
 * pipeline (hub-persistence.js now re-saves once monthly normals resolve),
 * but the user reproduced the exact same "all N in one month" symptom again
 * across repeated Re-runs of the same site (1st correct, 2nd wrong, 3rd
 * correct) — proving there's a second, independent race, upstream of
 * persistence entirely.
 *
 * ROOT CAUSE: extractMonthlyTemps() reads global.climateMetrics.monthlyTemps
 * first, then GilbaHubOrchestrator's state.climate.monthlyTemps. Both are
 * wiped on every Re-run, not just once:
 *   - hub-tissue-v3.js's validateClimateMetrics() rebuilds window.climateMetrics
 *     from a strict whitelist (temperature/stress/growth/moisture only) on
 *     every weather fetch — no monthlyTemps field.
 *   - hub-orchestrator.js's canonical-state rebuild
 *     (GAIP_CANONICAL_STATE.climate = {source, temperature, humidity, ...})
 *     does the same to GilbaHubOrchestrator's state.climate.
 * climate-normals-service.js's NASA POWER/Open-Meteo fetch only ever runs
 * ONCE per page load (DOMContentLoaded), and nothing re-triggers it on
 * Re-run. So whichever of "the wipe" vs "the one-time fetch resolving" last
 * touched climateMetrics/state.climate at the moment a given Re-run's save
 * fires determines whether that Re-run shows correct or broken data — a
 * genuine, non-deterministic race across repeated Re-runs of the same site.
 *
 * FIX: a third fallback tier, _resolvedNormals(), reads
 * climate-normals-service.js's own per-coordinate cache directly via its
 * getResolvedSync(lat, lon) API — a plain in-memory cache neither wipe above
 * ever touches. Once the one-time fetch has resolved at all (almost always
 * true by the time a user has clicked Re-run even once), this tier is stable
 * across every subsequent Re-run, closing the race rather than trying to win
 * it.
 */

'use strict';

const fs = require('fs');
const path = require('path');
const vm = require('vm');

const srcPath = path.join(__dirname, '../assets/nutrition-summary-integration.js');
const src = fs.readFileSync(srcPath, 'utf8');

describe('GH-296 — nutrition-summary-integration.js survives climateMetrics being wiped mid-session', () => {
    test('extractMonthlyTemps() falls back to GilbaClimateNormalsService.getResolvedSync() when the first two sources are empty', () => {
        expect(src).toMatch(/function _resolvedNormals\(\)/);
        expect(src).toMatch(/function _readCoordsForNormals\(\)/);

        const fnIdx = src.indexOf('function extractMonthlyTemps() {');
        expect(fnIdx).toBeGreaterThan(-1);
        const fnEnd = src.indexOf('\n    }', fnIdx);
        const body = src.slice(fnIdx, fnEnd);

        expect(body).toMatch(/global\.climateMetrics\?\.monthlyTemps/);
        expect(body).toMatch(/state\?\.climate\?\.monthlyTemps/);
        // The actual fix — the race-proof third tier:
        expect(body).toMatch(/_resolvedNormals\(\)/);
    });

    test('extractMonthlyTempsSource() and the tooltip period also fall back to _resolvedNormals()', () => {
        const fnIdx = src.indexOf('function extractMonthlyTempsSource() {');
        expect(fnIdx).toBeGreaterThan(-1);
        const fnEnd = src.indexOf('\n    }', fnIdx);
        expect(src.slice(fnIdx, fnEnd)).toMatch(/resolved\?\.source/);

        expect(src).toMatch(/monthlyTempsPeriod \|\| _resolvedNormals\(\)\?\.period/);
    });

    function loadModule() {
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

    test('renderNutritionSummary() still computes real monthly N when climateMetrics AND GilbaHubOrchestrator state have both been wiped (post-Re-run state), as long as the climate-normals-service cache has the data', () => {
        const ctx = loadModule();
        ctx.window.GAIP_STATE = {
            soil: { P: 20, K: 150, Ca: 800 },
            location: { lat: -43.5, lon: 172.6 },
        };
        // Simulate the post-Re-run wipe: no climateMetrics.monthlyTemps, no
        // GilbaHubOrchestrator (or an orchestrator whose state.climate was
        // rebuilt without monthlyTemps, same net effect).
        ctx.window.climateMetrics = { temperature: { mean: 15 } };

        // climate-normals-service.js's own untouched per-coordinate cache:
        ctx.window.GilbaClimateNormalsService = {
            getResolvedSync: (lat, lon) => {
                expect(lat).toBe(-43.5);
                expect(lon).toBe(172.6);
                return { monthlyTemps: MONTHLY_TEMPS, source: 'nasa-power', period: '2001-2020' };
            },
        };

        const html = ctx.window.GilbaNutritionSummary.renderNutritionSummary();

        expect(html).not.toMatch(/Climate data unavailable/);
        expect(Array.isArray(ctx.window.__GAIP_MONTHLY_N__)).toBe(true);
        expect(ctx.window.__GAIP_MONTHLY_N__).toHaveLength(12);
    });

    test('still shows "Climate data unavailable" when every tier (including the cache) is genuinely empty', () => {
        const ctx = loadModule();
        ctx.window.GAIP_STATE = { soil: { P: 20, K: 150, Ca: 800 } };
        ctx.window.climateMetrics = { temperature: { mean: 15 } };
        ctx.window.GilbaClimateNormalsService = {
            getResolvedSync: () => null,
        };

        const html = ctx.window.GilbaNutritionSummary.renderNutritionSummary();

        expect(html).toMatch(/Climate data unavailable/);
        expect(ctx.window.__GAIP_MONTHLY_N__).toBeUndefined();
    });
});

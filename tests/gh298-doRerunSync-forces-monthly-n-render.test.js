/**
 * GH-298 — GH-295/296/297 each fixed one real, live-confirmed gap in the
 * chain that keeps window.__GAIP_MONTHLY_N__ up to date (persistence not
 * re-triggered on gaip:monthly-normals-ready, climate-normals wiped on every
 * Re-run, soil data not yet synced on a fresh site switch) — but each fix
 * only closed the specific reproduction that exposed it. A further site
 * switch (Buffalograss / "westview", brand-new coordinates never fetched
 * before) reproduced the same "all N in one month" symptom yet again,
 * suggesting there are more possible timing gaps in
 * nutrition-summary-integration.js's purely reactive render chain (a fixed
 * list of trigger events: gaip:soil-data-update / gaip:mlsn-calculated /
 * gaip:turf-profile-change / gaip:monthly-normals-ready / ~100ms after
 * gaip:analysis-complete) than are worth chasing one at a time.
 *
 * FIX: instead of adding a 4th/5th/Nth reactive listener, _doRerunSync() —
 * the one function that actually POSTs to /api/analysis-cache and therefore
 * the only save that matters for what persists — now calls
 * window.GilbaNutritionSummary.renderNutritionSummary() directly,
 * synchronously, immediately after _ensureMonthlyNormalsBounded() resolves
 * and immediately before cacheAnalysisResults() reads
 * window.__GAIP_MONTHLY_N__. This guarantees one last, direct computation
 * attempt using whatever soil/climate state is available at the latest
 * possible moment before persisting, independent of whether any specific
 * reactive listener happened to fire at the right time.
 */

'use strict';

const fs = require('fs');
const path = require('path');

const src = fs.readFileSync(path.join(__dirname, '../assets/hub-persistence.js'), 'utf8');

describe('GH-298 — _doRerunSync forces a direct renderNutritionSummary() call before caching', () => {
    test('_doRerunSync calls window.GilbaNutritionSummary.renderNutritionSummary() between the bounded wait and cacheAnalysisResults()', () => {
        const idx = src.indexOf('async function _doRerunSync(source)');
        expect(idx).toBeGreaterThan(-1);
        const body = src.slice(idx, idx + 2500);

        const awaitIdx = body.indexOf('await _ensureMonthlyNormalsBounded()');
        const renderIdx = body.indexOf('window.GilbaNutritionSummary.renderNutritionSummary()');
        // Search for the real call site AFTER the render call — earlier
        // occurrences inside this function's own explanatory comment
        // (mentioning cacheAnalysisResults() by name) would otherwise match
        // first and give a false-low index.
        const cacheIdx = body.indexOf('var snap    = cacheAnalysisResults();', renderIdx);

        expect(awaitIdx).toBeGreaterThan(-1);
        expect(renderIdx).toBeGreaterThan(-1);
        expect(cacheIdx).toBeGreaterThan(-1);
        expect(renderIdx).toBeGreaterThan(awaitIdx);
        expect(cacheIdx).toBeGreaterThan(renderIdx);
    });

    test('the render call is guarded (checks GilbaNutritionSummary and the method exist) and wrapped in try/catch', () => {
        const idx = src.indexOf('window.GilbaNutritionSummary.renderNutritionSummary()');
        expect(idx).toBeGreaterThan(-1);
        const before = src.slice(Math.max(0, idx - 250), idx);
        const after = src.slice(idx, idx + 200);

        expect(before).toMatch(/if\s*\(window\.GilbaNutritionSummary\s*&&\s*typeof window\.GilbaNutritionSummary\.renderNutritionSummary === 'function'\)/);
        expect(before + after).toMatch(/try\s*{/);
        expect(before + after).toMatch(/catch\s*\(e\)/);
    });

    test('other _doRerunSync behaviour (bounded wait, non-async cacheAnalysisResults, sibling call sites) is unchanged from GH-251', () => {
        expect(src).toMatch(/function _withTimeout\(promise, ms\)/);
        expect(src).toMatch(/(?<!async )function cacheAnalysisResults\(\)/);
        const sensorIdx = src.indexOf("document.addEventListener('gaip:sensor-upgrade-complete'");
        expect(sensorIdx).toBeGreaterThan(-1);
        const sensorBody = src.slice(sensorIdx, sensorIdx + 400);
        expect(sensorBody).not.toMatch(/renderNutritionSummary/);
    });
});

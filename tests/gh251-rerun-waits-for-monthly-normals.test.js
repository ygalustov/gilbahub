/**
 * GH-251 — Re-run flow gives climate normals a bounded chance to resolve
 * before caching, instead of always omitting GH-250's monthlyNormal field.
 *
 * Background: `computed.climate.growth.monthlyNormal` (GH-250) reads
 * `climateMetrics.monthlyTemps`, resolved fire-and-forget by
 * GilbaClimateNormalsService alongside the live weather fetch. Confirmed in
 * production (via `window.GAIP_DASHBOARD_DATA.computed.climate.growth.monthlyNormal`
 * on `/analysis` after a real Re-run) that it came back `undefined` — the
 * fast-path 3s timer fired and cached the analysis before the NASA POWER/
 * Open-Meteo round-trip had completed, since `gaip:weather-ready`/
 * `gaip:orchestrator-complete` mark the START of that fetch, not its finish.
 *
 * Fix: `_doRerunSync()` now awaits a bounded (4s) `ensureFromPage()` call
 * before building the cache. Bounded, not a bare await, because the NASA
 * POWER/Open-Meteo fetch chain has no timeout of its own in
 * climate-normals-service.js — an unbounded wait here could stall the whole
 * Re-run (soil/water/PGR/etc., not just this one field) on a hanging
 * request. `cacheAnalysisResults()` itself stays synchronous/unchanged —
 * only `_doRerunSync` (the fast/slow-path Re-run trigger, called
 * fire-and-forget from setTimeout callbacks) became async, so its two
 * sibling call sites (`GilbaPersistence.save()`'s frequent autosave path,
 * and the `gaip:sensor-upgrade-complete` re-sync) are untouched — they don't
 * need or want the extra wait.
 */

'use strict';

const fs = require('fs');
const path = require('path');

const src = fs.readFileSync(path.join(__dirname, '../assets/hub-persistence.js'), 'utf8');

describe('GH-251 — _doRerunSync awaits bounded climate-normals resolution', () => {
    test('_doRerunSync is async and awaits _ensureMonthlyNormalsBounded before cacheAnalysisResults()', () => {
        const idx = src.indexOf('async function _doRerunSync(source)');
        expect(idx).toBeGreaterThan(-1);
        const body = src.slice(idx, idx + 400);
        expect(body).toMatch(/await _ensureMonthlyNormalsBounded\(\)/);
        // The await must come BEFORE cacheAnalysisResults() is called.
        const awaitIdx = body.indexOf('await _ensureMonthlyNormalsBounded()');
        const cacheIdx = body.indexOf('cacheAnalysisResults()');
        expect(awaitIdx).toBeGreaterThan(-1);
        expect(cacheIdx).toBeGreaterThan(awaitIdx);
    });

    test('the wait is bounded via Promise.race with a timeout, not a bare await', () => {
        expect(src).toMatch(/function _withTimeout\(promise, ms\)/);
        const idx = src.indexOf('function _withTimeout(promise, ms)');
        const body = src.slice(idx, idx + 250);
        expect(body).toMatch(/Promise\.race\(/);
        expect(body).toMatch(/setTimeout\(resolve, ms\)/);
    });

    test('_ensureMonthlyNormalsBounded calls ensureFromPage through _withTimeout with a concrete ms bound', () => {
        const idx = src.indexOf('async function _ensureMonthlyNormalsBounded()');
        expect(idx).toBeGreaterThan(-1);
        // GH-251 diagnostic logging (added after production testing showed
        // monthlyNormal still missing) pushed the actual await further into
        // the function body — widen the window accordingly.
        const body = src.slice(idx, idx + 1200);
        expect(body).toMatch(/_withTimeout\(svc\.ensureFromPage\(\),\s*\d+\)/);
    });

    test('failure/timeout is caught — never throws out of _doRerunSync', () => {
        const idx = src.indexOf('async function _ensureMonthlyNormalsBounded()');
        const body = src.slice(idx, idx + 1200);
        expect(body).toMatch(/catch\s*\(e\)/);
    });

    test('cacheAnalysisResults() itself stays a plain (non-async) function — its other callers are unaffected', () => {
        expect(src).toMatch(/(?<!async )function cacheAnalysisResults\(\)/);
    });

    test('GilbaPersistence.save() call site is untouched (no await added)', () => {
        const idx = src.indexOf('const cache = cacheAnalysisResults();');
        expect(idx).toBeGreaterThan(-1);
        expect(src.slice(idx - 20, idx)).not.toMatch(/await\s*$/);
    });

    test('gaip:sensor-upgrade-complete handler call site is untouched (no await added)', () => {
        const idx = src.indexOf("document.addEventListener('gaip:sensor-upgrade-complete'");
        expect(idx).toBeGreaterThan(-1);
        const body = src.slice(idx, idx + 400);
        expect(body).toMatch(/var snap\s*=\s*cacheAnalysisResults\(\);/);
        expect(body).not.toMatch(/await cacheAnalysisResults/);
    });
});

// ─────────────────────────────────────────────────────────────────────────────
// Direct behavioral test of the timeout-race shape (re-derived from the pinned
// source above — Promise.race(promise, timeout) resolves with whichever settles
// first, so a slow/hanging inner promise never blocks past the bound).
// ─────────────────────────────────────────────────────────────────────────────

describe('GH-251 — Promise.race timeout-bound shape behaves as intended', () => {
    function withTimeout(promise, ms) {
        return Promise.race([
            promise,
            new Promise((resolve) => setTimeout(resolve, ms))
        ]);
    }

    test('resolves quickly when the inner promise resolves before the bound', async () => {
        // Small bound (not a realistic 4000ms) so the losing race branch's
        // own setTimeout — Promise.race doesn't cancel it — clears itself
        // almost immediately rather than lingering as an open handle.
        const fast = new Promise((resolve) => setTimeout(() => resolve('done'), 10));
        const result = await withTimeout(fast, 100);
        expect(result).toBe('done');
    });

    test('resolves at the bound (not hanging) when the inner promise never resolves', async () => {
        var innerTimer;
        // "Never settles within the test" rather than a literally-dangling
        // promise — avoids leaking an open handle past the test's own timeout.
        var hanging = new Promise((resolve) => { innerTimer = setTimeout(resolve, 60000); });
        const start = Date.now();
        const result = await withTimeout(hanging, 50);
        clearTimeout(innerTimer);
        expect(Date.now() - start).toBeLessThan(500); // bounded, not indefinite
        expect(result).toBeUndefined(); // timeout branch resolves with no value
    });
});

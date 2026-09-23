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
const { anchoredSlice, anchoredWindow, anchorIndex } = require('./lib/anchored-slice');

const src = fs.readFileSync(path.join(__dirname, '../assets/hub-persistence.js'), 'utf8');

describe('GH-251 — _doRerunSync awaits bounded climate-normals resolution', () => {
    /**
     * GH-547 (stage 2): the invariant moved, it did not go. `_doRerunSync`
     * is gone — it was the timer-driven writer, fired three seconds after the
     * engines spoke or ten seconds after load whether they had or not. The one
     * write now happens in `_writeResult`, reached only when the run completed.
     *
     * What GH-251 protects is unchanged and is asserted against that function:
     * the monthly normals get their bounded chance BEFORE the result is built,
     * because `ensureFromPage()` resolves fire-and-forget alongside the weather
     * fetch and `gaip:weather-ready` marks the START of it.
     */
    test('the single write awaits _ensureMonthlyNormalsBounded before cacheAnalysisResults()', () => {
        const idx = src.indexOf('async function _writeResult()');
        expect(idx).toBeGreaterThan(-1);
        const body = src.slice(idx, idx + 1600);
        expect(body).toMatch(/await _ensureMonthlyNormalsBounded\(\)/);
        // The await must come BEFORE cacheAnalysisResults() is called.
        const awaitIdx = body.indexOf('await _ensureMonthlyNormalsBounded()');
        const cacheIdx = body.indexOf('cacheAnalysisResults()');
        expect(awaitIdx).toBeGreaterThan(-1);
        expect(cacheIdx).toBeGreaterThan(awaitIdx);
    });

    test('the wait is bounded via Promise.race with a timeout, not a bare await', () => {
        expect(src).toMatch(/function _withTimeout\(promise, ms\)/);
        const body = anchoredWindow(src, 'function _withTimeout(promise, ms)', 250);
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

    /**
     * GH-548 (stage 3): this test's subject is gone, and again what
     * replaces it is stronger.
     *
     * It asserted that `save()` calls `cacheAnalysisResults()` WITHOUT an
     * `await` — the point being that GH-251's bounded wait must not turn the
     * ordinary state save into an async one. `save()` does not call it at all
     * now: the copy of the result it kept in `localStorage`
     * (`gilba_hub_cache`, K1 of the plan's browser-copy list) is gone, so the
     * only thing that assembles a result is the run that writes it.
     *
     * "No await was added" is contained in "the call is not there", and the
     * second is the property worth guarding, so it is what is asserted.
     */
    test('save() does not assemble an analysis result at all', () => {
        const saveIdx = src.indexOf('save: function() {');
        expect(saveIdx).toBeGreaterThan(-1);
        const body = src.slice(saveIdx, src.indexOf('\n        },', saveIdx));
        expect(body).not.toMatch(/cacheAnalysisResults\(/);
        expect(body).not.toMatch(/CONFIG\.keys\.cache/);
        // The form's own state and preferences are NOT the result and stay.
        expect(body).toMatch(/CONFIG\.keys\.state/);
        expect(body).toMatch(/CONFIG\.keys\.prefs/);
    });

    /**
     * GH-547 (stage 2): this test's subject is gone and what replaces it is
     * stronger, so it is rewritten rather than removed.
     *
     * It used to check that the `gaip:sensor-upgrade-complete` re-sync had not
     * accidentally acquired an `await` — that is, that GH-251's change had been
     * confined to one of the two writers. There is no second writer to confine
     * it to: the re-sync posted a SECOND result for the same run, and if a late
     * sensor reading changes the answer it belongs to the run and goes in the
     * one send at the end of it.
     *
     * So the thing worth guarding is no longer "the other call site is
     * untouched" but "there is no other call site". One POST to the route in the
     * whole file, and nothing listening for the sensor event.
     */
    test('there is no second writer for the same run', () => {
        expect(src).not.toMatch(/addEventListener\(\s*['"]gaip:sensor-upgrade-complete['"]/);
        // One place in the file posts the analysis RESULT. GH-548 added a
        // second route to the same storage -- `analysis-cache/runs`, where a
        // run reports that it did not finish -- so the match is anchored on the
        // closing quote: a pattern that also caught `/runs` would count a
        // failure report as a second writer and this assertion would be about
        // nothing.
        const posts = src.match(/'analysis-cache'/g) || [];
        expect(posts.length).toBe(1);
        // And it is inside the completion path, not a timer or a save.
        const writeIdx = src.indexOf('async function _writeResult()');
        const postIdx = src.indexOf("'analysis-cache'");
        expect(postIdx).toBeGreaterThan(writeIdx);
        // The failure report is the other way round: exactly one, and it is in
        // the failure path, not in the write.
        expect((src.match(/'analysis-cache\/runs'/g) || []).length).toBe(1);
        expect(src.indexOf("'analysis-cache/runs'")).toBeLessThan(writeIdx);
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

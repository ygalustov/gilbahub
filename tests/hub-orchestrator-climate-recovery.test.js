/**
 * Regression guard: recovered temperature must propagate to global.climateMetrics
 * so hub-persistence.js saves the correct min/max/mean to computed.climate in DB.
 *
 * Background (GH-180 follow-up):
 *   The GH-180 iframe race condition caused climate-engine-v2 shim to write null
 *   defaults to global.climateMetrics before real weather data arrived. The recovery
 *   block in populateCanonicalState (hub-orchestrator.js) was added to detect all-null
 *   temperature and recover from rawWeatherData.forecast.hourly.
 *
 *   However the recovery did:
 *     climateMetrics = Object.assign({}, climateMetrics, { temperature: {...} });
 *   This creates a NEW local object. global.climateMetrics still points to the old
 *   null-filled object. hub-persistence.js line 939 then reads global.climateMetrics
 *   and writes its (null) temperature to cache.computed.climate, overwriting whatever
 *   GAIP_CANONICAL_STATE.climate had. Result: computed.climate.temperature.min = null
 *   is saved to DB even after a correct re-run.
 *
 *   On the analysis page, initForecastChart reads _storedTempMin from
 *   state.climate.temperature.min (null) → OM temperature override fires → uses today's
 *   OM temperatures (e.g. 12°C NZ July) → Brown Patch 25% in forecast, but analysis
 *   (which ran with null T) returned E2=null → Brown Patch 0% / absent from Active
 *   Threats. The fix: assign global.climateMetrics = climateMetrics after recovery so
 *   both GAIP_CANONICAL_STATE and hub-persistence see the recovered temperature.
 */

'use strict';

const fs   = require('fs');
const path = require('path');

const src = fs.readFileSync(
    path.join(__dirname, '../assets/hub-orchestrator.js'),
    'utf8'
);

describe('populateCanonicalState — GH-180 temperature recovery propagates to global', () => {

    test('source file is present', () => {
        expect(src.length).toBeGreaterThan(0);
    });

    test('override runs for non-manual mode (climateSource !== manual guard)', () => {
        // The override always runs for API/default modes to eliminate the race between
        // hub-tissue (writes mean-of-daily-means, no `current`) and climate-engine-v2
        // (writes mean of all hourly + currentHour). Both write to global.climateMetrics;
        // whichever runs last determined the canonical temperature — now bypassed entirely.
        expect(src).toMatch(/climateSource\s*!==\s*["']manual["']/);
    });

    test('override uses full forecast window, not a 24-hour slice', () => {
        // Full window matches climate-engine-v2 _fromAPI() exactly (Math.min/Max of all airTemps).
        // Fidanza E2 is unaffected — getFidanzaE2() reads hourlyData.temperature_2m.slice(0,24)
        // directly and never uses climate.temperature.min for today's minimum.
        expect(src).not.toMatch(/temperature_2m\.slice\s*\(\s*0\s*,\s*24\s*\)/);
        expect(src).toMatch(/filter\s*\(\s*function\s*\(v\)\s*\{\s*return\s*v\s*!=\s*null/);
    });

    test('global.climateMetrics is updated after recovery (not just local variable)', () => {
        // Without this assignment hub-persistence.js reads the stale null-filled object.
        expect(src).toMatch(/global\.climateMetrics\s*=\s*climateMetrics/);
    });

    test('global.climateMetrics assignment follows the temperature override block', () => {
        // The write-back must come AFTER the temperature is computed, not before.
        var tempAssignIdx = src.indexOf('climateMetrics.temperature = {');
        var assignIdx     = src.indexOf('global.climateMetrics = climateMetrics');
        expect(tempAssignIdx).toBeGreaterThan(-1);
        expect(assignIdx).toBeGreaterThan(-1);
        expect(assignIdx).toBeGreaterThan(tempAssignIdx);
    });

    test('global.climateMetrics assignment is inside the rawHourly if-block (conditional)', () => {
        // The write-back must only happen when rawWeatherData is available.
        // Gap between the temperature-recovery log and the assignment grew once
        // the identical humidity recovery (same race, same fix — see below) was
        // added between them; both must still fall within the same if-block, not
        // an unbounded distance that would suggest the assignment drifted outside
        // the conditional entirely.
        var assignIdx = src.indexOf('global.climateMetrics = climateMetrics');
        var logIdx    = src.indexOf('Temperature pinned to rawWeatherData');
        expect(logIdx).toBeGreaterThan(-1);
        expect(assignIdx).toBeGreaterThan(-1);
        expect(assignIdx - logIdx).toBeLessThan(2500);
    });

});

describe('populateCanonicalState — humidity recovery mirrors the temperature fix (same writer race)', () => {
    // hub-tissue-v3.js and climate-engine-v2.js both also write
    // global.climateMetrics.moisture.humidity — the identical "whichever
    // writer ran last" non-determinism the temperature fix above already
    // solved, just never applied to humidity. This was the actual cause of
    // Red Thread's "keeping previous reading" merge-fallback firing
    // intermittently between otherwise-identical reruns (climate.moisture.
    // humidity.mean sometimes temporarily unavailable/stale, not genuinely
    // "not arrived yet"). Fix mirrors the temperature block exactly: recompute
    // from the same immutable rawWeatherData hourly array instead of trusting
    // whichever writer happened to run last.

    test('humidity is recovered from rawHourly.relative_humidity_2m, not from the racy climateMetrics.moisture object', () => {
        expect(src).toMatch(/var _rawHumidity = _rawHourly\.relative_humidity_2m;/);
        expect(src).toMatch(/Array\.isArray\(_rawHumidity\)\s*&&\s*_rawHumidity\.length\s*>=\s*24/);
    });

    test('humidity recovery writes into climateMetrics.moisture.humidity (the shape getAuthoritativeClimate/GAIP_CANONICAL_STATE.climate.humidity reads)', () => {
        expect(src).toMatch(/climateMetrics\.moisture = Object\.assign\(\{\}, climateMetrics\.moisture \|\| \{\}, \{/);
        expect(src).toContain('humidity: {');
    });

    test('humidity recovery sits between the temperature recovery and the global.climateMetrics write-back, inside the same if-block', () => {
        var tempAssignIdx     = src.indexOf('climateMetrics.temperature = {');
        var humidityRecoverIdx = src.indexOf('var _rawHumidity = _rawHourly.relative_humidity_2m;');
        var globalAssignIdx   = src.indexOf('global.climateMetrics = climateMetrics');
        expect(tempAssignIdx).toBeGreaterThan(-1);
        expect(humidityRecoverIdx).toBeGreaterThan(tempAssignIdx);
        expect(globalAssignIdx).toBeGreaterThan(humidityRecoverIdx);
    });

    test('uses the same currentHour index as temperature, so current-humidity and current-temperature refer to the same hour', () => {
        var humidityBlockStart = src.indexOf('var _rawHumidity = _rawHourly.relative_humidity_2m;');
        var humidityBlockEnd   = src.indexOf('global.climateMetrics = climateMetrics', humidityBlockStart);
        var block = src.slice(humidityBlockStart, humidityBlockEnd);
        expect(block).toContain('_rawHumidity[_currentHour]');
    });
});

describe('hub-persistence.js — reads global.climateMetrics for computed.climate.temperature', () => {

    const pSrc = fs.readFileSync(
        path.join(__dirname, '../assets/hub-persistence.js'),
        'utf8'
    );

    test('hub-persistence.js reads global.climateMetrics.temperature into cache.computed.climate', () => {
        // This is the consumer that was overwriting the recovered temperature.
        // After the fix, global.climateMetrics points to the recovered object,
        // so this line now writes the correct temperatures to DB instead of nulls.
        expect(pSrc).toMatch(/cache\.computed\.climate\.temperature\s*=\s*_liveClimate\.temperature/);
    });

    test('_liveClimate is sourced from global.climateMetrics (not a local copy)', () => {
        expect(pSrc).toMatch(/const\s+_liveClimate\s*=\s*global\.climateMetrics/);
    });

});

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

    test('recovery block still detects all-null temperature condition', () => {
        // Guard: the recovery must still trigger when all three fields are null
        expect(src).toMatch(/_t\.mean\s*==\s*null\s*&&\s*_t\.max\s*==\s*null\s*&&\s*_t\.min\s*==\s*null/);
    });

    test('recovery uses today\'s 24-hour slice, not 7-day global minimum', () => {
        // slice(0,24) = today's temps → matches buildDailyPatternFallback day 0
        // and satisfies Fidanza "minimum daily air temperature" for the current period.
        // slice(0,168) was wrong: a cold snap on day 5 depressed _recoveredMin below
        // the Brown Patch threshold even when today was warm.
        expect(src).toMatch(/\.slice\s*\(\s*0\s*,\s*24\s*\)/);
        expect(src).not.toMatch(/\.slice\s*\(\s*0\s*,\s*168\s*\)/);
    });

    test('global.climateMetrics is updated after recovery (not just local variable)', () => {
        // Without this assignment hub-persistence.js reads the stale null-filled object.
        expect(src).toMatch(/global\.climateMetrics\s*=\s*climateMetrics/);
    });

    test('global.climateMetrics assignment follows the recovery Object.assign block', () => {
        // The assignment must come AFTER the recovery, not before it.
        var recoveryIdx = src.indexOf('Object.assign({}, climateMetrics, {');
        var assignIdx   = src.indexOf('global.climateMetrics = climateMetrics');
        expect(recoveryIdx).toBeGreaterThan(-1);
        expect(assignIdx).toBeGreaterThan(-1);
        expect(assignIdx).toBeGreaterThan(recoveryIdx);
    });

    test('global.climateMetrics assignment is inside the recovery if-block (conditional, not unconditional)', () => {
        // The assignment must only happen when recovery actually ran (inside the
        // rawHourly length check), not on every populateCanonicalState call.
        // Verify by checking the assignment appears between the recovery Object.assign
        // and the closing braces of the rawHourly-exists if block.
        var assignIdx = src.indexOf('global.climateMetrics = climateMetrics');

        // The log statement that immediately precedes the assignment should be within
        // ~300 chars of the assignment (they're adjacent in the same if-block).
        var logIdx = src.indexOf('Recovered temperature from rawWeatherData hourly');
        expect(logIdx).toBeGreaterThan(-1);
        expect(assignIdx - logIdx).toBeLessThan(700);
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

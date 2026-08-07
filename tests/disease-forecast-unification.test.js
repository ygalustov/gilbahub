/**
 * Disease 7-day forecast unification
 *
 * Background: the forecast was computed twice, independently, producing
 * different numbers for the same disease on the same day — dashboard showed
 * "Red Thread Peak: 58% in 2 days" while the analysis page showed "Peak: Red
 * Thread 41% on day 6" for the same site/run.
 *
 *   - Legacy path (/hub page + dashboard-ui.js's hidden re-run iframe):
 *     disease-ui.js -> disease-integration.js -> disease-forecast.js's
 *     DiseaseForecast.render(), fed from window.GAIP_STATE. Synthetic
 *     sinusoidal weather, no stress-coupling, missing mowingData/
 *     tissueNutrients. Wrote window.GAIP_DISEASE_FORECAST, which
 *     hub-persistence.js persisted and /dashboard displayed.
 *   - Analysis-page path (disease-analysis.js's initForecastChart()): its own
 *     live Open-Meteo fetch + hand-built state + direct generateForecast()
 *     call. Real weather + stress-coupling + correct mowing/tissue — more
 *     accurate, but never persisted anywhere, recomputed every page load.
 *
 * Fix: compute the forecast once, in hub-orchestrator.js's computeAll(),
 * immediately after "diseases today" (Step 6) — mirroring how "today" is
 * already a single computed-once, persisted-once, read-everywhere value.
 * Persist it automatically via the existing analysis_cache flow
 * (_hubState.computed.forecast flows through cacheAnalysisResults() with no
 * extra plumbing). hub-persistence.js's collectDashboardMetrics() and
 * disease-analysis.js's initForecastChart() both now read that one persisted
 * value instead of computing their own.
 *
 * hub-orchestrator.js and disease-analysis.js are large non-module IIFEs
 * with heavy DOM/global dependencies (matches the existing test style in
 * tests/hub-orchestrator-disease-incomplete-climate-guard.test.js and
 * tests/forecast-chart-stale-db-bypass.test.js) — these are static
 * source-structure assertions, not a behavioural execution test.
 *
 * Spec: tests/disease-forecast-unification.test.js
 */

'use strict';

const fs   = require('fs');
const path = require('path');

const orchestratorSrc = fs.readFileSync(path.join(__dirname, '../assets/hub-orchestrator.js'), 'utf8');
const persistenceSrc  = fs.readFileSync(path.join(__dirname, '../assets/hub-persistence.js'), 'utf8');
const analysisSrc     = fs.readFileSync(path.join(__dirname, '../assets/disease-analysis.js'), 'utf8');

function extractStep9() {
    const start = orchestratorSrc.indexOf('log("main", "Step 9: Disease forecast (7-day)")');
    expect(start).toBeGreaterThan(-1);
    const end = orchestratorSrc.indexOf('// 10. IRRIGATION SCHEDULING', start);
    expect(end).toBeGreaterThan(start);
    return orchestratorSrc.slice(start, end);
}

describe('hub-orchestrator.js — Step 9 computes the canonical 7-day forecast once', () => {

    test('_diseaseFreshThisPass is declared ahead of the disease write and set true only after it', () => {
        const step6Start = orchestratorSrc.indexOf('log("main", "Step 6: Disease analysis")');
        expect(step6Start).toBeGreaterThan(-1);
        const declIdx = orchestratorSrc.indexOf('let _diseaseFreshThisPass = false;');
        expect(declIdx).toBeGreaterThan(step6Start - 1);
        expect(declIdx - step6Start).toBeLessThan(60);

        const diseaseWriteIdx = orchestratorSrc.indexOf('_hubState.computed.disease = wrapWithConfidence("disease", coupledResult);');
        expect(diseaseWriteIdx).toBeGreaterThan(-1);
        const setTrueIdx = orchestratorSrc.indexOf('_diseaseFreshThisPass = true;', diseaseWriteIdx);
        expect(setTrueIdx).toBeGreaterThan(diseaseWriteIdx);
        expect(setTrueIdx - diseaseWriteIdx).toBeLessThan(100);
    });

    test('Step 9 is guarded by _diseaseFreshThisPass — skips (keeps previous forecast) when Step 6 held the previous disease result', () => {
        const step9 = extractStep9();
        expect(step9).toMatch(/if\s*\(\s*_diseaseFreshThisPass\s*&&\s*global\.DiseaseForecast/);
        expect(step9).toMatch(/else if\s*\(\s*!_diseaseFreshThisPass\s*\)/);
        expect(step9).toContain('keeping previous computed.forecast');
    });

    test('no new Open-Meteo fetch is added — reuses already-fetched global.rawWeatherData', () => {
        const step9 = extractStep9();
        expect(step9).not.toMatch(/fetch\(/);
        expect(step9).not.toMatch(/api\.open-meteo\.com/);
        expect(step9).toMatch(/global\.rawWeatherData/);
    });

    test('forecastState carries the fields generateForecast() needs that plain buildDiseaseInputs() output lacks', () => {
        const step9 = extractStep9();
        expect(step9).toMatch(/forecastHourly:\s*forecastHourly/);
        expect(step9).toMatch(/day0ActiveThreats:\s*day0ActiveThreats/);
        expect(step9).toMatch(/cachedDiseaseSpecies:\s*\(_hubState\.computed\.disease/);
        expect(step9).toMatch(/stressAggregates:\s*fcInputs\.stressAggregates/);
        expect(step9).toMatch(/mowingData:\s*fcInputs\.mowing/);
        expect(step9).toMatch(/tissueNutrients:\s*fcInputs\.tissueNutrients/);
    });

    test('climateForForecast is a copy with dailyPattern stripped, not an in-place mutation of shared state', () => {
        const step9 = extractStep9();
        expect(step9).toMatch(/const\s+climateForForecast\s*=\s*Object\.assign\(\{\},\s*fcInputs\.climate\)/);
        expect(step9).toMatch(/delete\s+climateForForecast\.temperature\.dailyPattern/);
        expect(step9).toMatch(/climateForForecast\.moisture\s*=\s*Object\.assign\(\{\},\s*climateForForecast\.moisture/);
    });

    test('humidity falls back to the mean of hourlyData.relative_humidity_2m when this pass\'s climate humidity is missing', () => {
        // Regression: Red Thread has no leaf-wetness fallback (unlike Fusarium/
        // BrownPatch/Anthracnose/DrechsleraPoae) — its humidityFactor reads
        // climate.moisture.humidity.mean directly. Step 9 reads the SAME
        // in-flight climate object Step 6 uses, so on a pass where humidity is
        // transiently null (the exact race the Red Thread merge-fallback above
        // protects "today" against), an unguarded Step 9 would crash Red
        // Thread's forecast to ~0% for every day 1-6 (period-mean humidity is
        // reused across all days). Falling back to the real hourly RH average
        // (already attached by getAuthoritativeClimate() as .hourlyData) fixes
        // this without needing a new fetch.
        const step9 = extractStep9();
        expect(step9).toMatch(/_existingHumidity\s*&&\s*_existingHumidity\.mean\s*!=\s*null/);
        expect(step9).toMatch(/climateForForecast\.hourlyData\s*&&\s*climateForForecast\.hourlyData\.relative_humidity_2m/);
        expect(step9).toMatch(/humidity:\s*_existingHumidity[\s\S]{0,80}\?\s*_existingHumidity\s*:\s*\(_fallbackHumidity/);
    });

    test('day0ActiveThreats is derived from the disease result Step 6 just wrote this pass', () => {
        const step9 = extractStep9();
        expect(step9).toMatch(/_hubState\.computed\.disease\s*&&\s*_hubState\.computed\.disease\.diseases/);
    });

    test('result is written to _hubState.computed.forecast via wrapWithConfidence, only on success', () => {
        const step9 = extractStep9();
        expect(step9).toMatch(/const forecastResult = global\.DiseaseForecast\.generateForecast\(forecastState\);/);
        expect(step9).toMatch(/if\s*\(forecastResult\s*&&\s*!forecastResult\.error\)\s*\{[\s\S]{0,200}_hubState\.computed\.forecast\s*=\s*wrapWithConfidence\("forecast",\s*forecastResult\)/);
    });

    test('errors are caught and do not clear the previous computed.forecast', () => {
        const step9 = extractStep9();
        expect(step9).toMatch(/\}\s*catch\s*\(e\)\s*\{[\s\S]{0,150}keeping previous computed\.forecast/);
    });

    test('second buildDiseaseInputs() call site (computeSelective/executeEngine) is untouched — no forecast step added there', () => {
        // That path's completion event (gaip:selective-compute-complete) isn't
        // wired into hub-persistence.js's auto-save event list, so nothing would
        // ever persist a forecast computed there — adding Step 9 there would be
        // wasted work with no consumer.
        const secondCallIdx = orchestratorSrc.indexOf('buildDiseaseInputs()', orchestratorSrc.indexOf('"disease-engine"'));
        expect(secondCallIdx).toBeGreaterThan(-1);
        const nearby = orchestratorSrc.slice(secondCallIdx, secondCallIdx + 1500);
        expect(nearby).not.toMatch(/Step 9: Disease forecast/);
    });

});

describe('hub-persistence.js — dashboard forecast metrics read the orchestrator-computed forecast, not the legacy global', () => {

    test('collectDashboardMetrics() no longer reads window.GAIP_DISEASE_FORECAST', () => {
        const start = persistenceSrc.indexOf('function collectDashboardMetrics()');
        expect(start).toBeGreaterThan(-1);
        const end = persistenceSrc.indexOf('function getCachedResults()', start);
        expect(end).toBeGreaterThan(start);
        const body = persistenceSrc.slice(start, end);
        expect(body).not.toContain('global.GAIP_DISEASE_FORECAST');
        expect(body).toMatch(/global\.GaipOrchestrator[\s\S]{0,150}getState\(\)\?\.computed\?\.forecast/);
    });

});

describe('disease-analysis.js — initForecastChart() reads the persisted forecast instead of recomputing it', () => {

    function extractInitForecastChart() {
        const start = analysisSrc.indexOf('function initForecastChart()');
        expect(start).toBeGreaterThan(-1);
        // Brace-count to the matching close.
        let depth = 0, begun = false, end = -1;
        for (let i = start; i < analysisSrc.length; i++) {
            if (analysisSrc[i] === '{') { depth++; begun = true; }
            if (analysisSrc[i] === '}') depth--;
            if (begun && depth === 0) { end = i + 1; break; }
        }
        expect(end).toBeGreaterThan(start);
        return analysisSrc.slice(start, end);
    }

    test('no longer calls DiseaseForecast.generateForecast() nor builds its own state object', () => {
        const body = extractInitForecastChart();
        expect(body).not.toMatch(/DiseaseForecast\.generateForecast/);
        expect(body).not.toMatch(/var\s+state\s*=\s*\{/);
        expect(body).not.toMatch(/var\s+storedClimate\s*=/);
    });

    test('reads GAIP_DASHBOARD_DATA.computed.forecast, gated by !staticChart', () => {
        const body = extractInitForecastChart();
        const readIdx = body.indexOf('global.GAIP_DASHBOARD_DATA.computed.forecast');
        expect(readIdx).toBeGreaterThan(-1);
        const guardIdx = body.lastIndexOf('if (!staticChart)', readIdx);
        expect(guardIdx).toBeGreaterThan(-1);
        expect(readIdx - guardIdx).toBeLessThan(200);
    });

    test('the Open-Meteo fetch survives (still needed for the dew forecast block) but no longer feeds the disease chart', () => {
        const body = extractInitForecastChart();
        expect(body).toMatch(/fetch\(url\)/);
        expect(body).toMatch(/api\.open-meteo\.com/);
        // The fetch's .then() chain must not contain the forecast-chart series
        // build (renderForecastChartFromSeries) — that now runs synchronously
        // before the fetch even starts.
        const fetchIdx = body.indexOf('fetch(url)');
        const seriesIdx = body.indexOf('renderForecastChartFromSeries(series');
        expect(seriesIdx).toBeGreaterThan(-1);
        expect(seriesIdx).toBeLessThan(fetchIdx);
    });

    test('fetch .catch() no longer wipes the disease forecast wrap on a network failure', () => {
        const body = extractInitForecastChart();
        const catchIdx = body.lastIndexOf('.catch(function ()');
        expect(catchIdx).toBeGreaterThan(-1);
        const catchBody = body.slice(catchIdx, catchIdx + 400);
        expect(catchBody).not.toMatch(/dr-forecast-wrap/);
    });

});

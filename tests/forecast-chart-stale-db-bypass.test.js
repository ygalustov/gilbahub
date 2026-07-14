/**
 * Regression guard: buildForecastSeries must not consume the global d.forecast
 * array from DB to render a static chart.
 *
 * Background: GAIP_DASHBOARD_DATA.computed.disease.forecast (d.forecast) is a
 * top-level forecast array saved during the analysis run. It can carry stale data
 * — e.g. Brown Patch at 25% from a run where climate temperatures were null/wrong
 * (GH-180 iframe race condition). If buildForecastSeries used this array via the
 * `forecastArr.length > 1` branch, it built a static multi-point chart including
 * the stale Brown Patch series, set staticChart=true in initForecastChart, and
 * generateForecast was never called — so the fresh Open-Meteo forecast was skipped.
 *
 * Fix: the global forecastArr branch was removed. buildForecastSeries now:
 *   1. Uses per-disease .forecast arrays from filterDiseases output only
 *      (hasDiseaseForecasts path — safe because filterDiseases already excludes
 *      diseases with adjustedRisk=0, so Brown Patch in winter is never included).
 *   2. Falls back to synthesis: values:[cur] (1 point per disease) →
 *      renderForecastChart sees numPoints<2 → returns '' → dr-forecast-wrap
 *      placeholder is inserted in the DOM → initForecastChart finds it →
 *      staticChart=false → generateForecast called with fresh OM temperatures.
 */

'use strict';

const fs   = require('fs');
const path = require('path');

const src = fs.readFileSync(
    path.join(__dirname, '../assets/disease-analysis.js'),
    'utf8'
);

// Extract a named function's source by brace-counting from its declaration.
function extractFunctionSrc(source, fnName) {
    var start = source.indexOf('function ' + fnName + '(');
    if (start === -1) return null;
    var depth = 0, begun = false;
    for (var i = start; i < source.length; i++) {
        if (source[i] === '{') { depth++; begun = true; }
        if (source[i] === '}') depth--;
        if (begun && depth === 0) return source.slice(start, i + 1);
    }
    return null;
}

const buildForecastSeriesSrc = extractFunctionSrc(src, 'buildForecastSeries');
const renderForecastChartSrc = extractFunctionSrc(src, 'renderForecastChart');

// =============================================================================
// 1. buildForecastSeries — stale DB global array bypassed
// =============================================================================

describe('buildForecastSeries — stale DB global forecast array bypassed', () => {

    test('function is present in disease-analysis.js', () => {
        expect(buildForecastSeriesSrc).not.toBeNull();
    });

    test('global forecastArr.length > 1 path is absent', () => {
        // This branch previously used d.forecast from DB (unfiltered, potentially stale)
        // to produce a multi-point static chart. Removing it forces the dynamic path.
        expect(buildForecastSeriesSrc).not.toMatch(/forecastArr\.length\s*>\s*1/);
    });

    test('hasDiseaseForecasts path is intact — per-disease arrays from filtered list still used', () => {
        // This path only sees diseases from filterDiseases (adjustedRisk > 0), so
        // zero-risk diseases like Brown Patch in NZ winter are never included.
        expect(buildForecastSeriesSrc).toMatch(/hasDiseaseForecasts/);
    });

    test('hasDiseaseForecasts checks d.forecast.length > 1 on individual diseases', () => {
        // Per-disease forecast arrays are only trusted when they have multiple points.
        expect(buildForecastSeriesSrc).toMatch(/d\.forecast.*length\s*>\s*1/);
    });

    test('synthesis fallback produces single-point values per disease', () => {
        // values: [cur] → series[0].values.length === 1 → numPoints < 2 →
        // renderForecastChart returns '' → placeholder inserted → dynamic forecast runs.
        expect(buildForecastSeriesSrc).toMatch(/values\s*:\s*\[\s*cur\s*\]/);
    });

});

// =============================================================================
// 2. renderForecastChart — numPoints < 2 guard produces the placeholder
// =============================================================================

describe('renderForecastChart — numPoints < 2 guard produces dr-forecast-wrap placeholder', () => {

    test('function is present in disease-analysis.js', () => {
        expect(renderForecastChartSrc).not.toBeNull();
    });

    test('returns empty string when numPoints < 2', () => {
        // Single-point synthesis series → numPoints=1 < 2 → early return '' →
        // renderPage inserts dr-forecast-wrap placeholder → staticChart=false.
        expect(renderForecastChartSrc).toMatch(/numPoints\s*<\s*2[\s\S]{0,60}return\s+['"]{2}/);
    });

    test('no chart SVG is emitted when numPoints < 2 (guard fires before SVG geometry block)', () => {
        // VW/VH constants mark the start of the SVG rendering block.
        // The numPoints<2 guard must appear before them so no SVG is generated for
        // single-point series.
        var guardIdx = renderForecastChartSrc.search(/numPoints\s*<\s*2/);
        var svgIdx   = renderForecastChartSrc.indexOf('VW =');
        expect(guardIdx).toBeGreaterThan(-1);
        expect(svgIdx).toBeGreaterThan(-1);
        expect(guardIdx).toBeLessThan(svgIdx);
    });

});

// =============================================================================
// 3. initForecastChart — generateForecast conditional on placeholder existence
// =============================================================================

describe('initForecastChart — generateForecast gated by dr-forecast-wrap placeholder', () => {

    test('staticChart flag derived from absence of dr-forecast-wrap in DOM', () => {
        // staticChart=true  → renderForecastChart returned non-empty HTML (static chart present)
        // staticChart=false → placeholder present → generateForecast executes
        expect(src).toMatch(
            /staticChart\s*=\s*!document\.getElementById\s*\(\s*['"]dr-forecast-wrap['"]\s*\)/
        );
    });

    test('if (staticChart) return guard precedes DiseaseForecast.generateForecast call', () => {
        var generateIdx = src.indexOf('DiseaseForecast.generateForecast(state)');
        expect(generateIdx).toBeGreaterThan(-1);

        var guardIdx = src.lastIndexOf('if (staticChart) return', generateIdx);
        expect(guardIdx).toBeGreaterThan(-1);

        // Guard must be within 300 characters of the generateForecast call.
        expect(generateIdx - guardIdx).toBeLessThan(300);
    });

    test('rawWeatherData.forecast is NOT set from OM fetch (matches old hub behaviour)', () => {
        // Old hub rawWeatherData never has a forecast.hourly wrapper, so
        // buildDailyPatternFallback Try 1 always falls through to Try 2 which uses
        // climateMetrics.temperature.min (same historical period as the stored analysis).
        // Setting rawWeatherData.forecast caused the forecast to use current OM temps
        // (e.g. 12°C today) while the analysis used historical lookback (e.g. 5°C) →
        // Brown Patch 25% in forecast / 0% in Active Threats even after a correct re-run.
        expect(src).not.toMatch(/rawWeatherData\s*=\s*\{\s*forecast\s*:/);
    });

    test('forecast climate uses stored analysis temperature, not per-day OM temperature override', () => {
        // Stored climate is the source shared with Active Threats. Cached per-day
        // temperature.dailyPattern is stripped so DiseaseForecast regenerates from
        // the stored period climate instead of plotting saved or fresh OM day slices.
        expect(src).toMatch(/var\s+storedClimate\s*=/);
        expect(src).toMatch(/delete\s+climateForForecast\.temperature\.dailyPattern/);
        expect(src).not.toMatch(/_storedTempMin\s*==\s*null/);
        expect(src).not.toMatch(/_omMin/);
    });

});

// =============================================================================
// 4. Dynamic forecast — chart preserves forecast calculation identity
// =============================================================================

describe('initForecastChart — dynamic forecast preserves calculation identity', () => {

    test('dynamic forecast does not filter against Active Threats', () => {
        // Forecast-only diseases must remain visible so calculation mismatches are
        // exposed instead of being hidden by the dashboard presentation layer.
        expect(src).not.toMatch(/buildActiveForecastAnchors/);
        expect(src).not.toMatch(/findActiveForecastAnchor/);
        expect(src).not.toMatch(/if\s*\(\s*!activeAnchor\s*\)\s*return/);
    });

    test('today point remains the forecast-calculated value', () => {
        // The chart must show DiseaseForecast output. If day 0 differs from the
        // Active Threat card, that mismatch should stay visible for debugging.
        expect(src).toMatch(/values\s*=\s*disease\.forecast\.map/);
        expect(src).not.toMatch(/values\s*\[\s*0\s*\]\s*=\s*activeAnchor\.score/);
    });

    test('series label remains the forecast result name', () => {
        // Do not relabel Waitea or any other forecast disease in the chart.
        expect(src).toMatch(/name:\s*disease\.name/);
        expect(src).not.toMatch(/forecastDiseaseDisplayName/);
        expect(src).not.toMatch(/name:\s*activeAnchor\.name/);
    });

    test('peak label is recalculated from visible forecast series', () => {
        // The header must report the same forecast series the chart displays.
        var activePeakIdx = src.indexOf('var activePeak = null');
        var renderIdx = src.indexOf('renderForecastChartFromSeries(series, labels');
        expect(activePeakIdx).toBeGreaterThan(-1);
        expect(renderIdx).toBeGreaterThan(-1);
        expect(activePeakIdx).toBeLessThan(renderIdx);
        expect(src).toMatch(/renderForecastChartFromSeries\(series,\s*labels,\s*result\.forecastDays\s*\|\|\s*forecastArr\.length,\s*activePeak\)/);
    });

    test('forecast peak KPI uses the same filtered active peak', () => {
        expect(src).toMatch(/if\s*\(\s*kpiSlot\s*&&\s*activePeak\s*\)/);
        expect(src).toMatch(/renderForecastAlertCard\(activePeak,\s*currentScore\)/);
        expect(src).not.toMatch(/renderForecastAlertCard\(result\.summary,\s*currentScore\)/);
    });

});

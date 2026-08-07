/**
 * Fusarium excluded from the dashboard + Cultivar Performance (follow-up to b35fix91)
 *
 * The first pass at #91 (see tests/disease-fusarium-front-exclusion-b35fix91.test.js)
 * fixed overallScore/topThreats (disease-engine-pure.js, disease-stress-climate-
 * coupling.js) and the Active Threats list + companion surface on the disease
 * page (disease-analysis.js). User reported Fusarium was STILL visible after a
 * re-run in three more places, all on the main /dashboard page plus one on the
 * disease page itself:
 *
 *   1. Verdict banner + Disease Risk vital-card alert row + Action Queue
 *      "forecast X% in Yd" text — all read metrics.forecastPeak/forecastDisease/
 *      peakDay, which assets/hub-persistence.js's collectDashboardMetrics()
 *      populated straight from GAIP_DISEASE_FORECAST.summary — unfiltered,
 *      because disease-forecast.js's generateForecast() has no knowledge of the
 *      Fusarium exclusion (only the chart-rendering layer in disease-analysis.js
 *      does). metrics.topDisease/diseaseRisk were already correct (those come
 *      from overallScore/topThreats, fixed in the first pass) — only the
 *      *forecast* fields leaked Fusarium through.
 *   2. The dashboard vital-card's side panel ("Disease Breakdown" section,
 *      assets/dashboard-init.js buildDiseasePanel()) reads
 *      computed.disease.diseases directly — the raw, unfiltered array — not
 *      topDisease/topThreats, so it needed its own exclusion. Same for its
 *      companion (fairway/tee) sub-section, sourced from
 *      metrics.companionDisease.diseases.
 *   3. "Cultivar Performance" → "Disease Resistance" on the disease page
 *      (assets/disease-analysis.js renderCultivarBlock()) — a completely
 *      separate data source (static per-cultivar resistance ratings from the
 *      variety-traits database, not a live risk score), independently listed
 *      Fusarium as one of the rated diseases.
 *
 * A real bug caught during this pass: the companion-disease filter was first
 * added in assets/dashboard-init.js checking `d.disease !== 'fusarium'`, but
 * metrics.companionDisease.diseases (built by hub-persistence.js) is a *mapped*
 * shape with no `.disease` field (only .name/.risk/...) — that check would
 * silently never match. Fixed by filtering at the source in
 * collectDashboardMetrics(), before the .map() strips the raw key.
 *
 * Spec: tests/disease-fusarium-dashboard-exclusion-b35fix91.test.js
 */

'use strict';

const fs   = require('fs');
const path = require('path');

const hubPersistenceSrc = fs.readFileSync(path.join(__dirname, '../assets/hub-persistence.js'), 'utf8');
const dashboardInitSrc  = fs.readFileSync(path.join(__dirname, '../assets/dashboard-init.js'), 'utf8');
const diseaseAnalysisSrc = fs.readFileSync(path.join(__dirname, '../assets/disease-analysis.js'), 'utf8');

describe('hub-persistence.js — dashboard forecast metrics exclude Fusarium', () => {
    function extractCollectDashboardMetrics() {
        const start = hubPersistenceSrc.indexOf('function collectDashboardMetrics()');
        expect(start).toBeGreaterThan(-1);
        const end = hubPersistenceSrc.indexOf('function getCachedResults()', start);
        expect(end).toBeGreaterThan(start);
        return hubPersistenceSrc.slice(start, end);
    }

    test('forecastPeak/forecastDisease/peakDay are recomputed from _fc.diseases with fusarium excluded, not trusted from _fc.summary directly', () => {
        const body = extractCollectDashboardMetrics();
        const fcBlockStart = body.indexOf('const _fc = global.GAIP_DISEASE_FORECAST;');
        expect(fcBlockStart).toBeGreaterThan(-1);
        const fcBlock = body.slice(fcBlockStart, fcBlockStart + 1200);
        expect(fcBlock).toContain("d.key !== 'fusarium'");
        // Must still assign the metrics fields somewhere in this block.
        expect(fcBlock).toMatch(/metrics\.forecastPeak\s*=/);
        expect(fcBlock).toMatch(/metrics\.forecastDisease\s*=/);
    });

    test('companion (fairway/tee) disease filter excludes fusarium BEFORE the .map() that drops the raw key', () => {
        const body = extractCollectDashboardMetrics();
        const cdFilterPos = body.indexOf('const _cd = global.GAIP_COMPANION_DISEASE_RESULT;');
        expect(cdFilterPos).toBeGreaterThan(-1);
        const cdBlock = body.slice(cdFilterPos, cdFilterPos + 2500);
        const filterPos = cdBlock.indexOf('.filter(function(d) {');
        const mapPos    = cdBlock.indexOf('.map(function(d) {');
        expect(filterPos).toBeGreaterThan(-1);
        expect(mapPos).toBeGreaterThan(filterPos); // filter must run before map strips .disease
        const filterBody = cdBlock.slice(filterPos, mapPos);
        expect(filterBody).toContain("d.disease !== 'fusarium'");
    });

    test('the mapped companion disease shape has no .disease field (regression guard for the bug this test file documents)', () => {
        const body = extractCollectDashboardMetrics();
        const cdPos = body.indexOf('const _cd = global.GAIP_COMPANION_DISEASE_RESULT;');
        expect(cdPos).toBeGreaterThan(-1);
        const mapPos = body.indexOf('.map(function(d) {', cdPos);
        expect(mapPos).toBeGreaterThan(-1);
        const returnPos = body.indexOf('return {', mapPos);
        expect(returnPos).toBeGreaterThan(mapPos);
        // Fixed-size window over the return object literal (~14 short field
        // lines) rather than searching for a closing token — the object
        // literal closes with `};` (one line) followed by the map callback's
        // own `}),` on the next line, so a naive `indexOf('});')` search
        // doesn't match this shape.
        const returnBody = body.slice(returnPos, returnPos + 500);
        expect(returnBody).toContain('name:');
        expect(returnBody).not.toMatch(/^\s*disease:/m);
    });
});

describe('dashboard-init.js — side panel ("Disease Breakdown") excludes Fusarium', () => {
    function extractBuildDiseasePanel() {
        const start = dashboardInitSrc.indexOf('function buildDiseasePanel(');
        expect(start).toBeGreaterThan(-1);
        const end = dashboardInitSrc.indexOf('\n    function buildStressPanel', start);
        expect(end).toBeGreaterThan(start);
        return dashboardInitSrc.slice(start, end);
    }

    test('the raw computed.disease.diseases list is filtered by key, not just by score', () => {
        const body = extractBuildDiseasePanel();
        const filterPos = body.indexOf('var rows = diseases.filter(function (d) {');
        expect(filterPos).toBeGreaterThan(-1);
        const filterBody = body.slice(filterPos, body.indexOf('}).slice(0, 5)', filterPos));
        expect(filterBody).toContain("d.disease !== 'fusarium'");
    });

    test('companion section does NOT filter by a non-existent .disease field (regression guard)', () => {
        const body = extractBuildDiseasePanel();
        const cdRowsPos = body.indexOf('var cdRows = cd.diseases');
        expect(cdRowsPos).toBeGreaterThan(-1);
        const cdRowsLine = body.slice(cdRowsPos, body.indexOf('\n', cdRowsPos));
        // Must NOT re-introduce a `.filter(d => d.disease !== 'fusarium')` here —
        // that field doesn't exist on this shape (see hub-persistence.js test
        // above); filtering belongs upstream, in collectDashboardMetrics().
        expect(cdRowsLine).not.toContain("d.disease !== 'fusarium'");
    });
});

describe('disease-analysis.js — Cultivar Performance / Disease Resistance excludes Fusarium', () => {
    function extractRenderCultivarBlock() {
        const start = diseaseAnalysisSrc.indexOf('function renderCultivarBlock()');
        expect(start).toBeGreaterThan(-1);
        const end = diseaseAnalysisSrc.indexOf('\n    // ── Dew forecast block', start);
        expect(end).toBeGreaterThan(start);
        return diseaseAnalysisSrc.slice(start, end);
    }

    test('GEVES-format resistance loop skips fusarium', () => {
        const body = extractRenderCultivarBlock();
        const gevesPos = body.indexOf('Object.keys(diseaseResist).forEach(function (disease) {');
        expect(gevesPos).toBeGreaterThan(-1);
        const gevesBody = body.slice(gevesPos, body.indexOf('});', gevesPos));
        expect(gevesBody).toContain("disease === 'fusarium'");
    });

    test('NTEP/regional-format disease list no longer includes fusarium', () => {
        const body = extractRenderCultivarBlock();
        const listPos = body.indexOf('var diseaseList = [');
        expect(listPos).toBeGreaterThan(-1);
        const listBody = body.slice(listPos, body.indexOf('];', listPos));
        expect(listBody).not.toContain("'fusarium'");
        // Sanity: the list should still be non-trivial (didn't get emptied by mistake).
        expect(listBody).toContain("'redThread'");
        expect(listBody).toContain("'dollarSpot'");
    });

    test('diseaseLabels map may still reference fusarium (harmless — diseaseList controls what actually renders)', () => {
        const body = extractRenderCultivarBlock();
        // Not asserting removal here — the label map is just a lookup table;
        // leaving the unused entry is harmless and documents intent if fusarium
        // is ever added back to diseaseList.
        expect(body).toContain('fusarium: ');
    });
});

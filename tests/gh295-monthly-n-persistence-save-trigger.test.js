/**
 * GH-295 — GH-278 fixed nutrition-summary-integration.js so it re-renders
 * the Monthly N Distribution (and sets global.__GAIP_MONTHLY_N__) once
 * climate-normals-service.js's async monthly-temps fetch resolves and fires
 * 'gaip:monthly-normals-ready'. It never fixed the other half of the
 * pipeline: hub-persistence.js only (re-)saves the analysis cache on a
 * fixed list of gaipEvents (analysis-complete, orchestrator-complete,
 * weather-ready, sample/site events, ...), debounced 1s
 * (CONFIG.saveDebounce). 'gaip:monthly-normals-ready' was never in that
 * list, so whenever the monthly-temps fetch resolved after the 1s window
 * the other events had already triggered and saved (very plausible for a
 * real network fetch, and confirmed live: users saw the correct chart
 * mid-session but a stale/missing cache.computed.soilNutrition.monthlyN
 * after a reload/Re-run), the corrected value only ever existed in memory
 * and never reached the persisted cache. soil-nutrition-analysis.js's
 * renderMonthlyN() then fell back to climate.growth.dailyPattern (an 8-day
 * forecast window), reproducing the exact pre-GH-278 "all N crammed into
 * one month" symptom on read-from-cache pages (/analysis reload, Re-run).
 *
 * FIX: add 'gaip:monthly-normals-ready' to hub-persistence.js's gaipEvents
 * list, so it schedules a save (like every other reactive analysis event)
 * once the monthly normals resolve, whenever that happens relative to the
 * other events.
 */

'use strict';

const fs = require('fs');
const path = require('path');

const srcPath = path.join(__dirname, '../assets/hub-persistence.js');
const src = fs.readFileSync(srcPath, 'utf8');

describe('GH-295 — hub-persistence.js re-saves once monthly normals resolve', () => {
    test('gaipEvents includes gaip:monthly-normals-ready alongside the other analysis-triggering events', () => {
        const startIdx = src.indexOf('const gaipEvents = [');
        expect(startIdx).toBeGreaterThan(-1);
        const endIdx = src.indexOf('];', startIdx);
        const block = src.slice(startIdx, endIdx);

        expect(block).toMatch(/'gaip:analysis-complete'/);
        expect(block).toMatch(/'gaip:orchestrator-complete'/);
        expect(block).toMatch(/'gaip:weather-ready'/);
        // The actual fix:
        expect(block).toMatch(/'gaip:monthly-normals-ready'/);
    });

    test('each event in gaipEvents, including the new one, is wired to scheduleSave() via the same forEach', () => {
        const forEachIdx = src.indexOf('gaipEvents.forEach');
        expect(forEachIdx).toBeGreaterThan(-1);
        const blockEnd = src.indexOf('});', forEachIdx);
        const body = src.slice(forEachIdx, blockEnd);

        expect(body).toMatch(/addEventListener\(event,\s*\(\)\s*=>\s*\{\s*this\.scheduleSave\(\);/);
    });

    test('monthlyN capture (cache.computed.soilNutrition.monthlyN) still reads global.__GAIP_MONTHLY_N__ unconditionally, so a re-save after the ready event picks up whatever value is current', () => {
        const idx = src.indexOf('cache.computed.soilNutrition.monthlyN = _monthlyN;');
        expect(idx).toBeGreaterThan(-1);
    });
});

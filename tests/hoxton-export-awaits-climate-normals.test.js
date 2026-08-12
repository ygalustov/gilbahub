/**
 * GH-245 follow-up — exportToWord() must await real climate normals before
 * collecting data.
 *
 * Regression this guards against: a user reported the exported docx showing
 * "climate data unavailable" for Monthly N Distribution while the Nutrition
 * Program (fertiliser schedule) — generated on an earlier page load and
 * persisted — clearly had real data. Root cause: climate-normals-service.js's
 * auto-trigger is fire-and-forget on page load; exportToWord() read
 * window.climateMetrics.monthlyTemps synchronously via collectData() /
 * _buildEngineInputs(), with no guarantee the fetch had resolved by the time
 * the user clicked Export. Fixed by awaiting
 * window.GilbaClimateNormalsService.ensureFromPage() first.
 *
 * Source-pattern test (matches this repo's existing convention for
 * renderer-shape guards, e.g. monthly-n-distribution-renderer-b35fix387) —
 * a full behavioural test would need to mock docx.js, chart capture, and the
 * whole collectData() dependency graph, disproportionate to what this guard
 * needs to prove: the await happens, and it happens before data collection.
 */

'use strict';

const fs = require('fs');
const path = require('path');

let src;
beforeAll(() => {
    src = fs.readFileSync(path.join(__dirname, '../assets/word-export.js'), 'utf8');
});

describe('exportToWord() — awaits climate normals before collecting data', () => {
    test('calls window.GilbaClimateNormalsService.ensureFromPage()', () => {
        const fnStart = src.indexOf('async function exportToWord()');
        expect(fnStart).toBeGreaterThan(-1);

        const fnBody = src.slice(fnStart, fnStart + 3000);
        expect(fnBody).toMatch(/await window\.GilbaClimateNormalsService\.ensureFromPage\(\)/);
    });

    test('the await happens before GAIP_WordExport.collectData()', () => {
        const fnStart = src.indexOf('async function exportToWord()');
        const fnBody = src.slice(fnStart, fnStart + 3000);

        const ensureIdx = fnBody.indexOf('ensureFromPage()');
        const collectIdx = fnBody.indexOf('GAIP_WordExport.collectData()');

        expect(ensureIdx).toBeGreaterThan(-1);
        expect(collectIdx).toBeGreaterThan(-1);
        expect(ensureIdx).toBeLessThan(collectIdx);
    });

    test('guards against GilbaClimateNormalsService not being loaded on this page', () => {
        const fnStart = src.indexOf('async function exportToWord()');
        const fnBody = src.slice(fnStart, fnStart + 3000);
        const guardIdx = fnBody.indexOf('window.GilbaClimateNormalsService && typeof window.GilbaClimateNormalsService.ensureFromPage');
        expect(guardIdx).toBeGreaterThan(-1);
    });
});

describe('climate-normals-service.js — ensure() lets concurrent callers await the same in-flight fetch', () => {
    // The bug that made the first version of ensureFromPage() useless: a
    // second caller (export flow) arriving while the page-load auto-trigger
    // was still in flight for the same coordinates got an early return
    // instead of the real promise, so `await ensureFromPage()` resolved
    // before window.climateMetrics.monthlyTemps was actually populated.
    let normalsSrc;
    beforeAll(() => {
        normalsSrc = fs.readFileSync(path.join(__dirname, '../assets/climate-normals-service.js'), 'utf8');
    });

    test('in-flight guard returns the stored promise, not an early undefined', () => {
        expect(normalsSrc).toMatch(/if \(_inFlightByCoord\[key\]\) return _inFlightByCoord\[key\];/);
        expect(normalsSrc).toMatch(/return _inFlightByCoord\[key\];/);
    });
});

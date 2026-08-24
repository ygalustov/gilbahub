/**
 * GH-292 — K-reconciliation decision logic extracted from word-export.js
 * into a lightweight shared file (assets/k-reconciliation-decision.js), so
 * pages that only need the Spot-K decision (the Plan page's Nutrient
 * Delivery Summary preview) don't have to load the entire ~14k-line
 * word-export.js.
 *
 * Root cause this closes: nutrition-prebble-integration.js's
 * _evaluateKReconPreview() gated its ENTIRE soil-data lookup behind
 * `window.GAIP_WordExport` existing -- and word-export.js was never loaded
 * on plan.blade.php at all. So the preview always immediately returned
 * 'no-soil' on the Plan page, for every site, regardless of whether real
 * soil data existed (confirmed live: Test5-NZ has a real soil sample,
 * K=199ppm, but the preview still showed "Load a soil sample...").
 *
 * Fix: moved synthesiseDecision/potassiumDisplayLabel/detectKDisplayRegion
 * to k-reconciliation-decision.js (window.GAIP_KReconDecision). word-export.js
 * keeps thin wrapper functions delegating to the shared file (so every
 * existing internal call site and word-export-combined.js's
 * `_wx._synthesiseKReconDecision(...)` calls keep working unchanged).
 * nutrition-prebble-integration.js now gates on window.GAIP_KReconDecision
 * instead of window.GAIP_WordExport. The new file is loaded on the Plan
 * page and added (before word-export.js) to every blade view that already
 * loaded word-export.js.
 */

const vm = require('vm');
const fs = require('fs');
const path = require('path');

function loadSharedFile() {
    const src = fs.readFileSync(path.join(__dirname, '../assets/k-reconciliation-decision.js'), 'utf8');
    const sandbox = { console: { log: () => {}, warn: () => {} } };
    sandbox.window = sandbox;
    sandbox.global = sandbox;
    const ctx = vm.createContext(sandbox);
    vm.runInContext(src, ctx, { filename: 'k-reconciliation-decision.js' });
    return ctx.window.GAIP_KReconDecision;
}

describe('GH-292 — k-reconciliation-decision.js (the new canonical source)', () => {
    let KR;
    beforeAll(() => { KR = loadSharedFile(); });

    test('exposes synthesiseDecision, potassiumDisplayLabel, detectKDisplayRegion', () => {
        expect(typeof KR.synthesiseDecision).toBe('function');
        expect(typeof KR.potassiumDisplayLabel).toBe('function');
        expect(typeof KR.detectKDisplayRegion).toBe('function');
    });

    test('Gate 1 (programme balance): does not fire when balance is within the -20 threshold', () => {
        // kDelivered=90, kRequired=100 -> balance=-10, not < -20.
        const decision = KR.synthesiseDecision({ K: 30, thresholds: { K: { min: 78.2 } } }, 100, 90);
        expect(decision).toBeNull();
    });

    test('Gate 2 (soil-K sanity): does not fire when soil K is at/above the methodology floor, even with a big balance shortfall', () => {
        // balance = 50-150 = -100 (trips gate 1), but soil K (100) is above floor (78.2).
        const decision = KR.synthesiseDecision({ K: 100, thresholds: { K: { min: 78.2 } } }, 150, 50);
        expect(decision).toBeNull();
    });

    test('both gates trip: returns a real decision with the correct capped spot rate', () => {
        // balance = 50-150 = -100 (trips gate 1). soil K (60) below floor (78.2) (trips gate 2).
        const decision = KR.synthesiseDecision({ K: 60, thresholds: { K: { min: 78.2 } } }, 150, 50);
        expect(decision).not.toBeNull();
        expect(decision.nutrient).toBe('K');
        expect(decision.status).toBe('apply');
        expect(decision._isKReconciliation).toBe(true);
        // rawSpotK = 100, capped at 60.
        expect(decision.rate).toMatch(/^60 kg K\/ha/);
    });

    test('near-floor buffer (default 5ppm) suppresses borderline-below-floor samples', () => {
        // floor=78.2, soil K=75 is 3.2ppm below floor -- within the 5ppm buffer -> suppressed.
        const decision = KR.synthesiseDecision({ K: 75, thresholds: { K: { min: 78.2 } } }, 150, 50);
        expect(decision).toBeNull();
    });

    test('potassiumDisplayLabel: AU/NZ (elemental) vs UK (oxide) region convention', () => {
        expect(KR.potassiumDisplayLabel({ region: 'nz' })).toMatch(/^0-0-41\.5/);
        expect(KR.potassiumDisplayLabel({ region: 'uk' })).toMatch(/^0-0-50 \(as K₂O\)/);
    });
});

describe('GH-292 — word-export.js delegates to the shared file instead of keeping its own copy', () => {
    let src;
    beforeAll(() => {
        src = fs.readFileSync(path.join(__dirname, '../assets/word-export.js'), 'utf8');
    });

    test('_synthesiseKReconDecision is a thin wrapper calling window.GAIP_KReconDecision.synthesiseDecision', () => {
        const idx = src.indexOf('function _synthesiseKReconDecision(soilData, kRequired, kDelivered, opts) {');
        expect(idx).toBeGreaterThan(-1);
        const body = src.slice(idx, idx + 250);
        expect(body).toMatch(/window\.GAIP_KReconDecision\.synthesiseDecision\(/);
        // The old two-gate implementation (BALANCE_THRESHOLD/NEAR_FLOOR_BUFFER
        // constants) must be gone from word-export.js -- it now lives only in
        // k-reconciliation-decision.js.
        expect(body).not.toMatch(/BALANCE_THRESHOLD/);
    });

    test('_potassiumDisplayLabel and _detectKDisplayRegion are also thin wrappers', () => {
        expect(src).toMatch(/function _potassiumDisplayLabel\(opts\) \{\s*return window\.GAIP_KReconDecision\.potassiumDisplayLabel\(opts\);/);
        expect(src).toMatch(/function _detectKDisplayRegion\(explicit\) \{\s*return window\.GAIP_KReconDecision\.detectKDisplayRegion\(explicit\);/);
    });

    test('existing internal call sites and the export object are untouched (still call the local wrapper names)', () => {
        expect(src).toMatch(/_synthesiseKReconDecision:\s*_synthesiseKReconDecision,/);
        expect(src).toMatch(/_potassiumDisplayLabel:\s*_potassiumDisplayLabel,/);
        expect(src).toMatch(/_detectKDisplayRegion:\s*_detectKDisplayRegion,/);
    });
});

describe('GH-292 — nutrition-prebble-integration.js gates on the lightweight file, not word-export.js', () => {
    let src;
    beforeAll(() => {
        src = fs.readFileSync(path.join(__dirname, '../assets/nutrition-prebble-integration.js'), 'utf8');
    });

    test('the early-return guard checks window.GAIP_KReconDecision, not window.GAIP_WordExport', () => {
        const idx = src.indexOf("_evaluateKReconPreview: function(kRequired, kDelivered) {");
        expect(idx).toBeGreaterThan(-1);
        const guardIdx = src.indexOf('if (!kr || typeof kr.synthesiseDecision', idx);
        expect(guardIdx).toBeGreaterThan(idx);
        const wxGuardIdx = src.indexOf("if (!wx || typeof wx._synthesiseKReconDecision", idx);
        // The old blocking guard must be gone (or at least not appear before
        // the new one / not block on wx anymore).
        expect(wxGuardIdx === -1 || wxGuardIdx > guardIdx + 5000).toBe(true);
    });

    test('the decision call uses kr.synthesiseDecision(...)', () => {
        expect(src).toMatch(/const decision = kr\.synthesiseDecision\(synthSoil, kRequired, kDelivered\);/);
    });

    test('the optional monthly-split step guards on `wx &&` before touching wx, since wx may now be undefined', () => {
        expect(src).toMatch(/if \(wx && typeof wx\._amendmentDecisionsToProducts === 'function'\)/);
    });
});

describe('GH-292 — blade views load k-reconciliation-decision.js before its consumers', () => {
    const path_ = require('path');

    function checkOrder(file, beforeNeedle, afterNeedle) {
        const full = fs.readFileSync(path_.join(__dirname, '..', file), 'utf8');
        const beforeIdx = full.indexOf('k-reconciliation-decision.js');
        const afterIdx = full.indexOf(afterNeedle);
        expect(beforeIdx).toBeGreaterThan(-1);
        expect(afterIdx).toBeGreaterThan(-1);
        expect(beforeIdx).toBeLessThan(afterIdx);
    }

    test('hub.blade.php: before word-export.js', () => {
        checkOrder('app/resources/views/hub.blade.php', null, "'word-export.js'");
    });
    test('reports/export.blade.php: before word-export.js', () => {
        checkOrder('app/resources/views/reports/export.blade.php', null, "'word-export.js'");
    });
    test('reports/forensic.blade.php: before word-export.js', () => {
        checkOrder('app/resources/views/reports/forensic.blade.php', null, "'word-export.js'");
    });
    test('reports/scenarios.blade.php: before word-export.js', () => {
        checkOrder('app/resources/views/reports/scenarios.blade.php', null, "'word-export.js'");
    });
    test('plan.blade.php: before nutrition-prebble-integration.js', () => {
        // Search for the actual <script> tag, not just the filename string --
        // this file's explanatory comment also mentions the filename by name,
        // earlier in the file than the real tag.
        checkOrder('app/resources/views/plan.blade.php', null, "$legacyAssetUrl('nutrition-prebble-integration.js')");
    });
});

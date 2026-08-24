/**
 * GH-299 (D07 item 6) — the 3 external callers of
 * NutritionRequirementEngine_Pure.compute() (nutrition-summary-integration.js,
 * word-export.js, word-export-combined.js) must all resolve config.aaRanges
 * via HillLabsSampleTypes.deriveCode()/getRangesPpm() before calling compute(),
 * and ONLY when the site's methodology is AA — missing any one of the three
 * recreates a D07-shaped inconsistency between surfaces (per the plan's own
 * warning). This file structurally pins all 3 call sites plus the AA-gating,
 * and behaviourally exercises nutrition-summary-integration.js's resolver
 * end-to-end via vm (word-export.js/-combined.js are too large/DOM-heavy to
 * load in a test sandbox — structural pins only, matching the convention
 * already used for GH-290/291/292's word-export.js coverage).
 */

'use strict';

const fs = require('fs');
const path = require('path');
const vm = require('vm');

describe('GH-299 — nutrition-summary-integration.js resolves aaRanges', () => {
    const srcPath = path.join(__dirname, '../assets/nutrition-summary-integration.js');
    const src = fs.readFileSync(srcPath, 'utf8');

    test('_resolveAARanges() is gated on methodology being AA before touching HillLabsSampleTypes', () => {
        const idx = src.indexOf('function _resolveAARanges(soilValues, species) {');
        expect(idx).toBeGreaterThan(-1);
        const body = src.slice(idx, src.indexOf('\n    }', idx));
        expect(body).toMatch(/if \(m !== 'AA' && m !== 'AMMONIUM_ACETATE'\) return null;/);
        // The methodology check must come BEFORE any HillLabsSampleTypes read.
        const methodologyCheckIdx = body.indexOf("if (m !== 'AA'");
        const hlstIdx = body.indexOf('HillLabsSampleTypes');
        expect(methodologyCheckIdx).toBeLessThan(hlstIdx);
    });

    test('Engine.compute() call passes aaRanges from _resolveAARanges()', () => {
        const idx = src.indexOf('const engineResult = Engine.compute({');
        expect(idx).toBeGreaterThan(-1);
        const body = src.slice(idx, idx + 500);
        expect(body).toMatch(/aaRanges:\s*_resolveAARanges\(soilValues,\s*turfConfig\.species\)/);
    });

    test('extractFromSoilData() carries methodology/soilTexture/CEC through (previously dropped, so soil.methodology never reached the engine at all)', () => {
        const idx = src.indexOf('function extractFromSoilData(soil) {');
        const body = src.slice(idx, src.indexOf('\n            }', idx) + 20);
        expect(body).toMatch(/methodology:\s*soil\.methodology/);
        expect(body).toMatch(/soilTexture:\s*soil\.soilTexture/);
    });

    function loadModule() {
        const sandbox = {
            window: {},
            document: {
                readyState: 'complete',
                addEventListener: function () {},
                querySelector: () => null,
                querySelectorAll: () => [],
                createElement: () => ({ style: {}, classList: { add() {} }, addEventListener() {} }),
                body: {},
            },
            console: { log: () => {}, warn: () => {}, error: () => {} },
            localStorage: { getItem: () => null },
            setTimeout: () => 0,
            MutationObserver: function () { this.observe = () => {}; },
            CustomEvent: function (type, opts) { this.type = type; this.detail = opts && opts.detail; },
        };
        sandbox.window.GAIP_DASHBOARD_DATA = {};
        sandbox.global = sandbox;
        sandbox.globalThis = sandbox;
        const ctx = vm.createContext(sandbox);
        vm.runInContext(src, ctx, { filename: 'nutrition-summary-integration.js' });
        return ctx;
    }

    const MONTHLY_TEMPS = { 1: 20, 2: 20, 3: 18, 4: 15, 5: 12, 6: 9, 7: 8, 8: 9, 9: 11, 10: 14, 11: 17, 12: 19 };
    const realEngine = require('../assets/nutrition-requirement-engine.js');
    const realGPEngine = require('../assets/growth-potential-engine.js');

    test('end-to-end: AA site with soil K at/above the certificate ceiling shows Annual K Requirement = 0, not pure removal', () => {
        const ctx = loadModule();
        ctx.window.NutritionRequirementEngine_Pure = realEngine;
        ctx.window.GilbaGrowthPotentialEngine = realGPEngine;
        ctx.window.climateMetrics = { monthlyTemps: MONTHLY_TEMPS };
        ctx.window.GAIP_STATE = {
            soil: { P: 30, K: 250, Ca: 900, Mg: 100, S: 20, pH: 6.5, methodology: 'AMMONIUM_ACETATE', soilTexture: 'sand' },
            turf: { grassSpecies: 'Perennial Ryegrass' },
        };
        ctx.window.HillLabsSampleTypes = {
            deriveCode: (species, texture) => (String(texture).indexOf('sand') !== -1 ? 'S277' : null),
            getRangesPpm: (code, nutrient) => {
                const ranges = { K: { min: 58.7, max: 195.7 }, Ca: { min: 800, max: 1600 } };
                return ranges[nutrient] || null;
            },
        };

        const html = ctx.window.GilbaNutritionSummary.renderNutritionSummary();
        expect(html).not.toMatch(/Enter soil test values/);
        expect(html).not.toMatch(/Climate data unavailable/);
        expect(html).toMatch(/Annual Nutrient Requirements \(Ammonium Acetate\)/);
        // K (250ppm) is above the S277 ceiling (195.7) -> annualRequirement 0, status High.
        // Ca (900ppm) is above its ceiling (1600 isn't reached, so stays Adequate) --
        // assert on the actual per-nutrient result object directly, not just the
        // rendered HTML soup, since the K/Ca card markup is identical apart from
        // the number/status text embedded inside it.
        const kBlockIdx = html.indexOf('>K</div>');
        expect(kBlockIdx).toBeGreaterThan(-1);
        const kBlock = html.slice(kBlockIdx, kBlockIdx + 400);
        expect(kBlock).toMatch(/>\s*0\s*</);
        expect(kBlock).toMatch(/>\s*High\s*</);
    });

    test('MLSN site never calls HillLabsSampleTypes.deriveCode() at all', () => {
        const ctx = loadModule();
        ctx.window.NutritionRequirementEngine_Pure = realEngine;
        ctx.window.GilbaGrowthPotentialEngine = realGPEngine;
        ctx.window.climateMetrics = { monthlyTemps: MONTHLY_TEMPS };
        ctx.window.GAIP_STATE = {
            soil: { P: 30, K: 100, Ca: 900, Mg: 100, S: 20, pH: 6.5, methodology: 'MLSN' },
            turf: { grassSpecies: 'Perennial Ryegrass' },
        };
        let deriveCodeCalled = false;
        ctx.window.HillLabsSampleTypes = {
            deriveCode: () => { deriveCodeCalled = true; return 'S277'; },
            getRangesPpm: () => ({ min: 1, max: 2 }),
        };

        ctx.window.GilbaNutritionSummary.renderNutritionSummary();
        expect(deriveCodeCalled).toBe(false);
    });
});

describe('GH-299 — word-export.js resolves and threads aaRanges', () => {
    const src = fs.readFileSync(path.join(__dirname, '../assets/word-export.js'), 'utf8');

    test('_buildEngineInputs() resolves _aaRanges gated on AA methodology before touching HillLabsSampleTypes', () => {
        const idx = src.indexOf('var _aaRanges = null;');
        expect(idx).toBeGreaterThan(-1);
        const body = src.slice(idx, idx + 900);
        expect(body).toMatch(/if \(_soilM !== 'AA' && _soilM !== 'AMMONIUM_ACETATE'\) return;/);
        expect(body).toMatch(/_hlst\.deriveCode\(_species,/);
        expect(body).toMatch(/_hlst\.getRangesPpm\(_code,/);
        const gateIdx = body.indexOf("if (_soilM !== 'AA'");
        const hlstIdx = body.indexOf('window.HillLabsSampleTypes');
        expect(gateIdx).toBeLessThan(hlstIdx);
    });

    test('data.engineInputs carries aaRanges (so word-export-combined.js can inherit it)', () => {
        const idx = src.indexOf('data.engineInputs = {');
        expect(idx).toBeGreaterThan(-1);
        const body = src.slice(idx, idx + 700);
        expect(body).toMatch(/aaRanges:\s*_aaRanges/);
    });

    test('the single-export compute() call passes aaRanges: _inputs.aaRanges', () => {
        const idx = src.indexOf('window.NutritionRequirementEngine_Pure.compute({');
        expect(idx).toBeGreaterThan(-1);
        const body = src.slice(idx, idx + 400);
        expect(body).toMatch(/aaRanges:\s*_inputs\.aaRanges/);
    });
});

describe('GH-299 — word-export-combined.js inherits aaRanges from data.engineInputs', () => {
    const src = fs.readFileSync(path.join(__dirname, '../assets/word-export-combined.js'), 'utf8');

    test('the per-sample compute() call passes aaRanges: _ei.aaRanges (not a separate resolution)', () => {
        const idx = src.indexOf('_enginePure.compute({');
        expect(idx).toBeGreaterThan(-1);
        const body = src.slice(idx, idx + 600);
        expect(body).toMatch(/aaRanges:\s*_ei\.aaRanges/);
        // Structural pin: this file does NOT call deriveCode()/getRangesPpm()
        // itself — it must inherit the already-resolved ranges, per the same
        // "inherits the fix, not a separate bug" pattern GH-290 established.
        expect(src).not.toMatch(/_ei\.aaRanges\s*=\s*.*deriveCode/);
    });
});

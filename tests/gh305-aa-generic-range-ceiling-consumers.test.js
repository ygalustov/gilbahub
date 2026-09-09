/**
 * GH-305 (D07 item 6, "correction for generic numbers too" -- user decision,
 * 2026-08-24) — the same certificate-only ceiling gap fixed in
 * nutrition-calendar.js's computeProgram() (see gh305-aa-generic-range-
 * ceiling.test.js) also existed in the other 2 places that resolve
 * config.aaRange(s) for NutritionRequirementEngine_Pure.compute():
 * nutrition-summary-integration.js's _resolveAARanges() and word-export.js's
 * _aaRanges IIFE (word-export-combined.js inherits word-export.js's
 * resolution via data.engineInputs, so fixing word-export.js covers both,
 * same precedent GH-299/GH-290 already established).
 *
 * FIX: both now fall back to AmmoniumAcetateMethodology.getSufficiencyRange()
 * (the same generic sands/others SSOT used everywhere else in this chain)
 * whenever the certificate path doesn't cover a specific nutrient, instead of
 * leaving that nutrient with no range at all (which meant the engine's own
 * graceful-degradation path kept it at pure removal forever, regardless of
 * how high the soil value actually was).
 */

'use strict';

const fs = require('fs');
const path = require('path');
const vm = require('vm');

describe('GH-305 — nutrition-summary-integration.js _resolveAARanges() falls back to the generic range', () => {
    const srcPath = path.join(__dirname, '../assets/nutrition-summary-integration.js');
    const src = fs.readFileSync(srcPath, 'utf8');

    test('structural: falls back to AmmoniumAcetateMethodology.getSufficiencyRange() when the certificate path has no range', () => {
        const idx = src.indexOf('function _resolveAARanges(soilValues, species) {');
        expect(idx).toBeGreaterThan(-1);
        const body = src.slice(idx, src.indexOf('\n        return any ? ranges : null;', idx));
        expect(body).toMatch(/global\.AmmoniumAcetateMethodology/);
        expect(body).toMatch(/aam\.getSufficiencyRange\(n, texKey\)/);
        // Must attempt the certificate path first -- fallback is only reached when `r` is falsy.
        expect(body).toMatch(/if \(!r && aam/);
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

    // Same shape as the real ammonium-acetate-methodology.js's AMMONIUM_ACETATE_RANGES.
    function fakeAAM() {
        return {
            getSufficiencyRange: (nutrient, soilType) => {
                const RANGES = {
                    S: { all: [30, 60] },
                    K: { sands: [75, 175], others: [100, 235] },
                };
                const cfg = RANGES[nutrient];
                if (!cfg) return null;
                const band = cfg[soilType] || cfg.all;
                return band ? { ranges: { medium: band } } : null;
            },
        };
    }

    test('end-to-end: S277 site with Sulphur (no certificate range for S) -- generic ceiling now zeroes it, labelled Adequate/High via the engine as usual', () => {
        const ctx = loadModule();
        ctx.window.NutritionRequirementEngine_Pure = realEngine;
        ctx.window.GilbaGrowthPotentialEngine = realGPEngine;
        ctx.window.climateMetrics = { monthlyTemps: MONTHLY_TEMPS };
        ctx.window.GAIP_STATE = {
            soil: { P: 30, K: 100, Ca: 500, Mg: 80, S: 75, pH: 6.5, methodology: 'AMMONIUM_ACETATE', soilTexture: 'sand' },
            turf: { grassSpecies: 'Perennial Ryegrass' },
        };
        ctx.window.HillLabsSampleTypes = {
            // S277: certificate covers K only, not S -- matches the real SSOT exactly.
            deriveCode: (species, texture) => (String(texture).indexOf('sand') !== -1 ? 'S277' : null),
            getRangesPpm: (code, nutrient) => (nutrient === 'K' ? { min: 58.7, max: 195.7 } : null),
        };
        ctx.window.AmmoniumAcetateMethodology = fakeAAM();

        const html = ctx.window.GilbaNutritionSummary.renderNutritionSummary();
        const sBlockIdx = html.indexOf('>S</div>');
        expect(sBlockIdx).toBeGreaterThan(-1);
        const sBlock = html.slice(sBlockIdx, sBlockIdx + 400);
        // S=75ppm >= generic ceiling 60ppm -> annualRequirement 0, status High.
        expect(sBlock).toMatch(/>\s*0\s*</);
        expect(sBlock).toMatch(/>\s*High\s*</);
    });

    test('without AmmoniumAcetateMethodology loaded, S stays uncapped (graceful degradation, no throw)', () => {
        const ctx = loadModule();
        ctx.window.NutritionRequirementEngine_Pure = realEngine;
        ctx.window.GilbaGrowthPotentialEngine = realGPEngine;
        ctx.window.climateMetrics = { monthlyTemps: MONTHLY_TEMPS };
        ctx.window.GAIP_STATE = {
            soil: { P: 30, K: 100, Ca: 500, Mg: 80, S: 75, pH: 6.5, methodology: 'AMMONIUM_ACETATE', soilTexture: 'sand' },
            turf: { grassSpecies: 'Perennial Ryegrass' },
        };
        ctx.window.HillLabsSampleTypes = {
            deriveCode: (species, texture) => (String(texture).indexOf('sand') !== -1 ? 'S277' : null),
            getRangesPpm: (code, nutrient) => (nutrient === 'K' ? { min: 58.7, max: 195.7 } : null),
        };
        // AmmoniumAcetateMethodology intentionally NOT set on window.

        expect(() => ctx.window.GilbaNutritionSummary.renderNutritionSummary()).not.toThrow();
        const html = ctx.window.GilbaNutritionSummary.renderNutritionSummary();
        const sBlockIdx = html.indexOf('>S</div>');
        const sBlock = html.slice(sBlockIdx, sBlockIdx + 400);
        expect(sBlock).not.toMatch(/>\s*0\s*</);
    });
});

describe('GH-305/383 — the shared adapter falls back to the generic range, and word-export.js consumes it', () => {
    const src = fs.readFileSync(path.join(__dirname, '../assets/nutrition-program-inputs.js'), 'utf8');
    const exportSrc = fs.readFileSync(path.join(__dirname, '../assets/word-export.js'), 'utf8');

    // GH-383 (D31 stage 1): word-export.js's own 145-line AA-range IIFE is
    // gone. resolveSufficiencyRanges() in nutrition-program-inputs.js is the
    // one resolver, shared with the Plan page — which is exactly what this
    // ticket's "the same gap exists in N places" premise was working around.
    test('structural: falls back to AmmoniumAcetateMethodology.getSufficiencyRange() when the certificate path has no range', () => {
        const idx = src.indexOf("if (methodology === 'ammonium_acetate') {");
        expect(idx).toBeGreaterThan(-1);
        const body = src.slice(idx, src.indexOf("if (methodology === 'slan')", idx));
        expect(body).toMatch(/w\.AmmoniumAcetateMethodology/);
        expect(body).toMatch(/aam\.getSufficiencyRange\(n, texKey\)/);
        expect(body).toMatch(/\} else if \(aam && typeof aam\.getSufficiencyRange === 'function'\)/);
    });

    test('regression: certificate path (deriveCode/getRangesPpm) is still attempted first, unchanged', () => {
        const idx = src.indexOf("if (methodology === 'ammonium_acetate') {");
        const body = src.slice(idx, src.indexOf("if (methodology === 'slan')", idx));
        expect(body).toMatch(/hlst\.deriveCode\(speciesForCode,/);
        expect(body).toMatch(/hlst\.getRangesPpm\(certificateCode, n,/);
        const deriveIdx = body.indexOf('hlst.deriveCode(');
        const genericIdx = body.indexOf('aam.getSufficiencyRange(');
        expect(deriveIdx).toBeLessThan(genericIdx);
    });

    test('word-export.js builds its aaRanges from the adapter\'s resolved ranges, and only for AA sites', () => {
        const idx = exportSrc.indexOf('var _aaRanges = null;');
        expect(idx).toBeGreaterThan(-1);
        const body = exportSrc.slice(idx, exportSrc.indexOf('data.engineInputs = {', idx));
        expect(body).toMatch(/_programInputs\.methodology === 'ammonium_acetate'/);
        expect(body).not.toMatch(/HillLabsSampleTypes/);
        expect(body).not.toMatch(/AmmoniumAcetateMethodology/);
    });
});

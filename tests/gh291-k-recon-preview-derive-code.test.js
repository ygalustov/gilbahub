/**
 * GH-291 (D07 item 5) — nutrition-prebble-integration.js's K Reconciliation
 * preview now derives its AA floor from the Hill Labs certificate SSOT,
 * instead of ammonium-acetate-methodology.js's generic sands/others ranges.
 *
 * Background: `_evaluateKReconPreview()`'s AA branch called
 * `window.GAIP_AmmoniumAcetate.getSufficiencyRange('K', soilType)` --
 * generic "agricultural/horticultural" ranges (documented fallback: sands
 * 75ppm / others 100ppm), not the certificate-specific numbers Hill Labs
 * actually prints (e.g. S277/S279 K floor is 78.2ppm, not 75). This floor
 * isn't just a display value -- it's fed directly into
 * `synthSoil.thresholds.K.min`, which drives the real
 * `_synthesiseKReconDecision()` call that decides whether Spot-K
 * reconciliation fires in the Nutrient Delivery Summary preview.
 *
 * Fix: try `HillLabsSampleTypes.deriveCode(species, texture)` +
 * `getRangesPpm(code, 'K').min` first -- same resolver mlsnEngine()
 * (GH-260) already uses -- falling through to the existing documented
 * sands/others default only when no certificate matches (uncovered
 * species/texture).
 *
 * nutrition-prebble-integration.js auto-inits on load and has heavy
 * runtime dependencies (PrebbleRecommender, GilbaNutritionCalendar, live
 * DOM) -- structural source-pattern pins instead of vm execution, matching
 * this repo's existing convention for files like this (see GH-290's
 * word-export.js test).
 */

const fs = require('fs');
const path = require('path');

describe('GH-291 — K Reconciliation preview AA floor uses the Hill Labs SSOT', () => {
    let src;
    beforeAll(() => {
        src = fs.readFileSync(path.join(__dirname, '../assets/nutrition-prebble-integration.js'), 'utf8');
    });

    test('the old ammonium-acetate-methodology.js call is gone from this branch', () => {
        const branchStart = src.indexOf("methodology === 'AMMONIUM_ACETATE' || methodology === 'COTULA_S78'");
        expect(branchStart).toBeGreaterThan(-1);
        const branchEnd = src.indexOf("} else if (methodology === 'SLAN')", branchStart);
        expect(branchEnd).toBeGreaterThan(branchStart);
        const branch = src.slice(branchStart, branchEnd);
        // Only the removed call itself, not this fix's own explanatory
        // comment mentioning the old function name for context.
        expect(branch).not.toMatch(/\.getSufficiencyRange\(/);
        expect(branch).not.toMatch(/window\.GAIP_AmmoniumAcetate\s*\n?\s*&&/);
    });

    test('deriveCode(species, texture) + getRangesPpm(code, "K") resolve the floor', () => {
        const idx = src.indexOf('window.HillLabsSampleTypes.deriveCode(_species, tx)');
        expect(idx).toBeGreaterThan(-1);
        const body = src.slice(idx, idx + 300);
        expect(body).toMatch(/getRangesPpm\(_code,\s*'K'\)/);
        expect(body).toMatch(/floor\s*=\s*_r\.min/);
    });

    test('species resolves from GAIP_STATE.turf, same field names GH-260 already established', () => {
        expect(src).toMatch(/window\.GAIP_STATE\.turf\.grassSpecies\s*\|\|\s*window\.GAIP_STATE\.turf\.warmBase/);
    });

    test('regression — the documented sands/others fallback (75/100) is still the final default, only reached when floor is still null', () => {
        const idx = src.indexOf('window.HillLabsSampleTypes.deriveCode(_species, tx)');
        const fallbackIdx = src.indexOf("floor = (soilType === 'sands') ? 75 : 100;", idx);
        expect(fallbackIdx).toBeGreaterThan(idx);
        const guardIdx = src.lastIndexOf('if (floor === null) {', fallbackIdx);
        expect(guardIdx).toBeGreaterThan(idx);
    });

    test('regression — SLAN and MLSN branches are untouched', () => {
        expect(src).toMatch(/GilbaScenarioPresets\s*\n?\s*&&\s*typeof window\.GilbaScenarioPresets\.getSLANRanges/);
        expect(src).toMatch(/GilbaClassificationConstants\s*\n?\s*&&\s*window\.GilbaClassificationConstants\.MLSN_THRESHOLDS/);
    });
});

/**
 * GH-370 — nutrition-requirement-engine.js's below-floor/below-threshold
 * correction term (all three methodology branches: AMMONIUM_ACETATE, SLAN,
 * MLSN) applied a raw ppm deficit directly as if it were already a kg/ha
 * quantity, with zero occurrences of `bulkDensity`/`soilDepth`/`* 0.1`
 * anywhere in the file (confirmed by grep before this fix). The sibling
 * engine, nutrition-calendar.js, has always done this conversion correctly:
 *
 *   kgHa = (floor_ppm - current_ppm) * bulkDensity(g/cm3) * soilDepth(cm) * 0.1
 *
 * which is a real unit conversion (soil ppm is mg nutrient per kg of a known
 * mass of soil; bulk density x depth tells you how many kg of soil sit under
 * one hectare to that depth), not an empirical multiplier. This engine's
 * missing conversion produced a correction term wrong by roughly the missing
 * bulkDensity x depth x 0.1 factor -- order of magnitude 2-3x for a typical
 * sand profile at 15cm -- every time a real site sits genuinely below floor
 * on this engine's path. It never bit on this repo's own Hoxton/Test5-NZ
 * fixtures because every nutrient there sits ABOVE ceiling (correction = 0
 * either way, see tests/fixtures/test5-soccer-sample141.json) -- this file's
 * fixture is therefore constructed rather than pulled from a recorded site,
 * using the same real Hill Labs S277 certificate ranges
 * (assets/hill-labs-sample-types.js) this repo already cites elsewhere, with
 * a soil reading placed deliberately below the floor to exercise the branch
 * Hoxton never reaches.
 */

'use strict';

const Engine = require('../assets/nutrition-requirement-engine.js');

describe('GH-370 — ppm deficit is converted to kg/ha before the yearly spread', () => {
    test('AMMONIUM_ACETATE lift-to-floor: a real S277 sand-profile below-floor K reading, default bulk density/depth', () => {
        // Real Hill Labs S277 K certificate range: 78.2-195.5 ppm (this
        // repo's own tests/fixtures/test5-soccer-sample141.json). K=50ppm is
        // genuinely below the 78.2 floor -- unlike Hoxton's real 199ppm,
        // which never exercises this branch.
        const r = Engine.compute({
            soil: { K: 50, methodology: 'AMMONIUM_ACETATE' },
            turf: { species: 'perennialRyegrass' },
            climate: { monthlyTemps: null },
            aaRanges: { K: { min: 78.2, max: 195.5 } },
        });
        expect(r.perSample.K.intent).toBe('lift-to-floor');
        // Default bulk density 1.4 g/cm3, depth 10cm (nutrition-calendar.js's
        // own CONFIG.defaultBulkDensity/defaultSoilDepth, applied here when
        // the caller hasn't supplied a real per-sample reading).
        const expectedDeficitKgHa = (78.2 - 50) * 1.4 * 10 * 0.1;
        expect(r.perSample.K.correctionRequired).toBeCloseTo(expectedDeficitKgHa / 2, 5); // K yearsToCorrect = 2
        // Pre-fix this would have been (78.2-50)/2 = 14.1 -- roughly 40% of
        // the dimensionally-correct figure for these defaults.
        expect(r.perSample.K.correctionRequired).not.toBeCloseTo((78.2 - 50) / 2, 1);
    });

    test('AMMONIUM_ACETATE lift-to-floor: same reading, a real sand-profile bulk density/depth (1.5 g/cm3, 15cm) -- the conversion actually uses the supplied values, not just the default', () => {
        const r = Engine.compute({
            soil: { K: 50, methodology: 'AMMONIUM_ACETATE', bulkDensity: 1.5, depth: 15 },
            turf: { species: 'perennialRyegrass' },
            climate: { monthlyTemps: null },
            aaRanges: { K: { min: 78.2, max: 195.5 } },
        });
        const expectedDeficitKgHa = (78.2 - 50) * 1.5 * 15 * 0.1;
        expect(r.perSample.K.correctionRequired).toBeCloseTo(expectedDeficitKgHa / 2, 5);
    });

    test('SLAN below-floor: a below-floor P reading (Carrow et al. 2004 floor 27ppm, pH-neutral) gets the same conversion', () => {
        const r = Engine.compute({
            soil: { P: 15, methodology: 'SLAN', pH: 6.5 },
            turf: { species: 'perennialRyegrass' },
            climate: { monthlyTemps: null },
        });
        expect(r.perSample.P.intent).toBe('lift-to-floor');
        const expectedDeficitKgHa = (27 - 15) * 1.4 * 10 * 0.1;
        expect(r.perSample.P.correctionRequired).toBeCloseTo(expectedDeficitKgHa / 2, 5); // P yearsToCorrect = 2
    });

    test('MLSN below-threshold: a below-threshold Mg reading gets the same conversion', () => {
        const r = Engine.compute({
            soil: { Mg: 10 }, // MLSN default methodology
            turf: { species: 'perennialRyegrass' },
            climate: { monthlyTemps: null },
        });
        expect(r.perSample.Mg.status).toBe('Very Low');
        // GH-383 / decision D-6: the lift target is the MLSN MINIMUM itself
        // (the Plan page's rule), not 1.5 x the minimum. Re-derived by hand
        // for the new rule rather than adjusted until green:
        //   threshold 47, reading 10 -> deficit 37 ppm
        //   37 * 1.4 g/cm3 * 10 cm * 0.1 = 51.8 kg/ha
        //   / 3 years (Mg is an immobile cation) = 17.2667 kg/ha/yr
        // The pre-GH-383 engine lifted to 70.5 (47 x 1.5) and produced 28.2333.
        const threshold = Engine._getMLSNThreshold('Mg', 7);
        expect(threshold).toBe(47);
        const expectedDeficitKgHa = (threshold - 10) * 1.4 * 10 * 0.1;
        expect(expectedDeficitKgHa).toBeCloseTo(51.8, 6);
        expect(r.perSample.Mg.correctionRequired).toBeCloseTo(expectedDeficitKgHa / 3, 5); // Mg yearsToCorrect = 3
        expect(r.perSample.Mg.correctionRequired).toBeCloseTo(17.2667, 3);
    });

    test('regression guard: Hoxton\'s own real fixture (all nutrients above ceiling) is completely unaffected -- correction stays exactly 0', () => {
        const r = Engine.compute({
            soil: { P: 40, K: 199, Ca: 803, Mg: 129, S: 75, methodology: 'AMMONIUM_ACETATE', pH: 6 },
            turf: { species: 'perennialRyegrass' },
            climate: { monthlyTemps: null },
            aaRanges: {
                P: { min: 20, max: 30 }, K: { min: 78.2, max: 195.5 },
                Ca: { min: 400, max: 800 }, Mg: { min: 36.6, max: 85.4 }, S: { min: 30, max: 60 },
            },
        });
        ['P', 'K', 'Ca', 'Mg', 'S'].forEach((nut) => {
            expect(r.perSample[nut].correctionRequired).toBe(0);
            expect(r.perSample[nut].annualRequirement).toBe(0);
        });
    });

    test('a mid-range (sufficient) reading still gets zero correction, unaffected by the new factor', () => {
        const r = Engine.compute({
            soil: { K: 120, methodology: 'AMMONIUM_ACETATE' },
            turf: { species: 'perennialRyegrass' },
            climate: { monthlyTemps: null },
            aaRanges: { K: { min: 78.2, max: 195.5 } },
        });
        expect(r.perSample.K.intent).toBe('removal-only');
        expect(r.perSample.K.correctionRequired).toBe(0);
    });

    test('_ppmToKgHaFactor defaults match nutrition-calendar.js\'s own CONFIG.defaultBulkDensity (1.4) / defaultSoilDepth (10) exactly, not an independently-invented pair', () => {
        const fs = require('fs');
        const path = require('path');
        const calendarSrc = fs.readFileSync(path.join(__dirname, '../assets/nutrition-calendar.js'), 'utf8');
        expect(calendarSrc).toMatch(/defaultSoilDepth:\s*10,/);
        expect(calendarSrc).toMatch(/defaultBulkDensity:\s*1\.4,/);

        // GH-383: the two defaults moved into the shared core, which is now
        // the only place either engine converts a ppm deficit to kg/ha.
        const coreSrc = fs.readFileSync(path.join(__dirname, '../assets/nutrition-requirement-core.js'), 'utf8');
        expect(coreSrc).toMatch(/DEFAULT_BULK_DENSITY_G_CM3\s*=\s*1\.4;/);
        expect(coreSrc).toMatch(/DEFAULT_SOIL_DEPTH_CM\s*=\s*10;/);
        const engineSrc = fs.readFileSync(path.join(__dirname, '../assets/nutrition-requirement-engine.js'), 'utf8');
        expect(engineSrc).toMatch(/get DEFAULT_BULK_DENSITY_G_CM3\(\) \{ return _core\(\)\.DEFAULT_BULK_DENSITY_G_CM3; \}/);
        expect(engineSrc).toMatch(/get DEFAULT_SOIL_DEPTH_CM\(\) \{ return _core\(\)\.DEFAULT_SOIL_DEPTH_CM; \}/);
        // Re-exported lazily, not copied: one pair of defaults in the product.
        const Engine2 = require('../assets/nutrition-requirement-engine.js');
        const Core2 = require('../assets/nutrition-requirement-core.js');
        expect(Engine2.DEFAULT_BULK_DENSITY_G_CM3).toBe(Core2.DEFAULT_BULK_DENSITY_G_CM3);
        expect(Engine2.DEFAULT_SOIL_DEPTH_CM).toBe(Core2.DEFAULT_SOIL_DEPTH_CM);
    });
});

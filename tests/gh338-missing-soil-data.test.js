/**
 * GH-338 — user asked how the system handles a nutrient with no real soil
 * sample, and how it worked "before". Investigation found: `extractPpm()`
 * (nutrition-calendar.js) defaulted every branch to `|| 0`, including "the
 * field doesn't exist at all" -- collapsing "no soil sample" into "measured
 * 0 ppm". Since 0 ppm reads as maximally below every floor, this silently
 * triggered the LARGEST possible Lift correction for a site that was never
 * actually tested, the opposite of "no correction". The legacy sibling
 * engine, nutrition-requirement-engine.js's calculateAllRequirements(), does
 * the opposite: `if (currentLevel !== undefined && currentLevel !== null) {
 * ... }` -- a missing nutrient is simply omitted from results, never
 * defaulted or fabricated.
 *
 * FIX: extractPpm() now returns null (not 0) when the field is genuinely
 * absent. computeProgram() checks `typeof currentPpm !== 'number'` before
 * computing deficit/lift for that nutrient (both the aaRanges branch and the
 * calculateDeficit() legacy fallback, which had the same 0-coercion bug via
 * `threshold - null` -- null coerces to 0, returning the FULL threshold as a
 * fabricated deficit) -- skips deficit/lift entirely and flags the nutrient
 * in a new `missing_soil_data` map instead. Required for that nutrient
 * becomes removal-only (Removal doesn't depend on soil ppm), not a
 * fabricated correction. Propagated the flag through
 * nutrition-au-fertiliser-integration.js, nutrition-prebble-integration.js,
 * and nutrition-nz-fertiliser-integration.js so classifyBalance() can return
 * an explicit 'no-data' status ("No Soil Data", neutral grey) instead of
 * letting a removal-only Required fall through to the pct-based fallback and
 * look like a confirmed Deficit/On Track verdict.
 */

'use strict';

const fs = require('fs');
const path = require('path');

describe('GH-338 — nutrition-calendar.js: no soil sample is null, not 0', () => {
    let src;
    beforeAll(() => {
        src = fs.readFileSync(path.join(__dirname, '../assets/nutrition-calendar.js'), 'utf8');
    });

    test('extractPpm() returns null (not 0) when the field is genuinely absent', () => {
        const idx = src.indexOf('NutritionCalendar.extractPpm = function(soil, nutrient) {');
        expect(idx).toBeGreaterThan(-1);
        const block = src.slice(idx, idx + 1500);
        expect(block).toMatch(/return isNaN\(v\) \? null : v;/);
        expect(block).toMatch(/return null;\s*\n\s*\};/);
        expect(block).not.toMatch(/return parseFloat\([^)]*\) \|\| 0;/);
    });

    test('the null-currentPpm guard now lives in the shared core, and this file has no second copy', () => {
        // GH-388: NutritionCalendar.calculateDeficit() is gone. GH-384 routed
        // computeProgram() through the shared core, leaving it an unreachable
        // second implementation of the same deficit arithmetic — and of the
        // very guard this ticket added. The guard itself is unchanged, one
        // level down: a reading that is not a number produces no lift at all,
        // rather than `threshold - null` fabricating the full threshold as a
        // maximal deficit.
        expect(src).not.toMatch(/NutritionCalendar\.calculateDeficit = function/);
        expect(src).not.toMatch(/NutritionCalendar\.getThresholds = function/);
        const core = fs.readFileSync(path.join(__dirname, '../assets/nutrition-requirement-core.js'), 'utf8');
        expect(core).toMatch(/if \(typeof currentLevel !== 'number' \|\| isNaN\(currentLevel\)\) \{/);
        const Core = require('../assets/nutrition-requirement-core.js');
        const r = Core._calculateNutrientRequirement('K', null, {
            methodology: 'MLSN', species: 'perennialRyegrass', annualN: 200,
            range: { min: 37, max: 55.5 }, bulkDensity: 1.4, soilDepth: 10,
            clippingManagement: 'collected'
        });
        expect(r.correctionRequired).toBe(0);
        expect(r.missingSoilData).toBe(true);
        expect(r.annualRequirement).toBe(r.removal);
    });

    test('computeProgram() tracks missingSoilData and skips deficit/lift for those nutrients', () => {
        // GH-384 (D31 stage 2): this rule moved into the shared core, where the
        // Word export obeys it too (decision D-9) — pre-GH-383 the export
        // omitted such a nutrient entirely while the Plan page showed it as
        // removal-only. The calendar reports what the core resolved.
        expect(src).toMatch(/const missingSoilData = _coreResult\.missingSoilData;/);
        const core = fs.readFileSync(path.join(__dirname, '../assets/nutrition-requirement-core.js'), 'utf8');
        expect(core).toMatch(/if \(typeof currentLevel !== 'number' \|\| isNaN\(currentLevel\)\) \{/);
        expect(core).toMatch(/intent: 'removal-only-no-soil-data'/);
        expect(core).toMatch(/missingSoilData: true/);
        const Core = require('../assets/nutrition-requirement-core.js');
        const r = Core.compute({
            soilValues: { P: 40 }, species: 'perennialRyegrass', annualN: 200, methodology: 'MLSN',
            ranges: { K: { min: 37, max: 55.5 } }, clippingManagement: 'collected', nutrients: ['K']
        });
        expect(r.missingSoilData.K).toBe(true);
        expect(r.perSample.K.correctionRequired).toBe(0);
        expect(r.perSample.K.annualRequirement).toBe(r.perSample.K.removal);
    });

    test('missing_soil_data is returned from computeProgram()', () => {
        expect(src).toMatch(/missing_soil_data: missingSoilData,/);
    });
});

describe.each([
    ['nutrition-au-fertiliser-integration.js (AU)', '../assets/nutrition-au-fertiliser-integration.js'],
    ['nutrition-prebble-integration.js (NZ)', '../assets/nutrition-prebble-integration.js'],
])('GH-338 — %s', (_label, relPath) => {
    let src;
    beforeAll(() => {
        src = fs.readFileSync(path.join(__dirname, relPath), 'utf8');
    });

    test('missing_soil_data is carried through from calendarData/program', () => {
        expect(src).toMatch(/missing_soil_data:?\s*=?\s*calendarData\.missing_soil_data \|\| \{\}/);
    });

    test('classifyBalance() returns an explicit no-data status before the canCompute check', () => {
        const idx = src.indexOf('function classifyBalance(nutrient, required, delivered) {');
        expect(idx).toBeGreaterThan(-1);
        const block = src.slice(idx, idx + 1000);
        expect(block).toMatch(/if \(missingSoilDataMap\[nutrient\]\) \{/);
        expect(block).toMatch(/statusClass: 'no-data', statusLabel: 'No Soil Data'/);
    });
});

describe('GH-338 — nutrition-nz-fertiliser-integration.js also carries the flag through', () => {
    test('missing_soil_data carried through', () => {
        const src = fs.readFileSync(path.join(__dirname, '../assets/nutrition-nz-fertiliser-integration.js'), 'utf8');
        expect(src).toMatch(/program\.missing_soil_data = calendarData\.missing_soil_data \|\| \{\};/);
    });
});

describe('GH-338 — standalone reimplementation: extractPpm() distinguishes absent from real zero', () => {
    function extractPpm(soil, nutrient) {
        if (soil.ppm && soil.ppm[nutrient] !== undefined && soil.ppm[nutrient] !== null && soil.ppm[nutrient] !== '') {
            const v = parseFloat(soil.ppm[nutrient]);
            return isNaN(v) ? null : v;
        }
        if (soil[nutrient] !== undefined && soil[nutrient] !== null && soil[nutrient] !== '') {
            const v = parseFloat(soil[nutrient]);
            return isNaN(v) ? null : v;
        }
        return null;
    }

    test('field genuinely absent -> null, not 0', () => {
        expect(extractPpm({ ppm: {} }, 'K')).toBeNull();
        expect(extractPpm({}, 'K')).toBeNull();
    });

    test('field present as a real (if unlikely) zero -> 0, distinguishable from absent', () => {
        expect(extractPpm({ ppm: { K: 0 } }, 'K')).toBe(0);
        expect(extractPpm({ ppm: { K: '0' } }, 'K')).toBe(0);
    });

    test('field present with a real value -> parsed number', () => {
        expect(extractPpm({ ppm: { K: '199' } }, 'K')).toBe(199);
    });
});

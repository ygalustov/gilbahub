/**
 * GH-313 — user asked whether the "Nutrient Delivery Summary" table should
 * show the sufficiency floor/ceiling itself, since Status ("Excess (104%)",
 * "Low (57%)") implies a comparison without ever printing what it's
 * comparing against — the user has to trust the percentage or read the
 * source to verify it.
 *
 * FIX: added a "Range (kg/ha)" column showing `floor–ceiling` (e.g.
 * "109.5–273.7"), placed between Balance and Status. "—" when the unified
 * model can't compute (MLSN/SLAN, uncovered AA species/texture, or N, which
 * has no sufficiency-range concept at all). Same units as the rest of the
 * table (kg/ha) rather than ppm, for internal consistency.
 */

'use strict';

const fs = require('fs');
const path = require('path');

function extractBlock(src, startMarker, maxLen) {
    const idx = src.indexOf(startMarker);
    expect(idx).toBeGreaterThan(-1);
    return src.slice(idx, idx + maxLen);
}

describe('GH-313 — Range column formula (standalone reimplementation)', () => {
    function rangeDisplay(floorPpm, ceilingPpm, bulkDensity, soilDepth) {
        const unit = bulkDensity * soilDepth * 0.1;
        const floorKgHa = floorPpm * unit;
        const ceilingKgHa = ceilingPpm * unit;
        return `${Math.round(floorKgHa * 10) / 10}–${Math.round(ceilingKgHa * 10) / 10}`;
    }

    test('K (S277): floor=78.2ppm, ceiling=195.5ppm -> "109.5–273.7"', () => {
        expect(rangeDisplay(78.2, 195.5, 1.4, 10)).toBe('109.5–273.7');
    });
});

describe('GH-313 — nutrition-prebble-integration.js (NZ)', () => {
    const src = fs.readFileSync(path.join(__dirname, '../assets/nutrition-prebble-integration.js'), 'utf8');

    test('table header includes a "Range (kg/ha)" column', () => {
        expect(src).toMatch(/<th class="prebble-th">Range \(kg\/ha\)<\/th>/);
    });

    const block = extractBlock(src, 'function classifyBalance(nutrient, required, delivered) {', 6500);

    test('rangeDisplay is computed as floor–ceiling in kg/ha and returned from every branch', () => {
        expect(block).toMatch(/const rangeDisplay = `\$\{Math\.round\(floorKgHa \* 10\) \/ 10\}–\$\{Math\.round\(ceilingKgHa \* 10\) \/ 10\}`;/);
        // present in all 4 return statements (2 fallback branches + Excess + Low + Met)
        const rangeDisplayReturns = (block.match(/rangeDisplay(?:,|:)/g) || []).length;
        expect(rangeDisplayReturns).toBeGreaterThanOrEqual(5);
    });

    test('graceful degradation: rangeDisplay is "—" when the model cannot compute', () => {
        expect(block).toMatch(/currentDisplay: '—', rangeDisplay: '—'/);
    });

    test('row template renders rangeDisplay in its own cell', () => {
        const rowBlock = extractBlock(src, "const nutrientSummaryRows = ['N', 'P', 'K'].map(nutrient => {", 1700);
        expect(rowBlock).toMatch(/const \{ currentDisplay, rangeDisplay, diff, statusClass, statusLabel \} = classifyBalance/);
        expect(rowBlock).toMatch(/<td class="prebble-cell prebble-cell--num">\$\{rangeDisplay\}<\/td>/);
    });
});

describe('GH-313 — nutrition-au-fertiliser-integration.js (AU)', () => {
    const src = fs.readFileSync(path.join(__dirname, '../assets/nutrition-au-fertiliser-integration.js'), 'utf8');

    test('table header includes a "Range (kg/ha)" column', () => {
        expect(src).toMatch(/<th class="au-fert-th">Range \(kg\/ha\)<\/th>/);
    });

    const block = extractBlock(src, 'function classifyBalance(nutrient, required, delivered) {', 6500);

    test('rangeDisplay is computed as floor–ceiling in kg/ha and returned from every branch', () => {
        expect(block).toMatch(/const rangeDisplay = `\$\{Math\.round\(floorKgHa \* 10\) \/ 10\}–\$\{Math\.round\(ceilingKgHa \* 10\) \/ 10\}`;/);
        const rangeDisplayReturns = (block.match(/rangeDisplay(?:,|:)/g) || []).length;
        expect(rangeDisplayReturns).toBeGreaterThanOrEqual(5);
    });

    test('graceful degradation: rangeDisplay is "—" when the model cannot compute (required===0 fallback, required>0 fallback, and GH-338 no-soil-data)', () => {
        const occurrences = (block.match(/rangeDisplay: '—'/g) || []).length;
        expect(occurrences).toBe(3);
    });

    test('row template renders rangeDisplay in its own cell', () => {
        const rowBlock = extractBlock(src, "const nutrientSummaryRows = ['N', 'P', 'K'].map(nutrient => {", 1700);
        expect(rowBlock).toMatch(/const \{ currentDisplay, rangeDisplay, diff, statusClass, statusLabel \} = classifyBalance/);
        expect(rowBlock).toMatch(/<td class="au-fert-cell au-fert-cell--num">\$\{rangeDisplay\}<\/td>/);
    });
});

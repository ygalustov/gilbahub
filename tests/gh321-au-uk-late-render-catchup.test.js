/**
 * GH-321 — on page reload/navigation, NutritionCalendar.restoreFromPersisted()
 * restores the saved calendar program and calls this.renderResults(), but
 * does not dispatch 'gaip:nutrition-calendar-generated'. nutrition-nz-
 * fertiliser-integration.js's init() has a "late-render" catch-up block for
 * exactly this case (checks window.GilbaNutritionCalendar.program directly
 * and self-triggers generateAndRender() if the live event was missed).
 * nutrition-au-fertiliser-integration.js and nutrition-uk-fertiliser-
 * integration.js never had this block, so their recommendations panels
 * silently stayed empty after a reload — reachable for any methodology, not
 * specific to MLSN/SLAN (confirmed live: reproduced on an AU/MLSN site,
 * absent on an NZ/AA site, root cause was the region, not the methodology).
 */

'use strict';

const fs = require('fs');
const path = require('path');

describe('GH-321 — AU and UK integrations gain the same late-render catch-up NZ already had', () => {
    test('nutrition-au-fertiliser-integration.js', () => {
        const src = fs.readFileSync(path.join(__dirname, '../assets/nutrition-au-fertiliser-integration.js'), 'utf8');
        expect(src).toMatch(/const _existingCalendar = window\.GilbaNutritionCalendar;/);
        expect(src).toMatch(/if \(_existingCalendar && _existingCalendar\.program && this\.isAustralia\(\)\) \{/);
        expect(src).toMatch(/setTimeout\(\(\) => this\.generateAndRender\(_existingCalendar\.program\), 200\);/);
    });

    test('nutrition-uk-fertiliser-integration.js', () => {
        const src = fs.readFileSync(path.join(__dirname, '../assets/nutrition-uk-fertiliser-integration.js'), 'utf8');
        expect(src).toMatch(/var _existingCalendar = window\.GilbaNutritionCalendar;/);
        expect(src).toMatch(/if \(_existingCalendar && _existingCalendar\.program && self\.isUK\(\)\) \{/);
        expect(src).toMatch(/setTimeout\(function\(\) \{ self\.generateAndRender\(_existingCalendar\.program\); \}, 200\);/);
    });

    test('nutrition-nz-fertiliser-integration.js already had this (regression pin, unchanged)', () => {
        const src = fs.readFileSync(path.join(__dirname, '../assets/nutrition-nz-fertiliser-integration.js'), 'utf8');
        expect(src).toMatch(/var _existingCalendar = window\.GilbaNutritionCalendar;/);
        expect(src).toMatch(/if \(_existingCalendar && _existingCalendar\.program && self\.isNZ\(\)\) \{/);
    });
});

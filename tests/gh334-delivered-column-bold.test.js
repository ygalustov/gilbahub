/**
 * GH-334 — user asked to highlight the "Delivered" column in the Nutrient
 * Delivery Summary table so it's easier to spot at a glance among the
 * surrounding calculated columns. First tried a background tint (matching
 * how the table's other status colours work), but the user clarified: just
 * bold the numbers, no colour -- matching Balance's own weight (Balance
 * itself is only bold + status-coloured via .nutrient-diff, not
 * background-tinted).
 */

'use strict';

const fs = require('fs');
const path = require('path');

describe.each([
    ['nutrition-au-fertiliser-integration.js (AU)', '../assets/nutrition-au-fertiliser-integration.js', 'au-fert'],
    ['nutrition-prebble-integration.js (NZ)', '../assets/nutrition-prebble-integration.js', 'prebble'],
])('GH-334 — %s', (_label, relPath, prefix) => {
    let src;
    beforeAll(() => {
        src = fs.readFileSync(path.join(__dirname, relPath), 'utf8');
    });

    test('Delivered cell has the bold class, no background/colour class', () => {
        const cellClass = prefix === 'au-fert' ? 'au-fert-cell' : 'prebble-cell';
        // GH-401: the cell's expression changed from `${delivered}` to
        // `${_round1(delivered)}` when the intermediate 1 dp rounding was
        // deleted from above these renderers — the figure is the same one,
        // rounded once at this cell instead of twice on the way to it. What
        // this test is about is the CLASS list, so it pins that and lets the
        // expression be any read of `delivered`.
        expect(src).toMatch(new RegExp(`<td class="${cellClass} ${cellClass}--num ${cellClass}--delivered">\\\$\\{[^}]*delivered[^}]*\\}</td>`));
    });

    test('the --delivered CSS rule is font-weight only, no background or colour', () => {
        const cellClass = prefix === 'au-fert' ? 'au-fert-cell' : 'prebble-cell';
        const idx = src.indexOf(`.${cellClass}--delivered {`);
        expect(idx).toBeGreaterThan(-1);
        const rule = src.slice(idx, src.indexOf('}', idx) + 1);
        expect(rule).toMatch(/font-weight:\s*700;/);
        expect(rule).not.toMatch(/background/);
        expect(rule).not.toMatch(/color:/);
    });

    test('the header th was NOT given a --delivered class (no header-level styling)', () => {
        expect(src).not.toMatch(/Delivered \(kg\/ha\)<\/th>.*--delivered/);
        const thClass = prefix === 'au-fert' ? 'au-fert-th' : 'prebble-th';
        expect(src).toMatch(new RegExp(`<th class="${thClass}">Delivered \\(kg/ha\\)</th>`));
    });
});

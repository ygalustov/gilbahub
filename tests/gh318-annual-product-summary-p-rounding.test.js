/**
 * GH-318 — user asked to round P to whole numbers in "Annual Product
 * Summary" (product rows + tfoot), matching N/K in that same table. The
 * more detailed "Nutrient Delivery Summary" table above it keeps 1dp
 * precision throughout (unaffected).
 */

'use strict';

const fs = require('fs');
const path = require('path');

describe('GH-318 — Annual Product Summary rounds P to a whole number', () => {
    test('nutrition-prebble-integration.js (NZ): product row + tfoot', () => {
        const src = fs.readFileSync(path.join(__dirname, '../assets/nutrition-prebble-integration.js'), 'utf8');
        expect(src).toMatch(/\$\{Math\.round\(nutrients\.P\)\}/);
        expect(src).toMatch(/\$\{Math\.round\(nutrientTotals\.P\)\}/);
        expect(src).toMatch(/\$\{Math\.round\(nutrientRequired\.P\)\}/);
        expect(src).not.toMatch(/Math\.round\(nutrients\.P \* 10\) \/ 10/);
    });

    test('nutrition-au-fertiliser-integration.js (AU): product row + tfoot', () => {
        const src = fs.readFileSync(path.join(__dirname, '../assets/nutrition-au-fertiliser-integration.js'), 'utf8');
        expect(src).toMatch(/\$\{Math\.round\(pDelivered\)\}/);
        expect(src).toMatch(/\$\{Math\.round\(nutrientTotals\.P\)\}/);
        expect(src).toMatch(/\$\{Math\.round\(nutrientRequired\.P\)\}/);
        expect(src).not.toMatch(/Math\.round\(pDelivered \* 10\) \/ 10/);
    });
});

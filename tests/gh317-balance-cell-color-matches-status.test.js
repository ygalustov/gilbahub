/**
 * GH-317 — user spotted (screenshot) that "Nutrient Delivery Summary"'s
 * Balance cell showed +102.9/+285.5 in GREEN while the Status badge right
 * next to it correctly said "Excess". Balance's colour class used the raw
 * sign (`diff >= 0 ? 'positive' : 'negative'`) instead of `statusClass`, so
 * a positive-but-Excess Balance still read as green/good.
 *
 * FIX: colour class now follows `statusClass === 'sufficient'`, same signal
 * the Status badge and row background already use, in both
 * nutrition-prebble-integration.js (NZ) and
 * nutrition-au-fertiliser-integration.js (AU).
 */

'use strict';

const fs = require('fs');
const path = require('path');

describe('GH-317 — Balance cell colour matches Status, not raw sign', () => {
    test('nutrition-prebble-integration.js (NZ)', () => {
        const src = fs.readFileSync(path.join(__dirname, '../assets/nutrition-prebble-integration.js'), 'utf8');
        expect(src).toMatch(/nutrient-diff \$\{statusClass === 'sufficient' \? 'positive' : 'negative'\}/);
        expect(src).not.toMatch(/nutrient-diff \$\{diff >= 0 \? 'positive' : 'negative'\}/);
    });

    test('nutrition-au-fertiliser-integration.js (AU)', () => {
        const src = fs.readFileSync(path.join(__dirname, '../assets/nutrition-au-fertiliser-integration.js'), 'utf8');
        expect(src).toMatch(/nutrient-diff \$\{statusClass === 'sufficient' \? 'positive' : 'negative'\}/);
        expect(src).not.toMatch(/nutrient-diff \$\{diff >= 0 \? 'positive' : 'negative'\}/);
    });
});

/**
 * GH-316 — "Annual Product Summary" table's own tfoot Balance row (a third,
 * independent implementation on the same page as "Nutrient Delivery
 * Summary") still used the naive `Delivered - Required` formula GH-311/312
 * already fixed elsewhere on this exact page. Found live: P/K showed the
 * full delivered amount in green (as pure surplus) even where the correct
 * Balance = Current + Delivered - Removal would be Excess.
 *
 * FIX: reuse the same classifyBalance() helper already in scope (declared
 * earlier in buildRecommendationsHTML() for the Nutrient Delivery Summary
 * table) for this tfoot's N/P/K values and cell colouring, so the two
 * tables can never disagree again.
 */

'use strict';

const fs = require('fs');
const path = require('path');

describe('GH-316 — nutrition-prebble-integration.js (NZ) Annual Product Summary', () => {
    const src = fs.readFileSync(path.join(__dirname, '../assets/nutrition-prebble-integration.js'), 'utf8');

    test('nBal/pBal/kBal computed via classifyBalance() before the return template', () => {
        expect(src).toMatch(/const nBal = classifyBalance\('N', nutrientRequired\.N, nutrientTotals\.N\);/);
        expect(src).toMatch(/const pBal = classifyBalance\('P', nutrientRequired\.P, nutrientTotals\.P\);/);
        expect(src).toMatch(/const kBal = classifyBalance\('K', nutrientRequired\.K, nutrientTotals\.K\);/);
    });

    test('Balance row uses statusClass for colour and .diff for the value, not the old naive subtraction', () => {
        expect(src).toMatch(/nBal\.statusClass === 'sufficient' \? 'prebble-balance-row--positive' : 'prebble-balance-row--negative'/);
        expect(src).toMatch(/\$\{nBal\.diff >= 0 \? '\+' : ''\}\$\{Math\.round\(nBal\.diff\)\}/);
        // GH-318: P rounded to a whole number here too (was *10/10, 1dp) --
        // user asked to round this compact summary table uniformly, unlike
        // the detailed Nutrient Delivery Summary table above it which keeps
        // 1dp precision throughout.
        expect(src).toMatch(/\$\{pBal\.diff >= 0 \? '\+' : ''\}\$\{Math\.round\(pBal\.diff\)\}/);
        expect(src).toMatch(/\$\{kBal\.diff >= 0 \? '\+' : ''\}\$\{Math\.round\(kBal\.diff\)\}/);
    });

    test('the old naive (nutrientTotals.X - nutrientRequired.X) pattern is gone from the tfoot', () => {
        expect(src).not.toMatch(/\(nutrientTotals\.N - nutrientRequired\.N\) >= 0 \? 'prebble-balance-row--positive'/);
    });
});

describe('GH-316 — nutrition-au-fertiliser-integration.js (AU) Annual Product Summary', () => {
    const src = fs.readFileSync(path.join(__dirname, '../assets/nutrition-au-fertiliser-integration.js'), 'utf8');

    test('nBal/pBal/kBal computed via classifyBalance() before totalRow', () => {
        expect(src).toMatch(/const nBal = classifyBalance\('N', nutrientRequired\.N, nutrientTotals\.N\);/);
        expect(src).toMatch(/const pBal = classifyBalance\('P', nutrientRequired\.P, nutrientTotals\.P\);/);
        expect(src).toMatch(/const kBal = classifyBalance\('K', nutrientRequired\.K, nutrientTotals\.K\);/);
    });

    test('Balance row uses statusClass for colour and .diff for the value', () => {
        expect(src).toMatch(/nBal\.statusClass === 'sufficient' \? 'au-fert-balance-row--positive' : 'au-fert-balance-row--negative'/);
    });

    test('the old naive balanceN/balanceP/balanceK subtraction is gone', () => {
        expect(src).not.toMatch(/const balanceN = nutrientTotals\.N - nutrientRequired\.N;/);
    });
});

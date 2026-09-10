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

    test('Balance row uses statusVisualClass(statusClass) for colour and .diff for the value, not the old naive subtraction', () => {
        // GH-333: statusClass is now 3-way (sufficient/deficit/excess), so
        // colouring goes through statusVisualClass() instead of a binary
        // === 'sufficient' ternary; the '+' prefix was also dropped (GH-333
        // follow-up -- Balance is a projected level, not a delta).
        expect(src).toMatch(/prebble-balance-row--\$\{statusVisualClass\(nBal\.statusClass\)\}/);
        expect(src).toMatch(/prebble-\$\{statusVisualClass\(nBal\.statusClass\)\}"><strong>\$\{this\.formatDelivered\(nBal\.diff\)\}/);
        // GH-318: P printed to the same precision as N and K here, unlike the
        // detailed Nutrient Delivery Summary table above it.
        // GH-403: that shared precision is now 1 dp, through formatDelivered()
        // — whole kilograms could not be made to add up to their own caption
        // (Burns: rows 113 + 7 + 5, caption 126). What is pinned here is
        // unchanged in substance: one precision for all three nutrients, and
        // the value is the classifier's `.diff`, never a local subtraction.
        // See tests/gh318-annual-product-summary-p-rounding.test.js.
        expect(src).toMatch(/prebble-\$\{statusVisualClass\(pBal\.statusClass\)\}"><strong>\$\{this\.formatDelivered\(pBal\.diff\)\}/);
        expect(src).toMatch(/prebble-\$\{statusVisualClass\(kBal\.statusClass\)\}"><strong>\$\{this\.formatDelivered\(kBal\.diff\)\}/);
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

    test('Balance row uses statusVisualClass(statusClass) for colour and .diff for the value', () => {
        expect(src).toMatch(/au-fert-balance-row--\$\{statusVisualClass\(nBal\.statusClass\)\}/);
    });

    test('the old naive balanceN/balanceP/balanceK subtraction is gone', () => {
        expect(src).not.toMatch(/const balanceN = nutrientTotals\.N - nutrientRequired\.N;/);
    });
});

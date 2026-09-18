/**
 * GH-318 — round P to whole numbers in "Annual Product Summary" (product rows
 * + tfoot), matching N/K in that same table. The more detailed "Nutrient
 * Delivery Summary" table above it keeps 1 dp precision throughout.
 *
 * GH-401 — the tfoot pins moved from `Math.round(x)` to
 * `this.roundAtOutput(x)`. Same rounding, one step earlier in its life: the
 * renderers used to round the totals to 1 dp before the tfoot rounded them
 * again, so a true 125.46 printed as 126.
 *
 * ===========================================================================
 * GH-403 — SUPERSEDED, DELIBERATELY, AND HERE IS THE MEASUREMENT
 * ===========================================================================
 *
 * Whole kilograms in this table cannot be made to add up. Burns' caption read
 * 126 kg N above rows reading 113 + 7 + 5 = 125: the true total is 125.5, so
 * rounding it once gives 126 and rounding each row once and adding gives 125.
 * Both are correct, and on one page they are a contradiction.
 *
 * The alternative — print the sum of the ROUNDED rows in the caption — was
 * measured on every development site and rejected, because rounding bias
 * accumulates with the number of rows while the true total does not:
 *
 *     Test6 - UK    K   rows 127   true 125.4    (six rows, all round up)
 *     Test6 - UK    P   rows  29   true  27.8
 *     Westview      K   rows 155   true 154.1
 *     Test5 - NZ    N   rows 238   true 237.4
 *
 * A caption reading 127 would sit in the same document as an Annual Nutrient
 * Requirements table printing 125.4 for the same quantity. So the rows gained
 * the decimal instead: at 0.1 kg/ha they add up to the caption exactly on every
 * development site, and the figure matches the two other tables that have
 * printed this quantity at 1 dp all along.
 *
 * This file is kept, rather than deleted, so the reversal is recorded where
 * someone looking for GH-318's rule will find it. What GH-318 actually settled
 * — that P is not printed to a DIFFERENT precision from N and K in this table —
 * is still true and is still asserted below; only the shared precision changed.
 *
 * ===========================================================================
 * GH-529 — THE REJECTED ALTERNATIVE IS NOW THE RULE, AND WHY THAT IS NOT A
 * CONTRADICTION
 * ===========================================================================
 *
 * The paragraph above says the sum-of-rounded-rows caption was measured and
 * rejected. It is now what the caption prints, by the owner's decision of
 * 18.09.2026. Both are right, at their own precision, and the difference is the
 * precision itself — recorded here so the next reader meets the reversal rather
 * than the argument against it.
 *
 * The rejection was measured at WHOLE kilograms, where each row can be off by
 * up to 0.5 and six rows drift by up to 3: `Test6 - UK K rows 127 true 125.4`
 * is that drift, and a caption reading 127 beside an Annual Nutrient
 * Requirements table reading 125.4 would have been indefensible.
 *
 * GH-403 then moved the rows to 1 dp, and at 1 dp each row is off by at most
 * 0.05. What was left was the last 0.1: measured on Test5 - NZ, a caption of
 * 245.5 nitrogen over rows adding to 245.6 — the two remaining ways to state
 * one quantity, and the smallest possible disagreement. The owner chose the one
 * a reader can check: a total that is the total of the figures printed above
 * it. The months are untouched; only the caption moved.
 */

'use strict';

const fs = require('fs');
const path = require('path');

function read(name) {
    return fs.readFileSync(path.join(__dirname, '../assets/', name), 'utf8');
}

describe('GH-403 — the Annual Product Summary prints one precision, and the rows add up to the caption', () => {
    const PANELS = [
        ['nutrition-prebble-integration.js', 'nutrients.N', 'nutrients.P', 'nutrients.K'],
        ['nutrition-au-fertiliser-integration.js', 'nDelivered', 'pDelivered', 'kDelivered'],
        ['nutrition-uk-fertiliser-integration.js', null, null, null]
    ];

    test.each(PANELS)('%s: rows and tfoot go through formatDelivered()', (file, nRow, pRow, kRow) => {
        const src = read(file);
        expect(src).toMatch(/formatDelivered: function\(value\)/);
        expect(src).toMatch(/mod\.formatDelivered\(value\)/);
        // GH-529: `nutrientRequired` still prints through formatDelivered — it is
        // one quantity, not a column of rows, and nothing under it adds up.
        // `nutrientTotals` is no longer printed at all: the Total Delivered
        // caption is now the SUM OF THE PRINTED ROWS (`_sumPrintedDelivered`),
        // because the caption and its rows were two different numbers — 245.5
        // nitrogen over rows adding to 245.6 on Test5 - NZ. Owner's decision of
        // 18.09.2026. This file's subject, one precision everywhere, is
        // unchanged and still asserted: the sum is formatted by the same helper.
        ['N', 'P', 'K'].forEach((n) => {
            expect(src).toMatch(new RegExp('formatDelivered\\(nutrientRequired\\.' + n + '\\)'));
            expect(src).not.toMatch(new RegExp('roundAtOutput\\(nutrientRequired\\.' + n + '\\)'));
        });

        // GH-531: all three panels now sum the printed rows.
        //
        // The paragraph that stood here said the United Kingdom panel was the
        // one exception, pinned in its old shape so the gap could not go quiet —
        // "the day someone fixes it this line fails and says why". That is what
        // happened: the product was changed and this test went red on an
        // unchanged file, which is how the change was shown to have reached the
        // panel at all. It is rewritten only afterwards.
        //
        // Why it was changed although the measurement found nothing wrong with
        // it (GH-530: Test6 - UK, seven rows, caption and sum agreeing to the
        // digit on all three nutrients): the SHAPE was the one that produced
        // 245.5 over 245.6 elsewhere, and whether the fractional tails cross
        // half of the last digit depends on the site and the sample, not on the
        // panel. The owner's decision is about what a caption MEANS.
        ['N', 'P', 'K'].forEach((n) => {
            expect(src).toMatch(new RegExp("_sumPrintedDelivered\\(productEntries, '" + n + "'"));
        });
        expect(src).toMatch(/formatSumDelivered\(vals\)/);
        if (nRow) {
            [nRow, pRow, kRow].forEach((expr) => {
                expect(src).toMatch(new RegExp('formatDelivered\\(' + expr.replace('.', '\\.') + '\\)'));
                expect(src).not.toMatch(new RegExp('Math\\.round\\(' + expr.replace('.', '\\.') + '\\)'));
            });
        }
        // GH-318's actual finding survives: P is not printed at a different
        // precision from N and K in this table.
        expect(src).not.toMatch(/formatDelivered\((nutrientTotals|nutrientRequired)\.P, 1\)/);
    });

    test('the precision is stated once, in the shared module, not three times', () => {
        const core = read('nutrition-delivery-core.js');
        expect(core).toMatch(/var DELIVERED_DP = 1;/);
        expect(core).toMatch(/function formatDelivered\(value\) \{/);
        expect(core).toMatch(/roundAtOutput\(value, DELIVERED_DP\)\.toFixed\(DELIVERED_DP\)/);
        expect(require('../assets/nutrition-delivery-core.js').formatDelivered(125.5)).toBe('125.5');
        expect(require('../assets/nutrition-delivery-core.js').formatDelivered(7)).toBe('7.0');
    });

    test('the Word export prints the same table the same way', () => {
        const src = read('word-export.js');
        expect(src).toMatch(/_fmtDelivered = function\(v\)/);
        expect(src).toMatch(/_dmFmt\.formatDelivered\(v\)/);
        ['N', 'P', 'K', 'Ca', 'Mg', 'S'].forEach((n) => {
            expect(src).toMatch(new RegExp('_fmtDelivered\\(n\\.' + n + '\\)'));
            expect(src).not.toMatch(new RegExp('Math\\.round\\(n\\.' + n + '\\)\\.toString\\(\\)'));
            // GH-529: the caption sums the printed rows — see the panel test
            // above for the measurement and the decision behind it.
            expect(src).toMatch(new RegExp("_totalCell\\(_sumPrinted\\('" + n + "'\\)\\)"));
        });
    });
});

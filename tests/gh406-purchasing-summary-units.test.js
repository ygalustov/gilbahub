/**
 * GH-406 — the Fertiliser Purchasing Summary says which unit each row is in.
 *
 * The table's headers were hardcoded "Total kg" and "Total kg/ha avg", and the
 * quantity was read as `p.totalKg || p.totalKgHa || p.totalLHa` — first field
 * that existed. For a true liquid that is `totalLHa`, so litres printed under a
 * kilogram heading with nothing to distinguish them. A greenkeeper ordering
 * from that table would order the wrong thing.
 *
 * The Plan panel has always got this right, per row rather than per column
 * (`nutrition-au-fertiliser-integration.js:1047-1053`): a true liquid is L/ha, a
 * soluble powder is kg/ha even though it is dissolved before spraying, and a
 * greens surface shows g/m².
 *
 * GH-409 UPDATED THIS FILE. GH-406 reused the first two rules and deliberately
 * left the third out, arguing that this table answers "how much to order" and
 * ordering happens by mass and volume. The product owner has since looked at the
 * table beside the Plan page and asked for it to match the screen, so the rate
 * columns carry g/m² now too. What survives from GH-406 and is still pinned
 * here: the headers claim no unit, every quantity cell prints its own, a true
 * liquid's quantity comes from the litre field, and the absolute "Total" column
 * — a purchase quantity with no counterpart on the Plan — stays in kilograms
 * and litres. The unit rule itself now has ONE implementation, tested for
 * behaviour rather than for source text, in tests/gh409-product-table-units.test.js.
 *
 * There is no total row in this table to worry about — the columns aggregate
 * one product across samples, and a product has one form, so the sum inside a
 * row never mixes units. GH-409 added the one case where the SURFACE can differ
 * — one product applied on a green and a fairway — which falls back to
 * kilograms and is named under the table.
 */

'use strict';

const fs = require('fs');
const path = require('path');

const src = fs.readFileSync(path.join(__dirname, '../assets/word-export-combined.js'), 'utf8');
const panel = fs.readFileSync(
    path.join(__dirname, '../assets/nutrition-au-fertiliser-integration.js'), 'utf8');

describe('GH-406 — unit lives on the row, not in the header', () => {
    test('the headers no longer claim a unit for every row', () => {
        expect(src).not.toMatch(/hdrLabels = \['Product', 'Total kg', 'Total kg\/ha avg'\]/);
        expect(src).not.toMatch(/hdrLabels = \['Product', 'Total kg\/ha', 'Samples'\]/);
        expect(src).toMatch(/hdrLabels = \['Product', 'Total', 'Rate avg'\]/);
        expect(src).toMatch(/hdrLabels = \['Product', 'Total rate', 'Samples'\]/);
    });

    test('every quantity cell in the table prints its own unit', () => {
        // The absolute column is a purchase quantity: kilograms and litres, and
        // GH-409 left it alone deliberately.
        expect(src).toMatch(/Math\.round\(agg\.kgAbsSum\)\.toString\(\) \+ \(agg\.isLiquid \? ' L' : ' kg'\)/);
        // GH-409: the two RATE cells print through one helper, which is where
        // the g/m² branch lives. Both branches of the table use it.
        expect(src).toMatch(/_rateCellText\(avgKgHa, agg\)/);
        expect(src).toMatch(/_rateCellText\(avgPerHa, agg\)/);
        expect(src).toMatch(/_delivery\.formatRate\(perHa, agg\.unit\)/);
    });

    test('a true liquid takes its quantity from the litre field, not whatever came first', () => {
        // GH-409: `_isLiquid` is now the shared helper's answer rather than a
        // second local reading of the same two fields.
        expect(src).toMatch(/_delivery\.rateUnitFor\(p, _rateOpts\)/);
        expect(src).toMatch(/var _isLiquid = _unit === 'L\/ha'/);
        expect(src).toMatch(/var kgHa = _isLiquid\s*\n\s*\? parseFloat\(p\.totalLHa \|\| 0\)/);
    });

    test('a soluble powder is still recognised, wherever its form is recorded', () => {
        // GH-409 moved the test into nutrition-delivery-core.js, where it is the
        // union of every panel's own — the AU/UK `form === 'soluble'` and the NZ
        // label check both count — and the panels ask it rather than each
        // keeping a copy. What it decides is now only the L/ha branch: a soluble
        // powder is never litres. The surface decides everything else.
        const core = fs.readFileSync(
            path.join(__dirname, '../assets/nutrition-delivery-core.js'), 'utf8');
        expect(core).toMatch(/function isSolubleProduct/);
        expect(core).toMatch(/p\.form === 'soluble'/);
        expect(panel).toMatch(/GAIP_NutritionDelivery/);
        expect(panel).not.toMatch(/isSoluble = product && product\.form === 'soluble'/);
    });

    test('the unit is decided once per product and carried on the aggregate', () => {
        expect(src).toMatch(/isLiquid: _isLiquid/);
        expect(src).toMatch(/unit: _unit/);
    });

    test('a product applied on two different surfaces falls back to kilograms, and says so', () => {
        // GH-409. The aggregate spans a whole site, and a site can hold a green
        // and a fairway; averaging 40 g/m² with 400 kg/ha under either label
        // states something untrue.
        expect(src).toMatch(/_mixedSurfaceProducts/);
        expect(src).toMatch(/Rates in kg\/ha for /);
    });

    test('the panel rule this mirrors is now the same code, not a mirror', () => {
        // It was three copies of one rule in three panels plus a fourth in the
        // document. GH-409 left one, in nutrition-delivery-core.js, and this
        // panel reads it — so "if it moves" can no longer mean "moves in one
        // place and not the others".
        expect(panel).toMatch(/_rateModel\.productRate\(entry, \{ useGM2 \}\)/);
        expect(panel).toMatch(/_rateModel\.programmeTotalRate\(productEntries, \{ useGM2 \}\)/);
    });
});

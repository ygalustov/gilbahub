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
 * greens surface shows g/m². The first two rules are reused here verbatim. The
 * third is deliberately not: g/m² is an application rate for a small area,
 * while this table answers "how much to order", which is bought by mass and
 * volume.
 *
 * There is no total row in this table to worry about — the columns aggregate
 * one product across samples, and a product has one form, so the sum inside a
 * row never mixes units.
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
        expect(src).toMatch(/Math\.round\(agg\.kgAbsSum\)\.toString\(\) \+ \(agg\.isLiquid \? ' L' : ' kg'\)/);
        expect(src).toMatch(/avgKgHa\.toFixed\(0\) \+ \(agg\.isLiquid \? ' L\/ha' : ' kg\/ha'\)/);
        // The no-area branch renders a different cell and was equally wrong.
        expect(src).toMatch(/avgPerHa\.toFixed\(0\) \+ \(agg\.isLiquid \? ' L\/ha' : ' kg\/ha'\)/);
    });

    test('a true liquid takes its quantity from the litre field, not whatever came first', () => {
        expect(src).toMatch(/var _isLiquid = !!\(parseFloat\(p\.totalLHa\) > 0\) && !_isSoluble/);
        expect(src).toMatch(/var kgHa = _isLiquid\s*\n\s*\? parseFloat\(p\.totalLHa \|\| 0\)/);
    });

    test('a soluble powder stays in kilograms, the same exception the panel makes', () => {
        expect(src).toMatch(/_isSoluble = _prodMeta\.form === 'soluble'/);
        expect(panel).toMatch(/isSoluble = product && product\.form === 'soluble'/);
    });

    test('the unit is decided once per product and carried on the aggregate', () => {
        expect(src).toMatch(/isLiquid: _isLiquid/);
    });

    test('g/m² is not carried into this table, and the reason is written down', () => {
        const at = src.indexOf('GH-406');
        const block = src.slice(at, at + 1400);
        expect(block).toMatch(/how much to order/);
        expect(src).not.toMatch(/agg\.isLiquid \? ' L\/ha' : ' g\/m/);
    });

    test('the panel rule this mirrors still exists — if it moves, this test should say so', () => {
        expect(panel).toMatch(/rateStr = `\$\{Math\.round\(p\.totalLHa\)\} L\/ha`/);
        expect(panel).toMatch(/rateStr = `\$\{Math\.round\(p\.totalKgHa \|\| 0\)\} kg\/ha`/);
    });
});

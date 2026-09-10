/**
 * GH-397 — in the report's Annual Nutrient Requirements table, only Balance and
 * Status carry colour. Current and Required print in plain body text.
 *
 * GH-396 brought that table into line with the Plan page's vocabulary but
 * introduced a second colour system alongside the Plan's: Current and Required
 * were painted by the soil's MLSN/SLAN status band (red deficit / amber excess /
 * green in-range) while Balance and Status used the Plan's verdict palette.
 * Two palettes answering two questions in one nine-column row.
 *
 * Removed because Required is an instruction — apply this much — not a verdict
 * on the soil, so a red 136.1 reads as though the number itself were wrong; and
 * because the soil's condition is already stated twice in the same row, by Range
 * and by Status, so the colour carried no information the reader did not have.
 * The Plan page, which is this table's reference for both vocabulary and
 * presentation, colours nothing but Balance and Status either.
 *
 * Structural pins on the renderer, this repo's convention for Word-export
 * layout assertions. The behavioural half is the live .docx check in the
 * changelog entry.
 */

'use strict';

const fs = require('fs');
const path = require('path');

const SRC = path.join(__dirname, '../assets/word-export-combined.js');
const src = fs.readFileSync(SRC, 'utf8');

// Isolate the ANR row builder so a match elsewhere in a 4000-line file cannot
// make these pass by accident.
const start = src.indexOf('var verdictColour = (cls && _balanceModel)');
const end = src.indexOf('_mkCell(statusText', start);
const rowBlock = src.slice(start, end);

describe('GH-397 — colour scope in the ANR table', () => {
    test('the row builder was found — these assertions are looking at real code', () => {
        expect(start).toBeGreaterThan(-1);
        expect(end).toBeGreaterThan(start);
        expect(rowBlock).toMatch(/_mkCell\(currentText/);
        expect(rowBlock).toMatch(/_mkCell\(reqVal/);
    });

    test('Current and Required use the plain body colour, not a status-derived one', () => {
        expect(rowBlock).toMatch(/var soilColour = '111827';/);
        // No conditional: the previous form was `isN ? '111827' : _anrColor(...)`,
        // which is what a partial revert would reintroduce.
        expect(rowBlock).not.toMatch(/soilColour\s*=\s*[^;]*\?/);
    });

    test('the deleted soil-status colour helper has not come back', () => {
        // Kept as a whole-file check on purpose: reintroducing it anywhere in
        // this renderer is the regression, not just inside the row builder.
        expect(src).not.toMatch(/function\s+_anrColor\s*\(/);
        expect(src).not.toMatch(/_anrColor\s*\(\s*anrResult\s*\)/);
    });

    test('Balance and Status still carry the Plan page\'s verdict colour', () => {
        expect(rowBlock).toMatch(/verdictColour/);
        expect(rowBlock).toMatch(/_balanceModel\.statusColour\(cls\.statusClass\)/);
        const afterRow = src.slice(end, end + 600);
        expect(afterRow).toMatch(/color:\s*verdictColour/);
    });

    test('the verdict colour comes from the shared classifier, not a local copy', () => {
        // The whole point of GH-396 was that the Plan and the report stop
        // deciding this separately; a local palette here would undo it.
        expect(src).toMatch(/GAIP_NutrientBalanceStatus/);
        expect(src).not.toMatch(/function\s+statusColour\s*\(/);
    });
});

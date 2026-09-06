/**
 * GH-350 — Two Word-report bugs found while auditing the export against the
 * live UI for parity with this session's GH-341/347/349 fixes.
 *
 * (1) GP colour: the Monthly Schedule table computed `gpPct = round(gp*100)`
 * (an already-converted 0-100 percentage) and passed THAT into
 * GAIP_GPStatus.getColorDocx(), whose shared toPct() helper treats any value
 * <= 1 as a raw 0-1 fraction needing *100 -- the exact same ambiguity GH-346
 * fixed in nutrition-calendar.js, just reappearing here. A month at exactly
 * 0% or 1% GP would render green ("high") instead of red ("low"). Fixed by
 * passing the raw fraction (m.gp) like every other correct caller does.
 *
 * (2) Herbicide warning (GH-349) rendered inline, mixed into the regular
 * ·-joined notes with no visual distinction -- unlike the live UI (which
 * splits it onto its own bold line). Now split into its own bold paragraph
 * below the regular notes, matching nutrition-prebble-integration.js.
 *
 * Structural pins only (regex against the source), matching this repo's
 * established convention for word-export.js (see GH-290/291/292/306
 * precedent -- the file can't easily be isolated/required in a test sandbox).
 */

'use strict';

const fs = require('fs');
const path = require('path');

describe('GH-350 — word-export.js: Monthly Schedule GP colour no longer double-converts', () => {
    let src;
    beforeAll(() => {
        src = fs.readFileSync(path.join(__dirname, '../assets/word-export.js'), 'utf8');
    });

    test('getColorDocx() is called with the raw fraction (m.gp), not the pre-converted percentage', () => {
        expect(src).toMatch(/GAIP_GPStatus\.getColorDocx\(m\.gp\)/);
    });

    test('regression: no longer passes the already-converted gpPct into getColorDocx()', () => {
        expect(src).not.toMatch(/GAIP_GPStatus\.getColorDocx\(gpPct\)/);
    });

    test('gpPct is still computed and still used for the visible "N%" text (display-only, unaffected)', () => {
        expect(src).toMatch(/var gpPct = Math\.round\(\(m\.gp \|\| 0\) \* 100\);/);
        expect(src).toMatch(/text: gpPct \+ '%'/);
    });
});

describe('GH-350 — word-export.js: herbicide warning note rendered as its own bold paragraph', () => {
    let src;
    beforeAll(() => {
        src = fs.readFileSync(path.join(__dirname, '../assets/word-export.js'), 'utf8');
    });

    test('herbicide note is detected via the shared HERBICIDE_WARNING_NOTE constant, not re-typed text', () => {
        expect(src).toMatch(/window\.PrebbleRecommender && window\.PrebbleRecommender\.HERBICIDE_WARNING_NOTE/);
    });

    test('herbicide note is excluded from the regular notesText join', () => {
        const idx = src.indexOf('var herbicideNoteText =');
        expect(idx).toBeGreaterThan(-1);
        const block = src.slice(idx, idx + 400);
        expect(block).toMatch(/regularMonthNotesArr = \(m\.notes \|\| \[\]\)\.filter\(function\(n\) \{ return n !== herbicideNoteText; \}\);/);
    });

    test('Notes cell renders a separate bold paragraph for the herbicide note when present', () => {
        const idx = src.indexOf('cellParas.push(new Paragraph({ children: [new TextRun({ text: notesText');
        expect(idx).toBeGreaterThan(-1);
        const block = src.slice(idx, idx + 500);
        expect(block).toMatch(/hasHerbicideNoteExport\)\s*\{\s*\n\s*cellParas\.push\(new Paragraph\(\{ spacing:.*bold: true \}\)\]\s*\}\)\);/s);
    });
});

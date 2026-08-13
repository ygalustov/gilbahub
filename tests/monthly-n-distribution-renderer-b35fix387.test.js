/**
 * Test b35fix387 — Monthly N Distribution renderer SSOT
 *
 * Pre-fix bug: single-export (word-export.js) rendered a proper colour-graded
 * 12-column table for Monthly N Distribution; combined-export (word-export-
 * combined.js) rendered three plain prose paragraphs (b35fix307 simplification).
 * Same data shape on `data.nutritionSummary.{monthlyN, totalN, activeMonths}`
 * via the b35fix313 collectData path — two divergent renderers, classic
 * asymmetric-renderer pattern.
 *
 * Fix: extract the table-render logic into a shared helper
 * `_buildMonthlyNDistribution(monthlyN, totalN, activeMonths, docxRefs, opts)`
 * exposed on `window.GAIP_WordExport`. Both export paths call the helper.
 * Combined-export passes `opts.siteUniformCaption: true` so the helper
 * appends the explanatory caption below the table; single-export omits it
 * (only one sample, no asymmetry to explain).
 *
 * Mirrors the b35fix328 `_extractEntryNutrients` / `_detectActiveNutrient
 * Columns` shared-helper pattern.
 */

const fs = require('fs');
const path = require('path');

describe('b35fix387 — Monthly N Distribution shared renderer', () => {
    let exportSrc, combinedSrc;

    beforeAll(() => {
        exportSrc = fs.readFileSync(
            path.join(__dirname, '../assets/word-export.js'), 'utf8');
        combinedSrc = fs.readFileSync(
            path.join(__dirname, '../assets/word-export-combined.js'), 'utf8');
    });

    test('helper _buildMonthlyNDistribution defined in word-export.js', () => {
        // The helper must exist as a top-level function in word-export.js.
        // Pattern matches the function declaration anchored to start-of-line
        // 4-space indent (the module's convention).
        expect(exportSrc).toMatch(
            /function _buildMonthlyNDistribution\s*\(\s*monthlyN\s*,\s*totalN\s*,\s*activeMonths\s*,\s*docxRefs\s*,\s*opts\s*\)/
        );
    });

    test('helper exposed on GAIP_WordExport namespace', () => {
        // Combined-export reaches the helper via window.GAIP_WordExport
        // (variable `we` in buildCombinedDocument). The export contract
        // must list it.
        expect(exportSrc).toMatch(
            /_buildMonthlyNDistribution\s*:\s*_buildMonthlyNDistribution/
        );
    });

    test('helper produces title + totals + table at minimum', () => {
        // The helper body must construct a Paragraph with the title text,
        // a Paragraph with totals, and a Table — checked by source-pattern
        // since we are not running it here.
        expect(exportSrc).toMatch(/'Monthly N Distribution \(GP-Weighted\)'/);
        expect(exportSrc).toMatch(/'Total: '\s*\+/);
        expect(exportSrc).toMatch(/'\s*active growing months'/);
    });

    test('helper carries colour-grading bands matching pre-b35fix387 inline render', () => {
        // The four colour bands (16A34A / 65A30D / F59E0B / 9CA3AF) must
        // be preserved exactly. Threshold values matter — superintendents
        // skim the table for green cells = peak months.
        const helperRe = /function _buildMonthlyNDistribution[\s\S]*?\n {4}\}\n/;
        const m = exportSrc.match(helperRe);
        expect(m).toBeTruthy();
        const body = m[0];
        expect(body).toMatch(/n > 15.*?'16A34A'/);
        expect(body).toMatch(/n > 10.*?'65A30D'/);
        expect(body).toMatch(/n > 5.*?'F59E0B'/);
        expect(body).toMatch(/'9CA3AF'/);
    });

    test('helper accepts siteUniformCaption opt to render combined-export caption', () => {
        const helperRe = /function _buildMonthlyNDistribution[\s\S]*?\n {4}\}\n/;
        const body = exportSrc.match(helperRe)[0];
        expect(body).toMatch(/opts\.siteUniformCaption/);
        // Default caption text — combined-export relies on this default.
        expect(body).toMatch(/Distribution is site-uniform/);
        expect(body).toMatch(/Per-sample differentiation appears in P\/K\/S/);
    });

    test('helper returns empty array for missing/empty monthlyN (no-op)', () => {
        const helperRe = /function _buildMonthlyNDistribution[\s\S]*?\n {4}\}\n/;
        const body = exportSrc.match(helperRe)[0];
        // Early-return guard at top of function.
        expect(body).toMatch(/if\s*\(\s*!monthlyN[\s\S]*?return\s*\[\s*\]/);
    });

    test('single-export buildSections calls _buildMonthlyNDistribution', () => {
        // The inline render block was replaced with a helper call.
        // Single-export passes siteUniformCaption: false (only one sample).
        expect(exportSrc).toMatch(
            /_buildMonthlyNDistribution\s*\(\s*\n?\s*data\.nutritionSummary\.monthlyN/
        );
        // Confirm the no-caption opt is set explicitly. Anchor to a CALL
        // (=) rather than the function declaration (which has the same
        // identifier and would match first).
        // GH-245 follow-up 3 / GH-248: opts grew a climateDataUnavailableReason
        // field, pushing the call past the original 500-char budget — widened
        // to match the 800-char budget already used for the combined-export
        // call site's equivalent pin below.
        const callRe = /=\s*_buildMonthlyNDistribution\(([\s\S]{0,800}?)\);/;
        const m = exportSrc.match(callRe);
        expect(m).toBeTruthy();
        expect(m[1]).toMatch(/siteUniformCaption:\s*false/);
    });

    test('single-export inline render block has been removed', () => {
        // Pre-b35fix387 had ~50 lines of inline Paragraph/Table construction
        // for Monthly N Distribution. Those lines must be gone — the helper
        // owns them now. Look for the giveaway construction-line pattern
        // outside the helper (i.e. inside buildSections context).
        const inlineRe = /Monthly N Distribution \(GP-Weighted\)'[\s\S]{0,200}new Paragraph\([\s\S]{0,500}children:\s*\[new TextRun\(\{\s*\n?\s*text:\s*'Total:/;
        expect(exportSrc).not.toMatch(inlineRe);
    });

    test('combined-export prose render has been replaced with helper call', () => {
        // Pre-b35fix387 combined-export had three prose paragraphs:
        // "Monthly N Distribution (kg N/ha) — GP-Weighted" then a comma-
        // separated month-N line then the italic caption. Confirm the
        // comma-separated `Jan ${n}, Feb ${n}` distLine pattern is gone.
        expect(combinedSrc).not.toMatch(/var\s+monthNames307\s*=/);
        expect(combinedSrc).not.toMatch(/var\s+distLine\s*=\s*monthNames/);
    });

    test('combined-export now calls _buildMonthlyNDistribution via we namespace', () => {
        // Combined-export uses `var we = global.GAIP_WordExport;` (existing
        // pattern). The helper call goes through that handle.
        expect(combinedSrc).toMatch(
            /we\._buildMonthlyNDistribution\s*\(/
        );
        // Combined-export must pass siteUniformCaption: true so the helper
        // appends the explanatory caption.
        // Window widened past 500 chars (Hoxton audit D02/D03 fix added
        // climateDataUnavailable/climateNormalsSource to the opts object).
        const callRe = /we\._buildMonthlyNDistribution\([\s\S]{0,800}?\)/;
        const m = combinedSrc.match(callRe);
        expect(m).toBeTruthy();
        expect(m[0]).toMatch(/siteUniformCaption:\s*true/);
    });

    test('combined-export defensively guards against missing helper', () => {
        // The `we && typeof we._buildMonthlyNDistribution === 'function'`
        // guard preserves graceful degradation if the helper is somehow
        // not loaded (script enqueue order issue). Without it, a missing
        // helper would throw and abort the entire combined export.
        expect(combinedSrc).toMatch(
            /typeof\s+we\._buildMonthlyNDistribution\s*===\s*['"]function['"]/
        );
    });

    test('b35fix387 changelog comments present in both files', () => {
        expect(exportSrc).toMatch(/b35fix387/);
        expect(combinedSrc).toMatch(/b35fix387/);
    });
});

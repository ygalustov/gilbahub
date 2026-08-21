/**
 * GH-283 — Tissue Test Results gets an "i" info icon explaining what the
 * block means and what each status (Deficient/Marginal/Sufficient/High)
 * represents in plain language, added at the user's request right after
 * the GH-282 badge-colour fix for this same block.
 *
 * Structural pin (source-text, not vm execution) -- matches the pattern
 * used for the other db-info-icon/GAIP_GLOSSARY additions on this page
 * (GH-279's 'sn-monthly-n-uncapped').
 */

const fs = require('fs');
const path = require('path');

describe('GH-283 — Tissue Test Results info icon', () => {
    let src;
    beforeAll(() => {
        src = fs.readFileSync(path.join(__dirname, '../assets/soil-nutrition-analysis.js'), 'utf8');
    });

    test('GAIP_GLOSSARY has an sn-tissue-results entry explaining the block and all four statuses', () => {
        const idx = src.indexOf("'sn-tissue-results': {");
        expect(idx).toBeGreaterThan(-1);
        const entry = src.slice(idx, idx + 1600);
        expect(entry).toMatch(/title:\s*'Tissue Test Results'/);
        expect(entry).toMatch(/Deficient/);
        expect(entry).toMatch(/Marginal/);
        expect(entry).toMatch(/Sufficient/);
        expect(entry).toMatch(/High/);
        // Ties into the Soil-Tissue Cross-Validation block explained earlier
        // in this session (soil ok + tissue deficient = uptake problem, not
        // a fertiliser problem).
        expect(entry).toMatch(/Cross-Validation/);
    });

    test('the info-icon button sits inside the "Tissue Test Results" section title, wired to that glossary key', () => {
        const titleIdx = src.indexOf("'<div class=\"sn-section\"><div class=\"sn-section-title\">Tissue Test Results'");
        expect(titleIdx).toBeGreaterThan(-1);
        const nearby = src.slice(titleIdx, titleIdx + 300);
        expect(nearby).toMatch(/class="db-info-icon"\s+data-info="sn-tissue-results"/);
    });
});

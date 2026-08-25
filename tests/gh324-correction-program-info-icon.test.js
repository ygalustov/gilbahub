/**
 * GH-324 — "Correction Program" gets an "i" info icon explaining what it
 * actually computes: a one-time dose to close the gap to the MLSN
 * threshold today, a different corrective philosophy from the Nutrition
 * Program page's multi-year Lift (deficit spread over yearsToCorrect).
 *
 * Structural pin (source-text, not vm execution) -- matches the pattern
 * used for the other db-info-icon/GAIP_GLOSSARY additions on this page
 * (GH-279's 'sn-monthly-n-uncapped', GH-283's 'sn-tissue-results').
 */

const fs = require('fs');
const path = require('path');

describe('GH-324 — Correction Program info icon', () => {
    let src;
    beforeAll(() => {
        src = fs.readFileSync(path.join(__dirname, '../assets/soil-nutrition-analysis.js'), 'utf8');
    });

    test('GAIP_GLOSSARY has an sn-correction-program entry explaining the one-time-dose vs Lift distinction', () => {
        const idx = src.indexOf("'sn-correction-program': {");
        expect(idx).toBeGreaterThan(-1);
        const entry = src.slice(idx, idx + 1600);
        expect(entry).toMatch(/title:\s*'Correction Program'/);
        expect(entry).toMatch(/one-time/);
        expect(entry).toMatch(/MLSN threshold/);
        expect(entry).toMatch(/Lift/);
        expect(entry).toMatch(/Nutrition Program/);
    });

    test('the info-icon button sits inside the "Correction Program" section title, wired to that glossary key', () => {
        const titleIdx = src.indexOf("'<div class=\"sn-section\"><div class=\"sn-section-title\">Correction Program'");
        expect(titleIdx).toBeGreaterThan(-1);
        const nearby = src.slice(titleIdx, titleIdx + 300);
        expect(nearby).toMatch(/class="db-info-icon"\s+data-info="sn-correction-program"/);
    });
});

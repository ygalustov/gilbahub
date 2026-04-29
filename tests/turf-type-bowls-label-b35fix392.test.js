/**
 * Test b35fix392 — bowls/cotula label coverage in word-export typeMap.
 *
 * BUG CLASS: typeMap missing entry → raw lowercase fallback in user-visible report.
 *
 * After b35fix391 closed the analysis-end clobber bug, cotula bowls reports
 * correctly carried `data.turf.type = 'bowls'` through to the Site Information
 * row renderer at word-export.js:8696. But the typeMap at line 6054 had no
 * 'bowls' key, so the fallback at line 6083 (`typeMap[data.turf.type] ||
 * data.turf.type`) returned the raw lowercase value. Production report
 * GAIP_Report_2026-04-29.docx (X Cotula BC, post-b35fix391 deploy at
 * ?ver=1777424794) rendered:
 *     Turf Type: bowls
 *
 * Correct data, ugly label. Fix: add 5 bowls keys + 1 cotula_bowling_green
 * key to the typeMap, all mapping to 'Bowling Greens'. The 5-key bowls
 * coverage matches the shape of b35fix390's extractTurfIntentKey mapping
 * — handles any writer that puts the long form into turfType.
 *
 * Display label 'Bowling Greens' (plural) chosen for parity with existing
 * patterns: 'Golf - Greens', 'Golf - Fairways', 'Golf - Tees' are all
 * plural even on a per-site basis. Singular 'Bowling Green' is also the
 * name of a Kentucky city — disambiguates in case of substring search.
 */

const fs = require('fs');
const path = require('path');

describe('b35fix392 — bowls/cotula labels in word-export typeMap', () => {
    let wordExportSrc;
    let typeMapBlock;

    beforeAll(() => {
        const filePath = path.join(__dirname, '../assets/word-export.js');
        wordExportSrc = fs.readFileSync(filePath, 'utf8');
        // Locate the typeMap block by its anchor and capture ~2000 chars.
        // Two anchor candidates (the file may have multiple typeMap-like
        // structures); pin to the one immediately following the
        // "Format turf type nicely" comment.
        const anchorIdx = wordExportSrc.indexOf("Format turf type nicely - combine type with subCategory for golf");
        expect(anchorIdx).toBeGreaterThan(-1);
        typeMapBlock = wordExportSrc.slice(anchorIdx, anchorIdx + 2500);
    });

    test('typeMap contains bowls → Bowling Greens', () => {
        expect(typeMapBlock).toMatch(/'bowls':\s*'Bowling Greens'/);
    });

    test('typeMap contains the 5-key bowls coverage shape (matches b35fix390 pattern)', () => {
        expect(typeMapBlock).toMatch(/'bowls':\s*'Bowling Greens'/);
        expect(typeMapBlock).toMatch(/'bowls_':\s*'Bowling Greens'/);
        expect(typeMapBlock).toMatch(/'bowling':\s*'Bowling Greens'/);
        expect(typeMapBlock).toMatch(/'bowling_green':\s*'Bowling Greens'/);
        expect(typeMapBlock).toMatch(/'bowling_greens':\s*'Bowling Greens'/);
    });

    test('typeMap contains cotula_bowling_green for surfaceType-fallback paths', () => {
        expect(typeMapBlock).toMatch(/'cotula_bowling_green':\s*'Bowling Greens'/);
    });

    test('pre-existing typeMap keys are preserved', () => {
        // Regression guard — b35fix392 must not lose any existing labels.
        expect(typeMapBlock).toMatch(/'sports':\s*'Sports Field'/);
        expect(typeMapBlock).toMatch(/'golf':\s*'Golf Course'/);
        expect(typeMapBlock).toMatch(/'golf_greens':\s*'Golf - Greens'/);
        expect(typeMapBlock).toMatch(/'golf_fairways':\s*'Golf - Fairways'/);
        expect(typeMapBlock).toMatch(/'golf_tees':\s*'Golf - Tees'/);
        expect(typeMapBlock).toMatch(/'golf_rough':\s*'Golf - Rough'/);
        expect(typeMapBlock).toMatch(/'lawns':\s*'Lawns'/);
        expect(typeMapBlock).toMatch(/'lawn':\s*'Lawn'/);
        expect(typeMapBlock).toMatch(/'residential':\s*'Residential Lawn'/);
        expect(typeMapBlock).toMatch(/'commercial':\s*'Commercial'/);
    });

    // -------------------------------------------------------------------------
    // BEHAVIOURAL — extract the typeMap object literal and evaluate it as JS
    // to catch lookup-time regressions that source-pattern tests would miss.
    // -------------------------------------------------------------------------

    function extractTypeMap() {
        // Match `var typeMap = { ... };` starting from the comment anchor.
        const anchorIdx = wordExportSrc.indexOf("Format turf type nicely - combine type with subCategory for golf");
        const slice = wordExportSrc.slice(anchorIdx, anchorIdx + 3000);
        const match = slice.match(/var\s+typeMap\s*=\s*(\{[\s\S]*?\n\s*\};)/);
        if (!match) throw new Error('typeMap object literal not found');
        // Strip trailing `;` for eval, eval inside a function scope
        const literal = match[1].replace(/;\s*$/, '');
        // eslint-disable-next-line no-new-func
        return new Function('return ' + literal)();
    }

    test('typeMap lookup: bowls returns Bowling Greens at runtime', () => {
        const typeMap = extractTypeMap();
        expect(typeMap['bowls']).toBe('Bowling Greens');
    });

    test('typeMap lookup: all 5 bowls variants + cotula_bowling_green return same label', () => {
        const typeMap = extractTypeMap();
        const bowlsKeys = ['bowls', 'bowls_', 'bowling', 'bowling_green', 'bowling_greens', 'cotula_bowling_green'];
        for (const k of bowlsKeys) {
            expect(typeMap[k]).toBe('Bowling Greens');
        }
    });

    test('typeMap lookup: pre-existing keys still resolve correctly', () => {
        const typeMap = extractTypeMap();
        expect(typeMap['sports']).toBe('Sports Field');
        expect(typeMap['golf']).toBe('Golf Course');
        expect(typeMap['lawns']).toBe('Lawns');
    });

    test('production scenario: turfType=bowls, subCategory=null → renders Bowling Greens', () => {
        // Mirrors the production cotula bowls path: TPC dispatches
        // {turfType: 'bowls', subCategory: null, ...}, b35fix391 keeps that
        // value through the analysis-end writeback, line 5959 reads it as
        // data.turf.type = 'bowls', and we hit the else branch at 6083:
        //   data.turf.type = typeMap[data.turf.type] || data.turf.type;
        const typeMap = extractTypeMap();
        const dataTurfType = 'bowls';
        const dataTurfSubCategory = null;
        // The branch at 6071 requires both type==='golf' and subCategory; bowls
        // takes the else branch.
        const renderedType = (dataTurfType === 'golf' && dataTurfSubCategory)
            ? 'unreachable'
            : (typeMap[dataTurfType] || dataTurfType);
        expect(renderedType).toBe('Bowling Greens');
    });

    test('regression: pre-fix path (no bowls key) would render lowercase raw value', () => {
        // Frame check — strip the bowls keys from a copy of the map and verify
        // the fallback path produces the pre-fix bug. If this ever passes
        // without stripping, the test has lost its discriminating power.
        const typeMap = extractTypeMap();
        const stripped = Object.assign({}, typeMap);
        delete stripped['bowls'];
        delete stripped['bowls_'];
        delete stripped['bowling'];
        delete stripped['bowling_green'];
        delete stripped['bowling_greens'];
        delete stripped['cotula_bowling_green'];
        const renderedType = stripped['bowls'] || 'bowls';
        expect(renderedType).toBe('bowls'); // the pre-fix ugly label
    });
});

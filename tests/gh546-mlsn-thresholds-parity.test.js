/**
 * GH-546 — the server's MLSN thresholds are the product's.
 *
 * WHAT THIS EXISTS BECAUSE OF. `SampleAnalysisController` carried its own copy
 * of the MLSN table. The four macronutrients matched the canonical one; all five
 * micronutrients did not:
 *
 *     canonical   Fe 2    Mn 1   Zn 1    Cu 0.3  B 0.3
 *     the copy    Fe 49   Mn 5   Zn 2.2  Cu 0.9  B 0.5
 *
 * It never showed, because the controller preferred thresholds taken out of the
 * analysis cache — the browser's own last run — and those carried the canonical
 * numbers. The wrong table therefore applied only to a site that had never had a
 * Re-run: the same sample classified one way before and another way after. Two
 * paths, GH-262's class, hidden by exactly the dependency GH-546 removes.
 *
 * The values now live in `App\Support\ClassificationConstants`, and this file
 * compares them with `assets/gaip-classification-constants.js`, which is what
 * `mlsnEngine` reads. A second copy is only tolerable while something compares
 * it; that is this test's whole job.
 *
 * Reading PHP from jest is the established way here — `gh288-aa-fallback-
 * ceiling-real-numbers.test.js` and its neighbours do the same for AA_RANGES.
 */

'use strict';

const fs = require('fs');
const path = require('path');

const ROOT = path.join(__dirname, '..');

/** The canonical table, from the file mlsnEngine reads. */
function canonicalFromJs() {
    const src = fs.readFileSync(path.join(ROOT, 'assets', 'gaip-classification-constants.js'), 'utf8');
    const block = src.match(/var\s+MLSN_THRESHOLDS\s*=\s*\{([\s\S]*?)\}/);
    expect(block).not.toBeNull();
    const out = {};
    const re = /([A-Za-z]+)\s*:\s*([0-9.]+)/g;
    let m;
    while ((m = re.exec(block[1]))) out[m[1]] = parseFloat(m[2]);
    return out;
}

/** The server's table, from the class that now owns it. */
function serverTable() {
    const src = fs.readFileSync(path.join(ROOT, 'app', 'app', 'Support', 'ClassificationConstants.php'), 'utf8');
    const block = src.match(/const\s+MLSN_THRESHOLDS\s*=\s*\[([\s\S]*?)\];/);
    expect(block).not.toBeNull();
    const out = {};
    const re = /'([A-Za-z]+)'\s*=>\s*([0-9.]+)/g;
    let m;
    while ((m = re.exec(block[1]))) out[m[1]] = parseFloat(m[2]);
    return out;
}

describe('GH-546 — the two MLSN tables are one table', () => {

    test('both files were read and both produced ten nutrients', () => {
        // Guards the comparison: two empty objects are equal.
        expect(Object.keys(canonicalFromJs()).length).toBe(10);
        expect(Object.keys(serverTable()).length).toBe(10);
    });

    test('every value agrees, nutrient by nutrient', () => {
        const js = canonicalFromJs();
        const php = serverTable();
        const disagreements = Object.keys(js)
            .filter((k) => js[k] !== php[k])
            .map((k) => k + ': js ' + js[k] + ' vs php ' + php[k]);
        expect(disagreements).toEqual([]);
    });

    test('the five that used to disagree are named, so the fix cannot quietly revert', () => {
        const php = serverTable();
        // The old server copy, quoted. If any of these reappears, the sample
        // classifies differently on a site with no Re-run than on one with.
        const wasWrong = { Fe: 49, Mn: 5, Zn: 2.2, Cu: 0.9, B: 0.5 };
        Object.keys(wasWrong).forEach((k) => {
            expect([k, php[k]]).not.toEqual([k, wasWrong[k]]);
        });
        expect(php.Fe).toBe(2);
        expect(php.Mn).toBe(1);
        expect(php.Zn).toBe(1);
        expect(php.Cu).toBe(0.3);
        expect(php.B).toBe(0.3);
    });

    test('the controller uses the shared source and holds no table of its own', () => {
        const src = fs.readFileSync(
            path.join(ROOT, 'app', 'app', 'Http', 'Controllers', 'SampleAnalysisController.php'), 'utf8');
        expect(src).toContain('ClassificationConstants::MLSN_THRESHOLDS');
        // No literal table left behind: the old one was a ten-entry array
        // literal in this file.
        expect(src).not.toMatch(/'Fe'\s*=>\s*49/);
        expect(src).not.toMatch(/'Cu'\s*=>\s*0\.9/);
    });

    test('the canonical order the cards are drawn in comes from the same place', () => {
        // GH-271: with no cached run to take an order from, the display order is
        // the table's own key order. That is now one fact, not two.
        const js = Object.keys(canonicalFromJs());
        const php = Object.keys(serverTable());
        expect(php).toEqual(js);
        expect(php).toEqual(['P', 'K', 'Ca', 'Mg', 'S', 'Fe', 'Mn', 'Zn', 'Cu', 'B']);
    });
});

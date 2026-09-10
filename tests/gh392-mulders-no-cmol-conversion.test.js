/**
 * GH-392 — mulders-interaction-checker.js converted ammonium-acetate soil
 * values that were never in cmol/kg.
 *
 * `normaliseToBasis()` tested `methodology === 'ammonium_acetate'` and, when
 * true, multiplied every cation by `atomic weight / valence x 10` as a
 * cmol/kg -> mg/kg conversion. This hub stores and compares AA readings in
 * mg/kg (ppm) throughout, so that branch scaled already-correct numbers:
 *
 *   - `AmmoniumAcetateMethodology`'s bands are declared `unit: 'ppm'`
 *     (K sands 75-175, Ca 500-750, Mg 100-200).
 *   - `HillLabsSampleTypes.getRangesPpm()` converts the certificate-native
 *     me/100g THRESHOLDS into ppm, precisely so the comparison happens in ppm.
 *     me/100g lives on the range side of the comparison, never the sample side.
 *   - `lab-report-parser.js` keeps any genuine me/100g reading under its own
 *     key (`K_me`, `CEC_meq100g`), distinct from the ppm `K` the interaction
 *     checker reads.
 *   - The dev DB's only AA site (Test5 - NZ) stores soil ppm K 40 / Ca 803 /
 *     Mg 129 with a resolved certificate range of Ca 400-800, K 78.2-195.5 —
 *     same order of magnitude as the values, which cmol/kg readings would not be.
 *
 * The multipliers differ per element (K x391, Ca x200.4, Mg x121.6), so the
 * branch did not merely rescale the basis — it distorted the very cation
 * RATIOS the interaction rules test (K:Mg inflated 3.2x), fabricating
 * antagonisms. Removed rather than made case-tolerant: matching the other
 * casing would have made the export actively wrong instead of accidentally
 * right.
 *
 * These assertions are deliberately methodology-agnostic: the basis must be
 * the input, whatever stamp arrives and in whatever case, so the branch cannot
 * return by way of a casing fix.
 */

'use strict';

const fs = require('fs');
const path = require('path');
const vm = require('vm');

function loadMulders() {
    const src = fs.readFileSync(path.join(__dirname, '../assets/mulders-interaction-checker.js'), 'utf8');
    const noop = () => {};
    const win = {};
    const sandbox = { window: win, global: win, console: { log: noop, warn: noop, error: noop } };
    sandbox.globalThis = sandbox;
    vm.runInNewContext(src, sandbox, { filename: 'mulders-interaction-checker.js' });
    return win.GilbaMulders;
}

/** Test5 - NZ, the dev DB's only ammonium-acetate site. Real stored values. */
const TEST5_NZ_SOIL_PPM = { K: 40, Ca: 803, Mg: 129, P: 40, S: 75, Fe: 168, Mn: 28.3, Zn: 5.7, Cu: 1.3 };

function nutrientsFrom(ppmMap) {
    return Object.keys(ppmMap).map((sym) => ({ nutrient: sym, actual: ppmMap[sym] }));
}

describe('GH-392 — normaliseToBasis() passes soil values through unconverted', () => {
    let M;
    beforeAll(() => { M = loadMulders(); });

    // Every spelling and casing the hub actually stamps onto a methodology.
    // `word-export.js` upper-cases (`data.soil.methodology = ....toUpperCase()`),
    // the integrations and `mlsn-progressive-disclosure.js` use the lowercase
    // key, and `hub-persistence.js` passes no context at all.
    const STAMPS = ['ammonium_acetate', 'AMMONIUM_ACETATE', 'Ammonium_Acetate',
                    'AMMONIUM ACETATE', 'mlsn', 'MLSN', 'slan', 'SLAN', undefined, null, ''];

    test.each(STAMPS.map((s) => [String(s)]))(
        'methodology %s leaves the basis identical to the input ppm values',
        (stampName) => {
            const stamp = STAMPS.find((s) => String(s) === stampName);
            const basis = M.normaliseToBasis(nutrientsFrom(TEST5_NZ_SOIL_PPM), stamp);
            expect(basis).toEqual(TEST5_NZ_SOIL_PPM);
        }
    );

    test('the AA cation multipliers are gone — K 40 ppm stays 40, not 15640', () => {
        const basis = M.normaliseToBasis(nutrientsFrom(TEST5_NZ_SOIL_PPM), 'ammonium_acetate');
        expect(basis.K).toBe(40);
        expect(basis.Ca).toBe(803);
        expect(basis.Mg).toBe(129);
        // The numbers the removed branch would have produced.
        expect(basis.K).not.toBeCloseTo(40 * (39.1 / 1) * 10, 0);
        expect(basis.Ca).not.toBeCloseTo(803 * (40.08 / 2) * 10, 0);
    });

    test('non-numeric and non-positive readings are still dropped', () => {
        const basis = M.normaliseToBasis([
            { nutrient: 'K', actual: '40' },
            { nutrient: 'Ca', actual: 0 },
            { nutrient: 'Mg', actual: -3 },
            { nutrient: 'Na', actual: 'n/a' }
        ], 'ammonium_acetate');
        expect(basis).toEqual({ K: 40 });
    });
});

describe('GH-392 — the methodology stamp does not change which antagonisms are reported', () => {
    let M;
    beforeAll(() => { M = loadMulders(); });

    test('an AA site and an MLSN site with identical ppm values get identical flags', () => {
        const nutrients = nutrientsFrom(TEST5_NZ_SOIL_PPM);
        const aa = M.analyse(nutrients, { methodology: 'ammonium_acetate', soilPH: 6.2 });
        const mlsn = M.analyse(nutrients, { methodology: 'mlsn', soilPH: 6.2 });
        expect(aa.basis).toEqual(mlsn.basis);
        expect(aa.flags).toEqual(mlsn.flags);
    });

    test('the cation ratios themselves are undistorted — Ca:Mg reads 803/129, not 12.5x that', () => {
        const basis = M.normaliseToBasis(nutrientsFrom(TEST5_NZ_SOIL_PPM), 'ammonium_acetate');
        expect(basis.Ca / basis.Mg).toBeCloseTo(803 / 129, 6);
        expect(basis.K / basis.Mg).toBeCloseTo(40 / 129, 6);
    });
});

describe('GH-392 — the conversion cannot come back unnoticed', () => {
    const src = fs.readFileSync(path.join(__dirname, '../assets/mulders-interaction-checker.js'), 'utf8');

    test('no atomic-weight / valence table remains in the file', () => {
        expect(src).not.toMatch(/ATOMIC_WEIGHTS/);
        expect(src).not.toMatch(/VALENCE/);
    });

    test('normaliseToBasis takes only the nutrients array — no methodology parameter to branch on', () => {
        expect(src).toMatch(/function normaliseToBasis\(nutrients\)\s*\{/);
        expect(src).not.toMatch(/function normaliseToBasis\(nutrients\s*,/);
    });

    test('the function body itself carries no methodology branch', () => {
        const start = src.indexOf('function normaliseToBasis(nutrients) {');
        expect(start).toBeGreaterThan(-1);
        // The body runs to the first line that closes the function at its own
        // indentation — two spaces, matching this file's IIFE-scoped style.
        const end = src.indexOf('\n  }', start);
        expect(end).toBeGreaterThan(start);
        const body = src.slice(start, end);
        expect(body).not.toMatch(/ammonium_acetate/i);
        expect(body).not.toMatch(/methodology/);
        expect(body).not.toMatch(/isAA/);
    });

    test('analyse() no longer passes a methodology into normaliseToBasis', () => {
        expect(src).toMatch(/normaliseToBasis\(nutrients\)/);
        expect(src).not.toMatch(/normaliseToBasis\(nutrients,\s*methodology\)/);
    });
});

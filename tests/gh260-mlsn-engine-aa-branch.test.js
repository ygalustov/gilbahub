/**
 * Test GH-260 — give mlsnEngine() a real AA branch (D07 item 3, the actual
 * root fix for the Soil page's "Annual K Requirement" flip-flop, D07).
 *
 * BUG: mlsnEngine() (assets/hub-tissue-v3.js) is the single computation
 * entry point for Soil-page nutrient classification on initial page load,
 * and dispatches on methodology (MLSN/SLAN/AA) — but had no real AA branch:
 * the classification loop only special-cased SLAN
 * (`if (isSLAN && ranges && ranges[nutrient])`); AA fell through to the
 * generic MLSN PACE-style block, which computed `target = floor × 1.5`,
 * treating the AA range's floor as if it were a single MLSN minimum.
 *
 * FIX: a genuine `else if (isAA && ranges && ranges[nutrient])` branch,
 * styled on the SLAN branch, using the range's real lo/hi bounds — sourced
 * from the Hill Labs SSOT (GH-258) when deriveCode() resolves a certificate-
 * backed code, texture-only fallback otherwise (unchanged from pre-fix).
 * `rangeMin`/`rangeMax` are carried through as data-range-min/max attributes
 * for hub-persistence.js's scraper to pick up (see gh260-hub-persistence-
 * range-scrape.test.js).
 *
 * Structural pins use fs.readFileSync + regex, per this repo's convention.
 * Behavioural cases run the REAL hub-tissue-v3.js under a Node `vm` harness
 * (tests/helpers/mlsn-engine-harness.js) — not a reimplementation — so these
 * tests catch drift in the actual shipped function, not a parallel model of it.
 */

const fs = require('fs');
const path = require('path');
const { buildContext, run } = require('./helpers/mlsn-engine-harness');

describe('GH-260 — mlsnEngine() real AA branch', () => {
    // -------------------------------------------------------------------------
    // STRUCTURAL PINS
    // -------------------------------------------------------------------------

    describe('structural', () => {
        let src;
        beforeAll(() => {
            src = fs.readFileSync(path.join(__dirname, '../assets/hub-tissue-v3.js'), 'utf8');
        });

        test('isAA branch is present, styled on the isSLAN branch', () => {
            expect(src).toMatch(/const isAA = referenceThresholds\._methodology === "Ammonium Acetate";/);
            expect(src).toMatch(/if \(isAA && ranges && ranges\[nutrient\]\)/);
        });

        test('AA branch sets rangeMin/rangeMax on the result (SLAN branch does not)', () => {
            const aaBranchMatch = src.match(/if \(isAA && ranges && ranges\[nutrient\]\) \{[\s\S]*?\n        \}/);
            expect(aaBranchMatch).not.toBeNull();
            expect(aaBranchMatch[0]).toMatch(/rangeMin:\s*range\.lo/);
            expect(aaBranchMatch[0]).toMatch(/rangeMax:\s*range\.hi/);
        });

        test('AA texture resolves from state.soil.soilTexture, not the retired .gaip-aa-soil-texture selector', () => {
            expect(src).not.toMatch(/document\.querySelector\(["']\.gaip-aa-soil-texture["']\)/);
            expect(src).toMatch(/const generalSoilTexture = \(state\.soil && state\.soil\.soilTexture\)/);
        });

        test('deriveCode()/getRangesPpm() overlay is present and gated on HillLabsSampleTypes being loaded', () => {
            expect(src).toMatch(/_hlst\.deriveCode\(species, generalSoilTexture\)/);
            expect(src).toMatch(/_hlst\.getRangesPpm\(aaSampleTypeCode, nut, aaCec\)/);
        });

        test('data-range-min/max attributes are emitted only when rangeMin/rangeMax are set', () => {
            expect(src).toMatch(/const rangeAttrs = \(r\) =>/);
            expect(src).toMatch(/r\.rangeMin != null && r\.rangeMax != null/);
        });

        test('REGRESSION: the SLAN branch is byte-identical to pre-GH-260', () => {
            const start = src.indexOf('// SLAN range-based assessment (unchanged)');
            const end = src.indexOf('// GH-260', start);
            expect(start).toBeGreaterThan(-1);
            expect(end).toBeGreaterThan(start);
            const slanBranch = src.slice(start, end);
            expect(slanBranch).toContain('Below sufficiency range. Apply to increase by ~');
            expect(slanBranch).toContain('Within target range - maintain current program');
            expect(slanBranch).toContain('ppm above range. Reduce/omit applications');
            expect(slanBranch).not.toMatch(/rangeMin/);
        });

        test('REGRESSION: the generic MLSN PACE-style fallthrough block is untouched', () => {
            expect(src).toMatch(/MLSN PACE-STYLE ASSESSMENT/);
            expect(src).toMatch(/mlsnThreshold \+ uptakePpm/);
            expect(src).toMatch(/mlsnThreshold \* 1\.5/);
        });
    });

    // -------------------------------------------------------------------------
    // BEHAVIOURAL — real engine via vm harness
    // -------------------------------------------------------------------------

    describe('behavioural', () => {
        let ctx;
        beforeAll(() => {
            ctx = buildContext();
        });

        test('mlsnEngine is actually defined after loading the real file', () => {
            expect(typeof ctx.mlsnEngine).toBe('function');
        });

        describe('certificate-backed site (Ryegrass, Sand -> S277, K range 78.2-195.5ppm)', () => {
            test('K above range -> HIGH, with rangeMin/rangeMax carried on the row', () => {
                const { row } = run(ctx, {
                    methodology: 'ammonium_acetate', species: 'perennialRyegrass',
                    construction: 'sand_profile', soilTexture: 'sand', cec: 5, ppm: { K: 199 },
                });
                const k = row('K');
                expect(k.status).toBe('HIGH');
                expect(k.rangeMin).toBeCloseTo(78.2, 1);
                expect(k.rangeMax).toBeCloseTo(195.5, 1);
            });

            test('K below range -> LOW', () => {
                const { row } = run(ctx, {
                    methodology: 'ammonium_acetate', species: 'perennialRyegrass',
                    construction: 'sand_profile', soilTexture: 'sand', cec: 5, ppm: { K: 58.7 },
                });
                expect(row('K').status).toBe('LOW');
            });

            test('K within range -> SUFFICIENT', () => {
                const { row } = run(ctx, {
                    methodology: 'ammonium_acetate', species: 'perennialRyegrass',
                    construction: 'sand_profile', soilTexture: 'sand', cec: 5, ppm: { K: 120 },
                });
                expect(row('K').status).toBe('SUFFICIENT');
            });
        });

        test('sand-based texture now resolves the certificate range instead of the old generic "sands" bucket (GH-259 behaviour change taking effect)', () => {
            const { row } = run(ctx, {
                methodology: 'ammonium_acetate', species: 'perennialRyegrass',
                construction: 'sand_profile', soilTexture: 'sand', cec: 5, ppm: { K: 100 },
            });
            // Old generic "sands" K range was 75-175; certificate S277 range is 78.2-195.5.
            // K=100 is SUFFICIENT either way, so assert on the actual range bounds shown,
            // not just the status, to prove which data source is really in effect.
            expect(row('K').rangeMin).toBeCloseTo(78.2, 1);
            expect(row('K').rangeMax).toBeCloseTo(195.5, 1);
        });

        test('uncovered species (Kikuyu) falls back to the texture-only generic range, no crash', () => {
            const { row } = run(ctx, {
                methodology: 'ammonium_acetate', species: 'kikuyu', warmBase: true,
                construction: 'soil', soilTexture: 'loam', ppm: { K: 150 },
            });
            const k = row('K');
            expect(k.status).toBe('SUFFICIENT');
            // Generic "others" K range (texture-only fallback), unchanged from pre-fix.
            expect(k.rangeMin).toBeCloseTo(100, 0);
            expect(k.rangeMax).toBeCloseTo(235, 0);
        });

        test('Ryegrass on native (non-sand) rootzone is not certificate-covered -> texture-only fallback, no crash', () => {
            const { row } = run(ctx, {
                methodology: 'ammonium_acetate', species: 'perennialRyegrass',
                construction: 'soil', soilTexture: 'clay_loam', ppm: { K: 150 },
            });
            expect(row('K').status).toBe('SUFFICIENT');
        });

        test('Cotula (S78, delegated, no thresholds in the SSOT) falls back to texture-only range, no crash', () => {
            const { row } = run(ctx, {
                methodology: 'ammonium_acetate', species: 'cotula',
                construction: 'sand_profile', soilTexture: 'sand', ppm: { K: 150 },
            });
            expect(row('K')).not.toBeNull();
            expect(row('K').status).toBe('SUFFICIENT');
        });

        describe('REGRESSION — MLSN and SLAN produce identical output to pre-GH-260', () => {
            test('MLSN: no data-range attributes, standard MLSN column value', () => {
                // K=50 vs threshold 37, no N programme -> target = 37*1.5 = 55.5.
                // ratioVsMLSN = 50/37 = 1.35 (>=0.8); ratioVsTarget = 50/55.5 = 0.90 (in [0.85,1.5]) -> ADEQUATE.
                const { row } = run(ctx, { methodology: 'mlsn', soilTexture: 'loam', ppm: { K: 50 } });
                const k = row('K');
                expect(k.hasRangeAttrs).toBe(false);
                expect(k.col).toBe('37'); // MLSN_THRESHOLDS.K fallback literal
                expect(k.status).toBe('ADEQUATE');
            });

            test('SLAN: no data-range attributes, range-string column, LOW status below range', () => {
                const { row } = run(ctx, { methodology: 'slan', soilTexture: 'loam', ppm: { K: 45 } });
                const k = row('K');
                expect(k.hasRangeAttrs).toBe(false);
                expect(k.col).toBe('75.0-176.0'); // SLAN "others" K range, unchanged
                expect(k.status).toBe('LOW');
            });
        });
    });
});

/**
 * GH-288 — AA fallback "typical" ceilings (used when no Hill Labs
 * certificate matches the species/texture) now use the real, already-used
 * ceilings from hub-tissue-v3.js's `aaRanges` table, instead of GH-285's
 * unverified `floor × 1.5` guess.
 *
 * Confirmed live (Test5-NZ, Perennial Ryegrass/AA, no certificate coverage
 * -> falls back to the generic AA texture ranges): the Nutrient Status
 * card showed "S — SULPHUR ... AA: 30.0-60.0 ppm" but the "Unusual Values
 * Detected" popup said "Sulphur (75 ppm) is outside typical range
 * (30–45 ppm)" -- two different ceilings for the same nutrient on the same
 * card. Root cause: GH-285 derived the fallback ceiling as
 * `AA_THRESHOLDS[bucket].S * 1.5` = 30*1.5 = 45, assuming the MLSN ×1.5
 * convention also applied to AA's fallback data. It doesn't -- the real
 * ceiling (verified against hub-tissue-v3.js's `aaRanges`, the actual
 * source of the card's own "AA: X-Y ppm" numbers) is 60. The ×1.5 guess
 * only coincidentally matched Ca (500*1.5=750, which is also the real
 * ceiling); P/K/Mg/S were all wrong.
 */

const vm = require('vm');
const fs = require('fs');
const path = require('path');

function loadSandbox() {
    const sandbox = { console: { log: () => {}, warn: () => {}, error: () => {} } };
    sandbox.window = sandbox;
    sandbox.global = sandbox;
    sandbox.globalThis = sandbox;
    sandbox.document = { readyState: 'complete', addEventListener: () => {}, querySelector: () => null };
    const ctx = vm.createContext(sandbox);
    ['gaip-classification-constants.js', 'hill-labs-sample-types.js', 'input-range-validator.js'].forEach(file => {
        const src = fs.readFileSync(path.join(__dirname, '../assets/' + file), 'utf8');
        vm.runInContext(src, ctx, { filename: file });
    });
    return ctx;
}

describe('GH-288 — AA fallback ceilings match the real aaRanges table, not floor×1.5', () => {
    let Validator;
    beforeAll(() => { Validator = loadSandbox().window.GilbaInputValidator; });

    // Perennial Ryegrass on a non-sand texture has no Hill Labs certificate
    // (S277 requires sand) -> deriveCode() returns null -> forces the
    // AA_FALLBACK_CEILINGS path for all five nutrients below.
    const UNCOVERED_SPECIES = 'perennialRyegrass';
    const TEXTURE = 'loam';

    test('Sulphur: fallback ceiling is 60 (matching aaRanges.others.S.hi), not 45 (30×1.5)', () => {
        const result = Validator.validateSoil({ S: 75 }, 'ammonium_acetate', TEXTURE, UNCOVERED_SPECIES);
        const msg = result.warnings.find(w => w.startsWith('Sulphur'));
        expect(msg).toContain('30–60 ppm');
        expect(msg).not.toContain('30–45 ppm');
    });

    test('Phosphorus: fallback ceiling is 28 (matching aaRanges), not 18 (12×1.5) -- 24 is now correctly within range, no warning', () => {
        const inRange = Validator.validateSoil({ P: 24 }, 'ammonium_acetate', TEXTURE, UNCOVERED_SPECIES);
        expect(inRange.warnings.find(w => w.startsWith('Phosphorus'))).toBeUndefined();
        const overRange = Validator.validateSoil({ P: 32 }, 'ammonium_acetate', TEXTURE, UNCOVERED_SPECIES);
        const msg = overRange.warnings.find(w => w.startsWith('Phosphorus'));
        expect(msg).toContain('12–28 ppm');
    });

    test('Potassium (others bucket): fallback ceiling is 235, not 150 (100×1.5) -- 210 is now correctly within range, no warning', () => {
        const inRange = Validator.validateSoil({ K: 210 }, 'ammonium_acetate', TEXTURE, UNCOVERED_SPECIES);
        expect(inRange.warnings.find(w => w.startsWith('Potassium'))).toBeUndefined();
        const overRange = Validator.validateSoil({ K: 250 }, 'ammonium_acetate', TEXTURE, UNCOVERED_SPECIES);
        const msg = overRange.warnings.find(w => w.startsWith('Potassium'));
        expect(msg).toContain('100–235 ppm');
    });

    test('Magnesium (others bucket): fallback ceiling is 250, not 210 (140×1.5) -- 245 is now correctly within range, no warning', () => {
        const inRange = Validator.validateSoil({ Mg: 245 }, 'ammonium_acetate', TEXTURE, UNCOVERED_SPECIES);
        expect(inRange.warnings.find(w => w.startsWith('Magnesium'))).toBeUndefined();
        const overRange = Validator.validateSoil({ Mg: 260 }, 'ammonium_acetate', TEXTURE, UNCOVERED_SPECIES);
        const msg = overRange.warnings.find(w => w.startsWith('Magnesium'));
        expect(msg).toContain('140–250 ppm');
    });

    test('Calcium: 750 either way (the one nutrient where the old ×1.5 guess happened to be right) -- unaffected by the fix', () => {
        const result = Validator.validateSoil({ Ca: 700 }, 'ammonium_acetate', TEXTURE, UNCOVERED_SPECIES);
        expect(result.warnings.length).toBe(0); // 700 is within 500-750
        const overResult = Validator.validateSoil({ Ca: 800 }, 'ammonium_acetate', TEXTURE, UNCOVERED_SPECIES);
        const msg = overResult.warnings.find(w => w.startsWith('Calcium'));
        expect(msg).toContain('500–750 ppm');
    });

    test('sands bucket also uses real ceilings (K 175, not 112.5) -- 150 is now correctly within range, no warning', () => {
        // perennialRyegrass+sand resolves to a real S277 certificate (not
        // the fallback path) -- use kikuyu, which has no certificate on any
        // texture, to force the AA_FALLBACK_CEILINGS path here too.
        const inRange = Validator.validateSoil({ K: 150 }, 'ammonium_acetate', 'sand', 'kikuyu');
        expect(inRange.warnings.find(w => w.startsWith('Potassium'))).toBeUndefined();
        const overRange = Validator.validateSoil({ K: 190 }, 'ammonium_acetate', 'sand', 'kikuyu');
        const msg = overRange.warnings.find(w => w.startsWith('Potassium'));
        expect(msg).toContain('75–175 ppm');
    });
});

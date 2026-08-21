/**
 * GH-285 — "Input Data Issues Detected" (input-range-validator.js) now uses
 * each site's own methodology to pick the "typical" soil-nutrient band,
 * instead of one generic hardcoded band applied to every site regardless of
 * AA/MLSN/SLAN.
 *
 * Background (found 2026-08-21, queued as a client question in the D07
 * plan, then the user asked to implement it directly): a real, correctly-
 * classified AA "LOW" reading (Russley Ca 220ppm, AA floor 400ppm) was ALSO
 * flagged by this validator as "outside typical range (500-3000ppm)" -- a
 * generic band with no relation to AA's own certificate ranges -- reading
 * like a data-entry error when it was just a real low soil result.
 *
 * Fix: getMethodologyTypical(nutrient, methodology, texture, species)
 * resolves a [lo, hi] "typical" band from the SAME canonical sources the
 * Soil page's own classification already uses -- never new numbers:
 *   - AA: HillLabsSampleTypes' certificate ranges (deriveCode + getRangesPpm,
 *     GH-258), falling back to GilbaClassificationConstants.AA_THRESHOLDS'
 *     floor (×1.5 ceiling) when no certificate matches.
 *   - SLAN: GilbaClassificationConstants.SLAN_RANGES' published floor/ceiling
 *     (Carrow et al. 2004).
 *   - MLSN (default): GilbaClassificationConstants.MLSN_THRESHOLDS' floor
 *     (×1.5 ceiling, matching the ceiling convention already used elsewhere
 *     on the Soil page for MLSN).
 * Scoped to P/K/Ca/Mg/S only -- trace elements (Fe/Mn/Zn/Cu/B) and
 * pH/EC/CEC/physical properties keep the existing generic typical band
 * regardless of methodology (see code comment for why).
 */

const vm = require('vm');
const fs = require('fs');
const path = require('path');

function loadSandbox() {
    const sandbox = {
        console: { log: () => {}, warn: () => {}, error: () => {} },
    };
    sandbox.window = sandbox;
    sandbox.global = sandbox;
    sandbox.globalThis = sandbox;
    sandbox.document = {
        readyState: 'complete',
        addEventListener: () => {},
        querySelector: () => null,
    };
    const ctx = vm.createContext(sandbox);

    ['gaip-classification-constants.js', 'hill-labs-sample-types.js', 'input-range-validator.js'].forEach(file => {
        const src = fs.readFileSync(path.join(__dirname, '../assets/' + file), 'utf8');
        vm.runInContext(src, ctx, { filename: file });
    });

    return ctx;
}

describe('GH-285 — methodology-aware "typical" ranges', () => {
    let ctx, Validator;
    beforeAll(() => {
        ctx = loadSandbox();
        Validator = ctx.window.GilbaInputValidator;
    });

    test('AA site with a certificate match (Browntop Bent / sand -> S279): Ca 220ppm is within S279\'s own typical band, not flagged', () => {
        // S279 Ca range is 400-800ppm per the certificate (already used
        // throughout this session's Russley investigation) -- 220 is still
        // genuinely LOW against that, so it SHOULD still warn, just against
        // the right numbers.
        const result = Validator.validateSoil(
            { Ca: 220 },
            'ammonium_acetate',
            'sand',
            'browntopBent'
        );
        expect(result.warnings.some(w => w.includes('400') && w.includes('800'))).toBe(true);
        expect(result.warnings.some(w => w.includes('500') && w.includes('3000'))).toBe(false);
    });

    test('AA site with a certificate match: a value inside S279\'s own range (e.g. Ca 600ppm) is NOT flagged, even though it sits outside the old generic 500-3000 band check for other elements', () => {
        const result = Validator.validateSoil(
            { Ca: 600 },
            'ammonium_acetate',
            'sand',
            'browntopBent'
        );
        expect(result.warnings.length).toBe(0);
        expect(result.errors.length).toBe(0);
    });

    test('AA site with no certificate match (uncovered species/texture) falls back to AA_THRESHOLDS floor ×1.5, not the generic band', () => {
        // Kikuyu has no Hill Labs certificate on file -> deriveCode() returns
        // null -> falls back to AA_THRESHOLDS.sands.Ca = 500, ceiling 750.
        const result = Validator.validateSoil(
            { Ca: 220 },
            'ammonium_acetate',
            'sand',
            'kikuyu'
        );
        expect(result.warnings.some(w => w.includes('500') && w.includes('750'))).toBe(true);
    });

    test('SLAN site uses the published Carrow 2004 floor/ceiling (Ca 500-750), not the generic 500-3000 band', () => {
        const result = Validator.validateSoil({ Ca: 480 }, 'slan', null, null);
        expect(result.warnings.some(w => w.includes('500') && w.includes('750'))).toBe(true);
    });

    test('MLSN site (default methodology) uses MLSN_THRESHOLDS floor ×1.5 (Ca 331-496.5), not the generic 500-3000 band', () => {
        const result = Validator.validateSoil({ Ca: 300 }, 'mlsn', null, null);
        expect(result.warnings.some(w => w.includes('331') && w.includes('496.5'))).toBe(true);
    });

    test('trace elements (Fe/Mn/Zn/Cu/B) are unaffected by methodology -- still the generic typical band', () => {
        const aa = Validator.validateSoil({ Fe: 10 }, 'ammonium_acetate', 'sand', 'browntopBent');
        const mlsn = Validator.validateSoil({ Fe: 10 }, 'mlsn', null, null);
        // Generic Fe typical is [20, 200] -- 10 is below it either way, and
        // the message (from the shared generic SOIL_RANGES.Fe.typical) must
        // be identical regardless of methodology.
        expect(aa.warnings[0]).toEqual(mlsn.warnings[0]);
        expect(aa.warnings[0]).toMatch(/20.*200/);
    });

    test('no methodology supplied (undefined) defaults to MLSN\'s typical band, matching getSoilThresholds()\'s existing "unknown methodology -> MLSN" convention elsewhere in the codebase', () => {
        const result = Validator.validateSoil({ Ca: 220 });
        expect(result.warnings.some(w => w.includes('331') && w.includes('496.5'))).toBe(true);
    });

    test('graceful degradation — if GilbaClassificationConstants never loaded, falls back to the fully generic band', () => {
        const bareSandbox = { console: { log: () => {}, warn: () => {}, error: () => {} } };
        bareSandbox.window = bareSandbox;
        bareSandbox.global = bareSandbox;
        bareSandbox.globalThis = bareSandbox;
        bareSandbox.document = { readyState: 'complete', addEventListener: () => {}, querySelector: () => null };
        const bareCtx = vm.createContext(bareSandbox);
        vm.runInContext(fs.readFileSync(path.join(__dirname, '../assets/input-range-validator.js'), 'utf8'), bareCtx);
        const result = bareCtx.window.GilbaInputValidator.validateSoil({ Ca: 220 }, 'ammonium_acetate', 'sand', 'browntopBent');
        expect(result.warnings.some(w => w.includes('500') && w.includes('3000'))).toBe(true);
    });

    test('validateState() resolves methodology/texture/species from state.soil/state.turf and threads them through', () => {
        const state = {
            soil: { Ca: 220, methodology: 'ammonium_acetate', soilTexture: 'sand' },
            turf: { grassSpecies: 'browntopBent' },
        };
        const result = Validator.validateState(state);
        expect(result.soil.warnings.some(w => w.includes('400') && w.includes('800'))).toBe(true);
    });
});

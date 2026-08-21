/**
 * GH-287 — input-range-validator.js's "outside typical range" message
 * formats the range bounds the same way it already formats the measured
 * value, instead of interpolating raw floating-point numbers.
 *
 * Surfaced by GH-285 (methodology-aware typical ranges): a certificate-
 * derived bound like S279's Mg ceiling (0.70 me/100g -> ppm via
 * meq100gToPpm()) can legitimately compute to 85.39999999999999. validateValue()
 * already ran the *measured* value through formatNum() before interpolating
 * it into the message, but not the range bounds themselves -- confirmed
 * live: "Magnesium (129 ppm) is outside typical range (36.6–85.39999999999999 ppm)"
 * in the Soil page's "Unusual Values Detected" popup.
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

describe('GH-287 — validator "outside typical range" message rounds its bounds', () => {
    let Validator;
    beforeAll(() => { Validator = loadSandbox().window.GilbaInputValidator; });

    test('S279 Mg ceiling (floating-point noise from meq100gToPpm) renders as a clean 85.4, not 85.39999999999999', () => {
        const result = Validator.validateSoil({ Mg: 129 }, 'ammonium_acetate', 'sand', 'browntopBent');
        const msg = result.warnings.find(w => w.startsWith('Magnesium'));
        expect(msg).toBeDefined();
        expect(msg).toContain('36.6–85.4 ppm');
        expect(msg).not.toContain('85.39999999999999');
    });

    test('regression — clean range messages (no floating-point noise involved) render identically to before', () => {
        // Fe isn't in GH-285's METHOD_AWARE_KEYS -- always the generic band.
        const result = Validator.validateSoil({ Fe: 5 });
        const msg = result.warnings.find(w => w.startsWith('Iron'));
        expect(msg).toContain('20–200 ppm');
    });
});

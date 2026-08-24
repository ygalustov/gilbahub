/**
 * GH-290 (D07 item 5) — word-export.js's AA sample-type resolution now tries
 * HillLabsSampleTypes.deriveCode(species, texture) before falling back to a
 * hardcoded 'S277' default.
 *
 * Background: the existing priority chain was (1) soilInput.aaSampleType,
 * (2) DOM `.gaip-aa-sample-type`, (3) hardcoded 'S277'. Confirmed both (1)
 * and (2) are dead in practice -- no file anywhere ever sets
 * soilInput.aaSampleType, and `.gaip-aa-sample-type` doesn't exist in any
 * blade view -- so every AA site's Word export silently used S277's
 * thresholds regardless of its real species/texture (e.g. a Browntop Bent/
 * Sand site, which has its own certificate, S279, still got S277's numbers
 * in the exported "Annual Soil Amendments" table).
 *
 * Fix: added a new step between the dead DOM fallback and the hardcoded
 * default, calling HillLabsSampleTypes.deriveCode() with the site's real
 * species (data.turf.grassSpecies/species) and texture (soilInput.
 * soilTexture) -- the same resolver mlsnEngine() (GH-260) and
 * SampleAnalysisController.php (GH-268) already use. Only reaches the old
 * 'S277' default now for genuinely uncovered species/texture combinations
 * (deriveCode() returns null).
 *
 * word-export.js is large enough (14k+ lines, heavy DOM/window
 * dependencies) that executing it in a vm sandbox for this one branch isn't
 * practical -- structural source-pattern pins instead, matching this
 * repo's existing convention for word-export.js tests (see
 * tests/monthly-n-distribution-renderer-b35fix387.test.js).
 */

const fs = require('fs');
const path = require('path');

describe('GH-290 — word-export.js AA sample-type resolution tries deriveCode() before the S277 default', () => {
    let src;
    beforeAll(() => {
        src = fs.readFileSync(path.join(__dirname, '../assets/word-export.js'), 'utf8');
    });

    test('deriveCode() call is present, reading species from data.turf and texture from soilInput.soilTexture', () => {
        expect(src).toMatch(/window\.HillLabsSampleTypes\.deriveCode\(/);
        const idx = src.indexOf('window.HillLabsSampleTypes.deriveCode(');
        const call = src.slice(idx, idx + 300);
        expect(call).toMatch(/data\.turf\s*&&\s*\(data\.turf\.grassSpecies\s*\|\|\s*data\.turf\.species\)/);
        expect(call).toMatch(/soilInput\s*&&\s*soilInput\.soilTexture/);
    });

    test('deriveCode() is tried strictly between the dead DOM fallback and the hardcoded S277 default', () => {
        const domIdx = src.indexOf("document.querySelector('.gaip-aa-sample-type')");
        const deriveIdx = src.indexOf('window.HillLabsSampleTypes.deriveCode(');
        const defaultIdx = src.indexOf("if (!aaSampleType) aaSampleType = 'S277';");
        expect(domIdx).toBeGreaterThan(-1);
        expect(deriveIdx).toBeGreaterThan(domIdx);
        expect(defaultIdx).toBeGreaterThan(deriveIdx);
    });

    test('the derived code is only applied when non-null (does not clobber an already-resolved aaSampleType)', () => {
        const idx = src.indexOf('var _derivedAaCode = window.HillLabsSampleTypes.deriveCode(');
        expect(idx).toBeGreaterThan(-1);
        const body = src.slice(idx, idx + 350);
        expect(body).toMatch(/if\s*\(_derivedAaCode\)\s*aaSampleType\s*=\s*_derivedAaCode;/);
    });

    test('regression — the hardcoded S277 default line itself is untouched (still the final fallback)', () => {
        expect(src).toMatch(/if \(!aaSampleType\) aaSampleType = 'S277';/);
    });
});

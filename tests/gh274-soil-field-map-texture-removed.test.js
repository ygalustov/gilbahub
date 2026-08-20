/**
 * Test GH-274 — SOIL_FIELD_MAP no longer maps Texture/texture/Soil_Texture to
 * `.gaip-soil-texture`.
 *
 * ROOT CAUSE: a THIRD independent write path to `.gaip-soil-texture`, distinct
 * from both the dedicated soilTextureSnapshot restore GH-272 removed and the
 * hub-persistence.js fallback priority GH-273 fixed. `loadSample()`'s generic
 * per-field population loop (fires on every soil sample load, including the
 * automatic load-on-page-init, not just an explicit dropdown switch) walks
 * every key in SOIL_FIELD_MAP and writes any matching raw sample-payload
 * field straight into the mapped DOM input. `Texture`/`texture`/`Soil_Texture`
 * being one of those keys meant a sample's own raw payload value silently
 * overwrote GH-270's live, site-derived `.gaip-soil-texture` initial value
 * during auto-load, before the user ever clicked Re-run -- so Re-run's
 * hub-persistence.js fallback (fixed to prefer DOM in GH-273) ended up
 * reading this overwritten, wrong value anyway. Confirmed live (Russley):
 * Re-run kept showing the generic "others" AA K range (100.0-235.0ppm) even
 * after GH-273 shipped, while switching samples -- which resolves texture
 * server-side from the site record, never touching this DOM field --
 * correctly showed the S279 certificate range (78.2-195.5ppm).
 *
 * FIX: same reasoning as GH-272 -- soil texture is a site property, not a
 * sample property, so no per-sample field-population path should ever write
 * to `.gaip-soil-texture`. Removed the three keys from SOIL_FIELD_MAP
 * entirely (not re-pointed elsewhere) so nothing under this loop can touch
 * the field again.
 */

const fs = require('fs');
const path = require('path');

describe('GH-274 — SOIL_FIELD_MAP no longer writes sample data into .gaip-soil-texture', () => {
    let src;
    beforeAll(() => {
        src = fs.readFileSync(path.join(__dirname, '../assets/sample-manager.js'), 'utf8');
    });

    function extractSoilFieldMap() {
        const start = src.indexOf('const SOIL_FIELD_MAP = {');
        const end = src.indexOf('\n    };', start);
        return src.slice(start, end);
    }

    test('Texture/texture/Soil_Texture keys are gone from SOIL_FIELD_MAP', () => {
        const block = extractSoilFieldMap();
        expect(block).not.toMatch(/'Texture':\s*'\.gaip-soil-texture'/);
        expect(block).not.toMatch(/'texture':\s*'\.gaip-soil-texture'/);
        expect(block).not.toMatch(/'Soil_Texture':\s*'\.gaip-soil-texture'/);
    });

    test('no SOIL_FIELD_MAP entry maps to .gaip-soil-texture at all', () => {
        const block = extractSoilFieldMap();
        expect(block).not.toMatch(/:\s*'\.gaip-soil-texture'/);
    });

    test('adjacent pH/EC/CEC mappings are untouched (scoped removal only)', () => {
        const block = extractSoilFieldMap();
        expect(block).toMatch(/'pH_Water':\s*'\.gaip-soil-ph'/);
        expect(block).toMatch(/'EC_1_5':\s*'\.gaip-soil-ec'/);
        expect(block).toMatch(/'CEC_meq100g':\s*'\.gaip-cec'/);
    });

    test('file has no syntax errors after the removal', () => {
        expect(() => new Function(src)).not.toThrow();
    });
});

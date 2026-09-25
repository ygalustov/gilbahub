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
const { loadManager } = require('./lib/sample-form-bench');

/**
 * GH-722: the spellings moved out of `sample-manager.js` into
 * `assets/lab-reading-names.json`, and the soil table is built from that map and
 * the manager's own `READING_FIELDS`. The property this file holds is unchanged —
 * no sample column is ever written into `.gaip-soil-texture` — so it is asserted on
 * the two sources the table is built from, and on what loading a sample does.
 */
describe('GH-274 — SOIL_FIELD_MAP no longer writes sample data into .gaip-soil-texture', () => {
    let map;
    let src;
    beforeAll(() => {
        map = JSON.parse(fs.readFileSync(path.join(__dirname, '../assets/lab-reading-names.json'), 'utf8'));
        src = fs.readFileSync(path.join(__dirname, '../assets/sample-manager.js'), 'utf8');
    });

    function soilSpellings() {
        const t = map.types.soil;
        const all = [];
        [t.readings, t.attributes || {}].forEach((g) => Object.keys(g).forEach((k) => g[k].forEach((s) => all.push(s))));
        return all;
    }

    test('Texture/texture/Soil_Texture are not soil spellings in the map', () => {
        const lower = soilSpellings().map((s) => s.toLowerCase());
        expect(lower).not.toContain('texture');
        expect(lower).not.toContain('soil_texture');
    });

    test('no soil reading or attribute fills .gaip-soil-texture', () => {
        const { sm } = loadManager(map);
        const fields = Object.values(sm.readingFields.soil);
        expect(fields.length).toBeGreaterThan(0);
        expect(fields).not.toContain('.gaip-soil-texture');
    });

    test('loading a sample that carries a texture column leaves the texture field alone', () => {
        const { sm, fields } = loadManager(map);
        sm.addSample('soil', { id: 'gh274', label: 'gh274', values: { Texture: 'sand', texture: 'sand', Soil_Texture: 'sand', pH_Water: 6.5 } });
        sm.loadSample('soil', 'gh274');
        // Positive control: the load reached the form at all.
        expect(fields.get('.gaip-soil-ph').value).toBe(6.5);
        expect(fields.has('.gaip-soil-texture') ? fields.get('.gaip-soil-texture').value : '').toBe('');
    });

    test('adjacent pH/EC/CEC spellings still fill their fields (scoped removal only)', () => {
        const { sm } = loadManager(map);
        const bind = sm.readingFields.soil;
        expect(map.types.soil.readings.pH).toContain('pH_Water');
        expect(map.types.soil.readings.EC).toContain('EC_1_5');
        expect(map.types.soil.readings.CEC).toContain('CEC_meq100g');
        expect([bind.pH, bind.EC, bind.CEC]).toEqual(['.gaip-soil-ph', '.gaip-soil-ec', '.gaip-cec']);
    });

    test('file has no syntax errors after the removal', () => {
        expect(() => new Function(src)).not.toThrow();
    });
});

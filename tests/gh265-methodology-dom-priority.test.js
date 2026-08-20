/**
 * Test GH-265 — methodology must trust the live DOM over the sample's
 * (potentially stale) methodologySnapshot; GH-263 got this backwards.
 *
 * GH-263 added `methodologySnapshot`/`soilTextureSnapshot` (server-computed
 * at sample-creation time) and made both win over their respective DOM
 * reads in hub-persistence.js's "empty hub form" fallback. That was correct
 * for soilTexture (`.gaip-soil-texture` is a genuinely dead, static "loam"
 * default in legacy-hub-markup.blade.php — confirmed, no sync path exists)
 * but wrong for methodology: `.gaip-soil-methodology` is auto-selected
 * LIVE on every page load by `ammonium-acetate-methodology.js` based on the
 * site's region ("[AmmoniumAcetate] Auto-selected for NZ region"), so it
 * was already correct before this whole fix chain started. The sample
 * snapshot, in contrast, is frozen at sample-CREATION time and goes stale
 * the moment a site's methodology changes afterwards.
 *
 * Confirmed live (the actual bug report): a real sample's
 * `methodologySnapshot` read `"mlsn"` while the site's current, live
 * methodology was AA — the sample predated the site's switch to AA. GH-263
 * let that stale snapshot override the live-correct DOM value, regressing
 * the Soil page K card back to the exact GH-262 symptom ("AA: 37 ppm").
 *
 * FIX: methodology now resolves DOM first, snapshot only as a fallback
 * behind it (soilTexture's priority is unchanged — snapshot still wins
 * there, since DOM really is dead for that field).
 */

const fs = require('fs');
const path = require('path');

describe('GH-265 — methodology trusts live DOM over a stale sample snapshot', () => {
    let src;
    beforeAll(() => {
        src = fs.readFileSync(path.join(__dirname, '../assets/hub-persistence.js'), 'utf8');
    });

    test('_smMethodDom no longer bakes a default in (the default belongs at the end of the full chain)', () => {
        expect(src).toMatch(/var _smMethodDom\s*=\s*\(document\.querySelector\(['"]\.gaip-soil-methodology['"]\)\s*\|\|\s*\{\}\)\.value;/);
    });

    test('methodology priority is DOM first, then snapshot, then raw, then the mlsn default', () => {
        expect(src).toMatch(/methodology:\s*_smMethodDom\s*\|\|\s*_smSample\.methodologySnapshot\s*\|\|\s*_smRaw\.methodology\s*\|\|\s*'mlsn'/);
    });

    test('soilTexture priority is unchanged from GH-263 (snapshot still wins over DOM)', () => {
        expect(src).toMatch(/soilTexture:\s*_smSample\.soilTextureSnapshot\s*\|\|\s*_smTexDom/);
    });

    test('the old GH-263 methodology-snapshot-first pattern is gone', () => {
        expect(src).not.toMatch(/methodology:\s*_smSample\.methodologySnapshot\s*\|\|\s*_smRaw\.methodology\s*\|\|\s*_smMethodDom/);
    });

    test('file has no syntax errors after the correction', () => {
        expect(() => new Function(src)).not.toThrow();
    });
});

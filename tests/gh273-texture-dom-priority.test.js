/**
 * Test GH-273 — soilTexture must trust the live DOM over the sample's
 * (potentially stale) soilTextureSnapshot, mirroring GH-265's fix for
 * methodology, applied to the field GH-265 deliberately left alone.
 *
 * TIMELINE: GH-263 added `soilTextureSnapshot` and made it win over
 * `.gaip-soil-texture`'s DOM read, because at the time that DOM field was a
 * genuinely dead, static "loam" default (no sync path existed at all).
 * GH-265 fixed the equivalent problem for `methodology` (DOM already live
 * there via region auto-select) but explicitly left texture's
 * snapshot-first priority in place, since the "DOM is dead" premise still
 * held for that field. GH-270 then fixed the actual root cause for texture
 * — `hub.blade.php`/`stadium.blade.php` now initialise `.gaip-soil-texture`
 * from the site's live `soil_texture_override` on every page load — and
 * GH-272 removed a separate per-sample DOM overwrite
 * (`sample-manager.js`) that would have undone GH-270's fix. But this
 * specific fallback's own priority order (in `hub-persistence.js`) was
 * never revisited after DOM became live — it kept trusting the snapshot
 * first, silently re-introducing the exact staleness problem GH-265 had
 * already fixed for methodology, just for the other field this time.
 *
 * Confirmed live (Russley, same site as GH-269-272): Re-run showed the
 * generic "others" AA range (100.0–235.0ppm K) sourced from a stale
 * `soilTextureSnapshot: "loam"` on the auto-loaded sample, while switching
 * samples — a different code path, `SampleAnalysisController.php`, fixed
 * independently in GH-269 to prefer the live site value — correctly showed
 * the S279 certificate range (78.2–195.5ppm) for the exact same site.
 *
 * FIX: soilTexture now resolves DOM first, snapshot only as a fallback
 * behind it, then the historical `'loam'` default — the exact same shape
 * methodology already had from GH-265.
 */

const fs = require('fs');
const path = require('path');

describe('GH-273 — soilTexture trusts live DOM over a stale sample snapshot', () => {
    let src;
    beforeAll(() => {
        src = fs.readFileSync(path.join(__dirname, '../assets/hub-persistence.js'), 'utf8');
    });

    test('_smTexDom no longer bakes a default in (the default belongs at the end of the full chain, matching _smMethodDom\'s shape)', () => {
        expect(src).toMatch(/var _smTexDom\s*=\s*\(document\.querySelector\(['"]\.gaip-soil-texture['"]\)\s*\|\|\s*\{\}\)\.value;/);
    });

    test('soilTexture priority is DOM first, then snapshot, then the loam default', () => {
        expect(src).toMatch(/soilTexture:\s*_smTexDom\s*\|\|\s*_smSample\.soilTextureSnapshot\s*\|\|\s*'loam'/);
    });

    test('the old GH-263 snapshot-first pattern is gone', () => {
        expect(src).not.toMatch(/soilTexture:\s*_smSample\.soilTextureSnapshot\s*\|\|\s*_smTexDom/);
    });

    test('methodology keeps its own GH-265 priority, unaffected by this change', () => {
        expect(src).toMatch(/methodology:\s*_smMethodDom\s*\|\|\s*_smSample\.methodologySnapshot\s*\|\|\s*_smRaw\.methodology\s*\|\|\s*'mlsn'/);
    });

    test('_smTexDom is still reused (not redeclared) for the later ECe DOM fallback', () => {
        const occurrences = (src.match(/var _smTexDom\s*=/g) || []).length;
        expect(occurrences).toBe(1);
    });

    test('file has no syntax errors after the correction', () => {
        expect(() => new Function(src)).not.toThrow();
    });
});

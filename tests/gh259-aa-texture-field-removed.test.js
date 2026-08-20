/**
 * Test GH-259 — retire the decorative AA rootzone-texture control (D07 item 2).
 *
 * `#gaip-sp-aa-soil-texture` (site-settings-panel.js) synced against
 * `.gaip-aa-soil-texture`, an element that only exists in the OLD hub's
 * legacy-hub-markup.blade.php — on every new-hub page the sync silently
 * no-opped, so the control was fully decorative: selecting a value saved
 * nothing and affected nothing. This pins that the dropdown, its container,
 * its dead two-way sync, and its snapshot/restore field are gone, and that
 * the untouched b35fix393 proxy-write plumbing in the same file survives.
 */

const fs = require('fs');
const path = require('path');

describe('GH-259 — decorative AA soil-texture control removed from site-settings-panel.js', () => {
    let src;

    beforeAll(() => {
        src = fs.readFileSync(path.join(__dirname, '../assets/site-settings-panel.js'), 'utf8');
    });

    test('the dropdown and its container markup are gone', () => {
        expect(src).not.toMatch(/gaip-sp-aa-soil-texture/);
        expect(src).not.toMatch(/gaip-sp-aa-texture/);
        expect(src).not.toMatch(/Rootzone Type \(for K\/Mg ranges\)/);
    });

    test('updateAATextureVisibility() and its call sites are gone', () => {
        expect(src).not.toMatch(/updateAATextureVisibility/);
    });

    test('the dead two-way DOM sync against .gaip-aa-soil-texture is gone', () => {
        // Populate-side read
        expect(src).not.toMatch(/document\.querySelector\(['"]\.gaip-aa-soil-texture['"]\)/);
        // Save-side write-back
        expect(src).not.toMatch(/realAATexture/);
        expect(src).not.toMatch(/panelAATexture/);
    });

    test('aaTexture is gone from takeSnapshot()/restoreSnapshot() (Cancel button state)', () => {
        expect(src).not.toMatch(/aaTexture:\s*domVal/);
        expect(src).not.toMatch(/snap\.aaTexture/);
    });

    test('takeSnapshot() still ends on winterMinTemp (structure around the removed field is intact)', () => {
        expect(src).toMatch(/winterMinTemp:\s*domVal\(['"]\.gaip-winter-min-temp['"]\)\s*\n\s*\};/);
    });

    test('restoreSnapshot() still restores winterMinTemp and dispatches state change', () => {
        expect(src).toMatch(/setDomVal\(['"]\.gaip-winter-min-temp['"],\s*snap\.winterMinTemp\)/);
        expect(src).toMatch(/tp\.dispatchStateChange\(\)/);
    });

    test('the b35fix393 proxy-write pattern for methodologyExplicit is untouched by this removal', () => {
        // Same assertions as tests/aa-methodology-soil-proxy-write-b35fix393.test.js,
        // re-pinned here as a regression guard specific to this file's edit.
        const stripped = src.replace(/\/\/.*$/gm, '');
        expect(stripped).not.toMatch(/window\.GAIP_STATE\.soil\.methodologyExplicit\s*=\s*true/);
        expect(src).toMatch(/methodologyExplicit:\s*true/);
        expect(src).toMatch(
            /var\s+_existingSoil\s*=\s*\(window\.GAIP_STATE\.inputs\s*&&\s*window\.GAIP_STATE\.inputs\.soil\)\s*\|\|\s*window\.GAIP_STATE\.soil\s*\|\|\s*\{\}/
        );
    });

    test('Soil Interpretation section still exists with method grid + note (unrelated markup intact)', () => {
        expect(src).toMatch(/gaip-sp-method-grid/);
        expect(src).toMatch(/gaip-sp-method-note/);
    });

    test('file has no syntax errors after the removal', () => {
        expect(() => new Function(src)).not.toThrow();
    });
});

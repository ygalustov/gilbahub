/**
 * GH-353 — word-export.js's _aaRanges IIFE (fixed in GH-352 to read data.soil
 * instead of the unpopulated window.GAIP_STATE.soil) never had a soilTexture
 * field on data.soil at all -- confirmed live via GH-352's own debug log
 * ("soilTexture: null") on a real sand-profile S277 site. Without a texture,
 * HillLabsSampleTypes.deriveCode() can't match the site's actual certificate
 * code, so the certificate-specific range lookup is silently skipped and the
 * generic sands/others AmmoniumAcetateMethodology band is used instead --
 * usually close enough not to matter, but not guaranteed to agree with the
 * live calendar on borderline soil values.
 *
 * FIX: fall back to window.GAIP_HUB_CONFIG.soilTexture -- the same page-level,
 * PHP-injected global nutrition-calendar.js already falls back to for this
 * exact gap (see its own "before soilTexture fallback" debug log). Unlike
 * GAIP_STATE.soil (GH-352's bug), this is set once per page load and isn't a
 * live JS state object that can be unpopulated when collectData() runs.
 */

'use strict';

const fs = require('fs');
const path = require('path');

describe('GH-353 — word-export.js: soilTexture falls back to GAIP_HUB_CONFIG', () => {
    let src;
    beforeAll(() => {
        src = fs.readFileSync(path.join(__dirname, '../assets/word-export.js'), 'utf8');
    });

    test('_soilTexture resolution checks data.soil first, then window.GAIP_HUB_CONFIG.soilTexture', () => {
        const idx = src.indexOf('var _soilTexture = (data.soil &&');
        expect(idx).toBeGreaterThan(-1);
        const block = src.slice(idx, idx + 300);
        expect(block).toMatch(/data\.soil && \(data\.soil\.soilTexture \|\| data\.soil\.texture\)/);
        expect(block).toMatch(/window\.GAIP_HUB_CONFIG && window\.GAIP_HUB_CONFIG\.soilTexture/);
        // data.soil must be checked BEFORE the GAIP_HUB_CONFIG fallback.
        const dataSoilIdx = block.indexOf('data.soil &&');
        const hubConfigIdx = block.indexOf('window.GAIP_HUB_CONFIG');
        expect(dataSoilIdx).toBeLessThan(hubConfigIdx);
    });

    test('_code (deriveCode) and _texKey both use the same _soilTexture variable, not a separate re-read', () => {
        const idx = src.indexOf('var _soilTexture = (data.soil &&');
        const block = src.slice(idx, idx + 1600);
        expect(block).toMatch(/_hlst\.deriveCode\(_species, _soilTexture\)/);
        expect(block).toMatch(/_texKey = String\(_soilTexture \|\| ''\)/);
    });
});

describe('GH-353 — standalone reimplementation: fallback chain behaviour', () => {
    function resolveSoilTexture(dataSoil, hubConfig) {
        return (dataSoil && (dataSoil.soilTexture || dataSoil.texture))
            || (hubConfig && hubConfig.soilTexture)
            || null;
    }

    test('data.soil.soilTexture present -> used directly, GAIP_HUB_CONFIG ignored', () => {
        expect(resolveSoilTexture({ soilTexture: 'clay' }, { soilTexture: 'sand' })).toBe('clay');
    });

    test('data.soil has no texture field at all (the confirmed live bug) -> falls back to GAIP_HUB_CONFIG.soilTexture', () => {
        expect(resolveSoilTexture({ methodology: 'AMMONIUM_ACETATE' }, { soilTexture: 'sand' })).toBe('sand');
    });

    test('neither source has a texture -> null (deriveCode() then falls to its own default, unchanged)', () => {
        expect(resolveSoilTexture({}, {})).toBeNull();
        expect(resolveSoilTexture(null, null)).toBeNull();
    });
});

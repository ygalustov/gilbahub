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
 *
 * GH-355 follow-up: confirmed live (DB read of samples.soil_texture_snapshot
 * = 'sand', plus a full automated export re-run) that GAIP_HUB_CONFIG.soilTexture
 * ALSO comes back empty on a real site -- the numbers still matched the live
 * calendar (0/0/0) only because the generic band happened to agree with the
 * real S277 range at those ppm levels; derived code stayed null. Added a
 * THIRD, tried-first source: window.GAIP_STATE.turf.construction
 * ('sand_profile' -> 'sand'), confirmed reliably populated this early (species
 * resolution a few lines up already depends on the same _stTurf object) and
 * the same site-config field hub-tissue-v3.js's own AA texture bucketing
 * already keys off.
 */

'use strict';

const fs = require('fs');
const path = require('path');

describe('GH-353/355 — word-export.js: soilTexture falls back through construction -> data.soil -> GAIP_HUB_CONFIG', () => {
    let src;
    beforeAll(() => {
        src = fs.readFileSync(path.join(__dirname, '../assets/word-export.js'), 'utf8');
    });

    test('_constructionTexture maps GAIP_STATE.turf.construction sand_profile -> sand, matching hub-tissue-v3.js\'s own bucketing', () => {
        const idx = src.indexOf('var _constructionTexture =');
        expect(idx).toBeGreaterThan(-1);
        const block = src.slice(idx, idx + 200);
        expect(block).toMatch(/_stTurf\.construction === 'sand_profile' \|\| _stTurf\.construction === 'sand profile'/);
        expect(block).toMatch(/\? 'sand' : null;/);
    });

    test('_soilTexture tries construction first, then data.soil, then GAIP_HUB_CONFIG.soilTexture, in that order', () => {
        const idx = src.indexOf('var _soilTexture = _constructionTexture');
        expect(idx).toBeGreaterThan(-1);
        const block = src.slice(idx, idx + 300);
        expect(block).toMatch(/data\.soil && \(data\.soil\.soilTexture \|\| data\.soil\.texture\)/);
        expect(block).toMatch(/window\.GAIP_HUB_CONFIG && window\.GAIP_HUB_CONFIG\.soilTexture/);
        const constructionIdx = block.indexOf('_constructionTexture');
        const dataSoilIdx = block.indexOf('data.soil &&');
        const hubConfigIdx = block.indexOf('window.GAIP_HUB_CONFIG');
        expect(constructionIdx).toBeLessThan(dataSoilIdx);
        expect(dataSoilIdx).toBeLessThan(hubConfigIdx);
    });

    test('_code (deriveCode) and _texKey both use the same _soilTexture variable, not a separate re-read', () => {
        const idx = src.indexOf('var _soilTexture = _constructionTexture');
        const block = src.slice(idx, idx + 1900);
        expect(block).toMatch(/_hlst\.deriveCode\(_species, _soilTexture\)/);
        expect(block).toMatch(/_texKey = String\(_soilTexture \|\| ''\)/);
    });
});

describe('GH-353/355 — standalone reimplementation: full fallback chain behaviour', () => {
    function resolveSoilTexture(construction, dataSoil, hubConfig) {
        const constructionTexture = (construction === 'sand_profile' || construction === 'sand profile') ? 'sand' : null;
        return constructionTexture
            || (dataSoil && (dataSoil.soilTexture || dataSoil.texture))
            || (hubConfig && hubConfig.soilTexture)
            || null;
    }

    test('GAIP_STATE.turf.construction = sand_profile wins over everything else (confirmed reliable at this point live)', () => {
        expect(resolveSoilTexture('sand_profile', { soilTexture: 'loam' }, { soilTexture: 'clay' })).toBe('sand');
    });

    test('non-sand construction + no data.soil texture -> falls to GAIP_HUB_CONFIG', () => {
        expect(resolveSoilTexture('push_up', null, { soilTexture: 'loam' })).toBe('loam');
    });

    test('data.soil.soilTexture present, construction absent -> used directly', () => {
        expect(resolveSoilTexture(null, { soilTexture: 'clay' }, { soilTexture: 'sand' })).toBe('clay');
    });

    test('nothing resolves anywhere -> null (deriveCode() then falls to its own default, unchanged)', () => {
        expect(resolveSoilTexture(null, {}, {})).toBeNull();
        expect(resolveSoilTexture(undefined, null, null)).toBeNull();
    });

    test('the exact live GH-355 case: construction unknown/missing, data.soil and GAIP_HUB_CONFIG both empty -> null (matches confirmed live log before this fix)', () => {
        expect(resolveSoilTexture(undefined, { methodology: 'AMMONIUM_ACETATE' }, {})).toBeNull();
    });
});

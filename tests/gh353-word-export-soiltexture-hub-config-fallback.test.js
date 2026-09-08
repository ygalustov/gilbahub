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
 * exact gap.
 *
 * GH-355 follow-up: GAIP_HUB_CONFIG.soilTexture ALSO came back empty on the
 * live site, so a third source was added -- window.GAIP_STATE.turf.construction
 * ('sand_profile' -> 'sand') -- and tried FIRST.
 *
 * GH-357 then found the real reason GAIP_HUB_CONFIG.soilTexture was empty:
 * ReportsController/export.blade.php never passed it through on that page at
 * all. With that fixed the construction guess is no longer needed as a primary
 * source, but GH-355's ordering stayed behind it.
 *
 * GH-364 corrects the ordering. construction is a two-way bucket
 * ('sand_profile' -> sand, everything else -> nothing); GAIP_HUB_CONFIG
 * .soilTexture is the site's real sites.soil_texture_override /
 * accounts.soil_texture, one of six values. With the guess ranked first, a
 * hybrid site (construction 'sand_profile', texture 'clay_loam') resolved S277
 * in the export while the live Plan page -- which reads only
 * GAIP_HUB_CONFIG.soilTexture, since nutrition-calendar.js has no concept of
 * turf.construction -- resolved the generic band, so UI and export disagreed on
 * P/K/Ca/Mg requirements. That is the parity this whole GH-352..357 chain
 * existed to restore (Hoxton audit assertion 20). construction is now the last
 * resort: still useful where nothing else resolves, never overriding a measured
 * value.
 */

'use strict';

const fs = require('fs');
const path = require('path');

describe('GH-353/355/364 — word-export.js: soilTexture resolution order', () => {
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

    test('GH-364: this sample\'s own recorded texture first, then data.soil, then the active site\'s GAIP_HUB_CONFIG value, and only then the construction guess', () => {
        const idx = src.indexOf('var _soilTexture = _sampleTexture');
        expect(idx).toBeGreaterThan(-1);
        const block = src.slice(idx, src.indexOf(';', idx));
        const sampleIdx = block.indexOf('_sampleTexture');
        const dataSoilIdx = block.indexOf('data.soil &&');
        const hubConfigIdx = block.indexOf('window.GAIP_HUB_CONFIG');
        const constructionIdx = block.indexOf('_constructionTexture');
        [sampleIdx, dataSoilIdx, hubConfigIdx, constructionIdx].forEach((i) => expect(i).toBeGreaterThan(-1));
        expect(sampleIdx).toBeLessThan(dataSoilIdx);
        expect(dataSoilIdx).toBeLessThan(hubConfigIdx);
        expect(hubConfigIdx).toBeLessThan(constructionIdx);
    });

    test('GH-364: the per-sample source is samples.soil_texture_snapshot via SampleManager, read per sample rather than once per page', () => {
        const idx = src.indexOf('var _sampleTexture = null;');
        expect(idx).toBeGreaterThan(-1);
        const block = src.slice(idx, src.indexOf('var _soilTexture = _sampleTexture', idx));
        expect(block).toMatch(/getActiveSample\('soil'\)/);
        expect(block).toMatch(/soilTextureSnapshot/);
    });

    test('_code (deriveCode) and _texKey both use the same _soilTexture variable, not a separate re-read', () => {
        const idx = src.indexOf('var _soilTexture = _sampleTexture');
        const block = src.slice(idx, src.indexOf('data.engineInputs = {', idx));
        expect(block).toMatch(/_hlst\.deriveCode\(_species, _soilTexture\)/);
        expect(block).toMatch(/_texKey = String\(_soilTexture \|\| ''\)/);
    });
});

describe('GH-364 — standalone reimplementation: full fallback chain behaviour', () => {
    function resolveSoilTexture(construction, dataSoil, hubConfig, sampleSnapshot) {
        const constructionTexture = (construction === 'sand_profile' || construction === 'sand profile') ? 'sand' : null;
        return (sampleSnapshot || null)
            || (dataSoil && (dataSoil.soilTexture || dataSoil.texture))
            || (hubConfig && hubConfig.soilTexture)
            || constructionTexture
            || null;
    }

    test('GH-364: this sample\'s own snapshot beats the active site\'s page-level value (the multi-site combined-export case)', () => {
        // Site A is active when the page loads (hubConfig 'sand'), the export
        // also covers site B whose sample was taken on clay.
        expect(resolveSoilTexture('sand_profile', null, { soilTexture: 'sand' }, 'clay')).toBe('clay');
    });

    test('GH-364 regression: a hybrid site\'s real texture beats the sand_profile guess (this is the UI/export parity case)', () => {
        expect(resolveSoilTexture('sand_profile', null, { soilTexture: 'clay_loam' })).toBe('clay_loam');
        expect(resolveSoilTexture('sand_profile', { soilTexture: 'loam' }, { soilTexture: 'clay' })).toBe('loam');
    });

    test('construction still resolves when nothing measured is available', () => {
        expect(resolveSoilTexture('sand_profile', null, null)).toBe('sand');
        expect(resolveSoilTexture('sand_profile', {}, {})).toBe('sand');
    });

    test('non-sand construction + no data.soil texture -> falls to GAIP_HUB_CONFIG', () => {
        expect(resolveSoilTexture('push_up', null, { soilTexture: 'loam' })).toBe('loam');
    });

    test('data.soil.soilTexture present -> used ahead of GAIP_HUB_CONFIG', () => {
        expect(resolveSoilTexture(null, { soilTexture: 'clay' }, { soilTexture: 'sand' })).toBe('clay');
    });

    test('nothing resolves anywhere -> null (deriveCode() then returns null for a non-sand/empty texture, no default)', () => {
        expect(resolveSoilTexture(null, {}, {})).toBeNull();
        expect(resolveSoilTexture(undefined, null, null)).toBeNull();
    });
});

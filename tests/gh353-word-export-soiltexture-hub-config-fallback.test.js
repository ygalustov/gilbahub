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
 *
 * GH-383 (D31 stage 1): this chain is no longer in word-export.js. It is
 * assets/nutrition-program-inputs.js's resolveSoilTexture(), the ONE resolver
 * both the Word export and the Plan page call — which is what the whole
 * GH-352..364 sequence was trying to achieve by keeping two copies in step.
 * The structural assertions below follow it there; the behavioural
 * reimplementation at the bottom is unchanged and still encodes the same
 * ordering.
 */

'use strict';

const fs = require('fs');
const path = require('path');

describe('GH-353/355/364/383 — nutrition-program-inputs.js: soilTexture resolution order', () => {
    let src;
    let exportSrc;
    beforeAll(() => {
        src = fs.readFileSync(path.join(__dirname, '../assets/nutrition-program-inputs.js'), 'utf8');
        exportSrc = fs.readFileSync(path.join(__dirname, '../assets/word-export.js'), 'utf8');
    });

    test('GH-383: word-export.js no longer resolves a texture of its own — it reads the adapter\'s', () => {
        expect(exportSrc).not.toMatch(/var _constructionTexture =/);
        expect(exportSrc).toMatch(/_resolvedSoilTexture = _programInputs \? _programInputs\.soilTexture : null;/);
    });

    test('constructionTexture maps turf.construction sand_profile -> sand, matching hub-tissue-v3.js\'s own bucketing', () => {
        const idx = src.indexOf('const constructionTexture =');
        expect(idx).toBeGreaterThan(-1);
        const block = src.slice(idx, idx + 220);
        expect(block).toMatch(/turf\.construction === 'sand_profile' \|\| turf\.construction === 'sand profile'/);
        expect(block).toMatch(/\? 'sand' : null;/);
    });

    test('GH-364: this sample\'s own recorded texture first, then the sample soil object, then the site config value, and only then the construction guess', () => {
        const idx = src.indexOf("if (sampleTexture) return { value: sampleTexture, source: 'sample-snapshot' };");
        expect(idx).toBeGreaterThan(-1);
        const block = src.slice(idx, src.indexOf("source: 'unresolved'", idx));
        const sampleIdx = block.indexOf('sampleTexture');
        const dataSoilIdx = block.indexOf('soil.soilTexture || soil.texture');
        const hubConfigIdx = block.indexOf('GAIP_HUB_CONFIG');
        const constructionIdx = block.indexOf('constructionTexture');
        [sampleIdx, dataSoilIdx, hubConfigIdx, constructionIdx].forEach((i) => expect(i).toBeGreaterThan(-1));
        expect(sampleIdx).toBeLessThan(dataSoilIdx);
        expect(dataSoilIdx).toBeLessThan(hubConfigIdx);
        expect(hubConfigIdx).toBeLessThan(constructionIdx);
    });

    test('GH-364: the per-sample source is samples.soil_texture_snapshot via SampleManager, read per sample rather than once per page', () => {
        const idx = src.indexOf('let sampleTexture = opts.sampleTextureSnapshot || null;');
        expect(idx).toBeGreaterThan(-1);
        const block = src.slice(idx, src.indexOf('const soil = opts.soil || {};', idx));
        expect(block).toMatch(/getActiveSample\('soil'\)/);
        expect(block).toMatch(/soilTextureSnapshot/);
    });

    test('GH-383: deriveCode() and the sands/others bucket both read the ONE resolved texture, in the ONE resolver', () => {
        const idx = src.indexOf('function resolveSufficiencyRanges(opts)');
        expect(idx).toBeGreaterThan(-1);
        const block = src.slice(idx, src.indexOf('if (methodology === \'slan\')', idx));
        expect(block).toMatch(/aaTextureKey\(opts\.soilTexture\)/);
        expect(block).toMatch(/hlst\.deriveCode\(speciesForCode, opts\.soilTexture \|\| null\)/);
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

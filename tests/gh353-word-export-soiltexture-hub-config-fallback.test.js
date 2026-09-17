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
 *
 * GH-482 ENDS the chain this file was written about. The owner's decision on
 * question 10.8(17): a report is interpreted against the settings a user can
 * see, and a mark recorded on a sample is not one of them — the methodology or
 * the texture may have been changed in Settings after the row was written. So
 * the snapshot is not in the chain at any position, and with it went the two
 * rungs that stood below it: the texture off the sample's own soil object, and
 * the bucket guessed from the construction type, which was a substitution
 * rather than a setting anybody made. What remains is two links,
 * `sites.soil_texture_override` and `accounts.soil_texture`, read from the row
 * by id — the same rule the server applies to itself.
 *
 * The ordering tests below are replaced by tests of that rule; the standalone
 * reimplementation of the old chain is gone, because the product no longer has
 * a chain for it to reimplement.
 */

'use strict';

const fs = require('fs');
const path = require('path');
const { anchoredSlice, anchoredWindow, anchorIndex } = require('./lib/anchored-slice');

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

    test('GH-482: the construction guess is gone — a rootzone TYPE is not a texture measurement', () => {
        expect(src).not.toMatch(/const constructionTexture =/);
        expect(src).not.toMatch(/source: 'turf-construction'/);
    });

    test('GH-482: two links and nothing else — the site\'s column, then the account\'s setting', () => {
        const block = anchoredWindow(src, 'function resolveSoilTexture(opts)', 400);
        expect(block).toMatch(/if \(opts\.siteTextureOverride\) return \{ value: opts\.siteTextureOverride, source: 'site-override' \};/);
        expect(block).toMatch(/if \(opts\.accountTexture\) return \{ value: opts\.accountTexture, source: 'account' \};/);
        expect(block).toMatch(/return \{ value: null, source: 'unresolved' \};/);
        // and nothing that used to stand between them
        expect(block).not.toMatch(/sampleTexture/);
        expect(block).not.toMatch(/GAIP_HUB_CONFIG/);
        expect(block).not.toMatch(/constructionTexture/);
    });

    test('GH-482: the snapshot is not read anywhere in this resolver', () => {
        expect(src).not.toMatch(/soilTextureSnapshot/);
        expect(src).not.toMatch(/sampleTextureSnapshot/);
    });

    test('GH-482: the two links are read from the row that owns them, by id', () => {
        const block = anchoredWindow(src, 'function siteTextureSettingFor(siteId)', 1400);
        expect(block).toMatch(/SC\.getSite\(siteId\)/);
        expect(block).toMatch(/row\.soil_texture_override/);
        expect(block).toMatch(/row\.account_soil_texture/);
        // Where there is no row — the Plan page does not load the site store —
        // the same two links come from the server, which walked them for that
        // page's own site (PageController.php:66). It is read for THAT site
        // and no other, which is what makes it the same fact rather than a
        // page-wide answer.
        expect(block).toMatch(/hub\.activeSiteId && String\(hub\.activeSiteId\) !== String\(siteId\)/);
    });

    test('GH-383: deriveCode() and the sands/others bucket both read the ONE resolved texture, in the ONE resolver', () => {
        const block = anchoredSlice(src, 'function resolveSufficiencyRanges(opts)', 'if (methodology === \'slan\')');
        expect(block).toMatch(/aaTextureKey\(opts\.soilTexture\)/);
        expect(block).toMatch(/hlst\.deriveCode\(speciesForCode, opts\.soilTexture \|\| null\)/);
    });
});

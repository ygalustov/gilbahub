/**
 * GH-245 follow-up 2 — combined export resolves climate normals per sample's
 * own site, not just whichever site is active when the export starts.
 *
 * Background: window.climateMetrics (and the window it lives in) is a
 * single slot. Combined export can span genuinely different sites in one
 * document — a Vietnam couch course + a Bowral bentgrass green + a Sydney
 * fairway is the exact scenario named in this file's own b35fix313 comment,
 * describing why _buildEngineInputs' turf/hemisphere/overseed context is
 * captured per sample during the collection loop. Before this fix, climate
 * normals were the one context field NOT captured per sample — every sample
 * read whichever site's answer happened to be sitting in
 * window.climateMetrics.monthlyTemps, i.e. usually the first (or none, if
 * the export button was clicked before any fetch resolved).
 *
 * Fix: a pre-pass in exportCombinedWithSamples() resolves every distinct
 * site's coordinates via GilbaClimateNormalsService.resolveFor() (which
 * caches per-coordinate, not per-"current site") before the main loop.
 * _buildEngineInputs() (word-export.js) then reads back that specific
 * sample's result synchronously via getResolvedSync(_lat, _lon), once
 * setActiveSite() has switched .gaip-lat/.gaip-lon to that sample's site.
 *
 * Source-pattern tests — see hoxton-fertiliser-integrations-null-guard.test.js
 * and monthly-n-distribution-renderer-b35fix387.test.js for this repo's
 * established convention for this kind of guard, where a full behavioural
 * test would need to mock the entire sample-manager/site-config/docx
 * dependency graph.
 */

'use strict';

const fs = require('fs');
const path = require('path');
const { anchoredSlice, anchoredWindow, anchorIndex } = require('./lib/anchored-slice');

let combinedSrc, exportSrc;
beforeAll(() => {
    combinedSrc = fs.readFileSync(path.join(__dirname, '../assets/word-export-combined.js'), 'utf8');
    exportSrc = fs.readFileSync(path.join(__dirname, '../assets/word-export.js'), 'utf8');
});

describe('word-export-combined.js — per-site climate normals pre-pass', () => {
    test('exportCombinedWithSamples resolves distinct site coordinates before the main loop', () => {
        const fnStart = combinedSrc.indexOf('async function exportCombinedWithSamples(samples)');
        expect(fnStart).toBeGreaterThan(-1);

        const loopStart = combinedSrc.indexOf('for (var i = 0; i < samples.length; i++)', fnStart);
        expect(loopStart).toBeGreaterThan(-1);

        const preLoop = combinedSrc.slice(fnStart, loopStart);
        expect(preLoop).toMatch(/GilbaClimateNormalsService/);
        expect(preLoop).toMatch(/\.resolveFor\(/);
        expect(preLoop).toMatch(/await Promise\.all\(/);
    });

    test('gathers coordinates per distinct siteId, not per sample (avoids redundant calls for multi-sample sites)', () => {
        const fnStart = combinedSrc.indexOf('async function exportCombinedWithSamples(samples)');
        const loopStart = combinedSrc.indexOf('for (var i = 0; i < samples.length; i++)', fnStart);
        const preLoop = combinedSrc.slice(fnStart, loopStart);

        expect(preLoop).toMatch(/new Set\(samples\.map\(function\(s\) \{ return s\.siteId; \}\)\)/);
    });

    test('reads coordinates from GAIP_SiteConfig.getSite(siteId) — the owner, and not the mergeConfig write path', () => {
        const fnStart = combinedSrc.indexOf('async function exportCombinedWithSamples(samples)');
        const loopStart = combinedSrc.indexOf('for (var i = 0; i < samples.length; i++)', fnStart);
        const preLoop = combinedSrc.slice(fnStart, loopStart);

        // GH-477: from the site row, which owns the coordinates. The copy in
        // `config.location` is derived from that row by the server, so reading
        // the copy was one write path further from the fact for no gain. What
        // this test protects is unchanged: a READ, never the write path.
        expect(preLoop).toMatch(/_sc\.getSite\(siteId\)/);
        expect(preLoop).not.toMatch(/\.mergeConfig\(/);
    });

    test('a missing service or site config degrades to a warning, not a thrown error that aborts the export', () => {
        const fnStart = combinedSrc.indexOf('async function exportCombinedWithSamples(samples)');
        const loopStart = combinedSrc.indexOf('for (var i = 0; i < samples.length; i++)', fnStart);
        const preLoop = combinedSrc.slice(fnStart, loopStart);

        expect(preLoop).toMatch(/if \(_svc && typeof _svc\.resolveFor === 'function' && _sc && typeof _sc\.getConfig === 'function'\)/);
        expect(preLoop).toMatch(/catch \(_climateErr\)/);
    });
});

describe('word-export.js — _buildEngineInputs reads per-sample coordinates, not the single climateMetrics slot', () => {
    test('no longer reads window.climateMetrics.monthlyTemps directly', () => {
        const fnBody = anchoredSlice(exportSrc, 'function _buildEngineInputs(data', 'data.engineInputs = {');

        expect(fnBody).not.toMatch(/window\.climateMetrics\s*&&\s*window\.climateMetrics\.monthlyTemps/);
    });

    test('reads via GilbaClimateNormalsService.getResolvedSync(_lat, _lon) — per-sample coordinates', () => {
        const fnBody = anchoredSlice(exportSrc, 'function _buildEngineInputs(data', 'data.engineInputs = {');

        expect(fnBody).toMatch(/GilbaClimateNormalsService\.getResolvedSync\(_lat, _lon\)/);
    });

    test('resolves both coordinates from the SAMPLE\'S SITE, never from a form field', () => {
        const fnBody = anchoredSlice(exportSrc, 'function _buildEngineInputs(data', 'data.engineInputs = {');
        const code = fnBody.split('\n').filter((l) => !/^\s*(\/\/|\*|\/\*)/.test(l)).join('\n');

        // GH-459: these two lines pinned `.gaip-lat` / `.gaip-lon` — the defect
        // itself. A form field belongs to whichever site the page has finished
        // painting, and the combined export calls this function once per sample
        // while switching sites, so the field is a race the export loses on a
        // slower machine: the owner's report printed an Auckland site on
        // Christchurch temperatures, with the annual total still reconciling
        // because it is normalised to the target.
        expect(code).not.toMatch(/\.gaip-lat/);
        expect(code).not.toMatch(/\.gaip-lon/);
        expect(code).toMatch(/getSiteConfig\(/);
        expect(code).toMatch(/_sampleSiteConfig\s*&&\s*_sampleSiteConfig\.location/);
        expect(code).toMatch(/var _lon\b/);
    });

    test('latitude/longitude are computed before the climate lookup that depends on them', () => {
        const fnBody = anchoredSlice(exportSrc, 'function _buildEngineInputs(data', 'data.engineInputs = {');

        const latIdx = fnBody.indexOf('var _lat = _coordLocation');
        const lookupIdx = fnBody.indexOf('getResolvedSync(_lat, _lon)');

        expect(latIdx).toBeGreaterThan(-1);
        expect(lookupIdx).toBeGreaterThan(-1);
        expect(latIdx).toBeLessThan(lookupIdx);
    });

    test('no other calculation input is taken from the page\'s current state either', () => {
        const fnBody = anchoredSlice(exportSrc, 'function _buildEngineInputs(data', 'data.engineInputs = {');
        const code = fnBody.split('\n').filter((l) => !/^\s*(\/\/|\*|\/\*)/.test(l)).join('\n');

        // GH-459: the coordinates were one of three. A run on the same tree
        // printed the previous site's SPECIES with correct coordinates — the
        // mirror of the owner's case — and the overseed state is the third,
        // a page-level global with no site stamp at all. Each is read per
        // site now, so none of them can be half-fixed.
        expect(code).not.toMatch(/GAIP_CANONICAL_STATE/);
        expect(code).not.toMatch(/GAIP_STATE/);
        expect(code).not.toMatch(/GAIP_OVERSEED_STATE/);
        expect(code).not.toMatch(/\.gaip-species/);
        // and the species it does use comes from the sample or that site
        expect(code).toMatch(/_siteTurf\.species/);
    });
});

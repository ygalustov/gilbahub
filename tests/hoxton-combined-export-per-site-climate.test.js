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

    test('reads coordinates from GAIP_SiteConfig.getConfig(siteId).location — a safe read, not the mergeConfig write path', () => {
        const fnStart = combinedSrc.indexOf('async function exportCombinedWithSamples(samples)');
        const loopStart = combinedSrc.indexOf('for (var i = 0; i < samples.length; i++)', fnStart);
        const preLoop = combinedSrc.slice(fnStart, loopStart);

        expect(preLoop).toMatch(/_sc\.getConfig\(siteId\)/);
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
        const fnStart = exportSrc.indexOf('function _buildEngineInputs(data)');
        expect(fnStart).toBeGreaterThan(-1);
        const fnBody = exportSrc.slice(fnStart, fnStart + 11000);

        expect(fnBody).not.toMatch(/window\.climateMetrics\s*&&\s*window\.climateMetrics\.monthlyTemps/);
    });

    test('reads via GilbaClimateNormalsService.getResolvedSync(_lat, _lon) — per-sample coordinates', () => {
        const fnStart = exportSrc.indexOf('function _buildEngineInputs(data)');
        const fnBody = exportSrc.slice(fnStart, fnStart + 11000);

        expect(fnBody).toMatch(/GilbaClimateNormalsService\.getResolvedSync\(_lat, _lon\)/);
    });

    test('resolves longitude (.gaip-lon), not latitude alone — getResolvedSync needs both', () => {
        const fnStart = exportSrc.indexOf('function _buildEngineInputs(data)');
        const fnBody = exportSrc.slice(fnStart, fnStart + 11000);

        expect(fnBody).toMatch(/\.gaip-lon/);
        expect(fnBody).toMatch(/var _lon\b/);
    });

    test('latitude/longitude are computed before the climate lookup that depends on them', () => {
        const fnStart = exportSrc.indexOf('function _buildEngineInputs(data)');
        const fnBody = exportSrc.slice(fnStart, fnStart + 11000);

        const latIdx = fnBody.indexOf('var _lat = _latEl');
        const lookupIdx = fnBody.indexOf('getResolvedSync(_lat, _lon)');

        expect(latIdx).toBeGreaterThan(-1);
        expect(lookupIdx).toBeGreaterThan(-1);
        expect(latIdx).toBeLessThan(lookupIdx);
    });
});

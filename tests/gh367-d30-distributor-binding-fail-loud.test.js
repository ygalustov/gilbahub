/**
 * GH-367 (Hoxton audit D30, closing the two halves GH-362 left open).
 *
 * An independent review of GH-362 found that the D30 work had fixed which
 * COUNTRY's catalogue an export uses, but not the two bindings the client's own
 * "Fix shape" paragraph actually asks about:
 *
 *   1. "Does the export path receive the distributor at all, or receive it and
 *      ignore it?" -- `(_siteCfg && _siteCfg.nzDistributor) || 'all'` collapsed
 *      "the operator never picked one" (legitimate: 'all' is the dropdown's own
 *      default), "the site config could not be read" and "the filter machinery
 *      is missing" into the same silent widening of the catalogue. Assertion 16
 *      of the audit's fixture requires an unresolved binding to be a blocking
 *      failure instead.
 *
 *   2. GH-362's own "coordinates unknown" branch was unreachable: word-export.js
 *      substitutes a Sydney-ish -33/151 placeholder when a site has no saved
 *      coordinates, and those placeholder numbers read downstream as a perfectly
 *      valid Australian location -- so an NZ site with no coordinates silently
 *      resolved to the AU catalogue, which is the audit's D30 symptom exactly.
 *
 * These are structural pins against the two source files, matching this repo's
 * convention for the DOM/docx-heavy export modules that can't be isolated in a
 * sandbox (see gh290/gh291/gh306's headers for the same rationale), plus a
 * standalone reimplementation of the resolution rules so the decision table
 * itself is executable.
 */

'use strict';

const fs = require('fs');
const path = require('path');

const combined = fs.readFileSync(path.join(__dirname, '../assets/word-export-combined.js'), 'utf8');
const single = fs.readFileSync(path.join(__dirname, '../assets/word-export.js'), 'utf8');

describe('GH-367 finding 2 — placeholder coordinates must not pass as a real location', () => {
    test('word-export.js flags when it substituted the Sydney-ish placeholder', () => {
        const idx = single.indexOf('var _coordsDefaulted = false;');
        expect(idx).toBeGreaterThan(-1);
        const block = single.slice(idx, single.indexOf('// GH-245 follow-up 2', idx));
        // Both substitutions must set the flag, not just one.
        expect(block.match(/_coordsDefaulted = true;/g)).toHaveLength(2);
    });

    test('the flag is carried on engineInputs.climate, where the per-sample consumer reads it', () => {
        const idx = single.indexOf('data.engineInputs = {');
        const block = single.slice(idx, single.indexOf('\n        };', idx));
        expect(block).toMatch(/coordinatesDefaulted:\s*_coordsDefaulted/);
    });

    test('the combined export treats defaulted coordinates as unknown rather than as Australia', () => {
        const idx = combined.indexOf('var _sampleNZ =');
        expect(idx).toBeGreaterThan(-1);
        const block = combined.slice(idx, combined.indexOf('var _usePrebble =', idx));
        expect(block).toMatch(/coordinatesDefaulted/);
        expect(block).toMatch(/\?\s*null/);
    });
});

describe('GH-367 finding 1 — an unresolved distributor binding fails loudly', () => {
    test('the site-config lookup records whether it could run, separately from what it returned', () => {
        // GH-383: "the lookup could not run at all" is now caught earlier and
        // harder — nutrition-program-inputs.js's resolveSiteProgramInputs()
        // THROWS rather than falling back to another site's configuration, and
        // the caller skips the sample. By the time _siteCfgLookupOk is set, a
        // config for this site has actually been read.
        const idx = combined.indexOf('var _siteCfgLookupOk = !!_siteCfg;');
        expect(idx).toBeGreaterThan(-1);
        expect(combined).toMatch(/var _siteCfg = _NPI\.getSiteConfig\(r\.siteId\);/);
        expect(combined).toMatch(/refusing to fall back to another site|no programme inputs for site/);
    });

    test('an unreadable site config skips the sample instead of defaulting to the full catalogue', () => {
        const idx = combined.indexOf('if (!_siteCfgLookupOk) {');
        expect(idx).toBeGreaterThan(-1);
        const block = combined.slice(idx, combined.indexOf('var _nzDistributor =', idx));
        expect(block).toMatch(/nutritionProgram = \{ hasData: false \}/);
        expect(block).toMatch(/distributor-unresolved/);
        expect(block).toMatch(/_perSampleProgFail\+\+/);
        expect(block).toMatch(/return;/);
    });

    test('an unappliable filter skips the sample too, except where the raw pool already equals the selection', () => {
        const idx = combined.indexOf("if (!_swappedPrebblePool && _nzDistributor !== 'prebble') {");
        expect(idx).toBeGreaterThan(-1);
        const block = combined.slice(idx, idx + 900);
        expect(block).toMatch(/nutritionProgram = \{ hasData: false \}/);
        expect(block).toMatch(/distributor-filter-unavailable/);
    });

    test('the report states which binding failed rather than one generic message', () => {
        const idx = single.indexOf("var _catReason = data.nutritionProgramCatalogueUnavailableReason;");
        expect(idx).toBeGreaterThan(-1);
        const block = single.slice(idx, idx + 2000);
        expect(block).toMatch(/distributor-unresolved/);
        expect(block).toMatch(/distributor-filter-unavailable/);
        // And each branch must say a programme was deliberately withheld, not
        // that the site has none.
        expect(block.match(/deliberately not/g).length).toBeGreaterThanOrEqual(2);
    });
});

describe('GH-367 — the resolution rules as an executable decision table', () => {
    // Mirrors the two guards in word-export-combined.js's Prebble branch.
    function resolveDistributor({ lookupOk, siteCfg, machineryAvailable }) {
        if (!lookupOk) return { ok: false, reason: 'distributor-unresolved' };
        const distributor = (siteCfg && siteCfg.nzDistributor) || 'all';
        if (!machineryAvailable && distributor !== 'prebble') {
            return { ok: false, reason: 'distributor-filter-unavailable' };
        }
        return { ok: true, distributor };
    }

    test('config read, operator picked a distributor -> honoured', () => {
        expect(resolveDistributor({ lookupOk: true, siteCfg: { nzDistributor: 'pgg_wrightson' }, machineryAvailable: true }))
            .toEqual({ ok: true, distributor: 'pgg_wrightson' });
    });

    test('config read, no distributor saved -> "all", the dropdown\'s own default, is legitimate', () => {
        expect(resolveDistributor({ lookupOk: true, siteCfg: {}, machineryAvailable: true }))
            .toEqual({ ok: true, distributor: 'all' });
        // A site with no gaip config at all is the same situation.
        expect(resolveDistributor({ lookupOk: true, siteCfg: null, machineryAvailable: true }))
            .toEqual({ ok: true, distributor: 'all' });
    });

    test('config could NOT be read -> blocking failure, not "all"', () => {
        expect(resolveDistributor({ lookupOk: false, siteCfg: null, machineryAvailable: true }))
            .toEqual({ ok: false, reason: 'distributor-unresolved' });
    });

    test('machinery missing with a PGG selection -> blocking failure (raw pool is Prebble-only)', () => {
        expect(resolveDistributor({ lookupOk: true, siteCfg: { nzDistributor: 'pgg_wrightson' }, machineryAvailable: false }))
            .toEqual({ ok: false, reason: 'distributor-filter-unavailable' });
    });

    test('machinery missing with an "all" selection -> blocking failure too (raw pool is narrower than "all")', () => {
        expect(resolveDistributor({ lookupOk: true, siteCfg: {}, machineryAvailable: false }))
            .toEqual({ ok: false, reason: 'distributor-filter-unavailable' });
    });

    test('machinery missing with a Prebble selection -> still honoured, the raw pool IS that selection', () => {
        expect(resolveDistributor({ lookupOk: true, siteCfg: { nzDistributor: 'prebble' }, machineryAvailable: false }))
            .toEqual({ ok: true, distributor: 'prebble' });
    });
});

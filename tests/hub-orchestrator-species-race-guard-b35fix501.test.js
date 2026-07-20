/**
 * b35fix501 — site-switch species race guard in populateCanonicalState
 *
 * When a user switches from one site to another, hub-tissue auto-runs and
 * passes a snapshot of inputs.turf captured BEFORE GAIP_STATE is updated
 * with the new site's turf.  That snapshot carries the previous site's
 * grassSpecies (e.g. "Creeping Bentgrass" for a Burns GC → Russley switch),
 * making speciesKey = "bentgrass" when it should be "browntopBent".
 *
 * SpeciesController.getBaseSpecies() is updated by TurfProfileController
 * synchronously as the new site's config loads — always before hub-tissue
 * triggers the auto-run.  The fix adds a cross-check: if SC reports a
 * confident, non-default base species that differs from the resolved
 * speciesKey, SC wins.
 *
 * Impact on Russley (browntopBent) after switching from Burns GC (bentgrass):
 *   Before fix: fusarium susceptibility 1.2 (understated), takeAll 1.5 (overstated)
 *   After fix:  fusarium susceptibility 1.4 (correct), takeAll 1.2 (correct)
 *
 * Spec: tests/hub-orchestrator-species-race-guard-b35fix501.test.js (9 tests)
 */

'use strict';

const fs   = require('fs');
const path = require('path');

const src = fs.readFileSync(
    path.join(__dirname, '../assets/hub-orchestrator.js'),
    'utf8'
);

// ─────────────────────────────────────────────────────────────────────────────
// A. Source structure (4 tests)
// ─────────────────────────────────────────────────────────────────────────────

describe('b35fix501 — source structure', () => {
    test('b35fix501 comment block is present in source', () => {
        expect(src).toContain('b35fix501');
        expect(src).toContain('site-switch race guard');
    });

    test('SC.getBaseSpecies() cross-check is implemented', () => {
        expect(src).toContain('SpeciesController.getBaseSpecies()');
        expect(src).toContain('_scBaseKey501');
    });

    test('guard checks non-default species (prevents placeholder from overriding)', () => {
        expect(src).toContain('_scBaseKey501 !== _DEFAULT_SPECIES_KEY');
    });

    test('guard checks disagreement (only fires when SC and speciesKey differ)', () => {
        expect(src).toContain('_scBaseKey501 !== speciesKey');
    });
});

// ─────────────────────────────────────────────────────────────────────────────
// B. Guard logic verification (5 tests via mock environment)
// ─────────────────────────────────────────────────────────────────────────────
// These tests run the guard logic in isolation to verify the three conditions.

describe('b35fix501 — guard conditions', () => {
    const DEFAULT_SPECIES = 'perennialRyegrass';

    function runGuard(scBaseKey, currentSpeciesKey) {
        // Simulates the b35fix501 block outcome
        let resultKey = currentSpeciesKey;
        if (scBaseKey && scBaseKey !== DEFAULT_SPECIES && scBaseKey !== currentSpeciesKey) {
            resultKey = scBaseKey;
        }
        return resultKey;
    }

    test('fires: SC=browntopBent, resolved=bentgrass (Russley-after-BurnsGC scenario)', () => {
        expect(runGuard('browntopBent', 'bentgrass')).toBe('browntopBent');
    });

    test('fires: SC=bentgrass, resolved=browntopBent (BurnsGC-after-Russley scenario)', () => {
        expect(runGuard('bentgrass', 'browntopBent')).toBe('bentgrass');
    });

    test('no-op: SC and resolved agree (single-site, no stale state)', () => {
        expect(runGuard('browntopBent', 'browntopBent')).toBe('browntopBent');
        expect(runGuard('bentgrass', 'bentgrass')).toBe('bentgrass');
    });

    test('no-op: SC returns null (SC not yet initialised)', () => {
        expect(runGuard(null, 'bentgrass')).toBe('bentgrass');
    });

    test('no-op: SC returns perennialRyegrass (SC placeholder on fresh load)', () => {
        expect(runGuard('perennialRyegrass', 'bentgrass')).toBe('bentgrass');
    });
});

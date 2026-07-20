/**
 * b35fix492 — browntopBent and fineFescue species rows + normalizeSpecies routing
 *
 * Pre-fix: browntopBent resolved to creeping-bent profile via generic `bent`
 * partial; fineFescue resolved to perennialRyegrass (no row). NZ cultivar
 * deltas (Arrowtown, Egmont, Sefton) sat on the wrong baseline.
 *
 * Fix: two new SPECIES_SUSCEPTIBILITY rows; browntop/colonial/capillaris partial
 * match placed BEFORE the generic `bent` partial in normalizeSpecies.
 * COOL_SEASON_HOSTS gains browntopBent and fineFescue.
 *
 * Spec: tests/c63-browntop-finefescue-species-b35fix492.test.js (9 tests)
 */

'use strict';

global.window   = global.window   || {};
global.document = global.document || { addEventListener: () => {}, documentElement: {}, querySelector: () => null };
global.console  = { group: () => {}, groupEnd: () => {}, groupCollapsed: () => {}, log: () => {}, warn: () => {}, info: () => {}, error: () => {} };

const eng                = require('../assets/disease-engine-pure.js');
const normalizeSpecies   = eng.utils.normalizeSpecies;
const SPECIES_SUSCEPTIBILITY = eng.SPECIES_SUSCEPTIBILITY;

// ─────────────────────────────────────────────────────────────────────────────
// 1. normalizeSpecies routing (4 tests)
// ─────────────────────────────────────────────────────────────────────────────

describe('b35fix492 — normalizeSpecies routing', () => {
    test('browntop partial resolves to browntopBent, not bentgrass', () => {
        expect(normalizeSpecies('browntop bent')).toBe('browntopBent');
        expect(normalizeSpecies('browntop')).toBe('browntopBent');
    });

    test('colonial bent resolves to browntopBent', () => {
        expect(normalizeSpecies('colonial bent')).toBe('browntopBent');
        expect(normalizeSpecies('Colonial Bentgrass')).toBe('browntopBent');
    });

    test('Agrostis capillaris aliases resolve to browntopBent', () => {
        expect(normalizeSpecies('Agrostis capillaris')).toBe('browntopBent');
        expect(normalizeSpecies('capillaris')).toBe('browntopBent');
    });

    test('generic "bent" without browntop/colonial/capillaris still resolves to bentgrass', () => {
        expect(normalizeSpecies('creeping bent')).toBe('bentgrass');
        expect(normalizeSpecies('bentgrass')).toBe('bentgrass');
        // 'agrostis' (alias key, no spaces) → bentgrass
        expect(normalizeSpecies('agrostis')).toBe('bentgrass');
    });
});

// ─────────────────────────────────────────────────────────────────────────────
// 2. browntopBent row profile (3 tests)
// ─────────────────────────────────────────────────────────────────────────────

describe('b35fix492 — browntopBent SPECIES_SUSCEPTIBILITY row', () => {
    const bt = SPECIES_SUSCEPTIBILITY.browntopBent;

    test('row exists and fusarium is 1.4 (elevated vs creeping bent 1.2)', () => {
        expect(bt).toBeDefined();
        expect(bt.fusarium).toBe(1.4);
        // Must be higher than creeping bent (primary browntop disease in NZ/AU)
        expect(bt.fusarium).toBeGreaterThan(SPECIES_SUSCEPTIBILITY.bentgrass.fusarium);
    });

    test('takeAll is 1.2 (lower than creeping bent 1.5 — browntop less susceptible)', () => {
        expect(bt.takeAll).toBe(1.2);
        expect(bt.takeAll).toBeLessThan(SPECIES_SUSCEPTIBILITY.bentgrass.takeAll);
    });

    test('grayLeafSpot is 0 and largePatch is 0 (non-hosts for cool-season species)', () => {
        expect(bt.grayLeafSpot).toBe(0);
        expect(bt.largePatch).toBe(0);
    });
});

// ─────────────────────────────────────────────────────────────────────────────
// 3. fineFescue row profile (2 tests)
// ─────────────────────────────────────────────────────────────────────────────

describe('b35fix492 — fineFescue SPECIES_SUSCEPTIBILITY row', () => {
    const ff = SPECIES_SUSCEPTIBILITY.fineFescue;

    test('row exists and redThread is 1.5 (highly susceptible host)', () => {
        expect(ff).toBeDefined();
        expect(ff.redThread).toBe(1.5);
    });

    test('grayLeafSpot is 0.2 (genuine weak host, not zero) and largePatch is 0', () => {
        expect(ff.grayLeafSpot).toBe(0.2);
        expect(ff.largePatch).toBe(0);
    });
});

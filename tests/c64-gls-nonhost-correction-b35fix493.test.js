/**
 * b35fix493 — gray leaf spot non-host zeros
 *
 * Pre-fix: bentgrass 0.5, Poa annua 0.3, Kentucky bluegrass 0.6 in
 * SPECIES_SUSCEPTIBILITY.grayLeafSpot. KBG 0.6 sat above the 0.5 dispatcher
 * gate → engine was running GLS model and emitting risk on a non-host.
 * Bentgrass (0.5) and Poa (0.3) were gate-suppressed but reason-text was wrong.
 *
 * Fix: all three zeroed. Sources: Ohio State HYG-3083, Purdue BP-107-W, Kansas State.
 *
 * Spec: tests/c64-gls-nonhost-correction-b35fix493.test.js (5 tests)
 */

'use strict';

global.window   = global.window   || {};
global.document = global.document || { addEventListener: () => {}, documentElement: {}, querySelector: () => null };
global.console  = { group: () => {}, groupEnd: () => {}, groupCollapsed: () => {}, log: () => {}, warn: () => {}, info: () => {}, error: () => {} };

const eng                = require('../assets/disease-engine-pure.js');
const SPECIES_SUSCEPTIBILITY = eng.SPECIES_SUSCEPTIBILITY;

describe('b35fix493 — gray leaf spot non-host zeros', () => {
    test('bentgrass grayLeafSpot is 0 (was 0.5 — at gate boundary, now explicit zero)', () => {
        expect(SPECIES_SUSCEPTIBILITY.bentgrass.grayLeafSpot).toBe(0);
    });

    test('kentuckyBluegrass grayLeafSpot is 0 (was 0.6 — was above gate, live false positive)', () => {
        expect(SPECIES_SUSCEPTIBILITY.kentuckyBluegrass.grayLeafSpot).toBe(0);
    });

    test('poaAnnua grayLeafSpot is 0 (was 0.3 — gate-suppressed but wrong reason-text)', () => {
        expect(SPECIES_SUSCEPTIBILITY.poaAnnua.grayLeafSpot).toBe(0);
    });

    test('browntopBent grayLeafSpot is 0 (Agrostis capillaris is a documented non-host)', () => {
        expect(SPECIES_SUSCEPTIBILITY.browntopBent.grayLeafSpot).toBe(0);
    });

    // Positive control: GLS still fires on documented true hosts
    test('perennialRyegrass grayLeafSpot is non-zero (true host — positive control)', () => {
        expect(SPECIES_SUSCEPTIBILITY.perennialRyegrass.grayLeafSpot).toBeGreaterThan(0.5);
    });
});

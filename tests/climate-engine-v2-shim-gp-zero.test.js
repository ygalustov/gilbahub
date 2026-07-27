/**
 * Regression guard: the climate-engine-v2.js legacy shim must preserve a
 * hub-tissue-corrected Growth Potential of exactly 0% instead of discarding it.
 *
 * Background:
 *   Pure C4 turf (e.g. Couch) in cold weather legitimately computes GP = 0%
 *   (dormant). hub-tissue-v3.js writes this corrected value to
 *   window.climateMetrics.growth.weighted and sets window.GAIP_CLIMATE_V2_RESULT
 *   to mark the correction as applied.
 *
 *   installLegacyShim()'s hub.store.onChange('computed.climate', ...) handler
 *   re-fires afterwards (reactive store update triggered elsewhere, e.g.
 *   hub-orchestrator's climateMetrics write-back). It used to decide whether
 *   hub-tissue's correction was already applied via:
 *     existingGrowth.weighted != null && existingGrowth.weighted !== 0
 *   The `!== 0` explicitly excluded a legitimate 0% GP, so the shim treated the
 *   correction as absent and overwrote window.climateMetrics.growth with the
 *   store's raw climate.growthPotential — which was live-confirmed to leave
 *   window.climateMetrics.growth.weighted undefined, cascading into
 *   hub-persistence.js and making the Growth & Light analysis page show
 *   "No analysis data found" even right after a real, completed run.
 *
 *   Live console trace that confirmed this (site: pure C4 Couch, 5.3°C):
 *     hub-tissue-v3.js: "Climate V2 GP synced to climateMetrics: 0% -> 0%"
 *     climate-engine-v2.js onChange fires next: hasV2Result=true,
 *       existingGrowth={weighted:0,...}, gpAlreadyCorrected=false (BUG)
 *     hub-persistence.js: "GP(growth.weighted): undefined"
 */

'use strict';

global.window   = global.window   || {};
global.document = global.document || { addEventListener: function () {}, documentElement: {}, querySelector: function () { return null; } };
global.console  = { group: function () {}, groupEnd: function () {}, groupCollapsed: function () {},
                    log: function () {}, warn: function () {}, info: function () {}, error: function () {} };
if (typeof global.CustomEvent === 'undefined') {
    global.CustomEvent = function (name, opts) { this.type = name; this.detail = opts && opts.detail; };
}
global.document.dispatchEvent = function () {};

// growth-potential-engine.js exports Engine directly: module.exports = Engine
global.window.GilbaGrowthPotentialEngine = require('../assets/growth-potential-engine.js');

var onChangeHandlers = {};
var storePeekData = { 'computed.climate': null };

global.window.GilbaHub = {
    engines: { register: function () {} },
    events: { on: function () {} },
    store: {
        onChange: function (key, cb) { onChangeHandlers[key] = cb; },
        peek: function (key) { return storePeekData[key]; },
        set: function () {}
    }
};

require('../assets/climate-engine-v2.js');

describe('climate-engine-v2.js legacy shim — preserves a corrected GP of exactly 0%', () => {

    test('onChange(computed.climate) handler was registered', () => {
        expect(typeof onChangeHandlers['computed.climate']).toBe('function');
    });

    test('preserves existingGrowth (weighted=0) once hub-tissue has corrected it', () => {
        // Simulate: hub-tissue-v3 already ran and wrote the corrected dormant GP.
        global.window.GAIP_CLIMATE_V2_RESULT = { version: '2.0.0' };
        global.window.climateMetrics = {
            growth: { weighted: 0, c3: null, c4: 0 },
            temperature: { mean: 10.1, max: 18.2, min: 2.2 }
        };

        // Store fires with its own raw (uncorrected) growthPotential — must NOT win.
        storePeekData['computed.climate'] = {
            quality: { source: 'api' },
            temperature: { mean: 10.1, max: 18.2, min: 2.2 },
            growthPotential: { weighted: 42, c3: 42, c4: 42, c3Fraction: 1, c4Fraction: 0 }
        };

        onChangeHandlers['computed.climate']();

        expect(window.climateMetrics.growth.weighted).toBe(0);
    });

    test('still uses raw climate.growthPotential when hub-tissue has not corrected yet', () => {
        delete global.window.GAIP_CLIMATE_V2_RESULT;
        delete global.window.climateMetrics;

        storePeekData['computed.climate'] = {
            quality: { source: 'api' },
            temperature: { mean: 10.1, max: 18.2, min: 2.2 },
            growthPotential: { weighted: 42, c3: 42, c4: 42, c3Fraction: 1, c4Fraction: 0 }
        };

        onChangeHandlers['computed.climate']();

        expect(window.climateMetrics.growth.weighted).toBe(42);
    });

});

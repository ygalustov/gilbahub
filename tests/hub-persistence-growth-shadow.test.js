/**
 * Regression guard: hub-persistence.js must not shadow computed.climate.growthPotential
 * (weighted/c3/c4) with a bare computed.climate.growth object when reconstructing
 * dailyPattern.
 *
 * Background:
 *   hub-orchestrator.js writes the analysis result (weighted/c3/c4) to
 *   computed.climate.growthPotential — never to computed.climate.growth.
 *
 *   cacheAnalysisResults() (hub-persistence.js) separately reconstructs dailyPattern
 *   from raw weather data (validateClimateMetrics strips it before this point) and
 *   used to write it straight to a brand-new computed.climate.growth object:
 *     cache.computed.climate.growth = Object.assign({}, cache.computed.climate.growth || {}, { dailyPattern });
 *   Since computed.climate.growth didn't exist yet, this created a *new* object
 *   containing only dailyPattern — no weighted/c3/c4.
 *
 *   growth-light-analysis.js buildClimateView() then resolves growth data as:
 *     var growth = climate.growth || climate.growthPotential || shade.growthData || {};
 *   climate.growth (truthy, but weighted-less) won over climate.growthPotential
 *   (which had the real weighted/c3/c4), so growth.weighted was undefined and the
 *   Growth & Light tab showed "No analysis data found" even right after a real run —
 *   while Disease Risk (a different computed.* key) displayed fine.
 *
 *   Fix: merge dailyPattern into whichever of growth/growthPotential already carries
 *   weighted, instead of creating a bare growth object that shadows growthPotential.
 */

'use strict';

const fs   = require('fs');
const path = require('path');

const src = fs.readFileSync(
    path.join(__dirname, '../assets/hub-persistence.js'),
    'utf8'
);

describe('hub-persistence.js — dailyPattern reconstruction must not shadow growthPotential', () => {

    test('source file is present', () => {
        expect(src.length).toBeGreaterThan(0);
    });

    test('falls back to computed.climate.growthPotential when growth has no weighted value', () => {
        expect(src).toMatch(/cache\.computed\.climate\.growthPotential/);
    });

    test('checks growth.weighted before treating cache.computed.climate.growth as authoritative', () => {
        expect(src).toMatch(/cache\.computed\.climate\.growth\.weighted\s*!==\s*undefined/);
    });

    test('dailyPattern is merged into the resolved growth object, not a bare new one', () => {
        // Guards against regressing to:
        //   cache.computed.climate.growth = Object.assign({}, cache.computed.climate.growth || {}, { dailyPattern: ... });
        // which only ever spreads the (possibly nonexistent) 'growth' key and drops
        // any weighted/c3/c4 that live under 'growthPotential'.
        var idx = src.indexOf('_existingGrowth');
        expect(idx).toBeGreaterThan(-1);
        var window_ = src.slice(idx, idx + 400);
        expect(window_).toMatch(/cache\.computed\.climate\.growth\s*=\s*Object\.assign\(\{\},\s*_existingGrowth/);
    });

});

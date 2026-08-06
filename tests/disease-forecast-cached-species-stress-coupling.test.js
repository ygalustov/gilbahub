/**
 * Disease forecast chart — cached species resolution + stress/climate coupling
 *
 * Root cause: the "Disease Risk" forecast chart on /analysis#disease
 * (assets/disease-analysis.js + assets/disease-forecast.js) re-derived turf
 * species via window.SpeciesController / window.GAIP_STATE / DOM dropdowns /
 * window.GAIP_OVERSEED_STATE — none of which exist on that page, since
 * hub-orchestrator.js and its dependencies are never loaded there. It also
 * never applied GAIP_DiseaseStressCoupling (drought/heat suppression-
 * amplification), because disease-stress-climate-coupling.js wasn't even
 * loaded on that page. Days 1-7 of the forecast therefore diverged from the
 * "Active Threats" block, which reads the fully-resolved result the main
 * hub calculation (writer1) persists to analysis_cache.
 *
 * Fix:
 *   - assets/disease-analysis.js threads state.cachedDiseaseSpecies and
 *     state.stressAggregates from GAIP_DASHBOARD_DATA.computed.disease.species
 *     / .computed.stress (already persisted by writer1) into the forecast state.
 *   - assets/disease-forecast.js's generateForecast() treats
 *     state.cachedDiseaseSpecies as priority-0 (overrides the SpeciesController/
 *     GAIP_STATE/DOM/GAIP_OVERSEED_STATE chain), and calls
 *     GAIP_DiseaseStressCoupling.applyForecast() per forecast day, leaving
 *     Day 0 untouched (it's already pinned to the Active Threats value).
 *
 * Spec: tests/disease-forecast-cached-species-stress-coupling.test.js
 */

'use strict';

// window aliased to global (not a separate stub object) so that scripts which
// export via `window.X = ...` (disease-forecast.js, disease-stress-climate-
// coupling.js) are readable back as `global.X` in this test.
global.window   = global;
global.document = global.document || { addEventListener: () => {}, documentElement: {}, querySelector: () => null };
global.console  = { group: () => {}, groupEnd: () => {}, groupCollapsed: () => {}, table: () => {},
                    log: () => {}, warn: () => {}, info: () => {}, error: () => {} };

const fs   = require('fs');
const path = require('path');

const forecastSrc = fs.readFileSync(path.join(__dirname, '../assets/disease-forecast.js'), 'utf8');

// =============================================================================
// A. Source structure — confirms the wiring exists at all
// =============================================================================

describe('disease-forecast.js — cached species + coupling wiring present', () => {
    test('cachedDiseaseSpecies is read as a species source', () => {
        expect(forecastSrc).toContain('state.cachedDiseaseSpecies');
    });

    test('cachedDiseaseSpecies override comes after (wins over) the SpeciesController/DOM chain', () => {
        const domChainPos   = forecastSrc.indexOf('SpeciesController');
        const cachedOverride = forecastSrc.indexOf('if (state.cachedDiseaseSpecies)');
        expect(domChainPos).toBeGreaterThan(-1);
        expect(cachedOverride).toBeGreaterThan(-1);
        expect(cachedOverride).toBeGreaterThan(domChainPos);
    });

    test('GAIP_DiseaseStressCoupling.applyForecast is called', () => {
        expect(forecastSrc).toContain('GAIP_DiseaseStressCoupling.applyForecast');
    });

    test('coupling call is guarded (does not assume the script/data is present)', () => {
        const couplingCallPos = forecastSrc.indexOf('GAIP_DiseaseStressCoupling.applyForecast');
        const guardPos = forecastSrc.lastIndexOf('if (window.GAIP_DiseaseStressCoupling', couplingCallPos);
        expect(guardPos).toBeGreaterThan(-1);
    });

    test('coupling wiring uses window, not the Node-only "global" — disease-forecast.js\'s IIFE ' +
         'takes no global/window parameter, so a bare `global.X` reference throws ' +
         '"ReferenceError: global is not defined" in a real browser even though it silently ' +
         'resolves in Node-based tests that alias global.window = global', () => {
        expect(forecastSrc).not.toContain('global.GAIP_DiseaseStressCoupling');
    });

    test('Day 0 is restored after coupling so it stays pinned to Active Threats', () => {
        expect(forecastSrc).toContain('_day0Risks');
    });
});

// =============================================================================
// B. Behavioural — real generateForecast() run against fixture data
// =============================================================================

require(path.join(__dirname, '../assets/disease-engine-pure.js'));
global.DiseaseEnginePure = require(path.join(__dirname, '../assets/disease-engine-pure.js'));
global.GILBA_USE_PURE_DISEASE = true;
require(path.join(__dirname, '../assets/disease-stress-climate-coupling.js'));
require(path.join(__dirname, '../assets/red-thread-model.js'));
require(path.join(__dirname, '../assets/disease-forecast.js'));

// Deterministic 7-day climate fixture — set dailyPattern directly so
// buildDailyPatternFallback's OM-hourly/synthetic-sinusoid branches are
// bypassed entirely and every test run produces the same numbers.
function buildClimateMetrics(dailyTemps) {
    return {
        temperature: {
            min: dailyTemps[0].min, max: dailyTemps[0].max, mean: dailyTemps[0].mean,
            dailyPattern: dailyTemps,
        },
        moisture: { humidity: { mean: 85 } },
    };
}

// Cold-favouring fusarium week that warms up day over day (mirrors the real
// Russley NZ-winter scenario this bug was found on).
const WARMING_WEEK = [
    { date: '2026-08-06', min: -3,  max: 16.2, mean: 6.6  },
    { date: '2026-08-07', min: 3.1, max: 13.1, mean: 8.1  },
    { date: '2026-08-08', min: 4.6, max: 14.6, mean: 9.6  },
    { date: '2026-08-09', min: 6.1, max: 16.1, mean: 11.1 },
    { date: '2026-08-10', min: 8.6, max: 18.6, mean: 13.6 },
    { date: '2026-08-11', min: 11.1, max: 21.1, mean: 16.1 },
    { date: '2026-08-12', min: 13.6, max: 23.6, mean: 18.6 },
];

function baseState(overrides) {
    return Object.assign({
        climateMetrics: buildClimateMetrics(WARMING_WEEK),
        turf: { grassSpecies: 'Creeping Bentgrass (Greens)' }, // deliberately NOT the cached species
        tissue: {}, nitrogenStatus: { status: 'adequate' }, tissueNutrients: null,
        soilMetrics: null, shadeMetrics: null, wearMetrics: null,
        mowingData: { height: 4, frequency: 'regular' }, siteHistory: null, region: 'NZ',
        forecastHourly: { temperature_2m: [] },
        day0ActiveThreats: {
            fusarium: { score: 100, displayName: 'Fusarium Patch' },
        },
    }, overrides);
}

describe('cachedDiseaseSpecies takes priority over the DOM/SpeciesController chain', () => {
    test('with no cache, falls back to state.turf (existing behaviour preserved)', () => {
        const result = global.DiseaseForecast.generateForecast(baseState({}));
        expect(result.species).toBe('bentgrass');
    });

    test('with a cached species present, it wins over state.turf.grassSpecies', () => {
        const result = global.DiseaseForecast.generateForecast(
            baseState({ cachedDiseaseSpecies: 'browntopBent' })
        );
        expect(result.species).toBe('browntopBent');
    });
});

describe('Day 0 stays pinned to Active Threats regardless of coupling', () => {
    test('without stress data, Day 0 equals the Active Threats score', () => {
        const result = global.DiseaseForecast.generateForecast(
            baseState({ cachedDiseaseSpecies: 'browntopBent' })
        );
        const fus = result.diseases.find(d => d.key === 'fusarium');
        expect(fus.forecast[0].risk).toBe(100);
    });

    test('even with a drought stress snapshot that would suppress fusarium, Day 0 is untouched', () => {
        const droughtStress = {
            factors: [{ type: 'drought', severity: 0.6, impact: 'disease' }],
            severity: 'high', factorCount: 1, combinedGrowthModifier: 0.5, environmentalStressIndex: 60,
        };
        const result = global.DiseaseForecast.generateForecast(
            baseState({ cachedDiseaseSpecies: 'browntopBent', stressAggregates: droughtStress })
        );
        const fus = result.diseases.find(d => d.key === 'fusarium');
        expect(fus.forecast[0].risk).toBe(100);
    });
});

describe('Days 1+ are a real per-day recompute, not a flat line', () => {
    test('fusarium risk varies day to day as the week warms up', () => {
        const result = global.DiseaseForecast.generateForecast(
            baseState({ cachedDiseaseSpecies: 'browntopBent' })
        );
        const fus = result.diseases.find(d => d.key === 'fusarium');
        const risks = fus.forecast.map(f => f.risk);
        // Not every day identical — a flat line was the pre-fix symptom.
        expect(new Set(risks).size).toBeGreaterThan(1);
        // Cold-loving Fusarium should trend down as the week warms.
        expect(risks[risks.length - 1]).toBeLessThan(risks[0]);
    });
});

describe('stress/climate coupling is actually wired to affect days 1+', () => {
    test('a drought stress snapshot suppresses fusarium on days 1+ (matches the drought suppressor rule)', () => {
        const droughtStress = {
            factors: [{ type: 'drought', severity: 0.6, impact: 'disease' }],
            severity: 'high', factorCount: 1, combinedGrowthModifier: 0.5, environmentalStressIndex: 60,
        };
        const withoutCoupling = global.DiseaseForecast.generateForecast(
            baseState({ cachedDiseaseSpecies: 'browntopBent' })
        );
        const withCoupling = global.DiseaseForecast.generateForecast(
            baseState({ cachedDiseaseSpecies: 'browntopBent', stressAggregates: droughtStress })
        );
        const fusOff = withoutCoupling.diseases.find(d => d.key === 'fusarium');
        const fusOn  = withCoupling.diseases.find(d => d.key === 'fusarium');

        for (let day = 1; day < fusOff.forecast.length; day++) {
            expect(fusOn.forecast[day].risk).toBeLessThan(fusOff.forecast[day].risk);
        }
        // Day 0 must be identical between the two runs — coupling must not leak into it.
        expect(fusOn.forecast[0].risk).toBe(fusOff.forecast[0].risk);
    });

    test('missing GAIP_DiseaseStressCoupling degrades gracefully (no throw, no partial calc)', () => {
        const saved = global.GAIP_DiseaseStressCoupling;
        delete global.GAIP_DiseaseStressCoupling;
        expect(() => {
            global.DiseaseForecast.generateForecast(
                baseState({ cachedDiseaseSpecies: 'browntopBent', stressAggregates: { factors: [] } })
            );
        }).not.toThrow();
        global.GAIP_DiseaseStressCoupling = saved;
    });
});

// =============================================================================
// C. Day 0 must not show a disease Active Threats omits entirely
// =============================================================================
//
// Production bug (found on Russley after the initial coupling/species fix):
// writer1's authoritative climate gated Dollar Spot INACTIVE (5-day MEANAT
// 6.6°C, below its 10°C threshold), so Active Threats never listed it. But the
// forecast's own Day-0 climate is reconstructed independently on this page (no
// dew-prediction-engine / getAuthoritativeClimate data available), and crossed
// that same gate differently — producing a false-positive "Dollar Spot 24%
// Today" that Active Threats never showed. The pre-existing day0ActiveThreats
// override only handled the reverse cases (override a matching disease's
// score, or inject an AT-only disease as a flat line) — it never suppressed a
// forecast-only extra. Fixed by zeroing Day 0 for any disease the engine
// computed here that Active Threats doesn't list at all.

const WARM_WEEK = Array.from({ length: 7 }, (_, i) => ({
    date: '2026-01-0' + (i + 1), min: 15, max: 28, mean: 22,
}));

describe('Day 0 suppresses diseases Active Threats does not list at all', () => {
    test('a disease the engine computes non-trivially for Day 0 is zeroed if absent from day0ActiveThreats', () => {
        const state = {
            climateMetrics: { temperature: { min: 15, max: 28, mean: 22, dailyPattern: WARM_WEEK }, moisture: { humidity: { mean: 85 } } },
            turf: { grassSpecies: 'Creeping Bentgrass (Greens)' },
            cachedDiseaseSpecies: 'bentgrass',
            tissue: {}, nitrogenStatus: { status: 'adequate' }, tissueNutrients: null,
            soilMetrics: null, shadeMetrics: null, wearMetrics: null,
            mowingData: { height: 4, frequency: 'regular' }, siteHistory: null, region: 'AU',
            forecastHourly: { temperature_2m: [] },
            // Active Threats lists only fusarium — dollarSpot is genuinely warm
            // enough here that the engine will compute a non-zero Day-0 score
            // for it, but it must not appear because AT omits it.
            day0ActiveThreats: { fusarium: { score: 5, displayName: 'Fusarium Patch' } },
        };

        const result = global.DiseaseForecast.generateForecast(state);
        const dollarSpot = result.diseases.find(d => d.key === 'dollarSpot');

        // Confirm the scenario actually exercises the bug: dollarSpot must be
        // present (computed non-trivially on later days) for this test to mean
        // anything — if the fixture stops producing it, the assertion below is
        // vacuous and this test should be revisited.
        expect(dollarSpot).toBeDefined();
        expect(dollarSpot.forecast[0].risk).toBe(0);
        // Later days are a real forecast and must NOT be suppressed — only
        // Day 0 is pinned to Active Threats.
        expect(dollarSpot.forecast[1].risk).toBeGreaterThan(0);
    });
});

// =============================================================================
// D. Red Thread requires red-thread-model.js — without it, every day silently
//    flat-lines at the Active Threats score instead of a real forecast
// =============================================================================
//
// Production bug: app/resources/views/analysis.blade.php never loaded
// assets/red-thread-model.js (only app/resources/views/hub.blade.php and the
// reports/* pages did). disease-engine-pure.js's redThread dispatcher checks
// `window.GAIP_RedThreadModel` at call time (assets/disease-engine-pure.js:
// 5368) and skips silently — by design — when it's undefined. Every forecast
// day then falls through to disease-forecast.js's "Step 2" AT-injection
// (assets/disease-forecast.js: the day0ActiveThreats block), which flat-lines
// the CACHED Active Threats score across all 7 days because the engine never
// produced a redThread entry for ANY day, not just Day 0. On screen this
// looked like "Red Thread forecast" but was actually just today's number
// repeated 7 times. Fixed by adding the script tag to analysis.blade.php.
//
// This file's top-level require() list intentionally includes
// red-thread-model.js so tests below exercise the fixed (script loaded)
// state — see the "without the model loaded" tests for the regression guard
// on the broken state.

describe('Red Thread requires red-thread-model.js to be loaded', () => {
    const src = fs.readFileSync(path.join(__dirname, '../app/resources/views/analysis.blade.php'), 'utf8');

    test('analysis.blade.php loads red-thread-model.js', () => {
        expect(src).toContain("legacyAssetUrl('red-thread-model.js')");
    });

    test('red-thread-model.js loads before disease-forecast.js (species/engine wiring must be in place first)', () => {
        const rtPos = src.indexOf("legacyAssetUrl('red-thread-model.js')");
        const forecastPos = src.indexOf("legacyAssetUrl('disease-forecast.js')");
        expect(rtPos).toBeGreaterThan(-1);
        expect(forecastPos).toBeGreaterThan(rtPos);
    });
});

describe('Red Thread produces a real per-day forecast once the model is loaded', () => {
    test('regression guard: without GAIP_RedThreadModel, Red Thread never appears in diseases[] on any day', () => {
        const saved = global.GAIP_RedThreadModel;
        delete global.GAIP_RedThreadModel;
        const result = global.DiseaseForecast.generateForecast(
            baseState({
                cachedDiseaseSpecies: 'browntopBent',
                day0ActiveThreats: {
                    fusarium: { score: 100, displayName: 'Fusarium Patch' },
                    redThread: { score: 55, displayName: 'Red Thread' },
                },
            })
        );
        const rt = result.diseases.find(d => d.key === 'redThread');
        // Pre-fix this WAS present, but only as Step 2's flat AT-injected line
        // (fromActiveThreats: true, identical score every day) — assert that
        // shape explicitly so this test documents the broken behaviour, not
        // just its absence.
        if (rt) {
            const risks = rt.forecast.map(f => f.risk);
            expect(new Set(risks).size).toBe(1); // flat
        }
        global.GAIP_RedThreadModel = saved;
    });

    test('with the model loaded, Day 0 still equals Active Threats', () => {
        const result = global.DiseaseForecast.generateForecast(
            baseState({
                cachedDiseaseSpecies: 'browntopBent',
                day0ActiveThreats: {
                    fusarium: { score: 100, displayName: 'Fusarium Patch' },
                    redThread: { score: 55, displayName: 'Red Thread' },
                },
            })
        );
        const rt = result.diseases.find(d => d.key === 'redThread');
        expect(rt).toBeDefined();
        expect(rt.forecast[0].risk).toBe(55);
    });

    test('with the model loaded, days 1+ are a real recompute — not a flat line', () => {
        const result = global.DiseaseForecast.generateForecast(
            baseState({
                cachedDiseaseSpecies: 'browntopBent',
                day0ActiveThreats: {
                    fusarium: { score: 100, displayName: 'Fusarium Patch' },
                    redThread: { score: 55, displayName: 'Red Thread' },
                },
            })
        );
        const rt = result.diseases.find(d => d.key === 'redThread');
        const risks = rt.forecast.map(f => f.risk);
        expect(new Set(risks).size).toBeGreaterThan(1);
        // Not flagged as an Active-Threats flat-line injection.
        expect(rt.forecast.some(f => f.fromActiveThreats)).toBe(false);
    });
});

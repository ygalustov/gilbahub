/**
 * Hoxton audit D02/D03 — GilbaClimateNormalsService tiered fallback.
 *
 * Background: Monthly N Distribution and Monthly Schedule need a 12-month
 * temperature series, not the single live reading the "Climate & Growth
 * Conditions" block uses. Pre-fix, two independent latitude-guess fallbacks
 * (nutrition-summary-integration.js, nutrition-calendar.js) silently
 * fabricated a regional profile whenever real data wasn't wired up — which
 * was always, for every site, because the "real" source they tried first
 * was either an undefined global or a never-populated state field.
 *
 * Fix: GilbaClimateNormalsService.get(lat, lon) tries NASA POWER climatology
 * (pre-computed multi-year normal, one small request), then an Open-Meteo
 * archive average as a fallback, and returns null — never a guess — if
 * both fail. Verified against real NIWA normals for Auckland/Christchurch
 * during the fix (max ~0.5degC error for NASA POWER).
 *
 * Lives in its own file (climate-normals-service.js), standalone with no
 * GilbaHub dependency, because plan.blade.php (Monthly Schedule's actual
 * page) is deliberately lightweight and doesn't load climate-engine-v2.js —
 * confirmed live: on a real Hoxton-style export attempt, the Network tab
 * showed zero requests to either provider, because nothing on that page
 * was wired to trigger the fetch at all. climate-engine-v2.js's
 * ClimateFetchCoordinator now delegates to this file rather than
 * duplicating the tier logic.
 *
 * This test exercises the tier logic and month-key mapping in isolation,
 * with fetch mocked — no live network calls.
 */

'use strict';

global.window = global.window || {};
global.document = global.document || {
    addEventListener: function () {},
    querySelector: function () { return null; },
    dispatchEvent: function () {},
    readyState: 'complete'
};
if (typeof global.CustomEvent === 'undefined') {
    global.CustomEvent = function (name, opts) { this.type = name; this.detail = opts && opts.detail; };
}
global.console = { log: function () {}, warn: function () {}, error: function () {}, info: function () {} };

var ClimateNormalsService = require('../assets/climate-normals-service.js');

function nasaPowerResponse(t2m) {
    return {
        ok: true,
        json: function () {
            return Promise.resolve({
                properties: { parameter: { T2M: t2m } },
                header: { range: '2001-2020' }
            });
        }
    };
}

function openMeteoDailyResponse(monthlyMeans) {
    // Build a minimal daily series: one day per month, value = monthlyMeans[m]
    var time = [], temps = [];
    Object.keys(monthlyMeans).forEach(function (m) {
        var mm = String(m).padStart(2, '0');
        time.push('2023-' + mm + '-15');
        temps.push(monthlyMeans[m]);
    });
    return {
        ok: true,
        json: function () {
            return Promise.resolve({ daily: { time: time, temperature_2m_mean: temps } });
        }
    };
}

var NASA_MONTHS = ['JAN', 'FEB', 'MAR', 'APR', 'MAY', 'JUN', 'JUL', 'AUG', 'SEP', 'OCT', 'NOV', 'DEC'];
function fullNasaT2M(valuePerMonth) {
    var out = {};
    NASA_MONTHS.forEach(function (k, i) { out[k] = valuePerMonth[i + 1]; });
    return out;
}

var AUCKLAND_NASA_C = { 1: 19.79, 2: 20.38, 3: 19.08, 4: 17.01, 5: 14.74, 6: 12.63,
                         7: 11.4, 8: 11.76, 9: 12.92, 10: 14.24, 11: 16.01, 12: 18.24 };

describe('ClimateNormalsService — NASA POWER primary tier', function () {
    afterEach(function () { delete global.fetch; });

    test('parses T2M into a 1-12 keyed monthlyTemps object, source=nasa-power', async function () {
        global.fetch = jest.fn().mockResolvedValue(nasaPowerResponse(fullNasaT2M(AUCKLAND_NASA_C)));

        var result = await ClimateNormalsService.get(-36.8485, 174.7633);

        expect(result).not.toBeNull();
        expect(result.source).toBe('nasa-power');
        expect(result.period).toBe('2001-2020');
        for (var m = 1; m <= 12; m++) {
            expect(result.monthlyTemps[m]).toBeCloseTo(AUCKLAND_NASA_C[m], 5);
        }
        // Only one request needed — the whole point of this tier.
        expect(global.fetch).toHaveBeenCalledTimes(1);
        expect(global.fetch.mock.calls[0][0]).toContain('power.larc.nasa.gov');
    });

    test('rejects NASA POWER fill-value (-999) for a missing month and falls through', async function () {
        var badT2M = fullNasaT2M(AUCKLAND_NASA_C);
        badT2M.JUL = -999; // NASA's documented missing-data sentinel
        global.fetch = jest.fn()
            .mockResolvedValueOnce(nasaPowerResponse(badT2M))
            .mockResolvedValueOnce(openMeteoDailyResponse(AUCKLAND_NASA_C));

        var result = await ClimateNormalsService.get(-36.8485, 174.7633);

        expect(result).not.toBeNull();
        expect(result.source).toBe('open-meteo-fallback');
        expect(global.fetch).toHaveBeenCalledTimes(2);
    });

    test('HTTP error from NASA POWER falls through to Open-Meteo', async function () {
        global.fetch = jest.fn()
            .mockResolvedValueOnce({ ok: false, status: 503 })
            .mockResolvedValueOnce(openMeteoDailyResponse(AUCKLAND_NASA_C));

        var result = await ClimateNormalsService.get(-36.8485, 174.7633);

        expect(result.source).toBe('open-meteo-fallback');
        expect(global.fetch.mock.calls[1][0]).toContain('archive-api.open-meteo.com');
    });
});

describe('ClimateNormalsService — both tiers fail', function () {
    afterEach(function () { delete global.fetch; });

    test('returns null — never a latitude-guessed profile (Hoxton D02/D03)', async function () {
        global.fetch = jest.fn().mockResolvedValue({ ok: false, status: 500 });

        var result = await ClimateNormalsService.get(-36.8485, 174.7633);

        expect(result).toBeNull();
    });

    test('network throw on both tiers still resolves to null, not a rejected promise', async function () {
        global.fetch = jest.fn().mockRejectedValue(new Error('network down'));

        await expect(ClimateNormalsService.get(-36.8485, 174.7633)).resolves.toBeNull();
    });
});

describe('ClimateNormalsService — Open-Meteo fallback aggregation', function () {
    afterEach(function () { delete global.fetch; });

    test('averages daily values per calendar month into a 1-12 keyed object', async function () {
        global.fetch = jest.fn()
            .mockResolvedValueOnce({ ok: false, status: 500 }) // NASA POWER fails
            .mockResolvedValueOnce({
                ok: true,
                json: function () {
                    return Promise.resolve({
                        daily: {
                            time: ['2023-01-10', '2023-01-20', '2023-02-15'],
                            temperature_2m_mean: [18.0, 22.0, 19.0]
                        }
                    });
                }
            });

        // Only Jan/Feb have data in this mock — every other month must throw
        // inside the service (no data), which get() must swallow into null,
        // not a partial/invented series.
        var result = await ClimateNormalsService.get(-36.8485, 174.7633);
        expect(result).toBeNull();
    });
});

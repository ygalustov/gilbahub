/**
 * Test — ambient-dli-engine.js api_daily source must pick the day matching
 * "today", not blindly dailyDLIs[0].
 *
 * BUG CLASS: stale/wrong-day pick from an ascending date-ordered array.
 *
 * Symptom in production: Light (DLI) / Shade Status flipped between page
 * load and a manual "rerun" for the same site on the same calendar day —
 * e.g. DLI 7.4 mol/m²/day "Critical" on first load, 14.9 mol/m²/day
 * "Suboptimal" after rerun, with nothing else changed.
 *
 * Root cause: `climateData.daily.shortwave_radiation_sum` for source
 * 'api_daily' is only populated via the historical-archive fallback
 * (hub-tissue-v3.js ~6463), which fetches an ascending, oldest-to-yesterday
 * window whenever a PGR application date is in the past. `dailyDLIs[0]?.dli`
 * therefore picked the OLDEST day in that window, not current conditions —
 * and which day ended up at index 0 depended on how much of the window had
 * arrived by the time the live/cache fetch race in weather-resilience.js
 * resolved, explaining the run-to-run swing.
 *
 * Fix (mirrors the existing api_hourly correction): prefer the daily entry
 * whose date matches today; if today isn't present (archive-only data ends
 * yesterday), use the most recent (last) entry instead of the oldest.
 */

const fs = require('fs');
const path = require('path');
const vm = require('vm');

function loadEngine() {
    const filePath = path.join(__dirname, '../assets/ambient-dli-engine.js');
    const src = fs.readFileSync(filePath, 'utf8');
    const sandbox = { console };
    sandbox.global = sandbox;
    sandbox.window = sandbox; // real browser: window IS the global object
    vm.createContext(sandbox);
    vm.runInContext(src, sandbox, { filename: filePath });
    return sandbox.gaip_ambient_dli;
}

function isoDate(daysAgo) {
    const d = new Date();
    d.setUTCDate(d.getUTCDate() - daysAgo);
    return d.toISOString().slice(0, 10);
}

describe('ambient-dli-engine — api_daily source picks the right day', () => {
    let calculateAmbientDLI;

    beforeAll(() => {
        calculateAmbientDLI = loadEngine();
        expect(typeof calculateAmbientDLI).toBe('function');
    });

    test("uses the entry whose date matches today, not index 0, when today is present", () => {
        // Ascending oldest → today. Oldest day has a low shortwave sum
        // (would classify as "Critical" pre-fix); today has a high one.
        const climateData = {
            daily: {
                time: [isoDate(59), isoDate(30), isoDate(1), isoDate(0)],
                shortwave_radiation_sum: [3.6, 5.0, 6.0, 7.24] // mol/m² = *2.057
            }
        };
        const state = { climate: { lat: -43.5, lon: 172.6 }, turf: { grassSpecies: 'perennialRyegrass' } };

        const result = calculateAmbientDLI(climateData, state);

        expect(result.source).toBe('api_daily');
        // today's sum (7.24) * 2.057 ≈ 14.9 — matches the post-rerun production value
        expect(result.current).toBeCloseTo(14.9, 1);
        // oldest day's sum (3.6) * 2.057 ≈ 7.4 — matches the pre-fix, first-load bug value
        expect(result.current).not.toBeCloseTo(7.4, 1);
    });

    test("falls back to the most recent (last) entry, not the oldest, when today is absent", () => {
        // Historical-archive-only window: ascending, ending yesterday (no "today" entry).
        const climateData = {
            daily: {
                time: [isoDate(59), isoDate(30), isoDate(2), isoDate(1)],
                shortwave_radiation_sum: [3.6, 5.0, 6.5, 7.24]
            }
        };
        const state = { climate: { lat: -43.5, lon: 172.6 }, turf: { grassSpecies: 'perennialRyegrass' } };

        const result = calculateAmbientDLI(climateData, state);

        expect(result.source).toBe('api_daily');
        // most recent entry (yesterday, index 3) picked, not dailyDLIs[0] (59 days ago)
        expect(result.current).toBeCloseTo(14.9, 1);
        expect(result.current).not.toBeCloseTo(3.6 * 2.057, 1);
    });
});

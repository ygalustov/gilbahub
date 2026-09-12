/**
 * GH-438 — the programme records whether bulk density and sampling depth are
 * the sample's own readings or the engine's defaults.
 *
 * WHY IT MATTERS AND IS NOT A DIAGNOSTIC. Those two numbers are the whole of
 * the ppm -> kg/ha factor (`bulkDensity * soilDepth * 0.1`, see
 * nutrition-requirement-core.js), and that factor multiplies every lift term
 * and every headroom term the requirement branches produce. A reader told
 * "1 ppm = 1.4 kg/ha in this rootzone" is entitled to know whether 1.4 came off
 * the certificate or out of a constant.
 *
 * The input adapter already computed exactly this pair for the export path
 * (nutrition-program-inputs.js validateSampleInputs(), which publishes
 * bulkDensityDefaulted / soilDepthDefaulted and is called only by
 * word-export-combined.js). The Plan page could not see it, so the
 * calculation-trace block named BOTH possibilities — "the selected soil sample,
 * or the engine default where it carries none" — and left the reader to guess.
 *
 * This half is durable and outlives the temporary GH-425 block: the flags are
 * a property of the programme, not of the panel.
 */

'use strict';

const path = require('path');

global.window = global.window || global;
global.document = global.document || {
    getElementById: () => null, querySelector: () => null, querySelectorAll: () => [],
    addEventListener: () => {}, head: { appendChild: () => {} },
    createElement: () => ({ style: {}, appendChild: () => {}, setAttribute: () => {} })
};

require('../assets/gaip-classification-constants.js');
require('../assets/nutrition-requirement-core.js');
require('../assets/zone-key.js');
require('../assets/nutrition-program-inputs.js');
require('../assets/nutrition-monthly-distribution.js');
require('../assets/growth-potential-engine.js');
require('../assets/nutrition-calendar.js');

const Calendar = global.window.GilbaNutritionCalendar;
const Core = require('../assets/nutrition-requirement-core.js');

const MONTHLY_TEMPS = { 0: 17.5, 1: 17.1, 2: 15.1, 3: 11.9, 4: 9.2, 5: 6.6,
                        6: 5.9, 7: 7.1, 8: 8.9, 9: 10.8, 10: 13.3, 11: 15.8 };

function build(soilOverrides) {
    return Calendar.computeProgram(Object.assign({
        annualNOverride: 200,
        traffic: 'moderate',
        trafficModifier: 1.0,
        clippingManagement: 'collected',
        methodology: 'MLSN',
        species: 'bentgrass',
        speciesDisplay: 'Creeping Bentgrass',
        soilTexture: 'sand',
        isC4: false,
        hemisphere: 'south',
        latitude: -43.5,
        longitude: 172.5,
        distribution: 'gp_weighted',
        maxNPerMonth: 25,
        monthlyTemps: MONTHLY_TEMPS,
        monthlyTempsSource: 'nasa-power',
        soilPpm: { P: 20, K: 40 },
        surfaceType: 'greens',
        inputSources: { annualN: 'plan', methodology: 'plan' }
    }, soilOverrides));
}

describe('GH-438 — bulk density and depth carry their own provenance', () => {
    test('a sample with both readings is recorded as carrying both', () => {
        const p = build({ bulkDensity: 1.55, soilDepth: 15 });
        expect(p.meta.bulkDensityDefaulted).toBe(false);
        expect(p.meta.soilDepthDefaulted).toBe(false);
        expect(p.soil.bulkDensity).toBe(1.55);
        expect(p.soil.soilDepth).toBe(15);
    });

    test('a sample with neither is recorded as defaulted, and the defaults are what was used', () => {
        const p = build({});
        expect(p.meta.bulkDensityDefaulted).toBe(true);
        expect(p.meta.soilDepthDefaulted).toBe(true);
        // The flag must describe the number the calculation USED. computeProgram()
        // leaves soil.bulkDensity as the raw input (undefined here); the core
        // substitutes its default at the point of use and records it, which is
        // the figure the trace row prints.
        expect(p.requirement_detail.P.bulkDensityUsed).toBe(Core.DEFAULT_BULK_DENSITY_G_CM3);
        expect(p.requirement_detail.P.soilDepthUsed).toBe(Core.DEFAULT_SOIL_DEPTH_CM);
    });

    test('the two are independent — one reading present, one absent', () => {
        const a = build({ bulkDensity: 1.6 });
        expect(a.meta.bulkDensityDefaulted).toBe(false);
        expect(a.meta.soilDepthDefaulted).toBe(true);

        const b = build({ soilDepth: 12 });
        expect(b.meta.bulkDensityDefaulted).toBe(true);
        expect(b.meta.soilDepthDefaulted).toBe(false);
    });

    test('the flag tracks the value, so it cannot say "measured" over a default', () => {
        // The failure mode this exists to prevent: the flag computed from a
        // different expression than the value. Both are driven off the same
        // parse, so a zero, a blank and a non-numeric all read as absent.
        [0, '', null, undefined, 'n/a', NaN].forEach((v) => {
            const p = build({ bulkDensity: v, soilDepth: v });
            expect(p.meta.bulkDensityDefaulted).toBe(true);
            expect(p.requirement_detail.P.bulkDensityUsed).toBe(Core.DEFAULT_BULK_DENSITY_G_CM3);
        });
    });

    test('the factor the trace prints is these two numbers, so the provenance is about the factor', () => {
        const measured = build({ bulkDensity: 1.55, soilDepth: 15 });
        const defaulted = build({});
        const f = (p) => p.requirement_detail && p.requirement_detail.P &&
                         p.requirement_detail.P.ppmToKgHaFactor;
        expect(f(measured)).toBeCloseTo(1.55 * 15 * 0.1, 6);
        expect(f(defaulted)).toBeCloseTo(
            Core.DEFAULT_BULK_DENSITY_G_CM3 * Core.DEFAULT_SOIL_DEPTH_CM * 0.1, 6);
        // and they really do differ, so the distinction is worth printing
        expect(f(measured)).not.toBeCloseTo(f(defaulted), 6);
    });

    test('the flags are NOT in inputSources — that map is compared across surfaces', () => {
        // tests/e2e/ui-vs-export-parity.test.js compares meta.inputSources
        // field for field between the Plan page and the Word export. The export
        // resolves these two flags on its own path, so putting them in that map
        // on one side only would fail parity on a difference that is not one.
        const p = build({ bulkDensity: 1.55 });
        expect(p.meta.inputSources).toBeTruthy();
        expect(p.meta.inputSources.bulkDensityDefaulted).toBeUndefined();
        expect(p.meta.inputSources.soilDepthDefaulted).toBeUndefined();
    });
});

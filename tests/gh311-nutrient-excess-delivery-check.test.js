/**
 * GH-311 — "Nutrient Delivery Summary" showed "Met" for any required===0
 * row regardless of how much was actually delivered (GH-306/310). User
 * pointed out this hides a real risk: product selection for N can still
 * deliver substantial P/K as a side effect (blended NPK products), and
 * "Met" gives no indication of whether that delivery pushes an
 * already-sufficient/high soil level further past its ceiling.
 *
 * Original fix (this file's original scope): added a "Current (kg/ha)"
 * column and an Excess check using Balance = Current + Delivered (required
 * drops out at 0) compared against the ceiling in the same unit.
 *
 * SUPERSEDED BY GH-312: user pointed out that using Current only for the
 * required===0 branch (and Required for required>0) meant Balance meant two
 * different things depending on the row, and separately that Required
 * already double-counts Current (via the Lift term) for below-floor
 * nutrients. GH-312 replaced the Balance formula everywhere with Current +
 * Delivered − Removal (not Required), sourced from Woods (2013)'s mass-
 * balance method, and unified Status into one Low/Met/Excess rule for every
 * row. The exact numeric worked example this file originally pinned (K:
 * 278.6 + 116.9 = 395.5, no removal subtracted) no longer matches shipped
 * code -- see gh312-unified-nutrient-balance-status.test.js for the current,
 * correct worked examples (which include Removal=110 in the subtraction).
 *
 * What's still verified here: the data-plumbing GH-311 introduced
 * (computeProgram() exposing soil.bulkDensity/soilDepth/annual_totals_range,
 * and the integration files carrying program.soil/program.annual_totals_range
 * through from calendarData) is still exactly as GH-311 shipped it -- GH-312
 * only added more fields alongside it (annual_removal/annual_lift), it
 * didn't change these.
 *
 * Structural pins only (regex against the source), matching this repo's
 * established convention for large DOM-generating files.
 */

'use strict';

const fs = require('fs');
const path = require('path');

describe('GH-311 — nutrition-calendar.js exposes soil unit-conversion data + resolved ranges', () => {
    const src = fs.readFileSync(path.join(__dirname, '../assets/nutrition-calendar.js'), 'utf8');

    test('computeProgram() return object includes soil.bulkDensity and soil.soilDepth', () => {
        expect(src).toMatch(/bulkDensity:\s*inputs\.bulkDensity,/);
        expect(src).toMatch(/soilDepth:\s*inputs\.soilDepth,/);
    });

    test('computeProgram() return object includes annual_totals_range', () => {
        // GH-384: the ranges are resolved by the shared adapter now, and the
        // published {min,max} shape is built explicitly rather than being the
        // resolver's own object — which also carries a methodology label and a
        // citation that are not part of this output contract.
        expect(src).toMatch(/annual_totals_range:\s*annualTotalsRange,/);
        expect(src).toMatch(/annualTotalsRange\[n\] = r \? \{ min: r\.min, max: r\.max \} : null;/);
    });
});

describe('GH-311 — nutrition-prebble-integration.js (NZ) wiring', () => {
    const src = fs.readFileSync(path.join(__dirname, '../assets/nutrition-prebble-integration.js'), 'utf8');

    test('program.soil / program.annual_totals_range are carried through from calendarData', () => {
        expect(src).toMatch(/program\.soil = calendarData\.soil;/);
        expect(src).toMatch(/program\.annual_totals_range = calendarData\.annual_totals_range;/);
    });

    test('table header includes a "Current (kg/ha)" column', () => {
        expect(src).toMatch(/<th class="prebble-th">Current \(kg\/ha\)<\/th>/);
    });
});

describe('GH-311 — nutrition-au-fertiliser-integration.js (AU) wiring', () => {
    const src = fs.readFileSync(path.join(__dirname, '../assets/nutrition-au-fertiliser-integration.js'), 'utf8');

    test('generateProgram() return object carries soil / annual_totals_range from calendarData', () => {
        expect(src).toMatch(/soil:\s*calendarData\.soil,/);
        expect(src).toMatch(/annual_totals_range:\s*calendarData\.annual_totals_range,/);
    });

    test('table header includes a "Current (kg/ha)" column', () => {
        expect(src).toMatch(/<th class="au-fert-th">Current \(kg\/ha\)<\/th>/);
    });
});

describe('GH-311 follow-up — nutrition-nz-fertiliser-integration.js has its own generateProgram() call that also needs the carry-through', () => {
    // Found live: NutritionNzFertiliserIntegration.generateAndRender() builds
    // its OWN `program` via PrebbleRecommender.generateProgram(calendarData,
    // context) -- a second, independent call site from
    // nutrition-prebble-integration.js's -- and it's the one that actually
    // renders on screen once a distributor is selected (it calls
    // NutritionPrebbleIntegration.buildRecommendationsHTML(program) directly
    // and hides the standalone Prebble panel).
    const src = fs.readFileSync(path.join(__dirname, '../assets/nutrition-nz-fertiliser-integration.js'), 'utf8');

    test('generateAndRender() carries program.soil / program.annual_totals_range from calendarData before rendering', () => {
        expect(src).toMatch(/program\.soil = calendarData\.soil;/);
        expect(src).toMatch(/program\.annual_totals_range = calendarData\.annual_totals_range;/);
    });

    test('the carry-through happens before buildRecommendationsHTML() is called', () => {
        const assignIdx = src.indexOf('program.soil = calendarData.soil;');
        const renderIdx = src.indexOf('NutritionPrebbleIntegration.buildRecommendationsHTML(program)');
        expect(assignIdx).toBeGreaterThan(-1);
        expect(renderIdx).toBeGreaterThan(-1);
        expect(assignIdx).toBeLessThan(renderIdx);
    });
});

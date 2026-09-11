/**
 * GH-416 — a programme built without a soil test says so, on both surfaces.
 *
 * Four of the eleven development sites reach the recommender with no soil
 * chemistry at all: Canberra and Test1 - Sports have no soil samples, Westview
 * and test4 - USA have one carrying nothing but pH. All four produced a full
 * seven-product programme — Canberra 207.1 kg N / 23.6 P / 122.7 K — with
 * nothing on the Plan page to say the P/K/Ca/Mg/S figures behind it are removal
 * estimates rather than measurements (audit F5).
 *
 * In the document it was worse: the Annual Nutrient Requirements and Monthly N
 * Distribution tables both iterate one filtered list, and a pH-only sample was
 * excluded from it, while the Annual Product Summary and Monthly Schedule are
 * not filtered — so the Westview document printed products for 224.8 kg N/ha
 * with no statement anywhere of what they were selected against (F6).
 *
 * Decision D-5: a banner, not a block. The nitrogen calendar is correct without
 * a soil test and "N now, sample later" is a supported way to work.
 */

'use strict';

const fs = require('fs');
const path = require('path');

global.window = global.window || {};
global.document = global.document || {
    readyState: 'complete',
    addEventListener: function () {},
    getElementById: function () { return null; },
    querySelector: function () { return null; },
    querySelectorAll: function () { return []; }
};
const _realConsole = global.console;
global.console = { log: function () {}, warn: function () {}, error: function () {}, info: function () {} };

const Core = require('../assets/nutrition-requirement-core.js');
global.window.NutritionRequirementCore = Core;
require('../assets/gaip-classification-constants.js');
const NPI = require('../assets/nutrition-program-inputs.js');
global.window.GAIP_NutritionProgramInputs = NPI;
const Balance = require('../assets/nutrient-balance-status.js');

global.console = _realConsole;

const CALENDAR_SRC = fs.readFileSync(path.join(__dirname, '../assets/nutrition-calendar.js'), 'utf8');
const COMBINED_SRC = fs.readFileSync(path.join(__dirname, '../assets/word-export-combined.js'), 'utf8');

describe('GH-416 — the engine already answers "no soil data"; the surfaces now print it', () => {
    test('a pH-only sample comes back removal-only and flagged, on every nutrient', () => {
        const ranges = NPI.resolveSufficiencyRanges({
            methodology: 'mlsn', speciesDisplay: 'Buffalograss', speciesKey: 'buffalo',
            soilTexture: 'clay_loam', CEC: null, pH: 6.5
        }).ranges;
        const c = Core.compute({
            soilValues: { P: null, K: null, Ca: null, Mg: null, S: null },
            species: 'Buffalograss', ph: 6.5, methodology: 'mlsn', ranges: ranges,
            tissuePercent: null, annualN: 200, bulkDensity: 1.4, soilDepth: 10,
            clippingManagement: 'collected'
        });
        ['P', 'K'].forEach((n) => {
            expect(c.perSample[n].intent).toBe('removal-only-no-soil-data');
            expect(c.perSample[n].missingSoilData).toBe(true);
            expect(c.perSample[n].annualRequirement).toBe(c.perSample[n].removal);
        });
        expect(c.missingSoilData.P).toBe(true);
        expect(c.missingSoilData.K).toBe(true);
    });

    test('the classifier prints "No Soil Data" for such a row without needing a range or a bulk density', () => {
        const cls = Balance.classify({
            nutrient: 'P', required: 21.4, delivered: 21.4,
            currentPpm: null, removal: null, range: null,
            bulkDensity: null, soilDepth: null, missingSoilData: true
        });
        expect(cls.statusLabel).toBe('No Soil Data');
        expect(cls.currentDisplay).toBe('—');
        expect(cls.rangeDisplay).toBe('—');
    });
});

describe('GH-416 — the Plan page banner', () => {
    test('it is driven by the engine\'s own missing_soil_data, so no sample and a pH-only sample read alike', () => {
        expect(CALENDAR_SRC).toMatch(/const _msd = p\.missing_soil_data \|\| \{\};/);
        expect(CALENDAR_SRC).toMatch(/const _noSoilTest = !!\(_msd\.P && _msd\.K\);/);
    });

    test('it says what is estimated and what to do about it', () => {
        expect(CALENDAR_SRC).toMatch(/Built without a soil test:/);
        expect(CALENDAR_SRC).toMatch(/removal-only estimates; add a soil sample to size them/);
    });

    test('it renders in the results panel, in the same banner style as the monthly-cap warning', () => {
        const idx = CALENDAR_SRC.indexOf('${_noSoilTest ? `');
        expect(idx).toBeGreaterThan(-1);
        expect(CALENDAR_SRC.slice(idx, idx + 260)).toMatch(/gilba-nut-banner gilba-nut-banner--warning/);
    });

    test('Generate is not blocked (decision D-5) — no early return was added beside it', () => {
        const idx = CALENDAR_SRC.indexOf('const _noSoilTest');
        const block = CALENDAR_SRC.slice(idx - 1200, idx + 400);
        expect(block).not.toMatch(/return;\s*\/\/ no soil/);
        expect(block).not.toMatch(/alert\(/);
    });
});

describe('GH-416 — the document', () => {
    test('a pH-only sample is eligible for the ANR and Monthly N tables', () => {
        const idx = COMBINED_SRC.indexOf('function _anrEligible(r) {');
        expect(idx).toBeGreaterThan(-1);
        const block = COMBINED_SRC.slice(idx, idx + 400);
        expect(block).toMatch(/if \(s\.hasData && \(s\.P != null \|\| s\.K != null\)\) return true;/);
        expect(block).toMatch(/return s\.pH != null \|\| s\.pH_water != null;/);
        expect(COMBINED_SRC).toMatch(/var anrReports = reports\.filter\(_anrEligible\);/);
    });

    test('the two tables that were missing both iterate that one list', () => {
        // Annual Nutrient Requirements, and the per-site Monthly N Distribution
        // grouping — the reason excluding a sample removed both.
        expect(COMBINED_SRC).toMatch(/if \(anrReports\.length > 0\) \{/);
        const mn = COMBINED_SRC.indexOf('var _mnSiteGroups = {};');
        expect(mn).toBeGreaterThan(-1);
        expect(COMBINED_SRC.slice(mn, mn + 400)).toMatch(/anrReports\.forEach/);
    });

    test('its Status is classified from the engine\'s intent when there is no per-sample programme', () => {
        const idx = COMBINED_SRC.indexOf('var missingSoil = pp');
        expect(idx).toBeGreaterThan(-1);
        const block = COMBINED_SRC.slice(idx, idx + 400);
        expect(block).toMatch(/anrResult\.intent === 'removal-only-no-soil-data'/);
    });

    test('a pH-only sample does NOT get a per-sample programme recomputed for it', () => {
        // Deliberate: the catalogue branch is chosen from coordinates and
        // resolves to Australia for anything outside the NZ box, so recomputing
        // would print Australian products in test4 - USA's document for a site
        // whose Plan page shows no regional panel at all.
        const idx = COMBINED_SRC.indexOf('anrReports.forEach(function(r) {\n                // GH-416: deliberately still `hasData`');
        expect(idx).toBeGreaterThan(-1);
        expect(COMBINED_SRC.slice(idx, idx + 1400))
            .toMatch(/if \(!r\.data \|\| !r\.data\.soil \|\| !r\.data\.soil\.hasData\) \{ _perSampleProgSkip\+\+; return; \}/);
    });
});

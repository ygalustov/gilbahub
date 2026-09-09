/**
 * GH-379 — nutrition-calendar.js computeProgram() must take the same
 * methodology branch regardless of how the caller spells the methodology.
 *
 * The live defect: word-export.js stamps data.soil.methodology upper-cased
 * ('AMMONIUM_ACETATE'), word-export-combined.js copies that into the
 * per-sample calendar inputs, and computeProgram()'s AA test compared it
 * case-sensitively against 'ammonium_acetate' — so the Combined export's
 * per-sample Monthly Schedule silently fell through to the MLSN branch on an
 * AA / Hill Labs S277 site (K floor 37 instead of 78.2, no lift, a different
 * monthly K series handed to the product recommender) while every other
 * section of the same document was computed on the AA basis.
 *
 * Runs the REAL modules the browser loads, on the real Test5-NZ / Soccer
 * inputs (sample 141 soil K 40 / P 40, sample 144 tissue N 4.57 / P 0.62 /
 * K 2.0, annual N 250, S277 via deriveCode('Perennial Ryegrass', 'sand')),
 * and pins the live-confirmed AA figures (K range 78.2-195.5, lift 26.74,
 * K 136) for every spelling.
 *
 * Red-check against the pre-fix module:
 *   GH379_CALENDAR_PATH=/path/to/prefix/nutrition-calendar.js \
 *   GH379_COMBINED_PATH=/path/to/prefix/word-export-combined.js \
 *   npx jest tests/gh379
 */

'use strict';

const fs = require('fs');
const path = require('path');

const CALENDAR_PATH = process.env.GH379_CALENDAR_PATH
    ? path.resolve(process.env.GH379_CALENDAR_PATH)
    : path.join(__dirname, '../assets/nutrition-calendar.js');
const COMBINED_PATH = process.env.GH379_COMBINED_PATH
    ? path.resolve(process.env.GH379_COMBINED_PATH)
    : path.join(__dirname, '../assets/word-export-combined.js');
const WORD_EXPORT_PATH = process.env.GH379_WORD_EXPORT_PATH
    ? path.resolve(process.env.GH379_WORD_EXPORT_PATH)
    : path.join(__dirname, '../assets/word-export.js');

global.window = global.window || {};
global.document = global.document || {
    addEventListener: function () {},
    querySelector: function () { return null; },
    querySelectorAll: function () { return []; }
};
global.console = { log: function () {}, warn: function () {}, error: function () {}, info: function () {} };
global.localStorage = { getItem: function () { return null; }, setItem: function () {} };

require('../assets/species-controller.js');
global.SpeciesController = global.window.SpeciesController;
const HLST = require('../assets/hill-labs-sample-types.js');
global.window.HillLabsSampleTypes = HLST;
const _realSetTimeout = global.setTimeout;
global.setTimeout = function (fn, ms) {
    const t = _realSetTimeout(fn, ms);
    if (t && typeof t.unref === 'function') t.unref();
    return t;
};
require('../assets/ammonium-acetate-methodology.js');
global.setTimeout = _realSetTimeout;
global.window.AmmoniumAcetateMethodology = global.window.AmmoniumAcetateMethodology || global.AmmoniumAcetateMethodology;
global.window.GilbaGrowthPotentialEngine = require('../assets/growth-potential-engine.js');
require(CALENDAR_PATH);
const Calendar = global.window.GilbaNutritionCalendar;

// Test5 - NZ / Soccer as stored on 2026-09-09 (sample 141 soil, sample 144
// tissue), the site's saved annual N target, and the Auckland monthly normals
// the Plan page resolved for it (0-11 order).
const MONTHLY_TEMPS_0_11 = [19.8, 20.4, 19.1, 17, 14.7, 12.6, 11.4, 11.8, 12.9, 14.2, 16, 18.2];
function inputs(methodology) {
    return {
        annualNOverride: 250,
        maxNPerMonth: 50,
        traffic: 'moderate',
        clippingManagement: 'collected',
        bulkDensity: 1.4,
        soilDepth: 10,
        methodology: methodology,
        species: 'perennialRyegrass',
        speciesDisplay: 'Perennial Ryegrass',
        soilTexture: 'sand',
        CEC: 5.9,
        isC4: false,
        distribution: 'gp_weighted',
        hemisphere: 'south',
        latitude: -36.8508827,
        monthlyTemps: MONTHLY_TEMPS_0_11,
        soilPpm: { P: 40, K: 40, Ca: 803, Mg: 129, S: 75 },
        tissuePercent: { N: 4.57, P: 0.62, K: 2.0 },
    };
}

// Everything the export and the Plan page consume from the result, minus the
// generation timestamp.
function comparable(p) {
    return {
        annual_totals: p.annual_totals,
        annual_removal: p.annual_removal,
        annual_lift: p.annual_lift,
        annual_totals_range: p.annual_totals_range,
        annual_totals_range_source: p.annual_totals_range_source,
        monthly: p.program.monthly,
        metaMethodology: p.meta.methodology,
        soilMethodology: p.soil.methodology,
        tissue_gate_applied: p.tissue_gate_applied,
    };
}

const AA_SPELLINGS = ['AMMONIUM_ACETATE', 'Ammonium_Acetate', 'ammonium acetate', 'AMMONIUM ACETATE',
    ' ammonium-acetate ', 'ammoniumacetate', 'AmmoniumAcetate', 'aa', 'AA'];

describe('GH-379 normalizeMethodology() folds every accepted spelling to one key', () => {
    test('AA aliases, any case, whitespace or hyphen', () => {
        AA_SPELLINGS.concat(['cotula_s78', 'COTULA_S78', 'cotula']).forEach((m) => {
            expect(Calendar.normalizeMethodology(m)).toBe('ammonium_acetate');
        });
    });
    test('SLAN / MLSN, any case', () => {
        ['slan', 'SLAN', 'Slan', ' SLAN '].forEach((m) => expect(Calendar.normalizeMethodology(m)).toBe('slan'));
        ['mlsn', 'MLSN', 'Mlsn'].forEach((m) => expect(Calendar.normalizeMethodology(m)).toBe('mlsn'));
    });
    test('nothing usable is empty, not a default', () => {
        expect(Calendar.normalizeMethodology(null)).toBe('');
        expect(Calendar.normalizeMethodology(undefined)).toBe('');
        expect(Calendar.normalizeMethodology('')).toBe('');
        expect(Calendar.normalizeMethodology('   ')).toBe('');
    });
});

describe('GH-379 computeProgram() is case-invariant on inputs.methodology', () => {
    const base = Calendar.computeProgram(inputs('ammonium_acetate'));

    test('the lowercase baseline is the live-confirmed AA result (S277 K 78.2-195.5, lift 26.74, K 136)', () => {
        expect(base.error).toBeUndefined();
        expect(base.annual_totals_range.K.min).toBeCloseTo(78.2, 6);
        expect(base.annual_totals_range.K.max).toBeCloseTo(195.5, 6);
        expect(base.annual_totals_range.P).toEqual({ min: 20, max: 30 });
        expect(base.annual_totals_range_source.K).toBe('certificate');
        expect(base.annual_lift.K).toBeCloseTo(26.74, 6);
        expect(base.annual_totals.K).toBe(136);
        expect(base.annual_removal.K).toBe(109);
        const sumK = base.program.monthly.reduce((s, m) => s + m.K, 0);
        expect(sumK).toBeCloseTo(136, 0);
    });

    test.each(AA_SPELLINGS)('%j produces output identical to \'ammonium_acetate\'', (spelling) => {
        const p = Calendar.computeProgram(inputs(spelling));
        expect(p.error).toBeUndefined();
        expect(comparable(p)).toEqual(comparable(base));
    });

    test('the export\'s exact spelling (\'AMMONIUM_ACETATE\') takes the AA branch, not MLSN', () => {
        const p = Calendar.computeProgram(inputs('AMMONIUM_ACETATE'));
        // MLSN would be K floor 37 / ceiling 55.5 with no lift (soil K 40 sits
        // inside the MLSN band) — the live pre-fix export figures.
        expect(p.annual_totals_range.K.min).not.toBe(37);
        expect(p.annual_totals_range.K.min).toBeCloseTo(78.2, 6);
        expect(p.annual_lift.K).toBeCloseTo(26.74, 6);
        expect(p.annual_totals.K).toBe(136);
    });

    test('SLAN: \'slan\' and \'SLAN\' are identical and take the SLAN (Carrow 2004) range', () => {
        const lo = Calendar.computeProgram(inputs('slan'));
        const up = Calendar.computeProgram(inputs('SLAN'));
        expect(comparable(up)).toEqual(comparable(lo));
        expect(lo.annual_totals_range.K).toEqual({ min: 75, max: 176 });
    });

    test('MLSN: \'mlsn\' and \'MLSN\' are identical and take the MLSN (floor x1.5) range', () => {
        const lo = Calendar.computeProgram(inputs('mlsn'));
        const up = Calendar.computeProgram(inputs('MLSN'));
        expect(comparable(up)).toEqual(comparable(lo));
        expect(lo.annual_totals_range.K).toEqual({ min: 37, max: 55.5 });
    });

    test('the three methodologies still differ from each other (normalisation did not collapse them)', () => {
        const aa = Calendar.computeProgram(inputs('AMMONIUM_ACETATE'));
        const slan = Calendar.computeProgram(inputs('SLAN'));
        const mlsn = Calendar.computeProgram(inputs('MLSN'));
        expect(aa.annual_totals_range.K).not.toEqual(slan.annual_totals_range.K);
        expect(slan.annual_totals_range.K).not.toEqual(mlsn.annual_totals_range.K);
        expect(aa.annual_totals_range.K).not.toEqual(mlsn.annual_totals_range.K);
    });
});

describe('GH-379 the result records the methodology that actually drove it, in one spelling', () => {
    test.each(AA_SPELLINGS.concat(['ammonium_acetate']))('%j stamps meta AMMONIUM_ACETATE / soil ammonium_acetate', (spelling) => {
        const p = Calendar.computeProgram(inputs(spelling));
        expect(p.meta.methodology).toBe('AMMONIUM_ACETATE');
        expect(p.soil.methodology).toBe('ammonium_acetate');
    });
    test('SLAN / MLSN stamps', () => {
        expect(Calendar.computeProgram(inputs('Slan')).meta.methodology).toBe('SLAN');
        expect(Calendar.computeProgram(inputs('Slan')).soil.methodology).toBe('slan');
        expect(Calendar.computeProgram(inputs('MLSN')).meta.methodology).toBe('MLSN');
        expect(Calendar.computeProgram(inputs('MLSN')).soil.methodology).toBe('mlsn');
    });
    test('no methodology at all still defaults to MLSN, as before', () => {
        const p = Calendar.computeProgram(inputs(undefined));
        expect(p.meta.methodology).toBe('MLSN');
        expect(p.soil.methodology).toBe('mlsn');
        expect(p.annual_totals_range.K).toEqual({ min: 37, max: 55.5 });
    });
});

describe('GH-379 word-export-combined.js normalises the methodology at the per-sample hand-off (defence in depth)', () => {
    const src = fs.readFileSync(COMBINED_PATH, 'utf8');

    test('perSampleInputs.methodology is resolved through GilbaNutritionCalendar.normalizeMethodology(), not copied raw', () => {
        const normalised = src.indexOf('normalizeMethodology(r.data.soil.methodology)');
        const assigned = src.indexOf('perSampleInputs.methodology =');
        expect(normalised).toBeGreaterThan(-1);
        expect(assigned).toBeGreaterThan(normalised);
        expect(src).not.toMatch(/perSampleInputs\.methodology = r\.data\.soil\.methodology;/);
    });

    test('the Prebble P-deficiency threshold reads perSampleInputs.methodology AFTER that hand-off, so it sees the folded key', () => {
        const handoff = src.indexOf('normalizeMethodology(r.data.soil.methodology)');
        const threshold = src.indexOf('var _pThreshold = ');
        expect(handoff).toBeGreaterThan(-1);
        expect(threshold).toBeGreaterThan(handoff);
        expect(src.slice(threshold, threshold + 120)).toMatch(/perSampleInputs\.methodology === 'mlsn'\) \? 21 : 30/);
    });

    test('the cotula S78 placeholder test compares the upper-cased stamp case-insensitively (its lowercase compare was dead)', () => {
        expect(src).toMatch(/String\(r\.data\.soil\.methodology \|\| ''\)\.toLowerCase\(\) === 'cotula_s78'/);
        expect(src).not.toMatch(/r\.data\.soil\.methodology === 'cotula_s78'/);
    });
});

describe('GH-379 the export\'s per-sample calendar sees the same texture / CEC its own ANR resolved (found live once the AA branch was reached)', () => {
    const src = fs.readFileSync(COMBINED_PATH, 'utf8');

    test('calendar: with the S277 inputs the certificate range is used; with no texture the generic AA band is — the gap the overlay closes', () => {
        const withTexture = Calendar.computeProgram(inputs('AMMONIUM_ACETATE'));
        const noTexture = Calendar.computeProgram(Object.assign(inputs('AMMONIUM_ACETATE'), { soilTexture: null, CEC: null }));
        expect(withTexture.annual_totals_range_source.K).toBe('certificate');
        expect(withTexture.annual_totals_range.K.min).toBeCloseTo(78.2, 6);
        expect(withTexture.annual_totals.K).toBe(136);
        // Live pre-overlay export figures: generic sands band, K 151.
        expect(noTexture.annual_totals_range_source.K).toBe('texture-fallback');
        expect(noTexture.annual_totals_range.K).toEqual({ min: 100, max: 235 });
        expect(noTexture.annual_totals.K).toBe(151);
    });

    test('word-export.js exposes the per-sample texture its AA range resolution used on engineInputs', () => {
        const we = fs.readFileSync(WORD_EXPORT_PATH, 'utf8');
        expect(we).toMatch(/_resolvedSoilTexture = _soilTexture;/);
        expect(we).toMatch(/aaRanges: _aaRanges,[\s\S]{0,400}soilTexture: _resolvedSoilTexture,/);
    });

    test('word-export-combined.js overlays engineInputs.soilTexture and the sample\'s own CEC onto the calendar inputs, only when resolved', () => {
        expect(src).toMatch(/var _eiTex = r\.data\.engineInputs && r\.data\.engineInputs\.soilTexture;\s*if \(_eiTex\) \{\s*perSampleInputs\.soilTexture = _eiTex;/);
        expect(src).toMatch(/if \(!isNaN\(_sampleCEC\) && _sampleCEC > 0\) \{\s*perSampleInputs\.CEC = _sampleCEC;/);
        // The overlay sits before the compute call it feeds.
        expect(src.indexOf('perSampleInputs.soilTexture = _eiTex')).toBeLessThan(src.indexOf('computeProgram(perSampleInputs)'));
    });
});

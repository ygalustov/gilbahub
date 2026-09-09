/**
 * GH-383 — source-text guard on the shared input contract (D31 stage 1).
 *
 * Every "the Plan page and the export disagree" defect in this area had the
 * same shape: a second, private read of a concept that already had a resolver.
 * GH-352/353/355/357/364 were five fixes to one texture chain; GH-379 was a
 * methodology spelling; the clipping gap and the annual-N gap were two more.
 * The adapter (assets/nutrition-program-inputs.js) exists so there is exactly
 * one read per concept. This file fails the moment a second one is added back.
 *
 * It is deliberately cheap and deliberately structural: it asserts the retired
 * reads are ABSENT from the files that used to make them, which no behavioural
 * test can do (a re-added side channel usually agrees with the adapter on the
 * fixture that happens to be under test, and diverges on the site that isn't).
 */

'use strict';

const fs = require('fs');
const path = require('path');

function read(file) {
    return fs.readFileSync(path.join(__dirname, '../assets/' + file), 'utf8');
}

/**
 * Comments stripped. The retired reads are NAMED in the explanatory comments
 * that replaced them ("annual N was `.gaip-nutrition-annual-n` -> ..."), which
 * is exactly the documentation a reader needs and exactly what a naive text
 * search would trip over. Strip them so this file asserts about CODE.
 */
function code(src) {
    return src.replace(/\/\*[\s\S]*?\*\//g, '').replace(/(^|[^:])\/\/[^\n]*/g, '$1');
}

/** The body of a named top-level function, up to its closing brace column. */
function fnBody(src, signature, endMarker) {
    const start = src.indexOf(signature);
    expect(start).toBeGreaterThan(-1);
    const end = src.indexOf(endMarker, start);
    expect(end).toBeGreaterThan(start);
    return src.slice(start, end);
}

describe('GH-383 — the export no longer reads programme inputs from its own side channels', () => {
    const wordExport = read('word-export.js');
    // Everything from the function's opening line to the object literal it
    // produces — i.e. all of its input resolution.
    const body = code(fnBody(wordExport, 'function _buildEngineInputs(data)', '\n        data.engineInputs = {'));

    test('the clippings boolean, which never had a writer, is gone', () => {
        expect(body).not.toMatch(/GAIP_STATE\.turf\.clippingsCollected/);
        expect(body).not.toMatch(/_stTurf\.clippingsCollected/);
        expect(body).not.toMatch(/clippingsCollected/);
    });

    test('the traffic slot, which never had a writer either, is gone', () => {
        expect(code(wordExport)).not.toMatch(/_stTraffic/);
        expect(body).not.toMatch(/_state\.traffic/);
    });

    test('the two annual-N DOM reads are gone — that pair is the cross-site N leak', () => {
        // `.gaip-nutrition-annual-n` is a hidden legacy input that
        // nutrition-calendar.js's restoreFromPersisted() fills with the FIRST
        // restored site's target_n and then refuses to refill, so every later
        // site in a Combined export inherited it.
        expect(body).not.toMatch(/querySelector\('\.gaip-nutrition-annual-n'\)/);
        expect(body).not.toMatch(/\.gaip-n-program/);
        expect(body).not.toMatch(/nProgramKgHaYr != null/);
    });

    test('the AA range resolution is gone from this file entirely', () => {
        expect(body).not.toMatch(/HillLabsSampleTypes/);
        expect(body).not.toMatch(/AmmoniumAcetateMethodology/);
        expect(body).not.toMatch(/deriveCode\(/);
        expect(body).not.toMatch(/getRangesPpm\(/);
        expect(body).not.toMatch(/_constructionTexture/);
    });

    test('what it does instead is one adapter call, and it publishes the provenance', () => {
        expect(body).toMatch(/GAIP_NutritionProgramInputs/);
        expect(body).toMatch(/resolveSiteProgramInputs\(\{/);
        expect(wordExport).toMatch(/sources: _programInputs \? _programInputs\.sources : null,/);
        expect(wordExport).toMatch(/ranges: _resolvedRanges,/);
    });
});

describe('GH-383 — the Combined export resolves per site, not from a facility snapshot', () => {
    const combined = code(read('word-export-combined.js'));

    test('the `|| 0` soil-ppm block is gone — a missing reading is null, not maximally deficient', () => {
        expect(combined).not.toMatch(/parseFloat\(r\.data\.soil\.[A-Za-z]+\)\s*\|\|\s*0/);
        expect(combined).toMatch(/_NPI\.validateSampleInputs\(\{/);
    });

    test('the annual N comes from the adapter keyed by r.siteId, not from the facility DOM snapshot', () => {
        expect(combined).toMatch(/resolveSiteProgramInputs\(\{\s*\n\s*siteId: r\.siteId,/);
        expect(combined).toMatch(/perSampleInputs\.annualNOverride = _siteInputs\.annualN;/);
        expect(combined).not.toMatch(/_persistedCal\.adjustments\.target_n/);
        // and it must never be allowed to read this page's hidden legacy input
        expect(combined).toMatch(/planForm: null/);
    });

    test('clipping, traffic, species, methodology and texture all come from that same call', () => {
        [
            'perSampleInputs.clippingManagement = _siteInputs.clippingManagement;',
            'perSampleInputs.traffic = _siteInputs.trafficIntensity;',
            'perSampleInputs.species = _siteInputs.speciesKey || perSampleInputs.species;',
            'perSampleInputs.methodology = _siteInputs.methodology;',
            'perSampleInputs.soilTexture = _siteInputs.soilTexture;',
            'perSampleInputs.CEC = _siteInputs.CEC;'
        ].forEach((line) => expect(combined).toContain(line));
    });

    test('a site whose inputs cannot be resolved is SKIPPED, never computed on another site\'s configuration', () => {
        expect(combined).toMatch(/no programme inputs for site/);
        expect(combined).toMatch(/rather than computing it/);
    });

    test('decision D-4b: the document says so when the annual N came from Settings rather than a generated programme', () => {
        expect(combined).toMatch(/annualNSource/);
        expect(combined).toMatch(/_src !== 'settings-turf' && _src !== 'species-default'/);
        expect(combined).toMatch(/Note — annual nitrogen target source: /);
        expect(combined).toMatch(/No nutrition programme has been generated on the Plan page/);
    });
});

describe('GH-383 — the core stays pure and the calendar stops carrying its own copies', () => {
    const core = read('nutrition-requirement-core.js');
    const calendar = code(read('nutrition-calendar.js'));
    const engine = code(read('nutrition-requirement-engine.js'));

    test('the core reads no global of any kind and has no traffic term', () => {
        const body = code(core.slice(core.indexOf("(function (global) {"), core.indexOf('const API = {')));
        expect(body).not.toMatch(/window\./);
        expect(body).not.toMatch(/document\./);
        expect(body).not.toMatch(/GilbaClassificationConstants/);
        expect(body).not.toMatch(/TRAFFIC_MODIFIERS/);
        // No traffic term is READ anywhere in the computation (the docblock and
        // the unknown-key warning name it; nothing consumes it).
        expect(body).not.toMatch(/config\.trafficIntensity/);
        expect(body).not.toMatch(/inputs\.trafficIntensity/);
        expect(body).not.toMatch(/trafficModifier/);
    });

    test('the engine keeps its public API but none of the per-nutrient constants', () => {
        expect(engine).not.toMatch(/const CLIPPING_COLLECTION_FACTOR/);
        expect(engine).not.toMatch(/const TRAFFIC_MODIFIERS/);
        expect(engine).not.toMatch(/const P_PH_ADJUSTMENTS/);
        expect(engine).not.toMatch(/const SPECIES_ALIASES/);
        // Re-exported from the core instead — one table, not two. Lazily, so
        // the engine's own load order is not a hard dependency: a page that
        // enqueued the core after this script would otherwise lose
        // NutritionRequirementEngine_Pure entirely rather than fail on first
        // use with a message that names the cause.
        expect(engine).toMatch(/function REMOVAL_RATES_\(\) \{ return _core\(\)\.REMOVAL_RATES; \}/);
        expect(engine).toMatch(/get MLSN_THRESHOLDS\(\) \{ return _core\(\)\.MLSN_THRESHOLDS; \}/);
        const Engine2 = require('../assets/nutrition-requirement-engine.js');
        const Core2 = require('../assets/nutrition-requirement-core.js');
        expect(Engine2.REMOVAL_RATES).toBe(Core2.REMOVAL_RATES);
        expect(Engine2.MLSN_THRESHOLDS).toBe(Core2.MLSN_THRESHOLDS);
        expect(Engine2.CLIPPING_FACTORS).toBe(Core2.CLIPPING_FACTORS);
    });

    test('the calendar takes clipping, traffic and turf type from the adapter', () => {
        expect(calendar).toMatch(/GAIP_NutritionProgramInputs/);
        expect(calendar).toMatch(/_programInputs && _programInputs\.clippingManagement/);
        expect(calendar).toMatch(/_programInputs && _programInputs\.trafficIntensity/);
        // and persists the provenance so the E2E harness can compare the two
        // resolved input objects field by field
        expect(calendar).toMatch(/inputSources: inputs\.inputSources \|\| null,/);
        expect(calendar).toMatch(/annualNBase: baseAnnualN,/);
    });

    test('the traffic modifier is applied at exactly one point in the calendar', () => {
        const applications = calendar.match(/baseAnnualN \* trafficMod/g) || [];
        expect(applications.length).toBe(1);
        // and the adapter's already-resolved modifier wins over the local table
        expect(calendar).toMatch(/typeof inputs\.trafficModifier === 'number' && inputs\.trafficModifier > 0/);
    });
});

describe('GH-383 — the two traffic tables that used to disagree are now one', () => {
    test('the adapter, the calendar\'s fallback and the plan\'s decision D-2 all carry the same five numbers', () => {
        const Inputs = require('../assets/nutrition-program-inputs.js');
        expect(Inputs.TRAFFIC_MODIFIERS).toEqual({ low: 0.85, moderate: 1.0, high: 1.15, extreme: 1.3 });
        expect(read('nutrition-calendar.js')).toMatch(/trafficModifiers: \{ low: 0\.85, moderate: 1\.0, high: 1\.15, extreme: 1\.3 \}/);
        // the engine's rejected candidate {0.8, 1.0, 1.2, 1.5} is gone
        expect(code(read('nutrition-requirement-engine.js'))).not.toMatch(/low: 0\.8, moderate: 1\.0, high: 1\.2, extreme: 1\.5/);
    });
});

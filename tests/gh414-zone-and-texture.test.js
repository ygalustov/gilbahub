/**
 * GH-414 — one green, one texture, one tissue analysis.
 *
 * Russley produced two different documents for the same green, from two
 * independent causes (audit F2):
 *
 *   TEXTURE. `resolveSoilTexture()` ranked `samples.soil_texture_snapshot`
 *   above the site's own `soil_texture_override`. The snapshot is stamped
 *   automatically at import (SampleController copies the site's texture onto
 *   every row as it is created) and reads `loam` on every Russley row, while
 *   the override reads `sand`. The Plan resolved sand (its state never carried
 *   a snapshot) and the export resolved loam, so one green got the Hill Labs
 *   S279 certificate on one surface and the generic ammonium-acetate "others"
 *   band on the other — P "On Track" against P "Deficit (-54%)", and three
 *   products in the document that the Plan never recommended. Decision D-2:
 *   the hand-set override wins.
 *
 *   TISSUE. The export has paired tissue to soil by zone key since
 *   b35fix_greentissue. The Plan applied no rule at all: it took the site's
 *   single most recent tissue analysis (plan.blade.php's GH-366 bridge) and
 *   handed it to every soil sample on the site — Russley's three greens all
 *   computed on Green 18's tissue, Burns' twenty-six all on Green 15's. The
 *   owner's rule is that a tissue result belongs to its own green or to none,
 *   with no "only one on the site, use it" fallback.
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
require('../assets/species-controller.js');
require('../assets/hill-labs-sample-types.js');
require('../assets/ammonium-acetate-methodology.js');
require('../assets/gaip-classification-constants.js');
require('../assets/zone-key.js');
const NPI = require('../assets/nutrition-program-inputs.js');
global.window.GAIP_NutritionProgramInputs = NPI;

global.console = _realConsole;

const FIX = JSON.parse(fs.readFileSync(
    path.join(__dirname, 'fixtures/gh414-russley-green18-aa-sand.json'), 'utf8'));
const CALENDAR_SRC = fs.readFileSync(path.join(__dirname, '../assets/nutrition-calendar.js'), 'utf8');
const COMBINED_SRC = fs.readFileSync(path.join(__dirname, '../assets/word-export-combined.js'), 'utf8');
const PLAN_BLADE = fs.readFileSync(
    path.join(__dirname, '../app/resources/views/plan.blade.php'), 'utf8');

function rangesFor(texture) {
    return NPI.resolveSufficiencyRanges({
        methodology: FIX.inputs.methodology,
        speciesDisplay: FIX.inputs.species,
        speciesKey: 'bentgrass',
        soilTexture: texture,
        CEC: null,
        pH: null
    });
}

function computeWith(texture, tissuePercent) {
    return Core.compute({
        soilValues: FIX.inputs.soilPpm,
        species: FIX.inputs.species,
        ph: null,
        methodology: FIX.inputs.methodology,
        ranges: rangesFor(texture).ranges,
        tissuePercent: tissuePercent,
        annualN: FIX.inputs.annualN,
        bulkDensity: FIX.inputs.bulkDensity,
        soilDepth: FIX.inputs.soilDepth,
        clippingManagement: FIX.inputs.clippingManagement,
        nutrients: ['P', 'K']
    });
}

describe('GH-414 (D-2) — the site override outranks the import-day snapshot', () => {
    test('the override wins over a snapshot that disagrees with it', () => {
        const tex = NPI.resolveSoilTexture({
            sampleTextureSnapshot: FIX.sample.soilTextureSnapshot,
            siteTextureOverride: FIX.site.soilTextureOverride,
            soil: null,
            turf: {}
        });
        expect(tex.value).toBe(FIX.expected.soilTexture);
        expect(tex.source).toBe(FIX.expected.soilTextureSource);
    });

    test('with no override the snapshot is still the answer — nothing else in the chain moved', () => {
        const tex = NPI.resolveSoilTexture({
            sampleTextureSnapshot: FIX.sample.soilTextureSnapshot,
            siteTextureOverride: null,
            soil: null,
            turf: {}
        });
        expect(tex.value).toBe('loam');
        expect(tex.source).toBe('sample-snapshot');
    });

    test('the override is only ever this page\'s own site — never borrowed across sites', () => {
        global.window.GAIP_HUB_CONFIG = { activeSiteId: FIX.site.id, soilTexture: 'sand' };
        expect(NPI.siteTextureOverrideFor(FIX.site.id)).toBe('sand');
        expect(NPI.siteTextureOverrideFor('some-other-site-id')).toBeNull();
        delete global.window.GAIP_HUB_CONFIG;
    });

    test('sand resolves the S279 certificate; loam falls to the generic band the document was using', () => {
        const sand = rangesFor('sand');
        expect(sand.certificateCode).toBe(FIX.expected.certificateCode);
        expect(sand.ranges.P).toMatchObject(FIX.expected.ranges.P);
        expect(sand.ranges.K).toMatchObject(FIX.expected.ranges.K);

        const loam = rangesFor('loam');
        expect(loam.certificateCode).toBe(FIX.expected.textureLoamWouldHaveGiven.certificateCode);
        expect(loam.ranges.P).toMatchObject(FIX.expected.textureLoamWouldHaveGiven.ranges.P);
        expect(loam.ranges.K).toMatchObject(FIX.expected.textureLoamWouldHaveGiven.ranges.K);
    });

    test('Green 18 on sand with its own tissue: P Required 0.0, K Required 119.0', () => {
        const c = computeWith('sand', FIX.inputs.tissuePercent);
        expect(c.tissueGateApplied).toBe(FIX.expected.tissueGateApplied);
        expect(c.perSample.P.removal).toBeCloseTo(FIX.expected.removal.P, 1);
        expect(c.perSample.K.removal).toBeCloseTo(FIX.expected.removal.K, 1);
        expect(c.perSample.P.annualRequirement).toBeCloseTo(FIX.expected.annualRequirement.P, 1);
        expect(c.perSample.K.annualRequirement).toBeCloseTo(FIX.expected.annualRequirement.K, 1);
    });

    test('the printed kg/ha Range for this sample is 7–21 and 109.5–273.7', () => {
        const r = rangesFor('sand').ranges;
        const unit = FIX.inputs.bulkDensity * FIX.inputs.soilDepth * 0.1;
        expect(`${Math.round(r.P.min * unit * 10) / 10}–${Math.round(r.P.max * unit * 10) / 10}`)
            .toBe(FIX.expected.rangeKgHa.P);
        expect(`${Math.round(r.K.min * unit * 10) / 10}–${Math.round(r.K.max * unit * 10) / 10}`)
            .toBe(FIX.expected.rangeKgHa.K);
    });

    test('a green with no tissue of its own falls to the species-table ratio, not another green\'s tissue', () => {
        const c = computeWith('sand', null);
        expect(c.tissueGateApplied).toBe(false);
        expect(c.perSample.P.removal).toBeCloseTo(FIX.expected.withoutTissue.removal.P, 1);
        expect(c.perSample.K.removal).toBeCloseTo(FIX.expected.withoutTissue.removal.K, 1);
    });
});

describe('GH-414 (D-2b) — one zone-matching rule, shared', () => {
    const tissue = [
        { id: 142, label: 'Green 18', date: '2026-07-01', N: 4.2, P: 0.38, K: 2.5 }
    ];

    test('a tissue result pairs with its own green', () => {
        const hit = NPI.matchSampleToZone(tissue, 'Green 18');
        expect(hit && hit.id).toBe(142);
    });

    test('and with no other green — no "the site only has one, use it" fallback', () => {
        expect(NPI.matchSampleToZone(tissue, 'Green 1')).toBeNull();
        expect(NPI.matchSampleToZone(tissue, 'Green 13')).toBeNull();
    });

    test('the old label would not have paired either — "18th Green" is not "Green 18" to the deriver', () => {
        // The zone key strips dates and seasons, never reorders words, so the
        // owner's rename of sample 142 is what makes this pair, on both
        // surfaces. Recorded because it is the reason the export showed no
        // tissue for any Russley green before 2026-09-11.
        expect(NPI.zoneKeyFor('18th Green')).not.toBe(NPI.zoneKeyFor('Green 18'));
    });

    test('a zone with several tissue analyses takes the latest', () => {
        const hit = NPI.matchSampleToZone([
            { id: 1, label: 'Green 18', date: '2024-01-01', N: 1, P: 1, K: 1 },
            { id: 2, label: 'Green 18', date: '2026-07-01', N: 2, P: 2, K: 2 }
        ], 'Green 18');
        expect(hit.id).toBe(2);
    });

    test('dates in a label do not split one zone in two', () => {
        expect(NPI.matchSampleToZone(tissue, 'Green 18 (2026-07-01)').id).toBe(142);
    });

    test('the Plan resolves tissue through the shared matcher and the export through the same buildZoneMap', () => {
        expect(CALENDAR_SRC).toMatch(/const _zoneTissue = this\.resolveZoneTissue\(soil\.zoneLabel \|\| null\);/);
        expect(CALENDAR_SRC).toMatch(/NPI\.matchSampleToZone\(list, zoneLabel\)/);
        expect(COMBINED_SRC).toMatch(/_NPI\.buildZoneMap\(/);
    });

    test('the Plan page loads the zone deriver it now depends on', () => {
        // The enqueued <script> tags, not the prose around them — the adapter
        // is named in a comment further up the file.
        const tags = (PLAN_BLADE.match(/legacyAssetUrl\('([^']+\.js)'\)/g) || [])
            .map((m) => m.replace(/.*'(.+)'.*/, '$1'));
        expect(tags).toContain('zone-key.js');
        expect(tags.indexOf('zone-key.js'))
            .toBeLessThan(tags.indexOf('nutrition-program-inputs.js'));
    });

    test('the document can say a zone has no tissue of its own — both facts reach the render layer', () => {
        // The caption asks `r.hasTissue && !r.tissueSampleId`. Both are resolved
        // once, per zone, when the entries are built, and neither was forwarded
        // onto the collected report — so the first draft of that caption was
        // dead code that printed nothing and looked correct in the source. Found
        // by reading the generated .docx, which is why this pin exists.
        expect(COMBINED_SRC).toMatch(/hasTissue: !!entry\.hasTissue,/);
        expect(COMBINED_SRC).toMatch(/tissueSampleId: entry\.tissueSampleId \|\| null/);
        expect(COMBINED_SRC).toMatch(/return r\.hasTissue && !r\.tissueSampleId;/);
        expect(COMBINED_SRC).toMatch(/No tissue sample for /);
    });

    test('no pair leaves the zone without tissue rather than reaching for the site-wide reading', () => {
        const idx = CALENDAR_SRC.indexOf('NutritionCalendar.resolveZoneTissue = function');
        expect(idx).toBeGreaterThan(-1);
        const block = CALENDAR_SRC.slice(idx, idx + 1800);
        expect(block).toMatch(/return \{ applies: true, percent: null \};/);
    });
});

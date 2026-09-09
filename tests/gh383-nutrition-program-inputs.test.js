/**
 * GH-383 — assets/nutrition-program-inputs.js, the ONE module both the Plan
 * page and the Word export resolve their programme-level inputs through
 * (D31 stage 0).
 *
 * What these tests are for: every previous fix in this area (GH-352..357,
 * GH-364, GH-379, the clipping gap, the annual-N gap) was "the two surfaces
 * read the same concept from different places". The adapter exists so there is
 * one place; these tests pin each resolution chain, its provenance stamp and
 * its fail-loud behaviour so a second place cannot quietly reappear.
 *
 * Runs the REAL HillLabsSampleTypes / AmmoniumAcetateMethodology /
 * SpeciesController / GilbaClassificationConstants modules the browser loads,
 * so deriveCode('Perennial Ryegrass', 'sand') resolves S277 here exactly as it
 * does live.
 */

'use strict';

// The adapter and the modules it reads are plain <script> globals in the
// browser; give them one shared object under Node.
global.window = global;
// A DOM stub with no Plan form on it — readPlanForm() must therefore find
// nothing and every "live form" case below is passed in explicitly.
global.document = global.document || {
    readyState: 'complete',
    addEventListener: function () {},
    getElementById: function () { return null; },
    querySelector: function () { return null; },
    querySelectorAll: function () { return []; }
};

require('../assets/species-controller.js');
const HLST = require('../assets/hill-labs-sample-types.js');
global.window.HillLabsSampleTypes = HLST;
// ammonium-acetate-methodology.js's load-time init() schedules a 1s DOM retry
// that would otherwise keep the jest worker alive.
const _realSetTimeout = global.setTimeout;
global.setTimeout = function (fn, ms) {
    const t = _realSetTimeout(fn, ms);
    if (t && typeof t.unref === 'function') t.unref();
    return t;
};
require('../assets/ammonium-acetate-methodology.js');
global.setTimeout = _realSetTimeout;
global.window.AmmoniumAcetateMethodology = global.window.AmmoniumAcetateMethodology || global.AmmoniumAcetateMethodology;
require('../assets/gaip-classification-constants.js');

const Core = require('../assets/nutrition-requirement-core.js');
global.window.NutritionRequirementCore = Core;
const Inputs = require('../assets/nutrition-program-inputs.js');

function withGlobals(map, fn) {
    const saved = {};
    Object.keys(map).forEach((k) => { saved[k] = global[k]; global[k] = map[k]; });
    try { return fn(); } finally {
        Object.keys(map).forEach((k) => {
            if (saved[k] === undefined) delete global[k]; else global[k] = saved[k];
        });
    }
}

const SITE = '019e96f3-9294-72be-a13c-7fa7427afd5a';

// ─────────────────────────── sufficiency ranges ───────────────────────────

describe('GH-383 — resolveSufficiencyRanges(): one resolver for all three methodologies', () => {
    test('AA: the Hill Labs certificate wins, and the source stamp says so', () => {
        const r = Inputs.resolveSufficiencyRanges({
            methodology: 'ammonium_acetate', speciesDisplay: 'Perennial Ryegrass',
            speciesKey: 'perennialRyegrass', soilTexture: 'sand', CEC: 5.9, pH: 6
        });
        expect(r.certificateCode).toBe('S277');
        expect(r.ranges.K).toEqual(expect.objectContaining({ min: 78.2, max: 195.5 }));
        expect(r.ranges.P).toEqual(expect.objectContaining({ min: 20, max: 30 }));
        expect(r.sources.K).toBe('certificate');
    });

    test('AA: a nutrient the certificate does not cover falls back to the generic band, stamped texture-fallback (GH-305)', () => {
        const r = Inputs.resolveSufficiencyRanges({
            methodology: 'ammonium_acetate', speciesDisplay: 'Perennial Ryegrass',
            soilTexture: 'sand', CEC: 5.9, pH: 6
        });
        // S277 prints no Sulphur range; the generic sands band still applies a
        // ceiling, so a clearly-high S reading can be zeroed.
        expect(r.sources.S).toBe('texture-fallback');
        expect(r.ranges.S).not.toBeNull();
        expect(typeof r.ranges.S.max).toBe('number');
    });

    test('AA: the methodology gate is real — a non-AA site never resolves an AA range', () => {
        const r = Inputs.resolveSufficiencyRanges({
            methodology: 'mlsn', speciesDisplay: 'Perennial Ryegrass', soilTexture: 'sand', CEC: 5.9, pH: 6
        });
        expect(r.certificateCode).toBeNull();
        expect(r.ranges.K.min).toBe(37); // MLSN, not the S277 78.2
    });

    test('SLAN: Carrow 2004 ranges from the SSOT, with the Spencer pH ladder on the P floor (GH-382)', () => {
        const neutral = Inputs.resolveSufficiencyRanges({ methodology: 'slan', pH: 6.5 });
        const acid = Inputs.resolveSufficiencyRanges({ methodology: 'slan', pH: 5.0 });
        const noPh = Inputs.resolveSufficiencyRanges({ methodology: 'slan', pH: null });
        expect(neutral.ranges.K).toEqual(expect.objectContaining({ min: 75, max: 176 }));
        expect(neutral.ranges.P.min).toBe(27);
        expect(acid.ranges.P.min).toBe(45);
        expect(acid.ranges.P.label).toBe('SLAN-Carrow-2004-range-PH-ADJUSTED');
        // No pH is never "assume a pH" — it is the published pH-independent floor.
        expect(noPh.ranges.P.min).toBe(27);
        expect(noPh.ranges.P.label).toBe('SLAN-Carrow-2004-range');
    });

    test('MLSN: decision D-7 keeps the pH ladder for the P threshold, on BOTH surfaces now', () => {
        const acid = Inputs.resolveSufficiencyRanges({ methodology: 'mlsn', pH: 5.2 });
        const neutral = Inputs.resolveSufficiencyRanges({ methodology: 'mlsn', pH: 6.7 });
        const alkaline = Inputs.resolveSufficiencyRanges({ methodology: 'mlsn', pH: 8.5 });
        expect(acid.ranges.P.min).toBe(35);
        expect(neutral.ranges.P.min).toBe(21);   // Burns' stored pH band — no numeric move today
        expect(alkaline.ranges.P.min).toBe(40);
        // MLSN publishes a floor only; the ceiling is the hub-wide x1.5 (GH-319).
        expect(neutral.ranges.P.max).toBeCloseTo(31.5, 6);
        expect(neutral.ranges.K).toEqual(expect.objectContaining({ min: 37, max: 55.5 }));
    });

    test('the Plan page\'s SSOT constants and the calendar\'s own fallback literals agree numerically (plan pitfall 6)', () => {
        const gcc = global.GilbaClassificationConstants;
        // The SSOT table also carries micronutrient minima (B/Cu/Fe/Mn/Zn) the
        // calendar's own fallback literal never had. Nothing in the nutrition
        // programme iterates them — both surfaces resolve P/K/Ca/Mg/S only —
        // so adding the SSOT to the Plan page moves no number; asserted rather
        // than assumed (plan pitfall 6).
        ['P', 'K', 'Ca', 'Mg', 'S'].forEach((n) => {
            expect(gcc.MLSN_THRESHOLDS[n]).toBe(Core.MLSN_THRESHOLDS[n]);
        });
        expect({ P: 21, K: 37, Ca: 331, Mg: 47, S: 7 }).toEqual(Core.MLSN_THRESHOLDS);
        ['P', 'K', 'Ca', 'Mg', 'S'].forEach((n) => {
            expect(gcc.SLAN_RANGES[n].floor).toBe(Core.SLAN_RANGES_FALLBACK[n].floor);
            expect(gcc.SLAN_RANGES[n].ceiling).toBe(Core.SLAN_RANGES_FALLBACK[n].ceiling);
        });
    });
});

// ─────────────────────────────── texture chain ───────────────────────────────

describe('GH-383 — resolveSoilTexture(): ONE chain, GH-364\'s order', () => {
    test('the sample\'s own snapshot beats everything else', () => {
        withGlobals({ GAIP_HUB_CONFIG: { soilTexture: 'clay_loam' } }, () => {
            const t = Inputs.resolveSoilTexture({
                sampleTextureSnapshot: 'sand', soil: { soilTexture: 'silt' }, turf: { construction: 'sand_profile' }
            });
            expect(t).toEqual({ value: 'sand', source: 'sample-snapshot' });
        });
    });

    test('the site\'s configured texture beats the construction bucket (GH-364 — a measured value outranks a guess)', () => {
        withGlobals({ GAIP_HUB_CONFIG: { soilTexture: 'clay_loam' } }, () => {
            const t = Inputs.resolveSoilTexture({ turf: { construction: 'sand_profile' } });
            expect(t).toEqual({ value: 'clay_loam', source: 'site-config' });
        });
    });

    test('construction is the last resort, and an unresolved texture says so instead of guessing sand', () => {
        withGlobals({ GAIP_HUB_CONFIG: {} }, () => {
            expect(Inputs.resolveSoilTexture({ turf: { construction: 'sand_profile' } }))
                .toEqual({ value: 'sand', source: 'turf-construction' });
            expect(Inputs.resolveSoilTexture({ turf: {} }))
                .toEqual({ value: null, source: 'unresolved' });
        });
    });

    test('the AA sands/others bucketing is the same substring rule deriveCode() uses', () => {
        expect(Inputs.aaTextureKey('sand')).toBe('sands');
        expect(Inputs.aaTextureKey('SANDY LOAM')).toBe('sands');
        expect(Inputs.aaTextureKey('clay_loam')).toBe('others');
        expect(Inputs.aaTextureKey(null)).toBe('others');
    });
});

// ───────────────────────────── traffic + annual N ─────────────────────────────

describe('GH-383 — traffic: settled decisions, deliberately not wired (stage 3)', () => {
    test('the table is the calendar\'s (decision D-2)', () => {
        expect(Inputs.TRAFFIC_MODIFIERS).toEqual({ low: 0.85, moderate: 1.0, high: 1.15, extreme: 1.3 });
    });

    test('non-sports turf is gated out before any schedule is even looked at (decision D-3)', () => {
        expect(Inputs.deriveTrafficIntensity({ matchesPerWeek: 5 }, 'golf'))
            .toEqual({ level: 'moderate', modifier: 1.0, source: 'not-sports' });
        expect(Inputs.deriveTrafficIntensity({ matchesPerWeek: 5 }, 'lawns').source).toBe('not-sports');
    });

    test('sports turf resolves neutral with source "not-wired" until stage 3 lands — never a fabricated level', () => {
        expect(Inputs.deriveTrafficIntensity(null, 'sports'))
            .toEqual({ level: 'moderate', modifier: 1.0, source: 'not-wired' });
        expect(Inputs.deriveTrafficIntensity({ matchesPerWeek: 5 }, 'sports').modifier).toBe(1.0);
    });
});

describe('GH-383 — resolveAnnualN(): the calendar\'s own rounding, in one place', () => {
    test('base x modifier, rounded to a whole kg (287.5 -> 288)', () => {
        expect(Inputs.resolveAnnualN({ base: 250, trafficModifier: 1.15 })).toBe(288);
        expect(Inputs.resolveAnnualN({ base: 120, trafficModifier: 1.0 })).toBe(120);
        expect(Inputs.resolveAnnualN({ base: 120 })).toBe(120);
    });

    test('an unusable base is null, never a substituted default', () => {
        expect(Inputs.resolveAnnualN({ base: 0 })).toBeNull();
        expect(Inputs.resolveAnnualN({ base: null })).toBeNull();
        expect(Inputs.resolveAnnualN({})).toBeNull();
    });
});

// ─────────────────────── sample-level null-not-zero rule ───────────────────────

describe('GH-383 — validateSampleInputs(): the Plan page\'s null-not-zero rule for every caller (GH-338)', () => {
    test('a genuinely absent reading is null, NOT 0 — 0 ppm reads as maximally deficient against every floor', () => {
        const v = Inputs.validateSampleInputs({ soilPpm: { P: 40, K: '', Ca: null } });
        expect(v.soilPpm.P).toBe(40);
        expect(v.soilPpm.K).toBeNull();
        expect(v.soilPpm.Ca).toBeNull();
        expect(v.soilPpm.Mg).toBeNull();
    });

    test('a real zero reading survives as 0 and is not confused with "absent"', () => {
        expect(Inputs.validateSampleInputs({ soilPpm: { P: 0 } }).soilPpm.P).toBe(0);
        expect(Inputs.validateSampleInputs({ soilPpm: { P: '0' } }).soilPpm.P).toBe(0);
    });

    test('a nested ppm object is read the same way the calendar\'s extractPpm() does', () => {
        expect(Inputs.validateSampleInputs({ soil: { ppm: { K: '276' } } }).soilPpm.K).toBe(276);
    });

    test('bulk density / depth fall back to the documented defaults and say that they did', () => {
        const v = Inputs.validateSampleInputs({});
        expect(v.bulkDensity).toBe(1.4);
        expect(v.soilDepth).toBe(10);
        expect(v.bulkDensityDefaulted).toBe(true);
        const real = Inputs.validateSampleInputs({ bulkDensity: 1.55, soilDepth: 15 });
        expect(real.bulkDensity).toBe(1.55);
        expect(real.bulkDensityDefaulted).toBe(false);
    });

    test('an all-null tissue object collapses to null rather than disabling a real facility resolution', () => {
        expect(Inputs.validateSampleInputs({ tissuePercent: { N: null, P: '', K: undefined } }).tissuePercent).toBeNull();
        expect(Inputs.validateSampleInputs({ tissuePercent: { N: 4.57, P: 0.62, K: 1.05 } }).tissuePercent)
            .toEqual({ N: 4.57, P: 0.62, K: 1.05 });
    });
});

// ──────────────────────────── the input contract ────────────────────────────

const CFG_TEST5 = {
    // subCategory is the real Test5 - NZ value; GH-387 resolves the surface
    // type from it, and it is NOT the same field as turfType.
    turf: { species: 'Perennial Ryegrass', methodology: 'ammonium_acetate', turfType: 'sports', subCategory: 'soccer', nProgram: 250 },
    nutritionCalendarProgram: {
        meta: { clippingManagement: 'returned' },
        adjustments: { target_n: 250, traffic_modifier: 1 }
    }
};

describe('GH-383 — resolveSiteProgramInputs(): source of truth per field, with provenance', () => {
    function run(extra) {
        return withGlobals({ GAIP_HUB_CONFIG: { activeSiteId: SITE, soilTexture: 'sand' } }, () =>
            Inputs.resolveSiteProgramInputs(Object.assign({
                siteId: SITE, siteConfig: CFG_TEST5, planForm: null
            }, extra || {})));
    }

    test('annual N: the live Plan form wins, stamped "plan"', () => {
        const r = run({ planForm: { annualN: 300, clippingManagement: 'collected' } });
        expect(r.annualNBase).toBe(300);
        expect(r.annualN).toBe(300);
        expect(r.sources.annualN).toBe('plan');
    });

    test('annual N: off the Plan page it comes from THIS site\'s persisted programme, stamped "plan-persisted"', () => {
        const r = run();
        expect(r.annualNBase).toBe(250);
        expect(r.sources.annualN).toBe('plan-persisted');
    });

    test('annual N: meta.annualNBase is preferred over the traffic-adjusted target_n so a modifier can never compound', () => {
        const cfg = JSON.parse(JSON.stringify(CFG_TEST5));
        cfg.nutritionCalendarProgram.meta.annualNBase = 250;
        cfg.nutritionCalendarProgram.adjustments = { target_n: 288, traffic_modifier: 1.15 };
        const r = run({ siteConfig: cfg });
        expect(r.annualNBase).toBe(250);
        expect(r.sources.annualN).toBe('plan-persisted');
    });

    test('annual N: a pre-GH-383 programme carrying only the adjusted target has the modifier divided back out', () => {
        const cfg = JSON.parse(JSON.stringify(CFG_TEST5));
        cfg.nutritionCalendarProgram.adjustments = { target_n: 288, traffic_modifier: 1.15 };
        const r = run({ siteConfig: cfg });
        expect(r.annualNBase).toBeCloseTo(250.43, 2);
    });

    test('annual N: decision D-4b — no programme at all falls back to Settings > Turf, then the species default, and says which', () => {
        const noProg = { turf: { species: 'Perennial Ryegrass', methodology: 'mlsn', turfType: 'golf', nProgram: 150 } };
        expect(run({ siteConfig: noProg }).sources.annualN).toBe('settings-turf');
        expect(run({ siteConfig: noProg }).annualNBase).toBe(150);

        const nothing = { turf: { species: 'Perennial Ryegrass', methodology: 'mlsn', turfType: 'golf' } };
        const r = run({ siteConfig: nothing });
        expect(r.sources.annualN).toBe('species-default');
        expect(r.annualNBase).toBe(180); // perennialRyegrass REMOVAL_RATES.N
    });

    test('clipping: live Plan select > this site\'s persisted meta > "collected"', () => {
        expect(run({ planForm: { annualN: 250, clippingManagement: 'collected' } }))
            .toEqual(expect.objectContaining({ clippingManagement: 'collected' }));
        expect(run().clippingManagement).toBe('returned');
        expect(run().sources.clippingManagement).toBe('plan-persisted');
        const noProg = { turf: { species: 'Perennial Ryegrass', turfType: 'golf' } };
        expect(run({ siteConfig: noProg }).clippingManagement).toBe('collected');
        expect(run({ siteConfig: noProg }).sources.clippingManagement).toBe('default');
    });

    test('clipping: the retired GAIP_STATE.turf.clippingsCollected boolean is NOT a source', () => {
        const r = withGlobals({
            GAIP_HUB_CONFIG: { activeSiteId: SITE, soilTexture: 'sand' },
            GAIP_STATE: { turf: { clippingsCollected: false } }
        }, () => Inputs.resolveSiteProgramInputs({
            siteId: SITE, siteConfig: { turf: { species: 'Perennial Ryegrass', turfType: 'golf' } }, planForm: null
        }));
        // false has always meant "no information" (the boolean has no writer
        // anywhere), so it must not become 'returned' and halve K removal.
        expect(r.clippingManagement).toBe('collected');
    });

    test('species: one resolution, both spellings — the nutrient key and the display name deriveCode() needs', () => {
        const r = run();
        expect(r.speciesKey).toBe('perennialRyegrass');
        expect(r.speciesDisplay).toBe('Perennial Ryegrass');
        expect(r.sources.species).toBe('site-config');
        // and the core folds the key to its own table row
        expect(Core._normalizeSpecies(r.speciesKey)).toBe('perennialRyegrass');
    });

    test('methodology is folded once, so no caller\'s spelling can route a branch (GH-379)', () => {
        expect(Inputs.normalizeMethodology('AMMONIUM_ACETATE')).toBe('ammonium_acetate');
        expect(Inputs.normalizeMethodology('Ammonium Acetate')).toBe('ammonium_acetate');
        expect(Inputs.normalizeMethodology('AA')).toBe('ammonium_acetate');
        expect(Inputs.normalizeMethodology('cotula_s78')).toBe('ammonium_acetate');
        expect(Inputs.normalizeMethodology('SLAN')).toBe('slan');
        expect(run().methodology).toBe('ammonium_acetate');
    });

    test('a per-sample override (b35fix367 multi-site turf) wins over the site identity and is stamped "sample"', () => {
        const r = run({ sample: { species: 'Kikuyu', turfType: 'lawns', methodology: 'slan', pH: 5.0 } });
        expect(r.speciesKey).toBe('kikuyu');
        expect(r.turfType).toBe('lawns');
        expect(r.methodology).toBe('slan');
        expect(r.sources.species).toBe('sample');
        expect(r.sources.turfType).toBe('sample');
        // the ranges follow the overridden methodology + pH
        expect(r.ranges.P.min).toBe(45);
    });

    test('the whole resolved object is what both surfaces get — ranges and provenance included', () => {
        const r = run();
        expect(r.ranges.K).toEqual(expect.objectContaining({ min: 78.2, max: 195.5 }));
        expect(r.rangeSources.K).toBe('certificate');
        expect(r.certificateCode).toBe('S277');
        expect(r.trafficIntensity).toBe('moderate');
        expect(r.trafficModifier).toBe(1.0);
        // GH-387 added `surfaceType` — the raw surface the calendar works in,
        // which the export used to take from `turfType` (a different field).
        expect(Object.keys(r.sources).sort()).toEqual(
            ['annualN', 'clippingManagement', 'methodology', 'soilTexture', 'species', 'surfaceType', 'trafficIntensity', 'turfType']);
        expect(r.surfaceType).toBe('soccer');
        expect(r.recommenderSurfaceType).toBe('soccer');
    });
});

describe('GH-383 — getSiteConfig() fails loud rather than borrowing another site\'s config (plan pitfall 10)', () => {
    test('a hub page reads the per-site store', () => {
        withGlobals({
            GAIP_HUB_CONFIG: { activeSiteId: 'other-site' },
            GAIP_SiteConfig: { getConfig: (id) => (id === SITE ? CFG_TEST5 : null) }
        }, () => {
            expect(Inputs.getSiteConfig(SITE)).toBe(CFG_TEST5);
        });
    });

    test('the Plan page\'s server-rendered config is used ONLY for the active site', () => {
        withGlobals({ GAIP_HUB_CONFIG: { activeSiteId: SITE }, GAIP_SITE_CONFIG: CFG_TEST5 }, () => {
            expect(Inputs.getSiteConfig(SITE)).toBe(CFG_TEST5);
            expect(Inputs.getSiteConfig('some-other-site')).toBeNull();
        });
    });

    test('resolveSiteProgramInputs throws, naming the site, when nothing resolves', () => {
        withGlobals({ GAIP_HUB_CONFIG: { activeSiteId: SITE } }, () => {
            expect(() => Inputs.resolveSiteProgramInputs({ siteId: 'unknown-site' }))
                .toThrow(/no gaip site config resolved for site unknown-site/);
        });
    });
});

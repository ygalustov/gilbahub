/**
 * GH-727 (queue item 3bt) — THE WEED SET A CLIENT SEES IS THE SET FOR THE SITE'S OWN PLACE.
 *
 * TWO FAULTS, ONE SENTENCE OF CODE EACH, AND THEY HID EACH OTHER.
 *
 * 1. TWO DICTIONARIES. The builder handed the engine an identifier out of `REGIONS`
 *    (`australia_temperate`, `new_zealand`, `uk_ireland`, `us_transition`); the weed tables answered to
 *    four short codes of their own — `au`, `nz`, `uk`, `eu` — and a species joins a set only on an exact
 *    match or on `all`. So every site on the stand was served the seven `all` species and nothing else:
 *    six weeds missing in Australia, five in New Zealand, two in the UK.
 * 2. THE COORDINATES CAME OFF THE PAGE. `.gaip-lat` / `.gaip-lon` belong to whichever site the hidden
 *    runner last restored, so a pass for one site could be given another site's place. Measured in the
 *    database, not reasoned about: four Australian sites (`Burns`, `Canberra`, `New test - location`,
 *    `Westview`) hold `new_zealand` in their last stored row, ten rows in all, and `/plan` prints it.
 *
 * WHY THEY HID EACH OTHER: the hardwired `region = "au"` fired only when the page's fields would not
 * parse, and `au` was the one value the table understood. The fallback worked and the measured path did
 * not, so the sets looked plausible while the region printed under them was someone else's.
 *
 * WHAT THIS FILE ASSERTS IS THE CONSEQUENCE, not the wiring: which species keys come back for a place,
 * and whose coordinates decided the place. The expected sets are written out here as literal keys —
 * taken from the engine they would agree with it however wrong both were — while the owner's list of
 * regions is read from `regional-profiles.js`, which is the one place that declares it.
 */

'use strict';

const { load, computeAll, withSiteRow } = require('./lib/orchestrator-bench');

const SITE_ID = 'gh727-site';

/** Canberra, and it is Australia by the owner's own frame. */
const IN_AUSTRALIA = { id: SITE_ID, latitude: -35.2809, longitude: 149.13 };
/** Auckland. */
const IN_NEW_ZEALAND = { id: SITE_ID, latitude: -36.8485, longitude: 174.7633 };

const WARM_ENOUGH = {
    soilTemp5cm: 15,
    soilTempHistory: [13, 13.4, 13.8, 14.1, 14.5, 14.8, 15, 15, 14.9, 15.1, 15.2, 15, 15.1, 15],
};

/**
 * The regions the owner declares, written out so that the control below compares a LIST with a list.
 * The cases themselves read the list from `regional-profiles.js`: this copy is here to catch a
 * universe that came back empty or truncated, which would make every case pass looking at nothing.
 */
const OWNERS_REGIONS = [
    'australia', 'australia_mediterranean', 'australia_subtropical', 'australia_temperate',
    'australia_tropical', 'continental_europe', 'germany', 'japan', 'mediterranean', 'new_zealand',
    'scandinavia', 'south_africa', 'southeast_asia', 'uk_ireland', 'us_north', 'us_south',
    'us_transition',
];

/** Every weed the temperate table declares, which is also what the catalogue listing answers with. */
const TEMPERATE_TABLE = [
    'dactyloctenium_aegyptium', 'digitaria_ciliaris', 'digitaria_ischaemum', 'digitaria_sanguinalis',
    'eleusine_indica', 'hypochoeris_radicata', 'lamium_amplexicaule', 'oxalis_corniculata',
    'poa_annua', 'soliva_sessilis', 'stellaria_media', 'taraxacum_officinale', 'trifolium_repens',
];

/** The seven every region gets: they carry `all`. */
const EVERYWHERE = [
    'digitaria_ischaemum', 'digitaria_sanguinalis', 'eleusine_indica', 'lamium_amplexicaule',
    'poa_annua', 'stellaria_media', 'taraxacum_officinale',
];

const AUSTRALIA_TEMPERATE = [
    'dactyloctenium_aegyptium', 'digitaria_ciliaris', 'digitaria_ischaemum', 'digitaria_sanguinalis',
    'eleusine_indica', 'hypochoeris_radicata', 'lamium_amplexicaule', 'oxalis_corniculata',
    'poa_annua', 'soliva_sessilis', 'stellaria_media', 'taraxacum_officinale', 'trifolium_repens',
];

const NEW_ZEALAND = [
    'digitaria_ciliaris', 'digitaria_ischaemum', 'digitaria_sanguinalis', 'eleusine_indica',
    'hypochoeris_radicata', 'lamium_amplexicaule', 'oxalis_corniculata', 'poa_annua',
    'soliva_sessilis', 'stellaria_media', 'taraxacum_officinale', 'trifolium_repens',
];

const UK_IRELAND = [
    'digitaria_ischaemum', 'digitaria_sanguinalis', 'eleusine_indica', 'lamium_amplexicaule',
    'oxalis_corniculata', 'poa_annua', 'stellaria_media', 'taraxacum_officinale', 'trifolium_repens',
];

/** The tropical half already spoke the owner's names; these sets must not move. */
const TROPICAL_ONLY = [
    'axonopus_compressus', 'cyperus_esculentus', 'cyperus_rotundus', 'digitaria_ciliaris',
    'echinochloa_colona', 'eleusine_indica', 'euphorbia_hirta', 'fimbristylis_miliacea',
    'kyllinga_brevifolia', 'leptochloa_spp', 'murdannia_nudiflora', 'oxalis_corniculata',
    'paspalum_distichum', 'phyllanthus_urinaria', 'richardia_scabra', 'rottboellia_cochinchinensis',
];
const SUBTROPICAL_ONLY = TROPICAL_ONLY.filter((k) => [
    'fimbristylis_miliacea', 'leptochloa_spp', 'phyllanthus_urinaria', 'rottboellia_cochinchinensis',
].indexOf(k) < 0);

const sorted = (a) => a.slice().sort();
const union = (a, b) => sorted([...new Set([...a, ...b])]);

jest.setTimeout(120000);

function setOf(engine, region) {
    const out = engine.analyse(Object.assign({ region: region }, WARM_ENOUGH));
    return { result: out, keys: sorted((out.results || []).map((r) => r.speciesKey)) };
}

describe('GH-727 — one list of regions, and the weed tables speak it', () => {
    let engine;
    let owners;

    beforeAll(() => {
        const bench = load();
        expect(bench.failed).toEqual([]);
        engine = bench.ctx.GAIP_PreEmergent;
        owners = Object.keys(bench.ctx.GAIP_RegionalProfiles.REGIONS);
        // Positive control: an empty universe or an empty table would make every
        // case below pass while looking at nothing.
        expect(sorted(owners)).toEqual(sorted(OWNERS_REGIONS));
        expect(sorted(Object.keys(engine.SPECIES_DB))).toEqual(sorted(TEMPERATE_TABLE));
        expect(sorted(Object.keys(engine.TROPICAL_SPECIES_DB))).toEqual(sorted(TROPICAL_ONLY));
    });

    test('every region a weed is tagged with is a region the owner declares', () => {
        const tags = {};
        [engine.SPECIES_DB, engine.TROPICAL_SPECIES_DB].forEach((db) => {
            Object.keys(db).forEach((key) => {
                (db[key].regions || []).forEach((r) => {
                    if (r === 'all') return;
                    (tags[r] = tags[r] || []).push(key);
                });
            });
        });

        process.stdout.write('[gh727] region list read from regional-profiles.js: '
            + JSON.stringify(sorted(owners)) + '\n');
        process.stdout.write('[gh727] tags found on weeds: ' + JSON.stringify(sorted(Object.keys(tags))) + '\n');

        const strangers = {};
        Object.keys(tags).forEach((r) => { if (owners.indexOf(r) < 0) strangers[r] = sorted(tags[r]); });
        expect(strangers).toEqual({});
    });

    test('an Australian temperate site is offered the thirteen weeds of its place', () => {
        const seen = setOf(engine, 'australia_temperate');
        process.stdout.write('[gh727] australia_temperate: ' + seen.keys.length + ' '
            + JSON.stringify(seen.keys) + '\n');
        expect(seen.keys).toEqual(sorted(AUSTRALIA_TEMPERATE));
    });

    test('and so are the other two Australian temperate identifiers, by the same tag', () => {
        expect(setOf(engine, 'australia_mediterranean').keys).toEqual(sorted(AUSTRALIA_TEMPERATE));
        expect(setOf(engine, 'australia').keys).toEqual(sorted(AUSTRALIA_TEMPERATE));
    });

    test('a New Zealand site is offered twelve, and Crowfoot grass is not among them', () => {
        const seen = setOf(engine, 'new_zealand');
        process.stdout.write('[gh727] new_zealand: ' + seen.keys.length + ' ' + JSON.stringify(seen.keys) + '\n');
        expect(seen.keys).toEqual(sorted(NEW_ZEALAND));
        // Dactyloctenium aegyptium is tagged Australia only, and that is why the
        // two parts of this work could not be split: the dictionary alone would
        // have given these four Australian sites the New Zealand set.
        expect(seen.keys).not.toContain('dactyloctenium_aegyptium');
    });

    test('a UK site is offered nine', () => {
        const seen = setOf(engine, 'uk_ireland');
        process.stdout.write('[gh727] uk_ireland: ' + seen.keys.length + ' ' + JSON.stringify(seen.keys) + '\n');
        expect(seen.keys).toEqual(sorted(UK_IRELAND));
    });

    test('a US site is offered the seven of everywhere — no weed in the table claims the US', () => {
        const seen = setOf(engine, 'us_transition');
        process.stdout.write('[gh727] us_transition: ' + seen.keys.length + ' ' + JSON.stringify(seen.keys) + '\n');
        expect(seen.keys).toEqual(sorted(EVERYWHERE));
    });

    test('the tropical sets are exactly what they were', () => {
        const sea = setOf(engine, 'southeast_asia');
        const trop = setOf(engine, 'australia_tropical');
        const sub = setOf(engine, 'australia_subtropical');
        process.stdout.write('[gh727] tropical counts: southeast_asia=' + sea.keys.length
            + ' australia_tropical=' + trop.keys.length + ' australia_subtropical=' + sub.keys.length + '\n');
        expect(sea.keys).toEqual(union(EVERYWHERE, TROPICAL_ONLY));
        expect(trop.keys).toEqual(union(EVERYWHERE, TROPICAL_ONLY));
        expect(sub.keys).toEqual(union(EVERYWHERE, SUBTROPICAL_ONLY));
    });

    test('with no region the engine refuses instead of answering for everywhere', () => {
        const out = engine.analyse(Object.assign({}, WARM_ENOUGH));
        process.stdout.write('[gh727] no region: ' + JSON.stringify({
            success: out.success, error: out.error, results: (out.results || []).length,
        }) + '\n');
        expect(out.success).toBe(false);
        expect(out.error).toBe('region is required');
        expect(out.results).toEqual([]);
    });

    test('the catalogue listing is untouched — `all` there means the whole catalogue', () => {
        // `listSpecies('all')` answers "what does this product know about", which
        // is not a statement about a site, so it keeps its default.
        expect(sorted(engine.listSpecies('all').map((s) => s.key))).toEqual(sorted(TEMPERATE_TABLE));
        expect(sorted(engine.listSpecies().map((s) => s.key))).toEqual(sorted(TEMPERATE_TABLE));
    });
});

describe('GH-727 — the place comes from the site row, not from the page', () => {
    /**
     * The page's coordinate fields are left in place and are still written and read by other modules;
     * what is measured here is that the builder no longer asks them. The fields are given a REAL
     * latitude and longitude of the other country — which is exactly how the defect happened — so a
     * builder that reads them answers confidently and wrongly.
     */
    function benchFor(row, pageCoords) {
        const bench = load();
        expect(bench.failed).toEqual([]);
        const { ctx } = bench;
        withSiteRow(bench, row);
        if (pageCoords) {
            ctx.document.querySelector = (sel) => {
                const s = String(sel);
                if (s.indexOf('gaip-lat') >= 0) return { value: String(pageCoords.lat) };
                if (s.indexOf('gaip-lon') >= 0) return { value: String(pageCoords.lon) };
                return null;
            };
        }
        return bench;
    }

    test('an Australian site whose page still holds Auckland gets the Australian set', () => {
        const bench = benchFor(IN_AUSTRALIA, { lat: -36.8485, lon: 174.7633 });
        const inputs = bench.ctx.GaipOrchestrator.buildPreEmergentInputs();
        const seen = setOf(bench.ctx.GAIP_PreEmergent, inputs.region);
        process.stdout.write('[gh727] site AU / page NZ -> region=' + inputs.region
            + ' species=' + seen.keys.length + '\n');
        expect(inputs.region).toBe('australia_temperate');
        expect(seen.keys).toEqual(sorted(AUSTRALIA_TEMPERATE));
    });

    test('and the other way round: a New Zealand site whose page still holds Canberra', () => {
        const bench = benchFor(IN_NEW_ZEALAND, { lat: -35.2809, lon: 149.13 });
        const inputs = bench.ctx.GaipOrchestrator.buildPreEmergentInputs();
        const seen = setOf(bench.ctx.GAIP_PreEmergent, inputs.region);
        process.stdout.write('[gh727] site NZ / page AU -> region=' + inputs.region
            + ' species=' + seen.keys.length + '\n');
        expect(inputs.region).toBe('new_zealand');
        expect(seen.keys).toEqual(sorted(NEW_ZEALAND));
    });

    test('a site whose row carries no coordinates gets no region, and nothing is put in its place', () => {
        const bench = benchFor({ id: SITE_ID, latitude: null, longitude: null }, null);
        const inputs = bench.ctx.GaipOrchestrator.buildPreEmergentInputs();
        process.stdout.write('[gh727] site with no coordinates -> region=' + JSON.stringify(inputs.region) + '\n');
        expect(inputs.region).toBeNull();
    });

    test('and its pass names the gap instead of computing a set for Australia', async () => {
        const bench = benchFor({ id: SITE_ID, latitude: null, longitude: null }, null);

        const out = await computeAll(bench, {
            turf: { species: 'Creeping Bentgrass (Greens)', methodology: 'slan', surface: 'greens' },
            site: { lat: -35.3317, lon: 149.11, latitude: -35.3317, longitude: 149.11 },
        });
        // POSITIVE CONTROL, off the pass that just ran: the step had a soil temperature to work with,
        // so what is missing below is the place and not the weather. Without this, a run that never
        // reached step 8b at all would look exactly like the case being measured.
        const inputs = bench.ctx.GaipOrchestrator.buildPreEmergentInputs();
        expect(inputs.soilTemp5cm).not.toBeNull();
        expect(inputs.region).toBeNull();

        const skipped = out.state.computed.skipped || [];
        const preEm = out.state.computed.preEmergent;
        process.stdout.write('[gh727] no-coordinates pass: soilTemp5cm=' + inputs.soilTemp5cm
            + ' skipped=' + JSON.stringify(skipped.map((s) => [s.module, s.reason]))
            + ' preEmergent=' + JSON.stringify(preEm && preEm.summary ? preEm.summary.region : preEm) + '\n');

        const named = skipped.filter((s) => s.module === 'pre-emergent')[0];
        expect(named).toBeDefined();
        expect(named.resultKey).toBe('preEmergent');
        expect(preEm == null || preEm.results == null || preEm.results.length === 0).toBe(true);
        // and the run says in its own words what is missing, so the panel can name it
        const journal = (out.state.computed.warnings || []).filter((w) => w.module === 'pre-emergent');
        expect(journal.map((w) => w.message).join(' ')).toMatch(/coordinates/);
    });
});

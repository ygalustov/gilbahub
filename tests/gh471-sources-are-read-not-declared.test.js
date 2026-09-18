/**
 * GH-471 (PLAN-GH439 section 10.6, tenth and eleventh refinements) — the
 * stores have the shape they were measured to have, and a field's source is
 * worked out from the read rather than written beside it.
 *
 * What this closes cost a client a printed line. `take('locationName',
 * cfg.locationName, 'site-config')` reads a key no site config has — the name
 * lives at `location.name` — so the provenance map recorded a documented key
 * with the legal value 'unresolved', the completeness test stayed green, and
 * the document printed "Location: -35.2285452, 149.0022925" instead of the
 * place. The source was an author's claim and nothing could check it.
 *
 * The same shape sat on the other side: the sandbox's stubs were written from
 * memory and repaired one key at a time, and the product read
 * `row.name || row.label` and `values || payload || sample` — a stub that
 * agrees with any reading, and a reading that agrees with any stub.
 */
'use strict';

const fs = require('fs');
const path = require('path');
const parser = require('@babel/parser');
const traverse = require('@babel/traverse').default;
const { loadPage, SITE_ID, SITE_NAME, STORE_SHAPES, hubScripts, poisonPage, POISON_SENTINEL } = require('./helpers/export-page-sandbox');

const ASSETS = path.join(__dirname, '..', 'assets');
const RESOLVER = fs.readFileSync(path.join(ASSETS, 'nutrition-program-inputs.js'), 'utf8');
/** The server's ownership table, generated from App\Support\FieldOwners. */
const FIELD_OWNERS = JSON.parse(fs.readFileSync(
    path.join(__dirname, 'fixtures', 'field-owners.json'), 'utf8'));
const OWNERS = FIELD_OWNERS.owners;

/**
 * Methods the product calls on a store object that the export page's sandbox
 * does not answer, each because the object carrying it lives on another page.
 * Recorded so the surface can only shrink.
 */
const CALLED_ELSEWHERE = ['addSample', 'addSite', 'addSiteWithId', 'canDriveRecommendations',
    'captureFromForm', 'captureRawForm', 'clearSamples', 'compareSamples', 'deleteSample',
    'forEach', 'getActiveSampleId', 'getAreaGuidance', 'getCurrentSiteLabel', 'getSample',
    'getSampleCount', 'getSiteMappings', 'hasCredentials', 'importFile', 'isRestoring',
    'map', 'mergeConfig',
    // GH-533 (stage 2): `normalizeValues` joined the list. The server restore
    // in sample-persistence.js now derives `normalized` from the unwrapped
    // lab readings instead of leaving the field off the object entirely --
    // which is what let `Object.keys(s.normalized)` in sample-manager.js meet
    // an undefined on a server-restored sample. It is called on the page and
    // never by an export, so it belongs here rather than in the stub set.
    'normalizeValues',
    'removeSite', 'renameSample', 'renameSite',
    'restoreFromPersistence', 'sampleAgeMonths', 'saveSample',
    // GH-479 (sixteenth refinement, point 1): `setActiveSite` and `loadSample`
    // left this list. They were in it because the reconciliation ran
    // `collectData()` — a convenient call, not an entry point a client uses.
    // On /reports/export the client goes through the combined export, and its
    // loop calls both on every sample.
    'setCompanionSpecies', 'setMultiSiteTurfEnabled', 'setSampleTurfProfile', 'setZoneType',
    'slice', 'switchToSite', 'updateSample'];
/** The file without its prose: a guard that reads its own explanation as code
 *  is checking the wrong thing. */
const code = (src) => src.replace(/\/\/[^\n]*/g, '').replace(/\/\*[\s\S]*?\*\//g, '');
const RESOLVER_CODE = code(RESOLVER);

/**
 * GH-474 (thirteenth refinement, point 2) — resolve a FULL PATH in the shape
 * of ONE store, step by step.
 *
 * What this replaces walked the fixture's top-level keys and looked for the
 * path's LAST SEGMENT as a key name anywhere it found. Both halves were false:
 * the method answer shapes live under `answers`, so `area_ha` was being looked
 * for among method names; and a leaf found in some other store's shape read as
 * "the path exists" (`name` is a key of a site-list row, so a nonsense path
 * ending in `name` resolved), while a path two levels deep resolved as
 * "missing" because no flat shape has a dotted key.
 */
const SHAPE_OF = {
    'site-row': 'answers.getSite(id)',
    'site-config': 'answers.getConfig(id)',
    'site-list': 'answers.getSiteList()',
    'sample': 'answers.getActiveSample(soil)'
};

/** The recorded shape named by `answers.<method>` or by a plain name. */
function recordedShape(name) {
    if (name.indexOf('answers.') === 0) {
        return (STORE_SHAPES.answers || {})[name.slice('answers.'.length)] || null;
    }
    return STORE_SHAPES[name] || null;
}

/**
 * Whether a dotted path resolves in one recorded shape. The shapes are flat
 * per object and a nested object is recorded as its own named shape, so each
 * step is followed through that map rather than guessed at.
 */
const NESTED_SHAPES = {
    'answers.getConfig(id).turf': 'siteConfigTurfUnion',
    'answers.getConfig(id).location': 'siteConfigLocationUnion',
    'siteConfigUnion.turf': 'siteConfigTurfUnion',
    'siteConfigUnion.location': 'siteConfigLocationUnion',
    'answers.getActiveSample(soil).values': 'soilSampleValues'
};

function pathExistsIn(shapeName, dotted) {
    const parts = String(dotted).split('.');
    let name = shapeName;
    for (let i = 0; i < parts.length; i++) {
        const shape = recordedShape(name);
        if (!shape || !Object.prototype.hasOwnProperty.call(shape, parts[i])) return false;
        if (i === parts.length - 1) return true;
        const nested = NESTED_SHAPES[name + '.' + parts[i]];
        if (!nested) return false;
        name = nested;
    }
    return false;
}

describe('GH-471 — the sandbox\'s stores have exactly the shape the live ones do', () => {
    let sandbox;

    beforeAll(() => {
        const page = loadPage({ errors: [], warnings: [], alerts: [] });
        expect(page.failures).toEqual([]);
        sandbox = page.sandbox;
    });

    test.each([
        ['siteListRow', () => sandbox.GAIP_SampleManager.getSiteList()[0]],
        ['soilSample', () => sandbox.GAIP_SampleManager.getActiveSample('soil')],
        ['siteConfigUnion', () => sandbox.GAIP_SiteConfig.getConfig(SITE_ID)],
        ['siteConfigTurfUnion', () => sandbox.GAIP_SiteConfig.getConfig(SITE_ID).turf],
        ['siteConfigLocationUnion', () => sandbox.GAIP_SiteConfig.getConfig(SITE_ID).location]
    ])('%s: the stub\'s keys and the recorded keys are the same set, both ways', (name, get) => {
        const recorded = Object.keys(STORE_SHAPES[name] || {}).sort();
        const stub = Object.keys(get() || {}).sort();
        expect({ name: name, keys: stub }).toEqual({ name: name, keys: recorded });
    });

    test('the recording says how and when it was taken', () => {
        const meta = JSON.parse(fs.readFileSync(
            path.join(__dirname, 'fixtures', 'store-shapes.json'), 'utf8'));
        expect(meta._captured).toMatch(/^\d{4}-\d{2}-\d{2}$/);
        expect(String(meta._why).length).toBeGreaterThan(40);
        // The config shape is a union over every site, not one site's: a key
        // only an oversown site carries is still a live key.
        expect(meta.shapes._sitesUnioned).toBeGreaterThan(1);
    });
});

describe('GH-471 — the resolver reads only keys the live stores have', () => {
    test('no read of a store object names a key that is not in the recorded shape', () => {
        // `row.<k>` and `samples.<kind>.<k>`, checked against the recording.
        const ast = parser.parse(RESOLVER, { sourceType: 'script', errorRecovery: true });
        const strangers = [];
        const SAMPLE_KEYS = Object.keys(STORE_SHAPES.soilSample || {});
        traverse(ast, {
            MemberExpression(p) {
                const obj = p.node.object;
                const prop = p.node.property;
                if (prop.type !== 'Identifier') return;
                // samples.soil.<k> / samples.tissue.<k> / samples.water.<k>
                if (obj.type === 'MemberExpression' && obj.object.type === 'Identifier'
                    && obj.object.name === 'samples' && obj.property.type === 'Identifier'
                    && ['soil', 'tissue', 'water'].indexOf(obj.property.name) >= 0) {
                    if (SAMPLE_KEYS.indexOf(prop.name) < 0) {
                        strangers.push('samples.' + obj.property.name + '.' + prop.name);
                    }
                }
                // siteRow.<k>
                if (obj.type === 'Identifier' && obj.name === 'siteRow') {
                    if (Object.keys(STORE_SHAPES.siteListRow || {}).indexOf(prop.name) < 0) {
                        strangers.push('siteRow.' + prop.name);
                    }
                }
            }
        });
        expect({ strangers: Array.from(new Set(strangers)) }).toEqual({ strangers: [] });
    });

    test('no pliant read is left: one key, not a chain of alternative names', () => {
        // A read that accepts either spelling agrees with any store, which is
        // what made a stub written from memory undetectable.
        expect(RESOLVER_CODE).not.toMatch(/row\.name \|\| row\.label/);
        expect(RESOLVER_CODE).not.toMatch(/\.values \|\| [\w.]*\.payload/);
        const cal = code(fs.readFileSync(path.join(ASSETS, 'nutrition-calendar.js'), 'utf8'));
        expect(cal).not.toMatch(/sample\.values \|\| sample\.payload/);
    });
});

describe('GH-471 — a field\'s source is what it was read from', () => {
    let NPI, inputs, cfg, FIELD_PATHS;

    beforeAll(() => {
        const page = loadPage({ errors: [], warnings: [], alerts: [] });
        expect(page.failures).toEqual([]);
        NPI = page.sandbox.GAIP_NutritionProgramInputs;
        FIELD_PATHS = NPI.FIELD_PATHS;
        cfg = page.sandbox.GAIP_SiteConfig.getConfig(SITE_ID);
        inputs = NPI.resolveExportInputs({ siteId: SITE_ID });
    });

    test('there is no way left to declare a source by hand', () => {
        expect(RESOLVER_CODE).not.toMatch(/take\('[a-zA-Z]+',[^)]*'site-config'\)/);
        expect(RESOLVER_CODE).toMatch(/const fromConfig = \(field\)/);
        // GH-473: the reader takes an IDENTIFIER, not a record. A reader
        // handed a record proves which store a value came from and nothing
        // about which record.
        expect(RESOLVER_CODE).toMatch(/const fromSite = \(field\)/);
        expect(RESOLVER_CODE).not.toMatch(/fromSiteList\(field, row\)/);
    });

    test('the provenance map and the path table name the same fields', () => {
        const mapped = Object.keys(inputs.sources).sort();
        const paths = Object.keys(FIELD_PATHS).sort();
        expect({ onlyInMap: mapped.filter((k) => paths.indexOf(k) < 0),
            onlyInPaths: paths.filter((k) => mapped.indexOf(k) < 0) })
            .toEqual({ onlyInMap: [], onlyInPaths: [] });
    });

    test('the map speaks only its own vocabulary', () => {
        const allowed = ['site-row', 'site-config', 'sample', 'plan-form', 'unresolved'];
        const strangers = Object.keys(inputs.sources)
            .filter((k) => allowed.indexOf(inputs.sources[k]) < 0)
            .map((k) => k + ': ' + inputs.sources[k]);
        expect({ strangers: strangers }).toEqual({ strangers: [] });
    });

    test('every site-config path exists in the live shape, or says why it does not', () => {
        // The assertion that would have caught `locationName` the day it was
        // written: a path no site has is not a path.
        // GH-474: the path is resolved in the shape of the store the entry
        // DECLARES, step by step, and in no other.
        const missing = Object.keys(FIELD_PATHS)
            .filter((f) => FIELD_PATHS[f][2] !== 'notInStore' && FIELD_PATHS[f][2] !== 'derived')
            .filter((f) => FIELD_PATHS[f][0] !== 'sample')
            .filter((f) => !pathExistsIn(SHAPE_OF[FIELD_PATHS[f][0]], FIELD_PATHS[f][1]))
            .map((f) => f + ' -> ' + FIELD_PATHS[f][0] + ':' + FIELD_PATHS[f][1]);
        expect({ missing: missing }).toEqual({ missing: [] });
    });

    test('the paths marked as absent from every store are exactly the ones measured absent', () => {
        // Recorded rather than removed: dropping a read changes what a site
        // that grows the key would get, and that is not this ticket's to
        // decide. Measured in the database across all twelve gaip configs.
        // GH-473: `timezone` is off this list — the site row owns it and has
        // it. The two that remain are absent from EVERY recorded store, not
        // from the one the field happened to be pointed at, which is what
        // made the mark say the wrong thing about `locationName`.
        const absent = Object.keys(FIELD_PATHS).filter((f) => FIELD_PATHS[f][2] === 'notInStore').sort();
        expect(absent).toEqual(['areaHa', 'elevation', 'warmBase']);
        // GH-474: the mark is allowed only when the path does not resolve in
        // the OWNER's shape, and the check says which stores it looked in —
        // all of them, by full path, not by hunting the leaf's name.
        absent.forEach((f) => {
            const checked = Object.keys(SHAPE_OF)
                .filter((store) => pathExistsIn(SHAPE_OF[store], FIELD_PATHS[f][1]));
            expect({ field: f, resolvesIn: checked }).toEqual({ field: f, resolvesIn: [] });
            expect(inputs.sources[f]).toBe('unresolved');
        });
    });

    test('"resolved from the config" means the value IS what stands at that path', () => {
        // Not the map against its own vocabulary: the map against the store.
        const wrong = Object.keys(FIELD_PATHS)
            .filter((f) => inputs.sources[f] === 'site-config')
            .filter((f) => FIELD_PATHS[f][2] !== 'derived')
            .filter((f) => {
                const parts = FIELD_PATHS[f][1].split('.');
                let cur = cfg;
                for (let i = 0; i < parts.length; i++) {
                    if (!cur || typeof cur !== 'object') return true;
                    cur = cur[parts[i]];
                }
                const resolved = resolvedValue(f);
                return JSON.stringify(cur) !== JSON.stringify(resolved);
            })
            .map((f) => f + ' <- ' + FIELD_PATHS[f][1]);
        expect({ wrong: wrong }).toEqual({ wrong: [] });
    });

    test('"unresolved" means there is genuinely nothing at that path', () => {
        const wrong = Object.keys(FIELD_PATHS)
            .filter((f) => inputs.sources[f] === 'unresolved')
            .filter((f) => FIELD_PATHS[f][0] === 'site-config')
            .filter((f) => {
                const parts = FIELD_PATHS[f][1].split('.');
                let cur = cfg;
                for (let i = 0; i < parts.length && cur !== undefined; i++) {
                    cur = (cur && typeof cur === 'object') ? cur[parts[i]] : undefined;
                }
                return cur !== undefined && cur !== null && cur !== '';
            })
            .map((f) => f + ' has a value at ' + FIELD_PATHS[f][1] + ' but the map says unresolved');
        expect({ wrong: wrong }).toEqual({ wrong: [] });
    });

    test('the place is read from location.name, which is where every site keeps it', () => {
        // GH-473: from the column, which owns it. Every write path reaches
        // the column; only one reaches the copy in the config.
        expect(FIELD_PATHS.locationName).toEqual(['site-row', 'location_name']);
        expect(inputs.sources.locationName).toBe('site-row');
    });

    test('a value called site-config carries nothing from the page', () => {
        const page = loadPage({ errors: [], warnings: [], alerts: [] });
        poisonPage(page.sandbox);
        const poisoned = page.sandbox.GAIP_NutritionProgramInputs.resolveExportInputs({ siteId: SITE_ID });
        const tainted = Object.keys(poisoned.sources)
            .filter((f) => poisoned.sources[f] === 'site-config')
            .map((f) => [f, resolvedFrom(poisoned, f)])
            .filter(([, v]) => String(v).indexOf(POISON_SENTINEL) >= 0)
            .map(([f, v]) => f + ' = ' + v);
        expect({ tainted: tainted }).toEqual({ tainted: [] });
    });

    /** The value the resolver put in the object for a field of the path table. */
    function resolvedValue(field) { return resolvedFrom(inputs, field); }
    function resolvedFrom(obj, field) {
        const map = {
            siteName: obj.site.name, locationName: obj.site.location.name,
            lat: obj.site.location.lat, lon: obj.site.location.lon,
            timezone: obj.site.timezone, areaHa: obj.site.areaHa,
            species: obj.turf.species, turfType: obj.turf.type,
            subCategory: obj.turf.subCategory, variety: obj.turf.variety,
            construction: obj.turf.construction, hoc: obj.turf.hoc,
            percentC3: obj.turf.percentC3, warmBase: obj.turf.warmBase,
            coolOverseed: obj.turf.coolOverseed, overseedSpecies: obj.turf.overseedSpecies,
            overseedVariety: obj.turf.overseedVariety,
            overseedVarietyDisplay: obj.turf.overseedVarietyDisplay,
            summerIntent: obj.turf.summerIntent,
            soilSample: obj.samples.soil, tissueSample: obj.samples.tissue,
            waterSample: obj.samples.water
        };
        return map[field];
    }
});

describe('GH-471 — a frozen object is proved frozen by writing to it', () => {
    test('a write throws a TypeError, which is the only thing that matters', () => {
        // Not a text check for 'use strict': the directive applies to a
        // function scope and no regexp can say whether this object's writers
        // are inside one. The proof is the throw.
        const page = loadPage({ errors: [], warnings: [], alerts: [] });
        const NPI = page.sandbox.GAIP_NutritionProgramInputs;
        const inputs = NPI.resolveExportInputs({ siteId: SITE_ID });
        const built = page.sandbox.GilbaNutritionCalendar.inputsForSite(inputs);
        expect(() => { 'use strict'; built.species = 'Kikuyu'; }).toThrow(TypeError);
        expect(() => { 'use strict'; inputs.turf.species = 'Kikuyu'; }).toThrow(TypeError);
        expect(built.species).not.toBe('Kikuyu');
        expect(inputs.turf.species).not.toBe('Kikuyu');
    });
});

/**
 * GH-473 (PLAN-GH439 section 10.6, twelfth refinement) — the owner of a fact,
 * the record a value was read from, and the shapes of the answers themselves.
 */
describe('GH-473 — the facts about a site come from the row that owns them', () => {
    let NPI, inputs, FIELD_PATHS, sandbox;

    beforeAll(() => {
        const page = loadPage({ errors: [], warnings: [], alerts: [] });
        expect(page.failures).toEqual([]);
        sandbox = page.sandbox;
        NPI = page.sandbox.GAIP_NutritionProgramInputs;
        FIELD_PATHS = NPI.FIELD_PATHS;
        inputs = NPI.resolveExportInputs({ siteId: SITE_ID });
    });

    test('the resolver reads nothing about the place out of the config', () => {
        // The copy in `config.location` is reached by one write path of three;
        // the column is reached by all three, and a site created through
        // store() has the column filled and the config empty by construction.
        // Reading the copy is being a write path behind on every new site.
        // GH-474: except the fields the config OWNS. `location.elevation` has
        // no column, so the config is its owner and reading it there is
        // reading the owner — which is the rule, not an exception to it.
        const ownedByConfig = Object.keys(OWNERS).filter((f) => OWNERS[f] === null);
        const fromConfigLocation = Object.keys(FIELD_PATHS)
            .filter((f) => FIELD_PATHS[f][0] === 'site-config')
            .filter((f) => FIELD_PATHS[f][1].indexOf('location') === 0)
            .filter((f) => ownedByConfig.indexOf(FIELD_PATHS[f][1]) < 0)
            .map((f) => f + ' -> ' + FIELD_PATHS[f][1]);
        expect({ fromConfigLocation: fromConfigLocation }).toEqual({ fromConfigLocation: [] });
    });

    test('no file that builds a document reads the place out of the config either', () => {
        const strangers = ['nutrition-program-inputs.js', 'word-export.js', 'word-export-combined.js']
            .map((f) => ({ file: f, src: code(fs.readFileSync(path.join(ASSETS, f), 'utf8')) }))
            .filter((e) => /\blocation\.(name|lat|lon)\b/.test(e.src)
                && !/inputs\.site\.location|_inLoc|_inSite\.location/.test(e.src))
            .map((e) => e.file);
        expect({ strangers: strangers }).toEqual({ strangers: [] });
    });

    test('the five facts of the site row are read from the site row', () => {
        expect(FIELD_PATHS.siteName).toEqual(['site-row', 'name']);
        expect(FIELD_PATHS.locationName).toEqual(['site-row', 'location_name']);
        expect(FIELD_PATHS.lat).toEqual(['site-row', 'latitude']);
        expect(FIELD_PATHS.lon).toEqual(['site-row', 'longitude']);
        expect(FIELD_PATHS.timezone).toEqual(['site-row', 'timezone']);
    });

    test('the time zone resolves now that it is read from its owner', () => {
        // It used to be marked as absent from every store, because the store
        // it was pointed at does not carry it: zero of twelve configs have a
        // timezone, twelve of twelve rows do.
        expect(inputs.site.timezone).toBe('Pacific/Auckland');
        expect(inputs.sources.timezone).toBe('site-row');
    });

    test('with two sites in the store, the reader takes the one it was asked about', () => {
        // Measured, and it changed this test: with ONE site in the store a
        // reader that takes "the first row" is indistinguishable from one that
        // takes the right row — the mutation was green. A second site is what
        // makes the choice observable at all.
        const page = loadPage({ errors: [], warnings: [], alerts: [] });
        const SC = page.sandbox.GAIP_SiteConfig;
        const base = SC.getSite(SITE_ID);
        const other = Object.assign({}, base, {
            id: 'other-site', name: 'Elsewhere', location_name: 'Christchurch',
            latitude: -43.5321, longitude: 172.6362, timezone: 'Pacific/Auckland'
        });
        const rows = { 'other-site': other };
        rows[SITE_ID] = base;
        // The other site first, so "the first row" is the wrong row for
        // anything that walks the store instead of asking it by id.
        SC.getSite = (id) => rows[id] || null;
        SC.getAllSites = () => rows;

        const resolved = page.sandbox.GAIP_NutritionProgramInputs.resolveExportInputs({ siteId: SITE_ID });
        expect(resolved.site.name).toBe(SITE_NAME);
        expect(resolved.site.location.name).not.toBe('Christchurch');
        const wrong = Object.keys(resolved.provenance)
            .filter((f) => resolved.provenance[f].source === 'site-row')
            .filter((f) => resolved.provenance[f].recordKey !== SITE_ID)
            .map((f) => f + ': ' + resolved.provenance[f].recordKey);
        expect({ wrong: wrong }).toEqual({ wrong: [] });
    });

    test('the sample is chosen by the id asked for, against a basket with more than one', () => {
        // The reviewer's finding, and it was right: the previous check compared
        // the recordKey with the id of the sample THE RESOLVER ITSELF chose,
        // out of a basket holding exactly one — two halves of the same answer,
        // so it could not fail. Both halves are replaced here: a second sample
        // in each basket, and the expected id stated by the test rather than
        // read back out of the result.
        //
        // The tissue and water baskets were empty as well, so those two
        // branches were never executed at all.
        const page = loadPage({ errors: [], warnings: [], alerts: [] });
        const SM = page.sandbox.GAIP_SampleManager;
        const soil = SM.getActiveSample('soil');
        const other = (kind, id) => Object.assign({}, soil, { id: id, label: kind + ' elsewhere' });
        const WANTED = { soil: soil.id, tissue: 'tissue-wanted', water: 'water-wanted' };
        const store = {
            soil: [other('soil', 'soil-decoy'), soil],
            tissue: [other('tissue', 'tissue-decoy'), other('tissue', WANTED.tissue)],
            water: [other('water', 'water-decoy'), other('water', WANTED.water)]
        };
        SM.getAllSamples = () => ({
            allSites: { [SITE_ID]: store },
            allActive: { [SITE_ID]: {} },
            allMeta: {}, sites: [SITE_ID], currentSite: SITE_ID
        });

        const resolved = page.sandbox.GAIP_NutritionProgramInputs.resolveExportInputs({
            siteId: SITE_ID,
            soilSampleId: WANTED.soil,
            tissueSampleId: WANTED.tissue,
            waterSampleId: WANTED.water
        });

        // Each basket's decoy stands FIRST, so "the first element" is the
        // wrong element in all three.
        const chosen = {
            soil: resolved.samples.soil && resolved.samples.soil.id,
            tissue: resolved.samples.tissue && resolved.samples.tissue.id,
            water: resolved.samples.water && resolved.samples.water.id
        };
        expect(chosen).toEqual(WANTED);

        const wrongKeys = ['soil', 'tissue', 'water']
            .map((kind) => ({ kind: kind, p: resolved.provenance[kind + 'Sample'] }))
            .filter((r) => !r.p || r.p.recordKey !== WANTED[r.kind])
            .map((r) => r.kind + ': ' + JSON.stringify(r.p && r.p.recordKey) + ', wanted ' + WANTED[r.kind]);
        expect({ wrongKeys: wrongKeys }).toEqual({ wrongKeys: [] });
    });

    test('every field says which record it was read from, and it is the one asked for', () => {
        // The mutation this closes: hand the reader another site's row and
        // every check still passed, because a store was proved and a record
        // was not.
        const wrong = Object.keys(inputs.provenance)
            .filter((f) => {
                const p = inputs.provenance[f];
                if (p.source === 'unresolved') return false;
                if (p.source === 'sample') {
                    const kind = FIELD_PATHS[f][1];
                    const sample = inputs.samples[kind];
                    return !sample || p.recordKey !== sample.id;
                }
                return p.recordKey !== SITE_ID;
            })
            .map((f) => f + ': read from ' + JSON.stringify(inputs.provenance[f].recordKey)
                + ', asked about ' + SITE_ID);
        expect({ wrong: wrong }).toEqual({ wrong: [] });
    });

    test('a reader cannot be handed a record at all — it takes the identifier', () => {
        expect(RESOLVER_CODE).toMatch(/const fromSite = \(field\) => readerFor\(field, 'site-row', siteId, siteRow\)/);
        expect(RESOLVER_CODE).toMatch(/const fromConfig = \(field\) => readerFor\(field, 'site-config', siteId, cfg\)/);
    });

    test('the recorded answer shapes and the stubs\' answers are the same set, both ways', () => {
        const answers = STORE_SHAPES.answers || {};
        const live = {
            'getSiteList()': sandbox.GAIP_SampleManager.getSiteList(),
            'getAllSamples()': sandbox.GAIP_SampleManager.getAllSamples(),
            'getConfig(id)': sandbox.GAIP_SiteConfig.getConfig(SITE_ID),
            'getSite(id)': sandbox.GAIP_SiteConfig.getSite(SITE_ID),
            'getActiveSample(soil)': sandbox.GAIP_SampleManager.getActiveSample('soil')
        };
        const differences = [];
        Object.keys(live).forEach((name) => {
            const recorded = answers[name];
            expect(recorded).toBeTruthy();
            const value = live[name];
            if (recorded._answer === 'array') {
                expect(Array.isArray(value)).toBe(true);
                const rowKeys = Object.keys(recorded._rowKeys || {}).sort();
                const stubKeys = Object.keys(value[0] || {}).sort();
                if (JSON.stringify(rowKeys) !== JSON.stringify(stubKeys)) {
                    differences.push(name + ' row: recorded ' + rowKeys.join(',') + ' / stub ' + stubKeys.join(','));
                }
                return;
            }
            const recordedKeys = Object.keys(recorded).filter((k) => k.indexOf('_') !== 0).sort();
            const stubKeys = Object.keys(value || {}).sort();
            if (JSON.stringify(recordedKeys) !== JSON.stringify(stubKeys)) {
                differences.push(name + ': recorded ' + recordedKeys.join(',') + ' / stub ' + stubKeys.join(','));
            }
        });
        expect({ differences: differences }).toEqual({ differences: [] });
    });
});

/**
 * GH-474 (thirteenth refinement as amended) — one ownership table, read by
 * both sides.
 *
 * The first version of this refinement gave the whole `location` section to
 * the columns and refused it at the config route. It did not fit
 * `location.elevation`, which has no column, and it would have broken both
 * senders of that section. Ownership is declared per FIELD now, and a field
 * with no column is owned by the config — the other half of the rule, not an
 * exception to it.
 */
describe('GH-474 — the server\'s ownership table and the resolver\'s read paths are one enumeration', () => {
    let FIELD_PATHS;

    beforeAll(() => {
        const page = loadPage({ errors: [], warnings: [], alerts: [] });
        expect(page.failures).toEqual([]);
        FIELD_PATHS = page.sandbox.GAIP_NutritionProgramInputs.FIELD_PATHS;
    });

    /** The resolver's field name for a dotted config path, by its read path. */
    function resolverFieldFor(dotted) {
        const bySiteRowColumn = {
            location_name: 'locationName', latitude: 'lat', longitude: 'lon', timezone: 'timezone'
        };
        const column = OWNERS[dotted];
        if (column) {
            const field = bySiteRowColumn[column];
            return field && FIELD_PATHS[field] ? field : null;
        }
        return Object.keys(FIELD_PATHS).filter((f) =>
            FIELD_PATHS[f][0] === 'site-config' && FIELD_PATHS[f][1] === dotted)[0] || null;
    }

    test('every field the server owns is a field the resolver reads', () => {
        const unread = Object.keys(OWNERS).filter((f) => !resolverFieldFor(f));
        expect({ unread: unread }).toEqual({ unread: [] });
    });

    test('a column-owned field is read from the site row, a config-owned one from the config', () => {
        const wrong = Object.keys(OWNERS)
            .map((f) => ({ field: f, column: OWNERS[f], read: FIELD_PATHS[resolverFieldFor(f)] }))
            .filter((r) => (r.column ? r.read[0] !== 'site-row' : r.read[0] !== 'site-config'))
            .map((r) => r.field + ': owner ' + (r.column || 'config') + ', read from ' + r.read[0]);
        expect({ wrong: wrong }).toEqual({ wrong: [] });
    });

    test('a column-owned field is read from the column that owns it, by name', () => {
        const wrong = Object.keys(OWNERS)
            .filter((f) => OWNERS[f])
            .filter((f) => FIELD_PATHS[resolverFieldFor(f)][1] !== OWNERS[f])
            .map((f) => f + ': column ' + OWNERS[f] + ', path ' + FIELD_PATHS[resolverFieldFor(f)][1]);
        expect({ wrong: wrong }).toEqual({ wrong: [] });
    });

    test('the field with no column is owned by the config, and the table says so', () => {
        // The case the section-wide rule could not express, and the reason it
        // was rewritten: refusing the section would have stopped both senders
        // from saving it at all.
        expect(OWNERS['location.elevation']).toBeNull();
        expect(FIELD_PATHS.elevation[0]).toBe('site-config');
        expect(FIELD_PATHS.elevation[1]).toBe('location.elevation');
    });

    test('every derived copy has a column behind it, and elevation has none', () => {
        const derived = FIELD_OWNERS.derivedCopies;
        derived.forEach((f) => expect(OWNERS[f]).toBeTruthy());
        expect(derived).not.toContain('location.elevation');
    });

    test('the fixture is generated, and says so', () => {
        expect(FIELD_OWNERS._generated).toMatch(/^\d{4}-\d{2}-\d{2}$/);
        expect(String(FIELD_OWNERS._why)).toMatch(/FieldOwners/);
    });
});

/**
 * GH-474 (thirteenth refinement, point 1) — nobody reads the copy.
 *
 * Three regional integrations took the coordinates from
 * `getConfig(id).location` and decided from them which country's recommender
 * and product catalogue a client is given. `PATCH /api/sites/{id}` writes the
 * columns and used to leave the copy alone, so a site that moved between
 * countries kept its old catalogue until somebody happened to save a config.
 * The copy is derived by the server now — but a reader of a copy is a reader
 * one write path behind whatever else changes, so the readers move to the
 * owner and this asserts there are none left.
 */
describe('GH-474 — no asset reads the site\'s place out of the config copy', () => {
    /** Files and the reason each is allowed to, with none allowed today. */
    const EXEMPT_READERS = {
        // GH-477: the import-bundle flow reads the location out of the BUNDLE
        // being imported and puts it into the site patch — a write travelling
        // TO the owner, not a read of the copy as a source of truth. The
        // bundle is a config-shaped object by construction, which is why the
        // provenance walk counts it.
        'settings-init.js': 'the import bundle\'s own location, on its way into the site row'
    };

    /**
     * GH-477 (fifteenth refinement, point 1) — a reader of the copy is found
     * by WHERE ITS VALUE CAME FROM, not by a call sitting next to it.
     *
     * What this replaces looked for a local assigned from `getConfig(` and did
     * not cross a function boundary, so it held the count at zero while a
     * reader was printing to a client: gaip-morning-briefing.js takes
     * `getAllConfigs()` at :163, the config reaches `buildSiteCard(site,
     * config, …)` as a PARAMETER, :470 reads `config.location` and :558 prints
     * the place in the site card. `getConfig(` appears in that file zero
     * times. Two independent blindnesses — the shape of the call and the
     * function boundary — which is exactly the trick section 10.9 names,
     * repeated inside a new guard.
     *
     * So: the roots are every method that hands out a config object or a
     * collection of them, and a read of `location.*` from any of them is a
     * finding wherever it stands — including through a parameter, by
     * unfolding the call the way the dataflow reader unfolds a pure
     * derivation, only in the other direction: from the argument to the
     * parameter.
     */
    const COPY_ROOTS = ['getConfig', 'getAllConfigs', 'GAIP_SITE_CONFIG', 'gaipConfig'];

    /**
     * Files and lines where a value that CAME OUT OF a copy root is read as
     * `location`.
     *
     * The value is followed by taint rather than by shape: a name holding a
     * copy taints the names it is assigned to, the object literals it is put
     * into, the parameters of the functions it is passed to, and the callback
     * parameters of a `map`/`forEach` over it. The pass repeats until nothing
     * new is tainted, which is how it reaches the site card: `getAllConfigs()`
     * → `configs` → `configs[site.id]` → `{ config: … }` → `cards` → the
     * `forEach` callback's `c` → `buildSiteCard(c.site, c.config, …)` → the
     * `config` parameter → `config.location`.
     *
     * Its limit, recorded rather than implied: taint is per NAME and not per
     * property, so a tainted object taints every read off it. That errs
     * towards reporting too much, which is the safe direction — an
     * over-report is named as an exemption with a reason, an under-report is
     * what this refinement is fixing. Line numbers come from the original
     * source, comments included, so they point where a person would look.
     */
    function copyReaders() {
        const offenders = [];
        fs.readdirSync(ASSETS)
            .filter((f) => /\.js$/.test(f) && !/\.min\.js$/.test(f))
            .forEach((f) => {
                const src = fs.readFileSync(path.join(ASSETS, f), 'utf8');
                if (!COPY_ROOTS.some((r) => src.indexOf(r) >= 0)) return;
                let ast;
                try { ast = parser.parse(src, { sourceType: 'script', errorRecovery: true }); }
                catch (e) { return; }

                const tainted = new Set();
                const rootsIn = (node, depth) => {
                    if (!node || (depth || 0) > 8) return false;
                    switch (node.type) {
                        case 'CallExpression': {
                            const callee = node.callee;
                            const name = callee.type === 'Identifier' ? callee.name
                                : (callee.type === 'MemberExpression' && callee.property.type === 'Identifier'
                                    ? callee.property.name : null);
                            if (name && COPY_ROOTS.indexOf(name) >= 0) return true;
                            return rootsIn(callee, (depth || 0) + 1);
                        }
                        case 'MemberExpression':
                            if (node.property.type === 'Identifier'
                                && COPY_ROOTS.indexOf(node.property.name) >= 0) return true;
                            return rootsIn(node.object, (depth || 0) + 1);
                        case 'Identifier':
                            return COPY_ROOTS.indexOf(node.name) >= 0 || tainted.has(node.name);
                        case 'LogicalExpression':
                            return rootsIn(node.left, (depth || 0) + 1) || rootsIn(node.right, (depth || 0) + 1);
                        case 'ConditionalExpression':
                            return rootsIn(node.consequent, (depth || 0) + 1)
                                || rootsIn(node.alternate, (depth || 0) + 1);
                        case 'ObjectExpression':
                            return node.properties.some((pr) => pr.value && rootsIn(pr.value, (depth || 0) + 1));
                        case 'ArrayExpression':
                            return node.elements.some((el) => rootsIn(el, (depth || 0) + 1));
                        default:
                            return false;
                    }
                };

                // The parameter lists of every function in the file, by name,
                // built ONCE. Looking them up by walking the file inside the
                // fixed-point loop turned a second into minutes.
                const PARAMS = {};
                traverse(ast, {
                    FunctionDeclaration(fp) { if (fp.node.id) PARAMS[fp.node.id.name] = fp.node.params; },
                    VariableDeclarator(vp) {
                        if (vp.node.id.type === 'Identifier' && vp.node.init
                            && /Function/.test(vp.node.init.type)) PARAMS[vp.node.id.name] = vp.node.init.params;
                    },
                    ObjectProperty(op) {
                        const k = op.node.key;
                        const kn = k.type === 'Identifier' ? k.name : (k.type === 'StringLiteral' ? k.value : null);
                        if (kn && /Function/.test(op.node.value.type)) PARAMS[kn] = op.node.value.params;
                    }
                });
                const paramsOf = (name) => PARAMS[name] || null;

                let grew = true;
                let rounds = 0;
                while (grew && rounds < 6) {
                    grew = false;
                    rounds++;
                    const before = tainted.size;
                    traverse(ast, {
                        VariableDeclarator(vp) {
                            if (vp.node.id.type !== 'Identifier' || !vp.node.init) return;
                            if (rootsIn(vp.node.init, 0)) tainted.add(vp.node.id.name);
                        },
                        AssignmentExpression(ap) {
                            if (ap.node.left.type === 'Identifier' && rootsIn(ap.node.right, 0)) {
                                tainted.add(ap.node.left.name);
                            }
                        },
                        ReturnStatement(rp) {
                            // A function that HANDS BACK a copy is itself a
                            // copy root: `function siteConfigs() { … return
                            // getAllConfigs(); }` is how the site card gets one,
                            // and without this the chain stops at the return.
                            if (!rp.node.argument || !rootsIn(rp.node.argument, 0)) return;
                            let fp = rp.getFunctionParent();
                            const name = fp && ((fp.node.id && fp.node.id.name)
                                || (fp.parent && fp.parent.type === 'VariableDeclarator'
                                    && fp.parent.id.type === 'Identifier' && fp.parent.id.name)
                                || (fp.parent && fp.parent.type === 'ObjectProperty'
                                    && fp.parent.key.type === 'Identifier' && fp.parent.key.name));
                            if (name) tainted.add(name);
                        },
                        CallExpression(cp) {
                            const callee = cp.node.callee;
                            // f(taintedArg) -> f's n-th parameter is tainted
                            const name = callee.type === 'Identifier' ? callee.name
                                : (callee.type === 'MemberExpression' && callee.property.type === 'Identifier'
                                    ? callee.property.name : null);
                            if (name && ['map', 'forEach', 'filter', 'find'].indexOf(name) >= 0
                                && callee.type === 'MemberExpression' && rootsIn(callee.object, 0)) {
                                const fn = cp.node.arguments[0];
                                if (fn && /Function/.test(fn.type) && fn.params[0]
                                    && fn.params[0].type === 'Identifier') {
                                    tainted.add(fn.params[0].name);
                                }
                                return;
                            }
                            if (!name) return;
                            const params = paramsOf(name);
                            if (!params) return;
                            cp.node.arguments.forEach((arg, i) => {
                                if (!rootsIn(arg, 0)) return;
                                if (params[i] && params[i].type === 'Identifier') tainted.add(params[i].name);
                            });
                        }
                    });
                    if (tainted.size !== before) grew = true;
                }

                // Only the fields a COLUMN owns. `location.elevation` and
                // `location.hemisphere` have no column, so the config is their
                // owner and reading them there is reading the owner — the same
                // distinction the ownership table draws, applied here.
                const OWNED_IN_LOCATION = ['name', 'lat', 'lon'];

                // Names holding the `location` OBJECT of a copy. The site card
                // reads `location.name` off such a name, not `config.location
                // .name` — one more shape, and the reason the first version of
                // this found nothing there.
                // Held by BINDING, not by name: `loc` is a common name, and a
                // set of names taints a geocoder's callback parameter in one
                // function because another function has a `var loc =
                // cfg.location`. That is the flat-name-map defect this section
                // has already found twice, and it does not get to happen inside
                // a guard written to close it.
                const locationBindings = new Set();
                const locationNames = new Set();
                for (let round = 0; round < 3; round++) {
                    traverse(ast, {
                        VariableDeclarator(vp) {
                            if (vp.node.id.type !== 'Identifier' || !vp.node.init) return;
                            const isLocationOf = (n, d) => {
                                if (!n || (d || 0) > 6) return false;
                                if (n.type === 'MemberExpression') {
                                    return n.property.type === 'Identifier' && n.property.name === 'location'
                                        && rootsIn(n.object, 0);
                                }
                                if (n.type === 'LogicalExpression') {
                                    return isLocationOf(n.left, (d || 0) + 1) || isLocationOf(n.right, (d || 0) + 1);
                                }
                                if (n.type === 'ConditionalExpression') {
                                    return isLocationOf(n.consequent, (d || 0) + 1)
                                        || isLocationOf(n.alternate, (d || 0) + 1);
                                }
                                if (n.type === 'Identifier') return locationNames.has(n.name);
                                return false;
                            };
                            if (isLocationOf(vp.node.init, 0)) {
                                locationNames.add(vp.node.id.name);
                                locationBindings.add(vp.node.id.start);
                            }
                        }
                    });
                }

                traverse(ast, {
                    MemberExpression(mp) {
                        const prop = mp.node.property;
                        if (prop.type !== 'Identifier' || OWNED_IN_LOCATION.indexOf(prop.name) < 0) return;
                        const holder = mp.node.object;
                        const viaLocationProperty = holder.type === 'MemberExpression'
                            && holder.property.type === 'Identifier'
                            && holder.property.name === 'location'
                            && rootsIn(holder.object, 0);
                        let viaLocationName = false;
                        if (holder.type === 'Identifier') {
                            const binding = mp.scope.getBinding(holder.name);
                            const declared = binding && binding.identifier && binding.identifier.start;
                            viaLocationName = declared != null && locationBindings.has(declared);
                        }
                        if (!viaLocationProperty && !viaLocationName) return;
                        offenders.push(f + ':' + (mp.node.loc ? mp.node.loc.start.line : '?'));
                    }
                });
            });
        return Array.from(new Set(offenders)).sort();
    }

    test('no file reads the place out of a config copy, wherever the copy came from', () => {
        const unexplained = copyReaders().filter((o) => !Object.prototype.hasOwnProperty.call(
            EXEMPT_READERS, o.split(':')[0]));
        expect({ unexplained: unexplained }).toEqual({ unexplained: [] });
    });

    test('the reader that the old guard could not see is the one this finds', () => {
        // Stated as a fact about the guard, not about the file: if the site
        // card ever reads the copy again — through a parameter, a collection,
        // any of it — this is what says so.
        const src = code(fs.readFileSync(path.join(ASSETS, 'gaip-morning-briefing.js'), 'utf8'));
        expect(src).toMatch(/getAllConfigs\(\)/);
        expect(src).not.toMatch(/getConfig\(/);
        // And it is not among the findings, because it reads the owner now.
        expect(copyReaders().filter((o) => o.indexOf('gaip-morning-briefing.js') === 0)).toEqual([]);
    });

    test('the list of files allowed to read the copy is exactly what is written down', () => {
        // The ratchet: an entry added here has to carry its reason, and the
        // surface can only shrink. It was empty while the guard was blind;
        // with the guard seeing by provenance it holds one entry, and that
        // entry is a WRITE travelling to the owner rather than a read of the
        // copy as truth.
        expect(Object.keys(EXEMPT_READERS)).toEqual(['settings-init.js']);
        Object.keys(EXEMPT_READERS).forEach((f) => {
            expect(String(EXEMPT_READERS[f]).length).toBeGreaterThan(20);
        });
    });

    test('the three regional integrations decide the catalogue from the owner', () => {
        ['nz', 'au', 'uk'].forEach((region) => {
            const src = code(fs.readFileSync(
                path.join(ASSETS, 'nutrition-' + region + '-fertiliser-integration.js'), 'utf8'));
            expect(src).toMatch(/SC\.getSite\(siteId\)/);
            expect(src).toMatch(/row\.latitude/);
            expect(src).toMatch(/row\.longitude/);
        });
    });
});

/**
 * GH-474 (thirteenth refinement, point 3) — the methods the product calls, the
 * methods the fixture records, and the methods the sandbox stubs are one set.
 *
 * Four were stubbed and recorded nowhere: `getSamples(kind)` — whose shape
 * decides what a reader of samples sees at all — `getActiveSiteLabel()`,
 * `getSampleTurfProfile()` and `isMultiSiteTurfEnabled()`. A stub of a method
 * whose answer nobody has looked at is a stub written from memory, which is
 * the class this whole fixture exists to close.
 */
describe('GH-474 — called, recorded and stubbed are the same set of methods', () => {
    /**
     * Methods the EXPORT PAGE's own scripts call on the two store objects.
     *
     * Scoped to the page's script list rather than to every asset: the
     * sandbox stands for this page, and a method called only by the dashboard
     * or the field log is not a hole in it. The list comes from the page's own
     * blade, the same way the smoke test reads it.
     */
    function calledMethods() {
        const dir = ASSETS;
        const found = new Set();
        // The two files that DEFINE the stores are not consumers of them: a
        // store calling its own methods says nothing about what a reader needs
        // from the sandbox, and counting those made the enumeration a list of
        // the stores' own APIs.
        const DEFINERS = ['sample-manager.js', 'site-config-persistence.js'];
        hubScripts()
            .filter((f) => fs.existsSync(path.join(dir, f)) && DEFINERS.indexOf(f) < 0)
            .forEach((f) => {
                const src = code(fs.readFileSync(path.join(dir, f), 'utf8'));
                // Only variables provably holding one of the two stores. A
                // bare `SC.`/`SM.` matches sensor controllers and site
                // managers of other kinds, and an enumeration that counts
                // those is not about these objects at all.
                const holders = new Set(['GAIP_SampleManager', 'GAIP_SiteConfig']);
                const assign = /(?:var|let|const)\s+(\w+)\s*=\s*[^;\n]*\b(?:global|window)\.(GAIP_SampleManager|GAIP_SiteConfig)\b/g;
                let a;
                while ((a = assign.exec(src))) holders.add(a[1]);
                holders.forEach((h) => {
                    const re = new RegExp('\\b' + h.replace(/\$/g, '\\$') + '\\.([A-Za-z_$][\\w$]*)\\s*\\(', 'g');
                    let m;
                    while ((m = re.exec(src))) found.add(m[1]);
                });
            });
        return found;
    }

    /** The methods the sandbox actually answers. */
    function stubbedMethods() {
        const page = loadPage({ errors: [], warnings: [], alerts: [] });
        const out = new Set();
        ['GAIP_SampleManager', 'GAIP_SiteConfig'].forEach((name) => {
            const obj = page.sandbox[name] || {};
            Object.keys(obj).filter((k) => typeof obj[k] === 'function').forEach((k) => out.add(k));
        });
        return out;
    }

    /** The methods the fixture has an answer shape for. */
    function recordedMethods() {
        return new Set(Object.keys(STORE_SHAPES.answers || {})
            .map((k) => k.replace(/\(.*$/, '')));
    }

    test('every method the sandbox stubs has a recorded answer shape', () => {
        const recorded = recordedMethods();
        const missing = Array.from(stubbedMethods()).filter((m) => !recorded.has(m)).sort();
        expect({ stubbedButNotRecorded: missing }).toEqual({ stubbedButNotRecorded: [] });
    });

    test('every method an export actually reaches is stubbed and recorded', async () => {
        // Measured, not guessed. The static set — every method any script the
        // page loads calls on these two objects — is 36 methods wide and most
        // of them are writers the export never touches (`saveSample`,
        // `renameSite`, `switchToSite`). Demanding a stub for each would be
        // demanding 36 stubs nobody reads, which is noise standing in for
        // safety.
        //
        // GH-479 (sixteenth refinement, point 1): what the sandbox has to be
        // honest about is what the paths A CLIENT USES reach, so the set is
        // taken from both of them — the single export and the combined one,
        // which is what the button on /reports/export runs. It used to be
        // taken from a bare `collectData()` call, which is neither.
        //
        // The wrapper is the sandbox's own, installed before the first page
        // script (point 2), so a module that took its reference at the top
        // level is inside the measurement rather than beside it.
        const record = { errors: [], warnings: [], alerts: [] };
        const page = loadPage(record);
        expect(page.failures).toEqual([]);

        await page.sandbox.GAIP_WordExport.export();
        const afterSingle = new Set(page.reached.map((r) => r.split('.')[1]));
        expect(afterSingle.size).toBeGreaterThan(0);

        await page.sandbox.GAIP_CombinedExport.exportCurrentSite();
        const reached = new Set(page.reached.map((r) => r.split('.')[1]));
        // The combined loop reaches methods the single export never does —
        // that is the whole finding, so it is asserted rather than assumed.
        const onlyCombined = Array.from(reached).filter((m) => !afterSingle.has(m)).sort();
        expect(onlyCombined).toEqual(['loadSample', 'setActiveSite']);

        const recorded = recordedMethods();
        const stubbed = stubbedMethods();
        const gaps = Array.from(reached)
            .map((m) => ({ method: m, recorded: recorded.has(m), stubbed: stubbed.has(m) }))
            .filter((r) => !r.recorded || !r.stubbed)
            .map((r) => r.method + (r.recorded ? '' : ' (no recorded shape)') + (r.stubbed ? '' : ' (not stubbed)'));
        expect({ gaps: gaps }).toEqual({ gaps: [] });
        // The combined loop waits on `gaip:analysis-complete`, which nothing
        // dispatches in a sandbox, so it spends its 15s timeout per sample.
    }, 180000);

    test('the store wrappers are in place before the first page script runs', () => {
        // GH-479 (sixteenth refinement, point 2). A module that takes its
        // reference to a store at the top level — gaip-evidence-ui.js:68 is
        // one — holds whatever the global was when it loaded. A wrapper put on
        // afterwards is a different object and those calls go straight past
        // it. Structural, because the order is the guarantee: the recorders
        // are installed in loadPage BEFORE the loop that runs the blade's
        // scripts, and the binding is an accessor that no later assignment
        // replaces.
        const src = fs.readFileSync(path.join(__dirname, 'helpers', 'export-page-sandbox.js'), 'utf8');
        const install = src.indexOf('installStoreRecorders(sandbox);');
        const firstScript = src.indexOf("vm.runInContext(fs.readFileSync(path.join(ASSETS, name), 'utf8')");
        expect(install).toBeGreaterThan(-1);
        expect(firstScript).toBeGreaterThan(-1);
        expect(install).toBeLessThan(firstScript);
        // and the page's own assignment cannot replace the wrapper
        expect(src).toContain('Object.defineProperty(sandbox, name, {');
        const page = loadPage({ errors: [], warnings: [], alerts: [] });
        const before = page.sandbox.GAIP_SiteConfig;
        page.sandbox.GAIP_SiteConfig = { getConfig: () => null };
        expect(page.sandbox.GAIP_SiteConfig).toBe(before);
    });

    test('the methods called on a store by the page but never reached by an export are listed', () => {
        // The static set, kept as a ratchet rather than as a demand: it can
        // only shrink, and a NEW method called on a store is visible here the
        // day it appears instead of the day something breaks.
        const stubbed = stubbedMethods();
        const unstubbed = Array.from(calledMethods()).filter((m) => !stubbed.has(m)).sort();
        expect({ unstubbed: unstubbed }).toEqual({ unstubbed: CALLED_ELSEWHERE });
    });

    test('a recorded shape with nothing calling it is reported, not silently kept', () => {
        const called = calledMethods();
        // A test may add a method of its own to a stub (the two-site case
        // below does), so what is checked is the FIXTURE against the page's
        // callers, not the stubs.
        const spare = Array.from(recordedMethods()).filter((m) => !called.has(m)).sort();
        expect({ recordedButNeverCalled: spare }).toEqual({ recordedButNeverCalled: [] });
    });

    test('the four that were stubbed without a recorded shape now have one', () => {
        const answers = STORE_SHAPES.answers || {};
        expect(answers['getSamples(soil)']._answer).toBe('array');
        expect(answers['getActiveSiteLabel()']._answer).toBe('string');
        expect(answers['getSampleTurfProfile()']).toBeTruthy();
        expect(answers['isMultiSiteTurfEnabled(id)']._answer).toBe('boolean');
    });
});

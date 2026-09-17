/**
 * GH-461 (PLAN-GH439 section 10.6, as amended) — every key in data.turf is
 * either the resolver's or derived from it, and nothing else.
 *
 * The reviewer measured the gap this closes: 25 fields are assigned into
 * data.turf and 9 were compared by the guards beside this one. Among the
 * uncompared were isC4, effectiveIsC4 and useC3Targets — the three that choose
 * the growth curve, which is the input the owner's report turned on. A guard
 * that checks a hand-written list of fields can only ever be as complete as the
 * list, so this one takes EVERY key the object ends up with and demands that
 * each is accounted for:
 *
 *   - equal to the resolver's field of the same name, or
 *   - named in DERIVED with a function that takes ONLY the resolver's object
 *     and reproduces the value.
 *
 * A key in neither fails. That is what makes the list complete rather than
 * merely long: a field added to data.turf from anywhere lands here.
 *
 * Two of the derived entries are marked dead: the branch that would fill
 * `c3Fraction` never runs, because nothing in the codebase assigns it (the
 * only other match in the project is a type check in irrigation). They are not
 * hidden and not repaired — the branch's fate is question 8 of section 10.8,
 * the owner's — but their deadness is asserted as a FACT OF THE RUN below, so
 * the day anything starts filling that field, this fails and the branch gets
 * rewritten deliberately instead of waking up by accident.
 */
'use strict';

const { loadPage, SITE_ID, RESOLVER_KEYS, POISON_SENTINEL, poisonPage } = require('./helpers/export-page-sandbox');
// GH-477: the empty-inputs shape moved to tests/lib/, because the inventory
// of substitutions for emptiness runs the same shape and a second copy of it
// would be a second answer to "what is empty".
const { EMPTY } = require('./lib/empty-inputs');

/** A site with no overseeding — the shape the resolver returns. */
const INPUTS = Object.freeze({
    site: Object.freeze({
        id: 'site-a', name: 'Site A',
        location: Object.freeze({ name: 'Auckland', lat: -36.85, lon: 174.76 }),
        timezone: 'Pacific/Auckland', areaHa: null
    }),
    turf: Object.freeze({
        type: 'sports', subCategory: '', species: 'Perennial Ryegrass',
        speciesKey: 'perennialRyegrass', speciesDisplay: 'Perennial Ryegrass',
        variety: 'generic-a', construction: 'native-a', hoc: 25, percentC3: 100,
        warmBase: '', coolOverseed: '', overseedSpecies: '', overseedVariety: '',
        overseedVarietyDisplay: null, summerIntent: '', isC4: false
    }),
    program: null,
    samples: Object.freeze({ soil: null, tissue: null, water: null }),
    climateNormals: null, climateReason: 'no-coordinates',
    sources: Object.freeze({ species: 'site-config' })
});

/**
 * Keys data.turf carries that the resolver does not, each with the derivation
 * that produces it. Every function takes the resolver's object and nothing
 * else — a derivation that reached for anything more would be a second source
 * wearing the word "derived".
 *
 * `awaitingOwner` marks a value that reproduces a hardcoded default the export
 * prints today. They are reproduced, not chosen: what a document should say
 * when a site has no species is question 7 of section 10.8.
 */
const DERIVED = {
    rawTurfType: { of: (i) => i.turf.type, why: 'the key the display label below is built from' },
    type: {
        of: (i) => i.turf.type, why: 'the printed label for the same key',
        compare: (actual, expected) => expected === '' ? actual === ''
            : String(actual).toLowerCase().indexOf(String(expected).toLowerCase()) >= 0
    },
    effectiveSpecies: {
        of: (i) => i.turf.coolOverseed || i.turf.species || 'Perennial Ryegrass',
        why: 'the species the document speaks about: the oversown one where there is one',
        awaitingOwner: 'the default name when a site has no species — question 10.8(7)'
    },
    effectiveVariety: {
        of: (i) => (i.turf.coolOverseed ? i.turf.overseedVariety : i.turf.variety) || 'generic',
        why: 'the variety beside that species',
        awaitingOwner: "'generic' as a printed value — question 10.8(7)"
    },
    effectiveSpeciesNote: { of: () => null, why: 'set only for an oversown sward' },
    effectiveIsC4: {
        of: (i) => (i.turf.coolOverseed ? false : !!i.turf.isC4),
        why: 'the curve for the species above: an oversown sward is scored as C3'
    },
    hasOverseed: {
        of: (i) => !!(i.turf.coolOverseed && i.turf.warmBase && i.turf.warmBase !== i.turf.coolOverseed),
        why: 'whether the document describes an oversown sward at all'
    },
    overseedDominant: { of: () => false, deadBranch: 'needs c3Fraction, which nothing assigns' },
    useC3Targets: { of: () => false, deadBranch: 'needs c3Fraction, which nothing assigns' },
    inputSources: { of: (i) => i.sources, why: 'the provenance map the resolver built' }
};

describe('GH-461 — data.turf holds the resolver\'s values and their derivations, and nothing else', () => {
    let data;

    beforeAll(() => {
        const record = { errors: [], warnings: [], alerts: [] };
        const page = loadPage(record);
        expect(page.failures).toEqual([]);
        data = page.sandbox.GAIP_WordExport.collectData(INPUTS);
    });

    test('every key is either the resolver\'s or a named derivation — no third kind', () => {
        const unaccounted = Object.keys(data.turf).filter((k) =>
            !Object.prototype.hasOwnProperty.call(INPUTS.turf, k) &&
            !Object.prototype.hasOwnProperty.call(DERIVED, k));
        expect({ unaccounted: unaccounted }).toEqual({ unaccounted: [] });
    });

    test('the keys that come straight from the resolver are equal to it', () => {
        const differing = Object.keys(data.turf)
            .filter((k) => Object.prototype.hasOwnProperty.call(INPUTS.turf, k))
            .filter((k) => !Object.prototype.hasOwnProperty.call(DERIVED, k))
            .filter((k) => JSON.stringify(data.turf[k]) !== JSON.stringify(INPUTS.turf[k]))
            .map((k) => k + ': document ' + JSON.stringify(data.turf[k]) + ', resolver ' + JSON.stringify(INPUTS.turf[k]));
        expect({ differing: differing }).toEqual({ differing: [] });
    });

    test('every derived key is what its derivation produces from the resolver alone', () => {
        const wrong = Object.keys(DERIVED)
            .filter((k) => Object.prototype.hasOwnProperty.call(data.turf, k))
            .filter((k) => {
                const expected = DERIVED[k].of(INPUTS);
                const compare = DERIVED[k].compare
                    || ((a, e) => JSON.stringify(a) === JSON.stringify(e));
                return !compare(data.turf[k], expected);
            })
            .map((k) => k + ': document ' + JSON.stringify(data.turf[k]) +
                ', derivation ' + JSON.stringify(DERIVED[k].of(INPUTS)));
        expect({ wrong: wrong }).toEqual({ wrong: [] });
    });

    test('a derivation that is not used by anything is removed, not left standing', () => {
        const unused = Object.keys(DERIVED).filter((k) => !Object.prototype.hasOwnProperty.call(data.turf, k));
        expect({ unused: unused }).toEqual({ unused: [] });
    });

    test('the dead branch is dead: c3Fraction is never filled', () => {
        // Asserted as a fact of the run, not as the absence of a line: a value
        // arriving from the resolver, or from another module writing to the
        // same object, changes this and nothing in word-export.js would show
        // it. Two fields above depend on this branch; their entries say so.
        expect(data.turf.c3Fraction).toBeUndefined();
        Object.keys(DERIVED).filter((k) => DERIVED[k].deadBranch).forEach((k) => {
            expect(typeof DERIVED[k].deadBranch).toBe('string');
        });
    });

    test('every derivation says why it exists, and every default says it is waiting on the owner', () => {
        const thin = Object.keys(DERIVED).filter((k) => {
            const d = DERIVED[k];
            const explained = (typeof d.why === 'string' && d.why.length > 10)
                || (typeof d.deadBranch === 'string' && d.deadBranch.length > 10);
            const defaultOk = !d.awaitingOwner || /10\.8/.test(d.awaitingOwner);
            return !explained || !defaultOk;
        });
        expect({ thin: thin }).toEqual({ thin: [] });
    });
});

/**
 * GH-465/GH-467 (PLAN-GH439 section 10.6, second and fifth refinements) — what
 * a document says about a site that has no species.
 *
 * The block above runs collectData() once, with a full site, so every branch
 * that prints a default is skipped. The reviewer measured what that is worth:
 * all seven occurrences of 'Perennial Ryegrass' in word-export.js replaced with
 * 'Kikuyu', 6 of 6 key assertions green and 9 of 9 dataflow assertions green.
 *
 * Three things make this run able to see a change (GH-467, fifth refinement):
 *
 *   - "Empty" is null and undefined and nothing else. `false`, `0`, `''` and
 *     `[]` are VALUES and are compared. Treating them as absence is what made a
 *     leak into a boolean unobservable: `isC4`, `effectiveIsC4`, `useC3Targets`
 *     and `hasOverseed` are all legitimately false here, so the sweep skipped
 *     exactly the four fields that choose the growth curve.
 *   - The page is POISONED while the run happens, with every boolean true and
 *     every number shifted. On a neutral page a leak into a boolean agrees with
 *     the truth by accident; poisoned the other way, it arrives as `true` where
 *     the truth is `false`.
 *   - There are no blankets by path prefix. A prefix excuses every leaf under
 *     it, which is the same shape of exemption this section keeps removing: a
 *     planted value under an excused path passed. Each table is compared whole,
 *     as a value.
 *
 * Question 10.8(7) — what a report SHOULD say for a site with no species — is
 * the owner's and stays frozen. This pins what is printed today.
 */

/**
 * Values the document PRINTS for that site, by path, with the value itself.
 * `awaits` names the open question for each; the value is reproduced from the
 * run, not chosen here.
 */
const EMPTY_DEFAULTS = {
    'turf.effectiveSpecies': { value: 'Not specified', awaits: '10.8(7)', why: 'the species every agronomic section speaks about' },
    'turf.effectiveVariety': { value: 'generic', awaits: '10.8(7)', why: 'the variety beside it, and the key the traits table is looked up by' },
    'turf.speciesDisplay': { value: 'Not specified', awaits: '10.8(7)', why: 'the species line of the site block' },
    'soil.isC3Species': { value: true, awaits: '10.8(7)', why: 'with no species the soil narrative is written for a cool-season sward, and it chooses the tissue table below' },
    'soil.speciesName': { value: 'cool-season grass', awaits: '10.8(7)', why: 'the words the pH and CEC narrative uses for the sward' },
    'tissue.rangeSpecies': { value: 'turf', awaits: '10.8(7)', why: 'what the tissue table says its ranges are for' },
    'varietyTraits.lookupSpecies': { value: 'Not specified', awaits: '10.8(7)', why: 'the species the variety traits table is asked about' },
    'varietyTraits.lookupVariety': { value: 'generic', awaits: '10.8(7)', why: 'the variety it is asked about' }
};

/**
 * Fields whose value here is a plain consequence of nothing being resolved,
 * each with what it must be. Not "anything is allowed": a leak from the
 * poisoned page changes any of them and fails.
 */
const EMPTY_EXPECTED = {
    // GH-484: the tissue and water pair, now that both come from the sample by
    // id. With nothing resolved there is no sample, so the labels are empty,
    // the readings are absent, and the state says WHICH kind of absence it is
    // — nothing on file, rather than something on file that nobody selected.
    // (`recordKey` is null with no sample, and the walk below skips nulls, so
    // it is not a path this run produces.)
    // GH-490: and soil, the third of them. Same three states, same reason, and
    // the same empty identity — with no sample there is no label, no date and
    // no laboratory reference, where the page's own were printed before.
    'soil.onFile': 0, 'soil.state': 'none-on-file',
    'soil.sampleLabel': '', 'soil.testDate': '', 'soil.labRef': '',
    'tissue.sampleLabel': '', 'tissue.testDate': '',
    'tissue.hasData': false, 'tissue.onFile': 0, 'tissue.state': 'none-on-file',
    'water.sourceLabel': '', 'water.testDate': '', 'water.labRef': '',
    'water.onFile': 0, 'water.state': 'none-on-file',
    'water.isBlended': false, 'water.sourceCount': 1,
    'turf.type': '', 'turf.rawTurfType': '', 'turf.subCategory': '',
    'turf.species': '', 'turf.speciesKey': '', 'turf.variety': '',
    'turf.overseedVariety': '', 'turf.construction': '', 'turf.warmBase': '',
    'turf.coolOverseed': '', 'turf.summerIntent': '', 'turf.percentC3': 0,
    // The four that choose the growth curve. They are false here because
    // nothing resolved, and the poisoned page says true to every one of them.
    'turf.isC4': false, 'turf.effectiveIsC4': false,
    'turf.hasOverseed': false, 'turf.useC3Targets': false,
    'turf.overseedDominant': false,
    'turf.inputSources.species': 'unresolved',
    'varietyTraits.isOverseedFocus': false,
    'water.isBlended': false, 'water.sourceCount': 1,
    'nutritionSummary.hasData': false, 'nutrientTrend.hasData': false,
    // GH-471, the owner's decision closing question 10.8(10): with no name for
    // the place the Location line is EMPTY — not the coordinates, not
    // "Not specified". So this is a value nothing-resolved produces, not a
    // default waiting on an answer.
    'site.location': '',
    // A CONSEQUENCE of that decision, measured rather than chosen: the report
    // heading had no default of its own. It fell back to the Location line,
    // which used to say "Not specified", so a site with no name printed that.
    // With the substitute gone the heading is empty too. Recorded here, and
    // named in the report, because it is the owner's to confirm — the decision
    // was about the Location line.
    'site.name': '',
    // GH-490: `soil.testDate` stood here as '2026-08-17' — GH-470 read it as
    // "the sample's own date, by id", and in a run where nothing is resolved
    // there is no sample to have a date. It came from `getActiveSample('soil')`,
    // the PAGE's pointer, and the date printed here belonged to whatever the
    // page had loaded. It is empty now and is listed with the other empties.
};

/**
 * Tables of constants the document carries, compared WHOLE rather than excused
 * by their path. There is no by-id source for either of them: both are literal
 * objects in word-export.js, chosen by a branch on the species. That is worth
 * saying plainly rather than working around — the selection is pinned by
 * `soil.isC3Species` and `tissue.rangeSpecies` above, and the tables themselves
 * are pinned here so that a value planted anywhere inside one fails.
 */
const EMPTY_TABLES = {
    'soil.thresholds': {
        why: 'the MLSN floors word-export.js writes as literals at :8933, with P moving on soil pH; no adapter answers for them by id',
        value: {
            P: { min: 21, label: '21' }, K: { min: 37, label: '37' },
            Ca: { min: 331, label: '331' }, Mg: { min: 47, label: '47' },
            S: { min: 7, label: '7' }
        }
    },
    'tissue.ranges': {
        why: 'the C3 sufficiency table word-export.js writes as literals at :9109, chosen by the species branch that soil.isC3Species pins; no by-id source exists for it',
        value: {
            N: { lo: 3.34, hi: 5.10, unit: '%' }, P: { lo: 0.33, hi: 0.55, unit: '%' },
            K: { lo: 2.00, hi: 3.42, unit: '%' }, Ca: { lo: 0.25, hi: 0.51, unit: '%' },
            Mg: { lo: 0.16, hi: 0.32, unit: '%' }, S: { lo: 0.27, hi: 0.56, unit: '%' },
            Fe: { lo: 97, hi: 934, unit: 'ppm' }, Mn: { lo: 30, hi: 73, unit: 'ppm' },
            Zn: { lo: 14, hi: 64, unit: 'ppm' }, Cu: { lo: 6, hi: 38, unit: 'ppm' },
            B: { lo: 9, hi: 17, unit: 'ppm' }
        }
    },
    'water.thresholds': {
        why: 'the irrigation-water thresholds, the same for every site and written as literals in word-export.js',
        value: {
            EC: { safe: 0.75, marginal: 1.5, max: 3, unit: 'dS/m' },
            SAR: { safe: 3, marginal: 6, max: 12 },
            Na: { safe: 70, marginal: 150, max: 200, unit: 'ppm' },
            Cl: { safe: 100, marginal: 200, max: 350, unit: 'ppm' },
            HCO3: { safe: 90, marginal: 180, max: 300, unit: 'ppm' },
            B: { safe: 0.5, marginal: 1, max: 2, unit: 'ppm' },
            pH: { min: 6, optLo: 6.5, optHi: 7.5, max: 8.5 }
        }
    }
};

/**
 * Fields this run finds carrying the POISONED page's value — the remaining
 * layer I inventory of section 10.5, each named by its exact path and asserted
 * to carry exactly the sentinel. Not excused: pinned. The day one of them
 * starts coming from the sample by id, its entry fails and is deleted with the
 * ticket that moved it.
 */
const EMPTY_FROM_THE_PAGE = {
    // GH-490 removed the last two, and with them the list's only soil entries:
    // `soil.sampleLabel` came off `.gaip-soil-sample-label` and `soil.labRef`
    // off `.gaip-soil-lab-ref`, two form inputs the page fills for whichever
    // sample it last loaded. The label is the record's own now, read by id;
    // the client record carries no laboratory reference, so nothing is printed
    // for it. `soil.testDate` moved the same day, from the page's active
    // sample to this report's.
    // GH-480 removed three entries from this list, which is the direction it
    // is allowed to move:
    //   `soil.methodology` — the entry that decided whether a client is shown
    //   MLSN floors or Ammonium Acetate ranges. It now comes from the site
    //   config that owns it, resolved by this report's site id, and a site
    //   with no methodology prints none instead of being told MLSN.
    //   `soil.extractant` / `soil.extractantLabel` — the entry said they came
    //   from `.gaip-soil-extractant`. GH-481 corrects that record: no page
    //   renders that element, so the read never fired and the two fields came
    //   from NOWHERE for any site not on Ammonium Acetate. They were listed
    //   here as page reads that had never happened, which is why their removal
    //   read as progress. `soil.extractant` is now derived from the
    //   methodology the site config owns, resolved by id (GH-481), and
    //   `soil.extractantLabel` is still written only by the Ammonium Acetate
    //   branch, which owns that wording. Neither is a page read, then or now.
    // GH-484 removed five more, the whole tissue and water pair: their label,
    // date and lab reference came off the page's forms, beside readings that
    // came off the page's state. All of them are the sample's own now, read by
    // id — `inputs.samples.tissue/water` — so a report with no sample of that
    // kind carries empty strings instead of whatever the page last showed.
};

/** The clock, not the site. */
const EMPTY_FROM_THE_CLOCK = ['site.date'];

/**
 * Containers holding the RESULTS of the page's own run — section 10.2's view
 * II. There is no answer for them by id until layer II stamps each run, so on
 * a poisoned page every one of them carries the poison, and that is asserted
 * rather than excused: the day layer II lands, these stop being the page's and
 * this list is deleted with the ticket that moved them.
 *
 * Reached only once the poisoning became a proxy. With six hand-written
 * objects and their fixed key lists, a read of a key nobody had listed came
 * back undefined and counted as absence — which is exactly what these four
 * containers were doing.
 */
const EMPTY_VIEW_II = {
    // GH-471: these four appeared the day GAIP_STATE was genuinely poisoned —
    // the poisoning had been going through the hub's own setter, so the most
    // important root was not poisoned at all and these reads were invisible.
    // They are the remaining layer I inventory of section 10.5 (the DOM and
    // store ppm fallbacks) seen from the other side, and they move with it.
    soil: 'GAIP_STATE.soil and the soil form — the readings the page holds for whichever site it last computed; section 10.5',
    tissue: 'GAIP_STATE.tissueResults and the tissue form; section 10.5',
    water: 'GAIP_STATE.waterResults and the blend form; section 10.5',
    shade: 'shadeMetrics computed by the page\'s own run; no shade result exists by id',
    traffic: 'wearMetrics computed by the page\'s own run; no wear result exists by id',
    // GH-490: `amendment` stood here until the soil readings stopped coming off
    // the page. The amendment engine is called only where there are soil
    // readings to amend, so an empty run no longer reaches it at all — and a
    // container this run cannot reach cannot be checked by this run. It is
    // still the page's own computation wherever soil exists; the poisoned run
    // over the fixture site in gh461-export-inputs-provenance is where that is
    // seen now.
    nProgram: 'the annual N figures the page holds beside the programme it generated',
    climate: 'window.climateMetrics — the single slot the page keeps its last climate run in',
    trajectory: 'GAIP_TRAJECTORY_RESULT — the trajectory the page computed for whichever site it was showing',
    companionDisease: 'GAIP_COMPANION_DISEASE_RESULT — the companion-surface disease run held on the page',
    phytotoxicity: 'GAIP_PHYTOTOXICITY_RESULT — the phytotoxicity run held on the page'
};

/**
 * Leaves under those containers that the file writes itself, so they carry no
 * page value and cannot carry the poison. Named individually; a prefix would
 * excuse the container's real reads along with them.
 */
/**
 * GH-484: the two lines the document carries INSTEAD of a page run's verdict.
 * They are not view II containers and they are not page reads — they are the
 * registry line the section prints in place of a result nobody can attribute
 * to this sample yet.
 */
/**
 * GH-486: the outcome map the document's "Data availability" registry and its
 * "Not included:" lines are both built from. It is data, not a rendered
 * sentence — the text lives with the consumer — so the empty run carries one
 * entry per field whose outcome is not `present`.
 */
// GH-490: soil joined them — a site with no soil sample prints no Soil
// Nutrition section, and the registry is where that is said.
const EMPTY_AVAILABILITY_FIELDS = ['Soil readings', 'Tissue analysis verdict',
    'Tissue readings', 'Water analysis verdict', 'Water readings'];

const EMPTY_VIEW_II_OWN_WORDS = {
    'climate.gpLabel': 'C3',
    // The branch this file chose, not a value it read.
    'shade.dliMode': 'c3',
    'shade.deficit': 0,
    // Words this file writes about a poisoned number, so the number is the
    // page's and the sentence is the file's.
    'nProgram.verdict': 'severely_excessive',

    'companionDisease.note': 'Greens soil/tissue data not applied. Weather inputs identical to greens assessment.'
};

describe('GH-465 — a site with no species prints exactly the documented defaults', () => {
    let data;
    let leaves;
    const at = (path) => path.split('.').reduce((o, k) => (o == null ? o : o[k]), data);

    beforeAll(() => {
        const record = { errors: [], warnings: [], alerts: [] };
        const page = loadPage(record);
        expect(page.failures).toEqual([]);
        poisonPage(page.sandbox);
        data = page.sandbox.GAIP_WordExport.collectData(EMPTY);
        leaves = [];
        (function walk(obj, prefix) {
            Object.keys(obj).forEach((k) => {
                const v = obj[k];
                const path = prefix + k;
                if (v && typeof v === 'object' && !Array.isArray(v)) { walk(v, path + '.'); return; }
                if (v === null || v === undefined) return;
                leaves.push({ path: path, value: v });
            });
        })(data, '');
    });

    test('each documented default is exactly the value it is documented as', () => {
        const wrong = Object.keys(EMPTY_DEFAULTS)
            .map((p) => ({ path: p, actual: at(p), expected: EMPTY_DEFAULTS[p].value }))
            .filter((r) => r.actual !== r.expected)
            .map((r) => r.path + ': document ' + JSON.stringify(r.actual) + ', documented ' + JSON.stringify(r.expected));
        expect({ wrong: wrong }).toEqual({ wrong: [] });
    });

    test('every other field is the value nothing-resolved produces, poisoned page and all', () => {
        const wrong = Object.keys(EMPTY_EXPECTED)
            .filter((p) => JSON.stringify(at(p)) !== JSON.stringify(EMPTY_EXPECTED[p]))
            .map((p) => p + ': document ' + JSON.stringify(at(p)) + ', expected ' + JSON.stringify(EMPTY_EXPECTED[p]));
        expect({ wrong: wrong }).toEqual({ wrong: [] });
    });

    test('each table is the table it is documented as, whole', () => {
        Object.keys(EMPTY_TABLES).forEach((p) => {
            expect({ table: p, value: at(p) }).toEqual({ table: p, value: EMPTY_TABLES[p].value });
        });
    });

    test('the reads still coming off the page carry exactly the page\'s value, named one by one', () => {
        // A DOM read carries `SENTINEL-B-dom-<selector>`; a read of a page
        // store carries `SENTINEL-B-<path>`. Both are named by what they
        // actually hold, so an entry that changes source fails rather than
        // being excused by the prefix.
        const expected = (p) => {
            const src = EMPTY_FROM_THE_PAGE[p];
            return (POISON_SENTINEL + (src.indexOf('.gaip-') === 0 ? 'dom-' + src : src)).toLowerCase();
        };
        const wrong = Object.keys(EMPTY_FROM_THE_PAGE)
            .filter((p) => String(at(p) || '').toLowerCase().indexOf(expected(p)) !== 0)
            .map((p) => p + ': ' + JSON.stringify(at(p)) + ' is not the poisoned ' + EMPTY_FROM_THE_PAGE[p]);
        expect({ wrong: wrong }).toEqual({ wrong: [] });
    });

    test('no field is left unaccounted for — every leaf belongs to one of the lists above', () => {
        const covered = (p) => Object.prototype.hasOwnProperty.call(EMPTY_DEFAULTS, p)
            || Object.prototype.hasOwnProperty.call(EMPTY_EXPECTED, p)
            || Object.prototype.hasOwnProperty.call(EMPTY_FROM_THE_PAGE, p)
            || EMPTY_FROM_THE_CLOCK.indexOf(p) >= 0
            || Object.keys(EMPTY_TABLES).some((t) => p.indexOf(t + '.') === 0)
            || Object.keys(EMPTY_VIEW_II).some((c) => p.indexOf(c + '.') === 0)
            // GH-486: the outcome map, checked as a whole by its own assertion
            // below rather than leaf by leaf — its leaves are one row per field
            // whose outcome is not `present`, and the run's own content decides
            // how many there are.
            || p === 'availability' || p.indexOf('availability') === 0;
        const unaccounted = leaves.filter((l) => !covered(l.path))
            .map((l) => l.path + ' = ' + JSON.stringify(l.value));
        expect({ unaccounted: unaccounted }).toEqual({ unaccounted: [] });
    });

    test('GH-486: the empty run records an outcome for every field it could not fill', () => {
        // The registry's own universe, asserted here so that a field losing
        // its outcome is visible in the empty run too — not only in gh486's
        // assertion about the printed document.
        expect((data.availability || []).map((e) => e.field).sort())
            .toEqual(EMPTY_AVAILABILITY_FIELDS.slice().sort());
        (data.availability || []).forEach((e) => {
            // GH-488: the invariant the pair table depends on — the empty
            // reason belongs to `empty` and to nothing else, so every other
            // outcome carries a reason.
            expect([e.field, e.outcome === 'empty', e.reason === ''])
                .toEqual([e.field, e.outcome === 'empty', e.outcome === 'empty']);
        });
    });

    test('every view II container carries the page\'s run, and says so', () => {
        // Not a blanket: each leaf under these containers must actually hold
        // the poison, so a value that starts coming from somewhere else — a
        // resolver, a literal nobody wrote down — fails here.
        // A value is the page's when it carries the sentinel, or is one of the
        // markers the poisoning uses for a field whose real type is not a
        // string — or is arithmetic done ON those, which is what a shifted
        // number and a NaN out of one are.
        const poisoned = (v) => {
            try {
                if (v === true || v === 99) return true;
                if (typeof v === 'number') return !isFinite(v) || String(v).indexOf('99') >= 0;
                return String(v).indexOf(POISON_SENTINEL) >= 0
                    || String(v).indexOf('NaN') >= 0 || String(v).indexOf('99') >= 0;
            } catch (e) { return false; }
        };
        // A leaf named individually in one of the lists above is accounted
        // for there: `soil` is both a container the page fills and the home of
        // the pinned threshold table and the two species defaults.
        const namedElsewhere = (p) => Object.prototype.hasOwnProperty.call(EMPTY_DEFAULTS, p)
            || Object.prototype.hasOwnProperty.call(EMPTY_EXPECTED, p)
            || Object.prototype.hasOwnProperty.call(EMPTY_FROM_THE_PAGE, p)
            || p === 'availability'
            || Object.keys(EMPTY_TABLES).some((t) => p.indexOf(t + '.') === 0);
        const strangers = leaves
            .filter((l) => Object.keys(EMPTY_VIEW_II).some((c) => l.path.indexOf(c + '.') === 0))
            .filter((l) => !Object.prototype.hasOwnProperty.call(EMPTY_VIEW_II_OWN_WORDS, l.path))
            .filter((l) => !namedElsewhere(l.path))
            // Something that prints as nothing carries nothing: an empty
            // string, or the empty array the amendment block starts with.
            .filter((l) => String(l.value) !== '')
            .filter((l) => !poisoned(l.value))
            .map((l) => l.path + ' = ' + String(l.value));
        expect({ strangers: strangers }).toEqual({ strangers: [] });
        const wrongWords = Object.keys(EMPTY_VIEW_II_OWN_WORDS)
            .filter((p) => at(p) !== EMPTY_VIEW_II_OWN_WORDS[p]);
        expect({ wrongWords: wrongWords }).toEqual({ wrongWords: [] });
        const idle = Object.keys(EMPTY_VIEW_II)
            .filter((c) => !leaves.some((l) => l.path.indexOf(c + '.') === 0));
        expect({ idle: idle }).toEqual({ idle: [] });
    });

    test('a field that stops being produced fails too — the lists are what the run produces', () => {
        const paths = leaves.map((l) => l.path);
        const missing = Object.keys(EMPTY_DEFAULTS)
            .concat(Object.keys(EMPTY_EXPECTED))
            .concat(Object.keys(EMPTY_FROM_THE_PAGE))
            .concat(EMPTY_FROM_THE_CLOCK)
            .filter((p) => paths.indexOf(p) < 0);
        const missingTables = Object.keys(EMPTY_TABLES).filter((t) => !paths.some((p) => p.indexOf(t + '.') === 0));
        expect({ missing: missing, missingTables: missingTables }).toEqual({ missing: [], missingTables: [] });
    });

    test('every default says which question it waits on, and every table says why it is one', () => {
        const thin = Object.keys(EMPTY_DEFAULTS)
            .filter((p) => !/^10\.8\(\d+\)$/.test(String(EMPTY_DEFAULTS[p].awaits))
                || String(EMPTY_DEFAULTS[p].why).length < 15)
            .concat(Object.keys(EMPTY_TABLES).filter((t) => String(EMPTY_TABLES[t].why).length < 30));
        expect({ thin: thin }).toEqual({ thin: [] });
    });

    test('no nutrition programme is invented for a site with no species', () => {
        // The hard-fail b35fix313/b35fix314 put in and GH-459 gave the whole
        // weight to: rather than compute a programme for a substituted species,
        // engineInputs is null and the nutrition sections are omitted. Before
        // GH-465 this could not be asserted from here — _buildEngineInputs()
        // resolved its own inputs for whichever site the PAGE was on, so this
        // run produced a full 180 kg/ha/yr Perennial Ryegrass programme for a
        // site whose resolver said it has no species at all.
        expect(data.engineInputs).toBeNull();
        expect(data.nutritionSummary).toEqual({ hasData: false });
    });
});

/**
 * GH-465, second half — the seven 'Perennial Ryegrass' literals, answered by
 * value.
 *
 * The reviewer's mutation replaced all seven with 'Kikuyu' and every assertion
 * in this file stayed green, including the empty-inputs run above. That is not
 * a hole in the run: it is the run reporting a fact about the code. All seven
 * stand on the right-hand side of an `||` whose left side cannot be empty when
 * the branch is entered:
 *
 *   word-export.js:8166   coolOverseed = hasExplicitOverseed ? <lit> : ''
 *                         — the branch runs only when hasOverseed, and
 *                           hasExplicitOverseed ITSELF requires a non-empty
 *                           coolOverseed, so the ternary's true arm is the one
 *                           case that cannot be taken.
 *   :8194 :8201 :9036 :13561 :13565   inside overseedDominant / useC3Targets
 *   :13510                            inside overseedDominant || dliMode ===
 *                                     'overseed', and dliMode becomes
 *                                     'overseed' only under useC3Targets
 *
 * overseedDominant and useC3Targets both read `data.turf.c3Fraction`, which
 * nothing assigns — asserted as a fact of the run in the first block of this
 * file, not as the absence of a line. So the seven are unreachable, and no run
 * can tell 'Perennial Ryegrass' from 'Kikuyu' there.
 *
 * Rather than leave that as an argument, the two run-facts it rests on are
 * asserted here across a matrix of input shapes: `hasOverseed` never holds with
 * an empty `coolOverseed`, and `c3Fraction` stays unassigned even with an
 * oversown sward and a C3 percentage. The day either changes, one of the seven
 * becomes printable and this fails — which is the moment the literal needs
 * deciding rather than the moment it silently appears in a client's document.
 *
 * What this does NOT do is decide whether dead defaults should be removed.
 * They are the same four fields question 10.8(7) covers, and that is the
 * owner's.
 */
describe('GH-465 — the printed species is the site\'s, and the substitute names are unreachable', () => {
    const withTurf = (over) => Object.assign({}, EMPTY, {
        turf: Object.assign({}, EMPTY.turf, over),
        sources: { species: 'site-config' }
    });

    /** Every shape that can make the export think there is an overseed. */
    const SHAPES = {
        'oversown, explicit both sides': withTurf({
            species: 'Couch', isC4: true, warmBase: 'Couch',
            coolOverseed: 'Perennial Ryegrass', overseedSpecies: 'Perennial Ryegrass',
            overseedVariety: 'Barenbrug Barlennium', percentC3: 40
        }),
        'oversown, base absent': withTurf({
            species: 'Couch', isC4: true, warmBase: '',
            coolOverseed: 'Perennial Ryegrass', overseedSpecies: 'Perennial Ryegrass', percentC3: 40
        }),
        'overseed species named, no cool name': withTurf({
            species: 'Couch', isC4: true, warmBase: 'Couch',
            coolOverseed: '', overseedSpecies: 'Perennial Ryegrass', percentC3: 60
        }),
        'C4 with a high C3 percentage and no overseed at all': withTurf({
            species: 'Kikuyu', isC4: true, percentC3: 80
        }),
        'pure C3': withTurf({ species: 'Creeping Bentgrass', variety: 'Penn A4', percentC3: 100 })
    };

    let page;
    const collected = {};

    beforeAll(() => {
        const record = { errors: [], warnings: [], alerts: [] };
        page = loadPage(record);
        expect(page.failures).toEqual([]);
        Object.keys(SHAPES).forEach((k) => { collected[k] = page.sandbox.GAIP_WordExport.collectData(SHAPES[k]); });
    });

    test('an oversown sward prints the site\'s own overseed name, never a substitute', () => {
        const d = collected['oversown, explicit both sides'];
        expect(d.turf.hasOverseed).toBe(true);
        expect(d.turf.coolOverseed).toBe('Perennial Ryegrass');
        expect(d.turf.warmBase).toBe('Couch');
    });

    test('the overseed name is the site\'s own or absent — never a name from the file', () => {
        // Measured, not assumed: the first version of this asserted that
        // hasOverseed never holds with an empty coolOverseed, and a mutation
        // that made hasExplicitOverseed stop requiring a cool name left it
        // green. It reads the field AFTER line 8166 has already written the
        // substitute into it, so the substitution is what it was observing.
        // The question the client's document asks is not whether the field is
        // filled but WHERE the name came from, so that is what is asserted:
        // every shape's printed overseed name is the one the resolver gave for
        // that site, or nothing at all.
        const invented = Object.keys(collected)
            .filter((k) => {
                const printed = collected[k].turf.coolOverseed;
                return printed && printed !== SHAPES[k].turf.coolOverseed;
            })
            .map((k) => k + ': document ' + JSON.stringify(collected[k].turf.coolOverseed) +
                ', site ' + JSON.stringify(SHAPES[k].turf.coolOverseed));
        expect({ invented: invented }).toEqual({ invented: [] });
    });

    test('the warm-season base is the site\'s own or its species — never a name from the file', () => {
        const invented = Object.keys(collected)
            .filter((k) => {
                const printed = collected[k].turf.warmBase;
                return printed && printed !== SHAPES[k].turf.warmBase && printed !== SHAPES[k].turf.species;
            })
            .map((k) => k + ': document ' + JSON.stringify(collected[k].turf.warmBase) +
                ', site base ' + JSON.stringify(SHAPES[k].turf.warmBase) +
                ', site species ' + JSON.stringify(SHAPES[k].turf.species));
        expect({ invented: invented }).toEqual({ invented: [] });
    });

    test('c3Fraction stays unassigned in every shape — the six branches behind it do not run', () => {
        const alive = Object.keys(collected)
            .filter((k) => collected[k].turf.c3Fraction !== undefined)
            .map((k) => k + ': c3Fraction ' + JSON.stringify(collected[k].turf.c3Fraction));
        expect({ alive: alive }).toEqual({ alive: [] });
        Object.keys(collected).forEach((k) => {
            expect(collected[k].turf.overseedDominant).toBe(false);
            expect(collected[k].turf.useC3Targets).toBe(false);
        });
    });

    test('a percentC3 the site does carry is not quietly promoted into c3Fraction', () => {
        // The two are different quantities today: percentC3 comes from the
        // site's config and is printed; c3Fraction chooses agronomic targets
        // and nothing fills it. Connecting them changes client numbers and is
        // question 10.8(8), the owner's. This asserts the state, so the
        // connection cannot be made as a side effect of something else.
        expect(collected['oversown, explicit both sides'].turf.percentC3).toBe(40);
        expect(collected['oversown, explicit both sides'].turf.c3Fraction).toBeUndefined();
    });
});

/**
 * GH-466 (section 10.6, third refinement, point 4) — the border's own shape.
 *
 * The reviewer's seventh mutation is a NEW KEY, not a changed value: a default
 * added as a new field of the resolver changes nothing any value assertion is
 * watching, and the document starts carrying it. So the resolver's object is
 * pinned by a named list per section, and the list is asserted against a real
 * resolve — both with a site that exists and with an id that resolves to
 * nothing, because "under any inputs" is the whole point.
 */
describe('GH-466 — the resolver returns exactly the keys it is documented to return', () => {
    let resolved;

    beforeAll(() => {
        const page = loadPage({ errors: [], warnings: [], alerts: [] });
        expect(page.failures).toEqual([]);
        const NPI = page.sandbox.GAIP_NutritionProgramInputs;
        resolved = {
            'a site that resolves': NPI.resolveExportInputs({ siteId: SITE_ID }),
            'an id that resolves to nothing': NPI.resolveExportInputs({ siteId: 'no-such-site' })
        };
    });

    test.each(['top', 'site', 'site.location', 'turf', 'samples'])(
        'the %s section has exactly its documented keys, under any inputs', (section) => {
            const pick = (inputs) => (section === 'top' ? inputs
                : section.split('.').reduce((o, k) => (o == null ? o : o[k]), inputs));
            Object.keys(resolved).forEach((label) => {
                expect({ section: section, inputs: label, keys: Object.keys(pick(resolved[label])) })
                    .toEqual({ section: section, inputs: label, keys: RESOLVER_KEYS[section] });
            });
        });

    test('every provenance key belongs to the documented set', () => {
        // `sources` answers for what was ASKED, so its membership moves with
        // the inputs: an unresolved site records lat and lon, a resolved one
        // does not. Pinned as the set a key must belong to, which still fails
        // on a key nobody wrote down.
        const strangers = [];
        Object.keys(resolved).forEach((label) => {
            Object.keys(resolved[label].sources)
                .filter((k) => RESOLVER_KEYS.sources.indexOf(k) < 0)
                .forEach((k) => strangers.push(label + ': ' + k));
        });
        expect({ strangers: strangers }).toEqual({ strangers: [] });
    });

    test('the programme section carries its documented keys when there is one, and is null when there is not', () => {
        expect(Object.keys(resolved['a site that resolves'].program)).toEqual(RESOLVER_KEYS.program);
        expect(resolved['an id that resolves to nothing'].program).toBeNull();
    });
});

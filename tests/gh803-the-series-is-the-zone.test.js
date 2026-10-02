/**
 * GH-803 (queue item "Zones", stage C3) — THE SERIES, THE SECTION AND THE PAIR ARE THE ZONE, NOT ITS NAME.
 *
 * WHAT THIS STAGE CHANGES. A zone's history was held together by a string: the sample's name with its
 * dates stripped off (`GaipZoneKey.derive`). Rename a green and its trend split in two; spell it two
 * ways and it was two greens. A zone is a row with an identity now (stage C0), the server writes it on
 * every sample (C1) and answers with it (place 1 of this stage), so the series, the report's sections
 * and the tissue-to-soil pair are keyed by that identity.
 *
 * WHY THE FIXTURE CARRIES THREE NAMES THE STAND DOES NOT HAVE. Measured by the reviewer and again by the
 * analyst on 01.10.2026: of the 69 live samples on the stand not one has a name where `derive()` differs
 * from a plain `LOWER(TRIM())` — no brackets, no year, no date, no trailing spaces. A fixture taken from
 * the stand as it stands therefore cannot tell a test that RAN `derive()` from a test that compared two
 * of its own lists, which is also why an earlier measurement of "44 groups against 44" proved nothing.
 * So three names are added here on purpose — `Green 1`, `Green 1 (2026-02-13)`, `Green 1 2026` — and
 * they are declared as invented rather than passed off as data: the product permits them (a client may
 * name a zone that way, and an import loads the name as it arrives), it simply has none today.
 *
 * AND WHAT THEY MUST DO IS THE OWNER'S DECISION OF 01.10.2026, in her words: "as they loaded the zone's
 * name, that is the name we load; if there is a date in it, let there be a date. And if the zone is
 * wrong they have to edit it and delete the wrong one. That is, we load everything as it is." So a name
 * with a date in it is A ZONE OF ITS OWN: three names, three zones, three series — where the old key
 * stripped the dates and made them one. The old behaviour is asserted here too, because the whole claim
 * of this stage is the difference between the two.
 */

'use strict';

const fs = require('fs');
const path = require('path');
const vm = require('vm');

require('../assets/zone-key.js');

/** Three zones of one site, as the server would answer: one row per name, as the owner decided. */
const ZONE_PLAIN = '01a0f300-0000-7000-8000-000000000001';
const ZONE_DATED = '01a0f300-0000-7000-8000-000000000002';
const ZONE_YEAR = '01a0f300-0000-7000-8000-000000000003';

/**
 * The trend module in a node run: it draws, listens and logs on a timer, so the page it expects is
 * stubbed down to what it touches. The same convention as the other offline cases in this suite —
 * per-file rather than shared, because each file stubs exactly what its own subject needs.
 */
function loadTrend() {
    jest.useFakeTimers();
    delete require.cache[require.resolve('../assets/nutrient-trend.js')];
    const element = () => ({
        appendChild() {}, removeChild() {}, remove() {}, insertBefore() {},
        setAttribute() {}, getAttribute: () => null, addEventListener() {},
        querySelector: () => null, querySelectorAll: () => [],
        style: {}, classList: { add() {}, remove() {}, contains: () => false },
        textContent: '', innerHTML: '', dataset: {}, parentNode: null, children: [],
    });
    global.document = {
        addEventListener() {}, removeEventListener() {},
        createElement: element, createTextNode: (t) => ({ nodeValue: t }),
        createElementNS: element,
        querySelector: () => null, querySelectorAll: () => [], getElementById: () => null,
        readyState: 'complete', body: element(), head: element(),
    };
    global.window = global.window || {};
    global.window.addEventListener = () => {};
    global.window.document = global.document;
    global.window.GaipZoneKey = global.GaipZoneKey;
    const quiet = console.log;
    console.log = () => {};
    try {
        require('../assets/nutrient-trend.js');
    } finally {
        console.log = quiet;
    }

    return global.window.GilbaNutrientTrend;
}

/** A store of samples as `sample-persistence.js` leaves it after a sync. */
function storeOf(samples) {
    const byId = {};
    samples.forEach((s) => { byId[s.id] = s; });

    return {
        // What the index actually asks for, which is a list per kind of sample.
        getSamples: () => samples.slice(),
        getActiveSample: () => null,
        getAllSamples: () => ({ allSites: { site: { soil: byId } }, sites: { site: {} }, currentSite: 'site' }),
        getCurrentSiteId: () => 'site',
        readingsOf: (type, s) => (s && s.values) || {},
    };
}

const THREE_VISITS_OF_THREE_NAMES = [
    { id: 'a1', serverId: 11, label: 'Green 1', zoneId: ZONE_PLAIN, zoneName: 'Green 1',
      date: '2026-01-10', zoneType: 'green', values: { K: 100 }, rawData: { K: 100 } },
    { id: 'a2', serverId: 12, label: 'Green 1', zoneId: ZONE_PLAIN, zoneName: 'Green 1',
      date: '2026-03-10', zoneType: 'green', values: { K: 110 }, rawData: { K: 110 } },
    { id: 'b1', serverId: 13, label: 'Green 1 (2026-02-13)', zoneId: ZONE_DATED,
      zoneName: 'Green 1 (2026-02-13)', date: '2026-02-13', zoneType: 'green',
      values: { K: 120 }, rawData: { K: 120 } },
    { id: 'b2', serverId: 14, label: 'Green 1 (2026-02-13)', zoneId: ZONE_DATED,
      zoneName: 'Green 1 (2026-02-13)', date: '2026-04-13', zoneType: 'green',
      values: { K: 125 }, rawData: { K: 125 } },
    { id: 'c1', serverId: 15, label: 'Green 1 2026', zoneId: ZONE_YEAR, zoneName: 'Green 1 2026',
      date: '2026-05-01', zoneType: 'green', values: { K: 130 }, rawData: { K: 130 } },
    { id: 'c2', serverId: 16, label: 'Green 1 2026', zoneId: ZONE_YEAR, zoneName: 'Green 1 2026',
      date: '2026-06-01', zoneType: 'green', values: { K: 135 }, rawData: { K: 135 } },
];

describe('GH-803 — a trend series is a zone', () => {
    let TREND;
    beforeEach(() => {
        TREND = loadTrend();
        global.window.GAIP_SampleManager = storeOf(THREE_VISITS_OF_THREE_NAMES);
    });

    test('three names that differ only by a date are three series, and the old key made them one', () => {
        const index = TREND.buildTemporalIndex('soil');
        const now = {};
        Object.keys(index).forEach((k) => { now[k] = index[k].map((s) => s.id).sort(); });

        // The old rule, run through the REAL deriver rather than a copy of it, so this comparison is
        // the measurement the reviewer asked for and not two lists of mine.
        const old = {};
        THREE_VISITS_OF_THREE_NAMES.forEach((s) => {
            const key = 'soil:' + (s.zoneType || 'other') + ':' + global.GaipZoneKey.derive(s);
            (old[key] = old[key] || []).push(s.id);
        });

        process.stdout.write('[gh803] series by the zone: ' + JSON.stringify(now)
            + '\n[gh803] series by the old name key: ' + JSON.stringify(old) + '\n');

        // Three series, one per zone, each holding its own two visits.
        expect(now).toEqual({
            ['soil:' + ZONE_PLAIN]: ['a1', 'a2'],
            ['soil:' + ZONE_DATED]: ['b1', 'b2'],
            ['soil:' + ZONE_YEAR]: ['c1', 'c2'],
        });
        // And the old key put all six in ONE series: that is the difference this stage makes, and the
        // owner's decision is that the three are three.
        expect(Object.keys(old)).toEqual(['soil:green:green 1']);
        expect(old['soil:green:green 1'].sort()).toEqual(['a1', 'a2', 'b1', 'b2', 'c1', 'c2']);
    });

    test('the caption of a series is the zone name, and never the key', () => {
        const index = TREND.buildTemporalIndex('soil');
        const captions = {};
        Object.keys(index).forEach((k) => { captions[k] = TREND.seriesLabelOf(index[k], k, 'soil'); });

        process.stdout.write('[gh803] captions: ' + JSON.stringify(captions) + '\n');

        expect(captions).toEqual({
            ['soil:' + ZONE_PLAIN]: 'Green 1',
            ['soil:' + ZONE_DATED]: 'Green 1 (2026-02-13)',
            ['soil:' + ZONE_YEAR]: 'Green 1 2026',
        });
        // Not one caption carries an identifier, which is what the key now is.
        Object.values(captions).forEach((c) => expect(c).not.toMatch(/[0-9a-f]{8}-[0-9a-f]{4}/));
    });

    test('a rename moves the caption and keeps the series whole', () => {
        const renamed = THREE_VISITS_OF_THREE_NAMES
            .filter((s) => s.zoneId === ZONE_PLAIN)
            .map((s) => Object.assign({}, s, { zoneName: 'Putter Green' }));
        global.window.GAIP_SampleManager = storeOf(renamed);
        const index = TREND.buildTemporalIndex('soil');
        const key = 'soil:' + ZONE_PLAIN;

        process.stdout.write('[gh803] after the rename: ' + JSON.stringify({
            series: Object.keys(index), points: index[key].map((s) => s.id),
            caption: TREND.seriesLabelOf(index[key], key, 'soil'),
        }) + '\n');

        // One series, both visits in it, under the new name.
        expect(Object.keys(index)).toEqual([key]);
        expect(index[key].map((s) => s.id)).toEqual(['a1', 'a2']);
        expect(TREND.seriesLabelOf(index[key], key, 'soil')).toBe('Putter Green');
    });

    test('a sample whose zone was deleted gets a series of its own and is not merged by name', () => {
        const orphan = Object.assign({}, THREE_VISITS_OF_THREE_NAMES[0],
            { id: 'orphan', serverId: 99, zoneId: null, zoneName: null, label: 'Green 1' });
        global.window.GAIP_SampleManager = storeOf(THREE_VISITS_OF_THREE_NAMES.concat([orphan]));
        const index = TREND.buildTemporalIndex('soil');

        process.stdout.write('[gh803] with an unzoned sample: ' + JSON.stringify(
            Object.keys(index).map((k) => k + ' -> ' + index[k].map((s) => s.id).join(','))) + '\n');

        // Its own series, keyed by itself -- not added to the zone that happens to share its name.
        expect(index['soil:sample:99'].map((s) => s.id)).toEqual(['orphan']);
        expect(index['soil:' + ZONE_PLAIN].map((s) => s.id)).toEqual(['a1', 'a2']);
        // And its caption is its own name, by the same rule, never its id.
        expect(TREND.seriesLabelOf(index['soil:sample:99'], 'soil:sample:99', 'soil')).toBe('Green 1');
    });

    /**
     * WHAT WORD IS HANDED, because the subheading above the sparklines is the second half of "the one
     * place a zone's name is printed". Word reads `zoneData.zone` and printed `|| zoneKey` beside it;
     * from this stage that fallback would print a UUID, so it is gone. The data is asserted here — every
     * series is handed a NAME and never its own key — and the line that prints it is asserted by its
     * source, which is the weaker half and is named as such.
     */
    test('the export data hands Word a name for every series and never the key', () => {
        const TREND = loadTrend();
        const forWord = TREND.getTrendExportData('soil');
        const captions = {};
        Object.keys(forWord).forEach((k) => { captions[k] = forWord[k].zone; });
        process.stdout.write('[gh803] what Word is handed: ' + JSON.stringify(captions) + '\n');

        expect(Object.keys(captions).sort()).toEqual([
            'soil:' + ZONE_DATED, 'soil:' + ZONE_PLAIN, 'soil:' + ZONE_YEAR].sort());
        Object.keys(captions).forEach((key) => {
            expect(captions[key]).not.toBe(key);
            expect(captions[key]).not.toMatch(/[0-9a-f]{8}-[0-9a-f]{4}/);
        });
        expect(captions['soil:' + ZONE_DATED]).toBe('Green 1 (2026-02-13)');

        // And the fallback that would have printed the key is not in the file any more.
        const word = fs.readFileSync(path.join(__dirname, '../assets/word-export.js'), 'utf8');
        expect(word).not.toMatch(/var zoneLabel = zoneData\.zone \|\| zoneKey;/);
        expect(word).toMatch(/var zoneLabel = zoneData\.zone \|\| '';/);
    });

    test('the water branch is untouched, byte for byte', () => {
        const water = [
            { id: 'w1', serverId: 21, label: 'Bore', zoneId: null, zoneName: null, date: '2026-01-01',
              zoneType: 'bore', values: { EC: 0.4 }, rawData: { EC: 0.4 } },
            { id: 'w2', serverId: 22, label: 'Bore', zoneId: null, zoneName: null, date: '2026-02-01',
              zoneType: 'bore', values: { EC: 0.5 }, rawData: { EC: 0.5 } },
            { id: 'w3', serverId: 23, label: 'Dam Water', zoneId: null, zoneName: null,
              date: '2026-02-01', zoneType: 'surface', values: { EC: 0.9 }, rawData: { EC: 0.9 } },
        ];
        const byId = {};
        water.forEach((s) => { byId[s.id] = s; });
        global.window.GAIP_SampleManager = {
            getSamples: () => water.slice(),
            getActiveSample: () => null,
            getAllSamples: () => ({ allSites: { site: { water: byId } }, sites: { site: {} }, currentSite: 'site' }),
            getCurrentSiteId: () => 'site',
            readingsOf: (t, s) => (s && s.values) || {},
        };
        const index = TREND.buildTemporalIndex('water');
        const keys = Object.keys(index).sort();

        process.stdout.write('[gh803] water series: ' + JSON.stringify(keys)
            + ', captions ' + JSON.stringify(keys.map((k) => TREND.seriesLabelOf(index[k], k, 'water'))) + '\n');

        // The key a water sample has always had: `water:` + the word beside it + its derived name.
        expect(keys).toEqual(['water:bore:bore', 'water:surface:dam water']);
        // And its caption still comes out of that key, as it did before this stage.
        expect(keys.map((k) => TREND.seriesLabelOf(index[k], k, 'water'))).toEqual(['bore', 'dam water']);
    });
});

/**
 * `:684` — THE NAME OF A SAMPLE, THREE BRANCHES AND FOUR CASES.
 *
 * `label: pld._label || pld.label || sampleId` put the store's own key in the name's place. One case was
 * not enough, and that is the reviewer's measurement rather than a precaution: with a single case for
 * "neither key", removing the MIDDLE branch passes in silence. Four cases, one per branch plus one where
 * both keys are filled and differ, which is what catches the branches being swapped.
 *
 * The run uses the REAL loop out of the file, in the sandbox the neighbouring cases built for it.
 */
describe('GH-803 — the name of a sample, or nothing', () => {
    function extractPayloadHelpers(src) {
        const start = src.indexOf('var PAYLOAD_META_KEYS = ');
        const end = src.indexOf('function buildPayload(', start);

        return src.slice(start, end);
    }

    function runRealSync(samples) {
        const src = fs.readFileSync(path.join(__dirname, '../assets/sample-persistence.js'), 'utf8');
        const start = src.indexOf('var restored = 0;');
        const callPos = src.indexOf('SM.restoreFromPersistence(serverSnap);', start);
        const block = extractPayloadHelpers(src) + '\n' + src.slice(start, src.indexOf('}', callPos) + 1);
        let snap = null;
        const sandbox = {
            SM: { getAllSamples: () => ({ allSites: {}, sites: {} }),
                  restoreFromPersistence: (s) => { snap = s; } },
            samples: samples,
            // The module the empty answer comes from, as the page has it.
            GaipZoneKey: global.GaipZoneKey,
            console: { log: () => {}, warn: () => {} },
        };
        sandbox.globalThis = sandbox;
        vm.runInContext(block, vm.createContext(sandbox));

        return snap;
    }

    const asServer = (payload) => ({ id: 7, site_id: 'site', sample_type: 'soil', client_uid: null,
        lab_date: '2026-01-01', sample_date: null, notes: '', payload: payload });

    test('a sample with `_label` is called by it', () => {
        const snap = runRealSync([asServer({ _label: 'Green 1', K: 1 })]);
        const built = Object.values(snap.allSites.site.soil)[0];
        process.stdout.write('[gh803] _label only: ' + JSON.stringify(built.label) + '\n');
        expect(built.label).toBe('Green 1');
    });

    test('a sample with only the older `label` key is called by that', () => {
        const snap = runRealSync([asServer({ label: 'Green 7', K: 1 })]);
        const built = Object.values(snap.allSites.site.soil)[0];
        process.stdout.write('[gh803] label only: ' + JSON.stringify(built.label) + '\n');
        expect(built.label).toBe('Green 7');
    });

    test('a sample with neither is called NOTHING, and the nothing is the module\'s', () => {
        const snap = runRealSync([asServer({ K: 1 })]);
        const built = Object.values(snap.allSites.site.soil)[0];
        process.stdout.write('[gh803] neither key: ' + JSON.stringify(built.label)
            + ', and the module says ' + JSON.stringify(global.GaipZoneKey.UNNAMED) + '\n');

        // Not the store's key, not the server's id: the wording of "no name", from its one owner.
        expect(built.label).toBe(global.GaipZoneKey.UNNAMED);
        expect(built.label).not.toBe(built.id);
        expect(built.label).not.toBe(String(built.serverId));
    });

    test('with both keys filled and different, `_label` wins — the branches are not swapped', () => {
        const snap = runRealSync([asServer({ _label: 'Green 1', label: 'Old name', K: 1 })]);
        const built = Object.values(snap.allSites.site.soil)[0];
        process.stdout.write('[gh803] both keys: ' + JSON.stringify(built.label) + '\n');
        expect(built.label).toBe('Green 1');
    });

    test('and the zone the server answered with travels into the store', () => {
        const row = asServer({ _label: 'Green 1', K: 1 });
        row.zone_id = ZONE_PLAIN;
        row.zone_name = 'Green 1';
        const snap = runRealSync([row]);
        const built = Object.values(snap.allSites.site.soil)[0];
        process.stdout.write('[gh803] the zone in the store: '
            + JSON.stringify({ zoneId: built.zoneId, zoneName: built.zoneName }) + '\n');

        expect(built.zoneId).toBe(ZONE_PLAIN);
        expect(built.zoneName).toBe('Green 1');
        // A sample the server answered with no zone carries null, not a name borrowed from itself.
        const none = Object.values(runRealSync([asServer({ _label: 'Bore', K: 1 })]).allSites.site.soil)[0];
        expect(none.zoneId).toBeNull();
        expect(none.zoneName).toBeNull();
    });
});

/**
 * THE MEASUREMENT THE PLAN ASKS FOR — the series the stand has today and the series it will have.
 *
 * Not the NUMBER of series: their COMPOSITION, which samples are in which. A count agrees while two
 * series swap a sample, and the question this stage has to answer for the owner is whether anybody's
 * chart falls apart on the day it ships.
 *
 * The fixture is the stand's own 69 live samples, taken by one SELECT joined to `zones`
 * (`tests/fixtures/gh803-stand-samples.json`), and the deriver that builds the OLD key is the real one
 * out of `zone-key.js`. The reviewer's mutation U7 — take the date-stripping out of `derive()` — is what
 * proves the deriver ran: with it gone, the names with dates in them stop collapsing and the first case
 * of this file reddens. On the stand it changes nothing, because the stand has no such name, which is
 * the whole reason that case carries three invented ones.
 */
describe('GH-803 — the stand\'s series, before and after', () => {
    const STAND = JSON.parse(fs.readFileSync(
        path.join(__dirname, 'fixtures/gh803-stand-samples.json'), 'utf8'));

    const asStoreSample = (r) => ({
        id: r.label || r.id, serverId: r.id, label: r.label, zoneId: r.zoneId, zoneName: r.zoneName,
        zoneType: r.word || 'other', date: r.date, values: {}, rawData: {},
    });

    /**
     * PER SITE, and that is not a detail: the trend reads the store of the site a person has open
     * (`getSamples` answers for one site), while the OLD key carries no site in it at all. Grouping the
     * whole stand in one bucket made two sites' "Green 1" one series under the old key and two under the
     * new one -- a difference of the measurement, not of the product. Measured on the first run of this
     * case: 12 series against 25.
     */
    function seriesOf(kind, keyOf) {
        const out = {};
        STAND.samples.filter((r) => r.sampleType === kind).forEach((r) => {
            const key = r.siteId + ' | ' + keyOf(asStoreSample(r), kind);
            (out[key] = out[key] || []).push(r.id);
        });
        Object.keys(out).forEach((k) => out[k].sort());

        return out;
    }

    const oldKey = (s, kind) => kind + ':' + (s.zoneType || 'other') + ':' + global.GaipZoneKey.derive(s);

    test('every series holds the same samples before and after, for soil, tissue and water', () => {
        const TREND = loadTrend();
        const report = {};
        ['soil', 'tissue', 'water'].forEach((kind) => {
            const before = seriesOf(kind, oldKey);
            const after = seriesOf(kind, (s) => TREND.seriesKeyOf(s, kind));
            // Compared as SETS OF SERIES, so a sample moving between two series shows up even though
            // the number of series would not change.
            const beforeSets = Object.values(before).map((v) => v.join(',')).sort();
            const afterSets = Object.values(after).map((v) => v.join(',')).sort();
            report[kind] = { series: beforeSets.length, same: JSON.stringify(beforeSets) === JSON.stringify(afterSets) };
            expect(afterSets).toEqual(beforeSets);
        });
        process.stdout.write('[gh803] the stand, series composition before vs after: '
            + JSON.stringify(report) + '\n');

        // The universe is real: the stand's samples are here, and the water ones among them.
        expect(STAND.samples.length).toBe(69);
        expect(STAND.samples.filter((r) => r.sampleType === 'water').length).toBe(10);
        // And not one of its names is one the deriver would change -- which is why the invented three
        // above are needed, and this is where that is measured rather than asserted.
        const changedByDerive = STAND.samples.filter(
            (r) => global.GaipZoneKey.derive({ label: r.label }) !== String(r.label).toLowerCase().trim());
        process.stdout.write('[gh803] stand names where derive() differs from a plain trim: '
            + JSON.stringify(changedByDerive.map((r) => r.label)) + '\n');
        expect(changedByDerive).toEqual([]);
    });

    test('the water series of the stand are keyed exactly as they were', () => {
        const TREND = loadTrend();
        const before = Object.keys(seriesOf('water', oldKey)).sort();
        const after = Object.keys(seriesOf('water', (s) => TREND.seriesKeyOf(s, 'water'))).sort();
        process.stdout.write('[gh803] water keys: ' + JSON.stringify(after) + '\n');

        // Byte for byte, the keys themselves and not only their contents: the owner's decision about
        // water is that nothing of it changes.
        expect(after).toEqual(before);
    });
});

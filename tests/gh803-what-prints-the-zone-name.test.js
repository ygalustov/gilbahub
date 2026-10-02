/**
 * GH-803 (queue item "Zones", stage C3) — AFTER THIS STAGE A SAMPLE HAS TWO NAMES, AND EACH IS PRINTED
 * WHERE IT BELONGS.
 *
 * THE RULE IS `GH-459`: a line prints the name of the object the line is ABOUT. A line about a sample
 * prints the sample's own name (`payload._label` — the name of a visit, "Green 1 (June 2025)"); a line
 * about a GROUP of visits, which has no sample of its own, prints the zone's name. Neither stands in for
 * the other, and the analyst's decision of 01.10.2026 is that this stage starts printing a zone's name in
 * exactly ONE place: the caption of a trend series, on the screen and above the sparklines in Word.
 *
 * WHAT THIS FILE HOLDS, and the first three are the "nothing changed" half that a stage like this one has
 * to prove as loudly as the half that did change:
 *   1. the report's sections are grouped by the zone, and each section is still captioned by the LAST
 *      SAMPLE's own name;
 *   2. a renamed zone is one section and not two;
 *   3. the zone list of a stored result is keyed by the zone, carries its id, and its entries keep their
 *      own captions;
 *   4. no identifier is printed anywhere — not in a caption, not in a heading.
 */

'use strict';

function stubDom() {
    global.window = {};
    global.document = {
        readyState: 'complete',
        addEventListener() {}, removeEventListener() {}, dispatchEvent: () => true,
        querySelector: () => null, querySelectorAll: () => [],
        createElement: () => ({ style: {}, addEventListener() {}, setAttribute() {},
            appendChild() {}, classList: { add() {}, remove() {} } }),
        body: { appendChild() {}, contains: () => false },
        getElementById: () => null,
    };
    global.localStorage = { getItem: () => null, setItem() {}, removeItem() {} };
}

function loadModules() {
    jest.useFakeTimers();
    jest.resetModules();
    stubDom();
    require('../assets/zone-key.js');
    require('../assets/sample-manager.js');
    require('../assets/word-export-combined.js');

    return { SM: global.window.GAIP_SampleManager, CE: global.window.GAIP_CombinedExport };
}

afterEach(() => { jest.useRealTimers(); });

const SITE = 'gh803-site';
const ZONE_1 = '01a0f400-0000-7000-8000-000000000001';
const ZONE_2 = '01a0f400-0000-7000-8000-000000000002';

function seed(SM, store) {
    SM.restoreFromPersistence({
        sites: { [SITE]: { label: 'GH-803 Site', createdAt: '' } },
        currentSite: SITE,
        allSites: { [SITE]: Object.assign({ soil: {}, water: {}, tissue: {}, loi: {} }, store) },
        allActive: {}, allMeta: {},
    });
}

/** Two visits of one zone, each with a name of its own, and one visit of another zone. */
const JUNE = { id: 'june', label: 'Green 1 (June 2025)', zoneId: ZONE_1, zoneName: 'Green 1',
    date: '2025-06-01', notes: '', zoneType: 'green', values: { K: '100' } };
const AUGUST = { id: 'august', label: 'Green 1 north', zoneId: ZONE_1, zoneName: 'Green 1',
    date: '2026-08-01', notes: '', zoneType: 'green', values: { K: '120' } };
const OTHER = { id: 'g12', label: 'Green 12', zoneId: ZONE_2, zoneName: 'Green 12',
    date: '2026-08-01', notes: '', zoneType: 'green', values: { K: '90' } };

describe('GH-803 — the report is grouped by the zone and captioned by the sample', () => {
    test('two visits of one zone are one section, captioned by the LATEST sample\'s own name', () => {
        const { SM, CE } = loadModules();
        seed(SM, { soil: { june: JUNE, august: AUGUST, g12: OTHER } });

        const entries = CE.enumerate('current');
        const seen = entries.map((e) => ({ sampleId: e.sampleId, caption: e.sampleLabel,
            zone: e.zoneProvenance && e.zoneProvenance.zoneKey }));
        process.stdout.write('[gh803] the report sections: ' + JSON.stringify(seen) + '\n');

        // Two sections -- one per ZONE, not one per visit and not one per name.
        expect(entries.map((e) => e.sampleId).sort()).toEqual(['august', 'g12']);
        // And the caption is the SAMPLE's own name: "Green 1 north", not the zone's "Green 1".
        expect(entries.filter((e) => e.sampleId === 'august')[0].sampleLabel).toBe('Green 1 north');
        // The prior visit is recorded as a prior visit of the same section, which is what proves the
        // two were grouped rather than one of them dropped.
        const section = entries.filter((e) => e.sampleId === 'august')[0];
        expect(section.zoneProvenance.priorSamples.map((p) => p.sampleId)).toEqual(['june']);
        // The grouping key is the zone's identity now.
        expect(section.zoneProvenance.zoneKey).toBe('zone:' + ZONE_1);
    });

    test('a renamed zone is one section, not two', () => {
        const { SM, CE } = loadModules();
        // The same two visits after the zone was renamed: the zone's name moved, the samples' did not.
        seed(SM, { soil: {
            june: Object.assign({}, JUNE, { zoneName: 'Putter Green' }),
            august: Object.assign({}, AUGUST, { zoneName: 'Putter Green' }),
        } });

        const entries = CE.enumerate('current');
        process.stdout.write('[gh803] after a rename, sections: '
            + JSON.stringify(entries.map((e) => [e.sampleId, e.sampleLabel])) + '\n');

        expect(entries).toHaveLength(1);
        expect(entries[0].sampleId).toBe('august');
        // Still the sample's own name in the caption -- the rename did not reach it, and must not.
        expect(entries[0].sampleLabel).toBe('Green 1 north');
    });

    test('a sample whose zone was deleted gets a section of its own, not merged by name', () => {
        const { SM, CE } = loadModules();
        const orphan = { id: 'orphan', label: 'Green 1', zoneId: null, zoneName: null,
            date: '2026-09-01', notes: '', zoneType: 'green', values: { K: '80' } };
        seed(SM, { soil: { june: JUNE, august: AUGUST, orphan: orphan } });

        const entries = CE.enumerate('current');
        process.stdout.write('[gh803] with an unzoned sample: '
            + JSON.stringify(entries.map((e) => [e.sampleId, e.zoneProvenance.zoneKey])) + '\n');

        // Its own section, keyed by itself -- and the zone's two visits still one section.
        expect(entries.map((e) => e.sampleId).sort()).toEqual(['august', 'orphan']);
        expect(entries.filter((e) => e.sampleId === 'orphan')[0].zoneProvenance.zoneKey)
            .toBe('sample:orphan');
    });

    test('not one caption or heading carries an identifier', () => {
        const { SM, CE } = loadModules();
        seed(SM, { soil: { june: JUNE, august: AUGUST, g12: OTHER } });

        const printed = CE.enumerate('current').flatMap((e) => [
            e.sampleLabel, e.siteLabel, e.zoneProvenance && e.zoneProvenance.winnerLabel,
        ]).filter(Boolean);
        process.stdout.write('[gh803] everything these sections print: ' + JSON.stringify(printed) + '\n');

        printed.forEach((text) => {
            expect(text).not.toMatch(/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}/);
            expect(text).not.toMatch(/^zone:/);
            expect(text).not.toMatch(/^sample:/);
        });
    });
});

describe('GH-803 — the zone list of a stored result', () => {
    /**
     * `hub-persistence.js` builds `computed.soilNutrition.zones` out of the store. The shape of the
     * entries does not change in this stage — a caption is still the sample's own, or nothing — but the
     * MAP is keyed by the zone, so a renamed zone is one entry, and each entry now records the identity
     * it was grouped by.
     *
     * The whole file is a browser module with a wide surface; the block that builds the map is taken out
     * of it and run, which is the convention of the offline cases for that file.
     */
    const fs = require('fs');
    const path = require('path');
    const vm = require('vm');

    function buildZoneList(samples) {
        const src = fs.readFileSync(path.join(__dirname, '../assets/hub-persistence.js'), 'utf8');
        const start = src.indexOf('var _zoneMap  = {};');
        const endMark = 'cache.computed.soilNutrition.zones = _zoneList;';
        const block = src.slice(start, src.indexOf(endMark, start) + endMark.length) + '\n}';
        const byId = {};
        samples.forEach((s) => { byId[s.id] = s; });
        const sandbox = {
            _allSoil: byId,
            // The thresholds the block marks alerts against live above the slice; the subject here is
            // the grouping and the captions, so they are handed in as the file's own map rather than
            // restated -- an empty one would make every entry alert-free and say nothing either way.
            _mlsnThresh: { K: 37, P: 21, Ca: 331, Mg: 47, S: 7 },
            cache: { computed: { soilNutrition: {} } },
            global: { GaipZoneKey: require('../assets/zone-key.js') || global.GaipZoneKey,
                      GAIP_SampleManager: { readingsOf: (t, s) => (s && s.values) || {} } },
            console: { warn() {}, log() {} },
        };
        sandbox.global.GaipZoneKey = global.GaipZoneKey;
        sandbox.globalThis = sandbox;
        vm.runInContext(block, vm.createContext(sandbox));

        return sandbox.cache.computed.soilNutrition.zones || [];
    }

    test('two visits of one zone are one entry, and the entry records the zone it is of', () => {
        const zones = buildZoneList([
            Object.assign({}, JUNE, { values: { K: 100 }, rawData: { K: 100 } }),
            Object.assign({}, AUGUST, { values: { K: 120 }, rawData: { K: 120 } }),
            Object.assign({}, OTHER, { values: { K: 90 }, rawData: { K: 90 } }),
        ]);
        process.stdout.write('[gh803] the stored zone list: ' + JSON.stringify(
            zones.map((z) => ({ label: z.label, zoneId: z.zoneId, K: z.ppm.K }))) + '\n');

        // One entry per zone, the later visit winning, and each entry says which zone it is.
        expect(zones.map((z) => z.zoneId).sort()).toEqual([ZONE_1, ZONE_2].sort());
        // The caption is unchanged: the sample's own name.
        expect(zones.filter((z) => z.zoneId === ZONE_1)[0].label).toBe('Green 1 north');
        expect(zones.filter((z) => z.zoneId === ZONE_1)[0].ppm.K).toBe(120);
    });

    test('a sample with no zone keeps an entry of its own, with a null zone and its own caption', () => {
        const zones = buildZoneList([
            Object.assign({}, JUNE, { values: { K: 100 }, rawData: { K: 100 } }),
            { id: 'orphan', label: 'Green 1', zoneId: null, zoneName: null, date: '2026-09-01',
              values: { K: 80 }, rawData: { K: 80 } },
        ]);
        process.stdout.write('[gh803] with an unzoned sample: ' + JSON.stringify(
            zones.map((z) => ({ label: z.label, zoneId: z.zoneId, K: z.ppm.K }))) + '\n');

        /**
         * The perechen rather than its length: which zones the list holds, in the order the file sorts
         * them. Both entries here have a name and an alert, and the unzoned one sorts first because its
         * name is "Green 1" and the other's is "Green 1 (June 2025)" -- the sort is by caption, which is
         * this file's own rule and not something this stage changed.
         */
        expect(zones.map((z) => z.zoneId)).toEqual([null, ZONE_1]);
        const orphan = zones.filter((z) => z.zoneId === null)[0];
        expect(orphan.label).toBe('Green 1');
        expect(orphan.ppm.K).toBe(80);
    });
});

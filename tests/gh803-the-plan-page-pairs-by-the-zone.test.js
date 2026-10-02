/**
 * GH-803 (queue item "Zones", stage C3) — THE PLAN PAGE'S OWN READ OF THE ZONE, AND WHAT IT IS FOR.
 *
 * WHY THIS FILE EXISTS, and it is the reviewer's return of 01.10.2026 rather than extra care. The
 * eleventh place of this stage is one line on the Plan page — `applySample()` putting the zone of the
 * chosen soil sample onto `GAIP_STATE.inputs.soil` — and nothing in the suite reddened when he mutated
 * it to `null`: the whole of Jest stayed at its control (4114 passed, the one failure being `gh781`,
 * the same as in the control). He also checked that there was no case rather than that he had not found
 * one: `gh469-calendar-inputs-are-built` does not carry the word `zoneId` at all.
 *
 * WHAT A SILENT FAILURE HERE COSTS. The object `applySample` reads is the SERVER's raw answer, whose key
 * is `zone_id`; the same thing in the browser's store is called `zoneId`. One letter wrong and the Plan
 * page loses the tissue-to-soil pair — every green's programme falls back to the species-table ratio —
 * with no error and a green suite. That is the defect GH-414 was written to remove, coming back by the
 * back door.
 *
 * AND WHY THE CENSUS GUARD CANNOT COVER IT: `Gh801NobodyReadsTheZoneOfASampleYetTest` compares the
 * PERECHEN of readers, not what they read. It reddens if this read is deleted and stays green if it
 * returns the wrong thing. A guard about place and a case about behaviour are two different instruments,
 * and this is the second one.
 */

'use strict';

global.window = global.window || {};
global.document = global.document || {
    addEventListener: function () {},
    querySelector: function () { return null; },
    querySelectorAll: function () { return []; },
    getElementById: function () { return null; },
};
global.localStorage = { getItem: function () { return null; }, setItem: function () {} };
const realConsole = global.console;
global.console = { log() {}, warn() {}, error() {}, info() {} };

require('../assets/zone-key.js');
global.window.GaipZoneKey = global.GaipZoneKey || global.window.GaipZoneKey;
const NPI = require('../assets/nutrition-program-inputs.js');
global.window.GAIP_NutritionProgramInputs = NPI;
global.window.GilbaGrowthPotentialEngine = require('../assets/growth-potential-engine.js');
require('../assets/nutrition-calendar.js');
const CAL = global.window.GilbaNutritionCalendar;
global.console = realConsole;

const ZONE_1 = '01a0f500-0000-7000-8000-000000000001';
const ZONE_2 = '01a0f500-0000-7000-8000-000000000002';

/**
 * The page's own road to `applySample`, driven as the page drives it: the picker is mounted and its
 * `onSelect` is what hands a sample over. Nothing here reaches inside the closure -- the sample goes in
 * through the product's own callback and the result is read off `GAIP_STATE`, which is what the pair
 * reads next.
 */
function choose(sample) {
    const picker = { id: 'plan-nut-sample-picker' };
    const label = { textContent: '' };
    const before = global.document.getElementById;
    global.document.getElementById = (id) => (id === 'plan-nut-sample-picker' ? picker
        : (id === 'plan-nut-sample-label' ? label : null));
    let options = null;
    global.window.GAIP_SoilNutritionAnalysis = {
        mountSampleDropdown: (mount, opts) => { options = opts; },
    };
    try {
        CAL.initSamplePicker();
        if (!options || typeof options.onSelect !== 'function') {
            throw new Error('the Plan page did not mount its sample picker');
        }
        options.onSelect(sample);
    } finally {
        global.document.getElementById = before;
    }

    return (global.window.GAIP_STATE && global.window.GAIP_STATE.inputs
        && global.window.GAIP_STATE.inputs.soil) || {};
}

/** A sample as the SERVER answers it: `zone_id` and `zone_name`, snake-cased, with its payload. */
const serverSample = (id, label, zoneId, zoneName) => ({
    id: id, client_uid: label, sample_type: 'soil', zone_id: zoneId, zone_name: zoneName,
    lab_date: '2026-08-01', soil_texture_snapshot: null,
    payload: { _label: label, P: 20, K: 90, Ca: 900, Mg: 120, S: 10, pH: 6.2, CEC: 12 },
});

const tissueOf = (id, zoneId) => ({ id: id, label: 'tissue ' + id, zoneId: zoneId,
    date: '2026-07-01', N: 4.2, P: 0.38, K: 2.5 });

describe('GH-803 — the Plan page carries the zone from the server to the pair', () => {
    test('a sample the server answered with a zone reaches the pair, and it is the right green\'s tissue', () => {
        CAL._tissueSamples = [tissueOf('t1', ZONE_1), tissueOf('t2', ZONE_2)];

        const soil = choose(serverSample(11, 'Green 1', ZONE_1, 'Green 1'));
        const paired = CAL.resolveZoneTissue(soil.zoneId || null);

        process.stdout.write('[gh803] the Plan page put on the soil object: '
            + JSON.stringify({ zoneId: soil.zoneId, zoneLabel: soil.zoneLabel })
            + '\n[gh803] and the pair it found: ' + JSON.stringify({
                applies: paired.applies, matched: CAL._tissueZoneMatch && CAL._tissueZoneMatch.matchedLabel,
            }) + '\n');

        // The identity travelled from the server's `zone_id` to the object the programme is built from.
        expect(soil.zoneId).toBe(ZONE_1);
        // And the pair is this green's tissue, by that identity -- not the other green's, not none.
        expect(paired.applies).toBe(true);
        expect(CAL._tissueZoneMatch.matchedLabel).toBe('tissue t1');
        expect(paired.percent).toEqual({ N: 4.2, P: 0.38, K: 2.5 });
    });

    test('the other green\'s tissue is not taken, and a zone with no tissue takes none', () => {
        CAL._tissueSamples = [tissueOf('t2', ZONE_2)];

        const soil = choose(serverSample(12, 'Green 1', ZONE_1, 'Green 1'));
        const paired = CAL.resolveZoneTissue(soil.zoneId || null);

        process.stdout.write('[gh803] a green whose tissue is not on file: '
            + JSON.stringify({ applies: paired.applies, percent: paired.percent }) + '\n');

        // The owner's rule: pairing a green with another green's tissue is worse than having none.
        expect(paired.applies).toBe(true);
        expect(paired.percent).toBeNull();
    });

    test('a sample the server answered with no zone pairs with nothing', () => {
        CAL._tissueSamples = [tissueOf('t1', ZONE_1)];

        const soil = choose(serverSample(13, 'Green 1', null, null));
        const paired = CAL.resolveZoneTissue(soil.zoneId || null);

        process.stdout.write('[gh803] a sample with no zone: '
            + JSON.stringify({ zoneId: soil.zoneId, applies: paired.applies }) + '\n');

        // Water, or a sample whose zone was deleted: no identity, so no pair -- and not a pair found by
        // the name it happens to share with a zone that does have tissue.
        expect(soil.zoneId).toBeNull();
        expect(paired.applies).toBe(false);
    });

    test('the sample\'s own name is still on the object, beside the identity', () => {
        CAL._tissueSamples = [];
        const soil = choose(serverSample(14, 'Green 1 (June 2025)', ZONE_1, 'Green 1'));

        process.stdout.write('[gh803] two names on the soil object: '
            + JSON.stringify({ zoneLabel: soil.zoneLabel, zoneId: soil.zoneId }) + '\n');

        // `zoneLabel` is the caption this page prints -- the name of the VISIT, which a rename of the
        // zone does not touch. `zoneId` is what the pair is decided by. Neither stands in for the other.
        expect(soil.zoneLabel).toBe('Green 1 (June 2025)');
        expect(soil.zoneId).toBe(ZONE_1);
    });
});

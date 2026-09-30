/**
 * GH-724 (queue item 19) — THE RUN COMPUTES ON THE SAMPLE IT WAS NAMED, AND SAYS SO WHEN IT HAS
 * NONE.
 *
 * The client's report is that a tissue sample never reaches the calculation. Measured on the
 * stand: `computed.tissue` is empty in 66 of 66 stored rows while `Burns`, `Russley` and
 * `Test5 - NZ` each hold live tissue samples. The mechanism is that the runner asked its sample
 * manager for the ACTIVE tissue sample, and nothing in a run frame ever makes one active — the
 * frame is opened fresh, and the browser copy that used to carry an active sample was removed with
 * the move to the database as the only source.
 *
 * So the opener names the sample, the way it already names the soil one, and the runner reads the
 * sample that was named. What is asserted here is the runner's half, because that is where a
 * wrong answer becomes a wrong number: the parameter decides, `none` is an answer rather than a
 * silence, and a named sample that is not in the store is an outcome of its own instead of quietly
 * becoming the active one.
 *
 * THE FUNCTIONS ARE LIFTED FROM THE PRODUCT'S SOURCE rather than reimplemented here, so a change
 * to the rule reaches this file instead of agreeing with a copy of the old rule.
 */

'use strict';

const fs = require('fs');
const path = require('path');
const vm = require('vm');

const ROOT = path.join(__dirname, '..');
const SRC = fs.readFileSync(path.join(ROOT, 'assets/hub-tissue-v3.js'), 'utf8');

/** One named function's balanced body, taken from the file. */
function lift(name) {
    const at = SRC.search(new RegExp('function\\s+' + name + '\\s*\\('));
    if (at < 0) return null;
    let depth = 0;
    for (let i = SRC.indexOf('{', at); i < SRC.length; i++) {
        if (SRC[i] === '{') depth++;
        else if (SRC[i] === '}') { depth--; if (!depth) return SRC.slice(at, i + 1); }
    }

    return null;
}

/**
 * The two functions under test, run together in a sandbox carrying only what they touch: a search
 * string, a sample manager, and a console. A fuller fake would be a second product.
 */
function runner(search, samples, activeByKind) {
    const namedSrc = lift('gaip_namedSample');
    // GH-777 (slice 3): the choice of WHICH sample -- named, else active -- is one function now, because the
    // soil delivery wait needs the sample itself and used to reach for the active one behind this reader's
    // back. `gaip_sampleReadings` calls it, so a bench lifting the reader alone lifts half of it.
    const inHandSrc = lift('gaip_sampleInHand');
    const readingsSrc = lift('gaip_sampleReadings');
    expect([typeof namedSrc, typeof readingsSrc]).toEqual(['string', 'string']);

    const sandbox = {
        URLSearchParams,
        console: { warn() {} },
        window: {
            location: { search },
            GAIP_SampleManager: {
                getSamples: (kind) => (samples[kind] || []),
                getActiveSample: (kind) => (activeByKind[kind] || null),
                readingsOf: (kind, sample) => (sample && sample.readings) || null,
            },
        },
    };
    vm.createContext(sandbox);
    vm.runInContext(namedSrc + '\n' + inHandSrc + '\n' + readingsSrc + '\n', sandbox);

    return {
        named: (kind) => vm.runInContext('gaip_namedSample(' + JSON.stringify(kind) + ')', sandbox),
        inHand: (kind) => vm.runInContext('gaip_sampleInHand(' + JSON.stringify(kind) + ')', sandbox),
        readings: (kind) => vm.runInContext('gaip_sampleReadings(' + JSON.stringify(kind) + ')', sandbox),
    };
}

/**
 * GH-777 (queue item 4) — THE STORE IS BUILT THE WAY THE PRODUCT BUILDS IT, and this file's own fixture is
 * why that matters.
 *
 * The samples below used to be written as `{ id: '121', … }` — a key equal to the row id, which is a shape
 * the product never produces. `sample-persistence.js` keys a restored sample by `client_uid`, else a label,
 * else `sample_<id>`, and keeps the row id in `serverId`. So the old fixture compared a name with itself and
 * could not go red, while on the stand not one of the 64 live samples had a key equal to its row id: every
 * named soil and tissue sample answered `not-found`, and the promise this very file asserts had never been
 * kept live. The key expression is now LIFTED FROM THE PRODUCT rather than restated here.
 */
const PERSISTENCE = fs.readFileSync(path.join(ROOT, 'assets', 'sample-persistence.js'), 'utf8');

function keyExpressionOfTheProduct() {
    const m = /var sampleId = ([^;]+);/.exec(PERSISTENCE);
    expect(m).not.toBeNull();

    return m[1];
}

/** A sample as the product's own restore builds it out of a server row. */
function restoredFromTheServer(row, readings) {
    const key = new Function('sample', 'return ' + keyExpressionOfTheProduct())(row);

    return { id: key, serverId: row.id, readings, label: (row.payload && row.payload._label) || key };
}

// Three server rows in the shapes the stand actually holds: a uid, a label, and neither.
const ROW_TISSUE_121 = { id: 121, client_uid: null, payload: { _label: 'Green tissue' } };
const ROW_TISSUE_120 = { id: 120, client_uid: 'uid-120', payload: {} };
const ROW_WATER_115 = { id: 115, client_uid: null, payload: {} };

const TISSUE_121 = restoredFromTheServer(ROW_TISSUE_121, { N: 4.1, K: 2.2 });
const TISSUE_120 = restoredFromTheServer(ROW_TISSUE_120, { N: 1.0, K: 1.0 });
const WATER_115 = restoredFromTheServer(ROW_WATER_115, { EC: 0.7 });
const STORE = { tissue: [TISSUE_120, TISSUE_121], water: [WATER_115] };

describe('GH-724 — the runner and the sample it was named', () => {
    test('POSITIVE CONTROL: both functions were found in the product and the store answers', () => {
        const r = runner('?rerun=r1&site=A&tissue=121', STORE, {});
        process.stdout.write('\n[gh724] named sample for `?tissue=121`: '
            + JSON.stringify(r.named('tissue')) + '\n'
            + '[gh724] readings it hands the run: ' + JSON.stringify(r.readings('tissue')) + '\n');
        expect(r.named('tissue')).toEqual(TISSUE_121);
        expect(r.readings('tissue')).toEqual({ N: 4.1, K: 2.2 });
    });

    test('THE PARAMETER DECIDES, not whatever the frame calls active', () => {
        // The measured defect in one line: the store holds both, the frame's active is the other
        // one, and the run must compute on the sample the server chose.
        const r = runner('?rerun=r1&site=A&tissue=121', STORE, { tissue: TISSUE_120 });
        expect(r.readings('tissue')).toEqual({ N: 4.1, K: 2.2 });
    });

    test('GH-777: the store is keyed by the client and found by the ROW ID, which is the name the server sends', () => {
        /**
         * The three shapes of a live row, all keyed by something other than the row id, and all found by it.
         * This is the measurement that was missing: `not-found` 3 of 3 before the repair, found 3 of 3 after.
         */
        const r = runner('?rerun=r1&site=A&tissue=121&water=115', STORE, {});
        process.stdout.write('[gh724] keys the store holds: '
            + JSON.stringify([TISSUE_120.id, TISSUE_121.id, WATER_115.id])
            + ' | row ids: ' + JSON.stringify([TISSUE_120.serverId, TISSUE_121.serverId, WATER_115.serverId])
            + '\n[gh724] named by row id 121 -> ' + JSON.stringify(r.named('tissue'))
            + '\n[gh724] named by row id 115 -> ' + JSON.stringify(r.named('water')) + '\n');

        // Not one of the keys is the row id — the shape the old fixture assumed does not occur.
        [TISSUE_120, TISSUE_121, WATER_115].forEach((s) => expect(String(s.id)).not.toBe(String(s.serverId)));
        // And each is found by the name the server sends.
        expect(r.named('tissue')).toEqual(TISSUE_121);
        expect(r.readings('tissue')).toEqual({ N: 4.1, K: 2.2 });
        expect(r.named('water')).toEqual(WATER_115);
        // A sample the store holds without a row id is not found by name, and that is honest.
        const anonymous = runner('?rerun=r1&site=A&tissue=999',
            { tissue: [{ id: 'sample_999', readings: { N: 1 } }] }, {});
        expect(anonymous.named('tissue')).toBe('not-found');
    });

    test('GH-777: `none` and `not found` mean nothing in hand, and the ACTIVE sample is not a fallback', () => {
        /**
         * The reviewer's mutation went here and found no case: `gaip_sampleInHand` is what the soil delivery
         * wait asks for the SAMPLE -- it has to tell "no sample" from "a sample nothing could read" (GH-612)
         * -- and returning the active sample for a run told `none` would put back exactly the read that the
         * gate of the pass was cleared of. The store holds a sample and the frame calls it active in every
         * line below, so a fallback would show.
         */
        const told = runner('?rerun=r1&site=A&tissue=none', STORE, { tissue: TISSUE_120 });
        const missing = runner('?rerun=r1&site=A&tissue=999', STORE, { tissue: TISSUE_120 });
        const silent = runner('?rerun=r1&site=A', STORE, { tissue: TISSUE_120 });
        process.stdout.write('[gh724] in hand — told none: ' + JSON.stringify(told.inHand('tissue'))
            + ' | named and not in the store: ' + JSON.stringify(missing.inHand('tissue'))
            + ' | not named at all: ' + JSON.stringify(silent.inHand('tissue')) + '\n');

        expect(told.inHand('tissue')).toBeNull();
        expect(missing.inHand('tissue')).toBeNull();
        // Not named is the one case where the active sample is still the run's: openers exist that never ask.
        expect(silent.inHand('tissue')).toEqual(TISSUE_120);
    });

    test('`none` is an answer: nothing is computed and nothing is substituted', () => {
        const r = runner('?rerun=r1&site=A&tissue=none', STORE, { tissue: TISSUE_120 });
        expect(r.named('tissue')).toBe('none');
        // Not the active one, and not the newest in the store either: a site with no tissue sample
        // stays without one.
        expect(r.readings('tissue')).toBeNull();
    });

    test('a named sample that is not in the store is an outcome, not a fallback', () => {
        const r = runner('?rerun=r1&site=A&tissue=999', STORE, { tissue: TISSUE_120 });
        expect(r.named('tissue')).toBe('not-found');
        expect(r.readings('tissue')).toBeNull();
    });

    test('no parameter at all leaves the old behaviour alone, because openers exist that never ask', () => {
        // The export and report pages open `/hub` with no sample parameters. Gating on a fact
        // nobody supplied is how a run waits for something nobody promised (GH-588's measurement).
        const r = runner('?rerun=r1&site=A', STORE, { tissue: TISSUE_120 });
        expect(r.named('tissue')).toBeNull();
        expect(r.readings('tissue')).toEqual({ N: 1.0, K: 1.0 });
    });

    test('soil travels the same road, so the two kinds cannot drift apart', () => {
        // GH-777: restored the way the product restores, so the key is the client's and the name is the row's.
        const soil = restoredFromTheServer({ id: 53, client_uid: 'Green 1', payload: {} }, { pH: 6 });
        const r = runner('?rerun=r1&site=A&soil=53&tissue=none', { soil: [soil] }, {});
        expect(soil.id).toBe('Green 1');
        expect(r.readings('soil')).toEqual({ pH: 6 });
    });
});

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
    vm.runInContext(namedSrc + '\n' + readingsSrc + '\n', sandbox);

    return {
        named: (kind) => vm.runInContext('gaip_namedSample(' + JSON.stringify(kind) + ')', sandbox),
        readings: (kind) => vm.runInContext('gaip_sampleReadings(' + JSON.stringify(kind) + ')', sandbox),
    };
}

const TISSUE_121 = { id: '121', readings: { N: 4.1, K: 2.2 } };
const TISSUE_120 = { id: '120', readings: { N: 1.0, K: 1.0 } };
const STORE = { tissue: [TISSUE_120, TISSUE_121] };

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
        const soil = { id: '53', readings: { pH: 6 } };
        const r = runner('?rerun=r1&site=A&soil=53&tissue=none', { soil: [soil] }, {});
        expect(r.readings('soil')).toEqual({ pH: 6 });
    });
});

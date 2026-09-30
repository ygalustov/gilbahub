'use strict';

/**
 * GH-777 (queue item 4, the analyst's answer of 29.09.2026) — A PASS IS REPEATED WHEN THE SAMPLES IT READS
 * CHANGE, AND THOSE ARE THE SAMPLES IT WAS NAMED.
 *
 * WHAT WAS MEASURED LIVE, 29.09.2026, on `Russley` and `Test5 - NZ`. The frame names its samples on the
 * address (`&tissue=142`), every reader asks `gaip_sampleInHand` for them, and the repeat of GH-589 asked
 * `getActiveSample` instead. A named sample never becomes active, so its arrival changed no fingerprint,
 * the repeat never fired, and the tissue engine ran exactly once -- on the first pass, while the store was
 * still empty. Both sites stored an empty tissue section with no cause at all: `computed.tissue = null`,
 * `detail.skipped = []`, nothing in `notApplicable`. That is the one outcome this queue item forbids.
 *
 * THE ANALYST'S DEVICE, and this file is its measurement: the fingerprint of a pass's inputs is built by
 * the same chooser the pass reads with. `not-found` is part of it on purpose -- a named sample the store
 * does not hold yet reads `tissue:not-found`, and its arrival makes the same expression read `tissue:142`.
 *
 * WHAT IS NOT TOUCHED, said so that a reader does not look for it: the budget, the cap of three repeats and
 * the triggering event are the same as before. Only the definition of "the inputs of this pass" changes.
 */

const fs = require('fs');
const path = require('path');
const vm = require('vm');

const ROOT = path.join(__dirname, '..');
const HUB = fs.readFileSync(path.join(ROOT, 'assets', 'hub-tissue-v3.js'), 'utf8');

/** One function of the product, by name, with its braces balanced. */
function lift(name) {
    const at = HUB.indexOf('function ' + name + '(');
    expect(at).toBeGreaterThan(-1);
    let depth = 0;
    for (let i = HUB.indexOf('{', at); i < HUB.length; i += 1) {
        if (HUB[i] === '{') depth += 1;
        else if (HUB[i] === '}') {
            depth -= 1;
            if (!depth) return HUB.slice(at, i + 1);
        }
    }
    throw new Error(name + ' never closes');
}

/**
 * The fingerprint as the product computes it, over a frame address and a store.
 *
 * The three functions are lifted from the product rather than restated: the chooser under test is the one
 * the readers call, and a bench with its own copy of it would agree with itself.
 */
function fingerprint({ search, store, active, noManager, throws }) {
    const sandbox = {
        URLSearchParams: require('url').URLSearchParams,
        console: { warn() {}, log() {} },
    };
    sandbox.window = sandbox;
    sandbox.global = sandbox;
    sandbox.location = { search };
    sandbox.GAIP_SampleManager = noManager ? null : {
        getSamples: (kind) => {
            if (throws) throw new Error('the store blew up');

            return (store || {})[kind] ? [store[kind]] : [];
        },
        getActiveSample: (kind) => {
            if (throws) throw new Error('the store blew up');

            return (active || {})[kind] || null;
        },
        readingsOf: (kind, sample) => (sample && sample.readings) || null,
    };
    vm.createContext(sandbox);
    ['gaip_namedSample', 'gaip_sampleInHand', 'gaip_passSampleIds']
        .forEach((name) => vm.runInContext(lift(name), sandbox, { filename: name }));

    return vm.runInContext('gaip_passSampleIds()', sandbox);
}

/**
 * GH-777: the store keys a sample by its own key and keeps the ROW ID in `serverId` — which is the name the
 * frame's address carries. A fixture keyed by the row id is a shape the product never produces.
 */
const TISSUE_142 = { id: 'sample_142', serverId: 142, readings: { N: 3.6, K: 2.4 } };
const TISSUE_120 = { id: 'uid-120', serverId: 120, readings: { N: 1.0, K: 1.0 } };

describe('GH-777 — the repeat of a pass follows the sample the run was named', () => {
    test('a named sample arriving after the first pass CHANGES the fingerprint, so the pass is repeated', () => {
        // The live case. First pass: the address names 142 and the store is empty.
        const first = fingerprint({ search: '?rerun=r1&site=A&soil=none&tissue=142', store: {} });
        // Then it arrives, and nothing else about the page changes.
        const second = fingerprint({
            search: '?rerun=r1&site=A&soil=none&tissue=142', store: { tissue: TISSUE_142 },
        });
        process.stdout.write('\n[gh777] first pass : ' + first + '\n[gh777] once it lands: ' + second + '\n');

        expect(first).toContain('tissue:not-found');
        expect(second).toContain('tissue:142');
        // Different fingerprints is what makes the repeat fire: repeats 0 -> 1.
        expect(second).not.toBe(first);
        // And a site told there is none keeps saying so, so its pass is NOT repeated for that kind.
        expect(first).toContain('soil:none');
        expect(second).toContain('soil:none');
    });

    test('with no store, and with a store that throws, the fingerprint says which it was', () => {
        /**
         * The two answers that are not a sample: a page with no sample manager at all, and a manager whose
         * read fails. Both are states of the PAGE, not of the site, and the fingerprint has to be able to say
         * so -- otherwise "no samples" and "could not look" compare equal and a repeat is decided on a
         * mistake. Neither branch had a case until now.
         */
        const noStore = fingerprint({ search: '?rerun=r1&site=A&tissue=142', store: {}, noManager: true });
        const broken = fingerprint({ search: '?rerun=r1&site=A&tissue=142', store: {}, throws: true });
        process.stdout.write('[gh777] no store : ' + noStore + '\n[gh777] it throws: ' + broken + '\n');

        /**
         * GH-781: the fingerprint carries a fourth component, the journal's answer about the PGR, so the
         * SAMPLE part of it is what these two answers are about. Split off by name rather than matched
         * loosely, so that a fingerprint which stopped saying `no-store` still fails here.
         */
        const samplePartOf = (fp) => fp.split('|pgr:')[0];
        expect(samplePartOf(noStore)).toBe('no-store');
        expect(samplePartOf(broken)).toBe('unreadable');
        // And neither is mistaken for a site whose samples are simply absent.
        expect(samplePartOf(noStore)).not.toBe('soil:-|water:-|tissue:-');
        expect(samplePartOf(broken)).not.toBe('soil:-|water:-|tissue:-');
        // The journal is a separate fact from the store, and both fingerprints still carry it.
        expect(noStore).toContain('pgr:');
        expect(broken).toContain('pgr:');
    });

    test('CONTROL: a change of the ACTIVE sample alone leaves the fingerprint alone', () => {
        /**
         * The analyst's control case, and it is what keeps this from being "repeat on anything that moves":
         * when the run was named a sample, whatever the page calls active is not an input of this pass. The
         * old fingerprint would have changed here and ordered a repeat on a sample the run does not read.
         */
        const named = { search: '?rerun=r1&site=A&tissue=142', store: { tissue: TISSUE_142 } };
        const withOneActive = fingerprint({ ...named, active: { tissue: TISSUE_120 } });
        const withAnother = fingerprint({ ...named, active: { tissue: TISSUE_142 } });
        process.stdout.write('[gh777] active 120 : ' + withOneActive + '\n[gh777] active 142 : '
            + withAnother + '\n');

        expect(withOneActive).toBe(withAnother);
        expect(withOneActive).toContain('tissue:142');
    });

    test('and with no sample named at all, the active one is still the pass\'s own', () => {
        // Openers exist that name nothing (GH-724). Then the active sample IS what the pass reads, and a
        // change of it is a change of the pass's inputs — which is the behaviour this had before.
        const before = fingerprint({ search: '?rerun=r1&site=A', active: {} });
        const after = fingerprint({ search: '?rerun=r1&site=A', active: { tissue: TISSUE_120 } });
        process.stdout.write('[gh777] unnamed, no active: ' + before
            + '\n[gh777] unnamed, one active : ' + after + '\n');

        expect(before).toContain('tissue:-');
        expect(after).toContain('tissue:120');
        expect(after).not.toBe(before);
    });
});

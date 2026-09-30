/**
 * GH-578 — THE PASS WAITS FOR THE SOIL SAMPLE, WITH A LIMIT, AND GOES ON.
 *
 * WHAT WAS MEASURED, inside the runner's own frame on 22.09.2026: at 144 ms
 * after the press the soil grid is empty AND the sample manager holds nothing;
 * both fill at 2,134 ms from one load; the cascade runs once, before that; the
 * result posts at 2,696 ms. The engine was handed no soil, answered with ten
 * rows of "NOT MEASURED", and the owner saw ten dashes where her lab values are.
 *
 * GH-577 moved the read from the page to the sample and changed nothing: both
 * sources are empty at the same instant. The defect is not WHERE the run reads,
 * it is WHEN it computes. `_siteSamplesReady` did not stop it because it is set
 * by an event announcing readiness, and the event fires before the manager holds
 * anything — a signal named as a fact, which is not the fact.
 *
 * THE DECISION, and whose it is: wait for the sample itself, up to the run's own
 * budget, then GO ON and record the soil as not computed with a reason. Taken by
 * the coordinator on 22.09.2026 and pending the owner's confirmation. Refusing
 * the whole run was the alternative and was rejected: the owner settled the same
 * shape for the weather — a stale cache is computed and signed, not refused —
 * and the third outcome exists for exactly this.
 *
 * ONE LIMIT IN A RUN. The wait uses the runner's `RUN_BUDGET_MS`, the same
 * fifteen seconds the weather is allowed (GH-545). A second constant here would
 * drift from it the way two copies of anything drift.
 *
 * *** WHAT THIS FILE DOES NOT PROVE, and it is the first thing to read. ***
 * The gate it measures sits in `triggerAutoRun`, which is the BACKUP auto-run
 * path. `auto-refresh.js:250` is the primary one and clicks the run button
 * itself, so a Re-run does not pass through this gate at all — measured on the
 * stand on 22.09.2026, after the gate was in the tree: the sample still arrived
 * at 2,179 ms and the result still posted at 2,762 ms with ten "NOT MEASURED"
 * rows. Every case below is true of the function and none of them is true of a
 * Re-run. Moving the wait to the door every path uses was tried and stalled the
 * run ("the run did not finish inside its time budget", nothing written), and
 * was reverted with the cause unestablished. LINK 4 IS NOT CLOSED.
 *
 * HOW IT BITES: remove the wait and the third case goes red — a pass with no
 * sample starts immediately. Remove the give-up and the second goes red — the
 * page waits forever. Give the wait its own number and the last case goes red.
 */

'use strict';

const vm = require('vm');
const { realReadingsOf } = require('./lib/sample-readings');
const fs = require('fs');
const path = require('path');

const ASSETS = path.join(__dirname, '..', 'assets');
const HUB = fs.readFileSync(path.join(ASSETS, 'hub-tissue-v3.js'), 'utf8');
const PERSIST = fs.readFileSync(path.join(ASSETS, 'hub-persistence.js'), 'utf8');

/** `samples` id 141, as the manager would hold it. */
const SAMPLE_141 = { K: 40, P: 40, Ca: 803, Mg: 129, S: 75, pH: 6, CEC: 5.9 };

function slice(src, name) {
    const at = src.indexOf('function ' + name + '(');
    expect(at).toBeGreaterThan(-1);
    let depth = 0;
    for (let j = src.indexOf('{', at); j < src.length; j++) {
        if (src[j] === '{') depth++;
        else if (src[j] === '}') { depth--; if (!depth) return src.slice(at, j + 1); }
    }
    throw new Error('unbalanced ' + name);
}

/**
 * The gate, lifted out of the real file and driven with a clock we control.
 * `triggerAutoRun` is stubbed: what matters here is whether the gate lets a run
 * through, not what the run then does.
 */
function makeGate({ sample, budget = 15000 }) {
    let now = 1000;
    const timers = [];
    const calls = { retries: 0, skipped: [], problems: [], triggered: 0, notes: [] };

    const sandbox = {
        console: { log() {}, warn() {}, error() {} },
        Date: { now: () => now },
        Object, Array, String, Number, parseFloat, isNaN,
        setTimeout: (fn, ms) => { timers.push({ fn, at: now + ms }); calls.retries++; return timers.length; },
        clearTimeout: () => {},
        triggerAutoRun: () => { calls.triggered++; },
        _gaipSoilWaitStartedAt: 0,
        _gaipSoilWaitRetry: null,
    };
    sandbox.window = sandbox;
    sandbox.global = sandbox;
    sandbox.globalThis = sandbox;
    sandbox.GilbaPersistence = budget === null ? {} : { RUN_BUDGET_MS: budget };
    // GH-600 — THE BENCH HANDS THE PRODUCT'S OWN READER.
    //
    // GH-595 made these fixtures carry `normalized` as well as `rawData`, on
    // the grounds that a sample the store has loaded carries both and the bench
    // was less real than the run. That was true and it was the wrong repair:
    // THE DEFECT WAS IN THE PRODUCT, not here. The gate read
    // `normalized || rawData || values`, and `normalized` is set on every path
    // that creates a sample, so the other two branches were unreachable and a
    // fixture shaped "only `rawData`" described a case that does not exist.
    // Two of those would have fixed the fiction in place.
    //
    // The gate asks the declared reader now, so the bench hands it the real
    // one — `tests/lib/sample-readings.js` — and the fixtures are lab rows,
    // which is what a sample actually carries.
    sandbox.GAIP_SampleManager = {
        readingsOf: realReadingsOf(),
        getActiveSample: (t) => (t === 'soil' && sample
            ? { id: 'sample_141', rawData: sample }
            : null),
    };
    sandbox.GaipOrchestrator = {
        noteSkipped: (...a) => calls.skipped.push(a),
        recordProblem: (...a) => calls.problems.push(a),
        // GH-612: the third channel, and the one that carries the fact without
        // carrying a sentence. `note` is level `info`, which the panel does not
        // print, so what is filed here reaches a reader of the record and not
        // the client.
        note: (...a) => calls.notes.push(a),
    };

    const ctx = vm.createContext(sandbox);
    /**
     * GH-777 (queue item 4, slice 3) — THE GATE'S READERS ARE THE PRODUCT'S, cut from the same file.
     *
     * The gate no longer asks the sample manager for the ACTIVE sample: a run is given its sample by name on
     * the frame's address, and it asks `gaip_sampleReadings` -- the one reader the engine's own body and the
     * pass's gate both ask -- plus `gaip_sampleInHand` for the third state of GH-612. A bench that left
     * those out would be measuring a gate with no reader at all, which is what it measured for four cases
     * the moment they were introduced: `has` fell to false and every wait began.
     */
    ['gaip_namedSample', 'gaip_sampleInHand', 'gaip_sampleReadings'].forEach((name) => {
        vm.runInContext(slice(HUB, name), ctx, { filename: name });
        expect(typeof ctx[name]).toBe('function');
    });
    vm.runInContext(slice(HUB, '_gaipSoilSampleReadyOrGivenUp'), ctx, { filename: 'gate' });
    expect(typeof ctx._gaipSoilSampleReadyOrGivenUp).toBe('function');

    return {
        gate: () => ctx._gaipSoilSampleReadyOrGivenUp(),
        advance: (ms) => { now += ms; },
        calls, ctx,
    };
}

describe('GH-578 — the pass waits for the sample, then goes on', () => {
    test('the sample is there: the pass starts at once', () => {
        const g = makeGate({ sample: SAMPLE_141 });
        expect(g.gate()).toBe(true);
        expect(g.calls.retries).toBe(0);
        expect(g.ctx.GAIP_SOIL_SAMPLE_UNAVAILABLE).toBeUndefined();
    });

    test('GH-600: a sample IS there and carries no reading the map knows', () => {
        // THE THIRD STATE, and until now it wore the second one's face. A lab
        // row whose column headings the map does not recognise normalises to
        // nothing, so the gate — which used to read the derived copy — said
        // "not arrived" about a sample that HAD arrived. The run then waited
        // for it and failed with `soil-sample-not-delivered`, and that reason
        // is not true: it was delivered, it was not understood. Delivered and
        // unreadable is its own state, and collapsing it into "did not arrive"
        // is exactly what GH-588 was built to stop.
        //
        // GH-612 — AND THE HALF THAT NEEDED NO WORDS IS NOW SETTLED. The gate
        // still ANSWERS the same thing, because answering differently would
        // change what a person reads and that wording has one author who has
        // not written it. What changed is the record: when the budget runs out
        // the gate files WHICH of the two states it was, as a `note` — level
        // `info`, which the panel does not print.
        const g = makeGate({ sample: { Potassium_as_K_Mehlich: '40', Note: 'see attached' } });

        // Nothing the declared reader recognises — proved against the reader
        // itself rather than asserted.
        expect(Object.keys(realReadingsOf()('soil', { values: { Potassium_as_K_Mehlich: '40' } })))
            .toEqual([]);
        // ...so the gate holds, exactly as it does for a sample that is absent.
        expect(g.gate()).toBe(false);
        expect(g.calls.retries).toBe(1);

        /**
         * GH-781 (delivery 5): past the budget the gate STEPS ASIDE and says nothing. The record that used
         * to be written from here — which of the two states it was — is written by the pass now, under the
         * cascade's name, because the run's wait is not a pass: unnamed entries were removed by the
         * orchestrator's next pass, and once the journal began refusing unnamed writers this fact stopped
         * being written at all. The two states are still two records, and they are measured where they are
         * written: `gh781-a-producer-that-names-itself-is-also-cleared-by-itself.test.js`.
         *
         * WHAT THIS CASE STILL HOLDS is what it is named for: the gate waits, then goes on.
         */
        g.advance(20000);
        expect(g.gate()).toBe(true);
        expect(g.calls.notes).toEqual([]);

        // THE CONTROL, and it is still the point: the same run WITHOUT a sample reaches the same place by
        // the same route, so "it waited and went on" is not confused with "it never waited".
        const none = makeGate({ sample: null });
        expect(none.gate()).toBe(false);
        none.advance(20000);
        expect(none.gate()).toBe(true);
        /**
         * GH-781 (delivery 5): both states used to be told apart HERE, by two notes from the run's wait.
         * They are told apart by the pass now — "named and not in the store" against "in the store with no
         * reading the map knows" — under the cascade's name, which is the producer whose cleanup exists. So
         * what this file holds about them is that the gate itself files neither, and the distinction is
         * measured where it is drawn.
         */
        expect(none.calls.notes).toEqual([]);
        expect(none.calls.skipped).toEqual([]);
        expect(none.calls.problems).toEqual([]);
    });

    test('GH-600: the branches the gate could never take are gone', () => {
        // `normalized` is set on EVERY path that creates a sample
        // (`sample-manager.js`), so `normalized || rawData || values` had one
        // reachable branch and two dead ones, and a fixture shaped "only
        // rawData" described a case that does not exist. Read off the product,
        // because the claim is about what the gate no longer consults.
        const src = fs.readFileSync(path.join(ASSETS, 'hub-tissue-v3.js'), 'utf8');
        const at = src.indexOf('function _gaipSoilSampleReadyOrGivenUp');
        expect(at).toBeGreaterThan(-1);
        // Comments are stripped first: the block above EXPLAINS the branches
        // it removed and names them, and a check that reads prose as code goes
        // red on its own explanation. Measured the hard way twice in this tree.
        const body = src.slice(at, src.indexOf('function triggerAutoRun', at))
            .replace(/\/\*[\s\S]*?\*\//g, '')
            .split('\n').filter((l) => !/^\s*\/\//.test(l)).join('\n');
        /**
         * GH-777 (queue item 4, slice 3): THE DECLARED READER IS NOW A FUNCTION, NOT A CALL ON THE MANAGER.
         *
         * The claim is unchanged -- the gate consults the declared reader and nothing derived or lossy -- and
         * what the declared reader IS has moved: `gaip_sampleReadings("soil")`, which the engine's own body
         * and the pass's gate ask as well, and which asks `SM.readingsOf` inside. Asserting the old spelling
         * would be asserting the place of a call rather than what the gate rests on, and the gate rests on
         * the run's OWN sample now instead of whatever the page has selected.
         */
        expect(body).toContain('gaip_sampleReadings("soil")');
        expect(body).not.toMatch(/active\.normalized/);
        expect(body).not.toMatch(/getActiveSample\s*\(\s*"soil"\s*\)/);
    });

    test('THE LIVE CASE: no sample yet, the pass holds and tries again', () => {
        // The 2,134 ms window measured on the stand, where the run used to go
        // ahead with nothing.
        const g = makeGate({ sample: null });
        expect(g.gate()).toBe(false);
        expect(g.calls.retries).toBe(1);
        // and it is a WAIT, not a refusal: something is scheduled to try again
        expect(g.ctx.GAIP_SOIL_SAMPLE_UNAVAILABLE).toBeUndefined();
        expect(g.calls.skipped).toEqual([]);
    });

    test('the sample arrives during the wait: the pass starts with it', () => {
        const g = makeGate({ sample: null });
        expect(g.gate()).toBe(false);
        g.ctx.GAIP_SampleManager.getActiveSample = () => ({ id: 'sample_141', rawData: SAMPLE_141 });
        g.advance(2134);
        expect(g.gate()).toBe(true);
        expect(g.ctx.GAIP_SOIL_SAMPLE_UNAVAILABLE).toBeUndefined();
    });

    test('the limit is up: the pass goes on, and says what it is going on without', () => {
        // Not a refusal of the whole run. The soil is named as not computed, so
        // the server's third outcome does the rest — partial, with a reason, and
        // the previous numbers not replaced.
        const g = makeGate({ sample: null });
        expect(g.gate()).toBe(false);
        g.advance(15001);
        expect(g.gate()).toBe(true);

        expect(g.ctx.GAIP_SOIL_SAMPLE_UNAVAILABLE).toBe(true);
        /**
         * GH-781 (delivery 5): the naming of what was not computed moved into the pass, for the reason given
         * in the case above. The flag this gate sets is what the rest of the run reads, and it is still set
         * here; the journal entry is the pass's and is measured in the pass's own file.
         */
        expect(g.calls.skipped).toEqual([]);
        expect(g.calls.problems).toEqual([]);
    });

    test('one second before the limit it is still waiting', () => {
        // The boundary, from both sides, so "goes on" cannot quietly become
        // "goes on immediately".
        const g = makeGate({ sample: null });
        g.gate();
        g.advance(14999);
        expect(g.gate()).toBe(false);
        g.advance(2);
        expect(g.gate()).toBe(true);
    });

    test('no runner on the page: no wait, and no second limit invented here', () => {
        // `/hub` opened as an ordinary page has no run budget to share. The gate
        // does not make one up — it steps aside.
        const g = makeGate({ sample: null, budget: null });
        expect(g.gate()).toBe(true);
        expect(g.calls.retries).toBe(0);
        expect(g.ctx.GAIP_SOIL_SAMPLE_UNAVAILABLE).toBeUndefined();
    });

    test('there is ONE limit, and it is the runner’s', () => {
        // Structural, over both files: the number lives in `hub-persistence.js`
        // and is published; `hub-tissue-v3.js` reads it and declares no number
        // of its own. Two limits in one run drift the way two copies of a
        // threshold drifted before `ClassificationConstants`.
        expect(PERSIST).toMatch(/var RUN_BUDGET_MS = 15000;/);
        expect(PERSIST).toMatch(/GilbaPersistence\.RUN_BUDGET_MS = RUN_BUDGET_MS;/);

        const gate = slice(HUB, '_gaipSoilSampleReadyOrGivenUp');
        expect(gate).toMatch(/window\.GilbaPersistence && window\.GilbaPersistence\.RUN_BUDGET_MS/);
        // and no literal duration of its own beyond the retry interval
        const numbers = (gate.match(/\b\d{4,}\b/g) || []);
        expect(numbers).toEqual([]);
    });

    test('the gate stands in front of the run, not behind it', () => {
        // It must be consulted BEFORE `_autoRunFired` latches, or a pass that
        // held would be counted as fired and never retried.
        const fn = slice(HUB, 'triggerAutoRun');
        const gateAt = fn.indexOf('_gaipSoilSampleReadyOrGivenUp()');
        const latchAt = fn.indexOf('_autoRunFired = true');
        expect(gateAt).toBeGreaterThan(-1);
        expect(latchAt).toBeGreaterThan(gateAt);
    });
});

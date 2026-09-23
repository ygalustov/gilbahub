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
    const calls = { retries: 0, skipped: [], problems: [], triggered: 0 };

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
    sandbox.GAIP_SampleManager = {
        getActiveSample: (t) => (t === 'soil' && sample ? { rawData: sample } : null),
    };
    sandbox.GaipOrchestrator = {
        noteSkipped: (...a) => calls.skipped.push(a),
        recordProblem: (...a) => calls.problems.push(a),
    };

    const ctx = vm.createContext(sandbox);
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
        g.ctx.GAIP_SampleManager.getActiveSample = () => ({ rawData: SAMPLE_141 });
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
        expect(g.calls.skipped).toEqual([['mlsn', 'mlsn', 'soil-sample-not-loaded', 'mlsn']]);
        expect(g.calls.problems[0][0]).toBe('mlsn');
        expect(g.calls.problems[0][1]).toMatch(/did not arrive inside the run budget/);
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

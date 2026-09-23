/**
 * GH-597 — AN APPLICATION OLDER THAN THE WINDOW IS AN ANSWER, NOT AN ABSENCE.
 *
 * MEASURED ON THE STAND, 23.09.2026, and it is why this exists. Two sites carry
 * a growth-regulator application date and their stored rows differ: `Russley`
 * applied 65 days ago and its row holds a PGR result; `Burns` applied 99 days
 * ago and its row holds `null`. Same configuration fields, same live weather,
 * same journal, no skip recorded by either. Nothing in the row told the two
 * apart, so a person cannot tell "no regulator is set here" from "one is set,
 * and too long ago to still be acting".
 *
 * THE WINDOW IS A PRODUCT DECISION, not a limitation. The owner settled it the
 * same day — ninety days is a deliberate choice, in her words — and declined
 * the alternative of accumulating from the application date whatever its age.
 * So the run is
 * COMPLETE and the exhausted effect is its answer: an `info` note, never a skip,
 * because a skip would make every such run partial and call a correct answer a
 * gap.
 *
 * WHAT THIS FILE DOES NOT ASSERT, said plainly: the sentence a person reads.
 * Texts about what a run could not do have one owner, and writing one here
 * would be the second author this question has spent its time removing. Until
 * that source exists the fact travels in the run's account and no screen states
 * it — so there is nothing here about wording, and its absence is deliberate
 * rather than forgotten.
 */

'use strict';

const vm = require('vm');
const fs = require('fs');
const path = require('path');

const ASSETS = path.join(__dirname, '..', 'assets');
const HUB = fs.readFileSync(path.join(ASSETS, 'hub-tissue-v3.js'), 'utf8');

/** The window the product looks back over, read from the product. */
function windowDays() {
    const m = /var GAIP_PGR_HISTORY_WINDOW_DAYS = (\d+);/.exec(HUB);
    expect(m).not.toBeNull();
    return Number(m[1]);
}

/**
 * The run's decision about a PGR application, executed.
 *
 * The block lives inside the run button's handler, which needs a page. It is
 * lifted out by its own anchors and run with a state carrying one application
 * date, so what is measured is the decision and not a page.
 */
function decideFor(daysAgo) {
    const start = HUB.indexOf('var i = Math.ceil((n - r) / 864e5);');
    expect(start).toBeGreaterThan(-1);
    const end = HUB.indexOf('var a = await gaip_fetch_weather(t);', start);
    expect(end).toBeGreaterThan(start);
    const body = HUB.slice(start, end).replace(/\}\s*\}\s*$/, '');

    const notes = [];
    const applied = new Date();
    applied.setHours(0, 0, 0, 0);
    applied.setDate(applied.getDate() - daysAgo);

    const sandbox = {
        console: { log() {}, warn() {} },
        Date, Math, JSON, Object, Number, String, parseFloat, isNaN,
        GAIP_PGR_HISTORY_WINDOW_DAYS: windowDays(),
        t: { pgr: { applicationDate: applied.toISOString().slice(0, 10) }, climate: {} },
        r: applied,
        n: (() => { const d = new Date(); d.setHours(0, 0, 0, 0); return d; })(),
    };
    sandbox.window = sandbox; sandbox.global = sandbox; sandbox.globalThis = sandbox;
    sandbox.GaipOrchestrator = { note: (...a) => notes.push(a) };

    const ctx = vm.createContext(sandbox);
    vm.runInContext(body, ctx, { filename: 'pgr-window' });

    return { notes, historical: ctx.t.climate.historical || {}, daysAgo };
}

describe('GH-597 — the window is named, and what it cannot reach is said', () => {
    test('the window is a named number, not a literal at the point of use', () => {
        // The positive control for every case below: the block is reached, and
        // the number it uses is the one this file read out of the product.
        expect(windowDays()).toBeGreaterThan(0);
        expect(HUB).toContain('Math.min(i + 7, _pgrWindowDays)');
    });

    test('an application INSIDE the window: the history reaches it, and nothing is said', () => {
        const w = windowDays();
        const d = decideFor(w - 25);

        // The run asked for history that reaches back past the application.
        expect(d.historical.enabled).toBe(true);
        expect(d.historical.lookbackDays).toBeGreaterThanOrEqual(d.daysAgo);
        // And there is nothing to explain: the effect is computable.
        expect(d.notes).toEqual([]);
    });

    test('an application BEYOND the window: the history cannot reach it, and the run says so', () => {
        const w = windowDays();
        const d = decideFor(w + 9);

        // The window is capped, so it stops short of the application.
        expect(d.historical.lookbackDays).toBe(w);
        expect(d.historical.lookbackDays).toBeLessThan(d.daysAgo);

        // THE DISTINCTION, which is the whole point: the run's account now
        // carries the fact, so "no regulator set" and "set, and too long ago"
        // are no longer the same silence.
        expect(d.notes).toHaveLength(1);
        const [module, message, data] = d.notes[0];
        expect(module).toBe('pgr');
        expect(data).toEqual({ daysSinceApplication: d.daysAgo, windowDays: w });
        // The message names both numbers, so the account is readable without
        // the reader knowing the window.
        expect(message).toContain(String(d.daysAgo));
        expect(message).toContain(String(w));
    });

    test('it is a NOTE and never a skip — the run stays complete', () => {
        // A skip makes the server call the run partial (GH-557). An exhausted
        // effect is the right answer, and calling it a gap would turn every
        // such run partial and put a correct result under a heading that says
        // something is missing.
        const notes = [];
        const skips = [];
        const w = windowDays();

        const start = HUB.indexOf('var i = Math.ceil((n - r) / 864e5);');
        const end = HUB.indexOf('var a = await gaip_fetch_weather(t);', start);
        const body = HUB.slice(start, end).replace(/\}\s*\}\s*$/, '');

        const applied = new Date();
        applied.setHours(0, 0, 0, 0);
        applied.setDate(applied.getDate() - (w + 40));

        const sandbox = {
            console: { log() {}, warn() {} },
            Date, Math, JSON, Object, Number, String, parseFloat, isNaN,
            GAIP_PGR_HISTORY_WINDOW_DAYS: w,
            t: { pgr: { applicationDate: applied.toISOString().slice(0, 10) }, climate: {} },
            r: applied,
            n: (() => { const d = new Date(); d.setHours(0, 0, 0, 0); return d; })(),
        };
        sandbox.window = sandbox; sandbox.global = sandbox; sandbox.globalThis = sandbox;
        sandbox.GaipOrchestrator = {
            note: (...a) => notes.push(a),
            noteSkipped: (...a) => skips.push(a),
            recordProblem: (...a) => skips.push(['recordProblem', ...a]),
        };
        vm.runInContext(body, vm.createContext(sandbox), { filename: 'pgr-window' });

        expect(notes).toHaveLength(1);
        expect({ skipsOrProblemsRecorded: skips }).toEqual({ skipsOrProblemsRecorded: [] });
    });

    test('the orchestrator offers the third kind of entry at all', () => {
        // Without a public `note` the fact above has nowhere to go: the journal
        // used to offer only `recordProblem` (which calls a correct answer
        // trouble) and `noteSkipped` (which makes the run partial).
        const orch = fs.readFileSync(path.join(ASSETS, 'hub-orchestrator.js'), 'utf8');
        const api = orch.slice(orch.indexOf('recordProblem: function'));
        expect(api).toMatch(/\n    note: function \(module, message, data\) \{/);
    });
});

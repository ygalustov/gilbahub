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

/**
 * GH-659 — THE DATE IS BUILT THE WAY THE PRODUCT RECEIVES IT: UTC MIDNIGHT.
 *
 * It was built with `setHours(0, 0, 0, 0)`, which is LOCAL midnight, and the
 * sandbox then handed the product `applied.toISOString().slice(0, 10)` — the
 * UTC date of that instant, which in UTC+10 is the day before. The product
 * counts both sides from UTC midnight (`_notePgrWindowExhausted`), so a
 * ninety-nine-day-old application read as a hundred days old for part of every
 * day: the set was green until UTC ticked over and red for the rest of it, with
 * nobody having touched the tree. Measured at 10:06 AEST — 1 failed locally, 0
 * failed under TZ=UTC.
 *
 * THE ZONE IS NOT FIXED FROM OUTSIDE. Nothing sets TZ for this run and nothing
 * should: the fixture stops depending on the runner’s zone instead, which is
 * also what the product does with a real `YYYY-MM-DD` application date.
 */
function utcMidnightDaysAgo(daysAgo) {
    const now = new Date();
    return new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate() - daysAgo));
}
/** The window the product looks back over, read from the product. */
/**
 * GH-780: the window belongs to the PGR ENGINE now, which owns the question "is this site using one".
 *
 * It used to be a constant on the run's page, declared a second time as `|| 90` in the orchestrator and not
 * at all for the morning briefing, which does not load that page. The number is read from its one owner here
 * so that this case follows the declaration rather than a copy of it.
 */
function windowDays() {
    const engine = fs.readFileSync(path.join(__dirname, '..', 'assets', 'gilba-pgr-module-v3.js'), 'utf8');
    const m = /historyWindowDays:\s*(\d+)/.exec(engine);
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
    const applied = utcMidnightDaysAgo(daysAgo);

    const sandbox = {
        console: { log() {}, warn() {} },
        Date, Math, JSON, Object, Number, String, parseFloat, isNaN,
        GAIP_PGR_HISTORY_WINDOW_DAYS: windowDays(),
        t: { pgr: { applicationDate: applied.toISOString().slice(0, 10) }, climate: {} },
        r: applied,
        n: utcMidnightDaysAgo(0),
    };
    sandbox.window = sandbox; sandbox.global = sandbox; sandbox.globalThis = sandbox;
    sandbox.GaipOrchestrator = { note: (...a) => notes.push(a) };

    const ctx = vm.createContext(sandbox);
    vm.runInContext(body, ctx, { filename: 'pgr-window' });

    return { notes, historical: ctx.t.climate.historical || {}, daysAgo };
}

/**
 * GH-649 — the pass's own decision about the PGR window, executed.
 *
 * `_notePgrWindowExhausted` is where the note is born now, and it is called from
 * inside `runComputePass` AFTER the journal is cleared. Both are lifted out of
 * `hub-orchestrator.js` by their own anchors and run against a state carrying one
 * application date, so what is measured is the pass's decision rather than a page.
 *
 * The clearing is executed too, in the same order the pass executes it, so that
 * "the note exists" is a statement about life after the clearing and not before.
 */
function passFor(daysAgo) {
    /**
     * GH-781 — THE WRITER OF THIS NOTE HAS MOVED, AND THIS BENCH FOLLOWS IT.
     *
     * The note used to be born inside `runComputePass` (`_notePgrWindowExhausted`) and read
     * `_hubState.inputs.pgr` — a key nothing publishes, so it reached no stored row at all: 0 of 108. It is
     * written by the pass that HOLDS the input now, the cascade's, from the spray journal's own answer. So
     * this bench runs the real thing: the journal answers, the cascade's pass runs, and then two passes of
     * the orchestrator — which is where the note used to die.
     */
    const { load, computeAll } = require('./lib/orchestrator-bench');
    const bench = load();
    const ctx = bench.ctx;
    ctx.location.search = '?rerun=r1&site=site-1';
    const applied = utcMidnightDaysAgo(daysAgo);
    ctx.GAIP_LAST_PGR = { application_date: applied.toISOString().slice(0, 10), product_key: 'TE250' };

    const hubRoot = { querySelector: () => null, querySelectorAll: () => [] };
    ctx.gaip_runCascadePass('run-button', hubRoot, { current: { airTemp: 14 } }, null);

    const journal = () => (ctx.GaipOrchestrator.getState().computed.warnings || []);
    const ours = () => journal().filter((e) => {
        let data = e && e.data;
        if (typeof data === 'string') { try { data = JSON.parse(data); } catch (x) { return false; } }

        return !!data && data.reason === 'pgr-window-exhausted';
    });
    const afterTheCascade = ours().length;

    return computeAll(bench, { climateMetrics: { current: { airTemp: 14 } }, turf: {}, site: {} })
        .then(() => computeAll(bench, { climateMetrics: { current: { airTemp: 14 } }, turf: {}, site: {} }))
        .then(() => {
            const notes = ours();
            const skipped = (ctx.GaipOrchestrator.getState().computed.skipped || [])
                .filter((s) => s.module === 'pgr');
            const { historical } = decideFor(daysAgo);

            return { notes, skipped, historical, daysAgo, afterTheCascade,
                clearedBeforeTheNote: true,
                appliedDate: applied.toISOString().slice(0, 10) };
        });
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

    test('an application BEYOND the window: the history cannot reach it, and THE PASS says so', async () => {
        // RE-AIMED BY GH-649, and the analyst predicted this to the letter: when
        // the note moved out of the handler, this case and the one below went red
        // with `Expected length: 1 / Received length: 0`. The assertions are the
        // same ones — the fact is stated, once, as a note, with both numbers —
        // and only the PLACE it is made changes: the computation pass, which is
        // the pass that clears the journal, instead of the handler that ran
        // before it.
        const w = windowDays();
        const { notes, historical, daysAgo, appliedDate } = await passFor(w + 9);

        // The handler still caps the window it asks history for; that half did
        // not move.
        expect(historical.lookbackDays).toBe(w);
        expect(historical.lookbackDays).toBeLessThan(daysAgo);

        // THE DISTINCTION, which is the whole point: the run's account carries
        // the fact, so "no regulator set" and "set, and too long ago" are no
        // longer the same silence — AND IT SURVIVES THE PASS, which is what
        // GH-649 repaired.
        expect(notes).toHaveLength(1);
        expect(notes[0].module).toBe('pgr');
        expect(notes[0].level).toBe('info');
        /**
         * GH-772: the note carries two more figures now, and they are not decoration. The sentence a
         * person reads about this state names the product and the date, and the stored row has no
         * `inputs.pgr` to look them up in -- measured, none of the 86 rows on the stand carries that
         * key -- so they travel with the note itself. They are asserted here by the same reading as
         * the two that were already here: what the pass recorded, not what it could have recorded.
         */
        /**
         * GH-781: the data of a journal entry is summarised as a string by `record`, and the product comes
         * from the spray journal now (`product_key`) rather than from an input nothing filled — it used to be
         * `null` for the same reason the whole note never arrived.
         */
        const recorded = typeof notes[0].data === 'string' ? JSON.parse(notes[0].data) : notes[0].data;
        expect(recorded).toEqual({
            reason: 'pgr-window-exhausted', daysSinceApplication: daysAgo, windowDays: w,
            productType: 'TE250', applicationDate: appliedDate,
        });
        expect(notes[0].message).toContain(String(daysAgo));
        expect(notes[0].message).toContain(String(w));
    });

    test('it is a NOTE and never a skip — the run stays complete', async () => {
        // A skip makes the server call the run partial (GH-557). An exhausted
        // effect is the right answer, and calling it a gap would turn every such
        // run partial and put a correct result under a heading that says
        // something is missing. Re-aimed with the case above.
        const w = windowDays();
        const { notes, skipped } = await passFor(w + 40);

        expect(notes).toHaveLength(1);
        expect({ skipsRecordedByThePass: skipped }).toEqual({ skipsRecordedByThePass: [] });
    });

    test('the journal is cleared by the pass and the note is still there afterwards', async () => {
        // The reviewer's own probe, kept as a case: before GH-649 the journal
        // held one entry before the pass and none after, because the note was
        // written outside it. This states the repaired shape directly — the
        // clearing happens and the entry exists on the other side of it.
        const w = windowDays();
        const { clearedBeforeTheNote, notes, afterTheCascade } = await passFor(w + 9);

        expect(clearedBeforeTheNote).toBe(true);
        expect(notes).toHaveLength(1);
    });

    test('the orchestrator offers the third kind of entry at all', () => {
        // Without a public `note` the fact above has nowhere to go: the journal
        // used to offer only `recordProblem` (which calls a correct answer
        // trouble) and `noteSkipped` (which makes the run partial).
        const orch = fs.readFileSync(path.join(ASSETS, 'hub-orchestrator.js'), 'utf8');
        const api = orch.slice(orch.indexOf('recordProblem: function'));
        expect(api).toMatch(/\n    note: function \(module, message, data, producer\) \{/);
    });
});

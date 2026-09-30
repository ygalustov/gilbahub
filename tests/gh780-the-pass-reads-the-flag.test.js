'use strict';

/**
 * GH-780 (the analyst's answer of 30.09.2026) — THE PGR FLAG IS PRODUCED WHERE THE PASS READS IT, AND IT
 * REACHES THE SHADE ADVICE OF A STORED ROW.
 *
 * WHAT THE LIVE RUN SHOWED, and no offline case did. The first form of this repair worked the flag out in
 * `gaip_transformToCascadeFormat`, which is the CASCADE's door. The shade advice that reaches a stored row
 * comes from the ORCHESTRATOR's pass, and that pass reads `GAIP_STATE.turf` — the state assembled by
 * `gaip_build_state`. So on `Russley`, seventy-one days after its application, the row said
 * `pgrGuidance.currentlyActive: false` both before the repair and after it, for the same reason:
 * `shade-engine-pure.js` turns an absent flag into `false`.
 *
 * SO THIS FILE MEASURES THE ORDER THAT ACTUALLY RUNS: the state is assembled from the journal's answer, the
 * orchestrator's pass computes on it, and the assertion is on `computed.shade` — the thing that is stored.
 *
 * AND THE PUBLISH IS MEASURED TOO. When the run publishes its state it merges the fresh `inputs.turf` OVER
 * the local snapshot (b35fix391), so keys of the previous pass win. That is right for the routed writes it
 * was built for and wrong for this flag, which belongs to the run that just computed: two passes in one
 * frame, with an application recorded between them, would have stored the older answer.
 */

const fs = require('fs');
const path = require('path');
const vm = require('vm');

const { load, computeAll } = require('./lib/orchestrator-bench');

const ROOT = path.join(__dirname, '..');
const HUB = fs.readFileSync(path.join(ROOT, 'assets', 'hub-tissue-v3.js'), 'utf8');

/** Whole days before the fixed day these cases are written against. */
const daysAgo = (n) => new Date(Date.UTC(2026, 8, 30 - n)).toISOString().slice(0, 10);

const CLIMATE = { current: { airTemp: 18, soilTemp: 16 }, gp: { c3: 0.7 } };
const TURF = { turfType: 'greens', species: 'bentgrass' };

/**
 * One run in the order the product runs it: the state is assembled from the page and the journal, the
 * orchestrator's pass computes on that state, and what comes back is what a row would carry.
 */
async function runWithJournal(lastPGR) {
    const bench = load();
    const ctx = bench.ctx;
    ctx.location.search = '?rerun=r1&site=site-1';
    if (lastPGR !== undefined) ctx.GAIP_LAST_PGR = lastPGR;
    const hubRoot = { querySelector: () => null, querySelectorAll: () => [] };

    const assembled = ctx.gaip_build_state(hubRoot);
    const out = await computeAll(bench, {
        climateMetrics: CLIMATE,
        turf: Object.assign({}, TURF, assembled.turf || {}),
        site: {},
    });
    const shade = (out.state.computed && out.state.computed.shade) || null;
    const guidance = (shade && shade.modular && shade.modular.pgrGuidance) || null;

    process.stdout.write('[gh780] journal ' + JSON.stringify(lastPGR)
        + ' -> state.turf.pgrActive ' + JSON.stringify(assembled.turf.pgrActive)
        + ' -> shade says ' + JSON.stringify(guidance && {
            currentlyActive: guidance.currentlyActive, conflictDetected: guidance.conflictDetected,
        }) + '\n');

    return { assembled: assembled.turf.pgrActive, guidance, threw: out.threw };
}

describe('GH-780 — in the real order of passes, the shade advice carries the journal’s answer', () => {
    test('POSITIVE CONTROL: the pass reaches the shade advice at all', async () => {
        // Without this, every "false" below could be a pass that never computed shade.
        const { guidance, threw } = await runWithJournal({ application_date: daysAgo(71) });

        expect(threw).toBeNull();
        expect(guidance).not.toBeNull();
        expect(typeof guidance.currentlyActive).not.toBe('undefined');
    });

    test('71 days — `Russley`’s own case, the one the stand reported false twice', async () => {
        const { assembled, guidance } = await runWithJournal({ application_date: daysAgo(71) });

        expect(assembled).toBe(true);
        expect(guidance.currentlyActive).toBe(true);
    });

    test('105 days — outside the window: not in use, and said so rather than left unknown', async () => {
        const { assembled, guidance } = await runWithJournal({ application_date: daysAgo(105) });

        expect(assembled).toBe(false);
        expect(guidance.currentlyActive).toBe(false);
    });

    test('the journal answered and there is no application — not in use', async () => {
        const { assembled, guidance } = await runWithJournal(null);

        expect(assembled).toBe(false);
        expect(guidance.currentlyActive).toBe(false);
    });

    test('TWO PASSES IN ONE FRAME: the answer of the pass that just ran is the one published', () => {
        /**
         * The analyst's pitfall, made a case. The publish merges the fresh `inputs.turf` over the local
         * snapshot, so a key of the PREVIOUS pass wins — which is what b35fix391 was built for and what must
         * not happen to this flag. The merge is lifted from the product rather than restated, so a change to
         * it is a change to this case.
         */
        const at = HUB.indexOf('var _b35fix391_freshTurf =');
        expect(at).toBeGreaterThan(-1);
        const end = HUB.indexOf('(xe ?', at);
        expect(end).toBeGreaterThan(at);
        const merge = HUB.slice(at, end);
        // The flag must be named in the merge as one where the fresh pass wins.
        expect(merge).toMatch(/pgrActive/);

        const box = { Object, JSON, console: { warn() {}, log() {} } };
        box.window = box;
        box.global = box;
        vm.createContext(box);
        // The previous pass concluded "in use" and left it in the published state; this pass, run after an
        // application fell out of the window, concluded "not in use".
        box.window.GAIP_STATE = { inputs: { turf: { turfType: 'greens', pgrActive: true } } };
        box.t = { turf: { turfType: 'greens', pgrActive: false } };
        vm.runInContext(merge + '\nresult = _b35fix391_mergedTurf;', box, { filename: 'the publish merge' });
        process.stdout.write('[gh780] two passes, previous said true and this one false -> published '
            + JSON.stringify(box.result.pgrActive) + '\n');

        expect(box.result.pgrActive).toBe(false);
        // And the keys the merge exists for still let the fresh state win.
        expect(box.result.turfType).toBe('greens');
    });
});

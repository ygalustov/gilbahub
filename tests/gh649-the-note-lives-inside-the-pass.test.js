'use strict';

/**
 * GH-649 / GH-781 — THE NOTE ABOUT AN EXHAUSTED PGR WINDOW REACHES THE JOURNAL THE RUN STORES.
 *
 * WHY THIS FILE WAS REWRITTEN, and it is the fault it had itself. It used to hand the bench
 * `state: { pgr: { applicationDate… } }` — an input the product never publishes. So it was green while the
 * note reached no stored row at all: 0 of 108 rows on the stand carry it, and `Test5 - NZ`, whose application
 * is 105 days old, has none in 5 rows for 29.09. A guard that supplies the input under test measures itself.
 *
 * TWO BREAKS IN A ROW, and this file now holds both shut:
 *   1. the note was first written before any pass, and the orchestrator's journal reset wiped it;
 *   2. GH-649 moved it into that pass, where it read `_hubState.inputs.pgr` — a key nothing fills.
 *
 * SO THE INPUT COMES THE WAY THE RUN GETS IT: the journal's answer (`GAIP_LAST_PGR`, from
 * `/api/spray-log/context`) into `gaip_build_state`, inside the cascade's pass, which is the pass that holds
 * it. The entry is marked as the cascade's, so the orchestrator's passes no longer clear it — that is the
 * device of GH-781 and this is its measurement in the real order: cascade, then pass, then pass again.
 */

const { load, computeAll } = require('./lib/orchestrator-bench');

const HUB_ROOT = { querySelector: () => null, querySelectorAll: () => [] };
const CLIMATE = {
    temperature: { mean: 14, min: 8, max: 19 },
    growth: { c3: 70, c4: 20, weighted: 60 },
    moisture: { humidity: { mean: 70, dataSource: 'live' }, rainfall: 4 },
    stress: {},
    current: { airTemp: 14, soilTemp: 13 },
};
const TURF = { species: 'Perennial Ryegrass', grassSpecies: 'perennialRyegrass', turfType: 'sports' };

const daysAgo = (n) => {
    const d = new Date();
    d.setUTCHours(0, 0, 0, 0);
    d.setUTCDate(d.getUTCDate() - n);

    return d.toISOString().slice(0, 10);
};

function journalOf(state) {
    return ((state && state.computed && state.computed.warnings) || []).slice();
}

function reasonOf(entry) {
    let data = entry && entry.data;
    if (typeof data === 'string') {
        try { data = JSON.parse(data); } catch (e) { return null; }
    }

    return (data && data.reason) || null;
}

/**
 * A run in the order the product runs it: the journal answers, the cascade's pass builds the state and
 * computes, then the orchestrator passes — twice, as it does after the weather and after a config apply.
 */
async function runInRealOrder({ appliedDaysAgo, repeatCascade }) {
    const bench = load();
    const ctx = bench.ctx;
    ctx.location.search = '?rerun=r1&site=site-1';
    ctx.GAIP_LAST_PGR = appliedDaysAgo === null
        ? null
        : { application_date: daysAgo(appliedDaysAgo), product_key: 'TE250' };

    const cascade = ctx.gaip_runCascadePass('run-button', HUB_ROOT, CLIMATE, null);
    const afterCascade = journalOf(ctx.GaipOrchestrator.getState())
        .filter((e) => reasonOf(e) === 'pgr-window-exhausted');
    if (repeatCascade) ctx.gaip_runCascadePass('samples-arrived', HUB_ROOT, CLIMATE, cascade.state);

    await computeAll(bench, { climateMetrics: CLIMATE, turf: TURF, site: { latitude: -43.5, longitude: 172.6 } });
    await computeAll(bench, { climateMetrics: CLIMATE, turf: TURF, site: { latitude: -43.5, longitude: 172.6 } });
    const afterPasses = journalOf(ctx.GaipOrchestrator.getState())
        .filter((e) => reasonOf(e) === 'pgr-window-exhausted');

    process.stdout.write('\n[gh649] applied ' + JSON.stringify(appliedDaysAgo) + ' days ago'
        + (repeatCascade ? ' (cascade repeated)' : '')
        + ' -> notes after the cascade: ' + afterCascade.length
        + ', after two passes of the orchestrator: ' + afterPasses.length + '\n');

    return { bench, afterCascade, afterPasses };
}

describe('GH-781 — the note the cascade writes survives the passes of the orchestrator', () => {
    jest.setTimeout(300000);

    test('POSITIVE CONTROL: the bench loads the whole of /hub', () => {
        // Without this an empty journal below would mean "the bench never got there" and would read exactly
        // like "the note is missing" — which is how this file was wrong for a fortnight.
        const bench = load();
        expect({ scriptsThatFailedToLoad: bench.failed }).toEqual({ scriptsThatFailedToLoad: [] });
        expect(typeof bench.ctx.gaip_runCascadePass).toBe('function');
    });

    test('105 days — the note is written, and it is STILL THERE after two passes of the orchestrator', async () => {
        const { afterCascade, afterPasses } = await runInRealOrder({ appliedDaysAgo: 105 });

        expect(afterCascade).toHaveLength(1);
        expect(afterPasses).toHaveLength(1);
        const data = typeof afterPasses[0].data === 'string'
            ? JSON.parse(afterPasses[0].data) : afterPasses[0].data;
        expect(afterPasses[0].module).toBe('pgr');
        expect(afterPasses[0].producer).toBe('cascade');
        expect(data.windowDays).toBe(90);
        expect(data.daysSinceApplication).toBe(105);
        expect(data.productType).toBe('TE250');
        expect(data.applicationDate).toBe(daysAgo(105));
    });

    test('and a repeat of the cascade does not leave two of it', async () => {
        // Up to three repeats run in one frame (GH-589). Each drops its own records first, so the run carries
        // one note rather than one per pass.
        const { afterPasses } = await runInRealOrder({ appliedDaysAgo: 105, repeatCascade: true });

        expect(afterPasses).toHaveLength(1);
    });

    test('71 days and 4 days — inside the window, so the note is about the window and not about PGR', async () => {
        const seventyOne = await runInRealOrder({ appliedDaysAgo: 71 });
        const four = await runInRealOrder({ appliedDaysAgo: 4 });

        expect(seventyOne.afterPasses).toHaveLength(0);
        expect(four.afterPasses).toHaveLength(0);
    });

    test('the journal answered with no application at all — nothing to say', async () => {
        const { afterPasses } = await runInRealOrder({ appliedDaysAgo: null });

        expect(afterPasses).toHaveLength(0);
    });

    test('a record offered without naming its producer is NOT written, and the run says why', () => {
        /**
         * The device of GH-781 rests on every entry naming its writer: a pass clears its own records and
         * leaves everybody else's. An entry written without a name would be filed as the orchestrator's and
         * cleared by its next pass — silently. So the exported writer refuses, and says so in the journal.
         */
        const bench = load();
        bench.ctx.GaipOrchestrator.note('pgr', 'written with no producer', { reason: 'no-producer-named' });
        const journal = journalOf(bench.ctx.GaipOrchestrator.getState());
        const offered = journal.filter((e) => reasonOf(e) === 'no-producer-named');
        const refusal = journal.filter((e) => /without naming its producer/.test(String(e.message || '')));
        process.stdout.write('[gh649] offered without a producer: written ' + offered.length
            + ', refusals recorded ' + refusal.length + '\n');

        expect(offered).toHaveLength(0);
        expect(refusal).toHaveLength(1);
    });
});

/**
 * GH-649 (analyst 4.12a) — THE LINK: A NOTE MADE INSIDE THE PASS REACHES THE
 * ROW, AND A NOTE MADE OUTSIDE IT DOES NOT.
 *
 * The link is deliberately this way round, and her correction is why. The first
 * version of it said that a note written BEFORE the pass is present in the
 * journal — which can only be made green by letting an entry survive the
 * clearing, the road she rejected: something that survives one clearing survives
 * the next, and then a second journal with its own lifetime is needed. Anyone
 * taking that link literally would have seen red on the correct repair and gone
 * to "fix" the clearing.
 *
 * So, in her order:
 *   POSITIVE, first: an entry recorded INSIDE the pass is in the journal the pass
 *   reports and in the row of that run.
 *   NEGATIVE: an entry recorded OUTSIDE the pass is absent from both. That is the
 *   property of GH-557 the rejected road would have destroyed, and the reviewer's
 *   own probe — one before the pass, none after — stays the expected answer.
 *
 * Run on the offline bench, which loads what `/hub` loads, so the pass is the
 * product's own and not a transcription of it.
 */

'use strict';

const { load, computeAll } = require('./lib/orchestrator-bench');

const journalOf = (state) => (state && state.computed && state.computed.warnings) || [];

/**
 * The reason code inside a journal entry.
 *
 * MEASURED, and it changed this file: the runner records `data` through a
 * summariser, so an object arrives as its JSON STRING. The first version of this
 * set read `entry.data.reason` and found nothing while the entry was right there
 * — the same shape of mistake as asking for a name instead of enumerating. The
 * server reads both shapes now (`AnalysisResults::reasonOfNote`), and so does
 * this.
 */
function reasonOf(entry) {
    let data = entry && entry.data;
    if (typeof data === 'string') {
        try { data = JSON.parse(data); } catch (e) { return null; }
    }
    return (data && data.reason) || null;
}

/** A site whose growth regulator was applied long before the window. */
function pgrInputs(daysAgo) {
    const applied = new Date();
    applied.setUTCHours(0, 0, 0, 0);
    applied.setUTCDate(applied.getUTCDate() - daysAgo);

    return {
        turf: { species: 'Perennial Ryegrass', grassSpecies: 'perennialRyegrass', turfType: 'sports' },
        site: { latitude: -43.5, longitude: 172.6 },
        state: { pgr: { applicationDate: applied.toISOString().slice(0, 10), productType: 'TE250' } },
        climateMetrics: { temperature: { mean: 14, min: 8, max: 19 }, growth: { c3: 70, c4: 20, weighted: 60 },
            moisture: { humidity: { mean: 70, dataSource: 'live' }, rainfall: 4 }, stress: {} },
    };
}

describe('GH-649 — the note is born inside the pass', () => {
    jest.setTimeout(120000);

    test('POSITIVE CONTROL: the bench loads the whole of /hub and the pass runs', async () => {
        // Without this, an empty journal below would mean "the bench never got
        // there" and would read exactly like "the note is missing".
        const bench = load();
        expect({ scriptsThatFailedToLoad: bench.failed }).toEqual({ scriptsThatFailedToLoad: [] });

        const run = await computeAll(bench, pgrInputs(120));
        process.stdout.write('\n[gh649] the pass reported ' + journalOf(run.state).length
            + ' journal entries; threw: ' + JSON.stringify(run.threw) + '\n');
        expect(run.state).toBeTruthy();
    });

    test('a note the PASS makes is in the journal the pass reports', async () => {
        const bench = load();
        const run = await computeAll(bench, pgrInputs(120));
        const journal = journalOf(run.state);
        const ours = journal.filter((e) => reasonOf(e) === 'pgr-window-exhausted');

        process.stdout.write('[gh649] entries carrying the PGR cause: ' + JSON.stringify(ours) + '\n');

        expect(ours).toHaveLength(1);
        expect(ours[0].level).toBe('info');
        expect(ours[0].module).toBe('pgr');
        const data = typeof ours[0].data === 'string' ? JSON.parse(ours[0].data) : ours[0].data;
        expect(data.windowDays).toBeGreaterThan(0);
        expect(data.daysSinceApplication).toBeGreaterThan(data.windowDays);
    });

    test('a note made OUTSIDE the pass is absent from it — and that is the property, not a defect', async () => {
        // The road her device rejected, stated as a guard. An entry written
        // before `computeAll` is cleared by it, and the reviewer's measurement —
        // one before, none after — is the expected answer rather than a bug to
        // chase.
        const bench = load();
        bench.ctx.GaipOrchestrator.note('pgr', 'written before the pass', { reason: 'written-outside-the-pass' });
        const before = journalOf(bench.ctx.GaipOrchestrator.getState()).length;

        const run = await computeAll(bench, pgrInputs(120));
        const survivors = journalOf(run.state).filter((e) => reasonOf(e) === 'written-outside-the-pass');

        process.stdout.write('[gh649] before the pass: ' + before
            + ' | that entry after the pass: ' + survivors.length + '\n');

        expect(before).toBe(1);
        expect(survivors).toHaveLength(0);
    });

    test('an application INSIDE the window says nothing, so the note is about the window and not about PGR', async () => {
        const bench = load();
        const run = await computeAll(bench, pgrInputs(30));
        const ours = journalOf(run.state).filter((e) => reasonOf(e) === 'pgr-window-exhausted');

        process.stdout.write('[gh649] inside the window, entries: ' + ours.length + '\n');
        expect(ours).toHaveLength(0);
    });
});

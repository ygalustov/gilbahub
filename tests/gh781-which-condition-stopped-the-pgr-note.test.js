'use strict';

/**
 * GH-781 (after the live window of 30.09.2026) — WHICH CONDITION STOPPED THE NOTE, NAMED BY THE CASE.
 *
 * WHAT THE WINDOW MEASURED on `Test5 - NZ`, whose application is 106 days old: `has_pgr_note` 0 -> 0, and
 * the PGR part of the pass fingerprint was `pgr:log_3` in every frame read — `pgr:unanswered` never once,
 * and `[GH-589] cascade re-run` zero times. So the journal's answer was already in hand when the first pass
 * ran: delivery is not the fault, the WRITER's condition is. Delivery 4 is not implicated.
 *
 * FOUR CONDITIONS GUARD THAT WRITE, and reading cannot tell which of them held. This runs the product's own
 * pass with the journal's answer in the shape the server sends for log 3, and prints all four side by side.
 */

const { load } = require('./lib/orchestrator-bench');

/** Log entry 3 of the stand, as `SprayLogController::mapEntry` plus `pgrProductKey` compose it. */
const LOG_3 = {
    log_id: 3,
    site_id: 'site-1',
    zone: '',
    application_date: '2026-06-16',
    product_name: 'Primo 250EC',
    product_category: 'pgr',
    product_key: 'TE250',
    rate: 0.4,
    rate_unit: 'L/ha',
};

describe('GH-781 — the writer of the PGR note, condition by condition', () => {
    jest.setTimeout(300000);

    test('the four conditions of the write, printed with what each one answered', () => {
        const bench = load();
        expect(bench.failed).toEqual([]);
        const ctx = bench.ctx;
        ctx.location.search = '?rerun=r1&site=site-1&soil=none&water=none&tissue=none';
        ctx.GAIP_HUB_CONFIG = Object.assign({}, ctx.GAIP_HUB_CONFIG, { activeSiteId: 'site-1' });
        // The journal answered before the pass — the live order the window measured.
        ctx.GAIP_LAST_PGR = LOG_3;

        const hubRoot = { querySelector: () => null, querySelectorAll: () => [] };
        ctx.gaip_runCascadePass('run-button', hubRoot, { current: { airTemp: 18, soilTemp: 16 } }, null);

        const measured = ctx.vmEval ? null : null;
        const answers = {
            chooserSeesTheAnswer: (() => {
                try { return (ctx.gaip_lastPgrForThisRun() || {}).log_id || String(ctx.gaip_lastPgrForThisRun()); }
                catch (e) { return 'threw: ' + e.message; }
            })(),
            engineOnThePage: typeof ctx.GAIP_PGR,
            historyWindowDays: (ctx.GAIP_PGR && ctx.GAIP_PGR.historyWindowDays) === undefined
                ? 'absent' : (ctx.GAIP_PGR && ctx.GAIP_PGR.historyWindowDays),
            applicationDateInState: (() => {
                try {
                    const s = ctx.gaip_build_state(hubRoot);
                    return (s && s.pgr && s.pgr.applicationDate) || ('(empty) pgr=' + JSON.stringify(s && s.pgr));
                } catch (e) { return 'threw: ' + e.message; }
            })(),
            daysSinceApplication: (() => {
                try {
                    return (ctx.GAIP_PGR && typeof ctx.GAIP_PGR.daysSinceApplication === 'function')
                        ? ctx.GAIP_PGR.daysSinceApplication('2026-06-16') : 'no such function';
                } catch (e) { return 'threw: ' + e.message; }
            })(),
        };
        const journal = ctx.GaipOrchestrator.getState().computed.warnings || [];
        const note = journal.filter((e) => e && e.data && e.data.reason === 'pgr-window-exhausted');

        process.stdout.write('\n[gh781] the four conditions of the write:\n'
            + Object.keys(answers).map((k) => '[gh781]   ' + k + ' = ' + JSON.stringify(answers[k])).join('\n')
            + '\n[gh781] the note in the journal: ' + JSON.stringify(note.map((e) => e.producer + '/' + e.module))
            + '\n[gh781] every journal entry of this pass: '
            + JSON.stringify(journal.map((e) => e.module + '/' + e.producer)) + '\n');

        // This case DECIDES nothing: it names what each condition answered, which is what reading could not.
        expect(measured).toBeNull();
        expect(Object.keys(answers)).toEqual(['chooserSeesTheAnswer', 'engineOnThePage', 'historyWindowDays',
            'applicationDateInState', 'daysSinceApplication']);
    });
});

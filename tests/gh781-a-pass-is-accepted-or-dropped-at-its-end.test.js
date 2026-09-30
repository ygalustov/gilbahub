'use strict';

/**
 * GH-781 (delivery 7, the analyst's amendments (7)-(10)) — A PASS'S ACCOUNT IS ACCEPTED OR DROPPED AT ITS END,
 * AND NEVER CLEARED AT ITS START.
 *
 * WHAT WAS WRONG, measured and reported before the fix: cleanup stood at the START of a pass, so a repeat that
 * then FAILED had already removed the previous pass's account and put nothing usable in its place. The row
 * would carry numbers from pass N beside a journal from the failed pass N+1 — the class of GH-459, where one
 * thing is printed and another explains it.
 *
 * THE DEVICE: every record carries the mark of its pass; `commitPass` accepts one (that producer's records of
 * other passes go), `rollbackPass` drops one (its own go, everybody else's stay). Both ends run through
 * `try … finally`, so all three exits are covered — and those three exits are what this file asserts.
 *
 * A DEFECT THIS DEVICE INTRODUCED AND ITS REPAIR, named here because the mutation for it belongs to the
 * reviewer: with no clearing at the start, the writers that guard against duplicates found a PREVIOUS pass's
 * entry and declined to write this pass's, after which `commitPass` dropped the old one as belonging to
 * another pass — so the record vanished altogether. Measured on the orchestrator: its own `notApplicable` for
 * a site disappeared after two passes. The guard now asks about the current pass, and the case below holds it.
 */

const { load, computeAll, withSamples } = require('./lib/orchestrator-bench');

const CLIMATE = { current: { airTemp: 18, soilTemp: 16 }, gp: { c3: 0.7 }, monthlyTemps: null };
const TURF = { turfType: 'greens', species: 'bentgrass' };
const HUB_ROOT = { querySelector: () => null, querySelectorAll: () => [] };

/** Every journal entry of a producer, as "module/pass", so two passes' accounts are told apart. */
function accountOf(ctx, producer) {
    const c = ctx.GaipOrchestrator.getState().computed;
    const all = [].concat(c.warnings || [], c.skipped || [], c.notApplicable || []);

    return all.filter((e) => e && e.producer === producer).map((e) => e.module + '@' + e.pass);
}

describe('GH-781 delivery 7 — the three exits of a pass', () => {
    jest.setTimeout(300000);

    test('EXIT 1, success: this pass\'s account stands and the previous pass\'s is gone', () => {
        const bench = load();
        expect(bench.failed).toEqual([]);
        const ctx = bench.ctx;
        ctx.location.search = '?rerun=r1&site=s&soil=none&water=none&tissue=none';
        withSamples(bench, {});

        const first = ctx.gaip_runCascadePass('run-button', HUB_ROOT, CLIMATE, null);
        const afterFirst = accountOf(ctx, 'cascade');
        const second = ctx.gaip_runCascadePass('samples-arrived', HUB_ROOT, CLIMATE, null);
        const afterSecond = accountOf(ctx, 'cascade');

        process.stdout.write('\n[gh781] after pass 1: ' + JSON.stringify(afterFirst)
            + '\n[gh781] after pass 2: ' + JSON.stringify(afterSecond) + '\n');

        // Both passes produced a result, so the second one's account is what stands.
        expect(first.result.success).toBe(true);
        expect(second.result.success).toBe(true);
        expect(afterFirst.length).toBeGreaterThan(0);
        // The MARKS, not the count: every entry belongs to the second pass and none to the first.
        const marks = afterSecond.map((n) => n.split('@')[1]);
        expect(marks.filter((m) => m === String(second.passStartedAt)).length).toBe(marks.length);
        expect(marks.indexOf(String(first.passStartedAt))).toBe(-1);
    });

    test('EXIT 2, an exception: this pass\'s account goes and the PREVIOUS one is left standing', () => {
        const bench = load();
        expect(bench.failed).toEqual([]);
        const ctx = bench.ctx;
        ctx.location.search = '?rerun=r1&site=s&soil=none&water=none&tissue=none';
        withSamples(bench, {});

        const good = ctx.gaip_runCascadePass('run-button', HUB_ROOT, CLIMATE, null);
        const afterGood = accountOf(ctx, 'cascade');
        expect(afterGood.length).toBeGreaterThan(0);

        // The pass throws from inside the engines, which is the shape a real failure has.
        const realRun = ctx.GilbaCascadeOrchestrator.runCascade;
        ctx.GilbaCascadeOrchestrator.runCascade = () => { throw new Error('the cascade threw, from this test'); };
        let threw = null;
        try { ctx.gaip_runCascadePass('samples-arrived', HUB_ROOT, CLIMATE, null); }
        catch (e) { threw = e.message; }
        ctx.GilbaCascadeOrchestrator.runCascade = realRun;
        const afterThrow = accountOf(ctx, 'cascade');

        process.stdout.write('[gh781] the pass threw: ' + JSON.stringify(threw)
            + '\n[gh781] account after it: ' + JSON.stringify(afterThrow) + '\n');

        expect(threw).toContain('the cascade threw');
        // The account of the pass that HAS the numbers is what the row would carry.
        expect(afterThrow).toEqual(afterGood);
    });

    test('EXIT 3, a pass that finished without a result: its account is dropped too', () => {
        /**
         * The cascade answers `success: false` rather than throwing when an engine list is missing or the
         * adapter refuses. That is a pass that finished and produced nothing, so its half-written account must
         * not replace the one with numbers either — the same rule as the exception, by a different exit.
         */
        const bench = load();
        expect(bench.failed).toEqual([]);
        const ctx = bench.ctx;
        ctx.location.search = '?rerun=r1&site=s&soil=none&water=none&tissue=none';
        withSamples(bench, {});

        const good = ctx.gaip_runCascadePass('run-button', HUB_ROOT, CLIMATE, null);
        const afterGood = accountOf(ctx, 'cascade');
        const realRun = ctx.GilbaCascadeOrchestrator.runCascade;
        ctx.GilbaCascadeOrchestrator.runCascade = () => ({ success: false, error: 'refused, from this test',
            state: { inputs: {}, computed: {} }, passStartedAt: Date.now() });
        const failed = ctx.gaip_runCascadePass('samples-arrived', HUB_ROOT, CLIMATE, null);
        ctx.GilbaCascadeOrchestrator.runCascade = realRun;
        const afterFailed = accountOf(ctx, 'cascade');

        process.stdout.write('[gh781] the pass answered success=' + failed.result.success
            + '\n[gh781] account after it: ' + JSON.stringify(afterFailed) + '\n');

        expect(failed.result.success).toBe(false);
        expect(afterFailed).toEqual(afterGood);
        expect(good.passStartedAt).not.toBe(failed.passStartedAt);
    });

    test('`attempted` belongs to the pass that reads it: the second sweep sees only its own modules', async () => {
        /**
         * GH-781 (delivery 7, the analyst's amendment (11)) - the list of what a pass TOOK ON is not part of
         * anyone's account: its only reader is the sweep at the end of the same pass, and no row carries it.
         * Delivery 7 removed its clearing along with the accounts', and `commitPass` filters by a producer
         * these entries do not carry - so it grew, and a later pass's sweep judged modules of an earlier one.
         */
        const bench = load();
        expect(bench.failed).toEqual([]);
        const ctx = bench.ctx;
        ctx.location.search = '?rerun=r1&site=s&soil=none&water=none&tissue=none';
        withSamples(bench, {});
        const attempted = () => (ctx.GaipOrchestrator.getState().computed.attempted || [])
            .map((a) => a.module).sort();

        /**
         * GH-781 (second return, the reviewer's third finding) - THE TWO PASSES MUST TAKE ON DIFFERENT MODULES,
         * or the case cannot tell the device from its absence.
         *
         * The first form ran the same inputs twice: both passes took on the same ten modules, so the list read
         * the same whether it had been emptied or not, and removing the zeroing left the suite green. Measured
         * by the reviewer with a probe. So the second pass here is given a state that takes on FEWER modules -
         * without the zeroing its sweep would still find the first pass's, which is the fault itself.
         */
        // MEASURED, not assumed, and the order follows the measurement: a BARE state takes on `dew` (the gate
        // lets it through when there is no turf profile to refuse it by), and a state with a turf profile does
        // not. So the bare pass goes first and the richer one second, and `dew` is the module that must not
        // survive into the second pass's list.
        await computeAll(bench, { climateMetrics: CLIMATE, turf: {}, site: {} });
        const afterOne = attempted();

        await computeAll(bench, { climateMetrics: CLIMATE, turf: TURF, site: {},
            schedule: { matchesPerWeek: 2, sessionsPerWeek: 3 } });
        const afterTwo = attempted();
        const onlyInTheFirst = afterOne.filter((m) => afterTwo.indexOf(m) < 0);

        process.stdout.write('[gh781] attempted after pass 1: ' + JSON.stringify(afterOne)
            + '\n[gh781] attempted after pass 2: ' + JSON.stringify(afterTwo)
            + '\n[gh781] taken on by the FIRST pass only: ' + JSON.stringify(onlyInTheFirst) + '\n');

        // POSITIVE CONTROL, and it is what the first form lacked: the two passes really do differ, so the
        // comparison below can fail. Without it the case would agree with any implementation.
        expect(onlyInTheFirst.length).toBeGreaterThan(0);
        // And none of the first pass's own modules is in the second pass's list.
        onlyInTheFirst.forEach((m) => expect(afterTwo).not.toContain(m));
    });

    test('THE OVERFLOW NOTICE belongs to the write that was refused, and survives another producer\'s pass', async () => {
        /**
         * GH-781 (second return, the reviewer's fourth finding) - THE MESSAGE SAYING THE JOURNAL STOPPED
         * WRITING MUST NOT BE THE FIRST THING TO GO.
         *
         * It had no pass mark, so a commit dropped it; the first repair gave it the fields and left its producer
         * as the literal `orchestrator`, so a notice caused by the CASCADE's write was still removed by the
         * orchestrator's next pass. Measured twice by the reviewer, fixed twice, and now held by a case: the
         * notice is filled from the write that was refused, and it is still there after another producer passes.
         */
        const bench = load();
        expect(bench.failed).toEqual([]);
        const ctx = bench.ctx;
        ctx.location.search = '?rerun=r1&site=s&soil=none&water=none&tissue=none';
        withSamples(bench, {});

        // Fill the journal to its cap through the CASCADE's own door, so the notice is caused by that producer.
        ctx.GaipOrchestrator.beginPass('cascade', 12345);
        for (let i = 0; i < 260; i += 1) {
            ctx.GaipOrchestrator.recordProblem('cascade', 'filling the log, entry ' + i, null, 'cascade');
        }
        const notices = () => (ctx.GaipOrchestrator.getState().computed.warnings || [])
            .filter((e) => e && /log full/.test(e.message || ''))
            .map((e) => e.producer + '/' + e.door + '/' + (e.pass === null ? 'no-pass' : 'marked'));
        const whenWritten = notices();

        // Now a pass of the OTHER producer runs and accepts itself.
        await computeAll(bench, { climateMetrics: CLIMATE, turf: TURF, site: {} });
        const afterOther = notices();

        process.stdout.write('[gh781] the notice as written        : ' + JSON.stringify(whenWritten)
            + '\n[gh781] after the other producer\'s pass: ' + JSON.stringify(afterOther) + '\n');

        // POSITIVE CONTROL: the cap was reached at all, or there is no notice to be lost.
        expect(whenWritten).toEqual(['cascade/recordProblem/marked']);
        // And it is still there: the orchestrator's commit has no claim on the cascade's records.
        expect(afterOther).toEqual(whenWritten);
    });

    test('ROLLBACK ITSELF: a pass that WROTE and then threw leaves nothing of its own behind', () => {
        /**
         * GH-781 (delivery 7, the reviewer's first finding) - THE HALF OF THIS DEVICE THAT HAD NO CASE.
         *
         * He disarmed `rollbackPass` entirely and the whole suite stayed green: EXIT 2 threw before the pass
         * had written anything, so there was nothing for a rollback to remove, and EXIT 3 reddened on the
         * CHOICE of ending rather than on the act of dropping. So this case makes the pass write first: the run
         * is told there IS a soil sample (`?soil=103`) and the store does not hold it, which is what makes the
         * pass file its two records BEFORE the engines run - and only then does the cascade throw.
         *
         * WHAT IT HOLDS: those two records are gone, and the previous pass's account is untouched. Disarm the
         * rollback and the pass's own records stay behind, which is exactly the leak this delivery closes.
         */
        const bench = load();
        expect(bench.failed).toEqual([]);
        const ctx = bench.ctx;
        // Named a soil sample the store does not hold: the pass writes a note and a skip before the engines.
        ctx.location.search = '?rerun=r1&site=s&soil=103&water=none&tissue=none';
        withSamples(bench, {});

        const good = ctx.gaip_runCascadePass('run-button', HUB_ROOT, CLIMATE, null);
        const afterGood = accountOf(ctx, 'cascade');
        const soilOfGood = afterGood.filter((n) => n.indexOf('mlsn@') === 0);
        // POSITIVE CONTROL: the pass really does write those records, or the case below proves nothing.
        expect(soilOfGood.length).toBeGreaterThan(0);

        const realRun = ctx.GilbaCascadeOrchestrator.runCascade;
        ctx.GilbaCascadeOrchestrator.runCascade = () => { throw new Error('thrown after the pass had written'); };
        let threw = null;
        try { ctx.gaip_runCascadePass('samples-arrived', HUB_ROOT, CLIMATE, null); }
        catch (e) { threw = e.message; }
        ctx.GilbaCascadeOrchestrator.runCascade = realRun;
        const afterThrow = accountOf(ctx, 'cascade');

        process.stdout.write('[gh781] the pass wrote, then threw: ' + JSON.stringify(threw)
            + '\n[gh781] its own records before the throw: ' + JSON.stringify(soilOfGood)
            + '\n[gh781] the account that is left        : ' + JSON.stringify(afterThrow) + '\n');

        expect(threw).toContain('thrown after the pass had written');
        // Nothing of the failed pass: no entry carries its mark.
        const failedMark = afterThrow.filter((n) => n.split('@')[1] !== String(good.passStartedAt));
        expect(failedMark).toEqual([]);
        // And the previous pass's account, which HAS the numbers, is exactly as it was.
        expect(afterThrow).toEqual(afterGood);
    });

    test('THE DOOR IS A DISCRIMINATOR: an internal write is not credited to an outside door', () => {
        /**
         * GH-781 (delivery 7, the reviewer's fourth finding) - the `door` field had no case: he renamed
         * `internal` to `recordProblem` in all three places and the suite stayed green, so the field that tells
         * an outside writer from the orchestrator's own could be quietly wrong and nothing would notice.
         *
         * WHAT IT HOLDS is the consequence the field exists for: the orchestrator's own records say `internal`,
         * the cascade's say which door it used, and the registry key of the two is therefore different. Rename
         * one and this case fails on the key, not on a spelling.
         */
        const bench = load();
        expect(bench.failed).toEqual([]);
        const ctx = bench.ctx;
        ctx.location.search = '?rerun=r1&site=s&soil=103&water=none&tissue=none';
        withSamples(bench, {});
        ctx.GAIP_LAST_PGR = { log_id: 3, site_id: 'site-1', application_date: '2026-06-16',
            product_name: 'Primo 250EC', product_key: 'TE250', rate: 0.4 };
        ctx.GAIP_HUB_CONFIG = Object.assign({}, ctx.GAIP_HUB_CONFIG, { activeSiteId: 'site-1' });

        ctx.gaip_runCascadePass('run-button', HUB_ROOT, CLIMATE, null);
        const all = ctx.GaipOrchestrator.getState().computed;
        const doors = [].concat(all.warnings || [], all.skipped || [], all.notApplicable || [])
            .map((e) => e.producer + '/' + e.door);
        const byProducer = {};
        doors.forEach((d) => {
            const cut = d.split('/');
            byProducer[cut[0]] = byProducer[cut[0]] || {};
            byProducer[cut[0]][cut[1]] = true;
        });

        process.stdout.write('[gh781] doors, by producer: ' + JSON.stringify(Object.keys(byProducer)
            .map((k) => k + ' -> ' + Object.keys(byProducer[k]).sort().join(','))) + '\n');

        // The cascade came through the outside doors and says which: `internal` is not among them.
        const cascadeDoors = Object.keys(byProducer.cascade || {}).sort();
        expect(cascadeDoors.indexOf('internal')).toBe(-1);
        // All four outside doors, as this pass actually used them -- the list, so a door that stops being
        // used is printed by name rather than turning a 4 into a 3.
        expect(cascadeDoors).toEqual(['notApplicable', 'note', 'noteSkipped', 'recordProblem']);
        // And an internal write of the orchestrator's own is marked as such, so it cannot be credited to a
        // door nobody used. Its own pass writes none here, so the assertion is about the mark's meaning:
        // every record of a producer that did not use a door carries `internal`.
        Object.keys(byProducer).filter((p2) => p2 !== 'cascade').forEach((p2) => {
            expect(Object.keys(byProducer[p2])).toEqual(['internal']);
        });
    });

    test('AND THE DEFECT THIS DEVICE INTRODUCED: a writer that guards against duplicates still writes', async () => {
        /**
         * The repair named in this file's header, held by its consequence. Two passes of the ORCHESTRATOR over
         * the same site: the second must have its own account, not an empty one. Before the repair the guard
         * found the first pass's entry, declined to write, and the commit then dropped the first pass's —
         * leaving the site with no cause at all.
         */
        const bench = load();
        expect(bench.failed).toEqual([]);
        const ctx = bench.ctx;
        ctx.location.search = '?rerun=r1&site=s&soil=none&water=none&tissue=none';
        withSamples(bench, {});

        await computeAll(bench, { climateMetrics: CLIMATE, turf: TURF, site: {} });
        const afterOne = accountOf(ctx, 'orchestrator');
        await computeAll(bench, { climateMetrics: CLIMATE, turf: TURF, site: {} });
        const afterTwo = accountOf(ctx, 'orchestrator');

        process.stdout.write('[gh781] orchestrator after pass 1: ' + JSON.stringify(afterOne)
            + '\n[gh781] orchestrator after pass 2: ' + JSON.stringify(afterTwo) + '\n');

        // The modules it spoke about, by name, after each pass -- the same set, from the second pass's mark.
        const modules = (list) => list.map((n) => n.split('@')[0]).sort();
        expect(modules(afterTwo)).toEqual(modules(afterOne));
        expect(afterTwo.length).toBeGreaterThan(0);
        // And nothing of the first pass is left beside it.
        const marksTwo = afterTwo.map((n) => n.split('@')[1]).filter((v, i, a) => a.indexOf(v) === i);
        expect(marksTwo.length).toBe(1);
        expect(marksTwo[0]).not.toBe(afterOne[0].split('@')[1]);
    });
});

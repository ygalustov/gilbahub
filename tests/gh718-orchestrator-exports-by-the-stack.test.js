/**
 * GH-718 — WHICH EXPORTS OF `GaipOrchestrator` ANYTHING REACHES, MEASURED BY WHAT RAN.
 *
 * `hub-orchestrator.js` exported `computeSelective`, `computeIsolated` and `executeEngine`. A
 * reading of the code called all three dead, and reading is not measuring: this file measured them
 * on the stack instead. All three are gone now (GH-718, then GH-755 with `executeEngine` and its two
 * spray-log helpers), and what this file guards is the absence plus the one call site that still
 * NAMES `computeSelective` and enters somebody else's method of that name. This measures, on the bench, which of the three places is ever
 * ENTERED and from where, using the same place-identifying record as `gh717`, over two runs:
 * a full pass (`computeAll`) and the live climate path that ends in
 * `hub.orchestrator.computeSelective(...)`.
 *
 * The one text-level fact it adds is the list of call sites that name each function, from the
 * caller walk. A place with no call site outside dead code and no entry on the stack is dead.
 *
 * WHAT THIS DOES NOT SEE: branches the bench does not execute, and views it does not load. The
 * stack proves that something ran, never that nothing can; the absence claim rests on the call
 * sites, and the stack says where the one live-looking call site actually goes.
 */

'use strict';

const { load, computeAll } = require('./lib/orchestrator-bench');
const { instrumented, callerOf } = require('./gh717-member-resolution-against-the-stack.test.js');
const walk = require('./helpers/gh678-caller-walk');

jest.setTimeout(180000);

const PLACES = ['computeSelective', 'computeIsolated', 'executeEngine'];

async function run() {
    const { index, expose } = instrumented(false);
    const places = {};
    (index['hub-orchestrator.js'] || []).forEach((f) => {
        if (PLACES.includes(f.name)) places[f.name] = 'hub-orchestrator.js:' + f.line;
    });
    const twin = (index['gilba-hub-v2.js'] || []).filter((f) => f.name === 'computeSelective').map((f) => 'gilba-hub-v2.js:' + f.line);
    const bench = load({ expose });
    await computeAll(bench, { climateMetrics: { daily: {}, hourly: {} } });
    const hub = bench.ctx.GilbaHub;
    if (hub && hub.climate) {
        hub.climate.dataService.fetch = () => Promise.resolve({ daily: {}, hourly: {}, _weatherStatus: 'live' });
        try { await hub.climate.coordinator.fetchAndStore(-35.28, 149.13, {}); } catch (e) { /* measured below */ }
    }
    const entries = (bench.ctx.__entries || []).map((e) => ({ entered: e.f + ':' + e.l, caller: callerOf(e.stack) }));
    return { places, twin, index, entries, failed: bench.failed };
}

describe('GH-718 — the orchestrator exports, by the stack', () => {
    test('which of the three is entered, and where the live-looking call goes', async () => {
        const r = await run();
        const files = walk.universe();
        const sites = {};
        PLACES.forEach((name) => {
            sites[name] = [];
            files.forEach((f) => f.uses.filter((u) => u.name === name && (u.how === 'call' || u.how === 'member call'))
                .forEach((u) => sites[name].push(f.rel + ':' + u.line + ' in ' + (u.enclosing || '<top level>'))));
        });
        const entered = {};
        PLACES.forEach((name) => {
            entered[name] = r.entries.filter((e) => e.entered === r.places[name]).map((e) => 'from ' + e.caller);
        });
        const live = r.entries.filter((e) => e.caller && e.caller.startsWith('climate-engine-v2.js:')
            && /:(\d+)$/.test(e.caller) && e.entered.startsWith('gilba-hub-v2.js:')).map((e) => e.caller + ' -> ' + e.entered);
        process.stdout.write('[gh718] load failures: ' + r.failed.length + '; entries observed: ' + r.entries.length + '\n'
            + '[gh718] places: ' + JSON.stringify(r.places) + '\n'
            + PLACES.map((n) => '[gh718]    ' + n + ' — call sites ' + JSON.stringify(sites[n]) + '; entered ' + JSON.stringify(Array.from(new Set(entered[n])))).join('\n') + '\n'
            + '[gh718] the climate path enters: ' + JSON.stringify(Array.from(new Set(live))) + '\n');

        expect(r.failed).toEqual([]);
        expect(r.entries.length).toBeGreaterThan(0);
        /**
         * GH-755 (queue item 3bz): NONE OF THE THREE IS LEFT. `computeSelective` and `computeIsolated`
         * went under GH-718; `executeEngine` was measured here with zero call sites and zero entries
         * and went with its body, and its two spray-log helpers went with it because they were reached
         * from inside it and from nowhere else. So the claim is now an absence — and it is asserted
         * beside the two facts that keep an absence from being vacuous: the walk loaded everything it
         * was given (no failures) and observed thousands of entries, so "none of the three is here" is
         * a measurement rather than an empty run.
         */
        expect(Object.keys(r.places).sort()).toEqual([]);
        expect(r.entries.length).toBeGreaterThan(1000);
        const callSite = sites.computeSelective.map((x) => x.replace(/^assets\//, '').split(' ')[0]);
        const entersTwin = r.entries.filter((e) => callSite.includes(e.caller) && r.twin.includes(e.entered));
        process.stdout.write('[gh718] the call site ' + JSON.stringify(callSite) + ' enters ' + JSON.stringify(Array.from(new Set(entersTwin.map((e) => e.entered)))) + '\n');
        expect(callSite.length).toBe(1);
        expect(entersTwin.length).toBeGreaterThan(0);

        // WHAT THE REMOVAL LEFT WITHOUT A CALLER: the functions the caller-walk ratchet records
        // under this ticket, read from the ratchet rather than listed here. For each, its call
        // sites in the universe and whether the bench ever entered it.
        const ratchet = require('./fixtures/gh678-unresolved-executors.json').empty;
        const orphans = Object.keys(ratchet).filter((k) => ratchet[k].ticket === 'GH-718');
        const report = orphans.map((k) => {
            const [file, , name] = k.replace(/ #\d+$/, '').split(' : ');
            const script = file.replace(/^assets\//, '');
            const place = (r.index[script] || []).filter((f) => f.name === name).map((f) => script + ':' + f.line);
            const calls = [];
            files.forEach((f) => f.uses.filter((u) => u.name === name && (u.how === 'call' || u.how === 'member call'))
                .forEach((u) => calls.push(f.rel + ':' + u.line + ' in ' + (u.enclosing || '<top level>'))));
            const ran = r.entries.filter((e) => place.includes(e.entered)).length;
            return name + ' @ ' + JSON.stringify(place) + ' — call sites ' + JSON.stringify(calls) + '; entered ' + ran;
        });
        process.stdout.write('[gh718] left without a caller (' + orphans.length + '):\n' + report.map((x) => '[gh718]    ' + x).join('\n') + '\n');
        expect(orphans.length).toBeGreaterThan(0);
    });
});

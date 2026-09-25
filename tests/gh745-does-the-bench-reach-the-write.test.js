/**
 * GH-745 (queue item 3bm) — THE MEASUREMENT THAT DECIDES WHETHER THE ITEM CAN BE BUILT AT ALL.
 *
 * Item 3bm wants an invariant of the run frame taken BY BEHAVIOUR rather than by reading call
 * sites: the census of GH-711 sees calls as text, so whether a fifth path exists — one the frame
 * executes without a person — is not established by it. A behavioural invariant would see such a
 * path and check where the site came from, on the run itself.
 *
 * That rests on one fact nobody has measured: does a run on the bench, with a stubbed DOM, REACH
 * THE WRITE? If it does not, the invariant needs a live run, and a live run is forbidden tonight.
 * So this file measures only that, and says which of the two it is.
 *
 * NOTHING IS ASSERTED ABOUT THE PRODUCT HERE. It is a measurement, and its own verdict is printed;
 * the assertions are the positive controls that keep the measurement honest — that the bench
 * loaded, that the writer was reached at all, and that the answer is one of the two the item asks
 * about rather than a third thing nobody looked at.
 */

'use strict';

const fs = require('fs');
const path = require('path');
const { load, computeAll } = require('./lib/orchestrator-bench');

jest.setTimeout(180000);

/**
 * `_writeResult` is private to `hub-persistence.js`, and the bench may expose a function beside
 * the module's own export line. The file belongs to another item tonight, so it is READ and run,
 * never edited: the rewrite happens in memory, on the source the bench hands to the sandbox.
 */
function exposeWriter() {
    const exportLine = '    global.GilbaPersistence = GilbaPersistence;';

    return {
        'hub-persistence.js': (src) => {
            expect(src).toContain(exportLine);

            /**
             * BESIDE ITS OWN DECLARATION, not at the export line. Measured first the other way and
             * the writer came back unreachable: `_writeResult` lives in the same private block as
             * `_bodyMetrics` (GH-738), which the export line is outside of. The block itself is
             * entered only for a run frame, so the address is set before anything runs.
             */
            const beside = '        /** The one write. Reached only when the run completed. */';
            expect(src).toContain(beside);

            /**
             * AND THE RUN'S OWN EXIT IS RECORDED, because the writer refuses once the run has
             * reported: `_writeResult` begins `if (_runReported || _writeStarted) return;`. Seeing
             * a POST is therefore not the same as reaching the write, and the difference is the
             * whole question — so the reason the run gave is captured rather than inferred.
             */
            const exitLine = '        function _report(type, extra) {';
            expect(src).toContain(exitLine);

            return "location.search = '?rerun=gh745&site=gh745-site';\n"
                + src
                    .replace(beside, beside + '\n        global.__gh745_writeHolder = function () { return _writeResult; };')
                    .replace(exitLine, exitLine
                        + '\n            (global.__gh745_exits = global.__gh745_exits || []).push({ type: type, extra: extra || null });');
        },
    };
}

describe('GH-745 — does a bench run reach the write, or does the item need a live one', () => {
    test('MEASUREMENT: the writer is reachable, and what it does when called', async () => {
        const calls = [];
        const bench = load({ expose: exposeWriter() });
        // Every outbound request is recorded rather than performed: the question is whether the
        // run GETS here, not what a server would answer.
        bench.ctx.fetch = (url, init) => {
            calls.push({ url: String(url), method: (init && init.method) || 'GET' });

            return Promise.resolve({
                ok: true, status: 200, json: () => Promise.resolve({ ok: true }),
            });
        };
        /**
         * THE SCHEMA IS PART OF THE PAGE, not of the question. Measured without it first and the
         * run exited `schema-unavailable` — a refusal caused by the bench, not by the product, and
         * reporting that as "the bench cannot reach the write" would have been a wrong answer with
         * a real measurement behind it.
         */
        /**
         * AND THE FRAME IS GIVEN THE SITE IT WAS OPENED FOR. Second refusal measured:
         * `site-mismatch`, `requested gh745-site / rendered null / context default` — the run
         * checks that the document it is in was rendered for the site the address named (GH-663),
         * and the bench's own page says `default`. That is the invariant doing its job, not the
         * bench failing; so the bench is made to look like the frame it claims to be.
         */
        bench.ctx.GAIP_HUB_CONFIG = Object.assign({}, bench.ctx.GAIP_HUB_CONFIG || {},
            { activeSiteId: 'gh745-site', restUrl: '/api/' });
        if (bench.ctx.window) bench.ctx.window.GAIP_HUB_CONFIG = bench.ctx.GAIP_HUB_CONFIG;
        bench.ctx.GAIP_SiteContext = { getSiteId: () => 'gh745-site' };
        if (bench.ctx.window) bench.ctx.window.GAIP_SiteContext = bench.ctx.GAIP_SiteContext;

        const schema = JSON.parse(fs.readFileSync(
            path.join(__dirname, '..', 'assets', 'analysis-result.schema.json'), 'utf8'));
        bench.ctx.GAIP_ANALYSIS_SCHEMA = schema;
        if (bench.ctx.window) bench.ctx.window.GAIP_ANALYSIS_SCHEMA = schema;
        await computeAll(bench, { climateMetrics: { daily: {}, hourly: {} } });

        const holder = bench.ctx.__gh745_writeHolder;
        const writer = typeof holder === 'function' ? holder() : null;
        let threw = null;
        if (typeof writer === 'function') {
            try {
                await writer();
            } catch (e) {
                threw = String((e && e.message) || e).slice(0, 200);
            }
        }
        const writes = calls.filter((c) => c.method === 'POST');
        const resultWrites = calls.filter((c) => /analysis-cache$/.test(c.url.split('?')[0]));
        const exits = bench.ctx.__gh745_exits || [];

        process.stdout.write('\n[gh745] load failures: ' + bench.failed.length
            + ' | writer reachable: ' + (typeof writer === 'function')
            + ' | requests seen: ' + calls.length
            + ' | POSTs: ' + writes.length + '\n'
            + '[gh745] the requests: ' + JSON.stringify(calls.map((c) => c.method + ' ' + c.url)) + '\n'
            + '[gh745] the writer threw: ' + JSON.stringify(threw) + '\n'
            + '[gh745] the run reported: ' + JSON.stringify(exits) + '\n'
            + '[gh745] writes of the RESULT (not the run mark): ' + resultWrites.length + '\n'
            + '[gh745] VERDICT: ' + (resultWrites.length
                ? 'the bench REACHES the write — the invariant of item 3bm can be built here'
                : 'the bench does NOT reach the write — item 3bm needs a live run, which is forbidden tonight')
            + '\n');

        // Positive controls only. A measurement that could not load the bench, or could not find
        // the writer, says nothing about the question and must not read as an answer to it.
        expect(bench.failed).toEqual([]);
        expect(typeof writer).toBe('function');
        expect(Array.isArray(calls)).toBe(true);
    });
});

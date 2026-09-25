/**
 * GH-745 (queue item 3bm) — THE FRAME'S INVARIANT, TAKEN BY BEHAVIOUR RATHER THAN BY READING.
 *
 * The census of GH-711 finds the ways a run can be started by reading call sites as TEXT. That is
 * why the item says, in its own words, that whether a fifth path exists — one the frame executes
 * with no person behind it — is NOT ESTABLISHED by it: a call the text does not show is invisible
 * to a census of text, and so is a path that reaches the write by another road.
 *
 * So this runs the frame and watches what it does. The measurement that made it possible is
 * `gh745-does-the-bench-reach-the-write`: a bench run does reach the write, with the schema the
 * page is given and a document rendered for the site the address names.
 *
 * WHAT IS ASSERTED, and all three are about behaviour rather than about source:
 *   1. a frame whose document was rendered for ANOTHER site does not write, and says why;
 *   2. a frame whose document agrees writes, and the body carries the site the ADDRESS named —
 *      not the pointer, which is the defect of GH-459 and GH-663 in one line;
 *   3. a site change arriving mid-run stops the write, which is the net of GH-720 seen from the
 *      other end: there it was measured that the listener hears, here that hearing has an effect.
 *
 * WHAT THIS DOES NOT SEE, said rather than left to be found: it exercises the paths the bench
 * executes. A fifth path that only a real page can take is not proven absent by a green here —
 * this narrows where one could hide, it does not close the question the item keeps open.
 */

'use strict';

const fs = require('fs');
const path = require('path');
const { load, computeAll } = require('./lib/orchestrator-bench');

jest.setTimeout(240000);

const SCHEMA = JSON.parse(fs.readFileSync(
    path.join(__dirname, '..', 'assets', 'analysis-result.schema.json'), 'utf8'));

/** The writer and the run's exit, reached beside their own declarations. */
function exposeRunner() {
    const beside = '        /** The one write. Reached only when the run completed. */';
    const exitLine = '        function _report(type, extra) {';

    return {
        'hub-persistence.js': (src) => {
            expect(src).toContain(beside);
            expect(src).toContain(exitLine);

            return "location.search = '?rerun=gh745-run&site=" + '\' + (globalThis.__gh745_site || "site-A") + \'' + "';\n"
                + src
                    .replace(beside, beside + '\n        global.__gh745_write = function () { return _writeResult(); };')
                    .replace(exitLine, exitLine
                        + '\n            (global.__gh745_exits = global.__gh745_exits || []).push({ type: type, extra: extra || null });');
        },
    };
}

/**
 * One run of the frame. `rendered` is the site the document says it was built for; `changeTo`,
 * when given, is a site-change event dispatched after the run has started.
 */
async function runFrame({ rendered, context, changeTo }) {
    const calls = [];
    const bench = load({ expose: exposeRunner() });
    bench.ctx.fetch = (url, init) => {
        calls.push({
            url: String(url),
            method: (init && init.method) || 'GET',
            body: init && init.body ? String(init.body) : null,
        });

        return Promise.resolve({ ok: true, status: 200, json: () => Promise.resolve({ ok: true }) });
    };
    bench.ctx.GAIP_ANALYSIS_SCHEMA = SCHEMA;
    bench.ctx.GAIP_HUB_CONFIG = Object.assign({}, bench.ctx.GAIP_HUB_CONFIG || {},
        { activeSiteId: rendered, restUrl: '/api/' });
    // The two sources are set apart on purpose: `context` defaults to `rendered`, and a case may
    // give them different values — which is what tells the two apart (GH-745, the reviewer's return).
    const contextSite = context === undefined ? rendered : context;
    bench.ctx.GAIP_SiteContext = { getSiteId: () => contextSite };
    if (bench.ctx.window) {
        bench.ctx.window.GAIP_ANALYSIS_SCHEMA = SCHEMA;
        bench.ctx.window.GAIP_HUB_CONFIG = bench.ctx.GAIP_HUB_CONFIG;
        bench.ctx.window.GAIP_SiteContext = bench.ctx.GAIP_SiteContext;
    }
    await computeAll(bench, { climateMetrics: { daily: {}, hourly: {} } });

    if (changeTo && bench.ctx.document && typeof bench.ctx.document.dispatchEvent === 'function') {
        bench.ctx.document.dispatchEvent(new bench.ctx.CustomEvent('gaip:site-changed', {
            detail: { siteId: changeTo },
        }));
    }

    try {
        await bench.ctx.__gh745_write();
    } catch (e) { /* the refusal is the measurement; a throw is printed below */ }

    const result = calls.filter((c) => /analysis-cache$/.test(c.url.split('?')[0]));

    return {
        exits: bench.ctx.__gh745_exits || [],
        wroteResult: result.length,
        body: result.length ? JSON.parse(result[0].body) : null,
        failures: bench.failed,
    };
}

describe('GH-745 — the run frame, watched rather than read', () => {
    test('a frame rendered for the site it was opened for writes, and the row carries that site', async () => {
        const r = await runFrame({ rendered: 'site-A' });
        process.stdout.write('\n[gh745] agreeing frame — exits ' + JSON.stringify(r.exits.map((e) => e.type))
            + ' | result writes ' + r.wroteResult
            + ' | body site_id ' + JSON.stringify(r.body && r.body.site_id)
            + ' | body run_id ' + JSON.stringify(r.body && r.body.run_id) + '\n');

        // Positive control: without a write there is nothing to say about the invariant.
        expect(r.failures).toEqual([]);
        expect(r.wroteResult).toBe(1);
        /**
         * THE SITE IN THE ROW IS THE ONE THE RUN WAS OPENED FOR — and here is what this cannot
         * tell apart, measured rather than assumed. Writing `site_id` from the page's config
         * instead of from the address left this green, because a frame only reaches the write
         * when the two AGREE: disagreement is refused a few lines earlier. So this says the row
         * carries the right site; it does not say which of the two sources it was read from.
         * Telling those apart needs a document rendered for one site and an address naming
         * another, which is exactly the state the invariant above refuses to write in.
         */
        expect(r.body.site_id).toBe('site-A');
        expect(r.body.run_id).toBe('gh745-run');
    });

    test('a frame whose document was rendered for another site does not write, and says why', async () => {
        const r = await runFrame({ rendered: 'site-OTHER' });
        process.stdout.write('[gh745] disagreeing frame — exits '
            + JSON.stringify(r.exits.map((e) => e.type + ':' + ((e.extra && e.extra.reason) || '')))
            + ' | result writes ' + r.wroteResult
            + ' | detail ' + JSON.stringify(r.exits.map((e) => e.extra && e.extra.detail)) + '\n');

        expect(r.wroteResult).toBe(0);
        expect(r.exits.some((e) => e.type === 'gilba:analysis-failed'
            && e.extra && e.extra.reason === 'site-mismatch')).toBe(true);
        /**
         * BOTH LINES ARE NAMED, not just the refusal. Measured: switching off the `rendered`
         * comparison alone left this green, because `context` still disagreed and carried the
         * refusal on its own. A refusal that survives losing half its evidence tells us the run
         * stopped, not that both signals work — so the LIST is asserted, not its effect.
         */
        const detail = (r.exits.find((e) => e.extra && e.extra.detail) || {}).extra.detail;
        expect(detail.disagreeing.slice().sort())
            .toEqual(['context=site-OTHER', 'rendered=site-OTHER']);
    });

    test('every source but the address is silent, and the row still carries the address\u2019s site', async () => {
        /**
         * GH-745, ON THE REVIEWER'S SECOND RETURN — THE CLASS, NOT ONE MORE SOURCE.
         *
         * The case that stood here named the config, because the mutation it answered named the
         * config. The reviewer then mutated the OTHER source — `site_id` read from the context —
         * and it stayed green, since in every state that reaches the write the context agrees with
         * the address. A mirror case would have closed that one hole and kept the shape: one case
         * per source, and a source added tomorrow is a new case again.
         *
         * So the state asserted is the one where EVERY reader of the document's site is silent.
         * The frame reads them in one place, `_documentSites()` — `GAIP_HUB_CONFIG.activeSiteId`
         * and `GAIP_SiteContext.getSiteId()` — and an absent reporter is lawfully not a
         * disagreement (GH-662), which is why the run still reaches the write. In that state every
         * source except the address answers `null`, so a `site_id` that is not `null` can only have
         * been read from the address. A reader added to `_documentSites()` later is silent here
         * too: it is covered without being named, which is what makes this a claim about the class.
         */
        const r = await runFrame({ rendered: null, context: null });
        process.stdout.write('[gh745] every source silent but the address \u2014 exits '
            + JSON.stringify(r.exits.map((e) => e.type))
            + ' | result writes ' + r.wroteResult
            + ' | body site_id ' + JSON.stringify(r.body && r.body.site_id) + '\n');

        // Positive control: silence is not a disagreement, so the run must actually write here.
        // Without this, `site_id` would be judged on a body that was never sent.
        expect(r.wroteResult).toBe(1);
        // Read from the config this is `null`; read from the context it is `null`; read from any
        // other reporter of the document's site it is `null`. It is the site the address named.
        expect(r.body.site_id).toBe('site-A');
    });

    test('a site change arriving mid-run stops the write — the net of GH-720 seen from the other end', async () => {
        const r = await runFrame({ rendered: 'site-A', changeTo: 'site-X' });
        process.stdout.write('[gh745] frame switched mid-run — exits '
            + JSON.stringify(r.exits.map((e) => e.type + ':' + ((e.extra && e.extra.reason) || '')))
            + ' | result writes ' + r.wroteResult
            + ' | changed during run ' + JSON.stringify(r.exits.map((e) => e.extra && e.extra.detail
                && e.extra.detail.siteChangedDuringRun)) + '\n');

        expect(r.wroteResult).toBe(0);
        expect(r.exits.some((e) => e.extra && e.extra.detail
            && e.extra.detail.siteChangedDuringRun === true)).toBe(true);
    });
});

'use strict';

/**
 * GH-777 (queue item 4, slice 3, the live measurement of 29.09.2026) — A SECTION WHOSE ENGINE DID NOT RUN
 * IS READ AS ABSENT, AND DOES NOT TAKE THE WHOLE RUN DOWN WITH IT.
 *
 * WHAT HAPPENED ON THE STAND. Slice 3 lets a module be gated out when its sample is absent, and the MLSN
 * table is then not in the pass's results at all. `gaip_extractCascadeResults` substitutes
 * `{status: "Not computed"}` for it -- an object -- and the renderer asked that object for `.indexOf`. The
 * frame reported `calculation-error: Ie.indexOf is not a function`, the runner stored `outcome: failed`,
 * and two sites that had every other number were left showing "re-run failed" to a person. One section
 * with nothing in it ended a whole run.
 *
 * WHAT IS ASSERTED: the consumer of the table, on the real path -- a real cascade pass, the product's own
 * extraction of its results, and the product's own renderer -- neither throws nor invents a status. "There
 * is no table" is the same fact as "there is no soil test", and the page already has words for that.
 *
 * THE BOUNDARY OF THIS BENCH, declared rather than discovered: `DOMParser` does not exist in node, and the
 * renderer uses it further down. It is stubbed here, so this file says nothing about what that later part
 * produces -- only that the absent table no longer stops the renderer before it.
 */

const { load, withSamples } = require('./lib/orchestrator-bench');

/** The four card bodies the renderer writes into, and the checkboxes it reads. */
function pageWithCards(ctx) {
    const nodes = {};
    const stub = (sel) => {
        nodes[sel] = nodes[sel] || {
            innerHTML: '', textContent: '', style: {}, dataset: {}, checked: true,
            classList: { add() {}, remove() {}, contains: () => false, toggle() {} },
            querySelector: () => null, querySelectorAll: () => [], appendChild() {},
            addEventListener() {}, setAttribute() {}, getAttribute: () => null, insertAdjacentHTML() {},
        };

        return nodes[sel];
    };
    ctx.document.querySelector = (sel) => (/gaip-[a-z]+-body|gaip-enable-/.test(String(sel)) ? stub(sel) : null);
    // The declared boundary of this bench: node has no DOM parser and the renderer reaches for one.
    ctx.DOMParser = class {
        parseFromString() {
            return { body: { textContent: '', innerHTML: '' }, querySelector: () => null, querySelectorAll: () => [] };
        }
    };

    return nodes;
}

/** One cascade pass with the samples this run was given, then the product's own render of its results. */
function renderAfterAPass(samples, search) {
    const bench = load();
    const ctx = bench.ctx;
    ctx.location.search = search;
    withSamples(bench, samples);
    const nodes = pageWithCards(ctx);

    /**
     * GH-782 (queue item 3ga): the inputs carry the site's methodology, because the soil engine computes nothing
     * without one - a site with no methodology is not a case the product allows (the owner, 24.09.2026), and the
     * `|| "slan"` that used to stand in its place is what hid this item's defect.
     */
    const result = ctx.GilbaCascadeOrchestrator.runCascade(
        { inputs: { soil: { ppm: {}, methodology: 'slan' }, turf: {}, water: {} }, computed: {}, derived: {} },
        {}, { fullRecompute: true });
    const args = ctx.gaip_extractCascadeResults(result, {}, {});

    let threw = null;
    try {
        ctx.gaip_render_results({ soil: { ppm: { K: 40 } }, turf: {} }, { current: {} },
            args.l, args.d, args.oe, args.ne, args.ae, args.me, args.se, args.le);
    } catch (e) {
        threw = (e && e.message) || String(e);
    }
    const soilCard = String((nodes['.gaip-mlsn-body'] || {}).innerHTML || '').replace(/\s+/g, ' ');

    process.stdout.write('[gh777] address ' + JSON.stringify(search)
        + ' -> the table handed to the renderer is a ' + typeof args.l + ': '
        + JSON.stringify(args.l).slice(0, 70)
        + '\n[gh777]   the renderer threw: ' + JSON.stringify(threw)
        + '\n[gh777]   the soil card says: ' + JSON.stringify(soilCard.slice(0, 160)) + '\n');

    return { threw, soilCard, table: args.l };
}

describe('GH-777 — the renderer reads a table that was never computed', () => {
    test('POSITIVE CONTROL: with the sample there, the engine produces a table and it is a string', () => {
        // Without this, "no crash" below could be true of a bench where the engine never runs at all.
        const { table, threw } = renderAfterAPass(
            { soil: { id: 'soil_1', rawData: { K: 40, Ca: 803, CEC: 5.9, pH: 6 } } }, '?soil=soil_1');

        expect(typeof table).toBe('string');
        expect(threw).toBeNull();
    });

    test('told there is no soil sample: the table is absent, and the run is not ended by it', () => {
        const { threw, soilCard, table } = renderAfterAPass({}, '?soil=none&tissue=none');

        // The shape that crashed: an object where a table was expected.
        expect(typeof table).toBe('object');
        // And it is read, not crashed on. The measured message is named so a return of it is recognised.
        expect(threw).toBeNull();
        expect(String(threw)).not.toMatch(/indexOf/);
        // Nothing is invented either: a section with no table says what a section with no soil test says.
        expect(soilCard).toContain('No soil test results entered');
        expect(soilCard).not.toMatch(/ACCEPTABLE|DEFICIENT|BORDERLINE/);
    });
});

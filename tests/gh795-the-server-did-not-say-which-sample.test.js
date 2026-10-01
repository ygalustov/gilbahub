'use strict';

/**
 * GH-795 (queue item 3vae) — WHEN THE SERVER DID NOT SAY WHICH SAMPLE TO USE, NO SAMPLE IS USED, AND THE ROW
 * SAYS WHY.
 *
 * WHERE "THE SERVER DID NOT SAY" COMES FROM. The opener asks the server which sample this run should compute
 * (`dashboard-ui.js`, `askServerForSample`) and puts the answer on the frame's address. There are three
 * answers -- a row id, `none`, and `unknown` -- and `unknown` covers every failure: no network, a reply that
 * is not `ok`, no site id, a shape nobody expected. Inside the frame the chooser answered `unknown` the same
 * way it answers "nobody asked": with `null`. And `null` means "take the page's ACTIVE sample". So a failure
 * to ask the server ended in a calculation over a sample the server never named -- the class of GH-459, a
 * result about one object composed from the state of the page it was drawn on.
 *
 * THE SIGN, MEASURED BEFORE THE CHANGE. `runStart.named.soil` is `unknown` in 0 of 132 stored rows, and
 * `named.tissue` in 0 of 132 as well; 36 rows carry a recorded start at all and every one of them names a
 * row id. So this is a reachable class that has not yet fired. What it is exposed to is 10 of the 13 sites
 * that have a run: those are the ones holding a live soil sample, which is what would have been computed in
 * the server's place. The other side of the same discriminator IS live -- `named.tissue` is `none` in 7 rows
 * -- so the case that keeps `none` saying what it says today is guarding a real sentence, not a hypothesis.
 *
 * WHAT IS ASSERTED IS THE CONSEQUENCE, on the product's own pass: which sample the chooser hands over, which
 * modules the pass ran, and what the pass recorded for the ones it did not. Each outcome is asserted next to
 * the others, because the point of the item is that they are DIFFERENT facts: told there is none, not told
 * at all, and told a name that the store does not hold.
 */

const { load, withSamples } = require('./lib/orchestrator-bench');

const SOIL_SAMPLE = { id: 'sample_200', serverId: 200, rawData: { K: 40, Ca: 803, CEC: 5.9, pH: 6 } };
const TISSUE_SAMPLE = { id: 'sample_201', serverId: 201, rawData: { N: 3.6, K: 2.4, P: 0.45 } };
const WEATHER = { current: { airTemp: 18, soilTemp: 16 } };

/** One real cascade pass of the runner, at the address the opener would have built. */
function passAt(search, rows) {
    const bench = load();
    if (bench.failed.length) throw new Error('the bench did not load: ' + JSON.stringify(bench.failed));
    const ctx = bench.ctx;
    ctx.location.search = search;
    ctx.GAIP_HUB_CONFIG = Object.assign({}, ctx.GAIP_HUB_CONFIG, { activeSiteId: 'site-1' });
    withSamples(bench, rows || {});
    const hubRoot = { querySelector: () => null, querySelectorAll: () => [] };
    const out = ctx.gaip_runCascadePass('run-button', hubRoot, WEATHER, null);
    const state = ctx.GaipOrchestrator.getState();
    const computed = state.computed || {};
    const told = { soil: ctx.gaip_namedSample('soil'), tissue: ctx.gaip_namedSample('tissue') };
    const inHand = { soil: ctx.gaip_sampleInHand('soil'), tissue: ctx.gaip_sampleInHand('tissue') };

    process.stdout.write('[gh795] address ' + JSON.stringify(search)
        + '\n[gh795]   the chooser says: ' + JSON.stringify({
            soil: typeof told.soil === 'object' && told.soil ? 'the row itself' : told.soil,
            tissue: typeof told.tissue === 'object' && told.tissue ? 'the row itself' : told.tissue,
        })
        + '\n[gh795]   the sample in hand: ' + JSON.stringify({
            soil: inHand.soil ? (inHand.soil.id || 'a row') : null,
            tissue: inHand.tissue ? (inHand.tissue.id || 'a row') : null,
        })
        + '\n[gh795]   ran: ' + JSON.stringify(((out && out.result) || {}).executionOrder || [])
        + '\n[gh795]   computed carries: ' + JSON.stringify(Object.keys(computed))
        + '\n[gh795]   skipped: ' + JSON.stringify(computed.skipped || [])
        + '\n[gh795]   not applicable: ' + JSON.stringify(computed.notApplicable || []) + '\n');

    return {
        ctx, computed, told, inHand, bench,
        skipped: computed.skipped || [],
        notApplicable: computed.notApplicable || [],
        ran: ((out && out.result) || {}).executionOrder || [],
    };
}

const skipFor = (list, module) => list.find((s) => s && s.module === module) || null;
const naFor = (list, module) => list.find((e) => e && e.module === module) || null;

describe('GH-795 — the server did not say which sample to compute', () => {
    jest.setTimeout(300000);

    test('POSITIVE CONTROL: told a row id, the pass computes THAT sample and records no skip for it', () => {
        const { told, inHand, skipped, notApplicable } = passAt(
            '?rerun=r1&site=site-1&soil=200&tissue=201&water=none',
            { soil: SOIL_SAMPLE, tissue: TISSUE_SAMPLE });

        // Without this the cases below could be true of a pass where nothing was ever named or found.
        expect(typeof told.soil).toBe('object');
        expect(inHand.soil && inHand.soil.id).toBe('sample_200');
        expect(skipFor(skipped, 'mlsn')).toBeNull();
        expect(skipFor(skipped, 'tissue')).toBeNull();
        expect(naFor(notApplicable, 'mlsn')).toBeNull();
    });

    test('TOLD THERE IS NONE: the gate records it, with the input, and no skip is written', () => {
        const { told, skipped, notApplicable } = passAt(
            '?rerun=r1&site=site-1&soil=none&tissue=none&water=none', {});

        expect(told.soil).toBe('none');
        expect(naFor(notApplicable, 'mlsn').missing).toEqual(['samples.soil']);
        expect(naFor(notApplicable, 'tissue').missing).toEqual(['samples.tissue']);
        // This is the sentence a client reads today -- "has not been entered" -- and it stays that way.
        expect(skipFor(skipped, 'mlsn')).toBeNull();
        expect(skipFor(skipped, 'tissue')).toBeNull();
    });

    test('NOT TOLD AT ALL: the page\'s active sample is not computed in the server\'s place', () => {
        const { told, inHand, ran } = passAt(
            '?rerun=r1&site=site-1&soil=unknown&tissue=unknown&water=none',
            { soil: SOIL_SAMPLE, tissue: TISSUE_SAMPLE });

        // The store HELD a sample, which is what makes this case the class it is.
        expect(told.soil).toBe('unknown');
        expect(told.tissue).toBe('unknown');
        expect(inHand.soil).toBeNull();
        expect(inHand.tissue).toBeNull();
        expect(ran).not.toContain('mlsn-calculator');
        expect(ran).not.toContain('tissue-engine');
    });

    test('NOT TOLD AT ALL: the pass records the reason, and the gate does not record its own', () => {
        const { skipped, notApplicable, computed } = passAt(
            '?rerun=r1&site=site-1&soil=unknown&tissue=unknown&water=none',
            { soil: SOIL_SAMPLE, tissue: TISSUE_SAMPLE });

        expect(skipFor(skipped, 'mlsn').reason).toBe('sample-not-named');
        expect(skipFor(skipped, 'mlsn').producer).toBe('cascade');
        expect(skipFor(skipped, 'tissue').reason).toBe('sample-not-named');
        expect(skipFor(skipped, 'tissue').producer).toBe('cascade');
        // "Add a soil test" would be false here: the site may well have one. The gate stays out of it.
        expect(naFor(notApplicable, 'mlsn')).toBeNull();
        expect(naFor(notApplicable, 'tissue')).toBeNull();
        // And nothing was computed from the sample nobody named.
        expect(computed.mlsn === undefined || computed.mlsn === null || computed.mlsn === '').toBe(true);
    });

    test('THE DISCRIMINATOR: one store, two answers, two different records', () => {
        const none = passAt('?rerun=r1&site=site-1&tissue=none&soil=none&water=none', {});
        const unknown = passAt('?rerun=r1&site=site-1&tissue=unknown&soil=none&water=none', {});

        process.stdout.write('[gh795] the discriminator -> told `none`: '
            + JSON.stringify({ na: !!naFor(none.notApplicable, 'tissue'), skip: !!skipFor(none.skipped, 'tissue') })
            + ' | told `unknown`: '
            + JSON.stringify({ na: !!naFor(unknown.notApplicable, 'tissue'), skip: !!skipFor(unknown.skipped, 'tissue') })
            + '\n');

        expect(naFor(none.notApplicable, 'tissue')).not.toBeNull();
        expect(skipFor(none.skipped, 'tissue')).toBeNull();
        expect(naFor(unknown.notApplicable, 'tissue')).toBeNull();
        expect(skipFor(unknown.skipped, 'tissue').reason).toBe('sample-not-named');
    });

    test('TOLD A NAME THE STORE DOES NOT HOLD: the tissue side says so, as the soil side already does', () => {
        const { told, skipped, notApplicable } = passAt(
            '?rerun=r1&site=site-1&soil=200&tissue=999&water=none',
            { soil: SOIL_SAMPLE });

        expect(told.tissue).toBe('not-found');
        expect(skipFor(skipped, 'tissue').reason).toBe('tissue-sample-not-loaded');
        // Not "a tissue test has not been entered": one was named, and it did not arrive.
        expect(naFor(notApplicable, 'tissue')).toBeNull();
    });
});

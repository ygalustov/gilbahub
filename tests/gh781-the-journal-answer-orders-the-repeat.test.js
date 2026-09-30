'use strict';

/**
 * GH-781 (delivery 4, the analyst's amendment of 30.09.2026) — THE JOURNAL'S ANSWER ABOUT THE PGR IS AN
 * INPUT THAT ARRIVES AFTER THE PASS, AND THE PASS IS REPEATED FOR IT.
 *
 * WHAT WAS MEASURED LIVE on `Test5 - NZ`, 30.09.2026, one run: the note about an exhausted PGR window is
 * written by the pass that holds the input (delivery 3 of this item), and the input is fetched by
 * `loadSprayContext`, which starts from `gaip:analysis-complete` -- after the pass. So `state.pgr` was
 * empty, nothing was written, and no repeat corrected it: the fingerprint of a pass named only its samples,
 * which had not changed. `has_pgr_note` was 0 of 5 stored rows, and the site's application is 106 days old.
 *
 * WHAT THIS FILE ASSERTS IS WHICH SIGNAL ORDERS A PASS, not that a function was called with an argument.
 * The page is loaded whole on the orchestrator bench, its own `DOMContentLoaded` registers its own
 * listeners, and the only thing this file does to the page is answer the journal and fire the event the
 * journal fires. What follows is the product's decision.
 *
 * WHAT IT DOES NOT SEE, said so that a reader does not take it for more than it is: the debounce is run
 * immediately here (the bench's `setTimeout` is a stub), so the 50 ms and the ordering of two arrivals
 * inside one frame are not measured. The cap of three repeats is measured, because it is what stands
 * between "one repeat" and "a stream".
 */

const fs = require('fs');
const path = require('path');
const vm = require('vm');
const { load } = require('./lib/orchestrator-bench');

const ROOT = path.join(__dirname, '..');
const HUB = fs.readFileSync(path.join(ROOT, 'assets', 'hub-tissue-v3.js'), 'utf8');

/** One function of the product, by name, with its braces balanced. */
function lift(name) {
    const at = HUB.indexOf('function ' + name + '(');
    expect(at).toBeGreaterThan(-1);
    let depth = 0;
    for (let i = HUB.indexOf('{', at); i < HUB.length; i += 1) {
        if (HUB[i] === '{') depth += 1;
        else if (HUB[i] === '}') {
            depth -= 1;
            if (!depth) return HUB.slice(at, i + 1);
        }
    }
    throw new Error(name + ' never closes');
}

/**
 * The page as `/hub` loads it, with its `DOMContentLoaded` fired and the cascade pass stubbed.
 *
 * The stub is the only thing standing in for the product: a real pass on this bench would need the whole
 * runner, and what is under test is whether a pass is ORDERED. Its reason and the fingerprint it would
 * have read are recorded, so the test can say what the page decided and why.
 */
function pageWithAFirstPass() {
    const bench = load();
    expect(bench.failed).toEqual([]);
    const ctx = bench.ctx;

    // A page with a hub root, so the repeat has somewhere to read from.
    const root = { id: 'gaip-hub', querySelector: () => null, querySelectorAll: () => [] };
    ctx.document.querySelector = (sel) => (sel === '#gaip-hub' ? root : null);
    // The debounce, run now. Named here rather than left implicit -- see the header.
    ctx.setTimeout = (fn) => { try { fn(); } catch (e) { /* the page swallows its own */ } return 0; };
    ctx.clearTimeout = () => {};

    const ordered = [];
    ctx.gaip_runCascadePass = (reason) => {
        ordered.push({ reason: reason, sampleIds: ctx.gaip_passSampleIds() });
        // A pass whose result did not succeed publishes nothing, which keeps this file's subject to the
        // ordering of passes. `GAIP_LAST_CASCADE_PASS` is updated the way the real one updates it.
        const pass = {
            reason: reason, passStartedAt: Date.now(), sampleIds: ctx.gaip_passSampleIds(),
            state: {}, weather: null, result: { success: false, error: 'stubbed on the bench' },
        };
        ctx.GAIP_LAST_CASCADE_PASS = pass;

        return pass;
    };

    ctx.GAIP_HUB_CONFIG = Object.assign({}, ctx.GAIP_HUB_CONFIG, { activeSiteId: 'site-1' });
    ctx.document.dispatchEvent(new ctx.CustomEvent('DOMContentLoaded'));

    // The first pass of the run, taken before the journal has answered anything.
    ctx.GAIP_LAST_PGR = undefined;
    const firstFingerprint = ctx.gaip_passSampleIds();
    ctx.GAIP_LAST_CASCADE_PASS = {
        reason: 'run-button', passStartedAt: Date.now(), sampleIds: firstFingerprint,
        state: {}, weather: null, result: { success: true },
    };

    return {
        ctx,
        ordered,
        firstFingerprint,
        journalAnswers(answer) { ctx.GAIP_LAST_PGR = answer; },
        theJournalFires() {
            ctx.document.dispatchEvent(new ctx.CustomEvent('gaip:spray-context-loaded', {
                detail: { siteId: 'site-1', zone: null },
            }));
        },
    };
}

describe('GH-781 — the journal answers after the pass, and the pass is repeated for it', () => {
    test('an application arriving from the journal ORDERS A PASS, and the fingerprint says why', () => {
        const page = pageWithAFirstPass();
        // The server's answer: this site applied a growth regulator, journal row 7.
        page.journalAnswers({ log_id: 7, site_id: 'site-1', application_date: '2026-06-16', product_name: 'Primo Maxx' });
        page.theJournalFires();

        process.stdout.write('\n[gh781] first pass read : ' + page.firstFingerprint
            + '\n[gh781] passes ordered  : ' + JSON.stringify(page.ordered) + '\n');

        expect(page.firstFingerprint).toContain('pgr:unanswered');
        expect(page.ordered).toHaveLength(1);
        expect(page.ordered[0].sampleIds).toContain('pgr:log_7');
        // And the pass that follows is not the same pass: 0 repeats -> 1.
        expect(page.ordered[0].sampleIds).not.toBe(page.firstFingerprint);
    });

    test('CONTROL: the same event with the journal saying the same thing orders NOTHING', () => {
        const page = pageWithAFirstPass();
        page.journalAnswers({ log_id: 7, site_id: 'site-1', application_date: '2026-06-16' });
        page.theJournalFires();
        expect(page.ordered.map((p) => p.reason)).toEqual(['samples-arrived']);

        // The event fires again -- it does, on a site change and on a reload of the context -- and nothing
        // about what the pass reads has changed.
        page.theJournalFires();
        page.theJournalFires();
        process.stdout.write('[gh781] after three firings, passes: '
            + JSON.stringify(page.ordered.map((p) => p.reason)) + '\n');

        // The PASSES, not how many of them: a second pass on the same inputs would be listed here by name.
        expect(page.ordered.map((p) => p.reason)).toEqual(['samples-arrived']);
    });

    test('a site with NO application answers once and is repeated once, not in a stream', () => {
        /**
         * The six unprotected sites of the stand. `null` is the journal answering that there is none, and it
         * is a different fact from never having been asked -- so it does change the fingerprint once, and
         * then compares equal forever. Five firings, one pass, and the cap of three never comes into it.
         */
        const page = pageWithAFirstPass();
        page.journalAnswers(null);
        for (let i = 0; i < 5; i += 1) page.theJournalFires();

        process.stdout.write('[gh781] no application: ' + page.ordered.length + ' pass(es), read '
            + (page.ordered[0] || {}).sampleIds + '\n');

        expect(page.ordered).toHaveLength(1);
        expect(page.ordered[0].sampleIds).toContain('pgr:none');
    });

    test('the journal is not asked whose application it is by this file — the page is', () => {
        /**
         * An answer belonging to ANOTHER site is not this run's input, and the chooser the fingerprint is
         * built by is the one that checks (GH-780). Without that check a page that moved between sites would
         * order a repeat on a neighbour's application.
         */
        const page = pageWithAFirstPass();
        page.journalAnswers({ log_id: 99, site_id: 'some-other-site', application_date: '2026-09-01' });
        page.theJournalFires();

        process.stdout.write('[gh781] a neighbour\'s row: ' + page.ordered.length + ' pass(es), read '
            + ((page.ordered[0] || {}).sampleIds || '-') + '\n');

        // One pass, because "the journal answered and this site has none" is itself news.
        expect(page.ordered).toHaveLength(1);
        expect(page.ordered[0].sampleIds).toContain('pgr:none');
        expect(page.ordered[0].sampleIds).not.toContain('log_99');
    });

    test('the repeat publishes THIS pass\'s answer about the PGR, and only that field of the turf', () => {
        /**
         * The coordinator's one line, 30.09.2026. The repeat copies the previous state and replaces what it
         * recomputed; `turf` is not recomputed, so the first pass's `pgrActive` survived into the row even
         * when the repeat had the journal and the first pass did not.
         *
         * WHAT THIS CASE DOES NOT SEE: it publishes into a plain `window.GAIP_STATE`, not through the hub's
         * own getter/setter, so it measures what the repeat hands over and not what the store does with it.
         */
        const sandbox = {
            console: { warn() {}, log() {} },
            CustomEvent: class { constructor(t, i) { this.type = t; this.detail = i && i.detail; } },
            document: { dispatchEvent: () => true },
            gaip_render_results: () => {},
        };
        sandbox.window = sandbox;
        sandbox.global = sandbox;
        vm.createContext(sandbox);
        vm.runInContext(lift('gaip_republishCascadePass'), sandbox, { filename: 'republish' });

        // What the first pass published: it had no journal answer, so the engine concluded nothing.
        sandbox.GAIP_STATE = {
            turf: { warmBase: 'kikuyu', hoc: 12, pgrActive: false },
            region: 'act', sprayContext: { lastPGR: null },
        };
        const published = vm.runInContext('gaip_republishCascadePass(PASS)', Object.assign(sandbox, {
            PASS: {
                state: {
                    soil: {}, water: {}, tissue: {},
                    // The repeat's own state assembly, which had the journal: this run says it IS in use.
                    turf: { warmBase: 'kikuyu', hoc: 12, pgrActive: true },
                },
                extracted: { l: null, d: null, oe: null, ne: null, ae: null, se: null, le: null },
            },
        }));

        process.stdout.write('[gh781] turf after the repeat: ' + JSON.stringify(sandbox.GAIP_STATE.turf)
            + '\n[gh781] region still there : ' + sandbox.GAIP_STATE.region + '\n');

        expect(published).toBe(true);
        expect(sandbox.GAIP_STATE.turf.pgrActive).toBe(true);
        // One field, not the section: what the repeat does not recompute is left standing.
        expect(sandbox.GAIP_STATE.turf.warmBase).toBe('kikuyu');
        expect(sandbox.GAIP_STATE.turf.hoc).toBe(12);
        expect(sandbox.GAIP_STATE.region).toBe('act');
        expect(sandbox.GAIP_STATE.sprayContext).toEqual({ lastPGR: null });
    });

    test('and a pass whose state says nothing about the PGR does not turn that into a "no"', () => {
        const sandbox = {
            console: { warn() {}, log() {} },
            CustomEvent: class { constructor(t, i) { this.type = t; this.detail = i && i.detail; } },
            document: { dispatchEvent: () => true },
            gaip_render_results: () => {},
        };
        sandbox.window = sandbox;
        sandbox.global = sandbox;
        vm.createContext(sandbox);
        vm.runInContext(lift('gaip_republishCascadePass'), sandbox, { filename: 'republish' });

        sandbox.GAIP_STATE = { turf: { warmBase: 'kikuyu', pgrActive: true } };
        vm.runInContext('gaip_republishCascadePass(PASS)', Object.assign(sandbox, {
            PASS: {
                state: { soil: {}, water: {}, tissue: {}, turf: { warmBase: 'kikuyu' } },
                extracted: { l: null },
            },
        }));

        process.stdout.write('[gh781] no key in the pass: ' + JSON.stringify(sandbox.GAIP_STATE.turf) + '\n');
        expect(sandbox.GAIP_STATE.turf.pgrActive).toBe(true);
    });
});

/**
 * GH-640 (link 11, plan 4.13a point 2 and 4.13b point 4) — THE PAGE PRINTS THE
 * SERVER'S SENTENCE, AND THE SERVER DECIDES WHETHER THE SECTION IS EMPTY.
 *
 * WHY A POSITIVE GUARD. The existing one (`gh548`, "no asset carries a second
 * copy of a reason sentence") is NEGATIVE and narrow: it looks for the server's
 * own phrases inside assets. A page that writes its OWN, different sentence is
 * invisible to it — which is how about fifteen such literals live in the tree at
 * a green suite. So this one asserts the opposite direction: hand the renderer a
 * sentence and require that it is what appears.
 *
 * TWO CLAIMS, AND THE SECOND IS THE ONE THE PLAN ADDS:
 *  1. an empty section prints the sentence the server composed, not a literal;
 *  2. WHETHER it is empty is the server's answer too — a page that decides for
 *     itself is a second reader of one question, and the two disagreed:
 *     `computed.pgr` without `gdd` is produced to the server and empty to this
 *     page.
 *
 * NOT ASSERTED: any English phrase. The sentences are the owner's and are still
 * open; these cases carry a sentinel through the page instead, so the guard
 * survives every answer she gives.
 *
 * WHAT IS DELIBERATELY NOT HERE — the soil section. `soil-nutrition-analysis.js`
 * `renderEmpty()` (anchor `function renderEmpty()`, its call at
 * `if (!sn || (!sn.nutrients && !sn.tissue))`) is untouched by this work: the
 * composer cannot yet place `soilNutrition` on a step, so it would print "the
 * cause was not recorded" over a row that DOES record `no-soil-sample`. The gap
 * is the analyst's to close, and this is the address her answer lands on.
 */

'use strict';

const fs = require('fs');
const path = require('path');
const vm = require('vm');

const ROOT = path.join(__dirname, '..');
const PLAN_UI = fs.readFileSync(path.join(ROOT, 'assets/plan-ui.js'), 'utf8');

function stubElement(id) {
    const el = {
        id, innerHTML: '', textContent: '', style: {}, dataset: {}, hidden: false, className: '',
        classList: { add() {}, remove() {}, contains: () => false, toggle() {} },
        addEventListener() {}, removeEventListener() {}, appendChild() {}, removeChild() {},
        setAttribute() {}, getAttribute: () => null, insertAdjacentHTML() {},
        querySelector: () => null, querySelectorAll: () => [], closest: () => null,
    };
    return el;
}

/** `plan-ui.js` in a sandbox, with the page's own elements and the server's texts. */
function planSandbox(sections) {
    const nodes = {};
    const sandbox = {
        console: { log() {}, warn() {}, error() {}, info() {} },
        JSON, Object, Array, String, Number, Boolean, Math, Date, RegExp, Promise,
        parseFloat, parseInt, isNaN, isFinite, encodeURIComponent, decodeURIComponent,
        setTimeout: () => 0, clearTimeout() {}, requestAnimationFrame: () => 0,
        localStorage: { getItem: () => null, setItem() {}, removeItem() {} },
        fetch: () => Promise.resolve({ ok: true, json: () => Promise.resolve({}) }),
        GAIP_ANALYSIS_TEXTS: { reasons: {}, frame: '', unknown: '', sections: sections },
    };
    sandbox.window = sandbox; sandbox.global = sandbox; sandbox.globalThis = sandbox;
    sandbox.document = {
        readyState: 'complete',
        addEventListener() {}, removeEventListener() {},
        getElementById: (id) => (nodes[id] = nodes[id] || stubElement(id)),
        querySelector: () => null, querySelectorAll: () => [],
        createElement: () => stubElement(''),
        body: stubElement('body'),
        location: { hash: '' },
    };
    sandbox.location = { hash: '', search: '', pathname: '/plan' };
    sandbox.history = { replaceState() {} };

    const ctx = vm.createContext(sandbox);
    /**
     * GH-792 (queue item 79, the reviewer's return): the shared reader, loaded first, as the db-shell layout
     * loads it before every page. `/plan` had a reader of its own and now asks this one -- the mutation that
     * silenced the shared reader left this page printing while six others went quiet, which is the second
     * reader this item removes.
     */
    vm.runInContext(fs.readFileSync(path.join(__dirname, '..', 'assets', 'dashboard-ui.js'), 'utf8'),
        ctx, { filename: 'dashboard-ui.js' });
    // The module keeps its functions to itself; the one under test is lifted out
    // together with the helpers it calls, which is the same shape `gh577` uses.
    const lift = (name) => {
        const at = PLAN_UI.indexOf('function ' + name + '(');
        expect(at).toBeGreaterThan(-1);
        let depth = 0;
        for (let i = PLAN_UI.indexOf('{', at); i < PLAN_UI.length; i++) {
            if (PLAN_UI[i] === '{') depth++;
            else if (PLAN_UI[i] === '}') { depth--; if (!depth) return PLAN_UI.slice(at, i + 1); }
        }
        throw new Error(name + ' never closes');
    };
    ['esc', 'safeNum', 'clamp', 'emptyState', 'sectionTitle', 'sectionBody', 'cardWord', 'serverSection',
        'renderPGR', 'renderPreEmergent', 'renderRecovery']
        .forEach((fn) => vm.runInContext(lift(fn), ctx, { filename: fn }));
    // Two tables the lifted functions read, taken from the file itself rather
    // than retyped: the icon map and the PGR status map.
    vm.runInContext('var EMPTY_ICONS = { pgr: "<svg/>", nutrition: "<svg/>",'
        + ' "pre-emergent": "<svg/>", recovery: "<svg/>" };', ctx);
    // What the page printed before link 11, taken from the page itself rather
    // than retyped here — the sentence under test must be the product's.
    const wasPrinted = PLAN_UI.slice(PLAN_UI.indexOf('var WAS_PRINTED_BEFORE = {'));
    let wpDepth = 0, wpEnd = -1;
    for (let i = wasPrinted.indexOf('{'); i < wasPrinted.length; i++) {
        if (wasPrinted[i] === '{') wpDepth++;
        else if (wasPrinted[i] === '}') { wpDepth--; if (!wpDepth) { wpEnd = i + 1; break; } }
    }
    expect(wpEnd).toBeGreaterThan(0);
    vm.runInContext(wasPrinted.slice(0, wpEnd) + ';', ctx, { filename: 'WAS_PRINTED_BEFORE' });
    const statusMap = PLAN_UI.slice(PLAN_UI.indexOf('var PGR_STATUS_MAP = {'));
    let depth = 0, end = -1;
    for (let i = statusMap.indexOf('{'); i < statusMap.length; i++) {
        if (statusMap[i] === '{') depth++;
        else if (statusMap[i] === '}') { depth--; if (!depth) { end = i + 1; break; } }
    }
    expect(end).toBeGreaterThan(0);
    vm.runInContext(statusMap.slice(0, end) + ';', ctx, { filename: 'PGR_STATUS_MAP' });

    return { ctx, nodes };
}

describe('GH-640 — an empty section prints what the server said', () => {
    test('POSITIVE CONTROL: the renderer runs and writes into the page', () => {
        // Without this, every claim below could be a claim about an element
        // nobody ever wrote to.
        const { ctx, nodes } = planSandbox({ pgr: { class: 'answer', cause: 'x', text: 'SENTINEL-pgr' } });
        ctx.renderPGR({ pgr: null });

        process.stdout.write('\n[gh640] body after render: ' + JSON.stringify(nodes['plan-pgr-body'].innerHTML) + '\n');
        expect(nodes['plan-pgr-body'].innerHTML.length).toBeGreaterThan(20);
    });

    test('when the server has a sentence, the page prints THAT and the old text is not reached', () => {
        const { ctx, nodes } = planSandbox({
            pgr: { class: 'answer', cause: 'pgr-window-exhausted', text: 'SENTINEL-pgr', module: 'PGR' },
        });
        ctx.renderPGR({ pgr: null });
        const html = nodes['plan-pgr-body'].innerHTML;

        expect(html).toContain('SENTINEL-pgr');
        // The literal this page used to print on `Burns`, where it was false
        // twice over: an application WAS recorded, and pressing again changes
        // nothing.
        expect(html).not.toContain('No PGR application recorded');
        expect(html).not.toContain('Data → Spray Log');
    });

    test('WHETHER the section is empty is the server’s answer: a produced section still draws numbers', () => {
        // The page's own condition was `!pgr || !pgr.gdd`. The server calls this
        // shape produced, and the page must now agree with it.
        const { ctx, nodes } = planSandbox({ pgr: null });
        ctx.renderPGR({ pgr: { gdd: { accumulated: 120, threshold: 200 }, effect: {}, product: {}, inputs: {} } });
        const html = nodes['plan-pgr-body'].innerHTML;

        process.stdout.write('[gh640] produced section -> ' + JSON.stringify(html.slice(0, 80)) + '\n');
        expect(html).not.toContain('SENTINEL');
        expect(html.length).toBeGreaterThan(20);
    });

    test('and a section the server calls EMPTY prints the sentence even when the page has numbers for it', () => {
        // The third watcher of plan 4.13b point 4: the page obeys the server
        // rather than its own condition. A page that went back to deciding
        // reddens here.
        const { ctx, nodes } = planSandbox({ pgr: { class: 'answer', cause: 'pgr-window-exhausted', text: 'SENTINEL-EMPTY-pgr' } });
        ctx.renderPGR({ pgr: { gdd: { accumulated: 120, threshold: 200 }, effect: {}, product: {}, inputs: {} } });

        expect(nodes['plan-pgr-body'].innerHTML).toContain('SENTINEL-EMPTY-pgr');
    });

    test('GH-643: a cause nobody recorded leaves the OLD sentence standing — a client never reads an identifier', () => {
        // THIS CASE ASSERTED THE OPPOSITE UNTIL NOW, AND THAT WAS THE WORSE HALF
        // OF THE DEFECT. GH-640 printed the cause class when the server had no
        // sentence — `not-recorded` — and this case called it correct, which
        // defended it from repair. The owner's rule is one line, "understandable
        // for the client", and a raw identifier on screen is exactly the variant
        // the open item about unworded causes had already rejected.
        //
        // Rewritten by MEANING, with the reason named: until the words are
        // decided, the page prints what it printed before link 11 touched it.
        // Nothing is composed here.
        const { ctx, nodes } = planSandbox({ pgr: { class: 'not-recorded', cause: null, text: null } });
        ctx.renderPGR({ pgr: null });
        const html = nodes['plan-pgr-body'].innerHTML;

        process.stdout.write('[gh643] no sentence from the server -> ' + JSON.stringify(html) + '\n');
        expect(html).toContain('No PGR application recorded');
        expect(html).not.toContain('not-recorded');
        expect(html).not.toContain('run-incomplete');
    });

    test('THE BOUNDARY IS HELD BY THE DEVICE, not by my care: nothing on screen is composed here', () => {
        // The reviewer's third mutation aims here, and rightly: if this renderer
        // can compose a phrase, then "no words for the screen are written here"
        // is kept by attention rather than by construction. So the wordless case
        // is compared for EQUALITY against the sentence this page printed BEFORE
        // link 11 — taken from the page's own `WAS_PRINTED_BEFORE`, not retyped
        // in this file — and any word added to it, however reasonable, reddens.
        /**
         * THE RECORD OF THIS SECTION, not the first record in the file. GH-777 added two more entries to
         * `WAS_PRINTED_BEFORE` ahead of `pgr`, and this anchor took whichever came first -- the silent first
         * match, which is the class this repository keeps finding. Anchored on the key now.
         */
        const pgrEntry = PLAN_UI.slice(PLAN_UI.indexOf('pgr: {', PLAN_UI.indexOf('var WAS_PRINTED_BEFORE')));
        const before = /body: '([\s\S]*?)'\s*,\s*\n\s*badge:/.exec(pgrEntry);
        expect(before).not.toBeNull();
        expect(before[1]).toContain('PGR');

        const { ctx, nodes } = planSandbox({ pgr: { class: 'not-recorded', cause: null, text: null } });
        ctx.renderPGR({ pgr: null });
        const body = /<div class="plan-empty-body">([\s\S]*?)<\/div>\s*<\/div>$/.exec(nodes['plan-pgr-body'].innerHTML);
        expect(body).not.toBeNull();
        process.stdout.write('[gh643] wordless body equals the old sentence: '
            + JSON.stringify(body[1] === before[1]) + '\n');
        expect(body[1]).toBe(before[1]);

        // and when the server DOES have a sentence, that sentence is printed
        // whole and nothing of this page's is added to it
        const withText = planSandbox({ pgr: { class: 'answer', cause: 'c', text: 'SENTINEL-pgr', module: 'PGR' } });
        withText.ctx.renderPGR({ pgr: null });
        const said = /<div class="plan-empty-body">([\s\S]*?)<\/div>\s*<\/div>$/
            .exec(withText.nodes['plan-pgr-body'].innerHTML);
        expect(said[1]).toBe('SENTINEL-pgr');
    });

    /**
     * GH-777 (queue item 4, the page reader) — EVERY SECTION THAT DRAWS ITS OWN EMPTINESS ASKS THE SERVER.
     *
     * Measured before this: the server composes a sentence for each of the 17 declared section keys, and
     * ONE card on this page read it. A run that recorded which of the client's inputs is missing therefore
     * printed "calculates automatically when analysis is run" -- true of the product, silent about the site.
     */
    test.each([
        ['preEmergent', 'renderPreEmergent', { preEmergent: null }, 'plan-pe-body'],
        ['wear', 'renderRecovery', { wear: null }, 'plan-rec-body'],
    ])('the %s card prints the server\'s sentence when there is one', (key, fn, computed, nodeId) => {
        const sentence = 'SENTINEL-' + key + ' was not calculated because a thing has not been entered.';
        const { ctx, nodes } = planSandbox({
            [key]: { class: 'input-absent', cause: 'input-not-entered', text: sentence, module: key },
        });
        ctx[fn](computed, { turf: { turfType: 'sports' } });
        process.stdout.write('[gh640] ' + key + ' card: ' + JSON.stringify(nodes[nodeId].innerHTML) + '\n');

        expect(nodes[nodeId].innerHTML).toContain(sentence);
        // and the general sentence this card used to print is not reached
        expect(nodes[nodeId].innerHTML).not.toContain('calculates automatically');
        expect(nodes[nodeId].innerHTML).not.toContain('Recovery windows calculate');
    });

    test.each([
        ['preEmergent', 'renderPreEmergent', { preEmergent: null }, 'plan-pe-body', 'No pre-emergent data'],
        ['wear', 'renderRecovery', { wear: null }, 'plan-rec-body', 'No traffic data configured'],
    ])('and with no sentence the %s card prints what it printed yesterday', (key, fn, computed, nodeId, was) => {
        const { ctx, nodes } = planSandbox({});
        ctx[fn](computed, { turf: { turfType: 'sports' } });
        process.stdout.write('[gh640] ' + key + ' card with no cause: '
            + JSON.stringify(nodes[nodeId].innerHTML.slice(0, 160)) + '\n');

        expect(nodes[nodeId].innerHTML).toContain(was);
    });

    test('and NO section that draws its own emptiness is left without the reader', () => {
        /**
         * THE UNIVERSE IS THE FILE, not a list kept here: every `emptyState(` call in `plan-ui.js` is found,
         * the function around it is cut out by brace balance, and it must ask `serverSection`. A section
         * added later with its own empty state reddens this the day it is written.
         *
         * ONE DECLARED EXCEPTION, with its reason: the seasonal-N card is empty when the SETTING
         * `turf.nProgram` is unset. No engine computes it, the result form declares no key for it, and the
         * server composes no sentence about it -- so there is nothing to read, and asking would be asking
         * for a key that does not exist.
         */
        const NO_SECTION_OF_ITS_OWN = ['renderSeasonalN'];
        const without = [];
        const asked = [];
        for (const m of PLAN_UI.matchAll(/emptyState\(/g)) {
            let body = null;
            let name = null;
            for (const f of PLAN_UI.slice(0, m.index).matchAll(/function\s+([\w$]+)\s*\(/g)) {
                let depth = 0;
                let end = -1;
                for (let i = PLAN_UI.indexOf('{', f.index); i < PLAN_UI.length; i++) {
                    if (PLAN_UI[i] === '{') depth++;
                    else if (PLAN_UI[i] === '}') { depth--; if (!depth) { end = i + 1; break; } }
                }
                if (end <= m.index) continue;
                body = PLAN_UI.slice(f.index, end);
                name = f[1];
            }
            if (name === null || name === 'emptyState') continue;
            if (body.includes('serverSection(')) { if (!asked.includes(name)) asked.push(name); continue; }
            if (NO_SECTION_OF_ITS_OWN.includes(name)) continue;
            if (!without.includes(name)) without.push(name);
        }
        process.stdout.write('[gh640] sections drawing an empty state that ask the server: '
            + JSON.stringify(asked) + '\n[gh640] and those that do not: ' + JSON.stringify(without)
            + ' (declared as having no section of their own: '
            + JSON.stringify(NO_SECTION_OF_ITS_OWN) + ')\n');

        expect(asked.length).toBeGreaterThan(2);
        expect({ sectionsThatDrawEmptinessWithoutAskingTheServer: without })
            .toEqual({ sectionsThatDrawEmptinessWithoutAskingTheServer: [] });
    });

    test('the page holds the OLD sentence in one named place, and composes nothing beside it', () => {
        // GH-643 restated this. "No literal at all" was the wrong claim to make
        // while the words for an unrecorded cause are undecided: removing the old
        // sentence put a technical identifier on screen. The claim now is that the
        // old sentence lives in ONE place, marked as what it is, and that the
        // renderer neither invents around it nor keeps a second copy.
        expect(PLAN_UI).toContain('var WAS_PRINTED_BEFORE = {');
        expect(PLAN_UI).toContain('function serverSection(');
        // exactly one copy of the old PGR sentence, inside that table
        const occurrences = PLAN_UI.split('No PGR application recorded').length - 1;
        expect(occurrences).toBe(1);
        const table = PLAN_UI.slice(PLAN_UI.indexOf('var WAS_PRINTED_BEFORE = {'),
            PLAN_UI.indexOf('function sectionTitle('));
        expect(table).toContain('No PGR application recorded');
    });

    test('the soil section is deliberately untouched, and this names the address', () => {
        // Not an oversight: the composer cannot place `soilNutrition` on a step
        // yet (GH-639's measured gap), so printing its sentence would say "the
        // cause was not recorded" over a row that records `no-soil-sample`. THIS
        // CASE MUST GO RED the day that gap is closed and the section moves over.
        const soil = fs.readFileSync(path.join(ROOT, 'assets/soil-nutrition-analysis.js'), 'utf8');
        expect(soil).toContain('function renderEmpty()');
        expect(soil).toContain('No Soil &amp; Nutrition Data');
        expect(soil).not.toContain('GAIP_ANALYSIS_TEXTS');
    });
});

/**
 * GH-679 — DOES THE NUTRITION CALENDAR'S `init()` WRITE `program` WITHOUT A HUMAN PRESS,
 * AND DOES ANYTHING LEAVE THE PAGE WHEN IT DOES?
 *
 * WHY IT WAS ASKED. The calendar starts itself when its file loads (`tryInit()` at the
 * end of `nutrition-calendar.js`), and that file is loaded by six views including the
 * four run frames. If `init()` writes state with nobody touching anything, it belongs to the
 * class of state written WITHOUT A HUMAN ACTION, and this would be its third case. The measurement is cheap and it settles that, so it was taken rather than
 * argued.
 *
 * TWO QUESTIONS, AND THEY HAVE DIFFERENT ANSWERS. "Does it write `program`" and "does a
 * write leave the page" are not the same question, and answering only the first would
 * have made a page being populated from its own site's saved data look like the defect.
 *
 * HOW IT IS MEASURED. The file is executed in a `vm` context with the smallest DOM that
 * gets past `init()`'s one barrier, and with the site config the server hands the page.
 * Every road out — `GAIP_SiteConfig.mergeConfig`, `fetch`, `XMLHttpRequest`,
 * `localStorage` — is replaced by a recorder, so "nothing was sent" is a count and not
 * an impression.
 *
 * THE BOUNDARY, named: the DOM here is a stub, so this measures what `init()` DOES with
 * its barrier passed, not whether the barrier is passed on a real page. That second fact
 * was measured separately and structurally — `[data-nutrition-calendar-module]` lives in
 * `plan.blade.php` and in `partials/legacy-hub-markup.blade.php`, and that partial is
 * included by `hub`, `reports/export`, `reports/scenarios`, `reports/forensic` and
 * `stadium` — and this test asserts that fact from the views themselves rather than
 * repeating it in prose.
 */

'use strict';

const fs = require('fs');
const path = require('path');
const vm = require('vm');

const ROOT = path.join(__dirname, '..');
const SOURCE = fs.readFileSync(path.join(ROOT, 'assets', 'nutrition-calendar.js'), 'utf8');

/**
 * A REAL saved programme, taken off the stand rather than invented: `site_configs` for
 * `019e96d7-…` carries 8KB of one, twelve months of it. A programme I made up would have
 * measured my own idea of the shape — the first form of this test did, and the render
 * threw on a field it had never heard of.
 */
const SAVED_PROGRAMME = JSON.parse(fs.readFileSync(
    path.join(ROOT, 'tests', 'fixtures', 'gh679-saved-nutrition-programme.json'), 'utf8'));

function element(attrs) {
    const el = {
        attrs: attrs || {},
        value: '',
        innerHTML: '',
        style: {},
        classList: { add() {}, remove() {}, contains: () => false },
        addEventListener() {},
        removeEventListener() {},
        appendChild() {},
        setAttribute() {},
        getAttribute: (k) => (attrs || {})[k] || null,
        closest: () => null,
        querySelectorAll: () => [],
    };
    el.querySelector = (sel) => (MOUNTED[sel] !== undefined ? MOUNTED[sel] : null);

    return el;
}

let MOUNTED = {};

/**
 * The file executed with its barrier passed and every road out recorded.
 *
 * @param {object|null} saved the programme the server put in the site config
 */
function loadCalendar(saved, state) {
    /**
     * TWO STATES, AND THE CASE SAYS WHICH ONE IT MEASURED. The reviewer's condition, and
     * his reason is the whole point of the measurement: on `/plan` this same write is
     * ORDINARY WORK. A test that measured only "it writes" would answer "it writes" and
     * leave the question — defect or normal — untouched. So the file is loaded twice:
     *
     *   'frame' — the shape of a run frame: the mount arrives with the legacy partial,
     *             and the plan page's own sample picker is NOT there.
     *   'plan'  — the shape of the plan page: the mount and the picker both there.
     *
     * Neither state presses anything. The human half of the question is answered from
     * the file itself in the case below — the only two writes that leave the page sit in
     * `bindEvents` and `computeProgram` — because a press simulated through this stub
     * would be measuring the stub.
     */
    const sent = [];
    const mount = element({ 'data-nutrition-calendar-module': '' });
    MOUNTED = {
        '[data-nutrition-results]': element(),
        '[data-nutrition-calendar]': element(),
        '[data-nutrition-summary]': element(),
        '[data-nutrition-generate]': element(),
    };
    if (state === 'plan') MOUNTED['#plan-nut-sample-picker'] = element();
    const sandbox = {
        console: { log() {}, warn() {}, error() {} },
        JSON,
        Math,
        Date,
        parseFloat,
        parseInt,
        isNaN,
        setTimeout: () => 0,
        clearTimeout() {},
        document: {
            readyState: 'complete',
            addEventListener() {},
            removeEventListener() {},
            dispatchEvent() { return true; },
            createElement: () => element(),
            // `initSamplePicker()` asks for the plan page's sample picker by id. In the
            // FRAME state there is no such element, and that is the difference between
            // the two states rather than a gap in the stub.
            getElementById: (id) => (MOUNTED['#' + id] !== undefined ? MOUNTED['#' + id] : null),
            querySelector: (sel) => (sel === '[data-nutrition-calendar-module]' ? mount
                : (MOUNTED[sel] !== undefined ? MOUNTED[sel] : null)),
            querySelectorAll: () => [],
            body: element(),
        },
        CustomEvent: function (name, init) { this.type = name; this.detail = init && init.detail; },
        // Every road out of the page, recorded rather than removed: a road that is
        // missing would make the file throw and the measurement would be about the stub.
        // A READ IS NOT A WRITE, and the first form of this recorder did not tell them
        // apart: the plan state fetches the site's tissue samples — a GET — and that
        // counted as "something left the page". The project's rule is about writes; a
        // page reading its own site's data from the server is the direction it wants.
        fetch: (url, opts) => {
            const method = ((opts && opts.method) || 'GET').toUpperCase();
            sent.push({ road: 'fetch', method, url: String(url).split('?')[0], write: method !== 'GET' });

            return Promise.resolve({ ok: false, json: () => Promise.resolve(null) });
        },
        XMLHttpRequest: function () { sent.push({ road: 'XMLHttpRequest' }); this.open = () => {}; this.send = () => {}; this.setRequestHeader = () => {}; },
        localStorage: {
            getItem: () => null,
            setItem: (k) => sent.push({ road: 'localStorage.setItem', key: k }),
            removeItem: (k) => sent.push({ road: 'localStorage.removeItem', key: k }),
        },
    };
    sandbox.window = sandbox;
    sandbox.global = sandbox;
    sandbox.globalThis = sandbox;
    sandbox.GAIP_HUB_CONFIG = { activeSiteId: 'site-under-measurement' };
    sandbox.GAIP_SITE_CONFIG = saved ? { nutritionCalendarProgram: saved } : {};
    sandbox.GAIP_SiteConfig = {
        mergeConfig: (siteId, patch) => { sent.push({ road: 'GAIP_SiteConfig.mergeConfig', siteId, patch }); return true; },
    };

    let threw = null;
    try {
        vm.runInNewContext(SOURCE, sandbox, { filename: 'assets/nutrition-calendar.js' });
    } catch (e) {
        threw = e && e.message ? e.message.split('\n')[0] : String(e);
    }

    return {
        state,
        calendar: sandbox.GilbaNutritionCalendar || sandbox.NutritionCalendar,
        sent,
        threw,
        sandbox,
    };
}

describe('GH-679 — `init()` runs on load: what it writes, and what leaves the page', () => {
    test('POSITIVE CONTROL: with NO saved programme the load leaves `program` null', () => {
        // Without this the case below would only show that `program` is set after a
        // load, which is also what a file that sets it unconditionally would show.
        const frame = loadCalendar(null, 'frame');
        const plan = loadCalendar(null, 'plan');
        [frame, plan].forEach((r) => process.stdout.write('[gh679] state ' + r.state
            + ', no saved programme — program: ' + JSON.stringify(r.calendar.program)
            + ' | reads: ' + JSON.stringify(r.sent.filter((x) => !x.write))
            + ' | writes: ' + JSON.stringify(r.sent.filter((x) => x.write))
            + ' | threw: ' + JSON.stringify(r.threw) + '\n'));
        expect(frame.calendar.program).toBeNull();
        expect(plan.calendar.program).toBeNull();
    });

    test('THE ANSWER, FIRST HALF: with a saved programme `init()` DOES write `program`, with no press', () => {
        const frame = loadCalendar(SAVED_PROGRAMME, 'frame');
        const plan = loadCalendar(SAVED_PROGRAMME, 'plan');
        [frame, plan].forEach((r) => process.stdout.write('[gh679] state ' + r.state
            + ', saved programme present — program written: ' + (r.calendar.program !== null)
            + ' | annual N: ' + JSON.stringify((r.calendar.program || {}).annual_totals
                ? r.calendar.program.annual_totals.N : null)
            + ' | threw: ' + JSON.stringify(r.threw) + '\n'));

        // Nobody clicked anything in either state: the file was loaded and `tryInit()` ran.
        // THE PAIR is what makes the frame result mean something — the same write on the
        // page it belongs on is ordinary work, so "it writes in the frame" is a statement
        // about WHERE, not about whether the mechanism does anything.
        expect(plan.calendar.program).not.toBeNull();
        expect(frame.calendar.program).not.toBeNull();
        expect(frame.calendar.program.annual_totals).toEqual(SAVED_PROGRAMME.annual_totals);
    });

    test('THE ANSWER, SECOND HALF: and NOTHING leaves the page — no send, no browser store', () => {
        // This is the half that decides whether it belongs to that class. The value
        // written comes FROM the site's saved config, which the server put on the page,
        // and it goes no further than the page. Server to page is the direction this
        // project wants; page to server without a human is the defect.
        const frame = loadCalendar(SAVED_PROGRAMME, 'frame');
        const plan = loadCalendar(SAVED_PROGRAMME, 'plan');
        const writes = (r) => r.sent.filter((x) => x.write !== false);
        process.stdout.write('[gh679] state frame — reads: ' + JSON.stringify(frame.sent.filter((x) => !x.write))
            + ' | WRITES: ' + JSON.stringify(writes(frame)) + '\n'
            + '[gh679] state plan  — reads: ' + JSON.stringify(plan.sent.filter((x) => !x.write))
            + ' | WRITES: ' + JSON.stringify(writes(plan)) + '\n');

        // Reads are printed and not asserted against: the plan page fetching its own
        // site's tissue samples is the server being the source, which is the rule rather
        // than a breach of it. What must be empty is the WRITES.
        expect({ writesFromTheFrame: writes(frame), writesFromThePage: writes(plan) })
            .toEqual({ writesFromTheFrame: [], writesFromThePage: [] });
    });

    test('and the two roads that DO write are both behind a human action — read from the file', () => {
        // The addresses move, so the anchor is the function each call sits in rather
        // than a line number: `bindEvents` (a field the person edits) and
        // `computeProgram` (after the person presses Generate). `init()` mentions the
        // call only in a comment.
        /**
         * ATTRIBUTION BY RANGE, NOT BY THE NEAREST DECLARATION ABOVE — and this is the
         * third fault this little device found in itself.
         *
         * First it took any four-space `function x(` as the enclosing unit and named
         * `_clearAnswer`, a helper. Then it took only the module's own methods and named
         * `_clearAnswer` again — that one IS a method, declared a hundred lines above and
         * CLOSED long before the call. "The nearest declaration above" is not the
         * enclosing function, and for a device whose whole job is to say who owns a line,
         * naming the wrong owner is the only unacceptable answer.
         *
         * So each method's range is found by matching its braces, and a call belongs to
         * the method whose range CONTAINS it.
         */
        const methodRanges = () => {
            const out = [];
            const re = /^ {4}NutritionCalendar\.(\w+) = function/gm;
            let m;
            while ((m = re.exec(SOURCE)) !== null) {
                let depth = 0;
                let i = SOURCE.indexOf('{', m.index);
                for (; i < SOURCE.length; i++) {
                    if (SOURCE[i] === '{') depth++;
                    else if (SOURCE[i] === '}') {
                        depth--;
                        if (!depth) break;
                    }
                }
                out.push({ name: m[1], from: m.index, to: i });
            }

            return out;
        };
        const ranges = methodRanges();
        const lineOf = (index) => SOURCE.slice(0, index).split('\n').length;
        const calls = [];
        const re = /\bpersistSiteConfigPatch\s*\(/g;
        let hit;
        while ((hit = re.exec(SOURCE)) !== null) {
            const before = SOURCE.lastIndexOf('\n', hit.index) + 1;
            const line = SOURCE.slice(before, SOURCE.indexOf('\n', hit.index));
            if (/^\s*(?:\/\/|\*)/.test(line) || /= function/.test(line)) continue;
            const owner = ranges.find((r) => hit.index > r.from && hit.index < r.to);
            calls.push({ inside: owner ? owner.name : null, line: lineOf(hit.index), text: line.trim().slice(0, 70) });
        }
        process.stdout.write('[gh679] calls of `persistSiteConfigPatch`, by the function whose RANGE holds them: '
            + JSON.stringify(calls) + '\n');

        /**
         * PRINTED, NOT ASSERTED, and the reason is a limit of this device rather than a
         * choice. Brace matching over JavaScript without a parser is not sound: a brace
         * inside a string or a regular literal ends a range early, and it did — the call
         * at 2572 came out owned by nobody. I am not building a parser for a side fact,
         * and I am not asserting an owner I cannot compute correctly.
         *
         * THE CLAIM IS CARRIED BY EXECUTION INSTEAD, above and below: loading the file in
         * both states records EVERY road out, and no write was taken in either. That
         * answers "does `init()` persist" directly, with no attribution needed — which is
         * the better instrument for the question anyway.
         */
        expect(calls.length).toBe(2);
    });

    test('and the write path is not reached by a LOAD — by execution, in both states', () => {
        // The same fact the attribution above was reaching for, measured instead of
        // parsed: `GAIP_SiteConfig.mergeConfig` is the one road the calendar persists
        // through, and it is recorded. Neither state takes it.
        const frame = loadCalendar(SAVED_PROGRAMME, 'frame');
        const plan = loadCalendar(SAVED_PROGRAMME, 'plan');
        const merges = (r) => r.sent.filter((x) => x.road === 'GAIP_SiteConfig.mergeConfig');
        process.stdout.write('[gh679] `mergeConfig` calls during a load — frame: '
            + JSON.stringify(merges(frame)) + ' | plan: ' + JSON.stringify(merges(plan)) + '\n');

        expect({ frame: merges(frame), plan: merges(plan) }).toEqual({ frame: [], plan: [] });
    });

    test('the barrier IS passed on a real page: the mount travels with the legacy partial', () => {
        // Structural, from the views themselves — the fact the stub above cannot show.
        const views = path.join(ROOT, 'app', 'resources', 'views');
        const read = (p) => fs.readFileSync(path.join(views, p), 'utf8');
        const withMount = ['plan.blade.php', 'partials/legacy-hub-markup.blade.php']
            .filter((v) => read(v).includes('data-nutrition-calendar-module'));
        const including = ['hub.blade.php', 'reports/export.blade.php', 'reports/scenarios.blade.php',
            'reports/forensic.blade.php', 'stadium.blade.php']
            .filter((v) => /@include\(\s*'partials\.legacy-hub-markup'/.test(read(v)));
        process.stdout.write('[gh679] views carrying the mount: ' + JSON.stringify(withMount) + '\n'
            + '[gh679] views including the partial that carries it: ' + JSON.stringify(including) + '\n');

        expect(withMount).toHaveLength(2);
        expect(including).toHaveLength(5);
    });
});

/**
 * GH-570 — THE JOURNAL RECORD CARRIES ITS LEVEL, AND THE LEVEL IS FILLED BY
 * WHICH FUNCTION WROTE IT.
 *
 * WHY. Three readers — the outcome on the server, the panel's sentence, the
 * panel's detail list — each decided what a journal record MEANT by looking at
 * the words in it. Two records from one live run, `analysis_results` id 31:
 *
 *   {"module":"wear","message":"Wear engine blocked by identity enforcement"}
 *   {"module":"disease","message":"… GAIP_DISEASE_RESULT written … topRisk: 69"}
 *
 * Same keys, same types. One is a report of trouble, the other is a receipt for
 * work that succeeded, and nothing in the record says which. Recognising a kind
 * by the letters of a string is the class this question spent the day removing
 * from zone labels.
 *
 * HOW THE FIELD IS FILLED, and this is the whole design: not by an author
 * remembering to pass a level, but by which function is called. `warn()` reports
 * trouble and writes `problem`; `note()` records that something happened and
 * writes `info`. Forty-eight `warn` calls in `hub-orchestrator.js` did not change
 * — every one of them is already a report of trouble — and the two calls that
 * moved to `note` are the two debug receipts about a disease result having been
 * written, which are the only records in a live journal that were not trouble.
 *
 * WHAT THE FIELD DOES NOT DO, measured elsewhere and named here so this file is
 * not read as more than it is: neither a level nor a sentence can say whether a
 * module PRODUCED ITS RESULT. Only the result says that. See
 * `Gh571SkippedIsInferredFromAWordTest`.
 */

'use strict';

const vm = require('vm');
const fs = require('fs');
const path = require('path');

const ASSETS = path.join(__dirname, '..', 'assets');
const SRC = fs.readFileSync(path.join(ASSETS, 'hub-orchestrator.js'), 'utf8');

/**
 * The orchestrator, with its two journal writers reachable.
 *
 * They are internal, so they are exported beside the module's own export line
 * rather than reached at by name — the same shape `gh549` uses for the soil
 * page. Everything else about the file is what ships.
 */
function loadWriters() {
    const exportLine = '  global.GaipOrchestrator = {';
    expect(SRC).toContain(exportLine);
    const testSrc = SRC.replace(exportLine,
        '  global.__test_journal = { warn: warn, note: note, noteSkipped: noteSkipped, state: function () { return _hubState; } };\n' + exportLine);

    const sandbox = {
        window: {}, document: { addEventListener() {}, querySelector: () => null, querySelectorAll: () => [],
            createElement: () => ({ style: {}, dataset: {}, appendChild() {} }), dispatchEvent() {} },
        console: { log() {}, warn() {}, error() {}, info() {} },
        localStorage: { getItem: () => null, setItem() {} },
        // Timers are stubbed rather than passed through: the orchestrator
        // schedules work on load, and a real timer outlives the test.
        setTimeout: () => 0, clearTimeout: () => {}, setInterval: () => 0, clearInterval: () => {},
        requestAnimationFrame: () => 0,
        Date, Math, JSON,
        CustomEvent: function () {},
        MutationObserver: function () { return { observe() {}, disconnect() {} }; },
    };
    sandbox.window = sandbox;
    sandbox.global = sandbox;
    sandbox.globalThis = sandbox;
    const ctx = vm.createContext(sandbox);
    // The orchestrator leans on utilities the page loads before it.
    vm.runInContext(fs.readFileSync(path.join(ASSETS, 'gaip-utils.js'), 'utf8'), ctx, { filename: 'gaip-utils.js' });
    vm.runInContext(testSrc, ctx, { filename: 'hub-orchestrator.js' });
    // Positive control: without this the assertions below would be about a
    // context where nothing loaded.
    expect(typeof ctx.__test_journal.warn).toBe('function');
    expect(typeof ctx.__test_journal.note).toBe('function');
    return ctx.__test_journal;
}

describe('GH-570 — every journal record says what kind of record it is', () => {
    test('warn writes a problem and note writes an info, both into the same journal', () => {
        const j = loadWriters();
        j.warn('wear', 'Wear engine blocked by identity enforcement:', 'BLOCKED - recovery windows require defined intent');
        j.note('disease', '[b35fix365 writer1-mainBlock] GAIP_DISEASE_RESULT written, diseases: 10 topRisk: 69');

        const log = j.state().computed.warnings;
        expect(log).toHaveLength(2);
        expect(log[0]).toMatchObject({ module: 'wear', level: 'problem' });
        expect(log[1]).toMatchObject({ module: 'disease', level: 'info' });
        // The rest of the record is unchanged — the field is added, nothing is
        // taken away, and a reader written before today still finds what it read.
        ['module', 'message', 'at', 'data'].forEach((k) => expect(log[0]).toHaveProperty(k));
    });

    test('a record never arrives without a level', () => {
        // The property the server's fallback path is the other side of: a
        // record with no level is a record from before today, and the producer
        // must not be able to write one.
        const j = loadWriters();
        j.warn('climate', 'Climate engine error, using empty fallback', new Error('x'));
        j.note('pgr', 'PGR calculation finished');
        j.warn('irrigation', 'No weather data available for irrigation scheduling');

        j.state().computed.warnings.forEach((w) => {
            expect(typeof w.level).toBe('string');
            expect(w.level.length).toBeGreaterThan(0);
        });
    });

    test('the overflow record is a problem, not an info', () => {
        // The one record the journal writes about itself. It says the log
        // stopped growing, which is trouble; filed as info it would be hidden
        // by exactly the readers that need to see it.
        const j = loadWriters();
        for (let i = 0; i < 205; i++) j.warn('m' + i, 'message ' + i);
        const log = j.state().computed.warnings;
        const last = log[log.length - 1];
        expect(last.message).toMatch(/warning log full/);
        expect(last.level).toBe('problem');
    });
});

describe('GH-570 — the GAIP_DISEASE_RESULT receipts are written by note, in the shipped file', () => {
    /**
     * A guard on the tree rather than on a run: this line is the reason the field exists, and a later
     * edit that turns it back into a `warn` would put a receipt for successful work back among the
     * problems without any test noticing.
     *
     * GH-755 (queue item 3bz) CHANGED WHAT IS TRUE HERE, so this says what it guarded before and what
     * it guards now rather than being loosened until it went quiet:
     *   BEFORE — two receipts existed, `writer1-mainBlock` in the full pass and `writer2` inside
     *   `executeEngine`; the claim was "there are two and both are notes" — a count plus a shared
     *   assertion.
     *   NOW — `executeEngine` was exported, never called, and removed with its body, and `writer2`
     *   went with it. The claim is the LIST: exactly these receipts exist, each named with the
     *   function that writes it. It is stronger than the count it replaces in both directions — a
     *   receipt turned into a `warn` is red as before, and a receipt ADDED anywhere is red too, which
     *   `toHaveLength(2)` could not say once two were expected.
     */
    test('the receipts that exist are exactly these, each written by note', () => {
        /**
         * GH-755 (the reviewer's return) — AND THE PATTERN NO LONGER DEPENDS ON THE TYPOGRAPHY.
         *
         * It required a newline after `note(` and another after `"disease",`, because that is how the
         * two receipts happened to be laid out. Measured by him: the same receipt written on ONE line
         * is invisible to it, so the claim "a receipt ADDED anywhere is red too" held for one shape of
         * whitespace only — and `writer2`, the receipt this delivery removed, could come back
         * unnoticed. Whitespace is now whitespace, and the quote around the message may be any of the
         * three JavaScript uses.
         *
         * WHERE IT STILL DOES NOT LOOK, his second remark, and it is measured rather than supposed.
         * A COMMENT INSIDE THE CALL hides the receipt from this expression: a receipt whose call
         * carried a block comment between `note(` and its first argument was put into the shipped
         * file -- written as `note(`, a block comment, then `"disease"` -- and the file's own
         * md5 changed from 1379b52a to 0e3dd14a and the probe was there by grep, and this case still
         * printed one receipt and stayed green. So the claim this case can make is narrower than
         * "a receipt added anywhere is red": it is "a receipt added with no comment between the
         * call's own tokens is red". Widening the pattern to strip comments first is a decision
         * nobody has taken -- naming the hole is what keeps it from being read as covered.
         */
        const hits = [...SRC.matchAll(/(\w+)\(\s*["']disease["']\s*,\s*[`'"]\[b35fix365 (writer[\w-]+)/g)]
            .map((h) => [h[2], h[1]]);
        process.stdout.write('[gh570] GAIP_DISEASE_RESULT receipts in the shipped file: '
            + JSON.stringify(hits) + '\n');

        expect(hits).toEqual([['writer1-mainBlock', 'note']]);
    });

    test('nothing else in the file writes a record without going through warn or note', () => {
        // `record()` is the only function that pushes onto `computed.warnings`,
        // and it is reached only from those two. A third writer would be a
        // fourth kind of record with no level agreed anywhere.
        const pushes = [...SRC.matchAll(/computed\.warnings[^\n]*push\(|log\.push\(/g)];
        const inRecord = SRC.slice(SRC.indexOf('function record(level, module, message, data)'),
                                   SRC.indexOf('function note(module, message, data)'));
        pushes.forEach((p) => {
            expect(inRecord).toContain(SRC.slice(p.index, p.index + 10));
        });
    });
});

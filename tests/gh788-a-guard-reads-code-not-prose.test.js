/**
 * GH-788 (queue item 3gd) — A GUARD THAT ASSERTS AGAINST A SOURCE READS ITS CODE, NOT ITS PROSE.
 *
 * WHAT WAS WRONG. A guard asserting against the TEXT of a file cannot tell code from a quotation of code in a
 * comment, and the class caught this repository twice in one day: a guard written inside queue item 3vsch
 * counted the quotation of a removed call as the call, and an ALREADY ACCEPTED delivery, GH-781, had its census
 * of the journal's writers grow from 7 to 8 when the reviewer inserted a block comment quoting a door's call —
 * with the suite green. The claim "no writer outside the census" was checked against a census a comment
 * inflates.
 *
 * WHAT THIS FILE HOLDS:
 *   - the four properties the helper must have, because the patch-before-`vm` guards of GH-781 rest on them:
 *     the blanked view is the same LENGTH as the source, carries the same NEWLINES, puts a known place at the
 *     same LINE AND COLUMN, and an index found in the blanked view points at the same line in the RAW text;
 *   - that a regular expression cannot do this job: `/*` inside a string and inside a regular-expression
 *     literal must survive, and a comment quoting code must not;
 *   - the three suites whose SUBJECT is a comment, line by line: present in the raw text, absent in the code;
 *   - THE NUMBER, printed: how many suites decide a verdict from a substring of a source and do not blank
 *     comments first. The reviewer's condition — "a suite that repaired eleven places and says nothing about
 *     the number is indistinguishable from one that never reached them" — so the number is printed on every
 *     run, and the census is a LIST of names, not a count.
 */

'use strict';

const fs = require('fs');
const path = require('path');
const { codeOf, commentsOf, sourceWithComments, lineOfIndex } = require('./lib/source-without-comments');

const ROOT = path.join(__dirname, '..');
const TESTS = __dirname;
const asset = (f) => fs.readFileSync(path.join(ROOT, 'assets', f), 'utf8');
const testFile = (f) => fs.readFileSync(path.join(TESTS, f), 'utf8');

/**
 * A source that carries every shape the job has to tell apart. Assembled from pieces so that the `/*` inside
 * the string and inside the regular expression are written the way a file writes them.
 */
const PROBE = [
    'var a = 1; // a line comment quoting door("quoted")',
    '/* a block comment',
    '   quoting recordProblem(PRODUCER) across two lines */',
    'var url = "http://example.com/a//b";',
    'var re = /' + '\\/\\*not a comment\\*\\/' + '/;',
    'var s = "' + '/* also not a comment */' + '";',
    'var t = `a template with // and ' + '/* both */' + ' inside`;',
    'door("real");',
].join('\n');

describe('GH-788 — the helper blanks comments and keeps every address', () => {
    test('POSITIVE CONTROL: it finds comments at all, and leaves the code where it was', () => {
        const code = codeOf(PROBE, 'probe.js');
        process.stdout.write('\n[gh788] the probe, code only:\n'
            + code.split('\n').map((l, i) => '[gh788]   ' + (i + 1) + '| ' + l).join('\n') + '\n');

        // The quotations are gone.
        expect(code).not.toContain('door("quoted")');
        expect(code).not.toContain('recordProblem');
        // The code is not.
        expect(code).toContain('door("real")');
        expect(code).toContain('var a = 1;');
    });

    test('a regular expression cannot do this: strings, templates and regex literals survive', () => {
        const code = codeOf(PROBE, 'probe.js');
        process.stdout.write('[gh788] survived in code: url ' + code.includes('http://example.com/a//b')
            + ' | regex literal ' + code.includes('not a comment')
            + ' | string ' + code.includes('also not a comment')
            + ' | template ' + code.includes('a template with') + '\n');

        // `://` inside a URL is not a line comment — the reason the regex form needed a lookbehind at all.
        expect(code).toContain('http://example.com/a//b');
        // `/*` inside a regular-expression literal and inside a string is not a comment opener.
        expect(code).toContain('not a comment');
        expect(code).toContain('also not a comment');
        // And a template keeps what looks like both kinds of comment inside it.
        expect(code).toContain('a template with');
        expect(code).toContain('both');
    });

    test('the blanked view is the same length and carries the same newlines', () => {
        const code = codeOf(PROBE, 'probe.js');
        const newlines = (s) => (s.match(/\n/g) || []).length;
        process.stdout.write('[gh788] length ' + code.length + ' vs ' + PROBE.length
            + ' | newlines ' + newlines(code) + ' vs ' + newlines(PROBE) + '\n');

        expect(code.length).toBe(PROBE.length);
        expect(newlines(code)).toBe(newlines(PROBE));
        // And on a real file of the product, not only on a probe.
        const real = asset('cascade-orchestrator.js');
        const realCode = codeOf(real, 'cascade-orchestrator.js');
        process.stdout.write('[gh788] cascade-orchestrator.js: length ' + realCode.length + ' vs ' + real.length
            + ' | newlines ' + newlines(realCode) + ' vs ' + newlines(real) + '\n');
        expect(realCode.length).toBe(real.length);
        expect(newlines(realCode)).toBe(newlines(real));
    });

    test('a known place keeps its line and column, and an index found in the code points there in the raw text', () => {
        const code = codeOf(PROBE, 'probe.js');
        const at = code.indexOf('door("real")');
        expect(at).toBeGreaterThan(-1);

        const lineInCode = lineOfIndex(code, at);
        const lineInRaw = lineOfIndex(PROBE, at);
        const columnInCode = at - code.lastIndexOf('\n', at - 1) - 1;
        const columnInRaw = at - PROBE.lastIndexOf('\n', at - 1) - 1;
        process.stdout.write('[gh788] `door("real")` at index ' + at + ': line ' + lineInCode + '/' + lineInRaw
            + ', column ' + columnInCode + '/' + columnInRaw + '\n');

        expect(lineInRaw).toBe(lineInCode);
        expect(columnInRaw).toBe(columnInCode);
        // THE PROPERTY THE PATCHES REST ON: the raw text at that index is the same code.
        expect(PROBE.slice(at, at + 'door("real")'.length)).toBe('door("real")');

        /**
         * And on a real file, at a place that sits AFTER a long block comment — which is where deleting
         * comments instead of blanking them does its damage. Measured on the guard this idea came from: a read
         * at `disease-forecast.js:920` was reported at `:749`, a hundred and seventy-one lines out.
         */
        const real = asset('hub-orchestrator.js');
        const realCode = codeOf(real, 'hub-orchestrator.js');
        const anchor = 'function buildWearRecoveryInputs()';
        const inCode = realCode.indexOf(anchor);
        expect(inCode).toBeGreaterThan(-1);
        process.stdout.write('[gh788] `' + anchor + '` line in code ' + lineOfIndex(realCode, inCode)
            + ' | in raw at the same index ' + lineOfIndex(real, inCode)
            + ' | raw really says it there: ' + (real.slice(inCode, inCode + anchor.length) === anchor) + '\n');
        expect(lineOfIndex(real, inCode)).toBe(lineOfIndex(realCode, inCode));
        expect(real.slice(inCode, inCode + anchor.length)).toBe(anchor);
    });

    test('a file that does not parse is refused by name, with no regular-expression fallback', () => {
        let message = null;
        try {
            codeOf('function ( {', 'broken.js');
        } catch (e) {
            message = e.message;
        }
        process.stdout.write('[gh788] refusal: ' + JSON.stringify(message) + '\n');
        expect(message).toContain('broken.js');
        expect(message).toMatch(/does not parse/);
        expect(message).toMatch(/no regular-expression fallback/);
    });

    /**
     * THE THREE SUITES WHOSE SUBJECT IS A COMMENT — the plan's condition of acceptance, line by line.
     *
     * Each asserts words that live in a comment on purpose: the owner's sentence kept beside the code, an
     * instruction for removing a script, two section markers. They must read the RAW text, and they say so by
     * name; what this case holds is that the seven strings are in the raw text and NOT in the code view, so a
     * suite that quietly switched to the code view would go red instead of silently asserting nothing.
     */
    test('the three suites whose subject is a comment: every string is in the prose and in no code', () => {
        /**
         * The file each suite reads is taken FROM THE SUITE, not from memory: the first draft of this case
         * named three files by recollection and two of them were wrong — the strings were nowhere in them, and
         * the case reported `raw=null` rather than a finding. An address remembered is not an address read.
         */
        const CASES = [
            { suite: 'gh402-no-silent-multisite-turf.test.js', file: 'sample-manager.js',
                strings: ['GH-402', 'must not change how a site is calculated', 'To restore'] },
            { suite: 'gh425-calc-trace.test.js', file: 'plan-calc-trace.js',
                strings: ['TO REMOVE IT', 'delete the single <script> tag'] },
            { suite: 'gh329-hard-exclude-unneeded-p-k.test.js', file: 'au-fertiliser-products.js',
                strings: ['// SCORE 4: P Delivery Accuracy', '// SCORE 7: P Delivery Accuracy'] },
        ];
        const rows = [];
        CASES.forEach(({ suite, file, strings }) => {
            let src = null;
            try { src = asset(file); } catch (e) { src = null; }
            strings.forEach((text) => {
                const inRaw = src ? src.indexOf(text) >= 0 : null;
                const inCode = src ? codeOf(src, file).indexOf(text) >= 0 : null;
                rows.push({ suite, file, text, inRaw, inCode,
                    line: (src && inRaw) ? lineOfIndex(src, src.indexOf(text)) : null });
            });
        });
        process.stdout.write('[gh788] the strings whose home is a comment (' + rows.length + '):\n'
            + rows.map((r) => '[gh788]   ' + r.file + ':' + r.line + '  ' + JSON.stringify(r.text)
                + '  raw=' + r.inRaw + ' code=' + r.inCode).join('\n') + '\n');

        // The universe is real: each string was found in its file.
        expect(rows.filter((r) => r.inRaw !== true).map((r) => r.file + ' ' + r.text)).toEqual([]);
        // And none of them survives in the code view — which is why those suites must read the raw text.
        expect(rows.filter((r) => r.inCode !== false).map((r) => r.file + ' ' + r.text)).toEqual([]);
        // The `sourceWithComments` name exists so that reading prose is a decision, spelled out in the test.
        expect(sourceWithComments(asset('plan-calc-trace.js'))).toContain('TO REMOVE IT');
        expect(commentsOf(asset('plan-calc-trace.js'), 'plan-calc-trace.js')).toContain('TO REMOVE IT');
    });

    /**
     * THE NUMBER, PRINTED ON EVERY RUN — the reviewer's condition, and it is a LIST rather than a count: a
     * count cannot tell a suite that was repaired from a suite the scan never reached.
     *
     * A suite is IN this census when it reads a source file and decides something from a substring of it. It
     * LEAVES the census when it takes that text through this helper. The five suites of the plan's section 5
     * are the ones this item repairs; the rest are queue item 3ge, and the number printed here is what that
     * item starts from — measured, rather than the plan's approximate 22 files and 99 places.
     */
    test('THE CENSUS: every suite that decides from a source substring, and whether it blanks comments first', () => {
        /**
         * WHAT COUNTS AS BEING IN THIS CENSUS, narrowly — the first form of this scan answered 272 suites and
         * 271 of them "do not blank", against the plan's measured 120 and 91. It was counting any `.indexOf(`
         * on any data at all, most of it on objects a run produced. A census that wide is not a census of this
         * subject: it would send the next reader to repair suites that never read a source file.
         *
         * A suite is in it when BOTH hold: it reads a file of the PRODUCT (`assets/` or `app/`), and it decides
         * something from a substring of what it read.
         */
        /**
         * The path often reaches `readFileSync` through a NAME — `const file = path.join(ASSETS, name)` — so
         * the two halves are looked for separately: the suite reads files at all, and it names the product's
         * directories somewhere. Written as one expression first, it missed two of the five suites this item
         * repairs, and the assertion below then passed because they were in NEITHER list: a claim satisfied by
         * absence, which is the fault this file is about, in its own code.
         */
        const READS_FILES = /readFileSync\s*\(/;
        const NAMES_THE_PRODUCT = new RegExp("(\\.\\./assets|'assets'|\"assets\"|\\bASSETS\\b|\\.\\./app"
            // A path that ARRIVES AS DATA is still a file of the product: `gh746` reads
            // `path.join(__dirname, '..', rel)`, where `rel` comes from the claim it is checking. Named
            // because the scan missed it, and the case above then passed on that suite's absence.
            + "|\\bVIEWS\\b|__dirname\\s*,\\s*'\\.\\.'|__dirname\\s*,\\s*\"\\.\\.\")");
        const USES_THE_HELPER = /source-without-comments/;
        const DECIDES_FROM_TEXT = new RegExp(
            // `expect(<a name that holds a source>)` … toContain / toMatch
            'expect\\s*\\(\\s*[A-Za-z_$][\\w$.]*\\s*\\)\\s*\\.\\s*(?:not\\s*\\.\\s*)?(?:toContain|toMatch)'
            // or a substring search on a name that holds one
            + '|\\b(?:src|source|code|body|text|raw|engine|validator|view|file|html|markup)\\s*\\.\\s*'
            + '(?:indexOf|match|includes|search)\\s*\\(');

        const files = fs.readdirSync(TESTS).filter((f) => f.endsWith('.test.js')).sort();
        const census = { blanks: [], doesNot: [] };
        files.forEach((f) => {
            const src = testFile(f);
            if (!READS_FILES.test(src) || !NAMES_THE_PRODUCT.test(src)) return;
            if (!DECIDES_FROM_TEXT.test(src)) return;
            (USES_THE_HELPER.test(src) ? census.blanks : census.doesNot).push(f);
        });

        process.stdout.write('[gh788] suites deciding from a source substring: '
            + (census.blanks.length + census.doesNot.length)
            + '\n[gh788]   blank comments first (' + census.blanks.length + '): '
            + JSON.stringify(census.blanks)
            + '\n[gh788]   do NOT blank (' + census.doesNot.length + '):\n'
            + census.doesNot.map((f) => '[gh788]      ' + f).join('\n') + '\n');

        // The universe is real: the scan found suites of both kinds, so neither list is empty by accident.
        expect(census.blanks.length + census.doesNot.length).toBeGreaterThan(20);
        expect(census.blanks.length).toBeGreaterThan(0);
        /**
         * THE FIVE THIS ITEM REPAIRS are named, and each must be on the blanking side. The rest stay on the
         * other side and are queue item 3ge — asserting them empty here would be asserting a different item's
         * work.
         */
        const REPAIRED_HERE = [
            'gh781-every-journal-writer-is-met-or-declared.test.js',
            'gh781-the-runners-own-facts-reach-the-row.test.js',
            'gh781-the-row-takes-the-accepted-pass.test.js',
            'gh782-the-aa-ranges-come-from-the-sites-species.test.js',
            'gh746-a-guard-compares-the-list-not-its-length.test.js',
        ];
        const stillRaw = REPAIRED_HERE.filter((f) => census.doesNot.indexOf(f) >= 0);
        const missing = REPAIRED_HERE.filter((f) => files.indexOf(f) < 0);
        // AND EACH OF THE FIVE IS ON THE BLANKING SIDE, not merely absent from the other one: a suite the scan
        // does not reach at all would satisfy "not still reading raw text" while reading raw text.
        const notCounted = REPAIRED_HERE.filter((f) => census.blanks.indexOf(f) < 0);
        process.stdout.write('[gh788]   of the five this item repairs, still reading raw text: '
            + JSON.stringify(stillRaw) + ' | not found at all: ' + JSON.stringify(missing)
            + ' | not on the blanking side: ' + JSON.stringify(notCounted) + '\n');
        expect({ stillReadingRawText: stillRaw, notFound: missing, notOnTheBlankingSide: notCounted })
            .toEqual({ stillReadingRawText: [], notFound: [], notOnTheBlankingSide: [] });
    });
});

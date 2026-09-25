'use strict';

/**
 * GH-721 — A NUMBER ABOUT THE STATE OF THE TREE CARRIES THE TREE IT WAS TAKEN ON, AND THIS SAYS
 * WHETHER THAT TREE IS STILL THE ONE WE HAVE.
 *
 * A claim with a number about a run or the tree ("zero expected reds", "48 passed") was true at
 * one moment and later false, with nothing on the page to say so. The mark that makes it
 * checkable has two MACHINE parts, copied from a run's own output rather than typed:
 *
 *   [tree <16-hex fingerprint> | <command that repeats the claim>]
 *
 * The fingerprint is the one `npm run tree` and every jest run print (`tests/lib/tree-fingerprint`,
 * GH-716). This module finds every mark in a text and answers, per mark:
 *   - `current`    the fingerprint equals the tree now: the claim stands without a re-run;
 *   - `stale`      it does not: the tree moved since; the claim may be old, repeat the command;
 *   - `incomplete` a mark without both machine parts.
 *
 * WHAT IT DOES NOT DO, said rather than left to be found:
 *   - it does not find claims that carry NO mark. Which numbers are "about the state" is a matter
 *     of meaning, and a machine cannot tell "76 rows" from "section 76"; that universe is held
 *     by the rule of acceptance — a number about the state without a line of output is not taken;
 *   - it does not check the human part, "what exactly was measured". Prose is closed by any word,
 *     so requiring it would make this a mirror. A claim WIDER than its measurement (true tree,
 *     false claim) is not stale and is not caught here — it is caught by someone other than the
 *     author repeating exactly what is claimed;
 *   - it does not check database marks (`[db …]`); their state is not in the tree fingerprint;
 *   - it runs when somebody runs it. It is a tool, not a guard in the suites: the live document is
 *     edited by four people at once, and a red in the tree would be red for all of them.
 *
 * Run: `npm run marks -- <file.md>` — prints every mark with its line and verdict, then the counts,
 * and exits non-zero when any mark is stale or incomplete.
 */

const fs = require('fs');
const tree = require('./tree-fingerprint');

const MARK = /\[tree\s+([^\]|]*?)\s*(?:\|\s*([^\]]*?))?\s*\]/g;
const HASH = /^[0-9a-f]{16}$/;

/** Every mark in a text, with its line, and the verdict against `currentHash`. */
function marksIn(text, currentHash) {
    const out = [];
    text.split('\n').forEach((lineText, i) => {
        let m;
        MARK.lastIndex = 0;
        while ((m = MARK.exec(lineText)) !== null) {
            const hash = (m[1] || '').trim();
            const command = (m[2] || '').trim();
            let verdict;
            if (!HASH.test(hash) || !command) verdict = 'incomplete';
            else verdict = hash === currentHash ? 'current' : 'stale';
            out.push({ line: i + 1, hash, command, verdict });
        }
    });

    return out;
}

function main(argv) {
    const file = argv[0];
    if (!file) {
        process.stderr.write('usage: npm run marks -- <file>\n');
        return 2;
    }
    const now = tree.fingerprint();
    const marks = marksIn(fs.readFileSync(file, 'utf8'), now.hash);
    process.stdout.write(tree.line('now', now) + '\n');
    process.stdout.write('[marks] file ' + file + ' | marks found ' + marks.length + '\n');
    marks.forEach((m) => process.stdout.write('[marks]    line ' + m.line + ' ' + m.verdict
        + ' | tree ' + (m.hash || '?') + ' | repeat: ' + (m.command || '?') + '\n'));
    const bad = marks.filter((m) => m.verdict !== 'current');
    process.stdout.write('[marks] current ' + (marks.length - bad.length) + ', stale '
        + marks.filter((m) => m.verdict === 'stale').length + ', incomplete '
        + marks.filter((m) => m.verdict === 'incomplete').length + '\n');

    return bad.length ? 1 : 0;
}

if (require.main === module) process.exitCode = main(process.argv.slice(2));

module.exports = { marksIn, main };

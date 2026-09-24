/**
 * GH-610 — RUSSIAN IS NOT ADDED TO THE TREE UNNOTICED.
 *
 * THE RULE. The owner settled on 23.09.2026 that the code carries no Russian —
 * not in comments, not in names, not in strings, not in the tools that live in
 * the repository. Russian belongs to our plans and documents. Nothing here
 * reaches a client: the rule is about a tree that a second reader can work in,
 * not about what a screen shows.
 *
 * WHY A GUARD AND NOT A SWEEP, and the number is the argument. The rule was
 * written that morning and BROKEN THREE TIMES THE SAME DAY — by `gh601`, by
 * `gh597`, and by the boron work, which put it into a product file and a test.
 * Files carrying Cyrillic went 18 after the morning sweep, up to 20, and are 17
 * now. Every one of the three was caught by a person, and twice not by the
 * author. A rule whose only instrument is attention is a wish.
 *
 * WHAT IT USED TO LEAVE ALONE, AND NO LONGER HAS TO. It froze seventeen files
 * as a named remainder rather than cleaning them, because cleaning was a queue
 * item of its own and tying the two together would have delayed the cheap work
 * for the expensive. That item was done on 24.09.2026 (GH-623) and the
 * remainder is empty: every one of the seventeen was cleared, and this guard
 * went red at each step asking to be updated, which is exactly its job.
 *
 * FIVE THINGS IT HAS TO GET RIGHT — four proven earlier on the reference guard
 * (`gh601`), and a fifth learned the hard way today:
 *
 *   1. THE UNIVERSE COMES FROM THE TREE, not from a list written here. It walks
 *      what is on disk.
 *   2. IT PRINTS WHAT IT INSPECTED, not only a verdict. "Clean" and "never got
 *      there" are otherwise the same answer.
 *   3. IT GOES RED ON A NEW FILE and holds the seventeen BY NAME.
 *   4. WHEN THE REMAINDER SHRINKS IT ALSO GOES RED and asks to be updated. A
 *      remainder that quietly absorbs its own cleaning is a permission.
 *   5. IT COMPARES THE LIST, NOT ITS LENGTH. This morning a COUNT of files
 *      failed to show that one of the eighteen was there not as a leftover but
 *      as that same day's work; the mistake lived nine hours, covered by its
 *      own number. A census that reports 17 for two different sets of files is
 *      a census that cannot see a swap, and the case below says so explicitly.
 *
 * NO FILE IS EXCLUDED FROM THE WALK, INCLUDING THIS ONE. The reference guard
 * had to skip itself, because its census names the very tokens it hunts, and it
 * said plainly what that cost. This one needs no exclusion: the range it
 * matches is built from code points, so this file contains no Cyrillic and is
 * inspected like any other.
 *
 * AND THE BOUNDARY THAT REMAINS, WITH ITS PRICE, because "no file is excluded"
 * is about files and reads wider than it is. This looks for CHARACTERS, not for
 * values: Russian written as an escape — `\u0432\u043e\u043f\u0440\u043e\u0441`, or built with
 * `String.fromCharCode` — is not a Cyrillic character and passes unseen. It is
 * in the tree today, deliberately: `gh601` spells the Russian word for
 * "question" that way in 15 places, because it must MATCH Cyrillic while the
 * project's rule says the code carries none, and its own acceptance has to be
 * able to come back empty. The line below does the same for this very range.
 * So the price is exact: anyone who wants Russian past this guard can escape
 * it, and the two files that do are the two whose job requires it. Closing that
 * would redden both guards on their own machinery, which is a worse trade than
 * naming it here.
 */

'use strict';

const fs = require('fs');
const path = require('path');

const ROOT = path.join(__dirname, '..');

/**
 * WHERE IT LOOKS. The code, and the tools that live in the repository — the
 * owner's rule names them as code. `files/` is entered for TOOLS ONLY: the
 * plans beside them are our documents and are written in Russian on purpose,
 * which is where Russian belongs.
 */
const ROOTS = ['assets', 'app', 'tests'];
const TOOL_ROOTS = ['files'];
const READ = /\.(js|json|php|ts|css|blade\.php)$/;
const TOOL_ONLY = /\.(py|sh|js|mjs)$/;
const SKIP_DIRS = new Set(['node_modules', 'vendor', 'storage', '.git']);
const SKIP_FILES = new Set(['package-lock.json', 'composer.lock']);

/** Cyrillic, by code point — which is why this file carries none of it. */
const CYRILLIC = new RegExp('[' + String.fromCharCode(0x0400) + '-' + String.fromCharCode(0x04FF) + ']+', 'g');

/**
 * THE REMAINDER, BY NAME AND BY COUNT, FROZEN 23.09.2026.
 *
 * A census of what exists, not a list of what is allowed. Seventeen files, and
 * the count is the number of Cyrillic runs in each, so a new sentence added to
 * a file that already has some cannot hide behind it.
 */
const REMAINDER = {
    // GH-623 — EMPTY, AND THAT IS THE POINT. The seventeen files this guard
    // froze on 23.09.2026 were cleared the next night: two product files whose
    // Cyrillic was in comments only, and fifteen test files. The guard caught
    // the tree as it shrank and demanded this update at every step, which is
    // the behaviour it was built for — a remainder that absorbs its own
    // cleaning is a permission, not a guard.
    //
    // THE RULE IS NOW ABSOLUTE: any Cyrillic character anywhere under `assets`,
    // `app`, `tests` or the tools in `files/` is new, and this goes red naming
    // the file. Nothing is allowed through, so nothing has to be judged.
};

/** Walk the tree. The universe is what is on disk. */
function scan() {
    const files = [];
    const found = {};

    const walk = (dir, accept) => {
        const here = path.join(ROOT, dir);
        if (!fs.existsSync(here)) return;
        for (const entry of fs.readdirSync(here, { withFileTypes: true })) {
            if (entry.isDirectory()) {
                if (!SKIP_DIRS.has(entry.name)) walk(path.join(dir, entry.name), accept);
                continue;
            }
            if (SKIP_FILES.has(entry.name) || !accept.test(entry.name)) continue;
            const rel = path.join(dir, entry.name);
            files.push(rel);
            const runs = (fs.readFileSync(path.join(ROOT, rel), 'utf8').match(CYRILLIC) || []).length;
            if (runs > 0) found[rel] = runs;
        }
    };
    ROOTS.forEach((r) => walk(r, READ));
    TOOL_ROOTS.forEach((r) => walk(r, TOOL_ONLY));
    return { files, found };
}

describe('GH-610 — Russian cannot be added to the code unnoticed', () => {
    const { files, found } = scan();

    test('it reached the tree at all, and says what it looked at', () => {
        // The positive control, and what tells "clean" apart from "never got
        // there": every claim below rests on this walk.
        process.stdout.write(
            '\n[GH-610] files inspected: ' + files.length
            + '\n[GH-610] files carrying Russian: ' + Object.keys(found).length
            + ' (remainder frozen at ' + Object.keys(REMAINDER).length + ')'
            + '\n[GH-610] Cyrillic runs in them: '
            + Object.values(found).reduce((a, b) => a + b, 0)
            + '\n[GH-610] the files: ' + Object.keys(found).sort().join(', ')
            + '\n');

        expect(files.length).toBeGreaterThan(200);
        // The tools really were walked, or `files/` is a root in name only.
        expect(files.filter((f) => f.startsWith('files' + path.sep)).length).toBeGreaterThan(0);
        // And this file was inspected like any other — no exclusion anywhere.
        expect(files).toContain(path.join('tests', 'gh610-no-new-russian-in-the-tree.test.js'));
    });

    test('NO NEW Russian — not a new file, and not one more run in a file that had some', () => {
        const added = [];
        Object.keys(found).sort().forEach((file) => {
            const was = REMAINDER[file];
            if (was === undefined) { added.push(file + '  — Russian in a file that had none (' + found[file] + ')'); return; }
            if (found[file] > was) added.push(file + '  — was ' + was + ', now ' + found[file]);
        });
        expect({ russianAddedToTheCode: added }).toEqual({ russianAddedToTheCode: [] });
    });

    test('and when the remainder shrinks, the guard asks to be updated', () => {
        // Requirement 4. Without this the census silently becomes a permission:
        // a file cleaned today would leave a standing allowance for tomorrow,
        // and the seventeen would never become sixteen in writing.
        const cleaned = [];
        Object.keys(REMAINDER).sort().forEach((file) => {
            if (found[file] === undefined) { cleaned.push(file + '  — clean now, remove it from REMAINDER'); return; }
            if (found[file] < REMAINDER[file]) {
                cleaned.push(file + '  — was ' + REMAINDER[file] + ', now ' + found[file] + ', update REMAINDER');
            }
        });
        expect({ cleanedButStillListed: cleaned }).toEqual({ cleanedButStillListed: [] });
    });

    test('the comparison is of the LIST, not of its length — the lesson that cost nine hours', () => {
        // Requirement 5, stated as its own case because a count is exactly what
        // hid the mistake this guard was opened for. Two sets of the same size
        // are not the same set, and a census that reports only "17" cannot tell
        // a leftover from a file added today.
        //
        // Demonstrated against the real comparison rather than described: the
        // set with one file swapped for another is the same length and must be
        // reported, in BOTH directions — one added and one gone.
        // GH-623: stated against a pair of names of its own rather than against
        // the remainder, which is empty now. The comparison under test is the
        // one the two cases above perform, and it must behave the same whether
        // the remainder holds seventeen files or none.
        const remainder = { 'assets/one.js': 3 };
        const seen = { 'assets/another.js': 3 };

        // Same size, different membership — a count cannot tell these apart.
        expect(Object.keys(seen)).toHaveLength(Object.keys(remainder).length);

        const added = Object.keys(seen).filter((f) => remainder[f] === undefined);
        const gone = Object.keys(remainder).filter((f) => seen[f] === undefined);

        expect(added).toEqual(['assets/another.js']);
        expect(gone).toEqual(['assets/one.js']);

        // And the real remainder is empty, which is what the work of GH-623
        // left behind — asserted so that a refilled one is noticed here too.
        expect(Object.keys(REMAINDER)).toEqual([]);
    });
});

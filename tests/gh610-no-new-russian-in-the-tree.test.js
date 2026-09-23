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
 * WHAT IT DOES NOT DO. It does not clean the seventeen. Those are a queue item
 * of their own, standing last by the owner's decision, and tying the two
 * together would delay the cheap work for the expensive. This catches what is
 * ADDED.
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
    'assets/nutrition-calendar.js': 3,
    'assets/word-export.js': 9,
    'tests/e2e/gh505-the-press-answers-live.test.js': 8,
    'tests/e2e/gh536-samples-read-failure-live.test.js': 1,
    'tests/gh312-unified-nutrient-balance-status.test.js': 11,
    'tests/gh425-calc-trace.test.js': 2,
    'tests/gh486-data-availability.test.js': 1,
    'tests/gh487-scope-is-derived-from-the-reason.test.js': 2,
    'tests/gh490-soil-readings-are-the-sample.test.js': 15,
    'tests/gh498-the-announcement-is-not-a-timer.test.js': 8,
    'tests/gh510-not-computed-is-not-zero.test.js': 1,
    'tests/gh511-no-number-no-verdict.test.js': 1,
    'tests/gh517-waiting-by-the-clock-census.test.js': 7,
    'tests/gh520-methodology-has-one-owner.test.js': 7,
    'tests/gh536-browser-copy-removed.test.js': 1,
    'tests/gh536-hub-active-site-survives-the-key.test.js': 2,
    'tests/gh536-samples-unavailable-banner.test.js': 1,
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
        const names = Object.keys(REMAINDER);
        const swapped = Object.assign({}, found);
        delete swapped[names[0]];
        swapped['assets/a-file-that-was-never-in-the-remainder.js'] = REMAINDER[names[0]];

        expect(Object.keys(swapped)).toHaveLength(Object.keys(found).length);

        const added = Object.keys(swapped).filter((f) => REMAINDER[f] === undefined);
        const gone = Object.keys(REMAINDER).filter((f) => swapped[f] === undefined);

        expect(added).toEqual(['assets/a-file-that-was-never-in-the-remainder.js']);
        expect(gone).toEqual([names[0]]);
    });
});

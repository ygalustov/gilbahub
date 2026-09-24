/**
 * GH-622 — A TEST THAT CUTS A WINDOW OUT OF SOURCE MUST SAY THE WINDOW IS REAL.
 *
 * THE FAULT, AND IT HAS TWO FACES. Many cases here find an anchor in a source
 * file and slice a fixed number of characters around it. `gh577` did that with
 * `SRC.slice(at - 400, at + 1400)`, and a docblock written between two of the
 * lines it checked pushed `CEC` to offset 2112 and `EC1_5` to 2179 — both
 * outside the window. The case went red; the product was untouched.
 *
 * THE RED FACE IS THE HARMLESS ONE. Somebody looks, finds nothing wrong, and
 * fixes the case. The GREEN face is the one that costs: when a window shrinks
 * past what it was checking, an assertion of the form `expect(block).not.…`
 * keeps passing, because a negative claim is true of an empty string. From
 * outside, a case passing over nothing looks exactly like a case that works.
 *
 * THE REMEDY IS NOT A BIGGER WINDOW — the next insertion breaks that too. It is
 * one positive claim beside each window: that it is not empty, and that it
 * contains its own anchor. `gh299` has carried that pattern since GH-466, where
 * an anchor stopped matching, `slice(-1, …)` returned the file's last character
 * and three assertions passed over it.
 *
 * WHAT THIS FILE IS. Not a repair of the 113 windows — it is the census that
 * stops a 114th appearing unguarded, and it holds the ten that remain by name.
 * Four were repaired the day it was written, chosen because their claims were
 * ALL negative and would therefore survive the window vanishing:
 * `disease-forecast-unification` (twice), `gh305-aa-generic-range-ceiling-
 * consumers` — which had no anchor check at all — and
 * `hub-tissue-analysis-writeback-merge-b35fix391`.
 *
 * THE MUTATION THAT MUST REDDEN THIS, named here because the reviewer cannot
 * run one today: add a window to any test file — `const w = src.slice(at, at +
 * 500);` — and assert only something negative about it. This census names the
 * new file and the line. Removing a positive assertion from one of the
 * currently-guarded windows does the same.
 */

'use strict';

const fs = require('fs');
const path = require('path');

const ROOT = path.join(__dirname, '..');
const DIRS = ['tests', path.join('tests', 'e2e')];

/**
 * A window cut with a numeric offset from an anchor index.
 *
 * GH-624 — AND THE SPAN HAS A FLOOR, because the pattern alone cannot tell a
 * window of source from a slice of an array. `rowAfter(html, a).slice(off, off
 * + 3)` takes three table cells; `lines.slice(idx, idx + 6)` takes six lines of
 * an already-split file. Neither is a block of text that can silently shrink
 * past its subject, and demanding a length assertion of them would be noise —
 * the census would name places where nothing can go wrong, and a census that
 * cries wolf is switched off.
 *
 * The floor is 50 characters, and it is a measurement rather than a taste: the
 * source windows in this tree run from 120 to 4,000, and the array slices from
 * 3 to 6. Nothing sits between.
 */
const WINDOW = /\.slice\(\s*([A-Za-z_][\w]*)\s*(?:-\s*\d+\s*)?,\s*\1\s*\+\s*(\d+)\s*\)/;
const SPAN_FLOOR = 50;
/** The name the window is bound to, so the assertions can be recognised. */
const BOUND = /(?:const|var|let)\s+([A-Za-z_][\w]*)\s*=/;

/**
 * Windows that carry no positive claim, frozen 24.09.2026.
 *
 * A census of what exists, not a list of what is allowed. Each is a place where
 * the block is cut and then either handed elsewhere or judged only by what it
 * does NOT contain. When one is repaired the guard goes red and asks to be
 * updated — a remainder that absorbs its own cleaning is a permission.
 */
const REMAINDER = [
    // GH-624 — EMPTY. The fourteen windows this census named on the night it
    // was written were settled the same night: ten were real source windows and
    // were given a length claim beside them; three were slices of arrays, not
    // of text, and the census now passes them by on a measured span floor; one
    // is a live probe running inside the browser, where `expect` does not
    // exist, and it throws on a collapsed window instead.
    //
    // From here every source window in the tree makes a positive claim, and a
    // new one that does not is named by the case below.
];

/** Every test file on disk — the universe is the tree, not a list written here. */
function testFiles() {
    const out = [];
    DIRS.forEach((d) => {
        const here = path.join(ROOT, d);
        if (!fs.existsSync(here)) return;
        fs.readdirSync(here).forEach((f) => {
            if (f.endsWith('.test.js')) out.push(path.join(d, f));
        });
    });
    return out;
}

/** Windows and whether anything positive is claimed about each. */
function census() {
    const guarded = [];
    const bare = [];

    testFiles().forEach((rel) => {
        if (rel.endsWith('gh622-a-window-says-it-is-real.test.js')) return;
        const lines = fs.readFileSync(path.join(ROOT, rel), 'utf8').split('\n');
        lines.forEach((line, i) => {
            const w = WINDOW.exec(line);
            if (!w || Number(w[2]) < SPAN_FLOOR) return;
            // A regular-expression result is not a block either — `const m =
            // /…/.exec(src.slice(at, at + 120))` binds the match, not the text.
            if (/\.exec\(/.test(line)) return;
            const bound = BOUND.exec(line);
            if (!bound) return;
            const name = bound[1];
            // A positive claim, in either of the two forms this tree uses:
            // `expect(...)` where Jest is in scope, and a plain `throw` where it
            // is not — inside `page.evaluate`, the code runs in the browser and
            // `expect` does not exist there. A guard that only recognised the
            // first would demand an impossible assertion of every live probe.
            const positive = lines.slice(i + 1, i + 26).some((l) =>
                new RegExp('expect\\(\\s*' + name + '\\.length\\s*\\)\\s*\\.toBeGreaterThan').test(l)
                || new RegExp('expect\\(\\s*' + name + '\\s*\\)\\s*\\.(toContain|toMatch)\\(').test(l)
                || new RegExp('if\\s*\\(\\s*' + name + '\\.length\\s*<').test(l));
            (positive ? guarded : bare).push(rel + '|' + name);
        });
    });
    return { guarded, bare };
}

describe('GH-622 — a window cut from source says that it is real', () => {
    const { guarded, bare } = census();

    test('the walk reached the tree and found windows at all', () => {
        // Positive control for the census itself — the same demand it makes of
        // everyone else. "No unguarded windows" and "never looked" are
        // otherwise the same answer.
        process.stdout.write(
            '\n[GH-622] test files inspected: ' + testFiles().length
            + '\n[GH-622] source windows found: ' + (guarded.length + bare.length)
            + ' (' + guarded.length + ' make a positive claim, ' + bare.length + ' do not)'
            + '\n[GH-622] unguarded: ' + bare.sort().join(', ')
            + '\n');

        expect(testFiles().length).toBeGreaterThan(200);
        expect(guarded.length + bare.length).toBeGreaterThan(50);
    });

    test('NO NEW unguarded window — a 114th cannot appear unnoticed', () => {
        const added = bare.filter((w) => REMAINDER.indexOf(w) === -1);
        expect({ windowsWithNoPositiveClaim: added }).toEqual({ windowsWithNoPositiveClaim: [] });
    });

    test('and when one is repaired, the guard asks to be updated', () => {
        // Requirement the census of GH-610 proved: a remainder that quietly
        // absorbs its own cleaning is a permission, not a guard.
        const cleaned = REMAINDER.filter((w) => bare.indexOf(w) === -1);
        expect({ repairedButStillListed: cleaned }).toEqual({ repairedButStillListed: [] });
    });

    test('the four repaired that day stay repaired', () => {
        // Named rather than counted. Each had ONLY negative claims about its
        // window, which is the shape that survives the window vanishing.
        ['tests/disease-forecast-unification.test.js|nearby',
         'tests/disease-forecast-unification.test.js|catchBody',
         'tests/gh305-aa-generic-range-ceiling-consumers.test.js|sBlock',
         'tests/hub-tissue-analysis-writeback-merge-b35fix391.test.js|window800',
        ].forEach((w) => expect(guarded).toContain(w));
    });
});

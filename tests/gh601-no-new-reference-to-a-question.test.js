/**
 * GH-601 — NO NEW REFERENCE TO A QUESTION NUMBER IN THE CODE.
 *
 * THE RULE. The owner settled on 23.09.2026 that code carries no reference to a
 * question of our own defects document — only `GH-NNN`, the task the line was
 * written under. A question number in a comment is an address that ages in
 * silence: the questions above 59 were regrouped that same day, and nothing in
 * the tree said that `Q64` had stopped naming anything.
 *
 * WHY A GUARD AND NOT A SWEEP. Sweeping every existing place was put to the
 * owner and declined; the remainder stays and is recorded as deferred. This
 * catches what is ADDED. A rule with no instrument is a wish — the one this
 * replaces was written down twice and broken twice within the hour.
 *
 * WHAT IS NOT THE SUBJECT, and getting this wrong would make the guard a
 * nuisance: a reference to a section of SOMEBODY ELSE'S document is allowed.
 * The client audit's `question 10.8(17)`, the review ledger's `open question
 * 12` — those name a place in a plan we did not write, they do not rot when we
 * renumber ours, and eighteen of them sit in the product today untouched.
 *
 * THE FORM IS TAKEN FROM THE TREE, NOT FROM THE SENTENCE THAT DESCRIBES IT.
 * The acceptance form used earlier in the day matched an upper-case `Q` and the
 * Russian word only, and could not see lower-case `q31` or the word `question`
 * — which is how a hundred-odd places were counted as eleven. A guard written
 * from that phrasing would inherit the hole, so this one matches without case
 * and walks the files on disk.
 */

'use strict';

const fs = require('fs');
const path = require('path');

const ROOT = path.join(__dirname, '..');
/**
 * WHERE IT LOOKS. The rule covers code, comments, tests, fixtures, data files
 * AND the tools that live in the repository — `files/` holds a few, and the
 * reviewer put a reference into one of them and watched this walk past it.
 *
 * `files/` is entered for TOOLS ONLY: the plans beside them are prose about the
 * questions and name them by number on purpose, which is where a question
 * number belongs.
 */
const ROOTS = ['assets', 'app', 'tests'];
const TOOL_ROOTS = ['files'];
const TOOL_ONLY = /\.(py|sh|js|mjs)$/;
const SKIP_DIRS = new Set(['node_modules', 'vendor', 'storage', '.git']);
const SKIP_FILES = new Set(['package-lock.json', 'composer.lock']);

/**
 * THE ONE FILE THE WALK SKIPS, AND THE PRICE OF SKIPPING IT.
 *
 * This guard's census names the tokens it guards against, so the walk finds
 * them here and calls its own list a hundred new references. Excluding a file
 * is how guards go blind, so it is exactly one file, it is named, and the cost
 * is stated: a reference to one of our questions written INTO THIS FILE, other
 * than in the census, is not seen by it. The census is where those tokens are
 * supposed to be.
 */
const SELF = 'gh601-no-new-reference-to-a-question.test.js';
const READ = /\.(js|json|php)$/;

/** Every shape a reference takes in this tree, matched without case. */
/**
 * The Russian form is written in escapes, not in letters. This guard must
 * MATCH Cyrillic, and the project's rule is that code carries none — so the
 * one place that has to name it does so by code point, and the rule's own
 * acceptance can come back empty instead of always naming this file.
 * `\u0432\u043e\u043f\u0440\u043e\u0441` is `vopros`, and the class after it is a-ya plus yo.
 *
 * AND THERE IS NO `\b` IN FRONT OF IT, which is not a detail: JavaScript's word
 * boundary is defined on ASCII, so the position between a space and a Cyrillic
 * letter is not one, and the Russian alternative NEVER MATCHED. Found by
 * checking that the escaped form still behaved like the letters it replaced —
 * it did, and both were blind. The guard has never seen a Russian reference
 * until now.
 */
const REFERENCE = /\bq(\d+)\b|\bquestion\s+([\d.]+)|\u0432\u043e\u043f\u0440\u043e\u0441[\u0430-\u044f\u0451]*\s+(\d+)/gi;

/**
 * Why a match is NOT a reference to our document — one reason per rule, so a
 * silenced match can be read back and argued with.
 *
 * EVERY RULE LOOKS AT THE LINE. One used to look at the TOKEN: `q10` was
 * silenced wherever it appeared, on the grounds that it is the EFSA temperature
 * coefficient. Our questions are numbered from one and run past seventy, so ten
 * is a live number — and the reviewer wrote `Q10 of our open questions is
 * settled` into a product file and watched this stay green. A rule that judges
 * a token cannot tell the two apart, so it is gone: the six lines that really
 * are the coefficient are pinned in the remainder by file and count, which also
 * means the guard asks to be updated if they change.
 */
/**
 * The stretches of a line that are NOT a reference to our document, each with
 * its reason — as SPANS, so a rule silences its own match and nothing else.
 *
 * It used to answer about the whole LINE: one quarter label, one audit section,
 * and every other match on that line went quiet with it. Measured by the
 * reviewer, twice, on ordinary English comments — `// Q61 remains an open
 * question for the owner` and `// see Q61, section 10.8 of the plan lists it`
 * — and the guard said nothing about either `Q61`. A rule that judges a line
 * cannot be right about a line with two things in it, and comments have two
 * things in them all the time.
 */
const SILENCE = [
    [/q[1-4]\s+(19|20)\d\d/gi, 'a quarter in a zone label'],
    [/b35fix\d+\s+q\d+/gi, 'a sub-part of the old b35fix307 repair'],
    [/\boq\d+/gi, 'a number from the OQ ledger'],
    [/question\s+\d+\.\d+(\(\d+\))?/gi, 'a section of the client audit'],
    // The same audit written the other way round — the question first, its
    // section after. Found when the silencing narrowed from the line to the
    // match: eight ordinary lines of `question 2 of section 10.8` surfaced as
    // new references, and a guard that cries wolf on eight true comments gets
    // switched off, which is how guards die.
    [/question\s+\d+\s+of\s+section\s+\d+(\.\d+)?/gi, 'a section of the client audit'],
    [/section\s+10\.8/gi, 'a section of the client audit'],
    [/(review\s+)?open\s+question\s+\d+/gi, 'the REVIEW / Open Question list'],
];

/** Why THIS match, at this position, is not a reference — or null. */
function notAReference(line, index, length) {
    for (const [pattern, why] of SILENCE) {
        pattern.lastIndex = 0;
        let m;
        while ((m = pattern.exec(line)) !== null) {
            if (index >= m.index && index + length <= m.index + m[0].length) return why;
        }
    }
    return null;
}


/**
 * THE REMAINDER, BY NAME, FROZEN.
 *
 * Keyed by file and token rather than by line: a line number rots on the next
 * edit above it, and this tree has watched one exemption move four times in a
 * day. The COUNT is pinned too, so a new reference added to a file that already
 * has one cannot hide behind it.
 *
 * It is a census of what exists, not a list of what is allowed. When it shrinks
 * the guard goes red and asks to be updated — a remainder that quietly absorbs
 * its own cleaning is a permission, not a guard.
 */
const REMAINDER = {
    // The EFSA temperature coefficient, six lines in one file. Pinned rather
    // than silenced by a rule on the token — see `notAReference`.
    'assets/spray-log-cascade.js|q10': 6,
    'app/tests/Feature/Gh569RunCompletenessAsAnEventTest.php|q31': 2,
    'app/tests/Feature/Gh570TheRuleReadsTheLevelTest.php|q31': 2,
    'app/tests/Feature/Gh570WhatThePanelSaysOnTheLiveRowsTest.php|q31': 4,
    'app/tests/Feature/Gh571TheVerdictComesFromTheResultTest.php|q31': 2,
    'assets/word-export-combined.js|question 12': 1,
    'assets/word-export.js|question 2': 1,
    'tests/e2e/gh537-westview-export-offers-its-sample-live.test.js|q33': 11,
    'tests/e2e/gh537-westview-export-offers-its-sample-live.test.js|question 33': 1,
    'tests/e2e/gh538-stand-restore-round-trip-live.test.js|question 39': 1,
    'tests/e2e/gh539-empty-analysis-cache-write-live.test.js|q31': 18,
    'tests/e2e/gh540-reports-pages-analysis-cache-write-live.test.js|question 31.': 1,
    'tests/gh552-where-the-chain-is-broken.test.js|q31': 5,
    'tests/gh555-why-the-engine-was-empty.test.js|q31': 7,
    'tests/gh556-a-pass-before-the-weather-is-not-completion.test.js|q31': 1,
    'tests/gh559-where-the-soil-temperature-goes.test.js|q31': 7,
    'tests/gh568-why-soil-and-nutrition-is-empty.test.js|q31': 6,
    'tests/gh568-why-soil-and-nutrition-is-empty.test.js|question 1': 2,
    'tests/gh568-why-soil-and-nutrition-is-empty.test.js|question 2': 1,
    'tests/gh568-why-soil-and-nutrition-is-empty.test.js|question 3': 1,
    'tests/gh573-the-pass-declares-what-it-did-not-produce.test.js|q31': 4,
    'tests/gh580-the-identity-table-says-what-the-code-does.test.js|q64': 1,
    'tests/gh581-the-runner-sends-what-it-was-given.test.js|q64': 1,
    'tests/gh584-the-universe-covers-the-whole-graph.test.js|q31': 1,
    'tests/gh584-the-universe-covers-the-whole-graph.test.js|q64': 3,
};

/** Walk the tree. The universe is what is on disk, not a list written here. */
function scan() {
    const files = [];
    const found = {};
    const silenced = [];

    const walk = (dir, accept) => {
        for (const entry of fs.readdirSync(path.join(ROOT, dir), { withFileTypes: true })) {
            if (entry.isDirectory()) {
                if (!SKIP_DIRS.has(entry.name)) walk(path.join(dir, entry.name), accept);
                continue;
            }
            if (SKIP_FILES.has(entry.name) || entry.name === SELF || !accept.test(entry.name)) continue;
            const rel = path.join(dir, entry.name);
            files.push(rel);
            const lines = fs.readFileSync(path.join(ROOT, rel), 'utf8').split('\n');
            lines.forEach((line, i) => {
                REFERENCE.lastIndex = 0;
                let m;
                while ((m = REFERENCE.exec(line)) !== null) {
                    const token = m[0].toLowerCase();
                    const why = notAReference(line, m.index, m[0].length);
                    if (why) { silenced.push({ file: rel, line: i + 1, token, why }); continue; }
                    const key = rel + '|' + token;
                    found[key] = (found[key] || 0) + 1;
                }
            });
        }
    };
    ROOTS.forEach((r) => walk(r, READ));
    TOOL_ROOTS.forEach((r) => walk(r, TOOL_ONLY));
    return { files, found, silenced };
}

describe('GH-601 — a reference to one of our questions cannot be added unnoticed', () => {
    const { files, found, silenced } = scan();

    test('it reached the tree at all, and says what it looked at', () => {
        // The positive control, and the thing that tells "clean" apart from
        // "never got there": every claim below rests on this walk.
        expect(files.length).toBeGreaterThan(200);
        expect(Object.keys(found).length).toBeGreaterThan(0);
        // The exclusion is one file and stays one file.
        expect(files.filter((f) => f.endsWith(SELF))).toEqual([]);
        expect(fs.existsSync(path.join(__dirname, SELF))).toBe(true);

        const byReason = {};
        silenced.forEach((s) => { byReason[s.why] = (byReason[s.why] || 0) + 1; });
        process.stdout.write(
            '\n[GH-601] files inspected: ' + files.length
            + '\n[GH-601] matches judged to be references: '
            + Object.values(found).reduce((a, b) => a + b, 0)
            + ' across ' + Object.keys(found).length + ' (file, token) pairs'
            + '\n[GH-601] not references, by reason: ' + JSON.stringify(byReason, null, 0)
            + '\n');
    });

    test('NO NEW reference — not a new file, not a new token, not one more in a file that had some', () => {
        const added = [];
        Object.keys(found).sort().forEach((key) => {
            const was = REMAINDER[key];
            if (was === undefined) { added.push(key + '  — a new reference (' + found[key] + ')'); return; }
            if (found[key] > was) added.push(key + '  — was ' + was + ', now ' + found[key]);
        });
        expect({ newReferencesToOurQuestions: added }).toEqual({ newReferencesToOurQuestions: [] });
    });

    test('and when the remainder SHRINKS the list is brought up to date, not left as a permission', () => {
        // The half that makes this a guard rather than a silence. A census that
        // absorbs its own cleaning stops naming what is left, and the next
        // reference slips in under a number nobody checked.
        const stale = [];
        Object.keys(REMAINDER).sort().forEach((key) => {
            const now = found[key];
            if (now === undefined) { stale.push(key + '  — no references left, drop it from the remainder'); return; }
            if (now < REMAINDER[key]) stale.push(key + '  — was ' + REMAINDER[key] + ', now ' + now + ', update the remainder');
        });
        expect({ remainderNoLongerMatchesTheTree: stale }).toEqual({ remainderNoLongerMatchesTheTree: [] });
    });

    test('a silenced stretch silences ITSELF, not its neighbours on the line', () => {
        // The hole the reviewer measured twice: `notAReference` answered about
        // the whole LINE, so one quarter label or one audit section took every
        // other match on that line quiet with it. Both probes below are ordinary
        // English comments, not inventions — a line with two things in it is
        // what comments look like.
        const probes = [
            ['// Q61 remains an open question for the owner', 'q61'],
            ['// see Q61, section 10.8 of the plan lists it', 'q61'],
            ['// Green 1 Q1 2025 and Q61 of our own list', 'q61'],
        ];
        const missed = [];
        probes.forEach(([line, expected]) => {
            REFERENCE.lastIndex = 0;
            const kept = [];
            let m;
            while ((m = REFERENCE.exec(line)) !== null) {
                if (!notAReference(line, m.index, m[0].length)) kept.push(m[0].toLowerCase());
            }
            if (!kept.includes(expected)) missed.push(line);
        });
        expect({ linesWhereARealReferenceWentQuiet: missed })
            .toEqual({ linesWhereARealReferenceWentQuiet: [] });

        // And the neighbour that SHOULD be silent still is, or the repair has
        // simply stopped silencing anything.
        const quarter = '// Green 1 Q1 2025 and Q61 of our own list';
        REFERENCE.lastIndex = 0;
        const silenced = [];
        let q;
        while ((q = REFERENCE.exec(quarter)) !== null) {
            if (notAReference(quarter, q.index, q[0].length)) silenced.push(q[0].toLowerCase());
        }
        expect(silenced).toEqual(['q1']);
    });

    test('a reference to somebody else’s document is not the subject', () => {
        // Eighteen of these sit in the product and must stay silent, or the
        // guard becomes a nuisance and gets disabled — which is how guards die.
        const alien = silenced.filter((s) => /client audit|Open Question/.test(s.why));
        expect(alien.length).toBeGreaterThan(0);
        expect(alien.some((s) => s.file.includes('nutrition-program-inputs.js'))).toBe(true);
        process.stdout.write('[GH-601] references to other documents, left silent: ' + alien.length + '\n');
    });
});

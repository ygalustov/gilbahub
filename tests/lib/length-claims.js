/**
 * GH-746 — WHERE A TEST COMPARES THE LENGTH OF A LIST WITH A NUMBER.
 *
 * A guard that asserts `x.length === 5` says that five things are there and cannot say which five.
 * When the members are distinguishable — globals, files, steps, entries — the number loses exactly
 * what the list was collected for: 193 became 192 overnight and nothing could say which global went.
 * When the members are indistinguishable — calls, requests, writes of one kind — the number IS the
 * claim ("written once"), and a list would add nothing.
 *
 * This finds the three shapes by what they are, so that each site can be declared one or the other:
 *   - `expect(<x>.length).toBe(<n>)` / `.toEqual(<n>)` / `.toStrictEqual(<n>)`
 *   - `expect(<x>).toHaveLength(<n>)` with n > 0
 *   - PHP `assertCount(<n>, <x>)`
 *
 * NOT FOUND, said here rather than left to be discovered:
 *   - a floor (`toBeGreaterThan`) — it proves a census reached the tree, not which members it holds;
 *   - `toHaveLength(0)` — an empty list, and jest prints the received array when it is not;
 *   - a count carried through a variable (`const n = x.length; expect(n).toBe(3)`);
 *   - a guard that only PRINTS a count and asserts nothing about it.
 */

'use strict';

const fs = require('fs');
const path = require('path');

const ROOT = path.join(__dirname, '..', '..');

const SHAPES = [
    /expect\(\s*[^;]*?\.length\s*\)\s*\.(?:toBe|toEqual|toStrictEqual)\(\s*\d+\s*\)/g,
    /expect\(\s*[^;]*?\)\s*\.toHaveLength\(\s*[1-9]\d*\s*\)/g,
    /assertCount\(\s*\d+\s*,[^;]*?\)\s*;/g,
];

/**
 * GH-747 — THE FOURTH SHAPE, and it is here because the reviewer of GH-746 measured what the
 * other three miss: a count carried through a variable. It was named a boundary, and a boundary
 * it is not — `const occurrences = matches.length; expect(occurrences).toBe(2)` is how people
 * write, not how they evade a guard, and six real sites in the tree were written that way
 * (`gh342`, `gh313`, `gh630`, `gh425`, `gh649`, `gh273`). A guard exists so a site reddens BY
 * ITSELF; repairing six by hand leaves the seventh, written tomorrow, invisible.
 *
 * It takes two steps rather than one pattern: the names given a `.length`, then the assertions
 * made about those names. The site is keyed by the assertion, as the other three are.
 *
 * AND PROSE IS NOT A SITE. This module's own comment carries an example of the shape, and the
 * census read it as a seventh site — measured. Comment lines are dropped before anything is
 * matched, which the three original shapes needed as much as this one.
 */
const LENGTH_TO_NAME = /(?:const|let|var)\s+(\w+)\s*=\s*[^;\n]*\.length\s*[;\n]/g;
const NAME_COMPARED = /expect\(\s*(\w+)\s*\)\s*\.(?:toBe|toEqual|toStrictEqual)\(\s*[1-9]\d*\s*\)/g;

/** Every site in one source, keyed by file and the assertion's own text. */
function claimsIn(rel, source) {
    const src = String(source)
        .replace(/\/\*[\s\S]*?\*\//g, '')
        .replace(/^\s*(?:\/\/|\*|#).*$/gm, '');
    const out = [];
    const seen = {};
    SHAPES.forEach((re) => {
        re.lastIndex = 0;
        let m;
        while ((m = re.exec(src)) !== null) {
            const text = m[0].replace(/\s+/g, ' ').trim();
            seen[text] = (seen[text] || 0) + 1;
            out.push(rel + ' | ' + text + ' #' + seen[text]);
        }
    });

    // The fourth shape: a name that was given a length, and a number compared with that name.
    const named = new Set();
    LENGTH_TO_NAME.lastIndex = 0;
    let v;
    while ((v = LENGTH_TO_NAME.exec(src)) !== null) named.add(v[1]);
    NAME_COMPARED.lastIndex = 0;
    let u;
    while ((u = NAME_COMPARED.exec(src)) !== null) {
        if (!named.has(u[1])) continue;
        const text = u[0].replace(/\s+/g, ' ').trim();
        seen[text] = (seen[text] || 0) + 1;
        out.push(rel + ' | ' + text + ' #' + seen[text]);
    }

    return out;
}

function walk(dir, keep, acc) {
    if (!fs.existsSync(dir)) return acc;
    fs.readdirSync(dir, { withFileTypes: true }).forEach((e) => {
        const p = path.join(dir, e.name);
        if (e.isDirectory()) {
            if (e.name === 'node_modules' || e.name === 'fixtures') return;
            walk(p, keep, acc);
        } else if (keep(e.name)) acc.push(p);
    });
    return acc;
}

/** The universe: the project's own tests, JavaScript and PHP. */
/**
 * GH-747, the analyst's third kind — `members-asserted`, AND IT CANNOT BE DECLARED, ONLY HAD.
 *
 * Beside the count stand assertions about EVERY member by index, 0..n-1, on the same receiver:
 * `assertCount(1, $lines)` and then `…($lines[0])`. The count together with those assertions IS a
 * list comparison — "exactly these members" — so no entry in the ratchet is wanted for it.
 *
 * A bare count cannot slip through as this kind, because nothing about it is written down: lose
 * one of the per-index assertions and the site is a bare count again, undeclared, and red. Her
 * boundary, kept in her words: this sees that every member is named in an assertion, it does not
 * judge how strong the assertion is — `assertNotNull($lines[0])` counts too.
 */
const RECEIVER_OF = [
    /expect\(\s*([A-Za-z_$][\w$.\[\]'"]*?)\.length\s*\)\s*\.(?:toBe|toEqual|toStrictEqual)\(\s*(\d+)\s*\)/,
    /expect\(\s*([A-Za-z_$][\w$.\[\]'"]*?)\s*\)\s*\.toHaveLength\(\s*([1-9]\d*)\s*\)/,
    // The hyphen goes LAST on purpose: written as `'"->` it was a RANGE from `"` to `>`, which
    // swallowed `)` and `;` and made the receiver `$lines);` — measured, and it cost the whole
    // PHP side of this kind.
    /assertCount\(\s*(\d+)\s*,\s*(\$[\w$\[\]'">-]*)/,
];

/** `<receiver>` and `n` for one site's text, or null when the shape carries neither plainly. */
function receiverAndCount(text) {
    let m = RECEIVER_OF[0].exec(text) || RECEIVER_OF[1].exec(text);
    if (m) return { receiver: m[1], n: Number(m[2]) };
    m = RECEIVER_OF[2].exec(text);
    if (m) return { receiver: m[2], n: Number(m[1]) };

    return null;
}

/**
 * GH-747 — THE FORMS OF ACCESS THE INFERENCE CAN SEE, AS A TABLE RATHER THAN AS A SENTENCE.
 *
 * A member can be named in more ways than anyone lists in advance: by position, by key, by a key
 * held in a loop variable, as a substring of a joined list. Three times in one hour the coverage
 * turned out to be narrower than the prose beside it said. So the forms are not described, they
 * ARE this table: the inference walks it, and the guard prints it with the count each form found.
 * A form that is added is added here, and therefore appears in the output of the next run; a form
 * that is not here is not seen, and the printed list says so without anyone remembering to.
 */
const MEMBER_FORMS = {
    index: {
        says: 'index — rows[0] .. rows[n-1], every member named by its position',
        finds: (window, esc, n) => {
            for (let i = 0; i < n; i++) {
                if (!new RegExp('(?:expect|assert\\w*)\\([^;\\n]*' + esc + '\\s*\\[\\s*' + i + '\\s*\\]')
                    .test(window)) return false;
            }

            return n > 0;
        },
    },
    'loop-key': {
        says: 'loop-key — rows[$k] inside a loop whose literal list has exactly n members',
        finds: (window, esc, n) => {
            const byVar = new RegExp('(?:expect|assert\\w*)\\([^;\\n]*' + esc + '\\s*\\[\\s*(\\$?[A-Za-z_]\\w*)\\s*\\]', 'g');
            let m;
            while ((m = byVar.exec(window)) !== null) {
                const v = m[1].replace(/^\$/, '');
                // The loop that binds that variable, and the literal list it walks. Both PHP's
                // `foreach ([..] as $v => $x)` / `as $x => $v` and JS's `[..].forEach((v)` count.
                const loop = new RegExp('(?:foreach|for)\\s*\\(\\s*\\[([\\s\\S]*?)\\]\\s*as\\s*[^)]*\\$' + v
                    + '\\b|\\[([\\s\\S]*?)\\]\\s*\\.\\s*forEach\\s*\\(\\s*(?:function\\s*)?\\(?\\s*' + v + '\\b');
                const hit = loop.exec(window);
                if (!hit) continue;
                const body = hit[1] !== undefined ? hit[1] : hit[2];
                // Members of the literal, counted at its own level: nothing can come from outside it.
                let depth = 0;
                let members = body.trim() ? 1 : 0;
                for (const ch of body) {
                    if ('([{'.includes(ch)) depth++;
                    else if (')]}'.includes(ch)) depth--;
                    else if (ch === ',' && depth === 0) members++;
                }
                if (members === n) return true;
            }

            return false;
        },
    },
    joined: {
        says: 'joined — n is 1 and the single member is named as a substring of the joined list',
        finds: (window, esc, n) => {
            /**
             * GH-747, the analyst's limit and her reason for it: n substrings asserted against a
             * join of n members do NOT say which member carries which — one member can carry both,
             * and then the count is a count again. So this form counts only at n = 1. A NEGATIVE
             * assertion (`assertStringNotContainsString`, `not.toContain`) never counts: saying
             * what is absent names no member.
             */
            if (n !== 1) return false;
            const joins = new RegExp('(?:implode|join)\\s*\\([^;\\n]*' + esc);
            if (!joins.test(window)) return false;

            return /assertStringContainsString\s*\(/.test(window)
                || /(?<!not\s*\.\s*)\btoContain\s*\(/.test(window.replace(/\.not\s*\./g, '.NOT.'));
        },
    },
    'closed-literal': {
        says: 'closed-literal — the receiver is a LITERAL list put through a filter, and n is its own length',
        finds: (window, esc, n) => {
            /**
             * GH-747 — THE ONE FORM THAT NEEDS NO MEASUREMENT, and that is why it was taken without
             * one. When the receiver is `[a, b, c].filter(...)`, a length equal to the literal's own
             * length means every member of the literal passed the filter. Nothing can arrive from
             * outside a literal, so losing one member and gaining another is not a state that
             * exists: the count IS the list comparison, by construction rather than by inference.
             * A length SMALLER than the literal's would say only how many passed, and does not
             * count here.
             */
            const decl = new RegExp('(?:const|let|var|\\$)?\\s*' + esc
                + '\\s*=\\s*\\[([\\s\\S]*?)\\]\\s*(?:\\n\\s*)?\\.\\s*filter\\s*\\(');
            const hit = decl.exec(window);
            if (!hit) return false;
            let depth = 0;
            let members = hit[1].trim() ? 1 : 0;
            for (const ch of hit[1]) {
                if ('([{'.includes(ch)) depth++;
                else if (')]}'.includes(ch)) depth--;
                else if (ch === ',' && depth === 0) members++;
            }

            return members === n;
        },
    },
    key: {
        says: "key — rows['a'] .., n DISTINCT keys asserted on the same receiver",
        finds: (window, esc, n) => {
            const keys = new Set();
            const byKey = new RegExp('(?:expect|assert\\w*)\\([^;\\n]*' + esc + '\\s*\\[\\s*[\'"]([^\'"]+)[\'"]\\s*\\]', 'g');
            let m;
            while ((m = byKey.exec(window)) !== null) keys.add(m[1]);

            return keys.size === n;
        },
    },
};

/**
 * The sites in one source whose members are each asserted beside the count, with the FORM that
 * found each one: `[{ claim, form }]`.
 */
function membersAssertedIn(rel, source) {
    const src = String(source)
        .replace(/\/\*[\s\S]*?\*\//g, '')
        .replace(/^\s*(?:\/\/|\*|#).*$/gm, '');
    /**
     * THE ASSERTIONS ARE LOOKED FOR IN THE SITE'S OWN CASE, not anywhere in the file — measured,
     * and the first version got this wrong. A file with two `assertCount(1, $lines)` in different
     * cases kept the kind after one of the per-index assertions was deleted, because the other
     * case still had `$lines[0]` somewhere in the same file. The window is the enclosing case.
     */
    const bounds = [];
    const CASE_START = /(?:^|\n)\s*(?:it|test)\s*\(|(?:^|\n)\s*(?:public\s+)?function\s+test\w*\s*\(/g;
    let c;
    while ((c = CASE_START.exec(src)) !== null) bounds.push(c.index);
    const caseAround = (at) => {
        let from = 0;
        for (const b of bounds) { if (b <= at) from = b; else break; }
        const next = bounds.find((b) => b > at);

        return src.slice(from, next === undefined ? src.length : next);
    };

    const out = [];
    const seen = {};
    claimsIn(rel, source).forEach((key) => {
        const text = key.slice(key.indexOf(' | ') + 3).replace(/ #\d+$/, '');
        seen[text] = (seen[text] || 0) + 1;
        const rc = receiverAndCount(text);
        if (!rc || !rc.n || rc.n > 24) return;
        const esc = rc.receiver.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
        // The nth occurrence of this very text, so two identical counts in one file are told apart.
        let at = -1;
        for (let k = 0; k < seen[text]; k++) at = src.indexOf(text, at + 1);
        if (at < 0) return;
        const window = caseAround(at);
        /**
         * GH-747, the analyst's measurement of the `key` form before it was accepted: over 22 sites
         * it fired once (`Gh541`, three keys at n=3) and never falsely, with partial sets correctly
         * not counted (`Gh571` 4 of 14, `Gh667` 1 of 17). ITS BOUNDARY, hers: a key asserted to be
         * ABSENT (`assertNull($x['k'])`) would count as a member. There is no such site today, and
         * the form rests on that measurement rather than on a proof. The rule is the same one the
         * index form uses, not a looser one: a partial set is still a bare count, and still red.
         */
        const form = Object.keys(MEMBER_FORMS).find((f) => MEMBER_FORMS[f].finds(window, esc, rc.n));
        if (form) out.push({ claim: key, form });
    });

    return out;
}

function lengthClaims() {
    const files = walk(path.join(ROOT, 'tests'), (n) => n.endsWith('.test.js'), [])
        .concat(walk(path.join(ROOT, 'app', 'tests'), (n) => n.endsWith('.php'), []));
    const claims = [];
    const membersAsserted = [];
    const byForm = {};
    const provenForm = {};
    Object.keys(MEMBER_FORMS).forEach((f) => { byForm[f] = []; });
    files.forEach((f) => {
        const rel = path.relative(ROOT, f).split(path.sep).join('/');
        const src = fs.readFileSync(f, 'utf8');
        claimsIn(rel, src).forEach((c) => claims.push(c));
        membersAssertedIn(rel, src).forEach((c) => {
            membersAsserted.push(c.claim);
            byForm[c.form].push(c.claim);
            provenForm[c.claim] = c.form;
        });
    });

    return {
        claims: claims.sort(),
        membersAsserted: membersAsserted.sort(),
        provenForm,
        memberForms: Object.keys(MEMBER_FORMS).map((f) => ({ form: f, says: MEMBER_FORMS[f].says, found: byForm[f].length })),
        filesScanned: files.length,
    };
}

module.exports = { lengthClaims, claimsIn, membersAssertedIn, MEMBER_FORMS };

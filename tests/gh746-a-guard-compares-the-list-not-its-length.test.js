/**
 * GH-746 — A GUARD COMPARES THE LIST, NOT ITS LENGTH, AND EVERY LENGTH IT DOES COMPARE IS DECLARED.
 *
 * "The list is compared, not its length" was a rule filled by the attention of whoever wrote the
 * test, and it failed the way such rules fail: overnight a boundary moved from 193 to 192 and no
 * output could say which global had gone. This makes the rule a mechanism. Every place a test
 * compares a length with a number (`tests/lib/length-claims.js`) is held against
 * `tests/fixtures/gh746-length-claims.json`, both ways and by list:
 *   - a new site is red until it is declared — `multiplicity` when the members are indistinguishable
 *     and the number is the claim (a request sent once), `pending-list` when they are not and the
 *     assertion is to be rewritten to compare the list;
 *   - a declared site that is gone is red too, so the file cannot keep an excuse for code that no
 *     longer exists, and a rewritten assertion takes its entry with it.
 * The sites found on the day the census was written are recorded as `unclassified`: that state may
 * shrink and may not grow. THAT LAST SENTENCE USED TO BE THE WHOLE MECHANISM (GH-747): a new site
 * planted in the tree and declared `unclassified` passed green, so the one property this guard was
 * built to have was held by a line of prose - the very class it exists against. `unclassifiedCeiling`
 * is that property as data: it is EQUAL to the remainder, so a site outside it cannot be declared
 * unclassified. That closes both directions - nothing new enters the kind, and nothing already
 * judged walks back into it - and the guard prints the site's name, not a count of them.
 *
 * WHAT IT DOES NOT SEE — the module's own boundary: a floor (`toBeGreaterThan`), which proves reach
 * and not membership; `toHaveLength(0)`; a count that is only printed.
 *
 * A COUNT CARRIED THROUGH A VARIABLE USED TO BE ON THAT LIST AND IS NOT ANY MORE (GH-747). It was
 * named a boundary and measured as a hole: six real sites were written that way, and they were
 * written that way by habit rather than to evade anything. A guard is for sites that redden by
 * themselves, so the shape joined the census instead of the six being repaired by hand.
 */

'use strict';

const fs = require('fs');
const path = require('path');
const { lengthClaims, claimsIn } = require('./lib/length-claims');
const RECORDED = require('./fixtures/gh746-length-claims.json');

/**
 * GH-761 (queue item 3vd) — THE CEILING LIVES HERE, NOT IN THE FILE IT GOVERNS.
 *
 * It used to sit in the fixture beside the claims it limits, and the reviewer of GH-747 named the
 * hole that leaves: a name written into BOTH halves in one edit is indistinguishable from the
 * file's original state, because a file has no memory of itself. Measured before this moved: adding
 * one site to `claims` as `unclassified` AND to `unclassifiedCeiling` in the same edit passed green,
 * 6 of 6.
 *
 * WHY THERE IS NO FIX INSIDE THE FIXTURE, said rather than left: whatever is added there — a count,
 * a hash, a second list — is edited by the same hand in the same act as the thing it guards. The
 * opora has to be a file that changes for a DIFFERENT reason. The fixture changes whenever a site
 * is judged, which is many times a night; this file changes when the DEVICE changes, which is rare
 * and is read in review. So the ceiling is a constant here, and the fixture may not carry one.
 *
 * IT IS EMPTY, and that is the end state of GH-747: every site has been judged, so the kind
 * `unclassified` is unreachable. Restoring the kind means editing THIS file, and that edit is a
 * change to the device — which is exactly what should be argued for rather than slipped in.
 */
/**
 * GH-761 (the reviewer's return) — THE CEILING HOLDS HASHES, NOT THE KEYS THEMSELVES.
 *
 * A claim's key carries the TEXT of its assertion, and this census scans every test file —
 * including this one. Measured by the reviewer: put one real key in the ceiling, touch nothing
 * else, and the run reddens about THIS FILE, naming `assertCount(5, $all->json('data')); #1` as a
 * site of its own. The file already knew that trap for its own literals — `const LEN = '.len' +
 * 'gth'` — and the ceiling arrived without the same care. Today it is empty, so it is green; on
 * the day it is used, the guard would accuse itself, and the obvious repair (declare the phantom
 * site) would corrupt the census.
 *
 * A HASH, not a split literal: splitting would work for the three shapes the census knows today
 * and break again on a shape it learns tomorrow, because the text would still be there in pieces.
 * A digest carries no assertion text at all, so no census can mistake it for a site — and the NAME
 * a failure prints still comes from the fixture, where it belongs.
 */
const keyDigest = (claim) => require('crypto').createHash('sha1').update(claim).digest('hex').slice(0, 16);
const UNCLASSIFIED_CEILING = [];

// Written in pieces so this file does not become a site of its own census.
const LEN = '.len' + 'gth';
const HAVE = '.toHave' + 'Length';

describe('GH-746 — every length a test compares with a number is declared, and a new one reddens', () => {
    const now = lengthClaims();

    test('positive control: the three shapes are found, and a floor or an empty list is not', () => {
        const js = [
            'expect(names' + LEN + ').toBe(3);',
            'expect(rows)' + HAVE + '(2);',
            'expect(rows)' + HAVE + '(0);',
            'expect(files' + LEN + ').toBeGreaterThan(50);',
        ].join('\n');
        const php = '$this->assert' + 'Count(4, $lines);';
        const found = claimsIn('planted.test.js', js).concat(claimsIn('Planted.php', php));
        process.stdout.write('[gh746] planted: ' + JSON.stringify(found) + '\n');
        expect(found).toEqual([
            'planted.test.js | expect(names' + LEN + ').toBe(3) #1',
            'planted.test.js | expect(rows)' + HAVE + '(2) #1',
            'Planted.php | assert' + 'Count(4, $lines); #1',
        ]);
    });

    test('the census reaches the tree', () => {
        process.stdout.write('[gh746] files scanned ' + now.filesScanned + ', length claims ' + now.claims.length + '\n');
        expect(now.filesScanned).toBeGreaterThan(400);
        expect(now.claims.length).toBeGreaterThan(100);
    });

    test('what the tests compare by length is exactly what is declared, both ways', () => {
        /**
         * GH-747 — `members-asserted` IS INFERRED, NEVER DECLARED, and that is the whole point of
         * the kind (the analyst's): beside the count stand assertions about every member by index,
         * 0..n-1, on the same receiver, so the count together with them already IS a list
         * comparison. Such a site needs no entry — and cannot be given one, which is why nothing
         * bare can slip through wearing this kind. Lose one per-index assertion and the site is a
         * bare count again, undeclared, and red.
         */
        const inferred = new Set(now.membersAsserted);
        const listed = Object.keys(RECORDED.claims);
        const unlisted = now.claims.filter((c) => !(c in RECORDED.claims) && !inferred.has(c));
        const gone = listed.filter((c) => !now.claims.includes(c));
        const declaredButInferred = listed.filter((c) => inferred.has(c));
        process.stdout.write('[gh746] members-asserted, inferred and not declared: ' + inferred.size + '\n');
        declaredButInferred.forEach((c) => process.stdout.write('[gh746]    DECLARED BUT INFERRED: ' + c + '\n'));
        expect({ declaredButInferred }).toEqual({ declaredButInferred: [] });
        unlisted.forEach((c) => process.stdout.write('[gh746]    NOT DECLARED: ' + c + '\n'));
        gone.forEach((c) => process.stdout.write('[gh746]    DECLARED, GONE: ' + c + '\n'));
        expect({ unlisted, gone }).toEqual({ unlisted: [], gone: [] });
    });

    test('the forms of access the inference can see are PRINTED, with what each one found', () => {
        /**
         * GH-747 — WHAT THIS GUARD CAN SEE IS PART OF WHAT IT SAYS.
         *
         * `members-asserted` is inferred, and an inference has a reach. That reach is a list of
         * FORMS a member can be named by, and the list is not knowable in advance: position, key,
         * a key held in a loop variable, a substring of a joined list. Three times in one hour the
         * reach turned out to be narrower than the words beside it — which is the same failure the
         * ratchet had, a property held by prose.
         *
         * So the forms come from the table the inference itself walks (`MEMBER_FORMS`), and are
         * printed with the count each one found. A form added to the inference appears here by
         * construction; a count of 0 beside a form says it is carried and never fires, which is
         * information too. The assertion is made on WHAT WAS PRINTED, not on the table, because an
         * assertion about the table would pass with the printing deleted.
         */
        const printed = '[gh746] member-access forms this inference can see, and what each found:\n'
            + now.memberForms.map((f) => '[gh746]    ' + f.says + ' -> ' + f.found + ' sites\n').join('')
            + '[gh746] a member named in any other way is NOT seen, and its site stays a bare count.\n'
            /**
             * GH-747, THE ANALYST'S ADDITION, and it is stronger than printing the table alone:
             * EVERY inferred site prints the form that proved it. A table printed on its own could
             * be narrowed in the code without the output narrowing with it; a form printed beside
             * each site cannot — the site would lose its line.
             */
            + '[gh746] and the form each inferred site is proven by:\n'
            + now.membersAsserted.map((c) => '[gh746]    ' + (now.provenForm[c] || 'UNKNOWN') + ' | ' + c + '\n').join('');
        process.stdout.write(printed);

        expect(now.memberForms.length).toBeGreaterThan(0);
        // Every form the inference walks has to reach the output, or the reach is hidden again.
        now.memberForms.forEach((f) => expect(printed).toContain(f.says));
        expect(printed).toContain('is NOT seen');
        // And no site is inferred without the output saying by WHICH form.
        now.membersAsserted.forEach((c) => {
            expect(now.provenForm[c]).toBeTruthy();
            expect(printed).toContain(now.provenForm[c] + ' | ' + c);
        });
        // And the printed counts add up to the inference's own total, so a form cannot be printed
        // with a number that came from somewhere else.
        expect(now.memberForms.reduce((a, f) => a + f.found, 0)).toBe(now.membersAsserted.length);
    });

    test('the `unclassified` state may only shrink, and it cannot be walked back either', () => {
        /**
         * GH-747 — THE RATCHET, AND IT HOLDS BOTH WAYS.
         *
         * The first version froze the list of unclassified sites on the day it was written and
         * asked only that nothing NEW enter the kind. Measured, that left the other side open: a
         * site already judged, put back to `unclassified`, passed green — and the frozen list
         * weakened itself as the work went on, since every site judged left one more name in it
         * with nothing to match.
         *
         * So the ceiling is not a memory of a past day, it is EQUAL to the remainder as it stands.
         * A site outside it cannot be unclassified, which closes both directions at once: a new
         * site has no way in, and a judged one has no way back. Judging a site therefore narrows
         * the ceiling in the same edit; a name left behind in it reddens, by name.
         *
         * WHEN THE CEILING IS EMPTY the kind is unreachable — the strongest state this can be in,
         * not the weakest, and that is what the end of this work looks like.
         *
         * ITS BOUNDARY, said rather than left to be found: a name written into BOTH the ceiling and
         * the claims in one edit is not caught. No guard living inside the file it guards can tell
         * that edit from the file's original state. What this closes is the silent walk-back, not a
         * deliberate one.
         */
        const kindOfDeclared = (v) => (Array.isArray(v) ? v[0] : v);
        const ceiling = UNCLASSIFIED_CEILING;
        const inCeiling = (claim) => ceiling.includes(keyDigest(claim));
        // And the fixture may not carry a ceiling of its own: a second one there would be the hole
        // this moved out of, wearing the same name.
        expect(RECORDED.unclassifiedCeiling).toBeUndefined();
        const unclassifiedNow = Object.entries(RECORDED.claims)
            .filter(([, v]) => kindOfDeclared(v) === 'unclassified').map(([c]) => c);
        const enteredWithoutAPlace = unclassifiedNow.filter((c) => !inCeiling(c));
        const leftBehindInTheCeiling = ceiling.filter((h) => !unclassifiedNow.some((c) => keyDigest(c) === h));
        process.stdout.write('[gh746] ratchet: ' + unclassifiedNow.length + ' sites still unclassified, '
            + 'ceiling ' + ceiling.length + '; an empty ceiling makes the kind unreachable\n');
        /**
         * GH-760: the red carries an address. A claim's key is `<file> | <assertion text> #n`, and
         * the line is where that text sits in that file — found here rather than stored, because a
         * stored line would go stale on the next edit of the file it points into.
         */
        const addressOf = (claim) => {
            const rel = claim.split(' | ')[0];
            const text = claim.slice(claim.indexOf(' | ') + 3).replace(/ #\d+$/, '');
            try {
                const src = fs.readFileSync(path.join(__dirname, '..', rel), 'utf8');
                const at = src.indexOf(text);

                return at < 0 ? rel : rel + ':' + src.slice(0, at).split('\n').length;
            } catch (e) {
                return rel;
            }
        };
        enteredWithoutAPlace.forEach((c) => process.stdout.write('[gh746]    UNCLASSIFIED WITH NO PLACE IN THE CEILING: '
            + addressOf(c) + '   ' + c + '\n'));
        leftBehindInTheCeiling.forEach((c) => process.stdout.write('[gh746]    JUDGED BUT LEFT IN THE CEILING: ' + c + '\n'));

        expect({
            enteredWithoutAPlace: enteredWithoutAPlace.map((c) => addressOf(c) + '   ' + c),
            leftBehindInTheCeiling,
        }).toEqual({ enteredWithoutAPlace: [], leftBehindInTheCeiling: [] });
    });

    test('every declared site has a known kind, and the ones still to be judged are printed by name', () => {
        // A `multiplicity` entry is `["multiplicity", "why the number is the claim"]`: without the
        // reason it is a mark, not a declaration.
        const kindOf = (v) => (Array.isArray(v) ? v[0] : v);
        const byKind = {};
        Object.entries(RECORDED.claims).forEach(([c, v]) => { const k = kindOf(v); (byKind[k] = byKind[k] || []).push(c); });
        Object.keys(byKind).sort().forEach((k) => {
            process.stdout.write('[gh746] ' + k + ':\n');
            byKind[k].forEach((c) => process.stdout.write('[gh746]    ' + c + '\n'));
        });
        const unknownKind = Object.entries(RECORDED.claims).filter(([, v]) => !RECORDED.kinds.includes(kindOf(v))).map(([c]) => c);
        const noReason = Object.entries(RECORDED.claims)
            .filter(([, v]) => kindOf(v) === 'multiplicity' && !(Array.isArray(v) && typeof v[1] === 'string' && v[1].trim()))
            .map(([c]) => c);
        expect({ unknownKind, noReason }).toEqual({ unknownKind: [], noReason: [] });
    });
});

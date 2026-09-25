/**
 * GH-669 (queue item 3ap) — THE CHANGELOG IS IN ORDER, AND SOMETHING OTHER THAN
 * THE WRITER'S MEMORY SAYS SO.
 *
 * WHY A GUARD AND NOT A RULE. The rule — a new entry goes at the END of the
 * section, before `## Backlog`, by ascending number — had been stated and was
 * broken a second time: `GH-604…GH-663` stood in DESCENDING order, `GH-443…445`
 * were reversed, and `GH-461` had lost the start of its own line — `H-461` with no
 * `**G` — which put it after `GH-466`. Both times the owner found it, and both
 * times just before a commit. By this team's own test — ask what fills a rule; if
 * it is the writer's memory, it is an appeal — it was not a rule at all.
 *
 * THE UNIVERSE IS THE FILE, never a list of numbers written here: such a list
 * would be stale the day the next entry lands.
 *
 * AND THE LISTS ARE COMPARED, NOT THEIR LENGTHS. That is what catches the broken
 * start: `H-461**` is not an entry to a strict anchor and IS one to a tolerant
 * one, so the two readings disagree by that line — while a count could stay right
 * if one entry vanished and another appeared. The same reasoning as the reviewer's
 * on the census that measured files by their number.
 *
 * WHAT IS ASSERTED AS ORDER, measured before it was chosen: the numbers are
 * NON-DECREASING, not strictly ascending, because four numbers legitimately appear
 * twice today — GH-59, GH-144, GH-174 and GH-241, each as two adjacent entries.
 * Demanding strict ascent would make this red on the day it was written, over
 * history nobody is going to renumber. The duplicates are PRINTED, so they are a
 * named fact rather than a silence.
 */

'use strict';

const fs = require('fs');
const path = require('path');

const FILE = path.join(__dirname, '..', 'docs', 'instructions.md');
const TEXT = fs.readFileSync(FILE, 'utf8');

/**
 * The changelog's own section, BETWEEN ITS TWO HEADINGS.
 *
 * Both boundaries are needed and the lower one was found by a mutation that failed
 * to apply. Reading from the start of the file swept in the client correspondence
 * above `## Change log`, where lines begin `GH-193`, `GH-202` and even
 * `GH-258 - GH-324` — a range, not an entry — and the last of those made the
 * numbers appear to go backwards at the first real entry, `GH-1`.
 */
function changelogSection() {
    const from = TEXT.indexOf('\n## Change log');
    /**
     * THE END IS AN EXACT HEADING LINE, and it had to become one because an ENTRY'S OWN
     * PROSE mentions `## Backlog` — this guard's entry says the rule is "at the end of
     * the section, before `## Backlog`". `indexOf('\n## Backlog')` stopped at that
     * mention, so the section ended in the middle of an entry and everything after it
     * was outside every claim below. It was worse than a shortened universe: a writer
     * appending before the first literal occurrence SPLIT that entry in two, its tail
     * left standing at the start of a line looking exactly like the heading. Which is
     * what happened, and the tail carried seven `**GH-NNN**` mentions the glued-entry
     * claim never saw. The heading is now a whole line and nothing else.
     */
    const to = TEXT.search(/\n## Backlog[ \t]*\n/);
    // Positive control on both boundaries: a file that lost either heading would
    // otherwise be read over the wrong text and every claim below would be about it.
    expect(from).toBeGreaterThan(-1);
    expect(to).toBeGreaterThan(from);

    return TEXT.slice(from, to);
}

const SECTION = changelogSection();

/**
 * An entry, and the anchor is the START OF THE BOLD rather than the closing
 * asterisks — found by a mutation that would not apply. `**GH-461**` does not
 * exist in this file: that entry is written `**GH-461 (PLAN-GH439 section 10 …)**`,
 * with the number inside the bold, and so are fifty more. An anchor requiring `**`
 * straight after the number walked past FIFTY-ONE entries while reporting 582 of
 * them, and the very slip this guard exists for — a lost `**G` on the GH-461 line
 * — was invisible to it.
 *
 * A LETTER SUFFIX IS PART OF A NUMBER HERE: `**GH-135a**` is an entry, and `\d+\b`
 * could not see it, because there is no word boundary between `5` and `a`. Found by
 * the wider reading below the moment it was widened — one line, and a real entry.
 */
const STRICT = /^(?:\*\*)?GH-(\d+)[a-z]?\b/gm;
/**
 * THE SAME LINES, READ WITHOUT THE CONVENTION — and the shape of this is the
 * reviewer's finding, not a widening for its own sake.
 *
 * It used to be `/^\**G?H-(\d+)\b/`, which differs from the strict reading by ONE
 * SPELLING: an optional `G`. Two readings that differ by one letter prove only that
 * letter — they are two surfaces of ours drifting together (GH-409), and the proof
 * was on the record: the printed count moved from 629 to 628 while the verdict
 * stayed green.
 *
 * So this one is not a spelling at all: it asks whether the FIRST NON-PUNCTUATION
 * TOKEN of the line is a GH number, tolerating leading asterisks, hashes, hyphens
 * and spaces. A line the convention cannot parse but a person would read as an
 * entry — `H-461`, `# GH-461`, `- GH-461` — is found by this and not by the strict
 * reading, and the comparison of the two LISTS is what names it.
 */
const TOLERANT_PREFIX = /^[*#\-\s]+/;
const TOLERANT_TOKEN = /^G?H-(\d+)[a-z]?\b/;

const match = (re) => {
    const out = [];
    let m;
    re.lastIndex = 0;
    while ((m = re.exec(SECTION)) !== null) {
        out.push({ number: Number(m[1]), line: SECTION.slice(0, m.index).split('\n').length, text: m[0] });
    }

    return out;
};

/** The tolerant reading, line by line, because it is about a line's first token. */
const tolerantEntries = () => {
    const out = [];
    SECTION.split('\n').forEach((line, i) => {
        const token = line.replace(TOLERANT_PREFIX, '');
        const m = TOLERANT_TOKEN.exec(token);
        if (m) out.push({ number: Number(m[1]), line: i + 1, text: token.slice(0, 24) });
    });

    return out;
};

describe('GH-669 — the changelog keeps its own order', () => {
    const strict = match(STRICT);
    const tolerant = tolerantEntries();

    test('POSITIVE CONTROL: the section was found and it really holds the entries', () => {
        process.stdout.write('\n[gh669] entries by the convention: ' + strict.length
            + ' | by the tolerant reading: ' + tolerant.length
            + ' | first ' + (strict[0] || {}).number + ', last ' + (strict[strict.length - 1] || {}).number + '\n');
        // A floor well under the real size rather than a pin on it: this must not
        // go red because somebody added an entry.
        expect(strict.length).toBeGreaterThan(600);
    });

    test('every entry the tolerant reading finds is also a proper entry — the broken start', () => {
        // THE LISTS, NOT THEIR LENGTHS. `GH-461` once stood as `H-461**`: a count
        // of entries was right and the entry was invisible to every reading that
        // anchors on the convention, including this file's own order check.
        const strictAt = new Set(strict.map((e) => e.line));
        const stragglers = tolerant.filter((e) => !strictAt.has(e.line))
            .map((e) => 'line ' + e.line + ': ' + JSON.stringify(e.text));
        process.stdout.write('[gh669] lines that look like an entry but are not written as one: '
            + JSON.stringify(stragglers) + '\n');

        expect({ entriesWithABrokenStart: stragglers }).toEqual({ entriesWithABrokenStart: [] });
    });

    test('the tolerant reading is WIDER than the strict one — a relation between lists, declared', () => {
        // GH-706 — THE CASE ABOVE LOOKS ONE WAY ONLY, AND IT WAS BLIND IN THE OTHER. It asks
        // what the tolerant reading finds beyond the strict one. Narrow the tolerant reading
        // below the strict one and it finds LESS, the list of stragglers shrinks, and every
        // case stays green: measured, a prefix without `*` left the tolerant reading with 0
        // entries against 663 and all six cases passed. Earlier the same thing happened by
        // hand, when a widening inside the expression turned thirteen places into seven with
        // no decision recorded.
        //
        // So "wider" is asserted as what it is, a relation: (a) every line the strict reading
        // takes is taken by the tolerant one too; (b) the broken starts the tolerant reading
        // exists for are found by it and not by the strict one, checked on declared samples
        // because the file holds none of them today.
        const tolerantAt = new Set(tolerant.map((e) => e.line));
        const missedByTolerant = strict.filter((e) => !tolerantAt.has(e.line))
            .map((e) => 'line ' + e.line + ': ' + JSON.stringify(e.text));
        process.stdout.write('[gh669] proper entries the tolerant reading does not take: '
            + JSON.stringify(missedByTolerant.slice(0, 5)) + (missedByTolerant.length > 5 ? ' …' : '') + '\n');
        expect({ strictEntriesTheTolerantReadingMisses: missedByTolerant })
            .toEqual({ strictEntriesTheTolerantReadingMisses: [] });

        const BROKEN_STARTS = ['H-461** (a lost G)', '# GH-461 (a heading)', '- GH-461 (a list item)'];
        const readTolerant = (line) => TOLERANT_TOKEN.test(line.replace(TOLERANT_PREFIX, ''));
        const readStrict = (line) => new RegExp(STRICT.source).test(line);
        const verdicts = BROKEN_STARTS.map((l) => ({ line: l, tolerant: readTolerant(l), strict: readStrict(l) }));
        process.stdout.write('[gh669] declared broken starts: ' + JSON.stringify(verdicts) + '\n');
        expect(verdicts.map((v) => [v.tolerant, v.strict])).toEqual(BROKEN_STARTS.map(() => [true, false]));
    });

    test('the numbers never go backwards', () => {
        const backwards = [];
        for (let i = 1; i < strict.length; i++) {
            if (strict[i].number < strict[i - 1].number) {
                backwards.push('line ' + strict[i].line + ': GH-' + strict[i].number
                    + ' after GH-' + strict[i - 1].number + ' (line ' + strict[i - 1].line + ')');
            }
        }
        process.stdout.write('[gh669] entries out of order: ' + JSON.stringify(backwards) + '\n');

        expect({ entriesOutOfOrder: backwards }).toEqual({ entriesOutOfOrder: [] });
    });

    test('and the numbers that appear twice are named rather than passed over', () => {
        // Measured, not assumed: the order is NON-DECREASING today because four
        // numbers carry two entries each. They are printed so that "no violations"
        // cannot be read as "no duplicates", and not asserted as a fixed list,
        // which would age the moment history is tidied.
        const seen = {};
        const twice = [];
        strict.forEach((e) => {
            if (seen[e.number] !== undefined) twice.push('GH-' + e.number
                + ' (lines ' + seen[e.number] + ' and ' + e.line + ')');
            else seen[e.number] = e.line;
        });
        process.stdout.write('[gh669] numbers carrying more than one entry: ' + JSON.stringify(twice) + '\n');
        expect(Array.isArray(twice)).toBe(true);
    });

    test('no entry has lost its line break — an entry glued to another is invisible to both readings', () => {
        // FOUND BY LOSING AN ENTRY AND THEN FINDING IT, and it is a hole in this
        // guard rather than in the file. `**GH-670**` was written, then appeared to
        // be missing: it had been GLUED to the end of the `GH-669` line with no
        // break. Both readings above are anchored to the start of a line, so neither
        // could see it — the list was complete and ascending and an entry was
        // nowhere in it. The reviewer's point about two surfaces drifting together
        // applies to their common assumption as much as to their spelling.
        //
        // The universe here is the WHOLE text of the section, not its line starts:
        // every `**GH-NNN**` marker anywhere must also be one at a line start.
        const anywhere = (SECTION.match(/\*\*GH-\d+[a-z]?\*\*/g) || []).length;
        const atLineStart = (SECTION.match(/(?:^|\n)\*\*GH-\d+[a-z]?\*\*/g) || []).length;
        const glued = [];
        const re = /\*\*GH-(\d+[a-z]?)\*\*/g;
        let m;
        /**
         * GLUED MEANS NOTHING BETWEEN, and the first form of this sign did not say so:
         * it flagged EVERY mid-line marker, so an entry that MENTIONS `**GH-461**` in
         * its prose — this one does, seven times — was reported as a glued entry. A
         * mention is preceded by a space or by an opening delimiter; an entry appended
         * to the end of the line before it is preceded by the previous entry's last
         * character, usually the full stop of "0 failed.".
         */
        const GLUED = (before) => before.length && !/[\s`"'([]$/.test(before);
        // And the LINE NUMBER is counted from the start of the FILE, not of the section.
        // It was counted from the section and printed as a file line: the first run
        // after the repair above named line 1090, which is `GH-537` and mentions
        // nothing — a wrong address stated with the confidence of a measured one.
        const linesBeforeSection = TEXT.slice(0, TEXT.indexOf(SECTION)).split('\n').length - 1;
        while ((m = re.exec(SECTION)) !== null) {
            const before = SECTION.slice(0, m.index);
            if (GLUED(before)) {
                glued.push('GH-' + m[1] + ' on line '
                    + (linesBeforeSection + before.split('\n').length)
                    + ', glued after: ' + JSON.stringify(before.slice(-40)));
            }
        }
        // POSITIVE CONTROL ON THE SIGN ITSELF, so that "no glued entries" cannot mean
        // "the sign no longer recognises one". The real case, and the two shapes that
        // are not it.
        expect(GLUED('... Jest 3495 passed, 0 failed.')).toBe(true);
        expect(GLUED('the guard found `')).toBe(false);
        expect(GLUED('a sentence ending in a space ')).toBe(false);
        process.stdout.write('[gh669] `**GH-NNN**` markers anywhere: ' + anywhere
            + ' | at a line start: ' + atLineStart + '\n'
            + '[gh669] entries glued to another line: ' + JSON.stringify(glued) + '\n');

        // Positive control: the markers were found at all.
        expect(anywhere).toBeGreaterThan(400);
        expect({ entriesGluedToAnotherLine: glued }).toEqual({ entriesGluedToAnotherLine: [] });
    });

    test('the last entry before the backlog is the highest number in the file', () => {
        // The rule as the owner states it: a new entry goes at the END. This is the
        // half a person breaks — writing beside a related entry instead of at the
        // bottom — and it is the half the order check above cannot catch on its own,
        // because inserting a LOWER number in the middle keeps everything after it
        // ascending from there.
        const numbers = strict.map((e) => e.number);
        const highest = Math.max(...numbers);
        const last = numbers[numbers.length - 1];
        process.stdout.write('[gh669] last entry: GH-' + last + ' | highest: GH-' + highest + '\n');

        expect({ lastEntry: last }).toEqual({ lastEntry: highest });
    });
});

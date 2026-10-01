'use strict';

/**
 * GH-792 (queue item 79, the reviewer's return) — THE WORDS ARE THE ONES THE OWNER APPROVED, and the universe
 * of places comes from the declaration rather than from a list inside a test.
 *
 * TWO GREEN MUTATIONS BROUGHT THIS FILE. The first delivery proved that a page prints whatever the composer
 * says; it did not prove that the composer says HER words, nor that a place added to the composer is noticed.
 * So the reviewer replaced a sentence and added a twentieth place, and every suite stayed green while the
 * report still said "7 of 7". The item's name is "the words of an empty section, at one composer, APPROVED" --
 * conductivity was held, approval was not. That is the GH-409 class exactly.
 *
 * THE DECLARED SOURCES, none of them a copy written beside this test:
 *   1. THE COMPOSER'S DECLARATION — `app/app/Support/AnalysisNotice.php`, the table `WORDS_WITHOUT_A_REASON`.
 *      Its keys are the places and its values the sentences.
 *   2. THE OWNER'S OWN RECORD of what she approved on 29.09.2026 — the "after" column of her table in
 *      `files/fixes/26-08-17-hoxton-v6/PLAN-79-empty-section-words-RU.md`, each sentence in guillemets.
 *   3. THE CENSUS OF WHAT THE PAGES SAID BEFORE — the `*-emptiness-texts-census-RU.md` document beside her
 *      plan — for the places she decided NOT to change, whose words moved to the composer word for word.
 *      IT IS FOUND BY WHAT IT IS, NOT BY ITS PRESENT NAME: the file carries a question number in its name
 *      today, and code may name a task (`GH-NNN`) but never a question; an anchor also survives a rename,
 *      which a path does not. If the directory holds no such document, or more than one, this set says which
 *      files it looked at and fails -- it does not quietly proceed with nothing to compare against.
 *
 * WHY JAVASCRIPT AND NOT PHP: her records live in `files/`, which the app container does not mount — measured,
 * `/var/www/html/..` holds `assets` and `html` and nothing else. A PHP case cannot read them, so it cannot
 * make this claim; jest runs on the host and can.
 */

const fs = require('fs');
const path = require('path');

const ROOT = path.join(__dirname, '..');
const COMPOSER = path.join(ROOT, 'app/app/Support/AnalysisNotice.php');
const HER_TABLE = path.join(ROOT, 'files/fixes/26-08-17-hoxton-v6/PLAN-79-empty-section-words-RU.md');
const HER_FIXES_DIR = path.join(ROOT, 'files/fixes/26-08-17-hoxton-v6');
const CENSUS_ANCHOR = /-emptiness-texts-census-RU\.md$/;

/** The census, addressed by what it is. Prints the subject it looked at, so "not found" is not mistaken for "nothing to check". */
function theCensusPath() {
    const all = fs.readdirSync(HER_FIXES_DIR);
    const hits = all.filter((f) => CENSUS_ANCHOR.test(f));
    if (hits.length !== 1) {
        throw new Error('[gh792] expected exactly one ' + CENSUS_ANCHOR
            + ' document in ' + HER_FIXES_DIR + '; found ' + JSON.stringify(hits)
            + ' among ' + all.length + ' files');
    }
    return path.join(HER_FIXES_DIR, hits[0]);
}

const THE_CENSUS = theCensusPath();

const decode = (s) => String(s)
    .replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&#39;/g, "'")
    .replace(/&quot;/g, '"').replace(/&nbsp;/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();

/** The composer's table, read from the declaration: place -> sentence. */
function declaredWords() {
    const src = fs.readFileSync(COMPOSER, 'utf8');
    const at = src.indexOf('private const WORDS_WITHOUT_A_REASON = [');
    expect(at).toBeGreaterThan(-1);
    const end = src.indexOf('\n    ];', at);
    expect(end).toBeGreaterThan(at);
    const body = src.slice(at, end);
    const out = {};
    // `'place' => 'sentence'` and `'place' => 'part' .'part'`, which is how a long sentence is written.
    const re = /'([A-Za-z.]+)'\s*=>\s*((?:'(?:[^'\\]|\\.)*'\s*(?:\.\s*)?)+),/g;
    let m;
    while ((m = re.exec(body)) !== null) {
        const joined = m[2].split(/'\s*\.\s*'/).join('').replace(/^'|'$/g, '').replace(/\\'/g, "'");
        out[m[1]] = decode(joined);
    }

    return out;
}

/**
 * Every English sentence a record of hers quotes.
 *
 * Two quotation marks, because her two records use different ones: the plan quotes in guillemets, the census
 * in backticks. Reading only one of them answered "the census carries no sentence", which is a reader's
 * silence and not a record's.
 *
 * `lastCellOnly` narrows the plan to the "after" column of her table: the other columns quote what a page
 * SAID BEFORE, and taking those as approved would let the old sentence pass as her decision.
 */
function quotedIn(file, lastCellOnly) {
    const text = fs.readFileSync(file, 'utf8');
    const out = new Set();
    const scan = (chunk) => {
        ((chunk.match(/«[^»]+»/g) || []).concat(chunk.match(/`[^`]{12,}`/g) || [])).forEach((q) => {
            const inner = q.slice(1, -1);
            // Her records are written in Russian and quote the English sentences; a quotation of her own
            // prose, or a bare address, is not one of them.
            // A SENTENCE, not an identifier: three words at least. Her records quote code names in the same
            // marks -- `WAS_PRINTED_BEFORE`, `pgr-window-exhausted` -- and taking those for sentences made
            // this guard demand that the composer hold them.
            /**
             * AN ENGLISH SENTENCE IS ONE WITH NO CYRILLIC IN IT, which is the predicate that was wanted --
             * "ASCII only" rejected her own sentences wherever they carry an em dash or an arrow, and
             * `disease.dew` came out unaccounted for because of a dash, not because of a record.
             */
            const isASentence = !/[\u0400-\u04FF]/.test(inner)
                && decode(inner).split(' ').length >= 3
                && !/^[\w.-]+\.(js|php|md):\d+$/.test(inner);
            if (isASentence) out.add(decode(inner));
        });
    };
    if (!lastCellOnly) { scan(text); return out; }
    text.split('\n').filter((l) => l.startsWith('| ') && l.split('|').length >= 5).forEach((row) => {
        const cells = row.trim().replace(/^\||\|$/g, '').split('|');
        scan(cells[cells.length - 1]);
    });

    return out;
}

describe('GH-792 — the composer holds her words and nobody else\'s', () => {
    const words = declaredWords();
    const approved = quotedIn(HER_TABLE, true);
    const asTheyWere = quotedIn(THE_CENSUS, false);

    test('POSITIVE CONTROL: all three declarations were read and carry entries', () => {
        process.stdout.write('\n[gh792] the composer declares ' + Object.keys(words).length + ' places'
            + ' | her table quotes ' + approved.size + ' sentences'
            + ' | the census quotes ' + asTheyWere.size + '\n');

        expect(Object.keys(words).length).toBeGreaterThan(10);
        expect(approved.size).toBeGreaterThan(8);
        expect(asTheyWere.size).toBeGreaterThan(8);
    });

    test('every sentence the composer holds is one she approved or one she left alone', () => {
        const accounted = [];
        const unaccounted = [];
        Object.keys(words).sort().forEach((place) => {
            const sentence = words[place];
            if (approved.has(sentence)) { accounted.push(place + ' — she approved it'); return; }
            /**
             * A PLACE SHE LEFT ALONE is accounted for when the census records its phrase and the composer
             * carries that phrase AT THE HEAD of its sentence. The census records the phrase a place is known
             * by -- sometimes the whole sentence, sometimes its opening -- and the page printed the sentence
             * with its tail. The rule still requires the census to carry the phrase: it excuses a tail, not a
             * sentence nobody recorded.
             */
            const recorded = [...asTheyWere].find((q) => sentence === q || sentence.indexOf(q) === 0);
            if (recorded) {
                accounted.push(place + ' — hers to leave, recorded as "' + recorded.slice(0, 46) + '"');

                return;
            }
            unaccounted.push(place + ' :: ' + sentence);
        });
        process.stdout.write('[gh792] accounted for by a record of hers: ' + accounted.length
            + ' of ' + Object.keys(words).length + '\n'
            + accounted.map((a) => '[gh792]   ' + a).join('\n') + '\n');
        unaccounted.forEach((u) => process.stdout.write('[gh792]   IN NEITHER RECORD -> ' + u + '\n'));

        expect(unaccounted).toEqual([]);
    });

    /** THE OTHER DIRECTION: every sentence she approved is one the composer holds. */
    test('every sentence she approved is in the composer', () => {
        const held = new Set(Object.values(words));
        const missing = [...approved].filter((s) => !held.has(s));
        process.stdout.write('[gh792] approved sentences the composer does not hold: '
            + JSON.stringify(missing) + '\n');

        expect(missing).toEqual([]);
    });
});

/**
 * GH-674 (queue item 3at) — TWO CENSUSES FOR TWO CLAIMS ABOUT ABSENCE, WHICH NO
 * MUTATION OF A TEST FILE CAN CHECK.
 *
 * WHERE THEY COME FROM. Both claims were true and both lived in a case that could
 * not test them: one said the old hub's `.gaip-loi` read is not reborn anywhere,
 * and it sat inside a source-text case that was deleted for guarding a spelling
 * (GH-665); the other is its twin for `pH_cacl2` standing in for `pH`. An assertion
 * about ABSENCE is not provable by breaking the code under it — there is nothing to
 * break — so it belongs in a census whose universe is a DIRECTORY LISTING.
 *
 * THE UNIVERSE IS THE DIRECTORY, AND THAT IS THE WHOLE POINT. A list of files
 * written here would be stale the day a file is added, and the reviewer named the
 * consequence for the positive control too: planting the probe in a file the census
 * ALREADY names proves only that it re-reads what it knows. So the probe below is a
 * NEW file, created in the scanned directory and removed again.
 *
 * CENSUS 1 SCANS THE VIEWS AS WELL AS THE SCRIPTS. Without the views the field
 * comes back from the MARKUP rather than from a script, and the census would say
 * nothing about it.
 *
 * CENSUS 2's SIGN IS A RELATION, NOT A LITERAL, and the reviewer's reason is
 * measured: the literal `pH_cacl2` stands legitimately in the `whatif` path lists
 * and in the inputs list, and a census by name would redden them. What is looked
 * for is `pH_cacl2` taken FIRST in an `||` chain that feeds a field named for pH —
 * one quantity standing in for another — plus the importer's name-map form.
 *
 * BOTH PRINT WHAT THEY EXAMINED AND WHAT THEY MATCHED, BY NAME, BEFORE THE VERDICT.
 * "Nothing found" and "never reached the subject" are otherwise the same output.
 *
 * WHAT IS ALLOWED IS ALLOWED BY NAME AND WITH A REASON. The lists below are not a
 * transcription of today's grep: each entry says why that place is not a
 * substitution coming back. A new place anywhere reddens with its own name.
 */

'use strict';

const fs = require('fs');
const path = require('path');

const ROOT = path.join(__dirname, '..');
const ASSETS = path.join(ROOT, 'assets');
const VIEWS = path.join(ROOT, 'app', 'resources', 'views');

/** Every file of a kind under a directory, listed rather than remembered. */
function filesUnder(dir, matches) {
    const out = [];
    const walk = (d) => {
        fs.readdirSync(d, { withFileTypes: true }).forEach((entry) => {
            const full = path.join(d, entry.name);
            if (entry.isDirectory()) walk(full);
            else if (matches(entry.name)) out.push(full);
        });
    };
    walk(dir);

    return out.sort();
}

const rel = (p) => path.relative(ROOT, p);

/**
 * Matches in one file, with the line and a short excerpt — COMMENTS REMOVED FIRST.
 *
 * Found by running this census before stripping them: two of its three "new places"
 * were the docblocks in `hub-tissue-v3.js` EXPLAINING that the read was removed. A
 * census that reads prose as code reddens on its own reasoning, which is the same
 * trap `gh548` names for its own reading of the tree.
 *
 * Block comments are blanked over whole lines so the line numbers stay true — an
 * address that shifted would be worse than useless in a census whose whole output
 * is addresses.
 */
function findIn(file, test) {
    const raw = fs.readFileSync(file, 'utf8').split('\n');
    let inBlock = false;
    const code = raw.map((line) => {
        let out = line;
        if (inBlock) {
            const end = out.indexOf('*/');
            if (end === -1) return '';
            out = out.slice(end + 2);
            inBlock = false;
        }
        // `/* ... */` on one line, then an unterminated opener, then `//` and `{{-- --}}`
        out = out.replace(/\/\*[\s\S]*?\*\//g, '');
        if (out.includes('/*')) { inBlock = true; out = out.slice(0, out.indexOf('/*')); }
        out = out.replace(/\/\/.*$/, '').replace(/\{\{--[\s\S]*?--\}\}/g, '');

        return out;
    });

    const out = [];
    code.forEach((line, i) => {
        if (test(line)) out.push({ file: rel(file), line: i + 1, excerpt: raw[i].trim().slice(0, 90) });
    });

    return out;
}

/**
 * CENSUS 1 — the old hub's organic-matter field, `.gaip-loi` without a depth
 * suffix. The suffixed ones (`gaip-loi-0-2` and its neighbours) are the stratified
 * fields, which are the page's own and were deliberately left (GH-628).
 */
const BARE_LOI = (line) => /gaip-loi(?![-\w])/.test(line) && line;

/**
 * Where it may still appear, each with the reason it is not a substitution coming
 * back into the run.
 */
const LOI_ALLOWED = {
    'assets/gaip-clear-data.js': 'CLEARS the field on a site change; it writes, it does not read a value into a run',
    'assets/input-state-watcher.js': 'watches the field for edits; it reads no value into the run state',
    'assets/lab-import.js': 'the old hub\'s importer, unreachable to a client and allowed by name until the open question on it is settled',
    'assets/sample-manager.js': 'puts a SAMPLE\'s value into the form and reads the form back as a sample; the sample is the source either way',
    'assets/nutrition-calendar.js': 'reads the field for the calendar\'s own display, not for the soil state the engines are handed',
    'assets/hub-persistence.js': 'the page snapshot the runner builds; the soil state the engines get is assembled in hub-tissue-v3 and no longer reads this field (GH-615)',
    'app/resources/views/partials/legacy-hub-markup.blade.php': 'the field itself, in the old hub\'s markup — a calculation runner, not a client surface',
    'assets/site-selector-ui.js': 'CLEARS the LOI fields on a site switch (`clearLOIForm`); read for the file measured, not remembered — it writes empties, it reads no value into a run',
};

/**
 * CENSUS 2 — one quantity standing in for another: a CaCl2 pH used where a water pH
 * is expected. The relation, not the name.
 */
/**
 * THE SIGN CARRIES ITS VERSION, AND THE NARROW FORM IT REPLACED IS KEPT BESIDE IT.
 *
 * The reviewer's rule, and it arrives with the widening rather than after it: a list
 * carries the version of the sign it was measured under, and growth AT THE SAME
 * VERSION is printed apart from growth caused by the sign getting wider. Without the
 * split the first useful widening reads as a break, and a tool that cries wolf gets
 * switched off.
 *
 * Why it is not optional here: `gh669` widened inside an expression and thirteen
 * places became seven with no decision recorded anywhere. A change of sign is an
 * ANNOUNCED EVENT, like a decision — not an edit to a regular expression.
 *
 * V1 was the narrow form: only the FIRST operand of the chain. V2 is the analyst's
 * wide form (section 43.2): ANY operand, `??` chains, and the suffix strip. V1 stays
 * executable so the difference between the two is measured, not asserted.
 */
const SIGN_VERSION = 2;
const SIGN_VERSIONS = {
    1: 'narrow: a CaCl2 value as the FIRST operand of a pH chain',
    2: 'wide (analyst 43.2): ANY operand of the chain, `??` chains included, plus a stripped `cacl2` suffix',
};

/** V1, kept executable. Not the sign in force — the baseline the list was measured under. */
const CACL2_FIRST_V1 = (line) => {
    const target = (/^[^;]*?([\w.]+)\s*[:=][^=]/.exec(line) || [])[1] || '';
    if (/cacl2/i.test(target)) return false;

    return /\b(?:pH|soilPH|phValue|soilPH_mg|ph)\w*\s*[:=]\s*[^;]*?\bpH_cacl2\b/.test(line)
        && !/\bpH_water\b[^;]*?\bpH_cacl2\b/.test(line);
};

const CACL2_FIRST = (line) => {
    // THE SCOPE OF THIS SIGN IS DECIDED IN THE ITEM, NOT IN THIS EXPRESSION — the
    // reviewer's objection, and the analyst settled it: the wide form. The chain's
    // TARGET quantity is the pH of water, named on the left of the assignment or, if
    // there is no name, by the first operand; and ANY operand of that chain reading
    // a CaCl2 value is a substitution of one quantity for another. Not merely the
    // first operand, which is what the narrow form looked at.
    // THE TARGET MUST BE THE WATER pH, and this exclusion is the analyst's own
    // wording applied: the chain's target quantity is named on the LEFT, and when
    // that name is itself a CaCl2 field the line is a copy of CaCl2 into CaCl2 —
    // nothing stands in for anything. Without it the census reddened on
    // `soilState.pH_cacl2 = parseFloat(src.pH_cacl2)`, which substitutes nothing,
    // and on the MANUFACTURING line, which is a different class and carried as its
    // own item rather than here.
    const target = (/^[^;]*?([\w.]+)\s*[:=][^=]/.exec(line) || [])[1] || '';
    if (/cacl2/i.test(target)) return false;
    if (/\b(?:pH|soilPH|phValue|soilPH_mg|ph)\w*\s*[:=][^;]*?\bpH_cacl2\b/.test(line)) return true;
    // `?? ` chains too: a different operator, the same substitution.
    if (/\b(?:pH|soilPH|phValue|soilPH_mg|ph)\w*\s*[:=][^;]*?\?\?[^;]*?\bcacl2\b/i.test(line)) return true;
    // The importer's name map: a CaCl2 column declared as plain `pH`.
    if (/\(cacl2\)\s*['"]?\s*:\s*['"]pH['"]/i.test(line)) return true;
    // THE SUFFIX, which the analyst named in her own draft and which was missing
    // here — my omission, not hers: stripping `cacl2` off a column name turns a
    // CaCl2 reading into a plain pH without any chain at all.
    if (/replace\s*\([^)]*cacl2/i.test(line)) return true;

    return false;
};

/**
 * Measured under version 2 of the sign. A list taken under one version and read under
 * another is the comparison `gh669` made without noticing.
 */
const CACL2_ALLOWED_VERSION = 2;
const CACL2_ALLOWED = {
    'assets/soil-tissue-integration.js': 'five reads of CaCl2 before water, named by the analyst and left until the owner settles whether the substitution stands at all',
    'assets/lab-import.js': 'the old hub\'s importer name map, unreachable to a client, allowed by name until that question is settled',
    'assets/gilba-synthesis-interpretation.js': 'reads water pH then CaCl2 then the form; a chain of the same class, carried with the other reads until the owner settles whether the substitution stands at all',
    'assets/hub-persistence.js': 'the row producer\'s pH chain, same class, same open question',
    'assets/nutrition-au-fertiliser-integration.js': 'the same chain in the AU fertiliser path',
    'assets/nutrition-uk-fertiliser-integration.js': 'the same chain in the UK fertiliser path',
    'assets/water-progressive-disclosure-WITH-SOIL-INTERACTION.js': 'the same chain on the water disclosure page',
    'assets/hub-tissue-v3.js': 'the same chain in the run state and in two readers of it',
    'assets/cascade-orchestrator.js': 'the same chain in the tissue context',
    'assets/mlsn-progressive-disclosure.js': 'the same chain on the MLSN panel',
    'assets/word-export.js': 'a water-then-CaCl2 chain in the exported document, same class as the rest; the MANUFACTURING line in the same file is a different class and is carried as its own item',
    'assets/sample-manager.js': 'strips the `cacl2` suffix off a column name, which turns a CaCl2 reading into a plain pH — named by the analyst and carried with the rest',
    // `word-export.js` HAS LEFT THIS LIST. It does not substitute one quantity for
    // another: it MANUFACTURES a CaCl2 reading from a water pH by subtracting 0.5.
    // The analyst put that in a class of its own — creating a measurement nobody
    // made — and it is carried as its own item, not as an allowance here.
};

/** The two universes, listed from disk each run. */
const scriptFiles = () => filesUnder(ASSETS, (n) => n.endsWith('.js') && !n.endsWith('.min.js'));
const viewFiles = () => filesUnder(VIEWS, (n) => n.endsWith('.blade.php'));

/** A census: every match in a universe, grouped by file. */
function census(files, test) {
    const hits = [];
    files.forEach((f) => hits.push(...findIn(f, test)));

    return hits;
}

/** What is not allowed, named by file and excerpt rather than counted. */
function unexpected(hits, allowed) {
    return hits.filter((h) => !Object.prototype.hasOwnProperty.call(allowed, h.file))
        .map((h) => h.file + ':' + h.line + '  ' + h.excerpt);
}

describe('GH-674 — census 1: the old hub’s organic-matter field does not come back', () => {
    test('POSITIVE CONTROL: both universes are directory listings and both were read', () => {
        const scripts = scriptFiles();
        const views = viewFiles();
        process.stdout.write('\n[gh674] census 1 examined ' + scripts.length + ' scripts and '
            + views.length + ' views, listed from disk\n'
            + '[gh674] a sample of the names: '
            + JSON.stringify(scripts.slice(0, 3).map(rel).concat(views.slice(0, 2).map(rel))) + '\n');
        // Floors well under the real sizes: this must not redden because a file was
        // added, only because a universe collapsed.
        expect(scripts.length).toBeGreaterThan(50);
        expect(views.length).toBeGreaterThan(10);
    });

    test('the matches are printed BY NAME before anything is claimed', () => {
        const hits = census(scriptFiles().concat(viewFiles()), BARE_LOI);
        process.stdout.write('[gh674] census 1 matches (' + hits.length + '):\n');
        hits.forEach((h) => process.stdout.write('[gh674]    ' + h.file + ':' + h.line
            + '  ' + h.excerpt + '\n'));
        process.stdout.write('[gh674] files allowed, with reasons: '
            + JSON.stringify(Object.keys(LOI_ALLOWED)) + '\n');

        // The subject was reached: the field really is still in the tree, in places
        // that are allowed. A census finding nothing would prove only that the
        // pattern was wrong.
        expect(hits.length).toBeGreaterThan(0);
    });

    test('no file outside the named list reads it — a new place is named, not counted', () => {
        const hits = census(scriptFiles().concat(viewFiles()), BARE_LOI);
        const strangers = unexpected(hits, LOI_ALLOWED);
        process.stdout.write('[gh674] census 1, places outside the named list: '
            + JSON.stringify(strangers) + '\n');

        expect({ theFieldIsReadSomewhereNew: strangers }).toEqual({ theFieldIsReadSomewhereNew: [] });
    });

    test('and every name on the allowed list still exists, so the list cannot rot', () => {
        // The other direction, the one the reviewer insists on: an allowance whose
        // file is gone is an open door nobody is watching.
        const present = new Set(scriptFiles().concat(viewFiles()).map(rel));
        const gone = Object.keys(LOI_ALLOWED).filter((f) => !present.has(f));
        process.stdout.write('[gh674] allowed files that no longer exist: ' + JSON.stringify(gone) + '\n');
        expect({ staleAllowances: gone }).toEqual({ staleAllowances: [] });
    });
});

describe('GH-674 — census 2: a CaCl2 pH does not stand in for a water pH somewhere new', () => {
    test('the matches are printed BY NAME before anything is claimed', () => {
        const hits = census(scriptFiles(), CACL2_FIRST);
        process.stdout.write('[gh674] census 2 matches (' + hits.length + '):\n');
        hits.forEach((h) => process.stdout.write('[gh674]    ' + h.file + ':' + h.line
            + '  ' + h.excerpt + '\n'));
        process.stdout.write('[gh674] files allowed, with reasons: '
            + JSON.stringify(Object.keys(CACL2_ALLOWED)) + '\n');

        // Measured before it was relied on: the analyst named FIVE places, and the
        // relation finds exactly the shape she meant — CaCl2 taken first — rather
        // than the eighteen the literal would find, most of which are the other
        // direction and not a substitution at all.
        expect(hits.length).toBeGreaterThan(0);
    });

    test('the version is declared, and growth by the SIGN is printed apart from growth by the CODE', () => {
        // The two are different findings and must not arrive as one number. Places the
        // wide sign names and the narrow one did not are the WIDENING's doing; places
        // outside the allowance list at the SAME version are the code's.
        const wide = census(scriptFiles(), CACL2_FIRST);
        const narrow = census(scriptFiles(), CACL2_FIRST_V1);
        const key = (h) => h.file + ':' + h.line;
        const narrowKeys = new Set(narrow.map(key));
        const onlyWide = wide.filter((h) => !narrowKeys.has(key(h)));
        process.stdout.write('[gh674] sign version in force: ' + SIGN_VERSION
            + ' — ' + SIGN_VERSIONS[SIGN_VERSION] + '\n'
            + '[gh674] the allowance list was measured under version: ' + CACL2_ALLOWED_VERSION + '\n'
            + '[gh674] v1 names ' + narrow.length + ' places, v2 names ' + wide.length + '\n'
            + '[gh674] named ONLY by the widening (' + onlyWide.length + '): '
            + JSON.stringify(onlyWide.map(key)) + '\n');

        // The list in the tree must belong to the sign in force. If the sign is widened
        // again and this line is not moved with it, the comparison below is between two
        // different questions and the test says so instead of reporting growth.
        expect({ signInForce: SIGN_VERSION, listMeasuredUnder: CACL2_ALLOWED_VERSION })
            .toEqual({ signInForce: SIGN_VERSION, listMeasuredUnder: SIGN_VERSION });
        // And the widening did find something the narrow form missed — otherwise the
        // version bump would be bookkeeping over nothing.
        expect(onlyWide.length).toBeGreaterThan(0);
        // A NARROWING IS CAUGHT TOO, and this direction is the reviewer's finding:
        // everything above measures the sign getting WIDER. `gh669` was narrowed
        // INSIDE its expression — thirteen places became seven with no decision
        // recorded — and a version number alone would not have noticed, because the
        // number is written by the same hand that narrows. The sign in force must name
        // at least as much as the form it replaced; if it ever names less, that is a
        // narrowing and it reddens here whatever the version says.
        //
        // GH-705 — AND "AT LEAST AS MUCH" IS A RELATION BETWEEN TWO LISTS, NOT BETWEEN TWO
        // COUNTS. A sign that drops two of the places the narrow form named and gains two
        // elsewhere still names more in total, and a comparison of lengths stays green
        // over the narrowing it exists to catch. Every place the replaced form names must
        // still be named by the sign in force, by file and line.
        const wideKeys = new Set(wide.map(key));
        const lostByNarrowing = narrow.filter((h) => !wideKeys.has(key(h))).map(key);
        process.stdout.write('[gh674] v1 places: ' + JSON.stringify(narrow.map(key)) + '\n'
            + '[gh674] named by v1 and NOT by the sign in force (' + lostByNarrowing.length + '): '
            + JSON.stringify(lostByNarrowing) + '\n');
        expect({ narrowedAway: lostByNarrowing }).toEqual({ narrowedAway: [] });
    });

    test('no file outside the named list substitutes it', () => {
        const hits = census(scriptFiles(), CACL2_FIRST);
        const strangers = unexpected(hits, CACL2_ALLOWED);
        process.stdout.write('[gh674] census 2, places outside the named list: '
            + JSON.stringify(strangers) + '\n');

        expect({ theSubstitutionIsBackSomewhereNew: strangers })
            .toEqual({ theSubstitutionIsBackSomewhereNew: [] });
    });

    test('the LITERAL would have reddened legitimate places, which is why the sign is a relation', () => {
        // The reviewer's reason, measured rather than repeated: the name appears in
        // path lists and in the inputs list, where it is a declaration and not a
        // substitution.
        const byName = census(scriptFiles(), (line) => /\bpH_cacl2\b/.test(line) && line);
        const byRelation = census(scriptFiles(), CACL2_FIRST);
        process.stdout.write('[gh674] the literal matches ' + byName.length
            + ' lines, the relation ' + byRelation.length + '\n');
        expect(byName.length).toBeGreaterThan(byRelation.length);
    });
});

describe('GH-674 — the probe is planted in a NEW file, or the universe proves nothing', () => {
    // The reviewer's condition: planting it in a file the census already names shows
    // only that the census re-reads what it knows. This file does not exist until
    // this case makes it, and it is removed again whatever happens.
    const probe = path.join(ASSETS, '__gh674_probe_delete_me.js');

    afterEach(() => {
        if (fs.existsSync(probe)) fs.unlinkSync(probe);
    });

    test('a new file carrying both patterns is found by both censuses, by name', () => {
        fs.writeFileSync(probe, [
            '// GH-674 probe. Created and deleted by the test that plants it.',
            "var om = document.querySelector('.gaip-loi');",
            'var soilPH = soil.pH_cacl2 || soil.pH_water || 0;',
            '',
        ].join('\n'), 'utf8');

        const loi = unexpected(census(scriptFiles().concat(viewFiles()), BARE_LOI), LOI_ALLOWED);
        const cacl2 = unexpected(census(scriptFiles(), CACL2_FIRST), CACL2_ALLOWED);
        process.stdout.write('[gh674] with the probe planted — census 1 names: ' + JSON.stringify(loi)
            + '\n[gh674] with the probe planted — census 2 names: ' + JSON.stringify(cacl2) + '\n');

        expect(loi).toEqual(['assets/__gh674_probe_delete_me.js:2'
            + "  var om = document.querySelector('.gaip-loi');"]);
        expect(cacl2).toEqual(['assets/__gh674_probe_delete_me.js:3'
            + '  var soilPH = soil.pH_cacl2 || soil.pH_water || 0;']);
    });

    test('and with the probe gone both censuses are clean again', () => {
        expect(fs.existsSync(probe)).toBe(false);
        expect(unexpected(census(scriptFiles().concat(viewFiles()), BARE_LOI), LOI_ALLOWED)).toEqual([]);
        expect(unexpected(census(scriptFiles(), CACL2_FIRST), CACL2_ALLOWED)).toEqual([]);
    });
});

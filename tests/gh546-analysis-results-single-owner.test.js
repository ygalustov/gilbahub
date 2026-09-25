/**
 * GH-546 (stage 1) — the analysis result has one owner, and this is what
 * makes that true rather than intended.
 *
 * WHAT IT GUARDS. `App\Support\AnalysisResults` is the only PHP that may name
 * the storage of a site's analysis result. Before this stage there were ten
 * places: one writer and nine readers, each reaching into
 * `site_configs / namespace = 'analysis_cache'` on its own terms — eight of them
 * assembling the identical three-key array by hand. The result was a
 * by-product of a page with no owner, and everything else followed: any
 * embedding of the producer could write it, its form was whatever came out, and
 * a five-key row replaced a hundred-and-seventy-kilobyte one with nobody able to
 * say which was right.
 *
 * WHY A TEST AND NOT A CONVENTION. The same reasoning as GH-447, whose shape
 * this follows: an owner nothing enforces is an owner in the comments. The
 * tenth reader is the one that gets added quietly, and it is added by someone
 * who has not read this file — which is exactly who a red test is for.
 *
 * AND IT GUARDS THE OTHER DIRECTION TOO. Stage 4 moves the storage to its own
 * table; the readers are not supposed to notice, because they go through the
 * projection. That only holds while nobody bypasses it, which is what the walk
 * below checks on every PHP file under app/app.
 */

'use strict';

const fs = require('fs');
const path = require('path');

const APP_DIR = path.join(__dirname, '../app/app');

/**
 * Every way of naming the storage that belongs to the owner.
 *
 * GH-546 review: the constant was missing. A reader that wrote
 * `SiteConfig::where('namespace', AnalysisResults::NAMESPACE)` named the same
 * storage, reached round the projection, and walked past this guard — which
 * caught the spelling and not the act. That reader loses `lastRun` and `status`
 * today and breaks silently at stage 4, when the storage moves and the promise
 * that "the readers will not notice" rests on the projection rather than on how
 * the namespace was spelled.
 */
const STORAGE_NAMES = [
    // GH-550 (stage 4): the storage moved to its own table. Both spellings stay
    // on the list. The old one, because a reader written against the namespace
    // must not come back quietly on a table that no longer holds it — it would
    // now read nothing and print nothing, which is worse than reading the wrong
    // thing. The new one, because the table is what the owner owns today.
    "'analysis_cache'",
    '"analysis_cache"',
    'AnalysisResults::NAMESPACE',
    'AnalysisResults::TABLE',
    "'analysis_results'",
    '"analysis_results"',
    // The model IS the storage. Naming it is reaching round the projection just
    // as surely as naming the table was.
    'AnalysisResult::',
    'App\\Models\\AnalysisResult',
];

/**
 * Who may name the storage, and why. A file is exempt for a stated reason or it
 * is a finding — "it seemed fine" is not in the list.
 */
const EXEMPT = {
    'Support/AnalysisResults.php':
        'this IS the owner — the one place allowed to read or write the analysis result',
    'Models/AnalysisResult.php':
        'the record itself (GH-550). A model naming its own table is not a reader reaching round the owner; nothing may query it but the owner above, which is what the walk checks',
    // GH-709: one file, read only. The data audit checks the STORAGE itself; reading it through
    // the owner would audit the owner's projection, not the rows. It writes nothing, which its
    // own test asserts from the query log.
    'Console/Commands/AuditData.php':
        'the data audit reads the stored rows, not the owner\'s projection of them, and only reads (GH-709)',
};

/**
 * The nine readers, named once. GH-566 gave them a second reader (the alias
 * walk), and two lists of nine drift the way two of anything drift.
 */
const ALLOWED_READERS = [
    'Providers/AppServiceProvider.php',
    'Http/Controllers/DashboardController.php',
    'Http/Controllers/SettingsController.php',
    'Http/Controllers/DataController.php',
    'Http/Controllers/ReportsController.php',
    'Http/Controllers/PageController.php',
    'Http/Controllers/AnalysisController.php',
    'Http/Controllers/AccountController.php',
    'Http/Controllers/AnalysisCacheController.php',
    // GH-558: the command that restates outcomes asks the owner which rows
    // disagree with the rule and hands back ids; it names no storage.
    'Console/Commands/RecomputeAnalysisOutcomes.php',
];

function phpFiles(dir) {
    const out = [];
    fs.readdirSync(dir, { withFileTypes: true }).forEach((entry) => {
        const full = path.join(dir, entry.name);
        if (entry.isDirectory()) return out.push(...phpFiles(full));
        if (entry.name.endsWith('.php')) out.push(full);
    });
    return out;
}

/** Source without comments: a guard that reads its own explanation checks prose. */
function codeLines(src) {
    let inBlock = false;
    return src.split('\n').map((line, i) => ({ line, n: i + 1 })).filter(({ line }) => {
        const t = line.trim();
        if (inBlock) {
            if (t.includes('*/')) inBlock = false;
            return false;
        }
        if (t.startsWith('/*')) {
            if (!t.includes('*/')) inBlock = true;
            return false;
        }
        return !t.startsWith('//') && !t.startsWith('*');
    });
}

function rel(file) {
    return path.relative(APP_DIR, file);
}

function offenders() {
    const hits = [];
    phpFiles(APP_DIR).forEach((file) => {
        const r = rel(file);
        if (EXEMPT[r]) return;
        codeLines(fs.readFileSync(file, 'utf8')).forEach(({ line, n }) => {
            if (STORAGE_NAMES.some((name) => line.includes(name))) {
                hits.push({ file: r, n, line: line.trim().slice(0, 110) });
            }
        });
    });
    return hits;
}

describe('GH-546 — one owner for the analysis result', () => {

    test('the walk reaches the tree at all', () => {
        // Without this, an empty walk agrees with an empty offender list and the
        // guard reports green for having looked at nothing.
        const files = phpFiles(APP_DIR);
        expect(files.length).toBeGreaterThan(30);
        expect(files.some((f) => rel(f) === 'Support/AnalysisResults.php')).toBe(true);
        expect(files.some((f) => rel(f) === 'Http/Controllers/AnalysisCacheController.php')).toBe(true);
    });

    test('nobody but the owner names the analysis result storage', () => {
        const hits = offenders();
        // Printed rather than summarised: a count tells nobody where to look.
        if (hits.length) {
            process.stdout.write('[gh546] files still naming the storage:\n');
            hits.forEach((h) => process.stdout.write('  ' + h.file + ':' + h.n + '  ' + h.line + '\n'));
        }
        expect(hits).toEqual([]);
    });

    test('the owner really does name it — the guard is not green by the name having moved', () => {
        // If the storage were renamed everywhere, the test above would pass for
        // the wrong reason. This pins that the owner still owns something, and
        // GH-550 is exactly the case it was written for: the name DID move, from
        // a namespace in the settings table to a table of its own.
        const owner = fs.readFileSync(path.join(APP_DIR, 'Support/AnalysisResults.php'), 'utf8');
        expect(owner).toContain("const TABLE = 'analysis_results'");
        // and it reaches the storage through the model, not through the old row
        expect(owner).toContain('AnalysisResult::query()');
        expect(owner).not.toContain('SiteConfigWriter');
    });

    test('every exemption names a file that exists and a reason', () => {
        Object.keys(EXEMPT).forEach((r) => {
            expect(fs.existsSync(path.join(APP_DIR, r))).toBe(true);
            expect(String(EXEMPT[r]).length).toBeGreaterThan(20);
        });
        // Two exemptions: the owner, and the record it owns. A third arriving
        // without a conversation is the thing to notice.
        expect(Object.keys(EXEMPT)).toEqual([
            'Support/AnalysisResults.php',
            'Models/AnalysisResult.php',
            // GH-709: the third, after the conversation this line asks for — the coordinator's
            // decision that the data audit reads the storage rather than the owner's projection.
            'Console/Commands/AuditData.php',
        ]);
    });

    test('the nine readers go through the projection', () => {
        // Named individually, because "nobody names the storage" would also be
        // satisfied by a reader that simply stopped reading anything.
        //
        // GH-546 review: this asked whether the file contained the string
        // `AnalysisResults::`, which `AnalysisResults::NAMESPACE` satisfies —
        // so a file that took the constant and queried the row itself counted
        // as going through the projection. The test's name was wider than what
        // it measured. It now asks for a CALL to one of the projection's
        // methods, which is the thing stage 4 depends on.
        const PROJECTION_CALLS = [
            'AnalysisResults::forSite(',
            'AnalysisResults::forSites(',
            'AnalysisResults::statusMap(',
            'AnalysisResults::record(',
        ];
        const usesOwner = (f) => {
            const src = fs.readFileSync(path.join(APP_DIR, f), 'utf8');
            return PROJECTION_CALLS.some((call) => src.includes(call));
        };
        // The nine this stage moved onto the projection — the command GH-558
        // added is a writer, not one of them, so it is excluded by name rather
        // than by the list quietly growing.
        ALLOWED_READERS
            .filter((f) => f !== 'Console/Commands/RecomputeAnalysisOutcomes.php')
            .forEach((f) => expect([f, usesOwner(f)]).toEqual([f, true]));
    });

    /**
     * GH-566 — THE EDGE THE FIRST TWO CHECKS LEAVE OPEN.
     *
     * The two above look for the storage's NAMES and for calls written
     * `AnalysisResults::forSite(`. A tenth reader that writes
     *
     *     use App\Support\AnalysisResults as AR;
     *     $row = AR::forSite($site);
     *
     * names no storage and spells no watched call, so it passes both — measured
     * by the reviewer with a planted file, six green out of six. Carried in
     * the main defects document, and it is the same shape as the GH-546 review
     * finding that came before it: a guard that catches the SPELLING and not the
     * ACT.
     *
     * This asks the other question. Any file that IMPORTS the owner, under
     * whatever name, or calls one of its methods through whatever alias, is
     * either one of the nine readers, or exempt with a reason, or a finding. The
     * alias is resolved from the `use` statement rather than guessed, so a file
     * calling `AR::forSite()` is judged by what `AR` is, not by what it is
     * called.
     */
    test('nobody reaches the owner under another name either', () => {
        const OWNER_FQN = 'App\\Support\\AnalysisResults';
        const METHODS = ['forSite', 'forSites', 'statusMap', 'record', 'recordFailure',
                         'outcomesToRestate', 'outcomeCensus', 'restateOutcomes'];

        const hits = [];
        phpFiles(APP_DIR).forEach((file) => {
            const r = rel(file);
            if (EXEMPT[r] || ALLOWED_READERS.includes(r)) return;

            const lines = codeLines(fs.readFileSync(file, 'utf8'));
            // Every name the owner answers to in THIS file: its own short name,
            // plus whatever any `use ... as X;` called it.
            const names = ['AnalysisResults'];
            lines.forEach(({ line }) => {
                const m = line.match(/^\s*use\s+App\\Support\\AnalysisResults(?:\s+as\s+([A-Za-z_][A-Za-z0-9_]*))?\s*;/);
                if (m) names.push(m[1] || 'AnalysisResults');
            });

            lines.forEach(({ line, n }) => {
                if (line.includes(OWNER_FQN)) {
                    hits.push({ file: r, n, line: line.trim(), why: 'imports or names the owner' });
                    return;
                }
                names.forEach((name) => {
                    METHODS.forEach((m) => {
                        if (line.includes(name + '::' + m + '(')) {
                            hits.push({ file: r, n, line: line.trim(), why: 'calls ' + name + '::' + m });
                        }
                    });
                });
            });
        });

        if (hits.length) {
            process.stdout.write('[gh546] files reaching the owner from outside the nine:\n');
            hits.forEach((h) => process.stdout.write('  ' + h.file + ':' + h.n + '  ' + h.why + '  ' + h.line + '\n'));
        }
        expect(hits).toEqual([]);
    });

    test('the alias walk finds a planted reader — it is not green for want of looking', () => {
        // The positive control, and this guard needs one more than most: its
        // whole subject is a thing nobody has written yet, so "nothing found"
        // and "nothing looked for" are the same green.
        const planted = [
            '<?php',
            'namespace App\\Http\\Controllers;',
            'use App\\Support\\AnalysisResults as AR;',
            'class SneakyController {',
            '    public function show($site) { return AR::forSite($site); }',
            '}',
        ].join('\n');

        const lines = codeLines(planted);
        const names = ['AnalysisResults'];
        lines.forEach(({ line }) => {
            const m = line.match(/^\s*use\s+App\\Support\\AnalysisResults(?:\s+as\s+([A-Za-z_][A-Za-z0-9_]*))?\s*;/);
            if (m) names.push(m[1] || 'AnalysisResults');
        });
        expect(names).toContain('AR');

        const called = lines.some(({ line }) => names.some((nm) => line.includes(nm + '::forSite(')));
        expect(called).toBe(true);
    });

    test('SampleAnalysisController reads the result from nowhere at all', () => {
        // GH-546: it is not an exemption and not a reader through the
        // projection — the server's answer about a sample stops being built out
        // of what a browser last computed.
        const src = fs.readFileSync(path.join(APP_DIR, 'Http/Controllers/SampleAnalysisController.php'), 'utf8');
        const code = codeLines(src).map((l) => l.line).join('\n');
        expect(code).not.toContain('analysis_cache');
        expect(code).not.toContain('AnalysisResults::');
        expect(code).not.toContain('cachedSn');
    });
});

'use strict';

/**
 * GH-781 (delivery 7, the analyst's amendments (9)-(10) and the reviewer's four conditions) — EVERY WRITER OF
 * THE JOURNAL IS EITHER MET IN A STORED ROW OR DECLARED, AND A DECLARATION THAT STOPPED BEING NEEDED GOES.
 *
 * WHY TWO PATHS AND NOT ONE: a census taken from the code says who COULD write; a registry taken from stored
 * rows says who DID. Each alone is the fault this item exists against — a list from the code is satisfied by a
 * new place to write, and a list from rows amnesties a writer nobody has exercised. They are built separately
 * here and compared.
 *
 * WHICH ROWS COUNT, and this is the reviewer's own finding: only rows that carry `detail.journal` and whose
 * every journal entry carries `door`. The 113 rows stored before delivery 6 have neither, so counting them
 * would let an old row vouch for a writer by its producer/module pair alone — exactly the hole the `door`
 * field closes. They are counted separately and printed, never for or against.
 *
 * WHAT THIS FILE DOES WHEN THE REGISTRY IS EMPTY: it says so and does NOT pass. A green here before a single
 * row carries a door would be "checked and never reached the subject", which is the shape of fault this
 * repository keeps finding in its own guards. The whole file is then SKIPPED WITH ITS REASON IN ITS NAME, so
 * the run's summary says it rather than the verdict hiding in the output.
 */

const fs = require('fs');
const path = require('path');
/**
 * GH-788 (queue item 3gd): the census reads CODE, not prose.
 *
 * This file's census was the measurement that opened that item: the reviewer inserted a block comment quoting
 * a door's call into `cascade-orchestrator.js` and the census grew from 7 writers to 8 with the suite green —
 * so "no writer outside the census" was being checked against a census a comment inflates. The helper blanks
 * every comment to spaces, keeping the length and the newlines, so the addresses this file prints still point
 * where they did.
 */
const { codeOf } = require('./lib/source-without-comments');
const { execFileSync } = require('child_process');

const vm = require('vm');

const ROOT = path.join(__dirname, '..');
const ASSETS = path.join(ROOT, 'assets');

/**
 * THE PGR ENGINE ITSELF, for the one thing this file asks of it: how old an application was WHEN A ROW WAS
 * WRITTEN. It already takes the point of reference and works in UTC midnights, so no second implementation of
 * "how many days" is written here - which is what a condition over rows would otherwise become.
 */
const PGR = (function () {
    const sandbox = { console: { log() {}, warn() {}, error() {} }, Date, Math, JSON, Object, Array, String,
        Number, parseFloat, parseInt, isNaN, isFinite };
    sandbox.window = sandbox;
    sandbox.global = sandbox;
    sandbox.globalThis = sandbox;
    vm.createContext(sandbox);
    vm.runInContext(fs.readFileSync(path.join(ASSETS, 'gilba-pgr-module-v3.js'), 'utf8'), sandbox,
        { filename: 'gilba-pgr-module-v3.js' });

    return sandbox.GAIP_PGR;
})();

/**
 * THE DECLARED EXCEPTIONS, with the reason each one is not expected in a row yet.
 *
 * `rare-by-input` — the input that would produce it does not occur on the stand, and the live run that makes
 * it occur is named. `guard` — the record is what a DEFECT produces, so a live input for it must not exist;
 * its case plants the fault instead. A declaration that turns out to be met is removed by the verdict below.
 */
const DECLARED = [
    {
        producer: 'cascade', door: 'note', module: 'pgr', reason: 'pgr-window-exhausted',
        kind: 'with-condition',
        // The journal holds an application older than the engine's window for the site this row is about.
        /**
         * The journal's answer comes from `/api/spray-log/context`, which gives the LAST application as of
         * today, so the age it yields is only trustworthy for a row written today. Older rows are printed
         * open rather than judged against a figure that has moved since - the analyst's own boundary.
         */
        /**
         * GH-781 (delivery 7, the analyst's amendment (13)) - THE AGE IS TAKEN AS OF THE ROW, BY THE ENGINE.
         *
         * The journal's answer is the LAST application, so its age has to be measured against the moment the
         * row was written and not against today, or a later application would make an old row look wrong. The
         * engine's own `daysSinceApplication` takes that point of reference and rounds in UTC midnights, so
         * this asks it rather than writing a second count.
         *
         * An application on the SAME DAY as the row, or after it, leaves the row OPEN: the route gives no time
         * of day, so "was it already applied when the pass ran" cannot be answered for that day. The same
         * discriminator covers the case of an application recorded after the row.
         */
        when: (row) => {
            if (!row.pgrAppliedAt) return false;
            const days = PGR.daysSinceApplication(row.pgrAppliedAt, row.writtenAt);
            if (days === null || days <= 0) return false;

            return days > PGR.historyWindowDays;
        },
        why: 'a row whose site had a PGR application strictly BEFORE it, older than the engine\'s window;'
            + ' an application of the row\'s own day or later leaves it open, because the route gives no time',
    },
    {
        producer: 'cascade', door: 'notApplicable', module: '<engine>', reason: '-',
        kind: 'with-condition',
        // The gate refuses a node whose sample the run was told it does not have.
        when: (row) => /"(soil|water|tissue)":\s*"none"/.test(row.named || ''),
        why: 'a run told it has no sample of some kind, which is what the gate refuses a node for',
    },
    {
        producer: 'cascade', door: 'note', module: 'mlsn', reason: 'soil-sample-not-in-store',
        kind: 'with-condition',
        // THE PASS'S OWN ANSWER, not a second surface: `gaip_passSampleIds` reads `soil:not-found` when the
        // run was named a sample the store does not hold, and the row carries that string.
        when: (row) => /soil:not-found/.test(row.cascadeSampleIds || ''),
        why: 'the pass itself read `soil:not-found` - the run was named a soil sample the store did not hold',
    },
    {
        producer: 'cascade', door: 'noteSkipped', module: 'mlsn', reason: 'soil-sample-not-loaded',
        kind: 'with-condition',
        when: (row) => /soil:not-found/.test(row.cascadeSampleIds || ''),
        why: 'the same event as the note above: the two are written together',
    },
    /**
     * GH-795 (queue item 3vae) — FIVE WRITERS OF THE PASS ABOUT THE SAMPLE IT WAS GIVEN.
     *
     * The condition of the two `sample-not-named` entries is READABLE IN A ROW, and by the server's own
     * record of what the opener was told: `runStart.named.<kind>` is the string `unknown`. Measured before
     * the change: that value stands in 0 of 132 rows, so these two are expected-and-absent rather than
     * expected-and-present -- which is what a condition is for.
     *
     * The three tissue entries mirror the soil ones exactly, including the boundary: "named and not in the
     * store" has a sign in the row (`tissue:not-found` in the pass's own fingerprint), and "arrived and
     * carried nothing readable" has none, so it stays open here and is checked by a case on the store's door.
     */
    {
        producer: 'cascade', door: 'noteSkipped', module: 'mlsn', reason: 'sample-not-named',
        kind: 'with-condition',
        when: (row) => /"soil":\s*"unknown"/.test(row.named || ''),
        why: 'the run asked the server which soil sample to compute and the request failed, so the address'
            + ' carried `unknown` and the pass computed no soil',
    },
    {
        producer: 'cascade', door: 'noteSkipped', module: 'tissue', reason: 'sample-not-named',
        kind: 'with-condition',
        when: (row) => /"tissue":\s*"unknown"/.test(row.named || ''),
        why: 'the same failure on the tissue side, told by the same record of what the opener was given',
    },
    {
        producer: 'cascade', door: 'note', module: 'tissue', reason: 'tissue-sample-not-in-store',
        kind: 'with-condition',
        when: (row) => /tissue:not-found/.test(row.cascadeSampleIds || ''),
        why: 'the pass itself read `tissue:not-found` - the run was named a tissue sample the store did not'
            + ' hold',
    },
    {
        producer: 'cascade', door: 'noteSkipped', module: 'tissue', reason: 'tissue-sample-not-loaded',
        kind: 'with-condition',
        when: (row) => /tissue:not-found/.test(row.cascadeSampleIds || ''),
        why: 'the same event as the note above: the two are written together',
    },
    {
        producer: 'cascade', door: 'note', module: 'tissue', reason: 'tissue-sample-unreadable',
        kind: 'no-condition',
        why: 'the tissue twin of `soil-sample-unreadable`, and open for the same reason: a sample that'
            + ' arrived carrying no reading the map knows leaves no product-side sign in a row',
    },
    {
        producer: 'cascade', door: 'note', module: 'mlsn', reason: 'soil-sample-unreadable',
        kind: 'no-condition',
        why: 'the analyst withdrew the condition she first wrote for it, having recognised a second surface in'
            + ' it: this branch - the sample arrived and nothing in it is a reading the map knows - has no'
            + ' product-side sign in a row at all. It is checked by a case on the store\'s own door, and is'
            + ' open here, never green',
    },
    {
        producer: 'cascade', door: 'recordProblem', module: 'cascade', reason: '-',
        kind: 'no-condition',
        why: 'an engine of the cascade threw. Nothing in a row says whether an engine was ABOUT to throw,'
            + ' so there is no condition to compute; a row that carries it is the measurement',
    },
    {
        producer: 'cascade', door: 'noteSkipped', module: '<engine>', reason: 'engine-produced-nothing',
        kind: 'guard',
        why: 'what a DEFECT produces. A live input for it must not exist, so its case plants the fault;'
            + ' a row carrying it is a FINDING, not a pass',
    },
];

/**
 * GH-788 (queue item 3gd) — `--raw`, BECAUSE THE DEFAULT OUTPUT ESCAPES WHAT THIS FILE PARSES.
 *
 * Without it the client escapes backslashes in the values it prints, so a journal entry whose `data` is itself a
 * JSON string came back as `{\\"reason\\":...}` and `JSON.parse` threw. The reader caught the throw, set the
 * entries to null, and the row was filed as NOT COUNTED — so the reconciliation reported itself unfilled while
 * the rows it needed were sitting in the table. Measured: with `--raw` the same row parses into 5 entries, every
 * one of them carrying a door.
 */
function query(sql) {
    return execFileSync('docker', ['exec', 'gilba_mysql', 'mysql', '-ugilba', '-pgilba_secret',
        'gilba', '-N', '--raw', '-e', sql], { encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] })
        .split('\n').map((l) => l.trim()).filter((l) => l);
}

/** The census FROM THE CODE: every call of an outside door, with what it names. */
function censusFromTheCode() {
    const out = [];
    ['hub-tissue-v3.js', 'cascade-orchestrator.js', 'hub-persistence.js', 'hub-orchestrator.js']
        .forEach((file) => {
            const src = codeOf(fs.readFileSync(path.join(ASSETS, file), 'utf8'), file);
            // The window is wide enough for the longest call in the tree -- the PGR note, whose data
            // object runs over twenty lines. Measured: at 400 characters it was missed, and the census
            // said five writers where the code has six. A census that quietly loses a writer is the
            // fault this file exists against.
            const re = /(?:GaipOrchestrator|pass)\s*\.\s*(recordProblem|noteSkipped|notApplicable|note)\s*\(([^;]{0,2000}?)\)\s*;/g;
            let m = re.exec(src);
            while (m) {
                const door = m[1];
                const args = m[2].replace(/\s+/g, ' ');
                const first = /^\s*["']([^"']+)["']/.exec(args);
                /**
                 * GH-781 (delivery 7, the reviewer's third finding) - THE FOURTH FIELD OF THE IDENTITY.
                 *
                 * It was declared as four (producer, door, module, reason) and built as three, so the two
                 * branches of GH-612 - both `cascade | note | mlsn` - were one writer in the registry and one
                 * of them could go unnoticed. `noteSkipped` carries its reason as the third argument; a note
                 * carries it in its data; `notApplicable` and `recordProblem` have none, and say so.
                 */
                const reasonInData = /reason\s*:\s*(?:["']([^"']+)["']|[^,}]*\?\s*["']([^"']+)["']\s*:\s*["']([^"']+)["'])/.exec(args);
                // The third argument of `noteSkipped`, whatever the first two are: on one call they are a
                // variable (`module, module, 'engine-produced-nothing'`), and a pattern written for literals
                // read no reason at all there and called it '-'.
                const thirdArg = (function () {
                    let depth = 0;
                    const parts = [''];
                    for (let i = 0; i < args.length; i += 1) {
                        const ch = args[i];
                        if ('([{'.indexOf(ch) >= 0) depth += 1;
                        else if (')]}'.indexOf(ch) >= 0) depth -= 1;
                        if (ch === ',' && depth === 0) { parts.push(''); continue; }
                        parts[parts.length - 1] += ch;
                    }
                    const third = (parts[2] || '').trim();
                    const lit = /^["']([^"']+)["']$/.exec(third);

                    return lit ? [null, lit[1]] : null;
                })();
                const reasons = door === 'noteSkipped' ? (thirdArg ? [thirdArg[1]] : ['-'])
                    : (reasonInData
                        ? [reasonInData[1], reasonInData[2], reasonInData[3]].filter((v) => v)
                        : ['-']);
                const producer = /PRODUCER\b/.test(args) ? 'cascade'
                    : (/["']cascade["']\s*\)?\s*$/.test(args) ? 'cascade' : null);
                // One entry per REASON: a call with two branches is two writers, which is the point.
                reasons.forEach((reason) => out.push({
                    file: file,
                    door: door,
                    module: first ? first[1] : '<engine>',
                    reason: reason,
                    producer: producer || 'cascade',
                    at: src.slice(0, m.index).split('\n').length,
                }));
                m = re.exec(src);
            }
        });

    return out;
}

/**
 * HOW MANY WRITERS THE CODE HAS, counted independently of the parse above.
 *
 * The census is a regular expression over source, and a regular expression can lose a call silently -- it did,
 * on the longest one. So the number of call sites is counted a second way, by the door names alone, and the
 * two must agree. A census that finds fewer writers than the tree has would pass every verdict below.
 */
function howManyCallsTheCodeHas() {
    let n = 0;
    ['hub-tissue-v3.js', 'cascade-orchestrator.js', 'hub-persistence.js', 'hub-orchestrator.js']
        .forEach((file) => {
            const src = codeOf(fs.readFileSync(path.join(ASSETS, file), 'utf8'), file);
            const m = src.match(/(?:GaipOrchestrator|pass)\s*\.\s*(?:recordProblem|noteSkipped|notApplicable|note)\s*\(/g);
            n += m ? m.length : 0;
        });

    return n;
}

/**
 * THE IDENTITY OF A WRITER, extracted from records IN THE FORM A ROW HOLDS THEM.
 *
 * Lifted out so it can be run over real records and not only over strings written in a test: in a stored row
 * `data` is a JSON STRING (the journal summarises it that way), and the reason of a note lives inside it. That
 * parse is the only path to the identity of the PGR note, and until this was exercised on real records nothing
 * held it - break the parse and that writer would be missing from the registry, reddening a healthy product.
 */
function identitiesOf(entries) {
    return entries.map((e) => {
        let reason = e.reason || '-';
        if (reason === '-' && typeof e.data === 'string') {
            try { reason = (JSON.parse(e.data) || {}).reason || '-'; } catch (x) { reason = '-'; }
        }

        return e.producer + '|' + e.door + '|' + e.module + '|' + reason;
    });
}

/** The registry FROM THE STAND: only rows that can vouch for a writer, and what they vouch for. */
function registryFromTheStand() {
    const rows = query(
        "SELECT CONCAT_WS('|', ar.id, "
        + "CASE WHEN JSON_EXTRACT(ar.detail,'$.journal') IS NULL THEN 'no-journal' ELSE 'journal' END, "
        + "COALESCE(JSON_EXTRACT(ar.detail,'$.warnings'),'[]'), "
        + "COALESCE(JSON_EXTRACT(ar.detail,'$.skipped'),'[]'), "
        + "COALESCE(JSON_EXTRACT(ar.detail,'$.notApplicable'),'[]'), "
        // What the CONDITIONS ask about, from the same row and the same base: which samples the run was
        // named, whether the soil block came out, and how old this site's last PGR application is.
        + "REPLACE(COALESCE(JSON_EXTRACT(ar.detail,'$.runStart.named'),'{}'),'|','!'), "
        + "CASE WHEN JSON_TYPE(JSON_EXTRACT(ar.computed,'$.soilNutrition.tissue')) NOT IN ('NULL') "
        + "  THEN 'yes' ELSE 'no' END, "
        + "COALESCE((SELECT MAX(sl.event_date) FROM spray_logs sl "
        + "  WHERE sl.site_id = ar.site_id AND sl.product_type = 'pgr'), ''), "
        + "COALESCE(JSON_UNQUOTE(JSON_EXTRACT(ar.detail,'$.journal.cascadeSampleIds')),''), "
        + "ar.created_at) "
        + "FROM analysis_results ar ORDER BY ar.id");
    const eligible = [];
    const notCounted = [];
    rows.forEach((line) => {
        const cut = line.split('|');
        const id = cut[0];
        const hasJournal = cut[1] === 'journal';
        /**
         * GH-788 (queue item 3gd) — THE JOURNAL IS `warnings` AND `skipped`, and `detail.notApplicable` is not
         * part of it.
         *
         * That third array is the SERVER's judgement (GH-675): each entry names a module and the inputs whose
         * absence made it inapplicable, and it carries no `door` because no door wrote it. Counting it as a
         * journal entry made `everyDoor` false for every row that has one — and on the stand that is every row
         * with a salinity gap — so the registry stayed empty and the reconciliation reported itself unfilled
         * even after the marks reached the rows. Measured on the first row to carry a journal: 5 entries in
         * `warnings`, all with a door, 0 in `skipped`, and 2 in `notApplicable` with none.
         *
         * The journal's own `notApplicable` door is not lost by this: the pass writes it into `warnings`, where
         * it is counted — row 132 carries `door: "notApplicable"` there.
         */
        let entries = [];
        try {
            entries = [].concat(JSON.parse(cut[2]), JSON.parse(cut[3]));
        } catch (e) {
            entries = null;
        }
        const everyDoor = Array.isArray(entries) && entries.length > 0
            && entries.every((e) => e && typeof e.door === 'string' && e.door);
        const context = {
            id: id,
            named: (cut[5] || '{}').replace(/!/g, '|'),
            soilInRow: cut[6] || 'no',
            // The LAST application of this site and WHEN THIS ROW WAS WRITTEN: the age between them is the
            // engine's to compute, not this query's.
            pgrAppliedAt: cut[7] || null,
            cascadeSampleIds: cut[8] || '',
            writtenAt: cut[9] || null,
        };
        if (hasJournal && (everyDoor || (Array.isArray(entries) && entries.length === 0))) {
            eligible.push({ id: id, context: context, seen: identitiesOf(entries || []) });
        } else {
            notCounted.push(id);
        }
    });

    return { eligible, notCounted };
}

/**
 * THE VERDICTS, as a function, so that they have a case of their own.
 *
 * The registry of a live stand is empty until a run stores a row with doors on it, and unexercised judgement
 * inside a test is the same fault this file was written against: a green that never reached its subject. The
 * three states are therefore measured below on fixtures as well as on the stand.
 */
function verdictsFor(censusIn, eligible, total) {
    const seen = {};
    const seenIn = {};
    eligible.forEach((r) => r.seen.forEach((k) => {
        seen[k] = (seen[k] || 0) + 1;
        (seenIn[k] = seenIn[k] || []).push(r.id);
    }));
    const byKey = {};
    DECLARED.forEach((d) => { byKey[d.producer + '|' + d.door + '|' + d.module + '|' + d.reason] = d; });

    return censusIn.map((c) => {
        const key = c.producer + '|' + c.door + '|' + c.module + '|' + c.reason;
        const met = seen[key] || 0;
        const decl = byKey[key];
        if (!decl) return { writer: key, state: 'RED', say: 'not in the list of writers at all' };
        if (decl.kind === 'guard') {
            return met
                ? { writer: key, state: 'RED',
                    say: 'a GUARD appeared in ' + met + ' row(s) (' + seenIn[key].join(', ')
                        + ') - that is a finding about the product, not a pass' }
                : { writer: key, state: 'OPEN', say: 'guard, and no row carries it, which is right' };
        }
        if (decl.kind === 'no-condition') {
            return { writer: key, state: met ? 'GREEN' : 'OPEN',
                say: met ? 'no condition to compute, and met in ' + met + ' of ' + total
                    : 'no condition over rows: ' + decl.why };
        }
        const expectedIn = eligible.filter((r) => {
            try { return !!decl.when(r.context); } catch (e) { return false; }
        }).map((r) => r.id);
        if (!expectedIn.length) {
            return { writer: key, state: 'OPEN',
                say: 'its condition did not occur in any of ' + total + ' rows (' + decl.why + ')' };
        }
        if (met) return { writer: key, state: 'GREEN', say: 'expected in ' + expectedIn.length + ', present in ' + met };

        return { writer: key, state: 'RED',
            say: 'expected in ' + expectedIn.length + ' row(s) (' + expectedIn.join(', ')
                + ') and present in none' };
    });
}

const stand = registryFromTheStand();
const census = censusFromTheCode();
const callsInTheCode = howManyCallsTheCodeHas();
const N = stand.eligible.length;

if (!N) {
    /**
     * NOT FILLED, and therefore NOT PASSED. The reason is in the name so that the run's summary carries it:
     * a suite that went green here would say "every writer is accounted for" having looked at no row at all.
     */
    test.skip('RECONCILIATION NOT FILLED: 0 of ' + (stand.notCounted.length + N)
        + ' stored rows carry `detail.journal` with a door on every entry — needs one live run after'
        + ' delivery 7; ' + census.length + ' of ' + callsInTheCode
        + ' writers parsed from the code', () => {});
    process.stdout.write('\n[gh781] reconciliation NOT FILLED: eligible rows 0 of '
        + (stand.notCounted.length + N) + '\n[gh781] writers in the census from the code (' + census.length + '):\n'
        + census.map((c) => '[gh781]   ' + c.producer + ' | ' + c.door + ' | ' + c.module + ' | ' + c.reason
            + '   <- ' + c.file + ':' + c.at).join('\n')
        + '\n[gh781] declared exceptions (' + DECLARED.length + '):\n'
        + DECLARED.map((d) => '[gh781]   ' + d.producer + ' | ' + d.door + ' | ' + d.module + ' | ' + d.reason
            + ' — ' + d.kind + ': ' + d.why).join('\n') + '\n');
} else {
    describe('GH-781 delivery 7 — every journal writer is met in a row or declared', () => {
        test('every writer: expected and present, expected and absent, or its condition never occurred', () => {
            /**
             * GH-781 (delivery 7, the analyst's amendment (11)) - THE VERDICT IS ABOUT AN EVENT, NOT A WRITER.
             *
             * "Not met, therefore red" was the wrong shape: a writer whose input never occurred would redden a
             * healthy product, which the reviewer measured. So each writer declares the CONDITION under which
             * it must write, checked against the same rows and the same base, and the verdict is one of three:
             *   - expected and present: printed as n of n;
             *   - expected and ABSENT: red, with the rows named. This is the class of GH-649;
             *   - the condition never occurred: OPEN - neither green nor red - printed with its number.
             * A writer with no computable condition is declared so, with its reason, and is always open. A
             * guard that appears in a row is a FINDING. A writer absent from this list at all is red.
             */
            const verdicts = verdictsFor(census, stand.eligible, N);
            const red = verdicts.filter((v) => v.state === 'RED');
            const open = verdicts.filter((v) => v.state === 'OPEN');
            process.stdout.write('\n[gh781] eligible rows: ' + N + ' \u00b7 not counted (no journal or no door): '
                + stand.notCounted.length + '\n'
                + verdicts.map((v) => '[gh781]   ' + v.state + '  ' + v.writer + ' - ' + v.say).join('\n')
                + '\n[gh781] checked ' + verdicts.length + ' / red ' + red.length
                + ' / open ' + open.length + '\n');

            // The LIST of red verdicts, by name: the test passes only without them, and the open ones are
            // printed rather than counted away.
            expect(red.map((v) => v.writer + ': ' + v.say)).toEqual([]);
            /**
             * And the census did not LOSE a call on the way. Compared by CALL SITES, not by entries: one call
             * with two branches is two writers by design, so the two numbers differ on purpose.
             */
            const sites = census.map((c) => c.file + ':' + c.at).filter((v, i, a2) => a2.indexOf(v) === i);
            expect(sites.length).toBe(callsInTheCode);
        });
    });
}

/**
 * THE THREE STATES, on fixtures, so the judgement above is exercised whatever the stand holds today.
 */
describe('GH-781 delivery 7 — the three states of a verdict', () => {
    const W = (door, module, reason) => ({ file: 'x.js', at: 1, producer: 'cascade', door, module, reason });
    const row = (id, context, seen) => ({ id, context, seen });

    test('expected and present is GREEN, expected and absent is RED, never-occurred is OPEN', () => {
        const census = [
            W('note', 'pgr', 'pgr-window-exhausted'),
            W('noteSkipped', 'mlsn', 'soil-sample-not-loaded'),
            W('notApplicable', '<engine>', '-'),
        ];
        const rows = [
            // its condition occurred AND it wrote
            row('1', { named: '{"soil": "141"}', cascadeSampleIds: 'soil:141|pgr:log_3',
                pgrAppliedAt: '2026-06-16', writtenAt: '2026-09-30 12:00:00' },
                ['cascade|note|pgr|pgr-window-exhausted']),
            // its condition occurred and it did NOT write: the pass read `soil:not-found` and said nothing
            row('2', { named: '{"soil": "141"}', cascadeSampleIds: 'soil:not-found|pgr:none',
                pgrAppliedAt: '2026-09-25', writtenAt: '2026-09-30 12:00:00' }, []),
        ];
        const v = verdictsFor(census, rows, rows.length);
        const by = {};
        v.forEach((x) => { by[x.writer.split('|')[1] + '/' + x.writer.split('|')[3]] = x; });
        process.stdout.write('\n[gh781] fixtures: '
            + v.map((x) => x.state + ' ' + x.writer.split('|').slice(1).join('|')).join(' \u00b7 ') + '\n');

        expect(by['note/pgr-window-exhausted'].state).toBe('GREEN');
        // Its event happened in row 1 (a named soil sample with no soil in the row) and nobody wrote.
        expect(by['noteSkipped/soil-sample-not-loaded'].state).toBe('RED');
        expect(by['noteSkipped/soil-sample-not-loaded'].say).toContain('present in none');
        // No row was told it has no sample of a kind, so this one's event never occurred.
        expect(by['notApplicable/-'].state).toBe('OPEN');
    });

    test('THE REASON IS GUARDED FROM THE ROW\'S SIDE TOO: a record without it does not answer for one', () => {
        /**
         * GH-781 (second return, the reviewer's second finding) - the fourth field of the identity reddened only
         * from the census side. From the ROW's side nothing held it: a record that stopped carrying its reason
         * would key as `-`, and a writer declared with a reason would then read as if nothing had changed.
         *
         * WHAT THIS HOLDS: a row entry with no reason does NOT answer for a writer whose reason is declared -
         * its condition occurred, nobody wrote what was expected, and the verdict is red. And the row's own
         * unkeyed entry is not silently credited to some other writer either.
         */
        const rows = [row('7', {
            named: '{"soil": "141"}', cascadeSampleIds: 'soil:not-found|pgr:none',
            pgrAppliedAt: null, writtenAt: '2026-09-30 12:00:00',
        }, [
            // the same producer, door and module as the declared writer -- and no reason
            'cascade|note|mlsn|-',
            'cascade|noteSkipped|mlsn|-',
        ])];
        const v = verdictsFor([
            W('note', 'mlsn', 'soil-sample-not-in-store'),
            W('noteSkipped', 'mlsn', 'soil-sample-not-loaded'),
        ], rows, rows.length);
        process.stdout.write('[gh781] fixtures: '
            + v.map((x) => x.state + ' ' + x.writer.split('|').slice(1).join('|')).join(' \u00b7 ') + '\n');

        // Both expected by their condition (`soil:not-found` in the row) and neither answered for.
        expect(v.map((x) => x.state)).toEqual(['RED', 'RED']);
        v.forEach((x) => expect(x.say).toContain('present in none'));
    });

    test('a guard in a row is a finding, and a writer absent from the list is RED', () => {
        const rows = [row('9', { named: '{}', cascadeSampleIds: 'soil:141', pgrAppliedAt: null,
            writtenAt: '2026-09-30 12:00:00' }, ['cascade|noteSkipped|<engine>|engine-produced-nothing'])];
        const v = verdictsFor([
            W('noteSkipped', '<engine>', 'engine-produced-nothing'),
            W('note', 'brand-new', 'nobody-declared-me'),
        ], rows, rows.length);
        process.stdout.write('[gh781] fixtures: '
            + v.map((x) => x.state + ' ' + x.writer.split('|').slice(1).join('|')).join(' \u00b7 ') + '\n');

        expect(v[0].state).toBe('RED');
        expect(v[0].say).toContain('finding about the product');
        expect(v[1].state).toBe('RED');
        expect(v[1].say).toContain('not in the list');
    });
});

/**
 * THE IDENTITIES, TAKEN FROM RECORDS THE PRODUCT ACTUALLY WROTE.
 *
 * The cases above feed ready-made identity strings, so the place where an identity is EXTRACTED from a record
 * was never exercised - and that place holds the only path to the PGR note's identity, a reason parsed out of
 * `data` as a JSON string. The reviewer's mutation for it: break that parse, and the note must go missing from
 * the registry rather than the suite staying green.
 *
 * The writes here go through the product's own doors, on the inputs that cause them: an application older than
 * the engine's window, a named soil sample the store does not hold, and a gate with no tissue sample.
 */
describe('GH-781 delivery 7 — an identity read off records the product wrote', () => {
    jest.setTimeout(300000);

    test('the census from the code finds every identity the product\'s own records carry', () => {
        const { load, withSamples } = require('./lib/orchestrator-bench');
        const bench = load();
        expect(bench.failed).toEqual([]);
        const ctx = bench.ctx;
        // Named a soil sample the store does not hold, no tissue at all, and an application past the window.
        ctx.location.search = '?rerun=r1&site=site-1&soil=103&water=none&tissue=none';
        ctx.GAIP_HUB_CONFIG = Object.assign({}, ctx.GAIP_HUB_CONFIG, { activeSiteId: 'site-1' });
        ctx.GAIP_LAST_PGR = { log_id: 3, site_id: 'site-1', application_date: '2026-06-16',
            product_name: 'Primo 250EC', product_key: 'TE250', rate: 0.4 };
        withSamples(bench, {});
        ctx.gaip_runCascadePass('run-button',
            { querySelector: () => null, querySelectorAll: () => [] }, { current: { airTemp: 18 } }, null);

        // THE RECORDS AS A ROW WOULD HOLD THEM: through a serialisation, so `data` is a string, not an object.
        const computed = ctx.GaipOrchestrator.getState().computed;
        const asARowHoldsThem = JSON.parse(JSON.stringify(
            [].concat(computed.warnings || [], computed.skipped || [], computed.notApplicable || [])));
        const dataShapes = asARowHoldsThem.filter((e) => e.data !== null && e.data !== undefined)
            .map((e) => typeof e.data);
        const all = identitiesOf(asARowHoldsThem).filter((v, i, a) => a.indexOf(v) === i);
        /**
         * INTERNAL WRITES ARE NOT IN THE CENSUS BY DESIGN, and they are printed rather than dropped quietly:
         * the census walks the OUTSIDE doors, which is the whole point of the `door` field. An internal record
         * has no call to find in `assets` and belongs to the pass that wrote it.
         */
        const internal = all.filter((k) => k.split('|')[1] === 'internal');
        const identities = all.filter((k) => k.split('|')[1] !== 'internal');
        const fromTheCode = censusFromTheCode()
            .map((c) => c.producer + '|' + c.door + '|' + c.module + '|' + c.reason);

        // Which of the product's identities the census knows, and which it does not.
        const dynamic = /\|<engine>\|/;
        const unknown = identities.filter((k) => {
            if (fromTheCode.indexOf(k) >= 0) return false;
            const cut = k.split('|');
            // The census writes `<engine>` where the product puts the node's own module at run time.
            return !fromTheCode.some((c) => dynamic.test(c)
                && c.split('|')[1] === cut[1] && c.split('|')[3] === cut[3]);
        });

        process.stdout.write('\n[gh781] `data` as a row holds it: ' + JSON.stringify(dataShapes)
            + '\n[gh781] identities the product wrote (' + identities.length + '):\n'
            + identities.map((k) => '[gh781]   ' + k).join('\n')
            + '\n[gh781] internal writes, not in the census by design: ' + JSON.stringify(internal)
            + '\n[gh781] not found in the census from the code: ' + JSON.stringify(unknown) + '\n');

        // POSITIVE CONTROL: the records really did come through a serialisation, so the parse is exercised.
        expect(dataShapes).toContain('string');
        // The PGR note's identity is the one that comes out of that string, and it is here.
        expect(identities).toContain('cascade|note|pgr|pgr-window-exhausted');
        // And every identity the product wrote is one the census from the code knows.
        expect(unknown).toEqual([]);
    });
});

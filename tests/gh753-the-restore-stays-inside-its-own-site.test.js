/**
 * GH-753 (queue item 3yu) — A LIVE TEST'S RESTORE PUTS BACK WHAT IT WROTE, AND NOTHING ELSE.
 *
 * WHY THIS EXISTS, measured rather than supposed. Eight live tests write to the stand and put it
 * back afterwards. The restore they shared took a snapshot of `site_configs` with no condition on
 * the site at all, and then, for every row whose bytes had moved, wrote the old bytes AND the old
 * `updated_at` back. So an edit made in Settings by a person while a run was going lost both its
 * content and its trace; and `analysis_results` was returned by `DELETE ... WHERE id > <snapshot>`,
 * which removes whatever appeared after the snapshot, whoever produced it.
 *
 * THE NARROWING: the restore is given the sites the test owns, it touches only the keys a Generate
 * press writes, and `updated_at` is not in the statement. A row of another site that moved is
 * REPORTED and left where it is; a key outside the list that moved on the test's own site is
 * reported too, because a list of keys goes stale the day someone writes a sixth.
 *
 * NO STAND IS TOUCHED HERE. The statements are built by the same function the live restore runs,
 * and are read rather than executed — which is the reviewer's condition on this item: a set with a
 * stand-in database proves the statement it was given, so the text has to be THE SAME text.
 */

'use strict';

const fs = require('fs');
const path = require('path');
const { restoreStatements, restoreConfigs, PROGRAMME_KEYS } = require('./e2e/lib/stand-guard');

const b64 = (o) => Buffer.from(JSON.stringify(o), 'utf8').toString('base64');
const md5 = (o) => require('crypto').createHash('md5').update(JSON.stringify(o)).digest('hex');

const MINE = 'site-mine';
const THEIRS = 'site-theirs';

/** A configuration before a run, and the same one after it, as the two queries return them. */
function rows(before, after) {
    const captured = {};
    const now = {};
    Object.keys(before).forEach((site) => {
        captured[site + '~gaip'] = { site: site, ns: 'gaip', md5: md5(before[site]),
            updated: '1758000000', b64: b64(before[site]) };
    });
    Object.keys(after).forEach((site) => {
        now[site + '~gaip'] = { md5: md5(after[site]), b64: b64(after[site]) };
    });

    return { captured, now };
}

describe('GH-753 — the restore stays inside its own site and its own keys', () => {
    test('POSITIVE CONTROL: a programme key the run wrote is put back, by a statement that names it', () => {
        const { captured, now } = rows(
            { [MINE]: { turf: { nProgram: 120 }, nutritionCalendarProgram: { was: 'the old one' } } },
            { [MINE]: { turf: { nProgram: 120 }, nutritionCalendarProgram: { now: 'what the press wrote' } } });
        const plan = restoreStatements(captured, now, [MINE]);
        process.stdout.write('\n[gh753] own: ' + JSON.stringify(plan.own.map((o) => o.keysPutBack))
            + ' | foreign: ' + JSON.stringify(plan.foreign)
            + ' | unlisted: ' + JSON.stringify(plan.unlisted) + '\n[gh753] sql: ' + plan.own[0].sql + '\n');

        expect(plan.own).toHaveLength(1);
        expect(plan.own[0].keysPutBack).toEqual(['nutritionCalendarProgram']);
        expect(plan.own[0].sql).toContain("WHERE site_id='" + MINE + "'");
        expect(plan.own[0].sql).toContain('JSON_SET(config');
    });

    test('`updated_at` is not in the statement — the row keeps the time of whoever wrote it last', () => {
        const { captured, now } = rows(
            { [MINE]: { nutritionProgram: { a: 1 } } },
            { [MINE]: { nutritionProgram: { a: 2 } } });
        const plan = restoreStatements(captured, now, [MINE]);
        process.stdout.write('[gh753] statement: ' + plan.own[0].sql + '\n');

        expect(plan.own[0].sql).not.toMatch(/updated_at/);
        expect(plan.own[0].sql).not.toMatch(/FROM_UNIXTIME/);
    });

    test('ANOTHER SITE that changed during the run is reported and never written to', () => {
        // The case the item is about: someone edits Settings on another site while a run is going.
        const { captured, now } = rows(
            { [MINE]: { nutritionProgram: { a: 1 } }, [THEIRS]: { turf: { nProgram: 100 } } },
            { [MINE]: { nutritionProgram: { a: 2 } }, [THEIRS]: { turf: { nProgram: 250 } } });
        const plan = restoreStatements(captured, now, [MINE]);
        process.stdout.write('[gh753] foreign rows: ' + JSON.stringify(plan.foreign) + '\n');

        expect(plan.foreign.map((f) => f.key)).toEqual([THEIRS + '~gaip']);
        expect(plan.own.map((o) => o.site)).toEqual([MINE]);
        // Not "it is not in the plan" — its id appears in no statement at all.
        plan.own.forEach((o) => expect(o.sql).not.toContain(THEIRS));
    });

    test('a key OUTSIDE the list that moved on the run’s own site is reported and left alone', () => {
        // The list of five keys is read off the write paths, and a sixth writer would make it
        // wrong. This is how that shows up in the output of the very next run instead of silently.
        const { captured, now } = rows(
            { [MINE]: { nutritionProgram: { a: 1 }, turf: { nProgram: 120 } } },
            { [MINE]: { nutritionProgram: { a: 2 }, turf: { nProgram: 999 } } });
        const plan = restoreStatements(captured, now, [MINE]);
        process.stdout.write('[gh753] keys outside the list: ' + JSON.stringify(plan.unlisted)
            + ' | sql: ' + plan.own[0].sql + '\n');

        expect(plan.unlisted).toEqual([{ key: MINE + '~gaip', jsonKey: 'turf' }]);
        expect(plan.own[0].keysPutBack).toEqual(['nutritionProgram']);
        expect(plan.own[0].sql).not.toContain('turf');
    });

    test('a programme key the run CREATED is removed, not set to a value it never had', () => {
        const { captured, now } = rows(
            { [MINE]: { turf: { nProgram: 120 } } },
            { [MINE]: { turf: { nProgram: 120 }, nutritionProgramCoords: { lat: 1, lon: 2 } } });
        const plan = restoreStatements(captured, now, [MINE]);
        process.stdout.write('[gh753] created-key statement: ' + plan.own[0].sql + '\n');

        expect(plan.own[0].keysPutBack).toEqual(['nutritionProgramCoords']);
        expect(plan.own[0].sql).toContain('JSON_REMOVE(config');
    });

    test('a row that did not move produces no statement at all', () => {
        const same = { [MINE]: { nutritionProgram: { a: 1 } } };
        const { captured, now } = rows(same, same);
        const plan = restoreStatements(captured, now, [MINE]);

        expect(plan.own).toEqual([]);
        expect(plan.foreign).toEqual([]);
    });

    test('the server\u2019s own `savedAt` is neither put back nor reported as a stray key', () => {
        /**
         * GH-753, the reviewer's return, position 1. `SiteController::patchConfig` stamps `savedAt`
         * into the config on every PATCH, which is the path a Generate press writes by. It is the
         * server's value, not the run's, so the restore does not put it back — and must not cry
         * about it either, or every live run would report a stray key it can do nothing about.
         */
        const { captured, now } = rows(
            { [MINE]: { nutritionProgram: { a: 1 }, savedAt: '2026-09-24T00:55:40.541228Z' } },
            { [MINE]: { nutritionProgram: { a: 2 }, savedAt: '2026-09-25T06:20:00.000000Z' } });
        const plan = restoreStatements(captured, now, [MINE]);
        process.stdout.write('[gh753] with savedAt moved — unlisted: ' + JSON.stringify(plan.unlisted)
            + ' | sql: ' + plan.own[0].sql + '\n');

        expect(plan.unlisted).toEqual([]);
        expect(plan.own[0].sql).not.toContain('savedAt');
        expect(plan.own[0].keysPutBack).toEqual(['nutritionProgram']);
    });

    test('a test that writes outside the five says so, and that key is then put back too', () => {
        // Position 2: gh394 writes `traffic` as the very thing it is about, so the control site kept
        // a schedule after every run. A key named by the caller is owned; one that is not, is not.
        const before = { [MINE]: { traffic: { schedule: { rootDepth: 100 } } } };
        const after = { [MINE]: { traffic: { schedule: { rootDepth: 250 } } } };
        const bare = restoreStatements(rows(before, after).captured, rows(before, after).now, [MINE]);
        const named = restoreStatements(rows(before, after).captured, rows(before, after).now, [MINE],
            PROGRAMME_KEYS.concat(['traffic']));
        process.stdout.write('[gh753] traffic, not named: ' + JSON.stringify(bare.own.length)
            + ' statement(s), unlisted ' + JSON.stringify(bare.unlisted.map((u) => u.jsonKey))
            + ' | named: ' + JSON.stringify(named.own.map((o) => o.keysPutBack)) + '\n');

        expect(bare.own).toEqual([]);
        expect(bare.unlisted.map((u) => u.jsonKey)).toEqual(['traffic']);
        expect(named.own[0].keysPutBack).toEqual(['traffic']);
        expect(named.keys).toContain('traffic');
    });

    test('the demand for `sites` is refused by the module itself, with no stand and no snapshot', () => {
        /**
         * Position 4, and it is the analyst's own mutation: she took the demand out and this set
         * stayed green, because no case called `restoreConfigs` at all — the whole set read the
         * builder. So the demand is exercised here, and it is checked BEFORE the capture is looked
         * at, which is what lets it be checked without a database.
         */
        let threw = null;
        try { restoreConfigs({}); } catch (e) { threw = e; }
        process.stdout.write('[gh753] restoreConfigs({}) threw: ' + (threw && threw.message.slice(0, 80)) + '\n');

        expect(threw).not.toBeNull();
        expect(threw.message).toMatch(/needs the ids of the sites/);
        // And with sites named but nothing captured it does NOT throw — the refusal is about the
        // missing sites, not about being called early.
        expect(() => restoreConfigs({ sites: ['site-mine'] })).not.toThrow();
    });

    test('the run rows deleted are this run\u2019s own sites, not every row above the snapshot', () => {
        /**
         * Position 3. `restoreAnalysisRuns` removed everything that appeared after the snapshot, of
         * any site and any author — a run the owner started in that window went with it. It needs a
         * database to execute, so what is read here is the statement it would run: there is exactly
         * one delete of that table in the module, and it is narrowed by site.
         */
        const src = fs.readFileSync(path.join(__dirname, 'e2e', 'lib', 'stand-guard.js'), 'utf8');
        const code = src.replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '');
        const deletes = code.match(/DELETE FROM analysis_results[^;]*/g) || [];
        process.stdout.write('[gh753] deletes of analysis_results: ' + JSON.stringify(deletes) + '\n');

        expect(deletes).toHaveLength(1);
        expect(deletes[0]).toContain('site_id IN');
        // And the count it reports afterwards is counted the same way, or "nothing left" would be
        // a statement about every site rather than about this run's.
        expect(code).toMatch(/SELECT COUNT\(\*\) FROM analysis_results WHERE id > ' \+ before[\s\S]{0,120}site_id IN/);
    });

    test('the live restore runs THIS text and has no UPDATE of its own — the reviewer’s condition', () => {
        /**
         * A set with a stand-in database proves the statement it was handed. If the live path built
         * its own SQL, this would prove a statement the stand never sees. So: exactly one place in
         * the module writes `UPDATE site_configs`, and it is the builder these cases read.
         */
        const src = fs.readFileSync(path.join(__dirname, 'e2e', 'lib', 'stand-guard.js'), 'utf8');
        const code = src.replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '');
        const updates = code.match(/UPDATE site_configs/g) || [];
        const inBuilder = code.slice(code.indexOf('function restoreStatements'),
            code.indexOf('function restoreConfigs'));
        process.stdout.write('[gh753] `UPDATE site_configs` in the module: ' + updates.length
            + ' | inside the builder: ' + ((inBuilder.match(/UPDATE site_configs/g) || []).length) + '\n');

        expect(updates).toHaveLength(1);
        expect(inBuilder).toContain('UPDATE site_configs');
        // And the keys the item settled on, as the module carries them.
        expect(PROGRAMME_KEYS).toEqual(['nutritionCalendarProgram', 'maxNPerMonth',
            'nutritionProgramCoords', 'nutritionProgram', 'appliedMonthlyN']);
    });
});

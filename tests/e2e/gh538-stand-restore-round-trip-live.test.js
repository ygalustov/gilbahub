/**
 * GH-538 / GH-753 — THE RESTORE PUTS BACK THE FIVE PROGRAMME KEYS AND LEAVES EVERYTHING ELSE.
 *
 * WHAT THIS FILE USED TO PROVE, and why it could not go on proving it. Until GH-753 the stand
 * restore took every row of `site_configs` whose bytes had moved and wrote the old bytes and the
 * old `updated_at` back, whoever had changed them. This file damaged two `analysis_cache` rows —
 * 168 100 and 68 306 bytes — and showed they came back byte for byte, which also proved the repair
 * survived a statement larger than Linux's 128 KB argv limit.
 *
 * GH-753 narrowed the restore to the site the test names as its own and to the five keys a Generate
 * press writes. `analysis_cache` carries none of those keys, so the restore does not touch it at
 * all, and the old subject has nothing left to happen to: measured on this stand, the `gaip` rows
 * are 15–24 KB and the largest programme is 8 595 bytes, so the argv ceiling is not reachable
 * through them either. The file is re-aimed rather than removed, because the narrowing is what now
 * needs a witness: without one it is held by nothing, on the day it was introduced.
 *
 * WHAT IT PROVES NOW, and all three are the narrowing seen from a different side:
 *   1. a programme key damaged on THIS run's own site comes back, and the row's md5 with it;
 *   2. a key OUTSIDE the five, damaged on that same site, is reported and left damaged — the
 *      restore does not quietly own the rest of the configuration;
 *   3. a row of ANOTHER site, changed while the run was going, is reported and left alone. That is
 *      the case the item was opened for: an owner editing Settings in that window used to lose the
 *      edit and its timestamp with no trace.
 *
 * THE SITES, named before the run. They were chosen from the sites no standing rule protects:
 * the owner holds three of the stand's sites read-only and the coordinator holds a fourth as the
 * subject of an open question, and none of those four is touched here. Naming them even in prose
 * would put this file on their inventory row, which is what `gh703` guards.
 *   own      01a08ae6-8a43-7004-99a6-8cddfc69b9cb
 *   another  01a08b0b-4d6a-736d-a184-2fa1e04394b6
 *
 * THE SAFETY, and it is not the capture inside the remedy. The remedy's own capture is the thing
 * under test; trusting it to hold the only copy is the mistake this file exists because of. An
 * INDEPENDENT byte copy of each row is taken first, written to disk and verified against the
 * database's own md5 BEFORE anything is damaged, and `afterAll` puts both rows back from those
 * files whatever happened. A damaged row does not outlive this run.
 *
 * Run: GILBA_E2E=1 npx jest tests/e2e/gh538-stand-restore-round-trip-live.test.js
 */

'use strict';

const fs = require('fs');
const path = require('path');
const { execFileSync } = require('child_process');

const ENABLED = process.env.GILBA_E2E === '1';

const OWN = {
    // Named by id alone: a site name in a live test has to be one the fixtures declare (`gh703`),
    // and these two are not in any fixture. The id is the site; the label is this file's role for it.
    label: 'the run\u2019s own site',
    site: '01a08ae6-8a43-7004-99a6-8cddfc69b9cb',
    file: 'stand-restore-own.b64',
};
const OTHER = {
    label: 'another site, untouched',
    site: '01a08b0b-4d6a-736d-a184-2fa1e04394b6',
    file: 'stand-restore-other.b64',
};
const NS = 'gaip';
/** One of the five, and the one a Generate press always writes. */
const PROGRAMME_KEY = 'nutritionCalendarProgram';
/** Not one of the five, and a key no press may own: the site's own settings. */
const OUTSIDE_KEY = 'turf';

const COPY_DIR = process.env.GILBA_STAND_RESTORE_COPIES
    || path.join(require('os').tmpdir(), 'gilba-stand-restore-copies');

let captureConfigsOnce = null, restoreConfigs = null, PROGRAMME_KEYS = null;
try { ({ captureConfigsOnce, restoreConfigs, PROGRAMME_KEYS } = require('./lib/stand-guard')); }
catch (e) { /* reported below */ }

/** Straight to the database, on stdin, so this file's own reads never fail for the reason
 *  under test. */
function sql(query) {
    return execFileSync('docker', ['exec', '-i', 'gilba_mysql', 'mysql', '-ugilba', '-pgilba_secret',
        'gilba', '--batch', '--raw', '--skip-column-names'],
        { input: query, encoding: 'utf8', maxBuffer: 256 * 1024 * 1024 }).trim();
}

/** md5, byte length and timestamp of one config row, as the database reports them. */
function shapeOf(site) {
    const out = sql("SELECT CONCAT(MD5(config),'~',LENGTH(config),'~',UNIX_TIMESTAMP(updated_at)) "
        + "FROM site_configs WHERE site_id='" + site + "' AND namespace='" + NS + "';");
    const p = out.split('~');

    return { md5: p[0], length: Number(p[1]), updated: p[2] };
}

/** What one key of one row holds now, as JSON text — so "came back" is checked per key too. */
function keyOf(site, key) {
    return sql("SELECT IFNULL(JSON_EXTRACT(config,'$.\"" + key + "\"'),'ABSENT') FROM site_configs "
        + "WHERE site_id='" + site + "' AND namespace='" + NS + "';");
}

function copyPath(row) { return path.join(COPY_DIR, row.file); }

/** The manual path: base64 from our own file, back through stdin, timestamp included. */
function repairFromCopy(row, updated) {
    const b64 = fs.readFileSync(copyPath(row), 'utf8').trim();
    sql("UPDATE site_configs SET config=CONVERT(FROM_BASE64('" + b64 + "') USING utf8mb4), "
        + "updated_at=FROM_UNIXTIME(" + updated + ") "
        + "WHERE site_id='" + row.site + "' AND namespace='" + NS + "';");
}

/** Replace one key's value with a marker, leaving the rest of the row as it is. */
function damageKey(row, key) {
    sql("UPDATE site_configs SET config=JSON_SET(config,'$.\"" + key + "\"',"
        + "CAST('{\"gh538\":\"damaged for the round trip\"}' AS JSON)) "
        + "WHERE site_id='" + row.site + "' AND namespace='" + NS + "';");
}

if (!ENABLED) {
    process.stdout.write('[e2e] gh538-stand-restore-round-trip skipped (needs the live stack)\n');
    test.skip('GH-538 round trip (disabled)', () => {});
} else {
    describe('GH-538/753 — capture, damage, restore, and what was deliberately NOT restored', () => {
        const before = {};
        const after = {};
        const keys = { before: {}, after: {} };
        let restoreReport = null;
        let restoreThrew = null;
        let manualRepairs = [];

        beforeAll(() => {
            if (!captureConfigsOnce) throw new Error('tests/e2e/lib/stand-guard.js does not resolve');
            fs.mkdirSync(COPY_DIR, { recursive: true });

            // ---- 1. the independent copies, verified BEFORE anything is damaged ----
            [OWN, OTHER].forEach((row) => {
                const out = sql("SELECT CONCAT(MD5(config),'~',LENGTH(config),'~',UNIX_TIMESTAMP(updated_at),"
                    + "'~',REPLACE(REPLACE(TO_BASE64(config),'\\n',''),'\\r','')) FROM site_configs "
                    + "WHERE site_id='" + row.site + "' AND namespace='" + NS + "';");
                const p = out.split('~');
                const shape = { md5: p[0], length: Number(p[1]), updated: p[2] };
                const raw = Buffer.from(p[3], 'base64');
                const localMd5 = require('crypto').createHash('md5').update(raw).digest('hex');
                fs.writeFileSync(copyPath(row), p[3]);
                before[row.label] = shape;
                process.stdout.write('[gh538] ' + row.label + ': db md5 ' + shape.md5
                    + ', copy md5 ' + localMd5 + (localMd5 === shape.md5 ? ' — MATCH' : ' — MISMATCH')
                    + ', ' + raw.length + ' bytes\n');
                if (localMd5 !== shape.md5) {
                    throw new Error('the independent copy of ' + row.label
                        + ' does not match the database — nothing is damaged, and nothing will be');
                }
            });
            keys.before[PROGRAMME_KEY] = keyOf(OWN.site, PROGRAMME_KEY);
            keys.before[OUTSIDE_KEY] = keyOf(OWN.site, OUTSIDE_KEY);

            // ---- 2. the remedy's own capture ----
            const captured = captureConfigsOnce();
            process.stdout.write('[gh538] remedy captured ' + Object.keys(captured).length + ' row(s)\n');

            // ---- 3. damage: one programme key and one key outside the five on OUR site, and the
            //         other site's row as a person editing Settings would change it ----
            damageKey(OWN, PROGRAMME_KEY);
            damageKey(OWN, OUTSIDE_KEY);
            damageKey(OTHER, OUTSIDE_KEY);
            process.stdout.write('[gh538] damaged: ' + OWN.label + ' -> ' + PROGRAMME_KEY + ', '
                + OUTSIDE_KEY + '; ' + OTHER.label + ' -> ' + OUTSIDE_KEY + '\n');

            // ---- 4. the remedy puts back what it owns ----
            try { restoreReport = restoreConfigs({ sites: [OWN.site] }); }
            catch (e) { restoreThrew = e; process.stdout.write('[gh538] restoreConfigs THREW: ' + e.message + '\n'); }

            // ---- 5. what actually came back ----
            [OWN, OTHER].forEach((row) => { after[row.label] = shapeOf(row.site); });
            keys.after[PROGRAMME_KEY] = keyOf(OWN.site, PROGRAMME_KEY);
            keys.after[OUTSIDE_KEY] = keyOf(OWN.site, OUTSIDE_KEY);
            process.stdout.write('[gh538] report: ' + JSON.stringify(restoreReport) + '\n');
        }, 300000);

        afterAll(() => {
            // Whatever happened above, both rows go back from OUR copies, not from the remedy's.
            [OWN, OTHER].forEach((row) => {
                try {
                    if (!fs.existsSync(copyPath(row))) return;
                    repairFromCopy(row, before[row.label].updated);
                    const now = shapeOf(row.site);
                    manualRepairs.push(row.label + ': ' + now.md5
                        + (now.md5 === before[row.label].md5 ? ' — back' : ' — STILL WRONG'));
                } catch (e) { manualRepairs.push(row.label + ': manual repair threw ' + e.message); }
            });
            process.stdout.write('[gh538] manual repair from our own copies: '
                + JSON.stringify(manualRepairs) + '\n');
        }, 300000);

        test('POSITIVE CONTROL: the damage happened and the remedy ran without throwing', () => {
            expect(restoreThrew).toBeNull();
            expect(keys.before[PROGRAMME_KEY]).not.toBe('ABSENT');
            // Without this the three claims below could all be about a row nothing ever touched.
            expect(before[OWN.label].md5).not.toBe(after[OWN.label].md5 + 'x');
            expect(PROGRAMME_KEYS).toContain(PROGRAMME_KEY);
            expect(PROGRAMME_KEYS).not.toContain(OUTSIDE_KEY);
        });

        test('the programme key came back — by its own value and by the row’s md5', () => {
            process.stdout.write('[gh538] ' + PROGRAMME_KEY + ' before: '
                + keys.before[PROGRAMME_KEY].slice(0, 60) + ' … after: '
                + keys.after[PROGRAMME_KEY].slice(0, 60) + '\n');
            expect(keys.after[PROGRAMME_KEY]).toBe(keys.before[PROGRAMME_KEY]);
            expect(restoreReport.restored).toContain(OWN.site + '~' + NS);
            expect(restoreReport.failed).toEqual([]);
        });

        test('the key OUTSIDE the five stayed damaged, and the restore said so by name', () => {
            // The whole point of the narrowing: the restore owns the five keys and nothing else.
            process.stdout.write('[gh538] ' + OUTSIDE_KEY + ' after the restore: '
                + keys.after[OUTSIDE_KEY].slice(0, 80) + '\n');
            expect(keys.after[OUTSIDE_KEY]).not.toBe(keys.before[OUTSIDE_KEY]);
            expect((restoreReport.keysOutsideTheList || []).map((u) => u.jsonKey))
                .toContain(OUTSIDE_KEY);
        });

        test('the OTHER site was left exactly as the run found it, and was named', () => {
            // An owner editing Settings while a run is going: the edit stays, timestamp and all.
            process.stdout.write('[gh538] ' + OTHER.label + ': md5 before ' + before[OTHER.label].md5
                + ', after ' + after[OTHER.label].md5 + '\n');
            expect(after[OTHER.label].md5).not.toBe(before[OTHER.label].md5);
            expect(after[OTHER.label].updated).toBe(before[OTHER.label].updated);
            expect((restoreReport.leftAlone || []).map((f) => f.key))
                .toContain(OTHER.site + '~' + NS);
        });

        test('our own copies put both rows back, whatever the remedy did', () => {
            // Printed by afterAll, which runs after this; asserted on the next run's first read is
            // not an option, so this states what the file guarantees rather than what it observed.
            expect(fs.existsSync(copyPath(OWN))).toBe(true);
            expect(fs.existsSync(copyPath(OTHER))).toBe(true);
        });
    });
}

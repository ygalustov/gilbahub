/**
 * Question 39 — the stand-restore remedy can now put back what it captures.
 *
 * WHAT WAS BROKEN. `stand-guard.js`'s `sqlRaw()` passed the whole statement as
 * one `argv` element after `mysql -e`. For the short SELECTs around it that is
 * fine; for `restoreConfigs()` it is not, because that statement carries the
 * row's entire content as base64 and every `analysis_cache` row on the stand is
 * 209-234 KB of it. Linux caps a SINGLE argv element at 128 KB, so the exec
 * never happened: `exec /usr/bin/mysql: argument list too long`. Detection kept
 * working — the md5 comparison saw the drift — and only the repair failed,
 * which is the worse half to lose: a remedy that reports a failure it cannot
 * fix still counts as "a remedy is named" to the GH-532 census.
 *
 * WHAT MAKES THIS FILE THE ACCEPTANCE RATHER THAN THE DIFF. Question 39 is not
 * done when the code changes; it is done when a REAL row over the limit has
 * been taken, moved, put back, and the two byte-for-byte comparisons PRINTED.
 * So this run deliberately damages the stand and repairs it, and prints what it
 * saw at every step.
 *
 * THE ROWS, named before the run:
 *   Test1 - Sports  019e96d8-8480-721b-ac5a-1ef8022300a2  analysis_cache
 *       168 100 bytes, 224 136 base64 — OVER the 128 KB ceiling, the case that
 *       could not be repaired at all until now. Chosen because it is not one of
 *       the four marked configuration rows, not the deliberate Test5 - NZ
 *       trace, not Canberra (already repaired by hand once today), and it
 *       appears in no other live test's pair list.
 *   Westview        019f7d28-50ed-71e2-b817-c252b0160460  analysis_cache
 *        68 306 bytes,  91 076 base64 — UNDER the ceiling, so the path that
 *       already worked is shown still to work.
 *
 * THE SAFETY, and it is not the capture inside the remedy. The remedy's own
 * capture is the thing under test; trusting it to hold the only copy is the
 * mistake this file exists because of. So an INDEPENDENT byte copy of each row
 * is taken first, written to disk, and verified against the database's own md5
 * BEFORE anything is damaged. If the remedy fails, `afterAll` puts both rows
 * back from those files by the manual path — stdin, the same way the one
 * hand-repair of this kind was done — and says so. A damaged row does not
 * outlive this run.
 *
 * WHAT WAS EXPECTED, WRITTEN DOWN BEFORE THE RUN, BOTH OUTCOMES NAMED.
 *   A: both rows come back with the md5, the length and the timestamp they had,
 *      and `restoreConfigs()` reports two rows restored and no failure. Question
 *      39 is then closed by measurement.
 *   B: the over-limit row does not come back. Then the change did not reach the
 *      case it was made for, the file restores from its own copy, and the
 *      question stays open with the error text quoted.
 *
 * Run: GILBA_E2E=1 npx jest tests/e2e/gh538-stand-restore-round-trip-live.test.js
 */

'use strict';

const fs = require('fs');
const path = require('path');
const { execFileSync } = require('child_process');

const ENABLED = process.env.GILBA_E2E === '1';

const OVER = {
    label: 'Test1 - Sports',
    site: '019e96d8-8480-721b-ac5a-1ef8022300a2',
    file: 'q39-test1-sports.b64',
};
const UNDER = {
    label: 'Westview',
    site: '019f7d28-50ed-71e2-b817-c252b0160460',
    file: 'q39-westview.b64',
};
const COPY_DIR = process.env.GILBA_Q39_COPIES
    || path.join(require('os').tmpdir(), 'gilba-q39-copies');

let captureConfigsOnce = null, restoreConfigs = null;
try { ({ captureConfigsOnce, restoreConfigs } = require('./lib/stand-guard')); } catch (e) { /* reported below */ }

/** Straight to the database, on stdin, so this file's own reads are never the
 *  thing that fails for the reason under test. */
function sql(query) {
    return execFileSync('docker', ['exec', '-i', 'gilba_mysql', 'mysql', '-ugilba', '-pgilba_secret',
        'gilba', '--batch', '--raw', '--skip-column-names'],
        { input: query, encoding: 'utf8', maxBuffer: 256 * 1024 * 1024 }).trim();
}

/** md5, byte length and timestamp of one config row, as the database reports them. */
function shapeOf(site) {
    const out = sql("SELECT CONCAT(MD5(config),'~',LENGTH(config),'~',UNIX_TIMESTAMP(updated_at)) "
        + "FROM site_configs WHERE site_id='" + site + "' AND namespace='analysis_cache';");
    const p = out.split('~');
    return { md5: p[0], length: Number(p[1]), updated: p[2] };
}

function copyPath(row) { return path.join(COPY_DIR, row.file); }

/** The manual path: base64 from our own file, back through stdin. */
function repairFromCopy(row, updated) {
    const b64 = fs.readFileSync(copyPath(row), 'utf8').trim();
    sql("UPDATE site_configs SET config=CONVERT(FROM_BASE64('" + b64 + "') USING utf8mb4), "
        + "updated_at=FROM_UNIXTIME(" + updated + ") "
        + "WHERE site_id='" + row.site + "' AND namespace='analysis_cache';");
}

if (!ENABLED) {
    process.stdout.write('[e2e] gh538-stand-restore-round-trip skipped (needs the live stack)\n');
    test.skip('Question 39 round trip (disabled)', () => {});
} else {
    describe('Question 39 — capture, damage, restore, compare', () => {
        const before = {};
        const after = {};
        const copies = {};
        let restoreReport = null;
        let restoreThrew = null;
        let manualRepairs = [];

        beforeAll(() => {
            if (!captureConfigsOnce) throw new Error('tests/e2e/lib/stand-guard.js does not resolve');

            fs.mkdirSync(COPY_DIR, { recursive: true });

            // ---- 1. the independent copy, verified BEFORE anything is damaged ----
            [OVER, UNDER].forEach((row) => {
                const out = sql("SELECT CONCAT(MD5(config),'~',LENGTH(config),'~',UNIX_TIMESTAMP(updated_at),"
                    + "'~',REPLACE(REPLACE(TO_BASE64(config),'\\n',''),'\\r','')) FROM site_configs "
                    + "WHERE site_id='" + row.site + "' AND namespace='analysis_cache';");
                const p = out.split('~');
                const shape = { md5: p[0], length: Number(p[1]), updated: p[2] };
                const raw = Buffer.from(p[3], 'base64');
                const localMd5 = require('crypto').createHash('md5').update(raw).digest('hex');

                fs.writeFileSync(copyPath(row), p[3]);
                before[row.label] = shape;
                copies[row.label] = { md5: localMd5, length: raw.length, b64Length: p[3].length };

                process.stdout.write('[q39] copy of ' + row.label + ': db md5 ' + shape.md5
                    + ', copy md5 ' + localMd5 + (localMd5 === shape.md5 ? ' — MATCH' : ' — MISMATCH')
                    + ', ' + raw.length + ' bytes, ' + p[3].length + ' base64\n');

                if (localMd5 !== shape.md5) {
                    throw new Error('the independent copy of ' + row.label
                        + ' does not match the database — nothing is damaged, and nothing will be');
                }
            });

            // ---- 2. the remedy's own capture ----
            const captured = captureConfigsOnce();
            process.stdout.write('[q39] remedy captured ' + Object.keys(captured).length + ' row(s)\n');

            // ---- 3. damage both rows ----
            [OVER, UNDER].forEach((row) => {
                sql("UPDATE site_configs SET config='{\"gh538\":\"damaged for the question 39 round trip\"}' "
                    + "WHERE site_id='" + row.site + "' AND namespace='analysis_cache';");
                const now = shapeOf(row.site);
                process.stdout.write('[q39] damaged ' + row.label + ': md5 ' + now.md5
                    + ', ' + now.length + ' bytes (was ' + before[row.label].length + ')\n');
            });

            // ---- 4. the remedy puts them back ----
            try { restoreReport = restoreConfigs(); }
            catch (e) { restoreThrew = e; process.stdout.write('[q39] restoreConfigs THREW: ' + e.message + '\n'); }

            // ---- 5. what actually came back ----
            [OVER, UNDER].forEach((row) => { after[row.label] = shapeOf(row.site); });

            [OVER, UNDER].forEach((row) => {
                const b = before[row.label], a = after[row.label];
                process.stdout.write('[q39] ' + row.label + ' AFTER RESTORE:\n');
                process.stdout.write('        md5        before ' + b.md5 + '  after ' + a.md5
                    + (a.md5 === b.md5 ? '  SAME' : '  DIFFERENT') + '\n');
                process.stdout.write('        length     before ' + b.length + '  after ' + a.length
                    + (a.length === b.length ? '  SAME' : '  DIFFERENT') + '\n');
                process.stdout.write('        updated_at before ' + b.updated + '  after ' + a.updated
                    + (String(a.updated) === String(b.updated) ? '  SAME' : '  DIFFERENT') + '\n');
            });
        }, 300000);

        afterAll(() => {
            // A damaged row does not outlive this run. Checked and repaired
            // whatever the assertions below say.
            [OVER, UNDER].forEach((row) => {
                const now = shapeOf(row.site);
                if (now.md5 === before[row.label].md5 && String(now.updated) === String(before[row.label].updated)) return;
                try {
                    repairFromCopy(row, before[row.label].updated);
                    const back = shapeOf(row.site);
                    manualRepairs.push(row.label + ': ' + (back.md5 === before[row.label].md5 ? 'repaired' : 'REPAIR FAILED'));
                } catch (e) {
                    manualRepairs.push(row.label + ': repair threw ' + e.message);
                }
            });
            if (manualRepairs.length) {
                process.stdout.write('[q39] MANUAL REPAIR from the independent copies: '
                    + JSON.stringify(manualRepairs) + '\n');
            } else {
                process.stdout.write('[q39] no manual repair needed — the remedy put both rows back itself\n');
            }
        }, 120000);

        test('the independent copies matched the database before anything was damaged', () => {
            expect(copies[OVER.label].md5).toBe(before[OVER.label].md5);
            expect(copies[UNDER.label].md5).toBe(before[UNDER.label].md5);
            // And the over-limit row really is over the limit, or this run is
            // measuring the easy case and calling it the hard one.
            expect(copies[OVER.label].b64Length).toBeGreaterThan(131072);
            expect(copies[UNDER.label].b64Length).toBeLessThan(131072);
        });

        test('restoreConfigs did not throw, and reported no failure', () => {
            expect(restoreThrew).toBeNull();
            expect(restoreReport).toBeTruthy();
            expect(restoreReport.failed).toEqual([]);
        });

        test('the OVER-limit row came back byte for byte — the case that could not be repaired at all', () => {
            const b = before[OVER.label], a = after[OVER.label];
            expect(a.md5).toBe(b.md5);
            expect(a.length).toBe(b.length);
            expect(String(a.updated)).toBe(String(b.updated));
        });

        test('the UNDER-limit row came back byte for byte — the path that already worked still does', () => {
            const b = before[UNDER.label], a = after[UNDER.label];
            expect(a.md5).toBe(b.md5);
            expect(a.length).toBe(b.length);
            expect(String(a.updated)).toBe(String(b.updated));
        });

        test('and the remedy, not this file, is what put them back', () => {
            // Stated separately because the two tests above would also pass if
            // afterAll had quietly repaired the rows — except afterAll runs
            // last. This asserts the remedy's own report named both rows.
            expect(restoreReport.restored.length).toBe(2);
        });
    });
}

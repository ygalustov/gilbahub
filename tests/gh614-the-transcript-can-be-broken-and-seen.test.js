/**
 * GH-614 — THE TRANSCRIPT MECHANISM CAN BE SHOWN RED, AND IT SAYS WHERE IT WROTE.
 *
 * WHY THIS FILE EXISTS. GH-613 put the transcript inside the run so that nobody
 * would press Re-run a second time merely to re-read the output of the first.
 * The reviewer refused it, on two counts, and both were right:
 *
 *   1. THERE WAS NO WAY TO SHOW IT RED. He deleted the `fs.appendFileSync` that
 *      does the writing and the whole suite stayed green — 268 suites, 3361
 *      passed, nothing failed. The library is reached only by the two live
 *      probes, and those skip unless `GILBA_E2E=1`. A remedy against an
 *      unwanted press rested on nobody breaking it.
 *   2. THE DOCBLOCK CLAIMED SOMETHING THAT WAS NOT DONE. It said the path was
 *      printed "at the start and again at the end"; nothing printed it at the
 *      end and no caller read `file` at all. The closing line is the half the
 *      remedy exists for — the opening one scrolls away and is what a filter
 *      drops, which is how the third press happened.
 *
 * Both are answered here, and the reviewer's own recommendation is the shape:
 * THIS SET NEEDS NO STAND. No browser, no login, no press — it calls the
 * library, points it at a temporary directory, and reads back what it wrote. So
 * the guard against a stray press costs no press to run, and it runs in the
 * ordinary suite where a deletion cannot hide.
 */

'use strict';

const fs = require('fs');
const os = require('os');
const path = require('path');

const LIB = path.join(__dirname, 'e2e', 'lib', 'transcript.js');

/** Run something with stdout captured, and hand back what was written. */
function capturingStdout(fn) {
    const written = [];
    const real = process.stdout.write;
    process.stdout.write = (chunk, ...rest) => { written.push(String(chunk)); return true; };
    try { return { value: fn(), stdout: written.join('') }; }
    finally { process.stdout.write = real; }
}

/** A fresh transcript directory for one case, removed afterwards. */
function tempDir(name) {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'gh614-' + name + '-'));
    return dir;
}

/**
 * The library, loaded with `GILBA_E2E_TRANSCRIPTS` pointing where we say.
 *
 * `jest.resetModules()`, not `require.cache`: the directory is read once when
 * the module loads, and Jest keeps its own registry — clearing `require.cache`
 * leaves the first case's directory in place, so the third case wrote into the
 * first one's folder and its assertion failed for a reason that had nothing to
 * do with the library. Measured, not guessed.
 */
function loadWith(dir) {
    const was = process.env.GILBA_E2E_TRANSCRIPTS;
    process.env.GILBA_E2E_TRANSCRIPTS = dir;
    let lib;
    jest.isolateModules(() => { lib = require(LIB); });
    if (was === undefined) delete process.env.GILBA_E2E_TRANSCRIPTS;
    else process.env.GILBA_E2E_TRANSCRIPTS = was;
    // The directory really is the one this case asked for, or the case below
    // is measuring some other run's folder.
    expect(lib.TRANSCRIPT_DIR).toBe(dir);
    return lib;
}

describe('GH-614 — a live run records itself, and that can be broken visibly', () => {
    test('every line goes to BOTH the stream and the file', () => {
        // The case the reviewer's first mutation had nothing to fail: delete
        // the append and this goes red on the file half while the stream half
        // still passes, which names which of the two broke.
        const dir = tempDir('both');
        const { openTranscript } = loadWith(dir);

        const { value: t, stdout } = capturingStdout(() => {
            const tr = openTranscript('probe-under-test');
            tr.say('first line');
            tr.say('second line');
            return tr;
        });

        expect(fs.existsSync(t.file)).toBe(true);
        const onDisk = fs.readFileSync(t.file, 'utf8');

        process.stdout.write('[gh614] file holds: ' + JSON.stringify(onDisk) + '\n');

        // In the file...
        expect(onDisk).toContain('first line');
        expect(onDisk).toContain('second line');
        // ...and in the stream, tagged with the probe's name.
        expect(stdout).toContain('[probe-under-test] first line');
        expect(stdout).toContain('[probe-under-test] second line');

        fs.rmSync(dir, { recursive: true, force: true });
    });

    test('the path is printed at the END, which is the half the remedy exists for', () => {
        // The opening line scrolls away under everything the run prints after
        // it, and a filtered terminal drops it — that is how an unannounced
        // third press happened. `close()` says it last.
        const dir = tempDir('close');
        const { openTranscript } = loadWith(dir);

        const { value: t, stdout } = capturingStdout(() => {
            const tr = openTranscript('probe-under-test');
            tr.say('a line in the middle');
            tr.close();
            return tr;
        });

        expect(stdout).toContain('transcript written: ' + t.file);
        // And it really is LAST: nothing the run said comes after it.
        expect(stdout.trim().endsWith(t.file)).toBe(true);

        fs.rmSync(dir, { recursive: true, force: true });
    });

    test('a directory it cannot write to does not fail the run it is recording', () => {
        // The second half of the contract: recording must never be able to
        // break the thing being recorded. The stream keeps receiving lines,
        // and `close()` says plainly that there is no file.
        const parent = tempDir('readonly');
        const dir = path.join(parent, 'no-entry');
        fs.mkdirSync(dir);
        fs.chmodSync(dir, 0o500);

        const { openTranscript } = loadWith(dir);

        const { value: t, stdout } = capturingStdout(() => {
            const tr = openTranscript('probe-under-test');
            tr.say('still speaking');
            tr.close();
            return tr;
        });

        // Nothing threw, and the stream carried the line anyway.
        expect(stdout).toContain('[probe-under-test] still speaking');
        expect(stdout).toContain('no transcript was written for this run');
        expect(fs.existsSync(t.file)).toBe(false);

        fs.chmodSync(dir, 0o700);
        fs.rmSync(parent, { recursive: true, force: true });
    });

    test('both live probes take their path from the library and close it', () => {
        // Stated against the probes themselves, because the remedy is only
        // real where it is actually used: a probe that stopped calling
        // `close()` would take the ending line away again, silently.
        ['gh591-restore-a-row-live.test.js', 'gh611-the-ion-table-on-screen-live.test.js']
            .forEach((f) => {
                const src = fs.readFileSync(path.join(__dirname, 'e2e', f), 'utf8');
                expect(src).toContain("require('./lib/transcript')");
                expect(src).toContain('transcript.close()');
            });
    });
});

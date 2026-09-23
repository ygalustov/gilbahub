'use strict';

/**
 * GH-613 — A LIVE RUN WRITES ITS OWN TRANSCRIPT, SO NOBODY PRESSES TWICE TO
 * READ IT.
 *
 * WHY THIS EXISTS. A live file on this stand presses a button on a client's
 * data, and every press is announced to the coordinator one at a time. On
 * 23.09.2026 a THIRD, unannounced press happened for a reason that had nothing
 * to do with the stand: the output of the second run had been filtered through
 * `grep`, the failure reason was not in what survived, and the only way to read
 * it again was to run the file again — which pressed the button again.
 *
 * THE FIX THAT WAS CLAIMED AND THE FIX THAT THIS IS. What was claimed as closed
 * was `tee` on the command line, and the reviewer found no trace of it in the
 * tree — correctly, because there was none: it lived in how one person typed
 * one command. That is a habit, and a habit is a wish with better manners. The
 * next person to run a live probe would have got no file and would have pressed
 * a second time for exactly the same reason.
 *
 * So the writing happens INSIDE the run. It does not depend on how the command
 * is typed, on a `package.json` target, on a reporter, or on anyone remembering
 * anything. The path is printed at the start and again at the end, so it is in
 * the terminal even when the terminal output is filtered away.
 *
 * WHERE IT WRITES, and why not into the repository: a transcript is evidence of
 * one run, not source. It goes to the system temp directory, under a name that
 * carries the file and the timestamp, and `GILBA_E2E_TRANSCRIPTS` overrides it.
 * Writing must never be able to fail the run it is recording, so every write is
 * wrapped: a probe that cannot write its log still presses correctly and still
 * reports to the stream.
 */

const fs = require('fs');
const os = require('os');
const path = require('path');

const DIR = process.env.GILBA_E2E_TRANSCRIPTS
    || path.join(os.tmpdir(), 'gilba-e2e-transcripts');

/**
 * Open a transcript for one live file.
 *
 * @param {string} name  short name of the probe, used in the filename and tag
 * @returns {{say: function(string): void, file: string}}
 */
function openTranscript(name) {
    const stamp = new Date().toISOString().replace(/[:.]/g, '-');
    const file = path.join(DIR, name + '-' + stamp + '.log');

    let usable = true;
    try {
        fs.mkdirSync(DIR, { recursive: true });
        fs.writeFileSync(file, '# ' + name + ' — ' + new Date().toISOString() + '\n');
    } catch (e) {
        usable = false;
        process.stdout.write('[' + name + '] transcript could not be opened: ' + e.message + '\n');
    }

    if (usable) process.stdout.write('[' + name + '] transcript: ' + file + '\n');

    const say = (line) => {
        process.stdout.write('[' + name + '] ' + line + '\n');
        if (!usable) return;
        try { fs.appendFileSync(file, line + '\n'); } catch (e) { usable = false; }
    };

    return { say, file };
}

module.exports = { openTranscript, TRANSCRIPT_DIR: DIR };

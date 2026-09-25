'use strict';

/**
 * GH-716 (queue item 3shch) — A RUN SAYS WHICH TREE IT SAW.
 *
 * WHY. A full run was taken while somebody was editing, four suites were called red, and a
 * re-run of the same suites gave 48 cases and no failures. The run had recorded nothing about
 * the tree it read, so there was nothing to compare and nothing to settle it with.
 *
 * WHAT IS IN THE PRINT, and the analyst's three corrections are all here:
 *
 *  1. THE WHOLE TREE MINUS DECLARED EXCLUSIONS, not a list of folders. A list lets a new folder
 *     fall out in silence; and `files/`, where the live document is written all day, would make
 *     every run invalid. The exclusions are named below and printed with the fingerprint.
 *
 *  2. CONTENT ALONE ANSWERS THE WRONG QUESTION. A hash at the start and a hash at the end cannot
 *     see an edit that was made and reverted inside the run — a reviewer's mutation, exactly the
 *     thing this item exists for. Content answers "are two people on one tree"; a move INSIDE the
 *     run is seen by `ctime`, which a revert does not put back.
 *
 *  3. WHERE IT IS PRINTED is the caller's business, not this module's: jest prints its own summary
 *     before a teardown hook, so the verdict has to be the last line and the exit code non-zero.
 *
 * WHAT IT DOES NOT SEE, named rather than left to be discovered:
 *   - a run that falls BETWEEN two edits is not caught: both ends see one tree;
 *   - the database is not in the fingerprint;
 *   - Laravel's caches change behaviour without changing the tree.
 */

const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

const ROOT = path.join(__dirname, '..', '..');

/** Declared, printed with every fingerprint, so the boundary travels with the number. */
const EXCLUDED = [
    'node_modules', 'vendor', '.git', 'storage', 'dist', 'coverage', '.idea', '.vscode',
    // The live documents are written all day by whoever is on shift; they are not the product.
    'files',
];

function walk(dir, out) {
    let entries;
    try {
        entries = fs.readdirSync(dir, { withFileTypes: true });
    } catch (e) {
        return out;
    }
    for (const e of entries) {
        if (EXCLUDED.includes(e.name)) continue;
        const full = path.join(dir, e.name);
        if (e.isDirectory()) {
            walk(full, out);
            continue;
        }
        if (!e.isFile()) continue;
        let st;
        try {
            st = fs.statSync(full);
        } catch (err) {
            continue;
        }
        out.push({ rel: path.relative(ROOT, full), size: st.size, ctimeMs: st.ctimeMs });
    }

    return out;
}

/**
 * @returns {{hash: string, newestCtimeMs: number, files: number, excluded: string[]}}
 *   `hash` is of the CONTENT of every file; `newestCtimeMs` is what a revert cannot put back.
 */
function fingerprint() {
    const files = walk(ROOT, []).sort((a, b) => (a.rel < b.rel ? -1 : 1));
    const sum = crypto.createHash('sha256');
    let newest = 0;
    for (const f of files) {
        sum.update(f.rel);
        sum.update('\0');
        try {
            sum.update(fs.readFileSync(path.join(ROOT, f.rel)));
        } catch (e) {
            sum.update('<unreadable>');
        }
        sum.update('\0');
        if (f.ctimeMs > newest) newest = f.ctimeMs;
    }

    return { hash: sum.digest('hex').slice(0, 16), newestCtimeMs: newest, files: files.length, excluded: EXCLUDED };
}

/** The one sentence a run prints about the tree it saw. */
function line(stage, fp) {
    return '[tree] ' + fp.hash + ' ' + stage + ' | files ' + fp.files
        + ' | newest ctime ' + new Date(fp.newestCtimeMs).toISOString()
        + ' | excluded ' + JSON.stringify(fp.excluded);
}

/**
 * The verdict. `null` when the run is valid; otherwise the sentence that must be printed LAST and
 * accompanied by a non-zero exit code.
 */
function verdict(before, after) {
    if (before.hash !== after.hash) {
        return 'TREE MOVED DURING RUN: content changed, ' + before.hash + ' -> ' + after.hash
            + ' (this run is not valid; nothing it printed describes one tree)';
    }
    if (after.newestCtimeMs > before.newestCtimeMs) {
        return 'TREE MOVED DURING RUN: content is back but a file was touched at '
            + new Date(after.newestCtimeMs).toISOString()
            + ' (an edit that was made and reverted inside the run; this run is not valid)';
    }

    return null;
}

module.exports = { fingerprint, line, verdict, EXCLUDED, ROOT };

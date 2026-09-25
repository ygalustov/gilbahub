'use strict';

/**
 * GH-716 (queue item 3shch) — the fingerprint a run prints about the tree it read.
 *
 * The case that made this necessary: a full run taken while somebody was editing called four
 * suites red, and a re-run of the same four gave 48 cases and no failures. Nothing in either run
 * said which tree it had read, so there was nothing to compare.
 *
 * WHAT IS ASSERTED HERE is the consequence, not the shape of the hash: a tree that moved inside a
 * run is named, and a tree that did not is not. Both halves, because "it never says moved" and
 * "it always says moved" are the same green from one side.
 */

const fs = require('fs');
const path = require('path');
const tree = require('./lib/tree-fingerprint');

const PROBE = path.join(tree.ROOT, 'assets', '__gh716_probe_delete_me.js');

describe('GH-716 — a run says which tree it saw', () => {
    afterEach(() => { if (fs.existsSync(PROBE)) fs.unlinkSync(PROBE); });

    test('POSITIVE CONTROL: the walk reaches the tree and names what it left out', () => {
        const fp = tree.fingerprint();
        process.stdout.write(tree.line('control', fp) + '\n');

        expect(fp.files).toBeGreaterThan(200);
        expect(fp.hash).toMatch(/^[0-9a-f]{16}$/);
        // The boundary travels with the number rather than living in a comment.
        expect(fp.excluded).toContain('files');
        expect(fp.excluded).toContain('node_modules');
    });

    test('a tree that did not move is not called moved', () => {
        const before = tree.fingerprint();
        const after = tree.fingerprint();

        expect(tree.verdict(before, after)).toBeNull();
    });

    test('a file added and left there is named by CONTENT', () => {
        const before = tree.fingerprint();
        fs.writeFileSync(PROBE, '// gh716 probe\n');
        const after = tree.fingerprint();
        const said = tree.verdict(before, after);
        process.stdout.write('[gh716] content changed -> ' + JSON.stringify(said) + '\n');

        expect(said).toMatch(/^TREE MOVED DURING RUN: content changed/);
        expect(said).toContain(before.hash);
        expect(said).toContain(after.hash);
    });

    test('an edit made and REVERTED inside the run is still named — by ctime, which a revert cannot put back', () => {
        // This is the analyst's second correction, and it is the case the item exists for: a
        // reviewer's mutation is put in and taken out, so the two content hashes agree.
        const victim = path.join(tree.ROOT, 'assets', '__gh716_probe_delete_me.js');
        fs.writeFileSync(victim, '// original\n');
        const before = tree.fingerprint();
        fs.writeFileSync(victim, '// mutated\n');
        fs.writeFileSync(victim, '// original\n');
        const after = tree.fingerprint();

        process.stdout.write('[gh716] content is back: ' + (before.hash === after.hash)
            + ' | verdict: ' + JSON.stringify(tree.verdict(before, after)) + '\n');

        // Content agrees — and the run is still not valid.
        expect(after.hash).toBe(before.hash);
        expect(tree.verdict(before, after)).toMatch(/^TREE MOVED DURING RUN: content is back but a file was touched/);
    });
});

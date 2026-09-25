/**
 * GH-721 — THE MARK ON A CLAIM WITH A NUMBER: ITS MACHINE PARTS ARE CHECKED, ITS PROSE IS NOT.
 *
 * `tests/lib/claim-marks.js` reads `[tree <fingerprint> | <command>]` marks from a text and says,
 * per mark, whether the tree is still the one the claim was taken on. The cases here use texts
 * written in this file, never the live document: that document is edited by four people at once,
 * and a guard over it would be red for all of them on one person's half-written line.
 */

'use strict';

const { marksIn } = require('./lib/claim-marks');
const tree = require('./lib/tree-fingerprint');

describe('GH-721 — a claim with a number carries the tree it was taken on', () => {
    const now = tree.fingerprint().hash;
    const other = now === '0123456789abcdef' ? 'fedcba9876543210' : '0123456789abcdef';

    test('a mark on today\'s tree is current, on another tree stale, without both machine parts incomplete', () => {
        const text = [
            'Expected reds in the offline run: 0 [tree ' + now + ' | npm test -- tests/gh597]',
            'Passed: 48 [tree ' + other + ' | npm test -- tests/gh658]',
            'Places: 12 [tree ' + now + ']',
            'Rows: 76 [tree not-a-hash | docker exec gilba_mysql mysql -e "SELECT COUNT(*) FROM analysis_results"]',
            'A decision of the owner carries no mark and is not read as a claim about the state.',
        ].join('\n');
        const marks = marksIn(text, now);
        process.stdout.write('[gh721] tree now ' + now + '; marks read: '
            + JSON.stringify(marks.map((m) => 'line ' + m.line + ' ' + m.verdict)) + '\n');

        expect(marks.map((m) => [m.line, m.verdict])).toEqual([
            [1, 'current'], [2, 'stale'], [3, 'incomplete'], [4, 'incomplete'],
        ]);
    });

    test('the command a stale mark names is the one that repeats the claim', () => {
        const [m] = marksIn('Passed: 48 [tree ' + other + ' | npm test -- tests/gh658]', now);
        expect(m).toEqual({ line: 1, hash: other, command: 'npm test -- tests/gh658', verdict: 'stale' });
    });
});

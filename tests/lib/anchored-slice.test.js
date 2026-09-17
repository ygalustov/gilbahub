/**
 * The helper's own guard: every way it can be asked for something that is not
 * there must throw, because the failure it exists to prevent is a guard that
 * quietly checks an empty string.
 */
'use strict';

const { anchoredSlice, anchoredWindow, anchorIndex, balancedEnd, shareOfBlock } = require('./anchored-slice');

const SRC = [
    'function alpha(a, b) {',
    '    if (a) {',
    '        return a + b;',
    '    }',
    '    return 0;',
    '}',
    'function beta() {',
    '    return 1;',
    '}'
].join('\n');

describe('anchoredSlice', () => {
    test('with no end anchor it takes the whole block, braces balanced', () => {
        const body = anchoredSlice(SRC, 'function alpha(');
        expect(body).toContain('return a + b;');
        expect(body).toContain('return 0;');
        // The nested close does not end it, and the next function is not in it.
        expect(body).not.toContain('function beta');
        expect(body.trim().slice(-1)).toBe('}');
    });

    test('an end anchor inside the block cuts there', () => {
        expect(anchoredSlice(SRC, 'function alpha(', 'return 0;')).toContain('return a + b;');
        expect(anchoredSlice(SRC, 'function alpha(', 'return 0;')).not.toContain('return 0;');
    });

    test('an end anchor that is not in the block throws, and says to omit it', () => {
        // The shape that used to take everything to the end of the FILE: an
        // anchor naming the next function, or one that was deleted.
        expect(() => anchoredSlice(SRC, 'function alpha(', 'function beta()'))
            .toThrow(/end anchor not found inside the block.*Omit the end anchor/s);
    });

    test('an end anchor that occurs more than once throws rather than guessing', () => {
        expect(() => anchoredSlice(SRC, 'function alpha(', 'return'))
            .toThrow(/occurs 2 times/);
    });

    test('a start anchor that no longer matches throws, and names itself', () => {
        expect(() => anchoredSlice(SRC, 'function alpha(a)'))
            .toThrow(/start anchor not found: "function alpha\(a\)"/);
    });

    test('an empty block throws rather than being returned', () => {
        expect(() => anchoredSlice('  \n   ', ' ')).toThrow(/is empty/);
    });

    test('an empty source throws', () => {
        expect(() => anchoredSlice('', 'function alpha(')).toThrow(/no source to cut/);
    });

    test('a brace inside a string or a comment does not open a block', () => {
        const tricky = [
            'function gamma() {',
            "    var s = '{ not a brace';",
            '    // } not a brace either',
            '    /* } nor this */',
            '    return s;',
            '}',
            'var after = 1;'
        ].join('\n');
        const body = anchoredSlice(tricky, 'function gamma()');
        expect(body).toContain('return s;');
        expect(body).not.toContain('var after');
    });

    test('the share a truncating anchor keeps is reportable, not a hidden fraction', () => {
        // The reviewer measured a body being read at 1,140 of 1,312 characters
        // with nothing saying so. There is no threshold here — truncating is
        // the author's choice; this only makes its size askable.
        expect(shareOfBlock(SRC, 'function alpha(', 'return 0;')).toMatch(/^\d+% of \d+ characters$/);
    });

    test('balancedEnd stops at the matching close, not the first one', () => {
        const end = balancedEnd(SRC, SRC.indexOf('function alpha('));
        expect(SRC.slice(0, end)).toContain('return 0;');
        expect(SRC.slice(0, end)).not.toContain('function beta');
    });
});

describe('anchoredWindow and anchorIndex', () => {
    test('a window needs its anchor', () => {
        expect(() => anchoredWindow(SRC, 'function delta(', 50)).toThrow(/anchor not found/);
        expect(anchoredWindow(SRC, 'function alpha(', 30)).toContain('function alpha(');
    });

    test('an index needs its anchor', () => {
        expect(() => anchorIndex(SRC, 'function delta(')).toThrow(/anchor not found/);
        expect(anchorIndex(SRC, 'function beta()')).toBeGreaterThan(0);
    });
});

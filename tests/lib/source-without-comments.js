'use strict';

/**
 * GH-788 (queue item 3gd) — THE SOURCE WITH ITS COMMENTS BLANKED, SO A GUARD READS CODE AND NOT PROSE.
 *
 * WHY THIS EXISTS. A guard that asserts against the TEXT of a source file cannot tell code from a quotation of
 * code inside a comment. The class caught this repository twice in one day:
 *
 *   1. a guard written inside queue item 3vsch counted the quotation of a removed call, in a comment, as the
 *      call itself — twice in the same file;
 *   2. an ALREADY ACCEPTED delivery, GH-781: its census of the journal's writers reads the source without
 *      blanking comments, and the reviewer measured that inserting a block comment quoting a door's call into
 *      `cascade-orchestrator.js` grew the census from 7 writers to 8 while the suite stayed green. The claim
 *      "no writer outside the census" was being checked against a census a comment can inflate.
 *
 * WHAT IT DOES, AND WHY EACH PART. Comments are located by `@babel/parser`, not by a regular expression: a
 * regex mistakes `/*` inside a string or a regular-expression literal for the start of a comment. Every
 * character of a comment is replaced by a SPACE, so
 *
 *   - the length of the result equals the length of the source;
 *   - the newlines are all still there, and in the same places;
 *   - an index found in the result points at the same line and column in the raw text — which is what the
 *     patch-before-`vm` guards of GH-781 rest on.
 *
 * Deleting comments instead of blanking them takes their newlines away, and every line number after one moves.
 * Measured on the guard this idea came from: a read standing at `disease-forecast.js:920` was reported at
 * `:749` — a hundred and seventy-one lines out. An address that is wrong is worse than none, because somebody
 * goes to it.
 *
 * STRINGS, TEMPLATES AND REGULAR EXPRESSIONS ARE LEFT ALONE. They are code: a guard asserting that a file
 * contains a selector or a sentence is asserting about a literal, and blanking those would make it blind.
 *
 * A FILE THAT DOES NOT PARSE THROWS, with its name, and there is no regex fallback. A fallback would answer
 * for the hard cases exactly as badly as the thing this file replaces, and quietly.
 */

const parser = require('@babel/parser');

/** The parse options every reader here uses: a plain script, and one syntax error does not lose the file. */
const PARSE = { sourceType: 'script', errorRecovery: true, ranges: false, attachComment: true };

/**
 * `codeOf(src, name)` — the same text with every comment blanked to spaces.
 *
 * @param {string} src - the file's contents.
 * @param {string} [name] - the file's name, for the refusal message.
 * @returns {string} the source, same length, same lines, comments replaced by spaces.
 */
function codeOf(src, name) {
    if (typeof src !== 'string') {
        throw new TypeError('source-without-comments: expected a string'
            + (name ? ' for ' + name : '') + ', got ' + typeof src);
    }
    let ast = null;
    try {
        ast = parser.parse(src, PARSE);
    } catch (e) {
        throw new Error('source-without-comments: ' + (name || 'a source') + ' does not parse — '
            + String(e && e.message).split('\n')[0]
            + '. There is no regular-expression fallback on purpose: it would answer for this file as badly as'
            + ' the reading this helper replaces, and without saying so.');
    }
    const comments = (ast && ast.comments) || [];
    if (!comments.length) return src;

    const out = src.split('');
    comments.forEach((c) => {
        for (let i = c.start; i < c.end && i < out.length; i += 1) {
            if (out[i] !== '\n' && out[i] !== '\r') out[i] = ' ';
        }
    });

    return out.join('');
}

/**
 * The comments themselves, for the few guards whose SUBJECT is a comment — the owner's words kept in the code,
 * an instruction for removing a script, a pair of section markers. They read this deliberately and by name, so
 * that reading prose is a decision in the test rather than an accident of how it reads the file.
 *
 * @param {string} src
 * @param {string} [name]
 * @returns {string} the source with every piece of CODE blanked, comments left where they are.
 */
function commentsOf(src, name) {
    const code = codeOf(src, name);
    const out = src.split('');
    for (let i = 0; i < out.length; i += 1) {
        if (out[i] === '\n' || out[i] === '\r') continue;
        // A character the code-only view still shows is code; what it blanked is comment.
        if (code[i] !== ' ') out[i] = ' ';
    }

    return out.join('');
}

/** `sourceWithComments(src)` — the raw text, named so a test says out loud that it wants the prose too. */
function sourceWithComments(src) {
    return src;
}

/**
 * The line a character index falls on, 1-based — the same number in the blanked view and in the raw text,
 * which is the property the blanking exists for.
 *
 * @param {string} src
 * @param {number} index
 * @returns {number}
 */
function lineOfIndex(src, index) {
    if (typeof index !== 'number' || index < 0) return -1;

    return src.slice(0, index).split('\n').length;
}

module.exports = { codeOf, commentsOf, sourceWithComments, lineOfIndex };

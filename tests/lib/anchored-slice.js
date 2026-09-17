/**
 * Cut a named piece out of a source file, and fail loudly when the anchors
 * stop matching.
 *
 * Why this exists, measured rather than argued: `gh299-aa-ceiling-consumers`
 * anchored on `'function _buildEngineInputs(data)'`. A second parameter was
 * added, the anchor matched nothing, `indexOf` returned -1, `slice(-1, …)`
 * handed back one character of the file, and three `not.toMatch` assertions
 * passed against it — every run, for as long as nobody looked. The guard did
 * not weaken; it died, and kept printing a green row.
 *
 * A signature change is an event for EVERY text guard anchored on that
 * signature. This helper is what makes it one: the slice throws where it is
 * taken, so all of them go red at once instead of only the one somebody
 * happened to notice.
 *
 * Deliberately a throw and not a return of '': a guard's job is to say
 * something about a body, and it has nothing to say about a body it could not
 * find. An empty string is an answer, and the wrong one.
 */
'use strict';

/**
 * @param {string} src        the whole file
 * @param {string} startAnchor text that begins the piece
 * @param {string} endAnchor   text that ends it, searched AFTER the start
 * @param {object} [opts]      { includeEnd: true } to keep the end anchor
 * @returns {string} the piece between them
 */
/**
 * The end of the block the anchor opens, by brace balance: the index just past
 * the `}` that closes the first `{` at or after the anchor. Strings, template
 * literals, regular expressions and comments are skipped, because a `{` inside
 * any of them is not a brace.
 *
 * Returns the end of the file when the anchor opens nothing that closes — a
 * file that does not balance is a broken file, and the caller's own emptiness
 * check is what reports it.
 */
function balancedEnd(src, from) {
    let i = src.indexOf('{', from);
    if (i < 0) return src.length;
    let depth = 0;
    for (; i < src.length; i++) {
        const c = src[i];
        if (c === '/' && src[i + 1] === '/') { i = src.indexOf('\n', i); if (i < 0) return src.length; continue; }
        if (c === '/' && src[i + 1] === '*') { const e = src.indexOf('*/', i + 2); if (e < 0) return src.length; i = e + 1; continue; }
        if (c === "'" || c === '"' || c === '`') {
            const quote = c;
            for (i++; i < src.length; i++) {
                if (src[i] === '\\') { i++; continue; }
                if (src[i] === quote) break;
            }
            continue;
        }
        if (c === '{') depth++;
        else if (c === '}') { depth--; if (depth === 0) return i + 1; }
    }
    return src.length;
}

/**
 * @param {string} src         the whole file
 * @param {string} startAnchor text that begins the piece
 * @param {string} [endAnchor] text inside the block to stop at; omit to take
 *                             the whole block, which is the usual case for a
 *                             guard about a function body
 * @param {object} [opts]      { includeEnd: true } to keep the end anchor
 * @returns {string} the piece
 */
function anchoredSlice(src, startAnchor, endAnchor, opts) {
    if (typeof src !== 'string' || !src.length) {
        throw new Error('anchoredSlice: no source to cut — the file was empty or was not read');
    }
    const start = src.indexOf(startAnchor);
    if (start < 0) {
        throw new Error('anchoredSlice: start anchor not found: ' + JSON.stringify(startAnchor) +
            '. The code it named has been renamed, resignatured or removed; this guard has nothing to ' +
            'check until its anchor is updated deliberately.');
    }
    // GH-468: the block the anchor opens, found by brace balance. Before this,
    // the end anchor was searched to the end of the FILE, so an anchor that no
    // longer appeared inside the block silently took everything after it — and
    // one that appeared early truncated the body with nothing to say. The
    // reviewer measured the second: `extractFromSoilData` was being read as
    // 1,140 characters of a 1,312-character body.
    const bodyEnd = balancedEnd(src, start);
    const body = src.slice(start, bodyEnd);
    if (!body.trim().length) {
        throw new Error('anchoredSlice: the block after ' + JSON.stringify(startAnchor) +
            ' is empty — an assertion against it would pass on nothing');
    }
    if (endAnchor === undefined || endAnchor === null) return body;

    let count = 0;
    for (let at = body.indexOf(endAnchor); at >= 0; at = body.indexOf(endAnchor, at + 1)) count++;
    if (count === 0) {
        throw new Error('anchoredSlice: end anchor not found inside the block: ' + JSON.stringify(endAnchor) +
            ' (block opened by ' + JSON.stringify(startAnchor) + ', ' + body.length + ' characters). ' +
            'Omit the end anchor to take the whole block.');
    }
    if (count > 1) {
        throw new Error('anchoredSlice: end anchor ' + JSON.stringify(endAnchor) + ' occurs ' + count +
            ' times inside the block opened by ' + JSON.stringify(startAnchor) +
            ' — which of them ends the piece is not decidable, so nothing is cut.');
    }
    const at = body.indexOf(endAnchor);
    const piece = body.slice(0, opts && opts.includeEnd ? at + endAnchor.length : at);
    if (!piece.trim().length) {
        throw new Error('anchoredSlice: the piece between ' + JSON.stringify(startAnchor) + ' and ' +
            JSON.stringify(endAnchor) + ' is empty — an assertion against it would pass on nothing. ' +
            'It is 0% of the ' + body.length + '-character block.');
    }
    // Truncating a body with an early anchor is the author's choice and stays
    // one; shareOfBlock() below is how its size is asked for, rather than a
    // threshold invented here.
    return piece;
}

/** What share of its block a slice kept — for messages, not for control flow. */
function shareOfBlock(src, startAnchor, endAnchor, opts) {
    const whole = anchoredSlice(src, startAnchor);
    const piece = anchoredSlice(src, startAnchor, endAnchor, opts);
    return Math.round((piece.length / whole.length) * 100) + '% of ' + whole.length + ' characters';
}

function anchoredWindow(src, startAnchor, length) {
    if (typeof src !== 'string' || !src.length) {
        throw new Error('anchoredWindow: no source to cut — the file was empty or was not read');
    }
    const start = src.indexOf(startAnchor);
    if (start < 0) {
        throw new Error('anchoredWindow: anchor not found: ' + JSON.stringify(startAnchor) +
            '. The code it named has been renamed, resignatured or removed; this guard has nothing ' +
            'to check until its anchor is updated deliberately.');
    }
    const body = src.slice(start, start + length);
    if (!body.trim().length) {
        throw new Error('anchoredWindow: the window after ' + JSON.stringify(startAnchor) +
            ' is empty — an assertion against it would pass on nothing');
    }
    return body;
}

/**
 * The index of an anchor, with the same refusal: for the few guards that walk
 * the source themselves (brace matching) and only need to know where to start.
 */
function anchorIndex(src, anchor) {
    const at = typeof src === 'string' ? src.indexOf(anchor) : -1;
    if (at < 0) {
        throw new Error('anchorIndex: anchor not found: ' + JSON.stringify(anchor) +
            '. The code it named has been renamed, resignatured or removed.');
    }
    return at;
}

module.exports = {
    anchoredSlice: anchoredSlice,
    anchoredWindow: anchoredWindow,
    anchorIndex: anchorIndex,
    balancedEnd: balancedEnd,
    shareOfBlock: shareOfBlock
};

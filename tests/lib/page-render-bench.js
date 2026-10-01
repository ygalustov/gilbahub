'use strict';

/**
 * GH-792 (queue item 79) — WHAT A PAGE PRINTS, taken by rendering it.
 *
 * WHY THIS EXISTS. The words of an empty section are the subject of this item, and the coordinator set the
 * universe on 30.09.2026: "the universe is what is PRINTED on the pages, not the literals in the files...
 * `it became 0` is counted by what the page drew for a person, and is taken by rendering rather than by
 * `grep` over string literals". A census of literals is answered by a new place to write one; a census of
 * what was drawn is not.
 *
 * WHAT IT DOES. Runs a page's own source in a `vm` context with a document stub, calls the render the page
 * itself calls, and gives back the TEXT of what landed in the container: tags removed, entities expanded,
 * whitespace collapsed. Five of the seven pages publish no render at all -- water balance and `/plan` publish
 * nothing, soil, stress and disease publish only `init`/`boot` -- so the entry is exposed by inserting one
 * line inside the page's own closure, immediately before it closes. The insertion is declared per page and
 * printed with the result, which is the point below.
 *
 * IT PRINTS WHAT IT CALLED. `called: render` beside the text, because "the section printed nothing" and "the
 * bench never reached the section" look alike otherwise, and a page whose entry moved would answer the
 * second while reading as the first.
 *
 * WHAT IT IS NOT. Not a browser: a `vm` with a document stub does not lay out, does not run styles, and does
 * not see text another script inserts later. Anything resting on those is named as a boundary by the case,
 * not passed over in silence.
 */

const fs = require('fs');
const path = require('path');
const vm = require('vm');

const ROOT = path.join(__dirname, '..', '..');

/** How each page closes its own closure — the one place a test entry can be inserted from inside. */
const CLOSERS = [
    "\n}(typeof window !== 'undefined' ? window : this));",
    '\n}(window));',
    "\n})(typeof window !== 'undefined' ? window : this);",
];

/** A container that keeps what was written into it, and nothing else. */
function stubContainer() {
    const el = {
        innerHTML: '', textContent: '', style: {}, dataset: {},
        classList: { add() {}, remove() {}, contains: () => false, toggle() {} },
        appendChild() {}, removeChild() {}, insertBefore() {}, remove() {},
        addEventListener() {}, removeEventListener() {},
        setAttribute() {}, getAttribute: () => null, insertAdjacentHTML() {},
        querySelector: () => null, querySelectorAll: () => [],
        closest: () => null, contains: () => false, focus() {}, scrollIntoView() {},
    };

    return el;
}

/** The text a person would read out of the HTML a render produced. */
function printedText(html) {
    return String(html || '')
        .replace(/<style[\s\S]*?<\/style>/gi, ' ')
        .replace(/<script[\s\S]*?<\/script>/gi, ' ')
        .replace(/<[^>]*>/g, ' ')
        .replace(/&nbsp;/g, ' ')
        .replace(/&amp;/g, '&')
        .replace(/&lt;/g, '<')
        .replace(/&gt;/g, '>')
        .replace(/&quot;/g, '"')
        .replace(/&#39;/g, "'")
        .replace(/\s+/g, ' ')
        .trim();
}

/**
 * Render one page and return what it printed.
 *
 * @param {Object} options
 * @param {string} options.file      the page's file in `assets`
 * @param {string} options.entry     the function inside the page this bench calls
 * @param {string} options.container the id the page looks its container up by
 * @param {Object} [options.globals] what the page finds on `window` (the row, the composer's texts, …)
 * @param {Object} [options.elements] extra elements by id, for a page that looks several up
 * @param {string[]} [options.shared] scripts the layout loads before the page, in that order
 * @returns {{printed: string, html: string, called: string, containerId: string, file: string}}
 */
function renderPage(options) {
    const o = options || {};
    if (!o.file || !o.entry || !o.container) {
        throw new Error('page-render-bench: a render needs its file, its entry and its container id — a bench '
            + 'that guesses any of the three answers about a page nobody has.');
    }
    const src = fs.readFileSync(path.join(ROOT, 'assets', o.file), 'utf8');
    const closer = CLOSERS.find((c) => src.endsWith(c) || src.trimEnd().endsWith(c.trim()));
    if (!closer) {
        throw new Error('page-render-bench: ' + o.file + ' does not close the way this bench knows, so the '
            + 'entry cannot be exposed from inside its closure. Declare the new shape here rather than '
            + 'reaching around it.');
    }
    const at = src.lastIndexOf(closer.trim());
    const patched = src.slice(0, at)
        + '\n;try { global.__benchEntry = ' + o.entry + '; } catch (e) { global.__benchEntry = null; }\n'
        + src.slice(at);

    const container = stubContainer();
    const byId = Object.assign({ [o.container]: container }, (function () {
        // Extra elements a page looks up by id; `true` means "it is there", with a stub of its own.
        const extra = {};
        Object.keys(o.elements || {}).forEach((id) => {
            extra[id] = o.elements[id] === true ? stubContainer() : o.elements[id];
        });

        return extra;
    }()));
    const sandbox = {
        console: { log() {}, warn() {}, error() {}, info() {}, debug() {} },
        Date, Math, JSON, Object, Array, String, Number, Boolean, RegExp, Error, Map, Set, Promise,
        parseFloat, parseInt, isNaN, isFinite, encodeURIComponent, decodeURIComponent,
        setTimeout: () => 0, clearTimeout() {}, setInterval: () => 0, clearInterval() {},
        localStorage: { getItem: () => null, setItem() {}, removeItem() {} },
        fetch: () => Promise.reject(new Error('the bench has no network')),
        URLSearchParams: require('url').URLSearchParams,
        // A page may bind to the window on load; a bench without these throws where a browser would not.
        addEventListener() {}, removeEventListener() {}, dispatchEvent: () => true,
        location: { search: '', pathname: '/', hash: '', href: '' },
        history: { pushState() {}, replaceState() {}, back() {} },
        CustomEvent: class { constructor(t, i) { this.type = t; this.detail = i && i.detail; } },
        Event: class { constructor(t) { this.type = t; } },
        MutationObserver: class { observe() {} disconnect() {} takeRecords() { return []; } },
    };
    sandbox.document = {
        readyState: 'complete',
        getElementById: (id) => byId[id] || null,
        querySelector: () => null,
        querySelectorAll: () => [],
        createElement: () => stubContainer(),
        addEventListener() {}, removeEventListener() {},
        head: stubContainer(), body: stubContainer(),
    };
    sandbox.window = sandbox;
    sandbox.global = sandbox;
    sandbox.globalThis = sandbox;
    Object.assign(sandbox, o.globals || {});

    const ctx = vm.createContext(sandbox);
    /**
     * GH-792: the shared scripts FIRST, in the same context, because that is the order a page loads them in.
     * `dashboard-ui.js` carries the one reader of the composer's words, and a reader loaded into a context of
     * its own would look for the answer on a different `window` -- which is a bench measuring itself.
     */
    (o.shared || []).forEach((name) => {
        vm.runInContext(fs.readFileSync(path.join(ROOT, 'assets', name), 'utf8'), ctx, { filename: name });
    });
    vm.runInContext(patched, ctx, { filename: o.file });
    if (typeof ctx.__benchEntry !== 'function') {
        throw new Error('page-render-bench: ' + o.file + ' has no function named ' + o.entry
            + ' — the bench did not reach a render, which is a different answer from "the page printed '
            + 'nothing".');
    }
    /**
     * A page draws in one of two shapes, and the bench takes both rather than assuming one: most write into
     * the container they looked up, and some RETURN the html for a caller to place. Reading only the container
     * answered "the section printed nothing" about a page that had printed it into its return value.
     */
    /**
     * Most entries take the container; some take what they draw FROM (a section of the computed result, a
     * panel key) and look their own container up. The case says which, rather than the bench guessing.
     */
    const returned = o.argumentIsNone
        ? ctx.__benchEntry()
        : ctx.__benchEntry(o.argument === undefined ? container : o.argument);
    /**
     * THE RETURNED HTML WINS when there is some. A page that self-initialises on load has already written a
     * full render into the container by the time a BLOCK of it is called by name, and reading the container
     * would answer about that earlier render instead of about the block asked for -- measured on Growth &
     * Light, where it returned the whole page and the block's own text was nowhere in it.
     */
    const html = (typeof returned === 'string' && returned) ? returned : container.innerHTML;

    return {
        file: o.file,
        called: o.entry,
        containerId: o.container,
        wrote: (typeof returned === 'string' && returned) ? 'as its return value'
            : (container.innerHTML ? 'into the container' : 'nothing'),
        html: html,
        printed: printedText(html),
    };
}

module.exports = { renderPage, printedText, stubContainer };

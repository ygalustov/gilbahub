'use strict';

/**
 * THE RE-RUN BUTTON, PRESSED, AND THE ADDRESS IT BUILDS.
 *
 * WHY THIS EXISTS. Found by the reviewer on 23.09.2026 and confirmed by the
 * coordinator: the path from the press to the runner had three links and only
 * two were tested.
 *
 *   the server answered           — executed by `gh588`
 *   the address was assembled     — EXECUTED BY NOBODY
 *   the runner parsed a parameter — executed by `gh588`/`gh586`, on an address
 *                                   the test wrote itself
 *
 * So every existing case stayed green against an opener that stopped appending
 * `&soil=`, spelled it differently, or encoded it twice — and the runner in the
 * product would land in the `told: 'absent'` branch, which does not wait for the
 * sample at all. That is the exact defect link 4 was built to remove, reachable
 * with the whole suite green.
 *
 * WHAT THIS DOES. Loads `assets/dashboard-ui.js` with a page stub that has the
 * Re-run button on it, lets the module wire itself the way it does on a real
 * page, presses the button, and returns THE ADDRESS THE PRODUCT BUILT. Nothing
 * here writes a URL; the tests hand what comes back to the real runner.
 *
 * The positive control is not optional and is asserted by the callers: a press
 * that produced no address at all would make every claim about that address
 * vacuously true.
 */

const vm = require('vm');
const fs = require('fs');
const path = require('path');

const ASSETS = path.join(__dirname, '..', '..', 'assets');

function stubEl(id) {
    return {
        id: id || '', style: {}, dataset: {}, textContent: '', innerHTML: '',
        disabled: false, value: '', checked: false,
        classList: { add() {}, remove() {}, contains: () => false, toggle() {} },
        addEventListener() {}, removeEventListener() {},
        appendChild() {}, removeChild() {}, setAttribute() {}, getAttribute: () => null,
        querySelector: () => null, querySelectorAll: () => [], closest: () => null,
    };
}

/**
 * Press Re-run and return what the opener built.
 *
 * @param {object}   opts
 * @param {string}   opts.siteId          the active site the page is standing on
 * @param {*}        opts.serverAnswer    what `/api/samples` replies with; the
 *                                        string 'throw' rejects, 'http-500'
 *                                        answers not-ok
 * GH-777: the opener puts the ROW ID of the chosen water on the address (`_aws.serverId`), because the row
 * is a sample's one name and the client store's key is not. So the page's chosen sample is given here the
 * way the page holds it: a client key in `id` and the row in `serverId`.
 *
 * @param {?string}  opts.chosenWaterId   `_gilbaActiveWaterSample`, or null for
 *                                        a page where no water sample is chosen
 * @returns {Promise<{url: ?string, requested: string[]}>}
 */
async function pressRerun({ siteId, serverAnswer, chosenWaterId }) {
    const src = fs.readFileSync(path.join(ASSETS, 'dashboard-ui.js'), 'utf8');

    const requested = [];
    const iframes = [];
    let clickHandler = null;

    const btn = stubEl('db-rerun-btn');
    btn.addEventListener = (type, fn) => { if (type === 'click') clickHandler = fn; };

    const sandbox = {
        console: { log() {}, warn() {}, error() {} },
        document: {
            readyState: 'complete',
            addEventListener() {}, removeEventListener() {},
            getElementById: (id) => (id === 'db-rerun-btn' ? btn : null),
            querySelector: () => null,
            querySelectorAll: () => [],
            createElement: (tag) => {
                const el = stubEl();
                el.tagName = String(tag).toUpperCase();
                if (String(tag).toLowerCase() === 'iframe') iframes.push(el);
                return el;
            },
            head: stubEl(), body: stubEl(),
        },
        setTimeout: () => 0, clearTimeout() {}, setInterval: () => 0, clearInterval() {},
        location: { search: '', href: 'http://localhost/dashboard', reload() {} },
        URL, URLSearchParams, Date, JSON, Math, Object, Array, String, Number,
        parseFloat, parseInt, isNaN, Promise, encodeURIComponent, decodeURIComponent,
        fetch: (url) => {
            requested.push(url);
            if (serverAnswer === 'throw') return Promise.reject(new Error('offline'));
            if (serverAnswer === 'http-500') return Promise.resolve({ ok: false, status: 500 });
            return Promise.resolve({ ok: true, status: 200, json: () => Promise.resolve(serverAnswer) });
        },
    };
    // The opener listens on the window for the runner's `postMessage`.
    sandbox.addEventListener = () => {};
    sandbox.removeEventListener = () => {};
    sandbox.window = sandbox; sandbox.global = sandbox; sandbox.globalThis = sandbox;
    sandbox.GAIP_HUB_CONFIG = { activeSiteId: siteId };
    // The page's chosen water sample, where there is one. This is the global the
    // water-balance screen sets; `null` is a dashboard where nobody chose.
    if (chosenWaterId != null) {
        sandbox._gilbaActiveWaterSample = (typeof chosenWaterId === 'object')
            ? chosenWaterId
            : { id: chosenWaterId, serverId: chosenWaterId };
    }

    const ctx = vm.createContext(sandbox);
    vm.runInContext(src, ctx, { filename: 'dashboard-ui.js' });

    if (typeof clickHandler !== 'function') {
        return { url: null, requested, why: 'the module never wired the Re-run button' };
    }
    clickHandler({ preventDefault() {} });

    // The address is assigned inside the promise the server answer resolves.
    await new Promise((r) => setImmediate(r));
    await new Promise((r) => setImmediate(r));

    const withSrc = iframes.filter((f) => typeof f.src === 'string' && f.src.length);
    return { url: withSrc.length ? withSrc[withSrc.length - 1].src : null, requested };
}

/** The query of an address the product built, parsed the way a browser parses it. */
function queryOf(url) {
    return new URL(url, 'http://localhost').searchParams;
}

module.exports = { pressRerun, queryOf };

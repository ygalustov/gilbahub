'use strict';
/**
 * Measurement 3bd (analyst sections 84, 86) — does a browser-storage read CACHE
 * or DECIDE? Classified by where the value read goes, not by reading the code.
 *
 * LAYER 1 — census (static, this file, no stand). Every storage read in
 * assets/*.js, found by form and not by receiver: any `.getItem(` / `.key(`,
 * `Object.keys(<storage>)`, bracket access on a name bound to a storage, and the
 * calls of wrappers found by definition (a function whose body returns
 * `<x>.getItem(<its parameter>)`). A read whose value is compared with `===`, or
 * passed to `.some/.find/.includes/.indexOf` in the same function, is flagged
 * MEMBER-CHECKED (86.6): a string marker would fail that check and the branch
 * would silently not run.
 *
 * LAYER 2 — behaviour (live, one press). Before any page script, getItem is
 * wrapped: every read returns a MARKED value for the key actually asked
 * (string leaves -> a marker naming the key, numbers -> a sentinel outside the
 * data, member-checked keys -> a real id the check accepts). Each read records
 * its stack, so a read is attributed to a census site by file and line. The
 * markers are then looked for in the sinks, heaviest first:
 *   writeback      — a request body or URL (every write is held, never sent);
 *   decides-input  — a form field value, or the held analysis row;
 *   display        — page text only;
 *   inert          — nowhere.
 *
 * THREE OUTCOMES PER CENSUS SITE (coordinator, after 93.1 printed a false cause):
 *   EXECUTED       — a read in the run came from that file:line (any key form),
 *                    with the runtime keys and the class of the heaviest sink;
 *   NOT EXECUTED   — no read in the run came from that file:line;
 *   NOT FOUND      — the other direction: a read whose stack names an assets
 *                    file but no census site — the census missed it.
 * Marker ids are unique per document (a tag), so a marker is never matched
 * against a sink of another page.
 *
 * POSITIVE CONTROLS, asserted. In the data: gilba_import_active_site ->
 * writeback, gilba_hub_state_<uid> -> decides-input, gilba_disease_cache_purged_v1
 * -> inert (a live read whose value only feeds an `if`). Planted at runtime in a script that did not exist: a read through a
 * NEW wrapper into a POST body, a bracket read into a form field, a read
 * through the namespaced `_ls` into an attribute, a read into page text, a
 * read used nowhere. One plant per class; each must come out in its class.
 *
 * WHAT IT WRITES. Nothing to site data: every request except GET is held and
 * answered 200. One declared exception, as in 93.3: PATCH /api/active-site when
 * GILBA_3BD_SWITCH_TO names a site; the pointer is put back in afterAll.
 * Storage writes happen only in the test browser.
 *
 * Silent unless BOTH GILBA_E2E=1 and GILBA_E2E_MEASURE_3BD=1.
 */
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const { execFileSync } = require('child_process');

const ENABLED = process.env.GILBA_E2E === '1' && process.env.GILBA_E2E_MEASURE_3BD === '1';
const ROOT = path.join(__dirname, '..', '..');
const ASSETS = path.join(ROOT, 'assets');
const VIEWS = path.join(ROOT, 'app', 'resources', 'views');
const OUT_DIR = path.join(ROOT, 'files', 'fixes', '26-08-17-hoxton-v6', 'live-runs');
const SWITCH_TO = process.env.GILBA_3BD_SWITCH_TO || null;
/**
 * GH-694 — THE DRY PASS: THE WHOLE PATH, MEASURING NOTHING.
 *
 * This instrument gets one press. Before the failed one, its live half had never executed: the
 * reviewer accepted it by reading, layer 1 covers only its pure functions, and an undeclared
 * variable in the body survived all of that and killed the press with nothing measured.
 *
 * `GILBA_3BD_DRY=1` runs every step against a harmless target — browser, login, the routing that
 * holds writes, the reader installed in the page, ONE view, collection, classification, the control
 * block, the header, the file — and measures nothing by design: no pointer is moved, no Re-run is
 * pressed, so no non-GET reaches the stand and no `RunStart` row is written. A failure surfaces
 * HERE rather than on the press.
 *
 * ITS JOURNAL IS NOT A MEASUREMENT AND CANNOT BE MISTAKEN FOR ONE: the file is named
 * `3bd-DRY-not-a-measurement-…`, a standing line says so, and every reading carries `UNTRUSTED`.
 *
 * WHERE IT WRITES, SAID THE WAY THE CODE DOES IT. This paragraph used to claim the journal is
 * written outside the repository unless told otherwise; the code does the opposite — the default is
 * the ordinary output directory beside the real journals, and outside only when `GILBA_3BD_OUT`
 * says so. The instrument does what its code says, and it was the sentence that disagreed. So: the
 * default is BESIDE the real journals, the journal's own header names the path it was written to, and
 * `3bd-DRY-*` is ignored by git — because a rehearsal artefact sitting in the record next to real
 * ones will one day be read as a measurement, and a name alone does not stop that.
 */
/**
 * GH-696 — THE KEYS THE DATA CONTROLS STAND ON, DECLARED ONCE AND READ TWICE.
 *
 * The controls check these three against real reads; the dry pass needs to know which pages can
 * reach them, or it opens one view and reports four failures that mean only "we did not go there".
 * Written in one place because two lists of the same three keys drift the first time one changes.
 */
const DATA_CONTROL_KEYS = ['gilba_import_active_site', 'gilba_hub_state', 'gilba_disease_cache_purged_v1'];
/**
 * GH-701 — THE EXACT KEY, BY THE RULE THAT BUILDS IT, not by a prefix and not by a literal.
 *
 * The control asked about `gilba_hub_state` and matched by prefix, and half the reason it failed was
 * that: the key in the tree carries a suffix. `hub-persistence.js` builds it as
 * `'gilba_hub_state' + (userId ? '_' + userId : '')` — the suffix is the USER, so writing
 * `gilba_hub_state_1` would bind the control to whoever user 1 is on this stand.
 *
 * The two questions need the two forms and that is why both stay: the CONTROL asks about one exact
 * key, and the dry pass's choice of views asks which census sites read a key of that FAMILY, because
 * the census sees the expression, not the value.
 */
const exactHubStateKey = (userId) => 'gilba_hub_state' + (userId ? '_' + userId : '');

/**
 * GH-701 (the reviewer's return) — THE CONTROL IS BUILT BY A FUNCTION, SO SOMETHING WITHOUT THE STAND
 * CAN SEE IT.
 *
 * His finding, and it is right: the expectation and the key both lived inside the live half, which
 * the ordinary run skips. He put each back — the suffix removed, the expectation returned to
 * `decides-input` — and the suite did not notice either. A repair nothing can guard without a press
 * is a repair that lasts until the next person edits that line.
 *
 * WHY THE EXPECTATION IS `inert`, kept beside the value it decides: the control asked for
 * `decides-input` and the instrument answered `inert`. Which of the two was wrong had been settled
 * BEFORE the press — if the run frame is enumerated and no marker is found in it, the control is —
 * and the third press settled the premise: the frame IS enumerated on a live pass, six markers were
 * issued inside it with sinks in it. So the value reaches no field, and that is the product's answer
 * rather than a hole in the measurement.
 */
function hubStateControl(userId, classOf) {
    const key = exactHubStateKey(userId);

    return {
        name: key + ' kind',
        expected: 'inert',
        got: (classOf || {})[key] || 'NOT MARKED',
    };
}
const DRY = process.env.GILBA_3BD_DRY === '1';
const WRITE_TO = process.env.GILBA_3BD_OUT || OUT_DIR;
const SIGN_VERSION = 1;
const SENSOR = /sensor|hydrosight|specconnect|tdr_session/i;   // sensor data is not seeded on the stand and is not judged here

let credentials = {};
try {
    credentials = JSON.parse(fs.readFileSync(
        process.env.GILBA_E2E_CREDENTIALS || path.join(__dirname, '.e2e-credentials.json'), 'utf8'));
} catch (e) { credentials = {}; }
const BASE_URL = process.env.GILBA_E2E_URL || credentials.url || 'http://127.0.0.1:8080';
const EMAIL = process.env.GILBA_E2E_EMAIL || credentials.email;
const PASSWORD = process.env.GILBA_E2E_PASSWORD || credentials.password;

let chromium = null;
try { ({ chromium } = require('playwright')); } catch (e) { /* reported below */ }
let guardStand = null;
try { ({ guardStand } = require('./lib/stand-guard')); } catch (e) { /* reported below */ }
const parser = require('@babel/parser');
const traverse = require('@babel/traverse').default;

// ── output ──────────────────────────────────────────────────────────────────
/**
 * GH-691 — THERE IS NO ONE `say()` ANY MORE, and that is the point of the rework.
 *
 * A single stream printed the instrument's own controls in among its readings, so a reading could be
 * quoted without the verdict that qualifies it. The output is now built from four parts, emitted in
 * this order: the two verdict lines, the standing statements (the date, what pass O is, what this run
 * wrote), the `CONTROL` block, and only then the readings — each of which carries `UNTRUSTED` when a
 * control failed. Readings go to `rsay`, statements to `standing`, controls to `controls`.
 */

// ── tree map (93.2) ─────────────────────────────────────────────────────────
const SKIP = [path.join('app', 'vendor'), path.join('app', 'storage'), 'node_modules'];
function walk(dir, out) {
    for (const name of fs.readdirSync(dir)) {
        const full = path.join(dir, name);
        const rel = path.relative(ROOT, full);
        if (SKIP.some((s) => rel === s || rel.startsWith(s + path.sep) || rel.includes(path.sep + 'node_modules'))) continue;
        const st = fs.statSync(full);
        if (st.isDirectory()) walk(full, out);
        else out[rel] = crypto.createHash('md5').update(fs.readFileSync(full)).digest('hex');
    }
    return out;
}
const treeMap = () => walk(path.join(ROOT, 'app'), walk(ASSETS, {}));
const aggregate = (m) => crypto.createHash('md5').update(Object.keys(m).sort().map((k) => k + ' ' + m[k]).join('\n')).digest('hex');
function diffMaps(a, b) {
    const out = [];
    Object.keys(a).forEach((k) => { if (!(k in b)) out.push('removed  ' + k); else if (a[k] !== b[k]) out.push('changed  ' + k); });
    Object.keys(b).forEach((k) => { if (!(k in a)) out.push('added    ' + k); });
    return out.sort();
}

// ── LAYER 1: census ─────────────────────────────────────────────────────────
function keyForm(node) {
    if (!node) return { form: 'none' };
    if (node.type === 'StringLiteral') return { form: 'literal', key: node.value };
    if (node.type === 'TemplateLiteral') return { form: 'prefix', key: node.quasis[0].value.cooked };
    if (node.type === 'BinaryExpression' && node.operator === '+') {
        const left = keyForm(node.left);
        if (left.form === 'literal' || left.form === 'prefix') return { form: 'prefix', key: left.key };
    }
    return { form: 'dynamic', key: null };
}
const STORAGE_NAMES = /^(localStorage|sessionStorage|_ls|_lsAM|storage|ls)$/;

function censusOfSource(file, src) {
    const sites = [];
    const wrappers = new Set();
    let ast;
    try {
        ast = parser.parse(src, { sourceType: 'unambiguous', errorRecovery: true, plugins: ['optionalChaining', 'nullishCoalescingOperator'] });
    } catch (e) { return { sites: [{ file, line: 0, form: 'parse-error', key: e.message.slice(0, 80) }], wrappers: [] }; }
    if (ast.errors && ast.errors.length) sites.push({ file, line: 0, form: 'parsed-with-errors', key: String(ast.errors.length) });
    // wrappers by definition
    traverse(ast, {
        Function(p) {
            const params = p.node.params.map((x) => x.name).filter(Boolean);
            if (!params.length) return;
            p.traverse({
                ReturnStatement(r) {
                    const a = r.node.argument;
                    if (a && a.type === 'CallExpression' && a.callee.type === 'MemberExpression'
                        && !a.callee.computed && a.callee.property.name === 'getItem'
                        && a.arguments[0] && a.arguments[0].type === 'Identifier' && params.includes(a.arguments[0].name)) {
                        const name = p.node.id ? p.node.id.name
                            : (p.parent && p.parent.type === 'VariableDeclarator' && p.parent.id.name)
                              || (p.parent && p.parent.type === 'ObjectProperty' && p.parent.key.name) || null;
                        if (name) wrappers.add(name);
                    }
                },
            });
        },
    });
    function memberChecked(p) {
        // the value of this read, in the same function, compared or looked up
        const fn = p.getFunctionParent();
        let bound = null;
        if (p.parent.type === 'VariableDeclarator') bound = p.parent.id.name;
        if (p.parent.type === 'AssignmentExpression' && p.parent.left.type === 'Identifier') bound = p.parent.left.name;
        if (!bound || !fn) return false;
        let hit = false;
        fn.traverse({
            BinaryExpression(b) { if (/^[!=]==?$/.test(b.node.operator) && [b.node.left, b.node.right].some((n) => n.type === 'Identifier' && n.name === bound)) hit = true; },
            CallExpression(c) {
                const cal = c.node.callee;
                if (cal.type === 'MemberExpression' && !cal.computed && /^(some|find|includes|indexOf|findIndex)$/.test(cal.property.name)
                    && c.node.arguments.some((a) => a.type === 'Identifier' && a.name === bound)) hit = true;
            },
        });
        return hit;
    }
    traverse(ast, {
        CallExpression(p) {
            const c = p.node.callee;
            const line = p.node.loc ? p.node.loc.start.line : 0;
            if (c.type === 'MemberExpression' && !c.computed && (c.property.name === 'getItem' || c.property.name === 'key')) {
                const k = keyForm(p.node.arguments[0]);
                sites.push({ file, line, form: c.property.name === 'key' ? 'enumerate' : k.form, key: k.key,
                    receiver: c.object.type === 'Identifier' ? c.object.name : (c.object.type === 'MemberExpression' ? 'member' : c.object.type),
                    memberChecked: c.property.name === 'getItem' ? memberChecked(p) : false });
            } else if (c.type === 'Identifier' && wrappers.has(c.name)) {
                const k = keyForm(p.node.arguments[0]);
                sites.push({ file, line, form: 'wrapper:' + c.name + ':' + k.form, key: k.key, receiver: c.name, memberChecked: memberChecked(p) });
            } else if (c.type === 'MemberExpression' && !c.computed && c.property.name === 'keys'
                && c.object.type === 'Identifier' && c.object.name === 'Object'
                && p.node.arguments[0] && p.node.arguments[0].type === 'Identifier' && STORAGE_NAMES.test(p.node.arguments[0].name)) {
                sites.push({ file, line, form: 'enumerate', key: null, receiver: p.node.arguments[0].name, memberChecked: false });
            }
        },
        MemberExpression(p) {
            if (p.node.computed && p.node.object.type === 'Identifier' && /^(localStorage|sessionStorage)$/.test(p.node.object.name)) {
                if (p.parent.type === 'AssignmentExpression' && p.parent.left === p.node) return;   // a write
                const k = keyForm(p.node.property);
                sites.push({ file, line: p.node.loc ? p.node.loc.start.line : 0, form: 'bracket:' + k.form, key: k.key, receiver: p.node.object.name, memberChecked: false });
            }
        },
    });
    return { sites, wrappers: Array.from(wrappers) };
}
function census() {
    const all = [];
    const files = fs.readdirSync(ASSETS).filter((f) => f.endsWith('.js') && !f.endsWith('.min.js'));
    files.forEach((f) => { censusOfSource(f, fs.readFileSync(path.join(ASSETS, f), 'utf8')).sites.forEach((s) => all.push(s)); });
    return { files: files.length, sites: all };
}
// The layer-1 plants: sources that exist nowhere in the tree, one per form it must see.
const PLANT_SRC = [
    "function rd(k){ return window.localStorage.getItem(k); }\nvar a = rd('probe_wrapper_key');",
    "var b = localStorage['probe_bracket_key'];",
    "var _ls = window.GilbaStorageNS.get();\nvar c = _ls.getItem('probe_ns_key');",
].join('\n');

// ── views that load a file with a census site ──────────────────────────────
function viewScripts() {
    const out = {};
    (function rec(dir) {
        for (const name of fs.readdirSync(dir)) {
            const full = path.join(dir, name);
            if (fs.statSync(full).isDirectory()) { rec(full); continue; }
            if (!name.endsWith('.blade.php')) continue;
            const view = path.relative(VIEWS, full).replace(/\.blade\.php$/, '');
            const src = fs.readFileSync(full, 'utf8');
            out[view] = new Set((src.match(/['"]([a-z0-9._-]+\.js)['"]/gi) || []).map((m) => m.slice(1, -1)));
        }
    })(VIEWS);
    return out;
}
// The routes a person opens for the views that matter here. A view with no route here is
// printed as "view not visited", not silently skipped.
const VIEW_ROUTES = {
    dashboard: '/dashboard?setup=0', analysis: '/analysis', 'analysis/disease': '/analysis/disease',
    'analysis/growth-light': '/analysis/growth-light', plan: '/plan', data: '/data', settings: '/settings',
    'field-log': '/field-log', 'reports/export': '/reports/export', 'reports/forensic': '/reports/forensic',
    'reports/scenarios': '/reports/scenarios', stadium: '/stadium', 'morning-briefing': '/morning-briefing',
};

/**
 * GH-691 — THE INSTRUMENT IS PRINTED BEFORE ITS READINGS, AND THESE THREE FUNCTIONS DECIDE IT.
 *
 * They are pure on purpose. The condition for this part is that a developer can show a reviewer,
 * WITHOUT THE STAND, that one failed control turns the header into `INSTRUMENT NOT VALID` and every
 * reading into `UNTRUSTED` — and a demonstration done by hand once is not a demonstration. Layer 1
 * feeds them a failing control and reads the answer.
 *
 * Why the order matters: a reading printed above the verdict on the instrument gets quoted on its
 * own. The two header lines come first, the `CONTROL` block second, the readings last.
 */
function instrumentBlock(controls) {
    const same = (c) => JSON.stringify(c.expected) === JSON.stringify(c.got);
    const lines = controls.map((c) => 'CONTROL | ' + c.name
        + ' | expected ' + JSON.stringify(c.expected)
        + ' | got ' + JSON.stringify(c.got)
        + ' | ' + (same(c) ? 'ok' : 'FAIL'));
    const failed = controls.filter((c) => !same(c)).map((c) => c.name);

    return { lines, failed };
}

/**
 * The two header lines, in this order and no other. `RUN` is about the run: did the tree stay
 * still, did the pointer come back, did we get past the login. `INSTRUMENT` is about the device.
 * A run can be valid with an unfit instrument, and then nothing it printed is a finding.
 */
function headerLines({ drift, pointerBefore, pointerAfter, failedControls }) {
    const run = [];
    if (drift && drift.length) run.push('tree moved: ' + JSON.stringify(drift));
    if (pointerBefore === null) run.push('never got past login');
    else if (pointerAfter !== pointerBefore) run.push('pointer not restored: before ' + pointerBefore + ', now ' + pointerAfter);

    return [
        run.length ? 'RUN INVALID: ' + run.join(' | ') : 'RUN valid',
        failedControls.length ? 'INSTRUMENT NOT VALID: ' + failedControls.join(', ') : 'INSTRUMENT valid',
    ];
}

/** Every reading carries the verdict on the instrument with it, or it gets quoted on its own. */
function stampUntrusted(readingLines, untrusted) {
    return untrusted ? readingLines.map((l) => 'UNTRUSTED ' + l) : readingLines;
}

/**
 * GH-694 — THE WHOLE JOURNAL, ASSEMBLED IN ONE PLACE.
 *
 * Two callers built it: the writer at the end of the run and the measuring test for the terminal.
 * Both had to remember the order, and neither could be asked whether the control list it was handed
 * was the assembled one or an empty array — which is exactly the question the failed press raised.
 * One function, and its answer can be read by a caller and by a test.
 *
 * `controlsMissing` is not the same as `a control failed`: a run whose measuring test never reached
 * the end has NO controls, and a journal that printed readings under `INSTRUMENT valid` because the
 * list happened to be empty would be the worst outcome available.
 */
function assembleJournal({ drift, pointerBefore, pointerAfter, controls, standing, readingLines, dry }) {
    const inst = instrumentBlock(controls || []);
    const controlsMissing = !controls || controls.length === 0;
    const head = headerLines({
        drift, pointerBefore, pointerAfter,
        failedControls: controlsMissing ? ['no controls were assembled — the measuring test did not reach the end'] : inst.failed,
    });
    const block = controlsMissing
        ? ['CONTROL | none were assembled | expected a full set | got none | FAIL']
        : inst.lines;
    const untrusted = controlsMissing || inst.failed.length > 0 || Boolean(dry);

    return {
        lines: head.concat(standing || []).concat(block).concat(stampUntrusted(readingLines || [], untrusted)),
        head, block, untrusted, controlsMissing, failed: inst.failed,
    };
}

/**
 * GH-691 — THE EXECUTION CLASS, AND IT IS A FUNCTION OF THE TWO PASSES AND NOTHING ELSE.
 *
 * `in-both` is a client's behaviour. `only-under-fabrication` ran because we put something in the
 * storage, so it is POSSIBLE for a client and NOT SHOWN — the one distinction the second pass exists
 * for. `only-without-fabrication` is the opposite: our own values stopped the page doing something it
 * does for a client, which is a limit of the measurement and prints as one. `null` means it never ran.
 *
 * Pure, and tested by layer 1: this instrument gets one press and no second, so the arithmetic of it
 * must not wait on the stand to be checked.
 */
function executionClass(ranInO, ranInP) {
    if (ranInO && ranInP) return 'in-both';
    if (ranInP) return 'only-under-fabrication';
    if (ranInO) return 'only-without-fabrication';

    return null;
}

/**
 * GH-691 — WHY A READ SITE DID NOT RUN IN EITHER PASS, from facts the run itself printed.
 *
 * Every cause is something the journal shows elsewhere: which views load the file, which views were
 * opened, which writes were held on them. The last one is the honest residue — the page was opened,
 * nothing was held, and the read still did not happen, which on empty and on fabricated storage is
 * all this run can say. A long-time client's storage is not covered and the cause says so.
 */
function causeFor({ viewsWithIt, visitedViews, heldOnThoseViews }) {
    const cause = [];
    if (!viewsWithIt.length) cause.push('file-not-on-visited-views');
    else if (!viewsWithIt.some((v) => visitedViews.includes(v))) cause.push('page-not-opened');
    if (heldOnThoseViews.length) cause.push('after-held-write');
    if (!cause.length) cause.push('not-reached-on-empty-or-fabricated-storage; long-time client not covered');

    return cause;
}

/**
 * GH-697 — DID THE PASS SEE ANYTHING AT ALL, decided from what it recorded and from nothing else.
 *
 * The first dry pass wrote a journal and the reviewer read it as "there was a file, there was no
 * sight": `INSTRUMENT NOT VALID`, and no way to tell a device that looked and found nothing from one
 * that never looked. These five conditions are that difference, and every one of them is computed
 * over reads WITHOUT the plants — a plant is ours, and a device proving itself with its own plants
 * proves only that it can plant.
 *
 *   1. intercepted > 0            in O and in P — the wrapper was installed and the page ran;
 *   2. bound to a census LINE > 0 in O and in P — the stacks reach the sites the census declared;
 *   3. a marker reached a sink    in P ONLY — `O` does not fabricate, so it has no markers, and this
 *                                 condition asked of it would make the device unfit on every press;
 *   4. names a census FILE but no census line = 0, in both — the file is known and the tree did not
 *                                 move, so such a read is a BROKEN BINDING, not a gap in the census;
 *   5. views opened where asked, BY NAME, per pass — an empty list and "no ROUTE lines" are the same
 *                                 fact, and it makes the device unfit.
 *
 * Condition 3's boundary is the analyst's (86.14) and it is the kind that matters: a condition that
 * cannot be met is indistinguishable from one that was not met.
 */
function stackNamesSite(stack, site) {
    return new RegExp('/' + String(site.file).replace(/[.]/g, '\\.') + '(\\?[^:]*)?:' + site.line + ':').test(stack || '');
}
function stackNamesFile(stack, file) {
    return new RegExp('/' + String(file).replace(/[.]/g, '\\.') + '(\\?[^:]*)?:').test(stack || '');
}

function dryPassFitness({ passes, censusSites, viewRoutes }) {
    const failures = [];
    const numbers = {};
    const files = [...new Set((censusSites || []).map((s) => s.file))];
    ['O', 'P'].forEach((label) => {
        const pass = (passes || {})[label] || {};
        let numbersFrames = null;
        const reads = (pass.reads || []).filter((r) => !/^probe_/.test(r.key));
        const intercepted = reads.length;
        const bound = reads.filter((r) => (censusSites || []).some((s) => stackNamesSite(r.stack, s))).length;
        const fileButNoLine = reads.filter((r) => !(censusSites || []).some((s) => stackNamesSite(r.stack, s))
            && files.some((f) => stackNamesFile(r.stack, f))).length;
        /**
         * GH-698 — THE SIXTH CONDITION: THE FRAMES IT ENUMERATED, AND WHETHER IT ENUMERATED AT ALL.
         *
         * An empty enumeration list makes the device unfit for the same reason an empty `ROUTE` does:
         * "there were no frames" and "we never looked for frames" are one silence otherwise. And the
         * frames that were ATTACHED and never appeared in any enumeration are named separately,
         * because that is the line that decides where the fault is — in the control or in the device.
         */
        /**
         * GH-699 — THE THREE THINGS THE REVIEWER NAMED, and each is a claim about a NAME or a NUMBER,
         * never about a length.
         *
         * M-F1 — the list is non-empty BY SUBSTANCE: on a pass that pressed Re-run, a frame whose
         *   address carries `/hub?rerun=` must be among the enumerated ones. "More than nought
         *   entries" is satisfied by the top document, and that is the trap.
         * M-F2 — the moment and the list are ONE claim: the run frame must have been found by an
         *   enumeration taken AFTER the press. Asserted on the single record that holds both, so a
         *   mutation cannot move one without the other; if it could, the printed moment would be a
         *   caption.
         * M-F3 — every entry carries its own numbers. A name with no numbers is a name that was
         *   written down, not a frame that was read.
         *
         * TWO LISTS, because "not enumerated" and "did not exist" are one silence otherwise: what was
         * enumerated, and what the instrument KNEW existed (Playwright's own frame events) and did
         * not enumerate.
         */
        const scans = pass.frameScans || [];
        const entries = [].concat(...scans.map((x) => (x.frames || (x.urls || []).map((u) => ({ url: u })))));
        const scanned = new Set(entries.map((e) => e.url));
        const attached = (pass.frameEvents || []).filter((e) => e.kind === 'attached').map((e) => e.url);
        const attachedNeverScanned = [...new Set(attached.filter((u) => !scanned.has(u)))];
        const RUN_FRAME = /\/hub\?[^ ]*rerun/;
        const runFrameScans = scans.filter((x) => (x.frames || []).some((e) => RUN_FRAME.test(e.url || '')));
        const afterThePress = runFrameScans.filter((x) => /re-run wait|after the re-run/.test(x.why || ''));
        const withoutNumbers = entries.filter((e) => !e.unreachable
            && (e.fields === undefined || e.fields === null || e.text === undefined || e.text === null));
        numbersFrames = {
            scans: scans.length, framesSeen: scanned.size, attachedNeverScanned,
            enumerated: [...scanned],
            runFrameEnumeratedAt: runFrameScans.map((x) => x.at + ' (' + x.why + ')'),
            entriesWithoutNumbers: withoutNumbers.map((e) => e.url),
        };
        if (!scans.length) failures.push('pass ' + label + ': no frame enumeration happened at all');
        else if (!scanned.size) failures.push('pass ' + label + ': every frame enumeration came back empty');
        // M-F1 and M-F2 are about a press. A rehearsal presses nothing, and saying so is not the same
        // as passing: the condition names why it does not apply.
        if (pass.rerunPressed === true) {
            if (!runFrameScans.length) {
                failures.push('pass ' + label + ': no enumerated frame carries `/hub?rerun=` — enumerated instead: '
                    + JSON.stringify([...scanned]));
            } else if (!afterThePress.length) {
                failures.push('pass ' + label + ': the run frame was only enumerated before the press, at '
                    + JSON.stringify(runFrameScans.map((x) => x.at + ' (' + x.why + ')')));
            }
        }
        if (withoutNumbers.length) {
            failures.push('pass ' + label + ': ' + withoutNumbers.length
                + ' enumerated frames carry no numbers of their own: ' + JSON.stringify(withoutNumbers.map((e) => e.url)));
        }
        if (attachedNeverScanned.some((u) => /\/hub/.test(u))) {
            failures.push('pass ' + label + ': a run frame was attached and never enumerated: '
                + JSON.stringify(attachedNeverScanned.filter((u) => /\/hub/.test(u))));
        }

        const asked = (pass.routes || []).filter((r) => r.view && (viewRoutes || {})[r.view]);
        const opened = asked.filter((r) => !/NOT VISITED|FAILED/.test(r.note || '')).map((r) => r.view);
        const notOpened = asked.filter((r) => /NOT VISITED|FAILED/.test(r.note || '')).map((r) => r.view);
        numbers[label] = Object.assign({ intercepted, bound, fileButNoLine, opened, notOpened }, { frames: numbersFrames });

        if (!intercepted) failures.push('pass ' + label + ': nothing was intercepted — the reader never ran');
        if (!bound) failures.push('pass ' + label + ': no read bound to a census line — the pass saw reads it cannot place');
        if (fileButNoLine) failures.push('pass ' + label + ': ' + fileButNoLine
            + ' reads name a census FILE and no census line — the binding is broken, not the census');
        if (!opened.length) failures.push('pass ' + label + ': no view was opened where one was asked for');
    });
    // Condition 3, in P alone.
    const P = (passes || {}).P || {};
    const markersWithASink = Object.keys(P.markers || {}).filter((id) => {
        const needle = id.startsWith('ID:') ? id.slice(3) : '\u00ab' + id + '\u00bb';

        return (P.sinks || []).some((sink) => sink.text && sink.text.indexOf(needle) >= 0);
    }).length;
    numbers.markersWithASink = markersWithASink;
    if (!markersWithASink) failures.push('pass P: no marker reached any sink — nothing could be given a kind');

    return { numbers, failures };
}

/**
 * GH-701 — THE JOURNAL NAMES ITS OWN PATH, AND WHETHER THAT PATH IS INSIDE THE REPOSITORY.
 *
 * A reader should not have to be told where the file came from, and a rehearsal must say that it is
 * one in the place a reader looks first. Pure, so a case can hold it without a stand.
 */
function wroteLine(file, root, dry) {
    return 'WROTE | ' + file
        + ' | ' + (String(file).indexOf(root) === 0 ? 'INSIDE the repository, beside the real journals'
            : 'outside the repository')
        + (dry ? ' | this is a rehearsal: `3bd-DRY-*` is ignored by git so it cannot be committed beside a measurement' : '');
}

/** The sentence about what pass O is, and it is quoted rather than paraphrased. */
const O_BOUNDARY = 'O is a new client with empty storage; a long-time client behaves somewhere between O and P.';

// Layer 1 runs without the stand, in the ordinary suite: the census must see
// every plant form, each in a source that exists nowhere in the tree.
describe('3bd layer 1 — the census sees every form of read', () => {
    test('plants are found and the census prints what it inspected', () => {
        const c = census();
        process.stdout.write('[3bd] census: ' + c.files + ' files, ' + c.sites.length + ' read sites, sign version ' + SIGN_VERSION + '\n');
        const plants = censusOfSource('<plant>', PLANT_SRC).sites;
        process.stdout.write('[3bd] plants: ' + JSON.stringify(plants.map((x) => x.form + ':' + x.key)) + '\n');
        expect(plants.some((x) => /^wrapper:rd:literal$/.test(x.form) && x.key === 'probe_wrapper_key')).toBe(true);
        expect(plants.some((x) => x.form === 'bracket:literal' && x.key === 'probe_bracket_key')).toBe(true);
        expect(plants.some((x) => x.receiver === '_ls' && x.key === 'probe_ns_key')).toBe(true);
        expect(c.sites.length).toBeGreaterThan(50);
    });

    /**
     * GH-691 — ONE FAILED CONTROL MAKES THE WHOLE DEVICE UNFIT, SHOWN HERE RATHER THAN PROMISED.
     *
     * The plan asks the developer to show the reviewer that a `FAIL` turns the header into
     * `INSTRUMENT NOT VALID` and every reading into `UNTRUSTED`, without the stand, by substituting
     * an expected value. Done as a case, it is shown once and then kept.
     */
    test('a failing control turns the header NOT VALID and every reading UNTRUSTED', () => {
        const allOk = [
            { name: 'probe_wrapper_key', expected: 'writeback', got: 'writeback' },
            { name: 'probe_bracket_key', expected: 'decides-input', got: 'decides-input' },
        ];
        const one = instrumentBlock(allOk);
        process.stdout.write('[3bd] control block, all ok:\n' + one.lines.map((l) => '[3bd]   ' + l).join('\n') + '\n');
        expect(one.failed).toEqual([]);
        expect(headerLines({ drift: [], pointerBefore: 'a', pointerAfter: 'a', failedControls: one.failed }))
            .toEqual(['RUN valid', 'INSTRUMENT valid']);
        expect(stampUntrusted(['keys by class: …'], one.failed.length > 0)).toEqual(['keys by class: …']);

        // The substitution: one expected value changed, nothing else.
        const broken = instrumentBlock([
            allOk[0],
            { name: 'probe_bracket_key', expected: 'decides-input', got: 'inert' },
        ]);
        process.stdout.write('[3bd] control block, one substituted:\n' + broken.lines.map((l) => '[3bd]   ' + l).join('\n') + '\n');
        expect(broken.lines[1]).toContain('| FAIL');
        expect(broken.failed).toEqual(['probe_bracket_key']);

        const head = headerLines({ drift: [], pointerBefore: 'a', pointerAfter: 'a', failedControls: broken.failed });
        process.stdout.write('[3bd] header: ' + JSON.stringify(head) + '\n');
        expect(head[0]).toBe('RUN valid');
        expect(head[1]).toBe('INSTRUMENT NOT VALID: probe_bracket_key');
        expect(stampUntrusted(['keys by class: …', 'EXECUTED x.js:1'], true))
            .toEqual(['UNTRUSTED keys by class: …', 'UNTRUSTED EXECUTED x.js:1']);
    });

    test('the execution class is the two passes and nothing else', () => {
        const table = [
            { inO: true, inP: true, expect: 'in-both' },
            { inO: false, inP: true, expect: 'only-under-fabrication' },
            { inO: true, inP: false, expect: 'only-without-fabrication' },
            { inO: false, inP: false, expect: null },
        ];
        table.forEach((r) => {
            process.stdout.write('[3bd] O=' + r.inO + ' P=' + r.inP + ' -> ' + executionClass(r.inO, r.inP) + '\n');
            expect(executionClass(r.inO, r.inP)).toBe(r.expect);
        });
        // The distinction this instrument was rebuilt for: a read that ran only because we seeded
        // the storage must NEVER come out as a client's behaviour.
        expect(executionClass(false, true)).not.toBe('in-both');
    });

    test('a site that ran in neither pass gets a reason, and the reason comes from printed facts', () => {
        const cases = [
            { name: 'no view loads the file', in: { viewsWithIt: [], visitedViews: ['dashboard'], heldOnThoseViews: [] },
              expect: ['file-not-on-visited-views'] },
            { name: 'a view loads it but was not opened', in: { viewsWithIt: ['stadium'], visitedViews: ['dashboard'], heldOnThoseViews: [] },
              expect: ['page-not-opened'] },
            { name: 'opened, and a write was held on it', in: { viewsWithIt: ['dashboard'], visitedViews: ['dashboard'], heldOnThoseViews: ['P:POST /api/x'] },
              expect: ['after-held-write'] },
            { name: 'opened, nothing held, still did not run', in: { viewsWithIt: ['dashboard'], visitedViews: ['dashboard'], heldOnThoseViews: [] },
              expect: ['not-reached-on-empty-or-fabricated-storage; long-time client not covered'] },
            { name: 'not opened AND writes held there', in: { viewsWithIt: ['stadium'], visitedViews: [], heldOnThoseViews: ['O:PATCH /api/y'] },
              expect: ['page-not-opened', 'after-held-write'] },
        ];
        cases.forEach((c) => {
            const got = causeFor(c.in);
            process.stdout.write('[3bd] ' + c.name + ' -> ' + JSON.stringify(got) + '\n');
            expect(got).toEqual(c.expect);
        });
        // There is always a reason: a silent NOT EXECUTED is the thing this closes.
        expect(causeFor({ viewsWithIt: [], visitedViews: [], heldOnThoseViews: [] }).length).toBeGreaterThan(0);
    });

    /**
     * GH-696 — THE JOURNAL'S ASSEMBLY, COVERED WITHOUT THE STAND.
     *
     * This is the hole that cost the first press. Layer 1 covered the pure arithmetic of fitness and
     * passed green while the live half died on an undeclared name, because nothing here ever touched
     * the body that assembles the journal. `assembleJournal` is pure, so two cases close it: the four
     * parts come out in order, and a journal can never be written with a valid header over a control
     * list that was never assembled.
     *
     * WHY THE SECOND CASE IS THE IMPORTANT ONE: an empty control list is what a run has when its
     * measuring test died. If that printed `INSTRUMENT valid`, every reading under it would be quoted
     * as a finding — the worst outcome this instrument has available, and the one nearest to what
     * actually happened.
     */
    const FAKE = () => ({
        drift: [],
        pointerBefore: 'site-1',
        pointerAfter: 'site-1',
        standing: ['DATE | now', 'O-BOUNDARY | ' + O_BOUNDARY],
        readingLines: ['keys by kind:', '   writeback     gilba_import_active_site'],
    });

    test('the journal comes out in four parts, in order: verdicts, standing, controls, readings', () => {
        const j = assembleJournal(Object.assign(FAKE(), {
            controls: [
                { name: 'plant:probe_both_key execution', expected: 'in-both', got: 'in-both' },
                { name: 'plant:probe_onlyfab_child execution', expected: 'only-under-fabrication', got: 'only-under-fabrication' },
            ],
        }));
        process.stdout.write('[3bd] journal:\n' + j.lines.map((l) => '[3bd]   ' + l).join('\n') + '\n');

        // The two verdict lines are first and in this order, and nothing precedes them.
        expect(j.lines[0]).toBe('RUN valid');
        expect(j.lines[1]).toBe('INSTRUMENT valid');
        // Then the standing statements, then the controls, then the readings — asserted by POSITION,
        // because "all four are present" is satisfied by any order, and the order is the point: a
        // reading printed above the verdict on the instrument gets quoted on its own.
        expect(j.lines[2]).toMatch(/^DATE /);
        expect(j.lines[3]).toMatch(/^O-BOUNDARY /);
        expect(j.lines[4]).toMatch(/^CONTROL \| plant:probe_both_key/);
        expect(j.lines[5]).toMatch(/^CONTROL \| plant:probe_onlyfab_child/);
        expect(j.lines[6]).toBe('keys by kind:');
        expect(j.lines).toHaveLength(8);
        // With every control ok, a reading is NOT stamped: the stamp has to mean something.
        expect(j.untrusted).toBe(false);
        expect(j.controlsMissing).toBe(false);
    });

    test('a journal with NO controls assembled says so in the header and stamps every reading', () => {
        const j = assembleJournal(Object.assign(FAKE(), { controls: [] }));
        process.stdout.write('[3bd] journal with no controls:\n' + j.lines.map((l) => '[3bd]   ' + l).join('\n') + '\n');

        expect(j.controlsMissing).toBe(true);
        expect(j.lines[0]).toBe('RUN valid');
        expect(j.lines[1]).toBe('INSTRUMENT NOT VALID: no controls were assembled — the measuring test did not reach the end');
        expect(j.block).toEqual(['CONTROL | none were assembled | expected a full set | got none | FAIL']);
        // And nothing below it can be read as a finding.
        expect(j.untrusted).toBe(true);
        expect(j.lines.filter((l) => /^keys by kind:$/.test(l))).toEqual([]);
        expect(j.lines).toContain('UNTRUSTED keys by kind:');

        // The run itself is still judged separately: a valid run with an unfit device.
        expect(assembleJournal(Object.assign(FAKE(), { controls: [], drift: ['assets/x.js'] })).lines[0])
            .toBe('RUN INVALID: tree moved: ["assets/x.js"]');
    });

    test('a DRY journal stamps every reading even when every control passed', () => {
        /**
         * GH-696 — THE SECOND ASSERTION THE REVIEWER ASKED FOR. A rehearsal's journal is a real file
         * with real-looking lines in it, and the only thing standing between it and being quoted as a
         * measurement is the marking. So the marking is asserted where it is decided, and asserted on
         * the case that could go wrong quietly: EVERY CONTROL PASSING. A dry journal whose controls
         * all passed would otherwise print `INSTRUMENT valid` over readings taken from one view with
         * no Re-run — the most quotable wrong thing this instrument can produce.
         */
        const allOk = [{ name: 'plant:probe_both_key execution', expected: 'in-both', got: 'in-both' }];
        const wet = assembleJournal(Object.assign(FAKE(), { controls: allOk }));
        const dry = assembleJournal(Object.assign(FAKE(), { controls: allOk, dry: true }));
        process.stdout.write('[3bd] same controls, not dry -> untrusted ' + wet.untrusted
            + ' | dry -> untrusted ' + dry.untrusted + '\n');

        // The pair is the point: the same controls, and only the dry one is stamped.
        expect(wet.untrusted).toBe(false);
        expect(wet.lines).toContain('keys by kind:');
        expect(dry.untrusted).toBe(true);
        expect(dry.lines).toContain('UNTRUSTED keys by kind:');
        expect(dry.lines).not.toContain('keys by kind:');
        // And the header still says the instrument is fit, which is true and is why the stamp has to
        // carry the warning instead.
        expect(dry.lines[1]).toBe('INSTRUMENT valid');
    });

    test('the five conditions: one case per way a rehearsal can be blind, each naming its reason', () => {
        /**
         * GH-697 — ONE CASE PER WAY OF SEEING NOTHING, as the analyst's section asks: (a) nothing
         * intercepted, (b) sight in one pass only, (c) the file is recognised and the line is not,
         * and an empty `ROUTE`. Each must make the device unfit AND say which condition failed —
         * "unfit" without the reason is what sent the last journal back.
         */
        const SITES = [{ file: 'hub-persistence.js', line: 1055 }];
        const ROUTES = { dashboard: '/dashboard', plan: '/plan' };
        const readAt = (line, key) => ({ key: key || 'gilba_hub_state_1', stack: ' at x (http://h/assets/hub-persistence.js?v=3:' + line + ':9)' });
        const route = (view, note) => ({ view, requested: '/x', final: '/x', status: 200, reads: 1, note: note || null });
        // GH-698: the fixture carries EVERY condition's data, including the frame enumerations. The
        // first version did not, and the sixth condition reddened these cases the moment it existed —
        // which is the guard working: a fixture short of a condition cannot judge it.
        const wholePass = (extra) => Object.assign({
            reads: [readAt(1055)], routes: [route('dashboard')], markers: { 'Ma-1': 'k' },
            sinks: [{ kind: 'field', where: 'dashboard', text: 'x «Ma-1» y' }],
            // GH-699: every entry carries its own numbers, because that is what the condition asks
            // for — a fixture of bare names could not tell a frame that was read from one that was
            // merely listed, which is the mutation M-F3 exists for.
            frameScans: [{ at: '2026-09-24T22:10:00.000Z', why: 'after the re-run wait', frames: [
                { url: 'http://h/dashboard', fields: 3, text: 120, markersFound: 1, reads: 1 },
            ] }],
            frameEvents: [],
        }, extra || {});
        const good = { O: wholePass(), P: wholePass() };

        // The floor: a pass that saw everything is FIT, or every failure below means nothing.
        const fit = dryPassFitness({ passes: good, censusSites: SITES, viewRoutes: ROUTES });
        process.stdout.write('[3bd] a whole rehearsal: ' + JSON.stringify(fit.numbers) + ' | failures ' + JSON.stringify(fit.failures) + '\n');
        expect(fit.failures).toEqual([]);
        expect(fit.numbers.O.intercepted).toBe(1);
        expect(fit.numbers.markersWithASink).toBe(1);

        const cases = [
            { name: '(a) nothing intercepted in O', passes: { O: wholePass({ reads: [] }), P: wholePass() },
              expect: /pass O: nothing was intercepted/ },
            { name: '(b) sight in P only — O intercepted nothing', passes: { O: wholePass({ reads: [] }), P: wholePass() },
              expect: /pass O: nothing was intercepted/ },
            { name: '(b) reads in O that bind to no census line', passes: { O: wholePass({ reads: [{ key: 'k', stack: ' at q (http://h/assets/elsewhere.js:5:1)' }] }), P: wholePass() },
              expect: /pass O: no read bound to a census line/ },
            { name: '(c) the file is named, the line is not', passes: { O: wholePass({ reads: [readAt(9999)] }), P: wholePass() },
              expect: /pass O: 1 reads name a census FILE and no census line/ },
            { name: 'an empty ROUTE — no view opened where asked', passes: { O: wholePass({ routes: [route('dashboard', 'NOT VISITED (no route known here)')] }), P: wholePass() },
              expect: /pass O: no view was opened where one was asked for/ },
            { name: 'no marker reached a sink, in P', passes: { O: wholePass(), P: wholePass({ sinks: [] }) },
              expect: /pass P: no marker reached any sink/ },
            // GH-698, the sixth condition: the two silences the reviewer separated.
            { name: 'no frame enumeration happened at all', passes: { O: wholePass({ frameScans: [] }), P: wholePass() },
              expect: /pass O: no frame enumeration happened at all/ },
            { name: 'every enumeration came back empty', passes: { O: wholePass({ frameScans: [{ at: 't', why: 'w', urls: [] }] }), P: wholePass() },
              expect: /pass O: every frame enumeration came back empty/ },
            { name: 'a run frame was attached and never enumerated', passes: {
                O: wholePass({ frameEvents: [{ at: 't', kind: 'attached', url: 'http://h/hub?rerun=1&site=2' }] }),
                P: wholePass() },
              expect: /pass O: a run frame was attached and never enumerated/ },
            /**
             * The reviewer's three, each in the shape its mutation would leave behind.
             *
             * M-F1: only the main frame enumerated — the list is NOT empty, which is the trap, so the
             *   failure must name the MISSING `/hub?rerun=` and show what was there instead.
             * M-F2: the run frame enumerated only before the press — the moment and the list are one
             *   claim, so this must fail on the moment while the entry exists.
             * M-F3: a name with no numbers.
             */
            { name: 'M-F1: only the top document enumerated, on a pass that pressed Re-run', passes: {
                O: wholePass({ rerunPressed: true }), P: wholePass() },
              expect: /no enumerated frame carries `\/hub\?rerun=` — enumerated instead: \["http:\/\/h\/dashboard"\]/ },
            { name: 'M-F2: the run frame enumerated only BEFORE the press', passes: {
                O: wholePass({ rerunPressed: true, frameScans: [{ at: 't1', why: 'before the re-run', frames: [
                    { url: 'http://h/dashboard', fields: 1, text: 2, markersFound: 0, reads: 0 },
                    { url: 'http://h/hub?rerun=9&site=1', fields: 4, text: 50, markersFound: 0, reads: 2 },
                ] }] }), P: wholePass() },
              expect: /the run frame was only enumerated before the press/ },
            { name: 'M-F3: a frame named with no numbers', passes: {
                O: wholePass({ frameScans: [{ at: 't', why: 'after the re-run wait', frames: [{ url: 'http://h/dashboard' }] }] }),
                P: wholePass() },
              expect: /enumerated frames carry no numbers of their own: \["http:\/\/h\/dashboard"\]/ },
        ];
        cases.forEach((c) => {
            const out = dryPassFitness({ passes: c.passes, censusSites: SITES, viewRoutes: ROUTES });
            process.stdout.write('[3bd]   ' + c.name + ' -> ' + JSON.stringify(out.failures) + '\n');
            expect(out.failures.length).toBeGreaterThan(0);
            expect(out.failures.join(' | ')).toMatch(c.expect);
            // And it makes the device unfit, with the reason carried into the header.
            const j = assembleJournal({
                drift: [], pointerBefore: 'a', pointerAfter: 'a', standing: [], readingLines: [],
                controls: [{ name: 'dry pass: the five conditions', expected: [], got: out.failures }],
            });
            expect(j.lines[1]).toBe('INSTRUMENT NOT VALID: dry pass: the five conditions');
        });
    });

    test('condition 3 is asked of P alone, because O has no markers by construction', () => {
        /**
         * The analyst's correction, kept as a case so it cannot be undone by someone reading the
         * reviewer's table and applying all five to both passes: `O` does not fabricate, so it has
         * no markers, and a device asked for markers in `O` would be unfit on EVERY press —
         * indistinguishable from a device that saw nothing.
         */
        const SITES = [{ file: 'hub-persistence.js', line: 1055 }];
        const ROUTES = { dashboard: '/dashboard' };
        const bare = {
            reads: [{ key: 'gilba_hub_state_1', stack: ' at x (http://h/assets/hub-persistence.js:1055:9)' }],
            routes: [{ view: 'dashboard', requested: '/x', final: '/x', status: 200, reads: 1, note: null }],
            markers: {}, sinks: [],
            frameScans: [{ at: 't', why: 'after the re-run wait', frames: [
                { url: 'http://h/dashboard', fields: 1, text: 10, markersFound: 0, reads: 1 },
            ] }],
            frameEvents: [],
        };
        const withMarkers = Object.assign({}, bare, {
            markers: { 'Ma-1': 'k' }, sinks: [{ kind: 'field', where: 'dashboard', text: '«Ma-1»' }],
        });
        const out = dryPassFitness({ passes: { O: bare, P: withMarkers }, censusSites: SITES, viewRoutes: ROUTES });
        process.stdout.write('[3bd] O without markers, P with: ' + JSON.stringify(out.failures) + '\n');

        // O has no markers and that is not a failure.
        expect(out.failures.join(' | ')).not.toMatch(/pass O: no marker/);
        expect(out.failures).toEqual([]);
        // And P without them still is.
        const flipped = dryPassFitness({ passes: { O: bare, P: bare }, censusSites: SITES, viewRoutes: ROUTES });
        expect(flipped.failures.join(' | ')).toMatch(/pass P: no marker reached any sink/);
    });

    test('the journal names where it was written, and a rehearsal says it is one', () => {
        /**
         * GH-701 — the reviewer's third point, and his reason for it: a rehearsal artefact lying in
         * the record beside real journals will one day be read as a measurement, and the file's name
         * alone does not stop that. So the journal states its own path, whether that path is inside
         * the repository, and — when it is a rehearsal — that git ignores it.
         *
         * The sentence in the file's own docblock used to claim the opposite of what the code does:
         * it promised "outside unless told otherwise" while the default writes inside. The
         * instrument does what its code says; it was the sentence that was wrong, and it is fixed.
         */
        const inside = wroteLine('/repo/files/fixes/x/live-runs/3bd-DRY-a.log', '/repo', true);
        const outside = wroteLine('/tmp/dry/3bd-DRY-a.log', '/repo', true);
        const real = wroteLine('/repo/files/fixes/x/live-runs/3bd-storage-reads-a.log', '/repo', false);
        process.stdout.write('[3bd] ' + inside + '\n[3bd] ' + outside + '\n[3bd] ' + real + '\n');

        expect(inside).toContain('INSIDE the repository, beside the real journals');
        expect(inside).toContain('ignored by git');
        expect(outside).toContain('outside the repository');
        // A measurement says where it is and does NOT claim to be ignorable.
        expect(real).toContain('INSIDE the repository');
        expect(real).not.toContain('ignored by git');
    });

    test('the hub-state key is DERIVED from the user, and the rule is the product’s own', () => {
        /**
         * GH-701 (the reviewer's return, his first recommendation). The key carries a suffix and the
         * suffix is the user: `hub-persistence.js` builds it as
         * `'gilba_hub_state' + (userId ? '_' + userId : '')`. A control asking about the bare name
         * finds nothing, and one asking about `gilba_hub_state_1` is bound to whoever user 1 is on
         * this stand — so the rule is taken from the product and asserted against it here.
         */
        expect(exactHubStateKey('7')).toBe('gilba_hub_state_7');
        expect(exactHubStateKey(7)).toBe('gilba_hub_state_7');
        expect(exactHubStateKey(null)).toBe('gilba_hub_state');
        expect(exactHubStateKey(undefined)).toBe('gilba_hub_state');
        // A suffix of zero is no user, which is what the product's own `uid ? … : ''` says.
        expect(exactHubStateKey(0)).toBe('gilba_hub_state');

        // AND THE RULE IS NOT INVENTED HERE. If the product stops building the key this way, this
        // assertion is what says so, instead of the control quietly asking about a key nobody writes.
        const persistence = fs.readFileSync(path.join(ROOT, 'assets', 'hub-persistence.js'), 'utf8');
        process.stdout.write('[3bd] the product builds it as: '
            + (persistence.match(/var suffix = [^\n]*/) || ['<not found>'])[0] + '\n');
        expect(persistence).toContain("var suffix = uid ? '_' + uid : '';");
        expect(persistence).toContain("state: 'gilba_hub_state' + suffix,");
    });

    test('the hub-state control expects `inert`, and it names the exact key', () => {
        /**
         * His second recommendation. Both halves in one case, because the control is one thing: the
         * name it asks about and the answer it expects.
         */
        const built = hubStateControl('7', { gilba_hub_state_7: 'inert', gilba_hub_state: 'decides-input' });
        process.stdout.write('[3bd] the control built for user 7: ' + JSON.stringify(built) + '\n');

        expect(built.name).toBe('gilba_hub_state_7 kind');
        expect(built.expected).toBe('inert');
        expect(built.got).toBe('inert');
        // The bare name is present in that same table with a DIFFERENT value, so a control reading
        // the bare name would come back `decides-input` and pass for the wrong reason. This is what
        // makes the exactness of the name a claim rather than a spelling.
        expect(built.got).not.toBe('decides-input');

        // And it is fit: with all controls ok the instrument is valid, which is the state a rehearsal
        // reaches today.
        const inst = instrumentBlock([built]);
        expect(inst.failed).toEqual([]);
        // A key the pass never marked is `NOT MARKED`, not a silent pass.
        expect(hubStateControl('7', {}).got).toBe('NOT MARKED');
        expect(instrumentBlock([hubStateControl('7', {})]).failed).toEqual(['gilba_hub_state_7 kind']);
    });

    test('the run and the instrument are judged separately, and the run line names what went wrong', () => {
        // A valid run with an unfit instrument, and an invalid run with a fit one: the two verdicts
        // are about different things, and a reader who conflates them either throws away good
        // readings or quotes untrustworthy ones.
        expect(headerLines({ drift: ['assets/x.js'], pointerBefore: 'a', pointerAfter: 'a', failedControls: [] }))
            .toEqual(['RUN INVALID: tree moved: ["assets/x.js"]', 'INSTRUMENT valid']);
        expect(headerLines({ drift: [], pointerBefore: 'a', pointerAfter: 'b', failedControls: [] })[0])
            .toBe('RUN INVALID: pointer not restored: before a, now b');
        expect(headerLines({ drift: [], pointerBefore: null, pointerAfter: null, failedControls: [] })[0])
            .toBe('RUN INVALID: never got past login');
    });
});

(ENABLED ? describe : describe.skip)('3bd — does a storage read cache or decide', () => {
    let browser;
    let treeBefore, pointerBefore = null, pointerAfter = null, pointerMoveOk = !SWITCH_TO;
    let cen = null;
    const passes = {};          // 'O' | 'P' -> what that pass recorded
    const readingLines = [];    // everything that is a READING, printed after the instrument
    const standing = [];        // statements about the run: the date, the O boundary, what was written
    const toTheStand = [];      // every non-GET that really went to the stand, with body and answer
    let hubUserId = null;       // the suffix of the hub-state key is the user, read from the page
    /**
     * GH-694 — THIS DECLARATION WAS MISSING AND THE PRESS DIED ON IT.
     *
     * `controls` is pushed to in the measuring test and read in `afterAll`, and it was declared in
     * neither: `ReferenceError: controls is not defined`, on the live half, with nothing measured.
     *
     * HOW IT SURVIVED, because the answer is not "I forgot" — that part is true but useless.
     * `node --check` proves syntax and says nothing about whether a name resolves. Layer 1 covers
     * the pure functions of this file and never executes the live half, so the body around them had
     * never run at all. I had said the arithmetic was checked without the stand; that was true of
     * the arithmetic and not of the assembly holding it, and I let the second read as covered by the
     * first. The device that closes it is not this line: it is the dry pass below, which executes
     * the whole path against a harmless target.
     */
    const controls = [];        // CONTROL rows, assembled by the measuring test, read by the writer

    function rsay(s) { readingLines.push(s); }

    async function login(ctx) {
        const p = await ctx.newPage();
        await p.goto(BASE_URL + '/login', { waitUntil: 'domcontentloaded' });
        await p.fill('#email', EMAIL);
        await p.fill('#password', PASSWORD);
        await Promise.all([
            p.waitForNavigation({ waitUntil: 'domcontentloaded' }).catch(() => null),
            p.click('form.login-form button[type=submit]'),
        ]);
        if (/\/login/.test(p.url())) throw new Error('login refused for ' + EMAIL);
        return p;
    }
    async function activeSiteId(p) {
        await p.goto(BASE_URL + '/dashboard?setup=0', { waitUntil: 'domcontentloaded' });
        return p.evaluate(() => (window.GAIP_HUB_CONFIG && window.GAIP_HUB_CONFIG.activeSiteId) || null);
    }
    async function setPointer(p, id) {
        return p.evaluate(async (siteId) => {
            const csrf = (document.querySelector('meta[name="csrf-token"]') || {}).content || '';
            const r = await fetch('/api/active-site', { method: 'PATCH', credentials: 'same-origin',
                headers: { 'Content-Type': 'application/json', Accept: 'application/json', 'X-CSRF-TOKEN': csrf },
                body: JSON.stringify({ site_id: siteId }) });
            return { status: r.status, body: await r.text() };
        }, id);
    }

    /**
     * GH-691 — THE READER INSTALLED IN THE PAGE, IN TWO FORMS.
     *
     * `fabricate` is the whole difference between the two passes. With it off (pass O) the wrapper
     * records the read and hands back the REAL value, so the page behaves as it does for a client
     * whose storage holds what it holds. With it on (pass P) values are replaced by markers, which
     * is what makes a read's destination visible — and which also changes what the page does next,
     * because a key that was empty now has something in it.
     *
     * `wasNull` is recorded in BOTH, and it is the third field the reviewer asked for: without it a
     * read of a key that was not there and a read of a key that was look the same in the journal,
     * and the difference is exactly why a site executes in one pass and not the other.
     */
    function installReader(context, fabricate, args) {
        return context.addInitScript(({ memberKeys, memberPrefixes, bracketKeys, ids, sensorSrc, fab }) => {
            const SENSOR = new RegExp(sensorSrc, 'i');
            const reg = (window.__3bd = { reads: [], markers: {}, n: 0, tag: Math.random().toString(36).slice(2, 8) });
            const mark = (key) => { const id = 'M' + reg.tag + '-' + (++reg.n); reg.markers[id] = key; return '«' + id + '»'; };
            const poison = (key, val) => {
                if (!fab) return val;
                if (SENSOR.test(key)) return val;
                const isMember = memberKeys.includes(key) || memberPrefixes.some((pre) => key.indexOf(pre) === 0);
                const memberCat = isMember ? (/site/i.test(key) ? 'site' : (/water/i.test(key) ? 'water' : /tissue/i.test(key) ? 'tissue' : /loi/i.test(key) ? 'loi' : 'soil')) : null;
                if (memberCat && ids[memberCat]) { reg.markers['ID:' + ids[memberCat]] = key; return ids[memberCat]; }
                if (val === null || val === undefined) return mark(key);
                try {
                    const o = JSON.parse(val);
                    const tag = (x) => {
                        if (typeof x === 'string') return mark(key);
                        if (typeof x === 'number') return -987654.321;
                        if (Array.isArray(x)) return x.map(tag);
                        if (x && typeof x === 'object') { const y = {}; Object.keys(x).forEach((k) => { y[k] = (k === 'schemaVersion' ? x[k] : tag(x[k])); }); return y; }
                        return x;
                    };
                    return JSON.stringify(tag(o));
                } catch (e) { return mark(key); }
            };
            const orig = Storage.prototype.getItem;
            Storage.prototype.getItem = function (key) {
                const v = orig.call(this, key);
                const stack = (new Error().stack || '').split('\n').slice(2, 7).join(' | ');
                const out = poison(String(key), v);
                reg.reads.push({ key: String(key), stack, marked: out !== v, wasNull: v === null || v === undefined });
                return out;
            };
            if (fab) {
                try { bracketKeys.forEach((k) => { if (!SENSOR.test(k)) localStorage.setItem(k, mark(k)); }); } catch (e) {}
            }
            window.addEventListener('load', () => {
                try {
                    function rd(k) { return window.localStorage.getItem(k); }
                    const a = rd('probe_wrapper_key');
                    fetch('/api/probe-3bd', { method: 'POST', body: JSON.stringify({ v: a }) }).catch(() => {});
                    localStorage.setItem('probe_bracket_key', mark('probe_bracket_key'));
                    const inp = document.createElement('input'); inp.className = 'probe-3bd'; inp.value = localStorage['probe_bracket_key'];
                    document.body.appendChild(inp);
                    if (window.GilbaStorageNS) { const _ls = window.GilbaStorageNS.get(); const c = _ls.getItem('probe_ns_key'); document.body.setAttribute('data-probe-ns', String(c)); }
                    window.localStorage.getItem('probe_inert_key');
                    const d = document.createElement('div'); d.textContent = window.localStorage.getItem('probe_display_key'); document.body.appendChild(d);

                    /**
                     * THE PAIRED PLANT, and it is what makes the two passes worth running.
                     *
                     * `probe_both_key` is read with no condition, so it must come out `in-both`.
                     * `probe_onlyfab_child` is read ONLY when its parent key has a value — and the
                     * parent is seeded only when storage is fabricated. So on pass O the parent is
                     * empty, the child is never read, and the site must come out
                     * `only-under-fabrication`. A device that cannot tell those two apart would
                     * report a read as a client's behaviour when it is the measurement's own.
                     */
                    const both = window.localStorage.getItem('probe_both_key');
                    const bi = document.createElement('input'); bi.className = 'probe-both'; bi.value = String(both);
                    document.body.appendChild(bi);
                    const parent = window.localStorage.getItem('probe_onlyfab_parent');
                    if (parent) {
                        const child = window.localStorage.getItem('probe_onlyfab_child');
                        const ci = document.createElement('input'); ci.className = 'probe-onlyfab'; ci.value = String(child);
                        document.body.appendChild(ci);
                    }
                } catch (e) {}
            });
        }, Object.assign({ fab: fabricate }, args));
    }

    /**
     * GH-691 — ONE PASS: a clean context, a login of its own, every view that loads a census file,
     * one Re-run, and a record of what went where.
     *
     * Two passes over one list of views and one Re-run, as the plan requires, and no third: a
     * fabricated "long-time" storage would be the same fabrication wearing a different label.
     */
    async function runPass(label, fabricate, args) {
        const rec = {
            label, reads: [], sinks: [], markers: {}, spaces: {}, routes: [], held: [],
            gets: [], seeded: [], errors: [],
        };
        const context = await browser.newContext();
        const page = await login(context);
        await guardStand(page);

        /**
         * GH-698 — THE FRAMES THIS PASS ENUMERATED, AND WHEN.
         *
         * The reviewer's diagnosis, and it is the same shape as the empty `ROUTE`: "there were no
         * frames" and "there were frames and we looked later" were one silence. A frame is created,
         * runs and is gone; a single enumeration after a twenty-second wait sees whatever is left.
         * So the lifecycle is recorded as it happens -- attached and detached, each with its moment
         * and its URL -- and every enumeration is recorded too, with the moment and what it saw.
         *
         * THAT IS WHAT MAKES THE ANSWER READABLE: a frame that was enumerated and held no marker
         * means the CONTROL is wrong; a frame that was never enumerated means the INSTRUMENT is. The
         * honest third possibility stays open — that the value reaches nothing and the expectation of
         * `decides-input` is simply wrong — and these lines are what tell it from the other two.
         */
        rec.frameEvents = [];
        rec.frameScans = [];
        const stamp = () => new Date().toISOString();
        page.on('frameattached', (f) => { try { rec.frameEvents.push({ at: stamp(), kind: 'attached', url: f.url() }); } catch (e) {} });
        page.on('framedetached', (f) => { try { rec.frameEvents.push({ at: stamp(), kind: 'detached', url: f.url() }); } catch (e) {} });

        /**
         * GH-699 — EVERY ENTRY CARRIES ITS OWN NUMBERS (the reviewer's M-F3).
         *
         * A name in the list proves that the name was written. What proves the frame was READ is how
         * much came out of it: how many form fields, how much text, how many markers were found in
         * it. A list of bare names would be satisfied by writing the names down, which is the same
         * defect as a guard printing a verdict without its subject.
         */
        const scanFrames = async (why) => {
            const seen = [];
            for (const f of page.frames()) {
                let url = '<gone>';
                try { url = f.url(); } catch (e) { url = '<gone: ' + e.message + '>'; }
                const snap = await f.evaluate(() => {
                    const r = window.__3bd || { reads: [], markers: {} };
                    const fields = Array.from(document.querySelectorAll('input, select, textarea')).map((e) => (e.className || e.name || e.id) + '=' + e.value).join(' ');
                    return { tag: r.tag, url: location.pathname + location.search, reads: r.reads.splice(0), markers: r.markers, fields, text: document.body ? document.body.innerText : '' };
                }).catch((e) => ({ err: e.message }));
                if (!snap || snap.err) {
                    seen.push({ url, unreachable: snap ? snap.err : 'no answer', fields: null, text: null, markersFound: null, reads: null });
                    continue;
                }
                Object.assign(rec.markers, snap.markers);
                const where = 'frame ' + snap.url;
                if (snap.tag) rec.spaces[snap.tag] = where;
                snap.reads.forEach((r) => rec.reads.push(Object.assign({ view: where }, r)));
                if (snap.fields) rec.sinks.push({ kind: 'field', where, text: snap.fields });
                if (snap.text) rec.sinks.push({ kind: 'text', where, text: snap.text });
                if (/\/hub/.test(snap.url) && !rec.routes.some((x) => x.view === where)) {
                    rec.routes.push({ view: where, requested: snap.url, final: snap.url, status: null, reads: snap.reads.length, note: 'the run frame' });
                }
                // The numbers, taken from what this frame actually gave. `markersFound` counts both
                // forms: the `«M…»` markers and the real-identifier ones, which have no shape of
                // their own and can only be counted by value.
                const haystack = (snap.fields || '') + ' ' + (snap.text || '');
                const braced = (haystack.match(/\u00abM[a-z0-9]+-\d+\u00bb/g) || []).length;
                const byId = Object.keys(rec.markers).filter((id) => id.startsWith('ID:'))
                    .filter((id) => haystack.indexOf(id.slice(3)) >= 0).length;
                seen.push({
                    url: snap.url || url,
                    fields: (snap.fields || '').split(/\s+/).filter(Boolean).length,
                    text: (snap.text || '').length,
                    markersFound: braced + byId,
                    reads: snap.reads.length,
                });
            }
            rec.frameScans.push({ at: stamp(), why, frames: seen, urls: seen.map((x) => x.url) });
        };

        // Everything but GET is held, recorded first, with its body and the page it came from.
        await page.route('**/*', async (route) => {
            const req = route.request();
            const method = req.method();
            const u = new URL(req.url());
            if (method === 'GET' || method === 'HEAD' || method === 'OPTIONS') {
                rec.sinks.push({ kind: 'request-url', where: method + ' ' + u.pathname, text: u.search });
                if (!rec.gets.some((g) => g.path === u.pathname && g.search === u.search)) {
                    rec.gets.push({ path: u.pathname, search: u.search });
                }

                return route.fallback();
            }
            const body = req.postData() || '';
            let framePage = '<no frame>';
            try { framePage = req.frame().url(); } catch (e) { framePage = '<frame gone: ' + e.message + '>'; }
            rec.sinks.push({ kind: 'request-body', where: method + ' ' + u.pathname, text: body + ' ' + u.search });
            // HELD names the page it was held on, through the request's own frame, so a held write
            // can be tied to the screen a person was looking at rather than to the pass at large.
            rec.held.push({ page: framePage, method, path: u.pathname, bytes: Buffer.byteLength(body, 'utf8') });

            return route.fulfill({
                status: 200, contentType: 'application/json',
                body: JSON.stringify({ ok: true, held: '3bd: not written to the stand' }),
            });
        });

        await installReader(context, fabricate, args);

        // The parent of the paired plant is seeded ONLY when storage is fabricated, in the same
        // breath as the bracket keys, so the child's absence on pass O is the pass and not an
        // accident of ordering.
        if (fabricate) {
            await context.addInitScript(() => {
                try { localStorage.setItem('probe_onlyfab_parent', 'seeded-under-fabrication'); } catch (e) {}
            });
            rec.seeded.push('probe_onlyfab_parent');
        }

        const vs = viewScripts();
        const censusFiles = new Set(cen.sites.map((s) => s.file));
        let views = Object.keys(vs).filter((v) => Array.from(vs[v]).some((f) => censusFiles.has(f)));
        /**
         * THE DRY PASS OPENS THE PAGES ITS OWN CONTROLS NEED, derived rather than listed.
         *
         * It walked one view and came back `INSTRUMENT NOT VALID` on the three data controls — and
         * the reviewer was right to stop on it, because "they failed" and "we never opened a page
         * that reads them" are different statements and the journal made only the first. Measured:
         * the dashboard loads NONE of the files holding those reads. So the views are worked out
         * from the census — whichever pages load the files where the control keys are read — and a
         * control added on a new key brings its page with it.
         */
        if (DRY) {
            const filesWithControls = new Set(cen.sites
                .filter((site) => DATA_CONTROL_KEYS.includes(site.key))
                .map((site) => site.file));
            const needed = Object.keys(vs).filter((v) => Array.from(vs[v]).some((f) => filesWithControls.has(f)));
            views = views.filter((v) => v === 'dashboard' || needed.includes(v));
            rec.dryViewsBecause = { filesWithControls: [...filesWithControls], needed };
        }
        rec.views = views;
        for (const v of views) {
            const route = VIEW_ROUTES[v];
            if (!route) {
                rec.routes.push({ view: v, requested: null, final: null, status: null, reads: 0, note: 'NOT VISITED (no route known here)' });
                continue;
            }
            let status = null;
            let err = null;
            const resp = await page.goto(BASE_URL + route, { waitUntil: 'networkidle', timeout: 60000 })
                .catch((e) => { err = e.message; return null; });
            if (resp) status = resp.status();
            await page.waitForTimeout(2500);
            const snap = await page.evaluate(() => {
                const r = window.__3bd || { reads: [], markers: {} };
                const fields = Array.from(document.querySelectorAll('input, select, textarea')).map((e) => (e.className || e.name || e.id) + '=' + e.value).join(' ');
                return { tag: r.tag, reads: r.reads.splice(0), markers: r.markers, fields, text: document.body.innerText, ns: document.body.getAttribute('data-probe-ns') };
            }).catch((e) => ({ reads: [], markers: {}, fields: '', text: '', err: e.message }));
            Object.assign(rec.markers, snap.markers);
            if (snap.tag) rec.spaces[snap.tag] = v;
            snap.reads.forEach((r) => rec.reads.push(Object.assign({ view: v }, r)));
            rec.sinks.push({ kind: 'field', where: v, text: snap.fields + ' ' + (snap.ns || '') });
            rec.sinks.push({ kind: 'text', where: v, text: snap.text });
            const final = page.url();
            rec.routes.push({
                view: v, requested: BASE_URL + route, final, status,
                reads: snap.reads.length,
                note: err ? 'FAILED: ' + err : (final.replace(BASE_URL, '') !== route ? 'REDIRECTED' : null),
            });
            if (snap.err) rec.errors.push(v + ': ' + snap.err);
        }

        // The run frame: one Re-run from the dashboard, every write held.
        await page.goto(BASE_URL + '/dashboard?setup=0', { waitUntil: 'networkidle' }).catch(() => null);
        let pressed;
        await scanFrames('before the re-run');
        if (DRY) {
            // NOT PRESSED on a dry pass, and that is the one thing the press writes: `GET /hub?rerun`
            // makes the server record a RunStart row. A rehearsal must leave nothing behind.
            pressed = 'not pressed — dry pass';
        } else {
            pressed = await page.$eval('#db-rerun-btn', (b) => { b.click(); return true; }).catch((e) => 'no rerun button: ' + e.message);
            /**
             * GH-698 — ENUMERATED WHILE IT LIVES, not once after the wait. BEYOND WHAT WAS ASKED and
             * said so: the ask was to PRINT the enumerations. Printing alone would show the next
             * press that a frame came and went unobserved — it would not collect what the frame read.
             * Ten passes of two seconds each cover the same twenty seconds and drain each frame's
             * reads as they happen, so a frame that vanishes has already been read.
             */
            for (let i = 0; i < 10; i++) {
                await page.waitForTimeout(2000);
                await scanFrames('during the re-run wait, scan ' + (i + 1) + ' of 10');
            }
        }
        rec.rerunPressed = pressed;
        await scanFrames('after the re-run wait');
        await context.close();

        return rec;
    }

    beforeAll(async () => {
        if (!chromium) throw new Error('playwright does not resolve from the repo — run `npm install`');
        if (!EMAIL || !PASSWORD) throw new Error('no credentials');
        if (!guardStand) throw new Error('tests/e2e/lib/stand-guard.js does not resolve');
        treeBefore = treeMap();
        cen = census();

        browser = await chromium.launch();

        /**
         * THE POINTER IS MOVED ONCE, OUTSIDE BOTH PASSES, and that is what makes "exactly two
         * non-GET requests reached the stand" a statement rather than a hope: nothing is held in
         * this context because nothing but the switch happens in it.
         */
        const ctx0 = await browser.newContext();
        const p0 = await login(ctx0);
        await guardStand(p0);
        pointerBefore = await activeSiteId(p0);
        let target = null;
        if (SWITCH_TO) {
            const sites = await p0.evaluate(async () => (await (await fetch('/api/sites', { headers: { Accept: 'application/json' } })).json()));
            const list = (sites && (sites.sites || sites.data)) || [];
            const t = list.find((s) => s.name === SWITCH_TO);
            if (!t) throw new Error('site not found: ' + SWITCH_TO);
            target = t.id;
            const moved = await setPointer(p0, target);
            pointerMoveOk = moved.status === 200;
            toTheStand.push({
                when: 'before the measurement', method: 'PATCH', path: '/api/active-site',
                body: JSON.stringify({ site_id: target }), answer: JSON.stringify(moved),
            });
        }
        const pageSiteId = await activeSiteId(p0);
        hubUserId = await p0.evaluate(() => (window.GAIP_HUB_CONFIG && window.GAIP_HUB_CONFIG.userId) || null);
        // Real ids a membership check accepts: another visible site; a non-active sample.
        const idsForMember = await p0.evaluate(async (here) => {
            const j = async (u) => { const r = await fetch(u, { headers: { Accept: 'application/json' } }); return r.ok ? r.json() : null; };
            const s = await j('/api/sites'); const list = (s && (s.sites || s.data)) || [];
            const other = list.find((x) => x.id !== here && !/^(Canberra|Test1 - Sports|test4 - USA)$/.test(x.name));
            const out = { site: other ? other.id : null };
            for (const t of ['soil', 'water', 'tissue', 'loi']) {
                const r = await j('/api/samples?site_id=' + encodeURIComponent(here) + '&sample_type=' + t + '&limit=100');
                const rows = r && (r.data || r.samples) || [];
                out[t] = rows.length > 1 ? String(rows[1].id) : (rows.length ? String(rows[0].id) : null);
            }
            return out;
        }, pageSiteId);
        await ctx0.close();

        const memberKeys = Array.from(new Set(cen.sites.filter((s) => s.memberChecked && s.key && !/prefix/.test(s.form)).map((s) => s.key)));
        const memberPrefixes = Array.from(new Set(cen.sites.filter((s) => s.memberChecked && s.key && /prefix/.test(s.form) && s.key.length > 6).map((s) => s.key)));
        const bracketKeys = Array.from(new Set(cen.sites.filter((s) => /^bracket:(literal|prefix)$/.test(s.form) && s.key).map((s) => s.key)));
        const args = { memberKeys, memberPrefixes, bracketKeys, ids: idsForMember, sensorSrc: SENSOR.source };

        rsay('census: ' + cen.files + ' files, ' + cen.sites.length + ' read sites, sign version ' + SIGN_VERSION);
        rsay('member-checked keys: ' + JSON.stringify(memberKeys));
        rsay('member-checked prefixes: ' + JSON.stringify(memberPrefixes));
        rsay('bracket keys pre-seeded under fabrication: ' + JSON.stringify(bracketKeys));
        rsay('ids for member-checked keys: ' + JSON.stringify(idsForMember));

        // O FIRST, so a client's own storage is read before anything of ours is put into it.
        passes.O = await runPass('O', false, args);
        passes.P = await runPass('P', true, args);
    }, 1800000);

    afterAll(async () => {
        try {
            if (SWITCH_TO && pointerBefore) {
                const ctx1 = await browser.newContext();
                const p1 = await login(ctx1);
                await guardStand(p1);
                const back = await setPointer(p1, pointerBefore);
                toTheStand.push({
                    when: 'after the measurement', method: 'PATCH', path: '/api/active-site',
                    body: JSON.stringify({ site_id: pointerBefore }), answer: JSON.stringify(back),
                });
                pointerAfter = await activeSiteId(p1);
                await ctx1.close();
            } else if (browser) {
                const ctx1 = await browser.newContext();
                const p1 = await login(ctx1);
                pointerAfter = await activeSiteId(p1);
                await ctx1.close();
            }
        } catch (e) {
            rsay('restore failed: ' + e.message);
        }
        if (browser) await browser.close();

        const treeAfter = treeMap();
        const drift = diffMaps(treeBefore || {}, treeAfter);
        fs.mkdirSync(WRITE_TO, { recursive: true });
        const file = path.join(WRITE_TO, (DRY ? '3bd-DRY-not-a-measurement-' : '3bd-storage-reads-')
            + new Date().toISOString().replace(/[:.]/g, '-') + '.log');
        standing.push(wroteLine(file, ROOT, DRY));
        const journal = assembleJournal({
            drift, pointerBefore, pointerAfter, controls, standing, readingLines, dry: DRY,
        });
        const out = journal.lines;
        fs.writeFileSync(file, out.join('\n') + '\n');
        out.forEach((l) => process.stdout.write('[3bd] ' + l + '\n'));
        process.stdout.write('[3bd] written: ' + file + '\n');
    }, 600000);

    test('every read site gets one of three outcomes, a class from two passes, and a reason when it did not run', async () => {
        expect(pointerMoveOk).toBe(true);

        /**
         * THE KIND COMES FROM PASS P, because a kind is decided by where a value ARRIVES, and only
         * the fabricated pass can follow a value to its destination.
         */
        const P = passes.P;
        const classOf = {};
        const order = ['writeback', 'decides-input', 'display'];
        Object.keys(P.markers).forEach((id) => {
            const key = P.markers[id];
            const needle = id.startsWith('ID:') ? id.slice(3) : '«' + id + '»';
            const hit = P.sinks.filter((s) => s.text && s.text.indexOf(needle) >= 0);
            let cls = 'inert';
            if (hit.some((s) => s.kind === 'request-body' || (s.kind === 'request-url' && !id.startsWith('ID:')))) cls = 'writeback';
            else if (hit.some((s) => s.kind === 'field')) cls = 'decides-input';
            else if (hit.some((s) => s.kind === 'text')) cls = 'display';
            if (!classOf[key] || order.indexOf(cls) >= 0 && (order.indexOf(classOf[key]) < 0 || order.indexOf(cls) < order.indexOf(classOf[key]))) classOf[key] = cls;
            const space = id.startsWith('ID:') ? 'real id' : (P.spaces[id.slice(1, id.indexOf('-'))] || 'UNKNOWN SPACE');
            if (hit.length) {
                rsay('   marker ' + id + ' [issued in ' + space + '] (' + key + ') -> '
                    + hit.map((s) => s.kind + '@' + s.where + (space !== 'real id' && s.where !== space && s.kind !== 'request-body' && s.kind !== 'request-url' ? ' CROSS-DOCUMENT' : '')).slice(0, 6).join(', '));
            }
        });

        // ── the standing statements: the date, what pass O is, and what this run wrote ──────────
        standing.push('DATE | ' + new Date().toISOString() + ' | sign version ' + SIGN_VERSION
            + ' | census ' + cen.sites.length + ' read sites in ' + cen.files + ' files');
        standing.push('O-BOUNDARY | ' + O_BOUNDARY);
        if (DRY) {
            standing.push('DRY RUN | NOT A MEASUREMENT. One view, no Re-run, no pointer switch, no non-GET to the'
                + ' stand. This run exists to execute the path from opening a page to writing this file; every'
                + ' reading below is marked UNTRUSTED and none of it is a finding.');
        }
        /**
         * GH-696 — THE ROWS ARE COUNTED, NOT ASSUMED. This said "one per pass" and printed the number
         * of passes, so a dry pass — which presses no Re-run and writes no `RunStart` at all — stated
         * that two rows had been written. Found by reading the artefact rather than the code: the
         * journal named a write that had not happened, which is the one thing a journal must not do.
         * It counts the `GET /hub?rerun` requests the run actually made.
         */
        const rerunGets = ['O', 'P'].reduce((n, label) => n + ((passes[label] && passes[label].gets) || [])
            .filter((g) => /\/hub$/.test(g.path) && /rerun/.test(g.search)).length, 0);
        standing.push('WRITES | site data: not written (every non-GET held except the declared pointer switch)'
            + ' | server cache: ' + rerunGets + ' RunStart rows, one per `GET /hub?rerun` this run made, TTL 1 day'
            + ' | server sessions: the test user\'s session row is written on every request (SESSION_DRIVER=database)');

        // ── ROUTE: every view of both passes, with where it actually landed ─────────────────────
        ['O', 'P'].forEach((label) => {
            (passes[label].routes || []).forEach((r) => {
                rsay('ROUTE | pass=' + label + ' | ' + r.view
                    + ' | requested=' + r.requested + ' | final=' + r.final
                    + ' | status=' + r.status + ' | reads=' + r.reads
                    + (r.note ? ' | ' + r.note : ''));
            });
            rsay('ROUTE | pass=' + label + ' | re-run pressed: ' + JSON.stringify(passes[label].rerunPressed));
        });

        /**
         * HOW MANY OF EACH LINE THERE ARE, counted here rather than left to a search.
         *
         * Every reading is prefixed `UNTRUSTED ` when the instrument is unfit or the pass is dry —
         * the plan requires that prefix — and a search anchored at the start of a line then finds no
         * `ROUTE` at all. That is how this journal was read as having none. The count says what is
         * there whatever the prefix.
         */
        rsay('COUNTS | ROUTE=' + ['O', 'P'].reduce((n, l) => n + ((passes[l] && passes[l].routes) || []).length, 0)
            + ' | HELD=' + ['O', 'P'].reduce((n, l) => n + ((passes[l] && passes[l].held) || []).length, 0)
            + ' | views opened per pass=' + JSON.stringify(['O', 'P'].map((l) => ((passes[l] && passes[l].views) || []).length))
            + (passes.O && passes.O.dryViewsBecause ? ' | dry views chosen because: ' + JSON.stringify(passes.O.dryViewsBecause) : ''));

        // ── PASSED: what really reached the stand, and every distinct GET ───────────────────────
        toTheStand.forEach((t) => {
            rsay('PASSED | ' + t.method + ' ' + t.path + ' | ' + t.when + ' | body=' + t.body + ' | answer=' + t.answer);
        });
        ['O', 'P'].forEach((label) => {
            const gets = passes[label].gets || [];
            rsay('PASSED | pass=' + label + ' | distinct GET paths (' + gets.length + '): '
                + JSON.stringify(Array.from(new Set(gets.map((g) => g.path))).sort()));
            const rerun = gets.filter((g) => /\/hub$/.test(g.path) && /rerun/.test(g.search));
            rerun.forEach((g) => {
                rsay('PASSED | GET ' + g.path + g.search
                    + ' | server writes one RunStart row to the cache table (TTL 86400 s), not site data');
            });
            if (!rerun.length) {
                rsay('PASSED | pass=' + label + ' | NO GET /hub?rerun — the run frame did not open, so no RunStart row was written by this pass');
            }
        });

        // ── HELD: every write kept off the stand, named with the page it came from ──────────────
        ['O', 'P'].forEach((label) => {
            (passes[label].held || []).forEach((h) => {
                rsay('HELD | pass=' + label + ' | page=' + h.page + ' | ' + h.method + ' ' + h.path + ' | body-bytes=' + h.bytes);
            });
        });

        /**
         * ── the outcome of every census site, and its class across the two passes ───────────────
         *
         * A site is tied to a pass by its own `file:line` appearing in a read's stack, whatever
         * form its key takes. The class is what the two passes say together:
         *   `in-both`                  — it runs for a client as it runs for us;
         *   `only-under-fabrication`   — it ran only because we put something in the storage, so it
         *                                is POSSIBLE for a client and not shown;
         *   `only-without-fabrication` — our own values stopped it running, which is a limit of the
         *                                measurement and is printed as one.
         */
        const byLine = (s) => new RegExp('/' + s.file.replace(/[.]/g, '\\.') + '(\\?[^:]*)?:' + s.line + ':');
        const ranIn = (label, re) => passes[label].reads.filter((r) => re.test(r.stack));
        const classFromPasses = executionClass;

        const vs = viewScripts();
        const visited = new Set();
        ['O', 'P'].forEach((label) => (passes[label].routes || []).forEach((r) => { if (r.requested && !/NOT VISITED/.test(r.note || '')) visited.add(r.view); }));
        const heldOn = (views) => {
            const out = [];
            ['O', 'P'].forEach((label) => (passes[label].held || []).forEach((h) => {
                if (views.some((v) => (VIEW_ROUTES[v] && h.page.indexOf(VIEW_ROUTES[v].split('?')[0]) >= 0))) {
                    out.push(label + ':' + h.method + ' ' + h.path);
                }
            }));

            return Array.from(new Set(out));
        };

        rsay('census sites by outcome:');
        const executedSites = [];
        const readsBySite = [];
        cen.sites.forEach((s) => {
            const re = byLine(s);
            const inO = ranIn('O', re);
            const inP = ranIn('P', re);
            const cls = classFromPasses(inO.length > 0, inP.length > 0);
            const viewsWithIt = Object.keys(vs).filter((v) => vs[v].has(s.file));
            if (!cls) {
                // NOT EXECUTED in both passes: the reason, from facts this run printed.
                const held = heldOn(viewsWithIt);
                const cause = causeFor({ viewsWithIt, visitedViews: Array.from(visited), heldOnThoseViews: held });
                rsay('   NOT EXECUTED  ' + s.file + ':' + s.line + '  ' + s.form + '  key=' + JSON.stringify(s.key)
                    + '  via ' + s.receiver + '  cause=' + JSON.stringify(cause)
                    + '  views=' + JSON.stringify(viewsWithIt) + '  held-on-those-views=' + JSON.stringify(held));

                return;
            }
            const keys = Array.from(new Set(inO.concat(inP).map((r) => r.key)));
            const kinds = Array.from(new Set(keys.map((k) => (SENSOR.test(k) ? 'excluded' : (classOf[k] || 'inert')))));
            const real = inP.filter((r) => !r.marked).length;
            const fabricated = inP.filter((r) => r.marked).length;
            rsay('   EXECUTED      ' + s.file + ':' + s.line + '  ' + s.form + '  keys=' + JSON.stringify(keys)
                + '  execution=' + cls + '  kind=' + JSON.stringify(kinds)
                + '  reads real=' + real + ' fabricated=' + fabricated
                + '  wasNull in O=' + JSON.stringify(Array.from(new Set(inO.map((r) => r.wasNull))))
                + '  wasNull in P=' + JSON.stringify(Array.from(new Set(inP.map((r) => r.wasNull)))));
            executedSites.push({ site: s, cls, keys, kinds });
            readsBySite.push(s.file + ':' + s.line + ' | pass=' + (inO.length ? 'O' : '') + (inP.length ? 'P' : '') + ' | keys=' + JSON.stringify(keys));
        });

        /**
         * THE LIST OF READS BY `file:line`, as its own block. Part A of the cache work removes some
         * of these; without this list nobody can say afterwards which ones it removed and which ones
         * were never found. The date above stamps when this list was true.
         */
        rsay('READS-BY-SITE (' + readsBySite.length + '):');
        readsBySite.forEach((l) => rsay('   ' + l));

        // Reads the census never declared, with their caller.
        const PLANT = /^probe_/;
        const missedBy = {};
        ['O', 'P'].forEach((label) => passes[label].reads
            .filter((r) => !PLANT.test(r.key) && /\/(legacy-)?assets\//.test(r.stack)
                && !cen.sites.some((s) => byLine(s).test(r.stack)))
            .forEach((r) => {
                const top = (r.stack.match(/\/(legacy-)?assets\/[^\s)|]+/) || ['?'])[0].replace(/\?v=\d+/, '');
                (missedBy[top] = missedBy[top] || new Set()).add(label + ':' + r.key);
            }));
        rsay('reads not in the census: ' + Object.keys(missedBy).length);
        Object.keys(missedBy).sort().forEach((t) => rsay('   NOT FOUND     ' + t + '  keys=' + JSON.stringify(Array.from(missedBy[t]))));

        rsay('keys by kind:');
        Object.keys(classOf).sort().forEach((k) => rsay('   ' + classOf[k].padEnd(14) + k));
        rsay('marker spaces: ' + Object.keys(P.spaces).length);
        Object.keys(P.spaces).forEach((t) => rsay('   M' + t + '-*  issued in ' + P.spaces[t]));

        // ── the CONTROL block: what the device caught, before any of the above is read ──────────
        const plantClass = (key) => classOf[key] || 'NOT CAUGHT';
        const plantExecution = (key) => classFromPasses(
            passes.O.reads.some((r) => r.key === key),
            passes.P.reads.some((r) => r.key === key)
        ) || 'NOT EXECUTED';
        const layer1 = censusOfSource('<plant>', PLANT_SRC).sites;
        controls.push({ name: 'census sees wrapper:rd', expected: true, got: layer1.some((x) => /^wrapper:rd:literal$/.test(x.form) && x.key === 'probe_wrapper_key') });
        controls.push({ name: 'census sees bracket', expected: true, got: layer1.some((x) => x.form === 'bracket:literal' && x.key === 'probe_bracket_key') });
        controls.push({ name: 'census sees _ls', expected: true, got: layer1.some((x) => x.receiver === '_ls' && x.key === 'probe_ns_key') });
        controls.push({ name: 'plant:probe_wrapper_key', expected: 'writeback', got: plantClass('probe_wrapper_key') });
        controls.push({ name: 'plant:probe_bracket_key', expected: 'decides-input', got: plantClass('probe_bracket_key') });
        controls.push({ name: 'plant:probe_display_key', expected: 'display', got: plantClass('probe_display_key') });
        controls.push({ name: 'plant:probe_inert_key', expected: 'inert', got: plantClass('probe_inert_key') });
        controls.push({
            name: 'plant:probe_ns_key caught through _ls', expected: true,
            got: Object.keys(classOf).some((x) => /probe_ns_key$/.test(x)),
        });
        // The pair that tells a client's behaviour from the measurement's own.
        controls.push({ name: 'plant:probe_both_key execution', expected: 'in-both', got: plantExecution('probe_both_key') });
        controls.push({ name: 'plant:probe_onlyfab_child execution', expected: 'only-under-fabrication', got: plantExecution('probe_onlyfab_child') });
        // In the data, each on a read that executes.
        const ctl = (k) => Object.keys(classOf).filter((x) => x === k || x.startsWith(k)).map((x) => classOf[x]);
        controls.push({ name: 'gilba_import_active_site', expected: true, got: ctl('gilba_import_active_site').includes('writeback') });
        /**
         * GH-701 — THE EXPECTATION IS `inert`, AND IT IS THE CONTROL THAT CHANGED, NOT THE PRODUCT.
         *
         * It expected `decides-input`. The rehearsal answered `inert`, and the reviewer had decided
         * BEFORE the press which of the two would be wrong in that case: if the run frame is
         * enumerated and no marker is found in it, the CONTROL is wrong. The third press settled the
         * premise — the frame IS enumerated on a live pass, six markers were issued inside it with
         * sinks in it — so the frame was seen and the value still reaches no field.
         *
         * Recorded here rather than in a report because a control whose expectation moves without a
         * reason beside it is the thing this instrument exists to prevent.
         */
        controls.push(hubStateControl(hubUserId, classOf));
        const INERT_KEY = 'gilba_disease_cache_purged_v1';
        const inertSite = cen.sites.filter((s) => s.file === 'gaip-field-log-analysis.js' && s.key === INERT_KEY);
        const inertMarked = passes.P.reads.filter((r) => r.key === INERT_KEY && r.marked && inertSite.some((s) => byLine(s).test(r.stack)));
        controls.push({ name: INERT_KEY + ' executed and marked', expected: true, got: inertMarked.length > 0 });
        controls.push({ name: INERT_KEY + ' kind', expected: 'inert', got: classOf[INERT_KEY] || 'NOT MARKED' });
        controls.push({ name: 'marker spaces are named', expected: true, got: Object.keys(P.spaces).length > 0 && !Object.keys(P.markers).some((id) => !id.startsWith('ID:') && !P.spaces[id.slice(1, id.indexOf('-'))]) });

        /**
         * GH-696 — ON A DRY PASS, "IT FAILED" AND "IT COULD NOT BE REACHED" ARE DIFFERENT LINES.
         *
         * The first dry pass came back `INSTRUMENT NOT VALID` on the three data controls and the
         * journal said only that. Measured afterwards: the dashboard loads none of the files where
         * those keys are read, so it was the views. The pass derives them now and three of the three
         * pass.
         *
         * THE FOURTH IS NOT THE SAME FACT. `gilba_hub_state` is read — eighteen fabricated reads, in
         * both passes — and its KIND comes out `inert`, because a kind is decided by where the marked
         * value ARRIVES, and the field it arrives in is on `/hub` or inside the Re-run frame. A
         * harmless pass opens neither, by definition: pressing Re-run is the one thing that makes the
         * server write. So this control cannot be judged by a rehearsal, and the journal says that
         * instead of printing a bare FAIL that reads as a broken device.
         *
         * It is NOT fitted to green: the control keeps its expectation, the header still says
         * `INSTRUMENT NOT VALID`, and this line explains which of the two things that means.
         */
        if (DRY) {
            /**
             * GH-697 — THE DRY PASS'S OWN HEADER: four numbers and the views it opened, by name.
             *
             * Without these the journal could not tell "looked and found nothing" from "never
             * looked", which is exactly how the previous one was read. Every failure becomes a
             * control, so an unfit rehearsal says WHICH of the five conditions it failed rather
             * than only that it is unfit.
             */
            const fit = dryPassFitness({ passes, censusSites: cen.sites, viewRoutes: VIEW_ROUTES });
            ['O', 'P'].forEach((label) => {
                const n = fit.numbers[label];
                rsay('DRY-HEADER | pass=' + label
                    + ' | intercepted(no plants)=' + n.intercepted
                    + ' | bound to a census line=' + n.bound
                    + ' | names a census file but no line=' + n.fileButNoLine
                    + ' | views opened where asked=' + JSON.stringify(n.opened)
                    + ' | asked and NOT opened=' + JSON.stringify(n.notOpened));
            });
            rsay('DRY-HEADER | markers that reached a sink (P only)=' + fit.numbers.markersWithASink);
            ['O', 'P'].forEach((label) => {
                const pass = passes[label] || {};
                const f = fit.numbers[label].frames || {};
                rsay('FRAMES | pass=' + label + ' | enumerations=' + f.scans
                    + ' | distinct frames seen=' + f.framesSeen
                    + ' | run frame enumerated at=' + JSON.stringify(f.runFrameEnumeratedAt || [])
                    + ' | entries with no numbers=' + JSON.stringify(f.entriesWithoutNumbers || []));
                // LIST ONE: what was enumerated, each with its own numbers, in his shape — so the
                // difference between "enumerated and held no marker" and "never enumerated" can be
                // read off the page without anyone explaining it.
                (pass.frameScans || []).forEach((sc) => (sc.frames || []).forEach((e) => rsay('FRAMES | pass=' + label
                    + ' | frame ' + e.url + '  enumerated at ' + sc.at + ' (' + sc.why + ')'
                    + (e.unreachable ? '  UNREACHABLE: ' + e.unreachable
                        : '  fields=' + e.fields + ' text=' + e.text + ' reads=' + e.reads + ' markers found: ' + e.markersFound))));
                // LIST TWO: frames the instrument knew existed and did not enumerate.
                rsay('FRAMES | pass=' + label + ' | KNEW EXISTED AND DID NOT ENUMERATE: '
                    + JSON.stringify(f.attachedNeverScanned || []));
                (pass.frameEvents || []).forEach((e) => rsay('FRAMES | pass=' + label
                    + ' | ' + e.kind + ' at ' + e.at + ': ' + e.url));
            });
            controls.push({ name: 'dry pass: the five conditions', expected: [], got: fit.failures });

            DATA_CONTROL_KEYS.forEach((key) => {
                const readAtAll = ['O', 'P'].some((l) => (passes[l].reads || []).some((r) => r.key === key || r.key.indexOf(key) === 0));
                const marked = Object.keys(classOf).filter((x) => x === key || x.startsWith(key));
                rsay('DRY-REACH | ' + key
                    + ' | read on this pass: ' + readAtAll
                    + ' | kind found: ' + JSON.stringify(marked.map((x) => x + '=' + classOf[x]))
                    + ' | Re-run frame opened: false (a dry pass presses no Re-run, and that is the request that writes)'
                    + ' | /hub opened: false (no route for it here)');
            });
        }

        const inst = instrumentBlock(controls);
        process.stdout.write('[3bd] ' + headerLines({ drift: [], pointerBefore, pointerAfter: pointerBefore, failedControls: inst.failed }).join('\n[3bd] ') + '\n');
        inst.lines.forEach((l) => process.stdout.write('[3bd] ' + l + '\n'));

        rsay('question 84.3 — gilba_turf_profiles / _last: ' + JSON.stringify(Object.keys(classOf).filter((x) => /gilba_turf_profiles/.test(x)).map((x) => x + '=' + classOf[x])));

        /**
         * GH-694 — WHAT A DRY PASS ASSERTS, and it is not the verdicts.
         *
         * One view and no Re-run cannot satisfy the controls — several plants live on pages this pass
         * never opens — so demanding `inst.failed` be empty here would make the rehearsal red for the
         * right reasons and teach nothing. What it asserts is that THE PATH RAN: both passes recorded
         * reads, the control list was ASSEMBLED rather than left empty (the very defect that killed
         * the press), and the journal comes out in its four parts with a header of exactly two lines.
         */
        const journal = assembleJournal({
            drift: [], pointerBefore, pointerAfter: pointerBefore,
            controls, standing, readingLines, dry: DRY,
        });
        process.stdout.write('[3bd] journal assembled: ' + journal.lines.length + ' lines'
            + ' | controls ' + controls.length + ' | controls missing: ' + journal.controlsMissing
            + ' | every reading untrusted: ' + journal.untrusted + '\n');
        journal.head.forEach((l) => process.stdout.write('[3bd] ' + l + '\n'));
        journal.block.forEach((l) => process.stdout.write('[3bd] ' + l + '\n'));

        expect(passes.O.reads.length).toBeGreaterThan(0);
        expect(passes.P.reads.length).toBeGreaterThan(0);
        expect(controls.length).toBeGreaterThan(10);
        expect(journal.controlsMissing).toBe(false);
        expect(journal.head).toHaveLength(2);
        expect(journal.head[0]).toMatch(/^RUN /);
        expect(journal.head[1]).toMatch(/^INSTRUMENT /);

        if (DRY) {
            // A rehearsal states what it left behind, and it must be nothing.
            expect(toTheStand).toEqual([]);
            expect(passes.O.rerunPressed).toBe('not pressed — dry pass');
            expect(journal.untrusted).toBe(true);

            return;
        }

        // The device decides whether any of the above may be read at all.
        expect(inst.failed).toEqual([]);
        expect(executedSites.length).toBeGreaterThan(0);
    }, 1800000);
});

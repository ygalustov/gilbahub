/**
 * GH-711 — THE PAGE HALF OF THE WRITE PATHS: WHICH SCRIPT CALLS WHICH WRITE ROUTE.
 *
 * The route list comes from `app/tests/fixtures/gh711-write-paths.json`, which
 * `Gh711WritePathsTest` proves equal to the framework's route registry both ways. This file
 * walks the page code — every script under `assets` and every view template, listed from disk
 * — finds each write call, and ties it to a route by the literal parts of its address. The
 * pairs "route <- file" and the calls whose address cannot be resolved are compared with the
 * recorded list both ways. A new caller of a write route, in a file that did not exist
 * yesterday, is red with its file and route without anyone editing a list.
 *
 * SIGN B, VERSIONED. The forms of a write call it knows are data (`SIGN.forms`): `fetch` with a
 * literal write method, `XMLHttpRequest.open` with a literal write method, `sendBeacon`. The
 * recorded list carries the sign it was measured under; a sign changed under the same version
 * is red. Growth under the same sign is printed apart from growth by a new form.
 *
 * WHAT THIS DOES NOT SEE, said before the first run:
 *   - a write whose method is not a literal (`method: m`) — printed as unresolved, by file;
 *   - an address built wholly from variables — unresolved, by file; a route whose only caller
 *     is such a call shows up as "route without a found caller", seen sideways;
 *   - a call through a computed name (`api[m](url)`) or a wrapper this sign does not know —
 *     not seen at all; only the frame invariant, by behaviour, would catch it, and this
 *     delivery does not build it;
 *   - which site the call carries: that is where its site comes from at run time, a question
 *     for behaviour, not for text.
 */

'use strict';

const fs = require('fs');
const path = require('path');

const ROOT = path.join(__dirname, '..');
const ROUTES = JSON.parse(fs.readFileSync(path.join(ROOT, 'app/tests/fixtures/gh711-write-paths.json'), 'utf8'));
const INVENTORY_PATH = path.join(ROOT, 'tests/fixtures/gh711-page-write-calls.json');

const SIGN = {
    version: 2,
    forms: ['fetch-literal-method', 'xhr-open-literal-method', 'sendBeacon',
        'fetch-options-variable', 'wrapper-call'],
};

/**
 * GH-762 (queue item 3vg) — THE SIGN USED TO SEE ONLY WHAT WAS WRITTEN IN ITS OWN SHAPE.
 *
 * Version 1 read the TEXT of one call: `fetch` with a literal `method:`, `.open` with a literal
 * method, `sendBeacon`. Two blind spots followed, and the analyst measured both.
 *
 *   - `fetch(url, options)` where the options are a VARIABLE carried no `method:` in its text, so
 *     the census did not even record it as unresolved — it read as a plain GET. That is how
 *     `onboarding-wizard.js`, `spray-log.js` and `site-config-persistence.js` were absent from this
 *     list in any form at all.
 *   - A WRAPPER — `apiFetch('PATCH', '/sites/' + id + '/config/gaip', body)` — showed up, at best,
 *     as one `method-not-literal` line in the wrapper's own file, and who called it was unknown.
 *
 * WRAPPERS ARE DERIVED, NEVER LISTED, and that is measured rather than preferred: one name means
 * different things in different files. `apiFetch(method, path, body)` in `account-init.js` and
 * `settings-init.js`, but `apiFetch(path, options)` in `gilba-alerts.js`; `apiRequest(method,
 * endpoint, …)` in `spray-log.js`, but `apiRequest(endpoint)` in `sensor-api-hydrosight.js`. A list
 * of names would fold those together and answer confidently about the wrong one.
 *
 * So a wrapper is a FUNCTION whose write takes its method or its address from its own parameters,
 * found by parsing; and a caller's route is built from that caller's own literal arguments. Where an
 * argument is not a literal, the call is `unresolved` AT THE CALLER — where the choice is made —
 * rather than silently dropped.
 */
const parser = require('@babel/parser');
const traverse = require('@babel/traverse').default;

/** One file's AST, or null when it cannot be parsed — named, never swallowed. */
function astOf(text) {
    try {
        return parser.parse(text, {
            sourceType: 'unambiguous', errorRecovery: true,
            plugins: ['classProperties', 'optionalChaining', 'nullishCoalescingOperator'],
        });
    } catch (e) {
        return null;
    }
}

/** A literal string, or a concatenation whose literal parts are kept — `'a' + x + '/b'` -> `a{x}/b`. */
function literalish(node) {
    if (!node) return null;
    if (node.type === 'StringLiteral') return node.value;
    if (node.type === 'TemplateLiteral') {
        return node.quasis.map((q, i) => q.value.cooked + (node.expressions[i] ? '{x}' : '')).join('');
    }
    if (node.type === 'BinaryExpression' && node.operator === '+') {
        const l = literalish(node.left);
        const r = literalish(node.right);

        return (l === null && r === null) ? null : (l === null ? '{x}' : l) + (r === null ? '{x}' : r);
    }

    return null;
}

/** The `method` a options-object node declares literally, or null. */
function methodOf(node) {
    if (!node || node.type !== 'ObjectExpression') return null;
    const prop = node.properties.find((x) => x.type === 'ObjectProperty'
        && ((x.key.name || x.key.value) === 'method'));

    return prop && prop.value.type === 'StringLiteral' ? prop.value.value.toUpperCase() : null;
}
const WRITE = ['POST', 'PUT', 'PATCH', 'DELETE'];

function filesUnder(dir, pred) {
    const out = [];
    (function rec(d) {
        for (const e of fs.readdirSync(d, { withFileTypes: true })) {
            const p = path.join(d, e.name);
            if (e.isDirectory()) rec(p);
            else if (pred(p)) out.push(p);
        }
    })(dir);
    return out.sort();
}

const universe = () => filesUnder(path.join(ROOT, 'assets'), (p) => p.endsWith('.js') && !p.endsWith('.min.js'))
    .concat(filesUnder(path.join(ROOT, 'app/resources/views'), (p) => p.endsWith('.blade.php')));

/** Comments blanked line by line so line numbers stay true; `//` only at a line start. */
function code(text) {
    return text.replace(/\/\*[\s\S]*?\*\//g, (m) => m.replace(/[^\n]/g, ' '))
        .replace(/\{\{--[\s\S]*?--\}\}/g, (m) => m.replace(/[^\n]/g, ' '))
        .replace(/^\s*\/\/.*$/gm, '');
}

/** The balanced argument text after `(` at index i, strings respected. */
function argsAt(src, i) {
    let depth = 0;
    for (let j = i; j < src.length; j++) {
        const c = src[j];
        if (c === '"' || c === "'" || c === '`') {
            const q = c;
            for (j++; j < src.length && src[j] !== q; j++) if (src[j] === '\\') j++;
            continue;
        }
        if (c === '(') depth++;
        else if (c === ')' && --depth === 0) return src.slice(i + 1, j);
    }
    return src.slice(i + 1);
}

/** Split at top-level commas. */
function topLevel(args) {
    const out = [];
    let depth = 0;
    let start = 0;
    for (let j = 0; j < args.length; j++) {
        const c = args[j];
        if (c === '"' || c === "'" || c === '`') {
            const q = c;
            for (j++; j < args.length && args[j] !== q; j++) if (args[j] === '\\') j++;
            continue;
        }
        if ('([{'.includes(c)) depth++;
        else if (')]}'.includes(c)) depth--;
        else if (c === ',' && depth === 0) { out.push(args.slice(start, j)); start = j + 1; }
    }
    out.push(args.slice(start));
    return out.map((s) => s.trim());
}

/**
 * An address expression as text: each top-level `+` operand that is a plain string or template
 * literal keeps its text, every other operand — a variable, a call, a parenthesised expression —
 * is `X`. A literal inside a computed operand is not a part of the address. Query dropped.
 */
function addressOf(expr) {
    const operands = [];
    let depth = 0;
    let start = 0;
    for (let j = 0; j < expr.length; j++) {
        const c = expr[j];
        if (c === '"' || c === "'" || c === '`') {
            const q = c;
            for (j++; j < expr.length && expr[j] !== q; j++) if (expr[j] === '\\') j++;
            continue;
        }
        if ('([{'.includes(c)) depth++;
        else if (')]}'.includes(c)) depth--;
        else if (c === '+' && depth === 0) { operands.push(expr.slice(start, j)); start = j + 1; }
    }
    operands.push(expr.slice(start));
    let out = '';
    operands.map((o) => o.trim()).forEach((o) => {
        let m;
        if ((m = /^'((?:[^'\\]|\\.)*)'$/.exec(o)) || (m = /^"((?:[^"\\]|\\.)*)"$/.exec(o))) out += m[1];
        else if ((m = /^`((?:[^`\\]|\\.)*)`$/.exec(o))) out += m[1].replace(/\$\{[^}]*\}/g, 'X');
        else if (o) out += 'X';
    });
    return out.replace(/\?.*$/, '').replace(/^https?:\/\/[^/]+/, '').replace(/X+/g, 'X');
}

/**
 * The routes an address can be. `X` is whatever the code computes: first read as part of one
 * segment, and only if that finds nothing, as any run of characters (a base such as `'/api/'`
 * held in a variable). More than one route is not a guess made here: it is printed unresolved.
 */
function routeFor(method, address) {
    // An address with no literal part at all names no route: it is printed unresolved.
    if (!/[^X/]/.test(address)) return [];
    const candidates = Object.keys(ROUTES.routes).filter((key) => key.slice(0, key.indexOf(' ')).split('|').includes(method));
    const text = (key) => key.slice(key.indexOf(' ') + 1).replace(/^\//, '').replace(/\{[^}]*\}/g, 'P');
    const esc = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    for (const wild of ['[^/]*', '.*']) {
        // A computed base in front (`base + '/sites'`) stands for any leading part of the path.
        const body = address.replace(/^X\/?/, '').replace(/^\//, '');
        const lead = /^X/.test(address) ? '^(?:.*/)?' : '^/?';
        const re = new RegExp(lead + body.split('X').map(esc).join(wild) + '/?$');
        const hits = candidates.filter((key) => re.test(text(key)));
        if (hits.length) return hits;
    }
    return [];
}

function lineOf(src, index) { return src.slice(0, index).split('\n').length; }

/** Every write call in one source, by the forms the sign knows. */
function callsIn(file, text, forms) {
    const src = code(text);
    const rel = path.relative(ROOT, file);
    const out = [];
    const push = (index, method, expr) => {
        const address = addressOf(expr || '');
        const routes = method && WRITE.includes(method) ? routeFor(method, address) : [];
        out.push({ file: rel, line: lineOf(src, index), method, address, routes });
    };
    if (forms.includes('fetch-literal-method')) {
        const re = /\bfetch\s*\(/g;
        let m;
        while ((m = re.exec(src)) !== null) {
            const parts = topLevel(argsAt(src, m.index + m[0].length - 1));
            const opts = parts.slice(1).join(',');
            const lit = /\bmethod\s*:\s*(['"])(\w+)\1/.exec(opts);
            if (lit) {
                const method = lit[2].toUpperCase();
                if (WRITE.includes(method)) push(m.index, method, parts[0]);
            } else if (/\bmethod\s*:/.test(opts)) {
                push(m.index, null, parts[0]);
            }
        }
    }
    if (forms.includes('xhr-open-literal-method')) {
        const re = /\.open\s*\(\s*(['"])(\w+)\1\s*,/g;
        let m;
        while ((m = re.exec(src)) !== null) {
            const method = m[2].toUpperCase();
            if (!WRITE.includes(method)) continue;
            const parts = topLevel(argsAt(src, src.indexOf('(', m.index)));
            push(m.index, method, parts[1]);
        }
    }
    if (forms.includes('sendBeacon')) {
        const re = /\bsendBeacon\s*\(/g;
        let m;
        while ((m = re.exec(src)) !== null) push(m.index, 'POST', topLevel(argsAt(src, m.index + m[0].length - 1))[0]);
    }
    return out;
}

/**
 * GH-762 — WHAT ONE FILE WRITES THROUGH A VARIABLE, AND WHAT IT WRAPS.
 *
 * Returns `{ calls, wrappers }`. A call is the same shape the text forms produce. A wrapper is
 * `{ name, methodFrom, addressFrom, prefix }`: which of its own parameters carries the method and
 * which the address, so a caller's literals can be read into a route.
 */
function byParseIn(file, text) {
    const rel = path.relative(ROOT, file);
    const ast = astOf(text);
    if (!ast) return { calls: [], wrappers: [], unparsed: [rel] };
    const calls = [];
    const wrappers = [];

    /** The function a path sits in, with its parameter names. */
    const holder = (p) => {
        const fn = p.getFunctionParent();
        if (!fn) return null;
        const params = fn.node.params.map((x) => (x.type === 'Identifier' ? x.name : null));
        let name = fn.node.id ? fn.node.id.name : null;
        if (!name && fn.parentPath && fn.parentPath.node.type === 'VariableDeclarator') {
            name = fn.parentPath.node.id.name;
        }
        if (!name && fn.parentPath && fn.parentPath.node.type === 'ObjectProperty') {
            name = fn.parentPath.node.key.name || fn.parentPath.node.key.value;
        }

        return { fn, params, name };
    };

    traverse(ast, {
        CallExpression(p) {
            const callee = p.node.callee;
            const isFetch = callee.type === 'Identifier' && callee.name === 'fetch';
            if (!isFetch || p.node.arguments.length < 2) return;
            const opts = p.node.arguments[1];
            const line = p.node.loc ? p.node.loc.start.line : 0;
            const address = literalish(p.node.arguments[0]);
            if (opts.type === 'ObjectExpression') return;   // the text form already has this one
            const h = holder(p);

            // The options are a variable. Follow it one step, inside this function.
            if (opts.type === 'Identifier') {
                const bind = p.scope.getBinding(opts.name);
                const init = bind && bind.path.node.type === 'VariableDeclarator' ? bind.path.node.init : null;
                const m = methodOf(init);
                if (m) {
                    calls.push({ file: rel, line, method: m, address, routes: [], form: 'fetch-options-variable' });

                    return;
                }
                // A parameter of the enclosing function: this function is a wrapper.
                if (h && h.params.includes(opts.name)) {
                    wrappers.push({ file: rel, name: h.name, methodFrom: { param: h.params.indexOf(opts.name), field: 'method' },
                        addressFrom: h.params.indexOf(literalish(p.node.arguments[0]) === null
                            && p.node.arguments[0].type === 'Identifier' ? p.node.arguments[0].name : ''),
                        prefix: address, line });

                    return;
                }
            }
            // Anything else: named, never read as a plain GET.
            calls.push({ file: rel, line, method: null, address, routes: [], form: 'fetch-options-variable' });
        },
    });

    return { calls, wrappers, unparsed: [] };
}

function census(forms, files = universe()) {
    const calls = [];
    const wrappers = [];
    files.forEach((f) => {
        const text = fs.readFileSync(f, 'utf8');
        calls.push(...callsIn(f, text, forms));
        if (forms.includes('fetch-options-variable') && /\.js$/.test(f)) {
            const got = byParseIn(f, text);
            got.calls.forEach((c) => {
                c.routes = c.method && WRITE.includes(c.method) ? routeFor(c.method, c.address) : [];
                calls.push(c);
            });
            wrappers.push(...got.wrappers);
        }
    });
    const pairs = {};
    const unresolved = [];
    calls.forEach((c) => {
        if (c.routes.length === 1) {
            (pairs[c.routes[0]] = pairs[c.routes[0]] || new Set()).add(c.file);
        } else {
            unresolved.push(c.file + ': ' + (c.method || 'method-not-literal') + ' ' + (c.address || '?')
                + (c.routes.length > 1 ? ' (matches ' + c.routes.length + ' routes)' : ''));
        }
    });
    const byRoute = {};
    Object.keys(pairs).sort().forEach((k) => { byRoute[k] = Array.from(pairs[k]).sort(); });
    return { files: files.length, calls, wrappers, byRoute, unresolved: Array.from(new Set(unresolved)).sort() };
}

function compare(c, inv) {
    const pairsOf = (byRoute) => Object.keys(byRoute).flatMap((k) => byRoute[k].map((f) => k + ' <- ' + f));
    const now = new Set(pairsOf(c.byRoute));
    const then = new Set(pairsOf(inv.byRoute));
    return {
        unknownCaller: Array.from(now).filter((p) => !then.has(p)).sort(),
        declaredButNotFound: Array.from(then).filter((p) => !now.has(p)).sort(),
        newUnresolved: c.unresolved.filter((u) => !inv.unresolved.includes(u)),
        unresolvedGone: inv.unresolved.filter((u) => !c.unresolved.includes(u)),
    };
}

describe('GH-711 — page write calls equal the recorded list, both ways', () => {
    const inv = JSON.parse(fs.readFileSync(INVENTORY_PATH, 'utf8'));

    test('the census of assets and views equals the recorded callers and unresolved calls', () => {
        const c = census(SIGN.forms);
        process.stdout.write('[gh711] sign in force: ' + JSON.stringify(SIGN) + '; list measured under: ' + JSON.stringify(inv.sign) + '\n'
            + '[gh711] inspected ' + c.files + ' files (assets scripts and view templates); write calls found: ' + c.calls.length + '\n');
        Object.keys(c.byRoute).forEach((k) => process.stdout.write('[gh711]    ' + k + ' <- ' + JSON.stringify(c.byRoute[k]) + '\n'));
        process.stdout.write('[gh711] unresolved calls (' + c.unresolved.length + '): ' + JSON.stringify(c.unresolved) + '\n');
        const noCaller = Object.keys(ROUTES.routes).filter((k) => !c.byRoute[k]);
        process.stdout.write('[gh711] routes without a found caller (' + noCaller.length + '): ' + JSON.stringify(noCaller) + '\n');
        if (process.env.GH711_PRINT) process.stdout.write(JSON.stringify({ byRoute: c.byRoute, unresolved: c.unresolved }, null, 2) + '\n');

        expect(inv.sign).toEqual(SIGN);
        expect(compare(c, inv)).toEqual({ unknownCaller: [], declaredButNotFound: [], newUnresolved: [], unresolvedGone: [] });
    });

    test('growth under the same sign is told apart from growth by a new form', () => {
        const narrow = census(SIGN.forms.filter((f) => f !== 'sendBeacon'));
        const full = census(SIGN.forms);
        const key = (x) => x.file + ':' + x.line;
        const onlyByTheForm = full.calls.filter((x) => !narrow.calls.some((y) => key(y) === key(x))).map(key);
        const lost = narrow.calls.filter((x) => !full.calls.some((y) => key(y) === key(x))).map(key);
        process.stdout.write('[gh711] calls only the `sendBeacon` form names: ' + JSON.stringify(onlyByTheForm) + '\n');
        expect(lost).toEqual([]);
    });

    describe('positive control: a caller in a NEW file is named without editing any list', () => {
        const probe = path.join(ROOT, 'assets', '__gh711_probe_delete_me.js');
        afterEach(() => { if (fs.existsSync(probe)) fs.unlinkSync(probe); });

        test('a fetch that patches a site config from a file that did not exist', () => {
            fs.writeFileSync(probe, "fetch('/api/sites/' + siteId + '/config/gaip', { method: 'PATCH', body: b });\n");
            const d = compare(census(SIGN.forms), inv);
            expect(d.unknownCaller).toEqual(['PATCH api/sites/{site}/config/gaip <- assets/__gh711_probe_delete_me.js']);
        });

        test('and without the probe the census is back to the recorded list', () => {
            expect(fs.existsSync(probe)).toBe(false);
            expect(compare(census(SIGN.forms), inv).unknownCaller).toEqual([]);
        });
    });
});

module.exports = { census, compare, addressOf, routeFor };

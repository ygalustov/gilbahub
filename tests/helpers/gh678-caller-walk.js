/**
 * GH-678 — WHO EXECUTES A MODULE, ANSWERED FROM A PARSE RATHER THAN FROM PATTERNS.
 *
 * WHY THIS IS A PARSE. The first form of this helper recognised functions by five written
 * patterns and counted braces over masked text. Every one of its faults was a FALSE
 * SIGNAL that came out green or wrongly red: a brace inside a string ended a method's
 * range a hundred lines early; `async function` and a named arrow were missing, so a call
 * inside one was attributed to the file's top level — which in this walk means "a page
 * entry point", crediting a node with an executor it does not have; a function handed to
 * `addEventListener` without parentheses was reported as called by nobody.
 *
 * The parser answers all three by construction. `@babel/types` has an alias for functions
 * that covers SIX forms, `getFunctionParent()` gives the enclosing one and returns null
 * exactly at the file's top level, and a function's CALLERS are every reference to its
 * binding — so a callback handed over is a caller without any list of the places one can
 * be handed over.
 *
 * TWO WRITTEN LISTS REMAIN, and both are on the surface:
 *
 *   1. THE NODE TYPES THAT CARRY A `callee`. There is no alias for them, so the list is
 *      written — but its UNIVERSE IS THE PARSER'S OWN SCHEMA, never the types that
 *      happened to appear in the files we read. A universe taken from what was seen would
 *      be the list checking itself.
 *   2. HOW A MEMBER CALL IS RESOLVED ACROSS FILES: `global.X.key(...)` is this function
 *      when some file exports `X` with `key` bound to it. `.call`, `.apply`, `.bind` and
 *      `obj[computed](...)` are NOT resolved and go to `unresolved executor` — a guess
 *      would be the fifth default in a mechanism from which four have just been removed.
 */

'use strict';

const fs = require('fs');
const path = require('path');
const parser = require('@babel/parser');
const traverse = require('@babel/traverse').default;
const types = require('@babel/types');

const ROOT = path.join(__dirname, '..', '..');
const ASSETS = path.join(ROOT, 'assets');

/**
 * WRITTEN LIST 1, AND WHICH OF TWO GUARDS THIS IS — declared, because both are honest and
 * only an unnamed choice is not.
 *
 * THE UNIVERSE IS THE PARSER'S SCHEMA (`@babel/types`), not the node types that happen to
 * appear in the files we read. So an incomplete list reddens BEFORE a case of the missing
 * type exists anywhere in the tree. The other guard — universe from what was seen —
 * reddens at the moment such a case appears, which is later and also true; this file is
 * the first one, and says so.
 */
const CALL_NODE_TYPES = [
    'CallExpression',
    'OptionalCallExpression',
    'NewExpression',
    'BindExpression',
    'PipelineBareFunction',
];

/** The same set as the PARSER declares it: every node type with a `callee` field. */
function callNodeTypesFromTheParser() {
    return Object.keys(types.NODE_FIELDS)
        .filter((k) => types.NODE_FIELDS[k] && types.NODE_FIELDS[k].callee)
        .sort();
}

function scripts() {
    return fs.readdirSync(ASSETS)
        .filter((f) => f.endsWith('.js') && !f.endsWith('.min.js'))
        .sort()
        .map((f) => 'assets/' + f);
}

/** Inline `<script>` blocks of the views, as places a call can be made from. */
function viewScripts() {
    const base = path.join(ROOT, 'app', 'resources', 'views');
    const out = [];
    const walkDir = (dir) => {
        fs.readdirSync(dir, { withFileTypes: true }).forEach((e) => {
            const full = path.join(dir, e.name);
            if (e.isDirectory()) return walkDir(full);
            if (!e.name.endsWith('.blade.php')) return;
            const src = fs.readFileSync(full, 'utf8');
            const re = /<script\b[^>]*>([\s\S]*?)<\/script>/g;
            let m;
            while ((m = re.exec(src)) !== null) {
                if (m[1].trim()) out.push({ view: path.relative(ROOT, full), body: m[1] });
            }
            /**
             * AN `on*` ATTRIBUTE IS A PAGE ENTRY POINT TOO, and leaving it out made live code
             * look dead. The analyst found six of them in the views, among them
             * `onclick="rpExportWordWithPicker("` on the export page and two
             * `onclick="GilbaScenarioUI.showWhatIfPanel("`: a function called ONLY from an
             * attribute has no caller anywhere in the parsed universe, so it would arrive in
             * the DEAD list -- and that list is the one that invites deleting code. The Word
             * export button is as client-facing as anything in this product.
             *
             * The value is parsed as an expression, exactly like an inline script; a handler
             * written there runs when the person clicks, which is the same kind of entry as a
             * listener registered at load.
             */
            const attr = /\son[a-z]+\s*=\s*"([^"]+)"/g;
            while ((m = attr.exec(src)) !== null) {
                if (m[1].trim()) {
                    out.push({ view: path.relative(ROOT, full), body: m[1], fromAttribute: true });
                }
            }
        });
    };
    walkDir(base);

    return out;
}

/** The name a function is known by, whatever of the six forms it takes. */
function nameOfFunction(p) {
    const n = p.node;
    if (n.id && n.id.name) return n.id.name;
    if (types.isObjectMethod(n) || types.isClassMethod(n) || types.isClassPrivateMethod(n)) {
        return (n.key && (n.key.name || n.key.id && n.key.id.name)) || null;
    }
    const parent = p.parentPath && p.parentPath.node;
    if (!parent) return null;
    if (types.isVariableDeclarator(parent) && parent.id && parent.id.name) return parent.id.name;
    if (types.isAssignmentExpression(parent)) {
        const left = parent.left;
        if (types.isIdentifier(left)) return left.name;
        if (types.isMemberExpression(left) && types.isIdentifier(left.property)) return left.property.name;
    }
    if (types.isObjectProperty(parent) && types.isIdentifier(parent.key)) return parent.key.name;

    return null;
}

/**
 * THE NEAREST **NAMED** FUNCTION AROUND A NODE, and whether there is any function at all.
 *
 * `getFunctionParent()` returning null and an ANONYMOUS enclosing function are two
 * different facts, and the first version of this helper reported both as `null`. In this
 * walk "no function" means the file's top level, which is a PAGE ENTRY POINT — so a call
 * inside a callback registered in `bindEvents` came out as a page entry point of every
 * view that loads the file. The parser found it on its first run: the config write at line
 * 570 sits in an arrow handed to `addEventListener` INSIDE `bindEvents`, and the walk owed
 * it to `bindEvents`, which is where the registration happens.
 *
 * An anonymous function is executed by whoever received it, so the chain continues through
 * the named function that created it.
 */
function enclosingOf(p) {
    let fn = p.getFunctionParent();
    if (!fn) return { name: null, atTopLevel: true };
    let anonymousHops = 0;
    while (fn) {
        const name = nameOfFunction(fn);
        if (name) return { name, atTopLevel: false, anonymousHops };
        anonymousHops++;
        fn = fn.getFunctionParent();
    }

    return { name: null, atTopLevel: true, anonymousHops };
}

const cache = new Map();

/**
 * One file, parsed: what it declares, what it exports, and every use of a name in it.
 *
 * A USE is a reference to a binding, and its kind says how the name was used: as the
 * callee of a call node, as a member call (`obj.key(...)`), or HANDED OVER — a reference
 * that is not a call at all, which is how a callback reaches `addEventListener`.
 */
function analyse(rel, source) {
    if (cache.has(rel)) return cache.get(rel);
    const src = source !== undefined ? source : fs.readFileSync(path.join(ROOT, rel), 'utf8');
    /**
     * A PARSE THAT ONLY HALF WORKED MUST BE VISIBLE, and this is the condition the option
     * `errorRecovery: true` makes necessary. Babel does not throw for every error with it
     * on: some go into `ast.errors` and a PARTIAL tree comes back. A walk that reads the
     * partial tree and says nothing has quietly dropped part of a file out of its
     * universe — a default by universe, and the fifth of its kind in this mechanism.
     *
     * So both roads are recorded: a thrown error, and a non-empty `ast.errors`. The
     * caller reddens on either, with the file's name.
     */
    let ast;
    const failed = [];
    try {
        // GH-678 — WHY `errorRecovery` STAYS ALTHOUGH `ast.errors` IS CHECKED, and the
        // reason is written here because otherwise the next reader removes one of the two
        // as redundant, and it will be the CHECK that goes.
        //
        // With the check in place the two do the same job: tolerance is cancelled by
        // inspection. What recovery adds is a SPEAKING red — the file's name and the
        // messages, instead of a bare exception from the first error. So the option buys
        // the quality of the failure, not permission to continue past it.
        ast = parser.parse(src, { sourceType: 'script', errorRecovery: true, allowReturnOutsideFunction: true });
        (ast.errors || []).forEach((e) => failed.push('recovered: '
            + String(e.message || e).split('\n')[0]));
    } catch (e) {
        failed.push('threw: ' + e.message.split('\n')[0]);
    }
    const declares = [];
    const exportsOf = [];      // {name, as, objectOf}
    const objectLiterals = {}; // local name -> [{key, value}] for `const X = { k: fn }`
    const uses = [];           // {name, how, object, enclosing, line}
    const unresolvable = [];   // `.call`, `.apply`, `.bind`, obj[computed]()

    if (ast) {
        traverse(ast, {
            Function(p) {
                const name = nameOfFunction(p);
                if (name) declares.push({ name, line: p.node.loc ? p.node.loc.start.line : 0 });
            },
            AssignmentExpression(p) {
                // `global.X = fn`, `window.X = fn`, `exportTarget.X = fn`
                const { left, right } = p.node;
                if (!types.isMemberExpression(left) || !types.isIdentifier(left.property)) return;
                if (types.isIdentifier(right)) exportsOf.push({ name: right.name, as: left.property.name, objectOf: null });
                if (types.isObjectExpression(right)) {
                    right.properties.forEach((prop) => {
                        if (!types.isObjectProperty(prop) && !types.isObjectMethod(prop)) return;
                        const key = prop.key && prop.key.name;
                        if (!key) return;
                        const value = prop.value;
                        if (types.isIdentifier(value)) {
                            exportsOf.push({ name: value.name, as: key, objectOf: left.property.name });
                        } else if (types.isObjectMethod(prop)) {
                            exportsOf.push({ name: key, as: key, objectOf: left.property.name });
                        }
                    });
                }
            },
            VariableDeclarator(p) {
                // `const AmbientDLIEngine = { calculate: calculateAmbientDLI, … }`
                const { id, init } = p.node;
                if (!types.isIdentifier(id) || !types.isObjectExpression(init)) return;
                objectLiterals[id.name] = init.properties
                    .filter((prop) => (types.isObjectProperty(prop) || types.isObjectMethod(prop))
                        && prop.key && prop.key.name)
                    .map((prop) => ({
                        key: prop.key.name,
                        value: types.isObjectProperty(prop) && types.isIdentifier(prop.value)
                            ? prop.value.name : prop.key.name,
                    }));
            },
            ObjectProperty(p) {
                // `{ key: fn }` anywhere — the object it belongs to is resolved by the
                // export above; on its own it is only a hint.
                if (types.isIdentifier(p.node.key) && types.isIdentifier(p.node.value)) {
                    exportsOf.push({ name: p.node.value.name, as: p.node.key.name, objectOf: null });
                }
            },
            MemberExpression(p) {
                const { object, property, computed } = p.node;
                const called = p.parentPath && CALL_NODE_TYPES.includes(p.parentPath.node.type)
                    && p.parentPath.node.callee === p.node;
                if (!called) return;
                const enclosing = enclosingOf(p);
                const where = {
                    enclosing: enclosing.name,
                    atTopLevel: enclosing.atTopLevel,
                    line: p.node.loc ? p.node.loc.start.line : 0,
                };
                if (computed) {
                    unresolvable.push(Object.assign({ why: 'computed member name' }, where));

                    return;
                }
                const key = property.name;
                if (key === 'call' || key === 'apply' || key === 'bind') {
                    unresolvable.push(Object.assign({ why: '`.' + key + '`' }, where));

                    return;
                }
                const objectName = types.isIdentifier(object) ? object.name
                    : (types.isMemberExpression(object) && types.isIdentifier(object.property)
                        ? object.property.name : null);
                uses.push(Object.assign({ name: key, how: 'member call', object: objectName }, where));
            },
            Identifier(p) {
                if (!p.isReferencedIdentifier()) return;
                // A member's property is handled above; skip the property position.
                if (types.isMemberExpression(p.parent) && p.parent.property === p.node && !p.parent.computed) return;
                const parent = p.parentPath.node;
                const isCallee = CALL_NODE_TYPES.includes(parent.type) && parent.callee === p.node;
                /**
                 * HANDED OVER TO BE RUN, OR MERELY NAMED? The difference decides whether a
                 * reference at the file's top level is a PAGE ENTRY POINT.
                 *
                 * `document.addEventListener('x', fn)` hands the function over to be run.
                 * `global.GaipOrchestrator = { populateCanonicalState }` only NAMES it, at
                 * the top level — and counting that as a page entry made every exported
                 * function look as though the page executes it on load, which collapsed
                 * every chain in the walk to `page` and hid the registry roots entirely.
                 * Green, and wrong.
                 */
                const asArgument = CALL_NODE_TYPES.includes(parent.type)
                    && Array.isArray(parent.arguments) && parent.arguments.includes(p.node);
                const enclosing = enclosingOf(p);
                uses.push({
                    name: p.node.name,
                    how: isCallee ? 'call' : (asArgument ? 'handed over to be run' : 'named'),
                    object: null,
                    enclosing: enclosing.name,
                    atTopLevel: enclosing.atTopLevel,
                    line: p.node.loc ? p.node.loc.start.line : 0,
                });
            },
        });
    }

    /**
     * THE THIRD FORM OF AN EXPORT, and it was the last one blind.
     *
     * `global.AmbientDLIEngine = AmbientDLIEngine` exports a NAMED object whose literal is
     * declared elsewhere in the file, so recording the assignment alone captured the object
     * and not its KEYS. `AmbientDLIEngine.calculate(…)` then resolved to nothing, and two
     * nodes came out as executed by nobody — which reads exactly like a finding and is not
     * one. Same class as the bare key and as export-as-execution: the third form of it.
     */
    exportsOf.slice().forEach((e) => {
        if (e.objectOf || !objectLiterals[e.name]) return;
        objectLiterals[e.name].forEach((prop) => {
            exportsOf.push({ name: prop.value, as: prop.key, objectOf: e.as });
        });
    });

    const entry = { rel, declares, exports: exportsOf, uses, unresolvable, failed };
    cache.set(rel, entry);

    return entry;
}

/** Every file of the universe, parsed once. */
function universe() {
    const out = scripts().map((rel) => analyse(rel));
    viewScripts().forEach((v, i) => out.push(analyse(v.view + '#script' + i, v.body)));

    return out;
}

module.exports = {
    CALL_NODE_TYPES,
    callNodeTypesFromTheParser,
    scripts,
    viewScripts,
    analyse,
    universe,
    nameOfFunction,
    ROOT,
};

/** WRITTEN LIST 2's vocabulary: the kinds of unresolvability, closed and printed. */
/**
 * TWO LISTS, NOT ONE, AND THEY DO NOT OVERLAP — the fifth case of two subjects
 * under one name, and she named it as hers from her own 77.17.
 *
 * One list answers WHY AN EDGE WAS NOT RESOLVED; the other answers WHY A FUNCTION IS EMPTY
 * AFTER THE COUNT. There is nothing to compare between them, which is exactly why a summary
 * over the two together could never disagree with itself and why `cycle-without-root` could sit
 * at nothing for a day without anyone noticing.
 *
 * `not confirmed` is NOT a kind in either: it is a STATE OF A NODE — no roots, and unresolved
 * edges present. And `member-ambiguous` may legitimately stand at zero with a live producer,
 * because resolving on the VIEW leaves ambiguity only where two declarations sit in inline
 * scripts of one view with no load order between them.
 *
 * A THIRD SUBJECT IS MINE AND IT IS IN NEITHER OF HER TWO: a view's inline script that cannot be
 * parsed is not an edge and not a function — it is a piece of the universe that was not read.
 * Kept apart rather than folded into one of hers.
 */
const EDGE_UNRESOLVED = ['computed-member', 'call-apply-bind', 'member-unresolved', 'member-ambiguous'];
const FUNCTION_EMPTY = ['no-caller', 'cycle-without-root', 'not-loaded'];
const UNREAD_UNIVERSE = ['unparsed-view'];
const UNRESOLVED_KINDS = [...EDGE_UNRESOLVED, ...FUNCTION_EMPTY, ...UNREAD_UNIVERSE];

/**
 * THE RESOLVER RULE'S OWN VERSION — a fingerprint of the tokens of the function that
 * resolves a member call across files.
 *
 * The ratchet list below is measured UNDER a rule. Repair the rule and the list moves;
 * without a version, growth caused by a better resolver would read as growth caused by the
 * code, which is the mistake `gh669` made with its sign. A change of rule is an announced
 * event: the fingerprint changes, and the test says the list must be re-measured.
 */
function resolutionPerimeter() {
    /**
     * THE PERIMETER IS EVERYTHING THE LIST PRODUCER CAN REACH, and it starts AT THE PRODUCER
     * (reviewer's correction) rather than at the resolver. The fingerprint serves the ratchet: it
     * declares under what rule the lists were measured, so it must cover everything CAPABLE OF
     * MOVING THEM. After the two walks became one, the lists are produced by `currentUnresolved`,
     * and starting there brings the fixpoint inside by derivation instead of by a decision.
     *
     * TWO NARROWER FORMS WERE TRIED AND BOTH FAILED IN OPPOSITE DIRECTIONS. `resolveMember` alone
     * left out the collection of exports, and the lists moved 198 -> 207 while the version stood
     * still. The WHOLE FILE caught everything -- including a comma in a comment -- so its red
     * never named a subject, which the reviewer measured: `r1qjvms9` -> `rbyfr3q` from an edit in
     * a loop, with nothing to point at.
     *
     * So the fingerprint is PER FUNCTION, and the red names the function whose tokens moved.
     */
    const file = fs.readFileSync(path.join(__dirname, 'gh678-caller-walk.js'), 'utf8');
    const forms = /(?:^|\n)(?:async )?function ([A-Za-z_$][\w$]*)\s*\(/g;
    const bodies = new Map();
    let m;
    const starts = [];
    while ((m = forms.exec(file)) !== null) starts.push({ name: m[1], at: m.index });
    starts.forEach((f, i) => {
        const to = i + 1 < starts.length ? starts[i + 1].at : file.length;
        bodies.set(f.name, file.slice(f.at, to));
    });

    // Reachable from the producer, by name, inside this file.
    const reached = new Set();
    const queue = ['currentUnresolved'];
    while (queue.length) {
        const name = queue.shift();
        if (reached.has(name) || !bodies.has(name)) continue;
        reached.add(name);
        bodies.forEach((_, other) => {
            if (other === name || reached.has(other)) return;
            if (new RegExp('(?<![\\w.])' + other + '\\s*\\(').test(bodies.get(name))) queue.push(other);
        });
    }

    const hash = (src) => {
        const text = src.replace(/\/\*[\s\S]*?\*\//g, '').replace(/\/\/.*$/gm, '').replace(/\s+/g, ' ');
        let h = 0;
        for (let i = 0; i < text.length; i++) h = ((h << 5) - h + text.charCodeAt(i)) | 0;

        return 'f' + (h >>> 0).toString(36);
    };
    const out = {};
    [...reached].sort().forEach((name) => { out[name] = hash(bodies.get(name)); });

    return out;
}

/** One line for the whole perimeter, for a reader; the per-function map is what is compared. */
function resolverRuleVersion() {
    const per = resolutionPerimeter();
    const text = Object.entries(per).map(([k, v]) => k + '=' + v).join(';');
    let h = 0;
    for (let i = 0; i < text.length; i++) h = ((h << 5) - h + text.charCodeAt(i)) | 0;

    return 'p' + (h >>> 0).toString(36);
}


/**
 * `obj.key(...)` across files: this is a function when some file exports `obj` with `key`
 * bound to a function it declares. Nothing else is resolved — a guess here would be the
 * fifth default in a mechanism from which four have been removed.
 */
const GLOBAL_NAMES = ['global', 'window', 'self', 'globalThis', 'exportTarget'];

let resolutionsAttempted = 0;

function resolveMember(object, key, files, fromFile) {
    if (!object) return null;
    resolutionsAttempted++;
    /**
     * RESOLVED ON THE VIEW, NOT OVER THE CATALOGUE. `GilbaScenarioUI` is declared
     * by two files; over the whole of `assets` a call would tie to both and both would look
     * alive, while one of them is loaded by no view at all. The candidates are the files that
     * can be on a page together with the caller.
     */
    const scope = fromFile ? filesLoadedWith(fromFile) : null;
    const candidates = scope ? files.filter((f) => scope.has(f.rel)) : files;
    if (candidates.length) files = candidates;
    /**
     * THE OBJECT IS PART OF THE QUESTION, AND THE FIRST FORM OF THIS FUNCTION DROPPED IT.
     *
     * It matched a bare KEY against every export, so `hub.orchestrator.computeSelective(…)`
     * in `climate-engine-v2.js` resolved to the `computeSelective` of `hub-orchestrator.js`
     * — a DIFFERENT function with a different body; `gilba-hub-v2.js` declares its own
     * `async computeSelective(e)` as a method of that object. The walk then reported a live
     * caller for a branch that has none, which made a dead path look alive. The analyst
     * found it by opening the address; the rule was mine and the hole was the same "bare
     * key" it exists to prevent.
     *
     * TWO SHAPES RESOLVE AND NOTHING ELSE DOES:
     *   `global.NAME = fn`     reached as `global.NAME(…)`  — the object is a global name;
     *   `global.OBJ = {k: fn}` reached as `OBJ.k(…)`        — the object IS `OBJ`.
     * A property of a property (`hub.orchestrator.k`) is neither, and goes to the ratchet
     * as `member-unresolved` rather than to a guess. Resolving it needs the run's own
     * stack, which is a separate item.
     */
    /**
     * AMBIGUITY IS NOT RESOLVED BY FILE ORDER — it is declared. The first form of this
     * returned the FIRST matching file, and the order-invariance case caught it at once:
     * with the universe listed in reverse, `global.gaip_pgr_module` resolved to
     * `gssh-pgr-module-v3.js` instead of `gilba-pgr-module-v3.js` — the gilba/gssh twins
     * export the same name. Two candidates and a coin toss dressed as an answer; 32 member
     * signatures have more than one candidate.
     *
     * So more than one candidate returns `{ ambiguous: [...] }`, which the caller treats as
     * UNRESOLVED. That is the safe direction and it is order-independent by construction.
     */
    const found = [];
    for (const f of files) {
        const viaObject = f.exports.find((e) => e.as === key && e.objectOf === object);
        if (viaObject && f.declares.some((d) => d.name === viaObject.name)) {
            found.push({ name: viaObject.name, file: f.rel });
            continue;
        }
        if (GLOBAL_NAMES.includes(object)) {
            const direct = f.exports.find((e) => e.as === key && !e.objectOf);
            if (direct && f.declares.some((d) => d.name === direct.name)) {
                found.push({ name: direct.name, file: f.rel });
            }
        }
    }
    const distinct = [...new Set(found.map((x) => x.file + ':' + x.name))].sort();
    if (!distinct.length) return null;
    if (distinct.length > 1) return { ambiguous: distinct };

    return found.find((x) => x.file + ':' + x.name === distinct[0]);
}

const indexCache = new WeakMap();

/** One pass over the universe, so a walk of thirty handles does not make thirty passes. */
function indexOf(files) {
    if (indexCache.has(files)) return indexCache.get(files);
    const byName = new Map();
    const add = (name, rec) => {
        if (!byName.has(name)) byName.set(name, []);
        byName.get(name).push(rec);
    };
    files.forEach((f) => {
        f.uses.forEach((u) => {
            if (u.how === 'call' || u.how === 'handed over to be run') {
                add(u.name, Object.assign({ file: f.rel }, u));
            } else if (u.how === 'member call') {
                const r = resolveMember(u.object, u.name, files, f.rel);
                /**
                 * KEYED BY THE RESOLVED TARGET, NOT BY THE NAME — and keying by the name made the
                 * twins share their callers. `showWhatIfPanel` is declared in `gaip-whatif-ui.js`
                 * and in `gssh-whatif-ui.js`; the attribute's call resolves, on the view, to the
                 * first one only, and yet both keys picked the caller up and BOTH came out alive.
                 * The one no view loads is dead, and a shared caller list hid exactly that.
                 */
                if (r && !r.ambiguous) add(r.file + ':' + r.name, Object.assign({ file: f.rel }, u));
            }
        });
    });
    indexCache.set(files, byName);

    return byName;
}

/** Everything a name is reached by, across the universe. */
function callersOf(name, files) {
    return indexOf(files).get(name) || [];
}

/**
 * The callers of one FUNCTION, not of one name: those whose member call resolved to this exact
 * `file:name`, plus direct calls of the bare name that could be on a page with it.
 */
function callersForKey(key, files) {
    const idx = indexOf(files);
    const name = key.slice(key.lastIndexOf(':') + 1);
    const file = key.slice(0, key.lastIndexOf(':'));
    const byTarget = idx.get(key) || [];
    const scope = filesLoadedWith(file);
    const byName = (idx.get(name) || []).filter((c) => !c.file.startsWith('assets/')
        || scope.has(c.file));

    return byTarget.concat(byName);
}

/**
 * UP TO THE ROOTS. Three outcomes and three words, never interchangeable: a root (green),
 * `cycle without root` (red, prints the cycle), `unresolved executor` (red, prints the
 * chain as far as it got). No depth limit — a long branch that resolves stays green.
 */
/**
 * `walkToRoots` AND `currentUnresolved` USED TO LIVE HERE, AND THEY ARE GONE.
 *
 * TWO INDEPENDENT WALKS ANSWERED ONE QUESTION FOR DIFFERENT READERS: the closure fed the
 * ratchet and the dead list, the fixpoint fed the invariant and the three words. Breaking the
 * FIXPOINT'S body therefore moved the verdicts of three modules while the ratchet did not
 * stir — 196 against 196, 37 dead against 37 — because the ratchet could not see that walk BY
 * CONSTRUCTION. The measurement is the reviewer's, under his own mutation.
 *
 * That is the fault this repository has spent two days removing, in my own tool: two surfaces
 * answering one question, one of them watched. It happened because I built the fixpoint BESIDE
 * its predecessor instead of replacing it.
 *
 * KEEPING THE OLD WALK AS A CROSS-CHECK WAS REFUSED, and the reason is not thrift: it depends
 * on the order of traversal, so its disagreements with the fixpoint would be ITS OWN errors —
 * two of our own surfaces compared with each other, which is the class that cost us GH-409.
 * The checks of the right kind already exist and they check ONE result: order-invariance, and
 * the closure's convergence against a limit computed beforehand.
 */

/** A ratchet key: file, enclosing function, callee text, and the ordinal among equals. */
function ratchetKey(entry, seenSoFar) {
    const base = [entry.file || '?', entry.enclosing || '<top level>', entry.callee || entry.name || '?'].join(' : ');
    const n = (seenSoFar[base] = (seenSoFar[base] || 0) + 1);

    return base + ' #' + n;
}

module.exports.UNRESOLVED_KINDS = UNRESOLVED_KINDS;
module.exports.EDGE_UNRESOLVED = EDGE_UNRESOLVED;
module.exports.FUNCTION_EMPTY = FUNCTION_EMPTY;
module.exports.UNREAD_UNIVERSE = UNREAD_UNIVERSE;
module.exports.resolveMember = resolveMember;
module.exports.resolutionsAttempted = () => resolutionsAttempted;
module.exports.resolverRuleVersion = resolverRuleVersion;
module.exports.resolutionPerimeter = resolutionPerimeter;
module.exports.callersOf = callersOf;
module.exports.callersForKey = callersForKey;
module.exports.ratchetKey = ratchetKey;

/**
 * EVERY PLACE THE WALK CANNOT RESOLVE, as a map of keys to kinds — one code path, used
 * both to write the ratchet list and to check it.
 *
 * THE KEY HAS NO LINE NUMBER IN IT, and that is deliberate: a line number lives until the
 * next edit of the file, and a ratchet keyed on one would go red on every reformat. The
 * line is carried BESIDE the key, printed and never compared.
 */
/**
 * THE ONE LIST, PRODUCED FROM THE ONE COUNT.
 *
 * Everything the walk cannot resolve, as a map of keys to kinds — and it is produced from the
 * FIXPOINT, the same count the invariant reads. Two producers reading two walks is what let a
 * broken fixpoint move three verdicts while the ratchet stood still.
 *
 * WHY A FUNCTION IS EMPTY IS DECIDED AFTER THE COUNT, not during it. Only functions whose value
 * is empty on BOTH sides — no roots and no unresolved edges — are classified at all. The call
 * graph among them is compressed by STRONGLY CONNECTED COMPONENTS: a component with no incoming
 * edge is a SOURCE, and a source that is one function without a self-loop gives `no-caller`
 * while a source that is a cycle gives `cycle-without-root`. Each empty function then takes its
 * cause from the sources it is reachable from, so a function called only by a dead cycle is
 * `cycle-without-root` and not `no-caller` — the two send a reader to look for different things.
 *
 * THE KEY CARRIES NO LINE NUMBER: a line lives until the next edit of the file, and a ratchet
 * keyed on one would redden on a reformat. The line is carried beside it, printed, never compared.
 */
function currentUnresolved(opts) {
    const files = opts.files || universe();
    const graph = opts.graph;
    const handles = {};
    Object.entries(graph.nodes).forEach(([id, n]) => {
        (Array.isArray(n.handle) ? n.handle : (n.handle ? [n.handle] : [])).forEach((h) => {
            handles[h.indexOf(':') !== -1 ? h.slice(h.indexOf(':') + 1) : h] = id;
        });
    });
    const fp = opts.fixpoint || rootsByFixpoint({ files, registries: opts.registries, handles });
    const seen = {};
    const out = {};
    const put = (e) => {
        const key = ratchetKey(e, seen);
        out[key] = { kind: e.kind, line: e.line || null };
    };

    // ---- the empty functions, and why each one is empty.
    const empty = [...fp.value.entries()]
        .filter(([, v]) => !v.roots.size && !v.unresolved.size)
        .map(([key]) => key);
    const emptySet = new Set(empty);
    const callersWithin = new Map();
    empty.forEach((key) => {
        const list = (fp.callersByKey.get(key) || [])
            .filter((c) => c.key && emptySet.has(c.key))
            .map((c) => c.key);
        callersWithin.set(key, list);
    });
    const { componentOf, components } = stronglyConnected(empty, callersWithin);
    const sourceKind = new Map();
    components.forEach((members, id) => {
        const incoming = members.some((m) => (callersWithin.get(m) || [])
            .some((c) => componentOf.get(c) !== id));
        if (incoming) return;                       // not a source
        const selfLoop = members.length > 1
            || (callersWithin.get(members[0]) || []).includes(members[0]);
        sourceKind.set(id, selfLoop ? 'cycle-without-root' : 'no-caller');
    });
    /**
     * THE ORDER OF CAUSES IS FIXED: `not-loaded` first, then
     * `cycle-without-root`, then `no-caller`. They are not alternatives of equal standing --
     * `not-loaded` says the code runs NOWHERE, and a reader told `no-caller` about a function in
     * a file no view loads goes looking for a missing call site that was never meant to exist.
     *
     * `not-loaded` holds when EITHER (a) the function's own file is loaded by no view, OR (b)
     * everything reached by rising through its callers is the top level of files no view loads.
     * (b) is the case the deleted branch was about: a function called from such a top level, in a
     * file that IS loaded.
     *
     * The page terminals reached are collected rather than assumed, and they are all non-loaded by
     * derivation: a terminal in a view that DOES load would have put a root into this function's
     * value, and a function with a root is not in this set at all.
     */
    const noView = new Set(loadedByNoView());
    empty.forEach((key) => {
        // The cause comes from the SOURCES this function is reachable from, walking up the
        // callers inside the empty set; its own component counts when it is a source itself.
        const reached = new Set();
        const pageTerminals = [];
        const stack = [key];
        const been = new Set();
        while (stack.length) {
            const at = stack.pop();
            if (been.has(at)) continue;
            been.add(at);
            const comp = componentOf.get(at);
            if (sourceKind.has(comp)) reached.add(sourceKind.get(comp));
            (fp.callersByKey.get(at) || []).forEach((c) => {
                if (c.terminal === 'page') pageTerminals.push(c.view);
                else if (c.key) stack.push(c.key);
            });
        }
        const [file, name] = [key.slice(0, key.lastIndexOf(':')), key.slice(key.lastIndexOf(':') + 1)];
        const runsNowhere = noView.has(file)
            || (pageTerminals.length && pageTerminals.every((v) => v.startsWith('assets/')
                && !viewsLoading(v).length));
        const kind = runsNowhere ? 'not-loaded'
            : (reached.has('cycle-without-root') ? 'cycle-without-root' : 'no-caller');
        put({ file, enclosing: null, callee: name, kind });
    });

    /**
     * THE EDGES THAT REACHED A VERDICT — the unresolved this list is about.
     *
     * Three wider readings were tried and each was wider than the subject. From the fixpoint's
     * VALUES: an unresolved edge rises, so it was counted once per ancestor — a million. From
     * the caller graph: once per function whose NAME matches — fifty-seven thousand. From every
     * member call in the tree, then from every one whose key is a name we declare: twenty-five
     * thousand, then nine — the DOM and the standard library, because our own names are `init`,
     * `render`, `get`.
     *
     * The subject is narrower and it is the one the ratchet exists for: an edge that could not
     * be followed AND that a node's verdict depends on. Those are exactly the ones the count
     * carried up into a HANDLE's value. Deduped by the edge itself, so an edge under two nodes
     * is one place.
     */
    const reachedAVerdict = new Set();
    Object.values(graph.nodes).forEach((n) => {
        (Array.isArray(n.handle) ? n.handle : (n.handle ? [n.handle] : [])).forEach((h) => {
            const bare = h.indexOf(':') !== -1 ? h.slice(h.indexOf(':') + 1) : h;
            const pref = h.indexOf(':') !== -1 ? h.slice(0, h.indexOf(':')) : null;
            const key = [...fp.value.keys()].find((k) => k.endsWith(':' + bare)
                && (!pref || k.startsWith(pref)));
            if (!key) return;
            (fp.value.get(key).unresolved || new Set()).forEach((u) => reachedAVerdict.add(u));
            // The handle's own callers carry edges that never rise into its value.
            (fp.callersByKey.get(key) || []).forEach((c) => {
                if (c.terminal === 'unresolved') reachedAVerdict.add(c.kind + '@' + c.at);
            });
        });
    });
    [...reachedAVerdict].sort().forEach((u) => {
        const kind = String(u).split('@')[0];
        const at = String(u).slice(kind.length + 1);
        if (kind === 'no-caller') return;               // classified by component above
        put({
            file: at.slice(0, at.lastIndexOf(':')) || at,
            enclosing: null,
            callee: at,
            kind: UNRESOLVED_KINDS.includes(kind) ? kind : 'member-unresolved',
        });
    });

    // ---- what the parse itself could not follow, which no walk decides.
    files.forEach((f) => f.unresolvable.forEach((u) => put({
        file: f.rel, enclosing: u.enclosing, callee: u.why, line: u.line,
        kind: /computed/.test(u.why) ? 'computed-member' : 'call-apply-bind',
    })));
    files.filter((f) => f.failed.length && !f.rel.startsWith('assets/')).forEach((f) => put({
        file: f.rel, enclosing: '<inline script>', callee: f.failed[0].slice(0, 60), kind: 'unparsed-view',
    }));

    return out;
}

/**
 * TARJAN, plainly: the strongly connected components of the call graph among a given set of
 * functions. A cycle and a lone function are different causes of emptiness, and nothing else in
 * this file can tell them apart.
 */
function stronglyConnected(nodes, edgesUp) {
    const index = new Map();
    const low = new Map();
    const onStack = new Set();
    const stack = [];
    const componentOf = new Map();
    const components = new Map();
    let counter = 0;
    let componentId = 0;

    const strongConnect = (v) => {
        index.set(v, counter);
        low.set(v, counter);
        counter++;
        stack.push(v);
        onStack.add(v);
        (edgesUp.get(v) || []).forEach((w) => {
            if (!index.has(w)) {
                strongConnect(w);
                low.set(v, Math.min(low.get(v), low.get(w)));
            } else if (onStack.has(w)) {
                low.set(v, Math.min(low.get(v), index.get(w)));
            }
        });
        if (low.get(v) === index.get(v)) {
            const members = [];
            let w;
            do {
                w = stack.pop();
                onStack.delete(w);
                componentOf.set(w, componentId);
                members.push(w);
            } while (w !== v);
            components.set(componentId, members);
            componentId++;
        }
    };
    nodes.forEach((n) => { if (!index.has(n)) strongConnect(n); });

    return { componentOf, components };
}

/**
 * THE TWO LISTS, TOLD APART — and the split is about which mistake is REVERSIBLE.
 *
 * `no-caller` means the count found nothing reaching a function. That is a FACT only when every
 * road can be seen, and one cannot: a call on a PROPERTY of a property is not resolved at all,
 * so a function reached only that way would arrive here wrongly.
 *
 * In the ratchet, blindness costs a spare entry — reversible. Here it would cost an INVITATION
 * TO DELETE LIVE CODE, the only irreversible act in the mechanism. So every entry says HOW the
 * absence was established, and none may claim confirmation while the property form is
 * unresolved: nothing is deleted on the strength of this list.
 */
function splitDeadFromUnresolved(all) {
    /**
     * THE THREE LISTS, BY THEIR DECLARED UNIVERSES — and the dead list is separate because the
     * two mistakes are not equally reversible. In the edge list, blindness costs a spare entry.
     * In the empty list it would cost an INVITATION TO DELETE LIVE CODE, the one irreversible
     * act here, so every entry says HOW the absence was established and none claims confirmation
     * while a call on a property of a property goes unresolved.
     */
    const edges = {};
    const empty = {};
    const unread = {};
    Object.entries(all).forEach(([key, e]) => {
        if (FUNCTION_EMPTY.includes(e.kind)) {
            empty[key] = {
                line: e.line,
                why: e.kind,
                establishedBy: 'bindings-parse over the fixpoint',
                coversAlias: true,
                coversMemberOnAProperty: false,
                confirmed: false,
                whyNotConfirmed: 'a call on a property of a property is not resolved at all, so a'
                    + ' function reached only that way would appear here wrongly. Nothing is'
                    + ' deleted on the strength of this list until that is closed.',
            };

            return;
        }
        if (UNREAD_UNIVERSE.includes(e.kind)) { unread[key] = e; return; }
        edges[key] = e;
    });

    // The names the old shape used, kept so one change does not become two.
    return { edges, empty, unread, unresolved: edges, dead: empty };
}

module.exports.currentUnresolved = currentUnresolved;
module.exports.stronglyConnected = stronglyConnected;
module.exports.splitDeadFromUnresolved = splitDeadFromUnresolved;

/**
 * GH-678 — ROOTS BY A FIXPOINT, WITH THE UNRESOLVED CARRIED AS A VALUE.
 *
 * A function's value is the UNION of its callers' values, computed with a worklist until
 * nothing changes. The set of possible values is finite — kinds, and kinds paired with a
 * view — so the count converges and does not depend on the order of traversal.
 *
 * FOUR COSTS, and the first is the one that makes it honest:
 *
 *  1. THE UNRESOLVED IS A VALUE, NOT AN ABSENCE. A function with one `page` caller and one
 *     reached through a computed name would otherwise answer `{page}` and pass it off as a
 *     complete answer. So the value is a PAIR — roots and unresolved edges — and both rise.
 *     A node with anything unresolved reddens even when it has roots.
 *  2. A PAGE ROOT CARRIES ITS VIEW: `page|<view>`. Without the address the equality of 77.5
 *     has nothing to compare.
 *  3. WHY A VALUE IS EMPTY is decided AFTER the count, from the graph: no caller at all, a
 *     component with no way out, or an unresolved edge. THE NUMBER OF CYCLES CHANGES WITH
 *     THIS RULE — false cycles inside rooted branches now get roots of their own — and that
 *     is a CHANGE OF RULE, announced, with its growth printed apart from growth by code.
 *  4. THE PRINTED CHAIN IS ONE WITNESS, NOT THE ANSWER. The SET of roots is
 *     order-independent; a chain is not. Said in the output, so two runs showing different
 *     chains are not read as an unstable guard.
 *
 * CONVERGENCE IS DECLARED AND PRINTED: at most `maxIterations` passes of the worklist, and
 * a run that has not settled FAILS with its own word and the number of iterations rather
 * than hanging until a timeout — a red with no subject is the worst outcome there is.
 */
function rootsByFixpoint(opts) {
    const files = opts.files || universe();
    const registries = opts.registries || {};
    const handles = opts.handles || {};
    const maxIterations = opts.maxIterations || 200;

    // 1. The caller graph, and the two kinds of terminal a caller can be.
    const callersByKey = new Map();
    const keyOf = (file, name) => (file || '?') + ':' + name;
    const functions = new Set();
    files.forEach((f) => f.declares.forEach((d) => functions.add(keyOf(f.rel, d.name))));

    functions.forEach((key) => {
        const name = key.slice(key.indexOf(':') + 1);
        const list = callersForKey(key, files).map((c) => {
            if (c.atTopLevel) return { terminal: 'page', view: c.file };
            if (!c.enclosing) return { terminal: 'unresolved', kind: 'member-unresolved', at: c.file + ':' + c.line };

            return { key: keyOf(c.file, c.enclosing), at: c.file + ':' + c.line };
        });
        /**
         * A MEMBER CALL THAT DID NOT RESOLVE IS STILL A CALLER — one this device cannot
         * follow. Leaving it out made "no caller at all" and "callers, none of them resolved"
         * the same output, and the two say different things: the first invites deleting the
         * function, the second says the walk is blind. `GAIP_ScenarioEngine.compareScenarios`
         * is called through a LOCAL ALIAS of the exported object (`const scenarioEngine =
         * global.GAIP_ScenarioEngine || …`), so the object is resolved by a name that is the
         * alias — the residual risk of the resolution rule, arriving here as a missing caller.
         */
        files.forEach((f) => f.uses.forEach((u) => {
            if (u.how !== 'member call' || u.name !== name) return;
            const r = resolveMember(u.object, u.name, files, f.rel);
            if (r && !r.ambiguous) return;
            list.push({
                terminal: 'unresolved',
                kind: r && r.ambiguous ? 'member-ambiguous' : 'member-unresolved',
                at: f.rel + ':' + u.line,
            });
        }));
        callersByKey.set(key, list);
    });

    // 2. The values, and the base cases that do not inherit.
    const value = new Map();
    const witness = new Map();
    functions.forEach((key) => value.set(key, { roots: new Set(), unresolved: new Set() }));
    const isBase = (key) => {
        const name = key.slice(key.indexOf(':') + 1);
        if (registries[key]) return { roots: new Set([registries[key]]), unresolved: new Set() };
        if (handles[name]) return { roots: new Set(['handle:' + handles[name]]), unresolved: new Set() };

        return null;
    };
    functions.forEach((key) => {
        const base = isBase(key);
        if (base) value.set(key, base);
    });

    /**
     * THE LIMIT IS COMPUTED BEFORE THE COUNT, from the shape of the problem rather than
     * from a number somebody liked: a value only GROWS, so the total number of element
     * additions cannot exceed the number of functions times the height of one lattice —
     * every root value that can exist, plus every unresolved value that can exist.
     *
     * TWO REDS, EACH WITH ITS OWN WORD, and the second is the only reason the count could
     * fail to settle at all:
     *   - `did not settle`: n updates against the limit N;
     *   - `non-monotone update`: a function LOST an element, caught at the moment it
     *     happens rather than by a timeout.
     * The number of iterations is printed on every run, green included.
     */
    const rootUniverse = new Set(Object.values(registries));
    files.forEach((f) => rootUniverse.add('page|' + f.rel));
    Object.values(handles).forEach((id) => rootUniverse.add('handle:' + id));
    const unresolvedUniverse = functions.size * 2 + files.length;   // one per function, per edge kind
    const latticeHeight = rootUniverse.size + unresolvedUniverse;
    const updateLimit = functions.size * latticeHeight;
    let additions = 0;

    // 3. The worklist, to convergence.
    /**
     * THE WITNESS IS CHOSEN DETERMINISTICALLY — the predecessor with the SMALLEST key. The
     * set of roots does not depend on the order of traversal; a chain does, and the analyst
     * caught the collision with her own condition: a witness taken "first seen" would make
     * the order-invariance case red through no fault of the code. The printed chain is ONE
     * witness, not the answer, and the smallest key makes it the same witness every run.
     */
    const rememberWitness = (key, candidate) => {
        const have = witness.get(key);
        if (have === undefined || String(candidate) < String(have)) witness.set(key, candidate);
    };

    let iterations = 0;
    let changed = true;
    while (changed) {
        changed = false;
        iterations++;
        if (iterations > maxIterations) {
            throw new Error('the caller fixpoint DID NOT SETTLE: ' + additions
                + ' element additions in ' + (iterations - 1) + ' passes, against a limit of '
                + updateLimit + ' additions (' + functions.size + ' functions x lattice height '
                + latticeHeight + '). It fails with its own word and its own numbers rather'
                + ' than hanging: a red with no subject is the worst outcome there is.');
        }
        functions.forEach((key) => {
            if (isBase(key)) return;
            const before = value.get(key);
            const roots = new Set(before.roots);
            const unresolved = new Set(before.unresolved);
            const callers = callersByKey.get(key) || [];
            /**
             * A FUNCTION WITH NO CALLERS IS LEFT EMPTY ON BOTH SIDES, not marked. Marking it made
             * it non-empty, and the classifier only looks at functions that are empty on both
             * sides -- so `gssh-whatif-ui.js:showWhatIfPanel`, which nothing reaches, never
             * reached the list that exists to name it. The CAUSE is the classifier's answer
             *, not a marker I write while counting.
             */
            if (!callers.length) return;
            callers.forEach((c) => {
                if (c.terminal === 'page') {
                    /**
                     * A TOP LEVEL NO VIEW LOADS IS NOT AN ENTRY POINT. Twelve
                     * files in `assets` are loaded by no view; their top-level code LOOKS like a
                     * page entry and runs nowhere, and counting it as a root would make
                     * everything reachable from those twelve come out alive.
                     */
                    if (c.view.startsWith('assets/') && !viewsLoading(c.view).length) {
                        /**
                         * IT CONTRIBUTES NOTHING, AND IT WRITES NOTHING. It used
                         * to add a `not-loaded@` marker here, while counting -- and the marker
                         * made the function NON-EMPTY, so the classifier, which looks only at
                         * functions empty on both sides, never saw it. `not-loaded` stood at 0
                         * for as long as the branch existed: the kind was emitted in a place
                         * where it could not reach the list that exists to name it.
                         *
                         * Same shape as `if (!callers.length) return` above: the count says
                         * nothing rose, and WHY nothing rose is the classifier's answer.
                         */
                        return;
                    }
                    roots.add('page|' + c.view);
                    rememberWitness(key, c.view + ':<load>');

                    return;
                }
                if (c.terminal === 'unresolved') {
                    unresolved.add(c.kind + '@' + c.at);

                    return;
                }
                const up = value.get(c.key);
                if (!up) return;
                up.roots.forEach((r) => roots.add(r));
                up.unresolved.forEach((u) => unresolved.add(u));
                rememberWitness(key, c.key);
            });
            // NON-MONOTONE IS CAUGHT WHERE IT HAPPENS. A value may only grow; if an
            // element is gone, the count would never settle and a timeout would be the only
            // sign — a red with no subject.
            const lost = [...before.roots].filter((r) => !roots.has(r))
                .concat([...before.unresolved].filter((u) => !unresolved.has(u)));
            if (lost.length) {
                throw new Error('NON-MONOTONE UPDATE at ' + key + ': the value lost '
                    + JSON.stringify(lost.sort()) + '. A value may only grow; losing an element'
                    + ' is the one way this count could fail to settle.');
            }
            if (roots.size !== before.roots.size || unresolved.size !== before.unresolved.size) {
                additions += (roots.size - before.roots.size) + (unresolved.size - before.unresolved.size);
                value.set(key, { roots, unresolved });
                changed = true;
            }
        });
    }

    return {
        value, iterations, maxIterations, callersByKey, witness, keyOf,
        additions, updateLimit, latticeHeight, functions: functions.size,
    };
}

module.exports.rootsByFixpoint = rootsByFixpoint;

/**
 * WHAT EXECUTES A HANDLE — read off the fixpoint, from the handle's CALLERS rather than
 * from the handle itself, because a node's own handle is a base case whose value is itself.
 *
 * Returns the pair: kinds (a page kind carries its view) and unresolved edges. Both are
 * sets, so the answer does not depend on the order in which anything was visited; the
 * witness chain is one example and is labelled as such.
 */
function executorsOfHandle(fp, handleKey, opts) {
    const roots = new Set();
    const unresolved = new Set();
    const callers = fp.callersByKey.get(handleKey) || [];
    if (!callers.length) unresolved.add('no-caller@' + handleKey);
    callers.forEach((c) => {
        if (c.terminal === 'page') { roots.add('page|' + c.view); return; }
        if (c.terminal === 'unresolved') { unresolved.add(c.kind + '@' + c.at); return; }
        const up = fp.value.get(c.key);
        if (!up) { unresolved.add('caller-not-in-the-universe@' + c.key); return; }
        up.roots.forEach((r) => roots.add(r));
        up.unresolved.forEach((u) => unresolved.add(u));
    });

    // A `handle:` root means "whatever executes THAT node executes this one", so it is
    // resolved into that node's declared runners rather than dropped — dropping it was a
    // fault of the earlier form and it lost a whole kind.
    const graph = opts && opts.graph;
    const out = new Set();
    const seenNodes = new Set();
    const expand = (kind) => {
        if (!String(kind).startsWith('handle:')) { out.add(kind); return; }
        const id = String(kind).slice('handle:'.length);
        if (seenNodes.has(id) || !graph || !graph.nodes[id]) return;
        seenNodes.add(id);
        const n = graph.nodes[id];
        (Array.isArray(n.runner) ? n.runner : (n.runner ? [n.runner] : [])).forEach((k) => out.add(k));
    };
    roots.forEach(expand);

    return { kinds: out, pages: [...roots].filter((r) => String(r).startsWith('page|')), unresolved };
}

module.exports.executorsOfHandle = executorsOfHandle;

/**
 * WHICH VIEWS LOAD AN ASSET FILE — the address of a `page` root.
 *
 * the address is the VIEW, the name of the template the server
 * renders (`plan`, `hub`, `reports/export`), not a route and not a partial. A partial's or
 * a layout's scripts belong to EVERY view that includes it, so the includes are followed.
 *
 * A file's top level runs only because some view loads that file; treating
 * `assets/<file>` itself as the address gave eighty-five "addresses" for one node, which is
 * noise rather than an address.
 */
const viewCache = { views: null, src: {}, includes: {} };

function bladeViews() {
    if (viewCache.views) return viewCache.views;
    const base = path.join(ROOT, 'app', 'resources', 'views');
    const out = [];
    const walkDir = (dir) => {
        fs.readdirSync(dir, { withFileTypes: true }).forEach((e) => {
            const full = path.join(dir, e.name);
            if (e.isDirectory()) return walkDir(full);
            if (!e.name.endsWith('.blade.php')) return;
            const rel = path.relative(ROOT, full);
            out.push(rel);
            viewCache.src[rel] = fs.readFileSync(full, 'utf8');
        });
    };
    walkDir(base);
    const asPath = (dotted) => 'app/resources/views/' + dotted.split('.').join('/') + '.blade.php';
    out.forEach((rel) => {
        const found = [];
        let m;
        const inc = /@include\(\s*'([^']+)'/g;
        while ((m = inc.exec(viewCache.src[rel])) !== null) found.push(asPath(m[1]));
        // A LAYOUT IS NOT AN ADDRESS EITHER, and following `@include` alone left
        // `layouts/db-shell` standing among the addresses. The analyst's rule is that a
        // partial's AND a layout's scripts belong to every view that uses them, so the
        // `@extends` chain is followed exactly like an include.
        const ext = /@extends\(\s*'([^']+)'/g;
        while ((m = ext.exec(viewCache.src[rel])) !== null) found.push(asPath(m[1]));
        viewCache.includes[rel] = found;
    });
    viewCache.views = out;

    return out;
}

/** The template name a view is known by: `reports/export`, `plan`, `layouts/app`. */
function viewName(rel) {
    return rel.replace('app/resources/views/', '').replace('.blade.php', '');
}

/** A layout or a partial is not an address; the views that use it are. */
function isAnAddress(rel) {
    const name = viewName(rel);

    return !name.startsWith('layouts/') && !name.startsWith('partials/');
}

function viewsLoading(assetRel) {
    const base = assetRel.replace(/^assets\//, '');
    const mentions = (src) => src && src.indexOf("'" + base + "'") !== -1;
    const views = bladeViews();
    const out = [];
    views.filter(isAnAddress).forEach((rel) => {
        // The view's own scripts, plus everything its partials and its layout chain load,
        // followed to the end so a layout inside a layout is not missed.
        const chain = new Set([rel]);
        const queue = [rel];
        while (queue.length) {
            const at = queue.shift();
            (viewCache.includes[at] || []).forEach((next) => {
                if (chain.has(next) || !viewCache.src[next]) return;
                chain.add(next);
                queue.push(next);
            });
        }
        if ([...chain].some((r) => mentions(viewCache.src[r]))) out.push(viewName(rel));
    });

    return out.sort();
}

module.exports.isAnAddress = isAnAddress;

/**
 * THE FILES THAT CAN BE IN A PAGE TOGETHER WITH THIS ONE.
 *
 * A member is resolved ON THE VIEW, not across the catalogue: `GilbaScenarioUI` is declared by
 * TWO files, and resolving over the whole of `assets` would tie
 * `onclick="GilbaScenarioUI.showWhatIfPanel(…)"` to both and make both alive. One of them,
 * `gssh-whatif-ui.js`, is loaded by NO view at all -- twelve of the files in `assets` are -- so
 * its `showWhatIfPanel` is not a false dead. It is dead.
 *
 * THE BOUNDARY, hers: "loaded by no view" is established from the views' SCRIPT LISTS. A file
 * pulled in by JavaScript at runtime would not be seen this way; there is no such loading in the
 * text today.
 */
const companionCache = new Map();

function filesLoadedWith(rel) {
    if (companionCache.has(rel)) return companionCache.get(rel);
    /**
     * A CALL SITE IN A VIEW OR A PARTIAL IS SCOPED TOO, and scoping only `assets` left the
     * subject unresolved: the `onclick` that calls `showWhatIfPanel` sits in
     * `partials/legacy-hub-markup.blade.php`, so with every file a candidate BOTH twins matched
     * and the call came back `member-ambiguous`. A partial's call belongs to the views that
     * include it, and those views load one of the two.
     */
    const bare = String(rel).split('#')[0];
    let views;
    if (bare.startsWith('app/resources/views/')) {
        const name = viewName(bare);
        views = isAnAddress(bare)
            ? [name]
            : bladeViews().filter(isAnAddress)
                .filter((v) => (viewCache.includes[v] || []).includes(bare))
                .map(viewName);
    } else {
        views = viewsLoading(rel);
    }
    const out = new Set([rel]);
    if (views.length) {
        scripts().forEach((other) => {
            if (viewsLoading(other).some((v) => views.includes(v))) out.add(other);
        });
    }
    companionCache.set(rel, out);

    return out;
}

/** Files no view loads at all: their top level runs nowhere. */
function loadedByNoView() {
    return scripts().filter((rel) => !viewsLoading(rel).length).sort();
}

/**
 * HOW A FILE'S TOP LEVEL REACHES A HANDLE, and the two answers are not the same claim:
 *   `top-level` — code that RUNS when the view loads the file; the address is exact.
 *   `listener`  — a listener merely PUT IN PLACE; whether it ever fires is unknown.
 * The sort between them is the first step of closing the divergence batch (GH-680).
 */
function entryKindOf(fileRecord) {
    const top = fileRecord.uses.filter((u) => u.atTopLevel);
    if (top.some((u) => u.how === 'call')) return 'top-level';
    if (top.some((u) => u.how === 'handed over to be run')) return 'listener';

    return 'unknown';
}

module.exports.bladeViews = bladeViews;
module.exports.viewName = viewName;
module.exports.viewsLoading = viewsLoading;
module.exports.filesLoadedWith = filesLoadedWith;
module.exports.loadedByNoView = loadedByNoView;
module.exports.entryKindOf = entryKindOf;

/**
 * THE `page` PAIRS THE WALK FINDS — node × view, with how the node got there.
 *
 * a `page` root is an address only when the address is a VIEW, and the
 * pair carries `entry`. `top-level` means code that RUNS when the view loads the file, so
 * the address is exact; `listener` means a listener was only PUT IN PLACE and whether it
 * ever fires is unknown. That sort is the first step of closing the divergence batch.
 */
function pagePairsFound(fp, graph) {
    const byRel = {};
    (fp.files || universe()).forEach((f) => { byRel[f.rel] = f; });
    const keyFor = (h) => {
        const bare = h.indexOf(':') !== -1 ? h.slice(h.indexOf(':') + 1) : h;
        const pref = h.indexOf(':') !== -1 ? h.slice(0, h.indexOf(':')) : null;

        return [...fp.value.keys()].find((k) => k.endsWith(':' + bare)
            && (!pref || k.startsWith(pref))) || null;
    };
    const pairs = new Map();
    Object.entries(graph.nodes).forEach(([id, n]) => {
        (Array.isArray(n.handle) ? n.handle : (n.handle ? [n.handle] : [])).forEach((h) => {
            const key = keyFor(h);
            if (!key) return;
            const e = executorsOfHandle(fp, key, { graph });
            e.pages.forEach((p) => {
                const asset = p.slice('page|'.length);
                const rec = byRel[asset];
                const entry = rec ? entryKindOf(rec) : 'unknown';
                viewsLoading(asset).forEach((view) => {
                    pairs.set(id + ' : ' + view + ' : ' + entry, { node: id, view, entry, via: asset });
                });
            });
        });
    });

    return pairs;
}

module.exports.pagePairsFound = pagePairsFound;

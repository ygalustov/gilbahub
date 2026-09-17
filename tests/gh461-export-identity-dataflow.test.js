/**
 * GH-461 (PLAN-GH439 section 10.6 §2) — where every identity value in the
 * document comes from, read out of the code itself.
 *
 * The dynamic guard beside this one poisons the page and checks that no
 * sentinel reaches `data`. It is the stronger of the two, and it has one blind
 * spot by construction: it can only see fields that the one run it performs
 * actually fills. The reviewer measured that gap — 25 fields are assigned into
 * `data.turf`, 9 are compared, and among the 16 nobody checks are `isC4`,
 * `effectiveIsC4` and `useC3Targets`, the three that choose the growth curve.
 * That is the input the owner's report turned on.
 *
 * So this one reads the source. For every place an identity value is produced —
 * an assignment into `data.site` / `data.turf` / `data.program`, and any object
 * property named after one of those fields — it walks the right-hand side back
 * to its roots and asks where the value came from. Allowed: the `inputs` object
 * the resolver returned, literals, and a named list of pure derivations of
 * those. Anything else is named with its file, line and the chain that got
 * there.
 *
 * Two shapes this exists to catch, both of which walk past every other guard:
 *
 *   - a read of page state for a field nobody compares (`isC4` from
 *     `GAIP_CANONICAL_STATE.turf.isC4`);
 *   - a read BY ID that uses the wrong id — `getConfig(activePageSiteId)` is
 *     by-id in form and another site in substance. "Reads by id" is not the
 *     guarantee; "reads by THIS sample's site id" is.
 *
 * It also sees code outside `collectData()`, which the function-body guards
 * could not: the Cross-Module block builds `construction` out of
 * `GAIP_STATE.turf` around line 10769.
 */
'use strict';

const fs = require('fs');
const path = require('path');
const parser = require('@babel/parser');
const traverse = require('@babel/traverse').default;
const { hubScripts, RESOLVER_KEYS, PAGE_STATE_SHAPES } = require('./helpers/export-page-sandbox');

/**
 * Files whose assignments are judged: the document builders.
 *
 * This list is DERIVED, not pinned. Every file in assets/ is scanned for an
 * assignment into a document object with an identity field, and the set that
 * comes back is asserted equal to this one — so a third writer appearing in a
 * module nobody thought of fails here on its own, without anyone deciding to
 * widen the surface first.
 *
 * WHERE THIS METHOD ENDS, with the example that exists in the code rather than
 * a hypothetical one: export-metadata.js wraps collectData, receives the
 * document object and writes its own metadata into it. It does not touch
 * identity, so there is no leak and the derived set of writers is right to
 * leave it out — a third file holding the document today, correctly invisible.
 *
 * The day such a wrapper starts BUILDING its own document object instead of
 * adding to the one it was handed, this reader will not see it at all: there
 * will be no assignment into an identity field for the set to find, because
 * the object will not be called `data` and will not pass through here. What
 * catches that is the other half — the sentinel run, which asks what reached
 * the finished document and does not care what any variable was called on the
 * way.
 *
 * So the two halves are not alternatives and neither contains the other. If
 * someone concludes one day that the static reader is enough, this paragraph
 * is the answer.
 */
const FILES = ['word-export.js', 'word-export-combined.js'];

/**
 * Files scanned only so that calls into them can be unfolded by body.
 *
 * nutrition-program-inputs.js is the border itself: reading the page's stores
 * BY ID is its whole job, so its own assignments are not judged by the rule
 * that everything must root in `inputs` — it is where `inputs` comes from.
 * What matters about it here is what its functions return, so that a call to
 * one of them from the export can be followed rather than trusted.
 */
const UNFOLD_ONLY = ['nutrition-program-inputs.js'];

/** The sections a document's identity is assembled into. */
const IDENTITY_TARGETS = ['site', 'turf', 'program'];

/** Field names that carry a site's identity wherever they appear. */
const IDENTITY_FIELDS = [
    'species', 'grassSpecies', 'speciesKey', 'speciesDisplay', 'effectiveSpecies',
    'turfType', 'rawTurfType', 'subCategory', 'variety', 'overseedVariety',
    'construction', 'warmBase', 'coolOverseed', 'overseedSpecies',
    'percentC3', 'hoc', 'isC4', 'effectiveIsC4', 'useC3Targets'
];

/** Roots a value may legitimately have. */
const ALLOWED_ROOTS = ['inputs', 'data'];

/** Language and library objects — not a site's state. */
const BENIGN_ROOTS = ['undefined', 'null', 'Math', 'JSON', 'Object', 'Array', 'String', 'Number',
    'Boolean', 'Date', 'RegExp', 'Intl', 'NaN', 'Infinity', 'parseFloat', 'parseInt', 'isNaN', 'isFinite'];

/** The page's state, in every shape this codebase holds it. */
const PAGE_STATE_ROOTS = ['window', 'global', 'globalThis', 'self', 'document',
    'GAIP_STATE', 'GAIP_CANONICAL_STATE', 'GAIP_OVERSEED_STATE', 'GAIP_CLIMATE_V2_RESULT',
    'GaipTurfProfile', 'SpeciesController', 'climateMetrics', 'GAIP_SiteConfig',
    'GAIP_SampleManager', 'GAIP_HUB_CONFIG', 'GilbaHub',
    // Found by this reader's own "untraceable" list rather than by guesswork:
    // the sensor block reads a page global that was not in this list, so its
    // values were landing in "cannot trace" instead of "page state".
    'GAIP_Sensor'];

/**
 * Built-ins. This is the only list of names in the file, and it is the only
 * one that can be: purity is a property of a body, not of a spelling. Every
 * other call is unfolded into its own returns — in this file or in another
 * scanned one — so a function is trusted because of what it reads, never
 * because of what it is called.
 *
 * The list it replaced named six functions that do not exist in the code at
 * all: each was an unchecked pass waiting for someone to write a function with
 * that name.
 */
const BUILTINS = ['Math', 'JSON', 'Object', 'Array', 'String', 'Number', 'Boolean',
    'Date', 'RegExp', 'parseFloat', 'parseInt', 'isNaN', 'isFinite', 'encodeURIComponent',
    'decodeURIComponent'];

/** Calls that answer for a site — legitimate only when asked about THIS site. */
const BY_ID_CALLS = ['getSiteConfig', 'getConfig', 'resolveExportInputs', 'resolveSiteProgramInputs'];

/** Calls that answer for a site — legitimate only when asked about THIS site. */
/**
 * Places that read page state for an identity field and are not yet moved, each
 * with the reason and what lands there during a leak. Section 10.5 of the plan
 * is the same list. An entry that no longer matches anything fails the test
 * below: a stale exemption reads as "still to do" long after it is done.
 */
const EXEMPT = [
    {
        file: 'word-export.js', fn: 'collectData',
        lhs: 'construction',
        rhs: '(window.GAIP_STATE && window.GAIP_STATE.turf && window.GAIP_STATE.turf.construction) || null',
        roots: ['window.GAIP_STATE'],
        why: 'the Cross-Module block builds its own soil object from GAIP_STATE.turf, outside the resolver entirely; during a leak it carries the previous site\'s construction. Section 10.5 moves it to data.turf.construction'
    },
    {
        file: 'word-export.js', fn: 'collectData',
        lhs: 'construction',
        rhs: 'wm.compactionRisk.construction',
        roots: ['window.GAIP_STATE'],
        why: 'the wear block names the construction off the wear result it read from GAIP_STATE; during a leak that result belongs to the previous site. Section 10.5, out of layer I\'s first pass'
    },
    {
        file: 'word-export.js', fn: 'collectData',
        lhs: 'speciesKey',
        rhs: "cr._companionSpecies || ''",
        roots: ['window.GAIP_COMPANION_DISEASE_RESULT'],
        why: 'the cultivar row prints a companion species out of GAIP_COMPANION_DISEASE_RESULT, the page\'s own cultivar result; during a leak it is the previous site\'s companion. Section 10.5'
    },
    {
        file: 'word-export.js', fn: 'collectData',
        lhs: 'species',
        rhs: 'phyto.species',
        roots: ['window.GAIP_PHYTOTOXICITY_RESULT'],
        why: 'the phytotoxicity block names the species out of GAIP_PHYTOTOXICITY_RESULT, the page\'s own result object; during a leak it is the previous site\'s grass. Section 10.5'
    },
    {
        file: 'word-export-combined.js', fn: 'exportCombinedWithSamples',
        lhs: 'data.site.sampleLabel',
        rhs: 'resolvedLabel',
        roots: ['samples'],
        why: 'the label comes out of the array the caller handed this export, which this reader cannot follow past the parameter; during a leak a report can be labelled with the previous site\'s sample. Section 10.4, moves with samples-by-id'
    },
    {
        file: 'word-export-combined.js', fn: 'exportCombinedWithSamples',
        lhs: 'data.site.siteLabel',
        rhs: 'entry.siteLabel',
        roots: ['samples'],
        why: 'the site label beside it, out of the same array and equally unfollowable past the parameter; during a leak it is the label of whichever site the manager had active when the array was built. Section 10.4'
    },
    {
        file: 'word-export-combined.js', fn: 'exportCombinedWithSamples',
        lhs: 'species',
        rhs: '_turfCfg ? _turfCfg.species : null',
        roots: ['global.GilbaNutritionSummary'],
        why: 'the per-sample block reads the turf config through GilbaNutritionSummary rather than through resolveExportInputs; during a leak it is the site the page opened on, which is the defect the owner reported. Section 10.4'
    },
];

/**
 * Identity values whose root this reader cannot follow — a minified local, a
 * value carried through a callback. Listed by field and line so that a NEW one
 * is a failure rather than more silence; each still has to be read by a person.
 */
const UNTRACEABLE = {
    'word-export.js': [],
    'word-export-combined.js': []
};

function parse(file) {
    const src = fs.readFileSync(path.join(__dirname, '..', 'assets', file), 'utf8');
    return { src: src, ast: parser.parse(src, { sourceType: 'script', errorRecovery: true }) };
}

/**
 * How far a value is followed before the reader admits it has lost the trail,
 * and what it says when that happens.
 *
 * Raised from 12 to 24 by measurement, on the day the marker below replaced a
 * silent []: at 12 the reader was walking off the end of TEN real chains in
 * word-export.js and reporting each as having no roots at all — `species` at
 * 7239 and 7478, `overseedSpecies` at 7383, `isC4` at 8232 among them. Every
 * step down from 24 brings some of them back (22 leaves two, 20 leaves six,
 * 16 leaves nine), so the figure is where the file's own chains end, not a
 * round number. A chain that needs more than this is a reason to raise it
 * again deliberately, with the reason written here — never a reason for the
 * reader to go quiet.
 */
const MAX_DEPTH = 24;

/** The names a page global can be reached through. */
const WINDOW_NAMES = ['window', 'global', 'globalThis', 'self', 'top', 'parent'];

/** An identifier's own name, or null for anything else. */
function rootName(node) {
    return node && node.type === 'Identifier' ? node.name : null;
}

/**
 * Whether a root is the page's state: one of the named containers, or anything
 * reached THROUGH one of them (`window.GAIP_PHYTOTOXICITY_RESULT`).
 */
function isPageStateRoot(root) {
    if (PAGE_STATE_ROOTS.indexOf(root) >= 0) return true;
    const dot = String(root).indexOf('.');
    return dot > 0 && PAGE_STATE_ROOTS.indexOf(String(root).slice(0, dot)) >= 0;
}
const DEPTH_EXHAUSTED = '<depth-exhausted>';

/**
 * Whether a binding belongs to the file rather than to a function inside it.
 * Program scope, or one function deep — the wrapper every asset in this
 * codebase is written inside.
 */
function isModuleLevel(binding) {
    if (!binding || !binding.scope) return false;
    let depth = 0;
    for (let sc = binding.scope; sc; sc = sc.parent) {
        if (!sc.block) break;
        if (sc.block.type === 'Program') return depth <= 1;
        if (sc.block.type === 'FunctionDeclaration' || sc.block.type === 'FunctionExpression'
            || sc.block.type === 'ArrowFunctionExpression' || sc.block.type === 'ObjectMethod') depth++;
    }
    return false;
}

/** The same reader, standing somewhere else: a scope swapped, nothing more. */
function at(scope, babelScope) {
    return babelScope && babelScope !== scope.babel
        ? Object.assign({}, scope, { babel: babelScope })
        : scope;
}

/**
 * Walk one called method's body with its parameters standing for the arguments
 * the call site handed it.
 */
function unfold(method, callNode, callerScope, seen, depth) {
    const substitutions = {};
    (method.params || []).forEach((name, i) => {
        substitutions[name] = callNode.arguments[i]
            ? rootsOf(callNode.arguments[i], callerScope, new Set(), depth + 1) : [];
    });
    const scope = Object.assign({}, method.scope, { substitutions: substitutions, babel: method.babel || method.scope.babel });
    return method.returns.reduce((acc, r) => acc.concat(rootsOf(r, scope, seen, depth + 1)), []);
}

/**
 * The roots of an expression: the identifiers a value ultimately comes from.
 * Locals are followed to their own initialisers, helpers into their returns.
 */
function rootsOf(node, scope, seen, depth) {
    seen = seen || new Set();
    depth = depth || 0;
    // GH-467 (sixth refinement, point 2): running out of depth is not an
    // answer. Returning [] read as "this has no roots at all", so a chain of
    // fifteen locals landed in the clean bucket and nothing anywhere said so —
    // the pinned-empty untraceable list could not see it, because the finding
    // never reached that list. The marker belongs to no bucket, so the finding
    // falls into `unresolved` and the pinned empty list fails on its own.
    if (!node) return [];
    if (depth > MAX_DEPTH) return [DEPTH_EXHAUSTED];
    switch (node.type) {
        case 'Identifier': {
            if (ALLOWED_ROOTS.indexOf(node.name) >= 0) return ['inputs'];
            // Inside an unfolded method: a parameter stands for the argument
            // the caller passed, so the chain continues at the call site
            // instead of stopping at a name. `isC4Species(species)` is pure
            // BECAUSE its answer is a function of what it was handed, and that
            // is only visible when the parameter is substituted.
            if (scope.substitutions && Object.prototype.hasOwnProperty.call(scope.substitutions, node.name)) {
                return scope.substitutions[node.name];
            }
            // A module keeping a value it can change after load is keeping it
            // for whichever site the page is on. Found by measurement, not by
            // reasoning: unfolding GAIP_Sensor.getSelectedZone() reached
            // `selectedZoneData`, a module-level `let` in sensor-import.js, and
            // the reader called it "cannot trace" — which made the sensor
            // container look as if nothing in it read the page at all. A
            // constant list (`const C4_SPECIES = [...]`) is not that, and the
            // distinction is the declaration, not the name.
            const binding = scope.babel ? scope.babel.getBinding(node.name) : null;
            // Module-held state: a top-level name the file can change after
            // load. Judged on the BINDING, so a local of the same name in some
            // other function is a different thing entirely.
            // Module level, counting the file's own IIFE wrapper as module
            // level: every asset here is `(function (global) { … })(this)`, so
            // a `let` the module keeps has its binding one function deep, not
            // at Program. Requiring Program exactly read those as ordinary
            // locals and lost the rule entirely.
            const atProgram = isModuleLevel(binding);
            if (scope.module && scope.mutable && scope.mutable.has(node.name) && (atProgram || !binding)) {
                return [scope.module];
            }
            const key = (scope.file || '') + '#' + node.name + '#' + (binding && binding.path && binding.path.node
                && binding.path.node.start != null ? binding.path.node.start : 'free');
            if (seen.has(key)) return [];
            seen.add(key);
            if (binding && binding.path) {
                const bp = binding.path;
                if (bp.isVariableDeclarator() && bp.node.init) {
                    return rootsOf(bp.node.init, at(scope, bp.scope), seen, depth + 1);
                }
                if (bp.isFunctionDeclaration()) {
                    const returns = [];
                    bp.traverse({ ReturnStatement(r) { if (r.node.argument) returns.push(r.node.argument); } });
                    return returns.reduce((acc, r) => acc.concat(rootsOf(r, at(scope, bp.scope), seen, depth + 1)), []);
                }
                // A parameter this walk did not substitute (a callback's, say)
                // is reported by name rather than passed over.
                if (bp.listKey === 'params') return [node.name];
            }
            const fn = scope.functions[node.name];
            if (fn) return fn.returns.reduce((acc, r) => acc.concat(rootsOf(r, at(scope, fn.babel), seen, depth + 1)), []);
            return [node.name];
        }
        case 'MemberExpression':
            // A module reading its OWN property is reading state it keeps for
            // whichever site the page is on — `this._cache.effectiveSpecies` in
            // species-controller.js, filled by a pass over GAIP_STATE and
            // GaipTurfProfile. Without this the member access stopped at
            // `this` and the method read as pure.
            if (node.object.type === 'ThisExpression' && scope.module) return [scope.module];
            // GH-467 (sixth refinement, point 3): a value taken off a window
            // global is rooted in THAT GLOBAL, not in the word `window`.
            // Stopping at `window` made every page read look alike, so
            // repointing a local from one global to another changed nothing
            // the reader reported — which is what let an exemption keep
            // covering a read whose explanation had become false.
            if (WINDOW_NAMES.indexOf(rootName(node.object)) >= 0 && node.property.type === 'Identifier') {
                return [rootName(node.object) + '.' + node.property.name];
            }
            return rootsOf(node.object, scope, seen, depth + 1);
        case 'CallExpression': {
            const callee = node.callee;
            const name = callee.type === 'Identifier' ? callee.name
                : (callee.type === 'MemberExpression' && callee.property.type === 'Identifier' ? callee.property.name : null);
            if (name && BY_ID_CALLS.indexOf(name) >= 0) {
                // By-id is only as good as the id: the argument must come from
                // the inputs this document is being built for.
                const argRoots = node.arguments.length
                    ? rootsOf(node.arguments[0], scope, seen, depth + 1) : ['<no id>'];
                return argRoots.length ? argRoots : ['inputs'];
            }
            // A built-in only reshapes what it is handed, so its roots are its
            // arguments'. Everything else is unfolded by its BODY below —
            // purity is a property of what a function reads, not of its name.
            if (name && BUILTINS.indexOf(name) >= 0) {
                return node.arguments.reduce((acc, a) => acc.concat(rootsOf(a, scope, seen, depth + 1)), []);
            }
            if (callee.type === 'MemberExpression' && callee.object.type === 'Identifier'
                && BUILTINS.indexOf(callee.object.name) >= 0) {
                return node.arguments.reduce((acc, a) => acc.concat(rootsOf(a, scope, seen, depth + 1)), []);
            }
            if (name && scope.functions[name]) {
                return scope.functions[name].returns
                    .reduce((acc, r) => acc.concat(rootsOf(r, scope, seen, depth + 1)), []);
            }
            // A method of another module: unfold THAT METHOD's body, in its own
            // file, and judge it by what it reads. Its neighbours in the same
            // object are not looked at and do not enter the verdict.
            const target = moduleTargetOf(callee);
            if (target) {
                const mark = target.module + '.' + target.method;
                if (seen.has(mark)) return [];
                seen.add(mark);
                const m = methodOf(target.module, target.method);
                if (m) return unfold(m, node, scope, seen, depth);
            }
            // `this.m()` inside a module's own object: the same rule, resolved
            // against the module whose file this scope was built from.
            if (callee.type === 'MemberExpression' && callee.object.type === 'ThisExpression'
                && callee.property.type === 'Identifier' && scope.module) {
                const mark = scope.module + '.' + callee.property.name;
                // A method already being followed contributes its roots once.
                // Falling through instead marked the MODULE, which turned a
                // pure method into a page read the second time round —
                // measured on SpeciesController.normalize().
                if (seen.has(mark)) return [];
                seen.add(mark);
                const own = methodOf(scope.module, callee.property.name);
                if (own) return unfold(own, node, scope, seen, depth);
            }
            // A call this reader could not resolve: its roots are the object it
            // is called on AND the arguments it was handed. Dropping the
            // arguments was a false green — `C4_SPECIES.includes(canonical)`
            // looked like a read of a constant list and nothing else, so the
            // method's dependence on what it was given disappeared.
            return rootsOf(callee, scope, seen, depth + 1)
                .concat(node.arguments.reduce((acc, a) => acc.concat(rootsOf(a, scope, seen, depth + 1)), []));
        }
        case 'LogicalExpression':
        case 'BinaryExpression':
            return rootsOf(node.left, scope, seen, depth + 1).concat(rootsOf(node.right, scope, seen, depth + 1));
        case 'ConditionalExpression':
            return rootsOf(node.consequent, scope, seen, depth + 1)
                .concat(rootsOf(node.alternate, scope, seen, depth + 1));
        case 'UnaryExpression':
            return rootsOf(node.argument, scope, seen, depth + 1);
        case 'TemplateLiteral':
            return node.expressions.reduce((acc, e) => acc.concat(rootsOf(e, scope, seen, depth + 1)), []);
        default:
            return [];
    }
}

/**
 * Cross-module calls are judged one METHOD at a time.
 *
 * The rule this replaces was "a function from another module is checked in its
 * own file", and read as a rule about MODULES it opens a hole wider than the
 * one it closes. SpeciesController is the worked example: the export calls
 * exactly one method of it, `isC4Species(species)`, which normalises the name it
 * is handed and looks it up in a constant list — pure, by its body. A neighbour
 * in the same object (`species-controller.js:395`) reads GAIP_OVERSEED_STATE and
 * GAIP_STATE. Judging the module puts the honest method in the findings because
 * of its neighbour, and the natural way out of that is an exemption covering the
 * whole module — a hole that then swallows the neighbour too, which is the read
 * we actually care about.
 *
 * So the unit is the method that is CALLED: its own declaration, in its own
 * file, and nothing else in that object. An exemption, if one is ever needed,
 * is written against that method's call with its full text, never against the
 * module or the file.
 */

/** Files this run had to open to unfold a called method. Ratchet surface (e). */
const unfoldedMethodFiles = new Set();

let _moduleIndex = null;

/**
 * Where each project global is declared. Built once by reading every asset for
 * an assignment that publishes an object under a name — `global.X = X`,
 * `window.X = {...}` — which is how this codebase exposes its modules.
 */
function moduleIndex() {
    if (_moduleIndex) return _moduleIndex;
    _moduleIndex = {};
    const dir = path.join(__dirname, '..', 'assets');
    fs.readdirSync(dir)
        .filter((f) => /\.js$/.test(f) && !/\.min\.js$/.test(f))
        .forEach((f) => {
            const src = fs.readFileSync(path.join(dir, f), 'utf8');
            const re = /(?:^|[^.\w])(?:window|global|globalThis|self)\.([A-Za-z_$][\w$]*)\s*=/g;
            let m;
            while ((m = re.exec(src))) {
                if (!_moduleIndex[m[1]]) _moduleIndex[m[1]] = f;
            }
        });
    return _moduleIndex;
}

const _methodCache = {};

/**
 * The declaration of ONE method of one module: its return expressions and a
 * scope built from its own file, so its body can be walked the same way the
 * export's is. Returns null when the method cannot be found — and a call this
 * cannot resolve is left to fall through to its object root, which is a page
 * state root and therefore a finding, not a pass.
 */
function methodOf(moduleName, methodName) {
    const key = moduleName + '.' + methodName;
    if (Object.prototype.hasOwnProperty.call(_methodCache, key)) return _methodCache[key];
    const file = moduleIndex()[moduleName];
    if (!file) { _methodCache[key] = null; return null; }
    let parsed;
    try { parsed = parse(file); } catch (e) { _methodCache[key] = null; return null; }
    let returns = null;
    let params = [];
    let methodScope = null;
    const collect = (fnNode) => {
        const acc = [];
        traverse(fnNode, {
            ReturnStatement(r) { if (r.node.argument) acc.push(r.node.argument); },
            noScope: true
        }, null, {});
        return acc;
    };
    traverse(parsed.ast, {
        ObjectProperty(pth) {
            if (returns) return;
            const k = pth.node.key;
            const name = k.type === 'Identifier' ? k.name : (k.type === 'StringLiteral' ? k.value : null);
            if (name !== methodName) return;
            const v = pth.node.value;
            if (v.type !== 'FunctionExpression' && v.type !== 'ArrowFunctionExpression') return;
            const acc = [];
            pth.traverse({ ReturnStatement(r) { if (r.node.argument) acc.push(r.node.argument); } });
            returns = acc;
            params = v.params.map((pm) => (pm.type === 'Identifier' ? pm.name : null));
            methodScope = pth.get('value').scope;
        },
        AssignmentExpression(pth) {
            if (returns) return;
            const left = pth.node.left;
            if (left.type !== 'MemberExpression' || left.property.type !== 'Identifier') return;
            if (left.property.name !== methodName) return;
            const v = pth.node.right;
            if (v.type !== 'FunctionExpression' && v.type !== 'ArrowFunctionExpression') return;
            const acc = [];
            pth.traverse({ ReturnStatement(r) { if (r.node.argument) acc.push(r.node.argument); } });
            returns = acc;
            params = v.params.map((pm) => (pm.type === 'Identifier' ? pm.name : null));
            methodScope = pth.get('right').scope;
        }
    });
    if (!returns) { _methodCache[key] = null; return null; }
    unfoldedMethodFiles.add(file);
    const built = buildScope(parsed.ast, moduleName);
    built.file = file;
    const result = { returns: returns, params: params, file: file, scope: built, babel: methodScope };
    _methodCache[key] = result;
    return result;
}

/**
 * The module a `X.m()` / `window.X.m()` call is addressed to, or null when the
 * callee is not that shape.
 */
function moduleTargetOf(callee) {
    if (callee.type !== 'MemberExpression' || callee.property.type !== 'Identifier') return null;
    const obj = callee.object;
    if (obj.type === 'Identifier') return { module: obj.name, method: callee.property.name };
    if (obj.type === 'MemberExpression' && obj.property.type === 'Identifier'
        && obj.object.type === 'Identifier'
        && ['window', 'global', 'globalThis', 'self'].indexOf(obj.object.name) >= 0) {
        return { module: obj.property.name, method: callee.property.name };
    }
    return null;
}

function crossFileFunctions() {
    const table = {};
    UNFOLD_ONLY.forEach((file) => {
        const parsed = parse(file);
        traverse(parsed.ast, {
            FunctionDeclaration(p) {
                if (!p.node.id) return;
                const returns = [];
                p.traverse({ ReturnStatement(r) { if (r.node.argument) returns.push(r.node.argument); } });
                table[p.node.id.name] = { returns: returns, file: file, babel: p.scope };
            }
        });
    });
    return table;
}

/** Methods that change the thing they are called on. */
const MUTATORS = ['push', 'pop', 'shift', 'unshift', 'splice', 'sort', 'reverse',
    'fill', 'copyWithin', 'set', 'add', 'delete', 'clear'];

/**
 * The identifier at the root of an assignment target: `a`, `a.b.c`, `a[k]`.
 * Anything else (a destructuring pattern, a call result) returns null.
 */
function lhsRoot(node) {
    let n = node;
    while (n && n.type === 'MemberExpression') n = n.object;
    return n && n.type === 'Identifier' ? n.name : null;
}

function buildScope(ast, moduleName) {
    const functions = {};
    let programScope = null;
    // Names the file can CHANGE after load: `let`/`var` bindings, and anything
    // assigned to anywhere. A module that keeps one of these is keeping state
    // for whichever site the page is on — see `mutable` below.
    const mutable = new Set();
    traverse(ast, {
        Program(p) { programScope = p.scope; },
        VariableDeclarator(p) {
            if (p.node.id.type !== 'Identifier') return;
            const kind = p.parent && p.parent.kind;
            if (kind === 'let' || kind === 'var' || !p.node.init) mutable.add(p.node.id.name);
        },
        AssignmentExpression(p) {
            // GH-467 (sixth refinement, point 1): the root of ANY left-hand
            // side, not just a bare name. `const _idCache = {}` filled by
            // `_idCache.species = …` is the third shape of module state after
            // `let` and `this._cache`, and it unfolded into an empty object
            // literal and read as pure — 19 of 19 green while the module held
            // the page's species.
            const root = lhsRoot(p.node.left);
            if (root) mutable.add(root);
        },
        UpdateExpression(p) {
            const root = lhsRoot(p.node.argument);
            if (root) mutable.add(root);
        },
        UnaryExpression(p) {
            // `delete a.b` empties a container the same way a write fills it.
            if (p.node.operator !== 'delete') return;
            const root = lhsRoot(p.node.argument);
            if (root) mutable.add(root);
        },
        CallExpression(p) {
            const callee = p.node.callee;
            // Object.assign(target, …) writes into its first argument.
            if (callee.type === 'MemberExpression' && callee.object.type === 'Identifier'
                && callee.object.name === 'Object' && callee.property.type === 'Identifier'
                && callee.property.name === 'assign' && p.node.arguments.length) {
                const root = lhsRoot(p.node.arguments[0]);
                if (root) mutable.add(root);
            }
            // A mutating built-in called ON a container mutates it.
            if (callee.type === 'MemberExpression' && callee.property.type === 'Identifier'
                && MUTATORS.indexOf(callee.property.name) >= 0) {
                const root = lhsRoot(callee.object);
                if (root) mutable.add(root);
            }
        },
        FunctionDeclaration(p) {
            const returns = [];
            p.traverse({ ReturnStatement(r) { if (r.node.argument) returns.push(r.node.argument); } });
            if (p.node.id) functions[p.node.id.name] = { returns: returns, babel: p.scope };
        }
    });
    return {
        functions: Object.assign({}, crossFileFunctions(), functions),
        module: moduleName || null,
        mutable: mutable,
        // GH-468 (seventh refinement, point 3): the babel scope of the file.
        // Identifiers are resolved through it — `scope.getBinding(name)` from
        // the place the expression stands — rather than through a flat map of
        // name to initialiser kept for the whole file. That map made two
        // functions with a local of the same name overwrite each other, so a
        // chain walked off into another function's body: a false red when the
        // other body reads the page, a false green when it does not. Found
        // while chasing SpeciesController.normalize, where `canonical` in one
        // method was resolved against `canonical` in another.
        babel: programScope
    };
}


/**
 * A node's own text, whitespace normalised. This is what an exemption is
 * anchored to: the WHOLE right-hand side, so that one exemption covers one
 * read and a second read of the same field by a different expression matches
 * nothing and fails.
 *
 * Not a line number, which moves with any edit above it, and not a fragment,
 * which is the substring rule this replaced: an anchor of the general shape
 * (`window.GAIP_STATE && window.GAIP_STATE.turf`) is contained in every read
 * from that root, so a second read of the same field in the ordinary idiom was
 * absorbed by it — 6 of 6 green on the reviewer's mutation, while the same leak
 * written another way was red. An exemption wider than its reason is a hole
 * exactly that wide.
 */
function textOf(src, node) {
    if (node.start == null || node.end == null) return '';
    return src.slice(node.start, node.end).replace(/\s+/g, ' ').trim();
}

/** The name of the function a node sits in — the exemption's second coordinate. */
function enclosingFunction(path) {
    let p = path;
    while (p) {
        const n = p.node;
        if (n.type === 'FunctionDeclaration' && n.id) return n.id.name;
        if (n.type === 'FunctionExpression' && n.id) return n.id.name;
        if ((n.type === 'FunctionExpression' || n.type === 'ArrowFunctionExpression')
            && p.parent && p.parent.type === 'VariableDeclarator'
            && p.parent.id.type === 'Identifier') return p.parent.id.name;
        if ((n.type === 'FunctionExpression' || n.type === 'ArrowFunctionExpression')
            && p.parent && p.parent.type === 'ObjectProperty'
            && p.parent.key.type === 'Identifier') return p.parent.key.name;
        if ((n.type === 'FunctionExpression' || n.type === 'ArrowFunctionExpression')
            && p.parent && p.parent.type === 'AssignmentExpression'
            && p.parent.left.type === 'MemberExpression'
            && p.parent.left.property.type === 'Identifier') return p.parent.left.property.name;
        p = p.parentPath;
    }
    return '<top level>';
}

/** Every identity value produced in a file, with where it came from. */
function identitySources(file) {
    const parsed = parse(file);
    const scope = buildScope(parsed.ast);
    const found = [];
    const record = (field, node, kind, container, path, lhs) => {
        const roots = Array.from(new Set(rootsOf(node, at(scope, path && path.scope), new Set(), 0)));
        const pageState = roots.filter(isPageStateRoot);
        const unresolved = roots.filter((r) => r !== 'inputs'
            && BENIGN_ROOTS.indexOf(r) < 0 && !isPageStateRoot(r));
        if (!pageState.length && !unresolved.length) return;
        const line = node.loc ? node.loc.start.line : null;
        found.push({
            file: file, field: field, kind: kind, line: line, container: container || null,
            // The fifth exemption coordinate: every root the analysis reached,
            // page state and unfollowable alike. Splitting them and matching
            // only the page-state half would let a read whose root moved from
            // a named global to an unfollowable local keep its exemption.
            allRoots: roots,
            fn: enclosingFunction(path),
            lhs: lhs,
            rhs: textOf(parsed.src, node),
            text: line ? (parsed.src.split('\n')[line - 1] || '').trim() : '',
            roots: pageState, unresolved: unresolved
        });
    };
    traverse(parsed.ast, {
        AssignmentExpression(p) {
            const left = p.node.left;
            if (left.type !== 'MemberExpression') return;
            const obj = left.object;
            if (obj.type !== 'MemberExpression') return;
            if (obj.object.type !== 'Identifier' || obj.object.name !== 'data') return;
            if (obj.property.type !== 'Identifier') return;
            const field = left.property.type === 'Identifier' ? left.property.name : '<computed>';
            record(field, p.node.right, 'assignment into data.' + obj.property.name,
                obj.property.name, p, textOf(parsed.src, left));
        },
        ObjectProperty(p) {
            const key = p.node.key;
            const name = key.type === 'Identifier' ? key.name : (key.type === 'StringLiteral' ? key.value : null);
            if (!name || IDENTITY_FIELDS.indexOf(name) < 0) return;
            record(name, p.node.value, 'object property', null, p, name);
        }
    });
    return found;
}

/**
 * An exemption covers ONE read, named by a fragment of its own line — not every
 * read of that field from that kind of root.
 *
 * Written after a mutation walked past this guard: a read of `species` moved
 * into a helper one line above collectData was absorbed by the exemption for a
 * different `species` read in the phytotoxicity block, because both are "field
 * species, root window" in the same file. An exemption wider than its reason is
 * a hole exactly as wide as the difference — section 10.9.
 */
/**
 * Containers that hold the RESULTS of a run rather than a site's identity —
 * section 10.2's view II. There is no answer for them by id: they exist only
 * as the output of a calculation, and until layer II gives each run a stamp,
 * the export reads them off the page by construction.
 *
 * Exempted per container rather than per read, deliberately and for one
 * reason: the whole container moves at once when layer II lands, so a
 * per-read list here would be a hundred entries that all disappear together.
 * The identity containers — site, turf, program — get no such blanket; every
 * read in them is named individually, because they move one field at a time.
 */
const VIEW_II_CONTAINERS = {
    soil: 'mlsnResults and the soil form, read from the page; no soil result exists by id until a run is stamped',
    tissue: 'tissueResults from the page; no tissue result exists by id until a run is stamped',
    water: 'waterResults and the blend form on the page; no water result exists by id until a run is stamped',
    climate: 'the single window.climateMetrics slot — the block GH-245 moved the CALCULATION off and left the PRINTING on',
    shade: 'shadeMetrics computed by the page\'s own run; no shade result exists by id',
    irrigation: 'the irrigation scheduler\'s own result object on the page',
    dmi: 'the DMI suppression result computed by the page\'s own run',
    pgr: 'the PGR module\'s result computed by the page\'s own run',
    salinity: 'the salinity engine\'s result on the page',
    disease: 'the disease engine\'s result on the page',
    traffic: 'wearMetrics computed by the page\'s own run; no wear result exists by id',
    nutritionSummary: 'the nutrition summary computed by the page\'s own run',
    nutritionProgram: 'the programme the page generated, read back from its own globals',
    nProgram: 'the annual N figures the page holds beside that programme',
    varietyTraits: 'the variety trait lookup the page performed',
    amendment: 'the amendment recommendations the page computed',
    sprayLog: 'the spray log the page holds for the site it is showing; no log exists by id here yet',
    sensor: 'GAIP_Sensor readings held on the page; no reading exists by id until a run is stamped',
    // GH-468: found once identifiers were resolved through their own scope.
    // The flat name map had been resolving this block's `summary` against a
    // local of the same name in another function, so four fields read off
    // GAIP_TRAJECTORY_RESULT were being reported as clean.
    trajectory: 'GAIP_TRAJECTORY_RESULT, the trajectory analysis the page ran; no trajectory exists by id until a run is stamped'
};

function isViewII(finding) {
    return !!(finding.container && Object.prototype.hasOwnProperty.call(VIEW_II_CONTAINERS, finding.container));
}

/**
 * An exemption covers ONE read, identified by WHERE it is and WHAT it is:
 * the file, the function around it, the thing being written, and the whole
 * right-hand side as the parser read it. All four must match exactly.
 *
 * Not a substring of the line, which is what stood here: an anchor of the
 * general shape is contained in every read from that root, so the same leak
 * written in the ordinary idiom one line later was absorbed by it. Not a line
 * number either — it moves with any edit above it, and an exemption that slides
 * onto its neighbour is worse than one that stops matching.
 */
/** Two root sets are the same set, order aside. */
function sameRoots(a, b) {
    if (!a || !b || a.length !== b.length) return false;
    const x = a.slice().sort();
    const y = b.slice().sort();
    return x.every((v, i) => v === y[i]);
}

/**
 * GH-467 (sixth refinement, point 3): the fifth coordinate is WHERE THE VALUE
 * COMES FROM, as the reader worked it out. Four positional coordinates describe
 * the read's place and its text; repointing a local from one page global to
 * another leaves all four identical while the exemption's sentence about what
 * leaks there becomes false.
 */
function isExempt(finding) {
    return EXEMPT.some((e) => e.file === finding.file && e.fn === finding.fn
        && e.lhs === finding.lhs && e.rhs === finding.rhs && sameRoots(e.roots, finding.allRoots));
}

/**
 * Every file in assets/ that writes an identity field into a document object.
 *
 * Counted by the same reading the guard does — an assignment into
 * `data.<container>.<field>`, or an object property named after an identity
 * field in a file that builds document objects — rather than by a pattern over
 * the text, because the combined export writes most of its identity as object
 * literals and a text rule missed it entirely on the first attempt.
 */
function filesThatWriteIdentity() {
    const dir = path.join(__dirname, '..', 'assets');
    return fs.readdirSync(dir)
        .filter((f) => /\.js$/.test(f) && !/\.min\.js$/.test(f))
        .filter((f) => {
            const src = fs.readFileSync(path.join(dir, f), 'utf8');
            if (src.indexOf('data.site') < 0 && src.indexOf('data.turf') < 0
                && src.indexOf('data.program') < 0) return false;
            let writes = false;
            let ast;
            try {
                ast = parser.parse(src, { sourceType: 'script', errorRecovery: true });
            } catch (e) { return false; }
            traverse(ast, {
                AssignmentExpression(pth) {
                    const left = pth.node.left;
                    if (left.type !== 'MemberExpression' || left.object.type !== 'MemberExpression') return;
                    const obj = left.object;
                    if (obj.object.type !== 'Identifier' || obj.object.name !== 'data') return;
                    if (obj.property.type !== 'Identifier'
                        || IDENTITY_TARGETS.indexOf(obj.property.name) < 0) return;
                    const field = left.property.type === 'Identifier' ? left.property.name : null;
                    if (field && (IDENTITY_FIELDS.indexOf(field) >= 0
                        || ['name', 'location', 'sampleLabel', 'siteLabel', 'areaHa'].indexOf(field) >= 0)) {
                        writes = true;
                    }
                }
            });
            return writes;
        });
}


/**
 * GH-466 (section 10.6, fourth refinement, point 2) — the ratchet pins the
 * SURFACE, not a number.
 *
 * A count only ever said "no more exemptions than before", and the reviewer
 * listed five ways to improve it by measuring less: merge two exemptions under
 * one wider anchor; drop a root from the page-state list; narrow the scanned
 * surface (a field out of the identity list, a file out of the scanned set);
 * move a read into "cannot trace", which the count never included; move it
 * outside the scanned files altogether. Each of those makes the figure better
 * precisely because something stopped being measured.
 *
 * So every surface is recorded here in full and asserted EQUAL, not "no worse
 * than". Widening and narrowing both fail, both with a diff naming what moved.
 * An honest reduction — a read moved into the resolver, its exemption deleted —
 * is an edit to the list below carrying the ticket that did it, and the ratchet
 * is green again afterwards.
 *
 * Surface (e) is the exception and is DERIVED rather than recorded: the files
 * judged are whatever writes identity into a document, so a third writer fails
 * by appearing. The recorded half of it is the set of modules whose methods
 * this reader had to open, which must all be modules the export page actually
 * loads.
 */
const RATCHET = {
    // (a) One line per exemption, by its own four coordinates.
    exemptions: [
        "word-export.js | collectData | construction = (window.GAIP_STATE && window.GAIP_STATE.turf && window.GAIP_STATE.turf.construction) || null | roots window.GAIP_STATE",
        "word-export.js | collectData | construction = wm.compactionRisk.construction | roots window.GAIP_STATE",
        "word-export.js | collectData | speciesKey = cr._companionSpecies || '' | roots window.GAIP_COMPANION_DISEASE_RESULT",
        "word-export.js | collectData | species = phyto.species | roots window.GAIP_PHYTOTOXICITY_RESULT",
        "word-export-combined.js | exportCombinedWithSamples | data.site.sampleLabel = resolvedLabel | roots samples",
        "word-export-combined.js | exportCombinedWithSamples | data.site.siteLabel = entry.siteLabel | roots samples",
        "word-export-combined.js | exportCombinedWithSamples | species = _turfCfg ? _turfCfg.species : null | roots global.GilbaNutritionSummary"
    ],
    // (b) Readings this reader cannot follow. Empty, and asserted empty.
    untraceable: { 'word-export.js': [], 'word-export-combined.js': [] },
    // (c) The shapes the page holds state in.
    pageStateRoots: ['window', 'global', 'globalThis', 'self', 'document',
        'GAIP_STATE', 'GAIP_CANONICAL_STATE', 'GAIP_OVERSEED_STATE', 'GAIP_CLIMATE_V2_RESULT',
        'GaipTurfProfile', 'SpeciesController', 'climateMetrics', 'GAIP_SiteConfig',
        'GAIP_SampleManager', 'GAIP_HUB_CONFIG', 'GilbaHub', 'GAIP_Sensor'],
    // (d) What counts as identity, and the border's own key list.
    identityFields: ['species', 'grassSpecies', 'speciesKey', 'speciesDisplay', 'effectiveSpecies',
        'turfType', 'rawTurfType', 'subCategory', 'variety', 'overseedVariety',
        'construction', 'warmBase', 'coolOverseed', 'overseedSpecies',
        'percentC3', 'hoc', 'isC4', 'effectiveIsC4', 'useC3Targets'],
    resolverSections: ['top', 'site', 'site.location', 'turf', 'samples', 'program', 'sources'],
    // (e) Modules opened to unfold a called method. Derived by the run; this is
    // what it must come to.
    // Measured, not chosen: the modules whose methods the right-hand sides in
    // the export actually call. nutrition-calendar.js joined when GH-469 made
    // the combined export build each sample's inputs through
    // inputsForSite() — the ratchet reddened on a legitimate new call, which
    // is the rule working rather than a false alarm. All are on the export
    // page's own script list, which the test below checks.
    methodModules: ['hub-orchestrator.js', 'nutrition-calendar.js', 'sensor-import.js'],
    // (f) Page-state roots the live capture found nothing under, so the
    // poisoning cannot enumerate them and only this static reader sees a copy
    // by enumeration from them. Written down rather than left implicit.
    // Measured empty on the live page at capture time — the one page global
    // the reviewer had already measured as empty on /reports/export. Nothing
    // can be enumerated out of it, so a copy by enumeration from it is the
    // static reader's to catch. (The fixture records a second such root,
    // GAIP_COMPANION_DISEASE_RESULT, which is not a page-state root here
    // because it only exists on a greens site with a companion surface.)
    uncapturedRoots: ['GAIP_OVERSEED_STATE']
};

describe('GH-461 — every identity value traces back to the resolver', () => {
    const all = [];
    beforeAll(() => { FILES.forEach((f) => { all.push.apply(all, identitySources(f)); }); });

    test('the files judged here are exactly the files that write identity into a document', () => {
        // Derived, not declared: a third writer in a module nobody expected
        // fails here by appearing, rather than waiting for someone to decide
        // the surface should be wider.
        const writers = filesThatWriteIdentity().sort();
        expect({ writers: writers }).toEqual({ writers: FILES.slice().sort() });
    });

    test.each(FILES)('%s: no identity value comes from the page\'s state', (file) => {
        const unexplained = all.filter((f) => f.file === file && f.roots.length && !isViewII(f) && !isExempt(f))
            .map((f) => f.field + ' at line ' + f.line + ' from ' + f.roots.join(', ') + ' (' + f.kind + ')');
        expect({ file: file, unexplained: unexplained }).toEqual({ file: file, unexplained: [] });
    });

    test.each(FILES)('%s: a value this reader cannot trace is named, not passed over', (file) => {
        // A root it could not follow is neither proof nor absolution. Naming
        // them keeps the difference between "checked" and "not checked" visible
        // instead of letting the silence read as a pass.
        const untraceable = all.filter((f) => f.file === file && f.unresolved.length && !f.roots.length
            && !isViewII(f) && !isExempt(f))
            .map((f) => f.field + ':' + f.line + ' <- ' + f.unresolved.join(','));
        const named = UNTRACEABLE[file] || [];
        const surprises = untraceable.filter((u) => named.indexOf(u.split(' <- ')[0]) < 0);
        expect({ file: file, surprises: surprises }).toEqual({ file: file, surprises: [] });
        // The reviewer measured this list empty in both files, so it is
        // asserted empty rather than kept as a constant nobody rereads: a
        // reading this cannot follow must appear as a failure here, not as a
        // row that was already written down.
        expect({ file: file, named: named }).toEqual({ file: file, named: [] });
    });

    test('a container blanket is removed once nothing in it reads the page', () => {
        // GH-468: "produces nothing this reader had to judge", not "produces
        // no page root". A container whose reads go through a callback
        // parameter gives roots this reader cannot follow, and calling that
        // clean would be the guard's own blindness read as tidy code — which
        // has already happened once here, with GAIP_Sensor.
        const stillReading = Object.keys(VIEW_II_CONTAINERS)
            .filter((c) => all.some((f) => f.container === c && (f.roots.length || f.unresolved.length)));
        const idle = Object.keys(VIEW_II_CONTAINERS).filter((c) => stillReading.indexOf(c) < 0);
        expect({ idle: idle }).toEqual({ idle: [] });
    });

    test('every container blanket says what it holds and why it has no answer by id', () => {
        const thin = Object.keys(VIEW_II_CONTAINERS)
            .filter((c) => typeof VIEW_II_CONTAINERS[c] !== 'string' || VIEW_II_CONTAINERS[c].length < 30);
        expect({ thin: thin }).toEqual({ thin: [] });
    });

    test('every exemption still matches something, and says what leaks there', () => {
        const stale = EXEMPT.filter((e) => !all.some((f) => f.file === e.file && f.fn === e.fn
            && f.lhs === e.lhs && f.rhs === e.rhs && sameRoots(e.roots, f.allRoots)))
            .map((e) => e.file + ' ' + e.fn + ': ' + e.lhs + ' = ' + e.rhs + ' | ' + JSON.stringify(e.roots));
        expect({ stale: stale }).toEqual({ stale: [] });
        const thin = EXEMPT.filter((e) => typeof e.why !== 'string' || e.why.length < 60 || !/leak|section/i.test(e.why)
            || typeof e.rhs !== 'string' || !e.rhs.length || typeof e.fn !== 'string' || !e.fn.length
            || !Array.isArray(e.roots) || !e.roots.length)
            .map((e) => e.file + ':' + e.lhs);
        expect({ thin: thin }).toEqual({ thin: [] });
        // An explanation that names a page global must name one this read
        // actually has. Without it the sentence and the fact drift apart
        // silently, which is how an exemption outlives its reason.
        const named = (e) => String(e.why).match(/\b(?:GAIP|Gaip|Gilba)[A-Za-z_0-9]*\b/g) || [];
        const contradicted = EXEMPT.filter((e) => named(e).some((n) =>
            !e.roots.some((r) => r === n || r.slice(r.indexOf('.') + 1) === n)))
            .map((e) => e.file + ':' + e.lhs + ' says ' + JSON.stringify(named(e)) +
                ', reads ' + JSON.stringify(e.roots));
        expect({ contradicted: contradicted }).toEqual({ contradicted: [] });
    });

    test('ratchet (a): the exemptions are exactly the ones written down', () => {
        const live = EXEMPT.map((e) => e.file + ' | ' + e.fn + ' | ' + e.lhs + ' = ' + e.rhs
            + ' | roots ' + e.roots.slice().sort().join(',')).sort();
        expect({ exemptions: live }).toEqual({ exemptions: RATCHET.exemptions.slice().sort() });
    });

    test('ratchet (b): nothing is listed as untraceable, and nothing is', () => {
        expect({ untraceable: UNTRACEABLE }).toEqual({ untraceable: RATCHET.untraceable });
    });

    test('ratchet (c): the page-state roots are exactly the ones written down', () => {
        expect({ roots: PAGE_STATE_ROOTS.slice().sort() })
            .toEqual({ roots: RATCHET.pageStateRoots.slice().sort() });
    });

    test('ratchet (d): the identity fields and the resolver\'s sections are exactly the ones written down', () => {
        expect({ fields: IDENTITY_FIELDS.slice().sort() })
            .toEqual({ fields: RATCHET.identityFields.slice().sort() });
        expect({ sections: Object.keys(RESOLVER_KEYS).sort() })
            .toEqual({ sections: RATCHET.resolverSections.slice().sort() });
    });

    test('ratchet (e): the modules opened to unfold a called method are written down, and the page loads each', () => {
        // Derived by the run rather than declared, and tied to the page: a
        // method reached in a module the export page does not load would mean
        // the reader is judging code the document never runs.
        const opened = Array.from(unfoldedMethodFiles).sort();
        expect({ modules: opened }).toEqual({ modules: RATCHET.methodModules.slice().sort() });
        const onPage = hubScripts();
        const offPage = opened.filter((f) => onPage.indexOf(f) < 0);
        expect({ offPage: offPage }).toEqual({ offPage: [] });
    });

    test('ratchet (f): the captured page-state shapes cover every page-state root', () => {
        // GH-469: the poisoning enumerates from a fixture of real shapes, so
        // the fixture is a surface like the other five. A root with no captured
        // shape enumerates as empty — which is the case the static reader has
        // to catch, and saying which roots those are is the point.
        const captured = Object.keys(PAGE_STATE_SHAPES.shapes)
            .map((k) => k.split('.')[0]);
        const uncaptured = PAGE_STATE_ROOTS
            .filter((r) => ['window', 'global', 'globalThis', 'self', 'document'].indexOf(r) < 0)
            .filter((r) => captured.indexOf(r) < 0);
        expect({ uncaptured: uncaptured }).toEqual({ uncaptured: RATCHET.uncapturedRoots });
        expect(PAGE_STATE_SHAPES._captured).toMatch(/^\d{4}-\d{2}-\d{2}$/);
        // How it was captured matters as much as when: the getter merges the
        // last object a setter was given into every read, so a snapshot at one
        // moment is not what the export sees later. The capture says so.
        expect(String(PAGE_STATE_SHAPES._how)).toMatch(/getter/);
        // And the types the poisoning derives its numbers and booleans from.
        expect(Object.keys(PAGE_STATE_SHAPES.types || {}).length).toBeGreaterThan(100);
        // The six named result containers, as the getter answered during a
        // real export: five live, one dead. Recorded rather than reasoned.
        expect(PAGE_STATE_SHAPES._throughGetter.fertility).toBe('undefined');
        const live = Object.keys(PAGE_STATE_SHAPES._throughGetter)
            .filter((k) => PAGE_STATE_SHAPES._throughGetter[k] !== 'undefined');
        expect(live.sort()).toEqual(['mlsnResults', 'shadeMetrics', 'tissueResults',
            'waterResults', 'wearMetrics']);
    });

    test('the three fields that choose the growth curve are covered by this guard', () => {
        // The dynamic guard can only see fields its one run fills; these three
        // are exactly the ones it did not, and they decide the curve.
        ['isC4', 'effectiveIsC4', 'useC3Targets'].forEach((f) => {
            expect(IDENTITY_FIELDS.indexOf(f)).toBeGreaterThan(-1);
        });
    });
});

/**
 * The unit of judgement is the CALLED METHOD — asserted on the case the plan
 * names, so that a return to judging modules fails here.
 */
describe('GH-466 — a cross-module call is judged by the method\'s own body, not its module\'s', () => {
    const scope = { locals: {}, functions: {}, module: null, mutable: new Set() };
    const rootsOfSnippet = (code) => {
        const ast = parser.parse('var _x = ' + code + ';', { sourceType: 'script' });
        const init = ast.program.body[0].declarations[0].init;
        return Array.from(new Set(rootsOf(init, scope, new Set(), 0)));
    };

    test('SpeciesController.isC4Species(species) is pure: its answer is a function of what it is handed', () => {
        // species-controller.js:247 — normalise the name, look it up in a
        // constant list. Nothing about the page enters it, and that is read out
        // of the body rather than taken from the method's name.
        const roots = rootsOfSnippet('SpeciesController.isC4Species(inputs.turf.species)');
        expect(roots.filter(isPageStateRoot)).toEqual([]);
        // What it DOES leave is `canonical`, a name bound by a destructuring
        // for-of inside normalize() that this reader does not follow. Named
        // rather than hidden: purity here means "reads nothing of the page",
        // and an unfollowable local is reported, not assumed either way.
        expect(roots).toContain('canonical');
    });

    test('a method of the SAME module that reads the page is not pure, and says which module holds it', () => {
        // species-controller.js:~380 resolves the sward from GAIP_STATE and
        // GAIP_OVERSEED_STATE. Judged on its own, it is a page read; the honest
        // neighbour above is unaffected by it. Judging the MODULE would put
        // both in the findings and invite an exemption covering the module —
        // which would then cover this one too.
        const roots = rootsOfSnippet('SpeciesController.getEffectiveSpecies()');
        expect(roots.length).toBeGreaterThan(0);
        expect(roots.every(isPageStateRoot)).toBe(true);
    });

    test('a module keeping a value it can change after load is keeping the page\'s state', () => {
        // sensor-import.js returns a module-level `let` from
        // getSelectedZone(). Before this rule the reader called that "cannot
        // trace", and the sensor container then looked as though nothing in it
        // read the page — the guard's own blindness reading as clean code.
        expect(rootsOfSnippet('GAIP_Sensor.getSelectedZone()')).toEqual(['GAIP_Sensor']);
    });

    test('a constant list in a module is not state', () => {
        // The other side of the same rule: `const C4_SPECIES = [...]` in the
        // module above is a table, not a site's value, so the method that
        // reads it stays pure. Without the distinction every cross-module call
        // would be a finding and the rule would be useless.
        const roots = rootsOfSnippet('SpeciesController.isC4Species("Kikuyu")');
        expect(roots.filter(isPageStateRoot)).toEqual([]);
    });

    test('a pure method of a module that IS a page-state root is still read as pure', () => {
        // GH-467 (sixth refinement, point 4). SpeciesController is in the
        // page-state list, so a call on it could be marked by its object
        // before the method is looked at — and `normalize(species)`, which
        // only cleans up a name it was handed, would come back as a page read.
        // Wrong in the safe direction, but it is the exact road to the trap
        // the fourth refinement names: an exemption for a pure method, then
        // one for the module. The method is resolved FIRST; the module's name
        // is used only when it cannot be.
        const roots = rootsOfSnippet('SpeciesController.normalize(inputs.turf.species)');
        expect(roots.filter((r) => isPageStateRoot(r))).toEqual([]);
    });

    test('the page-reading method of that same module is still red', () => {
        const roots = rootsOfSnippet('SpeciesController.getEffectiveSpecies()');
        expect(roots.filter((r) => isPageStateRoot(r)).length).toBeGreaterThan(0);
    });

    test('a call this reader cannot resolve falls through to its object, which is a page root', () => {
        // Not silence: an unresolvable method is treated as a read of the
        // object it is called on, so it appears as a finding rather than as a
        // pass. The failure mode of the unfolding is a false RED, not a false
        // green.
        expect(rootsOfSnippet('GAIP_STATE.noSuchMethodAnywhere()')).toEqual(['GAIP_STATE']);
    });
});

'use strict';
const fs = require('fs');
const path = require('path');
const parser = require('@babel/parser');
const traverse = require('@babel/traverse').default;

const PRINT_PROPS = ['textContent', 'innerHTML', 'innerText'];
const WRITE_METHODS = ['PATCH', 'POST', 'PUT'];

function isEmptyLiteral(n) {
    if (!n) return true;
    if (n.type === 'NullLiteral') return true;
    if (n.type === 'Identifier' && n.name === 'undefined') return true;
    if (n.type === 'StringLiteral') return n.value === '';
    if (n.type === 'NumericLiteral') return n.value === 0;
    if (n.type === 'BooleanLiteral') return n.value === false;
    if (n.type === 'ArrayExpression') return n.elements.length === 0;
    if (n.type === 'ObjectExpression') return n.properties.length === 0;
    if (n.type === 'TemplateLiteral') return n.expressions.length === 0 && n.quasis.every((q) => q.value.raw === '');
    return false;
}

function isEmptinessTest(test) {
    if (!test) return null;
    if (test.type === 'UnaryExpression' && test.operator === '!') return 'consequent';
    if (test.type === 'BinaryExpression' && ['==', '==='].indexOf(test.operator) >= 0
        && (isEmptyLiteral(test.left) || isEmptyLiteral(test.right))) return 'consequent';
    if (test.type === 'BinaryExpression' && ['!=', '!=='].indexOf(test.operator) >= 0
        && (isEmptyLiteral(test.left) || isEmptyLiteral(test.right))) return 'alternate';
    if (test.type === 'LogicalExpression' && test.operator === '||') {
        return isEmptinessTest(test.left) || isEmptinessTest(test.right);
    }
    if (test.type === 'LogicalExpression' && test.operator === '&&') {
        return isEmptinessTest(test.left) || isEmptinessTest(test.right);
    }
    if (test.type === 'Identifier' || test.type === 'MemberExpression' || test.type === 'CallExpression') return 'alternate';
    return null;
}

/**
 * The name whose EMPTINESS is being replaced: the rightmost name of the
 * expression that was found empty.
 */
function subjectName(node, depth) {
    if (!node || (depth || 0) > 6) return null;
    switch (node.type) {
        case 'Identifier': return node.name;
        case 'MemberExpression':
            return node.computed
                ? subjectName(node.object, (depth || 0) + 1)
                : (node.property.type === 'Identifier' ? node.property.name : null);
        case 'CallExpression': return calleeName(node.callee);
        case 'LogicalExpression': return subjectName(node.left, (depth || 0) + 1);
        case 'UnaryExpression': return subjectName(node.argument, (depth || 0) + 1);
        case 'BinaryExpression':
            return isEmptyLiteral(node.right)
                ? subjectName(node.left, (depth || 0) + 1)
                : subjectName(node.right, (depth || 0) + 1);
        default: return null;
    }
}

/** Substitutions standing inside one expression, as {line, kind}. */
function substitutionsIn(node, out, depth, watched) {
    out = out || [];
    depth = depth || 0;
    if (!node || typeof node !== 'object' || depth > 40) return out;
    const watchedSubject = (subject) => !watched || (subject && watched.indexOf(subject) >= 0);
    if (node.type === 'LogicalExpression' && (node.operator === '||' || node.operator === '??')) {
        if (!isEmptyLiteral(node.right) && watchedSubject(subjectName(node.left))) {
            out.push({ line: node.right.loc && node.right.loc.start.line, kind: node.operator,
                       field: subjectName(node.left), node: node.right });
        }
    }
    if (node.type === 'ConditionalExpression') {
        const which = isEmptinessTest(node.test);
        if (which) {
            const sub = node[which];
            if (!isEmptyLiteral(sub) && watchedSubject(subjectName(node.test))) {
                out.push({ line: sub.loc && sub.loc.start.line, kind: '?:',
                           field: subjectName(node.test), node: sub });
            }
        }
    }
    Object.keys(node).forEach((k) => {
        if (k === 'loc' || k === 'leadingComments' || k === 'trailingComments') return;
        const v = node[k];
        if (Array.isArray(v)) v.forEach((c) => substitutionsIn(c, out, depth + 1, watched));
        else if (v && typeof v.type === 'string') substitutionsIn(v, out, depth + 1, watched);
    });
    return out;
}

/** The dotted path of a member chain of plain names, or null. */
function pathOf(node) {
    if (!node) return null;
    if (node.type === 'Identifier') return node.name;
    if (node.type === 'ThisExpression') return 'this';
    if (node.type === 'MemberExpression' && !node.computed && node.property.type === 'Identifier') {
        const base = pathOf(node.object);
        return base ? base + '.' + node.property.name : null;
    }
    return null;
}

/**
 * The keys a member path is filed under: the whole path, and its last two
 * segments.
 *
 * The suffix is what makes the export's document object visible. The
 * substitution is written as `data.site.location = …` in one function and
 * printed as `d.site.location` in another, and a guard that files only whole
 * paths sees two unrelated things. Measured: with whole paths alone, planting
 * a coordinate substitute on the report's Location line left this guard green.
 */
function keysForPath(path) {
    if (!path) return [];
    const parts = path.split('.');
    const keys = [path];
    if (parts.length > 2) keys.push(parts.slice(-2).join('.'));
    return keys;
}

/** Every member path mentioned inside an expression. */
function pathsIn(node, out, depth) {
    out = out || new Set();
    depth = depth || 0;
    if (!node || typeof node !== 'object' || depth > 40) return out;
    if (node.type === 'MemberExpression') {
        const p = pathOf(node);
        if (p) keysForPath(p).forEach((k) => out.add(k));
    }
    Object.keys(node).forEach((k) => {
        if (k === 'loc') return;
        const v = node[k];
        if (Array.isArray(v)) v.forEach((c) => pathsIn(c, out, depth + 1));
        else if (v && typeof v.type === 'string') pathsIn(v, out, depth + 1);
    });
    return out;
}

function namesIn(node, out, depth) {
    out = out || new Set();
    depth = depth || 0;
    if (!node || typeof node !== 'object' || depth > 40) return out;
    if (node.type === 'Identifier') out.add(node.name);
    Object.keys(node).forEach((k) => {
        if (k === 'loc') return;
        const v = node[k];
        if (Array.isArray(v)) v.forEach((c) => namesIn(c, out, depth + 1));
        else if (v && typeof v.type === 'string') namesIn(v, out, depth + 1);
    });
    return out;
}

function calleeName(callee) {
    if (!callee) return null;
    if (callee.type === 'Identifier') return callee.name;
    if (callee.type === 'MemberExpression' && callee.property.type === 'Identifier') return callee.property.name;
    return null;
}

/** Sink expressions of one file: what the file prints or saves. */
function sinksOf(ast) {
    const sinks = [];
    traverse(ast, {
        AssignmentExpression(p) {
            const l = p.node.left;
            if (l.type === 'MemberExpression' && l.property.type === 'Identifier'
                && PRINT_PROPS.indexOf(l.property.name) >= 0) {
                sinks.push({ node: p.node.right, why: l.property.name });
            }
        },
        NewExpression(p) {
            if (calleeName(p.node.callee) !== 'TextRun') return;
            sinks.push({ node: p.node.arguments[0], why: 'TextRun' });
        },
        CallExpression(p) {
            const name = calleeName(p.node.callee);
            if (name === 'TextRun') { sinks.push({ node: p.node.arguments[0], why: 'TextRun' }); return; }
            // fetch(url, { method: 'PATCH', body: … }) — the body is saved
            p.node.arguments.forEach((a) => {
                if (!a || a.type !== 'ObjectExpression') return;
                const method = a.properties.filter((pr) => pr.key && pr.key.name === 'method'
                    && pr.value && pr.value.type === 'StringLiteral'
                    && WRITE_METHODS.indexOf(pr.value.value.toUpperCase()) >= 0)[0];
                if (!method) return;
                const body = a.properties.filter((pr) => pr.key && pr.key.name === 'body')[0];
                if (body) sinks.push({ node: body.value, why: method.value.value.toUpperCase() });
            });
        }
    });
    return sinks;
}

function inventoryOf(file, src, watched) {
    let ast;
    try { ast = parser.parse(src, { sourceType: 'script', errorRecovery: true }); }
    catch (e) { return []; }

    // name -> substitutions it carries
    // Null-prototype maps: a name like `constructor` or `toString` is an
    // ordinary identifier in this code and must not inherit an answer.
    const carries = Object.create(null);
    const add = (name, subs) => {
        if (!name || !subs.length) return false;
        const seen = carries[name] || (carries[name] = []);
        let grew = false;
        subs.forEach((s) => {
            if (!seen.some((o) => o.line === s.line && o.kind === s.kind)) { seen.push(s); grew = true; }
        });
        return grew;
    };
    const PARAMS = Object.create(null);
    traverse(ast, {
        FunctionDeclaration(p) { if (p.node.id) PARAMS[p.node.id.name] = p.node.params; },
        VariableDeclarator(p) {
            if (p.node.id.type === 'Identifier' && p.node.init && /Function/.test(p.node.init.type)) {
                PARAMS[p.node.id.name] = p.node.init.params;
            }
        },
        ObjectProperty(p) {
            const k = p.node.key;
            const kn = k.type === 'Identifier' ? k.name : (k.type === 'StringLiteral' ? k.value : null);
            if (kn && /Function/.test(p.node.value.type)) PARAMS[kn] = p.node.value.params;
        }
    });
    const carried = (node) => {
        const subs = substitutionsIn(node, [], 0, watched);
        namesIn(node).forEach((n) => { (carries[n] || []).forEach((s) => subs.push(s)); });
        pathsIn(node).forEach((n) => { (carries[n] || []).forEach((s) => subs.push(s)); });
        return subs;
    };

    let grew = true;
    let rounds = 0;
    while (grew && rounds < 5) {
        grew = false; rounds++;
        traverse(ast, {
            VariableDeclarator(p) {
                if (p.node.id.type !== 'Identifier' || !p.node.init) return;
                if (add(p.node.id.name, carried(p.node.init))) grew = true;
            },
            AssignmentExpression(p) {
                if (p.node.left.type === 'Identifier') {
                    if (add(p.node.left.name, carried(p.node.right))) grew = true;
                    return;
                }
                // `data.site.location = name || <substitute>` — the document
                // object is filled field by field in one function and printed
                // in another, so the field itself has to carry what was put
                // into it.
                if (p.node.left.type !== 'MemberExpression') return;
                const subs = carried(p.node.right);
                keysForPath(pathOf(p.node.left)).forEach((k) => { if (add(k, subs)) grew = true; });
            },
            ReturnStatement(p) {
                if (!p.node.argument) return;
                const fp = p.getFunctionParent();
                const name = fp && ((fp.node.id && fp.node.id.name)
                    || (fp.parent && fp.parent.type === 'VariableDeclarator' && fp.parent.id.type === 'Identifier' && fp.parent.id.name)
                    || (fp.parent && fp.parent.type === 'ObjectProperty' && fp.parent.key.type === 'Identifier' && fp.parent.key.name));
                if (name && add(name, carried(p.node.argument))) grew = true;
            },
            CallExpression(p) {
                const name = calleeName(p.node.callee);
                const params = name && PARAMS[name];
                if (!params) return;
                p.node.arguments.forEach((a, i) => {
                    if (params[i] && params[i].type === 'Identifier' && add(params[i].name, carried(a))) grew = true;
                });
            }
        });
    }

    // The substitute's own SOURCE TEXT is what the record is keyed by, not its
    // line: a line number moves when anything above it is edited, and a
    // ratchet that reddens on an unrelated edit is a ratchet nobody keeps. The
    // line is carried beside it, as information for the report.
    const text = (node) => src.slice(node.start, node.end).replace(/\s+/g, ' ').trim().slice(0, 90);
    const found = [];
    const seen = new Set();
    sinksOf(ast).forEach((sink) => {
        carried(sink.node).forEach((s) => {
            if (s.line == null || !s.node) return;
            const signature = [file, s.field, s.kind, sink.why, text(s.node)].join(' | ');
            if (seen.has(signature)) return;
            seen.add(signature);
            found.push({ file: file, field: s.field, kind: s.kind, sink: sink.why,
                         text: text(s.node), line: s.line, signature: signature });
        });
    });
    return found.sort((a, b) => (a.signature < b.signature ? -1 : 1));
}

function inventory(assetsDir, watched) {
    const out = [];
    fs.readdirSync(assetsDir)
        .filter((f) => /\.js$/.test(f) && !/\.min\.js$/.test(f))
        .sort()
        .forEach((f) => {
            const src = fs.readFileSync(path.join(assetsDir, f), 'utf8');
            inventoryOf(f, src, watched).forEach((x) => out.push(x));
        });
    return out.sort();
}

module.exports = { inventory, inventoryOf, isEmptyLiteral, isEmptinessTest, subjectName };

/**
 * The fields whose EMPTINESS this inventory watches, derived from the one
 * table that says which fields a site has — `FIELD_PATHS` in
 * nutrition-program-inputs.js — rather than listed here by hand. A field added
 * to the ownership table is watched from that moment, which is the point: a
 * second list would be a second source and would fall behind the first.
 *
 * Both halves of each entry are watched: the resolver's own name for the field
 * (`locationName`) and the name it carries in its store (`location_name`), so
 * that a read of either shape is seen.
 */
const WATCH_ALIASES = Object.freeze({
    // The site-list row's word for the site's name; the card and the switcher
    // read it, and neither goes through the ownership table.
    label: 'the site-list row\'s name for a site',
    // Not a stored field — derived from the site's coordinates (fourteenth
    // refinement) — but the substitute it used to have, 'uk_ireland', is the
    // very shape this inventory is about.
    region: 'derived from the coordinates; its substitute was uk_ireland'
});

/** Not watched: a sample is a record, not a value that can be printed empty. */
const WATCH_EXCLUDED = Object.freeze(['soilSample', 'tissueSample', 'waterSample', 'soil', 'tissue', 'water']);

function watchedFields(programInputsSrc) {
    const start = programInputsSrc.indexOf('const FIELD_PATHS = Object.freeze({');
    if (start < 0) throw new Error('FIELD_PATHS not found in nutrition-program-inputs.js');
    const end = programInputsSrc.indexOf('\n    });', start);
    const block = programInputsSrc.slice(start, end);
    const names = new Set();
    const entry = /^\s{8}([A-Za-z0-9_]+):\s*\[([^\]]*)\]/gm;
    let m;
    while ((m = entry.exec(block)) !== null) {
        names.add(m[1]);
        const parts = m[2].split(',').map((x) => x.trim().replace(/^'|'$/g, ''));
        const storePath = parts[1] || '';
        const last = storePath.split('.').pop();
        if (last) names.add(last);
    }
    Object.keys(WATCH_ALIASES).forEach((a) => names.add(a));
    WATCH_EXCLUDED.forEach((x) => names.delete(x));
    return Array.from(names).sort();
}

module.exports.watchedFields = watchedFields;
module.exports.WATCH_ALIASES = WATCH_ALIASES;
module.exports.WATCH_EXCLUDED = WATCH_EXCLUDED;

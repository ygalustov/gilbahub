'use strict';

/**
 * GH-722 — WHERE CODE READS A SAMPLE'S STORED COLUMNS ITSELF, INSTEAD OF THROUGH THE LAB READING NAMES.
 *
 * A reading of a sample is meant to be taken through the one map (`assets/lab-reading-names.json`):
 * the runner's `readingsOf`, or the server's `LabReadingNames::recognise`. A place that reads the
 * sample's columns by name itself (`payload['pH_Water'] ?? payload['pH']`) keeps a second rule for
 * spellings, and the map stops being the only one. This finds such places by what they do, not by
 * which names they use: a value taken from a sample's `payload` or `rawData` is followed into a
 * variable, and every column read off that variable by a name is listed.
 *
 *   - JavaScript (`assets/*.js`, minified excluded): parsed; a variable whose initial value or
 *     assigned value contains a `.payload` or `.rawData` member is a sample variable, identified by
 *     its binding, so two variables of one name in two functions are not joined; a read is
 *     `v.X`, `v['X']`, or `v[<computed>]` (listed as `<computed>`), and so is `s.payload.X`;
 *   - PHP (`app/app`): a variable assigned from `->payload` or `['payload']`, and every parameter
 *     or variable called `$payload`; a read is `$v['X']`, or `$v[$name]` (listed as `<computed>`).
 *
 * WHAT IT DOES NOT SEE, said rather than left to be found: views (`*.blade.php` inline scripts);
 * a sample handed through a function parameter under another name in JavaScript; a column name
 * built by computation is listed but not resolved. Each entry names file, function, variable and
 * column — no line numbers, which move on the next edit.
 */

const fs = require('fs');
const path = require('path');
const parser = require('@babel/parser');
const traverse = require('@babel/traverse').default;

const ROOT = path.join(__dirname, '..', '..');
const CARRIERS = new Set(['payload', 'rawData']);

function carriesSample(node) {
    let found = false;
    (function walk(n) {
        if (!n || found || typeof n !== 'object') return;
        if (n.type === 'MemberExpression' && !n.computed && n.property && CARRIERS.has(n.property.name)) { found = true; return; }
        if (n.type === 'MemberExpression' && n.computed && n.property && n.property.type === 'StringLiteral' && CARRIERS.has(n.property.value)) { found = true; return; }
        if (/Function/.test(n.type)) return;
        Object.keys(n).forEach((k) => { if (k !== 'loc' && k !== 'start' && k !== 'end') { const v = n[k]; if (Array.isArray(v)) v.forEach(walk); else if (v && typeof v.type === 'string') walk(v); } });
    }(node));

    return found;
}

function keyOf(member) {
    if (!member.computed) return member.property.name;
    if (member.property.type === 'StringLiteral') return member.property.value;

    return '<computed>';
}

function jsReads(rel, src) {
    let ast;
    try { ast = parser.parse(src, { sourceType: 'script', errorRecovery: true, plugins: [] }); } catch (e) { return []; }
    const bindings = new Set();
    traverse(ast, {
        VariableDeclarator(p) {
            if (p.node.id.type === 'Identifier' && p.node.init && carriesSample(p.node.init)) {
                const b = p.scope.getBinding(p.node.id.name);
                if (b) bindings.add(b);
            }
        },
        AssignmentExpression(p) {
            if (p.node.left.type === 'Identifier' && carriesSample(p.node.right)) {
                const b = p.scope.getBinding(p.node.left.name);
                if (b) bindings.add(b);
            }
        },
    });
    const out = [];
    const fnName = (p) => {
        const f = p.getFunctionParent();
        if (!f) return '<top level>';
        const n = f.node;
        if (n.id && n.id.name) return n.id.name;
        if (f.parent && f.parent.type === 'VariableDeclarator' && f.parent.id.name) return f.parent.id.name;
        if (f.parent && f.parent.type === 'ObjectProperty' && f.parent.key) return f.parent.key.name || f.parent.key.value;
        if (f.parent && f.parent.type === 'AssignmentExpression') {
            const l = f.parent.left;
            return l.type === 'MemberExpression' && !l.computed ? l.property.name : '<anonymous>';
        }

        return '<anonymous>';
    };
    traverse(ast, {
        MemberExpression(p) {
            const obj = p.node.object;
            // `x.payload.K` / `x.rawData['K']`
            if (obj.type === 'MemberExpression' && !obj.computed && obj.property && CARRIERS.has(obj.property.name)) {
                out.push([rel, fnName(p), '.' + obj.property.name, keyOf(p.node)].join(' | '));
                return;
            }
            if (obj.type !== 'Identifier') return;
            const b = p.scope.getBinding(obj.name);
            if (!b || !bindings.has(b)) return;
            // The variable being assigned to, or a method called on it, is not a column read.
            if (p.parent.type === 'CallExpression' && p.parent.callee === p.node) return;
            out.push([rel, fnName(p), obj.name, keyOf(p.node)].join(' | '));
        },
    });

    return out;
}

function phpReads(rel, src) {
    const vars = new Set(['payload']);
    const assign = /\$(\w+)\s*=\s*[^;]*?(->payload\b|\['payload'\])/g;
    let m;
    while ((m = assign.exec(src)) !== null) vars.add(m[1]);
    const out = [];
    // A quoted column, or a column held in a variable (listed as `<computed>`, as in JavaScript).
    const read = /\$(\w+)\[\s*(?:'([^']+)'|\$\w+)\s*\]/g;
    const lines = src.split('\n');
    let fn = '<top level>';
    lines.forEach((line) => {
        const f = /function\s+(\w+)\s*\(/.exec(line);
        if (f) fn = f[1];
        let r;
        read.lastIndex = 0;
        while ((r = read.exec(line)) !== null) {
            // An assignment INTO the variable is a write, not a read.
            const after = line.slice(r.index + r[0].length);
            if (/^\s*=(?!=)/.test(after)) continue;
            if (vars.has(r[1])) out.push([rel, fn, '$' + r[1], r[2] === undefined ? '<computed>' : r[2]].join(' | '));
        }
    });

    return out;
}

function walk(dir, test, acc) {
    fs.readdirSync(dir, { withFileTypes: true }).forEach((e) => {
        const p = path.join(dir, e.name);
        if (e.isDirectory()) walk(p, test, acc);
        else if (test(e.name)) acc.push(p);
    });

    return acc;
}

/** Every direct read, sorted and de-duplicated, with the files looked at. */
function directReads() {
    const js = walk(path.join(ROOT, 'assets'), (n) => n.endsWith('.js') && !n.endsWith('.min.js'), []);
    const php = walk(path.join(ROOT, 'app', 'app'), (n) => n.endsWith('.php'), []);
    const reads = new Set();
    js.forEach((f) => jsReads(path.relative(ROOT, f), fs.readFileSync(f, 'utf8')).forEach((r) => reads.add(r)));
    php.forEach((f) => phpReads(path.relative(ROOT, f), fs.readFileSync(f, 'utf8')).forEach((r) => reads.add(r)));

    return { reads: Array.from(reads).sort(), filesScanned: js.length + php.length };
}

module.exports = { directReads, jsReads, phpReads };

/**
 * GH-510 — "not computed" survives all the way to the page, and the document
 * says nothing rather than nought.
 *
 * The reviewer's finding: GH-498 made the two leaves return null where the
 * growth-potential engine cannot compute, and nothing held it. His mutation —
 * `: 0` put back in `calcC4GrowthPotential` — left the whole suite green. His
 * words: "it is not meaningless, it is invisible". And he showed why it would
 * stay invisible even with a guard on the leaves alone: one line above them
 * `weighted` is built by arithmetic, and `null + null` is 0 in JavaScript, so
 * the null is turned back into a number before any consumer sees it.
 *
 * ── Passport ────────────────────────────────────────────────────────────────
 * guarantee   Where the temperature is missing, no growth potential is printed
 *             — neither 0% nor any other number.
 * claims      By EFFECT, over the finished `word/document.xml`: with the page's
 *             climate metrics carrying nulls, `data.climate.growthPotential` is
 *             null and no "Growth Potential" row is printed; with numbers, it
 *             is. Structurally, over the AST of hub-tissue-v3.js: each of the
 *             two leaves answers `null` in its fallback, and each of the two
 *             places that combine them refuses to combine a null.
 * universe    GH-515: DERIVED, not written down. Every asset a blade loads that
 *             declares one of the producer names at the top level, read off
 *             app/resources/views/**.blade.php in load order — which also says
 *             which declaration wins the global name on each page, since these
 *             are classic scripts sharing one scope. The list was two files
 *             written by hand, both of them the same file, and the reviewer
 *             removed this ticket's guard from the OTHER copy with the whole
 *             suite staying green: "yesterday the fix went into the losing
 *             copy; today the whole guard lives in the losing copy. Nobody
 *             checks the file that executes." A hand-written list of two is
 *             walked around by a third file exactly as this one was walked
 *             around by a second.
 * unit        One value on that chain — a function's fallback, one
 *             ObjectProperty named `weighted`, a table row. Narrowed twice
 *             while writing, both times because the first shape measured the
 *             rule rather than the product: "any function mentioning the engine
 *             and naming a weighted" swept in a twelve-hundred-line renderer,
 *             and "any null test with a numeric fallback" swept in a utilisation
 *             percentage. Now: the INNERMOST qualifying function, and only a
 *             value that is engine-derived, followed through variables.
 * moment      The effect half at collection and printing; the structural half
 *             at parse.
 * distinguishability  Two runs of the same document differing only in whether
 *             the climate metrics carry numbers or nulls; the positive control
 *             is the numeric one.
 * carrier     For the claim about the client: the text of `word/document.xml`.
 *             For the claim about the chain: the syntax tree — the null cannot
 *             be reached from the sandbox, because the producers are page
 *             functions this harness does not load, and a claim that cannot be
 *             exercised is said structurally rather than pretended.
 * ПОТРЕБИТЕЛЬ  `word-export.js:8518-8527` (the climate block) and the row it
 *             prints. Observable effect: the "Growth Potential (C3)" line in
 *             the produced .docx — measured live at 0% before GH-498/GH-510.
 * input       The climate metrics object the page publishes, in both shapes.
 * positive-control  The numeric run: the row IS printed and carries the number.
 * exemptions  GH-515: one, in WEIGHTED_EXEMPTIONS below, anchored on
 *             (file, enclosing function, property line) and carrying its own
 *             `until`. It holds a third unguarded combiner this very ticket
 *             missed. An exemption matching nothing fails the test.
 * ratchet     None.
 * rc          The reviewer's mutations, shown red against the real tree:
 *             `: 0` in either leaf; arithmetic on the leaves without the null
 *             guard in either combiner; GH-515 — the guard removed from
 *             mlsn-progressive-disclosure.js, the copy that wins the global
 *             name on every page that can build a document; and a THIRD
 *             top-level declaration of the same name in a new file loaded after
 *             it, which the derived universe picks up with no list edited.
 */

'use strict';

const fs = require('fs');
const path = require('path');
const parser = require('@babel/parser');
const traverse = require('@babel/traverse').default;
const { loadPage, SITE_ID } = require('./helpers/export-page-sandbox');

const HUB = path.join(__dirname, '..', 'assets', 'hub-tissue-v3.js');

/**
 * The climate section's own text — the occurrence of the heading that is NOT
 * the Contents bullet. The name appears twice in the document, and taking the
 * first one lands in the table of contents, where no row is ever printed:
 * measured, that made the positive control fail while the section was there.
 */
function climateSection(text) {
    const needle = 'Climate & Growth Conditions';
    for (let i = text.indexOf(needle); i >= 0; i = text.indexOf(needle, i + 1)) {
        if (text.slice(Math.max(0, i - 2), i) !== '\u2022 ') return text.slice(i, i + 600);
    }
    return '';
}

async function documentText(sandbox, data) {
    const sections = sandbox.GAIP_WordExport.buildSections(data, {});
    const doc = new sandbox.docx.Document({ sections: [{ properties: {}, children: sections }] });
    const blob = await sandbox.docx.Packer.toBlob(doc);
    const zip = await sandbox.JSZip.loadAsync(Buffer.from(await blob.arrayBuffer()));
    const xml = await zip.file('word/document.xml').async('string');
    // `&amp;` is unescaped: the section is headed "Climate & Growth
    // Conditions", and a search for that string against the raw XML finds
    // nothing — which reads as "the section is absent" when it is present.
    return xml.replace(/<\/w:p>/g, '\n').replace(/<\/w:tc>/g, '\t').replace(/<[^>]+>/g, '')
        .replace(/&amp;/g, '&');
}

/** Both leaves, by name, with what their fallback answers. */
function leafFallbacks(src) {
    const ast = parser.parse(src, { sourceType: 'script' });
    const out = {};
    traverse(ast, {
        FunctionDeclaration(p) {
            const name = p.node.id && p.node.id.name;
            if (name !== 'calcC3GrowthPotential' && name !== 'calcC4GrowthPotential') return;
            let answer = '(no conditional return)';
            p.traverse({
                ReturnStatement(r) {
                    const arg = r.node.argument;
                    if (!arg || arg.type !== 'ConditionalExpression') return;
                    const alt = arg.alternate;
                    answer = alt.type === 'NullLiteral' ? 'null'
                        : (alt.type === 'NumericLiteral' ? String(alt.value) : alt.type);
                }
            });
            out[name] = answer;
        }
    });
    return out;
}

/**
 * Every place that builds a `weighted` value out of the two leaves, and whether
 * a null is refused before the arithmetic.
 *
 * The unit is deliberately "a function that calls both leaves AND names a
 * `weighted` property", not "a function that calls both leaves". Measured while
 * writing this: two others call both — `generateGrowthChart_OLD_NOT_USED`
 * (hub-tissue-v3.js:2154) and `generateGrowthChart` (hub-tissue-v3.js:4617) —
 * and they build chart series, not the number the document prints. They are
 * named in the GH-510 report as found and not fixed; this ticket changes what
 * it was asked to change.
 */
function combiners(src) {
    const ast = parser.parse(src, { sourceType: 'script' });
    const found = [];
    const calls = (node) => {
        const names = [];
        traverse(node, {
            noScope: true,
            CallExpression(p) { if (p.node.callee && p.node.callee.name) names.push(p.node.callee.name); }
        }, undefined, {});
        return names;
    };
    traverse(ast, {
        Function(p) {
            const src3 = calls(p.node);
            if (src3.indexOf('calcC3GrowthPotential') < 0 || src3.indexOf('calcC4GrowthPotential') < 0) return;
            // …and that names a `weighted` value — the one the export reads.
            let buildsWeighted = false;
            p.traverse({
                ObjectProperty(o) {
                    const k = o.node.key;
                    if (k && (k.name === 'weighted' || k.value === 'weighted')) buildsWeighted = true;
                }
            });
            if (!buildsWeighted) return;
            // Inside such a function, does anything guard on null before the
            // two are combined? Read as: is there a conditional whose test
            // mentions a null comparison.
            let guarded = false;
            p.traverse({
                ConditionalExpression(c) {
                    const test = c.node.test;
                    const text = JSON.stringify(test);
                    if (/"NullLiteral"/.test(text) || /"value":null/.test(text)) guarded = true;
                }
            });
            found.push({
                line: p.node.loc ? p.node.loc.start.line : null,
                name: (p.node.id && p.node.id.name) || '(anonymous)',
                guarded: guarded
            });
        }
    });
    return found;
}


// ── GH-515: the universe is derived from the load order, not written here ────
//
// The reviewer's mutation removed this ticket's guard from
// assets/mlsn-progressive-disclosure.js and the whole suite stayed green: both
// this file and gh511 parsed assets/hub-tissue-v3.js and nothing else, while
// the copy that actually runs lives in the other file. His words: "yesterday
// the fix went into the losing copy; today the whole guard lives in the losing
// copy. Nobody checks the file that executes."
//
// A hand-written list of two would be walked around by a third file exactly as
// this one was walked around by a second. So the list is computed: every asset
// a page loads that DECLARES one of the producer names at the top level. A
// third declaration in a third file arrives in the set by itself.

const VIEWS = path.join(__dirname, '..', 'app', 'resources', 'views');
const PRODUCER_NAMES = ['calcMixedGrowthPotential', 'calcC3GrowthPotential', 'calcC4GrowthPotential'];

/** Every blade, with the asset scripts it names, in the order it names them. */
function loadOrderByPage() {
    const pages = {};
    (function walk(dir) {
        fs.readdirSync(dir, { withFileTypes: true }).forEach((e) => {
            const full = path.join(dir, e.name);
            if (e.isDirectory()) return walk(full);
            if (!/\.blade\.php$/.test(e.name)) return;
            const src = fs.readFileSync(full, 'utf8');
            const scripts = [];
            const re = /['"]([a-z0-9_.\/-]+\.js)['"]/gi;
            let m;
            while ((m = re.exec(src))) if (scripts.indexOf(m[1]) < 0) scripts.push(m[1]);
            if (scripts.length) pages[path.relative(VIEWS, full)] = scripts;
        });
    })(VIEWS);
    return pages;
}

/** Which top-level function names a file declares, out of the ones we care about. */
function declaresProducers(file) {
    const full = path.join(__dirname, '..', 'assets', path.basename(file));
    if (!fs.existsSync(full)) return null;
    let ast;
    try { ast = parser.parse(fs.readFileSync(full, 'utf8'), { sourceType: 'script', errorRecovery: true }); }
    catch (e) { return { file: path.basename(file), parseError: String(e.message).slice(0, 80), names: [] }; }
    const names = [];
    traverse(ast, {
        FunctionDeclaration(p) {
            const n = p.node.id && p.node.id.name;
            if (PRODUCER_NAMES.indexOf(n) >= 0 && names.indexOf(n) < 0) names.push(n);
        }
    });
    return { file: path.basename(file), names: names };
}

/**
 * The derived universe: every asset loaded by some page that declares one of
 * the producer names, plus, per page, which declaration wins — the last one
 * loaded, because these are classic scripts sharing one global scope.
 */
function derivedUniverse() {
    const pages = loadOrderByPage();
    const filesSeen = {};
    const winners = {};
    Object.keys(pages).forEach((page) => {
        let winner = null;
        pages[page].forEach((script) => {
            const d = declaresProducers(script);
            if (!d || !d.names.length) return;
            filesSeen[d.file] = d.names;
            if (d.names.indexOf('calcMixedGrowthPotential') >= 0) winner = d.file;
        });
        if (winner) winners[page] = winner;
    });
    return { files: Object.keys(filesSeen).sort(), declares: filesSeen, winnerByPage: winners, pages: pages };
}

const nodeMentionsNull = (node) => {
    let hit = false;
    (function walk(n) {
        if (hit || !n || typeof n !== 'object') return;
        if (Array.isArray(n)) return n.forEach(walk);
        if (n.type === 'NullLiteral') { hit = true; return; }
        if (n.type === 'Identifier' && n.name === 'undefined') { hit = true; return; }
        Object.keys(n).forEach((k) => {
            if (k === 'loc' || k === 'start' || k === 'end' || k === 'leadingComments'
                || k === 'trailingComments' || k === 'innerComments') return;
            walk(n[k]);
        });
    })(node);
    return hit;
};

/**
 * Every function in a file that consults the growth-potential engine — directly
 * through `GilbaGrowthPotentialEngine.compute`, or through one of the leaves —
 * with the two things this ticket claims about it.
 *
 * Phrased to fit BOTH shapes, because the two copies are written differently:
 * hub-tissue-v3.js has named leaf functions, mlsn-progressive-disclosure.js
 * calls the engine inline. A rule that only knew the first shape is how the
 * second went unguarded.
 */
function gpProducers(src, label) {
    let ast;
    try { ast = parser.parse(src, { sourceType: 'script', errorRecovery: true }); }
    catch (e) { return [{ file: label, name: '(unparsed)', parseError: String(e.message).slice(0, 80) }]; }
    const out = [];
    traverse(ast, {
        Function(p) {
            let consultsEngine = false;
            const numericOnNull = [];
            const weightedProps = [];
            const combinedVars = {};
            const declInits = {};
            p.traverse({
                MemberExpression(m) {
                    const o = m.node.object, pr = m.node.property;
                    if (pr && pr.name === 'compute' && o
                        && (o.name === 'GPE' || o.name === 'GilbaGrowthPotentialEngine'
                            || (o.type === 'MemberExpression' && o.property
                                && o.property.name === 'GilbaGrowthPotentialEngine'))) consultsEngine = true;
                },
                CallExpression(c) {
                    const n = c.node.callee && c.node.callee.name;
                    if (n === 'calcC3GrowthPotential' || n === 'calcC4GrowthPotential') consultsEngine = true;
                },
                // CLAIM A, as a node: a null test whose null-side branch is a number.
                ConditionalExpression(c) {
                    const t = c.node.test;
                    if (!t || !nodeMentionsNull(t)) return;
                    const negative = t.type === 'BinaryExpression'
                        && (t.operator === '!=' || t.operator === '!==');
                    const nullSide = negative ? c.node.alternate : c.node.consequent;
                    if (nullSide && nullSide.type === 'NumericLiteral') {
                        numericOnNull.push({
                            line: c.node.loc ? c.node.loc.start.line : null,
                            value: nullSide.value,
                            test: t
                        });
                    }
                },
                // the variable a combiner builds: whether it refuses a null,
                // and whether its value comes from the engine at all
                VariableDeclarator(d) {
                    if (!d.node.id || d.node.id.type !== 'Identifier' || !d.node.init) return;
                    combinedVars[d.node.id.name] = nodeMentionsNull(
                        d.node.init.type === 'ConditionalExpression' ? d.node.init.test : d.node.init);
                    declInits[d.node.id.name] = d.node.init;
                },
                AssignmentExpression(a) {
                    if (a.node.left && a.node.left.type === 'Identifier' && a.node.right) {
                        declInits[a.node.left.name] = a.node.right;
                        if (!combinedVars[a.node.left.name]) {
                            combinedVars[a.node.left.name] = nodeMentionsNull(
                                a.node.right.type === 'ConditionalExpression'
                                    ? a.node.right.test : a.node.right);
                        }
                    }
                },
                // CLAIM B, as a node: the `weighted` property itself.
                ObjectProperty(o) {
                    const k = o.node.key && (o.node.key.name || o.node.key.value);
                    if (k !== 'weighted') return;
                    const v = o.node.value;
                    const bare = v.type === 'Identifier' ? v.name : null;
                    weightedProps.push({
                        line: o.node.loc ? o.node.loc.start.line : null,
                        guardedHere: v.type === 'ConditionalExpression' && nodeMentionsNull(v.test),
                        carriedBy: bare,
                        value: v
                    });
                }
            });
            // A `weighted` counts only if its value is BUILT FROM an engine
            // answer. Measured while writing this: without it the rule flagged
            // hub-tissue-v3.js:6459, a debug console.log whose object happens to
            // carry a key called `weighted` read straight off window — a claim
            // about a log line dressed as a claim about a calculation.
            // Engine-derivedness is followed through variables, because the two
            // copies are two and three hops deep respectively.
            const mentionsEngine = (node) => {
                let hit = false;
                (function walk(n) {
                    if (hit || !n || typeof n !== 'object') return;
                    if (Array.isArray(n)) return n.forEach(walk);
                    if (n.type === 'Identifier'
                        && (n.name === 'calcC3GrowthPotential' || n.name === 'calcC4GrowthPotential')) {
                        hit = true; return;
                    }
                    if (n.type === 'MemberExpression' && n.property && n.property.name === 'compute') {
                        hit = true; return;
                    }
                    Object.keys(n).forEach((k) => {
                        if (k === 'loc' || k === 'start' || k === 'end') return;
                        walk(n[k]);
                    });
                })(node);
                return hit;
            };
            const derived = {};
            for (let pass = 0; pass < 3; pass++) {
                Object.keys(declInits).forEach((name) => {
                    if (derived[name]) return;
                    const init = declInits[name];
                    if (mentionsEngine(init)) { derived[name] = true; return; }
                    let viaDerived = false;
                    (function walk(n) {
                        if (viaDerived || !n || typeof n !== 'object') return;
                        if (Array.isArray(n)) return n.forEach(walk);
                        if (n.type === 'Identifier' && derived[n.name]) { viaDerived = true; return; }
                        Object.keys(n).forEach((k) => {
                            if (k === 'loc' || k === 'start' || k === 'end') return;
                            walk(n[k]);
                        });
                    })(init);
                    if (viaDerived) derived[name] = true;
                });
            }
            const fromEngine = (w) => {
                if (mentionsEngine(w.value)) return true;
                let hit = false;
                (function walk(n) {
                    if (hit || !n || typeof n !== 'object') return;
                    if (Array.isArray(n)) return n.forEach(walk);
                    if (n.type === 'Identifier' && derived[n.name]) { hit = true; return; }
                    Object.keys(n).forEach((k) => {
                        if (k === 'loc' || k === 'start' || k === 'end') return;
                        walk(n[k]);
                    });
                })(w.value);
                return hit;
            };
            const realWeighted = weightedProps.filter(fromEngine);
            // The same narrowing for claim A. Measured while writing this:
            // without it the rule flagged hub-tissue-v3.js:5400,
            // `te.utilizationPct !== undefined ? te.utilizationPct : 0` — a
            // fallback between two spellings of a utilisation percentage, which
            // has nothing to do with a growth potential the engine could not
            // compute. A rule that counts every null test with a numeric
            // fallback is a rule about the language, not about this claim.
            const realNumericOnNull = numericOnNull.filter((n) => fromEngine({ value: n.test }));
            if (!consultsEngine || !realWeighted.length) return;
            out.push({
                start: p.node.start, end: p.node.end,
                file: label,
                name: (p.node.id && p.node.id.name)
                    || (p.parentPath && p.parentPath.isVariableDeclarator() && p.parentPath.node.id.name)
                    || '(anonymous)',
                line: p.node.loc ? p.node.loc.start.line : null,
                numericOnNull: realNumericOnNull.map((n) => ({ line: n.line, value: n.value })),
                weighted: realWeighted.map((w) => ({
                    line: w.line,
                    guarded: w.guardedHere || (w.carriedBy ? !!combinedVars[w.carriedBy] : false),
                    carriedBy: w.carriedBy
                }))
            });
        }
    });
    // INNERMOST ONLY. Measured while writing this: "any function that mentions
    // the engine somewhere and names a `weighted` somewhere" swept in
    // gaip_render_results (hub-tissue-v3.js:5209), twelve hundred lines that
    // merely CONTAIN both, and reported two unguarded `weighted` properties a
    // thousand lines away from any engine call — plus the literal default block
    // at :947-951, which is not built from an engine answer at all. That was a
    // measurement of my unit, not of the product. A function that has a
    // qualifying function inside it is not the producer; the one inside is.
    return out.filter((a) => !out.some((b) => b !== a && b.start >= a.start && b.end <= a.end));
}


/**
 * Exemptions for the claim below, one per construction, anchored on the AST
 * node (file + enclosing function + the property's own line), each with its own
 * `until`. A stale exemption fails the test rather than passing quietly.
 */
const WEIGHTED_EXEMPTIONS = [
    {
        file: 'hub-tissue-v3.js',
        function: 'gaip_render_results',
        node: "ObjectProperty `weighted` of the `growth` object built into `Ft`",
        what: '`weighted: (calcC3GrowthPotential(ft) + calcC4GrowthPotential(ft)) / 2` '
            + 'with no null refused first — `(null + null) / 2` is 0.',
        why: 'FOUND, NOT FIXED, and it is a miss in GH-510 itself: that ticket said it '
            + 'fixed "the two places that averaged the leaves" and there are three. The '
            + 'old rule passed it because it asked whether ANY conditional anywhere in '
            + 'the enclosing function mentions null, and the enclosing function is '
            + 'twelve hundred lines, so the answer was yes for reasons unrelated to this '
            + 'object. Its `Ft` goes through validateClimateMetrics() and is then '
            + 'normally overwritten by the Climate V2 pre-publish override '
            + '(hub-tissue-v3.js:6965-7011), which returns early when GAIP_ClimateV2 is '
            + 'absent — so the unguarded value is reachable, not dead. The fix is one '
            + 'line and is not made here because this ticket was asked for the guard.',
        until: 'the owner decides on it — it is a product change, and a third combiner '
            + 'appearing means the question is which of them should exist at all'
    }
];
const exemptionKeyOf = (file, fn, line) => file + '|' + fn + '|' + line;
const EXEMPT_LINES = { 'hub-tissue-v3.js|gaip_render_results|6183': WEIGHTED_EXEMPTIONS[0] };

describe('GH-510 — a growth potential that was not computed is not printed', () => {
    jest.setTimeout(120000);
    const src = fs.readFileSync(HUB, 'utf8');



    test('GH-515: every file in the derived universe, no engine answer turned into a number', () => {
        expect.hasAssertions();
        const u = derivedUniverse();
        // The universe is what the blades produce, not a list written above.
        expect(u.files.length).toBeGreaterThan(1);
        const offenders = [];
        u.files.forEach((f) => {
            const src = fs.readFileSync(path.join(__dirname, '..', 'assets', f), 'utf8');
            gpProducers(src, f).forEach((g) => {
                g.numericOnNull.forEach((n) => offenders.push(
                    f + ':' + n.line + ' in ' + g.name + ' answers ' + n.value + ' where the engine answered null'));
            });
            // and the named leaves, where a file has them
            const leaves = leafFallbacks(src);
            Object.keys(leaves).forEach((k) => {
                if (leaves[k] !== 'null') offenders.push(f + ' ' + k + ' answers ' + leaves[k]);
            });
        });
        expect({ filesChecked: u.files, engineAnswersTurnedIntoANumber: offenders })
            .toEqual({ filesChecked: u.files, engineAnswersTurnedIntoANumber: [] });
    });

    test('GH-515: every file in the derived universe, no weighted built without refusing a null', () => {
        expect.hasAssertions();
        const u = derivedUniverse();
        expect(u.files.length).toBeGreaterThan(1);
        const unguarded = [];
        const exemptedSeen = [];
        u.files.forEach((f) => {
            const src = fs.readFileSync(path.join(__dirname, '..', 'assets', f), 'utf8');
            gpProducers(src, f).forEach((g) => {
                g.weighted.forEach((w) => {
                    if (w.guarded) return;
                    const key = exemptionKeyOf(f, g.name, w.line);
                    if (EXEMPT_LINES[key]) { exemptedSeen.push(key); return; }
                    unguarded.push(f + ':' + w.line + ' in ' + g.name);
                });
            });
        });
        expect({ weightedBuiltFromAPossibleNull: unguarded })
            .toEqual({ weightedBuiltFromAPossibleNull: [] });
        // an exemption that no longer matches anything is a hole nobody can see
        expect({ exemptionsMatchingNothing:
            Object.keys(EXEMPT_LINES).filter((k) => exemptedSeen.indexOf(k) < 0) })
            .toEqual({ exemptionsMatchingNothing: [] });
    });

    test('GH-515: the universe is computed from the load order, not written down', () => {
        expect.hasAssertions();
        const u = derivedUniverse();
        // Every file in it is a file some page loads AND that declares one of
        // the producer names — both halves read off disk.
        u.files.forEach((f) => {
            const loadedSomewhere = Object.keys(u.pages)
                .some((page) => u.pages[page].some((sc) => path.basename(sc) === f));
            expect([f, 'loaded by some page', loadedSomewhere]).toEqual([f, 'loaded by some page', true]);
            expect([f, 'declares a producer', u.declares[f].length > 0])
                .toEqual([f, 'declares a producer', true]);
        });
        // And the winner per page is the LAST such file that page loads — the
        // rule these classic scripts actually follow.
        Object.keys(u.winnerByPage).forEach((page) => {
            const loaded = u.pages[page].map((sc) => path.basename(sc))
                .filter((b) => u.declares[b] && u.declares[b].indexOf('calcMixedGrowthPotential') >= 0);
            expect([page, u.winnerByPage[page]]).toEqual([page, loaded[loaded.length - 1]]);
        });
        // Printed, so the set is visible in the output rather than implied.
        process.stdout.write('\n[GH-515] universe from load order: ' + JSON.stringify(u.files)
            + '\n[GH-515] winner per page: ' + JSON.stringify(u.winnerByPage) + '\n');
    });

    test('GH-515 measurement — what the derived universe contains', () => {
        expect.hasAssertions();
        const u = derivedUniverse();
        const L = ['', 'GH-515 — the universe, derived from the blades:'];
        L.push('  files declaring a producer name: ' + JSON.stringify(u.files));
        Object.keys(u.declares).forEach((f) => L.push('     ' + f + ' declares ' + JSON.stringify(u.declares[f])));
        L.push('  winner per page (last declaration loaded wins the global name):');
        Object.keys(u.winnerByPage).sort().forEach((p2) => L.push('     ' + p2 + '  ->  ' + u.winnerByPage[p2]));
        L.push('');
        L.push('  GP producers found in each file of the universe:');
        u.files.forEach((f) => {
            const src = fs.readFileSync(path.join(__dirname, '..', 'assets', f), 'utf8');
            gpProducers(src, f).forEach((g) => {
                L.push('     ' + g.file + ':' + g.line + ' ' + g.name
                    + '  numericOnNull=' + JSON.stringify(g.numericOnNull)
                    + '  weighted=' + JSON.stringify(g.weighted));
            });
        });
        process.stdout.write(L.join('\n') + '\n');
        expect(u.files.length).toBeGreaterThan(0);
    });

    test('both leaves answer null, not a number, when the engine cannot compute', () => {
        expect.hasAssertions();
        expect(leafFallbacks(src)).toEqual({
            calcC3GrowthPotential: 'null',
            calcC4GrowthPotential: 'null'
        });
    });

    test('and nothing combines them without refusing a null first', () => {
        expect.hasAssertions();
        const all = combiners(src);
        expect(all.length).toBeGreaterThan(0);
        const unguarded = all.filter((c) => !c.guarded)
            .map((c) => c.name + ' at line ' + c.line);
        expect({ combinersThatWouldTurnNullIntoZero: unguarded })
            .toEqual({ combinersThatWouldTurnNullIntoZero: [] });
    });

    test('with nulls on the page, the document prints no growth potential', async () => {
        expect.hasAssertions();
        const page = loadPage({ errors: [], warnings: [], alerts: [] });
        expect(page.failures).toEqual([]);
        // The shape the producers now publish where the temperature is missing.
        // The shape the producers now publish where the GROWTH POTENTIAL could
        // not be computed. The temperature is kept — it is a separate reading,
        // and with it the climate section is still printed, so the claim is
        // about the row and not about a section that vanished for other
        // reasons. (Measured while writing this: with the temperature null too,
        // the whole section goes, and a test asserting the row's absence would
        // pass for the wrong reason.)
        page.sandbox.climateMetrics = {
            temperature: { mean: 8.5, max: 17.8, min: 0.2, current: 5.6 },
            growth: { c3: null, c4: null, weighted: null }
        };
        const data = page.sandbox.GAIP_WordExport.collectData(
            page.sandbox.GAIP_NutritionProgramInputs.resolveExportInputs({ siteId: SITE_ID }));
        expect(data.climate.growthPotential == null).toBe(true);
        const text = await documentText(page.sandbox, data);
        // In the climate section, where the client reads it. The words appear
        // elsewhere in the document — the glossary, the PACE citation — and a
        // document-wide search would be about those.
        const climate = climateSection(text);
        expect({
            sectionFound: climate.length > 0,
            temperatureRow: /Temperature/.test(climate),
            growthPotentialRow: /Growth Potential/.test(climate)
        }).toEqual({ sectionFound: true, temperatureRow: true, growthPotentialRow: false });
    });

    test('positive control: with numbers on the page, it prints the number', async () => {
        expect.hasAssertions();
        const page = loadPage({ errors: [], warnings: [], alerts: [] });
        page.sandbox.climateMetrics = {
            temperature: { mean: 12.5, max: 18, min: 6, current: 11 },
            growth: { c3: 47, c4: 9, weighted: 47 }
        };
        const data = page.sandbox.GAIP_WordExport.collectData(
            page.sandbox.GAIP_NutritionProgramInputs.resolveExportInputs({ siteId: SITE_ID }));
        expect(data.climate.growthPotential).toBe(47);
        const text = await documentText(page.sandbox, data);
        const climate = climateSection(text);
        expect({ growthPotentialRow: /Growth Potential/.test(climate), number: /47%/.test(climate) })
            .toEqual({ growthPotentialRow: true, number: true });
    });
});

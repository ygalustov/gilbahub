/**
 * GH-468 (PLAN-GH439 section 10.6, seventh refinement, point 1) — the site a
 * document is about is named by its caller, never by where the page points.
 *
 * The defect this closes was live for a client and is not the one GH-467
 * closed. GH-467 refuses when inputs are ABSENT. Here inputs arrived and were
 * another site's: both resolvers ended `opts.siteId || getActiveSiteId()`, and
 * the combined export walks sites one at a time, so the page's site is the
 * wrong site on every iteration but the last. Measured on the stand — the page
 * pointing at a Christchurch site while a Test5 sample was exported — the
 * document said "Species: Couch" in seven places and carried no nutrition
 * programme table at all.
 *
 * One call site passing `entry.siteId` would have fixed that one call and left
 * the fallback for the next caller to find, so what is checked here is the
 * shape rather than the instance: the resolvers refuse, the page's active site
 * is read in exactly one place, and no wrapper quietly drops the argument on
 * its way through.
 */
'use strict';

const fs = require('fs');
const path = require('path');
const parser = require('@babel/parser');
const traverse = require('@babel/traverse').default;
const { loadPage, SITE_ID } = require('./helpers/export-page-sandbox');

const ASSETS = path.join(__dirname, '..', 'assets');
const read = (f) => fs.readFileSync(path.join(ASSETS, f), 'utf8');

describe('GH-468 — both resolvers require the site they answer for', () => {
    let NPI;

    beforeAll(() => {
        const page = loadPage({ errors: [], warnings: [], alerts: [] });
        expect(page.failures).toEqual([]);
        NPI = page.sandbox.GAIP_NutritionProgramInputs;
    });

    test.each([
        ['resolveExportInputs'],
        ['resolveSiteProgramInputs']
    ])('%s throws without a siteId rather than answering for the page', (fn) => {
        expect(() => NPI[fn]({})).toThrow(/siteId is required/);
        expect(() => NPI[fn]()).toThrow(/siteId is required/);
        expect(() => NPI[fn]({ siteId: '' })).toThrow(/siteId is required/);
        expect(() => NPI[fn]({ siteId: null })).toThrow(/siteId is required/);
    });

    test('a named site is answered for, and it is the site that was named', () => {
        const resolved = NPI.resolveExportInputs({ siteId: SITE_ID });
        expect(resolved.site.id).toBe(SITE_ID);
    });

    test('a site that does not exist resolves to nothing, it does not fall back', () => {
        // The other half of the same rule: an id nobody knows is an unresolved
        // site, not an invitation to use the page's.
        const resolved = NPI.resolveExportInputs({ siteId: 'no-such-site' });
        expect(resolved.site.id).toBe('no-such-site');
        expect(resolved.turf.species).toBeNull();
        expect(resolved.sources.species).toBe('unresolved');
    });

    test('neither resolver body reaches for the page\'s active site', () => {
        // Read out of the source rather than trusted: the throw above can be
        // satisfied while a fallback lives further down the same function.
        const src = read('nutrition-program-inputs.js');
        const ast = parser.parse(src, { sourceType: 'script', errorRecovery: true });
        const offenders = [];
        traverse(ast, {
            FunctionDeclaration(p) {
                const name = p.node.id && p.node.id.name;
                if (['resolveExportInputs', 'resolveSiteProgramInputs'].indexOf(name) < 0) return;
                p.traverse({
                    CallExpression(c) {
                        const callee = c.node.callee;
                        const called = callee.type === 'Identifier' ? callee.name
                            : (callee.type === 'MemberExpression' && callee.property.type === 'Identifier'
                                ? callee.property.name : null);
                        if (called === 'getActiveSiteId') {
                            offenders.push(name + ' calls getActiveSiteId at line ' +
                                (c.node.loc ? c.node.loc.start.line : '?'));
                        }
                    }
                });
            }
        });
        expect({ offenders: offenders }).toEqual({ offenders: [] });
    });
});

describe('GH-468 — the page\'s active site is read in one place, and it is the single export', () => {
    test('the combined loop resolves from the entry it is iterating, not from the page', () => {
        const src = read('word-export-combined.js');
        expect(src).toMatch(/resolveExportInputs\(\{\s*siteId:\s*entry\.siteId/);
        expect(src).toMatch(/we\.collectData\(_entryInputs\)/);
        // The bare call is what sent the resolver to the page. Comments are
        // stripped first: this file explains the old call in prose, and a
        // guard that reads its own explanation as code is checking the wrong
        // thing.
        const code = src.replace(/\/\/[^\n]*/g, '').replace(/\/\*[\s\S]*?\*\//g, '');
        expect(code).not.toMatch(/\.collectData\(\s*\)/);
    });

    test('the single export names the active site itself, where the page\'s site IS the document\'s', () => {
        const src = read('word-export.js');
        expect(src).toMatch(/_NPIexp\.resolveExportInputs\(\{ siteId: _activeSiteId \}\)/);
        expect(src).toMatch(/GAIP_WordExport\.collectData\(_exportInputsForDoc\)/);
    });

    test('collectData refuses a call that names no site instead of resolving one', () => {
        const page = loadPage({ errors: [], warnings: [], alerts: [] });
        expect(page.failures).toEqual([]);
        expect(() => page.sandbox.GAIP_WordExport.collectData()).toThrow(/inputs are required/);
        // An empty object is not inputs either — that shape is exactly what a
        // wrapper's `options = options || {}` used to manufacture.
        expect(() => page.sandbox.GAIP_WordExport.collectData({})).toThrow(/inputs are required/);
    });
});

describe('GH-468 — a wrapper passes the argument through', () => {
    /**
     * Every file in assets/ that replaces GAIP_WordExport.collectData, and
     * whether its replacement hands its own first argument to the original.
     *
     * Derived rather than listed: a third wrapper appearing in a module nobody
     * expected is caught by being found, not by someone remembering to add it.
     */
    function wrappers() {
        return fs.readdirSync(ASSETS)
            .filter((f) => /\.js$/.test(f) && !/\.min\.js$/.test(f))
            .map((f) => ({ file: f, src: read(f) }))
            .filter((e) => /\.collectData\s*=/.test(e.src))
            .map((e) => {
                const ast = parser.parse(e.src, { sourceType: 'script', errorRecovery: true });
                const found = [];
                traverse(ast, {
                    AssignmentExpression(p) {
                        const left = p.node.left;
                        if (left.type !== 'MemberExpression' || left.property.type !== 'Identifier') return;
                        if (left.property.name !== 'collectData') return;
                        const fn = p.node.right;
                        if (fn.type !== 'FunctionExpression' && fn.type !== 'ArrowFunctionExpression') return;
                        const first = fn.params.length && fn.params[0].type === 'Identifier'
                            ? fn.params[0].name : null;
                        let passes = false;
                        let rewrites = false;
                        p.traverse({
                            CallExpression(c) {
                                if (!first) return;
                                // `orig(x)` or `orig.call(this, x)` — the
                                // argument must arrive somewhere in the call.
                                const args = c.node.arguments;
                                if (args.some((a) => a.type === 'Identifier' && a.name === first)) passes = true;
                            },
                            AssignmentExpression(a) {
                                // `options = options || {}` turns a call with
                                // no inputs into a call with an empty object,
                                // which reads as "inputs given" at the border.
                                if (first && a.node.left.type === 'Identifier' && a.node.left.name === first) {
                                    rewrites = true;
                                }
                            }
                        });
                        found.push({
                            file: e.file,
                            line: p.node.loc ? p.node.loc.start.line : null,
                            param: first, passes: passes, rewrites: rewrites
                        });
                    }
                });
                return found;
            })
            .reduce((acc, list) => acc.concat(list), []);
    }

    test('every replacement of collectData takes a first argument and hands it on', () => {
        const all = wrappers();
        // Measured: two wrappers exist today (export-metadata.js and
        // word-export-scenario-patch.js). If that becomes zero this test is
        // checking nothing, so the count is asserted to be non-zero rather
        // than pinned.
        expect(all.length).toBeGreaterThan(0);
        const broken = all.filter((w) => !w.param || !w.passes)
            .map((w) => w.file + ':' + w.line + ' — parameter ' + JSON.stringify(w.param) +
                ', passes it on: ' + w.passes);
        expect({ broken: broken }).toEqual({ broken: [] });
    });

    test('no wrapper rewrites the argument on its way through', () => {
        const rewriting = wrappers().filter((w) => w.rewrites)
            .map((w) => w.file + ':' + w.line + ' reassigns ' + w.param +
                ' — a call that named no site arrives at the border looking like one that did');
        expect({ rewriting: rewriting }).toEqual({ rewriting: [] });
    });

    test('both wrappers that exist are found by this reader', () => {
        const files = wrappers().map((w) => w.file).sort();
        expect(files).toEqual(['export-metadata.js', 'word-export-scenario-patch.js']);
    });
});

/**
 * GH-717 — THE RULE THAT RESOLVES `obj.key(...)` IS CHECKED AGAINST WHAT ACTUALLY RAN.
 *
 * The caller walk (`tests/helpers/gh678-caller-walk.js`, `resolveMember`) decides statically
 * which function a member call reaches. Until now it was checked only by its own print and by
 * one plant that knows one form. Its history has a real blindness: the first form matched a
 * bare KEY against every export, and `hub.orchestrator.computeSelective(...)` in
 * `climate-engine-v2.js` resolved to the `computeSelective` of `hub-orchestrator.js` — while
 * the object it runs on is `GilbaHub.orchestrator` from `gilba-hub-v2.js`, a different function.
 *
 * THE WITNESS TAKES ITS FACTS FROM EXECUTION ONLY.
 *   - every function of the scripts `/hub` loads gets `__enter("<file>", <line>)` written into
 *     the start of its body, on the bench (`tests/lib/orchestrator-bench.js`, `expose`), on the
 *     same line so no line number moves. The function is identified by its PLACE, never by its
 *     name: a witness that identified it by name would not see twins by construction;
 *   - the caller is the frame under the entered function in `new Error().stack`, as `file:line`;
 *   - the parse is only a coordinate grid: it finds where to write the record and turns a
 *     `file:line` back into a name for the print.
 *
 * WHAT IS JUDGED: every observed call whose site is a MEMBER call the walk recorded — the
 * rule's own subject. For each, one line: `site | static -> place | observed -> place`.
 *   - `agreed`     static and observed are the same place;
 *   - `disagreed`  RED: the rule resolved the site to one place and execution entered another;
 *   - `missed`     RED: the rule resolved nothing for a shape it claims to resolve
 *                  (`global.NAME(...)`, `OBJ.k(...)`);
 *   - `declared unresolvable` — a shape the rule refuses on purpose (a property of a property,
 *                  or ambiguity), printed with what execution entered.
 * Sites the rule resolves statically and execution never reached are NOT listed: the stack
 * cannot tell an unexecuted branch from a dead one, so no verdict is given on them.
 *
 * THE LIVE CASE is driven on purpose: `GilbaHub.climate.coordinator.fetchAndStore` with the
 * data service answering from the bench, which reaches `climate-engine-v2.js`
 * `await hub.orchestrator.computeSelective('climate')`.
 *
 * WHAT THIS DOES NOT SEE, said before the first run:
 *   - branches the bench does not execute: a stubbed DOM is not a page, and the report and
 *     analysis views are not loaded here at all;
 *   - asynchronous boundaries (`await`, timers, events) cut the stack; the caller is the
 *     nearest observed frame, never a root;
 *   - arrow functions with an expression body have no block to write into and are not
 *     recorded; a call entering one is not observed;
 *   - a call on the same line as another call to a function of the same name is taken as
 *     that call; the print names the line, so the reader can see it.
 *
 * AND ABOUT THE REVIEWER'S SECOND MUTATION, said in advance rather than left to be found:
 * making `__enter` record a NAME instead of a place cannot turn this red — on the twin case
 * both sides then say `computeSelective` and agree. That green is the point of the pair: the
 * first mutation (the bare-key rule back) must be red WITH place, and green with names.
 */

'use strict';

const fs = require('fs');
const path = require('path');
const parser = require('@babel/parser');
const traverse = require('@babel/traverse').default;
const { load, hubScripts } = require('./lib/orchestrator-bench');
const walk = require('./helpers/gh678-caller-walk');

jest.setTimeout(120000);

const ASSETS = path.join(__dirname, '..', 'assets');

/** Every function with a block body, per file: its declaration line and where its body opens. */
function functionsOf(name, src) {
    const out = [];
    let ast;
    try {
        ast = parser.parse(src, { sourceType: 'script', errorRecovery: true, plugins: ['classProperties', 'optionalChaining'] });
    } catch (e) {
        return { out, error: String(e.message).slice(0, 120) };
    }
    traverse(ast, {
        Function(p) {
            const body = p.node.body;
            if (!body || body.type !== 'BlockStatement' || !p.node.loc) return;
            out.push({ file: name, line: p.node.loc.start.line, at: body.start + 1, name: walk.nameOfFunction(p) || null });
        },
    });
    return { out };
}

/** The exposure: `__enter("file", line)` at the start of each body, on the same line. */
function instrumented(recordName) {
    const index = {};
    const errors = [];
    const expose = {};
    const first = hubScripts()[0];
    hubScripts().forEach((name) => {
        const file = path.join(ASSETS, name);
        if (!fs.existsSync(file)) return;
        const { out, error } = functionsOf(name, fs.readFileSync(file, 'utf8'));
        if (error) errors.push(name + ': ' + error);
        index[name] = out;
        expose[name] = (src) => {
            let s = src;
            out.slice().sort((a, b) => b.at - a.at).forEach((f) => {
                const tag = recordName ? JSON.stringify(f.name || '?') : JSON.stringify(name) + ',' + f.line;
                s = s.slice(0, f.at) + '__enter(' + tag + ');' + s.slice(f.at);
            });
            // The recorder exists before the first script runs, on the first line of that
            // script so that no line number moves anywhere.
            if (name === first) {
                s = 'this.__entries = []; this.__enter = function (f, l) { __entries.push({ f: f, l: l, stack: new Error().stack }); };' + s;
            }
            return s;
        };
    });
    return { index, errors, expose };
}

/** The frame under the entered function: `file:line` of the call site. */
function callerOf(stack) {
    const frames = String(stack).split('\n').slice(1)
        .map((l) => (/([\w.\-]+\.js):(\d+):\d+\)?\s*$/.exec(l) || []).slice(1, 3))
        .filter((x) => x.length === 2);
    // frames[0] is the recorder itself, frames[1] the entered function (the line of its body
    // where the record was written), frames[2] the caller.
    return frames[2] ? frames[2][0] + ':' + frames[2][1] : null;
}

async function observe(recordName) {
    const { index, errors, expose } = instrumented(recordName);
    const bench = load({ expose });
    const hub = bench.ctx.GilbaHub;
    if (hub && hub.climate && hub.climate.dataService && hub.climate.coordinator) {
        hub.climate.dataService.fetch = () => Promise.resolve({ daily: {}, hourly: {}, _weatherStatus: 'live' });
        try { await hub.climate.coordinator.fetchAndStore(-35.28, 149.13, {}); } catch (e) { /* the path is what is measured */ }
    }
    const entries = (bench.ctx.__entries || []).map((e) => ({
        entered: recordName ? String(e.f) : e.f + ':' + e.l,
        caller: callerOf(e.stack),
    }));
    return { index, errors, failed: bench.failed, entries, driven: !!(hub && hub.climate) };
}

/** The static answer for one call site, as a place. */
function staticPlace(use, files, index) {
    const r = walk.resolveMember(use.object, use.name, files, use.file);
    if (!r) return { verdict: 'none' };
    if (r.ambiguous) return { verdict: 'ambiguous', detail: r.ambiguous };
    const name = r.file.replace(/^assets\//, '');
    const candidates = (index[name] || []).filter((f) => f.name === r.name);
    if (candidates.length !== 1) return { verdict: 'ambiguous', detail: candidates.map((c) => name + ':' + c.line) };
    return { verdict: 'place', place: name + ':' + candidates[0].line, name: r.name };
}

/**
 * The shapes the rule claims to resolve, taken from the rule's own data rather than restated:
 * `global.NAME(...)` (the object is one of its global names) and `OBJ.k(...)` where some file
 * exports an object `OBJ` in the form the rule reads. Any other object is outside its claim.
 */
const GLOBAL_OBJECTS = ['global', 'window', 'self', 'globalThis', 'exportTarget'];
function claimsToResolve(use, files) {
    if (!use.object) return false;
    if (GLOBAL_OBJECTS.includes(use.object)) return true;
    return files.some((f) => f.exports.some((e) => e.objectOf === use.object));
}

function judge(obs, recordName) {
    const files = walk.universe();
    const byFile = {};
    files.forEach((f) => { byFile[f.rel] = f; });
    const lines = [];
    const red = [];
    const misses = [];
    const seen = new Set();
    obs.entries.forEach(({ entered, caller }) => {
        if (!caller) return;
        const [cfile, cline] = [caller.slice(0, caller.lastIndexOf(':')), Number(caller.slice(caller.lastIndexOf(':') + 1))];
        const f = byFile['assets/' + cfile];
        if (!f) return;
        const enteredName = recordName ? entered
            : ((obs.index[entered.slice(0, entered.lastIndexOf(':'))] || []).find((x) => x.file + ':' + x.line === entered) || {}).name;
        const use = f.uses.find((u) => u.how === 'member call' && u.line === cline && u.name === enteredName);
        if (!use) return;
        const key = caller + '>' + entered;
        if (seen.has(key)) return;
        seen.add(key);
        const s = staticPlace(Object.assign({ file: f.rel }, use), files, obs.index);
        const src = fs.readFileSync(path.join(ASSETS, cfile), 'utf8').split('\n')[cline - 1] || '';
        const propertyOfProperty = new RegExp('\\.\\s*' + use.object + '\\s*\\.\\s*' + use.name + '\\b').test(src)
            && !new RegExp('\\b(global|window|self|globalThis)\\s*\\.\\s*' + use.object + '\\s*\\.').test(src);
        let verdict;
        let target;
        if (s.verdict === 'place') {
            // With names recorded, the comparison is name against name — which is exactly what
            // a witness identifying functions by name would do.
            target = recordName ? s.name : s.place;
            const same = recordName ? s.name === entered : s.place === entered;
            verdict = same ? 'agreed' : 'disagreed';
        } else if (s.verdict === 'ambiguous' || propertyOfProperty || !claimsToResolve(use, files)) {
            verdict = 'declared unresolvable';
            target = s.verdict === 'ambiguous' ? JSON.stringify(s.detail)
                : (propertyOfProperty ? 'property of a property' : 'object outside the rule\'s claim');
        } else {
            verdict = 'missed';
            target = 'nothing';
        }
        const line = verdict + ' | ' + caller + ' ' + (use.object || '') + '.' + use.name + ' | static -> ' + target + ' | observed -> ' + entered;
        lines.push(line);
        if (verdict === 'disagreed') red.push(line);
        if (verdict === 'missed') misses.push({ key: 'assets/' + cfile + ' : ' + (use.object || '') + '.' + use.name, line });
    });
    return { lines: lines.sort(), red: red.sort(), misses };
}

describe('GH-717 — member resolution against the stack of execution', () => {
    test('every observed member call agrees with the rule, or is a shape the rule refuses on purpose', async () => {
        const obs = await observe(false);
        const { lines, red } = judge(obs, false);
        const live = lines.filter((l) => l.includes('climate-engine-v2.js:') && l.includes('.computeSelective'));
        process.stdout.write('[gh717] scripts instrumented: ' + Object.keys(obs.index).length
            + ', functions: ' + Object.values(obs.index).reduce((a, x) => a + x.length, 0)
            + ', parse errors: ' + JSON.stringify(obs.errors) + ', load failures: ' + obs.failed.length
            + ', entries observed: ' + obs.entries.length + ', live case driven: ' + obs.driven + '\n'
            + '[gh717] observed member calls judged (' + lines.length + '):\n'
            + lines.map((l) => '[gh717]    ' + l).join('\n') + '\n');

        // THE UNIVERSE IS ASSERTED, NOT ONLY PRINTED: every script `/hub` loads is instrumented,
        // none failed to parse or to load. A universe narrowed by one script is red here, by name,
        // rather than showing up later as a missing `agreed`.
        const expected = hubScripts().filter((n) => fs.existsSync(path.join(ASSETS, n))).sort();
        expect(Object.keys(obs.index).sort()).toEqual(expected);
        expect(obs.errors).toEqual([]);
        expect(obs.failed).toEqual([]);
        expect(obs.driven).toBe(true);
        expect(obs.entries.length).toBeGreaterThan(0);
        // The subject was reached: the live case is among what the witness judged.
        expect(live.length).toBeGreaterThan(0);
        expect(lines.some((l) => l.startsWith('agreed'))).toBe(true);
        expect(red).toEqual([]);
    });

    test('misses of the rule are the recorded ones, both ways — a separate claim from the one above', async () => {
        // Kept apart on purpose: a change of the RULE moves this list, a change of how the
        // WITNESS identifies functions does not, and one case holding both would not say which.
        const obs = await observe(false);
        const { misses } = judge(obs, false);
        // MISSES KNOWN ON THE FIRST RUN are recorded with their reason, both ways: a new one is
        // red by name, and a recorded one no longer observed is red until it is taken off.
        const known = JSON.parse(fs.readFileSync(path.join(__dirname, 'fixtures', 'gh717-known-misses.json'), 'utf8')).misses;
        const now = Array.from(new Set(misses.map((m) => m.key))).sort();
        process.stdout.write('[gh717] misses observed (' + now.length + '): ' + JSON.stringify(now) + '\n');
        expect({
            newMisses: now.filter((k) => !known[k]),
            recordedButNotObserved: Object.keys(known).filter((k) => !now.includes(k)),
        }).toEqual({ newMisses: [], recordedButNotObserved: [] });
    });
});

module.exports = { observe, judge, callerOf, instrumented };

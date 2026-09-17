/**
 * GH-498 — `gaip:site-config-applied` is said by the writer, never by a clock.
 *
 * The defect this closes, measured on the live stand: the first report of every
 * export printed "Current growth potential (0%)" while its own Monthly Schedule
 * in the same report said 13%. The page's analysis had been started by an event
 * named "site-config-applied" that was in fact a `setTimeout(…, 150)` — it
 * announced that 150 milliseconds had passed, not that the arriving site's
 * configuration was on the page. Its own comment said, in as many words, that
 * without it "site-switch always produces the wrong GP on first run"; it was a
 * guess at a duration standing in for a fact, and a second guess (1200 ms) and
 * a third (the export's own 300 ms) were stacked on top of it.
 *
 * ── Passport ────────────────────────────────────────────────────────────────
 * guarantee   Every dispatch of `gaip:site-config-applied` is reachable only
 *             from the path that writes the configuration. None is reachable
 *             from a timer callback outside that path.
 * claims      Structurally, over the AST of site-config-persistence.js: the
 *             event is dispatched in exactly one function; every call of that
 *             function lies inside `restoreConfig` (its own write cascade
 *             included) or in a branch that has just established there is
 *             nothing to restore; and no such call has a setTimeout/setInterval
 *             callback between it and its enclosing named function unless that
 *             function is `restoreConfig`.
 * universe    assets/site-config-persistence.js — the module that owns the
 *             event. A dispatch of it from anywhere else is a separate claim
 *             and is checked as such below.
 * unit        One dispatch site — an AST node, not a line or a substring.
 * moment      At parse time, over the source as it stands.
 * distinguishability  The positive control is the code this ticket removed: the
 *             150 ms timer dispatch is re-parsed here from a literal fixture
 *             and MUST fail the same rule that the file passes.
 * carrier     The syntax tree. The claim is about where in the program the
 *             dispatch can be reached from, which is a property of the tree and
 *             not of any value at run time.
 * ПОТРЕБИТЕЛЬ  `word-export-combined.js` `waitForSiteConfig()` — the combined
 *             export waits for this event before it runs the analysis for a
 *             sample. Observable effect: the growth potential printed in the
 *             first report of a multi-sample document (measured live: 0% before,
 *             13% after, against a Monthly Schedule of 13% in the same report).
 * input       The file itself.
 * positive-control  The fixture in `THE_REMOVED_DISPATCH` below.
 * ЧТО ОЗНАЧАЕТ ЕГО КРАСНЫЙ ЗДЕСЬ И СЕЙЧАС — measured, not predicted. Run on the
 *             tree as it stands, 2026-09-18, before the rule was inverted:
 *             GREEN, 10 of 10, on every one of the six forms the reviewer
 *             named — requestIdleCallback, window.requestIdleCallback,
 *             queueMicrotask, setImmediate, Promise.resolve().then, and a
 *             wrapper of the project's own — with no failing assertion in any
 *             of the six. RED on the two forms from GH-513: `new Event` with
 *             the detail attached by hand (failing: "the event is dispatched in
 *             exactly one place, and that place is the announcer" and "GH-513:
 *             no event of any constructor carries this name outside the
 *             announcer") and the timer around the call of the write (failing:
 *             "GH-513: no timer stands anywhere on the chain that reaches the
 *             announcer"). After the inversion, all six are RED, each caught by
 *             the same two assertions — "no announcement is reachable from a
 *             timer outside the write itself" and "GH-513: no timer stands
 *             anywhere on the chain that reaches the announcer", which are one
 *             predicate applied over two ranges — and the two earlier forms
 *             stay red, each by its own assertion as above. On the clean tree:
 *             GREEN, 11 of 11. So a red here today is a deferral that is not in
 *             the exemption list, and not a correct answer wearing that shape:
 *             the four correct answers this rule does red on — two timer steps
 *             of the write and two completion callbacks — are named below with
 *             their reasons, and a fifth would show up as a new line rather
 *             than be absorbed.
 * exemptions  GH-513/GH-516: four chain exemptions in CHAIN_EXEMPTIONS and
 *             three value exemptions in VALUE_EXEMPTIONS, each anchored on
 *             an AST node and each carrying its own `until`. Two are steps of
 *             the write itself, two are completion callbacks of the server
 *             fetch — the fact arriving, which this rule cannot tell from a
 *             deferring wrapper by shape — and three are boot/retry timers
 *             found, not fixed. A stale exemption fails the test rather than
 *             passing silently, checked in both directions.
 * ratchet     None.
 * rc          The reviewer's mutations, all four shown red against the real
 *             file: a timer back around the dispatch; a dispatch from a new
 *             function called from a timer; GH-513 A1b — `new Event` with the
 *             detail attached by hand, which the old constructor-name check
 *             never looked at; GH-513 A2 — the timer a rung higher, around the
 *             call of the write. Plus the two he named but did not try:
 *             `setTimeout("announceConfigApplied()", 150)` and a `new Event`
 *             dispatch from another module.
 */

'use strict';

const fs = require('fs');
const path = require('path');
const parser = require('@babel/parser');
const traverse = require('@babel/traverse').default;

const FILE = path.join(__dirname, '..', 'assets', 'site-config-persistence.js');
const EVENT = 'gaip:site-config-applied';

/** The code this ticket removed, kept so the rule can be shown to catch it. */
const THE_REMOVED_DISPATCH = `
    function restoreNewSiteConfig(newSiteId) {
        setTimeout(function() {
            document.dispatchEvent(new CustomEvent('gaip:site-config-applied', {
                detail: { siteId: newSiteId, source: 'site-switch' }
            }));
        }, 150);
    }
`;

function parse(src) {
    return parser.parse(src, { sourceType: 'script', allowReturnOutsideFunction: true });
}

/**
 * GH-516 — THE RULE IS INVERTED. There is no list of deferring names any more.
 *
 * `TIMER_NAMES` was a closed list of three, and the reviewer measured six forms
 * straight through it, all ten checks green on each — `requestIdleCallback`,
 * `window.requestIdleCallback`, `queueMicrotask`, `setImmediate`,
 * `Promise.resolve().then`, and the one no list can ever hold: a wrapper of the
 * project's own, `function _deferAnnounce(fn) { setTimeout(fn, 150); }`, where
 * the chain shows a call to a local function and the timer lives inside it.
 * Measured again here before this was written: six of six green, no failing
 * assertion. Adding names to a list is answering the sixth form with the thing
 * it was built to walk past.
 *
 * So the break is not "the callback of a deferring call". The break is A
 * FUNCTION EXPRESSION PASSED AS AN ARGUMENT, whatever is being called.
 *
 * Two exceptions, both because they are NOT breaks — the call happens before
 * the expression returns:
 *   - the closed set below, which the language runs synchronously;
 *   - the callback of an `addEventListener` subscription, which is the shape
 *     this whole class is trying to reach: the announcement follows the fact
 *     the event reported. A rule that reds on it reds on the right answer.
 *
 * Microtasks are NOT in it, and that is a decision with a reason rather than a
 * shape: the class is "the announcement is separated from the fact", not
 * "someone guessed a duration". restoreConfig's write is a cascade of 1050 ms;
 * a microtask queued at its start runs about a second BEFORE the identity is
 * written. "Through a microtask" reads as "immediately" and is not.
 */
const SYNCHRONOUS_ARGUMENT_CALLS = ['forEach', 'map', 'filter', 'reduce',
    'some', 'every', 'call', 'apply'];
const SUBSCRIPTION_CALLS = ['addEventListener'];

/** The callee of a call, as a name a human would recognise. */
function calleeName(call) {
    if (!call || !call.callee) return null;
    if (call.callee.name) return call.callee.name;
    if (call.callee.type === 'MemberExpression' && call.callee.property) {
        const obj = call.callee.object;
        const objName = obj && (obj.name
            || (obj.type === 'MemberExpression' && obj.property && obj.property.name)
            || (obj.type === 'CallExpression' && calleeName(obj)));
        return (objName ? objName + '.' : '') + (call.callee.property.name || '?');
    }
    return null;
}

/**
 * Walk outward from a node to the nearest NAMED function, reporting the first
 * break in the chain — a function expression handed to a call.
 */
function walkOut(startPath) {
    let breakBetween = null;
    let enclosing = null;
    let cur = startPath;
    while (cur) {
        if (cur.isFunction && cur.isFunction()) {
            const parent = cur.parentPath;
            const call = parent && parent.isCallExpression() ? parent.node : null;
            const isArgument = call && call.arguments.indexOf(cur.node) >= 0;
            const name = calleeName(call);
            const bare = name ? name.split('.').pop() : null;
            const synchronous = bare && SYNCHRONOUS_ARGUMENT_CALLS.indexOf(bare) >= 0;
            const subscription = bare && SUBSCRIPTION_CALLS.indexOf(bare) >= 0;
            if (isArgument && !synchronous && !subscription) {
                if (!breakBetween) breakBetween = 'an argument to ' + (name || '(an expression)');
            } else {
                const fnName = (cur.node.id && cur.node.id.name)
                    || (cur.parentPath && cur.parentPath.isVariableDeclarator()
                        && cur.parentPath.node.id.name);
                if (fnName) { enclosing = fnName; break; }
            }
        }
        cur = cur.parentPath;
    }
    return { enclosingFunction: enclosing, timerBetween: breakBetween };
}

/**
 * Every place the event is dispatched, with the chain of functions it sits in
 * and whether a timer callback stands between it and the nearest named one.
 */
function dispatchSites(src) {
    const ast = parse(src);
    const found = [];
    traverse(ast, {
        NewExpression(p) {
            if (p.node.callee.name !== 'CustomEvent') return;
            const first = p.node.arguments[0];
            if (!first || first.type !== 'StringLiteral' || first.value !== EVENT) return;
            const out = walkOut(p.parentPath);
            found.push({
                line: p.node.loc ? p.node.loc.start.line : null,
                enclosingFunction: out.enclosingFunction,
                timerBetween: out.timerBetween
            });
        }
    });
    return found;
}

/** Calls of a named function, with the same question asked of each. */
function callSites(src, name) {
    const ast = parse(src);
    const out = [];
    traverse(ast, {
        CallExpression(p) {
            if (!p.node.callee || p.node.callee.name !== name) return;
            const w = walkOut(p.parentPath);
            out.push({
                line: p.node.loc ? p.node.loc.start.line : null,
                enclosingFunction: w.enclosingFunction,
                timerBetween: w.timerBetween
            });
        }
    });
    return out;
}

/**
 * GH-508 (reviewer's finding A): every `new CustomEvent` in the file whose name
 * is NOT a plain string literal. A name assembled at run time —
 * `'gaip:site-config' + '-applied'` — is invisible to a walker that matches a
 * StringLiteral and to a regular expression that wants a quote, so a dispatch
 * wearing it passes every check this file makes about dispatch sites.
 */
function computedEventNames(src) {
    const ast = parse(src);
    const out = [];
    traverse(ast, {
        NewExpression(p) {
            if (p.node.callee.name !== 'CustomEvent') return;
            const first = p.node.arguments[0];
            if (!first || first.type !== 'StringLiteral') {
                out.push({
                    line: p.node.loc ? p.node.loc.start.line : null,
                    argumentType: first ? first.type : '(no argument)'
                });
            }
        }
    });
    return out;
}

/**
 * GH-508 (reviewer's finding A): every place a named function is used as a
 * VALUE rather than called — `setTimeout(announceConfigApplied, 150)` says the
 * same thing by the clock as a callback would, and the callback rule does not
 * see it because there is no call expression inside the timer at all.
 */
function passedAsAValue(src, name) {
    const ast = parse(src);
    const out = [];
    traverse(ast, {
        Identifier(p) {
            if (p.node.name !== name) return;
            if (p.parentPath.isCallExpression() && p.parentPath.node.callee === p.node) return; // a call
            if (p.parentPath.isFunctionDeclaration() && p.parentPath.node.id === p.node) return; // its own name
            if (p.parentPath.isMemberExpression() && p.parentPath.node.property === p.node) return;
            out.push({
                line: p.node.loc ? p.node.loc.start.line : null,
                inside: p.parentPath.type
            });
        }
    });
    return out;
}


/**
 * GH-513 (reviewer's finding A1b): EVERY event construction in the file, of
 * ANY constructor whose name ends in `Event`, with its first argument.
 *
 * The rule the file used to carry was "a `new CustomEvent` whose name is the
 * literal". His mutation was `new Event('gaip:site-config-applied')` with the
 * detail attached to the object afterwards — a different constructor, so every
 * walker stopped at `callee.name !== 'CustomEvent'` and never looked inside.
 * The consumer accepts that form: word-export-combined.js:125-127 reads
 * `e.detail` and compares `siteId`, so the defect comes back whole.
 *
 * The rule is therefore not about the constructor but about the name: no event
 * of any kind may be built carrying this name, except at the one allowed node.
 */
function eventConstructions(src) {
    const ast = parse(src);
    const out = [];
    traverse(ast, {
        NewExpression(p) {
            const ctor = p.node.callee && p.node.callee.name;
            if (!ctor || !/Event$/.test(ctor)) return;
            const first = p.node.arguments[0];
            const literal = first && first.type === 'StringLiteral' ? first.value : null;
            // A name that is not a literal cannot be read here, so it is
            // reported as unreadable rather than as "not this event".
            const namesTheEvent = literal === EVENT
                || (first && first.type !== 'StringLiteral');
            if (!namesTheEvent) return;
            let enclosing = null;
            let cur = p.parentPath;
            while (cur) {
                if (cur.isFunction()) {
                    const fnName = (cur.node.id && cur.node.id.name)
                        || (cur.parentPath && cur.parentPath.isVariableDeclarator()
                            && cur.parentPath.node.id.name);
                    if (fnName) { enclosing = fnName; break; }
                }
                cur = cur.parentPath;
            }
            out.push({
                line: p.node.loc ? p.node.loc.start.line : null,
                constructor: ctor,
                name: literal === null ? '(' + (first ? first.type : 'no argument') + ')' : literal,
                enclosingFunction: enclosing
            });
        }
    });
    return out;
}

/**
 * GH-513 (reviewer's finding A2): the whole chain of calls that can reach the
 * announcer, not just the calls of the announcer itself.
 *
 * His mutation put the timer one rung higher —
 * `setTimeout(function () { restoreConfig(config, newSiteId, 'site-switch'); }, 1200)`
 * — so every statement the file made about the announcer stayed true and the
 * announcement was still made by a clock. His wording of the class: the
 * announcement is separated from the fact by a timer, and the timer can stand
 * around the announcement, around the write, around the call of the write, or
 * around the call of that.
 *
 * So the walk starts at the announcer and goes up through every named function
 * that calls it, transitively, and a timer on ANY link is refused.
 */
function announcementChain(src, announcer) {
    const seen = [announcer];
    const queue = [announcer];
    const links = [];
    while (queue.length) {
        const fn = queue.shift();
        callSites(src, fn).forEach((c) => {
            links.push({
                callee: fn,
                caller: c.enclosingFunction,
                line: c.line,
                timerBetween: c.timerBetween
            });
            if (c.enclosingFunction && seen.indexOf(c.enclosingFunction) < 0) {
                seen.push(c.enclosingFunction);
                queue.push(c.enclosingFunction);
            }
        });
    }
    return { functionsReached: seen, links: links };
}


/**
 * Exemptions for the chain rule, one per construction, each anchored on the
 * AST pair (caller, callee, timer) rather than on a line, a count or a regular
 * expression over several forms.
 */
const CHAIN_EXEMPTIONS = [
    {
        file: 'assets/site-config-persistence.js',
        function: 'restoreConfig',
        node: 'CallExpression announceConfigApplied, inside a FunctionExpression passed to setTimeout',
        what: 'The announcement is made from inside the last step of the write cascade.',
        why: 'The cascade writes the turf identity 100+200+200+50+500 ms after the '
            + 'synchronous body returns. Announcing at the synchronous end would say '
            + '"applied" while the species field still held the previous site — the '
            + 'defect moved rather than removed. Here the timer IS the write.',
        until: 'the cascade writes the turf identity synchronously, at which point the '
            + 'announcement moves to the end of the body and this exemption is deleted'
    },
    {
        file: 'assets/site-config-persistence.js',
        function: 'init',
        node: 'CallExpression restoreNewSiteConfig, inside a FunctionExpression passed to setTimeout',
        what: "The arriving site's restore is started 300 ms after the switch event.",
        why: 'FOUND, NOT FIXED. Its own comment says "delay for sample loading": a '
            + 'guessed duration standing where a fact belongs, one rung above the '
            + 'announcement. It does not make the announcement lie — the announcement '
            + 'still follows the write — so it is held here rather than passed silently.',
        until: 'the restore is started by the event that says the samples are loaded'
    },
    {
        file: 'assets/site-config-persistence.js',
        function: 'init',
        node: 'CallExpression announceConfigApplied, inside the onComplete FunctionExpression '
            + 'passed to pullConfigsFromServer',
        what: 'The "nothing was restored" announcement is made from the completion '
            + 'callback of the server fetch.',
        why: 'NOT A BREAK, and the rule cannot see that. A completion callback is the '
            + 'fact ARRIVING — the configs are here, and there was none for this site — '
            + 'which is the shape this whole class is trying to reach. In the syntax '
            + 'tree it is indistinguishable from `_deferAnnounce(fn)`: both are a '
            + 'function expression handed to a local function. The difference is a fact '
            + 'about what that function does, so it is written here where a person '
            + 'reads it rather than guessed by the walker. `addEventListener` is the '
            + 'same shape and is exempt in the rule itself only because its name is '
            + 'fixed by the platform; this one is ours and could change meaning.',
        until: 'pullConfigsFromServer returns a promise the caller awaits, so the '
            + 'arrival is a value rather than a callback'
    },
    {
        file: 'assets/site-config-persistence.js',
        function: 'init',
        node: 'CallExpression restoreConfig, inside the onComplete FunctionExpression '
            + 'passed to pullConfigsFromServer',
        what: 'The restore is started from the completion callback of the server fetch.',
        why: 'Same as above: the callback runs when the configs have arrived, so the '
            + 'work follows the fact rather than a clock.',
        until: 'pullConfigsFromServer returns a promise the caller awaits'
    }
];

/**
 * GH-516, the decision about the third point, made and named rather than left
 * silent: the "never handed over as a value" rule now covers THE WHOLE CHAIN,
 * not just the announcer.
 *
 * `assets/site-config-persistence.js:1060` is `setTimeout(init, 1000)` — a
 * chain function handed to a clock by value. Under a rule that guards only the
 * announcer's name it is invisible, and the guard's reach then depends on which
 * link someone happens to defer. The alternative — keep the rule to the
 * announcer and record that as a choice — leaves a link that can be handed to a
 * clock with nothing to say about it. So: the whole chain, and that line gets a
 * named exemption below.
 */
const VALUE_EXEMPTIONS = [
    {
        file: 'assets/site-config-persistence.js',
        function: 'init',
        node: 'Identifier init, argument 0 of setTimeout(init, 1000), inside init itself',
        what: 'init retries itself in a second when GAIP_SampleManager has no '
            + 'getActiveSiteId yet.',
        why: 'A retry by clock IS waiting by time, and today it is harmless: the retry '
            + 're-runs init from the top, which establishes the fact itself before it '
            + 'announces anything — it does not announce that the second has passed. '
            + 'Held rather than passed silently, because "harmless today" is how the '
            + '150 ms timer this ticket removed started out.',
        until: 'SampleManager announces its own readiness and init waits for that event'
    },
    {
        file: 'assets/site-config-persistence.js',
        function: '(module boot)',
        node: "Identifier init, argument 0 of setTimeout(init, 500), inside the "
            + "document.addEventListener('DOMContentLoaded') callback",
        what: 'Boot waits 500 ms after DOMContentLoaded before running init.',
        why: 'FOUND, NOT FIXED, and it was not in the reviewer\'s list — my own walk '
            + 'found it. DOMContentLoaded is a fact and it has already happened; the '
            + '500 ms on top of it is a guess about something else finishing, which is '
            + 'this ticket\'s class exactly. It does not make the announcement lie, '
            + 'because init establishes what it announces, so it is held rather than '
            + 'fixed inside a ticket asked for the rule.',
        until: 'the thing those 500 ms are waiting for says so itself'
    },
    {
        file: 'assets/site-config-persistence.js',
        function: '(module boot)',
        node: 'Identifier init, argument 0 of setTimeout(init, 500), at module top level',
        what: 'The same 500 ms on the branch where the document had already loaded.',
        why: 'Same as above, the other half of the same if/else. Named separately '
            + 'because one key covering both would be an exemption by shape.',
        until: 'the thing those 500 ms are waiting for says so itself'
    }
];

const exemptionKey = (l) => l.caller + ' -> ' + l.callee + ' via ' + l.timerBetween;
const EXEMPT_KEYS = {
    'restoreConfig -> announceConfigApplied via an argument to setTimeout': CHAIN_EXEMPTIONS[0],
    'init -> restoreNewSiteConfig via an argument to setTimeout': CHAIN_EXEMPTIONS[1],
    'init -> announceConfigApplied via an argument to pullConfigsFromServer': CHAIN_EXEMPTIONS[2],
    'init -> restoreConfig via an argument to pullConfigsFromServer': CHAIN_EXEMPTIONS[3]
};
const VALUE_EXEMPT = {
    'init|setTimeout|arg0|1000|init': VALUE_EXEMPTIONS[0],
    "init|setTimeout|arg0|500|document.addEventListener('DOMContentLoaded')": VALUE_EXEMPTIONS[1],
    'init|setTimeout|arg0|500|(module top level)': VALUE_EXEMPTIONS[2]
};


/**
 * GH-513: every timer in the file whose first argument is a string rather than
 * a function. The browser evaluates it as code; the AST sees a StringLiteral
 * and nothing else. Kept name-based on purpose: this is a claim about the three
 * platform timers that accept a string, not about deferral in general.
 */
function timersGivenAString(src) {
    const ast = parse(src);
    const out = [];
    traverse(ast, {
        CallExpression(p) {
            const callee = p.node.callee
                && (p.node.callee.name || (p.node.callee.property && p.node.callee.property.name));
            if (['setTimeout', 'setInterval', 'requestAnimationFrame'].indexOf(callee) < 0) return;
            const first = p.node.arguments[0];
            if (!first) return;
            if (first.type === 'StringLiteral' || first.type === 'TemplateLiteral') {
                out.push({
                    line: p.node.loc ? p.node.loc.start.line : null,
                    timer: callee,
                    body: first.type === 'StringLiteral' ? first.value : '(template literal)'
                });
            }
        }
    });
    return out;
}


/**
 * GH-516: a chain function handed to SOMEONE ELSE'S CALL as an argument —
 * `setTimeout(init, 1000)`, `whatever(restoreConfig)`. Whoever received it
 * decides when it runs.
 *
 * Narrower than `passedAsAValue` above on purpose, and the difference is
 * measured rather than assumed: run broad over the whole chain, it reported
 * `assets/site-config-persistence.js:1187`, which is `restore: restoreConfig`
 * in the module's exported object — publishing an API, not deferring a call.
 * The announcer keeps the broad rule, because an announcer anyone can fire is
 * an announcer the write no longer owns; the rest of the chain gets this one.
 */
function passedAsArgument(src, name) {
    const ast = parse(src);
    const out = [];
    traverse(ast, {
        Identifier(p) {
            if (p.node.name !== name) return;
            const parent = p.parentPath;
            if (!parent || !parent.isCallExpression()) return;
            if (parent.node.callee === p.node) return;          // it is the call itself
            if (parent.node.arguments.indexOf(p.node) < 0) return;
            // The delay and the surrounding context are part of the anchor:
            // measured, `init` is handed to setTimeout in THREE places, and one
            // key of the shape name|call|position covered all three at once —
            // an exemption by shape, which is the thing our own rule forbids.
            const rest = parent.node.arguments[1];
            let context = '(module top level)';
            let up = parent.parentPath;
            while (up) {
                if (up.isFunction && up.isFunction()) {
                    const named = (up.node.id && up.node.id.name)
                        || (up.parentPath && up.parentPath.isVariableDeclarator()
                            && up.parentPath.node.id.name);
                    const outer = up.parentPath && up.parentPath.isCallExpression()
                        ? up.parentPath.node : null;
                    const via = outer ? calleeName(outer) : null;
                    if (named) { context = named; break; }
                    if (via) {
                        const ev = outer.arguments[0];
                        context = via + (ev && ev.type === 'StringLiteral' ? "('" + ev.value + "')" : '');
                        break;
                    }
                }
                up = up.parentPath;
            }
            out.push({
                line: p.node.loc ? p.node.loc.start.line : null,
                toCall: calleeName(parent.node) || '(an expression)',
                position: parent.node.arguments.indexOf(p.node),
                delay: rest && rest.type === 'NumericLiteral' ? rest.value : null,
                context: context
            });
        }
    });
    return out;
}


/**
 * GH-517: an exemption key must match EXACTLY ONE node.
 *
 * Until this existed, the ban on exemptions-by-shape was a rule in the brief
 * and nothing in the device: both stale-exemption checks asked whether a key
 * matches ANYTHING, and a key that covers three places matches something, so
 * they stayed green. It was caught in GH-516 only because the key was broken on
 * purpose during a red check — by the practice, not by the guard. Measured
 * then: the key `init|setTimeout|arg0` silently held three separate places open
 * while the suite read 11 of 11 green.
 *
 * Returns both failures separately, because they are different faults: a key
 * matching nothing is a stale exemption, a key matching several is an exemption
 * by shape.
 */
function exemptionMatchCounts(keys, matchedKeys) {
    const counts = {};
    keys.forEach((k) => { counts[k] = 0; });
    matchedKeys.forEach((k) => { if (counts[k] !== undefined) counts[k] += 1; });
    return {
        matchingNothing: keys.filter((k) => counts[k] === 0),
        matchingSeveral: keys.filter((k) => counts[k] > 1)
            .map((k) => k + ' matches ' + counts[k] + ' nodes'),
        counts: counts
    };
}

describe('GH-498 — the config-applied announcement comes from the write, not from a clock', () => {
    const src = fs.readFileSync(FILE, 'utf8');

    test('positive control: the timer dispatch this ticket removed fails the rule', () => {
        expect.hasAssertions();
        const sites = dispatchSites(THE_REMOVED_DISPATCH);
        expect(sites.length).toBe(1);
        // It sits inside a setTimeout callback, and the function that callback
        // belongs to is not restoreConfig — which is exactly the shape the rule
        // forbids. Without this, a rule that accepted everything would look the
        // same as a rule that works.
        // GH-516: the break is no longer named by the timer, it is named by the
        // shape — a function expression handed to a call.
        expect(sites[0].timerBetween).toBe('an argument to setTimeout');
        expect(sites[0].enclosingFunction).toBe('restoreNewSiteConfig');
        const offending = sites.filter((x) => x.timerBetween
            && !EXEMPT_KEYS[exemptionKey({ caller: x.enclosingFunction,
                callee: 'announceConfigApplied', timerBetween: x.timerBetween })]);
        expect(offending.length).toBe(1);
    });

    test('the event is dispatched in exactly one place, and that place is the announcer', () => {
        expect.hasAssertions();
        const sites = dispatchSites(src);
        expect(sites.map((s) => s.enclosingFunction)).toEqual(['announceConfigApplied']);
    });

    test('no announcement is reachable from a timer outside the write itself', () => {
        expect.hasAssertions();
        const calls = callSites(src, 'announceConfigApplied');
        expect(calls.length).toBeGreaterThan(0);
        // GH-516: the ad-hoc "unless it is restoreConfig" carve-out is gone. This
        // test and the chain test now share ONE set of named exemptions, so a
        // place held open is held open in one spot with one `why` and one
        // `until`, not twice with two different reasons.
        const fromATimer = calls
            .filter((c) => c.timerBetween)
            .filter((c) => !EXEMPT_KEYS[exemptionKey(
                { caller: c.enclosingFunction, callee: 'announceConfigApplied', timerBetween: c.timerBetween })])
            .map((c) => 'line ' + c.line + ': inside ' + c.timerBetween
                + ' in ' + c.enclosingFunction);
        expect({ announcementsMadeByAClock: fromATimer })
            .toEqual({ announcementsMadeByAClock: [] });
    });

    test('and every announcement is in a function that owns the fact', () => {
        expect.hasAssertions();
        const calls = callSites(src, 'announceConfigApplied');
        // restoreConfig writes the configuration; restoreNewSiteConfig and init
        // announce only the "nothing to restore" case, which they establish
        // themselves a line earlier.
        const allowed = ['restoreConfig', 'restoreNewSiteConfig', 'init'];
        const strangers = calls.filter((c) => allowed.indexOf(c.enclosingFunction) < 0)
            .map((c) => 'line ' + c.line + ': ' + c.enclosingFunction);
        expect({ announcedFromSomewhereElse: strangers })
            .toEqual({ announcedFromSomewhereElse: [] });
    });

    test('GH-508: no event name in this file is assembled rather than written', () => {
        expect.hasAssertions();
        // The reviewer's second mutation dispatched from a timer with
        // `'gaip:site-config' + '-applied'`. Every check above looks for a
        // StringLiteral and finds nothing, so the dispatch is invisible. A name
        // that is not a literal is refused outright — whatever it evaluates to.
        const computed = computedEventNames(src).map((c) => 'line ' + c.line + ': ' + c.argumentType);
        expect({ eventNamesNotWrittenAsLiterals: computed })
            .toEqual({ eventNamesNotWrittenAsLiterals: [] });
        // positive control: the shape it must catch
        const decoy = "setTimeout(function () { document.dispatchEvent("
            + "new CustomEvent('gaip:site-config' + '-applied', { detail: {} })); }, 150);";
        expect(computedEventNames(decoy).length).toBe(1);
    });

    test('GH-516: no function on the chain is handed over as a value, not only the announcer', () => {
        expect.hasAssertions();
        const chain = announcementChain(src, 'announceConfigApplied');
        // The set of names is the chain's own, walked from the announcer
        // upward — not a list written here, so a new link joins it by itself.
        expect(chain.functionsReached.length).toBeGreaterThan(1);
        const handed = [];
        const seen = [];
        chain.functionsReached.forEach((fn) => {
            passedAsArgument(src, fn).forEach((u) => {
                const key = fn + '|' + u.toCall + '|arg' + u.position
                    + '|' + u.delay + '|' + u.context;
                if (VALUE_EXEMPT[key]) { seen.push(key); return; }
                handed.push('line ' + u.line + ': ' + fn + ' handed to ' + u.toCall
                    + '(' + u.delay + ') in ' + u.context);
            });
        });
        expect({ chainFunctionsHandedOverAsAValue: handed })
            .toEqual({ chainFunctionsHandedOverAsAValue: [] });
        // an exemption matching nothing is a hole nobody can see; an exemption
        // matching several is an exemption by shape, which our own rule forbids
        const vc = exemptionMatchCounts(Object.keys(VALUE_EXEMPT), seen);
        expect({ valueExemptionsMatchingNothing: vc.matchingNothing,
                 valueExemptionsMatchingSeveralNodes: vc.matchingSeveral })
            .toEqual({ valueExemptionsMatchingNothing: [],
                       valueExemptionsMatchingSeveralNodes: [] });
        // positive control: a chain function handed to a clock, which the
        // announcer-only rule never looked at
        const decoy = 'function announceConfigApplied(a){document.dispatchEvent('
            + "new CustomEvent('gaip:site-config-applied',{detail:{}}));}\n"
            + 'function restoreConfig(c,i,s){announceConfigApplied(i,true,s);}\n'
            + 'function caller(){ setTimeout(restoreConfig, 1200); }';
        const decoyChain = announcementChain(decoy, 'announceConfigApplied');
        expect(decoyChain.functionsReached).toContain('restoreConfig');
        expect(passedAsArgument(decoy, 'restoreConfig').length).toBe(1);
    });

    test('GH-508: the announcer is never handed to anything, only called', () => {
        expect.hasAssertions();
        // The reviewer's first mutation was `setTimeout(announceConfigApplied,
        // 150)`. There is no call expression inside that timer, so the rule
        // about calls-inside-timers has nothing to look at. Passing the
        // function anywhere as a value is refused instead: an announcer someone
        // else can fire is an announcer the write no longer owns.
        const handedOver = passedAsAValue(src, 'announceConfigApplied')
            .map((u) => 'line ' + u.line + ': used inside ' + u.inside);
        expect({ announcerPassedAsAValue: handedOver })
            .toEqual({ announcerPassedAsAValue: [] });
        // positive control: the shape it must catch
        const decoy = 'function f() { setTimeout(announceConfigApplied, 150); }';
        expect(passedAsAValue(decoy, 'announceConfigApplied').length).toBe(1);
    });


    test('GH-513: no event of any constructor carries this name outside the announcer', () => {
        expect.hasAssertions();
        const built = eventConstructions(src);
        // Printed, so the allowed node is visible rather than assumed.
        const strangers = built
            .filter((b) => b.enclosingFunction !== 'announceConfigApplied')
            .map((b) => 'line ' + b.line + ': new ' + b.constructor + '(' + b.name + ') in ' + b.enclosingFunction);
        expect({ eventsBuiltOutsideTheAnnouncer: strangers })
            .toEqual({ eventsBuiltOutsideTheAnnouncer: [] });
        expect(built.length).toBe(1);
        expect(built[0].constructor).toBe('CustomEvent');
        // positive control: the reviewer's A1b shape, which the old rule missed
        const decoy = "function f(id) { var e = new Event('gaip:site-config-applied');"
            + " e.detail = { siteId: id, source: 'site-switch' };"
            + " setTimeout(function () { document.dispatchEvent(e); }, 150); }";
        expect(eventConstructions(decoy).length).toBe(1);
        expect(eventConstructions(decoy)[0].constructor).toBe('Event');
    });

    test('GH-513: no timer stands anywhere on the chain that reaches the announcer', () => {
        expect.hasAssertions();
        const chain = announcementChain(src, 'announceConfigApplied');
        expect(chain.links.length).toBeGreaterThan(0);
        const timed = chain.links.filter((l) => l.timerBetween);
        const byAClock = timed
            .filter((l) => !EXEMPT_KEYS[exemptionKey(l)])
            .map((l) => 'line ' + l.line + ': ' + l.caller + ' calls ' + l.callee
                + ' from inside ' + l.timerBetween);
        expect({ linksOnTheChainMadeByAClock: byAClock })
            .toEqual({ linksOnTheChainMadeByAClock: [] });
        // Each exemption must still match a link that is really there — and
        // exactly one of them.
        const cc = exemptionMatchCounts(Object.keys(EXEMPT_KEYS),
            timed.map((l) => exemptionKey(l)));
        expect({ exemptionsThatNoLongerMatchAnything: cc.matchingNothing,
                 exemptionsMatchingSeveralNodes: cc.matchingSeveral })
            .toEqual({ exemptionsThatNoLongerMatchAnything: [],
                       exemptionsMatchingSeveralNodes: [] });
        // positive control: the reviewer's A2 shape — the timer a rung above the
        // announcer, around the call of the write. Every statement about the
        // announcer itself stays true in it.
        const decoy = "function announceConfigApplied(a, b, c) { document.dispatchEvent("
            + "new CustomEvent('gaip:site-config-applied', { detail: {} })); }\n"
            + "function restoreConfig(cfg, id, src) { announceConfigApplied(id, true, src); }\n"
            + "function restoreNewSiteConfig(newSiteId) { var config = null;"
            + " setTimeout(function () { restoreConfig(config, newSiteId, 'site-switch'); }, 1200); }";
        const decoyChain = announcementChain(decoy, 'announceConfigApplied');
        expect(decoyChain.links.filter((l) => l.timerBetween).length).toBe(1);
        expect(decoyChain.functionsReached).toContain('restoreConfig');
    });

    /**
     * GH-513: the cross-module rule was a regular expression that required
     * `new CustomEvent` and a quote, so the reviewer's A1b form — `new Event`
     * with the detail attached afterwards — passed it from any file. It is now
     * the same AST walk as the in-file rule, run over every asset.
     *
     * A name the file assembles at run time cannot be read from the tree, so
     * those are listed separately and named rather than counted as clean: the
     * walk says what it could not read instead of calling it absent.
     */
    test('no other module builds this event, whatever constructor it uses', () => {
        expect.hasAssertions();
        const dir = path.join(__dirname, '..', 'assets');
        const files = fs.readdirSync(dir)
            .filter((f) => f.endsWith('.js') && f !== 'site-config-persistence.js');
        const offenders = [];
        const unreadable = [];
        files.forEach((f) => {
            let built;
            try { built = eventConstructions(fs.readFileSync(path.join(dir, f), 'utf8')); }
            catch (e) { unreadable.push(f + ': did not parse — ' + String(e.message).slice(0, 60)); return; }
            built.forEach((b) => {
                const row = f + ':' + b.line + ' new ' + b.constructor + '(' + b.name + ')';
                if (b.name === EVENT) offenders.push(row); else unreadable.push(row);
            });
        });
        expect({ otherModulesBuildingThisEvent: offenders })
            .toEqual({ otherModulesBuildingThisEvent: [] });
        // Printed, not asserted: every event in the tree whose name this walk
        // could not read. The claim above is only as wide as this list is short.
        expect(Array.isArray(unreadable)).toBe(true);
        if (unreadable.length) {
            process.stdout.write('\n[GH-513] event names this walk could not read ('
                + unreadable.length + '):\n  ' + unreadable.join('\n  ') + '\n');
        }
        expect(files.length).toBeGreaterThan(100);
    });

    /**
     * GH-513: the form the reviewer named but did not try — a timer whose body
     * is a STRING. `setTimeout("announceConfigApplied()", 150)` contains no
     * call expression and no identifier for any walker to find, so every rule
     * in this file is blind to it while the browser runs it as code.
     */
    test('GH-513: no timer in this file is given a string to run', () => {
        expect.hasAssertions();
        const stringTimers = timersGivenAString(src)
            .map((t) => 'line ' + t.line + ': ' + t.timer + '(' + JSON.stringify(t.body) + ')');
        expect({ timersRunningCodeWrittenAsText: stringTimers })
            .toEqual({ timersRunningCodeWrittenAsText: [] });
        // positive control: the shape it must catch
        const decoy = 'function f() { setTimeout("announceConfigApplied()", 150); }';
        expect(timersGivenAString(decoy).length).toBe(1);
    });
});

/**
 * GH-704 (queue item 3as) — THE PREDICATE THAT DECIDES WHETHER A PASS PRODUCED SOMETHING EXISTS IN
 * THREE COPIES, AND THIS CASE ASKS EACH OF THEM THE SAME QUESTION.
 *
 * Two of the three are here: `cascade-orchestrator.js` and `hub-orchestrator.js`. The third is the
 * server's, `AnalysisResults::producedSomething`, and it is asked the same table in
 * `Gh704TheServerCopyOfTheProducedPredicateTest` — the same fixture file, so the comparison is
 * between each copy and a declared input rather than between two copies of ours, which is how two
 * surfaces that drifted together come out agreeing.
 *
 * WHY THIS CASE COMES BEFORE THE REPAIR, and the analyst's plan puts it there: the three are said to
 * agree today. If they do, repairing one of them moves nothing any run can see, so the repair would
 * be invisible and the drift would start in silence. The answers are printed first, and then they
 * are held.
 *
 * HOW THE BROWSER COPIES ARE REACHED. Neither is exposed: both are inner functions of their file's
 * closure, and nothing outside can call them. So each is taken FROM ITS SOURCE by brace matching and
 * evaluated on its own — the product is not touched to be measured, and reading the source is what
 * a reader of that file does anyway. That the source is what the page runs is the boundary of this
 * method, and it is named rather than assumed.
 */

'use strict';

const fs = require('fs');
const path = require('path');
const vm = require('vm');

const ROOT = path.join(__dirname, '..');
const TABLE = JSON.parse(fs.readFileSync(
    path.join(__dirname, '..', 'app', 'tests', 'fixtures', 'gh704-produced-predicate-inputs.json'), 'utf8'));

/** The function's own text, cut out by matching its braces rather than by counting lines. */
function functionTextFrom(file, name) {
    const src = fs.readFileSync(path.join(ROOT, file), 'utf8');
    const at = src.indexOf('function ' + name + '(');
    if (at === -1) return null;
    const open = src.indexOf('{', at);
    let depth = 0;
    for (let i = open; i < src.length; i++) {
        if (src[i] === '{') depth++;
        else if (src[i] === '}') {
            depth--;
            if (depth === 0) return src.slice(at, i + 1);
        }
    }

    return null;
}

/** That text, made callable on its own. */
function callable(file, name, globals) {
    const text = functionTextFrom(file, name);
    if (!text) return null;
    const sandbox = { Array, Object, String, Number, Boolean, JSON, Math, Error };
    sandbox.global = Object.assign(sandbox, globals || {});
    vm.createContext(sandbox);
    vm.runInContext(text + '; this.__fn = ' + name + ';', sandbox);

    return sandbox.__fn;
}

describe('GH-704 — the produced predicate, one question asked of every copy', () => {
    const COPIES = [
        { where: 'assets/cascade-orchestrator.js', name: 'producedSomething' },
        { where: 'assets/hub-orchestrator.js', name: 'producedSomething' },
    ];

    test('both browser copies are reachable from their source, or nothing below is measured', () => {
        // THE FLOOR. A copy that cannot be reached would make every answer below a statement about
        // a function nobody called, and the first version of this file could not reach either.
        COPIES.forEach((c) => {
            const fn = callable(c.where, c.name);
            process.stdout.write('[gh704] ' + c.where + ': ' + (fn ? 'reachable' : 'NOT REACHABLE') + '\n');
            expect(typeof fn).toBe('function');
        });
    });

    test('every copy answers the same input, and the answers are printed before they are held', () => {
        // AFTER THE REPAIR THE CASCADE ASKS RATHER THAN ANSWERS, so its sandbox is given the shared
        // function — which is the arrangement itself, not a convenience: if the hub's definition
        // changes, this is the answer the cascade gives.
        const hubFn = callable('assets/hub-orchestrator.js', 'producedSomething');
        const fns = COPIES.map((c) => ({
            where: c.where,
            fn: callable(c.where, c.name, { GAIP_producedSomething: hubFn }),
        }));
        const rows = TABLE.cases.map((c) => {
            const answers = {};
            fns.forEach((f) => { answers[f.where] = f.fn(c.value, c.key); });

            return { name: c.name, value: c.value, key: c.key, answers };
        });
        process.stdout.write('[gh704] what each browser copy answers:\n'
            + rows.map((r) => '[gh704]   ' + r.name.padEnd(44)
                + ' cascade=' + r.answers['assets/cascade-orchestrator.js']
                + ' hub=' + r.answers['assets/hub-orchestrator.js']).join('\n') + '\n');

        // The universe is real: a table that shrank would make agreement meaningless.
        expect(rows.length).toBeGreaterThan(10);

        /**
         * WHAT IS HELD, AND AGAINST WHAT. Comparing the two browser copies with each other proves
         * nothing now: the cascade delegates, so they cannot disagree. Each is checked against the
         * answer DECLARED in the table — an external source, the same one the server's case reads —
         * so a change in either language reddens that language's own case instead of the two moving
         * together and agreeing all the way down.
         */
        const wrong = rows.filter((r) => {
            const declared = TABLE.cases.find((c) => c.name === r.name).expected;

            return r.answers['assets/cascade-orchestrator.js'] !== declared
                || r.answers['assets/hub-orchestrator.js'] !== declared;
        });
        expect(wrong.map((r) => r.name + ': declared '
            + TABLE.cases.find((c) => c.name === r.name).expected
            + ', got ' + JSON.stringify(r.answers))).toEqual([]);
    });

    test('the two browser copies are ONE implementation, not two that agree', () => {
        /**
         * The repair this item is for. Agreement measured today is agreement today; what makes it
         * hold is there being one implementation. `cascade-orchestrator.js` says in its own header
         * that it is included AFTER `hub-orchestrator.js`, so the later file can take the predicate
         * from the earlier one rather than carry its own.
         */
        const cascade = fs.readFileSync(path.join(ROOT, 'assets/cascade-orchestrator.js'), 'utf8');
        const hub = fs.readFileSync(path.join(ROOT, 'assets/hub-orchestrator.js'), 'utf8');

        // The one that defines it, and says so.
        expect(hub).toContain('GAIP_producedSomething');
        // The one that takes it, and has no body of its own any more.
        expect(cascade).toContain('GAIP_producedSomething');
        // The cascade still has a function of that name — it is the one that ASKS. What it must not
        // have is a body of its own, so the claim is about the body rather than about the name.
        const body = functionTextFrom('assets/cascade-orchestrator.js', 'producedSomething');
        process.stdout.write('[gh704] what the cascade keeps:\n' + body + '\n');
        expect(body).toContain('global.GAIP_producedSomething(value)');
        expect(body).not.toContain("status === 'Error'");
        expect(body).not.toContain('Object.keys(value).length');
        // And it refuses rather than judging when the shared one is absent: a private fallback here
        // would be the copy coming straight back, quietly.
        expect(body).toContain('throw new Error');

        // What it does with the shared one, and without it — measured rather than read.
        const hubFn = callable('assets/hub-orchestrator.js', 'producedSomething');
        const asking = callable('assets/cascade-orchestrator.js', 'producedSomething', { GAIP_producedSomething: hubFn });
        const alone = callable('assets/cascade-orchestrator.js', 'producedSomething', {});
        expect(asking({ a: 1 })).toBe(hubFn({ a: 1 }));
        expect(asking({ status: 'Error' })).toBe(hubFn({ status: 'Error' }));
        expect(() => alone({ a: 1 })).toThrow(/produced predicate is not available/);
    });

    test('no view loads the cascade without the file that defines the predicate', () => {
        /**
         * The dependency this repair introduces, held rather than trusted to a comment.
         *
         * WHAT IS ASSERTED IS PRESENCE, NOT ORDER, and the difference was measured rather than
         * assumed: `stadium.blade.php` names the cascade BEFORE the hub, and that is not a fault
         * here, because the predicate is looked up when it is CALLED — from the run loop — and not
         * while either file is loading. Asserting the order would have made this case red about a
         * page that works, which is the same as asserting nothing. What must hold is that the hub is
         * on the page at all; the order each view happens to use is printed beside it.
         */
        const VIEWS = path.join(ROOT, 'app', 'resources', 'views');
        const rows = [];
        (function walk(dir) {
            fs.readdirSync(dir).forEach((name) => {
                const full = path.join(dir, name);
                if (fs.statSync(full).isDirectory()) return walk(full);
                if (!name.endsWith('.blade.php')) return;
                const src = fs.readFileSync(full, 'utf8');
                const cascade = src.indexOf('cascade-orchestrator.js');
                if (cascade === -1) return;
                const hub = src.indexOf('hub-orchestrator.js');
                rows.push({
                    view: path.relative(VIEWS, full),
                    hubAt: hub, cascadeAt: cascade,
                    ok: hub !== -1,
                    orderInTheFile: hub === -1 ? 'no hub' : (hub < cascade ? 'hub first' : 'cascade first'),
                });
            });
        })(VIEWS);
        process.stdout.write('[gh704] views loading the cascade (' + rows.length + '):\n'
            + rows.map((r) => '[gh704]   ' + r.view + '  hub@' + r.hubAt + ' cascade@' + r.cascadeAt
                + '  ' + r.orderInTheFile + (r.ok ? '' : '  THE HUB IS MISSING')).join('\n') + '\n');

        // The universe is real: if no view loaded the cascade, this case would say nothing.
        expect(rows.length).toBeGreaterThan(0);
        expect(rows.filter((r) => !r.ok).map((r) => r.view)).toEqual([]);
    });

    test('the census of copies: the universe is the tree, and its boundary is named', () => {
        /**
         * M4 of the plan. The universe is a walk of `assets/*.js` and `app/app/**`, not a list
         * written here; the sign is the form of the body — the literals `'Error'` and
         * `'Not available'` standing next to a test of emptiness.
         *
         * THE BOUNDARY, said out loud because a census that does not name it reads as complete: a
         * copy that spells those two through an extracted constant, or in any other words, is NOT
         * caught. This finds the shape that exists today, and it would not find one written to avoid
         * it — which is a limit of the sign, not of the walk.
         */
        const found = [];
        const walk = (dir, keep) => {
            fs.readdirSync(dir).forEach((name) => {
                const full = path.join(dir, name);
                if (fs.statSync(full).isDirectory()) {
                    if (name === 'node_modules' || name === 'vendor') return;

                    return walk(full, keep);
                }
                if (!keep(name)) return;
                const src = fs.readFileSync(full, 'utf8');
                // THE SIGN IS THE FORM OF A BODY, not the presence of the two words in a file. The
                // first version asked only whether both literals appear anywhere, and it named
                // `cascade-orchestrator.js` — which carries them for its own refusals
                // (`{ status: 'Not available' }`) and no longer holds the predicate at all. A sign
                // that cannot tell a copy from a user of the same words counts users.
                const windows = src.split(/function |public static function /).slice(1);
                const isCopy = windows.some((w) => {
                    const head = w.slice(0, 900);

                    return head.includes("'Error'") && head.includes("'Not available'")
                        && (head.includes('Object.keys') || head.includes('length > 0')
                            || head.includes('!== []') || head.includes('=== []'));
                });
                if (isCopy) found.push(path.relative(ROOT, full));
            });
        };
        walk(path.join(ROOT, 'assets'), (n) => n.endsWith('.js') && !n.endsWith('.min.js'));
        walk(path.join(ROOT, 'app', 'app'), (n) => n.endsWith('.php'));
        process.stdout.write('[gh704] files carrying both literals (' + found.length + '): '
            + JSON.stringify(found.sort()) + '\n');

        // The walk reached something, or "no copies" is what an empty walk says too.
        expect(found.length).toBeGreaterThan(0);
        // THE LIST, not its length: two places carry the predicate now — the one browser definition
        // and the server's own. The cascade is no longer among them.
        expect(found.sort()).toEqual([
            'app/app/Support/AnalysisResults.php',
            'assets/hub-orchestrator.js',
        ]);
    });
});

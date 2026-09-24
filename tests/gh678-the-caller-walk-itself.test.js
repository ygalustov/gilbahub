/**
 * GH-678 — THE CALLER WALK'S OWN GUARDS.
 *
 * The walk that resolves which runner executes a node is a tool, and the tools in this
 * repository have turned out to carry the same faults as the product. Three of its faults
 * were found by its own output, each of them a FALSE SIGNAL rather than a crash, and each
 * repair is guarded here — because a repair with no guard lasts until the next form of the
 * same thing.
 *
 *   1. LITERALS ARE MASKED BEFORE BRACES ARE COUNTED. A brace inside a string ended a
 *      method's range a hundred lines early, and a call inside that method came out owned
 *      by a method that had already closed — then by nobody at all.
 *   2. FIVE FORMS OF FUNCTION, NOT THREE. `async function` and an arrow assigned to a
 *      name were missing, so a call inside one of them was attributed to MODULE TOP LEVEL,
 *      which in this walk means "a page entry point". A wrong root is worse than no root:
 *      the walk is satisfied, the equality closes, and a node is credited with an executor
 *      it does not have. This is the one shape in the mechanism whose error comes out
 *      GREEN, which is the reviewer's reason for demanding the guard.
 *   3. THE UNIVERSE INCLUDES THE VIEWS' INLINE `<script>`. A call from a view's own script
 *      is a page entry point of that view; without the views a legal branch would redden
 *      as `unresolved executor`.
 */

'use strict';

const path = require('path');
const fs = require('fs');
const walk = require('./helpers/gh678-caller-walk');

const ROOT = path.join(__dirname, '..');

describe('GH-678 — the walk attributes a call to the function that really holds it', () => {
    const CALENDAR = 'assets/nutrition-calendar.js';

    test('M17: a call inside an arrow/async method belongs to THAT method, not to module top level', () => {
        /**
         * The subject is real and named: `nutrition-calendar.js` writes the site config
         * from inside `generate`, the Generate button's own handler, and again from inside
         * a listener registered in `bindEvents`. Both sit in forms a hand-written pattern
         * list did not cover, and with that list they came out as MODULE TOP LEVEL — which
         * in this walk means a PAGE ENTRY POINT. That error comes out green: the walk is
         * satisfied and a node is credited with an executor it does not have.
         *
         * The forms now come from `@babel/types`' own alias for functions, so this case
         * reddens the day attribution goes back to a written list of forms.
         */
        const f = walk.analyse(CALENDAR);
        const writes = f.uses.filter((u) => u.name === 'persistSiteConfigPatch' && u.how === 'member call');
        process.stdout.write('[gh678] the config writes and the function that holds each: '
            + JSON.stringify(writes.map((u) => u.line + ' in ' + u.enclosing
                + (u.atTopLevel ? ' [TOP LEVEL]' : ''))) + '\n');

        expect(writes.length).toBe(2);
        expect(writes.map((u) => u.enclosing).sort()).toEqual(['bindEvents', 'generate']);
        expect(writes.some((u) => u.atTopLevel)).toBe(false);
    });

    test('the six forms come from the parser, not from a list in this file', () => {
        // The repair's own guard: a written list of forms is what this device stopped
        // using, and `Function` is the alias that replaced it.
        const forms = require('@babel/types').FLIPPED_ALIAS_KEYS.Function;
        process.stdout.write('[gh678] function forms the parser knows (' + forms.length + '): '
            + JSON.stringify(forms) + '\n');
        expect(forms.length).toBeGreaterThanOrEqual(6);
        expect(forms).toContain('ArrowFunctionExpression');
        expect(forms).toContain('ObjectMethod');
    });

    test('the call-node list is the PARSER\'s set, both directions', () => {
        /**
         * WRITTEN LIST 1, and the universe it is checked against is the parser's schema
         * rather than the node types that happen to appear in the files we read. Taken
         * from what was seen, it would be the list checking itself — and it would name a
         * missing type only once a case of it existed. Declared: this guard reddens
         * BEFORE such a case exists.
         */
        const fromParser = walk.callNodeTypesFromTheParser();
        const written = walk.CALL_NODE_TYPES.slice().sort();
        process.stdout.write('[gh678] call-node types — parser: ' + JSON.stringify(fromParser)
            + ' | written: ' + JSON.stringify(written) + '\n');

        expect({ missingFromTheWrittenList: fromParser.filter((t) => !written.includes(t)),
            writtenButNotInTheSchema: written.filter((t) => !fromParser.includes(t)) })
            .toEqual({ missingFromTheWrittenList: [], writtenButNotInTheSchema: [] });
    });

    test('every file of `assets` parses WHOLE — a partial parse is a piece of the universe lost', () => {
        /**
         * `errorRecovery: true` does not throw for every error: some go into `ast.errors`
         * and a PARTIAL tree comes back. A walk that reads the partial tree and says
         * nothing has dropped part of a file out of its universe. Both roads are recorded
         * and both are asserted here, and the boundary is a NAMED LIST rather than a
         * count: the views' inline scripts that carry Blade syntax cannot be parsed as
         * JavaScript, and each one is named with what went wrong.
         */
        const files = walk.universe();
        const broken = files.filter((f) => f.failed.length);
        const assetsBroken = broken.filter((f) => f.rel.startsWith('assets/'));
        process.stdout.write('[gh678] files parsed: ' + files.length
            + ' | partial or failed: ' + broken.length + ' | of those in `assets`: '
            + assetsBroken.length + '\n');
        broken.slice(0, 3).forEach((f) => process.stdout.write('[gh678]    ' + f.rel
            + ' — ' + f.failed[0].slice(0, 90) + '\n'));

        // The claim: no file of the code the walk is ABOUT is read in part. The views'
        // inline scripts are a named boundary, carried in the ratchet list, not here.
        expect({ filesOfAssetsReadOnlyInPart: assetsBroken.map((f) => f.rel + ' — ' + f.failed[0]) })
            .toEqual({ filesOfAssetsReadOnlyInPart: [] });
    });

    test('A FILE THE PARSE CANNOT READ REDDENS WITH ITS NAME — planted, and it stays', () => {
        /**
         * A PERMANENT CASE, not a one-off measurement, and the analyst's reason is the
         * point: the comment beside `errorRecovery: true` only WARNS the next reader, while
         * this case HOLDS the pair. Remove the `ast.errors` check with recovery left on and
         * this goes red — rather than the removal resting on somebody remembering a comment.
         *
         * The file is NEW. Planting the syntax in a file the universe already lists would
         * show only that it re-reads what it knows.
         */
        const probe = path.join(ROOT, 'assets', '__gh678_unparseable_delete_me.js');
        try {
            // THE SYNTAX IS CHOSEN BY MEASUREMENT, NOT BY LIKENESS, and the measurement
            // is the reviewer's condition: the parse has TWO roads out, THROWN and
            // RECOVERED, and a probe on the thrown road would be green even with the
            // `ast.errors` reading deleted — it would guard the `try/catch` and leave the
            // half this was all built for bare. Measured across eleven candidates:
            // `1 |> f` and a decorator THROW; an unsyntactic `break` RECOVERS and puts one
            // entry in `ast.errors`. So the probe takes the recovered road.
            fs.writeFileSync(probe, [
                '// GH-678 probe. Created and deleted by the case that plants it.',
                '// Syntax Babel RECOVERS from with `errorRecovery: true`: it parses, and the',
                '// error goes into `ast.errors` instead of being thrown. Remove the reading of',
                '// `ast.errors` and this file becomes invisible — which is what this case holds.',
                'function gh678Probe() { return 1; }',
                'break;',
                '',
            ].join('\n'), 'utf8');

            const files = walk.universe();
            const planted = files.find((f) => f.rel === 'assets/__gh678_unparseable_delete_me.js');
            process.stdout.write('[gh678] the planted file — seen: ' + !!planted
                + ' | problems: ' + JSON.stringify((planted || {}).failed) + '\n');

            // Seen at all, and seen as BROKEN with its own name. Either road counts: a
            // throw, or a recovered parse whose `ast.errors` is not empty.
            expect(planted).toBeDefined();
            expect(planted.failed.length).toBeGreaterThan(0);
            // And it is the RECOVERED road, named: a `threw:` here would mean the case
            // has quietly moved onto the other branch and stopped guarding the reading.
            expect(planted.failed.join(' ')).toMatch(/recovered:/);
            expect(planted.failed.join(' ')).not.toMatch(/threw:/);
        } finally {
            if (fs.existsSync(probe)) fs.unlinkSync(probe);
        }
    });

    test('and with the probe gone the universe is whole again', () => {
        const files = walk.universe();
        expect(files.find((f) => f.rel === 'assets/__gh678_unparseable_delete_me.js')).toBeUndefined();
        expect(files.filter((f) => f.rel.startsWith('assets/') && f.failed.length)).toEqual([]);
    });

    test('the universe reaches the views: a view\'s inline script is a place the walk can see', () => {
        // Repair 3, measured rather than declared. The views are listed from disk and at
        // least one inline script is found and non-empty, so a root inside one is
        // reachable at all — the half of M15 that proves the universe.
        const scripts = walk.viewScripts();
        const views = [...new Set(scripts.map((s) => s.view))];
        process.stdout.write('[gh678] views with an inline script: ' + views.length
            + ' | blocks: ' + scripts.length + '\n');
        expect(views.length).toBeGreaterThan(5);
        expect(scripts.some((s) => s.body.length > 200)).toBe(true);
    });
});

/**
 * GH-678 — THE RATCHET ON `unresolved executor`, AND IT IS A LIST, NOT A COUNT.
 *
 * Four defaults were taken out of this mechanism in one day — by kind, by depth, by
 * universe, and by form — and what replaced them is a place that COLLECTS the unknown
 * instead of filling it with something plausible. A place like that accumulates silence: a
 * call that used to resolve and stopped lands there and nobody notices. The example is on
 * the record — `readsWithNoPlaceInTheList` on five nodes, which took a separate condition
 * to make it leave.
 *
 * So the list is ratcheted BY NAME. A new place reddens with its key and its chain; a
 * listed place that now resolves reddens as "resolved, remove from the list" — ageing in
 * the safe direction is not allowed either, because an entry left behind would hide the
 * next place with the same key.
 *
 * THE LIST IS MEASURED UNDER A VERSION OF THE RESOLUTION RULE — a fingerprint of the
 * resolver's own tokens. Repairing the rule moves the list, and without the version that
 * growth would read as growth caused by the code, which is the mistake the changelog guard
 * made with its sign. A change of rule is an announced event.
 */
describe('GH-678 — the three lists, and a zero that means something', () => {
    const LIST = JSON.parse(fs.readFileSync(
        path.join(ROOT, 'tests', 'fixtures', 'gh678-unresolved-executors.json'), 'utf8'));
    const REGISTRIES = {
        'assets/cascade-orchestrator.js:runCascade': 'cascade',
        'assets/hub-orchestrator.js:runComputePass': 'orchestrator',
        'assets/hub-orchestrator.js:computeAll': 'orchestrator',
        'assets/hub-persistence.js:_writeResult': 'producer',
        'assets/hub-persistence.js:cacheAnalysisResults': 'producer',
    };
    const graph = () => JSON.parse(fs.readFileSync(
        path.join(ROOT, 'assets', 'dependency-graph.json'), 'utf8'));
    const measure = () => walk.splitDeadFromUnresolved(
        walk.currentUnresolved({ graph: graph(), registries: REGISTRIES }));

    /** A tally over the DECLARED universe, so a kind that did not occur prints a zero. */
    const tally = (list, universe) => {
        const out = {};
        universe.forEach((k) => { out[k] = 0; });
        Object.values(list).forEach((e) => { out[e.kind || e.why] = (out[e.kind || e.why] || 0) + 1; });

        return out;
    };

    test('the summary enumerates each DECLARED universe in full, with explicit zeros', () => {
        /**
         * The reviewer's condition, and the hole it closes was mine: the summary printed only the
         * kinds that OCCURRED, so `cycle-without-root` was simply absent — and I read the absence
         * as a zero and reported it, and the analyst read my zero as her prediction confirmed. An
         * absent kind and a kind with no producer were the same line of output. With the declared
         * universe printed in full, "there is no such case" and "there is nobody to produce it"
         * become different lines.
         */
        const { edges, empty, unread } = measure();
        const e = tally(edges, walk.EDGE_UNRESOLVED);
        const f = tally(empty, walk.FUNCTION_EMPTY);
        const u = tally(unread, walk.UNREAD_UNIVERSE);
        process.stdout.write('[gh678] EDGE_UNRESOLVED (' + Object.keys(edges).length + '): '
            + JSON.stringify(e) + '\n'
            + '[gh678] FUNCTION_EMPTY  (' + Object.keys(empty).length + '): ' + JSON.stringify(f) + '\n'
            + '[gh678] UNREAD_UNIVERSE (' + Object.keys(unread).length + '): ' + JSON.stringify(u) + '\n');

        // Every declared kind appears in its summary, present or not.
        walk.EDGE_UNRESOLVED.forEach((k) => expect(e).toHaveProperty(k));
        walk.FUNCTION_EMPTY.forEach((k) => expect(f).toHaveProperty(k));
        walk.UNREAD_UNIVERSE.forEach((k) => expect(u).toHaveProperty(k));
    });

    test('the three universes do not overlap, and that is derived rather than believed', () => {
        // The reviewer's fourth point: a shared kind between two lists is computable, so it is
        // computed. Two subjects under one name is the fault this split repairs.
        const overlap = walk.EDGE_UNRESOLVED.filter((k) => walk.FUNCTION_EMPTY.includes(k)
            || walk.UNREAD_UNIVERSE.includes(k))
            .concat(walk.FUNCTION_EMPTY.filter((k) => walk.UNREAD_UNIVERSE.includes(k)));
        process.stdout.write('[gh678] kinds declared in more than one universe: '
            + JSON.stringify(overlap) + '\n');

        expect({ kindsInTwoUniverses: overlap }).toEqual({ kindsInTwoUniverses: [] });
    });

    test('a kind with no producer reddens — and the producer is found by PARSING THIS FILE', () => {
        /**
         * The reviewer's second condition. A hand-written map of kind to producer ages on the day
         * somebody adds a kind; this file parses JavaScript for a living, so it parses itself: a
         * kind is produced if some line of the helper emits it. `cycle-without-root` standing at
         * nothing for a day was exactly a kind with nobody to produce it.
         */
        const helper = fs.readFileSync(path.join(ROOT, 'tests', 'helpers', 'gh678-caller-walk.js'), 'utf8');
        const declaration = /const (?:EDGE_UNRESOLVED|FUNCTION_EMPTY|UNREAD_UNIVERSE) = \[[^\]]*\]/g;
        const body = helper.replace(declaration, '');
        const producers = {};
        walk.UNRESOLVED_KINDS.forEach((kind) => {
            const lines = body.split('\n')
                .map((l, i) => ({ l, i: i + 1 }))
                // BOTH FORMS COUNT. A kind is emitted either as itself or as the head of an
                // edge marker (`'not-loaded@' + file`), and matching only the closing quote made
                // the guard check a SPELLING instead of the presence of a producer — which is the
                // fault it was built against.
                .filter(({ l }) => new RegExp("'" + kind + "(?:'|@)").test(l)
                    && !/^\s*(\*|\/\/)/.test(l));
            producers[kind] = lines.map(({ i }) => i);
        });
        const withNoProducer = Object.entries(producers)
            .filter(([, lines]) => !lines.length).map(([kind]) => kind);
        process.stdout.write('[gh678] kind -> the lines of this helper that emit it: '
            + JSON.stringify(producers) + '\n');

        expect({ kindsNothingProduces: withNoProducer }).toEqual({ kindsNothingProduces: [] });
    });

    test('a zero is only a zero if the producer RAN — the resolutions are counted', () => {
        /**
         * The reviewer's third condition. `member-ambiguous: 0` with a live producer and
         * `member-ambiguous: 0` with a producer nothing reached print the same line. So the
         * number of resolutions actually attempted is printed beside it: the producer was called
         * this many times and found no case. Establishing that by reading the code is the method
         * this day has refused four times.
         */
        measure();
        const attempts = walk.resolutionsAttempted();
        process.stdout.write('[gh678] member resolutions attempted: ' + attempts + '\n');

        expect(attempts).toBeGreaterThan(1000);
    });

    test('the lists were measured under the perimeter in force, and a change NAMES ITS FUNCTION', () => {
        /**
         * The reviewer's condition on the fingerprint. A whole-file fingerprint reddens on a comma
         * in a comment and its red never names a subject -- he measured that: the version moved
         * from an edit inside a loop with nothing to point at. So the perimeter is fingerprinted
         * PER FUNCTION, and what is compared is the map: the red says which function's tokens
         * moved.
         *
         * The perimeter itself is DERIVED, starting at the producer of the lists and following the
         * calls this file makes, so `rootsByFixpoint` is inside it by derivation rather than by a
         * decision — which is how his question about it closes.
         */
        const now = walk.resolutionPerimeter();
        const then = LIST.resolutionPerimeter || {};
        const moved = Object.keys(now).filter((fn) => then[fn] && then[fn] !== now[fn]);
        const added = Object.keys(now).filter((fn) => !then[fn]);
        const gone = Object.keys(then).filter((fn) => !now[fn]);
        process.stdout.write('[gh678] resolution perimeter: ' + Object.keys(now).length
            + ' functions, version ' + walk.resolverRuleVersion()
            + ' | the lists were measured under ' + LIST.resolverRuleVersion + '\n'
            + '[gh678] functions whose tokens moved: ' + JSON.stringify(moved) + '\n'
            + '[gh678] functions that joined the perimeter: ' + JSON.stringify(added)
            + ' | that left it: ' + JSON.stringify(gone) + '\n');

        expect({ tokensMoved: moved, joinedThePerimeter: added, leftThePerimeter: gone })
            .toEqual({ tokensMoved: [], joinedThePerimeter: [], leftThePerimeter: [] });
        expect(LIST.resolverRuleVersion).toBe(walk.resolverRuleVersion());
        // The perimeter is real: it starts at the producer and reaches the count.
        expect(Object.keys(now)).toContain('currentUnresolved');
        expect(Object.keys(now)).toContain('rootsByFixpoint');
        expect(Object.keys(now)).toContain('resolveMember');
    });

    test('BOTH DIRECTIONS on each list, by name', () => {
        const now = measure();
        /**
         * GH-689 (the reviewer's return on GH-685) — THE KEY AND THE REASON, not the key alone.
         *
         * This compared `Object.keys` and nothing else, so when `not-loaded` moved out of the count
         * and into the classifier, SEVENTY-ONE entries changed the reason they are on the list --
         * sixty-six of them keeping their key -- and this ratchet stayed green. His words: it
         * compared identities and not the content the item was done for. Only the five entries that
         * were newly LISTED moved it, and the re-kinding, which was the whole subject, passed
         * unseen.
         *
         * So there are three directions now, and the third prints BOTH reasons: a function that
         * stops being "nobody calls it" and becomes "its file is loaded by no view" is a different
         * statement about the same function, and a reader told the old one goes looking for a
         * missing call site that was never meant to exist.
         */
        const reasonOf = (entry) => (entry && (entry.kind || entry.why)) || null;
        const check = (name, current, listed) => {
            const appeared = Object.keys(current).filter((k) => !Object.prototype.hasOwnProperty.call(listed, k));
            const gone = Object.keys(listed).filter((k) => !Object.prototype.hasOwnProperty.call(current, k));
            const reasonChanged = Object.keys(current)
                .filter((k) => Object.prototype.hasOwnProperty.call(listed, k))
                .filter((k) => reasonOf(current[k]) !== reasonOf(listed[k]))
                .map((k) => k + ': ' + reasonOf(listed[k]) + ' -> ' + reasonOf(current[k]));
            process.stdout.write('[gh678] ' + name + ': now ' + Object.keys(current).length
                + ', listed ' + Object.keys(listed).length
                + ', reasons changed ' + reasonChanged.length + '\n');
            // THE WHOLE LIST, not the first four: a ratchet that reddens on a shift of five and
            // shows four of them leaves the fifth to be guessed at, and the difference between a
            // shift explained and a shift fitted is exactly the entries you never saw.
            appeared.forEach((k) => process.stdout.write('[gh678]    NEW: ' + k + '\n'));
            gone.forEach((k) => process.stdout.write('[gh678]    RESOLVED, remove: ' + k + '\n'));
            reasonChanged.forEach((k) => process.stdout.write('[gh678]    SAME KEY, OTHER REASON: ' + k + '\n'));

            return { appeared, gone, reasonChanged };
        };
        const e = check('EDGE_UNRESOLVED', now.edges, LIST.edges);
        const f = check('FUNCTION_EMPTY', now.empty, LIST.empty);
        const u = check('UNREAD_UNIVERSE', now.unread, LIST.unread);

        expect({
            newEdges: e.appeared, resolvedEdges: e.gone, edgeReasonsChanged: e.reasonChanged,
            newEmpty: f.appeared, resolvedEmpty: f.gone, emptyReasonsChanged: f.reasonChanged,
            newUnread: u.appeared, resolvedUnread: u.gone, unreadReasonsChanged: u.reasonChanged,
        }).toEqual({
            newEdges: [], resolvedEdges: [], edgeReasonsChanged: [],
            newEmpty: [], resolvedEmpty: [], emptyReasonsChanged: [],
            newUnread: [], resolvedUnread: [], unreadReasonsChanged: [],
        });
    });

    test('UNITY: the lists are fed by the FIXPOINT, and a broken count moves them BY NAME', () => {
        /**
         * The reason the two walks had to become one, made into a case. Under the reviewer's M22 the
         * verdicts of three modules moved and the ratchet did not stir -- 196 against 196, 37 dead
         * against 37 -- because the ratchet read the OTHER walk. Now there is one count, and this
         * proves the feeding rather than asserting it: the producer is handed a crippled fixpoint,
         * and the lists move.
         *
         * IT ASSERTS THE NAMES, NOT A NUMBER. "It named 65 entries" cannot tell the same
         * sixty-five from a different sixty-five, and that indifference is exactly how M22 passed
         * unnoticed.
         */
        const g = graph();
        const real = measure();
        const files = walk.universe();
        const handles = {};
        Object.entries(g.nodes).forEach(([id, n]) => {
            (Array.isArray(n.handle) ? n.handle : (n.handle ? [n.handle] : [])).forEach((h) => {
                handles[h.indexOf(':') !== -1 ? h.slice(h.indexOf(':') + 1) : h] = id;
            });
        });
        const fp = walk.rootsByFixpoint({ files, registries: REGISTRIES, handles });
        // The break: every value loses its roots, as a broken body would leave them.
        fp.value.forEach((v) => { v.roots.clear(); });
        const broken = walk.splitDeadFromUnresolved(
            walk.currentUnresolved({ graph: g, registries: REGISTRIES, fixpoint: fp, files })
        );

        const appeared = Object.keys(broken.empty)
            .filter((k) => !Object.prototype.hasOwnProperty.call(real.empty, k));
        process.stdout.write('[gh678] with the count broken, the EMPTY list gains '
            + appeared.length + ' entries; the first four by name: '
            + JSON.stringify(appeared.slice(0, 4)) + '\n');

        // The list moved, and it moved by names that were not there before.
        expect(appeared.length).toBeGreaterThan(0);
        expect(Object.keys(broken.empty).length).not.toBe(Object.keys(real.empty).length);
        appeared.slice(0, 4).forEach((k) => expect(real.empty[k]).toBeUndefined());
    });

    test('every entry of the empty list says how the absence was established, and none is confirmed', () => {
        const claiming = Object.entries(LIST.empty)
            .filter(([, e]) => e.confirmed || e.coversMemberOnAProperty).map(([k]) => k);
        const noProvenance = Object.entries(LIST.empty)
            .filter(([, e]) => !e.establishedBy).map(([k]) => k);
        process.stdout.write('[gh678] empty entries claiming confirmation: ' + claiming.length
            + ' | without provenance: ' + noProvenance.length + '\n');

        expect({ claiming, noProvenance }).toEqual({ claiming: [], noProvenance: [] });
    });

    test('THE THREE NAMES: two alive through an `on*` attribute, the third really dead', () => {
        /**
         * The reviewer's standing condition, and the subject the `on*` repair exists for. An
         * attribute is not JavaScript the scanner sees by default, so a function called ONLY from
         * one had no caller anywhere and arrived in the DEAD list -- the list that invites
         * deleting code. The Word export button is as client-facing as anything here.
         *
         * AND THE THIRD IS NOT A FALSE DEAD. `GilbaScenarioUI` is declared by two files; members
         * are resolved ON THE VIEW, and `gssh-whatif-ui.js` is loaded by no view at all, so its
         * `showWhatIfPanel` is dead in truth. Two alive, one dead, all three by name.
         */
        const files = walk.universe();
        const fp = walk.rootsByFixpoint({ files, registries: REGISTRIES, handles: {} });
        const valueOf = (needle) => {
            const key = [...fp.value.keys()].find((k) => k.endsWith(':' + needle.split(':')[1])
                && k.startsWith(needle.split(':')[0]));

            return key ? { key, v: fp.value.get(key) } : null;
        };
        const alive = (x) => !!x && x.v.roots.size > 0;

        const wordButton = [...fp.value.keys()].find((k) => k.endsWith(':rpExportWordWithPicker'));
        const gaip = valueOf('assets/gaip-whatif-ui.js:showWhatIfPanel');
        const gssh = valueOf('assets/gssh-whatif-ui.js:showWhatIfPanel');
        process.stdout.write('[gh678] the Word export button: ' + wordButton + ' -> roots '
            + JSON.stringify([...fp.value.get(wordButton).roots]) + '\n'
            + '[gh678] gaip showWhatIfPanel -> roots ' + JSON.stringify([...gaip.v.roots]) + '\n'
            + '[gh678] gssh showWhatIfPanel -> roots ' + JSON.stringify([...gssh.v.roots])
            + ' (loaded by ' + JSON.stringify(walk.viewsLoading('assets/gssh-whatif-ui.js')) + ')\n');

        expect(fp.value.get(wordButton).roots.size).toBeGreaterThan(0);
        expect(alive(gaip)).toBe(true);
        expect(alive(gssh)).toBe(false);
        expect(walk.viewsLoading('assets/gssh-whatif-ui.js')).toEqual([]);
    });

    test('files no view loads are named, because their top level is not an entry point', () => {
        const none = walk.loadedByNoView();
        process.stdout.write('[gh678] files no view loads (' + none.length + '): '
            + JSON.stringify(none) + '\n');

        // Printed and asserted as a set: a file leaving or joining this list changes what the
        // walk counts as a page entry, and that must not happen quietly.
        expect(none.length).toBeGreaterThan(0);
        expect(none).toContain('assets/gssh-whatif-ui.js');
    });
});

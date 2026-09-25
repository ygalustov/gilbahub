/**
 * GH-644 (queue item 6, stage 0b, second half) — THE LIST OF INPUTS AND THE CODE
 * THAT READS THEM, COMPARED IN BOTH DIRECTIONS.
 *
 * THE UNIVERSE IS THE POINT, NOT THE COMPARISON. An input the calculation needs
 * and the list does not carry is visible ONLY by looking inside the engines. A
 * test whose universe comes from the list compares the list with itself and is
 * green forever. The analyst's own census missed the clay fraction for exactly
 * this reason — it is read by a cascade engine, with a stand-in of 20, and
 * nothing in the tree can fill it — and she named the remedy: the universe must
 * include the BODIES of the cascade engines.
 *
 * WHERE THE BODIES ARE. The cascade declares its engines in `engineMap`; their
 * code is in three places and all three are followed: a file of its own, a
 * function inside the cascade (`executeMLSNEngine`), or a function elsewhere in
 * the tree that the cascade calls through a global (`mlsnEngine` lives in
 * `hub-tissue-v3.js`). A body that cannot be located is named, not skipped.
 *
 * WHAT A READ IS MATCHED AGAINST. The key in the list, or one of the names the
 * list declares the run reads it under (`readAs`) — measured, because the state
 * the cascade builds uses its own spellings: `turf.hoc`, `site.construction`,
 * `soil.rootzoneType`, `turf.cultivar`. A name that is neither must be declared
 * in `notInputs` with what it is — a result another engine wrote, or something
 * derived. Anything left is an input nobody declared, and it is named here.
 */

'use strict';

const fs = require('fs');
const path = require('path');

const ROOT = path.join(__dirname, '..');
const asset = (f) => fs.readFileSync(path.join(ROOT, 'assets', f), 'utf8');

/**
 * GH-712 — A FILE THAT DISAPPEARS BETWEEN THE LISTING AND THE READ IS NAMED, NOT A CRASH.
 *
 * The universe is a directory listing, which is right, and the gap between listing it and
 * reading it is real: a full-suite run of this file died with
 * `ENOENT ... assets/__gh716_probe_delete_me.js` — somebody else's probe file, created and
 * removed while the scan was walking. The whole suite then failed to run, which is a red with
 * no subject, and it says nothing about the list or the engines.
 *
 * What vanished is recorded and printed by the positive control instead. Nothing is asserted
 * about it: a file that was never part of the product is not a defect of the product, and a file
 * the universe actually needed is already caught by `enginesWithNoBodyFound`.
 */
const vanished = [];
const assetIfPresent = (f) => {
    try {
        return asset(f);
    } catch (err) {
        if (err && err.code === 'ENOENT') { vanished.push(f); return ''; }
        throw err;
    }
};
const LIST = JSON.parse(asset('calculation-inputs.schema.json'));
const CASCADE = asset('cascade-orchestrator.js');

/** The sections of a run's state that carry inputs rather than results. */
const SECTIONS = ['turf', 'soil', 'water', 'climate', 'site', 'schedule', 'pgr', 'traffic', 'irrigation', 'location'];

/** `{engineId: source}` — the body of every engine the cascade declares. */
function engineBodies() {
    /**
     * GH-681: THE UNIVERSE MOVED TO THE GRAPH, because the literal it read is gone.
     *
     * This took the engine ids out of `engineMap: {` in the adapter's TEXT. That map was one
     * of three hand-written declarations of the same facts and it is derived from
     * `assets/dependency-graph.json` now, so the text has nothing to parse — and a universe
     * that finds nothing makes this whole file fail to run, which is a red with no subject.
     *
     * The engines of the cascade are the nodes whose handle is declared in the adapter's file,
     * which the data states. Same set, one owner.
     */
    const graph = JSON.parse(fs.readFileSync(path.join(ROOT, 'assets', 'dependency-graph.json'), 'utf8'));
    const ids = Object.entries(graph.nodes).filter(([, n]) => {
        const handles = Array.isArray(n.handle) ? n.handle : (n.handle ? [n.handle] : []);

        return handles.some((h) => typeof h === 'string'
            && h.indexOf('assets/cascade-orchestrator.js:') === 0);
    }).map(([id]) => id);
    // No assertion here on purpose: a claim made while the suite is being built
    // fails the WHOLE FILE, and "the suite did not run" is a red without a
    // subject — indistinguishable from a broken import. The size of the universe
    // is asserted by the positive control, where it can print what it found.
    // (The reviewer's own mutation — the engine list replaced by two literal
    // names — is what showed the difference.)

    const files = fs.readdirSync(path.join(ROOT, 'assets')).filter((f) => f.endsWith('.js'));
    const camel = (id) => id.replace(/-engine$/, '').split('-')
        .map((p) => p[0].toUpperCase() + p.slice(1)).join('');
    const balanced = (src, from) => {
        let depth = 0;
        for (let i = src.indexOf('{', from); i < src.length; i++) {
            if (src[i] === '{') depth++;
            else if (src[i] === '}') { depth--; if (!depth) return src.slice(from, i + 1); }
        }
        return '';
    };

    /**
     * GH-712 — a named function's body together with THE NAME ITS OWN SIGNATURE GIVES THE STATE.
     *
     * The scan below matched a read only when the receiver was spelled `state`, `inputs` or `s`,
     * and the engines in `hub-tissue-v3.js` are declared `gaip_firmness_engine(e, t)`. So
     * `e.turf.drainage` was invisible: the body was IN the universe and the read was not, which
     * is the failure this file exists to prevent, one level down. The receiver is taken from the
     * declaration rather than from a list of likely names, so renaming the parameter cannot
     * quietly empty the scan.
     */
    const declaredFunction = (src, name) => {
        const at = src.search(new RegExp('function\\s+' + name + '\\s*\\('));
        if (at < 0) return null;
        const param = (new RegExp('function\\s+' + name + '\\s*\\(\\s*([A-Za-z_$][\\w$]*)')
            .exec(src) || [])[1] || null;

        return { body: balanced(src, at), param };
    };

    const bodies = {};
    const missing = [];
    /**
     * GH-712 — THE SAME ENGINES, READ AT A NARROWER GRAIN, AND THE STATE ASSEMBLY WITH THEM.
     *
     * `bodies` holds whole FILES, which is right for the old scan and wrong for a scan that
     * takes the receiver from a signature: a file carries functions that are not engines at all.
     * A unit is therefore one declared function — the adapter's wrapper, the delegate it calls,
     * the assembly that builds the cascade's state — or a file that is an engine entire. Both
     * scans run and the reads are UNIONED, so this widening cannot subtract.
     */
    const units = [];
    ids.forEach((id) => {
        /**
         * GH-681: THE ENGINE'S FILE IS FOUND THROUGH THE ADAPTER'S DELEGATE, not by spelling
         * the id. Two nodes were renamed to what the graph calls them — `mlsn-calculator`,
         * `water-blender` — and a lookup built out of the id's own letters stopped finding
         * `mlsn-engine.js` and the water engine. A rule about spelling is not a fact about
         * where the code is: the adapter's executor calls `global.<name>(...)`, and the file
         * that declares that name is the engine's file.
         */
        const handles = Array.isArray(graph.nodes[id].handle)
            ? graph.nodes[id].handle : [graph.nodes[id].handle];
        const executor = (handles.find((h) => typeof h === 'string'
            && h.indexOf('assets/cascade-orchestrator.js:') === 0) || '').split(':')[1] || '';
        const body = executor ? balanced(CASCADE, CASCADE.indexOf('function ' + executor + '(')) : '';
        const delegate = (/(?:global|window)\.(\w+)\s*\(/.exec(body) || [])[1] || null;
        const byDelegate = delegate
            ? files.find((f) => new RegExp('function\\s+' + delegate + '\\s*\\(')
                .test(assetIfPresent(f)))
            : null;
        units.push({ label: id + ' :: adapter wrapper ' + (executor || '(none declared)'), src: body });
        if (byDelegate) {
            const called = declaredFunction(assetIfPresent(byDelegate), delegate);
            if (called) {
                units.push({ label: id + ' :: ' + delegate + '(' + called.param + ') in ' + byDelegate,
                    src: called.body });
            }
        }
        const base = id.replace(/-engine$/, '');
        /**
         * BOTH ROADS ARE SCANNED, not the better one chosen — and the union is a repair of my
         * own change: locating the file through the adapter's delegate is more correct about
         * WHICH file, but it lands on the wrapper where the name convention landed on the
         * body, and bodies with reads fell from six to three. A lookup that is righter about
         * the address and poorer about the subject is not an improvement; scanning both loses
         * nothing and the duplicate reads collapse into a set anyway.
         */
        const byName = [id + '.js', id + '-pure.js', base + '-engine.js',
            base + '-engine-pure.js', base + '.js', base + '-model.js'].find((c) => files.includes(c));
        if (byName) units.push({ label: id + ' :: ' + byName + ', an engine file entire', src: assetIfPresent(byName) });
        const both = [byDelegate, byName].filter(Boolean);
        if (both.length) {
            bodies[id] = both.map((f) => assetIfPresent(f)).join('\n');

            return;
        }

        // `mlsn-engine` is spelled `executeMLSNEngine`, not `executeMlsnEngine`:
        // the wrapper's name is written the way a person writes an acronym. Both
        // spellings are tried rather than one being assumed.
        const inCascade = ['function execute' + camel(id) + 'Engine(',
            'function execute' + base.toUpperCase() + 'Engine(']
            .map((needle) => CASCADE.indexOf(needle)).find((i) => i > -1) ?? -1;
        if (inCascade > -1) {
            // The wrapper, plus the function it delegates to wherever that lives.
            let src = balanced(CASCADE, inCascade);
            const delegate = /global\.(\w+)\s*\(/.exec(src);
            if (delegate) {
                for (const f of files) {
                    const other = assetIfPresent(f);
                    const at2 = other.indexOf('function ' + delegate[1] + '(');
                    if (at2 > -1) { src += '\n' + balanced(other, at2); break; }
                }
            }
            bodies[id] = src;
            units.push({ label: id + ' :: inside the adapter', src });
            return;
        }
        missing.push(id);
    });

    /**
     * GH-712 — THE ORCHESTRATOR'S STATE ASSEMBLY, FOUND BY FOLLOWING THE ARGUMENT.
     *
     * What the assembly copies into the cascade's state IS an input of the run, whatever the
     * engines then do with it, and until now no universe here contained it. It is located
     * without naming it: the call to `runCascade(` names the variable it is handed, and the
     * function that built that variable is the assembly. A rename of the assembly moves this
     * with it; a hand-written name would not.
     */
    const assemblies = [];
    files.forEach((f) => {
        const src = assetIfPresent(f);
        const call = /runCascade\(\s*([A-Za-z_$][\w$]*)\s*,/.exec(src);
        if (!call) return;
        const built = new RegExp('(?:var|let|const)\\s+' + call[1] + '\\s*=\\s*([A-Za-z_$][\\w$]*)\\s*\\(')
            .exec(src);
        if (!built) return;
        const found = declaredFunction(src, built[1]);
        if (!found) return;
        const label = 'state assembly :: ' + built[1] + '(' + found.param + ') in ' + f;
        assemblies.push(label);
        units.push({ label, src: found.body });
    });

    return { bodies, missing, ids, units, assemblies };
}

/** Every input read inside those bodies, with the engine that reads it. */
function readsInEngines(bodies, units) {
    const out = new Map();
    Object.entries(bodies).forEach(([id, src]) => {
        for (const m of src.matchAll(/\b(?:state|inputs|s)\s*(?:&&\s*[\w.]+\s*)?\.\s*([a-zA-Z]+)\s*\.\s*([a-zA-Z_]\w*)/g)) {
            if (!SECTIONS.includes(m[1])) continue;
            const key = m[1] + '.' + m[2];
            if (!out.has(key)) out.set(key, id);
        }
    });

    /**
     * GH-712 — the second pass, over the declared functions, with each one's OWN receiver.
     *
     * It is a union with the pass above and never a replacement. Scanning a delegate's body
     * alone is sharper about which engine reads what, and it drops three names the whole-file
     * pass sees outside any delegate (`climate.historical`, `turf.ambientDLISource`,
     * `turf.turfType`) — measured. A sharper attribution that loses reads is not an
     * improvement, so both run.
     */
    (units || []).forEach((unit) => {
        for (const fn of unit.src.matchAll(/\bfunction\s+(\w+)?\s*\(\s*([A-Za-z_$][\w$]*)/g)) {
            const receiver = fn[2].replace(/\$/g, '\\$');
            const body = (() => {
                let depth = 0;
                for (let i = unit.src.indexOf('{', fn.index); i < unit.src.length; i++) {
                    if (unit.src[i] === '{') depth++;
                    else if (unit.src[i] === '}') { depth--; if (!depth) return unit.src.slice(fn.index, i + 1); }
                }
                return '';
            })();
            if (!body) continue;
            // `?.` is how the engines in hub-tissue-v3.js reach into the state, so the optional
            // link is part of the read, not noise to be stripped.
            const re = new RegExp('\\b' + receiver + '\\s*\\??\\.\\s*([a-zA-Z]+)\\s*\\??\\.\\s*([a-zA-Z_]\\w*)', 'g');
            for (const m of body.matchAll(re)) {
                if (!SECTIONS.includes(m[1])) continue;
                const key = m[1] + '.' + m[2];
                if (!out.has(key)) out.set(key, unit.label.split(' :: ')[0]);
            }
        }
    });

    return out;
}

/** The list's own vocabulary: a key, or a name the list says the run reads it under. */
function knownToTheList() {
    const out = new Map();
    Object.entries(LIST.inputs).forEach(([key, entry]) => {
        out.set(key, key);
        (entry.readAs || []).forEach((alias) => out.set(alias, key));
    });
    return out;
}

describe('GH-644 — the universe is the engines, not the list', () => {
    const { bodies, missing, ids, units, assemblies } = engineBodies();
    const reads = readsInEngines(bodies, units);

    test('POSITIVE CONTROL: every declared engine has a body, and the bodies read something', () => {
        // Two ways this comparison could be green over nothing: no bodies found,
        // or bodies found and nothing read out of them. Both are named here.
        const perEngine = {};
        reads.forEach((engine) => { perEngine[engine] = (perEngine[engine] || 0) + 1; });
        process.stdout.write('\n[gh644] engines declared: ' + ids.length
            + ' | bodies located: ' + Object.keys(bodies).length
            + ' | units scanned by signature: ' + units.length
            + ' | distinct input reads: ' + reads.size + '\n'
            + '[gh644] reads per engine: ' + JSON.stringify(perEngine) + '\n'
            + '[gh644] state assemblies located: ' + JSON.stringify(assemblies) + '\n'
            + '[gh644] files that vanished between the listing and the read: '
            + JSON.stringify(vanished) + '\n');

        /**
         * THE UNIVERSE ITSELF, asserted as a LIST where it can be seen — and the list replaced
         * a count of sixteen, which is the number the old hand-written map carried. Three of
         * those sixteen had stopped being true (`climate-engine`, `dew-prediction-engine`,
         * `disease-engine`: this adapter has no branch for any of them), so the pin was holding
         * the drift in place. Thirteen is the measured set; a count would have said only that
         * the number changed, not which engines.
         */
        expect(ids.slice().sort()).toEqual([
            'firmness-engine', 'mlsn-calculator', 'nopt-engine', 'phytotoxicity-engine',
            'salinity-penalty-engine', 'shade-engine', 'soil-structure-engine',
            'stress-trajectory-engine', 'tissue-engine', 'traffic-engine',
            'turf-manager-engine', 'water-blender', 'wear-recovery-engine',
        ]);
        expect({ enginesWithNoBodyFound: missing }).toEqual({ enginesWithNoBodyFound: [] });
        expect(reads.size).toBeGreaterThan(20);

        // FOUND BY MY OWN MUTATION: `reads.size > 20` does not tell a whole
        // universe from a collapsed one — emptying the body that lives outside the
        // cascade left 32 reads of 41 and this case still passed. So specific
        // witnesses are named, one per way a body is located: a file of its own, a
        // function inside the cascade, and a function the cascade reaches through a
        // global. Losing any of the three roads is red now.
        /**
         * GH-681: THE WITNESS NO LONGER DEPENDS ON WHO WON THE MAP. `reads` holds one engine
         * per input, so naming the engine for `soil.CEC` was really asserting which body the
         * scan reached FIRST — and once the engine bodies were located through the adapter's
         * delegate instead of by spelling the id, the shade engine's real body turned up and
         * reads `soil.CEC` too. The claim that matters is that the body reached through a
         * GLOBAL was scanned at all, and that is asserted directly.
         */
        expect(reads.get('soil.clay')).toBe('soil-structure-engine');   // a file of its own
        expect(perEngine['shade-engine']).toBeGreaterThan(0);           // reached through a global
        expect(perEngine['wear-recovery-engine']).toBeGreaterThan(0);   // reached through the adapter
        expect(reads.has('soil.CEC')).toBe(true);
        expect(reads.has('turf.hoc')).toBe(true);
        /**
         * GH-681: THE FLOOR IS THE NUMBER OF READS, NOT THE NUMBER OF BODIES THAT HELD THEM.
         *
         * Six was measured when each engine's body was a single file found by spelling its
         * id. Locating bodies through the adapter's delegate as well means one engine's source
         * can carry another's code, and `reads` hands an input to the FIRST engine that read
         * it — so the count of engines-with-reads became a fact about traversal order rather
         * than about the tree. It fell from six to three while the DISTINCT READS ROSE from 41
         * to 42: the universe grew and only the attribution concentrated.
         *
         * So the floor moved onto the thing that does not depend on who won: how much the
         * scan sees at all. The per-engine split is printed above and asserted only where it
         * names a ROAD — a file of its own, a global, the adapter — which is what it was for.
         */
        expect(reads.size).toBeGreaterThanOrEqual(41);
        expect(Object.keys(perEngine).length).toBeGreaterThan(0);

        /**
         * GH-712 — WITNESSES FOR THE WIDENING, each naming the road it proves rather than a total.
         *
         * The floor above was measured when a read had to be spelled `state.…`; it cannot tell
         * the widened universe from the old one, so a silent fall back to 42 would pass it. These
         * three say what the widening was FOR:
         *
         *   - `turf.drainage` is read by the firmness engine as `e.turf.drainage`, and the list
         *     has carried that claim in a comment while nothing could check it;
         *   - the state assembly was found by following `runCascade`'s argument, not by name;
         *   - the engines that read something are counted in double figures, where the whole-file
         *     scan attributed everything to three.
         */
        expect(reads.get('turf.drainage')).toBe('firmness-engine');
        expect(assemblies.length).toBeGreaterThan(0);
        expect(assemblies.some((a) => a.indexOf('hub-tissue-v3.js') > -1)).toBe(true);
        expect(Object.keys(perEngine).length).toBeGreaterThanOrEqual(11);
        expect(reads.size).toBeGreaterThanOrEqual(83);
    });

    test('DIRECTION ONE — an input the calculation reads and the list does not carry is named', () => {
        const known = knownToTheList();
        const notInputs = new Set(Object.keys(LIST.notInputs || {}).filter((k) => k !== '$comment'));
        const derived = new Set(Object.keys(LIST.derived || {}).filter((k) => k !== '$comment'));

        const undeclared = [];
        reads.forEach((engine, key) => {
            if (known.has(key) || notInputs.has(key)) return;
            // GH-712: BOTH SPELLINGS. `derived` carries leaves (`climateRegime`) and dotted keys
            // (`turf.grassType`) alike, and the leaf-only lookup could not see the dotted ones —
            // harmless while no universe here read them, a false finding the moment one did.
            if (derived.has(key) || derived.has(key.split('.')[1])) return;
            undeclared.push(key + ' (read by ' + engine + ')');
        });
        undeclared.sort();
        process.stdout.write('[gh644] read by an engine, declared nowhere: ' + JSON.stringify(undeclared) + '\n');

        expect({ inputsTheCalculationNeedsThatTheListDoesNotCarry: undeclared })
            .toEqual({ inputsTheCalculationNeedsThatTheListDoesNotCarry: [] });
    });

    test('DIRECTION TWO — an entry nobody reads is named, and its reason is in the list', () => {
        // The other side, and it is the one that keeps the list honest: an entry
        // read by nothing is either a name the product does not use or a
        // requirement of somebody else's — the wizard, Settings, the panel. Those
        // ARE readers, so the claim is narrowed to what it can actually see: an
        // entry read by no engine AND by no page has to say where it is filled in
        // and why it is there.
        const read = new Set([...reads.keys()]);
        const aliasesRead = (entry) => (entry.readAs || []).some((a) => read.has(a));

        const unread = [];
        Object.entries(LIST.inputs).forEach(([key, entry]) => {
            if (read.has(key) || aliasesRead(entry)) return;
            unread.push(key);
        });
        process.stdout.write('[gh644] in the list, read by no cascade engine (' + unread.length + '): '
            + unread.join(' ') + '\n');

        // Each of them must at least say where a person enters it, or it is a
        // requirement nobody can meet and nobody uses.
        const orphans = unread.filter((key) => {
            const entry = LIST.inputs[key];
            const hasPlace = Array.isArray(entry.filledIn) && entry.filledIn.length > 0;
            const isOpen = entry.required === null && typeof entry.decision === 'string';
            const isSample = key.startsWith('samples.');
            return !hasPlace && !isOpen && !isSample;
        });
        expect({ entriesNobodyReadsAndNobodyFills: orphans }).toEqual({ entriesNobodyReadsAndNobodyFills: [] });
    });

    test('what is read but is not an input says what it is instead', () => {
        // `notInputs` is not a permission list: each name carries what it is, so
        // "a result another engine wrote" cannot be used to excuse a real input.
        const notInputs = LIST.notInputs || {};

        /**
         * GH-712, RETURNED BY THE REVIEWER: A REASON MUST CARRY AN ADDRESS, NOT A WORD.
         *
         * This asked only that the reason contain `result` or `derived`. His words: "the method is
         * right, the entries are unverifiable" — he opened all 18 `notInputs` and 14 `derived` and
         * found no file, function or line in any of them, and measured five himself to check that
         * the classification was at least honest. A test satisfied by a word is satisfied by a
         * guess that contains the word, which is the same shape of hole as a census that counts
         * instead of listing.
         *
         * So every reason now names at least one pair `\`path\` / \`anchor\``, the file must
         * exist, and the anchor must occur in it. That is checkable against the tree rather than
         * against my prose, and it is what caught two entries while it was being filled: one key
         * nothing produces at all, and one that a lab report can supply — which makes the earlier
         * wording of both wrong rather than merely unverifiable.
         *
         * The pairs are printed, because "18 reasons checked" and "the loop never ran" read the
         * same otherwise.
         */
        const checked = [];
        const faults = [];
        // GH-712: `derived` carries reasons of exactly the same kind and was under no requirement
        // at all, which is where the reviewer opened 14 entries and found no address in any of
        // them. Both maps are held to the same rule, and which map an entry came from is printed,
        // so a rule that reached only one of them is visible.
        const withReasons = Object.entries(notInputs).map(([k, v]) => ['notInputs', k, v])
            .concat(Object.entries(LIST.derived || {}).map(([k, v]) => ['derived', k, v]));
        withReasons.forEach(([map, key, why]) => {
            if (key === '$comment') return;
            if (typeof why !== 'string') { faults.push(map + '.' + key + ': the reason is not a string'); return; }
            const pairs = [...why.matchAll(/`([\w./-]+\.(?:js|php|json))`\s*\/\s*`([^`]+)`/g)];
            if (!pairs.length) {
                faults.push(map + '.' + key + ': the reason names no `path` / `anchor` pair');

                return;
            }
            pairs.forEach(([, file, anchor]) => {
                const full = path.join(ROOT, file);
                if (!fs.existsSync(full)) { faults.push(map + '.' + key + ': ' + file + ' does not exist'); return; }
                const src = fs.readFileSync(full, 'utf8');
                if (src.indexOf(anchor) < 0) {
                    faults.push(map + '.' + key + ': ' + file + ' does not contain ' + JSON.stringify(anchor));

                    return;
                }
                checked.push(map + '.' + key + ' -> ' + file + ' :: ' + anchor);
            });
        });
        process.stdout.write('[gh644] reasons with an address opened and found (' + checked.length + '):\n');
        checked.forEach((c) => process.stdout.write('[gh644]   ' + c + '\n'));

        expect({ reasonsWithoutACheckableAddress: faults }).toEqual({ reasonsWithoutACheckableAddress: [] });
        // The loop ran over every entry, or an empty `faults` would mean nothing.
        expect(checked.length).toBeGreaterThanOrEqual(
            withReasons.filter(([, k]) => k !== '$comment').length);
        // And BOTH maps were reached, or one of them is under no rule again.
        expect(checked.some((c) => c.indexOf('notInputs.') === 0)).toBe(true);
        expect(checked.some((c) => c.indexOf('derived.') === 0)).toBe(true);
        /**
         * "AND IT MUST ACTUALLY BE READ" HAS MOVED, and the move is the analyst's plan
         * rather than a concession (59.5 item 7: the graph test rewrites this one).
         *
         * This file's universe is the CASCADE's engines. The orchestrator's
         * `build…Inputs` builders are in no universe here, so names they read —
         * `site.country` and `pgr.gddThreshold`, both read by `buildPreEmergentInputs`
         * — looked to this check like excuses for reads nobody makes. The check was
         * right to exist and wrong about the facts, because it was asking a question
         * its universe cannot answer.
         *
         * `tests/gh676-…` asks it over the wider universe — every script in `assets`,
         * both passes, delegates and builders — and reddens there. Names this universe
         * DOES see are still printed here, so the move is visible rather than silent.
         */
        const seenHere = Object.keys(notInputs).filter((k) => k !== '$comment' && reads.has(k));
        const notSeenHere = Object.keys(notInputs).filter((k) => k !== '$comment' && !reads.has(k));
        process.stdout.write('[gh644] `notInputs` names this universe reads: ' + JSON.stringify(seenHere) + '\n'
            + '[gh644] and names only the wider universe reads, checked in gh676: '
            + JSON.stringify(notSeenHere) + '\n');
        expect(seenHere.length).toBeGreaterThan(0);
        Object.keys(notInputs).forEach((key) => {
            if (key === '$comment') return;
        });
    });
});

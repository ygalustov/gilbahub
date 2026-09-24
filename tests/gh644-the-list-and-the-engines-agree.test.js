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

    const bodies = {};
    const missing = [];
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
                .test(fs.readFileSync(path.join(ROOT, 'assets', f), 'utf8')))
            : null;
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
        const both = [byDelegate, byName].filter(Boolean);
        if (both.length) {
            bodies[id] = both.map((f) => asset(f)).join('\n');

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
                    const other = asset(f);
                    const at2 = other.indexOf('function ' + delegate[1] + '(');
                    if (at2 > -1) { src += '\n' + balanced(other, at2); break; }
                }
            }
            bodies[id] = src;
            return;
        }
        missing.push(id);
    });

    return { bodies, missing, ids };
}

/** Every input read inside those bodies, with the engine that reads it. */
function readsInEngines(bodies) {
    const out = new Map();
    Object.entries(bodies).forEach(([id, src]) => {
        for (const m of src.matchAll(/\b(?:state|inputs|s)\s*(?:&&\s*[\w.]+\s*)?\.\s*([a-zA-Z]+)\s*\.\s*([a-zA-Z_]\w*)/g)) {
            if (!SECTIONS.includes(m[1])) continue;
            const key = m[1] + '.' + m[2];
            if (!out.has(key)) out.set(key, id);
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
    const { bodies, missing, ids } = engineBodies();
    const reads = readsInEngines(bodies);

    test('POSITIVE CONTROL: every declared engine has a body, and the bodies read something', () => {
        // Two ways this comparison could be green over nothing: no bodies found,
        // or bodies found and nothing read out of them. Both are named here.
        const perEngine = {};
        reads.forEach((engine) => { perEngine[engine] = (perEngine[engine] || 0) + 1; });
        process.stdout.write('\n[gh644] engines declared: ' + ids.length
            + ' | bodies located: ' + Object.keys(bodies).length
            + ' | distinct input reads: ' + reads.size + '\n'
            + '[gh644] reads per engine: ' + JSON.stringify(perEngine) + '\n');

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
    });

    test('DIRECTION ONE — an input the calculation reads and the list does not carry is named', () => {
        const known = knownToTheList();
        const notInputs = new Set(Object.keys(LIST.notInputs || {}).filter((k) => k !== '$comment'));
        const derived = new Set(Object.keys(LIST.derived || {}).filter((k) => k !== '$comment'));

        const undeclared = [];
        reads.forEach((engine, key) => {
            if (known.has(key) || notInputs.has(key)) return;
            if (derived.has(key.split('.')[1])) return; // named as worked out, not asked
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
        Object.entries(notInputs).forEach(([key, why]) => {
            if (key === '$comment') return;
            expect([key, typeof why]).toEqual([key, 'string']);
            expect([key, /result|derived/.test(why)]).toEqual([key, true]);
        });
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

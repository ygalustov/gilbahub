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
    const at = CASCADE.indexOf('engineMap: {');
    expect(at).toBeGreaterThan(-1);
    const block = CASCADE.slice(at, CASCADE.indexOf('}', at));
    const ids = [...block.matchAll(/'([a-z0-9-]+)':/g)].map((m) => m[1]);
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
        const base = id.replace(/-engine$/, '');
        const file = [id + '.js', id + '-pure.js', base + '-engine.js', base + '-engine-pure.js',
            base + '.js', base + '-model.js'].find((c) => files.includes(c));
        if (file) { bodies[id] = asset(file); return; }

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

        // THE UNIVERSE ITSELF, asserted where it can be seen: the cascade declares
        // sixteen engines, and a universe that shrank to a handful is the failure
        // this whole file exists against — it would compare the list with itself.
        expect({ enginesDeclaredByTheCascade: ids.length }).toEqual({ enginesDeclaredByTheCascade: 16 });
        expect({ enginesWithNoBodyFound: missing }).toEqual({ enginesWithNoBodyFound: [] });
        expect(reads.size).toBeGreaterThan(20);

        // FOUND BY MY OWN MUTATION: `reads.size > 20` does not tell a whole
        // universe from a collapsed one — emptying the body that lives outside the
        // cascade left 32 reads of 41 and this case still passed. So specific
        // witnesses are named, one per way a body is located: a file of its own, a
        // function inside the cascade, and a function the cascade reaches through a
        // global. Losing any of the three roads is red now.
        expect(reads.get('soil.clay')).toBe('soil-structure-engine');   // a file of its own
        expect(reads.get('soil.CEC')).toBe('mlsn-engine');              // a global, outside the cascade
        expect(reads.has('turf.hoc')).toBe(true);
        // Measured, not chosen: six of the sixteen bodies read an input under a
        // `state.<section>.<field>` name — the others take their inputs as
        // arguments or read results. The floor is the measurement, so a body
        // dropping out of the universe shows up here.
        const bodiesWithReads = Object.keys(perEngine).length;
        expect(bodiesWithReads).toBe(6);
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
            // and it must actually be read — an excuse for something nobody reads
            // is a list growing on its own
            expect([key, reads.has(key)]).toEqual([key, true]);
        });
    });
});

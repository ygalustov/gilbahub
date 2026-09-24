/**
 * GH-664 (queue item 3ch, the analyst's section 26.1) — THE SOIL STRUCTURE
 * PATHWAY COMES FROM THE DECLARED DICTIONARY, AND AN ABSENT CONSTRUCTION IS AN
 * OUTCOME.
 *
 * WHAT WAS WRONG, and it was wrong on every site rather than on one. The engine
 * read `state.rootzoneType || state.soil.rootzoneType || 'native'` and matched it
 * by substring against two lists of its own. Nothing in the tree writes
 * `rootzoneType` — the construction lives in `turf.construction` — so the
 * fallback decided every run: all 35 stored `soilStructure` blocks carry
 * `pathway: clay`, nine of them for sites whose construction is `sand_profile`
 * (the analyst's measurement, 26 point 1). `Westview` was right by accident.
 *
 * THREE ANSWERS, NOT TWO, and telling them apart is the point: a site with no
 * construction, a value the dictionary does not carry, and a value whose cell for
 * this consumer is one of the owner's open questions (26.2 — ten cells of
 * sixty-six, two of them live). None of the three is a default, and the old code
 * turned all three into clay.
 *
 * THE DICTIONARY IS READ, NOT COPIED. Its contents come from
 * `calculation-inputs.schema.json` through the server's resolver, and this file
 * asks the engine what it does with the resolved object — so a spelling that
 * drifts in the dictionary moves this test with it instead of leaving it agreeing
 * with a copy of itself.
 */

'use strict';

const fs = require('fs');
const path = require('path');

const ROOT = path.join(__dirname, '..');
const LIST = JSON.parse(fs.readFileSync(path.join(ROOT, 'assets', 'calculation-inputs.schema.json'), 'utf8'));
const CONSTRUCTION = LIST.inputs['turf.construction'].values;

global.window = global.window || global;
require(path.join(ROOT, 'assets', 'gaip-utils.js'));
require(path.join(ROOT, 'assets', 'soil-structure-engine.js'));
const ENGINE = global.GAIP_SoilStructure;

/** The resolved object as the server builds it, from the dictionary itself. */
function resolved(value) {
    const entry = CONSTRUCTION[value];
    if (!entry) return { value: value, label: null, resolves: {}, known: false };
    const out = {};
    Object.entries(entry.resolves).forEach(([k, v]) => { if (v !== null) out[k] = v; });

    return { value: value, label: entry.label, resolves: out, known: true };
}

/** A state with enough water chemistry for the engine to do its arithmetic. */
function stateWith(construction) {
    return {
        construction: construction,
        turf: { grassSpecies: 'browntopBent' },
        soil: { clay: 20, ESP: null },
        water: { EC: 0.5, Na: 20, Ca: 30, Mg: 10, HCO3: 100, pH: 7 },
    };
}

describe('GH-664 — the pathway is the dictionary’s answer', () => {
    test('POSITIVE CONTROL: the engine loaded and the dictionary carries the cell', () => {
        expect(typeof ENGINE.analyze).toBe('function');
        // Both answers must exist in the dictionary, or the two cases below would
        // be about a file that says nothing.
        const pathways = Object.entries(CONSTRUCTION)
            .map(([k, v]) => k + '=' + JSON.stringify(v.resolves.structurePathway));
        process.stdout.write('\n[gh664] structurePathway per construction: ' + pathways.join(' ') + '\n');
        expect(pathways.filter((p) => /=("sand")$/.test(p)).length).toBeGreaterThan(0);
        expect(pathways.filter((p) => /=("clay")$/.test(p)).length).toBeGreaterThan(0);
    });

    test('a sand profile is computed as sand — the nine sites that were called clay', () => {
        const out = ENGINE.analyze(stateWith(resolved('sand_profile')), null);
        process.stdout.write('[gh664] sand_profile -> pathway ' + JSON.stringify(out.pathway)
            + ', rootzoneType ' + JSON.stringify(out.rootzoneType) + '\n');
        expect(out.pathway).toBe('sand');
        // And the gypsum requirement, which only exists on the clay path, is not
        // computed — the consequence a person would eventually have read.
        expect(out.gypsumRequirement == null || out.gypsumRequirement === undefined).toBe(true);
    });

    test('a soil field is computed as clay — right for the same reason, not by luck', () => {
        const out = ENGINE.analyze(stateWith(resolved('soil')), null);
        process.stdout.write('[gh664] soil -> pathway ' + JSON.stringify(out.pathway) + '\n');
        expect(out.pathway).toBe('clay');
    });

    test('no construction at all: the structure is NOT computed and names its missing input', () => {
        const out = ENGINE.analyze(stateWith(null), null);
        process.stdout.write('[gh664] no construction -> ' + JSON.stringify({
            pathway: out.pathway, computed: out.computed, reason: out.reason, field: out.field }) + '\n');
        expect(out.pathway).toBeNull();
        expect(out.computed).toBe(false);
        expect(out.reason).toBe('setting-missing');
        expect(out.field).toBe('turf.construction');
    });

    test('a value the dictionary does not carry is not quietly clay either', () => {
        const out = ENGINE.analyze(stateWith(resolved('a_construction_nobody_declared')), null);
        process.stdout.write('[gh664] unknown value -> ' + JSON.stringify({
            pathway: out.pathway, reason: out.reason }) + '\n');
        expect(out.pathway).toBeNull();
        expect(out.reason).toBe('setting-missing');
    });

    test('the engine’s OWN old spelling is not in the dictionary, and it gets no pathway either', () => {
        // The analyst's addition to M3 (26.3): the reviewer's branch reads "absent
        // OR unknown" and had one case. `soil_based` is the second half by name —
        // it is the spelling the engine's own removed list used for a soil field,
        // and the dictionary does not carry it. Before this ticket that string
        // would have been classified by the engine's list; now it is a value
        // nobody declared, and the honest answer is that nothing is computed.
        expect(CONSTRUCTION.soil_based).toBeUndefined();   // positive control on the premise
        const out = ENGINE.analyze(stateWith(resolved('soil_based')), null);
        process.stdout.write('[gh664] soil_based (the engine\'s old spelling) -> '
            + JSON.stringify({ pathway: out.pathway, reason: out.reason }) + '\n');
        expect(out.pathway).toBeNull();
        expect(out.reason).toBe('setting-missing');
        expect(out.field).toBe('turf.construction');
    });

    test('and a value whose cell is an open question is not answered by us', () => {
        // The shape of the owner's ten open cells (26.2): the value is real and
        // what it means to THIS consumer has not been decided. Built by emptying
        // the one cell, so the case is about the cell rather than about the value.
        const withEmptyCell = resolved('sand_profile');
        delete withEmptyCell.resolves.structurePathway;
        const out = ENGINE.analyze(stateWith(withEmptyCell), null);
        process.stdout.write('[gh664] value present, cell empty -> ' + JSON.stringify({
            pathway: out.pathway, reason: out.reason }) + '\n');
        expect(out.pathway).toBeNull();
        expect(out.reason).toBe('setting-missing');
    });

    test('THE SUBJECT OF THE ITEM: the engine FOLLOWS the cell, which a copy could not do', () => {
        // The reviewer's M1 as a case rather than as a mutation he has to apply by
        // hand: the same construction is resolved twice, with the cell saying one
        // thing and then the other, and the engine must follow BOTH times. An
        // engine keeping its own list would answer the same twice — which is
        // exactly how nine sites came to be called clay while a table in the file
        // said sand.
        //
        // The expected words are LITERAL here, on purpose (his M2): taking them
        // from the dictionary would compare the dictionary with itself and stay
        // green under a broken cell.
        const asSand = ENGINE.analyze(stateWith({
            value: 'sand_profile', resolves: { structurePathway: 'sand' }, known: true,
        }), null);
        const asClay = ENGINE.analyze(stateWith({
            value: 'sand_profile', resolves: { structurePathway: 'clay' }, known: true,
        }), null);
        process.stdout.write('[gh664] the same value, cell says sand -> ' + JSON.stringify(asSand.pathway)
            + ' | cell says clay -> ' + JSON.stringify(asClay.pathway) + '\n');

        expect(asSand.pathway).toBe('sand');
        expect(asClay.pathway).toBe('clay');
        // And the two answers differ, or the engine is answering something of its own.
        expect(asSand.pathway).not.toBe(asClay.pathway);
    });

    test('THE LIST, printed: every live site, its construction and the pathway it now gets', () => {
        // The reviewer asked for this beyond the verdict, and his reason is the
        // measurement: nine sites share one wrong answer today, so "green" without
        // the list is indistinguishable from "never reached the subject".
        const { execFileSync } = require('child_process');
        let rows = [];
        try {
            rows = execFileSync('docker', ['exec', 'gilba_mysql', 'mysql', '-ugilba', '-pgilba_secret',
                'gilba', '-N', '-e',
                "SELECT CONCAT(s.name,'|',IFNULL(JSON_UNQUOTE(JSON_EXTRACT(c.config,'$.turf.construction')),''))"
                + ' FROM site_configs c JOIN sites s ON s.id=c.site_id ORDER BY s.name'],
            { encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] })
                .split('\n').map((l) => l.trim()).filter((l) => l);
        } catch (e) {
            // No stand reachable: the list is printed from the dictionary instead,
            // and the absence is named rather than passed over in silence.
            process.stdout.write('[gh664] the stand is not reachable from here; '
                + 'the per-site list could not be printed\n');
        }

        const lines = rows.map((r) => {
            const [name, construction] = r.split('|');
            const out = ENGINE.analyze(stateWith(construction ? resolved(construction) : null), null);
            return name + '  construction=' + (construction || '(empty)')
                + '  pathway=' + (out.pathway === null ? 'NOT COMPUTED (' + out.reason + ')' : out.pathway);
        });
        process.stdout.write('[gh664] per site:\n[gh664]    ' + lines.join('\n[gh664]    ') + '\n');

        // Printed AND counted, so a list that silently shrank is visible: every site
        // with a construction must now get a pathway.
        const withConstruction = rows.filter((r) => r.split('|')[1]);
        const computed = lines.filter((l) => /pathway=(sand|clay)$/.test(l));
        process.stdout.write('[gh664] sites with a construction: ' + withConstruction.length
            + ' | of them computed: ' + computed.length + '\n');
        expect(computed.length).toBe(withConstruction.length);
    });

    test('the engine keeps no construction table of its own any more', () => {
        // The tenth copy of the dictionary is gone, stated over the file rather
        // than remembered: two lists and a substring match decided the pathway.
        const src = fs.readFileSync(path.join(ROOT, 'assets', 'soil-structure-engine.js'), 'utf8')
            .replace(/\/\*[\s\S]*?\*\//g, '').split('\n').filter((l) => !/^\s*\/\//.test(l)).join('\n');
        expect(src).not.toMatch(/sandRootzones/);
        expect(src).not.toMatch(/clayRootzones/);
        // positive control: the file really was read and really does still contain
        // the function this is about
        expect(src).toMatch(/function pathwayFrom\(/);
    });
});

/**
 * THE LINK, EXECUTED — and the bench that could not reach it, named.
 *
 * The cases above drive the engine directly, so a run that never carried the
 * resolved object to it would leave them green. The analyst's precondition for M3
 * asks the state to be built rather than taken from a live site, which they do.
 * What was missing is the STEP BETWEEN: the cascade handing the state over.
 *
 * `orchestrator-bench` cannot serve it — measured, not assumed: its script list
 * does not include `cascade-orchestrator.js`, and `soilStructure` is written at
 * `cascade-orchestrator.js:753`, so a run on that bench returns no structure block
 * at all. A case built on it was green about nothing. So the cascade's own
 * function is executed here instead, the way `gh620` executes its neighbour.
 */
describe('GH-664 — the cascade hands the engine the resolved object, and the answer is the object’s', () => {
    const vm = require('vm');
    const CASCADE = fs.readFileSync(path.join(ROOT, 'assets', 'cascade-orchestrator.js'), 'utf8');

    /** `executeSoilStructureEngine`, lifted out and run against the real engine. */
    function cascadeStructure(state) {
        const sandbox = {
            console: { log() {}, warn() {}, error() {} },
            Date, JSON, Math, Object, Array, String, Number, parseFloat, parseInt, isNaN,
        };
        sandbox.window = sandbox;
        sandbox.global = sandbox;
        sandbox.globalThis = sandbox;
        sandbox.GAIP_SoilStructure = ENGINE;

        const ctx = vm.createContext(sandbox);
        const at = CASCADE.indexOf('function executeSoilStructureEngine(');
        expect(at).toBeGreaterThan(-1);
        let depth = 0, body = null;
        for (let j = CASCADE.indexOf('{', at); j < CASCADE.length; j++) {
            if (CASCADE[j] === '{') depth++;
            else if (CASCADE[j] === '}') { depth--; if (!depth) { body = CASCADE.slice(at, j + 1); break; } }
        }
        vm.runInContext('function log(){} function warn(){}\n' + body, ctx,
            { filename: 'executeSoilStructureEngine' });
        expect(typeof ctx.executeSoilStructureEngine).toBe('function');

        return ctx.executeSoilStructureEngine(state, null);
    }

    test('POSITIVE CONTROL: the cascade’s own function reaches the engine', () => {
        const out = cascadeStructure(stateWith(resolved('sand_profile')));
        process.stdout.write('[gh664] through the cascade, sand_profile -> '
            + JSON.stringify(out && { pathway: out.pathway, rootzoneType: out.rootzoneType }) + '\n');
        expect(out).toBeTruthy();
        expect(out.pathway).toBe('sand');
    });

    test('through the cascade, a state with no construction is not computed', () => {
        const out = cascadeStructure(stateWith(null));
        process.stdout.write('[gh664] through the cascade, no construction -> '
            + JSON.stringify(out && { pathway: out.pathway, reason: out.reason }) + '\n');
        expect(out).toBeTruthy();
        expect(out.pathway).toBeNull();
        expect(out.reason).toBe('setting-missing');
    });

    test('THE REVIEWER’S THIRD-TIME CASE: the answer is the object’s, not the page global’s', () => {
        // His words: a value can come from the right site and still come from the
        // state of the page rather than from the data of the object — a snapshot in
        // a global, filled before the frame was rendered. That is GH-459 a third
        // time, and M5 does not catch it because nothing is taken from the pointer.
        //
        // His remedy, executed: resolve twice in one run with the global flipped in
        // between, and require the answer not to change. It cannot change here
        // BECAUSE the engine reads `state.construction` — the object it was handed —
        // and the global is read once, where the run state is built. If a consumer
        // ever reaches for the global at the moment of use, this reddens.
        global.GAIP_HUB_CONFIG = { construction: resolved('sand_profile') };
        const state = stateWith(resolved('sand_profile'));
        const first = cascadeStructure(state);

        // The page moves under the run.
        global.GAIP_HUB_CONFIG = { construction: resolved('soil') };
        const second = cascadeStructure(state);
        delete global.GAIP_HUB_CONFIG;

        process.stdout.write('[gh664] global flipped between two resolutions: '
            + JSON.stringify(first.pathway) + ' then ' + JSON.stringify(second.pathway) + '\n');
        expect(first.pathway).toBe('sand');
        expect(second.pathway).toBe('sand');
        expect(second.pathway).toBe(first.pathway);
    });
});

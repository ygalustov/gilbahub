/**
 * GH-580 — THE IDENTITY TABLE SAYS WHAT THE CODE DOES (stage 1).
 *
 * `identity-enforcement.js` declared that the wear engine CANNOT run without a
 * defined intent — `canRunUnknown.turfIntentKey: false`, behaviour
 * "BLOCKED - recovery windows require defined intent". It was not true.
 * `wear-recovery-engine-pure.js` does not contain the string `turfIntent`, and
 * `hub-orchestrator.js` computes `wearCanRun`, logs it and calls the engine
 * regardless.
 *
 * WHAT THE FALSE DECLARATION COST. On the stand, `analysis_results` rows 24, 29,
 * 31 and 34 each carry "Wear engine blocked by identity enforcement" AND a
 * complete fourteen-key `computed.wear` stamped in the same millisecond as the
 * warning. The server's rule of GH-569 read the word "BLOCKED" out of that
 * sentence and marked whole runs partial, so the owner was told part of her
 * analysis had not been computed when it had. That rule is gone (GH-573 — the
 * verdict comes from the result). This is the other half: the announcement.
 *
 * THE TABLE IS BROUGHT TO THE CODE, NOT THE CODE TO THE TABLE. Owner's decision
 * of 22.09.2026: recommendation bans are not switched on — "we are fixing the
 * incoming data, not the recommendations".
 *
 * HOW IT BITES: declare the block again in the table, or file the sentence as a
 * warning again, and the two cases below go red.
 */

'use strict';

const fs = require('fs');
const path = require('path');
const { load } = require('./lib/orchestrator-bench');

const ASSETS = path.join(__dirname, '..', 'assets');
const read = (f) => fs.readFileSync(path.join(ASSETS, f), 'utf8');

jest.setTimeout(60000);

describe('GH-580 — a block that is announced is a block that is enforced, or it is not announced', () => {
    test('the premise: the wear engine does not read the key it was said to need', () => {
        // Positive control for everything below, and the measurement the whole
        // ticket turns on.
        const engine = read('wear-recovery-engine-pure.js');
        expect(engine.length).toBeGreaterThan(1000);
        expect(engine).not.toMatch(/turfIntent/);
    });

    test('the table no longer declares a block the code does not enforce', () => {
        // GH-714 — READ FROM THE LOADED TABLE, NOT FROM A WINDOW OF ITS TEXT. The window ran
        // from the wear entry to the next `canEmitRecommendations`; with those blocks gone it
        // ran to the end of the file, and its positive half matched other entries' lines. The
        // table is exported, so the entry is read as data.
        const { ctx } = load();
        const req = ctx.GilbaIdentityEnforcement.ENGINE_REQUIREMENTS['wear-recovery'];
        process.stdout.write('[gh580] wear entry: ' + JSON.stringify(req) + '\n');

        expect(req.canRunUnknown.turfIntentKey).toBe(true);
        expect(JSON.stringify(req.unknownBehaviour || {})).not.toMatch(/BLOCKED/);
    });

    test('GH-714: no entry declares a recommendation ban — nothing outside the module ever asked', () => {
        const { ctx } = load();
        const table = ctx.GilbaIdentityEnforcement.ENGINE_REQUIREMENTS;
        const declaring = Object.keys(table).filter((id) => table[id].canEmitRecommendations !== undefined);
        process.stdout.write('[gh580] entries inspected: ' + JSON.stringify(Object.keys(table))
            + '; declaring a recommendation ban: ' + JSON.stringify(declaring) + '\n');

        expect(Object.keys(table).length).toBeGreaterThan(0);
        expect(declaring).toEqual([]);
    });

    test('every field an entry declares is a field the module reads — the lists, not their lengths', () => {
        // The one reader of the table is this module; its reads are the names after `req.` and
        // `req?.`. A declared field nobody reads is a promise the code does not keep.
        const { ctx } = load();
        const table = ctx.GilbaIdentityEnforcement.ENGINE_REQUIREMENTS;
        const src = read('identity-enforcement.js');
        const readFields = Array.from(new Set(Array.from(src.matchAll(/\breq\??\.(\w+)/g), (m) => m[1]))).sort();
        const unread = [];
        Object.keys(table).forEach((id) => Object.keys(table[id]).forEach((f) => {
            if (!readFields.includes(f)) unread.push(id + '.' + f);
        }));
        process.stdout.write('[gh580] fields the module reads: ' + JSON.stringify(readFields) + '\n'
            + '[gh580] declared and unread: ' + JSON.stringify(unread) + '\n');

        expect(readFields.length).toBeGreaterThan(0);
        expect(unread).toEqual([]);
    });

    test('and the sentence about it is information, not a problem', () => {
        // The level is the field the server and the panel read (GH-570). Filed
        // as a problem, this sentence reached the reader as trouble and the
        // outcome rule as a failure.
        const orch = read('hub-orchestrator.js');
        const at = orch.indexOf('const wearCheck = global.GilbaIdentityEnforcement.canEngineRun("wear-recovery")');
        expect(at).toBeGreaterThan(-1);
        const block = orch.slice(at, at + 1600);

        expect(block).toMatch(/note\("wear", "Wear engine runs without a defined intent/);
        expect(block).not.toMatch(/warn\("wear", "Wear engine blocked/);
    });

    test('BEHAVIOURAL: the engine is asked for a result whatever the table says', () => {
        // The two halves tied together by running them: the table's answer and
        // the code's behaviour must agree. If a later change starts enforcing
        // the block, this goes red and the table has to say so.
        const { ctx } = load();
        const ie = ctx.GilbaIdentityEnforcement;
        expect(ie && typeof ie.canEngineRun).toBe('function');

        const verdict = ie.canEngineRun('wear-recovery');
        // Whatever it answers, the orchestrator's call site does not consult it:
        // `wearCanRun` is assigned, logged and never read again.
        const orch = read('hub-orchestrator.js');
        const at = orch.indexOf('let wearCanRun = true;');
        // The CODE between the check and the engine call, with prose removed —
        // twice in this file a comment of mine tripped a check written to read
        // the declaration, which is the same mistake in test clothes.
        const region = orch.slice(at, orch.indexOf('const wearState = {', at))
            .replace(/\/\/[^\n]*/g, '');

        // `wearCanRun` is written and read once, in the sentence that reports it.
        // Nothing branches on it, and nothing stops the call below.
        expect(region).toMatch(/if \(!wearCanRun\)/);
        expect(region).not.toMatch(/return|continue|wearState = null|skip/i);
        // Step 7 is where the engine is actually called, and it does not know
        // the verdict exists.
        const stepAt = orch.indexOf('log("main", "Step 7: Wear/recovery analysis")');
        expect(stepAt).toBeGreaterThan(-1);
        const callRegion = orch.slice(stepAt, stepAt + 1600).replace(/\/\/[^\n]*/g, '');
        expect(callRegion).toMatch(/gaip_wear_recovery_engine\(/);
        expect(callRegion).not.toMatch(/wearCanRun|canEngineRun/);

        // and the declaration now agrees with that
        expect(verdict).toHaveProperty('canRun');
        process.stdout.write('[q64] canEngineRun("wear-recovery") -> ' + JSON.stringify(verdict) + '\n');
    });
});

/**
 * GH-729 (queue item 3al) — A STORED PREDICTION NAMES THE RUN THAT PRODUCED IT.
 *
 * WHAT WAS MEASURED BEFORE ANY REPAIR, and it is worse than the item said. The logger stamped
 * every batch with `generateUUID()` — a number invented per call, equal to nothing else in the
 * tree — so a prediction and the run that computed it had no way of being about the same attempt.
 * And it travelled under `cascade_run_id` while `PredictionController` reads `cascade_id`, so it
 * never arrived: on the stand, `predictions` holds 1718 rows and `cascade_id` is filled on NONE
 * of them. Two different faults wearing one symptom.
 *
 * THE PREDICATE THIS GUARDS IS THE PAIR, not either half: the browser must send the name the
 * server reads, and the value must be the run's own id. Guarding one alone leaves the other free
 * to come back, which is how the first one survived.
 *
 * `null` OUTSIDE A RUN FRAME, never a stand-in. A page opened without `?rerun=` is not a run, its
 * predictions belong to no run, and an invented id there is the same defect renamed. The case
 * below asserts the null as loudly as it asserts the id.
 *
 * WHAT THIS DOES NOT SEE: whether the server then stores what it was sent — that is one INSERT
 * away and belongs to the controller's own cases; and the live path that calls the logger, which
 * needs a run on a real page.
 */

'use strict';

const fs = require('fs');
const path = require('path');
const vm = require('vm');

const ROOT = path.join(__dirname, '..');
const LOGGER = path.join(ROOT, 'assets', 'prediction-logger.js');
const CONTROLLER = path.join(ROOT, 'app', 'app', 'Http', 'Controllers', 'PredictionController.php');

/** The logger, run as itself in a sandbox, with the run id the caller wants it to see. */
function loadLogger(runId) {
    const sandbox = {
        console: { log() {}, warn() {}, error() {} },
        setTimeout, clearTimeout, Date, JSON, Math, fetch: () => Promise.resolve({ ok: true, json: () => ({}) }),
        document: { addEventListener() {} },
        GAIP_HUB_CONFIG: { restUrl: '/api/', csrfToken: 'x', activeSiteId: 'site-under-test' },
    };
    if (runId !== undefined) {
        sandbox.GilbaPersistence = { currentRunId: () => runId };
    }
    sandbox.window = sandbox;
    sandbox.global = sandbox;
    vm.createContext(sandbox);
    vm.runInContext(fs.readFileSync(LOGGER, 'utf8'), sandbox, { filename: 'prediction-logger.js' });

    return sandbox;
}

/** A cascade result with one soil recommendation — enough for one prediction to exist. */
const CASCADE = {
    success: true,
    state: {
        computed: { mlsn: { recommendations: { nitrogen: { rate: 12.5, confidence: 0.8 } } } },
        inputs: {},
    },
};

describe('GH-729 — a prediction carries the run that produced it', () => {
    test('POSITIVE CONTROL: the sandbox reaches the subject and a prediction is produced', () => {
        const sandbox = loadLogger('run-777');
        const out = sandbox.GilbaPredictionLogger.extractPredictions(CASCADE);
        process.stdout.write('\n[gh729] predictions extracted: ' + out.length
            + ' | keys of the first: ' + JSON.stringify(Object.keys(out[0] || {})) + '\n');

        // Without this, every assertion below would be satisfied by an empty list.
        expect(out.length).toBeGreaterThan(0);
        expect(out[0].module).toBe('soil');
    });

    test('the value is the run id, taken from the one reader of the address', () => {
        const sandbox = loadLogger('run-777');
        const out = sandbox.GilbaPredictionLogger.extractPredictions(CASCADE);
        const ids = Array.from(new Set(out.map((p) => p.cascade_id)));
        process.stdout.write('[gh729] with a run frame, cascade_id values: ' + JSON.stringify(ids) + '\n');

        expect(ids).toEqual(['run-777']);
    });

    test('outside a run frame it is null, and nothing is invented in its place', () => {
        const sandbox = loadLogger(null);
        const out = sandbox.GilbaPredictionLogger.extractPredictions(CASCADE);
        const ids = Array.from(new Set(out.map((p) => p.cascade_id)));
        process.stdout.write('[gh729] with no run frame, cascade_id values: ' + JSON.stringify(ids) + '\n');

        expect(ids).toEqual([null]);
    });

    test('and with no persistence at all it is still null rather than a guess', () => {
        // The order scripts load in is not this module's to decide; a missing reader must not
        // become a reason to invent an id.
        const sandbox = loadLogger(undefined);
        const out = sandbox.GilbaPredictionLogger.extractPredictions(CASCADE);
        const ids = Array.from(new Set(out.map((p) => p.cascade_id)));
        process.stdout.write('[gh729] with no persistence loaded, cascade_id values: '
            + JSON.stringify(ids) + '\n');

        expect(ids).toEqual([null]);
    });

    test('the name the browser sends is the name the server reads — both sides, from their sources', () => {
        /**
         * The half that made the other half invisible. Comparing the logger with itself would be
         * green whatever it spells, so the server's own source is the other side of this.
         */
        const logger = fs.readFileSync(LOGGER, 'utf8');
        const controller = fs.readFileSync(CONTROLLER, 'utf8');
        const sent = Array.from(new Set(Array.from(
            logger.matchAll(/(cascade\w*):\s*cascadeId/g), (m) => m[1])));
        const read = Array.from(new Set(Array.from(
            controller.matchAll(/\$prediction\['(\w+)'\]/g), (m) => m[1])))
            .filter((k) => k.indexOf('cascade') === 0);
        process.stdout.write('[gh729] the browser sends: ' + JSON.stringify(sent)
            + ' | the server reads: ' + JSON.stringify(read) + '\n');

        expect(sent.length).toBeGreaterThan(0);
        expect(read.length).toBeGreaterThan(0);
        expect(sent).toEqual(read);
    });

    test('the logger no longer mints an id of its own', () => {
        const logger = fs.readFileSync(LOGGER, 'utf8');
        // The declaration may stay — it is dead code and removing it is not this item's scope —
        // but nothing may CALL it: a minted id is precisely what could not be tied to a run.
        const calls = Array.from(logger.matchAll(/^(?!\s*(?:\*|\/\/)).*=\s*generateUUID\(\)/gm), (m) => m[0].trim());
        process.stdout.write('[gh729] calls to generateUUID left: ' + JSON.stringify(calls) + '\n');

        expect(calls).toEqual([]);
    });
});

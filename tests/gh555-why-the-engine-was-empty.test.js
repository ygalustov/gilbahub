/**
 * GH-555 — WHY FEDERAL GOLF'S ROW HAD NO DISEASE, STRESS OR FORECAST IN IT.
 *
 * THE SPECIMEN. `analysis_results` id 13, written by a real Re-run on
 * 22.09.2026 (`run-1790050104727-k7vbb7`): six of the thirteen required metrics,
 * `outcome = complete`, and in `computed` — `disease: null`, `stress: null`, with
 * `forecast`, `stressTrajectory`, `preEmergent` and `confidence` absent
 * altogether. The owner asked why the engine was empty, and "the engine returned
 * nothing" and "the engine was never called" are the same `null` in a stored
 * row. So this file runs the engines.
 *
 * THE ANSWER, in one line: the disease step was SKIPPED by its own gate, and the
 * orchestrator said so — into `console.warn`, which reaches nothing.
 *
 * WHAT IS NOT ESTABLISHED, and it is not filled in here: why `stress` was null.
 * `calculateStressAggregates()` returns a result in this bench even with no
 * climate at all, so on the stand it threw before assigning — and its catch wrote
 * to the same console. There is nothing to tell apart there yet.
 *
 * WHEN THE THIRD OUTCOME LANDS — a run that finished with engines missing being
 * distinguishable from one that had nothing to compute — the last group of tests
 * here is what changes, and it says so in place. It asserts today's silence, so
 * it must go red the day the silence ends.
 *
 * No live test, no stand write. The one piece of stand data is a fixture read
 * with SELECT: `tests/fixtures/q31-federal-golf-climate.json`, the climate of the
 * specimen's own run.
 */

'use strict';

const fs = require('fs');
const path = require('path');
const { load, computeAll, hubScripts, withSiteRow } = require('./lib/orchestrator-bench');

const FIXTURE = JSON.parse(fs.readFileSync(
    path.join(__dirname, 'fixtures', 'q31-federal-golf-climate.json'), 'utf8'));

/**
 * GH-727 — THE RUNS BELOW ARE GIVEN THE SITE'S OWN ROW.
 *
 * Nothing about this file's scenario changed: these passes are still given no climate, and the parts
 * they name as missing are still climate, disease and forecast. What changed is that the pre-emergent
 * step now asks the site by id for the place its weeds germinate in, and the bench's `getSite` answers
 * null without a row — so a bench with no row added a fourth gap that belonged to the bench and not to
 * the pass. Federal Golf's own coordinates, the site this specimen is about.
 */
const FEDERAL_GOLF_SITE = { id: 'federal-golf-site', latitude: -35.3317, longitude: 149.11 };
const benchWithItsSiteRow = () => withSiteRow(load(), FEDERAL_GOLF_SITE);

const FEDERAL_GOLF = {
    turf: { species: 'Creeping Bentgrass (Greens)', methodology: 'slan', surface: 'greens' },
    site: { lat: -35.3317, lon: 149.11, latitude: -35.3317, longitude: 149.11 },
};

/** What the specimen row carries, read from the stand with SELECT. */
const SPECIMEN = {
    computedKeys: ['dew', 'pgr', 'wear', 'shade', 'stress', 'tissue', 'climate', 'disease',
                   'salinity', 'irrigation', 'waterBalance', 'soilNutrition', 'soilTempPhysics'],
    diseaseWas: null,
    stressWas: null,
    temperature: { max: 25.3, min: 6.7, mean: 14.8 },
};

jest.setTimeout(60000);

describe('GH-555 — the bench itself, before it is believed', () => {
    test('it loads every script /hub loads, and none of them throws', () => {
        // The positive control for this whole file. A bench where a script
        // failed to load answers every question below with "nothing ran".
        const { failed } = load();
        if (failed.length) {
            process.stdout.write('[q31] scripts that threw while loading:\n');
            failed.forEach((f) => process.stdout.write('   ' + f + '\n'));
        }
        expect(failed).toEqual([]);
        expect(hubScripts().length).toBeGreaterThan(150);
    });

    test('the engines the steps ask for are present, and the outer gate is open', () => {
        // If the disease engine were simply absent, step 6 would be skipped with
        // no warning at all — a different defect with the same symptom, and it
        // has to be ruled out before the gate below means anything.
        const { ctx } = load();
        expect(typeof ctx.GaipOrchestrator).toBe('object');
        expect(typeof ctx.DiseaseEngine).toBe('object');
        expect(typeof ctx.DiseaseEnginePure).toBe('object');
        expect(ctx.GILBA_USE_PURE_DISEASE).toBe(true);
        // The literal condition of step 6, executed.
        expect(!!(ctx.DiseaseEngine || (ctx.GILBA_USE_PURE_DISEASE && ctx.DiseaseEnginePure))).toBe(true);
    });

    test('the fixture is the specimen’s own climate and carries a temperature', () => {
        expect(FIXTURE._source).toMatch(/analysis_results id 13/);
        expect(FIXTURE.climate.temperature.mean).toBe(SPECIMEN.temperature.mean);
    });
});

describe('GH-555 — the shape of the specimen row is the shape of a run that did not run', () => {
    test('before any run, `disease` and `stress` already exist and are already null', () => {
        const { ctx } = load();
        const computed = ctx.GaipOrchestrator.getState().computed;

        // This is why the specimen carries `disease: null` — not because a step
        // produced null, but because the initial state declares these ten keys
        // and nothing assigned over them.
        expect(Object.keys(computed).sort()).toEqual([
            'climate', 'dew', 'disease', 'irrigation', 'pgr',
            'salinity', 'shade', 'stress', 'tissue', 'wear',
        ]);
        expect(Object.values(computed).every((v) => v === null)).toBe(true);
    });

    test('and `forecast` / `stressTrajectory` / `preEmergent` are not declared at all', () => {
        // Which is why their absence from the specimen means something
        // different from `disease: null`: they only exist once a step assigns
        // one. Absent means the step did not reach its assignment.
        const { ctx } = load();
        const computed = ctx.GaipOrchestrator.getState().computed;
        ['forecast', 'stressTrajectory', 'preEmergent', 'confidence'].forEach((k) => {
            expect([k, k in computed]).toEqual([k, false]);
        });
        SPECIMEN.computedKeys.forEach((k) => {
            if (['waterBalance', 'soilNutrition', 'soilTempPhysics'].includes(k)) return; // added by hub-persistence, not here
            expect([k, k in computed]).toEqual([k, true]);
        });
    });
});

describe('GH-555 — the engine works; the run did not reach it', () => {
    test('with the site’s own climate, the disease step RUNS and produces diseases', async () => {
        const bench = benchWithItsSiteRow();
        const out = await computeAll(bench, Object.assign({ climateMetrics: FIXTURE.climate }, FEDERAL_GOLF));

        process.stdout.write('[q31] with climate — disease is null: '
            + (out.state.computed.disease === null) + '\n');

        expect(out.state.computed.disease).not.toBeNull();

        // GH-570: the receipt is read out of the RUN'S OWN JOURNAL rather than
        // out of captured console output. It used to be scraped from
        // `console.warn`, which stopped working the moment the receipt was
        // filed as information instead of as a warning — and the journal is
        // where the product reads it from anyway, so the assertion is now about
        // the thing that travels rather than about a side effect of logging.
        const journal = out.state.computed.warnings || [];
        const receipt = journal.filter((w) => /GAIP_DISEASE_RESULT written/.test(w.message || ''));
        expect(receipt.length).toBeGreaterThan(0);
        expect(receipt[0].level).toBe('info');
        // and the forecast that depends on it followed
        expect('forecast' in out.state.computed).toBe(true);
        // so the site's data is not the reason: the specimen's own numbers
        // compute nine diseases when the step is reached.
        expect(receipt[0].message).toMatch(/species: "bentgrass"/);
    });

    test('with the climate not yet through, the step is SKIPPED and the row comes out as the specimen', async () => {
        const bench = benchWithItsSiteRow();
        const out = await computeAll(bench, FEDERAL_GOLF); // no climateMetrics — the state at step 6 on the stand

        const said = out.said.join('\n');
        process.stdout.write('[q31] the run said: '
            + (said.match(/Skipping disease[^\n]*/) || ['(nothing)'])[0].slice(0, 120) + '\n');

        expect(said).toMatch(/Skipping disease computeAll pass/);
        expect(said).toMatch(/climate temperature not yet available/);
        // The specimen, reproduced: disease null, forecast absent.
        expect(out.state.computed.disease).toBe(SPECIMEN.diseaseWas);
        expect('forecast' in out.state.computed).toBe(false);
    });

    test('the forecast step cannot run on its own — it is chained to the disease step', () => {
        // Which is why one skipped step cost the specimen four keys and seven
        // metrics rather than two. Asserted on the source, because the chain is
        // a flag set inside the step that was skipped and there is no state to
        // read it from.
        const src = fs.readFileSync(path.join(__dirname, '..', 'assets', 'hub-orchestrator.js'), 'utf8');
        const step9 = src.indexOf('Step 9: Disease forecast');
        expect(step9).toBeGreaterThan(-1);
        // The forecast runs only on a pass where the disease step assigned, and
        // GH-557 added the other side of the same condition: when it did not,
        // the gap is recorded rather than left to be inferred.
        const window9 = src.slice(step9, step9 + 700);
        expect(window9).toMatch(/if \(!_diseaseFreshThisPass\) \{/);
        expect(window9).toMatch(/noteSkipped\("forecast", "forecast", "disease-not-computed"\)/);
        expect(window9).toMatch(/if \(_diseaseFreshThisPass && global\.DiseaseForecast/);
        // and the flag is set inside step 6, after the assignment
        const flag = src.indexOf('_diseaseFreshThisPass = true');
        expect(flag).toBeGreaterThan(src.indexOf('Step 6: Disease analysis'));
        expect(flag).toBeLessThan(step9);
    });
});

describe('GH-555 — the half that was open: the run now explains itself', () => {
    /**
     * WHAT THESE TWO USED TO SAY, because it is the point of them.
     *
     * They asserted the silence: a run that skipped an engine produced console
     * lines and left NOTHING in the state — no `warnings`, nothing matching
     * "Skipping" anywhere in it. They were written to go red the day the third
     * outcome landed (GH-557), and they did, on the first run after the
     * orchestrator started keeping its own journal. This is that change, in
     * place, rather than two tests quietly rewritten.
     */
    test('a run that skipped an engine says so, and the saying is kept', async () => {
        const bench = benchWithItsSiteRow();
        const out = await computeAll(bench, FEDERAL_GOLF);

        process.stdout.write('[q31] console lines: ' + out.said.length
            + ' — warnings kept in state: ' + (out.state.computed.warnings || []).length + '\n');

        // Still said out loud…
        expect(out.said.join('\n')).toMatch(/Skipping disease/);
        // …and now also kept, with the module that said it and when.
        const warnings = out.state.computed.warnings || [];
        expect(warnings.length).toBeGreaterThan(0);
        const disease = warnings.filter((w) => w.module === 'disease');
        expect(disease.length).toBeGreaterThan(0);
        expect(disease[0].message).toMatch(/climate temperature not yet available/);
        expect(typeof disease[0].at).toBe('number');
    });

    test('and the missing parts are named as facts, not left to be inferred from gaps', async () => {
        const bench = benchWithItsSiteRow();
        const out = await computeAll(bench, FEDERAL_GOLF);

        const skipped = out.state.computed.skipped || [];
        process.stdout.write('[q31] skipped: ' + JSON.stringify(skipped) + '\n');

        // The two the specimen is missing, with the reason for each — and the
        // forecast's reason names the chain rather than repeating the disease
        // step's cause, because those are different facts.
        //
        // GH-573 ADDED THE THIRD, and it is the new rule working rather than a
        // change to this scenario: this bench run is given no climate, so
        // `computed.climate` comes out empty, and the end-of-pass sweep names
        // the module whose result is not there. Before, a run with no climate
        // left that to be inferred from a gap — which is the thing this whole
        // section is about. The value is asserted below so the name is not
        // taken on trust.
        const climate = out.state.computed.climate;
        expect(climate === null || Object.keys(climate).length === 0).toBe(true);
        // GH-777 (queue item 4, slice 2): a fourth name, and it is the same kind of fact as the three.
        // The walk over the graph takes on every module of the pass now, `soil-temp-physics` included —
        // the one module that used to run without declaring itself. This bench gives it no construction
        // and no soil moisture, so it computes nothing and the sweep names it. On the stand the model's
        // result is present in the last row of all 13 sites, so no client run gains a gap.
        expect(skipped.map((s) => s.step).sort())
            .toEqual(['climate', 'disease', 'forecast', 'soil-temp-physics']);
        expect(skipped.filter((s) => s.step === 'climate')[0].reason).toBe('engine-produced-nothing');
        expect(skipped.filter((s) => s.step === 'disease')[0].reason).toBe('climate-late');
        expect(skipped.filter((s) => s.step === 'forecast')[0].reason).toBe('disease-not-computed');
    });

    test('a pass that computed everything reports nothing skipped', async () => {
        // The control for the two above: a journal that is never empty says
        // nothing, and "the run explains itself" would be satisfied by a run
        // that complains constantly.
        const bench = benchWithItsSiteRow();
        const out = await computeAll(bench, Object.assign({ climateMetrics: FIXTURE.climate }, FEDERAL_GOLF));

        const skipped = out.state.computed.skipped || [];
        expect(skipped.map((s) => s.step)).not.toContain('disease');
        expect(skipped.map((s) => s.step)).not.toContain('forecast');
    });

    test('the journal is per pass — a second pass does not report the first one’s gaps', async () => {
        // Which is the whole reason the orchestrator re-runs after the weather:
        // if the second pass inherited the first's skips, the result would
        // announce a gap it had just closed.
        const bench = benchWithItsSiteRow();
        await computeAll(bench, FEDERAL_GOLF);                                    // pass 1: no climate
        const first = (bench.ctx.GaipOrchestrator.getState().computed.skipped || []).length;
        expect(first).toBeGreaterThan(0);

        const out = await computeAll(bench, Object.assign({ climateMetrics: FIXTURE.climate }, FEDERAL_GOLF));
        expect((out.state.computed.skipped || []).map((s) => s.step)).not.toContain('disease');
    });

    test('the completion event carries both lists and when the pass began', async () => {
        // The runner cannot read the state; it reads the event. This is the
        // link that makes the journal reach a body at all.
        const bench = benchWithItsSiteRow();
        const heard = [];
        bench.ctx.document.addEventListener('gaip:orchestrator-complete', (e) => heard.push(e.detail));
        await computeAll(bench, FEDERAL_GOLF);

        expect(heard.length).toBeGreaterThan(0);
        const d = heard[heard.length - 1];
        expect(Array.isArray(d.warnings)).toBe(true);
        expect(Array.isArray(d.skipped)).toBe(true);
        expect(d.skipped.map((s) => s.step).sort())
            .toEqual(['climate', 'disease', 'forecast', 'soil-temp-physics']);
        expect(typeof d.passStartedAt).toBe('number');
    });
});

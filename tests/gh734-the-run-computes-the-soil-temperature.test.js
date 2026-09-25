/**
 * GH-734 (queue item 3az, delivery 1 of 3) — ONE CALCULATION OF THE SOIL TEMPERATURE, IN THE RUN,
 * ON THE RUN'S OWN INPUTS.
 *
 * The model was called twice with different inputs: once by the rendering panel, once by the run's
 * canonical step. The number the database kept was the PANEL'S, because the producer copied it out
 * of `GAIP_SOIL_TEMP`, which `renderSoilTempPanel` sets. Two calls of one model on two sets of
 * inputs is the defect; the panel's own call goes in delivery 3, once the readers inside the run
 * have moved in delivery 2. Removing the global first would leave those readers with nothing for a
 * whole run, which is the analyst's warning (device 24.3).
 *
 * WHAT DELIVERY 1 CHANGES, and each is asserted here: the inputs come from this run's data rather
 * than from a substitution; an absence is an outcome with a reason rather than a stand-in; the model
 * is not reached without a moisture reading; and the row's author is the run.
 *
 * TWO SUBSTITUTIONS WERE REMOVED, both measured in the source before the change: the thermal
 * profile fell back to `"usga"`, so a site whose construction the server could not resolve was
 * computed as a sand profile; and the moisture fell back to `0.25`, which — the analyst's outcome B
 * — was the value that actually travelled, because the wrapper it came from has two writers and one
 * gives no key.
 *
 * THE BOUNDARY, stated so this file is not read wider than it is: the 24.4 measurement — the panel,
 * the canonical number and the transfer compared on one run's weather, site by site — was NOT
 * taken. Whether the numbers move on live data is unknown, and no assertion here claims otherwise.
 */

'use strict';

const fs = require('fs');
const path = require('path');
const vm = require('vm');

const ROOT = path.join(__dirname, '..');
const ORCH = fs.readFileSync(path.join(ROOT, 'assets/hub-orchestrator.js'), 'utf8');
const PROD = fs.readFileSync(path.join(ROOT, 'assets/hub-persistence.js'), 'utf8');

/** The moisture rule, lifted out of the orchestrator and run as the function it is. */
function liftMoistureRule() {
    const at = ORCH.indexOf('function soilMoistureMeanOf(series) {');
    if (at < 0) return null;
    let depth = 0;
    for (let i = ORCH.indexOf('{', at); i < ORCH.length; i++) {
        if (ORCH[i] === '{') depth++;
        else if (ORCH[i] === '}') {
            depth--;
            if (!depth) {
                const body = ORCH.slice(at, i + 1);
                const sandbox = { parseFloat, isNaN, Array };
                vm.createContext(sandbox);
                vm.runInContext(body + '\nthis.fn = soilMoistureMeanOf;', sandbox);

                return { fn: sandbox.fn, body };
            }
        }
    }

    return null;
}

describe('GH-734 — the run computes it once, on its own inputs', () => {
    test('POSITIVE CONTROL: the moisture rule was found and answers at all', () => {
        const lifted = liftMoistureRule();
        expect(lifted).not.toBeNull();
        process.stdout.write('\n[gh734] the moisture rule: ' + lifted.body.length + ' characters\n');
        expect(lifted.fn([0.2, 0.3])).toBeCloseTo(0.25, 10);
    });

    test('the moisture is the mean of what the series measured, and a zero is a measurement', () => {
        const m = liftMoistureRule().fn;
        const answers = {
            'an ordinary series': m([0.1, 0.2, 0.3]),
            'with gaps in it': m([0.2, null, '', 0.4, undefined]),
            'a measured zero among readings': m([0, 0.4]),
            'all zeros, which is dry rather than unknown': m([0, 0, 0]),
            'nothing parsable': m(['', null, 'n/a']),
            'an empty series': m([]),
            'not a series at all': m(undefined),
        };
        Object.entries(answers).forEach(([what, v]) => {
            process.stdout.write('[gh734]   ' + what.padEnd(46) + ' -> ' + JSON.stringify(v) + '\n');
        });

        expect(answers['an ordinary series']).toBeCloseTo(0.2, 10);
        expect(answers['with gaps in it']).toBeCloseTo(0.3, 10);
        expect(answers['a measured zero among readings']).toBeCloseTo(0.2, 10);
        expect(answers['all zeros, which is dry rather than unknown']).toBe(0);
        expect(answers['nothing parsable']).toBeNull();
        expect(answers['an empty series']).toBeNull();
        expect(answers['not a series at all']).toBeNull();
    });

    test('the two substitutions are gone, each by name', () => {
        /**
         * ASSERTED OVER THE CODE, NOT THE FILE, and the first version of this case is why: the
         * docblock above the repair QUOTES both removed expressions, so a check over the whole text
         * went red on my own comment. The project's own `gh559` strips comments for exactly this,
         * and it is the honest form besides — a comment naming the old shape is not the old shape.
         */
        const code = ORCH.replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '');
        // One expression per substitution: a single regexp over both would let one through.
        expect(code).not.toMatch(/climateMetrics\?\.moisture\?\.soilMoisture\?\.mean \|\| 0\.25/);
        expect(code).not.toMatch(/GAIP_CANONICAL_STATE\.turf\.profileType \|\| "usga"/);
        // And the profile now comes from the construction the SERVER resolved.
        expect(ORCH).toMatch(/_resolvedConstruction\.resolves\s*\n?\s*&& _resolvedConstruction\.resolves\.thermalProfile/);
    });

    test('an absence is an outcome with a reason, and the model is not reached without moisture', () => {
        const at = ORCH.indexOf('const _resolvedConstruction =');
        expect(at).toBeGreaterThan(-1);
        const block = ORCH.slice(at, at + 2200);
        process.stdout.write('[gh734] refusals declared in the branch: '
            + JSON.stringify([...block.matchAll(/noteSkipped\("soil-temp-physics", "soil-temp-physics", "([\w-]+)"/g)]
                .map((m) => m[1])) + '\n');

        // Both reasons, by name, with the result key so the server can match the declaration.
        expect(block).toMatch(/noteSkipped\("soil-temp-physics", "soil-temp-physics", "setting-missing", "soilTempPhysics"\)/);
        expect(block).toMatch(/noteSkipped\("soil-temp-physics", "soil-temp-physics", "soil-moisture-unavailable", "soilTempPhysics"\)/);
        // The call sits in the branch that runs only when NEITHER refusal fired: the refusals come
        // first and the model is inside the trailing `else`.
        const refusal = block.indexOf('soil-moisture-unavailable');
        const call = block.indexOf('global.gaip_enhanced_soil_temp(');
        expect(refusal).toBeGreaterThan(-1);
        expect(call).toBeGreaterThan(refusal);
    });

    test('the result carries the inputs it was computed on', () => {
        expect(ORCH).toMatch(/_hubState\.computed\.soilTempPhysics = \{/);
        ['moisture:', 'profile:', 'cec:', 'om:', 'hourlySource:'].forEach((k) => {
            const at = ORCH.indexOf('_hubState.computed.soilTempPhysics = {');
            expect(ORCH.slice(at, at + 1400)).toContain(k);
        });
    });

    test('the row’s author is the run, not the panel’s global', () => {
        // The producer used to copy the panel's global into the row. It narrows the run's own result
        // now; the global itself survives until delivery 3, and the readers move in delivery 2.
        expect(PROD).not.toMatch(/soilTempPhysics: \{\s*\n\s*summary:\s*global\.GAIP_SOIL_TEMP\.summary/);
        expect(PROD).toMatch(/if \(cache\.computed && cache\.computed\.soilTempPhysics\) \{/);
        expect(PROD).toMatch(/inputs:\s*_stp\.inputs \|\| null,/);
    });
});

/**
 * GH-734, DELIVERY 2 of 3 — THE READERS INSIDE THE RUN TAKE THE RUN'S RESULT.
 *
 * Six places read the soil temperature from `GAIP_SOIL_TEMP`, the global the rendering panel sets.
 * They take it from the orchestrator's own accessor now, so a reader inside the run answers on the
 * number the run computed rather than on the one a panel drew.
 *
 * THE UNIVERSE IS THE DIRECTORY, not a list written here: every script in `assets` is searched, and
 * what is asserted is that no reader of the run holds the global any more and that exactly the four
 * files delivery 3 is about still do. A list would have kept the number the task carried -- which was
 * four readers, while the census found six.
 *
 * COMMENTS ARE STRIPPED BEFORE COUNTING, and that is not a convenience: each repaired place names
 * the global in its own explanation, and a count over the raw text would have reported the work as
 * not done. Measured the hard way twice tonight, in GH-733 and again here.
 */
describe('GH-734 — delivery 2: the run’s readers take the run’s result', () => {
    const fs2 = require('fs');
    const path2 = require('path');
    const ASSETS = path2.join(ROOT, 'assets');
    const codeOf = (f) => fs2.readFileSync(path2.join(ASSETS, f), 'utf8')
        .replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '');

    const HOLDERS = () => fs2.readdirSync(ASSETS).filter((f) => f.endsWith('.js'))
        .filter((f) => codeOf(f).indexOf('GAIP_SOIL_TEMP') > -1).sort();

    /** The six the delivery moved, and the four delivery 3 is about. */
    const MOVED = ['cascade-orchestrator.js', 'disease-engine-pure.js', 'disease-forecast.js',
        'large-patch-model.js', 'overseed-climate-integration.js', 'soil-temp-logger.js'];
    const LEFT = ['climate-module-v2-ui.js', 'growth-light-analysis.js', 'hub-persistence.js',
        'site-switch-cleanup.js'];

    /**
     * TURNED OVER BY DELIVERY 3, and kept rather than deleted so the reversal can be read.
     *
     * While the global existed this control was the thing that kept delivery 2's assertions from
     * passing over an empty tree. Delivery 3 removed the global, so the control expired with its
     * subject — the same way my `GH-606` order claim did. What replaces it is a control that does not
     * depend on the tree's contents: the census is shown to SEE a name of this kind at all.
     */
    test('POSITIVE CONTROL: the census can see a name of this kind, with the global itself now gone', () => {
        const holders = HOLDERS();
        process.stdout.write('\n[gh734/2] files still naming the global in code: '
            + JSON.stringify(holders) + '\n');
        expect(holders).toEqual([]);
        // The detector works: it finds the accessor the readers moved to, in more than one file.
        const withAccessor = fs2.readdirSync(ASSETS).filter((f) => f.endsWith('.js'))
            .filter((f) => codeOf(f).indexOf("getComputed('soilTempPhysics')") > -1);
        process.stdout.write('[gh734/2] files asking the run for it: ' + withAccessor.length + '\n');
        expect(withAccessor.length).toBeGreaterThan(3);
    });

    test('none of the six readers holds it, each named', () => {
        const holders = HOLDERS();
        MOVED.forEach((f) => expect({ file: f, stillHoldsTheGlobal: holders.includes(f) })
            .toEqual({ file: f, stillHoldsTheGlobal: false }));
    });

    test('and each of the six takes it from the orchestrator’s own accessor instead', () => {
        MOVED.forEach((f) => {
            expect({ file: f, asksTheRun: /getComputed\('soilTempPhysics'\)/.test(codeOf(f))
                || /computed\?\.soilTempPhysics/.test(codeOf(f)) })
                .toEqual({ file: f, asksTheRun: true });
        });
    });

    /**
     * TURNED OVER BY DELIVERY 3 for the same reason: the four files it named were its own subject,
     * and it has finished with them. The claim that survives is the one about the READERS — none of
     * the six holds the global — and it is asserted in the case above this one. The four names stay
     * in the file as a record of what delivery 3 was about.
     */
    test('the four files delivery 3 was about no longer hold it either', () => {
        const holders = HOLDERS();
        LEFT.forEach((f) => expect({ file: f, stillHoldsTheGlobal: holders.includes(f) })
            .toEqual({ file: f, stillHoldsTheGlobal: false }));
    });
});

/**
 * GH-734, DELIVERY 3 of 3 — THE GLOBAL CEASES TO EXIST.
 *
 * The panel published its own calculation on `GAIP_SOIL_TEMP` "for disease/overseed modules to use",
 * and that is how one model came to be computed twice on different inputs. The readers moved in
 * delivery 2, so there is nothing left to publish: the panel draws what the run computed, the last
 * live-session fallback is gone, and the producer's third home for the measurement is gone with it.
 *
 * THE ORDER WAS COMPULSORY, NOT CAREFUL. The cleanup entry went before the global, because
 * `tests/gh734-the-cleanup-list-and-the-globals-agree.test.js` reddens on a name that is cleaned and
 * assigned nowhere. That guard exists because the one I had promised did not: `GH-606`'s census stops
 * seeing this global the moment the row stops being built from it, which is what delivery 1 did.
 */
describe('GH-734 — delivery 3: nothing publishes the panel’s number any more', () => {
    const fs3 = require('fs');
    const path3 = require('path');
    const ASSETS3 = path3.join(ROOT, 'assets');
    const codeOf3 = (f) => fs3.readFileSync(path3.join(ASSETS3, f), 'utf8')
        .replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '');

    test('the global exists nowhere in the code, and the universe is the directory', () => {
        const holders = fs3.readdirSync(ASSETS3).filter((f) => f.endsWith('.js'))
            .filter((f) => codeOf3(f).indexOf('GAIP_SOIL_TEMP') > -1).sort();
        process.stdout.write('\n[gh734/3] files naming the global in code: ' + JSON.stringify(holders) + '\n');
        expect(holders).toEqual([]);
    });

    test('POSITIVE CONTROL: the census can still see a name of this kind', () => {
        // Without this, "nothing holds it" is satisfied by a search that finds nothing at all.
        const holders = fs3.readdirSync(ASSETS3).filter((f) => f.endsWith('.js'))
            .filter((f) => codeOf3(f).indexOf('GaipOrchestrator') > -1);
        expect(holders.length).toBeGreaterThan(3);
    });

    test('the panel no longer publishes, and the last fallback is gone', () => {
        expect(codeOf3('climate-module-v2-ui.js')).not.toMatch(/global\.GAIP_SOIL_TEMP\s*=/);
        // The stored row is the one source for the page now; a run that did not compute it leaves null.
        const gl = codeOf3('growth-light-analysis.js');
        const at = gl.indexOf('function getSoilTemp(data) {');
        expect(at).toBeGreaterThan(-1);
        expect(gl.slice(at, at + 400)).toMatch(/data\.computed\.soilTempPhysics/);
        expect(gl.slice(at, at + 400)).not.toMatch(/GAIP_SOIL_TEMP/);
    });

    test('and the site switch no longer cleans a name that does not exist', () => {
        const cleanup = codeOf3('site-switch-cleanup.js');
        expect(cleanup).not.toMatch(/\['GAIP_SOIL_TEMP', null\]/);
        // The two entries that cleaned nothing went with it, each by name.
        expect(cleanup).not.toMatch(/\['GAIP_MLSN_RESULT', null\]/);
        expect(cleanup).not.toMatch(/\['GAIP_WEATHER_DATA', null\]/);
        // And the list is still a list, or the three assertions above pass over an empty file.
        expect((cleanup.match(/\['[\w$]+', null\]/g) || []).length).toBeGreaterThan(10);
    });
});

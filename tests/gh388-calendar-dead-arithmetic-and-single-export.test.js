/**
 * GH-388 — three leftovers from the D31 cutover, all of the same shape: a
 * second copy, or a half-delivered rule, that the earlier tickets left behind.
 *
 * 1. DEAD DUPLICATED ARITHMETIC. GH-384 routed computeProgram() through the
 *    shared core and the shared range resolver, which left
 *    `NutritionCalendar.calculateDeficit()`, `.getThresholds()`,
 *    `CONFIG.mlsnThresholds` / `.slanThresholds` / `.aaThresholds` and the
 *    whole `_collectAATexture()` / `inputs.aaTextureKey` plumbing unreachable —
 *    a second implementation of exactly the arithmetic and exactly the
 *    threshold tables D31 exists to de-duplicate, sitting inside the file whose
 *    changelog claims the duplication is gone. Verified to have no caller in
 *    assets/, app/ or tests/ before removal.
 *
 * 2. DECISION D-4b, HALF DELIVERED. GH-383 printed the "annual N target came
 *    from Site Settings" note in the Combined export only. The single-sample
 *    export renders its own Annual Nutrient Requirements section and printed
 *    nothing, so a site with no generated programme received an unannotated
 *    document — even though `annualNSource` was already sitting on
 *    engineInputs.turf.
 *
 * 3. THE SINGLE EXPORT SWALLOWED THE ADAPTER'S FAIL-LOUD.
 *    `resolveSiteProgramInputs()` throws when a site config cannot be resolved,
 *    deliberately, so that no surface computes against another site's
 *    configuration. word-export.js caught it, warned, and carried on with
 *    `_userN = null` — the engine then fell back to the species-table N,
 *    `annualNSource` was null so not even the note could fire, and the client
 *    got a document full of confident figures scaled against a number nobody
 *    chose. The Combined path already handled the same case by skipping the
 *    sample with a warning.
 */

'use strict';

const fs = require('fs');
const path = require('path');

const read = (f) => fs.readFileSync(path.join(__dirname, '../assets/' + f), 'utf8');
const strip = (src) => src.replace(/\/\*[\s\S]*?\*\//g, '').replace(/(^|[^:])\/\/[^\n]*/g, '$1');

describe('GH-388 item 1 — the calendar carries no second copy of the requirement arithmetic', () => {
    const calendar = read('nutrition-calendar.js');
    const code = strip(calendar);

    test('calculateDeficit() and getThresholds() are gone', () => {
        expect(code).not.toMatch(/NutritionCalendar\.calculateDeficit\s*=/);
        expect(code).not.toMatch(/NutritionCalendar\.getThresholds\s*=/);
    });

    test('the private MLSN / SLAN / AA threshold tables are gone', () => {
        expect(code).not.toMatch(/mlsnThresholds\s*:/);
        expect(code).not.toMatch(/slanThresholds\s*:/);
        expect(code).not.toMatch(/aaThresholds\s*:/);
    });

    test('the aaTextureKey plumbing is gone from both the calendar and the Combined export', () => {
        expect(code).not.toMatch(/_collectAATexture/);
        expect(code).not.toMatch(/aaTextureKey/);
        expect(strip(read('word-export-combined.js'))).not.toMatch(/aaTextureKey|_collectAATexture/);
    });

    test('the module no longer exposes them, so a caller cannot reappear silently', () => {
        jest.resetModules();
        global.window = {};
        global.document = {
            readyState: 'complete', addEventListener() {}, getElementById() { return null; },
            querySelector() { return null; }, querySelectorAll() { return []; },
        };
        global.console = { log() {}, warn() {}, error() {}, info() {} };
        global.localStorage = { getItem() { return null; }, setItem() {} };
        global.window.NutritionRequirementCore = require('../assets/nutrition-requirement-core.js');
        global.window.GAIP_NutritionProgramInputs = require('../assets/nutrition-program-inputs.js');
        global.window.GilbaGrowthPotentialEngine = require('../assets/growth-potential-engine.js');
        require('../assets/nutrition-calendar.js');
        const C = global.window.GilbaNutritionCalendar;
        expect(C.calculateDeficit).toBeUndefined();
        expect(C.getThresholds).toBeUndefined();
        expect(C._collectAATexture).toBeUndefined();
        expect(C.config.mlsnThresholds).toBeUndefined();
        expect(C.config.slanThresholds).toBeUndefined();
        expect(C.config.aaThresholds).toBeUndefined();
        // ...and the constants they held still exist, once, in the core.
        const Core = require('../assets/nutrition-requirement-core.js');
        expect(Core.MLSN_THRESHOLDS).toEqual({ P: 21, K: 37, Ca: 331, Mg: 47, S: 7 });
        expect(Core.SLAN_RANGES_FALLBACK.K.floor).toBe(75);
    });

    test('what is genuinely still used is still there — this is not a blanket delete', () => {
        expect(calendar).toMatch(/clippingManagement:\s*\{/);
        expect(calendar).toMatch(/trafficModifiers:\s*\{ low: 0\.85/);
        expect(calendar).toMatch(/yearsToCorrect:\s*\{/);
    });
});

describe('GH-388 item 2 — decision D-4b is printed by the single-sample export too', () => {
    const wordExport = read('word-export.js');

    test('the note is gated on the adapter\'s own provenance stamp', () => {
        expect(wordExport).toMatch(/var _gh388NSource = data\.engineInputs && data\.engineInputs\.turf &&\s*\n\s*data\.engineInputs\.turf\.annualNSource;/);
        // The whole condition, so that disabling the branch (`if (false && …)`)
        // fails this test rather than leaving the note's text in place to
        // satisfy a looser match.
        expect(wordExport).toMatch(/if \(_gh388NSource === 'settings-turf' \|\| _gh388NSource === 'species-default'\) \{/);
    });

    test('it names the source and says why, in the Annual Nutrient Requirements section', () => {
        const idx = wordExport.indexOf("children: [new TextRun('Annual Nutrient Requirements')]");
        expect(idx).toBeGreaterThan(-1);
        const block = wordExport.slice(idx, idx + 2000);
        expect(block).toMatch(/Note — annual nitrogen target source: /);
        expect(block).toMatch(/Site Settings → Turf/);
        expect(block).toMatch(/species default/);
        expect(block).toMatch(/No nutrition programme has been generated on the Plan page/);
    });

    test('both export paths print it — the wording is the same on each', () => {
        const combined = read('word-export-combined.js');
        [wordExport, combined].forEach((src) => {
            expect(src).toMatch(/Note — annual nitrogen target source: /);
            expect(src).toMatch(/programme on the Plan page to base these figures on your own target/);
        });
    });
});

describe('GH-388 item 3 — the single export fails loud when programme inputs cannot be resolved', () => {
    const wordExport = read('word-export.js');

    test('unresolved inputs drop the nutrition sections instead of falling back to a species default', () => {
        expect(wordExport).toMatch(/if \(!_programInputs\) \{/);
        expect(wordExport).toMatch(/data\.nutritionInputsUnavailable = true;/);
        expect(wordExport).toMatch(/Omitting the nutrition sections rather than scaling them against a/);
    });

    test('the annual N is no longer allowed to be null on that path', () => {
        // Pre-fix: `var _userN = _programInputs ? _programInputs.annualN : null;`
        // — the null then reached the engine, which substituted REMOVAL_RATES'
        // per-species N without anything saying so.
        expect(strip(wordExport)).not.toMatch(/var _userN = _programInputs \? _programInputs\.annualN : null;/);
        expect(wordExport).toMatch(/var _userN = _programInputs\.annualN;/);
    });

    test('nulling engineInputs routes into the established "no silent fallback" drop', () => {
        // b35fix329 already drops the nutritionSummary section when
        // engineInputs is absent; this reuses it rather than inventing a
        // second suppression path.
        expect(wordExport).toMatch(/data\.engineInputs = null;\s*\n\s*data\.nutritionInputsUnavailable = true;/);
        expect(wordExport).toMatch(/engineInputsPresent=' \+ !!data\.engineInputs/);
    });

    test('the Combined path\'s equivalent guard is still there — both are loud now', () => {
        expect(read('word-export-combined.js')).toMatch(/no programme inputs for site/);
    });
});

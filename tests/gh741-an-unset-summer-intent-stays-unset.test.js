/**
 * GH-741 — A SUMMER INTENT NOBODY SET STAYS UNSET, AND EVERY DECISION MADE ON IT IS THE SAME.
 *
 * Fourteen readers turned an absent summer intent into `'transition'` (`x || 'transition'`), and
 * four objects asserted `summerIntent: 'transition'` for a sward that has no overseed at all. Since
 * GH-733 the Settings form no longer writes `'transition'` for an empty field, so the readers were
 * the last place the guess was made, and a guess looks exactly like an answer: nothing downstream can
 * tell "the owner chose transition" from "nobody chose".
 *
 * WHY THIS MOVES NOTHING ON A SCREEN, measured rather than assumed: every reader compares the intent
 * only with `retain` / `maintain` / `perennial` / `keep`, inside an overseed branch, and no site on
 * the stand is overseeded. For such a reader an unset intent and `'transition'` make one decision.
 * The cases below hold exactly that — the value is `null`, the decision equals the one made on an
 * explicit `'transition'`, and an explicit `'maintain'` still makes a different one, so the reader
 * is shown to be reading at all.
 *
 * THE CENSUS holds every remaining substitution of `'transition'` for a summer intent in `assets`,
 * both ways, keyed by file and the expression itself (never by line number: a line lives until the
 * next edit). The five still listed sit in files another item is editing and are removed there.
 *
 * NOT HERE, and said: the profile lookups (`profiles[intent] || profiles.transition`) still map an
 * unset intent to the transition profile. Naming the gap there instead is the next part of this item.
 */

'use strict';

const vm = require('vm');
const fs = require('fs');
const path = require('path');
const { stubSampleManager } = require('./lib/sample-readings');

const ASSETS = path.join(__dirname, '..', 'assets');
const read = (f) => fs.readFileSync(path.join(ASSETS, f), 'utf8');

function sandbox(extra) {
    const box = {
        console: { log() {}, warn() {}, error() {}, info() {}, debug() {} },
        document: {
            readyState: 'complete', addEventListener() {}, removeEventListener() {},
            getElementById: () => null, querySelector: () => null, querySelectorAll: () => [],
            createElement: () => ({ style: {}, setAttribute() {}, appendChild() {} }),
            body: { appendChild() {}, removeChild() {} }, head: { appendChild() {} },
        },
        addEventListener() {}, removeEventListener() {}, dispatchEvent() {},
        setTimeout: () => 0, clearTimeout() {}, setInterval: () => 0, clearInterval() {},
        CustomEvent: function CustomEvent() {},
        localStorage: { getItem: () => null, setItem() {}, removeItem() {} },
        Date, JSON, Math, Object, Array, String, Number, Boolean, parseFloat, parseInt, isNaN, Promise, Map, Set,
        ...(extra || {}),
    };
    box.window = box; box.global = box; box.globalThis = box; box.self = box;
    return box;
}

function load(file, extra, before) {
    const box = sandbox(extra);
    const ctx = vm.createContext(box);
    // What the page loads ahead of the file, as its view does.
    (before || []).forEach((f) => vm.runInContext(read(f), ctx, { filename: f }));
    vm.runInContext(read(file), ctx, { filename: file });
    return box;
}

const OVERSEEDED = { grassSpecies: 'couch', overseedSpecies: 'ryegrass', c3Fraction: 0.5, percentC3Cover: 50 };
const SUMMER_SOUTH = '2027-01-15';

describe('GH-741 — the readers carry an unset summer intent as unset, and decide as before', () => {
    test('irrigation: the intent is null, and the summer decision is the one made on transition', () => {
        const S = load('irrigation-scheduler.js', null, ['gaip-utils.js']).GAIP_IrrigationScheduler;
        const run = (intent) => S.detectOverseedForIrrigation(
            { turf: { ...OVERSEEDED, ...(intent ? { summerIntent: intent } : {}) }, location: { lat: -33.9 } }, SUMMER_SOUTH);
        const unset = run(null), transition = run('transition'), maintain = run('maintain');
        process.stdout.write('[gh741] irrigation intent/useOverseed — unset ' + JSON.stringify([unset.summerIntent, unset.useOverseed])
            + ', transition ' + JSON.stringify([transition.summerIntent, transition.useOverseed])
            + ', maintain ' + JSON.stringify([maintain.summerIntent, maintain.useOverseed]) + '\n');
        expect(unset.isOverseed).toBe(true);
        expect(unset.summerIntent).toBeNull();
        expect(unset.useOverseed).toBe(transition.useOverseed);
        expect(maintain.useOverseed).not.toBe(transition.useOverseed);
    });

    test('wear and recovery: the blend carries no intent, and a summer season is modified as on transition', () => {
        const box = load('wear-recovery-engine-pure.js');
        const blend = (intent) => box.gaip_getBlendInfo({ turf: { ...OVERSEEDED, ...(intent ? { summerIntent: intent } : {}) } });
        process.stdout.write('[gh741] wear blend intent — unset ' + JSON.stringify(blend(null).summerIntent) + '\n');
        expect(blend(null).summerIntent).toBeNull();
        expect(blend('maintain').summerIntent).toBe('maintain');
    });

    test('disease: the species chosen on an unset intent is the one chosen on transition, and retain still differs', () => {
        const DI = load('disease-integration.js').GAIP_DiseaseIntegration;
        const pick = (intent) => DI.resolveEffectiveSpecies({
            turf: { grassSpecies: 'couch', coolOverseed: 'ryegrass', overseedSpecies: 'ryegrass', overseedStatus: 'established',
                percentC3Cover: 50, c3Fraction: 0.5, ...(intent ? { overseedSummerIntent: intent } : {}) },
            climate: { lat: -33.9 }, location: { lat: -33.9 },
        });
        const got = { unset: pick(null), transition: pick('transition'), retain: pick('retain') };
        process.stdout.write('[gh741] disease species — ' + JSON.stringify(got) + '\n');
        expect(got.unset).toBe(got.transition);
        expect(got.retain).not.toBe(got.transition);
    });

    test('disease: the window copy is consulted exactly when it was before — an unset intent still opens it', () => {
        // Before GH-741 an unset intent became 'transition', and 'transition' opened the read of
        // `GAIP_OVERSEED_STATE.summerIntent`. The unset intent must open it too, or a site whose intent
        // lives only there would lose it. Held against the explicit 'transition' beside it.
        const pick = (intent) => {
            const DI = load('disease-integration.js', { GAIP_OVERSEED_STATE: { summerIntent: 'retain' } }).GAIP_DiseaseIntegration;
            return DI.resolveEffectiveSpecies({
                turf: { grassSpecies: 'couch', coolOverseed: 'ryegrass', overseedSpecies: 'ryegrass', overseedStatus: 'established',
                    percentC3Cover: 50, c3Fraction: 0.5, ...(intent ? { overseedSummerIntent: intent } : {}) },
                climate: { lat: -33.9 }, location: { lat: -33.9 },
            });
        };
        const got = { unset: pick(null), transition: pick('transition') };
        process.stdout.write('[gh741] disease species, window says retain — ' + JSON.stringify(got) + '\n');
        expect(got.transition).toBe('perennialRyegrass');
        expect(got.unset).toBe(got.transition);
    });

    test('nutrition summary: a sward with no overseed and no intent reports no intent', () => {
        const NS = load('nutrition-summary-integration.js', {
            GilbaHubOrchestrator: { getState: () => ({ inputs: { turf: { grassSpecies: 'couch' } } }) },
        }).GilbaNutritionSummary;
        const got = NS.detectOverseedScenario();
        process.stdout.write('[gh741] nutrition summary intent — ' + JSON.stringify(got.summerIntent) + '\n');
        expect(got.summerIntent).toBeNull();
    });

    test('the run\'s own assembly: an empty summer-intent field is carried as no intent', () => {
        const HUB = read('hub-tissue-v3.js');
        const declared = (name) => {
            const at = HUB.indexOf('function ' + name + '(');
            expect(at).toBeGreaterThan(-1);
            let depth = 0;
            for (let j = HUB.indexOf('{', at); j < HUB.length; j++) {
                if (HUB[j] === '{') depth++;
                else if (HUB[j] === '}') { depth--; if (!depth) return HUB.slice(at, j + 1); }
            }
            throw new Error('unbalanced ' + name);
        };
        const box = sandbox({ location: { search: '' }, URLSearchParams });
        box.GAIP_SampleManager = stubSampleManager({});
        const ctx = vm.createContext(box);
        ['safeNum', 'collectGridValues', 'convertDateToISO', 'calculateEndDate', 'gaip_readSoilForm',
            'gaip_soilFromActiveSample', 'gaip_soilStateFrom', 'gaip_namedSample', 'gaip_sampleReadings',
            'gaip_waterFromActiveSample', 'calculateC3C4Fractions', 'enforceHemisphereTurfRules', 'gaip_lastPgrForThisRun', 'gaip_build_state']
            .forEach((n) => vm.runInContext(declared(n), ctx, { filename: n }));
        const turf = ctx.gaip_build_state({ querySelector: () => null, querySelectorAll: () => [] }).turf;
        process.stdout.write('[gh741] assembly overseedSummerIntent — ' + JSON.stringify(turf.overseedSummerIntent) + '\n');
        expect(turf.overseedSummerIntent).toBeNull();
    });
});

// The census. A key is the file and the expression, numbered when one file holds the same one twice.
const PENDING_ELSEWHERE = {
    "assets/disease-forecast.js | var summerIntent = overseedState.summerIntent || turf.overseedSummerIntent || 'transition'; #1":
        'in a file another item is editing; removed there',
    "assets/disease-forecast.js | var summerIntent = overseedState.summerIntent || turf.overseedSummerIntent || 'transition'; #2":
        'in a file another item is editing; removed there',
    'assets/overseed-climate-integration.js | p = a.turf.overseedSummerIntent || "transition"; #1':
        'in a file another item is editing; removed there',
    'assets/hub-orchestrator.js | const summerIntent = turf?.overseedSummerIntent || "transition"; #1':
        'in a file another item is editing; removed there',
};

/**
 * GH-755 (queue item 3bz) TOOK ONE ENTRY OFF THIS LIST WITH THE CODE IT NAMED, and it is said here
 * rather than quietly dropped: `assets/hub-orchestrator.js | summerIntent: turf.overseedSummerIntent
 * || turf.summerIntent || "transition", #1` lived inside `buildIrrigationInputs`, which was called
 * from `executeEngine` and from nowhere else. The whole path was removed, so the substitution is gone
 * because the code is gone — not because anybody decided what a missing summer intent should mean.
 * That decision is still open, and the remaining entries above still carry it.
 */

function substitutions() {
    const found = [];
    let scanned = 0;
    fs.readdirSync(ASSETS).filter((f) => f.endsWith('.js') && !f.endsWith('.min.js')).forEach((f) => {
        scanned++;
        const seen = {};
        read(f).split('\n').forEach((line) => {
            const code = line.replace(/\/\/.*$/, '');
            const guessed = /[Ss]ummerIntent[^\n]*?(\|\||\?\?)\s*(['"])transition\2/.test(code);
            const asserted = /summerIntent\s*:\s*(['"])transition\1/.test(code);
            if (!guessed && !asserted) return;
            const expr = code.trim();
            seen[expr] = (seen[expr] || 0) + 1;
            found.push('assets/' + f + ' | ' + expr + ' #' + seen[expr]);
        });
    });
    return { found, scanned };
}

describe('GH-741 — the census of summer intents made up as transition', () => {
    test('positive control: the census sees both shapes, and not a comment', () => {
        const probe = ["var a = t.summerIntent || 'transition';", 'x = { summerIntent: "transition" };', "// summerIntent || 'transition'"];
        const hits = probe.map((l) => l.replace(/\/\/.*$/, ''))
            .filter((c) => /[Ss]ummerIntent[^\n]*?(\|\||\?\?)\s*(['"])transition\2/.test(c) || /summerIntent\s*:\s*(['"])transition\1/.test(c));
        expect(hits).toHaveLength(2);
    });

    test('what remains is exactly what is listed, both ways', () => {
        const { found, scanned } = substitutions();
        process.stdout.write('[gh741] files scanned ' + scanned + ', substitutions ' + found.length + '\n');
        found.forEach((k) => process.stdout.write('[gh741]    ' + k + '\n'));
        expect(scanned).toBeGreaterThan(100);
        const unlisted = found.filter((k) => !(k in PENDING_ELSEWHERE));
        const gone = Object.keys(PENDING_ELSEWHERE).filter((k) => !found.includes(k));
        expect({ unlisted, gone }).toEqual({ unlisted: [], gone: [] });
    });
});

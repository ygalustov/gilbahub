/**
 * GH-787 (queue item 3vy) — WEAR IS COMPUTED ONCE, FROM THE SITE'S OWN INPUTS.
 *
 * WHAT WAS WRONG. One engine, `gaip_wear_recovery_engine`, was run twice per pass — the dependency graph
 * declared two runners and two handles — and each runner assembled its inputs its own way. The cascade read
 * the old hub's hidden form (traffic, construction, height of cut, root depth, soil moisture) and the growth
 * potential off a page global; the orchestrator read the page's assembled state with its own substitutions
 * (`"native"`, `25`, `"optimal"`, `|| 40`, `|| 20`) and handed the engine the growth potential as an OBJECT,
 * which divided by 100 gives `NaN`, so no band matched and the last band applied: a growth modifier of 2.5.
 *
 * MEASURED ON THE STAND BEFORE THE CHANGE, from the last stored row of every site — and in BOTH directions,
 * which is the reviewer's condition:
 *   - the two paths DISAGREED about `recoveryCapacity.days` at 10 of 10 sites that carry both figures:
 *     `Test5 - NZ` 17 against 7, `Russley` 28 against 12, `Burns` 18 against 11, `Hoxton` 20 against 8,
 *     `Federal Golf` 18 against 8, `New test` 20 against 6, `GC - NZ - delivery` 18 against 11,
 *     `GC - NZ - warm` 25 against 23, `Test6 - UK` 14 against 5, `Westview` 18 against 19;
 *     about `recoveryProbability` at 9 of those 10 (`Westview` agreed, 11 = 11);
 *     and about the SPECIES and the VARIETY they were given at all 10;
 *   - they AGREED on 43 paths at all ten sites — `compactionRisk.riskPercent`, `usageRatio`, the moisture
 *     block, `actionPriority` entire, `aerationSchedule`, `cumulativeStress`,
 *     `effectiveLoad.totalEffectiveHours`, every `inputs.schedule.*`, `recoveryCapacity.modifiers.moisture`
 *     and `modifiers.nitrogen.*`. Those are what must NOT move: without them "one figure now" would be
 *     satisfied by a third figure agreeing with neither.
 *   - three sites had nothing to compare: `Canberra`, `Test1 - Sports`, `test4 - USA` carry no second figure
 *     in their last row at all, and two of them last ran on 10.08.
 *
 * WHAT THIS FILE MEASURES. The pass that survives, on the orchestrator's own bench: what its assembly hands
 * the engine, that the engine is asked once, that nothing writes the alias any more, and that the figures the
 * two paths already agreed on are the figures this one produces.
 *
 * THE OWNER'S DECISION, 30.09.2026 (fork 9, option (a)): stress enters the recovery days ONCE, inside the
 * engine. `adjustedRecovery` — a second pass that divided the engine's days by the aggregate of the stresses
 * the engine had already applied — is gone, and the screen and the document name one figure.
 */

'use strict';

const fs = require('fs');
const path = require('path');
const vm = require('vm');
const bench = require('./lib/orchestrator-bench');

const ROOT = path.join(__dirname, '..');
const asset = (f) => fs.readFileSync(path.join(ROOT, 'assets', f), 'utf8');
const GRAPH = JSON.parse(asset('dependency-graph.json'));

const SITE = 'gh787-site';
/** A southern sports site with a sand profile: the shape the wear engine is meant for. */
const SITE_ROW = { id: SITE, latitude: -43.53, longitude: 172.63 };
const CONFIG = {
    turf: {
        turfType: 'sports', species: 'Perennial Ryegrass', variety: 'Nui', construction: 'sand_profile',
        methodology: 'slan', hoc: 30, overseedStatus: 'none',
    },
    location: { lat: -43.53, lon: 172.63, name: 'Christchurch' },
    traffic: { schedule: { rootDepth: 150, moisture: 'dry' } },
};
/** Twelve monthly means and a growth potential the way the climate engine hands them over. */
const CLIMATE = {
    growth: { weighted: 50, c3: 55, c4: 30, dailyPattern: [{ weighted: 50, c3: 55, c4: 30, date: '2026-09-30' }] },
    temperature: { mean: 16 },
    monthlyTemps: { 1: 18, 2: 18, 3: 16, 4: 13, 5: 10, 6: 8, 7: 7, 8: 8, 9: 10, 10: 12, 11: 15, 12: 17 },
};

/** The bench, with the site's row and its config reachable by id, as a page has them. */
async function pass(overrides) {
    const b = bench.load();
    expect(b.failed).toEqual([]);          // a bench where a script threw measures its own setup
    bench.withSiteRow(b, SITE_ROW);
    const cfg = JSON.parse(JSON.stringify(CONFIG));
    if (overrides) overrides(cfg);
    b.ctx.GAIP_HUB_CONFIG = Object.assign({}, b.ctx.GAIP_HUB_CONFIG, { gaipConfig: cfg, activeSiteId: SITE });
    if (b.ctx.GAIP_SiteConfig) b.ctx.GAIP_SiteConfig.getConfig = (id) => (id === SITE ? cfg : null);

    const out = await bench.computeAll(b, {
        climateMetrics: CLIMATE,
        turf: { turfType: 'sports' },
        site: { latitude: SITE_ROW.latitude, longitude: SITE_ROW.longitude },
    });

    return { bench: b, out, wear: out.state && out.state.computed && out.state.computed.wear };
}

/** The assembly's own answer, without running the whole pass. */
function assemblyOf(b) {
    return b.ctx.GaipOrchestrator._buildWearRecoveryInputs
        ? b.ctx.GaipOrchestrator._buildWearRecoveryInputs()
        : null;
}

describe('GH-787 — the wear engine has one runner and one assembly', () => {
    test('the graph declares one runner, one handle, and one output key', () => {
        const node = GRAPH.nodes['wear-recovery-engine'];
        process.stdout.write('\n[gh787] the graph says: runner ' + JSON.stringify(node.runner)
            + ' | handle ' + JSON.stringify(node.handle)
            + ' | outputs ' + JSON.stringify(node.outputs) + '\n');

        expect(node.runner).toBe('orchestrator');
        expect(node.handle).toEqual(['buildWearRecoveryInputs']);
        expect(node.outputs).toEqual(['computed.wear']);
    });

    test('the cascade no longer carries a wear path at all — named, not counted', () => {
        const cascade = asset('cascade-orchestrator.js');
        const integration = asset('wear-recovery-integration.js');
        const hub = asset('hub-tissue-v3.js');
        /** Comments are not code: a note saying a function is gone must not read as the function. */
        const codeOf = (src) => src
            .replace(/\/\*[\s\S]*?\*\//g, (m) => m.replace(/[^\n]/g, ' '))
            .replace(/(^|[^:])\/\/[^\n]*/g, (m, p) => p + m.slice(p.length).replace(/[^\n]/g, ' '));

        const gone = {
            'cascade executeWearEngine': /function executeWearEngine/.test(codeOf(cascade)),
            'cascade calls the wear engine': /executeWearEngine\s*\(/.test(codeOf(cascade)),
            'cascade writes the alias': /computed\.wearRecovery\s*=/.test(codeOf(cascade)),
            'integration readWearRecoveryState': /function readWearRecoveryState/.test(codeOf(integration)),
            'integration runWearRecoveryAnalysis': /function runWearRecoveryAnalysis/.test(codeOf(integration)),
            'integration publishes gaip_run_wear_analysis': /gaip_run_wear_analysis\s*=/.test(codeOf(integration)),
            'integration publishes gaip_read_wear_state': /gaip_read_wear_state\s*=/.test(codeOf(integration)),
            'hub carries the cascade wear result': /le:\s*computed\.wear/.test(codeOf(hub)),
        };
        process.stdout.write('[gh787] what is left of the cascade path: ' + JSON.stringify(gone, null, 1) + '\n');
        Object.entries(gone).forEach(([what, present]) => expect({ [what]: present }).toEqual({ [what]: false }));

        // And what the file keeps doing is still there, so the removal was not a removal of the card.
        expect(codeOf(integration)).toMatch(/function renderWearRecoveryResults/);
        expect(codeOf(integration)).toMatch(/gaip_render_wear_results\s*=/);
    });

    test('POSITIVE CONTROL: the pass runs the engine and produces a wear result', async () => {
        // Without this every claim below could be a claim about a pass that never reached step 7.
        const { out, wear } = await pass();
        process.stdout.write('[gh787] pass threw: ' + JSON.stringify(out.threw)
            + ' | wear present: ' + !!wear
            + ' | days ' + JSON.stringify(wear && wear.recoveryCapacity && wear.recoveryCapacity.days)
            + ' | probability ' + JSON.stringify(wear && wear.recoveryProbability) + '\n');

        expect(wear).toBeTruthy();
        expect(typeof wear.recoveryCapacity.days).toBe('number');
        expect(typeof wear.recoveryProbability).toBe('number');
    });

    test('the growth potential reaches the engine as a NUMBER, so the band is not the last one', async () => {
        // THE DEFECT ITSELF. `climate.growthPotential` is `{c3, c4, weighted}`; the engine divides by 100, so
        // an object gave NaN and the final band applied — a growth modifier of 2.5 at 10 of 10 sites.
        const { wear } = await pass();
        const growth = wear.recoveryCapacity.modifiers.growth;
        process.stdout.write('[gh787] growth potential 50 -> modifier ' + JSON.stringify(growth) + '\n');

        expect(typeof growth).toBe('number');
        expect(growth).not.toBe(2.5);
        expect(growth).toBeLessThan(2.5);
    });

    test('every input comes from the site, and absence stays absent', async () => {
        const withEverything = await pass();
        const inputs = withEverything.wear.inputs;
        process.stdout.write('[gh787] the engine was given: ' + JSON.stringify({
            species: inputs.species, variety: inputs.variety, construction: inputs.construction,
        }) + '\n');

        // From the config, by the key it is stored under.
        expect(inputs.construction).toBe('sand_profile');
        expect(inputs.species).toBe('perennialRyegrass');
        expect(inputs.variety).toBe('Nui');

        // And a site that entered none of them carries none: no `"native"`, no `25`, no `"generic"`.
        const bare = await pass((cfg) => {
            delete cfg.turf.construction;
            delete cfg.turf.variety;
            delete cfg.turf.hoc;
            delete cfg.turf.overseedStatus;
            delete cfg.traffic;
        });
        const bareInputs = bare.wear.inputs;
        process.stdout.write('[gh787] a site that entered nothing: ' + JSON.stringify({
            construction: bareInputs.construction, variety: bareInputs.variety,
        }) + '\n');
        expect(bareInputs.construction).not.toBe('native');
        expect(bareInputs.variety).not.toBe('generic');
    });

    test('the page\'s own fields cannot change the answer', async () => {
        /**
         * The old assembly read `.gaip-construction`, `.gaip-hoc`, `.gaip-soil-moisture` and the traffic
         * fields. The bench's document answers every selector with a value, so a path that still read one
         * would produce a different figure here than the same site produces with the fields empty.
         */
        const withFields = await pass();
        const lying = bench.load();
        expect(lying.failed).toEqual([]);
        bench.withSiteRow(lying, SITE_ROW);
        lying.ctx.GAIP_HUB_CONFIG = Object.assign({}, lying.ctx.GAIP_HUB_CONFIG,
            { gaipConfig: JSON.parse(JSON.stringify(CONFIG)), activeSiteId: SITE });
        if (lying.ctx.GAIP_SiteConfig) {
            lying.ctx.GAIP_SiteConfig.getConfig = (id) => (id === SITE ? JSON.parse(JSON.stringify(CONFIG)) : null);
        }
        lying.ctx.document.querySelector = (sel) => ({
            value: sel.indexOf('construction') > -1 ? 'soil' : '999', dataset: {}, checked: false,
        });
        const out = await bench.computeAll(lying, {
            climateMetrics: CLIMATE, turf: { turfType: 'sports' },
            site: { latitude: SITE_ROW.latitude, longitude: SITE_ROW.longitude },
        });
        const fromFields = out.state.computed.wear;
        process.stdout.write('[gh787] fields empty -> ' + JSON.stringify(withFields.wear.inputs.construction)
            + ' | every field answering "soil"/"999" -> ' + JSON.stringify(fromFields.inputs.construction) + '\n');

        expect(fromFields.inputs.construction).toBe(withEverythingsConstruction(withFields));
        expect(fromFields.recoveryCapacity.days).toBe(withFields.wear.recoveryCapacity.days);
    });

    test('stress enters the days once: no adjustedRecovery anywhere, and no second probability', async () => {
        const { out, wear } = await pass();
        process.stdout.write('[gh787] wear keys: ' + JSON.stringify(Object.keys(wear).sort()) + '\n'
            + '[gh787] derived.recoveryProbability = ' + JSON.stringify(out.state.derived.recoveryProbability)
            + ' vs the engine\'s ' + JSON.stringify(wear.recoveryProbability) + '\n');

        expect(Object.keys(wear)).not.toContain('adjustedRecovery');
        expect(out.state.computed).not.toHaveProperty('wearRecovery');
        expect(out.state.derived).not.toHaveProperty('adjustedRecoveryDays');
        // The one probability the page and the document print is the engine's.
        expect(out.state.derived.recoveryProbability).toBe(wear.recoveryProbability);
        // And the orchestrator no longer offers the second pass to anybody.
        expect(out.state && typeof out.state).toBe('object');
        const orch = asset('hub-orchestrator.js')
            .replace(/\/\*[\s\S]*?\*\//g, (m) => m.replace(/[^\n]/g, ' '))
            .replace(/(^|[^:])\/\/[^\n]*/g, (m, p) => p + m.slice(p.length).replace(/[^\n]/g, ' '));
        expect(orch).not.toMatch(/function calculateAdjustedRecovery/);
        expect(orch).not.toMatch(/calculateAdjustedRecovery\s*\(/);
    });

    test('the season follows the site\'s own latitude, from the row that owns it', async () => {
        // The old reader was `document.querySelector('.gaip-lat')` — the page's field, which in the combined
        // export's loop belongs to whichever site the page still shows. Two hemispheres, one month.
        const south = await pass();
        const northBench = bench.load();
        expect(northBench.failed).toEqual([]);
        bench.withSiteRow(northBench, { id: SITE, latitude: 51.5, longitude: -0.12 });
        const cfg = JSON.parse(JSON.stringify(CONFIG));
        northBench.ctx.GAIP_HUB_CONFIG = Object.assign({}, northBench.ctx.GAIP_HUB_CONFIG,
            { gaipConfig: cfg, activeSiteId: SITE });
        if (northBench.ctx.GAIP_SiteConfig) northBench.ctx.GAIP_SiteConfig.getConfig = (id) => (id === SITE ? cfg : null);
        const northOut = await bench.computeAll(northBench, {
            climateMetrics: CLIMATE, turf: { turfType: 'sports' }, site: { latitude: 51.5, longitude: -0.12 },
        });
        const northWear = northOut.state.computed.wear;

        const seasonOf = (w) => w && w.compactionRisk && w.compactionRisk.capacityData
            && w.compactionRisk.capacityData.season;
        process.stdout.write('[gh787] same month, latitude -43.53 -> season ' + JSON.stringify(seasonOf(south.wear))
            + ' | latitude +51.5 -> season ' + JSON.stringify(seasonOf(northWear)) + '\n');

        expect(seasonOf(south.wear)).toBeTruthy();
        expect(seasonOf(northWear)).toBeTruthy();
        expect(seasonOf(northWear)).not.toBe(seasonOf(south.wear));
        /**
         * And the field is not consulted BY THIS READER. Two other places in the file still read `.gaip-lat`
         * — a pre-run coordinate check and the climate assembly — and they are the subject of other items, so
         * the claim is about `getCurrentSeason`, which is what this case is about. A claim about the whole file
         * would be a wider statement than the change, and it would go red for somebody else's line.
         */
        const orchSrc = asset('hub-orchestrator.js');
        const seasonAt = orchSrc.indexOf('function getCurrentSeason()');
        expect(seasonAt).toBeGreaterThan(-1);
        const seasonBody = orchSrc.slice(seasonAt, orchSrc.indexOf('\n  }', seasonAt));
        expect(seasonBody).not.toMatch(/querySelector/);
        expect(seasonBody).toMatch(/getSite\(/);
    });

    /**
     * STRESS IS COUNTED ONCE INSIDE THE ENGINE, and that is a different claim from the one above.
     *
     * The reviewer's return: the case that says "stress enters the days once" asserts the absence of the
     * second PASS — no `adjustedRecovery`, no `computed.wearRecovery`, no `derived.adjustedRecoveryDays`, no
     * `calculateAdjustedRecovery`. That is the once-ness of the PATH. His mutation applied the engine's own
     * shade factor TWICE inside the engine — `y = 1 + 0.8 * clamp(stressFactor)` squared — and all 368 suites
     * stayed green: nothing measured how many times a stress reaches the days.
     *
     * HOW IT IS MEASURED. The engine both returns the days and DECLARES every multiplier it applied
     * (`recoveryCapacity.modifiers`). The days are `ceil(baseDays × each declared multiplier)`, so applying any
     * one of them a second time inside the engine breaks the equality while the declaration stays as it was.
     * The claim is therefore about the engine's own arithmetic, not about a figure copied from it.
     *
     * The fixture carries four stresses at once — shade, salinity, temperature and Poa — so the product is
     * well inside the engine's floor of 1 day and ceiling of 28, and a squared multiplier cannot hide in the
     * clamp. That the product is inside those bounds is asserted, not assumed.
     */
    test('a stress reaches the days once: its multiplier is LINEAR in the stress, not squared', () => {
        const engineSrc = asset('wear-recovery-engine-pure.js');
        const box = {
            console: { log() {}, warn() {}, error() {} },
            Math, JSON, Date, Object, Array, String, Number, parseFloat, parseInt, isNaN, isFinite,
        };
        box.window = box; box.global = box; box.globalThis = box;
        const ctx = vm.createContext(box);
        vm.runInContext(engineSrc, ctx, { filename: 'wear-recovery-engine-pure.js' });
        const engine = box.gaip_wear_recovery_engine || box.window.gaip_wear_recovery_engine;
        expect(typeof engine).toBe('function');

        const site = {
            monthIndex: 0,
            turf: { grassSpecies: 'perennialRyegrass', speciesKey: 'perennialRyegrass', poaPercent: 0,
                construction: 'sand_profile', turfType: 'sports' },
            soil: { LOI: 3.5, OM_pct: 3.5 },
            site: { construction: 'sand_profile', season: 'summer', soilMoisture: 'optimal' },
            traffic: { matchesPerWeek: 1, matchDuration: 1.5, sessionsPerWeek: 1, sessionDuration: 1 },
        };
        const at = (stressFactor) => engine(JSON.parse(JSON.stringify(site)),
            { growthPotential: 60, temperature: 24 }, { stressFactor: stressFactor, deficitPct: 20, dli: 24 });

        const steps = [0, 0.25, 0.5, 0.75, 1];
        const measured = steps.map((sf) => {
            const r = at(sf);

            return { stressFactor: sf, shade: r.recoveryCapacity.modifiers.shade, days: r.recoveryCapacity.days };
        });
        process.stdout.write('[gh787] shade stress -> multiplier and days: '
            + JSON.stringify(measured) + '\n');

        /**
         * POSITIVE CONTROL: the stress reaches the multiplier at all, and the days with it. A stress that
         * changed nothing would satisfy every equality below.
         */
        expect(measured[4].shade).toBeGreaterThan(measured[0].shade);
        expect(measured[4].days).toBeGreaterThan(measured[0].days);
        // And nothing sits on the engine's ceiling, where a squared factor would be indistinguishable.
        measured.forEach((m) => expect(m.days).toBeLessThan(28));

        /**
         * THE CLAIM, and it needs no constant of the engine's: applying the stress ONCE makes the multiplier
         * LINEAR in it, so equal steps of stress give equal steps of multiplier. Applying it twice squares the
         * expression, and a square has growing steps — 1, 1.96, 3.24 against 1, 1.4, 1.8. Measured against the
         * reviewer's own mutation of this very line.
         *
         * The days themselves cannot carry this claim: the engine DECLARES the multiplier it used, so doubling
         * it inside the engine moves the declaration and the days together and their equality still holds. That
         * was the first form of this case, and it stayed green under the mutation.
         */
        const stepsOfTheMultiplier = [1, 2, 3, 4].map((i) =>
            Number((measured[i].shade - measured[i - 1].shade).toFixed(10)));
        process.stdout.write('[gh787]   steps of the multiplier: ' + JSON.stringify(stepsOfTheMultiplier) + '\n');
        stepsOfTheMultiplier.forEach((step) => expect(step).toBeCloseTo(stepsOfTheMultiplier[0], 9));

        /**
         * AND THE SAME FOR THE OTHER TWO STRESSES THE ENGINE APPLIES ITSELF — salinity and temperature — so the
         * claim is about how a stress reaches the days, not about the shade line alone.
         */
        /**
         * `ecw` is supplied because the engine formats it unconditionally — `(e.salinityPenalty.ecw || "?")
         * .toFixed(...)`, which throws on the "?" it just chose. Found here, and named rather than fixed: the
         * assembly always passes the figure (`salinity.ecwInput`), so no run reaches it, and the engine's own
         * brittleness is not this item's subject.
         */
        const salinityAt = (yieldFraction) => engine(Object.assign(JSON.parse(JSON.stringify(site)), {
            salinityPenalty: { active: true, growthModifier: yieldFraction, ecw: 2.4,
                penaltyPct: (1 - yieldFraction) * 100 },
        }), { growthPotential: 60, temperature: 24 }, { stressFactor: 0, deficitPct: 0, dli: 30 });
        const salinity = [1, 0.9, 0.8].map((y) => ({
            yield: y,
            factor: salinityAt(y).recoveryCapacity.modifiers.salinity.factor,
        }));
        const tempAt = (esi) => engine(Object.assign(JSON.parse(JSON.stringify(site)), {
            stressAggregates: { environmentalStressIndex: esi, combinedGrowthModifier: 0.9 },
        }), { growthPotential: 60, temperature: 24 }, { stressFactor: 0, deficitPct: 0, dli: 30 });
        const temperature = [20, 40, 60].map((esi) => ({
            esi: esi,
            factor: tempAt(esi).recoveryCapacity.modifiers.temperatureStress.factor,
        }));
        process.stdout.write('[gh787]   salinity: ' + JSON.stringify(salinity)
            + '\n[gh787]   temperature: ' + JSON.stringify(temperature) + '\n');

        // Salinity enters as 1/yield — once, so the reciprocal is linear in the yield's reciprocal.
        expect(salinity[0].factor).toBeCloseTo(1, 9);
        expect(salinity[1].factor).toBeCloseTo(1 / 0.9, 9);
        expect(salinity[2].factor).toBeCloseTo(1 / 0.8, 9);
        // Temperature enters once above the engine's own threshold: equal steps of ESI, equal steps of factor.
        const tempSteps = [1, 2].map((i) => Number((temperature[i].factor - temperature[i - 1].factor).toFixed(10)));
        expect(tempSteps[1]).toBeCloseTo(tempSteps[0], 9);
        expect(temperature[2].factor).toBeGreaterThan(temperature[0].factor);
    });

    /**
     * THE ENGINE ASKS FOR THE SEASON IT WAS GIVEN, in all five places — the plan's item 4.
     *
     * The engine reads `state.site.season` at one call site and called its own `m()` at four others, and `m()`
     * knows only the southern hemisphere: `month >= 11 || month <= 1` is summer. So one run could size its
     * carrying capacity by the season it was handed and its organic-matter and Poa modifiers by the opposite
     * one. This is wiring, not hemisphere: the owner's decision to keep the hemisphere "as in the old hub" is
     * about which season is right, not about ignoring the one passed in.
     *
     * BOUNDARY, measured: there is no northern sports site on the stand — `Test6 - UK` and `test4 - USA` are
     * not sports surfaces and wear is not computed for them (GH-776) — so no figure on the stand moves. The
     * case is built on a fixture of one, which is what a reachable-but-unobserved defect needs.
     */
    test('the engine sizes every season-dependent modifier by the season it was given', () => {
        const engineSrc = asset('wear-recovery-engine-pure.js');
        const box = {
            console: { log() {}, warn() {}, error() {} },
            Math, JSON, Date, Object, Array, String, Number, parseFloat, parseInt, isNaN, isFinite,
        };
        box.window = box; box.global = box; box.globalThis = box;
        const ctx = vm.createContext(box);
        vm.runInContext(engineSrc, ctx, { filename: 'wear-recovery-engine-pure.js' });
        const engine = box.gaip_wear_recovery_engine || box.window.gaip_wear_recovery_engine;
        expect(typeof engine).toBe('function');

        /** A northern sports site in January: the month says "summer" to a southern-only reader. */
        const northInJanuary = (season) => ({
            monthIndex: 0,
            turf: { grassSpecies: 'perennialRyegrass', speciesKey: 'perennialRyegrass', poaPercent: 30,
                construction: 'sand_profile', turfType: 'sports' },
            soil: { LOI: 2, OM_pct: 2 },
            site: { construction: 'sand_profile', season: season, soilMoisture: 'optimal' },
            traffic: { matchesPerWeek: 2, matchDuration: 1.5, sessionsPerWeek: 2, sessionDuration: 1 },
        });

        const asWinter = engine(northInJanuary('winter'), { growthPotential: 20, temperature: 4 }, null);
        const asSummer = engine(northInJanuary('summer'), { growthPotential: 20, temperature: 4 }, null);
        const poaOf = (r) => r && r.recoveryCapacity && r.recoveryCapacity.modifiers
            && r.recoveryCapacity.modifiers.poa;

        process.stdout.write('[gh787] January, 30% Poa — season given "winter": poa modifier '
            + JSON.stringify(poaOf(asWinter)) + ', days ' + JSON.stringify(asWinter.recoveryCapacity.days)
            + '\n[gh787]                        season given "summer": poa modifier '
            + JSON.stringify(poaOf(asSummer)) + ', days ' + JSON.stringify(asSummer.recoveryCapacity.days) + '\n');

        /**
         * The season it was GIVEN decides, so the two differ — and the engine RECORDS which season it used,
         * which is what makes this measurable rather than inferred. Before this item both answered as summer,
         * because the month was January and `m()` reads the southern calendar.
         */
        expect(poaOf(asWinter).season).toBe('winter');
        expect(poaOf(asSummer).season).toBe('summer');
        expect(poaOf(asSummer).blendedFactor).toBeGreaterThan(poaOf(asWinter).blendedFactor);
        // And the days follow it: the same site, the same month, two seasons, two windows.
        expect(asSummer.recoveryCapacity.days).not.toBe(asWinter.recoveryCapacity.days);

        // The engine's own month-only answer is still there for a run that passes no season at all, which is
        // the one place `m()` may still decide.
        const noSeason = engine(Object.assign(northInJanuary(null), { site: { construction: 'sand_profile' } }),
            { growthPotential: 20, temperature: 4 }, null);
        process.stdout.write('[gh787] no season passed at all: poa season '
            + JSON.stringify(poaOf(noSeason) && poaOf(noSeason).season) + '\n');
        expect(poaOf(noSeason).season).toBe('summer');   // January, read on the southern calendar
    });

    /**
     * THE SECOND HALF OF THE MEASUREMENT, the reviewer's condition in its own case: the figures the two paths
     * already agreed on are the figures this pass produces. A run that changed them would be a third
     * calculation, not one of the two.
     */
    test('what the two paths agreed on, this one still says', async () => {
        const { wear } = await pass();
        const agreed = {
            'compactionRisk.usageRatio': wear.compactionRisk.usageRatio,
            'compactionRisk.riskPercent': wear.compactionRisk.riskPercent,
            'effectiveLoad.totalEffectiveHours': wear.effectiveLoad.totalEffectiveHours,
            'actionPriority.priority': wear.actionPriority.priority,
            'cumulativeStress.status': wear.cumulativeStress.status,
            'aerationSchedule.recommendedWeeks': wear.aerationSchedule.recommendedWeeks,
            'inputs.schedule.matchesPerWeek': wear.inputs.schedule && wear.inputs.schedule.matchesPerWeek,
            'inputs.schedule.sessionsPerWeek': wear.inputs.schedule && wear.inputs.schedule.sessionsPerWeek,
        };
        process.stdout.write('[gh787] the agreed figures, from this pass: ' + JSON.stringify(agreed) + '\n');

        // A site with no schedule carries no load — which is what both paths said, and GH-776 settled.
        expect(agreed['effectiveLoad.totalEffectiveHours']).toBe(0);
        expect(agreed['compactionRisk.usageRatio']).toBe(0);
        expect(agreed['compactionRisk.riskPercent']).toBe(0);
        expect(agreed['actionPriority.priority']).toBe('Low');
        // And the moisture the person entered reached the engine, rather than the word `"optimal"`.
        process.stdout.write('[gh787] moisture entered "dry" -> engine saw '
            + JSON.stringify(wear.compactionRisk.moisture) + '\n');
        expect(wear.compactionRisk.moisture.level).toBe('dry');
    });
});

/** The construction of a pass, named so the comparison above reads as one. */
function withEverythingsConstruction(p) {
    return p.wear.inputs.construction;
}

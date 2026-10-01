'use strict';

/**
 * GH-793 (queue item 3gf) — A RESULT SLOT WHOSE REAL VALUE IS A STRING CAN ARRIVE AS AN OBJECT, AND THE
 * RENDERER MUST READ THAT AS "NOTHING TO STATE" RATHER THAN CRASH THE RUN.
 *
 * WHAT IS RECORDED IN THE DATABASE. Rows 96 and 97, both written 29.09.2026 10:25, carry
 * `outcome: failed`, `reason: calculation-error` and `detail.message: "Ie.indexOf is not a function"`. `Ie`
 * is the MLSN letter; `GH-777` put a type check in front of that one read. The same shape is still open for
 * the water letter one screen further down, where the renderer asks the letter for `.indexOf("Very high")`
 * with no check at all. Measured in the same table: `Me.indexOf` appears in 0 rows today, and all 91 rows
 * that have a result carry both letters as strings -- because a run that produced an object never got far
 * enough to be written.
 *
 * WHY THE CLASS IS THE TYPE AND NOT THE BLOCK. Three separate places hand the renderer an object where a
 * string is the real value: the extraction's own default (`gaip_extractCascadeResults`), the pass's engine
 * wrappers (`{status: 'Error'}` when an engine throws, `{status: 'Not available'}` when there is none), and
 * an MLSN result whose html came back empty. So the members of the class are found by measurement -- the
 * letters whose real value is a string and whose default is not -- and this set runs its cases over whatever
 * that measurement returns. A new letter of the same shape is covered without editing this file.
 *
 * THE FIXTURE REQUIREMENT IS ASSERTED, NOT NOTED. The renderer's soil branch reads
 * `if (!hasSoilData || typeof r !== "string")`, so a fixture whose `soil.ppm` is empty reaches `NO_DATA`
 * through `!hasSoilData` and never reaches the type check at all. A mutation of that check would then pass
 * green by construction of the fixture. The first test below states the requirement, so a fixture that
 * loses its readings turns this set red instead of making its cases toothless.
 *
 * DECLARED BOUNDARIES OF THIS BENCH:
 *   - `DOMParser` does not exist in node and the renderer reaches for one further down; it is stubbed, so
 *     nothing here speaks for the part of the render that follows it.
 *   - the sentence the water card states for a not-computed outcome is a SECOND COPY of one the composer
 *     already composes (`AnalysisNotice`, "{Module} was not calculated in this analysis. If this continues,
 *     contact us."). Measured: the runner page carries neither `GAIP_ANALYSIS_TEXTS` nor `dashboard-ui.js`,
 *     so it cannot ask the composer for it, and no guard compares the two -- the composer builds that
 *     sentence by concatenation, not as a quoted literal, so the copy guard does not see it. This set
 *     asserts the words it finds in the tree today; if the owner rewords hers, nothing here goes red. The
 *     substance asserted alongside holds either way: the card states NO water quality status.
 */

const { load, withSamples } = require('./lib/orchestrator-bench');

/** The renderer's first argument. Its readings are the fixture requirement, asserted below. */
const RENDER_STATE = () => ({ soil: { ppm: { K: 40 } }, turf: {} });

/** A real water sample, so the positive control has a letter the engine actually produced. */
const WATER_SAMPLE = { id: 'water_1', rawData: { EC: 0.35, pH: 7.2, Na: 12, Cl: 18, HCO3: 60, Ca: 20, Mg: 8 } };
const SOIL_SAMPLE = { id: 'soil_1', rawData: { K: 40, Ca: 803, CEC: 5.9, pH: 6 } };

/** The card bodies the renderer writes into, and the checkboxes it reads. */
function pageWithCards(ctx) {
    const nodes = {};
    const stub = (sel) => {
        nodes[sel] = nodes[sel] || {
            innerHTML: '', textContent: '', style: {}, dataset: {}, checked: true,
            classList: { add() {}, remove() {}, contains: () => false, toggle() {} },
            querySelector: () => null, querySelectorAll: () => [], appendChild() {},
            addEventListener() {}, setAttribute() {}, getAttribute: () => null, insertAdjacentHTML() {},
        };

        return nodes[sel];
    };
    ctx.document.querySelector = (sel) => (/gaip-[a-z-]+-body|gaip-enable-/.test(String(sel)) ? stub(sel) : null);
    ctx.DOMParser = class {
        parseFromString() {
            return { body: { textContent: '', innerHTML: '' }, querySelector: () => null, querySelectorAll: () => [] };
        }
    };

    return nodes;
}

/** A bench whose scripts all loaded -- the caller's positive control, and not optional. */
function benchAt(search) {
    const bench = load();
    if (bench.failed.length) throw new Error('the bench did not load: ' + JSON.stringify(bench.failed));
    bench.ctx.location.search = search;

    return bench;
}

/** One real cascade pass. `engines` limits it the way the product's own option does. */
function passOf(bench, engines) {
    const options = { fullRecompute: true };
    if (engines) options.includeEngines = engines;

    return bench.ctx.GilbaCascadeOrchestrator.runCascade(
        { inputs: { soil: { ppm: {}, methodology: 'slan' }, turf: {}, water: {} }, computed: {}, derived: {} },
        {}, options);
}

/** The product's own render of the letters it was handed. Returns what each card ended up saying. */
function renderOf(bench, args, opts) {
    const ctx = bench.ctx;
    const nodes = pageWithCards(ctx);
    let gone = null;
    if (opts && opts.withoutDisclosureModules) {
        /**
         * REMOVED BY ASSIGNMENT AND THEN CHECKED, because `delete` cannot be trusted here: both modules
         * declare their function at the top level of a script run in this context, and such a binding is not
         * configurable -- `delete` returns false and the function stays. The case then rendered WITH the
         * modules present, the fallback branch was never reached, and removing the two type checks it was
         * written for changed nothing. The renderer only asks `window.<name> ? … : …`, so undefined is
         * enough; what matters is that the removal is verified rather than assumed.
         */
        ctx.convertMLSNToProgressive = undefined;
        ctx.renderWaterProgressiveDisclosure = undefined;
        gone = { mlsn: typeof ctx.convertMLSNToProgressive, water: typeof ctx.renderWaterProgressiveDisclosure };
    }

    let threw = null;
    let at = null;
    try {
        ctx.gaip_render_results(RENDER_STATE(), { current: {} },
            args.l, args.d, args.oe, args.ne, args.ae, args.me, args.se, args.le);
    } catch (e) {
        threw = (e && e.message) || String(e);
        // WHERE it threw, not only what it said: a message alone cannot tell one read from its neighbour.
        at = String((e && e.stack) || '').split('\n')[1] || null;
        at = at && at.trim();
    }
    const said = (sel) => String((nodes[sel] || {}).innerHTML || '').replace(/\s+/g, ' ');

    return { threw, at, gone, soilCard: said('.gaip-mlsn-body'), waterCard: said('.gaip-water-body') };
}

/** `typeof` of each letter the renderer is handed, by the name the renderer knows it by. */
const LETTERS = ['l', 'd', 'oe', 'ne', 'ae', 'me', 'se', 'le'];
const typesOf = (args) => LETTERS.reduce((acc, k) => Object.assign(acc, { [k]: typeof args[k] }), {});

/**
 * The members of the class, measured rather than listed: a letter whose real value is a string and whose
 * substituted value is not. Both halves come from the product -- a real pass for the first, the extraction's
 * own default for the second.
 */
function classMembers(bench) {
    /**
     * THE REAL TYPES ARE TAKEN FROM A PASS THAT HAD ITS SAMPLES. Measured the other way first, and it
     * under-reported the class by one: on a bench addressed `?soil=none` the MLSN letter comes back an object
     * because the engine was gated out, so "string for real" was false for it and the letter that crashed
     * rows 96 and 97 fell out of its own class.
     */
    const real = typesOf(bench.ctx.gaip_extractCascadeResults(passOf(bench), {}, {}));
    const substituted = typesOf(bench.ctx.gaip_extractCascadeResults({}, {}, {}));
    const members = LETTERS.filter((k) => real[k] === 'string' && substituted[k] !== 'string');

    process.stdout.write('[gh793] letters the renderer is handed: ' + JSON.stringify(LETTERS)
        + '\n[gh793]   type when the engines ran:   ' + JSON.stringify(real)
        + '\n[gh793]   type of the substituted value: ' + JSON.stringify(substituted)
        + '\n[gh793]   MEMBERS OF THE CLASS (string for real, not a string when substituted): '
        + JSON.stringify(members) + '\n');

    return { members, real, substituted };
}

const NO_WATER_STATUS = /ACCEPTABLE|MONITOR|HIGH_RISK|IMMINENT_FAILURE|manageable with standard practices/;
const NO_SOIL_STATUS = /ACCEPTABLE|DEFICIENT|BORDERLINE/;

describe('GH-793 — a letter whose real value is a string arrives as an object', () => {
    test('THE FIXTURE CARRIES READINGS, so the soil type check is reachable at all', () => {
        const state = RENDER_STATE();

        expect(Object.values(state.soil.ppm).some((v) => v > 0)).toBe(true);
    });

    test('POSITIVE CONTROL: with both samples there, both letters are strings and no card says "no data"', () => {
        const bench = benchAt('?soil=soil_1&water=water_1');
        withSamples(bench, { soil: SOIL_SAMPLE, water: WATER_SAMPLE });
        const args = bench.ctx.gaip_extractCascadeResults(passOf(bench), {}, {});
        const { threw, soilCard, waterCard } = renderOf(bench, args);

        process.stdout.write('[gh793] positive control -> soil letter is a ' + typeof args.l
            + ', water letter is a ' + typeof args.d
            + '\n[gh793]   the renderer threw: ' + JSON.stringify(threw)
            + '\n[gh793]   soil card: ' + JSON.stringify(soilCard.slice(0, 120))
            + '\n[gh793]   water card: ' + JSON.stringify(waterCard.slice(0, 120)) + '\n');

        expect(threw).toBeNull();
        expect(typeof args.l).toBe('string');
        expect(typeof args.d).toBe('string');
        // Without this the cases below could be true of a bench where the branch was never entered.
        expect(soilCard).not.toContain('No soil test results entered');
        expect(soilCard + waterCard).not.toContain('[object Object]');
    });

    test('EVERY MEMBER OF THE CLASS, handed its own substituted value: the render is not ended by it', () => {
        const bench = benchAt('?soil=soil_1&water=water_1');
        withSamples(bench, { soil: SOIL_SAMPLE, water: WATER_SAMPLE });
        const { members } = classMembers(bench);

        expect(members.length).toBeGreaterThan(0);

        /**
         * ONE LETTER AT A TIME, and the rest left as the pass produced them. Substituting all eight at once
         * was measured first and it hit a different defect -- `Cannot read properties of undefined (reading
         * 'toFixed')`, from a letter that is an object either way. That crash is real and is named as a
         * finding, but it is not this class: mixing the two would have let this set pass or fail for the
         * wrong reason. The outcome of every letter is printed, so what this set does NOT claim is visible.
         */
        const real = bench.ctx.gaip_extractCascadeResults(passOf(bench), {}, {});
        const substituted = bench.ctx.gaip_extractCascadeResults({}, {}, {});
        const outcomes = {};
        LETTERS.forEach((k) => {
            const args = Object.assign({}, real, { [k]: substituted[k] });
            const out = renderOf(bench, args);
            outcomes[k] = { threw: out.threw, at: out.at,
                printedTheObject: (out.soilCard + out.waterCard).indexOf('[object Object]') > -1 };
        });

        process.stdout.write('[gh793] one letter substituted at a time, outcome per letter:\n'
            + LETTERS.map((k) => '[gh793]   ' + k + (members.indexOf(k) > -1 ? ' (in the class) ' : '                ')
                + ' threw ' + JSON.stringify(outcomes[k].threw)
                + (outcomes[k].at ? ' at ' + outcomes[k].at : '')
                + ', printed the object: ' + outcomes[k].printedTheObject).join('\n') + '\n');

        members.forEach((k) => {
            expect(outcomes[k].threw).toBeNull();
            expect(String(outcomes[k].threw)).not.toMatch(/indexOf is not a function/);
            expect(outcomes[k].printedTheObject).toBe(false);
        });
    });

    test('THE WATER ENGINE THREW: the wrapper returns an object and the run still reaches the cards', () => {
        const bench = benchAt('?soil=soil_1&water=water_1');
        withSamples(bench, { soil: SOIL_SAMPLE, water: WATER_SAMPLE });
        bench.ctx.waterEngine = () => { throw new Error('bench: the water engine failed'); };
        const args = bench.ctx.gaip_extractCascadeResults(passOf(bench), {}, {});
        const { threw, soilCard, waterCard } = renderOf(bench, args);

        process.stdout.write('[gh793] the water engine threw -> the letter is a ' + typeof args.d + ': '
            + JSON.stringify(args.d)
            + '\n[gh793]   the renderer threw: ' + JSON.stringify(threw)
            + '\n[gh793]   water card: ' + JSON.stringify(waterCard.slice(0, 160)) + '\n');

        expect(typeof args.d).toBe('object');
        expect(threw).toBeNull();
        expect(String(threw)).not.toMatch(/indexOf is not a function/);
        // Nothing is invented in its place either, and nothing is left blank.
        expect(waterCard).toContain('Water quality was not calculated in this analysis');
        expect(waterCard).not.toMatch(NO_WATER_STATUS);
        expect(soilCard + waterCard).not.toContain('[object Object]');
    });

    test('THE MLSN ENGINE THREW: the soil card says what a section with no table says', () => {
        const bench = benchAt('?soil=soil_1&water=water_1');
        withSamples(bench, { soil: SOIL_SAMPLE, water: WATER_SAMPLE });
        /**
         * THE FAILURE IS CONFINED TO THE PASS, because the renderer runs the MLSN engine AGAIN:
         * `mlsn-progressive-disclosure.js:753`, `window.mlsnEngine(state, weather)`, reached from `:7102`.
         * Left broken through the render, this case measured that second call instead of the letter -- the
         * error came back as `bench: the MLSN engine failed`, not as a letter read as a string. That second
         * uncaught call is a finding of its own and is named outside this file.
         */
        const realEngine = bench.ctx.mlsnEngine;
        bench.ctx.mlsnEngine = () => { throw new Error('bench: the MLSN engine failed'); };
        const args = bench.ctx.gaip_extractCascadeResults(passOf(bench), {}, {});
        bench.ctx.mlsnEngine = realEngine;
        const { threw, soilCard } = renderOf(bench, args);

        process.stdout.write('[gh793] the MLSN engine threw -> the letter is a ' + typeof args.l + ': '
            + JSON.stringify(args.l)
            + '\n[gh793]   the renderer threw: ' + JSON.stringify(threw)
            + '\n[gh793]   soil card: ' + JSON.stringify(soilCard.slice(0, 160)) + '\n');

        expect(typeof args.l).toBe('object');
        expect(threw).toBeNull();
        expect(soilCard).toContain('No soil test results entered');
        expect(soilCard).not.toMatch(NO_SOIL_STATUS);
    });

    /**
     * THE ABSENCE OF THE LETTER, ON THE PRODUCT'S OWN PATH, AND NOT BY HANDING THE RENDERER A DEFAULT.
     *
     * Measured why this case is needed rather than assumed: with the class computed from the type of the
     * substituted value, a mutation that makes that value a STRING takes the letter out of its own class, and
     * every case above then passes green while the defect is wide open. The universe moved with the mutation.
     * These two cases do not ask what type the default is -- they go through the pass the way the product
     * does, so whatever the substitution turns out to be, it is the renderer that is being measured.
     */
    test('WATER IS NOT AMONG THE ENGINES ASKED FOR: the card states no water status', () => {
        const bench = benchAt('?soil=soil_1&water=water_1');
        withSamples(bench, { soil: SOIL_SAMPLE, water: WATER_SAMPLE });
        const all = Object.keys(bench.ctx.GilbaCascadeOrchestrator.getEngineMap());
        const withoutWater = all.filter((id) => id !== 'water-blender');

        // Without this the case would run the full set of engines and prove nothing about absence.
        expect(withoutWater.length).toBe(all.length - 1);

        const args = bench.ctx.gaip_extractCascadeResults(passOf(bench, withoutWater), {}, {});
        const { threw, waterCard } = renderOf(bench, args);

        process.stdout.write('[gh793] water not asked for -> the letter is a ' + typeof args.d + ': '
            + JSON.stringify(args.d).slice(0, 60)
            + '\n[gh793]   the renderer threw: ' + JSON.stringify(threw)
            + '\n[gh793]   water card: ' + JSON.stringify(waterCard.slice(0, 200)) + '\n');

        expect(threw).toBeNull();
        expect(waterCard).toContain('Water quality was not calculated in this analysis');
        expect(waterCard).not.toMatch(NO_WATER_STATUS);
        expect(waterCard).not.toContain('[object Object]');
    });

    test('TOLD THERE IS NO SOIL SAMPLE, the shape of rows 96 and 97: the run is not ended by it', () => {
        const bench = benchAt('?soil=none&tissue=none&water=water_1');
        withSamples(bench, { water: WATER_SAMPLE });
        const args = bench.ctx.gaip_extractCascadeResults(passOf(bench), {}, {});
        const { threw, soilCard } = renderOf(bench, args);

        process.stdout.write('[gh793] no soil sample -> the letter is a ' + typeof args.l
            + '\n[gh793]   the renderer threw: ' + JSON.stringify(threw)
            + '\n[gh793]   soil card: ' + JSON.stringify(soilCard.slice(0, 140)) + '\n');

        expect(threw).toBeNull();
        expect(String(threw)).not.toMatch(/indexOf is not a function/);
        expect(soilCard).toContain('No soil test results entered');
        expect(soilCard).not.toMatch(NO_SOIL_STATUS);
    });

    test('WITHOUT THE DISCLOSURE MODULES: neither card prints the object itself', () => {
        const bench = benchAt('?soil=soil_1&water=water_1');
        withSamples(bench, { soil: SOIL_SAMPLE, water: WATER_SAMPLE });
        const { members } = classMembers(bench);
        const substituted = bench.ctx.gaip_extractCascadeResults({}, {}, {});
        const args = bench.ctx.gaip_extractCascadeResults(passOf(bench), {}, {});
        members.forEach((k) => { args[k] = substituted[k]; });
        const { threw, gone, soilCard, waterCard } = renderOf(bench, args, { withoutDisclosureModules: true });

        process.stdout.write('[gh793] no disclosure modules -> the two modules are now '
            + JSON.stringify(gone)
            + '\n[gh793]   the renderer threw: ' + JSON.stringify(threw)
            + '\n[gh793]   soil card tail: ' + JSON.stringify(soilCard.slice(-120))
            + '\n[gh793]   water card tail: ' + JSON.stringify(waterCard.slice(-120)) + '\n');

        // The case is about the branch taken WITHOUT them; if they are still there it proves nothing.
        expect(gone).toEqual({ mlsn: 'undefined', water: 'undefined' });
        expect(threw).toBeNull();
        expect(soilCard).not.toContain('[object Object]');
        expect(waterCard).not.toContain('[object Object]');
    });
});

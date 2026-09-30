/**
 * GH-786 (queue item 3gg) — ONE ANNUAL NITROGEN FIGURE, FOR THE ANALYSIS, THE EXPORT AND THE PLAN PAGE.
 *
 * The owner's decision, 30.09.2026: the figure comes from the saved programme
 * (`nutritionCalendarProgram.meta.annualNBase`), then from Settings (`turf.nProgram`), and then — her later
 * refinement the same day — from the grass species, the same removal table the nutrition programme itself runs
 * on. Page fields are not read at all.
 *
 * WHAT WAS WRONG, AND IT WAS NOT THREE SPELLINGS OF ONE RULE. It was three rules, one of them a race:
 *   - the RUN read two fields of the old hub's markup, `.gaip-nutrition-annual-n` then `.gaip-n-program`. The
 *     calendar restores a saved programme's figure into the first of them, so whichever finished first decided
 *     the number the whole analysis ran on. Measured on the stand across the 9 sites whose two stores disagree:
 *     of 32 analysis rows since 22.09, 4 were computed on Settings and 28 on the programme;
 *   - the EXPORT asked the resolver, which knew the rule — and also read the two fields again as a fallback,
 *     plus three more selectors, and baked a `userN` from them that no consumer ever read;
 *   - the PLAN page knew no rule: Settings, then `GAIP_HUB_CONFIG.nProgram`, a global describing whichever site
 *     the page was rendered for.
 *
 * HOW THESE CASES ARE BUILT. Every path below is the product's own: the state assembly is lifted out of
 * `hub-tissue-v3.js`, the Plan section out of `plan-ui.js`, and both are given the REAL
 * `nutrition-program-inputs.js` and `nutrition-requirement-core.js`, resolving the config by site id exactly as
 * a page does. So a case cannot pass because a stub agreed with another stub.
 *
 * THE BOUNDARY, measured and named: `null` is still reachable, for two reasons that are both "we were not
 * told" — the site's config did not resolve for the id asked about, or the core file is not loaded in that
 * frame. It is no longer the answer for a site that merely has neither store. Seven places downstream turn an
 * absent figure into a number (0, 200 or 160 depending on the place); they are named in the item and
 * deliberately unchanged, and the last case here holds what reaches them.
 */

'use strict';

const vm = require('vm');
const fs = require('fs');
const path = require('path');

const ASSETS = path.join(__dirname, '..', 'assets');
const read = (f) => fs.readFileSync(path.join(ASSETS, f), 'utf8');
const HUB = read('hub-tissue-v3.js');
const PLAN_UI = read('plan-ui.js');

const SITE = 'gh786-site';

/** A function declaration lifted out of a file that keeps its functions to itself. */
function lift(src, name) {
    const at = src.indexOf('function ' + name + '(');
    expect(at).toBeGreaterThan(-1);
    let depth = 0;
    for (let i = src.indexOf('{', at); i < src.length; i++) {
        if (src[i] === '{') depth++;
        else if (src[i] === '}') { depth--; if (!depth) return src.slice(at, i + 1); }
    }
    throw new Error(name + ' never closes');
}

function baseSandbox(extra) {
    const box = {
        console: { log() {}, warn() {}, error() {}, info() {}, debug() {} },
        JSON, Object, Array, String, Number, Boolean, Math, Date, RegExp, Promise, Map, Set,
        parseFloat, parseInt, isNaN, isFinite, encodeURIComponent, decodeURIComponent,
        setTimeout: () => 0, clearTimeout() {}, setInterval: () => 0, clearInterval() {},
        localStorage: { getItem: () => null, setItem() {}, removeItem() {} },
        addEventListener() {}, removeEventListener() {}, dispatchEvent() {},
        CustomEvent: function CustomEvent() {},
        ...(extra || {}),
    };
    box.window = box; box.global = box; box.globalThis = box; box.self = box;
    return box;
}

/**
 * The two service files a page loads, in a context, with this site's config reachable BY ID — which is how
 * `annualNBaseOf`'s callers reach it and why none of them may read a page global instead.
 */
function withServices(box, siteConfig, opts) {
    box.GAIP_SampleManager = { getActiveSiteId: () => ((opts && opts.activeSiteId !== undefined) ? opts.activeSiteId : SITE) };
    box.GAIP_SiteConfig = {
        getConfig: (id) => (id === SITE ? siteConfig : null),
        getSite: () => null,
    };
    const ctx = vm.createContext(box);
    const files = (opts && opts.withoutCore) ? ['nutrition-program-inputs.js']
        : ['nutrition-requirement-core.js', 'nutrition-program-inputs.js'];
    files.forEach((f) => {
        try {
            vm.runInContext(read(f), ctx, { filename: f });
        } catch (e) {
            // A service that wires itself to a page may throw on a stub document; its API is published first.
        }
    });
    // Each file is an IIFE publishing onto the `window` it is handed, so both spellings the product uses resolve.
    box.GAIP_NutritionProgramInputs = box.window.GAIP_NutritionProgramInputs;
    box.GilbaNutritionCore = box.window.GilbaNutritionCore || box.GilbaNutritionCore;
    return ctx;
}

/** The service alone, for the function every surface asks. */
function service(siteConfig, opts) {
    const box = baseSandbox({ document: { querySelector: () => null, getElementById: () => null, querySelectorAll: () => [] } });
    const ctx = withServices(box, siteConfig, opts);
    expect(box.GAIP_NutritionProgramInputs).toBeTruthy();
    return { api: box.GAIP_NutritionProgramInputs, ctx };
}

/** THE RUN (reader 1): `gaip_build_state`, with the old hub's fields present and answering. */
const ASSEMBLY = ['safeNum', 'collectGridValues', 'convertDateToISO', 'calculateEndDate', 'gaip_readSoilForm',
    'gaip_soilFromActiveSample', 'gaip_soilStateFrom', 'gaip_namedSample', 'gaip_sampleReadings',
    'gaip_waterFromActiveSample', 'calculateC3C4Fractions', 'enforceHemisphereTurfRules',
    'gaip_lastPgrForThisRun', 'gaip_build_state'];

function runFigure(siteConfig, fields, opts) {
    const box = baseSandbox({
        document: { querySelector: () => null, querySelectorAll: () => [] },
        location: { search: '' }, URLSearchParams,
    });
    const ctx = withServices(box, siteConfig, opts);
    ASSEMBLY.forEach((n) => vm.runInContext(lift(HUB, n), ctx, { filename: n }));
    const page = {
        querySelector: (sel) => ((fields && sel in fields) ? { value: fields[sel], dataset: {} } : null),
        querySelectorAll: () => [],
    };
    const state = ctx.gaip_build_state(page);
    return state.turf ? state.turf.nProgramKgHaYr : undefined;
}

/** THE EXPORT (reader 5): the resolver, called the way the Word export calls it — with no Plan form. */
function exportFigure(siteConfig) {
    const { api } = service(siteConfig);
    const out = api.resolveSiteProgramInputs({ siteId: SITE, siteConfig: siteConfig, planForm: null });
    return { base: out.annualNBase, source: out.sources.annualN };
}

/** THE PLAN PAGE (reader 8): `renderSeasonalN`, writing into the page's own element. */
function planSection(siteConfig, computed) {
    const nodes = {};
    const stub = (id) => ({ id, innerHTML: '', style: {}, dataset: {}, appendChild() {}, setAttribute() {} });
    const box = baseSandbox({
        document: {
            readyState: 'complete', addEventListener() {}, removeEventListener() {},
            getElementById: (id) => (nodes[id] = nodes[id] || stub(id)),
            querySelector: () => null, querySelectorAll: () => [], createElement: () => stub(''),
            body: stub('body'),
        },
        location: { hash: '', search: '', pathname: '/plan' },
        history: { replaceState() {} },
    });
    const ctx = withServices(box, siteConfig);
    ['esc', 'safeNum', 'clamp', '_annualNOf', 'emptyState', 'nowMonth', 'gpC3', 'gpC4', 'getMonthlyGP',
        'renderSeasonalN'].forEach((fn) => vm.runInContext(lift(PLAN_UI, fn), ctx, { filename: fn }));
    vm.runInContext('var EMPTY_ICONS = { nutrition: "<svg/>" };', ctx);
    ['SEASONS_S', 'SEASONS_N', 'DEFAULT_GP_MONTHLY'].forEach((name) => {
        const at = PLAN_UI.indexOf('var ' + name + ' =');
        expect(at).toBeGreaterThan(-1);
        const end = PLAN_UI.indexOf('];', at);
        vm.runInContext(PLAN_UI.slice(at, end + 2), ctx, { filename: name });
    });
    ctx.renderSeasonalN(computed || null, siteConfig);
    return nodes['plan-seasonal-body'].innerHTML;
}

/** What the Plan section printed as the annual programme, or null when it printed the empty state. */
function planFigure(siteConfig, computed) {
    const html = planSection(siteConfig, computed);
    const m = html.match(/Annual N programme:\s*<strong[^>]*>(\d+) kg N\/ha/);
    return m ? parseFloat(m[1]) : null;
}

/** Comments are not code: a selector or a substitution quoted in a note must not count as one. */
const codeOf = (src) => src
    .replace(/\/\*[\s\S]*?\*\//g, (m) => m.replace(/[^\n]/g, ' '))
    .replace(/(^|[^:])\/\/[^\n]*/g, (m, p) => p + m.slice(p.length).replace(/[^\n]/g, ' '));

/** The shade-nutrition module, in a frame of its own. */
function loadShade() {
    const box = baseSandbox({ document: { querySelector: () => null, getElementById: () => null, querySelectorAll: () => [] } });
    const ctx = vm.createContext(box);
    try {
        vm.runInContext(read('shade-nutrition-integration.js'), ctx, { filename: 'shade-nutrition-integration.js' });
    } catch (e) { /* wires itself to a page */ }
    const api = box.window.GSSH_ShadeNutritionIntegration || box.GSSH_ShadeNutritionIntegration;
    expect(api && typeof api.computeShadeNutritionContext).toBe('function');
    return api;
}

const CFG = (turf, programme) => {
    const cfg = { turf: Object.assign({ species: 'Perennial Ryegrass', turfType: 'golf', methodology: 'mlsn' }, turf) };
    if (programme) cfg.nutritionCalendarProgram = programme;
    return cfg;
};
const FIELDS_LYING = { '.gaip-nutrition-annual-n': '999', '.gaip-n-program': '200' };

describe('GH-786 — one annual nitrogen figure for every surface', () => {
    test('POSITIVE CONTROL: all three product paths answer at all, on a site that has a programme', () => {
        // Without this, every equality below could hold between paths that never ran.
        const cfg = CFG({ nProgram: 150 }, { meta: { annualNBase: 120 } });
        const run = runFigure(cfg, FIELDS_LYING);
        const exp = exportFigure(cfg);
        const plan = planSection(cfg, null);

        process.stdout.write('\n[gh786] run ' + JSON.stringify(run) + ' | export ' + JSON.stringify(exp)
            + ' | plan section ' + JSON.stringify(plan.slice(0, 70)) + '\n');
        expect(typeof run).toBe('number');
        expect(typeof exp.base).toBe('number');
        expect(plan.length).toBeGreaterThan(40);
        expect(plan).toContain('Annual N programme');
    });

    test('the programme wins over Settings, and all three surfaces say the same number', () => {
        const cfg = CFG({ nProgram: 150 }, { meta: { annualNBase: 120 } });
        const got = { run: runFigure(cfg, FIELDS_LYING), export: exportFigure(cfg).base, plan: planFigure(cfg) };
        process.stdout.write('[gh786] programme 120 beside Settings 150 -> ' + JSON.stringify(got) + '\n');
        expect(got).toEqual({ run: 120, export: 120, plan: 120 });
        expect(exportFigure(cfg).source).toBe('plan-persisted');
    });

    test('with no programme, all three take Settings', () => {
        const cfg = CFG({ nProgram: 150 });
        const got = { run: runFigure(cfg, FIELDS_LYING), export: exportFigure(cfg).base, plan: planFigure(cfg) };
        process.stdout.write('[gh786] Settings 150, no programme -> ' + JSON.stringify(got) + '\n');
        expect(got).toEqual({ run: 150, export: 150, plan: 150 });
        expect(exportFigure(cfg).source).toBe('settings-turf');
    });

    /**
     * The owner's refinement of 30.09.2026: with neither store the figure comes from the grass species, in all
     * three places, and it is the nutrition programme's own table — `REMOVAL_RATES` in
     * `nutrition-requirement-core.js`, which is where this file already read it and the only place it exists.
     * Two species, because one number could be a coincidence.
     */
    test('with neither store, all three take the species removal rate — and it follows the species', () => {
        const rye = CFG({ species: 'Perennial Ryegrass' });
        const couch = CFG({ species: 'couch' });
        const gotRye = { run: runFigure(rye, FIELDS_LYING), export: exportFigure(rye).base, plan: planFigure(rye) };
        const gotCouch = { run: runFigure(couch, FIELDS_LYING), export: exportFigure(couch).base, plan: planFigure(couch) };
        process.stdout.write('[gh786] neither store — ryegrass ' + JSON.stringify(gotRye)
            + ' | couch ' + JSON.stringify(gotCouch) + '\n');
        expect(gotRye).toEqual({ run: 180, export: 180, plan: 180 });
        expect(gotCouch).toEqual({ run: 200, export: 200, plan: 200 });
        expect(exportFigure(rye).source).toBe('species-default');
    });

    test('the two page fields are not seen by any path, whatever they hold', () => {
        // The fields carry 999 and 200; the site's stores say 120. A path that still reads a field prints its
        // number, and the old run read the first of these two before anything else.
        const cfg = CFG({ nProgram: 150 }, { meta: { annualNBase: 120 } });
        const withFields = { run: runFigure(cfg, FIELDS_LYING), export: exportFigure(cfg).base, plan: planFigure(cfg) };
        const without = { run: runFigure(cfg, {}), export: exportFigure(cfg).base, plan: planFigure(cfg) };
        process.stdout.write('[gh786] fields 999/200 present ' + JSON.stringify(withFields)
            + ' | absent ' + JSON.stringify(without) + '\n');
        expect(withFields).toEqual(without);
        expect(Object.values(withFields)).not.toContain(999);
        expect(Object.values(withFields)).not.toContain(200);
    });

    test('a programme from before GH-383 has the traffic modifier divided back out', () => {
        const cfg = CFG({ nProgram: 150 }, { adjustments: { target_n: 288, traffic_modifier: 1.15 } });
        const { api } = service(cfg);
        const got = api.annualNBaseOf(cfg);
        process.stdout.write('[gh786] target_n 288 / modifier 1.15 -> ' + JSON.stringify(got) + '\n');
        expect(got.value).toBeCloseTo(250.43, 2);
        expect(got.source).toBe('plan-persisted');
        expect(runFigure(cfg, FIELDS_LYING)).toBeCloseTo(250.43, 2);
    });

    /**
     * THE THREE REASONS `null` SURVIVES, and all three are "we were not told" rather than "there is nothing".
     * Without the first of them the function answered 160 — the removal table's figure for an unnamed sward —
     * for a site nobody had identified, which is a substitution wearing the shape of an answer. Measured while
     * writing this case.
     */
    test('absent stays absent: an unresolved config and a frame without the core file both answer null', () => {
        const cfg = CFG({ nProgram: 150 }, { meta: { annualNBase: 120 } });
        const { api } = service(cfg);
        const noConfig = api.annualNBaseOf(null);
        const noCore = service(cfg, { withoutCore: true }).api.annualNBaseOf(CFG({}));
        // And the run carries it: a site the page cannot resolve by id gives the cascade no figure at all.
        const runUnknownSite = runFigure(cfg, FIELDS_LYING, { activeSiteId: 'a-site-this-page-was-not-told-about' });

        process.stdout.write('[gh786] no config ' + JSON.stringify(noConfig) + ' | no core ' + JSON.stringify(noCore)
            + ' | run for an unknown site ' + JSON.stringify(runUnknownSite) + '\n');
        expect(noConfig).toEqual({ value: null, source: null });
        expect(noCore).toEqual({ value: null, source: null });
        expect(runUnknownSite).toBeNull();
    });

    /**
     * THE SPECIES MUST BE NAMED FOR THE THIRD STEP TO RUN — the owner's decision of 30.09.2026, "without the
     * substitution", after the first form of the step was measured across the stand: 3 of the 21 sites name no
     * species, and each was getting 160 (`mixedCool`, the table's figure for an unnamed sward) and, on the Plan
     * page, a quarterly plan where the empty state had stood.
     *
     * AND THIS IS A DIFFERENT OUTCOME FROM A DIFFERENT CAUSE, which is why it is its own case: "we could not
     * identify the site" and "the site names no grass" both answer `null` now, but they are not one fact, and
     * the case above would pass for a function that confused them.
     *
     * THE SUBSTITUTION IS UPSTREAM OF THE TABLE, and that is what makes this testable at all:
     * `resolveSpeciesKey` answers `mixedCool` for an empty value, for null and for an unrecognised name, so the
     * step tests the raw setting. An empty string and a whitespace-only value are the shapes a form leaves.
     */
    test('with neither store and no species named, there is no figure — and a named species still gives one', () => {
        const { api } = service(CFG({}));
        const shapes = {
            'no species key': api.annualNBaseOf({ turf: { turfType: 'golf' } }),
            'empty string': api.annualNBaseOf({ turf: { species: '' } }),
            'whitespace only': api.annualNBaseOf({ turf: { species: '   ' } }),
            'null species': api.annualNBaseOf({ turf: { species: null } }),
            'named: ryegrass': api.annualNBaseOf({ turf: { species: 'Perennial Ryegrass' } }),
        };
        process.stdout.write('[gh786] the third step by species setting: ' + JSON.stringify(shapes) + '\n');

        expect(shapes['no species key']).toEqual({ value: null, source: null });
        expect(shapes['empty string']).toEqual({ value: null, source: null });
        expect(shapes['whitespace only']).toEqual({ value: null, source: null });
        expect(shapes['null species']).toEqual({ value: null, source: null });
        expect(shapes['named: ryegrass']).toEqual({ value: 180, source: 'species-default' });

        // And it carries to the three surfaces: no store, no species -> nothing anywhere.
        const unnamed = { turf: { turfType: 'golf', methodology: 'mlsn' } };
        const got = { run: runFigure(unnamed, FIELDS_LYING), export: exportFigure(unnamed).base, plan: planFigure(unnamed) };
        process.stdout.write('[gh786] unnamed species across the three surfaces: ' + JSON.stringify(got) + '\n');
        expect(got).toEqual({ run: null, export: null, plan: null });
        expect(exportFigure(unnamed).source).toBe('unresolved');
        expect(planSection(unnamed, null)).toContain('N programme not set');
    });

    test('the Plan section still prints its empty state when there is no figure at all', () => {
        // The species table needs the core file; without it the section has nothing to split into quarters.
        const nodes = {};
        const stub = (id) => ({ id, innerHTML: '', style: {}, dataset: {}, appendChild() {}, setAttribute() {} });
        const box = baseSandbox({
            document: {
                readyState: 'complete', addEventListener() {}, removeEventListener() {},
                getElementById: (id) => (nodes[id] = nodes[id] || stub(id)),
                querySelector: () => null, querySelectorAll: () => [], createElement: () => stub(''),
                body: stub('body'),
            },
            location: { hash: '', search: '', pathname: '/plan' },
        });
        const ctx = withServices(box, CFG({}), { withoutCore: true });
        ['esc', 'safeNum', 'clamp', '_annualNOf', 'emptyState', 'nowMonth', 'gpC3', 'gpC4', 'getMonthlyGP',
            'renderSeasonalN'].forEach((fn) => vm.runInContext(lift(PLAN_UI, fn), ctx, { filename: fn }));
        vm.runInContext('var EMPTY_ICONS = { nutrition: "<svg/>" };', ctx);
        ['SEASONS_S', 'SEASONS_N', 'DEFAULT_GP_MONTHLY'].forEach((name) => {
            const at = PLAN_UI.indexOf('var ' + name + ' =');
            vm.runInContext(PLAN_UI.slice(at, PLAN_UI.indexOf('];', at) + 2), ctx, { filename: name });
        });
        ctx.renderSeasonalN(null, CFG({}));

        const html = nodes['plan-seasonal-body'].innerHTML;
        process.stdout.write('[gh786] plan section with no figure -> ' + JSON.stringify(html.slice(0, 80)) + '\n');
        expect(html).toContain('N programme not set');
        expect(html).not.toContain('Annual N programme:');
    });

    /**
     * THE CENSUS, and it is a LIST rather than a count: every read of the five selectors this item removed,
     * across all of `assets`, with the role of each. A count cannot tell a calculation input from the page
     * wiring of the old hub's form, and the wiring is not this item's subject — it stays, and is named.
     */
    test('no file reads a page field to decide the annual nitrogen figure any more', () => {
        const SELECTORS = ['gaip-nutrition-annual-n', 'gaip-n-program', '#n-program', 'name="n-program"',
            'gaip-annual-n'];
        // The files that DECIDE the figure. Anything here reading a selector is the defect this item closed.
        const DECIDERS = ['hub-tissue-v3.js', 'nutrition-summary-integration.js', 'word-export.js',
            'word-export-combined.js', 'plan-ui.js', 'nutrition-program-inputs.js'];
        /** Comments are not reads: a selector quoted in a comment saying it is gone must not count as one. */
        const codeOf = (src) => src
            .replace(/\/\*[\s\S]*?\*\//g, (m) => m.replace(/[^\n]/g, ' '))
            .replace(/(^|[^:])\/\/[^\n]*/g, (m, p) => p + m.slice(p.length).replace(/[^\n]/g, ' '));

        const found = [];
        fs.readdirSync(ASSETS).filter((f) => f.endsWith('.js')).forEach((file) => {
            const lines = codeOf(read(file)).split('\n');
            lines.forEach((line, i) => {
                SELECTORS.forEach((sel) => {
                    if (line.indexOf(sel) === -1) return;
                    found.push({ file, line: i + 1, selector: sel, decider: DECIDERS.indexOf(file) !== -1,
                        text: line.trim().slice(0, 90) });
                });
            });
        });

        process.stdout.write('[gh786] every read of the five selectors in assets (' + found.length + '):\n'
            + found.map((r) => '[gh786]    ' + (r.decider ? 'DECIDER  ' : 'wiring   ')
                + r.file + ':' + r.line + '  ' + r.text).join('\n') + '\n');

        // The universe is real: the selectors do still exist in the tree, on the form of the old hub.
        expect(found.length).toBeGreaterThan(0);
        expect(found.filter((r) => !r.decider).length).toBeGreaterThan(0);
        // And no file that decides the figure reads one.
        expect(found.filter((r) => r.decider).map((r) => r.file + ':' + r.line)).toEqual([]);
    });

    /**
     * THE REVIEWER'S ADDITION, three things in two files, and all three are this item's own class.
     *
     * `shade-nutrition-integration.js` ended its annual-N chain on `|| 200`, and the same `||` discarded an
     * entered zero — the class removed in GH-780 and GH-781. `nutrition-summary-integration.js` ended its own on
     * `|| 160`, off a SECOND COPY of the species removal table: 12 species, six figures each, compared key by
     * key against the owner of that table before the copy was removed (no difference in any figure, and `couch`
     * declared twice in the copy).
     */
    test('the shade context refuses a site with no annual N instead of computing on 200, and knows an entered zero', () => {
        const S = loadShade();
        const shade = { averageShade: 40, nAdjustment: { factor: 0.8 }, monthly: [], dailyLight: [] };
        const ctxFor = (turf, fertility) =>
            S.computeShadeNutritionContext({ turf: turf, soil: {}, fertility: fertility || {} }, shade);

        const none = ctxFor({});
        const zero = ctxFor({ nProgramKgHaYr: 0 });
        const real = ctxFor({ nProgramKgHaYr: 120 });

        process.stdout.write('[gh786] shade context — no figure: ' + JSON.stringify(none)
            + '\n[gh786]   entered zero: applied=' + zero.applied
            + ', originalN=' + JSON.stringify(zero.nAdjustment.originalN)
            + ', reason=' + JSON.stringify(zero.nAdjustment.reason)
            + '\n[gh786]   figure of 120: applied=' + real.applied
            + ', ' + JSON.stringify(real.summary && real.summary.nReduction) + '\n');

        // 1. No figure is an outcome of its own, not 200 and not a computed context.
        expect(none.applied).toBe(false);
        expect(none.reason).toMatch(/annual N/i);
        expect(none.nAdjustment).toBeUndefined();

        // 2. An entered zero reaches the adjustment AS ZERO and is named as a zero — not as missing data.
        expect(zero.nAdjustment.originalN).toBe(0);
        expect(zero.nAdjustment.reason).toMatch(/zero/i);

        // 3. A real figure is still reduced, so none of the above passes because nothing runs.
        expect(real.applied).toBe(true);
        expect(real.summary.nReduction).toContain('120');

        // And the substitution is gone from the file, not merely unreached.
        expect(codeOf(read('shade-nutrition-integration.js'))).not.toMatch(/annualN\)\s*\|\|\s*\n?\s*200/);
    });

    test('the summary integration no longer substitutes a species figure of its own', () => {
        const code = codeOf(read('nutrition-summary-integration.js'));
        const extractor = code.slice(code.indexOf('function extractAnnualNRate'),
            code.indexOf('function extractUserAnnualN'));
        process.stdout.write('[gh786] extractAnnualNRate now ends on: '
            + JSON.stringify(extractor.trim().split('\n').slice(-3).join(' ').trim()) + '\n');
        expect(extractor).not.toMatch(/\|\|\s*160/);
        expect(extractor).toMatch(/return null;/);
    });

    /**
     * ONE TABLE, AND THE GUARD IS A LIST OF THE FILES THAT DECLARE ONE — so a third copy appearing in a fourth
     * file reddens this on the day it is written, which a comparison of two known copies would not.
     */
    test('the species removal table is declared in one file, and the summary reads that one', () => {
        /**
         * THE SHAPE OF A REMOVAL TABLE, narrowly: a species key whose six nutrients are PLAIN NUMBERS in
         * kg/ha/yr. Written first as "a species key carrying an N figure", which found two more files — and
         * both were something else: `nutrient-demand-engine.js` declares tissue CONCENTRATIONS in percent and
         * `soil-nutrition-analysis.js` tissue RANGES as {lo, hi, unit}. A guard that calls those copies of this
         * table would send the next reader to rewrite two tables that have nothing to do with it.
         */
        const declarers = [];
        fs.readdirSync(ASSETS).filter((f) => f.endsWith('.js')).forEach((file) => {
            const code = codeOf(read(file));
            const m = code.match(/(perennialRyegrass|mixedCool)\s*:\s*\{\s*N\s*:\s*\d+\s*,\s*P\s*:\s*\d+\s*,\s*K\s*:\s*\d+/);
            if (m) declarers.push(file + ' (' + m[1] + ')');
        });
        process.stdout.write('[gh786] files declaring a species removal table: ' + JSON.stringify(declarers) + '\n');
        expect(declarers).toEqual(['nutrition-requirement-core.js (perennialRyegrass)']);

        // And the summary's own accessor hands back that table, value for value.
        const box = baseSandbox({ document: { querySelector: () => null, getElementById: () => null } });
        const ctx = vm.createContext(box);
        ['nutrition-requirement-core.js', 'nutrition-summary-integration.js'].forEach((f) => {
            try { vm.runInContext(read(f), ctx, { filename: f }); } catch (e) { /* wires itself to a page */ }
        });
        const core = box.window.NutritionRequirementCore.REMOVAL_RATES;
        const viaSummary = box.window.GilbaNutritionSummary.config.removalRates;
        process.stdout.write('[gh786] the summary reads ' + Object.keys(viaSummary || {}).length
            + ' species from the owner of ' + Object.keys(core).length + '\n');
        expect(viaSummary).toBe(core);
    });

    /**
     * READER 7 — the interaction check of the export. It read `data.turf.nProgramKgHaYr`, a key no writer puts
     * in `data.turf`: that block is built field by field from the identity resolver, and this document's annual
     * N lives in `data.engineInputs.turf`. So the check was handed 0 for every site ever exported and its one
     * nitrogen rule could not fire. Asserted against the file, because the defect was a key that does not exist.
     */
    test('the export hands the interaction check the figure it resolved, from where that figure actually sits', () => {
        const WX = read('word-export.js');
        const codeOf = (src) => src
            .replace(/\/\*[\s\S]*?\*\//g, (m) => m.replace(/[^\n]/g, ' '))
            .replace(/(^|[^:])\/\/[^\n]*/g, (m, p) => p + m.slice(p.length).replace(/[^\n]/g, ' '));
        const code = codeOf(WX);

        const writers = code.split('\n')
            .map((l, i) => ({ line: i + 1, text: l.trim() }))
            .filter((r) => /data\.turf\.nProgramKgHaYr\s*=/.test(r.text)
                || /nProgramKgHaYr\s*:/.test(r.text));
        const context = code.slice(code.indexOf('var _mContext = {'), code.indexOf('var _mResult'));

        process.stdout.write('[gh786] lines in word-export.js that write an nProgramKgHaYr:\n'
            + writers.map((r) => '[gh786]    :' + r.line + '  ' + r.text).join('\n')
            + '\n[gh786] the interaction context reads: '
            + JSON.stringify((context.match(/nProgram:[^,]*(,|$)/) || ['(none)'])[0].trim()) + '\n');

        // Nothing writes the key the check used to read.
        expect(code).not.toMatch(/data\.turf\.nProgramKgHaYr\s*=/);
        // And the check is handed the figure this document resolved, before the traffic modifier.
        expect(context).toMatch(/data\.engineInputs\s*&&\s*data\.engineInputs\.turf/);
        expect(context).toMatch(/annualNBase/);
        expect(context).not.toMatch(/data\.turf\s*&&\s*data\.turf\.nProgramKgHaYr/);
    });
});

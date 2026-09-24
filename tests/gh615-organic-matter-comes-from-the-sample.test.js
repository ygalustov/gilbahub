/**
 * GH-615 — ORGANIC MATTER REACHES THE RUN FROM THE SAMPLE, NOT FROM THE OLD
 * HUB'S FORM.
 *
 * THE OWNER SETTLED IT, 24.09.2026: the row must carry organic matter — "in the
 * old hub it worked, so of course it should". There was no fork to decide.
 *
 * WHAT WAS BROKEN, AND IT WAS ONE LINK. `pH`, `CEC`, `EC` and bulk density are
 * read from the active soil sample when the run builds its state; `LOI` and
 * `OM_pct` still read `.gaip-loi`, a FORM FIELD OF THE OLD HUB, so the value
 * came from the markup of the hidden runner and never arrived. The reader
 * already answered it — `gaip_soilFromActiveSample()` returns `OM` — so the
 * chain was complete except for its last link. That is the GH-459 class: what a
 * calculation uses taken from the state of a page instead of from the data of
 * the object it is about.
 *
 * THE CLAIM THIS FILE EXISTS TO SETTLE. The repair was reported with "the
 * reader answers `OM`" NOT PROVED BY EXECUTION — Jest could not start that day,
 * and the reviewer named it as the one open border of the work. It is executed
 * here, against the PRODUCT's own normaliser rather than a stub of one, for the
 * reason GH-591 established: a bench with its own name table proves something
 * about the bench.
 *
 * MEASURED ON THE STAND BEFORE THE CHANGE: of 48 live soil samples, 25 carry
 * organic matter — 22 under `OM`, 19 under `OM_Percent` — and every value is
 * non-empty. None carries the stratified fields at all.
 *
 * WHAT IS DELIBERATELY NOT HERE. `LOI_0_2`, `LOI_2_4` and `LOI_4_6` still read
 * the form, and the last case below pins that on purpose: the owner has not
 * decided whether those fields are fixed or removed from the screen, and a
 * repair made before that decision could be work thrown away. When she decides,
 * that case must go red.
 */

'use strict';

const vm = require('vm');
const fs = require('fs');
const path = require('path');

const { stubSampleManager } = require('./lib/sample-readings');

const ASSETS = path.join(__dirname, '..', 'assets');
const SRC = fs.readFileSync(path.join(ASSETS, 'hub-tissue-v3.js'), 'utf8');

/**
 * Lab rows, flat, the way the store holds them — `stubSampleManager` wraps each
 * one as the sample manager does. Handing it a pre-wrapped `{id, values}`
 * instead made the reader answer `null` on the first run of this file, and the
 * failure looked exactly like the defect under test. The bench was wrong, not
 * the product; the shape is taken from `gh577`'s fixture rather than invented.
 */
const WITH_OM = { pH_Water: '6.1', CEC_meq100g: '5.9', OM: '2.9', K: '40' };
/** The other spelling, which 19 of the 25 live samples use. */
const WITH_OM_PERCENT = { pH_Water: '6.1', CEC_meq100g: '5.9', OM_Percent: '4.2', K: '40' };
/** A sample that was never tested for it. */
const WITHOUT_OM = { pH_Water: '6.1', CEC_meq100g: '5.9', K: '40' };

/** The reader, executed — only the functions this file is about. */
function readerFor(sample) {
    const sandbox = {
        console: { log() {}, warn() {}, error() {} },
        document: { querySelector: () => null, querySelectorAll: () => [] },
        Date, JSON, Math, Object, Array, String, Number, parseFloat, parseInt, isNaN,
    };
    sandbox.window = sandbox;
    sandbox.global = sandbox;
    sandbox.globalThis = sandbox;
    sandbox.GAIP_SampleManager = stubSampleManager(sample ? { soil: sample } : {});

    const ctx = vm.createContext(sandbox);
    const slice = (name) => {
        const at = SRC.indexOf('function ' + name + '(');
        expect(at).toBeGreaterThan(-1);
        let depth = 0;
        const open = SRC.indexOf('{', at);
        for (let j = open; j < SRC.length; j++) {
            if (SRC[j] === '{') depth++;
            else if (SRC[j] === '}') { depth--; if (!depth) return SRC.slice(at, j + 1); }
        }
        throw new Error('unbalanced ' + name);
    };
    vm.runInContext(slice('safeNum'), ctx, { filename: 'safeNum' });
    vm.runInContext(slice('collectGridValues'), ctx, { filename: 'collectGridValues' });
    vm.runInContext(slice('gaip_soilFromActiveSample'), ctx, { filename: 'gaip_soilFromActiveSample' });
    expect(typeof ctx.gaip_soilFromActiveSample).toBe('function');
    return ctx;
}

/** The state builder's text, comments removed — it explains what it no longer reads. */
/**
 * GH-628: the soil state is assembled by `gaip_soilStateFrom`, and the page is
 * read by `gaip_readSoilForm` beside it. The window covers BOTH, because the two
 * claims below are about the two halves: organic matter comes from the sample,
 * and the stratified fields still come off the page.
 */
function stateBuilderSource() {
    const at = SRC.indexOf('function gaip_readSoilForm(');
    expect(at).toBeGreaterThan(-1);
    const end = SRC.indexOf('return soil;', at);
    expect(end).toBeGreaterThan(at);
    const window = SRC.slice(at, end)
        .replace(/\/\*[\s\S]*?\*\//g, '')
        .split('\n').filter((l) => !/^\s*\/\//.test(l)).join('\n');
    // The positive control: a window that collapsed would let every claim below
    // pass over nothing, and from outside that is indistinguishable from code
    // that works. The floor is well under the real size, not a pin on it.
    expect(window.length).toBeGreaterThan(800);
    expect(window).toContain('LOI_0_2');
    return window;
}

describe('GH-615 — the run takes organic matter from the sample', () => {
    test('the reader answers OM, and this is the claim that was never executed', () => {
        // The border the reviewer named. Positive control first: the reader
        // returned something at all, so a null below would be a real absence
        // rather than a bench that never reached the function.
        const soil = readerFor(WITH_OM).gaip_soilFromActiveSample();

        expect(soil).not.toBeNull();
        process.stdout.write('[gh615] reader answered: ' + JSON.stringify(soil.OM) + '\n');

        expect(soil.OM).toBe(2.9);
        // And its neighbours still arrive, or "OM works" would be true of a
        // reader that had stopped doing everything else.
        expect(soil.pH_water).toBe(6.1);
        expect(soil.CEC).toBe(5.9);
    });

    test('the other spelling arrives too, through the declared normaliser', () => {
        // 19 of the 25 live samples write it this way. Nothing in this file
        // names the spellings — the product's own map resolves them, so a map
        // that gains a spelling needs no edit here.
        const soil = readerFor(WITH_OM_PERCENT).gaip_soilFromActiveSample();
        expect(soil.OM).toBe(4.2);
    });

    test('a sample nobody tested for it says nothing, rather than zero', () => {
        // The owner's rule: an absent reading stays absent. A zero here is a
        // number nobody measured entering a calculation that waits for this
        // reading — and the recovery engine does wait for it.
        const soil = readerFor(WITHOUT_OM).gaip_soilFromActiveSample();
        expect(soil.OM).toBeNull();
    });

    /**
     * GH-665 — THE SOURCE-TEXT CASE THAT STOOD HERE IS REMOVED, by the reviewer's
     * decision and for his reason: it reddened on the SAME mutation as the
     * executing case, so it added no distinction, and it added a false red from a
     * rename. Keeping it would have kept in the file the very thing this item was
     * opened against. Measured before removing: under
     * `(sample && sample.OM != null) ? sample.OM : form.LOI` the executing case
     * reddened on the behaviour (`Expected: true / Received: false`, the form's
     * 3.7 in the state) and this one on a spelling
     * (`Expected pattern: /LOI:\s*sample \? sample\.OM : null/`).
     *
     * ONE ASSERTION IN IT WAS NOT ABOUT THE SPELLING AND IS NOT LOST. It said the
     * old hub's `.gaip-loi` read is not reborn anywhere — an assertion about
     * ABSENCE, which no mutation of this file can test and which lived here for
     * nothing. It belongs to a census whose universe is the whole of `assets/*.js`,
     * beside the one for `pH_cacl2`: both are about a quantity substituted for
     * another coming back in a new place. The coordinator opened item 3at for it
     * before this case was deleted, so the claim has a home rather than a memory.
     */

    test('the stratified fields are UNTOUCHED, and this pins a decision that is open', () => {
        // Not an oversight. The owner has not decided whether those fields are
        // repaired or removed from the screen, and no live sample carries them
        // — so a repair now could be work thrown away. THIS CASE MUST GO RED
        // the day she decides, and that is the point of writing it down.
        const src = stateBuilderSource();

        ['0-2', '2-4', '4-6'].forEach((depth) => {
            expect(src).toContain('safeNum(e.querySelector(".gaip-loi-' + depth + '")?.value, 0)');
        });
    });
});

/**
 * GH-665 (queue item 3u, the analyst's form) — THE CENTRAL CLAIM OF THIS FILE,
 * EXECUTED. It was guarded by four regular expressions over the source text.
 *
 * WHY THAT WAS NOT ENOUGH, and the reviewer measured it rather than argued it:
 * under his mutation only the source-text case reddened, while the three
 * executing cases stayed green — because they drive `gaip_soilFromActiveSample`,
 * the READER, and the claim is about the ASSEMBLY. A case tied to the spelling of
 * a line reddens when somebody renames it and stays green when the behaviour
 * changes; both failures are removed by running the function.
 *
 * `gaip_soilStateFrom(sample, form)` has been a function of its own since GH-628
 * and is already executed in `gh626`, so there is nothing to build — only to ask.
 *
 * THREE CLAIMS, and the third is the one that exists in no form today:
 *   1. a sample with organic matter → `LOI` is that number;
 *   2. a sample without it → `null`, not zero;
 *   3. a sample without it WHILE THE FORM CARRIES A NUMBER → still `null`. The
 *      form is not a second source for a reading of the sample, and this is the
 *      claim the source-text cases could not make at all: the line they matched
 *      reads `sample ? sample.OM : null`, which says nothing about what happens
 *      when the form has a value and the sample does not.
 */
describe('GH-665 — organic matter, asked of the assembly instead of read off it', () => {
    /** The assembly, lifted out and run — the same slicing `gh577` uses. */
    function assemble(sample, form) {
        const sandbox = {
            console: { log() {}, warn() {}, error() {} },
            document: { querySelector: () => null, querySelectorAll: () => [] },
            Date, JSON, Math, Object, Array, String, Number, parseFloat, parseInt, isNaN,
        };
        sandbox.window = sandbox;
        sandbox.global = sandbox;
        sandbox.globalThis = sandbox;
        const ctx = vm.createContext(sandbox);
        const slice = (name) => {
            const at = SRC.indexOf('function ' + name + '(');
            expect(at).toBeGreaterThan(-1);
            let depth = 0;
            for (let j = SRC.indexOf('{', at); j < SRC.length; j++) {
                if (SRC[j] === '{') depth++;
                else if (SRC[j] === '}') { depth--; if (!depth) return SRC.slice(at, j + 1); }
            }
            throw new Error('unbalanced ' + name);
        };
        vm.runInContext(slice('safeNum'), ctx, { filename: 'safeNum' });
        vm.runInContext(slice('gaip_soilStateFrom'), ctx, { filename: 'gaip_soilStateFrom' });
        // POSITIVE CONTROL: a rename would otherwise leave every claim below being
        // made about an empty sandbox.
        expect(typeof ctx.gaip_soilStateFrom).toBe('function');

        return ctx.gaip_soilStateFrom(sample, form || {});
    }

    test('a sample that carries organic matter puts that number in the state', () => {
        const soil = assemble({ OM: 4.2, pH_water: 6.1 }, {});
        process.stdout.write('\n[gh665] sample OM 4.2, empty form -> LOI '
            + JSON.stringify(soil.LOI) + ', OM_pct ' + JSON.stringify(soil.OM_pct) + '\n');
        expect(soil.LOI).toBe(4.2);
        expect(soil.OM_pct).toBe(4.2);
    });

    test('a sample without it leaves the state absent, not zero', () => {
        const soil = assemble({ pH_water: 6.1 }, {});
        process.stdout.write('[gh665] sample without OM, empty form -> LOI '
            + JSON.stringify(soil.LOI) + '\n');
        // `undefined` and `null` are both absence here; zero is not, and zero is
        // what a number nobody measured would look like to a calculation.
        expect(soil.LOI == null).toBe(true);
        expect(soil.LOI).not.toBe(0);
    });

    test('THE CLAIM THAT EXISTED IN NO FORM: the form does not stand in for the sample', () => {
        // A page carrying a number for organic matter while the sample has none.
        // Before GH-615 this is exactly where the form's value entered the run.
        const soil = assemble({ pH_water: 6.1 }, { LOI: 3.7, OM_pct: 3.7, LOI_0_2: 5.5 });
        process.stdout.write('[gh665] sample without OM, FORM says 3.7 -> LOI '
            + JSON.stringify(soil.LOI) + ', OM_pct ' + JSON.stringify(soil.OM_pct)
            + ' | the stratified field from the form is kept: LOI_0_2 '
            + JSON.stringify(soil.LOI_0_2) + '\n');

        expect(soil.LOI == null).toBe(true);
        expect(soil.OM_pct == null).toBe(true);
        expect(soil.LOI).not.toBe(3.7);
        // And the boundary, in the same case so it cannot drift apart from it: the
        // STRATIFIED fields are the page's own and still come from it (GH-628).
        // Without this, a repair that ignored the whole form would look correct.
        expect(soil.LOI_0_2).toBe(5.5);
    });

    test('and a sample with a measured ZERO keeps the zero, which absence must not imitate', () => {
        // The other side of claim 2: a laboratory that measured no organic matter
        // reported a reading, and dropping it would be the collapse GH-620 closed
        // on sodium. Asked here because claim 2 alone is satisfied by code that
        // throws away every falsy value.
        const soil = assemble({ OM: 0, pH_water: 6.1 }, {});
        process.stdout.write('[gh665] sample OM measured as 0 -> LOI '
            + JSON.stringify(soil.LOI) + '\n');
        expect(soil.LOI).toBe(0);
    });
});

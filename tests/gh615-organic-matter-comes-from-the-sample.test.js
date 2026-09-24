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

    test('the run state takes it from the sample and no longer from the form', () => {
        // Asserted as what is NOT read: the old hub's field. Comments are
        // stripped first, because the block explains the very selector it
        // stopped using and a check that reads prose as code goes red on its
        // own reasoning.
        const src = stateBuilderSource();

        // GH-628 renamed the assembly's local from `_gaipSoilSample` to
        // `sample` when it moved into a function of its own. The claim is the
        // same one: both fields read the sample.
        expect(src).toMatch(/LOI:\s*sample \? sample\.OM : null/);
        expect(src).toMatch(/OM_pct:\s*sample \? sample\.OM : null/);
        // The two that mattered no longer touch `.gaip-loi` itself...
        expect(src).not.toMatch(/LOI:\s*safeNum\(e\.querySelector\("\.gaip-loi"\)/);
        expect(src).not.toMatch(/OM_pct:\s*safeNum\(e\.querySelector\("\.gaip-loi"\)/);
    });

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

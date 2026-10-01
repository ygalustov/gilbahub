/**
 * GH-757 (queue item 3ah) — WHAT SETTINGS WRITES IS WHAT THE RUN READS, MEASURED ON THE STATE THE
 * LIVE CALL BUILDS.
 *
 * THE FIRST VERSION OF THIS FILE MEASURED A SHAPE NOBODY BUILDS, and the reviewer of the item
 * caught it by executing the real path. It handed the scheduler a hand-written state with
 * `traffic.schedule.rootDepth` in it — and no caller ever builds that. The live path assembles the
 * state with `gaip_build_state` (`hub-tissue-v3.js`) and hands THAT to the scheduler, and there the
 * entered depth never arrived: the assembly read only the `/hub` markup's own field and put 100 in
 * its place. So the earlier claim, "the scheduler works with 75", was about a state of this file's
 * own making.
 *
 * SO THE STATE HERE IS ASSEMBLED BY THE PRODUCT. The named functions are lifted out of
 * `hub-tissue-v3.js` and run, the same shape `gh736` and `gh738` use, and what they return is what
 * the scheduler is given — nothing is written by hand between them.
 *
 * WHAT IS ASSERTED: a root depth saved by the Settings traffic form
 * (`config.traffic.schedule.rootDepth`) reaches the irrigation scheduler; and with nothing saved,
 * the run keeps the value it kept before — absence is not a new answer.
 *
 * WHAT THIS DOES NOT COVER, said rather than left: the 100 that stands in when nothing is saved is
 * still a substitution written into the assembly, and it is not this item's subject. It is named
 * here so the green is not read as "nothing is substituted anywhere".
 */

'use strict';

const fs = require('fs');
const path = require('path');
const vm = require('vm');
const { stubSampleManager } = require('./lib/sample-readings');

const ROOT = path.join(__dirname, '..');
const HUB = fs.readFileSync(path.join(ROOT, 'assets', 'hub-tissue-v3.js'), 'utf8');

/** The assembly the live call uses, by name, lifted from the file it lives in. */
const ASSEMBLY = ['safeNum', 'collectGridValues', 'convertDateToISO', 'calculateEndDate',
    'gaip_readSoilForm', 'gaip_soilFromActiveSample', 'gaip_soilStateFrom', 'gaip_namedSample',
    'gaip_sampleReadings', 'gaip_waterFromActiveSample', 'calculateC3C4Fractions',
    'enforceHemisphereTurfRules', 'gaip_lastPgrForThisRun', 'gaip_build_state'];

function declaredIn(src, name) {
    const at = src.indexOf('function ' + name + '(');
    expect(at).toBeGreaterThan(-1);
    let depth = 0;
    for (let j = src.indexOf('{', at); j < src.length; j++) {
        if (src[j] === '{') depth++;
        else if (src[j] === '}') { depth--; if (!depth) return src.slice(at, j + 1); }
    }
    throw new Error('unbalanced ' + name);
}

/**
 * The `/hub` markup the assembly is handed. `fields` is what the page's own inputs hold, by the
 * class the assembly looks them up with; anything not named is a field the page does not have.
 *
 * GH-757 (the acceptor's return, positions 1 and 2): the earlier version of this file always handed
 * over a markup with NOTHING in it. Measured by the acceptor: with every field empty, swapping the
 * order of the two reads left all three cases green, and so did dropping the page read altogether —
 * an empty field can neither lose to the config nor stand in for it. So the markup is an input here.
 */
function markup(fields) {
    const get = (sel) => (Object.prototype.hasOwnProperty.call(fields, sel) ? { value: fields[sel] } : null);

    return { querySelector: get, querySelectorAll: () => [] };
}

/** The run's state, built by the product out of a site's configuration and the page it runs on. */
function stateFor(gaipConfig, fields) {
    const box = {
        console: { log() {}, warn() {}, error() {} },
        document: { querySelector: () => null, querySelectorAll: () => [] },
        location: { search: '' }, URLSearchParams,
        Date, JSON, Math, Object, Array, String, Number, parseFloat, parseInt, isNaN,
    };
    box.window = box; box.global = box; box.globalThis = box;
    box.GAIP_SampleManager = stubSampleManager({});
    /**
     * GH-790 (queue item 9): the assembly asks for the config of the site the run is FOR, by id, rather than
     * for `GAIP_HUB_CONFIG.gaipConfig` -- which is written once when the page is rendered and describes the
     * site the page was drawn with. The fixture therefore names a site and hands over the store that answers
     * for it, and the reader is the product's own rather than a stub.
     */
    box.GAIP_HUB_CONFIG = { gaipConfig, activeSiteId: 'site-1' };
    box.GAIP_SiteConfig = { getConfig: (id) => (id === 'site-1' ? gaipConfig : null) };
    const ctx = vm.createContext(box);
    vm.runInContext(fs.readFileSync(path.join(__dirname, '../assets/nutrition-program-inputs.js'), 'utf8'),
        ctx, { filename: 'nutrition-program-inputs.js' });
    ASSEMBLY.forEach((name) => vm.runInContext(declaredIn(HUB, name), ctx, { filename: name }));

    return ctx.gaip_build_state(markup(fields || {}));
}

const FIELD = '.gaip-root-depth';

/**
 * Every place in the assembly that stands a number in when neither the config nor the page gives
 * one, with the line it stands on. Read off the file rather than written down here: a substitution
 * that moves must move this list, and the case below says what the number IS.
 */
function substitutionsInTheAssembly() {
    const out = [];
    const head = 'rootDepth: safeNum(';
    for (let at = HUB.indexOf(head); at > -1; at = HUB.indexOf(head, at + 1)) {
        let depth = 0;
        let end = -1;
        for (let j = at + head.length - 1; j < HUB.length; j++) {
            if (HUB[j] === '(') depth++;
            else if (HUB[j] === ')') { depth--; if (!depth) { end = j; break; } }
        }
        const call = HUB.slice(at, end + 1);
        const stands = /,\s*([0-9]+)\s*\)$/.exec(call);
        out.push({
            at: 'assets/hub-tissue-v3.js:' + HUB.slice(0, at).split('\n').length,
            readsThePage: call.indexOf(FIELD) > -1,
            standsIn: stands ? Number(stands[1]) : null,
        });
    }

    return out;
}


/** The root depth the scheduler works with, for a state the product assembled. */
function rootDepthSeenBy(state) {
    global.window = global.window || global;
    require(path.join(ROOT, 'assets', 'gaip-utils.js'));
    const scheduler = require(path.join(ROOT, 'assets', 'irrigation-scheduler.js'));
    const out = scheduler.schedule_pure(state, { daily: {}, hourly: {} }, {});
    const m = JSON.stringify(out).match(/"rootDepth":([0-9.]+)/);

    return m ? Number(m[1]) : null;
}

const TURF = { species: 'Perennial Ryegrass' };
const ENTERED = 250;

describe('GH-757 — a root depth saved in Settings reaches the run that reads it', () => {
    test('POSITIVE CONTROL: the assembly runs and the scheduler answers with a root depth', () => {
        const bare = stateFor({ turf: TURF, traffic: {} });
        const seen = rootDepthSeenBy(bare);
        process.stdout.write('\n[gh757] nothing saved — assembled traffic ' + JSON.stringify(bare.traffic)
            + ', irrigation.rootDepth '
            + JSON.stringify(bare.irrigation.rootDepth) + ' -> the scheduler works with ' + seen + '\n');

        /**
         * GH-790 (queue item 9): a site with no schedule carries NO TRAFFIC BLOCK -- GH-776's rule, which
         * now lives in the one transform both wear paths call. The depth travels in the irrigation block,
         * which is the one the scheduler reads, so that is what this control asserts.
         */
        expect(bare.traffic).toBeNull();
        expect(bare.irrigation).toBeTruthy();
        expect(seen).toBeGreaterThan(0);
        expect(seen).not.toBe(ENTERED);
    });

    test('a root depth saved by the Settings traffic form reaches the scheduler', () => {
        const state = stateFor({ turf: TURF, traffic: { schedule: { rootDepth: ENTERED } } });
        const seen = rootDepthSeenBy(state);
        process.stdout.write('[gh757] saved as config.traffic.schedule.rootDepth = ' + ENTERED
            + ' — assembled irrigation.rootDepth ' + JSON.stringify(state.irrigation.rootDepth)
            + ' -> the scheduler works with ' + seen
            + (seen === ENTERED ? '' : '   <- the entered value never arrives') + '\n');

        // GH-790: with a schedule present the traffic block exists and carries the same depth.
        expect(state.irrigation.rootDepth).toBe(ENTERED);
        expect(seen).toBe(ENTERED);
    });

    test('with nothing saved the run keeps what it kept before — absence is not a new answer', () => {
        const before = rootDepthSeenBy(stateFor({ turf: TURF, traffic: {} }));
        const empty = rootDepthSeenBy(stateFor({ turf: TURF, traffic: { schedule: {} } }));
        process.stdout.write('[gh757] empty schedule -> ' + empty + ' | nothing at all -> ' + before + '\n');

        expect(empty).toBe(before);
    });

    /**
     * GH-757 (the acceptor's return, position 1) — THE ORDER IS THE CLAIM, SO THE TWO SOURCES MUST
     * DISAGREE.
     *
     * The comment in the assembly says the site's config comes FIRST and the page's field stays
     * behind it. Nothing held that: with the field empty, either order produces the same number, and
     * the acceptor measured it — the file passed 3 of 3 with the reads swapped. A claim about order
     * can only be made where the two sources give different answers, so here they do.
     */
    test('the config wins over a page field that says something else', () => {
        const state = stateFor({ turf: TURF, traffic: { schedule: { rootDepth: ENTERED } } },
            { [FIELD]: '60' });
        const seen = rootDepthSeenBy(state);
        process.stdout.write('[gh757] config says ' + ENTERED + ', the page field says 60'
            + ' — assembled irrigation.rootDepth ' + JSON.stringify(state.irrigation.rootDepth)
            + ' -> the scheduler works with ' + seen
            + (seen === ENTERED ? '' : '   <- the page field is being read ahead of the config') + '\n');

        expect(state.irrigation.rootDepth).toBe(ENTERED);
        expect(seen).toBe(ENTERED);
    });

    /**
     * GH-757 (the acceptor's return, position 2), TURNED BY GH-790 (queue item 9) — THE PAGE FIELD IS NOT THE
     * FALLBACK ANY MORE, AND THAT IS THE SUBJECT.
     *
     * The claim here was that the read of `/hub`'s own field stays behind the config: with the config silent
     * the page's number is the only one there is. The reviewer of queue item 9 measured what that road does
     * -- `config?.…?.rootDepth ?? field` passes over a stored `null`, and two sites of the stand carry the key
     * with exactly that, so for them the value came off the markup, which is the copy queue item 9 removes
     * from every other input of the run.
     *
     * So the field is no longer read, and with the config silent the assembly stands its number in. The
     * substitution itself is untouched and is the subject of the case below; what this one holds is that the
     * page cannot supply the depth any more, whatever it holds.
     */
    test('with the config silent the page field is not read at all, whatever it says', () => {
        const state = stateFor({ turf: TURF, traffic: {} }, { [FIELD]: '180' });
        const seen = rootDepthSeenBy(state);
        const standIn = substitutionsInTheAssembly()[0].standsIn;
        process.stdout.write('[gh757] config silent, the page field says 180'
            + ' — assembled irrigation.rootDepth ' + JSON.stringify(state.irrigation.rootDepth)
            + ' -> the scheduler works with ' + seen + ', the assembly stands in ' + standIn + '\n');

        expect(seen).not.toBe(180);
        expect(seen).toBe(standIn);
        // And the site's own value still wins when it has one, which the case above holds.
    });

    /**
     * GH-757 (the acceptor's return, position 3) — THE 100 IS A SUBSTITUTION, AND THE GREEN MUST SAY
     * SO RATHER THAN READ AS "ABSENCE STAYED ABSENCE".
     *
     * The case above it proves only that 100 equals 100. Nothing in this file said where that 100
     * came from, and a reader takes an unexplained green for "nothing was filled in" — which is the
     * opposite of what happens. Neither the site nor the page gives a number, and a number comes out:
     * the assembly writes one in, at both of its two places, and irrigation runs on it with nothing
     * on any screen to say the depth was not the site's.
     *
     * This case does not remove it — a substitution this repository's rule would have as a missing
     * value is a product decision with its own item, and removing it here would be a scope this
     * return did not name. What the case refuses is the substitution moving, or one of the two places
     * drifting from the other, without anybody being told. Both places are read off the file, with
     * their lines, so the red carries the address.
     */
    test('with nothing entered anywhere the run works from a number the assembly STANDS IN', () => {
        const places = substitutionsInTheAssembly();
        const state = stateFor({ turf: TURF, traffic: {} }, {});
        const seen = rootDepthSeenBy(state);
        process.stdout.write('[gh757] nothing entered — the assembly stands a number in at: '
            + JSON.stringify(places) + '\n'
            + '[gh757]    and the run works from ' + seen
            + ': SUBSTITUTED, not absent — no site value and no page value produced it\n');

        /**
         * The address is carried BESIDE the claim and printed, never compared: this file moves, and
         * a line number in an expectation would redden on somebody else's edit. It enters the
         * compared value only for a place that disagrees, which is the shape `gh752` part B uses.
         */
        const standsIn = [...new Set(places.map((x) => x.standsIn))];
        // EVERY place, not the ones that differ from the first: with one of two moved, "the other
        // one" is as true of either, and a red that names the wrong address sends the reader there.
        /**
         * GH-790 (queue item 9): ONE PLACE NOW, AND IT DOES NOT READ THE PAGE.
         *
         * There were two, and both read the markup behind the config. One of the two was the traffic block's
         * own copy, which is gone with that block's fifteen page reads; the surviving one takes the depth from
         * the site by id and stands the number in when the site carries none. So `readsThePage` is FALSE for
         * it, by design rather than by drift -- the page read was the second road the reviewer measured, and it
         * is closed.
         *
         * What this case still refuses is the number moving, or a second place appearing with a different one.
         */
        const drift = (standsIn.length > 1 || places.length !== 1)
            ? places.map((x) => x.at + ' reads the page field: ' + x.readsThePage
                + ', stands in ' + x.standsIn)
            : [];
        expect({ places: places.length, standsIn, drift })
            .toEqual({ places: 1, standsIn: [100], drift: [] });
        expect(places[0].readsThePage).toBe(false);
        // And what the run works from is that written-in number, not something a source supplied.
        expect(state.irrigation.rootDepth).toBe(places[0].standsIn);
        expect(seen).toBe(places[0].standsIn);
    });
});

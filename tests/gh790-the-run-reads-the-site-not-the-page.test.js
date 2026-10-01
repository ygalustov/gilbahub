'use strict';

/**
 * GH-790 (queue item 9) — WHAT THE RUN COMPUTES WITH COMES FROM THE SITE, NOT FROM THE PAGE OR FROM A
 * BROWSER.
 *
 * WHY THESE CASES EXIST, and each one is a value that reached the calculation rather than a line of code.
 * The run's state was assembled from the fields of the `/hub` markup, and the markup was refilled on every
 * load from a snapshot in `localStorage` keyed by USER rather than by site -- so two writers raced for the
 * same field (the snapshot at 200ms, the server later) and the snapshot could be describing a different
 * site. A second store mirrored the traffic schedule and was read by three places, one of which carried it
 * back up to the server on the next save.
 *
 * THE FORM OF EVERY CASE BELOW is the one the reviewer set as the condition of acceptance: the config says
 * one thing, the page field says another, and what is asserted is WHICH VALUE ARRIVED. A case that reddens
 * when a call is removed but passes when the same value arrives by another road is not holding the place.
 *
 * WHAT A SILENT RUN WOULD MEAN, said in advance: the bench reports the scripts that failed to load, and the
 * positive control below asserts the assembly produced a turf block at all. Without it, "the config won"
 * would also be the answer of an assembly that never ran.
 */

const bench = require('./lib/orchestrator-bench');

const SITE = 'site-gh790';
const OTHER = 'site-somebody-else';

/** The site's config: every field this item moved, with values nothing else in the tree would produce. */
const CONFIG = {
    turf: {
        turfType: 'sports',
        species: 'Kikuyu',
        variety: 'Colosseum',
        coolOverseed: 'Perennial Ryegrass',
        overseedVariety: 'RPR',
        overseedStatus: 'established',
        summerIntent: 'maintain',
        poaPercent: 7,
        hoc: 18,
        drainage: 'pipe_drained',
        construction: 'sand_profile',
        led: { ppfd: 240, hours: 9 },
    },
    location: { lat: -41.29, lon: 174.78 },
    traffic: {
        schedule: {
            matchesPerWeek: 4, sessionsPerWeek: 3, restDays: 2,
            sport: 'afl', trainingType: 'skills', moisture: 'wet',
            matchDuration: 2, sessionDuration: 1.25, ageGroup: 'junior',
            squadSize: 'large', trainingAreaPct: 60,
            h1: 5, h2: 6, h3: null, h4: null,
            cleggMean: 72, cleggHard: 80, cleggSoft: 65,
        },
    },
};

/** The page, saying something else in every field the run used to read. */
const PAGE = {
    '.gaip-species': 'Creeping Bentgrass (Greens)',
    '.gaip-variety': 'PageCultivar',
    '.gaip-cool-overseed': 'PageOverseed',
    '.gaip-overseed-variety': 'PageOverseedVariety',
    '.gaip-overseed-summer-intent': 'transition',
    '.gaip-overseed-status': 'dominant',
    '.gaip-poa-percent': '55',
    '.gaip-hoc': '3',
    '.gaip-drainage': 'page_drainage',
    '.gaip-lat': '-33.87',
    '.gaip-lon': '151.21',
    '.gaip-led-ppfd': '999',
    '.gaip-led-hours': '23',
    '.gaip-soil-moisture': 'dry',
    '.gaip-manual-soil-moisture': '11',
    '.gaip-matches-week': '12',
    '.gaip-sessions-week': '11',
    '.gaip-rest-days': '6',
    '.gaip-match-sport': 'cricket',
    '.gaip-training-type': 'conditioning',
    '.gaip-match-duration': '9',
    '.gaip-session-duration': '8',
    '.gaip-age-group': 'senior',
    '.gaip-team-size': 'small',
    '.gaip-training-rotation': '10',
    '.gaip-root-depth': '333',
};

/** The assembly, run for real, with the config of one site and the fields of a page that disagrees. */
function stateFrom(config, fields, siteId) {
    const box = bench.load();
    if (box.failed.length) {
        throw new Error('the bench did not load, so nothing below is about the product: '
            + box.failed.join(' | '));
    }
    bench.withSiteConfig(box, siteId || SITE, config);
    const state = box.ctx.gaip_build_state(bench.pageWithFields(fields));

    return { state, box };
}

describe('GH-790 — the eleven fields of the race: the site wins, field by field', () => {
    /**
     * ONE CASE PER FIELD, and the expectation is the CONFIG's value -- so a read that comes back to the page
     * by any road reddens the row for that field rather than the suite as a whole.
     */
    const EXPECTED = [
        ['turf.species', (s) => s.turf.grassSpecies, 'Kikuyu', '.gaip-species'],
        ['turf.variety', (s) => s.turf.variety, 'Colosseum', '.gaip-variety'],
        ['turf.coolOverseed', (s) => s.turf.coolOverseed, 'Perennial Ryegrass', '.gaip-cool-overseed'],
        ['turf.overseedVariety', (s) => s.turf.overseedVariety, 'RPR', '.gaip-overseed-variety'],
        ['turf.summerIntent', (s) => s.turf.overseedSummerIntent, 'maintain', '.gaip-overseed-summer-intent'],
        ['turf.poaPercent', (s) => s.turf.poaPercent, 7, '.gaip-poa-percent'],
        ['turf.hoc', (s) => s.turf.hoc, 18, '.gaip-hoc'],
        ['turf.hoc (the second name)', (s) => s.turf.heightOfCut, 18, '.gaip-hoc'],
        ['turf.drainage', (s) => s.turf.drainage, 'pipe_drained', '.gaip-drainage'],
        ['turf.construction', (s) => s.turf.construction, 'sand_profile', null],
        ['location.lat', (s) => s.climate.lat, -41.29, '.gaip-lat'],
        ['location.lon', (s) => s.climate.lon, 174.78, '.gaip-lon'],
    ];

    let state;
    beforeAll(() => { state = stateFrom(CONFIG, PAGE).state; });

    test('POSITIVE CONTROL: the assembly ran and produced the blocks these cases read', () => {
        process.stdout.write('[gh790] turf keys: ' + Object.keys(state.turf || {}).length
            + ' | climate keys: ' + Object.keys(state.climate || {}).length + '\n');

        expect(state.turf).toBeTruthy();
        expect(state.climate).toBeTruthy();
        expect(Object.keys(state.turf).length).toBeGreaterThan(10);
    });

    test.each(EXPECTED)('%s: the run carries the site\'s value, not the page\'s', (name, read, want, selector) => {
        const got = read(state);
        process.stdout.write('[gh790] ' + name.padEnd(28) + ' config ' + JSON.stringify(want)
            + ' | page ' + JSON.stringify(selector ? PAGE[selector] : '(not a page field)')
            + ' | the run computed with ' + JSON.stringify(got) + '\n');

        expect(got).toEqual(want);
    });

    test('and the page is what it was: the run did not write its values back into the markup', () => {
        // The other direction of the same fact. If the assembly had "fixed" the page instead of reading the
        // site, every case above would pass while the defect stayed.
        expect(PAGE['.gaip-species']).toBe('Creeping Bentgrass (Greens)');
        expect(PAGE['.gaip-hoc']).toBe('3');
    });
});

describe('GH-790 — absent is absent: no literal, no nought, no stand-in', () => {
    const EMPTY = { turf: { turfType: 'sports' }, location: {}, traffic: {} };

    test('a site that entered nothing computes without it, and the page cannot supply it', () => {
        const { state } = stateFrom(EMPTY, PAGE);
        const seen = {
            species: state.turf.grassSpecies,
            variety: state.turf.variety,
            hoc: state.turf.hoc,
            poaPercent: state.turf.poaPercent,
            drainage: state.turf.drainage,
            lat: state.climate.lat,
            ledPPFD: state.turf.ledPPFD,
            ledHours: state.turf.ledHours,
        };
        process.stdout.write('[gh790] a site with nothing entered: ' + JSON.stringify(seen) + '\n');

        Object.keys(seen).forEach((k) => expect(seen[k]).toBeNull());
    });

    test('and with the site filled in, the same fields are NOT null — or the case above proves nothing', () => {
        const { state } = stateFrom(CONFIG, PAGE);
        expect(state.turf.grassSpecies).toBe('Kikuyu');
        expect(state.turf.hoc).toBe(18);
        expect(state.climate.lat).toBe(-41.29);
    });
});

describe('GH-790 — the LED figures, both halves of the claim', () => {
    test('from the site: the hours a person entered in Settings reach the run', () => {
        const { state } = stateFrom(CONFIG, PAGE);
        process.stdout.write('[gh790] LED — config ' + JSON.stringify(CONFIG.turf.led)
            + ' | page ' + PAGE['.gaip-led-ppfd'] + '/' + PAGE['.gaip-led-hours']
            + ' | the run computed with ' + state.turf.ledPPFD + '/' + state.turf.ledHours + '\n');

        expect([state.turf.ledPPFD, state.turf.ledHours]).toEqual([240, 9]);
    });

    /**
     * THE SECOND HALF, which the reviewer's mutation B is aimed at: the converter that hands this state to
     * the cascade must not turn the figures back into nought on the way. `|| 0` there would undo the repair
     * with the assembly untouched, and a case that only read the assembly would stay green.
     */
    test('through the converter: a venue with no lighting arrives with no lighting, not with nought', () => {
        const { state, box } = stateFrom({ turf: { turfType: 'sports' }, location: {}, traffic: {} }, PAGE);
        const converted = box.ctx.gaip_transformToCascadeFormat(state, null);
        const t = converted && converted.inputs && converted.inputs.turf;
        process.stdout.write('[gh790] the converter answered: '
            + JSON.stringify(t ? { ppfd: t.ledPPFD, hours: t.ledHours, hoc: t.hoc } : null) + '\n');

        expect(t).toBeTruthy();
        expect(t.ledPPFD).toBeNull();
        expect(t.ledHours).toBeNull();
        // The mowing height travels the same road and was defaulted to 25 one line above the LED pair.
        expect(t.hoc).toBeNull();
    });
});

describe('GH-790 — the traffic of the run, from the site\'s schedule', () => {
    test('a sports site with a schedule: every field is the schedule\'s, and the page says otherwise', () => {
        const { state } = stateFrom(CONFIG, PAGE);
        const t = state.traffic || {};
        process.stdout.write('[gh790] traffic computed with: ' + JSON.stringify(t) + '\n');

        expect(t.matchesPerWeek).toBe(4);
        expect(t.sessionsPerWeek).toBe(3);
        expect(t.restDays).toBe(2);
        expect(t.matchSport).toBe('afl');
        expect(t.matchCode).toBe('afl');
        expect(t.trainingType).toBe('skills');
        expect(t.soilMoisture).toBe('wet');
        expect(t.matchDuration).toBe(2);
        expect(t.sessionDuration).toBe(1.25);
        expect(t.ageGroup).toBe('junior');
        expect(t.teamSize).toBe('large');
        expect(t.trainingRotation).toBe(60);
        expect(t.priorWeeks).toEqual([5, 6]);
    });

    test('a sports site with no schedule carries no traffic, and a golf site with one carries none either', () => {
        const noSchedule = stateFrom({ turf: { turfType: 'sports' }, traffic: {} }, PAGE).state;
        const golf = stateFrom(Object.assign({}, CONFIG, {
            turf: Object.assign({}, CONFIG.turf, { turfType: 'golf' }),
        }), PAGE).state;
        process.stdout.write('[gh790] sports with no schedule -> ' + JSON.stringify(noSchedule.traffic)
            + ' | golf with a schedule -> ' + JSON.stringify(golf.traffic) + '\n');

        expect(noSchedule.traffic).toBeNull();
        expect(golf.traffic).toBeNull();
    });

    test('a schedule of nothing but nulls is not an answer, and nought matches is', () => {
        const nulls = stateFrom({ turf: { turfType: 'sports' },
            traffic: { schedule: { matchesPerWeek: null, sessionsPerWeek: null, sport: 'afl' } } }, PAGE).state;
        const nought = stateFrom({ turf: { turfType: 'sports' },
            traffic: { schedule: { matchesPerWeek: 0, sessionsPerWeek: 0 } } }, PAGE).state;
        process.stdout.write('[gh790] a schedule of nulls -> ' + JSON.stringify(nulls.traffic)
            + ' | nought and nought -> ' + JSON.stringify(nought.traffic && nought.traffic.matchesPerWeek) + '\n');

        expect(nulls.traffic).toBeNull();
        expect(nought.traffic).toBeTruthy();
        expect(nought.traffic.matchesPerWeek).toBe(0);
    });
});

/**
 * GH-790 (queue item 9) — A SNAPSHOT IN THE BROWSER CANNOT REACH THE RUN ANY MORE.
 *
 * This is the outcome of the snapshot's withdrawal, and it is the one the reviewer's mutation 3 is aimed at:
 * restoring `gilba_hub_state` over the page after load and watching whose value the run computes with. The
 * store is keyed by USER, so what it held could belong to another site altogether.
 *
 * THE CASE PUTS A SNAPSHOT THERE. If any road from that store to the calculation is left -- a restore, a
 * collector, a reader of its `savedAt` -- the figures below come out as the snapshot's.
 */
describe('GH-790 — a snapshot of the form does not reach the calculation', () => {
    const SNAPSHOT = {
        schemaVersion: 3,
        savedAt: '2026-09-30T12:00:00.000Z',
        turf: { grassSpecies: 'SnapshotSpecies', variety: 'SnapshotCultivar', hoc: 2, poaPercent: 88,
            ledPPFD: 777, ledHours: 22 },
        location: { lat: 10.5, lon: 20.5 },
    };

    test('with a snapshot in localStorage, the run still computes with the site', () => {
        const box = bench.load();
        if (box.failed.length) throw new Error('the bench did not load: ' + box.failed.join(' | '));
        const store = { gilba_hub_state: JSON.stringify(SNAPSHOT) };
        box.ctx.localStorage.getItem = (k) => (k in store ? store[k] : null);
        box.ctx.localStorage.setItem = (k, v) => { store[k] = String(v); };
        box.ctx.localStorage.removeItem = (k) => { delete store[k]; };
        bench.withSiteConfig(box, SITE, CONFIG);

        // The page is loaded and its persistence layer initialised, exactly as a load does it.
        // `restore()` is what a load reaches after its 200ms timer, and the bench's timers do not fire --
        // so it is called here by name rather than waited for. Calling it IS the load, for this purpose.
        if (box.ctx.GilbaPersistence && typeof box.ctx.GilbaPersistence.restore === 'function') {
            box.ctx.GilbaPersistence.restore();
        }
        const state = box.ctx.gaip_build_state(bench.pageWithFields(PAGE));
        process.stdout.write('[gh790] with a snapshot of another site in the browser, the run computed with: '
            + JSON.stringify({ species: state.turf.grassSpecies, hoc: state.turf.hoc,
                lat: state.climate.lat, ledPPFD: state.turf.ledPPFD }) + '\n');

        expect(state.turf.grassSpecies).toBe('Kikuyu');
        expect(state.turf.hoc).toBe(18);
        expect(state.climate.lat).toBe(-41.29);
        expect(state.turf.ledPPFD).toBe(240);
        // AND THE KEY ITSELF IS CLEARED, so the store does not sit in the browser with no reader.
        process.stdout.write('[gh790] the snapshot key after a load: ' + JSON.stringify(store.gilba_hub_state || null) + '\n');
        expect(store.gilba_hub_state).toBeUndefined();
    });

    test('and the page fields are not what the run used — the other direction', () => {
        // Without this, "the run computed with the site" could be true because the run computed with nothing.
        const { state } = stateFrom(CONFIG, PAGE);
        expect(state.turf.grassSpecies).not.toBe(PAGE['.gaip-species']);
        expect(String(state.turf.hoc)).not.toBe(PAGE['.gaip-hoc']);
    });
});

/**
 * GH-790 (queue item 9) — THE MIRROR OF THE TRAFFIC SCHEDULE DOES NOT DECIDE ANY MORE.
 *
 * `gilba_traffic_state_<site>` was written by the Settings traffic form on every save, BEFORE the server saw
 * the schedule, and read back in three places. One of those reads reached the calculation: the Clegg
 * readings of the `/hub` markup were filled from it when the site's own config had none, so the firmness a
 * run computed with could come from one device's memory. And the form's next "Save" carried what it had read
 * back up to the server, which is a browser writing itself into the site's configuration.
 *
 * THE CASE IS ABOUT WHICH READING ARRIVED, which is the reviewer's mutation 2: a mirror holding one figure, a
 * config holding another.
 */
describe('GH-790 — the traffic mirror reaches neither the form nor the run', () => {
    const withMirror = (config, mirror) => {
        const box = bench.load();
        if (box.failed.length) throw new Error('the bench did not load: ' + box.failed.join(' | '));
        const store = {};
        if (mirror) store['gilba_traffic_state_' + SITE] = JSON.stringify(mirror);
        box.ctx.localStorage.getItem = (k) => (k in store ? store[k] : null);
        box.ctx.localStorage.setItem = (k, v) => { store[k] = String(v); };
        box.ctx.localStorage.removeItem = (k) => { delete store[k]; };
        bench.withSiteConfig(box, SITE, config);
        // The page's fields, as the config restorer would leave them for the Clegg block.
        const fields = {};
        box.ctx.document.querySelector = (sel) => (sel in fields ? { value: fields[sel], dataset: {} } : null);
        box.ctx.GAIP_SiteConfig.restore();

        return { box, fields, store };
    };

    test('a mirror with Clegg readings does not put them into the run', () => {
        /**
         * GH-790: the mirror's figures share no value with the config fixture above. One value must not carry
         * two roles inside one set -- `80` stood here as `cleggMean` and there as `cleggHard`, so a mutation
         * that swapped the source to the mirror and landed on the matching key would have passed green. The
         * discriminator rests on the paths being single, which is measured; this removes the one coincidence
         * that could have hidden inside it.
         */
        const mirror = { cleggMean: 41, cleggHard: 43, cleggSoft: 45, matchesPerWeek: 9 };
        const { box, store } = withMirror({ turf: { turfType: 'sports' }, traffic: {} }, mirror);
        const state = box.ctx.gaip_build_state(bench.pageWithFields({}));
        process.stdout.write('[gh790] a mirror holding ' + JSON.stringify(mirror)
            + ' -> the run computed firmness ' + JSON.stringify({
                hammer: state.turf.cleggHammer, max: state.turf.cleggMax, min: state.turf.cleggMin })
            + ' | traffic ' + JSON.stringify(state.traffic) + '\n');

        // Nothing of the mirror arrived: no firmness and no load.
        //
        // GH-790, second delivery: the firmness is `null` now rather than nought. The mirror's readings never
        // reached the run either way -- what changed is that a site which measured nothing no longer carries a
        // nought that reads as a measurement.
        expect(state.traffic).toBeNull();
        expect(state.turf.cleggHammer).toBeNull();
        // And the mirror is still only in the browser -- the run did not write it anywhere.
        expect(Object.keys(store)).toEqual(['gilba_traffic_state_' + SITE]);
    });

    test('and the site\'s own schedule DOES arrive — or the case above proves only that nothing works', () => {
        const { box } = withMirror(CONFIG, { matchesPerWeek: 9, cleggMean: 41 });
        const state = box.ctx.gaip_build_state(bench.pageWithFields({}));
        process.stdout.write('[gh790] with the site\'s own schedule, the run computed '
            + JSON.stringify({ matches: state.traffic && state.traffic.matchesPerWeek }) + '\n');

        expect(state.traffic.matchesPerWeek).toBe(4);
    });
});

/**
 * GH-790 (queue item 9, SECOND DELIVERY) — THE FIRMNESS READINGS AND THE MANUAL SOIL MOISTURE.
 *
 * Four reads of the `/hub` markup were left when the first delivery closed: the three Clegg readings of the
 * `turf` block and the soil moisture of the manual weather block. The first three have a declared server
 * place -- `turf.cleggHammer`, `storedAs: traffic.schedule.cleggMean|cleggHard|cleggSoft` -- and it was
 * losing to the page. Measured before the change: the site holding 72/80/65 and the page holding 11/12/13,
 * the run computed with 11/12/13.
 *
 * THE THIRD CLAIM IS THE ONE THE WORK IS FOR: a site that measured nothing arrives with `null`, not nought.
 * Replacing the page's substitution with one of our own would change nothing, and 91 of the 132 stored rows
 * already carry that nought where no reading was taken.
 */
describe('GH-790, second delivery — the firmness readings come from the site', () => {
    const SITE_READINGS = {
        turf: { turfType: 'sports', species: 'Kikuyu' },
        traffic: { schedule: { matchesPerWeek: 4, cleggMean: 72, cleggHard: 80, cleggSoft: 65 } },
    };
    const PAGE_READINGS = {
        '.gaip-clegg-hammer': '11', '.gaip-clegg-max': '12', '.gaip-clegg-min': '13',
        '.gaip-manual-soil-moisture': '99',
    };

    test.each([
        ['cleggHammer', 'traffic.schedule.cleggMean', (t) => t.cleggHammer, 72, '.gaip-clegg-hammer', '11'],
        ['cleggMax', 'traffic.schedule.cleggHard', (t) => t.cleggMax, 80, '.gaip-clegg-max', '12'],
        ['cleggMin', 'traffic.schedule.cleggSoft', (t) => t.cleggMin, 65, '.gaip-clegg-min', '13'],
    ])('%s: the run computes with the site\'s reading, not the page\'s', (name, path, read, want, sel, pageSays) => {
        const { state } = stateFrom(SITE_READINGS, PAGE_READINGS);
        const got = read(state.turf);
        process.stdout.write('[gh790b] ' + name.padEnd(12) + ' site ' + path + ' = ' + want
            + ' | page ' + sel + ' = ' + pageSays
            + ' | the run computed with ' + JSON.stringify(got) + '\n');

        expect(got).toEqual(want);
    });

    /**
     * THE CLAIM THIS DELIVERY EXISTS FOR. A site that measured nothing gets `null` -- if it got nought, the
     * page's substitution would have been swapped for one of ours and the row would go on asserting a
     * measurement nobody made.
     */
    test('a site that measured nothing gets null, and not nought, in all three', () => {
        const { state } = stateFrom({ turf: { turfType: 'sports' }, traffic: { schedule: { matchesPerWeek: 0 } } },
            PAGE_READINGS);
        const seen = { cleggHammer: state.turf.cleggHammer, cleggMax: state.turf.cleggMax, cleggMin: state.turf.cleggMin };
        process.stdout.write('[gh790b] nothing measured, the page says 11/12/13 -> ' + JSON.stringify(seen) + '\n');

        expect(seen).toEqual({ cleggHammer: null, cleggMax: null, cleggMin: null });
    });

    /** AND THROUGH THE CONVERTER, which is the road to the engine that reads them. */
    test('the converter carries the absence as absence, and the readings as the readings', () => {
        const bare = stateFrom({ turf: { turfType: 'sports' }, traffic: {} }, PAGE_READINGS);
        const full = stateFrom(SITE_READINGS, PAGE_READINGS);
        const b = bare.box.ctx.gaip_transformToCascadeFormat(bare.state, null).inputs.turf;
        const f = full.box.ctx.gaip_transformToCascadeFormat(full.state, null).inputs.turf;
        process.stdout.write('[gh790b] the converter, nothing measured -> '
            + JSON.stringify({ hammer: b.cleggHammer, max: b.cleggMax, min: b.cleggMin })
            + ' | with readings -> ' + JSON.stringify({ hammer: f.cleggHammer, max: f.cleggMax, min: f.cleggMin }) + '\n');

        expect([b.cleggHammer, b.cleggMax, b.cleggMin]).toEqual([null, null, null]);
        expect([f.cleggHammer, f.cleggMax, f.cleggMin]).toEqual([72, 80, 65]);
    });

    /**
     * THE MANUAL SOIL MOISTURE, whose repair has no server side: nothing declares it and the
     * `weatherOverride` section the Site tab writes does not carry it. So the page is not read and the value
     * is none.
     */
    test('the manual soil moisture is not taken off the page, whatever the field says', () => {
        const withPage = stateFrom(SITE_READINGS, PAGE_READINGS).state;
        const withoutPage = stateFrom(SITE_READINGS, {}).state;
        const seen = {
            pageSays99: withPage.climate.manual.moisture.soilMoisture,
            pageEmpty: withoutPage.climate.manual.moisture.soilMoisture,
        };
        process.stdout.write('[gh790b] the manual block: ' + JSON.stringify(seen) + '\n');

        expect(seen).toEqual({ pageSays99: null, pageEmpty: null });
        // The neighbours of that field still work, or this would pass on a block that stopped being built.
        expect(withPage.climate.manual).toBeTruthy();
        expect('dewpoint' in withPage.climate.manual.moisture).toBe(true);
    });
});

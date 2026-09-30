'use strict';

/**
 * GH-783 (queue item 3vshch) — GROWTH & LIGHT READS THE ROW, AND THE SHADE ENGINE SUBSTITUTES NOTHING.
 *
 * THREE PLACES, and they are the ones that do not wait for the owner's open forks:
 *   - the page's two fallbacks onto window globals (`GAIP_SHADE_RESULT` and `climateMetrics`);
 *   - the engine's substituted region and hemisphere, and the `|| 40` peak DLI that rested on them.
 *
 * WHY THE PAGE'S FALLBACKS ARE DEAD AND STILL WRONG, measured: this page loads five scripts —
 * `settings-unavailable-banner`, `samples-unavailable-banner`, `dashboard-ui`, `gp-status` and the page itself —
 * and not one writes either global. Their writers live in the `/hub` calculation frame. So the fallback could
 * only ever return what an earlier page left behind, which is the defect of GH-459, and the owner's rule of
 * 22.09.2026 removes the read whether or not anything answers it today.
 *
 * WHAT IS NOT IN THIS FILE, said so that its green is not read as more than it is: the season translator, the
 * latitude, the geometry and the page reading the engine's own names all wait for the owner's forks 7, 8 and 11.
 * The window of recovery is still the wrong hemisphere's for one site of thirteen, and the seasonal note still
 * reaches none — by measurement, and by design until she answers.
 */

const fs = require('fs');
const path = require('path');
const vm = require('vm');

const { load } = require('./lib/orchestrator-bench');

const ASSETS = path.join(__dirname, '..', 'assets');

/**
 * SOURCE WITHOUT ITS COMMENTS, lines preserved.
 *
 * Twice in this file a case counted a comment that QUOTES a removed thing as the thing itself - which would force
 * the history out of the code to keep a guard green, the opposite of what a guard is for. Line breaks are kept so
 * that an address printed beside a finding points where it says.
 */
function codeOf(file) {
    return fs.readFileSync(path.join(ASSETS, file), 'utf8')
        .replace(/\/\*[\s\S]*?\*\//g, (m) => m.replace(/[^\n]/g, ' '))
        .replace(/(^|[^:])\/\/[^\n]*/g, '$1 ');
}

/** The shade engine as a page has it. */
function engine() {
    const sandbox = { console: { log() {}, warn() {} }, Math, JSON, Object, Array, String, Number, Date,
        parseFloat, parseInt, isNaN, isFinite };
    sandbox.window = sandbox;
    sandbox.global = sandbox;
    sandbox.globalThis = sandbox;
    vm.createContext(sandbox);
    vm.runInContext(fs.readFileSync(path.join(ASSETS, 'shade-engine-pure.js'), 'utf8'), sandbox,
        { filename: 'shade-engine-pure.js' });
    expect(typeof sandbox.GAIP_Shade.engine).toBe('function');

    return sandbox;
}

/** A state the engine can compute on, minus whatever a case takes away. */
function stateFor(overrides) {
    return Object.assign({
        turf: { dli: 22, species: 'perennialRyegrass', percentC3Cover: 100, trafficLevel: 'moderate' },
        shade: { dli: 22, skyView: 1, aspect: 'N', obstructionAngle: 0, facade: 0 },
        site: { region: 'cool-temperate', hemisphere: 'south' },
        location: { lat: -36.85 },
        traffic: { level: 'moderate' },
        monthIndex: 8,
    }, overrides || {});
}

describe('GH-783 — the shade engine substitutes no region and no hemisphere', () => {
    test('with both given it computes, which is the control the two cases below need', () => {
        const s = engine();
        const out = s.GAIP_Shade.engine(stateFor(), null);
        process.stdout.write('\n[gh783] region and hemisphere given -> status ' + JSON.stringify(out.status)
            + ', hemisphere ' + JSON.stringify(out.hemisphere) + '\n');

        expect(out.status).not.toBe('Not available');
        expect(out.hemisphere).toBe('south');
    });

    test('no hemisphere anywhere: nothing is computed, and it is not answered as southern', () => {
        /**
         * `// Default Australian` is what the literal said. Removing it alone would have been worse than keeping
         * it: every reader asks `=== 'south'`, for which `null` reads as NORTH, so a site with no latitude would
         * have been computed as a northern one. The engine says it did not compute instead.
         */
        const s = engine();
        const out = s.GAIP_Shade.engine(stateFor({ site: { region: 'cool-temperate' }, location: {} }), null);
        process.stdout.write('[gh783] no hemisphere -> ' + JSON.stringify({ status: out.status,
            reason: out.reason, hemisphere: out.hemisphere }) + '\n');

        expect(out.status).toBe('Not available');
        expect(out.reason).toBe('no-hemisphere');
        expect(out.hemisphere).toBeNull();
        // And nothing was computed FROM the absence: no window, no trajectory.
        expect(out.recoveryWindow).toBeUndefined();
        expect(out.seasonalTrajectory).toBeUndefined();
    });

    test('no region: the same, because the region decides the open-field peak the rest rests on', () => {
        const s = engine();
        const out = s.GAIP_Shade.engine(stateFor({ site: { hemisphere: 'south' }, location: { lat: -36.85 } }),
            null);
        process.stdout.write('[gh783] no region -> ' + JSON.stringify({ status: out.status,
            reason: out.reason, region: out.region }) + '\n');

        expect(out.status).toBe('Not available');
        expect(out.reason).toBe('no-region');
    });

    test('ALL THREE ENTRANCES of the region are closed, not one', () => {
        /**
         * GH-783, the reviewer's return - ONE INPUT, THREE DOORS, AND THE FIRST FIX CLOSED ONE.
         *
         * The direct-DLI branch stopped substituting a peak of 40; the sky-view branch kept doing it through a
         * `'default': 40` key inside the table, and `getSoilTemp` had two more - an unknown region computed as
         * warm-temperate and a month with no figure worth 18 degrees. He measured all three green. Closing one
         * door of an input is the shape this repository closed for the grass species in GH-782.
         *
         * A region the tables do not know is REACHABLE: it arrives from the site's config as a free string and is
         * checked against no list of keys, so a typo is enough.
         */
        const s = engine();
        const unknownRegion = stateFor({ site: { region: 'temprate-cool', hemisphere: 'south' } });
        // The sky-view branch: no `turf.dli`, so the engine computes the open field from the hourly curve.
        unknownRegion.turf = { species: 'perennialRyegrass', percentC3Cover: 100, trafficLevel: 'moderate' };
        unknownRegion.shade = { skyView: 0.6, aspect: 'N', obstructionAngle: 0, facade: 0,
            morningSky: 0.6, middaySky: 0.6, afternoonSky: 0.6 };
        const out = s.GAIP_Shade.engine(unknownRegion, null);
        process.stdout.write('\n[gh783] a region the tables do not know -> '
            + JSON.stringify({ status: out.status, reason: out.reason, region: out.region }) + '\n');

        // Nothing is computed from a peak nobody has, and the reason names which door refused.
        expect(out.status).toBe('Not available');
        expect(['no-peak-dli-for-region', 'no-region']).toContain(out.reason);

        // And the table no longer carries a figure for a region nobody named - asked of the CODE, not of the
        // comments that record what was removed.
        const code = codeOf('shade-engine-pure.js');
        expect(code).not.toMatch(/'default':\s*40/);
        expect(code).not.toMatch(/SOIL_TEMP_PROFILES\['warm-temperate'\]/);
        expect(code).not.toMatch(/profile\[monthIdx\]\s*\|\|\s*18/);
    });

    test('a soil temperature nobody can give is not a cold one', () => {
        /**
         * `getSoilTemp` answers `null` for a region its profiles do not know, and every comparison in the species
         * decision would read that as freezing - `null < 14` is true - so the advice would be the cold-month
         * advice. The same trap as the hemisphere, one function along, and it is answered as absence.
         */
        const s = engine();
        const code = codeOf('shade-engine-pure.js');
        expect(code).toMatch(/if \(_T === null \|\| _T === undefined\)/);
        // And the profile lookup itself has no substitute region.
        expect(code).toMatch(/var profile = \(region && SOIL_TEMP_PROFILES\[region\]\) \|\| null;/);
        process.stdout.write('[gh783] the species decision refuses a month it has no temperature for\n');
        expect(typeof s.GAIP_Shade.engine).toBe('function');
    });

    test('a region name the table does not know is not silently worth 40 either', () => {
        /**
         * `REGION_PEAK_DLI[region] || 40` covered two different absences: a region nobody gave, and a region this
         * table has no peak for. The second one is the quieter of the two, because the site DID name a region.
         */
        const code = codeOf('shade-engine-pure.js');
        expect(code).not.toMatch(/REGION_PEAK_DLI\[region\]\s*\|\|\s*40/);
        expect(code).toMatch(/REGION_PEAK_DLI\[region\] !== undefined/);
        process.stdout.write('[gh783] the peak DLI is the region\'s own or nothing\n');
    });
});

describe('GH-783 — the page reads the row, not a global the page happens to hold', () => {
    const PAGE_SRC = fs.readFileSync(path.join(ASSETS, 'growth-light-analysis.js'), 'utf8');
    /**
     * COMMENTS ARE NOT READS. The first form of this case searched the whole file and counted a comment that
     * QUOTES the removed name - "this said `window.climateMetrics`" - as a reading of it. A guard that cannot
     * tell documentation from code would force the history out of the file to stay green, which is the opposite
     * of what it is for. Comments are stripped first, as `gh649`'s gate does.
     */
    const PAGE = PAGE_SRC.replace(/\/\*[\s\S]*?\*\//g, ' ').replace(/(^|[^:])\/\/[^\n]*/g, '$1 ');

    test('neither window global is read any more, by name', () => {
        /**
         * The LIST, by name: a return of either is printed by its own spelling rather than turning a 0 into a 1.
         * `GAIP_DASHBOARD_DATA` and `GAIP_HUB_CONFIG` stay, and are not copies — the server renders both into the
         * page (`analysis/growth-light.blade.php`), which is the row and the site's own settings.
         */
        const gone = ['global.climateMetrics', 'global.GAIP_SHADE_RESULT', 'window.climateMetrics']
            .filter((name) => PAGE.indexOf(name) >= 0);
        process.stdout.write('[gh783] page globals still read: ' + JSON.stringify(gone) + '\n');
        expect(gone).toEqual([]);

        // POSITIVE CONTROL: the page still reads what the server gave it, or this case would pass on an empty
        // file - and on a file whose every line the comment-stripper had eaten.
        expect(PAGE).toContain('global.GAIP_DASHBOARD_DATA');
        expect(PAGE.length).toBeGreaterThan(PAGE_SRC.length / 3);
    });

    test('THE BOUNDARY, named rather than left to be read wider than it is', () => {
        /**
         * GH-783, the reviewer's correction of 30.09.2026 - THREE COPIES WERE NAMED IN THIS AREA, AND THIS FIX
         * REMOVES TWO OF THEM.
         *
         * `window.climateMetrics` and `window.GAIP_SHADE_RESULT` were read by this page and are gone from its
         * code. `window.GAIP_SOIL_TEMP` is the third and was already gone before this item: GH-734 removed that
         * read when the panel's global stopped existing. So the honest number is two of three, and the third is
         * somebody else's closed work.
         *
         * AND `GAIP_SHADE_RESULT` IS STILL READ ELSEWHERE - five places this item does not touch, because its
         * subject is Growth & Light. They are listed by name so that "the browser copy was removed" cannot be
         * read as more than was done, and so that a sixth reader appearing is visible here.
         */
        /**
         * THE WHOLE OF `assets` IS WALKED, not a list written here - the reviewer's finding, and he was right
         * twice over: a sixth reading inside a listed file passed, and a reader in a NEW file passed too, because
         * the first form filtered five hand-written names while the comment beside it promised a census. A list
         * that cannot grow is the amnesty he caught himself on with his own count of files.
         *
         * Every reading is named by file AND line, so a new one is printed rather than turning a 5 into a 6, and
         * the writer and the state map are told apart from the readers by what they do with the name.
         */
        /**
         * COMMENTS GO, LINES STAY. The first form replaced a block comment with a single space, which collapsed
         * the lines it spanned and printed addresses that pointed at the wrong place - measured: it named
         * `disease-forecast.js:749` where the reading is at `:920`. An address that is wrong is worse than none,
         * because it is followed.
         */
        const stripped = (src) => src
            .replace(/\/\*[\s\S]*?\*\//g, (m) => m.replace(/[^\n]/g, ' '))
            .replace(/(^|[^:])\/\/[^\n]*/g, '$1 ');
        const files = fs.readdirSync(ASSETS).filter((f) => f.endsWith('.js'));
        const readings = [];
        const writings = [];
        const clearings = [];
        files.forEach((f) => {
            const code = stripped(fs.readFileSync(path.join(ASSETS, f), 'utf8'));
            code.split('\n').forEach((line, i) => {
                if (line.indexOf('GAIP_SHADE_RESULT') < 0) return;
                const at = f + ':' + (i + 1);
                /**
                 * Three roles, not two: a WRITE puts a value there; a CLEARING names it in the list of globals a
                 * site switch empties (`site-switch-cleanup.js`), which is neither using the copy nor filling it;
                 * anything else READS it. The third was hidden by a hand-written filter in the first form.
                 */
                if (/(?:global|window|self|globalThis)\.GAIP_SHADE_RESULT\s*=/.test(line)) writings.push(at);
                else if (/\[\s*['"]GAIP_SHADE_RESULT['"]\s*,/.test(line)) clearings.push(at);
                else readings.push(at);
            });
        });
        const outside = readings.filter((r) => r.indexOf('growth-light-analysis.js:') !== 0);
        process.stdout.write('[gh783] files walked: ' + files.length
            + '\n[gh783] copies this page no longer reads: climateMetrics, GAIP_SHADE_RESULT'
            + ' (GAIP_SOIL_TEMP was already gone with GH-734)'
            + '\n[gh783] readings of GAIP_SHADE_RESULT outside this page (' + outside.length + '): '
            + JSON.stringify(outside)
            + '\n[gh783] and who writes it: ' + JSON.stringify(writings)
            + '\n[gh783] and who only clears it on a site switch: ' + JSON.stringify(clearings) + '\n');

        // THE LIST, by file and line: the boundary of this item, and a sixth reading is printed by its own address.
        expect(outside).toEqual([
            'card-layout-redesign.js:688',
            'disease-forecast.js:920',
            'disease-integration.js:481',
            'disease-integration.js:482',
            'gilba-hub-v2.js:811',
            'gilba-hub-v2.js:1476',
            'stress-trajectory-integration.js:169',
        ]);
        expect(clearings).toEqual(['site-switch-cleanup.js:64']);
        // This page reads it nowhere, which is what the item did.
        expect(readings.filter((r) => r.indexOf('growth-light-analysis.js:') === 0)).toEqual([]);
        // POSITIVE CONTROL: the walk reached the files and found the writer, or an empty walk would agree.
        expect(files.length).toBeGreaterThan(50);
        expect(writings).toEqual(['cascade-orchestrator.js:322']);
    });

    /**
     * THE PAGE'S OWN NOTE, as text. `renderLightBlock` builds the HTML that carries it, so the case can read what
     * a person would read rather than what the source says it would - which is the reviewer's condition: the
     * boundaries of the owner's decisions had no case reaching the screen, and a green that stops at the source
     * cannot tell a decision kept from a decision forgotten.
     */
    function noteOnTheScreen(shade) {
        const src = fs.readFileSync(path.join(ASSETS, 'growth-light-analysis.js'), 'utf8');
        const marker = 'global.GAIP_GrowthLightAnalysis = {';
        expect(src).toContain(marker);
        const withExport = src.replace(marker,
            'global.__test_renderLightBlock = renderLightBlock;\n    ' + marker);
        const sandbox = { console: { log() {}, warn() {}, error() {} }, Math, JSON, Object, Array, String, Number,
            Date, parseFloat, parseInt, isNaN, isFinite,
            document: { readyState: 'complete', addEventListener() {}, getElementById: () => null,
                querySelector: () => null, querySelectorAll: () => [] } };
        sandbox.window = sandbox;
        sandbox.global = sandbox;
        sandbox.globalThis = sandbox;
        vm.createContext(sandbox);
        vm.runInContext(withExport, sandbox, { filename: 'growth-light-analysis.js' });
        expect(typeof sandbox.__test_renderLightBlock).toBe('function');

        const html = sandbox.__test_renderLightBlock({ growth: { weighted: 60 } }, shade);
        // Each part up to the separator the page joins them with, or to the end of the element.
        const line = /Stress months:[^<\u00b7]*/.exec(html);
        const window_ = /Best renovation window:[^<\u00b7]*/.exec(html);

        return { html: html, stress: line ? line[0].trim() : null, window: window_ ? window_[0].trim() : null };
    }

    test('THE NOTE NOW PRINTS, and it prints the row\'s own months', () => {
        /**
         * The subject of this queue item: the note reached 0 of 13 sites because the page asked for names the
         * engine does not answer with. It asks the engine's own now, and the owner has legitimised every figure
         * behind them - the latitude, the hemisphere and the obstruction angle - so there is nothing to hide.
         */
        const s = engine();
        const shade = s.GAIP_Shade.engine(stateFor(), null);
        const onScreen = noteOnTheScreen(shade);
        process.stdout.write('\n[gh783] the engine answers stressPeriods '
            + JSON.stringify(shade.seasonalTrajectory.stressPeriods) + ' and optimalRenovation '
            + JSON.stringify(shade.seasonalTrajectory.optimalRenovation)
            + '\n[gh783] the page prints: ' + JSON.stringify([onScreen.stress, onScreen.window]) + '\n');

        // WHAT A PERSON READS, and it is the row's own months rather than a figure the page worked out.
        expect(onScreen.stress).toBe('Stress months: ' + shade.seasonalTrajectory.stressPeriods.join(', '));
        expect(onScreen.window).toBe('Best renovation window: '
            + shade.seasonalTrajectory.optimalRenovation.join(', '));
        /**
         * And the relative range is not printed, by the owner's word. Only THAT line: `mol/m²/day` still appears
         * in this block for the DLI itself, which is an absolute figure and correctly labelled - a blanket
         * assertion about the unit would have called that wrong too, and did, until it was measured.
         */
        expect(onScreen.html).not.toContain('Annual DLI range');
        const parts = (onScreen.html.match(/(Stress months|Best renovation window|Annual DLI range):/g) || []);
        expect(parts).toEqual(['Stress months:', 'Best renovation window:']);
    });

    test('THE LATITUDE OF -35 REACHES THE SCREEN THROUGH THE PLACE THAT SUBSTITUTES IT', () => {
        /**
         * The reviewer's third finding, and he was right: the boundary was claimed to be held by a case, and it
         * was not. He removed the `-35` and he flipped its sign, and every case stayed green - because the cases
         * built their own state and never went through `hub-tissue-v3.js`, where the substitution lives.
         *
         * So this one runs the PRODUCT's own caller on a state with no latitude at all, and reads what the page
         * would print from what that caller produced. Remove the substitution and the hemisphere becomes northern
         * (`null < 0` is false), flip it to `+35` and it becomes northern too - and either way the months on the
         * screen change, which is what a case for this decision has to notice.
         */
        const bench = load();
        expect(bench.failed).toEqual([]);
        const ctx = bench.ctx;
        // A run whose state carries NO latitude: the substitution is the only thing that gives it one.
        ctx.GAIP_STATE = { climate: {}, turf: {}, site: {} };
        const hubRoot = { querySelector: () => null, querySelectorAll: () => [] };
        const shade = ctx.gaip_shade_engine({
            climate: {},
            turf: { dli: 22, warmBase: 'kikuyu', percentC3Cover: 0, trafficLevel: 'moderate', nRate: 25 },
            shade: {}, soil: {}, water: {}, tissue: {},
        }, { current: { airTemp: 18 } });
        const trajectory = shade && shade.seasonalTrajectory;
        const onScreen = trajectory ? noteOnTheScreen(shade) : { window: null };

        process.stdout.write('\n[gh783] with no latitude in the state, the caller\'s substitution gives'
            + ' hemisphere ' + JSON.stringify(shade && shade.hemisphere)
            + '\n[gh783] and the page prints: ' + JSON.stringify(onScreen.window) + '\n');

        /**
         * The caller's own answer does not carry a `hemisphere` field - measured, and the stored rows say the same
         * - so the hemisphere is read where it is visible: in the months. The substituted latitude is negative, so
         * the trajectory is the southern one and a person reads the southern window. Remove the `-35` and the
         * hemisphere becomes northern (`null < 0` is false); flip it to `+35` and it becomes northern too; either
         * way this line reddens, which is what the decision needed and did not have.
         */
        expect(trajectory).toBeTruthy();
        expect(trajectory.optimalRenovation).toEqual(['Sep', 'Oct', 'Nov']);
        expect(onScreen.window).toBe('Best renovation window: Sep, Oct, Nov');
    });

    test('THE OWNER\'S DECISIONS REACH THE SCREEN, so keeping them is visible and losing them would be too', () => {
        /**
         * The reviewer's first finding: he removed the -35 and flipped it north, and every case stayed green,
         * because the substitution fed a trajectory that reached no screen. It reaches one now, so the two
         * decisions she took on 30.09.2026 - the latitude and the hemisphere - are held by what a person reads.
         *
         * The case does not assert WHICH months a southern site gets; it asserts that the hemisphere decides them
         * and that today's answer is the southern one. A day when the owner asks for the northern behaviour, this
         * is the case that has to change, and it will change with the meaning rather than by accident.
         */
        const s = engine();
        const southern = s.GAIP_Shade.engine(stateFor(), null);
        const northern = s.GAIP_Shade.engine(stateFor({
            site: { region: 'cool-temperate', hemisphere: 'north' }, location: { lat: 52.24 },
        }), null);
        const onSouth = noteOnTheScreen(southern);
        const onNorth = noteOnTheScreen(northern);
        process.stdout.write('[gh783] a southern site reads: ' + JSON.stringify(onSouth.window)
            + '\n[gh783] a northern one would read: ' + JSON.stringify(onNorth.window) + '\n');

        // The hemisphere decides what a person reads - which is why the decision to keep the southern seasons is
        // a decision and not a detail.
        expect(onSouth.window).not.toBe(onNorth.window);
        // And today every site is computed as southern, because the latitude of -35 is substituted for all of
        // them by the owner's word: the southern months are what reaches the screen.
        expect(onSouth.window).toBe('Best renovation window: Sep, Oct, Nov');
        expect(onNorth.window).toBe('Best renovation window: Mar, Apr, May');
    });

    test('and what the sections are given comes from that row', () => {
        // The two readers that carried the fallbacks now answer from the row alone.
        expect(PAGE).toMatch(/return \(data && data\.computed && data\.computed\.shade\) \|\| null;/);
        expect(PAGE).toMatch(/return buildClimateView\(data\) \|\| null;/);
        process.stdout.write('[gh783] the shade and the climate view come from the row\n');
    });
});

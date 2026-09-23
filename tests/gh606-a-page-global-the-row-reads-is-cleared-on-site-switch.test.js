/**
 * GH-606 — A CENSUS OF THE PAGE GLOBALS THE STORED ROW IS BUILT FROM, AND
 * WHICH OF THEM SURVIVE A SITE SWITCH.
 *
 * WHAT THIS IS AND WHAT IT IS NOT. This is not a claim that the twelve names
 * below are harmless. It is a count taken from the code, fixed here so that a
 * thirteenth cannot appear without somebody deciding about it. The decision
 * about the five that hold a site's own figures is the owner's and is open.
 *
 * WHY IT WAS TAKEN. `cacheAnalysisResults()` in `assets/hub-persistence.js` is
 * the one function whose output becomes the stored `analysis_results` row, and
 * it is 1117 lines long. Everything it reads off the page belongs to whatever
 * was open a moment ago. That is GH-459 exactly: one site's numbers stored
 * under another site's name, annual totals still matching, every check green.
 *
 * WHAT WAS MEASURED. Twenty page globals are read. Eight are nulled on
 * `gaip:site-changed`, by TWO separate mechanisms — the `SITE_SCOPED_GLOBALS`
 * table in `assets/site-switch-cleanup.js`, and `assets/gaip-clear-data.js`,
 * whose handler on the same event calls `clearWaterData()` and `clearSoilData()`.
 * A census reading only the first reports `__GAIP_WATER_STATE__` as uncleared
 * and is wrong. Both are read, and the second through its handler: that file
 * nulls FIVE globals, but two of them sit in `clearTissueData()`, which the
 * handler does not call, so collecting all five would be wrong the other way —
 * a global named as cleared when a site switch leaves it standing. Three are
 * reachable from the event, and only those count.
 *
 * AND WHY THE UNCLEARED TWELVE ARE NOT A LIVE DEFECT TODAY. The document that
 * does the reading is built per press: `assets/dashboard-ui.js:147` creates the
 * iframe, points it at `/hub?rerun=...&site=<id>` once, and removes it when the
 * run ends. Every global starts `undefined`, and no human can switch the site
 * inside a frame that is one pixel wide with `pointer-events:none`. The safety
 * is therefore a property of the CALLER, not of the reader — reuse one frame
 * across presses and it is gone with nothing to notice. That property is
 * asserted at the bottom of this file for the same reason the census exists.
 *
 * BOTH SIDES ARE TAKEN FROM THE SOURCE THAT DECLARES THEM — the reads from the
 * body of `cacheAnalysisResults` itself, the cleared names from the two tables.
 * Nothing is transcribed, so a read added to the writer, or a name dropped from
 * a table, moves the comparison on its own.
 */

'use strict';

const fs = require('fs');
const path = require('path');

const asset = (f) => path.join(__dirname, '..', 'assets', f);

/**
 * The twelve read-but-not-cleared names, each with WHAT IT HOLDS — because a
 * bare list of names cannot be judged, and judging them is the open question.
 *
 * `perSite: true` means it carries figures belonging to one site, so surviving
 * a switch would put them in another site's row. Those five are the open
 * finding. The rest are singletons that answer questions rather than hold
 * answers, and clearing them would break the run.
 */
const READ_BUT_NOT_CLEARED = {
    GaipOrchestrator:           { perSite: false, is: 'the engine module; asked for state, does not keep it across sites' },
    GAIP_SampleManager:         { perSite: false, is: 'the sample module; every read is by site id' },
    GAIP_SiteContext:           { perSite: false, is: 'the pointer to the site being run, which is the question, not an answer' },
    GaipZoneKey:                { perSite: false, is: 'zone-key.js, a pure naming helper' },
    GilbaMulders:               { perSite: false, is: 'mulders-interaction-checker.js, a calculator' },
    mlsnEngine:                 { perSite: false, is: 'the MLSN engine module, a calculator that keeps no per-site store' },
    GAIP_SiteConfig:            { perSite: false, is: 'site-config-persistence.js, a service that fetches by site id' },

    GAIP_STATE:                 { perSite: true,  is: 'the run state; the cleanup clears its turf identity keys only' },
    GAIP_INPUT_VALIDATION:      { perSite: true,  is: 'input-range-validator.js output for this site’s readings' },
    GAIP_IrrigationResults:     { perSite: true,  is: 'irrigation figures under a SECOND name; GAIP_IRRIGATION_RESULT is cleared, this one is not' },
    __GAIP_MONTHLY_N__:         { perSite: true,  is: 'the monthly nitrogen split, which GH-459 showed differs per site' },
    __GAIP_WATER_DIAGNOSTICS__: { perSite: true,  is: 'water diagnostics; its neighbour __GAIP_WATER_STATE__ IS cleared, this one is not' },
};

/**
 * Comments removed before anything is read as code.
 *
 * Both directions were measured and both are wrong. A line of prose naming
 * `global.X` in the writer made the census count it as a read and go red on an
 * explanation; and `['GAIP_SOIL_TEMP', null],` COMMENTED OUT in the cleanup
 * table left the census green at 5 of 5 while the product no longer cleared the
 * global at all. The second is the dangerous one: red on prose is seen at once,
 * green on a switched-off cleanup never is. Switching a line off is normally
 * done by commenting it, not by deleting it, and that file already has
 * end-of-line comments beside live entries.
 *
 * The in-tree pattern is `tests/gh578-…:160`, which drops block comments and
 * whole-line `//`. Taken further here by one step, because a name can also sit
 * in a trailing comment: the tail after `//` is dropped too, but only on a line
 * that carries no quote, so a string such as `'/hub?rerun='` is left intact.
 * That the step cost nothing is asserted, not assumed — the counts below are
 * what they were before it.
 *
 * AND THE PRICE OF THAT BOUNDARY, because naming a boundary without its size
 * is half a statement. "Only on a line with no quote" sounds like a rare
 * exception and is not: in the cleanup table EVERY line carries quotes, since
 * an entry is written `['GAIP_X', null],`, so for that file the tail is never
 * stripped at all — and `['GAIP_PLACEHOLDER_X', null], // ['GAIP_SOIL_TEMP',
 * null], disabled` left this census green at 6 of 6 with the product no longer
 * clearing that global. The line above `:61` is already written in exactly that
 * shape, so a person switching an entry off and saying why produces it by
 * hand. Both tables are therefore read LINE-ANCHORED as well, which closes the
 * head and the tail together and makes the quote rule irrelevant to them. It
 * still applies to the writer, where reads sit mid-line and no anchor fits, and
 * its price there is measured too: of the 1117 lines in `cacheAnalysisResults`,
 * 219 carry a quote, so on one line in five a trailing comment survives. That
 * remainder fails as red-on-prose, which is seen at once, rather than as green
 * on something switched off, which is not.
 */
function stripComments(src) {
    return src
        .replace(/\/\*[\s\S]*?\*\//g, '')
        .split('\n')
        .filter((l) => !/^\s*\/\//.test(l))
        .map((l) => (/['"`]/.test(l) ? l : l.replace(/\/\/.*$/, '')))
        .join('\n');
}

/** The body of `cacheAnalysisResults`, brace-matched from its declaration. */
function cacheWriterBody(src) {
    const start = src.indexOf('function cacheAnalysisResults(');
    if (start < 0) throw new Error('cacheAnalysisResults() is not in hub-persistence.js under that name');
    const open = src.indexOf('{', start);
    let depth = 0;
    for (let i = open; i < src.length; i++) {
        if (src[i] === '{') depth++;
        else if (src[i] === '}' && --depth === 0) return src.slice(open, i + 1);
    }
    throw new Error('cacheAnalysisResults() never closes');
}

/** Globals the writer reads, as `global.NAME`. */
function globalsReadBy(body) {
    return [...new Set([...body.matchAll(/\bglobal\.([A-Za-z_$][\w$]*)/g)].map((m) => m[1]))].sort();
}

/**
 * Every name nulled when the site changes, from BOTH declared mechanisms — and
 * the second one read THROUGH ITS HANDLER rather than by matching on shape.
 *
 * `gaip-clear-data.js` nulls five globals, and a census that simply collected
 * all five would be wrong in the other direction: the handler registered on
 * `gaip:site-changed` calls `clearWaterData` and `clearSoilData` only, so the
 * two nulled inside `clearTissueData` are NOT cleared by this file on a switch.
 * (`GAIP_TISSUE_RESULT` is cleared, by the other mechanism's table.) So the
 * handler is read for which functions it calls, and only those bodies are
 * collected: add a call there and the census follows without being edited, and
 * a claim that a tissue global survives a switch cannot be invented here.
 */
function clearedOnSiteSwitch() {
    const names = new Set();

    const table = stripComments(fs.readFileSync(asset('site-switch-cleanup.js'), 'utf8'));
    const start = table.indexOf('const SITE_SCOPED_GLOBALS = [');
    if (start < 0) throw new Error('SITE_SCOPED_GLOBALS is not in site-switch-cleanup.js under that name');
    // ANCHORED TO THE START OF THE LINE, and that is the whole point — see the
    // note on `stripComments`. An entry counts only if its line BEGINS with
    // `[` after indentation, so a disabled entry parked in a trailing comment
    // is not read as a live one.
    table.slice(start, table.indexOf('];', start)).split('\n').forEach((line) => {
        const m = /^\s*\[\s*'([^']+)'\s*,/.exec(line);
        if (m) names.add(m[1]);
    });

    const clearData = stripComments(fs.readFileSync(asset('gaip-clear-data.js'), 'utf8'));
    const at = clearData.indexOf("addEventListener('gaip:site-changed'");
    if (at < 0) throw new Error('gaip-clear-data.js no longer listens for gaip:site-changed');
    const handler = clearData.slice(at, clearData.indexOf('\n    });', at));

    const called = [...new Set([...handler.matchAll(/\b(clear[A-Z]\w*)\s*\(/g)].map((m) => m[1]))];
    if (!called.length) throw new Error('the gaip:site-changed handler calls no clear function');

    called.forEach((fn) => {
        const decl = clearData.indexOf('function ' + fn + '(');
        if (decl < 0) throw new Error(fn + ' is called on site-changed but not declared in that file');
        const open = clearData.indexOf('{', decl);
        let depth = 0, body = '';
        for (let i = open; i < clearData.length; i++) {
            if (clearData[i] === '{') depth++;
            else if (clearData[i] === '}' && --depth === 0) { body = clearData.slice(open, i + 1); break; }
        }
        // Same anchor, for the same reason. Not the named subject — that was the
        // cleanup table — but the identical hole in the identical file, and a
        // trailing `// window.GAIP_X = null;` here would read as live too.
        body.split('\n').forEach((line) => {
            const m = /^\s*window\.([A-Za-z_$][\w$]*)\s*=\s*null/.exec(line);
            if (m) names.add(m[1]);
        });
    });

    return names;
}

describe('GH-606 — what the stored row reads off the page, and what a site switch clears', () => {
    const read = globalsReadBy(stripComments(cacheWriterBody(fs.readFileSync(asset('hub-persistence.js'), 'utf8'))));
    const cleared = clearedOnSiteSwitch();
    const surviving = read.filter((n) => !cleared.has(n));

    test('both sources were parsed, so an empty comparison cannot pass as agreement', () => {
        process.stdout.write('[gh606] the row is built from ' + read.length + ' page global(s)\n');
        process.stdout.write('[gh606] cleared on a site switch: '
            + read.filter((n) => cleared.has(n)).join(', ') + '\n');
        process.stdout.write('[gh606] surviving a site switch:  ' + surviving.join(', ') + '\n');

        expect(read.length).toBeGreaterThan(15);
        expect(cleared.size).toBeGreaterThan(10);
        // And the second mechanism really contributed, or this file is back to
        // reading one table and calling it the whole answer.
        expect(cleared.has('__GAIP_WATER_STATE__')).toBe(true);
    });

    test('the second mechanism is read through its handler, so it is neither half-read nor over-read', () => {
        // HALF-READ was the first defect: the expression wanted a leading
        // underscore and saw two of the five nullings.
        ['GAIP_SOIL_INTERPRETATION', 'GAIP_WATER_INTERPRETATION', '__GAIP_WATER_STATE__']
            .forEach((name) => expect([...cleared]).toContain(name));

        // OVER-READ would be the next one. `__GAIP_TISSUE_LAST__` is nulled in
        // that same file, inside `clearTissueData()`, which the site-changed
        // handler does not call — and unlike its neighbour `GAIP_TISSUE_RESULT`
        // it is in no table either, so it is the one name that tells the two
        // mistakes apart. Claiming it cleared would be a census saying a global
        // is safe when a switch leaves it standing.
        expect([...cleared]).not.toContain('__GAIP_TISSUE_LAST__');
    });

    test('the census is exact: no global survives a switch without being named here, and none is named that does not', () => {
        // Failing in EITHER direction is the point. A new read added to the
        // 1117-line writer without a cleanup entry appears on the left; a name
        // that gets cleaned up and left in this list appears on the right, which
        // is the prompt to delete it from here.
        expect(surviving.sort()).toEqual(Object.keys(READ_BUT_NOT_CLEARED).sort());
    });

    test('and five of them carry one site’s own figures — the open half, counted, not approved', () => {
        const perSite = surviving.filter((n) => READ_BUT_NOT_CLEARED[n].perSite);

        process.stdout.write('[gh606] of those, holding a site’s own figures: ' + perSite.join(', ') + '\n');
        expect(perSite).toHaveLength(5);
    });

    test('every name in the census says what it holds, so the list cannot grow by a bare name', () => {
        Object.entries(READ_BUT_NOT_CLEARED).forEach(([name, entry]) => {
            expect(typeof entry.perSite).toBe('boolean');
            expect(typeof entry.is).toBe('string');
            expect(entry.is.length).toBeGreaterThan(25);
            expect(cleared.has(name)).toBe(false);
        });
    });

    test('the runner document is built per press, which is what makes the twelve safe today', () => {
        const ui = fs.readFileSync(asset('dashboard-ui.js'), 'utf8');

        expect(ui).toContain("var iframe = document.createElement('iframe');");
        expect(ui).toMatch(/iframe\.src\s*=\s*'\/hub\?rerun='/);
        expect(ui).toMatch(/document\.body\.removeChild\(iframe\)/);
        expect(ui).toContain('pointer-events:none');
    });
});

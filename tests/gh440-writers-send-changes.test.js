/**
 * GH-440 (GH-439 stage 1) — the new hub's writers send what changed.
 *
 * Every defect in GH-439 had the same shape: a page sent its own copy of a
 * site's configuration, and the copy became the truth. The server stopped
 * accepting whole configs blindly in stage 0; this stage is the other side of
 * it — Settings, the Plan page, both setup wizards and the companion selector
 * send the section they just changed and take the site's config back from the
 * answer.
 *
 * These are read against the shipped sources rather than by driving the pages:
 * settings-init.js and the wizards run as one top-level IIFE bound to a whole
 * page of DOM, which is why the neighbouring GH-371/GH-394 suites read them
 * the same way. The behaviour they describe is verified live in
 * tests/e2e/gh439-config-reset-live.test.js (scenario B) and by PHPUnit on the
 * route itself.
 */

'use strict';

const fs = require('fs');
const path = require('path');
const { anchoredSlice, anchoredWindow, anchorIndex } = require('./lib/anchored-slice');

function read(name) {
    return fs.readFileSync(path.join(__dirname, '../assets/' + name), 'utf8');
}

/**
 * Every request to config/gaip in a file, as (line of the URL, method found
 * near it). The URL and the method are routinely written on different lines --
 * `fetch(url, { method: ... })` spans several -- so a line-by-line search for
 * both at once silently matches almost nothing, which is how the first cut of
 * this suite ended up watching two files out of six.
 */
function configRequests(src) {
    const lines = src.split('\n');
    const found = [];
    lines.forEach(function (line, i) {
        if (!/config\/gaip/.test(line)) return;
        // Comments name the endpoint all over these files; a request is code.
        if (/^\s*(\*|\/\/|\/\*)/.test(line)) return;
        const window = lines.slice(Math.max(0, i - 6), i + 12).join('\n');
        const method = (window.match(/method:\s*'([A-Z]+)'/) || [])[1]
            || (window.match(/apiFetch\('([A-Z]+)'/) || [])[1]
            || (window.match(/_api\('([A-Z]+)'/) || [])[1]
            || null;
        found.push({ line: i + 1, method: method, text: line.trim().slice(0, 80) });
    });
    return found;
}

describe('GH-440 — no writer in the new hub sends a whole config', () => {
    // The files that build a config/gaip request themselves.
    const REQUEST_FILES = [
        'settings-init.js',
        'nutrition-calendar.js',
        'onboarding-wizard.js',
        'site-setup-wizard.js',
    ];

    // The files that write through GAIP_SiteConfig instead of requesting
    // anything themselves; for them "sends no whole config" means they still
    // go through those writers and touch no copy of their own.
    const INDIRECT_FILES = ['gilba-alerts.js', 'daily-dashboard.js'];

    test.each(REQUEST_FILES)('%s reaches config/gaip with PATCH and never PUT', (file) => {
        const requests = configRequests(read(file));
        // A file in this list must actually make such a request — otherwise
        // the case passes by describing nothing, which is the failure this
        // helper exists to prevent.
        expect(requests.length).toBeGreaterThan(0);
        requests.forEach(function (request) {
            expect({ file, line: request.line, method: request.method })
                .toEqual({ file, line: request.line, method: 'PATCH' });
        });
    });

    test.each(INDIRECT_FILES)('%s writes only through GAIP_SiteConfig', (file) => {
        const src = read(file);
        expect(configRequests(src)).toEqual([]);
        expect(src).toMatch(/GAIP_SiteConfig\.(mergeConfig|setCompanionSpecies|setMultiSiteTurfEnabled)\(/);
        expect(src).not.toMatch(/setItem\('gilba_hub_site_configs'/);
    });

    test('the regional integrations persist through the calendar, not by hand', () => {
        ['nutrition-nz-fertiliser-integration.js', 'nutrition-au-fertiliser-integration.js',
            'nutrition-uk-fertiliser-integration.js', 'nutrition-prebble-integration.js'].forEach(function (file) {
            const src = read(file);
            expect(configRequests(src)).toEqual([]);
            expect(src).toMatch(/_nc\.persistSiteConfigPatch\(_programPatch\)/);
        });
    });

    test('site-config-persistence.js has no PUT left at all', () => {
        // GH-441 (GH-439 stage 2): pushConfigsToServer() is deleted, and with
        // it the last whole-config write in the product's own pages.
        const src = read('site-config-persistence.js');
        expect(configRequests(src).filter(function (r) { return r.method === 'PUT'; })).toEqual([]);
        expect(src).not.toMatch(/function pushConfigsToServer\(/);
    });

    test('site-config-persistence.js writes through PATCH only', () => {
        const src = read('site-config-persistence.js');
        // GH-467: the end anchor was 'function pushConfigsToServer(', which
        // GH-441 deleted — the test above asserts it is gone. indexOf returned
        // -1 and the slice ran from here to the end of the file, so these four
        // assertions have been reading the whole tail rather than this helper.
        // anchoredSlice threw on it, which is what it is for.
        const helper = anchoredSlice(src, 'function patchConfigOnServer(');
        expect(helper).toMatch(/method: 'PATCH'/);
        expect(helper).toMatch(/JSON\.stringify\(body\)/);
        // What goes up is the caller's patch; what comes back replaces the copy.
        expect(helper).toMatch(/_configs\[siteId\] = saved;/);
        expect(helper).not.toMatch(/body: JSON\.stringify\(\{ config:/);
    });

    test('the three exported writers each send their own field, not the copy', () => {
        const src = read('site-config-persistence.js');
        expect(src).toMatch(/patchConfigOnServer\(siteId, split\.patch, split\.clear\)/);
        expect(src).toMatch(/patchConfigOnServer\(siteId, \{ turf: \{ companionSpecies: value \} \}, null\)/);
        expect(src).toMatch(/patchConfigOnServer\(siteId, \{ multiSiteTurf: !!enabled \}, null\)/);
        // GH-467: pushConfigsToServer() is gone entirely (GH-441), so what is
        // asserted here is that none of the three reach anything of that name.
        // The slice used to start at an unchecked indexOf: had the exports
        // block been renamed it would have read the whole file and passed.
        const exportsBlock = anchoredSlice(src, 'global.GAIP_SiteConfig = {');
        expect(exportsBlock).not.toMatch(/pushConfigsToServer\(\)/);
    });

    test('a null field becomes a named clear, never a null in the patch', () => {
        const src = read('site-config-persistence.js');
        const fn = anchoredSlice(src, 'function splitPatchAndClear(patch)');
        expect(fn).toMatch(/clear\.push\(key\)/);
        expect(fn).toMatch(/clear\.push\(key \+ '\.' \+ field\)/);
        // Only the sections the server merges field by field are taken apart;
        // a programme object keeps its own nulls.
        expect(fn).toMatch(/PATCHABLE_SECTIONS\.indexOf\(key\) !== -1/);
    });
});

describe('GH-440 — the local copy is refreshed from the answer', () => {
    test('nutrition-calendar.js takes GAIP_SITE_CONFIG from the response, not from what it sent', () => {
        const src = read('nutrition-calendar.js');
        const fnIdx = src.indexOf('NutritionCalendar.persistSiteConfigPatch = function (patch)');
        const start = fnIdx > -1 ? fnIdx : src.indexOf('NutritionCalendar.persistSiteConfigPatch = function(patch)');
        expect(start).toBeGreaterThan(-1);
        const fn = src.slice(start, src.indexOf('NutritionCalendar.getProgram', start));
        expect(fn).toMatch(/method: 'PATCH'/);
        expect(fn).toMatch(/body: JSON\.stringify\(\{ patch: patch \}\)/);
        expect(fn).toMatch(/window\.GAIP_SITE_CONFIG = config;/);
        // The pre-send merge into the page's own copy is gone: that is what
        // put a stale tab's settings back on every Generate.
        expect(fn).not.toMatch(/window\.GAIP_SITE_CONFIG = Object\.assign/);
    });

    test('settings-init.js takes D.gaipConfig from the response', () => {
        const src = read('settings-init.js');
        const fn = anchoredSlice(src, 'function patchGaipConfig(sections)');
        expect(fn).toMatch(/apiFetch\('PATCH', '\/sites\/' \+ encodeURIComponent\(siteId\) \+ '\/config\/gaip', body\)/);
        expect(fn).toMatch(/D\.gaipConfig = saved;/);
    });

    test('Plan re-reads the site config before Generate', () => {
        const src = read('nutrition-calendar.js');
        expect(src).toMatch(/NutritionCalendar\.refreshSiteConfig = async function/);
        const bindIdx = src.indexOf('NutritionCalendar.bindEvents = function()');
        const bind = src.slice(bindIdx, src.indexOf('DATA EXTRACTION FROM HUB STATE', bindIdx));
        expect(bind).toMatch(/await this\.refreshSiteConfig\(\);[\s\S]*await this\.generate\(\);/);
    });
});

describe('GH-440 (review) — a product programme states where it was computed', () => {
    test('coordsFromCalendar reads the calendar it is given, and refuses to invent one', () => {
        jest.resetModules();
        global.window = { GAIP_HUB_CONFIG: {} };
        global.document = {
            getElementById: function () { return null; },
            querySelector: function () { return null; },
            querySelectorAll: function () { return []; },
            addEventListener: function () {},
            dispatchEvent: function () {},
            readyState: 'complete',
        };
        global.console = { log: function () {}, warn: function () {}, error: function () {}, info: function () {} };
        global.localStorage = { getItem: function () { return null; }, setItem: function () {} };
        require('../assets/nutrition-calendar.js');
        const NC = global.window.GilbaNutritionCalendar;

        expect(NC.coordsFromCalendar({ meta: { lat: -36.85, lon: 174.76 } })).toEqual({ lat: -36.85, lon: 174.76 });
        expect(NC.coordsFromCalendar({ meta: {} })).toBeNull();
        expect(NC.coordsFromCalendar(null)).toBeNull();
    });

    test('each regional integration stamps the programme with its calendar, not with a stored value', () => {
        ['nutrition-nz-fertiliser-integration.js', 'nutrition-au-fertiliser-integration.js',
            'nutrition-uk-fertiliser-integration.js', 'nutrition-prebble-integration.js'].forEach(function (file) {
            const src = read(file);
            // The stamp comes from the calendar object in hand — the one the
            // programme was built from. Reading it out of a config copy would
            // be the very habit this work removes, and would let a stale
            // tab's programme claim the site's current coordinates.
            expect(src).toMatch(/_nc\.coordsFromCalendar\(calendarData\)/);
            expect(src).toMatch(/if \(_programCoords\) _programPatch\.nutritionProgramCoords = _programCoords;/);
            expect(src).not.toMatch(/nutritionProgramCoords\s*[:=]\s*(window\.)?GAIP_SITE_CONFIG/);
        });
    });
});

describe('GH-440 (review) — a failed re-read stops Generate instead of computing on stale settings', () => {
    function loadCalendar(fetchImpl) {
        jest.resetModules();
        global.window = {
            GAIP_HUB_CONFIG: { activeSiteId: 'site-1', restUrl: 'https://example.test/api/' },
            GAIP_SITE_CONFIG: { turf: { species: 'Stale', methodology: 'slan' } },
        };
        global.document = {
            getElementById: function () { return null; },
            querySelector: function () { return null; },
            querySelectorAll: function () { return []; },
            addEventListener: function () {},
            dispatchEvent: function () {},
            readyState: 'complete',
        };
        global.console = { log: function () {}, warn: function () {}, error: function () {}, info: function () {} };
        global.localStorage = { getItem: function () { return null; }, setItem: function () {} };
        global.fetch = fetchImpl;
        require('../assets/nutrition-calendar.js');
        return global.window.GilbaNutritionCalendar;
    }

    test('an HTTP failure reports "failed" and leaves the page config untouched', async () => {
        const NC = loadCalendar(jest.fn(() => Promise.resolve({ ok: false, status: 500 })));
        const state = await NC.refreshSiteConfig();
        expect(state).toBe('failed');
        expect(global.window.GAIP_SITE_CONFIG.turf.methodology).toBe('slan');
    });

    test('a thrown request reports "failed"', async () => {
        const NC = loadCalendar(jest.fn(() => Promise.reject(new Error('offline'))));
        await expect(NC.refreshSiteConfig()).resolves.toBe('failed');
    });

    test('a good response reports "refreshed" and replaces the page config', async () => {
        const NC = loadCalendar(jest.fn(() => Promise.resolve({
            ok: true,
            json: () => Promise.resolve({
                data: { configs: { gaip: { config: { turf: { species: 'Current', methodology: 'ammonium_acetate' } } } } },
            }),
        })));
        const state = await NC.refreshSiteConfig();
        expect(state).toBe('refreshed');
        expect(global.window.GAIP_SITE_CONFIG.turf.methodology).toBe('ammonium_acetate');
    });

    test('a page with nothing to re-read reports "skipped", which must not block Generate', async () => {
        const NC = loadCalendar(jest.fn());
        global.window.GAIP_HUB_CONFIG = {};
        await expect(NC.refreshSiteConfig()).resolves.toBe('skipped');
        expect(global.fetch).not.toHaveBeenCalled();
    });

    test('the button refuses to generate on "failed" and says why, and generates on "skipped"', () => {
        const src = read('nutrition-calendar.js');
        const bindIdx = src.indexOf('NutritionCalendar.bindEvents = function()');
        const bind = src.slice(bindIdx, src.indexOf('DATA EXTRACTION FROM HUB STATE', bindIdx));
        expect(bind).toMatch(/const state = await this\.refreshSiteConfig\(\);/);
        expect(bind).toMatch(/if \(state === 'failed'\) \{[\s\S]*?alert\([\s\S]*?return;[\s\S]*?\}/);
        // The refusal sits before generate(), so a failed read cannot fall
        // through into a computation on settings this page could not confirm.
        expect(bind.indexOf("state === 'failed'")).toBeLessThan(bind.indexOf('await this.generate()'));
    });
});

describe('GH-440 — the wizards state what they collected', () => {
    test('site-setup-wizard.js builds a patch instead of merging the page copy', () => {
        const src = read('site-setup-wizard.js');
        expect(src).toMatch(/buildWizardPatch: function\(wizardState\)/);
        expect(src).not.toMatch(/buildMergedSiteConfig/);
        // The old builder read GAIP_SiteConfig.getConfig() for the site and
        // sent the merge result; nothing in the new one reads a local copy.
        const fnIdx = src.indexOf('buildWizardPatch: function(wizardState)');
        const fn = src.slice(fnIdx, src.indexOf('persistWizardState: function(wizardState)', fnIdx));
        expect(fn).not.toMatch(/getConfig\(/);
        expect(fn).toMatch(/patch\.turf\[field\] = this\.data\[field\]/);
    });

    test('neither wizard sends a timezone when creating a site', () => {
        expect(read('site-setup-wizard.js')).not.toMatch(/timezone: 'Australia\/Sydney'/);
        expect(read('onboarding-wizard.js')).not.toMatch(/timezone: *'Australia\/Sydney'/);
    });

    test('onboarding-wizard.js patches its three sections', () => {
        const src = read('onboarding-wizard.js');
        expect(src).toMatch(/self\._api\('PATCH', 'sites\/' \+ encodeURIComponent\(siteId\) \+ '\/config\/gaip', \{ patch: gaipCfg \}\)/);
    });
});

describe('GH-440 — the companion selector stops writing the localStorage copy', () => {
    test('daily-dashboard.js calls setCompanionSpecies instead of writing gilba_hub_site_configs', () => {
        const src = read('daily-dashboard.js');
        expect(src).not.toMatch(/setItem\('gilba_hub_site_configs'/);
        expect(src).toMatch(/global\.GAIP_SiteConfig\.setCompanionSpecies\(siteId, value\)/);
    });
});

describe('GH-440 — Settings offers the derived zone as Auto', () => {
    test('the select has an Auto option carrying the derived zone, and the form sends its empty value', () => {
        const blade = fs.readFileSync(
            path.join(__dirname, '../app/resources/views/settings.blade.php'), 'utf8');
        expect(blade).toMatch(/\$tzDerived = \$timezoneDerived \?\? null;/);
        expect(blade).toMatch(/Auto — set location first/);
        expect(blade).toMatch(/<option value="" \{\{ \$tzIsAuto \? 'selected' : '' \}\}>/);

        // The Site form sends whatever the select holds; Auto is the empty
        // string, which is what tells the server to derive.
        expect(read('settings-init.js')).toMatch(/timezone: *siteForm\.querySelector\('#stg-timezone'\)\.value/);
    });
});

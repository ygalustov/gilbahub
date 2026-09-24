/**
 * GH-548 (stage 3) — the browser side: it DISPLAYS the notice, it does not
 * compose it, and it no longer keeps a copy of the result to fall back on.
 *
 * Four properties, and each of them is a way the stage could look done and not
 * be:
 *
 *   1. The words exist in ONE place. The plan put the reason-to-sentence map in
 *      this file's language and the pill on the server, which is two maps; the
 *      map is in PHP and the browser looks codes up in it. A sentence that
 *      reappears in an asset is the second map growing back.
 *   2. Nothing here rewrites the pill. Two functions re-derived it from
 *      `analyzedAt` after load — the one label that cannot say a run failed —
 *      so the server's mark survived until the page finished loading and no
 *      longer.
 *   3. The dashboard has no second source for the numbers. `gilba_hub_cache` is
 *      neither written nor read.
 *   4. The annual nitrogen figures are the run's or they are not shown. No
 *      `localStorage` programme, no flat 150/180 default wearing this site's
 *      name.
 */

'use strict';

const fs = require('fs');
const path = require('path');

const ASSETS = path.join(__dirname, '..', 'assets');
const VIEWS = path.join(__dirname, '..', 'app', 'resources', 'views');
const read = (f) => fs.readFileSync(path.join(ASSETS, f), 'utf8');
const view = (f) => fs.readFileSync(path.join(VIEWS, f), 'utf8');

const HUB = read('hub-persistence.js');
const DASH_INIT = read('dashboard-init.js');
const DASH_UI = read('dashboard-ui.js');
const SOIL = read('soil-nutrition-analysis.js');

/**
 * Code with the comments taken out.
 *
 * The removals below are documented in place — the docblock that replaced
 * `readNProgramFromStorage` names it, so that a reader meets the reasoning where
 * the code used to be. A search of the raw file would find those words and call
 * the removal incomplete, which is a guard measuring prose.
 */
const codeOnly = (src) => src.replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '');

/** Every .js in assets/, so "one place" is a statement about the tree. */
const ALL_ASSETS = fs.readdirSync(ASSETS)
    .filter((f) => /\.js$/.test(f) && !/\.min\.js$/.test(f))
    .map((f) => [f, read(f)]);

describe('GH-548 — the words live in one place', () => {
    /**
     * The sentences themselves, taken from the PHP that owns them. If a copy is
     * ever pasted into an asset, this finds it by its text rather than by
     * somebody remembering to look.
     */
    const PHP = fs.readFileSync(
        path.join(__dirname, '..', 'app', 'app', 'Support', 'AnalysisNotice.php'), 'utf8');

    test('the map is real — the file it is read from actually contains the codes', () => {
        // Positive control for the test below: an empty set of phrases would
        // agree with every asset in the tree.
        ['weather-unavailable', 'calculation-error', 'site-settings-unavailable', 'run-not-completed']
            .forEach((code) => expect(PHP).toContain("'" + code + "'"));
        expect(PHP).toContain('Try Re-run again.');
    });

    test('no asset carries a second copy of a reason sentence', () => {
        const phrases = (PHP.match(/=> '([^']{25,})'/g) || []).map((m) => m.replace(/^=> '|'$/g, ''));
        expect(phrases.length).toBeGreaterThan(5);
        const copies = [];
        ALL_ASSETS.forEach(([file, src]) => {
            const code = codeOnly(src);
            phrases.forEach((p) => { if (code.includes(p)) copies.push(file + ' :: ' + p.slice(0, 40)); });
        });
        expect(copies).toEqual([]);
    });

    test('the browser looks the code up rather than phrasing it', () => {
        expect(DASH_UI).toMatch(/GAIP_ANALYSIS_TEXTS/);
        // and the page is given the map by the server, once, with the pill
        // GH-640: the call takes the projection now, so the server can compose a
        // sentence for every empty section and send it with the numbers. Same
        // claim — the words come from the one place — one argument wider.
        expect(view('partials/analysis-pill.blade.php')).toMatch(/AnalysisNotice::clientTexts\(/);
    });

    test('the old panel texts are gone from both files that carried them', () => {
        ['disease-analysis.js', 'growth-light-analysis.js'].forEach((f) => {
            const src = codeOnly(read(f));
            expect(src).not.toMatch(/No analysis data found/);
            expect(src).not.toMatch(/days old — re-run for the latest conditions/);
            expect(src).not.toMatch(/db-analysis-notice/);
        });
    });
});

describe('GH-548 — the pill is the server’s and nothing rewrites it', () => {
    test('neither shared file sets the pill text', () => {
        // `setText('db-analysis-ts', …)` and `el.textContent = 'Analysis: ' + …`
        expect(DASH_INIT).not.toMatch(/setText\(\s*'db-analysis-ts'/);
        expect(DASH_UI).not.toMatch(/getElementById\('db-analysis-ts'\)/);
        ALL_ASSETS.forEach(([file, src]) => {
            expect([file, /['"]Analysis: ['"]\s*\+/.test(codeOnly(src))]).toEqual([file, false]);
        });
    });

    test('every template that shows a pill takes it from the one partial', () => {
        ['partials/topbar.blade.php', 'analysis/growth-light.blade.php', 'analysis/disease.blade.php']
            .forEach((f) => {
                const src = view(f);
                expect(src).toContain("@include('partials.analysis-pill')");
                // and does not also print one of its own
                expect(src).not.toMatch(/id="db-analysis-ts"/);
            });
    });

    test('every screen that prints the numbers takes the one panel', () => {
        ['dashboard.blade.php', 'plan.blade.php', 'reports/accuracy.blade.php', 'analysis.blade.php',
         'analysis/growth-light.blade.php', 'analysis/disease.blade.php']
            .forEach((f) => {
                const src = view(f);
                expect([f, src.includes("@include('partials.analysis-notice')")]).toEqual([f, true]);
                expect([f, /id="db-analysis-notice"/.test(src)]).toEqual([f, false]);
            });
    });
});

describe('GH-548 — the dashboard has one source for the numbers', () => {
    test('the result copy is neither written nor read', () => {
        expect(codeOnly(HUB)).not.toMatch(/storageSet\(CONFIG\.keys\.cache/);
        expect(codeOnly(DASH_INIT)).not.toMatch(/gilba_hub_cache/);
        // and the key an older bundle left behind is cleared rather than served
        expect(HUB).toMatch(/dropLegacyResultCache/);
    });

    test('an absent result is an outcome, not a reason to look somewhere else', () => {
        // The branch that reached for localStorage when the server had nothing
        // is gone: there is one assignment of `metrics`, and it comes from
        // GAIP_DASHBOARD_DATA.
        const idx = DASH_INIT.indexOf('var dbData   = global.GAIP_DASHBOARD_DATA');
        expect(idx).toBeGreaterThan(-1);
        const after = DASH_INIT.slice(idx, idx + 400);
        expect(after).not.toMatch(/getItem/);
        expect(after).toMatch(/var metrics\s*=\s*dbData && dbData\.metrics/);
    });

    test('the sensor and weather copies are deliberately still there', () => {
        // Named, not silently left: they are a different object (D1-D3 of the
        // plan's list) and are carried in the main defects document. If this
        // ever goes red because they were removed too, the boundary in the
        // docblock above `init()` needs removing with them.
        expect(DASH_INIT).toMatch(/gaip_weather_cache_/);
        expect(DASH_INIT).toMatch(/gaip_hydrosight_readings_cache_/);
    });
});

describe('GH-548 — annual nitrogen comes from the run or is not shown', () => {
    test('the browser copy of the programme and the substitute formula are gone', () => {
        const code = codeOnly(SOIL);
        expect(code).not.toMatch(/readNProgramFromStorage/);
        expect(code).not.toMatch(/gilba_hub_state/);
        expect(code).not.toMatch(/function calcAnnualDemand/);
        expect(code).not.toMatch(/ANNUAL_RATIOS/);
        // the flat defaults that stood in for a site's own programme
        expect(code).not.toMatch(/warm-season'\) \? 180 : 150/);
        // positive control: the file really was read and really does still
        // contain the function this is about
        expect(code).toMatch(/function renderAnnualRequirements/);
    });

    test('a result without annualDemand says so instead of printing numbers', () => {
        const idx = SOIL.indexOf('function renderAnnualRequirements(sn)');
        expect(idx).toBeGreaterThan(-1);
        const body = SOIL.slice(idx, idx + 900);
        expect(body).toMatch(/if \(!demand\)/);
        expect(body).toMatch(/did not produce them/);
        // and it does not fall through to the cards
        expect(body.indexOf('did not produce them')).toBeLessThan(body.indexOf('ANNUAL_NUTS'));
    });
});

/**
 * The behaviour, not the shape: the opener puts the reason on the page when a
 * run comes back failed.
 *
 * The file is loaded with `document.readyState === 'loading'` so its own boot
 * does not run — `GilbaAnalysisNotice` is assigned at module scope, which is
 * the point of exporting it — and the Re-run press is driven by hand.
 */
describe('GH-548 — a failed run puts its reason on the page', () => {
    function loadUi(texts) {
        jest.resetModules();
        const listeners = {};
        const nodes = {};
        const node = (id) => (nodes[id] = nodes[id] || {
            id, textContent: '', className: '', style: {}, dataset: {}, disabled: false,
            hidden: true, innerHTML: '', setAttribute() {}, addEventListener(t, f) { this['on' + t] = f; },
            appendChild() {}, removeChild() {},
        });
        global.document = {
            readyState: 'loading',
            getElementById: (id) => (id === 'db-missing' ? null : node(id)),
            querySelector: () => null,
            querySelectorAll: () => [],
            addEventListener() {},
            createElement: () => node('made'),
            head: node('head'),
            body: { appendChild() {}, removeChild() {} },
        };
        global.window = global;
        global.GAIP_ANALYSIS_TEXTS = texts;
        global.GAIP_HUB_CONFIG = { activeSiteId: 'S1', csrfToken: 'x' };
        global.addEventListener = (t, f) => { (listeners[t] = listeners[t] || []).push(f); };
        global.removeEventListener = () => {};
        global.location = { reload() {} };
        global.fetch = () => Promise.resolve({ ok: true, json: () => Promise.resolve({}) });
        require('../assets/dashboard-ui.js');
        return { node, listeners };
    }

    const TEXTS = {
        reasons: { 'calculation-error': 'the calculation stopped with an error' },
        frame: 'The re-run{when} did not complete: {reason}. Try Re-run again.',
        unknown: 'the run reported "{code}"',
    };

    afterEach(() => {
        delete global.document; delete global.GAIP_ANALYSIS_TEXTS;
        delete global.GAIP_HUB_CONFIG; delete global.fetch; delete global.location;
    });

    test('the sentence is assembled from the server’s map, detail and all', () => {
        loadUi(TEXTS);
        const text = global.GilbaAnalysisNotice.failureText('calculation-error', { message: 'cascade exploded' });
        expect(text).toBe('The re-run did not complete: the calculation stopped with an error (cascade exploded). Try Re-run again.');
    });

    test('a code the map has not learned is still named rather than swallowed', () => {
        loadUi(TEXTS);
        expect(global.GilbaAnalysisNotice.failureText('brand-new')).toContain('"brand-new"');
    });

    test('showing it fills the page’s own panel and makes it visible', () => {
        const h = loadUi(TEXTS);
        const panel = h.node('db-analysis-notice');
        panel.style.display = 'none';
        expect(global.GilbaAnalysisNotice.show('because', 'warning')).toBe(true);
        expect(h.node('db-analysis-notice-text').textContent).toBe('because');
        expect(panel.style.display).toBe('flex');
        expect(panel.className).toBe('db-verdict warning');
    });

    test('with no map at all it degrades to the code, not to silence', () => {
        loadUi(undefined);
        expect(global.GilbaAnalysisNotice.failureText('weather-unavailable'))
            .toContain('"weather-unavailable"');
    });
});

'use strict';

/**
 * GH-792 (queue item 79) — EVERY EMPTY SECTION ON EVERY CLIENT PAGE PRINTS THE COMPOSER'S WORDS.
 *
 * THE UNIVERSE IS WHAT WAS PRINTED, by the coordinator's decision of 30.09.2026: the pages are rendered and
 * the text is read out of what they drew. A census of literals is answered by a new place to write one; a
 * census of what a person read is not.
 *
 * WHAT IS ASSERTED, and it is the reviewer's condition against the GH-409 class: the page prints WHATEVER THE
 * COMPOSER SAYS. The sentence each case hands over is a sentinel of its own, not a copy of the owner's words --
 * a case carrying a copy agrees with the composer when both drift, which is agreement rather than a check. The
 * owner's words themselves are held on the server side, where they are declared
 * (`app/tests/Feature/Gh792TheComposerOwnsTheWordsOfAnEmptySectionTest.php`).
 *
 * IT PRINTS WHAT IT INSPECTED — pages rendered, sections inspected, and what could not be rendered — because
 * "nought by three pages of seven" and "nought by seven" are different numbers under one name.
 */

const fs = require('fs');
const path = require('path');
const { renderPage } = require('./lib/page-render-bench');
const { codeOf } = require('./lib/source-without-comments');

const ROOT = path.join(__dirname, '..');

/**
 * GH-792 (the reviewer's return) — THE UNIVERSE COMES FROM THE DECLARATION, not from a list in this file.
 *
 * His mutation added a twentieth place to the composer and this census still reported "7 of 7", because what
 * it counted was its own `SECTIONS`. The places are declared -- `WORDS_WITHOUT_A_REASON` in
 * `app/app/Support/AnalysisNotice.php` -- and every declared place must be accounted for here: rendered, or
 * named as asked by a page this census does not render. A place nobody asks for reddens too, from the other
 * side: the asks are read out of the pages' own sources.
 */
function declaredPlaces() {
    const src = fs.readFileSync(path.join(ROOT, 'app/app/Support/AnalysisNotice.php'), 'utf8');
    const at = src.indexOf('private const WORDS_WITHOUT_A_REASON = [');
    const end = src.indexOf('\n    ];', at);
    expect(at).toBeGreaterThan(-1);
    expect(end).toBeGreaterThan(at);
    const keys = [];
    const re = /'([A-Za-z.]+)'\s*=>\s*'/g;
    let m;
    while ((m = re.exec(src.slice(at, end))) !== null) keys.push(m[1]);

    return keys;
}

/** Which place each client page asks the one reader for, read out of the pages themselves. */
function placesThePagesAsk() {
    const out = {};
    ['soil-nutrition-analysis.js', 'water-balance-analysis.js', 'stress-analysis.js', 'disease-analysis.js',
        'growth-light-analysis.js', 'plan-ui.js', 'dashboard-init.js'].forEach((file) => {
        const code = codeOf(fs.readFileSync(path.join(ROOT, 'assets', file), 'utf8'), file);
        const re = /(?:GilbaEmptySection\s*\.\s*(?:words|of)|serverSection)\(\s*'([A-Za-z.]+)'\s*\)/g;
        let m;
        while ((m = re.exec(code)) !== null) (out[m[1]] = out[m[1]] || []).push(file);
    });

    return out;
}

/** A sentinel no page could produce on its own, per place. */
const says = (key, text) => ({ sections: { [key]: { cause: null, class: 'not-recorded', module: null,
    retry: false, text } } });

/**
 * Every empty section this item moved, by the page that draws it and the place it asks the composer for.
 * `render` is the page's own entry; `data` is the row that leaves the section empty.
 */
const SECTIONS = [
    { page: 'stress-analysis.js', entry: 'render', container: 'stress-page-content',
      place: 'stress', data: { computed: {} } },
    { page: 'water-balance-analysis.js', entry: 'renderEmpty', container: 'wb-page-content',
      place: 'waterBalance', data: { computed: {} } },
    { page: 'disease-analysis.js', entry: 'renderPage', container: 'dr-page-content',
      place: 'disease', data: { computed: {} } },
    { page: 'soil-nutrition-analysis.js', entry: 'renderEmpty', container: 'sn-page-content',
      place: 'soilNutrition', data: { computed: {} } },
    /**
     * The soil-temperature block of Growth & Light is a sub-render of the page: the page's own `render` draws
     * it among others, and the block is what this place belongs to. It is called by name, with no profile in
     * the row -- which is the state the section is about.
     */
    { page: 'growth-light-analysis.js', entry: 'renderCompactSoilTemp', container: 'gl-page-content',
      place: 'soilTempPhysics', data: { computed: {} }, argument: 'none' },  // called with no profile
    { page: 'plan-ui.js', entry: 'renderPreEmergent', container: 'plan-pe-body',
      place: 'preEmergent', data: { computed: {} }, argument: 'computed' },
    { page: 'dashboard-init.js', entry: 'openPanel', container: 'db-panel-body',
      place: 'dashboard.panel', data: { computed: {} }, argument: 'panelKey',
      elements: { 'db-side-panel': true, 'db-panel-title': true, 'db-panel-backdrop': true } },
];

describe('GH-792 — what each page prints for an empty section', () => {
    const inspected = [];
    const refused = [];

    test('every section prints the composer\'s sentence, whatever that sentence is', () => {
        SECTIONS.forEach((s) => {
            const sentinel = 'SENTINEL for ' + s.place + ' — the composer said this.';
            let out;
            try {
                out = renderPage({
                    file: s.page, entry: s.entry, container: s.container,
                    shared: ['dashboard-ui.js'],
                    elements: s.elements,
                    argument: s.argument === 'computed' ? s.data.computed
                        : (s.argument === 'panelKey' ? 'a-panel-nothing-builds' : undefined),
                    argumentIsNone: s.argument === 'none',
                    globals: { GAIP_DASHBOARD_DATA: s.data, GAIP_ANALYSIS_TEXTS: says(s.place, sentinel) },
                });
            } catch (e) {
                refused.push(s.page + ' :: ' + s.place + ' :: ' + String(e && e.message).slice(0, 120));

                return;
            }
            const printed = out.printed || out.html;
            inspected.push({ page: s.page, place: s.place, called: out.called, wrote: out.wrote,
                carriedTheSentence: printed.indexOf(sentinel) !== -1,
                saysHub: /\bHub\b/.test(printed), printed: printed.slice(0, 90) });
        });

        process.stdout.write('\n[gh792] pages rendered: '
            + new Set(inspected.map((i) => i.page)).size + ' of ' + new Set(SECTIONS.map((s) => s.page)).size
            + ' | sections inspected: ' + inspected.length + ' of ' + SECTIONS.length
            + ' | could not be rendered: ' + refused.length + '\n');
        inspected.forEach((i) => process.stdout.write('[gh792]   ' + i.page.padEnd(28) + i.place.padEnd(16)
            + 'called ' + i.called.padEnd(12)
            + (i.carriedTheSentence ? 'printed the composer\'s sentence' : 'DID NOT carry it')
            + (i.saysHub ? ' | SAYS "Hub"' : '') + '\n'));
        refused.forEach((r) => process.stdout.write('[gh792]   NOT RENDERED: ' + r + '\n'));

        /**
         * AND EVERY DECLARED PLACE IS ACCOUNTED FOR — rendered here, or named as asked by a page this census
         * does not render. A place the composer declares that nobody asks for is named too: words nobody
         * prints are words nobody reads.
         */
        const declared = declaredPlaces();
        const asked = placesThePagesAsk();
        const renderedPlaces = inspected.map((i) => i.place);
        const accounted = [];
        const unaccounted = [];
        declared.forEach((place) => {
            if (renderedPlaces.indexOf(place) !== -1) { accounted.push(place + ' — rendered here'); return; }
            if (asked[place]) {
                accounted.push(place + ' — asked by ' + asked[place].join(', ') + ', not rendered by this census');

                return;
            }
            unaccounted.push(place);
        });
        /**
         * ONE ASK IS NOT A DECLARED PLACE, and it is named here with its reason rather than excused by a rule.
         *
         * `/plan` asks the reader for `pgr` because a RECORDED CAUSE for that section still wins and comes
         * from the composer's reasons. Its no-cause sentence is not declared, by the owner's decision: those
         * words carry a link, the page's channel is escaped, and they stay on the page until she answers. So
         * the ask is legitimate and the absence from the table is deliberate.
         */
        const ASKED_WITHOUT_DECLARED_WORDS = { pgr: 'a recorded cause wins; her no-cause sentence carries a '
            + 'link and stays on the page until she answers' };
        const askedButNotDeclared = Object.keys(asked)
            .filter((p) => declared.indexOf(p) === -1 && !ASKED_WITHOUT_DECLARED_WORDS[p]);
        process.stdout.write('[gh792] places the composer declares: ' + declared.length
            + ' | accounted for: ' + accounted.length + '\n'
            + accounted.map((a) => '[gh792]   ' + a).join('\n') + '\n');
        if (unaccounted.length) {
            process.stdout.write('[gh792]   DECLARED AND NOBODY ASKS: ' + JSON.stringify(unaccounted) + '\n');
        }
        if (askedButNotDeclared.length) {
            process.stdout.write('[gh792]   ASKED FOR AND NOT DECLARED: ' + JSON.stringify(askedButNotDeclared) + '\n');
        }
        expect(unaccounted).toEqual([]);
        expect(askedButNotDeclared).toEqual([]);

        // The subject exists: something was rendered at all.
        expect(inspected.length).toBeGreaterThan(0);
        expect(inspected.filter((i) => !i.carriedTheSentence)).toEqual([]);
        expect(inspected.filter((i) => i.saysHub)).toEqual([]);
        // And what could not be rendered is named rather than passed over.
        expect(refused).toEqual([]);
    });
});

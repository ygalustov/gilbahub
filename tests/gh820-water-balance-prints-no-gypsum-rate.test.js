/**
 * GH-820 (queue item "Water Balance") — ANALYSIS -> WATER BALANCE PRINTS NO GYPSUM RATE.
 *
 * The page printed gypsum rates as literals: at an SAR of 16.7 one screen named three different rates for one
 * product. Amendment rates come from a computed deficit, never from a literal, and this page has no computed
 * rate to connect, so the literal goes and the instruction stays. The same holds for the rates the water engine
 * writes into the saved diagnostics, which this page prints as they come.
 *
 * TWO SIGNS, and the second is what makes the first mean anything:
 *   1. THE NET -- no number with t/ha or kg/ha anywhere in what the page printed, in any state. The universe is
 *      the printed text, not a list of places, so an eleventh place is caught by itself. Its expression is held
 *      to every form a rate has been written in on this page and in the engine (controls below).
 *   2. WHAT STAYS -- the remaining words of every place are printed at least once in the state that reaches it.
 *      Zero is red: without this, "the rate went" cannot be told from "the whole sentence went".
 * Every place is first shown reached, by a mark it prints before and after the change.
 *
 * HOW IT IS RUN: the page is rendered whole through `render()` into `wb-page-content` on the shared bench
 * (`tests/lib/page-render-bench.js`). State 8 takes its diagnostics from the water engine itself.
 */
'use strict';

const fs = require('fs');
const path = require('path');
const vm = require('vm');
const { renderPage } = require('./lib/page-render-bench');

const RATE = /\d[\d.,]*\+?\s*(?:[–-]\s*\d[\d.,]*\s*)?(?:t|kg)\/ha/g;
const RATE_FORMS = ['Apply gypsum 1.0–2.0 t/ha, monitor', 'Apply gypsum 1.0-2.0 t/ha, monitor',
    'Consider preventative gypsum (0.5 t/ha) if', 'Heavy gypsum (2.0+ t/ha), consider', 'rate 1–3 t/ha depending',
    '3–6 t/ha', 'at 200 kg/ha'];

/** The water engine's own diagnostics for a water of this SAR (no bicarbonate, so SARadj equals SAR). */
function engineDiagnostics(sar, turf) {
    const sandbox = { console: { log() {}, warn() {}, error() {} }, Math, JSON, Object, Array, String, Number };
    sandbox.window = sandbox;
    sandbox.document = { addEventListener() {}, getElementById: () => null, querySelector: () => null, querySelectorAll: () => [] };
    const ctx = vm.createContext(sandbox);
    // GH-824: the shared water levels load before the engine, as in every view that loads it.
    vm.runInContext(fs.readFileSync(path.join(__dirname, '../assets/water-levels-by-grass.js'), 'utf8'), ctx);
    vm.runInContext(fs.readFileSync(path.join(__dirname, '../assets/water-progressive-disclosure-WITH-SOIL-INTERACTION.js'), 'utf8'), ctx);
    // Ca 40 mg/L (2 meq) and Mg 12.15 mg/L (1 meq): SAR = Na(meq) / sqrt(1.5).
    const naMgL = sar * Math.sqrt(1.5) * 23.0;
    return vm.runInContext('calculateWaterDiagnostics(' + JSON.stringify({ Ca: 40, Mg: 12.15, Na: naMgL }) + ', 0.8, 7.0, '
        + JSON.stringify(turf || { isC4: false }) + ')', ctx);
}

const STATES = {
    S1: { wb: { SAR: 10 } },
    S2: { wb: { SAR: 7 } },
    S3: { wb: { SAR: 4 } },
    S4: { wb: { SAR: 20 } },
    // GH-824: the card and the recommendation decide gypsum by the SAR level the engine saved for the site's grass,
    // so the states that reach them carry the engine's diagnostics (a cool-season site).
    S1d: { wb: { SAR: 10, diagnostics: engineDiagnostics(10) } },
    S4d: { wb: { SAR: 20, diagnostics: engineDiagnostics(20) } },
    S5: { wb: { SAR: 1 }, sn: { pH: 7.8, soilNa: 70 } },
    S6: { wb: { SAR: 1 }, sn: { pH: 6.5, soilNa: 120 } },
    S7: { wb: { SAR: 1 }, sn: { pH: 6.5, soilNa: 40 } },
    S8a: { wb: { SAR: 4, diagnostics: engineDiagnostics(4) } },
    S8b: { wb: { SAR: 7, diagnostics: engineDiagnostics(7) } },
    S8c: { wb: { SAR: 10, diagnostics: engineDiagnostics(10) } },
};

/**
 * place -> the state that reaches it, the mark that shows it was reached (printed before and after the change),
 * and the words that stay, written out by hand from the plan.
 */
const PLACES = [
    // GH-824: the SAR row built without saved diagnostics advises nothing about gypsum (no level for the site's grass),
    // so W1-W3 have no remaining words to find; they are reached, and asserted silent below.
    { place: 'W1 SAR row, SAR >= 9', state: 'S1', mark: 'Sodium Hazard (SAR)', stays: null },
    { place: 'W2 SAR row, 6 <= SAR < 9', state: 'S2', mark: 'Sodium Hazard (SAR)', stays: null },
    { place: 'W3 SAR row, 3 <= SAR < 6', state: 'S3', mark: 'Sodium Hazard (SAR)', stays: null },
    { place: 'W4 Gypsum Recommendation card', state: 'S4d', mark: 'Gypsum Recommendation',
      stays: 'Apply as surface broadcast, water in immediately (≥10mm). Retest SAR 3 months after application.' },
    { place: 'W5 High Sodium Hazard', state: 'S1d', mark: 'High Sodium Hazard',
      stays: 'Apply gypsum (CaSO₄) to displace Na from exchange sites. Irrigate immediately after application. Check infiltration rates monthly.' },
    { place: 'W6 pH x Sodium, critical', state: 'S5', mark: 'pH × Sodium — Critical',
      stays: 'Gypsum application + acidification program. Acidify to pH 6.5–7.0. Monitor SAR in irrigation water.' },
    { place: 'W7 Soil Sodium, high', state: 'S6', mark: 'Soil Sodium — High',
      stays: 'URGENT: Apply gypsum in split applications. Aggressive leaching program.' },
    { place: 'W8 Soil Sodium, elevated', state: 'S5', mark: 'Soil Sodium — Elevated',
      stays: 'Apply gypsum. Increase leaching fraction (LF 0.20–0.25).' },
    { place: 'W9 Soil Sodium, slightly elevated', state: 'S7', mark: 'Soil Sodium — Slightly Elevated',
      stays: 'Consider preventative gypsum if using high-Na water.' },
    { place: 'W10 engine, SARadj 3-6', state: 'S8a', mark: 'Adjusted SAR (SARadj)', stays: 'Consider preventative gypsum (Suarez 1981 method)' },
    { place: 'W10 engine, SARadj 6-9', state: 'S8b', mark: 'Adjusted SAR (SARadj)', stays: 'Apply gypsum, monitor infiltration (Suarez 1981 method)' },
    { place: 'W10 engine, SARadj >= 9', state: 'S8c', mark: 'Adjusted SAR (SARadj)', stays: 'Heavy gypsum, consider water blending (Suarez 1981 method)' },
];

function printedOf(name) {
    const s = STATES[name];
    const out = renderPage({
        file: 'water-balance-analysis.js', entry: 'render', container: 'wb-page-content', argumentIsNone: true,
        shared: ['dashboard-ui.js', 'water-levels-by-grass.js'],
        globals: { GAIP_DASHBOARD_DATA: { computed: { waterBalance: s.wb, soilNutrition: s.sn || null } } },
    });
    return out.printed;
}

function count(text, needle) { return text.split(needle).length - 1; }

describe('GH-820 — Water Balance prints no gypsum rate', () => {
    const printed = {};
    beforeAll(() => { Object.keys(STATES).forEach((name) => { printed[name] = printedOf(name); }); });

    test('the net catches every form a rate has been written in', () => {
        const missed = RATE_FORMS.filter((f) => !(f.match(RATE) || []).length);
        process.stdout.write('[gh820] rate forms the net does not catch: ' + JSON.stringify(missed) + '\n');
        expect(missed).toEqual([]);
    });

    test('every place is reached, the page prints no rate, and what stays of each place is printed', () => {
        const reached = PLACES.filter((p) => printed[p.state].indexOf(p.mark) !== -1).map((p) => p.place);
        const rates = {};
        Object.keys(printed).forEach((name) => { const m = printed[name].match(RATE); if (m) rates[name] = m; });
        const stays = {};
        PLACES.forEach((p) => { stays[p.place] = p.stays === null ? 'silent' : count(printed[p.state], p.stays); });
        const missing = PLACES.filter((p) => p.stays !== null && stays[p.place] < 1).map((p) => p.place + ' <- ' + p.state);
        // GH-824: and the rows without a saved level say nothing about gypsum.
        const advising = ['S1', 'S2', 'S3'].filter((n) => /Apply gypsum, monitor infiltration\.|Consider preventative gypsum\./.test(printed[n]));
        expect(advising).toEqual([]);

        process.stdout.write('[gh820] states ' + Object.keys(STATES).length + ', places reached ' + reached.length + '/'
            + PLACES.length + ', rate matches ' + Object.values(rates).reduce((n, m) => n + m.length, 0) + '\n');
        process.stdout.write('[gh820] rates printed, by state: ' + JSON.stringify(rates) + '\n');
        process.stdout.write('[gh820] what stays, place -> state -> found: ' + JSON.stringify(PLACES.map((p) => p.place + ' -> ' + p.state + ' -> ' + stays[p.place])) + '\n');
        process.stdout.write('[gh820] places whose remaining words are not printed: ' + JSON.stringify(missing) + '\n');

        expect(reached).toEqual(PLACES.map((p) => p.place));
        expect(rates).toEqual({});
        expect(missing).toEqual([]);
    });

    test('at the SAR of the finding the page still names gypsum, and no rate for it', () => {
        STATES.SAR167 = { wb: { SAR: 16.7, diagnostics: engineDiagnostics(16.7) } };
        const text = printedOf('SAR167');
        const got = { gypsum: /gypsum/i.test(text), rates: text.match(RATE) || [] };
        process.stdout.write('[gh820] SAR 16.7: ' + JSON.stringify(got) + '\n');
        expect(got).toEqual({ gypsum: true, rates: [] });
    });
});

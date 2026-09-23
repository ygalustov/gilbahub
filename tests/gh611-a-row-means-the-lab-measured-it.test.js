/**
 * GH-611 — A ROW IN THE ION TABLE MEANS THE LAB MEASURED THAT ION.
 *
 * THE RULE, in the owner's decision of 23.09.2026: a reading that arrived is
 * shown whatever it is, and a key that never arrived says nothing, because
 * nobody measured it. Asked about carbonate specifically, she answered that
 * there was no question to decide — "the same as the others: 0 is zero, no
 * measurement is empty".
 *
 * WHAT WAS WRONG. The eight rows of the balance table were drawn on
 * `if (ions.X)`, and `ions` is meq/L produced by `_meq`, which returns
 * `(parseFloat(x) || 0) / factor`. A carbonate the lab measured and found to be
 * zero and a carbonate nobody tested for are the same `0` after that, and the
 * table drew neither. Measured on the stand, all eight live water samples:
 * `CO3` is the only reading that is a genuine zero, and it is zero on SIX of
 * them — `Burns` 54 and `New test - location` 136-140. Six rows the client
 * never saw, with nothing to say whether the water had been tested for it.
 *
 * WHAT CHANGED, AND IT ONLY GOES ONE WAY. The producer now records
 * `measuredIons` beside `ions`: what the sample itself carried among those
 * eight, in the sample's own units, derived from the same `_mgToMeq` table that
 * decides what `ions` contains — so an ion added there arrives here with no
 * second edit. `ions` is untouched and still answers 0 for an absent reading,
 * which is correct: SAR, RSC and LSI need a number for every term. Six rows
 * appear, none disappears.
 *
 * WHAT IS DELIBERATELY NOT DONE. The badge ladder reads "Trace" at its bottom,
 * which speaks of a small presence where the measurement says there is none.
 * That is text a client reads, it has one author, and this is not that author:
 * the number is shown and the badge omitted until the wording exists. The case
 * below asserts the omission so that nobody quietly fills it in.
 *
 * THE BOUNDARY, named because it is real: `renderIons` opens with
 * `hasIons = some(k => ions[k] > 0)`, so a sample whose every balance ion is
 * zero would hide the section entirely, measured or not. No such sample exists
 * on the stand today, and that gate is not this work — it is named here so the
 * next reader does not have to rediscover it.
 */

'use strict';

const vm = require('vm');
const fs = require('fs');
const path = require('path');

const SRC = fs.readFileSync(
    path.join(__dirname, '..', 'assets', 'water-balance-analysis.js'), 'utf8');

/** The renderer, executed. `renderIons` is internal, so it is exposed beside
 *  the module's own export line — the shape the other benches here use, and the
 *  assertion on that line is the positive control. */
function renderIons(wb) {
    const exportLine = 'global.GAIP_WaterBalanceAnalysis = {';
    expect(SRC).toContain(exportLine);
    const testSrc = SRC.replace(exportLine,
        'global.__test_renderIons = renderIons;\n    ' + exportLine);

    const sandbox = {
        console: { log() {}, warn() {}, error() {} },
        setTimeout: () => 0, clearTimeout() {}, setInterval: () => 0, clearInterval() {},
        document: {
            readyState: 'complete', addEventListener() {},
            getElementById: () => null, querySelector: () => null, querySelectorAll: () => [],
            createElement: () => ({ style: {}, appendChild() {}, setAttribute() {} }),
            body: { appendChild() {}, removeChild() {} },
        },
        JSON, Math, Object, Array, String, Number, Date,
        parseFloat, parseInt, isNaN, Promise, RegExp,
        fetch: () => Promise.resolve({ ok: true, json: () => Promise.resolve({}) }),
    };
    sandbox.window = sandbox;
    sandbox.global = sandbox;
    sandbox.globalThis = sandbox;

    const ctx = vm.createContext(sandbox);
    vm.runInContext(testSrc, ctx, { filename: 'water-balance-analysis.js' });
    return ctx.__test_renderIons(wb);
}

/** `Burns` sample 54 as the producer records it: carbonate measured, and zero. */
const BURNS = {
    ions: { Ca: 2.295, Mg: 1.2, Na: 0.9, K: 0.1, HCO3: 2.459, CO3: 0, Cl: 1.4, SO4: 0.3 },
    measuredIons: { Ca: 46, Mg: 14.6, Na: 20.7, K: 3.9, HCO3: 150, CO3: 0, Cl: 49.6, SO4: 14.4 },
    B: 0, Fe: 1.3, ecw: 0.5, pH: 7.1,
};
/** `Russley` 115: no carbonate key at all — nobody tested for it. */
const RUSSLEY = {
    ions: { Ca: 2.295, Mg: 1.2, Na: 0.9, K: 0, HCO3: 2.459, CO3: 0, Cl: 0, SO4: 0 },
    measuredIons: { Ca: 46, Mg: 14.6, Na: 20.7, HCO3: 150 },
    B: null, Fe: null, ecw: 0.5, pH: 7.1,
};

const hasRow = (html, label) => html.indexOf('>' + label + '<') !== -1;

describe('GH-611 — the ion table draws what the lab measured', () => {
    test('the renderer ran and produced a table at all', () => {
        // Positive control: without it every claim below could hold on an
        // empty string returned by the gate at the top of the function.
        const html = renderIons(BURNS);
        process.stdout.write('[gh611] rows rendered for Burns: '
            + (html.match(/<tr><td>/g) || []).length + '\n');

        expect(html).toContain('wb-ion-table');
        expect(hasRow(html, 'Calcium (Ca)')).toBe(true);
    });

    test('a carbonate measured as zero gets its row — the six rows nobody saw', () => {
        expect(hasRow(renderIons(BURNS), 'Carbonate (CO₃)')).toBe(true);
    });

    test('a carbonate nobody measured gets no row, which is the other half', () => {
        // Both halves in one file on purpose: either alone leaves the collapse
        // standing, just facing the other way.
        expect(hasRow(renderIons(RUSSLEY), 'Carbonate (CO₃)')).toBe(false);
    });

    test('and nothing that used to be drawn has stopped being drawn', () => {
        // The change is one-directional by design — six rows appear, none
        // disappears — and this is where that is checked rather than claimed.
        const html = renderIons(BURNS);
        ['Calcium (Ca)', 'Magnesium (Mg)', 'Potassium (K)',
         'Bicarbonate (HCO₃)', 'Sulphate (SO₄)'].forEach((label) => {
            expect(hasRow(html, label)).toBe(true);
        });
        // Russley keeps exactly the four its sample carries and gains nothing.
        const r = renderIons(RUSSLEY);
        expect(hasRow(r, 'Calcium (Ca)')).toBe(true);
        expect(hasRow(r, 'Potassium (K)')).toBe(false);
        expect(hasRow(r, 'Sulphate (SO₄)')).toBe(false);
    });

    test('the measured zero carries no badge, and the others still do', () => {
        // The wording for "measured, and there is none" belongs to the single
        // author of client-facing text and does not exist yet. Asserting the
        // silence is what stops it being filled in quietly with "Trace".
        const html = renderIons(BURNS);
        const co3Row = html.slice(html.indexOf('Carbonate (CO₃)'));
        const co3Cells = co3Row.slice(0, co3Row.indexOf('</tr>'));

        expect(co3Cells).not.toContain('Trace');
        expect(co3Cells).toContain('<td></td>');
        // And the ladder is alive elsewhere, or this would pass on a renderer
        // that stopped badging anything at all.
        const hco3Row = html.slice(html.indexOf('Bicarbonate (HCO₃)'));
        // Asked as 'a badge was drawn' rather than by its wording: which word
        // the ladder picks changes with the reading, and a case that names
        // the word goes red when the fixture moves.
        expect(hco3Row.slice(0, hco3Row.indexOf('</tr>'))).toContain('<span');
    });

    test('a row stored before the producer knew the difference is read the old way', () => {
        // Rows written earlier carry no `measuredIons`. Inventing an answer for
        // them would be worse than the silence they already have, so the old
        // question is asked and the old table comes back unchanged.
        const legacy = Object.assign({}, BURNS);
        delete legacy.measuredIons;

        expect(hasRow(renderIons(legacy), 'Calcium (Ca)')).toBe(true);
        expect(hasRow(renderIons(legacy), 'Carbonate (CO₃)')).toBe(false);
    });
});

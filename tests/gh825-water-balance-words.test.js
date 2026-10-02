/**
 * GH-825 — THE WORDS OF WATER BALANCE FOR A SAR WITHOUT A LEVEL, AND THE SAR HINT WITHOUT ITS SCALE.
 *
 * The owner's answers: "Not assessed" where the SAR has no level for the site's grass ("Ok"); and the SAR hint
 * loses its scale of numbers, keeping the explanation and the formula -- no new words (variant (a), her rule
 * "the numbers go"). Two cases of "no level": no saved diagnostics at all (the page builds its own row), and a
 * saved SAR row without a level (the engine, when the resolver named no grass).
 */
'use strict';

const fs = require('fs');
const path = require('path');
const vm = require('vm');
const { renderPage } = require('./lib/page-render-bench');

const read = (f) => fs.readFileSync(path.join(__dirname, '..', f), 'utf8');
const NOT_ASSESSED = 'Not assessed';
const SCALE_WORDS = /\b(Low|Medium|High|Very high)\b|Low sodium hazard/;

/** The SAR row's own text: from its label to the next block (the soil structure card follows it). */
function sarRowText(printed) {
    const at = printed.indexOf('Sodium Hazard (SAR)');
    if (at === -1) return null;
    const end = printed.indexOf('Soil Structure Risk', at);
    return printed.slice(at, end === -1 ? at + 120 : end);
}

describe('GH-825 — Water Balance words', () => {
    test('no saved diagnostics: the SAR row says "Not assessed", with no level words of the page\'s own', () => {
        const printed = renderPage({
            file: 'water-balance-analysis.js', entry: 'render', container: 'wb-page-content', argumentIsNone: true,
            shared: ['dashboard-ui.js', 'water-levels-by-grass.js'],
            globals: { GAIP_DASHBOARD_DATA: { computed: { waterBalance: { SAR: 10 }, soilNutrition: null } } },
        }).printed;
        const row = sarRowText(printed);
        process.stdout.write('[gh825] page SAR row without diagnostics: ' + JSON.stringify(row) + '\n');
        expect(row).not.toBeNull();
        expect({ notAssessed: row.indexOf(NOT_ASSESSED) !== -1, scaleWords: (row.match(SCALE_WORDS) || [null])[0] })
            .toEqual({ notAssessed: true, scaleWords: null });
    });

    test('the engine: a SAR row without a level is "Not assessed"; with a grass it keeps its level word', () => {
        const sb = { console: { log() {}, warn() {}, error() {} }, Math, JSON, Object, Array, String, Number, isFinite };
        sb.window = sb;
        sb.document = { addEventListener() {}, getElementById: () => null, querySelector: () => null, querySelectorAll: () => [] };
        const ctx = vm.createContext(sb);
        vm.runInContext(read('assets/water-levels-by-grass.js'), ctx);
        vm.runInContext(read('assets/water-progressive-disclosure-WITH-SOIL-INTERACTION.js'), ctx);
        const row = (isC4) => vm.runInContext('calculateWaterDiagnostics({"Ca":40,"Mg":12.15,"Na":' + (10 * Math.sqrt(1.5) * 23)
            + '}, 0.8, 7.0, ' + JSON.stringify({ isC4: isC4 }) + ')', ctx).filter((d) => d.parameter === 'SAR')[0];
        const got = { noGrass: row(null).status, coolSeason: row(false).status };
        process.stdout.write('[gh825] engine SAR row status: ' + JSON.stringify(got) + '\n');
        expect(got).toEqual({ noGrass: NOT_ASSESSED, coolSeason: 'Severe' });
    });

    test('the SAR hint keeps its explanation and formula and loses its scale of numbers', () => {
        const sb = { console: { log() {}, warn() {}, error() {} }, document: { getElementById: () => null, addEventListener() {}, querySelectorAll: () => [] } };
        sb.window = sb;
        const ctx = vm.createContext(sb);
        vm.runInContext(read('assets/water-balance-analysis.js'), ctx);
        const body = ctx.GAIP_GLOSSARY['wb-sar'].body;
        process.stdout.write('[gh825] wb-sar hint: ' + JSON.stringify(body) + '\n');
        expect({
            explanation: body.indexOf('Relative proportion of sodium to calcium and magnesium.') === 0,
            formula: body.indexOf('Formula: Na / √((Ca + Mg) / 2)   [all in meq/L]') !== -1,
            scale: (body.match(/(^|\n)(< 3|3–9|9–18|> 18) —/g) || []).length,
            gypsum: /gypsum/i.test(body),
        }).toEqual({ explanation: true, formula: true, scale: 0, gypsum: false });
    });
});

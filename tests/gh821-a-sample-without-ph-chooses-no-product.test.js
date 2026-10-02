/**
 * GH-821 (queue item 3gy, delivery 2) — A SAMPLE WITHOUT pH: NO PRODUCT CHOSEN BY A pH NOBODY MEASURED.
 *
 * The amendment decision stood in pH 7.0 for a sample that reports none, and chose a product by it: kieserite
 * for magnesium ("Band: alkaline pH (7.0 >= 7.0)"), gypsum for sulphur ("pH-neutral S delivery at pH 7.0").
 * The owner's decision, variant (a): the product is not chosen, and the row says why with its deficit. The
 * stand-in goes, and "measured" has one definition in the report.
 *
 * THE SUBJECT IS IN THE FIXTURE ITSELF. On the stand one soil sample has no pH (it is short of calcium only),
 * so it carries no Mg / S row; the case builds two synthetic samples without pH, one short of magnesium and one
 * short of sulphur, both above what the programme delivers, and prints the list it examined.
 *
 * WHAT THIS FILE DOES NOT PROVE, named: the readers of soil pH outside the report keep their own orders and
 * stand-ins (a recorded remainder), and `pH_CaCl2` answering for pH by the method suffix is unchanged (the
 * owner's open question in the product). Sign 6 inspects the places the pH verdict prints from, by its
 * statuses -- not every reader of pH in the report.
 */
'use strict';

const fs = require('fs');
const path = require('path');
const { loadPage, SITE_ID } = require('./helpers/export-page-sandbox');
const { documentParts, flatText } = require('./helpers/word-document-reading');

function say(s) { process.stdout.write(s + '\n'); }

/** The spellings that answer for soil pH, from the declaration itself (lab-reading-names.json). */
const NAMES = JSON.parse(fs.readFileSync(path.join(__dirname, '../assets/lab-reading-names.json'), 'utf8'));
const PH_SPELLINGS = NAMES.types.soil.readings.pH;
const METHOD_SUFFIXES = NAMES.extractionMethodSuffixes;

/** Which declared spelling answers for pH in this sample's readings (the three steps), or null. */
function answeredBy(readings) {
    const keys = Object.keys(readings).filter((k) => readings[k] !== '' && readings[k] !== null && readings[k] !== undefined);
    for (const sp of PH_SPELLINGS) if (keys.indexOf(sp) !== -1) return sp;
    for (const sp of PH_SPELLINGS) { const k = keys.find((x) => x.toLowerCase() === sp.toLowerCase()); if (k) return sp; }
    const stripped = keys.find((k) => METHOD_SUFFIXES.some((suf) => {
        const re = new RegExp('^(.*?)[\\s_(]*' + suf + '\\)?$', 'i');
        const m = re.exec(k);
        return m && PH_SPELLINGS.some((sp) => sp.toLowerCase() === m[1].toLowerCase());
    }));
    return stripped ? 'method suffix' : null;
}

const MG_SHORT = { K: 120, P: 60, S: 20, Ca: 800, Mg: 10, CEC: 8 };
const S_SHORT = { K: 120, P: 60, S: 1, Ca: 800, Mg: 150, CEC: 8 };
const PKCA_SHORT = { K: 10, P: 5, S: 20, Ca: 100, Mg: 150, CEC: 8 };
const FIXTURE = { 'Mg short, no pH': MG_SHORT, 'S short, no pH': S_SHORT, 'P/K/Ca short, no pH': PKCA_SHORT };

const PHRASE = (x, el) => 'pH was not reported on this sample, so the product is not chosen; deficit ' + x + ' kg ' + el + '/ha';
const PHRASE_ANY = /pH was not reported on this sample, so the product is not chosen; deficit ([\d.]+) kg (Mg|S)\/ha/g;

async function build(page, species, soil, opts) {
    page.putSiteMethodology('mlsn');
    page.putSiteSpecies(species);
    page.putSoilReadings(soil);
    page.putPageProgram(undefined);
    const W = page.sandbox.GAIP_WordExport;
    const data = W.collectData(page.sandbox.GAIP_NutritionProgramInputs.resolveExportInputs({ siteId: SITE_ID }));
    if (opts && opts.seeding) {
        // The seeding context the builder hands the decisions when an overseed is configured.
        data._soilVerdicts = W._buildSoilVerdicts(data.soil, data.nutritionProgram, 'fairway',
            { isOverseed: true, seedingActive: true, hemisphere: 'south' }, 'south', data.turf);
    }
    const parts = await documentParts(page.sandbox, data);
    return { data: data, parts: parts, text: flatText(parts) };
}

/** The table row of an element, as its cells: [name, deficit, delivers, residual, product, theoretical, practical, status]. */
function rowOf(parts, element) {
    const rows = new Map();
    parts.filter((p) => p.inTable).forEach((p) => { if (!rows.has(p.row)) rows.set(p.row, []); rows.get(p.row).push(p.text.trim()); });
    // A paragraph right after the table is read into its last row by the document reader, so the row is its
    // first eight cells.
    return Array.from(rows.values()).filter((cells) => cells.length >= 8 && cells[0].endsWith('(' + element + ')')
        && /^[\d.]+$/.test(cells[1])).map((cells) => cells.slice(0, 8));
}

describe('GH-821 — a sample without pH chooses no product', () => {
    jest.setTimeout(300000);
    let page;
    beforeAll(() => {
        page = loadPage({ errors: [], warnings: [], alerts: [] });
        expect(page.failures).toEqual([]);
    });

    test('the fixture carries the subject: samples without pH by every declared name, with Mg / S short of the programme', async () => {
        const examined = [], by = {}, without = [], mg = [], s = [];
        for (const name of Object.keys(FIXTURE)) {
            examined.push(name);
            const a = answeredBy(FIXTURE[name]);
            by[a || 'none'] = (by[a || 'none'] || 0) + 1;
            if (a) continue;
            without.push(name);
            const d = await build(page, 'Perennial Ryegrass', FIXTURE[name]);
            const el = d.data._soilVerdicts.elements;
            if (el.Mg.decision && el.Mg.decision.kgDeficit > el.Mg.decision.kgProgramme) mg.push(name);
            if (el.S.decision && el.S.decision.kgDeficit > el.S.decision.kgProgramme) s.push(name);
        }
        say('[gh821] declared pH spellings: ' + JSON.stringify(PH_SPELLINGS) + '; method suffixes: ' + JSON.stringify(METHOD_SUFFIXES));
        say('[gh821] soil samples examined: ' + examined.length + ' ' + JSON.stringify(examined));
        say('[gh821] pH answered by: ' + JSON.stringify(by));
        say('[gh821] without pH by all names: ' + without.length + ' ' + JSON.stringify(without));
        say('[gh821] of those with Mg / S deficit above the programme: ' + mg.length + ' / ' + s.length + ' ' + JSON.stringify({ Mg: mg, S: s }));
        expect(examined.length).toBeGreaterThan(0);
        expect(without.length).toBeGreaterThanOrEqual(2);
        expect([mg.length >= 1, s.length >= 1]).toEqual([true, true]);
    });

    test('sign 1 — magnesium without pH: the row says why, with its own deficit; no product, no band', async () => {
        const d = await build(page, 'Perennial Ryegrass', MG_SHORT);
        const row = rowOf(d.parts, 'Mg');
        const x = row.length === 1 ? row[0][1] : null;
        const body = d.parts.filter((p) => !p.inTable).map((p) => p.text);
        const got = {
            rows: row.length,
            product: row.length === 1 ? row[0][4] : null,
            statusIsThePhrase: row.length === 1 && row[0][7] === PHRASE(x, 'Mg'),
            phraseInTable: d.parts.filter((p) => p.inTable && p.text.indexOf(PHRASE(x, 'Mg')) !== -1).length,
            phraseInText: body.filter((t) => t.indexOf(PHRASE(x, 'Mg')) !== -1).length,
            band: (d.text.match(/Band: /g) || []).length,
            magnesiumProducts: (d.text.match(/Kieserite|Epsom|Dolomite/g) || []).length,
        };
        const control = await build(page, 'Perennial Ryegrass', Object.assign({}, MG_SHORT, { pH: 6.5 }));
        const cGot = { product: (control.data._soilVerdicts.elements.Mg.decision || {}).amendmentKey || null,
            phrase: (control.text.match(PHRASE_ANY) || []).length };
        say('[gh821] Mg without pH: ' + JSON.stringify(got) + '; row ' + JSON.stringify(row[0] || null));
        say('[gh821] Mg control at pH 6.5: ' + JSON.stringify(cGot));
        expect(got).toEqual({ rows: 1, product: '-', statusIsThePhrase: true, phraseInTable: 1, phraseInText: 1, band: 0, magnesiumProducts: 0 });
        expect(cGot.phrase).toBe(0);
        expect(cGot.product).not.toBeNull();
    });

    test('sign 2 — sulphur without pH (no dolomite coming): the same, in kg S/ha', async () => {
        const d = await build(page, 'Perennial Ryegrass', S_SHORT);
        const row = rowOf(d.parts, 'S');
        const x = row.length === 1 ? row[0][1] : null;
        const got = {
            rows: row.length,
            product: row.length === 1 ? row[0][4] : null,
            statusIsThePhrase: row.length === 1 && row[0][7] === PHRASE(x, 'S'),
            phraseInTable: d.parts.filter((p) => p.inTable && p.text.indexOf(PHRASE(x, 'S')) !== -1).length,
            phraseInText: d.parts.filter((p) => !p.inTable && p.text.indexOf(PHRASE(x, 'S')) !== -1).length,
            neutralAtPH: (d.text.match(/pH-neutral S delivery at pH/g) || []).length,
        };
        const control = await build(page, 'Perennial Ryegrass', Object.assign({}, S_SHORT, { pH: 6.0 }));
        const cGot = { product: (control.data._soilVerdicts.elements.S.decision || {}).amendmentKey || null,
            phrase: (control.text.match(PHRASE_ANY) || []).length };
        say('[gh821] S without pH: ' + JSON.stringify(got) + '; row ' + JSON.stringify(row[0] || null));
        say('[gh821] S control at pH 6.0: ' + JSON.stringify(cGot));
        expect(got).toEqual({ rows: 1, product: '-', statusIsThePhrase: true, phraseInTable: 1, phraseInText: 1, neutralAtPH: 0 });
        expect(cGot).toEqual({ product: 'sulphateOfAmmonia', phrase: 0 });
    });

    test('sign 3 — P, K and Ca without pH keep their products and say nothing about a pH', async () => {
        const d = await build(page, 'Perennial Ryegrass', PKCA_SHORT, { seeding: true });
        const el = d.data._soilVerdicts.elements;
        // The glossary describes extraction methods "at pH 7 or pH 8.1"; it is not a sentence about this sample.
        const body = d.parts.filter((p) => !/^(References|Glossary|Contents)/.test(p.section || '')).map((p) => p.text).join('\n');
        const got = {
            products: ['P', 'K', 'Ca'].map((k) => [k, (el[k].decision || {}).status, (el[k].decision || {}).amendmentKey || null]),
            atPH: (body.match(/at pH /g) || []).length,
            pH70: (body.match(/pH 7\.0/g) || []).length,
        };
        const control = await build(page, 'Perennial Ryegrass', Object.assign({}, PKCA_SHORT, { pH: 5.6 }), { seeding: true });
        say('[gh821] P/K/Ca without pH, seeding: ' + JSON.stringify(got));
        say('[gh821]   where "at pH" stands outside the glossary: ' + JSON.stringify(d.parts.filter((p) => /at pH /.test(p.text)
            && !/^(References|Glossary|Contents)/.test(p.section || '')).map((p) => (p.section || '?') + ' :: ' + p.text.slice(0, 120))));
        say('[gh821] control at pH 5.6, seeding: "at pH 5.6" x' + (control.text.match(/at pH 5\.6/g) || []).length);
        expect(got.products.map((p) => p[1])).toEqual(['apply', 'apply', 'apply']);
        // The products the P, K and Ca rules choose whatever the pH (written out by hand, not read off a run).
        expect(got.products.map((p) => p[2])).toEqual(['map', 'potassiumSulphate', 'gypsum']);
        expect([got.atPH, got.pH70]).toEqual([0, 0]);
        expect((control.text.match(/at pH 5\.6/g) || []).length).toBeGreaterThan(0);
    });

    test('sign 4 — the decisions carry whether pH was measured; zero is a measured pH', async () => {
        const none = await build(page, 'Perennial Ryegrass', MG_SHORT);
        const zero = await build(page, 'Perennial Ryegrass', Object.assign({}, MG_SHORT, { pH: 0 }));
        const six = await build(page, 'Perennial Ryegrass', Object.assign({}, MG_SHORT, { pH: 6.5 }));
        const of = (d) => { const m = d.data._soilVerdicts.elements.Mg.decision || {}; return { phMeasured: m.phMeasured, pH: m.pH }; };
        say('[gh821] Mg decision pH fields: ' + JSON.stringify({ none: of(none), zero: of(zero), six: of(six) }));
        expect(of(none)).toEqual({ phMeasured: false, pH: null });
        expect(of(zero).phMeasured).toBe(true);
        expect(of(zero).pH).toBe(0);
        expect(of(six)).toEqual({ phMeasured: true, pH: 6.5 });
    });

    test('sign 5 — Ca:Mg high and magnesium below the floor without pH: the ratio says below, not above', async () => {
        const states = {
            needs_reading: MG_SHORT,
            apply: Object.assign({}, MG_SHORT, { pH: 6.5 }),
        };
        const below = {};
        for (const name of Object.keys(states)) {
            const d = await build(page, 'Perennial Ryegrass', states[name]);
            const status = d.data._soilVerdicts.elements.Mg.status;
            below[status] = { below: /Mg sits below the sufficiency floor/.test(d.text), above: /above the sufficiency floor/.test(d.text) };
        }
        say('[gh821] Ca:Mg > 10, Mg statuses and what the ratio says: ' + JSON.stringify(below));
        // The list of statuses that enter "Mg below the floor", compared as a list.
        expect(Object.keys(below).filter((k) => below[k].below && !below[k].above).sort()).toEqual(['apply', 'needs_reading']);
    });

    test('sign 6 — no pH, no instruction about pH, by the verdict\'s printing places', async () => {
        const PLACES = {
            lime: /(Apply agricultural lime|Consider lime application|Light lime application)/,
            covered_by_dolomite: /Dolomite application \(see Soil Nutrition recommendations\) will correct pH/,
            acidify: /^URGENT: Apply elemental sulphur or ammonium sulphate to acidify/,
        };
        const count = (d) => { const out = {}; Object.keys(PLACES).forEach((k) => {
            out[k] = d.parts.filter((p) => !p.inTable && PLACES[k].test(p.text.trim().replace(/^•\s*/, ''))).length; }); return out; };
        const got = {};
        for (const sp of ['Perennial Ryegrass', 'Couch']) {
            const d = await build(page, sp, S_SHORT);
            got[sp] = { verdict: d.data._soilVerdicts.pH.status, found: count(d) };
        }
        const lime = await build(page, 'Perennial Ryegrass', Object.assign({}, S_SHORT, { pH: 5.3 }));
        const light = await build(page, 'Couch', Object.assign({}, S_SHORT, { pH: 5.99 }));
        const acid = await build(page, 'Perennial Ryegrass', Object.assign({}, S_SHORT, { pH: 7.8 }));
        const controls = { 'Perennial Ryegrass @ 5.3': count(lime), 'Couch @ 5.99': count(light), 'Perennial Ryegrass @ 7.8': count(acid) };
        say('[gh821] no pH — verdict and instructions found by status: ' + JSON.stringify(got));
        say('[gh821] controls: ' + JSON.stringify(controls));
        const zero = { lime: 0, covered_by_dolomite: 0, acidify: 0 };
        expect(got).toEqual({ 'Perennial Ryegrass': { verdict: 'not_measured', found: zero }, 'Couch': { verdict: 'not_measured', found: zero } });
        expect(controls).toEqual({ 'Perennial Ryegrass @ 5.3': { lime: 1, covered_by_dolomite: 0, acidify: 0 },
            'Couch @ 5.99': { lime: 1, covered_by_dolomite: 0, acidify: 0 }, 'Perennial Ryegrass @ 7.8': { lime: 0, covered_by_dolomite: 0, acidify: 1 } });
    });
});

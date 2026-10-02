/**
 * GH-810 (queue item 3gy, client requirement R2, delivery 3, water half) — GYPSUM NAMED ONCE, AND
 * ONE LEVEL PER WATER READING.
 *
 * The owner's decisions of 01.10, in force: gypsum by water follows threshold set 2, which depends
 * on the grass; the rates go and the instruction stays; the level words of EC and SAR from
 * "warning" up follow set 2 as well, and the lower steps stay as they were.
 *
 * Every assertion is read off the built document. The expected words come from the plan's table of
 * levels per case, not from comparing two sections with each other: two sections that drifted
 * together agree, and that agreement proves nothing.
 *
 * WHAT THIS FILE DOES NOT PROVE, named rather than implied:
 *   - the soil verdict of delivery 1 is not re-asserted here; its own file does that.
 *   - the pH verdict by species (the other half of this delivery) is not in this file.
 *   - every case is exported as Test5 - NZ with its own water and grass put in; another site's
 *     configuration is not exercised.
 *   - set 2's numbers have no declared origin in the code; giving them one is item 3ge's work.
 */
'use strict';

const { loadPage, SITE_ID } = require('./helpers/export-page-sandbox');
const { documentParts, flatText } = require('./helpers/word-document-reading');

const C3 = 'Perennial Ryegrass';
const C4 = 'Kikuyu';

/**
 * Water whose SAR is exactly what the case names: with Ca 20 and Mg 12.15 mg/L both are 1 meq/L, so
 * the export's own SAR formula reduces to Na/23. Bicarbonate 55 keeps RSC negative and HCO3 under
 * every bicarbonate threshold, so no case raises the bicarbonate cause unless it asks for it.
 */
function water(ec, sar, extra) {
    return Object.assign({ pH: 7.2, EC: ec, Ca: 20, Mg: 12.15, Na: +(sar * 23).toFixed(4), K: 4, Cl: 44,
        SO4: 12, HCO3: 55, CO3: 1, B: 0.2, Fe: 0.3, NO3: 2, PO4: 0.5, Mn: 0.1 }, extra || {});
}
/** The fixture's own water, put back explicitly so the control is not whatever the last case left. */
const FIXTURE_WATER = { pH: 7.2, EC: 0.41, Ca: 22, Mg: 11, Na: 33, K: 4, Cl: 44, SO4: 12, HCO3: 55,
    CO3: 1, B: 0.2, Fe: 0.3, NO3: 2, PO4: 0.5, Mn: 0.1 };
/** Soil 141, the fixture's own: calcium adequate, so no soil-verdict gypsum enters the document. */
const SOIL_141 = { B: 0.2, K: 40, P: 40, S: 75, Ca: 803, Cu: 1.3, EC: 0.16, Fe: 168, Mg: 129, Mn: 28.3,
    OM: 3.7, Zn: 5.7, pH: 6, CEC: 5.9 };

const SCENARIOS = [
    // The plan's nine cases of water-level words.
    { name: 'L1', species: C3, water: water(1.8, 2) },
    { name: 'L2', species: C3, water: water(2.2, 2) },
    { name: 'L3', species: C4, water: water(2.2, 2) },
    { name: 'L4', species: C3, water: water(2.2, 5) },
    { name: 'L5', species: C4, water: water(2.2, 5) },
    { name: 'L6', species: C3, water: water(1.2, 7.8) },
    { name: 'L7', species: C3, water: water(2.2, 7.8) },
    { name: 'L8', species: C3, water: water(1.5, 4) },
    { name: 'L9', species: C3, water: FIXTURE_WATER },
    // The gypsum cases of the plan's addendum, with C3 and C4 both, so that a set that ignores the
    // grass is distinguishable (the reviewer's requirement 4).
    { name: 'W', species: C3, water: water(1.8, 7.8) },
    { name: 'W2', species: C3, water: water(1.2, 7.8) },
    // Sign 4, "the same water, the grass decides". The plan wrote EC 2.2 for it, but at 2.2 a C4 site
    // is still marginal (set 2's C4 warning is 2.5) and the plan's own level table says so for its
    // case 3; at 3.0 a C3 site is past critical (source change, no gypsum by EC) and a C4 site is at
    // warning (gypsum). Same intent, a number that reaches both branches.
    { name: 'EC3-C3', species: C3, water: water(3.0, 2) },
    { name: 'EC3-C4', species: C4, water: water(3.0, 2) },
    { name: 'SAR7-C3', species: C3, water: water(0.4, 7) },
    { name: 'SAR7-C4', species: C4, water: water(0.4, 7) },
    // Bicarbonate 150 with SAR low: the cause the Soil x Water section used (HCO3 > 120). RSC stays
    // under 1.25, so it is this cause and no other.
    { name: 'BIC', species: C3, water: water(0.4, 2, { HCO3: 150 }) },
    // Tissue magnesium low, for the two Epsom instructions that lose their rate.
    { name: 'TISSUE-MG', species: C3, water: FIXTURE_WATER,
      tissue: { N: 4.57, P: 0.62, K: 2.0, Ca: 0.4, Mg: 0.08, S: 0.4 } },
    // And with tissue potassium above its range: the only condition under which Performance Impact
    // prints its Epsom line (low tissue Mg, adequate soil Mg, high tissue K -- read off the code).
    { name: 'TISSUE-MG-K', species: C3, water: FIXTURE_WATER,
      tissue: { N: 4.57, P: 0.62, K: 4.0, Ca: 0.4, Mg: 0.08, S: 0.4 } }
];

/**
 * The plan's table of level words, one row per case, written out from the plan rather than computed:
 * these are the words the owner's decision says the client reads. `null` means the section says
 * nothing about that indicator.
 */
const LEVELS = {
    L1: { water: { EC: 'is elevated', SAR: 'is excellent' }, pa: { EC: 'warning', SAR: null },
          table: { EC: 'red', SAR: 'green' }, sw: { osmotic: 'approaches', priority: false, dispersion: false, sodium: null },
          pi: { sar: null, salinity: true } },
    L2: { water: { EC: 'exceeds safe limits', SAR: 'is excellent' }, pa: { EC: 'critical', SAR: null },
          table: { EC: 'red', SAR: 'green' }, sw: { osmotic: 'exceeds', priority: true, dispersion: false, sodium: null },
          pi: { sar: null, salinity: true } },
    L3: { water: { EC: 'is in the marginal range', SAR: 'is excellent' }, pa: { EC: null, SAR: null },
          table: { EC: 'amber', SAR: 'green' }, sw: { osmotic: null, priority: false, dispersion: false, sodium: null },
          pi: { sar: null, salinity: false } },
    L4: { water: { EC: 'exceeds safe limits', SAR: 'is elevated' }, pa: { EC: 'critical', SAR: 'warning' },
          table: { EC: 'red', SAR: 'red' }, sw: { osmotic: 'exceeds', priority: true, dispersion: false, sodium: 'Sodium Accumulation' },
          pi: { sar: 'elevated', salinity: true } },
    L5: { water: { EC: 'is in the marginal range', SAR: 'is moderate' }, pa: { EC: null, SAR: null },
          table: { EC: 'amber', SAR: 'amber' }, sw: { osmotic: null, priority: false, dispersion: false, sodium: null },
          pi: { sar: null, salinity: false } },
    L6: { water: { EC: 'is in the marginal range', SAR: 'is very high' }, pa: { EC: null, SAR: 'critical' },
          table: { EC: 'amber', SAR: 'red' }, sw: { osmotic: null, priority: false, dispersion: 'very high', sodium: null },
          pi: { sar: 'very high', salinity: false } },
    L7: { water: { EC: 'exceeds safe limits', SAR: 'is very high' }, pa: { EC: 'critical', SAR: 'critical' },
          table: { EC: 'red', SAR: 'red' }, sw: { osmotic: 'exceeds', priority: true, dispersion: false, sodium: 'Critical Sodium Hazard' },
          pi: { sar: 'very high', salinity: true } },
    L8: { water: { EC: 'is in the marginal range', SAR: 'is moderate' }, pa: { EC: null, SAR: null },
          table: { EC: 'amber', SAR: 'amber' }, sw: { osmotic: null, priority: false, dispersion: false, sodium: null },
          pi: { sar: null, salinity: false } },
    L9: { water: { EC: 'very low', SAR: 'is excellent' }, pa: { EC: null, SAR: null },
          table: { EC: 'green', SAR: 'green' }, sw: { osmotic: null, priority: false, dispersion: false, sodium: null },
          pi: { sar: null, salinity: false } }
};
const COLOUR = { '16A34A': 'green', 'F59E0B': 'amber', 'DC2626': 'red' };

function inSection(parts, re) { return parts.filter((p) => re.test(p.section || '')); }
function textOf(parts, re) { return inSection(parts, re).map((p) => p.text).join('\n'); }

/** What each section of one document says about the water's EC and SAR. */
function levelsRead(parts) {
    const water = textOf(parts, /^Water Quality/);
    const pa = textOf(parts, /^Priority Actions$/);
    const sw = textOf(parts, /^Soil × Water/);
    const pi = textOf(parts, /^Performance Impact/);
    const ecWords = ['very low', 'within the safe range', 'is in the marginal range', 'is elevated', 'exceeds safe limits'];
    const sarWords = ['is excellent', 'is moderate', 'is elevated', 'is very high'];
    const ecLine = (water.match(/(Electrical conductivity \(EC\)|EC \()[^\n]*/) || [''])[0];
    const sarLine = (water.match(/SAR \([\d.]+\)[^\n]*/) || [''])[0];
    // The table's value cell for a row is the part after the label in the same row.
    const cell = (label) => {
        const rows = inSection(parts, /^Water Quality/).filter((p) => p.inTable);
        const i = rows.findIndex((p) => p.text.trim() === label);
        if (i < 0 || !rows[i + 1] || rows[i + 1].row !== rows[i].row) return null;
        const c = rows[i + 1].colors.map((x) => COLOUR[x]).filter(Boolean);
        return c[0] || null;
    };
    const osm = (sw.match(/Water EC of [\d.]+ dS\/m (approaches|exceeds) the [^(]+\(([\d.]+) dS\/m\)/) || null);
    const disp = sw.match(/The combination of (elevated|very high) SAR/);
    return {
        water: { EC: ecWords.filter((w) => ecLine.indexOf(w) >= 0).pop() || null,
                 SAR: sarWords.filter((w) => sarLine.indexOf(w) >= 0).pop() || null },
        pa: { EC: /CRITICAL: Water EC/.test(pa) ? 'critical' : (/Water EC \([^)]*\) approaching/.test(pa) ? 'warning' : null),
              SAR: /CRITICAL: SAR/.test(pa) ? 'critical' : (/SAR elevated \(/.test(pa) ? 'warning' : null) },
        table: { EC: cell('EC'), SAR: cell('SAR') },
        sw: { osmotic: osm ? osm[1] : null, priority: /PRIORITY: Reduce water EC/.test(sw),
              dispersion: disp ? disp[1] : false,
              sodium: /Critical Sodium Hazard/.test(sw) ? 'Critical Sodium Hazard'
                  : (/Sodium Accumulation/.test(sw) ? 'Sodium Accumulation' : null),
              osmoticBoundary: osm ? osm[2] : null },
        pi: { sar: (pi.match(/The (elevated|very high) sodium adsorption ratio/) || [null, null])[1],
              salinity: /elevated salinity of the irrigation water/.test(pi) || /salinity stress/.test(pi) }
    };
}

/**
 * The gypsum instructions of one document, by section, outside the glossary and references.
 *
 * GH-815: the executive summary now carries the Priority Actions' own lines, by the owner's decision about
 * the first line of the report. A gypsum item of the summary that is a Priority Actions line word for word
 * is that one instruction quoted, not a second one, and is left out here. Anything else the summary says
 * about gypsum -- other words, or an item with no line behind it in Priority Actions -- stays in the list.
 * And the count is part of the quotation: the summary's gypsum items must be the Priority Actions' gypsum
 * lines as many times as they are there, so a line quoted twice is two instructions and stays in the list
 * (the lower bound of "named once", which the reviewer found lost in the first hand-in).
 */
function gypsumLines(parts) {
    const all = parts.filter((p) => /gypsum/i.test(p.text) && !p.inTable
            && !/^(References|Glossary|Contents)/.test(p.section || ''))
        .map((p) => ({ section: p.section || '?', text: p.text.trim().replace(/\s+/g, ' ') }));
    const priorityLines = all.filter((l) => l.section === 'Priority Actions')
        .map((l) => l.text.replace(/^•\s*/, '').replace(/\.$/, ''));
    return all.filter((l) => !summaryQuotesOnly(l.text, priorityLines));
}
function summaryQuotesOnly(text, priorityLines) {
    const m = text.match(/^EXECUTIVE SUMMARY: (?:ATTENTION REQUIRED|Items to monitor): (.*)\.$/);
    if (!m) return false;
    const gypsumItems = m[1].split('. ').filter((i) => /gypsum/i.test(i));
    const priorityGypsum = priorityLines.filter((l) => /gypsum/i.test(l));
    return gypsumItems.length > 0
        && JSON.stringify(gypsumItems.slice().sort()) === JSON.stringify(priorityGypsum.slice().sort());
}

async function build(page, sc) {
    page.putSiteSpecies(sc.species);
    page.putSoilReadings(sc.soil || SOIL_141);
    page.putWaterReadings(sc.water);
    if (sc.tissue) page.putTissueReadings(sc.tissue);
    const data = page.sandbox.GAIP_WordExport.collectData(
        page.sandbox.GAIP_NutritionProgramInputs.resolveExportInputs({ siteId: SITE_ID }));
    const parts = await documentParts(page.sandbox, data);
    return { data: data, parts: parts, text: flatText(parts) };
}

function say(s) { process.stdout.write(s + '\n'); }

describe('GH-810 — gypsum named once, one level per water reading', () => {
    jest.setTimeout(300000);
    let page;
    const docs = {};

    beforeAll(async () => {
        page = loadPage({ errors: [], warnings: [], alerts: [] });
        expect(page.failures).toEqual([]);
        for (const sc of SCENARIOS) docs[sc.name] = await build(page, sc);
    });

    test('what each case printed about its water', () => {
        expect.hasAssertions();
        Object.keys(docs).forEach((name) => {
            const d = docs[name];
            const gv = d.data._gypsumVerdict;
            say('[gh810] ' + name + ' basis ' + gv.basis + ' EC ' + JSON.stringify(gv.EC) + ' SAR '
                + JSON.stringify(gv.SAR) + ' gypsum ' + JSON.stringify(gv.gypsum));
            d.parts.filter((p) => /EC|SAR|sodium|salinity|Osmotic|Sodicity|gypsum/i.test(p.text)
                    && !/^(References|Glossary|Contents)/.test(p.section || ''))
                .forEach((p) => say('    [' + (p.section || '?') + (p.inTable ? ' T ' + p.colors.join(',') : '')
                    + '] ' + p.text.trim().replace(/\s+/g, ' ').slice(0, 170)));
        });
        expect(Object.keys(docs).length).toBe(SCENARIOS.length);
    });

    test('levels — every section names the level the plan\'s table names, case by case', () => {
        expect.hasAssertions();
        const read = {};
        Object.keys(LEVELS).forEach((name) => { read[name] = levelsRead(docs[name].parts); });
        Object.keys(read).forEach((n) => say('[gh810] levels ' + n + ': ' + JSON.stringify(read[n])));
        // The list of every case and section that disagrees with the plan's table, compared whole:
        // a mutation is then seen in EVERY case it reaches, and not only in the first one -- which
        // is what shows that the dispersion adjective reddens case 6 and leaves case 7 alone.
        const mismatch = {};
        Object.keys(LEVELS).forEach((name) => {
            const want = LEVELS[name];
            const got = read[name];
            const seen = {
                water: got.water, pa: got.pa, table: got.table,
                sw: { osmotic: got.sw.osmotic, priority: got.sw.priority, dispersion: got.sw.dispersion, sodium: got.sw.sodium },
                pi: got.pi
            };
            Object.keys(seen).forEach((section) => {
                if (JSON.stringify(seen[section]) !== JSON.stringify(want[section])) {
                    (mismatch[name] = mismatch[name] || {})[section] = { read: seen[section], plan: want[section] };
                }
            });
        });
        say('[gh810] levels — cases that differ from the plan\'s table: ' + JSON.stringify(Object.keys(mismatch)));
        expect(mismatch).toEqual({});
        // The number in the osmotic sentence is the boundary the reading approaches or crossed --
        // set 2's critical for this basis -- not the growth model's own threshold.
        expect([read.L1.sw.osmoticBoundary, read.L2.sw.osmoticBoundary]).toEqual(['2', '2']);
        // The universe: every case built a water section and read both indicators off it.
        Object.keys(LEVELS).forEach((name) => {
            expect([name, read[name].water.EC !== null, read[name].water.SAR !== null]).toEqual([name, true, true]);
        });
    });

    test('gypsum — named once, in Priority Actions, by the grass, and nowhere when there is no cause', () => {
        expect.hasAssertions();
        const lines = {};
        Object.keys(docs).forEach((name) => { lines[name] = gypsumLines(docs[name].parts); });
        Object.keys(lines).forEach((n) => say('[gh810] gypsum ' + n + ': ' + JSON.stringify(lines[n])));
        const pa = (name) => lines[name].filter((l) => l.section === 'Priority Actions').map((l) => l.text);
        const elsewhere = (name) => lines[name].filter((l) => l.section !== 'Priority Actions');
        // Exactly one line in Priority Actions where there is a cause -- the lower bound the plan
        // added after GH-808 -- and the exact words, so that "one line" is not met by another one.
        expect(pa('W')).toEqual(['• Apply gypsum immediately to protect Perennial Ryegrass and implement leaching program.']);
        expect(pa('W2')).toEqual(['• Apply gypsum immediately to protect Perennial Ryegrass.']);
        expect(pa('BIC')).toEqual(['• Apply gypsum to offset calcium removal.']);
        // The grass decides: the same water, two answers.
        expect(pa('EC3-C3')).toEqual([]);
        expect(pa('EC3-C4')).toEqual(['• Apply gypsum and implement leaching program.']);
        expect(pa('SAR7-C3')).toEqual(['• Apply gypsum immediately to protect Perennial Ryegrass.']);
        expect(pa('SAR7-C4')).toEqual(['• Apply gypsum to protect Kikuyu.']);
        // And on EC past critical the source is what the client is told about, not gypsum.
        expect(textOf(docs['EC3-C3'].parts, /^Priority Actions$/)).toMatch(/Source blending or alternative supply/);
        // Nowhere else: no other section names gypsum for this water. Soil 141 has calcium enough,
        // so no gypsum of the soil verdict is in these documents either.
        ['W', 'W2', 'BIC', 'EC3-C3', 'EC3-C4', 'SAR7-C3', 'SAR7-C4', 'L1', 'L4', 'L6', 'L7'].forEach((name) => {
            expect([name, elsewhere(name)]).toEqual([name, []]);
        });
        // The positive control: the fixture's water raises no cause, so there is no gypsum at all --
        // and the document is a real one, with a water section that read the water.
        expect([lines.L9, docs.L9.data._gypsumVerdict.gypsum.level]).toEqual([[], 'none']);
        expect(textOf(docs.L9.parts, /^Water Quality/)).toMatch(/is very low at 0\.41 dS\/m/);
    });

    test('gypsum — the summary quoting the Priority Actions line once is a quotation, twice is two instructions', () => {
        expect.hasAssertions();
        const PA = ['Apply gypsum immediately to protect Perennial Ryegrass'];
        const verdicts = {
            'one verbatim quote': summaryQuotesOnly('EXECUTIVE SUMMARY: ATTENTION REQUIRED: Apply gypsum immediately to protect Perennial Ryegrass.', PA),
            'two verbatim quotes': summaryQuotesOnly('EXECUTIVE SUMMARY: ATTENTION REQUIRED: Apply gypsum immediately to protect Perennial Ryegrass. Apply gypsum immediately to protect Perennial Ryegrass.', PA),
            'reworded': summaryQuotesOnly('EXECUTIVE SUMMARY: ATTENTION REQUIRED: Gypsum is advised.', PA),
            'not a summary line': summaryQuotesOnly('Apply gypsum immediately to protect Perennial Ryegrass.', PA)
        };
        say('[gh810] summary quote helper, left out as a quotation: ' + JSON.stringify(verdicts));
        expect(verdicts).toEqual({ 'one verbatim quote': true, 'two verbatim quotes': false, 'reworded': false, 'not a summary line': false });
    });

    test('gypsum — one urgency, and no rate anywhere near it', () => {
        expect.hasAssertions();
        const RATE_NEAR_GYPSUM = /gypsum[^.]{0,60}?\d+(?:\.\d+)?\s*(?:[-\u2013]\s*\d+(?:\.\d+)?\s*)?(?:t|kg)\b[^.]{0,12}\/ha|\d+(?:\.\d+)?\s*(?:[-\u2013]\s*\d+(?:\.\d+)?\s*)?(?:t|kg)\b[^.]{0,12}\/ha[^.]{0,40}gypsum/i;
        const offenders = {};
        Object.keys(docs).forEach((name) => {
            const found = docs[name].parts.filter((p) => !/^(References|Glossary|Contents)/.test(p.section || ''))
                .filter((p) => RATE_NEAR_GYPSUM.test(p.text)).map((p) => (p.section || '?') + ' :: ' + p.text.trim().slice(0, 140));
            if (found.length) offenders[name] = found;
        });
        say('[gh810] a number with t/ha or kg/ha near gypsum, outside the glossary: ' + JSON.stringify(offenders));
        expect(offenders).toEqual({});
        // One urgency on W2: "immediately" exactly once in Priority Actions, and no "annually" or
        // "URGENT" about gypsum anywhere.
        // The list of lines that say "immediately", not their count: one line, and it is the gypsum one.
        const immediatelyW2 = inSection(docs.W2.parts, /^Priority Actions$/)
            .filter((p) => /immediately/.test(p.text)).map((p) => p.text.trim());
        expect(immediatelyW2).toEqual(['• Apply gypsum immediately to protect Perennial Ryegrass.']);
        const urgencyWords = docs.W2.parts.filter((p) => /gypsum/i.test(p.text) && /annually|URGENT/.test(p.text))
            .map((p) => p.text.trim());
        expect(urgencyWords).toEqual([]);
        // The universe for "nowhere": W2's document does carry gypsum, once, and this is it.
        expect(gypsumLines(docs.W2.parts)).toEqual([{ section: 'Priority Actions',
            text: '• Apply gypsum immediately to protect Perennial Ryegrass.' }]);
    });

    test('the number went and the instruction stayed — the Epsom lines on low tissue magnesium', () => {
        expect.hasAssertions();
        const t = docs['TISSUE-MG'].text;
        const epsom = docs['TISSUE-MG'].parts.filter((p) => /magnesium sulphate|Epsom/i.test(p.text)
                && !/^(References|Glossary|Contents)/.test(p.section || '') && !p.inTable)
            .map((p) => (p.section || '?') + ' :: ' + p.text.trim().replace(/\s+/g, ' ').slice(0, 160));
        say('[gh810] Epsom lines on low tissue Mg: ' + JSON.stringify(epsom));
        // The instruction is there (the reviewer's requirement 5: "no number" is also met by an
        // empty document, so the line itself is asserted) ...
        expect(t).toContain('Apply magnesium sulphate (Epsom salt) as foliar spray or granular application.');
        // ... and no Epsom line carries a rate.
        expect(epsom.filter((l) => /\d+(?:\.\d+)?\s*(?:[-\u2013]\s*\d+(?:\.\d+)?\s*)?kg\b[^.]{0,12}\/ha/.test(l))).toEqual([]);
        // The second one, in Performance Impact: same two halves.
        const pi = textOf(docs['TISSUE-MG-K'].parts, /^Performance Impact/);
        say('[gh810] Performance Impact on low tissue Mg and high tissue K: '
            + JSON.stringify((pi.match(/[^\n]*magnesium sulphate[^\n]*/g) || [])));
        expect(pi).toContain('apply foliar magnesium sulphate until tissue Mg recovers');
        expect(pi).not.toMatch(/magnesium sulphate \(\d/);
    });

    test('the census of who gives an amendment rate to the document, both ways', () => {
        expect.hasAssertions();
        /**
         * The reviewer's requirement 6: a list taken from the code and compared both ways, rather
         * than a claim that nothing reads the gypsum requirement calculated from ESP.
         *
         * Way one -- every line of the two export files that writes an amendment product next to a
         * rate written as a number is a declared source. After this delivery the declared list of
         * LITERAL rates is empty: every rate the document prints is computed by the decision
         * function and formatted from its result.
         *
         * Way two -- every declared computed source exists and is called, and the sources that must
         * not reach the document (the gypsum requirement by ESP, which rests on a substituted 20 %
         * clay; the amendment engine removed in GH-808) are not read by either file.
         */
        const fs = require('fs');
        const path = require('path');
        const strip = (src) => src.replace(/\/\*[\s\S]*?\*\//g, '').split('\n')
            .map((l) => l.replace(/(^|[^:'"])\/\/.*$/, '$1')).join('\n');
        const files = ['word-export.js', 'word-export-combined.js'];
        const AMENDMENT = /gypsum|\blime\b|dolomit|kieserite|epsom|magnesium sulphate/i;
        const LITERAL_RATE = /\d+(?:\.\d+)?\s*(?:[-\u2013]\s*\d+(?:\.\d+)?\s*)?(?:t|kg)\b[^\/\n]{0,20}\/ha/i;
        const found = [];
        let scanned = 0;
        files.forEach((f) => {
            strip(fs.readFileSync(path.join(__dirname, '..', 'assets', f), 'utf8')).split('\n').forEach((l, i) => {
                if (!AMENDMENT.test(l)) return;
                scanned++;
                if (LITERAL_RATE.test(l)) found.push(f + ':' + (i + 1) + ' ' + l.trim().slice(0, 100));
            });
        });
        say('[gh810] census — code lines naming an amendment: ' + scanned + '; with a literal rate: ' + JSON.stringify(found));
        const DECLARED_LITERAL_RATES = [];
        expect(found).toEqual(DECLARED_LITERAL_RATES);
        // The search can find what it looks for: the sentence Delivery 1 removed, tested by the same
        // two expressions. Without this an expression that never matches passes the line above.
        const removed = "recommendations.push('Apply agricultural lime at 1-2 t/ha to raise pH toward ' + rangeStr + '.');";
        expect([AMENDMENT.test(removed), LITERAL_RATE.test(removed)]).toEqual([true, true]);
        expect(scanned).toBeGreaterThan(20);

        const code = files.map((f) => strip(fs.readFileSync(path.join(__dirname, '..', 'assets', f), 'utf8'))).join('\n');
        const DECLARED_COMPUTED_SOURCES = ['_buildSoilVerdicts', '_computeAmendmentDecision',
            '_amendmentDecisionsToProducts', '_synthesiseKReconDecision'];
        const called = DECLARED_COMPUTED_SOURCES.filter((n) => new RegExp('\\b' + n + '\\(').test(code));
        expect(called).toEqual(DECLARED_COMPUTED_SOURCES);
        const MUST_NOT_REACH = ['soilStructure', 'calcGypsumRequirement', 'GAIP_STRUCTURE_RESULT',
            'management.gypsum', 'recommendSoilAmendments', 'GilbaSoilTissueIntegration'];
        const reached = MUST_NOT_REACH.filter((n) => code.indexOf(n) !== -1);
        say('[gh810] census — computed sources called: ' + JSON.stringify(called) + '; forbidden sources read: ' + JSON.stringify(reached));
        expect(reached).toEqual([]);
    });

    test('no "Recommendations:" heading stands over nothing', () => {
        expect.hasAssertions();
        const empty = {};
        Object.keys(docs).forEach((name) => {
            const ps = docs[name].parts;
            ps.forEach((p, i) => {
                if (p.text.trim() !== 'Recommendations:') return;
                const next = ps[i + 1];
                if (!next || !/^•/.test(next.text.trim())) (empty[name] = empty[name] || []).push(p.section || '?');
            });
        });
        say('[gh810] "Recommendations:" with no bullet after it: ' + JSON.stringify(empty));
        expect(empty).toEqual({});
        // Universe: L6 lost its water-section gypsum instructions and still has a heading with bullets.
        expect(textOf(docs.L6.parts, /^Water Quality/)).toMatch(/Recommendations:/);
    });
});

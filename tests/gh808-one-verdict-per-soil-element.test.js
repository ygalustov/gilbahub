/**
 * GH-808 (queue item 3gy, client requirement R2, part 1) — ONE VERDICT PER SOIL ELEMENT.
 *
 * The client asked for two things: "Amendment rates come from the computed deficit and the
 * reconciliation table, never from a literal", and "two sections must not be able to disagree".
 * Today a decision about one element of the soil is taken in eight places of the report, each with
 * its own floor, its own pH boundary and its own idea of what "enough" means; the places with no
 * computed rate to print write a literal instead.
 *
 * Every assertion below is read off the DOCUMENT a client opens -- which section said what, about
 * which element, with which product and which rate. None of them names a function, so a section
 * that stops deciding for itself and starts printing the report's one verdict keeps them green,
 * and a rename does not touch them.
 *
 * WHAT THIS FILE DOES NOT PROVE, named rather than implied:
 *   - the gypsum and Epsom rates of the water and tissue sections are NOT asserted away here. The
 *     owner's decision of 01.10 removes them too, and that is part 3 of this work; the regexps
 *     below name the three soil amendments this part removes (lime, dolomite, kieserite) and
 *     nothing else.
 *   - the pH substitution -- a product chosen from pH 7.0 on a sample that reports no pH -- is
 *     part 2. Case synthetic-C exports that sample and is asserted only on the signs that hold
 *     whatever the owner decides the words should be; the band sentence it prints today is
 *     recorded by the printing case, not forbidden.
 *   - every case resolves the Hill Labs S277 certificate, because every case is exported as
 *     Test5 - NZ. An S81 sample takes the %BS axis, where the table refuses to compute at all;
 *     there is no S81 record on the stand and the plan names that as a boundary of its measurement.
 *   - the document is built in this sandbox from the page's own modules. It is not a client's
 *     downloaded file, and a live export is a separate sign of this delivery.
 */
'use strict';

const fs = require('fs');
const path = require('path');
const { loadPage, SITE_ID } = require('./helpers/export-page-sandbox');
const { documentParts, tableRowsUnder } = require('./helpers/word-document-reading');

const FIXTURE = JSON.parse(fs.readFileSync(
    path.join(__dirname, 'fixtures', 'gh808-soil-verdict-cases.json'), 'utf8'));
const CASES = FIXTURE.cases;
/** GH-821: the status cell of a row whose product is not chosen because the sample reports no pH. */
const NO_PH_STATUS = /^pH was not reported on this sample, so the product is not chosen; deficit [\d.]+ kg (Mg|S)\/ha$/;

/**
 * The sections in which a decision about a soil element reaches the client. Taken from the
 * documents themselves (printed by the last case below), not from a list in my head: the heading
 * of the soil section carries the methodology and the sample label, so it is matched by its stem.
 */
const SOIL_DECISION_SECTIONS = [
    /^Soil Nutrition/, /^Cation Balance Analysis$/, /^Priority Actions$/,
    /^Soil Amendment Recommendations$/
];
/** Where a word may be explained rather than recommended. */
const PROSE_SECTIONS = [/^References & Methodology$/, /^Glossary of Terms$/, /^Contents$/];

const isSoilDecisionSection = (s) => !!s && SOIL_DECISION_SECTIONS.some((re) => re.test(s));
const isProseSection = (s) => !!s && PROSE_SECTIONS.some((re) => re.test(s));

/**
 * The amendment this part of the work takes the rate off. Gypsum and Epsom are deliberately absent:
 * their rates are part 3's subject, and a regexp here that caught them would make this file green
 * on work it has not done.
 */
const SOIL_AMENDMENTS_OF_THIS_PART = /\b(agricultural lime|lime|dolomite|dolomitic|kieserite)\b/i;
/** A rate printed as a range: "1-2 t/ha", "200-400 kg/ha Mg", "1.5 - 3 t/ha". */
const RATE_AS_A_RANGE = /\d+(?:\.\d+)?\s*[-–]\s*\d+(?:\.\d+)?\s*(?:t|kg)\b[^.;]{0,20}\/ha/i;

/** An imperative: the line tells the client to do something, rather than describing. */
const IS_AN_INSTRUCTION = /(^|[\s•])(apply|consider|use|increase|reduce|implement)\b/i;

/**
 * Which element a named product supplies, as the report itself names them. Lime is NOT here: the
 * report treats it as the pH amendment and says so in the calcium decision's own words ("lime would
 * also raise pH but is NOT chosen here"), so it gets its own verdict and its own case below.
 */
const PRODUCTS_BY_ELEMENT = {
    P: [/\bMAP\b/, /\bDAP\b/, /monoammonium/i, /diammonium/i, /superphosphate/i],
    K: [/potassium sulphate/i, /sulphate of potash/i, /muriate of potash/i, /\bMOP\b/, /\bSOP\b/],
    Ca: [/gypsum/i, /calcium nitrate/i],
    Mg: [/dolomite/i, /kieserite/i, /epsom/i, /magnesium sulphate/i],
    S: [/elemental sulphur/i, /sulphate of ammonia/i, /ammonium sulphate/i]
};
/**
 * Three things the first version of this file counted as a product choice and which are not, each
 * found by its own run rather than by reading:
 *
 *   - "Apply elemental sulphur or ammonium sulphate to acidify the rootzone" (case 104, pH 8.0) is
 *     the pH verdict's instrument, not a sulphur amendment. Same shape as lime at the other end of
 *     the scale, so it is excluded the same way and by the same test: a line about pH.
 *   - "Reduce potassium applications and supplement with foliar magnesium" is the K:Mg antagonism
 *     line. The plan leaves it where it is -- it is requirement R3's subject, not R2's -- and it
 *     names foliar magnesium as a counter-measure to high potassium rather than as the magnesium
 *     the soil is short of.
 *   - "potassium source" and "magnesium source" are not product names at all. A line that says
 *     "apply a potassium source (potassium sulphate preferred)" names the product the table chose,
 *     and judging it by the generic phrase made a consistent sentence look like a second verdict.
 */
const IS_A_PH_INSTRUCTION = /acidif|\bpH\b/i;
const IS_THE_ANTAGONISM_LINE = /Reduce potassium applications/i;
/**
 * A product named in a comparison is not a product the report tells the client to apply. The
 * magnesium decision explains its own choice by naming the one it did not make -- "Kieserite chosen
 * because it supplies Mg without further alkalising the soil (unlike dolomite)" -- and the first
 * version of this file read that as a second verdict. Found by its own run on case synthetic-C.
 */
const A_COMPARISON_NOT_AN_INSTRUCTION = /(unlike|rather than|instead of|not|than|vs\.?)\s+$/i;
function namedForApplication(re, text) {
    const m = re.exec(text);
    if (!m) return false;
    return !A_COMPARISON_NOT_AN_INSTRUCTION.test(text.slice(Math.max(0, m.index - 14), m.index));
}
const ELEMENT_NAMES = { P: 'Phosphorus', K: 'Potassium', Ca: 'Calcium', Mg: 'Magnesium', S: 'Sulphur' };

/** A twelve-month programme of one catalogue product, carrying no amendment of its own. */
function pageProgramme() {
    const months = ['January', 'February', 'March', 'April', 'May', 'June',
        'July', 'August', 'September', 'October', 'November', 'December'];
    return {
        monthly: months.map((m) => ({
            month_name: m,
            granular: [{ id: 'urea', name: 'Urea', analysis: { N: 46 }, rateKgHa: 50 }],
            liquid: []
        })),
        // No `meta.surfaceType`: with one the Monthly Schedule prints g/m², and the figures of this
        // file are then not the figures of the table it is compared against.
        meta: {}, strategy: {}, muldersFlags: {}
    };
}

/** The product cell and status cell of the table, by element, for one document. */
function tableVerdicts(parts) {
    const rows = tableRowsUnder(parts, 'Annual Soil Amendments');
    const out = {};
    Object.keys(ELEMENT_NAMES).forEach((el) => { out[el] = { status: 'no row', product: null }; });
    (rows || []).slice(1).forEach((r) => {
        const el = Object.keys(ELEMENT_NAMES).find((k) => r[0] === ELEMENT_NAMES[k] + ' (' + k + ')');
        if (!el) return;
        out[el] = { status: r[7] || null, product: r[4] === '-' ? null : r[4], theoretical: r[5], practical: r[6] };
    });
    return out;
}

function say(s) { process.stdout.write(s + '\n'); }

describe('GH-808 — one verdict per soil element, read off the document', () => {
    jest.setTimeout(300000);
    let page, we, npi;
    const docs = {};

    beforeAll(async () => {
        page = loadPage({ errors: [], warnings: [], alerts: [] });
        expect(page.failures).toEqual([]);
        we = page.sandbox.GAIP_WordExport;
        npi = page.sandbox.GAIP_NutritionProgramInputs;
        for (const c of CASES) {
            page.putSoilReadings(c.readings);
            const data = we.collectData(npi.resolveExportInputs({ siteId: SITE_ID }));
            const parts = await documentParts(page.sandbox, data);
            docs[c.name] = { parts: parts, verdicts: tableVerdicts(parts) };
        }
    });

    test('case 1 — no soil amendment rate is printed as a range', () => {
        expect.hasAssertions();
        const offenders = {};
        Object.keys(docs).forEach((name) => {
            const found = docs[name].parts
                .filter((p) => !isProseSection(p.section))
                .filter((p) => SOIL_AMENDMENTS_OF_THIS_PART.test(p.text) && RATE_AS_A_RANGE.test(p.text))
                .map((p) => (p.section || '?') + ' :: ' + p.text.trim().replace(/\s+/g, ' ').slice(0, 160));
            if (found.length) offenders[name] = found;
        });
        say('[gh808] case 1 — lines outside the glossary that name lime, dolomite or kieserite with a '
            + 'rate written as a range:');
        Object.keys(docs).forEach((n) => say('    ' + n + ': ' + ((offenders[n] || []).length
            ? JSON.stringify(offenders[n], null, 0) : 'none')));
        expect(offenders).toEqual({});
    });

    test('case 2 — one verdict per element: no section names a product the table did not choose', () => {
        expect.hasAssertions();
        const offenders = {};
        const seen = {};
        Object.keys(docs).forEach((name) => {
            const d = docs[name];
            const instructions = d.parts.filter((p) => isSoilDecisionSection(p.section)
                && !p.inTable && IS_AN_INSTRUCTION.test(p.text))
                .filter((p) => !IS_THE_ANTAGONISM_LINE.test(p.text));
            seen[name] = instructions.length;
            Object.keys(PRODUCTS_BY_ELEMENT).forEach((el) => {
                const chosen = d.verdicts[el].product;
                instructions.forEach((p) => {
                    if (el === 'S' && IS_A_PH_INSTRUCTION.test(p.text)
                        && !/sulphur deficiency|address S/i.test(p.text)) return;
                    const named = PRODUCTS_BY_ELEMENT[el].filter((re) => namedForApplication(re, p.text));
                    if (!named.length) return;
                    // The product the table chose may be repeated in prose: the Interpretation's
                    // sentence and the table's row are one decision formatted twice, and that is
                    // the shape this work keeps. A product the table did NOT choose is the defect,
                    // and so is any product at all when the table chose none.
                    const strangers = named.filter((re) => !(chosen && re.test(chosen)));
                    if (!strangers.length) return;
                    (offenders[name] = offenders[name] || []).push(el + ' — table says '
                        + JSON.stringify(d.verdicts[el]) + ' — but ' + (p.section || '?')
                        + ' says: ' + p.text.trim().replace(/\s+/g, ' ').slice(0, 150));
                });
            });
        });
        say('[gh808] case 2 — instructions inspected per case (outside the table, in the sections that '
            + 'decide about soil): ' + JSON.stringify(seen));
        Object.keys(docs).forEach((n) => say('    ' + n + ': ' + ((offenders[n] || []).length
            ? JSON.stringify(offenders[n], null, 0) : 'one verdict per element')));
        expect(offenders).toEqual({});
    });

    test('case 3 — one lime verdict: the report tells the client about lime at most once', () => {
        expect.hasAssertions();
        const counted = {};
        Object.keys(docs).forEach((name) => {
            counted[name] = docs[name].parts
                .filter((p) => isSoilDecisionSection(p.section) && !p.inTable)
                .filter((p) => /\blime\b/i.test(p.text) && IS_AN_INSTRUCTION.test(p.text))
                // The calcium decision explains why lime is not the product it chose; that clause is
                // part of the gypsum sentence and is not a second instruction about lime.
                .filter((p) => !/is NOT chosen here/i.test(p.text))
                .map((p) => (p.section || '?') + ' :: ' + p.text.trim().replace(/\s+/g, ' ').slice(0, 140));
        });
        say('[gh808] case 3 — lime instructions per case:');
        Object.keys(counted).forEach((n) => say('    ' + n + ' (' + counted[n].length + '): '
            + JSON.stringify(counted[n], null, 0)));
        const tooMany = {};
        Object.keys(counted).forEach((n) => { if (counted[n].length > 1) tooMany[n] = counted[n]; });
        expect(tooMany).toEqual({});
    });

    test('case 4 — the "Soil Amendment Recommendations" section is in no document', () => {
        expect.hasAssertions();
        const present = {};
        Object.keys(docs).forEach((name) => {
            const headings = docs[name].parts
                .filter((p) => p.heading != null && /^Soil Amendment Recommendations$/.test(p.text.trim()))
                .map((p) => 'heading level ' + p.heading);
            const contents = docs[name].parts
                .filter((p) => p.section === 'Contents' && /Soil Amendment Recommendations/.test(p.text))
                .map((p) => 'contents line');
            const both = headings.concat(contents);
            if (both.length) present[name] = both;
        });
        say('[gh808] case 4 — where the engine section still appears: ' + JSON.stringify(present));
        expect(present).toEqual({});
    });

    test('case 5 — positive control, both halves: the table still prints, and prints the same rows', () => {
        expect.hasAssertions();
        // The coarse half: the table is there, and the cases that had rows still have them. Without
        // it cases 1 to 4 all go green the moment the table stops printing.
        const shape = {};
        Object.keys(docs).forEach((name) => {
            const rows = tableRowsUnder(docs[name].parts, 'Annual Soil Amendments') || [];
            const noneSentence = docs[name].parts.some((p) => /No standalone soil amendments required/.test(p.text));
            shape[name] = { rows: Math.max(0, rows.length - 1), saysNoneRequired: noneSentence };
        });
        const expectedShape = {};
        Object.keys(FIXTURE.tableBaseline).forEach((name) => {
            expectedShape[name] = {
                rows: FIXTURE.tableBaseline[name].length,
                saysNoneRequired: FIXTURE.tableBaseline[name].length === 0
            };
        });
        say('[gh808] case 5 coarse — rows per case: ' + JSON.stringify(shape));
        expect(shape).toEqual(expectedShape);

        // The thin half: every cell of every row, against the figures measured before the work.
        const rowsNow = {};
        Object.keys(docs).forEach((name) => {
            rowsNow[name] = (tableRowsUnder(docs[name].parts, 'Annual Soil Amendments') || [])
                .slice(1).map((r) => r.slice(0, 8));
        });
        say('[gh808] case 5 thin — the table rows, cell by cell:');
        Object.keys(rowsNow).forEach((n) => say('    ' + n + ': ' + JSON.stringify(rowsNow[n])));
        expect(rowsNow).toEqual(FIXTURE.tableBaseline);
    });

    test('case 6 — the sections each case printed, and the verdict it read off the table', () => {
        expect.hasAssertions();
        say('[gh808] case 6 — what was inspected:');
        Object.keys(docs).forEach((name) => {
            const sections = Array.from(new Set(docs[name].parts
                .filter((p) => p.heading != null).map((p) => p.text.trim())));
            say('    ' + name + ' — sections: ' + JSON.stringify(sections));
            say('        verdicts off the table: ' + JSON.stringify(docs[name].verdicts));
        });
        // The universe is real: a run that built no document would print the same "none" as a run
        // that found no offender.
        Object.keys(docs).forEach((name) => {
            expect(docs[name].parts.length).toBeGreaterThan(50);
        });
    });

    test('case 9 — the words about sufficiency agree with the verdict, not only the products', () => {
        expect.hasAssertions();
        /**
         * Found by my own mutation run, and the reason it is here: cases 1 to 3 assert about
         * PRODUCTS and RATES, so restoring this section's private floor of 50 ppm left them all
         * green. The literal was gone, but the sentence was not -- "Mg sits below the sufficiency
         * floor" printed one paragraph under a table that called the same reading adequate. A client
         * reads the contradiction whether or not a product follows it, so the claim this file makes
         * ("two sections cannot disagree about one element") was wider than what it checked.
         */
        const CLAIMS = [
            { re: /Mg sits below the sufficiency floor/i, element: 'Mg', says: 'below' },
            { re: /Mg is above the sufficiency floor/i, element: 'Mg', says: 'above' },
            { re: /K is below the sufficiency floor/i, element: 'K', says: 'below' },
            { re: /K is above the sufficiency floor/i, element: 'K', says: 'above' },
            { re: /lift K above sufficiency floor/i, element: 'K', says: 'below' },
            { re: /lift Mg above sufficiency floor/i, element: 'Mg', says: 'below' }
        ];
        const offenders = {};
        const seen = {};
        Object.keys(docs).forEach((name) => {
            const d = docs[name];
            const verdicts = d.verdicts;
            seen[name] = [];
            d.parts.filter((p) => isSoilDecisionSection(p.section) && !p.inTable).forEach((p) => {
                CLAIMS.forEach((c) => {
                    if (!c.re.test(p.text)) return;
                    const status = verdicts[c.element].status;
                    // The table's own words for the same question.
                    // GH-821: a row with no product for want of a pH is below the floor too; its status cell is
                    // the sentence that says so.
                    const tableSaysBelow = status === 'Apply' || status === 'Monitor'
                        || /Suppressed/.test(status) || NO_PH_STATUS.test(status);
                    seen[name].push(c.element + ' ' + c.says + ' (table: ' + status + ')');
                    if ((c.says === 'below') !== tableSaysBelow) {
                        (offenders[name] = offenders[name] || []).push(c.element
                            + ' — the table says ' + JSON.stringify(status) + ' but ' + (p.section || '?')
                            + ' says ' + c.says + ': ' + p.text.trim().replace(/\s+/g, ' ').slice(0, 140));
                    }
                });
            });
        });
        say('[gh808] case 9 — sufficiency claims found, per case: ' + JSON.stringify(seen));
        // The universe is real: at least one case must make such a claim, or the comparison above
        // is being made about nothing.
        expect(Object.keys(seen).filter((n) => seen[n].length).length).toBeGreaterThan(0);
        expect(offenders).toEqual({});
        // And the table's status vocabulary is closed, so a status this case has never seen is not
        // quietly read as "above the floor": every status printed by any case is one of these.
        const statuses = Array.from(new Set(Object.keys(docs).flatMap((name) =>
            Object.keys(ELEMENT_NAMES).map((el) => docs[name].verdicts[el].status)))).sort();
        say('[gh808] case 9 — the statuses the table printed across the set: ' + JSON.stringify(statuses));
        expect(statuses.filter((st) => ['no row', 'Apply', 'Monitor', 'No deficit',
            'Suppressed (programme covers)', 'Suppressed (dolomite covers)',
            'Suppressed (combined)'].indexOf(st) < 0 && !NO_PH_STATUS.test(st))).toEqual([]);
    });

    test('case 8 — a deficit the programme covers is not demanded as urgent anywhere', async () => {
        expect.hasAssertions();
        /**
         * The differentiator for Priority Actions, and the case this file did not have until its own
         * runs showed the hole: on every sample of the set, "below half the floor" and the decision
         * function's severe band happen to answer the same -- half the floor IS a fifty-percent gap
         * -- so a mutation that restores the local rule would have reddened nothing.
         *
         * What the two rules genuinely disagree about is the nutrition programme. The decision
         * function asks what the programme already delivers and suppresses the amendment when it
         * covers the deficit; the local rule never asked, so the report could tell a client to apply
         * potassium promptly on the same page as a table row reading "Suppressed (programme covers)".
         */
        const fresh = loadPage({ errors: [], warnings: [], alerts: [] });
        expect(fresh.failures).toEqual([]);
        const months = ['January', 'February', 'March', 'April', 'May', 'June',
            'July', 'August', 'September', 'October', 'November', 'December'];
        fresh.putPageProgram({
            monthly: months.map((m) => ({
                month_name: m,
                granular: [{ id: 'sop', name: 'Potassium sulphate', analysis: { K: 41.5, S: 18 }, rateKgHa: 60 }],
                liquid: []
            })),
            meta: {}, strategy: {}, muldersFlags: {}
        });
        const readings = CASES.filter((c) => c.name === 'synthetic-D')[0].readings;
        fresh.putSoilReadings(readings);
        const data = fresh.sandbox.GAIP_WordExport.collectData(
            fresh.sandbox.GAIP_NutritionProgramInputs.resolveExportInputs({ siteId: SITE_ID }));
        const parts = await documentParts(fresh.sandbox, data);
        const verdicts = tableVerdicts(parts);
        const urgent = parts.filter((p) => isSoilDecisionSection(p.section) && !p.inTable)
            .filter((p) => /Severe K deficiency|potassium (sulphate )?promptly/i.test(p.text))
            .map((p) => (p.section || '?') + ' :: ' + p.text.trim().replace(/\s+/g, ' ').slice(0, 140));
        say('[gh808] case 8 — K verdict with a programme that delivers potassium: '
            + JSON.stringify(verdicts.K) + '; sections demanding it anyway: ' + JSON.stringify(urgent));
        // The programme is real and the table says so: without this the assertion below passes on a
        // run where nothing was suppressed because nothing was deficient.
        expect(verdicts.K.status).toMatch(/Suppressed/);
        expect(urgent).toEqual([]);
    });

    test('case 7 — a second export in the same page carries only its own amendments', async () => {
        expect.hasAssertions();
        const byName = {};
        CASES.forEach((c) => { byName[c.name] = c.readings; });
        const pairs = [['103', '154'], ['103', '104']];
        const findings = {};
        for (const pair of pairs) {
            const fresh = loadPage({ errors: [], warnings: [], alerts: [] });
            expect(fresh.failures).toEqual([]);
            const wx = fresh.sandbox.GAIP_WordExport;
            const inputs = fresh.sandbox.GAIP_NutritionProgramInputs;
            fresh.putPageProgram(pageProgramme());
            const printed = {};
            for (const name of pair) {
                fresh.putSoilReadings(byName[name]);
                const data = wx.collectData(inputs.resolveExportInputs({ siteId: SITE_ID }));
                const parts = await documentParts(fresh.sandbox, data);
                // What the Monthly Schedule of THIS document names, with its rate. Read cell by
                // cell: the first version joined the section into one string and a regexp then
                // matched across two tables at once, which made a document's own figure look like
                // a stranger.
                const AMENDMENT_IN_A_SCHEDULE_CELL =
                    /(Gypsum|Magnesium sulphate[^@]*|Kieserite|Dolomite|Potassium sulphate|agricultural lime)[^@,]*@\s*([\d.]+)\s*(kg\/ha|g\/m²)/gi;
                const named = [];
                // The Monthly Schedule's cells are the only ones that write "product @ rate" in one
                // cell; the Annual Product Summary above it puts the product and the rate in
                // separate cells. "Monthly Schedule" itself is a bold paragraph rather than a
                // heading, so the section tree cannot be used here -- measured, not assumed.
                parts.filter((p) => /^Nutrition Program/.test(p.section || '')
                        && p.inTable && p.text.indexOf('@') !== -1)
                    .forEach((p) => {
                        let m;
                        AMENDMENT_IN_A_SCHEDULE_CELL.lastIndex = 0;
                        while ((m = AMENDMENT_IN_A_SCHEDULE_CELL.exec(p.text)) !== null) {
                            named.push({ product: m[1].trim().split(' (')[0], rate: m[2], unit: m[3] });
                        }
                    });
                // What this document's own soil section says about those products.
                const soilText = parts.filter((p) => /^Soil Nutrition/.test(p.section || ''))
                    .map((p) => p.text).join('\n');
                printed[name] = {
                    schedule: named.map((e) => e.product + ' @ ' + e.rate + ' ' + e.unit),
                    // Its own document must name that product AND that figure in its soil section.
                    strangers: named.filter((e) => !(soilText.indexOf(e.product) !== -1
                        && soilText.indexOf(e.rate) !== -1))
                        .map((e) => e.product + ' @ ' + e.rate + ' ' + e.unit)
                };
            }
            const leftInThePage = [];
            (fresh.pageProgram().monthly || []).forEach((m, i) => {
                (m.granular || []).concat(m.liquid || []).forEach((e) => {
                    if (e && e._isAmendment) leftInThePage.push(i + ':' + e.id + '@' + e.rateKgHa);
                });
            });
            findings[pair.join(' then ')] = { printed: printed, leftInThePage: leftInThePage };
        }
        say('[gh808] case 7 — two exports in one page:');
        Object.keys(findings).forEach((k) => say('    ' + k + ': ' + JSON.stringify(findings[k], null, 0)));
        Object.keys(findings).forEach((k) => {
            Object.keys(findings[k].printed).forEach((name) => {
                expect([k, name, findings[k].printed[name].strangers]).toEqual([k, name, []]);
            });
            // And the page's own programme is not where the export keeps its working copy.
            expect([k, findings[k].leftInThePage]).toEqual([k, []]);
        });
    });
});

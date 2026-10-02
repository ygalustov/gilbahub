/**
 * GH-810 (queue item 3gy, client requirement R2, delivery 3, pH half) — ONE pH VERDICT, BY THE GRASS.
 *
 * The lime verdict of GH-808 knew no grass: fixed boundaries of 5.5 and 6.0. The product has decided
 * about lime by species since b35fix418, from the species pH tolerance table, and two sections of the
 * report computed that band separately. The verdict now carries the band, and both print from it.
 *
 * WHAT THIS FILE DOES NOT PROVE, named rather than implied:
 *   - which of the two acidification sentences stays above the tolerance ceiling: that is the owner's
 *     decision, asked on 02.10 and not yet answered. The verdict is asserted there; the count of
 *     sentences is not, and the test that will assert it is listed below as a todo.
 *   - the species comes from `data.turf.effectiveSpecies`, which carries substituted words of its own
 *     when the overseed species is missing; that is a separate recorded question.
 */
'use strict';

const { loadPage, SITE_ID } = require('./helpers/export-page-sandbox');
const { documentParts, flatText } = require('./helpers/word-document-reading');

/** Soil 141 with the pH the case names: magnesium adequate, so no dolomite is ever coming. */
const SOIL_141 = { B: 0.2, K: 40, P: 40, S: 75, Ca: 803, Cu: 1.3, EC: 0.16, Fe: 168, Mg: 129, Mn: 28.3,
    OM: 3.7, Zn: 5.7, CEC: 5.9 };

function say(s) { process.stdout.write(s + '\n'); }

async function build(page, species, soil, methodology) {
    page.putSiteMethodology(methodology || 'ammonium_acetate');
    page.putSiteSpecies(species);
    page.putSoilReadings(soil);
    const data = page.sandbox.GAIP_WordExport.collectData(
        page.sandbox.GAIP_NutritionProgramInputs.resolveExportInputs({ siteId: SITE_ID }));
    const parts = await documentParts(page.sandbox, data);
    return { data: data, parts: parts, text: flatText(parts) };
}

const LIME_INSTRUCTION = /(Apply agricultural lime|Consider lime application|Light lime application)/;

function limeInstructions(parts) {
    return parts.filter((p) => /^Soil Nutrition/.test(p.section || '') && !p.inTable)
        .filter((p) => LIME_INSTRUCTION.test(p.text))
        .map((p) => p.text.trim().replace(/^•\s*/, ''));
}

describe('GH-810 — one pH verdict, by the grass', () => {
    jest.setTimeout(300000);
    let page;
    beforeAll(() => {
        page = loadPage({ errors: [], warnings: [], alerts: [] });
        expect(page.failures).toEqual([]);
    });

    /**
     * The boundary cases of the plan, by class of grass. Every expected sentence is written out by hand
     * from the species table's own numbers (hub-tissue-v3.js), not computed by a copy of the rule:
     *   Couch            warm-season              optimal 6.0-7.0  tolerance 5.5-8.5
     *   Perennial Ryegrass cool, not acid-tolerant optimal 6.0-7.0  tolerance 5.5-7.5
     *   Creeping Bentgrass cool, acid-tolerant     optimal 5.5-6.5  tolerance 5.0-7.0
     *   Mystery Grass    not in the table -> the table's `default` record, optimal 6.0-7.0, 5.5-7.5
     * "Exactly one instruction at `lime`, none at `none`" -- the list itself is compared, so a count of
     * one is not met by another sentence and an empty document does not pass the `lime` rows.
     */
    const LIGHT6 = 'Light lime application may be beneficial to raise pH toward 6.';
    const CONSIDER6 = 'Consider lime application to raise pH toward 6 for optimal nutrient availability.';
    const APPLY67 = 'Apply agricultural lime to raise pH toward 6-7.';
    const APPLY5565 = 'Apply agricultural lime to raise pH toward 5.5-6.5.';
    const BOUNDARIES = [
        ['Couch', 5.99, 'lime', [LIGHT6]], ['Couch', 6.01, 'none', []],
        ['Couch', 5.49, 'lime', [APPLY67]], ['Couch', 5.51, 'lime', [LIGHT6]],
        ['Couch', 8.49, 'none', []], ['Couch', 8.51, 'acidify', []],
        ['Perennial Ryegrass', 5.99, 'lime', [CONSIDER6]], ['Perennial Ryegrass', 6.01, 'none', []],
        ['Perennial Ryegrass', 5.49, 'lime', [APPLY67]], ['Perennial Ryegrass', 5.51, 'lime', [CONSIDER6]],
        ['Perennial Ryegrass', 7.49, 'none', []], ['Perennial Ryegrass', 7.51, 'acidify', []],
        ['Creeping Bentgrass', 5.49, 'lime', [APPLY5565]], ['Creeping Bentgrass', 5.51, 'none', []],
        ['Creeping Bentgrass', 4.99, 'lime', [APPLY5565]], ['Creeping Bentgrass', 5.01, 'lime', [APPLY5565]],
        ['Creeping Bentgrass', 6.99, 'none', []], ['Creeping Bentgrass', 7.01, 'acidify', []],
        // The case that separates a grass-blind boundary from the grass's own: optimal from 5.5, so at
        // 5.7 nothing is asked of lime; a fixed 6.0 would say lime.
        ['Creeping Bentgrass', 5.7, 'none', []],
        // And the case that actually separates them, found when the bentgrass case stayed green under
        // a grass-blind mutation: bentgrass is acid-tolerant, so its slight step is `none` either way.
        // Kikuyu is warm-season with an optimum from 5.5 -- by its own band 5.7 is optimal, by a fixed
        // 6.0 it is "slightly below", and warm-season grass is told "Light lime" there.
        ['Kikuyu', 5.7, 'none', []],
        ['Mystery Grass', 5.99, 'lime', [CONSIDER6]], ['Mystery Grass', 6.01, 'none', []],
        ['Mystery Grass', 5.49, 'lime', [APPLY67]], ['Mystery Grass', 5.51, 'lime', [CONSIDER6]],
        ['Mystery Grass', 7.49, 'none', []], ['Mystery Grass', 7.51, 'acidify', []]
    ];

    test('boundaries — one lime instruction at lime, none at none, by the grass', async () => {
        expect.hasAssertions();
        const differ = [];
        for (const [sp, ph, status, instr] of BOUNDARIES) {
            const d = await build(page, sp, Object.assign({}, SOIL_141, { pH: ph }));
            const v = d.data._soilVerdicts.pH;
            const got = { status: v.status, instructions: limeInstructions(d.parts) };
            const want = { status: status, instructions: instr };
            if (JSON.stringify(got) !== JSON.stringify(want)) differ.push({ case: sp + ' @ ' + ph, got: got, want: want });
        }
        say('[gh810ph] boundaries checked: ' + BOUNDARIES.length + '; differing: ' + JSON.stringify(differ));
        expect(differ).toEqual([]);
    });

    test('probe — sulphur at pH 7.8 and the alkaline constant at 7.55 (MLSN)', async () => {
        expect.hasAssertions();
        const months = ['January','February','March','April','May','June','July','August','September','October','November','December'];
        page.putPageProgram({ monthly: months.map((m) => ({ month_name: m,
            granular: [{ id: 'urea', name: 'Urea', analysis: { N: 46 }, rateKgHa: 50 }], liquid: [] })),
            meta: {}, strategy: {}, muldersFlags: {} });
        for (const [sp, soil] of [['Kentucky Bluegrass', { K: 120, P: 60, S: 3, Ca: 800, Mg: 120, pH: 7.8, CEC: 8 }],
                                  ['Perennial Ryegrass', { K: 20, P: 20, S: 3, Ca: 200, Mg: 120, pH: 7.55, CEC: 8 }]]) {
            const d = await build(page, sp, soil, 'mlsn');
            say('[gh810ph] ' + sp + ' ' + JSON.stringify(soil) + ' pH verdict ' + d.data._soilVerdicts.pH.status
                + ', P floor ' + JSON.stringify(d.data.soil.thresholds.P));
            d.parts.filter((p) => !p.inTable && /sulphur|acidif|MAP preferred|alkaline\) |doubly correct|volatilis|Phosphorus availability|pH 7\.[5-8]/i.test(p.text)
                    && !/^(References|Glossary|Contents)/.test(p.section || ''))
                .forEach((p) => say('    [' + p.section + '] ' + p.text.trim().replace(/\s+/g, ' ').slice(0, 220)));
            expect(d.parts.length).toBeGreaterThan(50);
        }
        page.putPageProgram(undefined);
    });

    const UREA_PROGRAMME = (() => {
        const months = ['January','February','March','April','May','June','July','August','September','October','November','December'];
        // Urea in the programme: the volatilisation warning inside sulphur rule 4 reads it.
        return { monthly: months.map((m) => ({ month_name: m,
            granular: [{ id: 'urea', name: 'Urea', analysis: { N: 46 }, rateKgHa: 50 }], liquid: [] })),
            meta: {}, strategy: {}, muldersFlags: {} };
    })();

    test('sulphur — the S source and the pH verdict do not contradict each other\'s instruction', async () => {
        expect.hasAssertions();
        // Kentucky Bluegrass tolerates up to 8.0, so at 7.8 the pH verdict asks for no acidification,
        // while the sulphur decision -- above its own 7.5 -- chooses elemental sulphur as the S source.
        const d = await build(page, 'Kentucky Bluegrass', { K: 120, P: 60, S: 3, Ca: 800, Mg: 120, pH: 7.8, CEC: 8 }, 'mlsn');
        const soil = d.parts.filter((p) => /^Soil Nutrition/.test(p.section || '') && !p.inTable).map((p) => p.text).join('\n');
        say('[gh810ph] sulphur at 7.8 — verdict ' + d.data._soilVerdicts.pH.status + '; S decision '
            + (d.data._soilVerdicts.elements.S.decision || {}).product);
        expect(d.data._soilVerdicts.pH.status).toBe('none');
        expect(soil).toMatch(/Apply Elemental sulphur \(90% S\)/);
        expect(soil).not.toMatch(/Aggressive acidification required/);
        expect(soil).not.toMatch(/URGENT: Apply elemental sulphur or ammonium sulphate to acidify/);
    });

    test('species words — a site with no species is not printed as one', async () => {
        expect.hasAssertions();
        const d = await build(page, '', Object.assign({}, SOIL_141, { pH: 6.2 }));
        const found = ['Couch', 'cool-season grass', 'cool-season overseed'].filter((w) => d.text.indexOf(w) !== -1);
        say('[gh810ph] no species — substituted words found: ' + JSON.stringify(found)
            + '; soil.speciesName = ' + JSON.stringify(d.data.soil.speciesName)
            + '; turf.effectiveSpecies = ' + JSON.stringify(d.data.turf.effectiveSpecies));
        expect(found).toEqual([]);
        expect(d.data.soil.speciesName).toBeNull();
        // The universe: the soil section is printed, with its pH sentence.
        expect(d.text).toMatch(/Soil pH \(6\.2\) is within the optimal range/);
    });

    test('the alkaline constant — five readers on one side of it, the unconnected role on its own', async () => {
        expect.hasAssertions();
        page.putPageProgram(UREA_PROGRAMME);
        const d = await build(page, 'Perennial Ryegrass', { K: 20, P: 10, S: 3, Ca: 200, Mg: 120, pH: 7.55, CEC: 8 }, 'mlsn');
        page.putPageProgram(undefined);
        const soil = d.parts.filter((p) => /^Soil Nutrition/.test(p.section || '') && !p.inTable).map((p) => p.text).join('\n');
        const pi = d.parts.filter((p) => /^Performance Impact/.test(p.section || '')).map((p) => p.text).join('\n');
        const readers = {
            'P note': /MAP preferred over DAP at pH 7\.5/.test(soil),
            'K note': /at pH 7\.5 \(alkaline\) Ca competes with K/.test(soil),
            'Ca note': /at pH 7\.5 \(alkaline\) gypsum is doubly correct/.test(soil),
            'S rule 4': /Apply Elemental sulphur \(90% S\)[^\n]*correct at pH 7\.5/.test(soil),
            'urea warning in rule 4': /Urea[^\n]*volatilis|volatilis[^\n]*[Uu]rea/.test(soil)
        };
        const unconnected = {
            'Performance Impact P availability': /The elevated soil pH \(7\.55\) causes phosphorus to precipitate/.test(pi)
        };
        say('[gh810ph] constant at pH 7.55 — readers: ' + JSON.stringify(readers) + '; unconnected: ' + JSON.stringify(unconnected));
        expect(readers).toEqual({ 'P note': true, 'K note': true, 'Ca note': true, 'S rule 4': true, 'urea warning in rule 4': true });
        // The unconnected role runs on this pH -- the precondition for its staying green under a mutation
        // of the constant to mean "not connected" rather than "not reached".
        expect(unconnected).toEqual({ 'Performance Impact P availability': true });
    });

    /**
     * GH-812 (queue item 3gy, delivery 3, remainder): THE ONE ACIDIFICATION INSTRUCTION.
     *
     * The owner's decision of 03.10, variant (a), nothing carried over: the pH/CEC context's sentence
     * stays (it alone says how to apply elemental sulphur safely), the Interpretation's goes whole. So
     * the verdict's acidification instruction is exactly that sentence at `acidify`.
     *
     * GH-814: REWRITTEN, NOT CORRECTED. The owner then decided to remove the softer advice the pH/CEC
     * context gave above the optimum and below the ceiling, and the meaning of this case widened with
     * that decision: no statement that the soil pH should be lowered, or that acidification is wanted,
     * at any status but `acidify` -- not only the verdict's own instruction. The case used to look for
     * two known sentences; a new wording of the same advice passed it (the reviewer's mutation C7). So
     * it now reads the document in two layers:
     *   1. PLACES -- the places of the class, each with the words it prints and the sentence that proves
     *      a state reached its branch. A state reaching a branch is what lets an empty result mean
     *      "removed" rather than "never printed".
     *   2. THE NET -- every sentence of the document carrying a word of the class. Each one must be a
     *      place of the table or a statement declared below as outside the class, with its reason;
     *      anything else is red, and printed.
     * The net's boundary, named: it sees only what the states bring to print, and only by the class's
     * words. Advice to acidify worded with none of them passes it.
     */
    const URGENT = /^URGENT: Apply elemental sulphur or ammonium sulphate to acidify the rootzone\./;
    const AGGRESSIVE = /Aggressive acidification required/;
    function acidifyInstructions(parts) {
        return parts.filter((p) => !p.inTable && !/^(References|Glossary|Contents)/.test(p.section || ''))
            .filter((p) => URGENT.test(p.text.trim().replace(/^•\s*/, '')) || AGGRESSIVE.test(p.text))
            .map((p) => (p.section || '?') + ' :: ' + p.text.trim().replace(/^•\s*/, '').slice(0, 72));
    }
    const CLASS_WORDS = /acidif|\blower(ing|s)?\s+(the\s+)?(soil\s+)?pH|\breduc\w*\s+(the\s+)?(soil\s+)?pH|\bdecreas\w*\s+(the\s+)?(soil\s+)?pH|\bbring\w*\s+(the\s+)?pH|\bpH\s+(down|lower)|ammonium[- ]based/i;
    /**
     * `allowed`: 'never' -- not at any status; 'acidify' -- only when the verdict asks for acidification.
     * `reachedIn`: states that must reach the place's branch, by name, where one reaching it is not enough.
     *
     * GH-819: the last two places of the class get a status. The owner's decisions, both variant (a):
     * P2's acidification advice goes at every status; P4 keeps its acidification half only where the
     * verdict asks for acidification. No place is left printed and not asserted, so that kind is gone.
     * P4's `reach` covers both of its sentences, and both states are named, because after the change
     * the old words print only at `acidify` and a reach on them would watch half the place.
     */
    const PLACES = [
        { name: 'P1 pH/CEC context, soft advice (removed, GH-814)', allowed: 'never',
            words: /Consider acidification to bring pH into the optimal range/,
            reach: /is above the optimal range \([^)]*\) for (Perennial Ryegrass|Creeping Bentgrass|Poa annua|Fine Fescue|Browntop Bent|default)\b[^.]*within tolerance/ },
        { name: 'P2 Interpretation, moderately alkaline (removed, GH-819)', allowed: 'never',
            words: /Use ammonium-based nitrogen sources to help lower pH/,
            reach: /Soil pH is moderately alkaline \(/ },
        { name: 'P3 sulphur rule 4, volatilisation warning', allowed: 'acidify',
            words: /ammonium sulphate \(21-0-0 \+ 24% S\), acidifying/,
            reach: /Strongly consider substituting ammonium sulphate/ },
        { name: 'sulphur rule 4, the claim (GH-813)', allowed: 'acidify',
            words: /\(acidifying effect is desired\)/,
            reach: /Apply Elemental sulphur \(90% S\)[^.]*correct at pH/ },
        { name: 'pH/CEC context, the instruction (GH-812)', allowed: 'acidify',
            words: URGENT,
            reach: /exceeds the tolerance range for/ },
        { name: 'P4 calcium, gypsum at alkaline pH (at acidify only, GH-819)', allowed: 'acidify',
            words: /gypsum is doubly correct[^.]*acidifying effect/,
            reach: /gypsum is (doubly )?correct/,
            reachedIn: ['Kentucky Bluegrass @ 7.8 +lowCa', 'Perennial Ryegrass @ 7.55 +lowCa'] }
    ];
    /**
     * Sentences that carry a word of the class and are not advice to lower the soil pH.
     *
     * Two-sided, as PLACES is: an entry no state brings to print is red, and the case prints
     * "entry <- states". Without that, a new place caught by the net is silenced by one more line here,
     * and an entry whose sentence left the product stays behind without a subject (the reviewer's D1).
     * The water entries live here because two states of the case carry water that prints them.
     */
    const OUTSIDE_CLASS = [
        { name: 'no acidification needed', words: /tolerates alkaline pH well, no acidification needed/, why: 'says acidification is NOT needed' },
        { name: 'rather than aggressive acidification', words: /rather than aggressive acidification/, why: 'says acidification is NOT the focus' },
        { name: 'Fe-acidification programs', words: /common after Fe-acidification programs/, why: 'iron and manganese, a cause named, no advice' },
        { name: 'water: HCO3 also high', words: /Consider acidification if HCO3 is also high/, why: 'irrigation water chemistry' },
        { name: 'water: reduce bicarbonate', words: /Consider acidification to reduce bicarbonate levels/, why: 'irrigation water chemistry' },
        { name: 'water: to pH 6.5-7.0', words: /^Consider acidification to pH 6\.5-7\.0\.?$/, why: 'irrigation water bicarbonate; the sentence names no subject, a recorded open question' }
    ];
    function sentencesOf(parts) {
        const out = [];
        parts.filter((p) => !/^(References|Glossary|Contents)/.test(p.section || ''))
            .forEach((p) => p.text.trim().replace(/^•\s*/, '').split(/(?<=\.)\s+(?=[A-Z(])/).forEach((s) => {
                if (s.trim()) out.push({ section: p.section || '?', text: s.trim() });
            }));
        return out;
    }
    function readClass(parts) {
        const sentences = sentencesOf(parts);
        const text = flatText(parts);
        const byPlace = {}, reached = {}, outside = {}, unknown = [];
        PLACES.forEach((pl) => { byPlace[pl.name] = 0; reached[pl.name] = pl.reach.test(text); });
        OUTSIDE_CLASS.forEach((o) => { outside[o.name] = 0; });
        sentences.filter((s) => CLASS_WORDS.test(s.text)).forEach((s) => {
            const pl = PLACES.find((x) => x.words.test(s.text));
            if (pl) { byPlace[pl.name] += 1; return; }
            const o = OUTSIDE_CLASS.find((x) => x.words.test(s.text));
            if (o) { outside[o.name] += 1; return; }
            unknown.push(s.section + ' :: ' + s.text.slice(0, 140));
        });
        return { byPlace: byPlace, reached: reached, outside: outside, unknown: unknown };
    }
    const CLASS_STATES = [
        ['Perennial Ryegrass', 7.2, 'none'], ['Perennial Ryegrass', 7.49, 'none'], ['Creeping Bentgrass', 6.99, 'none'],
        ['Poa annua', 6.8, 'none'], ['Poa annua', 7.3, 'none'], ['Couch', 8.49, 'none'], ['Kikuyu', 7.4, 'none'],
        ['Kentucky Bluegrass', 7.2, 'none'], ['Perennial Ryegrass', 5.3, 'lime'],
        ['Kentucky Bluegrass', 7.8, 'none', 'urea'], ['Tall Fescue', 7.8, 'none', 'urea'], ['Kikuyu', 7.8, 'none', 'urea'],
        ['Couch', 8.51, 'acidify'], ['Perennial Ryegrass', 7.51, 'acidify'], ['Perennial Ryegrass', 7.8, 'acidify'],
        ['Creeping Bentgrass', 7.01, 'acidify'], ['Mystery Grass', 7.51, 'acidify'], ['Perennial Ryegrass', 7.8, 'acidify', 'urea'],
        // calcium short at an alkaline pH: the gypsum branch of P4, on a grass the verdict leaves alone and on one it does not
        ['Kentucky Bluegrass', 7.8, 'none', 'lowCa'], ['Perennial Ryegrass', 7.55, 'acidify', 'lowCa'],
        // irrigation water that prints the water entries of OUTSIDE_CLASS, on a soil pH the verdict leaves alone
        ['Perennial Ryegrass', 6.5, 'none', 'waterBicarbonate'], ['Perennial Ryegrass', 6.5, 'none', 'waterSodic']
    ];
    const LOW_CA_SOIL = { K: 20, P: 10, S: 3, Ca: 200, Mg: 120, CEC: 8 };
    /** The sandbox's own water sample as it starts, put back after a water state. */
    const SANDBOX_WATER = { pH: 7.2, EC: 0.41, Ca: 22, Mg: 11, Na: 33, K: 4, Cl: 44, SO4: 12, HCO3: 55, CO3: 1, B: 0.2,
        Fe: 0.3, NO3: 2, PO4: 0.5, Mn: 0.1 };
    const WATERS = {
        waterBicarbonate: Object.assign({}, SANDBOX_WATER, { EC: 0.4, Ca: 20, Mg: 12.15, Na: 46, HCO3: 150 }),
        waterSodic: Object.assign({}, SANDBOX_WATER, { EC: 1.2, Ca: 20, Mg: 12.15, Na: 179.4 })
    };
    async function buildClassState(sp, ph, prog) {
        if (prog === 'lowCa') return build(page, sp, Object.assign({}, LOW_CA_SOIL, { pH: ph }), 'mlsn');
        if (WATERS[prog]) {
            page.putWaterReadings(WATERS[prog]);
            try { return await build(page, sp, Object.assign({}, SOIL_141, { pH: ph })); }
            finally { page.putWaterReadings(SANDBOX_WATER); }
        }
        if (prog) page.putPageProgram(UREA_PROGRAMME);
        try {
            return prog ? await build(page, sp, Object.assign({}, SULPHUR_SOIL, { pH: ph }), 'mlsn')
                : await build(page, sp, Object.assign({}, SOIL_141, { pH: ph }));
        } finally { if (prog) page.putPageProgram(undefined); }
    }

    test('acidification — no statement of the class at any status but acidify, by place and by net; exactly one instruction at acidify', async () => {
        expect.hasAssertions();
        const differ = [], unknown = [], reachedBy = {}, outsideBy = {};
        for (const [sp, ph, status, prog] of CLASS_STATES) {
            const d = await buildClassState(sp, ph, prog);
            const r = readClass(d.parts);
            const label = sp + ' @ ' + ph + (prog ? ' +' + prog : '');
            const got = { status: d.data._soilVerdicts.pH.status, wrong: [] };
            PLACES.forEach((pl) => {
                if (r.reached[pl.name]) (reachedBy[pl.name] = reachedBy[pl.name] || []).push(label);
                const n = r.byPlace[pl.name];
                if (pl.allowed === 'never' && n) got.wrong.push(pl.name + ' x' + n);
                if (pl.allowed === 'acidify' && status !== 'acidify' && n) got.wrong.push(pl.name + ' x' + n);
            });
            const urgent = r.byPlace[PLACES[4].name];
            if (status === 'acidify' && urgent !== 1) got.wrong.push('instruction at acidify x' + urgent);
            if (JSON.stringify(got) !== JSON.stringify({ status: status, wrong: [] })) differ.push({ case: label, got: got });
            r.unknown.forEach((u) => unknown.push(label + ' :: ' + u));
            OUTSIDE_CLASS.forEach((o) => { if (r.outside[o.name]) (outsideBy[o.name] = outsideBy[o.name] || []).push(label); });
        }
        say('[gh814] states examined: ' + CLASS_STATES.length);
        PLACES.forEach((pl) => say('[gh814] branch reached: ' + pl.name + ' <- ' + JSON.stringify(reachedBy[pl.name] || [])));
        say('[gh814] statements of the class where they must not be: ' + JSON.stringify(differ));
        say('[gh814] sentences with a word of the class in neither the table nor the outside list: ' + JSON.stringify(unknown));
        OUTSIDE_CLASS.forEach((o) => say('[gh814] outside the class, printed by: ' + o.name + ' <- ' + JSON.stringify(outsideBy[o.name] || [])));
        // The net's precondition: every place's branch is reached by at least one state, so an empty
        // place means the words are gone, not that nothing got that far.
        expect(PLACES.filter((pl) => !(reachedBy[pl.name] || []).length).map((pl) => pl.name)).toEqual([]);
        // GH-819: where a place has two sentences, each state named for it reaches it -- not only one.
        const unreached = [];
        PLACES.forEach((pl) => (pl.reachedIn || []).forEach((lb) => {
            if ((reachedBy[pl.name] || []).indexOf(lb) === -1) unreached.push(pl.name + ' <- ' + lb);
        }));
        say('[gh819] named states not reaching their place: ' + JSON.stringify(unreached));
        expect(unreached).toEqual([]);
        // And the other list the same way: an entry outside the class that no state prints silences nothing.
        expect(OUTSIDE_CLASS.filter((o) => !(outsideBy[o.name] || []).length).map((o) => o.name)).toEqual([]);
        expect(differ).toEqual([]);
        expect(unknown).toEqual([]);
    });

    /**
     * GH-819: WHAT STAYS INSTEAD. A place that loses its words is asserted by the net only as an absence,
     * and an absence does not tell "the advice went" from "everything went". So each of the two places
     * has its remaining sentence asserted, exactly once, written out by hand -- zero is red, as two is.
     *   P2, Poa annua (optimal 6.0-6.5, tolerance to 7.5, not alkaline-tolerant) at 7.3: the iron advice
     *       of the same recommendation stays, the ammonium-based advice goes.
     *   P4, calcium short at an alkaline pH: Kentucky Bluegrass tolerates up to 8.0, so at 7.8 the
     *       verdict asks for nothing and gypsum is "correct", not "doubly"; Perennial Ryegrass, ceiling
     *       7.5, at 7.55 is the control where the verdict asks for acidification and the sentence stays.
     * The sentences are read where the report prints them, outside tables, references and glossary.
     */
    const P4_ACIDIFY = /at pH 7\.5 \(alkaline\) gypsum is doubly correct: pH-neutral Ca delivery without further alkalising the soil, plus the sulphate has a small acidifying effect through SO₄²⁻ exchange with bicarbonate/g;
    const P4_NEUTRAL = /at pH 7\.8 \(alkaline\) gypsum is correct: pH-neutral Ca delivery without further alkalising the soil(?!, plus)/g;
    const P4_ANY_DOUBLY = /gypsum is doubly correct/g;

    function bodyText(parts) {
        return parts.filter((p) => !p.inTable && !/^(References|Glossary|Contents)/.test(p.section || ''))
            .map((p) => p.text).join('\n');
    }
    function count(text, re) { return (text.match(re) || []).length; }

    test('acidification — what stays instead: P2 keeps its iron advice, P4 its pH-neutral gypsum (GH-819)', async () => {
        expect.hasAssertions();
        const got = {};
        const p2 = await build(page, 'Poa annua', Object.assign({}, SOIL_141, { pH: 7.3 }));
        const p2s = sentencesOf(p2.parts.filter((p) => !p.inTable)).map((s) => s.text);
        got['Poa annua @ 7.3'] = {
            verdict: p2.data._soilVerdicts.pH.status,
            diagnosis: p2s.filter((t) => t === 'Soil pH is moderately alkaline (7.3).').length,
            iron: p2s.filter((t) => t === 'Consider foliar iron applications if chlorosis appears.').length,
            ammonium: p2s.filter((t) => t === 'Use ammonium-based nitrogen sources to help lower pH.').length
        };
        for (const [sp, ph] of [['Kentucky Bluegrass', 7.8], ['Perennial Ryegrass', 7.55]]) {
            const d = await buildClassState(sp, ph, 'lowCa');
            const body = bodyText(d.parts);
            got[sp + ' @ ' + ph + ' +lowCa'] = {
                verdict: d.data._soilVerdicts.pH.status,
                neutral: count(body, P4_NEUTRAL),
                acidifying: count(body, P4_ACIDIFY),
                doubly: count(body, P4_ANY_DOUBLY)
            };
        }
        say('[gh819] what stays instead: ' + JSON.stringify(got));
        expect(got).toEqual({
            'Poa annua @ 7.3': { verdict: 'none', diagnosis: 1, iron: 1, ammonium: 0 },
            'Kentucky Bluegrass @ 7.8 +lowCa': { verdict: 'none', neutral: 1, acidifying: 0, doubly: 0 },
            'Perennial Ryegrass @ 7.55 +lowCa': { verdict: 'acidify', neutral: 0, acidifying: 1, doubly: 1 }
        });
    });

    test('acidification — the diagnosis stays where the advice went (sign 2)', async () => {
        expect.hasAssertions();
        const d = await build(page, 'Perennial Ryegrass', Object.assign({}, SOIL_141, { pH: 7.2 }));
        const got = {
            context: d.parts.filter((p) => /^Soil pH \(7\.2\) is above the optimal range \(6–7\) for Perennial Ryegrass, but within tolerance \(5\.5–7\.5\)\. Monitor for iron chlorosis\.$/.test(p.text.trim())).length,
            interpretation: d.parts.filter((p) => /^Soil pH \(7\.2\) is slightly above optimal range \(6-7\) for Perennial Ryegrass but generally acceptable\.$/.test(p.text.trim())).length
        };
        say('[gh814] Perennial Ryegrass @ 7.2, diagnosis sentences: ' + JSON.stringify(got));
        expect(got).toEqual({ context: 1, interpretation: 1 });
    });

    test('acidification — the volatilisation warning keeps its place and loses "acidifying" where the verdict asks for none (sign 3)', async () => {
        expect.hasAssertions();
        const got = {};
        for (const sp of ['Kentucky Bluegrass', 'Tall Fescue', 'Kikuyu', 'Perennial Ryegrass']) {
            const d = await buildClassState(sp, 7.8, true);
            const w = (d.text.match(/Strongly consider substituting ammonium sulphate[^.]*\./g) || []);
            got[sp] = { verdict: d.data._soilVerdicts.pH.status, warnings: w.length, acidifying: w.filter((x) => /acidifying/.test(x)).length };
        }
        say('[gh814] volatilisation warning at pH 7.8 with urea: ' + JSON.stringify(got));
        expect(got).toEqual({
            'Kentucky Bluegrass': { verdict: 'none', warnings: 1, acidifying: 0 },
            'Tall Fescue': { verdict: 'none', warnings: 1, acidifying: 0 },
            'Kikuyu': { verdict: 'none', warnings: 1, acidifying: 0 },
            'Perennial Ryegrass': { verdict: 'acidify', warnings: 1, acidifying: 1 }
        });
    });

    test('acidification — the paired branch for alkaline-tolerant grass is untouched (sign 4, the reviewer\'s control)', async () => {
        expect.hasAssertions();
        const CHELATE = /^(•\s*)?Use chelated iron \(Fe-EDDHA\) if chlorosis appears\.$/;
        const got = {};
        for (const [sp, ph] of [['Kikuyu', 7.4], ['Kentucky Bluegrass', 7.2], ['Couch', 7.4], ['Perennial Ryegrass', 7.2]]) {
            const d = await build(page, sp, Object.assign({}, SOIL_141, { pH: ph }));
            got[sp + ' @ ' + ph] = d.parts.filter((p) => CHELATE.test(p.text.trim())).length;
        }
        say('[gh814] chelated iron sentence by grass: ' + JSON.stringify(got));
        // Shown on the fixture only: no live sample sits in this branch (02.10: none of the 52 soil samples
        // with a pH is on an alkaline-tolerant grass above its optimum).
        expect(got).toEqual({ 'Kikuyu @ 7.4': 1, 'Kentucky Bluegrass @ 7.2': 1, 'Couch @ 7.4': 1, 'Perennial Ryegrass @ 7.2': 0 });
    });

    test('acidification — the Interpretation\'s sentence is gone where it used to print, and the document is real', async () => {
        expect.hasAssertions();
        // Perennial Ryegrass, ceiling 7.5, at 7.8: the case on which the sentence printed before.
        const d = await build(page, 'Perennial Ryegrass', Object.assign({}, SOIL_141, { pH: 7.8 }));
        const aggressive = d.parts.filter((p) => AGGRESSIVE.test(p.text)).map((p) => p.text.trim());
        expect(aggressive).toEqual([]);
        // The universe: the same document carries the diagnosis of the very section the sentence lived in.
        expect(d.text).toMatch(/Soil pH \(7\.8\) exceeds tolerance for Perennial Ryegrass \(ceiling 7\.5\)/);
    });

    /**
     * GH-813 (queue item 3gy, delivery 3, remainder): THE REMOVED SENTENCE, BY ITS PARTS.
     *
     * The owner's answer was "just (a)": nothing of the Interpretation's sentence is carried over. The
     * reviewer's mutation returned a fragment of it -- "Consider species change." -- and a check that
     * looked for the sentence by its opening words stayed green. So the parts are listed. Two parts of
     * the removed sentence are worded the same, or nearly, in the sentence that stays ("Use Fe-EDDHA
     * chelate for iron applications.", "Evaluate irrigation water for alkalinity contribution.") and
     * cannot be forbidden without forbidding the sentence the owner kept; the list is the parts only
     * the removed sentence had.
     */
    const REMOVED_PARTS = [/Aggressive acidification/i, /post-aeration in autumn/i, /species change/i,
        /Evaluate irrigation water alkalinity contribution/i];

    test('the removed sentence, by its parts: none of them anywhere, on every pH it used to print at', async () => {
        expect.hasAssertions();
        const found = [];
        for (const [sp, ph] of [['Couch', 8.51], ['Perennial Ryegrass', 7.51], ['Perennial Ryegrass', 7.8],
            ['Creeping Bentgrass', 7.01], ['Mystery Grass', 7.51]]) {
            const d = await build(page, sp, Object.assign({}, SOIL_141, { pH: ph }));
            REMOVED_PARTS.forEach((re) => {
                d.parts.filter((p) => re.test(p.text)).forEach((p) => found.push(sp + ' @ ' + ph + ' :: ' + re + ' :: ' + p.text.trim().slice(0, 100)));
            });
            // The universe: the document is the one that used to carry the sentence -- the verdict asks
            // for acidification, and the instruction that stays is printed.
            expect([sp, ph, d.data._soilVerdicts.pH.status, acidifyInstructions(d.parts).length]).toEqual([sp, ph, 'acidify', 1]);
        }
        say('[gh813] parts of the removed sentence found: ' + JSON.stringify(found));
        expect(found).toEqual([]);
    });

    /**
     * GH-813: SULPHUR AND THE pH VERDICT AGREE -- signs 3 and 4 of the plan.
     *
     * Polarity is read where it is decided, not where it is printed (the analyst's correction of 02.10):
     * the pH verdict's `acidify` and the sulphur decision's `claimsAcidification`. The pH/CEC context
     * prints its instruction from the verdict and takes its polarity from it. Kentucky Bluegrass, Tall
     * Fescue and Kikuyu tolerate up to 8.0, so at 7.8 the verdict asks for nothing while rule 4 chooses
     * elemental sulphur; Perennial Ryegrass, ceiling 7.5, is the control where both say yes.
     */
    const SULPHUR_SOIL = { K: 120, P: 60, S: 3, Ca: 800, Mg: 120, pH: 7.8, CEC: 8 };

    test('sulphur — polarities agree with the pH verdict, and the claim follows it, on four grasses', async () => {
        expect.hasAssertions();
        const read = {};
        for (const sp of ['Kentucky Bluegrass', 'Tall Fescue', 'Kikuyu', 'Perennial Ryegrass']) {
            const d = await build(page, sp, SULPHUR_SOIL, 'mlsn');
            const v = d.data._soilVerdicts;
            const sDecision = v.elements.S.decision || {};
            const soil = d.parts.filter((p) => /^Soil Nutrition/.test(p.section || '') && !p.inTable).map((p) => p.text).join('\n');
            read[sp] = {
                // the list "section -- polarity", from the fields the sections print from
                polarities: {
                    'pH verdict': v.pH.status === 'acidify',
                    'sulphur decision': sDecision.claimsAcidification === true,
                    'pH/CEC context': v.pH.status === 'acidify'
                },
                claimPrinted: /acidifying effect is desired/.test(soil),
                acidifyInstructionPrinted: acidifyInstructions(d.parts).length === 1,
                // precondition: the sulphur decision ran and is in the document
                sulphurLine: /Apply Elemental sulphur \(90% S\)/.test(soil)
            };
        }
        say('[gh813] sulphur at pH 7.8 — ' + JSON.stringify(read));
        Object.keys(read).forEach((sp) => {
            const r = read[sp];
            const acidify = r.polarities['pH verdict'];
            // sign 3: every polarity equals the verdict's
            expect([sp, Object.values(r.polarities).every((x) => x === acidify)]).toEqual([sp, true]);
            // sign 4: the printed claim follows the decision's field, which follows the verdict
            expect([sp, r.claimPrinted]).toEqual([sp, acidify]);
            // lower bound: at acidify the document says so at least once
            if (acidify) expect([sp, r.acidifyInstructionPrinted]).toEqual([sp, true]);
            // the precondition, in the same case: the branch ran
            expect([sp, r.sulphurLine]).toEqual([sp, true]);
        });
        // The four grasses are the plan's: three that tolerate 7.8 and one that does not.
        expect(Object.keys(read).map((sp) => [sp, read[sp].polarities['pH verdict']])).toEqual([
            ['Kentucky Bluegrass', false], ['Tall Fescue', false], ['Kikuyu', false], ['Perennial Ryegrass', true]]);
    });

    /**
     * GH-813: sign 5 of the plan, in the variant the owner chose on 03.10 -- (b): "the product and the
     * rate stay; 'acidifying effect is desired' leaves the reason when the verdict asks for no
     * acidification". So the product is elemental sulphur on both sides of the grass's ceiling, at the
     * same rate, and only the claim differs. A product that started following the verdict -- gypsum for
     * the grass that tolerates 7.8 -- is variant (a), which she did not choose.
     */
    test('sulphur — the product by grass and pH, printed beside the verdict; only the claim follows it', async () => {
        expect.hasAssertions();
        /**
         * Sign 5 has no red before the change by construction -- the product is elemental sulphur today
         * and stays so -- so it is a sign of absence, and what makes it more than "green" is that it
         * prints what it looked at: the product chosen for every pair of grass and pH, beside the pH
         * verdict and the claim. The expected products are the sulphur rules' own, written out by hand
         * (rule 3 below pH 6.5: sulphate of ammonia; rule 5 from 6.5 to 7.5: gypsum; rule 4 above 7.5:
         * elemental sulphur), not read off a run. Magnesium is adequate in this soil, so rule 2
         * (dolomite) is not reached.
         */
        const GRASSES = ['Kentucky Bluegrass', 'Tall Fescue', 'Kikuyu', 'Perennial Ryegrass'];
        const RULE_KEY = { 6.2: 'sulphateOfAmmonia', 7.2: 'gypsum', 7.8: 'elementalSulphur' };
        const table = [];
        for (const ph of [6.2, 7.2, 7.8]) {
            for (const sp of GRASSES) {
                const d = await build(page, sp, Object.assign({}, SULPHUR_SOIL, { pH: ph }), 'mlsn');
                const sd = d.data._soilVerdicts.elements.S.decision || {};
                table.push({ grass: sp, pH: ph, verdict: d.data._soilVerdicts.pH.status,
                    product: sd.product || null, amendmentKey: sd.amendmentKey || null,
                    rate: sd.kgPractical, claims: sd.claimsAcidification === true });
            }
        }
        say('[gh813] sulphur product by grass and pH:\n    ' + table.map((r) => [r.grass, 'pH ' + r.pH, 'verdict ' + r.verdict,
            r.product, r.rate + ' kg S/ha', 'claims ' + r.claims].join(' | ')).join('\n    '));
        // The product follows the pH rule, never the grass: every pair is the rule's key for its pH.
        expect(table.map((r) => [r.grass, r.pH, r.amendmentKey]))
            .toEqual(table.map((r) => [r.grass, r.pH, RULE_KEY[r.pH]]));
        // The rate does not depend on the grass either: one rate per pH.
        [6.2, 7.2, 7.8].forEach((ph) => {
            const rates = Array.from(new Set(table.filter((r) => r.pH === ph).map((r) => r.rate)));
            expect([ph, rates.length === 1 && typeof rates[0] === 'number']).toEqual([ph, true]);
        });
        // And only the claim follows the verdict: true exactly where the verdict asks for acidification
        // and the product is elemental sulphur -- Perennial Ryegrass at 7.8, nowhere else.
        expect(table.filter((r) => r.claims).map((r) => r.grass + ' @ ' + r.pH)).toEqual(['Perennial Ryegrass @ 7.8']);
        expect(table.filter((r) => r.verdict === 'acidify').map((r) => r.grass + ' @ ' + r.pH)).toEqual(['Perennial Ryegrass @ 7.8']);
    });

    test('the pH/CEC context prints the verdict\'s band, not one of its own', async () => {
        expect.hasAssertions();
        // Found by a mutation that stayed green: no case read the band this section prints, so giving
        // it a pair of its own changed nothing any assertion looked at. Written out from the table.
        const BANDS = [
            ['Couch', 'Couch pH requirements: Optimal 6–7 | Tolerance 5.5–8.5'],
            ['Perennial Ryegrass', 'Perennial Ryegrass pH requirements: Optimal 6–7 | Tolerance 5.5–7.5'],
            ['Creeping Bentgrass', 'Creeping Bentgrass pH requirements: Optimal 5.5–6.5 | Tolerance 5–7'],
            ['Kikuyu', 'Kikuyu pH requirements: Optimal 5.5–7 | Tolerance 5–8'],
            ['Mystery Grass', 'default pH requirements: Optimal 6–7 | Tolerance 5.5–7.5']
        ];
        const differ = [];
        for (const [sp, line] of BANDS) {
            const d = await build(page, sp, Object.assign({}, SOIL_141, { pH: 6.2 }));
            const printed = d.parts.filter((p) => /pH requirements:/.test(p.text)).map((p) => p.text.trim());
            if (JSON.stringify(printed.map((x) => x.split(' | Acid')[0].split(' | Alkaline')[0])) !== JSON.stringify([line])) {
                differ.push({ species: sp, printed: printed, table: line });
            }
        }
        say('[gh810ph] pH/CEC band lines differing from the table: ' + JSON.stringify(differ));
        expect(differ).toEqual([]);
    });

    test('what the verdict and the two sections say, per grass and pH', async () => {
        expect.hasAssertions();
        const probes = [['Couch', 5.99], ['Perennial Ryegrass', 5.6], ['Creeping Bentgrass', 5.7],
            ['Mystery Grass', 5.99], ['Perennial Ryegrass', 7.51]];
        for (const [sp, ph] of probes) {
            const d = await build(page, sp, Object.assign({}, SOIL_141, { pH: ph }));
            const v = d.data._soilVerdicts.pH;
            // The universe: each probe built a verdict with a band to compare against.
            expect([sp, ph, !!v.band]).toEqual([sp, ph, true]);
            say('[gh810ph] ' + sp + ' pH ' + ph + ' -> ' + JSON.stringify({ status: v.status, step: v.step,
                words: v.limeWords, basis: v.basis, key: v.bandKey, band: v.band }));
            d.parts.filter((p) => /^Soil Nutrition/.test(p.section || '') && /pH|lime|acidif/i.test(p.text) && !p.inTable)
                .forEach((p) => say('    ' + p.text.trim().replace(/\s+/g, ' ').slice(0, 170)));
        }
    });
});

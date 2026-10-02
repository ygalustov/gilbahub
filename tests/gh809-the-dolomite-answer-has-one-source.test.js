/**
 * GH-809 (queue item 3gy, delivery 2) — "WILL DOLOMITE BE RECOMMENDED" HAS ONE ANSWER.
 *
 * The question was answered three times in one report: once by DECIDING it -- the magnesium branch
 * of `_computeAmendmentDecision`, which reaches its dolomite sub-branch only if the nutrition
 * programme has not already covered the deficit -- and twice by PREDICTING it from the soil alone,
 * as `lowpH && mgDeficit`, written out in the decision function and again in the lime verdict.
 *
 * The two predictions agreed with each other, so a check that breaks one copy and watches the other
 * cannot see this: they were wrong together. They disagree with the DECISION exactly when the
 * programme covers magnesium, and then one report says all three of these at once:
 *   - magnesium: suppressed, the programme covers it -- so no dolomite is recommended;
 *   - calcium: suppressed, "addressed by dolomite (being recommended for Mg/pH)";
 *   - lime: not mentioned, because dolomite is said to cover the pH.
 * The client is given an explanation that points at a product the document does not contain, and
 * gets neither lime nor calcium.
 *
 * So the case below is a sample that reaches that branch, and the control beside it is the same
 * sample with nothing covering its magnesium. Both read the document, not the code.
 */
'use strict';

const { loadPage, SITE_ID } = require('./helpers/export-page-sandbox');
const { documentParts, flatText, tableRowsUnder } = require('./helpers/word-document-reading');

/**
 * pH 5.6 with magnesium and calcium both under the S277 floors (36.6 and 400 ppm). pH below 6 is
 * what makes dolomite the magnesium product, and the calcium shortfall is what the prediction
 * claimed dolomite would cover.
 */
const SOIL = { K: 110, P: 25, Ca: 250, EC: 0.4, Mg: 25, Na: 20, pH: 5.6, CEC: 6 };

/** A programme that delivers magnesium, and one that does not, differing in nothing else. */
function programme(withMagnesium) {
    const months = ['January', 'February', 'March', 'April', 'May', 'June',
        'July', 'August', 'September', 'October', 'November', 'December'];
    const analysis = withMagnesium ? { N: 10, Mg: 4 } : { N: 10 };
    return {
        monthly: months.map((m) => ({
            month_name: m,
            granular: [{ id: 'blend', name: 'Compound blend', analysis: analysis, rateKgHa: 50 }],
            liquid: []
        })),
        meta: {}, strategy: {}, muldersFlags: {}
    };
}

function rowFor(parts, element) {
    const rows = tableRowsUnder(parts, 'Annual Soil Amendments') || [];
    return (rows.slice(1).filter((r) => r[0] === element)[0]) || null;
}

function limeInstructions(parts) {
    return parts.filter((p) => /^Soil Nutrition/.test(p.section || '') && !p.inTable)
        .filter((p) => /\blime\b/i.test(p.text) && /apply|consider|light/i.test(p.text))
        .filter((p) => !/is NOT chosen here/i.test(p.text))
        .map((p) => p.text.trim().replace(/\s+/g, ' ').slice(0, 140));
}

/**
 * The same soil at pH 5.3, below the species' tolerance floor (Perennial Ryegrass: 5.5). Only there
 * does the pH/CEC context choose between its two sentences -- the one that says dolomite will correct
 * the pH, and the one that says this species will experience significant stress -- so a mutation of
 * that context's reading is invisible at pH 5.6. Found when choosing the mutations, before running
 * them.
 */
const SOIL_BELOW_TOLERANCE = Object.assign({}, SOIL, { pH: 5.3 });

function pHContextSentence(parts) {
    const t = parts.filter((p) => /^Soil Nutrition/.test(p.section || '')).map((p) => p.text).join('\n');
    return {
        dolomiteWillCorrect: /Dolomite application \(see Soil Nutrition recommendations\) will correct pH/.test(t),
        significantStress: /This species will experience significant stress/.test(t)
    };
}

async function reportFor(withMagnesium, soil) {
    const page = loadPage({ errors: [], warnings: [], alerts: [] });
    expect(page.failures).toEqual([]);
    page.putPageProgram(programme(withMagnesium));
    page.putSoilReadings(soil || SOIL);
    const data = page.sandbox.GAIP_WordExport.collectData(
        page.sandbox.GAIP_NutritionProgramInputs.resolveExportInputs({ siteId: SITE_ID }));
    const parts = await documentParts(page.sandbox, data);
    return {
        verdicts: data._soilVerdicts,
        mgRow: rowFor(parts, 'Magnesium (Mg)'),
        caRow: rowFor(parts, 'Calcium (Ca)'),
        lime: limeInstructions(parts),
        pHContext: pHContextSentence(parts),
        text: flatText(parts)
    };
}

function say(s) { process.stdout.write(s + '\n'); }

// GH-810: the lime verdict became the pH verdict (it now covers the alkaline side as well) and its key
// in the report's model is `pH`; the statuses this file reads -- `lime`, `covered_by_dolomite` -- are
// unchanged.
describe('GH-809 — the dolomite answer has one source: the magnesium decision', () => {
    jest.setTimeout(300000);
    let covered, notCovered, coveredLow, notCoveredLow;

    beforeAll(async () => {
        covered = await reportFor(true);
        notCovered = await reportFor(false);
        coveredLow = await reportFor(true, SOIL_BELOW_TOLERANCE);
        notCoveredLow = await reportFor(false, SOIL_BELOW_TOLERANCE);
    });

    test('below the tolerance floor, the pH/CEC context says what the magnesium decision decided', () => {
        expect.hasAssertions();
        say('[gh809] pH 5.3, programme delivers no magnesium: dolomite '
            + notCoveredLow.verdicts.dolomiteComing + ', pH/CEC context ' + JSON.stringify(notCoveredLow.pHContext));
        say('[gh809] pH 5.3, programme delivers magnesium:    dolomite '
            + coveredLow.verdicts.dolomiteComing + ', pH/CEC context ' + JSON.stringify(coveredLow.pHContext));
        // Dolomite recommended: the context points at it, and does not also describe the stress.
        expect(notCoveredLow.verdicts.dolomiteComing).toBe(true);
        expect(notCoveredLow.pHContext).toEqual({ dolomiteWillCorrect: true, significantStress: false });
        // No dolomite recommended: the context must not point at one.
        expect(coveredLow.verdicts.dolomiteComing).toBe(false);
        expect(coveredLow.pHContext).toEqual({ dolomiteWillCorrect: false, significantStress: true });
    });

    test('the control: with nothing covering magnesium, dolomite IS the answer and everything follows it', () => {
        expect.hasAssertions();
        say('[gh809] control — programme delivers no magnesium:');
        say('    Mg row: ' + JSON.stringify(notCovered.mgRow));
        say('    Ca row: ' + JSON.stringify(notCovered.caRow));
        say('    lime verdict: ' + JSON.stringify(notCovered.verdicts.pH)
            + ', dolomiteComing: ' + notCovered.verdicts.dolomiteComing);
        say('    lime instructions: ' + JSON.stringify(notCovered.lime));
        // Dolomite is chosen, and that is what the other two read.
        expect(notCovered.verdicts.elements.Mg.decision.amendmentKey).toBe('dolomite');
        expect(notCovered.verdicts.dolomiteComing).toBe(true);
        expect(notCovered.verdicts.elements.Ca.status).toBe('suppressed_dolomite');
        expect(notCovered.verdicts.pH.status).toBe('covered_by_dolomite');
        // And the document says so: the calcium row explains itself by the dolomite it does have.
        expect(notCovered.text).toContain('addressed by dolomite');
        expect(notCovered.lime).toEqual([]);
    });

    test('the case: when the programme covers magnesium, nothing claims a dolomite the report does not recommend', () => {
        expect.hasAssertions();
        say('[gh809] case — the same soil, programme delivers magnesium:');
        say('    Mg row: ' + JSON.stringify(covered.mgRow));
        say('    Ca row: ' + JSON.stringify(covered.caRow));
        say('    lime verdict: ' + JSON.stringify(covered.verdicts.pH)
            + ', dolomiteComing: ' + covered.verdicts.dolomiteComing);
        say('    lime instructions: ' + JSON.stringify(covered.lime));
        // The decision: the programme covers the magnesium deficit, so no dolomite is chosen.
        expect(covered.verdicts.elements.Mg.status).toBe('suppressed_programme');
        expect(covered.verdicts.dolomiteComing).toBe(false);
        // Therefore no section may suppress calcium by pointing at it, and lime is not "covered".
        expect(covered.verdicts.elements.Ca.status).not.toBe('suppressed_dolomite');
        expect(covered.verdicts.pH.status).toBe('lime');
        // Read off the document, which is what the client has: no sentence about a dolomite that
        // is not there, and the lime instruction the pH asks for is printed.
        expect(covered.text).not.toContain('addressed by dolomite');
        expect(covered.text).not.toContain('Dolomite');
        // The list, not its length: the instruction is the one the client read before GH-808 removed
        // it, word for word, and nothing else. A count of 1 would also pass on a different sentence.
        expect(covered.lime).toEqual([
            '• Consider lime application to raise pH toward 6 for optimal nutrient availability.'
        ]);
    });

    test('the two reports differ in the programme and in nothing else', () => {
        expect.hasAssertions();
        // The positive control is only a control if the pair is otherwise identical: same soil, same
        // site, same thresholds. Without this the case above could be passing on a different sample.
        expect(covered.verdicts.elements.Mg.value).toBe(notCovered.verdicts.elements.Mg.value);
        expect(covered.verdicts.elements.Ca.value).toBe(notCovered.verdicts.elements.Ca.value);
        expect(covered.verdicts.elements.Mg.threshold).toEqual(notCovered.verdicts.elements.Mg.threshold);
        expect(covered.verdicts.elements.Ca.threshold).toEqual(notCovered.verdicts.elements.Ca.threshold);
        // And both runs built a real report, so the comparisons above are about two documents.
        say('[gh809] both reports built: Mg deficit ppm '
            + JSON.stringify([covered.verdicts.elements.Mg.deficitPpm,
                notCovered.verdicts.elements.Mg.deficitPpm])
            + ', Ca deficit ppm '
            + JSON.stringify([covered.verdicts.elements.Ca.deficitPpm,
                notCovered.verdicts.elements.Ca.deficitPpm]));
        expect(covered.text.length).toBeGreaterThan(5000);
        expect(notCovered.text.length).toBeGreaterThan(5000);
    });
});

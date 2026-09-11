/**
 * GH-422 — the Plan reads the sample's own CEC, and says so when there isn't one.
 *
 * `NutritionPrebbleIntegration.getSoilCEC()` used to resolve the cation
 * exchange capacity by re-reading the page: `GAIP_STATE.soil.cec` (a slot
 * nothing on plan.blade.php writes), then a `.gaip-cec` input (which lives in
 * partials/legacy-hub-markup.blade.php — present on /reports/export, absent on
 * /plan), then a construction-type guess, and finally a hardcoded 8. So every
 * New Zealand site reached the recommender with CEC 8 on the Plan and with the
 * certificate's own figure in the document.
 *
 * It now reads the CEC the calendar computed the programme against
 * (computeProgram()'s `soil.CEC`, GH-421), which is the same number whichever
 * route the sample arrived by, and returns `null` — never a substitute number —
 * when the sample carries no reading at all.
 *
 * The second half of this file is a MEASUREMENT, and it is the reason the
 * ticket's write-up says what it says: it pins what the recommender actually
 * does with a CEC, so the claim "CEC 8 against 5.9 is why the two surfaces
 * picked different products on Test5 - NZ" can be checked rather than assumed.
 * Both figures land inside the same band of both functions that read CEC, so
 * neither product scoring nor longevity moves between them.
 */

'use strict';

global.window = global.window || {};
global.document = global.document || {
    readyState: 'complete',
    addEventListener: function () {},
    getElementById: function () { return null; },
    createElement: function () { return { style: {}, setAttribute: function () {}, appendChild: function () {} }; },
    head: { appendChild: function () {} },
    body: { appendChild: function () {} },
    querySelector: function () { return null; },
    querySelectorAll: function () { return []; },
    dispatchEvent: function () {},
};
global.CustomEvent = global.CustomEvent || function () {};

const _realConsole = global.console;
global.console = { log: function () {}, warn: function () {}, error: function () {}, info: function () {} };
require('../assets/prebbles-products.js');
require('../assets/nutrition-prebble-integration.js');
global.console = _realConsole;

const PI = global.window.NutritionPrebbleIntegration;
const Recommender = global.window.PrebbleRecommender;

/** Reset every page-shaped source getSoilCEC() can read. */
function clearPage() {
    global.window.GAIP_STATE = undefined;
    global.document.querySelector = function () { return null; };
}

/** Test5 - NZ / Soccer, sample 141: the certificate says CEC 5.9. */
const TEST5_CEC = 5.9;
/** The number the Plan handed the recommender for every NZ site before GH-422. */
const OLD_PLAN_DEFAULT = 8;

describe('GH-422 — getSoilCEC() reads a reading, or says there is none', () => {
    afterEach(clearPage);

    test('the programme it was handed wins: the CEC the calendar computed against', () => {
        clearPage();
        // Both other sources say something else; the programme must still win,
        // because it is the only one that is per-sample on both surfaces.
        global.window.GAIP_STATE = { soil: { cec: 12 }, inputs: { soil: { CEC: 3 } } };
        expect(PI.getSoilCEC({ soil: { CEC: TEST5_CEC } })).toBe(TEST5_CEC);
    });

    test('a string CEC from a sample payload comes back as a number', () => {
        clearPage();
        // samples.payload stores this site's CEC as the string "5.9".
        expect(PI.getSoilCEC({ soil: { CEC: '5.9' } })).toBe(TEST5_CEC);
    });

    test('with no programme in hand it falls back to the canonical soil slot the Plan writes', () => {
        clearPage();
        global.window.GAIP_STATE = { inputs: { soil: { CEC: 4.2 } } };
        expect(PI.getSoilCEC()).toBe(4.2);
        expect(PI.getSoilCEC({ soil: {} })).toBe(4.2);
    });

    test('then legacy hub state, then the legacy hub soil form field', () => {
        clearPage();
        global.window.GAIP_STATE = { soil: { cec: 7.1 } };
        expect(PI.getSoilCEC()).toBe(7.1);

        clearPage();
        global.document.querySelector = function (sel) {
            return /gaip-cec/.test(sel) ? { value: '9.3' } : null;
        };
        expect(PI.getSoilCEC()).toBe(9.3);
    });

    test('no reading anywhere is null — not 8, not 3, not 12, not any number', () => {
        clearPage();
        expect(PI.getSoilCEC()).toBeNull();
        expect(PI.getSoilCEC({ soil: { CEC: null } })).toBeNull();
        expect(PI.getSoilCEC({ soil: { CEC: '' } })).toBeNull();

        // The construction-type guesses this getter used to make are gone too:
        // a sand rootzone with no certificate is still "no reading".
        global.window.GAIP_STATE = { turf: { construction: 'usga_sand' } };
        expect(PI.getSoilCEC()).toBeNull();
        global.window.GAIP_STATE = { turf: { construction: 'push_up_native' } };
        expect(PI.getSoilCEC()).toBeNull();
    });

    test('an unparseable reading is no reading, not NaN', () => {
        clearPage();
        global.window.GAIP_STATE = { soil: { cec: 'n/a' } };
        expect(PI.getSoilCEC()).toBeNull();
    });
});

describe('GH-422 — what the recommender actually does with a CEC', () => {
    // getReleasePreference() bands CEC at <5 / <12 / >=12, and crosses with
    // irrigation frequency. estimateLongevity() bands it at <5 / <10 / >=10.
    // Nothing else in prebbles-products.js reads CEC.

    test('5.9 and 8 are the same answer on a moderately irrigated surface', () => {
        // This is Test5 - NZ / Soccer exactly: soccer resolves
        // irrigationFrequency 'moderate' (getIrrigationFrequency()), and the
        // two surfaces disagreed 8 against 5.9. They are in the same band, so
        // the recommender cannot tell them apart — which is why closing this
        // input gap does NOT by itself make the Plan and the document agree on
        // Test5's Delivered figures. See docs/instructions.md, GH-422.
        const at = (cec) => ({ soilCEC: cec, irrigationFrequency: 'moderate' });
        expect(Recommender.getReleasePreference(at(TEST5_CEC)))
            .toBe(Recommender.getReleasePreference(at(OLD_PLAN_DEFAULT)));
        expect(Recommender.estimateLongevity('slow', at(TEST5_CEC)))
            .toBe(Recommender.estimateLongevity('slow', at(OLD_PLAN_DEFAULT)));
        expect(Recommender.estimateLongevity('standard', at(TEST5_CEC)))
            .toBe(Recommender.estimateLongevity('standard', at(OLD_PLAN_DEFAULT)));
    });

    test('CEC does change the answer when it crosses a band', () => {
        // Guards the measurement above against reading as "CEC is inert".
        const at = (cec) => ({ soilCEC: cec, irrigationFrequency: 'frequent' });
        expect(Recommender.getReleasePreference(at(4.9))).toBe('strong_slow');
        expect(Recommender.getReleasePreference(at(5.1))).toBe('moderate_slow');
        expect(Recommender.getReleasePreference({ soilCEC: 20, irrigationFrequency: 'frequent' })).toBe('any');
    });

    test('a null CEC is still resolved by the recommender itself, at 10', () => {
        // NOT introduced by GH-422 and deliberately not changed by it: this is
        // prebbles-products.js's own long-standing "default to medium if not
        // provided". GH-422 stops the INTEGRATION inventing an 8; where a
        // sample has no reading the recommender's own assumption applies, and
        // both surfaces now name it on screen and in the document rather than
        // showing a figure that looks measured.
        const none = { soilCEC: null, irrigationFrequency: 'moderate' };
        expect(Recommender.getReleasePreference(none))
            .toBe(Recommender.getReleasePreference({ soilCEC: 10, irrigationFrequency: 'moderate' }));
    });
});

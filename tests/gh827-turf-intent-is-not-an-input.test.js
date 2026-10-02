/**
 * GH-827 (the owner's finding, her answer "(a)") — "TURF INTENT" IS NOT AN INPUT OF THE ANALYSIS.
 *
 * The analysis listed "Turf Intent" among its inputs, defaulted it to "unknownIntent" for a site with no intent, and
 * printed "Turf Intent is not set — the analysis ran on \"unknownIntent\"" on four sites -- while no calculation read
 * the value. With the key went a confidence penalty of 20 into the quality figure the analysis stores. The owner
 * decided: remove it from the list of inputs; the calculation does not change and there is no field.
 *
 * The expectations are what MUST remain, written out by hand, and compared both ways.
 */
'use strict';

const { load } = require('./lib/orchestrator-bench');

const KEYS_THAT_REMAIN = ['speciesKey', 'surfaceKey', 'climateRegimeKey', 'regionKey'];
// A sports pitch with no intent, the state the four sites are in.
const SOCCER = { turf: { grassSpecies: 'Perennial Ryegrass', turfType: 'sports', subCategory: 'soccer' }, site: {}, location: { lat: -43.5, lon: 172.6 } };

function resolved() {
    const { ctx } = load();
    const IE = ctx.GilbaIdentityEnforcement;
    IE.validateIdentity(SOCCER);
    const st = IE.getIdentityState();
    return { IE, assumptions: st.assumptions.map((a) => a.key), penalty: st.quality.totalConfidencePenalty, keys: Object.keys(IE.IDENTITY_KEYS) };
}

describe('GH-827 — Turf Intent is not an input of the analysis', () => {
    test('the declared inputs are exactly the ones that remain', () => {
        const r = resolved();
        process.stdout.write('[gh827] declared keys: ' + r.keys.length + ' ' + JSON.stringify(r.keys) + '\n');
        expect(r.keys.slice().sort()).toEqual(KEYS_THAT_REMAIN.slice().sort());
    });

    test('no engine declares it, in any of its fields', () => {
        const r = resolved();
        const naming = Object.keys(r.IE.ENGINE_REQUIREMENTS).filter((e) => /turfIntent/.test(JSON.stringify(r.IE.ENGINE_REQUIREMENTS[e])));
        process.stdout.write('[gh827] engines examined: ' + Object.keys(r.IE.ENGINE_REQUIREMENTS).length + '; naming it: ' + JSON.stringify(naming) + '\n');
        expect(naming).toEqual([]);
    });

    test('a sports pitch with no intent: no assumption about it is recorded', () => {
        const r = resolved();
        process.stdout.write('[gh827] assumptions: ' + r.assumptions.length + ' ' + JSON.stringify(r.assumptions) + '\n');
        expect(r.assumptions).toEqual(['climateRegimeKey', 'regionKey']);
    });

    test('and the quality figure the analysis stores no longer carries its penalty', () => {
        const r = resolved();
        // The declared penalties of the two assumptions that remain: climate regime 10, region 5.
        process.stdout.write('[gh827] total confidence penalty: ' + r.penalty + '\n');
        expect(r.penalty).toBe(15);
    });
});

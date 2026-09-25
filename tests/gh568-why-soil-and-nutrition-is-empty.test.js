/**
 * GH-568 — WHY THE OWNER'S OWN RE-RUN SHOWED NO SOIL & NUTRITION, AND WHY NOTHING
 * SAID SO.
 *
 * Her words: "I did a Re-run, and Soil and Nutrition did not compute here" and
 * "nowhere, by the way, does it say that it did not compute".
 *
 * THE SPECIMEN: `analysis_results` id 31, Test5 - NZ, 22.09 08:23:29 —
 * `outcome = complete`, 13 metrics, 20 computed blocks, `soilNutrition` present
 * with 18 keys, `pH = 6`, `ECe = 1.12`, and **`nutrients` of length 0** with
 * `verdict = "NO DATA"`. Read with SELECT; the row is not touched.
 *
 * Three questions were asked and each is answered by running something, not by
 * reading it.
 */

'use strict';

const fs = require('fs');
const path = require('path');
const { load } = require('./lib/orchestrator-bench');

/**
 * The site's own soil sample, `samples` id 141, read with SELECT and written
 * down. It is COMPLETE — this is not a site with no data.
 */
const SAMPLE_AS_STORED = {
    B: '0.2', K: '40', P: '40', S: '75', Ca: '803', Cu: '1.3', EC: '0.16',
    Fe: '168', Mg: '129', Mn: '28.3', OM: '3.7', Zn: '5.7', pH: '6', CEC: '5.9',
    zone: 'Other', _label: 'Soccer',
};

const numeric = (o) => Object.keys(o).reduce((acc, k) => {
    const n = parseFloat(o[k]);
    acc[k] = isNaN(n) ? o[k] : n;
    return acc;
}, {});

const TURF = { species: 'Perennial Ryegrass', methodology: 'ammonium_acetate' };

/**
 * GH-570 — THE ROW, not a retyping of it.
 *
 * `app/tests/fixtures/q31-analysis-results-live-rows.json` holds
 * `analysis_results` id 31 as SELECT returned it: its metrics, its journal, and
 * the whole `computed.soilNutrition` block the screen was handed on 22.09. The
 * measurements below are made against that, so that what is being measured is
 * the owner's run and not a reconstruction of it.
 */
const LIVE = JSON.parse(fs.readFileSync(
    path.join(__dirname, '..', 'app', 'tests', 'fixtures', 'q31-analysis-results-live-rows.json'), 'utf8'));

jest.setTimeout(60000);

describe('GH-568 — question 1: the nutrient list is empty while pH and ECe are not', () => {
    test('the sample is complete — this is not a site without data', () => {
        // The premise, stated as a measurement so the rest is not about a site
        // that simply had nothing to analyse.
        ['K', 'P', 'Ca', 'Mg', 'S', 'CEC', 'pH', 'EC'].forEach((k) => {
            expect([k, SAMPLE_AS_STORED[k] !== undefined]).toEqual([k, true]);
        });
    });

    test('MEASUREMENT: given numbers, the engine produces a full table', async () => {
        // The control, and the half that says the engine works: ten rows, which
        // is ten nutrient cards.
        const { ctx } = load();
        expect(typeof ctx.mlsnEngine).toBe('function');

        // GH-574: the engine returns `{ html, nutrients }` now. Both halves are
        // measured, because the rows are what the cards are built from and the
        // markup is what the page shows.
        const out = ctx.mlsnEngine({ soil: numeric(SAMPLE_AS_STORED), turf: TURF }, {});
        expect(out.nutrients.length).toBeGreaterThan(0);
        const html = out.html;
        expect(typeof html).toBe('string');
        const rows = (html.match(/<tr[\s\S]*?<\/tr>/gi) || [])
            .filter((r) => (r.match(/<td/gi) || []).length >= 5);
        process.stdout.write('[q31] engine on numbers: ' + typeof html + ', rows ' + rows.length + '\n');
        expect(rows.length).toBeGreaterThanOrEqual(10);
    });

    test('MEASUREMENT: given the values AS THE STORE HOLDS THEM, the engine throws', async () => {
        // `samples.payload` holds strings — `"40"`, `"803"` — and this is what
        // the engine does with them.
        const { ctx } = load();
        let threw = null;
        try { ctx.mlsnEngine({ soil: SAMPLE_AS_STORED, turf: TURF }, {}); }
        catch (e) { threw = e && e.message; }

        process.stdout.write('[q31] engine on the stored strings: ' + JSON.stringify(threw) + '\n');
        expect(threw).toMatch(/toFixed is not a function/);
    });

    test('MEASUREMENT: a throw no longer produces a silent empty list', () => {
        // WHAT THIS CASE USED TO RECORD. `cascade-orchestrator.js` caught the
        // throw and returned `{status:'Error', recommendations:[]}`; the
        // producer asked `typeof computed.mlsn === 'string'`, got an object,
        // left `_mlsnHtml` empty — so `_nutrients` stayed `[]` and `verdict`
        // stayed its initial `'NO DATA'`, with nothing anywhere saying a
        // computation had failed. The nutrient cards were PARSED OUT OF THE
        // RENDERED HTML, which is why an engine that produced no HTML produced
        // no cards and no complaint.
        //
        // GH-574 CLOSED BOTH HALVES, and this case now holds them closed.
        const cascade = fs.readFileSync(path.join(__dirname, '..', 'assets', 'cascade-orchestrator.js'), 'utf8');
        const producer = fs.readFileSync(path.join(__dirname, '..', 'assets', 'hub-persistence.js'), 'utf8');

        // 1. The cards no longer come from markup. There is no scrape left to
        //    come up empty.
        expect(producer).not.toMatch(/parseFromString/);
        expect(producer).not.toMatch(/gaip-mlsn-table tbody tr/);

        // 2. The failure is still a failure — it is not swallowed into a
        //    plausible-looking result — and it now says so twice: in the run's
        //    journal, and by naming the module that produced nothing.
        expect(cascade).toMatch(/warn\('MLSN engine failed:', e\);/);
        expect(cascade).toMatch(/GaipOrchestrator\.recordProblem/);
        expect(cascade).toMatch(/noteSkipped\(key, key, 'engine-produced-nothing', key\)/);

        // 3. `computed.mlsn` is still the HTML string for every reader that had
        //    one, so nothing downstream changed shape.
        expect(producer).toMatch(/typeof _gaipState\.computed\.mlsn === 'string'/);
    });

    test('MEASUREMENT: the cascade’s own warning does not reach the run’s journal', () => {
        // Which is why nothing said so. `cascade-orchestrator.js` has its own
        // `warn`, separate from the orchestrator's — the one GH-557 taught to
        // accumulate — so "MLSN engine failed" goes to the console and stops
        // there. The specimen's `computed.warnings` carries two entries and
        // neither is this one.
        const cascade = fs.readFileSync(path.join(__dirname, '..', 'assets', 'cascade-orchestrator.js'), 'utf8');
        const own = cascade.match(/function warn\([\s\S]{0,240}/);
        expect(own).not.toBeNull();
        expect(own[0]).not.toMatch(/computed\.warnings/);
        expect(own[0]).not.toMatch(/noteSkipped/);
    });
});

describe('GH-568 — question 1b: what the screen draws when the list comes back empty', () => {
    /**
     * The page, with a document that does nothing but hand back what was
     * written into it. `render` is internal, so it is exported for the test
     * beside the module's own export line rather than reached at by name.
     */
    function renderWith(sn) {
        const vm = require('vm');
        const src = fs.readFileSync(path.join(__dirname, '..', 'assets', 'soil-nutrition-analysis.js'), 'utf8');
        const exportLine = 'global.GAIP_SoilNutritionAnalysis = { init: init, mountSampleDropdown: mountSampleDropdown };';
        expect(src).toContain(exportLine);
        const testSrc = src.replace(exportLine,
            exportLine + '\n        global.GAIP_SoilNutritionAnalysis.__test_render = render;');

        let painted = null;
        const container = { set innerHTML(v) { painted = v; }, get innerHTML() { return painted; } };
        const sandbox = {
            window: {},
            document: {
                getElementById: (id) => (id === 'sn-page-content' ? container : null),
                createElement: () => ({ textContent: '', innerHTML: '' }),
                querySelector: () => null,
                querySelectorAll: () => [],
            },
            console: { log() {}, warn() {}, error() {} },
            localStorage: { getItem: () => null, setItem() {} },
        };
        sandbox.global = sandbox;
        sandbox.globalThis = sandbox;
        const ctx = vm.createContext(sandbox);
        vm.runInContext(testSrc, ctx, { filename: 'soil-nutrition-analysis.js' });
        ctx.window.GAIP_DASHBOARD_DATA = { computed: { soilNutrition: sn } };
        ctx.global.GAIP_DASHBOARD_DATA = ctx.window.GAIP_DASHBOARD_DATA;
        ctx.window.GAIP_SoilNutritionAnalysis.__test_render();
        return painted;
    }

    /** A run where the engine DID answer, so the assertions below have a control. */
    const WORKED = Object.assign({}, LIVE.specimen.computedSoilNutrition, {
        verdict: 'HIGH-RISK',
        nutrients: [{ nutrient: 'K', current: 40, mlsn: 37, status: 'adequate' }],
    });

    test('CONTROL: when the engine answered, the page names the section and the verdict', () => {
        const html = renderWith(WORKED);
        expect(html).toContain('Nutrient Status');
        expect(html).toContain('Soil Nutrition:');
    });

    test('MEASUREMENT: the live block prints no verdict, no cards, and no notice at all', () => {
        // The specimen exactly as stored: `nutrients` length 0, verdict
        // "NO DATA".
        const html = renderWith(LIVE.specimen.computedSoilNutrition);

        // 1. The empty state does not fire. Its guard is
        //    `!sn.nutrients && !sn.tissue`, and `[]` is truthy, so a list that
        //    came back empty is not an absence as far as this page is
        //    concerned.
        expect(html).not.toContain('No Soil &amp; Nutrition Data');

        // 2. The cards are gone without a word: `nutrientsHtml` is built only
        //    when `nutrients.length`, and there is no else.
        expect(html).not.toContain('Nutrient Status');

        // 3. The verdict banner is gone too, and for a second, separate reason:
        //    the stored verdict is "NO DATA" with a SPACE, `renderVerdict`
        //    normalises only a hyphen, so the lookup misses and falls back to
        //    NO_DATA — whose `decision` is null, and the function returns ''.
        expect(LIVE.specimen.computedSoilNutrition.verdict).toBe('NO DATA');
        expect(html).not.toContain('Soil Nutrition: No Data');
        expect(html).not.toContain('sn-verdict-title');

        // 4. And the page is NOT blank — the rest of it renders around the
        //    hole, which is why it reads as a page that simply has nothing to
        //    say about nutrients.
        process.stdout.write('[q31] screen on the live block: ' + html.length + ' chars, sections: '
            + JSON.stringify((html.match(/sn-section-title\">([^<]+)/g) || [])
                .map((m) => m.replace(/.*\">/, ''))) + '\n');
        expect(html).toContain('Tissue Test Results');
        expect(html.length).toBeGreaterThan(1000);

        // 5. Nothing anywhere says a computation did not happen. This is the
        //    owner's sentence, as an assertion.
        [/did not compute/i, /could not/i, /not calculated/i, /failed/i, /unavailable/i, /blocked/i]
            .forEach((re) => expect(html).not.toMatch(re));
    });

    test('MEASUREMENT: the two silences are independent — fixing the verdict word alone still says nothing', () => {
        // Worth separating, because "NO DATA" vs "NO_DATA" looks like the whole
        // bug and is not. With the word corrected the lookup hits NO_DATA — and
        // NO_DATA carries no `decision`, so `renderVerdict` still returns ''.
        const spelled = Object.assign({}, LIVE.specimen.computedSoilNutrition, { verdict: 'NO_DATA' });
        const html = renderWith(spelled);
        expect(html).not.toContain('Soil Nutrition: No Data');
        expect(html).not.toContain('sn-verdict-title');
    });
});

describe('GH-568 — question 2: a journal that holds successes cannot drive a warning', () => {
    /** The specimen's two entries, out of the row itself (GH-570). */
    const WARNINGS = LIVE.specimen.detail.warnings;

    test('MEASUREMENT: the two entries are indistinguishable by shape', () => {
        // Same three fields, same types, in the same array. Nothing in the
        // record says one is an obstruction and the other is a receipt — so a
        // panel driven by this list would say "something is wrong" on a run
        // where nothing was.
        const shapeOf = (w) => Object.keys(w).sort().join(',');
        expect(shapeOf(WARNINGS[0])).toContain('message');
        expect(shapeOf(WARNINGS[1])).toContain('message');
        expect(typeof WARNINGS[0].module).toBe(typeof WARNINGS[1].module);
        // and no level, severity or kind anywhere
        WARNINGS.forEach((w) => {
            ['level', 'severity', 'kind', 'blocked'].forEach((f) => expect(w[f]).toBeUndefined());
        });
    });

    test('MEASUREMENT: `skipped` is the field that already distinguishes them, and it is empty here', () => {
        // GH-557 built two lists: `warnings` (what was said) and `skipped`
        // (what is MISSING from the result, with a reason). The blocked wear
        // engine produced a warning and no `skipped` entry, because only the
        // three steps GH-557 touched record one. The specimen: warnings 2,
        // skipped 0.
        /**
         * GH-734: THE CLAIM IS WHICH STEPS RECORD A SKIP, NOT HOW MANY.
         *
         * This counted the call sites and pinned the count at three, because three steps recorded
         * one when GH-557 built the two lists. Item 3az legitimately added a fourth subject -- the
         * soil-temperature physics refuses with `setting-missing` or `soil-moisture-unavailable`
         * instead of computing on a substituted profile and a substituted moisture -- and the count
         * went to five while nothing this case is about had changed.
         *
         * A count is a fact about the batch. What this case is about is that `skipped` DISTINGUISHES
         * an obstruction from a receipt, and that the wear step -- the specimen's own blocked engine
         * -- records no skip, which is why the specimen has warnings 2 and skipped 0. So the SET of
         * subjects is asserted by name, in both directions: a step that starts recording one and a
         * step that stops are each red, and neither is mistaken for the other.
         */
        const orch = fs.readFileSync(path.join(__dirname, '..', 'assets', 'hub-orchestrator.js'), 'utf8');
        const noted = [...orch.matchAll(/noteSkipped\("([a-z-]+)", "([a-z-]+)"/gi)]
            .map((m) => m[1] + '/' + m[2]);
        const subjects = [...new Set(noted)].sort();
        process.stdout.write('[q31] steps that record a skip: ' + JSON.stringify(subjects) + '\n');
        expect(subjects).toEqual(['disease/disease', 'forecast/forecast',
            'soil-temp-physics/soil-temp-physics', 'stress/stress']);
        /**
         * GH-734: AND THE TWO WORDS OF A PAIR ARE ONE WORD, which is a claim about every pair
         * rather than about the one that broke it. A recorded cause is found by the step it is
         * filed under (`AnalysisNotice::entryStep` reads `step` first), while the section of a
         * result key asks for the step the graph names for that key. Filed under the step it runs
         * INSIDE -- `climate` for the soil temperature -- the reason reached no section, and the
         * panel printed nothing about numbers it was missing. Asserted over the list, not over its
         * length, so the next pair written apart is red and named.
         */
        const apart = subjects.filter((s) => s.split('/')[0] !== s.split('/')[1]);
        process.stdout.write('[gh734] pairs whose step and module differ: ' + JSON.stringify(apart) + '\n');
        expect(apart).toEqual([]);
        expect(orch.slice(orch.indexOf('Step 7: Wear/recovery analysis'),
                          orch.indexOf('Step 7: Wear/recovery analysis') + 900)).not.toMatch(/noteSkipped/);
    });
});

/**
 * GH-737: the pass door's `soilNutrition` object, key by key -- the first
 * `cache.computed.soilNutrition = {` in the producer, cut at its own closing brace, comments
 * dropped, split on its top-level commas. Asserted to hold the four keys before anything is
 * said about them, so a missed cut cannot pass over nothing.
 */
function passDoorEntries(producer) {
    const at = producer.indexOf('cache.computed.soilNutrition = {');
    expect(at).toBeGreaterThan(-1);
    const open = producer.indexOf('{', at);
    let depth = 0, end = -1;
    for (let j = open; j < producer.length; j++) {
        if (producer[j] === '{') depth++;
        else if (producer[j] === '}') { depth--; if (!depth) { end = j; break; } }
    }
    const body = producer.slice(open + 1, end).replace(/\/\*[\s\S]*?\*\//g, '').replace(/\/\/[^\n]*/g, '');
    const parts = [];
    let d = 0, cur = '';
    for (const ch of body) {
        if ('({['.includes(ch)) d++;
        if (')}]'.includes(ch)) d--;
        if (ch === ',' && d === 0) { parts.push(cur); cur = ''; } else cur += ch;
    }
    parts.push(cur);
    const out = {};
    parts.forEach((p) => { const m = /^\s*(\w+)\s*:([\s\S]*)$/.exec(p); if (m) out[m[1]] = m[2].trim(); });
    ['pH', 'ECe', 'soilNa', 'CEC'].forEach((k) => expect(Object.keys(out)).toContain(k));
    return out;
}

describe('GH-568 — question 3: CEC and soilNa', () => {
    test('MEASUREMENT: CEC was a silent emptiness and soilNa was not', () => {
        // They look alike in the row and are not alike at all.
        //
        // The sample HAS a CEC — 5.9 — and the producer read CEC only from the
        // hub form (`_si.CEC || _si.cec || null`) with no path to the sample,
        // while pH and ECe both had one. So a measured value was dropped.
        //
        // The sample has NO Na at all, and `soilNa` does have a path to the
        // sample (`_soilSmpNa`). Its null is the honest answer.
        //
        // GH-572 GAVE CEC THE MISSING PATH — a second read of the sample store,
        // beside the three that were already doing it. GH-589 TOOK ALL FOUR
        // AWAY, and that is not the asymmetry coming back: the second read
        // happened at a different MOMENT from the nutrient list beside it, which
        // is how one stored row came to carry the sample's real pH and CEC over
        // ten cards reading "NOT MEASURED". All four now arrive by the one road
        // the list arrives by, `_si` — the soil the pass computed on.
        //
        // This measurement keeps the shape of the finding: the four lines side
        // by side, so an asymmetry between them cannot come back unnoticed.
        // What the repair produces is measured in
        // `gh572-cec-reaches-the-result.test.js`, against the sample's own 5.9,
        // and the one-moment claim in
        // `gh589-the-pass-comes-after-the-inputs.test.js`.
        expect(SAMPLE_AS_STORED.CEC).toBe('5.9');
        expect(SAMPLE_AS_STORED.Na).toBeUndefined();

        // GH-737: the four are held by WHAT THEY READ, not by their text. The claim is one
        // road: each of the four reads the pass's soil (`_si`), and none of them reaches into the
        // sample store a second time. The text of a line is not the claim -- GH-737 changed how
        // `soilNa` treats a measured zero and this case went red on a regex while the road stood.
        // Written this way it survives a repair of any one line (CEC's included) and reddens
        // only when a second road comes back. The object is cut at its own closing brace.
        const producer = fs.readFileSync(path.join(__dirname, '..', 'assets', 'hub-persistence.js'), 'utf8');
        const entries = passDoorEntries(producer);
        const FOUR = ['pH', 'ECe', 'soilNa', 'CEC'];
        process.stdout.write('[gh568] pass door, what the four read: ' + JSON.stringify(FOUR.map((k) =>
            [k, (String(entries[k] || '').match(/\b_si\.\w+|_soilSmp\w*|GAIP_SampleManager|_sm\w+/g) || [])])) + '\n');
        FOUR.forEach((k) => expect({ [k]: /\b_si\./.test(entries[k] || '') }).toEqual({ [k]: true }));
        // and not one of them reaches past the pass into the store a second time
        const secondRoad = FOUR.filter((k) => /_soilSmp|GAIP_SampleManager|getAllSamples|getSamples|_sm[A-Z]/.test(entries[k] || ''));
        expect({ secondRoad }).toEqual({ secondRoad: [] });
    });
});

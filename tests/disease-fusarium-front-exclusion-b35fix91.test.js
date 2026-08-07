/**
 * Fusarium excluded from the front of the Disease Risk page (client comment #91)
 *
 * Client feedback (docs/instructions.md #91): Fusarium's model is tagged
 * `validationStatus: 'unvalidated'` (assets/disease-engine-pure.js, "#88:
 * Gilba weighted-sum, not peer-validated") and was giving readings the client
 * didn't trust (100% in cold, dry Christchurch weather). A prior comment (#88)
 * already excluded Fusarium/Large Patch/Drechslera from the 7-day forecast
 * graph. #91 asks for the rest of the page too: the alert banner, the
 * "Overall Disease Risk" hero score, and the Active Threats list (previously
 * shown there with an "Unvalidated" badge — client decided the badge alone
 * wasn't enough).
 *
 * Scope: Fusarium by key (`disease === 'fusarium'`), not a blanket
 * `validationStatus === 'unvalidated'` exclusion — client explicitly did not
 * ask to also hide Large Patch (same tag), so this must not catch it.
 *
 * Approach: filter Fusarium out of the *display* aggregates (overallScore,
 * topThreats, the Active Threats list) — never zero its actual computed
 * score. The real number stays in `diseases[]` for anyone/anything that
 * reads the raw result (reports, exports, future re-validation), it just
 * isn't featured on this page's front.
 *
 * Spec: tests/disease-fusarium-front-exclusion-b35fix91.test.js
 */

'use strict';

global.window   = global;
global.document = global.document || { addEventListener: () => {}, documentElement: {}, querySelector: () => null };
global.console  = { group: () => {}, groupEnd: () => {}, groupCollapsed: () => {}, table: () => {},
                    log: () => {}, warn: () => {}, info: () => {}, error: () => {} };

const fs   = require('fs');
const path = require('path');

const DiseaseEnginePure = require(path.join(__dirname, '../assets/disease-engine-pure.js'));
global.DiseaseEnginePure = DiseaseEnginePure;
require(path.join(__dirname, '../assets/disease-stress-climate-coupling.js'));

// Cold, wet winter climate that reliably makes Fusarium the top raw score
// (mirrors the real Russley scenario from this fix's investigation) while
// Take-all stays present but lower — gives us a real "was top, now isn't"
// case rather than a fixture where Fusarium was never going to win anyway.
const COLD_WET_CLIMATE = {
    temperature: { min: -3, max: 16.2, mean: 6.6, current: 7.6 },
    moisture: {
        humidity: { mean: 88, current: 88, min: 55, max: 100 },
        precipitation: { total: 0 },
    },
};

const STRESS_AGGREGATES = {
    factors: [{ type: 'temperature', impact: 'growth', severity: 0.84, note: 'Growth potential 8%' }],
    severity: 'moderate', factorCount: 1, combinedGrowthModifier: 0.58, environmentalStressIndex: 34.5,
};

function analyseBrowntopBent() {
    return DiseaseEnginePure.analyse({
        climate: COLD_WET_CLIMATE,
        dewData: null,
        nitrogen: { status: 'adequate' },
        shade: null,
        soil: null,
        variety: null,
        species: 'browntopBent',
        region: 'NZ',
        tissueNutrients: null,
    });
}

describe('disease-engine-pure.js — Fusarium excluded from overallScore/topThreats', () => {
    test('fixture sanity: Fusarium is genuinely the top raw score under these conditions', () => {
        const raw = analyseBrowntopBent();
        const fusarium = raw.diseases.find(d => d.disease === 'fusarium');
        expect(fusarium).toBeDefined();
        expect(fusarium.adjustedRisk).toBeGreaterThan(90);
        const maxRaw = Math.max(...raw.diseases.map(d => d.adjustedRisk || 0));
        expect(fusarium.adjustedRisk).toBe(maxRaw); // it really is the top score pre-filter
    });

    test('overallScore is not driven by Fusarium', () => {
        const result = analyseBrowntopBent();
        const fusarium = result.diseases.find(d => d.disease === 'fusarium');
        expect(result.overallScore).toBeLessThan(fusarium.adjustedRisk);
    });

    test('topThreats never contains fusarium', () => {
        const result = analyseBrowntopBent();
        expect(result.topThreats.some(t => t.disease && t.disease.toLowerCase().includes('fusarium'))).toBe(false);
    });

    test('Fusarium\'s real score is still present in diseases[] — not zeroed', () => {
        const result = analyseBrowntopBent();
        const fusarium = result.diseases.find(d => d.disease === 'fusarium');
        expect(fusarium.adjustedRisk).toBeGreaterThan(90);
    });

    test('Large Patch is NOT excluded — client asked for Fusarium specifically, not every unvalidated model', () => {
        const src = fs.readFileSync(path.join(__dirname, '../assets/disease-engine-pure.js'), 'utf8');
        // The #91 exclusion must key on 'fusarium' by name, not on validationStatus
        // generically (which would also catch largePatch, tagged the same way).
        const validatedFilterPos = src.indexOf("const validated = diseases.filter(");
        expect(validatedFilterPos).toBeGreaterThan(-1);
        const filterLine = src.slice(validatedFilterPos, src.indexOf('\n', validatedFilterPos));
        expect(filterLine).toContain("d.disease !== 'fusarium'");
        expect(filterLine).not.toContain("'unvalidated'");
    });
});

describe('disease-stress-climate-coupling.js — same exclusion after coupling recomputes topThreats', () => {
    test('overallScore and topThreats stay Fusarium-free post-coupling', () => {
        const raw = analyseBrowntopBent();
        const coupled = global.GAIP_DiseaseStressCoupling.apply(raw, STRESS_AGGREGATES, COLD_WET_CLIMATE, { species: 'browntopBent' });
        const fusarium = coupled.diseases.find(d => d.disease === 'fusarium');
        expect(coupled.overallScore).toBeLessThan(fusarium.adjustedRisk);
        expect(coupled.topThreats.some(t => t.disease && t.disease.toLowerCase().includes('fusarium'))).toBe(false);
        // Real value still intact after coupling too.
        expect(fusarium.adjustedRisk).toBeGreaterThan(90);
    });

    test('Large Patch not excluded here either', () => {
        const src = fs.readFileSync(path.join(__dirname, '../assets/disease-stress-climate-coupling.js'), 'utf8');
        const filterPos = src.indexOf('var validatedDiseases = diseaseResult.diseases.filter(');
        expect(filterPos).toBeGreaterThan(-1);
        const filterBlock = src.slice(filterPos, src.indexOf('});', filterPos));
        expect(filterBlock).toContain("d.disease !== 'fusarium'");
        expect(filterBlock).not.toContain("'unvalidated'");
    });
});

describe('disease-analysis.js — Fusarium excluded from the Active Threats list and companion (fairway/tee) surface', () => {
    const src = fs.readFileSync(path.join(__dirname, '../assets/disease-analysis.js'), 'utf8');

    test('filterDiseases() excludes fusarium (drives the Active Threats list + alert banner)', () => {
        const fnPos = src.indexOf('function filterDiseases(');
        expect(fnPos).toBeGreaterThan(-1);
        const fnBody = src.slice(fnPos, src.indexOf('\n    }', fnPos));
        expect(fnBody).toContain("d.disease !== 'fusarium'");
    });

    test('all three companion-surface disease filters exclude fusarium', () => {
        const matches = src.match(/d\.disease !== 'fusarium'/g) || [];
        // filterDiseases() (1) + companionDiseases (1) + companion render (1) + drSelectCompanion (1) = 4
        expect(matches.length).toBeGreaterThanOrEqual(4);
    });

    test('filterDiseases() itself does not use the broader validationStatus check (Large Patch scope guard)', () => {
        // buildForecastSeries() (the pre-existing #88 forecast-graph exclusion)
        // legitimately uses `validationStatus !== 'unvalidated'`, which is
        // broader (also catches Large Patch) — that's correct and untouched.
        // filterDiseases() must NOT pick up that broader check; it should stay
        // scoped to Fusarium by key.
        const fnPos = src.indexOf('function filterDiseases(');
        const fnBody = src.slice(fnPos, src.indexOf('\n    }', fnPos));
        expect(fnBody).not.toMatch(/validationStatus\s*!==\s*['"]unvalidated['"]/);
    });
});

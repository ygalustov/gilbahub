/**
 * GH-546 (stage 0) — the declared form of an analysis result, checked
 * against the tree in both directions.
 *
 * WHY A SCHEMA NEEDS A TEST TO BE A SCHEMA. `assets/analysis-result.schema.json`
 * says what a complete result is. Nothing reads it at runtime yet — the server
 * still validates "is it an array" and the producer still emits a key only when
 * its value is not undefined. Until stages 1 and 2 wire it in, the only thing
 * standing between the declaration and the code is this file. A form nobody
 * checks is a comment with brackets.
 *
 * BOTH DIRECTIONS, because one direction is half a guard:
 *   forwards — every key the schema declares can actually be emitted by
 *              `collectDashboardMetrics()`;
 *   backwards — every key that function can emit is declared somewhere in the
 *              schema (required, conditional or branch-dependent).
 * A new key added to the producer and not to the schema fails the second; a key
 * declared and then removed from the producer fails the first.
 *
 * HOW THE PRODUCER'S KEY SET IS OBTAINED. By reading the source of the one
 * function, not by running it: live tests are banned for this work and the stand
 * was not touched. The function assigns each key as `metrics.<name> =`, plus the
 * literal `timestamp` in the initialiser — so the set is recoverable exactly,
 * and the extraction is asserted to have found something before it is compared,
 * or an empty set would agree with an empty schema and prove nothing.
 *
 * WHAT IS NOT CHECKED HERE, named so the next reader does not mistake the scope:
 *   - that a COMPLETED run emits all thirteen required keys. That is a property
 *     of a run, and no run may be performed in this pass. What the stand shows
 *     instead is asserted below from the rows themselves, quoted as constants.
 *   - the `computed` subtree. It has no single producer — it is the
 *     orchestrator's state copied wholesale — so the schema lists it as observed
 *     consumer reads, and this file checks only that the list is non-empty and
 *     syntactically sane.
 */

'use strict';

const fs = require('fs');
const path = require('path');

const ROOT = path.join(__dirname, '..');
const SCHEMA = JSON.parse(fs.readFileSync(path.join(ROOT, 'assets', 'analysis-result.schema.json'), 'utf8'));
const PRODUCER_SRC = fs.readFileSync(path.join(ROOT, 'assets', 'hub-persistence.js'), 'utf8');

/** The body of collectDashboardMetrics(), from its own name to the next function. */
function producerBody() {
    const start = PRODUCER_SRC.indexOf('function collectDashboardMetrics()');
    expect(start).toBeGreaterThan(-1);
    // The function ends at `return metrics;` — everything after belongs elsewhere.
    const end = PRODUCER_SRC.indexOf('return metrics;', start);
    expect(end).toBeGreaterThan(start);
    return PRODUCER_SRC.slice(start, end);
}

/** Every key the producer can put on the object it returns. */
function producerKeys() {
    const body = producerBody();
    const keys = new Set();
    // The initialiser: `const metrics = { timestamp: ... }`
    const init = body.match(/const\s+metrics\s*=\s*\{([\s\S]*?)\}/);
    if (init) {
        const m = init[1].match(/^\s*([a-zA-Z_][a-zA-Z0-9_]*)\s*:/gm) || [];
        m.forEach((s) => keys.add(s.trim().replace(':', '')));
    }
    // Every later assignment: `metrics.<name> =` and `metrics['<name>'] =`
    let g;
    const dot = /metrics\.([a-zA-Z_][a-zA-Z0-9_]*)\s*=[^=]/g;
    while ((g = dot.exec(body))) keys.add(g[1]);
    const brk = /metrics\[\s*['"]([a-zA-Z_][a-zA-Z0-9_]*)['"]\s*\]\s*=[^=]/g;
    while ((g = brk.exec(body))) keys.add(g[1]);
    return keys;
}

function declaredKeys() {
    const out = new Set(SCHEMA.metrics.required);
    Object.keys(SCHEMA.metrics.conditional).forEach((k) => { if (k !== '$comment') out.add(k); });
    Object.keys(SCHEMA.metrics.branchDependent).forEach((k) => { if (k !== '$comment') out.add(k); });
    return out;
}

/**
 * The rows on the stand as of 22.09, read with SELECT and quoted here as
 * constants. They are not re-read by this test — the stand is not a fixture and
 * this suite must run without it — but the schema was built from them, so the
 * numbers travel with it and a later reader can re-take the measurement and
 * compare against something written down.
 */
const STAND_22_09 = {
    fullRowKeys: [
        'peakDay', 'soilTemp', 'timestamp', 'topDisease', 'diseaseRisk', 'stressIndex',
        'forecastPeak', 'weatherSource', 'irrigationNeed', 'trendDirection',
        'forecastDisease', 'growthPotential', 'irrigationDeficit',
    ],
    rows: 12,
    full: 11,
    russleyMissing: ['weatherSource'],
    federalGolfKeys: ['et', 'gdd', 'soilTemp', 'timestamp', 'growthPotential'],
};

describe('GH-546 — the schema and the producer agree, in both directions', () => {

    test('the extraction found the producer at all', () => {
        // Guards the two comparisons below: an empty set agrees with anything.
        const keys = producerKeys();
        expect(keys.size).toBeGreaterThan(10);
        expect(keys.has('timestamp')).toBe(true);
        expect(keys.has('growthPotential')).toBe(true);
    });

    test('forwards: every key the schema declares can be emitted by the producer', () => {
        const emitted = producerKeys();
        const undeclarable = Array.from(declaredKeys()).filter((k) => !emitted.has(k));
        expect(undeclarable).toEqual([]);
    });

    test('backwards: every key the producer can emit is declared in the schema', () => {
        const declared = declaredKeys();
        const undeclared = Array.from(producerKeys()).filter((k) => !declared.has(k));
        // A key added to collectDashboardMetrics() and not to the schema lands
        // here. That is the whole point of the file: the form stops being
        // "whatever came out".
        expect(undeclared).toEqual([]);
    });

    test('the required set is exactly what every full row on the stand carries', () => {
        expect(SCHEMA.metrics.required.slice().sort())
            .toEqual(STAND_22_09.fullRowKeys.slice().sort());
        expect(SCHEMA.metrics.required.length).toBe(13);
    });

    test('the two keys that only the thin row carries are declared, not ignored', () => {
        // `et` and `gdd` are the pair that made Federal Golf's row look like a
        // different collector. They are branch-dependent, not unknown.
        const branch = Object.keys(SCHEMA.metrics.branchDependent).filter((k) => k !== '$comment');
        expect(branch.slice().sort()).toEqual(['et', 'gdd']);
        branch.forEach((k) => expect(SCHEMA.metrics.required).not.toContain(k));
    });

    test('the producer really does have the two climate branches the schema names', () => {
        // The schema's branchDependent block rests on this shape; if the branches
        // are merged one day, the claim in the file stops being true silently.
        const body = producerBody();
        expect(body).toMatch(/const\s+_cm\s*=\s*global\.climateMetrics/);
        expect(body).toMatch(/if\s*\(_cm\)/);
        expect(body).toMatch(/else if\s*\(_cc\)/);
        // gdd and et are assigned inside the _cm branch and nowhere else.
        const cmBranch = body.slice(body.indexOf('if (_cm)'), body.indexOf('else if (_cc)'));
        expect(cmBranch).toContain('metrics.gdd');
        expect(cmBranch).toContain('metrics.et');
        const rest = body.slice(body.indexOf('else if (_cc)'));
        expect(rest).not.toContain('metrics.gdd');
        expect(rest).not.toContain('metrics.et');
    });

    test('Russley\'s row is expressible as incomplete under this schema', () => {
        // The defect, restated as a property of the form: twelve of the thirteen
        // required keys. Today that row is merely shorter than its neighbours;
        // under the schema it is missing a named key.
        const present = STAND_22_09.fullRowKeys.filter((k) => !STAND_22_09.russleyMissing.includes(k));
        expect(present.length).toBe(12);
        STAND_22_09.russleyMissing.forEach((k) => expect(SCHEMA.metrics.required).toContain(k));
    });

    test('the divergence list names the same keys the schema does', () => {
        const d = SCHEMA.divergence;
        expect(d.onlyOnTheThinRow.keys.slice().sort()).toEqual(['et', 'gdd']);
        expect(d.producerEmitsNoStandRowCarries.keys).toEqual(['vwc']);
        expect(d.carriedByOneRowOnly.keys).toEqual(['companionDisease']);
        expect(d.missingFromARowThatShouldHaveIt.missing).toEqual(['weatherSource']);
        // And every key it names is one the schema knows about.
        const declared = declaredKeys();
        [].concat(d.onlyOnTheThinRow.keys, d.producerEmitsNoStandRowCarries.keys,
                  d.carriedByOneRowOnly.keys, d.missingFromARowThatShouldHaveIt.missing)
            .forEach((k) => expect(declared.has(k)).toBe(true));
    });

    test('the computed list is present and reads as top-level key names', () => {
        const c = SCHEMA.computed.readByConsumers;
        expect(Array.isArray(c)).toBe(true);
        expect(c.length).toBeGreaterThan(10);
        c.forEach((k) => expect(k).toMatch(/^[a-zA-Z][a-zA-Z0-9]*$/));
        // The four the whole question turns on.
        ['soilNutrition', 'climate', 'disease', 'stress'].forEach((k) => expect(c).toContain(k));
    });
});

/**
 * GH-452 — a fixture states the scenario it is written for, not just the
 * numbers it held on the day of capture.
 *
 * Sample 144 has been through three states in three weeks — sufficient,
 * deficient, normal — because it is a test site and the owner moves it on
 * purpose. Ten tests pinned numbers from whichever day they were written, and
 * only one of them said which state it needed. When the owner moved the sample
 * again, a parity run went red with nothing wrong in the product: the harness
 * was comparing the database with a three-week-old snapshot under the name of
 * a parity check.
 *
 * So a fixture carries a `scenario` block, and this test refuses the two ways
 * that block can lie: a value that does not sit where its state says it does,
 * and a state nobody wrote down.
 *
 * The states:
 *   deficient   — below `criticalBelow` when the band names one, else below `lo`
 *   normal      — between `lo` and `hi`
 *   sufficient  — at or above `lo`
 *   irrelevant  — the number carries no assertion in this fixture; it is kept
 *                 for replay, and saying so is the point
 */

'use strict';

const fs = require('fs');
const path = require('path');

const FIXTURE_DIR = path.join(__dirname, 'fixtures');
const STATES = ['deficient', 'normal', 'sufficient', 'irrelevant'];

/**
 * GH-453: every fixture, not only the ones that already declare a scenario.
 *
 * The first version of this guard iterated the files that had a `scenario`
 * key, which made a fixture without one invisible to it — so the next fixture
 * written without a block would have arrived in silence, which is exactly the
 * failure the guard exists to prevent. (The same blind spot, on the same day,
 * as the config-writer guard: a rule that only examines the things already
 * obeying it.)
 *
 * The list below is the only way to hold a numeric tissue input without a
 * scenario block, and each entry carries its reason, so an exemption cannot
 * later be mistaken for something someone forgot.
 */
const TISSUE_EXEMPT = {
    // (empty — every fixture with a numeric tissue input declares its scenario)
};

const SOIL_EXEMPT = {
    'gh399-delivery-programme-burns-mlsn.json': 'a delivery-programme replay: it records the products '
        + 'and quantities a programme produced, and its soil figures are inputs carried along for the '
        + 'replay rather than a state under test',
};

function allFixtures() {
    return fs.readdirSync(FIXTURE_DIR)
        .filter((f) => f.endsWith('.json'))
        .map((f) => ({ name: f, data: JSON.parse(fs.readFileSync(path.join(FIXTURE_DIR, f), 'utf8')) }));
}

/** Every numeric input of one kind anywhere in a fixture, however deep. */
function numericInputs(node, key, where) {
    const found = [];
    const walk = (value, at) => {
        if (Array.isArray(value)) return value.forEach((v, i) => walk(v, at + '[' + i + ']'));
        if (!value || typeof value !== 'object') return;
        Object.keys(value).forEach((k) => {
            if (k === key && value[k] && typeof value[k] === 'object') {
                const numbers = Object.keys(value[k]).filter((n) => typeof value[k][n] === 'number');
                if (numbers.length) found.push({ at: at + '/' + k, value: value[k] });
                return;
            }
            walk(value[k], at + '/' + k);
        });
    };
    walk(node, where || '');

    return found;
}

function fixturesWithScenarios() {
    return allFixtures().filter((f) => f.data && f.data.scenario && typeof f.data.scenario === 'object');
}

/** Does `value` sit where `state` says it does? */
function holds(entry) {
    const { state, value, band } = entry;
    if (state === 'irrelevant') return true;
    if (typeof value !== 'number') return false;
    if (!band || typeof band.lo !== 'number') return state === 'sufficient' ? false : false;

    if (state === 'deficient') {
        return typeof band.criticalBelow === 'number' ? value < band.criticalBelow : value < band.lo;
    }
    if (state === 'normal') return value >= band.lo && value <= band.hi;
    if (state === 'sufficient') return value >= band.lo;

    return false;
}

describe('GH-452 — every declared scenario matches its own numbers', () => {
    const fixtures = fixturesWithScenarios();

    test('there are fixtures declaring a scenario at all', () => {
        // If this ever reads zero the suite below is asserting nothing, which
        // is the failure mode this whole ticket is about.
        expect(fixtures.length).toBeGreaterThan(0);
    });

    test.each(fixturesWithScenarios().map((f) => f.name))('%s — every entry is a known state, and its value agrees', (name) => {
        const scenario = JSON.parse(fs.readFileSync(path.join(FIXTURE_DIR, name), 'utf8')).scenario;
        const problems = [];

        Object.keys(scenario).forEach((key) => {
            if (key.startsWith('_')) return; // prose, not an entry
            const entry = scenario[key];
            if (!entry || typeof entry !== 'object') {
                problems.push(key + ': not an object');
                return;
            }
            if (STATES.indexOf(entry.state) === -1) {
                problems.push(key + ': unknown state ' + JSON.stringify(entry.state));
                return;
            }
            // A band-free entry is allowed only where the rule is stated in
            // words and checked live (soil floors are resolved by the page, not
            // by the fixture).
            if (!entry.band && !entry.rule && entry.state !== 'irrelevant') {
                problems.push(key + ': ' + entry.state + ' with neither a band nor a stated rule');
                return;
            }
            if (entry.band && !holds(entry)) {
                problems.push(key + ': declared ' + entry.state + ' but value ' + entry.value
                    + ' does not sit in ' + JSON.stringify(entry.band));
            }
        });

        expect(problems).toEqual([]);
    });

    // GH-453: both kinds of input, not only the one that happened to break.
    // A soil fixture without a declared state is the same silence as a tissue
    // one, and the harness's soil preconditions read the scenario now too.
    // A fixture declares the nutrient its case is about -- soilP for one that
    // is below the phosphorus floor, soilK for a potassium one -- so what is
    // required is an entry of the right KIND, not one particular name.
    const DECLARED_INPUTS = [
        { input: 'tissuePercent', prefix: 'tissue', exempt: TISSUE_EXEMPT },
        { input: 'soilPpm', prefix: 'soil', exempt: SOIL_EXEMPT },
    ];

    test.each(DECLARED_INPUTS.map((d) => [d.input, d]))('every fixture carrying a numeric %s declares a scenario for it', (_label, spec) => {
        const undeclared = [];

        allFixtures().forEach(({ name, data }) => {
            const inputs = numericInputs(data, spec.input);
            if (!inputs.length) return;
            if (spec.exempt[name]) {
                expect(spec.exempt[name].length).toBeGreaterThan(20); // a reason, not a word
                return;
            }
            const declared = data.scenario && Object.keys(data.scenario).some((key) =>
                key.indexOf(spec.prefix) === 0 && data.scenario[key] && data.scenario[key].state);
            if (!declared) {
                undeclared.push(name + ' (' + inputs.map((t) => t.at).join(', ') + ')');
            }
        });

        expect(undeclared).toEqual([]);
    });

    test('a scenario declared irrelevant carries no band, because a band there holds nothing', () => {
        // GH-453: `irrelevant` means the number carries no assertion, so a
        // band next to it reads as a constraint that is not enforced — and a
        // value outside it would pass. The thresholds belong in `why`.
        const offenders = [];
        fixturesWithScenarios().forEach(({ name, data }) => {
            Object.keys(data.scenario).forEach((key) => {
                if (key.startsWith('_')) return;
                const entry = data.scenario[key];
                if (entry && entry.state === 'irrelevant' && entry.band) {
                    offenders.push(name + ': ' + key);
                }
            });
        });
        expect(offenders).toEqual([]);
    });

    test('a fixture that pins tissue numbers into expected outputs says which state they encode', () => {
        // The specific trap: numbers computed through a tissue ratio, in a
        // fixture whose subject is something else entirely. Those read as
        // client data unless the block says otherwise.
        const belowFloor = JSON.parse(fs.readFileSync(
            path.join(FIXTURE_DIR, 'test5-soccer-sample141-belowfloor-gh370.json'), 'utf8'));
        expect(belowFloor.scenario.tissueK.state).toBe('deficient');
        expect(belowFloor.scenario.tissueK.why).toMatch(/expected outputs|computed through/i);
    });
});

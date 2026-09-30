'use strict';

/**
 * GH-781 — WHAT A SITE WITH NO NITROGEN PROGRAMME IS GIVEN, AND WHAT AN ENTERED ZERO IS.
 *
 * THE OWNER'S DECISION OF 30.09.2026: put it back as it was. This item's second delivery had removed
 * the figure of 200 that a site with no annual programme received, on the rule that absence travels as absence;
 * she was shown what that changed — 4 of 110 stored rows carried it, no page prints `nitrogen.opt`, and the
 * disease model reads it as a ratio against `applied: 0`, so two sites stopped being told "deficient" — and she
 * asked for it back. The wider question, the monthly field and whether Settings should ask for it, is hers and
 * is carried as an open question.
 *
 * SO THIS FILE NOW HOLDS HER BEHAVIOUR, and that is not a weakening: it asserts 200 for the case she named and
 * reddens on anything else. What it also holds is the line she did NOT draw — an annual programme entered AS
 * zero is a figure a person chose, and it stays zero. Measured before the restore: 0 of 21 site configs carry an
 * annual figure at all and 0 rows carry `opt: 0`, so nothing on the stand moves either way; the distinction is
 * kept because widening her answer would be our decision rather than hers.
 *
 * The reviewer's own finding about the MONTHLY zero (`|| 0` beside it) goes to her separately, with numbers.
 */

const fs = require('fs');
const path = require('path');
const { load } = require('./lib/orchestrator-bench');

const ROOT = path.join(__dirname, '..');
const GRAPH = JSON.parse(fs.readFileSync(path.join(ROOT, 'assets', 'dependency-graph.json'), 'utf8'));

/** The nitrogen engine as the graph declares it, so a rename reaches this file. */
function nitrogenEngineId() {
    const found = Object.keys(GRAPH.nodes).filter((id) => (GRAPH.nodes[id].outputs || [])
        .some((o) => String(o).indexOf('computed.nitrogen') === 0));
    // ONE producer of this result, compared as the list rather than as its size (the rule of `gh746`): a
    // second node declaring it would be named here instead of turning a 1 into a 2.
    expect(found).toEqual(found.slice(0, 1));
    expect(found[0]).toBeTruthy();

    return found[0];
}

/** One cascade pass over a turf section and a fertility one, and what it published for the nitrogen. */
function nitrogenOf(turf, fertility) {
    const bench = load();
    expect(bench.failed).toEqual([]);
    const inputs = { turf: turf, soil: {}, water: {}, schedule: {} };
    if (fertility !== undefined) inputs.fertility = fertility;
    bench.ctx.GAIP_STATE = Object.assign({ climate: { current: { airTemp: 18, soilTemp: 16 } } }, inputs);
    const out = bench.ctx.GilbaCascadeOrchestrator.runCascade(
        { inputs: inputs, computed: {}, derived: {} }, {},
        { fullRecompute: true, includeEngines: [nitrogenEngineId()] });

    return ((out && out.state && out.state.computed) || {}).nitrogen;
}

describe('GH-781 delivery 5 — the absence of a nitrogen programme travels as absence', () => {
    jest.setTimeout(120000);

    test('CASE 1 — nothing entered: the owner\'s figure of 200, and the sentence says why', () => {
        const n = nitrogenOf({ turfType: 'greens', species: 'bentgrass' });
        process.stdout.write('\n[gh781] entered nothing -> ' + JSON.stringify(n) + '\n');

        expect(n.skipped).toBe(true);
        // HER DECISION, by its number: a site with no programme is given 200, as before this item touched it.
        expect(n.opt).toBe(200);
        expect(n.status).toBe('No N programme entered');
    });

    test('CASE 2 — an ENTERED ZERO is a figure the site gave, and it survives', () => {
        /**
         * GH-781 (delivery 5, the reviewer's reading) — the previous form of this case blessed the erasure
         * of an entered zero: `opt: nRate || null` answered `null` for it, and the case called that right.
         * Zero is the one figure that says something definite, and reading it as "unanswered" is the rule we
         * burned on in GH-731. The two are now distinguished, which is what these two cases are FOR.
         */
        const entered = 0;
        const n = nitrogenOf({ turfType: 'greens', species: 'bentgrass', nProgramKgHaYr: entered });
        process.stdout.write('[gh781] entered 0       -> ' + JSON.stringify(n) + '\n');

        expect(n.opt).toBe(entered);
        expect(n.opt).not.toBeNull();
        // And it is NOT the sentence about an unentered programme: the site entered one.
        expect(n.status).not.toBe('No N programme entered');
    });

    test('CASE 3 — a programme entered with no monthly figure: the number AND the words agree', () => {
        /**
         * The reviewer's first finding: this case used to assert the figure while nothing looked at the word
         * beside it, and the word said "No N programme entered" over the programme's own number. Both are
         * asserted here, so they cannot disagree again without a red.
         */
        const entered = 150;
        const n = nitrogenOf({ turfType: 'greens', species: 'bentgrass', nProgramKgHaYr: entered });
        process.stdout.write('[gh781] entered 150     -> ' + JSON.stringify(n) + '\n');

        expect(n.opt).toBe(entered);
        expect(n.skipped).toBe(true);
        // The sentence is about what is actually missing -- the monthly figure -- and not about the
        // programme, which is right there in `opt`.
        expect(n.status).not.toBe('No N programme entered');
        expect(n.status).toContain('monthly');
    });

    test('CASE 4 - a MONTHLY figure entered as zero is not "none entered" either', () => {
        /**
         * GH-781 (delivery 5, the reviewer's second finding): the annual programme stopped being
         * erased in this expression, and the monthly figure beside it was left with `|| 0` - the same
         * fault one field along. A site that answered "none applied this month" was told "No monthly
         * N figure entered", which is "not entered" about something entered.
         */
        const none = nitrogenOf({ turfType: 'greens', species: 'bentgrass', nProgramKgHaYr: 150 });
        const zero = nitrogenOf({ turfType: 'greens', species: 'bentgrass', nProgramKgHaYr: 150 },
            { monthlyN: 0 });
        process.stdout.write('[gh781] monthly absent -> ' + JSON.stringify(none.status)
            + '\n[gh781] monthly zero   -> ' + JSON.stringify(zero.status) + '\n');

        expect(none.status).toContain('No monthly N figure entered');
        // The two are different answers, and the annual programme is still the site's own in both.
        expect(zero.status).not.toBe(none.status);
        expect(zero.status).toContain('zero');
        expect([none.opt, zero.opt]).toEqual([150, 150]);
    });

    test('THE PAIR, side by side: absence and an entered zero are DIFFERENT answers', () => {
        /**
         * The two cases above hold each half; this one holds the distinction itself, which is the thing that
         * did not exist before: `parseFloat(...) || 0` made absence into 0 and the second `||` made 0 into
         * absence, so both shapes came out identical. Printed as a pair so a reader sees the difference
         * rather than trusting two separate greens.
         */
        const absent = nitrogenOf({ turfType: 'greens', species: 'bentgrass' });
        const zero = nitrogenOf({ turfType: 'greens', species: 'bentgrass', nProgramKgHaYr: 0 });
        // The line she drew and the line she did not: 200 for "no programme", and a zero that stays a zero.
        process.stdout.write('[gh781] absent: opt=' + JSON.stringify(absent.opt) + ' status='
            + JSON.stringify(absent.status) + '\n[gh781] zero  : opt=' + JSON.stringify(zero.opt)
            + ' status=' + JSON.stringify(zero.status) + '\n');

        expect([absent.opt, zero.opt]).toEqual([200, 0]);
        expect(absent.status).not.toBe(zero.status);
    });
});

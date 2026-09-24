/**
 * GH-609 — THE RESTORATION JUDGE CALLED A CORRECT ROW WRONG, AND THE CASE THAT
 * PROVES IT NEEDS NO PRESS.
 *
 * WHAT HAPPENED. The live probe of GH-591 compares what the analysis page
 * states with what the sample measured. It did so with `Number(a) !==
 * Number(b)`, and on `New test - location` it reported eight nutrients
 * disagreeing — `P, K, Ca, Mg, S, Fe, Mn, Zn`. The row was right. Measured in
 * the database, row 65 against sample 125:
 *
 *     P   19.6  vs 19.57      K   18.8  vs 18.84
 *     Ca 240.8  vs 240.77     Mg  39.4  vs 39.38
 *     S   13.9  vs 13.95      Fe 115.7  vs 115.71
 *     Mn  30.4  vs 30.35      Zn   7.2  vs 7.18
 *     Cu   2.0  vs 2          <- the only agreement, and only because 2.0 === 2
 *
 * Every one of the eight is the page printing one decimal. `Burns` passed the
 * same check because its readings are short enough to survive rounding, so the
 * fault stayed invisible until a site with longer numbers went through.
 *
 * WHY IT MATTERED MORE THAN A WRONG COLOUR. That false red became a queue item:
 * work was opened on a defect that does not exist, and the row it accused holds
 * exactly the sample's figures. A judge that cries wolf is a judge nobody
 * believes the next time it is right.
 *
 * AND WHY THIS FILE EXISTS RATHER THAN A FIX IN PLACE. The judge lived inside a
 * file that cannot be run without pressing Re-run on the stand, so the check
 * least able to be exercised was the one that was wrong. It is a pure function
 * now, and these cases run with no browser, no login and no press.
 */

'use strict';

const { judge, printedPrecision } = require('./lib/row-vs-sample');

/** Row 65 as the page states it, and sample 125 as the lab measured it. */
const SHOWN = {
    P: '19.6', K: '18.8', Ca: '240.8', Mg: '39.4', S: '13.9',
    Fe: '115.7', Mn: '30.4', Zn: '7.2', Cu: '2.0', B: '-',
};
const MEASURED = {
    P: 19.57, K: 18.84, Ca: 240.77, Mg: 39.38, S: 13.95,
    Fe: 115.71, Mn: 30.35, Zn: 7.18, Cu: 2,
};

describe('GH-609 — the judge reads the row at the precision the row prints', () => {
    test('the real case that produced the false red now agrees', () => {
        const { shared, disagreed } = judge(SHOWN, MEASURED);

        process.stdout.write('[gh609] judged ' + shared.length + ' readings; disagreed: '
            + (disagreed.length ? disagreed.join(', ') : 'none') + '\n');

        // Positive control first: the comparison really looked at the nutrients.
        expect(shared).toHaveLength(9);
        expect(disagreed).toEqual([]);
    });

    test('and it still catches a real disagreement, or it would agree with anything', () => {
        // The control for the repair. A value the page states wrongly is
        // visible at the precision the page states it.
        const wrong = Object.assign({}, SHOWN, { K: '12.4' });
        expect(judge(wrong, MEASURED).disagreed).toEqual(['K']);

        // Including one that differs only in the last printed place.
        const offByOneTenth = Object.assign({}, SHOWN, { Mg: '39.5' });
        expect(judge(offByOneTenth, MEASURED).disagreed).toEqual(['Mg']);
    });

    test('GH-617: a reading the row has NO CELL for is named, not silently lost', () => {
        // The hole the precision repair left standing. `dropped` was a subset
        // of `shared`, and `shared` is the ROW's vocabulary — so a reading the
        // page has no cell for at all fell out of both answers and was named
        // nowhere. Measured before the repair:
        //     judge({K:'18.8'}, {K:18.84, Zn:5})
        //       -> {shared:['K'], disagreed:[], dropped:[]}
        // The zinc the lab measured simply vanished, and the judge reported
        // nothing missing about a row that was missing a reading.
        const { shared, disagreed, dropped } = judge({ K: '18.8' }, { K: 18.84, Zn: 5 });

        expect(shared).toEqual(['K']);
        expect(disagreed).toEqual([]);
        expect(dropped).toEqual(['Zn']);
    });

    test('GH-617: and the name of the answer is true of the value it carries', () => {
        // The caller states this as `measuredBySampleButNotInTheRow`. Before
        // the repair that name promised a completeness the value did not have,
        // because the value was computed by walking what IS in the row. Both
        // ways of being missing are counted now — no cell at all, and a cell
        // that is empty — and nothing the row states with a real number is.
        const { dropped } = judge(
            { K: '18.8', B: '-', Ca: '240.8' },
            { K: 18.84, B: 0.4, Ca: 240.77, Zn: 5, OM: 2.9 },
        );

        // No cell: `Zn`, `OM`. Empty cell: `B`. Stated with a number: neither.
        expect(dropped.sort()).toEqual(['B', 'OM', 'Zn']);
    });

    test('a value the row never states is dropped, not disagreed', () => {
        // The two answers are different questions and had been one. `B` is
        // stated as `-` and the sample does not carry it, so it is neither.
        const { dropped, disagreed } = judge(SHOWN, Object.assign({}, MEASURED, { B: 0.4 }));

        expect(dropped).toEqual(['B']);
        expect(disagreed).not.toContain('B');
    });

    test('the precision is read off the surface, not chosen here', () => {
        // Stated on its own because it is what makes the tolerance honest: no
        // epsilon appears anywhere in the module, and a page that prints more
        // decimals is compared more strictly without an edit.
        expect(printedPrecision('240.8')).toBe(1);
        expect(printedPrecision('2')).toBe(0);
        expect(printedPrecision('18.84')).toBe(2);

        // Two decimals printed: the rounding that hid the defect no longer does.
        expect(judge({ K: '18.80' }, { K: 18.84 }).disagreed).toEqual(['K']);
        expect(judge({ K: '18.8' }, { K: 18.84 }).disagreed).toEqual([]);
    });

    test('an unreadable value is a disagreement, not a silent pass', () => {
        expect(judge({ K: 'n/a' }, { K: 18.84 }).disagreed).toEqual(['K']);
    });
});

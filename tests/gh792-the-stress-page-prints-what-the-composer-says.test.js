'use strict';

/**
 * GH-792 (queue item 79) — THE STRESS PAGE, AND WHAT IT PRINTS WHEN THERE IS NOTHING TO SHOW.
 *
 * WHY THIS FILE COMES FIRST. `stress-analysis.js` is the one client page in the tree with no suite of any
 * kind -- measured, 19 of the 67 scripts the client views load are named by no test, and this is the only
 * whole PAGE among them. The coordinator's condition of 01.10.2026 follows from that: where a change touches
 * a place with no guard, the case is written BEFORE the change, or "the suite will redden" is a hope rather
 * than a property.
 *
 * WHAT IT HOLDS. The page is rendered, and what a person would read is taken out of the container: this is
 * the universe the coordinator set for this item -- what was PRINTED, not what stands as a literal in a
 * file. A census of literals is answered by a new place to write one.
 *
 * THE THREE STATES of an empty section, which is what the item is about:
 *   no analysis at all        -> the words for that, and they are the same on every page;
 *   an analysis, no reason    -> the approved words for this place;
 *   an analysis with a reason -> the reason's own sentence.
 *
 * Before the repair the page holds its own sentence for all three, and that is what the cases below record.
 * After it they assert the same texts come from the composer.
 */

const { renderPage } = require('./lib/page-render-bench');

/** The composer's answer for a place, as the server delivers it. */
const composerSays = (key, text) => ({ sections: { [key]: { cause: null, class: null, module: null,
    retry: false, text } } });

/** The stress page, rendered for a row that carries no stress at all. */
function stressWith(dashboardData, texts) {
    return renderPage({
        file: 'stress-analysis.js',
        entry: 'render',
        container: 'stress-page-content',
        // The db-shell layout loads this before every page, and it carries the one reader of the composer's
        // words. Loaded here in the same context, as a browser does it, rather than stubbed.
        shared: ['dashboard-ui.js'],
        globals: {
            GAIP_DASHBOARD_DATA: dashboardData,
            GAIP_ANALYSIS_TEXTS: texts || null,
        },
    });
}

describe('GH-792 — the stress page prints its empty section', () => {
    test('POSITIVE CONTROL: the bench reaches the page\'s own render and says which one', () => {
        const out = stressWith({ computed: {} });
        process.stdout.write('\n[gh792] rendered ' + out.file + ' by calling ' + out.called + '()'
            + ' into #' + out.containerId + '\n[gh792] it printed: ' + JSON.stringify(out.printed) + '\n');

        // Without this, an empty `printed` would read as "the page says nothing" when it means "the bench
        // never got to a render".
        expect(out.called).toBe('render');
        expect(out.printed.length).toBeGreaterThan(0);
    });

    test('with no stress in the row, the page prints the empty section and nothing else', () => {
        const out = stressWith({ computed: {} });
        process.stdout.write('[gh792] no stress in the row -> ' + JSON.stringify(out.printed) + '\n');

        expect(out.printed).toContain('No stress data yet');
    });

    /**
     * THE OTHER DIRECTION. With a stress result in the row the page draws the result, so the empty section is
     * not what it says about every row -- without this the case above would pass on a page that prints the
     * empty state always.
     */
    test('with a stress result the page does not print the empty section', () => {
        // The shape the page reads: `factors` is a list of `{type, …}`, which is what the engine produces.
        const out = stressWith({
            computed: { stress: { index: 42, band: 'moderate',
                factors: [{ type: 'thermal', score: 40 }, { type: 'moisture', score: 20 }] } },
        });
        process.stdout.write('[gh792] a row with stress -> ' + JSON.stringify(out.printed.slice(0, 120)) + '\n');

        expect(out.printed).not.toContain('No stress data yet');
    });

    /**
     * GH-792 — AND THE SENTENCE IS THE COMPOSER'S, WHICH IS WHAT THIS ITEM IS FOR.
     *
     * Before the repair this case recorded the opposite: the page held its own sentence and printed it whether
     * an analysis had been run or not. The expectation here is taken from the composer's ANSWER rather than
     * copied beside the test -- a case comparing two of our own surfaces agrees with them when both drift,
     * which is the GH-409 class and the reviewer's chosen mutation for this item.
     */
    test('the body is the composer\'s answer, and the page adds nothing of its own', () => {
        const approved = 'No stress index for this site in the latest analysis.';
        const out = stressWith({ computed: {} }, composerSays('stress', approved));
        process.stdout.write('[gh792] the composer said ' + JSON.stringify(approved)
            + '\n[gh792] the page printed ' + JSON.stringify(out.printed) + '\n');

        expect(out.printed).toContain(approved);
        // The page's own sentence is gone, and the advice to run an analysis with it.
        expect(out.printed).not.toContain('Run the analysis to compute');
        expect(out.printed).not.toMatch(/\bHub\b/);
    });

    /**
     * THE THREE STATES, each from the composer and none from the page. What differs between them is the
     * answer, not the page -- which is the property that makes the words the owner's to change.
     */
    test('a site never analysed, an analysis with no cause, and an analysis with a cause', () => {
        const states = {
            'never analysed': 'No analysis has been run for this site yet.',
            'analysed, no cause': 'No stress index for this site in the latest analysis.',
            'a cause was recorded': 'Stress was not calculated in this analysis. If this continues, contact us.',
        };
        const printed = {};
        Object.keys(states).forEach((state) => {
            printed[state] = stressWith({ computed: {} }, composerSays('stress', states[state])).printed;
        });
        process.stdout.write('[gh792] the three states, as printed:\n'
            + Object.keys(printed).map((k) => '[gh792]   ' + k.padEnd(22) + ' -> '
                + JSON.stringify(printed[k])).join('\n') + '\n');

        Object.keys(states).forEach((state) => {
            expect(printed[state]).toContain(states[state]);
        });
        // Three different answers reached the page, so the page is printing the answer rather than a constant.
        expect(new Set(Object.values(printed)).size).toBe(3);
    });

    /**
     * AND WITH NO ANSWER AT ALL the page prints its heading and nothing under it. A page that filled the gap
     * with a sentence of its own would be holding words again, which is what this item removes.
     */
    test('no answer from the composer means no sentence, not a sentence of the page\'s own', () => {
        const out = stressWith({ computed: {} }, { sections: {} });
        process.stdout.write('[gh792] the composer had nothing -> ' + JSON.stringify(out.printed) + '\n');

        expect(out.printed).toBe('No stress data yet');
    });
});

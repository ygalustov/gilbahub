/**
 * GH-607 — THE ONE FIELD THE ROW TAKES OFF THE GROWTH RESULT, GUARDED.
 *
 * WHAT IS BEING PROTECTED, AND WHY IT IS A CLAIM ABOUT WHAT IS *NOT* READ.
 * `cacheAnalysisResults()` computes with a number nobody measured: when
 * `climateMetrics.temperature.todayMean` is absent it substitutes 20 °C and
 * hands that to `calculateGrowthMetrics()`. GH-605 established by tracing both
 * ends that the substitution reaches no stored row — the function uses the mean
 * only for its top-level `weighted`, `c3`, `c4`, `gdd` and `status`, its
 * `dailyPattern` is built from the daily rows with each day's own mean, and the
 * block takes `dailyPattern` and nothing else. The substitution was therefore
 * left in place, because removing it would drop `dailyPattern` on every run
 * without a today-mean: real figures deleted to avoid a discarded one.
 *
 * THAT DECISION RESTS ENTIRELY ON THE SECOND HALF — that nothing reads the five
 * fields — AND UNTIL NOW NOTHING GUARDED IT. One line reading
 * `_growthFull.weighted` turns 20 °C into a live number in a client's stored
 * row, silently, with every test green. So the subject of this file is what the
 * block does NOT read, and it is asserted against the product's own text.
 *
 * The second escape route is guarded too: the substituted value must not travel
 * anywhere except into that one call. A `cache.computed.climate.todayMean =
 * _todayMean` would publish the invented number directly, and the field check
 * alone would not see it.
 *
 * Comments are stripped before anything is read as code — the block carries the
 * GH-605 explanation, which names `weighted`, `c3`, `c4`, `gdd` and `status` in
 * prose, and a check that reads prose as code goes red on its own reasoning.
 * The pattern is `tests/gh578-…:160`; this file and `gh606` use the same one.
 */

'use strict';

const fs = require('fs');
const path = require('path');

const SRC = path.join(__dirname, '..', 'assets', 'hub-persistence.js');

function stripComments(src) {
    return src
        .replace(/\/\*[\s\S]*?\*\//g, '')
        .split('\n')
        .filter((l) => !/^\s*\/\//.test(l))
        .map((l) => (/['"`]/.test(l) ? l : l.replace(/\/\/.*$/, '')))
        .join('\n');
}

/** From the `calculateGrowthMetrics` call to the end of the try block it sits in. */
function growthBlock() {
    const src = stripComments(fs.readFileSync(SRC, 'utf8'));
    const at = src.indexOf('var _growthFull = calculateGrowthMetrics(');
    if (at < 0) throw new Error('the growth call is no longer in hub-persistence.js under that name');
    const end = src.indexOf('} catch (e) {', at);
    if (end < 0) throw new Error('the growth call is no longer inside a try block');
    return src.slice(at, end);
}

describe('GH-607 — the row takes dailyPattern off the growth result and nothing else', () => {
    const block = growthBlock();

    test('the block was found and really contains the substituted mean, so nothing here is vacuous', () => {
        // Without this, a rename would give an empty block and every claim
        // below would hold over nothing at all.
        expect(block.length).toBeGreaterThan(200);
        expect(block).toContain('calculateGrowthMetrics(_todayMean');
        process.stdout.write('[gh607] guarding ' + block.split('\n').length + ' line(s) after the growth call\n');
    });

    test('every field taken off the growth result is dailyPattern', () => {
        const fields = [...new Set([...block.matchAll(/_growthFull\s*\.\s*([A-Za-z_$][\w$]*)/g)].map((m) => m[1]))];

        process.stdout.write('[gh607] fields read off _growthFull: ' + fields.join(', ') + '\n');

        // Found at all — the positive control for the check itself.
        expect(fields.length).toBeGreaterThan(0);
        // And every one of them is the same field. Named this way rather than
        // as a forbidden list, so a SIXTH field invented tomorrow is caught
        // without anybody remembering to add it here.
        expect(fields).toEqual(['dailyPattern']);
    });

    test('and the substituted mean goes into that call and nowhere else', () => {
        // Counted from its own declaration onwards, so the assignment that
        // creates it is not mistaken for a use of it.
        const decl = block.indexOf('calculateGrowthMetrics(_todayMean');
        const uses = [...block.slice(decl).matchAll(/_todayMean/g)];

        expect(uses).toHaveLength(1);
    });

    test('the field it does store is the one built from the daily rows, not from the mean', () => {
        // Stated as the consequence rather than as the shape of the code: what
        // reaches the row is the per-day pattern. If this ever becomes a
        // top-level summary field, the claim GH-605 rests on has changed and
        // the substitution must go with it.
        expect(block).toMatch(/dailyPattern:\s*_growthFull\.dailyPattern/);
    });
});

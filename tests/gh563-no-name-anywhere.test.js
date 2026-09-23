/**
 * GH-563 — A SAMPLE WITH NO NAME IS NOT GIVEN ONE, IN THE REPORT EITHER.
 *
 * The second half of the owner's decision of 22.09.2026, in her words: "it must
 * be the same as in the interface. If there is no name, there is none in the
 * interface either, but the sample itself is displayed. And it must be the same
 * in the report."
 *
 * THE FIRST HALF (GH-549) fixed the screen. This one found the substitution was
 * not one place but a chain of four, and that its first link is not printing at
 * all:
 *
 *   1. `sample-manager.js` SAVED `label: sampleData.label || sampleId`, so a
 *      sample nobody named went into the store called `Soil_1_3cbn`. From then
 *      on nothing could tell a name somebody gave from one the store invented —
 *      which is why repairing the printing alone repairs nothing.
 *   2. `word-export-combined.js` rebuilt `label || id` when assembling zones.
 *   3. `humanizeSampleLabel()` took `label || id` and then TIDIED THE
 *      IDENTIFIER UP: `Soil_1_3cbn` came out as "Soil 1", which reads like a
 *      name somebody chose. A substitution wearing the clothes of formatting.
 *   4. The zone caption fell back to `'Zone ' + (ri + 1)` — a position number,
 *      which is a name nobody gave and which moves when the sort moves.
 *
 * Remove only the fourth and "Soil 1" appears in its place, made by the third.
 * So the chain is cut at every link, and every link goes through the one answer
 * the screen already uses.
 */

'use strict';

const fs = require('fs');
const path = require('path');
const vm = require('vm');

const ASSETS = path.join(__dirname, '..', 'assets');
const read = (f) => fs.readFileSync(path.join(ASSETS, f), 'utf8');
const codeOnly = (src) => src.replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '');

function zoneKey() {
    const sandbox = { window: {}, console: { warn() {} } };
    sandbox.global = sandbox;
    vm.runInContext(read('zone-key.js'), vm.createContext(sandbox), { filename: 'zone-key.js' });
    return sandbox.window.GaipZoneKey;
}

describe('GH-563 — the store stops inventing a name', () => {
    test('a sample with no label is saved with no label', () => {
        const code = codeOnly(read('sample-manager.js'));
        // The assignment itself, because this is the link that makes the other
        // three unfixable: after it, there is nothing left to tell apart.
        expect(code).toMatch(/label: sampleData\.label \|\| null,/);
        expect(code).not.toMatch(/label: sampleData\.label \|\| sampleId,/);
    });

    test('the identifier is still generated and is still the key', () => {
        // The control: "no name" must not have become "no sample". The id is
        // what the store is indexed by and it has not gone anywhere.
        const code = codeOnly(read('sample-manager.js'));
        expect(code).toMatch(/id: sampleId,/);
        expect(code).toMatch(/generateSampleId\(dataType\)/);
    });
});

describe('GH-563 — a label that IS the identifier is not a name', () => {
    // The store wrote one there for as long as it did, and those samples are
    // still in it. Printing them would be printing the substitution, just an
    // older one.
    let ZK;
    beforeAll(() => { ZK = zoneKey(); });

    test('the generated identifier, saved as a label, does not print', () => {
        expect(ZK.displayName({ label: 'Soil_1_3cbn', id: 'Soil_1_3cbn' })).toBe('');
        expect(ZK.displayName({ label: '  Soil_1_3cbn  ', id: 'Soil_1_3cbn' })).toBe('');
        expect(ZK.displayName({ label: 'Tissue_12_9f0a', id: 'Tissue_12_9f0a' })).toBe('');
    });

    /**
     * THE CASE THAT CORRECTED THE RULE. The first draft was `label === id`, and
     * it ate real names: an id is the label SLUGGED, so a sample genuinely
     * called `green_1` gets the id `green_1`. Caught by
     * `gh372-tissue-sample-selection-consistency`, whose zones are named exactly
     * as their ids — not by reading.
     */
    test('a name equal to its own id still prints when the id is not a generated one', () => {
        expect(ZK.displayName({ label: 'Green 1', id: 'Green 1' })).toBe('Green 1');
        expect(ZK.displayName({ label: 'green_1', id: 'green_1' })).toBe('green_1');
        expect(ZK.displayName({ label: 'Green 12', id: 'Green 12' })).toBe('Green 12');
    });

    test('a real name still prints, including one shaped like a generated id', () => {
        // The rule is "IS the generated id", not "looks machine-made": a sample
        // somebody chose to call `Soil_2_9xyz` keeps that name, because it is
        // not this sample's identifier.
        expect(ZK.displayName({ label: 'Green 1', id: 'Soil_1_3cbn' })).toBe('Green 1');
        expect(ZK.displayName({ label: 'Soil_2_9xyz', id: 'Soil_1_3cbn' })).toBe('Soil_2_9xyz');
    });

    test('grouping is untouched — the key may still be the identifier', () => {
        // A key is not a caption and does not leave. Without this the fix would
        // scatter every unnamed sample into its own zone.
        expect(ZK.derive({ label: null, id: 'soil-42' })).toBe('soil 42');
        expect(ZK.derive({ label: 'Green 1 (June 2025)' })).toBe(ZK.derive({ label: 'Green 1 Q1 2024' }));
    });
});

describe('GH-563 — the document says the same thing as the screen', () => {
    const EXPORT = read('word-export-combined.js');
    const code = codeOnly(EXPORT);

    test('the zone caption has no identifier and no position number left', () => {
        expect(code).not.toMatch(/rep\.sampleLabel \|\| rep\.sampleId/);
        expect(code).not.toMatch(/'Zone ' \+ \(ri \+ 1\)/);
        // Both captions — the comparison table and the per-zone section — go
        // through the shared answer.
        expect((code.match(/var zoneLabel = _zoneDisplayName\(\{ label: rep\.sampleLabel, id: rep\.sampleId \}\);/g) || []).length).toBe(2);
    });

    test('the zone assembly no longer rebuilds label-or-id', () => {
        expect(code).not.toMatch(/label: \(o && \(o\.label \|\| o\.id\)\)/);
        expect(code).toMatch(/label: \(o && o\.label\) \|\| null,/);
    });

    test('the formatter formats a name and does not make one out of an id', () => {
        expect(code).not.toMatch(/var raw = label \|\| id \|\| '';/);
        const fn = code.slice(code.indexOf('function humanizeSampleLabel'), code.indexOf('function humanizeSampleLabel') + 400);
        expect(fn).toMatch(/_zoneDisplayName\(\{ label: label, id: id \}\)/);
        expect(fn).toMatch(/if \(!named\) return '';/);
    });

    test('and the shared answer is the screen’s, not a second copy of it', () => {
        expect(code).toMatch(/global\.GaipZoneKey\.displayName\(subject\)/);
        // And it keeps NO copy of the rule. The first draft repeated the
        // module's condition here as a fallback, which is the second source
        // this whole question is about — `gh461`'s identity reader saw through
        // it at once, reporting this function's own locals as roots of the
        // label. Without the module the answer is nothing: an unknown name is
        // not a name.
        const helper = code.slice(code.indexOf('function _zoneDisplayName'), code.indexOf('function humanizeSampleLabel'));
        expect(helper).not.toMatch(/\|\| subject\.id/);
        expect(helper).not.toMatch(/label === String\(subject\.id\)/);
        expect(helper).not.toMatch(/\[0-9a-z\]\{4,\}/);
        expect(helper).toMatch(/return '';/);

        // The rule itself exists once, in the module.
        const zk = codeOnly(read('zone-key.js'));
        expect((zk.match(/\[0-9a-z\]\{4,\}/g) || []).length).toBe(1);
    });

    test('every view that loads the export loads the module it now depends on', () => {
        // A guarded call keeps a report alive without it; this keeps the report
        // correct. Asserted per view rather than once, because the enqueue lists
        // are four separate lists.
        const views = ['reports/export.blade.php', 'reports/forensic.blade.php',
                       'reports/scenarios.blade.php', 'hub.blade.php'];
        views.forEach((v) => {
            const src = fs.readFileSync(path.join(__dirname, '..', 'app', 'resources', 'views', v), 'utf8');
            expect([v, src.includes("'zone-key.js'")]).toEqual([v, true]);
        });
    });
});

describe('GH-563 — the sample is still shown', () => {
    test('nothing was taught to skip a sample for want of a name', () => {
        // The half of the owner's decision that is easiest to lose while
        // obeying the other: "the sample itself is displayed".
        const code = codeOnly(read('word-export-combined.js'));
        // The row loop is unconditional — no `continue` on a missing label.
        const loop = code.slice(code.indexOf('for (var ri = 0; ri < reports.length; ri++)'), code.indexOf('for (var ri = 0; ri < reports.length; ri++)') + 600);
        expect(loop).not.toMatch(/if \(!zoneLabel\)[\s\S]{0,40}continue/);
        expect(loop).toMatch(/makeZoneLabelCell\(zoneLabel\)/);
    });
});

/**
 * GH-564 (reviewer's required finding on GH-563) — THE DOCUMENT IS BUILT AND ITS
 * OWN STRINGS ARE READ.
 *
 * WHAT WAS WRONG WITH THE BLOCK ABOVE, and it is the class I named this morning:
 * form proves form, and there text proved text. Every case in "the document says
 * the same thing as the screen" is a `not.toMatch` over the SOURCE of
 * `word-export-combined.js`. No document is assembled, no produced string is
 * read. So the mutation that restored `'Zone ' + (ri + 1)` went red because a
 * pinned line of source had changed — not because "Zone 1" appeared in a report.
 *
 * And the reviewer showed what that costs. Put the substitution somewhere the
 * pinned lines do not look — inside `makeZoneLabelCell`, where the caption
 * actually becomes a `TextRun`:
 *
 *     function makeZoneLabelCell(text) { if (!text) { text = 'Zone ' + …; } … }
 *
 * — and all three regexes stay satisfied, the suite stays green, and every
 * report goes out with invented zone names. The substitution ratchet does not
 * catch it either.
 *
 * So this block builds the table through the export's own code, in the export's
 * own sandbox, with the real `docx`, and reads what came out.
 */
describe('GH-564 — the assembled document, not its source', () => {
    const { loadPage } = require('./helpers/export-page-sandbox');

    /**
     * Build the zone comparison table for the given reports and return every
     * string the document ended up containing.
     *
     * The export's internals are reached by re-running the file in the page's
     * own sandbox with one line spliced onto its export — the same way eleven
     * other files reach into `soil-nutrition-analysis.js`. Everything it needs
     * is already in that sandbox, `docx` included, so what is built here is
     * what a report is built from.
     */
    function stringsInTable(reports) {
        const page = loadPage({ errors: [], warnings: [], alerts: [] });
        expect(page.failures).toEqual([]);

        const src = fs.readFileSync(path.join(ASSETS, 'word-export-combined.js'), 'utf8');
        const marker = '    global.GAIP_CombinedExport = {';
        expect(src).toContain(marker);
        const spliced = src.replace(marker,
            '    global.__test_buildZoneComparisonTable = buildZoneComparisonTable;\n' + marker);
        vm.runInContext(spliced, page.sandbox, { filename: 'word-export-combined.js (spliced)' });

        const d = page.sandbox.docx;

        // What the reader will SEE, which is the text of every run the table
        // produced — not the element names of the XML it serialises to. Walking
        // the built object collected 3861 strings, almost all of them `w:tblPr`
        // and friends, and an empty caption does not survive into that tree at
        // all: a test over it could say "the id is absent" and could not say
        // "the caption is empty".
        const printed = [];
        const Recording = function (opts) {
            printed.push(opts && typeof opts.text !== 'undefined' ? String(opts.text) : '');
            return new d.TextRun(opts);
        };

        page.sandbox.__test_buildZoneComparisonTable(reports, {
            Paragraph: d.Paragraph, TextRun: Recording, Table: d.Table, TableRow: d.TableRow,
            TableCell: d.TableCell, AlignmentType: d.AlignmentType, WidthType: d.WidthType,
            BorderStyle: d.BorderStyle, ShadingType: d.ShadingType, VerticalAlign: d.VerticalAlign,
        });

        return printed;
    }

    const NUTRIENTS = { pH: 6.2, P: 40, K: 200, Ca: 1200, Mg: 150, S: 20, Na: 60, CEC: 12, EC: 0.4, OM: 3.1, areaHa: 1.2 };
    const report = (over) => Object.assign({
        sampleLabel: '', sampleId: 'Soil_1_3cbn',
        data: { soil: Object.assign({ hasData: true }, NUTRIENTS) },
    }, over);

    test('control: a named zone puts its name in the document', () => {
        // Without this, "no name appears" is satisfied by a table that contains
        // nothing at all — and the floor below is satisfied by the nutrient
        // headings alone.
        const strings = stringsInTable([report({ sampleLabel: 'Green 1', sampleId: 'Soil_1_3cbn' })]);
        expect(strings.length).toBeGreaterThan(10);
        expect(strings).toContain('Green 1');
        expect(strings).toContain('Zone');   // the column heading, which stays
    });

    test('a sample with no name puts NO name in the document — not the id, not a number', () => {
        const strings = stringsInTable([report()]);

        process.stdout.write('[gh564] strings produced: ' + strings.length + '\n');
        expect(strings.length).toBeGreaterThan(10);

        // The identifier, in any of its forms.
        expect(strings).not.toContain('Soil_1_3cbn');
        expect(strings.filter((s) => /Soil_1_3cbn/.test(s))).toEqual([]);
        // What `humanizeSampleLabel` used to make of it.
        expect(strings).not.toContain('Soil 1');
        // A position number. `Zone` alone is the column heading and stays;
        // `Zone 1` is a caption and must not exist.
        expect(strings.filter((s) => /^Zone \d+$/.test(s))).toEqual([]);
        // And the caption is there, empty.
        expect(strings).toContain('');
    });

    test('two unnamed samples produce two empty captions, not "Zone 1" and "Zone 2"', () => {
        // The shape the position number was invented for, and the one where it
        // looks most like a name.
        const strings = stringsInTable([
            report({ sampleId: 'Soil_1_3cbn' }),
            report({ sampleId: 'Soil_2_9xyz' }),
        ]);
        expect(strings.filter((s) => /^Zone \d+$/.test(s))).toEqual([]);
        expect(strings.filter((s) => s === '')).toHaveLength(2);
        // …and both rows are still drawn, with their figures.
        expect(strings.filter((s) => s === '200')).toHaveLength(2);
    });

    test('a sample whose stored name IS its generated id prints nothing either', () => {
        // The samples already in the store, which is why the rule is not only
        // about what is saved from now on.
        const strings = stringsInTable([report({ sampleLabel: 'Soil_1_3cbn', sampleId: 'Soil_1_3cbn' })]);
        expect(strings.filter((s) => /Soil_1_3cbn|Soil 1/.test(s))).toEqual([]);
        expect(strings).toContain('');
    });
});

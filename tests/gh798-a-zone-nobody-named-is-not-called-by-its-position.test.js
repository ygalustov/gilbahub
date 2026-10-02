/**
 * GH-798 (queue item "Zones") — A ZONE NOBODY NAMED IS NOT CALLED BY ITS POSITION IN THE LIST.
 *
 * THE OWNER'S RULE, 22.09.2026, one rule for both surfaces: "do not substitute: on the screen a zone
 * without a name", and the same day, for the document: "it must be the same as in the interface. If
 * there is no name, there is none in the interface either, but the sample itself is displayed. And in
 * the report too." So: nothing is put in the name's place — not the identifier, not the ordinal — and
 * the sample is still drawn, with its own figures.
 *
 * WHAT THIS FILE IS ABOUT. The sample chooser of `/analysis#soil-nutrition` printed `Zone 3` for a
 * sample with no name, where `3` was its place in the list: a name nobody gave, which changes when the
 * sort order changes. Three places on this one screen did it — the rows of the dropdown, the button
 * above it, and the button of the chooser the Plan page mounts through `mountSampleDropdown`.
 *
 * THE WORDING IS NOT CHOSEN HERE. It is `GaipZoneKey.UNNAMED` (GH-549/GH-563), the empty one, declared
 * in the module both this screen and the report already read, with the reason written beside it: a word
 * standing where a name is missing is itself a substitution, and the ratchet
 * `gh477-substitution-for-emptiness.test.js` exists to catch exactly that shape.
 *
 * WHAT THESE CASES DO NOT DO: they say nothing about the report. The document's places were closed
 * before this (`word-export-combined.js`, `_zoneDisplayName`), and `gh549`/`gh563` hold them.
 */

'use strict';

const fs = require('fs');
const path = require('path');
const vm = require('vm');

const ASSETS = path.join(__dirname, '..', 'assets');
const PAGE = path.join(ASSETS, 'soil-nutrition-analysis.js');
const ZONE_KEY = path.join(ASSETS, 'zone-key.js');

/**
 * The page, loaded as a page loads it — with `zone-key.js` beside it, because that module is what
 * holds the decision and the screen reads it through `global.GaipZoneKey`.
 *
 * `buildDropdownRows` is private, so the export line is widened in the COPY that runs here. The file in
 * the tree is untouched; the line is asserted first, so a rename reddens instead of silently exporting
 * nothing.
 */
function loadThePage() {
    const real = fs.readFileSync(PAGE, 'utf8');
    const exportLine = 'global.GAIP_SoilNutritionAnalysis = { init: init, mountSampleDropdown: mountSampleDropdown };';
    expect(real).toContain(exportLine);
    const widened = real.replace(exportLine,
        'global.GAIP_SoilNutritionAnalysis = { init: init, mountSampleDropdown: mountSampleDropdown, '
        + '__test_buildDropdownRows: buildDropdownRows, __test_zoneName: zoneName };');

    const sandbox = {
        window: {},
        document: {
            createElement: () => ({ textContent: '', innerHTML: '' }),
            querySelector: () => null,
            addEventListener: () => {},
        },
        console: { log: () => {}, warn: () => {} },
        localStorage: { getItem: () => null, setItem: () => {} },
        encodeURIComponent,
        JSON, Object, Array, String, Number, Math, Date, RegExp, Error, Promise, parseInt, parseFloat, isNaN,
    };
    sandbox.global = sandbox;
    sandbox.globalThis = sandbox;
    sandbox.window.GAIP_DASHBOARD_DATA = {};
    const ctx = vm.createContext(sandbox);
    vm.runInContext(fs.readFileSync(ZONE_KEY, 'utf8'), ctx, { filename: 'zone-key.js' });
    vm.runInContext(widened, ctx, { filename: 'soil-nutrition-analysis.js' });

    return { page: ctx.window.GAIP_SoilNutritionAnalysis, ctx };
}

/** Two samples of the same site: one a person named, one nobody did. */
const NAMED = {
    id: 701, client_uid: 'Green 1', lab_ref: '4169173', lab_date: '2026-08-08',
    payload: { _label: 'Green 1', _source: 'hagley.json' },
};
const UNNAMED = {
    id: 702, client_uid: null, lab_ref: '4169174', lab_date: '2026-09-20',
    payload: { _source: 'hagley.json' },
};

describe('GH-798 — the chooser of /analysis#soil-nutrition', () => {
    let page, ctx;
    beforeAll(() => { ({ page, ctx } = loadThePage()); });

    test('the decision is read from the module, not written on this screen', () => {
        process.stdout.write('[gh798] the module declares UNNAMED as '
            + JSON.stringify(ctx.window.GaipZoneKey.UNNAMED)
            + ' | the screen answers for a sample with no name: '
            + JSON.stringify(page.__test_zoneName({ label: null, id: 702 }))
            + ' | and for a named one: '
            + JSON.stringify(page.__test_zoneName({ label: 'Green 1', id: 701 })) + '\n');

        // The screen's answer IS the module's, which is what makes it the same on both surfaces.
        expect(page.__test_zoneName({ label: null, id: 702 })).toBe(ctx.window.GaipZoneKey.UNNAMED);
        expect(page.__test_zoneName({ label: 'Green 1', id: 701 })).toBe('Green 1');
    });

    test('a row for a zone with no name carries no name, and the sample is still there to pick', () => {
        const rows = page.__test_buildDropdownRows([NAMED, UNNAMED], 0, [NAMED, UNNAMED]);
        const cells = (html) => (html.match(/<div class="sn-drop-cell-[a-z]+">([^<]*)<\/div>/g) || [])
            .map((c) => c.replace(/<[^>]+>/g, ''));
        const perRow = rows.split('<div class="sn-drop-row').slice(1).map((r) => cells(r));

        process.stdout.write('[gh798] the rows the chooser drew: ' + JSON.stringify(perRow) + '\n');

        // The named one keeps its name.
        expect(perRow[0][0]).toBe('Green 1');
        // The unnamed one's name cell is empty -- no identifier, and no `Zone 2`.
        expect(perRow[1][0]).toBe('');
        expect(rows).not.toMatch(/Zone \d/);
        expect(rows).not.toContain('702');
        // And it has NOT disappeared: its lab reference and its date are drawn, so a person can still
        // choose it. This is the half the owner named -- "the sample itself is displayed".
        expect(perRow[1][1]).toBe('4169174');
        expect(perRow[1][2]).toBe('hagley');
        expect(perRow[1][3]).toMatch(/\d{1,2} \w+ 2026/);
        expect(rows).toContain('data-sn-idx="1"');
    });

    test('the position number is gone from every place on this screen that names a zone', () => {
        /**
         * The three places, as a list rather than as a count, because the subject is which ones: the
         * rows (`buildDropdownRows`), the button over them (`injectSampleDropdown`) and the button of
         * the chooser mounted elsewhere (`mountSampleDropdown`'s `labelFor`). A fourth place appearing
         * with its own fallback reddens this.
         */
        const src = fs.readFileSync(PAGE, 'utf8');
        const offenders = (src.match(/.*(?:'Zone ' *\+|"Zone " *\+).*/g) || []).map((l) => l.trim());
        /**
         * The LIST, not its length: which subject each of the three hands the one reader. A place that
         * stops asking drops out of this list and a new one appears in it, and either way the list is
         * what the case says — a count would answer "three" to both.
         */
        const namers = (src.match(/zoneName\(\{\s*label:([\s\S]{0,120}?),\s*id:/g) || [])
            .map((m) => m.replace(/zoneName\(\{\s*label:\s*/, '').replace(/,\s*id:$/, '').replace(/\s+/g, ' ').trim());

        process.stdout.write('[gh798] places still naming a zone by its position: '
            + JSON.stringify(offenders) + '\n[gh798] what each place asks the one reader about: '
            + JSON.stringify(namers) + '\n');

        expect(offenders).toEqual([]);
        expect(namers).toEqual([
            'pl._label || s.client_uid',
            '(active.payload && active.payload._label) || active.client_uid',
            '(s.payload && s.payload._label) || s.client_uid',
        ]);
    });
});

// ─────────────────────────────────────────────────────────────────────────────────────────────────
// THE COMBINED EXPORT — four surfaces of one rule, and the identifier the import makes.
//
// The reviewer's count, taken as the subject: the document cell (`TextRun`), the row of the picker
// (`innerHTML`), the line of the export's own progress (`textContent`), and `zoneProvenance`, which
// no surface prints unless a prior sample has no date. A mutation on the rule must redden the first
// three; a green one there means that surface reads something of its own.
// ─────────────────────────────────────────────────────────────────────────────────────────────────

const { loadPage } = require('./helpers/export-page-sandbox');

const EXPORT = path.join(ASSETS, 'word-export-combined.js');

/** The export, in the page's own sandbox, with the internals this file asks about exported. */
function loadTheExport(samples) {
    const page = loadPage({ errors: [], warnings: [], alerts: [] });
    expect(page.failures).toEqual([]);

    const src = fs.readFileSync(EXPORT, 'utf8');
    const marker = '    global.GAIP_CombinedExport = {';
    expect(src).toContain(marker);
    const spliced = src.replace(marker,
        '    global.__test_enumerateSamples = enumerateSamples;\n'
        + '    global.__test_buildZoneComparisonTable = buildZoneComparisonTable;\n'
        + '    global.__test_createProgressUI = createProgressUI;\n'
        + '    global.__test_showSamplePicker = showSamplePicker;\n' + marker);

    if (samples) {
        page.sandbox.GAIP_SampleManager = Object.assign({}, page.sandbox.GAIP_SampleManager, {
            getAllSamples: () => samples,
        });
    }
    vm.runInContext(spliced, page.sandbox, { filename: 'word-export-combined.js (spliced)' });

    return page;
}

/** One site, two soil samples: one a person named, one the CSV import named for nobody. */
const IMPORT_ID = 'Sample_1790822499325';
const STORE = {
    sites: { 's1': { label: 'Hagley Oval' } },
    allSites: {
        's1': {
            soil: {
                'green_1': { id: 'green_1', label: 'Green 1', date: '2026-08-08', rawData: { K: 120 } },
                [IMPORT_ID]: { id: IMPORT_ID, label: IMPORT_ID, date: '2026-09-20', rawData: { K: 90 } },
            },
            water: {},
            tissue: {},
        },
    },
};

describe('GH-798 — the funnel every surface of the export reads', () => {
    test('a zone the import named for nobody comes out of the enumeration with no name', () => {
        const page = loadTheExport(STORE);
        const zones = page.sandbox.__test_enumerateSamples('all');

        process.stdout.write('[gh798] the enumeration produced: ' + JSON.stringify(zones.map((z) => ({
            sampleId: z.sampleId, sampleLabel: z.sampleLabel,
            winnerLabel: z.zoneProvenance && z.zoneProvenance.winnerLabel,
            candidates: (z.zoneProvenance && z.zoneProvenance.priorSamples || []).map((c) => c.label),
        }))) + '\n');

        const named = zones.filter((z) => z.sampleId === 'green_1')[0];
        const unnamed = zones.filter((z) => z.sampleId === IMPORT_ID)[0];

        // The named zone keeps its name.
        expect(named.sampleLabel).toBe('Green 1');
        // The unnamed one has none — not the identifier, not a tidied form of it, not a number.
        expect(unnamed.sampleLabel).toBe('');
        expect(unnamed.sampleLabel).not.toMatch(/Sample/);
        // And it is still there, with the identifier where an identifier belongs.
        expect(unnamed.sampleId).toBe(IMPORT_ID);
        // `zoneProvenance` — the surface that prints only when a prior sample has no date.
        expect(unnamed.zoneProvenance.winnerLabel).toBe('');
    });

    test('SURFACE 1, the document cell: no identifier reaches a TextRun', () => {
        const page = loadTheExport();
        const d = page.sandbox.docx;
        const printed = [];
        const Recording = function (opts) {
            printed.push(opts && typeof opts.text !== 'undefined' ? String(opts.text) : '');

            return new d.TextRun(opts);
        };
        const NUTRIENTS = { pH: 6.2, P: 40, K: 200, Ca: 1200, Mg: 150, S: 20, Na: 60, CEC: 12, EC: 0.4, OM: 3.1, areaHa: 1.2 };
        const report = (over) => Object.assign({
            sampleLabel: '', sampleId: IMPORT_ID,
            data: { soil: Object.assign({ hasData: true }, NUTRIENTS) },
        }, over);

        page.sandbox.__test_buildZoneComparisonTable([report(), report({ sampleLabel: 'Green 1', sampleId: 'green_1' })], {
            Paragraph: d.Paragraph, TextRun: Recording, Table: d.Table, TableRow: d.TableRow,
            TableCell: d.TableCell, AlignmentType: d.AlignmentType, WidthType: d.WidthType,
            BorderStyle: d.BorderStyle, ShadingType: d.ShadingType, VerticalAlign: d.VerticalAlign,
        });

        process.stdout.write('[gh798] strings the document cell produced: ' + printed.length
            + ' | the named zone present: ' + printed.includes('Green 1')
            + ' | any carrying the identifier: '
            + JSON.stringify(printed.filter((t) => /Sample_/.test(t))) + '\n');

        // The control: a named zone IS printed, or "no identifier" is satisfied by an empty table.
        expect(printed).toContain('Green 1');
        expect(printed.length).toBeGreaterThan(10);
        // And the import's identifier is nowhere in it.
        expect(printed.filter((t) => /Sample_/.test(t))).toEqual([]);
        expect(printed.filter((t) => /^Zone \d+$/.test(t))).toEqual([]);
    });

    test('SURFACE 3, the line of the export\'s own progress: no identifier reaches textContent', () => {
        const page = loadTheExport();
        const written = {};
        page.sandbox.document.getElementById = (id) => (written[id] = written[id] || { style: {}, textContent: '' });

        const progress = page.sandbox.__test_createProgressUI(2);
        progress.update(1, 'Hagley Oval', { label: '', id: IMPORT_ID });
        const unnamedLine = written['combined-export-status'].textContent;
        progress.update(2, 'Hagley Oval', { label: 'Green 1', id: 'green_1' });
        const namedLine = written['combined-export-status'].textContent;

        process.stdout.write('[gh798] the progress line for a zone with no name: ' + JSON.stringify(unnamedLine)
            + '\n[gh798] and for a named one: ' + JSON.stringify(namedLine) + '\n');

        // The named one is printed — the control.
        expect(namedLine).toBe('Hagley Oval — Green 1');
        // The unnamed one names the site and leaves the zone's place empty.
        expect(unnamedLine).toBe('Hagley Oval — ');
        expect(unnamedLine).not.toMatch(/Sample_/);
    });
    /**
     * GH-798 (the reviewer's return) — THE CELL OF THE ZONE COLUMN IS THE DECLARED FORM, not merely
     * free of the identifier.
     *
     * His mutation M7 put a SECOND wording in the document and nothing went red: `makeZoneLabelCell`
     * was given `String(text || '(no zone name)')`, and `SURFACE 1` above asks only that `Green 1` is
     * printed, that there are more than ten strings, and that no `Sample_` or `Zone 3` is among them.
     * A new phrase passes all three. The owner's rule is that the wording is THE SAME on the screen and
     * in the document, so the cell is compared with the declared one, read out of the module.
     *
     * Read as a MATRIX and not as a flat list of strings: what is asserted is the first cell of the
     * unnamed zone's row, which is the one a reader looks at. A filter over all the strings of the
     * table cannot say which cell held what.
     */
    test('the Zone cell of an unnamed zone is the declared wording, taken from the module', () => {
        const page = loadTheExport();
        const d = page.sandbox.docx;

        // Each docx piece is tagged with the text it ended up carrying, so a row can be read back as
        // its cells and a cell as its text.
        const textOf = new Map();
        const Run = function (opts) {
            const made = new d.TextRun(opts);
            textOf.set(made, opts && typeof opts.text !== 'undefined' ? String(opts.text) : '');

            return made;
        };
        const joinKids = (opts) => ((opts && opts.children) || [])
            .map((c) => (textOf.has(c) ? textOf.get(c) : '')).join('');
        const Para = function (opts) {
            const made = new d.Paragraph(opts);
            textOf.set(made, joinKids(opts));

            return made;
        };
        const Cell = function (opts) {
            const made = new d.TableCell(opts);
            textOf.set(made, joinKids(opts));

            return made;
        };
        const rows = [];
        const Row = function (opts) {
            rows.push(((opts && opts.children) || []).map((c) => textOf.get(c)));

            return new d.TableRow(opts);
        };

        const NUTRIENTS = { pH: 6.2, P: 40, K: 200, Ca: 1200, Mg: 150, S: 20, Na: 60, CEC: 12, EC: 0.4, OM: 3.1, areaHa: 1.2 };
        const report = (over) => Object.assign({
            sampleLabel: '', sampleId: IMPORT_ID,
            data: { soil: Object.assign({ hasData: true }, NUTRIENTS) },
        }, over);

        page.sandbox.__test_buildZoneComparisonTable(
            [report({ sampleLabel: 'Green 1', sampleId: 'green_1' }), report()],
            {
                Paragraph: Para, TextRun: Run, Table: d.Table, TableRow: Row, TableCell: Cell,
                AlignmentType: d.AlignmentType, WidthType: d.WidthType, BorderStyle: d.BorderStyle,
                ShadingType: d.ShadingType, VerticalAlign: d.VerticalAlign,
            }
        );

        // The declared wording, out of the module both surfaces read — never a string written here.
        const ZK = zoneKeyModule();
        const zoneColumn = rows.map((cells) => cells[0]);
        process.stdout.write('[gh798] the module declares the wording as ' + JSON.stringify(ZK.UNNAMED)
            + '\n[gh798] the Zone column of the table, row by row: ' + JSON.stringify(zoneColumn) + '\n');

        // The header, then one row per report: the named zone, then the unnamed one.
        expect(zoneColumn[0]).toBe('Zone');
        expect(zoneColumn[1]).toBe('Green 1');
        expect(zoneColumn[2]).toBe(ZK.UNNAMED);
        // And said the other way round, so a second wording cannot slip in beside the first: the cell
        // of an unnamed zone carries NOTHING but the declared form.
        expect(zoneColumn.filter((t) => t !== 'Zone' && t !== 'Green 1')).toEqual([ZK.UNNAMED]);
    });

    test('SURFACE 2, the row of the picker: no identifier reaches the innerHTML a person reads', async () => {
        const page = loadTheExport();
        // The dialog is built into an element the page makes; the stubs record what was written into
        // it, which is what a person would be looking at.
        const made = [];
        const stub = () => {
            const el = {
                style: {}, className: '', innerHTML: '', dataset: {}, value: '', checked: true,
                appendChild() {}, removeChild() {}, remove() {},
                addEventListener() {}, querySelectorAll: () => [],
                classList: { add() {}, remove() {}, contains: () => false },
            };
            // The dialog wires its own controls after writing the markup; the stubs answer so the
            // wiring runs, and what this case reads is the markup it wrote.
            el.querySelector = () => stub();

            return el;
        };
        page.sandbox.document.createElement = () => {
            const el = stub();
            made.push(el);

            return el;
        };
        page.sandbox.document.body = { appendChild() {}, removeChild() {} };

        const entries = [
            { siteId: 's1', siteLabel: 'Hagley Oval', sampleId: 'green_1', sampleLabel: 'Green 1', hasSoil: true },
            { siteId: 's1', siteLabel: 'Hagley Oval', sampleId: IMPORT_ID, sampleLabel: '', hasSoil: true },
        ];
        page.sandbox.__test_showSamplePicker(entries, 'all');

        const html = made.map((el) => el.innerHTML).join('');
        const labelCells = (html.match(/<td class="gaip-bulk-sample-label">([^<]*)<\/td>/g) || [])
            .map((c) => c.replace(/<[^>]+>/g, ''));

        process.stdout.write('[gh798] the name cells of the picker: ' + JSON.stringify(labelCells)
            + ' | any carrying the identifier: '
            + JSON.stringify(labelCells.filter((t) => /Sample_/.test(t))) + '\n');

        // The control: the named one is drawn.
        expect(labelCells).toContain('Green 1');
        // The unnamed one is drawn too -- with an empty name, and its row is still there with its
        // checkbox, which is what "the sample is displayed" means here.
        expect(labelCells).toContain('');
        expect(labelCells.filter((t) => /Sample_/.test(t))).toEqual([]);
        expect(html).toContain('data-sample-uid');
    });
});

/** The module that holds the decision, loaded on its own — the one source of the declared wording. */
function zoneKeyModule() {
    const box = { window: {}, console: { warn() {} } };
    box.global = box;
    const ctx = vm.createContext(box);
    vm.runInContext(fs.readFileSync(ZONE_KEY, 'utf8'), ctx, { filename: 'zone-key.js' });

    return ctx.window.GaipZoneKey;
}

describe('GH-798 — the shapes the store invents, and the one the CSV import makes', () => {
    const zoneKey = () => {
        const box = { window: {}, console: { warn() {} } };
        box.global = box;
        const ctx = vm.createContext(box);
        vm.runInContext(fs.readFileSync(ZONE_KEY, 'utf8'), ctx, { filename: 'zone-key.js' });

        return ctx.window.GaipZoneKey;
    };

    test('an identifier the import made is not a name, and a real name still is', () => {
        const ZK = zoneKey();
        const report = {
            'the import\'s own': ZK.looksInvented(IMPORT_ID),
            'generateSampleId()': ZK.looksInvented('Soil_1_3cbn'),
            'a name with a number': ZK.looksInvented('Green_10'),
            'a slug': ZK.looksInvented('green_1'),
            'a plain name': ZK.looksInvented('Putter Green'),
        };
        process.stdout.write('[gh798] what the rule calls invented: ' + JSON.stringify(report) + '\n');

        expect(report).toEqual({
            'the import\'s own': true,
            'generateSampleId()': true,
            'a name with a number': false,
            'a slug': false,
            'a plain name': false,
        });
        // And the consequence: a label that IS such an identifier does not print.
        expect(ZK.displayName({ label: IMPORT_ID, id: IMPORT_ID })).toBe(ZK.UNNAMED);
        // A zone genuinely called `green_1`, whose id is slugged from it, keeps its name. This is the
        // case GH-563 was caught by, and widening the rule must not eat it.
        expect(ZK.displayName({ label: 'green_1', id: 'green_1' })).toBe('green_1');
    });

    test('the CSV import stops writing the identifier into the name', () => {
        const src = fs.readFileSync(path.join(ASSETS, 'sample-manager.js'), 'utf8');
        const made = new Function('row',
            src.match(/function extractSampleName\(row\) \{[\s\S]*?\n    \}/)[0]
            + '\nreturn extractSampleName(row);');

        const answers = {
            'a file with a name column': made({ 'Sample ID': 'Green 1' }),
            'a file with a zone column': made({ Zone: 'Fairway 7' }),
            'a file with neither': made({ pH: '6.2', K: '120' }),
            'a blank name': made({ Name: '   ' }),
        };
        process.stdout.write('[gh798] the name the file carried: ' + JSON.stringify(answers) + '\n');

        expect(answers).toEqual({
            'a file with a name column': 'Green 1',
            'a file with a zone column': 'Fairway 7',
            'a file with neither': null,
            'a blank name': null,
        });
        // And the record written from it takes that answer, not the made-up key.
        expect(src).toMatch(/id: sampleId,\n\s+\/\/ GH-798[\s\S]{0,120}label: extractSampleName\(row\),/);
    });
});

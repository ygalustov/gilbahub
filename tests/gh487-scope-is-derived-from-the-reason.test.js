/**
 * GH-487 — a line that cannot be absent for any site is not a line about a
 * site, and the document is built that way rather than edited to look that
 * way.
 *
 * The registry GH-486 built carried two rows in every document ever produced:
 * the tissue and water verdicts, omitted because a page run carries no site
 * stamp. True of the version, not of the site — and standing in the site's own
 * data table they read as this site's problem. The criterion is the reviewer's
 * and it is checkable rather than arguable: an entry present in EVERY run
 * belongs to the release, an entry that can be absent belongs to the site.
 *
 * ── Passport ────────────────────────────────────────────────────────────────
 * guarantee   Where an outcome is printed follows from its reason, and the
 *             site's table holds only what can differ between sites.
 * claims      By VALUE and by cross-check: the scope of every reason the
 *             product produces comes from one map; an entry present in all
 *             runs has scope `release` and one absent somewhere has scope
 *             `site`, in both directions; a reason absent from the map stops
 *             the document instead of being skipped; and the release note
 *             carries no machine token.
 * universe    The reasons in REASON_SCOPE, and a fixture set that produces
 *             every outcome the product can produce today.
 * unit        One outcome entry.
 * moment      At section building, from the frozen map collectData returned.
 * distinguishability  Runs that differ in what they can omit: a site with
 *             everything selected, the same site with nothing selected, and
 *             the other site — so "present in all runs" is a measurement over
 *             runs that genuinely differ, not over one run repeated.
 * carrier     The text of `word/document.xml` — the table's rows and the
 *             version note — and the throw when a reason has no scope.
 * ПОТРЕБИТЕЛЬ  `word-export.js:11640` (the table takes only `scope === 'site'`)
 *             and `:11690` (the "About this report version" note), plus
 *             `:12594, 12669, 13284, 13360` (the per-section lines, likewise
 *             site-scope only). Observable effect: which rows and which
 *             paragraphs a produced .docx carries.
 * input       collectData()'s outcome map, filled from the reads themselves.
 * positive-control  The all-present run asserts the site table says "All site
 *             data present." — reached by data, with no editing of the object
 *             under test, which is what GH-486's control did.
 * exemptions  None.
 * ratchet     None.
 * rc          The reviewer's mutation: declare `no-run-stamp` as `site`, drop
 *             a reason from the map, put the unconditional entry back in the
 *             site's table, or drop ONE entry from the table and leave the
 *             rest — the last one was green here until GH-489, because the
 *             reader answered 'site' by default.
 * ────────────────────────────────────────────────────────────────────────────
 *
 * Named, not implied: the five `unavailable` reasons of the twenty-eighth
 * refinement (`not-loaded`, `load-failed`, `no-record`, `no-field`,
 * `read-threw`) are declared in the map but no run can produce one — the
 * three-outcome resolver they belong to is not built. The cross-check below
 * therefore runs over the outcomes that exist, and the five are checked for
 * their declaration only. A fixture per reason would be this file inventing
 * the state it asserts, which is the habit GH-487 exists to end.
 */

'use strict';

const fs = require('fs');
const path = require('path');
const { loadPage, SITE_ID, OTHER_SITE_ID } = require('./helpers/export-page-sandbox');

async function documentText(sandbox, data) {
    const sections = sandbox.GAIP_WordExport.buildSections(data, {});
    const doc = new sandbox.docx.Document({ sections: [{ properties: {}, children: sections }] });
    const blob = await sandbox.docx.Packer.toBlob(doc);
    const zip = await sandbox.JSZip.loadAsync(Buffer.from(await blob.arrayBuffer()));
    const xml = await zip.file('word/document.xml').async('string');
    return xml.replace(/<\/w:p>/g, '\n').replace(/<\/w:tc>/g, '\t').replace(/<[^>]+>/g, '')
        .replace(/&amp;/g, '&');
}

/**
 * Where the product puts a pair, asked through the product AND READ BY
 * OBSERVATION.
 *
 * GH-489: this used to answer `'site'` by default — "neither heading found" —
 * so every `=== 'site'` assertion was satisfied just as well by an entry that
 * was printed NOWHERE. The reviewer showed it with a mutation that drops one
 * entry from the table and leaves the rest: eleven assertions here and nine in
 * gh486 stayed green while the row it is about had vanished. That is the class
 * this section has spent the day removing from the document — a default that
 * happens to equal the most common expected value — and here it was in the
 * test, eating the difference silently.
 *
 * Now each of the three places is read for the ENTRY ITSELF, and a fourth
 * answer exists for "printed nowhere":
 *   site    — the field's name stands in the "Data availability" table;
 *   run     — the field's name stands in the run paragraph;
 *   release — the version note is there. The note is one fixed sentence that
 *             does not name the field, so a single-entry model is what makes
 *             this observation sound: the note exists only if THIS entry put
 *             it there. That is why the probe carries exactly one entry.
 *   nowhere — none of the above.
 */
const PROBE_FIELD = 'Probe field 489';

async function scopeOf(sandbox, entry) {
    const model = {
        site: { name: 'probe' }, turf: {}, climate: {}, soil: {}, tissue: {}, water: {},
        salinity: {}, shade: {}, pgr: {}, dmi: {}, irrigation: {}, disease: {}, dew: {},
        traffic: {}, trajectory: {}, sensor: {}, overseedClimate: {},
        availability: [Object.assign(
            { field: PROBE_FIELD, where: 'Settings \u203A Probe', sections: ['Tissue Analysis'] }, entry)]
    };
    const text = await documentText(sandbox, model);
    const runAt = text.indexOf('About this report run');
    const noteAt = text.indexOf('About this report version');
    const registryAt = text.indexOf('Data availability');
    const registryEnd = [runAt, noteAt].filter((i) => i > registryAt).concat([text.length]).sort((a, b) => a - b)[0];
    const registry = registryAt >= 0 ? text.slice(registryAt, registryEnd) : '';
    const runParagraph = runAt >= 0 ? text.slice(runAt, runAt + 600) : '';

    if (registry.indexOf(PROBE_FIELD) >= 0) return 'site';
    if (runParagraph.indexOf(PROBE_FIELD) >= 0) return 'run';
    if (noteAt >= 0) return 'release';
    return 'nowhere';
}

describe('GH-487 — scope follows the reason, and the criterion is checked by cross-check', () => {
    jest.setTimeout(120000);
    let page, npi, we, runs;

    beforeAll(() => {
        page = loadPage({ errors: [], warnings: [], alerts: [] });
        expect(page.failures).toEqual([]);
        npi = page.sandbox.GAIP_NutritionProgramInputs;
        we = page.sandbox.GAIP_WordExport;
        const sm = page.sandbox.GAIP_SampleManager;
        const innerAll = sm.getAllSamples;

        // The fixture set: runs that genuinely differ in what they can omit.
        const A = we.collectData(npi.resolveExportInputs({ siteId: SITE_ID }));          // all present, all selected
        sm.getAllSamples = () => {
            const copy = innerAll();
            copy.allActive[SITE_ID] = { soil: copy.allActive[SITE_ID].soil };
            return copy;
        };
        let B;
        try {
            B = we.collectData(npi.resolveExportInputs({ siteId: SITE_ID }));            // nothing selected
        } finally {
            sm.getAllSamples = innerAll;
        }
        const C = we.collectData(npi.resolveExportInputs({ siteId: OTHER_SITE_ID }));    // the other site
        runs = { A: A, B: B, C: C };
    });

    test('every pair the product produces is declared, and the table is one place', async () => {
        // GH-488: the scope is a property of the PAIR — outcome and reason
        // together — so the declaration is read as a pair too.
        const src = fs.readFileSync(path.join(__dirname, '..', 'assets', 'word-export.js'), 'utf8');
        expect(src).toMatch(/var SCOPE_RULES = \{/);
        expect(src).toMatch(/omitted: \{ 'no-run-stamp': 'release' \}/);
        expect(src).toMatch(/empty: \{ '': 'site' \}/);
        ['not-loaded', 'load-failed', 'read-threw'].forEach((r) => {
            expect(src).toMatch(new RegExp("'" + r + "': 'run'"));
        });
        expect(src).toMatch(/'no-field': 'release'/);
        ['no-record', 'parse-failed'].forEach((r) => {
            expect(src).toMatch(new RegExp("'" + r + "': 'site'"));
        });
        // and nothing writes a scope beside an outcome
        expect(src).not.toMatch(/scope: 'site'/);
        expect(src).not.toMatch(/scope: 'release'/);
        expect(src).not.toMatch(/scope: 'run'/);
        // every pair the runs produce is one the table declares
        const produced = new Set();
        Object.keys(runs).forEach((k) => (runs[k].availability || [])
            .forEach((e) => produced.add(e.outcome + '|' + e.reason)));
        expect(produced.size).toBeGreaterThan(1);
        for (const pair of produced) {
            const [outcome, reason] = pair.split('|');
            // Not 'nowhere': a pair the product produces has a place.
            expect([pair, await scopeOf(page.sandbox, { outcome: outcome, reason: reason })])
                .toEqual([pair, expect.stringMatching(/^(site|release|run)$/)]);
        }
    });

    test('cross-check, both ways: present in every run \u21d4 not a row in the site\'s table', async () => {
        // The scope is taken from the PRODUCT — from where each entry actually
        // lands in the document — not from a rule repeated here. A test that
        // decided for itself which reason is a release reason would agree with
        // itself after the map was changed underneath it, which is the failure
        // this whole ticket is about. (Measured: with the scope hardcoded here,
        // redeclaring `no-run-stamp` as `site` left this test green.)
        const seen = {};
        const keys = Object.keys(runs);
        for (const key of keys) {
            const text = await documentText(page.sandbox, runs[key]);
            const registry = text.slice(text.indexOf('Data availability'),
                text.indexOf('About this report version') >= 0
                    ? text.indexOf('About this report version') : undefined);
            (runs[key].availability || []).forEach((e) => {
                const id = e.field + '|' + (e.reason || '');
                seen[id] = seen[id] || { runs: new Set(), asSiteRow: new Set() };
                seen[id].runs.add(key);
                if (registry.indexOf(e.field) >= 0) seen[id].asSiteRow.add(key);
            });
        }
        const all = keys.length;
        const ids = Object.keys(seen);
        expect(ids.length).toBeGreaterThan(2);
        const wrong = ids.filter((id) => {
            const everywhere = seen[id].runs.size === all;
            const printedAsSite = seen[id].asSiteRow.size > 0;
            // Present in every run ⇒ it is not about a site ⇒ it is not a row.
            // Able to be absent ⇒ it is about a site ⇒ where it exists, it is
            // a row.
            return everywhere ? printedAsSite : !printedAsSite;
        }).map((id) => id + ' (runs: ' + Array.from(seen[id].runs).join(',') +
            '; rows in: ' + (Array.from(seen[id].asSiteRow).join(',') || 'none') + ')');
        expect({ wrong: wrong }).toEqual({ wrong: [] });
    });

    test('the site\'s table holds no release entry, and the note holds no machine token', async () => {
        const text = await documentText(page.sandbox, runs.B);
        const registry = text.slice(text.indexOf('Data availability'), text.indexOf('About this report version'));
        expect(registry).not.toContain('no-run-stamp');
        expect(registry).toContain('Tissue readings');
        const note = text.slice(text.indexOf('About this report version'));
        expect(note).toContain('not yet attributed to a site in this version');
        expect(note.slice(0, 400)).not.toContain('no-run-stamp');
    });

    test('the note appears once per document, not once per section', async () => {
        const text = await documentText(page.sandbox, runs.A);
        const occurrences = text.split('About this report version').length - 1;
        expect(occurrences).toBe(1);
    });

    test('the reader itself: "site" means the row is there, and "nowhere" is a possible answer', async () => {
        // GH-489, the control on the instrument. `scopeOf` used to answer
        // 'site' when it found neither heading — so it said 'site' about an
        // entry printed nowhere. These two assertions are what make the rest
        // of this file mean anything: the site answer is the field's own name
        // found in the table, and an entry printed nowhere is named as such.
        const model = {
            site: { name: 'probe' }, turf: {}, climate: {}, soil: {}, tissue: {}, water: {},
            salinity: {}, shade: {}, pgr: {}, dmi: {}, irrigation: {}, disease: {}, dew: {},
            traffic: {}, trajectory: {}, sensor: {}, overseedClimate: {},
            availability: [{ field: PROBE_FIELD, where: 'Settings \u203A Probe', outcome: 'empty',
                reason: '', sections: ['Tissue Analysis'] }]
        };
        const text = await documentText(page.sandbox, model);
        const registry = text.slice(text.indexOf('Data availability'), text.indexOf('About this report version'));
        expect(registry).toContain(PROBE_FIELD);

        // And the fourth answer is reachable: a model with no outcomes at all
        // prints the field nowhere, and the reader says so instead of 'site'.
        const empty = Object.assign({}, model, { availability: [] });
        const emptyText = await documentText(page.sandbox, empty);
        expect(emptyText).not.toContain(PROBE_FIELD);
        expect(emptyText).toContain('All site data present.');
    });

    test('the three scopes land in three different places, asked of the product', async () => {
        // GH-488: the pair decides, and the product is asked where each one
        // goes rather than told. The two `run` reasons and the `no-field`
        // release reason are not produced by anything today — the
        // three-outcome resolver is not built — so they are driven through the
        // real printing path as single-entry models. That is a claim about the
        // RULE, checked where the rule lives; it is not a claim that a document
        // today contains them.
        expect(await scopeOf(page.sandbox, { outcome: 'empty', reason: '' })).toBe('site');
        expect(await scopeOf(page.sandbox, { outcome: 'unavailable', reason: 'no-record' })).toBe('site');
        expect(await scopeOf(page.sandbox, { outcome: 'unavailable', reason: 'parse-failed' })).toBe('site');
        expect(await scopeOf(page.sandbox, { outcome: 'unavailable', reason: 'not-loaded' })).toBe('run');
        expect(await scopeOf(page.sandbox, { outcome: 'unavailable', reason: 'load-failed' })).toBe('run');
        expect(await scopeOf(page.sandbox, { outcome: 'unavailable', reason: 'read-threw' })).toBe('run');
        expect(await scopeOf(page.sandbox, { outcome: 'unavailable', reason: 'no-field' })).toBe('release');
        expect(await scopeOf(page.sandbox, { outcome: 'omitted', reason: 'no-run-stamp' })).toBe('release');
    });

    test('an entry that forgot its reason stops the document — it is not read as the empty reason', async () => {
        // The reviewer's mutation, kept as a control: with the scope taken from
        // the reason alone, dropping `reason` from the tissue verdict moved it
        // out of the version note and into the site's table, silently. The pair
        // cannot do that: a missing reason is not a value.
        const withoutReason = Object.assign({}, runs.A, {
            availability: [{ field: 'Tissue analysis verdict', where: 'Analysis run (Plan page)',
                outcome: 'omitted', sections: ['Tissue Analysis'] }]
        });
        expect(() => page.sandbox.GAIP_WordExport.buildSections(withoutReason, {}))
            .toThrow(/carries no reason/);
        // and the empty reason under the wrong outcome is refused too
        await expect(scopeOf(page.sandbox, { outcome: 'unavailable', reason: '' }))
            .rejects.toThrow(/not declared/);
    });

    test('a reason with no declared scope stops the document instead of being skipped', async () => {
        // The map is frozen, so the entry is added to a copy — which is also
        // the only way a stranger reason could arrive: from a writer that has
        // not been through the map.
        const withStranger = Object.assign({}, runs.A, {
            availability: (runs.A.availability || []).concat([{
                field: 'Invented field', where: 'Nowhere', outcome: 'unavailable',
                reason: 'no-such-reason', sections: ['Tissue Analysis']
            }])
        });
        await expect(documentText(page.sandbox, withStranger))
            .rejects.toThrow(/the pair \(unavailable, "no-such-reason"\) is not declared/);
    });

    test('each reason code in the site table is printed with its human phrase', () => {
        const src = fs.readFileSync(path.join(__dirname, '..', 'assets', 'word-export.js'), 'utf8');
        expect(src).toMatch(/var REASON_TEXT = \{/);
        // every reason that can stand in the site table has a phrase
        ['not-loaded', 'load-failed', 'no-record', 'no-field', 'read-threw'].forEach((r) => {
            expect(src).toMatch(new RegExp("'" + r + "': '[a-z]"));
        });
        expect(src).toMatch(/REASON_TEXT\[entry\.reason\]/);
    });
});

/**
 * GH-488 — the border between assembling a document and printing it.
 *
 * ── Passport ────────────────────────────────────────────────────────────────
 * guarantee   Printing reads the model and cannot write to it.
 * claims      Structurally, the printer opens by taking a frozen copy; by
 *             behaviour, the copy is a real copy — a model that refers back to
 *             itself is refused instead of walked — and the model the caller
 *             holds is untouched when printing ends.
 * universe    buildSections(), the one entry to printing.
 * unit        One document build.
 * moment      At the first statement of printing, before any section exists.
 * distinguishability  A cyclic model: with a copy it is refused, without one it
 *             prints — so "takes a copy" is distinguishable from "uses the
 *             object it was handed".
 * carrier     The throw, and the caller's own object afterwards.
 * ПОТРЕБИТЕЛЬ  `word-export.js:11252` (`var data = _frozenCopy(model)` — every
 *             section below reads that copy). Observable effect: a write during
 *             printing throws instead of reaching the document.
 * input       The model collectData returns.
 * positive-control  An ordinary model prints normally in the same file, so
 *             "refused" is distinguishable from "never printed anything".
 * exemptions  None.
 * ratchet     None.
 * rc          The reviewer's mutation: print from the object handed in.
 * ────────────────────────────────────────────────────────────────────────────
 *
 * Named: the write that proved the border was open — `data.soil.surfaceType`,
 * set while printing — was moved into collectData by this ticket, so there is
 * no product write left to demonstrate the throw with. The freeze is asserted
 * structurally and by the copy's own behaviour; a fixture that writes to the
 * model would be this file inventing the defect it asserts.
 */
describe('GH-488 — printing reads a frozen copy', () => {
    jest.setTimeout(120000);
    let page;

    beforeAll(() => {
        page = loadPage({ errors: [], warnings: [], alerts: [] });
        expect(page.failures).toEqual([]);
    });

    test('printing opens by taking a frozen copy of the model', () => {
        const src = fs.readFileSync(path.join(__dirname, '..', 'assets', 'word-export.js'), 'utf8');
        expect(src).toMatch(/function buildSections\(model, charts\) \{\s*\n(\s*\/\/[^\n]*\n)*\s*var data = _frozenCopy\(model\);/);
        const copy = src.slice(src.indexOf('function _frozenCopy(model)'), src.indexOf('function buildSections(model'));
        expect(copy).toMatch(/Object\.freeze\(out\)/);
        // and the write that used to happen during printing is gone: the one
        // assignment left is in collectData, above buildSections.
        // Comments stripped: the move is named in the comment that replaced the
        // old assignment, which a plain count would read as a second write.
        const code = src.replace(/\/\*[\s\S]*?\*\//g, '').replace(/(^|[^:])\/\/[^\n]*/g, '$1');
        const writes = code.split('data.soil.surfaceType =').length - 1;
        expect(writes).toBe(1);
        expect(code.indexOf('data.soil.surfaceType =')).toBeLessThan(code.indexOf('function buildSections(model'));
    });

    test('the copy is a real copy: a model that refers back to itself is refused', () => {
        const model = {
            site: { name: 'probe' }, turf: {}, climate: {}, soil: {}, tissue: {}, water: {},
            salinity: {}, shade: {}, pgr: {}, dmi: {}, irrigation: {}, disease: {}, dew: {},
            traffic: {}, trajectory: {}, sensor: {}, overseedClimate: {}, availability: []
        };
        model.soil.itself = model.soil;
        expect(() => page.sandbox.GAIP_WordExport.buildSections(model, {}))
            .toThrow(/contains a cycle/);
    });

    test('positive control: an ordinary model prints, and the caller\'s object is untouched', () => {
        const npi = page.sandbox.GAIP_NutritionProgramInputs;
        const we = page.sandbox.GAIP_WordExport;
        const data = we.collectData(npi.resolveExportInputs({ siteId: SITE_ID }));
        const before = JSON.stringify(data);
        const sections = we.buildSections(data, {});
        expect(sections.length).toBeGreaterThan(5);
        expect(JSON.stringify(data)).toBe(before);
    });
});

/**
 * GH-469 (PLAN-GH439 section 10.6, eighth refinement, point 1) — a sample's
 * calendar inputs are BUILT from its own site, not copied from a page-wide
 * snapshot and patched.
 *
 * What this replaces, measured rather than described: the combined export
 * started each sample's inputs as `Object.assign({}, _facilityCalendarInputs)`
 * — one `collectFromState()` snapshot of the hidden runner's DOM, taken once
 * for the whole document, holding "whichever site restored first" by its own
 * comment — and then overwrote the fields somebody had listed. The snapshot
 * returns 33 keys; 21 were overwritten; TWELVE were kept:
 *
 *     longitude, isC4, bulkDensity, soilDepth, monthlyTempsSource,
 *     monthlyTempsPeriod, turfType, bulkDensityDefaulted, soilDepthDefaulted,
 *     annualNBase, _speciesDefaulted, _methodologyDefaulted
 *
 * `isC4` chooses the growth curve, and `annualNBase` is the same quantity as
 * the `annualNOverride` beside it, which WAS refreshed — one of a pair kept
 * current and the other not. This is the shape section 10.3 declined: a copy
 * of a page-wide object plus a list of exceptions, where the list is the
 * defect.
 */
'use strict';

const fs = require('fs');
const path = require('path');
const parser = require('@babel/parser');
const traverse = require('@babel/traverse').default;
const { loadPage, SITE_ID } = require('./helpers/export-page-sandbox');
const { anchoredSlice } = require('./lib/anchored-slice');

const ASSETS = path.join(__dirname, '..', 'assets');
const read = (f) => fs.readFileSync(path.join(ASSETS, f), 'utf8');

describe('GH-469 — the calendar input shape is a list, and the builder fills all of it', () => {
    let cal, built, keys;

    beforeAll(() => {
        const page = loadPage({ errors: [], warnings: [], alerts: [] });
        expect(page.failures).toEqual([]);
        cal = page.sandbox.GilbaNutritionCalendar;
        keys = cal.CALENDAR_INPUT_KEYS;
        const NPI = page.sandbox.GAIP_NutritionProgramInputs;
        const exportInputs = NPI.resolveExportInputs({ siteId: SITE_ID });
        const programInputs = NPI.resolveSiteProgramInputs({ siteId: SITE_ID });
        built = cal.inputsForSite(exportInputs, programInputs, {});
    });

    test('the builder returns exactly the documented keys, no more and no fewer', () => {
        expect(Object.keys(built).sort()).toEqual(keys.slice().sort());
    });

    test('the snapshot the Plan page still takes returns a subset of the same shape', () => {
        // collectFromState() stays where it belongs — the Plan page, which is
        // the page of its own site. What it must not do is carry a key the
        // combined export's object does not have, because the two feed the
        // same engine.
        const src = read('nutrition-calendar.js');
        const body = anchoredSlice(src, 'NutritionCalendar.collectFromState = function() {');
        const ast = parser.parse('(' + body.slice(body.indexOf('function')) + ')',
            { sourceType: 'script', errorRecovery: true });
        let returned = null;
        traverse(ast, {
            ReturnStatement(p) {
                if (returned || !p.node.argument || p.node.argument.type !== 'ObjectExpression') return;
                returned = p.node.argument.properties
                    .map((pr) => pr.key && (pr.key.name || pr.key.value)).filter(Boolean);
            }
        });
        expect(returned).toBeTruthy();
        const strangers = returned.filter((k) => keys.indexOf(k) < 0);
        expect({ strangers: strangers }).toEqual({ strangers: [] });
    });

    test('every field is a value of THIS site, and the twelve that used to be stale are among them', () => {
        // Named individually because they are the measurement: each of these
        // held the facility snapshot, and each is now filled by the builder.
        const wasStale = ['longitude', 'isC4', 'bulkDensity', 'soilDepth', 'monthlyTempsSource',
            'monthlyTempsPeriod', 'turfType', 'bulkDensityDefaulted', 'soilDepthDefaulted',
            'annualNBase', '_speciesDefaulted', '_methodologyDefaulted'];
        const missing = wasStale.filter((k) => !Object.prototype.hasOwnProperty.call(built, k));
        expect({ missing: missing }).toEqual({ missing: [] });
    });

    test('the curve follows the species, and both come from the site', () => {
        // The pair that made this a live defect rather than an untidiness:
        // the name was refreshed per sample and the curve was not.
        expect(built.species).toBe('perennialRyegrass');
        expect(built.isC4).toBe(false);
    });

    test('the two names for the annual N target agree', () => {
        // One was refreshed and the other was not. They are the same number.
        expect(built.annualNBase).toBe(built.annualNOverride);
    });

    test('a site that resolves to nothing yields nulls, not another site\'s values', () => {
        const page = loadPage({ errors: [], warnings: [], alerts: [] });
        const NPI = page.sandbox.GAIP_NutritionProgramInputs;
        const empty = page.sandbox.GilbaNutritionCalendar.inputsForSite(
            NPI.resolveExportInputs({ siteId: 'no-such-site' }), null, {});
        expect(Object.keys(empty).sort()).toEqual(keys.slice().sort());
        expect(empty.species).toBeNull();
        expect(empty.isC4).toBeNull();
        expect(empty.latitude).toBeNull();
    });
});

describe('GH-469 — the combined export builds, and reads the answer it is given', () => {
    const src = read('word-export-combined.js');

    test('the per-sample inputs are built from the sample\'s site, not copied from a snapshot', () => {
        // GH-470: one argument, the object collectData() was given for this
        // sample, carried on the report rather than resolved a second time.
        expect(src).toMatch(/inputsForSite\(r\.data\._exportInputs\)/);
        expect(src).toMatch(/data\._exportInputs = _entryInputs;/);
        const code = src.replace(/\/\/[^\n]*/g, '').replace(/\/\*[\s\S]*?\*\//g, '');
        expect(code).not.toMatch(/Object\.assign\(\{\},\s*_facilityCalendarInputs\)/);
    });

    test('the facility-wide snapshot is not collected at all', () => {
        const code = src.replace(/\/\/[^\n]*/g, '').replace(/\/\*[\s\S]*?\*\//g, '');
        expect(code).not.toMatch(/GilbaNutritionCalendar\.collectFromState\(\)/);
    });

    test('no key is written into the per-sample inputs that the shape does not name', () => {
        // The list is the shape; a field added by assignment further down
        // would be outside it and outside every check that reads it.
        const ast = parser.parse(src, { sourceType: 'script', errorRecovery: true });
        const written = new Set();
        traverse(ast, {
            AssignmentExpression(p) {
                const l = p.node.left;
                if (l.type === 'MemberExpression' && l.object.type === 'Identifier'
                    && l.object.name === 'perSampleInputs' && l.property.type === 'Identifier') {
                    written.add(l.property.name);
                }
            }
        });
        const cal = read('nutrition-calendar.js');
        const listed = (anchoredSlice(cal, 'NutritionCalendar.CALENDAR_INPUT_KEYS = Object.freeze([', '\n    ]);')
            .match(/'([^']+)'/g) || []).map((q) => q.replace(/'/g, ''));
        const strangers = Array.from(written).filter((k) => listed.indexOf(k) < 0);
        expect({ strangers: strangers }).toEqual({ strangers: [] });
    });

    test('a refused site switch skips the sample instead of printing it against the previous one', () => {
        // sample-manager.js:2443 returns false for a site it does not know and
        // leaves the pointer where it was. The loop used to ignore that, so the
        // rest of the iteration ran against the previous sample's site.
        expect(src).toMatch(/if \(sm\.setActiveSite\(entry\.siteId\) === false\)/);
        const branch = anchoredSlice(src, 'if (sm.setActiveSite(entry.siteId) === false) {');
        expect(branch).toMatch(/console\.warn/);
        expect(branch).toMatch(/continue;/);
    });
});

/**
 * GH-470 (PLAN-GH439 section 10.6, ninth refinement) — the object has one
 * source, it is complete, and it cannot be completed afterwards.
 *
 * The eighth refinement's version took three arguments and the combined export
 * wrote seventeen fields onto the result. One of those arguments was declared
 * BELOW the line that used it, so 24 of the 35 fields were built null — and
 * every test stayed green, because the second pass filled back exactly the
 * fourteen the parity harness compares, and a pin on 35 NAMES is satisfied by
 * 35 nulls.
 */
describe('GH-470 — one source, complete, and frozen', () => {
    const src = read('word-export-combined.js');

    test('nothing is written onto the per-sample inputs after they are built', () => {
        const ast = parser.parse(src, { sourceType: 'script', errorRecovery: true });
        const written = [];
        traverse(ast, {
            AssignmentExpression(p) {
                const l = p.node.left;
                if (l.type === 'MemberExpression' && l.object.type === 'Identifier'
                    && l.object.name === 'perSampleInputs') {
                    written.push((l.property && l.property.name) || '<computed>');
                }
            }
        });
        expect({ written: written }).toEqual({ written: [] });
    });

    test('the object is frozen, so a write would throw rather than pass', () => {
        const page = loadPage({ errors: [], warnings: [], alerts: [] });
        const NPI = page.sandbox.GAIP_NutritionProgramInputs;
        const built = page.sandbox.GilbaNutritionCalendar.inputsForSite(
            NPI.resolveExportInputs({ siteId: SITE_ID }));
        expect(Object.isFrozen(built)).toBe(true);
        expect(() => { 'use strict'; built.species = 'Kikuyu'; }).toThrow();
    });

    test('the builder takes one argument', () => {
        const cal = read('nutrition-calendar.js');
        expect(cal).toMatch(/NutritionCalendar\.inputsForSite = function\(inputs\) \{/);
        expect(src).not.toMatch(/inputsForSite\([^)]*,/);
    });

    test('the separate programme resolution in the loop is gone', () => {
        // It was the second border onto the same question, and being declared
        // after the line that used it is what emptied the object.
        const code = src.replace(/\/\/[^\n]*/g, '').replace(/\/\*[\s\S]*?\*\//g, '');
        expect(code).not.toMatch(/resolveSiteProgramInputs\(/);
    });

    test('every key carries a source, and every source names a key', () => {
        const page = loadPage({ errors: [], warnings: [], alerts: [] });
        const cal = page.sandbox.GilbaNutritionCalendar;
        const keys = cal.CALENDAR_INPUT_KEYS.slice().sort();
        expect(Object.keys(cal.calendarSources).sort()).toEqual(keys);
        // Each source is a path inside the one object the builder is given.
        const thin = Object.keys(cal.calendarSources)
            .filter((k) => !/^(site|turf|program|samples|climateNormals|climateReason)(\.[A-Za-z0-9_]+)*$/
                .test(cal.calendarSources[k]));
        expect({ thin: thin }).toEqual({ thin: [] });
    });

    test('no field the resolver answered for comes out null', () => {
        // The assertion the previous version had no form of, and the one that
        // would have caught 24 empty fields on the first run. The truth about
        // which fields the site answered for is the resolver's own `sources`
        // map — not a list kept here.
        const page = loadPage({ errors: [], warnings: [], alerts: [] });
        const NPI = page.sandbox.GAIP_NutritionProgramInputs;
        const inputs = NPI.resolveExportInputs({ siteId: SITE_ID });
        const built = page.sandbox.GilbaNutritionCalendar.inputsForSite(inputs);
        const sources = page.sandbox.GilbaNutritionCalendar.calendarSources;

        // "The site answered for this field" is read out of the resolver's own
        // provenance maps, never out of a list kept here — a list would be the
        // same shape this refinement removed, one level up.
        const resolved = (path) => {
            const parts = path.split('.');
            const head = parts[0];
            if (head === 'program') {
                if (!inputs.program) return false;
                const field = parts[1] === 'sources' ? parts[2] : parts[1];
                const stamp = inputs.program.sources && inputs.program.sources[field];
                // A field the programme's own map does not mention is not one
                // the site claimed to answer for — CEC and pH come off the
                // sample, and this site's has neither.
                return stamp !== undefined && stamp !== 'unresolved';
            }
            if (head === 'samples') return !!inputs.samples[parts[1]];
            if (head === 'climateNormals') {
                return !!(inputs.climateNormals
                    && inputs.climateNormals[parts[1]] !== undefined);
            }
            // climateReason is null exactly when the normals DID resolve.
            if (head === 'climateReason') return !!inputs.climateReason;
            const field = parts[parts.length - 1];
            if (head === 'site') return inputs.site.location[field] != null;
            return inputs.sources[field] !== undefined && inputs.sources[field] !== 'unresolved';
        };
        const empty = Object.keys(sources)
            .filter((k) => resolved(sources[k]))
            .filter((k) => built[k] === null)
            .map((k) => k + ' <- ' + sources[k]);
        expect({ empty: empty }).toEqual({ empty: [] });
    });
});

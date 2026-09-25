/**
 * GH-722 — THE LAB READING NAMES ARE DECLARED ONCE, AND THE MAP AND THE RUNNER AGREE BOTH WAYS.
 *
 * `assets/lab-reading-names.json` says how a lab writes the column for each reading; the runner
 * (`sample-manager.js`) says which form field each reading fills. Two different facts, one file
 * each. This holds that they cover the same readings:
 *   - SIDE 1: a reading the runner binds to a field, with no entry in the map, can never be read
 *     from any file — red, naming `kind.reading`;
 *   - SIDE 2: a reading the map declares that the runner does not bind is accepted by an upload
 *     and read by no calculation — red, naming it, unless it is one of the four the owner has not
 *     yet decided about (below), each with its reason. An exception that stops being true
 *     (bound now, or no longer declared) reddens too, so the list cannot outlive its subject.
 *
 * THE UNIVERSE IS THE RUNNER'S OWN BINDING, read from the loaded module (`readingFields`), not
 * from the map — a comparison of the map with itself would be green for ever. The map is handed
 * to the module exactly as the server hands it to the page.
 *
 * WHAT THIS DOES NOT SEE, said rather than left to be found: code that reads a sample's payload
 * keys directly, past the runner, with its own chain of spellings (`payload['pH_Water'] ??
 * payload['pH']` and the like). Those readers are not bound through the map, so neither side
 * can name them; the census prints none of them.
 */

'use strict';

const fs = require('fs');
const path = require('path');
const { loadManager } = require('./lib/sample-form-bench');

const ROOT = path.join(__dirname, '..');
const MAP = JSON.parse(fs.readFileSync(path.join(ROOT, 'assets', 'lab-reading-names.json'), 'utf8'));
const KINDS = ['soil', 'water', 'tissue', 'loi'];

// Declared by the upload and read by no calculation, pending the owner's decision on whether
// each is a reading at all (the upload page has accepted them since before GH-722).
const DECLARED_BUT_NOT_READ = {
    'water.TDS': 'accepted by the upload; the runner reads it only as a fallback for EC on a path that does not reach the run (GH-722)',
    'water.SAR': 'accepted by the upload; the runner reads a lab SAR only as a fallback when ions are missing (GH-722)',
    'loi.thatch': 'accepted by the upload and shown on the Data page; no calculation reads it (GH-722)',
    'loi.moisture': 'accepted by the upload and shown on the Data page; no calculation reads it (GH-722)',
};

function bound(sm) {
    const out = {};
    KINDS.forEach((k) => { out[k] = (sm.readingFields || {})[k] || {}; });

    return out;
}

describe('GH-722 — one map of lab reading names, and the runner binds exactly what it declares', () => {
    const { sm, ctx } = loadManager(MAP);
    const binding = bound(sm);

    test('the universe: what the map declares and what the runner binds, per kind', () => {
        KINDS.forEach((k) => {
            const t = MAP.types[k];
            process.stdout.write('[gh722] ' + k + ' — map readings ' + JSON.stringify(Object.keys(t.readings))
                + '; map attributes ' + JSON.stringify(Object.keys(t.attributes || {}))
                + '; runner binds ' + JSON.stringify(Object.keys(binding[k])) + '\n');
        });
        expect(Object.keys(MAP.types)).toEqual(KINDS);
        KINDS.forEach((k) => expect(Object.keys(binding[k]).length).toBeGreaterThan(0));
        expect(ctx.GAIP_LAB_READING_NAMES_UNAVAILABLE).toBeUndefined();
    });

    test('SIDE 1: every reading the runner binds has spellings in the map', () => {
        const missing = [];
        KINDS.forEach((k) => {
            const t = MAP.types[k];
            Object.keys(binding[k]).forEach((key) => {
                if (!(key in t.readings) && !(key in (t.attributes || {}))) missing.push(k + '.' + key + ' (fills ' + binding[k][key] + ')');
            });
        });
        expect({ boundButNotInTheMap: missing }).toEqual({ boundButNotInTheMap: [] });
    });

    test('SIDE 2: every reading the map declares is bound by the runner, or is named as not read', () => {
        const unbound = [];
        KINDS.forEach((k) => Object.keys(MAP.types[k].readings).forEach((key) => {
            if (!(key in binding[k])) unbound.push(k + '.' + key);
        }));
        process.stdout.write('[gh722] declared and bound by no form field: ' + JSON.stringify(unbound) + '\n');
        const notExcused = unbound.filter((x) => !(x in DECLARED_BUT_NOT_READ));
        const staleExcuses = Object.keys(DECLARED_BUT_NOT_READ).filter((x) => !unbound.includes(x));
        expect({ notExcused, staleExcuses }).toEqual({ notExcused: [], staleExcuses: [] });
    });

    test('each reading is one of its own spellings, and no spelling belongs to two readings of one kind', () => {
        const problems = [];
        KINDS.forEach((k) => {
            const t = MAP.types[k];
            const owner = {};
            [t.readings, t.attributes || {}].forEach((group) => Object.keys(group).forEach((key) => {
                if (!group[key].includes(key)) problems.push(k + '.' + key + ' is not among its own spellings');
                group[key].forEach((s) => {
                    const low = s.toLowerCase();
                    // The resolver matches without case, so two spellings that differ only in
                    // case under two readings would make the answer depend on declaration order.
                    if (owner[low] && owner[low] !== key) problems.push(k + ': "' + s + '" spells both ' + owner[low] + ' and ' + key);
                    owner[low] = key;
                });
            }));
        });
        expect(problems).toEqual([]);
    });

    test('given no map, the runner says so and reads nothing rather than reading an empty sample', () => {
        const bare = loadManager(undefined);
        expect(bare.ctx.GAIP_LAB_READING_NAMES_UNAVAILABLE).toMatchObject({ reason: 'the page was not given the lab reading names' });
        expect(bare.said.join('\n')).toMatch(/lab reading names not installed/);
        expect(bare.sm.readingsOf('soil', { values: { pH: 6.5 } })).toBeNull();
        expect(bare.sm.readingKeysFor('soil')).toBeNull();
        // With the map, the same sample reads.
        expect(sm.readingsOf('soil', { values: { pH: 6.5 } })).toEqual({ pH: 6.5 });
    });

    test('the runner keeps no spelling table of its own', () => {
        const src = fs.readFileSync(path.join(ROOT, 'assets', 'sample-manager.js'), 'utf8');
        expect(src).not.toMatch(/_FIELD_MAP\s*=\s*\{/);
        expect(src).not.toMatch(/EXTRACTION_METHOD_SUFFIXES\s*=\s*\[/);
    });

    test('every view that loads the runner is given the map by its layout', () => {
        const views = path.join(ROOT, 'app', 'resources', 'views');
        const files = [];
        (function walk(dir) {
            fs.readdirSync(dir, { withFileTypes: true }).forEach((e) => {
                const p = path.join(dir, e.name);
                if (e.isDirectory()) walk(p);
                else if (e.name.endsWith('.blade.php')) files.push(p);
            });
        }(views));
        const injecting = files.filter((f) => /window\.GAIP_LAB_READING_NAMES\s*=\s*@json\(\\App\\Support\\LabReadingNames::forClient\(\)\)/
            .test(fs.readFileSync(f, 'utf8'))).map((f) => path.relative(views, f));
        const loaders = files.filter((f) => /sample-manager\.js/.test(fs.readFileSync(f, 'utf8'))).map((f) => {
            const src = fs.readFileSync(f, 'utf8');
            const ext = /@extends\('([^']+)'/.exec(src);
            return { view: path.relative(views, f), layout: ext ? ext[1] : null };
        });
        process.stdout.write('[gh722] views scanned ' + files.length + '; injecting ' + JSON.stringify(injecting)
            + '; loading the runner ' + JSON.stringify(loaders) + '\n');
        const layoutFile = (name) => name.replace(/\./g, '/') + '.blade.php';
        const notGiven = loaders.filter((l) => !l.layout || !injecting.includes(layoutFile(l.layout)));
        expect(loaders.length).toBeGreaterThan(0);
        expect({ loadsTheRunnerWithoutTheMap: notGiven }).toEqual({ loadsTheRunnerWithoutTheMap: [] });
    });
});

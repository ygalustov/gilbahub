/**
 * GH-703 — A LIVE TEST THAT NAMES A SITE OF THE STAND IS A TEST THE OWNER'S OWN EDIT CAN BREAK.
 *
 * The owner changed the parameters of one stand site, the live tests broke, and from then on
 * she stopped entering data on the stand so as not to break them. The class: a live test whose
 * expected value, precondition or snapshot comes from a site of the stand rather than from
 * state the test built itself. The cure is a test that builds its own site; until each live
 * test is moved onto one, this file keeps the class from growing.
 *
 * WHAT IS COUNTED, AND FROM WHERE:
 *   - the universe is every file under `tests/e2e`, printed with its count;
 *   - a stand site is named either by a UUIDv7 literal, or by a quoted name that the fixtures
 *     themselves declare as a site (`siteName`, or `name` beside a UUID `id` / `siteId`). The
 *     fixtures are the declared source; nothing here reads the stand, because a guard that
 *     reads the stand is green when the stand is unreachable — the very form of the class;
 *   - `tests/fixtures/gh703-stand-site-references.json` is the inventory: per file, the
 *     identities it names today. A file may only name what it is listed with.
 *
 * WHAT IS ASSERTED: the census equals the inventory, both ways. A new name in a live test is
 * red with the file and the identity; a name that disappeared is red too, so the inventory
 * shrinks by an edit someone can see instead of drifting silently.
 *
 * WHAT THIS DOES NOT GUARD — named, not discovered: a file already in the inventory can start
 * expecting a NEW value of a site it already names, and nothing here turns red. The census
 * sees identities, not expectations. Removing that residue is moving each listed file onto a
 * site of its own.
 *
 * AND ONE MORE BOUNDARY OF THE SIGN: a site is recognised by name only if some fixture declares
 * that name. The declared names are printed on every run; a stand site whose name no fixture
 * carries is caught by its UUID and not by its name.
 */

'use strict';

const fs = require('fs');
const path = require('path');

const ROOT = path.join(__dirname, '..');
const E2E = path.join(ROOT, 'tests', 'e2e');
const FIXTURES = path.join(ROOT, 'tests', 'fixtures');
const INVENTORY = path.join(FIXTURES, 'gh703-stand-site-references.json');

const UUID_V7 = /\b[0-9a-f]{8}-[0-9a-f]{4}-7[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}\b/g;
const IS_UUID_V7 = /^[0-9a-f]{8}-[0-9a-f]{4}-7[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/;

function filesUnder(dir, pred) {
    const out = [];
    (function rec(d) {
        for (const e of fs.readdirSync(d, { withFileTypes: true })) {
            const p = path.join(d, e.name);
            if (e.isDirectory()) rec(p);
            else if (pred(p)) out.push(p);
        }
    })(dir);
    return out.sort();
}

/** Site names the fixtures declare, with the fixture that declares each. */
function declaredSiteNames(fixtureFiles) {
    const names = new Map();
    function visit(node, file) {
        if (Array.isArray(node)) { node.forEach((n) => visit(n, file)); return; }
        if (!node || typeof node !== 'object') return;
        const id = node.siteId || node.site_id || node.id;
        const hasSiteId = typeof id === 'string' && IS_UUID_V7.test(id);
        for (const key of ['siteName', 'site_name']) {
            if (typeof node[key] === 'string' && node[key].trim()) names.set(node[key], file);
        }
        if (hasSiteId && typeof node.name === 'string' && node.name.trim()) names.set(node.name, file);
        Object.keys(node).forEach((k) => visit(node[k], file));
    }
    for (const f of fixtureFiles) {
        if (path.resolve(f) === path.resolve(INVENTORY)) continue;
        let json;
        try { json = JSON.parse(fs.readFileSync(f, 'utf8')); } catch (e) { continue; }
        visit(json, path.relative(ROOT, f));
    }
    return names;
}

function escapeRe(s) { return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'); }

/** Every stand identity one source text names: UUIDv7 literals and quoted declared names. */
function identitiesIn(src, names) {
    const found = new Set();
    (src.match(UUID_V7) || []).forEach((u) => found.add(u));
    for (const name of names) {
        const quoted = new RegExp('([\'"`])' + escapeRe(name) + '\\1');
        if (quoted.test(src)) found.add(name);
    }
    return Array.from(found).sort();
}

function census() {
    const files = filesUnder(E2E, (p) => /\.(js|mjs|cjs)$/.test(p));
    const names = declaredSiteNames(filesUnder(FIXTURES, (p) => p.endsWith('.json')));
    const byFile = {};
    for (const f of files) {
        const ids = identitiesIn(fs.readFileSync(f, 'utf8'), names.keys());
        if (ids.length) byFile[path.relative(ROOT, f)] = ids;
    }
    return { inspected: files.length, files: files.map((f) => path.relative(ROOT, f)), names, byFile };
}

function compare(inventory, byFile) {
    const added = [];
    const gone = [];
    const all = new Set([...Object.keys(inventory), ...Object.keys(byFile)]);
    for (const file of Array.from(all).sort()) {
        const listed = new Set(inventory[file] || []);
        const seen = new Set(byFile[file] || []);
        seen.forEach((id) => { if (!listed.has(id)) added.push(file + ' -> ' + id); });
        listed.forEach((id) => { if (!seen.has(id)) gone.push(file + ' -> ' + id); });
    }
    return { added, gone };
}

describe('GH-703 — live tests name stand sites only where the inventory lists them', () => {
    test('the census of tests/e2e equals the inventory, both ways', () => {
        const c = census();
        const inventory = JSON.parse(fs.readFileSync(INVENTORY, 'utf8')).files;

        process.stdout.write('[gh703] inspected ' + c.inspected + ' files under tests/e2e; '
            + c.names.size + ' site names declared by fixtures; '
            + Object.keys(c.byFile).length + ' files name a stand site\n');
        // What was looked at, by name: a green run without this list cannot be told from a run
        // that never reached the files.
        process.stdout.write('[gh703] inspected:\n   ' + c.files.map((f) => (c.byFile[f] ? 'names ' : 'clean ') + f).join('\n   ') + '\n');
        process.stdout.write('[gh703] declared site names: ' + JSON.stringify(Array.from(c.names.keys()).sort()) + '\n');
        if (process.env.GH703_PRINT) process.stdout.write(JSON.stringify(c.byFile, null, 2) + '\n');

        const { added, gone } = compare(inventory, c.byFile);
        if (added.length) process.stdout.write('[gh703] NEW stand-site references:\n   ' + added.join('\n   ') + '\n');
        if (gone.length) process.stdout.write('[gh703] listed but no longer named (shrink the inventory):\n   ' + gone.join('\n   ') + '\n');

        expect(added).toEqual([]);
        expect(gone).toEqual([]);
    });

    test('the census sees both forms of naming — a UUID and a declared name — in a source that exists nowhere in the tree', () => {
        const names = new Map([['Plant Site - XX', 'plant']]);
        const src = "const a = '0199aaaa-bbbb-7ccc-8ddd-eeeeeeeeeeee'; login(); open(\"Plant Site - XX\");"
            + " // Plant Site - XXL is not a quoted name";
        expect(identitiesIn(src, names.keys())).toEqual(['0199aaaa-bbbb-7ccc-8ddd-eeeeeeeeeeee', 'Plant Site - XX']);
        expect(identitiesIn('var s = "Plant Site - XXL";', names.keys())).toEqual([]);
    });
});

module.exports = { census, compare, identitiesIn };

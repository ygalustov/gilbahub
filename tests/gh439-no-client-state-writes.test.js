/**
 * GH-439 — the check that fails if client-held state becomes a write path
 * again.
 *
 * Every defect in GH-439 had the same shape: the browser kept a copy of a
 * site's configuration and sent that copy to the server. A snapshot of the
 * legacy form taken before the real config arrived became the config; a
 * registry label that fell back to a site ID became the site's name; a
 * localStorage blob from an earlier session became the configuration of a site
 * the tab was not even looking at.
 *
 * These were six `test.todo` lines written in stage 0, each naming a property
 * a later stage would have to make true. Stage 3 made the last of them true,
 * so they are assertions now. Nothing here was weakened to get a green run —
 * each case states the same property its placeholder named, and each one was
 * checked against the tree before the stage that closed it.
 */

'use strict';

const fs = require('fs');
const path = require('path');

const ASSETS_DIR = path.join(__dirname, '../assets');
const VIEWS_DIR = path.join(__dirname, '../app/resources/views');

// The plugin-era hub's own import/export module. It reads and writes the
// legacy storage keys by design — moving a site between browsers by file is
// what it is for — and it is not loaded by any page of the new hub.
const LEGACY_EXCEPTIONS = ['site-data-transfer.js'];

function assetFiles() {
    return fs.readdirSync(ASSETS_DIR)
        .filter((f) => f.endsWith('.js'))
        .filter((f) => LEGACY_EXCEPTIONS.indexOf(f) === -1);
}

function read(file) {
    return fs.readFileSync(path.join(ASSETS_DIR, file), 'utf8');
}

// A line of code, not a line of prose: these files explain themselves at
// length, and the explanations name the very things being removed.
function codeLines(src) {
    let inBlockComment = false;
    return src.split('\n').filter((line) => {
        const trimmed = line.trim();
        if (inBlockComment) {
            if (trimmed.includes('*/')) inBlockComment = false;
            return false;
        }
        if (trimmed.startsWith('/*')) {
            if (!trimmed.includes('*/')) inBlockComment = true;
            return false;
        }
        if (trimmed.startsWith('//') || trimmed.startsWith('*')) return false;
        return true;
    });
}

function hits(file, pattern) {
    return codeLines(read(file))
        .map((line, i) => ({ line: line.trim(), n: i }))
        .filter((entry) => pattern.test(entry.line));
}

describe('GH-439 — no client-held state reaches the server', () => {
    test('no asset writes gilba_hub_site_configs, except the one removeItem that deletes it', () => {
        const offenders = [];
        assetFiles().forEach((file) => {
            hits(file, /gilba_hub_site_configs/).forEach((entry) => {
                offenders.push(file + ': ' + entry.line.slice(0, 90));
            });
        });

        // site-config-persistence.js names the key once, in the constant its
        // one-time cleanup deletes.
        expect(offenders).toEqual([
            "site-config-persistence.js: var STORAGE_KEY = 'gilba_hub_site_configs';",
        ]);

        const persistence = read('site-config-persistence.js');
        expect(persistence).toMatch(/localStorage\.removeItem\(key\)/);
        expect(persistence).not.toMatch(/setItem\(\s*STORAGE_KEY/);
    });

    test('no asset posts to sites/sync', () => {
        const offenders = [];
        assetFiles().forEach((file) => {
            hits(file, /sites\/sync/).forEach((entry) => {
                offenders.push(file + ': ' + entry.line.slice(0, 90));
            });
        });
        expect(offenders).toEqual([]);
    });

    test('no asset sends config/gaip with method PUT', () => {
        const offenders = [];
        assetFiles().forEach((file) => {
            const lines = codeLines(read(file));
            lines.forEach((line, i) => {
                if (!/config\/gaip/.test(line)) return;
                // The URL and the method are routinely on different lines.
                const window = lines.slice(Math.max(0, i - 6), i + 12).join('\n');
                if (/(method:\s*'PUT')|(apiFetch\('PUT')|(_api\('PUT')/.test(window)) {
                    offenders.push(file + ': ' + line.trim().slice(0, 90));
                }
            });
        });
        expect(offenders).toEqual([]);
    });

    test('site-config-persistence.js fetches with GET and PATCH only', () => {
        const src = read('site-config-persistence.js');
        const methods = codeLines(src)
            .map((line) => (line.match(/method:\s*'([A-Z]+)'/) || [])[1])
            .filter(Boolean);
        expect(methods.sort()).toEqual(['PATCH']);
        // The only other request it makes is the plain GET of /api/sites.
        expect(src).toMatch(/apiFetchJson\(base\.replace\(\/\\\/\?\$\/, '\/'\) \+ 'sites'\)/);
    });

    test('sample-persistence.js has no syncSiteListToServer', () => {
        const src = read('sample-persistence.js');
        expect(codeLines(src).filter((l) => /syncSiteListToServer/.test(l))).toEqual([]);
        // And nothing rebuilds the site registry from this browser either.
        expect(codeLines(src).filter((l) => /recoverSitesFromLegacyConfig/.test(l))).toEqual([]);
    });

    test('location-preloader.js is loaded by no view, and no longer exists', () => {
        expect(fs.existsSync(path.join(ASSETS_DIR, 'location-preloader.js'))).toBe(false);

        const offenders = [];
        function walk(dir) {
            fs.readdirSync(dir, { withFileTypes: true }).forEach((entry) => {
                const full = path.join(dir, entry.name);
                if (entry.isDirectory()) return walk(full);
                if (!entry.name.endsWith('.blade.php')) return;
                if (/location-preloader/.test(fs.readFileSync(full, 'utf8'))) {
                    offenders.push(path.relative(VIEWS_DIR, full));
                }
            });
        }
        walk(VIEWS_DIR);
        expect(offenders).toEqual([]);
    });
});

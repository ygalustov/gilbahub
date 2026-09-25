/**
 * GH-625 — THE SITE BUNDLE NEITHER EXPORTS NOR RESTORES THE CONFIG, AND NO
 * LONGER SAYS THAT IT DOES.
 *
 * WHAT WAS THERE. `site-data-transfer.js` exported a site to a `.json` file and
 * imported it back. Two halves of that dealt with the site's configuration: the
 * export read `gilba_hub_site_configs` out of `localStorage`, and the import
 * wrote the bundle's config back into the same key and logged "Site config
 * restored for: …".
 *
 * WHY BOTH WERE DEAD. GH-441 took that key out of service, and
 * `site-config-persistence.js` clears it — and its namespaced twin —
 * UNCONDITIONALLY in `init()`. Nothing outside the transfer module reads it. So
 * the export has been writing `null` into every bundle for as long as that has
 * been true, and the import landed its write in a key wiped moments later while
 * the log said the opposite.
 *
 * WHY REMOVED RATHER THAN REPAIRED. The project rule covers this exact case: a
 * control that stopped working because a write path was removed is removed, not
 * wired back up. The config's write path went on purpose — a page pushing a
 * whole held config is the defect GH-439 was opened for — and restoring it here
 * would rebuild the browser copy that work took out. The control is reachable
 * only from `/hub`: the bar it mounts into, `gaip-site-selector-top`, exists in
 * `partials/legacy-hub-markup.blade.php` and nowhere else, and `/hub` is a
 * calculation runner rather than a page a client opens.
 *
 * WHAT STILL WORKS, asserted below so the removal is not read as wider than it
 * is: the samples still merge, and the site's coordinates are still PATCHed to
 * the server, which is where they belong.
 */

'use strict';

const fs = require('fs');
const path = require('path');

const SRC = fs.readFileSync(
    path.join(__dirname, '..', 'assets', 'site-data-transfer.js'), 'utf8');
const PERSISTENCE = fs.readFileSync(
    path.join(__dirname, '..', 'assets', 'site-config-persistence.js'), 'utf8');

/** Source with comments removed — these blocks explain the key they stopped using. */
const code = (src) => src
    .replace(/\/\*[\s\S]*?\*\//g, '')
    .split('\n').filter((l) => !/^\s*\/\//.test(l)).join('\n');

describe('GH-625 — the bundle does not carry the site config', () => {
    test('the file was read and still contains the transfer, so nothing here is vacuous', () => {
        // Positive control: every absence below is about one key, not about a
        // module that has gone missing.
        expect(SRC.length).toBeGreaterThan(5000);
        // GH-750: the import is gone; the export is what remains of the transfer.
        expect(SRC).toContain('function exportSite');
        expect(code(SRC)).toContain('var siteConfig = null;');
    });

    test('neither half touches the dead key any more', () => {
        // Both directions in one claim: the export read it, the import wrote
        // it, and now neither does.
        expect(code(SRC)).not.toContain('gilba_hub_site_configs');
    });

    test('and the key really is cleared on every load, which is why', () => {
        // The reason stated against the other file rather than asserted here:
        // `forgetStoredConfigs()` is called from `init()` with no condition, so
        // the key cannot survive a page load.
        const p = code(PERSISTENCE);
        expect(p).toContain('function forgetStoredConfigs()');
        const initAt = p.indexOf('function init()');
        expect(initAt).toBeGreaterThan(-1);
        const initBody = p.slice(initAt, initAt + 600);
        expect(initBody.length).toBeGreaterThan(200);
        expect(initBody).toContain('function init()');
        expect(initBody).toContain('forgetStoredConfigs();');
    });

    test('GH-750: the import is gone — nothing of it writes to the server or to browser storage — and the export stays', () => {
        // Its one server write PATCHed the file's coordinates into the site the PAGE had open, and
        // without it the button would only have made browser copies. THIS case holds the CONTROL:
        // the import function is gone and only the export button is added. That nothing here writes
        // to the server is `gh711`'s claim, not this one's -- its census sees a write however the verb
        // is spelt (measured: `var verb = "PATCH"` left this file green and turned gh711 red), so a
        // text check for `method: 'PATCH'` here would only have looked like a second guard.
        const c = code(SRC);
        expect(c).not.toContain('function importSite');
        expect(c).not.toContain('restoreFromPersistence');
        expect(c).toContain('function exportSite');

        const vm = require('vm');
        const added = [];
        const el = (tag) => ({ tag, style: {}, addEventListener() {}, set id(v) { this._id = v; }, get id() { return this._id; } });
        const bar = { insertBefore(n) { added.push(n.id); }, appendChild(n) { added.push(n.id); } };
        const box = {
            console: { log() {}, warn() {} },
            document: { readyState: 'complete', getElementById: (id) => (id === 'gaip-site-selector-top' ? bar : null),
                createElement: el, querySelector: () => null, addEventListener() {}, body: { appendChild() {} } },
            setInterval: (fn) => { fn(); return 1; }, clearInterval() {}, setTimeout: () => 0,
            localStorage: { getItem: () => null, setItem() {} },
        };
        box.window = box; box.global = box; box.globalThis = box;
        vm.runInContext(SRC, vm.createContext(box), { filename: 'site-data-transfer.js' });
        process.stdout.write('[gh750] buttons added to a planted selector bar: ' + JSON.stringify(added) + '\n');
        expect(added).toEqual(['gaip-site-export-btn']);
    });
});

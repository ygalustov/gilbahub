/**
 * GH-451 (GH-439 stage 4b) — the setup wizard decides from the database.
 *
 * Before this, three things could suppress the overlay: the injected flag from
 * the server, a per-browser copy of the same answer (`gilba_wizard_complete`),
 * and — the one that actually did it — any entry at all in
 * `gilba_turf_profiles`, a key written on every hub-page load and shared by
 * every site. In a browser that had opened a hub page once, the wizard was
 * suppressed everywhere regardless of what the database said, which is why
 * repairing the record (stage 4a) changed nothing on screen until now.
 *
 * The live proof is the paired scenario S5b in the e2e suite: the same three
 * assertions in an ordinary browser and in a clean context, which have to
 * agree. This file pins the code shape that makes that possible.
 */

'use strict';

const fs = require('fs');
const path = require('path');

function read(name) {
    return fs.readFileSync(path.join(__dirname, '../assets/' + name), 'utf8');
}

function codeLines(src) {
    let inBlock = false;
    return src.split('\n').filter((line) => {
        const t = line.trim();
        if (inBlock) {
            if (t.includes('*/')) inBlock = false;
            return false;
        }
        if (t.startsWith('/*')) {
            if (!t.includes('*/')) inBlock = true;
            return false;
        }
        return !t.startsWith('//') && !t.startsWith('*');
    });
}

describe('GH-451 — nothing in the browser gates the setup wizard', () => {
    test('site-setup-wizard.js reads neither storage key', () => {
        const code = codeLines(read('site-setup-wizard.js')).join('\n');
        expect(code).not.toMatch(/gilba_wizard_complete/);
        expect(code).not.toMatch(/gilba_turf_profiles/);
        expect(code).not.toMatch(/WIZARD_STORAGE_KEY/);
    });

    test('the only gate left is the injected flag', () => {
        const src = read('site-setup-wizard.js');
        const gate = src.slice(src.indexOf('// Check server-side flag first.'), src.indexOf('MODAL CONSTRUCTION'));
        const returns = codeLines(gate).filter((line) => /^\s*return;\s*$/.test(line));
        // One early return: the injected flag says the wizard was answered.
        expect(returns.length).toBe(1);
        expect(gate).toMatch(/if \(GAIP_WIZARD_CONFIG\.wizardComplete\) \{\s*\n\s*return;/);
        expect(codeLines(gate).join('\n')).toMatch(/this\.show\(\);/);
    });

    test('nothing writes the wizard key any more, here or in the storage migration', () => {
        expect(codeLines(read('site-setup-wizard.js')).join('\n')).not.toMatch(/setItem\(\s*WIZARD_STORAGE_KEY|setItem\('gilba_wizard_complete'/);
        expect(codeLines(read('gilba-storage-migrate.js')).join('\n')).not.toMatch(/gilba_wizard_complete/);
    });

    test('the turf profiles themselves are untouched — they stop being a gate, not a store', () => {
        // The legacy controller still owns this key; only the wizard stopped
        // reading it. Deleting it would be a different decision (Profile
        // Save/Load), taken elsewhere.
        expect(codeLines(read('turf-profile-controller.js')).join('\n')).toMatch(/gilba_turf_profiles/);
        expect(codeLines(read('gilba-storage-migrate.js')).join('\n')).toMatch(/gilba_turf_profiles/);
    });

    test('the server answers `complete` OR `skipped`', () => {
        // GH-450: a wizard someone deliberately dismissed has been answered.
        // The client code has always read both, but only after a save; the
        // injected flag read `complete` alone, and with the profile gate gone
        // that would reopen the overlay on every clean browser.
        const provider = fs.readFileSync(
            path.join(__dirname, '../app/app/Providers/AppServiceProvider.php'), 'utf8');
        expect(provider).toMatch(/injectedWizardAnswered.*\n?.*\$wizardState\['complete'\].*\|\|.*\$wizardState\['skipped'\]/);

        const dbShell = fs.readFileSync(
            path.join(__dirname, '../app/resources/views/layouts/db-shell.blade.php'), 'utf8');
        expect(dbShell).toMatch(/wizardComplete: @json\(\$injectedWizardAnswered/);

        const app = fs.readFileSync(
            path.join(__dirname, '../app/resources/views/layouts/app.blade.php'), 'utf8');
        expect(app).toMatch(/\$wizardState\['complete'\] \?\? false\) \|\| \(\$wizardState\['skipped'\]/);
    });
});

/**
 * GH-402 — importing a CSV must not switch a site onto a different calculation
 * model behind the user's back.
 *
 * b35fix371 turned multi-site turf ON automatically whenever an imported file
 * carried a species column. That mode makes per-sample turf profiles live:
 * selecting a sample overwrites the site's own turf settings — type, species,
 * variety, oversow — with the ones attached to that sample, and everything
 * downstream (removal rates, growth potential, product selection) is then
 * computed for that grass instead of the configured one.
 *
 * The product's answer to "one site, several surfaces with different grass" is
 * a separate site per surface. The per-sample profile is a second, competing
 * model for the same question, and whether it should exist at all is undecided.
 * It is dormant today: no site in the database has the mode on, the toggle
 * exists only on /hub and the three report pages — never in the new hub's
 * Settings — and our own import templates carry no species column, so only a
 * hand-edited file could have reached it.
 *
 * So what is removed is the silent arming, not the feature. A client importing
 * a lab file would otherwise have had their calculation quietly start following
 * the sample rather than their settings, with no control anywhere in the new
 * hub to notice it or turn it back off.
 *
 * The bulk-apply modal has a similar auto-enable and is deliberately left
 * alone: its button is hidden while the mode is off (`sample-switcher-ui.js`
 * sets `display:none`), so the modal cannot be opened to reach it, and once the
 * mode is on the call is a no-op.
 */

'use strict';

const fs = require('fs');
const path = require('path');

const readAsset = (f) => fs.readFileSync(path.join(__dirname, '../assets', f), 'utf8');

describe('GH-402 — a CSV import cannot silently enable multi-site turf', () => {
    const src = readAsset('sample-manager.js');

    test('the importer no longer calls the enable setter at all', () => {
        expect(src).not.toMatch(/setMultiSiteTurfEnabled\s*\(\s*_currentSite\s*,\s*true\s*\)/);
        // Nothing anywhere in the importer may turn it on, however spelled.
        expect(src).not.toMatch(/setMultiSiteTurfEnabled\s*\([^)]*,\s*true\s*\)/);
    });

    test('the reasoning survives in place, so nobody restores it without meeting it', () => {
        expect(src).toMatch(/GH-402/);
        expect(src).toMatch(/must not change how a site is calculated/);
        expect(src).toMatch(/To restore/);
    });

    test('samples still carry the profile — the data is kept, only the arming is gone', () => {
        // Removing the write as well would lose information that matters if the
        // feature is kept, and it is inert while the mode is off.
        expect(src).toMatch(/sample\.turfProfile = \{ species: turfSpecies \}/);
    });

    test('the bulk modal keeps its own enable, and stays unreachable while the mode is off', () => {
        const modal = readAsset('sample-turf-profile-bulk-modal.js');
        expect(modal).toMatch(/setMultiSiteTurfEnabled\(siteId, true\)/);
        const switcher = readAsset('sample-switcher-ui.js');
        expect(switcher).toMatch(/bulkTurfBtn\.style\.display = on \? '' : 'none'/);
    });

    test('our own import templates carry no species column, which is why this was not urgent', () => {
        const dir = path.join(__dirname, '../files/samples/templates');
        const header = fs.readFileSync(path.join(dir, 'soil_test_template.csv'), 'utf8')
            .split('\n')[0].toLowerCase();
        expect(header).not.toMatch(/species|turf|variety/);
    });
});

/**
 * GH-395 — MLSN is not offered in Settings for a New Zealand site.
 *
 * Why this is a real defect and not a cosmetic one: MLSN is the one methodology
 * the NZ path cannot honour end to end. `getMethodology()`
 * (nutrition-nz-fertiliser-integration.js, which runs only for NZ sites) folds
 * everything except SLAN into ammonium acetate, so product selection runs on AA
 * — while the requirement engine reads the raw `turf.methodology` out of the
 * site config through the shared input adapter and branches on MLSN thresholds.
 * Same site, two methodologies, and nothing on screen shows they disagree.
 * SLAN is deliberately still offered: it passes that fold untouched, so both
 * halves honour it and an NZ site on SLAN is consistent today.
 *
 * Do not confuse this with `Controller::effectiveMethodology()`, which does
 * force AA for NZ coordinates but is called only by SettingsController for this
 * page's own display value. The `$turfMethodology` that reaches every OTHER
 * page is built in AppServiceProvider from the raw saved value, unforced — which
 * is why saving 'mlsn' here really did reach the engine.
 *
 * The narrow fix, chosen over the wider storage rework it was found alongside
 * (see PLAN-methodology-storage.md): drop the option, and show an already-saved
 * 'mlsn' as Ammonium Acetate, because that is what such a site computes its
 * pages on today. Display normalisation only — nothing is written unless the
 * user saves the form.
 *
 * Structural pins on the blade, matching this repo's existing convention for
 * view-layer assertions (see gh312 / gh319). The behavioural half is the live
 * check recorded in the changelog entry.
 */

'use strict';

const fs = require('fs');
const path = require('path');

const BLADE = path.join(__dirname, '../app/resources/views/settings.blade.php');
const src = fs.readFileSync(BLADE, 'utf8');

// The @php block that builds the dropdown, isolated so a match elsewhere in a
// 1000-line template cannot make these pass by accident.
const blockStart = src.indexOf('$methOptions = [');
const blockEnd = src.indexOf('</select>', blockStart);
const block = src.slice(blockStart, blockEnd);

describe('GH-395 — NZ sites are not offered MLSN', () => {
    test('the option list still offers all three methodologies by default', () => {
        expect(blockStart).toBeGreaterThan(-1);
        expect(block).toMatch(/'mlsn'\s*=>/);
        expect(block).toMatch(/'slan'\s*=>/);
        expect(block).toMatch(/'ammonium_acetate'\s*=>/);
    });

    test('MLSN is removed from the list when the site is in New Zealand', () => {
        expect(block).toMatch(/\$isNZ\s*=\s*\(\$isNewZealand\s*\?\?\s*false\)/);
        expect(block).toMatch(/if\s*\(\$isNZ\)\s*\{[\s\S]*unset\(\$methOptions\['mlsn'\]\)/);
    });

    test('a site already saved as mlsn is shown as ammonium acetate on NZ, not left blank', () => {
        // The failure this guards against: unsetting the option without
        // normalising leaves $curMeth === 'mlsn' matching nothing, so the
        // select falls back to "— select —" and a later save can write an
        // empty methodology over a real one.
        expect(block).toMatch(/if\s*\(\$curMeth\s*===\s*'mlsn'\)\s*\{[\s\S]*?\$curMeth\s*=\s*'ammonium_acetate'/);
    });

    test('the normalisation happens only inside the NZ branch', () => {
        const nzBranch = block.slice(block.indexOf('if ($isNZ)'));
        const beforeBranch = block.slice(0, block.indexOf('if ($isNZ)'));
        expect(nzBranch).toMatch(/\$curMeth\s*=\s*'ammonium_acetate'/);
        // The only pre-branch assignment of that value is the existing
        // empty-value default, which is guarded by !$curMeth.
        const preAssignments = beforeBranch.match(/\$curMeth\s*=\s*'ammonium_acetate'/g) || [];
        expect(preAssignments.length).toBe(1);
        expect(beforeBranch).toMatch(/if\s*\(!\$curMeth\s*&&\s*\(\$isNewZealand\s*\?\?\s*false\)\)/);
    });

    test('a site whose stored value was normalised is told so, not switched in silence', () => {
        expect(block).toMatch(/\$mlsnNormalised\s*=\s*false/);
        expect(block).toMatch(/\$mlsnNormalised\s*=\s*true/);
        const after = src.slice(blockEnd, blockEnd + 1600);
        expect(after).toMatch(/@if\(\$mlsnNormalised\)/);
        expect(after).toMatch(/saved as MLSN/);
        expect(after).toMatch(/Save to make the stored setting match/);
    });

    test('the field hint tells an NZ user why MLSN is absent rather than silently omitting it', () => {
        const after = src.slice(blockEnd, blockEnd + 1600);
        expect(after).toMatch(/@elseif\(\$isNZ\)/);
        expect(after).toMatch(/New Zealand sites use Ammonium Acetate/);
        expect(after).toMatch(/MLSN is not offered here/);
        // The non-NZ hint must survive for everyone else.
        expect(after).toMatch(/@else/);
        expect(after).toMatch(/MLSN: validated for sand-based greens/);
    });

    test('the fold this gate exists because of is still there, and still lets SLAN through', () => {
        // If getMethodology() ever stops folding, MLSN becomes honourable on NZ
        // and this gate should be reconsidered rather than silently kept. And if
        // it ever stops passing SLAN through, removing SLAN from the list would
        // become correct too — right now it would remove a working option.
        const nz = fs.readFileSync(
            path.join(__dirname, '../assets/nutrition-prebble-integration.js'), 'utf8');
        const fn = nz.slice(nz.indexOf('getMethodology: function'),
            nz.indexOf('getMethodology: function') + 900);
        expect(fn).toMatch(/_hubMeth\s*===\s*'slan'\s*\)\s*return\s*'slan'/);
        expect(fn).toMatch(/return\s*'ammonium_acetate'/);
    });
});

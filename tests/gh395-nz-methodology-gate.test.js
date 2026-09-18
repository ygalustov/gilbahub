/**
 * GH-395 / GH-521 — what Settings offers for a New Zealand site, and what it
 * does with a saved value the region does not allow.
 *
 * WHAT THIS FILE GUARDED BEFORE (GH-395): MLSN was dropped from the list on an
 * NZ site, SLAN was deliberately kept, and a site already saved as 'mlsn' was
 * DISPLAYED as Ammonium Acetate without writing anything.
 *
 * The reasoning was entirely about a fold. `getMethodology()` in
 * nutrition-prebble-integration.js — which runs only for NZ sites — turned
 * everything except SLAN into ammonium acetate, so product selection ran on AA
 * while the requirement engine read the raw saved value and branched on MLSN
 * thresholds. Same site, two methodologies, nothing on screen showing they
 * disagreed. MLSN was removed because it was the one option that could not be
 * honoured end to end; SLAN was kept because it passed the fold untouched; and
 * an already-saved 'mlsn' was shown as AA because AA was what that site's
 * product selection was already running on.
 *
 * WHAT CHANGED (GH-521), and it takes both halves of that reasoning with it:
 *
 *   1. The fold is gone. `getMethodology()` now reads the methodology as saved,
 *      through the same resolver every other surface uses. So an NZ site saved
 *      as MLSN is no longer computing on AA anywhere — it computes on MLSN, on
 *      both sides. Displaying it as Ammonium Acetate would now be the screen
 *      stating a setting the site does not have. The display swap is therefore
 *      removed, and what is saved is what is shown.
 *   2. The list for New Zealand is Ammonium Acetate ALONE — the owner's
 *      decision of 17.09.2026 — not "all three minus MLSN". SLAN's carve-out
 *      goes with it. It was justified by the fold letting SLAN through, and
 *      there is no fold to let anything through any more.
 *
 * What survives unchanged is the rule underneath: the region narrows the
 * CHOICES, it does not fill in or rewrite the VALUE. GH-520 already removed the
 * pre-branch substitution that put AA into an unset NZ site; GH-521 removes the
 * remaining swap of a set one. A saved value the region does not offer is named
 * on screen, as itself, and nothing is written until the user saves.
 *
 * Structural pins on the blade, matching this repo's convention for view-layer
 * assertions (gh312 / gh319). The NZ live check is
 * tests/e2e/gh395-nz-methodology-gate-live.test.js.
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
const after = src.slice(blockEnd, blockEnd + 2400);

describe('GH-395/521 — the NZ methodology gate narrows the choices, not the value', () => {
    test('the option list still offers all three methodologies by default', () => {
        expect(blockStart).toBeGreaterThan(-1);
        expect(block).toMatch(/'mlsn'\s*=>/);
        expect(block).toMatch(/'slan'\s*=>/);
        expect(block).toMatch(/'ammonium_acetate'\s*=>/);
    });

    test('on a New Zealand site the list is Ammonium Acetate alone', () => {
        // Was: unset($methOptions['mlsn']) — everything except MLSN, SLAN kept.
        // Now: an intersection down to the single allowed key, so a methodology
        // added to the default list later does not silently become an NZ option.
        expect(block).toMatch(/\$isNZ\s*=\s*\(\$isNewZealand\s*\?\?\s*false\)/);
        const nzBranch = block.slice(block.indexOf('if ($isNZ)'));
        expect(nzBranch).toMatch(/array_intersect_key\(\s*\$methOptions,\s*\[\s*'ammonium_acetate'\s*=>\s*true\s*\]\s*\)/);
        expect(nzBranch).not.toMatch(/unset\(\$methOptions\['mlsn'\]\)/);
    });

    test('a saved value the region does not offer is flagged, not swapped', () => {
        // The assertion this replaces required the opposite:
        //   if ($curMeth === 'mlsn') { $curMeth = 'ammonium_acetate'; }
        // That was right while the client folded MLSN into AA — the box then
        // showed what the site actually computed on. With the fold gone it would
        // show a setting the site does not have.
        const nzBranch = block.slice(block.indexOf('if ($isNZ)'));
        expect(nzBranch).toMatch(/\$methConflict\s*=\s*\$curMeth/);
        expect(block).not.toMatch(/\$curMeth\s*=\s*'ammonium_acetate'/);
    });

    test('the flag is raised for a set-but-disallowed value, and not for an unset one', () => {
        // An empty setting is not a conflict. $turfVal returns '' when nothing is
        // saved, so the emptiness must be tested before the value is judged, or
        // every unset NZ site is told it has a problem it does not have.
        const nzBranch = block.slice(block.indexOf('if ($isNZ)'));
        expect(nzBranch).toMatch(/\$curMeth\s*!==\s*''\s*&&\s*\$curMeth\s*!==\s*'ammonium_acetate'/);
    });

    test('nothing fills in a value for a site that has not chosen one', () => {
        // GH-520's rule, and this file's oldest surviving assertion: the region
        // narrows the choices, it does not answer for the user. Kept because it
        // is the half of the gate that did NOT change.
        const beforeBranch = block.slice(0, block.indexOf('if ($isNZ)'));
        expect((beforeBranch.match(/\$curMeth\s*=\s*'ammonium_acetate'/g) || []).length).toBe(0);
        expect(beforeBranch).not.toMatch(/if\s*\(!\$curMeth\s*&&\s*\(\$isNewZealand\s*\?\?\s*false\)\)/);
        expect(beforeBranch).not.toMatch(/methodology_override/);
        expect(beforeBranch).toMatch(/\$curMeth\s*=\s*\$turfVal\('methodology'\);/);
    });

    test('the conflict note names the saved value and says the site still computes on it', () => {
        expect(after).toMatch(/@if\(\$methConflict\)/);
        expect(after).toMatch(/\$methConflict/);
        expect(after).toMatch(/still computes on/);
        // and it does not claim anything has been changed. Matched against the
        // rendered paragraphs only: the blade comment above the block names the
        // removed note on purpose, to say what it was and why it went.
        const rendered = after.replace(/\{\{--[\s\S]*?--\}\}/g, '').replace(/^\s*\/\/.*$/gm, '');
        expect(rendered).not.toMatch(/Ammonium Acetate is shown/);
        expect(rendered).not.toMatch(/Save to make the stored setting match/);
        expect(rendered).not.toMatch(/saved as MLSN/);
    });

    test('the dead "shown as AA" hint is gone, and the NZ hint no longer offers SLAN', () => {
        expect(after).not.toMatch(/\$mlsnNormalised/);
        expect(src).not.toMatch(/\$mlsnNormalised/);
        expect(after).toMatch(/@if\(\$isNZ\)/);
        expect(after).toMatch(/New Zealand sites use Ammonium Acetate/);
        expect(after).not.toMatch(/Ammonium Acetate \(Hill Labs\) or SLAN/);
        // The non-NZ hint must survive for everyone else.
        expect(after).toMatch(/@else/);
        expect(after).toMatch(/MLSN: validated for sand-based greens/);
    });

    test('the fold this gate was originally justified by is gone, on both surfaces', () => {
        // This test used to assert the fold was STILL THERE, on the grounds that
        // if it ever stopped folding, MLSN would become honourable on NZ and the
        // gate should be reconsidered rather than silently kept. It has stopped
        // folding. The gate was reconsidered — it stays, on the owner's decision
        // rather than on the fold — and the assertion is inverted so that a fold
        // reintroduced anywhere brings this file down instead of passing quietly.
        const nz = fs.readFileSync(
            path.join(__dirname, '../assets/nutrition-prebble-integration.js'), 'utf8');
        const idx = nz.indexOf('getMethodology: function');
        expect(idx).toBeGreaterThan(-1);
        const fn = nz.slice(idx, nz.indexOf('\n        },', idx));
        expect(fn).not.toMatch(/_hubMeth\s*===\s*'slan'\s*\)\s*return\s*'slan'/);
        expect(fn).not.toMatch(/return\s*'ammonium_acetate'\s*;/);
        expect(fn).toMatch(/resolveExportInputs/);
    });
});

/**
 * GH-407 / GH-521 — what the setup wizards offer for a New Zealand location,
 * and what they do with a choice the location has taken away.
 *
 * WHAT THIS FILE GUARDED BEFORE (GH-407): the wizard's methodology step matched
 * Settings — MLSN removed for NZ, SLAN and Ammonium Acetate kept — and a
 * selection of MLSN made before the location was set to NZ was REWRITTEN to
 * ammonium_acetate, with a note saying so. The wizard is where a site is first
 * configured, so leaving MLSN one click away there undid GH-395 at the point
 * that matters most.
 *
 * WHAT CHANGED (GH-521), two things, and the second is the one with teeth:
 *
 *   1. The NZ list is Ammonium Acetate ALONE, not "all three minus MLSN". The
 *      owner's decision of 17.09.2026. SLAN goes with MLSN: its carve-out was
 *      justified by a fold in nutrition-prebble-integration.js that passed SLAN
 *      through untouched, and that fold no longer exists.
 *
 *   2. A choice the location disallows is CLEARED, not rewritten. The old line
 *      turned a saved 'mlsn' straight into 'ammonium_acetate' — a value the
 *      user never picked, entered on their behalf and then persisted by the
 *      next save. The step now clears it and pre-selects the single remaining
 *      option, which is a wizard suggesting a starting value (what a wizard
 *      step is for) rather than a wizard overwriting a decision.
 *
 * And a defect found while making that change, recorded here so the assertion
 * for it is not mistaken for decoration: the note read "MLSN is not offered for
 * New Zealand locations…". That was true while MLSN was the only thing removed.
 * Once the list narrowed to ammonium acetate alone, a user who had chosen SLAN
 * was cleared and then told about MLSN. The flag `_mlsnNormalisedForNZ` is
 * therefore replaced by `_methodClearedForNZ`, which holds the value that was
 * taken away, and the note names it.
 *
 * Two wizards carry this step. onboarding-wizard.js is the one the new hub
 * shows (loaded by dashboard.blade.php) and the one the defect was reported
 * against; site-setup-wizard.js is an older twin reached only from /hub and the
 * report pages. The first GH-407 fix went to the twin alone and the reporter
 * still saw MLSN, so both are asserted here and neither may drift.
 */

'use strict';

const fs = require('fs');
const path = require('path');

const onboarding = fs.readFileSync(path.join(__dirname, '../assets/onboarding-wizard.js'), 'utf8');
const src = fs.readFileSync(path.join(__dirname, '../assets/site-setup-wizard.js'), 'utf8');
const settings = fs.readFileSync(
    path.join(__dirname, '../app/resources/views/settings.blade.php'), 'utf8');

describe('GH-407/521 — the wizards offer Ammonium Acetate alone for NZ, and clear rather than rewrite', () => {
    describe('site-setup-wizard.js — the twin on /hub and the report pages', () => {
        test('everything but ammonium acetate is removed when the location is New Zealand', () => {
            // Was: splice out the one entry whose id === 'mlsn'. Now: keep the one
            // whose id IS ammonium_acetate, so a methodology added to the list
            // later does not quietly become an NZ option.
            expect(src).toMatch(/if \(methods\[_i\]\.id !== 'ammonium_acetate'\) methods\.splice\(_i, 1\)/);
            expect(src).not.toMatch(/if \(methods\[_i\]\.id === 'mlsn'\) methods\.splice\(_i, 1\)/);
        });

        test('the filter is gated on the NZ check the step already made', () => {
            const at = src.indexOf('const _beforeCount = methods.length;');
            expect(at).toBeGreaterThan(-1);
            expect(src.slice(Math.max(0, at - 400), at)).toMatch(/if \(isNZ\) \{/);
        });

        test('a disallowed selection is cleared, not rewritten to ammonium acetate', () => {
            // This is the assertion that reversed. It used to REQUIRE
            //   if (this.data.methodology === 'mlsn') this.data.methodology = 'ammonium_acetate';
            expect(src).toMatch(/if \(this\.data\.methodology && this\.data\.methodology !== 'ammonium_acetate'\) \{/);
            expect(src).toMatch(/this\.data\.methodology = null;/);
            expect(src).not.toMatch(/if \(this\.data\.methodology === 'mlsn'\) \{\s*\n\s*this\.data\.methodology = 'ammonium_acetate';/);
        });

        test('the clearing is announced, and the note names the value that was taken away', () => {
            expect(src).toMatch(/this\._methodClearedForNZ = this\.data\.methodology;/);
            const at = src.indexOf('if (this._methodClearedForNZ) {');
            expect(at).toBeGreaterThan(-1);
            const note = src.slice(at, at + 700);
            expect(note).toMatch(/_clearedLabel/);
            expect(note).toMatch(/is not offered for New Zealand locations/);
            expect(note).toMatch(/has been cleared/);
            // The old wording named MLSN whatever had actually been cleared.
            expect(src).not.toMatch(/'MLSN is not offered for New Zealand locations and the methodology '/);
            expect(src).not.toMatch(/this\._mlsnNormalisedForNZ\s*=/);
        });

        test('the flags reset when the location is not NZ, so no stale notice survives a back-and-forth', () => {
            expect(src).toMatch(/if \(!isNZ\) \{ this\._mlsnHiddenForNZ = false; this\._methodClearedForNZ = null; \}/);
        });

        test('the flag is kept off this.data, which is the persisted object', () => {
            expect(src).not.toMatch(/this\.data\._mlsnHiddenForNZ/);
            expect(src).not.toMatch(/this\.data\._methodClearedForNZ/);
        });

        test('the step pre-selects the single remaining option only when nothing is set', () => {
            // Suggesting a starting value into an EMPTY field is what a wizard
            // step does. Doing it over a value the user already chose is the
            // substitution this delivery removed, so the guard is on the
            // emptiness test, not on the assignment.
            const at = src.indexOf("if (!this.data.methodology) {");
            expect(at).toBeGreaterThan(-1);
            expect(src.slice(at, at + 220)).toMatch(/isNZ[\s\S]{0,80}this\.data\.methodology = 'ammonium_acetate'/);
        });

        test('MLSN and SLAN survive for everyone else — this is an NZ rule, not a removal', () => {
            expect(src).toMatch(/id: 'mlsn',/);
            expect(src).toMatch(/id: 'slan'/);
            expect(src).toMatch(/this\.data\.methodology = 'mlsn';/);   // the golf-greens auto-suggest
        });
    });

    describe('onboarding-wizard.js — the one a user actually meets', () => {
        test('everything but ammonium acetate is removed for NZ here too', () => {
            expect(onboarding).toMatch(/if \(methods\[_i\]\.id !== 'ammonium_acetate'\) methods\.splice\(_i, 1\)/);
            expect(onboarding).not.toMatch(/if \(methods\[_i\]\.id === 'mlsn'\) methods\.splice\(_i, 1\)/);
        });

        test('a preset non-AA choice is cleared and remembered, not rewritten', () => {
            expect(onboarding).toMatch(/if \(this\.d\.methodology && this\.d\.methodology !== 'ammonium_acetate'\) \{/);
            expect(onboarding).toMatch(/this\._methodClearedForNZ = this\.d\.methodology;\s*\n\s*this\.d\.methodology = null;/);
            expect(onboarding).not.toMatch(/this\.d\.methodology = 'ammonium_acetate';\s*\n\s*this\._mlsnNormalisedForNZ = true;/);
        });

        test('the note names the cleared value rather than always saying MLSN', () => {
            expect(onboarding).toMatch(/_METHOD_LABELS: \{ mlsn: 'MLSN', slan: 'SLAN', ammonium_acetate: 'Ammonium Acetate' \}/);
            const at = onboarding.indexOf('if (this._methodClearedForNZ) {');
            expect(at).toBeGreaterThan(-1);
            const note = onboarding.slice(at, at + 600);
            expect(note).toMatch(/this\._METHOD_LABELS\[this\._methodClearedForNZ\]/);
            expect(note).toMatch(/is not offered for New Zealand locations/);
            expect(note).toMatch(/has been cleared/);
            expect(onboarding).not.toMatch(/this\._mlsnNormalisedForNZ/);
        });

        test('the flag resets when the location is not NZ', () => {
            expect(onboarding).toMatch(/\} else \{\s*\n\s*this\._methodClearedForNZ = null;\s*\n\s*\}/);
        });

        test('the single remaining option is pre-selected only into an empty value', () => {
            const at = onboarding.indexOf('if (!this.d.methodology) {\n                    this.d.methodology = \'ammonium_acetate\';');
            expect(at).toBeGreaterThan(-1);
        });

        test('the grid is two columns either way, so no gap is left where MLSN was', () => {
            expect(onboarding).not.toMatch(/isNZ \? '1fr 1fr 1fr' : '1fr 1fr'/);
            expect(src).not.toMatch(/isNZ \? '1fr 1fr 1fr' : '1fr 1fr'/);
        });

        test('this file is the one the dashboard loads', () => {
            const view = fs.readFileSync(
                path.join(__dirname, '../app/resources/views/dashboard.blade.php'), 'utf8');
            expect(view).toMatch(/onboarding-wizard\.js/);
        });

        test('MLSN survives for everyone else here too', () => {
            expect(onboarding).toMatch(/\{ id: 'mlsn',/);
        });
    });

    test('Settings narrows to the same single option, so the two surfaces agree', () => {
        // The point of this assertion has always been that the wizard and
        // Settings cannot drift. What they have to agree ON is what changed:
        // one option for NZ, and no rewriting of a stored value.
        expect(settings).toMatch(/array_intersect_key\(\s*\$methOptions,\s*\[\s*'ammonium_acetate'\s*=>\s*true\s*\]\s*\)/);
        expect(settings).toMatch(/\$methConflict\s*=\s*\$curMeth/);
        expect(settings).not.toMatch(/unset\(\$methOptions\['mlsn'\]\)/);
        expect(settings).not.toMatch(/\$curMeth\s*=\s*'ammonium_acetate'/);
    });
});

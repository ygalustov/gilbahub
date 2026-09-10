/**
 * GH-407 — the setup wizard does not offer MLSN for a New Zealand location.
 *
 * GH-395 removed MLSN from the methodology dropdown in Settings for NZ sites.
 * The setup wizard has its own methodology step and was never changed, so a new
 * NZ site could still be created on MLSN — which is the more likely route,
 * since the wizard is where a site is first configured.
 *
 * The wizard already knew: at step 2 it adds Ammonium Acetate to the list
 * *because* the location is NZ, auto-selects it, and prints a note underneath if
 * you choose something else. It just never took MLSN off the list, so it stayed
 * one click away and the note was all that stood between a new NZ site and a
 * methodology whose thresholds are not defined against the numbers NZ labs
 * report (Olsen P, ammonium-acetate extractions).
 *
 * Reported from the UI: NZ coordinates chosen at step 1, MLSN still selectable
 * at step 2.
 */

'use strict';

const fs = require('fs');
const path = require('path');

// Two wizards carry this step. onboarding-wizard.js is the one the new hub
// shows (loaded by dashboard.blade.php) and the one the defect was reported
// against; site-setup-wizard.js is an older twin reached only from /hub and the
// report pages. The first fix went to the twin alone and the reporter still saw
// MLSN, so both are asserted here and neither may drift.
const onboarding = fs.readFileSync(path.join(__dirname, '../assets/onboarding-wizard.js'), 'utf8');
const src = fs.readFileSync(path.join(__dirname, '../assets/site-setup-wizard.js'), 'utf8');
const settings = fs.readFileSync(
    path.join(__dirname, '../app/resources/views/settings.blade.php'), 'utf8');

describe('GH-407 — MLSN is removed from the wizard for NZ', () => {
    test('the list is filtered when the location is New Zealand', () => {
        expect(src).toMatch(/if \(methods\[_i\]\.id === 'mlsn'\) methods\.splice\(_i, 1\)/);
    });

    test('the filter is gated on the NZ check the step already made', () => {
        const at = src.indexOf("GH-407: and take MLSN away");
        expect(at).toBeGreaterThan(-1);
        const block = src.slice(at, at + 1800);
        expect(block).toMatch(/if \(isNZ\) \{/);
    });

    test('a selection of MLSN made before the location was NZ is normalised, not left dangling', () => {
        expect(src).toMatch(/if \(this\.data\.methodology === 'mlsn'\) \{\s*\n\s*this\.data\.methodology = 'ammonium_acetate';/);
    });

    test('the normalisation is announced rather than silent', () => {
        expect(src).toMatch(/this\._mlsnNormalisedForNZ = true/);
        const at = src.indexOf('this._mlsnNormalisedForNZ) {');
        expect(at).toBeGreaterThan(-1);
        expect(src.slice(at, at + 500)).toMatch(/MLSN is not offered for New Zealand locations/);
    });

    test('the flags reset when the location is not NZ, so no stale notice survives a back-and-forth', () => {
        expect(src).toMatch(/if \(!isNZ\) \{ this\._mlsnHiddenForNZ = false; this\._mlsnNormalisedForNZ = false; \}/);
    });

    test('the flag is kept off this.data, which is the persisted object', () => {
        expect(src).not.toMatch(/this\.data\._mlsnHiddenForNZ/);
        expect(src).not.toMatch(/this\.data\._mlsnNormalisedForNZ/);
    });

    test('Ammonium Acetate is still added for NZ, and SLAN still offered', () => {
        expect(src).toMatch(/id: 'ammonium_acetate'/);
        expect(src).toMatch(/id: 'slan'/);
    });

    test('MLSN survives for everyone else — this is an NZ rule, not a removal', () => {
        expect(src).toMatch(/id: 'mlsn',/);
        expect(src).toMatch(/this\.data\.methodology = 'mlsn';/);   // the golf-greens auto-suggest
    });

    test('Settings still does the same thing, so the two surfaces agree', () => {
        expect(settings).toMatch(/unset\(\$methOptions\['mlsn'\]\)/);
        expect(settings).toMatch(/\$curMeth = 'ammonium_acetate'/);
    });

    describe('the dashboard wizard — the one a user actually meets', () => {
        test('MLSN is spliced out for NZ here too', () => {
            expect(onboarding).toMatch(/if \(methods\[_i\]\.id === 'mlsn'\) methods\.splice\(_i, 1\)/);
        });

        test('a preset MLSN is normalised and announced', () => {
            expect(onboarding).toMatch(/this\.d\.methodology = 'ammonium_acetate';\s*\n\s*this\._mlsnNormalisedForNZ = true;/);
            expect(onboarding).toMatch(/MLSN is not offered for New Zealand locations/);
        });

        test('the flag resets when the location is not NZ', () => {
            expect(onboarding).toMatch(/\} else \{\s*\n\s*this\._mlsnNormalisedForNZ = false;\s*\n\s*\}/);
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
});

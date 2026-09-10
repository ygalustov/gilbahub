/**
 * GH-310 — old hub (pre-GH-306) rendered the raw percentage next to the
 * status icon (`pct = required > 0 ? ... : 0`, displayed as `✓ 117%`), so an
 * over-delivery's magnitude was visible at a glance. GH-306's rewrite to
 * text badges ('On Track'/'Monitor'/'Deficit') dropped that number — 91%
 * and 2000% both just read "On Track", with no way to tell a marginal pass
 * from a huge oversupply.
 *
 * FIX: append the percentage to the status label for the required > 0
 * branch, in both nutrition-prebble-integration.js (NZ) and
 * nutrition-au-fertiliser-integration.js (AU) — e.g. "On Track (117%)".
 * Not applied to the required === 0 ("Met") branch, since delivered/required
 * is undefined there (no legacy percentage to restore). UK module
 * (nutrition-uk-fertiliser-integration.js) already showed the percentage
 * (icon+% format) and needed no change.
 *
 * GH-312 UPDATE: this pct-based branch (with its percentage suffix) is now
 * the graceful-degradation fallback inside classifyBalance(), used when
 * soil/range/removal data isn't available. Retargeted the extraction window
 * accordingly -- see gh306-...test.js's GH-312 update note for why.
 */

'use strict';

const fs = require('fs');
const path = require('path');

function extractBlock(src, startMarker, maxLen) {
    const idx = src.indexOf(startMarker);
    expect(idx).toBeGreaterThan(-1);
    return src.slice(idx, idx + maxLen);
}

describe('GH-310 — nutrition-prebble-integration.js (NZ) status label includes percentage', () => {
    const src = fs.readFileSync(path.join(__dirname, '../assets/nutrition-prebble-integration.js'), 'utf8');
    const block = extractBlock(
        // GH-396: the classifier moved to assets/nutrient-balance-status.js,
        // shared by this integration, its AU/NZ twin and the Word export's
        // Annual Nutrient Requirements table. Every pin below is unchanged
        // and now reads the one implementation; that each integration still
        // DELEGATES to it is pinned in gh396-report-plan-vocabulary.test.js,
        // so a re-inlined local copy cannot quietly satisfy these.
        fs.readFileSync(path.join(__dirname, '../assets/nutrient-balance-status.js'), 'utf8'),
        'function classify(o) {', 6500);

    test('Monitor/Deficit tiers append a delta-from-target percentage; On Track stays a plain label', () => {
        // GH-333 follow-up: was `(${pct}%)` on every tier including On Track
        // (a completion ratio, e.g. "100%" for exactly-delivered N) --
        // confirmed with the user the number only matters for Monitor/
        // Deficit (how far off target, "+X%/-X%"); On Track goes back to a
        // plain label with no number, same as the range-based branch below.
        expect(block).toMatch(/const deltaPct = pct - 100;/);
        expect(block).toMatch(/const statusLabel = pct >= 90\s*\n\s*\? 'On Track'\s*\n\s*: \(pct >= 70 \? 'Monitor' : 'Deficit'\) \+ ` \(\$\{deltaPct >= 0 \? '\+' : ''\}\$\{deltaPct\}%\)`;/);
    });

    test('required === 0 (Met) branch is untouched -- no percentage appended', () => {
        expect(block).toMatch(/statusClass: 'sufficient', statusLabel: 'On Track'/);
        expect(block).not.toMatch(/statusLabel: 'On Track' \+/);
    });
});

describe('GH-310 — nutrition-au-fertiliser-integration.js (AU) status label includes percentage', () => {
    const src = fs.readFileSync(path.join(__dirname, '../assets/nutrition-au-fertiliser-integration.js'), 'utf8');
    const block = extractBlock(
        // GH-396: the classifier moved to assets/nutrient-balance-status.js,
        // shared by this integration, its AU/NZ twin and the Word export's
        // Annual Nutrient Requirements table. Every pin below is unchanged
        // and now reads the one implementation; that each integration still
        // DELEGATES to it is pinned in gh396-report-plan-vocabulary.test.js,
        // so a re-inlined local copy cannot quietly satisfy these.
        fs.readFileSync(path.join(__dirname, '../assets/nutrient-balance-status.js'), 'utf8'),
        'function classify(o) {', 6500);

    test('Monitor/Deficit tiers append a delta-from-target percentage; On Track stays a plain label', () => {
        // GH-333 follow-up: was `(${pct}%)` on every tier including On Track
        // (a completion ratio, e.g. "100%" for exactly-delivered N) --
        // confirmed with the user the number only matters for Monitor/
        // Deficit (how far off target, "+X%/-X%"); On Track goes back to a
        // plain label with no number, same as the range-based branch below.
        expect(block).toMatch(/const deltaPct = pct - 100;/);
        expect(block).toMatch(/const statusLabel = pct >= 90\s*\n\s*\? 'On Track'\s*\n\s*: \(pct >= 70 \? 'Monitor' : 'Deficit'\) \+ ` \(\$\{deltaPct >= 0 \? '\+' : ''\}\$\{deltaPct\}%\)`;/);
    });

    test('required === 0 (Met) branch is untouched -- no percentage appended', () => {
        expect(block).toMatch(/statusClass: 'sufficient', statusLabel: 'On Track'/);
        expect(block).not.toMatch(/statusLabel: 'On Track' \+/);
    });
});

describe('GH-310 — nutrition-uk-fertiliser-integration.js (UK) needed no change', () => {
    const src = fs.readFileSync(path.join(__dirname, '../assets/nutrition-uk-fertiliser-integration.js'), 'utf8');
    const block = extractBlock(src, "var nutrientSummaryRows = ['N', 'P', 'K'].map(function(nutrient) {", 1700);

    test('already shows icon + percentage for the required > 0 branch, unchanged', () => {
        expect(block).toMatch(/statusText = statusIcon \+ ' ' \+ pct \+ '%';/);
    });
});

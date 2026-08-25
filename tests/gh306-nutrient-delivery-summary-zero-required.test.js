/**
 * GH-306 — "Nutrient Delivery Summary" table showed "Deficit" for a nutrient
 * with Required=0, Delivered=0, Balance=+0.0.
 *
 * Found live, directly downstream of the GH-299/300/303/305 AA-ceiling chain:
 * once Annual Requirement could legitimately be exactly 0 (soil already
 * at/above the AA sufficiency ceiling -- certificate or generic, GH-305),
 * this table's status classifier broke. `pct = required > 0 ? ... : 0`
 * forced `required === 0` straight into `pct = 0`, and `0 < 70%` always
 * classified as the worst bucket ("Deficit" / uk-fert-negative "✗ 0%") --
 * even though 0 required + 0 delivered is a perfectly satisfied state, not a
 * shortfall. This bug pre-dates the AA work (reachable for any MLSN/SLAN
 * nutrient already at/above target too), but was effectively invisible until
 * AA's Required could also legitimately land on exactly 0.
 *
 * FIX: required === 0 is now a distinct, explicit branch (not routed through
 * the percentage calculation at all) -- "Met" / uk-fert-positive "✓ Met",
 * regardless of delivered. The percentage-based classification for
 * required > 0 is completely unchanged.
 *
 * Duplicated (byte-identical structure) across 3 independent regional
 * modules -- nutrition-prebble-integration.js (NZ, also used by
 * nutrition-nz-fertiliser-integration.js, which delegates rendering to it),
 * nutrition-au-fertiliser-integration.js (AU), nutrition-uk-fertiliser-
 * integration.js (UK, different display format: icon+% instead of a text
 * label) -- all three needed the same fix.
 *
 * Structural pins only (regex against the source), matching this repo's
 * established convention for large DOM-generating files that can't easily be
 * isolated/required in a test sandbox (see word-export.js's GH-290/291/292
 * coverage as precedent).
 */

'use strict';

const fs = require('fs');
const path = require('path');

function extractBlock(src, startMarker, maxLen) {
    const idx = src.indexOf(startMarker);
    expect(idx).toBeGreaterThan(-1);
    return src.slice(idx, idx + maxLen);
}

describe('GH-306 — nutrition-prebble-integration.js (NZ)', () => {
    const src = fs.readFileSync(path.join(__dirname, '../assets/nutrition-prebble-integration.js'), 'utf8');
    // GH-310 widened this window (1600->2200): appending the percentage to
    // the status label added an explanatory comment ahead of the branch.
    const block = extractBlock(src, "const nutrientSummaryRows = ['N', 'P', 'K'].map(nutrient => {", 2700);

    test('required === 0 is a distinct branch, not routed through the percentage calc', () => {
        expect(block).toMatch(/if \(required === 0\) \{/);
        expect(block).toMatch(/statusClass = 'sufficient';/);
        expect(block).toMatch(/statusLabel = 'Met';/);
    });

    test('the old unconditional "pct = required > 0 ? ... : 0" fallback pattern is gone', () => {
        expect(block).not.toMatch(/const pct = required > 0 \? Math\.round/);
    });

    test('regression: percentage-based classification for required > 0 is unchanged', () => {
        expect(block).toMatch(/const pct = Math\.round\(\(delivered \/ required\) \* 100\);/);
        expect(block).toMatch(/pct >= 90 \? 'sufficient' : pct >= 70 \? 'marginal' : 'deficit'/);
        expect(block).toMatch(/pct >= 90 \? 'On Track' : pct >= 70 \? 'Monitor' : 'Deficit'/);
    });
});

describe('GH-306 — nutrition-au-fertiliser-integration.js (AU)', () => {
    const src = fs.readFileSync(path.join(__dirname, '../assets/nutrition-au-fertiliser-integration.js'), 'utf8');
    // GH-310 widened this window (1600->2200), same reason as the NZ block above.
    const block = extractBlock(src, "const nutrientSummaryRows = ['N', 'P', 'K'].map(nutrient => {", 2700);

    test('required === 0 is a distinct branch, not routed through the percentage calc', () => {
        expect(block).toMatch(/if \(required === 0\) \{/);
        expect(block).toMatch(/statusClass = 'sufficient';/);
        expect(block).toMatch(/statusLabel = 'Met';/);
    });

    test('the old unconditional "pct = required > 0 ? ... : 0" fallback pattern is gone', () => {
        expect(block).not.toMatch(/const pct = required > 0 \? Math\.round/);
    });

    test('regression: percentage-based classification for required > 0 is unchanged', () => {
        expect(block).toMatch(/const pct = Math\.round\(\(delivered \/ required\) \* 100\);/);
        expect(block).toMatch(/pct >= 90 \? 'sufficient' : pct >= 70 \? 'marginal' : 'deficit'/);
    });
});

describe('GH-306 — nutrition-uk-fertiliser-integration.js (UK, icon+% format)', () => {
    const src = fs.readFileSync(path.join(__dirname, '../assets/nutrition-uk-fertiliser-integration.js'), 'utf8');
    const block = extractBlock(src, "var nutrientSummaryRows = ['N', 'P', 'K'].map(function(nutrient) {", 1700);

    test('required === 0 is a distinct branch -- positive class, "Met" text, no percentage shown', () => {
        expect(block).toMatch(/if \(required === 0\) \{/);
        expect(block).toMatch(/statusCls = 'uk-fert-positive';/);
        expect(block).toMatch(/statusText = '\\u2713 Met';/);
    });

    test('the old unconditional "pct = required > 0 ? ... : 0" fallback pattern is gone', () => {
        expect(block).not.toMatch(/var pct = required > 0 \? Math\.round/);
    });

    test('regression: percentage-based classification for required > 0 is unchanged', () => {
        expect(block).toMatch(/var pct = Math\.round\(\(delivered \/ required\) \* 100\);/);
        expect(block).toMatch(/pct >= 90 \? 'uk-fert-positive' : pct >= 70 \? 'uk-fert-warning' : 'uk-fert-negative'/);
    });
});

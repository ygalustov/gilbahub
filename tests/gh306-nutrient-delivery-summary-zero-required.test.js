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
 * GH-312 UPDATE: in nutrition-prebble-integration.js and
 * nutrition-au-fertiliser-integration.js, this required===0/pct-based logic
 * was moved into a classifyBalance() helper function as the graceful-
 * degradation fallback (used when soil/range/removal data isn't available --
 * MLSN/SLAN sites, or uncovered AA species/texture). The primary path for
 * AA sites with resolvable data now uses a different, unified Low/Met/Excess
 * model (see gh312-unified-nutrient-balance-status.test.js) -- but this
 * fallback branch is verified here to still behave exactly as GH-306 fixed
 * it. nutrition-uk-fertiliser-integration.js is untouched by GH-311/312
 * (different display format, no Current/Removal/Lift columns).
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
    // GH-312 retargeted this window to classifyBalance() -- the required===0/
    // pct-based logic GH-306 fixed now lives in that function's fallback
    // branch, not inline in the row-map callback.
    const block = extractBlock(
        // GH-396: the classifier moved to assets/nutrient-balance-status.js,
        // shared by this integration, its AU/NZ twin and the Word export's
        // Annual Nutrient Requirements table. Every pin below is unchanged
        // and now reads the one implementation; that each integration still
        // DELEGATES to it is pinned in gh396-report-plan-vocabulary.test.js,
        // so a re-inlined local copy cannot quietly satisfy these.
        fs.readFileSync(path.join(__dirname, '../assets/nutrient-balance-status.js'), 'utf8'),
        'function classify(o) {', 6500);

    test('required === 0 is a distinct branch, not routed through the percentage calc', () => {
        expect(block).toMatch(/if \(required === 0\) \{/);
        expect(block).toMatch(/statusClass: 'sufficient', statusLabel: 'On Track'/);
    });

    test('the old unconditional "pct = required > 0 ? ... : 0" fallback pattern is gone', () => {
        expect(block).not.toMatch(/const pct = required > 0 \? Math\.round/);
    });

    test('regression: percentage-based classification for required > 0 is unchanged (statusClass tiers; label wording moved under GH-333)', () => {
        expect(block).toMatch(/const pct = Math\.round\(\(delivered \/ required\) \* 100\);/);
        expect(block).toMatch(/pct >= 90 \? 'sufficient' : pct >= 70 \? 'marginal' : 'deficit'/);
        // GH-333 follow-up: statusLabel wording is now `pct >= 90 ? 'On Track' : (pct >= 70 ? 'Monitor' : 'Deficit') + ...`
        expect(block).toMatch(/const statusLabel = pct >= 90/);
        expect(block).toMatch(/\? 'On Track'/);
        expect(block).toMatch(/: \(pct >= 70 \? 'Monitor' : 'Deficit'\)/);
    });
});

describe('GH-306 — nutrition-au-fertiliser-integration.js (AU)', () => {
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

    test('required === 0 is a distinct branch, not routed through the percentage calc', () => {
        expect(block).toMatch(/if \(required === 0\) \{/);
        expect(block).toMatch(/statusClass: 'sufficient', statusLabel: 'On Track'/);
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

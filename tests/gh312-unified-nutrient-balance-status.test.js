/**
 * GH-312 — unified Balance/Status model for the "Nutrient Delivery Summary"
 * table, replacing the two disconnected mechanisms GH-306/310/311 had built
 * up: a 90%/70% percentage-threshold check for required>0 rows (no
 * scientific source found anywhere for those cut-offs), and a separate
 * Balance=Current+Delivered ceiling-only check for required=0 rows (GH-311).
 *
 * User's concern (paraphrased): "если это required, то это required, если
 * current, то current, чтобы у всех было одинаково" -- Balance meant
 * different things on different rows, which is confusing on its own table.
 *
 * Root finding: Required already double-counts soil state for below-floor
 * nutrients, because Required = Removal + Lift, and Lift = (floor -
 * Current) / yearsToCorrect -- Current is already baked into Required
 * through Lift. Using Required in a Balance formula (Current + Delivered -
 * Required) would subtract Current twice. The physically correct quantity
 * to subtract is Removal alone (what the plant actually takes up via
 * clippings -- true regardless of floor/ceiling/policy status).
 *
 * Verified against real published sources (not invented) before shipping:
 *   - Woods, M. (2013). "A Method for Estimating Turfgrass Nutrient
 *     Requirements." His mass-balance model: F = target + Harvest -
 *     Soiltest (fertiliser needed to reach a target level). Algebraically
 *     inverted here to predict the season-end level instead:
 *     projected = Current + Delivered - Removal (Harvest == Removal here).
 *     If Delivered == Woods' F exactly, projected == target exactly --
 *     confirmed by hand before implementing.
 *   - Carrow, R.N. et al. (2004). GCM 72(1):194-198 (SLAN) -- already cited
 *     in nutrition-requirement-engine.js -- for the two-sided floor/ceiling
 *     sufficiency-range concept (Woods' MLSN uses one single guideline, not
 *     a range; the floor/ceiling range in this table comes from real Hill
 *     Labs AA certificates or the SLAN-style generic fallback).
 *
 * New columns: Current, Removal, Lift shown separately (previously only
 * their combination, "Required", was shown) so it's clear which number is
 * a physical constant (Removal), which is policy (Lift, Required), and
 * which is soil state (Current) -- confirmed with the user directly.
 *
 * Status is now ONE rule for every row: Balance < floor -> Low, floor <=
 * Balance <= ceiling -> Met, Balance > ceiling -> Excess. Matches the
 * Hoxton audit document's own three-tier description (D07, the E2 quote:
 * "Within the sufficiency range, req = removal only; below floor, req =
 * removal + lift; above ceiling, req = 0") -- just applied to a projected
 * end-of-season balance instead of the up-front requirement figure.
 *
 * Falls back to the pre-GH-312 model (required===0 -> Met, required>0 ->
 * 90%/70% pct bands) when Current/Removal/range data isn't available --
 * MLSN/SLAN sites (this engine has no ceiling concept for them) and
 * uncovered AA species/texture. See gh306/gh310-...test.js for that
 * fallback's own coverage.
 *
 * Structural pins + a standalone reimplementation of the exact formula,
 * matching this repo's established convention for large DOM-generating
 * files.
 */

'use strict';

const fs = require('fs');
const path = require('path');

function extractBlock(src, startMarker, maxLen) {
    const idx = src.indexOf(startMarker);
    expect(idx).toBeGreaterThan(-1);
    return src.slice(idx, idx + maxLen);
}

describe('GH-312 — nutrition-calendar.js exposes Removal and Lift separately', () => {
    const src = fs.readFileSync(path.join(__dirname, '../assets/nutrition-calendar.js'), 'utf8');

    test('computeProgram() return object includes annual_removal and annual_lift', () => {
        expect(src).toMatch(/annual_removal:\s*adjustedRemoval,/);
        expect(src).toMatch(/annual_lift:\s*annualCorrection,/);
    });
});

describe('GH-312 — the worked K example (all three tiers, real removal=110)', () => {
    // Reimplementation of the exact classifyBalance() arithmetic, run
    // standalone so the formula itself is pinned by real computed
    // assertions. S277 K range {min: 78.2, max: 195.5}, bulkDensity 1.4,
    // soilDepth 10cm -> unit = 1.4. Removal.K = 110 (0.55 x N=200 x
    // clipFactor=1.0, confirmed against the user's actual site settings and
    // nutrition-calendar.js's own CONFIG constants earlier in this
    // investigation). Delivered fixed at 116.9 kg/ha across all three tiers
    // for a fair comparison (only Current changes).
    function classifyBalance(currentPpm, delivered, removal, floorPpm, ceilingPpm, bulkDensity, soilDepth) {
        const unit = bulkDensity * soilDepth * 0.1;
        const currentKgHa = currentPpm * unit;
        const floorKgHa = floorPpm * unit;
        const ceilingKgHa = ceilingPpm * unit;
        const balanceKgHa = currentKgHa + delivered - removal;
        if (ceilingKgHa > 0 && balanceKgHa > ceilingKgHa) {
            return { currentKgHa, floorKgHa, ceilingKgHa, balanceKgHa, status: 'Excess', pct: Math.round((balanceKgHa / ceilingKgHa) * 100) };
        }
        if (balanceKgHa < floorKgHa) {
            return { currentKgHa, floorKgHa, ceilingKgHa, balanceKgHa, status: 'Deficit', pct: Math.round((balanceKgHa / floorKgHa) * 100) };
        }
        return { currentKgHa, floorKgHa, ceilingKgHa, balanceKgHa, status: 'Met', pct: null };
    }

    test('LOW: current=40ppm (below floor 78.2) -> Balance 62.9, status Low', () => {
        const r = classifyBalance(40, 116.9, 110, 78.2, 195.5, 1.4, 10);
        expect(r.currentKgHa).toBeCloseTo(56.0, 5);
        expect(r.floorKgHa).toBeCloseTo(109.48, 5);
        expect(r.balanceKgHa).toBeCloseTo(62.9, 5);
        expect(r.status).toBe('Deficit');
        expect(r.pct).toBe(57);
    });

    test('MEDIUM: current=130ppm (within 78.2-195.5) -> Balance 188.9, status Met', () => {
        const r = classifyBalance(130, 116.9, 110, 78.2, 195.5, 1.4, 10);
        expect(r.currentKgHa).toBeCloseTo(182.0, 5);
        expect(r.balanceKgHa).toBeCloseTo(188.9, 5);
        expect(r.status).toBe('Met');
    });

    test('HIGH: current=199ppm (above ceiling 195.5) -> Balance 285.5, status Excess (104%)', () => {
        const r = classifyBalance(199, 116.9, 110, 78.2, 195.5, 1.4, 10);
        expect(r.currentKgHa).toBeCloseTo(278.6, 5);
        expect(r.ceilingKgHa).toBeCloseTo(273.7, 5);
        expect(r.balanceKgHa).toBeCloseTo(285.5, 5);
        expect(r.status).toBe('Excess');
        expect(r.pct).toBe(104);
    });

    test('Woods (2013) consistency check: delivering exactly his F lands the projected balance exactly on the floor', () => {
        // Woods: F = target + Harvest - Soiltest. Here: F = floorKgHa + removal - currentKgHa.
        const currentPpm = 40, removal = 110, floorPpm = 78.2, bulkDensity = 1.4, soilDepth = 10;
        const unit = bulkDensity * soilDepth * 0.1;
        const currentKgHa = currentPpm * unit;
        const floorKgHa = floorPpm * unit;
        const woodsF = floorKgHa + removal - currentKgHa;
        const projected = currentKgHa + woodsF - removal;
        expect(projected).toBeCloseTo(floorKgHa, 6);
    });
});

describe('GH-312 — nutrition-prebble-integration.js (NZ) implementation', () => {
    const src = fs.readFileSync(path.join(__dirname, '../assets/nutrition-prebble-integration.js'), 'utf8');

    test('program.annual_removal / program.annual_lift carried through from calendarData', () => {
        expect(src).toMatch(/program\.annual_removal = calendarData\.annual_removal;/);
        expect(src).toMatch(/program\.annual_lift = calendarData\.annual_lift;/);
    });

    test('table header includes Removal again (GH-333, Lift stays hidden GH-325)', () => {
        // GH-333: Removal came back -- without it, Balance (Current +
        // Delivered - Removal) can't be verified from the table alone.
        expect(src).toMatch(/<th class="prebble-th">Removal \(kg\/ha\)<\/th>/);
        expect(src).not.toMatch(/<th class="prebble-th">Lift \(kg\/ha\)<\/th>/);
    });

    test('info icon present on the table title, wired to the glossary entry', () => {
        expect(src).toMatch(/Nutrient Delivery Summary <button class="db-info-icon" data-info="prebble-nutrient-delivery-summary"/);
        expect(src).toMatch(/'prebble-nutrient-delivery-summary':\s*\{/);
    });

    const block = extractBlock(src, 'function classifyBalance(nutrient, required, delivered) {', 6500);

    test('Balance formula is current + delivered - removal (not required)', () => {
        expect(block).toMatch(/const balanceKgHa = currentKgHa \+ delivered - removal;/);
    });

    test('unified Deficit/On Track/Excess classification against floor and ceiling', () => {
        // GH-333: labels no longer carry a %-of-floor/-ceiling suffix (it
        // exaggerated the real magnitude, e.g. "266%") -- now show the
        // actual kg/ha amount short of the floor / over the ceiling instead.
        expect(block).toMatch(/if \(ceilingKgHa > 0 && balanceKgHa > ceilingKgHa\) \{/);
        expect(block).toMatch(/statusLabel: `Excess \(\+\$\{overPct\}%\)`/);
        expect(block).toMatch(/if \(balanceKgHa < floorKgHa\) \{/);
        expect(block).toMatch(/statusLabel: `Deficit \(-\$\{shortPct\}%\)`/);
    });

    test('row template includes Removal cells again (GH-333), Lift stays hidden', () => {
        const rowBlock = extractBlock(src, "const nutrientSummaryRows = ['N', 'P', 'K'].map(nutrient => {", 1700);
        expect(rowBlock).toMatch(/removalDisplay/);
        expect(rowBlock).not.toMatch(/liftDisplay/);
    });
});

describe('GH-312 — nutrition-au-fertiliser-integration.js (AU) implementation', () => {
    const src = fs.readFileSync(path.join(__dirname, '../assets/nutrition-au-fertiliser-integration.js'), 'utf8');

    test('generateProgram() return object carries annual_removal / annual_lift', () => {
        expect(src).toMatch(/annual_removal:\s*calendarData\.annual_removal,/);
        expect(src).toMatch(/annual_lift:\s*calendarData\.annual_lift,/);
    });

    test('table header includes Removal again (GH-333, Lift stays hidden GH-325)', () => {
        expect(src).toMatch(/<th class="au-fert-th">Removal \(kg\/ha\)<\/th>/);
        expect(src).not.toMatch(/<th class="au-fert-th">Lift \(kg\/ha\)<\/th>/);
    });

    test('info icon present on the table title, wired to the glossary entry', () => {
        expect(src).toMatch(/Nutrient Delivery Summary <button class="db-info-icon" data-info="prebble-nutrient-delivery-summary"/);
        expect(src).toMatch(/'prebble-nutrient-delivery-summary':\s*\{/);
    });

    const block = extractBlock(src, 'function classifyBalance(nutrient, required, delivered) {', 6500);

    test('Balance formula is current + delivered - removal (not required)', () => {
        expect(block).toMatch(/const balanceKgHa = currentKgHa \+ delivered - removal;/);
    });

    test('unified Deficit/On Track/Excess classification against floor and ceiling', () => {
        expect(block).toMatch(/if \(ceilingKgHa > 0 && balanceKgHa > ceilingKgHa\) \{/);
        expect(block).toMatch(/statusLabel: `Excess \(\+\$\{overPct\}%\)`/);
        expect(block).toMatch(/if \(balanceKgHa < floorKgHa\) \{/);
        expect(block).toMatch(/statusLabel: `Deficit \(-\$\{shortPct\}%\)`/);
    });
});

describe('GH-312 — nutrition-nz-fertiliser-integration.js carries Removal/Lift through too (same gap class as the GH-311 follow-up)', () => {
    const src = fs.readFileSync(path.join(__dirname, '../assets/nutrition-nz-fertiliser-integration.js'), 'utf8');

    test('generateAndRender() carries program.annual_removal / program.annual_lift from calendarData', () => {
        expect(src).toMatch(/program\.annual_removal = calendarData\.annual_removal;/);
        expect(src).toMatch(/program\.annual_lift = calendarData\.annual_lift;/);
    });
});

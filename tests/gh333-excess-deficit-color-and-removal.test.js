/**
 * GH-333 — user feedback on the Nutrient Delivery Summary table (both
 * nutrition-au-fertiliser-integration.js and nutrition-prebble-integration.js):
 *
 * 1. Excess and Deficit shared one statusClass ('deficit'), so both painted
 *    the same alarming red -- but Deficit is an intentionally gradual,
 *    multi-year correction (Lift spread over yearsToCorrect, GH-308/309),
 *    not an emergency, while Excess (soil already over the ceiling, with
 *    nothing actively correcting it) is a genuinely different situation.
 *    FIX: Excess got its own statusClass ('excess'); a new
 *    statusVisualClass() maps sufficient->positive(green),
 *    excess->negative(red), everything else (deficit, fallback's
 *    marginal)->warning(amber). Badge CSS, diff-cell CSS, row-background
 *    CSS, and the Annual Product Summary tfoot Balance row/cells all follow
 *    this 3-way mapping now instead of a binary sufficient/not-sufficient
 *    check.
 *
 * 2. Balance's leading "+" (e.g. "+207.0") read as "this much was added",
 *    when Balance = Current + Delivered - Removal is a projected absolute
 *    reserve level, not a delivery delta -- for K with Delivered=0, the
 *    entire "+207" came from Current alone. FIX: dropped the artificial '+'
 *    prefix on positive values (a genuine shortfall still shows its natural
 *    '-' sign).
 *
 * 3. The Excess/Deficit percentage suffix (e.g. "Excess (266%)") was
 *    Balance-as-%-of-ceiling/floor, which reads far more alarming than the
 *    real overshoot/shortfall (266% implies the whole Balance is 2.66x the
 *    ceiling). FIX: the percentage now expresses only the overage/shortfall
 *    itself as a % of the ceiling/floor -- "Excess (+166%)" means the
 *    excess amount is 166% of the ceiling, not that Balance is 266% of it;
 *    "Deficit (-13%)" means the shortfall is 13% of the floor.
 *
 * 4. The Removal column (hidden in GH-326 as "redundant with Required") is
 *    back -- Required blends Removal + Lift together, so Balance (which
 *    subtracts Removal, not Required) couldn't be verified from the table
 *    without it.
 */

'use strict';

const fs = require('fs');
const path = require('path');

function extractBlock(src, startMarker, maxLen) {
    const idx = src.indexOf(startMarker);
    expect(idx).toBeGreaterThan(-1);
    return src.slice(idx, idx + maxLen);
}

describe.each([
    ['nutrition-au-fertiliser-integration.js (AU)', '../assets/nutrition-au-fertiliser-integration.js', 'au-fert'],
    ['nutrition-prebble-integration.js (NZ)', '../assets/nutrition-prebble-integration.js', 'prebble'],
])('GH-333 — %s', (_label, relPath, prefix) => {
    let src;
    beforeAll(() => {
        src = fs.readFileSync(path.join(__dirname, relPath), 'utf8');
    });

    test('Excess branch has its own statusClass, distinct from Deficit', () => {
        const block = extractBlock(src, 'function classifyBalance(nutrient, required, delivered) {', 6500);
        expect(block).toMatch(/if \(ceilingKgHa > 0 && balanceKgHa > ceilingKgHa\) \{[\s\S]*?statusClass: 'excess'/);
        expect(block).toMatch(/if \(balanceKgHa < floorKgHa\) \{[\s\S]*?statusClass: 'deficit'/);
    });

    test('statusVisualClass() maps sufficient/excess/deficit/no-data to positive/negative/warning/neutral', () => {
        const idx = src.indexOf('function statusVisualClass(statusClass) {');
        expect(idx).toBeGreaterThan(-1);
        const block = src.slice(idx, idx + 500);
        expect(block).toMatch(/if \(statusClass === 'sufficient'\) return 'positive';/);
        expect(block).toMatch(/if \(statusClass === 'excess'\) return 'negative';/);
        expect(block).toMatch(/if \(statusClass === 'no-data'\) return 'neutral';/);
        expect(block).toMatch(/return 'warning';/);
    });

    test('Excess/Deficit labels show the overage/shortfall as a % of ceiling/floor, not Balance-as-%-of-ceiling/floor', () => {
        const block = extractBlock(src, 'function classifyBalance(nutrient, required, delivered) {', 6500);
        expect(block).toMatch(/const over = Math\.round\(\(balanceKgHa - ceilingKgHa\) \* 10\) \/ 10;/);
        expect(block).toMatch(/const overPct = Math\.round\(\(over \/ ceilingKgHa\) \* 100\);/);
        expect(block).toMatch(/statusLabel: `Excess \(\+\$\{overPct\}%\)`/);
        expect(block).toMatch(/const short = Math\.round\(\(floorKgHa - balanceKgHa\) \* 10\) \/ 10;/);
        expect(block).toMatch(/const shortPct = floorKgHa > 0 \? Math\.round\(\(short \/ floorKgHa\) \* 100\) : 0;/);
        expect(block).toMatch(/statusLabel: `Deficit \(-\$\{shortPct\}%\)`/);
        // regression: not the old Balance-as-%-of-endpoint formula
        expect(block).not.toMatch(/statusLabel: `Excess \(\$\{pct\}%\)`/);
        expect(block).not.toMatch(/statusLabel: `Deficit \(\$\{pct\}%\)`/);
    });

    test('diff cell no longer prefixes a "+" on positive Balance values', () => {
        expect(src).toMatch(/nutrient-diff \$\{statusVisualClass\(statusClass\)\}">\$\{diff\.toFixed\(1\)\}<\/td>/);
        expect(src).not.toMatch(/\$\{diff >= 0 \? '\+' : ''\}\$\{diff\.toFixed\(1\)\}/);
    });

    test('Annual Product Summary Balance row/cells use statusVisualClass() too, no "+" prefix', () => {
        const idx = src.indexOf(`${prefix}-balance-row--\${statusVisualClass(nBal.statusClass)}`);
        expect(idx).toBeGreaterThan(-1);
        const block = src.slice(idx, idx + 900);
        expect(block).toMatch(new RegExp(`${prefix}-\\\$\\{statusVisualClass\\(nBal\\.statusClass\\)\\}"><strong>\\\$\\{Math\\.round\\(nBal\\.diff\\)\\}`));
        expect(block).toMatch(new RegExp(`${prefix}-\\\$\\{statusVisualClass\\(pBal\\.statusClass\\)\\}"><strong>\\\$\\{Math\\.round\\(pBal\\.diff\\)\\}`));
        expect(block).toMatch(new RegExp(`${prefix}-\\\$\\{statusVisualClass\\(kBal\\.statusClass\\)\\}"><strong>\\\$\\{Math\\.round\\(kBal\\.diff\\)\\}`));
        expect(block).not.toMatch(/diff >= 0 \? '\+' : ''/);
    });

    test('Excess is computed from the upper bound (ceiling = range.max * unit), not floor or Current alone', () => {
        const block = extractBlock(src, 'function classifyBalance(nutrient, required, delivered) {', 6500);
        expect(block).toMatch(/const ceilingKgHa = range\.max \* unit;/);
        expect(block).toMatch(/if \(ceilingKgHa > 0 && balanceKgHa > ceilingKgHa\) \{/);
        expect(block).toMatch(/const over = Math\.round\(\(balanceKgHa - ceilingKgHa\) \* 10\) \/ 10;/);
        expect(block).toMatch(/const overPct = Math\.round\(\(over \/ ceilingKgHa\) \* 100\);/);
    });

    test('Range column now sits before Balance, which sits directly before Status', () => {
        const thClass = prefix === 'au-fert' ? 'au-fert-th' : 'prebble-th';
        const headerIdx = src.indexOf(`<th class="${thClass}">Range (kg/ha)</th>`);
        const balanceIdx = src.indexOf(`<th class="${thClass}">Balance</th>`);
        const statusIdx = src.indexOf(`<th class="${thClass}">Status</th>`);
        expect(headerIdx).toBeGreaterThan(-1);
        expect(balanceIdx).toBeGreaterThan(headerIdx);
        expect(statusIdx).toBeGreaterThan(balanceIdx);
    });

    test('Removal column is back in both header and row', () => {
        const thClass = prefix === 'au-fert' ? 'au-fert-th' : 'prebble-th';
        const tdClass = prefix === 'au-fert' ? 'au-fert-cell' : 'prebble-cell';
        expect(src).toMatch(new RegExp(`<th class="${thClass}">Removal \\(kg/ha\\)</th>`));
        expect(src).toMatch(/const removalDisplay = \(typeof removal === 'number'\) \? removal\.toString\(\) : '—';/);
        const rowBlock = extractBlock(src, "const nutrientSummaryRows = ['N', 'P', 'K'].map(nutrient => {", 1700);
        expect(rowBlock).toMatch(new RegExp(`<td class="${tdClass} ${tdClass}--num">\\\$\\{removalDisplay\\}</td>`));
    });
});

describe('GH-333 — CSS: excess is red, deficit is amber (nutrition-prebble-integration.js is the shared source for badge styles)', () => {
    let src;
    beforeAll(() => {
        src = fs.readFileSync(path.join(__dirname, '../assets/nutrition-prebble-integration.js'), 'utf8');
    });

    test('.nutrient-status-excess exists and is red; .nutrient-status-deficit is amber, not red', () => {
        expect(src).toMatch(/\.nutrient-status-excess\s*\{ background: #fef2f2; color: var\(--gaip-critical, #dc2626\); border: 1px solid #fecaca; \}/);
        expect(src).toMatch(/\.nutrient-status-deficit\s*\{ background: var\(--gaip-warning-bg, #fffbeb\); color: var\(--gaip-warning, #d97706\); border: 1px solid #fde68a; \}/);
    });

    test('warning variants exist alongside positive/negative for diff cells, totals, and balance rows', () => {
        expect(src).toMatch(/\.prebble-warning \{ color: var\(--gaip-warning, #d97706\); font-weight: 600; \}/);
        expect(src).toMatch(/\.prebble-nutrient-summary \.nutrient-diff\.warning \{ color: var\(--gaip-warning, #d97706\); \}/);
        expect(src).toMatch(/\.prebble-balance-row--warning td \{ background: var\(--gaip-warning-bg, #fffbeb\); \}/);
    });

    test('the older injectStyles() duplicate block also distinguishes deficit (amber) from excess (red)', () => {
        expect(src).toMatch(/tr\.nutrient-deficit td:last-child \{\s*color: #d97706;/);
        expect(src).toMatch(/tr\.nutrient-excess td:last-child \{\s*color: #dc2626;/);
    });
});

describe('GH-333 — CSS: AU file has its own warning variants (badge CSS is shared from NZ)', () => {
    let src;
    beforeAll(() => {
        src = fs.readFileSync(path.join(__dirname, '../assets/nutrition-au-fertiliser-integration.js'), 'utf8');
    });

    test('warning variants exist alongside positive/negative', () => {
        expect(src).toMatch(/\.au-fert-warning \{ color: var\(--gaip-warning, #d97706\); font-weight: 600; \}/);
        expect(src).toMatch(/\.au-fert-nutrient-summary \.nutrient-diff\.warning \{ color: var\(--gaip-warning, #d97706\); \}/);
        expect(src).toMatch(/\.au-fert-balance-row--warning td \{ background: var\(--gaip-warning-bg, #fffbeb\); \}/);
    });
});

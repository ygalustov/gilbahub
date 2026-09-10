/**
 * GH-396 — the Word export's nutrient tables show the same quantities, in the
 * same units, under the same names as the Plan page.
 *
 * NO ARITHMETIC CHANGED. Verified live before the work started and again
 * after: on Test5 - NZ ("Soccer") the Plan page and the Combined export
 * already agreed on every figure. What differed was entirely presentation,
 * in four ways:
 *
 *   (a) One measurement, two units, nothing saying so. The report printed
 *       "K ppm 40"; the Plan printed "Current (kg/ha) 56". Same quantity:
 *       40 x 1.4 x 10 x 0.1 = 56. A reader sees 40 and 56 and concludes the
 *       data diverged. Fixed by making kg/ha the primary unit everywhere and
 *       putting the certificate's own ppm in brackets after it — the client
 *       cross-checks this table against a lab certificate written in ppm.
 *
 *   (b) Two different quantities under one name. The Plan's Balance is
 *       Current + Delivered − Removal, the projected soil level at season
 *       end. The export's "K balance" was Delivered − Required, whether the
 *       N programme's incidental K covers the requirement. Both are correct
 *       and they cannot be collapsed: on Test5's phosphorus Delivered −
 *       Required is zero (there is nothing to apply) while the projected pool
 *       falls from 56 to 17 kg/ha, 39% below the floor. One is about this
 *       season, the other about next. Fixed by printing both, under distinct
 *       names: the Plan's vocabulary is the reference, so Balance joins the
 *       report unchanged and the report's column becomes "Programme vs
 *       required".
 *
 *   (c) The report showed a subset of the Plan's columns — a concentration
 *       and a requirement per nutrient, no removal, delivered, range or
 *       status. Fixed: the Annual Nutrient Requirements table is now
 *       Sample | Nutrient | Current (kg/ha, ppm) | Removal | Required |
 *       Delivered | Range | Balance | Status, keeping b35fix316's
 *       samples-as-rows layout (a 45-sample council report in the other
 *       orientation ran off the page) and narrowing the nutrient set from
 *       N/P/K/S to the Plan's N/P/K.
 *
 *   (d) The caption stated something false: "The figures below are annual
 *       removal-replacement estimates (clipping uptake), not deficit-closure
 *       rates." Below the sufficiency floor the engine adds that year's share
 *       of the lift — live on Test5, K Required 152.7 is removal 126 plus
 *       lift. Rewritten in BOTH export files, since both carried the sentence.
 *
 * Live figures below come from a real run against the dev stack on
 * 2026-09-10 (npm run test:e2e, GILBA_E2E_KEEP=1), read out of the rendered
 * .docx and off the rendered Plan page — not invented, and not copied from
 * the ticket text, which predates the traffic modifier GH-394 made live on
 * this site and therefore quotes smaller numbers.
 */

'use strict';

const fs = require('fs');
const path = require('path');

const A = (f) => fs.readFileSync(path.join(__dirname, '../assets/', f), 'utf8');
const V = (f) => fs.readFileSync(path.join(__dirname, '../app/resources/views/', f), 'utf8');

const combined = A('word-export-combined.js');
const wordExport = A('word-export.js');
const prebble = A('nutrition-prebble-integration.js');
const auFert = A('nutrition-au-fertiliser-integration.js');
const model = require('../assets/nutrient-balance-status.js');

// ── (a) + (c): the table's shape ────────────────────────────────────────────

describe('GH-396 — the Annual Nutrient Requirements table carries the Plan page\'s columns', () => {
    test('the header is the Plan\'s nine columns, in the Plan\'s words', () => {
        [
            "_mkHdr('Sample',              SAMPLE_COL_W)",
            "_mkHdr('Nutrient',            NUT_COL_W)",
            "_mkHdr('Current (kg/ha, ppm)', CURRENT_COL_W)",
            "_mkHdr('Removal',             REMOVAL_COL_W)",
            "_mkHdr('Required',            REQUIRED_COL_W)",
            "_mkHdr('Delivered',           DELIVERED_COL_W)",
            "_mkHdr('Range',               RANGE_COL_W)",
            "_mkHdr('Balance',             BALANCE_COL_W)",
            "_mkHdr('Status',              STATUS_COL_W)"
        ].forEach((h) => expect(combined).toContain(h));
    });

    test('the old ppm-and-requirement-only header is gone', () => {
        expect(combined).not.toMatch(/_mkHdr\('N kg\/ha'/);
        expect(combined).not.toMatch(/_mkHdr\('P ppm'/);
        expect(combined).not.toMatch(/_mkHdr\('K ppm'/);
        expect(combined).not.toMatch(/_mkHdr\('S ppm'/);
        expect(combined).not.toMatch(/_mkHdr\('S req'/);
    });

    test('the nutrient set is the Plan\'s N, P and K — S no longer gets a requirement row', () => {
        // The row loop, not the engine: _anr.S is still computed (the Soil
        // Amendment table and the trend columns read it), it simply no longer
        // has a column on a table the Plan has no S row for.
        const idx = combined.indexOf("// ── Standard MLSN/SLAN/AA table ───");
        expect(idx).toBeGreaterThan(-1);
        const block = combined.slice(idx, idx + 14000);
        expect(block).toMatch(/\['N', 'P', 'K'\]\.forEach\(function\(nut\) \{/);
        expect(block).not.toMatch(/\['P', 'K', 'S'\]\.forEach/);
    });

    test('samples-as-rows is kept — the sample label is on every row, nutrients run downward', () => {
        const idx = combined.indexOf("// ── Standard MLSN/SLAN/AA table ───");
        const block = combined.slice(idx, idx + 14000);
        // One TableRow pushed per nutrient, inside the per-nutrient loop,
        // inside the per-report loop.
        expect(block).toMatch(/anrReports\.forEach\(function\(r, ri\) \{[\s\S]*\['N', 'P', 'K'\]\.forEach[\s\S]*tableRows\.push\(new TableRow/);
        expect(block).toMatch(/_mkCell\(r\.sampleLabel \|\| r\.sampleId, \{\s*\n\s*fill: rowFill, bold: true, size: 17, width: SAMPLE_COL_W/);
    });

    test('the soil level is printed in kg/ha with the certificate ppm in brackets, from the shared formatter', () => {
        expect(combined).toMatch(/_balanceModel\.formatCurrent\(cls\.currentDisplay, cls\.currentPpm\)/);
        expect(model.formatCurrent('56', 40)).toBe('56 (40 ppm)');
        expect(model.formatCurrent('33.3', 23.81)).toBe('33.3 (23.8 ppm)');
        // No soil reading — one dash, not "— (— ppm)".
        expect(model.formatCurrent('—', null)).toBe('—');
    });
});

// ── (b): two quantities, two names ──────────────────────────────────────────

describe('GH-396 — Balance and "Programme vs required" are named apart', () => {
    test('the K Reconciliation table renamed its columns to the Plan\'s words', () => {
        expect(combined).toMatch(/_mkHdr\('Required',\s+1000\)/);
        expect(combined).toMatch(/_mkHdr\('Delivered',\s+1100\)/);
        expect(combined).toMatch(/_mkHdr\('Programme vs required', 1800\)/);
        expect(combined).not.toMatch(/_mkHdr\('K balance'/);
        expect(combined).not.toMatch(/_mkHdr\('K req'/);
        expect(combined).not.toMatch(/_mkHdr\('K delivered'/);
    });

    test('the reconciliation captions name the renamed quantity, not "Balance"', () => {
        expect(combined).toContain('Programme vs required = programme K (catalogue products only) − engine K requirement.');
        expect(combined).not.toContain('Balance = programme K (catalogue products only) − engine K req.');
    });

    test('the Plan page\'s own spot-K preview hints use the same new name', () => {
        expect(prebble).toContain('Programme vs required is short by');
        expect(prebble).toMatch(/Programme vs required \$\{reconResult\.balance\.toFixed\(0\)\} kg\/ha;/);
        expect(prebble).not.toMatch(/\s+K balance is short by/);
    });

    test('the Plan page\'s Balance column keeps its own name and meaning', () => {
        // The reference vocabulary. Renaming these would have been the wrong
        // direction of travel for this ticket.
        expect(prebble).toContain('<th class="prebble-th">Current (kg/ha)</th>');
        expect(prebble).toContain('<th class="prebble-th">Removal (kg/ha)</th>');
        expect(prebble).toContain('<th class="prebble-th">Balance</th>');
        expect(auFert).toContain('<th class="au-fert-th">Balance</th>');
    });
});

// ── (d): the caption ────────────────────────────────────────────────────────

describe('GH-396 — the caption no longer states something untrue', () => {
    test('the false "not deficit-closure rates" sentence is gone from both export files', () => {
        expect(combined).not.toContain('annual removal-replacement estimates (clipping uptake), not');
        expect(wordExport).not.toContain('annual removal-replacement estimates (clipping uptake), not');
        expect(combined).not.toContain('deficit-closure rates');
        expect(wordExport).not.toContain('deficit-closure rates');
    });

    test('Required is described as removal plus the year\'s share of the lift', () => {
        const sentence = "Required is the annual removal-replacement estimate ";
        expect(combined).toContain(sentence);
        expect(combined).toContain("year\\'s share of the correction needed to lift it — it is not removal alone.");
        // The single-sample export carries the same corrected sentence.
        expect(wordExport).toContain('Required is the annual ');
        expect(wordExport).toContain('removal alone.');
    });

    test('Balance is described as the projected soil level, and the K reconciliation cross-reference is conditional', () => {
        expect(combined).toContain('Balance is the projected soil level at season end ');
        expect(combined).toContain('(Current + Delivered − Removal), judged against the sufficiency range');
        // Only pointed at when that table will actually be rendered — a site
        // whose programme delivers no K has no reconciliation table to read.
        expect(combined).toMatch(/_willRenderKReconciliation\s*\n\s*\?\s*'; the K reconciliation table below answers a different question/);
    });

    test('the unit sentence states kg/ha as primary with ppm in brackets', () => {
        expect(combined).toContain("Rates are kg/ha/yr; soil levels are kg/ha with the ");
        expect(combined).toContain("certificate\\'s ppm in brackets.");
    });

    test('the Hill Labs sample-type templating survives the rewrite', () => {
        // The S277 / S81 wording is per sample type and must not become a
        // hard-coded literal.
        expect(combined).toMatch(/'Hill Labs ' \+ _b35fix441b_aaCode \+ ' sample-type sufficiency thresholds applied \(' \+\s*\n\s*_b35fix441b_aaLabel/);
        expect(wordExport).toMatch(/'Hill Labs ' \+ _b35fix441_sampleTypeCode \+ ' sample-type sufficiency thresholds applied \(' \+\s*\n\s*_b35fix441_sampleTypeLabel/);
    });

    test('the now-redundant "shown in follow-up table" suffix is gone, not merely unused', () => {
        expect(combined).not.toContain('K reconciliation against N programme delivery shown in follow-up table.');
    });
});

// ── one implementation of the model ────────────────────────────────────────

describe('GH-396 — the Balance/Status model has one implementation', () => {
    test('both Plan integrations delegate to assets/nutrient-balance-status.js', () => {
        [['nutrition-prebble-integration.js', prebble], ['nutrition-au-fertiliser-integration.js', auFert]]
            .forEach(([name, src]) => {
                expect(src).toMatch(/window\.GAIP_NutrientBalanceStatus/);
                expect(src).toMatch(/return _balanceModel\.classify\(\{/);
                expect(src).toMatch(/return _balanceModel \? _balanceModel\.visualClass\(statusClass\) : 'neutral';/);
                // The local copies are gone, not merely bypassed.
                expect(src).not.toMatch(/const balanceKgHa = currentKgHa \+ delivered - removal;/);
                expect(src).not.toMatch(/const rangeDisplay = `\$\{Math\.round\(floorKgHa/);
                expect(name).toBeTruthy();
            });
    });

    test('a missing module produces a named error, never an invented verdict', () => {
        [prebble, auFert].forEach((src) => {
            expect(src).toMatch(/GH-396: nutrient-balance-status\.js is not loaded/);
            expect(src).toMatch(/statusClass: 'no-data', statusLabel: 'Not Available'/);
        });
        expect(combined).toMatch(/GH-396: nutrient-balance-status\.js is not loaded/);
    });

    test('the export calls the same classifier rather than reimplementing it', () => {
        expect(combined).toMatch(/var _balanceModel = \(typeof window !== 'undefined' && window\.GAIP_NutrientBalanceStatus\) \|\| null;/);
        expect(combined).toMatch(/cls = _balanceModel\.classify\(\{/);
        expect(combined).not.toMatch(/var balanceKgHa = currentKgHa \+ delivered - removal;/);
    });

    test('every page that renders either table loads the module', () => {
        const plan = V('plan.blade.php');
        expect(plan).toContain("$legacyAssetUrl('nutrient-balance-status.js')");
        ['reports/export.blade.php', 'reports/forensic.blade.php', 'reports/scenarios.blade.php', 'hub.blade.php']
            .forEach((f) => expect(V(f)).toContain("'nutrient-balance-status.js'"));
    });

    test('it loads before the consumers that call it', () => {
        const plan = V('plan.blade.php');
        expect(plan.indexOf("$legacyAssetUrl('nutrient-balance-status.js')"))
            .toBeLessThan(plan.indexOf("$legacyAssetUrl('nutrition-prebble-integration.js')"));
        ['reports/export.blade.php', 'reports/forensic.blade.php', 'reports/scenarios.blade.php', 'hub.blade.php']
            .forEach((f) => {
                const src = V(f);
                expect(src.indexOf("'nutrient-balance-status.js'"))
                    .toBeLessThan(src.indexOf("'nutrition-prebble-integration.js'"));
            });
    });
});

// ── the model itself, on real rendered data ────────────────────────────────

describe('GH-396 — the shared classifier reproduces the figures both surfaces printed', () => {
    // Test5 - NZ, sample "Soccer", live 2026-09-10. Plan page and rendered
    // .docx agreed cell for cell; these are those cells.
    //
    //   soil K 40 ppm, P 40 ppm; bulk density 1.4, depth 10 cm  -> unit 1.4
    //   S277 ranges: K 78.2-195.5 ppm, P 20-30 ppm
    //   annual N 250 base x 1.15 traffic (GH-394) = 287.5
    const UNIT = { bulkDensity: 1.4, soilDepth: 10 };

    test('K: Current 56 (40 ppm), Removal 126, Delivered 201, Balance 131, On Track', () => {
        const r = model.classify(Object.assign({
            nutrient: 'K', required: 152.7, delivered: 201, currentPpm: 40, removal: 126,
            range: { min: 78.2, max: 195.5 }
        }, UNIT));
        expect(r.currentDisplay).toBe('56');
        expect(model.formatCurrent(r.currentDisplay, r.currentPpm)).toBe('56 (40 ppm)');
        expect(r.rangeDisplay).toBe('109.5–273.7');
        expect(+r.diff.toFixed(1)).toBe(131);
        expect(r.statusLabel).toBe('On Track');
        expect(model.visualClass(r.statusClass)).toBe('positive');
    });

    test('P: nothing to apply this season, yet the projected pool ends 39% below the floor', () => {
        // The exact case that proves Balance and "Programme vs required" are
        // different questions: Delivered − Required is 0, Balance is a deficit.
        const r = model.classify(Object.assign({
            nutrient: 'P', required: 0, delivered: 0, currentPpm: 40, removal: 39,
            range: { min: 20, max: 30 }
        }, UNIT));
        expect(r.currentDisplay).toBe('56');
        expect(r.rangeDisplay).toBe('28–42');
        expect(+r.diff.toFixed(1)).toBe(17);
        expect(r.statusLabel).toBe('Deficit (-39%)');
        expect(model.visualClass(r.statusClass)).toBe('warning');
        // "Programme vs required" on the same row would read zero.
        expect(0 - 0).toBe(0);
    });

    test('N: no soil range at all, so it takes the delivered-vs-required fallback', () => {
        const r = model.classify({ nutrient: 'N', required: 288, delivered: 258.6 });
        expect(r.currentDisplay).toBe('—');
        expect(r.rangeDisplay).toBe('—');
        expect(+r.diff.toFixed(1)).toBe(-29.4);
        expect(r.statusLabel).toBe('On Track');   // 258.6 / 288 = 90%
    });

    test('the SLAN fixture\'s below-floor K, as rendered (New test - location, "Putter Green")', () => {
        // soil K 19.31 ppm against the Carrow floor of 75; unit 1.4.
        const r = model.classify(Object.assign({
            nutrient: 'K', required: 103, delivered: 104.6, currentPpm: 19.31, removal: 64,
            range: { min: 75, max: 176 }
        }, UNIT));
        expect(r.currentDisplay).toBe('27');
        expect(r.rangeDisplay).toBe('105–246.4');
        expect(+r.diff.toFixed(1)).toBe(67.6);
        expect(r.statusLabel).toBe('Deficit (-36%)');
    });

    test('the ppm -> kg/ha conversion is the one the whole ticket turns on', () => {
        expect(model.ppmToKgHa(40, 1.4, 10)).toBeCloseTo(56, 6);
    });
});

// ── the Delivered column's source ──────────────────────────────────────────

describe('GH-396 — Delivered comes from one accumulator for all three nutrients', () => {
    test('_computeProgrammeKDelivered is the K case of _computeProgrammeDelivered, not a second sum', () => {
        expect(wordExport).toMatch(/function _computeProgrammeKDelivered\(productMapOrSummary\) \{\s*\n\s*return _computeProgrammeDelivered\(productMapOrSummary, 'K'\);\s*\n\s*\}/);
        expect(wordExport).toMatch(/_computeProgrammeDelivered: _computeProgrammeDelivered,/);
    });

    test('it stays catalogue-only — an amendment is what Balance justifies, not part of the programme', () => {
        const idx = wordExport.indexOf('function _computeProgrammeDelivered(productMapOrSummary, nutrient) {');
        expect(idx).toBeGreaterThan(-1);
        const block = wordExport.slice(idx, idx + 900);
        expect(block).toMatch(/if \(entry\._isAmendment\) return;/);
        expect(block).toMatch(/var v = parseFloat\(n\[nutrient\]\);/);
    });

    test('the ANR table reads it through the shared helper', () => {
        expect(combined).toMatch(/window\.GAIP_WordExport\._computeProgrammeDelivered\) \|\| null;/);
        expect(combined).toMatch(/return _wxDeliveredHelper\(np\.annualSummary, nut\);/);
    });
});

// ── the Plan page's own inputs reach the export ────────────────────────────

describe('GH-396 — the export\'s new columns are the Plan page\'s own inputs, not a second resolution', () => {
    test('the per-sample computeProgram() result is stashed for the renderer', () => {
        expect(combined).toMatch(/r\._planParity = \{[\s\S]{0,400}?annual_totals_range[\s\S]{0,200}?missing_soil_data/);
        // Stashed where the programme is known good, so a sample whose
        // recommender later fails still has its soil columns.
        const stash = combined.indexOf('r._planParity = {');
        const recommender = combined.indexOf('var perSampleProgram;');
        expect(stash).toBeGreaterThan(-1);
        expect(stash).toBeLessThan(recommender);
    });

    test('those four fields are exactly what the Plan page reads', () => {
        // nutrition-prebble-integration.js's own reads, for comparison.
        expect(prebble).toMatch(/const soilInfo = program\.soil \|\| \{\};/);
        expect(prebble).toMatch(/const rangeMap = program\.annual_totals_range \|\| \{\};/);
        expect(prebble).toMatch(/const removalMap = program\.annual_removal \|\| \{\};/);
        expect(prebble).toMatch(/const missingSoilDataMap = program\.missing_soil_data \|\| \{\};/);
        // and the export's stash of the same four.
        expect(combined).toMatch(/soil: perSampleCalendar\.soil \|\| null,/);
        expect(combined).toMatch(/removal: perSampleCalendar\.annual_removal \|\| null,/);
        expect(combined).toMatch(/ranges: perSampleCalendar\.annual_totals_range \|\| null,/);
        expect(combined).toMatch(/missingSoilData: perSampleCalendar\.missing_soil_data \|\| \{\}/);
    });

    test('with no programme for a sample the columns print a dash rather than a reconstructed guess', () => {
        const idx = combined.indexOf('var cls = null;');
        expect(idx).toBeGreaterThan(-1);
        const block = combined.slice(idx, idx + 1400);
        expect(block).toMatch(/if \(_balanceModel && pp && deliveredNum != null\) \{/);
        expect(block).toMatch(/var currentText = cls\s*\n\s*\? _balanceModel\.formatCurrent/);
        expect(block).toMatch(/var balanceText = cls \? cls\.diff\.toFixed\(1\) : '—';/);
        expect(block).toMatch(/var statusText = cls \? cls\.statusLabel : '—';/);
    });

    test('the existing † and ‡ markers still land on the Required cell', () => {
        const idx = combined.indexOf("// ── Standard MLSN/SLAN/AA table ───");
        const block = combined.slice(idx, idx + 14000);
        expect(block).toMatch(/reqVal = reqVal \+ ' †';/);
        expect(block).toMatch(/reqVal = reqVal \+ ' ‡';/);
    });
});

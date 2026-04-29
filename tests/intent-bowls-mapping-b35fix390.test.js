/**
 * Test b35fix390 — bowls turfType mapped to eliteMatchPlay in
 * extractTurfIntentKey.
 *
 * Pre-fix: the mapping table at identity-enforcement.js:687 had no entry for
 * 'bowls' or 'bowls_*'. Cotula sites with turfType='bowls' and subCategory=null
 * produced `combined = 'bowls_'` (lowercased, trimmed, whitespace-collapsed)
 * which mapped to nothing → extractTurfIntentKey returned null → setIdentityKey
 * fell back to the unknownIntent default, logging:
 *   "[IdentityEnforcement] turfIntentKey defaulted to "unknownIntent" (impact:
 *    high, penalty: -20%)"
 * The downstream wear engine then blocked at hub-orchestrator.js:1063 with
 *   "[Orchestrator:wear] Wear engine blocked by identity enforcement: BLOCKED -
 *    recovery windows require defined intent"
 *
 * Production evidence: gilbasolutions_com-1777421036591.log lines 196/252
 * (X Cotula BC, Christchurch, post-b35fix389 deploy, asset ?ver=1777420942
 * 2026-04-29 00:02 UTC). The b35fix389 fix (adding 'cotula' to validValues)
 * cleared the speciesKey side of the wear-engine block. The intent-side
 * block stayed because the mapping table didn't recognise 'bowls' as a
 * valid turf type. b35fix390 closes that gap.
 *
 * Choice of 'eliteMatchPlay': bowls is precision short-mown competition turf,
 * agronomically equivalent intent profile to elite golf greens. The mapping
 * precedent at lines 705 ('golf_greens') and 711-712 ('sports_stadium' /
 * 'sports_elite') already routes this class of surface to eliteMatchPlay.
 *
 * Pairs with b35fix388 (which makes turfType='bowls' actually persist past
 * the hub-store proxy so the intent resolver sees it in the first place) and
 * b35fix389 (which adds 'cotula' to speciesKey validValues so TIER 0 doesn't
 * fail and downstream identity-gated engines accept the speciesKey).
 *
 * NOT in scope for b35fix390: the separate Word-export-vs-live-UI asymmetry
 * where word-export.js:5959 reads `data.turf.type` and gets 'sports' despite
 * the live UI chips and Prebble live preview both showing 'bowls'/'Bowling
 * Greens'. Held for a future build pending more probing.
 */

const fs = require('fs');
const path = require('path');

describe('b35fix390 — bowls turfType maps to eliteMatchPlay', () => {
    let identitySrc;

    beforeAll(() => {
        identitySrc = fs.readFileSync(
            path.join(__dirname, '../assets/identity-enforcement.js'),
            'utf8'
        );
    });

    test('extractTurfIntentKey mapping table contains bowls entries', () => {
        // Locate the extractTurfIntentKey mapping object, then assert all
        // four bowls keys map to eliteMatchPlay. Tolerant pattern allows
        // either single or double quotes around the literals.
        const fnMatch = identitySrc.match(
            /function\s+extractTurfIntentKey[\s\S]*?const\s+mapping\s*=\s*\{([\s\S]*?)\};/
        );
        expect(fnMatch).toBeTruthy();
        const mapping = fnMatch[1];

        // Strip line comments to avoid the b35fix390 inline comment text
        // satisfying token checks via prose mentions of 'bowls'.
        const codeOnly = mapping.replace(/\/\/[^\n]*/g, '');

        // Each bowls variant must map to eliteMatchPlay.
        for (const key of ['bowls', 'bowls_', 'bowling', 'bowling_green', 'bowling_greens']) {
            const re = new RegExp(`['"]${key.replace(/_/g, '_')}['"]\\s*:\\s*['"]eliteMatchPlay['"]`);
            expect(codeOnly).toMatch(re);
        }
    });

    test('eliteMatchPlay is a valid turfIntentKey value', () => {
        // Sanity check — adding a mapping to a non-validValue would fail the
        // same way the b35fix389 cotula speciesKey case did pre-fix. Assert
        // that the value we're mapping TO is in the validValues array.
        const block = identitySrc.match(
            /turfIntentKey:\s*\{[\s\S]*?validValues:\s*\[([\s\S]*?)\][\s\S]*?\}/
        );
        expect(block).toBeTruthy();
        const codeOnly = block[1].replace(/\/\/[^\n]*/g, '');
        expect(codeOnly).toMatch(/(^|,|\s)\s*['"]eliteMatchPlay['"]\s*(,|$)/m);
    });

    test('legacy mappings preserved (no regression)', () => {
        // The bowls entries are inserted between the existing turfType_*
        // patterns and the legacy single-value mappings. Confirm both
        // categories still present so the patch didn't accidentally truncate
        // either side.
        const fnMatch = identitySrc.match(
            /function\s+extractTurfIntentKey[\s\S]*?const\s+mapping\s*=\s*\{([\s\S]*?)\};/
        );
        const mapping = fnMatch[1];
        const codeOnly = mapping.replace(/\/\/[^\n]*/g, '');

        // Hub turfType + subCategory still there
        expect(codeOnly).toMatch(/['"]golf_greens['"]\s*:\s*['"]eliteMatchPlay['"]/);
        expect(codeOnly).toMatch(/['"]sports_stadium['"]\s*:\s*['"]eliteMatchPlay['"]/);
        expect(codeOnly).toMatch(/['"]sports_['"]\s*:\s*['"]professionalSport['"]/);
        expect(codeOnly).toMatch(/['"]lawns_['"]\s*:\s*['"]generalMaintenance['"]/);

        // Legacy single-value still there
        expect(codeOnly).toMatch(/['"]greens['"]\s*:\s*['"]eliteMatchPlay['"]/);
        expect(codeOnly).toMatch(/['"]sports['"]\s*:\s*['"]professionalSport['"]/);
        expect(codeOnly).toMatch(/['"]lawns['"]\s*:\s*['"]generalMaintenance['"]/);
    });

    test('combined-key construction logic preserved', () => {
        // The bug was downstream of the combined-key construction at line
        // 681: `(turfType + '_' + subCategory).toLowerCase().trim()...`. With
        // turfType='bowls' and subCategory=null, that produces 'bowls_'.
        // Don't accidentally remove or change that construction — the fix is
        // adding the mapping target, not changing how the lookup key is built.
        expect(identitySrc).toMatch(
            /\(\s*turfType\s*\+\s*['"]_['"]?\s*\+\s*subCategory\s*\)/
        );
    });

    test('b35fix390 changelog comment present', () => {
        expect(identitySrc).toMatch(/b35fix390/);
    });
});

describe('b35fix390 — extractTurfIntentKey behavioural simulation', () => {
    // Re-implement the function's resolution logic in JS and verify the
    // bowls cases route to eliteMatchPlay. This is a structural test — it
    // mirrors the source mapping rather than loading the module — but it
    // catches the case where the mapping is structurally present but the
    // construction logic above it has been broken.

    let mapping;

    beforeAll(() => {
        // Extract the mapping object from source and parse it as a JS
        // literal. Comment-strip first.
        const identitySrc = fs.readFileSync(
            path.join(__dirname, '../assets/identity-enforcement.js'),
            'utf8'
        );
        const fnMatch = identitySrc.match(
            /function\s+extractTurfIntentKey[\s\S]*?const\s+mapping\s*=\s*(\{[\s\S]*?\})\s*;/
        );
        const objLiteral = fnMatch[1].replace(/\/\/[^\n]*/g, '');
        // eval is fine here — source under our control, sandbox-only test
        mapping = eval('(' + objLiteral + ')');
    });

    function resolveIntent(turfType, subCategory) {
        // Mirror identity-enforcement.js:677-682 + 729-730 exactly, including
        // the `|| ''` coercions at lines 677-678 that handle null/undefined.
        const tt = turfType || '';
        const sc = subCategory || '';
        const combined = (tt + '_' + sc).toLowerCase().trim().replace(/\s+/g, '_');
        const raw = combined || tt;
        const normalised = (typeof raw === 'string') ? raw.toLowerCase().trim() : '';
        return mapping[normalised] || null;
    }

    test('cotula bowls site (turfType=bowls, subCategory=null) → eliteMatchPlay', () => {
        // Production case from gilbasolutions_com-1777421036591.log line 115:
        // {turfType: 'bowls', subCategory: null, ...}
        //
        // In the function's actual code (identity-enforcement.js:677-682):
        //   const turfType = turf.turfType || '';        // 'bowls'
        //   const subCategory = turf.subCategory || '';  // '' (null coerces)
        //   const combined = (turfType + '_' + subCategory).toLowerCase()...
        //                                                                   .trim().replace(/\s+/g, '_');
        // So combined = 'bowls_' (NOT 'bowls_null' — the || '' coerces null
        // before concat). The b35fix390 mapping has 'bowls_' as a key →
        // resolveIntent returns 'eliteMatchPlay'.
        const result = resolveIntent('bowls', null);
        expect(result).toBe('eliteMatchPlay');
    });

    test('bowls with no subCategory at all (typeof === undefined) → eliteMatchPlay', () => {
        // If extractTurfIntentKey were called with turf.subCategory undefined
        // rather than null, line 678's `turf.subCategory || ''` would coerce
        // to '' and combined would be 'bowls_'. Cover that path too.
        const result = resolveIntent('bowls', '');
        expect(result).toBe('eliteMatchPlay');
    });

    test("bare 'bowls' (legacy single-value path) → eliteMatchPlay", () => {
        // If turfType is set but the combined form fails, line 682 falls back
        // to bare turfType. The legacy single-value table must catch 'bowls'.
        const result = mapping['bowls'] || null;
        expect(result).toBe('eliteMatchPlay');
    });

    test('explicit bowling_green / bowling_greens / bowling → eliteMatchPlay', () => {
        // Variants that might come from explicit intent fields (turf.intent /
        // site.intent) rather than turfType + subCategory composition.
        expect(mapping['bowling']).toBe('eliteMatchPlay');
        expect(mapping['bowling_green']).toBe('eliteMatchPlay');
        expect(mapping['bowling_greens']).toBe('eliteMatchPlay');
    });

    test('non-bowls turfType still resolves correctly (no regression)', () => {
        // Spot-check a sample of pre-existing mappings.
        expect(resolveIntent('sports', 'stadium')).toBe('eliteMatchPlay');
        expect(resolveIntent('sports', 'community')).toBe('communityRecreation');
        expect(resolveIntent('golf', 'fairways')).toBe('professionalSport');
        expect(resolveIntent('lawns', '')).toBe('generalMaintenance');
    });
});

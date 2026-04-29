/**
 * Test b35fix389 — 'cotula' added to IDENTITY_KEYS.speciesKey.validValues.
 *
 * Pre-fix: SpeciesController.normalize('cotula') returns 'cotula' via the
 * DICOT_BYPASS branch (species-controller.js:234). identity-enforcement.js
 * IDENTITY_KEYS.speciesKey.validValues did not contain 'cotula'. So the call
 * setIdentityKey('speciesKey', 'cotula', source) hit the validValues.includes()
 * check at line 297, returned {valid: false}, and logged TIER 0 VIOLATION at
 * line 304. The cotula bypass at line 411 then rescued
 * _identityState.quality.tier0Valid back to true, but setIdentityKey's own
 * return was still {valid:false} — so identity-gated downstream engines
 * (wear-recovery at hub-orchestrator.js:1063) saw "Missing required identity:
 * speciesKey" and refused to run.
 *
 * Production evidence: gilbasolutions_com-1777418778208.log lines 151/153/178
 * (X Cotula BC, NZ, AA methodology). The full pre-fix triad:
 *   151: [IdentityEnforcement] TIER 0 VIOLATION: speciesKey is required but invalid
 *   153: [IdentityEnforcement] Cotula dicot bypass — TIER 0 satisfied, grass engines suppressed.
 *   178: [Orchestrator:wear] Wear engine blocked by identity enforcement: Missing required identity: speciesKey
 *
 * Fix: add 'cotula' to IDENTITY_KEYS.speciesKey.validValues. Same shape as
 * b35fix366's 'seashore_paspalum' addition.
 *
 * Pairs with b35fix388 for the full cotula production-log clearance:
 *   b35fix388 makes the cotula state writes (turfType/surfaceType/speciesKey/
 *   cotula/grassSpecies/physiology) actually persist past the hub-store proxy,
 *   which lets the intent resolver find the bowls intent (clearing the
 *   unknownIntent default at line 154 of the production log).
 *
 *   b35fix389 makes setIdentityKey return valid for the persisted speciesKey,
 *   clearing the VIOLATION at line 151 and unblocking the wear engine at line
 *   178.
 */

const fs = require('fs');
const path = require('path');

describe('b35fix389 — cotula in IDENTITY_KEYS.speciesKey.validValues', () => {
    let identitySrc;
    let speciesControllerSrc;

    beforeAll(() => {
        identitySrc = fs.readFileSync(
            path.join(__dirname, '../assets/identity-enforcement.js'),
            'utf8'
        );
        speciesControllerSrc = fs.readFileSync(
            path.join(__dirname, '../assets/species-controller.js'),
            'utf8'
        );
    });

    test("'cotula' is in IDENTITY_KEYS.speciesKey.validValues", () => {
        // Anchor the validValues block from `validValues: [` through the
        // matching closing `],` line that precedes `unknownValue:` — the next
        // sibling property in the speciesKey config object. This avoids the
        // non-greedy-match-too-short trap (b35fix366's inline comment contains
        // `]` characters, e.g. `validValues.includes('seashore_paspalum')`,
        // which a naive `[\s\S]*?` capture stops on).
        const block = identitySrc.match(
            /speciesKey:\s*\{[\s\S]*?validValues:\s*\[([\s\S]*?)\],\s*unknownValue/
        );
        expect(block).toBeTruthy();
        // Strip line comments before token-matching. Without this, the
        // inline b35fix366/b35fix389 comments (which contain quoted phrases
        // like `setIdentityKey('speciesKey', 'cotula', ...)` in prose) can
        // satisfy a `'cotula'` token check even if the actual array entry
        // is removed. Strip everything from `//` to end-of-line, then check
        // for the canonical token in the remaining real array content.
        const codeOnly = block[1].replace(/\/\/[^\n]*/g, '');
        // Strict — the literal must appear AS a quoted token bounded by
        // start-of-line whitespace or comma+whitespace, and comma/whitespace/
        // end-of-array on the right.
        expect(codeOnly).toMatch(/(^|,|\s)\s*['"]cotula['"]\s*(,|$)/m);
    });

    test("SpeciesController has 'cotula' in DICOT_BYPASS_SPECIES (sanity check)", () => {
        // The whole point of adding 'cotula' to validValues is that
        // SpeciesController.normalize() can emit it. If a future refactor
        // removes cotula from DICOT_BYPASS_SPECIES, the validValues entry
        // is still correct in itself — but this test surfaces the change so
        // the pair stays consistent.
        expect(speciesControllerSrc).toMatch(
            /DICOT_BYPASS_SPECIES\s*=\s*\[[^\]]*['"]cotula['"]/
        );
    });

    test('TIER 0 VIOLATION error path still exists at setIdentityKey', () => {
        // Don't accidentally remove the violation log — it's the canary for
        // the next species that gets onboarded without a validValues entry.
        // Confirms the b35fix366/b35fix389 pattern can still be detected.
        expect(identitySrc).toMatch(/TIER 0 VIOLATION:.*required but/);
    });

    test('Cotula bypass branch still exists', () => {
        // The bypass at line 411 is the workaround that masks the TIER 0
        // VIOLATION (rescues _identityState.quality.tier0Valid). After
        // b35fix389 the VIOLATION shouldn't fire any more — but the bypass
        // logic stays in place because grass-engine suppression for cotula
        // is still the correct downstream behaviour (cotula isn't a grass).
        expect(identitySrc).toMatch(/Cotula dicot bypass/);
        expect(identitySrc).toMatch(/_isCotulaSurface/);
    });

    test('extractSpeciesKey fast-path returns cotula when surface markers set', () => {
        // The fast-path at line 522-525 reads turf.cotula / turf.speciesKey /
        // turf.surfaceType / turf.turfType — exactly the four state slots
        // b35fix388 makes durable. This test pins the contract from the
        // identity-enforcement side. If the fast-path is ever reordered or
        // removed, this fails before the cotula sites do.
        expect(identitySrc).toMatch(
            /turf\.cotula\s*===\s*true[\s\S]{0,400}turf\.surfaceType\s*===\s*['"]cotula_bowling_green['"]/
        );
        expect(identitySrc).toMatch(/return\s+['"]cotula['"]/);
    });
});

describe('b35fix389 — speciesKey validValues parity with SpeciesController canonical output', () => {
    // The wider asymmetry between IDENTITY_KEYS.speciesKey.validValues and the
    // canonical species names SpeciesController.normalize() can emit is
    // flagged in the b35fix366 inline comment as "a known fragility (any new
    // species addition must touch both files)." This describe block holds the
    // assertions that pin the parity for the species we know SpeciesController
    // can emit. New species additions need a new line here.
    //
    // The behavioural test that would round-trip a cotula turf input through
    // setIdentityKey and assert {valid:true} would be stronger, but
    // identity-enforcement.js references `document.readyState` at module
    // scope, which forces a jsdom environment. Not justified for a
    // one-array-entry fix; production log verification on the next NZ Cotula
    // BC run is the behavioural signal — the four pre-fix log lines (TIER 0
    // VIOLATION + bypass + unknownIntent + wear engine block) should clear
    // once b35fix388 + b35fix389 land together.

    let identitySrc;

    beforeAll(() => {
        identitySrc = fs.readFileSync(
            path.join(__dirname, '../assets/identity-enforcement.js'),
            'utf8'
        );
    });

    test('canonical species emitted by SpeciesController are all in validValues', () => {
        // Extract the validValues block once (same anchoring as the test
        // above) and check each canonical name. If SpeciesController grows a
        // new canonical emit, add it to BOTH this list AND the validValues
        // array — the parity test will fail otherwise, which is the desired
        // signal.
        const block = identitySrc.match(
            /speciesKey:\s*\{[\s\S]*?validValues:\s*\[([\s\S]*?)\],\s*unknownValue/
        );
        expect(block).toBeTruthy();
        // Strip line comments — see explanation in the cotula entry test
        // above. Without this, b35fix366's and b35fix389's inline comments
        // can satisfy a token check even if the array entry itself is gone.
        const codeOnly = block[1].replace(/\/\/[^\n]*/g, '');

        const canonicalEmits = [
            'bentgrass',
            'seashore_paspalum',  // b35fix366
            'cotula',              // b35fix389
        ];

        for (const name of canonicalEmits) {
            const re = new RegExp(`(^|,|\\s)\\s*['\"]${name}['\"]\\s*(,|$)`, 'm');
            expect(codeOnly).toMatch(re);
        }
    });
});

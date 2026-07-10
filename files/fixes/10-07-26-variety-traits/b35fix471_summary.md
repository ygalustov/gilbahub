# b35fix471 — NZ variety fabricated-trait removal

## What this does
Neutralises every fabricated numeric trait on the varieties selectable at a New Zealand site, so the hub presents actual (trial-backed) traits or nothing, never invented ones. Scope is the 86 NZ-visible varieties (the real allocation set from `variety-traits-integration.js` NZ marker filter plus the browntop UK-getter override), not the 17 nz-tagged records.

- Files touched: `assets/gilba-variety-traits.js`, `assets/gssh-variety-traits.js`, `assets/uk-variety-traits.js`
- Leaf edits: 82 across 25 varieties
- Each fabricated leaf: modifier set to neutral (1.0 / wearRating null), `confidence: 'none'` (silences the card via the renderer's `confidence !== 'none'` gate), source replaced with an honest no-data string. Descriptive `notes` left intact.

## Rule applied
A numeric trait leaf is fabricated when either:
1. it is a **wear** leaf cited to a BSPB greens/lawn metric (Table G1, Mean, "overall disease resistance", Table L) — those tables have **no wear column**, so any wear value attributed to them is invented; or
2. its source is **marketing / breeder / specification narrative** with no genuine trial reference (kept tokens: NTEP, NZSTI, GEVES, STRI, QSAC, TU0, trial entry #, Table 1/2, Iowa, locations).

Anything citing a named trial was left untouched.

## Varieties corrected (25)
Arrowtown (cold, drought, wear), Egmont (wear), Manor (cold, wear), Sefton (cold, wear), Barking (microdochium), Kenda (wear), Spartacus (crownRust, grayLeafSpot, wear), Verve (crownRust, grayLeafSpot, wear), Rebel IV (drought, shade, wear), Macdonald (anthracnose, brownPatch, dollarSpot, pinkSnowMould), Baron (leafSpot, wear), Iron Cutter (dollarSpot), Centurion, Colosseum, Fiesta Cinqo, Reliant II, Rio Vista, Soprano, Sox Fan, SR 4600, SR 4600ST (crownRust/grayLeafSpot/etc.), Titanium G-LS (grayLeafSpot), Barolympic (wear), Barorlando (wear), 4turf Tetradark (crownRust, fusarium, grayLeafSpot, redThread).

## Verification
- `node --check` passes on all three patched files.
- Post-patch rescan: 0 fabricated leaves remain across the NZ-visible set in all three files.
- `patch -p1 --dry-run` applies cleanly to a fresh checkout.

## How to apply (least work first)
- **Patch:** `patch -p1 < b35fix471_nz_fabrication_fix.patch` from the plugin root. 56 hunks, data-only.
- **Or drop-in:** the three corrected `*-variety-traits.js` files, if the SaaS copies of these files match this baseline.

## Caveats
- These are data files that copy directly to SaaS, so this is the migration artifact; no engine or renderer code changes. Disease `riskMultiplier` values going neutral **does** change disease-model output for the affected varieties, toward the unmodified default. That is the correct, defensible state, not a regression.
- The patch old-context is keyed to b470 text. If a SaaS record differs (froze at b395), that hunk needs manual apply by cultivar key; the change is always the same: neutralise the modifier, set `confidence:'none'`, honest source.
- Not touched, flagged for a separate judgment pass: (a) descriptive `notes` strings still carry marketing phrasing on some now-silent cards; (b) disease values attributed to a BSPB rating that BSPB may not actually measure (e.g. "overall disease resistance 5.8/9" — G1 reports red thread, not a general disease score). The rule spares anything citing BSPB; confirming those against the actual booklet columns is manual.
- Real trait data cannot be manufactured where no trial exists; fabricated values become no-data, they are not replaced with correct numbers.

# Handoff: route 8-day forecast brown patch through the validated model

Target environment: SaaS (server-side capable), file also runs in the WordPress plugin. The change must be environment-agnostic.

## Problem
The 8-day disease-forecast brown patch series is computed by a legacy heuristic, `calcBrownPatchDaily` (`disease-forecast.js:237`), not the validated Fidanza E2 model used for current conditions (`BrownPatchModel`, `disease-engine-pure.js`). In the heuristic the humidity term carries a fixed 0.35 weight with no temperature co-gate, so a cold humid day (min 7C, RH 92%) floors at ~35% and the nitrogen modifier lifts it to ~45%, although brown patch (Rhizoctonia solani) is temperature-impossible at that point. The validated model returns ~4% for the same inputs. The two paths disagree by roughly an order of magnitude for the same site and day.

## Goal
The forecast brown patch series is computed per day by the same validated model as current conditions, so the two paths converge. Retire the heuristic math.

## Success criteria
1. Forecast day 0 equals the current-conditions brown patch value for identical inputs.
2. A 7 to 10C, RH 85 to 95% week reads sub-threshold (single digits to low teens), not 35 to 45%.
3. A 24 to 28C, high-RH week reads high (>67% band).
4. The model reach resolves with `window` undefined (server-side safe).

## Files
- Edit: `disease-forecast.js` (retire the heuristic, call the model per day).
- Do not edit: `disease-engine-pure.js`. `BrownPatchModel` is already exported and the brown patch code path is pure (no `window`/`document` reads in lines 1132 to 1700). Reuse it.

## Reach (SaaS-shaped, no bespoke window handle)
`BrownPatchModel` is already exported as `DiseaseEnginePure.models.brownPatch` (`disease-engine-pure.js:5454`; `module.exports = DiseaseEnginePure` at 5493). Reach it via a dual-mode accessor:
- Node / SaaS: the module export, e.g. `require('./disease-engine-pure').models.brownPatch`. This is the SaaS-critical path and must work with `window` undefined.
- Plugin / browser: the existing `DiseaseEnginePure` browser-global exposure from the export shim at the foot of `disease-engine-pure.js`. Confirm its global name from that shim and reuse it.

Do NOT add `window.GAIP_BrownPatchModel`. A new window global breaks server-side and moves against the pure-logic-versus-browser-globals migration. Mirror the existing `typeof window !== 'undefined'` guard pattern (see `disease-forecast.js:801`) for the dual-mode resolve.

## Work
1. In `disease-forecast.js`, resolve `BrownPatchModel` through the dual-mode accessor above.
2. Per forecast day, adapt the flat `dayClimate` to the shape the model reads:
   - `temperature.min` from `dayClimate.min`
   - `moisture.humidity.mean` from `dayClimate.humidity`
   Confirm `dayClimate.humidity` is a daily mean; the model expects the 24h mean ending 0600h. `DiseaseEnginePure.utils.get5DayMeanRH` is exposed if you want the paper-faithful mean instead of the forecast field.
3. Wrap nitrogen as `{ status: <n> }` (the shape `.calculate` expects). Pass per-day dew / leaf wetness if the forecast has it; otherwise the model's degraded path covers missing wetness.
4. Call `brownPatch.calculate(adaptedClimate, { status }, variety, dew)` and use `result.riskScore` as the day's series value.
5. Repoint the `brownPatch` entry in the daily-disease table (`disease-forecast.js:613`) to the new model-backed daily function, and remove the old heuristic body. Do not delete the registration itself; that would drop brown patch from the chart.

## Decisions to make explicit (do not inherit silently)
- Persistence amplifier: `CONSECUTIVE_DAY_DISEASES.brownPatch` (`disease-forecast.js:128`; threshold 15, maxMultiplier 1.25) currently multiplies the daily value. Recommend dropping the brownPatch entry, since it is an unvalidated multiplier on a published model. If kept, justify.
- Cancel rule: the forecast has per-day min temp, so the published 15C cancel rule (computed in the model but never applied) can be wired here. Optional; log if deferred.

## Verify
- Regression test: a synthetic cold-humid week asserts <15%; a warm-humid week asserts >60%; day 0 parity against `brownPatch.calculate` on the same input.
- Run the reach in a plain Node context (no jsdom) to prove `window`-undefined safety. This is the check that distinguishes a SaaS-safe change from a plugin-only one.
- `node --check` on the edited file; full test suite; migration ledger plus CHANGELOG plus version stamp; em-dash sweep.

## Out of scope (log as separate entries, do not fold in)
- `calcPythiumDaily` and the sibling daily functions share the same unconditional-humidity structure and likely the same cold-humid false floor.
- `disease-forecast.js`'s own window coupling (`window.GAIP_STATE` at 801/803, `window.GAIP_RedThreadModel` at 599, `window.GAIP_SHADE_RESULT` at 910, `window.GAIP_CANONICAL_STATE` at 937) is a latent server-side break already on the pure-logic migration list. This change must not add to it.

## Sources
All from the b470 build. `disease-forecast.js`: 128 (persistence config), 232 to 284 (`calcBrownPatchDaily`), 599/801/910/937 (window coupling), 613 (daily-disease registration). `disease-engine-pure.js`: 1132 to 1700 (Fidanza E2 and brown patch purity), 5454 and 5493 (export surface), `utils.get5DayMeanRH`. E2 and heuristic arithmetic computed from those formulae, not a fetched source.

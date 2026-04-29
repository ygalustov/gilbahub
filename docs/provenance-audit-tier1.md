# Provenance Audit — Tier 1

**Build:** b35fix335 (v11.8.0)
**Date:** 2026-04-26
**Scope:** Three highest-priority citations in the GAIP Hub science layer.
**Trigger:** b35fix333 surfaced a fabricated "Throssell et al. 2009" SLAN-ranges citation. That discovery prompted a proactive sweep of other citations in the codebase before client trials begin.

---

## Executive summary

Three citations were audited at Tier 1. All three required correction. Findings:

| # | Citation | Verdict | Class |
|---|----------|---------|-------|
| 1 | Sawannarut et al. 2024 | **Fabricated** | Paper does not exist |
| 2 | Smith-Kerns 2018 | **Algorithm misattribution** | Citation real, equation in code is not from the paper |
| 3 | Suarez 1981 | **Equation wrong, citation real** | Function ignored a key input the published procedure depends on |

Two new failure modes are now confirmed in the codebase (in addition to the fabrication mode caught by b35fix333):

- **Algorithm misattribution.** Two files claimed Smith-Kerns 2018 but neither implemented the published equation. Earlier audits that grep-checked citation strings would have flagged neither — the citation strings were correct, only the math was wrong.
- **Partial implementation of a real procedure.** The Suarez SARadj function used a real-sounding empirical formula that did not appear in Suarez 1981 and silently ignored ECw, which the published procedure tabulates against. Like the SLAN ranges in b35fix333, the function compiled, ran, returned plausible numbers, and had a real citation attached.

All three fixes deploy together. Test suite is 1295/1295 (baseline 1157 + 138 new assertions). No commercial trials were affected — these were caught pre-launch.

---

## Methodology

The procedure used in this audit, now established as the standard for any future Gilba Solutions provenance work:

1. **Verify the citation exists.** Resolve the DOI directly. Check journal volume and pages. If the publication does not resolve, the citation is fabricated regardless of how plausible it sounds.
2. **Verify the published source matches the encoded values.** Read the paper. If the paper does not contain the equation, table, or threshold being attributed to it, the attribution is wrong even if the citation is real.
3. **Verify the implementation matches the published source.** Run the encoded math against the paper's worked examples or tabulated values. If results disagree, the implementation is wrong even if both citation and source are real.
4. **Grep both by citation name AND by encoded numerical values.** The b35fix333a discovery — that grep-by-citation-name missed inline tables — established this rule. Audits also need to grep for the actual numbers (range floors, ceilings, coefficients) to catch sites that don't name the methodology.

Each fix in this build was verified against published reference points before deployment. Test files capture those reference points so future regressions get caught.

---

## Finding 1: Sawannarut et al. 2024 — fabricated

### Claim under audit

`citation-registry.js` carried an entry `sawannarut_2024` describing:

> Sawannarut, A., Srilaong, V. & Kasemsap, P. (2024). Sinusoidal light ramping reduces photooxidative stress and improves photosynthetic efficiency in turfgrass under LED supplemental lighting. *Scientia Horticulturae* 325, 112634. DOI 10.1016/j.scienta.2024.112634

This citation was used in `eue-integration-bridge.js` to support the GSSH sessionProtocol advisory recommending a 20–30 minute ramp-up and ramp-down for stadium LED grow-light sessions.

### Verification

DOI 10.1016/j.scienta.2024.112634 does not resolve. *Scientia Horticulturae* volume 325 article 112634 does not exist. No "Sawannarut, Srilaong & Kasemsap 2024" paper on turfgrass under LED lighting can be found in any indexing database.

The closest real publications that cover the underlying mechanism are:

- **Stamford, J.D., Hofmann, T.A. & Lawson, T. (2024).** Sinusoidal LED light recipes can improve rocket edible biomass and reduce electricity costs in indoor growth environments. *Front. Plant Sci.* 15:1447368. DOI 10.3389/fpls.2024.1447368. Tests sinusoidal photoperiod regimes against square-wave delivery on rocket (*Eruca sativa*) in a CEA setting. Does not specify a session-onset/offset ramp duration.
- **Lawson, T. & Vialet-Chabrand, S. (2019).** Speedy stomata, photosynthesis and plant water use efficiency. *New Phytol.* 221(1):93–98. DOI 10.1111/nph.15330. Establishes the directional claim that stomatal opening kinetics are slower than rapid changes in light intensity.

The fabricated `sawannarut_2024` entry appears to have originated in an LLM session in the b35fix94 era (March 2026), which conflated Sawannarut et al. 2023 (which is cited *within* Stamford 2024 on a different topic — afternoon photosynthetic-induction decline) with the publication year of the parent paper, then invented a turfgrass framing that fit the GSSH context.

### Action

`citation-registry.js`:
- Deleted `sawannarut_2024` entry.
- Added `stamford_2024` (verified DOI) with explicit scope note: paper is on rocket, not turfgrass; does not establish a specific session-onset/offset duration.
- Added `lawson_vialet_chabrand_2019` for stomatal-kinetics directional support.
- Audit-trail comment in code records why the entry was replaced.

`eue-integration-bridge.js` `sessionProtocol` advisory:
- Inline citation rewritten. Cites Stamford 2024 + Lawson 2019 as directional support only.
- 20–30 minute ramp duration explicitly labelled a Gilba practitioner heuristic.
- New `rampDurationProvenance` field on output object exposes the heuristic-vs-published distinction to downstream consumers.

### Verification post-fix

`tests/sawannarut-citation-corrected.test.js` — 21 assertions. Checks that the fabricated entry, DOI, and inline citation are removed from live data (with audit-trail comments allowed); that the verified replacements are present with correct DOIs; that the practitioner-heuristic labelling is in place.

---

## Finding 2: Smith-Kerns 2018 — algorithm misattribution

### Claim under audit

Two files claimed to implement Smith-Kerns 2018 dollar spot:

- `disease-engine-pure.js` `DollarSpotModel.calculate()` — production path, labelled `source: 'Smith-Kerns 2018'`.
- `assets/smith-kerns-model.js` — standalone module, version 1.0.0, header comment "True implementation of Smith et al. (2018) PLOS ONE."

### Verification

The published model is:

> **Smith, D.L., Kerns, J.P., Walker, N.R., Payne, A.R., Horvath, B., Inguagiato, J.C., Kaminski, J.E., Tomaso-Peterson, M., & Koch, P.L. (2018).** Development and validation of a weather-based warning system to advise fungicide application to control dollar spot on turfgrass. *PLOS ONE* 13(3): e0194216. DOI 10.1371/journal.pone.0194216

The model is a logistic regression:

```
logit(μ) = −11.4041 + 0.0894·MEANRH + 0.1932·MEANAT
μ        = 1 / (1 + exp(−logit(μ)))
```

where MEANRH is the 5-day rolling mean relative humidity (%), MEANAT is the 5-day rolling mean air temperature (°C), and μ is the daily probability of dollar spot occurrence. The published action threshold is μ ≥ 20%.

What was actually in the codebase:

- **`disease-engine-pure.js` (production):** counted "favourable hours" — hourly observations where RH ≥ 90% AND temp 15–30°C, restricted to daytime (06:00–20:00). Normalised against a threshold of 8 hours/day. Combined with a Gaussian temperature factor centred at 22°C and a leaf-wetness factor in a weighted sum: `(0.35·tempFactor + 0.35·humFactor + 0.30·wetFactor) × nMod × shadeMod × 100`. None of the components, the weights, the daytime restriction, or the 8-hour threshold appear in Smith et al. 2018.

- **`smith-kerns-model.js` (standalone):** Gaussian temperature curve centred at 25°C, RH ≥ 65% threshold, scaled by an arbitrary factor of 150. None of these constants appear in the paper.

In addition, the author list in `smith-kerns-model.js` v1.0.0 was incomplete and contained at least one fictitious co-author. The correct author list is given above.

The standalone `smith-kerns-model.js` is enqueued by the plugin but its globals (`window.SmithKernsModel`, `window.DollarSpotModelV2`) are not consumed by any other module — verified by grep across the codebase. The production dollar-spot calculation lives entirely in `disease-engine-pure.js`. Both files were nevertheless rewritten in lockstep so any future wiring picks up the correct model.

### Action

**`disease-engine-pure.js`:**
- Deleted `getSmithKernsConcurrentHours()` function and the favourable-hours scaffolding it supported.
- Added `get5DayMeanRH(climate)` helper averaging the most recent 120 hours of `climate.hourlyData.relative_humidity_2m`, with `climate.moisture.humidity.mean` as fallback.
- Added `getSmithKerns2018Probability(climate)` implementing the published logistic equation. Returns `null` when inputs are unavailable; the consumer is expected to flag a degraded-data path.
- Added `smithKernsProbToFactor(probability)` adapter for the few internal sites that still consume a 0–1 favourability factor; explicitly labelled as a Gilba presentation choice rather than part of the published model.
- Rewrote `DollarSpotModel.calculate()`. The Smith-Kerns 2018 probability is now the headline number. Gilba site modifiers (leaf wetness, N status, shade) are layered as multiplicative tapers, capped, and explicitly distinguished from the published model in the drivers object. The variety modifier remains intentionally unapplied at this stage — it is layered downstream via `taperMultiplier()` in `analyse()`, preserving the existing architectural rule.
- Result object exposes `smithKernsProbability`, `smithKernsActionThreshold: 20`, and a `degraded` flag separately from the headline `riskScore`. Reports can therefore apply the published 20% action threshold directly to the published-equation output.
- Diagnostic console.group rewritten to label each row "(SK 2018 input)" or "(Gilba modifier)".
- Source string now reads `Smith-Kerns 2018 logistic regression (PLOS ONE 13(3):e0194216) + Gilba site modifiers` — honest disclosure of both layers.

**`smith-kerns-model.js`:**
- Full rewrite, version 2.0.0. Pre-fix file (655 lines) replaced with a cleaner ~280-line implementation that exposes the actual logistic equation.
- New surface: `SmithKernsModel.{COEFFICIENTS, ACTION_THRESHOLD, ROLLING_DAYS, probability, calculate, classifyRisk, fiveDayMeanRH, fiveDayMeanTemp}`.
- `DollarSpotModelV2` compatibility wrapper preserved with the same export name; now delegates to the real model.
- Author list corrected to match the published paper.
- Hempfling et al. 2021 (*Crop Sci.* 61:3149-3162) cited as the cultivar-tolerance follow-up that informs threshold adjustment on resistant bentgrasses.

**Comment updates in four other files** that referred to the retired function name in historical-bug context (`gaip-field-log-analysis.js:328`, `disease-integration.js:787`, `disease-forecast.js:868`, `disease-forecast.js:1398`) — pointed forward to the new function names while preserving the bug-history context that explained why the original references were there.

### Behavioural impact

Every dollar-spot risk score in production will produce a different number. The headline now comes from a published equation rather than an unrelated favourable-hours score. Direction and magnitude depend on site:

- High humidity + warm sites (typical Australian coastal summer) — the Smith-Kerns probability will frequently exceed the 20% action threshold. The Gilba-layered final score is in similar territory to pre-fix output but driven by a different mechanism.
- Cool, dry sites (Bowral winter, NZ South Island) — Smith-Kerns probability collapses to near zero. The Gilba layer cannot rescue the score, so dollar-spot risk reads near zero in these conditions where pre-fix output sometimes still showed moderate scores from leaf wetness alone.
- Probability is monotonic in both MEANRH and MEANAT, as required by the equation.

The published 20% action threshold, exposed as `smithKernsActionThreshold` on the result object, can now be applied directly. Hempfling et al. 2021 is referenced in the result for context on cultivar-tolerance threshold adjustment.

### Verification post-fix

`tests/smith-kerns-2018-logistic.test.js` — 78 assertions, broken across 28 test groups. Highlights:

- 12 reference probabilities computed directly from the published coefficients are reproduced by both file implementations within 0.01%.
- Action-threshold sentinel: `actionRequired` flag fires correctly above and below μ = 20%.
- Monotonicity in RH at fixed temp and in temp at fixed RH.
- Degraded path: `null` returned when SK inputs are missing; `degraded: true` flag set on the result.
- Architecture preservation: variety modifier remains unapplied in `calculate()` (still layered in `analyse()` via `taperMultiplier`).
- DOI cross-reference: both files cite `10.1371/journal.pone.0194216`.
- Author-list test: result metadata contains at least three lead authors plus at least one of the additional co-authors from the actual paper.

---

## Finding 3: Suarez 1981 — equation wrong, citation real

### Claim under audit

`water-blender.js` `calcSuarezSARadj` (v1.1.0) computed an adjusted SAR using:

```
Cax = Ca × 1 / (1 + 0.15 × (HCO3/Ca − 1)^1.5)
```

with a citation to Suarez DL (1981) SSSAJ 45:469–475.

### Verification

Suarez 1981 is a real publication and is the canonical source for the adjusted RNa procedure. The procedure was operationalised for field use in:

> **Ayers, R.S. & Westcot, D.W. (1985).** Water quality for agriculture. *FAO Irrigation & Drainage Paper 29 Rev. 1*, Table 11.

The procedure tabulates Cax (calcium expected to remain in solution at near-surface soil-water equilibrium) against **both** HCO3/Ca ratio (rows) and ECw (columns). The published Table 11 grid is 27 rows × 12 columns of Cax values. ECw shifts Cax by approximately 1.5–2× across the practical 0.1–8 dS/m range at any fixed HCO3/Ca ratio — ECw is not an optional refinement, it is half the procedure.

The pre-fix empirical formula `Cax = Ca × 1/(1 + 0.15 × (HCO3/Ca − 1)^1.5)`:

- Does not appear in Suarez 1981 or in FAO 29.
- Has no ECw dependence, so it produces identical Cax for fresh water (ECw = 0.1 dS/m) and saline water (ECw = 8.0 dS/m) at any given HCO3/Ca ratio. Real Cax differs by ~50% across that ECw range.
- Returns approximately correct numbers on freshwater HCO3-stressed sources by coincidence — the formula was tuned to fit a few common cases — but produces meaningfully wrong answers on saline-alkali waters where ECw dependence dominates.

### Action

`water-blender.js`:
- Added `FAO29_TABLE11_HCO3_CA` (27 row labels), `FAO29_TABLE11_ECW` (12 column labels), and `FAO29_TABLE11_CAX` (27 × 12 grid). All values transcribed verbatim from FAO 29 Rev. 1 Table 11.
- Added `lookupCaxFAO29(hco3CaRatio, ecw_dSm)` performing bilinear interpolation between grid points, with edge-clamping for inputs outside the published range.
- Rewrote `calcSuarezSARadj(Ca, Mg, Na, HCO3, ECw_dSm)`. New signature takes ECw as a fifth parameter. Returns `{ adjSAR, basicSAR, Cax, HCO3_Ca_ratio, ECw, adjustment, method, citation, ecwMissing }`. The pre-fix empirical formula is deleted.
- Updated legacy wrapper `calcSARadj(SAR, EC_dSm, HCO3, Ca, Mg, Na)` to forward `EC_dSm` to the lookup. Pre-fix the wrapper accepted EC_dSm but discarded it because the empirical formula didn't use it.
- Updated the internal call site in `computeBlend` to pass `blended.EC_dSm`.
- File header bumped to v1.2.0 with audit-trail comment.

### Behavioural impact

Adjusted SAR values shift on every water-quality report:

- Freshwater (ECw < 1 dS/m) with low-to-moderate HCO3/Ca: shifts under 10%. The pre-fix formula was tuned to roughly match this case.
- Brackish water (ECw 1–4 dS/m) with elevated HCO3/Ca: shifts of 10–25%.
- Saline-alkali water (ECw > 4 dS/m, HCO3/Ca > 2): shifts of 30%+. ECw materially elevates Cax, reducing the adjustment factor.

The `ecwMissing` flag now fires on the result object when the caller omits ECw, defaulting to a 0.5 dS/m fallback. Reports that produce adjusted SAR without ECw available should expose this caveat to the reader.

### Verification post-fix

`tests/suarez-fao29-adj-rna.test.js` — 39 assertions. Highlights:

- FAO 29 Example 6 (Ca = 2.32, Mg = 1.44, Na = 7.73, HCO3 = 3.66, ECw = 1.15 dS/m) reproduces in the published neighbourhood. The bilinear interpolation gives Cax ≈ 1.55 me/l vs FAO's nearest-row reading of 1.43 — interpolation is a strict improvement on the published nearest-row method.
- Direct grid points: HCO3/Ca = 0.50/1.00/2.00/5.00 at ECw = 1.0/1.0/2.0/4.0 reproduce the published Cax values exactly.
- ECw-matters sentinel: at fixed HCO3/Ca = 1.0, Cax shifts from 1.79 (ECw = 0.1) to 2.71 (ECw = 8.0). Sentinel rejects any future regression to ECw-blind behaviour.
- Edge clamping: HCO3/Ca = 50 (above grid max of 30) clamps to the 30-row Cax = 0.21 at ECw = 1.0.
- `ecwMissing` flag fires when ECw is omitted; result defaults to 0.5 dS/m.
- Citation string contains both Suarez 1981 and FAO 29.

---

## Lessons reinforced

The b35fix333 discovery established one failure mode: **citation fabrication**. b35fix335 confirms two more, both subtler:

**Algorithm misattribution.** A real citation attached to a different equation. The Smith-Kerns case ran in production for many builds before the audit caught it because everything checked out at the surface — the citation was genuine, the file name matched, and the result objects had plausible shapes. The function was wrong.

**Partial implementation of a real procedure.** The Suarez case ran an empirical formula that resembled what the published procedure does but silently dropped the ECw input that the procedure depends on. The function name was correct, the citation was correct, the output shape was correct, the only thing wrong was the math.

The audit methodology established at the top of this document is the response: every numeric piece of science in the codebase needs to be checked for citation existence, citation–source match, and source–implementation match. Grep by both citation name and encoded numerical values. Reproduce a published reference point in a test.

For consistency with the b35fix333a lesson recorded in the gaip-hub skill: future provenance audits cannot rely on grep-by-citation-name alone. Inline tables, hardcoded constants, and arbitrarily-shaped equations need to be checked against their source publications by running a published reference point through the code.

---

## Tier 2 audit candidate list

The following encoded science needs the same Tier 1 treatment before client trials begin or in the next provenance sweep:

| Candidate | Rationale | File(s) |
|-----------|-----------|---------|
| Anthracnose model (Danneberger et al. 1984) | Re-implemented in disease-engine-pure.js and validated against the disease-engine integration tests, but the encoded thresholds and severity coefficients have not been verified against the published paper. Risk class: algorithm misattribution. | `disease-engine-pure.js` `AnthracnoseModel` |
| Brown Patch / Waitea circinata models | Multiple input thresholds (RH ≥ 95% gating, night-temp 20°C floor) are attributed to "Fidanza & Dernoeden 1995" but have not been verified against the original publication. Risk class: partial implementation. | `disease-engine-pure.js` `BrownPatchModel`, `WaiteaPatchModel` |
| Growth Potential Engine (Kreuser plateau model) | The plateau model and base-temperature constants (C3 0°C, C4 10°C per Kreuser/Reasor) are widely used internally but have not been audited against the source. Risk class: partial implementation. | `growth-potential-engine.js` |
| FAO-56 Irrigation Scheduler | Reference ET equation (Penman-Monteith) is well documented; risk concentrated in the crop-coefficient table and the soil-water-balance reset thresholds. | `irrigation-scheduler.js`, FAO-56 reference text |
| Mehlich / AA conversions | Hill Labs conversion factors between Mehlich-3 and ammonium acetate are encoded inline. Source verification needed. | `gaip-classification-constants.js`, `nutrition-requirement-engine.js` |
| PGR / DMI growth-suppression model | Trinexapac-ethyl GDD model attributed to Kreuser & Soldat 2011 — citation is real. Magnitude of suppression coefficients should be checked against the paper. | `dmi-growth-suppression.js` |
| Smith-Kerns warm-season caveat language | Already in place in `disease-integration.js` but the specific threshold above which "warm-season indicative only" fires deserves a published source or explicit Gilba-heuristic label. | `disease-integration.js:2216` |
| **Climate-engine humidity default** | Production log gilbasolutions.com 2026-04-26 (v11.8.2) showed 21 of 26 sites with `MEANRH = 50.00` exactly — a literal default firing somewhere upstream of the disease engine when no real humidity data is supplied. Smith-Kerns then computes the correct probability for the 50% input (~3% never crosses the 20% action threshold) but the input itself is wrong. Risk class: silent fallback masking missing data. | `hub-orchestrator.js` `buildClimateFromManual` (humidity default 60), `hub-tissue-v3.js:793` (humidity default 50), other potential upstream paths |

Tier 2 should be triggered on the next provenance sweep, on any defect raised during pre-launch field trials, or before the first commercial client engagement — whichever comes first.

---

## b35fix335a — production fallback regression

Deploying b35fix335 to gilbasolutions.com on 2026-04-26 revealed a separate defect: 24 of 24 dollar-spot site invocations hit the degraded fallback path. The browser console showed `SK 2018 probability: n/a (degraded)` on every site, meaning the published logistic equation was never actually running in production — the engine was always falling back to the temp-only Gilba estimator.

Root cause: `getSmithKerns2018Probability` called `get5DayAvgTemp(climate.temperature.dailyPattern)` with no fallback. `climate.temperature.dailyPattern` is only populated in multi-day-forecast contexts; on most production paths the climate object carries `temperature.max`, `temperature.min`, and `temperature.mean` but not `dailyPattern`. The function therefore returned null on essentially every real site, even when valid temperature data was available.

Net effect: every dollar-spot risk score in production was actually the Gilba temp-only fallback, NOT the Smith-Kerns 2018 logistic that b35fix335 was supposed to ship.

Fix: the temp resolution chain now falls back through `dailyPattern → (max+min)/2 → temperature.mean`. `dailyPattern` remains preferred when available; the max/min average is the next-best proxy for diurnal-typical conditions (which is what the SK 2018 calibration was based on); period-mean is last-resort. Same chain added to `smith-kerns-model.js` standalone module for parity.

Test additions (12 new assertions in `smith-kerns-2018-logistic.test.js`): (a) SK probability resolves correctly with max/min only — no `dailyPattern`. (b) SK probability resolves with `temperature.mean` only. (c) `dailyPattern` is preferred when both are available. (d) Still returns null when ALL temp inputs are genuinely missing. (e) `DollarSpotModel.calculate` does not collapse to degraded on the production climate shape from gilbasolutions.com. (f) Standalone SK module accepts the same fallback.

Test suite: 1307/1307 (b35fix335 baseline 1295 + 12 b35fix335a regression).

**Lesson for future provenance work.** The b35fix335 test suite verified that `getSmithKerns2018Probability` produced the published reference values when called with hourly arrays and a populated `dailyPattern`. It did not test the production climate shape — `temperature.max/min/mean` without `dailyPattern`. A regression test that replicates the actual production climate object structure would have caught this before deploy. b35fix335a adds that test. Future provenance fixes should include at least one test that replicates the production-typical input shape, not only the rich-data shape.

---

## Action register

- [x] Sawannarut → Stamford 2024 + Lawson 2019; ramp duration labelled practitioner heuristic
- [x] Smith-Kerns logistic regression implemented in disease-engine-pure.js
- [x] Smith-Kerns logistic regression implemented in smith-kerns-model.js
- [x] Suarez SARadj rewritten as FAO 29 Table 11 bilinear lookup
- [x] Tests added (138 new assertions across three files; 1295/1295 passing)
- [x] Plugin version bumped to 11.8.0 with description entry
- [x] gaip-hub skill updated with b35fix335 entry
- [x] Tier 2 candidate list recorded
- [x] **b35fix335a:** production fallback regression — `getSmithKerns2018Probability` falls back through `dailyPattern → max/min average → temperature.mean`. Plugin version bumped to 11.8.1. Test suite 1307/1307.
- [x] **b35fix335b:** diagnostic clarity — production log 2026-04-26 01:22 UTC confirmed 24/26 sites compute SK correctly (production probabilities reproduce the published equation, e.g. MEANRH=70.60, MEANAT=15.85 → 11.61%). Two degraded sites had ambiguous-looking diagnostics because the local `avg5Day` was papered over with `meanTemp || 20`. Diagnostic now reads climate fields directly and tags each value with its data source. Engine math unchanged. v11.8.2.
- [ ] **Upstream humidity default investigation (Tier 2 — not in current build):** 21 of 26 sites in 2026-04-26 production log showed `MEANRH = 50.00` exactly. Likely an upstream literal default firing when humidity data is absent. Find the source (candidates: `hub-orchestrator.js` `buildClimateFromManual`, `hub-tissue-v3.js:793`); decide whether to fail loud or default explicitly with a flag.
- [ ] **Production verification (Jerry, post-b35fix335a deploy):**
  - GSSH session reports: `Sawannarut` should not appear; `Stamford et al. 2024` should appear; `practitioner heuristic` qualifier should appear in advisory text.
  - Dollar-spot risk numbers: browser console diagnostic should now show real probabilities (`SK 2018 probability: XX.XX%`) on the same sites that previously showed `n/a (degraded)`. Probability monotonic in MEANRH and MEANAT. Drivers panel labels: `(SK 2018 input)` vs `(Gilba modifier)`. The `(DEGRADED — SK inputs missing)` annotation should now be RARE — only on sites with literally no temperature data at all.
  - Water-quality reports: `method` field reads `adj RNa via FAO 29 Table 11 (Suarez 1981)`. Adjusted SAR shifts modestly on freshwater, materially on saline-alkali waters. `ecwMissing: true` flagged where ECw is not provided.

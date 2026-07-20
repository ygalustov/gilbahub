# GAIP Hub - SaaS Engineering Handover

## NZ disease-engine sprint + Large Patch consolidation (b35fix492 to b35fix498 / v11.43.0 to v11.48.0)

**To:** SaaS port team
**From:** Jerry Spencer, Gilba Solutions Pty Ltd
**Date:** July 2026
**Status:** All seven builds shipped and verified in production on the WordPress plugin.
**Priority:** HIGH for the NZ rollout. Every defect below exists in your frozen baseline. Section 4 (Smith-Kerns envelope) and section 8 (Large Patch) are correctness defects that change risk numbers; the rest are host-range and honesty corrections that change which diseases fire and what confidence they claim.

Follows the b35fix491 handover (NZ fungicide validator). That was a different module (`nz-fungicides.js`). This sprint is the disease engine.

---

## 0. Why you are getting this document

The port is frozen at **b35fix395**. The plugin is at **b35fix498**. Every correction in this sprint lands in code that exists in your frozen baseline, so if you have ported the disease engine you have ported all of these defects.

Almost all of it is **one file**: `assets/disease-engine-pure.js`. Two builds touch a second file each (b35fix494 also touches `smith-kerns-model.js`; b35fix498 also touches `large-patch-model.js`). The engine is the pure engine (`window.GAIP_DiseaseEnginePure`, active when `GILBA_USE_PURE_DISEASE` is true); the legacy `disease-engine.js` is dead and delegates to it. Port the pure engine only.

**Scope table.**

| Build | Version | Theme | File(s) |
|---|---|---|---|
| b35fix492 | v11.43.0 | browntopBent + fineFescue species rows + routing | `disease-engine-pure.js` |
| b35fix493 | v11.43.1 | gray leaf spot host-range zeros (non-hosts) | `disease-engine-pure.js` |
| b35fix494 | v11.44.0 | Smith-Kerns dollar spot validity-envelope gate | `disease-engine-pure.js`, `smith-kerns-model.js` |
| b35fix495 | v11.45.0 | Fusarium honest provenance + confidence drop | `disease-engine-pure.js` |
| b35fix496 | v11.46.0 | Fusarium moisture: period-mean to wetness duration | `disease-engine-pure.js` |
| b35fix497 | v11.47.0 | Fusarium: retire four unverified modifiers | `disease-engine-pure.js` |
| b35fix498 | v11.48.0 | Large Patch nModifier + susceptibility consolidation | `disease-engine-pure.js`, `large-patch-model.js` |

b35fix492 to b35fix495 are the four-build "NZ pre-launch disease-engine audit" cluster. b35fix496 to b35fix497 are the two-build Fusarium output rework (DISEASE-FUS). b35fix498 is a separate warm-season defect that rode on the end.

---

## 1. Three things that are true across the whole sprint

Read these once; they explain choices in every section below.

**The provenance snapshot is a build gate.** `tools/disease-engine-provenance-snapshot.json` is a machine-checked record of every model's cited provenance, asserted by `tests/provenance-extractor.test.js`. It is regenerated on every build that touches a model. The extractor attributes a documentation banner to a model by the "comments since the last code statement" window: a `const` placed between a banner and its `const ModelName` declaration silently detaches the banner and drops its citations (this bit b35fix495; see section 5). **Port the snapshot and the extractor discipline.** No model coefficient without a cited source.

**`riskLevel` is a shared vocabulary contract, not free text.** `disease-ui.js` maps `gaip-risk-<level>` to CSS and gates expand/suppress behaviour on the standard bands (low/moderate/high/severe). Several builds below deliberately did NOT relabel `riskLevel` even when the honest word would be "conducive" or "not-applicable", because that would break styling and interaction. Confidence, conducive-conditions descriptors, and suppression flags are separate fields. Keep `riskLevel` on the standard vocabulary in the port.

**Suppression has two distinct states.** "Not a documented host" (species susceptibility 0 or gate-suppressed) and "outside the model's validity envelope" (b35fix494) and "insufficient data" (null input) are three different states and are kept distinct on purpose. A `suppressedDiseases[]` entry carries a reason and flags (`envelopeSuppressed`, host-class). Do not collapse them into one "no risk" path.

---

## 2. b35fix492 - browntopBent and fineFescue species rows

**What was wrong.** Two NZ-relevant cool-season species had no `SPECIES_SUSCEPTIBILITY` row and silently resolved to the wrong profile:

- **browntopBent** (colonial/common bent, *Agrostis capillaris*) routed to the creeping-bent (*A. stolonifera*) row through the generic `bent` partial in `normalizeSpecies`. The cultivar layer already keyed NZ browntop cultivars (Arrowtown, Egmont, Sefton) under a `browntopBent` species with deltas written "vs browntop average", so those deltas were sitting on the wrong baseline.
- **fineFescue** (*Festuca rubra* complex): the normaliser produced `fineFescue` and `COOL_SEASON_HOSTS` listed it, but no susceptibility row existed, so a fine fescue site fell back to the perennial ryegrass profile.

**Canonical fix.** Two rows added. browntopBent deltas vs creeping bent: **fusarium 1.2 to 1.4** (Microdochium is the primary browntop greens disease in cool maritime NZ/AU), **takeAll 1.5 to 1.2**, **grayLeafSpot 0.5 to 0** (Agrostis is a documented gray leaf spot non-host). fineFescue composes on the species layer alone (no cultivar layer); grayLeafSpot 0.2 (genuine weak host, Vines et al. 2022). Routing: `normalizeSpecies` gains browntop/colonial/capillaris aliases and a partial match placed **BEFORE** the generic `bent` partial, so "Browntop Bent (Greens)" no longer captures into creeping bent. `COOL_SEASON_HOSTS` gains `browntopBent`.

**Your action.** In your baseline, confirm whether browntop resolves to its own row or to creeping bent, and whether fine fescue has a row or falls through:

```
grep -n "browntopBent\|fineFescue\|colonial\|capillaris" src/**/disease-engine*.js
grep -n "'bent'" src/**/*normalizeSpecies* src/**/disease-engine*.js   # partial-match ordering
```

If the browntop partial is after the generic `bent` partial, or absent, you have the bug. The two-layer composition (species baseline x cultivar delta, then taper) must not double-count: the cultivar `riskMultiplier` is species-relative (1.0 = species-typical).

**Test.** `tests/c63-browntop-finefescue-species-b35fix492.test.js` (9 tests).

---

## 3. b35fix493 - gray leaf spot host-range zeros

**What was wrong.** `SPECIES_SUSCEPTIBILITY.grayLeafSpot` carried plausible-but-wrong nonzero values on three documented non-host cool-season species: creeping bentgrass 0.5, Poa annua 0.3, Kentucky bluegrass 0.6. Gray leaf spot (*Pyricularia oryzae*) does not affect these (Ohio State HYG-3083, Purdue BP-107-W, Kansas State).

**Canonical fix.** Set those three to **0**. The behavioural bite is Kentucky bluegrass: its 0.6 sat **above the 0.5 grayLeafSpot dispatcher gate**, so the engine was running the GLS model and emitting a risk on a non-host. Bentgrass (0.5) and Poa annua (0.3) were already gate-suppressed, so their fix is reason-text only ("not a documented host" instead of "below model gate").

**Your action.**

```
grep -n "grayLeafSpot" src/**/disease-engine*.js
```

Confirm creeping bentgrass, Poa annua, KBG all read `grayLeafSpot: 0`. Any value at or above 0.5 on a cool-season species is a live false positive. Warm-season GLS cells (bermuda, couch, zoysia, buffalo) are a separate non-NZ backlog item; leave them.

**Test.** `tests/c64-gls-nonhost-correction-b35fix493.test.js` (5 tests), includes a perennial ryegrass positive control so GLS still fires on a real host.

---

## 4. b35fix494 - Smith-Kerns dollar spot validity-envelope gate

**This one changes risk numbers. Read it before you port dollar spot.**

**What was wrong.** Smith-Kerns 2018 is a logistic regression: `logit = -11.4041 + 0.0894*MEANRH + 0.1932*MEANAT`. The MEANRH coefficient is positive and the term is unbounded, so on a cool humid day the humidity term alone carries the probability to the 20% fungicide-action threshold when it is far too cold for Clarireedia to be active. Worked case: MEANAT 8 C, MEANRH 95% gives 20.3%, right on the action threshold, on a day with negligible real pressure. Recurring false positive on cool-humid NZ autumn days. Above 35 C the term keeps climbing while true activity falls off.

**Canonical fix.** Smith-Kerns 2018 has a stated effective range: **MEANAT 10 to 35 C** (University of Delaware fact sheet presents the logistic with this envelope; lower bound corroborated by NC State). The dispatcher now gates on it. When MEANAT resolves to a real number outside 10 to 35 C, dollar spot is suppressed like a non-host: no `diseases[]` row, one `suppressedDiseases[]` entry carrying `envelopeSuppressed: true`, the resolved MEANAT, the bounds, and a reason. This is **distinct from the degraded-data path**: a null MEANAT (missing temperature) stays on the degraded path and still produces a low-confidence row, because "outside model scope" and "insufficient data" are different states. The gate reads MEANAT via `resolveMeanAirTempSource`, the exact rung chain `getSmithKerns2018Probability` consumes, so there is no new call-site asymmetry. The outer host-class gate (`susceptibility.dollarSpot > 0`) is unchanged, so a non-host is still suppressed first.

`overallScore` is a `Math.max` over validated diseases, so suppressing a spurious ~20% dollar spot can only lower overall risk on a cold day, never inflate it.

**Two-copy lockstep.** The dormant standalone `smith-kerns-model.js` (not consumed in production, kept in lockstep per its header contract) received the same gate in `calculate()` and `DollarSpotModelV2.calculate()`, returning `probability: null`, `riskLevel: 'not-applicable'`, `outsideValidityEnvelope: true`. **Shipping the gate in only one copy manufactures the exact asymmetry the engine treats as a bug class.** If your port keeps both copies, gate both. If your port drops the dormant copy, note it.

**Your action.**

```
grep -n "0.0894\|0.1932\|11.4041\|getSmithKerns2018Probability\|resolveMeanAirTempSource" src/**/*.js
grep -n "envelopeSuppressed\|outsideValidityEnvelope" src/**/*.js   # expect ABSENT in your baseline
```

If the second grep returns nothing, your baseline has the uncapped model.

**Test.** `tests/dollarspot-validity-envelope-b35fix494.test.js` (20 tests): cold and hot suppression, inclusive 10/35 boundaries, 9.9/35.1 just-outside, null-MEANAT stays degraded, cotula host-class vs envelope distinction, the standalone lockstep.

---

## 5. b35fix495 - Fusarium honest provenance and confidence

**Presentation only. No risk-score math changed. It corrects what the model CLAIMS about itself.**

**What was wrong.** `FusariumModel` is a Gilba weighted-sum: an asymmetric Gaussian temperature response times a moisture ladder times freeze-thaw, snow, diurnal and nitrogen modifiers, combined with Gilba-chosen weights. It is not the model of any single paper. Yet every return stamped `source: 'Smith, Jackson & Woolhouse 1989'` and `confidence: 'high', confidenceScore: 90`, level with the peer-validated Smith-Kerns model. The 1989 textbook informs the envelope and driver directions; it is not the source of the equation, and nine thresholds in the model carried self-flagged UNVERIFIED provenance notes.

**Canonical fix.** Two corrections, each routed through a single named constant so the claims cannot drift apart or from the model:

- `FUSARIUM_MODEL_SOURCE` relabels the source to name the Gilba weighted-sum and credit the 1989 textbook plus CABI 2024 as the basis, not as the equation source.
- `FUSARIUM_MODEL_CONFIDENCE_LEVEL` / `FUSARIUM_MODEL_CONFIDENCE_SCORE` drop confidence to a documented ceiling of **moderate / 60** on both paths where the weighted-sum speaks (computed-risk and too-warm returns). The no-temperature path keeps **low / 20**, because data absence is lower than the model ceiling, not equal to it. Single rule: this unvalidated Gilba model never asserts confidence above the moderate ceiling; data degradation pushes it below.

`riskScore`, the weights, the temperature curve, the 20 C ceiling, every coefficient: unchanged. A cool-wet reference input still scores **76 / high**. Risk level (what the day is) and confidence (how much we trust the number) are now orthogonal fields rather than both reading high.

**Provenance placement trap.** The three constants are defined **above** the doc banner, not between it and `const FusariumModel`, so the banner stays the last contiguous comment block before the declaration. Put a const in that gap and the A2 extractor detaches the banner and drops its citations. Preserve the ordering in the port.

**Your action.**

```
grep -n "Smith, Jackson & Woolhouse 1989\|confidenceScore: 90\|confidence: 'high'" src/**/disease-engine*.js
```

Any Fusarium return claiming source-as-paper or confidence 90 is the pre-fix state.

**Test.** `tests/fusarium-honest-provenance-b35fix495.test.js` (16 tests): honest source on all three paths, moderate/60 on computed and too-warm, low/20 on no-temperature, the ceiling below Smith-Kerns 90, and the 76/0/0 anchors guarding against math drift.

---

## 6. b35fix496 - Fusarium moisture: period-mean to wetness duration (DISEASE-FUS build 1 of 2)

**What was wrong.** FusariumModel scored moisture off `climate.moisture.humidity.mean` (a period mean) on a `humidity > 90 ? 1 : > 80 ? 0.6 : 0.2` ladder. For Microdochium the correct driver is wetness **duration**, not a mean (Mattox et al. 2023: RH at or above 90% for 20+ hours). A cold humid day with brief peaks and one with 20 hours of wetness scored identically.

**Canonical fix.** FusariumModel gains `dewData` as a fourth argument (matching DollarSpot, BrownPatch, Pythium) and the dispatcher passes it. When a real wetness-duration signal exists (dew engine average/total wet hours, or hourly RH-at-or-above-90% hours), `moistureFactor` is derived from the shared `getLeafWetnessHours()` helper using the engine's existing `min(1, hours/10)` convention. **When no wetness signal exists it falls back to the prior period-mean ladder**, so a site without dew or hourly data is behaviourally unchanged (the 76 anchor holds). Same temperature at high wetness scores 100, at low wetness 52. An additive `conduciveConditions` descriptor (temperature-in-band, wetness-sufficient, conducive/marginal/not-conducive) surfaces the honest read without touching `riskLevel`.

The `min(1, hours/10)` saturation is the engine's shared convention, not a Microdochium-validated cutpoint, so confidence stays at the moderate ceiling.

**Your action.** If your baseline Fusarium reads a humidity mean and has no `dewData` argument, port the wetness-duration derivation AND keep the period-mean fallback (do not drop it; no-dew sites depend on it).

```
grep -n "moisture.humidity.mean\|getLeafWetnessHours\|dewData\|conduciveConditions" src/**/disease-engine*.js
```

**Test.** `tests/fusarium-wetness-duration-b35fix496.test.js` (16 tests): dewData wiring, wetness ordering, the fallback preserving 76, the hourly-RH path, conduciveConditions on all three levels.

---

## 7. b35fix497 - Fusarium: retire four unverified modifiers (DISEASE-FUS build 2 of 2)

**This changes scores where a modifier previously fired.**

**What was wrong.** After build 1, FusariumModel still carried four uncalibrated multipliers. All four were Gilba-chosen with no peer-reviewed calibration; two already carried UNVERIFIED provenance notes.

**Canonical fix.** Retire all four, leaving one weighted sum: **`riskScore = (0.40 * tempFactor + 0.60 * moistureFactor) * 100`**. Removed:

1. Freeze-thaw factor (0.7/0.9/1.0 ladder) and its 0.30/0.35/0.25/0.10 combine branch.
2. Diurnal-fluctuation modifier (range 8/10/15 C to 1.08/1.15/1.25).
3. Snow-cover factor (snowDays/10 with 7/14-day notes).
4. Numeric N multiplier (`getFusariumNModifier`). Nitrogen no longer scales the score. The winter-N advisory survives as a **qualitative** flag only: `drivers.nitrogen.winterRisk` plus a note and the dispatcher `nutrientNote`.

At neutral inputs (adequate N, no freeze/snow, diurnal <= 8) every retired modifier was at its identity value, so the anchors are unchanged (cool-wet 76/high, dew-high 100/severe, dew-low 52/moderate). Scores **change** on high/excessive-N cool sites, freeze-thaw days, large-diurnal-swing days, and snow days: those now score on temperature x wetness alone. Intended honesty correction. `drivers` reduced to temperature/moisture/nitrogen. `getFusariumNModifier` and `N_MODIFIERS_FUSARIUM` are **retained (defined + exported, no live caller)** as a frozen audit record pinned by the provenance snapshot. Confidence stays at moderate/60.

`disease-forecast.js` keeps its own independent `calcFusariumDaily` (not a `FusariumModel` consumer, out of scope, do not touch it in the port unless you are consolidating forecast and engine deliberately).

**Your action.**

```
grep -n "freezeThaw\|fluctuationMod\|snowCover\|getFusariumNModifier" src/**/disease-engine*.js
```

In the ported engine these should appear only in the retained-but-uncalled `getFusariumNModifier` audit record, never in the score line.

**Test.** `tests/fusarium-modifier-retirement-b35fix497.test.js` (18 tests): anchor invariance at neutral inputs, N-invariance of riskScore, driver-object absence, the former freeze-thaw day scoring on the clean core.

---

## 8. b35fix498 - Large Patch nModifier and species-susceptibility consolidation

**Warm-season only. NZ cool-season turf is unaffected (every cool-season species carries `largePatch: 0`, so the dispatcher never fires on NZ turf). But it is a real correctness defect and it carries the most important porting trap in this document (section 9).**

**What was wrong.** The large-patch dispatcher discarded the model's fully-computed `result.adjustedRisk` and recomputed its own from `result.riskScore` (= baseRisk) via `taperMultiplier(riskScore, engineSusceptibility x vMod)`. Two coupled defects:

1. **nModifier under-applied.** `large-patch-model.js` applies nitrogen in **two** channels: an additive `nRisk` folded into baseRisk (+20 excessive / +10 high / 0 / -5 low), and a multiplicative `nModifier` (1.35 / 1.2 / 1.0 / 0.9). The engine read `riskScore` (which carries the additive channel) but never the multiplicative `nModifier`, so excessive nitrogen was **under-applied**, the x1.35 was silently lost. This is the subtle one: nitrogen was not absent from the output, so a shallow test would pass. It was under-applied.
2. **Species-susceptibility divergence.** The engine applied its own `SPECIES_SUSCEPTIBILITY.largePatch` column, which diverged from the model's table on three warm-season hosts: zoysia (engine 1.4 vs model 1.3), seashore_paspalum (engine 0.6 vs model 1.4), buffalograss (engine 0.6 vs model 0.9). The engine under-rated seashore paspalum, a genuinely high-susceptibility host, by more than 2x.

**Canonical fix (model-canonical).** The dispatcher now **honours `result.adjustedRisk` directly** (already `baseRisk x susceptibility x variety x nModifier`, clamped [0,100] by the model), with a fallback to `riskScore` for the model's degraded temperature-missing return (which carries no `adjustedRisk` field). The `SPECIES_SUSCEPTIBILITY.largePatch` column is realigned to the model (zoysia 1.3, seashore_paspalum 1.4, buffalograss 0.9); under the fix the column is **gate-only** (host / non-host) plus the displayed `speciesSusceptibility` field. All three canonical values were adjudicated by J. Spencer (15 Jul 2026) and equal the model's values: **the model is the single source of truth.**

**Reference values (grounded fixture: air 24 C, soil 22 C, RH 85%, precip 15 mm, transitional dormancy).** Use these as port test vectors. They are the engine `adjustedRisk` post-fix, which equals the model `adjustedRisk`:

| Species | susc | low N | adequate | high | excessive |
|---|---|---|---|---|---|
| couch | 0.7 | 58 | 68 | 90 | 100 |
| buffalograss | 0.9 | 75 | 88 | 100 | 100 |
| zoysia | 1.3 | saturates 100 across N |||| 
| seashore_paspalum | 1.4 | saturates 100 across N |||| 

couch is the clean N-monotonic discriminator (58 < 68 < 90 < 100). If your ported couch row is flat across N, the multiplicative nModifier is being dropped.

**Your action.**

```
grep -n "taperMultiplier(result.riskScore" src/**/disease-engine*.js   # large-patch block must NOT recompute
grep -n "susceptibility.largePatch\|adjustedRisk" src/**/large-patch*.js src/**/disease-engine*.js
```

Do NOT reintroduce the `taperMultiplier(result.riskScore, susceptibility.largePatch x vMod)` recompute for large patch. `getVarietyModifier('largePatch')` reads the same `variety.disease.largePatch.riskMultiplier` field the model uses, so variety handling is unchanged.

**Test.** `tests/large-patch-nmodifier-consolidation-b35fix498.test.js` (27 tests). The load-bearing one is the **single-source contract**: engine largePatch `adjustedRisk` EQUALS the model's across species x N. That is the guard that stops the recompute coming back.

---

## 9. Porting traps (cross-cutting, read before you touch the engine)

**TRAP 1: `large-patch-model.js` is NOT pure.** Unlike the GP engine, this model reads client globals:

```
window.GAIP_SOIL_TEMP.summary.depths['50mm'].mean   // Priority 1
window.GAIP_SOIL_TEMP.summary.depths['100mm'].mean  // Priority 2
window.GAIP_Sensor.hasData() / getIrrigationData()  // Priority 3
climate.temperature.soil                            // Priority 4 (the passed value)
window.GAIP_STATE.location.country                  // region default
```

On a server, `typeof window === 'undefined'`, so soil temperature drops to Priority 4 (the passed `climate.temperature.soil`) and region defaults to AU. **You must supply soil temperature and region explicitly through the input object; do not rely on the globals.** This is the exact mechanism that made the production verification probe read lower than the fixture predicted: the deployed page's `GAIP_SOIL_TEMP` (a cool site) overrode the passed 22 C. In the port, make soil-temp source an explicit, injected input with the same priority order, or the model silently reads the wrong temperature.

**TRAP 2: do NOT over-apply the b35fix498 fix.** Large patch is the ONLY injected model that returns a fully-computed `adjustedRisk`. The other nine dispatchers (dollar spot, brown patch, pythium, anthracnose, spring dead spot, helminthosporium, drechslera, fusarium, take-all, gray leaf spot) correctly use `taperMultiplier(result.riskScore, ...)` because their models return a climate-only `riskScore` and the engine's species x variety taper IS the single computation. Consolidating those to "honour model adjustedRisk" would break them; there is no model adjustedRisk to honour. (Smith-Kerns returns one `adjustedRisk` field, worth a look, but it is the dollar-spot logistic, not a taper input.) The rule is: honour the model's adjusted value **where the model computes it**; do not manufacture a second computation site elsewhere.

**TRAP 3: two-copy lockstep.** `smith-kerns-model.js` (b35fix494) and, historically, other standalone model files are kept in lockstep with the inline engine copy per header contract. If you carry both copies, apply engine changes to both. If you drop the dormant copies in the port, record that decision so a future reader does not think the engine copy is the only one.

**TRAP 4: `riskLevel` is a shared vocabulary contract** (section 1). Do not relabel it to "conducive" or "not-applicable" text; that breaks `disease-ui` CSS and interaction. Use the separate `conduciveConditions`, `confidence`, and `suppressedDiseases` fields.

**TRAP 5: the provenance snapshot is a gate** (section 1). Regenerate it on every model change and keep the extractor test in CI. Keep model banners as the last contiguous comment block before the `const ModelName` declaration.

**TRAP 6 (shared-helper asymmetry, logged not fixed): `getLeafWetnessHours()`** halves the dew-engine average (a daytime discount) but does NOT halve the hourly-RH count, so the two wetness sources saturate the `min(1, hours/10)` convention at different raw-hour counts. This affects every wetness-driven model (Fusarium after b35fix496, plus DollarSpot/BrownPatch/Pythium). It is open. Resolve it cleanly in the port rather than inheriting the asymmetry.

---

## 10. What this sprint did NOT change

- **Nutrition recommendations.** Untouched. If you diff nutrition output across this arc, expect no change.
- **Warm-season disease outputs other than large patch.** The NZ builds (492 to 497) are cool-season; warm-season disease outputs are unchanged except large patch (498).
- **NZ cool-season large patch.** Every cool-season species carries `largePatch: 0`, so b35fix498 does not fire on NZ turf. If you diff NZ disease output across 498, expect no change; if you diff a warm-season AU site (Rockingham paspalum, couch), expect large-patch risk to move.
- **The temperature curves, weights, and coefficients of Fusarium.** b35fix495 changed only the source and confidence claims; b35fix496 changed only the moisture derivation; b35fix497 removed modifiers but did not retune the surviving temp/wetness core.

---

## 11. Known open items (NOT fixed by this sprint)

Logged in the migration ledger as candidate C-entries C71 to C73 (2026-07-15), same class as the Fusarium honesty rework:

| Item | Status |
|---|---|
| **C71 - DrechsleraPoaeModel badge overclaim** | Open. The "VALIDATED" badge is anchored only to the CABI 2024 temperature curve; the weighted-sum forecaster is unvalidated. Relabel, do not recalibrate. |
| **C72 - LargePatchModel soil-temperature under-weighting** | Open. Soil temp is a 0-30 additive bonus, not a gate, so a cold-soil day can still score on air temp plus dormancy transition. Needs a gate-shape decision. |
| **C73 - LargePatchModel weighted-sum provenance** | Open. The combine weights and point allocations are Gilba-chosen, not calibrated; the VALIDATED badge overclaims. Honest banner + confidence drop, mirror the Fusarium pass. |
| **`getLeafWetnessHours` asymmetry** | Open (Trap 6). Shared across every wetness-driven model. |
| **Large-patch domain edges** | The model's too-warm (>30 C, adjustedRisk 0) and too-cold (<10 C, adjustedRisk `round(5 * susceptibility)`) early returns are preserved. Port them for parity; they are model behaviour, not the b35fix498 change. |

Note on C-numbering: this sprint's `C67` is the Fusarium honesty work (DISEASE-FUS, b35fix495 to b35fix497). Do not confuse it with any earlier reuse of `C67` in older handovers.

---

## 12. Verification standard applied

The bar each build was held to, and the bar the port should match:

- `node --check` clean on every modified JS file.
- New regression suite per build, full suite green with `--no-cache`:

| Build | New tests | Full suite |
|---|---|---|
| b35fix492 | 9 | 2115 / 106 suites |
| b35fix493 | 5 | 2120 / 107 suites |
| b35fix494 | 20 | 2107 / 107 suites |
| b35fix495 | 16 | 2154 / 109 suites |
| b35fix496 | 16 | 2170 / 110 suites |
| b35fix497 | 18 | 2188 / 111 suites |
| b35fix498 | 27 | **2215 / 112 suites** |

- Em-dash delta <= 0 on every modified file.
- Provenance snapshot regenerated and asserted on every model-touching build.
- Live production probe for b35fix498: `analyse()` on a warm-season site, nitrogen swept adequate to excessive, confirms large-patch `adjustedRisk` moves and `speciesSusceptibility` reads the realigned value.

---

## 13. Summary, if you read nothing else

1. **One file** carries almost all of it: `disease-engine-pure.js` (plus `smith-kerns-model.js` for 494, `large-patch-model.js` for 498). Port the pure engine only.
2. **Host-range zeros are real corrections** (492 browntop/fine fescue routing, 493 gray leaf spot non-hosts). A nonzero susceptibility on a documented non-host is a live false positive above the dispatcher gate.
3. **Smith-Kerns must be gated to 10 to 35 C** (494), or it emits ~20% dollar spot on cold humid NZ days. Gate both copies.
4. **Fusarium is an honest weighted-sum now** (495 to 497): relabelled source, moderate/60 confidence, wetness-duration moisture, four uncalibrated modifiers retired. Keep the period-mean fallback; keep `riskLevel` on the shared vocabulary.
5. **Large patch honours the model's adjustedRisk** (498). Do not recompute it, do not over-apply the pattern to the other nine diseases, and supply soil temperature explicitly because `large-patch-model.js` is not pure.
6. **Port the single-source and validity-envelope tests** and keep them in CI. They are what stop these defects coming back.

---

*Questions to Jerry Spencer, Gilba Solutions Pty Ltd.*

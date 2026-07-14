# GAIP Hub — SaaS Engineering Handover

## Growth Potential model reconciliation (b35fix473 / v11.26.0)

**To:** SaaS port team
**From:** Jerry Spencer, Gilba Solutions Pty Ltd
**Date:** July 2026
**Status:** Shipped and verified in production on the WordPress plugin.
**Priority:** HIGH. Read section 2 before you write any GP code.

---

## 0. Why you are getting this document

The port is frozen at **b35fix395**. The plugin is at **b35fix473**.

Everything in this document describes a defect that **exists in your frozen baseline**. If you have already ported any module that computes growth potential, you have ported the defect. Section 3 tells you exactly which files and exactly what to look for.

This is not a "nice to have when you get to it." GP feeds nutrition, disease coupling, dormancy, stress trajectory, scenario planning, and report export. It is the most widely consumed computed value in the platform.

---

## 1. What growth potential is, and the one rule that matters

Growth Potential (GP) is a 0 to 1 scalar estimating how close turf is to its maximum growth rate at a given temperature. It drives nitrogen allocation, and it gates a large amount of downstream logic.

**THE TEMPERATURE CONTRACT: GP is a DAILY metric. It takes the DAILY MEAN air temperature.**

Not the current-hour reading. Not the minimum. Not the maximum. Not a multi-day rolling average.

This matters enough to state up front because the entire b35fix473 investigation was triggered by someone (correctly) noticing a dashboard showing a live temperature of 2°C next to a GP of 48%. Those were two different quantities: the 2°C was the current hour, and the GP was computed from that day's mean of 7.4°C. The numbers were both right. The UI just put them side by side with no explanation.

**Implication for the SaaS API and the mobile app:** if you expose a "current temperature" field and a "growth potential" field on the same view, label the temperature that GP was derived from, or you will field this question forever. A tooltip naming the daily mean is sufficient.

---

## 2. The canonical model. Do not deviate.

**PACE Turf Growth Potential Model** — Gelernter, W. & Stowell, L. (2005), "Improved overseeding programs 1. The role of weather", *Golf Course Management*, May 2005.

```
GP = exp(-0.5 * ((T - T_opt) / sigma)^2)
```

| Species | T_opt | sigma |
|---|---|---|
| C3 (cool-season) | 20.0 °C | 5.5 |
| C4 (warm-season) | 31.0 °C | 7.0 |

**Blend** (mixed swards, overseed scenarios): linear interpolation.

```
GP_blend = c3Fraction * GP_c3 + (1 - c3Fraction) * GP_c4
```
where `c3Fraction` is clamped to [0, 1].

Reference values, for your test fixtures:

| Daily mean | C3 GP | C4 GP |
|---|---|---|
| 2 °C | 0.004703 | 0.000175 |
| 5 °C | 0.024216 | 0.001273 |
| 7.4 °C | 0.072503 | 0.002915 |
| 10 °C | 0.191496 | 0.011252 |
| 15 °C | 0.661551 | 0.072503 |
| 20 °C | 1.000000 | 0.290923 |
| 25 °C | 0.661551 | 0.692569 |
| 31 °C | 0.135335 | 1.000000 |

**Kreuser & Soldat (2011)** is also implemented in the engine as a selectable model. **It is unused. Do not use it.** It was previously driving the dashboard, which put the dashboard 41 GP points adrift of the nutrition engine in cool conditions. It is retained only so the platform could move to it wholesale if that decision is ever taken. Selecting it for one surface and not others recreates the exact bug this build fixed.

---

## 3. What was wrong, and what that means for your baseline

Before b35fix473 the plugin contained **four different GP models across thirteen call sites.** At a 7.4 °C daily mean, C3 GP was simultaneously:

| GP | Coefficients | Provenance | Files |
|---|---|---|---|
| 7.3% | opt 20 / sigma 5.5 | **PACE. Valid.** | `growth-potential-engine.js`, `nutrition-calendar.js`, `nutrition-summary-integration.js`, `mlsn-progressive-disclosure.js` |
| 48.3% | Kreuser plateau 15.6–23.9 / 6.8 | **Kreuser. Valid but different.** | `climate-engine-v2.js`, `gaip-field-log-analysis.js` |
| 45.2% | opt 20 / **sigma 10** | **FABRICATED.** Comments falsely claimed PACE provenance. | `climate-module-v2.js`, `climate-module-v2.1-dual-metrics.js`, `hub-orchestrator.js`, `hub-tissue-v3.js` |
| 15.3% | opt 20 / **sigma 6.5** | **FABRICATED.** No source. | `gaip-scenario-engine.js`, `gssh-scenario-engine.js`, `event-planner-engine.js` |

C4 equivalents of the fabricated sets were **sigma 8.0** and **sigma 7.5**. PACE C4 sigma is 7.0.

### Your action

Grep your b35fix395 baseline for **all** of these. Do not assume a module is clean because it looks correct:

```bash
# formula shape
grep -rn "Math.exp(-0.5" src/ | grep -E "- ?20|- ?31"

# coefficient names — THIS IS THE ONE THAT CATCHES THE HIDDEN SITES
grep -rn "gpParams\|GP_COEFF\|GPP_COEFFICIENTS\|optimalTemp\|sigma\|varLow\|optMin" src/
```

**Why the second grep matters.** The initial audit of the plugin found 12 sites by grepping the formula shape. It missed a 13th (`nutrition-calendar.js`) because that module read its coefficients from a config object rather than inlining the Gaussian. It was only caught by grepping the coefficient *names*. Assume your baseline has the same trap.

**Exclusions.** Do not "fix" these. They are legitimately separate published temperature-response curves for pathogens and physical models, not turf GP:

- `disease-engine-pure.js`, `disease-forecast.js`, `red-thread-model.js`, `bipolaris-curvularia-models.js`, `smith-kerns-model.js`
- soil-temperature damping functions in `climate-engine-v2.js`
- Mulder / nutrient-interaction curves in `hub-tissue-v3.js`

---

## 4. The engine

**File:** `assets/growth-potential-engine.js`
**Global:** `GilbaGrowthPotentialEngine`
**Version:** 1.0.0

It is **pure**. No DOM reads, no global reads, no side effects, all inputs explicit. It has no dependencies. Its only external reference is a single `console.log` on load, which you can strip.

**It direct-copies to the SaaS port as a static asset.** Do not rewrite it. Do not reimplement it in your server language "for consistency." If you need it server-side and the runtime is not JS, port the file mechanically and pin it with the same test vectors in section 2.

### API

```js
// Returns GP as 0-1 decimal, or null on invalid input.
GilbaGrowthPotentialEngine.compute(tempC, {
    model: 'pace',        // optional; 'pace' is the default. Do not pass 'kreuser'.
    species: 'c3',        // 'c3' | 'c4' | 'blend'
    c3Fraction: 0.7       // only when species === 'blend'; clamped to [0,1]
});

// Returns the raw coefficient object, e.g. { optimum: 20, sigma: 5.5 }
GilbaGrowthPotentialEngine.getCoefficients('pace', 'c3');

// Takes {1..12: tempC}, returns {1..12: gp}. Missing months fall back to 15°C.
GilbaGrowthPotentialEngine.monthly(monthlyTemps, options);
```

**`compute()` returns `null`** for a non-numeric, NaN, or infinite temperature, and for an unknown model or species. It does **not** throw. Handle the null at your boundary; do not let it become `NaN` downstream.

**Note on `monthly()`:** the 15 °C fallback for missing months is defensive, not meaningful. 15 °C gives a C3 GP of 0.66, which is a substantial growth signal invented out of a missing input. In the SaaS port, **require all twelve months and reject the request** rather than inherit this fallback. It is a latent source of silent nonsense.

---

## 5. UNITS. This is the porting trap.

The engine returns **0 to 1**. Call sites in the plugin are **inconsistent** about what they return, and this is the single most likely way you introduce a bug while porting.

| Function | Module | Returns |
|---|---|---|
| `calcGPP()` | `climate-engine-v2.js` | **0–1** (rounded to 3dp) |
| `calculateC3GrowthPotential()` / `calculateC4GrowthPotential()` | `climate-module-v2.js` | **0–1** |
| `calculateC3GP()` / `calculateC4GP()` | `climate-module-v2.1-dual-metrics.js` | **0–100** |
| `calculateGrowthPotential()` | `hub-orchestrator.js` | **0–100** |
| `calcC3GrowthPotential()` / `calcC4GrowthPotential()` | `hub-tissue-v3.js` | **0–100** |
| `getGrowthPotential()` | `gaip-scenario-engine.js`, `gssh-scenario-engine.js`, `event-planner-engine.js` | **0–100** |
| `calcMixedGrowthPotential()` | `mlsn-progressive-disclosure.js` | **0–100**, rounded to integer |
| `calculateGPForTemp()` | `nutrition-summary-integration.js` | **0–1** |
| `calculateGP()` | `nutrition-calendar.js` | **0–1** |
| `calcGP()` | `gaip-field-log-analysis.js` | **0–1** (rounded to 3dp) |

**Recommendation for the SaaS port:** do not reproduce this. Pick one unit at the API boundary (0–1 is the engine's native scale and the sane choice), convert once at the presentation layer, and delete the mixed convention. But **if you are porting these modules individually and incrementally, preserve each function's existing return scale**, or you will silently multiply GP by 100 somewhere and everything downstream of it will clip.

---

## 6. Domain guards

Several call sites clamp GP to zero outside a temperature range **before** calling the engine:

- C4: zero if `tempC <= 0` or `tempC >= 45`
- C3: zero if `tempC <= -5` or `tempC >= 40`

These were **preserved exactly** in b35fix473 and are **not** part of the PACE model. They are unsourced. PACE returns a small positive GP at those extremes (e.g. C4 at 45 °C returns 0.135); the guards force zero.

**This is an open question, not a settled decision.** They are agronomically arguable (turf really is heat-dormant at 45 °C) but they have no citation. They were left alone to keep b35fix473 single-purpose.

Port them as-is for behavioural parity, but flag them. Do not silently drop them, and do not silently add new ones.

---

## 7. Load-order constraint

In the plugin, nine consumer modules did **not** declare the GP engine as a WordPress enqueue dependency. Delegation would have been undefined on an unlucky load order. b35fix473 added the dependency to 18 handles across three enqueue scopes, one of which (the field-log shortcode) had never loaded the engine at all.

**The WordPress `wp_enqueue_script` mechanism does not port.** The constraint it encodes does:

> The GP engine must be initialised before any consumer computes GP.

In a bundler or module system this is handled by an explicit `import`. Make it an import, not an ambient global. The ambient-global pattern is what allowed the plugin to accumulate this defect in the first place.

**A WordPress-specific hazard, for context on why this was fragile:** if a script declares a dependency handle that is not registered in the same request, WordPress silently drops the script. No error, no warning. The module just never loads. Your target platform probably fails loudly instead, which is better, but verify that assumption.

---

## 8. Tests to port

**`tests/gp-model-single-source-b35fix473.test.js`** (33 assertions). Port it. It is the thing that stops this defect coming back.

The important part is not the numeric assertions, it is this one:

```js
// Scans every file in the assets tree and fails if any module
// other than the canonical engine contains a GP Gaussian.
test('no local GP Gaussian anywhere', ...)
```

Adapt the path glob to your source tree and keep it in CI. Coefficient bugs are cheap to fix. A *fourth* model appearing in 2027 because someone needed GP in a new module and wrote three lines of `Math.exp` is the expensive failure, and it is the one this test prevents.

The other assertions worth carrying:

- PACE coefficients are exactly 20/5.5 and 31/7.0
- `compute()` with no model option equals an explicit `pace` call (i.e. the default has not drifted)
- C3 GP at a 7.4 °C daily mean is ~7%, and specifically is **not** 15%, 45%, or 48% (pins the regression)
- blend mode equals manual C3/C4 weighting
- all GP consumers agree with the engine across a temperature sweep

---

## 9. What b35fix473 did NOT change

Be clear on this, because it affects what you should expect when you diff outputs.

**Nitrogen recommendations did not change.** The nutrition calendar and nutrition summary were *already* on correct PACE coefficients. Their output is byte-identical before and after b35fix473.

What changed is every **other** GP surface: the dashboard GP card, the water-stress card, the orchestrator, the tissue module, the scenario planners, and field-log analysis. Those were running on Kreuser or on fabricated curves, and they feed `climateMetrics.growth`, which flows into disease-stress coupling, stress trajectory, dormancy flags, and Word export.

So: if you diff nutrition output across this build and see no change, that is correct. If you diff dashboard GP and see a 40-point swing in cool conditions, that is also correct.

---

## 10. Known open items (NOT fixed by b35fix473)

Do not assume these are handled.

| Item | Status |
|---|---|
| **Domain guards unsourced** (section 6) | Open. Preserved as-is. Needs a decision. |
| **`monthly()` 15 °C fallback** (section 4) | Open. Reject missing months in the port instead. |
| **C67** — dormancy projection | Open, and **unrelated to GP**. It is a soil-temperature trend projection bug (`daysToTransition`). It was initially and wrongly hypothesised to be a GP symptom. It is not. |
| **C19, C25, C11, C24, C59e, C59f** | Open. Unrelated. |
| **`event-planner-engine.js`, `event-planner-ui.js`** | **Dead code.** Enqueued nowhere in the plugin. Their fabricated coefficients were corrected anyway, but do not spend porting effort on them without checking whether they are wanted. |
| **GSSH `gaip-charts` enqueue drop** | Pre-existing defect, unrelated to GP. Four forecast modules (`gssh-disease-forecast`, `gssh-irrigation-forecast`, `gssh-shade-forecast`, `gssh-pgr-forecast`) declare a `gaip-charts` dependency that is never enqueued in the GSSH scope, so WordPress silently drops all four on stadium sites. If those forecasts have never rendered in stadium mode, this is why. |

---

## 11. Verification standard applied

For reference, this is the bar the plugin build was held to, and the bar the port should match:

- `node --check` clean on all 13 modified JS files
- New GP suite: 33/33
- **Full regression: 96 suites, 2037 tests, zero failures**
- Full WordPress dependency-graph walk: 372 handles, 4 enqueue scopes, **zero new dependency problems, zero cycles** versus the b35fix472 baseline
- Verified live in production: `GilbaGrowthPotentialEngine.compute(7.4, {species:'c3'})` returns `0.0725026...`

---

## 12. Summary, if you read nothing else

1. **PACE only.** C3 20/5.5, C4 31/7.0. Never Kreuser.
2. **One engine.** `growth-potential-engine.js` is the sole owner of the math. Import it. Never reimplement it.
3. **Daily mean in.** Never the current hour.
4. **Watch the units.** Engine returns 0–1; call sites are inconsistent.
5. **Port the single-source test** and keep it in CI.
6. **Audit your b35fix395 baseline** by grepping coefficient names, not just formula shape.

---

*Questions to Jerry Spencer, Gilba Solutions Pty Ltd.*

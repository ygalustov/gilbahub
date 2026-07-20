# GAIP Hub - SaaS Verification Spec

## getLeafWetnessHours path divergence, Fusarium/Microdochium moisture (gate for b35fix496 on SaaS)

**To:** SaaS port team
**From:** Jerry Spencer, Gilba Solutions Pty Ltd
**Date:** July 2026
**Status:** Measurement, not a fix. Run it once b35fix496 is applied on the SaaS tree.
**Priority:** HIGH for the NZ pilot. Fusarium/Microdochium is the flagship NZ cool-season disease and the pilot is a disease read-out product, so the moisture number reps read IS the product. This spec tells you whether the two wetness paths land that number in different risk bands on your pilot sites' data.

**When to run:** after b35fix496 (wetness-duration moisture) is merged and green on SaaS, and before any NZ rep sees a Fusarium read-out. The asymmetry ports with b35fix496; if 496 is not in yet, there is nothing to measure.

---

## 0. The one-paragraph version

b35fix496 made Fusarium moisture come from `getLeafWetnessHours()`. That helper estimates "daytime-equivalent wet hours" **two different ways depending on the data feed**, and the two ways diverge on overnight-dominant wetness, which is exactly the cool maritime NZ dew pattern. Below the `min(1, hours/10)` saturation knee, that divergence moves the Fusarium score, and moisture is 60% of the score. The risk is not drift over time on one site; it is **two pilot sites with identical weather reading different Fusarium risk because they have different data feeds**. Measure it on your pilot sites. If paired days land in different risk bands, resolve it before the pilot. If they agree, ship.

---

## 1. What the asymmetry is (exactly)

`getLeafWetnessHours(climate, dewData)` has three paths, tried in order. Two of them feed Fusarium after b35fix496:

**Dew-engine path (when `dewData.leafWetness.averageWetHours` exists):**
```
return Math.round(dewData.leafWetness.averageWetHours * 0.5);
```
A flat **0.5 proportional discount** on an all-24-hours daily average. The comment's rationale: convert an all-hours dew average to a daytime-equivalent infection period.

**Dew-engine total variant (`totalWetHours`):**
```
return Math.round((dewData.leafWetness.totalWetHours / 7) * 0.5);
```
Same 0.5 discount, plus a hardcoded `/7` that assumes a 7-day total window (a second latent assumption; secondary to the main issue).

**Hourly-RH path (when `climate.hourlyData.relative_humidity_2m` exists, no dewData):**
```
for each hour: if RH >= 90 AND local hour in [06:00, 20:00): wetHours++
return Math.round(wetHours / days);
```
No flat multiplier. Instead an **absolute 06:00-20:00 daytime window** (14 of 24 hours), counting only hours actually at or above 90% RH inside that window.

**The divergence.** Both estimate the same quantity, daytime-equivalent wet hours, but:
- the dew path keeps **half of the whole day's** wet hours, wherever they fall;
- the hourly path keeps **only the daytime** wet hours and drops the rest.

They agree only when wetness is evenly spread. When wetness is **overnight-dominant** (dew/condensation peaks pre-dawn, the normal cool-season NZ pattern), the dew path retains half of those overnight hours while the hourly path discards them entirely. So for the same physical wetness, the **dew-fed site reports more wet hours** than the hourly-fed site.

---

## 2. How it reaches the Fusarium score

After b35fix496/497 the Fusarium moisture and combine are:
```
moistureFactor = Math.min(1, leafWetnessHours / 10);   // knee at 10 hours
baseRisk       = 0.40 * tempFactor + 0.60 * moistureFactor;
riskScore      = baseRisk * 100;
```
`moistureFactor` is **60% of the score**, and one wet-hour below the knee is 0.1 of moistureFactor, which is **6 riskScore points**. Bands (`DISEASE_CONFIG.thresholds`): moderate >= 50, high >= 70, severe >= 85.

**Two regimes:**
- **At or above 10 daytime-equivalent wet hours, both paths saturate** `moistureFactor` to 1.0. The divergence washes out completely. A soaked multi-day wet spell is immune.
- **Below 10 wet hours, the divergence is live** and scales linearly into the score. The sensitive zone is roughly 4 to 12 wet hours, which is the marginal cool-wet NZ autumn day where the read-out decision is closest.

**Worked example (a plausible NZ dew night).** Total wet 16 h, of which 4 h fall in 06:00-20:00 and 12 h overnight; `tempFactor` 0.9:
- Dew path: `round(16 * 0.5)` = 8 h to `moistureFactor` 0.8 to score `(0.40*0.9 + 0.60*0.8)*100` = **84, high**.
- Hourly path: 4 daytime wet h to `moistureFactor` 0.4 to score `(0.36 + 0.24)*100` = **60, moderate**.

Same weather, same day, **two bands apart**, purely because one site had a dew feed and the other had hourly RH. That is the failure this spec is looking for.

---

## 3. The measurement

**Goal:** on the pilot sites' actual data, quantify the score gap between the two paths and whether it crosses a risk band.

**Step 1 - map the feed mix.** For every pilot site day-record, log the model's `moistureSource` string (it already emits one of: `leaf-wetness duration (dew engine)`, `high-RH hours (hourly climate)`, `period-mean RH (no wetness-duration data)`, `precip only ...`). This tells you how many pilot sites are dew-fed vs hourly-fed vs neither. If every pilot site is on the **same** feed, cross-site inconsistency cannot occur and the risk drops sharply; record that and note it.

**Step 2 - compute both paths on paired days.** For day-records that carry **both** signals (dew `leafWetness` and `hourlyData.relative_humidity_2m`), or for a representative NZ sample run through both, compute:

| Field | Dew path | Hourly path |
|---|---|---|
| `leafWetnessHours` | `round(averageWetHours * 0.5)` | daytime RH>=90 count / days |
| `moistureFactor` | `min(1, h/10)` | `min(1, h/10)` |
| `riskScore` (hold the day's `tempFactor`) | `(0.40*tF + 0.60*mF)*100` | same |
| band | `classifyRisk(score)` | `classifyRisk(score)` |

Use the real `classifyRisk()` and `DISEASE_CONFIG.thresholds`; do not hardcode band numbers.

**Step 3 - report three numbers:**
1. **Max riskScore delta** across sampled days.
2. **Count of days where the two bands differ** (the decision-relevant figure).
3. **Count of knee-straddle days** (one path >= 10 h, the other < 10 h), the largest single-step divergences.

**Note on Step 2 feasibility.** Most sites will have only one feed, so a real paired day needs a site carrying both, or a synthetic pairing: take the real NZ hourly RH series (hourly path), and derive the `averageWetHours` the dew engine would produce from the same series (dew path). The second requires the dew engine's own wet-hour definition, which lives in a separate module; if that is not readily callable, restrict Step 2 to any pilot sites that happen to carry both signals, and lean on Step 1's feed-mix map for the rest.

---

## 4. Pass / fail

**Pass (ship the pilot):** either
- all pilot sites are on the **same** feed (no cross-site inconsistency possible), or
- on the sampled paired days the two paths **never cross a band**, and the max score delta is small enough that you judge it does not move a read-out decision.

**Fail (resolve before the pilot):**
- paired days routinely land in **different bands**, or
- pilot sites are on **mixed feeds** and the divergence on their data shape is band-crossing.

A fail does not mean the model is wrong; it means the number a rep reads depends on which data feed the site has, and that is not defensible for a disease read-out product where reps compare sites.

---

## 5. If it fails: the fix options (flagged, not part of this measurement)

The clean resolution is to make the two paths estimate daytime the **same** way. Cheapest to most correct:

1. **Standardise the pilot sites to one feed.** Operational, no code. If every pilot site is dew-fed (or every one hourly-fed), the inconsistency is gone. Fastest path to a defensible pilot.
2. **Give both paths the same daytime treatment.** Either apply the 06:00-20:00 window to the dew path too (so it also drops overnight hours), or drop the window on the hourly path and apply the same flat 0.5 (so it also keeps half of overnight). Pick one convention and use it on both. Small, single-helper change; add a regression test pinning the two paths to agree on a fixed wetness distribution.
3. **Resolve it in the SaaS engine properly.** This is logged as an open item against the plugin (the shared-helper asymmetry) and is a natural thing to fix once during the port rather than inherit. If the pilot can wait for it, do it here.

Do not "fix" it by retuning the `/10` knee or the 0.60 weight; those are the shared wet-hours convention and the Fusarium combine, not the source of the divergence.

---

## 6. What this is NOT

- Not a coefficient change. `riskScore`, the temperature curve, the 0.40/0.60 weights, the `/10` knee: untouched by this measurement.
- Not a `riskLevel` change. `riskLevel` is a shared vocabulary contract (disease-ui CSS and interaction gate on it); the measurement reads it, never relabels it.
- Not a confidence change. Fusarium stays at the b35fix495 moderate/60 ceiling regardless of outcome.
- Not gated on b35fix497 or b35fix498. Only b35fix496 (which introduces the wetness-duration path) has to be applied for this to be measurable.

---

## 7. Summary

1. b35fix496 made Fusarium moisture come from `getLeafWetnessHours()`, which estimates daytime wet hours **two ways**: dew path (flat 0.5 on all 24 h), hourly path (06:00-20:00 window only).
2. On overnight-dominant NZ dew, the dew path reads **higher** wet hours than the hourly path for the same weather.
3. Below the 10-hour knee this moves the Fusarium score (moisture is 60% of it) and can cross a risk band; at or above 10 hours it washes out.
4. **Measure** the two paths on your pilot sites, report band-crossings and max delta, using the real `classifyRisk`.
5. **Pass** if sites share a feed or the sampled paths never cross a band. **Fail** if mixed feeds cross bands, in which case standardise the feed or make the two paths use one daytime convention.
6. The number a rep reads must not depend on the site's data feed. That is the whole test.

---

*Questions to Jerry Spencer, Gilba Solutions Pty Ltd.*

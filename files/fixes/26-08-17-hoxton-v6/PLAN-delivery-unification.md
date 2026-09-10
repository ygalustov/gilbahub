# PLAN — Delivery half: one product-delivery accumulator for the Plan page and the Word export

Analyst deliverable. Analysis and plan only — no source, test or doc file was edited; no git operation was run.
All paths relative to `/Users/katep/Documents/Work/gilba/gilbahub/`. Every line number was read on the working tree on
2026-09-10. Every figure below was either read off the code, read from the dev DB (`gilba_mysql`, `site_configs`
namespace `gaip`, the persisted `nutritionProgram` of nine sites), or produced by running the real
`assets/au-fertiliser-products.js` in Node against those persisted monthly series (two scratchpad jest files,
`delivery-accumulators.test.js` and `au-rerun.test.js`, in the session scratchpad — transcribed in sections 1.3 and 1.4).
Nothing was observed live in a browser for this document; section 6 says what to verify live and where.

Ticket number for the implementation: the Change log's highest entry is **GH-397**; `GH-398` is unused anywhere in
`assets/`, `tests/`, `docs/`, `app/resources/`. Stages below are numbered GH-398 (a), (b)… so they can ship as separate
commits under one ticket or be split into GH-398/399/400 at the user's choice.

---

## 0. Executive summary

1. **The SLAN defect is reproduced offline and its cause is confirmed, with one correction to the traced story.** On
   "New test - location" / Putter Green (site `01a00d5b-…`, SLAN, golf_greens) the persisted Plan programme carries
   `delivered.P = 14.0`; re-running `word-export-combined.js`'s per-sample accumulator (lines 2713–2783) on the same
   twelve months gives **14.497 → prints 14.5**. The 0.5 kg is two liquid applications whose `delivers.P` is a
   hard-coded `0` in the AU recommender (`au-fertiliser-products.js:6291-6295`) while their `analysis.P` is 1.7 %
   and 2 %: Greenmaster Liquid Spring & Summer 21 L/ha (0.357 kg P) and Long Paddock Rapid Uptake 7 L/ha (0.14 kg
   P). The export's fallback `fromDelivers > 0 ? fromDelivers : fromAnalysis` (2739–2745, 2776–2779) treats the declared
   zero as "absent" and substitutes `analysis × rateLHa`. The correction: the Plan does **not** "always recompute
   rate × splitCount × analysis" — that is the NZ integration only (`nutrition-prebble-integration.js:721-747`). The
   AU and UK integrations print the recommender's own `program.delivered` (`nutrition-au-fertiliser-integration.js:815-818`,
   `nutrition-uk-fertiliser-integration.js:941-942`), which is Σ of the per-application `delivers` vectors.

2. **Neither side is right on that number.** The Plan prints the recommender's declaration (14.0), and the declaration
   is false: 0.5 kg of phosphorus is physically in those two sprays. The export prints a third quantity that is also
   wrong: it ignores that Long Paddock is `applications: 4` (7 L/ha × 4 = 28 L/ha, 0.56 kg P, not 0.14), and it only
   does so when a declared value happens to be exactly zero. The physical figure is **14.9**. Which of the three is
   printed is a decision (section 7, D-1), because counting liquid P at the root changes the AU recommender's own P
   pacing and therefore product selection on four of the six AU dev sites (section 1.4).

3. **Five accumulators exist, maintained by hand, per nutrient, per region (section 1.1).** Two on the Plan
   (NZ physical; AU/UK declared), one in the combined export (declared-or-analysis, splitCount-blind), one reader in
   `word-export.js` (`_computeProgrammeDelivered`, sums whatever the entry carries), and one more fallback in
   `_extractEntryNutrients` (2735–2741) that tops P up from analysis when the entry's P is zero — so the single-sample
   export's Annual Product Summary rows and its own ANR Delivered column disagree on the same document. GH-391's
   "P source's N added to rows but not total" was the same family, one level down.

4. **Selection is not provably identical; it happens to agree on the fixtures.** The recommender call is the same
   function on both surfaces and the surface type is now shared (GH-387), but (a) the Plan passes the Mulders
   antagonism flags it computes (`nutrition-au-fertiliser-integration.js:380-391`, `:492`; NZ via the integration's
   context) and the export passes `muldersFlags: {}` (`word-export-combined.js:2488`, `:2656`), and those flags
   steer product scoring (`au-fertiliser-products.js:5078`, `:5520`); (b) the Combined export has **no UK branch at
   all** — `_useAU = !_sampleNZ && _auAvailable` (`word-export-combined.js:2320`), so Test6 - UK (52.24 N, 0.38 E)
   gets the Australian catalogue in the document while the Plan shows Vision Reward CRF / H-Cote / Sportsmaster
   Spring & Summer / Premier HG. No fixture has a Mulders flag and none is UK, so the harness is green. Section 8
   records both as findings for their own tickets; (a) is one line to fix, (b) is a design question.

5. **Recommended architecture:** one pure module, `assets/nutrition-delivery-core.js`, whose only input is the
   recommender's monthly application list (the object both surfaces already hold) and whose output is the product
   map, the per-nutrient totals and the per-application ledger. It can meet the requirement-core's purity bar
   exactly (section 3.2). All five accumulators become calls to it. `_computeProgrammeDelivered` survives as a reader
   of its output; the export's fallback and `_extractEntryNutrients`' top-up are deleted, not kept as safety nets.

6. **Stages (section 4):** 0 — harness rows that go red on the SLAN fixture today; 1 — the shared module and the
   five call sites (export SLAN P 14.5 → 14.0, nothing else visible moves); 2 — AU liquid P at the root (D-1,
   selection moves); 3 — multi-application liquid volume and application counts (D-3, Purchasing Summary moves);
   4 — double rounding (D-4, Burns footer 126 → 125); 5 — export Annual Product Summary total row (D-5). Each is one
   commit, independently revertible.

7. **Double rounding: fold it in as stage 4, not a separate ticket.** The shared module returns unrounded totals;
   leaving the `Math.round(x * 10) / 10` intermediate in three renderers would re-create, by hand, in three places,
   the artefact the unification exists to remove. It is its own commit because it changes a printed figure (Burns).

---

## 1. Verified current state

### 1.1 Where "delivered" is computed today

| # | Surface | File:lines | Source of a product's N/P/K | splitCount / applications | Amendments |
|---|---|---|---|---|---|
| A1 | Plan, NZ | `nutrition-prebble-integration.js:709-754` | `rate × splitCount × analysis[n] / 100` over `program.monthly`, granular and liquid, six keys N/P/K/Ca/Mg/S; rounded to 1 dp at 752 | `splitCount` honoured (724, 738) | none on the Plan |
| A2 | Plan, NZ product rows | `:961-1001` | `summary.products[id].nutrients` — the recommender's own `annualSummary` (`prebbles-products.js:2003-2030`, same formula; `-BAL` entries at 2232-2247 with `nutrients.N += nDelivered`) | `applications += splitCount` (2020) | — |
| B1 | Plan, AU totals | `nutrition-au-fertiliser-integration.js:813-851` | `program.delivered` when present (815-818) — the recommender's accumulator (`au-fertiliser-products.js:5996`, `6188-6190`, `6270-6271`, `6354-6356`); fallback Σ `delivers` | recommender-internal | — |
| B2 | Plan, AU product rows | `:531-578` | Σ `p.delivers[n]` per application; Ca/Mg/S from `delivers` (always 0 for AU granular — `delivers` carries N/P/K only, 6218-6222) | `applications++` per month; `totalLHa += rateLHa` **per month, not × applications** (566-568) | — |
| B3 | Plan, UK | `nutrition-uk-fertiliser-integration.js:941-960`, rows `:1032-1050` | `program.delivered` = Σ `delivers`; `delivers` is `rate × pct / monthsCovered` (`:495-499`) | none; `applications++` per month | — |
| C | Combined export, per sample | `word-export-combined.js:2709-2783` | NZ: `perSampleProgram.annualSummary.products` as-is (2710-2711). AU (no annualSummary on the raw recommender return): per application `fromDelivers > 0 ? fromDelivers : analysis × rate / 100` for N/P/K/S/Ca/Mg/Fe (2738-2746, 2775-2780) | **`splitCount` ignored** (2733, 2740); liquids `rateLHa` per month, `applications` ignored (2759-2765, 2777) | merged after, flagged `_isAmendment` (2857-2867, K-recon 2940-2985) |
| D | Export reader | `word-export.js:2638-2657` `_computeProgrammeDelivered` | Σ `entry.nutrients || entry.totalDelivered` per nutrient, skipping `_isAmendment` | — | skipped |
| E | Export rows | `word-export.js:2690-2746` `_extractEntryNutrients` | N/P/K from `nutrients` then `totalDelivered`; S/Ca/Mg from `totalDelivered`/`nutrients` else `analysis × mass`; **P topped up from `analysis × mass` when the entry's P is 0** (2735-2741) | mass = `totalKg \|\| totalKgHa \|\| totalLHa` | rendered |
| F | Single export | `word-export.js:9945-10048` | `window.GAIP_NUTRITION_PROGRAM.annualSummary` — i.e. B2 (AU), A2 (NZ), B3 (UK) as the integration built it; rows through E, ANR/K-recon through D | — | merged at 10050-10240 |

Consumers of D: the ANR table's Delivered column (`word-export-combined.js:3986-3991`, `4048`, `4071`), the K
Reconciliation gate and table (`_perSampleKDelivered` 3474-3486 via `r._programmeKDelivered` 2970; single export
10215-10216), and the spot-K synthesis. Consumers of E: the Annual Product Summary (`word-export.js:6007-6111`,
rendered per sample in both exports) and the Fertiliser Purchasing Summary (`word-export-combined.js:4604-4649`).

### 1.2 Selection: identical by construction, or by luck?

- Same function on both surfaces: AU `AuFertiliserRecommender.generateAnnualProgram` (Plan `:488`, export `:2510`);
  NZ `PrebbleRecommender.generateProgram` (Plan `:346`, export `:2676`). Inputs to the calendar and the surface type
  come from the shared adapter since GH-383/387; the harness asserts the monthly product/rate series month by month
  (`tests/e2e/ui-vs-export-parity.test.js:1502-1517`).
- **Not identical by construction, two inputs differ:**
  1. `muldersFlags` — Plan: `GilbaMulders.analyse()` result (`nutrition-au-fertiliser-integration.js:337-391`;
     NZ integration builds its context the same way); export: `{}` at `word-export-combined.js:2488` (AU) and
     `:2656` (NZ). The flags change product scoring (`au-fertiliser-products.js:5078`, `:5520`; `prebbles-products.js`
     reads `context.muldersFlags` too). A site whose soil raises an antagonism flag will select differently in the
     document. None of the three fixtures raises one, which is why this is invisible. (Two persisted programmes —
     Federal Golf, Westview — do not reproduce under `muldersFlags: {}` with today's code; whether that is flags or
     code drift since 2026-08-26/09-08 is not established.)
  2. Region: the export knows NZ and "not NZ" (`:2286-2320`). "Not NZ" is Australia. A UK site is exported with
     Australian products; the Plan renders the UK catalogue (`nutrition-uk-fertiliser-integration.js:683-690`
     gates on `uk_ireland`). Dev site affected: Test6 - UK.
- NZ export context (`:2642-2657`) mirrors the Plan's (`nutrition-prebble-integration.js:314-338`) field for field,
  including the `pThreshold` 21/30 rule; verified equal.

Conclusion for the brief's question 1: for AU and NZ, selection agrees on every dev site that has no Mulders flag;
it is not provable. The one-line fix (pass the same flags) is out of this ticket's scope but is the first thing a
future harness fixture with an antagonism would catch. UK is a genuine selection divergence today.

### 1.3 The SLAN defect, reproduced on the persisted programme

Persisted `nutritionProgram` of site `01a00d5b-c67a-7281-8f0f-2d8de6676a0f`, generated 2026-09-10T02:16:54Z by the
GH-396 harness run (golf_greens, SLAN, distributor 'all'):

| Quantity | N | P | K |
|---|---|---|---|
| `program.delivered` (Plan prints this; AU integration B1) | 138.8 | **14.0** | 104.6 |
| `program.targets` | 120.0 | 14.0 | 103.0 |
| Combined-export accumulator C on the same months, read by D | 138.8 | **14.497 → 14.5** | 104.6 |
| Physical: Σ rate × (splitCount \| applications \| 1) × analysis | 138.8 | **14.9** | 104.4 |
| Single-export row P via E (top-up from analysis × one-month volume) | — | 14.5 | — |

The 0.497 kg: Jul — Greenmaster Liquid Spring & Summer, analysis P 1.7 %, 21 L/ha, `applications: 1`,
`delivers.P = 0` → export adds 0.357; Aug — Long Paddock Rapid Uptake, P 2 %, 7 L/ha, `applications: 4`,
`delivers.P = 0` → export adds 0.14 (one application's volume; physically 0.56). K differs from physical by 0.2
because the recommender rounds each application's K to 1 dp before accumulating (`5643`, `5951`).

Re-running `generateAnnualProgram` on this site's persisted monthly `requirements` with `muldersFlags: {}` reproduces
`delivered` and the product set exactly (also on Burns, Test1 - Sports, Canberra), so the offline figures for those
four sites are the Plan's figures.

### 1.4 Every dev site with a programme: what each surface prints today, and after each stage

"Export" = Combined export's ANR Delivered (accumulator C read by D). Whole-kg product rows are unaffected unless
stated. Figures are unrounded sums; the Plan's Delivered column prints them to 1 dp.

| Site (region, surface, method) | Plan today N / P / K | Export today N / P / K | After stage 1 | After stage 2 (D-1, AU liquid P at root) | After stage 3 (D-3, volumes × applications) |
|---|---|---|---|---|---|
| Burns (AU, golf_greens, MLSN) — fixture | 125.5 / 12.3 / 0 | 125.5 / 12.3 / 0 | no change | no change (no P-bearing liquids) | no change (Ammonium Sulphate Tech: 1 application per month) |
| New test - location (AU, golf_greens, SLAN) — fixture | 138.8 / **14.0** / 104.6 | 138.8 / **14.5** / 104.6 | export P → 14.0; ANR Status −5 % → −7 % (= Plan) | **P 14.0 → 18.7** (target 14), N 138.8 → 137.6; MAP Tech (10 kg, 2.7 P) and Country Club IV 17-0-17 (172 kg) **drop**, Country Club IV 18-9-18 161 kg × 1 → × 2 months (P 6.4 → 12.8); Greenmaster row P 0.4, Long Paddock 0.6 | Long Paddock Rapid Uptake Total Rate 7 → 28 L/ha, Applications 1 → 4 |
| Test5 - NZ (NZ, soccer, AA) — fixture | 237.4 / 0 / 213.4 | 237.4 / 0 / 213.4 (A2 as-is) | no change | not applicable (NZ has no declared vector) | no change (NZ already counts `splitCount`) |
| Test1 - Sports (AU, soccer, MLSN) | 149.0 / **12.1** / 88.4 | 149.0 / **12.8** / 88.4 | export P → 12.1 | P 12.1 → 11.9, N 149.0 → 148.0; MAP Tech 15 kg → ~7 kg (P 4.1 → 1.9); Long Paddock Sportsturf row P 0 → 1.2, X Factor 0 → 0.8 | Long Paddock Sportsturf 15 → 60 L/ha (1 → 4 apps), X Factor 30 → 60 L/ha (1 → 2) |
| Canberra (AU, golf_greens, MLSN) | 184.7 / **22.6** / 110.9 | 184.7 / **23.5** / 110.9 | export P → 22.6 | P 22.6 → 23.9, same product set (Greenmaster row P 0.7, Long Paddock 0.6) | Urea Tech 15 → 30 kg/ha (1 → 2), Long Paddock 7 → 28 L/ha (1 → 4), FoliMAX N-Hancer-N 20 → 40 L/ha (1 → 2) |
| Westview (AU, lawns, MLSN) | persisted 200.4 / **20.1** / 139.6 (re-run: 204.7 / 20.1 / 139.6 — persisted programme not reproducible, see 8.3) | 204.7 / **27.2** / 139.6 (Greenmaster Liquid S&S 1.7 % P: row 0 → 7.1) | export P → 20.1 | re-run basis: N 204.7 → **217.1**, P 20.1 → 21.3, K 139.6 → **117.3**; TPG Ratio (250 kg) and MAP Tech (soluble) drop; GTS Sport Series Enhance 34-1-6 and FoliMAX NRG-NK appear; Greenmaster S&S 4 → 3 months | Greenmaster Liquid S&S 417 → 657 L/ha |
| Federal Golf (AU, golf_greens, SLAN) | persisted 129.6 / 13.3 / 31.5 (re-run 133.2 / 13.3 / 31.5 — not reproducible) | 133.2 / 13.3 / 31.5 | no change | no change | Urea Tech (soluble) 30 → 60 kg/ha, Applications 2 → 4 |
| Russley (NZ, greens, AA) | 200.2 / 0 / 118.4 | same | no change | n/a | no change |
| Test6 - UK (UK, sports, MLSN) | 199.8 / 27.9 / 125.4 (UK prints P at 1 dp: 27.85 → 27.9 vs rows summing 27.8) | **Australian products** (finding F-1, section 8.1); single export: 199.8 / 27.8 / 125.4 | no change under D-2 option B; under option A the Plan would print **294.5 / 40.1 / 181.2** (section 2.4) | n/a | no multi-application liquids |

Stage 4 (double rounding, D-4): the only dev-site footer that lands in [n+0.45, n+0.5) is Burns N (113.1 + 7 + 5.4 =
125.4999…): Plan "Total Delivered" N **126 → 125**, matching its rows 113 + 7 + 5. No export figure changes (the
export has no footer; its ANR prints 1 dp from the raw sum).

Stage 5 (D-5): every exported Annual Product Summary gains a "Total Delivered" row equal to the Plan's footer — Burns
125 / 12 / 0; New test 139 / 14 / 105; Test5 237 / 0 / 213.

### 1.5 Other divergences found in the same code, not in the brief

1. **Combined-export fallback ignores `splitCount` and `applications`** (`:2733`, `:2740`, `:2777`). Inert today only
   because NZ programmes carry `annualSummary` (2710) and AU liquids' `delivers` are totals. If an NZ programme ever
   reached the fallback, Test5 would print N 166.3 / K 153.8 instead of 237.4 / 213.4 (computed on the persisted
   months). Delete with stage 1.
2. **`_extractEntryNutrients` P top-up** (`word-export.js:2735-2741`) — the single-sample export's Annual Product
   Summary shows P for AU liquids (from `analysis × one-month volume`) while the same document's ANR Delivered
   (through D, reading `totalDelivered.P = 0`) does not. Same family as the combined fallback. Delete with stage 1.
3. **AU/UK multi-application liquids under-report volume and application count on both surfaces** (B2 `:566-568`,
   `:543`/`:563`; C `:2759-2765`). `rateLHa` is per application and `applications` is the count
   (`au-fertiliser-products.js:5607-5626`, 5638-5641), `delivers.N` is the total over all applications (verified: Urea
   Tech 15 kg × 46 % × 2 = 13.8). "Total Rate" and the Purchasing Summary's kg/L per hectare therefore print one
   application's volume for the month. Not a parity defect — both surfaces agree — but the shared accumulator has to
   define these two fields, so it is decision D-3, with the figures in the stage-3 column above.
4. **NZ: two sources that agree today and need not.** The export prints the recommender's `annualSummary`
   (A2), the Plan recomputes from `monthly` (A1). After Phase-3 surplus reduction the recommender rounds each
   product's `nutrients.N` to 1 dp (`prebbles-products.js:2098-2101`) and each month's `rateKgHa` to a whole kg
   (`:2111`), so the two can differ by up to ~0.15 kg per product. No dev NZ site has triggered the reduction
   (Test5 and Russley agree exactly). Stage 1 makes both surfaces read `monthly`.
5. **UK `delivers` is a per-month share, not the product's content.** The UK recommender applies a granular in every
   month with N > 0.5 and credits `rate × pct / monthsCovered` (`nutrition-uk-fertiliser-integration.js:495-499`,
   `monthsCovered` 2–3 for slow/controlled release, `:138-145`). On Test6 the physical N in the listed applications is
   294.5 kg against a printed 199.8. That is a recommender-model question (section 8.2), not an accumulator one,
   but it decides what "delivered" may mean in the shared module (D-2).
6. **Double rounding** in all three Plan integrations: `nutrientTotals[k] = Math.round(x * 10) / 10` at
   `nutrition-prebble-integration.js:752`, `nutrition-au-fertiliser-integration.js:855`,
   `nutrition-uk-fertiliser-integration.js:961`, then `Math.round(nutrientTotals.N)` in the footers at `:1113-1115`,
   `:1064-1066`, `:1192-1194`. Burns 125.4999 → 125.5 → 126.
7. **Export Annual Product Summary has no total row** (`word-export.js:6076-6108` renders product rows only); the
   Plan has "Total Delivered / Required / Balance" (`nutrition-prebble-integration.js:1110-1129`,
   `nutrition-au-fertiliser-integration.js:1059-1075`).

---

## 2. What diverges, and which side should win

| Divergence | Plan | Export | Verdict and reasoning |
|---|---|---|---|
| 2.1 Declared `delivers` vs analysis-derived value for P on AU liquids | prints the recommender's declaration (`P: 0`) | overrides a declared 0 with `analysis × rateLHa` (one application) | **The recommender's declaration is the source, so the Plan's *rule* wins; the export's override is wrong in kind** — it second-guesses the model only when the value is exactly zero and ignores `applications`. But the declaration itself is false, and that is where the fix belongs (GH-391 was this exact shape one nutrient over). Stage 1 makes the export print 14.0; stage 2 makes the declaration true (D-1). |
| 2.2 `_extractEntryNutrients` P top-up (single export rows) | — | rows show P the ANR column does not | Export wrong; same reasoning as 2.1. Delete. |
| 2.3 `splitCount` in the combined fallback | honoured | ignored | Plan right; the schedule prints "× 2" and the client buys twice the bag count. Delete the fallback. |
| 2.4 What "delivered" means per application | NZ: physical content; AU: declared totals (= physical for N/K, 0 for liquid P); UK: declared per-month share | AU/NZ same as Plan where no fallback fires | **Declared vector wins when a recommender declares one; physical (mass × analysis) only where none is declared.** The recommender's `delivers` is the same quantity its pacing (`netP`, GH-342/343 caps) and `balance` are built on; printing something else beside `balance` would re-open GH-391's "over-delivery reported as on-target" in reverse. Choosing "physical everywhere" (option A) would move Test6 - UK from 199.8 to 294.5 kg N on both surfaces, and the UK model's per-month share is not this ticket's to overturn. D-2. |
| 2.5 Multi-application liquid volume / application count | one application per month, on both | same | Both wrong physically; the purchasing figure is the one the client orders by. D-3, recommend physical (`rateLHa × applications`, `applications += applications`), consistent with how NZ already counts `splitCount` (`prebbles-products.js:2019-2020`). |
| 2.6 NZ source of the product rows | `monthly` recomputed | recommender `annualSummary` | Read `monthly` on both: it is what the Monthly Schedule prints and what the client sees; `annualSummary` is the recommender's working copy for Phase 3. |
| 2.7 Double rounding | 1 dp then whole | ANR 1 dp from raw | Round once, from the raw sum, at print. D-4. |
| 2.8 Total row in the export table | present | absent | D-5; recommend adding "Total Delivered" (catalogue-only) — the Plan is the vocabulary reference (GH-396) and the row is what the harness compares. |

---

## 3. Target architecture

### 3.1 One module, one input, three outputs

`assets/nutrition-delivery-core.js` — exposed as `window.GAIP_NutritionDelivery` and `module.exports`, the same
dual-export shape as `nutrient-balance-status.js:231-232` and `nutrition-requirement-core.js:578-579`.

```
accumulate(monthly, options) -> {
  applications: [ { monthIndex, month, id, name, form, isLiquid,
                    rate, count, mass, rateUnit,
                    nutrients: { N, P, K, Ca, Mg, S },
                    source: { N: 'declared'|'analysis', ... },
                    isBalancing, isAmendment } ],
  products:     { [id]: { id, name, label, form, isLiquid, release, releaseTech, analysis,
                          applications, totalKgHa, totalLHa, mass,
                          nutrients: { N, P, K, Ca, Mg, S }, rateReduced } },
  totals:       { N, P, K, Ca, Mg, S }          // catalogue-only: isAmendment entries excluded
}
```

Per application, in this order and nothing else:

1. `rate = rateKgHa` for granular and soluble entries, else `rateLHa` (solubles carry kg/ha in `rateLHa` by the
   b35fix282 convention — `form === 'soluble'` decides `totalKgHa` vs `totalLHa`, exactly as B2 `:565-569` and C
   `:2760-2766` do today).
2. `count = splitCount ?? applications ?? 1` (NZ uses `splitCount`, AU liquids `applications`; a stage-3 option
   `liquidVolume: 'per-month'` keeps today's `count = 1` for AU/UK liquids until D-3 is approved).
3. `mass = rate × count`.
4. `nutrients[n] = (delivers && typeof delivers[n] === 'number') ? delivers[n] : mass × (analysis[n] || 0) / 100`,
   for all six keys. A declared zero is a zero (the `> 0` guard is the defect). AU granular entries declare N/P/K only,
   so their Ca/Mg/S come from analysis — which is what E does today for the export's optional columns; NZ declares
   nothing, so all six are physical, which is A1 today.
5. Entries flagged `_isAmendment` are kept in `applications` and `products` (the export renders them) but excluded from
   `totals`; `products[id].isAmendment` is set so `_computeProgrammeDelivered`'s skip keeps working unchanged.
6. `label`: `name`, with ` (Balance)` appended when `isBalancing` (the NZ recommender names its `-BAL` entries that way
   at `prebbles-products.js:2234`; the Plan row and the harness's rendered-name match at `ui-vs-export-parity.test.js:1534-1552`
   depend on it). `release`/`releaseTech`/`rateReduced` carried from the monthly entry (the Plan's "(QR)"/tech label,
   `nutrition-prebble-integration.js:978-980`).
7. No rounding anywhere in the module.

Options: `{ liquidVolume: 'total' | 'per-month' }` (stage 3), nothing else. No DOM, no `window` reads, no console
output except one `console.error('[NutritionDelivery] …')` for a malformed entry (prefix chosen not to match the
harness's fail-loud regex at `ui-vs-export-parity.test.js:960`).

### 3.2 Can it meet the requirement-core's purity bar?

Yes, fully. Everything it needs is on the monthly application objects both surfaces already hold: the Plan's
`program.monthly` (integration output), the combined export's `perSampleProgram.monthly` (raw recommender return), the
single export's `prog.monthly` (`word-export.js:10036`). The catalogue is not needed — every application carries its
`analysis` (NZ `prebbles-products.js:2853`, `3417`; AU `6213`, `6286`, `6363`; UK `:516`, `:549`). Surface type, region,
distributor, methodology are selection inputs, already consumed upstream. The only impure thing in the current
accumulators is the Plan's `useGM2` unit formatting, which is rendering and stays in the renderers.

The difference from the requirement half: there is no adapter (`nutrition-program-inputs.js`) to write, because the
input is not resolved from site state — it is the recommender's output, produced by the same call on both surfaces.
What replaces the adapter is the ordering rule in 3.3: accumulate the catalogue programme *before* the export merges
amendments into it.

### 3.3 Call sites after the change

| Call site | Today | After |
|---|---|---|
| `nutrition-prebble-integration.js` `buildRecommendationsHTML` 709-754, 962-1001 | A1 + A2 | `const acc = GAIP_NutritionDelivery.accumulate(program.monthly)`; `nutrientTotals = acc.totals` (raw), rows from `acc.products`. Keep the variable names `nutrientTotals` / `nutrientRequired` (GH-316 pins `classifyBalance('N', nutrientRequired.N, nutrientTotals.N)` at `tests/gh316-…:24-26`) and `Math.round(nutrients.P)` in the row (GH-318 pin). |
| `nutrition-au-fertiliser-integration.js` 531-578, 813-857 | B1 + B2 | same call on `program.monthly`; `annualSummary.products = acc.products` (so the persisted programme and the single export carry the shared shape); `nutrientTotals = acc.totals`. `program.delivered` / `program.balance` stay the recommender's and stay on the object; a unit test asserts `acc.totals ≈ program.delivered` (0.05) so the GH-391 invariant is checked, not assumed. |
| `nutrition-uk-fertiliser-integration.js` 941-960, 1032-1050 | B3 | same. |
| `word-export-combined.js` 2709-2783 | C | `productUsage = GAIP_NutritionDelivery.accumulate(perSampleProgram.monthly).products` for NZ and AU alike; delete the fallback. Runs before the amendment merge (2817) and before the b35fix323 schedule injection (2869-2916), as today. |
| `word-export.js` 9945-10048 (single export) | F | rebuild `data.nutritionProgram.annualSummary.products` from `prog.monthly` through the module rather than trusting whichever shape the integration persisted (a restored `window.GAIP_NUTRITION_PROGRAM` from an older session carries the old shape). |
| `word-export.js` `_computeProgrammeDelivered` 2638-2657 | D | unchanged reader; keep the `_isAmendment` skip and the `nutrients \|\| totalDelivered` read (amendment entries from `_amendmentDecisionsToProducts` still carry `totalDelivered`). GH-396's pins at `tests/gh396-…:314-330` survive. |
| `word-export.js` `_extractEntryNutrients` 2690-2746 | E | becomes a reader: N/P/K/S/Ca/Mg from `nutrients` (module output) or `totalDelivered` (amendments); the analysis-derived S/Ca/Mg branch and the P top-up are deleted. |
| Blades | — | `plan.blade.php` after line 1047 (`nutrient-balance-status.js`), before 1053; `reports/export.blade.php` next to `'nutrient-balance-status.js'` at 298; plus `hub.blade.php`, `reports/scenarios.blade.php`, `reports/forensic.blade.php` — the five blades GH-396's load-order test enumerates. |

`annualSummary.totalCost` (NZ) and `program.meta.annualPlan` are untouched.

---

## 4. Staged implementation

Each stage is one commit, shippable and revertible on its own; later stages do not rewrite earlier ones.

### Stage 0 — harness rows that are red today (GH-398 a) — 0.5 day

Add to `tests/e2e/ui-vs-export-parity.test.js` (section 6.3 lists the rows). Predicted result on the current code:
**`npm run test:e2e:slan` gains one failing test** ("Delivered per nutrient: Plan column vs export ANR Delivered" — P
14.0 vs 14.5, tolerance 0.05); `:burns` and `npm run test:e2e` (Test5) stay green on every new row. This is the
proof the harness would have caught it; commit the red state so stage 1's diff turns it green. Risk: none to
production code.

### Stage 1 — the shared module and the five call sites (GH-398 b) — 2 to 3 days

1. `assets/nutrition-delivery-core.js` per 3.1, with `liquidVolume` defaulting to `'per-month'` (today's behaviour)
   until D-3 is decided.
2. Call sites per 3.3. Delete: combined fallback 2713-2783 (replace, do not keep as `else`), `_extractEntryNutrients`'
   analysis branch 2719-2743, B2's loop body 545-551/570-576, UK 1036-1049, A1's two loops 722-747.
3. Tests: `tests/gh398-nutrition-delivery-core.test.js` (pure), `tests/gh398-delivery-consumers.test.js` (source
   pins: every consumer calls the module; the deleted loops are gone; blade load order), and the real-data fixture
   suite in 6.2.
4. Blades.

Printed numbers that move: Combined export ANR Delivered P on New test (14.5 → 14.0), Test1 (12.8 → 12.1), Canberra
(23.5 → 22.6), Westview (27.2 → 20.1), and the corresponding Balance/Status cells (all now equal to the Plan's); the
Purchasing Summary and Annual Product Summary P cells of the four AU liquids involved (all already print 0 at whole
kg — Greenmaster 0.36 and 0.7, Long Paddock 0.14 and 0.56 — so no visible change there except Westview's Greenmaster
row, 7 → 0). Nothing on the Plan moves. Nothing on Burns or Test5 moves. Predicted harness: 18/18 + new rows green
on all three fixtures.

Risks: (i) the persisted `nutritionProgram` in `site_configs` carries the old `annualSummary` shape until each site
regenerates — the single export must rebuild from `monthly` (3.3, row F) or read both shapes; (ii) GH-318/316/396
source pins (3.3) — keep the literal expressions they match; (iii) NZ `(Balance)` labels and `release` tags (3.1
item 6). Revert: `git revert` of the one commit; no data migration involved.

### Stage 2 — AU liquid P declared at the root (GH-398 c) — 1 day, after D-1

`au-fertiliser-products.js`: at 6291-6295 declare `P: Math.round(rateLHa × applications × analysis.P / 100 × 10) / 10`
(or add `pDelivered` to `selectFoliarNitrogen`'s return at 5630-5645 and read it) and at 6270-6271 add
`delivered.P += …`, mirroring GH-391's change at 6354-6356. Update `tests/gh391-…` (the invariant still holds and
must be re-asserted with a P-bearing liquid), `tests/gh331-au-p-supplementation.test.js` and
`tests/gh342-au-p-carryover-tracking.test.js` if their expected product sets move. Printed numbers: section 1.4,
stage-2 column — selection changes on New test, Test1, Canberra (rows only), Westview. Harness: stays green (both
surfaces move together); the SLAN fixture's product set changes, so `_whyThisSample` in
`tests/fixtures/e2e-parity-new-test-location-slan.json` should record the new set. Risk: the recommender's P
scoring reacts more than the 0.5 kg would suggest (New test over-delivers P by 4.7 kg after the change) — that is the
model doing what it does with a truer input, and it is the reason this is a decision, not a fix.

### Stage 3 — multi-application liquid volume and application count (GH-398 d) — 0.5 day, after D-3

Flip the module default to `liquidVolume: 'total'` and delete the option. Moves "Total Rate"/"Total kg/ha",
"Applications" and the Purchasing Summary volumes for every AU/UK liquid with `applications > 1` (section 1.4,
stage-3 column) on both surfaces equally. Harness: the rendered rows compare Plan to export (both move) — green; the
monthly roll-up at `ui-vs-export-parity.test.js:432-443` counts `rateKgHa × splitCount` for granular only and is
unaffected.

### Stage 4 — round once (GH-398 e) — 0.25 day, after D-4

Delete the 1-dp intermediate at `nutrition-prebble-integration.js:750-754`, `nutrition-au-fertiliser-integration.js:853-857`,
`nutrition-uk-fertiliser-integration.js:961`; print `nutrientTotals[k].toFixed(1)` in the Nutrient Delivery Summary
and `Math.round(nutrientTotals[k])` in the footer from the raw sum. Burns Plan footer N 126 → 125. Tighten the
harness tolerance at `:1456` from 1 to 0.5. Recommendation to fold, not separate: the module returns raw sums and the
renderers are being edited in stage 1 anyway; a separate ticket would have to reopen the same three lines.

### Stage 5 — "Total Delivered" row in the export's Annual Product Summary (GH-398 f) — 0.5 day, after D-5

`word-export.js` after 6099: one bold row from `_computeProgrammeDelivered(summary, n)` for each rendered nutrient
column (catalogue-only, as the K-recon gate defines the programme). Harness: the row "export Annual Product Summary
total vs Plan footer" (6.3, row 5) becomes assertable.

Not staged here (own tickets, section 8): passing `muldersFlags` to the export's recommender call; a UK branch in the
combined export; the UK per-month-share model.

---

## 5. Pitfalls

1. **Order against the amendment merge.** The export merges amendments into `productUsage` (`:2857-2867`, K-recon
   `:2966-2985`) and pushes their granular entries into `monthly[idx].granular` (`:2905-2916`). Accumulate the
   catalogue programme before both, as C does today; additionally skip `_isAmendment` entries from `totals` so a
   later re-accumulation cannot double-count. The K-recon entries carry `_isAmendment: true` (`word-export.js:3290`).
2. **`_computeProgrammeDelivered` must keep accepting `totalDelivered`.** Amendment entries from
   `_amendmentDecisionsToProducts` (3237, 3290, 3337) carry `totalDelivered`, not `nutrients`. Do not "simplify" the
   reader to `nutrients` only.
3. **Persisted programmes with the old shape.** `nutrition-calendar.js persistSiteConfigPatch({ nutritionProgram })`
   (`nutrition-au-fertiliser-integration.js:420-422`, prebble `:378-380`, UK `:866-868`) stores the integration's
   object; `/reports/export` restores it into `window.GAIP_NUTRITION_PROGRAM`. Until every site regenerates, the
   single export sees `annualSummary.products` entries with `totalDelivered` (AU) or `nutrients` (NZ) and no
   `nutrients` on AU. Rebuild from `monthly` in the single export (3.3, F), or the "one implementation" claim is false
   for the first export after deploy.
4. **A declared zero is a zero.** The `> 0` guard is the defect; do not carry it into the module. Consequence: until
   stage 2, AU liquids contribute 0 P on both surfaces — that is the intended stage-1 state (Plan unchanged, export
   aligned).
5. **`rateLHa` semantics.** AU solubles carry kg/ha in `rateLHa` (`au-fertiliser-products.js:5627`, b35fix282);
   NZ `MAPTECH` is a soluble listed in the liquid column (`nutrition-prebble-integration.js:964-965`). Branch on
   `form === 'soluble'` (and NZ's id/name special case) for `totalKgHa` vs `totalLHa`, never on which array the
   entry came from.
6. **NZ `-BAL` entries.** id `X-BAL`, name without "(Balance)", `isBalancing: true`; the Plan row today reads the
   recommender's label. Keying the module by id keeps them as separate rows; the label rule in 3.1 (6) keeps the
   text. The harness matches rendered rows by name and picks the closest `totalKg` among duplicates (`:1537-1544`).
7. **NZ Phase-3 surplus reduction rounding** (1.5 item 4). When it fires, the module's `monthly`-based totals differ
   from `program.meta.annualPlan.delivered` by up to ~0.15 kg/product. Do not reconcile by reading `annualSummary`;
   note it in the module header. If a future harness fixture triggers the reduction, the `acc.totals ≈
   annualPlan.delivered` unit assertion needs a 0.2 tolerance, not 0.05.
8. **AU `program.delivered` is not to be printed anymore, but it is not dead.** `netP`/`netK` caps (GH-342/343),
   `balance`, the strategic-P loop all read it. Assert equality with `acc.totals` in tests; never overwrite it.
9. **Source pins in existing tests** — GH-316 (`tests/gh316-annual-product-summary-balance.test.js:24-45`), GH-318
   (`:14-30`), GH-396 (`:314-330`, `:202-223`), GH-347 (`prebbles-products.js` body, unaffected), and
   `tests/nitrate-products-word-export.test.js` (references `totalDelivered`/`delivers` — read it before editing E).
   Keep the matched literals or update the pins in the same commit, with the reason.
10. **UK.** The module must not turn UK's per-month share into physical content by accident (D-2 option A). And the
    combined export's per-sample path never runs the UK recommender at all (F-1) — stage 1 cannot make Test6's
    document agree with its Plan page, and the plan must say so rather than let a green harness imply it.
11. **Harness fail-loud regex** (`ui-vs-export-parity.test.js:960`): the module's console prefix must not begin with
    `GH-36x:` / `GH-377 `; use `[NutritionDelivery]`.
12. **Floating point at exact halves.** 125.4999… is `113.1 + 7 + 5.4` in binary; rounding once from the raw sum
    prints 125, and a change in summation order could print 126. If the user wants stability, snap with
    `Math.round(x + 1e-9)` — but say so in the code, because it is a policy, not arithmetic.
13. **Combined vs single export share `word-export.js`'s renderer** (`buildSections` per sample), so the Annual
    Product Summary edits in stages 1 and 5 land in both documents at once; verify both.
14. **Do not touch** `nutrition-summary-integration.js`, `legacy-hub-markup.blade.php`, `site-data-transfer.js`,
    `hub-persistence.js` (old hub). `hub.blade.php` gets the script tag only because GH-396's load-order test
    enumerates it.

---

## 6. Test and live-verification strategy

### 6.1 Unit tests (jest, offline)

- `tests/gh398-nutrition-delivery-core.test.js` — the module alone: NZ entry with `splitCount: 2` counts twice;
  AU liquid with `applications: 4` counts once under `'per-month'` and four times under `'total'`; a declared
  `delivers.P = 0` stays 0 while `analysis.P = 1.7`; an entry without `delivers` is physical on all six keys; AU
  granular gets Ca/Mg/S from analysis and N/P/K from `delivers`; `_isAmendment` excluded from totals, present in
  products; soluble → `totalKgHa`; `isBalancing` → label; no rounding (assert `toBe`, not `toBeCloseTo`, on an
  input designed to have a long fraction).
- `tests/gh398-delivery-consumers.test.js` — source pins on the five consumers and the blades; the combined fallback's
  `fromDelivers > 0` literal and `_extractEntryNutrients`' `analysis[el]` branch are gone; `_computeProgrammeDelivered`
  unchanged.
- `tests/gh391-…` extended at stage 2 with a P-bearing liquid (Long Paddock Rapid Uptake shape).

### 6.2 Real-data fixtures (`tests/fixtures/`, per the README convention)

Save the six persisted AU/NZ monthly series read from the dev DB on 2026-09-10 as
`tests/fixtures/delivery-programme-<site>.json` (site id, `meta`, `monthly` only — no `annualSummary`, so the test
cannot pass by copying the old accumulator's output) and pin, per site, the figures of section 1.3/1.4 that are
verified: New test P 14.0 (today's Plan) at stage 1, N 138.8, K 104.6; Burns 125.5 / 12.3 / 0; Test5 237.4 / 0 /
213.4; Canberra 184.7 / 22.6 / 110.9; Test1 149.0 / 12.1 / 88.4. Federal Golf and Westview are saved but their
expectations are marked as re-run values (8.3). Stage 2 and 3 update the pinned numbers in the same commit that moves
them, with the stage named in the fixture's `_verifiedVia`.

### 6.3 Parity harness rows to add (stage 0)

The rows that would have caught the SLAN gap before GH-396, plus the ones that pin the rest:

1. **Delivered per nutrient, 1 dp, both surfaces' printed columns:** Plan Nutrient Delivery Summary `Delivered`
   vs export ANR `Delivered`, N/P/K, tolerance 0.05. (Today's test at `:1344-1391` compares the Plan column against
   the *sum of whole-kg product rows* with tolerance `0.5 × rows + 0.5` — on New test that is 4.5 kg, which is why
   14.0 vs 14.5 passed.)
2. **Unrounded programme totals, both surfaces' captured objects:** `plan.products.delivered[n]` vs
   `rec.out.delivered[n]` (`exportRecommenderCall()`), tolerance 0.001 — same recommender, same inputs, must be
   identical; a mismatch here is a selection or input divergence, not an accumulator one.
3. **Per-product P in the rendered rows:** extend `:1547-1550` with `rendered <name> P` beside N and K (tolerance 1).
4. **Export document self-consistency:** sum of the export's Annual Product Summary catalogue rows (N/P/K) vs the same
   document's ANR Delivered, tolerance `0.5 × rows + 0.5`; and (stage 5) the export's own "Total Delivered" row vs its
   ANR Delivered, tolerance 0.5.
5. **Plan self-consistency at 1 dp:** Plan Delivered column vs Plan footer, tolerance 0.5 today, 0.5 after stage 4
   with the `:1445-1456` tolerance tightened from 1.
6. **Liquid volumes (stage 3):** for every liquid in `plan.products.monthly`, `rateLHa × applications` summed per
   product vs the rendered "Total Rate"/"Total kg/ha" on both surfaces, tolerance 1.
7. **Selection inputs:** capture `muldersFlags` keys on both surfaces (the export hook already records
   `muldersFlagsKeys`) and assert equal — red on any site with a flag; documents finding 8.4 as a harness row even
   before it is fixed. Mark it `test.skip` with the finding number if the user prefers a green suite.

Predicted movement of the three fixtures: stage 0 — SLAN one new failure (row 1, P), Burns and Test5 unchanged;
stage 1 — all green; stages 2–5 — green, with the SLAN fixture's recorded product set updated at stage 2.

### 6.4 Live verification (after each stage)

- `npm run test:e2e:slan`, `npm run test:e2e:burns`, `npm run test:e2e` (Test5); `npm run test:e2e:all` before the
  Change log entry.
- Manually, New test - location / Putter Green: Plan → Nutrition → Nutrient Delivery Summary, P row: Delivered
  **14.0**, Status Deficit (−7 %); Reports → Export → Combined, Annual Nutrient Requirements, Putter Green / P:
  Delivered **14.0**, same Status; Annual Product Summary rows Greenmaster Liquid Spring & Summer and Long Paddock
  Rapid Uptake P **0**; Fertiliser Purchasing Summary P column for those two rows 0. After stage 2: 18.7 on both,
  and the product set of 1.4. After stage 3: Long Paddock 28 L/ha, 4 applications, on both.
- Burns / 12th Fairway after stage 4: Plan Annual Product Summary "Total Delivered" N **125**; rows 113 / 7 / 5.
- Test5 - NZ / Soccer: unchanged throughout (237.4 / 0 / 213.4); confirm the "(Balance)" row label and the "(QR)"
  release tags survived stage 1.
- Single export (Reports → Export, one sample) on New test: Annual Product Summary P cells equal the combined
  document's — this is the E-fallback deletion's visible effect.

---

## 7. Decisions for the user

**D-1 — Count phosphorus carried by AU liquid applications at the root (stage 2)?**
Today the AU recommender declares `P: 0` for every liquid (`au-fertiliser-products.js:6293`) and its pacing never sees
that P. Options: (a) leave it — Plan and export both print 14.0 on New test after stage 1, and 0.5–3.2 kg/ha of real
P per site stays uncounted (Test1 2.0, Canberra 1.3, Westview 3.2 on the re-run, New test 0.9); (b) declare and
accumulate it — printed P moves on both surfaces (New test 14.0 → 18.7, Test1 12.1 → 11.9, Canberra 22.6 → 23.9,
Westview 20.1 → 21.3 re-run basis) and the product set changes on New test (MAP Tech and Country Club IV 17-0-17
drop; Country Club IV 18-9-18 doubles), Test1 (MAP Tech 15 → ~7 kg), Westview (TPG Ratio and MAP Tech (soluble)
replaced by GTS Sport Series Enhance 34-1-6 and FoliMAX NRG-NK; N 204.7 → 217.1, K 139.6 → 117.3). Recommendation:
(b), because (a) keeps a false declaration that GH-391's own reasoning already rejected for nitrogen — but only with
the user having seen that New test over-delivers P by 4.7 kg afterwards and deciding whether that is the recommender
telling the truth or a second defect in its P scoring.

**D-2 — What "delivered" means per application.** (A) physical content of every listed application, everywhere;
(B) the recommender's declared `delivers` where it declares one, physical where it does not. (A) moves Test6 - UK
to 294.5 / 40.1 / 181.2 on both surfaces (from 199.8 / 27.9 / 125.4) and nothing else; (B) moves nothing on the
Plan. Recommendation: (B); the UK figure is a model question (8.2).

**D-3 — Multi-application liquid volumes and counts (stage 3).** Print `rateLHa × applications` and count each spray?
Moves Total Rate / Applications / Purchasing Summary on both surfaces: Federal Golf Urea Tech 30 → 60 kg/ha (2 → 4);
Test1 Long Paddock Sportsturf 15 → 60 L/ha (1 → 4), X Factor 30 → 60 (1 → 2); Canberra Urea Tech 15 → 30, Long
Paddock 7 → 28, FoliMAX 20 → 40; Westview Greenmaster S&S 417 → 657 L/ha; New test Long Paddock 7 → 28 (1 → 4).
Recommendation: yes — the client orders by this column, the Monthly Schedule already says "4x 7 L/ha", and NZ
already counts splits this way.

**D-4 — Round once (stage 4).** Burns Plan footer N 126 → 125 (rows 113 + 7 + 5). No other dev-site figure
changes. Recommendation: yes, folded in.

**D-5 — Add "Total Delivered" to the export's Annual Product Summary (stage 5).** One row per sample in every
document, equal to the Plan footer; catalogue-only. Recommendation: yes; without it the harness cannot compare the
two tables' totals and the reader cannot either.

**D-6 — Ticket numbering.** One ticket GH-398 with six commits (a–f), or GH-398 (stages 0–1), GH-399 (2), GH-400
(3–5). Either works with the Change log convention; the split makes the selection-changing stage 2 revertible under
its own number.

---

## 8. Findings outside this ticket's scope

**8.1 F-1 — UK sites are exported with the Australian catalogue.** `word-export-combined.js:2319-2320` knows only
NZ / not-NZ; `_useAU` is true for Test6 - UK. The Plan renders `UkFertiliserRecommender` output. Selection divergence
of the GH-387 kind, on a whole region. Needs a UK branch mirroring the Plan's `isUK()` and a fourth harness fixture
(Test6 - UK, sports, MLSN). Not verified live in this session — established from code and coordinates.

**8.2 F-2 — UK recommender applies a slow-release granular every month and credits a fraction.** `:495-499`
(`/ monthsCovered`). Physical N in Test6's twelve listed applications is 294.5 kg against 199.8 credited; Sportsmaster
Spring & Summer 910 kg/ha prints N 127. Either the covered months should not list the product, or the credit should
be the product's content. Model decision for the user; the delivery module must not resolve it by accident (D-2).

**8.3 F-3 — Two persisted programmes do not reproduce.** Federal Golf (generated 2026-09-08) and Westview
(2026-08-26) re-run to different N (129.6 vs 133.2; 200.4 vs 204.7) under `muldersFlags: {}`. Either their soils raise
Mulders flags on the Plan (8.4), or the recommender changed after they were generated (GH-391 on 2026-09-09 changed
`delivered.N` by exactly a P-source's N; Federal Golf's 3.6 kg gap is MAP Tech's N). Regenerating both on the Plan
would settle it; the figures in 1.4 for these two are marked accordingly.

**8.4 F-4 — `muldersFlags` are not passed to the export's recommender calls** (`:2488`, `:2656`). One-line divergence
in selection inputs; harness row 7 in 6.3 makes it visible.

---

## 9. Uncertainties, stated

- The stage-2 product-set changes were computed by patching a copy of `au-fertiliser-products.js` in the scratchpad
  and re-running on persisted monthly requirements with `muldersFlags: {}` and `hemisphere: 'south'`. On the four
  sites that reproduce today's persisted programmes exactly, they are the numbers the Plan would print; on Federal
  Golf and Westview they are the re-run's.
- The export's ANR Delivered figures in 1.4 are the combined accumulator re-executed offline on the Plan's persisted
  months, not read from rendered documents (except New test, whose 14.5 was rendered in GH-396's live run). The
  export regenerates per sample with the same inputs, and the four reproducible sites make the offline number the
  rendered number; a rendered document for Canberra / Test1 / Westview was not produced here.
- F-1 (UK export) is established from `_useAU`'s definition and Test6's coordinates, not observed.
- Whether NZ's Phase-3 surplus reduction ever fires on a dev site was not checked beyond the two NZ programmes
  present (it did not fire on either).

# GAIP Hub, Defect Handover

**Source artefacts:** three exports, two dashboard screenshot sets, and two product documents. Same site, same sample data throughout.

| Ref | Artefact | Generated |
|---|---|---|
| **E1** | `GAIP_Combined_Report_2026-08-08_3.docx` | 8 Aug 2026 21:35:34 |
| **E2** | `GAIP_Combined_Report_2026-08-16__1_.docx` | 16 Aug 2026 11:12:47 |
| **E3** | `GAIP_Combined_Report_2026-08-16.docx` | 16 Aug 2026 11:39:27 |
| **S1** | `intervention_window.zip`, 5 phone photographs of the dashboard. **Superseded by S2, retained only for the panels S2 does not cover.** | 16 Aug 2026 |
| **S2** | 4 native screen captures, reproduced as Fig 1 to Fig 4 in `figures/` | 16 Aug 2026 12:28 to 12:32 |
| **P1** | `Nitro-22_22-0-0_GP_Label-8.pdf`, Growth Products USA label, ref 20572USA-20190521 | issued 2019 |
| **P2** | `ammos_flier.pdf`, Prebble Turf NZ product page 54 for the same product | undated |

**Site:** Hoxton Soccer, listed Auckland NZ, perennial ryegrass sports field, cultivar Soprano (set between E2 and E3), 1 sample (zone "Soccer")
**Lab suite:** Hill Labs NZ, TURF Ryegrass Sand (S277), Olsen P + NH4OAc pH 8.1
**Distributor channel:** Prebbles NZ
**Reviewer:** J. Spencer / agronomic audit
**Date of this document:** 16 August 2026
**Revision:** v6.

**What changed in v6:**

**Routing correction.** v3 through v5.2 routed every defect on a Tier A / Tier B split meaning "shippable in the WordPress plugin now" versus "waits for the SaaS port". That split is superseded. The plugin is frozen and all three exports and all four screen captures came from the **current SaaS build**. Every defect in this document is against code the SaaS team owns. Nothing here needs a port-or-not assessment.

- **Tier A and Tier B redefined as effort and blast-radius classes**, not destinations. Tier A is renderer, gating and copy work that is small and independent. Tier B is engine and schema work that touches shared contracts. The classification of individual defects is unchanged; only what the label means has changed.
- **Four Tier B items were routed there partly because of WordPress constraints that no longer apply.** Flagged in section 12. They are likely cheaper than their label implies.
- **Plugin-specific delivery mechanics stripped.** Build numbering, the migration ledger, `GILBA_HUB_VERSION`, the hub-store proxy idiom and the GSSH enqueue note were all plugin conventions. Removed or reframed.
- **Module pointers downgraded further.** See the warning below. They are plugin filenames and may not survive in SaaS.
- **D30 is a live production defect**, not a pre-launch one. Prebbles NZ is a paying account and the export it receives recommends products from the wrong catalogue.

**What changed in v5.2:**

Sourced against the Gilba technical brief *Cool-Season DLI Thresholds by Species and Mowing Height* (J. Spencer, 16 Aug 2026), plus three fixes carried from the v5.1 review.

- **D48 added**, and it is better evidenced than it would have been: the DLI threshold does not branch on species or mowing height. See its entry for what a single threshold does to a bentgrass green.
- **D24 gains a second gate.** Growth potential and daily light integral are the two recovery constraints and the hub holds both on the same screen. On this site light is fine and temperature is binding, and the window should say which.
- **D37's citation replaced.** The recalled "low-to-mid 20s" is gone; the cool-season sportsfield figures are now cited properly. My earlier proxy of 21.8 was a bermudagrass figure and was wrong.
- **D40's slot count corrected** from 19 to 26. I had carried E2's superseded "9 active growing months" where E3 prints 12.
- **D07's Carrow citation dropped.** The 2 to 5% base-saturation target is basic cation saturation ratio doctrine, and Carrow, Waddington & Rieke are critical of BCSR rather than proponents of it. The defect stands on stronger ground without it.

**What changed in v5.1:**

A source-verification pass on my own figures, plus two agronomic rulings.

- **The Auckland climate normals used throughout this document were corrected against NIWA 1991-2020.** Every Auckland temperature in v3 to v5 came from recall, not from the dataset. They ran 0.2 to 0.6 degC cold in eleven of twelve months. **The error ran in the hub's favour**: against the verified normals, E3's GP series fits at RMSE 2.9 rather than the 5.5 previously reported. D02 is more solidly closed than v5 stated. Requirement tables shift by about a kilogram per month; no conclusion changes.
- **D37 withdrawn.** The DLI figure is physically sound. See its entry.
- **D25 reframed.** The sodium was almost certainly measured, not invented. Deleting the base saturation block was the wrong fix.
- **Blocking question 8 downgraded** from suspected data error to a labelling and grep task.
- **D24's growth-potential floor is now a settled parameter at 50%**, by agronomic ruling, not a flagged judgement call.
- **MESA composition confirmed**: quick-release ammonium sulphate plus slow-release methylene urea. D33's conclusion holds.

**What changed in v5:**

Native screen captures (S2) replaced the phone photographs, and the manufacturer label (P1) plus the NZ distributor page (P2) were supplied. Together they closed three open questions and forced four withdrawals of my own findings.

**Withdrawn in v5, my errors, not the hub's:**

- **D45 withdrawn entirely.** I read the Prebbles turf rate as exceeding the USA label. The NZ "30 to 50 L per 600 L" is a per-hectare rate by AU/NZ convention. The hub reads it correctly.
- **The 97 kg N ceiling claim withdrawn.** Built on the same USA-label misreading. The product set can reach the target; it is under-scheduled, not incapable.
- **The derived-from chemistry discrepancy withdrawn.** Urea-triazone and methylene urea are regarded as the same thing in AU/NZ practice. Product contents are per P1.
- **D24's decay coefficient corrected.** The phone photo showed day 1 as 17; it is 18. The generator is `ceil(20 x 0.851^n)`, not `20 x 0.86^n`. The finding is unchanged and now exact.

**New or rewritten:**

- **D41 closed on evidence and inverted.** Three independent checks on P1 and P2 confirm the analysis is % w/w. The export's method is correct; the UI's is the defect.
- **D44 rewritten in the opposite direction.** Per the agronomic ruling recorded at blocking question 7, sulphur is a secondary element and must not weight product selection. The defect is that the hub gives S a requirement figure and a reconciliation row, not that it fails to count delivered S.
- **D39 merged into D40.** The N shortfall is a carry-forward window coverage problem, and January plus November alone are 45 of the 74 kg.
- **D42, D43, D46, D47 added.** Unit flip, duplicated procurement row, unweighted component breakdown, and the third contradiction banner.
- Fixture extended to 27 assertions.
- Blocking questions 6 and 7 **closed**. Questions 3, 4 and 5 remain open.

**Carried from v4:**

- Two E1/E2 defects **closed on evidence** (D02, D04). One **closed by operator action** and reclassified (D03 mechanism).
- One defect **reopened as a regression** between E2 and E3 (D07). Still the highest-severity item after D30.
- **Cluster H**, distributor and product catalogue, contains **D30**, the priority item for the next build.
- **Cluster I**, dashboard surfaces.
- D01 **reframed** as one producer plus a stale copy, not three producers.
- D25 removed by deletion between E2 and E3, retained with disposition.

**Warning on module pointers.** Filenames such as `climate-module-v2.js`, `nutrition-calendar.js` and `word-export.js` are the **WordPress plugin modules that owned the behaviour**. They are named as a starting point for locating the SaaS equivalent, not as claims about the current tree. If SaaS restructured, a pointer that does not trace is not evidence the defect is absent. Locate by symptom first and by filename second.

This audit was done from rendered docx, screenshot and product-document evidence only, with no code access. Verify every pointer against current source before sizing the work, and rewrite the framing here if it does not trace.

---

## 0. How to read this

Forty-nine defect IDs across nine clusters. Four withdrawn on review (D11, D12, D37, D45), three closed on evidence (D02, D04, D41 as a question), one merged (D39 into D40), one reframed and open (D25), one investigation item (D13). That leaves **forty confirmed**.

Severity:

| Level | Meaning |
|---|---|
| **S1** | Wrong agronomic recommendation reaches a client. Liability exposure. |
| **S2** | Internally contradictory output. Credibility damage on inspection. |
| **S3** | Wrong number displayed, currently returning the right verdict by luck. Latent. |
| **S4** | Cosmetic, boilerplate, metadata. |

Tier A and Tier B are effort and blast-radius classes, not destinations. **Tier A** is renderer, gating, copy and display work: small, independent, low regression risk. **Tier B** is engine and schema work that touches shared contracts and needs a data-model decision before code. All of it lands in the same codebase.

### Reading the three-export sequence

E2 and E3 are 27 minutes apart. Between them the operator changed the site GPS coordinates and set the cultivar. That short interval is the most useful diagnostic material in this document, because it isolates what a single site-record write does and does not propagate to. Several findings below rest on the E2/E3 delta rather than on either export alone.

**A warning about direction of travel.** E2 fixed D07 and E3 broke it again. E2 broke D21's carve-out and E3 restored it. The codebase is oscillating on at least two items. Before the next build, establish what changed between those two states, because part of the work has already been done once and reverted.

---

## 1. What has already been fixed, and what was always right

This section exists because the defect list on its own gives a false impression of the codebase. Over eight days and three exports the hub has closed real defects, and several of the things this audit checked hardest turned out to be correct.

### Closed between exports

| Item | Was | Now | Landed |
|---|---|---|---|
| **D02** climate binding | Continental profile on a maritime site, winter N zeroed | Auckland record, GP RMSE 2.9 against verified NIWA normals; Jun/Jul/Aug now 10 / 7 / 8 kg N/ha | E3 |
| **D04** N reconciliation | 97 kg delivered against 250 target, silent | 204 delivered against 200 target | E3 |
| **D25** phantom sodium | Na 3.1% of base saturation with no source | block removed | E3 |
| Extraction-method awareness | Generic "SLAN guideline levels" strings | "Ammonium Acetate (Hill Labs)" throughout, with the NZ calibration stated | E3 |
| Lab suite provenance | Absent in E2 | Hill Labs NZ TURF Ryegrass Sand (S277) named in the header | E3 |
| Climate provenance | No source stated | NASA POWER climatology named, live weather explicitly excluded | E2 |
| Graceful degradation | Silent omission | "K reconciliation omitted, no fertiliser programme found for this site" | E2 |
| K sufficiency ceiling | Absent | Present and correct (**since reverted, see D07**) | E2 |

### Improved, not previously flagged as defects

**The framework comparison table is now better than it was in E1.** E3 added an extractant-compatibility column with an explicit yes/no per framework, and a closing note warning against Mehlich-3 conversion factors for formal recommendations. That note in particular is the kind of thing most competitors get wrong. It survived a round trip: E2 replaced it with a dual MLSN/SLAN verdict table, E3 put it back and improved it. Keep it.

**The K reconciliation table now shows working.** Requirement, delivered, balance and status in one row, rather than a bare advisory string.

**Cultivar profile is new capability.** It has defects (D28, D29) but those are finishing problems on a section that did not exist a week ago.

**The winter nitrogen rates are already correct.** Once D01 lands and the schedule moves onto the corrected Auckland series, June, July and August need no further work:

| | Jun | Jul | Aug |
|---|---|---|---|
| Auckland requirement, kg N/ha | 8.7 | 6.8 | 7.9 |
| Ammos 22 at 30 L/ha delivers | 8.2 | 8.2 | 8.2 |

Within a kilogram and a half on all three months. The rate selection for low-GP months is sound; only the high-GP months are mis-served (D40).

### Checked hard and found correct

These matter as much as the defect list, because they are the things a reviewer would most expect to be wrong.

- **The tissue verdict engine is right.** P, Mn and Zn flagged above optimal matches the perennial ryegrass column element for element across all ten measured elements. Two defects raised in v1 of this document (D11, D12) were withdrawn on that basis, one of them inverted. The engine was correct and the audit was wrong.
- **Every growth potential figure is arithmetically correct for its own input.** GP(8.3) = 10.4% printed 10, GP(9.4) = 15.6% printed 16, GP(10.8) = 24.7% printed 26. The PACE Turf C3 implementation is sound. D01 is a binding and caching problem, not a maths problem.
- **The liquid density conversion is correct.** Implied SG of 1.333 and 1.35 on two different products across two exports, both landing where a concentrated liquid N should. D09's arithmetic half is withdrawn; only the disclosure half survives.
- **The requirement ratios are defensible.** P/N at 0.101 sits almost exactly on the perennial ryegrass tissue midpoint of 0.105. K/N at 0.55 is within the range implied by the published band. The problem is the missing soil and tissue gate around them, not the ratios themselves.
- **K:Mg is computed correctly in meq.** Only Ca:Mg is on the wrong basis (D08).
- **Water quality interpretation is sound throughout.** EC, SAR, SARadj and RSC are read correctly and the narrative matches the numbers.
- **The hub already holds the correct cultural-practice rule.** The Recommendations panel states, unprompted and correctly, that aggressive cultural practices should be deferred at critically low growth potential. D24 is not a missing rule. It is one module failing to consult another that is already right.
- **The export handles liquid density correctly.** Confirmed against P1 and P2 (see D41). Three independent label checks agree the guaranteed analysis is % w/w and must be multiplied by specific gravity. The export does this; the UI does not. My v4 framing of D09 assumed the export was the suspect surface and it was not.
- **The Prebbles product rate is read correctly.** "30 to 50 L per 600 L" resolves to 30 to 50 L/ha, and the hub prints exactly that. D45 was raised in error and is withdrawn.
- **The delivered-nutrient arithmetic on every product row is correct** given the inputs the engine has. All five rows in the UI Annual Product Summary reconcile to the stated totals. Where the totals are wrong, it traces to a missing field on the product record, not to the calculation.

### What this means for sequencing

Two items have oscillated: the K sufficiency ceiling (correct in E2, reverted in E3) and the framework comparison table (correct in E1, replaced in E2, restored in E3). Both moved in the same 27-minute window. Before anything else is scoped, find out what that build did. Part of the work in this document has already been done once.

---

## 2. PRIORITY, ship first

### D30, distributor filter not applied to Word export product selection, S1, Tier A

**Figure:** Fig 4 (Prebbles-filtered UI program), against E3 section "Nutrition Program".

**This is the priority item. It should be a single-purpose build ahead of everything else in this document.**

**Evidence:** the on-screen nutrition program (S1, `prebbles nutrition program.jpg`) is headed `NZ Fertiliser Recommendations`, `DISTRIBUTOR: Prebbles`, `Filtered to Prebbles only`. The Word export for the same site, same session, recommends a different product set.

| | On screen (Prebbles NZ) | Word export E3 |
|---|---|---|
| Products | MAP Tech (soluble) 12-27-0, Ammos 22 (Nitro 22) 22-0-0, Pro Balance 15-0-13, Lo Biuret Urea (soluble) 46-0-0 | Sulphate of Ammonia (soluble grade), FoliMAX NRG-NK, FoliMAX N-Forcer-N |
| Channel | Prebbles NZ | AU catalogue |

**Consequence.** A New Zealand client on the Prebbles channel receives a Word report whose Fertiliser Purchasing Summary lists products from an Australian catalogue. That table exists to be handed to a supplier. Prebbles is the first commercial GAIP Hub go-live; this defect is client-facing, commercially embarrassing on that account specifically, and it reaches every NZ export.

**This is a live production defect.** Prebbles NZ is a paying account, the plugin is frozen, and this export is what the SaaS build sends today. Every NZ export currently carries a purchasing table the client cannot order from.

**Fix shape.** The distributor selection resolves correctly for the UI and does not reach the export's data-collection step. The shape to look for is an asymmetry between how the two surfaces read it: the UI resolves the filter from the live selection, the export reads from a different place and falls through to a default catalogue when it finds nothing. Two questions settle it. Is the distributor on the site record, on the session, or only on the UI component? And does the export path receive it at all, or receive it and ignore it?

**Blast radius.** The export renderers and whatever resolves the product catalogue. Any surface that filters products by channel is in scope. Confirm by grep before scoping.

**Verification for this build specifically.** Generate a Hoxton export with the Prebbles filter set, and assert that no product name outside the Prebbles catalogue appears in the Annual Product Summary, the Monthly Schedule, or the Fertiliser Purchasing Summary. Then generate an AU-channel export and assert the inverse. A silent fallback to a default catalogue must become a loud failure, same principle as D03's climate binding.

**Keep it separate.** Ship D30 on its own so its verification is unambiguous: one change, one assertion, one product list to check. Everything below can follow.

---

## 3. Cluster A, climate and growth potential

**Root cause hypothesis, revised in v4:** one climate producer, correctly bound, plus at least one stale copy that a site-record coordinate write does not invalidate.

### D01, divergent GP values in one document, S2, Tier A (downgraded from Tier B)

**Evidence, E3, one render, one instant, one site record:**

| Surface | August GP |
|---|---|
| Climate & Growth Conditions block (live, 10.8 degC) | **26%** |
| Monthly N Distribution | **33%** |
| Monthly Schedule | **5%** |
| Dashboard "Today's GP" (live, 8.3 degC) | **10%** |

**Reframed.** v3 called this three independent producers and specified consolidation to one. That framing is now wrong and should not be carried forward. The operator changed the site coordinates between E2 and E3. The Monthly N Distribution picked the change up. The Monthly Schedule did not, and still renders the pre-correction series byte-identical to E2's.

Coordinates are a single field on a single site record. They cannot hold two values in one render. So the divergence is not two bindings reading different data, it is one binding plus a cached or persisted copy that survives a site-record write.

**Proof that the UI shares the stale copy.** The on-screen Prebbles monthly program renormalises the pre-correction GP series across its nine non-zero months (sum 617) against a 200 kg N/ha target:

| | Jan | Feb | Mar | Apr | May | Sep | Oct | Nov | Dec |
|---|---|---|---|---|---|---|---|---|---|
| Stale GP | 86 | 97 | 95 | 58 | 17 | 19 | 53 | 92 | 100 |
| × 200 / 617 | 27.9 | 31.4 | 30.8 | 18.8 | 5.5 | 6.2 | 17.2 | 29.8 | 32.4 |
| UI prints | 27.8 | 31.4 | 30.9 | 18.5 | 5.5 | 6.2 | 17.1 | 29.7 | 32.4 |

Nine months, agreement to 0.3 kg. The UI monthly program and the export Monthly Schedule read the same stale copy.

**The live and dashboard values are not part of this defect.** GP(10.8) = 24.7%, printed 26. GP(8.3) = 10.4%, printed 10. Both are arithmetically sound against different temperature readings taken at different times. They need a stated semantic (see D01a) but they are not the bug.

**Fix shape.** Find what holds the resolved monthly series and make it invalidate on a site-record write. Two cheap probes separate the candidates: does the stale series survive a soft page reload? Does it survive a hard refresh? A memoised in-page value dies on the first; a persisted one survives both and lives in storage.

**Blast radius.** Suspected: `climate-module-v2.js` (producer), `nutrition-calendar.js` (Monthly Schedule and UI monthly program), `nutrition-requirement-engine.js` (N Distribution), `StorageAdapter` if the copy is persisted. Confirm by grep.

---

### D01a, GP surfaces do not state their temperature semantic, S3, Tier A, NEW

Four GP figures in one session, at 8.3, 9.4, 10.8 and monthly-normal temperatures. Each is right for its own input. None says which input it used. A reader cannot tell that "26%" is an instantaneous reading and "33%" is a monthly normal, so they read as a contradiction even where the maths is sound.

**Fix shape.** Every GP surface prints its temperature and the semantic of that temperature (live observation / monthly climate normal / forecast mean). Cheap, and it removes most of the apparent contradiction in D01 for a reader.

---

### D02, Monthly N Distribution GP series does not match the site's climate, S1, Tier B, **CLOSED**

**Disposition: closed in E3.** The corrected series fits the Auckland record:

| Series | Annual mean | Annual range | Peak | Trough |
|---|---|---|---|---|
| E3 Monthly N Distribution (fitted) | 15.6 | 8.2 | 19.7, mid Jan/Feb | 11.5 |
| Auckland, NIWA 1991-2020, **verified in v5.1** | 15.6 | 9.3 | 20.5, Feb | 11.2, Jul |

Against the verified normals the GP series matches at **RMSE 2.9**, with seven of twelve months inside 2 GP points and a worst case of 6 in May. The N split follows: Jun/Jul/Aug now receive 10 / 7 / 8 kg N/ha against 8.7 / 6.8 / 7.9 computed from the verified normals. The winter zeroing that E1 and E2 produced is gone.

**Revised in v5.1, in the hub's favour.** v5 reported this fit as "within 1.2 degC, worst month" against a recalled climate table that ran cold. Retrieved normals put the fit at RMSE 2.9 rather than the 5.5 implied by the recalled table. The closure is stronger than previously stated.

**Correction to v3, recorded so it is not repeated.** v3 offered two hypotheses for the E1 series, an anchor-point interpolation artefact and a daily-maximum feed. Both were wrong. It also called the E2 series non-physical; that was an artefact of forcing the cool branch of a function that is symmetric about 20 degC. Fitted properly, the E2 series is a coherent Southern Hemisphere record: annual mean 14.0, range 17.2, January peak 22.6, July trough 5.4. That is a real inland record, on the wrong site. The cause was a wrong coordinate, confirmed by the operator.

**What survives as a lesson, not a defect.** GP is symmetric about 20 degC, so any printed GP below 100% has two temperature solutions. Diagnosing a climate binding from printed GP alone requires branch disambiguation and is slow. See D02a.

---

### D02a, climate provenance printed without coordinates or temperatures, S2, Tier A, NEW

E2 and E3 print `long-term climate normals for this site's coordinates (NASA POWER climatology), not live weather`. Neither prints the coordinates, the resolved grid cell, or the twelve monthly temperatures the series was built from.

Consequence: a coordinate error is invisible in the artefact. It took three exports and a curve fit to identify one. Had the export printed its input vector, the error would have been visible in five seconds.

**Fix shape.** Print the resolved lat/long and the twelve monthly mean temperatures alongside the GP row. Temperatures, not GP, because of the branch ambiguity above.

---

### D03, Monthly Schedule GP series bound to a synthetic record, S1, Tier B

**Status: mechanism partially resolved, defect remains open.**

The E1 Monthly Schedule series (`50 / 70 / 100 / 44 / 4 / 0 / 0 / 0 / 4 / 44 / 100 / 70`) fits a pure cosine exactly, all twelve months to the printed integer, at annual mean 12.95 and amplitude 13.52. That places January at 26.5 degC and July at minus 0.6 degC, a 27 degC annual range. No station in Australia or New Zealand comes close; Alice Springs runs about 16. This series is generated, not observed.

**Distinguish this from D02.** The E2 series was a real record from the wrong place, caused by a coordinate error, now fixed. The E1 series was not a record at all. Do not treat the coordinate fix as having closed D03.

**Fix shape, unchanged from v3.** This module must fail loudly on a missing or unresolved climate binding rather than silently substituting a generated default profile. Silent fallback is the more dangerous half of this defect, and it is the same failure mode as D30's product catalogue fallback. Consider fixing both behind one rule: no module substitutes a default for an unresolved binding without emitting a blocking error.

---

## 4. Cluster B, nutrition reconciliation

### D04, programme N not reconciled against target, S1, Tier B, **CLOSED**

**Disposition: closed in E3.** Annual Product Summary N sums to 154 + 23 + 27 = **204** against a target of **200 kg N/ha**. Within tolerance and no longer silent.

**Blocking question 1 closed as a by-product.** The Annual Product Summary N/P/K/S columns are **elemental nutrient kg/ha**. Confirmed on three independent products across two exports:

| Product | Grade | Total kg/ha | Computed | Printed |
|---|---|---|---|---|
| Sulphate of Ammonia | 20.5% N | 752 | 154.2 | **154** |
| Sulphate of Ammonia | 24% S | 752 | 180.5 | **180** |
| Ammos 22 (E2) | 22% N | 90 | 19.8 | **20** |
| Ammos 22 (E2) | 22% N | 150 | 33.0 | **33** |
| MAP Tech (E2) | ~10% N | 39.6 implied | 4.0 | **4** |

D05 and D10 stand on this basis. D10 is now the only remaining piece of that question: the columns are correct and unlabelled.

---

### D05, P requirement under-delivered, unflagged, S2, Tier B

E2 and E3 carry no P in the programme against an 18.0 kg/ha requirement. The reconciliation layer added for N and K does not extend to P or S. Same missing-symmetry root cause.

---

### D06, P recommended into soil and tissue that are both above optimal, S1, Tier A

Olsen P soil 40 mg/L. The export's own Glossary states the typical adequate range for turf is 12 to 28 mg/L. Tissue P 0.62%, flagged above optimal by the export itself. P requirement nonetheless prints at 18.0 kg/ha in E3, and the Prebbles UI schedules MAP Tech in March.

The irrigation source is a surface lake (Simpsons lake), so applied P has a direct pathway. This remains the single line item most likely to be picked up by a council environmental officer.

**Fix shape unchanged:** removal-replacement logic gated by a sufficiency ceiling. See D07, which is the same fix and which has already been written once.

---

### D07, K supplement advised into a soil at 8.6% base saturation, S1, Tier A, **REGRESSION**

**This is the most serious item in the document after D30.**

| | E1 | E2 | E3 |
|---|---|---|---|
| K req kg/ha/yr | 100.0 (implied) | **0.0** | **100.0** |
| S req kg/ha/yr | 10.0 | **0.0** | **10.0** |
| K reconciliation | Advisory ~80 kg | omitted, no programme | Advisory ~80 kg |

E2 was correct and E3 reverted it. The methodology note shows the mechanism directly.

E2 read:

> Within the sufficiency range, req = removal only (soil reserves cover the agronomic requirement); below floor, req = removal + lift correction over years-to-correct; **above ceiling, req = 0**.

E3 reads:

> The figures below are annual removal-replacement estimates (clipping uptake), not deficit-closure rates.

The ceiling branch was deleted, not overridden. S req went 0.0 to 10.0 by the same route.

**Agronomic position, unchanged from v3:**

| | Value |
|---|---|
| CEC | 5.9 meq/100g |
| Ca 803 ppm / 200.4 | 4.01 meq, 68% base sat |
| Mg 129 ppm / 121.6 | 1.06 meq, 18% base sat |
| K 199 ppm / 391 | 0.51 meq, **8.6% base sat** |

Potassium sits at 8.6% of base saturation on a 5.9 meq/100g sand, and tissue K at 3.05% sits at the top of the published perennial ryegrass range of 2 to 3.42%. Soil supply and plant status both say sufficient. The hub advises a further ~80 kg K/ha.

**The strongest evidence is the hub's own.** E2 returned K req 0.0 for this exact soil twenty-seven minutes before E3 returned 100.0. Whatever the right agronomic framing, the same codebase computed both answers from the same data.

*(v5.1 and earlier cited a 2 to 5% base-saturation target to Carrow, Waddington & Rieke 2001. That range is basic cation saturation ratio doctrine and those authors are critical of BCSR rather than proponents of it, so the attribution was misleading. Dropped in v5.2. The defect does not need it and the argument is cleaner without a BCSR-versus-sufficiency detour attached.)*

**Action before coding.** Find what changed between the 11:12 and 11:39 states. If the ceiling was removed deliberately, that decision needs stating, because it is the difference between the hub advising 80 kg K/ha onto this field and not. If it was collateral damage from restoring the ammonium-acetate framing (see D21), the fix is small and it is the highest-value non-priority item on the list.

---

### D07a, requirement ratios are removal-only with no soil or tissue gate, S1, Tier B, NEW

**This is the general form of D06 and D07 and it should be scoped as one piece of work with them.**

The engine derives K and P from N by fixed ratio. From the Prebbles UI, month by month to the decimal:

- **K = 0.55 × N** (Jan 15.3/27.8, Feb 17.3/31.4, Nov 16.3/29.7, Dec 17.8/32.4)
- **P = 0.101 × N** (Jan 2.8/27.8, Nov 3.0/29.7, Dec 3.2/32.4)

The ratios themselves are defensible. P/N at 0.101 is close to the perennial ryegrass tissue midpoint (0.44 / 4.2 = 0.105). K/N at 0.55 sits at the low end of the range implied by the published band (2 to 3.42 K over 3.34 to 5.1 N).

Three problems.

1. **No soil gate.** Removal-replacement is arithmetically correct and agronomically wrong where soil reserves already exceed the sufficiency ceiling. That is D06 and D07.
2. **No tissue gate.** This plant's measured tissue ratios are K/N 0.667 and P/N 0.136, not 0.55 and 0.101. The model is under-reading K uptake and under-reading P uptake by a third, which is precisely why P is in luxury and unnoticed. Where tissue data exists it should govern, the same principle already stated in D15.
3. **Ca and Mg are not in this chain at all.** The requirements column carries N, K and P only. Ca and Mg reach the client through the amendment path, which is empty on this site. Any documentation or UI implying that Ca and Mg scale with the N programme is wrong.

**Also worth stating in the export.** GP does not set the N rate. The annual N figure is a site-level input; GP only distributes it across months. A GP-weighted split cannot correct a wrong annual target. Neither mineralisation from the 3.7% OM nor winter leaching on a sand profile enters the calculation. Both matter on this site.

---

## 5. Cluster C, unit handling

**Root cause hypothesis:** unit is carried as display metadata rather than as part of the value, so ratio and aggregation math runs on whatever unit the value happened to arrive in.

### D08, Ca:Mg computed in ppm, K:Mg computed in meq, printed adjacent, S3, Tier A

Present unchanged in all three exports.

- `Ca:Mg Ratio  6.2:1 (Optimal)`, this is 803/129, a **mass** ratio
- `K:Mg Ratio (meq)  0.48 (Optimal)`, this is 0.51/1.06, correctly **meq**

On a meq basis Ca:Mg is **3.78:1**. Both rows currently return "Optimal", so the defect is invisible on this dataset.

**Worked failure case:** soil Ca 1000 ppm, Mg 300 ppm. The hub prints 3.3:1 and evaluates it against a meq-calibrated threshold band. The true meq ratio is 2.02:1, a genuine Mg-dominance flag. The hub misses it.

**Aggravating factor:** E3 states cations were "converted from cert-native me/100g to ppm for amendment-math comparison". The meq values were present natively and were discarded before the ratio was computed. Compute cation ratios on the meq values, before or independently of the ppm conversion.

---

### D09, liquid volume and mass handled inconsistently across surfaces, S2, Tier A, **RESOLVED, see D41**

**The arithmetic half is withdrawn.** A density conversion is being applied, not a naive sum. Confirmed twice:

| Export | Quoted volume | Summarised mass | Implied SG |
|---|---|---|---|
| E2, Ammos 22 | 50 + 50 + 30 + 50 = 180 L/ha | 90 + 150 = 240 kg/ha | 1.333 |
| E3, FoliMAX N-Forcer-N | 4 applications × 25 L/ha = 100 L/ha | 135 kg/ha | 1.35 |

Both land where a concentrated liquid N should. The conversion is sound.

**The disclosure half stands, at S2.** The conversion is nowhere stated. The Monthly Schedule quotes L/ha, the Annual Product Summary and the Fertiliser Purchasing Summary print kg/ha under a `Total kg/ha` header, and nothing tells the reader a density was applied. The Purchasing Summary is the table someone orders from, and the product is sold by the litre.

**Superseded in v5.** P1 and P2 settled which surface is right. The export's conversion is correct and the UI's is not. The substance of D09 now lives at **D41** (the UI defect) and **D42** (the unit flip on Lo Biuret Urea). What remains here is the disclosure requirement:

**Fix shape.** Print the unit the product is sold in and state the SG used wherever a mass figure is derived from a volume. Do not silently change the unit between the schedule and the procurement table.

---

### D10, Annual Product Summary nutrient columns carry no unit header, S3, Tier A

Columns headed `N`, `P`, `K`, `S` with no unit. The semantics are now confirmed (elemental nutrient kg/ha, D04). Print them.

---

## 6. Cluster D, tissue sufficiency sets

Unchanged from v3 apart from status. E3 renders the tissue section identically to E1.

### Reference set, perennial ryegrass

From the comparative sets table for commonly used turf types (Spencer, *Nutrition of Sports Turf in Australia*, CSIRO/Landlinks):

| Element | PR band | Hoxton | Verdict |
|---|---|---|---|
| N % | 3.34 to 5.1 | 4.57 | in range |
| P % | 0.33 to 0.55 | 0.62 | **high** |
| K % | 2 to 3.42 | 3.05 | in range |
| Ca % | 0.25 to 0.51 | 0.27 | in range, at floor |
| Mg % | 0.16 to 0.32 | 0.21 | in range |
| S % | 0.27 to 0.56 | 0.47 | in range |
| Fe ppm | 97 to 934 | 588 | in range |
| Mn ppm | 30 to 73 | 189 | **high** |
| Cu ppm | 6 to 38 | 24.2 | in range |
| Zn ppm | 14 to 64 | 87 | **high** |

The export flags P, Mn and Zn as above optimal. That matches the reference set element for element.

### D11, WITHDRAWN, tissue Ca not flagged as low

Withdrawn in v2. The perennial ryegrass band is 0.25 to 0.51%; 0.27% is inside it. The 0.50 to 1.25% figure used in v1 was a generic cool-season range recalled without source verification.

**Interpretive note, not a defect.** Ca sits in the bottom 6% of its band while K sits in the upper third of its. That is the right direction for K/Ca antagonism, and Ca is xylem-mobile only, so delivery is transpiration-driven and constrained in a mid-winter Auckland canopy (Marschner 2012). Worth an agronomist's comment on the site.

### D12, WITHDRAWN, tissue Mn incorrectly flagged high

Withdrawn and inverted in v2. The perennial ryegrass band is 30 to 73 ppm; 189 ppm is 2.6x the top of the band. The 25 to 300 ppm figure is the couch range.

### D13, verify Hill Labs S277 band conversion, S3, Tier B, investigation item

E3 states "Hill Labs S277 sample-type sufficiency thresholds applied" and separately that cation values were converted me/100g to ppm. If the Hill Labs bands are natively expressed in me/100g, confirm the **bands** were converted alongside the **values**.

**Cheap test added in v4, no band table required.** If ppm values are being tested against native me/100g bands, no cation can ever flag low, because ppm figures are two to three orders of magnitude larger. Scan the NZ book for any K, Ca, Mg or Na low flag on an S277 site. If none exists across Prebbles and the rest of the NZ accounts, the bug is confirmed and D13 is systemic rather than cosmetic.

### D13a, tissue section names no sufficiency set and no source, S2, Tier A

The Soil Nutrition section devotes a full framework comparison table plus a note to explaining that the sample was extracted by NH4OAc + Olsen P and that MLSN and SLAN cannot be applied to it. The Tissue Analysis section renders `Phosphorus, Manganese, Zinc are above optimal levels` with no named set, no species qualifier, no citation, and no visible band.

The asymmetry is the defect. A reader cannot audit the tissue verdict, and neither could I: the two withdrawn entries above are the direct consequence.

**Fix shape:** print the set name, the species column used, the citation, and the band alongside each flagged element. Feed from the same citation registry as D21.

### D13b, wide survey-range bands rendered as hard thresholds, S3, Tier B

The ryegrass Fe band is 97 to 934 ppm, a 9.6x spread. Cu is 6 to 38 ppm, 6.3x. Rendered as low/sufficient/high gates these will functionally never flag. Fe at 588 passes; so would Fe at 900.

These are **survey spreads from field plots**, not calibrated sufficiency ranges. The source material makes the distinction explicit.

**Fix shape:** carry a band-quality attribute alongside each range. Wide survey-derived bands return a fourth verdict state, "measured, insufficient calibration to assess", rather than a manufactured "sufficient".

**Related, not yet a defect because the data is not captured:** tissue Fe, Mn, Al and Zn verdicts are sensitive to whether clippings were washed and to days since the last foliar or Fe application. The hub captures none of this.

### D13c, N:S and N:K ratio checks not implemented, S3, Tier A

The source set publishes two ratio checks alongside the bands:

- **N:S** should sit between 10:1 and 18:1. Above 20:1 signals potential sulphur deficiency.
- **N:K** should sit between 1.2 and 2.2.

Neither is computed in any of the three exports. Hoxton runs N:S at 4.57/0.47 = **9.7:1**, marginally below the stated floor, and N:K at 4.57/3.05 = **1.50**, mid-range.

Cheap to add, same source as the bands already in use, and the tissue section currently has almost no interpretive content beyond three element names.

---

## 7. Cluster E, cross-module contradiction

**Root cause hypothesis:** soil, tissue, amendment, climate and stress modules each render their own verdict with no arbitration layer.

### D14, boron flagged low and simultaneously declared adequate, S2, Tier A

Present unchanged in all three exports. Three statements in one document:

1. `Issues identified: B low (0.2 ppm).`
2. `All measured nutrients are at or above Ammonium Acetate (Hill Labs) guideline levels.`
3. `No standalone soil amendments required, all measured nutrients are at or above ... guideline levels.`

Statement 2 appears to be a default string emitted when the amendment decision set is empty, without consulting the issue list the soil module already produced.

### D15, soil Fe:Mn antagonism warning contradicted by tissue Mn two pages later, S2, Tier B

Present unchanged. Soil module fires `Fe suppresses Mn (Fe:Mn = 5.9, threshold 2.5)` with narrative on interveinal chlorosis on young leaves. Tissue Mn is 189 ppm against a band of 30 to 73. The plant is at 2.6x the top of its band. The soil-derived prediction is inverted, not merely unsupported.

**Empirical case for suppressing soil-to-tissue predictions generally:** across 197 paired soil and tissue samples from golf greens covering 20 parameters, only nitrogen and copper showed any soil-to-tissue correlation, and both were weak (Spencer, CSIRO/Landlinks).

**Fix shape:** where tissue data exists for an element, the tissue measurement governs. Suppress the soil-derived antagonism narrative for that element, or demote it to a conditional note that states the prediction was not borne out.

### D16, asserted mechanism was not measured, S2, Tier A

Present unchanged. The Fe:Mn narrative cites "high-Fe irrigation water" as a driver. **Fe is not in the water panel for this site.** The water analysis reports EC, pH, SAR, SARadj, RSC, Na, Cl, HCO3, B only.

Gate the clause on the measurement being present, or rewrite it to name candidate drivers conditionally.

### D25, phantom sodium in base saturation, S2, **RESOLVED BY DELETION**

E2 printed a Base Saturation block with `Sodium (Na) 3.1%`, which back-calculates to 0.183 meq/100g, roughly 42 ppm soil Na. No sodium appears in the soil panel and the water Na is 17 ppm, so it came from neither. Total base saturation of 97.8% depended on it.

**Reframed in v5.1: the sodium was almost certainly real.** Hill Labs' Basic Soil Profile reports pH, phosphorus, potassium, calcium, magnesium, **sodium**, cation exchange capacity and base saturation. Sodium is in the standard profile, so 42 ppm was most likely on the certificate and the base saturation calculation was using measured data.

**The defect is therefore display, not fabrication:** the soil panel omits a measured element that the base saturation block consumes. Same family as D19, which flags the glossary defining ESP and sodicity when no sodium is shown anywhere. Both are fixed by rendering Na in the soil panel.

**Disposition:** the whole Base Saturation block was removed in E3. **That was the wrong fix.** Base saturation is useful and the data behind it was sound. If the block is restored, restore it with sodium rendered in the soil panel above it, not without.

---

## 8. Cluster F, renderer and boilerplate

All Tier A, all present unchanged in E3 unless noted.

### D17, rootzone described as sandy loam while the lab suite is Sand, S2

`CEC is moderate (5.9 meq/100g), typical of sandy loam rootzones`. The selected lab suite is **TURF Ryegrass, Sand (S277)**. The narrative string is not consulting the sample-type field.

**Agronomic consequence, not just wording:** organic matter is 3.7% on a sand profile. That is an OM accumulation flag carrying surface sealing, infiltration loss and black layer risk. On an Auckland winter soccer field in peak season it is arguably the primary management issue on the site, and it appears nowhere in the report because the narrative has classified the profile as sandy loam where 3.7% reads as unremarkable.

**Fix shape:** OM interpretation must branch on construction type. Add an OM accumulation trigger for sand-suite samples.

### D18, orphaned Soil Amendment Recommendations section, S4

Renders a heading, a rationale paragraph on product selection logic, and a note about splitting kieserite and Epsom salts above 20 kg Mg/ha. No table, because no amendments were generated. Suppress the whole section when the decision set is empty, including the product-specific note.

**Aggravated in E3:** the Annual Nutrient Requirements note now reads "cation deficit-correction recommendations appear in the Soil Amendment table above". There is no such table. The note points at the orphan.

### D19, glossary not filtered to measured parameters, S4

Full-length definitions render for ESP, sodicity, gypsum, muriate of potash, SARadj and soil structure. Na is not in the soil panel, ESP is not calculated, SAR is 1.5, and no gypsum or MOP appears in the programme.

### D20, reference block not filtered to methods used, S4

Bermudagrass shade tolerance (Wu, Taliaferro & Martin 2011), bermudagrass ET (Amgain et al. 2018) and three salinity papers carried into a perennial ryegrass report with SAR 1.5 and EC 0.16 dS/m.

### D21, MLSN and SLAN each cited inconsistently, S4

| Work | References section | Glossary | Methodology footer |
|---|---|---|---|
| MLSN | Woods, Stowell & Gelernter (2014), PACE Turf | "developed ... by the Asian Turfgrass Center" | `PACE Turf MLSN (2014)` |
| SLAN | Kreuser, W.C. (2015), University of Nebraska-Lincoln | absent | absent |

The E3 framework comparison table adds a fourth and fifth form (Woods et al. 2016 PeerJ Preprints 4:e2144v1; Carrow et al. 2004 GCM 72(1):194-198). Establish one canonical citation per framework in a single citation registry and have every surface read from it.

**Carve-out honoured in E3, and the reason is worth recording.** E2 replaced the framework comparison table with a "Dual Interpretation: MLSN vs SLAN" table that rendered MLSN and SLAN verdicts side by side on Olsen/NH4OAc data, under a header warning that the extraction method was unspecified. That is precisely what the removed passage existed to prevent. E3 restored the comparison table and improved it with an extractant-compatibility column and an explicit warning against conversion factors. **Keep it. Do not replace it again.** Note that D07 regressed in the same build that restored it; check whether the two are connected.

### D28, NTEP trial data from a mismatched region applied without caveat, S2, Tier A, NEW

New section in E3 following the cultivar being set. The Soprano profile cites `Data source: NTEP 2004 Trial, North Central Region 2008 (pr04_09-11/pr0409t06.txt)`.

North Central Region is continental United States: cold winter, low humidity, different disease pressure. Using it to set a wear modifier and disease resistances for a maritime New Zealand site needs a stated caveat at minimum, and arguably a region-match check.

**Second error in the same block.** The wear modifier is inferred, not measured. The table rates NTEP Quality at 6.3 and labels it `Moderate`; the rationale line then reads `NTEP 2004 quality data, good overall quality suggests adequate wear`. NTEP publishes traffic tolerance as its own trait. Deriving wear from quality, and then calling 6.3 good where the table beside it says moderate, is two errors in one line.

**Fix shape.** Print the trial region alongside the citation, and gate or caveat where the trial region does not match the site's climate class. Use the published traffic tolerance trait where it exists; where it does not, say so rather than substituting quality.

### D29, camelCase identifiers and zero-information rows in the cultivar disease table, S4, Tier A, NEW

The Disease Resistance Profile renders:

| Disease | Resistance | Risk modifier | Confidence |
|---|---|---|---|
| Gray Leaf Spot | Average | 0% higher risk | none |
| `crownRust` | Average | 0% higher risk | none |

Two problems. `crownRust` is an internal identifier reaching client output; it should read Crown Rust. And both rows carry a 0% modifier at confidence `none`, so the table costs the reader attention and returns nothing. Suppress zero-modifier rows, same shape as D18.

---

## 9. Cluster G, confidence and metadata

### D22, Dew Prediction caps confidence on an export that excludes weather, S3, Tier A

Header states the export "captures soil chemistry and recommendations only". Footer reports `Data Quality: MEDIUM (60%)` with `Confidence capped by Dew Prediction (50%)`. Present unchanged in all three exports.

Confidence scoring must be scoped to the modules actually rendered in the artefact.

### D23, Hub Version renders as `unknown`, S2, Tier A

`Hub Version: unknown` in Report Metadata, in all three exports. These exports go to clients and can end up in commercial disputes and insurance matters.

Populate it from whatever the SaaS build identifies itself by, a release tag or commit reference, and **treat a failure to resolve it as a blocking export error rather than a printed string**. A report that cannot say which build produced it is not defensible in a dispute, and "unknown" is worse than absent because it looks like a value.

*(Earlier revisions specified `GILBA_HUB_VERSION`. That was the plugin PHP constant and does not apply here.)*

---

## 10. Cluster H, distributor and product catalogue

**Root cause hypothesis:** the product record is missing three fields it needs (density, release characteristic, source-document reference), and the export path has no distributor binding.

### D30, distributor filter not applied to Word export product selection, S1, Tier A

**See section 2. This is the priority build.**

### D26, product in the summary with no month in the schedule, S2, Tier A

E3 Annual Product Summary and Fertiliser Purchasing Summary both carry **FoliMAX NRG-NK, 3 applications, 152 kg/ha**. The Monthly Schedule has no row for it. Every month is either an explicit application of Sulphate of Ammonia or FoliMAX N-Forcer-N, a "covered by" carry-forward, or a dash.

The client procures 152 kg/ha of a product the programme never applies.

**Fix shape:** assert that the set of products in the Annual Product Summary equals the set of products with at least one scheduled application. Fail the export on mismatch.

### D33, no release-characteristic attribute on products, S2, Tier B

**Figure:** Fig 4.

Every product in the Prebbles programme is soluble or liquid. There are no slow-release granulars anywhere in the twelve-month schedule.

**Agronomic consequence.** Two hundred kg N/ha delivered entirely as soluble N onto a sand rootzone under an Auckland winter rainfall pattern is a leaching and flush-growth programme. It also makes every application a spray operation on a field carrying maximum traffic load.

**Answered in v5: it is the catalogue-gap branch.** The Notes column reads, for May and August, *"Low GP (17%) / (5%) - winter program: MESA + liquid foliar"*. MESA combines quick-release ammonium sulphate with slow-release methylene urea, in a granule. Confirmed in v5.1. The engine knows a slow-release granular belongs in the winter programme, names it in the note, and has no product to select. So this is not a selection-logic preference.

**And the missing attribute is confirmed present on a product that has it.** P2 headlines Ammos as "40% Smart Nitrogen", and the analysis bears it out: 8.8% slowly available of 22% total is exactly 40% of the nitrogen. The hub's record is `22-0-0`. So the programme is not entirely quick-release, and the hub cannot tell either way, because it has no field to hold the answer.

**Fix shape.** Add a release-characteristic attribute to the product record, populated from the guaranteed analysis where the label breaks out slowly-available N. Note that the export's own section preamble already claims products are "selected to match release characteristics with seasonal uptake patterns", which it currently cannot do.

**Second, separate issue in the same notes layer.** MESA is a US and AU product name appearing inside a Prebbles-filtered NZ programme. Boilerplate leakage of the same kind as D30, one layer down.

### D34, soluble products render under a Granular Products header, S4, Tier A

**Figure:** Fig 4.

The UI monthly program's `GRANULAR PRODUCTS` column contains only carry-over annotations for soluble products, for example `MAP Tech (soluble) (Feb) N:15.4 K:0.0 remaining`. Either the column is mislabelled or carry-over rendering is routed to the wrong column.

### D31, UI and export compute K and P requirements by different methods, S2, Tier B

**Figure:** Fig 4.

| | On screen (Prebbles UI) | Word export E3 |
|---|---|---|
| Annual N | 199.5 | 200 |
| Annual K | **109.9** | **100.0** |
| Annual P | **20.0** | **18.0** |

The UI derives K and P as fixed ratios off the monthly N series (D07a). The export derives them from removal-replacement in the requirements engine. The two land 10% apart on the same site. Two requirement engines, one product.

### D27, Monthly Schedule and Monthly N Distribution disagree on N timing, S2, Tier B

E3, N delivered by the block-application schedule against the distribution table it is nominally derived from:

| | Jan-Mar | Apr-Jun | Jul | Aug-Oct | Nov-Dec |
|---|---|---|---|---|---|
| Scheduled N kg/ha | 77 | 16 | 0 | 27 | 60 |
| Distribution N kg/ha | 72 | 46 | 7 | 33 | 42 |

Autumn under by two thirds, late spring over by 43%. The "Covered by (Apr)" carry-forward stretches one application across three months without carrying the mass to match.

Note this defect will move once D01 is fixed, because the two tables are currently on different climate series. Re-measure after D01 rather than scoping from these figures.

### D40, carry-forward windows leave January and November uncovered, S1, Tier A

**Figure:** Fig 4. **Absorbs D39, which was issued separately and is not a distinct defect.**

The UI Nutrient Recovery Summary reports the gap the programme creates:

| Nutrient | Required | Delivered | Balance | Status |
|---|---|---|---|---|
| N | 199.9 | 109.8 | -90.1 | Deficit |
| P | 20 | 6.2 | -13.8 | Deficit |
| K | 109.9 | 14.4 | -95.5 | Deficit |

All three flagged Deficit, none remediated. The note underneath reads *"K balance is short by 96 kg/ha. Load a soil sample to see whether spot-K reconciliation will fire at export."* The soil sample is already loaded on this site.

**Where the shortfall sits.** Correcting the two Ammos 22 rows for specific gravity (D41) moves delivered N from 109.8 to 125.6. Against the corrected Auckland requirement:

| Month | Required | Delivered | Gap |
|---|---|---|---|
| Jan | 24.5 | **0.0** | **-24.5** |
| Feb | 24.4 | 15.0 | -9.4 |
| Mar | 24.0 | 31.6 | +7.6 |
| Apr | 20.3 | 13.8 | -6.5 |
| May to Sep | 48.7 | 41.0 | -7.7 |
| Oct | 15.1 | 9.2 | -5.9 |
| Nov | 19.3 | **0.0** | **-19.3** |
| Dec | 23.6 | 15.1 | -8.5 |
| **Total** | **200.0** | **125.6** | **-74.4** |

January and November carry a requirement, receive no product, and are not marked "Covered by". Between them that is 43.8 kg N/ha, **59% of the entire shortfall**, in the two months either side of peak growth on a Southern Hemisphere site. Winter is within eight kilograms across five months. (Requirement column recomputed in v5.1 against verified NIWA normals; the previous table was about a kilogram per month out.)

**Fix shape.** The carry-forward logic works in three-month blocks and drops months that fall outside a block. Either extend coverage to every month with a non-zero requirement, or emit an explicit uncovered-month flag. Fixing this closes roughly 60% of the N gap without touching product selection.

**Not a physical limit.** At 0.2728 kg N/L, 200 kg N/ha needs 733 L/ha/yr, which is about 15 applications at 50 L/ha. E3 itself prints `12 active growing months`, which at 14-day intervals gives roughly **26 slots**. The hub schedules 8. This is an under-scheduling defect, not an impossible target. **A claim to the contrary in v4 is withdrawn.**

Twelve is also the agronomically correct count. On verified NIWA normals, June, July and August run 36, 28 and 32% growth potential; ryegrass in Auckland does not go dormant and no month has zero growth. (v5.1 stated 19 slots from nine months, carried forward from E2's superseded count, which was itself an artefact of the inland climate record zeroing three winter months. Corrected in v5.2.)

### D41, UI applies the guaranteed analysis to volume without converting by density, S2, Tier A

**Figure:** Fig 3. **Closes blocking question 6.**

The guaranteed analysis on a liquid fertiliser is **% w/w**. Three independent checks on P1 and P2 agree:

| Check | Source | Result |
|---|---|---|
| Weight per gallon 10.3 lb, 1 gallon contains 2.2 lb N | P1 | 21.4% by weight, i.e. the 22% analysis |
| Weight per gallon 10.3 lb converts to 1.234 kg/L | P1 | label states 1.24 kg/L |
| "Each litre contains 0.27 kg N" | P2 | 1.24 x 0.22 = 0.2728. A w/v reading would give 0.22 |

So volume must be multiplied by SG before the analysis is applied. The export does this. The UI does not.

| | UI prints | Correct at SG 1.24 |
|---|---|---|
| 150 L/ha, (QR) row | 33.0 kg N | **40.9** |
| 150 L/ha, (Balance) row | 33.0 kg N | **40.9** |
| 300 L/ha combined | 66.0 kg N | **81.8** |

**Fix shape.** The product record needs a density field. Every Growth Products label carries weight per litre in the same position, so the range can be populated from the labels rather than researched. Once density exists, the UI multiplies by it and the two surfaces agree.

### D42, Lo Biuret Urea flips unit between schedule and summary, S2, Tier A

**Figure:** Fig 4 against Fig 3.

Scheduled at 30 L/ha in April and 20 L/ha in October. Summarised at 50 kg/ha. Fifty of one becomes fifty of the other with no conversion. It is also a soluble solid being scheduled in litres in the first place. Same root cause as D08: unit is display metadata rather than part of the value.

### D43, one product renders as two procurement rows, S4, Tier A

**Figure:** Fig 3.

`Ammos 22 (Nitro 22) (QR)` at 5 applications / 150 L/ha and `Ammos 22 (Nitro 22) (Balance)` at 3 applications / 150 L/ha. Same product, same analysis, same unit. The Monthly Schedule confirms 8 applications totalling 300 L, so the aggregate is right, but a procurement table listing one product twice will get double-ordered.

The `(QR)` and `(Balance)` suffixes are internal selection-pathway labels reaching client output, same class as `crownRust` (D29).

### D44, sulphur is given a requirement and a reconciliation row, S2, Tier A, **REWRITTEN IN V5**

**Agronomic ruling, recorded at blocking question 7:** sulphur is a secondary element and must not be a factor in product selection over N, P and K. Delivered S is informational only.

**The defect is therefore the opposite of what v4 stated.** The hub currently treats S as a first-class requirement:

- E1 and E3 print an **S requirement of 10.0 kg/ha** in Annual Nutrient Requirements
- The Annual Product Summary carries a dedicated **S column**
- v1 of this document recorded S as "the one that happens to line up, requirement 10.0, delivered 10", which placed it inside the reconciliation layer D04 and D05 are about extending

**Fix shape.** Remove S from the requirement and reconciliation path. Render delivered S as an informational figure with no requirement, no balance and no status. Do not extend the D04/D05 reconciliation work to cover it.

**Do not extend this ruling to the release characteristic.** Ammos carries 40% slow-release N (8.8% slowly available of 22% total, per P1 and P2) and the hub's product record is `22-0-0` with no release attribute. That is a selection-relevant property, not a secondary nutrient, and it stays in scope at D33.

### D45, WITHDRAWN, programme exceeds label rate

**Original claim:** the hub schedules Ammos 22 at 30 and 50 L/ha against a labelled sports-turf rate of 1 to 2 US gal/acre, 9.4 to 18.7 L/ha.

**Disposition: withdrawn.** The claim compared an NZ programme against a USA label. The Prebbles NZ document states "Turf 30 to 50 L per 600 L", which is a per-hectare rate by AU/NZ convention even though the page does not spell out the area basis. The hub reads it correctly. Any turf response at that rate is a distributor labelling matter, not a hub defect.

**Residual, S4, documentation only.** The hub stores no record of which source document a rate came from. P1 and P2 give rates differing by roughly 3x for the same product, and settling which applied took two PDFs. Storing the source string alongside the rate would make a printed number auditable. Not worth a build on its own; fold into whatever touches the product record for D41.

---

## 11. Cluster I, dashboard surfaces

**New in v4.** These do not appear in the Word export and were audited from screenshots. All require screen or source confirmation before sizing.

### D24, intervention window is the inverse of a traffic-dominated composite with no forward data, S1, Tier B

**Figures:** Fig 2 (stress factors, trajectory, intervention window), Fig 1 (Recommendations panel, the contradicting rule), Fig 3 (Wear Resistance 0.0/10 card).

**Fully characterised in v4. v3 issued this against a partial screenshot; the mechanism is now identified.**

**Evidence, component weights and today's values:**

| Component | Weight | Value |
|---|---|---|
| Thermal | 20% | 0.7 |
| Light | 15% | 0 |
| Moisture | 20% | 0 |
| Traffic | 20% | **100** |
| Nutrition | 15% | 0 |
| Disease | 10% | 0 |

100 × 0.20 + 0.7 × 0.20 = **20.14**, printed as the day-zero index of **20**.

**The trajectory is a decay, not a forecast.** The fourteen printed values are `20 · 0.86ⁿ` to rounding, every one of them:

| n | 0 | 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8 | 9 | 10 | 11 | 12 | 13 |
|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|
| raw `20 x 0.851ⁿ` | 20.00 | 17.02 | 14.48 | 12.33 | 10.49 | 8.93 | 7.60 | 6.47 | 5.50 | 4.68 | 3.98 | 3.39 | 2.89 | 2.46 |
| `ceil` | 20 | 18 | 15 | 13 | 11 | 9 | 8 | 7 | 6 | 5 | 4 | 4 | 3 | 3 |
| printed | 20 | 18 | 15 | 13 | 11 | 9 | 8 | 7 | 6 | 5 | 4 | 4 | 3 | 3 |

Fourteen of fourteen, exact. Half-life 4.30 days, rounding mode `ceil`. **The v4 coefficient of 0.86 was fitted to a phone photograph in which day 1 read 17; the native capture reads 18.**

The index is essentially pure traffic. Traffic is known for today only, so the forecast is that single value decaying with nothing replacing it. **The window is fourteen days long because the decay guarantees it will be.** The module reads "we have no traffic data for the future" as "conditions are improving".

**Three supporting tells.** Traffic reads 100 out of 100, the maximum the scale allows, on a day the trajectory labels `NORMAL`. Every one of the fourteen days is labelled `NORMAL`, so 20 and 3 land in the same band. The window selects fourteen of fourteen days; a selector that never excludes anything is not gating.

**A fourth, worth one grep.** The Wear Resistance card reads `Recovery: 14d`. The intervention window is 14 days. If the window length is being taken from the recovery estimate rather than from the stress data, then the module is computing how long recovery would take and then recommending cultivation for exactly that period.

**The hub already holds the correct rule.** The Recommendations panel, same dashboard, reads:

> **CRITICAL** Perennial Ryegrass (C3) growth potential critically low (10%). Defer aggressive cultural practices, focus on stress recovery.

The Intervention Windows panel offers fourteen days for aeration, verticutting and topdressing. This is not a missing rule. It is a module that does not consult one that already exists and is already stated correctly.

**Agronomic position.** Verticutting opens the canopy; aeration opens the surface. Both create injury the plant repays out of growth. At 10 to 26% GP on an Auckland ryegrass field in late August, in the wettest quarter and at the tail of the winter code season, there is no repayment capacity and the surface stays open into September. The Wear Resistance card on the same screen reads `0.0/10, Recovery: Low, Poor`.

**Fix shape.** Intervention suitability gates on growth potential, not on the inverse of stress. Low stress and low recovery capacity coincide in winter; that is the case the current logic cannot represent. **The floor is 50% growth potential**, settled by agronomic ruling in v5.1 and no longer an open parameter. Verticutting, topdressing and aeration are all gated on it, with hollow-core aeration additionally held until GP is above the floor and rising rather than merely at it. Below the floor the correct output is an empty window with a printed reason, not a green light. Code the 50% as a named constant so it can be tuned per species later without a hunt through the module.

**Second gate, added in v5.2: growth potential is not the only recovery constraint.** Daily light integral has the same two-tier structure. For cool-season turf at sportsfield height the acceptability floor is around 9 mol/m2/day and the band at which the sward actually recovers rather than persists is around 20 (see D37 and D48). As the DLI brief puts it, a pitch held at 10 is a pitch that must be renovated rather than one that recovers. That is precisely the distinction this module cannot currently represent, expressed in light rather than temperature.

The hub already holds both numbers on the same screen. **The gate should be two-factor: growth potential at or above 50% AND daily light integral at or above the species-and-height recovery threshold.** Either one below floor returns an empty window naming the limiting factor.

On Hoxton that returns the right answer for the right reason: DLI 25.4 is above the recovery band and fine, GP is 10% and far below the floor, so the window prints "growth potential 10%, below the 50% cultivation floor" and says nothing about light.

**Second, smaller fix.** A composite index must not forecast forward on components it has no forward data for. Either hold the last known value, or drop the component from the weighting and renormalise, or truncate the forecast horizon to the data. Do not decay to zero and call it improvement.

### D38, thermal stress and growth potential are two temperature models that disagree, S3, Tier B, NEW

**Figures:** Fig 2 (Thermal 0.7), Fig 1 (Today's GP 10% at 8.3 degC).

Thermal stress reads 0.7 out of 100 at 8.3 degC. Growth potential reads 10% at the same temperature. One module says the plant is essentially unstressed by temperature; the other says it has almost no growth capacity. Both may be internally correct, because stress and capacity are different quantities, but nothing on the screen tells the reader that, and the stress index is what drives the intervention window.

**Fix shape.** Either fold a cold-capacity term into the thermal component, or state on the panel that thermal stress measures extremes and not growth constraint. The first is the better fix, because it makes the composite index usable for D24.

### D32, PGR reapplication fires at critically low growth potential, S2, Tier A, NEW

**Figures:** Fig 5 (PGR panel), Fig 3 (PGR Progress card).

The PGR panel shows `Reapplication window reached, apply now` and `Reapplication overdue` for Indigo Amigo (TE 120 g/L) against the Kreuser sinewave model, on turf the same dashboard has declared critically low on growth at 10% GP. There is nothing to suppress.

The Management Plan summary card reads `PGR Progress 100%` with a `Reapply now` badge. The native capture gives the underlying figure as **541 / 350 GDD**, which is 155%, a 191 GDD overrun, displayed capped at 100%. (The v4 reading of 501 was taken from a phone photograph.)

Two defects in one panel: a reapplication trigger that does not gate on GP, and a progress card capped at 100% that hides the extent of the overrun.

**Fix shape.** Gate PGR reapplication on the same GP floor as D24. Uncap the progress figure or state that it is capped.

### D46, Component Breakdown prints unweighted scores under a weighted heading, S4, Tier A, NEW

**Figure:** Fig 2.

The panel is headed *"Weighted contribution to today's ESI score"* and prints Thermal 1, Light 0, Moisture 0, Traffic 100. Those are the raw component scores. Weighted, Traffic contributes 20, not 100. The composite still resolves correctly at 20.14, so the heading is wrong rather than the arithmetic.

### D47, third contradiction banner, S2, Tier A, NEW

**Figure:** Fig 2.

Directly beneath a Traffic score of 100 out of 100, the page prints *"Conditions favorable. Good window for maintenance activities."* This is the third statement of the same contradiction on one screen, alongside the Intervention Windows panel and the Wear Resistance card, and against the Recommendations panel which states the correct rule. All four are rendered by different components with no arbitration between them.

Fixing D24 without also gating this banner and the Wear Resistance card leaves two of the four surfaces still contradicting the fifth.

### D35, "Reapply" label overlaps the Suppression and Rebound annotations, S4, Tier A, NEW

**Figure:** Fig 5.

PGR response curve renders overlapping text. Cosmetic.

### D36, Monthly N Need of 0 kg/ha styled as a positive state, S4, Tier A, NEW

**Figure:** Fig 3.

The Management Plan card reads `MONTHLY N NEED 0 kg N/ha this month` in green with a `Low` badge. On a played sportsfield in August, zero N is a consequence of the stale climate series (D01), not a good state. Colour and badge semantics invert the meaning.

Will partially resolve when D01 lands, since the corrected series gives August 8 kg N/ha. Fix the semantics anyway.

### D37, WITHDRAWN, DLI reading requires verification

**Figure:** Fig 1.

**Original claim:** the Growth Potential & Light Analysis panel reads `LIGHT (DLI) 25.4 mol/m2/day` for Auckland in mid-August, which recalled figures put at roughly 1.5x too high.

**Disposition: withdrawn.** Computed rather than recalled, the figure is sound. Extraterrestrial radiation at latitude -36.85 on 16 August is 21.0 MJ/m2/day with a 10.6 hour daylength. Converting at 2.05 mol PAR per MJ:

| Clearness index | Surface Rs | DLI |
|---|---|---|
| 1.00, atmosphere removed, absolute ceiling | 21.0 MJ | 43.1 |
| 0.75, clear sky | 15.8 MJ | 32.4 |
| 0.55, typical August | 11.6 MJ | 23.7 |

The printed 25.4 implies a clearness index of 0.59, which is 78% of clear sky. That is an ordinary bright August day. The panel is tagged "Live weather", so it is a daily reading rather than a monthly normal, and the recalled range of 12 to 18 that prompted the flag was a monthly-mean figure applied to the wrong quantity.

**The "Optimal" verdict also holds, and by a wider margin than v5.1 stated.** For cool-season turf at sportsfield height, 20 to 30 mm:

| Endpoint | DLI, mol/m2/day | Source |
|---|---|---|
| Quality, acceptable score | 8.4 | Abelard, Galbrun (DLF stadium trial, 2022) |
| Density | 7.5 | Abelard |
| **Wear** | **9.2** | Abelard |
| Biomass accumulation sustained | above 20.0 | Cockerham et al. (UC Riverside, 2002) |
| Photosynthesis maximised | 20.16 | Brito, Moutinho-Pereira (UTAD, 2023) |

So 25.4 clears not just the 9.2 wear floor but the ~20 band at which ryegrass recovers rather than merely persists. Light is not a constraint on this site.

*(v5.1 supported this with a recalled "low-to-mid 20s", and an earlier turn used 21.8 mol/m2/day as a ryegrass proxy. That figure is for a ryegrass-overseeded **bermudagrass** sward and is really a bermudagrass threshold. Corrected in v5.2 from the Gilba brief.)*

**The stated reason is also correct.** At 8.3 degC growth is temperature-limited rather than light-limited. The DLI brief's own first caveat states that published thresholds are summer transition-zone values and that the requirement falls in spring and autumn when temperature stress is off, so in an Auckland August the requirement is lower still. Light reading Optimal beside a GP of 10% is the hub correctly identifying which factor is limiting, not a contradiction.

**The threshold behind the verdict is a separate matter. See D48.**

### D48, DLI threshold does not branch on species or mowing height, S3, Tier B, NEW

**Figure:** Fig 1. **Raised while withdrawing D37: the reading is right, the threshold behind the verdict is the question.**

The panel prints one DLI figure and one verdict. Cool-season turf does not have one requirement. From the Gilba brief *Cool-Season DLI Thresholds by Species and Mowing Height* (J. Spencer, 16 Aug 2026):

| Surface | Requirement, mol/m2/day | Verdict a species-blind threshold gives at 25.4 |
|---|---|---|
| Ryegrass sportsfield, 20-30 mm | 9.2 wear, ~20 recovery | Optimal, **correct** |
| Poa annua green | persists below 10 | Optimal, **correct** |
| **Creeping bentgrass green, 3.2 mm** | **30** | Optimal, **wrong, 15% short** |
| **TifEagle couch green** | **32.6** | Optimal, **wrong, 22% short** |
| Couch fairway, summer | 24 to 26 | Optimal, **marginal at best** |

Same class as D08: the right verdict on this dataset, the wrong logic underneath, invisible until a bentgrass green runs through it.

**Fix shape, and this is the part that is easy to get wrong.** Do not implement a base threshold with a height modifier. The brief states the case directly: height is not a modifier applied to one number, it changes the requirement by a factor of three, and **no cool-season DLI by mowing-height factorial exists**. The only direct height experiment available is warm-season and the effect ran in opposite directions for zoysia and couch, so the direction cannot be transferred.

Implement a **species-by-height lookup of measured thresholds**. Where a cell has no published number, return the fourth verdict state from D13b, "measured, insufficient calibration to assess", rather than an interpolated one. Cool-season fairway and tee height, 10 to 15 mm, is one such empty cell for every species.

**Three further properties the current single-value model cannot hold:**

1. **Two thresholds per cell, not one.** Persist versus recover, the same structure as the second gate in D24.
2. **Seasonality.** Published values are summer transition-zone figures. A green failing 30 in January may be sound at 22 in April. Do not condemn a surface on one season.
3. **A field buffer.** Roughly 5 mol/m2/day above any plot-derived minimum before applying it to a live surface, because in-situ measurement performs poorly against controlled plots.

**Citation dependency.** If these thresholds are coded, the bentgrass 30 becomes a shipped number and needs a fetchable primary behind it. Russell, Karcher & Richardson (2019), *Crop Science*, doi 10.2135/cropsci2018.08.0501 is corroborated against the authors' 2017 ASA abstract but the paper itself is paywalled and unfetched. That moves from a vault-tidiness item to a build dependency.

---

## 12. Suggested sequencing

Ordering is by severity, dependency and shared root cause. Release granularity is a decision for whoever runs the SaaS pipeline; what follows is the order the work should be reasoned about, not a release plan.

**First, on its own.** D30. Distributor filter on the export path. It is the only S1 currently reaching a paying client on every export, and it is small. Keep it separate so its verification is unambiguous.

**Build 2, the K regression.** D07, plus the D07a soil and tissue gate if the investigation shows they are one piece of work. Establish what changed between 11:12 and 11:39 first.

**Build 3, the stale climate copy.** D01, D01a, D02a. One cluster. D27 and D36 partially resolve as side effects; re-measure D27 afterwards rather than scoping it now.

**Tier A renderer batch, in priority order.** D40, D41, D42, D44, D26, D23, D14, D47, D16, D17, D13a, D13c, D08, D10, D09 disclosure, D43, D18, D19, D20, D21, D22, D25, D28, D29, D34, D35, D36, D46.

D40 and D41 lead this batch. Between them they account for the entire N reporting error: D41 corrects delivered N from 109.8 to 125.6, and D40 closes roughly 60% of what remains. Both are renderer and scheduling work, neither needs the engine.

**Tier B engine work.** D03 (fail-loud on unresolved bindings, shares a rule with D30), D05, D07a, D13, D13b, D15, D24, D27, D31, D33, D38, D48.

D13b, D24 and D48 share a shape: each needs a verdict model that can express "below the threshold at which recovery happens" and "no calibrated threshold exists for this case", rather than collapsing both into a pass. Scope them together.

**Investigation, no code.** D13 unit check via the NZ-book low-flag scan, and the S277 versus S78 code question at blocking question 8. D25 moves out of investigation and into the Tier A batch: render sodium in the soil panel and restore base saturation above it.

D06, D07 and D07a are one agronomic problem with three surfaces. Scope them together even though D06 and D07 are Tier A and D07a is Tier B.

### Four items whose Tier B routing was a WordPress artefact

These were classed Tier B partly because they were too risky or architecturally awkward inside the plugin, not because of what they are. That constraint is gone and they are likely cheaper than the label implies:

| Defect | Why it was Tier B | What it is now |
|---|---|---|
| **D01** stale climate copy | Browser-side state and storage adapter, awkward to invalidate in a plugin | A cache-invalidation rule on a site-record write. In SaaS the stale copy is more likely a cached or materialised series than a browser memo; the discriminating probe changes accordingly |
| **D03** silent fallback on an unresolved binding | Fail-loud behaviour is hard to introduce safely into a live plugin | A single policy applied at every binding site. Shares a rule with D30 |
| **D33** no release-characteristic attribute | A product-schema change against an established plugin data shape | A schema addition. **Do this before the platform accumulates production data, not after** |
| **D13b** fourth verdict state | Touched the verdict contract every renderer reads | Same work, but with D24 and D48 needing the identical model. Three defects, one change |

### One decision that outranks the ordering

**D33's schema change should be settled early regardless of its position in the list.** Adding density, release characteristic and secondary nutrients to the product record is cheap now and expensive once real programmes are stored against the current shape. D41 and D44 both depend on it, and D45's residual folds into it. Treat it as a data-model decision to be made in the next week rather than a defect to be scheduled.

---

## 13. Regression fixture

Freeze the Hoxton dataset as a test fixture. It is unusually productive: one sample, one zone, no trend history, and it has now surfaced forty confirmed defects across nine classes over three exports, two screenshot sets and two product documents.

**Fixture inputs:**

- **Soil:** pH 6, Olsen P 40, K 199, Ca 803, Mg 129, S 75, Fe 168, Mn 28.3, Zn 5.7, Cu 1.3, B 0.2 ppm; OM 3.7%; CEC 5.9 meq/100g; suite S277 Sand
- **Tissue:** N 4.57, P 0.62, K 3.05, Ca 0.27, Mg 0.21, S 0.47 %; Fe 588, Mn 189, Zn 87, Cu 24.2 ppm
- **Water:** EC 0.16 dS/m, pH 7, SAR 1.5, SARadj 2.0, RSC -0.1 meq/L, Na 17, Cl 29, HCO3 23, B 0.02 ppm
- **Climate:** Auckland NZ, correct coordinates
- **Channel:** Prebbles NZ
- **Cultivar:** Soprano

**Assertions:**

1. All GP surfaces return the same value for a given month and temperature semantic, to one decimal
2. A constant 20.0 degC synthetic year returns 100% for all twelve months, C3
3. No month returns exactly 0% where the monthly mean exceeds 8 degC
4. Programme N delivered is within a stated tolerance of N target, or a flag is emitted
5. Same assertion for P, K and S, symmetrically
6. Cation ratios computed from meq values; Ca:Mg asserts 3.78, not 6.2
7. Tissue verdicts resolve against the perennial ryegrass column: P 0.62 high, Mn 189 high, Zn 87 high, and Ca 0.27, Mg 0.21, Fe 588, Cu 24.2, N 4.57, K 3.05, S 0.47 all in range. Assert the full ten-element verdict vector, not a subset
7a. Every flagged element renders its set name, species column, band and citation
7b. N:S computes to 9.7:1 and emits a below-floor note; N:K computes to 1.50 and does not
8. Zero amendment decisions suppresses the entire Soil Amendment Recommendations section including notes and any cross-reference to it
9. Glossary and reference blocks contain no term or citation absent from the rendered body
10. Export aborts rather than printing `Hub Version: unknown`
11. A climate series whose implied annual range exceeds 12 degC must not render on a site whose location resolves to New Zealand. Assert provenance, not just plausibility
12. Monthly GP series is reproducible from a printed monthly temperature vector, and that vector appears in the export. A series that fits a cosine to three significant figures fails
13. **A site-record coordinate write invalidates every cached climate series. Re-render after a coordinate change and assert all monthly GP surfaces changed**
14. **No product outside the selected distributor catalogue appears in the Annual Product Summary, Monthly Schedule, or Fertiliser Purchasing Summary**
15. **The inverse: an AU-channel export contains no NZ-only products**
16. **An unresolved distributor binding raises a blocking export error rather than falling through to a default catalogue**
17. **The set of products in the Annual Product Summary equals the set with at least one scheduled application**
18. **K requirement returns 0 where soil K exceeds the sufficiency ceiling. Assert on this fixture, where the E2 build returned 0.0 and the E3 build returned 100.0**
19. **Same assertion for P and S, symmetrically**
20. **UI and export return identical annual N, P and K requirements for the same site**
21. **Volume-quoted products print their unit and stated SG wherever a mass figure is derived from a volume**
22. **Intervention windows return empty when growth potential is below the 50% cultivation floor, with a printed reason. Assert on this fixture, where GP is 10 to 26% and the current build returns a fourteen-day window**
23. **A stress trajectory is not reproducible by a single-parameter decay fit across its full length**
24. **PGR reapplication does not fire below the 50% growth-potential floor**
28. **The DLI verdict resolves against a species-and-height threshold. Assert that 25.4 mol/m2/day returns Optimal on a ryegrass sportsfield and a below-threshold flag on a creeping bentgrass green at 3.2 mm**

25. **Every month with a non-zero nutrient requirement has either a scheduled product or an explicit covered-by reference. An uncovered month with a requirement fails**
26. **Delivered nutrient from a volume-quoted product equals volume x density x analysis. Assert Ammos 22 at 300 L/ha returns 81.8 kg N, not 66.0**
27. **No sulphur requirement or balance row is emitted. Delivered S renders as an informational figure only**

Assertion 18 is the regression guard for the E2 to E3 revert. It should be written before the D07 fix, not after. Assertion 26 is the regression guard for D41 and will fail on the current UI.

---

## 14. Blocking questions

**1. Annual Product Summary N/P/K/S column semantics. CLOSED.** Elemental nutrient kg/ha. Confirmed on three products across two exports (see D04). D05 and D10 stand; D04 is closed.

**2. Site record integrity for Hoxton. CLOSED.** The GPS coordinates were wrong and the operator corrected them between the 11:12 and 11:39 exports. The pre-correction record resolved to a Southern Hemisphere inland profile, annual mean 14.0 degC, range 17.2, January peak 22.6, July trough 5.4. The correction reached one consumer only, which is now D01.

**3. Which tissue set is the hub actually using? OPEN.** The verdict vector rules out the couch set and is consistent with the perennial ryegrass column. What a single ryegrass export cannot show is whether the set was *selected* by species or *hard-coded*. **Test:** run a couch or bentgrass site through and diff the printed verdicts. If they are identical in shape, it is hard-coded and D13a grows.

**4. Hill Labs S277 band units. OPEN.** Are the sufficiency bands natively me/100g, and were they converted alongside the values? **Test added in v4, no band table needed:** scan the NZ book for any K, Ca, Mg or Na low flag on an S277 site. If none exists across the whole NZ account base, the bug is confirmed and D13 is systemic.

**5. What changed between the 11:12 and 11:39 builds? NEW, blocking on D07.** The K sufficiency ceiling was present in the first and absent in the second, and the MLSN/SLAN framework table moved in the opposite direction over the same interval. If the ceiling was removed deliberately, that decision needs stating. If it was collateral, the fix is small.

**6. Does the Prebbles product catalogue carry a release-characteristic attribute? CLOSED.** No. It is a catalogue and schema gap, not a selection-logic preference. The engine names MESA in its own winter notes and has no product to select, and it records Ammos as `22-0-0` when the product carries 40% slow-release N. See D33.

**7. How should sulphur be treated? CLOSED by agronomic ruling.** S is a secondary element. It must not weight product selection over N, P and K. Delivered S renders as an informational figure with no requirement, no balance and no status. See D44.

**8. What do the S277 and S78 codes each refer to? DOWNGRADED in v5.1 from suspected data error to a labelling and grep task.**

Re-reading the two strings, they may not describe the same thing:

- Export: `Hill Labs S277 sample-type sufficiency thresholds applied (TURF Ryegrass, Sand (S277))`, which is a **threshold set**
- UI: `nutrient requirements calculated from Hill Labs Ammonium Acetate (S78) methodology`, which is an **extraction method**

If S277 names the turf sufficiency band table and S78 names the base ammonium acetate profile, both are true at once and there is no mismatch, only two codes rendered without saying what each refers to. That is the most economical reading and it is a one-grep test: are the two strings stored in different fields on the site or sample record?

Still worth running, for two reasons. It bears directly on **D13**, because if the bands come from an S277 turf profile while the requirements engine believes the methodology is a generic S78 profile, the two can carry different native units, which is exactly D13's open question. And whatever the internal truth, a reader comparing screen against export sees two different Hill Labs codes for one sample with no way to tell whether they are the same test. Print what each code refers to, or print one.

---

---

## 15. Figure appendix

Cluster I (dashboard surfaces) and D30 to D47 cannot be reproduced from a Word export. The evidence is on screen only. Figures ship alongside this document in `figures/`.

| Fig | File | Panels shown | Defects evidenced |
|---|---|---|---|
| 1 | `Fig01_growth_potential_and_recommendations.png` | Growth Potential & Light Analysis, Recommendations, Growth & Temperature, 8-day average GP | D24, D37, D38, D01a |
| 2 | `Fig02_stress_factors_and_intervention_window.png` | Stress Factors, 14-Day Stress Trajectory, Intervention Windows, Component Breakdown, "Conditions favorable" banner | D24, D38, D46, D47 |
| 3 | `Fig03_management_plan_and_nutrient_balance.png` | Management Plan cards, Nutrient Recovery Summary, Annual Product Summary | D24, D32, D36, D40, D41, D42, D43 |
| 4 | `Fig04_prebbles_monthly_program.png` | Prebbles NZ monthly program with requirements, granular, liquid/foliar and notes columns | D01, D30, D31, D33, D34, D40, D42 |

Two product documents are cited by reference rather than reproduced: **P1**, the Growth Products USA label for NITRO-22, and **P2**, the Prebble Turf NZ product page for the same product sold as Ammos. Both are the evidence base for D41, D44 and the withdrawal of D45.

### Figure provenance, and why it matters

Figures 1 to 4 are native screen captures. They replaced an earlier set of phone photographs of a monitor, and the replacement changed four findings:

| Finding | From the photograph | From the capture |
|---|---|---|
| D24 decay coefficient | day 1 read 17, fitted `20 x 0.86ⁿ` | day 1 is 18, exact generator `ceil(20 x 0.851ⁿ)` |
| D32 PGR overrun | approximately 501 / 350 GDD | **541 / 350 GDD** |
| Wear Resistance card | "Recovery: Low" | **"Recovery: 14d"**, which matches the window length |
| Pro Balance analysis | 15-0-13 | **15-0-12** |

The Nutrient Recovery Summary (D40) could not be read at all from the photograph and is the single largest finding in this revision. **Use native captures for any future evidence pack.**

### What is evidence and what is inference

Where a figure shows a number, the finding cites it. Where a finding rests on arithmetic over those numbers, the arithmetic is shown in full so it can be rechecked. The findings that rest on fitted models rather than direct reading are:

- D24's decay identification, `ceil(20 x 0.851ⁿ)`, fitted to the fourteen printed values in Fig 2
- D24's composite derivation, `0.7 x 0.20 + 100 x 0.20 = 20.14`, from the weights in Fig 2's Component Breakdown
- D01's proof that the UI shares the stale climate copy, from renormalising the stale GP series against Fig 4's requirements column
- D40's corrected monthly table, which applies the D41 density correction to Fig 3's product rows and compares against growth-potential-weighted requirements computed from NIWA normals

All four are reproducible from the figures and the cited sources alone.

## Sources for agronomic thresholds cited above

- Gelernter, W. & Stowell, L.J. (2005). Turfgrass growth potential model. PACE Turf. `GP = exp(-0.5*((T-To)/var)^2)`, To = 20 degC, var = 5.5 for C3.
- Woods, M.S., Stowell, L.J. & Gelernter, W.D. (2016). Minimum soil nutrient guidelines for turfgrass developed from Mehlich 3 soil test results. *PeerJ Preprints* 4:e2144v1.
- Carrow, R.N., Stowell, L.J., Gelernter, W.D., Davis, S., Duncan, R.R. & Skorulski, J. (2004). Clarifying soil testing III: SLAN sufficiency ranges and recommendations. *Golf Course Management* 72(1):194-198.
- Carrow, R.N., Waddington, D.V. & Rieke, P.E. (2001). *Turfgrass Soil Fertility and Chemical Problems: Assessment and Management*. John Wiley & Sons. K base saturation target 2 to 5%.
- Kreuser, W.C. & Soldat, D.J. (2011). A growing degree day model to schedule trinexapac-ethyl applications on Agrostis stolonifera golf putting greens. *Crop Science* 51:2228-2236.
- Jones, J.B., Wolf, B. & Mills, H.A. (1991). *Plant Analysis Handbook*. Micro-Macro Publishing.
- Marschner, P. (ed.) (2012). *Marschner's Mineral Nutrition of Higher Plants*, 3rd ed. Academic Press. Ca xylem mobility; Fe/Mn IRT competition.
- Spencer, J. *Nutrition of Sports Turf in Australia*. CSIRO / Landlinks Press. Comparative sufficiency sets for commonly used turf types, perennial ryegrass column. N:S and N:K ratio checks. The 197-paired-sample soil-to-tissue correlation finding cited at D15.
- Campbell & Plank (2000); Snyder & Cisar (2000). Sufficiency ranges, bentgrass and couch greens, as compiled in the above.
- Mills, H.A. & Jones, J.B. (1996). Zoysiagrass survey ranges, as compiled in the above.
- NIWA (now Earth Sciences New Zealand). Auckland monthly climate normals, 1991-2020, mean monthly air temperature: Jan 20.0, Feb 20.5, Mar 18.9, Apr 16.6, May 14.2, Jun 12.1, Jul 11.2, Aug 11.7, Sep 13.1, Oct 14.6, Nov 16.2, Dec 18.5 degC. **Retrieved and verified in v5.1.** Every Auckland figure in v3 through v5 was recalled rather than retrieved and ran 0.2 to 0.6 degC cold in eleven of twelve months.

**Threshold brief (P3), used for D37's withdrawal and D48:**

- Spencer, J. (2026). *Cool-Season DLI Thresholds by Species and Mowing Height*. Gilba Solutions technical brief, draft, 16 August 2026. Primary sources behind the figures used here: Abelard & Galbrun (DLF stadium LED/HPS trial, 2022); Cockerham, Ries, Riechers & Gibeault (UC Riverside growth chamber, 2002); Brito & Moutinho-Pereira (UTAD LED, 2023); Russell, Karcher & Richardson (2019), *Crop Science*, doi 10.2135/cropsci2018.08.0501; Wherley (Texas A&M / USGA, 2018); Bunnell et al. (2005) *Crop Science* 45:549-574 via Faust & Logan (2018).
- **Confidence, per the brief's own header:** medium on the sportsfield-height species figures; medium on the greens-height bentgrass threshold, which rests on a single peer-reviewed study corroborated by conference abstract but not yet fetched; **low on the height branch**, since no cool-season DLI by mowing-height factorial exists anywhere.

**Product documents (P1, P2), used for D41, D44 and the withdrawal of D45:**

- Growth Products Ltd (Princeton IL, USA). NITRO-22 22-0-0 guaranteed analysis label, ref 20572USA-20190521. Total N 22%, S 4%, weight per litre 1.24 kg, 8.8% slowly available N.
- Prebble Turf (NZ). Ammos 22-0-0 product page 54. Weight per litre 1.24 kg, "each litre contains 0.27 kg N", "40% Smart Nitrogen", turf rate 30 to 50 L per 600 L at 14 to 28 day intervals.

**Flagged as unverified, do not cite forward without checking:**

- Australian station means used to characterise the pre-correction climate profile (D02, blocking question 2) are from recall. No longer load-bearing, since the coordinate change is confirmed.
- Product-origin attribution, FoliMAX as Australian and the Prebbles range as NZ (D30), is from recall and should be confirmed against the catalogue.
- Sulphate of ammonia analysis at 20.5% N and 24% S (D04) is standard product specification, not verified against a specific supplier label.
- Auckland winter DLI range (D37) is from recall and is the reason D37 is an investigation item rather than a defect.

**Superseded in v2:** the generic cool-season tissue ranges cited at D11 and D12 in v1 (Ca 0.50 to 1.25%, Mn 25 to 300 ppm) were unverified recall, are not species-specific to perennial ryegrass, and should not be used.

**Superseded in v4:** the v3 hypotheses for D02, anchor-point interpolation and a daily-maximum temperature feed. Both were wrong. Also the v3 claim that the E2 monthly series was non-physical; it was a real record from the wrong coordinates. The cosine-fit test that identified it remains valid and correctly identifies the E1 Monthly Schedule series (D03) as synthetic.

**Superseded in v5, all four my errors rather than the hub's:**

- **D45 in full.** The Prebbles turf rate does not exceed label. "30 to 50 L per 600 L" is per hectare by AU/NZ convention. Comparing an NZ programme against a USA label was the wrong yardstick.
- **The 97 kg N/ha ceiling claim.** Same misreading. At 0.2728 kg N/L the product set can reach 200 kg N/ha in about 15 applications; the hub schedules 8.
- **The urea-triazone versus methylene urea discrepancy.** The two are regarded as the same thing in AU/NZ practice, and product contents are per P1. If release is ever modelled, store the release class rather than the compound name.
- **D44's original direction.** v4 said the hub fails to record delivered sulphur. The correct finding is that it should not be giving sulphur a requirement or a reconciliation row at all.

**Superseded in v5.1, my errors:**

- **D37 in full.** The DLI reading is physically sound at a clearness index of 0.59. I flagged it on recalled monthly-mean figures without computing the extraterrestrial ceiling first.
- **The Auckland climate normals used in v3 through v5.** Recalled, not retrieved. They ran 0.2 to 0.6 degC cold in eleven of twelve months, which made the hub's corrected series look worse than it is (RMSE 5.5 reported, 2.9 actual). Requirement tables have been recomputed.
- **D25's characterisation as a phantom value.** Sodium is in Hill Labs' standard soil profile, so the figure was almost certainly measured. The defect is that the soil panel does not display it.

**Also corrected in v5 from better evidence, not error:** the D24 decay coefficient (0.86 to 0.851 with `ceil`), the D32 GDD figures (501 to 541), the Wear Resistance card text, and the Pro Balance analysis (15-0-13 to 15-0-12). All four came from replacing phone photographs with native screen captures.

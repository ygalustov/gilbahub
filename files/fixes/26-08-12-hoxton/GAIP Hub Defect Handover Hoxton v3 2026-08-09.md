# GAIP Hub, Defect Handover

**Source artefact:** `GAIP_Combined_Report_2026-08-08_3.docx`
**Site:** Hoxton Soccer, listed Auckland NZ, perennial ryegrass sports field, 1 sample (zone "Soccer")
**Lab suite:** Hill Labs NZ, TURF Ryegrass Sand (S277), Olsen P + NH4OAc pH 8.1
**Generated:** 8 Aug 2026 21:35:34, Hub Version field printed as `unknown`
**Reviewer:** J. Spencer / agronomic audit
**Date of this document:** 8 August 2026
**Revision:** v3. Cluster D rewritten after the species-specific tissue sufficiency sets were supplied: two defects withdrawn, three added. Those three were issued as D24a/b/c in v2 and are renumbered D13a/b/c here so IDs run in document order. No other content change from v2.

---

## 0. How to read this

Twenty-four defect IDs, D01 to D23 plus D13a/b/c, found in a single one-sample export. Two of those (D11, D12) were withdrawn on review and are retained below with their disposition so the port team can see what was checked and cleared. D13 is an investigation item, not a confirmed defect. That leaves twenty-one confirmed.

They cluster into six classes, and the clustering matters more than the count: most are one root cause surfacing in several renderers.

Every module pointer below is a **hypothesis requiring grep confirmation**, not an assertion. This audit was done from rendered docx evidence only, with no code access. Per Checklist C, verify each source pointer against current source before sizing the work, and rewrite the framing here if it does not trace.

Severity:

| Level | Meaning |
|---|---|
| **S1** | Wrong agronomic recommendation reaches a client. Liability exposure. |
| **S2** | Internally contradictory output. Credibility damage on inspection. |
| **S3** | Wrong number displayed, currently returning the right verdict by luck. Latent. |
| **S4** | Cosmetic, boilerplate, metadata. |

Routing follows the existing Tier A / Tier B split: Tier A is shippable in the WP plugin now, Tier B waits for the SaaS port because it is architectural or engine-level.

---

## 1. Cluster A, climate and growth potential

**Root cause hypothesis:** three independent GP producers, only one of which is correct, none sharing a single climate-record binding.

### D01, three different August GP values in one document, S2, Tier B

**Evidence:**

| Location in export | August GP |
|---|---|
| Climate & Growth Conditions block (live) | **43%** at 12.8 degC |
| Monthly N Distribution (GP-Weighted) row | **35%** |
| Nutrition Program, Monthly Schedule | **0%** |

Same site, same page range, same report.

**Which one is right:** the live block. PACE Turf C3 growth potential (Gelernter & Stowell 2005) is `GP = exp(-0.5*((T-To)/var)^2)` with `To = 20 degC`. At T = 12.8 and var = 5.5 this returns 0.424. The live module reproduces this to within rounding. The climate engine is sound.

**Fix shape:** one GP producer, consumed by all three renderers. Do not patch the two annual tables to agree with each other. Per non-negotiable 6, the asymmetry between call sites IS the bug.

**Blast radius:** any renderer reading a monthly GP series. Suspected: `climate-module-v2.js` (producer), `nutrition-calendar.js` (Monthly Schedule), `nutrition-requirement-engine.js` (N distribution). Confirm by grep before scoping.

---

### D02, Monthly N Distribution GP series does not match the site's climate, S1, Tier B

**Evidence, printed series:**

`Jan 66 / Feb 66 / Mar 94 / Apr 94 / May 55 / Jun 26 / Jul 19 / Aug 35 / Sep 66 / Oct 94 / Nov 98 / Dec 77`

**Expected for Auckland**, C3 GP against NIWA 1991-2020 monthly mean air temperature:

| Month | Mean degC | GP |
|---|---|---|
| Jan | 19.5 | 100% |
| Feb | 19.9 | 100% |
| Mar | 18.5 | 96% |
| Apr | 16.1 | 78% |
| May | 13.7 | 52% |
| Jun | 11.5 | 30% |
| Jul | 10.7 | 24% |
| Aug | 11.3 | 29% |
| Sep | 12.8 | 42% |
| Oct | 14.4 | 60% |
| Nov | 16.2 | 79% |
| Dec | 18.2 | 95% |

Two signatures in the printed series:

1. **Duplicate-pair artefact.** Jan = Feb = 66, Mar = Apr = 94. Consecutive months returning byte-identical GP suggests interpolation from too few anchor points, or a lookup table with repeated rows, rather than a per-month temperature evaluation.
2. **Spurious summer depression.** Printed Jan (66) sits below printed Mar/Apr (94), producing a double-peaked curve. For a C3 species at an Auckland January mean of 19.5 degC there is no heat suppression at all: 19.5 is essentially at the optimum. A double peak here is not physical.

**Leading hypothesis for the summer depression:** the monthly engine is being fed **daily maximum** temperature where the live engine is fed daily mean. Auckland January mean maximum is roughly 23.7 degC, which returns GP 80%, materially closer to the printed 66% than the mean does. Alternatively a heat-derate branch intended for C4 or for continental C3 sites is firing at too low a threshold.

**Probe to settle it before any code change:** feed the engine a synthetic 12-month record of constant 20.0 degC. A correct C3 producer returns 100% for all twelve months. If it returns anything below 100 in the summer slots, a derate branch is firing. If it returns paired duplicates, the anchor-point interpolation is the fault. Two cheap probes separate the two hypotheses.

---

### D03, Monthly Schedule GP series appears bound to the wrong climate record, S1, Tier B

**Evidence, printed series:**

`Jan 50 / Feb 70 / Mar 100 / Apr 44 / May 4 / Jun 0 / Jul 0 / Aug 0 / Sep 4 / Oct 44 / Nov 100 / Dec 70`

**Three months at exactly 0% is not reachable for Auckland under any C3 formulation.** Using the July mean of 10.7 degC the floor is 24%. Even using the July mean *minimum* of about 7.1 degC the value is 6.4%, not zero. A hard 0 implies either a clamp, a missing-data default, or a different site's climate record.

The overall shape, four near-zero winter months plus a summer depression from a 100% peak, is a cold-inland Australian or high-altitude profile. It is not a maritime profile.

**Also check:** "Hoxton" is a Sydney suburb (Hoxton Park). The Location field reads Auckland, New Zealand and the lab suite is Hill Labs NZ. Confirm the site record is not cross-wired between a NZ site name and an AU climate station, or vice versa. This is a five-minute data check and it may explain D03 outright.

**Fix shape:** whatever the answer, this module must fail loudly on a missing or unresolved climate binding rather than silently substituting a default profile. Silent fallback to a default climate record is the more dangerous half of this defect.

---

## 2. Cluster B, nutrition reconciliation

**Root cause hypothesis:** reconciliation exists for K only. N, P and S are calculated as requirements but never checked against programme delivery.

### D04, programme delivers 97 kg N/ha against a 250 kg/ha target, unflagged, S1, Tier B

**Evidence, Annual Product Summary N column:** 4 + 26 + 20 + 14 + 33 = **97**.
**Evidence, Annual Nutrient Requirements:** N target **250 kg/ha/yr**.
**Shortfall: 153 kg N/ha/yr, 61% of target, silent.**

The report simultaneously prints a K reconciliation table flagging an 80 kg K shortfall as "Advisory". Flagging the smaller gap while staying silent on the larger one is worse than flagging neither, because it implies to the reader that unflagged nutrients were checked and passed.

**Open question for Jerry, blocking:** this defect assumes the Annual Product Summary N/P/K/S columns are **kg of nutrient per hectare**. If they are product-weight or percentage figures, D04 and D05 collapse and the rest of this cluster still stands. Confirm the column semantics before any code is written. If the columns are ambiguous to an agronomist reading the export, that ambiguity is itself a defect (see D10).

---

### D05, P requirement under-delivered, unflagged, S2, Tier B

P requirement 18.0 kg/ha. MAP Tech delivers 9. No flag. Same missing-reconciliation root cause as D04.

S is the one that happens to line up: requirement 10.0, delivered 4 + 6 = 10. Coincidence, not verification.

---

### D06, P recommended into soil and tissue that are both above optimal, S1, Tier A

**Evidence:**

- Olsen P soil: **40 mg/L**
- The export's own Glossary states the typical adequate range for turf is **12 to 28 mg/L**
- Tissue P: **0.62%**, which the Tissue Interpretation block itself flags as above optimal
- Programme nonetheless applies MAP Tech twice (March and November)

The report contradicts itself inside two pages and then fertilises against its own finding. The irrigation source on this site is a surface lake ("Simpsons lake"), so applied P has a direct pathway. This is the single line item most likely to be picked up by a council environmental officer.

**Fix shape:** removal-replacement logic must be gated by a sufficiency ceiling. Where the soil test exceeds the upper sufficiency bound for a nutrient, removal-replacement should not drive an application without an explicit override and a printed rationale.

---

### D07, K supplement advised into a soil at 8.6% base saturation, S1, Tier A

**Evidence and working:**

| | Value |
|---|---|
| CEC | 5.9 meq/100g |
| Ca 803 ppm / 200.4 | 4.01 meq, **68% base sat** |
| Mg 129 ppm / 121.6 | 1.06 meq, **18% base sat** |
| K 199 ppm / 391 | 0.51 meq, **8.6% base sat** |
| Sum | 5.58 of 5.9, 95% base saturation |

Conventional K target is 2 to 5% of base saturation (Carrow, Waddington & Rieke 2001). This soil is at 8.6%. Tissue K at 3.05% sits at the top of the published ryegrass range. The hub advises a further ~80 kg K/ha.

Same fix shape as D06: sufficiency ceiling gates the removal-replacement output.

---

## 3. Cluster C, unit handling

**Root cause hypothesis:** unit is carried as display metadata rather than as part of the value, so ratio and aggregation math runs on whatever unit the value happened to arrive in.

### D08, Ca:Mg computed in ppm, K:Mg computed in meq, printed adjacent, S3, Tier A

**Evidence, Cation Balance Analysis block:**

- `Ca:Mg Ratio  6.2:1 (Optimal)` , this is 803/129, a **mass** ratio
- `K:Mg Ratio (meq)  0.48 (Optimal)` , this is 0.51/1.06, correctly **meq**

On a meq basis Ca:Mg is **3.78:1**. Both rows currently return "Optimal", so the defect is invisible on this dataset. It will not stay invisible.

**Worked failure case:** soil Ca 1000 ppm, Mg 300 ppm. The hub prints 3.3:1 and evaluates it against a meq-calibrated threshold band. The true meq ratio is 2.02:1, which is a genuine Mg-dominance flag. The hub misses it.

**Aggravating factor:** the export states cations were "converted from cert-native me/100g to ppm for amendment-math comparison". The meq values were present natively and were discarded before the ratio was computed. Compute cation ratios on the meq values, before or independently of the ppm conversion.

---

### D09, product quantities aggregated across L/ha and kg/ha without conversion, S2, Tier A

**Evidence:**

- Monthly Schedule quotes Ammos 22 (Nitro 22) at `50 L/ha`, `50 L/ha`, `30 L/ha`, `50 L/ha`
- Annual Product Summary aggregates the same product as `90` and `150` under a column headed **Total kg/ha**
- Fertiliser Purchasing Summary repeats the kg/ha figures

Ammos 22 is a liquid. Either a density conversion is being applied silently, or L is being summed as kg. Neither is acceptable in a document a client hands to a supplier for procurement. The Purchasing Summary is the highest-consequence surface for this: it is the table someone orders from.

---

### D10, Annual Product Summary nutrient columns carry no unit header, S3, Tier A

Columns are headed `N`, `P`, `K`, `S` with no unit. See the blocking open question under D04. Whatever the semantics are, print them. An agronomist reading the export should not have to infer whether a column is nutrient kg/ha, product kg/ha, or percent.

---

## 4. Cluster D, tissue sufficiency sets

**Revised v2.** The original framing of this cluster claimed the tissue band table was mis-set in both directions. That claim was made against generic cool-season ranges recalled without source verification. When the species-specific comparative sets were supplied, the hub's tissue verdicts proved correct. The cluster is rewritten below. The residual defects are about **provenance, band quality and unimplemented ratio checks**, not about wrong thresholds.

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

The export flags P, Mn and Zn as above optimal. That matches the reference set element for element. The tissue verdict engine appears to be running this set already, or one materially equivalent to it.

---

### D11, WITHDRAWN, tissue Ca not flagged as low

**Original claim:** tissue Ca 0.27% should have been flagged low against a 0.50 to 1.25% band.

**Disposition:** withdrawn. The perennial ryegrass band is 0.25 to 0.51%. 0.27% is inside it. The 0.50 to 1.25% figure was a generic cool-season range recalled without source verification and does not apply to this species. The hub is correct to stay silent. Mg 0.21% is likewise inside its 0.16 to 0.32% band.

**What survives as an interpretive note, not a defect:** Ca sits in the bottom 6% of its band while K sits in the upper third of its. That is the right direction for K/Ca antagonism, and Ca is xylem-mobile only, so delivery is transpiration-driven and constrained at 43% GP in a mid-winter Auckland canopy (Marschner 2012). Worth an agronomist's comment on the site. Not worth a threshold flag, and not a code change.

---

### D12, WITHDRAWN, tissue Mn incorrectly flagged high

**Original claim:** Mn 189 ppm sits mid-range against 25 to 300 ppm and should not have been flagged.

**Disposition:** withdrawn and inverted. The perennial ryegrass band is 30 to 73 ppm. 189 ppm is 2.6x the top of the band. The hub's flag is correct. The 25 to 300 ppm figure is the couch range, not the ryegrass range.

**Consequence for D15:** the soil module's Fe-suppresses-Mn prediction is not merely unsupported by tissue, it is inverted. See the revised D15.

---

### D13, verify Hill Labs S277 band conversion, S3, Tier B, investigation item

Unchanged from v1, and note this one is **soil**, not tissue. The export states "Hill Labs S277 sample-type sufficiency thresholds applied" and separately that cation values were converted me/100g to ppm. If the Hill Labs bands are natively expressed in me/100g, confirm the **bands** were converted alongside the **values**. Converting one and not the other produces silently wrong sufficiency verdicts across every NZ site.

Cannot be resolved from the rendered docx. Requires the source cert plus the band table.

---

### D13a, tissue section names no sufficiency set and no source, S2, Tier A

**Evidence:** the Soil Nutrition section devotes a full framework comparison table plus a note to explaining that the sample was extracted by NH4OAc + Olsen P, that MLSN and SLAN are Mehlich-3 calibrated, and that they therefore cannot be applied. That is the strongest passage in the document.

The Tissue Analysis section renders `Phosphorus, Manganese, Zinc are above optimal levels` with no named set, no species qualifier, no citation, and no visible band.

The asymmetry is the defect. A reader cannot audit the tissue verdict, and neither could I: the two withdrawn entries above are the direct consequence.

**Fix shape:** print the set name, the species column used, the citation, and the band alongside each flagged element. Feed from the same citation registry as D21.

---

### D13b, wide survey-range bands rendered as hard thresholds, S3, Tier B

**Evidence:** the ryegrass Fe band is 97 to 934 ppm, a 9.6x spread. Cu is 6 to 38 ppm, 6.3x. Rendered as low/sufficient/high gates, these will functionally never flag. Fe at 588 passes; so would Fe at 900.

These are **survey spreads from field plots**, not calibrated sufficiency ranges. The source material makes the distinction explicit: the zoysia table on the same page is headed "Survey range" with the footnote "data obtained from survey of field test plots", and the surrounding text states that specific ranges have not been developed for most turfgrass species and cultivars.

**Fix shape:** carry a band-quality attribute alongside each range. Wide survey-derived bands return a fourth verdict state, "measured, insufficient calibration to assess", rather than a manufactured "sufficient". This is the same fourth-state recommendation that would have prevented a reader treating Fe 588 as a clean pass when the more likely explanation is sand contamination of unwashed clippings.

**Related, not yet a defect because the data is not captured:** tissue Fe, Mn, Al and Zn verdicts are sensitive to whether clippings were washed and to days since the last foliar or Fe application. The hub captures none of this. If sampling metadata is added, these verdicts should gate on it.

---

### D13c, N:S and N:K ratio checks not implemented, S3, Tier A

The source set publishes two ratio checks alongside the bands:

- **N:S** should sit between 10:1 and 18:1. Above 20:1 signals potential sulphur deficiency.
- **N:K** should sit between 1.2 and 2.2.

Neither is computed in the export. Hoxton runs N:S at 4.57/0.47 = **9.7:1**, marginally below the stated floor, and N:K at 4.57/3.05 = **1.50**, mid-range.

Cheap to add, same source as the bands already in use, and the tissue section currently has almost no interpretive content beyond three element names.

---

## 5. Cluster E, cross-module contradiction

**Root cause hypothesis:** soil, tissue and amendment modules each render their own verdict with no arbitration layer.

### D14, boron flagged low and simultaneously declared adequate, S2, Tier A

Three statements in the same document:

1. `Issues identified: B low (0.2 ppm).`
2. `All measured nutrients are at or above Ammonium Acetate (Hill Labs) guideline levels.`
3. `No standalone soil amendments required, all measured nutrients are at or above ... guideline levels.`

Statement 1 contradicts 2 and 3. Statement 2 appears to be a default string emitted when the amendment decision set is empty, without consulting the issue list the soil module already produced.

---

### D15, soil Fe:Mn antagonism warning contradicted by tissue Mn two pages later, S2, Tier B

**Strengthened in v2.** Soil module fires a Mulder's interaction warning: `Fe suppresses Mn (Fe:Mn = 5.9, threshold 2.5)` with narrative on interveinal chlorosis on young leaves. Tissue Mn is 189 ppm against a perennial ryegrass band of 30 to 73. The plant is not Mn deficient. It is at 2.6x the top of its band. The soil-derived prediction is inverted, not merely unsupported.

**The empirical case for suppressing soil-to-tissue predictions generally:** across 197 paired soil and tissue samples from golf greens covering 20 parameters, only nitrogen and copper showed any soil-to-tissue correlation, and both were weak (Spencer, *Nutrition of Sports Turf in Australia*, CSIRO/Landlinks). Soil ratios are poor predictors of tissue status as a class.

**Fix shape:** where tissue data exists for an element, the tissue measurement governs. Suppress the soil-derived antagonism narrative for that element, or demote it to a conditional note that states the prediction was not borne out. Do not print a predicted deficiency alongside a measured luxury.

---

### D16, asserted mechanism was not measured, S2, Tier A

The Fe:Mn narrative cites "high-Fe irrigation water" as a driver. **Fe is not in the water panel for this site.** The water analysis reports EC, pH, SAR, SARadj, RSC, Na, Cl, HCO3, B only.

Generic mechanism narrative must not name a driver the site's own dataset does not measure. Either gate the clause on the measurement being present, or rewrite it to name candidate drivers conditionally.

---

## 6. Cluster F, renderer and boilerplate

### D17, rootzone described as sandy loam while the lab suite is Sand, S2, Tier A

pH and CEC Context block: `CEC is moderate (5.9 meq/100g), typical of sandy loam rootzones`. The selected lab suite is **TURF Ryegrass, Sand (S277)**. The narrative string is not consulting the sample-type field.

**Agronomic consequence, not just a wording issue:** organic matter is 3.7% on a sand profile. That is an OM accumulation flag carrying surface sealing, infiltration loss and black layer risk. On an Auckland winter soccer field in peak season it is arguably the primary management issue on the site, and it appears nowhere in the report because the narrative has classified the profile as sandy loam where 3.7% reads as unremarkable.

**Fix shape:** OM interpretation must branch on construction type. Add an OM accumulation trigger for sand-suite samples.

---

### D18, orphaned Soil Amendment Recommendations section, S4, Tier A

The section renders a heading, a rationale paragraph on product selection logic, and a note about splitting kieserite and Epsom salts applications above 20 kg Mg/ha. There is no table, because no amendments were generated. Suppress the whole section when the decision set is empty, including the product-specific note.

---

### D19, glossary not filtered to measured parameters, S4, Tier A

Full-length definitions render for ESP, sodicity, gypsum, muriate of potash, SARadj and soil structure. Na was not measured, ESP was not calculated, SAR is 1.5, and no gypsum or MOP appears in the programme. Filter the glossary to terms actually used in the rendered document.

---

### D20, reference block not filtered to methods used, S4, Tier A

The References section carries bermudagrass shade tolerance (Wu, Taliaferro & Martin 2011), bermudagrass ET (Amgain et al. 2018) and three salinity papers into a perennial ryegrass report with SAR 1.5 and EC 0.16 dS/m. Filter to methods actually invoked.

---

### D21, MLSN and SLAN each cited three inconsistent ways, S4, Tier A

| Work | Framework comparison table | References section | Glossary |
|---|---|---|---|
| MLSN | Woods, Stowell & Gelernter (2016) PeerJ Preprints 4:e2144v1 | Woods, Stowell & Gelernter (2014), PACE Turf | "developed ... by the Asian Turfgrass Center" |
| SLAN | Carrow, Stowell, Gelernter, Davis, Duncan & Skorulski (2004) GCM 72(1):194-198 | Kreuser, W.C. (2015), University of Nebraska-Lincoln | , |

The Methodology footer adds a fourth MLSN form, `PACE Turf MLSN (2014)`. Establish one canonical citation per framework in a single citation registry and have every surface read from it.

**Keep the Framework Comparison table itself.** Explaining why MLSN and SLAN cannot be applied to NH4OAc/Olsen data is correct, well written, and a genuine differentiator. Most competitors get this wrong. The defect is citation inconsistency across surfaces, not the content.

---

## 7. Cluster G, confidence and metadata

### D22, Dew Prediction caps confidence on an export that excludes weather, S3, Tier A

The header states: *"Live disease pressure, irrigation status, and pre-emergent timing update ... in the GAIP Hub dashboard. This export captures soil chemistry and recommendations only."*

The footer then reports `Data Quality: MEDIUM (60%)` with `Confidence capped by Dew Prediction (50%)`.

A weather sub-model is gating the headline confidence of a document that explicitly excludes weather outputs. Confidence scoring must be scoped to the modules actually rendered in the artefact.

---

### D23, Hub Version renders as `unknown`, S2, Tier A

`Hub Version: unknown` in Report Metadata. These exports go to clients and can end up in commercial disputes and insurance matters. Version traceability is not optional. Populate from `GILBA_HUB_VERSION`, and treat a failure to resolve it as a blocking export error rather than a printed string.

---

## 8. Suggested sequencing

**Tier A, plugin-shippable now.** D06, D07, D08, D09, D10, D13a, D13c, D14, D16, D17, D18, D19, D20, D21, D22, D23. Sixteen items, mostly renderer and gating. D06, D07, D09 and D23 are the client-facing ones and should lead.

**Tier B, SaaS.** D01, D02, D03, D04, D05, D13, D13b, D15. Eight items across three engine clusters: the GP producer consolidation, the reconciliation layer, and the tissue provenance / band-quality work. Each cluster is one piece of work, not three to eight.

**Added to Tier A in v2, renumbered in v3:** D13a and D13c. Both are renderer-level and both are cheap. D13a is the higher value of the two: it is the defect that let two false findings survive the first audit round.

Per non-negotiable 9, do not bundle. Ship single-purpose builds and hold the rest in the ledger.

---

## 9. Regression fixture

Freeze the Hoxton dataset as a test fixture. It is unusually productive: one sample, one zone, no trend history, and it still surfaced twenty-one confirmed defects across six classes.

Fixture inputs:

- **Soil:** pH 6, Olsen P 40, K 199, Ca 803, Mg 129, S 75, Fe 168, Mn 28.3, Zn 5.7, Cu 1.3, B 0.2 ppm; OM 3.7%; CEC 5.9 meq/100g; suite S277 Sand
- **Tissue:** N 4.57, P 0.62, K 3.05, Ca 0.27, Mg 0.21, S 0.47 %; Fe 588, Mn 189, Zn 87, Cu 24.2 ppm
- **Water:** EC 0.16 dS/m, pH 7, SAR 1.5, SARadj 2.0, RSC -0.1 meq/L, Na 17, Cl 29, HCO3 23, B 0.02 ppm
- **Climate:** Auckland NZ, 12.8 degC at generation

Assertions worth encoding:

1. All GP surfaces return the same value for a given month, to one decimal
2. A constant 20.0 degC synthetic year returns 100% for all twelve months, C3
3. No month returns exactly 0% where the monthly mean exceeds 8 degC
4. Programme N delivered is within a stated tolerance of N target, or a flag is emitted
5. Same assertion for P, K and S, symmetrically
6. Cation ratios computed from meq values; Ca:Mg asserts 3.78, not 6.2
7. Tissue verdicts resolve against the perennial ryegrass column: P 0.62 high, Mn 189 high, Zn 87 high, and Ca 0.27, Mg 0.21, Fe 588, Cu 24.2, N 4.57, K 3.05, S 0.47 all in range. Assert the full ten-element verdict vector, not a subset, so a band-table regression cannot pass by matching three flags
7a. Every flagged element renders its set name, species column, band and citation
7b. N:S computes to 9.7:1 and emits a below-floor note; N:K computes to 1.50 and does not
8. Zero amendment decisions suppresses the entire Soil Amendment Recommendations section including notes
9. Glossary and reference blocks contain no term or citation absent from the rendered body
10. Export aborts rather than printing `Hub Version: unknown`

Item 4 depends on the D04 open question being settled first.

---

## 10. Blocking questions

1. **Annual Product Summary N/P/K/S column semantics.** Nutrient kg/ha, product kg/ha, or percent? D04, D05 and D10 all hang on this.
2. **Site record integrity for Hoxton.** NZ site name, NZ lab suite, and a GP profile that looks Australian and inland. Confirm the climate station binding before treating D03 as an engine defect.
3. **Which tissue set is the hub actually using?** The verdicts match the perennial ryegrass column exactly, which suggests it is already correct and merely unlabelled. Confirm by grep rather than inference. If it is hard-coded rather than sourced from a registry, that changes the shape of D13a.
4. **Hill Labs S277 band units.** Are the sufficiency bands natively me/100g, and were they converted alongside the values? Determines whether D13 is cosmetic or systemic across the whole NZ book.

---

## Sources for agronomic thresholds cited above

- Gelernter, W. & Stowell, L.J. (2005). Turfgrass growth potential model. PACE Turf.
- Woods, M.S., Stowell, L.J. & Gelernter, W.D. (2016). Minimum soil nutrient guidelines for turfgrass developed from Mehlich 3 soil test results. *PeerJ Preprints* 4:e2144v1.
- Carrow, R.N., Stowell, L.J., Gelernter, W.D., Davis, S., Duncan, R.R. & Skorulski, J. (2004). Clarifying soil testing III: SLAN sufficiency ranges and recommendations. *Golf Course Management* 72(1):194-198.
- Carrow, R.N., Waddington, D.V. & Rieke, P.E. (2001). *Turfgrass Soil Fertility and Chemical Problems: Assessment and Management*. John Wiley & Sons.
- Jones, J.B., Wolf, B. & Mills, H.A. (1991). *Plant Analysis Handbook*. Micro-Macro Publishing.
- Marschner, P. (ed.) (2012). *Marschner's Mineral Nutrition of Higher Plants*, 3rd ed. Academic Press.
- Spencer, J. *Nutrition of Sports Turf in Australia*. CSIRO / Landlinks Press. Comparative sufficiency sets for commonly used turf types; perennial ryegrass column. Also the 197-paired-sample soil-to-tissue correlation finding cited at D15.
- Campbell & Plank (2000); Snyder & Cisar (2000). Sufficiency ranges, bentgrass and couch greens, as compiled in the above.
- Mills, H.A. & Jones, J.B. (1996). Zoysiagrass survey ranges, as compiled in the above.
- NIWA. Auckland monthly climate normals, 1991-2020.

**Superseded in v2:** the generic cool-season tissue ranges cited at D11 and D12 in v1 (Ca 0.50 to 1.25%, Mn 25 to 300 ppm) were unverified recall, are not species-specific to perennial ryegrass, and should not be used. Both defects built on them are withdrawn.

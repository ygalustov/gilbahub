# R2 — amendment rates and one verdict per nutrient: what changed, how to check it, what is not done

Build: [FOR NIKA: build / commit of the handover]. Date: [FOR NIKA: date of handover].

Scope: the Word report (single-sample and combined). On-screen pages are not part of R2 and are not described here, except where a screen and the report can be compared on the same sample.

---

## 1. Where this delivery does not close R2 — read this first

**1.1. We have not seen A11 and A12.** The work order says the tests sit in the agronomist's evidence record; we do not have that record. This document is mapped to the four sentences of the R2 requirement instead. If A11 or A12 checks something those four sentences do not say, it is not covered here. Please send the text of A11 and A12, or run them and tell us which part fails.

**1.2. "Rates come from the computed deficit" — met for three products only by removing the number.** For lime, gypsum driven by irrigation water, and Epsom salts driven by tissue, the report has no calculation that produces a rate. The literal ranges were deleted and the report now names the product and the reason without a rate. No number in the report comes from a literal for these products, but no number comes from a computed deficit either. A computed rate for them would be new agronomic logic and needs your agronomist's method.

**1.3. Thresholds are still code literals without a recorded origin.** The verdicts behind every instruction in this section are decided by thresholds that live in code: the Hill Labs certificate floors, the species pH optimum and ceiling, and the irrigation-water EC and SAR levels (cool-season EC 1.5 / 2.0 dS/m, SAR 4 / 6; warm-season EC 2.5 / 4.0, SAR 6 / 9). Moving them into a data file with value, unit and origin is R8, which is next in our queue after your check of R2.

**1.4. Still in the report, open on our side:**
- **Bicarbonate in irrigation water** prints "Consider acidification to pH 6.5-7.0." It does not say what is to be acidified (the water, by its context) and it does not depend on the soil pH verdict.
- **Potassium is decided twice — this is inside R2 and not closed.** The K row of the Annual Soil Amendments table (soil K below the floor) and the spot-K supplement of the K reconciliation (programme K short by more than 20 kg K/ha and soil K more than 5 ppm below the floor) are two decisions, and neither sees the other: the spot-K balance does not count the soil-deficit K. Whenever spot-K fires, the table's K row fires on the same sample too, so one report prescribes potassium sulphate twice, at two rates, in two sections. That is two verdicts on one nutrient, which R2's fourth sentence rules out. [FOR NIKA: replace with the change once decided and accepted, or keep as not done.]
- **Certificates with a % base saturation axis (S81, fescue):** no amendment is computed from that axis; the report says so. This was the behaviour before R2 as well.
- **pH method (your M3, "affects R2's branch too")** is Part B and is not in this delivery. R2 handles a sample with no pH reading (see 2.7); it does not convert between water and CaCl2 pH.

[FOR NIKA: if the "pH not reported" change and the two acidification sentences (our queue: delivery 2 and GH-819) are not accepted before handover, move 2.7 and 2.8 here as "not done".]

[FOR NIKA: the two screen-vs-report items (AA thresholds without a certificate code; gypsum level from SAR) are fixed before handover — add each to section 2 when accepted.]

---

## 2. What changed in the report

Mapped to the four sentences of R2.

| R2 sentence | Before | Now | Ref |
|---|---|---|---|
| Delete the hardcoded dolomite / kieserite text | Cation Balance Analysis advised "dolomite at 1-2 t/ha or kieserite at 200-400 kg/ha" from its own threshold, also when the amendments table said Mg is not needed | The text is gone. A magnesium product is named only by the Annual Soil Amendments table | GH-808 |
| Rates never from a literal | Range rates in prose: dolomite, kieserite, lime 1-2 t/ha, gypsum 1-2, 2-3, 2-4 and 3-4 t/ha in different sections, Epsom in the tissue sections | No range rate anywhere in the report. A rate is printed only where it is computed from a deficit (P, K, Ca, Mg, S in the amendments table). Lime, water-driven gypsum and tissue Epsom are named without a rate (see 1.2) | GH-808, GH-810 |
| One verdict per nutrient | One element was decided in up to seven places; the table, Cation Balance and Interpretation could each say something different | The amendments table is the only place that chooses a product and a rate. Interpretation and Cation Balance never name a product the table did not choose. Lime has one verdict per report | GH-808, GH-809 |
| One verdict, generated once (dolomite) | "Ca is covered by dolomite" and "no lime needed because of dolomite" printed even when dolomite was not recommended | Whether dolomite is applied is taken from the magnesium decision; where it is not, calcium and lime are decided on their own | GH-809 |
| The two sections must not disagree (water) | The same EC was "elevated" in the water section and "CRITICAL" in Priority Actions; gypsum appeared in two places with two rates | One water assessment by the species' grass type; every section names the same level. Gypsum is named once, with its urgency, without a rate | GH-810 |
| The two sections must not disagree (acidification) | Above the species pH ceiling the report gave two different instructions to acidify | Exactly one instruction: "URGENT: Apply elemental sulphur… after hollow-tine aeration…" | GH-812 |
| A branch whose condition is false must not render | (a) "acidifying effect is desired" on sulphur, also for a grass that needs no acidification; (b) "Consider acidification to bring pH into the optimal range…" while pH was above optimum but within tolerance | (a) printed only when the pH verdict is to acidify; the sulphur product and rate are unchanged. (b) removed; the diagnosis "above the optimal range… Monitor for iron chlorosis" stays | GH-813, GH-814 |
| The two sections must not disagree (summary) | The first line of the report was built before the Priority Actions and could read "All parameters within acceptable ranges. No immediate action required." above urgent actions | The first line is built from the Priority Actions: an immediate action opens it with "ATTENTION REQUIRED", planned actions alone give a plain list. Its items are the Priority Actions items, word for word | GH-815 |
| One pH threshold | Lime and acidification triggered at fixed pH numbers | Both trigger at the species' pH optimum and ceiling, so the same pH is a reason to act for one grass and not for another | GH-810, GH-812 |

2.7. **Sample without a pH reading.** [FOR NIKA: delivery 2 — keep when accepted.] Before: the magnesium and sulphur decision substituted pH 7.0 and printed a band and a product from a number the sample does not have ("Band: alkaline pH (7.0 ≥ 7.0). Kieserite chosen"). Now: "pH was not reported on this sample, so the product is not chosen; deficit X kg Mg/ha".

2.8. **Acidification named as a benefit where the pH verdict does not call for it.** [FOR NIKA: GH-819 — keep when accepted.] Before: "Use ammonium-based nitrogen sources to help lower pH" in Interpretation, and "gypsum is doubly correct… acidifying effect" in the gypsum advice, printed whatever the pH verdict. Now: both appear only when the verdict is to acidify.

Numbers that remain near amendment names are not rates: per-application caps (kieserite 300 kg/ha after hollow-tine aeration only, Epsom 15 kg product/ha), the carrier volume for foliar Epsom (400-600 L water/ha), and the 14-day spacing between lime or dolomite and other products.

---

## 3. How to see it

All cases below were checked on our acceptance fixtures, not on your build. To reproduce, use a site of your own with:

- methodology: ammonium acetate (Hill Labs);
- species: Perennial Ryegrass;
- soil texture: sand;
- Hill Labs certificate: S277 (derived from the settings above; do not enter it by hand).

Enter the sample, export the Word report for it, and look at the sections named.

| What to see | Sample | Report section |
|---|---|---|
| No "dolomite at 1-2 t/ha / kieserite 200-400 kg/ha"; Cation Balance agrees with the table | K 110, P 25, Ca 900, Mg 45, Na 20, pH 6.2, CEC 6 (Mg above the S277 floor of 36.6: table says not needed, Cation Balance gives no advice) | Cation Balance Analysis, Annual Soil Amendments |
| "Monitor" and "apply" are never both given for one element | As above, with Mg 30 and pH 6.5 | Same |
| One lime instruction, without "1-2 t/ha" | pH 5.3, Ca 301, Mg 45, K 86, P 40, S 75, CEC 5 | Interpretation (soil), Annual Soil Amendments |
| Exactly one instruction to acidify | pH 7.8, K 40, other elements within range | pH / CEC context, Interpretation |
| No advice to acidify below the species ceiling | pH 7.2, otherwise as above | pH / CEC context |
| Gypsum from water named once, without a rate, same level in every section | Water sample: EC 1.8 dS/m, SAR 7.8 | Water quality, Priority Actions, Soil × Water |
| "Severe K deficiency" and a K rate taken from the table | K 30, P 25, Ca 900, Mg 95, Na 20, pH 6.4, CEC 6 | Priority Actions, Annual Soil Amendments |
| First line of the report agrees with Priority Actions | Any of the samples above with an immediate action (K 30 case, or the water sample) | First line of the report, Priority Actions |


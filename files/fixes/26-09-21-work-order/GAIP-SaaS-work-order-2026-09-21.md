# GAIP SaaS port — work order

**Generated 2026-09-21.** ✅ **Updated 2026-09-21:** R7's upstream cause is closed in the source record the generator consumes, so the citation strings this build reads are now correct at source. R7's citation set is settled below and ready to bind. One new open item sits under Part B.

This is the change list. The reasoning, arithmetic and sources behind every row are held in a separate evidence record by the agronomist — ask if a change needs justifying. Each ID below matches a section in that record.

Tests are listed with each change. All 28 checks (A1-A23, A4 has five parts) fail on the current build.

**Sequencing.** The NZ path ships first. Everything in Part A can fire on a New Zealand report today and blocks that release. Part B is the MLSN and tissue path, which the NZ framework gate already switches off, so it does not block NZ but does block Australia.

---

## Part A — blocks the NZ release

Ordered by severity. R2 first: it is the only one that puts a wrong number in front of a client as an instruction.

| ID | Change | Test |
|---|---|---|
| **R2** 🔴🔴 | Amendment rates come from the computed deficit and the reconciliation table, never from a literal. Delete the hardcoded `dolomite 1-2 t/ha` / `kieserite 200-400 kg/ha` text. A branch whose condition is false must not render. The two sections must not be able to disagree: one verdict per nutrient, generated once. | A11, A12 |
| **R8** 🔴 | Rename the `Hill Labs S277 Margin` column and the chart caption — they describe a **Gilba** threshold set. Attach origin per threshold, not one banner. Thresholds move out of code literals into a data file where every row carries its value, its unit **and its origin**. A floor with no origin does not render. The agronomist supplies and maintains the values. | A20 |
| **R5** 🔴 | Do not derive a K or P replacement dose from tissue that the same report calls below sufficiency. Fall back to a named published band. Disclose the fraction of the deficit added to removal — it is currently exactly one half and is nowhere stated. The status column must not read `On Track` on a row the footnote says is understated. | A16 |
| **R10** 🔴 | Remove the bulk density term from Olsen P kg/ha — it is mg/L, a volume basis. Keep it for mass-basis nutrients. Read `Volume Weight` from the certificate where supplied; otherwise stamp every derived figure as resting on an assumed density. | A21 |
| **R11** 🔴 | Store CEC with a method tag, a source marker (`lab-reported` / `derived-from-cations` / `estimated`) and its detection limit. A derived CEC never renders as a lab result. No trend across mixed methods. Add the missing Na row. Use the lab's % base saturation. | A22, A23 |
| **R3** 🔴 | Gate every ratio check on both elements sharing one extractant. Reconcile a soil antagonism verdict against the tissue reading for that same element before emitting it — the K reconciliation section already does this correctly, point it at the micros. | A13, A14 |
| **R4** 🔴 | Show the date of the reading that drives each action, in the action. No IMMEDIATE item may come from a sample the report has already scoped to trend analysis only. Every timed recommendation names the input that triggered it. | A15 |
| **R6** 🔴 | No trend, projection or time-to-threshold from fewer than three points. Two points are a pair, not a series. | A17 |
| **R1** 🔴 | Compute Ca:Mg on meq, not mass, and label the basis. Currently prints 8.1:1 where the meq figure is 4.9:1. Adopt Hill's published K/Mg band or declare your own; do not disagree with them while implying them. | A10 |
| **R7** 🔴 | Build the reference list from the citations actually used in that render. Bind each framework name to its citation in one place. Filter by species. ✅ **MLSN year settled — bind Woods, Stowell & Gelernter 2016**, *PeerJ Preprints* 4:e2144v1, doi 10.7287/peerj.preprints.2144v1, and carry "preprint, not peer-reviewed" with it. Stowell & Woods 2013 only where the framework's *introduction* is the point. **Never emit the 2014** — it is a *Golf Course Management* trade article, not the framework paper. ✅ **SLAN is Carrow et al. 2004**, *GCM* **72(1)**:194-198. A different Carrow 2004 *GCM* paper sits at 72(5), so **bind on issue and title, never on author-year.** ✅ The reference document the generator consumes was corrected 2026-09-21, so the renderer is now the only part outstanding. | A19 |
| **R9** ⚠️ | Version stamp every render, never `unknown`. Score confidence only on modules present in the export. Fix `crownRust`, suppress `Confidence: none` rows, use NZ dates throughout, reconcile the header disclaimer with the content, drop the wear-tolerance figure inferred from an NTEP quality score. | A19 |

**Also Part A, from Part 2a:** carry extractant *and* its pH as first-class fields, and flag calcareous sands with a warning that pH 7.0 ammonium acetate Ca is unreliable on them.

---

## Part B — blocks Australia, not New Zealand

The NZ framework gate already refuses MLSN and SLAN on ammonium acetate data, so none of these fire on an NZ report.

| ID | Change | Test |
|---|---|---|
| **M5** 🔴🔴 | Gate MLSN on extractant. Mehlich-3 compares directly; Olsen or Colwell either converts with the conversion and its uncertainty shown, or refuses. Never compare silently. AU labs report Colwell, so this is the Australian equivalent of R8's problem. | A1 |
| **M1** 🔴 | Nothing outside P, K, Ca, Mg, S may carry the MLSN label. Drop the five micronutrient floors or re-cite them as the tool's own. Same fix as R8, different third party. | — |
| **T1** 🔴 | Delete the `\|\| 'bentgrass'` fallback. An unrecognised species returns *no band held* and says so. Wire up the dormant St Augustine table. | A2 |
| **T2** 🔴 | Test the band bound for null **before** any numeric comparison. A missing band must never reach a comparison operator. | — |
| **M3** 🔴 | Carry pH method as a first-class field. Convert water ↔ CaCl₂ explicitly and state it, or decline all pH-dependent logic when the method is unknown. Affects R2's branch too. | — |
| **M2** 🟠 | Remove the pH ladder on the P floor, or rename it as the tool's own model with its derivation documented. | — |
| **M4** 🟠 | Gate MLSN on CEC < 6 cmol/kg. Above it, warn and offer SLAN. The input is already read; this is a missing conditional. | — |
| **M6** 🟠 | Remove the 0.8 multiplier. Below the floor is below the floor. | — |
| **T3** 🟠 | Carry band *type* in the data model — sufficiency, survey, reference. Make it structurally impossible for a survey range to emit a deficiency verdict. | — |

**Also Part B — the MLSN floors are one set, bound from one place.** **K 37 · P 21 · Ca 331 · Mg 47 · S 6**, Mehlich-3 ppm, current PACE Turf / Asian Turfgrass Center values. The 2016 paper's own table reads **Ca 348 · S 7**; both were revised down after it. **Never mix rows from the two sets — a mixed set matches no published source**, which is how the evidence record came to carry `Ca 331 · S 7`.

🔴 **Open, and it changes M5 and M1: the phosphorus floor is 21, not 18.** A record this build reads gives **18 mg/kg** Mehlich-3 P under the MLSN name. No MLSN publication gives 18 — it is a field-trial threshold from a separate validation study, correctly cited elsewhere in the same source. Binding 18 sets the Australian phosphorus trigger 14% low, under a citation that does not contain it. **Bind 21; hold 18 only as the trial figure under its own citation.** ⚠️ Flagged with the agronomist for ruling — do not resolve it in code.

---

## Two rules that sit above the list

**Thresholds and bands are data, not literals.** A literal cannot carry the unit, the origin or the caveat that makes the number safe to use. This audit is the evidence: every defect in Part B is a caveat that existed in prose and was lost at the point it became code. The port's job is to hold each value in a structure that carries its provenance beside it, and to refuse to render one that has none.

**Never print a third party's name against a figure they did not publish.** M1, R7 and R8 are one defect appearing three times, against three different parties. Whatever fixes it should fix all three.

# NZ Fungicide Authorisation, Registration, Resistance and Rotation Model
## Specification for the SaaS port

**Agronomic authority:** Jerry Spencer, Principal Agronomist, Gilba Solutions
**Date:** 13 July 2026
**Status:** COMPLETE. All rules (A0, R0-R5) implemented and tested. Registration, authorisation and efficacy data complete. Outstanding items are data/modelling only, no rules remain (section 7).
**Applies to:** the New Zealand fungicide module. Prebbles NZ is the first commercial client, so this is not a future-facing document.
**Plugin baseline:** b35fix491 (v11.42.0).
**Companion to:** `GAIP_AU_Resistance_Rotation_Model_SaaS_Spec.md`. Read that first. This one records only what NZ does differently, plus the NZ data.

---

## 0. The one-paragraph version

New Zealand has two regulators and two lawful authorisation routes, and the AU model does not transfer unmodified. A product is authorised if it is **ACVM-registered OR exempt from registration**, and only the registered set appears in the ACVM register, so **presence in the register cannot be the gate**. Turf-only products are routinely not registered at all. What gates is the **label**: a product may be recommended for a disease if and only if that disease is on **its own** label, exactly as in AU, and the check must be **exact-match**. Registration is a gate, efficacy is a tiebreaker, resistance is a constraint, evaluated in that order. The WordPress plugin at b35fix491 (v11.42.0) implements all of this correctly. Port sections 2 and 3 as they stand. Do not port the plugin's rotation rule.

---

## 1. Why this exists

Five defects were found in the NZ module on 13 July 2026, in ascending order of consequence.

1. The database cited the ACVM Register as a source while recording **no ACVM number for any product**, and had never been validated against any register.
2. Its single registration identifier, `HSR101610` on Instrata Elite, was an **EPA HSNO hazard-approval code mislabelled as an ACVM registration**. Different regulators, different Acts, different meanings.
3. **Proplant was a phantom.** Recorded as 250 g/L propiconazole. It is 605 g/L propamocarb, and it is the same product already in the database as Procura. The Hub held a product that does not exist, with a fabricated concentration, and recommended it for dollar spot, rust and take-all. It surfaced only because it failed to match the register and the failure was chased.
4. **The rotation builder told users that a benzimidazole mixture carried no resistance risk.** It tested whether the FRAC field *began* with "M". Taratek 5F is `M05+1`: chlorothalonil plus thiophanate-methyl, a FRAC 1 benzimidazole, the highest-risk class in the database. It was labelled multi-site, low resistance risk. The dollar spot rotation then returned Taratek 5F and Goldazim (carbendazim, also FRAC 1) as consecutive steps: two benzimidazole applications back to back, presented as a resistance rotation. 19 such defects across 7 diseases.
5. **The Hub was recommending unregistered uses.** `targets` was stored on the active. Registration is granted to the product. **39 unregistered product-disease recommendations were live.** Atlantis Flo was returned for dollar spot although its own note, in that same file, reads *"Broad range excluding Dollar Spot"*.

Defect 5 is the most consequential, and defect 3 is the one that a purely technical review would have missed entirely. Note the causal chain: the register check failed on a name, the failure was chased to the label, and the label revealed the product was misidentified. **The register miss was not the defect. It was the tripwire.** Same mechanism as Shrapnel in AU.

---

## 2. Data model

### 2.1 Authorisation is dual, and both routes are lawful

This is the NZ-specific structure and it has no AU analogue.

```js
{ trade: 'Bravo Weather Stik', acvm: 'P007065', hsno: null, authorisation: 'ACVM' }
{ trade: 'Instrata Elite',     acvm: null,      hsno: 'HSR101610', authorisation: 'HSNO' }
```

Under the ACVM Act 1997 a product is authorised for import, manufacture, sale or use if it is **registered** under the Act **or exempt from registration** under the ACVM (Exemptions and Prohibited Substances) Regulations 2011. Only registered products appear in the ACVM register. Every hazardous substance separately requires an **EPA approval under the HSNO Act 1996**, which is upstream: ACVM will not issue a registration without one.

**The discriminator, and it is agronomically legible:**

| Product has a food or feed crop use | Authorisation |
|---|---|
| Yes | **ACVM-registered.** Residues, MRLs, export trade are engaged, which is the entire purpose of the ACVM Act (s4). |
| No, turf and amenity only | **HSNO approval alone.** None of the ACVM Act's purposes are engaged. |

Worked example, inside one supplier's catalogue. Adria's **Ippon 500SC** is ACVM-registered (P005644); its label carries grapes, stonefruit, kiwifruit, tangelos, berryfruit, asparagus **and turf**. Adria's **Procura**, same distributor and same shelf, is turf and ornamentals only: EPA approval HSR000481, no ACVM number. And Adria *does* print the ACVM statement when there is one (Goldazim's technical guide reads *"registered pursuant to the ACVM Act 1997, No. ..."*), so the silence on Procura is evidence, not an omission.

**Consequence, and it is absolute: a NZ gate of the form "must be present in the ACVM register" is WRONG.** It would strip the entire Syngenta turf line out of the recommendations. Three tests in the plugin guard this and must survive the port.

### 2.2 Registration lives on the product

```js
{
    trade: 'Atlantis Flo',
    ai: '250 g/L azoxystrobin',
    targets: ['anthracnose','brownPatch','grayLeafSpot','dampingOff','fusarium',
              'helminthosporium','redThread','pythium','springDeadSpot'],
    labelVerified: 'J. Spencer, 13 Jul 2026'
}
```

Note what is **absent**: `dollarSpot`. Atlantis Flo's own label excludes it. Under the old active-block schema it inherited it anyway. Any schema attaching registered uses to the *active* reproduces this the moment two products share an active and hold different labels, which is the normal case.

Block-level `targets` is **retained** as the active-level union, because `spray-log-cascade` legitimately reasons about what an *active* protects against, which is a different question from what a *product* is registered for. It must be computed as the **union of its products' labels**, never authored independently, or a block narrower than a product it contains will silently drop a registered use.

### 2.3 Mixtures are structured, not strings

Four NZ mixtures. A FRAC field of `'M05+1'` is opaque; nothing can ask which group maps to which active.

```js
components: [
    { active: 'chlorothalonil',    frac: 'M05', concentration: 250, unit: 'g/L' },
    { active: 'thiophanateMethyl', frac: '1',   concentration: 250, unit: 'g/L' }
]
```

**NZ zero-pads its multi-site codes** (`M03`, `M05`) where AU writes `M3`, `M5`. Internally consistent, so no normalisation is needed today. **If the AU and NZ databases are ever merged, normalise the padding first**, or `M5` and `M05` will be treated as different groups.

### 2.4 Every active carries its own efficacy map

Partner efficacy is looked up **per component**, not per product. `difenoconazole` currently has **no standalone active block** in NZ: it exists only inside the `difenoconazoleFludioxonil` mixture. Restore it, or Instrata Elite cannot be fully evaluated. This is the NZ analogue of the AU `triticonazole` / `trifloxystrobin` problem.

---

## 3. The rules

Evaluate strictly in order. Nothing downstream may promote a product past a gate it failed.

### A0. Authorisation (absolute, NZ-only)

A product may be supplied and used if it is **ACVM-registered OR HSNO-authorised under an ACVM exemption**. Both are lawful. **Neither may be treated as a defect, and absence of an ACVM number may never gate a recommendation.**

A0 is orthogonal to R0. A product may be HSNO-authorised and still hold label claims that gate correctly under R0. Instrata Elite is the worked example.

### R0. Registration gate (absolute)

A product may be recommended for a disease **if and only if that disease is on its own label**. Not the active's label. Not a sibling product's.

**The match must be EXACT after normalisation. Not substring.** This is not a style preference. The first implementation of this gate reused the module's substring matching; `leafSpot` normalises to `"leafspot"`, which is a substring of `"grayleafspot"`, so Balear was granted a grey leaf spot registration it does not hold and Atlantis Flo a leaf spot one. **Four false registrations, created inside the fix for false registrations.** A gate that matches loosely is the defect class it exists to prevent.

No efficacy, resistance or rotation reasoning runs on a product that fails R0.

### R1. Multi-site classification

A product is multi-site **if and only if every component group is multi-site** (`M`-prefixed). Never test whether the FRAC string begins with "M".

NZ additionally carries `BM02` (biological, *Bacillus*) and `P07` (phosphonate). **Neither is multi-site.** Both correctly fail an `every component starts with M` test. Neither may be described as carrying no resistance risk.

### R2. Consecutive limits (NZ splits the AU blanket rule)

Per J. Spencer, the groups are not equal. Implemented in `validateProgramme`.

| Group | Max consecutive applications |
|---|---|
| FRAC 3 (DMI), 7 (SDHI), 11 (QoI) | 1, never back to back |
| FRAC 1 (benzimidazole), 2 (dicarboximide), 4 (phenylamide) | 2 |

A mixture component counts toward its group's run: two applications of a FRAC 3+12 premix is two consecutive FRAC 3.

### R3. Seasonal cap

Total applications per group per season, counting co-formulated applications. A mixture does not reset the count. Implemented in `validateProgramme`.

| Group | Season cap |
|---|---|
| FRAC 2 | 3 |
| FRAC 3, 4, 7 | 4 |
| FRAC 1 | 5, AND a fraction cap: 33% of total sprays solo, 50% if every FRAC 1 application is a premix |
| FRAC 11 | **percentage of total sprays**: 33% solo, 50% if every application is a premix (no fixed count) |

Ranges given by J. Spencer were resolved to the upper (label) bound. FRAC 1 and FRAC 11 are additionally bounded as a fraction of the whole programme, not just a count; a single solo application of the group anywhere drops the cap from 50% to 33%. FRAC 1 is bounded by both its count (5) and its fraction, whichever is tighter. Where a label carries an explicit limit it wins: Instrata Elite max 2/year.

**Tank-mix composition (R3t).** Distinct from the rotation and season rules: never co-apply FRAC 1 with FRAC 2, 3, 7 or 11 in one spray unless a multi-site contact (any FRAC M) is also in the tank. Implemented as `validateTankMix(blockKeys)`. It is dormant until the spray-log captures tank-mix composition; extending `validateProgramme` to accept array-valued steps (a step is a tank-mix) is the follow-on that wires it in.

### R4. Mixture credit

Identical to AU, including rule (b′). An at-risk component earns reduced-selection credit against a disease if either:

- **(a)** co-formulated with a **multi-site partner that has activity against that disease**; or
- **(b)** co-formulated with a **single-site partner whose efficacy against that disease exceeds 3** on the 1-4 scale. Strictly greater: 3.0 fails.

> **Rule (b′).** A multi-site partner bypasses the efficacy threshold, but it must actually reach and control that pathogen. **No efficacy rating means no activity, therefore no credit.**

Credit reduces selection pressure. It does **not** cancel the application. The spray still counts toward R2 and R3.

### R5. Honest reason strings

Never assert "no resistance risk" unless R1 passes. Never assert or imply ACVM registration for an HSNO-authorised product.

---

## 4. What the model says about the real NZ database

33 products, 29 active blocks, 4 mixtures. 25 ACVM-registered, 5 HSNO-authorised, 3 unresolved.

The efficacy matrix is complete: every registered product-disease with an engine model carries a rating (J. Spencer, 13 Jul 2026). 35 R4 evaluations across the four mixtures. **Fully resolved: 16 credit, 19 no credit, 0 unresolved.**

### 4.1 The finding that justifies the exercise

**Headway Maxx contains a DMI that is unprotected against dollar spot.**

| Product | FRAC | At-risk active | Partner | Partner vs dollar spot | Credit |
|---|---|---|---|---|---|
| Headway Maxx | 11+3 | propiconazole | azoxystrobin | **3.0** | **NO** |

Azoxystrobin rates exactly 3.0 against dollar spot, and the threshold is strictly greater than 3. The mixture **protects the strobilurin** (propiconazole partners it at 4.0) but **not the triazole**. Against dollar spot, Headway Maxx behaves in resistance terms close to a **solo DMI application**.

This is the identical arithmetic to AU's Evolution and Evolution Advance, where azoxystrobin also rates 3.0. Headway Maxx is one of the most widely used products in NZ turf, and it is on greens. Under a naive "it is a mixture, so it is protected" reading it looks safe. It is not.

Across Headway Maxx's full label the DMI (propiconazole) earns credit against **brown patch, fusarium and rust** (azoxystrobin rates 4, 4, 4) and **no credit** against dollar spot (3.0), anthracnose (3), helminthosporium (3), spring dead spot (1), take-all (1), red thread (1.5) or pythium (2). Eight registered uses, three protected, five effectively solo. That distribution is invisible without per-component efficacy, which is why sections 2.3 and 2.4 are not optional.

### 4.2 Instrata Elite: the rule discriminating within one product

Instrata Elite is difenoconazole + fludioxonil. Its DMI earns credit against **dollar spot and fusarium** (fludioxonil rates 4.0 against both) and **no credit** against anthracnose (2.5), brown patch (3.0, fails the strict threshold) or red thread (2.5). The same product, protected against two pathogens and effectively solo against three. A blanket "mixture, therefore safe" rule cannot express this.

### 4.3 What (b-prime) decides

Taratek 5F is chlorothalonil + thiophanate-methyl. With chlorothalonil now rated across the board, the benzimidazole earns credit against **all six** of Taratek's registered uses, because chlorothalonil has activity against each (2.5 to 4.0). This is credit correctly granted: a multi-site partner with real activity suppresses the population the FRAC 1 is selecting on.

Ridomil Gold MZ is metalaxyl + mancozeb. The metalaxyl (FRAC 4, at risk) earns credit against **damping-off** (mancozeb rates 1) but **not against pythium**, because mancozeb scores an explicit **0** there. That 0 is the load-bearing value: without it, a literal reading of rule (b) would credit the phenylamide purely because a multi-site is in the can, against the one pathogen the multi-site does nothing to.

### 4.4 The R0 result

**39 unregistered product-disease recommendations removed** at b35fix487, across 12 diseases. The gate also **added** registrations the block union had been masking, including grey leaf spot on both azoxystrobin products and **curvularia on Ippon 500SC alone**.

## 5. Test specification

These are the specification. All must hold across **every** supported disease, not a chosen fixture.

1. **Registration invariant.** Every product returned for a disease carries that disease in its own registered target list. *(Implemented: b35fix487, 18 tests.)*
2. **The R0 gate is exact-match.** `leafSpot` must not match `grayLeafSpot`. *(This is the test that caught the bug.)*
3. **Block targets are a superset of every product they contain.** *(No registered use may be lost to a narrow block.)*
4. **Authorisation is never a gate.** A product with no ACVM number is still recommended. Velista must still be returned for fairy ring. *(Implemented: b35fix485/486.)*
5. **No rotation repeats a FRAC component group.** *(Implemented: b35fix484.)*
6. **Nothing claims "no resistance risk" unless every component group is multi-site.** `BM02` and `P07` fail this test. *(Implemented: b35fix484.)*
7. **Consecutive limits hold per group.** *(Implemented: b35fix490, 20 tests.)* FRAC 3/7/11 never consecutive; FRAC 1/2/4 max 2.
8. **Season caps hold, counting co-formulated applications.** *(Implemented: b35fix490.)* FRAC 2=3, FRAC 3/4/7=4, FRAC 11 percentage-based, FRAC 1 none.
9. **R4 regression fixtures.** *(Implemented: b35fix488, extended b35fix489.)* These cases are the rule:
   - Headway Maxx / dollar spot, propiconazole → **no** credit (partner azoxystrobin rates 3.0, threshold is strictly greater)
   - Headway Maxx / dollar spot, azoxystrobin → credit (partner propiconazole rates 4.0)
   - Headway Maxx / rust, propiconazole → credit (partner rates 4.0)
   - Instrata Elite / dollar spot → credit (partner fludioxonil at 4.0)
   - Instrata Elite / brown patch → **no** credit (partner at 3.0, fails strict threshold)
   - Taratek 5F / red thread → credit (multi-site partner chlorothalonil rates 4.0, has activity)
   - Ridomil Gold MZ / pythium, metalaxyl → **no** credit (multi-site partner mancozeb scores 0, no activity)
10. **Guards against over-correction.** No disease may be left with zero registered products. Siblings with divergent labels must be differentiated (Ippon 500SC holds curvularia; no other iprodione product does).

---

## 6. Do not port from the plugin

Build b35fix491 (v11.42.0) implements **A0, R0, R1, R2, R3, R4 and R5 correctly**, and its test suites should be carried across as-is.

It implements resistance with a **blanket rule: a rotation may never reuse any component FRAC group.** Shipped deliberately as a stopgap, identical to AU. It is strictly safer than the "no resistance risk" behaviour it replaced, but it is **agronomically over-strict**: it excludes a group for the life of a programme rather than limiting consecutive use and seasonal totals, and it gives no credit for mixture partners. Implement R2, R3 and R4 instead.

The NZ rotation function currently has **no consumer** in the plugin. It was fixed anyway, because the port copies `assets/*.js` directly and because AU and NZ must not diverge on a safety rule.

---

## 7. Outstanding

All rules (A0, R0-R5) are complete and tested at b35fix490. What remains is data and modelling only, no rules:

| Item | Detail |
|---|---|
| `difenoconazole` | No standalone active block; it exists only inside the `difenoconazoleFludioxonil` mixture, so Instrata Elite's DMI component is evaluated only via the mixture. Restore it as a first-class block. NZ analogue of the AU `triticonazole` / `trifloxystrobin` defect. |
| **leafSpot, yellowPatch** | **Registered uses with no engine key and no disease model.** `leafSpot` on Balear 720SC and Bravo Weather Stik; `yellowPatch` on Headway Maxx. Retained as label truth, but nothing can recommend on them, and their efficacy cells are inert. Same class as the AU Red Thread gap. Yellow patch on a Headway label is a real gap for a cool-season NZ client. |
| **3 products with no authorisation identifier** | **Fostonic**: its label cites ACVM `P5746`, which does not resolve in the register; Adria's `Fosetyl 800WSG` (P009811, fosetyl-aluminium 800 g/kg) is an exact active/content match and is the likely identity. **Supamanz** (455 g/L mancozeb): no match on name or active/content. **Posterity**: newly added, no code supplied. |
| **Two confirm-or-revert values** | propiconazole vs rust was moved 2.5 to 4, and vs take-all 2 to 2.5, on J. Spencer's authority, when the partner-gap list wrongly presented those cells as blank. The rust change is material (it credits azoxystrobin against rust in Headway Maxx). Both are reversible on request. |
| **Short-form label numbers** | Retail listings show Proplant/Procura as ACVM `P5454`, which does not resolve. `P5746` (Fostonic) likewise. The short-form P-numbers printed on some NZ labels may be **historical**. Establish this before any sync treats a label number as authoritative. |
| `spray-log-cascade.js` | Maps an *active* to protected diseases via the block-level union, so a logged spray remains over-broad. Fixing it requires capturing the *product* at log time. Same residual as AU. |
| **ACVM sync class** | **Not built, deliberately.** No ACVM API exists. The register download is a session-bound Liferay action keyed by a volatile `documentId`, so it needs a two-step scraper, not `wp_remote_get(STATIC_URL)`. Under A0, absence from the register proves nothing, so the sync's real value is detecting **cancellation** of the 25 registered products, not validating the other 8. |
| **FRAC padding** | NZ writes `M03`/`M05`; AU writes `M3`/`M5`. Normalise before any cross-region merge, or `M5` and `M05` will be treated as different groups. |

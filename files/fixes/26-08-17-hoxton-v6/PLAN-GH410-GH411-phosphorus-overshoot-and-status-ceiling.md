# PLAN — GH-410 phosphorus overshoot in product selection / GH-411 a status with no ceiling

Planning deliverable. No production code was changed and no git operation was run. All paths are relative to
`/Users/katep/Documents/Work/gilba/gilbahub/`; every line number was read on the working tree on 2026-09-10.
Every figure below was produced by running the real `assets/au-fertiliser-products.js` and
`assets/nutrient-balance-status.js` in a Node VM over the six real requirement fixtures
(`tests/fixtures/gh400-au-requirements-*.json`) — nothing was generated through the Plan page and no stored
programme was regenerated. Two jest files hold the measurements and can be re-run at any time:

- `tests/gh410-phosphorus-overshoot-probe.test.js` — the brief's probe, unchanged. Its numbers are confirmed.
- `tests/gh410-phosphorus-lever-measurement.test.js` — new. Parts A–F: the catalogue each surface can pick from,
  the baseline month by month on all six sites, the score breakdown of every viable candidate on the months that
  over-delivered, eight candidate levers run on all six sites, and the GH-411 branch each site's N/P/K row takes.
  `npx jest tests/gh410-phosphorus-lever-measurement.test.js` (about 1 s; prints roughly 400 lines).

**Ticket numbers.** The Change log's highest entry is **GH-408**; GH-409 appears nowhere in `docs/instructions.md`
and is in flight. GH-410 (selection) and GH-411 (status) are free. Section 10 proposes GH-412 for a defect this
work uncovered that neither ticket should absorb.

---

## 0. Executive summary

1. **Three premises in this area are wrong, and the third one is in the brief.** They are stated plainly in
   section 2 so they stop circulating. (a) GH-400's "monthly delivery against annual requirement" — wrong, both
   sides are monthly; the brief already says so and the code confirms it. (b) The brief's "the -20 penalty fires
   here (6.4/1.7 = 3.76) and contributes -7" — **wrong**. Country Club IV 18-9-18 is scored at **pScore = +100,
   "Perfect P delivery"**, in both January and November, because the scorer prices it at 100 kg/ha (label minimum
   for one month's N) while the programme applies it at 161 kg/ha (GH-337's two-month sizing). At 100 kg/ha over
   two months it delivers 1.98 kg P/month against a 1.7 net requirement, ratio 1.16. Its entire 38.5-point lead
   over the phosphorus-free Country Club IV 17-0-17 **is** the P score (100 vs -10, x 0.35). The penalty is not
   too weak; it is never reached. (c) The brief's "New test's P renders On Track through the `pct >= 90` branch"
   — **wrong**. That site's persisted programme carries soil P 23.81 ppm, range 27–54, removal 12, bulk density
   1.4 and depth 10, so `classify()` takes the range branch and prints On Track because the projected balance
   (40.0) sits inside 37.8–75.6. The no-ceiling branch is real, but it is the **nitrogen** row's branch on every
   site (N has no soil range), and it currently says On Track for N at 115 % (New test), 112 % (Westview), 113 %
   (Federal) and 123 % (Test1).

2. **GH-410, measured.** Every lever the brief listed (scale the penalty, reweight, reject over 3x, prefer a
   non-severe carrier) changes **nothing** on any of the six sites, because they all act on a branch the scorer
   never enters (section 4, variants A–E). Two levers the trace suggested do work. **G — cap the P score against
   the remaining annual budget** — is targeted: New test 18.7 → **14.4** (+0.4), Canberra 23.9 → **20.9** (+1.0),
   the four other sites byte-for-byte unchanged, Burns and Test1 not made shyer. **F — score the application that
   will actually be made** — is the root-cause fix of the rate discrepancy in (b) and also lands P on target
   (14.1 / 19.9 / 12.0) but reshuffles products on five of six sites and drops New test's K from 104.5 to 87.0.
   Recommendation: ship G under GH-410 with a disclosure note for the unavoidable case; open **GH-412** for F with
   its own plan and product sign-off. Do not ship H (reject the dose) — it pushes N to liquids and lands New test
   at N +35.

3. **GH-411, measured.** Add an upper bound to the pct branch mirroring the lower one: 90–110 % On Track,
   110–130 % `Monitor (+X%)` (amber), above 130 % `Excess (+X%)` (red) — the range branch's own word and number
   style. On the six AU sites the labels that change are all nitrogen rows: New test `Monitor (+15%)`, Westview
   `(+12%)`, Federal `(+13%)`, Test1 `(+23%)`; Canberra (92 %) and Burns (104 %) stay On Track; no P or K row on
   these sites moves (they are on the range or no-data branches). One file, one function, five tests to update.
   It is independent of GH-410 and should land first — agreed.

---

## 1. What was run and what it showed

### 1.1 The probe (brief's file), confirmed

```
site                 required  delivered   gap        (kg P/ha; required = sum of the twelve monthly rows)
new-test-location         14       18.7     +4.7
canberra                19.9       23.9     +4.0
westview                  20       21.4     +1.4
federal-golf            11.9       13.2     +1.3
test1-sports              12       11.9     -0.1
burns                     14       12.3     -1.7
```

One cosmetic bug in the probe: its first test prints `gap` as `undefined` because `summarise()` never sets
`r.gap` (it sorts on it too, so that table's order is arbitrary). The second table is correct. Fix when GH-410
lands; do not restart the probe.

### 1.2 Baseline month by month, all six sites (measurement part B)

New test - location (golf_greens, SLAN), required N/P/K 120 / 14 / 103, delivered 137.6 / 18.7 / 104.5:

```
Jan  net N/P/K 14.5/1.7/12.4   Country Club IV 18-9-18 @161 kg/ha     P 6.4
Feb  covered by the January batch (2-month release)
Mar  net 14.9/1.7/12.8         TPG Maintenance 13-1-13 @229           P 2.3
May  net  6.4/0.7/ 5.4         MP Spring Start 16-1-10 @125           P 1.3
Jul  net  2.5/0.3/ 2.1         Greenmaster Liquid Spring & Summer     P 0.4
Aug  net  3.2/0.4/ 2.7         Long Paddock Rapid Uptake 4x7 L/ha     P 0.6
Sep  net  7.1/0.8/ 6.0         Country Club IV 24-3-12 @100           P 1.3
Oct  net  0  /0.7/ 4.9         slow-release covering 104 %, nothing
Nov  net 14.6/1.7/12.5         Country Club IV 18-9-18 @162           P 6.4   <- 1.7 kg left of the year
```

The January dose is not the defect: 6.4 kg against 14 kg still to deliver is front-loading, exactly what the
strategic-P path (GH-331) does deliberately. The defect is November: 6.4 kg applied when the annual remainder is
1.7 kg, and the scorer calls it perfect (section 2.2). Note that the strategic-P top-up never fires on this site —
by November the remainder is 1.7 < the `annualPRemaining > 2` gate (`au-fertiliser-products.js:6370`) — so all
18.7 kg is carrier phosphorus.

Canberra (golf_greens, MLSN), 200 / 19.9 / 110 → 184.7 / 23.9 / 110.9: 18-9-18 @280 in January (P 11.1),
Sierraform GT All Seasons 18-3-15 @200 in March (P 5.2), liquids (P 1.3), then **18-9-18 @158 in October (P 6.3)
against a 2.3 kg remainder**. Same shape as New test.

Federal Golf (SLAN), 120 / 11.9 / 63.9 → 135.1 / 13.2 / 73.4: 18-9-18 @167 in January and March (6.6 + 6.6 =
13.2 against 11.9). The March dose lands against a 5.3 kg remainder, ratio 1.25 — inside any reasonable
tolerance; this is the honest kind of overshoot.

Westview (lawns, MLSN), 200.1 / 20 / 125 → 224.8 / 21.4 / 154.1: Simplot Best Pro Prills 12-3-13 @400 in
January (P 12.0) and GTS Colour Plus 20-0-16 @300 in December (P 3.0 against 1.6 remaining). The K column
(+29.1) is the larger story on this site and is not this ticket's.

Test1 - Sports (soccer, MLSN), 120 / 12 / 66.9 → 148 / 11.9 / 88.4: the strategic top-up (MAP Tech 7 kg) closes
the year to within 0.1. Nothing to fix.

Burns (golf_greens, MLSN, K required 0), 120.1 / 14 / 0 → 125.5 / 12.3 / 0: only two granular carriers are
viable with K = 0 (Sportsmaster WSF 20-0-0 and lo-biuret urea, both P-free), so all P comes from three MAP Tech
top-ups capped at the 15 kg/ha greens rate (3 x 4.1). After December the remainder is 1.7 kg, below the `> 2` gate,
so the fourth top-up is not made. **The -1.7 is the gate GH-331 follow-up 3 chose, not selection**, and no
selection change can move it. Leave it.

### 1.3 The scorer's view of the January and November candidates on New test (measurement part C)

`selectNitrogenSource()` was traced by exposing its per-candidate components (a test-only patch on the composite
line `au-fertiliser-products.js:5109-5110`). Columns: rate the **scorer** used, months covered, N/P/K **at that
rate**, then kScore / releaseScore / nScore / pScore / autumn K / greens penalty / composite.

```
candidate                    npk            rate mo   N    P    K    kS relS  nS   pS  autK grn  total
Country Club IV 18-9-18      18-3.96-14.94  100  2   18  4.0 14.9   70   60  20  100    0   0   76.5   <- picked, applied @161
Country Club MD 18-3-18      18-1.32-14.94  100  2   18  1.3 14.9   70   60  20   40    0   0   55.5
MP Spring Start              16-1-10        125  2   20  1.3 12.5   70   60  20   40    0   0   55.5
Nutri DG 18-1-15             18-1-15        150  2   27  1.5 22.5  100   60  50   40    0 -25   48.5
Sierraform GT Momentum       22-2.2-9.1     200  2   44  4.4 18.2  100   60 -20  100    0 -30   47.0
TPG Maintenance              13-1-13        200  2   26  2.0 26.0  100   60  50   70    0 -40   44.0
Country Club IV 17-0-17      17-0-14.11     100  2   17  0   14.1   70   60  20  -10    0   0   38.0
```

November is identical to the line (same net requirement, same remainder 1.7, same scores). Three things to read
off this table:

- The scorer's rate for 18-9-18 is **100** (`actualRate = max(rateNeeded, labelRates.min)` at `:4889`, with
  `rateNeeded = nRequired / nPct` = 14.5 / 0.18 = 81 at `:4786`). The programme applies **161**
  (`nTarget = nRequired * monthsCovered`, `rateKgHa = round(nTarget / nPct)` at `:5155-5156`, GH-337). The
  scorer is describing an application that is not made.
- At 100 kg/ha over 2 months, `effectiveMonthlyP = 3.96 / 2 = 1.98` against `pRequired = 1.7`: ratio 1.16,
  **pScore 100**. At the applied 161 kg/ha the same arithmetic gives 3.2 / 1.7 = 1.88 → pScore 30 — which is
  where GH-400's "1.9x moderate" came from. Against the whole dose, 6.4 / 1.7 = 3.76 → -20 — which is where the
  brief's figure came from. Neither is what the scorer computes.
- 76.5 − 38.0 = 38.5 = (100 − (−10)) × 0.35. **The P score is the whole margin** over the P-free carrier with the
  same N and K. A P-bearing product is rewarded, not penalised, for matching one month's slice while the year
  has 1.7 kg left.

### 1.4 Does a better product exist? Yes (measurement part A)

Granular N carriers that pass `selectNitrogenSource()`'s pre-filter for **golf_greens** (N ≥ 10 %, not a
herbicide, label rates for greens) with zero or near-zero phosphorus and potassium comparable to 18-9-18's
14.94 %: Country Club IV 17-0-17 (17-0-14.11), Country Club MD 22-0-16 (22-0-13.28), Country Club MD 20-0-10,
Sierraform GT NK 19-0-16 (19-0-15.8), Sierraform GT Spring Start 16-0-13, Nutri DG Greens Extra K 13-0-21.6,
MP High K 15-0-25, Sportsmaster WSF High K 15-0-35; low-P: Country Club MD 18-3-18 (1.32 % P), Nutri DG 18-1-15
(1 %), MP Spring Start 16-1-10 (1 %), TPG Maintenance 13-1-13 (1 %). All were viable in the trace above. For
**soccer** and **lawns** the list is longer (Black Label Pro Balance 22-0-18, GTS High K 20-0-20, TPG Ratio
20.7-0.07-16, Sierrablen Plus Stress Control 15-0-23.2, MESA Sports 19-0-16 …). So on every over-delivering site a
lower-phosphorus carrier that meets the month's N and K exists; this is a selection problem, not a catalogue
problem, and disclosure is the fallback rather than the answer.

### 1.5 Which `classify()` branch each row takes (measurement part F)

Soil, range and removal read from the persisted programmes in
`files/fixes/26-08-17-hoxton-v6/dev-db-snapshot-2026-09-10.sql` (`site_configs.config.nutritionProgram`);
delivered from the recommender run on the fixtures; required from the programme's `targets` (these programmes
predate GH-403's `annual_requirements`).

```
site                nut  ppm    range(ppm) removal  req    del   pct   branch   label
new-test-location   N      -    -          120     120  137.6  115%  pct      On Track
new-test-location   P   23.81   27-54       12      14   18.7  134%  range    On Track   (balance 40.0 in 37.8-75.6)
new-test-location   K   19.31   75-176      64     103  104.5  101%  range    Deficit (-36%)
canberra            N      -    -          200     200  184.7   92%  pct      On Track
canberra            P/K    -    (no soil sample)                      no-data  No Soil Data
westview            N      -    -          200   200.1  224.8  112%  pct      On Track
westview            P/K    -    (no soil sample)                      no-data  No Soil Data
federal-golf        N      -    -          120     120  135.1  113%  pct      On Track
test1-sports        N      -    -          120     120  148.0  123%  pct      On Track
test1-sports        P/K    -    (no soil sample)                      no-data  No Soil Data
burns               N      -    -          120   120.1  125.5  104%  pct      On Track
burns               P     18    21-31.5     12      14   12.3   88%  range    Deficit (-13%)
burns               K    195    37-55.5     64       0    0      -   range    Excess (+169%)
```

Federal's P/K rows are omitted: the snapshot's Federal programme was generated from a different sample (P
required 18.1, K 29.1 against the fixture's 11.9 / 63.9), so mixing the two would be a measurement error. Its N
row is unaffected by that.

---

## 2. The corrected diagnosis, and what to write so the wrong versions stop circulating

**2.1 GH-400's "monthly delivery against the annual requirement" is wrong.** `pRequired` in
`selectNitrogenSource()` (`:4760`) is `monthData.P`, and the call site passes `P: netP` (`:6155`), where
`netP = min(month.P − activeP, annualTargets.P − delivered.P)` (`:6075-6078`) — one month's slice, capped by what
is left of the year. `effectiveMonthlyP = pAtRate / monthsCovered` (`:4896`) is also monthly. Both sides are
monthly; the annual budget bounds the scorer's input, never the delivery. The probe's fourth test pins this.
The comment in `tests/gh400-au-liquid-phosphorus.test.js:303-310` and the tail of the GH-400 Change log entry
carry the wrong version; the GH-410 commit should reword the test comment (the Change log entry stays as history,
the GH-410 entry corrects it).

**2.2 The brief's "the penalty fires (3.76x → -20) but only contributes -7" is wrong.** Section 1.3: pScore is
+100. The whole-dose ratio 3.76 is the right physical question but it is not the question the scorer asks; the
scorer asks "does one month's share of this product, at 100 kg/ha, match one month's need" and the answer is yes.
The flooring of the penalty at -20 is true and irrelevant here; A and B in section 4 prove it (no effect).

**2.3 The brief's "New test's phosphorus is On Track through `nutrient-balance-status.js:116`" is wrong.** Section
1.5: the P row takes the range branch (`:141-181`) and is On Track because 23.81 ppm × 1.4 × 10 × 0.1 = 33.3 kg/ha
+ 18.7 − 12 = 40.0, inside 37.8–75.6. That verdict is defensible on its own terms — the soil is below floor, the
extra phosphorus is lifting it into range — which is also why the Nutrient Delivery Summary cannot be where the
selection overshoot is disclosed (section 5.3). The no-ceiling branch is the N row's branch on every site and the
P/K rows' branch only where a range or removal is absent without the nutrient being flagged missing; on the six AU
sites that is nowhere.

**2.4 What actually produces the overshoot** (confirmed, with one addition to the brief's starting point):

- The product is chosen for N and K, and its phosphorus rides along — confirmed, but with the correction that the
  phosphorus is what *wins* it the slot: P is scored as a match, not tolerated as a side effect.
- The annual budget bounds the scorer's input, not the delivery; once chosen, the whole dose lands — confirmed.
- **Addition:** the scorer prices every slow-release candidate at one month's N (`rateNeeded`, `:4786`) while the
  programme buys two months' worth (`:5155`). GH-337 scaled the sizing and left the scoring behind. The consequence
  is wider than phosphorus: nScore, kScore and the GH-329 clean-P/K filter all evaluate a rate that will not be
  applied. Section 10 proposes GH-412 for it.

---

## 3. GH-410 — the levers, measured on all six sites (measurement part D)

Each variant is a text patch applied to the recommender source in a fresh VM; each anchor must match exactly
once. N/P/K delivered, with (gap to required); the granular picks are listed in the test output.

```
variant                     new-test           canberra            westview            federal            test1              burns
baseline                    137.6/18.7/104.5   184.7/23.9/110.9    224.8/21.4/154.1    135.1/13.2/73.4    148.0/11.9/88.4    125.5/12.3/0
                            (+17.6/+4.7/+1.5)  (-15.3/+4.0/+0.9)   (+24.7/+1.4/+29.1)  (+15.1/+1.3/+9.5)  (+28/-0.1/+21.5)   (+5.4/-1.7/0)
A graded penalty (-80/-120) unchanged           unchanged           unchanged           unchanged          unchanged          unchanged
B proportional penalty      unchanged           unchanged           unchanged           unchanged          unchanged          unchanged
C reweight P 0.35 -> 0.50   unchanged           unchanged           unchanged           unchanged          154.8/12.1/84.1    unchanged
D prefer non-severe (GH-329 style) unchanged    unchanged           unchanged           unchanged          unchanged          unchanged
E reject granular > 3x netP unchanged           unchanged           unchanged           unchanged          unchanged          unchanged
F score the applied rate    140.5/14.1/87.0    175.9/19.9/118.4    unchanged           135.7/12.0/71.1    151.7/13.2/72.5    unchanged
G annual-budget cap on pScore 137.6/14.4/104.5  218.4/20.9/126.6    unchanged           unchanged          unchanged          unchanged
H reject dose > 1.5x remaining 155.2/14.2/105.3 160.6/19.5/110.2    200.7/20.7/119.6    unchanged          unchanged          unchanged
F+G                         = F                 = F                 unchanged           = F                = F                unchanged
```

Reading:

- **A, B, D, E do nothing** on any site. All four act in or after the "severe overshoot" band, which the scorer
  never enters because the ratio it computes is 1.16. This is the measurement the brief asked for before proposing
  any of them; they are ruled out.
- **C** (reweight) leaves the overshoot alone and changes Test1's December pick (GTS High K 20-0-20 → TPG Ratio),
  adding 6.8 kg N. A weight change perturbs sites that have no phosphorus problem. Ruled out.
- **H** (bound the delivery) pushes rejected months to the liquid path, which is worse at nitrogen: New test N
  +35.2, Canberra N -39.4, Westview loses its December granular (K -5.4). Ruled out; it is the "shy" failure the
  brief warned about, in the other direction for N.
- **F** (score the rate that will be applied: `actualRate = min(labelMax, max(rateNeeded × monthsCovered,
  labelMin))` at `:4889`) lands phosphorus on target on all four over-delivering greens/sports sites and is the
  correct fix for the discrepancy in 2.4 — but it changes the first pick on five of six sites, drops New test's K
  to 87.0 (-16.0, and that site's K is already below floor), leaves Canberra N at -24.1, and its January pick on
  New test (MP Spring Start 16-1-10 @181) is chosen by the same tie-break-by-catalogue-order that chose MD 18-3-18
  elsewhere. It needs its own product review. Not GH-410.
- **G** (below) is the only lever that changes exactly the two months that are wrong and nothing else, on the
  under-deliverers in particular.

### 3.1 G, in detail

Rule: a granular candidate's whole phosphorus dose is compared with the **remaining annual P budget**; if it
exceeds it by more than the scorer's own "good" tolerance, pScore is capped with the same bands the monthly
comparison already uses. The monthly adequacy score is untouched, so a product is still rewarded for matching a
month's need when the year can absorb it (January on every site).

Measured effect, month by month (measurement part B2):

- New test, November: 18-9-18's dose 3.96 kg (at the scorer's rate) against 1.7 remaining = 2.33 → pScore capped
  at 10, composite 76.5 → 45.0; **Country Club MD 18-3-18 @162 (P 2.1)** wins at 55.5. Year: 14.4 (+0.4).
  January is unchanged (3.96 / 14 = 0.28, no cap).
- Canberra, October: 3.96 against 2.3 remaining = 1.72 → capped at 30; **MP Spring Start 16-1-10 @178 (P 1.8)**
  wins. Year: 20.9 (+1.0). But the October change cascades: November becomes liquid-only (Fairway & Athletic
  17-1-6), and December's granular becomes **Country Club MD 20-0-10 @280 kg/ha (N 56.0 against 33.8 net)**
  instead of Sportsmaster WSF High N @97. N ends at 218.4 (+18.4, from -15.3); K at 126.6 (+16.6). The December
  swing is the section 2.4 discrepancy: MD 20-0-10 is scored at 169 kg/ha (nScore 20, kScore 100) and applied at
  the 280 label max in the last month of the programme, with half its two-month release outside the year. Under
  F+G that December pick is Sierraform GT Spring Start 16-0-13 @200 plus a liquid, N 175.9. This is a product
  decision (D-2); G does not create the discrepancy, it exposes it on a site that previously sat 0.5 points on the
  other side of a tie.
- Westview, Federal, Test1, Burns: monthly output identical to baseline (the test can assert
  `JSON.stringify(monthly)` equality for these four).

### 3.2 What the reader sees when overshoot is unavoidable

After G the largest residuals are Federal +1.3 (March: 6.6 against 5.3 remaining, ratio 1.25 — no lower-P carrier
delivers its N and K within tolerance) and Westview +1.4 (December: Colour Plus 3.0 against 1.6). Those are honest.
The reader should see them where the application is, not only as a +1.3 in a summary two tables away:

- In `generateAnnualProgram()`, at the point the granular is accepted (`:6211`, before `delivered.P +=` at
  `:6213`), compute `pBeyond = granularRec.pDelivered − max(0, annualTargets.P − delivered.P)`; if `pBeyond > 0.5`,
  push onto `monthResult.notes`:
  `"Carries ${pBeyond.toFixed(1)} kg P/ha beyond the remaining annual P requirement — no lower-phosphorus product met this month's N and K"`.
  The threshold keeps a 0.4 kg remainder (New test November after G) quiet; the wording states the trade-off the
  scorer made rather than apologising for it. Measured (measurement test, part "G-only"): under G the note would
  fire exactly twice across the six sites — Westview December (beyond 1.4) and Federal March (beyond 1.3) — and
  the same part asserts that Westview, Federal, Test1 and Burns are byte-identical month by month under G.
- It renders without further work on both surfaces: the Plan's Monthly Program notes cell
  (`nutrition-au-fertiliser-integration.js:998-1004`, `.au-fert-notes`) and the Word export's month notes
  (`word-export.js:6392-6397`, joined with ". "). Neither surface has a fixed vocabulary for notes.
- The Nutrient Delivery Summary is **not** the place for this disclosure on New test: its P row is On Track via the
  range branch, correctly (2.3). GH-411's ceiling covers the pct branch; the range branch already prints Excess when
  the balance passes the ceiling.

### 3.3 Implementation, GH-410

`assets/au-fertiliser-products.js`:

1. `:6155-6163` — add `annualPRemaining: Math.max(0, annualTargets.P - delivered.P)` to the context object passed
   to `selectNitrogenSource()`. Read it **before** this month's granular is accumulated (it is; the call precedes
   `:6212-6214`).
2. `:5008` (between the end of SCORE 4 and the `// SCORE 5` comment at `:5009`) — the cap:
   ```js
   // GH-410: pScore above judges one month's share against one month's slice;
   // the dose lands whole. Cap it against what is left of the year so a
   // product cannot score "perfect" for matching 1.7 kg while carrying 6.4.
   if (pPct > 0 && typeof context.annualPRemaining === 'number') {
       const pBudgetRatio = context.annualPRemaining > 0 ? pAtRate / context.annualPRemaining : Infinity;
       let budgetScore = pScore;
       if (pBudgetRatio > 3.0) budgetScore = -20;
       else if (pBudgetRatio > 2.0) budgetScore = 10;
       else if (pBudgetRatio > 1.5) budgetScore = 30;
       if (budgetScore < pScore) pScore = budgetScore;
   }
   ```
   `pAtRate` is the whole dose at the scorer's rate (`:4892`). Until GH-412 lands that rate is one month's
   (100 kg/ha for 18-9-18, so 3.96 kg, not the 6.4 applied); the cap still flips both defective months, and when
   GH-412 corrects the rate the ratios become 3.76 and 2.7 — same bands or harsher. Say this in the comment so the
   two tickets do not look inconsistent.
3. `:6211-6214` — the disclosure note from 3.2.
4. Reword `tests/gh400-au-liquid-phosphorus.test.js:303-310` (wrong explanation) and update its `EXPECTED.after`
   for `new-test-location` (→ `[137.6, 14.4, 104.5]`) and `canberra` (→ `[218.4, 20.9, 126.6]` if D-2 accepts G
   alone), and the `4.7` pins at `:312-313` (→ `0.4`). Do not loosen them to `toBeCloseTo`.
5. The probe's `gap` print (1.1).

The liquid scorer (`selectFoliarNitrogen()`, pScore at `:5467-5495`) has the same monthly-only comparison. On
these six sites no liquid application carries more than 1.9 kg P; leave it alone under GH-410 and note it (D-6).

---

## 4. GH-411 — the ceiling

### 4.1 What the two branches do today

`assets/nutrient-balance-status.js:106-129`, the branch for a row with no usable range: `pct = round(delivered /
required × 100)`; `>= 90` On Track (sufficient), `>= 70` `Monitor (−X%)` (marginal), else `Deficit (−X%)`. There
is no upper tier; 2000 % is On Track. `diff = delivered − required` is the Balance column.

`:141-181`, the range branch: balance above ceiling → `Excess (+X%)` with X = overage as % of ceiling, class
`excess`, red; below floor → `Deficit (−X%)`; otherwise On Track, plain. GH-333 follow-up settled with the user
that On Track carries no number on either branch; GH-314 settled that both branches share one vocabulary.

`visualClass()` (`:192-197`) already maps `marginal` → amber and `excess` → red, and the badge CSS for all five
classes exists once, in `nutrition-prebble-integration.js:1937-1947`, loaded on every Plan page. No CSS work.

### 4.2 Proposal

Mirror the lower tiers above 100 %, using the range branch's word for the top:

```
pct > 130           statusClass 'excess'      label `Excess (+${deltaPct}%)`
110 < pct <= 130    statusClass 'marginal'    label `Monitor (+${deltaPct}%)`
90 <= pct <= 110    statusClass 'sufficient'  label 'On Track'              (unchanged)
70 <= pct < 90      statusClass 'marginal'    label `Monitor (${deltaPct}%)` (unchanged)
pct < 70            statusClass 'deficit'     label `Deficit (${deltaPct}%)` (unchanged)
```

`deltaPct = pct − 100`, exactly the suffix the lower tiers already print, so `Monitor (+15%)` sits beside
`Monitor (−12%)` and reads the same way. The number alongside (Balance = delivered − required) does not change.
Why 110/130: the 90/70 cut-offs have no cited source (GH-312 said so); a symmetric pair is the least arbitrary
choice available and keeps amber-before-red, which is what GH-333 made the colours mean (amber: a planned or partial
state; red: genuinely over-supplied, nothing corrects it). A one-tier ceiling (straight to Excess at 110 %) would
paint four nitrogen rows red on the dev sites for surpluses that come from label minimums and liquid top-ups; a
single tier at 130 % would leave 123 % reading as On Track, which is the complaint.

### 4.3 Measured label changes (section 1.5, six AU sites; `Excess` never triggers)

```
new-test-location  N  115%   On Track  ->  Monitor (+15%)
westview           N  112%   On Track  ->  Monitor (+12%)
federal-golf       N  113%   On Track  ->  Monitor (+13%)
test1-sports       N  123%   On Track  ->  Monitor (+23%)
canberra           N   92%   On Track      (unchanged; 109% after GH-410/G, still On Track)
burns              N  104%   On Track      (unchanged)
P and K rows       —         unchanged     (range or no-data branches on every one of the six)
```

The NZ site fixtures do not carry a required/delivered pair that this branch would classify, and the UK
integration does not use the shared classifier at all (`nutrition-uk-fertiliser-integration.js:1066-1072` keeps its
own `pct >= 90 ? positive : pct >= 70 ? warning : negative`, icon + `%` display, no words). D-4 covers it.

### 4.4 Implementation, GH-411

`assets/nutrient-balance-status.js:115-128` becomes:

```js
const pct = Math.round((delivered / required) * 100);
const deltaPct = pct - 100;
// GH-411: the lower tiers had a ceiling-less "On Track" above them — 2000%
// delivered read the same as 100%. Mirror them: 110/130 above, 90/70 below,
// Excess being the range branch's own word for the top state (GH-314: one
// vocabulary). On Track stays a plain label (GH-333 follow-up).
let statusClass, statusLabel;
if (pct > 130)      { statusClass = 'excess';     statusLabel = `Excess (+${deltaPct}%)`; }
else if (pct > 110) { statusClass = 'marginal';   statusLabel = `Monitor (+${deltaPct}%)`; }
else if (pct >= 90) { statusClass = 'sufficient'; statusLabel = 'On Track'; }
else if (pct >= 70) { statusClass = 'marginal';   statusLabel = `Monitor (${deltaPct}%)`; }
else                { statusClass = 'deficit';    statusLabel = `Deficit (${deltaPct}%)`; }
return { nutrient, currentDisplay: '—', rangeDisplay: '—', diff: delivered - required, statusClass, statusLabel, canCompute: false, currentPpm: null, currentKgHa: null };
```

Also: the two glossary strings (`nutrition-au-fertiliser-integration.js:1547`,
`nutrition-prebble-integration.js:1992`, byte-identical) describe Status only in range terms; append one sentence —
"For a nutrient with no soil range (nitrogen), Status compares Delivered with Required: On Track within ±10 %,
Monitor to ±30 %, Deficit / Excess beyond." Bump `CONFIG.version` in `nutrient-balance-status.js:44` to
`1.1.0-gh411`.

Tests that pin the old expression and must be updated in the same commit:
`tests/gh310-nutrient-status-percentage-label.test.js:53,81` (regex on `pct >= 90 ? 'On Track' : (pct >= 70 …`),
`tests/gh306-nutrient-delivery-summary-zero-required.test.js:75-79,106` (same expression, statusClass ternary).
`tests/gh396-report-plan-vocabulary.test.js:298` (258.6 / 288 = 90 % → On Track) and `:273` still pass. New
`tests/gh411-status-ceiling.test.js`: run the six fixtures through the recommender, classify the N rows, assert
the table in 4.3 exactly; unit-pin the boundaries 110 → On Track, 111 → `Monitor (+11%)`, 130 → Monitor,
131 → `Excess (+31%)`; assert `visualClass('excess') === 'negative'` is what the export will paint.

---

## 5. Ordering, and what the product looks like between the two

1. **GH-411 first.** One file, no selection change, no stored programme moves, no regeneration needed for the
   Plan page or export to show it (both classify at render time from persisted inputs). Between the two tickets the
   dev sites read: N `Monitor (+15%)` on New test, `(+12%)` Westview, `(+13%)` Federal, `(+23%)` Test1; New test's P
   row still On Track at 18.7 (range branch), Balance +4.7 in the Annual Product Summary.
2. **GH-410 second.** Stored programmes only change when a site is regenerated; until then GH-411's labels and the
   old picks coexist, consistently, because the classifier reads whatever the programme delivered. Regeneration of
   the four Australian sites must wait for the ticket currently verifying documents against the database (D-7).
3. **GH-412 after, separately** (section 10).

I agree with the brief that GH-411 can land first and independently.

---

## 6. Blast radius

**GH-411 — `classify()` callers.** `nutrition-au-fertiliser-integration.js:920` and
`nutrition-prebble-integration.js:878` (Plan's Nutrient Delivery Summary, both regions), `word-export-combined.js:4115`
(Annual Nutrient Requirements table in the document; it prints `cls.statusLabel` verbatim and colours by
`statusColour(statusClass)`, so it moves in lock-step). The Annual Product Summary's Balance row colour
(`nutrition-au-fertiliser-integration.js:1107`, `statusVisualClass(nBal.statusClass)`) — an N row that becomes
`marginal` turns that row's background amber, which is the intended reading. `hub.blade.php`,
`reports/forensic|scenarios|export.blade.php` load the module and inherit. The E2E parity harness
(`tests/e2e/ui-vs-export-parity.test.js:267-279`) reads Status as a free string from both surfaces and asserts
equality, not a vocabulary — it keeps passing as long as both surfaces move together, which they do. Not affected:
the UK integration (own logic), the tissue and disease status systems, GP colour-coding.

**GH-410 — who depends on selection.** Everything that renders the programme: the Plan's Monthly Program and
Annual Product Summary, the Word export's monthly table and Annual Product Summary, the purchasing summary
(GH-406), the K reconciliation (`word-export.js` `_computeProgrammeDelivered`), amendment self-suppression
(reads `analysis`). Offline pins that will move: `tests/gh400-au-liquid-phosphorus.test.js` (EXPECTED for
new-test-location and canberra; the "over-delivers, recorded" test), `tests/e2e/gh400-au-liquid-phosphorus-live.test.js:66`
(New test P 18.7 → 14.4 — only after regeneration). Pins that must **not** move: gh400's `before` column (pre-fix
recommender, unaffected), gh337 (source pins on the sizing formula — G does not touch it), gh327 (pins the bands;
the cap is additive), gh342/343 (netP/netK text), gh329, gh331, gh391. The parity fixtures
(`e2e-parity-new-test-location-slan.json`) pin inputs, not outputs — unaffected.

---

## 7. Testing and red-checks

**GH-411.** `tests/gh411-status-ceiling.test.js` as in 4.4. Red-check: restore `pct >= 90 ? 'On Track'`; the
fixture assertions fail with `Expected: "Monitor (+15%)" / Received: "On Track"` on New test N, and the 131 % unit
case fails the same way. Then `npx jest tests/gh310-* tests/gh306-* tests/gh396-* tests/gh338-*` green. Live, when
the other ticket allows: New test Plan page, Nutrient Delivery Summary, N row badge amber `Monitor (+15%)`; export
the document, Annual Nutrient Requirements table, same words, amber cell.

**GH-410.** `tests/gh410-phosphorus-annual-budget-cap.test.js` (new): load the recommender, run the six fixtures;
assert delivered N/P/K per site (`137.6/14.4/104.5`, `218.4/20.9/126.6` or the D-2 alternative, the other four as
baseline); assert New test November's granular is `Country Club MD 18-3-18` and that `Country Club IV 18-9-18`
appears once; assert Westview/Federal/Test1/Burns `monthly` JSON equals a run with the cap block reverted (the
"nothing else moved" guarantee); assert the disclosure note appears on Federal March and Westview December and
nowhere on New test. Red-check: revert item 2 of 3.3 — New test returns to 18.7 with two 18-9-18s, Canberra to
23.9; revert item 1 only (context not passed) — same, which proves the cap reads the context and does not default.
Keep the probe (with its print fixed); delete `tests/gh410-phosphorus-lever-measurement.test.js` in the GH-410
commit — its variant anchors are planning apparatus and variant G would then double-apply — and quote its table in
the Change log entry. Live, after regeneration is allowed: New test Plan, November row shows MD 18-3-18 @162, Annual
Product Summary P 14.4, Balance +0.4; export Annual Product Summary matches (`npm run test:e2e`).

---

## 8. Pitfalls — where an implementer is most likely to get this wrong

1. **Dividing the dose by `monthsCovered` in the cap.** The annual comparison must use `pAtRate` (whole dose). A
   two-month product spreads its N over two months in the accounting; its phosphorus is applied once. Using
   `effectiveMonthlyP` halves the ratio and the cap stops flipping November (1.16 → no band).
2. **Putting the cap inside the `pRequired <= 0` branch.** November's `pRequired` is 1.7 > 0. The cap has to run
   after the whole SCORE 4 ladder, for any `pPct > 0`.
3. **Reading `annualPRemaining` after `delivered.P +=`.** For the disclosure note in 3.2, compute `pBeyond` before
   the accumulator line at `:6213`, or every note is off by the dose it describes.
4. **Passing the remainder as `monthData.P` instead of as context.** That would make the monthly adequacy bands
   judge 3.96 kg against 14 (ratio 0.28 → pScore 40 in January) and shift every site. The monthly score stays
   monthly; only the cap looks at the year.
5. **Expecting A–E to do something and "tuning" them until they do.** They act in a band the scorer never enters.
   If a change to the -20 line moves a number, something else moved too.
6. **Trying to make Burns exact.** Its -1.7 is the `annualPRemaining > 2` gate at `:6370` (GH-331 follow-up 3). A
   fourth MAP top-up would need that gate changed — a separate decision, and it would then over-deliver by 2.4.
7. **Adjusting the catalogue order while doing this.** `bestScore` uses strict `>` (`:5112`), so ties go to the
   earlier product. MD 18-3-18 and MP Spring Start tie at 55.5 on New test; the pins in 7 depend on that order.
8. **Tightening the fixture pins with `toBeCloseTo`.** These numbers are the pin; a 0.1 drift is a real change.
9. **GH-411: putting a number on On Track.** GH-333 follow-up was an explicit user decision; the number goes only
   on Monitor/Deficit/Excess.
10. **GH-411: comparing the unrounded ratio.** `pct` is `Math.round`ed before the 90/70 test today; keep the same
    for 110/130 so 110.4 % is On Track and 110.5 % is Monitor, and pin both sides of the boundary.
11. **GH-411: adding a ceiling to the `required === 0` branch (`:112-114`).** Delivered > 0 against required 0 is
    On Track there by GH-306's decision (Burns K 0/0 relies on it); the "soil above ceiling" case is the range
    branch's, which already says Excess.
12. **GH-411: touching the range branch or deriving an N ceiling from a balance.** N has no range; the pct branch
    is the whole change.
13. **GH-411: forgetting the export shows the same label.** `word-export-combined.js:4135` prints `cls.statusLabel`;
    if the Plan is checked and the document is not, the parity harness will be the first to notice.
14. **The disclosure note must not contain the herbicide note text** — the export filters month notes by string
    equality against it (`word-export.js:6392-6393`); it will not, but do not reuse that wording.
15. **Do not remove the `[GH336-DEBUG]` logs** while in this function (project convention: they stay until the
    user confirms in the UI).
16. **Do not press Generate on the Plan page** to check any of this until the ticket verifying documents against the
    current database is done; every measurement above is reproducible offline.
17. **Two "required" figures.** The recommender budgets against `annualTargets.P` = the sum of the calendar's
    monthly rows (14.0 on New test); the engine's `annual_requirements` (GH-403) is 14.2. Fixture pins use the
    former; the Plan's Required column prints the latter. Do not "reconcile" them inside GH-410.

---

## 9. Open questions needing a product decision, each with a recommendation

- **D-1 Ship G alone (GH-410) or F+G together?** Recommend **G alone now**; F as GH-412 with its own plan. G
  touches two months on two sites; F touches the first pick on five sites and drops New test's K by 16 kg on a
  soil already 36 % below floor.
- **D-2 Accept Canberra's N/K shift under G (N -15.3 → +18.4, K +0.9 → +16.6)?** Recommend **accept, documented
  in the Change log**, because the alternative — F+G — is D-1's larger change, and the December pick that causes it
  (MD 20-0-10 @280 in the last month) is GH-412's defect, which will move it again. If the user prefers not to
  present a +18.4 N on a site that read -15.3, the fallback is to ship F+G on Canberra's numbers (175.9 / 19.9 /
  118.4) — but then D-1 is answered the other way for all sites.
- **D-3 Ceiling tiers 110 / 130.** Recommend as proposed. Alternative 120 / 150 leaves Test1's 123 % On Track,
  which is the complaint restated.
- **D-4 UK integration.** Recommend **leave under GH-411** and file a follow-up to route
  `nutrition-uk-fertiliser-integration.js:1058-1076` through `GAIP_NutrientBalanceStatus` (it was left out of
  GH-396); patching its inline ternary now would be a fourth copy of the rule.
- **D-5 Disclosure note threshold and wording.** Recommend 0.5 kg and the wording in 3.2. A 0 kg threshold would
  annotate New test's November after G (0.4 kg) — noise.
- **D-6 Apply the annual cap to the liquid scorer too?** Recommend **not now**; no liquid on the six sites carries
  more than 1.9 kg P; measure before adding a second cap.
- **D-7 When to regenerate the four AU sites** so the live pins (`gh400-…-live.test.js:66`) and the documents
  reflect GH-410. Recommend after the current document-verification ticket closes, all four in one session, with
  `npm run test:e2e:phosphorus` updated in the same commit.

---

## 10. Other findings

1. **GH-412 candidate — the scorer prices an application that is not made** (2.4, variant F). GH-337 scaled
   `rateKgHa` by `monthsCovered` at `:5155` but `rateNeeded` (`:4786`), `canDeliver` (`:4817-4821`), the GH-329
   filter's `effectiveMonthlyOf` (`:4865-4869`) and the scoring `actualRate` (`:4889`) still use one month's N. For
   every slow-release candidate the composite describes half the dose. Measured consequence beyond phosphorus:
   nScore says "acceptable" (20) for a product that will match N exactly, Canberra's December under G buys 56 kg N
   against 33.8 net. Needs its own plan and product review; the F variant in the measurement test is the starting
   measurement.
2. **A two-month product in the last month of the programme** releases half its dose outside the year (Canberra
   December, MD 20-0-10 @280 under G; also baseline's own two-month picks in December on other sites). Nothing in
   `generateAnnualProgram()` shortens or penalises release windows that overrun `idx = 11`. Part of GH-412 or its
   own ticket.
3. **The GH-312 test header** (`tests/gh312-unified-nutrient-balance-status.test.js:46-49`) says MLSN/SLAN sites
   have "no ceiling concept" and fall back to the pct model. Since ranges are resolved for every methodology
   (`nutrition-calendar.js:1600-1642`), SLAN and MLSN P/K rows take the range branch (1.5). The comment is stale;
   fix it in GH-411's commit.
4. **Federal Golf's persisted programme in the 2026-09-10 snapshot** was generated from different inputs than the
   GH-400 fixture (P required 18.1 vs 11.9, K 29.1 vs 63.9). Anyone building a fixture from that snapshot for
   Federal should regenerate the source first.
5. **Federal K reads On Track at 252 % delivered vs required** (73.4 vs 29.1 on the snapshot programme) because the
   range branch judges the projected balance (163 in 105–246), not the delivery. Consistent with GH-312's model and
   out of scope, but it is the same shape of question as GH-411 one level up: the range branch has no view of
   delivery efficiency at all.
6. **`soilPSufficient` default.** `selectNitrogenSource()` comments "Default true (MLSN approach)" (`:4846`) while
   the call site always passes `annualTargets.P <= 0`. Harmless, misleading; tidy in GH-412.
7. **The probe's first table** sorts and prints an undefined `gap` (1.1).

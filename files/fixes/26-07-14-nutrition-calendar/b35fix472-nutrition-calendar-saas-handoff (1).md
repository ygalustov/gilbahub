# Nutrition Calendar: b35fix472 Scope and Open Defects
## Engineering handoff, plugin to SaaS port

**Prepared:** 12 July 2026
**Plugin build:** b35fix472 (v11.25.43), shipped and deployed
**SaaS port baseline:** b35fix395 (frozen)
**Module in scope:** `assets/nutrition-calendar.js`, specifically `distributeByGP` and `applyNCap`
**Author:** Gilba Solutions (Jerry Spencer)

---

## 1. Why this module needs port-team attention

`computeProgram` and its two helpers `distributeByGP` and `applyNCap` were extracted as pure logic at **b35fix304**. The SaaS port froze at **b35fix395**. Since 304 precedes 395, **the frozen SaaS baseline already contains all three functions verbatim, including the defects described below.**

All three functions are **pure**: zero DOM reads, zero browser-global reads, operating only on the `inputs` object and locals. Verified by grep. This has two consequences:

1. They **direct-copy** to the SaaS port as static assets. No re-architecture needed. A source fix in the plugin propagates by file copy.
2. The **safety net does not copy with them.** In the plugin, every caller reaches `computeProgram` through `collectFromState`, which sanitises inputs. The SaaS port calls `computeProgram` directly and constructs its own inputs. Defects that are unreachable in the plugin become reachable in SaaS. Section 4 is the critical case.

---

## 2. What b35fix472 fixed

### Removed the Front-loaded distribution option (ledger entry C69)

**Change:** one line removed from `gilba-agronomic-intelligence-hub.php`, deleting `<option value="front_loaded">Front-loaded (spring emphasis)</option>` from the Distribution Method select. Two options remain: `gp_weighted` (default) and `even`.

**No JavaScript was changed.** The `front_loaded` branch in `distributeByGP` is still present in source. It is now unreachable from the plugin UI.

**Why removal closes the exposure:** `distribution` is read at exactly one site, `nutrition-calendar.js:358`:

```js
const distribution = this.elements.distributionSelect?.value || 'gp_weighted';
```

It is **never persisted or restored** anywhere in the asset tree. With the option gone from the DOM, the select cannot hold the value, `.value` resolves empty, and the expression falls back to `gp_weighted`. No saved site can resurrect it.

**Verification performed:** `php -l` clean on all 50 PHP files in the shipped zip; `node --check` clean on the calendar module; `<select>` tag balance 23/23; nutrition regression suites 110/110; deployed and confirmed in production (dropdown shows two options).

### What this did NOT fix

**The `front_loaded` branch itself is still broken and still ships to SaaS.** Removal closed the door; it did not repair the room. See Section 3.

### Scope caveat, resolved

The Front-loaded export corruption was only ever triggered **if a user selected Front-loaded**. GP-Weighted is the default.

**Front-loaded was never selected on a live NZ/Prebbles report.** Confirmed by Jerry. No client deliverable was ever affected and no report needs reissuing. b35fix472 was therefore **purely preventative**, closing a path that could have produced wrong figures but never did.

---

## 3. OPEN: `distributeByGP` front_loaded branch (C69, SaaS-port-target)

**Status:** logged in `post_395_migration_ledger.md` as C69. Owned by the port team. **Do not re-expose a Front-loaded option in the SaaS UI until this is rebuilt.**

**Location:** `assets/nutrition-calendar.js:835-845`

```js
} else if (method === 'front_loaded') {
    // 60% in spring (months 8-10 south, 2-4 north)
    // Simplified: weight first half more
    const total = annualAmount;
    for (let m = 0; m < 12; m++) {
        const gp = monthlyGP[m] || 0;
        allocations[m] = gp >= CONFIG.minGpThreshold ? total / 10 : 0;
    }
    // Boost spring months
    [8, 9, 10].forEach(m => { allocations[m] *= 1.5; });
}
```

### Defect 1: does not conserve mass

Every month clearing `minGpThreshold` receives `total / 10`, one tenth of the **full annual amount**. There is no division by the number of active months and no renormalisation. With nine active growing months, 0.9 x total is allocated before the spring boost is even applied. Monthly rows do not sum back to the annual requirement.

Measured on an NZ-shaped southern input (200 kg N target, perennial ryegrass, greens):
- N: annual requirement 200, monthly rows sum to 210 pre-cap
- K: annual table 110, monthly rows sum to 115.5

**This defect is hemisphere-independent. It affects NZ sites exactly as much as any other.**

### Defect 2: hemisphere-blind

`[8, 9, 10]` are zero-indexed September, October, November. Southern spring. Correct for NZ, **wrong for UK/EU**, where those indices are autumn. The code comment states the intended behaviour it never implemented ("months 8-10 south, **2-4 north**"). This is latent rather than live while the focus is NZ-only, but it is a blocker for any northern-hemisphere rollout.

### Why it matters: the NZ/Prebbles blast radius

`PrebbleRecommender.generateProgram` derives its annual nutrient totals by **summing the monthly array** (`prebbles-products.js:1350-1352`):

```js
const annualN = monthlyData.reduce((sum, m) => sum + (m.N || 0), 0);
const annualP = monthlyData.reduce((sum, m) => sum + (m.P || 0), 0);
const annualK = monthlyData.reduce((sum, m) => sum + (m.K || 0), 0);
```

`monthlyData` is `computeProgram(...).program.monthly`. A front-loaded distribution therefore feeds **inflated annual totals** into Prebbles product selection and application rates. It also walks `monthlyData` per month to make granular/liquid product decisions, so distorted monthly figures distort which product lands in which month.

Both export paths are affected:

| Path | Route |
|---|---|
| **Single** | `computeProgram` -> `generate()` dispatches `gaip:nutrition-calendar-generated` (`nutrition-calendar.js:1159`) -> `NutritionPrebbleIntegration.generateAndRender` (`nutrition-prebble-integration.js:63`) -> `window.GAIP_NUTRITION_PROGRAM` -> `word-export.js:9455` |
| **Combined** | `collectFromState` (`word-export-combined.js:1728`) -> `computeProgram` per sample (`word-export-combined.js:1810`) -> NZ routes to Prebble branch (`word-export-combined.js:1904`) |

### Recommended rebuild shape

**Prebbles already computes hemisphere-correct spring and summer/autumn windows itself** (`prebbles-products.js:1359-1364`):

```js
const springMonths = hemisphere === 'south' ? [8, 9, 10] : [2, 3, 4];
```

So the calendar-layer front-load is **redundant even when it works correctly**. Prebbles owns the strategic timing. All the calendar layer needs to hand it is a **mass-correct annual figure**, which `gp_weighted` and `even` both deliver.

Two defensible options for the port team:

1. **Do not re-expose Front-loaded at all.** Prebbles already does the spring emphasis. This is the recommended default.
2. **If re-exposed:** front-load the **top-GP months** and renormalise to conserve mass. GP already encodes hemisphere phase via `monthlyTemps`, so a GP-peak approach is hemisphere-correct for free and mass-conserving in one change. Do not reintroduce hardcoded month indices.

---

## 4. OPEN AND HIGHEST PRIORITY FOR SAAS: `applyNCap` null-cap zeroes the entire nitrogen programme

**Status:** NOT yet logged in the ledger. Proposed as a new C-entry. **This is the single most important item in this document for the port team.**

**Location:** `assets/nutrition-calendar.js:877-894`

```js
NutritionCalendar.applyNCap = function(nAllocations, maxN) {
    const capped = {};
    let totalCapped = 0;
    let originalTotal = 0;

    for (let m = 0; m < 12; m++) {
        originalTotal += nAllocations[m] || 0;
        capped[m] = Math.min(nAllocations[m] || 0, maxN);   // <-- Math.min(x, null) === 0
        totalCapped += capped[m];
    }
    ...
};
```

`Math.min(x, null)` coerces `null` to `0` and returns `0`. There is **no guard** on `maxN`.

### Measured behaviour (200 kg N target, NZ-shaped southern input, gp_weighted)

| `maxNPerMonth` passed | Monthly N sums to | Result |
|---|---|---|
| `null` | **0.0** | **Entire N programme silently zeroed** |
| `undefined` | **NaN** | **Programme corrupted** |
| `0` | **0.0** | Entire N programme zeroed |
| `""` (empty string) | **0.0** | Entire N programme zeroed |
| `25` | 172.0 | Capped, 28 kg dropped (see Section 5) |
| `50` | 200.0 | Correct, cap does not bite |

In every zeroed case the function still reports `annual_totals.N = 200`. **The headline says 200 kg N. Every month says zero. Nothing errors.**

### Why the plugin is safe and SaaS is not

The plugin is protected by a sanitiser that **is not part of the pure function**. `collectFromState`, `nutrition-calendar.js:357`:

```js
const maxNPerMonth = parseFloat(this.elements.maxNInput?.value) || 50;
```

A blank field gives `parseFloat('') === NaN`, and `NaN || 50` gives `50`. Both the live widget and combined export go through this line, so **no plugin user can reach the defect.** Confirmed.

**`collectFromState` is DOM-bound and does not port.** The SaaS layer constructs its own inputs and calls `computeProgram` directly. A SaaS developer passing `maxNPerMonth: null` to mean "no cap", which is the obvious and natural reading, will **silently zero the entire nitrogen programme of every affected site** while the annual total still displays correctly. On the NZ path this propagates into Prebbles, which sums the monthly array, so Prebbles would compute `annualN = 0` and recommend no nitrogen product.

### Required action, port side

Add an explicit guard inside `applyNCap` (pure, ports by direct copy):

```js
// Treat null / undefined / 0 / '' / NaN as "no cap" rather than a zero ceiling.
const cap = (typeof maxN === 'number' && isFinite(maxN) && maxN > 0) ? maxN : Infinity;
```

`Math.min(x, Infinity)` returns `x`, which is the correct "no cap" semantic. Do **not** rely on the SaaS input layer to reproduce the `|| 50` default; put the guard in the pure function so it travels with the code.

---

## 5. ACTION REQUIRED: `applyNCap` discards excess instead of redistributing

**Status:** NOT yet logged in the ledger. **Decision made, see "The decision, made" below. Implement as specified.** Distinct from Section 4.

**Owner:** SaaS port team. This will NOT be fixed in the plugin. The plugin will carry this defect until cutover, knowingly accepted.

**Location:** same function, `nutrition-calendar.js:877-894`.

When the cap bites, each month is clipped to `maxN` and **the overflow is discarded.** It is not pushed into months that still have headroom below the cap.

Measured (200 kg N target, `maxNPerMonth = 25`, NZ-shaped southern input, gp_weighted):

- `annual_totals.N` reports **200**
- Monthly rows sum to **172**
- **28 kg N (14%) silently dropped**
- Months sitting below the cap that could have absorbed it: **Apr = 15, May = 4.6, Sep = 8.8, Oct = 18.6**

The shortfall is surfaced in a warning box (`renderSummary`, `nutrition-calendar.js:1240-1244`), so it is transparent rather than hidden. But the annual headline overstates what is actually scheduled, and the turf is under-fed when the shortfall was avoidable.

**This affects `gp_weighted` too.** It is not closed by the b35fix472 Front-loaded removal.

**Live exposure is conditional on the cap actually biting.** The cap is a ceiling, so it only acts when a month's allocation exceeds it. On the 200 kg N NZ-shaped greens programme above, the natural monthly spread peaks at **33.2 kg** (Jan and Feb), so the cap does nothing until it is set below that:

| `maxNPerMonth` | Annual N delivered | Dropped |
|---|---|---|
| 1000, 100, 50, 40, 35 | 200.0 kg | 0.0 kg (cap never bites) |
| 30 | 192.0 kg | 8.0 kg |
| 25 | 172.0 kg | 28.0 kg |
| 20 | 147.0 kg | 53.0 kg |
| 10 | 83.4 kg | 116.6 kg |

Uncapped monthly allocations for reference:

```
Jan=33.2  Feb=33.2  Mar=29.1  Apr=15.0  May=4.6  Jun=0  Jul=0  Aug=0
Sep=8.8   Oct=18.6  Nov=25.9  Dec=31.6          peak = 33.2 kg
```

The plugin default is 50 kg/month, comfortably above the peak, so on a standard programme the cap is inert and nothing is lost. **This is why the defect has gone unnoticed.** It only bites when a superintendent deliberately lowers the cap to spoon-feed, which is a routine and reasonable thing to want on greens.

### The decision, made

**The cap is a spoon-feeding instruction, not a hard ceiling.**

A superintendent who lowers the max-N-per-month is saying "spread the same nitrogen thinner across more months," NOT "give the turf less nitrogen." The annual target must still be delivered in full.

**Implement redistribution. Do not reduce the annual total.**

### Implementation spec

Push the clipped overflow into months that still have headroom below the cap, iterating until either the overflow is fully placed or every eligible month sits at the cap.

**Critical agronomic constraint:** only months **already carrying a non-zero allocation** are eligible to receive redistributed nitrogen. Months allocated zero are below the growth-potential threshold (dormant turf, Jun/Jul/Aug in the NZ example above). Pushing nitrogen into dormant turf is agronomically wrong and must not happen. Do not treat a zero month as "headroom."

Worked example on the 25 kg cap case above:
- Overflow clipped from peak months: 28 kg
- Eligible headroom months (non-zero allocation, below cap): Apr 15 (headroom 10), May 4.6 (headroom 20.4), Sep 8.8 (headroom 16.2), Oct 18.6 (headroom 6.4)
- Total eligible headroom: 53 kg
- 28 kg fits inside 53 kg, so the full annual 200 kg is delivered, and no month exceeds 25 kg

Distribute proportionally to available headroom. A single pass suffices when overflow is less than or equal to total headroom; iterate if a month fills to cap mid-pass.

**Residual handling.** If the overflow genuinely exceeds all available headroom (cap set very low, e.g. 10 kg on a 200 kg programme), fill every eligible month to the cap and report the remainder explicitly as unschedulable. In that case, and only that case, the annual target cannot be met and the UI must say so plainly.

### Reporting contract

`annual_totals.N` and the monthly rows **must agree**. The current state, where the headline says 200 and the rows sum to 172, is indefensible under either behaviour.

The existing return object from `applyNCap` (`capApplied`, `originalTotal`, `cappedTotal`) drives only the on-screen warning box (`renderSummary`, `nutrition-calendar.js:1240-1244`). It is **not read by any export**, verified by grep, so the return contract can be changed freely. Suggested shape:

- `capApplied`: true if any month was clipped
- `redistributed`: kg moved into headroom months
- `unschedulable`: kg that could not be placed (normally 0)

The warning box should distinguish the two cases: redistribution succeeded (informational, annual total delivered in full) versus cap too low to absorb the overflow (genuine warning, annual target not met, state the shortfall).

---

## 6. Summary table

| Item | Ledger | Fixed in b35fix472? | Still live in SaaS baseline? | Owner and action |
|---|---|---|---|---|
| Front-loaded option exposed in UI | C69 | **Yes** (plugin only, PHP one-liner) | UI is rebuilt in SaaS | Closed for plugin. **Do not re-expose in SaaS.** |
| `distributeByGP` front_loaded: mass non-conservation | C69 | **No** (JS untouched, by design) | **Yes** | Port team. Blocker before any re-exposure. Recommended: do not re-expose at all. |
| `distributeByGP` front_loaded: hemisphere-blind | C69 | **No** | **Yes** | Port team. Latent on NZ, blocker for UK/EU. |
| `applyNCap`: null/blank cap zeroes the N programme | **unlogged (C70 proposed)** | **No** | **Yes, and SaaS removes the plugin's accidental protection** | **Port team. Highest priority. No decision needed, add the guard.** |
| `applyNCap`: discards excess instead of redistributing | **unlogged (C71 proposed)** | **No** | **Yes** | **Port team. Decision made: redistribute. Implement per Section 5.** |

**Plugin position, knowingly accepted:** the two `applyNCap` defects will NOT be fixed in the WordPress plugin. Plugin subscribers who lower the max-N-per-month below the peak month will continue to be under-fed until SaaS cutover. This is an accepted risk, limited by the fact that the default cap of 50 kg/month does not bite on a standard programme.

**Front-loaded was never selected on a live NZ/Prebbles report.** Confirmed by Jerry. No client deliverable was ever affected, and no report needs reissuing. b35fix472 was purely preventative.

---

## 7. Verification commands

Against the frozen b35fix395 SaaS copy, to confirm the defects are present:

```bash
grep -n "front_loaded" assets/nutrition-calendar.js            # branch exists
grep -n "\[8, 9, 10\]" assets/nutrition-calendar.js            # hemisphere-blind hardcode
grep -n "Math.min(nAllocations\[m\]" assets/nutrition-calendar.js   # unguarded cap
```

All three will hit at b35fix395.

If the port team's copy of `nutrition-calendar.js` has been **hand-modified since the freeze**, direct copy of any corrected file will clobber their changes. These greps also confirm whether their copy still matches the b35fix304 shape. **Confirm frozen-or-modified status before any file-level reconciliation.**

Post-fix regression baseline (plugin, b35fix472): nutrition suites 110/110 passing across `fertiliser-recommendation-fragment-b35fix403`, `c53-aa-methodology-value-routed-write-b35fix443`, `c31-c32-marginal-hybrid-and-slan-p-floor-b35fix426`, `slan-interpretation-pluralisation-b35fix408`, `c55-soil-shelf-read-priority-b35fix446`.

---

## 8. Decisions already taken (no further input needed from Gilba)

1. **Was Front-loaded ever selected on a live NZ/Prebbles report?** **No.** Confirmed. No deliverable was affected, nothing needs reissuing.
2. **Hard ceiling or redistribute for the N cap?** **Redistribute.** The cap is a spoon-feeding instruction. The annual target must still be delivered in full. See Section 5.
3. **Will the plugin be fixed?** **No.** Sections 4 and 5 are SaaS-port work. The plugin carries the defects until cutover, knowingly accepted.

---

## 9. Port team action list

In priority order:

1. **Add the `maxN` guard to `applyNCap`** (Section 4). One line, pure, no decision needed. Do this before the first SaaS nutrition run. Without it, a `null` cap silently zeroes every month's nitrogen while the annual total still reads correctly, and Prebbles will recommend no nitrogen product.
2. **Implement overflow redistribution in `applyNCap`** (Section 5). Spec and worked example provided. Respect the constraint that dormant (zero-allocation) months are not eligible to receive nitrogen.
3. **Make `annual_totals.N` agree with the monthly rows** under all cap conditions, or state the shortfall explicitly when the cap is genuinely too low to absorb the overflow.
4. **Do not re-expose a Front-loaded distribution option** (Section 3) unless the mass-conservation and hemisphere defects are rebuilt first. Recommended: do not re-expose at all, since Prebbles already owns spring timing.
5. **Confirm frozen-or-modified status** of your `assets/nutrition-calendar.js` before any file-level reconciliation (Section 7). If your copy has moved since b35fix395, a direct copy will clobber your changes.

Questions to Jerry (jerry@gilbasolutions.com) on anything agronomic. Questions on the plugin-side provenance of any of the above: the full trace is in `post_395_migration_ledger.md`, shipped inside the b35fix472 zip.

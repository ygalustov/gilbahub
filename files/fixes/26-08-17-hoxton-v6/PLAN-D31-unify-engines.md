# PLAN — D31 stage 2: one requirement engine and one input contract for the Plan page and the Word export

Stage 1 (analyst) deliverable. Analysis and plan only — no source, test or doc file was edited for this document.
Baseline: commit `521473c`, working tree clean except unrelated uncommitted edits to `docs/instructions.md` (1 line) and
`files/fixes/26-08-17-hoxton-v6/REVIEW-GH349-onward.md` — leave both alone. All paths relative to
`/Users/katep/Documents/Work/gilba/gilbahub/`. Every line number below was read at `521473c`; every numeric claim was
either read off the code, queried from the dev DB (`gilba_mysql`, namespace `gaip`, 10 sites), run through the real
modules in Node (`scratchpad/mlsn-threeway.js`, transcribed in section 1.6), or observed live with Playwright against
`http://127.0.0.1:8080` (section 1.2, 1.4, 1.5).

Rules that bind the implementer: comments in English only; code comments carry a `GH-NNN` number (see section 8 for the
numbering question); no edits to old-hub-only files (`nutrition-summary-integration.js`, `legacy-hub-markup.blade.php`,
`site-data-transfer.js`, `hub-persistence.js`); any algorithm change beyond the four fixed decisions needs the user's
explicit confirmation — section 9 lists every such point.

---

## 0. Executive summary

1. **The gate is not green today.** `npm run test:e2e` at `521473c` reports **12 passed / 2 failed** (log:
   `scratchpad/e2e-run1.log`), not the 14/14 the brief states. Test5 - NZ's persisted programme carries
   `meta.clippingManagement = "returned"` (DB read 2026-09-09; the stopped GH-383 work's own live check at
   PLAN-GH383 §5.4 switched it and never switched it back). The Plan page applies the calendar's clipping factors
   (K ×0.5, P ×0.4), the export's AA branch applies none: K removal **55 vs 109.4**, K required **82 vs 136.1**, P
   removal **14 vs 33.9**. This is the pure input/model divergence the brief describes, showing up live on the fixture.
   The unification's first shippable stage must turn this green.

2. **The recommended architecture is close to the previous one but not the same.** Converge on the pure core — yes.
   But the "caller-side adapter" must be ONE shared module that both surfaces call for every programme-level input
   (annual N base, traffic, clipping, turf type, species key, methodology key, texture, CEC, pH, AA ranges), with a
   provenance stamp per field and a fail-loud schema on the core. Two per-surface adapters would keep exactly the
   bug class that produced GH-379, the clipping gap and the N-source gap. Section 2.

3. **Three arithmetic divergences the brief does not list are live in the code today** (section 1.6), all inside the
   "removal/correction/ceiling" half the core was supposed to have unified:
   - MLSN below-threshold lift: engine and core lift to `target = 1.5 × threshold`; the calendar lifts to the
     threshold itself. On Burns "12th Fairway" (MLSN, P 18 ppm, pH 6.7) the Plan says P required **14**, the export
     ANR says **21.5**. Not covered by any fixture or by the E2E (AA only).
   - MLSN P threshold pH ladder: engine and core use 35/28/21/32/40 by pH; the calendar uses flat 21. GH-382's
     changelog claims "neither engine applies a pH adjustment to [MLSN]" — false; GH-382 closed SLAN only.
   - Generic (non-tissue) removal ratio: calendar flat P 0.10 / K 0.55 / Ca 0.17 / Mg 0.08 / S 0.05 for every
     species; engine and core use `REMOVAL_RATES[species]` ratios (K/N from 0.531 for `mixedCool` to 0.625 for
     buffalo). P/N is 0.10 in every table row, so P never moves; K moves by −3 % to +14 % on the Plan page for the
     dev sites where tissue does not govern (at least 7 of 10), and Ca/Mg/S move on every site. This was resolved inside the GH-376 core as an
     "engineering" choice but it changes what the user sees on /plan and is NOT one of the four fixed decisions —
     it must go to the user (section 9, D-5).
   Plus two smaller seams (exact-ceiling `>=` vs `>`; missing-soil nutrient omitted by the core, removal-only on the
   Plan) and GH-382 being inert on the live Plan page because `nutrition-requirement-engine.js` is not loaded there
   (section 1.5).

4. **The N-source finding in the brief needs a correction.** Live on `/reports/export` the hidden
   `.gaip-nutrition-annual-n` IS populated — by `nutrition-calendar.js`'s own `restoreFromPersisted()` on
   `gaip:site-config-applied` — with the active site's persisted `adjustments.target_n` (Federal Golf: input 120,
   `turf.nProgram` 150; Burns 120/150; Test1 120/250). So a single-site export already uses the Plan's N. The live
   divergence is (a) every OTHER site in a multi-site Combined export inherits the active site's N
   (`restoreFromPersisted()` returns early once `this.program` is set, REVIEW open question 12 saw Burns print 250),
   and (b) the fallback to `turf.nProgram`/legacy default 200 when a site has no programme or the restore cascade has
   not finished. The "9 of 10 sites disagree" figure is the latent gap behind (b), not a live single-export gap.

5. **Traffic is a stage of its own (section 6):** persist the Settings → Traffic & Wear schedule in the site config
   (today it lives only in `localStorage`, key `gilba_traffic_state_<siteId>`), derive the intensity level in the
   shared adapter, apply the calendar's table to the annual N for `turfType === 'sports'` only. Thresholds and the
   no-schedule default are put to the user with three candidate rules, none invented here.

6. **The GP-weighted monthly distribution stays out of the cutover** (section 4). What the cutover DOES unify is the
   annual N that feeds both distributions.

7. **Stopped work (GH-383/384):** fold the caller-side clipping fix, the base-N persistence, the comment corrections and
   the test file's assertions into stage 1; discard the engine-side ports and the boolean alias (section 5).

---

## 1. Verified current state

### 1.1 The three computation paths

| path | file | entry | pure? | loaded on |
|---|---|---|---|---|
| Plan page programme | `assets/nutrition-calendar.js` | `computeProgram(inputs)` 1503-1984, fed by `collectFromState()` 330-615 | No — `computeProgram` reads `window.HillLabsSampleTypes` 1662, `window.AmmoniumAcetateMethodology` 1679, `window.GilbaClassificationConstants` 1722, `window.NutritionRequirementEngine_Pure` 1753, `console.log` 1681/1688/1703/1851; `collectFromState` reads DOM and `GAIP_STATE` throughout | `plan.blade.php:1027`, `reports/export.blade.php:290`, `scenarios:159`, `forensic:140`, `hub.blade.php:234` |
| Word export ANR / K Reconciliation / Monthly N Distribution | `assets/nutrition-requirement-engine.js` | `compute({soil, turf, climate, aaRanges, tissuePercent, overseedConfig})` 905-1021 | Yes (one `window.GilbaClassificationConstants` read in the SLAN branch 600-602, with an identical fallback) | `export.blade.php:223`, `scenarios:93`, `forensic:75`, `hub.blade.php:66` — **not** `plan.blade.php` |
| Shared core (GH-376) | `assets/nutrition-requirement-core.js` | `compute({soilValues, species, ph, methodology, aaRanges, tissuePercent, annualN, bulkDensity, soilDepth, clippingsCollected, trafficIntensity})` 550-577 | Yes (same one constants read, 431-433) | **no blade loads it** (grep of `app/resources/views`: zero hits); called only by `tests/gh376-*.test.js`, `tests/gh370-real-data-belowfloor-test5-verified.test.js` |

Both export files consume the engine: `word-export.js:9807-9825` (single export), `word-export-combined.js:1912-1941`
(post-loop ANR pass). The export also runs the calendar per sample for the Monthly Schedule / product programme
(`word-export-combined.js:2361`). The old hub's Nutrition Summary panel calls the engine too
(`nutrition-summary-integration.js:1386-1400`, with `clippingsCollected: turfConfig.clippingsCollected`,
`trafficIntensity: turfConfig.trafficIntensity`, `nProgramKgHaYr: userN`) — the engine's public `compute()` shape is
therefore a compatibility surface for the old hub for as long as `hub.blade.php` exists.

### 1.2 Live gate status (Playwright, dev stack, 2026-09-09)

`GILBA_E2E=1 … npx jest tests/e2e --runInBand` → **12/14**, two failures, all rows attributable to clipping:

| row | Plan | export | cause |
|---|---|---|---|
| K: Plan card vs ANR "K req" | 82 | 136.1 | calendar K ×0.5 (`returned`), engine AA branch no clipping |
| P removal: Plan column vs engine | 14 | 33.9 | calendar P ×0.4 |
| K removal: Plan column vs engine | 55 | 109.4 | as above |
| K required: Plan vs engine / vs K Reconciliation | 81.9 | 136.1 | as above |

DB after the run: `nutritionCalendarProgram.meta.clippingManagement = "returned"`, `annual_removal = {K 55, P 14, …}`,
`annual_totals = {K 82, P 0, …}`, `target_n = 250`, `traffic_modifier = 1`. The brief's "14/14" was true while the
meta read `collected` (the GH-381/382 runs); it is not true of the tree as it stands. **Do not "fix" the fixture by
switching the select back** — the gate must stay green at either value, which is the whole point of stage 1.

### 1.3 The five input fields of `_buildEngineInputs()` (`word-export.js:6759-7180`), field by field

| field | export source (line) | Plan-page source | verdict |
|---|---|---|---|
| `turf.species` | sample `turfProfile.species` override 6786-6805 → `GAIP_CANONICAL_STATE.turf.effectiveSpeciesKey/speciesKey` → `GAIP_STATE.inputs.turf.species` → `GAIP_STATE.turf.species/grassSpecies` → `.gaip-species` DOM → hard-fail (6835-6868) | `collectFromState()` 376-391 → `SpeciesController.toNutrientKey(normalize(...))` | Different vocabularies (display name vs nutrient key); both fold correctly through the engine/core `normalizeSpecies()` (species-controller `toNutrientKey` 553-561 outputs `bermuda`, `buffalograss`, `creepingBentgrass`, `poaAnnua` … — all map to a `REMOVAL_RATES` key except `poaAnnua`/`cotula`, which fall to `mixedCool`). E2E already asserts the resolved key. **Keep; adapter should resolve ONE key once.** |
| `turf.clippingsCollected` | `!!GAIP_STATE.turf.clippingsCollected` 7158 — **no writer anywhere in `assets/` or `app/`** (grep; only the legacy `nutrition-summary-integration.js:853,866` reads it) → always `false` | Plan select `.gaip-nutrition-clipping` (`plan.blade.php:918-921`, options `collected`/`returned`, no empty option) → `collectFromState()` 567 → persisted `meta.clippingManagement` 1901 | **Dead source, live divergence (1.2).** Replace with the persisted programme's `meta.clippingManagement` via the adapter. |
| `turf.trafficIntensity` | `GAIP_STATE.traffic.intensity` 7159 — **no writer anywhere** → always `'moderate'` | `GAIP_STATE.turf.traffic` (bridged from `turf.traffic`, `plan.blade.php:52`) — **no writer anywhere** (DB: `turf.traffic` absent on all 10 sites; `turf.trafficLevel` JSON null) → always `'moderate'` | Dead on both sides; both tables are no-ops. Section 6 makes it real. |
| `turf.nProgramKgHaYr` | `.gaip-nutrition-annual-n` DOM 6874-6881 (hidden legacy input `legacy-hub-markup.blade.php:1167`, populated by `restoreFromPersisted()` 2727-2729 with the ACTIVE site's `target_n`) → `.gaip-n-program` DOM (`legacy-hub-markup:172`, `value="200"`, restored per site from `turf.nProgram` by `site-config-persistence.js:965`) → `GAIP_STATE.turf.nProgramKgHaYr` 6883-6885 → null → engine species default 920-922 | Plan input `#plan-nut-annual-n` (`plan.blade.php:895`), restored from `adjustments.target_n` 2727-2729, seeded on first visit from `turf.nProgramKgHaYr || turf.annualN` (`plan-ui.js:644`, never `turf.nProgram`) | **Live-verified (probe `scratchpad/probe-export-n-source.js`):** single-site export reads the Plan's `target_n` (Federal Golf 120 vs `turf.nProgram` 150; Burns 120/150; Test1 120/250; Test5 250/250). Multi-site Combined export: `restoreFromPersisted()` returns at 2641-2644 once `this.program` is set, so every later site reads the FIRST site's value (REVIEW-GH349-onward open question 12). Fallback path (no programme / stale programme / export before the 1600 ms cascade `site-config-persistence.js:1535-1539`) reads `turf.nProgram` → 200. **Replace with per-site persisted base N via the adapter.** |
| `aaRanges` | IIFE 7008-7153: `data.soil.methodology` gate 7029-7030, texture from `sample.soilTextureSnapshot` → `data.soil.soilTexture` → `GAIP_HUB_CONFIG.soilTexture` → `turf.construction` 7084-7097, `deriveCode(_species, _soilTexture)` 7112-7114, generic fallback 7124-7141 | inside `computeProgram()` 1661-1706: `deriveCode(inputs.speciesDisplay, inputs.soilTexture)`, texture from `state.inputs.soil.soilTexture` → `GAIP_HUB_CONFIG.soilTexture` (`_collectAATexture` 1473-1477 for the key; `collectFromState` 591 for the value) | Two resolvers, two texture chains, two species spellings — the GH-352/353/355/357/364/379 chain was six fixes to this one seam. E2E asserts the resolved floors equal. **Move range resolution into the adapter (one function, one texture chain).** |
| `soilTexture`, `climate.*`, `overseedConfig` | 7093-7097, 6933-6946, 6952-6994 | n/a (calendar takes `monthlyTemps` 0-11 via `extractMonthlyTemps()` 896-906; combined reindexes 2248-2253) | Climate/overseed are GP-distribution inputs, out of the requirement contract; `soilTexture` folds into the range resolver above. |

Sample-level fields the calendar branch of the Combined export also diverges on: `perSampleInputs.soilPpm.X = parseFloat(...) || 0`
(`word-export-combined.js:2134-2144`) turns a missing reading into 0 ppm (maximal deficit), while the Plan's
`extractPpm()` returns `null` and skips the lift (GH-338, `nutrition-calendar.js:620-640`, 1795-1797). Same class.

### 1.4 The persisted site config (dev DB, namespace `gaip`, 10 sites)

| site | turfType | methodology | `turf.nProgram` | `target_n` | `meta.clippingManagement` | tissue samples | species |
|---|---|---|---|---|---|---|---|
| Federal Golf | golf | slan | 150 | 120 | collected | 1 (gate applied) | Creeping Bentgrass |
| Test1 - Sports | sports | mlsn | 250 | 120 | collected | 0 | Perennial Ryegrass |
| Burns | golf | mlsn | 150 | 120 | collected | 4 (gate false on stored run) | Creeping Bentgrass |
| test4 - USA | golf | slan | 150 | 120 | collected | 0 | Creeping Bentgrass |
| Test5 - NZ | sports | ammonium_acetate | 250 | 250 | **returned** | 1 (gate applied) | Perennial Ryegrass |
| Test6 - UK | golf | mlsn | 150 | 200 | collected | 0 | Creeping Bentgrass |
| Russley | golf | ammonium_acetate | 150 | 200 | collected | 4 | Browntop Bent |
| Canberra | golf | mlsn | 150 | 200 | collected | 0 | Creeping Bentgrass |
| Westview | lawns | mlsn | 150 | 200 | collected | 0 | Buffalograss |
| New test - location | golf | slan | 150 | 120 | collected | 0 | Creeping Bentgrass |

`turf.traffic`, `turf.clippingsCollected`, `turf.clippingManagement`: absent on all 10. `adjustments.traffic_modifier`: 1 on
all 10. Two sports sites (Test1, Test5). `nProgram` ≠ `target_n` on 9 of 10 (confirms the brief; see 1.3 for what is
actually live).

### 1.5 What each page has loaded (Playwright, `scratchpad/probe-plan-engine-loaded.js`)

`/plan`: `GilbaNutritionCalendar` yes; `NutritionRequirementEngine_Pure` **undefined**; `NutritionRequirementCore`
undefined; `GilbaClassificationConstants` **undefined**; `GAIP_SiteConfig` undefined, `GAIP_SITE_CONFIG` (server-rendered)
yes; `HillLabsSampleTypes`, `AmmoniumAcetateMethodology`, `SpeciesController`, `GilbaGrowthPotentialEngine` yes.
`/reports/export`: engine yes, core undefined, `GAIP_SiteConfig` yes, `GAIP_SITE_CONFIG` undefined, constants yes.

Consequence: `nutrition-calendar.js:1752-1756` (GH-382) guards on `window.NutritionRequirementEngine_Pure` and degrades to
the flat 27 ppm SLAN P floor on the Plan page. **GH-382 is effective only in the export's calendar branch; on the live
Plan page the divergence it closed is still open.** GH-382's own live verification (the AA fixture) could not see this.

### 1.6 Arithmetic that still differs between the paths (Node, real modules — `scratchpad/mlsn-threeway.js`)

Inputs: perennial ryegrass, N 200, bulk density 1.4, depth 10, `collected`, `moderate`, no tissue.

| case | engine | core | calendar |
|---|---|---|---|
| MLSN, pH 6.8, K 30 ppm (threshold 37, target 55.5) | corr **17.85** (to target), req 129 | 17.85 / 129 | lift **4.9** (to floor 37), req 115 |
| MLSN, pH 6.8, Ca 300 (thr 331, tgt 496.5) | corr **91.7**, req 125 | same | lift **14.47**, req 48 |
| MLSN, pH 5.2, P 25 | thr **35** (ladder), corr 19.25, req 39.3 | same | floor **21**, lift 0, req 20 |
| MLSN sufficient, fine fescue, N 150, K | rem **90** (60/100) | 90 | rem **83** (0.55) |
| same, Ca / Mg / S | 30 / 15 / 9 | same | 26 / 12 / 8 |
| SLAN, K exactly 176 (ceiling) | req 111.1 `removal-only` (`>` strict, engine 669) | same (core 461) | req **0** (`>=`, calendar 1847) |
| MLSN, K reading absent | — | nutrient omitted (`continue`, core 517-519) | req 110 removal-only, `missing_soil_data.K = true` |
| GP-weighted monthly N, 250 kg, same temps | per month within 0.2 kg of the calendar (engine rounds GP to 2 dp before weighting, 869; calendar does not, 1254) | n/a | — |

Where these are live in the dev DB: Burns 12th Fairway (sample 52, MLSN, P 18, K 195, pH 6.7): Plan P req 14 (12 + 2.1),
export ANR P req 21.5 (12 + 9.45); Burns Green 4 (P 32, K 62): K above target on both. The MLSN pH ladder does not bite on
any stored dev sample (all Burns pH 6.6-7.4, inside the 6.0-7.5 band) — latent. The generic-ratio delta bites on the Plan
page of every site where tissue does not govern (at least 7 of 10; Ca/Mg/S on all 10) once the calendar routes through the core — table in section 7.

### 1.7 Traffic — what actually exists

- Settings → Traffic & Wear (`settings.blade.php:581-733`, tab shown only for `turfType === 'sports'`, 34-36 and
  `settings-init.js:670-687`): sport, matches/week (`#stg-tw-matches`, **`placeholder="2"`, no `value`**), match
  duration, age group, squad size, training type, sessions/week (placeholder 3), session duration, training area %,
  rest days, moisture, root depth, 4 weeks of hours, Clegg readings.
- Save handler `settings-init.js:1655-1696`: builds `state` with `getNum()` → **`null` for an empty field** (so the
  placeholder 2 is NOT a value) and writes **only** `localStorage['gilba_traffic_state_<siteId>']` (1685). Nothing reaches
  `PUT /sites/{id}/config/gaip`. Readers of that key: `plan-ui.js:441` (Recovery section, display only) and
  `site-config-persistence.js:984` (Clegg mean into the legacy DOM). The wear engine never sees it: `hub-orchestrator.js
  buildWearRecoveryInputs()` 3120-3133 reads `_hubState.inputs.schedule` or the legacy DOM (`wear-recovery-integration.js:
  368-383`, `.gaip-matches-week` — `legacy-hub-markup.blade.php:938` **`value="2"`**, the real default-2 trap).
- Old rule (`nutrition-summary-integration.js:855-858`): `matchesPerWeek > 3 → extreme`, `> 1 → high`, else `moderate`;
  no `low`; reads `state.traffic` which never existed at the top level of the store facade — never executed.
- A second, richer in-code ladder exists in the legacy traffic engine, `hub-tissue-v3.js:3857-3910`
  (`gaip_traffic_engine`): raw load `o = matches + 0.5 × sessions`, effective `d = o / max(0.2, FI)` (FI = firmness
  index), levels `d ≥ 30 catastrophic / ≥ 20 extreme / ≥ 15 very_high / ≥ 10 high / ≥ 6 moderate / < 6 low`. Its output
  `computed.traffic.trafficLevel` is a result slot; nothing feeds it into nutrition.
- The engine's `{0.8, 1.0, 1.2, 1.5}` and the calendar's `{0.85, 1.0, 1.15, 1.3}` have both always resolved to 1.0
  (1.3, 1.4). PLAN-GH383 §1.6's history correction stands.

### 1.8 Persistence mechanics that the traffic stage (and any new config key) must respect

- `SiteController::updateConfig()` (`app/app/Http/Controllers/SiteController.php:318-372`) **replaces the whole `gaip`
  config column** with the request body (only `nutritionProgram`/`nutritionCalendarProgram`/`nutritionProgramCoords` are
  protected by `resolveGaipConfigWrite()`).
- Settings' turf save (`settings-init.js:764-781`) clones `D.gaipConfig`, merges `turf`, deletes the three programme keys,
  PUTs — unknown top-level keys survive if the clone is fresh.
- Hub pages (`/reports/export`, `/hub`, scenarios, forensic) run `site-config-persistence.js`: `snapshotConfig()` 448-500
  rebuilds `turf`/`location` from the DOM and carries forward **only** `nutritionProgram`, `nutritionCalendarProgram`,
  `appliedMonthlyN`, `maxNPerMonth`, `nzDistributor`, `nutritionProgramCoords` (651-657) and `multiSiteTurf`
  (`saveCurrentSiteConfig()` 1154-1156); `pushConfigsToServer()` 258-300 then PUTs `_configs[siteId]` wholesale. **A new
  top-level key (e.g. `traffic`) that is not added to that carry-forward list is wiped from the DB by the next site switch
  on any hub page.** `mergeConfig()` 1729-1755 is safe (deep-merges into `existing`).
- The Plan page has no `GAIP_SiteConfig`; `persistSiteConfigPatch()` (`nutrition-calendar.js:2573-2589`) merges the patch
  into `window.GAIP_SITE_CONFIG` and PUTs it whole — unknown keys survive.

---

## 2. Target architecture

### 2.1 Re-examining the previous recommendation

The earlier recommendation ("converge on the pure core's shape; move the calendar's DOM/global lookups into a
caller-side adapter") is right about the core and incomplete about the adapter. Three reasons to change it:

1. **A per-caller adapter reproduces the input-divergence class.** GH-379 (methodology case), the clipping gap (1.2) and
   the N-source gap (1.3) were all "both callers read the same concept from different places". Two adapters written by two
   people at two times will do it again. The adapter has to be ONE module, `assets/nutrition-program-inputs.js`, with ONE
   function per programme-level field, called by the Plan page, the single export, the Combined export's ANR pass and the
   Combined export's per-sample calendar branch.
2. **The core's shape needs corrections before anything routes through it** (section 3.2): clipping vocabulary and default
   polarity; traffic removed from the per-nutrient path (user decision: traffic scales the annual N upstream); missing-soil
   semantics; and the open MLSN questions (section 9) implemented in one place.
3. **The calendar is not just a caller of the core** — `computeProgram()` also resolves ranges (AA/SLAN/MLSN) with window
   reads, so "move lookups to the caller" would leave range resolution duplicated between `computeProgram()` and
   `_buildEngineInputs()`'s IIFE. Range resolution belongs in the adapter (`resolveSufficiencyRanges()`), not in either
   engine.

Alternatives considered and rejected:
- *Make `computeProgram()` the single engine and have the export call it.* It is not pure (1.1), mixes monthly distribution
  with per-nutrient requirement, rounds to whole kg twice, and the export needs per-sample results inside a multi-site loop
  with a facility-level monthly N — it would re-create the DOM coupling D31 complains about.
- *Make `NutritionRequirementEngine_Pure` the single engine and have the calendar call `compute()`.* Its `compute()` bundles
  the facility GP distribution (1-12, C3/C4 blend, no N cap) the Plan does not want; the core already IS its per-nutrient
  half extracted (GH-376 proved equality on every fixture except clipping/traffic).

### 2.2 Layers after the cutover

```
 Settings / samples / site config / Plan form
            │
            ▼
 nutrition-program-inputs.js  (NEW, shared, the ONLY module allowed to read site config / DOM for these fields)
   resolveSiteProgramInputs({ siteId, siteConfig, planForm? , sampleOverride? })
       → { annualNBase, trafficIntensity, trafficModifier, annualN, clippingManagement, turfType,
           speciesKey, speciesDisplay, methodology, soilTexture, CEC, pH, sources:{field: 'where'} }
   resolveSufficiencyRanges({ methodology, speciesDisplay, speciesKey, soilTexture, CEC, pH })
       → { P:{min,max,source}, K:…, Ca:…, Mg:…, S:… }         (AA certificate/generic, SLAN incl. pH ladder, MLSN)
   deriveTrafficIntensity(schedule, turfType)                  (section 6; returns moderate/1.0 until wired)
   resolveAnnualN({ base, trafficModifier })                   → Math.round(base × modifier)   (calendar 1538 semantics)
            │
            ▼
 nutrition-requirement-core.js  (pure; per-nutrient removal + correction + ceiling/floor; NO traffic; clipping by string)
            │                          │
            ▼                          ▼
 nutrition-calendar.js             nutrition-requirement-engine.js  (facade: annual-N resolution for legacy callers,
 computeProgram(): STEP 2-5         core per sample, facility GP distribution unchanged; public compute() kept for the
 delegate to the core; keeps        old hub and word-export; per-nutrient internals deleted and re-exported from the core)
 GP distribution, N cap, output
 shape, meta/persistence
```

What "shared input contract" means concretely:

- **Source of truth per field** (user decisions applied):
  - `annualNBase` — the Plan page's value: live `#plan-nut-annual-n` while on `/plan`; elsewhere the persisted
    `nutritionCalendarProgram.meta.annualNBase` (new, pre-traffic; fallback for programmes generated before this change:
    `adjustments.target_n / adjustments.traffic_modifier`). Only when a site has no programme at all: `turf.nProgram`
    (Settings → Turf) → species default — with `sources.annualN` stamped (`plan` | `plan-persisted` | `settings-turf` |
    `species-default`) and the export printing a one-line note for the last two (product decision D-4b, section 9).
  - `clippingManagement` — `'collected' | 'returned'`: live Plan select on `/plan`; persisted `meta.clippingManagement`
    elsewhere; default `'collected'` (the Plan select's first option; the calendar's own `|| collected` at 1600).
  - `trafficIntensity` / `trafficModifier` — `deriveTrafficIntensity(config.traffic.schedule, turfType)`; modifier from
    the calendar's table only when `turfType === 'sports'`, else 1.0 (user decision).
  - `turfType` — `siteConfig.turf.turfType` (`GAIP_SITE_CONFIG` on Plan, `GAIP_SiteConfig.getConfig(siteId)` on hub
    pages — both verified present, 1.5), with the b35fix367 per-sample `turfProfile.turfType` override accepted as an
    argument.
  - `speciesKey`/`speciesDisplay`, `methodology` (folded once through `NutritionCalendar.normalizeMethodology`'s rule),
    `soilTexture`, `CEC`, `pH` — resolved once, by the adapter, from the sample + site config, replacing the two chains in
    1.3.
- **Sample-level fields** (`soilPpm`, `tissuePercent`, `bulkDensity`, `soilDepth`) keep coming from the callers' sample
  pipelines (`syncSoilFromDOM`/`collectFromState` on Plan, `collectData()` in the export) but pass through ONE validator
  in the adapter (`validateSampleInputs`) that enforces the Plan's null-not-zero rule and numeric types — this is what
  retires the `|| 0` at `word-export-combined.js:2134-2144`.
- **Enforcement:**
  1. The core's `compute()` fails loud on a missing required field (`annualN`, `species`, `methodology`, `soilValues`,
     `ranges`) and warns once per unknown key (catches a stale caller still passing `clippingsCollected`/`trafficIntensity`).
     No `||` defaults inside the core for any programme-level field.
  2. A source-text guard test (`tests/gh38x-input-contract-guard.test.js`) reads `assets/word-export.js`,
     `assets/word-export-combined.js` and `assets/nutrition-calendar.js` and asserts the retired reads are gone:
     `GAIP_STATE.turf.clippingsCollected`, `_state.traffic`, `_stTraffic`, `.gaip-nutrition-annual-n` and `.gaip-n-program`
     (in the export files), `state.turf?.traffic`, `CONFIG.trafficModifiers`, `CONFIG.clippingManagement`,
     `CONFIG.nutrientRatiosToN`, the `|| 0` soilPpm block. Cheap, and it fails the moment someone re-adds a side channel.
  3. Provenance is data: the calendar persists `meta.inputSources`, the export carries `engineInputs.sources`, and the E2E
     compares the two resolved input objects with `toEqual` field by field (section 10), so a fourth instance of this bug
     class fails a named row, not a numeric tolerance three tables later.

### 2.3 What the engine file becomes

`nutrition-requirement-engine.js` keeps its public API object (old hub, 12 test files, both export files) but:
- `compute()` resolves `annualN` exactly as today for callers that do not go through the adapter (explicit
  `turf.nProgramKgHaYr` → species table N → `mixedCool.N`, 919-922) and passes it to the core; callers that DO go through
  the adapter pass the adapter's `annualN` (already traffic-adjusted).
- `clippingManagement` string only. The legacy boolean `turf.clippingsCollected` is **ignored** (warn once), not aliased:
  its only live writers are dead sources (1.3), `false` has always meant "no information" in every caller, and mapping it
  to `returned` (the stopped work's alias) would silently halve K removal in the old hub's Nutrition Summary panel and in
  every existing test that passes `clippingsCollected: false`. Ignoring it is the behaviour-preserving choice for every
  existing caller (their factor is 1.0 today and stays 1.0).
- `_calculateNutrientRequirement`, `_getRemovalRate`, `_resolveTissueGate`, `_getSlanTargetP`, `REMOVAL_RATES`,
  `MLSN_THRESHOLDS`, `_normalizeSpecies`, `_normaliseMethodology` become re-exports of the core's; the MLSN-only
  `CLIPPING_COLLECTION_FACTOR`/`TRAFFIC_MODIFIERS` and the three methodology branches are deleted from this file.
  Direct callers without `annualN` (`tests/gh368…:31-37`, `gh369:143`, `gh376-three-way` Fixture B/C) rely on the
  table-N fallback at 260 — keep that fallback inside the facade's re-export wrapper, not in the core.
- The facility GP distribution (799-903, 967-1020) is untouched by the cutover (section 4).

---

## 3. What changes inside the core before routing (stage 0)

The core is unused by the app, so these are safe to land first and revert independently.

1. **Clipping** (`nutrition-requirement-core.js:304-313, 383, 560`): input becomes `clippingManagement: 'collected'|'returned'`;
   unknown/absent → `'collected'` (was `!!clippingsCollected` → absent = `returned`, the inverted default named in the
   brief). Factors unchanged (calendar's, user decision). Return `clippingFactor` and `removalBase` per nutrient
   (diagnostics the E2E can assert; the stopped work's test file already expects them).
2. **Traffic** removed from the per-nutrient path (`TRAFFIC_MODIFIERS`, `trafficIntensity`, `trafficModifierOverride`,
   lines 320-322, 384-386, 561-562): the core receives an `annualN` that the adapter has already scaled. Applying it per
   nutrient as well would double-count (PLAN-GH383 §1.2). The two candidate tables move to the adapter (the calendar's is
   the one applied; the engine's stays as a documented rejected candidate or is dropped — no consumer).
3. **Missing soil datum**: return `{ removal, correctionRequired: 0, annualRequirement: removal, intent:
   'removal-only-no-soil-data', missingSoilData: true }` instead of omitting the nutrient, so the Plan's GH-338 behaviour
   (Required = removal-only, "No soil data" badge) is reproducible and the export can keep omitting the row if it wants
   (today it does — `annualP ?? null` at `word-export.js:9828`). Product choice D-9 in section 9 if the export should
   change.
4. **Ranges in, not resolved inside**: `compute()` takes `ranges` for all three methodologies (the adapter resolves them,
   section 2.2). The core keeps MLSN/SLAN status and intent labelling per methodology but stops carrying its own
   `SLAN_RANGES_FALLBACK` / constants read. This is the change that removes the `window.GilbaClassificationConstants`
   read (431-433) and makes the core fully pure.
5. **MLSN below-threshold lift target and MLSN P pH ladder** — implement the user's answers to D-6/D-7 here and nowhere
   else. Until answered, the core keeps the engine's behaviour (lift to 1.5 × threshold; pH ladder), which keeps the export
   numerically unchanged; the Plan-side change lands with stage 2.
6. **Ceiling comparison**: one operator for all methodologies (D-8; recommend `>=`, the Plan's and the AA branch's).
7. **Rounding**: the core keeps 0.1 kg/ha canonical values; it additionally exposes `removalRaw`/`correctionRaw` so the
   calendar can decide its own display rounding (section 7.3).

---

## 4. The GP-weighted monthly distribution — out of the cutover, and why

Both copies are real duplicates of the "GP-weighted with 0.10 threshold and equal-split fallback" formula
(`nutrition-calendar.js:1319-1365` vs `nutrition-requirement-engine.js:881-903`), but they are not interchangeable:

| aspect | calendar (Plan, Monthly Schedule) | engine (export "Monthly N Distribution" table) |
|---|---|---|
| month index | 0-11 (re-indexed once in `extractMonthlyTemps()` 896-906; the seam GH-363 fixed) | 1-12 |
| GP per month | raw `GilbaGrowthPotentialEngine.compute(t, {species: c3/c4})` 1239 | `species:'blend', c3Fraction` per month 868, **rounded to 2 dp** 869 |
| distribution modes | `gp_weighted`, `even`, `front_loaded` (hardcoded months 8-10 boost = southern spring, 1337) | GP-weighted only |
| N cap | `applyNCap(maxNPerMonth)` 1375-1431 with overflow redistribution | none |
| overseed | one whole-year `isC4` boolean | per-month C3 fraction from summer-intent profiles 803-845 |
| per-month rounding | 0.1 at output 1879 | 0.1 per month 897 |

Measured on one temperature series (1.6): the two monthly N series differ by ≤ 0.2 kg/month from the GP rounding alone;
they differ by the whole cap whenever `maxNPerMonth` binds; they differ structurally on `even`/`front_loaded` and on
overseeded sites. The Word export prints BOTH series in one document (engine table via `_buildMonthlyNDistribution`,
`word-export.js:11881-11900` / `word-export-combined.js:4180-4210`; calendar series via the per-sample programme →
recommender → Monthly Schedule). That is a real "two engines in one product" symptom, but a different one from D31's
requirement figures, and closing it needs three decisions the cutover does not: should the export's table honour the
Plan's cap and mode (product), should the Plan get per-month C3/C4 blending (agronomic), and which convention wins for
`front_loaded` in the northern hemisphere. **Recommendation: separate stage (stage 4 in section 8), after the cutover,
with its own E2E rows (Plan monthly N vs the export's Monthly N Distribution, Plan monthly N vs the Monthly Schedule).**

What the cutover DOES unify on this axis: the annual N both distributions start from (`resolveAnnualN`, 2.2), so the
Plan's N card, the ANR "N kg/ha" column (`facility.totalN`, `word-export-combined.js:3804`) and the Monthly Schedule's N
total agree by construction, including under traffic.

---

## 5. Disposition of the stopped work (GH-383 / GH-384)

Source: `PLAN-GH383-clipping-traffic-FINAL.md`, `gh383-stopped-work.patch`, `gh383-stopped-work-test.js.bak`.

| item | where | decision |
|---|---|---|
| Caller reads `meta.clippingManagement` of the active site instead of `GAIP_STATE.turf.clippingsCollected` (patch, `word-export.js` 7155-7180 hunk; FINAL 3.1(f)) | **fold into stage 1** — but as a call into the shared adapter, not an inline block in `word-export.js`; per `r.siteId` in the Combined loop, not "active site" |
| String vocabulary `clippingManagement: 'collected'|'returned'` (FINAL 3.1(a)) | **fold** (core + adapter + calendar already speak it) |
| Boolean alias `clippingsCollected` true→collected / false→returned (FINAL 3.1(a), [OVERRULED] note) | **discard** — see 2.3; the boolean is ignored |
| `CLIPPING_FACTORS`, `resolveClippingManagement()`, `getClippingFactor()` ported into the engine; MLSN branch edits; `removalBase/clippingFactor` added to six engine return objects (patch hunks 276-330, 458-800) | **discard** — the engine's per-nutrient code is deleted, not extended; the core already carries the table and will return the two diagnostics |
| Engine-side traffic on `compute()`'s annualN with `facility.baseAnnualN/trafficModifier` (FINAL 3.2(a),(b)) | **discard as written; superseded** by the adapter's `resolveAnnualN` — the engine facade receives an already-scaled N; the facility object still exposes `annualN`, `baseAnnualN`, `trafficModifier` (additive, E2E reads them) |
| `word-export-combined.js` `perSampleInputs.traffic = _siteCfg.turf.traffic` (FINAL 3.2(c) reviewer addition) | **discard** — `turf.traffic` is not the source; the adapter derives from the persisted schedule (section 6) |
| Calendar persists the base N (`meta.annualNOverride`) and restores from it, not from the traffic-adjusted `target_n` (FINAL 3.2(e)) | **fold into stage 1** (additive, no change at modifier 1.0; needed by the N-source contract and by traffic). Name it `meta.annualNBase`; the name is not load-bearing, but use one name everywhere |
| Comment corrections: `nutrition-calendar.js:133-136, 146-150` ("not currently applied" is false), engine docblock 396/402/405/409 and 928-931, core docblock items 3-4, `gh376-three-way` header rows 4-5 (FINAL 3.1(g), 3.2(f)) | **fold** into whichever stage touches the file; the calendar's two false comments go with stage 1 (the file is edited there for base-N persistence) |
| Core's inverted clipping default (`nutrition-requirement-core.js:308-313`; FINAL 1.8, 6.3) | **stage 0** (section 3.1) — it is inside the core, must land before any routing, is not a separate ticket |
| `gh383-stopped-work-test.js.bak` (6 cases, 306 lines) | **reuse in stage 1** as `tests/gh383-clipping-uniform-all-methodologies.test.js`: cases 1-4 and 6 stand as written against `Engine.compute()` output; case 5's boolean-alias assertions (lines 247-255) are replaced by "boolean ignored → collected"; the `Engine._getClippingFactor`/`Engine.CLIPPING_FACTORS` references (229, 235, 282-303) point at the core's exports; `removalBase`/`clippingFactor` expectations (263-277) stay because the core returns them |
| E2E extension rows (FINAL 4.4: clipping string on three surfaces, traffic modifier, base N) | **fold into stage 1** (clipping, base N) and stage 3 (traffic), extended per section 10 |
| Two-ticket split, red-check order (FINAL 4.5) | superseded by the stage plan; the red-check discipline is kept per stage |

Nothing in the stopped work needs to land "before" the unification as its own ticket; the one prerequisite (the core's
default polarity) is stage 0 of this plan.

---

## 6. Traffic — persistence, derivation, application (stage 3)

User decision (coordinator, 2026-09-09): wire both missing links, old-hub rule as the starting point, thresholds and
default state to be put to the user. Fixed decisions honoured: calendar's table `{low 0.85, moderate 1.0, high 1.15,
extreme 1.3}`, sports only (`turf.turfType === 'sports'`; `surfaceType` is a different field), applied to the annual N
upstream of P/K/Ca/Mg/S.

### 6.1 Persistence — one record, read by Plan, export and a second device

- Store the saved schedule in the site's `gaip` config as `config.traffic = { schedule: {…the 19 fields the form
  already collects, `null` for empty…}, savedAt }`, written by the Traffic & Wear save handler
  (`settings-init.js:1657-1696`) through the same `PUT /sites/{id}/config/gaip` the turf form uses (764-781: clone
  `D.gaipConfig`, delete the three programme keys, PUT). Keep the `localStorage` write for one release so `plan-ui.js:441`
  keeps working, then point `plan-ui.js` and `site-config-persistence.js:984` at `config.traffic.schedule` and delete the key.
- **Must-do in the same commit:** add `traffic` to `site-config-persistence.js`'s carry-forward lists (`snapshotConfig()`
  651-657 and the restore-side list at 397) — otherwise the first site switch on `/reports/export` PUTs a snapshot without
  it and the schedule is gone (1.8). `site-config-persistence.js` is loaded by the new hub's reports pages, so this is an
  in-scope edit of a shared file, not an old-hub change; say so in the GH comment.
- Why `config.traffic` and not `config.turf.*`: `turf` is rebuilt from the legacy DOM by `snapshotConfig()` on hub pages
  (448-480), so any new `turf` field without a DOM twin is dropped there; the old `turf.trafficLevel`/`trafficEnabled`/
  `eventsPerWeek` fields (477-479) are legacy selectors in no markup and should not be resurrected.
- Second-device proof: a fresh browser context (no `localStorage`) must see the schedule on Settings and the derived level
  on Plan and in the export (section 10.4).

### 6.2 Derivation — in the shared adapter, once

`deriveTrafficIntensity(schedule, turfType) → { level, modifier, source, load }` in `nutrition-program-inputs.js`:
- `turfType !== 'sports'` → `{ level: 'moderate', modifier: 1.0, source: 'not-sports' }` regardless of the schedule.
- No persisted schedule, or a schedule whose match AND session counts are both `null` → `{ 'moderate', 1.0,
  'no-schedule' }`. **Never read form placeholders, never read the legacy DOM `.gaip-matches-week` (value 2).** This is
  the answer to "every sports site becomes `high` with nothing entered": under this rule nothing entered = neutral.
- Otherwise `level = rule(schedule)` per D-10 below; `modifier = TRAFFIC_MODIFIERS[level]` (calendar's table).
- Both surfaces call it through `resolveSiteProgramInputs()`; the calendar's `inputs.traffic` and the engine facade's
  facility `trafficIntensity` are the adapter's output, never a separate read. Persist `meta.trafficIntensity`,
  `meta.trafficSource` and `adjustments.traffic_modifier` (exists) on the programme so the export can print provenance.

### 6.3 Thresholds — three candidates, decision D-10 (do not implement until answered)

All three below use only numbers that exist in the code today; none is invented here. `m` = matches/week, `s` =
sessions/week as saved (null = not entered).

| rule | definition | 2 matches + 3 sessions | 1 match + 2 sessions | 4 matches + 4 sessions | 0 + 0 saved | provenance / problem |
|---|---|---|---|---|---|---|
| **A** — old hub rule verbatim | `m > 3 → extreme`, `m > 1 → high`, else `moderate`; no `low` | high (+15 %) | moderate | extreme (+30 %) | moderate | `nutrition-summary-integration.js:855-858`; ignores training; a club playing two matches a week gets +15 % N — is that intended? |
| **B** — old rule's boundaries on the legacy traffic engine's raw load | `o = m + 0.5·s`; `o > 3 → extreme`, `o > 1 → high`, `o > 0 → moderate`, `o == 0 → low` | o 3.5 → extreme | o 2 → high | o 6 → extreme | low (−15 %) | load definition from `hub-tissue-v3.js:3862`, boundaries from A; produces `low`; but A's boundaries were written for matches only, so B is stricter than A at every schedule |
| **C** — legacy traffic engine's own ladder at firmness 1.0 | `o = m + 0.5·s`; `o ≥ 20 extreme`, `≥ 15 → extreme` (very_high folded), `≥ 10 high`, `≥ 6 moderate`, `< 6 low` | o 3.5 → low | low | low | low | `hub-tissue-v3.js:3866-3910`; calibrated for effective events including the softness multiplier (`1/FI`, up to 5×), so at FI = 1 almost every real schedule reads `low` (−15 %) — unsuitable without the firmness term, and the firmness term would make an annual N target depend on this week's soil moisture |

Analyst's recommendation to put to the user: **A's boundaries on matches with the no-schedule rule from 6.2, plus an
explicit "low" only for a saved schedule of 0 matches and 0 sessions** (a field the user has told us is unused) — i.e. the
only rule with provenance in the nutrition context, made safe by never deriving from placeholders. State plainly that
the +15 % at 2 matches/week is the old rule's own number and that the user may prefer to shift the boundaries (e.g.
`m ≥ 3 → high`, `m ≥ 5 → extreme`); any shifted boundary is a new number and needs their say-so.

### 6.4 Application and where numbers move

`annualN = Math.round(annualNBase × modifier)` in the adapter (calendar 1538 semantics; 287.5 → 288). The core and both
distributions receive `annualN`. The Plan input keeps showing `annualNBase`; `adjustments.target_n` stays the adjusted
value (existing consumers), `meta.annualNBase` is the raw one (restore reads it — fixes the latent compounding at
2727-2729 the stopped work found). Golf/lawns sites: modifier 1.0 always. Dev sites affected once a schedule is saved:
Test1 - Sports (MLSN, base 120 → 138 at `high`), Test5 - NZ (AA, 250 → 288 at `high`, 325 at `extreme`); every other site
unchanged. P/K/Ca/Mg/S removal scale with N by construction.

---

## 7. Every place the cutover changes a number

### 7.1 By user decision (expected, must be listed in the changelog)

| change | surfaces | sites/methodologies affected | expected shift |
|---|---|---|---|
| Clipping applied uniformly (all methodologies) from the persisted programme's mode | export ANR, K Reconciliation, engine `removal` | only sites at `returned`: Test5 - NZ today (AA, sports) | Test5: K removal 109.4 → 54.7; K req 136.1 → 81.4; P removal 33.9 → 13.6 (P req stays 0, above ceiling); Ca/Mg/S removal ×0.5 (all above ceiling → req 0). Gate rows in 1.2 go green |
| Annual N per site from the Plan's persisted base | Combined multi-site export: ANR "N kg/ha", Monthly N Distribution, Monthly Schedule of every non-active site | any Combined export spanning sites with different N | e.g. Burns samples in a Test5-active export: 250 → 120 |
| Traffic (after stage 3, once a schedule is saved) | Plan N card, ANR N, all removals | sports sites only (Test1, Test5) | × modifier per 6.4 |

### 7.2 Needing a decision before the Plan-side cutover (section 9)

| change | surfaces | affected | expected shift (dev DB, from the persisted programmes) |
|---|---|---|---|
| D-5 generic ratio: species table vs flat | Plan page K/Ca/Mg/S removal and Required (export already uses the table) | every site where tissue does not govern P/K: Test1, Burns (implausible tissue → gate off), test4, Test6, Canberra, Westview, New test (7 of 10, plus Russley's Ca/Mg/S in any case — its 4 tissue samples may or may not govern P/K depending on the active one) | K removal: bentgrass sites −3 % (Test6/Canberra/Russley 110 → 107; Burns/test4/New test 66 → 64); PRG Test1 66 → 67; buffalo Westview **110 → 125** (+14 %), Ca 34 → 38, Mg 16 → 20, S 10 → 13. P unchanged everywhere (P/N = 0.10 in every table row). Ca/Mg/S move on every site (tissue never governs them) |
| D-6 MLSN lift target | whichever side changes | MLSN sites below a threshold: Burns 12th Fairway P (18 < 21) today | Plan P req 14 → 21.5 if the engine's rule wins; export 21.5 → 14 if the calendar's wins |
| D-7 MLSN P pH ladder | whichever side changes | MLSN sites with pH outside 6.0-7.5 — none stored today (Burns 6.6-7.4) | latent |
| D-8 ceiling operator | edge only | a reading exactly at a SLAN/MLSN ceiling — none stored | 0 vs removal at equality |

### 7.3 Rounding (stage 2, unavoidable, ±1 kg/ha)

The calendar rounds removal to whole kg at STEP 2 and again at STEP 3 (1590-1594, 1602-1607) and totals to whole kg
(1829-1833); the core rounds to 0.1 once. Routing the Plan through the core and displaying `Math.round()` of the
canonical values moves some integers by 1 (today's Test5 K required 82 = round(55 + 26.74); via the core round(54.7 + 26.74)
= 81). The E2E tolerance of 1 covers it; the pinned integers in `tests/gh361…`, `gh379…:141-142,160,240,244`,
`gh370-real-data…` (84/41, 57/34) and `real-data-test5-soccer` must be re-derived, not "adjusted until green" — derive each
new expectation by hand from the fixture and record the arithmetic in the test. Alternative that avoids any Plan-side
integer shift: the calendar applies `Math.round()` to `removalRaw` at the same two points it does today — allowed, but it
keeps two rounding conventions alive; recommend the canonical-0.1 route and a one-off re-derivation.

---

## 8. Staged implementation

Every stage is one commit, independently revertible (`git revert`), gated by the full Jest suite (baseline
**1722 passed / 1 skipped, 155 suites**, `npx jest` at `521473c`) and — from stage 1 — by `npm run test:e2e`.

**Numbering.** The Change log's highest landed entry is GH-382; its text reserves "GH-383/384" as in-progress numbers that
never landed. The CLAUDE.md rule (highest existing token + 1) mechanically yields GH-384. Recommendation: stage 0 + 1 land
as **GH-383** (the forward reference in GH-382's entry then points at real work — its scope is a superset of the old
GH-383), then GH-384, GH-385, GH-386 in order. Confirm with the user in one line before the first commit.

### Stage 0 — core corrections + shared adapter, nothing routed (part of GH-383 or its own commit)
- Section 3 items 1-4, 6, 7 in `nutrition-requirement-core.js`; MLSN behaviour unchanged pending D-6/D-7.
- New `assets/nutrition-program-inputs.js`: `resolveSiteProgramInputs`, `resolveSufficiencyRanges` (ported from
  `computeProgram()` 1661-1783 and `_buildEngineInputs()` 7008-7153, one texture chain: sample snapshot → site config
  → hub config → construction bucket, matching GH-364's order), `resolveAnnualN`, `deriveTrafficIntensity` (returns
  `moderate`/1.0 with `source: 'not-wired'`), `validateSampleInputs`, `getSiteConfig(siteId)` (= `GAIP_SiteConfig.getConfig`
  on hub pages, `window.GAIP_SITE_CONFIG` for the active site on Plan, else null → fail loud).
- Script tags: `nutrition-requirement-core.js` and `nutrition-program-inputs.js` on `plan.blade.php` (before
  `nutrition-calendar.js`, 1027), `reports/export.blade.php`, `scenarios`, `forensic`, `hub.blade.php` (before the
  engine, 66/223). Also `gaip-classification-constants.js` on `plan.blade.php` so the Plan's SLAN/MLSN constants are the
  SSOT, not the calendar's fallback literals (numerically identical today; verify with a test that compares them).
- Tests: rewrite `tests/gh376-nutrition-requirement-core.test.js` (clipping string, no traffic, missing-soil shape,
  ranges-in), keep `gh376-three-way` green by feeding it ranges from the adapter, add adapter unit tests (each source in
  the chain, provenance stamps, null-not-zero validator, sports-only gate).
- Effort 1-1.5 days. Risk: nil at runtime (nothing routed); the script-tag additions load two more files on five pages.

### Stage 1 (GH-383) — export path through the core; input contract live; gate green
- `nutrition-requirement-engine.js` → facade (2.3). `word-export.js` `_buildEngineInputs()`: species/N/clipping/traffic/
  ranges/texture from `resolveSiteProgramInputs({ siteId: activeSiteId or r.siteId, sampleOverride })`; delete `_stTraffic`,
  the `.gaip-nutrition-annual-n`/`.gaip-n-program` reads (6873-6886) and the aaRanges IIFE (7008-7153); keep climate,
  coordinates, overseed as they are. `word-export-combined.js`: the ANR pass uses `r.data.engineInputs` as today (now
  adapter-shaped); the per-sample calendar branch (2074-2257) builds `perSampleInputs` from the same adapter call per
  `r.siteId` instead of `_facilityCalendarInputs` + overlays (this retires the `|| 0` soilPpm block and the cross-site N
  leak); `_combinedCtx` (764-814) is unread by the engine path — delete it in the same commit, or leave with a comment; do
  not extend it.
- Calendar: persist `meta.annualNBase` and `meta.inputSources`; restore the Annual N input from `meta.annualNBase` (fallback
  `target_n / traffic_modifier`); `collectFromState()` takes `clippingManagement`, `traffic`, `turfType` from the adapter
  (behaviour identical today: select value, moderate, config). No arithmetic change on the Plan page in this stage.
- Comment corrections (section 5). Guard test (2.2 item 2) with the export files' retired reads.
- Tests: reused `gh383-clipping…` file (section 5); `gh370-real-data-belowfloor` `clippingsCollected: true` → the string;
  `gh376-three-way` Fixture E rewritten (clipping parity; traffic case becomes an adapter test); `gh299`/`gh309`/`hoxton…`
  pass unchanged (boolean ignored → factor 1.0, as today). E2E: add rows — `meta.clippingManagement` == export
  `engineInputs.clippingManagement`; `meta.annualNBase` == `engineInputs.annualNBase`; `plan.meta.inputSources` ==
  `engineInputs.sources` (`toEqual`).
- Gate: **14/14 with the fixture at `returned`** (today's DB) AND at `collected` (flip the select, Generate, re-run) — both
  must be green; do not encode either as "the" fixture state.
- Effort 2-3 days incl. two live runs. Risks: the old hub's Nutrition Summary panel now runs on the facade — verify it
  renders the same numbers on `/hub` for Test5 (MLSN factor 1.0 today = 1.0 after; AA/SLAN unchanged); `word-export-combined`'s
  Monthly Schedule for a multi-site export changes N for non-active sites (7.1) — expected, say so in the changelog.
- Revert: one commit; the facade keeps the public API, so a revert restores the old internals without touching callers.

### Stage 2 (GH-384) — Plan page through the core (needs D-5, D-6, D-7, D-8 answered)
- `computeProgram()` STEP 2-5 (1564-1850) delegate to `core.compute()` with ranges from the adapter; keep GP distribution,
  N cap, monthly build and the output shape (`annual_totals`, `annual_removal`, `annual_lift`, `annual_totals_range`,
  `annual_totals_range_source`, `missing_soil_data`, `tissue_gate_applied`, `adjustments`, `meta`, `soil`, `program`) —
  the consumers (`nutrition-nz/prebble/au/uk-*-integration.js`, `plan-ui.js`, `word-export*.js`,
  `k-reconciliation-decision.js`) read exactly these; nothing downstream changes.
- Delete `CONFIG.nutrientRatiosToN`, `CONFIG.clippingManagement`, `CONFIG.trafficModifiers`, `CONFIG.mlsnThresholds/
  slanThresholds/aaThresholds`, `calculateDeficit()`, `getThresholds()` (1268-1314) from the calendar — or leave
  `getThresholds` as a thin wrapper over the adapter if `tests/gh382…`/`gh300…` still call it (check each caller first).
- Numbers move per 7.2/7.3; the changelog lists them per site; `nutrition-calendar.js` is also loaded by `hub.blade.php`, so
  the old hub's Nutrition Program panel moves identically — acceptable under "the new hub replaces the old hub", but say it.
- Tests: `gh361`, `gh379`, `gh370-real-data…`, `real-data-test5-soccer`, `gh376-three-way` B/C/D (their "calendar flat 0.55"
  and "engine flat 18.0" premises die), `gh319`, `gh300/304/305/308` (AA ranges now from the adapter — same numbers),
  `gh338` (missing soil), `gh382` (ladder now the core's; on Plan it becomes live — add a Plan-path assertion).
- Gate: E2E on Test5 (AA) + a **second fixture, MLSN below threshold** — Burns 12th Fairway (site `019e96d8-97b7-714c-9bd6-d65b16ec7f2e`,
  sample 52, `client_uid Soil_25_zo0t`, P 18 / K 195 / pH 6.7, `mustBeBelowFloor: ['P']`; Burns' tissue samples 120/121
  carry N = P = K = 12 or 15, an implausible ratio, so the gate is off on both surfaces — the fixture JSON must still carry
  the matched zone's values for the harness's tissue rows) — and a third, **SLAN below floor** — New test - location
  (site `01a00d5b-c67a-7281-8f0f-2d8de6676a0f`, `turf.methodology slan`), sample 123 "Putter Green" (`client_uid
  Soil_1_3cbn`, P 23.81 / K 19.31 / pH 6.21, `mustBeBelowFloor: ['P', 'K']`, floors 27 / 75). Note its
  `samples.methodology_snapshot` reads `mlsn` while the site config says `slan` — the harness's methodology row will say
  which one each surface actually resolved; that is a finding to record, not to paper over. (Federal Golf Green 1, the
  obvious SLAN site, is within range on both P 32 and K 85 and proves nothing below floor.)
- Effort 3-4 days. Risk: highest of the plan — this is where the Plan page's numbers move; every product-recommendation
  consumer runs on the new totals (the E2E's product/schedule rows are the guard).
- Revert: one commit; the persisted programmes generated with it carry `meta.version` — bump `CONFIG.version` so a
  restore can tell which engine produced a cached programme (GH-377's drift check does not compare it; do not make it).

### Stage 3 (GH-385) — traffic wired (needs D-10)
- Section 6: `settings-init.js` save to config (+ localStorage mirror), `site-config-persistence.js` carry-forward,
  `plan-ui.js:441`/`site-config-persistence.js:984` readers, `deriveTrafficIntensity` real, adapter applies the modifier
  for sports only, calendar/engine facility expose `baseAnnualN`/`trafficIntensity`/`trafficModifier`.
- Tests: derivation table (every rung, both boundaries, null handling, non-sports gate, placeholder immunity);
  `resolveAnnualN` rounding (287.5 → 288); persistence round-trip (PUT payload contains `traffic`; snapshotConfig carries
  it); E2E rows in 10.4.
- Effort 2-3 days. Risk: the config carry-forward edit touches the hub-page sync path used by every site switch — test a
  cross-site Combined export after it (GH-378's scenario) to be sure nothing else is dropped.

### Stage 4 (GH-386, separate, after the cutover) — GP monthly distribution
- Section 4; own decisions, own E2E rows; not a prerequisite of anything above.
- Effort 3-5 days.

---

## 9. Decisions for the user (numbered; nothing here is decided in this plan)

Fixed already (brief): D-1 clipping model (calendar's), D-2 traffic table (calendar's), D-3 traffic sports-only,
D-4 annual N source (Plan's value); D-10's framing (wire traffic) is the coordinator's addition.

- **D-4b** Fallback N when a site has no Plan programme at all: `turf.nProgram` (Settings → Turf) → species default, with a
  printed note in the docx ("N target from Site Settings — no nutrition programme generated") — or omit the N-dependent
  sections. Recommend the fallback with the note. Related UX: `plan-ui.js:644` seeds the Plan input from
  `nProgramKgHaYr || annualN`, never `nProgram`, so Settings' field is disconnected from the Plan; recommend seeding from
  `turf.nProgram` when no programme exists so the field has one meaning.
- **D-5** Generic (non-tissue) removal ratio: species table (`REMOVAL_RATES`, cited per species; the export's behaviour for
  months; the GH-376 core's choice) vs the calendar's one flat set (Turner & Hummel 1992; the Plan's behaviour). One surface
  moves either way (7.2). Recommend the species table.
- **D-6** MLSN below-threshold lift: to `1.5 × MLSN` ("target", engine/core/old Nutrition Summary panel; `TARGET_MULTIPLIER`
  is a hub convention, not a citation) vs to the MLSN minimum itself (calendar/Plan). Numeric example in 1.6/7.2. No
  recommendation without the user — this is agronomic.
- **D-7** MLSN P threshold pH ladder (35/28/21/32/40; engine/core, "Gilba augmentation", `nutrition-requirement-engine.js:43-55`)
  on the Plan too, or drop it from the export. Recommend keeping it (same reasoning as GH-382 for SLAN), but it is an
  algorithm change on the Plan side.
- **D-8** Ceiling comparison at exact equality: `>=` (Plan, AA) or `>` (engine SLAN/MLSN). Recommend `>=` everywhere.
- **D-9** Export ANR row for a nutrient with no soil reading: keep omitting (today) or print removal-only with the Plan's "No
  soil data" wording. Recommend printing with the note (parity with the Plan).
- **D-10** Traffic rule and default state (6.3). Recommend A + no-schedule-is-neutral + explicit `low` at 0/0.
- **D-11** Numbering (section 8).

---

## 10. Test and live-verification strategy

### 10.1 Unit (Jest, offline)
- Core: input schema (fail loud), clipping string/default, no traffic, ranges-in, missing-soil shape, rounding fields.
- Adapter: every source in every chain with a fake `siteConfig`/DOM, provenance stamps, sports gate, traffic rule table,
  `resolveAnnualN` rounding, `validateSampleInputs` null-not-zero.
- Three-way parity rewritten as **two-way** (Plan path vs export path, both through the core) on the four fixtures already in
  `tests/fixtures/` (test5 above-ceiling, test5 below-floor, e2e-parity) plus the two new MLSN/SLAN fixtures — asserting
  equality of `removal`, `correctionRequired`, `annualRequirement` within the documented rounding, per nutrient.
- Guard test on source text (2.2). Red-check each stage by temporarily re-adding one retired read and one double
  application (clipping inside the facade; traffic per nutrient) — both must fail a named test.

### 10.2 Existing tests to rewrite (not "fix")
`gh376-nutrition-requirement-core` (traffic/clipping contract), `gh376-three-way` (Fixtures B/C/E premises), `gh370-real-data-
belowfloor` (string input; integers per 7.3), `gh361`, `gh379`, `real-data-test5-soccer`, `gh368`/`gh369` (direct calls without
`annualN` — keep via the facade's fallback or supply `annualN`), `gh299`/`gh309`/`hoxton-no-fabricated-gp` (boolean ignored,
numbers unchanged — assert that explicitly), `gh382` (Plan-path assertion added), `gh319`/`gh300`/`gh304`/`gh305`/`gh308`/
`gh338` (ranges via adapter, same numbers). Do not touch `tests/fixtures/*.json` `_preGh381LiveRender` history blocks.

### 10.3 E2E (`npm run test:e2e`, live stack)
- Stage 1 gate: 14/14 on Test5 at BOTH clipping values (8.1). New rows: clipping string ×3 surfaces, `annualNBase`,
  `inputSources`/`sources` `toEqual`, K/P `clippingFactor` from the engine call == Plan `adjustments.clipping_factors`.
- Stage 2 gate: same + Burns 12th Fairway (MLSN, P below threshold) + New test - location Putter Green (SLAN, P and K
  below floor), via `GILBA_E2E_FIXTURE`; the harness's "same inputs" test becomes the full resolved-input object comparison.
- Multi-site: one Combined export spanning Burns + Test5 with Test5 active; assert Burns' ANR N == Burns' `meta.annualNBase`
  (120), not 250 (open question 12 closed). The harness currently exports one sample; add a second picker tick.
- What green proves / does not: with traffic still `moderate` everywhere, stages 0-2 cannot prove traffic; do not cite the
  harness for it (PLAN-GH383 §5.3's caveat stands until stage 3).

### 10.4 Traffic (stage 3) — live, end to end
1. Settings → Traffic & Wear on Test1 - Sports: save `matches 2, sessions 3` (under rule A → `high`). Confirm via
   `docker exec gilba_mysql … JSON_EXTRACT(config,'$.traffic.schedule.matchesPerWeek')` = 2.
2. Fresh browser context (no localStorage): Settings shows the schedule; Plan → Generate: N card `round(120 × 1.15) = 138`,
   `adjustments.traffic_modifier` 1.15, `meta.trafficIntensity` 'high', `meta.annualNBase` 120; Nutrient Delivery Summary
   removal scaled by 1.15 vs the previous run.
3. Combined export of a Test1 sample: ANR "N kg/ha" 138, engine hook `facility.trafficModifier` 1.15, `engineInputs.sources.
   trafficIntensity` 'schedule'; Monthly Schedule N total 138.
4. Golf control: write the same schedule into Burns' config (PUT), Generate + export: modifier 1.0, `source: 'not-sports'`,
   N unchanged (120).
5. Placeholder immunity: clear Test1's schedule (save with empty fields → nulls), regenerate: back to 120, `source:
   'no-schedule'`.
6. Restore Test1's config afterwards; record the run in the changelog with the numbers.

### 10.5 Live checks that are NOT the harness
- After stage 1: `/hub` (old hub) Nutrition Summary panel for Test5 and Burns — same figures as before the facade (screenshot
  or console `[NutritionSummary]` line).
- After stage 0's script tags: Plan page console shows the core's load line and no `NutritionRequirementEngine_Pure`
  reference from the calendar (GH-382's call now hits the core).

---

## 11. Pitfalls — where the cutover can silently change numbers, and what must not be touched

1. **The gate fixture's clipping state is `returned` right now** (1.2). A stage that "goes green" by flipping the select has
   proven nothing; run both states.
2. **`restoreFromPersisted()` early return** (`nutrition-calendar.js:2641-2644`) — the mechanism behind the cross-site N leak.
   Do not fix it by removing the guard (it protects a freshly generated programme); fix it by not reading the hidden input
   in the export at all (stage 1).
3. **The boolean `clippingsCollected`**: three callers still pass it after stage 1 (old hub 1391, `gh299/gh309/hoxton` tests,
   `_combinedCtx`). Ignored means factor 1.0 — the same as today. Aliasing it to `returned` would change the old hub's
   numbers; do not.
4. **Traffic double application**: after stage 0 the core has no traffic; if the calendar keeps `CONFIG.trafficModifiers` at
   1536-1538 AND the adapter scales `annualN`, the Plan applies it twice. Stage 1 must replace 1536-1538 with the adapter's
   `annualN` (identical at 1.0; the double-application test in 10.1 is the guard).
5. **Rounding order** (7.3) — re-derive pinned integers by hand; never widen tolerances.
6. **`GilbaClassificationConstants` on Plan**: adding it makes the calendar's `mlsnThresholds` read the SSOT (`S: 7`, same as
   the fallback since b35fix301a) — verify numerically, do not assume.
7. **`snapshotConfig()` carry-forward** (1.8) for `traffic` — and for `meta.annualNBase`: the latter lives inside
   `nutritionCalendarProgram`, which IS carried forward, so no change needed there.
8. **GH-377 drift check** compares `meta.species`/`meta.methodology` only (`programInputsDrift` 1160-1180). Adding
   `meta.annualNBase`, `meta.inputSources`, `meta.trafficIntensity` cannot trigger a stale banner; do NOT add them to the
   comparison (a changed N or traffic is a regenerate prompt at most, not "stale").
9. **Species keys**: the adapter must resolve one key through `SpeciesController.normalize → toNutrientKey` and pass BOTH the
   key (core) and the display name (Hill Labs `deriveCode()`), as the two paths do today; `poaAnnua` and `cotula` fall to
   `mixedCool` in the core — say so in a comment, it is today's export behaviour.
10. **`GAIP_SiteConfig.getConfig()` vs `GAIP_SITE_CONFIG`**: hub pages have the former, Plan has the latter; the adapter's
    `getSiteConfig()` must fail loud when neither resolves for the requested `siteId` (never silently use the active site's
    config for another site — that is open question 12 in a new coat).
11. **Old hub files**: `nutrition-summary-integration.js`, `legacy-hub-markup.blade.php`, `hub-persistence.js`,
    `site-data-transfer.js` — read-only. The old hub keeps working through the engine facade's unchanged `compute()`.
12. **`word-export.js` size**: it is 870 KB; the `_buildEngineInputs()` edit is surgical (delete two blocks, insert one call).
    Do not reformat or move surrounding code — the diff must stay reviewable.
13. **Console noise**: `computeProgram()` logs `[GH302-DEBUG]`/`[GH308-DEBUG]` on every call (1681-1703, 1851). Not this
    plan's concern, but the E2E's fail-loud regex (`tests/e2e:645`) must not start matching a new adapter log line — prefix
    adapter logs `[NutritionInputs]`.
14. **`docs/instructions.md` and `REVIEW-GH349-onward.md`** carry unrelated uncommitted edits — do not stage them with any
    GH-383+ commit.

---

## 12. Corrections to the brief and to earlier documents (report items)

- Brief: "currently reports 14/14" — **12/14 at `521473c`** with the DB as it stands (1.2).
- Brief / PLAN-GH383 §1.5: "the export reads [annual N] from a hidden legacy DOM input fed by Settings → Turf" — the hidden
  input is fed by `restoreFromPersisted()` with the Plan's `target_n` for the active site; Settings → Turf's `nProgram` is
  only the fallback (1.3). PLAN-GH383 §1.5's "never populated on this page" and `word-export-combined.js:2011-2018`'s
  comment ("always empty") are both wrong; REVIEW open question 12 had it right.
- PLAN-GH383 §1.4: "All 10 have `meta.clippingManagement = 'collected'`" — Test5 is `returned` today (its own §5.4 step
  changed it).
- GH-382 changelog: "neither engine applies a pH adjustment to [the AA/MLSN branches]" — the engine and the core apply the
  MLSN P ladder (`getMLSNThreshold`, engine 57-64, core 166-173); only the calendar lacks it. And GH-382's SLAN fix is inert
  on the live Plan page (1.5).
- GH-376 three-way table row "Ceiling/floor dispatch, AA/SLAN/MLSN three-tier logic … ALL THREE AGREE": false for MLSN
  below threshold (lift target) and at exact ceilings (1.6). The three-way suite has no MLSN below-threshold fixture.
- Brief: "traffic changes are latent and cannot be proven by any live check" — revoked by the coordinator; section 6/10.4.
- Coordinator: "the 'matches per week' field defaults to 2" — on the new Settings form it is a placeholder (`getNum` → null
  when empty, 1.7); the real `value="2"` default is the legacy DOM input `.gaip-matches-week`, which the derivation must
  never read.
- PLAN-GH383 §1.3's statement that the E2E row "annual N: Plan target vs export engine facility N" is green "by fixture
  coincidence" is only half right: it is green on any single-site export whose programme restored, because the input IS
  the Plan's value; the coincidence matters only on the fallback path.

Scratch artefacts (not part of the repo): `scratchpad/e2e-run1.log`, `scratchpad/probe-export-n-source.js`,
`scratchpad/probe-plan-engine-loaded.js`, `scratchpad/mlsn-threeway.js`, `scratchpad/jest-baseline.log`.

# Rig Placement Roof-State DLI Fix — Implementation Plan

**Goal:** Make the rig placement calculator use roof-attenuated ambient DLI when Marvel Stadium's roof is closed, so the strategy correctly diagnoses a full-pitch severe deficit instead of localised shade pockets.

**Architecture:** The bug is entirely PHP-side. `ajax_rig_render()` receives `ambient_dli` from JS (raw Open-Meteo, ~40 mol) and passes it to `Gssh_Rig_Placement_Calculator` unchanged. The strategy decision (`severe_deficit` vs `shade_pockets`) is based on `$deficit_ratio = $ambient_deficit / $target_dli`. With 40 mol ambient and 15 mol PRG target, deficit_ratio = 0 → `shade_pockets` → 1 rig. With roof closed (0.3 tx), attenuated ambient = 12 mol, deficit_ratio = 0.2 → still `shade_pockets`. But attenuated DLI per zone (6.3 mol for north, 12 mol others) vs target 15 mol gives deficit_ratio = (15-6.3)/15 = 0.58 → `moderate_deficit`, or using the composite shaded DLI it could reach `severe_deficit`.

The right fix: multiply `hub_ambient_dli` by `get_roof_transmission()` before passing to the calculator. Also promote `get_roof_transmission()` from private to public static on `Gssh_Shade_Engine` so `ajax_rig_render()` can call it without instantiating the engine.

**Additionally:** send `roof_state` from the rig AJAX POST in `stadium-tab-ui.js` so PHP has it available — currently the rig AJAX does not forward roof state at all.

**Tech Stack:** PHP 8.1, `class-shade-engine.php`, `class-gssh-stadium-loader.php`, `assets/stadium-tab-ui.js`.

---

## Files Modified

| File | Change |
|------|--------|
| `includes/stadium/class-shade-engine.php` | Promote `get_roof_transmission()` to `public static` |
| `includes/class-gssh-stadium-loader.php` | Read `roof_state` in `ajax_rig_render()`, apply transmission to `hub_ambient_dli` |
| `assets/stadium-tab-ui.js` | Append `roof_state` to rig AJAX POST |

## Files NOT touched

`class-rig-placement-calculator.php` — the strategy logic is correct; it just needs the right `ambient_dli` input. No changes needed there.

`shade-orchestrator.js` — the attenuated DLI is already returned in the shade AJAX result. No JS changes beyond forwarding roof_state in the rig POST.

`venue-readiness-ui.js` — no change.

---

## Task 1: Promote `get_roof_transmission()` to `public static`

**Files:**
- Modify: `includes/stadium/class-shade-engine.php`

Currently `private function get_roof_transmission()`. Making it `public static` allows `ajax_rig_render()` to call `Gssh_Shade_Engine::get_roof_transmission()` without instantiating the engine. The method has no instance state — it only reads from `Gssh_Stadium_Database`, which is already static.

- [ ] **Step 1: Change visibility and add `static` keyword**

Find:
```php
private function get_roof_transmission( string $venue_id, string $roof_state ): float {
```

Replace with:
```php
public static function get_roof_transmission( string $venue_id, string $roof_state ): float {
```

- [ ] **Step 2: Update internal call in `analyse()` to use static syntax**

The existing call inside `analyse()` is:
```php
$roof_tx = $this->get_roof_transmission( $venue_id, $roof_state );
```

Static methods can be called via `$this->` in PHP (it works), but update to self:: for clarity and correctness:
```php
$roof_tx = self::get_roof_transmission( $venue_id, $roof_state );
```

- [ ] **Step 3: Verify no other callers use instance syntax**

```bash
grep -rn "get_roof_transmission" /path/to/plugin/
```
Expected: two hits — the method definition and the one call in `analyse()`. No other callers.

---

## Task 2: Forward `roof_state` from rig AJAX POST in `stadium-tab-ui.js`

**Files:**
- Modify: `assets/stadium-tab-ui.js`

The rig AJAX POST currently sends `venue_id`, `rig_model`, `month`, `variety`, `target_dli`, `ambient_dli`, `hub_dli`, climate data, and `venue_environment`. It does not send `roof_state`. Add it using the same `getRoofStateParam()` helper already on `GSSH_ShadeOrchestrator` — or inline the same logic since `stadium-tab-ui.js` has access to `GSSH_EUE_Bridge`.

- [ ] **Step 1: Add `getRoofStateParam` inline helper in `loadRigCalculation()`**

In `loadRigCalculation()`, immediately before the `data.append('action', ...)` line, add:

```javascript
// b35fix250: roof state for retractable-roof venues — mirrors shade-orchestrator.js
var _roofStateForRig = (function() {
    var cfg = global.GSSH_EUE_Bridge &&
              typeof global.GSSH_EUE_Bridge.getVenueEnvConfig === 'function'
              ? global.GSSH_EUE_Bridge.getVenueEnvConfig() : null;
    if (!cfg || !cfg.enclosureType) return 'open';
    if (cfg.enclosureType === 'retractable_closed') return 'closed';
    if (cfg.enclosureType === 'fixed_roof' || cfg.enclosureType === 'enclosed') return 'closed';
    return 'open';
}());
```

- [ ] **Step 2: Append `roof_state` to the FormData**

After the `data.append('month', ...)` line:

```javascript
data.append('roof_state', _roofStateForRig);
```

---

## Task 3: Apply roof transmission to `hub_ambient_dli` in `ajax_rig_render()`

**Files:**
- Modify: `includes/class-gssh-stadium-loader.php`

`ajax_rig_render()` passes `hub_ambient_dli` directly to `calculate_rig_requirements()`. Apply the roof transmission multiplier between reading the POST value and passing it to the calculator.

- [ ] **Step 1: Read and sanitise `roof_state`**

After the existing `$month = intval(...)` line, add:

```php
// b35fix250: roof state attenuation for retractable-roof venues.
// Mirrors ajax_shade_analysis() — same whitelist, same default.
$allowed_roof_states = [ 'open', 'closed', 'unknown' ];
$roof_state_rig = sanitize_text_field( $_POST['roof_state'] ?? 'open' );
if ( ! in_array( $roof_state_rig, $allowed_roof_states, true ) ) {
    $roof_state_rig = 'open';
}
```

- [ ] **Step 2: Apply transmission to `hub_ambient_dli` before calculator**

After `$stadium = Gssh_Stadium_Database::get_stadium( $venue_id );` and before the `try {` block, add:

```php
// b35fix250: attenuate hub_ambient_dli by roof permeability when closed.
// Without this, the rig calculator sees raw Open-Meteo DLI (~40 mol in April)
// and classifies Marvel Stadium (roof closed) as 'shade_pockets' instead of
// 'severe_deficit', producing a 1-rig localised recommendation.
$raw_hub_ambient_dli = floatval( $_POST['ambient_dli'] ?? 0 ) ?: null;
$roof_tx_rig = Gssh_Shade_Engine::get_roof_transmission( $venue_id, $roof_state_rig );
$attenuated_hub_ambient_dli = ( $raw_hub_ambient_dli !== null )
    ? round( $raw_hub_ambient_dli * $roof_tx_rig, 1 )
    : null;
```

- [ ] **Step 3: Use `$attenuated_hub_ambient_dli` in the calculator call**

Change:
```php
$result = $calculator->calculate_rig_requirements( $venue_id, array(
    'rig_type'            => $rig_model,
    'month'               => $month,
    'hub_target_dli'      => floatval( $_POST['target_dli'] ?? 0 ) ?: null,
    'hub_ambient_dli'     => floatval( $_POST['ambient_dli'] ?? 0 ) ?: null,
```

To:
```php
$result = $calculator->calculate_rig_requirements( $venue_id, array(
    'rig_type'            => $rig_model,
    'month'               => $month,
    'hub_target_dli'      => floatval( $_POST['target_dli'] ?? 0 ) ?: null,
    'hub_ambient_dli'     => $attenuated_hub_ambient_dli,
```

- [ ] **Step 4: Also update `$response['dli_context']['ambient_dli']` to use attenuated value**

Currently at line ~421:
```php
'ambient_dli' => $hub_ambient_dli ?? $result['shade_analysis']['ambient_dli'] ?? ...
```

Change the local variable reads to use the attenuated value:
```php
$hub_ambient_dli = $attenuated_hub_ambient_dli;
$hub_target_dli  = floatval( $_POST['target_dli'] ?? 0 ) ?: null;
```

These lines are already in `ajax_rig_render()` at ~415-416 — replace them. This ensures `dli_context.ambient_dli` in the response (used by the export report) also reflects the attenuated figure.

---

## Task 4: Verify math is correct for Marvel Stadium roof closed

Run mental arithmetic before deploying:

```
April Melbourne ambient DLI: ~40.1 mol (Open-Meteo)
Roof transmission:            0.3 (Marvel permeability)
Attenuated ambient DLI:       40.1 × 0.3 = 12.0 mol
PRG target DLI:               ~15 mol (species threshold)
ambient_deficit:              max(0, 15 - 12.0) = 3.0 mol
deficit_ratio:                3.0 / 15 = 0.20

Strategy: deficit_ratio 0.20 < 0.30 → 'shade_pockets'
```

Hmm — still `shade_pockets`. The per-zone DLIs show north=6.3 mol (34.6° stand obstruction × 0.3 roof) and others=12.0 mol. But the strategy uses composite `ambient_dli` not zone DLIs. With attenuated 12.0 mol ambient and 15 mol target, deficit_ratio = 0.20, still below the 0.30 threshold for `moderate_deficit`.

**This means the strategy thresholds also need reviewing for the roof-closed case.** The composite ambient_dli (12.0 mol) is not far below target, but the north zone (6.3 mol) is 58% below target — clearly `severe_deficit` for that zone.

The rig calculator already handles this partially: at line 1113-1140, even when `ambient_dli >= target_dli` is false but deficit is small, it checks `$severe_shade_points` (actual_dli < target × 0.7). With attenuated ambient of 12.0 and north zone DLI of 6.3, north is below `15 × 0.7 = 10.5` → flagged as severe shade point.

So with the attenuated ambient DLI:

- `ambient_dli = 12.0` < `target_dli = 15` → doesn't hit the "adequate ambient" early-return path  
- `ambient_deficit = 3.0`, `deficit_ratio = 0.20` → `shade_pockets` strategy  
- But `shade_pockets` filters `uncovered_points` to those with `actual_dli < target × 0.6 = 9.0`  
- North zone: 6.3 mol < 9.0 → included  
- Other zones: 12.0 mol > 9.0 → excluded  
- `max_shade_rigs = 4` (ambient < target, so not the `>= target` cap of 2)  
- Result: focuses on north end, multiple rigs there, appropriate prescription  

**This is actually correct behaviour** — with the roof closed the north stand shadow creates the primary deficit zone. The composite ambient (12.0) is close to target (15.0), so the pitch-wide deficit is `moderate` at worst; the north zone shadow is the critical issue. The prescription should be "address north end shadow" not "cover the whole pitch with maximum rigs."

The `shade_pockets` strategy with the corrected `ambient_dli = 12.0` will:

1. Correctly exclude the east/west/south/centre zones (12.0 mol, above the 9.0 threshold)  
2. Correctly focus rigs on the north end shadow zone (6.3 mol)  
3. Use `max_shade_rigs = 4` not the cap of 2 (because ambient < target)  
4. Generate a recommendation like "2-3 rigs recommended to address localised shade zones. North stand shadow creates persistent deficit pocket at 6.3 mol vs 15 mol target."

This is the right agronomic call. The original "1 rig, ambient adequate" was wrong because it used 40.1 mol ambient — making the field look fine with just localised shadows, and capping shade rigs at 2 (the `ambient >= target` cap).

No threshold changes needed. The fix is just the attenuated ambient_dli input.

---

## Confirm in production log

```
Confirm after deploy — toggle Marvel Stadium roof closed, click Calculate Rigs:
- AJAX POST contains roof_state=closed  ← new
- PHP: hub_ambient_dli attenuated: 40.1 × 0.3 = 12.0 mol (add error_log to confirm)
- Rig recommendation: 2-4 rigs focused on north end, NOT "1 rig localised shade zones, ambient adequate"
- dli_context.ambient_dli in AJAX response: 12.0 (not 40.1)

If still shows 1 rig:
- Check roof_state is reaching PHP — add error_log( 'roof_state: ' . $roof_state_rig )
- Check hub_ambient_dli is non-null in POST — if null, attenuated is also null and calculator uses seasonal fallback
- Check Gssh_Shade_Engine::get_roof_transmission() is callable as static
```

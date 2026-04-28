# Dark Reskin — Implementation Plan (b35fix247)

**Goal:** Replace all hardcoded hex colours in GAIP Hub JS template strings and CSS files with CSS variable references, enabling the v21 dark palette to render correctly across the full hub.

**Architecture:** Single source of truth in `gaip-design-system.css` token block. All JS template strings and CSS files reference tokens via `var(--gaip-*)`. One token swap = full palette change. No inline style fighting.

**Tech Stack:** Find-replace in JS/CSS. Python scripts for bulk replacements. Manual review per file for severity colours. No engine or PHP changes.

**Base build:** b35fix245 (stable). Do NOT base on b35fix246 (failed reskin attempt).

**Rule:** One file per session. Screenshot before and after each file. Do not merge partial work.

---

## Token Map — the only reference

Every hardcoded colour maps to exactly one token. Use this table for every replacement.

### Backgrounds
| Hardcoded | Token | Dark value | Role |
|-----------|-------|------------|------|
| `#ffffff`, `white` | `var(--gaip-surface)` | `#111a16` | Card surface |
| `#f9fafb`, `#f8faf9`, `#f8fafc` | `var(--gaip-surface-muted)` | `#192320` | Muted surface |
| `#f3f4f6`, `#f1f5f9`, `#f0f4f1` | `var(--gaip-surface-hover)` | `#202d28` | Hover surface |
| `#e5e7eb`, `#e2e8f0` | `var(--gaip-border)` | `#293c33` | Border |

### Severity backgrounds
| Hardcoded | Token | Dark value | Role |
|-----------|-------|------------|------|
| `#fee2e2`, `#fef2f2`, `#fde8e8` | `var(--gaip-critical-bg)` | `#150b0b` | Error bg |
| `#fef3c7`, `#fffbeb`, `#fefce8` | `var(--gaip-warning-bg)` | `#150d03` | Warning bg |
| `#d1fae5`, `#f0fdf4`, `#e8f5ee` | `var(--gaip-good-bg)` | `#0a1a0d` | Success bg |
| `#eff6ff`, `#dbeafe`, `#e0e7ff`, `#edf4fb`, `#e0f2fe`, `#f0f9ff` | `var(--gaip-info-bg)` | `#0d1e2e` | Info bg |

### Text colours
| Hardcoded | Token | Dark value | Role |
|-----------|-------|------------|------|
| `#000000`, `#000`, `black` | `var(--gaip-text)` | `#ecf2ed` | Primary text |
| `#111827`, `#1f2937`, `#374151` | `var(--gaip-text)` | `#ecf2ed` | Primary text variants |
| `#555555`, `#6b7280`, `#4b5563` | `var(--gaip-text-secondary)` | `#adc0b4` | Secondary text |
| `#9ca3af`, `#d1d5db` | `var(--gaip-text-muted)` | `#6b8878` | Muted text |

### Severity text (KEEP AS-IS — these are intentional signal colours)
| Hardcoded | Keep | Notes |
|-----------|------|-------|
| `#dc2626`, `#ef4444`, `#991b1b` | ✓ Keep | Red — critical |
| `#d97706`, `#f59e0b`, `#92400e`, `#78350f` | ✓ Keep | Amber — warning |
| `#059669`, `#065f46`, `#166534`, `#22c55e` | ✓ Keep | Green — good |
| `#1e40af`, `#2563eb`, `#3b82f6`, `#0369a1` | ✓ Keep | Blue — info |
| `#10b981`, `#7cb342` | ✓ Keep | Chart/indicator greens |
| `#7c3aed`, `#6366f1`, `#4338ca` | ✓ Keep | Purple — advisory |
| `#eab308`, `#f97316`, `#fbbf24` | ✓ Keep | Amber variants |

### Borders
| Hardcoded | Token | Dark value |
|-----------|-------|------------|
| `#e5e7eb` | `var(--gaip-border)` | `#293c33` |
| `#d1d5db`, `#e2e8f0` | `var(--gaip-border)` | `#293c33` |
| `#fecaca` | `var(--gaip-critical-border)` | `#5a1414` |
| `#fde68a`, `#fcd34d` | `var(--gaip-warning-border)` | `#5a2b04` |
| `#6ee7b7`, `#a7f3d0` | `var(--gaip-good-border)` | `#1b643a` |
| `#bae6fd`, `#93c5fd` | `var(--gaip-info-border)` | `#1a3a5c` |

---

## File Checklist — ordered by risk (lowest first)

Do NOT skip ahead. Each file is a separate session.

---

### Session 1 — CSS files (lowest risk, no engine impact)

**Files (6):**
- [ ] `assets/hub.css` — 137 references
- [ ] `assets/mlsn-progressive-disclosure.css` — 88 references
- [ ] `assets/sensor-import.css` — 78 references
- [ ] `assets/sample-manager.css` — 69 references
- [ ] `assets/water-progressive-disclosure.css` — 53 references
- [ ] `assets/priority-action-queue.css` — 48 references

**Method:** Python bulk replace using token map above.

**Test:** Screenshot each section after deploy. CSS changes are safe to batch in one session.

**Confirm:** No layout breaks. Severity colours (red/amber/green) unchanged. Text readable on dark bg.

---

### Session 2 — Small/medium UI JS files

**Files (8):**
- [ ] `assets/irrigation-scheduler-ui.js` — 67 references
- [ ] `assets/pgr-ui.js` — 60 references
- [ ] `assets/stress-trajectory-ui.js` — 52 references
- [ ] `assets/dew-prediction-ui.js` — 48 references
- [ ] `assets/pre-emergent-integration.js` — 49 references
- [ ] `assets/wear-recovery-integration.js` — 44 references
- [ ] `assets/climate-module-v2-ui.js` — 42 references
- [ ] `assets/climate-module-v2.1-ui.js` — 43 references

**Method:** Python bulk replace. Manual review of severity colours.

**Test:** Screenshot PGR card, pre-emergent card, stress card, dew card before and after.

**Confirm:** Alert tints (red/amber/green) still visible and distinct. No white panels.

---

### Session 3 — Daily dashboard + spray log

**Files (2):**
- [ ] `assets/daily-dashboard.js` — 63 references
- [ ] `assets/spray-log-ui.js` — 79 references

**Method:** Python bulk replace + manual review. These files render the most-used panels.

**Test:** Screenshot dashboard summary, spray log table, FRAC rotation warning before and after.

**Confirm:** FRAC rotation warnings (red tint) still clearly flagged. Spray log table readable.

---

### Session 4 — Site settings + venue readiness

**Files (2):**
- [ ] `assets/site-settings-panel.js` — 67 references
- [ ] `assets/venue-readiness-ui.js` — 105 references

**Method:** Python bulk replace + manual review.

**Test:** Screenshot site settings panel, venue readiness cards before and after.

---

### Session 5 — hub-tissue-v3.js (highest risk, own session)

**File (1):**
- [ ] `assets/hub-tissue-v3.js` — 237 references

**Method:**
1. Extract all unique `background:` and `color:` values from template strings
2. Map each to token using the table above — manually review every severity colour
3. Bulk replace with Python
4. Deploy to staging first if possible

**Test:** Screenshot ALL panels — soil, water, tissue, PGR, disease, irrigation, shade, wear, climate, pre-emergent — before and after. This file renders ~80% of the hub.

**Confirm:**
- Disease risk panels: red/amber/green tints correct
- PGR GDD progress bar: colours correct
- Irrigation schedule rows: dark background, readable text
- All alert banners: severity colours preserved
- No `#000000` text on dark background

---

### Session 6 — PHP inline styles + Google Fonts

**File (1):**
- [ ] `gilba-agronomic-intelligence-hub.php`

**Steps:**
- [ ] Remove the inline `<style>` block from `gaip_hub_render_shortcode()` (already done in b35fix246 attempt — port that change)
- [ ] Add Google Fonts enqueue (`Barlow`, `DM Mono`, `Fraunces`) — port from b35fix246
- [ ] Update `gaip-design-system.css` tokens to v21 dark palette — port from b35fix246

**This is the final step — only do this after all JS/CSS files are clean.**

---

### Session 7 — gaip-design-system.css token swap

**File (1):**
- [ ] `assets/gaip-design-system.css` — swap `:root` tokens to dark values

This is a single block swap. Copy from b35fix246's corrected token block.

**Test:** Full hub screenshot. Every panel should now render dark.

---

## Safety Rules

1. **Never replace severity text colours** — `#dc2626`, `#d97706`, `#22c55e`, `#3b82f6` are signal colours. Leave them.
2. **SVG `fill` and `stroke` attributes** — leave these alone. SVG chart colours are a separate problem, handled later if needed.
3. **`canvas` elements** — impossible to style via CSS. Leave chart canvas colours as-is.
4. **Inline `color:` on coloured badge backgrounds** — e.g. `color: #92400e` on `background: #fef3c7`. These are intentional pairs. Replace the background but keep the text colour.
5. **One file per session** — never mix files. If a session goes wrong, the revert is one file.
6. **Screenshot before deploy** — always have a "before" screenshot for each panel. Regressions are hard to spot without a reference.

---

## Revert Protocol

Each session produces one build number (b35fix247a, b35fix247b, etc.). If a session breaks something:
- Revert that single file from the previous build
- Re-zip with the same build number + a suffix
- Deploy the revert

b35fix245 is the confirmed stable base. It can always be restored.

---

## Self-Review

**Spec coverage:**
- Token map defined for all colour roles ✓
- All files identified and counted ✓  
- Severity colours explicitly protected ✓
- SVG/canvas explicitly excluded ✓
- Revert protocol defined ✓
- Session ordering (lowest risk first) ✓

**Gaps:**
- `nutrient-demand-engine.js` has 21 references but is a minified file — bulk replace may corrupt it. Flag for manual review in Session 2.
- `gssh-whatif-ui.js` and `gaip-whatif-ui.js` (50 each) not in the session list — add to Session 2 or 3 depending on complexity.

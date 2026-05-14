# Gilba Agronomic Intelligence Hub

A standalone web application for agronomic analytics of turf surfaces: golf courses, bowling greens, sports stadiums, lawns. It used to live as a WordPress plugin — it has now been migrated to a self-contained stack (see `migration-plan.md`). WordPress dependencies have been removed.

## Stack

- **Backend:** Laravel 13 / PHP 8.3, MySQL 8.4.
- **Frontend:** Vite + Tailwind 4 (Blade templates in `app/resources/views/`), plus the existing vanilla-JS engine layer in `assets/`, mounted through the `/legacy-assets/...` route (see `dashboard.blade.php`).
- **Local environment:** `docker-compose.yml` brings up `app` (php-fpm), `web` (nginx :8080), `mysql`.

## What it does

Collects per-site data (grass species, surface type, climate, sensors, lab samples, field observations) and produces decision-first recommendations through a set of engines:

- **Growth Potential** — thermal + moisture-driven growth potential.
- **Disease Risk** — disease pressure with trajectory.
- **Stress Index** — stress index with driver breakdown.
- **Soil Moisture / Irrigation Plan** — VWC ranges and weekly irrigation plan.
- **Wear / Recovery Windows** — wear-recovery windows (intent-gated: `eliteMatchPlay`, `socialPlay`, etc.).
- **Identity Enforcement** — TIER 0 validation of `speciesKey` / `turfIntentKey` before any engine runs.
- **AI interpretation** via the Claude API, weather via Open-Meteo, pesticide lookup via APVMA.

## Repository layout

- `app/` — the Laravel application (routes in `routes/web.php`, controllers and models under `app/app/`, migrations in `app/database/migrations/`, views in `app/resources/views/`).
- `assets/` — legacy vanilla-JS engines and CSS, reused as-is by the standalone app (identity-enforcement, wear, disease, growth, irrigation, contradiction-detector, word-export, etc.).
- `data/`, `files/`, `templates/` — reference data (stadiums and similar) and export templates.
- `docs/` — redesign plans (`superpowers/plans/`) and engine provenance audits.
- `docker/`, `docker-compose.yml` — containers for local development.
- `tests/` — behavioural / structural engine tests keyed to build numbers `b35fixNNN` (inherited from the plugin era, used as a regression reference during the migration).
- `CHANGELOG.md` — build history from the plugin era (one entry = one zip).
- `migration-plan.md` — plan and current status of the WordPress → Laravel + MySQL move.
- `security.md` — security notes.

## Current focus

1. **Migration** of runtime fixes from plugin-era drop releases into the standalone layer (`migration-plan.md` → Plugin Delta Assimilation).
2. **IA and UI redesign**: moving to a decision-first dashboard with a tiered structure (Tier 0–5), Quick Capture FAB, and a Site Switcher with multi-site overview. Details in `docs/superpowers/plans/final-ia-and-ui-redesign.md`.


## Change log

**GH-1** Add dashboard view and related assets, including new CSS styles and routing
**GH-2** Implement AnalysisCacheController and DashboardController for analysis result storage and dashboard data retrieval; update routes and enhance dashboard UI with new features and styles.
**GH-3** Enhance dashboard functionality by adding interactive side panels for vital cards; implement JavaScript logic for panel opening/closing and update CSS for improved styling and responsiveness.
**GH-4** Refactor error handling in SensorProxyController to remove status codes; update dashboard view to use route for data link; enhance VWC card with live sensor readings and improved CSS for segmented zone bar.
**GH-5** Enhance data view by adding disabled 'Add Data' buttons for non-sensor sections, updating empty state hints, and improving CSS styles for better usability and responsiveness.
**GH-6** Enhance SiteController validation by adding 'attributes_json' field; update navigation links in app layout for clarity; modify settings route to use controller method; implement rerun functionality in dashboard scripts; improve hub persistence signaling for analysis completion; refine climate metrics handling in hub tissue scripts; update documentation with new feature notes.
**GH-7** Enhance dashboard irrigation metrics by refining deficit calculations and improving water balance display logic; update irrigation schedule handling for better data accuracy.
**GH-8** Enhance settings and site configuration by adding turf profile management, location geocoding autocomplete, and improved site data handling; update SettingsController to include active GAIP configuration and modify view to display turf-related fields.
**GH-9** Enhance site configuration handling by integrating active GAIP configuration into the app layout; improve turf profile management in hub orchestrator and site config persistence, ensuring species data is accurately seeded and fallback mechanisms are in place for better data integrity.


## Backlog


- Check why irrigation 6mm in the old site is highlighted with orange and on the new one with green. Check all thresholds for all blocks on the new site to be the same as on old one. 


- Auto re-run - setup minutes or hours - how often to rerun

- Give permissions to users

- Task management

- In the old site UI I only see 2 methodology SLAN, MLSN. Why do we have 3?

- Where zones are set on the old site?

- The only exception: manually-entered samples with no client_uid (NULL) are preserved, because they're not tracked by the import system - why manually-entered samples are with no client_uid ?

- How often data should be pulled from sensors?




For information
1) aaTexture has its own UI, but it lives inside the hub analysis panel (legacy-hub-markup), not in Settings. It appears as a "Rootzone Type (for K/Mg ranges)" dropdown that's dynamically shown/hidden: it only appears when the methodology is set to ammonium_acetate. When any other methodology is selected, it's hidden.

So the answer is: yes, it is in the UI — it shows up in the hub's analysis panel automatically when you switch to the AA methodology. It's not in the Settings tab, which is by design since it's a per-analysis input rather than a site-level setting.

The Settings "Soil texture" dropdown (soil_texture_override) is a separate, always-visible site-level field for granular texture (sand, loamy sand, loam, etc.), and that one is what feeds sample snapshots and soil temperature calculations.

2) On the old website - coordinates doesnot update after import
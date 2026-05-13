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


**Change log**
GH-1: Add dashboard view and related assets, including new CSS styles and routing
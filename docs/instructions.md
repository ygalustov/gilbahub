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
**GH-10** Update settings view to clarify annual nitrogen label and add soil temperature query in instructions documentation for improved user guidance.
**GH-11** Update navigation links in dashboard, data, and settings views to point to the new analysis growth-light route; add route definition for analysis growth-light in web.php.
**GH-12** Enhance growth light analysis by adding percent C3 cover to the AnalysisController and updating the view to include turf species, methodology, and C3 cover data. Improve JavaScript insights for climate metrics and refine CSS styles for better layout and usability.
**GH-13** Refine growth light analysis insights by updating temperature-related messages for clarity on grass type impacts. Enhance CSS for improved layout and adjust growth potential descriptions for better user understanding.
**GH-14** Enhance dashboard and growth potential insights by updating the growth potential description for clarity, adjusting the display style in the dashboard view, and refining temperature-related messages in the growth light analysis for improved user understanding.
**GH-15** Enhance growth light analysis by adding overseed species handling in AnalysisController and updating views to reflect new turf management options. Improve settings initialization for overseed options and refine JavaScript insights for better user experience. 
**GH-16** Implement navigation updates and new views for Plan and Reports. Add links to the new Plan and Reports pages in the dashboard, data, settings, and analysis views. Define routes for Plan and Reports in web.php.
**GH-17** Add disease analysis view and update navigation links
- Implemented a new disease analysis view in the AnalysisController and created a corresponding Blade template.
- Updated the dashboard and growth light analysis views to include navigation links to the new disease analysis page.
- Refactored JavaScript for site switcher functionality into a shared dashboard UI script for better maintainability.
- Enhanced routing in web.php to define the new disease analysis route.
**GH-18** GH-18: Implement analysis index view and update navigation links
- Added a new index method in the AnalysisController to handle the analysis overview, including site-specific configurations and metrics.
- Updated navigation links in the dashboard, data, plan, reports, and settings views to point to the new analysis index route.
- Refactored routing in web.php to consolidate analysis routes and redirect legacy routes to the new structure.
- Enhanced the analysis view with a notification bar for stale data and improved tab badges for disease and stress metrics.
**GH-19** Enhance Data and Settings Views with Turf Management Options
Added turf species, methodology, location name, and analysis cache data to the DataController and SettingsController for improved site-specific configurations.
Updated the data and settings views to display new turf management options, enhancing user experience and data visibility.
Refactored routing in web.php to ensure proper handling of the new configurations.
Improved the shared layout for consistency across analysis-related pages.
**GH-20** Enhance Analysis and Data Views with New Soil and Water Tabs
- Updated the analysis view to include new tabs for soil nutrition and water balance, improving user navigation and data accessibility.
- Refactored routing in web.php to support the new analysis tabs and ensure proper redirection.
- Added JavaScript functionality for initializing the new analysis components and handling data loading.
- Enhanced the data view with a modal for adding data, improving user interaction and data entry experience.
**GH-21** Implement comparison functionality and modal for data analysis views
- Added JavaScript functionality to enable comparison of selected data rows, enhancing user interaction.
- Introduced a new modal design for displaying comparison results, improving data visibility and user experience.
- Updated CSS styles for the comparison modal to ensure a consistent and user-friendly interface.
- Defined comparison fields for soil, tissue, water, and organic matter, facilitating detailed analysis.
**GH-22** Implement Reports section — 4 sub-pages, UI fixes, deduplication
New pages (/reports/*):
/reports/export — Export Centre: Word, Combined multi-site, iCal, LED export cards; branding panel (org name, logo); hidden hub runner for background analysis
/reports/forensic — Forensic Decision Record: renders FORENSIC_RECORD after analysis, per-engine cards (expandable), input snapshot, PDF/copy buttons
/reports/scenarios — Scenario Comparison: mounts gaip-whatif-ui.js into new light-theme UI with how-to hint; restyled с reports-scenarios-override.css
/reports/accuracy — Forecast Accuracy: server-side confidence badges, Pending Outcomes (outcome-capture-ui.js), Accuracy History chart (benchmark-chart.js + Chart.js + date adapter)



## Backlog


vmay be we add it to KPI - same as on the soil page? 

Irrigation Water Quality: Acceptable


Посмотри, вот на старом сайте написано, где про болезни, написано, что анализ сделан дляBentgrass, для какой-то конкретной травы, которая у нас основная species идёт. И написан какой-то процент. Вот что это за процент и где нам можно это вывести тоже? 
Analysis for: Bentgrass 85%
--


Check why on the dashboard on the side panel of GP - there is ET info but on the full analisys page there is no ET data at all. Is it related to GP at all?

- Check why irrigation 6mm in the old site is highlighted with orange and on the new one with green. Check all thresholds for all blocks on the new site to be the same as on old one. 


- Auto re-run - setup minutes or hours - how often to rerun

- Give permissions to users

- Task management

- Onboarding

- In the old site UI I only see 2 methodology SLAN, MLSN. Why do we have 3?

- Where zones are set on the old site?

- The only exception: manually-entered samples with no client_uid (NULL) are preserved, because they're not tracked by the import system - why manually-entered samples are with no client_uid ?

- How often data should be pulled from sensors?

- Soil temperature take from sensor ? 

Why 85 is moderate? what all options do you have on old site?


---


Нашёл точные тексты из старого сайта. Вот сравнение:

Старый сайт (hub-tissue-v3.js):

t >= 15 && t <= 25 → "Optimal C3 growth range - cool-season grasses thriving." ✓
t > 30 → "C3 grasses are heat-stressed - C4 grasses dominating."
t < 10 → "C4 grasses are dormant - C3 dominant in mixed stands."
Heat event → "Heat event forecast (X°C peak) - C3 stress expected."
else → "Transition zone - both grass types moderately active."
У нас есть лишнее (наши дополнения):

"Warm conditions — C3 growth declining as temperatures rise." (t 25-30)
"Cool conditions — approaching optimal C3 range." (t 10-15)
"Cold — C3 growth very slow." (t 5-10)
Все C4-специфичные тексты ("Optimal C4 growth range...", "Warm conditions — C4 growth accelerating...")
Старый сайт показывал один текст для любой ситуации (не разделяя C3/C4). Хочешь оставить наши дополнения или сократить до точных текстов старого сайта?




For information
1) aaTexture has its own UI, but it lives inside the hub analysis panel (legacy-hub-markup), not in Settings. It appears as a "Rootzone Type (for K/Mg ranges)" dropdown that's dynamically shown/hidden: it only appears when the methodology is set to ammonium_acetate. When any other methodology is selected, it's hidden.

So the answer is: yes, it is in the UI — it shows up in the hub's analysis panel automatically when you switch to the AA methodology. It's not in the Settings tab, which is by design since it's a per-analysis input rather than a site-level setting.

The Settings "Soil texture" dropdown (soil_texture_override) is a separate, always-visible site-level field for granular texture (sand, loamy sand, loam, etc.), and that one is what feeds sample snapshots and soil temperature calculations.

2) On the old website - coordinates doesnot update after import
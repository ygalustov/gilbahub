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
**GH-23** Enhance PageController and Plan view with new data handling and UI updates. Added saved location data to the topbar and integrated GAIP configuration into the Plan view's JavaScript. Updated CSS for improved layout and user experience on the Plan page.
**GH-24** Implement PGR & Irrigation Analysis Tab and Inputs
Added a new tab for PGR & Irrigation analysis in the analysis view, enhancing user navigation.
Introduced PGR application inputs in the legacy hub markup, allowing users to specify product details and application dates.
Updated JavaScript to handle the new PGR analysis functionality, including data persistence and loading states.
Enhanced the analysis router to initialize the PGR & Irrigation analysis component.
**GH-25** Fix Soil & Nutrition analysis page showing empty state despite samples existing in DB.
Root cause: `hub-persistence.js` was calling `GAIP_SampleManager.restoreFromPersistence()` from localStorage 200ms after init, overwriting the correct `burns_gc` site context that `sample-persistence.js` had established via server fetch. Additionally `sample-persistence.js` was restoring `_currentSite = 'default'` instead of the PHP-injected active site UUID after server sync.
Fix: `sample-persistence.js` now switches SampleManager to `GAIP_HUB_CONFIG.activeSiteId` after loading samples from server. `hub-persistence.js` now skips its own `restoreSamples` call when `_gaipSamplePersistenceReady` is already true, avoiding the site context overwrite.
**GH-26** Remove PGR & Irrigation tab and related functionality from analysis view. Updated JavaScript to exclude PGR analysis initialization and cleaned up associated scripts. This change simplifies the analysis interface and removes unused components.
**GH-27** Fix pgr-irrigation-analysis.js render() missing event wiring.
`initPgrInputCard(container)` and `initInfoPopovers()` were never called after `container.innerHTML` assignment in `render()`, leaving the "Save & Re-run" button non-functional when PGR data was already populated. Fixed by adding both calls immediately after innerHTML.
**GH-28** Move PGR input form from Analysis tab to Plan page.
Architecture cleanup: Analysis = "What is happening now?" (diagnostics only). Plan = "What should I do?" (schedules, decisions). Added `renderPgrInputForm()`, `initPgrInputForm()`, `readSavedPgr()` and `PGR_PRODUCTS` to `plan-ui.js`. Both the empty-state and populated-state paths in `renderPGR()` now render the PGR input form inline before the results table.
**GH-29** Implement Stress Index Analysis tab (`stress-analysis.js`).
New tab on Analysis page (`#stress`) rendering: ESI verdict hero (score, level badge, peak forecast, primary stressor, growth modifier), 6 factor cards (thermal, light, moisture, traffic, nutrition, biotic) with weighted scores from `stressTrajectory.currentComponents`, compound stress effects panel (only when multiplier > 1.0), 14-day trajectory CSS grid bar chart coloured by stress level, intervention windows list, and horizontal component breakdown bars. Wired into `analysis-router.js` (TAB_IDS updated) and `analysis.blade.php`.
**GH-30** Add Soil Structure Risk block to Water Balance analysis.
New `renderSoilStructureRisk(wb)` function in `water-balance-analysis.js`. Uses existing `SAR`, `SARadj`, `RSC`, `ecw` from `computed.waterBalance`. Four risk levels (Low / Moderate / High / Severe) with effective SAR thresholds (3 / 9 / 18), gypsum dose ranges, bicarbonate aggravation note (when SARadj > SAR + 0.5), and RSC alkalinity note (when RSC > 0). Block inserted between salinity and irrigation recommendation sections.
**GH-31** Add Correction Program block to Soil & Nutrition analysis.
New `renderCorrectionProgram(sn)` function in `soil-nutrition-analysis.js`. Filters to deficient + borderline nutrients, calculates deficit in kg/ha using `depthFactor = depthCm × bulkDensity × 0.1`, maps to 10 standard fertilizer products (`CORRECTION_SOURCES`) with concentration-based product dose (kg/ha). Renders one coloured card per deficient nutrient with product name, dose, and application notes. Block inserted before the annual demand section.
**GH-32** Refactor Stress Index Analysis rendering and enhance KPI display
- Removed outdated CSS styles related to the verdict block and replaced them with a new KPI card structure for better visual representation.
- Introduced helper functions for color handling and KPI card generation, improving code readability and maintainability.
- Updated the rendering logic to include a more structured layout for stress index analysis, enhancing user experience.
**GH-33** Refactor stress analysis rendering to improve KPI display and layout. Updated color handling with a new palette and enhanced the trajectory chart's visual representation. Simplified HTML structure for better maintainability and user experience.
**GH-34** Refactor Plan view layout and UI components. Updated styles for tabs and headers, introduced a new KPI card structure, and enhanced JavaScript functions for rendering plan details. Improved user experience with a more organized layout and dynamic content loading.
**GH-35** Enhance report views with improved messaging and UI elements. Updated export view to clarify analysis requirements and changed branding toggle from a link to a button for better accessibility. Refined forensic and scenarios views with updated loading messages and styles for improved user experience.
**GH-36** Refactor UI elements across multiple views to enhance user experience. Removed outdated icons and replaced them with SVGs for better scalability and accessibility. Updated loading messages and styles in the dashboard, data, plan, and report views to improve clarity and visual consistency.
**GH-37** Refactor UI elements in outcome capture and scenario reports. Updated labels and icons for improved clarity and accessibility, replacing outdated icons with SVGs. Enhanced CSS styles for better visual consistency and user experience across various components.
**GH-38** Enhance SampleController and report export functionality. Added preservation of zone metadata alongside nutrient values in SampleController for improved API round-trip accuracy. Updated report export view to include a loading spinner and refined button behavior, ensuring the export button is only enabled after analysis completion and weather data readiness. Supplemented sample data handling in nutrient trend logic to merge samples from the 'default' site for better trend analysis. Improved sample persistence to resolve label and zone type handling for older records.
**GH-39** Enhance Plan and Settings views with new UI components and functionality. Added primary button styles and collapsible sections in the Plan view for improved user interaction. Updated Settings view to include additional fields for site elevation and irrigation system details, along with info icons for better guidance. Enhanced JavaScript functionality for traffic and wear form handling, ensuring saved values are restored correctly. Improved CSS for consistency and accessibility across components.
**GH-40** Enhance Settings view with new overseed variety and summer management intent fields. Updated JavaScript to capture new form values for overseed variety and summer intent, improving data handling for turf management. Added descriptive hints for better user guidance.
**GH-41** Refactor Sensors integration UI and enhance functionality. Updated the layout for sensor provider cards and status indicators, improving clarity on integration status. Added a new empty state message for unconfigured sensors and enhanced the settings view with improved API key input handling. Updated CSS for better responsiveness and visual consistency across sensor-related components.
**GH-42** Enhance stress analysis display by rounding score values for improved clarity. Updated the rendering logic to show rounded scores in both factor cards and component rows, ensuring a more precise visual representation of data.
**GH-43** Update growth potential metrics to reflect 8-day averages instead of 16-day averages. Modified relevant titles and descriptions in both dashboard and growth light analysis files for consistency and clarity. Adjusted calculation logic to align with the new 8-day forecast approach.
**GH-44** Implement Sites tab in Settings view with add site functionality and site details display. Updated SettingsController to build sites table data, including soil and water sample counts. Enhanced JavaScript for dynamic site management and integrated new UI components for better user interaction. Added CSS styles for improved layout and visual consistency across the Sites tab.
**GH-45** Enhance site status display in Settings and topbar. Updated SettingsController to include growth potential status in site data. Modified AppServiceProvider to pass site status to the topbar view. Improved topbar and settings UI to visually represent site status with color-coded indicators. Added CSS for status dots and refined JavaScript for rendering site status in the table.
**GH-46** Implement FieldScout sensor data import functionality. Added UI components for manual CSV upload, including a drop zone and results table. Updated JavaScript to parse and display imported data, enhancing the data view with real-time updates and improved layout. Added CSS styles for new elements to ensure visual consistency.
**GH-47** Enhance data view with info popovers and glossary entries. Updated the TDR results table layout for better readability and added interactive info icons for irrigation status and required water metrics. Implemented shared info popover functionality across pages for improved user guidance. Adjusted CSS for consistent styling of new elements.
**GH-48** Refactor dashboard and analysis views to improve loading states and UI consistency. Updated loading messages to use a shared empty state design across various components, enhancing visual clarity. Adjusted import links in the dashboard to direct to specific data sections instead of the hub. Added new CSS styles for the empty state layout.
**GH-49** Update sensor icons in data view for improved visual representation. Enhanced the empty state SVG in the no integration section to provide clearer graphics for unconfigured sensors.


## Backlog

delete added data logs 

Re-run for all pages

--

Карта для выбора локации — в старом была интерактивная карта (Leaflet). В новом только текстовый поиск + ввод координат вручную.

Morning Briefing  — файл morning-briefing.blade.php есть, но не интегрирован в навигацию.

Архитектурные отличия (возможно намеренные)
Decision Panel — логика выбора действий (почему та или иная рекомендация). В старом хабе была отдельная панель.

Evidence Panel — визуализация источников данных и уверенности в расчётах (Soil → Water → Tissue → Spray chain).

--

MOBILE VERSION

-----

Stress Index Analysis - add  i icons where needed (ion the KPI section and component breakdown)

----

vmay be we add it to KPI - same as on the soil page? 

----
Посмотри, вот на старом сайте написано, где про болезни, написано, что анализ сделан дляBentgrass, для какой-то конкретной травы, которая у нас основная species идёт. И написан какой-то процент. Вот что это за процент и где нам можно это вывести тоже? 
Analysis for: Bentgrass 85%
--


Check why on the dashboard on the side panel of GP - there is ET info but on the full analisys page there is no ET data at all. Is it related to GP at all?

---

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
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


email: yuryg@gethydrosight.com.au
password: GEAR.smith6



# Fixed comments
+1.⁠ ⁠Address lookup using Google Reverse Geocoding (added Google Maps API key, Places API). GH-97
+2.⁠ ⁠⁠Role based admin. Change password - fixed. GH-98 
+3.⁠ ⁠⁠Invite only sign up 
+4.⁠ ⁠There is a stress indicator but not traffic isn’t relevant to a golf or bowling green. GH-96
+5.⁠ ⁠Remove Insects model (https://gilbahub-test.gethydrosight.com.au/plan#timing)
+6.⁠ ⁠Change settings don’t update UI. GH-97
+7.⁠ ⁠⁠Keep users signed in. GH-98
+8.⁠ ⁠Once I log on how would I set up a totally new site? I only seem to be able to add three currently?
+9.⁠ ⁠The references as to where the calculations come from are there so it avoids issues with the “black mystery box” that people push. By having the references it means that it keeps people confidence that the data is valid and not “made up”. GH-95
+10.⁠ ⁠With Burns Club as an example it reads the top soil sample but how do you change the greens or sample to see the others? GH-94
+11.⁠ ⁠This relates to the traffic stress. I cant edit the traffic schedule under the “plan” tab. GH-102, GH-104, GH-105, GH-106.
+12.⁠ ⁠The ambient light levels are wrong. GH-108, GH-110, GH-111, GH-112. 
+13.⁠ ⁠Am I not supposed to see the full sensor list and these are only the ones not allocated yet? Does this mean the sensors that are already allocated to their respective greens as in the case of Elanora CC?
+14.⁠ ⁠Spray log fungicide dropdowns aren’t there. GH-119. 
+15.⁠ ⁠I cant find the facility to change the fairway tees specification. These was under the “Run”, Inputs set up required section. It then took the climate sate for the same site and generated a disease threshold for that turf type on a fairway or tee rather than a golf green. GH-120, GH-121, GH-122.
+16.⁠ ⁠How can you select what greens/fairway results to generate a word report for? Yes it was there. When wanted to print report export word doc was for one and export all gave you an option to select which soil water or tissue results you wanted to print as a word doc. GH-122. 
+17.⁠ ⁠There is a photolysis module somewhere that calculates how long a fungicide lasts once you record it on the spray log. This then shows up on the main dashboard and also has a FRAC resistance module to help counter any fungicide resistance. GH-123.
+18.⁠ ⁠When you enter a  site in australia, nz or the uk for example the grass. cultivars are supposed ri change for that region. So for example a golf course in nz has colonial bentgrass as an option and its cultivars but this shouldn’t appear for australia as no one uses it here. Likewise couch in the uk isn’t used as its a c4 grass and its too cold there
Couch and bermudagrass are the same thing btw but the Americans call it bermudagrass and Australians call it couch. God knows why. GH-123.
+19.⁠ ⁠With NZ this is supposed to use ammonium acetate interpretation for the analysis as it looks like it’s going to be licenced out to one company there. GH-126.
+20. Currently it seems to be using MLSN figures as a reference which they don’t use. GH-126.
+21.⁠ ⁠Plan>nutrition. You’re right I think on the your calculation for the GP numbers for NZ and I’m wrong! I’ll recheck to confirm but I’m pretty sure your right
+22.⁠ ⁠The monthly program drop down doesn’t work it asks for a soil test. That’s what the current layout looks like when it produces the product recommendations. GH-124, GH-125, GH-127. 
+23.⁠ ⁠Analysis>water balance>current depletion 10000% of TAW? GH-129. 
+23.⁠ ⁠The PGR map is important as it shows the rebound effect for some applications. GH-130, GH-131, GH-132.
+24.⁠ ⁠Nz golf can choose colonial bent but not the cultivar. GH-126.
+25.⁠ ⁠I’ve set up burns golf club and canberra boys but the dots don’t go green. Is this the sensors aren’t linked? - The dots change colour after running an analysis - the colour represents the current analysis status. Until you run analysis for a site, the dot stays grey. Once analysis has run, it turns green, amber, or red based on growth potential from the latest results (green = 70% or above, amber = 40–69%, red = below 40%). 
+26.⁠ ⁠Fairbairn golf club has two sensors 1 on the 10th and one on the 14th. Are these actually linked? - We generated API key for ⁠Fairbairn golf club and added it to the test env. API key is p5CYYER1sU82nFidWCAv12igVptxaZQc8K9YhOno
+27.⁠ ⁠Twin creeks gc address seems to be bleeding into other ones. The height of cut seems to revert to 25mm and irrigation method keeps going back to select. - It should be fixed GH-107, GH-118. 
+28.⁠ ⁠In New Zealand no one uses seashore paspalum as a tropical grass but Cotula hasn’t appeared which was in the plug in. This is specific to bowling greens and lawns in NZ only. Couch, buffalo, kikuyu and zoysia are not NZ. GH-126.
+29.⁠ ⁠How would I link the sensor at Queanbeyan regional sports centre to the Queanbeyan council site? - Added API key to your test env. API key is 
 4joY0fKUpX4FA8D034q6c4WkX4uMm6hQ6TqP3JU5
+30.⁠ ⁠When I uploaded the json for federal most of the locations then reset to federal golf club address? GH-107, GH-118.
24/06/2026
+31.⁠ ⁠Analysis the disease graph doesn’t relate to the figures above. Bentgrass doesn’t get grey leaf spot. GH-135. This one was a tricky one. Could you please check - because I cant reproduce it anymore. 
+32.⁠ ⁠Can we set up a function that allows the sample name to be edited please? GH-135a.
+33.⁠ ⁠It keeps going to perennial ryegrass 25mm for all the sites when I upload a json file. Everytime it re runs it reverts to perennial ryegrass 25mm. GH-107, GH-118.
+34.⁠ ⁠I have a MacBook and it won’t let me scroll down the first page? All the others are fine. Is that me or the software? GH-136.
+36.⁠ ⁠Burns has kikuyu fairways but where does disease go? Used to be on first page below the greens. The software reported disease on greens and fairways. - I beleive it was fixed when I was fixing comment  #15. If you think I still need to do something re this - let me know. 
+37.⁠ ⁠The cultivars were specific to the region and their traits are then used in the disease and wear models etc. it doesn’t matter if they are all listed in the dropdown when you choose the cultivar but I don’t think the traits are being used in the models at the moment. GH-137.
+38.⁠ ⁠Russley golf Club NZ analysis>disease risk no fairway set in settings but shows Spring dead spot preventative. The recommendations are wrong as well with three chemicals are the same. GH-138, GH-139. 
25/06/26
+40.⁠ ⁠Analysis >stress Still says primary stress traffic. GH-140, GH-141, GH-142. 
+41.⁠ ⁠Plan> management plan shows Australian listings not NZ for Russley. It was going to be just for Prebbles but can we add two other selections for NZ in case they change their minds? I have the json files Ready if they do this. Do you want them now or later? GH-143. You can send them - I'll have a look. 
+42.⁠ ⁠For NZ the text should say for NZ distributors. GH-144. 


03/07/26
+39.⁠ ⁠NZ is only cool season for fairways. GH-149.
+43.⁠ ⁠There was an ability to add the size/area for individual greens before. GH-144. Added. I also made some UI changes on the Data page.
Additionally, when you import soil data, zones are now automatically added to the Zones list in Settings if they don’t already exist.
I also added the source file name, so it’s easy to see which file each sample was imported from. If that’s not useful, just let me know and I’ll remove it.
+58.⁠ ⁠cultivar performance data absent of hydrosight. i know it in there somewhere :-). GH-149. 
+65.⁠ ⁠when manually add soil data if from same site (Green 10 for example) but a different date the newest overides the old one. GH-144.



-53.⁠ ⁠I have done so “tweaks” send them through as a zip?


06/07/26
+67. This is NZ and site wide. I need to add a gate to the dollar spot model since dollar spot is not active at temperatures below 10°C or above 35°C. the model should be considered inactive when 5-day average temperatures are above or below those numbers.  Currently In rare cases, it indicates dollar spot activity is likely below 10°C or above 35°C when relative humidity is very high. One gate in DollarSpotModel.calculate: if the 5-day MEANAT is < 10 or > 35, return a distinct inactive result (actionRequired: false), keeping the raw probability in a diagnostic field with a reason, so the suppression is auditable rather than hidden. GH-150. 
+68. there is a temperature discrepancy between the home page figure and the figure on the go graph? - Cant repro - will keep an eye on it. 
+69. The soil testing seems to have got corrupted which could well be a json issue. There are only three soil samples for tussles but it shows more than this and the test isn’t for tussles as it’s talking about green 5. GH-151-GH-160. 
+70. I’ve manually uploaded the soil chemistry and 1 tissue sample. The selector for the soil samples isn’t very user friendly as I’ve no idea which sample is which. GH-161. 

07/07/26
+72. what is it using to interpret the tissue test results. Each grass type has defferent requirements so previously you could set the ran. GH-162. 
+73. Based on the disease interpretation the current version shows recommended fungicides which I quite like from an end user perspective. 
+74. just reset to perennial ryegrass again from colonial bentgrass. GH-164. 
+Added new suppliers. GH-165, GH-166, GH-167. 
+75. With the Loi (loss on ignition) there should be a Breakdown of 0-20mm, 20-40mm, 40-60mm and 60-80mm. These figures are the percentage of organic matter present in each of these bands. However there also needs to be a facility to enter a total organic matter figure as well as these figures. GH-163.
+ Added new suppliers. GH-165, GH-166, GH-167. 

09/07/26
+76. don’t need recovery for golf courses just sportsgrounds. When click on edit traffic schedule you can’t edit the schedule. GH-169. 
+77. on a mobile when edit organic matter levels can’t save as can’t see save button. GH-168. 
+78. when click on management calendar what happens? It seems to work in export tab. Button is removed. GH-170.
+79. when print word report for Russley says perennial ryegrass and sportsturf not colonial bent and golf greens. Also on mobile can’t read any tables. GH-175. Fixed - but i still to do proper testing. 
+80a. disease cards and growth potential contradict each other. Growth Potential card shows 44% headline, 50% in the caption. At 7°C, cool-season GP on the standard PACE Turf/Gelernter curve (optimum 20°C) is about 6 to 10%. 44 to 50% corresponds to roughly 13°C, a shoulder-season temperature. The card is off by ~5x and reads like it’s using a season default, not the live 7°C. - In the GP card on the Dashboard, there are two numbers: one is the 8-day average, and the other is the current value. I’ve updated the UI to make this clearer (GH-171). 
The Growth Potential calculation is actually the same in both the old hub and the new hub — same formula, same result at the same temperature (see attached screenshot).
From looking at the code, it's not using the PACE/Gelernter curve. It uses a wider bell curve (the number comes out around 43% at 7°C, where PACE would give around 6%).
Do you want me to switch it to match PACE?
+80b. Stress Index says “Driven by: Heat 18%” at 7°C. Heat stress at 7°C is impossible for C3 turf. Same warm-input signature. - fixed label name. GH-171. 
+80c. Take-all detail says “soil temp 15°C, infection window active.” 15°C is a round default; real Christchurch greens soil in July sits near 6 to 9°C, which would close the window. The default is manufacturing a false infection window and a firm “prioritise Mn now” recommendation off placeholder data. GH-171. 
+82. Dew onset logged at 00:00 on five of seven days. Likely a default/fallback time rather than a computed dew-point crossing. GH-172. 
+83. Take-all pH driver at 0% contribution while pH is 6.5. Take-all is strongly pH-driven (favoured above ~6.5, suppressed by acidification and Mn). Zeroing pH for take-all is agronomically backwards. GH-174. 






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
**GH-50** Add delete functionality to Data page records (soil, tissue, water, LOI/OM, spray-log tabs).
UI — single row: Each row in the data table gets a "Delete" button in the Actions column alongside "View Details". Click → `window.confirm('Delete this record? This cannot be undone.')` → if confirmed: fetch DELETE → row removed from DOM. Same pattern as site deletion in Settings (GH-44).
UI — bulk delete: A "Delete (N)" button sits in the toolbar next to Compare. Always visible but `disabled`. Becomes active when 1+ checkboxes are checked (same activation logic as the Compare button). Click → `window.confirm('Delete N records? This cannot be undone.')` → deletes all selected → removes rows from DOM → resets checkboxes and disables the button again.
Backend: New route `DELETE /data/entry/{id}` handled by `DataController::destroy()`. Validates that the Sample belongs to the user's active site before deleting. Spray-log uses existing `SprayLogController::destroy` (`spray-log.destroy` route) — only needs UI wiring.
Sections: soil, tissue, water, loi — via `Sample` model. spray-log — via existing `spray_logs` table route.
**GH-51** Implement Getting Started panel in Dashboard and Settings. Added a floating panel to guide users through initial setup steps, including soil, water, tissue tests, and analysis. Updated JavaScript for dynamic UI rendering and session management. Enhanced CSS for the new panel layout and styles. Show onboarding prompt after site creation in Settings for improved user experience.
**GH-52** Fix site activation logic in settings-init.js to reload the page upon setting a site as active, ensuring the UI reflects the current active site. Removed outdated code that updated site details dynamically, addressing issues with settings not changing after site activation.
**GH-53** Update redirect route from '/' to '/dashboard' in web.php for improved navigation.
**GH-54** Refactor login view and update AuthController redirect. Replaced the login page layout with a new design, enhancing user experience with improved styling and structure. Updated the redirect route after login from 'hub' to 'dashboard' for better navigation consistency.
**GH-55** Update login view branding for improved readability. 
**GH-56** Enhance dashboard and site setup experience. Updated DashboardController to refresh user data, simplified site activation logic in SiteController, and improved dashboard view with a setup banner for unconfigured sites. Added JavaScript functionality for setup interactions and refined CSS for better UI presentation.
**GH-57** Update onboarding wizard and settings initialization for improved setup experience. Added logic to auto-show the onboarding wizard based on URL parameters and modified the yes button action to include a setup query parameter for seamless navigation to the dashboard.
**GH-58** Prevent auto-showing the onboarding wizard on db-shell pages to ensure proper setup handling by the new onboarding-wizard.js.
**GH-59** Enhance authentication and user management features in AuthController. Implemented password handling with Magic Link support, improved login validation, and added user registration functionality. Introduced role-based access control for site management and refined user experience with new notifications and banners in the dashboard and settings views.
**GH-59** Enhance user invitation functionality in settings view. Added input field for invitee name and updated JavaScript to manage user data more effectively, including user email handling for improved user experience.
**GH-60** Refactor SettingsController and update settings view. Removed unused site management logic and adjusted the UI to focus on site settings. Added account link in the sidebar for improved navigation. Enhanced CSS for select elements to improve user experience.
**GH-61** Implement sidebar notifications for pending user requests and enhance account view. Added logic to display the count of pending requests in the sidebar, updated the account view to show the current user's details, and refined user management UI with new tabs and improved search functionality.
**GH-62** Enhance login flow and setup interactions. Updated AuthController to clear intended URL for setup redirection. Improved dashboard initialization by consolidating setup logic in JavaScript, ensuring the onboarding wizard only displays when necessary. Adjusted redirection after onboarding completion to navigate directly to the dashboard.
**GH-63** Enhance invitation management and magic link functionality. Updated InvitationController to support multiple site invitations, improved user access checks, and added magic link creation for invited users. Modified MagicLink model to include site_id and added migration for database schema update. Enhanced user interface in account view to better manage pending requests and invitations.
**GH-64** Refactor account view and update site selection logic. Simplified the button styling for site selection in the account view and adjusted JavaScript to ensure proper label updates based on selected sites, enhancing user experience.
**GH-65** Refactor user management in UsersController and update account view. Enhanced user retrieval to support multiple managed sites for managers, added suspended user handling, and improved invitation query logic. Updated account view to streamline user role visibility and adjusted JavaScript for better tab management and error handling.
**GH-66** Remove UnsuspendUser command and refactor user management logic. Updated DashboardController to handle non-admin users without sites, modified SiteController to filter active sites, and adjusted UsersController to remove suspended user handling. Added no-access view for users lacking site access and improved email templates for better user communication.
**GH-67** Refactor email notification logic in AuthController, InvitationController, and MagicLinkController. Replaced raw email content with dedicated Mailable classes for improved maintainability and readability. Removed unused email layout file.
**GH-68** Add confirmation prompt for site removal in account initialization script. This change ensures users confirm their action before removing a user from a site, enhancing user experience and preventing accidental deletions.
**GH-69** Enhance magic link verification and user invitation handling. Updated MagicLinkController to allow both guests and logged-in users to verify magic links, processing pending invitations for existing sessions. Refactored account view to consolidate user management tables and improve UI for active users, requests, and invitations. Adjusted JavaScript for better tab management and visibility of empty states.
**GH-70** Add provisional name flag in site creation process. Updated SiteController to include 'provisional_name' set to true when storing new site data, enhancing site management capabilities.
**GH-71** Enhance account management by adding user details to site data. Updated AccountController to include user count and user information in the site data structure. Modified account view to display user count and added user invitation functionality in the JavaScript. Adjusted CSS for improved layout. This update improves user visibility and management within the site context.
**GH-72** Enhance site user management by integrating invitation data into the AccountController. Updated the buildSitesTableData method to include invited users alongside existing site users, improving user visibility. Modified the account view to display user statuses with distinct styles for active and invited users, enhancing the user experience. Adjusted JavaScript for better handling of user data presentation.
**GH-73** Enhance user management in account view by adding status filter and sorting functionality. Updated the account blade template to include a new status filter for user statuses and modified JavaScript to support sorting by name, email, and site. Improved the rendering of user data to enhance visibility and management capabilities.
**GH-74** Implement site search functionality in account view. Added a text input and dropdown for filtering sites by name and type. Updated JavaScript to handle search input and dynamically populate the site selection options, improving user experience in site management.
**GH-75** Update authentication views to include favicon and enhance logo representation. Added a favicon link to login, no-access, pending, and register pages. Updated logo SVG in login and register views to display a stylized letter "G" for improved branding consistency.
**GH-76** Update account initialization script to simplify user notification. Removed invitation prompt from the "no users" message for a cleaner user experience.
**GH-77** Update MagicLinkController to adjust email rate limits for local and production environments. Increased maximum emails allowed in local environment from 20 to 50, while maintaining the production limit at 50.
**GH-78** Update DatabaseSeeder to enhance user creation logic. Added 'status' and 'is_admin' fields for new users, and implemented updateOrCreate for admin user to ensure unique email handling.
**GH-79** Update MagicLinkController to redirect to account page after password reset instead of settings page. Enhance documentation by adding backlog items for future features and improvements.
**GH-80** Remove favicon.ico and update routing to redirect favicon requests to favicon.svg for improved asset management.
**GH-81** Enhance user permissions in UsersController: Implemented logic to determine if a user can remove another based on role hierarchy. Updated front-end to reflect these changes, ensuring only authorized users can see the remove button for site management.
**GH-82** Update UsersController to include 'is_admin' field in user selection and enhance permission checks. Users can only be removed if they are not admins, ensuring better role management in site administration.
**GH-83** Enhance mobile login view: Added responsive mobile header with logo and brand name, and adjusted styles for better layout on smaller screens.
**GH-84** Refine mobile login styles: Adjusted padding, background colors, and font sizes for improved aesthetics and layout on smaller screens, enhancing the overall user experience.
**GH-85** Revise mobile login layout: Added mobile footer and tagline, adjusted mobile header styles, and improved font sizes for better readability and user engagement on smaller screens.
**GH-86** Improve mobile login layout: Added a mobile footer, adjusted padding and margins for better alignment, and refined styles for enhanced user experience on smaller screens.
**GH-87** Enhance mobile authentication views: Added responsive styles for no-access and pending pages, improved layout for mobile login, and introduced a mobile footer with branding for better user experience on smaller screens.
**GH-88** Update mobile authentication views: Change body height to min-height for better responsiveness on smaller screens in login and register pages.
**GH-89** Enhance mobile authentication views: Added consistent font size for login inputs in both login and register pages to improve readability on smaller screens.
**GH-90** Implement mobile navigation enhancements: Added a mobile bottom navigation bar for improved accessibility and user experience on smaller screens, along with mobile-only account and settings icons in the top bar. Updated CSS for responsive design adjustments.
**GH-91** Enhance mobile dashboard layout: Introduced a 2-column grid for data sources, improved styling for source rows, and adjusted footer layout for better responsiveness on mobile devices.
**GH-92** Fix SiteController and site-config-persistence.js to handle empty site names: Updated logic to default to an empty string instead of siteId when label and name are not available, ensuring cleaner data handling.
**GH-93** Enhance sample analysis functionality: Added a new route for sample analysis in web.php and introduced new CSS styles for sample selector components in soil-nutrition-analysis.js, improving user interface and experience. Updated backlog in instructions.md with additional user feedback and feature requests.
**GH-94** Add session management to account view: Introduced a logout button with a form in the account.blade.php file, enhancing user experience by allowing users to easily sign out from their session.
**GH-95** Enhance soil nutrition analysis: Added nutrient notes and source information in soil-nutrition-analysis.js for improved user guidance. Updated backlog in instructions.md with new feature requests and clarifications.
**GH-96** Enhance dashboard and stress analysis functionality: Added conditional handling for traffic factor based on site type in dashboard-init.js and stress-analysis.js. Updated summary display to show recommendations if available. Refined backlog in instructions.md for clarity and organization.
**GH-97** Add Google Maps API integration: Introduced Google Maps API key in .env.example, updated services.php to include Google Maps configuration, and implemented geocoding functionality in various JavaScript files for improved location search capabilities. Updated instructions.md to reflect the addition of Google Maps API usage.
**GH-98** Refactor authentication logic: Updated AuthController and MagicLinkController to always remember user sessions upon login. Enhanced password reset flow by adding session management for trusted resets in ProfileController. Improved password modal UI in account.blade.php and added functionality to toggle password visibility in account-init.js.
**GH-99** Enhance account and site configuration data handling: Updated AccountController and AppServiceProvider to retrieve and inject turf species, methodology, and location name from GAIP configurations. Modified views to utilize these new variables for improved data display. Adjusted JavaScript functions to prevent overwriting server-side rendered data with local storage values.
**GH-100** Enhance location handling in Settings and Site controllers: Added latitude and longitude synchronization between GAIP config and site model. Updated settings view to reflect new location data and adjusted JavaScript to ensure accurate data persistence. Improved instructions for clarity on data handling.
**GH-101** Refactor report export functionality: Update analysis status display to show only when generating, improve button functionality for Word export, and prevent unnecessary database writes during export. Enhance user feedback with updated loading messages and streamline JavaScript for better performance.
**GH-102** Implement Traffic & Wear settings for sports fields: Added a new form in the settings view to configure match and training schedules, including options for sport type, matches per week, and training details. Updated JavaScript to handle local storage for traffic data and ensure proper display based on turf type. Enhanced user feedback with save messages and improved layout for better usability.
**GH-103** Update site-config-persistence.js to conditionally set label based on siteId; enhance instructions.md with additional clarification on status indicators.
**GH-104** Enhance Traffic & Wear settings visibility for sports fields: Updated settings view to conditionally display the Traffic & Wear tab and panel based on turf type. Improved JavaScript to manage unsaved changes and ensure proper tab activation. Added user feedback for unsaved changes when switching tabs.
**GH-105** Implement custom confirmation dialog for unsaved changes: Added a new stgConfirm function to display a modal dialog when users attempt to navigate away with unsaved changes. Updated JavaScript to intercept link clicks and tab switches, enhancing user experience by preventing accidental data loss. Styled confirmation dialog with new CSS for improved visibility and usability.
**GH-106** Add 'Save & leave' button to confirmation dialog and enhance unsaved changes tracking: Implemented a new button in the confirmation dialog for saving changes before leaving. Updated JavaScript to manage unsaved forms more effectively, including callbacks for after save actions and improved handling of form submission events. Enhanced user experience by ensuring proper state management for dirty forms.
**GH-107** Importing data no longer updates the address of other sites. Remove legacy localStorage handling for gilba_hub_state in settings-init.js to streamline code and improve maintainability.
**GH-108** Enhance location handling in settings-init.js and site-data-transfer.js: Implemented localStorage synchronization for updated coordinates and ensured accurate location saving to the database to prevent stale data issues in the analysis engine. 
**GH-109** Update account view and JavaScript logic to enhance user experience: Changed table header to allow nowrap for action buttons, conditionally display invite buttons based on user role, and pre-populate invite sites dropdown for improved accessibility. Updated instructions for clarity on ambient light levels.
**GH-110** Refactor Ambient DLI handling in hub-orchestrator.js: Updated logic to prioritize captured snapshots over cached values for ambient DLI, ensuring accurate data during site switches. Introduced a new variable to store the last analysis ambient DLI and improved comments for clarity on fallback priorities.
**GH-111** Enhance settings view and localStorage management: Added a warning message in the settings view to inform users that existing data will be replaced upon file upload. Updated JavaScript to clear specific localStorage entries related to site data during the import process, ensuring accurate data handling and preventing stale data issues.
**GH-112** Implement clearSiteData option in sync method: Added functionality to optionally clear site-related data during synchronization, including deletion of spray logs, field log entries, and associated samples. Updated JavaScript to include clearSiteData parameter in API request for improved data management.
**GH-113** Refactor zone grid rendering and improve UI layout: Updated the rendering logic for sensor data in the zone grid to sort sensors by name and enhance the display of average values. Modified CSS to change the layout from grid to flex for better responsiveness, adjusted styles for sensor rows, and added column headers for clarity. Improved overall visual consistency and user experience in the data view.
**GH-114** Enhance sensor data handling and UI messages in settings-init.js: Updated messages for no readings and no devices found, improved logic for fetching live sensor readings, and ensured accurate localStorage caching of sensor data. Removed outdated comments in instructions.md for clarity.
**GH-115** Implement DLI metrics display in dashboard: Added logic to calculate and display Daily Light Integral (DLI) metrics, including ambient DLI and target values, with color-coded status indicators. Updated HTML structure to present DLI information clearly in the dashboard panel.
**GH-116** Enhance climate data handling in dashboard-init.js and hub-persistence.js: Improved logic for retrieving soil temperature values. Updated HTML rendering to ensure accurate display of soil temperature. 
**GH-117** Refactor dashboard HTML rendering: Removed unused soil temperature display logic and simplified prefix string construction in dashboard-init.js. Updated badge label formatting in growth-light-analysis.js for clarity. Enhanced instructions.md with additional context on dashboard data consistency.
**GH-118** Update site-config-persistence.js to prevent iframe context data push: Added a check to ensure that configurations are only pushed from the top window to avoid location bleed issues. Enhanced instructions.md with additional user feedback regarding JSON upload and sample name editing issues for improved clarity.
**GH-119** Enhance fungicide selection and regional detection in data view: Added scripts for fungicide databases based on the spray log section. Implemented region detection logic using site latitude and longitude to dynamically build fungicide options. Updated product field rendering for better user experience. Improved instructions.md for clarity on JSON upload issues.
**GH-120** Implement companion surface disease analysis feature: Added UI elements for selecting companion species in settings, updated dashboard to display disease risk for fairway/tee surfaces, and enhanced data handling for companion disease metrics in various scripts. Improved visibility logic for companion species selection based on turf type.
**GH-121** Enhance disease analysis and treatment window display: Updated dashboard-init.js to include treatment window information in disease rows, improved disease analysis logic in disease-analysis.js to account for companion diseases, and enhanced data persistence in hub-persistence.js to include overall scores and risk metrics. Updated instructions.md for clarity on recent changes.
**GH-122** Refactor disease analysis logic in disease-analysis.js: Introduced isActionable function to filter actionable recommendations, separated greens and companion items for clearer display, and improved total count logic for recommendations. Enhanced UI rendering to handle cases with no actions required.
**GH-123** Integrate SpeciesService for dynamic species data handling: Updated AppServiceProvider to include species data in views, modified DatabaseSeeder to call SpeciesDefinitionSeeder, and refactored settings and onboarding scripts to utilize new species data structure. Enhanced UI for species selection based on turf type and region, and updated related JavaScript files for improved functionality and performance.
**GH-124** Enhance nutrition calendar integration and UI: Updated plan.blade.php to bridge data between the plan page and nutrition-calendar.js, ensuring proper state management for turf and climate data. Refactored nutrition-calendar.js to merge soil state into GAIP_STATE without overwriting existing data. Improved CSS for nutrition calendar components, enhancing layout and responsiveness. Updated JavaScript for better nutrient display and handling in the UK and AU fertiliser integration scripts.
**GH-125** Refactor methodology handling for New Zealand sites: Updated AnalysisController, SampleAnalysisController, and SettingsController to utilize effectiveMethodology for determining soil test methodology based on site coordinates. Enhanced UI in settings.blade.php to lock methodology selection for NZ sites. Improved CSS for locked value display. Updated instructions.md for clarity on methodology changes.
**GH-126** Enhance fertiliser integration scripts: Added inline notes display for granular and liquid products in AU, NZ, and UK scripts. Updated table structure to include notes column and adjusted CSS for improved layout and styling of notes. Ensured consistent handling of notes across all relevant files.
**GH-127** Refactor nutrient delivery display and improve UI components: Updated status indicators in fertiliser integration scripts to use descriptive labels instead of icons. Enhanced table structure for monthly program and nutrient delivery summary sections, ensuring consistent styling and improved readability. Adjusted CSS for better layout and responsiveness across various components.
**GH-128** Update CSS for monthly program tables in fertiliser integration scripts: Enhanced table layout with fixed width and improved column width percentages for better responsiveness. Added word-break properties for improved text handling in notes and cell alignment. Updated instructions.md for clarity on dropdown functionality issues.
**GH-129**Update water balance analysis for current depletion percentage calculation: Adjusted depletionFraction handling to reflect that it is stored as a percentage (0-100) in irrigation-scheduler.js.
**GH-130** Enhanced UI components for better user interaction and added loading indicators for PGR data.
**GH-131** Refactor UI components in data and plan views: Updated URLSearchParams usage for consistency, added new CSS classes for action buttons and links, and improved layout for better user interaction. Enhanced log button structure in JavaScript for improved styling and responsiveness.
**GH-132** Enhance PGR calculations and UI updates: Adjusted reapplication window logic to use 75% of threshold for GDD calculations in pgr-forecast.js and plan-ui.js. Updated data.blade.php to clean URL parameters after modal opening for improved user experience. Modified instructions.md to reflect additional GH issue references.
**GH-133** Remove PGR & Irrigation tab and associated scripts: Eliminated references to the PGR & Irrigation analysis from analysis.blade.php and analysis-router.js. 
**GH-134** Update margin spacing in plan view for improved layout: Adjusted the margin of the progress bar to enhance visual separation and overall design consistency.
**GH-135** Update disease susceptibility values for bentgrass in disease-forecast.js: Adjusted gray leaf spot susceptibility from 0.3 to 0 for improved accuracy in disease forecasting.
**GH-135a** Implement sample update functionality in SampleController: Added an update method to handle sample modifications, including validation and database transactions. Updated routes to include PATCH method for sample updates. Enhanced data display in data.blade.php to include additional sample fields and added edit buttons for user interaction. Updated CSS for new edit button styling.
**GH-136** Enhance dashboard UI and instructions: Updated CSS for improved layout and responsiveness, including new overflow handling and media queries for better display on various screen sizes. Modified instructions.md to clarify issues and requests related to sample editing and disease reporting.
**GH-137** Enhance analysis functionality: Added turf variety and site type to AnalysisController and updated analysis.blade.php to include these new variables. Improved disease resistance display in disease-analysis.js with a new chip format for better visual representation. Updated instructions.md for clarity on recent issues and requests.
**GH-138** Update AnalysisController to include companion species in analysis data. Enhanced disease-engine-pure.js to return unique formatted product lines. Revised instructions.md for clarity on cultivar traits and disease risk settings.
**GH-139** Refine disease analysis logic and improve product listing: Updated disease-analysis.js to ensure diseases are only shown with a positive risk score, preventing stale treatment windows from displaying irrelevant data. Enhanced product listings by filtering duplicates in recommendations. Updated instructions.md to reference GH-138 for clarity on analysis discrepancies.
**GH-140** Update stress analysis logic to conditionally handle primary stressor based on site type: Introduced a check for sports KPIs to ensure accurate primary stressor assignment. This change improves the accuracy of stress analysis results.
**GH-141** Refine primary stressor assignment in stress analysis logic. Enhanced handling for non-sports KPIs by introducing a fallback mechanism to select the highest scoring non-traffic component when traffic is not applicable. This improves the accuracy of stress analysis results.
**GH-142** Update primary stressor color assignment in stress analysis. Enhanced the logic to dynamically set the color based on the primary stressor's metadata, improving visual accuracy in stress analysis results.
**GH-143** Enhance region detection in plan view: Added logic to determine if the location is in New Zealand or Australia, allowing for improved regional handling in fertiliser integrations. Updated state location to include the detected region.
**GH-144** Update NZ fertiliser recommendations and enhance product description: Changed the title from "Prebbles Product Recommendations" to "NZ Fertiliser Recommendations" for clarity. Updated product selection description to specify that products are sourced from NZ distributors for optimal agronomic fit.
**GH-144** Enhance Sample and Site Controllers with zone management and source file handling: Added logic to merge zone names into sites based on sample types in SampleController. Updated sync method to include source file in the request and improved attributes merging in SiteController. Enhanced data display in views to accommodate new fields and styles for better user interaction.
**GH-145** Refactor CSS for actions cell and update instructions: Changed the display properties of the actions cell to use vertical alignment instead of flexbox for better layout consistency. 
**GH-146** Enhance dashboard and settings views: Added an error banner to the dashboard for weather fetch failures, improving user feedback during analysis. Updated settings view to include an ID for the zones form, facilitating better event handling in JavaScript.
**GH-147** Enhance dashboard weather status handling: Updated the dashboard to include specific IDs for weather status elements, improving JavaScript interaction. Added logic to display an error banner and update the status indicators when weather data fetch fails, enhancing user feedback during analysis.
**GH-148** Enhance dashboard weather handling: Updated error banners to provide clearer feedback on weather data fetch failures and manual overrides. Improved JavaScript logic to differentiate between live, cached, and manual weather data sources, ensuring accurate status updates and user notifications.
**GH-149** Enhance species definition and dashboard functionality: Updated the SpeciesDefinitionSeeder to include new grass varieties for fairways in New Zealand. Improved dashboard scripts by adding variety traits loading for enhanced performance analysis. Updated settings view to dynamically populate companion species options based on the selected region, ensuring accurate species representation.
**GH-150** Refactored disease risk calculation in DollarSpotModel to include temperature gates for dollar spot activity, ensuring accurate risk assessment. Added tests to the new hub. 
**GH-151** Refactor disease risk display and calculation logic: Updated dashboard to improve disease risk representation, including changes to the progress bar color based on severity. Enhanced JavaScript to accurately reflect current and forecasted disease risks, ensuring better user feedback and clarity in risk assessment. Added new forecast alert card for improved visibility of peak risks.
**GH-152** Update dashboard status message for VWC sensor: Changed instructional text to specify connection of a soil moisture sensor instead of a Hydrosight sensor for improved clarity on data availability.
**GH-153** Enhance soil nutrition analysis dropdown: Updated CSS for improved layout and responsiveness, added file name display in dropdown rows, and refined search functionality to include filtering by file source. Adjusted instructional text for clarity on filtering options.
**GH-154** Enhance soil nutrition analysis sorting logic: Improved sample sorting by incorporating date, label, and lab reference comparisons for more accurate and user-friendly results.
**GH-155** Enhance sample sorting in DataController: Added logic to prioritize samples with null client IDs for improved organization and clarity in data presentation.
**GH-156** Refine sample sorting logic in DataController: Updated sorting to prioritize non-null client IDs while maintaining clarity in data presentation, enhancing the organization of sample results.
**GH-157** Enhance data table in data.blade.php: Added an ID column to the data table for improved clarity and reference, ensuring better organization of displayed information.
**GH-158** Update data table in data.blade.php: Changed the placeholder for empty Client UID values from '∅ empty' to '—' for improved visual consistency and clarity in data presentation.
**GH-159** Refactor data table layout in data.blade.php: Rearranged columns for improved organization, placing 'Zone type' and 'File' after 'Zone name' for better clarity in data presentation.
**GH-160** Update data-ui.css: Adjusted padding and font size for input elements, added transition effects, and enhanced styling for select elements to improve user experience and visual consistency.
**GH-161** Enhance data display in data.blade.php: Updated the layout of data rows to include zone names as subtitles, improved the display logic for names and zones, and adjusted CSS for better alignment and spacing, enhancing overall readability and user experience.
**GH-162** Update soil nutrition analysis and data display: Introduced tissue range presets for various grass species in soil-nutrition-analysis.js, enhancing nutrient analysis accuracy. Added SITE_SPECIES variable in data.blade.php for improved data context. Updated instructional documentation for clarity on recent changes.
**GH-163** Update nutrient display in data.blade.php: Enhanced the nutrient breakdown by adding depth-specific categories (0–20mm, 20–40mm, 40–60mm, 60–80mm) for organic matter and improved the layout of the metric grid for better responsiveness. 
**GH-164** Refactor turf species handling in settings-init.js: Updated species traits mapping for improved clarity and added logic to retain saved species when no equivalent is found in the new list. 
**GH-165** Update JavaScript and CSS files for NZ fertiliser integration: Added new scripts for Aitkens and NZ fertiliser products, updated AU and UK integration scripts to hide competing regional panels, and adjusted CSS text alignment for improved consistency across tables.
**GH-166** Remove 'Stamina / Aqua Aid' distributor from NZ fertiliser integration: Updated JavaScript files to exclude Stamina from distributor options and filtering logic, ensuring a more accurate representation of available products.
**GH-167** Enhance supplier normalization and display in fertiliser integration scripts: Updated the normaliseSupplier function to include brand-based supplier assignments for Aitkens products, and improved supplier display names in the UK integration script for better clarity and user experience.
**GH-168** Update CSS and documentation for improved functionality and clarity: Adjusted max-height in data-ui.css for better responsiveness, and refined instructions.md to enhance clarity on organic matter breakdown and supplier additions.
**GH-169** Enhance tab visibility and display logic in plan and settings-init files: Added conditional rendering for the recovery tab based on turf type in plan.blade.php, and improved tab activation logic in settings-init.js to ensure only visible tabs are activated on page load.
**GH-170** Remove iCal export functionality from plan-ui.js and update instructions.md to reflect changes in management calendar button behavior. The button has been removed to streamline the user interface.
**GH-171** Update dashboard UI and JavaScript for clarity and accuracy: Modified the Growth Potential card to display the 8-day average more clearly, updated factor labels in dashboard-init.js for better context, and refined temperature handling in disease-engine-pure.js to prevent false infection window alerts. Adjusted instructions.md to reflect these changes and clarify discrepancies in growth potential data. GH-171.
**GH-172** Update dew forecast descriptions and improve rendering logic in dashboard and disease analysis scripts: Clarified dew forecast body text for accuracy, adjusted HTML structure for better layout, and refined dew forecast data handling to ensure correct display of wet hours and risk levels.
**GH-173** Enhance disease analysis scripts and integration: Added multiple variety traits scripts to ensure proper loading order for disease engine functionality, and updated the disease-forecast.js to remove unvalidated brown patch risk calculations, replacing them with a validated model approach for improved accuracy in risk assessment.
**GH-174** Enhance disease analysis and UI: Added handling for suppressed environmental drivers in disease-analysis.js and disease-ui.js, displaying relevant notes. Updated disease-engine-pure.js to adjust recommendations based on pH suppression status. Introduced new CSS class for suppressed driver notes in disease-ui.css.
**GH-174** Update table widths and page orientation in word export files for improved layout and consistency.
**GH-175** Tests



## Backlog
44.⁠ ⁠Analysis>water balance irrigation balance the same for every site currently
+45.⁠ ⁠Is it me or is this showing the same light level for every site? Could you please give me an example? I see different levels. 
+46.⁠ ⁠Analysis> soil and nutrition > only shows 1 active growing month? - Could you please send me an example? I see 12 months. 
47.⁠ ⁠When upload json file with soil tests into twin creeks data> soil says no data added but you can see it in analysis > soil and nutrition
48.⁠ ⁠Plan> nutrition the seasonal N plan should run off nutrition program annual N target. For twin creeks this is saying C3/C4 blend 70/30 at the bottom?
49.⁠ ⁠I upload the json burns file which has 26 soil and 1 water test. I set the turf type to greens creeping bentgrass and 3mm. Then I add the PGR application. I run plan>nutrition>100 n target and all ok. Then it reverts to perennial ryegrass at 25mm and a sports ground and removes all the soil and water test results even though they are still in analysis>soil and nutrition?
50.⁠ ⁠Burns club Log fungicide application. Nothing shows up on front of site relating to resistance or longevity
51.⁠ ⁠Burns club Plan> pre Emergent at bottom Says  soil temp 17C when air temp is 3.2C 
52.⁠ ⁠Pre emergent timing is wrong. We are in winter and have missed the window. Some of these you apply as temperature falls to a certain temperature and some you apply as temperature rises. Once temperature passes you tend to have missed the window
54.⁠ ⁠Where is soil water integration?
54.⁠ ⁠GP Hydrosight is 70 vs 48
55.⁠ ⁠disease risk is 11% for dollar spot vs 100???% fusarium although both show severe.
56.⁠ ⁠stress index is ok as its 22 vs 19
57.⁠ ⁠the hydrosight hub text only shows dollar spot although the graph also shows fusarium anthracnose brown patch and take all. the gaip hub shows red thread waitea patch dollar spot (12%)
60.⁠ ⁠soil temps are totally different. hydrosight 9.3/9.3/9.2/9 and gaip hub 7.9/7.8/7.7 and 7.5. i think there is an error with the gaip hub re air temperature which could explaiin some of these errors as mine says temperature is 8.4 and yours says 11.6C?
+61.⁠ ⁠the soil test figures are correct and this location is set up for ammonium acetate (AA) as its in NZ. however, the interpretation is MLSN which isnt right. AA is AA and MLSN is MLSN etc. - Location was incorrect. 
+62.⁠ ⁠plan/nutrition still show australia and hte dropdown still shows australian companies and not 	nz. - Location was incorrect. 
63.⁠ ⁠Entered PGR application of amigo 175 at 4L to both. it doesnt show up on the hydrosight
64.⁠ ⁠temperature 8C but growth potential graph shows 14.1?
66.⁠ ⁠same with water tests as with soil (65)
when add manual data for water ther e is no way to add carbonate, phosphate or nitrate
67.⁠ ⁠when add water chemistry where are the results? analysis>water balance> nothing there and there needs to be. grpah and/or way of seeing which result relates to what sample






35. Burns golf club growth and light recommendations. Raise mowing height to 34mm. Not on a golf green you don’t
59. Hydrosight still keeps saying to raise the height of cut to 32m m on a golf green?



79. when print word report for Russley says perennial ryegrass and sportsturf not colonial bent and golf greens. Also on mobile can’t read any tables. GH-175, GH-176. 


81. I’ve tried to makes things easier with changes for the cultivar performance data. If it doesn’t make things easier let me know please. 
Could you please just explain what you’d like to change, and I’ll do it? It’s much easier and less time-consuming than comparing the whole project.


+84. There is a problem with the brown patch graph as it’s using the wrong model. GH-173. 












# Long backlog
71. the areas be better in m2 and you can’t tell which green is which. Fairways they tend to use hectares and greens and tees m2. Football pitches m2.

Integration with soil scout
this is the soilscout api  https://soilscouts.fi/api/v1/?format=openapi








# My changes:

data sources - all current but no tissiea test and water downloaded

---


All popups - should be with new UI (like in the settings when moving to another page/tab)

--
Check the algorithm in the old hub ... (/Users/katep/Documents/Work/gilba/gilbahub_previous)
Check what was implemented in the new hub (/Users/katep/Documents/Work/gilba/gilbahub)
Write a comparison

----
- also move branding settings to the settings page and make ui nice

- Stress Index Analysis - add  i icons where needed (ion the KPI section and component breakdown)

- to add Self registration with approval

- Ограничить ключ (важно)-  Нажать на созданный ключ → Edit
В разделе Application restrictions → выбрать HTTP referrers (websites)
Добавить ваш домен: https://yourdomain.com/*
В разделе API restrictions → Restrict key → выбрать только Places API
Save

- Auto re-run - setup minutes or hours - how often to rerun

- Task management

- How often data should be pulled from sensors?

- Soil temperature take from sensor ? 
 
- MOBILE VERSION

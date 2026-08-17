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
+65.⁠ ⁠when manually add soil data if from same site (Green 10 for example) but a different date the newest overides the old one. ⁠same with water tests as with soil (65). GH-144.



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

10/07/26
+35. Burns golf club growth and light recommendations. Raise mowing height to 34mm. Not on a golf green you don’t. GH-178.
+59. Hydrosight still keeps saying to raise the height of cut to 32m m on a golf green? GH-178.
+81. I’ve tried to makes things easier with changes for the cultivar performance data. If it doesn’t make things easier let me know please. - GH-179 - applied it, could you please check if it's what you expected? 

13/07/26
+45.⁠ ⁠Is it me or is this showing the same light level for every site? Could you please give me an example? I see different levels. 
+46.⁠ ⁠Analysis> soil and nutrition > only shows 1 active growing month? - Could you please send me an example? I see 12 months. 
+54.⁠ ⁠GP Hydrosight is 70 vs 48. GH-183. GH-184. 
+55.⁠ ⁠disease risk is 11% for dollar spot vs 100???% fusarium although both show severe. - Could you please check after today's changes if all good now. 
+56.⁠ ⁠stress index is ok as its 22 vs 19. Ok
+57.⁠ ⁠the hydrosight hub text only shows dollar spot although the graph also shows fusarium anthracnose brown patch and take all. the gaip hub shows red thread waitea patch dollar spot (12%). - Could you please check after today's changes if all good now. 
+61.⁠ ⁠the soil test figures are correct and this location is set up for ammonium acetate (AA) as its in NZ. however, the interpretation is MLSN which isnt right. AA is AA and MLSN is MLSN etc. - Location was incorrect. 
+62.⁠ ⁠plan/nutrition still show australia and hte dropdown still shows australian companies and not 	nz. - Location was incorrect. 
+64.⁠ ⁠temperature 8C but growth potential graph shows 14.1? - Could you please check after today's changes if all good now. 
+85. The PGR response curve is showing an error and the cultivar cards are a lot better but a few minor tweaks needed. Could you please let me know what error do you mean?
+86. Couch and bermudagrass are the same thing. - In the calculations they are considered the same grass (we fixed this based on comment #18 (GH-123)). If you want me to remove one of them from the list - let me know. 
+84. There is a problem with the brown patch graph as it’s using the wrong model (file). GH-173, GH-180, GH-181. 
+87. Nutrition calendar (file). GH-182. 
+88. GP reconciliation (file). GH-183, GH-184. 
Does my doing it this way help? - Yes, very helpful - it gives more context. 


17/07/26
+44.⁠ ⁠Analysis>water balance irrigation balance the same for every site currently. - I see different numbers - ex Burns GC and Russley GC. If you are not sure in the calculations - let me know which location to check. 
+47.⁠ ⁠When upload json file with soil tests into twin creeks data> soil says no data added but you can see it in analysis > soil and nutrition. - Could you please send me through the file which you are using. 
+48.⁠ ⁠Plan> nutrition the seasonal N plan should run off nutrition program annual N target. For twin creeks this is saying C3/C4 blend 70/30 at the bottom? GH-186, GH-187. 
+49.⁠ ⁠I upload the json burns file which has 26 soil and 1 water test. I set the turf type to greens creeping bentgrass and 3mm. Then I add the PGR application. I run plan>nutrition>100 n target and all ok. Then it reverts to perennial ryegrass at 25mm and a sports ground and removes all the soil and water test results even though they are still in analysis>soil and nutrition? - Couldn't reproduce - probably was fixed (comment #33 - GH-107, GH-118). Could you please let me know if you notice it again?
+50.⁠ ⁠Burns club Log fungicide application. Nothing shows up on front of site relating to resistance or longevity. GH-188. 
+51.⁠ ⁠Burns club Plan> pre Emergent at bottom Says  soil temp 17C when air temp is 3.2C. GH-189. 
+52.⁠ ⁠Pre emergent timing is wrong. We are in winter and have missed the window. Some of these you apply as temperature falls to a certain temperature and some you apply as temperature rises. Once temperature passes you tend to have missed the window. - Could you please rerun with latest changes for soil temperature (comment #51) and check again?
60.⁠ ⁠soil temps are totally different. hydrosight 9.3/9.3/9.2/9 and gaip hub 7.9/7.8/7.7 and 7.5. i think there is an error with the gaip hub re air temperature which could explaiin some of these errors as mine says temperature is 8.4 and yours says 11.6C? - Found an issue in the new hub, fixed it (GH-191) but there is still a difference in soil temperatures. We can look at this after we fix everything for NZ if you are ok with it?
+86. Yes remove bermudagrass please as that American! GH-192.
+87. I updated and checked the fungicide resistance management for NZ. Ive done Australia as well but holding off on that as we are doing NZ first. Ill check the disease models and which we do and dont need this afternoon
/Users/katep/Documents/Work/gilba/gilbahub/files/fixes/26-07-17-87-registration-auth-model
GH-193, GH-194, GH-195, GH-196, GH-197, GH198, GH-199, GH-200
+88. Updated the NZ models and also added an Nmodifier to large patch. I think we should remove fusarium, large patch and dreschlera off the graph as they are not validated models. If we do keep them in the table we need to have an unvalidated badge/in development next to them (or just leave them off at this stage until later)
/Users/katep/Documents/Work/gilba/gilbahub/files/fixes/26-07-17-88-NZ-disease-largepatch
GH-193, GH-194, GH-195, GH-196, GH-197, GH-198, GH-199, GH-200, GH-201.
+89. After 88. GAIP_SaaS_Verification_LeafWetness_Divergence_b35fix496.md
/Users/katep/Documents/Work/gilba/gilbahub/files/fixes/26-07-17-89-verification-leafwetness
GH-202
Could you please check #87-89 and see if you need more info in the UI. 

+63.⁠ ⁠Entered PGR application of amigo 175 at 4L to both. it doesnt show up on the hydrosight. - I added PGR application to Russley GC and rerun analisys - attached screenshot with results. Are you expecting different data or you look somethere else?



27/07/26
+54.⁠ ⁠Where is soil water integration? GH-203, GH-204, GH-205, GH-206, GH-207,GH-208
+66.⁠ when add manual data for water ther e is no way to add carbonate, phosphate or nitrate. GH-203
+67.⁠ ⁠when add water chemistry where are the results? analysis>water balance> nothing there and there needs to be. grpah and/or way of seeing which result relates to what sample. GH-204, GH-205, GH-206, GH-207, GH-208
+90. the soil tests look good but I think they have got their wires crossed. Russley GC in Anzac is ammonium acetate but it’s using the MLSN set. Also MLSN for P isnt 6. Sulfur is Sulphur. MG is Mg. CA is Ca etc. GH-209, GH-211, GH-212



28/07/26
+79. when print word report for Russley says perennial ryegrass and sportsturf not colonial bent and golf greens. Also on mobile can’t read any tables. GH-175, GH-176, GH-177, GH-225 - I've made a few improvements to the report. 
I've also made some general improvements to the Hub. 




04/08/26
+92. Its Prebbles distributor on Plan>nutrition. GH-228.



05/08/26
+93. it doesnt print the program in plan>nutrition if you select the annual N target generate nutrition program. GH-229, GH-230, GH-231, GH-232, GH-233. 



06/08/2026
+94. Shows the tissue test result for green 13 after every soil test result. page 11 what green is this? Im assuming no 1?the tissue test should just correspond to the green it tests


11/08/26
+91. I think we should remove the fusarium results off the front as well as the model isn’t validated and it’s giving crappy readings. It’s not fusarium weather currently in Christchurch as it’s cold and dry. GH-236, GH-237, GH-238, GH-239, GH-240, GH-241, GH-242.



13/08/26
+249 uploaded a football ground Hoxton in Auckland (it’s made up) and added soil water and tissue test results. 1 file
D01 - D03 GP. GH-245 - GH-252


17/08/26
+D30 - fixed. GH-253. 



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
**GH-176** Enhance word export UI: Updated progress overlay styling for improved aesthetics and usability, including new layout elements and enhanced color schemes. Adjusted sample label handling in progress updates for clarity.
**GH-177** Update word export styles: Increased font sizes for various text elements in word-export-combined.js and word-export.js to enhance readability. Adjusted related text properties for consistency across the document. Updated instructions.md with a date entry.
**GH-178** Enhance surface type determination: Added handling for turf subCategory in shade-engine.js and shade-engine-pure.js to improve surface type assignment logic for mowing height guidance.
**GH-179** Update variety traits data: Standardized risk multipliers and confidence levels across multiple variety traits scripts, replacing fabricated values with a consistent 'none' confidence level and a risk multiplier of 1.0. Adjusted species key mapping in disease-analysis.js to include additional Browntop Bent variations for improved accuracy.
**GH-180** Enhance climate data handling and disease analysis: Implemented safeguards in climate-engine-v2.js to prevent overwriting real temperature data with null values. Updated disease-analysis.js to ensure proper handling of null disease objects and improved display of contribution metrics. Enhanced hub-orchestrator.js to recover temperature data from raw weather inputs when defaults are null. Added tests for disease risk analysis based on soil manganese and nitrogen status in disease-engine-integration.test.js.
**GH-181** Remove fabricated trait values from NZ variety data: Neutralized all fabricated numeric traits across 86 NZ-visible varieties in the variety traits data files. Updated risk multipliers to 1.0 and set confidence levels to 'none' for affected traits, ensuring only verified trial-backed data is presented. This change enhances the accuracy and reliability of the variety traits displayed in the hub.
**GH-182** Enhance N cap application in nutrition calendar: Updated the applyNCap function to include overflow redistribution for monthly nitrogen allocations. Improved handling of unschedulable allocations and added detailed reporting of scheduled totals, redistributed amounts, and unschedulable values. Adjusted UI messages to reflect these changes for better user feedback.
**GH-183** Refactor growth potential calculations to use GilbaGrowthPotentialEngine: Updated various scripts to replace inline Gaussian models for growth potential with calls to the GilbaGrowthPotentialEngine, ensuring consistent calculations across C3 and C4 species. Adjusted dashboard and climate modules to reflect daily mean values from the new engine, enhancing accuracy in growth potential reporting.
**GH-184** Integrate growth potential engine into nutrition calendar: Added the growth-potential-engine.js script to the plan view and refactored nutrition calendar calculations to utilize the GilbaGrowthPotentialEngine for improved accuracy in growth potential assessments. Updated related tests to ensure consistency and reliability in results.
**GH-185** Enhance disease analysis and forecasting: Updated disease-analysis.js to prioritize climate data from getAuthoritativeClimate for improved accuracy and added a new function to inject Active Threats Day 0 scores into disease-forecast.js. This ensures consistency in risk assessments and enhances the display of disease data in forecasts. Adjusted risk thresholds for better handling of low scores from the engine.
**GH-186** Fix turf cover calculation in plan-ui.js: Updated the logic to prioritize turf.c3Cover over turf.percentC3Cover when available, ensuring more accurate representation of C3 cover in calculations.
**GH-187** Refactor C3 cover calculation logic in plan-ui.js: Enhanced the handling of turf cover values by introducing checks for species type and adjusting the calculation of C3 fraction based on species classification. This improves accuracy in turf cover representation.
**GH-188** Implement FRAC group detection and residual protection calculation in data view: Added functions to detect FRAC groups based on active ingredients and product names, and to compute residual protection percentages based on application dates. Enhanced the data view to display FRAC group and residual protection metrics, improving the accuracy and usability of the spray log data.
**GH-189** Enhance sensor data handling and mapping in hub-orchestrator and related scripts: Implemented direct access to Hydrosight data to bypass mapping checks, ensuring accurate soil temperature readings. Added event listeners for sensor updates to trigger re-computation of analysis when new data arrives. Improved caching and logging for Hydrosight data fetching, and updated UI to reflect accurate source labels for soil temperature. This enhances the reliability and responsiveness of the system in handling sensor data.
**GH-190** Refactor climate data handling in hub-orchestrator.js: Removed legacy temperature recovery logic and implemented direct computation of temperature metrics from rawWeatherData. This ensures consistent and accurate temperature readings across non-manual modes, enhancing the reliability of climate metrics. Updated logging for better traceability of temperature calculations.
**GH-191** Enhance soil temperature computation and logging in climate-module-v2-ui.js: Introduced detailed logging for soil moisture, temperature, and CEC/OM values to improve traceability. Updated soil temperature calculations to utilize computed soil moisture values, ensuring more accurate results. Added debug statements for better insight into soil temperature results and summaries, enhancing overall data reliability.
**GH-192** Refactor overseed species options in settings and related scripts: Removed 'Bermuda' from the warm-season overseed species list in settings.blade.php, gaip-whatif-ui.js, and settings-init.js to streamline options. 
**193** WIP - Update disease models and validation statuses: Changed Drechslera poae status to 'unvalidated' in bipolaris-curvularia-models.js, updated disease analysis to exclude unvalidated models from graphs, and added new CSS classes for unvalidated badges. Enhanced climate engine to ensure accurate site-switch handling and updated fungicide authorisation documentation for NZ compliance.
**GH-194** Enhance site handling and sample persistence: Updated SampleController to skip processing when no client UIDs are provided, ensuring efficient data management. Improved SiteController to validate site IDs and reject auto-generated site names. Enhanced hub-persistence.js and sample-persistence.js to correctly manage active site restoration during imports, ensuring accurate sample data handling across site switches. Added event listeners in sample-switcher-ui.js for dynamic sample selector updates on site changes.
**GH-195** Refactor turf methodology handling: Updated effectiveMethodology to prioritize saved methodology values over location-based defaults. Adjusted DashboardController, DataController, and ReportsController to utilize the new method for determining turf methodology. Enhanced settings view to ensure proper selection of methodology based on user input and location. Improved JavaScript handling for site changes to maintain methodology consistency.
**GH-196** Update climate recovery tests for improved accuracy: Refactored test cases in hub-orchestrator-climate-recovery.test.js to ensure proper handling of temperature recovery logic. Adjusted tests to verify that overrides run correctly in non-manual modes, utilize the full forecast window, and ensure global climate metrics are updated conditionally based on available data. Enhanced assertions for clarity and accuracy in recovery processes.
**GH-197** Enhance fungicide data structure and validation logic: Updated nz-fungicides.js to include component breakdown for multiple active ingredients and improved efficacy data for specific diseases. Added new functions for managing FRAC components and validating fungicide application sequences. Enhanced tests for mixture credit and consecutive limits to ensure accurate compliance with R2/R3 regulations.
**GH-198** Enhance fungicide product filtering: Added deduplication logic in au-fungicides.js to filter products by active ingredient, ensuring only the first occurrence is retained for improved efficacy representation.
**GH-199** Enhance disease analysis and recommendation rendering: Added CSS styles for product cards and risk badges in disease-analysis.js. Implemented a new function to render product cards based on active ingredients, improving the display of recommendations. Updated buildRecommendation function in disease-engine-pure.js to expose structured product actives for rendering. This enhances the user interface for displaying fungicide recommendations and improves data handling for active ingredients.
**GH-200** Enhance mixture credit rendering and data handling: Added CSS styles for the mixture credit section in disease-analysis.js, including new functions to format and render mixture credit information. Updated buildRecommendation in disease-engine-pure.js to attach mixture credit data for products with FRAC groups. Enhanced fungicide-filter.js with a new getMixtureCredit function to retrieve mixture credit from the database. Updated nz-fungicides.js to include partner activity and efficacy in the mixture credit data structure, improving the overall display and accuracy of fungicide recommendations.
**GH-201** Update Large Patch Model to reflect confidence adjustments and provenance: Introduced constants for confidence level and score, updated model instances to use these constants, and changed validation status to 'unvalidated'. Added detailed provenance notes regarding the weighted-sum equation and its sources.
**GH-202** Refactor leaf wetness calculation in disease-engine-pure.js: Removed daytime restriction for wet hours and applied a consistent 0.5 factor to align with dew path calculations, addressing discrepancies in overnight humidity impact on disease modeling.
**GH-203** WIP - Enhance sample management and data handling: Added sample management scripts for soil and water selectors in the Water Balance tab. Updated data handling in various scripts to ensure accurate retrieval and display of sample data, including fallback mechanisms for sample attributes. Improved user interface for sample selection with new dropdown components and styles, enhancing overall usability and data interaction.
**GH-204** Enhance sample analysis and water balance functionality: Updated SampleAnalysisController to include new parameters for pH, ECe, and soilNa. Added computeEce method for accurate ECe calculation based on various input formats. Improved data handling in water balance analysis scripts, including localStorage management for active water samples and inline status updates. Enhanced user interface for water sample selection with status indicators.
**GH-205** Refactor water balance analysis logic: Simplified soil water interaction checks by removing redundant variables and conditions. Enhanced pH and sodium interaction assessments with clearer impact descriptions and actions. Updated instructions for water chemistry results visibility in the analysis section, ensuring better user guidance and clarity.
**GH-206** Refactor water balance persistence and diagnostics: Updated salinity and diagnostics handling to account for water balance overrides, ensuring accurate data representation. Introduced a fallback mechanism for diagnostics in the water balance analysis, enhancing user guidance and clarity in the analysis section.
**GH-207** Refactor water balance analysis: Removed redundant functions and streamlined water quality diagnostics. Enhanced status handling for sodium hazard and adjusted SAR calculations, improving clarity and accuracy in data representation. Updated user interface elements for better interaction and guidance.
**GH-208** Refactor water balance analysis: Removed the source info display logic to streamline the user interface. This change enhances clarity by focusing on essential data representation without redundant information.
**GH-209** Refactor sample analysis and nutrient computation: Updated SampleAnalysisController to incorporate ammonium acetate methodology for nutrient classification. Enhanced computeNutrients function to differentiate between MLSN and AA methodologies, improving accuracy in nutrient status reporting. Adjusted user interface elements to reflect changes in nutrient thresholds and classifications, ensuring clearer data representation.
**GH-210** Fix GP calculation logic in dashboard-init.js: Updated growth potential calculations to use >= instead of > for more accurate percentage rounding. This change ensures correct display of GP values across the dashboard.
**GH-211** Enhance soil nutrition analysis: Added a check for ammonium acetate methodology in the renderCorrectionProgram function to prevent correction dose calculations for AA, ensuring accurate nutrient classification and improving data handling.
**GH-212** Standardize terminology: Updated instances of 'Sulfate' to 'Sulphate' across multiple files for consistency in naming conventions.
**GH-213** Enhance growth potential handling: Updated climate engine logic to correctly account for legitimate zero growth potential values, ensuring accurate data representation. Improved hub persistence logic to merge daily patterns without overwriting existing growth data, enhancing analysis accuracy. Updated instructions to clarify recent changes and added a link to analysis pages in the dashboard for better navigation.
**GH-214** Update sensors tab status handling: Changed the sensors tab badge to reflect real connection status instead of a static claim. Implemented a script to check for valid API keys and live data, updating the badge text accordingly to enhance user awareness of sensor connectivity.
**GH-215** Implement site label recovery: Added functionality to heal site labels stored in localStorage by retrieving the correct names from the topbar switcher. Updated site creation logic to ensure real names are used instead of internal keys, enhancing data accuracy and user experience.
**GH-216** Update sensor source population logic: Modified the populateSensorSource function to accept siteId as a parameter, ensuring accurate fetching of sensor data specific to the site. Added checks to prevent reliance on globally stored fetch timestamps, enhancing data integrity and connection status reporting.
**GH-217** Update growth potential calculation logic: Changed comparison operator in AccountController and AppServiceProvider to use >= instead of > for accurate growth potential evaluation. This ensures correct status mapping and improves data representation consistency.
**GH-218** Update dashboard source badge logic: Adjusted the calculation of the 'ok' sources to accurately reflect the total number of sources, including those that are 'never tested'. This change improves the display of source status on the dashboard, ensuring users receive a clearer representation of source health.
**GH-219** Fix dashboard source status logic: Updated the $ageClass() function to return 'warning' for untested sources, treating them as needing attention. This change ensures accurate counting of current and needing update sources, improving the dashboard's source health representation.
**GH-220** Enhance data handling for soil measurements: Updated input parsing logic to treat unmeasured values as null instead of zero, improving accuracy in nutrient analysis and validation. Added checks to prevent misinterpretation of untested samples in nutrient results. Updated site synchronization logic to prevent overwriting real site labels from hidden contexts, ensuring data integrity.
**GH-221** Update wear resistance card logic for sports fields: Modified the recovery/wear card to apply only to sports turf types, ensuring accurate data representation. Enhanced handling of wear data to display appropriate messages based on traffic data availability.
**GH-222** Refactor state restoration logic: Removed soil, water, and tissue data restoration from the state blob to prevent cross-site data contamination. Introduced a new event, 'gaip:site-samples-ready', to signal when the DOM forms reflect the currently active site, ensuring accurate analysis runs. Updated related functions to handle site switching more reliably and prevent stale data usage.
**GH-223** Fix daily DLI selection logic for api_daily source: Updated the ambient DLI engine to prioritize the entry matching today's date when available, ensuring accurate DLI readings. If today's data is absent, the logic now correctly falls back to the most recent entry instead of the oldest, addressing inconsistencies observed in production. Added tests to validate this behavior.
**GH-224** Refactor dashboard UI: Removed the applyBadge function and related logic for displaying disease and stress levels, streamlining the code for improved maintainability. This change focuses on enhancing the overall structure of the dashboard UI without altering its core functionality.
**GH-225** Update growth potential logic in word-export.js: Refined the calculation of growth potential for C3 and C4 species by prioritizing drought-adjusted species-weighted GP when available. This change enhances the accuracy of growth potential representation in overseed situations and ensures proper labeling based on species type.
**GH-226** Enhance dashboard analysis links: Added dynamic analysis links for various dashboard panels, improving user navigation to detailed analysis pages. Introduced new CSS styles for analysis link presentation, ensuring a consistent and visually appealing interface.
**GH-227** Update dashboard UI styles and improve report instructions: Modified CSS for the dashboard vitals grid to use minmax for better responsiveness. Enhanced report instructions with additional improvements and clarified backlog items for better tracking.
**GH-228** Refactor nutrition program persistence logic: Updated the integration scripts for various regions to utilize a unified method for retrieving the active site ID and persisting the generated nutrition program. This change ensures consistency across different modules and improves the reliability of data persistence during navigation and report generation.
**GH-229** Enhance nutrition calendar functionality: Added support for "Current Monthly N Rate" input, enabling persistence and retrieval of monthly nitrogen values. Updated site configuration logic to ensure accurate data handling for nutrition programs, including max N per month. Improved fallback mechanisms in report generation to utilize persisted values, enhancing overall reliability and user experience.
**GH-230** Implement distributor selection persistence: Added functionality to restore the last selected distributor on page load, ensuring consistent product pool visibility across sessions. Updated related logic in the nutrition integration and report generation scripts to reflect the selected distributor accurately. Enhanced site configuration handling for improved data persistence.
**GH-231** Add soil sample selection functionality: Introduced a dropdown for selecting soil samples on the plan page, enhancing user interaction with the nutrition program. Integrated the sample picker with existing scripts to ensure seamless data handling and persistence. Updated styles for better alignment with the UI and included necessary script imports for functionality.
**GH-232** Improve soil and nutrient data handling in integrations: Enhanced the nutrition integration scripts to ensure accurate soil data retrieval from GAIP_STATE, addressing issues with missing soil inputs on lightweight pages. Added instrumentation for better tracking of input snapshots before and after the recommender processes, improving debugging capabilities. Updated documentation to reflect changes in the backlog items related to nutrition program generation.
**GH-233** Refactor soil data handling in nutrition calendar and integration scripts: Improved the retrieval of existing soil values to include the entire soil object, ensuring accurate data persistence. Enhanced temperature retrieval logic to utilize cached climate data, aligning live previews with report outputs. Updated documentation to reflect these changes and improve overall data handling reliability.
**GH-234** Enhance plan UI with Pre-emergent card: Added a new KPI card for Pre-emergent status, displaying active alerts and aggregate status. Removed redundant Pre-emergent card logic to streamline the code. Updated documentation to reflect changes in the management plan page layout.
**GH-235** Add tissue sample zone matching functionality: Implemented a new method to build a zoneKey to sample mapping for tissue samples, ensuring accurate association with soil zones. Updated the site selector to clear the tissue form when no sample is present, enhancing user experience. Improved documentation to reflect these changes and clarify functionality related to tissue and soil sample interactions.
**GH-236** Enhance disease forecasting by integrating cached species resolution and stress/climate coupling: Added new scripts for disease-stress-climate coupling and red thread model to improve forecast accuracy. Updated disease analysis and forecast logic to prioritize cached species and apply stress adjustments, ensuring Day 0 remains aligned with Active Threats. Introduced tests to validate these enhancements and ensure reliable functionality.
**GH-237** Enhance disease forecasting by integrating red thread model: Added script inclusion for red-thread-model.js in analysis.blade.php to ensure accurate daily forecasts. Updated disease analysis logic to handle missing humidity data for Red Thread, preventing flat-lined scores. Introduced tests to validate the loading of the red thread model and its impact on forecast accuracy.
**GH-238** Update maximum diseases displayed in forecast chart from 4 to 5 for improved visibility.
**GH-239** Exclude Fusarium from dashboard metrics and disease analysis: Implemented filtering to remove Fusarium from various dashboard components, including the forecast metrics, active threats list, and companion disease surfaces. Updated relevant functions across multiple files to ensure Fusarium is not displayed while retaining its underlying data for reporting purposes. Added tests to validate the exclusion and ensure functionality aligns with client requirements.
**GH-240** Implement unified disease forecasting: Consolidated disease forecast computation into hub-orchestrator.js, ensuring a single canonical forecast is generated and persisted. Updated disease-analysis.js to read from this unified forecast, eliminating redundant calculations and improving accuracy. Enhanced tests to validate the new forecasting logic and ensure consistent behavior across components.
**GH-241** Refactor risk level classification in dashboard: Updated risk level thresholds to a 4-tier system (SEVERE, HIGH, MODERATE, LOW) for improved accuracy. Adjusted CSS for better label display and responsiveness, including a new long-label class for wider text. Enhanced dashboard UI elements to accommodate changes in risk level presentation.
**GH-241**: Refactor disease risk display and improve dashboard UI: Updated the disease risk calculation to clearly differentiate between current and forecasted values, enhancing clarity in the dashboard. Adjusted CSS styles for alert messages to ensure consistency with other UI elements. Added tests to validate the new risk computation logic and ensure accurate display of disease threats.
**GH-242** Enhance dashboard disease risk calculations and irrigation metrics: Updated disease risk logic to filter out beta validation status and Fusarium, adjusting risk thresholds for alerts. Improved irrigation deficit handling by utilizing accurate metrics for scheduling irrigation actions. Added detailed comments for clarity on data handling and logic flow.
**GH-243** Update fallback timing for site configuration and enhance comments for clarity: Adjusted the timeout for unblocking site configuration from 4500ms to 6000ms to ensure proper event firing. Improved comments to detail the rationale behind the timing and prevent potential regressions related to stale data during multi-site switching.
**GH-244** Enhance debugging output for disease-stress-climate coupling: Added detailed console logs in disease-stress-climate coupling and hub orchestrator files to track state and metrics during execution. Improved site configuration restoration logic to handle latitude and longitude more effectively, ensuring accurate location data is maintained across site switches. Updated comments for clarity on changes made.
**GH-245** Add GilbaClimateNormalsService (NASA POWER climatology → Open-Meteo fallback → null, never a fabricated latitude-band guess) as the real source for Monthly N Distribution / Monthly Schedule / Nutrition Program, replacing two prior fallbacks that fabricated a regional profile whenever real data wasn't wired up (Hoxton audit D01-D03). Follow-up 2: pre-resolve climate normals per-site (not just the active one) before combined multi-site export. Follow-up 3: distinguish *why* climate data is unavailable in export disclaimers and logs — no coordinates configured for the site, the climate service/fetch not having resolved yet, or NASA POWER + Open-Meteo genuinely both failing — instead of one generic message for all three; also fixed combined export's Monthly Schedule using the last-active site's climate data for every sample instead of each sample's own.
**GH-246** Stop GilbaClimateNormalsService from auto-fetching NASA POWER/Open-Meteo climate normals on every Plan page load — nothing rendered there on load actually needs it (the saved Nutrition Calendar program renders from a persisted program, the Seasonal N card reads a separate analysis cache). Added an opt-out flag (`GAIP_CLIMATE_NORMALS_SKIP_AUTOTRIGGER`, set on Plan only) and made "Generate Nutrition Program" fetch climate normals itself on demand via `ensureFromPage()`, with a busy state on the button while it resolves.
**GH-247** Fixed combined multi-site Word export rendering only one site's Monthly N Distribution table instead of one per site — the code picked the first sample with monthly-N data across the whole facility's pooled sample list instead of grouping by site first. Now groups by `siteLabel` (same pattern as the adjacent Fertiliser Purchasing Summary rollup) and renders one table per site, each labelled with its site name when the export spans more than one site.
**GH-248** Fixed two C3/C4 growth-potential misclassification bugs found for pure (non-overseed) single-species sites: nutrition-calendar.js's `isC4Species()` used stale keys (`zoysiagrass`/`buffalo`) that no longer matched `normalizeSpecies()`'s actual output (`zoysia`/`buffalograss`), silently computing pure Zoysia and Buffalograss sites with the C3 GP curve instead of C4 in the live Monthly Nutrient Program; hub-tissue-v3.js's "Current Growth Conditions" GP species check only recognised bent/rye/fescue as C3 and defaulted everything else (including Kentucky Bluegrass, Annual Bluegrass/Poa annua, and a missing species name) to C4. Fixed the former's key list and made the latter delegate to the canonical `SpeciesController.isC4Species()`, with the old check kept only as a defensive fallback. Added `tests/gh248-c4-species-classification.test.js` (21 tests) covering the canonical classifier, the nutrition-calendar round-trip, and a source-pattern regression pin for the hub-tissue-v3.js fix.
**GH-249** Fixed the "Growth & Temperature" panel's TODAY tile showing a growth-potential value computed from a different (current-hour) temperature than the daily-mean temperature label displayed right next to it, while every other day in the 8-day strip was internally consistent (temp label and GP both daily-mean based). Root cause: GH-183 (2026-07-14) deliberately renamed "Current Growth Potential" to "Today's Growth Potential" and moved it to the daily mean, citing the PACE agronomy model ("GP is a daily metric, must use the daily mean, not the current-hour temperature") — but GH-223 (2026-07-28), while fixing an unrelated DLI bug, bundled in a change to `hub-persistence.js` that pinned `dailyPattern[0]` back to a current-hour-based value, undoing GH-183 for "today" only. The pin's own justification was based on a mistaken premise (that `dailyPattern[0]` was built from a fragile global read) — traced `calculateGrowthMetrics()` (climate-engine.js) and confirmed `dailyPattern` is built entirely from the same `_dailyRows` array for all 8 days uniformly; the pinned field was never actually at risk. Removed the pin. Added `tests/gh249-daily-pattern-today-no-current-hour-pin.test.js` (8 tests): source-pattern regression guard against the pin reappearing, plus direct tests proving `calculateGrowthMetrics()`'s `dailyPattern[0]` is independent of its `todayMean` argument.
**GH-250** Added a "This Month's Normal GP" reference row to the Growth & Temperature panel (`/analysis`), under "8-Day Average GP" — shows the current month's Growth Potential computed from the site's 20-year NASA POWER climate normal (GH-245), so users can see live weather (Today's GP / 8-Day Average) alongside the long-term seasonal baseline instead of the two disagreeing with no explanation (prompted by a client-facing example: 34% today vs. 6% for August's normal at a Christchurch site — both individually correct, per docs items 80a/244, but confusing shown alone). `hub-persistence.js`'s `cacheAnalysisResults()` computes it once per Re-run from `climateMetrics.monthlyTemps[currentMonth]` via the existing `calculateWeightedGrowth()` (same function `dailyPattern` entries use, not a new formula) and persists it as `computed.climate.growth.monthlyNormal`; `growth-light-analysis.js` renders it as a third `.gl-gp-row` (same visual pattern as the 8-day row, no day-tile strip), omitted entirely when the climate normal hasn't resolved yet. Added `tests/gh250-monthly-normal-gp.test.js` (15 tests).
**GH-251** Fixed `monthlyNormal` (GH-250) coming back `undefined` on every Re-run in production — confirmed via `window.GAIP_DASHBOARD_DATA.computed.climate.growth.monthlyNormal` on `/analysis`. Root cause: `climateMetrics.monthlyTemps` is resolved fire-and-forget by `GilbaClimateNormalsService` alongside the live weather fetch, but the Re-run flow's fast-path timer fires 3s after `gaip:weather-ready`/`gaip:orchestrator-complete` — events that mark the *start* of that fetch, not its completion — so `cacheAnalysisResults()` usually ran before the NASA POWER/Open-Meteo round-trip finished. `_doRerunSync()` (`hub-persistence.js`) now awaits a bounded (4s, via `Promise.race`) `GilbaClimateNormalsService.ensureFromPage()` before building the cache. Bounded rather than a bare await because that fetch chain has no timeout of its own — an unbounded wait could stall the entire Re-run (not just this one field) on a slow/hanging request. `cacheAnalysisResults()` itself stays synchronous and unchanged; only `_doRerunSync` (fire-and-forget from setTimeout, so safe to make `async`) is affected — its two sibling callers (`GilbaPersistence.save()`'s autosave, the `gaip:sensor-upgrade-complete` re-sync) are untouched. Added `tests/gh251-rerun-waits-for-monthly-normals.test.js` (9 tests).
**GH-252** Fixed `monthlyNormal` (GH-250) still not rendering on `/analysis` even after GH-251 confirmed the data resolves correctly (diagnostic logging added and then removed during investigation showed `climateMetrics.monthlyTemps` present with `source: 'nasa-power'` right before `cacheAnalysisResults()` ran). Real root cause: `buildClimateView()` (`growth-light-analysis.js`) rebuilds the `growth` object it hands to `renderGrowthBlock()` from an explicit field list (`c3`/`c4`/`weighted`/`status`/`dailyPattern`/`gdd`) instead of spreading the source object — `monthlyNormal` wasn't in that list, so it was silently dropped between `computed.climate.growth` (where GH-250's code correctly puts it) and the renderer, even though the sibling `dailyPattern` field survives fine because it *is* named. Added `monthlyNormal: growth.monthlyNormal || null` to the list. Added a regression test to `tests/gh250-monthly-normal-gp.test.js` pinning that this object literal includes `monthlyNormal`.
**GH-253** Fixed the Reports > Export page (`/reports/export`) recommending products from the wrong distributor catalogue in the Word export (Hoxton audit D30, live production defect on the Prebbles NZ account) — the on-screen Nutrition Program correctly filtered to the Prebbles NZ catalogue while the Word export recommended AU-catalogue products for the same site and session. Root cause: `ReportsController::pageData()`'s `$savedLocation` (which feeds the `.gaip-lat`/`.gaip-lon` inputs that `RegionalProfiles.detectRegionFromHub()` reads to decide the NZ vs AU product catalogue in `word-export-combined.js`) preferred the `gaip` site-config namespace's `location` blob over the site's own `latitude`/`longitude` columns — the opposite precedence from `PageController` and `AnalysisController`'s `$savedLocation`, which read the site record directly. So whenever the two copies disagree — for any reason; every currently-reachable write path (the Settings location form, Settings' "Import from old portal") writes both together via `Promise.all`, so this needs either a partial failure of one of those two parallel requests or an out-of-band data change (e.g. direct DB edit) to occur, not a normal user action — Plan and Analysis would read the correct, current coordinates while Export kept resolving the stale copy, failed NZ detection, and silently fell through to the AU recommender. Changed `ReportsController::pageData()` to read `$activeSite->latitude/longitude/location_name` directly, matching the sibling controllers, so Export trusts the same source as Plan/Analysis regardless of how or why the two copies diverged. Not addressed here: `word-export-combined.js` resolves `_isNZ`/distributor once globally per export rather than per site, so a combined multi-site export spanning both NZ and AU sites would still apply one catalogue to all of them — flagged as a separate follow-up, not evidenced by the reported defect (single-site Hoxton export). Discussed with the client and deliberately left as-is: most exports are single-site.
**GH-255** Fixed the Word export's Monthly Schedule table silently dropping a month's real product application whenever that month also carried a `coveredBy` carry-forward note (a slow-release granular from an earlier month still active) — e.g. Hoxton test data where March/April/October each had both "Covered by MAP Tech (Feb)" *and* their own liquid application (Pro Balance, Lo Biuret Urea), but the export printed only the carry-forward note and dropped the liquid product from that row entirely, even though it was still counted correctly in the Annual Product Summary totals (confirming the two tables read from different parts of the same data, not a shared/reused figure). Root cause: `renderNutritionProgramSection()` (`word-export.js:6104-6111`, shared by both single-site and combined exports via `buildSections()`) built an `if (m.coveredBy) {...} else if (products.length > 0) {...}` branch that treated the two as mutually exclusive, discarding the already-correctly-built `products` list (granular + liquid) whenever `coveredBy` was set. The on-screen UI (`nutrition-prebble-integration.js`) never had this bug — it renders granular and liquid in separate, independent columns, so a carry-forward note and a fresh liquid application always showed together. Confirmed present identically in the old hub's `word-export.js` (same `if/else`, byte-for-byte) — not a porting regression, a pre-existing bug carried over unchanged. Per client confirmation (export should match what the UI shows), an initial fix concatenated everything into the one existing column, but that still read ambiguously — e.g. a month showing both a fresh "Ammos 22 @ 30 L/ha" liquid application and "Covered by Ammos 22 (May)" in the same sentence looked self-contradictory. Replaced the single "Product Recommendations" column with three columns matching the UI's actual layout: **Granular Products** (carries the coveredBy note too, since it's always about the granular side — a month with an active carry-forward and no new granular of its own prints just the note; italic/grey only in that product-less case), **Liquid / Foliar**, and **Notes** (`m.notes.join('. ')` — previously dropped from this table entirely, e.g. "Low GP (17%) - winter program: MESA + liquid foliar..."). The Notes column in particular tends to carry multi-sentence agronomic notes ("Low GP (14%) - winter program: MESA + liquid foliar - consider reducing rates or skipping application"), which wrapped to 5+ lines at the original narrow width and made the table run long across many pages — widened the table from 7500 to 9600 DXA total (page usable width is 9746 DXA: A4 at 11906 DXA minus 1080 DXA margins each side, per the `sections[0].properties.page` config), column widths 1100/700/2400/2000/3400, most of the extra going to Notes so it wraps to fewer lines and the table takes fewer pages.
**GH-256** Fixed a Prebbles NZ nutrition-program note claiming a product that wasn't actually applied. `prebbles-products.js`'s low-GP winter branch (`generateProgram()`) pushed a hardcoded `'winter program: MESA + liquid foliar'` note regardless of what the branch's own selection logic picked (Ammos/Nitro if available, otherwise any liquid with N% >= 15, otherwise nothing — "MESA" was never actually a candidate), and — worse — the `notes.push()` call sat outside the `if (ammos)` block, so the note fired even when no liquid product was found at all, claiming a foliar application that never happened (screenshot evidence: May row showed "Ammos 22 (Nitro 22) @ 30 L/ha" applied while the note said "MESA + liquid foliar"). Moved the note inside `if (ammos)` and changed it to name the actual selected product (`${liquidProduct.name}`), with an honest `else` branch ("no suitable liquid nitrogen source available") when nothing was found. Audited every `.notes.push()` call in both `prebbles-products.js` (11) and `au-fertiliser-products.js` (8) for the same class of bug (hardcoded product/brand name that could diverge from what was actually selected) — found one more, lower-risk instance: a sibling low-GP branch (`generateProgram()`, covered-month path) hardcoded `'Ammos 22 foliar supplement'`, which happened to always be accurate today (that branch's search only ever matches Ammos/Nitro-named products) but wasn't future-proof against a catalogue change; changed to `${ammos.name}` to match the established safe pattern already used elsewhere in the file (e.g. the `N balance: ${ammos.name} @ ...` note). The other 17 notes across both files were already either product-name-free (generic advisory text) or already used the selected product's own name/values — no further changes needed.




## Backlog

234. the UI species is not propagating to the threshold layer, which is keying off the lab sample-type string. Sample type is “TURF Ryegrass, Sand (S277)”; the Phytotoxicity section is explicitly rated “for Perennial Ryegrass (moderate sensitivity)”. Browntop is more salt- and B-sensitive than ryegrass, so those thresholds are too lenient.
235. Green 13’s Ca deficit is being silently dropped. Status reads “Suppressed (dolomite covers)” for a 336 kg/ha Ca deficit, but Green 13 has no dolomite anywhere in its product summary, monthly schedule, or the purchasing summary. The Mg branch declined to fire (0.2 kg deficit, “Monitor”), so the Ca suppression is referencing a sibling recommendation that never ran.
237. Gate all Mulder’s antagonism flags on absolute level: no antagonism call unless the numerator nutrient is at or above its own sufficiency threshold.
238. The report projects dispersion, infiltration loss in 6-12 months, and gypsum at 2-4 t/ha. Measured soil Na is 12 ppm = 0.052 me/100g = ESP 1.3%, against your own glossary’s 6% sodic threshold. On a CEC-4 sand there is no clay to disperse. Add a gate: cross-check measured soil Na/ESP before issuing any dispersion warning, and suppress the structural narrative on sand rootzones.
239. EC is called too high and too low in the same report. “EC 1.20 dS/m is in the marginal range” (salinity concern) and “elevated SAR with relatively low EC (1.2)” (dispersion concern). The SAR 3-6 / EC >1.2 cell is “no restriction on infiltration”.
240. Trace values are identical across all three greens (Fe 120, Mn 23, Zn 2, Cu 0.5, B 1, S 25, Na 12, OM 4.6, EC 0.12).
241. The Zone Comparison legend and Zone Issues Summary are written entirely in MLSN language (“below MLSN minimum”) while the body spends three pages, three times, explaining that MLSN cannot be applied to this data
242. source the AA ranges to Hill Labs not Turner & Hummel 1992
243. Nutrient Trend Analysis: green 18” appears inside Green 1’s block, three lines after Green 1 is declared to have no trend history. Green 18’s own block has no trend section. Zone bleed.
244. Growth potential errors. Monthly Schedule: Jan 24%, Mar 98%, Jul 0%, Nov 98%. Monthly N Distribution: Jan 66%, Mar 94%, Jul 19%, Nov 98%. Climate box: 9% at 7.0°C. None reproduce a standard PACE C3 curve for Christchurch. At Jan mean 17.4°C, exp(−0.5((T−20)/5.5)²) gives 89%; at Jul 6.0°C, 4%; at 7.0°C, 6% (the box’s 9% implies sd = 6.0). Jan at 24% for Christchurch is a hemisphere or optimum-temperature fault.
245. - md file
246. pc version. why is ammos 22 (nitro 22) and Ammos 22 (Nitro 22) (Balance) two line entries? same product - docx file
247. no trend analysis in pc version
248 IMPORTANT - 4 files
1.⁠ ⁠Section 4.2 is the diagnostic that narrows the search. Comparing the two exports generated on 8 Aug, exactly two sample subtitles changed after the manual save, and they are exactly the two panels that were edited: the species flipped from “Browntop Bent (Greens)” to the raw enum “browntopBent”. So the save did reach the record the export reads. The species field updated and the measurements did not. That points at a partial write or a field-name mismatch between the write and read paths, not a cache. It rules out most of the obvious explanations before anyone opens a debugger.
2.	Boron is the only measurement field that agrees, in either panel. If field mapping is the fault, boron may be the one key that maps correctly on both paths, which would identify the rule immediately. Worth checking before anything else.
3.	Check 5.2 is the fastest disambiguation. Reload the page, reopen the form. If it shows 1.2 and 123 rather than 0.16 and 17, the write never landed and the UI was showing local state. If it shows the entered values, the write is fine and the export query is wrong. Different fault, different fix, and one page reload separates them.
249. uploaded a football ground Hoxton in Auckland (it’s made up) and added soil water and tissue test results. 1 file














D01 (устаревший климатический ряд в Monthly Schedule) — это отдельный, ещё не тронутый баг с тем же корнем, но другим механизмом (кэш, а не неверный приоритет чтения). Хотите, чтобы я взялся и за него следующим? 

I think after we change coordinates we need to show info on the panel - to rerun analisys







also if I generate new report and it wasnt generated with message that data is unavailable - old data program should be removed - as it is not relevant






# Long backlog
71. the areas be better in m2 and you can’t tell which green is which. Fairways they tend to use hectares and greens and tees m2. Football pitches m2.


60.⁠ ⁠soil temps are totally different. hydrosight 9.3/9.3/9.2/9 and gaip hub 7.9/7.8/7.7 and 7.5. i think there is an error with the gaip hub re air temperature which could explaiin some of these errors as mine says temperature is 8.4 and yours says 11.6C? - Found an issue in the new hub, fixed it (GH-191) but there is still a difference in soil temperatures. We can look at this after we fix everything for NZ if you are ok with it?


Integration with soil scout
this is the soilscout api  https://soilscouts.fi/api/v1/?format=openapi








# My changes:


Phytotoxicity добавляет новый расчёт в оркестратор, но пока им никто кроме задач не пользуется. 

Heat/Frost/Drought — единственное, что трогает уже используемый другими частями объект, но только путём добавления новых полей, не изменения существующих.

оба только в tasks block. Но с нюансом:

Phytotoxicity — чисто изолированно. Новое поле computed.phytotoxicity, которое сегодня никто не читает и после подключения будет читать только очередь задач. Ничего общего с другими карточками/расчётами.

Heat/Frost/Drought — эффект тоже только в tasks block, но реализация технически трогает общий объект computed.stress — тот же самый, который читает disease-stress-climate-coupling.js для корректировки риска болезней, и откуда берутся combinedGrowthModifier/environmentalStressIndex (влияют на Growth Potential и другие карточки). Я проверяла: coupling-движок реагирует только на конкретные типы (drought/shade/waterlogging/temperature), не на heat/frost — значит, если только добавлять новые поля и не трогать существующие расчёты, побочных эффектов не будет.

То есть по замыслу — да, оба только tasks block. Но у heat/frost/drought выше цена ошибки при реализации (общий объект с несколькими потребителями), поэтому в плане для него отдельно прописана проверка "до/после" на coupling — не потому что он ДОЛЖЕН что-то ещё затронуть, а чтобы гарантированно НЕ затронул.

All popups - should be with new UI (like in the settings when moving to another page/tab)

--
Check the algorithm in the old hub ... (/Users/katep/Documents/Work/gilba/gilbahub_previous)
Check what was implemented in the new hub (/Users/katep/Documents/Work/gilba/gilbahub)
Write a comparison

----
- also move branding settings to the settings page and make ui similar to what we have in the new hub

- Stress Index Analysis - add  i icons where needed (ion the KPI section and component breakdown)

- to add Self registration with approval

- Ограничить ключ (важно)-  Нажать на созданный ключ → Edit
В разделе Application restrictions → выбрать HTTP referrers (websites)
Добавить ваш домен: https://yourdomain.com/*
В разделе API restrictions → Restrict key → выбрать только Places API
Save

- Auto re-run - setup minutes or hours - how often to rerun

- Task management

- Soil temperature take from sensor ? 
 
- MOBILE VERSION

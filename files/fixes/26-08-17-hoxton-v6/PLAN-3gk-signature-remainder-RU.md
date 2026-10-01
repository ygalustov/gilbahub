# Остаток пункта 3гк: подписи в коде, несущие имя пункта

Снято ревьюером 01.10.2026, только чтение. Это ВХОД сторожа: он ловит новое, остаток не чинится — решение координатора, как со сторожем кириллицы.

**Число подписей за ночь выросло:** вчера в том же замере было 522, сейчас 558. Прибавка — подписи пункта 9 (`queue item 9`, 66 мест), поставленные уже ПОСЛЕ того, как правило было принято. Это и есть замер того, чем правило заполняется: оно нарушается не единожды, а пакетом, потому что подпись копируется из соседней строки.

## Числа

- подписей всего: **558** (перепроверено вторым независимым счётом; первый дал 553–554, разница от набора расширений в фильтре — беру большее)
- различных имён пунктов: **57**
- файлов: **225**

## Девять подписей, которые врут СЕГОДНЯ, а не потенциально

У этих имён существуют оба пункта, поэтому `grep` из кода ведёт в чужой план уже сейчас.

| имя | номер в подписи | адрес | чем читается двояко |
|---|---|---|---|
| `3vc` | GH-781 | `assets/hub-tissue-v3.js:1180` | 3вц = GH-780 / 3вч = GH-778 |
| `3e` | GH-733 | `assets/settings-init.js:895` | 3е = GH-720 / 3э = GH-733 |
| `3vsh` | GH-781 | `assets/hub-orchestrator.js:1450` | 3вш = GH-781 / 3вщ = GH-783 |
| `3bu` | GH-744 | `assets/calculation-inputs.schema.json:389` | 3бу = GH-730 / 3бю = GH-744 |
| `3vc` | GH-780 | `assets/calculation-inputs.schema.json:988` | 3вц = GH-780 / 3вч = GH-778 |
| `3bu` | GH-744 | `app/app/Support/CalculationInputs.php:567` | 3бу = GH-730 / 3бю = GH-744 |
| `3vc` | GH-780 | `tests/gh676-the-graph-and-the-code-and-the-list.test.js:780` | 3вц = GH-780 / 3вч = GH-778 |
| `3e` | GH-720 | `tests/gh720-the-frame-hears-a-site-change.test.js:2` | 3е = GH-720 / 3э = GH-733 |
| `3e` | GH-733 | `tests/gh733-an-empty-field-gives-no-key.test.js:2` | 3е = GH-720 / 3э = GH-733 |

## Остальные — потенциальные: имя однозначно сегодня

| имя | подписей |
|---|---|
| `4` | 101 |
| `7` | 86 |
| `9` | 63 |
| `3vy` | 47 |
| `3gg` | 22 |
| `3az` | 19 |
| `3ga` | 19 |
| `6` | 14 |
| `3bl` | 13 |
| `3gd` | 13 |
| `3bz` | 11 |
| `19` | 7 |
| `3ad` | 7 |
| `3gp` | 7 |
| `3ay` | 6 |
| `3bt` | 6 |
| `3vshch` | 6 |
| `3x` | 6 |
| `3vm` | 6 |
| `3ag` | 5 |
| `3azh` | 5 |
| `3ah` | 5 |
| `3as` | 5 |
| `3vs` | 5 |
| `3shch` | 5 |
| `6a` | 4 |
| `3bo` | 4 |
| `17` | 4 |
| `3vt` | 3 |
| `3ao` | 3 |
| `3ch` | 3 |
| `3vn` | 3 |
| `3bs` | 3 |
| `3ak` | 2 |
| `3aa` | 2 |
| `3al` | 2 |
| `3vd` | 2 |
| `3ts` | 2 |
| `3au` | 2 |
| `3vg` | 2 |
| `3r` | 2 |
| `3bm` | 2 |
| `3bg` | 1 |
| `3ar` | 1 |
| `3at` | 1 |
| `3bh` | 1 |
| `3vl` | 1 |
| `3vzh` | 1 |
| `3u` | 1 |
| `3g` | 1 |
| `3ap` | 1 |
| `3bshch` | 1 |
| `3yu` | 1 |

## По файлам

| файл | подписей |
|---|---|
| `assets/hub-tissue-v3.js` | 39 |
| `assets/hub-orchestrator.js` | 25 |
| `assets/calculation-inputs.schema.json` | 20 |
| `app/app/Support/CalculationInputs.php` | 18 |
| `tests/gh676-the-graph-and-the-code-and-the-list.test.js` | 16 |
| `assets/onboarding-wizard.js` | 12 |
| `app/app/Support/AnalysisNotice.php` | 12 |
| `tests/fixtures/gh678-unresolved-executors.json` | 12 |
| `assets/hub-persistence.js` | 11 |
| `app/app/Http/Controllers/SiteController.php` | 10 |
| `assets/settings-init.js` | 9 |
| `app/tests/Feature/Gh675TheClassComesFromTheStartNotFromTheDatabaseNowTest.php` | 9 |
| `assets/dependency-graph.json` | 8 |
| `assets/plan-ui.js` | 8 |
| `tests/gh618-absence-survives-the-converter.test.js` | 8 |
| `tests/gh630-the-wizard-sends-no-key-it-never-asked-for.test.js` | 8 |
| `assets/nutrition-program-inputs.js` | 7 |
| `tests/gh584-the-universe-covers-the-whole-graph.test.js` | 7 |
| `app/app/Support/AnalysisResults.php` | 6 |
| `assets/cascade-orchestrator.js` | 5 |
| `app/app/Support/RunStart.php` | 5 |
| `app/app/Http/Controllers/AnalysisCacheController.php` | 5 |
| `app/resources/views/settings.blade.php` | 5 |
| `app/tests/Feature/Gh777TheStorageOfEveryInputIsDeclaredTest.php` | 5 |
| `tests/gh776-no-schedule-is-no-wear-load.test.js` | 5 |
| `tests/gh757-what-settings-writes-is-what-the-run-reads.test.js` | 5 |
| `tests/gh644-the-list-and-the-engines-agree.test.js` | 5 |
| `assets/word-export.js` | 4 |
| `app/tests/Feature/Gh684TheServerDecidesWhenTheWizardOpensTest.php` | 4 |
| `tests/fixtures/gh719-wear-block-census.json` | 4 |
| `tests/gh790-the-run-reads-the-site-not-the-page.test.js` | 4 |
| `assets/dashboard-ui.js` | 3 |
| `assets/wear-recovery-integration.js` | 3 |
| `assets/shade-engine-pure.js` | 3 |
| `assets/wear-recovery-engine-pure.js` | 3 |
| `assets/nutrition-summary-integration.js` | 3 |
| `app/tests/Feature/Gh789TheFormAsksByTheListTest.php` | 3 |
| `app/tests/Feature/GH439SiteConfigPatchTest.php` | 3 |
| `app/tests/TestCase.php` | 3 |
| `tests/gh692-what-a-node-cannot-compute-without.test.js` | 3 |
| `tests/gh781-every-journal-writer-is-met-or-declared.test.js` | 3 |
| `tests/lib/orchestrator-bench.js` | 3 |
| `tests/gh733-an-empty-field-gives-no-key.test.js` | 3 |
| `tests/e2e/gh727-the-weed-set-on-the-stand-live.test.js` | 3 |
| `tests/helpers/mlsn-engine-harness.js` | 3 |
| `assets/analysis-result.schema.json` | 2 |
| `assets/overseed-climate-integration.js` | 2 |
| `assets/pre-emergent-engine.js` | 2 |
| `assets/site-dashboard.js` | 2 |
| `assets/growth-light-analysis.js` | 2 |
| `assets/auto-refresh.js` | 2 |
| `assets/shade-nutrition-integration.js` | 2 |
| `app/app/Http/Middleware/EnsureSiteIsSetUp.php` | 2 |
| `app/app/Http/Controllers/DashboardController.php` | 2 |
| `app/app/Http/Controllers/SampleAnalysisController.php` | 2 |
| `app/tests/Unit/Gh752TheServerGradesASampleAsTheEngineDoesTest.php` | 2 |
| `app/tests/Feature/Gh570WhatThePanelSaysOnTheLiveRowsTest.php` | 2 |
| `app/tests/Feature/Gh629WizardSubCategoryPatchTest.php` | 2 |
| `app/tests/Feature/Gh546AnalysisResultsOwnerTest.php` | 2 |
| `app/tests/Feature/Gh583CultivarAndConstructionAreRequiredTest.php` | 2 |
| `tests/gh746-a-guard-compares-the-list-not-its-length.test.js` | 2 |
| `tests/gh559-where-the-soil-temperature-goes.test.js` | 2 |
| `tests/gh461-export-identity-dataflow.test.js` | 2 |
| `tests/gh752-the-slan-ranges-have-one-file.test.js` | 2 |
| `tests/gh678-the-graph-refuses-rather-than-answering-empty.test.js` | 2 |
| `tests/gh371-d01-coordinate-invalidation.test.js` | 2 |
| `tests/gh573-the-pass-declares-what-it-did-not-produce.test.js` | 2 |
| `tests/gh777-a-table-that-was-not-computed-is-read-as-absent.test.js` | 2 |
| `tests/gh752-the-run-takes-construction-and-methodology-from-the-site.test.js` | 2 |
| `tests/gh724-the-run-computes-on-the-named-sample.test.js` | 2 |
| `tests/gh752-the-server-grades-a-sample-as-the-engine-does.test.js` | 2 |
| `tests/lib/substitution-inventory.js` | 2 |
| `tests/fixtures/gh738-emptiness-map.json` | 2 |
| `tests/gh394-traffic-schedule-persisted-and-derived.test.js` | 2 |
| `tests/gh725-the-config-reads-of-the-run-are-declared.test.js` | 2 |
| `tests/gh578-the-pass-waits-for-the-soil-with-a-limit.test.js` | 2 |
| `tests/gh656-each-construction-resolves-into-its-consumers-table.test.js` | 2 |
| `tests/gh777-what-does-not-apply-is-recorded.test.js` | 2 |
| `tests/gh782-the-aa-ranges-come-from-the-sites-species.test.js` | 2 |
| `assets/disease-forecast.js` | 1 |
| `assets/confidence-ui-integration.js` | 1 |
| `assets/disease-engine-pure.js` | 1 |
| `assets/site-switch-cleanup.js` | 1 |
| `assets/site-data-transfer.js` | 1 |
| `assets/soil-temp-logger.js` | 1 |
| `assets/site-config-persistence.js` | 1 |
| `assets/climate-module-v2-ui.js` | 1 |
| `assets/hill-labs-sample-types.js` | 1 |
| `assets/dependency-graph.js` | 1 |
| `assets/soil-nutrition-analysis.js` | 1 |
| `assets/nutrition-calendar.js` | 1 |
| `assets/word-export-combined.js` | 1 |
| `assets/hub-integration-patch.js` | 1 |
| `assets/input-range-validator.js` | 1 |
| `assets/large-patch-model.js` | 1 |
| `app/app/Support/SlanRanges.php` | 1 |
| `app/app/Support/AnalysisResultSchema.php` | 1 |
| `app/app/Support/AaRanges.php` | 1 |
| `app/app/Support/DependencyGraph.php` | 1 |
| `app/app/Support/PageSite.php` | 1 |
| `app/app/Http/Controllers/SprayLogController.php` | 1 |
| `app/app/Http/Controllers/AccountController.php` | 1 |
| `app/app/Http/Controllers/SettingsController.php` | 1 |
| `app/resources/views/stadium.blade.php` | 1 |
| `app/resources/views/layouts/db-shell.blade.php` | 1 |
| `app/tests/Unit/Gh716TreeFingerprintTest.php` | 1 |
| `app/tests/Support/TreeFingerprint.php` | 1 |
| `app/tests/fixtures/gh704-produced-predicate-inputs.json` | 1 |
| `app/tests/Feature/Gh667TheSoilSectionIsEmptyWhenItsVerdictSaysSoTest.php` | 1 |
| `app/tests/Feature/Gh771TheLastPgrIsAnsweredWithoutTheWindowTest.php` | 1 |
| `app/tests/Feature/Gh734TheReasonReachesTheSectionItIsAboutTest.php` | 1 |
| `app/tests/Feature/Gh729PredictionKeepsItsRunTest.php` | 1 |
| `app/tests/Feature/Gh548AnalysisNoticeTest.php` | 1 |
| `app/tests/Feature/Gh639SectionSentenceTest.php` | 1 |
| `app/tests/Feature/Gh724TheRunIsToldWhichTissueSampleTest.php` | 1 |
| `app/tests/Feature/Gh704TheServerCopyOfTheProducedPredicateTest.php` | 1 |
| `app/tests/Feature/Gh742TheMethodologyTravelsWithTheProjectionTest.php` | 1 |
| `app/tests/Feature/Gh752TheSoilInterpretationIsWrittenForTheSitesMethodologyTest.php` | 1 |
| `app/tests/Feature/Gh668WhoseConstructionTheFrameResolvesTest.php` | 1 |
| `app/tests/Feature/Gh581InputsAndAssumptionsReachTheResultTest.php` | 1 |
| `app/tests/Feature/Gh663TheFrameIsRenderedForTheSiteAskedForTest.php` | 1 |
| `app/tests/Feature/Gh786TheNitrogenTargetIsFoundInEitherStoreTest.php` | 1 |
| `app/tests/Feature/Gh666DoesTheSiteCheckLeakOtherAccountsTest.php` | 1 |
| `app/tests/Feature/Gh789NoughtIsAValueAndAnAbsentKeyIsNotTest.php` | 1 |
| `app/tests/Feature/Gh664TheConstructionIsResolvedOnceTest.php` | 1 |
| `app/tests/Feature/Gh708TheWizardLockHoldsEveryPageTest.php` | 1 |
| `app/tests/Feature/Gh777TheSentenceForAnEmptySectionTest.php` | 1 |
| `app/tests/Feature/Gh670WhatTheSiteCheckSaysAboutItselfTest.php` | 1 |
| `app/tests/Feature/Gh642TheOneListOfInputsTest.php` | 1 |
| `app/tests/Feature/Gh769ConstructionChoicesTest.php` | 1 |
| `app/tests/Feature/Gh588TheThreeSoilStatesTest.php` | 1 |
| `app/tests/Feature/Gh752TheServerReadsTheSlanRangesTest.php` | 1 |
| `app/tests/Feature/Gh752TheShellCarriesTheSitesConstructionTest.php` | 1 |
| `app/tests/Feature/Gh791TheFiveCasesDoNotDependOnTheWallClockTest.php` | 1 |
| `app/tests/Feature/Gh789TheServerRefusesByPlaceTest.php` | 1 |
| `app/tests/Feature/Gh688DependencyGraphRefusesTest.php` | 1 |
| `app/tests/Feature/Gh788TheJournalMarksReachTheRowTest.php` | 1 |
| `app/tests/bootstrap-tree-fingerprint.php` | 1 |
| `app/storage/framework/views/d32718ad9582f8fe8880faa317c1f5db.php` | 1 |
| `app/storage/framework/views/508775129c542d15a2aa9e60c41a1611.php` | 1 |
| `tests/gh555-why-the-engine-was-empty.test.js` | 1 |
| `tests/gh734-the-cleanup-list-and-the-globals-agree.test.js` | 1 |
| `tests/gh749-the-pairs-an-absent-reading-costs.test.js` | 1 |
| `tests/gh658-soil-temp-before-and-after-the-transfer.test.js` | 1 |
| `tests/gh589-the-pass-comes-after-the-inputs.test.js` | 1 |
| `tests/gh729-a-prediction-names-its-run.test.js` | 1 |
| `tests/gh727-the-weed-set-follows-the-site.test.js` | 1 |
| `tests/gh786-one-annual-nitrogen-figure-for-every-surface.test.js` | 1 |
| `tests/gh771-the-run-takes-the-pgr-from-the-log.test.js` | 1 |
| `tests/gh640-the-page-prints-what-the-server-said.test.js` | 1 |
| `tests/gh741-an-unset-summer-intent-stays-unset.test.js` | 1 |
| `tests/gh572-step-names-come-from-the-graph.test.js` | 1 |
| `tests/gh575-the-chain-from-the-sample-to-the-screen.test.js` | 1 |
| `tests/gh787-wear-is-computed-once.test.js` | 1 |
| `tests/gh674-two-censuses-of-a-substitution-coming-back.test.js` | 1 |
| `tests/gh681-the-cascade-list-comes-from-the-graph.test.js` | 1 |
| `tests/gh781-the-runners-own-facts-reach-the-row.test.js` | 1 |
| `tests/gh734-the-run-computes-the-soil-temperature.test.js` | 1 |
| `tests/gh735-the-manufactured-seven-on-the-water-page.test.js` | 1 |
| `tests/gh789-the-wizard-asks-a-sports-field-for-its-schedule.test.js` | 1 |
| `tests/gh763-the-declared-handles-of-two-nodes.test.js` | 1 |
| `tests/gh749-a-site-with-no-methodology-is-not-given-one.test.js` | 1 |
| `tests/gh704-three-copies-of-the-produced-predicate.test.js` | 1 |
| `tests/gh461-export-turf-keys.test.js` | 1 |
| `tests/gh461-export-inputs-provenance.test.js` | 1 |
| `tests/gh734-the-reader-receives-the-number.test.js` | 1 |
| `tests/gh719-the-wear-block-fields-and-their-readers.test.js` | 1 |
| `tests/gh251-rerun-waits-for-monthly-normals.test.js` | 1 |
| `tests/gh477-substitution-for-emptiness.test.js` | 1 |
| `tests/gh568-why-soil-and-nutrition-is-empty.test.js` | 1 |
| `tests/gh711-page-write-calls.test.js` | 1 |
| `tests/gh768-the-aa-ranges-have-one-file.test.js` | 1 |
| `tests/gh265-methodology-dom-priority.test.js` | 1 |
| `tests/gh547-runner-writes-once-on-completion.test.js` | 1 |
| `tests/gh262-sample-fallback-methodology.test.js` | 1 |
| `tests/gh744-the-wizard-names-the-methodology-from-the-list.test.js` | 1 |
| `tests/gh718-orchestrator-exports-by-the-stack.test.js` | 1 |
| `tests/gh615-organic-matter-comes-from-the-sample.test.js` | 1 |
| `tests/gh588-the-runner-is-told-about-the-soil-sample.test.js` | 1 |
| `tests/gh639-the-step-comes-from-the-graph.test.js` | 1 |
| `tests/gh667-three-copies-of-the-emptiness-predicate.test.js` | 1 |
| `tests/gh707-manufactured-zero-ions-reach-the-water-engine.test.js` | 1 |
| `tests/gh745-the-frame-invariant-by-behaviour.test.js` | 1 |
| `tests/gh731-each-door-keeps-a-measured-zero.test.js` | 1 |
| `tests/gh777-the-repeat-pass-follows-the-named-sample.test.js` | 1 |
| `tests/gh745-does-the-bench-reach-the-write.test.js` | 1 |
| `tests/gh620-both-signs-of-the-same-class.test.js` | 1 |
| `tests/gh669-the-changelog-is-in-order.test.js` | 1 |
| `tests/lib/tree-fingerprint.js` | 1 |
| `tests/lib/source-without-comments.js` | 1 |
| `tests/lib/runner-bench.js` | 1 |
| `tests/lib/wizard-sandbox.js` | 1 |
| `tests/lib/soil-page-site.js` | 1 |
| `tests/gh285-input-validator-methodology-typical-ranges.test.js` | 1 |
| `tests/fixtures/gh746-length-claims.json` | 1 |
| `tests/fixtures/gh711-page-write-calls.json` | 1 |
| `tests/gh260-mlsn-engine-aa-branch.test.js` | 1 |
| `tests/gh570-the-journal-record-carries-a-level.test.js` | 1 |
| `tests/gh783-growth-and-light-reads-the-row.test.js` | 1 |
| `tests/gh720-the-frame-hears-a-site-change.test.js` | 1 |
| `tests/gh752-the-soil-page-names-the-sites-methodology.test.js` | 1 |
| `tests/gh777-what-a-node-cannot-run-without.test.js` | 1 |
| `tests/gh722-the-settings-import-shows-what-the-file-came-to.test.js` | 1 |
| `tests/gh664-the-structure-pathway-comes-from-the-dictionary.test.js` | 1 |
| `tests/gh781-the-row-takes-the-accepted-pass.test.js` | 1 |
| `tests/e2e/gh768-aa-micronutrients-on-screen-live.test.js` | 1 |
| `tests/e2e/gh671-the-wizard-saves-a-sports-site-live.test.js` | 1 |
| `tests/e2e/gh787-wear-one-figure-on-the-stand-live.test.js` | 1 |
| `tests/e2e/gh771-the-pgr-the-run-is-given-live.test.js` | 1 |
| `tests/e2e/measure-gh707-what-the-scenarios-page-says-without-water-live.test.js` | 1 |
| `tests/e2e/gh782-the-aa-ranges-on-the-stand-live.test.js` | 1 |
| `tests/e2e/gh769-the-wizard-saves-the-construction-live.test.js` | 1 |
| `tests/e2e/gh789-the-zero-schedule-goes-in-by-the-product-live.test.js` | 1 |
| `tests/e2e/gh777-the-tissue-and-the-screen-live.test.js` | 1 |
| `tests/e2e/measure-gh769-the-server-answer-for-an-aa-site-live.test.js` | 1 |
| `tests/gh752-the-interpretations-take-the-sites-methodology.test.js` | 1 |
| `tests/gh738-the-emptiness-map-of-the-stored-row.test.js` | 1 |
| `tests/gh753-the-restore-stays-inside-its-own-site.test.js` | 1 |
| `tests/gh716-a-run-says-which-tree-it-saw.test.js` | 1 |
| `tests/gh788-a-guard-reads-code-not-prose.test.js` | 1 |
| `tests/gh471-sources-are-read-not-declared.test.js` | 1 |
| `tests/gh404-settings-requires-location.test.js` | 1 |

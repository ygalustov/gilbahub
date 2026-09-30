# План пункта 79 (`GH-NNN`): слова пустого раздела — у одного составителя, утверждённые

Аналитик — Аня, 29.09.2026, ночь. Строится на решении владельца 29.09: утверждены правки № 1, 2, 3, 4, 5, 7, 8, 11, 12, 13, 17, 22; № 9, 10, 15, 18, 19, 21 не меняются; № 14, 16, 20 — «по записанной причине, после пункта 4». Пункт 4 закрыт 29.09 (`GH-777`), условие выполнено.

Снято чтением. Кода не писала, прогонов не было.

`md5`:
- `AnalysisNotice.php` — `46cb7755…`;
- `soil-nutrition-analysis.js` — `91848daa…`;
- `water-balance-analysis.js` — `7b233cde…`;
- `stress-analysis.js` — `b1437471…`;
- `disease-analysis.js` — `0752de91…`;
- `growth-light-analysis.js` — `6dabb9cc…`;
- `plan-ui.js` — `73266c36…`;
- `dashboard-init.js` — `794b15c1…`.

**Сверено с деревом 30.09.2026, после GH-778, GH-779 и правок 3вц:** все восемь файлов с прежними `md5`, адреса на месте. `pgr-irrigation-analysis.js:139` — тоже на месте, хотя файл 3вц менял.

## СВЕРКА С ДЕРЕВОМ 30.09, НОЧЬ — перед работой

`md5`:
- **без изменений** — `soil-nutrition-analysis.js` `91848daa…`, `water-balance-analysis.js` `7b233cde…`, `stress-analysis.js` `b1437471…`, `disease-analysis.js` `0752de91…`, `dashboard-init.js` `794b15c1…`;
- **изменились** — `growth-light-analysis.js` `3386ac65…` (3вщ), `plan-ui.js` `a95dabfb…` (3гг, 3вы, пункт 7), `AnalysisNotice.php` `01d84a61…`.

Номер строки — «около», якорь — сама фраза.

**Адреса мест таблицы ниже, сейчас:**

| № | было | сейчас |
|---|---|---|
| 1 | `soil-nutrition-analysis.js:1475–1479` | `:1477-1478` |
| 2 | `:737` | `:737` |
| 3 | `:1044` | `:1044` |
| 4 | `:1369` | `:1369-1370` |
| 5 | `water-balance-analysis.js:1070–1071` | тот же |
| 7 | `stress-analysis.js:516` | `:516-517` |
| 8 | `disease-analysis.js:1146` | тот же |
| 11 | `growth-light-analysis.js:995` | `:1024` |
| 12 | `growth-light-analysis.js:1787` | `:1835` |
| 13 | `plan-ui.js:184–186` + шаг `:259` | `WAS_PRINTED_BEFORE` (с `:189`), pre-emergent `:201-202`, шаг `:276` |
| 14 | `WAS_PRINTED_BEFORE.pgr` | `:211-212` |
| 16 | `plan-ui.js:696` | `:769` |
| 17 | `plan-ui.js:734` | `:807` |
| 22 | `dashboard-init.js:1122` | тот же |

Составитель и соседи:
- `sectionText` — `AnalysisNotice.php:890`;
- `UNWORDED` — `:856-888` (было `:823–855`);
- «No analysis has been run for this site yet.» — `:1060` (было `:1009`);
- `serverSection` на `/plan` — `plan-ui.js:236` (было `:219–225`);
- зеркало трафика на `/plan` — `plan-ui.js:571` (было `:554`); его снимает пункт 9, он раньше в очереди.

**Признаки — объявлены заново, числом, по дереву сейчас:**
- **все 21 фраза переписи `Q79-emptiness-texts-census-RU.md` на месте.** Проверено поиском каждой фразы; сдвинулись только строки в `plan-ui.js` и `growth-light-analysis.js`. Три фразы `/plan` (PGR — тело, трафик — тело, износ — прогноз) стоят в коде со ссылкой `<a>` внутри, текст тот же;
- **строк-призывов «run / re-run the analysis» в семи файлах — 17, с 29.09 ни одной новой и ни одной снятой.** Из них 12 заменяются утверждёнными словами (таблица ниже). 5 остаются её решением:
  - PGR и трафик — № 14, 16 и тело трафика, «слова не меняются»;
  - две фразы из «не меняются» — блок почвы без пробы (`soil-nutrition-analysis.js:594`) и прогноз росы (`disease-analysis.js:1379`);
- поэтому признаки те же:
  - **«Hub» на экране: 3 → 0** (`water-balance-analysis.js:1071`, `plan-ui.js:276`, `dashboard-init.js:1122`);
  - **совет повторить без причины там, где повтор не поможет: 11 → 0**;
  - **фраз, которые держат сами страницы: 21 → 0**;
  - `hubUrl` в клиентских видах: 3 → 0 (`analysis/growth-light.blade.php:23`, `analysis/disease.blade.php:23`, `layouts/db-shell.blade.php:18` — на месте).

**Что изменилось за сутки и как это ложится на устройство:**
1. **Фраза владельца для непосчитанного модуля** («{Module} was not calculated in this analysis. If this continues, contact us.», `AnalysisNotice.php`, около `:941-948`) — это ответ составителя на **записанную** причину класса «не досчитал»: два кода с `composed` (`cascade-pass-not-run`, `pass-not-finished-at-write`) и два с `wordsFrom: owner`.
   - **21 фразу она не покрывает.** 21 — третий случай: «анализ был, причина не записана». Там её «не был посчитан» было бы неправдой для разделов, которые посчитаны и пусты по данным: «No PGR application recorded» — PGR посчитан, внесений нет.
   - Её фраза уже стоит в ветке «причина записана», которую устройство оставляет первой. Страница, спросившая составителя, покажет её там, где причина есть, без правки таблицы.
2. **Причины теперь доезжают до строки** (`GH-781`, `GH-786`, `GH-788`): `notApplicable` с модулем и недостающими входами, журнал прохода.
   - Значит, часть из 21 места чаще попадёт в ветку «причина записана». Это делает устройство ценнее, а не меньше: сегодня страницы анализа составителя не спрашивают вовсе (`GAIP_ANALYSIS_TEXTS` читают только `plan-ui.js`, `dashboard-ui.js`, `settings-init.js`), и записанная причина до них не доходит.
   - **Замер по строкам.** Из 13 последних строк площадок после `GH-781` записаны только 3: `Federal Golf`, `Test5 - NZ`, `Hoxton`. В них записаны:
     - `salinity` — нет `water.ecw`, в трёх строках; места 79 у салинности нет;
     - `tissue` — нет `samples.tissue`, у `Federal Golf`. Это место № 4: после правки там будет фраза причины, а не утверждённая «Add a tissue test on the Data page…».
   - Сколько мест получит причину на остальных 10 площадках, станет видно после их Re-run; по строкам до `GH-781` это не узнать.
3. **Пять мест, дающих ноль при отсутствии нормы азота** (граница 3гг, решение владельца), — **ни одна из 21 фразы о них не говорит**: мест 79 про азот нет. Пересечения нет.

**Размер — без изменений: ≈ 11 мест.**

## Устройство — один владелец слов

**Составитель на сервере — `AnalysisNotice` — уже владеет двумя из трёх случаев пустого раздела:**
- причина записана — фраза причины из `REASONS`;
- анализа не было вовсе — «No analysis has been run for this site yet.» (`:1009`).

**Третий случай — анализ был, причина не записана — сегодня отдан страницам.** `sectionText` отдаёт `null` (`:857–862`), и каждая страница печатает свою фразу. На `/plan` они собраны в таблицу `WAS_PRINTED_BEFORE` (`plan-ui.js:171–195`), на остальных страницах разбросаны строками.

**Решение.**
- Утверждённые слова третьего случая переносятся в составитель, одной таблицей по месту.
- Это и есть вариант `legacy` его же переключателя `UNWORDED` (`:823–855`), только со словами, которые она утвердила, а не со старыми.
- Страницы печатают ответ составителя и своих фраз не держат.
- Доставка уже есть на каждой клиентской странице: `GAIP_ANALYSIS_TEXTS` из `partials/analysis-pill.blade.php:25`, через `topbar`. Читает его сегодня только `/plan` (`serverSection`, `plan-ui.js:219–225`).

**Ключ места.** Ответы составитель собирает по 17 ключам результата (`AnalysisResultSchema::consumerKeys()`, `:960–968`). Двенадцать мест ложатся на них прямо: `soilNutrition`, `tissue`, `waterBalance`, `stress`, `disease`, `soilTempPhysics`, `preEmergent`, `wear`, `pgr`. Для трёх подмест раздела почвы (весь раздел, список нутриентов, годовая потребность) и двух мест без ключа результата (рекомендации Growth & Light, панель дашборда) таблица составителя объявляет **ключ места**, а страница спрашивает по нему. Своих строк она по-прежнему не держит.

**Заголовки не меняются**, меняется тело. Утверждённая правка заменяет фразу-совет. Заголовки вида «No Water Balance Data» верны и её правкой не затронуты. Показать ей при приёмке.

## Перечень мест — сегодня и после

| № | место, якорь | сегодня | после |
|---|---|---|---|
| 1 | `soil-nutrition-analysis.js:1475–1479`, `renderEmpty` | «No Soil & Nutrition Data» / «Add soil test data and run the analysis to see results here.» | «No soil & nutrition results for this site yet. Add a soil test on the Data page.» |
| 2 | `soil-nutrition-analysis.js:737` | «No nutrient data. Add soil test data and run the analysis.» | то же, что № 1 |
| 3 | `soil-nutrition-analysis.js:1044`, годовая потребность | «… Press Re-run to calculate them.» | при записанной причине класса «не досчитал» — фраза причины (Re-run); иначе «Annual nutrient requirements were not calculated for the latest analysis.» |
| 4 | `soil-nutrition-analysis.js:1369` | «No Tissue Test Data» / «Add tissue test data and run the analysis to see results here.» | «Add a tissue test on the Data page to see tissue results.» |
| 5 | `water-balance-analysis.js:1070–1071` | «No Water Balance Data» / «Add Water Quality data **in the Hub** and run the analysis to see results here.» | «No water balance results for this site yet. Add a water test on the Data page.» |
| 7 | `stress-analysis.js:516` | «No stress data yet» / «Run the analysis to compute …» | «No stress index for this site in the latest analysis.» |
| 8 | `disease-analysis.js:1146` | «No analysis data. Run analysis first.» | «No disease risk for this site in the latest analysis.» |
| 11 | `growth-light-analysis.js:995` | «Data not yet available — re-run analysis to populate» | «The soil temperature profile is not available for the latest analysis.» |
| 12 | `growth-light-analysis.js:1787` | «Run analysis first to see recommendations.» | «No recommendations for the latest analysis.» |
| 13 | `plan-ui.js:184–186` + шаг `:259` | «No pre-emergent data» / «… calculates automatically when analysis is run.» / «Run **the Hub** analysis to generate …» | «No pre-emergent timing for the latest analysis.» |
| 14 | `plan-ui.js`, `WAS_PRINTED_BEFORE.pgr` | «No PGR application recorded» / «Log a PGR application … then re-run the analysis …» | **слова не меняются**; при записанной причине (`pgr-window-exhausted`, GH-772) — фраза причины. Фраза без причины переезжает в составитель дословно |
| 16 | `plan-ui.js:696` | «Open Settings → Traffic & Wear … then re-run analysis to generate wear forecasts.» | **слова не меняются**; при записанной причине — её фраза; фраза без причины — в составитель дословно |
| 17 | `plan-ui.js:734` | «No wear data available — run analysis first.» | «No wear forecast for the latest analysis.» |
| 22 | `dashboard-init.js:1122` | «No data available — run analysis **in Hub** first.» | «No data for this panel in the latest analysis.» |

- **№ 20** — значок PGR «Not set» на карточке: как № 14, по причине.
- **№ 9, 10, 15, 18, 19, 21** не меняются. Их фразы тоже переезжают в составитель дословно, чтобы на страницах не осталось ни одной своей.
- **Анализа не было вовсе** — во всех местах фраза составителя «No analysis has been run for this site yet.», а не «in the latest analysis».

## Ссылки на `/hub` — закрываются ли все три

- **Слово «Hub» на экране — в трёх местах, № 5, 13, 22. Все три закрываются утверждёнными текстами.**
- **Самих ссылок `href` на `/hub` в клиентских файлах нет** — `grep` по `assets/*.js` и видам, кроме разметки `/hub`, пуст.
- **Латентный адрес `hubUrl` без читателей — в трёх клиентских видах:** `analysis/growth-light.blade.php:23`, `analysis/disease.blade.php:23`, `layouts/db-shell.blade.php:18`. Убирается в этой работе, как записано в пункте. `layouts/app.blade.php:53` — разметка `/hub`, остаётся.
- `pgr-irrigation-analysis.js:139` («Enter PGR details in the Hub») — файл-сирота, не поверхность. **30.09: файл удалён `GH-784`.**

## Браузерные копии в этой области

Искала `localStorage` в семи файлах страниц.
- `plan-ui.js:554` — зеркало трафика решает, что показать в пустом разделе износа. **Убирает план пункта 9.** Какой пункт придёт первым, тот его и снимает; второй проверяет, что его нет.
- `soil-nutrition-analysis.js:1746–1750` и `water-balance-analysis.js:18–21` — выбранная проба в переключателе. Удобство, текст пустоты не решает.
- `dashboard-init.js:316–328` — кэш погоды дашборда, Вопрос 42.
- **`GAIP_ANALYSIS_TEXTS`** — ответ сервера, отрисованный в страницу, не копия.

## Признак сдачи — числом

- Мест со словом «Hub» на клиентском экране: **3 → 0**.
- Мест, зовущих повторить там, где повтор не поможет: **11 → 0** в фразе без причины. № 14 и 16 зовут повторить только своими утверждёнными старыми словами и фразой причины.
- Фраз пустого раздела, которые держат сами страницы: **21 место в 7 файлах → 0**; у составителя — одна таблица.
- Латентных `hubUrl` в клиентских видах: **3 → 0**.
- **Тесты.**
  - Составителю: для каждого ключа места при прогоне без причины — утверждённый текст, литералом из её перечня; без прогона — «No analysis has been run …»; при записанной причине — фраза причины.
  - Страницам: печатают ответ составителя. Мутация ревьюера — вернуть свою строку в страницу — красный с именем страницы.
  - Перепись: в строках семи файлов нет «Hub» и нет «run analysis» вне № 9 и 15.

## Что увидит человек

- На `/analysis` (почва, вода, стресс, болезни, Growth & Light), на `/plan` и на дашборде пустой раздел перестаёт отправлять в «Hub», которого нет, и звать «запустить анализ» там, где анализ уже шёл. Вместо этого — утверждённая фраза о том, чего нет, и где это добавить.
- Где анализа не было вовсе — «No analysis has been run for this site yet.»
- Где прогон записал причину — её фраза, как сегодня.

## Развилка владельца

Нет: слова её, устройство переносит их к одному составителю. Одно — показать ей при приёмке: заголовки мест («No Water Balance Data» и т. п.) я оставляю, потому что они верны и её правка касалась совета, а не заголовка.

**Проверено 30.09 чтением и по строкам базы: заметка об исчерпанном окне PGR до строки не доходит.** Это касается № 14 и 20.
- Заметку пишет проход оркестратора из `_hubState.inputs.pgr`, а прогон этот вход не заполняет.
- Заметки нет в 0 из 108 строк, в том числе в 5 строках `Test5 - NZ` за 29.09.
- Разбор — `q79-pgr-note.md` в скрэтчпаде аналитика. Доставку ведёт пункт о журнале прогона (`PLAN-journal-survives-the-pass-RU.md`, поправка 30.09).
- **Для этого пункта:** до его сдачи № 14 и 20 печатают фразу «без причины». Устройство пункта 79 от этого не меняется: ветка «при записанной причине» остаётся и начинает срабатывать после пункта о журнале.

**Размер:**
- составитель — таблица по месту и ответ третьего случая (1);
- семь файлов страниц — переход на ответ составителя (7);
- три вида — `hubUrl` (3);
- тесты (2 набора).

**≈ 11 мест.**

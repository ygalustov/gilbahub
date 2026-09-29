# Вопрос 79 — где страница сама пишет текст пустоты: замер разработчика, 24.09.2026

Запрос владельца: примеры текстов для каждого места. Тексты пишет аналитик; здесь только то, что измеряется.

**Число: мест двадцать одно, а не около пятнадцати.** Из 27 литералов, которые дал признак, 21 — текст пустоты раздела или подраздела, а шесть — другое (подписи о сорте, сенсоры, вне работы). Перечень ниже включает все 27 с пометкой класса, чтобы число можно было пересчитать, а не принять на веру.

**Чем мерил:** строковый литерал в 8+ символов, вне комментария, в семи рендерерах страниц анализа, совпадающий с одним из двух образцов — «говорит о пустоте» или «зовёт запустить анализ». Страница, раздел и класс проставлены чтением кода рядом с литералом. Инструмент разовый, в дереве не лежит.

**Откуда берётся столбец «какие причины доходят».** Коды, которые прогон вообще пишет по шагам — замер `noteSkipped` по `assets`:
`mlsn` ← `no-soil-sample`, `soil-sample-not-loaded`; `disease` ← `climate-late`; `forecast` ← `disease-not-computed`;
`stress` ← `engine-error`; `pgr` ← `pgr-window-exhausted` (заметкой, GH-649). Для всего остального прогон не пишет ничего, и составитель скажет только `not-recorded`. **Живой замер T1 24.09: даже `no-soil-sample` до строки не доезжает** (`live-runs/T1-test6-uk-2026-09-24.log`), то есть сегодня записанных причин нет ни у одного раздела.

## Перечень: одно место — одна строка

| # | страница | раздел | адрес | что написано сейчас (дословно) | какие причины доходят | неправда |
|---|---|---|---|---|---|---|
| 1 | /analysis | Почва и питание — весь раздел | `soil-nutrition-analysis.js:1451-1452` | `No Soil &amp; Nutrition Data` / `Add soil test data and run the analysis to see results here.` | `no-soil-sample`, `soil-sample-not-loaded` — но в строке сегодня нет ни одной | — |
| 2 | /analysis | Почва — карточки нутриентов | `soil-nutrition-analysis.js:716` | `No nutrient data. Add soil test data and run the analysis.` | то же | — |
| 3 | /analysis | Почва — блок без пробы | `soil-nutrition-analysis.js:574` | `No soil test data available. Add soil test data and run the analysis to see results.` | то же | — |
| 4 | /analysis | Годовая потребность | `soil-nutrition-analysis.js:1018` | `Press Re-run to calculate them.` | ничего — `not-recorded` | **да**: зовёт нажать, не зная причины |
| 5 | /analysis | Ткань | `soil-nutrition-analysis.js:1343-1344` | `No Tissue Test Data` / `Add tissue test data and run the analysis to see results here.` | ничего — `not-recorded` | — |
| 6 | /analysis | Водный баланс — весь раздел | `water-balance-analysis.js:1070-1071` | `No Water Balance Data` / `Add Water Quality data in the Hub and run the analysis to see results here.` | ничего — `not-recorded` | **да**: отправляет в `/hub` |
| 7 | /analysis | Качество воды — подраздел | `water-balance-analysis.js:232` | `No water quality data available.` | ничего | — |
| 8 | /analysis | Стресс | `stress-analysis.js:516` | `No stress data yet` | `engine-error` (шаг `stress`) | — |
| 9 | /analysis/disease | Весь раздел | `disease-analysis.js:1146` | `No analysis data. Run analysis first.` | `climate-late` (шаг `disease`) | **да**: зовёт нажать, не зная причины |
| 10 | /analysis/disease | Прогноз росы | `disease-analysis.js:1379` | `Dew forecast unavailable — run analysis with live weather to populate.` | ничего — `not-recorded` | **да**: повтор без живой погоды даст то же |
| 11 | /analysis/disease | Водопотребление | `disease-analysis.js:1307` | `No water use data` | ничего | — |
| 12 | /analysis/growth-light | Климат | `growth-light-analysis.js:734` | `No climate data available.` | ничего — `not-recorded` | — |
| 13 | /analysis/growth-light | Температура почвы / панель данных | `growth-light-analysis.js:991` | `Data not yet available — re-run analysis to populate` | ничего — `not-recorded` | **да**: повтор даст то же, если панель снова не отрисуется |
| 14 | /plan | PGR — раздел (заголовок) | `plan-ui.js:174` | `No PGR application recorded` | `pgr-window-exhausted` (заметкой) | **да на `Burns`**: внесение заведено |
| 15 | /plan | PGR — раздел (тело) | `plan-ui.js:175` | `Log a PGR application in Data → Spray Log — select PGR as the category, then re-run the analysis. The GDD schedule will appear here.` | то же | **да на `Burns`**: и внесение есть, и повтор даст то же |
| 16 | /plan | Pre-emergent | `plan-ui.js:232` | `No pre-emergent data` | ничего | — |
| 17 | /plan | Трафик — заголовок | `plan-ui.js:537` | `No traffic data configured` | ничего | — |
| 18 | /plan | Трафик — тело | `plan-ui.js:542` | `Open Settings → Traffic & Wear to configure your match and training schedule, then re-run the analysis` | ничего | — (ведёт в Settings, не в `/hub`) |
| 19 | /plan | Износ — прогноз | `plan-ui.js:666` | `Open Settings → Traffic & Wear to configure your match and training schedule, then re-run analysis to generate wear forecasts.` | ничего | — |
| 20 | /plan | Износ — раздел | `plan-ui.js:704` | `No wear data available — run analysis first.` | ничего — `not-recorded` | **да**: зовёт нажать, не зная причины |
| 21 | /dashboard | Блок данных | `dashboard-init.js:1118` | `No data available — run analysis in Hub first.` | ничего — `not-recorded` | **да**: отправляет в `/hub` |

## Шесть литералов, которые признак нашёл, а текстом пустоты раздела не являются

Названы, чтобы число 21 можно было проверить вычитанием:
- `disease-analysis.js:1274` — подпись о сорте («Detailed resistance data not available for …»), не раздел;
- `disease-analysis.js:1330` — подпись о отсутствии данных испытаний сорта;
- `dashboard-init.js:1550` — сенсоры (сенсорная часть в работу не входит);
- три остальных — те же два раздела почвы/ткани, уже считанные выше как заголовок + тело одного места.

## Неправда — восемь мест из двадцати одного

**Отправляют в `/hub`, которого клиент не видит — 2:** № 6 (водный баланс), № 21 (дашборд).

**Зовут нажать там, где повтор даст тот же исход — 6:** № 4, 9, 10, 13, 20 и пара 14/15 на `Burns`.
Из них два проверены живым замером сегодня: № 13 (панель температуры почвы не отрисовывается — повтор не меняет ничего) и пара 14/15 (`Burns`: внесение TE250 от 16.06.2026 заведено, текст говорит обратное).

**Что важно для аналитика при написании текстов.** Из 21 места записанная причина сегодня возможна у пяти (№ 1, 2, 3, 8, 9 — шаги `mlsn`, `stress`, `disease`) и у пары PGR после GH-649. **У остальных четырнадцати причины нет вовсе — составитель скажет `not-recorded`**, и текст для них придётся писать без причины либо ждать, пока прогон начнёт её записывать.

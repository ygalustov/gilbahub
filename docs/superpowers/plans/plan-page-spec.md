---
name: plan-page-spec
overview: "Детальное описание страницы /plan — Unified Planning Page: структура, содержание каждой секции, источники данных, пустые состояния."
---

# /plan — Unified Planning Page: описание страницы

## Принцип

Пользователь думает категориями **«что мне нужно сделать и когда»**, а не «из какого движка это пришло».
`/plan` агрегирует все schedule-outputs в одном месте. Новых вычислений нет — чистый presentation layer поверх существующих движков.

Связь с анализом: `/analysis/*` страницы объясняют **почему**, `/plan` показывает **когда и что делать**. Каждая analysis-страница с planning output имеет ссылку `→ View in Planning`.

---

## Структура страницы (сверху вниз)

```
┌──────────────────────────────────────────────────────────────┐
│  TOP BAR (global layout — db-shell)                          │
├──────────────────────────────────────────────────────────────┤
│  СТРАНИЦА: Plan                                              │
│  Subtitle: Site name · Species · Last run                    │
├──────────────────────────────────────────────────────────────┤
│  ① TIME-SENSITIVE WINDOWS                                    │
│     Pre-emergent Timing        │  PGR Reapplication          │
│     [всегда видна]             │  [если есть spray log]      │
├──────────────────────────────────────────────────────────────┤
│  ② RECOVERY CALENDAR                                         │
│     4-Week Traffic Schedule + Maintenance Windows            │
├──────────────────────────────────────────────────────────────┤
│  ③ NUTRITION PROGRAM                                         │
│     Annual N/P/K/Ca/Mg table (12 months)                    │
├──────────────────────────────────────────────────────────────┤
│  ④ SEASONAL N PLAN                                           │
│     Quarterly N diagnostics from soil test                   │
└──────────────────────────────────────────────────────────────┘
```

Логика порядка: **срочность → горизонт планирования**
- Верх: самое срочное (pre-emergent и PGR — time-critical, пропустить окно = деньги)
- Середина: сезонное (recovery — месяц вперёд)
- Низ: годовое (nutrition — долгосрочный бюджет)

---

## ① TIME-SENSITIVE WINDOWS

Два виджета рядом (desktop: 50/50, mobile: стак).

### 1A. Pre-emergent Timing

**Движок:** `pre-emergent-engine.js` v1.1.0 — работает всегда, soil temp есть всегда (от сенсора или из воздушной температуры).

**Секция всегда активна.** Пустого состояния нет.

**Что показывает:**

```
┌─────────────────────────────────────────────────┐
│ 🌱  Pre-emergent Timing                         │
│                                                 │
│ [Weed species card × N]                         │
│                                                 │
│ Каждая карточка:                                │
│ ┌─────────────────────────────────────────────┐ │
│ │ ● [ЗЕЛЁНЫЙ / ЯНТАРНЫЙ / КРАСНЫЙ] dot        │ │
│ │ Annual Poa (Poa annua)                      │ │
│ │ Soil temp: 14.2°C · Threshold: 10°C        │ │
│ │ Status: Monitor — 3°C above window         │ │
│ │ Action: Apply within 5 days                │ │
│ └─────────────────────────────────────────────┘ │
│                                                 │
│ Soil temp source: [Sensor / Estimated]          │
│ 14-day soil temp trend: ↓ Cooling 0.3°C/day    │
└─────────────────────────────────────────────────┘
```

**Поля каждой weed-карточки:**
- Цветовой статус: GREEN (>5°C до порога) / AMBER (в пределах 5°C, тренд вниз) / RED_EARLY (в пределах 1°C) / RED_MISSED (порог пройден 5+ дней назад)
- Название вида (лат.)
- Текущая temp 5cm vs threshold (°C)
- Текст рекомендации: «Monitor», «Apply within N days», «Apply now», «Window may have passed»
- Moisture warning (если недавно не было осадков/полива — pre-emergent нужна активация)
- Advisory flag для видов где pre-emergent неэффективен (Cyperus rotundus и др.)

**Источники:** `pre-emergent-engine.js` → alert status, days to threshold, recommended action

---

### 1B. PGR Reapplication Schedule

**Движок:** `gilba-pgr-module-v3.js` + `pgr-forecast.js` + `gaip-decision-engine.js`

**Пустое состояние** (нет записи в Spray Log):
```
┌─────────────────────────────────────────────────┐
│ 💊  PGR Schedule                                │
│                                                 │
│  Для расчёта расписания реаппликации нужна      │
│  история применений.                            │
│                                                 │
│  • Запишите последнее применение PGR            │
│    в журнал опрыскивания   [→ Spray Log]        │
│                                                 │
│  После записи расписание сформируется           │
│  автоматически на основе накопленных GDD.       │
└─────────────────────────────────────────────────┘
```

**Активное состояние:**
```
┌─────────────────────────────────────────────────┐
│ 💊  PGR Schedule                                │
│                                                 │
│ [Статус-бейдж: Recently Applied / Active /      │
│  Approaching Window / Reapply Now]              │
│                                                 │
│ Продукт: Primo Maxx (trinexapac-ethyl)          │
│ Применено: 14 May · Rate: 0.8 L/ha             │
│ Surface: Greens (<6mm) · Species: Bentgrass     │
│                                                 │
│ GDD Progress ─────────────────────────────────  │
│ ████████████░░░░ 165 / 220 GDD (75%)            │
│              ↑ reapplication window             │
│                                                 │
│ ┌───────────┬───────────┬───────────┐           │
│ │ GDD to    │Suppression│Days since │           │
│ │ window    │    %      │applied    │           │
│ │   55 GDD  │   18%     │   12 d    │           │
│ └───────────┴───────────┴───────────┘           │
│                                                 │
│ ↻ Reapply by: 28 May · ~5 days at 11 GDD/day   │
│                                                 │
│ [PGR Sinewave chart — 21-day forecast]          │
│  Suppression curve + Rebound zone               │
│  Today marker + 75% GDD threshold line          │
│                                                 │
│ ⚠ Shade warning (если DLI < 15):               │
│  DLI: 12.3 mol/m²/day — Reduce rate             │
└─────────────────────────────────────────────────┘
```

**Поля:**
- Статус-бейдж с цветом (зелёный/янтарный/красный)
- Продукт, дата применения, норма внесения (из Spray Log)
- Surface category + Species
- GDD progress bar (0–100%, amber при 60%, red при 75%)
- Три метрики: GDD to window / Suppression % / Days since applied
- Projected reapplication date + daily GDD rate
- SVG chart (sinewave, 21-day, suppression purple + rebound orange)
- Shade warning если DLI < 20 mol/m²/day

**Источники:** `gilba-pgr-module-v3.js` — GDD accumulated/threshold/suppression%; `pgr-forecast.js` — sinewave chart; `gaip-decision-engine.js` — reapplication status.

---

## ② RECOVERY CALENDAR

**Движки:** `generateRecoveryCalendar()` в `hub-tissue-v3.js:4679` + `wear-recovery-engine-pure.js` + `wear-recovery-integration.js`

**Пустое состояние** (нет данных о нагрузке в Settings):
```
┌─────────────────────────────────────────────────┐
│ 🗓  Recovery Calendar                           │
│                                                 │
│  Для расчёта окон обслуживания нужны данные     │
│  о нагрузке на поле.                            │
│                                                 │
│  • Укажите количество матчей и                  │
│    тренировок в неделю   [→ Site Profile]       │
│                                                 │
│  Дополнительно улучшат расчёт (не обязательно): │
│  • LOI / OM тест почвы   [→ LOI Tests]          │
│                                                 │
│  После заполнения календарь сформируется        │
│  автоматически.                                 │
└─────────────────────────────────────────────────┘
```

**Активное состояние:**
```
┌───────────────────────────────────────────────────────────────┐
│ 🗓  Recovery Calendar                                         │
│                                                               │
│ KEY METRICS                                                   │
│ ┌──────────────────┬──────────────────┬────────────────────┐  │
│ │ Compaction Risk  │ Wear Resistance  │ Recovery Window    │  │
│ │ ██░░ 45%         │ Good  7.2 / 10   │ 5 days (base 7d)  │  │
│ │ Moderate         │                  │ 78% probability    │  │
│ └──────────────────┴──────────────────┴────────────────────┘  │
│                                                               │
│ Max capacity: 28 hrs/wk · Current load: 12.6 hrs/wk (45%)   │
│ Aeration interval: Every 6 weeks                             │
│                                                               │
│ EFFECTIVE LOAD BREAKDOWN                                      │
│ ┌─────────────┬──────────┬────────┬──────────────┐           │
│ │ Activity    │ Raw Hrs  │ Factor │ Effective    │           │
│ ├─────────────┼──────────┼────────┼──────────────┤           │
│ │ Match play  │ 9.0      │ 1.20   │ 10.8         │           │
│ │ Training    │ 2.0      │ 0.90   │ 1.8          │           │
│ │ Total       │          │        │ 12.6 hrs/wk  │           │
│ └─────────────┴──────────┴────────┴──────────────┘           │
│                                                               │
│ ⚠ Stress Factors Affecting Recovery                          │
│  ☁️ Shade — Recovery extended +1 day (DLI 11 mol/m²/day)    │
│  🌡️ Temperature — Base probability 80% → 72% adjusted       │
│                                                               │
│ 4-WEEK TRAFFIC SCHEDULE (3 matches, 2 sessions/week)         │
│      Sun   Mon   Tue   Wed   Thu   Fri   Sat                  │
│ W1  [REST][MATCH][REST][TRAIN][REST][MATCH][MATCH]            │
│ W2  [REST][MATCH][REST][TRAIN][REST][MATCH][MATCH]            │
│ W3  [REST][MATCH][REST][TRAIN][REST][MATCH][MATCH]            │
│ W4  [REST][MATCH][REST][TRAIN][REST][MATCH][MATCH]            │
│ Легенда: ■ Match · ■ Training · ■ Rest                       │
│                                                               │
│ MAINTENANCE WINDOWS                                           │
│ ┌─────────────────────────────────────────────────────────┐   │
│ │ 🔧 Aeration        Next window: Mon 25 May (3 days)    │   │
│ │    Solid tine — GP 72%, 4+ rest days available          │   │
│ ├─────────────────────────────────────────────────────────┤   │
│ │ 🌱 Topdressing     Next window: Mon 25 May (3 days)    │   │
│ │    Light rate — schedule with aeration                  │   │
│ ├─────────────────────────────────────────────────────────┤   │
│ │ ✂  Verticutting    Next window: Mon 1 Jun (10 days)    │   │
│ │    GP dropping — complete before GP < 50%               │   │
│ └─────────────────────────────────────────────────────────┘   │
│                                                               │
│ [▶ View Wear Resistance Modifiers]  (collapsible)            │
│   HOC · Growth · Shade · Overseed · Root Depth               │
│                                                               │
│ Data quality: Variety ✓ · GP ✓ · OM ✓ · Shade ✓             │
└───────────────────────────────────────────────────────────────┘
```

**Поля:**
- Key metrics (3 карточки): Compaction Risk % + label / Wear Resistance score 0–10 + label / Recovery Window дни + probability %
- Max capacity hrs/wk + current load + aeration interval
- Effective Load breakdown table: Activity / Raw Hrs / Factor / Effective Hrs
- Stress Factors block (если есть): Shade / Salinity / Temperature / Compound — каждый с иконкой и эффектом (recovery probability до/после)
- 4-week traffic grid (Sun–Sat, match/training/rest)
- Maintenance windows: Aeration / Topdressing / Verticutting с датами и причинами
- Wear Resistance Modifiers (collapsible): HOC, growth, shade, overseed, root depth
- Data quality footer

**Источники:**
- `wear-recovery-engine-pure.js` — compactionRisk, wearResistance, recoveryWindow, aerationSchedule, effectiveLoad
- `wear-recovery-integration.js` — adjustedRecovery (stress factors), renderWearRecoveryResults()
- `generateRecoveryCalendar()` — traffic grid, maintenance dates
- Settings: `gaip-matches-week`, `gaip-sessions-week`
- `hub-tissue-v3.js` — variety, OM, GP integration

---

## ③ NUTRITION PROGRAM

**Движок:** `nutrition-calendar.js` + GP из `climate-module-v2.1-dual-metrics.js`

**Форма (всегда видна, не скрыта за empty state):**
```
┌─────────────────────────────────────────────────────────────────┐
│ 📅  Nutrition Program                                           │
│                                                                 │
│ Введите параметры для расчёта годового плана:                   │
│                                                                 │
│ Annual N target (кг/га)   [_______]                             │
│ Типично: Greens 80–150 · Tees 120–180 · Sports 180–350         │
│                                                                 │
│ Max N per application     [_______]  кг/га/приём               │
│                                                                 │
│ Distribution method:  ● GP-Weighted (рекомендуется)            │
│                       ○ Even distribution                       │
│                       ○ Front-loaded (spring emphasis)          │
│                                                                 │
│ Clipping management:  ○ Auto-detect  ● Collected  ○ Returned   │
│                                                                 │
│ [Generate Nutrition Program]                                    │
│                                                                 │
│ Распределение по месяцам рассчитается автоматически            │
│ на основе Growth Potential вашего сайта.                       │
└─────────────────────────────────────────────────────────────────┘
```

**После Generate — результат:**
```
┌────────────────────────────────────────────────────────────────────┐
│ 📅  Nutrition Program                                              │
│                                                                    │
│ SUMMARY                                                            │
│ ┌──────────────┬──────────────┬───────────────┬──────────────────┐ │
│ │ Species      │ Methodology  │ Distribution  │ Clippings        │ │
│ │ Bentgrass    │ MLSN         │ GP-Weighted   │ Collected        │ │
│ └──────────────┴──────────────┴───────────────┴──────────────────┘ │
│                                                                    │
│ ANNUAL TOTALS (кг/га)                                              │
│ ┌────────┬────────┬────────┬────────┬────────┬────────┐           │
│ │   N    │   P    │   K    │   Ca   │   Mg   │   S    │           │
│ │  120   │  12    │  66    │  20    │   9.6  │   6    │           │
│ └────────┴────────┴────────┴────────┴────────┴────────┘           │
│                                                                    │
│ MONTHLY CALENDAR                                                   │
│ ┌──────┬────────┬───────┬───────┬───────┬───────┬───────┬───────┐ │
│ │Month │ Season │  GP%  │   N   │   P   │   K   │  Ca   │  Mg   │ │
│ ├──────┼────────┼───────┼───────┼───────┼───────┼───────┼───────┤ │
│ │ Jan  │ Summer │  85%  │ 14.5  │  1.5  │  8.0  │  2.5  │  1.2  │ │
│ │ Feb  │ Summer │  80%  │ 13.7  │  1.4  │  7.5  │  2.3  │  1.1  │ │
│ │ Mar  │ Autumn │  65%  │ 11.1  │  1.1  │  6.1  │  1.9  │  0.9  │ │
│ │ ...  │  ...   │  ...  │  ...  │  ...  │  ...  │  ...  │  ...  │ │
│ └──────┴────────┴───────┴───────┴───────┴───────┴───────┴───────┘ │
│                                                                    │
│ [Export CSV]   [Re-calculate]                                      │
└────────────────────────────────────────────────────────────────────┘
```

**Поля:**
- Summary bar: Species / Methodology / Distribution / Clippings
- Annual totals: N / P / K / Ca / Mg / S (кг/га)
- 12-месячная таблица: Month / Season / GP% / N / P / K / Ca / Mg / S
- Warnings: если N cap применён, если есть дефициты по нутриентам
- Кнопки: Export CSV / Re-calculate

После генерации таблицы автоматически появляется блок **Fertiliser Product Recommendations**:
```
┌────────────────────────────────────────────────────────────────┐
│ 🧴  Product Recommendations                                    │
│                                                                │
│ Region: Australia  [Distributor: All ▼]                        │
│                                                                │
│ RECOMMENDED PRODUCTS                                           │
│ ┌────────────────────┬──────┬──────┬──────┬─────┬─────┬─────┐ │
│ │ Product            │ Jan  │ Feb  │ Mar  │ ...│ Tot │ kg  │ │
│ ├────────────────────┼──────┼──────┼──────┼─────┼─────┼─────┤ │
│ │ Primo Maxx         │ 1.2  │ 1.2  │ 0.8  │ ... │ 12  │/ha  │ │
│ │ Endure             │ 3.0  │ 3.0  │ 2.0  │ ... │ 28  │/ha  │ │
│ │ ...                │      │      │      │     │     │     │ │
│ └────────────────────┴──────┴──────┴──────┴─────┴─────┴─────┘ │
│                                                                │
│ Annual summary: N delivered X kg/ha · targets met ✓           │
└────────────────────────────────────────────────────────────────┘
```
Регион определяется автоматически из site profile:
- AU → `nutrition-au-fertiliser-integration.js` (AU продукты + distributor dropdown)
- UK → `nutrition-uk-fertiliser-integration.js` (UK продукты)
- Prebble region → `nutrition-prebble-integration.js` (Prebble бренд, месячное расписание)

**Источники:**
- User inputs: Annual N target, Max N per application, distribution method, clipping management
- `nutrition-calendar.js` — distribution logic, monthly table
- `climate-module-v2.1-dual-metrics.js` — monthly GP values
- `hub-tissue-v3.js` — P:K:Ca:Mg:S ratios (P 10%, K 55%, Ca 17%, Mg 8%, S 5%)
- `nutrition-requirement-engine.js` — deficit corrections
- `nutrition-au-fertiliser-integration.js` / `nutrition-uk-fertiliser-integration.js` / `nutrition-prebble-integration.js` — product recommendations (авто после Generate)

---

## ④ SEASONAL N PLAN

**Движок:** `generateSeasonalNPlan()` в `hub-tissue-v3.js:4508` — вычисляется автоматически.

**Пустое состояние** (нет soil test с N данными):
```
┌─────────────────────────────────────────────────┐
│ 🧪  Seasonal N Plan                             │
│                                                 │
│  Для формирования сезонного плана нужны данные  │
│  почвенного теста.                              │
│                                                 │
│  • Загрузите результаты анализа почвы           │
│    [→ Soil Tests]                               │
│                                                 │
│  После загрузки план сформируется               │
│  автоматически.                                 │
└─────────────────────────────────────────────────┘
```

**Активное состояние:**
```
┌────────────────────────────────────────────────────────────────┐
│ 🧪  Seasonal N Plan                                            │
│                                                                │
│ Based on: 14-day forecast avg 21.3°C · C3/C4 blend 70/30%     │
│                                                                │
│ QUARTERLY BREAKDOWN                                            │
│ ┌──────────────────┬─────────────────────────────────────────┐ │
│ │ Summer (Dec-Feb) │ N-opt: 38 kg/ha · High demand period    │ │
│ │   Avg temp 25°C  │ C4 dominant — apply in split doses      │ │
│ ├──────────────────┼─────────────────────────────────────────┤ │
│ │ Autumn (Mar-May) │ N-opt: 28 kg/ha · Transition period     │ │
│ │   Avg temp 18°C  │ Reduce rate as C4 slows                 │ │
│ ├──────────────────┼─────────────────────────────────────────┤ │
│ │ Winter (Jun-Aug) │ N-opt: 14 kg/ha · Minimal demand        │ │
│ │   Avg temp 10°C  │ C3 overseed active — maintain 1–2 kg/ha │ │
│ ├──────────────────┼─────────────────────────────────────────┤ │
│ │ Spring (Sep-Nov) │ N-opt: 32 kg/ha · Recovery period       │ │
│ │   Avg temp 18°C  │ Ramp up as GP increases                 │ │
│ └──────────────────┴─────────────────────────────────────────┘ │
│                                                                │
│ Current quarter: Autumn (Mar-May)                              │
│ N diagnostics: baseOptimum 32 · opt 28 kg/ha                  │
│ Temperature source: 14-day forecast                            │
└────────────────────────────────────────────────────────────────┘
```

**Поля:**
- Источник температурных данных (forecast / current conditions / seasonal averages)
- C3/C4 blend
- Квартальная таблица (4 строки по hemisphere): Season / Avg temp / N-opt / Action advice
- Highlight текущего квартала
- N diagnostics values (baseOptimum, opt)

**Источники:**
- `generateSeasonalNPlan()` — quarterly N distribution
- `hub-tissue-v3.js` — hemisphere, c3/c4 fraction, N diagnostics (Nopt, baseOptimum)
- `window.rawWeatherData` — 14-day forecast для точных температур
- `window.climateMetrics` — fallback

---

## Пустые состояния — общий принцип

Все пустые состояния следуют единому формату:
```
[иконка]  [Название секции]

Для [функция] нужны [что именно].

• [Конкретный шаг]  [→ Ссылка]
• [Шаг 2 если есть]  [→ Ссылка]

После этого [результат] сформируется автоматически.
```

Никаких размытых «данных недостаточно» — всегда конкретный шаг и прямая ссылка.

---

## ЭКСПОРТ

Кнопка **Export to Calendar (.ics)** — фиксированная, в верхнем правом углу страницы рядом с заголовком.

Экспортирует в iCal формат (совместим с Google Calendar, Apple Calendar, Outlook):
- PGR reapplication reminder — дата из GDD расчёта
- Pre-emergent timing alerts — только AMBER и RED виды (с датой окна применения)
- Spray log записи — последние 90 дней (исторический контекст)

**Источник:** `gaip-ical-export.js`

---

## Навигация между страницами

| Analysis страница          | Link на /plan               |
| -------------------------- | --------------------------- |
| `/analysis/soil-nutrition` | → View nutrition schedule in Planning |
| `/analysis/stress`         | → View recovery windows in Planning   |
| `/analysis/pgr-irrigation` | → View PGR schedule in Planning       |
| `/analysis/preemergent`    | → View timing schedule in Planning    |

---

## Данные из старого хаба — полный перенос

| Движок (старый хаб)                   | Секция на /plan             | Статус |
| ------------------------------------- | --------------------------- | ------ |
| `nutrition-calendar.js`               | ③ Nutrition Program         | ✓ переносится |
| `nutrition-requirement-engine.js`     | ③ Nutrition Program (расчёт) | ✓ переносится |
| `nutrition-summary-integration.js`    | ③ Summary bar               | ✓ переносится |
| `nutrition-prebble-integration.js`    | ③ Fertiliser Products (Prebble) | ✓ переносится |
| `nutrition-au-fertiliser-integration.js` | ③ Fertiliser Products (AU) | ✓ переносится |
| `nutrition-uk-fertiliser-integration.js` | ③ Fertiliser Products (UK) | ✓ переносится |
| `generateSeasonalNPlan()` (hub-tissue-v3) | ④ Seasonal N Plan       | ✓ переносится |
| `gilba-pgr-module-v3.js`             | ① PGR Schedule              | ✓ переносится |
| `pgr-forecast.js` + `pgr-ui.js`      | ① PGR Schedule (chart + UI) | ✓ переносится |
| `pre-emergent-engine.js`             | ① Pre-emergent Timing       | ✓ переносится |
| `generateRecoveryCalendar()` (hub-tissue-v3) | ② Recovery Calendar | ✓ переносится |
| `wear-recovery-engine-pure.js`        | ② Recovery Calendar (modifiers) | ✓ переносится |
| `wear-recovery-integration.js`        | ② Compaction Risk, Effective Load, Stress Factors | ✓ переносится |
| `gaip-ical-export.js`                | Export to Calendar (.ics) кнопка на /plan               | ✓ переносится |
| `event-planner-engine.js`            | **Не в /plan** — отдельная `/events` страница (вне scope) | — |
| `irrigation-scheduler-ui.js`         | **Не в /plan** — 7-day schedule на Dashboard (Tier 2 Vital Signs) | — |
| `nutrition-au-fertiliser-integration.js` | ③ Nutrition Program (AU products) | ✓ доступно |
| `nutrition-uk-fertiliser-integration.js` | ③ Nutrition Program (UK products) | ✓ доступно |

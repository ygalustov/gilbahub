---
name: reports-page-spec
overview: "Детальное описание раздела /reports — 4 под-страницы: Export, Forensic, Scenarios, Accuracy. Источники данных из старого хаба, структура каждой страницы, пустые состояния."
---

# /reports — Reports Section: описание страниц

## Принцип

`/reports` — это документальный слой поверх результатов анализа. Если `/analysis/*` отвечает **что происходит**, а `/plan` показывает **когда и что делать**, то `/reports` отвечает на вопрос **как это зафиксировать, сохранить и объяснить**.

Четыре под-страницы обслуживают разные сценарии использования:

| Страница              | Для чего                                  | Частота использования |
| --------------------- | ----------------------------------------- | --------------------- |
| `/reports/export`     | Скачать отчёт клиенту / в архив          | Регулярно             |
| `/reports/forensic`   | Аудит: почему движок принял решение       | По запросу            |
| `/reports/scenarios`  | What-if: сравнить два сценария            | Перед важным решением |
| `/reports/accuracy`   | Насколько точны прогнозы                  | Раз в сезон           |

---

## Навигация внутри раздела

`/reports` использует db-shell layout (`@extends('layouts.db-shell')`). В sidebar Reports — это один из основных пунктов меню с раскрывающимися под-страницами.

```
┌──────────────────────────────────────────────────────────────┐
│  TOP BAR (global layout — db-shell)                          │
├──────────────────────────────────────────────────────────────┤
│  SIDEBAR                    │  CONTENT                       │
│                             │                                │
│  ● Dashboard                │  (содержимое под-страницы)     │
│  ● Data                     │                                │
│  ● Analysis                 │                                │
│  ● Plan                     │                                │
│  ▶ Reports                  │                                │
│    ├─ Export                │                                │
│    ├─ Forensic Record       │                                │
│    ├─ Scenarios             │                                │
│    └─ Accuracy              │                                │
│  ● Settings                 │                                │
└──────────────────────────────────────────────────────────────┘
```

`/reports` (без под-страницы) — redirect на `/reports/export` (самая частая задача).

---

## 1. /reports/export — Export Centre

**Движки:** `word-export.js` v2.4.0, `word-export-combined.js` v1.3.0, `gaip-ical-export.js` v1.0.0, `gssh-led-export.js` v1.0.0

**Принцип:** один экран — все форматы экспорта. Пользователь видит, что доступно и что будет в каждом отчёте, до нажатия кнопки.

### Структура страницы

```
┌─────────────────────────────────────────────────────────────────┐
│  СТРАНИЦА: Export                                               │
│  Subtitle: Site name · Species · Analysis: 22 May 2026 14:30   │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│  ① FULL ANALYSIS REPORT                                         │
│     Word (.docx) — все секции для текущего сайта               │
│     ────────────────────────────────────────────────────────── │
│     [что войдёт в отчёт — секции чекбоксами]                   │
│     [Generate & Download]                                       │
│                                                                 │
│  ② COMBINED MULTI-SITE REPORT                                   │
│     Word (.docx) — все образцы со всех сайтов в одном файле    │
│     [Generate & Download]  [видна только если сайтов > 1]      │
│                                                                 │
│  ③ CALENDAR EXPORT                                              │
│     iCal (.ics) — события из spray log + PGR + pre-emergent    │
│     [Download .ics]                                             │
│                                                                 │
│  ④ LED LIGHTING REPORT               [только для Stadium сайтов]│
│     Word (.docx) — rig placement + seasonal plan               │
│     [Generate & Download]                                       │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘
```

### ① Full Analysis Report (Word)

**Источник:** `word-export.js` v2.4.0

**Что входит (секции документа — пользователь видит список с чекбоксами):**

```
┌──────────────────────────────────────────────────────────────────┐
│  📄  Full Analysis Report — Word (.docx)                         │
│                                                                  │
│  Site: Keilor Park Greens · Bentgrass · MLSN · Temperate AU     │
│  Analysis run: 22 May 2026 14:30 · Run ID: GAIP-L8K2M           │
│                                                                  │
│  Sections to include:                                            │
│  ☑  Cover page (site, date, branding logo)                      │
│  ☑  Soil Analysis & MLSN Sufficiency                            │
│  ☑  Nutrient Trend Analysis (требует ≥ 2 образца почвы)         │
│  ☑  Annual Nutrient Requirements                                 │
│  ☑  Nutrition Program (Monthly Schedule)                        │
│  ☑  Disease Risk Assessment                                      │
│  ☑  Growth Potential & Climate                                   │
│  ☑  Water Quality                                                │
│  ☑  PGR & Irrigation                                            │
│  ☑  Cultivar Performance Profile                                 │
│  ☑  AI Interpretation (Claude)  [если есть кэш интерпретации]   │
│  ☑  Forensic Decision Record                                     │
│                                                                  │
│  [Generate & Download Report]                                    │
│                                                                  │
│  Estimated size: ~12–18 pages                                    │
└──────────────────────────────────────────────────────────────────┘
```

**Пустое состояние (анализ ещё не запускался):**
```
┌──────────────────────────────────────────────────────────────┐
│  📄  Full Analysis Report                                    │
│                                                              │
│  Отчёт формируется на основе последнего запуска анализа.    │
│                                                              │
│  • Запустите анализ  [→ Dashboard ↻ Re-run]                  │
│                                                              │
│  После завершения анализа кнопка Generate станет активной.  │
└──────────────────────────────────────────────────────────────┘
```

**Поля документа (из `word-export.js` collectData()):**
- Cover: site label, date, Gilba logo (из `gilba_logo_*` AJAX), Run ID из FORENSIC_RECORD
- Soil: нутриенты по MLSN/SLAN/AA методологии, pH, sufficiency status
- Nutrient Trends: sparkline PNG per нутриент (через `renderTrendChart()`), направление, пороговое значение
- ANR: P/K/Ca/Mg/S рекомендации кг/га из `NutritionRequirementEngine_Pure`
- Nutrition Program: 12-месячная таблица + продуктовые рекомендации (AU/UK/Prebble)
- Disease: primary threat, secondary diseases, risk % + trajectory
- Growth Potential + Climate: thermal/moisture GP, ET₀, DLI
- Water: SAR, sodium hazard, EC, leaching
- PGR: GDD accumulated, suppression %, projected reapplication
- Cultivar: NTEP traits, performance under local conditions
- AI Interpretation: narrative из `window.GAIP_SOIL_INTERPRETATION` если есть
- Forensic: Run ID + timestamp + per-engine determinations

---

### ② Combined Multi-Site Report (Word)

**Источник:** `word-export-combined.js` v1.3.0

**Видна только если сайтов > 1.** Один .docx с section break между сайтами.

```
┌──────────────────────────────────────────────────────────────────┐
│  📋  Combined Multi-Site Report — Word (.docx)                   │
│                                                                  │
│  Exports one report containing all soil samples across all       │
│  sites. Instead of 20 separate documents for 20 greens —        │
│  one combined file.                                              │
│                                                                  │
│  Sites to include: ☑ All (4)  ☐ Select sites                    │
│                                                                  │
│  ⚠ Each site requires a fresh analysis run. Combined export     │
│    will trigger analysis for each site sequentially.            │
│    Estimated time: ~2–3 min for 4 sites.                        │
│                                                                  │
│  [Generate Combined Report]                                      │
└──────────────────────────────────────────────────────────────────┘
```

**Технические детали:**
- Для каждого сайта: `triggerAnalysis()` → `waitForAnalysis(15s)` → `collectData()` — именно в этом порядке
- `engineInputs` собираются per-sample во время loop, не после (b35fix313 fix)
- Species/hemisphere/overseed считываются из site-specific state, не из глобального

---

### ③ Calendar Export (iCal)

**Источник:** `gaip-ical-export.js` v1.0.0

```
┌──────────────────────────────────────────────────────────────────┐
│  📅  Calendar Export — iCal (.ics)                               │
│                                                                  │
│  Exports to Apple Calendar, Google Calendar, Outlook.            │
│                                                                  │
│  Contents:                                                       │
│  ● Spray log entries (last 90 days) — all-day events            │
│  ● PGR reapplication reminder (projected date from GDD)          │
│    Next: ~28 May 2026                                            │
│  ● Pre-emergent timing alerts (AMBER and RED species only)       │
│    Annual Poa — Apply within 5 days                             │
│                                                                  │
│  [Download .ics]                                                 │
└──────────────────────────────────────────────────────────────────┘
```

**Данные:**
- Spray log: REST GET `/gilba/v1/spray-log?site_id=X&days=90`
- PGR: `window.GAIP_PGR_RESULT.projectedReapplicationDate`
- Pre-emergent: `window.GAIP_PRE_EMERGENT_RESULT` — только AMBER/RED статусы

**Пустое состояние (нет spray log и нет PGR истории):**
```
┌──────────────────────────────────────────────────────────────┐
│  📅  Calendar Export                                         │
│                                                              │
│  Для наполненного календаря нужны данные журнала.           │
│                                                              │
│  • Запишите spray-приложения  [→ Spray Log]                  │
│                                                              │
│  Pre-emergent даты добавятся автоматически из анализа.      │
└──────────────────────────────────────────────────────────────┘
```

---

### ④ LED Lighting Report (Stadium only)

**Источник:** `gssh-led-export.js` v1.0.0

**Виден только для сайтов типа Stadium.** Скрыт для обычных turf сайтов.

```
┌──────────────────────────────────────────────────────────────────┐
│  💡  LED Lighting Report — Word (.docx)                          │
│      For Stadium sites only                                      │
│                                                                  │
│  Sections:                                                       │
│  1. Cover — Venue name, date, Gilba branding                    │
│  2. Venue & Environment Summary (EUE composite, limits)         │
│  3. Rig Placement Results (rigs, coverage, DLI gap)             │
│  4. Seasonal Operating Plan (monthly hours, energy cost, DLI)   │
│  5. Agronomic Context (species, GP, shade impact)               │
│                                                                  │
│  [Generate LED Report]                                           │
└──────────────────────────────────────────────────────────────────┘
```

**Источники данных:**
- `window.GSSH_LAST_RIG_RESULT` — rig placement results
- `window.GSSH_LAST_SEASONAL_RESULT` — seasonal plan
- `window.GSSH_EUE_Bridge.getLastEUE()` — EUE composite
- `window.GAIP_STATE` — agronomic context (species, GP)

---

## 2. /reports/forensic — Forensic Decision Record

**Движок:** `FORENSIC_RECORD` в `hub-tissue-v3.js:1874`

**Принцип:** audit trail — почему каждый движок принял решение именно такое. Это не отчёт для клиента, а профессиональный инструмент: «Я принял решение X на основании анализа Y с run ID Z». Полезен при вопросах «почему вы рекомендовали именно это», при разборе инцидентов, при работе с агрономическим консультантом.

### Структура страницы

```
┌─────────────────────────────────────────────────────────────────┐
│  СТРАНИЦА: Forensic Decision Record                             │
│  Subtitle: Site name · Run ID: GAIP-L8K2M · 22 May 2026 14:30  │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│  ① RUN HEADER                                                   │
│     Run ID · Timestamp · Site · Species · Methodology          │
│                                                                 │
│  ② PER-ENGINE DECISIONS (expandable cards)                      │
│     Disease / GP / Stress / Soil / PGR / Irrigation / Water    │
│     Pre-emergent                                                │
│                                                                 │
│  ③ EXPORT ACTIONS                                               │
│     [Download PDF]  [Copy Run ID]                              │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘
```

### ① Run Header

```
┌──────────────────────────────────────────────────────────────────┐
│  📋  Forensic Decision Record                                    │
│                                                                  │
│  Run ID:    GAIP-L8K2M                                           │
│  Analysis:  22 May 2026 · 14:30:12 AEST                         │
│  Site:      Keilor Park Greens                                   │
│  Species:   Bentgrass (Agrostis stolonifera)                     │
│  Method:    MLSN · Temperate Southern Hemisphere                 │
│                                                                  │
│  [📄 Download PDF]   [⎘ Copy Run ID]                             │
└──────────────────────────────────────────────────────────────────┘
```

### ② Per-Engine Decisions

Каждый движок — отдельная expandable карточка. По умолчанию все свёрнуты (только заголовок с вердиктом); клик раскрывает детали.

**Формат каждой карточки:**
```
┌──────────────────────────────────────────────────────────────────┐
│  ▶  Disease Risk  ·  HIGH (78%)  ·  Dollar Spot primary threat  │
└──────────────────────────────────────────────────────────────────┘
```

**Развёрнутая карточка:**
```
┌──────────────────────────────────────────────────────────────────┐
│  ▼  Disease Risk                                                 │
│                                                                  │
│  Verdict:    HIGH — 78% dollar spot risk in 5 days              │
│  Confidence: Medium (sensor temp · estimated leaf wetness)       │
│                                                                  │
│  DETERMINATION CHAIN                                             │
│  ┌─────────────────────────────────────────────────────────────┐ │
│  │ Input            │ Value        │ Source                    │ │
│  ├──────────────────┼──────────────┼───────────────────────────┤ │
│  │ Air temp (14d)   │ 21.3°C avg   │ Open-Meteo forecast       │ │
│  │ Leaf wetness     │ Estimated    │ Derived from RH/dew       │ │
│  │ Soil temp        │ 18.4°C       │ Sensor (HC-S3, Green 3)   │ │
│  │ Species          │ Bentgrass    │ Site Profile              │ │
│  │ Variety          │ Putter       │ Site Profile              │ │
│  └─────────────────────────────────────────────────────────────┘ │
│                                                                  │
│  DECISION LOGIC                                                  │
│  Dollar Spot: temp 21.3°C (range 15–32°C ✓) + extended leaf     │
│  wetness forecast + susceptible variety → HIGH                   │
│                                                                  │
│  ACTION REQUIRED                                                 │
│  Preventive fungicide within 48h recommended                     │
│                                                                  │
│  Evidence references: SDHI efficacy (Putman et al. 2016)        │
└──────────────────────────────────────────────────────────────────┘
```

**Движки в FORENSIC_RECORD:**
- Disease Risk — verdict + confidence + inputs (temp, leaf wetness, species/variety)
- Growth Potential — thermal GP + moisture GP + final GP%
- Stress Index — drivers, trajectory, compound effects
- Soil Nutrition — methodology, pH, per-nutrient status + deficits
- PGR — GDD accumulated, threshold, suppression %, reapplication window
- Irrigation — VWC, ET₀, Kc, weekly need, schedule
- Water Quality — SAR, EC, sodium hazard category
- Pre-emergent — per-species soil temp vs threshold + alert status

**Пустое состояние (анализ не запускался в этой сессии):**
```
┌──────────────────────────────────────────────────────────────────┐
│  📋  Forensic Decision Record                                    │
│                                                                  │
│  Запись формируется при каждом запуске анализа.                 │
│                                                                  │
│  • Запустите анализ  [→ Dashboard ↻ Re-run]                     │
│                                                                  │
│  После запуска здесь появится полный audit trail с Run ID       │
│  и цепочкой решений по каждому движку.                          │
└──────────────────────────────────────────────────────────────────┘
```

**Источник данных:**
- `FORENSIC_RECORD.runID` — уникальный ID `GAIP-` + timestamp base36
- `FORENSIC_RECORD.timestamp` — время запуска
- `FORENSIC_RECORD.determinations` — объект per-engine: `{ engine, verdict, inputs, evidence, actionsRequired }`
- `recordDetermination(engine, verdict, inputs, evidence)` — вызывается каждым движком при run

---

## 3. /reports/scenarios — Scenario Comparisons

**Движки:** `gaip-scenario-engine.js` v2.1.1, `gaip-whatif-ui.js`, `scenario-presets.js`, `scenario-export.js` v1.1.0

**Принцип:** пользователь сравнивает два сценария — Baseline (текущие условия) vs Alternate (изменённые параметры). Сценарии можно строить вручную или выбирать из presets. Все движки запускаются в pure state mode (без DOM-чтения), результат — tabular comparison.

### Структура страницы

```
┌─────────────────────────────────────────────────────────────────┐
│  СТРАНИЦА: Scenario Comparison                                  │
│  Subtitle: Site name · Species                                  │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│  ① SCENARIO SETUP                                               │
│     Baseline (current state)  vs  Alternate (parameters)       │
│     [Preset buttons]  или  [Ручной ввод параметров]            │
│                                                                 │
│  ② COMPARISON TABLE                                             │
│     Side-by-side результаты по всем движкам                    │
│                                                                 │
│  ③ CONFIDENCE SUMMARY                                           │
│     Per-engine: computed / estimated / unavailable              │
│                                                                 │
│  ④ EXPORT                                                       │
│     [Export Comparison to Word]                                 │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘
```

### ① Scenario Setup

```
┌──────────────────────────────────────────────────────────────────┐
│  ⚗  Scenario Comparison                                          │
│                                                                  │
│  QUICK PRESETS                                                   │
│  ┌──────────────────┐  ┌──────────────────┐  ┌───────────────┐  │
│  │  Raise mowing    │  │  Reduce water    │  │  Change       │  │
│  │  height (+2mm)   │  │  (−20% ET rate)  │  │  species      │  │
│  └──────────────────┘  └──────────────────┘  └───────────────┘  │
│  ┌──────────────────┐  ┌──────────────────┐                      │
│  │  Add shade       │  │  Increase        │                      │
│  │  (−30% DLI)      │  │  traffic load    │                      │
│  └──────────────────┘  └──────────────────┘                      │
│                                                                  │
│  MANUAL PARAMETERS                                               │
│                                                                  │
│  BASELINE                    ALTERNATE                           │
│  ┌─────────────────────────┐ ┌─────────────────────────┐        │
│  │ Mowing height: 4mm      │ │ Mowing height: [6mm]    │        │
│  │ ET rate: 1.0 × Kc       │ │ ET rate: [0.8 × Kc]    │        │
│  │ Shade DLI: 22 mol/m²/d  │ │ Shade DLI: [___]        │        │
│  │ Traffic: 3 match/wk     │ │ Traffic: [___]          │        │
│  │ Species: Bentgrass      │ │ Species: [Couch ▼]      │        │
│  └─────────────────────────┘ └─────────────────────────┘        │
│                                                                  │
│  [Run Comparison]                                                │
└──────────────────────────────────────────────────────────────────┘
```

### ② Comparison Table

```
┌──────────────────────────────────────────────────────────────────────┐
│  COMPARISON RESULTS                                                  │
│                                                                      │
│  ┌───────────────────────┬────────────────────┬────────────────────┐ │
│  │ Metric                │ BASELINE           │ ALTERNATE          │ │
│  │                       │ (current)          │ (6mm HOC, couch)   │ │
│  ├───────────────────────┼────────────────────┼────────────────────┤ │
│  │ Disease Risk          │ HIGH 78%       🔴  │ MODERATE 52%   🟡  │ │
│  │ Growth Potential      │ 72%                │ 61%            ↓   │ │
│  │ Stress Index          │ Moderate (45)      │ Low (28)       ✅  │ │
│  │ Weekly Irrigation     │ 18 mm              │ 14 mm          ↓   │ │
│  │ N Requirement         │ 120 kg/ha/yr       │ 96 kg/ha/yr    ↓   │ │
│  │ Recovery Window       │ 5 days             │ 7 days         ↑   │ │
│  │ Wear Resistance       │ Good (7.2)         │ Good (7.4)     ↑   │ │
│  │ Traffic Capacity      │ 45% used           │ 38% used       ↓   │ │
│  │ 14-day Outlook        │ Critical 3d/14     │ Critical 1d/14 ✅  │ │
│  │ Shade / DLI           │ 22 mol/m²/day      │ 22 mol/m²/day  =   │ │
│  │ Water Quality         │ SAR 3.2 Moderate   │ SAR 3.2 Moderate = │ │
│  └───────────────────────┴────────────────────┴────────────────────┘ │
│                                                                      │
│  Delta:  ↓ better  ↑ worse  ✅ improvement  🔴 alert               │
└──────────────────────────────────────────────────────────────────────┘
```

**Метрики по движкам (из `scenario-export.js` v1.1.0):**
- Disease: `disease.riskPercent`, `disease.primaryDisease`, `disease.trajectory`
- Growth: `climate.gp`, `climate.gpThermal`, `climate.gpMoisture`
- Stress: `stress.index`, `stress.category`, `stress.drivers`
- Irrigation: `irrigation.weeklyNeed`, `irrigation.leachingRequirement`
- Nitrogen: `nutrition.recommendedAnnual`, `nutrition.status`
- Traffic/Wear: `wear.totalLoad`, `wear.recoveryCapacity`, `wear.ratio`, `wear.status`
- 14-day Outlook: `stress.peakScore`, `stress.criticalDays`, `stress.trend`
- Shade/DLI: `shade.DLI_total`, `shade.status`, `shade.deficit`
- Water: `water.sar`, `water.sodiumHazard`, `water.ec`

**Confidence статус** (из `gaip-scenario-engine.js` CONFIDENCE_LEVELS):
- `computed` (High/Medium/Low) — движок запустился с полными/частичными данными
- `estimated` — движок запустился с дефолтными значениями
- `unavailable` — движок не запустился

### ③ Confidence Summary

```
┌──────────────────────────────────────────────────────────────┐
│  CONFIDENCE                                                  │
│                                                              │
│  ● Disease    High   · Sensor temp + forecast data          │
│  ● Growth     High   · Climate module v2.1                  │
│  ● Stress     Medium · Estimated leaf wetness               │
│  ● Irrigation High   · VWC sensor + ET₀                     │
│  ● Nitrogen   Medium · No recent soil test                  │
│  ● Wear       High   · Traffic data + OM test               │
│  ● Water      High   · Water test on file                   │
└──────────────────────────────────────────────────────────────┘
```

**Пустое состояние (анализ не запускался):**
```
┌──────────────────────────────────────────────────────────────┐
│  ⚗  Scenario Comparison                                      │
│                                                              │
│  Для сравнения сценариев нужны данные базового анализа.     │
│                                                              │
│  • Запустите анализ  [→ Dashboard ↻ Re-run]                  │
│                                                              │
│  После запуска выберите пресет или задайте параметры        │
│  вручную и нажмите Run Comparison.                          │
└──────────────────────────────────────────────────────────────┘
```

**Ограничение:** сценарии не сохраняются между сессиями (нет backend для хранения). Единственное персистентное действие — экспорт в Word.

---

## 4. /reports/accuracy — Forecast Accuracy

**Движки:** `prediction-logger.js` v1.0.0, `outcome-capture-ui.js` v1.2.0, `benchmark-chart.js`, `engine-confidence.js`, `confidence-ui-integration.js`

**Принцип:** замыкает цикл — сравнивает то, что движки предсказали, с тем, что произошло. Два слоя:
1. **Engine Confidence** — статическая оценка качества входных данных (нет анализа истории, только оценка текущих источников)
2. **Prediction Tracking** — динамическая: что предсказал движок → что ввёл пользователь как фактический исход

### Структура страницы

```
┌─────────────────────────────────────────────────────────────────┐
│  СТРАНИЦА: Forecast Accuracy                                    │
│  Subtitle: Site name · Tracking since [first prediction date]  │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│  ① ENGINE CONFIDENCE SCORES                                     │
│     Текущее качество данных по каждому движку                  │
│                                                                 │
│  ② PENDING OUTCOMES                                             │
│     Прогнозы в окне ожидания — ждут подтверждения результата   │
│                                                                 │
│  ③ ACCURACY HISTORY                                             │
│     Зафиксированные исходы: лучше / как ожидалось / хуже       │
│                                                                 │
│  ④ BENCHMARK CHART                                              │
│     Историческая точность по модулям                           │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘
```

### ① Engine Confidence Scores

```
┌──────────────────────────────────────────────────────────────────┐
│  DATA CONFIDENCE                                                 │
│                                                                  │
│  ┌─────────────────┬──────────┬─────────────────────────────┐   │
│  │ Engine          │ Conf.    │ Что снижает уверенность      │   │
│  ├─────────────────┼──────────┼─────────────────────────────┤   │
│  │ Disease Risk    │ ●Medium  │ Leaf wetness estimated       │   │
│  │ Growth Potential│ ●High    │ —                            │   │
│  │ Stress Index    │ ●Medium  │ Leaf wetness estimated       │   │
│  │ Irrigation      │ ●High    │ —                            │   │
│  │ Soil Nutrition  │ ●Low     │ Soil test > 90 days old      │   │
│  │ PGR             │ ●High    │ —                            │   │
│  │ Water Quality   │ ●Medium  │ No recent water test         │   │
│  │ Pre-emergent    │ ●High    │ —                            │   │
│  └─────────────────┴──────────┴─────────────────────────────┘   │
│                                                                  │
│  How to improve:                                                 │
│  ● Upload soil test < 60 days old  [→ Soil Tests]               │
│  ● Upload recent water analysis    [→ Water Tests]              │
└──────────────────────────────────────────────────────────────────┘
```

**Источник:** `engine-confidence.js` — per-engine confidence score + reason list. Данные уже существуют; страница показывает их без новых вычислений.

**Важно:** агрегированный "overall accuracy" индекс не строим — его нет в коде. Только per-engine.

---

### ② Pending Outcomes

```
┌──────────────────────────────────────────────────────────────────┐
│  PENDING OUTCOMES                         3 awaiting review      │
│                                                                  │
│  [✅ Mark all as expected]                                        │
│                                                                  │
│  🦠  Disease Risk (2 pending)                                    │
│  ├─ Dollar Spot risk HIGH (15 May) — outcome window: 20–22 May  │
│  │  [Better ✅]  [As predicted 🎯]  [Worse ⚠]                   │
│  └─ Brown Patch risk MODERATE (15 May) — window: 20–22 May     │
│     [Better ✅]  [As predicted 🎯]  [Worse ⚠]                   │
│                                                                  │
│  📐  PGR Timing (1 pending)                                      │
│  └─ Reapplication window: 21 May — outcome window: 28 May–4 Jun │
│     [Followed recommendation]  [Modified]  [Did not act]        │
└──────────────────────────────────────────────────────────────────┘
```

**Workflow (из `outcome-capture-ui.js` v1.2.0):**
1. REST GET `/gilba/v1/predictions/pending/{site_id}` — список pending
2. Группировка по модулю: `disease`, `pgr`, `stress`, `soil`, `water`, `climate`
3. Быстрый путь: "Mark all as expected" — одна кнопка для всех
4. Модульный путь: кнопки на заголовке группы
5. Индивидуальный путь: раскрыть prediction → выбрать исход + опциональные заметки
6. POST `/gilba/v1/outcomes` — запись исхода

**Outcome windows по модулю (из `prediction-logger.js` CONFIG):**
- Disease: 3–7 дней
- Dollar Spot, Brown Patch (температурно-чувствительные): 5–7 дней
- PGR: 14–21 дней
- Stress: 7–14 дней
- Soil: 28–42 дней
- Water: 60–90 дней
- Climate: 25–35 дней

**Пустое состояние (нет pending predictions):**
```
┌──────────────────────────────────────────────────────────────┐
│  PENDING OUTCOMES                                            │
│                                                              │
│  Нет прогнозов в окне ожидания.                             │
│                                                              │
│  Предсказания фиксируются автоматически при каждом          │
│  запуске анализа и появляются здесь после истечения         │
│  outcome window.                                            │
└──────────────────────────────────────────────────────────────┘
```

---

### ③ Accuracy History

```
┌──────────────────────────────────────────────────────────────────┐
│  ACCURACY HISTORY          Last 90 days  [30d ▼]                 │
│                                                                  │
│  ┌─────────────────┬───────────┬────────────┬──────────────────┐ │
│  │ Module          │ Better ✅  │ As pred 🎯 │ Worse ⚠          │ │
│  ├─────────────────┼───────────┼────────────┼──────────────────┤ │
│  │ Disease         │  2 (15%)  │ 10 (77%)   │  1 (8%)          │ │
│  │ PGR Timing      │  0 (0%)   │  8 (100%)  │  0 (0%)          │ │
│  │ Stress          │  1 (17%)  │  5 (83%)   │  0 (0%)          │ │
│  │ Soil Nutrition  │  0 (0%)   │  3 (75%)   │  1 (25%)         │ │
│  │ Water Quality   │  0 (0%)   │  1 (100%)  │  0 (0%)          │ │
│  └─────────────────┴───────────┴────────────┴──────────────────┘ │
│                                                                  │
│  Source: REST GET /gilba/v1/outcomes/history/{site_id}          │
└──────────────────────────────────────────────────────────────────┘
```

---

### ④ Benchmark Chart

**Источник:** `benchmark-chart.js` + REST `/gilba/v1/benchmark/{site_id}`

```
┌──────────────────────────────────────────────────────────────────┐
│  BENCHMARK                                                       │
│                                                                  │
│  [Disease Risk — predicted vs actual over 12 months]            │
│                                                                  │
│   100% ─────────────────────────────────────────────────────── │
│    80% ─────────────     ─────────────────────────────────────  │
│    60% ─       ─────────       ──────────────────────────       │
│    40% ─                 ─────                          ─────   │
│         Jan  Feb  Mar  Apr  May  Jun  Jul  Aug  Sep  Oct  Nov   │
│         ── Predicted    ── Actual                               │
│                                                                  │
│  Module:  [Disease Risk ▼]   Period: [12 months ▼]              │
└──────────────────────────────────────────────────────────────────┘
```

**Пустое состояние (< 3 месяцев данных):**
```
┌──────────────────────────────────────────────────────────────┐
│  BENCHMARK                                                   │
│                                                              │
│  Benchmark chart появится после накопления 3+ месяцев       │
│  подтверждённых прогнозов.                                  │
│                                                              │
│  Сейчас записано: 13 прогнозов · 8 подтверждено             │
│  Нужно ещё: ~6–8 недель регулярного использования           │
└──────────────────────────────────────────────────────────────┘
```

---

## Данные из старого хаба — полный перенос

| Движок (старый хаб)                                       | Секция на /reports               | Действие         |
| --------------------------------------------------------- | -------------------------------- | ---------------- |
| `word-export.js` v2.4.0                                   | `/reports/export` ① Full Report  | Consolidate      |
| `word-export-combined.js` v1.3.0                          | `/reports/export` ② Combined     | Consolidate      |
| `gaip-ical-export.js` v1.0.0                              | `/reports/export` ③ Calendar     | Move             |
| `gssh-led-export.js` v1.0.0                               | `/reports/export` ④ LED          | Move (stadium only) |
| `FORENSIC_RECORD` (hub-tissue-v3.js:1874)                 | `/reports/forensic` ①②③          | Surface as page  |
| `exportForensicRecordPDF()` (hub-tissue-v3.js:1959)       | `/reports/forensic` Export PDF   | Reuse            |
| `gaip-scenario-engine.js` v2.1.1                          | `/reports/scenarios`             | Move             |
| `gaip-whatif-ui.js`                                       | `/reports/scenarios` Setup       | Move             |
| `scenario-presets.js`                                     | `/reports/scenarios` Presets     | Move             |
| `scenario-export.js` v1.1.0                               | `/reports/scenarios` Word export | Move             |
| `prediction-logger.js` v1.0.0                             | `/reports/accuracy` Tracking     | Move + surface   |
| `outcome-capture-ui.js` v1.2.0                            | `/reports/accuracy` Pending      | Move + surface   |
| `benchmark-chart.js`                                      | `/reports/accuracy` Benchmark    | Move             |
| `engine-confidence.js` + `confidence-ui-integration.js`   | `/reports/accuracy` Confidence   | Reuse            |

**REST endpoints (уже существуют, использовать as-is):**
- `/gilba/v1/benchmark/{site_id}` — benchmark chart data
- `/gilba/v1/predictions` — write predictions
- `/gilba/v1/predictions/pending/{site_id}` — pending list
- `/gilba/v1/calibration/{site_id}` — calibration data
- `/gilba/v1/outcomes` — write outcomes
- `/gilba/v1/outcomes/batch` — batch outcomes
- `/gilba/v1/outcomes/history/{site_id}` — history chart
- `/gilba/v1/spray-log` (для iCal export — последние 90 дней)

---

## Пустые состояния — общий принцип (тот же что в /plan)

```
[иконка]  [Название секции]

Для [функция] нужны [что именно].

• [Конкретный шаг]  [→ Ссылка]

После этого [результат] станет доступен.
```

Никаких размытых «данных недостаточно» — всегда конкретный шаг и прямая ссылка.

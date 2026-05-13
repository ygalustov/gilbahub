---
name: final-ia-and-ui-redesign
overview: "Финальная информационная архитектура и UI-редизайн Gilba Agronomic Intelligence Hub: переход от technical-dump формата к decision-first dashboard с тиерной структурой, с явным разделением переупаковки существующего функционала и новых фич."
todos:
  - id: phase1-topbar
    content: "Phase 1: Top bar redesign — Site Switcher с status dot + multi-site overview, context pills, Analysis timestamp (rename from 'Last run' для ясности что это analysis run, не sensor fetch), ↻ Re-run analysis button, stale-analysis indicator (⚠ New data imported — amber badge когда данные импортированы после последнего запуска; текст зависит от типа события: lab/sensor/manual; spec в секции 8.1a)"
    status: pending
  - id: phase1-banners
    content: "Phase 1: Status banners — убраны. Stale data, Sensor offline, Onboarding incomplete — вся информация покрыта Data Confidence card внизу дашборда"
    status: done
  - id: phase1-fab
    content: "Phase 1: Quick Capture FAB — floating + button с 5-типовым sheet, заменяет retired Field Log page"
    status: pending
  - id: phase1-dashboard-tiers
    content: "Phase 1: Dashboard Tier 0–5 layout (verdict bar, action queue, vital signs, windows row, conditions strip, evidence one-liner)"
    status: pending
  - id: phase1-action-queue
    content: "Phase 1: Action Queue — DSM exposed с реальными bucket labels (Today / This week / Watching + Deferred), headline (Act on this today / Plan this week / All clear), minimal decision-first cards (4 строки: title + reason + consequence + buttons), side panel для drill-down с full trajectory/fork/evidence"
    status: pending
  - id: phase1-vital-signs
    content: "Phase 1: 5 Vital Signs cards — Growth Potential (с Thermal breakdown), Disease Risk (trajectory), Stress Index (driver line + sparkline), Soil Moisture VWC (range bar), Irrigation Plan (weekly need + sign-translated deficit). Все с ⓘ icons и popover content"
    status: pending
  - id: phase1-mobile
    content: "Phase 1: Mobile UX — bottom tab bar, full-screen sheet drill-downs, swipeable action cards"
    status: pending
  - id: phase1-retire
    content: "Phase 1: Retire Field Log и Morning Briefing как отдельные страницы, логику перенести в FAB и Site Switcher"
    status: pending
  - id: phase2-data-pages
    content: "Phase 2: Страницы /data/observations, /data/mowing-log, /data/site-notes, /data/photos (данные уже в БД)"
    status: pending
isProject: false
---

# Финальная IA и UI-редизайн Gilba Hub

## 1. Решения по scope (зафиксированы)

**Убрано из IA:**

- `/library/`* (Varieties, Diseases, Products, Methodologies)
- `/help/`* (Getting started, Methodologies, Sensors, FAQ, Video tour)
- `/settings/activity-log` (audit trail)
- `/settings/team` (multi-user roles)
- `/tasks` standalone (task management остаётся встроенным в Dashboard Tier 1)
- `/notifications` inbox (alerts остаются push-only через SMS/Email)

**Оставлено и подтверждено:**

- `/data/observations`, `/data/mowing-log`, `/data/site-notes`, `/data/photos` (данные уже есть в БД на git)
- Quick Capture FAB на всех страницах

**Дополнительно убрано (не существует в текущей версии):**

- `/plan/templates` (programme presets) — нет backend
- `/data/imports-history` — нет logging
- `/analysis/ai-interpretations` history — Claude работает, но cache/history нет
- Smart home routing с per-user setting — упрощено до фиксированного `/` → `/dashboard` текущего сайта
- `/analysis/coherence` page + Coherence banner — `contradiction-detector.js` остаётся как background-логика без UI surfacing
- Старый multi-page `/plan/` раздел (calendar/nutrition/spray/irrigation/pgr/preemergent как отдельные страницы) — заменён единой `/plan` страницей (см. Section 2 + Section 12). Editable plans, unified timeline view, drag-and-drop calendar — не строим.
- `**/reports/branding`** — дублирует `/settings/branding` (одна логика `gilba_logo_`* AJAX)
- `**/settings/integrations`** — APVMA публичный endpoint без auth, Claude хранится в `wp-config.php` константой, Open-Meteo бесплатный — управлять нечем
- `**/settings/account`** — стандартная WP-страница `/wp-admin/profile.php` достаточна

---

## 2. Финальная карта сайта

```
/                           Redirect → /dashboard (текущий выбранный site)
/dashboard                  Decision-first Dashboard (Tier 0–5)
/onboarding/step-1..5       Site setup wizard (formal routes)

/events                     Event planner (matches/tournaments)
                              uses event-planner-engine.js + venue-readiness-ui.js
                              ⚠ НЕ строим в этом редизайне — движок и UI написаны,
                              но страница недоступна в текущей версии (gssh-event-planner-btn
                              не рендерится нигде в DOM). Вынести на отдельную страницу —
                              отдельная задача вне scope этого UI-редизайна.

/data
  /data/soil                Soil tests
  /data/tissue              Tissue tests
  /data/water               Water tests
  /data/loi                 LOI / OM
  /data/sensors             Sensor data (Hydrosight/SpecConnect)
  /data/spray-log           Spray applications log
  /data/observations        Field Log: disease observations [NEW UI]
  /data/mowing-log          Field Log: mowing entries [NEW UI]
  /data/site-notes          Field Log: notes [NEW UI]
  /data/photos              Field Log: photo gallery [NEW UI]
  /data/templates           CSV import templates

/analysis
  /analysis/disease              Disease engine deep dive
  /analysis/growth-light         Growth & light analysis (includes climate engine context)
  /analysis/stress               Stress trajectory
  /analysis/soil-nutrition       Soil + nutrition deep dive
  /analysis/water                Water quality + blending
  /analysis/pgr-irrigation       PGR + irrigation analysis
  /analysis/preemergent          Pre-emergent timing
  /analysis/nutrition-program    Annual nutrition plan generator [отдельный nav item]
  /analysis/accuracy             Historical benchmark / forecast accuracy

/plan                       Unified planning page — все schedules в одном месте
                              Nutrition Program, Seasonal N plan, Recovery calendar,
                              PGR timing, Pre-emergent timing
                              [NEW PAGE; все движки уже существуют]

/reports
  /reports/export           Word/PDF/iCal exports
  /reports/forensic         Forensic decision record (FORENSIC_RECORD)
  /reports/scenarios        Scenario lock comparisons
  /reports/accuracy         Accuracy reports

/stadium                    Stadium shade analysis sub-hub

/settings
  /settings/profile         Turf profile, methodology
  /settings/sites           Sites management
  /settings/sensors         Sensor integrations
  /settings/notifications   SMS/Email alert thresholds
  /settings/branding        Logo, colors
```

**Note:** Account management — стандартная WP `/wp-admin/profile.php`, не дублируем в плагине.

---

## 3. Top Bar / Global UI

```
[Logo]  [Site Switcher ▼]  [Site context pills]  [Analysis: 5min ago · ↻ Re-run]      [⚙ Settings]
```

- **Site Switcher dropdown** — enriched: список всех сайтов с status dot (зелёный/янтарный/красный по `worstStatus()` field parameters: disease/GP/VWC/PGR), сорт по риску, mini-метрики (GP, Disease %, VWC%), action row (наследуется логика из retired Morning Briefing) [NEW UI]
- **Site context pills** — `Buffalograss · SLAN · Temperate AU` [NEW UI компонент, данные есть]
- **Analysis timestamp + ↻ Re-run analysis** в шапке [NEW UI; floating run button retired]. Label `Analysis: 5min ago` явно отличает analysis run от sensor fetch (sensor freshness показывается отдельно в Data Confidence panel снизу)
- **Status banners row** — убрана. Stale data / Sensor offline / Onboarding incomplete покрыты Data Confidence card внизу дашборда. Баннеры создавали шум без добавленной ценности.

**Quick Capture FAB** (mobile + tablet):

- Круглая кнопка `+` правый-низ, `position: fixed`
- Тап → bottom sheet с 5 типами: Spray / Disease / TDR / Mow / Note
- Открывает existing Field Log capture flow в sheet режиме
- Desktop: можно скрыть или показать в top bar как `+ Quick log` button [NEW UI; existing capture logic в `assets/gaip-field-log.js`]

---

## 4. Dashboard — Tier 0–5 layout

### Tier 0 — Verdict bar (единая строка-вердикт)

Цвет и текст определяются **состоянием поля** (worst parameter across diseaseDecision / gpDecision / vwcDecision / pgrDecision из `gaip-morning-briefing.js`) — не DSM action queue.

**Логика цвета (`worstStatus()` — ~10 строк новой логики поверх существующих функций):**


| Цвет     | Условие                                         | Пример текста                                           |
| -------- | ----------------------------------------------- | ------------------------------------------------------- |
| 🔴 Red   | любой параметр: `high` / `poor` / `overdue`     | `⚠ Dollar Spot risk HIGH — forecast 69% tomorrow`       |
| 🟡 Amber | любой параметр: `moderate` / `due`              | `Dollar Spot pressure building (32%). Monitor closely.` |
| 🟢 Green | все параметры: `ok` / `good` / `low` / `active` | `All parameters within range`                           |


Текст берётся дословно из `.text` поля соответствующей decision-функции — не придумывается новый. [NEW UI; данные из `gaip-morning-briefing.js` `diseaseDecision` / `gpDecision` / `vwcDecision` / `pgrDecision`]

### Tier 1 — Action Queue (DSM exposed как visible task list)

**Headline:** `Act on this today` / `Plan this week` / `All clear` — точные строки из [gaip-decision-engine.js:597](assets/gaip-decision-engine.js).

**Секции с counter `(N done / Total resolved)`** — реальная DSM структура из [gaip-decision-engine.js:600-602](assets/gaip-decision-engine.js):

- **TODAY** (red, `act-on` tier) — items требующие действия сегодня
- **THIS WEEK** (amber, `plan-on` tier) — scheduled in days, not today
- **WATCHING** (grey, `watch` tier) — observation-only, тот же `Commit ...` button
- **DEFERRED** (collapsible, state-based, не tier) — отложенные через `defer()`, отображаются если есть items

**Принцип action card: decision-first minimum.** Карточка отвечает на 4 вопроса в 4 строках:

1. **Что делать?** → title (`Apply fungicide today`)
2. **Почему сейчас?** → one-line reason с числами (current vs threshold + trend)
3. **Что будет если отложить?** → one-line consequence (DSM `svConseq`)
4. **Уверены ли?** → confidence chip

Минимальная action card (всегда такая, без expanded variants):

```
[bucket dot] [confidence] [category › species]
Action title (bold)
Risk 35% (threshold 20%) · holding stable
If delayed: spray cost doubles
[Commit — <item-specific>]  [Defer]  View Details →
```

**Side panel для деталей:** клик по карточке (или `View Details →`) открывает side panel с полным drill-down: 7-day trajectory chart, ACT NOW vs IF DELAYED two-pane, full evidence list, supporting metrics, forensic record. Side panel остаётся на dashboard — не переход на отдельную страницу.

**Что НЕ показывать на самой карточке (избежать дублирования):**

- ❌ Большой `CURRENT RISK 35%` блок — дублирует one-line reason (line 3)
- ❌ Отдельный `7-DAY FORECAST · stable` блок — trend label inline в reason
- ❌ ACT NOW vs IF DELAYED two-pane — переезжает в side panel
- ❌ Отдельный `IF YOU DELAY: ...` блок — это и есть line 4 (consequence)

Поведение кнопок (без изменений в DSM):

- Confidence chip: `live` / `high` / `estimate` (из [gaip-decision-engine.js:36](assets/gaip-decision-engine.js) `confKey`)
- Item-specific `Commit ...` label (DSM `forkActDyn`/`forkActLbl`) → state `committed`, action заменяется на `commitConsequence`
- Defer → friction modal с reason (act-on tier), direct defer (plan-on/watch)

### Tier 2 — 5 Vital signs cards

Каждая карточка имеет main metric + context line + trend + ⓘ icons на технических терминах для plain-language popover (см. секцию 8.12 Glossary).

- **Disease**: severity word (Low/Moderate/High/Severe) — XL bold; **risk numbers L bold (numbers-first hierarchy)**, disease name M regular под цифрой; trajectory line одного из 4 patterns (`33% today → 78% in 5 days` / `33% today` + secondary warning row `⚠ 69% in 1 day` / `33% today → 18% in 5 days ↓` / `33% today`) — match existing logic [daily-dashboard.js:645-727](assets/daily-dashboard.js) с обновлённым copy (`in N day(s)` вместо `day N`); single-disease на карточке, multi-disease breakdown в side panel
- **Soil Moisture (VWC)**: `XX %` headline + range bar с 4 markers `WP X% / TRIGGER X% / FC X% / current ▲` (site-specific from `irrigation-scheduler.thresholds` per soil type — USGA greens [12,15], sandy loam [17,20], loam [22,27] и т.д.) + bottom message — literal engine recommendation string (`"Soil is at or above field capacity. No irrigation needed."` / `"Apply Xmm..."` / `"Xmm buffer before irrigation trigger"`) [NEW UI vis; data via [irrigation-scheduler.js:1114-1148](assets/irrigation-scheduler.js); NEW UI binding — decision-engine использует hardcoded [15, 25], это bug fix item для Phase 1]
- **Irrigation Plan**: `7mm Weekly requirement · ↓ Ahead by 6mm — skip cycle` — недельное планирование + sign-translated deficit [data via `GAIP_IrrigationResults.weeklyNeed` + `currentDeficit` из [daily-dashboard.js:858-873](assets/daily-dashboard.js)]
- **Stress**: compact summary — `Index XX /100` (composite weighted score, не percentage) + `Driven by: <Stressor> <RawValue>%` (primary stressor + его raw 0–100 component value) + trajectory line `↓ Decreasing — peak in N day(s)` + один overall progress bar. Multi-factor bars (все 6 компонентов) и 14-day sparkline уходят в side panel при тапе. **Изменения от existing UI:** убрать misnaming label `Climate Stress`, убрать дубль `19% today`, заменить цветной trend pill на neutral arrow, добавить `Driven by:` line (engine уже считает `primaryStressor` из [stress-trajectory-engine-pure.js:963](assets/stress-trajectory-engine-pure.js), widget просто не читает).
- **Growth**: `GP 62%` + forecast `↓ 55% in 8 days` (neutral arrow, длинный формат с plural rule) + bottom info line объединяющая категорию и thermal score: `Cool-Season · Thermal 26%` (pure stand) или `Mixed C3/C4 · C3: X% · C4: Y% Thermal` (mixed) [NEW UI vis; data via `climate-module-v2.1-dual-metrics.js` `isWarmSeason()` + existing `c3Percent`/`c4Percent` из [daily-dashboard.js:620-629](assets/daily-dashboard.js)]

### Tier 3 — Time-Sensitive Windows row

Chips по горизонтали: Pre-emergent · PGR reapply · Overseed [NEW UI; data exists]

### Tier 4 — Conditions strip (объединяет Current + Rain Today)

```
✅ OK to spray · 21°C · RH 62% · Wind 8 km/h · Rain 0% next 6h · Dew 10pm
```

- 3-day mini forecast strip [NEW UI; data exists]

### Tier 5 — Evidence health one-liner

```
Soil ✓ 12d · Tissue ⚠ 47d · Water ✓ 8d · Spray log ✓ today · Sensor live
```

[NEW UI; data exists in evidence panel в другой форме]

### Layer 6 — Deep analysis (collapsed cards)

Существующие detailed panels остаются в свёрнутом виде с Expand:

- Disease, Climate, Stress, PGR, Pre-emergent, Soil Nutrition, Forensic, Historical benchmark

---

## 5. Mobile UX

- Bottom tab bar: Dashboard / Data / Analysis / Reports / More [NEW UI]
- Quick Capture FAB глобально
- Tier 1 action cards как полноэкранные swipeable
- Drill-down из vital signs → full-screen sheet
- Top bar: только Logo + Site Switcher + ↻

---

## 6. Phase разбивка (рекомендация)

### Phase 1 (MVP — фокус на decision UX)

- Top bar redesign (Site Switcher с status, pills, Analysis timestamp, ↻ Re-run)
- ~~Status banners~~ — убраны (покрыто Data Confidence)
- Quick Capture FAB
- Dashboard Tier 0–5 layout
- Action Queue как visible list (DSM exposed)
- Confidence chips везде
- Mobile bottom tab bar

### Phase 2 (data visibility)

- `/data/observations`, `/data/mowing-log`, `/data/site-notes`, `/data/photos`

### Phase 3

(пусто — все ранее намеченные новые backend фичи убраны как «не существуют в текущей версии»; этот раздел можно использовать в будущем при появлении новых требований)

---

## 7. Что НЕ меняется (бэкенд engines)

Все JS-движки и PHP-классы остаются как есть. Изменения только в presentation layer:

- `assets/daily-dashboard.js` — переписать под Tier 2 vital signs cards
- `assets/gaip-decision-ui.js` — переписать под Tier 1 Action Queue
- `assets/priority-action-queue.js` — слить с Tier 1
- `assets/tab-navigation.js` — заменить на новый routing
- `assets/card-layout-redesign.js` — оставить для Layer 6 deep panels
- `assets/gaip-field-log.js` — capture logic оставить, UI обернуть в sheet для FAB
- `assets/gaip-morning-briefing.js` — retire, логику decision rows перенести в Site Switcher dropdown

PHP shortcodes:

- `[gaip_hub]` — переписать render под новую структуру
- `[gaip_field_log]` — retire
- `[gaip_morning_briefing]` — retire

---

## 8. Designer brief — Dashboard

Главный принцип: **дизайн только на основе существующих данных в системе**. Каждый элемент ниже привязан к источнику в коде. Если источника нет — это фантом, не рисовать.

### 8.1. Top Bar

```
[Logo]  [Site Switcher ▼ status-dot]  [Site context pills]  [Analysis: 5min ago · ↻ Re-run]
```


| Элемент                        | Данные                                              | Источник в коде                                                                             |
| ------------------------------ | --------------------------------------------------- | ------------------------------------------------------------------------------------------- |
| Logo                           | site logo image URL                                 | `gilba_logo_get` AJAX                                                                       |
| Site name                      | current site label                                  | `gilba_sites_load` AJAX → `currentSite.label`                                               |
| Site Switcher dropdown         | список сайтов + worst-alert status dot              | refactor `site-selector-ui.js` + reuse `gaip-morning-briefing.js` decision functions        |
| Status dot color               | green/amber/red по `worstStatus()` field parameters | `gaip-morning-briefing.js` `diseaseDecision` / `gpDecision` / `vwcDecision` / `pgrDecision` |
| Site context pills             | `Buffalograss · SLAN · Cool-Season`                 | `gaip-site-context.js` + `regional-profiles.js` (`warmSeason` boolean)                      |
| C3/C4 / Warm/Cool-Season label | `turf.species.c3Fraction` / `c4Fraction`            | [climate-engine.js:27](assets/climate-engine.js) `getOptimalTempRange`                      |
| Analysis timestamp             | `FORENSIC_RECORD.timestamp` (last orchestrator run) | [hub-tissue-v3.js:1831](assets/hub-tissue-v3.js) `FORENSIC_RECORD`                          |
| Re-run analysis button         | trigger orchestrator pipeline                       | replace `floating-run-button.js`                                                            |


**Naming convention:**

- `Analysis: 5min ago` — относится к **analysis run** (orchestrator пересчитал все engines)
- Sensor freshness (Hydrosight `getLastFetch()`) показывается **отдельно** в Data Confidence panel снизу dashboard как `Sensors / Hydrosight / 3m ago`
- Это два разных freshness — analysis = computation, sensors = raw data fetch (обновляется auto каждые 30min независимо)

**Состояния:**

- Site Switcher: 1 site / many sites (5+ → scrollable list)
- Status dot: green / amber / red / grey (no data)
- Analysis timestamp: `Analysis: just-now` / `Analysis: Xm ago` / `Analysis: Xh ago` / `Analysis: >24h ago` (warning state — рекомендуется ↻ Re-run)
- Stale analysis indicator: отсутствует / `⚠ New data` amber badge (см. секцию 8.1a)

### 8.1a. Stale analysis indicator

**Суть:** если данные (лаб тесты, импорт) изменились после последнего запуска анализа — показать amber индикатор рядом с кнопкой ↻ Re-run. Пользователь видит что результаты могут быть устаревшими и нужно перезапустить.

**Реализация — существующие события, новой логики в движках нет:**

- `gaip:samples-imported`, `gaip:sample-updated`, `gaip:sample-added` — диспатчятся `sample-manager.js` при любом изменении данных. Слушаем эти события → сохраняем `lastDataChange = Date.now()` в localStorage.
- `FORENSIC_RECORD.timestamp` ([hub-tissue-v3.js:1882](assets/hub-tissue-v3.js)) — время последнего запуска анализа.
- Сравнение: если `lastDataChange > FORENSIC_RECORD.timestamp` → показать индикатор.
- После успешного `computeAll()` → сбросить индикатор.

**Top bar — два состояния:**

```
// Нормальное (данные актуальны)
Analysis: 5min ago  [↻ Re-run]

// Stale (импортированы новые данные после анализа)
Analysis: 5min ago  ⚠ New data imported  [↻ Re-run]
```

- `⚠ New data imported` — amber текст/badge, не banner. Inline рядом с timestamp, не отдельная строка.
- Клик на `↻ Re-run` запускает анализ и сбрасывает индикатор.

**На /analysis/ страницах — тонкий amber banner вверху:**

```
// Для импорта лабораторных данных:
⚠ New soil test imported — re-run analysis to include it   [↻ Re-run now]

// Для импорта сенсора:
⚠ New sensor data imported — re-run analysis to include the latest readings   [↻ Re-run now]

// Для ручного изменения данных:
⚠ Soil data updated — re-run analysis to include the changes   [↻ Re-run now]
```

- Показывается только если `lastDataChange > FORENSIC_RECORD.timestamp`.
- Текст определяется по типу события из `_changedInputs`: `gaip:samples-imported` / `gaip:sensorDataImported` / `soil.*` / `tissue.*` / `water.*`.
- `[↻ Re-run now]` — inline кнопка, тот же action что и Re-run в top bar.
- Banner исчезает после успешного перезапуска.

**На dashboard (Tier 0 — Verdict bar):** индикатор не дублируется — он уже виден в top bar. Verdict bar остаётся без изменений.

**Что НЕ делаем:**

- ❌ Не блокируем просмотр результатов — устаревшие данные лучше чем пустой экран.
- ❌ Не авто-запускаем анализ при импорте данных — пользователь контролирует когда запускать.
- ❌ Не показываем индикатор при изменении sensor данных (Hydrosight auto-refresh каждые 30min) — это не пользовательское действие, sensor freshness покрыта Data Confidence panel.

### 8.2. ~~Status banners row~~ — убрано

Stale data / Sensor offline / Onboarding incomplete не выводятся как баннеры под top bar. Вся эта информация покрыта **Data Confidence card** внизу дашборда — там видно каждый источник с иконкой ✓/⚠ и временем. Баннеры создавали шум и дублировали Data Confidence.

### 8.3. Conditions strip (Tier 4)

```
[icon] CURRENT 18°C Partly Cloudy 65% RH    [3-day forecast]    [SPRAY WINDOW Optimal (6hr)]
```


| Элемент           | Данные                      | Источник                                                          |
| ----------------- | --------------------------- | ----------------------------------------------------------------- |
| Current temp      | `weather.temp.current`      | climate-engine v2 / weather API                                   |
| Conditions text   | `weather.condition`         | weather API (Open-Meteo description)                              |
| RH%               | `weather.rh.current`        | climate-engine                                                    |
| 3-day forecast    | day labels + temp + rain mm | climate-engine `dailyPattern`                                     |
| Spray Window pill | OK / Risky / Avoid          | [spray-log-cascade.js](assets/spray-log-cascade.js) spray verdict |
| Hours remaining   | window expiry               | computed from optimal window end                                  |


**DLI в Conditions strip:** добавить `☀️ 8.3 mol/m²/d ⓘ` как погодной факт — без статуса (critical/optimal), без видовой интерпретации. Просто цифра рядом с temp/RH/wind. ⓘ icon открывает popover «Daily Light Integral — total light received today…» (см. секцию 8.12). Источник: `ambient-dli-integration.js` → `ambientDLI.current`. Видовая интерпретация (CRITICAL / ниже оптимума для Bentgrass) — только в Growth Potential side panel и `/analysis/growth-light`, не в strip.

**Note дизайнеру:** в плане я предлагал расширить strip до `21°C · RH · Wind · Rain · Dew`, но в текущем mockup только temp/RH/forecast. **Wind, Rain%-next-6h, Dew prediction** — данные есть в коде (climate-engine, dew-prediction-engine), но в mockup не выведены. Решить: оставить mockup-минимализм или расширить.

### 8.4. Today's Actions (Tier 1) — DSM exposed

**Headline (top of section)** — одна из 3 строк, точно как в DSM ([gaip-decision-engine.js:597](assets/gaip-decision-engine.js)):

- `Act on this today` (если есть act-on items)
- `Plan this week` (если только plan-on items)
- `All clear` (если только watch items)

**Важно:** headline Action Queue — отдельно от Verdict bar. Verdict bar цвет = field parameters (`worstStatus()`). Headline = DSM action tiers. Они могут не совпадать: например, field status RED (disease HIGH) при headline `Plan this week` (если spray уже запланирован).

**Bucket sections (точные labels из DSM ([gaip-decision-engine.js:600-602](assets/gaip-decision-engine.js))):**


| DSM tier (code)    | UI label      | Color      | Когда показывать                            |
| ------------------ | ------------- | ---------- | ------------------------------------------- |
| `act-on`           | **Today**     | red        | всегда если есть items                      |
| `plan-on`          | **This week** | amber      | всегда если есть items                      |
| `watch`            | **Watching**  | grey       | collapsible, по умолчанию свёрнут на mobile |
| `deferred` (state) | **Deferred**  | grey-amber | только если есть deferred, collapsible      |


**Action card layout — minimal decision-first (всегда такой, без variants):**

```
[bucket dot] [confidence] [category › species]
Action title (bold)
Risk 35% (threshold 20%) · holding stable
If delayed: spray cost doubles
[Commit — <item-specific>]  [Defer]  View Details →
```

**4 строки info, отвечают на 4 вопроса для решения:**

1. **Что делать?** → title (`Apply fungicide today`)
2. **Почему сейчас?** → reason line с числами (`Risk 35% (threshold 20%) · holding stable`)
3. **Что будет если отложить?** → consequence line (`If delayed: spray cost doubles`)
4. **Уверены ли?** → confidence chip

**Что НЕ показывать на карточке (избежать дублирования):**

- ❌ Большой `CURRENT RISK 35%` блок — дублирует reason line
- ❌ Отдельный `7-DAY FORECAST · stable` блок — trend label inline в reason
- ❌ ACT NOW vs IF DELAYED two-pane — переезжает в side panel
- ❌ Отдельный `IF YOU DELAY: ...` блок — это и есть consequence line

**Side panel для drill-down:** клик по карточке (или `View Details →`) открывает overlay side panel с полными деталями. Не переход на отдельную страницу — остаёмся на dashboard.

Side panel содержит:

- Полный 7-day trajectory chart (current → peak)
- ACT NOW vs IF DELAYED two-pane fork (item.actNowText / item.ifDelayedText)
- Detailed `IF YOU DELAY: <metric> → <projection> · <consequence>` строка
- Supporting evidence (источники данных, sample dates)
- Forensic record (run ID, timestamp)
- Link на `/analysis/{engine}` для full deep-dive страницы (если нужно ещё больше контекста)


| Элемент           | Где показано   | Данные                                                          | Источник                                                                       |
| ----------------- | -------------- | --------------------------------------------------------------- | ------------------------------------------------------------------------------ |
| Headline          | top of section | `Act on this today` / `Plan this week` / `All clear`            | [gaip-decision-engine.js:597](assets/gaip-decision-engine.js) `hl`             |
| Bucket labels     | dividers       | `Today` / `This week` / `Watching`                              | [gaip-decision-engine.js:600-602](assets/gaip-decision-engine.js) `counts[].w` |
| Bucket counts     | dividers       | `actCount` / `planCount` / `wKeys.length`                       | same `counts[].n`                                                              |
| Bucket colors     | dividers       | `r` (red) / `a` (amber) / `d` (dim)                             | same `counts[].nc`                                                             |
| Confidence chip   | card           | `live` / `high` / `estimate`                                    | [gaip-decision-engine.js:36](assets/gaip-decision-engine.js) `confKey`         |
| Category label    | card           | `disease` / `irrigation` / `pgr` / `nutrition` / `pre-emergent` | DSM item.id                                                                    |
| Species (disease) | card           | напр. `DOLLAR SPOT`                                             | top alert species name                                                         |
| Title (bold)      | card           | item.act                                                        | DSM item.act                                                                   |
| Reason line       | card           | `Risk X% (threshold Y%) · <trend>`                              | item.metric + trend label                                                      |
| Consequence line  | card           | `If delayed: <consequence>`                                     | DSM `svConseq` ([gaip-decision-engine.js:239](assets/gaip-decision-engine.js)) |
| Commit button     | card           | item-specific label                                             | DSM `forkActDyn` / `forkActLbl` (см. таблицу ниже)                             |
| Defer button      | card           | `defer(itemId, horizon)`                                        | [gaip-decision-ui.js:317](assets/gaip-decision-ui.js)                          |
| View Details →    | card           | open side panel                                                 | NEW UI behaviour (без backend)                                                 |
| Trend label       | side panel     | `stable` / `rising` / `falling`                                 | [gaip-decision-ui.js:82](assets/gaip-decision-ui.js)                           |
| 7-day trajectory  | side panel     | sparkline current → forecast                                    | climate-engine 7-day forecast                                                  |
| ACT NOW pane      | side panel     | item.actNowText                                                 | DSM item                                                                       |
| IF DELAYED pane   | side panel     | item.ifDelayedText                                              | DSM item                                                                       |
| Forensic record   | side panel     | run ID + timestamp                                              | [hub-tissue-v3.js](assets/hub-tissue-v3.js) `FORENSIC_RECORD`                  |


**Реальные DSM item types в коде:** `disease`, `irrigation`, `pgr`, `nutrition`, `pre-emergent`.

**Реальные labels кнопок в DSM (используй эти, не выдумывай):**


| Item type    | Реальный label кнопки                                                 | Source                                                            |
| ------------ | --------------------------------------------------------------------- | ----------------------------------------------------------------- |
| Disease      | `Commit — spray today` / `Commit to fungicide application today`      | [gaip-decision-engine.js:224,227](assets/gaip-decision-engine.js) |
| PGR          | `Commit to reapplication` / `Commit — window closes in Xd`            | [gaip-decision-engine.js:321,324](assets/gaip-decision-engine.js) |
| Pre-emergent | `Commit — one window this season` / `Commit to ordering pre-emergent` | [gaip-decision-engine.js:544,547](assets/gaip-decision-engine.js) |
| Irrigation   | `Commit to this decision` (default fallback, `forkActLbl: ''`)        | [gaip-decision-engine.js:399,484](assets/gaip-decision-engine.js) |
| Default      | `Commit to this decision`                                             | [gaip-decision-ui.js:307](assets/gaip-decision-ui.js)             |
| Defer label  | `Defer until` / `Defer until (confirm reason)` (act-on tier)          | [gaip-decision-ui.js:317](assets/gaip-decision-ui.js)             |


**Кнопки по tier (как сейчас в DSM, одинаковые для всех tier):**

- **TODAY (`act-on`), THIS WEEK (`plan-on`), WATCHING (`watch`):** одна и та же commit-кнопка с item-specific label + `Defer`. Разница только в defer-modal: `act-on` требует reason capture; `plan-on` и `watch` — direct defer.
- `**View Details →`** — NEW UI link на `/analysis/disease`, `/analysis/irrigation` и т.д. (без изменения backend)

**После клика (existing DSM behaviour, без изменений):**

- `Commit ...` → state становится `committed`, action заменяется на `commitConsequence` text ([gaip-decision-engine.js:326-554](assets/gaip-decision-engine.js))
- `Defer` → state становится `deferred`, item переезжает в DEFERRED секцию. Возврат через `undo()`.

**Phantom в mockup — НЕ ВКЛЮЧАТЬ:**

- ❌ **«Mark Complete» button** — phantom label. В DSM единственный action verb это **«Commit ...»**. Использовать item-specific label из таблицы выше.
- ❌ **«Acknowledge» button** — phantom. plan-on/watch-tier items используют тот же `Commit ...` label что и act-on (нет отдельной acknowledge-семантики в коде).
- ❌ **«View Map» button** — нет zone/sector map для general turf sites. Zone-maps существуют только в Stadium sub-module ([class-gilba-stadium.php](includes/class-gilba-stadium.php)).
- ❌ **«Reduce mowing height to 18mm» (Growth Management)** — DSM не генерирует mowing-recommendations. Mowing — это user input в Field Log.
- ❌ **«Due 10:00 AM» / «Due 2:00 PM» конкретное время** — DSM имеет `decisionWindow` в часах, не в clock-time. Заменить на относительное: «by tonight», «today», «within 24h», «this week».

### 8.5. TIME-SENSITIVE WINDOWS row (Tier 3)

```
[chip] [chip] [chip]
```

**Принцип:** показывать только chip'ы, для которых движки выдают **готовое значение напрямую**, без новых вычислений.


| Chip                 | Готовое значение из движка                        | Источник напрямую                                                             |
| -------------------- | ------------------------------------------------- | ----------------------------------------------------------------------------- |
| Spray verdict        | `Optimal` / `Risky` / `Avoid` (verdict без часов) | [spray-log-cascade.js](assets/spray-log-cascade.js)                           |
| Rain forecast        | day name + mm                                     | [climate-engine.js:27](assets/climate-engine.js) `dailyPattern[].rain`        |
| Pre-emergent         | `applicationWindowOpen` flag + `daysRemaining`    | [gaip-decision-engine.js:434](assets/gaip-decision-engine.js)                 |
| PGR reapply          | `daysRemaining`                                   | [gaip-decision-engine.js:298](assets/gaip-decision-engine.js) `daysRemaining` |
| ~~Tournament/Match~~ | ~~days until event~~                              | ❌ убрано — /events страница не существует в текущей версии                    |
| Overseed window      | window state boolean                              | [overseed-multiplier.js](assets/overseed-multiplier.js)                       |


**Не использовать в Phase 1 (требуют новых derivations):**

- ❌ «Spray: Optimal (6hr remaining)» — hours-remaining требует scan hourly forecast (~10 строк). Заменить на просто `Spray: Optimal today` без часов.
- ❌ «Rain expected Fri AM (48hr)» — hours-until rain требует scan hourly forecast (~5 строк). Заменить на просто `Rain: Fri 6mm`.

**Phantom (нет в коде вообще):**

- ❌ «Fertilizer window opens X» — концепция nutrient timing window не существует. Nutrition выдаёт «apply X g/m²» без window-семантики.

**Правило отображения:** показывать максимум 4 chip'а (mobile max 3). Выводить только активные (если PGR window не открыт — не показывать).

### 8.6. Vital Signs cards (Tier 2) — правая колонка

#### 8.6.1. Growth Potential card

```
Growth Potential ⓘ              [icon]
62%
↓ Forecast 55% in 8 days
[████████████░░░░░░░░]
              Cool-Season · Thermal 26% ⓘ
```


| Элемент           | Данные                                                                               | Источник                                                |
| ----------------- | ------------------------------------------------------------------------------------ | ------------------------------------------------------- |
| GP current        | `state.climate.GP` decimal 0–1 → × 100                                               | climate-engine v2 GP calculation                        |
| Forecast horizon  | GP at +1 day или +8 days; format `in N days` (plural) или `in 1 day` (singular)      | climate-engine 16-day forecast slice                    |
| Arrow color       | **neutral grey/dark** (без semantic color)                                           | NEW UI rule (см. секцию Arrow color logic)              |
| Progress bar fill | same value as %                                                                      | derived                                                 |
| Bottom info line  | `<Category> · Thermal X%` (pure) или `Mixed C3/C4 · C3: X% · C4: Y% Thermal` (mixed) | combined badge + thermal score                          |
| Category source   | Warm-Season / Cool-Season / Mixed                                                    | `isWarmSeason()` boolean + c3Frac/c4Frac logic          |
| Thermal source    | `c3Percent` / `c4Percent`                                                            | [daily-dashboard.js:620-629](assets/daily-dashboard.js) |
| ⓘ icons           | open popover с plain-language explanation (см. секцию 8.12)                          | NEW UI behaviour                                        |


**Bottom info line logic** (категория + Thermal в одной связанной строке внизу):

- **Pure C3 grass** (`c3Frac ≥ 1`): `Cool-Season · Thermal 26%`
- **Pure C4 grass** (`c4Frac ≥ 1`): `Warm-Season · Thermal 32%`
- **Mixed stand** (`c3Frac > 0 && c4Frac > 0`): `Mixed C3/C4 · C3: 80% · C4: 25% Thermal`

**Почему категория и Thermal вместе:** Thermal score рассчитан **по той же формуле что и категория** (C3-формула для cool-season, C4-формула для warm-season). Они физически связаны — нелогично показывать в разных местах карточки. Объединение в одну строку даёт пользователю мгновенную связь «Cool-Season → Thermal по cool-season формуле = 26%».

**Изменение от existing code:** в текущей версии ([daily-dashboard.js:620-629](assets/daily-dashboard.js)) для pure stands пишется `Thermal (cool-season): 26%` отдельной строкой, плюс категория видна только в badge (или в названии — `(cool-season)`). В новом дизайне всё объединено в одну bottom info line.

**Зачем нужна Thermal цифра:** объясняет *почему* финальный GP такой. Если final = 62% но Thermal = 26%, значит температура низкая, но другие факторы (длина дня, variety) дают boost. Особенно ценно весной/осенью при transitions.

**Format rule (CRITICAL):** GP в коде хранится как decimal `0.0–1.0` (например `0.62`). В дизайне **всегда показывать percentage** (`62%`). Не смешивать форматы в одной карточке. Все три элемента (current value, forecast value, progress bar) должны быть в одной шкале (%).

**Расширение из плана:** показывать 8-day horizon (`55% in 8 days`) вместо `tomorrow` для более полезной картины. Mockup использовал `tomorrow` — это слишком короткий горизонт для агрономических решений. Plural rule: `in 1 day` / `in 8 days`.

#### 8.6.2. Disease Risk card

**Match existing widget behaviour** ([daily-dashboard.js:645-727](assets/daily-dashboard.js) `updateDiseaseWidget`). Карточка показывает **одну top current болезнь** + опционально secondary warning если другая болезнь forecast peak выше. Multi-disease breakdown — в side panel при тапе на карточку.

**Severity word** — Low / Moderate / High / Severe — на основе `max(currentRisk, forecastPeak)` (если forecast peak > current+5).

**Numbers-first typography hierarchy** (изменение от existing widget — там disease name был визуально сильнее числа, что неправильно для action-driven decisions):

- Severity word (`HIGH`/`MODERATE`/etc.) — **XL bold (32px+)** в headline position
- **Risk numbers** (`33% today`, `78% in 5 days`, `69% in 1 day`) — **L bold (22-24px)** — главный визуальный акцент, потому что это операционная информация
- **Disease name** (`Dollar Spot`, `Fusarium Patch`) — **M regular (14-16px)** — supporting label под цифрой

**Time labels** (изменение от existing code):

- Existing: `${topRisk}% → ${forecastPeak}% day ${peakDay}` / `${topRisk}% today`
- **New:** `${topRisk}% today → ${forecastPeak}% in ${peakDay} day(s)` / `${topRisk}% today`
- Plural rule: `in 1 day` / `in 5 days` (singular vs plural)
- Reason: `day 5` звучит криптично, `in 5 days` — естественно, plus current row всегда явно `today` для disambiguation

**Один из 4 trajectory паттернов:**

**Pattern A — Same disease rising** (forecast peak from same disease, > current+5):

```
Disease Risk ⓘ                              🔴
HIGH                            Forecast Peak

33% today  →  78% in 5 days                  ← L bold (22-24px)
Dollar Spot ⓘ                                ← M label под цифрой
[████████████████░░░░]
```

**Pattern B — Different disease forecast peak higher** (другая болезнь поднимется выше, > current+10):

```
Disease Risk ⓘ                              🔴
HIGH                            Forecast Peak

33% today                                    ← L bold
Dollar Spot ⓘ                                ← M label

⚠ 69% in 1 day                               ← L bold
Fusarium Patch (Microdochium) ⓘ              ← M label
[████████████░░░░░░░░]
```

**Pattern C — Risk falling** (forecast peak < current-5):

```
Disease Risk ⓘ                              🟢
LOW

33% today  →  18% in 5 days  ↓               ← L bold
Dollar Spot ⓘ                                ← M label
[██████░░░░░░░░░░░░░░]
```

**Pattern D — Stable**:

```
Disease Risk ⓘ                              🟡
MODERATE

33% today                                    ← L bold
Dollar Spot ⓘ                                ← M label
[██████████░░░░░░░░░░]
```


| Элемент                                  | Данные                                                                 | Источник                                                                                                             |
| ---------------------------------------- | ---------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------- |
| Severity word (Low/Moderate/High/Severe) | thresholds <50/<70/<85/≥85 on max(current,forecast)                    | [daily-dashboard.js:710-715](assets/daily-dashboard.js)                                                              |
| `Forecast Peak` suffix                   | shown when `forecastPeak > currentRisk + 5`                            | [daily-dashboard.js:679](assets/daily-dashboard.js)                                                                  |
| Top disease name                         | `topDisease` from `GAIP_DISEASE_RESULT`                                | [daily-dashboard.js:650](assets/daily-dashboard.js)                                                                  |
| Trajectory line (Pattern A)              | `${topRisk}% today → ${forecastPeak}% in ${peakDay} day(s)`            | data: [daily-dashboard.js:680-685](assets/daily-dashboard.js); copy: NEW (was `33% → 78% day 5`)                     |
| Current row (Pattern B/C/D)              | `${topRisk}% today`                                                    | data: [daily-dashboard.js:690](assets/daily-dashboard.js); copy: existing                                            |
| Secondary warning row (Pattern B)        | `⚠ ${forecastPeak}% in ${peakDay} day(s)` + `${forecastDisease}` label | data: [daily-dashboard.js:691-693](assets/daily-dashboard.js); copy: NEW (was inline `⚠ Fusarium Patch → 69% day 1`) |
| Progress bar fill                        | `displayRisk = max(current, forecast)`                                 | [daily-dashboard.js:709,723-725](assets/daily-dashboard.js)                                                          |
| Progress bar color                       | green <50, yellow <70, red ≥70                                         | [daily-dashboard.js:724](assets/daily-dashboard.js)                                                                  |
| ⓘ icons                                  | open popover (см. секцию 8.12)                                         | NEW UI behaviour                                                                                                     |


**Side panel content** (drill-down при тапе на карточку):

- **Multi-disease breakdown** — `forecast.diseases` (top N sorted by `peakRisk`) с individual trajectory rows: name / current% / peak% / in N day(s) / model
- **Smith-Kerns inputs** — RH, температура, leaf wetness inputs за последние 14 дней
- **Per-disease trajectory chart** — 14-day forecast curve для каждой топ-болезни
- **Validation badges** — `Validated` / `Beta` per model

**Изменения от existing UI:**

- **Numbers-first typography** — risk numbers крупнее, чем disease name (поправлен визуальный приоритет)
- **Time labels** — `today` / `in N day(s)` вместо `today` / `day N` (более естественно)
- **ⓘ icons** на disease name (popover с моделью и pathogen) и на severity word (plain-language threshold explanation)
- **Side panel** с multi-disease breakdown — данные в `GAIP_DISEASE_FORECAST.diseases` уже есть, widget просто не использовал их
- Существующие trajectory patterns A/B/C/D и progress bar — без изменений в логике

**Что НЕ показывается на карточке** (намеренно, чтобы не дублировать с deep panel):

- Multi-disease parallel rows с individual mini-bars — это в side panel
- "Critical in Xd" derived label — используется raw `78% in 5 days` (без интерпретации)
- "↑ Increasing" / "stable" textual labels — направление видно из `→ 78%` или `→ 18% ↓` patterns

#### 8.6.3. Stress Index card

```
STRESS INDEX ⓘ                                  ⚡

19 /100
Driven by: Traffic 93% ⓘ
↓ Decreasing — peak in 5 days
[█████░░░░░░░░░░░░░░░░░] 19%
```

**Compact summary card** — 4 строки информации, без полного multi-factor breakdown (это уходит в side panel). Цель: at-a-glance понимание «насколько плохо + что главная причина + куда идём».


| Элемент             | Данные                                                                        | Источник                                                                                                                     |
| ------------------- | ----------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------- |
| Index `19 /100`     | `stressTrajectory.summary.currentScore` (composite weighted 0–100 score)      | [stress-trajectory-engine-pure.js:950](assets/stress-trajectory-engine-pure.js)                                              |
| `/100` scale suffix | static — explicit scale max                                                   | NEW UI (вместо misleading `19% today` от existing)                                                                           |
| Number color        | severity threshold: <30 green, ≤60 amber, >60 red                             | [daily-dashboard.js:747-748](assets/daily-dashboard.js)                                                                      |
| Driver line label   | mapped `primaryStressor` → plain-language label                               | [stress-trajectory-engine-pure.js:963](assets/stress-trajectory-engine-pure.js); **NEW UI binding** (currently not rendered) |
| Driver inline value | raw component value `factors[primaryStressor]` (0–100 score)                  | `currentComponents` from engine; **NEW UI** (показывает почему именно этот фактор главный)                                   |
| Trajectory line     | direction (`↓` / `↑` / `→`) + `Decreasing/Rising/Stable` + `peak in N day(s)` | `summary.trend` + `summary.peakDay` ([stress-trajectory-engine-pure.js:953,970](assets/stress-trajectory-engine-pure.js))    |
| Arrow color         | **neutral grey** (по правилу из секции 8.7)                                   | NEW UI rule (existing UI цветной pill — заменяется)                                                                          |
| Progress bar fill   | width = `currentScore`, color = severity threshold                            | [daily-dashboard.js:818-820](assets/daily-dashboard.js)                                                                      |
| ⓘ icons             | open popover (см. секцию 8.12)                                                | NEW UI behaviour                                                                                                             |


**Driver label mapping** (engine `primaryStressor` values из [stress-trajectory-engine-pure.js:930-937](assets/stress-trajectory-engine-pure.js)):

- `thermal`   → `Heat`           («жара — основная причина стресса»)
- `traffic`   → `Traffic`        («износ от трафика и событий»)
- `moisture`  → `Water stress`   («дефицит или избыток воды»)
- `light`     → `Light deficit`  («нехватка света — затенение»)
- `nutrition` → `Nutrition`      («дефицит питания»)
- `biotic`    → `Disease`        («давление болезней»)

**Format driver line:** `Driven by: <Label> <RawValue>%`

- Pure C3 example: `Driven by: Traffic 93%` — Traffic component = 93/100, weighted 0.20 → contributes 18.6 к headline 19
- Single primary stressor format — никаких "co-driven by" multi-stressor сценариев в Tier 2 (это в side panel)

**Что меняется vs existing UI:**

- ❌ **Убрать** label `Climate Stress` (hardcoded, обманчивый — index это composite, не climate-only)
- ❌ **Убрать** sublabel `19% today` (дубль headline + неправильный `%` suffix)
- ❌ **Убрать** цветной trend pill `↓ green` (заменить на neutral arrow в trajectory line)
- ❌ **Убрать** multi-factor bars с карточки (перенести в side panel — Tier 2 это summary)
- ✅ **Добавить** `/100` scale suffix (explicit max)
- ✅ **Добавить** `Driven by: <stressor> <value>%` line (engine уже считает `primaryStressor`, widget просто не читает)
- ✅ **Добавить** `peak in N day(s)` long-format trajectory direction
- ✅ **Добавить** ⓘ popover icons

**Side panel content** (drill-down при тапе на карточку):

- **Multi-factor bars** — все 6 components (Heat, Light, Moisture, Traffic, Nutrition, Disease) с раздельными horizontal bars и raw values 0–100. Match existing UI [daily-dashboard.js:774-808](assets/daily-dashboard.js) но **без `>5%` filter** — показывать все, неактивные отображать dimmed/serene
- **14-day sparkline** — `stressTrajectory.trajectory[].totalScore` массив 14 точек с overlay markers для peak day и intervention windows
- **Compound effects warnings** — `compound.multiplier > 1` дни с подсветкой (heat+drought, traffic+wet и т.д.)
- **Component math explanation** — показать вклад каждого фактора в final index: `Traffic 93 × 0.20 = 18.6 → contributes ~99% к headline 19`

**Bug fix item для Phase 1:** climate stress fallback branch ([daily-dashboard.js:1566-1576](assets/daily-dashboard.js)) теряет `factors` field когда срабатывает (для golf turf). Это ломает multi-factor bars в side panel. Простой fix — добавить `factors: climateStressResult.components` в fallback data construction.

**Phantom в старом mockup плана — «was 29» сравнение с предыдущим запуском:** в коде НЕТ механизма сохранения previous-run snapshot. Решено отказаться, замена — trajectory direction (`↓ Decreasing — peak in 5 days`) уже даёт пользователю «куда идём».

#### 8.6.4. Soil Moisture (VWC) card

```
SOIL MOISTURE (VWC) ⓘ                          💧

19 %                                            ← XL bold headline (already shows the number)

┌────────────────────────────────────┐
│██▓▓▓▓░░░░▓▓▓▓░│░██████████████████│         ← color zones + vertical line marker
└──────│───────│─│─│─────────────────┘
       WP      │ │ FC                  scale endpoints: 0% (left) ... 30% (right, adaptive)
       9%     TRIG 20%
              17%

2.3mm buffer before irrigation trigger          ← engine literal message
```


| Элемент                       | Данные                                                                          | Источник                                                                                          |
| ----------------------------- | ------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------- |
| VWC % headline                | `currentVWC` from sensor (priority) или derived из `state.site.soilMoisture`    | sensor: [sensor-api-bridge.js](assets/sensor-api-bridge.js) Hydrosight live; fallback: state      |
| Number color (severity class) | green if в [trigger, fc], amber если близко к границам, red если outside        | NEW UI rule (decision-engine использует binary on/off-track)                                      |
| Target band [trigger, fc]     | `triggerVWC = wiltingPoint + awc × (1 − MAD)` и `fieldCapacity` per soil type   | [irrigation-scheduler.js:1086,1091,1145-1148](assets/irrigation-scheduler.js) `result.thresholds` |
| WP / TRIG / FC markers        | `wiltingPoint × 100` / `triggerVWC × 100` / `fieldCapacity × 100` per soil type | [irrigation-scheduler.js:69-77,1145-1148](assets/irrigation-scheduler.js)                         |
| Adaptive scale max            | `scale_max = FC × 1.5` (адаптируется по soil type, не статичные 40%)            | NEW UI rule (см. ниже)                                                                            |
| Color zones                   | red `0 → WP`, amber `WP → TRIG`, green `TRIG → FC`, blue `FC → scale_max`       | NEW UI visualization                                                                              |
| Current VWC marker            | vertical line через всю высоту bar в позиции `vwc / scale_max`, **без label**   | NEW UI (label избыточен — headline над bar уже показывает `19%`)                                  |
| Bottom message                | `recommendation.message` (literal engine output)                                | [irrigation-scheduler.js:1114-1135](assets/irrigation-scheduler.js)                               |
| Status word (optional)        | `status` enum: saturated / optimal / adequate / stressed / critical / wilting   | [irrigation-scheduler.js:1090-1103](assets/irrigation-scheduler.js)                               |


**Adaptive scale rule (Solution 1 — fix для crowding):**

Раньше предлагалось static scale `0% → 40%` (clay max FC). Но для USGA greens (FC=15%) это даёт visualization где optimal зона занимает 7.5% ширины, а saturated 62.5% — неюзабельно.

**Новое правило:** `scale_max = FC × 1.5` — растягивается по soil type:


| Soil type   | FC  | Scale max | WP % | TRIG % | FC % | Marker positions on bar (% width) |
| ----------- | --- | --------- | ---- | ------ | ---- | --------------------------------- |
| USGA greens | 15% | **22.5%** | 6%   | 12%    | 15%  | WP 27% / TRIG 53% / FC 67%        |
| Sandy loam  | 20% | **30%**   | 9%   | 17%    | 20%  | WP 30% / TRIG 57% / FC 67%        |
| Loam        | 27% | **40.5%** | 12%  | 22%    | 27%  | WP 30% / TRIG 54% / FC 67%        |
| Clay loam   | 35% | **52.5%** | 18%  | 28%    | 35%  | WP 34% / TRIG 53% / FC 67%        |
| Clay        | 40% | **60%**   | 22%  | 36%    | 40%  | WP 37% / TRIG 60% / FC 67%        |


Результат: FC всегда на ~67% ширины bar, optimal зона (TRIG-FC) ~13% ширины и **видна для всех soil types**, saturated ~33% (присутствует но не доминирует).

**Site-specific target band (key change vs decision-engine):**

`vwcMin/vwcMax = [15, 25]` в [gaip-decision-engine.js:360](assets/gaip-decision-engine.js) — **hardcoded для всех sites**, что неточно для разных soil types. Вместо этого использовать `result.thresholds` из irrigation-scheduler:


| Soil type   | wilting | trigger | field capacity | Real target band |
| ----------- | ------- | ------- | -------------- | ---------------- |
| USGA greens | 6%      | 12%     | 15%            | **[12, 15]**     |
| Sandy loam  | 9%      | 17%     | 20%            | **[17, 20]**     |
| Loam        | 12%     | 22%     | 27%            | **[22, 27]**     |
| Clay loam   | 18%     | 28%     | 35%            | **[28, 35]**     |
| Clay        | 22%     | 36%     | 40%            | **[36, 40]**     |


**Bug fix item для Phase 1:** `gaip-decision-engine.js:360` должен читать thresholds из `irrigation-scheduler` или `state.site.soilType` вместо hardcoded `[15, 25]`. Это даст более точную "on-track" оценку для всех soil types.

**Bottom message — literal engine output** ([irrigation-scheduler.js:1114-1135](assets/irrigation-scheduler.js)):


| VWC condition        | Status                    | Message                                                     |
| -------------------- | ------------------------- | ----------------------------------------------------------- |
| `vwc ≥ fc`           | saturated                 | "Soil is at or above field capacity. No irrigation needed." |
| `vwc ≤ trigger`      | needs irrigation          | "Apply ${refillDepth}mm to return to field capacity"        |
| `trigger < vwc < fc` | optimal/adequate/stressed | "${marginToTrigger}mm buffer before irrigation trigger"     |


**No phantom messages:** "Upper target band — skip cycle today" — это **phantom**, в коде нет такой строки. Используем дословные engine outputs.

**Color zones — soft pastel tints (НЕ saturated):**


| Зона      | Token (CSS variable)      | Alpha  | Метка состояния              |
| --------- | ------------------------- | ------ | ---------------------------- |
| 0 → WP    | `var(--gaip-critical-bg)` | 25–30% | Wilting (no water available) |
| WP → TRIG | `var(--gaip-warning-bg)`  | 25–30% | Dry (irrigation needed)      |
| TRIG → FC | `var(--gaip-good-bg)`     | 25–30% | Optimal (target band)        |
| FC → max  | `var(--gaip-info-bg)`     | 25–30% | Saturated (waterlogging)     |


**Важно:** **soft pastel** background fills (не яркие full-saturation цвета). На предыдущей итерации mockup были bright red/orange/green/blue — это выглядит как светофор, отвлекает. Использовать существующие CSS-переменные `--gaip-*-bg` с opacity, не hardcoded hex.

Markers (WP/TRIG/FC) — отчётливые vertical lines (1-2px) черновато-серого цвета `var(--gaip-text-muted)`.

**Bar height — 20–24px** (не тонкий 12-16px). Достаточно высокий чтобы color zones хорошо читались, vertical line marker имел видимую длину, и tap target acceptable на mobile (44px включая padding).

**Current VWC marker — vertical line через всю высоту bar:**

- **Style:** vertical line **2–3px wide**, через всю высоту bar (edge-to-edge top to bottom), пересекающая все цветные зоны
- **Color:** severity color текущей zone (green / amber / red / blue) — то же что headline number color
- **NO label** на marker — число (`13%`) уже показано в XL headline над bar
- **NO triangle/arrow/circle** — только plain vertical line (чище, не перекрывает color zones)
- **Position:** `vwc / scale_max × 100%` от ширины bar (например VWC 13% при scale_max 22.5% → `13/22.5 = 57.8% width position`)
- Tooltip on hover (optional): `Current VWC 13% · Optimal zone (TRIG-FC)`

**Markers WP / TRIG / FC labels — alternating top/bottom при crowding:**

- Default layout: все 3 labels под bar — 11–12px, `var(--gaip-text-muted)`
- **При collision** (например USGA: 6/12/15 близко даже на adaptive scale) — alternating расположение:
  - `WP` сверху bar
  - `TRIG` снизу bar
  - `FC` сверху bar
- Visual rhythm + меньше overlap
- **Tiny `ⓘ` icons** рядом с каждым label — open popover из glossary с per-marker explanation (что такое Wilting Point / Trigger / Field Capacity)

**Sensor provider name — рядом с заголовком:**

Если сайт имеет интеграцию с сенсором, показывать **просто название провайдера** маленьким серым текстом рядом с заголовком `SOIL MOISTURE (VWC)`. Без freshness, без age, без status colors — пользователь видит откуда данные, и не более того.

**Layout (inline после заголовка через middle dot):**

```
SOIL MOISTURE (VWC) ⓘ  ·  Hydrosight                       💧
```

**Source name resolution** (через `getSourceInfo()` из [sensor-api-bridge.js:215-246](assets/sensor-api-bridge.js)):


| Когда                                     | Что показывать рядом с заголовком                |
| ----------------------------------------- | ------------------------------------------------ |
| Hydrosight подключён + сенсор смаплен     | `· Hydrosight`                                   |
| CSV-импорт                                | `· CSV import`                                   |
| Нет источника (manual)                    | ничего (или `· Manual estimate` маленьким серым) |
| Future provider (Soil Scout, SpecConnect) | `· Soil Scout` / `· SpecConnect`                 |


**Style:**

- Размер 11–12px (тот же что secondary metadata на других карточках)
- Цвет `var(--gaip-text-muted)` (серый, не привлекает внимание)
- БЕЗ иконки 🛰️, БЕЗ цветной плашки, БЕЗ age/freshness
- Separator `·` (middle dot) между заголовком и источником

**Где живёт freshness check:**

Sensor freshness (live / recent / stale) **уже покрыта Data Confidence panel** в top-bar — секция показывает `Sensors / Hydrosight / 3m ago`. Дублировать на каждой карточке не нужно. На VWC карточке остаётся **только имя провайдера** для context — "откуда взялись 13%". Если sensor offline/stale → indicator в Data Confidence panel (баннеры убраны).

**State variants (4 mockup для дизайнера):**

Дизайнеру нарисовать 4 примера соответствующих 4 zones:

1. **Wilting** (VWC=4%): marker в red zone, headline red, message: `"Apply 8mm to return to field capacity"`
2. **Dry** (VWC=10%): marker в amber zone, headline amber, message: `"Apply 3mm to return to field capacity"`
3. **Optimal** (VWC=13%): marker в green zone, headline green, message: `"0.7mm buffer before irrigation trigger"`
4. **Saturated** (VWC=18%): marker в blue zone, headline blue, message: `"Soil is at or above field capacity. No irrigation needed."`

Плюс **2 примера** с разными soil types (USGA vs Loam) чтобы дизайнер видел как layout адаптируется при изменении scale_max.

#### 8.6.5. Irrigation Plan card

```
Irrigation Plan ⓘ          [icon]
7 mm
Weekly requirement ⓘ
↓ Ahead by 6mm — skip cycle ⓘ
```

или (если deficit положительный):

```
Irrigation Plan ⓘ          [icon]
24 mm
Weekly requirement ⓘ
↑ Behind by 8mm — catch up ⓘ
```


| Элемент                | Данные                                                         | Источник                                                            |
| ---------------------- | -------------------------------------------------------------- | ------------------------------------------------------------------- |
| Weekly need (mm)       | `weeklyNeed = ETc × 7 = ET0 × Kc × 7`                          | [gssh-scenario-engine.js:1102-1131](assets/gssh-scenario-engine.js) |
| Need fallback chain    | `summary.totalIrrigation` или sum of `schedule[].irrigation`   | [daily-dashboard.js:1596-1598](assets/daily-dashboard.js)           |
| Severity color         | `≤ 5mm` low / `≤ 20mm` moderate / `> 20mm` high                | [daily-dashboard.js:866-867](assets/daily-dashboard.js)             |
| Deficit value (mm)     | `currentDepletion = TAW − max(0, (VWC − WP) × rootDepth)`      | [irrigation-scheduler.js:521](assets/irrigation-scheduler.js)       |
| Deficit fallback       | `currentDeficit ?? waterBalance.deficit ?? summary.netDeficit` | [daily-dashboard.js:1602](assets/daily-dashboard.js)                |
| Deficit interpretation | positive = behind / negative = ahead / 0 = on track            | derived                                                             |
| ⓘ icons                | open popover (см. секцию 8.12)                                 | NEW UI behaviour                                                    |


**Sign convention для deficit:**

- `Behind by Xmm` (positive deficit, ↑ arrow) — VWC ниже field capacity, нужен полив чтобы догнать ET
- `Ahead by Xmm` (negative deficit, ↓ arrow) — VWC выше field capacity, переполив, можно skip cycle
- `On track` (deficit ≈ 0) — balance оптимальный

**Зачем эта card отдельно от Soil Moisture (VWC):**

- **VWC card** = текущее состояние сенсора (что измерено сейчас)
- **Irrigation Plan card** = недельное планирование (сколько mm запланировать + отстаём/опережаем)

Это разные уровни решений: VWC отвечает «полить сейчас?», Irrigation Plan — «сколько mm на неделю и догоняем ли»

**ⓘ icons popover content:**

- `Irrigation Plan ⓘ` → "Calculated weekly irrigation requirement based on Penman-Monteith reference evapotranspiration (ET₀) and crop coefficient (Kc)."
- `Weekly requirement ⓘ` → "Total mm of water the turf will lose to evapotranspiration over the next 7 days. This is what irrigation should replace if there's no rain."
- `Behind by Xmm / Ahead by Xmm ⓘ` → "Current water balance vs target. Behind = catch up with irrigation. Ahead = skip cycles to avoid overwatering. Based on TAW (Total Available Water) and current depletion."

**Note дизайнеру:** existing widget показывает просто `Deficit: -6mm` без интерпретации знака. В новом дизайне знак переведён в plain language (`Behind by Xmm` / `Ahead by Xmm`) для немедленной actionability.

### 8.7. Data Confidence card

```
Data Confidence              1 issue
✓ Weather (Open-Meteo)      Live
⚠ Soil Test                 Import
✓ Sensors                   5m ago
✓ Water Tests               Current
✓ Spray Logs                Up to date
```


| Источник          | Данные                                  | Где                         |
| ----------------- | --------------------------------------- | --------------------------- |
| Weather           | identity-enforcement source ID + status | `identity-enforcement.js`   |
| Soil Test age     | last sample date                        | `sample-manager.js`         |
| Sensors last poll | last successful pull timestamp          | `sensor-api-bridge.js`      |
| Water Tests age   | last water sample date                  | `sample-manager.js`         |
| Spray Logs        | last entry from spray-log REST          | `class-gilba-spray-log.php` |


Каждая строка: иконка статуса (✓ / ⚠ / ✗) + источник + relative time / state badge / call-to-action link.

### 8.8. Evidence Health footer one-liner

```
Evidence Health: ● 4 sources live · 1 needs update                              [progress bar 80%]
```


| Элемент               | Данные                                 | Источник             |
| --------------------- | -------------------------------------- | -------------------- |
| Sources count summary | aggregation of 8.7 statuses            | derived              |
| Progress bar %        | onboarding/data-completeness aggregate | composite (см. ниже) |


**Phantom-clarification — 80% bar:** в mockup непонятно что это представляет. Варианты:

- Onboarding completeness (% wizard steps done)
- Data confidence aggregate (4 ✓ из 5 = 80%)
- Setup completeness

Решить дизайнеру: либо убрать, либо явно подписать `Setup 80%` / `Data 4/5 sources` etc.

### 8.9. Phantom элементы из mockup — НЕ ВКЛЮЧАТЬ в design

Сводка того, чего нет в коде:

1. **«Reduce mowing height to 18mm» action card** — DSM не генерирует mowing-advice; mowing только в Field Log как user-input
2. **«Due 10:00 AM», «Due 2:00 PM» конкретные clock-times** — DSM использует часовые горизонты, не conкретное время дня. Заменить на относительные.
3. **«Stress was 29» previous-run сравнение** — нет storage previous snapshot. Либо добавить минимальный localStorage save (опция A), либо показывать trajectory direction вместо дельты (опция B).
4. **«Sector 4 moisture levels»** — multi-sector внутри turf-сайта НЕ существует. Зоны есть только для stadium (отдельный sub-module `admin/stadium/class-zone-configuration-ui.php`). Для stadium-сайтов можно ссылаться на `/stadium`. Для general turf — убрать.
5. **80% progress bar в footer** — неоднозначное значение, требует уточнения или удаления.

### 8.10. Mobile adaptation

- Bottom tab bar: Dashboard / Data / Analysis / Reports / More
- Vital Signs cards: одна колонка вместо двух
- Action cards: full-width swipeable
- Quick Capture FAB: float button bottom-right
- Top bar: только Logo + Site Switcher + ↻ (без pills)

### 8.11. Design system

#### Severity color tokens (используются по всему dashboard)


| Token                 | Hex       | Where used                                 | CSS variable (existing) |
| --------------------- | --------- | ------------------------------------------ | ----------------------- |
| Good (Green)          | `#166534` | OK / Low / Active growth / Healthy         | `--gaip-good-bg`        |
| Warning (Amber)       | `#ca8a04` | Moderate / Caution / Approaching threshold | `--gaip-warning-bg`     |
| Critical (Red)        | `#dc2626` | High / Critical / Severe                   | `--gaip-critical-bg`    |
| Info (Blue)           | `#1e40af` | Neutral / Informational                    | `--gaip-info-bg`        |
| Disease engine accent | `#991b1b` | Disease badges                             | `.gpq-engine-disease`   |


Все токены уже используются в [priority-action-queue.css:205-212](assets/priority-action-queue.css). Использовать те же CSS-переменные для нового UI.

#### Time labels — единый формат для trajectory/forecast lines

**Правило:** во всех vital signs cards (trajectory, forecast, peak labels) использовать длинный формат с plural rule.


| Контекст                  | Формат                                        | Пример                          |
| ------------------------- | --------------------------------------------- | ------------------------------- |
| Trajectory line (Disease) | `${current}% today → ${peak}% in ${N} day(s)` | `33% today → 78% in 5 days`     |
| Forecast line (GP)        | `↓ Forecast ${value}% in ${N} day(s)`         | `↓ Forecast 55% in 8 days`      |
| Peak label (Stress)       | `↓ Decreasing — peak in ${N} day(s)`          | `↓ Decreasing — peak in 5 days` |
| Single-day reference      | `in 1 day` (singular, без `s`)                | `↓ 55% in 1 day`                |
| Multi-day reference       | `in N days` (plural)                          | `↓ 55% in 8 days`               |


**Не использовать:** `in 8d`, `day 5`, `in 5d`, `Critical in 5d` (derived) — все эти существующие в коде форматы заменяются на длинный.

**Исключение для compact chips и data freshness markers** (где tight space важен):

- Data freshness markers в Evidence panel: `Soil 12d / Tissue 38d / Water 8d / Spray 8d` — короткое `Nd` для compact data age display
- Эти форматы — supporting metadata в tight space, не main UI labels

#### Arrow / direction indicators — neutral color rule

**Правило:** все направляющие стрелки `↑ ↓ →` во всех vital signs cards — **neutral (grey/dark text color)**, не цветные.

**Цвет вместо arrow** идёт в:

- Severity dot / badge (top right corner)
- Progress bar fill (green/yellow/red по thresholds)
- Number color (severity class — `HIGH` красным, `LOW` зелёным)

**Почему:** цвет на arrow + number + bar + dot = визуальный шум. Arrow — только direction. Куда идём + хорошо/плохо считывается из `↓ 55% in 8 days` + progress bar / number color.

#### Severity thresholds per metric

Confirmed thresholds в коде:


| Metric            | Green (OK)           | Amber (Warning)          | Red (Critical)                                               | Source                                                                                                                 |
| ----------------- | -------------------- | ------------------------ | ------------------------------------------------------------ | ---------------------------------------------------------------------------------------------------------------------- |
| Growth Potential  | ≥ 50%                | 25–49%                   | < 25%                                                        | [nutrition-calendar.js:975](assets/nutrition-calendar.js)                                                              |
| Disease Risk peak | < 30%                | 30–60%                   | > 60%                                                        | `disease-forecast.js`                                                                                                  |
| Stress Index      | < 30                 | 30–60                    | > 60                                                         | `stress-trajectory-engine-pure.js` thresholds                                                                          |
| VWC vs target     | within [trigger, fc] | within ±2% of band edges | outside band (saturated above FC, needs water below trigger) | `irrigation-scheduler.js:1145-1148` `result.thresholds` (site-specific); decision-engine hardcoded `[15, 25]` is a bug |


#### Arrow color logic — direction indicator на vital sign cards

**Ключевое правило:** стрелки **всегда neutral (grey/dark text color)**, не цветные. Цвет идёт только в:

- **Severity badge / dot** (top right corner) — цвет статус-индикатора
- **Progress bar fill** — green/yellow/red в зависимости от value
- **Number color** (severity class) — например `HIGH` красным, `LOW` зелёным

Стрелки `↑ ↓ →` — только направление, без эмоциональной окраски.

**Почему:**

- Цвет стрелки + цвет числа + цвет бара = слишком много сигналов на одной карточке (визуальный шум)
- "Куда идём" уже видно из стрелки + следующего числа (`↓ 55% in 8 days`)
- "Хорошо это или плохо" уже видно из severity badge и progress bar color
- Для метрик где "higher = worse" (Disease, Stress) "цветная стрелка по направлению" сбивает с толку — `↓` зелёная для Disease, но `↓` красная для GP, mental load на distinguishing rules

**Что вместо цветной стрелки:**


| Метрика          | Headline number                          | Progress bar color        | Severity badge | Arrow color      |
| ---------------- | ---------------------------------------- | ------------------------- | -------------- | ---------------- |
| Growth Potential | severity class (`62%` зелёный если ≥50%) | thresholds 50/25          | dot color      | **neutral grey** |
| Disease Risk     | severity class (`HIGH` красный)          | thresholds 50/70          | 🔴 dot         | **neutral grey** |
| Stress Index     | severity class (`24/100` green)          | thresholds 30/60          | dot color      | **neutral grey** |
| VWC              | severity class (depends on band)         | target band visualization | dot color      | **neutral grey** |


**Пример Royal Melbourne:**

- GP `62%` (зелёный — выше 50% threshold) `↓ Forecast 55% in 8 days` (стрелка neutral) — progress bar зелёный
- Disease `HIGH` (красный) `33% today → 78% in 5 days` (стрелка `→` neutral) — progress bar красный
- Stress `24/100` (зелёный) `↓ Decreasing — peak in 5 days` (стрелка neutral) — sparkline зелёный

Это **изменение от ранней версии плана**, где была "семантическая arrow color logic" по направлению + zone. Решение — упростить, делегировать цвет другим элементам.

#### Confidence chips

- **High confidence (≥80%):** subtle green tint
- **Medium (50–79%):** amber
- **Low / estimate / no sensor:** grey
- Format: `92% conf` или `high` / `usable` / `estimate · no sensor`
- **Always visible** на каждой action card, не скрывать при «high»

#### Status pills

- Rounded (border-radius: 12–16px)
- Compact, single-line text
- Profile pills (Bentgrass / MLSN / Cool-Season): neutral grey background, dark text
- Status pills (All Clear / 2 Urgent): severity colored

#### Action cards

- Light-tinted background по severity:
  - TODAY (`act-on`) — red-tint background (`--gaip-critical-bg` с alpha)
  - THIS WEEK (`plan-on`) — amber-tint
  - WATCHING (`watch`) — neutral / very subtle grey
- Confidence chip → top-left (всегда видимый)
- Action title → bold
- Reasoning → smaller secondary text
- Buttons → primary `Commit — <item-specific>` (item label из DSM) + secondary text-link `View Details →` + tertiary `Defer`

#### Format rules

- **Growth Potential**: всегда percentage (`62%`), не decimal (`0.62`). Engine хранит decimal, UI показывает % везде в одной карточке.
- **Disease per-disease values**: percentage (`Dollar Spot 32% today`), trajectory `→ 78% in 5 days` (plural rule: `in 1 day` / `in N days`)
- **Stress**: `X /100` formatting (out-of-100 scale)
- **VWC**: percentage (`13%`, `19%`, etc.), target band markers тоже percentage (`WP 6%`, `TRIGGER 12%`, `FC 15%` для USGA — site-specific per soil type)
- **Time**: relative (`5 min ago`, `8 hours ago`, `12 days ago`), не абсолютное `2026-04-29 14:35:12`
- **Action due**: relative (`by tonight`, `today`, `within 24h`, `this week`), не clock-time

#### Typography scale

`12 / 14 / 16 / 20 / 24 / 32` (px). 12 для secondary metadata, 32 для hero numbers.

#### Iconography

- Outline стиль для нейтральных состояний
- Filled для критических
- Engine icons: 📈 (growth), 🔴/🍄 (disease), ⚡ (stress), 💧 (water/VWC), 🚿 (spray), 🛡 (pre-emergent), 🏆 (event/match)

#### Dark mode

Опционально для Phase 2. CSS-переменные уже подготовлены для dual-theme.

### 8.12. Terminology & tooltips (Glossary)

**Принцип:** все технические термины имеют маленькую `ⓘ` icon рядом. Click/tap (mobile-friendly) открывает popover с plain-language объяснением. Профи видят привычное название, новички получают пояснение.

**UX detail:**

- Icon style: `ⓘ` outline icon, `var(--gaip-text-muted)`, font-size 0.85em, vertical-align baseline
- Trigger: click/tap (НЕ hover-only — должно работать на mobile)
- Popover: 280–320px max width, white background, soft shadow, arrow указывает на icon
- Close: click outside / Esc / X button в popover
- Не блокирует workflow — это passive help, не required step

**Glossary content (English text для popover):**


| UI term                                                     | Where shown                               | Plain-language explanation (popover text)                                                                                                                                                                                                             |
| ----------------------------------------------------------- | ----------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Growth Potential**                                        | GP card                                   | "How actively the turf is growing right now (0% dormant — 100% peak growth). Combines temperature, day length, and grass variety."                                                                                                                    |
| **Cool-Season · Thermal X%** (pure)                         | GP card bottom info line                  | "Cool-season grass (rye, fescue, bent, Poa) — optimal 15–24°C. Thermal X% is the temperature-only score using the C3 formula, before day length and variety adjustment. The final Growth Potential above adjusts this for day length and variety."    |
| **Warm-Season · Thermal X%** (pure)                         | GP card bottom info line                  | "Warm-season grass (couch, kikuyu, buffalo, zoysia) — optimal 25–35°C. Thermal X% is the temperature-only score using the C4 formula, before day length and variety adjustment."                                                                      |
| **Mixed C3/C4 · C3: X% · C4: Y% Thermal**                   | GP card bottom info line                  | "Mixed stand of cool-season (C3) and warm-season (C4) grasses. Thermal scores split by type so you can see which population is currently growing better. Final GP above is a weighted blend of both."                                                 |
| **Cool-Season / C3** (top bar pill)                         | Top bar context pill                      | "Cool-season grasses — peak growth in spring/autumn. Optimal 15–24°C. Examples: ryegrass, fescue, bentgrass, Poa."                                                                                                                                    |
| **Warm-Season / C4** (top bar pill)                         | Top bar context pill                      | "Warm-season grasses — peak growth in summer. Optimal 25–35°C. Examples: couch, kikuyu, buffalo, zoysia."                                                                                                                                             |
| **Disease Risk severity (HIGH)**                            | Disease card severity word                | "Disease pressure level — Low (under 50%), Moderate (50–70%), High (70–85%), Severe (85%+). Calculated on the higher of current risk and forecast peak, so a rising trend is reflected in the colour."                                                |
| **Forecast Peak (label)**                                   | Disease card title suffix                 | "The headline reflects an upcoming peak from the 14-day forecast, not just today. Shown when forecast peak exceeds current risk by more than 5 points."                                                                                               |
| **Trajectory '33% today → 78% in 5 days'**                  | Disease card trajectory line              | "Current risk today → forecast peak risk in N days. Same disease rising — fungicide window typically 2–4 days before peak."                                                                                                                           |
| **Secondary warning '⚠ 69% in 1 day'**                      | Disease card warning row                  | "A different disease is forecast to peak higher than today's top threat. Disease name shown below the number. Triggered when its peak exceeds current risk by 10+ points."                                                                            |
| **'today' vs 'in N day(s)'**                                | All vital signs cards (time labels)       | "Time markers used in trajectory and forecast lines. 'today' = current value right now. 'in 1 day' = tomorrow (singular). 'in 5 days' = in 5 days (plural). Used consistently across Growth Potential, Disease Risk, and Stress Index cards."         |
| **Neutral arrow color**                                     | All vital signs cards (arrow indicators)  | "Arrows ↑ ↓ → are always grey/neutral, not coloured. They show direction only. Severity is communicated by the number colour, the progress bar, and the dot in the corner — adding colour to the arrow would be redundant noise."                     |
| **Smith-Kerns model**                                       | Disease card / Side panel                 | "Dollar Spot forecast model based on relative humidity and temperature. Validated on cool-season bentgrass; indicative only on warm-season turf."                                                                                                     |
| **Stress Index '19 /100'**                                  | Stress card headline                      | "Combined stress score (0 = no stress, 100 = critical). Weighted average of heat, light, moisture, traffic, nutrition, and disease pressure across the next 14 days. Shown as X /100, not percentage."                                                |
| **Driven by: Traffic 93%**                                  | Stress card driver line                   | "The biggest contributor to today's index. Number after the label is the raw component value (0–100). Even a high single component is weighted (×0.20 for traffic), so the headline can be lower than the driver number suggests."                    |
| **Driven by: Heat**                                         | Stress card driver line variant           | "Heat is the biggest contributor to current stress. Mitigation: increase irrigation, reduce traffic, consider covers."                                                                                                                                |
| **Driven by: Traffic**                                      | Stress card driver line variant           | "Traffic and events are the biggest contributor to stress. Mitigation: reduce or reschedule events, allow rest periods, redirect foot traffic."                                                                                                       |
| **Driven by: Water stress**                                 | Stress card driver line variant           | "Moisture imbalance (too dry or waterlogged) is the biggest contributor. Mitigation: adjust irrigation, check drainage."                                                                                                                              |
| **Driven by: Light deficit**                                | Stress card driver line variant           | "Insufficient light (shade) is the biggest contributor. Mitigation: supplemental lighting, reduce traffic in shaded areas."                                                                                                                           |
| **Driven by: Nutrition**                                    | Stress card driver line variant           | "Nutrient deficit is the biggest contributor. Mitigation: review tissue/soil tests, adjust fertilisation programme."                                                                                                                                  |
| **Driven by: Disease**                                      | Stress card driver line variant           | "Disease pressure is the biggest contributor. Mitigation: see Disease Risk card for the active threat and recommended fungicide."                                                                                                                     |
| **VWC**                                                     | Soil Moisture card                        | "Volumetric Water Content — percentage of water by volume in the soil. Directly measured by Hydrosight TDR sensors."                                                                                                                                  |
| **WP (Wilting Point)**                                      | Soil Moisture card range bar              | "Soil moisture below which the grass cannot extract water from the soil. Permanent wilting damage occurs below this point. Site-specific by soil type (USGA: 6%, sandy loam: 9%, loam: 12%, clay: 22%)."                                              |
| **TRIGGER**                                                 | Soil Moisture card range bar              | "Irrigation trigger — moisture level at which the system recommends watering. Calculated as Wilting Point + Available Water × (1 − MAD). Below trigger: 'Apply Xmm to return to field capacity'."                                                     |
| **FC (Field Capacity)**                                     | Soil Moisture card range bar              | "Maximum water the soil can hold against gravity after free drainage. Above FC = saturated/waterlogged (oxygen starvation, root rot risk). Site-specific by soil type (USGA: 15%, sandy loam: 20%, loam: 27%, clay: 40%)."                            |
| **Target band [TRIGGER, FC]**                               | Soil Moisture card range bar              | "Optimal operating range — between irrigation trigger and field capacity. In this zone the turf has adequate water without waterlogging. Site-specific per soil type, calculated from soil profile (not hardcoded)."                                  |
| **Bottom message 'X mm buffer before irrigation trigger'**  | Soil Moisture card bottom message         | "How much water (in millimetres) the soil can lose before reaching the irrigation trigger. Higher buffer = more margin before next watering needed."                                                                                                  |
| **Bottom message 'Apply X mm to return to field capacity'** | Soil Moisture card bottom message         | "Irrigation needed now. The number is the deficit — water required to refill from current VWC back to field capacity."                                                                                                                                |
| **Bottom message 'Soil is at or above field capacity'**     | Soil Moisture card bottom message         | "Soil is saturated. No irrigation needed. Watch for waterlogging signs (yellowing, root rot, increased disease pressure)."                                                                                                                            |
| **Irrigation Plan**                                         | Irrigation Plan card                      | "Calculated weekly irrigation requirement based on Penman-Monteith reference ET₀ and crop coefficient (Kc). Cool-season Kc = 0.85, warm-season = 0.75."                                                                                               |
| **Weekly requirement**                                      | Irrigation Plan card                      | "Total mm of water turf will lose to evapotranspiration over the next 7 days. Replace this with irrigation if there's no rain in the forecast."                                                                                                       |
| **Behind by Xmm**                                           | Irrigation Plan card                      | "Current water balance is below target — soil is drier than field capacity. Catch up with irrigation to avoid drought stress."                                                                                                                        |
| **Ahead by Xmm**                                            | Irrigation Plan card                      | "Current water balance is above target — soil holds more water than field capacity. Skip irrigation cycles to avoid overwatering and disease risk."                                                                                                   |
| **On track**                                                | Irrigation Plan card                      | "Water balance is at target — no adjustment needed."                                                                                                                                                                                                  |
| **ET / ET₀ / ETc**                                          | Irrigation Plan popover                   | "ET = evapotranspiration (water lost from plant + soil). ET₀ = reference (theoretical max). ETc = crop ET (ET₀ × Kc, what your specific turf actually loses)."                                                                                        |
| **TAW / MAD**                                               | Irrigation drill-down                     | "TAW = Total Available Water (max water soil holds between field capacity and wilting point). MAD = Management Allowed Depletion (typical 50% of TAW before irrigation)."                                                                             |
| **Spray window: Optimal**                                   | Conditions strip / Time-sensitive         | "Conditions are suitable for spraying right now. Wind, rain, dew, and leaf wetness all within safe limits."                                                                                                                                           |
| **Spray window: Risky**                                     | Conditions strip                          | "Some spray conditions are marginal. Review wind, rain, or dew before applying."                                                                                                                                                                      |
| **Spray window: Avoid**                                     | Conditions strip                          | "Conditions unsuitable for spraying — high wind, imminent rain, or heavy dew expected."                                                                                                                                                               |
| **Confidence: live**                                        | Action card / Vital signs                 | "Fresh data from a connected sensor right now. Highest confidence."                                                                                                                                                                                   |
| **Confidence: high**                                        | Action card / Vital signs                 | "Recent measured data (within methodology threshold). High confidence."                                                                                                                                                                               |
| **Confidence: estimate**                                    | Action card / Vital signs                 | "Calculated from model — no recent measured data available. Lower confidence."                                                                                                                                                                        |
| **Confidence: estimate only**                               | Action card / Vital signs                 | "Best-guess from model only — no soil/tissue test or sensor data available. Use with caution."                                                                                                                                                        |
| **Pre-emergent window**                                     | Time-sensitive chips                      | "Time period to apply pre-emergent herbicide before weeds germinate. Triggered by soil temperature thresholds."                                                                                                                                       |
| **PGR reapply**                                             | Time-sensitive chips                      | "Plant Growth Regulator reapplication window — based on Growing Degree Days since last application."                                                                                                                                                  |
| **Overseed window**                                         | Time-sensitive chips                      | "Time period when overseeding new grass is most likely to succeed (based on soil temperature and growth conditions)."                                                                                                                                 |
| **Act on this today**                                       | Headline                                  | "Critical actions are required today. See the TODAY section for what to do."                                                                                                                                                                          |
| **Plan this week**                                          | Headline                                  | "No urgent actions today, but you have items scheduled within the next few days."                                                                                                                                                                     |
| **All clear**                                               | Headline                                  | "No action items right now — only items in WATCHING for observation."                                                                                                                                                                                 |
| **TODAY**                                                   | Action queue bucket                       | "Items requiring action today. Examples: spray decisions, irrigation adjustments, urgent fungicide applications."                                                                                                                                     |
| **THIS WEEK**                                               | Action queue bucket                       | "Items scheduled within the next few days. Examples: pre-emergent ordering, planned PGR reapplication, upcoming match preparation."                                                                                                                   |
| **WATCHING**                                                | Action queue bucket                       | "Observation-only items, no action needed yet. Will move to TODAY or THIS WEEK if conditions change."                                                                                                                                                 |
| **Deferred**                                                | Action queue bucket                       | "Items you've manually postponed with a reason. Will reappear when their deadline approaches."                                                                                                                                                        |
| **Stale data**                                              | Data Confidence card (⚠ row)              | "Sample data is older than the recommended refresh interval. Recommendations may be inaccurate — consider new sample."                                                                                                                                |
| **Forensic record**                                         | Side panel / footer                       | "Unique run ID and timestamp for this analysis. Useful for tracking decisions over time and audit."                                                                                                                                                   |
| **DLI (☀️ X mol/m²/day)**                                   | Conditions strip                          | "Daily Light Integral — total amount of light the turf receives in a day, measured in mol/m². Higher = more photosynthesis possible. Calculated from solar radiation data."                                                                           |
| **DLI CRITICAL / DEFICIENT / ADEQUATE / OPTIMAL**           | Growth Potential side panel               | "How today's light compares to what this grass species needs. CRITICAL = below minimum survival threshold. DEFICIENT = grass can survive but growth is restricted. ADEQUATE = growth is possible. OPTIMAL = ideal light conditions for this species." |
| **mol/m²/day**                                              | Conditions strip / Growth Potential panel | "Moles of photons per square metre per day — the standard unit for measuring plant-usable light. Typical values: overcast winter day 5–8, sunny summer day 40–60. Turf needs 8–35 depending on species."                                              |


**Phase 1 priority terms** (must-have ⓘ icons): Growth Potential, GP bottom info line (Cool-Season/Warm-Season/Mixed · Thermal X%), Stress Index, Driver line, VWC, Target band, Confidence levels, Spray window verdicts, headline labels, DLI.

**Phase 2 expansion**: Smith-Kerns, model-specific terminology, pre-emergent/PGR/overseed window logic.

### 8.13. Deliverables checklist

1. Top Bar — desktop + mobile (включая stale indicator `⚠ New data imported` amber badge)
2. Conditions strip — desktop + mobile
3. Today's Actions — все 3 bucket секции (TODAY / THIS WEEK / WATCHING) + DEFERRED + minimal decision-first action card (4 строки: title + reason + consequence + buttons) + side panel mockup для drill-down (с trajectory chart, ACT NOW vs IF DELAYED two-pane, evidence list)
4. TIME-SENSITIVE WINDOWS row — chips
5. Vital Signs cards — 5 типов (Growth Potential, Disease Risk, Stress Index, Soil Moisture VWC, Irrigation Plan) × состояния (normal / warning / critical) с ⓘ icons и popover content
6. Data Confidence card
7. Evidence Health footer
8. Quick Capture FAB + bottom sheet
9. Site Switcher dropdown — collapsed + expanded multi-site overview
10. Empty states / loading / error для каждого ключевого компонента
11. Component library: pills, chips, badges, buttons, range bars, sparklines, **ⓘ tooltip popover**
12. Glossary popover content (English) — все термины из 8.12 с финальной wording

---

## 8a. Реалистичный пример для дизайнера — один сайт, один день

**Цель этой секции:** один конкретный, согласованный пример со всеми реальными значениями, чтобы дизайнер мог нарисовать realistic mockup, и заказчик увидел продуктовую ценность системы. Все числа — связаны логически (autumn cool-season → high RH → Dollar Spot pressure → urgent spray).

### Сценарий

- **Площадка:** Royal Melbourne Bowling Club — Green 1
- **Покрытие:** Bentgrass (Penn A4)
- **Методология:** MLSN
- **Регион:** Melbourne, VIC, Australia (temperate cool)
- **Дата запуска:** Wed 29 April 2026, 8:00 AM AEST (autumn)
- **Сенсор:** Hydrosight live (TDR глубина 0–7cm)
- **Последний пробоотбор soil:** 12 дней назад
- **Последний пробоотбор tissue:** 38 дней назад → показывается как ⚠ в Data Confidence card
- **Последний spray:** 8 дней назад (preventive Daconil Weather Stik)
- **Предстоящее событие:** Saturday tournament (через 3 дня)

### Top Bar

```
[Logo]  Royal Melbourne BC — Green 1  ▼   [Bentgrass] [MLSN] [Cool-Season]      Analysis: 5min ago  [↻ Re-run]
```

- **Site Switcher:** label «Royal Melbourne BC — Green 1», status dot **red** (`worstStatus()` = `high` по `diseaseDecision`: Dollar Spot HIGH), dropdown показывает другие 2 grееn'а клуба
- **Pills:** `Bentgrass` `MLSN` `Cool-Season` (тёмно-серые pills)
- **Analysis timestamp:** `Analysis: 5min ago` + кнопка `↻ Re-run` (relates to last orchestrator run, not sensor fetch — sensor freshness виден отдельно в Data Confidence panel снизу `Sensors / Hydrosight / 3m ago`)

### Verdict bar

```
[RED]  ⚠ Dollar Spot risk HIGH — forecast 69% tomorrow
```

`worstStatus()` = RED: `diseaseDecision()` возвращает `level: 'high'`, `text: 'Dollar Spot risk HIGH — forecast 69% in 1d. Consider fungicide application.'` — verdict bar показывает первую часть до точки.

### Status banners — убраны

### Conditions strip

```
🌫 CURRENT 14°C       Wed     Thu     Fri              [SPRAY WINDOW]
   Misty, RH 89%      🌤 17°  ☀ 19°   🌧 16°            Optimal (8hr)
                      0mm     0mm     6mm                wind 6 km/h
```

- Текущая температура **14°C**, **misty foggy** (классические autumn-dew условия Melbourne)
- RH **89%** — высокая, концерн для Dollar Spot
- Wed–Thu сухо, Fri PM rain 6mm → spray сегодня имеет смысл, окно закроется завтра вечером
- Spray Window pill: **Optimal** + `8hr remaining` + `wind 6 km/h`

### Today's Actions

```
[red]  Act on this today                                      0/1 resolved

TODAY (1)                                                            ●

  [estimate]  DISEASE › DOLLAR SPOT
  Apply fungicide today
  Risk 35% (threshold 20%) · holding stable
  If delayed: spray cost doubles
  [Commit — spray today]  [Defer]  View Details →

THIS WEEK (1)                                                        ●

  [estimate]  Pre-emergent
  Order pre-emergent
  Soil 17.0°C · window opens in ~6 days
  If delayed: one window this season
  [Commit — one window this season]  [Defer]  View Details →

WATCHING (2)

  Irrigation on track
  VWC 13% within target band 12–15% · Friday rain 6mm

  Nutrition (foliar K)
  Tissue K 1.8% (target 2.2%) · plan early next week
```

**Note 1 — minimal decision-first cards:**

Каждая action card отвечает на 4 вопроса в 4 строках максимум:

1. **Что?** → title (`Apply fungicide today`)
2. **Почему?** → reason с числами (`Risk 35% (threshold 20%) · holding stable`)
3. **Что если отложить?** → consequence (`If delayed: spray cost doubles`)
4. **Уверены?** → confidence chip (`estimate`)

Никаких дублирующих блоков `CURRENT RISK 35%`, `7-DAY FORECAST`, `ACT NOW/IF DELAYED two-pane`, `IF YOU DELAY: ...` на самой карточке — это всё уходит в side panel при клике по `View Details →`.

**Note 2 — section/headline labels из реального кода ([gaip-decision-engine.js:597-603](assets/gaip-decision-engine.js)):**

- Headline: `Act on this today` (если actCount>0) / `Plan this week` (если planCount>0) / `All clear`
- Bucket labels: `Today` (red) / `This week` (amber) / `Watching` (dim grey) — точные строки из `counts[].w`
- 4-я секция `DEFERRED` появляется только если есть deferred items (state, не tier) — collapsible

**Note 3 — relative due times:** DSM не имеет clock-times, использует tier-based группировку (`act-on` = today, `plan-on` = this week, `watch` = watching).

**Note 2 — действия action card:** все кнопки соответствуют существующим DSM функциям:


| Кнопка в UI         | Реальный label из DSM кода                                              | DSM функция              |
| ------------------- | ----------------------------------------------------------------------- | ------------------------ |
| Disease commit      | `Commit — spray today` / `Commit to fungicide application today`        | `commit(itemId)`         |
| PGR commit          | `Commit to reapplication` / `Commit — window closes in Xd`              | `commit(itemId)`         |
| Pre-emergent        | `Commit — one window this season` / `Commit to ordering pre-emergent`   | `commit(itemId)`         |
| Irrigation commit   | `Commit to this decision` (default fallback — `forkActLbl: ''`)         | `commit(itemId)`         |
| `Defer`             | `Defer until` (plan-on/watch) / `Defer until (confirm reason)` (act-on) | `defer(itemId, horizon)` |
| `View Details →`    | (нет в текущем UI) — link на `/analysis/{engine}` page                  | NEW UI link, без backend |
| ~~`Mark Complete`~~ | (удалено) — phantom, в DSM нет такого label, всегда «Commit ...»        | —                        |
| ~~`Acknowledge`~~   | (удалено) — phantom, plan-on/watch используют тот же `Commit ...`       | —                        |
| ~~`View Map`~~      | (удалено) — phantom, zone-map есть только в Stadium sub-module          | —                        |


**Источники реальных labels:** [gaip-decision-engine.js:224,227,321,324,544,547](assets/gaip-decision-engine.js) (item-specific), [gaip-decision-ui.js:307](assets/gaip-decision-ui.js) (default fallback), [gaip-decision-ui.js:317](assets/gaip-decision-ui.js) (defer label by tier).

После клика (existing DSM behaviour, без изменений):

- `Commit ...` → state становится `committed`, action заменяется на `commitConsequence` text (тексты уже в [gaip-decision-engine.js:326-554](assets/gaip-decision-engine.js))
- `Defer` для act-on → modal с reason capture; для plan-on/watch — прямой defer. State становится `deferred`. Возврат через `undo()`.

### TIME-SENSITIVE WINDOWS (chips)

```
🚿 Spray: Optimal today    🌧 Rain: Fri (6mm)
```

2 chip'а — все значения **берутся напрямую из существующих движков без новых вычислений**:


| Chip                 | Данные                                | Источник напрямую                                                      |
| -------------------- | ------------------------------------- | ---------------------------------------------------------------------- |
| Spray: Optimal today | verdict `Optimal` / `Risky` / `Avoid` | [spray-log-cascade.js](assets/spray-log-cascade.js) — boolean verdict  |
| Rain: Fri (6mm)      | day label + mm value                  | [climate-engine.js:27](assets/climate-engine.js) `dailyPattern[].rain` |


**Не использованы (требуют новых вычислений или phantoms):**

- ❌ «Spray: Optimal (6hr remaining)» — hours-remaining требует derivation поверх hourly forecast (~10 строк новой логики). Если решим добавить — это NEW UI computation. Сейчас оставляем просто verdict.
- ❌ «Rain expected Fri AM (48hr)» — hours-until rain требует scan hourly forecast (~5 строк). Сейчас оставляем просто `day + mm`.
- ❌ «Fertilizer window opens Mon» — phantom, в коде нет концепции nutrient timing window. Nutrition даёт «apply X g/m²», не «window opens Y».
- ❌ «Pre-emergent: Xd remaining» chip — данные есть (`applicationWindowOpen`), но в этом сценарии pre-emergent уже в THIS WEEK bucket, дублирование не нужно. В других сценариях chip уместен.

### Vital Signs (правая колонка)

#### 1. Growth Potential

```
Growth Potential ⓘ                                            📈
62%
↓ Forecast 55% in 8 days
[████████████░░░░░░░░]
              Cool-Season · Thermal 26% ⓘ
```

Autumn → growth slows. Финальный GP 62% выше чем чисто термальный 26%, потому что day length и variety adjustment дают boost. Normal seasonal pattern для bentgrass.

**Note дизайнеру по arrow color:** стрелка `↓` **neutral grey/dark** (не цветная). Цвет несут другие элементы: `62%` зелёный (≥50% threshold), progress bar зелёный. Стрелка только показывает направление. Plural rule в labels: `in 1 day` (singular) / `in 8 days` (plural).

**Note дизайнеру по формату:** в коде GP хранится как decimal `0.0–1.0` (например `0.62`). На дизайне всегда показывать **percentage** (`62%`) — single format consistency. Не смешивать `0.62` и `62%` в одной карточке.

**Note дизайнеру по bottom info line:** категория (`Cool-Season`) и Thermal score (`26%`) объединены в одну строку внизу карточки, потому что они **физически связаны** — Thermal рассчитан по C3-формуле (потому что трава cool-season). Раньше это были два разных элемента (Thermal сверху, Cool-Season badge снизу) — пользователь не видел связь. Для mixed stands формат: `Mixed C3/C4 · C3: 80% · C4: 25% Thermal` (без отдельной категории — она inline в breakdown).

**ⓘ icons** открывают popover с plain-language объяснением (см. секцию 8.12 Glossary):

- `Growth Potential ⓘ` → "How actively the turf is growing right now (0% dormant — 100% peak growth)..."
- `Cool-Season · Thermal 26% ⓘ` → "Cool-season grasses (rye, fescue, bent) — optimal 15–24°C. Thermal 26% is the temperature-only score using the C3 formula, before day length and variety adjustment."

#### 2. Disease Risk

**Pattern A — Same disease rising** (Dollar Spot текущий 32%, forecast 78% on day 5 — same disease):

```
Disease Risk ⓘ                                                🔴
HIGH                                              Forecast Peak

32% today  →  78% in 5 days                                   ← L bold (22-24px)
Dollar Spot ⓘ                                                 ← M label под цифрой
[████████████████░░░░]
```

**Note дизайнеру по typography:** **цифры — главное** на этой карточке (это операционная информация). Severity word `HIGH` — XL bold (32px+), risk numbers `32% today → 78% in 5 days` — L bold (22-24px), disease name `Dollar Spot` — M regular (14-16px) под цифрой как supporting label. На предыдущем скриншоте было наоборот (имя болезни визуально сильнее числа) — это поправлено.

**Note дизайнеру по labels:** `today` / `in N day(s)` вместо более криптичных `day 5` (existing widget). Plural rule: `in 1 day` (singular) / `in 5 days` (plural). Никаких "Critical in 5d" — это derivation, мы используем raw `in 5 days`. Multi-disease breakdown (Brown Patch, Pythium и др.) — в side panel при тапе на карточку.

**Если бы было differently** (например, Dollar Spot 32% сейчас, но Fusarium Patch forecast peak 69% in 1 day — другая болезнь поднимется выше) — Pattern B:

```
Disease Risk ⓘ                                                🔴
HIGH                                              Forecast Peak

32% today                                                     ← L bold
Dollar Spot ⓘ                                                 ← M label

⚠ 69% in 1 day                                                ← L bold
Fusarium Patch (Microdochium) ⓘ                               ← M label
[████████████░░░░░░░░]
```

Match существующего widget behaviour по структуре ([daily-dashboard.js:686-694](assets/daily-dashboard.js)) — копи-текст изменён на `in N day(s)`, иерархия typography поправлена numbers-first.

Hero-метрика дня. Trajectory `32% → 78%` показывает почему urgent fungicide.

**ⓘ icons** (см. секцию 8.12):

- `Disease Risk ⓘ` → "High disease pressure detected. Action recommended now to prevent outbreak."
- `Dollar Spot ⓘ` → "Smith-Kerns model — Dollar Spot forecast based on humidity and temperature. Validated on cool-season bentgrass."

#### 3. Stress Index

```
STRESS INDEX ⓘ                                                ⚡

21 /100
Driven by: Heat 56% ⓘ
↓ Decreasing — peak in 5 days
[██████░░░░░░░░░░░░░░░] 21%
```

Низкий стресс (21/100) — composite index. Driver line `Driven by: Heat 56%` показывает что **главный вклад** в индекс это heat component (raw 56 из 100, weighted 0.20 → contributes ~12.5 к headline 21). Растение здоровое и ответит на лечение хорошо.

Trajectory `↓ Decreasing — peak in 5 days` — peak уже прошёл / он на day 0 (engine `trend: 'improving'`), стресс будет снижаться.

**Note дизайнеру по compact summary:**

- Tier 2 card = **только основное**: index + primary driver + trajectory + один progress bar
- Multi-factor breakdown (все 6 компонентов: Heat / Moisture / Light / Traffic / Nutrition / Disease) — **в side panel** при тапе. Не на карточке.
- 14-day sparkline — тоже в side panel.
- Карточка должна давать at-a-glance ответ: «насколько плохо + что главная причина + куда идём».

**Note дизайнеру по `19 /100` vs `19%`:**

- Stress Index это **composite score 0–100**, не percentage. Использовать `/100` чтобы показать масштаб явно (как в `7/10 rating`).
- Existing UI использует `%` suffix (`19% today`) — это **bug**, заменяем на `/100`.

**Note дизайнеру по arrow color:** стрелка `↓` **neutral grey** (не цветная). Цвет несут: `21 /100` зелёный (< 30 threshold), progress bar зелёный.

**Note дизайнеру по `Driven by: <stressor> <value>%`:**

- `<stressor>` берётся из `summary.primaryStressor` (engine output)
- `<value>` это raw component value (0–100 из `currentComponents`), не weighted
- Это объясняет пользователю **почему** именно этот фактор главный (Heat 56% → biggest contribution к composite)
- Альтернативный сценарий: если Traffic = 93% и остальные ≤ 5% — `Driven by: Traffic 93%` (см. screenshot reference)

**ⓘ icons** открывают popover (см. секцию 8.12):

- `STRESS INDEX ⓘ` → "Combined stress score (0 = no stress, 100 = critical). Weighted average of heat, light, moisture, traffic, nutrition, and disease pressure across the next 14 days. Shown as X /100, not percentage."
- `Driven by: Heat 56% ⓘ` → "Heat is the biggest contributor to current stress (raw component 56/100). Mitigation: increase irrigation, reduce traffic, consider covers."

(**Note дизайнеру:**

- Single overall progress bar = `currentScore` value, color по threshold (зелёный <30, амбер ≤60, красный >60).
- Multi-factor bars (Heat / Moisture / Light / Traffic / Nutrition / Disease) — **в side panel** при тапе на карточку, не на summary tier.
- 14-day sparkline — тоже в side panel.
- Driver line `Driven by: Heat 56%` берётся из `summary.primaryStressor` + raw component из `currentComponents.thermal` ([stress-trajectory-engine-pure.js:963,785-792](assets/stress-trajectory-engine-pure.js)). Existing widget этот field **не читает** — это NEW UI binding.
- Не использовать формулировку «was 29» — phantom.)

#### 4. Soil Moisture (VWC) ⓘ

Royal Melbourne — USGA greens spec (sand-based rootzone). Real target band для USGA = `[12%, 15%]`. Adaptive scale: `scale_max = FC × 1.5 = 22.5%`.

```
SOIL MOISTURE (VWC) ⓘ  ·  Hydrosight                       💧  ← provider name inline, small grey

13 %                                                          ← XL bold green (in optimal zone)

┌───────────────────────────────────────────────┐
│██▓▓▓░░░░░░▓▓▓▓▓▓▓░│░░██████████████████████████│            ← color zones + green vertical line
└────│──────│──────│┴│──────────────────────────┘
     WP     TRIG   FC                             0% ........ 22.5%
     6%     12%    15%

0.7mm buffer before irrigation trigger                        ← engine literal message
```

VWC = 13% — между TRIGGER (12%) и FC (15%) → status `optimal` → marker line зелёная. Bottom message — literal engine output: `"0.7mm buffer before irrigation trigger"` ([irrigation-scheduler.js:1132](assets/irrigation-scheduler.js)).

**Marker positions на bar** (scale_max = 22.5%):

- WP 6% → 27% от ширины bar
- TRIG 12% → 53% от ширины bar
- FC 15% → 67% от ширины bar
- Current VWC 13% → 58% от ширины bar (между TRIG и FC = optimal zone, зелёная line)

**ⓘ icons** (см. секцию 8.12):

- `SOIL MOISTURE (VWC) ⓘ` → "Volumetric Water Content — percentage of water by volume in the soil. Measured directly by Hydrosight TDR sensors."
- `WP 6%` → "Wilting Point — soil moisture below which the grass cannot extract water. For USGA sand greens: 6%."
- `TRIGGER 12%` → "Irrigation trigger — moisture level at which the system recommends watering. Calculated as wilting point + (available water × (1 − MAD))."
- `FC 15%` → "Field Capacity — maximum water the soil can hold against gravity. Above this is saturated/waterlogged."
- `· Hydrosight` → название провайдера данных. Tooltip (на hover): "Data source: Hydrosight TDR sensors". Freshness/status — в top-bar Data Confidence panel.

**Sensor provider name — Royal Melbourne example:**

- RMGC использует Hydrosight TDR sensors → рядом с заголовком: `SOIL MOISTURE (VWC) ⓘ  ·  Hydrosight`
- Если бы RMGC использовал CSV import → `· CSV import`
- Если бы не было источника → ничего (или `· Manual estimate`)
- Никакого freshness/age на самой карточке — это в top-bar Data Confidence panel

**Note дизайнеру по target band:**

- Используется **site-specific** target band из `irrigation-scheduler.thresholds` (per soil type), не hardcoded `[15, 25]` decision-engine.
- USGA greens → `[12, 15]`. Sandy loam fairway → `[17, 20]`. Loam → `[22, 27]`. См. таблицу в секции 8.6.4.
- Range bar показывает 4 markers: WP / TRIGGER / FC / current VWC. Зелёная зона между TRIGGER и FC = optimal operating range.

**Note дизайнеру по adaptive scale (важно — fix для crowding):**

- Scale max **не статичные 40%**, а `FC × 1.5` (адаптируется по soil type)
- USGA: scale 0-22.5% (FC 15 × 1.5)
- Sandy loam: scale 0-30% (FC 20 × 1.5)
- Loam: scale 0-40.5% (FC 27 × 1.5)
- Это даёт optimal зоне ~13% ширины при любом soil type, а saturated ~33% (видна но не доминирует)
- На предыдущем мокапе с static 40% scale optimal zone для USGA сжималась до 7.5% — это **исправлено**

**Note дизайнеру по current VWC marker:**

- **Vertical line** через всю высоту bar (2-3px), цвет = severity color текущей zone (зелёная для optimal, амбер dry, красная wilting, синяя saturated)
- **БЕЗ label** на marker — число `13%` уже показано в XL headline над bar, дублировать не нужно
- БЕЗ стрелки/треугольника — vertical line чище и не перекрывает color zones

**Note дизайнеру по bottom message:**

- **Только дословные строки из engine** ([irrigation-scheduler.js:1114-1135](assets/irrigation-scheduler.js)) — никакого "Upper target band — skip cycle today" (это был phantom в раннем mockup).
- 3 возможных строки:
  - `"Soil is at or above field capacity. No irrigation needed."` (saturated, vwc ≥ fc)
  - `"Apply ${refillDepth}mm to return to field capacity"` (needs irrigation, vwc ≤ trigger)
  - `"${marginToTrigger}mm buffer before irrigation trigger"` (optimal/adequate, trigger < vwc < fc)

**Note дизайнеру:** убрана direction arrow (`↑ Trending up`) — short-term VWC trend logic не подтверждён в коде. Показываем только статичную позицию относительно target band.

#### 5. Irrigation Plan ⓘ

```
Irrigation Plan ⓘ                                             💧
7 mm
Weekly requirement ⓘ
↓ Ahead by 6mm — skip cycle ⓘ
```

ETc × 7 = 7mm/week. VWC выше target band → currentDeficit = -6mm (overwatered). Совпадает с Action #3 «Skip evening cycle» в action queue.

**ⓘ icons** (см. секцию 8.12):

- `Irrigation Plan ⓘ` → "Calculated weekly irrigation requirement based on Penman-Monteith reference ET₀ and crop coefficient (Kc). Cool-season Kc = 0.85, warm-season = 0.75."
- `Weekly requirement ⓘ` → "Total mm of water turf will lose to evapotranspiration over 7 days. Replace this if no rain forecast."
- `Ahead by 6mm — skip cycle ⓘ` → "Current water balance shows 6mm surplus above target. Skip irrigation cycles to avoid overwatering and disease risk."

**Note дизайнеру:** existing widget показывает просто `Deficit: -6mm` без интерпретации знака. Negative deficit = overwatered (surplus), positive deficit = behind. В новом дизайне знак переведён в plain language `Behind by Xmm` / `Ahead by Xmm` для немедленной actionability + arrow direction (↑/↓).

### Data Confidence

```
Data Confidence                                              1 issue
✓ Weather (Open-Meteo)                                  Live
✓ Soil Test                                            12d ago
⚠ Tissue Test                                          38d ago — Import
✓ Sensors (Hydrosight)                                  3m ago
✓ Water Test                                            Current (8d)
✓ Spray Log                                            Up to date (8d)
```

(6 источников, 5 ✓, 1 ⚠ tissue — вся информация здесь, баннера вверху нет)

### Evidence Health footer

```
Evidence Health: ● 5 sources current · 1 needs update                  Setup 5/6 sources
```

Заменили двусмысленное «80%» на явное `Setup 5/6 sources`.

### Связанная история (для заказчика)

Эта картинка показывает **decision-первый dashboard**, который ОДНОЙ страницей даёт:

1. **Что делать сегодня:** 2 urgent действия с реальными причинами
2. **Почему это важно:** Dollar Spot 32→78%, Pre-emergent окно закроется через 6 дней
3. **Можно ли это сделать прямо сейчас:** SPRAY WINDOW Optimal, wind 6 km/h, no rain till Friday
4. **Нет ли противоречий:** Stress низкий (растение ответит хорошо), VWC в верхней части target (можно пропустить вечерний цикл)
5. **Что система знает плохо:** tissue test устарел 38 дней (но это НЕ ломает решения, только nutrition advice ослаблен)

Manager за 30 секунд получает: «Распылить Heritage сегодня до вечера + аппликация pre-emergent в течение 6 дней + пропустить вечерний полив. К субботнему турниру всё будет в порядке.»

### Mapping каждого числа в этом примере к источнику в коде


| Значение                                                          | Источник                                                                                                                                                                                                                    |
| ----------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Site name, profile pills                                          | `gilba_sites_load` AJAX, `gaip-site-context.js`, `regional-profiles.js`                                                                                                                                                     |
| Analysis: 5min ago                                                | `FORENSIC_RECORD.timestamp` (last orchestrator run timestamp)                                                                                                                                                               |
| Soil 12d / Tissue 38d / Water 8d / Spray 8d                       | `sample-manager.js` + `class-gilba-spray-log.php`                                                                                                                                                                           |
| Temp 14°C / RH 89% / wind 6 km/h / 3-day forecast                 | climate-engine v2 + Open-Meteo                                                                                                                                                                                              |
| Spray Window Optimal (verdict)                                    | `spray-log-cascade.js` (verdict only, без часов)                                                                                                                                                                            |
| Dollar Spot `32% today → 78% in 5 days`                           | data: [disease-forecast.js:1201-1206](assets/disease-forecast.js) `topThreat`/`peakRisk`/`peakDay`; widget render [daily-dashboard.js:680-685](assets/daily-dashboard.js) Pattern A; copy updated `day 5` → `in 5 days`     |
| Severity word HIGH                                                | [daily-dashboard.js:710-715](assets/daily-dashboard.js) thresholds <50/<70/<85/≥85 on `max(currentRisk, forecastPeak)`                                                                                                      |
| Multi-disease breakdown (Brown Patch, Pythium и др. в side panel) | `forecast.diseases` (sortedDiseases) [disease-forecast.js:1186-1188](assets/disease-forecast.js)                                                                                                                            |
| Heritage Maxx product (specific)                                  | [disease-engine.js:653](assets/disease-engine.js) `trade: "Heritage Maxx"`                                                                                                                                                  |
| GP 62% (current) → 55% (8d forecast)                              | climate-engine `GP` decimal 0–1 (× 100 для UI); 8-day forecast slice. **Always show as percentage**                                                                                                                         |
| Cool-Season badge                                                 | [climate-module-v2.1-dual-metrics.js](assets/climate-module-v2.1-dual-metrics.js) `isWarmSeason()`                                                                                                                          |
| Stress Index `21 /100`                                            | data: `summary.currentScore` [stress-trajectory-engine-pure.js:950](assets/stress-trajectory-engine-pure.js); composite weighted from 6 components                                                                          |
| `Driven by: Heat 56%`                                             | data: `summary.primaryStressor` + `currentComponents[primaryStressor]` [stress-trajectory-engine-pure.js:963,785-792](assets/stress-trajectory-engine-pure.js); **NEW UI binding** — engine output already exists           |
| `↓ Decreasing — peak in 5 days`                                   | data: `summary.trend` + `summary.peakDay` [stress-trajectory-engine-pure.js:953,970](assets/stress-trajectory-engine-pure.js); `peakDay+1` для 1-based UI display                                                           |
| Multi-factor bars (side panel only)                               | `currentComponents` (6 factors 0–100) [stress-trajectory-engine-pure.js:785-792](assets/stress-trajectory-engine-pure.js); existing render [daily-dashboard.js:774-808](assets/daily-dashboard.js) переносится в side panel |
| VWC `13%`                                                         | data: sensor [sensor-api-bridge.js](assets/sensor-api-bridge.js) `vwc` field; fallback: state                                                                                                                               |
| Target band `[WP 6% / TRIGGER 12% / FC 15%]` (USGA greens)        | data: [irrigation-scheduler.js:1086,1091,1145-1148](assets/irrigation-scheduler.js) site-specific thresholds per soil type; **NEW UI binding** (decision-engine hardcoded `[15, 25]` — bug fix item)                        |
| Bottom message `0.7mm buffer before irrigation trigger`           | literal: [irrigation-scheduler.js:1132](assets/irrigation-scheduler.js) `recommendation.message` (Pattern: optimal/adequate, trigger < vwc < fc)                                                                            |
| Soil temp 13.8°C / Poa annua threshold                            | [pre-emergent-engine.js:153](assets/pre-emergent-engine.js) `poa_annua` declining trigger                                                                                                                                   |
| Pre-emergent window 6d remaining                                  | [gaip-decision-engine.js:434](assets/gaip-decision-engine.js) `applicationWindowOpen` + days                                                                                                                                |
| Skip evening cycle / VWC upper band advice                        | [irrigation-scheduler.js:775-776](assets/irrigation-scheduler.js) `irrigation.recommended` boolean + `totalDepth` mm                                                                                                        |
| Tissue K 1.8% / target 2.2%                                       | `tissue-corrective-engine-pure.js` + `nutrition-summary-integration.js` (без window-семантики)                                                                                                                              |
| Confidence 92% / 85% / 70%                                        | `engine-confidence.js` + `confidence-ui-integration.js`                                                                                                                                                                     |
| Status pill "2 Urgent · 1 Watching"                               | DSM tier aggregation (5 строк derivation поверх `gaip-decision-engine.js`)                                                                                                                                                  |
| "5 min ago" relative timestamp                                    | format helper поверх `FORENSIC_RECORD.timestamp`                                                                                                                                                                            |
| Action descriptions                                               | `gaip-decision-engine.js` items + reasoning templates                                                                                                                                                                       |


Все значения проверяемые, все ссылки на реально существующие движки.

### Что было исправлено в этом примере (по итогам verification pass)


| Было                                  | Стало                      | Причина                                                    |
| ------------------------------------- | -------------------------- | ---------------------------------------------------------- |
| Spray Window: Optimal (8hr remaining) | Spray Window: Optimal      | hours-remaining требует new derivation                     |
| Reduce evening cycle by 20%           | Skip evening cycle         | engine выдаёт `recommended boolean + mm`, не «reduce by %» |
| Foliar K window opens Mon             | Foliar K — early next week | nutrition не имеет window-семантики                        |
| Combine with Wed fungicide tank-mix   | (удалено)                  | нет automated tank-mix advice                              |
| ↑ Trending up (VWC)                   | (убран arrow)              | short-term VWC trend logic не подтверждён                  |


---

## 9. Audit: current implementation → target mapping

Систематический проход по текущему коду, чтобы план был привязан к реальным файлам.

### 9.1. Текущие entry points (shortcodes)

Confirmed via `grep "add_shortcode"`:

- `[gaip_hub]` — [gilba-agronomic-intelligence-hub.php:8845](gilba-agronomic-intelligence-hub.php) — главный hub (Today/Analysis/Programmes/Reports/Stadium табы)
- `[gaip_field_log]` — [gilba-agronomic-intelligence-hub.php:9005](gilba-agronomic-intelligence-hub.php) — field capture page
- `[gaip_morning_briefing]` — [gilba-agronomic-intelligence-hub.php:9129](gilba-agronomic-intelligence-hub.php) — multi-site overview
- `[gaip_benchmark]` — [includes/class-gilba-benchmark-chart.php:42](includes/class-gilba-benchmark-chart.php) — benchmark chart
- `[gssh_*]` — [includes/stadium/class-shortcodes.php](includes/stadium/class-shortcodes.php) — Stadium sub-hub (12 shortcodes)

### 9.2. Текущая навигация (top-level)

Confirmed via [assets/tab-navigation.js:40-46](assets/tab-navigation.js):

```
Today / Analysis / Programmes / Reports / Stadium (conditional)
```

Это табы внутри одного `[gaip_hub]` shortcode — не отдельные URL'ы. Таргет-IA из раздела 2 заменит их на полноценные routes (если переходим на Laravel) или WP pages с разными shortcodes (если остаёмся на WP в краткосроке).

### 9.3. Mapping: current code → target dashboard layout


| Current code (file → DOM container)                                                                         | Target Dashboard tier                                                        | Action                                                                                                                                                                                                                                    |
| ----------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `daily-dashboard.js` → 7 widgets (GP, Disease, Stress, Weather, Irrigation, Actions, PGR)                   | Tier 2 Vital Signs (5 cards)                                                 | **Refactor**: оставить GP, Disease, Stress, Irrigation как hero cards + добавить новый Soil Moisture (VWC) card. Убрать Weather (→ Conditions strip), Actions (→ Action Queue), PGR (→ Time-sensitive chips или Action Queue если urgent) |
| `gaip-decision-ui.js` → `#gaip-decision-panel`                                                              | Tier 1 Action Queue                                                          | **Refactor**: переписать render под реальные DSM bucket'ы TODAY / THIS WEEK / WATCHING (+ DEFERRED collapsible), minimal cards 4 строки, ACT NOW vs IF DELAYED two-pane перенести в side panel drill-down                                 |
| `priority-action-queue.js` → priority queue widget                                                          | Tier 1 Action Queue                                                          | **Merge**: слить с DSM render, удалить дубль                                                                                                                                                                                              |
| `gaip-evidence-ui.js` → `#gaip-evidence-panel`                                                              | Tier 5 Evidence one-liner + Layer 6 expandable                               | **Refactor**: компактная строка по умолчанию, детали при раскрытии                                                                                                                                                                        |
| `card-layout-redesign.js` → result cards (disease/climate/growth/lab/wear/nutrition/pgr/spray-log/cultivar) | Layer 6 Deep analysis (collapsed)                                            | **Keep**: оставить как expandable cards                                                                                                                                                                                                   |
| `tab-navigation.js` → Today/Analysis/Programmes/Reports/Stadium                                             | Top-level routing                                                            | **Replace**: заменить на новую IA из раздела 2                                                                                                                                                                                            |
| `floating-run-button.js` → floating button                                                                  | Top bar `↻ Re-run`                                                           | **Replace**: переместить в шапку                                                                                                                                                                                                          |
| `hub-header-bar.js` → header chrome                                                                         | Top bar redesign                                                             | **Refactor**: добавить enriched site switcher, status, pills                                                                                                                                                                              |
| `site-selector-ui.js` → simple select                                                                       | Site Switcher dropdown                                                       | **Refactor**: добавить status dots, multi-site overview, decision rows                                                                                                                                                                    |
| `gaip-morning-briefing.js` → standalone shortcode                                                           | Site Switcher dropdown content                                               | **Retire shortcode + reuse logic**: decision row functions (`gpDecision`, `diseaseDecision`, `vwcDecision`, `pgrDecision`) переиспользовать в dropdown                                                                                    |
| `gaip-field-log.js` capture logic                                                                           | Quick Capture FAB sheet                                                      | **Wrap UI**: capture logic не трогать, UI обернуть в sheet, retire standalone shortcode                                                                                                                                                   |
| `gaip-field-log-analysis.js` analysis                                                                       | `/data/observations`, `/data/mowing-log`, `/data/site-notes`, `/data/photos` | **Build views**: данные есть в IndexedDB + БД на git, нужны list views                                                                                                                                                                    |
| `contradiction-detector.js` background logic                                                                | (none)                                                                       | **Keep silent**: логика остаётся в фоне без UI surfacing                                                                                                                                                                                  |
| `engine-confidence.js` + `confidence-ui-integration.js`                                                     | Confidence chips на action cards (всегда видимы)                             | **Refactor**: сделать всегда-видимыми вместо условного показа                                                                                                                                                                             |
| `event-planner-ui.js` + `venue-readiness-ui.js` + `event-planner-engine.js`                                 | Tier 3 chip (Tournament: Sat Xd)                                             | **Chip only** — данные для chip есть (`parseDate`); `/events` страница не строится в этом редизайне (кнопка входа отсутствует в текущей версии)                                                                                           |
| `pre-emergent-integration.js`                                                                               | Tier 3 chip + `/analysis/preemergent`                                        | **Surface as chip + analysis page**                                                                                                                                                                                                       |
| `pgr-ui.js` + PGR module                                                                                    | Tier 3 chip + `/analysis/pgr-irrigation`                                     | **Surface as chip + analysis page**                                                                                                                                                                                                       |
| `overseed-multiplier.js` + `overseed-climate-integration.js`                                                | Tier 3 chip                                                                  | **Surface as chip**                                                                                                                                                                                                                       |
| `dew-prediction-ui.js`                                                                                      | Tier 4 Conditions strip (dew 10pm)                                           | **Surface in strip**                                                                                                                                                                                                                      |
| `disease-ui.js` + disease engine                                                                            | Tier 2 Disease card + Layer 6 deep + `/analysis/disease`                     | **Three-level**: hero card → expanded → dedicated page                                                                                                                                                                                    |
| `climate-module-v2.1-ui.js`                                                                                 | Tier 4 strip + Layer 6 + `/analysis/growth-light`                            | **Three-level** (climate context включён в growth-light страницу, отдельной /analysis/climate нет)                                                                                                                                        |
| `stress-trajectory-ui.js`                                                                                   | Tier 2 Stress card + Layer 6 + `/analysis/stress`                            | **Three-level**                                                                                                                                                                                                                           |
| `tissue-ui.js` + `tissue-progressive-disclosure.js`                                                         | `/data/tissue` + `/analysis/soil-nutrition`                                  | **Split**: input в Data, analysis в Analysis                                                                                                                                                                                              |
| `water-blender-ui.js` + `water-progressive-disclosure*.js`                                                  | `/data/water` + `/analysis/water`                                            | **Split**                                                                                                                                                                                                                                 |
| `sample-manager.js` + `sample-switcher-ui.js`                                                               | `/data/`* каждой категории                                                   | **Reuse**                                                                                                                                                                                                                                 |
| `sensor-import-ui.js` + `sensor-integration-ui.js`                                                          | `/data/sensors` + `/settings/sensors`                                        | **Split**: data в Data, config в Settings                                                                                                                                                                                                 |
| `spray-log-ui.js` + `spray-log-integration.js` + `spray-log-cascade.js`                                     | `/data/spray-log` + Tier 4 Spray verdict                                     | **Reuse + surface verdict**                                                                                                                                                                                                               |
| `gaip-scenario-engine.js` + `gaip-whatif-ui.js` + `scenario-presets.js` + `scenario-export.js`              | `/reports/scenarios`                                                         | **Move**                                                                                                                                                                                                                                  |
| `prediction-logger.js` + `outcome-capture-ui.js` + `class-gilba-prediction-logger.php`                      | `/reports/accuracy` + `/analysis/accuracy`                                   | **Move + surface**                                                                                                                                                                                                                        |
| `benchmark-chart.js` + `class-gilba-benchmark-chart.php`                                                    | `/analysis/accuracy`                                                         | **Move**                                                                                                                                                                                                                                  |
| `word-export*.js` + `gaip-ical-export.js` + `gssh-led-export.js`                                            | `/reports/export`                                                            | **Consolidate**                                                                                                                                                                                                                           |
| `class-gilba-interpretation.php` (Claude AI)                                                                | Inline в `/analysis/`*                                                       | **Reuse**                                                                                                                                                                                                                                 |
| `gilba-soil-interpretation.js` + `gilba-water-interpretation.js` + `gilba-synthesis-interpretation.js`      | `/analysis/soil-nutrition` + `/analysis/water`                               | **Reuse**                                                                                                                                                                                                                                 |
| `class-gilba-spray-log.php` + `class-gilba-apvma-sync.php`                                                  | `/data/spray-log` (APVMA sync runs in background, no UI настройки)           | **Reuse log only**                                                                                                                                                                                                                        |
| `class-gilba-alerts.php` + `gilba-alerts.js`                                                                | `/settings/notifications` (settings only) + Tier 1 surface                   | **No inbox**: alerts остаются push-only                                                                                                                                                                                                   |
| `site-setup-wizard.js`                                                                                      | `/onboarding/step-1..5`                                                      | **Surface as routes**                                                                                                                                                                                                                     |
| `site-config-persistence.js` + `gilba_sites_save/load` AJAX                                                 | `/settings/sites`                                                            | **Move**                                                                                                                                                                                                                                  |
| `identity-enforcement.js` + `gaip-site-context.js`                                                          | Top bar context pills                                                        | **Surface**                                                                                                                                                                                                                               |
| `auto-refresh.js` + `weather-resilience.js`                                                                 | Background — без UI                                                          | **Keep silent**                                                                                                                                                                                                                           |
| `floating-run-button.js`                                                                                    | Top bar `↻`                                                                  | **Replace**                                                                                                                                                                                                                               |
| `gilba_logo_get/save/delete/select` AJAX                                                                    | `/settings/branding`                                                         | **Reuse**                                                                                                                                                                                                                                 |
| `gilba_hydrosight_proxy` + `gilba_specconnect_proxy` AJAX                                                   | `/data/sensors` (live) + `/settings/sensors` (config)                        | **Split**                                                                                                                                                                                                                                 |
| `gilba_geocode_search` AJAX + `class-gilba-lab-parser.php`                                                  | `/onboarding` + `/data/templates` import flow                                | **Reuse**                                                                                                                                                                                                                                 |


### 9.4. To retire / fully

- `[gaip_field_log]` shortcode → заменён FAB
- `[gaip_morning_briefing]` shortcode → заменён enriched Site Switcher
- `assets/tab-navigation.js` (Today/Analysis/Programmes/Reports tabs) → заменены полноценным routing
- `assets/floating-run-button.js` → переезжает в top bar

### 9.5. To build new (нет в коде сейчас)


| Component                                                                          | Files (predicted)                                                                    | Notes                                                                                        |
| ---------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------ | -------------------------------------------------------------------------------------------- |
| Tier 0 Verdict bar                                                                 | new `assets/dashboard-verdict.js`                                                    | aggregates DSM into 1-sentence                                                               |
| Tier 3 Windows row (TIME-SENSITIVE chips)                                          | new `assets/dashboard-windows-row.js`                                                | Pre-emergent / PGR reapply / Overseed / Spray / Rain chips; spec в секции 8.5                |
| Tier 4 Conditions strip                                                            | new `assets/dashboard-conditions-strip.js`                                           | combines weather/wind/rain/dew + spray verdict reasons                                       |
| Tier 5 Evidence one-liner                                                          | refactor `gaip-evidence-ui.js` to compact mode                                       | data exists                                                                                  |
| ~~Stale data banner~~                                                              | —                                                                                    | убран — покрыто Data Confidence card                                                         |
| ~~Sensor offline banner~~                                                          | —                                                                                    | убран — покрыто Data Confidence card                                                         |
| ~~Onboarding incomplete banner~~                                                   | —                                                                                    | убран — покрыто Data Confidence card                                                         |
| Quick Capture FAB                                                                  | new `assets/quick-capture-fab.js` + sheet wrapper                                    | reuses `gaip-field-log.js` capture logic                                                     |
| Enriched Site Switcher dropdown                                                    | refactor `site-selector-ui.js` + reuse `gaip-morning-briefing.js` decision functions |                                                                                              |
| Mobile bottom tab bar                                                              | new `assets/mobile-nav.js`                                                           |                                                                                              |
| `/data/observations`, `/data/mowing-log`, `/data/site-notes`, `/data/photos` views | new shortcodes/pages                                                                 | data exists                                                                                  |
| `/events` page                                                                     | —                                                                                    | **Не строим**: движок есть, но страница не существует в текущей версии — вне scope редизайна |


### 9.6. REST API endpoints — текущие (use as-is)

- `/gilba/v1/spray-log` (CRUD + summary + context) — [class-gilba-spray-log.php:150-185](includes/class-gilba-spray-log.php)
- `/gilba/v1/benchmark/{site_id}` — [class-gilba-benchmark-chart.php:95](includes/class-gilba-benchmark-chart.php)
- `/gilba/v1/predictions`, `/predictions/pending/{site_id}`, `/calibration/{site_id}` — [class-gilba-prediction-logger.php:166-180](includes/class-gilba-prediction-logger.php)
- `/gilba/v1/outcomes`, `/outcomes/batch`, `/outcomes/history/{site_id}` — [class-gilba-prediction-logger.php:187-201](includes/class-gilba-prediction-logger.php)
- `/gilba/v1/alert-check`, `/alert-settings`, `/alert-test` — [class-gilba-alerts.php:188-209](includes/class-gilba-alerts.php)

### 9.7. AJAX handlers — текущие (use as-is)

35+ handlers подтверждены в коде:

- Site management: `gilba_save_location`, `gilba_geocode_search`, `gilba_reverse_geocode`, `gilba_sites_save/load`, `gilba_site_configs_save/load`
- Wizard: `gilba_wizard_complete`, `gilba_wizard_reset`
- AI interpretation: `gilba_interpret_soil`, `gilba_interpret_water`, `gilba_interpret_synthesis`
- Lab parsing: `gilba_parse_lab_report`
- Sensors: `gilba_hydrosight_proxy`, `gilba_specconnect_proxy`, `gilba_specconnect_save_key`, `gilba_sensor_load_credentials`, `gilba_sensor_save_credentials`, `gilba_sensor_save_mappings`, `gilba_hydrosight_test_connection`
- Branding: `gilba_logo_get/save/delete/select`
- Stadium variant: дублирование префиксом `gssh_`*
- Stadium core: `gssh_shade_analysis`, `gssh_shade_render`, `gssh_rig_calculate`, `gssh_seasonal_plan`, `gssh_get_stadium`, `gssh_save_custom_venue`, `gssh_delete_custom_venue`, `gssh_save_venue_profile`, `gssh_get_venue_profiles`, `gssh_track_effectiveness`

### 9.8. Backend domain классы (use as-is)

- `class-gilba-soil-interpretation.php` — soil chemistry rules per methodology
- `class-gilba-water-interpretation.php` — water chemistry interpretation
- `class-gilba-synthesis-interpretation.php` — soil+water+tissue synthesis
- `class-gilba-interpretation.php` — Claude AI bridge
- `class-gilba-lab-parser.php` — CSV/PDF lab report parsing
- `class-gilba-spray-log.php` — spray records CRUD + APVMA validation
- `class-gilba-apvma-sync.php` — APVMA permits sync
- `class-gilba-prediction-logger.php` — prediction tracking + accuracy
- `class-gilba-benchmark-chart.php` — historical benchmark
- `class-gilba-alerts.php` — SMS/email alerts
- `class-gssh-stadium-loader.php` + `includes/stadium/`* — Stadium sub-hub (full module: shade, RIG calculator, seasonal planner, venue profiles, effectiveness tracker)

### 9.9. Sanity check итог

- **План на 100% строится поверх существующих движков** — ни один engine/PHP class не переписывается, только presentation layer.
- **Phase 1 = чисто UI refactor** — переупаковка существующих DOM containers и render функций под Tier 0–5 layout.
- **Phase 2 = surface UI для уже существующих данных** (observations/mowing/notes/photos из IndexedDB + БД).
- **Phase 3 = пусто** — все потенциальные новые backend фичи убраны как «не существуют в текущей версии».

### 9.10. Известные расхождения plan vs текущий designer mockup

Проверено по двум присланным скриншотам dashboard mockup:

**Совпадает с планом:**

- Top bar (logo, status dot, context pills, Analysis timestamp, ↻ Re-run, Settings)
- ~~Stale data banner~~ — убран (покрыто Data Confidence card)
- Conditions strip (current temp + 3-day forecast + spray window)
- Vital Signs cards (Growth Potential 62%, Disease Risk High, Stress Index 21/100, Soil Moisture 25%)
- TIME-SENSITIVE WINDOWS chips (Spray, Rain)
- Data Confidence панель снизу
- Headline `Act on this today`

**Расходится с планом — TODAY action card перегружена дублированием:**

- ❌ В mockup TODAY card имеет: subtitle `35% / spray at 20%` + большой блок `CURRENT RISK 35% · 7-DAY FORECAST stable · spray above 20%` + ACT NOW/IF DELAYED two-pane + `IF YOU DELAY: 35% now → holding · spray cost doubles` line + 2 кнопки
- ✅ План (после упрощения): только title + 1-line reason + 1-line consequence + buttons. Всё детальное → side panel
- ❌ Mockup использует 3 секции (URGENT/MONITORING/WATCHING) вместо реальных DSM bucket'ов (TODAY/THIS WEEK/WATCHING) — план исправлен на real DSM labels
- ❌ Mockup использует phantom labels («Mark Complete», «Acknowledge») вместо реальных DSM «Commit — »

---

## 10. Side Panels — содержимое по карточке

**Общее правило:** все 5 Vital Signs карточек и все Action Queue items открывают side panel при tap/click. Side panel выезжает поверх дашборда (overlay), пользователь остаётся на дашборде. На mobile — full-screen bottom sheet, свайп вниз закрывает.

Side panel Action Queue items описан в секции 8.4. Ниже — side panels для 5 Vital Signs карточек.

---

### 10.1. Growth Potential — короткий side panel

**Источники данных:** `climate-module-v2.1-dual-metrics.js` — `daily[]` массив, `confidence[]`, c3/c4 breakdown.

```
[Growth Potential]                     [×]

62%  ↓ Forecast 55% in 8 days
Cool-Season · Thermal 26%

── 8-DAY OUTLOOK ──────────────────────
[line chart: GP по дням, confidence band]
День 1: 60% (conf 90%)
День 2: 59% (conf 85%)
...
День 8: 55% (conf 35%)

── BREAKDOWN ──────────────────────────
Thermal score:    26%
Day-length adj:   +24%
Variety adj:      +12%
Final GP:          62%

── ОСВЕЩЕНИЕ (DLI ⓘ) ──────────────────
☀️ 8.3 mol/m²/day ⓘ
↓ CRITICAL для Bentgrass (оптимум ≥ 18 ⓘ)

[→ Полный анализ роста и освещения]
```

**Что показывается:**

- 8-day GP trajectory chart с confidence bands (уверенность падает с 95% до 35% к дню 8 — данные из движка, UI не выводит)
- Ежедневный breakdown (день → %, confidence)
- DLI с видовой интерпретацией: текущее значение / порог для данного сорта / статус (critical/deficient/adequate/optimal). Источник: `ambient-dli-engine.js` — `ambientDLI.current` + `ambientDLI.status` + `ambientDLI.classification.deficit`. Объясняет световой вклад в итоговый GP (почему GP ниже чем ожидалось при данной температуре).
- Компонентный breakdown: Thermal / Day-length / Variety adjustment → Final GP (объясняет почему финальный GP отличается от Thermal)

**Ссылка:** `→ Полный анализ роста и освещения` — переход на `/analysis/growth-light`

---

### 10.2. Disease Risk — богатый side panel

**Источники данных:** `disease-engine-pure.js` — `result.diseases[]` (10 болезней), `drivers{}`, `tissueNutrients{}`, `forecast.diseases[]`.

```
[Disease Risk — Dollar Spot HIGH]      [×]

32% today → 78% in 5 days

── ВСЕ БОЛЕЗНИ ────────────────────────
Dollar Spot         32% → 78%  HIGH   🔴
Fusarium Patch      14% → 22%  LOW    🟢
Brown Patch          8%         LOW    🟢
Pythium              3%         LOW    🟢
...

── ЧТО ДВИЖЕТ РИСКОМ (Dollar Spot) ───
Температура:    +18%  contribution
Влажность RH:  +24%  contribution
Leaf wetness:  +22%  contribution
Азот (ткань):  +12%  contribution

── ТКАНЬ / СОРТ ───────────────────────
K дефицит → риск ×1.2
Penn A4 (bentgrass) → susceptibility 1.3×

── ДАННЫЕ МОДЕЛИ ──────────────────────
Smith-Kerns 2018 · Validated
Последние 14 дней RH/temp — достаточно

[→ Полный анализ болезней]
```

**Что показывается:**

- Ranking всех болезней по `adjustedRisk` (топ-болезни с `forecastPeak`): имя / текущий % / peak % / уровень
- Driver breakdown для топ-болезни: вклад каждого фактора (температура, RH, leaf wetness, азот) в %
- Tissue modifiers: какие питательные вещества имеют дефицит и как это умножает риск
- Variety susceptibility: сорт × susceptibility multiplier
- Confidence и validation badge модели (Validated / Beta)

**Ссылка:** `→ Полный анализ болезней` — переход на `/analysis/disease`. Обязательна: side panel показывает топ-3 болезни и driver breakdown топ-1, на `/analysis/disease` — все 10 болезней с полными деталями, per-disease trajectory charts, fungicide timing.

---

### 10.3. Stress Index — богатый side panel

**Источники данных:** `stress-trajectory-engine-pure.js` — `currentComponents{}`, `trajectory[]` (14 дней), `interventionWindows[]`, `compound{}`.

```
[Stress Index]                         [×]

19 /100  ↓ Decreasing — peak in 5 days
Driven by: Traffic 93%

── 6 ФАКТОРОВ СЕЙЧАС ──────────────────
Heat         12/100  [████░░░░░░]
Light         8/100  [███░░░░░░░]
Moisture     15/100  [████░░░░░░]
Traffic      93/100  [███████████████████]  ← primary
Nutrition    10/100  [███░░░░░░░]
Disease       5/100  [██░░░░░░░░]

── 14-ДНЕВНЫЙ ПРОГНОЗ ─────────────────
[sparkline: 14 дней, threshold bands]
Peak: день 5 — 34/100 (Caution)

── COMPOUND EFFECTS ───────────────────
Дни 3–5: Traffic + Heat → ×1.3 multiplier

── ОКНА ДЛЯ РАБОТ ─────────────────────
День 8–10: стресс < 20 → безопасно для
аэрации, топдрессинга, вертикуттинга

[→ Полный анализ стресса]
```

**Что показывается:**

- Multi-factor bars: все 6 компонентов с raw values 0–100 (сейчас на карточке не выводится)
- 14-day sparkline с `trajectory[].totalScore` и threshold bands (Normal/Caution/Warning/Critical)
- Compound effects — дни где комбинация факторов даёт multiplier > 1 (Heat+Drought ×1.5, Traffic+Wet ×1.6)
- Intervention windows — `interventionWindows[]` из движка: периоды 2+ дней ниже Caution threshold, когда безопасно делать аэрацию/топдрессинг

**Ссылка:** `→ Полный анализ стресса` — переход на `/analysis/stress`. Обязательна: side panel показывает текущий snapshot (6 факторов + 14-day sparkline), на `/analysis/stress` — event simulator, compound effects calendar, intervention windows, recovery projections.

---

### 10.4. Soil Moisture (VWC) — короткий side panel

**Источники данных:** `irrigation-scheduler.js` — `soilProps{}`, `waterBalance{}`, `schedule[]` (7 дней).

```
[Soil Moisture]                        [×]

13%  · Optimal zone

[range bar: полная ширина, все маркеры]
WP 6%  TRIG 12%  FC 15%  (USGA greens)

── WATER BALANCE (7 дней) ─────────────
ET₀ за неделю:      14.2 mm
Осадки (прогноз):    6.0 mm
Чистый дефицит:      8.2 mm

── ПАРАМЕТРЫ ПОЧВЫ ────────────────────
Тип:          USGA greens
AWC:          9% (FC − WP)
MAD:          50%
Источник:     Hydrosight · 3m ago

[→ Полный анализ воды и ирригации]
```

**Что показывается:**

- Расширенный range bar (тот же что на карточке, но шире — лучше читаемость)
- Water balance за 7 дней: ET, осадки, дефицит (из `waterBalance{}`)
- Soil parameters: тип почвы, AWC, MAD (контекст для понимания маркеров)
- Источник данных с freshness

**Ссылка:** `→ Полный анализ воды и ирригации` — переход на `/analysis/water`

---

### 10.5. Irrigation Plan — короткий side panel

**Источники данных:** `irrigation-scheduler.js` — `schedule[]` (7–14 дней), `summary{}`.

```
[Irrigation Plan]                      [×]

7 mm weekly requirement
↓ Ahead by 6mm — skip cycle

── РАСПИСАНИЕ НА 7 ДНЕЙ ───────────────
Пн  13 мая   0 mm  (осадки 6 mm)
Вт  14 мая   0 mm  (skip — ahead)
Ср  15 мая   3 mm
Чт  16 мая   0 mm
Пт  17 мая   0 mm  (осадки 6 mm)
Сб  18 мая   4 mm
Вс  19 мая   0 mm
─────────────────────────────
Итого:        7 mm / 7 mm need

── СТРАТЕГИЯ ──────────────────────────
Optimal · Kc 0.85 (Cool-Season)
ET₀ за неделю: 8.2 mm

[→ Полный анализ PGR и ирригации]
```

**Что показывается:**

- 7-дневный schedule: дата / мм ирригации / причина skip или apply (из `schedule[]`)
- Итого за неделю vs weekly need
- Активная стратегия (Optimal/Standard/Deficit) и Kc коэффициент

**Ссылка:** `→ Полный анализ PGR и ирригации` — переход на `/analysis/pgr-irrigation`

---

## 11. /analysis/ страницы — содержимое

**Принцип:** каждая страница показывает данные, которые движок уже считает, но дашборд не выводит. Новых вычислений не добавляем — только presentation layer поверх существующих engine outputs.

---

### 11.1. /analysis/disease

**Движок:** `disease-engine-pure.js` v3.0.1 — `GAIP_DISEASE_RESULT`, `GAIP_DISEASE_FORECAST`.

**Содержимое страницы:**

1. **Ranking всех болезней** — таблица: имя / текущий риск % / peak % / в N дней / уровень / confidence / validation badge (Validated/Beta). Данные: `result.diseases[]` отсортированные по `adjustedRisk`
2. **Driver breakdown топ-болезни** — stacked bars: вклад температуры, RH, leaf wetness, азота, тени, сорта. Данные: `drivers{}` каждой болезни
3. **7-day per-disease trajectory chart** — линейный график: ось X = дни, ось Y = риск %, отдельная линия для каждой из топ-3 болезней. Данные: `forecast.diseases[]`
4. **Tissue и variety modifiers** — таблица: питательный элемент / статус / модификатор риска (K дефицит → ×1.2 и т.д.). Данные: `tissueNutrients.modifiers{}`, `variety.modifiersApplied[]`
5. **Smith-Kerns inputs (последние 14 дней)** — таблица входных данных модели: RH / temp / leaf wetness. Данные: из climate-engine + sensor inputs
6. **Recommendations** — fungicide timing и cultural actions per болезни из `interventions{}` каждой болезни

---

### 11.2. /analysis/stress

**Движок:** `stress-trajectory-engine-pure.js` — `stressTrajectory{}`.

**Содержимое страницы:**

1. **14-day stress trajectory chart** — линейный график с threshold bands: Normal (<30) / Caution (30–60) / Warning (60–75) / Critical (>75). Данные: `trajectory[].totalScore` + `trajectory[].level`
2. **Component stacking** — stacked area chart: вклад каждого из 6 факторов (Heat, Light, Moisture, Traffic, Nutrition, Disease) по дням. Данные: `trajectory[].components`
3. **Compound effects** — highlight дней где `compound.multiplier > 1`: какие комбинации дают amplification и на сколько. Данные: `trajectory[].compound`
4. **Event simulator** — go/no-go для maintenance работ (аэрация, топдрессинг, вертикуттинг): выбрать дату → показать projected stress vs baseline + recovery period. Данные: `trajectory[]` с event simulation (логика в движке уже есть)
5. **Intervention windows** — calendar view: `interventionWindows[]` подсвечены как безопасные окна для работ
6. **Recovery projections** — когда каждый фактор пойдёт вниз и что станет primary stressor дальше

---

### 11.3. /analysis/growth-light

**Движок:** `climate-module-v2.1-dual-metrics.js` + `climate-engine-v2.js`.

**Содержимое страницы:**

1. **14-day GP trajectory** — линейный график с confidence bands (уверенность по дням из `daily[].confidence`). C3 и C4 линии отдельно для mixed stands
2. **GDD accumulation** — накопленные growing degree days (база 10°C) — контекст для сезонных решений
3. **Component breakdown по дням** — таблица: дата / temp / Thermal GP / Day-length adj / Variety adj / Final GP
4. **Species-specific thresholds** — optimal temp range для текущего сорта, текущее положение на кривой

---

### 11.4. /analysis/water

**Движок:** `irrigation-scheduler.js` v1.4.0.

**Содержимое страницы:**

1. **14-day water balance chart** — комбинированный график: VWC линия + threshold lines (WP/TRIG/FC) + irrigation events (вертикальные маркеры) + precipitation (столбики). Данные: `schedule[].vwcForecast`, `schedule[].precipitation`, `schedule[].irrigation`
2. **Daily breakdown таблица** — дата / ET₀ / ETc / осадки / ирригация / VWC / статус. Данные: `schedule[]`
3. **Soil profile** — визуализация WP/TRIG/FC с текущим VWC (аналог range bar на карточке, но вертикальный tank-стиль)
4. **Water balance summary** — итого ET/осадки/ирригация за 7 и 14 дней. Данные: `summary{}`
5. **Leaching requirement** — если есть данные по EC воды: leaching fraction и дополнительные мм. Данные: `leachingRequirement{}`

---

### 11.5. /analysis/pgr-irrigation

**Движок:** `gilba-pgr-module-v3.js` + `gaip-decision-engine.js` PGR секция.

**Содержимое страницы:**

1. **Growth suppression forecast** — 14-day прогноз высоты роста под текущим PGR режимом
2. **DMI breakdown** — Demand / Moisture / Intensity компоненты и как они влияют на efficacy
3. **Reapplication timing** — countdown до следующего окна (GDD-based), с `daysRemaining` из decision-engine
4. **Irrigation + PGR timing** — рекомендации по последовательности (ирригация до/после PGR для uptake)
5. **История применений** — предыдущие PGR apps из spray log с actual suppression outcomes

---

### 11.6. /analysis/preemergent

**Движок:** `pre-emergent-engine.js` v1.1.0.

**Содержимое страницы:**

1. **Per-species alert table** — все сорняки в базе: имя / germination threshold / текущая soil temp / статус (GREEN/AMBER/RED_EARLY/RED_MISSED) / дней до threshold
2. **GDD accumulation** — накопленные GDD (база 10°C) как подтверждение температурных триггеров
3. **Soil temperature forecast** — 14-day soil temp прогноз с threshold lines для каждой активной болезни
4. **Application windows** — когда применять (apply-at temperature = threshold − 3–5°C) с `applicationWindowOpen` flag

---

### 11.7. /analysis/soil-nutrition

**Движок:** `hub-tissue-v3.js` + `tissue-corrective-engine-pure.js` + `gilba-soil-interpretation.js`.

**Содержимое страницы:**

1. **Tissue test results** — таблица по нутриентам (N, P, K, Ca, Mg, S, микро): значение / оптимальный диапазон / статус (дефицит/норма/избыток/фитотоксичность)
2. **MLSN refill calculator** — drawdown расчёты: как быстро нутриент расходуется + рекомендация дозы
3. **Corrective actions** — product recommendations per нутриент с нормой внесения (AU продуктовая база)
4. **pH tolerance** — текущий pH vs optimal range для сорта
5. **Composite disease modifier** — как текущий nutrient status влияет на disease risk (связь с disease panel)

---

### 11.8. /analysis/accuracy

**Движок:** `engine-confidence.js` + `confidence-ui-integration.js`.

**Содержимое страницы:**

1. **Per-engine confidence scores** — таблица: движок / confidence score / источник данных / что снижает уверенность
2. **Data completeness** — какие данные есть/отсутствуют и как их наличие улучшит confidence
3. **Validation status** — какие модели Validated vs Beta (disease engine имеет оба типа)
4. **Data source audit trail** — откуда взялись входные данные каждого движка

**⚠ Новую логику агрегации confidence НЕ строим.** Страница показывает существующие confidence scores из `engine-confidence.js` без новых вычислений. Агрегированный "overall accuracy" индекс — phantom, его нет в коде.

---

### 11.9. /analysis/nutrition-program — Annual Nutrition Plan

**Движок:** `nutrition-calendar.js` + GP из `climate-module-v2.1-dual-metrics.js` + P/K/Ca/Mg ratios из `hub-tissue-v3.js`.

**Особенность:** единственная /analysis/ страница с собственным Generate — пользователь вводит параметры и нажимает кнопку. Это инструмент планирования, не чистая диагностика. Живёт в /analysis/ как отдельный labeled nav item (не в /plan) потому что требует пользовательского ввода как отправную точку.

**Содержимое страницы:**

1. **Форма** — Annual N target (кг/га), Max N per application, Distribution method (GP-Weighted / Even / Front-loaded), Clipping management. Кнопка Generate Nutrition Program
2. **12-месячный calendar** — N/P/K/Ca/Mg по месяцам, распределённые по GP-кривой. Данные: `nutrition-calendar.js` после Generate
3. **Summary totals** — итого за год по каждому нутриенту
4. **Seasonal N plan** — автоматически если есть N diagnostics из soil test (`generateSeasonalNPlan()` [hub-tissue-v3.js:4494](assets/hub-tissue-v3.js)). Иначе: prompt `→ Upload soil test`
5. **Кнопка экспорта** — Word/PDF

Ссылка: `→ View nutrition schedule in Planning` ведёт на `/plan` (секция Nutrition Program).

---

## 12. /plan — Unified Planning Page

**Принцип:** пользователь думает категориями «что мне нужно сделать и когда», не «из какого движка это пришло». `/plan` агрегирует все schedule-outputs в одном месте независимо от источника данных. `/analysis/`* страницы остаются диагностикой (что происходит и почему) и содержат ссылки `→ View in Planning` для своих planning-outputs.

**Архитектура:** presentation layer поверх уже существующих движков. Новых вычислений нет.

**UX-правило для пустых состояний:** каждая секция которая не может заполниться показывает **конкретный actionable inline prompt** — не просто сообщение об ошибке, а точное объяснение что нужно сделать и прямую ссылку куда идти. Формат:

```
┌─────────────────────────────────────────────────────┐
│  [иконка]  [Название секции]                        │
│                                                     │
│  Чтобы сформировать этот план, нужно:               │
│  • [конкретный шаг 1]  [→ ссылка]                   │
│  • [конкретный шаг 2]  [→ ссылка]  (если есть)      │
│                                                     │
│  После этого план сформируется автоматически /      │
│  нажмите Generate.                                  │
└─────────────────────────────────────────────────────┘
```

Принцип: пользователь не должен догадываться. Каждый пункт — одно действие с прямой ссылкой.

---

### 12.1. Nutrition Program

**Движок:** `nutrition-calendar.js` + GP из `climate-module-v2.1-dual-metrics.js` + P/K/Ca/Mg ratios из `hub-tissue-v3.js`.

**Как работает:** пользователь вводит параметры → нажимает «Generate» → движок распределяет N по месяцам по GP-кривой и рассчитывает остальные нутриенты.

**User inputs (обязательные):**

- Annual N target (кг/га) — `gaip-nutrition-annual-n` input
- Max N per application (кг/га/мес) — `gaip-nutrition-max-n` input

**User inputs (опциональные):**

- Distribution method: GP-Weighted (рекомендуется) / Even / Front-loaded — `gaip-nutrition-distribution` select
- Clipping management: Auto / Collected / Returned — `gaip-nutrition-clipping` select

**Что нужно чтобы секция заполнилась:** пользователь вводит Annual N target и нажимает Generate. GP данные уже посчитаны orchestrator'ом.

**Вывод:** 12-месячный calendar с N/P/K/Ca/Mg по месяцам + summary totals. Кнопка экспорта.

**UI prompt (форма видна сразу, не скрыта за empty state):**

```
📅  Nutrition Program

Чтобы сформировать годовой план внесений, введите:
•  Annual N target (кг/га)  [____]  Типично: Greens 80–150 · Tees 120–180 · Sports 180–350
•  Max N per application    [____]  Ограничение за один приём

[Generate Nutrition Program]

Распределение по месяцам рассчитается автоматически
на основе Growth Potential вашего сайта.
```

---

### 12.2. Seasonal N Plan

**Движок:** `generateSeasonalNPlan()` ([hub-tissue-v3.js:4494](assets/hub-tissue-v3.js)) — автоматически вычисляется, отдельной кнопки Generate нет.

**Что нужно чтобы секция заполнилась:** N diagnostics данные должны быть настроены — конкретно `o.baseOptimum` и `o.opt` из nitrogen diagnostics (`Nopt` = optimal N level из MLSN расчётов, `baseOptimum` = research baseline). Эти данные появляются когда загружен soil test с N данными и выполнен MLSN расчёт.

**Вывод:** сезонный N план по кварталам/месяцам с учётом c3/c4 фракции и hemisphere (южное/северное). Дополняет Nutrition Program — там годовой target, здесь сезонная диагностика.

**UI prompt (показывается вместо пустой секции):**

```
🧪  Seasonal N Plan

Для формирования сезонного плана нужны данные почвенного теста.

Чтобы включить этот раздел:
•  Загрузите результаты анализа почвы  [→ Soil Tests]

После загрузки план сформируется автоматически.
```

---

### 12.3. Recovery Calendar

**Движок:** `generateRecoveryCalendar()` ([hub-tissue-v3.js:4665](assets/hub-tissue-v3.js)) — автоматически вычисляется.

**Что нужно чтобы секция заполнилась:** данные о нагрузке на поле — matches per week, sessions per week, rest days. Поля уже существуют в DOM (`gaip-matches-week`, `gaip-sessions-week`). Дополнительно улучшают (не блокируют): variety, soil OM из LOI теста.

**Где вводить:** `/settings/profile` (turf profile) — поля уже там.

**Вывод:** календарь окон для аэрации, topdressing, вертикуттинга с учётом GP + variety + soil OM.

**UI prompt (показывается вместо пустой секции):**

```
🗓  Recovery Calendar

Для расчёта окон обслуживания нужны данные о нагрузке на поле.

Чтобы включить этот раздел:
•  Укажите количество матчей и тренировок в неделю  [→ Site Profile]

Дополнительно улучшат расчёт (не обязательно):
•  LOI / OM тест почвы  [→ LOI Tests]

После заполнения календарь сформируется автоматически.
```

---

### 12.4. PGR Reapplication Schedule

**Движок:** `gilba-pgr-module-v3.js` + `gaip-decision-engine.js` — вычисляется в `computeAll()`.

**Что нужно чтобы секция заполнилась:** в Spray Log должна быть записана предыдущая PGR аппликация (дата + продукт). GDD накапливаются автоматически.

**Вывод:** countdown до следующего окна (`daysRemaining`), GDD accumulated vs threshold, suppression % forecast.

**UI prompt (показывается вместо пустой секции):**

```
💊  PGR Schedule

Для расчёта расписания реаппликации нужна история применений.

Чтобы включить этот раздел:
•  Запишите последнее применение PGR в журнал опрыскивания  [→ Spray Log]

После записи расписание сформируется автоматически
на основе накопленных GDD.
```

---

### 12.5. Pre-emergent Timing

**Движок:** `pre-emergent-engine.js` v1.1.0 — вычисляется в `computeAll()`.

**Что нужно чтобы секция заполнилась:** ничего — soil temperature всегда доступна (от сенсора или estimated из air temp). Секция всегда заполнена.

**Вывод:** per-species timeline с датами применения по soil temp threshold. Всегда отображается.

**UI prompt:** не нужен — секция всегда активна.

---

### 12.6. Связь /plan с /analysis/* страницами

Каждая `/analysis/`* страница, которая производит planning output, содержит ссылку:


| Analysis страница          | Planning output                    | Ссылка                                  |
| -------------------------- | ---------------------------------- | --------------------------------------- |
| `/analysis/soil-nutrition` | Nutrition Program, Seasonal N plan | `→ View nutrition schedule in Planning` |
| `/analysis/stress`         | Recovery calendar                  | `→ View recovery windows in Planning`   |
| `/analysis/pgr-irrigation` | PGR reapplication                  | `→ View PGR schedule in Planning`       |
| `/analysis/preemergent`    | Pre-emergent timing                | `→ View timing schedule in Planning`    |


Принцип: `/analysis/`* объясняет **почему**, `/plan` показывает **когда и что делать**.

**Решение:** план = эталон. Mockup нужно упростить TODAY action card до minimal decision-first (4 строки) и перенести fork/trajectory детали в side panel drill-down.
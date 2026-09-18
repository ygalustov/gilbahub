# Стадия 3 — рабочий лист исполнителя

Разбор, не реализация. Написан 18.09.2026 по заданию координатора, тем же порядком, что сработал на
стадии 2: разбор → сжатие → реализация по этому файлу.

Источник решений — `PLAN-samples-sync-FINAL.md`, разделы «Стадия 3», 5 (состояние ошибки) и 6
(потребители копии). **Новых решений здесь нет**, только адреса, порядок, неразрывности и расхождения
плана с деревом.

**Адреса даны ЯКОРЯМИ.** Все 19 проверены обходом дерева: каждый находится ровно в одном файле и
встречается в нём один раз. Номера строк — подсказка на 18.09, устареют от первой же правки.

**Правило о дате плана применено.** План написан 10.09.2026; между этой датой и сегодня приняты
GH-430…GH-535. Сверка с changelog дала четыре расхождения, они в разделе 8.

---

## 0. Что эта стадия делает одним предложением

Браузер перестаёт хранить копию проб, и место, где он молча подменял ею серверный ответ, становится
видимой ошибкой с кнопкой Retry.

---

## 1. ПОЧЕМУ ВЛАДЕЛЕЦ ВЫБРАЛА ЭТУ СТАДИЮ — механизм потери, по коду

Три шага, каждый проверен чтением:

1. `fetchSamplesFromServer()` зовёт `onComplete(false)` в трёх случаях: нет базы/`fetch`, список пуст,
   запрос упал. **Пустой аккаунт и упавший запрос неразличимы.**
2. `restore()` на `onComplete(false)` идёт в `restoreFromLocalFallback()` — стор наполняется из
   `localStorage`. Пробы оттуда **не имеют `serverId`**: его кладёт только серверное восстановление
   (стадия 2, якорь `serverId: sample.id`).
3. Пользователь правит такую пробу. `writeUpdate()` доходит до `if (!sample.serverId)` и выходит в
   `warn('No serverId for … — update not sent')`. То же в `writeDelete()`, там `log`.

**Итог: правка не уходит на сервер, на экране всё в порядке, в консоли строка.** Это и есть «клиент
теряет свою работу и не узнаёт об этом».

Четвёртый шаг того же класса, найден при разборе и в задании не назван: запрос идёт с
`samples?limit=200`, а `meta: {total, returned}` (стадия 1, GH-526) **не читается вовсе**. Аккаунт с
201 пробой молча получит 200. На стенде 148, поэтому сегодня не срабатывает.

---

## 2. НЕРАЗРЫВНОСТИ

### Н1. «Снос `restoreFromLocalFallback()`» ⟷ «состояние ошибки»
Снести фолбэк и не поставить баннер — значит заменить тихую подмену тихой пустотой: стор пуст, экран
показывает empty state, пользователь думает, что проб нет, и заводит их заново.
**Если развести:** между шагами продукт хуже, чем был.

### Н2. «`setReadOnly(true)`» ⟷ «баннер с Retry»
Блокировка без видимой причины — это форма, которая молча не делает ничего: `addSample` бросает, UI
показывает исключение или ничего.
**Если развести:** тот же класс, с другой стороны.

### Н3. «Снос `CONFIG.keys.samples` в `hub-persistence.js`» ⟷ «вывод блока из-под `if (samples)`»
Якорь `const samples = safeJsonParse(storageGet(CONFIG.keys.samples));` — под этим `if` лежит
установка активной площадки и разбор `gilba_import_active_site`. Убрать ключ, не подняв блок, —
значит на пути `/hub` активная площадка перестанет выставляться совсем.
**Если развести:** молчаливая регрессия на iframe расчёта.

---

## 3. СЕРВЕР

**Ничего.** Стадия 3 целиком клиентская. `meta` уже отдаётся (`index()`, GH-526), `limit` до 2000.

---

## 4. КЛИЕНТ — `assets/sample-persistence.js`

### 4.1 УДАЛЯЕТСЯ

| якорь | что это |
|---|---|
| `StorageAdapter.load(CONFIG.storageKey)` | единственная точка чтения копии |
| `function restoreFromLocalFallback() {` | сам фолбэк |
| `var StorageAdapter = {` | адаптер целиком (**см. ловушку в 9.1**) |
| `storageKey: 'gilba_samples',` | ключ в `CONFIG` |
| `beforeunload` в `bindEvents()` | последняя запись копии |
| публичные `clear` / `getStorageSize` / `getStorageSizeFormatted` / `StorageAdapter` | доступ наружу |
| два `_ls.setItem(CONFIG.storageKey, …)` внутри `fetchSamplesFromServer` и `fetchSiteListFromServer` | запись после восстановления |

### 4.2 ПОЯВЛЯЕТСЯ

**`finishReady` получает `source`.** Якорь `function finishReady(detail) {`. Три значения:
`'server'`, `'empty'`, `'error'`. `_gaipSamplePersistenceReady = true` ставится **во всех трёх** —
иначе `turf-profile-controller.js` (якорь `if (window._gaipSamplePersistenceReady) {`) не переключит
площадку никогда.

**`fetchSamplesFromServer` различает пустоту и отказ.** Якорь `'samples?limit=200')`. Сейчас
`onComplete(false)` для обоих. Нужно: три исхода, и `meta.returned < meta.total` — тоже отказ,
частичный, со своим текстом.

**Баннер.** Образец — `NutritionCalendar._renderStaleProgramBanner` (якорь
`NutritionCalendar._renderStaleProgramBanner = function(title, body) {`), классы `.db-*`, SVG-иконка.
Тексты из раздела 5 плана, дословно. Retry зовёт `GAIP_SamplePersistence.restore()`.

### 4.3 Маркер записи и Retry — второе место из задания

Сегодня `sample._dirty` пишется в `markFailed()` и **не читается никем**; событие
`gaip:samples-persistence-error` имеет одного слушателя — `settings-unavailable-banner.js`, — и тот
пропускает всё, кроме `reason: 'sites-list'`. Проверено обходом.

Появляется: маркер в строке switcher, Retry на запись, тексты для 403 и 419 из раздела 5 плана.
Место — `sample-switcher-ui.js`, рядом с `updateQuickButtons`.

---

## 5. КЛИЕНТ — остальные потребители копии

| файл | якорь | правка |
|---|---|---|
| `hub-persistence.js` | `samples: 'gilba_hub_samples' + suffix,` | ключ убрать |
| `hub-persistence.js` | `function collectSamples() {` / `function restoreSamples(samples) {` | обе функции и их вызовы |
| `hub-persistence.js` | `const samples = safeJsonParse(storageGet(CONFIG.keys.samples));` | **Н3** — блок поднять |
| `dashboard-ui.js` | `var _lsRaw = localStorage.getItem('gilba_samples');` | штамп перед iframe; `gilba_wb_water_override` ниже **остаётся** |
| `settings-init.js` | `try { _snap = JSON.parse(localStorage.getItem('gilba_samples') \|\| '{}'); } catch (_e) {}` | очистка копии перед импортом |
| `gaip-field-log.js` | `_injectIntoStorage: function (serverSites) {`, `_fromStorage: function () {`, `setActive:` | записи и fallback-чтения SiteLoader |
| `sample-manager.js` | `(function _fixBrentfordFcLabel() {` | b35fix268, разовая правка ярлыка |
| `gilba-storage-migrate.js` | `var SAMPLES_BASE = 'gilba_hub_samples';` | плюс `'gilba_samples'` из двух списков |
| `sample-manager.js` | `storageKey: 'gilba_samples'` в `CONFIG` | мёртвый ключ |

**`values`-алиас (обещан стадией 2).** Читается в четырёх местах: `sample-persistence.js` (в
`buildPayload`), `sample-manager.js` × 2 (якоря `const _sampleData = sample.rawData || sample.values || {};`
и `const row = sample.rawData || sample.values || null;`), `hub-persistence.js` × 2, плюс
`nutrition-summary-integration.js`. **НЕ путать** с `sampleData.values` в `addSample` — это входной
параметр вызывающего, другая вещь, остаётся.

**Не трогать** (правило проекта / проверено): `site-data-transfer.js`, `gaip-morning-briefing.js`,
`water-balance-analysis.js` (там только комментарий), `site-dashboard.js` (**свой** `StorageAdapter`,
см. 9.1).

---

## 6. ПОРЯДОК ВНУТРИ СДАЧИ

1. **`finishReady` + три исхода + чтение `meta`** — фолбэк ещё жив, поведение не меняется.
2. **Баннер, `setReadOnly`, Retry** — видимая ошибка появляется раньше, чем исчезает тихая подмена.
3. **Снос `restoreFromLocalFallback` и `StorageAdapter`** — **неразрывно с шагом 2 (Н1, Н2)**.
4. **Остальные потребители** (раздел 5), по одному файлу, между ними останавливаться можно.
5. **Блок `hub-persistence`** — ключ и подъём блока одним движением (Н3).
6. **`values`-алиас** — последним, когда никто больше не пишет копию.
7. Тесты, живой прогон, приёмка.

**Шаги 2+3 — единственный неразрывный участок.**

---

## 7. ЧЕМ ПРОВЕРЯЕТСЯ

- **Jest:** `fetch` reject → стор пуст, `source:'error'`, `addSample` бросает, флаг готовности всё
  равно `true`; `[]` + `total 0` → `source:'empty'`, стор разблокирован; `returned < total` →
  `source:'error'` с текстом про частичную загрузку; source-pin — `gilba_samples` отсутствует в шести
  названных файлах, `gilba_hub_samples` и `keys.samples` — в `hub-persistence.js`.
- **PHPUnit:** обязателен по правилу приёмки, хотя стадия клиентская.
- **Живой прогон:** площадку, пробу и ожидание назвать ДО; снимок стенда до и после. Запрет на
  четырнадцать незащищённых живых тестов в силе; новый файл обязан нести средство (GH-532).

---

## 8. РАСХОЖДЕНИЯ ПЛАНА С ДЕРЕВОМ — правило о дате применено

1. **`site-config-persistence.js:1492-1503`** (force-save снимка перед reload) — **в дереве нет.**
   Слова `samples` в файле встречаются дважды, оба в комментариях. Пункт исполнять нечем.
2. **`recoverSitesFromLegacyConfig()`** — снесена GH-441, на её месте комментарий. Пункт закрыт.
3. **Номера строк плана для `sample-persistence.js` недействительны целиком** — файл переписан
   стадией 2 (GH-533). Работать только якорями.
4. **`dashboard-ui.js:74-88`** — вердикт плана «удалить безопасно» **подтверждён замером**:
   переключатель площадок делает `PATCH /api/active-site` и перезагружает страницу
   (`dashboard-ui.js:36`), а `layouts/app.blade.php:32` кладёт `activeSiteId` в `GAIP_HUB_CONFIG`
   из серверного `$activeSite`. Штамп избыточен.

---

## 9. ЛОВУШКИ, НАЙДЕННЫЕ ПРИ РАЗБОРЕ

### 9.1. Два `StorageAdapter` в дереве
`assets/site-dashboard.js:73` и `assets/sample-persistence.js:185`. Удаление «по имени» попадёт не в
тот файл. Однозначный якорь — `StorageAdapter.load(CONFIG.storageKey)`, он только в одном.

### 9.2. Блокировка должна включаться восстановлением, а не быть значением по умолчанию
`morning-briefing.blade.php` и `stadium.blade.php` грузят `sample-manager.js` **без**
`sample-persistence.js`. Если `setReadOnly` по умолчанию `true` и снимается только успешным
восстановлением, обе страницы окажутся заблокированы навсегда. Замок ставит восстановление, когда
оно провалилось, — не наоборот.

### 9.3. `/hub` грузит оба модуля
`hub.blade.php:199-200`. Значит iframe расчёта восстанавливается с сервера и копия ему не нужна.
Проверено, потому что без этого снос копии выглядит рискованным для Re-run.

### 9.4. `isRestoring` — не наш
В перечне вызовов (`gh471`) он есть, но принадлежит `GAIP_SiteConfig`
(`site-config-persistence.js:1186`), не SampleManager. При чтении списка легко принять за наш.

---

## 10. ЧЕГО Я НЕ ПРОВЕРИЛ ПРИ РАЗБОРЕ

Названо, чтобы следующий заход не принял это за проверенное:

- **тела `collectInputState` / `cacheAnalysisResults`** в `hub-persistence.js` — трогает ли снос
  ключа проб их, я не смотрел;
- **что именно рисует switcher для строки пробы** — место под маркер я назвал по соседству с
  `updateQuickButtons`, разметку не разбирал;
- **поведение `/field-log`** после сноса `_fromStorage()`: список площадок он берёт с `/api/sites`,
  но какой путь сработает при отказе этого запроса — не прослеживал;
- **сколько ещё страниц** грузят `sample-persistence.js` помимо найденных пяти — считал по
  `app/resources/views`, вне этой папки не искал;
- **`stadium.blade.php`** — что там вообще делает SampleManager без восстановления, не разбирал.

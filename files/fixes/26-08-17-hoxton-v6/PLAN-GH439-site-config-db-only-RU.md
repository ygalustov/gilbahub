# PLAN — Конфигурация сайта: база данных — единственный источник; браузерная копия не пишется обратно

Продолжение `GH-439-config-reset-analysis-RU.md` (там — воспроизведения и разбор причин; здесь — только что делать).
Написан 15.09.2026 по рабочему дереву и dev-базе на эту дату. Код не менялся, git не трогался, база не изменялась.
Единственное созданное — этот файл; тест `tests/e2e/gh439-config-reset-live.test.js` остался от анализа и здесь только расширяется.

**Обновлено 16.09.2026 по решениям владельца** (раздел 7, все девять приняты; решения 3 и 4 изменены против первоначальной
рекомендации): таймзона выводится из координат на сервере, поле в Settings — ручное переопределение (новый раздел 2.5);
стадия 4 — только отчёт, автоматической правки строк нет (раздел 6). Попутно исправлены две неточности первой редакции:
ожидание по H1 после стадии 0 (стадия 0) и инжект `GAIP_WIZARD_CONFIG` на Reports-страницах (стадия 2); обе — из
`PLAN-GH439-minimal-guard-RU.md`, раздел 13.

**Обновлено 16.09.2026, второй раз, после сдачи стадий 0–2.** Замер разработчика и ревьюера (changelog GH-441, «Measured and
reported rather than changed»): на `/reports/export` оверлей мастера не появляется и без записи `wizard` в базе, потому что
`site-setup-wizard.js` гасится ключом `gilba_turf_profiles` в `localStorage`, а тот есть в любом браузере, открывавшем
hub-страницу, и один на все сайты. Раздел 6 переписан вокруг того, что запись `wizard` даёт на самом деле; стадия 4 разделена
на 4a и 4b.

**Обновлено 16.09.2026, третий раз — решение владельца по стадии 4.** Ремонт `wizard` и таймзоны делается автоматически,
командой, внутри последовательности стадий; владелец между этапами ничего не правит. Имена-идентификаторы и лишние сайты —
только отчёт. Отчёт печатается всегда как запись «что поменяли, до и после, построчно». Порядок: стадия 3 → 4a (ремонт) → 4b
(мастер решает только по базе). Правило, отличающее подпись дефекта от осознанно выставленной зоны, — раздел 6, оно и есть
ядро 4a. Исходные данные — `GH-439-baseline-dev-2026-09-16-RU.md`.

**Обновлено 16.09.2026, четвёртый раз — правило замеров.** Сценарий S2 стадии 2 был описан здесь только с семисекундной
задержкой `GET /api/sites` и оказался зелёным за счёт задержки: на обычной загрузке записи есть. Дефект замера был заложен в
план. Теперь каждый сценарий с искусственным условием (задержка ответа, подменённый 500, чистый контекст браузера,
подложенный `localStorage`) идёт **двумя прогонами** — обычная загрузка и прогон с условием — и каждый прогон даёт свою
цифру; условие называется рядом с цифрой и в отчёте. Правило записано в разделе 8, сценарии переписаны в стадиях 0, 2, 4b
и в разделе 8.

**Обновлено 16.09.2026, пятый раз — поправка разработчика по замеру 4b; ревью идёт, пометка «проверяемое».** `site-setup-wizard.js`
не инициализируется на страницах с `.db-shell` (`initWhenReady()`, `:1487-1488`: `if (document.querySelector('.db-shell')) return;`).
Reports-страницы расширяют `layouts.db-shell`, поэтому там оверлей мастера не может появиться ни при каком состоянии базы
и `localStorage`; замер стадии 2 на `/reports/export` не видел оверлея по этой причине, а гейт по профилям TPC действует
только там, где скрипт инициализируется — на `/hub`. Следствия: инжект `GAIP_WIZARD_CONFIG` на db-shell-страницы (GH-441)
мастер не кормит и дефекта мастера на Reports не закрывал, потому что его там нет; 4b меняет поведение только `/hub`;
S5/S5b переносятся на `/hub`. По коду подтверждено чтением (строки выше, набор views, грузящих скрипт); расхождение с
формулировкой разработчика по набору страниц — в стадии 4b. Источник исходной ошибки — добавление 16.09 в стадию 2 из
`PLAN-GH439-minimal-guard-RU.md`, раздел 13: там я приняла загрузку скрипта за его работу.

Область: **только конфигурация сайта** (`site_configs.namespace = 'gaip'`, поля `sites.name/latitude/longitude/timezone/location_name`
и легаси-регистр сайтов). Пробы — `PLAN-samples-sync-FINAL.md`, не пересекаемся, кроме одного явно отмеченного места
(stamp `gilba_samples.currentSite` в `dashboard-ui.js` — там item 6). Namespace `gssh` (стадион) не трогается — см. решение 7.

Номера тикетов: анализ — GH-439; стадии здесь — GH-439a…GH-439e (следующие свободные после GH-438 в changelog). Разработчик
проставляет по факту.

---

## 0. Целевое состояние, одним абзацем

Конфигурация сайта живёт в `site_configs` и нигде больше. Страница читает её с сервера (инжект в blade или `GET /api/sites`)
и держит **в памяти страницы** ровно столько, сколько нужно для рендера; на сервер уходит **только изменение** — одна секция
или одно поле, которое пользователь (или расчёт программы питания) только что поменял, — через один маршрут
`PATCH /api/sites/{id}/config/gaip`. Ни один код не строит объект конфигурации из DOM, из `localStorage` или из копии,
загруженной вместе со страницей, и не отправляет его целиком. Ключ `gilba_hub_site_configs` в `localStorage` исчезает;
`POST /api/sites/sync` исчезает; `PUT …/config/gaip` исчезает. Имя сайта пишется одним местом — `PATCH /api/sites/{id}`
из Settings/Account.

Два места, где копия в памяти действительно нужна (и почему это не «тот же механизм под новым именем»), — раздел 4.

---

## 1. Ответ на отдельный вопрос: гвард + четыре точечные правки — отдельная стадия или поглощаются?

**Поглощаются, но не исчезают: гвард и есть стадия 0.** Когда работу делает один разработчик целиком, четыре точечные правки
из анализа не выполняются отдельно — каждая совпадает с частью стадии:

| Точечная правка из анализа | Куда вошла |
|---|---|
| Серверный гвард в `updateConfig()` | Стадия 0 целиком (она и есть гвард + новый PATCH-маршрут) |
| `syncRegistry()` не принимает ID как имя, не создаёт сайты | Стадия 0 (серверная половина), стадия 2 (клиент перестаёт звать) |
| `pushConfigsToServer()` только активный сайт, только после pull | Не делается: в стадии 2 функция удаляется целиком |
| Plan/Settings шлют патч, не копию | Стадия 1 |

Почему стадия 0 всё равно ставится первой и одна: она единственная закрывает кровотечение (H1 — потеря `wizard`, E — имя → ID)
без единой правки клиента, ставится за день-два и не откатывается стадиями 1–3 — новый PATCH-маршрут из стадии 0 и есть
тот, на который потом переезжают писатели. Одна работа, не две: стадия 0 — первый коммит этой работы, а не отдельный проект.

Что стадия 0 **не** закрывает (честно): сценарий B (старая вкладка Plan шлёт `turf.methodology = slan`) — это непустое
значение, сервер не отличит его от намеренного. B закрывает стадия 1.

---

## 2. Контракт API после всей работы

### 2.1. `PATCH /api/sites/{site}/config/gaip` — единственный способ изменить конфиг

Права: `canEditSite`. Тело:

```json
{
  "patch": {
    "turf":      { "species": "Perennial Ryegrass", "methodology": "ammonium_acetate" },
    "location":  { "name": "Auckland, New Zealand", "lat": -36.8508827, "lon": 174.7644881 },
    "pgr":       { "enabled": true, "gddThreshold": 250 },
    "traffic":   { "schedule": { } },
    "irrigation": { }, "weatherOverride": { }, "wizard": { "complete": true },
    "alertContacts": [ ], "alertQuietHours": true, "multiSiteTurf": false,
    "appliedMonthlyN": 12, "maxNPerMonth": 30, "nzDistributor": "prebble",
    "nutritionCalendarProgram": { }, "nutritionProgram": { }, "nutritionProgramCoords": { "lat": 0, "lon": 0 }
  },
  "clear": [ "pgr", "turf.companionSpecies" ]
}
```

Правила, без вариантов:

1. **Белый список верхнеуровневых ключей** — ровно перечисленные выше (`turf`, `location`, `pgr`, `traffic`, `irrigation`,
   `weatherOverride`, `wizard`, `alertContacts`, `alertQuietHours`, `multiSiteTurf`, `appliedMonthlyN`, `maxNPerMonth`,
   `nzDistributor`, `nutritionCalendarProgram`, `nutritionProgram`, `nutritionProgramCoords`). Любой другой ключ → 422
   с именем ключа. `savedAt` клиент не присылает — сервер ставит сам.
2. **Слияние на один уровень**: для объектных секций (`turf`, `location`, `pgr`, `traffic`, `irrigation`, `weatherOverride`,
   `wizard`) поля из `patch` перекрывают поля в базе **по одному**, остальные поля секции остаются. Скаляры, массивы и три
   программных ключа заменяются целиком.
3. **Отсутствующий ключ — не тронут.** Патч `{ "turf": { "hoc": 12 } }` меняет только `turf.hoc`.
4. **`null` внутри `patch` → 422.** Очистка только через `clear`: элемент — имя секции (`"pgr"`) или `секция.поле`
   (`"turf.companionSpecies"`). `clear` не может содержать `turf`, `location`, `wizard` целиком и `turf.species`,
   `turf.methodology`, `location.lat`, `location.lon` — 422 (эти поля можно только заменить).
5. **Пустая строка в `turf.species`, `turf.methodology`, `turf.turfType` → 422**, если в базе значение непустое. Пустая
   строка в остальных полях допустима (это «стереть текст»).
6. **Программа питания** (`nutritionCalendarProgram`, `nutritionProgram`, `nutritionProgramCoords`, а также
   `maxNPerMonth`, `appliedMonthlyN`, `nzDistributor`) — единственное клиентски вычисляемое содержимое. Правила
   `resolveGaipConfigWrite()` переносятся сюда без изменений: программа принимается только вместе со штампом
   `nutritionProgramCoords`, совпадающим с координатами, которые этот же запрос устанавливает (или текущими в базе, если
   `location` в патче нет); `nutritionProgram` без `nutritionCalendarProgram` в базе допускается (он приходит следующим
   событием той же цепочки — как сегодня). Штамп `meta.species/methodology` (GH-377) проверяется на чтении, как сегодня;
   на записи не проверяется — не расширять здесь.
7. **`location.lat/lon` в патче** → как сегодня: синхронизация в `sites.latitude/longitude` через `coordinateChanged()`,
   при реальном изменении — очистка трёх программных ключей (GH-371). `location.name` → `sites.location_name`.
8. **Ответ** — `{ data: { site_id, namespace, config: <весь конфиг после слияния>, synced_at } }`. Клиент обновляет свою
   копию **из ответа**, не из того, что послал.
9. **Лог**: `Log::info('site-config.patch', [site_id, user_id, keys(patch), clear, referer])`. Это единственный след для
   следующего инцидента; без него план не принимается.

### 2.2. `PUT /api/sites/{site}/config/{namespace}`

- Стадия 0 → 2: для `gaip` остаётся, но с гвардом (раздел 3, стадия 0). Для `gssh` — без изменений.
- Стадия 3: для `gaip` → **410 Gone** с телом `{ message: "Whole-object writes are not accepted; use PATCH …" }`. Для `gssh`
  остаётся до собственного плана (решение 7).

### 2.3. `POST /api/sites/sync`

- Стадия 0: **никогда не меняет `sites.name`** (ветка `update(['name' => …])` удаляется; остаётся только `modified_by_user_id`),
  **никогда не создаёт сайт** (ветка `else` удаляется; неизвестный ID пропускается, `saved` его не считает). `firstOrCreate`
  для `site_configs` остаётся (безвредно). Ответ прежний.
- Стадия 3: маршрут удаляется (404). К этому моменту клиентских вызовов нет (стадия 2).

### 2.4. Что не меняется

`PATCH /api/sites/{site}` (имя, координаты, таймзона, `soil_texture_override`, `attributes_json`) — уже по полям, остаётся;
для `timezone` действует 2.5. `GET /api/sites`, `GET /api/sites/{site}` — источник чтения, остаются; `GET /api/sites`
продолжает отдавать `configs.gaip` для всех сайтов логина — это нужно комбинированному экспорту (раздел 4).
`POST /api/sites` — без изменений, кроме 2.5. `PATCH /api/active-site`, `DELETE /api/sites/{site}` — без изменений.

### 2.5. Таймзона сайта — выводится из координат на сервере (решение 3, 16.09.2026)

**Чем выводить.** Встроенными средствами PHP, без зависимости: `DateTimeZone::listIdentifiers()` даёт 419 зон, у каждой
`DateTimeZone::getLocation()` возвращает опорную точку (широта/долгота главного города зоны). Берётся зона с наименьшим
расстоянием по дуге большого круга до координат сайта. Проверено 16.09.2026 в контейнере `gilba_app` (PHP 8.3.31, все 419
зон с координатами): Auckland → `Pacific/Auckland` (2 км), Canberra → `Australia/Sydney` (253 км; `Australia/Melbourne` дальше),
Melbourne → `Australia/Melbourne`, Gold Coast → `Australia/Brisbane`, Adelaide → `Australia/Adelaide`, Perth → `Australia/Perth`,
Cardiff → `Europe/London`, Belfast → `Europe/Isle_of_Man` (те же правила, что `Europe/London`), New York → `America/New_York`.
Метод приблизительный у границ зон (Tweed Heads / Gold Coast, Broken Hill, границы штатов США): для таких сайтов существует
ручное переопределение ниже. Точный метод требует набор границ зон (composer `minube/geo-timezone` или аналог, десятки
мегабайт данных) — не в этом плане; вернуться, если ручное переопределение потребуется чаще одного раза.

**Где.** Новый `Controller::timezoneFromCoordinates(?float $lat, ?float $lon): ?string` рядом с `isNewZealand()`
(`app/app/Http/Controllers/Controller.php:11`). Вызывается из `SiteController::store()` и `SiteController::update()`.

**Правило записи `sites.timezone`:**

1. `POST /api/sites`: клиент `timezone` не присылает (оба мастера и Account перестают его слать — стадия 1). Есть
   `latitude`/`longitude` → `timezone = timezoneFromCoordinates()`; нет → `NULL`. Значение `Australia/Sydney` по умолчанию
   исчезает отовсюду (`store()` его и сегодня не подставляет; подставляли клиенты и `syncRegistry()`).
2. `PATCH /api/sites/{id}`: непустой `timezone` в запросе — ручное переопределение, записывается как есть. Пустая строка
   или отсутствие `timezone` при наличии координат (в запросе или уже в строке) → пересчёт из координат. Пересчёт
   выполняется и тогда, когда запрос **меняет координаты** (`coordinateChanged()`, уже есть в `update()`), а `timezone`
   в запросе пуст.
3. Settings > Site, селект `#stg-timezone` (`settings.blade.php:77-100`): первой опцией добавляется `value=""` с подписью
   `Auto — <зона по координатам>` (зону сервер отдаёт в `sitePayload()` как `timezone_derived`; если координат нет —
   подпись `Auto — set location first`). Остальные 15 опций остаются ручным переопределением. Опция выбрана, когда
   `sites.timezone` пуст или равен `timezone_derived`. Форма шлёт `timezone: ''` для Auto. Сохранённое ранее значение,
   равное выведенному, при этом неотличимо от ручного — это допустимо: результат одинаков.
4. Пока координат нет: `sites.timezone = NULL`; `AppServiceProvider.php:112` уже подставляет `UTC` для отметки времени
   анализа; открытые погодные запросы клиента используют `timezone: 'auto'` (`climate-engine.js`, `climate-normals-service.js:98`,
   `weather-resilience.js:295`) и от `sites.timezone` не зависят. Единственный серверный читатель — эта отметка времени.

**Может ли сайт создаться без координат.** Да, тремя путями, все остаются: Account > Add site (`account-init.js:301`,
шлёт только `name` и `site_type`); `site-setup-wizard.js` `skipWizard()` (`:1364-1373`) → `persistWizardState()` →
`ensurePersistedSite()` (`:1209-1220`) с `latitude: location.lat || null` — при пропуске до шага локации координат нет;
`syncRegistry()` — до стадии 0. `onboarding-wizard.js` создаёт сайт только из `_save()` после шага 4, а шаг 1 не пропускается
без локации (`_canProceed`, `:150-153`), поэтому там координаты есть всегда. Для сайтов без координат таймзона остаётся
`NULL` до первого `PATCH` с координатами (Settings > Site после GH-404 требует их) — тогда сервер выводит её по п. 2.
Ничего не подставлять.

**Проверка.** PHPUnit `app/tests/Feature/GH439TimezoneTest.php` (раздел 8). Ручная: Settings > Site у NZ-сайта показывает
`Auto — Pacific/Auckland`; выбор `UK — London` и сохранение → в базе `Europe/London`; возврат на Auto → `Pacific/Auckland`.

---

## 3. Стадии

Каждая стадия — отдельный коммит, отдельно проверяется, продукт после неё рабочий.

### Стадия 0 — GH-439a — сервер: PATCH-маршрут, гвард на PUT, `sites/sync` без имени и без создания

**Меняется** (`app/app/Http/Controllers/SiteController.php`, `app/routes/web.php`):

- Новый метод `patchConfig()` и маршрут `Route::patch('/sites/{site}/config/gaip')` по контракту 2.1. `resolveGaipConfigWrite()`
  выносится в общую приватную функцию, которой пользуются и `patchConfig()`, и пока живой `updateConfig()`.
- `updateConfig()` для `gaip` получает гвард: (а) каждый верхнеуровневый ключ, отсутствующий в присланном объекте,
  переносится из базы (расширение carry-forward с трёх программных ключей на все); (б) если присланный объект обнуляет или
  делает пустым `turf.species`, `turf.methodology`, `turf.turfType`, `location.lat`, `location.lon` при непустом значении в
  базе, или не содержит `wizard` при наличии `wizard` в базе — поле берётся из базы, а в лог пишется
  `Log::warning('site-config.put.blanked-fields', [...])`. Не 422: hub-страницы в стадиях 0–1 всё ещё шлют PUT фоном, и
  422 там никто не увидит; журнал важнее.
- `syncRegistry()` — по 2.3.
- Таймзона из координат — по 2.5: `Controller::timezoneFromCoordinates()`, вызовы в `store()` и `update()`,
  `timezone_derived` в `sitePayload()`. Серверная половина решения 3; клиентская (мастера, Account, селект Settings) — стадия 1.

**Проверка**: PHPUnit (новые `app/tests/Feature/GH439SiteConfigPatchTest.php`, ~14, и `GH439TimezoneTest.php`, ~5 — см.
раздел 8) зелёный; `GILBA_E2E=1 npx jest tests/e2e/gh439-config-reset-live.test.js …`: **H1 — `wizard` на месте после 14
фоновых PUT**, но сценарий в целом остаётся красным: снимок несёт `turf.nProgram: "250"` непустым значением, гвард стадии 0
его не отличит от намеренного, а `identity()` в тесте сравнивает и `nProgram`. Разбить H1 на H1a (`wizard` не потерян —
зелёный после стадии 0) и H1b (identity-поля не изменились — `test.failing` до стадии 2). **E зелёный** (имя не изменилось),
F переписан на «сайт не создан, `saved: 0`» и зелёный; **B по-прежнему красный** — это ожидаемо и записано в тесте как
`test.failing` до стадии 1.

Условия прогонов (правило замеров, раздел 8): H1 в анализе задерживает `GET /api/sites` на 7 с, E подменяет его на 500.
Каждый из них дополняется прогоном на **обычной загрузке** той же страницы (`/reports/forensic` для H1, `/analysis` для E),
без маршрутных подмен, со своей цифрой: число `PUT …/config/gaip` и `POST sites/sync` за 25 с, `wizard` и identity-поля
после, `sites.name` после. После стадии 0 на обычной загрузке ожидается: PUT есть (их убирает стадия 2), `wizard` на месте,
имя на месте. В отчёте стадии обе цифры стоят рядом, каждая с условием.

**Как выглядит провал**: H1a показывает `wizard=undefined` после загрузки `/reports/forensic`; E показывает `name = <id>`;
PHPUnit-тест «PUT без `wizard` при `wizard` в базе» получает конфиг без `wizard`; `POST /api/sites` с координатами Окленда
даёт `timezone = NULL` или `Australia/Sydney`.

**Размер**: 2–2.5 дня (было 1.5–2; +0.5 на таймзону).

### Стадия 1 — GH-439b — писатели нового хаба переходят на PATCH

**Меняется** (каждый вызов — в инвентаре раздела 5 с пометкой «стадия 1»):

- `nutrition-calendar.js` `persistSiteConfigPatch()`: обе ветки (через `GAIP_SiteConfig.mergeConfig()` и прямой fetch на Plan)
  шлют `PATCH { patch: <ровно переданный patch> }`; локальная копия (`window.GAIP_SITE_CONFIG` на Plan, `_configs[siteId]` на
  hub-страницах) обновляется **из ответа**. Разрешённый состав патча — п. 2.1(6). `Object.assign(GAIP_SITE_CONFIG, patch)`
  перед отправкой удаляется.
- `site-config-persistence.js` `mergeConfig()`, `setCompanionSpecies()`, `setMultiSiteTurfEnabled()`: PATCH соответствующей
  секции; `pushConfigsToServer()` из них больше не зовётся (сама функция удаляется в стадии 2).
- `settings-init.js`: форма Site → `PATCH /sites/{id}` (как сегодня) + `PATCH config { patch: { location, irrigation,
  weatherOverride } }`; форма Turf → `{ patch: { turf } }` + `PATCH /sites/{id} { soil_texture_override }`; форма Traffic →
  `{ patch: { traffic } }`; импорт бандла → `{ patch: { turf, location, pgr } }`. Клон `D.gaipConfig` больше не отправляется;
  `D.gaipConfig` обновляется из ответа.
- `onboarding-wizard.js` `_persist()` и `site-setup-wizard.js` `persistWizardState()`: `{ patch: { turf, location, wizard } }`;
  `buildMergedSiteConfig()` (чтение локальной копии для слияния) удаляется — слияние делает сервер.
- Таймзона, клиентская половина 2.5: `onboarding-wizard.js:602` и `site-setup-wizard.js:1218` перестают слать `timezone`
  (строка `timezone: 'Australia/Sydney'` удаляется, ничего не подставляется взамен); `account-init.js:301` — не шлёт и сегодня,
  без изменений. `settings.blade.php:77-100` — опция `Auto — <timezone_derived>` первой, `settings-init.js:245` шлёт `''`
  для неё. Изменений в `SiteController::update()` здесь нет — они в стадии 0.
- `gilba-alerts.js` `saveSiteAlertConfig()`: через `mergeConfig()` → PATCH `{ alertContacts, alertQuietHours }`.
- `daily-dashboard.js` companion species (два места): только `GAIP_SiteConfig.setCompanionSpecies()`; прямая запись в
  `localStorage` (`:1998`) удаляется уже здесь.
- `plan.blade.php`: `GAIP_SITE_CONFIG` остаётся серверным инжектом (чтение), но Plan перед Generate **перечитывает** конфиг
  (`GET /api/sites/{id}`) — это закрывает не только методологию, но и `location`/`soil` из старой вкладки. Один GET на
  Generate, ~50 мс.

**Проверка**: e2e **B зелёный** (старая вкладка Plan после Settings → Generate → в базе AA; в логе запросов от Plan только
`PATCH …/config/gaip` с ключами `nutritionCalendarProgram|maxNPerMonth|nutritionProgramCoords`, потом `nutritionProgram`);
A, C зелёные; сценарий D (Re-run) — как раньше, ни одной записи конфига; новый e2e-сценарий S1 «Settings меняет методологию →
в запросе только `patch.turf`» зелёный. Полный jest и PHPUnit зелёные после правок тестов из раздела 8.

**Провал**: в логе запросов с Plan/Settings есть `PUT …/config/gaip`; B красный.

**Размер**: 2.5–3 дня (много мест, каждое простое; самое тонкое — обновление `D.gaipConfig`/`GAIP_SITE_CONFIG` из ответа
и перечитывание на Plan).

**Между стадиями 1 и 2** продукт рабочий: hub-страницы всё ещё пушат PUT фоном, но гвард стадии 0 не даёт им ничего стереть.

### Стадия 2 — GH-439c — `site-config-persistence.js` становится кэшем чтения; фоновые записи удаляются

**Меняется**:

- `site-config-persistence.js`:
  - удаляются: `pushConfigsToServer()`, `syncSiteRegistryToServer()`, `saveLocationToServer()`, ветка «first visit» и
    «Page-load config finalised» (оба `snapshotConfig()` на таймере 800/3000 мс), обработчики `gaip:turf-profile-change`,
    `gaip:site-save-requested`, `gaip:config-save-requested`, `gaip:analysis-complete` (все четыре — снимки DOM),
    `migrateDefaultSite`, `pruneConfigKeys` как источник записи, `_cleanupLocationBleed`, b35fix210-миграция;
  - `snapshotConfig()` остаётся **только** как функция для GH-371/GH-377 проверки stale-программы на чтении — и
    переименовывается в `readDomInputs()` с комментарием «never persisted»; если проверка ей не пользуется — удалить;
  - `init()`: `_configs` наполняется из `GAIP_HUB_CONFIG.gaipConfig` (активный сайт, синхронно — `seedFromInjectedConfig`
    остаётся, но копирует **все** ключи, включая `wizard`, и всегда, не только «если локально нет вида») и из `GET /api/sites`
    (все сайты, для переключения и экспорта); `pullConfigsFromServer()` заменяет содержимое целиком (никакого слияния по
    `savedAt` и identity-полям — сервер всегда прав);
  - таймеры восстановления (`restoreDelay` 800/3000 мс) заменяются на «когда пришёл `GET /api/sites`»: `restoreConfig()`
    вызывается после ответа, `gaip:site-config-applied` — после него. Если `GET /api/sites` упал — `gaip:site-config-failed`,
    страница показывает состояние «не удалось загрузить настройки сайта» (то же требование, что раздел 5 плана по пробам),
    расчёт **не** запускается на DOM-умолчаниях;
  - `saveCurrentSiteConfig()` при переключении сайта — не пишет ни в `localStorage`, ни на сервер; кэш уже содержит оба сайта;
  - `saveToStorage()` остаётся до стадии 3 только как зеркало для читателей `localStorage` (раздел 5), но **ничто не читает его
    обратно в `_configs`** (`loadFromStorage()` удаляется здесь).
- `sample-persistence.js`: `syncSiteListToServer()` и её вызов из `doSave()` удаляются; `fetchSiteListFromServer()` становится
  обязательным шагом — если он упал, регистр сайтов не строится из проб (`fetchSamplesFromServer()` не создаёт записи регистра),
  выставляется `gaip:samples-persistence-error` с причиной `sites-list`. `recoverSitesFromLegacyConfig()` удаляется.
- `sample-manager.js` `_initSite()`: запись регистра без ярлыка (`label: ''`), не `label: siteId`; `getActiveSiteLabel()`
  при пустом ярлыке отдаёт ID (как сегодня) — но ID теперь никогда не уходит на сервер, потому что уходить нечем.
- Reports-страницы (`reports/export|forensic|scenarios.blade.php`, `morning-briefing.blade.php`, `stadium.blade.php`):
  в `GAIP_HUB_CONFIG` добавляется `gaipConfig` активного сайта — тем же кодом, что в `layouts/app.blade.php:15-23`
  (вынести в `AppServiceProvider` composer для `partials.topbar`, где уже читается `$gaipRecord`, чтобы не дублировать).
- `location-preloader.js` удаляется из всех пяти views: он перезаписывает `.gaip-lat/.gaip-lon` из `localStorage` поверх
  серверных значений — это и есть «локальная копия как источник».
- Те же пять views получают инжект `GAIP_WIZARD_CONFIG` (`activeSiteId`, `savedLocation`, `wizardComplete`, `wizardState`) —
  сделано в GH-441 (`layouts/db-shell.blade.php:27-37`, composer в `AppServiceProvider`). **Поправка 16.09.2026, пятая
  редакция (проверяемое, ревью идёт):** этот пункт был добавлен 16.09 с обоснованием «на Reports чистый браузер видит мастер
  при целом `wizard` в базе». Обоснование неверно: `site-setup-wizard.js` на страницах с `.db-shell` не инициализируется
  (`:1487-1488`), Reports расширяют `layouts.db-shell`, оверлея там нет ни при каком состоянии базы и `localStorage`; мастер
  дашборда (`onboarding-wizard.js`) грузится только `dashboard.blade.php` и решает по `turf.species` из базы
  (`dashboard.blade.php:24`). Инжект `GAIP_WIZARD_CONFIG` на db-shell-страницах кормит только `auto-refresh.js:80`
  (`/reports/forensic`, `/reports/scenarios`: без `wizardComplete` автозапуск ждёт резервный таймер 4.5 с) — это побочная
  польза, а не закрытие дефекта мастера, которого на Reports не было. Половина GH-441 с инжектом `gaipConfig` нужна как и была
  (её читает `site-config-persistence.js`); половина с `GAIP_WIZARD_CONFIG` на db-shell — лишняя работа для мастера,
  оставляется как есть ради `auto-refresh.js`; выкидывать не нужно. Гейт по `localStorage` в `:141-152` действует только на
  `/hub` — это стадия 4b.
- `site-selector-ui.js:146`: кнопки Save и Rename на `/hub` удаляются вместе с обработчиком `gaip:site-save-requested` (W7)
  — решение 9. Rename шёл через `sites/sync`, которого после этой стадии никто не зовёт.

**Проверка** (переписано 16.09.2026, четвёртый раз — правило замеров, раздел 8; первая редакция S2 держалась на задержке):

- e2e **S2 — два прогона**, оба над одними и теми же пятью страницами `/hub`, `/reports/export`, `/reports/forensic`,
  `/reports/scenarios`, `/morning-briefing`, в браузере, который уже открывал hub-страницу (обычный `localStorage`, не чистый
  контекст):
  - **S2-обычный**: обычная загрузка, без маршрутных подмен, 30 с наблюдения. Утверждение: **ноль** запросов `PUT`/`POST` к
    `/api/sites*` (кроме `PATCH /api/active-site`, если страница его шлёт), `savedAt` всех конфигов в базе не изменился.
    Это и есть утверждение «страница не пишет». Без этого прогона S2 ничего не доказывает.
  - **S2-задержка**: то же при `GET /api/sites`, задержанном на 7 с. Утверждение то же. Прогон проверяет, что медленный ответ
    не открывает путь H1; в отчёте цифра стоит с пометкой «задержка 7 с».
- e2e **S3 — два прогона** над `/analysis`:
  - **S3-обычный**: обычная загрузка. Утверждение: `POST /api/sites/sync` не отправляется, `sites.name` на месте, регистр
    сайтов в топбаре показывает имена.
  - **S3-500**: `GET /api/sites` подменён на 500. Утверждение: `POST /api/sites/sync` не отправляется, имя на месте, на
    странице видно состояние ошибки, а не регистр из ID. В отчёте — с пометкой «GET /api/sites → 500».
- e2e **S5 — два прогона над `/hub`** (перенесено с `/reports/export` 16.09.2026, пятая редакция: на Reports оверлей не
  существует, `site-setup-wizard.js:1487-1488`; S5 в том виде, как он прогнан в GH-441, ничего о мастере не доказывал):
  - **S5-чистый**: чистый контекст браузера (нет `gilba_wizard_complete` и `gilba_turf_profiles`). При `wizard.complete = true`
    в базе оверлей `#gaip-wizard-overlay` не появляется; при отсутствующем `wizard` — появляется. В отчёте — с пометкой
    «чистый контекст».
  - **S5-обычный**: браузер, уже открывавший `/hub` (профили TPC есть). До стадии 4b оверлей не появляется ни при `wizard`,
    ни без него — это гейт по `localStorage`; так и записывается. После 4b этот прогон становится S5b (стадия 4b).
  - Для `/reports/export` — одно структурное утверждение вместо прогона: страница содержит `.db-shell`, `#gaip-wizard-overlay`
    не появляется ни при `wizard`, ни без него (обычная загрузка), и это ожидаемо.
- H1 и E — зелёные без фильтра тела запроса (фильтр `route.continue({postData})` из E удаляется — защищать другие сайты
  больше не от чего); их обычные прогоны — как в стадии 0.
- Скрытый раннер экспорта: `npm run test:e2e` (parity-харнесс на Burns/Test5/NTL) зелёный — это проверка, что переключение
  сайтов в раннере работает с серверным кэшем; обычная загрузка, без подмен.

**Провал**: любой `PUT …/config/gaip` или `POST /api/sites/sync` в логе **S2-обычного** или S2-задержки; `sites/sync` в
S3-обычном; parity-харнесс падает на переключении сайта (значит, `restoreConfig()` вызван до прихода кэша — см. риск в
разделе 9). Зелёный S2-задержка при красном S2-обычном — провал стадии, не частичный успех.

**Размер**: 4–5 дней. Самая большая и самая рискованная стадия — см. раздел 9.

### Стадия 3 — GH-439d — `localStorage`-копия удаляется; PUT и `sites/sync` снимаются с маршрутов

**Меняется**:

- `site-config-persistence.js`: `saveToStorage()`, `STORAGE_KEY`, `_ls` удаляются; `_configs` только в памяти; при загрузке
  одноразово `localStorage.removeItem('gilba_hub_site_configs')` и namespaced-варианта (`gilba_<ns>_gilba_hub_site_configs`).
- Читатели `localStorage` (раздел 5, «стадия 3») переводятся на `GAIP_SiteConfig.getConfig()` / `GAIP_HUB_CONFIG.gaipConfig`;
  `settings-init.js` три зеркала в `localStorage` удаляются; `gaip-field-log-analysis.js` pre-flight и PGR-cleanup удаляются;
  `gaip-morning-briefing.js` читает через `getAllConfigs()` (fallback на `localStorage` удаляется); `hub-orchestrator.js:4331`
  → `getConfig()`; `gilba-storage-migrate.js` — ключ из обоих списков.
- Сервер: `PUT …/config/gaip` → 410; `POST /api/sites/sync` → маршрут удалён; `updateConfig()` остаётся только для `gssh`.
- `site-profile-bridge.js` — **проверить** (раздел 5): если он читает `gilba_hub_site_configs` для генерации TPC-профилей —
  перевести на `getAllConfigs()`; профили TPC (`gilba_turf_profiles`) вне области (решение по Profile Save/Load уже есть).
- Гейт мастера по `localStorage` (`site-setup-wizard.js:141-152`) в этой стадии **не трогается** — это стадия 4b, после
  ремонта строк в 4a (изменено 16.09.2026, третий раз; раньше 4b стояла внутри этой стадии).

**Проверка**: структурный jest `tests/gh439-no-client-state-writes.test.js` (раздел 8) зелёный — в `assets/*.js` (кроме
`site-data-transfer.js`, старый хаб) нет строк `gilba_hub_site_configs` (кроме одной `removeItem`), `config/gaip` с методом
`PUT`, `sites/sync`; e2e S4: после обхода всех страниц `localStorage.getItem('gilba_hub_site_configs') === null`; PHPUnit:
PUT gaip → 410, `POST /api/sites/sync` → 404. Полные jest/PHPUnit зелёные.

**Провал**: ключ в `localStorage` после обхода; структурный тест находит вызов.

**Размер**: 2 дня.

### Стадия 4a — GH-439e — автоматический ремонт испорченных строк с отчётом-записью (см. раздел 6)

Artisan-команда `php artisan sites:repair-config` (решение 4 в редакции 16.09.2026, третий раз). По умолчанию **пишет**;
`--dry-run` печатает то же самое без записи. Правит ровно два поля по правилам раздела 6: `config.wizard` (восстановление
снятого флага) и `sites.timezone` (подпись дефекта). Имена-идентификаторы, строки без координат и лишние сайты — только в
отчёте. Отчёт печатается при каждом запуске, с записью и без: построчно `site_id`, имя, поле, «было», «стало», причина;
плюс списки «оставлено как есть» с причиной и «только отчёт». Всё в одной транзакции; повторный запуск ничего не меняет и
печатает это.

**Меняется**: `app/app/Console/Commands/RepairSiteConfigs.php` (новый), использует `Controller::timezoneFromCoordinates()`
(вынести в общий helper, если из команды до protected-метода контроллера не дотянуться).

**Проверка**: PHPUnit `GH439RepairConfigTest.php` (раздел 8) зелёный; на dev — запуск, затем повторно запросы из
`GH-439-baseline-dev-2026-09-16-RU.md`: список C (без `wizard`) пуст, список D показывает шесть исправленных строк с
ожидаемыми зонами из среза, шесть совпадавших — без изменений; на проде — запуск с сохранением вывода в отчёт стадии.

**Провал**: после запуска на dev остался сайт без `wizard` при заполненном виде и координатах; `Test5 - NZ`
(`Pacific/Auckland`, совпадает) изменён; повторный запуск что-то изменил.

**Размер**: 1 день.

### Стадия 4b — GH-439f — мастер `/hub` решает только по базе

**Область — только `/hub` (поправка 16.09.2026, пятая редакция; проверяемое, ревью идёт).** По утверждению разработчика,
4b меняет поведение на `/hub`, `/morning-briefing` и `/stadium`, а у db-shell-страниц свой мастер по виду травы из базы.
По коду (только чтение): `site-setup-wizard.js` грузят четыре view — `hub.blade.php`, `reports/export|scenarios|forensic.blade.php`;
`morning-briefing.blade.php` и `stadium.blade.php` его не грузят (ни напрямую, ни через `layouts/app.blade.php` или partials);
на трёх Reports-страницах он выходит из `initWhenReady()` по `.db-shell` (`:1487-1488`). Значит 4b меняет поведение
**только `/hub`** — расхождение с формулировкой разработчика по двум страницам, ревьюеру проверить. Мастер дашборда
(`onboarding-wizard.js`, только `dashboard.blade.php`) 4b не касается.

**Что это меняет в весе 4b.** `/hub` — не клиентская страница: живёт как скрытый iframe для фонового расчёта (правило
проекта). Оверлей на `/hub` клиент не видит; в iframe он не виден тоже. Не проверено и здесь не утверждается, влияет ли
оверлей в iframe на запуск расчёта (`auto-refresh.js:80` откладывает автозапуск до резервного таймера 4.5 с при
`wizardComplete = false` — задержка, не пропуск). Отсюда 4b перестаёт быть условием клиентского опыта и остаётся правкой
ради целевого состояния раздела 0 на единственной странице, которую клиент не открывает. Правило проекта запрещает менять
UI `/hub` и чинить на нём косметику. **Рекомендация: 4b не делать**; оставить `site-setup-wizard.js` как есть, ключ
`gilba_wizard_complete` — тоже (он читается только этим скриптом на `/hub`). Если владелец решит делать — объём ниже
прежний, 0.5 дня. Это решение владельца, не блокирует остальное: 4a выполняется в любом случае.

Если 4b делается — выполняется **после 4a**. `site-setup-wizard.js:126-155`: две проверки `localStorage` удаляются — `gilba_wizard_complete`
(`:141`) и «есть хоть один профиль в `gilba_turf_profiles`» (`:145-152`); остаётся одна ветка: `GAIP_WIZARD_CONFIG.wizardComplete`
истинно → выход, иначе показ. Записи `gilba_wizard_complete` в `markComplete()` (`:1359`), `skipWizard()` (`:1370`) и
`reset()` (`:1417`) удаляются; ключ убирается из `gilba-storage-migrate.js:31`. Сами профили TPC не трогаются:
`gilba_turf_profiles` остаётся хранилищем легаси-контроллера `turf-profile-controller.js`, перестаёт быть только гейтом
мастера. Сервер: `wizardComplete` в `layouts/db-shell.blade.php:36` и `layouts/app.blade.php:47` становится
`complete || skipped` — так уже считает сам мастер после записи (`site-setup-wizard.js:1330`); без этого пропущенный мастер
возвращается при каждой загрузке.

**Предусловие и что оно означает.** После 4b запись в базе — единственный гейт **на `/hub`**. 4a ставит `wizard` каждому
сайту, у которого есть вид травы и координаты, поэтому после 4a без `wizard` остаются только сайты, у которых нет вида или
нет координат. На них оверлей после 4b откроется на `/hub` — странице, которую клиент не открывает; в скрытом iframe он не
виден. У клиента мастер открывается только на дашборде, и он решает по виду травы из базы (`dashboard.blade.php:24`) и по
`provisional_name` — 4a и 4b на него не влияют. На dev по срезу 16.09 сайтов без вида или координат ноль, значит после 4a
список C пуст. На проде число печатает 4a строкой «без `wizard` после ремонта: N (нет вида: …, нет координат: …)».

**Проверка** (если 4b делается): структурный jest — `site-setup-wizard.js` не содержит `gilba_turf_profiles` и
`gilba_wizard_complete`; e2e S5b — два прогона над **`/hub`** (не над Reports — там оверлея нет, `:1487-1488`):
**обычный браузер**, уже открывавший `/hub` (в `gilba_turf_profiles` есть профили, `gilba_wizard_complete` может быть):
сайт без `wizard` → оверлей `#gaip-wizard-overlay` появляется; `wizard.skipped = true` → не появляется; любой из 12
dev-сайтов после 4a → не появляется. **Чистый контекст**: те же три утверждения, с пометкой «чистый контекст». Оба прогона
должны совпасть — это и есть доказательство, что `localStorage` в решении больше не участвует. До 4b S5b-обычный —
`test.failing`. Дополнительно: `/reports/export` при тех же состояниях базы — оверлея нет (структурно ожидаемо).

**Провал**: оверлей на `/hub` не появился при профилях в браузере и без `wizard` в базе; оверлей появился на dev-сайте
после 4a; оверлей появился на `/reports/export`.

**Размер**: 0.5 дня.

---

## 4. Где копия в памяти действительно нужна — и что мешает ей снова стать источником записи

1. **Переключение сайта в скрытом раннере** (`/reports/export` и Re-run-iframe `/hub`): парити-харнесс и комбинированный
   экспорт переключают `GAIP_SampleManager.setActiveSite()` без перезагрузки, и `restoreConfig()` должен наполнить легаси-DOM
   конфигом прибывающего сайта. Требование настоящее: без него экспорт по нескольким сайтам считает всё под конфигом первого.
2. **Комбинированный Word-экспорт** (`word-export-combined.js:4809`, `word-export.js:9639/10288/10318`) читает конфиги
   **других** сайтов — программу, штампы, `multiSiteTurf`. Требование настоящее: документ строится в одном окне для N сайтов.

Обе покрываются **одной** копией: `_configs` в `site-config-persistence.js`, наполненной из `GET /api/sites` (и инжекта для
активного сайта). Что удерживает её от превращения в источник записи:

- у модуля после стадии 2 **нет ни одной сетевой функции, кроме `GET`** и `PATCH` из `mergeConfig()`/`setCompanionSpecies()`/
  `setMultiSiteTurfEnabled()`, каждая из которых отправляет только переданный ей патч, а не `_configs[siteId]`;
- `_configs[siteId]` меняется **только** из ответа сервера (`GET` или ответ `PATCH`), никогда из DOM;
- сервер не принимает объект целиком (410 на PUT) и не принимает `null`/пустые identity-поля;
- структурный тест `gh439-no-client-state-writes.test.js` пинит и отсутствие `localStorage`-ключа, и отсутствие PUT, и то, что
  единственные `fetch` в `site-config-persistence.js` — `GET` и `PATCH` с телом `{ patch: … }`.

Это отличается от сегодняшнего механизма не названием, а направлением: сегодня DOM → копия → сервер; после — сервер → копия →
DOM, и копия не переживает страницу.

---

## 5. Инвентарь вызовов

Номера строк — рабочее дерево 15.09.2026; «проверить» — я видела вызов, но не читала окружение целиком.

### 5.1. Писатели (всё, что сегодня отправляет состояние или пишет копию)

| # | Место | Что делает сегодня | Становится | Стадия |
|---|---|---|---|---|
| W1 | `site-config-persistence.js:268-310` `pushConfigsToServer()` | `PUT` всех сайтов из `_configs` + `sites/sync` | удаляется | 2 |
| W2 | `site-config-persistence.js:122-157` `syncSiteRegistryToServer()` | `POST sites/sync` с ярлыками | удаляется | 2 |
| W3 | `site-config-persistence.js:159-181` `saveLocationToServer()` | `PATCH sites` lat/lon из локальной копии | удаляется (координаты — только Settings/мастер) | 2 |
| W4 | `site-config-persistence.js:1174-1235` `saveCurrentSiteConfig()` | снимок + `saveToStorage()` + push | ничего не пишет; кэш уже полон | 2 |
| W5 | `site-config-persistence.js:1560-1640` page-load: «finalised» и «first visit» | `snapshotConfig()` → `_configs` → localStorage | удаляется; `restoreConfig()` по приходу `GET` | 2 |
| W6 | `site-config-persistence.js:1675` `gaip:turf-profile-change` | снимок DOM → `_configs` | удаляется (правки легаси-формы на `/hub` не сохраняются — решение 1) | 2 |
| W7 | `site-config-persistence.js:1700` `gaip:site-save-requested` (кнопка Save на `/hub`) | снимок + `saveLocationToServer()` | удаляется вместе с кнопкой в `site-selector-ui.js:146` | 2 |
| W8 | `site-config-persistence.js:1717` `gaip:config-save-requested` | снимок | удаляется; companion идёт через W10 | 2 |
| W9 | `site-config-persistence.js:1747` `gaip:analysis-complete` | снимок + `GAIP_LAST_PGR` → `_configs` | удаляется; PGR пишет spray log (b35fix210 уже так решил) | 2 |
| W10 | `site-config-persistence.js:1836-1846` `mergeConfig()` | слияние в `_configs` + localStorage + push | `PATCH { patch }`; кэш из ответа | 1 |
| W11 | `site-config-persistence.js:1857-1873` `setCompanionSpecies()` | `_configs` + push | `PATCH { patch: { turf: { companionSpecies } } }` | 1 |
| W12 | `site-config-persistence.js:1896-1913` `setMultiSiteTurfEnabled()` | `_configs` + push | `PATCH { patch: { multiSiteTurf } }` | 1 |
| W13 | `site-config-persistence.js:1470-1510` `migrateDefaultSite` | создаёт `my_site` через `sites/sync` (H1 это показал) | удаляется | 2 |
| W14 | `site-config-persistence.js:1324-1430` `init()`: `loadFromStorage`, seed, миграции, `pullConfigsFromServer` слияние по `savedAt` | localStorage — источник | `_configs` только из инжекта + `GET`; замена, не слияние | 2 (3 — удаление ключа) |
| W15 | `nutrition-calendar.js:2712-2795` `persistSiteConfigPatch()` | hub: `mergeConfig()`; Plan: `Object.assign(GAIP_SITE_CONFIG, patch)` + `PUT` всего | обе ветки `PATCH { patch }`; Plan перечитывает конфиг перед Generate | 1 |
| W16 | `nutrition-prebble/au/uk/nz-fertiliser-integration.js` (`:396/:422/:878/:426/:509`) | зовут W15 с `{ nutritionProgram }` / `{ nzDistributor }` | без изменений (идут через W15) | — |
| W17 | `settings-init.js:322-323` форма Site | `PATCH sites` + `PUT` клона `D.gaipConfig` | `PATCH sites` + `PATCH config { patch: { location, irrigation, weatherOverride } }` | 1 |
| W18 | `settings-init.js:333-340` зеркало location в localStorage | пишет `gilba_hub_site_configs` | удаляется | 3 |
| W19 | `settings-init.js:821-822` форма Turf | `PUT` клона + `PATCH sites soil_texture` | `PATCH config { patch: { turf } }` + `PATCH sites` | 1 |
| W20 | `settings-init.js:831-836` зеркало turf | localStorage | удаляется | 3 |
| W21 | `settings-init.js:1606-1636` импорт бандла | `PATCH sites` + `PUT { turf, location, pgr }` + зеркало | `PATCH config { patch: { turf, location, pgr } }`; зеркало удаляется | 1 / 3 |
| W22 | `settings-init.js:1762` форма Traffic | `PUT` клона с `traffic` | `PATCH config { patch: { traffic } }` | 1 |
| W23 | `onboarding-wizard.js:569-586` `_persist()` | `PATCH sites` + `PUT { location, turf, wizard }` (стирает всё остальное) | `PATCH config { patch: { turf, location, wizard } }` | 1 |
| W24 | `onboarding-wizard.js:596-604` `_ensureSite()` | `POST sites` с `timezone: 'Australia/Sydney'` | `timezone` не отправляется; сервер выводит из координат (2.5) | 1 |
| W25 | `site-setup-wizard.js:1253-1284` `buildMergedSiteConfig()` | читает локальную копию и сливает | удаляется | 1 |
| W26 | `site-setup-wizard.js:1286-1310` `persistWizardState()` | `PATCH sites` + `PUT` слитого | `PATCH config { patch: { turf, location, wizard } }` | 1 |
| W27 | `site-setup-wizard.js:1209-1220` `ensurePersistedSite()` | `POST sites` с `timezone: 'Australia/Sydney'` | `timezone` не отправляется; сервер выводит из координат (2.5); при пропуске мастера координат нет — `NULL` до Settings | 1 |
| W43 | `SiteController::store()`, `update()` | `timezone` пишется как прислано | 2.5: пусто → из координат; непусто → ручное | 0 |
| W44 | `settings.blade.php:77-100` `#stg-timezone`, `settings-init.js:245` | 15 опций, первая выбрана при `NULL` | опция `Auto — <timezone_derived>` первой, шлёт `''` | 1 |
| W28 | `gilba-alerts.js:231-245` `saveSiteAlertConfig()` | `mergeConfig()` | через W10 → `PATCH { alertContacts, alertQuietHours }` | 1 |
| W29 | `daily-dashboard.js:1985-2000` companion select | прямая запись `gilba_hub_site_configs` | удаляется; остаётся вызов W11 (`:2020`, `:2278`) | 1 |
| W30 | `gaip-field-log-analysis.js:560-612` pre-flight merge с сервера в localStorage | пишет ключ | удаляется; читает `GAIP_SiteConfig` | 3 |
| W31 | `gaip-field-log-analysis.js:640-670` PGR bleed cleanup | пишет ключ | удаляется | 3 |
| W32 | `sample-persistence.js:484-522` `syncSiteListToServer()` + вызов `:292` | `POST sites/sync` с ярлыками из регистра | удаляется | 2 |
| W33 | `sample-persistence.js:629-660` `recoverSitesFromLegacyConfig()` | строит регистр из `gilba_hub_site_configs` | удаляется | 3 |
| W34 | `sample-persistence.js:386-390` `fetchSamplesFromServer()` `label = summary.site_name \|\| siteId` | ярлык = ID | не создаёт записей регистра; регистр только из `fetchSiteListFromServer()` | 2 |
| W35 | `sample-manager.js:334-336` `_initSite()` `label: siteId` | ярлык = ID | `label: ''` | 2 |
| W36 | `location-preloader.js` (весь файл) | перезаписывает `.gaip-lat/.gaip-lon` из localStorage | удаляется из 5 views | 2 |
| W37 | `gilba-storage-migrate.js:24,153` | переносит ключ между namespace | ключ убирается из списков | 3 |
| W38 | `SiteController::syncRegistry()` | пишет имя, создаёт сайт | стадия 0: ни того ни другого; стадия 3: маршрут удалён | 0 / 3 |
| W39 | `SiteController::updateConfig()` + `resolveGaipConfigWrite()` | замена целиком, 3 ключа защищены | стадия 0: гвард; стадия 3: 410 для `gaip` | 0 / 3 |
| W40 | `dashboard-ui.js:70-84` stamp `gilba_samples.currentSite` перед Re-run | localStorage проб | **не здесь** — item 6 плана по пробам | — |
| W41 | `hub-persistence.js:2300` `PATCH /api/active-site` после импорта | намерение, не состояние | без изменений | — |
| W42 | `site-profile-bridge.js` (`SITE_CONFIGS_KEY`, `:78/:112/:124` setItem в `gilba_turf_profiles`) | **проверить**: читает ли конфиги из localStorage для профилей | если да — на `getAllConfigs()`; профили TPC вне области | 3 |

### 5.2. Читатели (остаются; меняется только откуда берут)

| # | Место | Сегодня | После |
|---|---|---|---|
| R1 | `word-export.js:7837, 9639, 10288, 10318` | `GAIP_SiteConfig.getConfig()` | без изменений (кэш серверный) |
| R2 | `word-export-combined.js:4809` | `getConfig(siteId)` других сайтов | без изменений; требует `GET /api/sites` с конфигами |
| R3 | `daily-dashboard.js:1895, 2066` | `getConfig()` | без изменений |
| R4 | `hub-orchestrator.js:510-514` | `getConfig()` | без изменений |
| R5 | `hub-orchestrator.js:4331` | `localStorage` напрямую (companion) | `getConfig()` — стадия 3 |
| R6 | `nutrition-calendar.js:1406` | `getConfig()` | без изменений |
| R7 | `nutrition-program-inputs.js:555` | `getConfig()` | без изменений |
| R8 | `nutrition-nz-fertiliser-integration.js:183` | `getConfig()` | без изменений |
| R9 | `sample-manager.js:112` | `getConfig()` (multi-site turf) | без изменений |
| R10 | `sample-turf-profile-modal.js`, `site-settings-multi-site-turf-toggle.js` | `isMultiSiteTurfEnabled()` | без изменений |
| R11 | `gilba-alerts.js:77, 253` | `getConfig()` | без изменений |
| R12 | `gaip-morning-briefing.js:133-146` | `getAllConfigs()` с fallback на localStorage (два ключа) | fallback удаляется — стадия 3; страница `/morning-briefing` должна ждать `GET /api/sites` |
| R13 | `gaip-field-log-analysis.js:97, 589, 628, 678` | localStorage | `getConfig()`/`GAIP_HUB_CONFIG.savedLocation` — стадия 3 |
| R14 | `site-profile-bridge.js:232, 437` | `isRestoring()` | без изменений |
| R15 | `site-setup-wizard.js:1255` | `getConfig()` для слияния | удаляется вместе с W25 |
| R16 | `settings.blade.php:966` `D.gaipConfig` | серверный инжект | без изменений (только чтение для значений формы) |
| R17 | `plan.blade.php:28` `GAIP_SITE_CONFIG` | серверный инжект | без изменений + перечитывание перед Generate |
| R18 | `analysis.blade.php:13-19` `GAIP_SITE_CONFIG.turf` | серверный инжект | без изменений |
| R19 | `layouts/app.blade.php:15-23, 38, 41-49` | инжект `gaipConfig`, `siteConfig`, `wizardState` | без изменений; тот же инжект добавить Reports/morning-briefing/stadium (стадия 2) |
| R20 | `dashboard-init.js:7` | упоминание ключа в комментарии | **проверить**, что чтения нет |
| R21 | `climate-normals-service.js:154-162` | комментарий про `mergeConfig()` | без изменений |

### 5.3. Что считалось «тринадцать писателей в шести файлах» и что оказалось

В анализе я считала только вызовы `PUT`/`sites/sync`. Полный обход дал **42 позиции в 14 файлах** (таблица 5.1; W43–W44 добавлены 16.09.2026 для таймзоны и в этот счёт не входят), из них
собственно сетевых записей — 12 (W1, W2, W3, W15, W17, W19, W21, W22, W23, W26, W28→W10, W32), остальное — записи в
`localStorage`-копию и снимки DOM, которые её кормят. Утверждение из брифа «примерно тринадцать писателей в шести файлах» —
верно только для сетевой части.

---

## 6. Уже испорченные строки

Как найти (эти же запросы сняты на dev до начала работ — `GH-439-baseline-dev-2026-09-16-RU.md`; после 4a они
прогоняются снова):

```sql
-- имя = ID (сценарий E/F)
SELECT id, name, created_at, timezone, latitude FROM sites WHERE name = id AND deleted_at IS NULL;
-- строки без координат (F, либо обнулённые)
SELECT id, name, timezone FROM sites WHERE (latitude IS NULL OR longitude IS NULL) AND deleted_at IS NULL;
-- конфиг без wizard при заполненном виде (H1 стёр запись; что она гейтит — ниже, «Что даёт запись wizard»)
SELECT sc.site_id, s.name FROM site_configs sc JOIN sites s ON s.id = sc.site_id
 WHERE sc.namespace = 'gaip' AND JSON_EXTRACT(sc.config, '$.wizard') IS NULL
   AND JSON_UNQUOTE(JSON_EXTRACT(sc.config, '$.turf.species')) <> '' AND s.deleted_at IS NULL;
-- сайты с координатами, у которых таймзона не совпадает с выведенной по 2.5 (мастер/syncRegistry ставили Australia/Sydney всем).
-- Сравнение с timezoneFromCoordinates() делает команда, не SQL; этот запрос — только кандидаты.
SELECT id, name, timezone, latitude, longitude FROM sites
 WHERE latitude IS NOT NULL AND longitude IS NOT NULL AND deleted_at IS NULL;
-- сайты, которых никто не создавал через мастер: пустой конфиг, нет проб (F-двойники)
SELECT s.id, s.name FROM sites s JOIN site_configs sc ON sc.site_id = s.id AND sc.namespace = 'gaip'
 WHERE JSON_LENGTH(sc.config) = 0 AND NOT EXISTS (SELECT 1 FROM samples WHERE site_id = s.id) AND s.deleted_at IS NULL;
```

### Что даёт запись `wizard` (установлено 16.09.2026 по коду после стадий 0–2 и замеру GH-441)

Читателей записи `config.wizard` в базе два, оба в легаси-стеке; дашборд нового хаба её не читает — его мастер решает по
`turf.species` (`dashboard.blade.php:24`) и `provisional_name` (`DashboardController.php:101`). Уточнено 16.09.2026, пятая
редакция (проверяемое, ревью идёт): первый читатель работает только на `/hub`.

1. **`site-setup-wizard.js:126-155`** — показывать ли оверлей мастера. **Где вообще работает:** скрипт грузят `hub.blade.php` и
   три Reports-view, но `initWhenReady()` выходит на страницах с `.db-shell` (`:1487-1488`), а Reports расширяют
   `layouts.db-shell` — значит оверлей существует только на `/hub`. Именно поэтому замер стадии 2 на `/reports/export` не
   видел оверлея без `wizard`; гейт по профилям тут ни при чём. `/morning-briefing` и `/stadium` скрипт не грузят вовсе (по
   grep views, layouts и partials). Порядок проверок на `/hub`: инжект `GAIP_WIZARD_CONFIG.wizardComplete` истинно → не
   показывать; иначе `gilba_wizard_complete` в `localStorage` → не показывать; иначе **хоть один профиль** в
   `gilba_turf_profiles` → не показывать; иначе показать. Ключ `gilba_turf_profiles` пишет `turf-profile-controller.js`
   (`STORAGE_KEY`, `:504`, автопрофили `__site__<id>` через `site-profile-bridge.js`) при любой загрузке hub-страницы, и он один
   на все сайты браузера. Поэтому на `/hub` в браузере, который хоть раз открывал hub-страницу, оверлей не покажется ни на
   одном сайте, есть `wizard` в базе или нет. Запись `wizard` меняет поведение только на `/hub` и только на устройстве с
   пустым `localStorage`.
2. **`auto-refresh.js:80`** (`/hub`, `/reports/forensic`, `/reports/scenarios`): без `wizard` и до восстановления состояния
   автозапуск анализа пропускается, но резервный таймер `:316-321` запускает его через 4.5 с. Эффект — задержка автозапуска в
   новом браузере, не пропуск.

Отсюда два следствия для ремонта. Первое: восстановление `wizard` в базе — верная правка данных (запись документирует
пройденный мастер и была стёрта путём H1); видимого эффекта у клиента она не даёт — клиент открывает дашборд, а не `/hub`;
на `/hub` она убирает оверлей в чистом браузере и задержку автозапуска в `auto-refresh.js`. Второе: гейт по профилям TPC —
эвристика плагинной эпохи «у вернувшегося пользователя есть профили», принятая до того, как запись появилась в базе; она не
per-site и противоречит целевому состоянию раздела 0, но действует на единственной странице, которую клиент не открывает.
Стадия 4b её убирает; рекомендация — 4b не делать (см. стадию 4b). Ремонт `wizard` делает 4a автоматически в любом случае.
Профили TPC как хранилище легаси-контроллера не трогаются (решение по Profile Save/Load принято ранее).

Не установлено и здесь не утверждается, каким из путей мастер появился у владельца в её эпизоде: на Reports оверлей не
существует, на `/hub` в браузере с профилями не показывается; клиентский мастер — только дашборд, по `provisional_name`
и по `/dashboard?setup=1` (кнопка на Account, `account-init.js:346`). Если нужен ответ — это отдельный замер серверной стороны
(`provisional_name` у сайта в тот день); `localStorage` её браузера на момент эпизода недоступен. «Пройти мастер заново» как
способ ремонта: на `/hub` UI-триггера нет (`GAIP_FORCE_WIZARD`, `reset()` — только консоль), на Reports мастера нет;
единственный UI-путь — `/dashboard?setup=1`, который заново спрашивает локацию, тип, вид и методологию. Ремонт идёт через 4a.

### Что делает стадия 4a — `php artisan sites:repair-config` (решение 4 в редакции 16.09.2026, третий раз)

Автоматически, одной транзакцией, с отчётом-записью в любом случае. Два правила записи, три списка только для отчёта.

**Правило 1 — `wizard`.** Условие: в `config` нет ключа `wizard` (или он не объект), `turf.species` непустой, в строке `sites`
есть `latitude` и `longitude`. Запись: `wizard = { complete: true, completedAt: <now>, version: '1.0', repaired: 'GH-439e' }`.
Это восстановление флага, снятого путём H1; суждения не требует: вид и локация есть, мастеру нечего добавить. Сайты, у которых
`wizard` есть в любом виде (включая `skipped: true`), не трогаются. Сайты без вида или без координат не трогаются и попадают в
отчёт с причиной — на них оверлей `/hub` после 4b (если 4b делается) откроется — страница не клиентская; у клиента мастер дашборда решает по виду травы из базы и на них откроется по назначению.

**Правило 2 — таймзона. Ядро задачи: чем подпись дефекта отличается от осознанного выбора.**

Что известно о том, кто и что писал в `sites.timezone` до стадии 0:

- `NULL` — только Account > Add site (`account-init.js:301`, шлёт `name` и `site_type`) и `store()` без `timezone`. Никто
  не выбирал.
- `Australia/Sydney` — четыре автоматических писателя: `syncRegistry()` (`forceFill`, строка 122 до стадии 0), оба мастера
  (`onboarding-wizard.js:602`, `site-setup-wizard.js:1218`, до стадии 1) и Settings > Site до стадии 1: при `NULL` в строке
  селект `#stg-timezone` показывал первую опцию `Australia/Sydney`, и любое сохранение формы записывало её (анализ,
  «Локация Сидней»). Плюс, возможно, осознанный выбор из того же селекта.
- **Любое другое значение** (`Pacific/Auckland`, `Europe/London`, `America/Los_Angeles`, …) — единственный писатель — человек
  в селекте Settings > Site. Кода, который записал бы что-то кроме `NULL` и `Australia/Sydney`, в продукте нет и не было.

Отсюда правило. Сайт — кандидат на ремонт только если у него есть координаты **и** `timezone` равен `NULL` или
`Australia/Sydney`. Всё остальное — осознанный выбор по определению: значение могло появиться только руками, и команда его
не трогает, даже если оно расходится с точкой (консультант в Лондоне ведёт новозеландский сайт по лондонскому времени —
это законно). Такие строки печатаются в списке «расходится с координатами, оставлено как есть».

Для кандидата вычисляется `derived = Controller::timezoneFromCoordinates(lat, lon)` (та же функция, что в 2.5; не отдельные
рамки). Дальше:

- `timezone IS NULL` → записать `derived`. Пустое место дефектом не является, но и выбором тоже; сервер после стадии 0 сам
  выводит зону при первом же `PATCH`, здесь это делается заранее.
- `timezone = 'Australia/Sydney'` → записать `derived`, **только если** правила смещения у `Australia/Sydney` и `derived`
  различаются: сравниваются смещения от UTC на 1 января и 1 июля текущего года (`DateTimeZone::getOffset()`); различие хотя бы
  в одной из дат — зоны разные по существу. Если совпадают (Melbourne, Canberra, Hobart — те же AEST/AEDT, что Sydney) —
  оставить как есть: значение верно для этой точки, и переписывать имя зоны нечем оправдать. Это же условие защищает случай,
  когда `Australia/Sydney` на восточно-австралийском сайте выбран осознанно.

Что это правило чинит на dev (список D среза): `test4 - USA` → `America/Los_Angeles`; `Test6 - UK` → `Europe/London`;
`Russley`, `Test - GC - NZ - warm season grass test` → `Pacific/Auckland` (Сидней +10/+11, Окленд +12/+13 — различаются);
`New test - location` (`NULL`, Wollongong) → `Australia/Sydney`; `Test - GC - NZ - delivery` (`NULL`) → `Pacific/Auckland`.
Что оставляет: `Federal Golf`, `Test1 - Sports`, `Burns`, `Canberra`, `Westview` — `Australia/Sydney` при канберрских и
сиднейских координатах, `derived` = `Australia/Sydney` (Canberra — `Australia/Sydney` по ближайшей точке, 2.5) — без
изменений; `Test5 - NZ` — `Pacific/Auckland`, не кандидат. Итог: 6 записей, 6 без изменений — совпадает со срезом.

Чего правило **не** отличает, и это сказано открыто: осознанно выбранный `Australia/Sydney` на сайте вне восточно-австралийских
правил (например, новозеландский сайт, который сиднейский офис намеренно ведёт по своему времени) неотличим от подписи
дефекта по данным — журнала выбора нет. Команда перепишет его на `derived`. Известных таких случаев нет (в срезе dev все
шесть расхождений имеют форму дефекта; на проде список печатается до записи — `--dry-run`). Возврат — Settings > Site,
выбрать зону и сохранить: после стадии 0 непустое значение хранится как ручное (`resolveTimezoneOnUpdate()`), и 4a больше
не запускается. Ручной `Australia/Sydney`, выставленный между стадией 0 и 4a на таком сайте, тоже будет переписан — окно в
несколько дней, принимается.

След записи: отчёт печатается всегда; дополнительно в `sites.attributes_json` пишется
`gh439_repair: { timezone: { from, to, at } }` и/или в `config.wizard.repaired = 'GH-439e'` — чтобы позже по базе было видно,
что менял ремонт, а что человек. Миграций не требуется.

**Только отчёт:**

- **`name = id`** — восстановить неоткуда (журнала нет). Печатается список; правит владелец в Settings > Site или Account,
  когда захочет. `provisional_name = 1` для таких строк не ставить — это откроет мастер. На dev — 0 строк.
- **Без координат** — печатается список; зона не выводится (нечем), `wizard` не пишется; у клиента мастер дашборда на них
  и так открывается по виду травы и `provisional_name`, локацию просит он. На dev — 0 строк.
- **F-двойники** (пустой конфиг, нет проб, `name = id`) — печатается список с командой `DELETE /api/sites/{id}`; удаление
  необратимо, команда его не делает. На dev — 0 строк.

**Отчёт-запись.** Каждая запись — строка `site_id | имя | поле | было | стало | причина`; затем «оставлено как есть» с
причиной (зона совпадает по правилам; зона выбрана вручную; `wizard` уже есть); затем три списка «только отчёт»; затем
итоговая строка «без `wizard` после ремонта: N (нет вида: …, нет координат: …)». Вывод сохраняется в отчёт стадии.

- На dev: срез 16.09 — 12 из 12 без `wizard`, 6 из 12 с расходящейся зоной. Запуск на dev — живая проверка команды: после
  него запросы среза дают список C пустым, список D — шесть строк с зонами из таблицы среза. До 4b это должно быть сделано,
  иначе живая проверка 4b покажет мастер на всех 12 сайтах.

---

## 7. Решения продукта — приняты владельцем 16.09.2026

1. **Правки в легаси-форме `/hub` (вид, HOC, методология, overseed, traffic-поля) перестают сохраняться.** После стадии 2 их
   меняет только Settings нового хаба. **Принято.**
2. **`POST /api/sites/sync` удаляется; имя сайта пишется только `PATCH /api/sites/{id}` из Settings/Account.** **Принято.**
3. **Таймзона выводится из координат сайта на сервере; поле в Settings — ручное переопределение.** **Принято в этой
   формулировке** (первоначальная рекомендация «из браузера» отклонена). Полный контракт — раздел 2.5: чем выводить
   (встроенный `DateTimeZone::getLocation()`, без зависимости), где (сервер, `store()`/`update()`), что показывать без
   координат (`NULL`, отметка времени по `UTC`, в Settings — `Auto — set location first`), и три пути создания сайта без
   координат, которые остаются.
4. **Ремонт `wizard` и таймзоны — автоматически, командой, внутри последовательности стадий; имена-идентификаторы и лишние
   сайты — только отчёт; отчёт-запись печатается всегда.** **Принято в этой формулировке 16.09.2026 (третья редакция;
   промежуточная «только отчёт, правит владелец» отменена).** Раздел 6: правило, отличающее подпись дефекта (`NULL` или
   `Australia/Sydney` при других правилах смещения по координатам) от осознанного выбора (любое другое значение, либо
   `Australia/Sydney` с теми же правилами смещения). Стадия 4a, затем 4b.
5. **PUT `gaip` живёт с гвардом до стадии 3, потом 410.** **Принято.**
6. **Очистка полей только через `clear`, `null` в `patch` → 422.** **Принято.**
7. **Namespace `gssh` (стадион) — вне области**, PUT для него остаётся; отдельный план позже. **Принято, отложено.**
8. **Программа питания шлёт три ключа + `maxNPerMonth`/`appliedMonthlyN`/`nzDistributor` как патч со штампом координат**;
   правило доверия штампу — прежнее. Больше ничего от Plan/hub-страниц в конфиг не пишется. **Принято.**
9. **`site-selector-ui.js` кнопки Save и Rename на `/hub`** удаляются вместе с W7 (стадия 2). **Принято.**

---

## 8. Тесты

### Новые

- `app/tests/Feature/GH439SiteConfigPatchTest.php` (~14): слияние на один уровень; отсутствующий ключ не тронут; `null` → 422;
  неизвестный ключ → 422; пустой `turf.species` при непустом → 422; `clear` секции и поля; `clear` запрещённого → 422;
  программа без штампа отброшена, с совпадающим штампом принята (перенос из `GH371CoordinateInvalidationTest`); `location`
  в патче синхронизирует `sites` и чистит программу при реальном сдвиге; ответ содержит слитый конфиг; лог пишется;
  `canEditSite` → 403 для viewer.
- `app/tests/Feature/GH439SyncRegistryTest.php` (~4): `sites/sync` не меняет имя, не создаёт сайт, `saved` считает только
  существующие; после стадии 3 — 404.
- `app/tests/Feature/GH439TimezoneTest.php` (~5, стадия 0): `timezoneFromCoordinates()` на девяти точках из 2.5 даёт
  перечисленные там зоны; `POST /api/sites` с координатами Окленда → `Pacific/Auckland`, без координат → `NULL`;
  `PATCH` с `timezone: 'Europe/London'` → записано как есть; `PATCH` с `timezone: ''` и координатами → выведено;
  `PATCH`, меняющий координаты при пустом `timezone` → пересчитано; `sitePayload()` отдаёт `timezone_derived`.
- `app/tests/Feature/GH439RepairConfigTest.php` (~10, стадия 4a): `wizard` ставится при виде и координатах, не ставится без
  вида, не ставится без координат, не трогается при `skipped: true`; `NULL` + координаты → `derived`; `Australia/Sydney` +
  оклендские координаты → `Pacific/Auckland`; `Australia/Sydney` + мельбурнские координаты → без изменений (те же правила
  смещения); `Europe/London` + оклендские координаты → без изменений, в списке «оставлено, выбрано вручную»; `name = id` →
  строка не изменилась, в отчёте; `--dry-run` → ничего не записано, вывод тот же; повторный запуск → ноль изменений;
  `attributes_json.gh439_repair` записан у исправленных строк.
- `app/tests/Feature/GH439PutGuardTest.php` (~5, живёт до стадии 3, потом заменяется одним тестом «410»): PUT без `wizard`
  при `wizard` в базе → `wizard` на месте + warning в логе; PUT с пустым `turf.species` → значение из базы; PUT без
  `traffic` → `traffic` перенесён.
- `tests/gh439-no-client-state-writes.test.js` (структурный, ~6): в `assets/*.js` кроме `site-data-transfer.js` нет
  `gilba_hub_site_configs` (кроме `removeItem`), нет `'sites/sync'`, нет `config/gaip` рядом с `method: 'PUT'`;
  `site-config-persistence.js` содержит `fetch`/`apiFetchJson` только с `GET` и `PATCH`; `sample-persistence.js` не содержит
  `syncSiteListToServer`; `location-preloader.js` не подключён ни одним view; `site-setup-wizard.js` не содержит
  `gilba_turf_profiles` и `gilba_wizard_complete` (4b). **Это и есть проверка, которая упадёт, если
  кто-то вернёт запись состояния.** Принимается в стадии 3, но пишется в стадии 0 как `test.todo` по пунктам.
- `tests/e2e/gh439-config-reset-live.test.js` — расширяется: S1 (Settings → в запросе только `patch.turf`; обычная
  загрузка), S2 (пять hub-страниц — ноль записей; два прогона: обычная загрузка и `GET /api/sites` с задержкой 7 с), S3
  (`/analysis` — ноль `sites/sync`; два прогона: обычная загрузка и `GET /api/sites` → 500 с состоянием ошибки), S4
  (`localStorage`-ключ отсутствует после обхода; обычная загрузка), S5/S5b (мастер на `/hub`, не на Reports — там оверлея нет,
  `site-setup-wizard.js:1487-1488`; два прогона: обычный браузер с профилями TPC и чистый контекст; S5b только если 4b делается). Существующие A–H2 остаются; H1 (задержка 7 с), E (500) и H2 (подложенная копия в `localStorage`)
  получают парные прогоны на обычной загрузке со своими цифрами; B — `test.failing` до стадии 1; F переписывается на
  «не создан»; фильтр тела в E снимается в стадии 2.

**Правило замеров (владелец, 16.09.2026).** Утверждение «страница не пишет», «запросов ноль», «состояние не меняется»
принимается только по прогону на обычной загрузке страницы, без искусственных задержек, подмен ответов, чистого контекста
и подложенного `localStorage`. Прогон с искусственным условием доказывает поведение под этим условием и обязан утверждать
это явно: в имени сценария, в его `expect`, и в отчёте — рядом с цифрой. Каждый такой сценарий существует парой: обычный
прогон и прогон с условием, у каждого своя цифра. Результат, который держится на условиях прогона, передаётся дальше с
пометкой об условии. Повод: S2 стадии 2 в первой редакции этого плана был описан только с задержкой и был зелёным за счёт
неё, при записях на обычной загрузке.
Дополнение 17.09.2026: состояние, которое геттер подмешивает при чтении (`GAIP_STATE` — `gilba-hub-v2.js:1403`), меряется
**на обращении** — обёрткой геттера, с подсчётом присутствия при каждом чтении, — а не снимком в одной точке. Снимок
отвечает за момент, обращение — за то, что видит потребитель; один снимок при входе в `collectData` показал отсутствие
пяти контейнеров, которые за выгрузку читались 10 435 раз каждый.

### Существующие, которые придётся менять (оценка по числу `test(` в файле; точное — при работе)

| Файл | Тестов | Что с ними |
|---|---|---|
| `tests/gh385-snapshot-config-site-scoped.test.js` | 10 | удалить: `snapshotConfig()` как источник сохранения исчезает |
| `tests/site-config-persistence-last-update-b35fix504.test.js` | 20 | переписать под кэш (`_last` от `restoreConfig()`, без snapshot/push) — ~половина |
| `tests/gh377-program-input-invalidation.test.js` | 55 | блоки `snapshotConfig()` (≈15) удалить; `pullConfigsFromServer()` identity-merge (≈5) удалить — сервер всегда прав; `restoreConfig()`/`restoreFromPersisted()`/word-export — остаются |
| `tests/gh371-d01-coordinate-invalidation.test.js` | 30 | блок `settings-init.js strip` (3) удалить; PHP-часть переносится в PATCH-тест; остальное остаётся |
| `tests/gh394-traffic-schedule-persisted-and-derived.test.js` | 31 | тесты carry-forward `traffic` в snapshot (≈4) удалить; форма → `patch.traffic` (переписать 2–3) |
| `tests/gh378-no-duplicate-site-changed-during-export.test.js` | 5 | **проверить** — зависит от `saveCurrentSiteConfig()` |
| `tests/cotula-*-b35fix388/394.test.js` | 32 | **проверить** — читают `restoreConfig()` (остаётся) или snapshot |
| `tests/hoxton-climate-normals-service-ensure.test.js` | 22 | **проверить** — упоминает `mergeConfig()` |
| `tests/gh322b-restore-dispatches-generated-event.test.js` | 4 | остаётся (restore) |
| `app/tests/Feature/GH371CoordinateInvalidationTest.php` | 15 | 10 переезжают в PATCH-тест, 5 (PUT) живут до стадии 3 |
| `app/tests/Feature/SiteApiTest.php` | 30 | 2 sync-теста переписать; `test_authenticated_user_can_update_site_config` → PATCH |

Итого затронуто ≈ 60–80 jest-тестов и ≈ 20 PHPUnit. Полные прогоны (`npx jest`, `php artisan test`) — после каждой стадии.
Живая проверка каждой стадии — `npm run test:e2e` (парити-харнесс) плюс e2e этого тикета, по правилу замеров выше: каждая
цифра в отчёте стадии — с условием прогона; страницы дополнительно открываются Playwright-харнессом и снимаются экраном,
зелёный тест экран не заменяет.

---

## 9. Размер и что может пойти не так

| Стадия | Дни | Риск |
|---|---|---|
| 0 | 2–2.5 | низкий; единственная тонкость — carry-forward не должен «воскрешать» программу при реальном сдвиге координат (правило GH-371 сохранить, тест есть). Таймзона: метод ближайшей опорной точки приблизителен у границ зон — ручное переопределение в Settings покрывает это |
| 1 | 2.5–3 | средний: 12 мест, каждое просто; ошибка — забыть обновить `D.gaipConfig`/`GAIP_SITE_CONFIG` из ответа, тогда вторая правка в той же вкладке уйдёт с устаревшим… нет, уйдёт патчем — безвредно, но форма покажет старое |
| 2 | 4–5 | **высокий**: (а) `restoreConfig()` сегодня ждёт таймер 800/3000 мс, а `hub-orchestrator.js` ждёт `gaip:site-config-applied` — переход на «по приходу `GET`» меняет порядок событий загрузки, парити-харнесс это поймает; (б) на страницах без инжекта (`/morning-briefing`, Reports) до прихода `GET` нет конфига вообще — нужна честная заглушка «загрузка настроек», а не расчёт на пустом; (в) удаление снимков DOM отключает сохранение правок легаси-формы — решение 1 должно быть принято до начала; (г) `sample-persistence.js` без `sites/sync` — регистр строится только из `GET /api/sites`; при его падении нужен экран ошибки (раздел 5 плана по пробам), иначе страница «пустая» без объяснения |
| 3 | 2 | низкий-средний: «глухие» читатели `localStorage` на standalone-страницах (`/field-log`, `/morning-briefing`) — если пропустить один, страница тихо покажет пусто; структурный тест ловит по строке ключа |
| 4a | 1 | низкий-средний: команда пишет в прод; защита — `--dry-run` перед записью, транзакция, идемпотентность, отчёт-запись. Единственный неотличимый случай — осознанный `Australia/Sydney` на сайте с другими правилами смещения (раздел 6) — будет переписан; известных таких сайтов нет |
| 4b (рекомендация — не делать) | 0.5 | низкий; касается только `/hub`, которую клиент не открывает; без 4a — оверлей на `/hub` на каждом сайте без `wizard` |

Итого 12–14 дней разработки + 2–3 дня живых проверок по стадиям (стадия 0 +0.5 на таймзону, 4a — 1 день с записью и тестами,
4b — 0.5). Порядок: 0 → 1 → 2 → 3 → 4a → 4b (4b — только если владелец решит делать; рекомендация — нет); участие владельца между стадиями не требуется. Что видно пользователю между стадиями: после стадии 2
правки в легаси-форме `/hub` не сохраняются (намеренно, решение 1); во время стадии 2 (до её коммита) — ничего, стадия
атомарна. Ничего иного видимого не ломается.

Сценарии анализа → стадия, которая их закрывает:

| Путь | Закрывает | После плана |
|---|---|---|
| Фоновые PUT всех сайтов при загрузке hub-страницы (H1) | стадия 0 — обезврежены гвардом; стадия 2 — исчезают | нет |
| Снимок с DOM-умолчаний как конфиг (H1, `wizard`, `nProgram`) | стадия 0 (гвард), стадия 2 (нет снимков) | нет |
| Ярлык `= ID`, собранный клиентом (E) | стадия 0 (имя не пишется), стадия 2 (нет `sites/sync`) | нет |
| Сайт из неизвестного ID с `Australia/Sydney` (F) | стадия 0 | нет |
| Вкладка Plan шлёт состояние на момент загрузки (B) | стадия 1 (патч + перечитывание) | нет |
| Settings шлёт клон `D.gaipConfig` (вопрос 6 плана дефектов) | стадия 1 | нет |
| Мастера шлют `{turf, location, wizard}` целиком, стирая остальное | стадия 1 | нет |
| `location-preloader.js` подменяет координаты из localStorage | стадия 2 | нет |
| Stamp `gilba_samples.currentSite` перед Re-run (W40) | **не в этом плане** — item 6 плана по пробам | остаётся до той стадии |
| Таймзона `Australia/Sydney` у новых сайтов | стадия 0 (сервер выводит из координат), стадия 1 (мастера перестают слать) | нет |
| Таймзона `Australia/Sydney` у существующих сайтов | стадия 4a — автоматически по правилу 2 раздела 6 (`NULL` или `Australia/Sydney` при других правилах смещения) | нет; осознанно выбранные зоны не трогаются и печатаются в отчёте |
| `wizard` уже потерян у существующих сайтов | стадия 4a — автоматически, при виде и координатах | нет; без `wizard` остаются только сайты без вида или координат — на `/hub` (не у клиента) |
| Мастер на Reports при целом `wizard` (чистый браузер) | дефекта нет: на Reports мастер не инициализируется (`site-setup-wizard.js:1487-1488`); инжект `GAIP_WIZARD_CONFIG` из GH-441 кормит только `auto-refresh.js` | — |
| Мастер `/hub` гасится профилями TPC в `localStorage` независимо от базы | стадия 4b, если делается (рекомендация — нет: `/hub` клиент не открывает) | остаётся на `/hub`, если 4b не делается |

Ни один путь из анализа не переживает план, кроме W40, который принадлежит плану по пробам и не пишет конфигурацию.
Уже испорченные строки чинит стадия 4a автоматически (`wizard`, таймзона); имена-идентификаторы и лишние сайты остаются в отчёте (решение 4).

---

## 10. Поправка GH-459 — чтение входов и печати в экспорте (архитектурное решение аналитика, 16.09.2026, ночь)

Область раздела: `assets/word-export.js` (`collectData()` с 7850, `_buildEngineInputs()` с 7030, печать), `assets/word-export-combined.js`
(цикл переключения сайтов, 596–700, per-sample программа ~2240), `assets/hub-orchestrator.js` (`computeAll`, событие
`gaip:analysis-complete`), `assets/site-config-persistence.js` (каскад восстановления). Сервер не трогается. Это правка плана,
по которой работает разработчик; формулировки координатора и перечень ревьюера — вход, проверены ниже.

### 10.1. Факты, принятые как данные

Замеры ревьюера (не мои): входы расчёта экспорта читались из состояния страницы (DOM-поля, `GAIP_STATE`, `GAIP_CANONICAL_STATE`,
`GAIP_OVERSEED_STATE`); чужое значение **возвращается** в `GAIP_STATE.inputs.turf` внутри окна нужного сайта (очистка на 1346 мс,
возврат чужого на 2323 мс); координаты в DOM перерисовываются на 327 мс при паузе цикла 300 мс; после первой правки расчёт сошёлся,
печать нет («Species: Couch» при райграсе), потому что правка стояла под `if (!data.turf.species)`, а поле было заполнено чужим;
на текущем дереве текст сценария владельца сошёлся (Couch 0, Ryegrass 9), но блок «Climate & Growth Conditions» печатает 13.3 °C и
GP 2 % — числа другого сайта из единственного страничного слота `window.climateMetrics`, с которого GH-245 увёл расчёт, а печать
осталась; чтением найдены ещё шесть мест (B–H в письме ревьюера). Что установлено мной по коду: в `collectData()` около сорока
чтений состояния страницы (grep `GAIP_STATE|GAIP_CANONICAL_STATE|GAIP_OVERSEED_STATE|querySelector('.gaip-|climateMetrics|
GAIP_CLIMATE_V2_RESULT|GaipTurfProfile.state` в `word-export.js:7850-9400`); `waitForAnalysis()` (`word-export-combined.js:95-122`)
ждёт событие `gaip:analysis-complete` и после него ничего из него не берёт — результаты потом читаются из глобалов; в `computeAll`
(`hub-orchestrator.js:3979`) вид травы при пустом входе берётся из `SpeciesController` и `GAIP_STATE.turf` (`:640-660`) — тот же класс
внутри раннера; каскад восстановления уже знает целевой сайт (`_lastSwitchedToSiteId`, `site-config-persistence.js:929`), но таймеры
при срабатывании его не сверяют.

### 10.2. Класс, точно

Класс не «заполнить, если пусто» и не «чтение DOM». Класс: **документ о сайте X строится из состояния страницы, у которого нет
отметки, о каком сайте оно.** Состояние страницы двух видов, и лечатся они по-разному:

- **Вид I — идентичность и входы**: имя и локация сайта, координаты, тип поверхности, вид, сорт, подсев, доля C3, HOC,
  конструкция, площадь зоны, годовой N, дистрибьютор, значения проб, климатические нормали для координат. Всё это **существует
  по идентификатору** независимо от страницы: `GAIP_SiteConfig.getConfig(siteId)`, `GAIP_SampleManager` по id пробы,
  `GilbaClimateNormalsService.getResolvedSync(lat, lon)`. Для вида I единственно верное чтение — по id; чтение со страницы
  удаляется, не понижается.
- **Вид II — результаты расчёта**, которые легаси-раннер (`/hub` в скрытом iframe или страница `/reports/export`) считает для
  текущего сайта и кладёт в глобалы: `mlsnResults`, `tissueResults`, `waterResults`, `climateMetrics` (текущие условия и GP),
  `shadeMetrics`, `wearMetrics`, disease, `fertility.monthlyN`, DLI, `GAIP_CLIMATE_V2_RESULT`. По id их нет: они существуют
  только как результат прогона. Для вида II верное чтение — **только с отметкой прогона**: результат несёт `{ siteId, sampleIds,
  runId }`, экспорт берёт его из события того прогона, который ждал, и сверяет отметку с сайтом пробы; без совпадения раздел
  опускается по существующему правилу «нет раздела, нет подмены» (b35fix313/314), никогда не подставляется.

Третья половина класса — на стороне писателей: **отложенный писатель ушедшего сайта не должен приземляться** (факт 2: возврат чужого
на 2323 мс). Каскад, запланированный для сайта A, при срабатывании сверяет A с активным сайтом и при несовпадении ничего не пишет.
Без этого вид II будет посчитан раннером из чужих входов даже при верном чтении по id.

### 10.3. Проверка формулировок

| Формулировка | Вердикт | Почему |
|---|---|---|
| «Экспорт берёт все входы расчёта из конфига сайта пробы, фолбэки удаляются, не понижаются» | **Верно как принцип для вида I**, недостаточно как закрытие класса | Без единой границы это остаётся списком полей — ревьюер уже нашёл 9 из 11 и половину цепочки. Не покрывает вид II (слот климата A) и входы самого раннера |
| «Читать по id безусловно и перезаписывать пришедшее из состояния страницы» | **Неверно как форма** | «Перезаписать» значит, что чтение со страницы осталось и предшествует; каждое поле не из списка перезаписи — утечка (B: percentC3, hoc). Верная форма: объект вида I **строится** из резолвера по id и не патчится; страничных чтений для вида I в функции нет вовсе |
| «Найти и закрыть весь класс "заполнить, если пусто"» | **Закрывает случай, не класс** | Условие пустоты — одна из форм; чтение без условия (`_b35fix442_turf`, `:7997`), цепочка приоритетов (`:7905-7920`), слот климата (`:8363`) той же природы и без `if (!x)`. Поиск по форме условия их не найдёт |
| «Вид травы и признак кривой — не два независимых входа» | **Отдельная правка не нужна**, согласна с замером ревьюера | `isC4` выводится из вида внутри `collectData` (`:8243`); в резолвере вида I он **производный**, и сторож перечисления (10.6) числит его как производный, не как источник. Проверить, что производный признак действительно потребляется печатью C4-разделов, — часть RC на текст |
| Не возвращать ранний писатель полей, не увеличивать паузу | **Принято как ограничение** | Поправка не использует ни того, ни другого. После 10.4 паузе нечего защищать; она остаётся как есть |

Перечень ревьюера B–H: все восемь — вид I, кроме A (вид II) и H (умолчание как факт — вид I, лечится тем, что резолвер отдаёт
`null`, а печать при `null` пишет «Not specified»/опускает раздел по существующему правилу; умолчаний-названий видов в
`collectData` не остаётся). «Ссылки на бермудграс в библиографии» — не дефект, в RC на текст библиография исключается явно.

### 10.4. Устройство — три слоя

**Слой I — входы по id через одну границу.**

- В `assets/nutrition-program-inputs.js` (уже единый адаптер входов обеих поверхностей, GH-383) — новая функция
  `resolveExportInputs({ siteId, soilSampleId, tissueSampleId, waterSampleId })`. Возвращает замороженный объект:
  `site { id, name, location { name, lat, lon }, timezone, areaHa }`, `turf { type, subCategory, species, speciesDisplay,
  variety, construction, hoc, percentC3, warmBase, coolOverseed, overseedSpecies, overseedVariety, isC4 (производный) }`,
  `program { annualN, annualNSource, distributor, trafficModifier, … } = resolveSiteProgramInputs({ siteId, … })`,
  `samples { soil, tissue, water }` — payload по id из `GAIP_SampleManager`, `climateNormals = getResolvedSync(lat, lon)`
  (+ `reason`), и `sources { поле: 'site-config' | 'sample' | 'unresolved' }` для каждого поля. Источники: `getSiteConfig(siteId)`
  (`nutrition-program-inputs.js:553`, уже отказывается подставлять чужой сайт), `GAIP_SampleManager.getSiteList()` для имени,
  пробы по id. Отсутствующее — `null` и `'unresolved'`; **никаких умолчаний-названий** (`'Couch'`, `'Perennial Ryegrass'`,
  `'generic'` как значение). Площадь зоны: сегодня только DOM (`.gaip-soil-area-ha`, `:7931`) — где ей жить по id, вопрос 10.8(2);
  до ответа поле `null`, печать по существующей ветке «missing area».
- `collectData(inputs)` получает этот объект аргументом. Все присваивания вида I в `data.site`/`data.turf`/`data.program`
  делаются из него, одним блоком, в начале функции. Удаляются (не понижаются): `_b35fix442_turf` из `GAIP_STATE` (`:7997-8030`),
  цепочка тип/подкатегория из `GaipTurfProfile.state` и трёх DOM-селекторов (`:8070-8145`), фолбэк вида из `.gaip-species`
  (`:8138`), цепочка имени/локации из `gaip-location-search`/`gaip-location-status` (`:7880-7920`; вопрос C), подсевной сорт из
  DOM и `GAIP_CLIMATE_V2_RESULT` (`:8027`, `:8286-8300`; вопрос E), глобал выбранных сортов для Variety Traits (вопрос D), флаг
  подсева из `.gaip-enable-overseed`/`GAIP_STATE.turf.overseedActive` (`:8259-8263`), годовой N из двух DOM-полей один раз на
  документ (вопрос G) — из `program.annualN` per site. В `_buildEngineInputs()` после GH-459 вид I уже по id; он переводится на
  тот же объект, чтобы источник был один, а не два согласованных вручную.
- Комбинированный экспорт (`word-export-combined.js:~2240`): «из конфига сайта ИЛИ из общестраничного снимка» (вопрос F) →
  только из `resolveExportInputs` того сайта; отсутствие — пропуск программы этой пробы с предупреждением, как уже делает
  GH-383 для `annualN`.
- Одиночный экспорт идёт через тот же резолвер с активным сайтом и загруженными пробами — иначе у файла два пути.

**Слой II — результаты с отметкой прогона.**

- `hub-orchestrator.js` `computeAll()`: на входе фиксируется `runStamp = { runId, siteId: SM.getActiveSiteId(), sampleIds:
  { soil, tissue, water } из SampleManager, startedAt }`; пишется в `GAIP_CANONICAL_STATE.runStamp`; событие
  `gaip:analysis-complete` получает `detail = { stamp: runStamp, results: <замороженный снимок того, что этот прогон
  положил: mlsnResults, tissueResults, waterResults, climateMetrics, shadeMetrics, wearMetrics, disease, fertility,
  ambientDLI, climateV2> }`. Модули, пишущие результат позже события (если такие есть — проверить по `climate-engine-v2`,
  `overseed-climate-integration`), либо входят в снимок, либо раздел печатается как «недоступно» с причиной; не догонять
  снимок таймерами.
- `word-export-combined.js` `waitForAnalysis()` резолвится **значением** `detail` того события, которое ждал (сегодня резолвится
  `undefined` после `SETTLE_MS`); цикл передаёт его в `collectData(inputs, run)`.
- Новый `collectResults(inputs, run)` внутри `collectData`: раздел берётся из `run.results`, только если `run.stamp.siteId ===
  inputs.site.id` и id проб совпадают; иначе раздел опускается, в `data.omitted[]` пишется `{ section, reason: 'results belong to
  site <id>' }`, и документ печатает это одной строкой в существующем месте для «недоступно» (правило b35fix313/314). Чтения
  `window.GAIP_STATE.*`, `window.climateMetrics`, `GAIP_CLIMATE_V2_RESULT` из `collectData` удаляются — это закрывает слот A
  (`:8363`) вместе со всеми остальными результатами.
- Входы раннера: перед `triggerAnalysis()` цикл кладёт вид I в хранилище раннера явно — `GilbaHub.set('inputs.turf', …)`,
  `inputs.site`/локация — из того же `resolveExportInputs`. Так прогон считает из входов по id, а не из того, что каскад успел
  нарисовать; фолбэки `computeAll` на `SpeciesController`/`GAIP_STATE.turf` (`:640-660`) при этом не достигаются и не
  трогаются в этой поправке.

**Слой III — отложенный писатель ушедшего сайта не приземляется.**

- Каждый таймер/промис в `site-config-persistence.js` (каскад `restoreNewSiteConfig`/`restoreConfig`, `:884-915`, финал
  `gaip:site-config-applied`), в `turf-profile-controller.js` (каскад профиля), в `overseed-climate-integration.js` и в модулях,
  пишущих `window.climateMetrics` (`climate-normals-service.js:205`, `dashboard-init.js:289`), при планировании захватывает
  `targetSiteId`, при срабатывании сравнивает с `SM.getActiveSiteId()` и при несовпадении **не пишет**, оставляя строку в логе
  `dropped: scheduled for <A>, active is <B>`. В `site-config-persistence.js` целевой сайт уже есть (`_lastSwitchedToSiteId`);
  добавить сверку в каждый callback.
- Пауза 300 мс в цикле не меняется. Ранний писатель не возвращается. После слоёв I–III экспорту от паузы ничего не нужно:
  входы по id, результаты по отметке, чужие каскады не пишут.

### 10.5. Инвентарь чтений состояния страницы в экспорте (по grep 16.09, `word-export.js`)

| Строки | Что читает | Вид | Судьба |
|---|---|---|---|
| 7880-7920 | `gaip-location-search`, `gaip-location-status`, `getActiveSiteLabel()` для имени/локации | I | **закрыто GH-461**: `site.name`, `site.location.name` из резолвера, DOM-цепочка удалена (17.09: исключение в сторожe устарело и должно быть снято) |
| 7931 | `.gaip-soil-area-ha` | I | **чтение закрыто GH-461** (DOM не читается, резолвер отдаёт `null`); значение появится после решения 10.8(2) |
| 7997-8030 | `GAIP_STATE.inputs.turf` / `GAIP_STATE.turf` — весь блок turf | I | резолвер, блок удаляется |
| 8027, 8286-8300 | DOM-селекты сорта/подсевного сорта, `GAIP_CLIMATE_V2_RESULT.overseedVariety` | I | резолвер |
| 8059 | `.gaip-c3-cover` | I | резолвер `percentC3` |
| 8070-8145 | `GaipTurfProfile.state`, три DOM-селектора типа/подкатегории | I | резолвер |
| 8138 | `.gaip-species` fallback | I | удаляется |
| 8259-8263 | флаг подсева из DOM/`GAIP_STATE.turf.overseedActive` | I | резолвер |
| 8363 | `window.climateMetrics` / `GAIP_STATE.climateMetrics` — блок Climate & Growth (A) | II | `run.results.climateMetrics` с отметкой |
| 8396 | `GAIP_STATE.shadeMetrics` | II | отметка |
| 8438-8660 | `GAIP_STATE.soil`, `mlsnResults`, DOM-ярлыки пробы, DOM-ppm fallback | значения пробы — I (по id пробы); `mlsnResults` — II | значения из `samples.soil`; результаты с отметкой; DOM-fallback ppm удаляется |
| 8868, 8909 | `.gaip-aa-sample-type`, `.gaip-aa-soil-texture` | I | резолвер (из пробы/конфига) |
| 9084-9100, 9206-9300 | tissue/water: `GAIP_STATE.*Results`, DOM-ярлыки, DOM-fallback значений | I/II | как для почвы |
| 9724-9732 | `GAIP_STATE.fertility.monthlyN` | II | отметка |
| 9949 | `GAIP_STATE.wearMetrics` | II | отметка |
| 10769 (было 10884) | `GAIP_STATE.turf.construction` внутри построителя раздела, **вне `collectData`** — вне зоны обоих сторожей первой редакции (находка ревьюера 17.09) | I | `data.turf.construction` из резолвера; построители читают только `data` |
| ~10880-10900 | `mlsnResults`, `climateMetrics.rainfall/temperature` в том же построителе | II | отметка прогона (слой II) |
| 15285-15421 | `gaip-logo-*`, `gaip-org-name`, `gaip-export-word` | элементы диалога экспорта, не данные сайта | остаются; в сторож — как именованные исключения с причиной |

`word-export-combined.js:606-700`: пред-проход климата уже по id (`getConfig(siteId).location`); цикл — добавить явную запись
входов в раннер и передачу `run` в `collectData`. Строка 2260 — резолвер вместо «конфиг ИЛИ снимок».

### 10.6. Сторожа — по происхождению значения, не по месту и не по имени

**Переписано 17.09.2026 по находке ревьюера.** Первая редакция (и сторож `gh461`, написанный по ней) привязывала проверку к
**месту** (тела двух функций) и к **имени** (переменная `_inTurf`, «поле присвоено из резолвера хотя бы раз»). Две мутации,
возвращающие ровно ту утечку, ради которой слой I делается, оставили 7 из 8 тестов зелёными: чтение `GAIP_STATE.turf` для `hoc` и
`percentC3`, дописанное **после** резолверного блока (второе присваивание), и чтение вида травы, вынесенное в хелпер **строкой
выше** функции. Причины по коду теста: сканируются тела двух функций; исключение по `GAIP_STATE` выдано по форме (весь объект),
а не по назначению (результаты), и через него проходит идентичность; проверка перечня требует «хотя бы раз из резолвера» и не
запрещает второй раз из другого места. Это тот же механизм, что у сторожа GH-459 (вынос строкой выше), у `gh365`
(сопоставление по значению вместо структуры) и у сторожа стадии 1 (по имени переменной, не по происхождению) — четыре случая за
сутки, записано отдельным приёмом в 10.9.

Что слой I **гарантирует** — формулировка, из которой сторож следует: **ни одно значение, напечатанное документом о сайте X как
его идентичность или вход (вид I), не происходит из состояния страницы.** Происхождение проверяется двумя способами, оба
обязательны; regex по именам и телам функций остаётся только как дымовая проверка третьим номером.

1. **Динамический сторож — отравленная страница** (`tests/gh461-export-inputs-provenance.test.js`, jsdom, по образцу
   `bootWithServer` из gh377). Загружается реальный `word-export.js`. Состояние страницы заполняется **сентинелами сайта B** во
   всех известных формах: `GAIP_STATE.inputs.turf`, `GAIP_STATE.turf`, `GAIP_STATE.site/location`, `GAIP_CANONICAL_STATE.turf`,
   `GAIP_OVERSEED_STATE`, `GaipTurfProfile.state`, `SpeciesController.get*`, `GAIP_CLIMATE_V2_RESULT`, все `.gaip-*` поля и
   `#gaip-*` элементы, `window.climateMetrics` — каждое со значением вида `'SENTINEL-B-<field>'` или числом-маркером
   (`percentC3 = 99`, `hoc = 77`). `inputs` — объект резолвера для сайта A с отличными значениями. Утверждения: (а) `data.site` и
   `data.turf` **глубоко равны** объекту, построенному только из `inputs` (ожидаемый объект строится в тесте из `inputs`
   теми же чистыми производными — `isC4` из вида, `speciesDisplay` из ключа); (б) сериализованный `data` (весь объект, не только
   site/turf) **не содержит ни одного сентинела B** ни в одном ключе; (в) при `inputs` с `null` в поле результат — `null`/«Not
   specified», не сентинел и не умолчание-название. Мутации A и B ревьюера обе красные здесь, где бы ни стояло чтение и как бы
   ни называлась переменная: важно только, что попало в `data`. То же построение позже расширяется на вид II (сентинелы в
   результатах чужого прогона против `run.results` с отметкой) и на документ целиком (RC на текст 10.7(2): сентинелы-названия
   видов сайта B нигде, кроме библиографии).
2. **Статический сторож по потоку данных** (`@babel/parser` + `@babel/traverse` уже в devDependencies, ни один тест их не
   использует): по **всему** `word-export.js` и `word-export-combined.js`, не по телам функций. Для каждого присваивания с левой
   частью `data.site.*`, `data.turf.*`, `data.program.*` (и любого объекта, который потом кладётся в эти секции) строится
   происхождение правой части: допустимые корни — параметр `inputs` (и локальные привязки, чья собственная правая часть
   корнится в `inputs`), литералы, вызовы функций из именованного списка чистых производных (`resolveSpeciesKey`,
   `resolveSpeciesDisplay`, `isC4Species`). Любой другой корень — `window.*`, `document.*`, `GAIP_*`, `GaipTurfProfile`,
   `SpeciesController`, вызов функции, определённой в файле и не из списка (хелпер «строкой выше» разворачивается по своим
   `return`), — красный с указанием строки и цепочки. Второе присваивание того же поля из другого корня — красный (проверяется
   каждое присваивание, не «хотя бы одно»).
3. **Дымовой regex по всему файлу**, исключения по **назначению**, не по форме: `GAIP_STATE.mlsnResults|tissueResults|
   waterResults|climateMetrics|shadeMetrics|wearMetrics|fertility` разрешены поимённо как результаты (до слоя II) с причиной;
   `GAIP_STATE.turf`, `GAIP_STATE.inputs`, `GAIP_STATE.site`, `GAIP_STATE.location` запрещены **во всём файле**; элементы
   диалога экспорта (`gaip-logo-*`, `gaip-org-name`, `gaip-export-word`) — именованные исключения. Тест «исключение для формы,
   которой функция больше не читает, снимается» остаётся: он уже поймал устаревшие исключения по имени/локации и площади.
4. **Одна граница — один вызов.** `_buildEngineInputs()` сегодня зовёт `resolveExportInputs({})` отдельно (`:7056-7057`);
   объект резолвера передаётся из `collectData(inputs)` (`data._inputs`) и используется обоими — два вызова на одну пробу это два
   места, которые надо держать согласованными руками.
5. Каждая форма чтения из 10.5 посажена обратно по одной, плюс обе мутации ревьюера (второе присваивание после блока; хелпер
   строкой выше) — красный на каждой в сторожах 1 и 2 (правило 2.3 плана Q26). Мутации выбирает ревьюер.

Остальные сторожа раздела без изменений: `gh459-results-carry-a-stamp` (слой II), `gh459-late-cascade-does-not-land` (слой III);
`hoxton-combined-export-per-site-climate.test.js` поглощается сторожами 1–3.

**Дополнение 17.09.2026 по трём находкам ревьюера (замерено на `gh461-export-inputs-provenance` и `word-export-smoke`).**

Дыра между механизмами измерена: сентинел виден, только если утёкшее значение — строка из отравленного источника; невидимы
нестроковые значения, неотравленный источник и совпадение с верным. Список равенства перекрывал это на 9 полях из 25,
присваиваемых в `data.turf`; среди 16 непроверенных — `isC4`, `effectiveIsC4`, `useC3Targets`, три поля, выбирающие кривую
роста, то есть ровно то, чем дефект проявился у владельца (28 32 23 вместо 100 100 99). Две мутации проходят все четыре
проверки: чтение `isC4` из состояния страницы и чтение по id **страницы**, а не пробы. Решения:

- **Предложение ревьюера принято — сверка всех ключей, не ручной перечень — с одним уточнением, без которого оно
  неполно.** `data.turf` законно содержит поля, которых в резолвере нет: производные (`isC4`, `effectiveIsC4`, `useC3Targets`,
  `hasOverseed`, `overseedDominant`, `effectiveSpecies`, `effectiveVariety`, `speciesDisplay`, `warmBaseWithVariety`, метка
  `type` после `typeMap`/`subCatLabel`, `inputSources`, …). Поэтому правило: **каждый** ключ `Object.keys(data.turf)` либо есть в
  резолвере и равен ему, либо стоит в именованном списке производных **с функцией вывода только из объекта резолвера**, и
  тест вычисляет ожидаемое этой функцией и сверяет; ключ вне обоих списков — красный. Список производных — это перечисление
  (сегодня 16 имён), и его полнота утверждается самим тестом: `Object.keys(data.turf)` минус ключи резолвера минус список
  производных = пусто. Мутация «`isC4` со страницы» краснеет, потому что ожидаемое `isC4` считается из вида резолвера.
- **Правило отравления — каждое отравленное значение отличается от верного по типу или по значению**, не «строка-сентинел»:
  булевы инвертируются относительно верного, числа сдвигаются, строки — сентинел. И **страница активна на сайте B**: стаб
  `getActiveSiteId()` отдаёт B, стаб `getSiteConfig(B)` отдаёт отравленный конфиг B, а `collectData` получает `inputs` сайта A.
  Любое чтение «по id, но по id страницы» приносит B и краснеет на равенстве. Фикстуры A и B обязаны различаться в **каждом**
  поле, и тест это утверждает до прогона (совпадение хотя бы в одном поле — красный теста о самом себе): это закрывает
  «значение совпало с верным».
- **Сентинел проверяется на документе целиком, не только на `data`.** Отравленный прогон идёт через путь дымохода (10.10):
  `GAIP_WordExport.export()` на отравленной странице с `inputs` сайта A, и утверждается, что в `word/document.xml` нет ни
  одного сентинела B и нет ни одного значения B из фикстуры (включая нестроковые, приведённые к печатному виду). Это и есть
  RC на текст 10.7(2) в модульном исполнении, и оно закрывает **всё, что печатает документ**, включая построители разделов
  вне `collectData` — третья находка: чтение `construction` из `GAIP_STATE.turf` на `word-export.js:10769` внутри построителя,
  вне зоны сканирования обоих сторожей. Правило для построителей: раздел читает только `data`, никогда `window`; чтение на
  10769 переводится на `data.turf.construction` (в резолвере уже есть), а статический сторож 3 сканирует весь файл, как и
  записано, не тела двух функций.
- Статический механизм (сторож 2, поток данных по AST) остаётся обязательным: сверка ключей закрывает измеренную дыру одной
  правкой сегодня, а поток данных ловит чтение, которое динамический тест не отравил, потому что о нём не знал.

**Уточнение 17.09.2026 (срочное, до написания сторожа) — список производных, проверенный ревьюером по коду: три места,
где он стал бы укрытием.** Проверено мной по коду: `data.turf.c3Fraction` читается в `word-export.js` десять раз и не
присваивается нигде (другие модули считают свой локальный `c3Fraction`, в `data.turf` его не кладёт никто); `overseedVariety`
после резолверного присваивания (`:8026`) перезаписывается из `GAIP_CLIMATE_V2_RESULT` (`:8174`) и из DOM-списка (`:8181`).

1. **`overseedVariety`, `overseedVarietyDisplay` — не производные, а чтения страницы.** Место — в **резолвере**: `overseedVariety`
   там уже есть (из `turf.overseedVariety` конфига), присваивания `:8170-8183` удаляются; `overseedVarietyDisplay` резолвер
   отдаёт как чистый поиск отображаемого имени по ключу сорта в таблице сортов, которой пользуется сам выпадающий список
   (`cultivar-profile-ui.js` / данные сортов — разработчику найти источник таблицы и сослаться на него; если отображаемого
   имени в данных нет — отдаётся сам ключ и это записывается в 10.8 как вопрос, не решается). В список производных они не
   попадают: правило «функция вывода только из объекта резолвера» нарушилось бы первым же пунктом, и список дальше пополнялся
   бы по образцу.
2. **`overseedDominant`, `useC3Targets` и вывод подсева по доле покрова — производные от `c3Fraction`, которого нет.** Сегодня
   они всегда `false`; это давняя мёртвая ветка, не регрессия (ревьюер проверил копию до слоя I). Константа `false`, записанная
   как функция вывода, спрятала бы это ещё на год. Решение: в списке производных эти поля стоят с функцией `false` **и с
   явной пометкой `deadBranch: 'data.turf.c3Fraction is never assigned — 10.8(8)'`**, а тест **утверждает саму мёртвость**:
   `data.turf.c3Fraction === undefined` после `collectData()`. В день, когда кто-то присвоит `c3Fraction`, тест краснеет и
   заставляет переписать вывод — укрытие невозможно, потому что мёртвость утверждена, а не подразумевается. Что делать с
   веткой — связать `c3Fraction` с `percentC3`, который резолвер уже отдаёт (меняет числа клиента), или удалить ветки — вопрос
   владельца, записан как 10.8(8); ночью не меняется.
3. **Четыре поля с захардкоженными умолчаниями** (`'Perennial Ryegrass'`, `'generic'`, `'Not specified'`): функция вывода
   воспроизводит **то, что есть**, и каждая такая функция несёт пометку `awaits: '10.8(7)'` (объединённый вопрос о печати
   без вида травы). Тест утверждает две вещи: у каждой функции вывода с литералом-умолчанием пометка есть, и **множество
   литералов в функциях вывода равно множеству литералов-умолчаний в исходнике** `word-export.js` в этих присваиваниях — новое
   умолчание не добавляется молча ни в код, ни в тест. Вопрос 10.8(7) остаётся заморожен до владельца; тест его не решает,
   он его показывает.

Итог для списка производных: 16 имён → 14 (два уходят в резолвер), из них 3 с пометкой `deadBranch`, 4 с пометкой `awaits`;
полнота списка по-прежнему утверждается тестом (`Object.keys(data.turf)` − ключи резолвера − список = ∅).

**Уточнение 17.09.2026, второе (до реализации): оба утверждения — о значении в прогоне, не о тексте.** Ревьюер измерил обходы
текстовых проверок: мёртвость — резолвер начинает отдавать `c3Fraction`, и ветка оживает без единой строки присваивания в
`word-export.js`, либо присваивание в другом модуле на тот же общий `data`; множество литералов — умолчание выносится в
переменную выше по файлу, литерал есть, но не там, где смотрит сверка. Принято, оба переводятся на значение:

- **Мёртвость**: после `collectData(inputs)` в песочнице сторожа `data.turf.c3Fraction === undefined` — факт прогона, не
  паттерн. Оба обхода краснеют сами: резолверный ключ обязан попасть в `data.turf` по правилу сверки всех ключей, и значение
  перестанет быть `undefined`; чужой модуль, пишущий в общий `data`, даёт то же. Текстовый grep «нет присваивания» не пишется.
- **Умолчания**: не множество литералов в исходнике, а **значения при пустых входах**: `collectData(inputs)` с резолвером, у
  которого `species`, `variety`, `overseedVariety`, `coolOverseed` равны `null`, обязан дать в четырёх полях ровно
  задокументированные умолчания (функции вывода с пометкой `awaits: 10.8(7)`), и ни в одном другом поле — ни одного
  непустого значения, которого нет в `inputs`. Новое умолчание — литералом, переменной, из другого модуля — меняет значение
  поля при пустом входе или добавляет ключ, и краснеет на сверке всех ключей. Текстовая сверка множеств не пишется;
  grep остаётся только дымовым (сторож 3).
- **Последовательность замера**: базовые значения для обоих утверждений снимаются **после** переноса `overseedVariety` и
  `overseedVarietyDisplay` в резолвер (у одного из них останется умолчание и оно станет производным) — иначе замер по
  старому состоянию. Замер ревьюера по нынешнему коду (умолчаний через переменную нет, семь прямых литералов, три значения;
  `c3Fraction` не присваивается нигде) — точка отсчёта, не ожидание теста.

**Уточнение 17.09.2026, третье — три дыры статического механизма (сторож 2), измерены мутациями ревьюера.** Что сохранить
как есть: список непрослеженных корней пуст в обоих файлах и это проверено не пустой константой; проверка устаревших
исключений живая; разбор по корню аргумента ловит чтение по чужому идентификатору — это ядро механизма, не трогать.

1. **Исключение — по позиции, не по подстроке.** Один якорь общего вида (`window.GAIP_STATE && window.GAIP_STATE.turf`)
   содержится в любом чтении из этого корня: второе чтение того же поля обычной идиомой поглощается (6/6 зелёных), той же
   утечкой другой идиомой — красное. Подстрока общего вида — то же исключение по форме, от которого уходили. Устройство:
   исключение = `{ file, function, lhs, rhs: <полный текст правой части выражения по AST, с нормализованными пробелами>, why }`;
   совпадение — равенство узла, не вхождение подстроки. Второе чтение с тем же корнем и другой правой частью не совпадает ни с
   чем и краснеет. Номер строки как якорь не использовать — он сдвигается при любой правке выше; полный текст правой части
   стабилен и читается человеком. Исключения существуют только для вида II (результаты до слоя II) и элементов диалога;
   их число печатается и **храповиком** утверждается не больше записанного в тесте — список может только сокращаться.
2. **Чистота — свойство, не имя.** Список из пятнадцати имён не проверял тела: функция с разрешённым именем, читающая
   состояние страницы, прошла (6/6); шесть имён из пятнадцати не существуют ни в одном из файлов — пропуск выдан наперёд
   тому, кто их напишет. Устройство: **проектных имён в списке нет вовсе**. Вызов в правой части разбирается по свойству:
   если функция объявлена в сканируемом файле — её тело разворачивается (корни всех `return`, с защитой от циклов), и
   требование то же — ни одного корня в состоянии страницы; если функция из другого модуля проекта (`SpeciesController.*`,
   `resolveSpeciesKey`) — этот модуль добавляется в сканируемые, и тело функции проверяется там же (`species-controller.js:395`
   читает `GAIP_OVERSEED_STATE` — такая функция страничный корень, а не чистая, и это выяснится разбором, не доверием).
   Единственный список — **встроенные языка** (`parseFloat`, `Number`, `String`, `Math.*`, `Object.freeze`, `Array.isArray`,
   `JSON.*`), они не объявлены нигде и не могут читать страницу. Сканируемые файлы: `word-export.js`, `word-export-combined.js`,
   `nutrition-program-inputs.js` (резолвер — его чистота и есть свойство слоя I), плюс каждый модуль, чью функцию вызывает
   правая часть.
3. **Область — весь `data`, не три контейнера.** Раздел Variety Traits пишет в свой контейнер из страничного глобала без
   отметки сайта; контейнер не сканировался, поэтому не был ни в исключениях, ни в непрослеженных корнях. Устройство: левая
   часть — любое `data.<x>.<y> =` и `data.<x> =` в сканируемых файлах, а также локальные объекты, которые потоком попадают в
   `data` (AST это уже ведёт); контейнеры вида II исключаются по позиции (п. 1) до слоя II. Динамическая половина — сентинел
   на `word/document.xml` целиком — уже покрывает этот раздел; статическая должна смотреть туда же, куда печатает документ.
4. **Седьмая мутация — новый ключ резолвера при пустых входах.** Механизм обязан краснеть на появлении ключа, а не только на
   смене значения. Устройство: форма объекта резолвера пинится **именованным перечнем ключей** по секциям (`site`, `turf`,
   `program`, `samples`, `sources`), и тест утверждает `Object.keys(inputs.<секция>)` равным перечню при любых входах,
   включая пустые; новый ключ в резолвере — красный, пока не записан в перечень вместе с тем, что он отдаёт при пустом входе.
   Это та же сверка перечисления, что для `data.turf`, только на входе границы, а не на выходе.

**Уточнение 17.09.2026, четвёртое — две находки до реализации.**

1. **Судить метод, не модуль.** Мой пример с `SpeciesController` не подтвердился: экспорт вызывает из модуля ровно один метод —
   проверку тёплосезонности по явно переданному виду — и он чист; методы, читающие страницу, экспортом не вызываются.
   Исключение под модуль не пишется. Важнее экземпляра ловушка, которую он открывал: если правило «чужой модуль проверяется
   в своём файле» судит модуль целиком, честный метод попадает в находки из-за соседа с кэшем, и естественной реакцией
   становится исключение на весь модуль — дыра шире прежней. Устройство: единица проверки — **вызываемый метод**: разбор
   тела именно той функции, которую вызывает правая часть, по её объявлению в её файле; соседние методы модуля не
   рассматриваются и в вердикт не входят. Исключение, если оно когда-либо понадобится, тоже выдаётся на метод с полным
   текстом вызова (п. 1 третьего уточнения), никогда на модуль или файл.
2. **Храповик пинит поверхность, не число.** Пять обходов, каждый уменьшает счётчик: слить два исключения в одно с якорем
   шире; убрать корень из перечня состояний страницы; сузить сканируемую поверхность (поле из перечня идентичности, файл из
   списка); перенести чтение в непрослеженные, которых храповик не считает; перенести чтение за границу сканирования.
   Формулировка ревьюера верна: показатель улучшается ровно за счёт того, что перестал измеряться. Устройство: храповик
   утверждает **всю поверхность** как записанное значение, а не «не больше»: (а) список исключений — по полному тексту
   каждого, не длина; (б) список непрослеженных корней — пустой и утверждённый пустым; (в) множество корней состояния страницы
   — по именам; (г) множество полей идентичности и перечень ключей резолвера — по именам; (д) список сканируемых файлов —
   по именам, и он утверждается равным списку, который сам тест выводит из `reports/export.blade.php` (правило 10.10) плюс
   модули вызываемых методов. Любое изменение любого из пяти — расширение или сужение — красный с diff, и требует той же
   явной правки теста с причиной, что и новое исключение. Честное сокращение (чтение перенесено в резолвер, исключение
   удалено) — правка списка (а) с записью «перенесено в резолвер, GH-NNN» и зелёный храповик после неё: контрольная мутация
   ревьюера. Шесть мутаций — по одной на обход плюс контрольная — входят в RC сторожа.
   **Поправка к (д), 17.09, по замечанию ревьюера (случай не живой — в идентичность пишут ровно два файла, третьего нет; это
   будущий маршрут).** Закреплённый список файлов ловит сужение, но не третьего писателя: файл вне списка начинает писать
   идентичность — все пять значений те же, храповик зелёный. Принято его предложение, оно того же рода, что решение по
   умолчаниям: не фиксировать запись о состоянии, а утверждать состояние. Список сканируемых файлов **не пинится, а
   выводится**: сторож проходит все `assets/*.js` и собирает файлы, где есть присваивание в объект документа — левая часть
   `data.<контейнер>.<поле>` или `<x>.data.<контейнер>.<поле>` с полем из перечня идентичности, — и утверждает, что множество
   таких файлов равно множеству сканируемых; третий писатель краснеет сам, без решения о расширении поверхности. Мутация
   ревьюера — чтение идентичности перенесено в третий файл на пути экспорта, списки не тронуты — обязана быть красной.
   Предел — конкретным примером, не абстракцией (замер ревьюера 17.09): `assets/export-metadata.js` подменяет `collectData`
   обёрткой, держит объект документа и дописывает в него свои метаданные — третий держатель объекта вне обоих сканируемых
   файлов. Идентичность он не трогает, утечки нет, и выводимое множество писателей его правильно не включает. Край: если такая
   обёртка начнёт **строить** свой объект документа вместо дописывания в чужой, присваиваний в идентичность у неё не будет и
   статический вывод её не увидит вовсе — ловит только динамическая половина, сентинел на `word/document.xml` целиком.
   Поэтому обе половины обязательны, и ни одна не заменяет другую. Живых писателей идентичности по любому имени получателя в
   `assets` сегодня нет — все найденные пишут в состояние страницы; предел реален, через него ничего не течёт. Тот же пример
   пишется в комментарий сторожа. Пункт (д) в списке поверхности остаётся, но как выведенное значение, а не записанное.

**Уточнение 17.09.2026, пятое — по замерам ревьюера (фолбэк, проверка пустых входов, текстовые якоря). Все три — способ,
не случай.** Проверено по коду: единственный вызов `_buildEngineInputs(data, inputs)` — `word-export.js:10087`, фолбэк —
`:7066-7067`; в `hoxton-combined-export-per-site-climate.test.js` из пяти тестов с якорем `function _buildEngineInputs(data`
проверку «якорь найден» имеет один (`:85`), четыре (`:92`, `:99`, `:118`, `:130`) режут по ненайденному; в 31 файле тестов есть
якоря по `indexOf('function …`, в четырёх из них нет ни одной проверки нахождения.

1. **Фолбэк `inputs || resolveExportInputs({})` — удалить.** Замер: замена на бросок исключения — 2668 зелёных и живая выгрузка
   цела; по коду `collectData` всегда передаёт `inputs` вторым аргументом, а при незагруженном модуле входов `resolveExportInputs`
   недоступен и фолбэк вернул бы тот же `null`. Ветка не может дать другого ответа. Хуже: если бы могла — при вызове без
   `inputs` она резолвит **по активному сайту страницы**, то есть это и есть путь утечки под видом страховки. Что означает
   ветка, если её оставить: «вызывающий забыл передать входы — подставим сайт страницы». Такого смысла у слоя I нет.
   Устройство: `_buildEngineInputs(data, inputs)` при `!inputs` — жёсткий отказ по существующему правилу (`data.engineInputs =
   null`, `data.nutritionInputsUnavailable = true`, `console.error` с текстом «inputs not passed — refusing to resolve by page
   site»); дымоход (ноль `console.error`) делает такой вызов видимым. RC: вызов без второго аргумента → красный дымоход.
2. **Проверка пустых входов — два класса.** (а) «Пусто» ≠ «ложь»: обходчик считает пустыми `''`, `null`, `undefined`, `false`,
   `0`, `[]`, и утечка в булево поле кривой (`isC4`, `effectiveIsC4`, `useC3Targets`, на сайте без вида все три законно
   `false`) по значению неотличима от правды. Устройство: «пусто» — только `null`/`undefined`; `false`, `0`, `''`, `[]` —
   значения, и каждое поле сверяется с ожидаемым, посчитанным функцией вывода из пустых `inputs`. Различимость даёт **не
   сама сверка, а отравление**: проверка пустых входов выполняется на **отравленной странице** (правило второго уточнения:
   булевы страницы инвертированы относительно правды, числа сдвинуты), а не на нейтральной — тогда утечка, севшая на
   булево, приносит `true` там, где правда `false`, и краснеет. Мутация `data.climate.leakedFlag = false` при этом краснеет
   на сверке всех ключей (неизвестный ключ), а `isC4` со страницы — на значении. (б) Одеяла по префиксу (`turf.inputSources.`,
   `soil.thresholds.`, `tissue.ranges.`, `water.thresholds.`) — та же форма исключения, от которой уходили: извиняют все листья
   под путём, посаженная непустая строка прошла. Устройство: одеял нет. `turf.inputSources` глубоко равен `inputs.sources`;
   таблицы порогов и диапазонов глубоко равны тому, что отдал резолвер/адаптер по id (`aaRanges`, диапазоны ткани из
   `tissue-engine.js` по виду из резолвера) — целиком, как значение, а не «что угодно под путём». Лист, которого нет в
   ожидаемой таблице, — красный.
3. **Текстовый сторож с ненайденным якорем обязан падать, не проверять пустоту.** Замер: в `gh299-aa-ceiling-consumers` якорь со
   скобкой не находился, `slice(-1, …)` давал пустую строку, три `not.toMatch` проходили на ней всегда — сторож умер молча при
   смене сигнатуры, и упасть не мог (в текущем дереве `:161-162` уже с проверкой — по коду видно, что поправлено; четыре
   теста в `hoxton-combined-…` — нет). Общее требование ко **всем** текстовым сторожам, в такой форме: (а) один хелпер
   `anchoredSlice(src, startAnchor, endAnchor)` в `tests/lib/`, который бросает, если любой якорь не найден или вырезанное
   тело пусто, и все 31 файл переводятся на него; (б) механический сигнал в части 0 плана Q26: `indexOf('function …` или
   `.slice(` по исходнику без предшествующего утверждения о нахождении — кандидат класса A («утверждение на пустой строке»);
   (в) правило: смена сигнатуры функции — событие для всех текстовых сторожей с этим якорем, и хелпер делает его красным
   везде сразу, а не только там, где кто-то заметил. Добавлено в план Q26 (раздел 5, п. 9; раздел 1.1).

**Уточнение 17.09.2026, шестое — три способа обойти сторож потока данных (`gh461-export-identity-dataflow.test.js`),
замерены ревьюером, проверены по коду.** `rootsOf` (`:212-215`) при `depth > 12` возвращает `[]`; `mutable` (`:462-474`)
собирается из `let`/`var`, объявлений без инициализатора, присваиваний в идентификатор и инкрементов — присваивание в член
не записывается; исключение (`:634`) сверяется по файлу, функции и тексту правой части, корни в сверку не входят;
`SpeciesController` числится в `PAGE_STATE_ROOTS` (`:102`, `:720`).

1. **Модульное состояние — любой контейнер, в чьё свойство где-либо присваивают.** Третья форма после `let` и `this._cache`:
   `const _idCache = {}` с наполнением `_idCache.species = …` разворачивается в пустой литерал и читается как чистое (19/19
   зелёных). Устройство: идентификатор считается изменяемым, если он — корень **любой** левой части в модуле (идентификатор
   или цепочка членов `a.b.c =`, `a[k] =`), аргумент `++`/`--`, первый аргумент `Object.assign`, приёмник мутирующих
   встроенных на идентификаторе (`.push`, `.set`, `delete a.b`). Корень такого идентификатора — сам модуль, как уже сделано
   для `let`. Мутация ревьюера в RC; контрольная: `const` с литералом, в свойства которого никто не пишет, остаётся чистым.
2. **Исчерпание глубины — пометка «не прослежено», не пустота.** `[]` при `depth > 12` читается как «корней нет», и цепочка из
   пятнадцати локальных проходит в чистое ведро; закреплённая пустота `untraceable` её не видит, потому что находка туда не
   попадает, а пять поверхностей не меняются — предел не список. Устройство: по исчерпании глубины `rootsOf` возвращает
   маркер `'<depth-exhausted>'`, который не входит ни в `inputs`, ни в `BENIGN_ROOTS`, ни в `PAGE_STATE_ROOTS`, — находка
   ложится в `unresolved`, и закреплённая пустота непрослеженных краснеет сама, отдельного правила не нужно. Цепочка,
   которой глубина честно нужна, — повод поднять предел явной правкой теста с причиной, не повод молчать. Что не сработало
   у ревьюера (сужение `IDENTITY_TARGETS`, поле вне `IDENTITY_FIELDS`, `GAIP_STATE` в `ALLOWED_ROOTS`) — записано: три
   незакреплённых списка ловятся вторым путём записи; закреплять их всё равно (второе уточнение, храповик поверхности).
3. **Исключение — по корням, не только по тексту.** Перепривязка `phyto` к `GAIP_STATE` при неизменном `phyto.species`
   оставляет четыре координаты теми же, исключение продолжает действовать, его пояснение стало ложным (19/19). Устройство:
   пятая координата — **корни правой части, как их посчитал разбор** (`roots`, множество имён); сверка требует равенства
   множеств. У нынешнего исключения это `GAIP_PHYTOTOXICITY_RESULT`; после перепривязки корень — `GAIP_STATE`, координаты
   расходятся, покрытие снимается. То же решение, что для позиции узла (третье уточнение, п. 1), применённое к содержанию.
   Дополнительно: имя корня, названное в `why`, обязано входить в `roots` — пояснение, расходящееся с фактом, красное.
4. **Наблюдение ревьюера — чинить.** Разбор вызываемого метода (четвёртое уточнение, п. 1) для `SpeciesController` до тела
   не доходит: модуль в `PAGE_STATE_ROOTS`, вызов помечается раньше; честно чистый `SpeciesController.normalize(_inTurf.species)`
   краснеет корнем модуля. Ошибка в безопасную сторону, но именно она открывает ловушку четвёртого уточнения: исключение на
   чистый метод, потом на модуль. Устройство: для вызова на корне из `PAGE_STATE_ROOTS` читатель **сначала** разрешает вызываемый
   метод по его объявлению в его файле и судит тело; корнем модуля вызов помечается только если метод не разрешён. RC обе
   стороны: `SpeciesController.normalize(_inTurf.species)` — зелёный; `SpeciesController.getEffectiveSpecies()` — красный,
   потому что его тело читает `GAIP_OVERSEED_STATE` (`species-controller.js:395`).

Сеня берёт пятое и шестое уточнения одним заданием; мутации ко всем пунктам выбирает ревьюер.

**Уточнение 17.09.2026, седьмое — первый пункт живой дефект у клиента, остальные — устройство проверок.** Проверено по коду:
`word-export-combined.js:704` — `we.collectData()` без аргумента при `entry.siteId` в руках цикла (`:660` им переключает
активный сайт); `word-export.js:15073` — одиночный экспорт, тоже без аргумента; `nutrition-program-inputs.js:876`
(`resolveExportInputs`) и `:661` (`resolveSiteProgramInputs`) — `const siteId = opts.siteId || getActiveSiteId()`; две
обёртки подменяют `collectData` — `export-metadata.js` и `word-export-scenario-patch.js:290`.

1. **Личность документа — только идентификатор сайта пробы, переданный явно; указатель страницы не участвует.** Живой замер
   ревьюера: указатель на крайстчёрчский сайт во время выгрузки пробы Test5 — «Species: Couch», семь вхождений чужого вида,
   таблица программы питания отсутствует целиком; отказа нет, входы пришли, но чужие. Отказ пятого уточнения закрывает
   «входов нет», не «входы не те». Одной строки (`we.collectData(entry.siteId)`) недостаточно как способа: она чинит один
   вызов и оставляет фолбэк, через который любой следующий вызов без аргумента снова возьмёт указатель. Устройство:
   - `resolveExportInputs(opts)` и `resolveSiteProgramInputs(opts)` **требуют `siteId`** и бросают при его отсутствии; строки
     `opts.siteId || getActiveSiteId()` (`:876`, `:661`) удаляются. Внутри резолвера `getActiveSiteId()` не вызывается вовсе —
     сторож потока данных пинит это как корень, запрещённый в `nutrition-program-inputs.js`.
   - Комбинированный цикл строит `inputs = resolveExportInputs({ siteId: entry.siteId, soilSampleId: entry.sampleId,
     tissueSampleId: entry.tissueSampleId, waterSampleId: entry.waterSampleId })` и зовёт `we.collectData(inputs)`;
     `sm.setActiveSite(entry.siteId)` (`:660`) остаётся только для раннера (слой II, явная запись входов), к личности
     документа отношения больше не имеет.
   - Одиночный экспорт (`exportToWord`, `:15073`) — единственное место, где активный сайт страницы и есть сайт документа:
     он берёт `getActiveSiteId()` **там**, явно, и передаёт `resolveExportInputs({ siteId, … })` → `collectData(inputs)`.
   - `collectData` без `inputs` — жёсткий отказ (пятое уточнение, п. 1), не резолв.
   - Обёртки `export-metadata.js` и `word-export-scenario-patch.js:290` пропускают аргумент насквозь (`function (inputs) {
     var data = orig(inputs); … }`); сторож проверяет, что каждая подмена `collectData` в `assets` передаёт свой первый
     аргумент дальше — иначе обёртка молча превращает вызов с аргументом в вызов без.
   - Проверка: живой сценарий ревьюера становится постоянным — S7 «указатель страницы на сайте B, выгрузка пробы сайта A»
     (обычная загрузка, парный чистый контекст), документ — A по имени, виду, таблице программы; jsdom-вариант в дымоходе
     (10.10): `GAIP_SampleManager.getActiveSiteId()` отдаёт B, `inputs` для A — документ A. RC: вернуть фолбэк в резолвер —
     красный.
2. **Отравление прокси, не списком ключей.** Шесть объектов с фиксированным списком ключей: чтение из ключа вне списка даёт
   `undefined`, обходчик считает это пустотой, чтение неотличимо от отсутствия (`GAIP_STATE.mlsnResults.speciesName` — 26/26
   зелёных; контрольные из отравляемого ключа и из `GAIP_HUB_CONFIG` — красные). Это ровно ключи результатов слоя II, и в
   браузере они несут значения предыдущего сайта. Устройство: каждый корень состояния страницы — `Proxy`, отвечающий на
   **любое** свойство сентинелом, собранным из пути (`SENTINEL-B-GAIP_STATE.mlsnResults.speciesName`), и на вложенное
   обращение — новым прокси с удлинённым путём; исключения только для служебных свойств, которые сделали бы объект
   thenable или сломали сериализацию (`then`, символы, `constructor`, `toJSON`), для них `undefined`; `toString`/`valueOf`
   возвращают сентинел, чтобы конкатенация тоже его несла; для полей, чей верный тип булев или числовой, правило второго
   уточнения (инверсия, сдвиг) применяется поверх прокси там, где тест знает тип. Покрытие отравления совпадает с тем, о чём
   проверка заявляет; список ключей больше не поддерживается руками.
3. **Локальные — по области видимости, не плоской картой на файл** (находка разработчика). Две функции с одноимённой локальной
   перетирают друг друга, цепочка уходит в чужое тело — и ложный красный, и ложный зелёный. Устройство: читатель разрешает
   идентификатор через `path.scope.getBinding(name)` `@babel/traverse` — привязку той области, где стоит выражение, — а не по
   имени в карте файла; модульное состояние по-прежнему судится по правилу шестого уточнения, п. 1. RC: две функции с одной
   локальной, читает страницу одна — красна только она.
4. **Замечание про `anchoredSlice` — принято без придуманной доли.** Усечение общим конечным якорем видно только сравнением
   длин (`extractFromSoilData` — 1140 из 1312). Число «половина блока» — придуманный порог, его не пишем. Устройство: хелпер
   находит конец функции по балансу скобок от начального якоря; без конечного якоря отдаёт тело целиком — это режим по
   умолчанию для сторожей на тело функции; с конечным якорем требует, чтобы якорь встречался в теле **ровно один раз**
   (ноль или больше одного — бросок), и печатает долю вырезанного от тела в сообщении об ошибке. Усечение однозначным
   ранним якорем — выбор автора теста, и он виден в коде теста.

Все четыре — в то же задание Сени, что пятое и шестое; мутации выбирает ревьюер.

**Уточнение 17.09.2026, восьмое — два живых дефекта и одно свойство проверки.** Проверено по коду: `sample-manager.js:2443-2446`
`setActiveSite()` при неизвестном сайте пишет `warn` и возвращает `false`, указатель не меняя; `word-export-combined.js:660`
возврат не читает; `:2146-2154` — `_facilityCalendarInputs = GilbaNutritionCalendar.collectFromState()` (снимок скрытого
раннера, «whichever site restored first» по собственному комментарию), `:2235` — `perSampleInputs = Object.assign({},
_facilityCalendarInputs)`, дальше переопределяются поимённо семнадцать полей (`:2318-2458`); `isC4` среди них нет.
`nutrition-program-inputs.js:562` — `siteId === getActiveSiteId()` против `GAIP_SITE_CONFIG`, который вписан сервером при
загрузке (`plan.blade.php:28`, `analysis.blade.php:13`) и внутри страницы не меняется; `getActiveSiteId()` (`:532-541`) —
живой указатель `SampleManager`, за ним `GAIP_HUB_CONFIG.activeSiteId`, который правится на лету (`site-setup-wizard.js:1241`,
`account-init.js:340`).

1. **Кривая — та же форма, что отвергнута в 10.3: копия общестраничного снимка плюс переопределение по списку.** Личность
   закрыта седьмым уточнением, а `perSampleInputs.isC4` не переопределяется ни разу и держит снимок раннера; спусковой крючок
   достижим — молчаливый ранний выход `setActiveSite` (GP 28 32 23 … при верных имени и виде). Комментарий над `:2235` сам
   говорит «every programme-level field is OVERWRITTEN per sample» — и это перечень, в котором дыра. Две строки ревьюера
   нужны, но как следствия, не как способ. Устройство:
   - `perSampleInputs` **строится из резолвера сайта пробы, не копируется из снимка**: `NutritionCalendar.inputsForSite(inputs)`
     (в `nutrition-calendar.js` рядом с `collectFromState()`, или в адаптере) собирает **полный** объект входов календаря из
     `resolveExportInputs({ siteId: r.siteId, … })` — вид, `isC4` из вида, полушарие и широта из координат сайта, методология,
     текстура, CEC, pH, программа, распределение, месячные температуры по координатам сайта; `_facilityCalendarInputs` в
     комбинированном экспорте не используется вовсе. `collectFromState()` остаётся Plan-странице, которая и есть страница
     своего сайта.
   - **Перечисление формы**: набор ключей входов календаря пинится в самом календаре (`CALENDAR_INPUT_KEYS`, экспортируется), и
     комбинированный экспорт утверждает `Object.keys(perSampleInputs)` равным ему; сторож — что каждый ключ в `inputsForSite`
     получает значение из `inputs` или чистой производной (тот же механизм, что для `data.turf`). Сколько ещё полей держали
     снимок тем же образом — не гадать: разработчик выписывает `Object.keys(collectFromState())` минус семнадцать
     переопределяемых, разница идёт в реестр как список закрытых этим пунктом; `isC4` — единственное измеренное.
   - Возврат `setActiveSite(entry.siteId)` проверяется; `false` → проба пропускается с предупреждением, как при отсутствии
     `annualN` (`_perSampleProgSkip`). После слоя II это же покрывает отметка прогона (результат с чужим `siteId` → раздел
     опущен), но до него и для читаемости — явно.
   - Проверка: живой сценарий ревьюера — постоянный S8 «переключение отклонено, проба сайта A»: имя, вид **и кривая** A (GP
     100 100 99 …), парный чистый контекст; jsdom: `setActiveSite` возвращает `false` → документ A или пропуск с
     предупреждением, никогда кривая B. RC: убрать `isC4` из `inputsForSite` — красный на перечислении; вернуть
     `Object.assign({}, _facilityCalendarInputs)` — красный на сторожe потока (корень `collectFromState` → `window`).
2. **Инжектированный конфиг отвечает за свой сайт по собственной отметке, не по живому указателю.** `getSiteConfig(:562)`
   сравнивает спрошенный id с указателем, а отдаёт объект, вписанный при отрисовке; равенство истинно, конфиг описывает
   третий сайт. На `/reports/export` ветка мертва (там `GAIP_SITE_CONFIG` не вписывается), на `/plan` жива. Устройство — та же
   идея, что отметка прогона: **объект несёт id сайта, для которого он вписан**. Сервер кладёт рядом с `GAIP_SITE_CONFIG`
   неизменяемый `GAIP_SITE_CONFIG_SITE_ID` (или поле `_siteId` внутри объекта, `Object.freeze`) — в `plan.blade.php:28`,
   `analysis.blade.php:13` и везде, где конфиг вписывается; `getSiteConfig(siteId)` отдаёт его только при `siteId ===
   GAIP_SITE_CONFIG_SITE_ID`. Ни `getActiveSiteId()`, ни `GAIP_HUB_CONFIG.activeSiteId` (он правится на лету) в сравнении не
   участвуют; комментарий «this is a COMPARISON, not a substitution» становится правдой. RC (jsdom): указатель сдвинут после
   загрузки, спрошен id указателя → `null`, не чужой конфиг; спрошен id отрисовки → конфиг. `readPlanForm` (`:624`) — без
   изменений, ветка `!siteId` недостижима после седьмого уточнения.
3. **`ownKeys` прокси — свойство, не дыра, пока стоит второй механизм; сделать его не единственной защитой.** Копирование
   перебором (`Object.keys`) в песочнице ничего не копирует, потому что прокси отдаёт пустой `ownKeys`; мутацию поймал
   статический сторож (корень `window`). Устройство: прокси отдаёт в `ownKeys`/`getOwnPropertyDescriptor` **ключи реальной формы**
   каждого результата — снятые один раз с живого прогона в фикстуру форм (`tests/fixtures/page-state-shapes.json`: ключи
   `GAIP_STATE.mlsnResults`, `tissueResults`, `waterResults`, `shadeMetrics`, `wearMetrics`, `fertility`, `climateMetrics`,
   `GAIP_STATE.turf`, …), значения — сентинелы из пути. Тогда перебор копирует сентинелы, и динамическая половина ловит его сама;
   перебор по форме, которой в фикстуре нет, остаётся статической половине — это записано как предел, а не подразумевается.
   Фикстура форм — перечисление, её полнота сверяется со списком корней состояния страницы (пятая поверхность храповика).

Все три — в то же задание Сени; мутации выбирает ревьюер.

**Уточнение 17.09.2026, девятое — по вердикту ревьюера на восьмое.** Проверено по коду: `word-export-combined.js:2256` зовёт
`inputsForSite(r.data._exportInputs, _siteInputs, {…})`, `var _siteInputs = null` объявлена на `:2284`, разрешение — `:2287`,
второй проход `perSampleInputs.<поле> = _siteInputs.<поле>` — `:2350-2398`; `annualNBase` в этом списке отсутствует, а
`nutrition-calendar.js:673` берёт его из `prog.annualNBase`, то есть при пустом `prog` — `null`. `resolveExportInputs` уже
содержит `program = resolveSiteProgramInputs(…)` внутри себя. Парити-харнесс перехватывает `computeProgram` и снимает
`inputs` **в момент вызова** (`ui-vs-export-parity.test.js:565-575`) — то есть после второго прохода — и сравнивает
четырнадцать именованных полей, `annualNBase` среди них нет. `GAIP_STATE` — геттер (`gilba-hub-v2.js:1393-1420`): отдаёт
`{inputs, computed, derived, turf, lastComputed, computeSequence}` **плюс последний объект, записанный сеттером** (`t`);
`hub-tissue-v3.js:7128-7180` пишет `window.GAIP_STATE = { …, climateMetrics, shadeMetrics, wearMetrics, mlsnResults,
tissueResults, waterResults, fertiliserIndex, sprayContext, … }`.

1. **Сборка снова стала «пустой объект плюс список» — из-за порядка объявлений; устройство, при котором порядок не может
   этого сделать.** Способ — не «перенести объявление выше»: пока у сборки два источника и второй проход существует, любое
   новое поле надо не забыть внести, и это тот механизм, от которого уходили. Устройство:
   - **Один аргумент.** `inputsForSite(inputs)` принимает только объект `resolveExportInputs` — в нём уже есть `program`
     (`resolveSiteProgramInputs` внутри резолвера), `samples` (значения проб по id) и `climateNormals` (по координатам сайта).
     Второй и третий аргументы исчезают вместе с `_siteInputs` в комбинированном экспорте: отдельного вызова
     `resolveSiteProgramInputs` на `:2287` нет, нечего объявлять не в том порядке.
   - **Объект заморожен.** `inputsForSite` возвращает `Object.freeze(...)`; второй проход невозможен по построению — в
     strict mode присваивание в замороженный объект бросает, и дымоход (ноль `console.error`, документ собран) краснеет.
     Список `:2350-2398` удаляется целиком; сторож утверждает ноль присваиваний `perSampleInputs.<x> =` в
     `word-export-combined.js` после конструирования.
   - **Перечисление — на выходе и по источнику.** `CALENDAR_INPUT_KEYS` (восьмое уточнение) пополняется `annualNBase`;
     для каждого ключа `inputsForSite` записывает, из какого поля `inputs` он взят, в `inputs.sources`-подобную карту
     `calendarSources`, и тест сверяет её с перечнем — ключ без источника красный.
   - Ошибку разработчика (переменная объявлена ниже вызова) поймал бы **любой** тест, выполняющий сборку с реальным
     резолвером и утверждающий отсутствие `null` (п. 2); такого теста не было — это и есть класс A/B из плана Q26, форма
     верна, содержание нет.
2. **Почему 24 пустых поля из 35 прошли парити 23/23, живой набор 9/9 и jest 2729/0 — объяснение из устройства и
   требование.** Объяснение: (а) парити снимает входы календаря **при вызове `computeProgram`**, а второй проход к этому
   моменту уже дописал ровно те поля, которые парити сравнивает; пустота существовала только между сборкой и дописыванием;
   (б) сравниваются четырнадцать полей, не форма целиком — `annualNBase`, `monthlyTempsPeriod`, `inputSources`, `overseedConfig`
   и остальные не сравниваются никогда; (в) пин из 35 имён проверяет форму, а `null` — законное значение формы. Требование,
   при котором такое состояние красное:
   - **Юнит без страницы**: `inputsForSite(resolveExportInputs(...))` на полной фикстуре (сайт с конфигом, тремя пробами и
     нормалями) — **ни одно поле, у которого `sources[поле] !== 'unresolved'`, не `null`**. Источник истины о том, что поле
     «приходит от сайта», — карта `sources`, которую резолвер уже ведёт; отдельного списка не заводить.
   - **Парити — форма целиком, продукт против продукта**: перехваченный при `computeProgram` объект сравнивается по **всем**
     ключам `CALENDAR_INPUT_KEYS` с объектом, который харнесс сам строит на странице тем же адаптером
     (`resolveExportInputs({siteId}) → inputsForSite`) для сайта пробы — не с четырнадцатью именами и не с фикстурой. Расхождение
     в любом ключе, включая `null` против значения, — красное с именем ключа.
   - **Заморозка** (п. 1) переводит второй проход из «невидимого» в «падающий»: мутация ревьюера «дописать поле после
     сборки» красна на дымоходе.
3. **Адреса шести контейнеров — по замеру, и что из него следует.** Верхние ключи `GAIP_STATE`: `inputs`, `computed`,
   `derived`, `turf`, `lastComputed`, `computeSequence`, `sprayContext`; под `computed`: `climate`, `dew`, `shade`, `salinity`,
   `stress`, `tissue`, `disease`, `wear`, `irrigation`, `pgr`, `stressTrajectory`, `preEmergent`, `forecast`, `confidence`.
   Имён `mlsnResults`, `tissueResults`, `waterResults`, `shadeMetrics`, `wearMetrics`, `fertility` в 33 снимках нет ни на
   верхнем уровне, ни под `computed`. Прежний текст плана (слой II, 10.5) и восьмое уточнение, п. 3, называли эти шесть как
   адреса результатов — **неверно**, исправлено здесь: результаты живут в `GAIP_STATE.computed.<модуль>` (канонический
   стор) и — по коду — в объекте последней легаси-записи `t`, который геттер подмешивает к ответу. Что из этого следует:
   - **Ветки не мертвы по построению.** `GAIP_STATE.mlsnResults` читает `t.mlsnResults`, а `t` — объект из `hub-tissue-v3.js`,
     где `mlsnResults: l`. Отсутствие ключа в снимке значит либо что снимок снят до этой записи, либо что `l` был
     `undefined` в момент записи (`JSON.stringify` такой ключ опускает), либо что снимок брался с канонического стора, а не
     через геттер. Какое из трёх — **нужен отдельный живой замер**, а не вывод: во время сборки документа читать
     `window.GAIP_STATE.mlsnResults`, `.tissueResults`, `.waterResults`, `.fertility` напрямую через геттер и печатать тип;
     в очередь ревьюеру. Разделы, которые эти четыре чтения наполняют (`word-export.js:8371`, `9017`, `9167`, `9654`), до
     замера считаются **неустановленными по источнику**, не мёртвыми и не живыми.
   - **Слой II от адресов не зависит** — это и есть причина, по которой он спроектирован через событие: `run.results`
     собирает оркестратор из стора в момент завершения (`computed.*`) плюс легаси-запись `t`, если она сделана до
     `gaip:analysis-complete`; экспорт читает `run.results`, а не адреса. Список полей `run.results` берётся из замера
     (14 ключей `computed` + ключи `t`), не из прежнего текста.
   - **Фикстура форм для прокси** (восьмое уточнение, п. 3) снимается с этого же замера, и списки чисел и булевых **выводятся
     из типов снятых значений**, не ведутся отдельным перечнем (пункт 4 ревьюера: 21 путь, читаемый экспортом, вне фикстуры —
     `turf.nProgramKgHaYr` число, `turf.clippingsCollected` булево). Полнота фикстуры — перечисление против множества путей,
     которые экспорт реально читает (их даёт статический сторож).
   - Прежний пример утечки через `GAIP_STATE.mlsnResults.speciesName` — по словам ревьюера не из жизни; форма находки
     (ключ вне отравленного списка невидим) остаётся, и её закрывает прокси на любое свойство.

**Правка к п. 3 девятого уточнения, 17.09.2026 — ревьюер перемерил и исправил себя; замер на обращении, не на снимке.**
Обёртка самого геттера `GAIP_STATE`, 45 500 обращений за выгрузку: `mlsnResults` (строка), `tissueResults` (объект, 16 ключей),
`waterResults` (строка), `shadeMetrics` (39 ключей), `wearMetrics` (12 ключей) присутствуют в 10 435 обращениях каждый;
`fertility` — 0 из 45 500. Разделы документа на месте (MLSN 230 вхождений, Soil Nutrition 34, Tissue 6, Water 12, Shade 1,
Wear 4, Monthly N 13). Механизм — тот, что назван в п. 3 по коду: `hub-tissue-v3.js:7128-7180` присваивает `window.GAIP_STATE`
целый объект, сеттер его запоминает, геттер подмешивает при каждом чтении (`gilba-hub-v2.js:1403`, `Object.assign(e, t)`);
снимок в момент входа в `collectData` показывает `t` того момента, а к строкам `8326`, `8371`, `9017`, `9167`, `9879` он уже
другой. Что меняется в плане:

- **Адреса пяти контейнеров из прежнего текста плана верны**; править их на `computed.*` не нужно — замена, записанная в п. 3
  девятого («результаты живут в `computed.<модуль>`»), снимается. Верно оба: канонический стор `computed.*` для модулей и
  легаси-запись `t` для пяти контейнеров экспорта. Живой замер из очереди ревьюера сделан — этим.
- **Единственный мёртвый — `fertility`**: `word-export.js:9654` (`GAIP_STATE.fertility.monthlyN`) не срабатывает ни разу, раздел
  Monthly N берёт данные из фолбэка, который сам код называет на `:9662`. Ветка `:9654-9660` — в инвентарь 10.5 как мёртвая,
  к удалению при слое II; источник Monthly N — фолбэк `:9662`, и он проверяется на принадлежность сайту как всё остальное.
- **Слой II, `run.results`**: легаси-запись `t` входит в снимок события **обязательно**, не «если сделана до события»: она и
  есть носитель пяти контейнеров, и она без отметки сайта — целиком тот класс, ради которого слой II существует. Оркестратор
  включает в `run.results` то, что `hub-tissue-v3.js` записал для этого прогона, с отметкой прогона.
- **Фикстура форм для прокси** — с этого замера: ключи `t` (включая то, что `mlsnResults` и `waterResults` — строки, а не
  объекты), `tissueResults` 16 ключей, `shadeMetrics` 39, `wearMetrics` 12, плюс `computed.*`; типы чисел и булевых — из снятых
  значений.
- **Находка про отравление — с живым основанием**: пять контейнеров читаются под отравляемым корнем, в фиксированном перечне
  ключей их не было, и несёт их запись без отметки сайта. Прокси на любое свойство (седьмое уточнение, п. 2) закрывает это; RC
  — чтение `GAIP_STATE.tissueResults.<ключ>` в поле документа на отравленной странице — красный.
- **Правило замера — в раздел 8**: состояние, которое геттер подмешивает при чтении, меряется **на обращении** (обёртка
  геттера), а не снимком в одной точке; снимок отвечает за момент, обращение — за то, что видит потребитель.

Пункт про замороженную отметку `getSiteConfig` (восьмое, п. 2) ревьюером не проверен — ждёт его следующего круга; в задании
Сени остаётся. Все три пункта девятого с этой правкой — в то же задание; мутации выбирает ревьюер.

**Уточнение 17.09.2026, десятое — расхождение заглушки с живой формой (класс), заморозка как проверка, непроверенное.**
Проверено по коду: заглушки стора живут в `tests/helpers/export-page-sandbox.js` (он же читает `page-state-shapes.json`, `:36`);
резолвер читает `row.name || row.label` (`nutrition-program-inputs.js:937`) и `samples.soil.values || samples.soil.payload ||
samples.soil` (`:984`); `word-export-combined.js` — один IIFE с `'use strict'` на `:45`, то есть **весь файл строгий**;
`nutrition-calendar.js:38`, `nutrition-program-inputs.js:72`, `word-export.js:224` — тоже.

1. **Заглушка стора — снимок живой формы с равенством наборов ключей в обе стороны, и резолвер читает только живые ключи.**
   Три замера ревьюера — `payload`/`values`, `{id,label,createdAt}`/`{id,name}`, проба с `methodologySnapshot`/
   `soilTextureSnapshot` живьём и `clientId`/`sampleDate`/`payload` в заглушке — один класс: заглушка пишется по памяти и
   чинится поключево, набор её ключей ни с чем не сравнивается, невидимы обе стороны. Починка первого случая сделала хуже
   (`values` и `payload` разом — заглушка, согласная с любым прочтением), и **та же уступчивость сидит в продукте**:
   `row.name || row.label`, `values || payload || samples.soil` — резолвер тоже согласен с любым прочтением, и потому тест
   не может отличить живую половину. Устройство:
   - **`tests/fixtures/store-shapes.json`** снимается с живого прогона тем же способом, что `page-state-shapes.json`
     (`GILBA_RECORD=1` в живом харнессе): формы `GAIP_SampleManager.getSiteList()[i]`, `getActiveSample('soil'|'tissue'|'water')`,
     `getSample(id)`, `GAIP_SiteConfig.getConfig(id)` — ключи и типы значений, значения — сентинелы/образцы. Заглушки в
     `export-page-sandbox.js` **строятся из фикстуры**, не пишутся руками; тест утверждает равенство наборов ключей заглушки и
     фикстуры в обе стороны (лишний ключ в заглушке — красный, недостающий — красный).
   - **Живой сторож дрейфа**: при поднятом стенде харнесс снимает формы заново и сравнивает с фикстурой — расхождение
     красное с именами ключей; это единственное место, где «живьём» и «в песочнице» сводятся, и оно обязательное в части D.
   - **Резолвер читает ровно живую форму**: `row.label`, `sample.values` — по одному ключу, без `||`-цепочек по альтернативным
     именам; статический сторож утверждает, что каждое обращение к члену объекта стора в `nutrition-program-inputs.js`
     (`row.<k>`, `samples.<тип>.<k>`) есть в `store-shapes.json` — обращение к ключу, которого живьём нет, красное. Уступчивое
     чтение возвращать нельзя: оно и прячет дрейф. Мутации ревьюера в RC: убрать `|| row.label` (при верном резолвере это
     единственный ключ — мутация превращается в чтение `row.name`, которого нет в фикстуре → красный); добавить ключ в заглушку
     → красный; убрать `methodologySnapshot` из фикстуры при живом ключе → красный на живом стороже.
   - Ключи, которые живьём есть и которых заглушка не имела (`methodologySnapshot`, `soilTextureSnapshot`), после этого
     присутствуют в песочнице автоматически — и код, который начнёт их читать, видит в тесте то же, что живьём.
2. **Заморозка — проверка только там, где она бросает; доказывается значением, не режимом.** Заявка «файл не в строгом
   режиме, начинается комментарием» не подтвердилась: строгость объявляется на область функции, `word-export-combined.js` —
   один IIFE с `'use strict'` на `:45`, и присваивание в замороженный объект там бросает сегодня. Требование всё равно
   нужно как устройство, не как факт об одном файле: (а) там, где `Object.freeze` несёт проверочную нагрузку, RC выполняет
   **запись** в замороженный объект в песочнице и ожидает `TypeError` — проверка по значению; текстовая проверка `'use
   strict'` не пишется (директива на области — текст её не докажет); (б) файл, который в строгий режим не переводится,
   заморозкой не сторожится — вместо неё `Proxy` с ловушкой `set`, бросающей независимо от режима; это общая форма
   «сторож, который сообщает», заморозка — её частный случай для строгого кода. Сегодня все четыре файла строгие, (б) не
   применяется; записано, чтобы следующий файл не получил молчащую заморозку.
3. **Непроверенное — открыто, не закрыто.** Ревьюер не дошёл до двух пунктов девятого: карты источников резолвера
   (что `sources[поле]` не числит разрешённым поле с чужим значением — мутация: резолвер отдаёт значение сайта B под
   `'site-config'` для A) и трёх из девяти перенацеленных текстовых сторожей (краснеют по смыслу, не по новому адресу — мутация
   на защищаемое свойство при верном якоре). Оба остаются строками реестра со статусом «RC не проведена» до его следующего
   круга; часть девятого стоит непроверенной, и в отчёте стадии это пишется так.

Десятое — в то же задание Сени; мутации выбирает ревьюер.

**Уточнение 17.09.2026, одиннадцатое — карта источников резолвера соглашается сама с собой; устройство на класс.**
Проверено: `nutrition-program-inputs.js:1004` — `name: take('locationName', cfg && cfg.locationName, 'site-config')`; `take`
(`:926-928`) пишет в `sources[field]` либо `'unresolved'` при пустом значении, либо **переданную автором строку** — источник
не выводится, а объявляется. В базе (только чтение) ключи конфига `gaip` у Burns и Test5: `pgr, turf, wizard, savedAt,
[traffic], location, maxNPerMonth, multiSiteTurf, [nzDistributor], nutritionProgram, nutritionProgramCoords,
nutritionCalendarProgram`; ключа `locationName` нет, название — в `location.name` («Auckland, New Zealand», «140 Britten-Jones
Dr, Holt ACT 2615, Australia»). Поэтому `cfg.locationName` всегда `undefined`, карта пишет `locationName: 'unresolved'` —
документированный ключ с законным значением, тест полноты (`:637`) зелёный, а документ печатает «Location: -35.2285452,
149.0022925» вместо названия. Что печатать в строке Location — решение владельца (10.8); здесь — только устройство, при
котором объявленный источник не может расходиться с фактическим.

Класс: **источник — утверждение автора, ничем не проверяемое.** Устройство — источник **выводится из чтения**, а не
пишется рядом с ним:

- В резолвере нет `take(field, value, 'site-config')`. Есть накопитель чтений с одной операцией на каждый объект-источник:
  `fromConfig(field, 'location.name')`, `fromSample('soil', field, 'values.K')`, `fromSiteList(field, 'label')`,
  `fromPlanForm(field, selector)`. Операция идёт по **пути** в объекте (`hasOwnProperty` на каждом шаге), возвращает значение и
  сама записывает `sources[field]`: имя источника — по тому, какая операция вызвана, `'unresolved'` — только если путь в
  объекте отсутствует или значение пусто. Автору негде написать источник руками.
- **Таблица путей — перечисление**: `{ поле → (источник, путь) }` экспортируется резолвером (`FIELD_PATHS`) и сама является
  документом о том, откуда что берётся; тест полноты (`:637`) сверяет с ней не только ключи `sources`, но и вокабуляр
  значений (`site-config | sample | site-list | plan-form | unresolved`, ничего другого).
- **Путь обязан существовать в живой форме**: каждый путь `FIELD_PATHS` со стороны `site-config` резолвится в форме конфига из
  `store-shapes.json` (десятое уточнение; форма `getConfig(id)` снимается живьём вместе с остальными), со стороны `sample` — в
  форме пробы, со стороны `site-list` — в форме строки списка. Путь, которого в живой форме нет, красный статически — и это
  ровно `locationName` сегодня: `FIELD_PATHS.locationName = ('site-config', 'locationName')` не резолвится в форме, где есть
  `location.name`.
- **«Разрешено» означает «прочитано оттуда»**: на полной фикстуре (сайт с конфигом и пробами) тест для каждого поля с
  `sources[field] === 'site-config'` заново читает фикстуру по пути из `FIELD_PATHS` и требует равенства значения; для каждого
  поля с `'unresolved'` требует, чтобы по его пути в фикстуре действительно было пусто. Поле, у которого в фикстуре значение
  есть, а карта говорит `'unresolved'`, — красное. Это и есть проверка, которой не было: карта против фикстуры, не карта
  против собственного словаря.
- Отравленная страница (второе уточнение) в этом же тесте: значение, прочитанное как `'site-config'`, не содержит сентинела B —
  источник, объявленный конфигом, не может нести страничное значение.
- RC (мутации выбирает ревьюер): вернуть `take(…, 'site-config')` с чтением несуществующего ключа → красный на «путь не
  существует в форме»; подменить в операции `fromConfig` чтение на `window.GAIP_STATE.turf.<k>` → красный на равенстве с
  фикстурой и на сентинеле; объявить `'sample'` для поля, читаемого из конфига → красный на равенстве.

Сама строка `:1004` (чтение `location.name`) — правка данных пути, делается разработчиком в этом же задании; **что печатать,
когда названия нет**, — вопрос 10.8(10), до ответа поведение печати не меняется.

Одиннадцатое — в то же задание Сени; мутации выбирает ревьюер.

**Уточнение 17.09.2026, двенадцатое — один факт в двух хранилищах; устройство на владельца факта, ключ записи и формы
ответов.** Проверено: `nutrition-program-inputs.js:686-695` помечает `timezone`, `areaHa`, `warmBase` как `notInStore` по
конфигу `gaip`; `sitePayload()` (`SiteController.php:876-879`) отдаёт `location_name` и `timezone` из колонок `sites`; на dev
все 12 живых сайтов имеют и `timezone`, и `location_name` (цифра «109 из 109» на dev не воспроизводится — 12 строк; другой
стенд не смотрела); расхождений колонки с `config.location.name` на dev сегодня нет. Пути записи названия места:
`store()` (`:85` валидация `location_name`, `:125` `SiteConfigWriter::createEmpty` — колонка заполнена, конфиг пуст),
`update()` (`:156` — колонка, конфиг не трогается), `patchConfig` (`:745-766` — зеркало `config.location.name` → колонка, в
одну сторону). Клиентский кэш чтения (`site-config-persistence.js`) держит только `configs.gaip.config`, строку сайта не
хранит; резолвер читает координаты из `cfg.location` (`:971`). `fromSiteList(field, row)` (`:1017`) принимает строку
аргументом; заглушки `getAllConfigs()`/`getAllSamples()` в `export-page-sandbox.js:216, :232` выдуманы.

1. **У каждого факта о сайте один владелец, и резолвер читает владельца.** `notInStore` смотрит в один стор и потому
   закрепляет взгляд не туда — то же, что случилось с `locationName`. Решение (архитектурное, не доменное — меняется, откуда
   читается, не что печатается): владелец фактов строки сайта — **колонки `sites`**: `name`, `location_name`, `latitude`,
   `longitude`, `timezone`. Основание по путям записи: колонку достигают все три пути (`store`, `update`, зеркало из
   `patchConfig`), копию в `config.location` — только один; строка вида «колонка заполнена, конфиг пуст» рождается при каждом
   `store()` по построению (воспроизводимость Russley закрыта: да, по построению). Отсюда:
   - `GAIP_SiteConfig` (кэш чтения, стадия 2) хранит **строку сайта** из `GET /api/sites` (`sitePayload` целиком), а не только
     `configs.gaip.config`: новый `getSite(id)`; заполняется тем же pull, заменяется целиком, как конфиг.
   - `FIELD_PATHS`: `siteName → ('site-row','name')`, `locationName → ('site-row','location_name')`, `lat/lon →
     ('site-row','latitude'/'longitude')`, `timezone → ('site-row','timezone')`; из `config.location` резолвер **не читает
     ничего** — путь `('site-config','location.*')` в таблице отсутствует, и перечисление это пинит. `notInStore` для
     `timezone` снимается; для `areaHa`, `warmBase` — остаётся, с указанием, в каком хранилище их нет: во **всех**, проверено
     формой `store-shapes.json` для каждого стора (пометка обязана называть все проверенные сторы, не один).
   - `config.location` остаётся как копия для старых читателей на `/hub`; серверное зеркало `patchConfig` → колонка
     сохраняется; обратного зеркала не заводится (двусторонняя синхронизация — та же форма «два места, один факт»). Что делать
     с копией дальше — снести или оставить — не в этом задании; пока её никто не читает в новом хабе, расхождение
     безвредно, и это утверждается: структурный сторож — ни одного чтения `location.name`/`location.lat`/`location.lon` из
     конфига в `nutrition-program-inputs.js`, `word-export.js`, `word-export-combined.js`.
   - Правило для будущих записей, из которого следуют п. 4–5 ревьюера: **путь записи ведёт к владельцу**; копия либо
     выводится сервером из владельца в одном месте, либо не существует. PHPUnit: `store()` с `location_name` → `sitePayload`
     несёт его; `update()` с `location_name` → несёт; `patchConfig` с `location.name` → колонка обновлена (зеркало); после
     любого из трёх экспорт (через `getSite`) печатает то, что в колонке. Красная проверка: убрать зеркало из `patchConfig` →
     красный на третьем; читать `config.location.name` в резолвере → красный на перечислении.
2. **Операция чтения возвращает ключ записи, и он сверяется с запрошенным id.** `fromSiteList(field, row)` доказывает стор, не
   запись. Устройство: операции по источникам принимают **идентификатор**, не объект — `fromSite(field, siteId, 'location_name')`,
   `fromSample(field, sampleId, 'values.K')`, — сами выбирают запись по `id`, и пишут в `provenance[field] = { source, path,
   recordKey }`. Тест: для каждого поля с источником `site-row`/`site-config` `recordKey === siteId` запроса, для `sample` —
   `=== sampleId` из `inputs.samples.<тип>.id`; чужой ключ — красный. Мутация ревьюера (подсунуть операции строку другого
   сайта) становится невозможной по сигнатуре, а её эквивалент внутри операции — выбор не по `id` — красный на `recordKey`.
3. **Формы ответов методов — та же фикстура, уровнем выше.** `store-shapes.json` (десятое уточнение) пополняется формами
   **ответов**: `getSiteList()`, `getAllSamples()`, `getAllConfigs()`, `getConfig(id)`, `getSite(id)`, `getActiveSample(type)` —
   снятыми живьём тем же харнессом; заглушки в `export-page-sandbox.js` строят эти методы **из фикстуры** (форма ответа →
   значения), выдуманных объектов нет; сторож равенства наборов ключей в обе стороны действует и для ответов методов, не
   только для записей. Живой сторож дрейфа (десятое) сравнивает и их.
4. **Для реестра:** три собственных обоснования ревьюера, державшихся на неработавшем отравлении `GAIP_STATE`, сняты им; обе
   дыры перепроверены на исправленном дереве и устояли — записать в строки реестра как «основание заменено, вердикт тот же».

Двенадцатое — в то же задание Сени; мутации выбирает ревьюер.

**Уточнение 17.09.2026, тринадцатое — копию читают; сверка владельца; полнота фикстуры на третьем уровне.** Написано по
замерам ревьюера и координатора без чтения кода: дерево в этот момент мутируется, состояние файлов ненадёжно; строки ниже
перепроверяются после окончания мутаций, а не сейчас.

1. **Копия `config.location` читается в новом хабе, и утверждение двенадцатого «копия отстаёт безвредно» неверно — снимается.**
   Замер: три региональные интеграции берут координаты из копии (`nutrition-nz-fertiliser-integration.js:117-118`,
   `nutrition-au-…:127-128`, `nutrition-uk-…:707-708` — `SC.getConfig(siteId).location.lat/lon`) и решают ими, какой
   региональный рекомендатель и какой каталог продуктов достанется клиенту; грузятся на `/plan`, `/settings`,
   `/reports/export`, `/reports/scenarios`, `/reports/forensic`. `PATCH /api/sites/{id}` пишет колонки и копию не трогает —
   сайт, переехавший между странами, продолжает получать прежний каталог, пока кто-то не запишет конфиг. Это путь, которым
   факт о сайте по-прежнему идёт из конфига **снаружи резолвера**, и правило двенадцатого («копия выводится сервером из
   владельца в одном месте или не существует») сегодня не выполнено: копия выводится не из владельца, а пишется клиентом.
   Устройство — то же правило, доведённое до конца:
   - **Копия выводится сервером из колонок, в одном месте, на каждой записи колонок.** `store()` и `update()` после записи
     `latitude`/`longitude`/`location_name` переписывают `config.location.{lat, lon, name}` из колонок через
     `SiteConfigWriter::mutate()` (единственный писатель, GH-447). Секция `location` в теле `PATCH …/config/gaip` **больше не
     принимается как источник**: либо 422 с текстом «location is derived from the site row — use PATCH /api/sites/{id}», либо
     принимается и перенаправляется в колонки с последующим выводом копии — выбрать первое: один путь записи на факт.
     Зеркало `patchConfig` → колонка (`:745-766`) при этом исчезает вместе с входом. Расхождение становится невозможным по
     построению: копию пишет только сервер и только из владельца.
   - **Читатели копии переезжают на владельца**: три интеграции и любой другой читатель `getConfig(id).location` (перечень
     собирается grep-ом после окончания мутаций и идёт в реестр) читают `GAIP_SiteConfig.getSite(id).latitude/longitude/
     location_name` (двенадцатое, п. 1). Структурный сторож: ноль чтений `.location.lat|lon|name` из объекта конфига в
     `assets/*.js`, кроме серверного вывода и легаси-восстановления формы на `/hub` (`restoreConfig`, именованное исключение
     с причиной); перечень читателей закреплён и может только уменьшаться (храповик поверхности).
   - **Уже расходящиеся строки** — тот же класс, что `wizard` и таймзона в 4a: копия — производные данные, владелец — колонки,
     правило владельца принято; команда ремонта переписывает `config.location` из колонок у всех строк, где они расходятся,
     с отчётом «было/стало» построчно. Доменного решения не требует: значение печати не меняется, меняется источник копии.
   - Проверка: PHPUnit — `update()` с новыми координатами → `config.location.lat/lon` равны колонкам в том же ответе; `PATCH
     config` с `location` → 422; e2e S9 — перенос сайта через Settings > Site из AU-координат в NZ, затем Plan: региональный
     гейт (`isNewZealand`) и каталог — NZ, обычная загрузка. RC: убрать вывод копии из `update()` → красный на PHPUnit и на S9.
2. **Сверка `notInStore` смотрит только в верхние ключи фикстуры и ищет лист по имени — оба свойства ложные.** Формы ответов
   методов лежат под `answers`, а перебираются ключи верхнего уровня (`gh471-sources-are-read-not-declared.test.js:183`),
   поэтому `area_ha` ищется среди имён методов, а не в форме `getSite(id)`; поиск по листу пути как по имени ключа даёт
   ложное «найдено» при совпадении в чужой форме и ложное «нет» при вложенности глубже одного уровня. (`_sitesUnioned` —
   счётчик, не причина; уточнено координатором.) Устройство: запись `FIELD_PATHS` называет **стор и полный путь**, и сверка
   резолвит путь **в форме этого стора и только в ней** (`pathExistsIn(shapes.answers['getSite(id)'], 'area_ha')`,
   `pathExistsIn(shapes.answers['getConfig(id)'], 'turf.warmBase')`), шаг за шагом, без поиска имён по всей фикстуре.
   `notInStore` допустимо только когда путь не резолвится в форме **объявленного владельца**, и пометка перечисляет, в каких
   сторах путь проверялся. RC: путь с листом, совпадающим с чужой формой (`name` есть в `getSiteList()[i]`, спрашивается в
   `getSite(id)` по несуществующему пути) → красный; путь на глубине два → зелёный.
3. **Полнота фикстуры на третьем уровне — методы, которые песочница подменяет.** Ещё четыре метода подменены и не сняты ни
   в какой форме: `getSamples(kind)` (коллекция — её форма решает, что увидит читатель проб), `getActiveSiteLabel()`,
   `getSampleTurfProfile()`, `isMultiSiteTurfEnabled()`. Устройство — перечисление в обе стороны: множество методов, которые
   продукт вызывает на объектах стора (`SM.<метод>(`, `GAIP_SiteConfig.<метод>(` в сканируемых файлах — снимается статически),
   равно множеству форм ответов в `store-shapes.json`, равно множеству методов, которые стабит песочница; метод, вызванный, но
   не снятый, — красный; метод, застабленный, но не снятый, — красный; метод, снятый, но не вызываемый, — предупреждение в
   отчёте (лишняя форма). Формы четырёх названных снимаются живьём в ту же фикстуру.

Непроверенное на этот момент (ревьюер закрывает сейчас): переписанная проверка `recordKey` и вторая проверка, стоящая на
данных без различия. Строки реестра открыты.

Тринадцатое — в то же задание Сени после окончания мутаций ревьюера; чтение кода по п. 1 повторить перед правкой.

**Поправка к тринадцатому, п. 1, 17.09.2026 — владелец объявляется на поле, не на секцию; отказ 422 снимается.** Замер
координатора (проверено трижды): форма Settings шлёт в секции `location` четыре поля — `name`, `elevation`, `lat`, `lon`
(`settings-init.js:317-327`); колонки под `elevation` в `sites` нет (`location_name`, `latitude`, `longitude`, `timezone`,
`methodology_override`, `soil_texture_override`, `attributes_json`, служебные). Отправителей секции два, оба живые: форма
Settings (`:329`) и мастер (`site-config-persistence.js:193` `PATCHABLE_SECTIONS`, `site-setup-wizard.js:1273`). Устройство
тринадцатого назначило владельцем **секции** колонки и закрыло вход отказом — оно не укладывает поле без колонки и ломает
сохранение обоим отправителям. Правило для класса:

- **Владение объявляется на поле.** Одна таблица владения `FIELD_OWNERS` — источник для сервера и клиента: `location.name →
  sites.location_name`, `location.lat → sites.latitude`, `location.lon → sites.longitude`, `location.elevation → config`
  (колонки нет), `turf.* → config`, `timezone → sites.timezone`, и так для каждого поля, которое может прийти в PATCH. Поле,
  под которое нет колонки, по правилу владеет конфиг — это не исключение, а один из двух допустимых владельцев.
- **Каждый путь записи маршрутизирует поле к владельцу; входы не закрываются.** `PATCH …/config/gaip` принимает секцию
  `location` как раньше и на сервере раскладывает её по таблице: поля с владельцем-колонкой пишутся в `sites` (тем же
  единственным писателем-транзакцией, что и колонки из `PATCH /api/sites/{id}`), поля с владельцем-конфигом — в конфиг;
  `PATCH /api/sites/{id}` — то же для своих полей. Отправители не меняются, порядок «сначала клиенты, потом вход» не
  нужен: оба пути ведут к владельцу с первого дня. Отказ 422 из тринадцатого снимается.
- **Копии выводятся владельцем в одном месте.** После любой записи в колонку-владельца сервер переписывает копию поля в
  `config.location` из колонки (для `name`, `lat`, `lon`); поле `elevation` копии не имеет — оно и есть владелец. Зеркало
  `patchConfig` → колонка (`:745-766`) заменяется этой маршрутизацией, не удаляется в никуда.
- **Чтение — по владельцу, по той же таблице.** `FIELD_PATHS` резолвера выводится из `FIELD_OWNERS`: `lat`, `lon`,
  `locationName`, `timezone` — из `getSite(id)`; `elevation`, `turf.*` — из конфига. Читатели копии (три интеграции) переезжают
  на владельца, как в тринадцатом; до переезда копия верна по построению, потому что её пишет только сервер из владельца.
- **Перечисление**: PHP-таблица владения экспортируется (фикстура `field-owners.json`, генерируется из PHP или объявляется в
  одном месте и читается обеими сторонами), клиентский `FIELD_PATHS` сверяется с ней тестом — поле, известное серверу и не
  известное резолверу, или наоборот, красное; поле секции `location`, отсутствующее в таблице (`elevation` сегодня — проверить
  после мутаций), красное. PHPUnit: PATCH config с `location.{name,lat,lon,elevation}` → три в колонках, одно в конфиге, копия
  трёх в конфиге равна колонкам; PATCH sites с координатами → копия обновлена; обе формы (Settings, мастер) — без изменений
  кода, e2e S9 прежний. RC: убрать маршрутизацию одного поля → красный на равенстве копии и колонки.

Остальное тринадцатого без изменений: копию читают три интеграции — подтверждено; читатели переезжают; расходящиеся строки
чинит ремонт из владельца (для полей с владельцем-колонкой).

**Уточнение 17.09.2026, четырнадцатое — регион каталога определяется состоянием страницы; тот же класс, что слой I, выше по
течению.** Написано по замерам без чтения кода (дерево мутируется); строки перепроверить после. Замер: Canberra перенесена
из Сиднея в Окленд, страница на том же сайте — строка сайта −36.85, копия конфига −36.85, инжект сервера `savedLocation`
−36.85, а `.gaip-lat` на странице −33.8688; `detectRegionFromHub()` отдаёт `'australia_temperate'`, `isNZ()` — `false`, клиент
получает продукты прежней страны. Механизм: `regional-profiles.js:1308` — `detectRegionFromHub()` первым звеном читает
`document.querySelector('.gaip-lat')`/`'.gaip-lon'` — поля формы скрытого раннера `/hub`, оставшиеся от последнего
восстановления; при их отсутствии возвращает `'uk_ireland'`; `isNZ()` спрашивает его первым, и все источники по id ниже,
включая инжект сервера, недостижимы. Разработчик запинил состояние в S9 как дефект (`PINNED, not approved`), в день починки
тесты покраснеют.

**Чем должен определяться регион — устройство.** Регион каталога — **производный факт о сайте**, а не состояние страницы: он
выводится из владельца координат (двенадцатое/тринадцатое: `sites.latitude/longitude`, на клиенте — `getSite(id)`) одной
чистой функцией по идентификатору сайта. В нынешнее устройство владения он укладывается без своего: это ещё одна строка
таблицы производных — `region = regionFromCoordinates(site.latitude, site.longitude)` — с тем же требованием «функция вывода
только из объекта владельца». Отдельного устройства не требует; требуется убрать из цепочки звено, которое читает не
владельца. Почему первое звено читает DOM: по той же причине, что экспорт читал `.gaip-lat` (GH-459) — код плагинной эпохи,
когда страница и была единственным хранилищем; сегодня у него есть три источника по id, и все они ниже DOM. Устройство:

- `regional-profiles.js`: `detectRegionForSite(siteId)` — по координатам из `GAIP_SiteConfig.getSite(siteId)` (владелец), чистая
  функция координат → регион (`detectRegionFromCoords` уже есть в `fungicide-filter.js:234`; одна из двух реализаций
  становится общей, вторая удаляется — перечисление: одна функция «координаты → регион» на весь `assets`); `isNZ()` и сёстры
  принимают `siteId` (или объект сайта) и зовут её; `detectRegionFromHub()` без аргумента — удаляется, а не понижается:
  `'uk_ireland'` как ответ при отсутствии полей — умолчание, печатающееся как факт (тот же класс, что 10.8(7)). Все
  вызыватели (три интеграции, `ammonium-acetate-methodology.js:405`, `cotula-bowling-green.js:864`, `fungicide-filter.js:310`,
  остальные — по grep после мутаций) переводятся на вызов с идентификатором сайта пробы/страницы. Единственное законное
  чтение DOM-координат остаётся в самом раннере `/hub` для его формы — именованное исключение с причиной.
- Сторож: динамический — отравленная страница (`.gaip-lat` сентинел/сдвиг), сайт A по id → регион A; статический — ноль
  чтений `.gaip-lat|lon` вне раннера `/hub` (расширение сторожа слоя I на `regional-profiles.js` и все вызыватели), поток
  данных от `region` к корню `getSite`. Живой: S9 переводится из `PINNED, not approved` в утверждение — после переезда
  AU → NZ на той же странице каталог NZ; парный чистый контекст. RC: вернуть чтение `.gaip-lat` первым звеном → красный.
- **Открытый доменный вопрос, до ответа владельца разработчик на это не запускается — 10.8(11):** регион каталога
  определяется **по координатам сайта** (тогда устройство выше — целиком) или это **отдельная настройка страны** сайта
  (тогда владелец — новое поле в `sites` или в конфиге, по таблице владения, а координаты — только умолчание при пустом
  поле). Устройство одинаково в обоих случаях с точностью до владельца факта; от ответа зависит, какое поле объявляется
  владельцем и нужна ли форма в Settings.

Четырнадцатое — после ответа на 10.8(11) и после окончания мутаций; мутации выбирает ревьюер.

**Уточнение 17.09.2026, пятнадцатое — сторож читателей копии по образцу; выбор записи на одноэлементном сторе; правдоподобная
замена пустоты как класс.** Написано по замерам без чтения кода (дерево мутируется); перепроверить после.

1. **Читатель копии узнаётся по происхождению значения, а не по образцу вызова.** Сторож ищет `var|let|const … = … getConfig(`
   и не переходит границу функции; читатель есть и печатает клиенту: `gaip-morning-briefing.js:163` берёт `getAllConfigs()`,
   конфиг приходит в `buildSiteCard(site, config, …)` **параметром**, `:470` читает `config.location`, `:558` печатает место в
   карточке сайта на `/morning-briefing`; `getConfig(` в файле ноль вхождений. Две независимые причины слепоты — образец вызова
   и граница функции — и это ровно приём 10.9 («по месту или имени, не по происхождению»), повторённый в новом стороже.
   Устройство — то же, что для слоя I, применённое к копии: (а) корни копии — **все** методы, отдающие объект конфига или
   его коллекцию (`getConfig`, `getAllConfigs`, `getSite`?-нет, `GAIP_SITE_CONFIG`, `GAIP_HUB_CONFIG.gaipConfig`, элементы
   `_configs`), перечень корней закреплён поверхностью храповика; (б) чтение `location.*` от любого из этих корней — находка,
   где бы оно ни стояло, включая доступ через **параметр функции**: читатель потока данных при вызове `f(config)` с аргументом,
   чей корень — копия, разворачивает тело `f` и судит обращения к соответствующему параметру (то же разворачивание, что для
   чистых производных в третьем уточнении, п. 2, только в обратную сторону — от аргумента к параметру); (в) динамическая
   половина — отравить копию `location` во всех корнях сентинелом и утверждать, что ни одна клиентская страница (карточка
   сайта, отчёт, панели) не печатает сентинел; это и ловит `:558`, где бы он ни был. Перечень читателей копии после этого
   строится обоими сторожами, не одним, и `gaip-morning-briefing.js` в него входит.
2. **Любая проверка выбора записи стоит на сторе, где выбор различим, и ожидание объявлено независимо от проверяемого вызова —
   правило, не поштучный приём.** Стор конфигов в песочнице одноэлементный: мутация «первый конфиг вместо конфига по id»
   оставляет `gh471` зелёным 41/41, краснеют два чужих набора по значениям — ловят случайно. Два стора из трёх уже
   поправлены этим приёмом поштучно, третий нет — значит приём не был правилом. Устройство: в песочнице **каждый** стор,
   из которого что-либо выбирается по ключу (`getConfig(id)`, `getSite(id)`, `getSample(id)`, `getSiteList()` → строка по id,
   `getAllConfigs()`/`getAllSamples()` → по ключу), держит **не меньше двух записей с различающимися значениями во всех
   полях**, вторая — «чужая» (сайт B / проба B, с сентинелами); ожидание для проверки выбора строится из фикстуры по
   запрошенному ключу, а не из результата вызова; тест на самом сторе: `Object.keys(store).length >= 2` и попарное
   различие полей — иначе красный самого теста. Это правило пишется один раз в `export-page-sandbox.js` как свойство всех
   сторов, и структурный тест утверждает, что ни один стор в песочнице не одноэлементный. RC: «первый вместо по id» на
   каждом сторе — красный **на своём** утверждении о выборе, не на чужом наборе.
3. **Правдоподобная замена пустоты — общий класс и общий сторож, не правка по одному.** `gaip-morning-briefing.js:474` при
   отсутствии имени печатает `lat.toFixed(3) + ',' + lon.toFixed(3)` — координаты вместо названия, то, что владелец
   запретила в строке Location отчёта (10.8(10)); умолчания видов (10.8(7)), `'uk_ireland'` при отсутствии полей
   (четырнадцатое), `'Australia/Sydney'` (2.5) — одна форма: при пустом значении печатается или подставляется правдоподобное.
   Решение владельца было о подстановках вообще, и класс закрывается сторожем, а не списком: (а) **инвентарь** — статически
   по `assets/*.js`: правая часть выражения, где пустое значение (`||`, `??`, тернарник по пустоте, `if (!x)`) заменяется
   литералом или вычислением, которое дальше **печатается или сохраняется** (поток данных до `TextRun`/`textContent`/
   `innerHTML`/`PATCH`), — список с файлом и строкой в реестр; (б) **динамически** — фикстура с пустыми полями (имя, вид,
   сорт, координаты, таймзона) прогоняется через дымоход экспорта и через рендер клиентских страниц в песочнице, и
   утверждается, что в тексте нет ни одного значения, которого нет во входах: ни координат в строке названия, ни имени вида,
   ни зоны — «пусто» печатается как пусто (`'Not specified'` — единственный допустимый литерал, и он в перечне); (в) что
   печатать вместо пустоты в каждом месте — доменное, вопросы 10.8(7), (10), и новый **10.8(12)** для карточки сайта и
   любого места из инвентаря; до ответа сторож фиксирует инвентарь как известный и запрещает **новые** подстановки
   (храповик: список может только уменьшаться).

Непроверенное из тринадцатого (маршрутизация владения и стирание единственного экземпляра; метод мимо прокси; ремонт вместо
снятой строки отчёта) — открытые строки реестра, ревьюер закрывает.

Пятнадцатое — в задание Сени после окончания мутаций; мутации выбирает ревьюер.

**Уточнение 17.09.2026, шестнадцатое — множество достигнутых методов задано одиночной сборкой, а клиент пользуется
комбинированной; общее требование к тому, как задаётся множество.** Замер ревьюера, подтверждён координатором по коду:
сверка «вызвано / снято / застаблено» прогоняет `collectData(resolveExportInputs({siteId}))` (`:780` теста), а
`exportCombinedWithSamples` зовёт на сторе `setActiveSite` (`word-export-combined.js:651`, `:664`) и `loadSample` (`:673`,
`:676`, `:684`); оба лежат в `CALLED_ELSEWHERE` («зовёт страница, экспорт не достигает»), не застаблены, формы не сняты; ветка
отказа `setActiveSite === false` (восьмое, п. 1) не проверена ни одним прогоном — метода в песочнице нет. Вторая форма,
условная: обёртка ставится после `loadPage`, модуль, взявший ссылку на стор на верхнем уровне (`gaip-evidence-ui.js:68, 151,
230`, `sensor-api-specconnect.js`), зовёт оригинал мимо неё.

1. **Множество достигнутых методов задаётся точкой входа клиента.** Сверка прогоняется на **обоих** входах, которыми
   пользуется клиент: `GAIP_WordExport.export()` (одиночный) и `exportCombinedWithSamples([…])` (комбинированный, страница
   отчётов) — оба уже есть в дымоходе (10.10), там же живёт и сверка; `collectData()` напрямую — не вход клиента и множество
   не задаёт. `setActiveSite` и `loadSample` переходят в «достигают», получают снятую форму (`store-shapes.json`, ответы
   методов) и стаб из неё; ветка отказа получает тест: стаб `setActiveSite` возвращает `false` для сайта вне реестра → проба
   пропущена с предупреждением, документ без чужой кривой (jsdom-вариант S8).
2. **Записывающая обёртка ставится до загрузки модулей страницы.** Ссылка, захваченная на верхнем уровне, тогда указывает на
   обёртку по построению; проверять, зовут ли два модуля стор во время выгрузки, не нужно — форма закрыта устройством, как
   и предложил ревьюер. Структурный сторож: в песочнице обёртки сторов устанавливаются в `loadPage` **до** выполнения первого
   скрипта из списка blade.
3. **Ответ Еве — общее требование к тому, как задаётся множество (устройство, не расширение правки).** Четыре случая за день —
   подстрока вместо узла, снимок вместо обращения, одноэлементный стор, одиночная сборка вместо комбинированной — и ещё
   раньше тела функций вместо файла, список файлов вместо выведенного, перечень ключей вместо прокси — все одной формы:
   **утверждение верно о множестве, которое задано не тем, о чём гарантия.** Общее требование, четыре оси, каждый сторож
   называет все четыре в своём заголовке, и RC ревьюера включает мутацию по каждой:
   - **Единица** — что считается одним элементом: узел AST, а не подстрока; путь в форме, а не имя листа; поле, а не секция;
     метод, а не модуль. Мутация: тот же элемент в другой записи.
   - **Момент** — когда элемент наблюдается: на обращении, а не снимком; во время сборки, а не при входе; после мутации, а не
     до. Мутация: сдвинуть событие во времени.
   - **Различимость** — может ли утверждение отличить правильный элемент от чужого: два сайта, а не один; булево
     инвертировано, а не «пусто»; отравлено всё, а не список. Мутация: подменить элемент на соседний того же вида.
   - **Вход** — какой путь продукта порождает множество: тот, которым пользуется клиент (blade-список скриптов, кнопка
     экспорта, комбинированный цикл, обычная загрузка), а не удобный вызов внутри; множество **выводится** из продукта
     (сканом, обёрткой, списком blade), а не перечисляется рукой, и его полнота утверждается **отдельно** от свойства.
     Мутация: тот же дефект другим входом.
   Это дополнение к 10.9: там — «сторож по происхождению, не по месту и имени» (единица и различимость); здесь добавлены
   момент и вход. Записывается и в план Q26 (раздел 5, п. 10) как чек-лист для каждого нового сторожа: без четырёх строк в
   заголовке сторож в ревью не принимается.

Шестнадцатое — в задание Сени после окончания мутаций; мутации выбирает ревьюер.

**Уточнение 17.09.2026, семнадцатое — пятая ось; мёртвый обходчик сентинелов и что из сданного на нём стояло.** По замерам,
без чтения кода (дерево мутируется). Замер: `sentinelsIn` (`gh461-export-inputs-provenance.test.js:57`) осматривает `string`,
`number`, `object`, а на `:70` стоит `if (typeof value !== 'object') return found`; отравление отдаёт прокси с
функцией-целью (комментарий песочницы про non-configurable prototype) — `typeof` утёкшего значения `'function'`, и обходчик
проходит мимо любого сентинела. Подтверждено координатором по коду.

1. **Пятая ось — носитель. Это ось, не частный случай.** Единица отвечает «что есть один элемент», носитель — «чем он
   представлен и умеет ли проверка осматривать это представление». Здесь единица была верна (сентинел на свойство),
   множество верно, момент верен, вход верен — а проверка смотрела на строки, тогда как то, о чём гарантия, представлено
   функцией-прокси. Свернуть это в «единицу» значило бы спрятать ровно этот отказ. Формулировка для заголовка сторожа:
   **носитель — чем представлено то, о чём утверждение (строка, число, булево, объект, функция, прокси, промис), и
   совпадает ли это с тем, что проверка умеет осматривать; несовпадение — отказ проверки, не отсутствие находки.**
   Мутация ревьюера по этой оси: тот же факт в другом представлении (строка → прокси, число → строка, объект → геттер).
   Записано пятой строкой в 10.9-чеклист и в план Q26 (раздел 5, п. 10).
2. **Правило-следствие — у проверки отсутствия всегда есть проверка присутствия.** Обходчик, который «ничего не нашёл», не
   отличим от обходчика, который «не умеет видеть» (класс B). У `sentinelsIn` обязательный позитивный контроль в том же
   файле: сентинел-прокси **подсажен** в известное поле `data` → обходчик обязан его назвать; и второй — сентинел в
   `word/document.xml` → назван. Без этих двух тестов сторож не принимается; это то же правило 3 раздела 5 («отрицательное
   всегда с положительным»), применённое к самому инструменту проверки.
3. **Что из сданного стояло на зелёном цвете этого обходчика и перепрогоняется после починки** (починка — ветка `'function'`
   со сравнением `String(value)`, плюс п. 2). Поимённо, по уточнениям 10.6:
   - **Сторож 1 (динамический, отравленная страница)** — утверждения «`data.site` и `data.turf` не несут ничего со
     страницы» и «ни один сентинел во всём `data`»: не проверены. Утверждение равенства `data.turf` объекту из `inputs`
     (сверка всех ключей) — независимо от обходчика, стоит.
   - **Третье уточнение** — «сентинел на `word/document.xml` целиком» (закрывало построители вне `collectData`, `:10769`):
     не проверено.
   - **Пятое, п. 2** — проверка пустых входов на отравленной странице: булевы и числа из `POISON_*` — реальные значения, их
     сверка стоит; строковые поля через прокси — не проверены.
   - **Седьмое, п. 2** — прокси на любое свойство: сам механизм; RC «`GAIP_STATE.tissueResults.<ключ>` на отравленной
     странице — красный» (девятое, правка п. 3) — не проверено; ревьюерские C и Z1 были зелёными не только по названным
     причинам — его слова.
   - **Восьмое, п. 3 / девятое, правка** — фикстура форм для `ownKeys`: перебор «копирует сентинелы» — не проверено.
   - **Одиннадцатое** — «значение с источником `'site-config'` не содержит сентинела»: не проверено.
   - **Четырнадцатое, пятнадцатое (1в), (3б)** — ещё не реализованы; строятся на починенном обходчике с п. 2.
   - **Реестр RC**: каждая мутация, записанная как «красная» у сторожа 1, перепрогоняется, и в строку пишется, **какое
     утверждение** покраснело — обходчик или сверка ключей; красные, которые дала только сверка ключей, остаются красными,
     но их основание в реестре меняется («основание заменено, вердикт тот же», как у ревьюера в двенадцатом п. 4); красные,
     которых после починки нет ни у кого, — находки.
   - Changelog-записи GH-461 и далее, цитирующие «shown failing on the poisoned page», получают пометку о перепрогоне.

Семнадцатое — первым в задание Сени после окончания мутаций: починка обходчика и позитивный контроль, затем перепрогон
списка выше, затем всё остальное; мутации выбирает ревьюер.

**Уточнение 17.09.2026, восемнадцатое — текстовые сторожа утверждают, что код написан, не что он исполняется; устройство
для всего класса.** По замеру, без чтения кода (дерево движется). Замер: `gh469-calendar-inputs-are-built` — мутация
«вызов `inputsForSite(r.data._exportInputs)` оставлен в тексте, результат выброшен, `perSampleInputs` собран копией с
подменённым видом» — 16/16 зелёных: текст вызова на месте, присваиваний `perSampleInputs.<поле>` нет, `Object.assign({},
_facilityCalendarInputs)` не встречается. Формулировка Евы точна: три утверждения о том, что код **написан**, ни одного —
что он **исполняется**. Это ответ на вопрос «весь ли класс»: да, у любого текстового сторожа, который утверждает **наличие**
конструкции («вызывает X», «использует Y», «строит из Z»), носитель утверждения — текст, а гарантия — эффект; ось «носитель»
из семнадцатого, применённая к самому сторожу. Ось «вход» тут ни при чём: вход верный, множество верное — представление
гарантии не то.

**Правило: о чём текстовый сторож имеет право утверждать.**

1. **Текст доказывает только отсутствие над перечисленной вселенной.** «Нигде в `assets/*.js` нет `PUT …/config/gaip`», «ни один
   файл вне хелпера не пишет колонку», «в этой функции нет чтения `.gaip-*`» — свойства о кодовой базе как множестве текста,
   и эффектом их не доказать (эффект показывает один путь, отсутствие нужно по всем). Такой сторож уместен, при условиях
   16/17 уточнений: вселенная выведена из продукта (список файлов, blade, grep по формам), единица — узел, не подстрока,
   позитивный контроль — посаженная конструкция найдена.
2. **Текст не доказывает наличия эффекта.** «F вызывается», «объект собран из F», «раздел читает `data`, не `window`» как
   позитивное утверждение — недоказуемо текстом: вызов без использования результата, присваивание в мёртвую переменную,
   ветка, до которой не доходит исполнение, — всё это текст «на месте» при отсутствующем эффекте. Такое утверждение
   переводится в **наблюдение потребителя**: в песочнице оборачиваются производитель F и потребитель C, и утверждается, что
   C получил именно то, что вернул F (тождество объекта `===` или глубокое равенство с ожидаемым, построенным независимо
   из фикстуры), — по значению, в прогоне. Для `gh469`: обёртка `inputsForSite` запоминает возвращённый объект, обёртка
   `computeProgram` — полученный аргумент; утверждение — это один и тот же объект (`===`), и для каждого поля из
   `CALENDAR_INPUT_KEYS` значение равно построенному из фикстуры сайта пробы. Мутация «вызвать и выбросить» краснеет,
   потому что `computeProgram` получил другой объект. Живой двойник — парити «форма целиком, продукт против продукта»
   (девятое, п. 2), на обычной загрузке.
3. **Статический поток данных — не текст.** Разбор AST от потребителя к корням (сторож 2 слоя I) утверждает об эффекте
   статически: «значение, которое получает C, происходит из F», — потому что идёт по потоку, а не по наличию строки.
   Вызов с выброшенным результатом в потоке не участвует и не засчитывается. Поэтому пара «поток данных + наблюдение
   потребителя» — допустимая замена текста для утверждений об эффекте; текст рядом — только дымовой.
4. **Правило принятия**: у каждого текстового сторожа в заголовке — какое из двух он утверждает; «наличие» без парного
   сторожа эффекта не принимается. RC ревьюера получает мутацию **«текст оставлен, эффект убран»** для каждого утверждения
   о наличии: вызов и выброс результата; присваивание в неиспользуемую переменную; ветка после `return`; тот же вызов с
   другим аргументом.

**Инвентарь.** Ещё сторожа того же рода есть — это большинство из 160 структурных файлов (план Q26, корпус): у каждого,
где стоит позитивное `toMatch`/`toContain`/`indexOf(...) > -1` по исходнику, утверждение о наличии. Переписывать все сейчас
не нужно и не по этому плану: в план Q26 добавляется механический сигнал «позитивное совпадение по исходнику как
единственное утверждение» (класс F: имя обещает эффект, тело проверяет текст) и мутация «текст оставлен, эффект убран» в
RC; в **этом** плане — только сторожа раздела 10 (слои I–III, дымоход, храповики): каждый переклассифицируется по п. 1/п. 2,
утверждения о наличии получают наблюдение потребителя в песочнице дымохода. Перечень — в реестр после окончания мутаций.

Восемнадцатое — в задание Сени после семнадцатого; мутации выбирает ревьюер.

**Уточнение 17.09.2026, девятнадцатое — название места обязательно, как координаты (решение владельца); устройство на
обеих сторонах и для существующих строк.** По замерам, без чтения кода (дерево движется). Замер: `settings-init.js:289` —
условие `_lat === '' || _lon === ''` плюс конечность; `_locName` читается на `:286`, в условие не входит и выбирает только
текст ошибки — «Location is required» при проверке одних координат; при заполненных координатах пустое имя уходит как
`location_name: null` (`:304`); сервер — `location_name` `nullable` в обеих формах (`SiteController.php:86`, `:162`). На dev
среди двенадцати живых сайтов пустых имён ноль (ни в колонке, ни в конфиге); у клиента — неизвестно.

Устройство — то же, что GH-404 сделал для координат, и по тому же правилу владения (тринадцатое, поправка): владелец
названия — `sites.location_name`, обязательность объявляется у владельца и повторяется на входе, а не наоборот.

1. **Сервер — источник правила.** `store()` и `update()`: `location_name` → `['required', 'string', 'max:255']` (для `update()` —
   `'sometimes'|'required'`: запрос без ключа колонку не трогает, запрос с пустым — 422 с полем). Маршрутизация секции
   `location` из `PATCH …/config/gaip` (поправка к тринадцатому) — то же правило на поле `location.name`: пустое → 422 с
   именем поля. Обязательность стоит у владельца факта и действует для **всех** отправителей сразу: Settings, оба мастера,
   импорт, Account — без правки каждого. Копия `config.location.name` выводится из колонки, как и прежде.
2. **Клиент — повторяет правило до отправки, по одному образцу с координатами.** `settings-init.js:289`: условие включает
   `_locName === ''`; текст ошибки прежний («Location is required»), теперь верный. Оба мастера (`onboarding-wizard.js`
   `_canProceed` шаг 1, `site-setup-wizard.js` шаг локации) — переход дальше только при непустом `location.name`, как сегодня
   при координатах. Клиент без правки всё равно упрётся в 422 сервера — п. 1 первичен, п. 2 убирает лишний запрос.
3. **Существующие строки — ничего не делать: ни миграции, ни ремонта, ни отдельной ветки** (ответ владельца, 17.09: «если нет
   локейшена, и он хочет сохранить настройки, он должен ввести локейшн»; никаких исключений для существующих сайтов, никаких
   обходных путей). Сайт с пустым именем попадает под то же правило при первом сохранении Settings: форма не сохраняется,
   пока локация не выбрана. Ничего не подставлять: правило пятнадцатого, п. 3 — «название из координат» и есть
   правдоподобная замена пустоты. Список сайтов с пустым именем в отчёт ремонта не добавляется — поведение одно для всех.
4. **Сторожа.** PHPUnit: `store()`/`update()`/`PATCH config location` с пустым и с отсутствующим именем — 422 / колонка не
   тронута; с именем — записано и отражено в копии. Jest (источник по значению, не по тексту — восемнадцатое): форма Settings
   с координатами и пустым именем **не отправляет** запрос и показывает сообщение — обёртка `apiFetch` в песочнице записывает
   вызовы, утверждение — ноль `PATCH` при пустом имени, один при заполненном. Мастера — то же на шаге локации. Живой:
   `gh404-settings-location-required-live` расширяется случаем «координаты есть, имени нет» — обычная загрузка, сохранение
   отклонено, база не изменилась. RC: убрать `required` на сервере → PHPUnit красный; убрать `_locName` из условия клиента
   → jest красный (запрос ушёл); мутация «текст условия оставлен, эффект убран» — условие проверяет имя, но результат не
   останавливает отправку → красный на счётчике вызовов.
5. **Доменные вопросы 10.8(13), (14) — закрыты ответом владельца 17.09:** поведение одно для всех сайтов и без обходных
   путей — форма Settings не сохраняется, пока локация не выбрана; пользователь вводит её. Отдельной ветки для сайтов без
   имени нет, миграции нет. Что именно показывает форма при отказе — существующее сообщение «Location is required» на
   секции Site, как сегодня для координат (GH-404); ничего нового не проектируется.

Девятнадцатое — в задание Сени после восемнадцатого; мутации выбирает ревьюер.

**Уточнение 17.09.2026, двадцатое — исключение, выданное файлу счётчиком; и почему принятое правило не перенеслось на
следующий сторож.** По замеру, без чтения кода. Замер: `gh476-region-follows-the-site.test.js:144` —
`DOM_COORDINATE_READS = { 'nutrition-prebble-integration.js': 1 }`, проверка сравнивает число совпадений регулярки с числом;
мутация «чтение убрано из `getLatitude()`, новая функция верхнего уровня того же файла читает `.gaip-lat`» — счёт прежний,
21/21 зелёных; регулярка считает `.gaip-lat` и `.gaip-lon` вместе, разрешение под широту покрывает долготу. Сторож написан
через несколько часов после того, как правило якорения на узел было принято (третье уточнение, п. 1) и применено к
стороже потока данных.

1. **Форма исключения — часть правила принятия, а не память автора.** Исключение допустимо только в одной форме, той же для
   всех сторожей: `{ file, function, node: <полный текст выражения по AST>, what: <какой факт читается>, why: <причина>,
   until: <чем и когда снимается> }` — по одному на конструкцию; **запрещены** исключения по файлу, по счётчику, по регулярке,
   объединяющей несколько форм, по имени функции без узла, без `until`. Счётчик на файл — это «исключение по форме», от
   которого уходили, в третьей записи; регулярка на две формы — то же, что исключение `GAIP_STATE` целиком (третье, п. 1).
   Для `gh476`: одно исключение на узел чтения в `getLatitude()` и одно на узел в `getLongitude()`, каждое со своим `what`;
   новая функция с тем же чтением — незакрытая находка; список исключений — храповик поверхности (второе уточнение).
2. **Ответ на вопрос о механизме — правило, которое надо вспомнить, не работает; работает правило, которое нельзя обойти,
   не заметив.** Пять осей и форма исключения сегодня проверяются тем, вспомнил ли о них автор, и вспомнил ли ревьюер
   спросить. Устройство переносит требования из памяти в артефакт и в инструмент:
   - **Паспорт сторожа** — обязательный блок в начале каждого файла-сторожа, фиксированные поля, каждое непустое:
     `guarantee` (о значениях, одно предложение); `claims` — `absence-over-universe` или `effect` (восемнадцатое);
     `universe` — откуда выведено множество (blade, scan, обёртка) и чем утверждается его полнота; `unit`, `moment`,
     `distinguishability`, `entry`, `carrier` — пять осей; `positive-control` — какой тест доказывает, что проверка видит;
     `exemptions` — форма п. 1 или `none`; `ratchet` — какие поверхности закреплены; `rc` — мутации, кто выбрал, где
     вывод. Паспорт — в коде, потому что он читается при каждом открытии файла, а не при старте сессии.
   - **Мета-сторож `tests/guard-passports.test.js`** — механически: у каждого файла-сторожа (по имени/маркеру) есть паспорт со
     всеми полями; известные анти-формы краснеют без чтения смысла: исключение вида `{ 'file.js': <число> }`, якорь
     `indexOf('function …` без проверки нахождения, `PAGE_STATE`-исключение на объект целиком, регулярка с альтернативой
     двух форм в одном исключении, `toBeGreaterThan(0)` как единственное утверждение, отсутствие теста с посаженным
     примером. Это класс E/F из плана Q26, применённый к самим сторожам; мета-сторож получает свой паспорт и свою RC
     (сторож без паспорта / с исключением-счётчиком → красный).
   - **Список принятия в ревью — в брифе ревьюеру, не в его памяти**: строки реестра RC для каждого сторожа = поля
     паспорта; ревьюер не «проверяет сторож», а заполняет строки — пустая строка не принимается. Это ответ Еве: да,
     требование к принятию должно быть списком, который проходят, а не знанием, которое вспоминают; память читается на
     старте сессии, сторож пишется через часы — знание должно стоять там, где происходит действие: в файле сторожа и в
     форме реестра. То же для нас: правила из памяти, которые обязаны действовать внутри сессии, дублируются в шаблон
     задания (бриф Сене) и в шаблон реестра (бриф Вене) как обязательные поля.
   - **Другие свойства, проверяемые сегодня только памятью** — перечислены в паспорте, чтобы список был закрыт:
     позитивный контроль; парный обычный прогон при искусственном условии; выбор мутаций ревьюером, не автором;
     `anchoredSlice` вместо `indexOf`; заморозка, доказанная записью; храповик на поверхность, не на число; два элемента в
     сторе; отравление прокси, не списком; форма исключения; `claims` текст/эффект. Каждое — поле или анти-форма
     мета-сторожа.

Двадцатое — в задание Сени: п. 1 — правка `gh476`; паспорт и мета-сторож — вместе с частью 0 плана Q26 (инструмент), до
следующего нового сторожа; мутации выбирает ревьюер.

**Поправка к пятнадцатому, п. 3 (17.09.2026) — объём инвентаря подстановок и динамическая половина для клиентских
страниц.** Замер разработчика: по формулировке п. 3а без сужения по полю таких мест 3689 (`hub-tissue-v3.js` 489,
`word-export.js` 307, `disease-analysis.js` 213, …); сужение до пустоты **поля сайта** — полей таблицы владения — даёт 184
записи в `tests/fixtures/substitution-inventory.json` (ключ — файл, поле, вид, приёмник, текст подстановки; не номер строки);
живой пример (карточка сайта) и все четыре формы из плана в него входят.

1. **Сужение подтверждаю, и граница у него точная.** Решение владельца было о подстановках **фактов о сайте** — о том, что
   печатается как утверждение о его поле; 3689 мест по чистой форме выражения — это все `||` кодовой базы, среди них
   умолчания алгоритмов, единицы, стили, и такой список двигается от каждой правки и храповиком быть не может. Класс:
   **подстановка пустого значения поля, чей владелец объявлен в таблице владения `FIELD_OWNERS`, плюс производных от них
   (регион, `isC4`, отображаемые имена вида и сорта — список производных из 10.6)**, текущего в печать или сохранение. Что
   держит список монотонным: вселенная полей — сама таблица владения и список производных, и она расширяется только
   явным решением (новое поле-владелец), а не правкой кода; ключ записи без номера строки — правка в файле запись не
   двигает. Значения проб в класс не входят намеренно: для них уже есть отдельное правило «`null`, не `0`» (GH-338,
   `validateSampleInputs`), со своим сторожем. Список полей — одна строка в `substitution-inventory.js`; расширить его
   можно только вместе с таблицей владения.
2. **Динамическая половина для клиентских страниц — живым e2e, не jsdom.** Зависимость ради одного рендера не вводится:
   `vm`-песочница дымохода DOM не рендерит, и это её известный предел (10.10). Устройство: живой сценарий на
   `/morning-briefing` с сайтом без названия места; после девятнадцатого такой сайт через API не создать (имя обязательно),
   поэтому строка сеется в dev-базе напрямую, как это уже делают живые тесты GH-439 (`docker exec … mysql`), и удаляется
   после; обычная загрузка, парный чистый контекст; утверждение — в слоте названия карточки **нет координат** (то, что
   владелец запретила), без утверждения о том, что там должно быть — это открытый 10.8(12). До ответа на (12) карточка
   держится статическим инвентарём и храповиком, живой сценарий пишется с `test.failing`, если сегодня в слоте координаты.
   Если рендер-проверок клиентских страниц наберётся больше одной, вопрос о jsdom возвращается в часть 0 плана Q26 как
   решение об инструменте, не здесь.

Ревьюер проверяет эту поправку последней; пересборка инвентаря не требуется.

**Уточнение 17.09.2026, двадцать первое — чем сбор инвентаря доказывает полноту; подстановка региона выше по цепочке; шесть
непокрытых чтений.** Проверено по коду (дерево в покое): `tests/lib/substitution-inventory.js:334` `watchedFields()` берёт
поля из блока `FIELD_PATHS` резолвера (ключи, последние сегменты путей, алиасы) — `region` в `_fields` есть, `isC4` нет;
`inventoryOf()` (`:196`) распознаёт подстановку по формам выражения и ведёт «печатается или сохраняется» **внутри файла**;
`disease-engine-pure.js` в инвентаре — ноль записей при пяти `region || 'AU'` (`:3863`, `:4010`, `:4890`, `:5637`, `:5644`);
`disease-forecast.js:982, 993, 1000` — то же, на `:1000` подставляется и `{ name: 'Australia' }`; в
`nutrition-prebble-integration.js` остались чтения DOM `:271` (`.gaip-surface-type`), `:488-492` (пять `[data-mlsn]`), `:670`
(CEC), а сторож годности снят четырнадцатым. Все три заявки подтверждены.

1. **Полнота инвентаря доказывается не сбором, а сравнением двух независимых способов задать множество — и это ось «вход»,
   применённая к самому инвентарю.** Сегодня множество задано одним обходом; храповик держит то, что обход нашёл, и не
   знает о пропущенном. Две причины неполноты по коду: вселенная полей взята из `FIELD_PATHS` резолвера, а не из таблицы
   владения плюс список производных (поправка к пятнадцатому, п. 1) — поэтому `isC4` вне; и достижимость печати ведётся
   внутри файла — поэтому `region || 'AU'`, чей эффект уходит в другой файл через множитель, не засчитан. Устройство:
   - **Вселенная полей — не из резолвера.** `watchedFields()` читает `FIELD_OWNERS` (поправка к тринадцатому) и список
     производных (10.6, восьмое/девятое); `FIELD_PATHS` — производное от них и в источники не годится. Тест: множество
     наблюдаемых полей равно владельцы ∪ производные ∪ алиасы; поле, добавленное в таблицу владения и не появившееся в
     `_fields`, — красный.
   - **Достижимость печати снимается из условия сбора.** Инвентарь — консервативная над-оценка: **любая** подстановка
     пустого значения наблюдаемого поля, где бы ни оказался результат; куда он течёт, устанавливает динамическая половина
     (пустые входы через дымоход и рендер) — она и решает, что печатается. Над-оценка для храповика безвредна, а
     межфайловый поток она не теряет.
   - **Второй, независимый сборщик — контроль полноты.** Рядом с AST-обходом — простой построчный поиск форм по каждому
     наблюдаемому полю (`<поле> ||`, `<поле> ??`, `? … : <литерал>` при `!<поле>`, `if (!<поле>)`) по всем `assets/*.js`;
     каждое его попадание обязано быть либо записью инвентаря, либо именованным исключением с причиной; попадание без
     объяснения — красный. Два способа, заданные независимо, обязаны сойтись — то же правило, что для форм стора в обе
     стороны (десятое). Что краснеет при неполноте: этот тест, а не ревьюер руками.
   - **Позитивный контроль на каждую форму распознавания**: посаженная подстановка каждой формы (`||`, `??`, тернарник,
     `if`) в каждом положении (внутри функции, в параметре по умолчанию, в объектном литерале, через локальную) найдена —
     сегодня контроль один на всё.
   - `substitution-inventory.json` пересобирается после этого; храповик закрепляется заново с новым базовым множеством.
2. **Подстановка региона стоит выше нейтральных ответов — умолчание снимается у источника факта, потребители обязаны принимать
   пустоту.** Девять нейтральных ответов четырнадцатого стоят ниже по цепочке, чем `inputs.region || 'AU'`, и в печать не
   доходят; убрали умолчание в одном звене, не проверили предыдущее — правило: **факт о сайте выводится один раз у владельца
   (регион — из координат, 14-е), и ни один потребитель не имеет права заменять его отсутствие значением**; каждое
   `region || 'AU'` — запись инвентаря п. 1 (пять в `disease-engine-pure.js`, три в `disease-forecast.js`, включая
   `{ name: 'Australia' }`), и это класс «правдоподобная замена пустоты». Что печатать и считать при неизвестном регионе
   (множители одиннадцати болезней, подпись региона) — доменное, **10.8(15)**; до ответа записи стоят в инвентаре, храповик
   запрещает новые, а динамическая половина с пустым регионом утверждает, что в документе нет ни «Australia», ни
   австралийских множителей, — как `test.failing`, пока (15) открыт. Проверка цепочки, которой не было: динамический прогон с
   `region = null` от резолвера до печати, а не проверка одного звена.
3. **Шесть чтений страницы остались без покрытия, и это наша правка (четырнадцатое сняло сторож годности).** Чтения `:271`,
   `:488-492`, `:670` — вид I (тип поверхности, значения почвы, CEC) в региональной интеграции, которую клиент запускает с
   `/plan`; это класс слоя I вне экспорта. Не возвращать старый текстовый сторож годности; устройство — расширить слой I:
   интеграция берёт `surfaceType`, `soilPpm`, `CEC` из объекта адаптера (`resolveSiteProgramInputs` их уже отдаёт), а
   сканируемая вселенная сторожей слоя I (динамического — отравленная страница, статического — поток данных и запрет
   `.gaip-*`/`[data-mlsn]` чтений) выводится из скриптов `/plan` и `/reports/*` по blade, куда три интеграции входят;
   исключения — только в форме двадцатого. Значения проб остаются вне класса подстановок (правило «`null`, не `0`»), но
   **чтение их со страницы** — класс слоя I, и он их покрывает. RC: вернуть чтение `[data-mlsn="K"]` → красный на потоке
   данных и на отравленной странице.

**Что не сделано и не проверено мной:** списки `region || 'AU'` взяты из grep, их достижимость печати не прослежена; число
записей после пересборки инвентаря неизвестно; blade-списки `/plan` для п. 3 не перечитывала.

Двадцать первое — в задание Сени; п. 2 — после ответа на 10.8(15); мутации выбирает ревьюер.

**Уточнение 17.09.2026, двадцать второе — исходный дефект в его собственной форме не виден ни одним сторожем обычного
набора; читатель копии из ответа сервера; `gh469` по трём осям.** Проверено по коду (дерево в покое): `word-export.js:7347`
зовёт `getResolvedSync(_lat, _lon)`; заглушка `tests/helpers/export-page-sandbox.js:365` — `getResolvedSync: () => ({
monthlyTemps: temps, … })`, без параметров, один ряд на любой ключ; `gaip-morning-briefing.js:105` и
`gaip-field-log-analysis.js:593` берут конфиг из `site.configs.gaip.config` (ответ `/api/sites`); `COPY_ROOTS`
(`gh471-…:655`) — `getConfig`, `getAllConfigs`, `GAIP_SITE_CONFIG`, `gaipConfig`. Все три заявки подтверждены.

1. **Ответ владельцу: проверка исходного дефекта в его собственной форме существует только живьём и в обычном наборе
   отсутствует.** Живьём: `gh459-cross-site-inputs-live.test.js:229` («колонка GP месячного расписания — сайта самой пробы,
   после переключения на него») и парити `ui-vs-export-parity.test.js:1536` (помесячно GP, температура, азот — Plan против
   экспорта; мутация ревьюера дала бы расхождение Plan/Окленд против экспорт/Крайстчёрч). Оба выполняются только при
   поднятом стенде и пропускаются в `npx jest` — то же положение, что у дымохода до 10.10. В обычном наборе мутация
   «`getResolvedSync(-43.53, 172.64)` вместо `(_lat, _lon)`» — дословно дефект владельца — зелёная везде, потому что заглушка
   нормалей не различает ключи: стор выбирается по паре координат, в `KEYED_STORES` его нет, и различимости нет по
   построению (ось «различимость», та же, что одноэлементный стор в пятнадцатом). **Это первое, что делается, раньше всех
   накопленных уточнений, и сдаётся само по себе:**
   - `tests/gh459-own-temperatures.test.js` (имя рабочее), отдельный файл, отдельная сдача, свой паспорт: в песочнице служба
     нормалей — **ключевой стор** (пятая запись `KEYED_STORES`, ключ — пара координат с округлением, как в самой службе), с
     **двумя разными рядами**: A (Окленд, 12 температур) и B (Крайстчёрч, 12 других, различающихся в каждом месяце — тест
     утверждает попарное различие до прогона); страница и указатель — на сайте B, экспорт пробы сайта A через
     `GAIP_WordExport.export()` **и** через `exportCombinedWithSamples` (оба входа, шестнадцатое); утверждения по значению: в
     `word/document.xml` месячные температуры и GP равны ряду A месяц за месяцем (12 чисел, допуск как в парити), ни одного
     числа ряда B; `getResolvedSync` вызван с координатами A (обёртка записывает аргументы) — **не** с координатами B и
     **не** без аргументов. RC: мутация ревьюера (координаты Крайстчёрча в точке вызова) → красный на своём утверждении; вызов
     без аргументов → красный; подмена ряда в стубе на одинаковый → красный на предпроверке различия.
   - Живые двойники (`:229`, `:1536`) остаются как браузерная половина; их запуск при сдаче обязателен, но обычный набор
     обязан ловить дефект сам — это и есть требование владельца.
   - Всё остальное из уточнений 17–21 — после этой сдачи.
2. **Копия — по происхождению значения, а корни копии выводятся из форм, не перечисляются рукой.** `site.configs.gaip.config`
   из ответа `/api/sites` — тот же объект конфига, что `getConfig(id)` отдаёт из кэша; `_serverConfigs[site.id]` в брифинге —
   его хранилище; печать `config.location.name` в карточке (`:664`) — ровно то, что сторож запрещает, и он зелёный без
   единой мутации. Устройство: множество корней копии = все пути в `store-shapes.json`, чья форма равна форме конфига
   `gaip` (`getConfig(id)`, `getAllConfigs()[id]`, `getSite(id).configs.gaip.config`, ответ `GET /api/sites` → `data[i].configs.
   gaip.config`, инжекты `GAIP_SITE_CONFIG`/`gaipConfig`), выведено сравнением форм, не списком; читатель потока данных ведёт
   происхождение от любого из них, включая через контейнер (`_serverConfigs[…]`) и через параметр (пятнадцатое, п. 1);
   динамически — ответ `/api/sites` в песочнице тоже отравляется (копия `location` — сентинел), и живой сценарий
   `/morning-briefing` (поправка к пятнадцатому, п. 2) утверждает отсутствие координат в слоте названия. Оба живых читателя
   (`gaip-morning-briefing.js`, `gaip-field-log-analysis.js`) переезжают на `getSite(id)` по правилу владельца.
3. **`gh469` переписывается по трём осям, и две оставшиеся доказываются сторожем, не продуктом.** Различимость: фикстура
   несёт **разные** значения в `prog` и в `turf` для каждого поля, где есть выбор источника, — обращение порядка `||` красное;
   носитель: утверждение о происхождении проверяется по карте `calendarSources` (какой источник у каждого ключа) против
   ожидаемого из фикстуры, а не только по значениям готового объекта; вход: наблюдение потребителя — `computeProgram` получил
   `===` тот объект, что вернул `inputsForSite` (восемнадцатое). Единица и момент сегодня закрыты заморозкой в продукте;
   сторож обязан это **доказать по значению** — запись в возвращённый объект бросает `TypeError` (десятое, п. 2), иначе
   гарантия держится на свойстве, которое никто не проверяет.

**Что не проверено мной:** сохранённые в дереве версии `gh469` и `gh471` после мутаций ревьюера не перечитывала; что
округление ключа в службе нормалей совпадёт с ключом заглушки — разработчику снять из `climate-normals-service.js`.

Порядок сдачи: п. 1 отдельно и первым; п. 2, п. 3 — вместе с уточнениями 17–21; мутации выбирает ревьюер.

**Уточнение 17.09.2026, двадцать третье — регион: ответ владельца; широтные умолчания как подстановка последним `return`;
время прогона; методология со страницы.** По замерам, без чтения кода (ревьюер проверяет шестнадцатое, дерево ненадёжно).

1. **10.8(15) закрыт ответом владельца: «Нет региона — не выводим».** Раздел, который без региона посчитать нельзя, не
   печатается; ни австралийских множителей, ни подписи «Australia», ни иного замещения. Восемь записей `region || 'AU'`
   (двадцать первое, п. 2) переходят из «в инвентаре до ответа» в правку: потребители принимают `null` и **опускают** раздел
   болезней с региональными множителями и подписью региона; динамический прогон `region = null` от резолвера до печати из
   `test.failing` становится утверждением: в документе нет ни «Australia», ни множителей, ни раздела; в реестре — что
   именно опущено, по образцу «нет раздела, нет подмены» (b35fix313/314). Правка — в задание после сдачи двадцать второго п. 1.
2. **Картина по замеру принимается:** `detectRegion` по координатам отвечает всегда — последние `return` (`regional-profiles.js:
   1294-1300`): `lat >= 45` → `continental_europe`, `lat >= 30` → `us_transition`, иначе `us_south`; неизвестность — только
   при отсутствии данных (нет `siteId`, нет строки, координаты не числа) → после четырнадцатого честный `null`; и четвёртый
   случай — профиля с таким кодом нет в таблице, `getRegion` подставляет `uk_ireland` (`:1362`) — подстановка, ещё стоит и
   идёт в инвентарь и в правку п. 1 (нет профиля → `null` → раздел не печатается).
3. **Широтные умолчания — в классе подстановок, и ловятся они не формой, а объявленной областью определения.** Отличие,
   названное координатором, точное: ответ выдаётся там, где ответа нет, и по форме неотличим от настоящего — не `||`,
   не тернарник, а последний `return`; по значению «сайт в Японии → `us_transition`» неотличим от честного. Поэтому
   устройство — не поиск формы, а **явная область определения**: функция «координаты → регион» получает **таблицу
   областей** (для каждого кода региона — прямоугольники/полигоны, которые он покрывает; сегодня они уже стоят в коде
   ветвями `if`, только последняя ветка безусловна) и возвращает `null` для точки вне всех областей; безусловного `return`
   в конце нет — это и есть правило: **функция классификации по данным заканчивается `null`, не значением**. Ловится тремя
   способами, ни один не по форме `||`: (а) статически — у функций из именованного списка «классификаторов сайта по данным»
   (`detectRegion`, `detectRegionFromCoords`, `timezoneFromCoordinates`, `isNewZealand`, `isC4Species` и любая, добавленная
   в список) последний оператор — `return null` (AST), безусловный `return` литерала — красный; (б) по значению — точки вне
   всех областей (Токио, экватор в океане, Антарктида) дают `null`, и точки на границах областей — ожидаемый код; таблица
   областей утверждается непересекающейся (две области с общей точкой — красный самого теста); (в) инвентарь подстановок
   получает третью форму записи — «безусловный `return` в классификаторе» — из списка (а), а не из поиска по форме. Что
   печатать при `null` — уже отвечено (п. 1): ничего. Список классификаторов — перечисление, выведенное сканом: любая
   функция в `assets`, принимающая координаты и возвращающая код из таблицы регионов/зон, обязана быть в списке (тест —
   поиск возвращаемых литералов из множества кодов регионов).
4. **Время прогона — разделить наборы, не откатывать покрытие.** Причина: `waitForAnalysis` ждёт `gaip:analysis-complete`,
   `addEventListener` песочницы — пустышка, таймаут 15 с на пробу; настоящие слушатели вводить в песочницу нельзя (ожили
   бы десятки модулей). Устройство: (а) песочница даёт `waitForAnalysis` **свой** сигнал — обёртка `triggerAnalysis()` в
   песочнице синхронно вызывает зарегистрированный обработчик `gaip:analysis-complete` **одного** слушателя — того, который
   поставил сам `waitForAnalysis` (песочница ведёт список слушателей по имени события и вызывает только последнего,
   поставленного из `word-export-combined.js`; остальных модулей не будит), с `detail` из отметки прогона слоя II —
   таймаут исчезает, прогон возвращается к секундам; это и есть форма, в которой слой II будет отдавать `run.results`, так
   что работа не выбрасывается; (б) независимо от (а) — два набора в `package.json`: `npm test` (быстрый: всё, кроме
   файлов, помеченных `@slow` в паспорте, — гоняется на каждой мутации) и `npm run test:full` (всё, обязателен перед сдачей
   и в ревью; отчёт стадии печатает, что полный набор прогнан). Красная проверка и приёмка — по полному; разработчик между
   мутациями — по быстрому. Бюджет: быстрый набор не длиннее 30 с, полный — без ограничения; выход за бюджет — событие,
   которое называется в отчёте, не молчится. Правило прежнее: покрытие не режется ради времени.
5. **Методология со страницы — тот же класс, что температуры (двадцать второе, п. 1), и та же правка.** `data.soil.methodology`
   в песочнице — `'MLSN'` (умолчание продукта) при `ammonium_acetate` в конфиге, потому что поля `.gaip-soil-methodology` в
   снятой форме нет — чтение страницы вместо сайта, и решает оно, какие пороги увидит клиент. Устройство: методология — поле
   с владельцем (конфиг `turf.methodology`, с серверным правилом NZ → AA, `effectiveMethodology()`), читается резолвером по
   id (`FIELD_PATHS`), `collectData` берёт `data.soil.methodology` из `inputs`, чтение `.gaip-soil-methodology` удаляется
   (инвентарь 10.5, `:8470`); умолчание `'MLSN'` при пустом — подстановка, в инвентарь и под правило пятнадцатого. Сторож —
   тот же тест двадцать второго п. 1, расширенный: сайт A с `ammonium_acetate` на странице с `MLSN` → в документе диапазоны AA
   и слово «Ammonium Acetate», ни одного «MLSN». Сдаётся вместе с двадцать вторым п. 1 (один класс, один тест), не после.

**Не проверено мной:** строки `regional-profiles.js:1294-1300, 1362`, `word-export.js:8470` и тайминги прогона — по замерам
координатора; какой из двух способов п. 4 разработчик уже пробовал — не знаю.

Двадцать третье: п. 1, п. 5 — вместе с двадцать вторым п. 1; п. 3, п. 4 — следом; мутации выбирает ревьюер.

**Уточнение 17.09.2026, двадцать четвёртое — сертификатный код и текстура: владелец через объявленную цепочку; поправка к
замеру про `monthlyTemps`.** По словам разработчика (GH-480) и замерам, без чтения кода (ревьюер мутирует дерево).

1. **Сертификатный код (`deriveCode(species, texture)` → S277/S279/S81) — производный факт, тот же класс, что методология и
   текстура; своего владельца у него нет.** Он выводится чистой функцией из двух фактов с владельцами — вида
   (`turf.species`, конфиг) и текстуры (п. 2) — и стоит в списке производных (10.6) с функцией вывода только из объекта
   резолвера; чтение `GAIP_STATE.soil.soilTexture` в AA-блоке — чтение страницы вида I, живьём мёртвое (`undefined`),
   удаляется по инвентарю слоя I. **Доменная часть не решается здесь**: после починки у AA-сайтов, где текстура сегодня не
   доходила, изменятся напечатанные диапазоны — что клиент уже видел; это вопрос владельцу, **10.8(16)**: чинить ли путь
   текстуры к сертификатному коду сейчас (диапазоны изменятся там, где раньше текстура терялась) или зафиксировать нынешнее
   поведение до отдельного решения. До ответа: чтение страницы заменяется на чтение по id **с тем же результатом, что
   сегодня** (то есть `undefined` → та же ветка `deriveCode` без текстуры), и это записывается как известная подстановка в
   инвентарь; сторож — прогон с текстурой в конфиге и текстурой в снимке пробы фиксирует **текущий** код как «запинено, не
   одобрено» (как S9 в четырнадцатом) и краснеет в день ответа.
2. **Текстура — владелец есть, но не одна колонка, а объявленная цепочка фактов-владельцев; чтение страницы в ней стоять не
   может, и одна колонка должна начать отдаваться API.** Факты с владельцами уже существуют: `samples.soilTextureSnapshot`
   (владелец — строка пробы; живая форма, десятое), `sites.soil_texture_override` (колонка; принимается `update()`, но в
   `sitePayload()` **не отдаётся** — по замеру формы `getSite(id)` её нет), `config.turf.aaTexture` и `construction` (конфиг).
   GH-414 уже установил, что один грин считается по одной текстуре на обеих поверхностях, — то есть **порядок разрешения —
   часть контракта**, и устройство владения его допускает: в `FIELD_OWNERS` поле может иметь не одного владельца, а
   **упорядоченный список фактов-владельцев** (`soilTexture: [sample.soilTextureSnapshot, sites.soil_texture_override,
   config.turf.aaTexture, config.turf.construction → вывод]`), каждый читается по id из своего стора, первый непустой
   отвечает, и карта источников записывает **какое звено** ответило (одиннадцатое: источник выводится из чтения). Что не
   допускается: звено «конфиг страницы для активного сайта» — оно и есть чтение страницы; тот же объект конфига берётся по
   id через `getSiteConfig(siteId)` с отметкой сайта (восьмое, п. 2), и тогда это звено «конфиг сайта пробы», не страницы.
   Что требуется от API: `sitePayload()` отдаёт `soil_texture_override` (и `methodology_override` — тот же случай), иначе
   колонка-владелец недостижима по id и звено выпадает; `getSite(id)` в кэше чтения получает эти поля, `store-shapes.json`
   пересъёмка. Ответ на вопрос «укладывается ли»: да — цепочка приоритетов допустима, когда каждое звено — факт с
   владельцем, порядок объявлен в таблице, а ответившее звено записано; не укладывается только звено-страница, и его
   заменяет чтение того же конфига по id.
3. **Поправка принята: `_combinedCtx.monthlyTemps` в продукте никто не читает** — единственный потребитель
   (`word-export-combined.js:2975`) берёт оттуда `hemisphere` и `overseedConfig`; прежний пин, утверждавший, что поле кормит
   послецикловый вызов ANR, разработчик перепроверил и поправил сам. В плане ничего на этом не стояло сверх формулировки
   «читатели `climateMetrics`» в инвентаре; запись остаётся закрытой как чтение того же класса, которое оживёт с первым
   новым потребителем, — верно.

**Не проверено мной:** форма `getSite(id)` без `soil_texture_override` — по замеру разработчика; наличие `methodology_override`
в `sitePayload()` — по памяти о коде `update()`, не перечитывала; строка `:2975` — по его словам.

Двадцать четвёртое: п. 2 (API + цепочка) — в задание Сени; п. 1 — после ответа на 10.8(16); мутации выбирает ревьюер.

**Примечание 17.09.2026 — решение владельца о методологии и его следствие для цепочки текстуры.** Методология в отчёте —
**текущая настройка сайта**, не снимок пробы: владелец — конфиг сайта по id, звено `methodology_snapshot` в цепочку не
заводится (двадцать третье, п. 5 — как записано). Замер координатора: снимки расходятся с конфигом у семи сайтов из девяти
с пробами, и **все 48 снимков — `mlsn`**; это согласуется с Вопросом 8 документа дефектов (колонка `sites.methodology_override`
не заполняется интерфейсом, пробы штампуются умолчанием при записи) — снимок не снят с настройки, а подставлен. К
устройству владения это относится в одном месте: **цепочка текстуры (двадцать четвёртое, п. 2) ставит первым звеном
`samples.soilTextureSnapshot`**. Если снимок текстуры тоже ставится умолчанием при записи (GH-414 нашёл `'loam'` на всех
строках Russley как штамп дня импорта при `sand` в переопределении сайта), первое звено — подстановка, и цепочка обязана
начинаться с настройки сайта, как у методологии. Это доменный вопрос того же рода, **10.8(17)**, в работу не идёт до
решения владельца; до ответа порядок звеньев в `FIELD_OWNERS` для текстуры не фиксируется, реализуется только само
устройство цепочки и отдача колонки API. Замер, который его решает без домена: у проб, созданных через форму Data (не
импорт), совпадает ли `soilTextureSnapshot` с настройкой сайта на момент записи.

**Поправка к цепочке текстуры (двадцать четвёртое, п. 2), 17.09.2026 — владелец назван; три места — не одно и то же.**
Замер координатора по базе принят: снимок — не сплошной штамп (`SampleController.php:480` пишет `soil_texture_override ?:
account->soil_texture`, колонка заполнена у 4 из 12), а **устаревающая копия настройки** — верна до смены настройки, потом
молча расходится (Russley: колонка `sand`, снимок `loam`; Westview: `clay_loam`/`loam`). Моя формулировка «подстановка по
построению» неточна — снята. Проверено по коду (дерево в покое): `resolveSoilTexture()` (`nutrition-program-inputs.js:305-330`)
уже ставит переопределение сайта первым (GH-414 D-2), но берёт его из `GAIP_HUB_CONFIG.soilTexture` — рендера страницы,
только для её активного сайта (`siteTextureOverrideFor`, `:333-344`, сравнение с `GAIP_HUB_CONFIG.activeSiteId`, который
правится на лету — восьмое, п. 2); для любого другого сайта в комбинированном экспорте звено выпадает, и первым отвечает
снимок. `config.turf.aaTexture` не читает никто, кроме восстановления DOM на `/hub` (`site-config-persistence.js:723`);
`aaTextureKey(texture)` (`:346`) выводит `'sands'|'others'` из разрешённой текстуры. `construction` → `'sand'` при
`sand_profile` (`:318`, `:328`, источник `turf-construction`). Сервер: `SampleAnalysisController.php:92-95` — override ?:
account ?? snapshot **?? `'sands'`**.

1. **Владелец текстуры — `sites.soil_texture_override`, настройка сайта; второе звено — `accounts.soil_texture`, настройка
   аккаунта.** Оба — то, что человек выбрал руками; оба уже стоят первыми и на сервере (`resolveSoilTexture` PHP), и в
   резолвере. По аналогии с решением владельца о методологии (текущая настройка, не снимок) рекомендация та же, и это
   10.8(17): **снимок пробы — не звено**, а устаревающая копия настройки на день импорта (комментарий самого резолвера
   `:283-292` называет его так). Реализуется независимо от ответа: колонка отдаётся API (`sitePayload()` →
   `soil_texture_override`, плюс `account.soil_texture` через `getSite(id)` или отдельным полем), звено читается по id из
   строки сайта, а не из `GAIP_HUB_CONFIG` — тогда оно работает и для чужих сайтов в комбинированном экспорте, и
   `siteTextureOverrideFor` с его сравнением по правящемуся `activeSiteId` удаляется. Ответ (17) решает только, остаётся ли
   снимок звеном ниже настройки или уходит из цепочки; до ответа порядок звеньев ниже владельца не фиксируется.
2. **Три места — два разных факта и одна копия производного.**
   - `sites.soil_texture_override` — **текстура почвы**, факт-владелец (п. 1).
   - `config.turf.construction` (`sand_profile`, `native`, …) — **другой факт**: тип основания/конструкция профиля, владелец
     конфиг сайта (форма Settings > Turf, мастер); он не текстура. Вывод `sand_profile → 'sand'` (`:318`) — **умозаключение о
     текстуре из конструкции**, печатаемое как факт, — по правилу пятнадцатого, п. 3 это подстановка правдоподобного
     значения при пустой текстуре; звено `turf-construction` идёт в инвентарь подстановок, а остаётся ли оно допустимым
     выводом — часть 10.8(17) (агрономически оно обосновано, но решение о том, что печатать без настройки, — владельца).
   - `config.turf.aaTexture` (`'sands'` у пяти сайтов, `null` у семи) — **не факт, а сохранённая копия производного**:
     ведро AA (`sands|others`) выводится из текстуры функцией `aaTextureKey()` на чтении; поле — след легаси-снимка формы
     `/hub` (`.gaip-aa-soil-texture`), читателей нет. Из таблицы владения исключается, в путях записи не участвует
     (`PATCHABLE_SECTIONS`/белый список `patchConfig` — `turf.aaTexture` в `clear`-список или игнор), из инжекта в DOM
     (`:723`) — вывод из разрешённой текстуры, не из копии. Расхождение «Russley: колонка `sand`, `aaTexture null`» после
     этого невозможно, потому что второго места нет.
3. **`sample-soil` (`soil.soilTexture || soil.texture` в payload пробы, `:324`) — не установлено, что это.** Если её пишет
   парсер лабораторного отчёта, это **наблюдение о пробе** — факт с владельцем-пробой, и место ему в цепочке решает
   владелец (наблюдение выше настройки или ниже); если payload этого поля никогда не несёт — мёртвое звено, удалить.
   Разработчику снять: есть ли писатель `payload.soilTexture`/`texture` в импортёрах (`hub-persistence.js`, парсеры Hill
   Labs) и сколько проб в базе его несут.
4. **Серверная подстановка `?? 'sands'`** (`SampleAnalysisController.php:95`) — тот же класс, что `region || 'AU'`, на
   сервере: при отсутствии текстуры анализ считается по песку и печатается как факт. Инвентарь подстановок сегодня только по
   `assets`; серверная сторона получает свой список (PHP-grep по `?? '` / `?: '` на полях таблицы владения) с тем же
   храповиком; что делать при отсутствии текстуры — уже отвечено принципом владельца («нет данных — не выводим», 10.8(15)),
   конкретно для анализа проб — уточнить в (17).

**Не проверено мной:** значения колонок и снимков по сайтам — по замеру координатора; писатель `payload.soilTexture` (п. 3);
что `accounts.soil_texture` заполнен у аккаунта dev.

Поправка — в задание Сени вместе с двадцать четвёртым п. 2 (API + звено по id + вывод `aaTexture`); мутации выбирает ревьюер.

**Закрытие по решению владельца, 17.09.2026 (10.8(17)).** Цепочка текстуры: `sites.soil_texture_override` →
`accounts.soil_texture` → не разрешена. Звенья `sample-snapshot`, `sample-soil`, `turf-construction` и серверное
`?? 'sands'` (`SampleAnalysisController.php:95`) удаляются, а не переупорядочиваются; `methodology_snapshot` и
`soil_texture_snapshot` для интерпретации не читаются нигде. Замер «совпадает ли снимок с настройкой на момент записи» не
нужен. Пункт 3 выше (писатель `payload.soilTexture`) снимается: наблюдение лаборатории настройкой не является и в цепочку
не входит. `FIELD_OWNERS` для текстуры фиксируется двумя звеньями; в инвентарь подстановок уходят четыре удалённых звена как
записи «удалено, 17.09».

**Двадцать пятое уточнение, 17.09.2026 — вселенная сверки выводится из страницы, а не из списка имён.** Замер принят:
обёртка песочницы оборачивает два глобала, заданных именами (`export-page-sandbox.js:307`), мутация «прийти к тем же
данным под третьим именем» не замечена (43/43 → 43/43). Формулировка ревьюера верна: обходится не устройство, а имя. Это
та же форма, что в инвентаре подстановок (двадцать второе): множество, о котором утверждает проверка, задано способом,
который мутация правит вместе с кодом. Чтение при дереве под мутацией, ревьюеру подтвердить: `gaip-site-context.js` (107
строк), `export-page-sandbox.js:18, 101-103, 307-339`, счётчик глобалов.

1. **Заявка «`GAIP_SiteContext` — второй путь к конфигу» не подтверждается.** Объект экспортирует только `getSiteId`,
   `getSiteLabel`, `isGSSH`, `isGAIP` (`gaip-site-context.js:97-103`); `getConfig` у него нет — мутация ревьюера его
   завела сама, о чём он сказал. `getSiteId()` делегирует `GAIP_SampleManager.getActiveSiteId()`, последним звеном —
   `GAIP_STATE.site.id` (`:66-77`). Значит это **корень личности сайта**, не корень копии конфига: второй путь к ответу
   «какой сайт», с падением в состояние страницы. В корни копии пятнадцатого он не входит; входит в перечень корней
   личности (восьмое, п. 2: `GAIP_HUB_CONFIG.activeSiteId`, `SampleManager.getActiveSiteId`, `GAIP_STATE.site.id`, URL
   `gssh_venue`) — и тот перечень задан именами, то есть той же формы. Замечание, не в работу: `var SC = GAIP_SiteConfig ||
   GAIP_SiteContext` в трёх интеграциях (`nz:115`, `au:125`, `uk:705`) — запасной путь к объекту без `getConfig`; при
   отсутствии `GAIP_SiteConfig` вызов упал бы. Сегодня мёртв, потому что `GAIP_SiteConfig` грузится раньше; чинить не
   здесь (GH-474), но при переносе интеграций на чтение по id из строки сайта это `||` удаляется.
2. **Как выводится вселенная.** Правило одно: сторона «есть» выводится из артефакта, который мутация не может править
   вместе с кодом; сторона «ожидаем» объявляется в тесте; равенство в обе стороны. Список скриптов уже так устроен —
   читается из `$hubScripts` в `reports/export.blade.php` (`export-page-sandbox.js:101-103`), и его мутация без правки
   страницы невозможна. Сторы — нет. Вывод для сторов: два прохода. Первый проход грузит те же скрипты в чистый контекст без
   обёрток и снимает разницу глобалов до/после (`Object.getOwnPropertyNames(sandbox)`) — это «что страница определяет как
   глобал» (в `assets` таких присваиваний `global.GAIP_*`/`GSSH_*` 233 уникальных — счётчик под мутацией, не аргумент).
   Второй проход до загрузки скриптов заводит неизменяемую привязку-обёртку на **каждое** имя из первого (тем же
   `defineProperty`, устройство `:307-339` не меняется), а после экспорта снова снимает разницу глобалов: имя, которого не
   было в первом проходе, — находка (алиас под новым глобалом). Ловушка `get` записывает **любое** достижение, не только
   функции (`:311-315` пишет только `typeof === 'function'` — чтение данных мимо метода сегодня не видно), и складывает
   `name.key` в `reached`. Тогда мутация ревьюера ловится дважды: `GAIP_SiteContext` обёрнут, потому что страница его
   определяет, и `getConfig` на нём — ключ вне ожидаемого перечня; а алиас `window.X = GAIP_SiteConfig` — глобал вне
   первого прохода. Ожидаемая сторона — фиксированный список `name.key`, который экспорт вправе достигать (`GAIP_SiteConfig.
   getSiteConfig`, `GAIP_SampleManager.getSample` …), сверка `reached` с ним в обе стороны: лишнее достижение — падение,
   недостигнутое ожидаемое — падение (иначе список стареет молча, тот же класс, что Q26 B). Что не покрывается и говорится
   прямо: ссылка, взятая скриптом на **внутренний** объект стора до обёртки (не глобал, а поле глобала), обёрткой глобала
   не видна — для этого `store-shapes.json` уже фиксирует форму, а глубина обёртки (двенадцатое) — по тем же формам.
3. **Относится ли к остальным перечням.** Да, ко всем, где сторона «есть» набрана именами в тесте. Проход по заведённым
   сегодня:
   - список скриптов — выведен (blade); в порядке;
   - `store-shapes.json`, `page-state-shapes.json` — сняты с живой страницы; в порядке, при условии что снятие не
     фильтрует по именам (ревьюеру проверить, что снимок берёт `getOwnPropertyNames`, а не перечень);
   - список файлов статической проверки — выведен из blade (шестнадцатое); в порядке;
   - **сторы обёртки** — имена; исправляется п. 2;
   - **корни копии (пятнадцатое) и корни личности сайта (восьмое, п. 2)** — имена; становятся стороной «ожидаем», сторона
     «есть» — `reached` из п. 2: всё, до чего экспорт дотянулся, и есть его корни; корень вне объявленных — падение;
   - **`FIELD_OWNERS`** — объявление, ему положено быть списком, но его полнота сверяется с выведенным: колонки `sites`
     из миграций и ключи конфига из `store-shapes.json` — поле, которое есть в хранилище и не имеет владельца, — падение
     (двадцать первое требовало полноты, способа не называло — вот способ);
   - **`FIELD_PATHS` резольвера** — объявление; сторона «есть» — что экспорт реально читает, из потока данных (десятое),
     не из списка;
   - **вселенная инвентаря подстановок** = `FIELD_OWNERS` + производные (двадцать второе) — объявление; сторона «есть» —
     поля, которые доходят до `word/document.xml` (обход часовых, девятнадцатое): поле в документе без записи во
     вселенной — падение; второй независимый сборщик остаётся, но он проверяет сбор, а не вселенную;
   - **список освобождений** (двадцать первое, паспорт) — объявление по определению; сторона «есть» — сам код, на котором
     сверяется полный текст узла; в порядке.
   Правило в паспорт стража (двадцать первое) отдельной строкой: «вселенная: выведена из ___ / объявлена, сверена с ___».
   Страж без этой строки не проходит мета-страж `guard-passports.test.js`.

Не проверено мной: что снятие `store-shapes.json` не фильтрует по именам; поведение `defineProperty` для глобалов,
которые скрипты объявляют через `var` на верхнем уровне (в `vm` они становятся свойствами контекста, обёртка должна
переживать и это — замер ревьюера); сколько из 233 имён реально достигает экспорт. Порядок: п. 2 — в задание Сени как
правка обёртки, до неё замер ревьюера с той же мутацией остаётся красным по определению.

**Двадцать шестое уточнение, 17.09.2026 — тканевая и водная ветви загрузки пробы в песочнице не существуют; что из
принятого за день на них стоит.** Замер ревьюера принят (выключенная загрузка tissue/water: gh479 8/8, gh459 26/26,
gh471 43/43 — все зелёные). Прочитано при дереве в покое: `sample-manager.js:1345-1440` (живой `loadSample`), `:2443-2458`
(живой `setActiveSite`), `export-page-sandbox.js:455-560` (стаб), `word-export.js:9105-9290` (откуда экспорт берёт
ткань и воду), `word-export-combined.js:660-700, 1000-1015`.

**Устройство, по коду.** Живая цепочка для ткани: `loadSample('tissue', id)` → `populateTissueFields` заполняет
`input[data-val]` модуля тканей → `input`/`change` на каждом поле → `hub-tissue-v3` пересчитывает и пишет
`GAIP_STATE.tissue` / `tissueResults` → экспорт читает **только оттуда**: числа из `GAIP_STATE.tissue` (`:9124-9137`),
запасной путь — те же `input[data-val]` со страницы (`:9150-9156`) и `__GAIP_TISSUE_LAST__` (`:9161`); подпись и дата —
`getActiveSample('tissue')` по **указателю активного сайта**, не по id (`:9113-9121`). Вода так же: `_GAIP_EXPORT_BLEND_WATER`
→ `GAIP_STATE.water` → `waterResults` (`:9255-9260`), подпись по указателю (`:9263-9273`). Стаб `loadSample` для `tissue` и
`water` меняет только `activeSampleIds` и возвращает `{success:true, ...}` (`export-page-sandbox.js:519-532`); формы не
заполняет, событий не шлёт, `GAIP_STATE.tissue`/`water` не меняются. Значит в песочнице тканевые и водные числа документа
приходят **только из стаба состояния страницы** (page-state-shapes / яд) и никогда — из загруженной пробы. Первое звено
живой цепочки отсутствует, остальные не срабатывают.

**1. Что из принятого за день стоит на этих ветвях — поимённо.**
- **gh471 «источники читаются, не объявляются», тканевая и водная половины** (`:441-478`). Доказано, что резольвер
  **вернул** `samples.tissue.id` / `samples.water.id` по запрошенному id из корзины с приманкой. Эффекта нет: в
  `word-export.js` и `word-export-combined.js` **ни одного читателя** `samples.tissue` / `samples.water` (grep — ноль);
  экспорт берёт подпись по указателю, числа — из состояния. Вывод «экспорт читает ткань и воду по id» **не доказан**;
  доказано только, что резольвер умеет их выбрать, и что этот выбор никто не потребляет. Это класс «фикстура описывает
  ответ» в чистом виде: тест на возвращаемое значение без потребителя (Q26, сигнал «положительное совпадение как эффект»).
- **gh461-turf-keys, пять записей** `tissue.sampleLabel`, `tissue.testDate`, `water.sourceLabel`, `water.labRef`,
  `water.testDate` как «чтения страницы» (`:315-319`). В песочнице корзины ткани и воды пусты, `getActiveSample` отвечает
  `null`, и исполняется только запасная ветвь (DOM). Первичная ветвь — «активная проба по указателю» — не исполняется
  никогда; она тоже чтение состояния страницы (10.7(2): по указателю, не по id), но это не измерено. Запись верна для
  запасной ветви, полнота — нет.
- **gh461-provenance, GH-475 `ALLOWED_IN_DOCUMENT`** (`:242-260`): `GAIP_STATE.waterResults` в списке — наблюдено (яд
  дошёл); `GAIP_STATE.tissue`/`tissueResults` в списке **нет**, и это не «ткань чиста», а отсутствие без положительного
  контроля: тканевый блок печатается только при `data.tissue.hasData` (`:9166-9168`, требует числа N/K/P > 0), часовой
  через `parseFloat` даёт NaN, `hasData` ложь, блок опущен, часовой не доходит. Класс A из Q26 — зелёный по причине, не
  связанной с проверяемым. Список «может только сжиматься» на ткани ничего не держит.
- **gh479 «отказы комбинированного цикла»** (8/8): в фикстуре записи без `waterSampleId`/`tissueSampleId`
  (`:74`), ветви `sm.loadSample('water'|'tissue')` (`word-export-combined.js:678, 686`) и ветвь `clearTissueForm`
  (`:688-692`, `GilbaSiteSelector` — в песочнице ноль вхождений) **не исполняются**. Выводы GH-469/GH-479 об отказе и
  указателе доказаны для почвенной ветви цикла; для двух других — нет. Мутация ревьюера потому и невидима: выключено то,
  что ни разу не звалось.
- **gh477 «сторы по ключу»** (`KEYED_STORES`, `export-page-sandbox.js:552`): `byKey` читает `allSites[id].soil`; корзины
  ткани и воды правилу двух записей не подчинены, там по нулю записей. Двадцать второе («два элемента в каждом сторе»)
  выполнено для почвы, не для всех видов.
- **gh481 «экстрактант следует методологии»**: доказано для резольвера по id. Живой `setActiveSite` при настоящей смене
  шлёт `gaip:site-changed` (`:2452-2456`), стаб — нет; среди слушателей `ammonium-acetate-methodology.js:518` — сбрасывает
  `methodologyExplicit` и через 300 мс `updateMethodologyVisibility`, которая **автоматически выбирает AA для NZ**, если
  методология «по умолчанию». После GH-480 экспорт берёт методологию из конфига по id, так что на печать это не влияет;
  влияет на `.gaip-soil-methodology` и через него на собственный прогон страницы (вид II). Не измерено; вывод gh481 стоит,
  оговорка — только для резольвера. Число слушателей «шесть» не проверяла: в `assets` их больше сорока, сколько грузит
  `/reports/export` — по списку blade.
- **Не стоят на этих ветвях:** gh459 own-temperatures, gh476 region, gh468 site named, gh469 calendar inputs, gh477
  substitution-for-emptiness, дымоход, двадцать четвёртое (текстура), двадцать пятое (вселенная), замер «пять контейнеров
  живы, мёртв только `fertility`» — тот снимался с геттера состояния, не через `loadSample`.

**2. Класс и как закрывается.** Формулировка ревьюера верна: стаб — **переписанное от руки поведение продукта**, и
фикстура сверяет его с продуктом по форме ответа, а продукт живёт эффектами. Пять расхождений — следствие одного: в
песочнице стоят два переписанных модуля (`GAIP_SampleManager`, `GAIP_SiteConfig`) при том, что остальные скрипты страницы
грузятся настоящие из blade. Решение (моё, архитектурное): **граница подмены переносится на сеть.** В песочнице
исполняется настоящий `sample-manager.js` (и `site-config`), подменяются только ответы сервера, снятые с живой страницы
как фикстуры (`GET /api/sites`, пробы по сайту — какие именно маршруты читают эти два модуля, снять разработчику). Тогда
`loadSample` заполняет четыре формы по своим картам, шлёт `input`/`change`, отвечает `Invalid data type`, `setActiveSite`
шлёт `gaip:site-changed` при смене и зовёт `_initSite` — потому что это тот же код, а не его пересказ; п. 3 исчезает
вместе с ним. Для этого формы должны существовать: DOM песочницы сегодня — заглушка с одной почвенной формой из
`store-shapes.soilForm`; нужна разметка, на которой живут `.gaip-tissue-*`, `input[data-val]` модуля тканей,
`.gaip-water-*`, LOI — jsdom с той же разметкой, что грузит страница (какой blade/partial даёт эти элементы на
`/reports/export` — снять разработчику, не по памяти). Рекомендация ревьюера — снимать перечень побочных действий —
остаётся, но в другой роли: **не источник для стаба, а паритетный замер**: один и тот же сценарий (загрузить сайт A, пробу
почвы, ткани, воды; переключить на B) исполняется на живой странице (Playwright) и в песочнице, и с обеих сторон снимается
одинаковая книга эффектов — какие поля какое значение получили, какие события на каких элементах, в каком порядке, что
вернул метод, что лежит в `GAIP_STATE.tissue`/`water` после. Равенство в обе стороны; книга в `store-shapes.json` рядом с
формами, с датой снятия. Это ось носителя (двадцать первое) для песочницы как измерительной среды: паспорт каждого стража,
который читает документ из песочницы, получает строку «среда: паритет эффектов от ___».
Положительный контроль, без которого п. 2 не принимается: мутация ревьюера (выключить загрузку ткани и воды в цикле)
должна стать красной; и первый содержательный тест на ветвях — аналог gh459 для ткани и воды: одиннадцать тканевых
чисел и ионы воды пробы X сайта A в документе, когда страница держит пробу Y сайта B, включая случай зоны без своей
тканевой пробы (`clearTissueForm`: в документе тканевого блока нет, хотя предыдущая зона его имела). До п. 2 всё
перечисленное в п. 1 читается как «не измерено», и в отчёты по этим тестам это слово ставится явно.

**3. Стаб строже живого** (`samplesBySite[pointer][kind]` без ленивой корзины, живой — `_initSite` `:310-324`). Ложный
красный того же класса, и он уходит вместе со стабом по п. 2. Пока стаб жив, править его форму по памяти нельзя (это и
есть класс): единственный допустимый источник — книга эффектов из п. 2, и до её снятия расхождение фиксируется в отчёте
как известное, а не чинится.

**Не проверено мной:** какие маршруты читают `sample-manager.js` и `site-config` на `/reports/export` (граница подмены);
какая разметка даёт тканевую, водную и LOI формы на этой странице; число слушателей `gaip:site-changed` среди скриптов
страницы; размер п. 2 — это инженерная оценка, даю после ответа разработчика по двум первым пунктам. Порядок: п. 2 выше
остальной очереди по 10.6, как поставлено; до его завершения замеры на тканевой и водной ветвях не заказываются.

**Двадцать седьмое уточнение, 17.09.2026 — 10.8(7) и 10.8(12) закрыты владельцем; как решения ложатся на устройство
владения.** Заявки координатора проверены по коду (дерево: разработчик в `nutrition-program-inputs.js` и API, `word-export.js`
и `gaip-morning-briefing.js` читала как есть): `'Perennial Ryegrass'` в `word-export.js` семь раз (`:8258, 8286, 8293, 9209,
13683, 13734, 13738`), `'Couch'` три (`:9122, 9775, 9795`); умолчания прогона с пустыми входами — восемь записей
`EMPTY_DEFAULTS` в `gh461-export-turf-keys.test.js:199-208`. Подтверждается.

**1. Вид травы (10.8(7)): печатать тот, что установлен на сайте; захардкоженные названия убираются.**
- **На владение ложится без нового правила.** Вид — факт сайта, владелец `config.turf.species` по id (`FIELD_OWNERS`, turf.*
  → конфиг); резольвер уже отдаёт `species` из конфига или `null` + `sources.species = 'unresolved'` (десятое). Подсев —
  тот же владелец, поле `turf.overseedSpecies` (резольвер его отдаёт — фикстура gh461-provenance `:47`); литерал `:8258`
  (`coolOverseed = hasExplicitOverseed ? 'Perennial Ryegrass' : ''`) — подстановка имени подсева, уходит на `overseedSpecies`
  из резольвера. Сорт — `turf.variety`/`turf.overseedVariety`, тот же владелец; `'generic'` в `:8248, 8287, 8294, 8299, 6537,
  10073, 10093, 11363, 11529` — это не название, а часовое значение «сорта нет», которым потребители проверяют пустоту
  (`!== 'generic'`); убирается вместе с названиями: значение `''`, проверки — на пустоту. `'Not specified'` в сравнениях имени
  сайта (`:7656, 11222`) после девятнадцатого (имя обязательно) мертво — сравнение на пустоту.
- **Пусто или раздел не печатается — по уже принятому правилу, без нового решения:** поле печатается пустым, раздел, который
  без вида **посчитать** нельзя, опускается (образец 10.8(10) для локации и 10.8(15) для региона; b35fix313/314 для
  нутриционных разделов). Разбор восьми записей `EMPTY_DEFAULTS` по этому правилу:
  - `turf.effectiveSpecies`, `turf.speciesDisplay`, `varietyTraits.lookupSpecies` → `''`, строка Species в блоке сайта
    (`:11525`) пустая; `turf.effectiveVariety`, `varietyTraits.lookupVariety` → `''`, таблица сортов не запрашивается.
  - `soil.speciesName` (`'cool-season grass'`/`'Couch'`, `:9122, 9126, 1239`) — слово в тексте pH/CEC; без вида фраза о
    «cool-season grass» — утверждение о поле, которого нет: предложения, где вид — подлежащее, опускаются, остальной текст
    раздела печатается. Это правка по месту в генераторах текста; список предложений — разработчику снять из `:1239` и
    соседних, не по памяти.
  - `soil.isC3Species` (`true` по умолчанию) — производный от вида классификатор C3/C4; по правилу двадцать третьего
    (классификаторы заканчиваются `return null`) без вида — `null`, не `true`.
  - `tissue.rangeSpecies` (`'turf'`, `:9208-9210`) и `data.tissue.ranges` — диапазоны достаточности **выбираются по виду**
    (cool/warm): без вида таблица не выбирается, раздел тканевых диапазонов и статусов опускается; сами тканевые числа
    (если есть) печатаются без статуса. Литерал `'turf'` в `:4224-4228, 4394, 5657` — то же слово-подстановка в тексте.
  - PGR (`:13683, 13734, 13738`) — целевой вид PGR-программы: без вида раздел PGR-рекомендаций по виду опускается.
- **Следствие того же класса, не решённое буквой ответа — 10.8(18).** Кривая GP выбирается по `turf.isC4`/`effectiveIsC4`,
  и при неразрешённом виде они `false` (`EMPTY_EXPECTED`, gh461-turf-keys `:221-223`): без вида документ считает по
  C3-кривой, то есть месячный N, программа и календарь строятся на подставленной кривой. Это подстановка без названия, тот
  же класс, что `region || 'AU'`; по принципу 10.8(15) («нет данных — не выводим») разделы, стоящие на кривой, без вида
  опускаются. Решение о видах закрывает названия; опускать ли программу целиком — владельцу, потому что меняет состав
  документа клиента. Названия правятся независимо; до ответа (18) кривая остаётся как есть, с записью в инвентаре.
- **Сторож.** `EMPTY_DEFAULTS` с пометками `awaits` упраздняется: правило «у каждой функции вывода с литералом стоит
  пометка» превращается в «таких функций нет» — при `species`, `variety`, `overseedSpecies`, `overseedVariety`, `coolOverseed`
  равных `null` восемь путей дают `''`/`null`, и ни в одном поле нет непустого значения, которого нет в `inputs` (уже
  принятое устройство второго уточнения, по значению). Опущенные разделы — парным прогоном: фикстура с видом печатает раздел
  (положительный контроль), без вида — в `word/document.xml` нет заголовка раздела и нет ни одной из строк-названий;
  «каждая утверждаемая строка не встречается в исходнике `word-export.js`» (правило дымохода) после удаления литералов
  выполняется само. В инвентаре подстановок записи по видам переходят в «удалено, 17.09».

**2. Слот названия на карточке сайта (10.8(12)): пусто.**
- Правка одна: `gaip-morning-briefing.js:474` — при пустом `location_name` слот пустой, координаты не печатаются нигде
  на карточке. Чтение уже по владельцу (`getSite(id)`, GH-477).
- **Живой e2e на `/morning-briefing` получает ожидаемое значение и перестаёт быть `test.failing`:** строка с `location_name
  = NULL` сеется в dev-базе напрямую (после девятнадцатого через API не создать), обычная загрузка; утверждения: текст слота
  названия карточки этого сайта — пустая строка; в тексте всей карточки нет координат сайта ни в одном формате (`toFixed(3)`,
  сырые, через запятую); парный прогон — сайт с названием печатает название (положительный контроль); строка удаляется после.
  Чистый контекст парой, по правилу замеров.
- **Что ещё меняется:** запись инвентаря «карточка печатает координаты» — единственный живой пример, на котором стоит тест
  gh477 `:107` («living example is in the list»), — переходит в «удалено, 17.09», и тест переписывается с «пример в списке» на
  «в списке нет ни одной записи со статусом «живая» для `gaip-morning-briefing.js`», иначе он краснеет от самого исправления.
  Второй живой читатель, `gaip-field-log-analysis.js`, печатает ли что-либо вместо пустого названия — не проверяла; тому же
  правилу подчиняется, разработчику снять при переезде на `getSite(id)`.

**3. Контекст, не задание:** полоса стресса (вопрос 28 документа владельца) и живая проверка цвета в документе отложены
владельцем; в 10.8 не заводятся.

Не проверено мной: список предложений с видом-подлежащим в текстовых генераторах; поведение `gaip-field-log-analysis.js` при
пустом названии; что ни один потребитель не читает `'generic'` как ключ таблицы сортов (`gaip_getVarietyTraits`, `:10093`).
Порядок: п. 1 (названия) и п. 2 — одно задание Сене после deriveCode/текстуры; (18) — владельцу, работу не держит.

**Двадцать восьмое уточнение, 17.09.2026 — 10.8(18) закрыт с условием: у чтения три исхода, и третий не имеет права
выглядеть как второй.** Решение владельца: вида нет — не печатать; условие — убедиться, что вида действительно нет, а не
что его не получили. Прочитано при дереве под правкой разработчика (`nutrition-program-inputs.js`, ревьюеру подтвердить):
`record()` (`:993-997`) сводит `undefined` (путь отсутствует), `null` и `''` в одно `'unresolved'`; `getSiteConfig()` (`:529`)
отвечает `null` и для сайта, которого нет в кэше, и до прихода `GET /api/sites`; кэш (`site-config-persistence.js:355-370`)
при неудаче загрузки пишет `warn` и `onComplete(false, 'failed')`, состояния не хранит, `getSite`/`getConfig` (`:1130-1134`)
отвечают `null` одинаково для «не загружено», «загрузка упала» и «такого сайта нет». Заявка координатора подтверждается:
сегодня второй и третий исходы неразличимы в трёх местах подряд, и имя `'unresolved'` — общее для обоих.

**1. Три исхода — как различаются в устройстве, не по имени.** Исход выводится из самого чтения, флагом рядом с ним не
пишется (урок GH-471):
- **`present`** — путь прочитан из записи владельца, значение непустое.
- **`empty`** — законное отсутствие. Условия, все три: (а) кэш в состоянии `loaded` — `GET /api/sites` завершился успехом в
  этой сессии; (б) запись владельца с этим id есть (`getSite(id)`/`getConfig(id)` не `null`); (в) для колонки строки сайта —
  ключ в записи **есть** (`hasOwnProperty`), значение `null`/`''`; для поля JSON-конфига — ключ отсутствует или пуст (конфиг
  без ключа — «не задано», это законно; для колонок отсутствие ключа законным не бывает, см. ниже).
- **`unavailable`** — всё остальное, с причиной из закрытого перечня: `not-loaded` (экспорт вызван до завершения
  загрузки), `load-failed`, `no-record` (id нет среди загруженных), `no-field` (колонка владельца в ответе API отсутствует —
  дрейф API; ровно случай GH-471, когда `locationName` читался с ключа, которого нет, и выглядел как «не задано»),
  `read-threw`.
Для этого кэш отдаёт состояние **значением**: `GAIP_SiteConfig.loadState()` → `{ state: 'idle'|'loading'|'loaded'|'failed',
at, count }`, выставляемое теми же `.then`/`.catch`, что наполняют `_configs`/`_siteRows`, — не отдельным флагом, который
можно забыть. `no-field` доказывается формой ответа API: ключи строки сайта в `store-shapes.json` сняты с живой страницы;
поле из `FIELD_OWNERS` с владельцем «колонка», чей ключ в живой форме отсутствует, — `unavailable`, не `empty`.
Резольвер: `sources[field]` получает три значения (`'site-config'`/`'site-row'`/`'sample'`… = present, `'empty'`,
`'unavailable'`), `provenance[field].reason` — причину; имя `'unresolved'` умирает. **Производные факты** (регион из
координат, `deriveCode` из методологии и текстуры, `aaTexture` из текстуры) наследуют худший исход входов:
`unavailable` > `empty` > `present`; регион без координат — `empty`, регион при недоступных координатах — `unavailable`.

**2. Что происходит с документом.** `empty` — раздел опускается, и в реестре документа стоит «опущено: вид травы не задан
для сайта X» (устройство двадцать третьего, п. 1). `unavailable` — **документа нет**: резольвер бросает типизированную
ошибку `InputsUnavailable { siteId, fields: [{ field, reason }] }` до `collectData`, экспорт показывает сообщение с сайтом,
полем и причиной, файл не создаётся; комбинированный экспорт останавливается целиком, не пропускает сайт. Бросок, а не
возвращаемое поле, выбран нарочно: поле-ответ можно не прочитать (GH-469), ошибку — нет. Укороченный документ с пометкой
отвергнут: его можно переслать дальше, и это ровно тот документ, который владелец запретила. Альтернатива —
комбинированный экспорт печатает остальные сайты и в реестре называет непрочитанный — не выбрана, но названа.
Порядок ожидания: экспорт на `/reports/export` до `loaded` не запускается (кнопка ждёт состояния кэша по значению), так
что `not-loaded` в норме недостижим и остаётся защитой, а не сценарием.

**3. Чем доказывается, что различие живое, а не объявленное.** По пяти осям:
- **Вход, различимость:** для каждого поля из перечня владельца (вид, регион, методология, текстура, название места,
  сертификатный код) три прогона песочницы с одной фикстурой: `present`; `empty` — строка/конфиг сайта с полем `null`;
  `unavailable` — по одной на каждую причину: `fetch` отклонён (`load-failed`), экспорт до разрешения промиса
  (`not-loaded`), id вне загруженных (`no-record`), строка сайта без ключа колонки (`no-field`), `getSite` бросает
  (`read-threw`).
- **Носитель, момент:** утверждение — не «раздела нет», а **разница носителей**: `empty` даёт blob и реестр с записью об
  опущенном; `unavailable` даёт ноль blob и ошибку с `siteId`, `field`, `reason`. Утверждать отсутствие раздела в прогоне
  `unavailable` запрещено — это и был бы ложный зелёный из условия владельца.
- **Положительный контроль:** прогон `present` печатает раздел; иначе «опущено» ничего не значит.
- **Мутация ревьюера, обязательная:** свернуть различие (`unavailable` отвечает как `empty`) — прогон `unavailable`
  порождает blob → красный. Вторая: `loadState()` отвечает `'loaded'` до завершения `.then` — прогон `not-loaded` даёт
  документ → красный.
- **Живой парный замер:** обычная загрузка `/reports/export` → документ; тот же сценарий с перехваченным `/api/sites`
  (Playwright `route.abort`) → документа нет, сообщение называет сайт; обе цифры рядом, условие названо (правило замеров:
  искусственное условие — только парой с обычным).
Статически — ничего: имя `'unresolved'` не ищется grep'ом, его смерть доказывается тем, что ни один прогон его не отдаёт
(сверка множества значений `sources` = {present-источники, `'empty'`, `'unavailable'`} по всем трём прогонам).

**4. Ось носителя, как названо.** Да: «не выводим» — утверждение об отсутствии, и оно верно только над перечисленной
вселенной причин; продукт обязан показать, что осмотрел владельца и нашёл пустоту, — так же, как проверка обязана
осмотреть то, о чём утверждает. Общее правило в паспорт стража и в 10.7: **любое «не печатаем» несёт исход чтения, а не
только пустое значение.**

**Не проверено мной:** кто сегодня потребляет `onComplete(false, 'failed')` и показывает ли страница что-либо при падении
загрузки; тот же класс у проб — `loadSample` отвечает «Sample not found» и для незагруженного хранилища, и для
несуществующей пробы (`sample-manager.js:1347-1350`), — в перечень владельца не входит, называю как замечание, не
расширяю. Порядок: п. 1–2 — одно задание Сене после deriveCode/текстуры, перед правкой видов (двадцать седьмое), потому что
опускание разделов без этого устройства и есть запрещённое поведение.

**Поправка к двадцать восьмому, 17.09.2026 — отчёт выгружается всегда; пометка как инструмент владельца.** Решение
принято: вариант «сообщение вместо документа» и бросок `InputsUnavailable` до `collectData` снимаются; комбинированный
экспорт не останавливается. Три исхода и различение `empty`/`unavailable` (п. 1 двадцать восьмого) остаются без изменений.
Меняется только п. 2 — что делает документ. Прецедент в коде (дерево под правкой, ревьюеру подтвердить): GH-362/367
(`word-export.js:5936-5950`) при опущенной программе оставляют заголовок раздела и печатают абзац, называющий, какая
привязка не сработала, с доводом «раздел, который молчит, читается как “у сайта нет программы”». Пометка строится на этом
образце, второго механизма не заводится.

**1. Два носителя, один источник.** Оба порождаются из карты исходов резольвера (`sources`/`provenance` по всем полям
`FIELD_OWNERS` + производные), никогда — из текста, набранного в месте печати.
- **На месте раздела** (образец GH-367): заголовок раздела остаётся, вместо тела — один абзац. Две разные формы:
  `empty` — «Not included: turf species is not set for this site (Settings › Turf).»; `unavailable` — «Not included: turf
  species could not be read (site settings: load-failed). This is not a statement about the site.» Формулировки —
  черновик, окончательный текст владельца; устройство — две формы, не одна, и код причины печатается буквально.
- **Реестр данных** — таблица сразу после Site Information (`:11520`), заголовок «Data availability» печатается **всегда**,
  в том числе строкой «All site data present» при полном наборе, чтобы носитель был жив в каждом документе, а не появлялся
  только при беде. Строка на каждое поле с исходом ≠ `present`, включая поля, которые раздел не опускают (сорт, подсев):
  `Field | Where it lives | Status | Reason | Sections affected`. `Where it lives` — владелец из `FIELD_OWNERS`, человеческим
  адресом (Settings › Turf; Settings › Location; Account); `Status` — `Not set` либо `Could not be read`; `Reason` — пусто для
  `Not set`, код из закрытого перечня (`not-loaded`, `load-failed`, `no-record`, `no-field`, `read-threw`) для `Could not be
  read`; `Sections affected` — из той же карты, какие разделы стоят на поле (`FIELD_CONSUMERS`, выводится из зависимостей
  печати, не список в тесте). Комбинированный экспорт — реестр на каждый сайт, под его блоком Site Information.
  Клиент читает `Status`, мы читаем `Reason`: одна строка на оба случая не допускается конструкцией таблицы — у
  `unavailable` всегда непустой `Reason`, у `empty` всегда пустой, и это утверждается тестом (п. 3).
- Ошибка чтения дополнительно уходит в `console.error` с тем же `{siteId, field, reason}` — для дымохода (ноль
  `console.error` на законном состоянии) `empty` не ошибка, `unavailable` — ошибка, и дымоход различает их сам.

**2. Что меняется в двадцать восьмом.** П. 2 целиком заменяется п. 1 выше. Гейт «кнопка экспорта ждёт `loaded`» остаётся
как поведение страницы, не документа: если экспорт всё же запущен раньше, документ печатается с `not-loaded` в реестре.
Свойство «ответ нельзя не прочитать», ради которого выбирался бросок, обеспечивается иначе: реестр строится экспортом из
карты резольвера, и тест п. 3 сверяет карту с документом; потребитель, проигнорировавший исход, даёт расхождение.

**3. Чем проверяется, что пометка появляется ровно тогда, когда должна.** Три прогона на поле, как в двадцать восьмом,
утверждения о `word/document.xml`:
- **Положительный контроль:** фикстура с полным набором — заголовок «Data availability» есть, строк нет, строка «All site
  data present» есть, все разделы на месте. Без этого прогона «строк нет» ничего не значит.
- **Равенство карты и документа, в обе стороны:** множество строк реестра (поле, статус, причина) `===` множеству записей
  `sources` того же прогона с исходом ≠ `present`. Ожидаемое не набирается в тесте — оно снимается с резольвера в том же
  прогоне; вселенная строк — `FIELD_OWNERS` (двадцать пятое: объявлено, сверено с выведенным).
- **Различимость носителем:** нормализованный diff `document.xml` между прогонами `empty` и `unavailable` одного поля
  состоит ровно из строки реестра и абзаца на месте раздела, и ни из чего больше; в `empty` кода причины нет нигде в
  документе, в `unavailable` он есть ровно в двух местах. Так доказывается, что разница доехала до носителя и живёт только
  там, где ей положено.
- **Момент:** реестр строится после того, как все чтения выполнены (после `collectData`, до сборки секций); прогон, где
  чтение бросает посреди `collectData`, всё равно даёт документ с `read-threw` — утверждается наличие blob.
- **Мутации ревьюера, обязательные:** убрать колонку `Reason` (diff `empty`/`unavailable` пуст → красный); строить реестр по
  списку в коде, а не по карте (поле, добавленное в фикстуру как `empty`, без строки → красный по равенству); писать
  `Not set` для `unavailable` (равенство карты и документа → красный).
- **Живой парный замер:** обычная загрузка `/reports/export` → документ, реестр с настоящими строками dev-сайта; тот же
  сценарий с перехваченным `/api/sites` → документ есть, каждая колоночная строка `Could not be read / load-failed`; обе
  цифры рядом, условие названо.

**4. Замер на живом стенде раньше устройства — задание разработчику, не мне; что именно снимать.** Владелец хочет
знать, где данные в базе есть, а до документа не доезжают. Перечень того, что за день объявлено законно пустым или
выведенным, с владельцем каждого: `location_name`, `latitude/longitude`, `timezone` (строка сайта; регион и часовой пояс —
производные от координат), `methodology_override` и `soil_texture_override` (строка сайта; `accounts.*` вторым звеном),
`turf.species`, `turf.variety`, `turf.overseedSpecies`, `turf.overseedVariety`, `turf.construction` (конфиг `gaip`),
`aaTexture` и `deriveCode` (производные), площадь зоны (10.8(2), сегодня DOM). По каждому полю и каждому из 12 сайтов
dev-базы — четыре точки одной цепочки: значение в базе (`sites`/`site_configs`/`accounts`, `docker exec … mysql`) → ключ и
значение в ответе `GET /api/sites` → исход в `sources` резольвера на живой странице → что напечатано в документе. Обрыв —
там, где значение есть слева и нет справа; форма отчёта — таблица `поле | сайт | БД | API | резольвер | документ`.
Оформление — jest e2e по образцу парити-харнесса, обычная загрузка, не разовый скрипт. **Один обрыв уже известен:**
`soil_texture_override` заполнен у 4 из 12 сайтов (замер координатора, двадцать четвёртое) и в `sitePayload()` не
отдаётся — в документе он сегодня выглядит «не задан». Если замер найдёт другие — это причина `no-field` из п. 1
двадцать восьмого в живом виде, и она подтверждает устройство, а не ломает его; менять устройство пришлось бы, если обрыв
окажется не в API, а между резольвером и печатью — тогда `Sections affected` и равенство карты с документом должны это
ловить, и я вернусь к п. 3.

**Не проверено мной:** какие разделы стоят на каждом поле (`FIELD_CONSUMERS` — разработчику вывести из кода печати, не
из списка); текст пометок — владельцу; что у комбинированного экспорта есть блок Site Information на каждый сайт (по
памяти — есть, `word-export-combined.js` не перечитывала под правкой). Порядок: замер п. 4 — первым, до устройства; затем
п. 1–3 одним заданием, перед правкой видов (двадцать седьмое).

**Двадцать девятое уточнение, 17.09.2026 — чтение страницы, оставленное в цепочке текстуры; два владельца методологии.**
По замерам разработчика и уже установленному, без чтения кода (ревьюер мутирует).

**1. Чтение `GAIP_HUB_CONFIG.soilTexture` на `/plan` — в устройство укладывается только в одной форме, и это не та, что
оставлена.** Довод разработчика верен наполовину: источник тот же (PHP кладёт результат двух звеньев,
`PageController.php:66`), но носитель — не запись владельца, а **вычисленное значение без отметки сайта**, и условие
«страница отрисована под тот же сайт» держится на `GAIP_HUB_CONFIG.activeSiteId`, который правится на лету (восьмое,
п. 2). Ровно это допущение снято с координат, вида, методологии и региона; оставить его для текстуры — значит держать
класс открытым одним полем. Как именованное исключение с условием оно допустимо, и форма для него уже есть в коде —
GH-469 для конфига (`getSiteConfig`, `nutrition-program-inputs.js:529-556`): инжект несёт **собственную отметку сайта**
(`GAIP_SITE_CONFIG_SITE_ID`), резольвер сравнивает её с запрошенным id и при несовпадении отвечает `null`, а не «сайт
страницы». Для текстуры условие то же, три требования:
- **носитель — запись владельца, не результат:** PHP инжектирует строку сайта сырыми колонками (`GAIP_SITE_ROW =
  { id, location_name, latitude, longitude, timezone, soil_texture_override, methodology_override }` и
  `GAIP_SITE_ROW_ACCOUNT = { soil_texture, methodology }`), не `soil_texture_override ?: account.soil_texture` — свёрнутое
  значение стирает, какое звено ответило, и `sources` (site-row или account) становится ложью;
- **отметка и сравнение по id:** `GAIP_SITE_ROW_SITE_ID`; `fromSite(field)` читает `getSite(id)`, при отсутствии кэша —
  инжект, только если `id === GAIP_SITE_ROW_SITE_ID`, иначе исход `unavailable / no-record` (двадцать восьмое), никогда —
  строка страницы;
- **условие доказывается прогоном, не комментарием:** песочница без `GAIP_SiteConfig`, страница отрисована под A,
  резольвер спрошен о B → `unavailable`, текстуры A в ответе нет; спрошен об A → `present`, `sources = 'site-row'` или
  `'account'` по тому звену, что ответило. Мутация ревьюера: убрать сравнение отметки → B получает текстуру A → красный.
Чтение `GAIP_HUB_CONFIG.soilTexture` и `siteTextureOverrideFor` после этого удаляются (двадцать четвёртое), читателей у
ключа не остаётся — храповик. В комбинированном экспорте на `/reports/export` кэш загружен, инжект не используется.
**Считать ли владение закрытым без этого — нет:** сегодняшняя форма — живое исключение без условия. **Цена** «дать `/plan`
строки сайта» в этой форме — не загрузка `site-config-persistence.js` на `/plan` (он тянет восстановление и мастер), а
инжект своей строки: одно место в PHP (то же, где GH-469 кладёт `GAIP_SITE_CONFIG` с отметкой), одна ветвь в `fromSite`,
один тест песочницы; `/plan` печатает один сайт, полный кэш ей не нужен. Паритет Plan/экспорт (K 99.4 против 84.1 —
замер разработчика) восстанавливается тем же, потому что оба читают одну строку по id.

**2. Методология: владелец — колонка `sites.methodology_override`, конфиг — второе место, которое уходит.** Замер принят:
колонка пуста у всех двенадцати, Settings пишут в конфиг, GH-480 читает конфиг. Это расхождение объявленного и
фактического владельца, как с локацией, и оно уже даёт два поведения: **сервер** (`SampleAnalysisController`, штамп
`methodology_snapshot` в `SampleController.php:479`) читает колонку ?: аккаунт и конфига не видит, **клиент** читает конфиг.
Пока колонка пуста, серверный анализ идёт по аккаунту или умолчанию, клиентский — по настройке; один сайт, две
методологии. Критерий выбора владельца — тот же, что для локации и текстуры: факт, который нужен серверу, живёт в колонке
`sites`; конфиг `gaip` — для настроек, которые читает только клиент. Методология нужна серверу, текстура уже в колонке,
и владелец сказала «как стоит в настройках» — про экран, не про хранилище; экран пишет туда, куда его направят.
Значит:
- **запись:** форма Settings (и мастер, если он пишет методологию) направляется на колонку через `PATCH /api/sites/{id}`
  по правилу маршрутизации `FIELD_OWNERS` (двадцать первое); ключ `turf.methodology` из путей записи конфига уходит
  (`clear`-список `patchConfig`);
- **чтение:** GH-480 переводится с `fromConfig('methodology')` на `fromSite('methodology')` со вторым звеном
  `accounts.methodology` — та же двухзвенная цепочка, что у текстуры, снимок не звено (10.8(17));
- **перенос:** одноразовый — для каждого сайта с пустой колонкой и непустым `turf.methodology` в конфиге значение
  копируется в колонку, затем ключ из конфига удаляется; сегодня конфликта «оба непусты и различны» нет (колонка пуста у
  всех), правило на будущее — колонка побеждает, конфиг игнорируется. Команда — та же семья, что `sites:repair-config`
  (раздел 6), с отчётом «сайт, было в конфиге, стало в колонке»;
- **приёмка:** до и после — методология каждого из 12 сайтов на Plan, в экспорте и в серверном анализе пробы совпадает;
  сегодня третье с первыми двумя не совпадает, и это число замера, а не только регрессии. Изменение по времени
  сдачи: всё три пункта одним заданием, иначе между записью в колонку и чтением из неё сайт живёт без методологии.
Это не расширение: два места у одного факта — дефект того же класса, что закрыт для локации; оставить его — оставить
серверный анализ на другом ответе, чем документ.

**Не проверено мной:** какой путь UI пишет `soil_texture_override` (заполнен у 4 из 12) — по замеру координатора,
писателя не искала; пишет ли мастер методологию; что серверный анализ читает именно колонку — по чтению
`SampleAnalysisController.php:92-95` до мутаций, не перечитывала. Изменения диапазонов AA после GH-482 (K 75-175 → 100-235,
Mg 100-200 → 140-250) — принятый владельцем контекст, в план не входят.

**Замер ревьюера к п. 1 (получен во время записи).** Чтения о чужом сайте не найдено; допущение держится на том, что
`activeSiteId` и `soilTexture` рендерятся из одного `$site` в одном ответе (`PageController.php:66`, `db-shell.blade.php:15,
34`): нет сайта — `null` оба, проверка пустой текстуры срабатывает раньше ограждения; на комбинированном пути фолбэк
достижим только при отсутствии строки в сторе, и тогда ограждение отвечает `none`. Принято. Ответ на вопрос «годится ли
условие как проверяемое»:
- **Условие названо верно, но само по себе недостаточно.** «Два поля из одного объекта одного рендера» — про момент
  рендера; у `GAIP_HUB_CONFIG.activeSiteId` есть второй момент — его переписывают на месте мастер и Account (это записано
  в самом коде GH-469, комментарий к `getSiteConfig`). После такой перезаписи пара уже не «из одного рендера», хотя PHP не
  менялся, и ограждение сравнивает значение с указателем, который ушёл. Второе: сегодня дыра закрыта порядком проверок
  (пустая текстура раньше ограждения) — совпадением, а не устройством; ограждение не должно зависеть от того, что
  проверка пустоты стоит раньше.
- **Условие становится достаточным и проверяемым, когда id едет внутри того же объекта, что и значение** — это и есть
  три требования п. 1: один объект `GAIP_SITE_ROW` с собственным `id`, сырые колонки, `Object.freeze`, сравнение по
  отметке внутри объекта, а не по внешнему указателю. Тогда «один объект одного рендера» выполняется по построению (один
  литерал JSON), а «не переписан после» — заморозкой и замером.
- **Чем проверяется, с двух сторон:**
  - **PHP, по выходу, не по тексту:** feature-тест `GET /plan` (и `/reports/export`) для сайта X разбирает инжектированный
    JSON и утверждает: `GAIP_SITE_ROW.id === X`, каждая колонка `===` строке `sites` для X из базы, `account.*` `===`
    строке аккаунта; второй прогон для сайта Y — те же равенства с Y. Это проверяет происхождение «из одного объекта одного
    рендера» на самом ответе, и рендер текстуры отдельно от идентификатора ломает равенство, а не комментарий.
  - **JS, в песочнице:** после загрузки переписать `GAIP_HUB_CONFIG.activeSiteId` и `GAIP_SITE_ROW.id` (второе — попытка
    на замороженном объекте, `TypeError` в strict) и спросить резольвер о старом и новом id: старый — `present` из
    инжекта, новый — `unavailable`. Мутация ревьюера: сравнивать с `GAIP_HUB_CONFIG.activeSiteId` вместо отметки внутри
    объекта → после перезаписи чужой сайт получает текстуру страницы → красный.
Итог: п. 1 не меняется; вывод ревьюера «если текстуру начнут рендерить отдельно от идентификатора, ограждение откроется
молча» закрывается не записью рядом с компромиссом, а тем, что отдельный рендер становится невозможен: значение и
идентификатор — один объект, и тест на выходе PHP это держит.

**Поправка к п. 2 по замеру координатора: посылка «сервер читает колонку» не подтвердилась.** `SampleAnalysisController.php:77`
берёт методологию как `effectiveMethodology($cachedSn['methodology'] ?? null, $lat, $lon)`, где `$cachedSn` — `data_get($analysisCacheConfig
?->config, 'computed.soilNutrition', [])` (`:68`): **кэш анализа, который туда положил клиент.** Моё чтение `:92-95` (колонка ?:
аккаунт ?? снимок) относилось к другому месту того же контроллера, и вывод «сервер читает колонку» из него не следовал — снимаю.
Мест три: колонка (пуста у 12), `config.turf.methodology` (настройка, которую видит пользователь), `analysis_cache
computed.soilNutrition.methodology` (читает сервер; заполнен у 6 и совпадает с настройкой, `NULL` у 6 — там сервер выводит
методологию **по координатам**).

**Решение не меняется, довод меняется.** Владелец — колонка `sites.methodology_override` со вторым звеном
`accounts.methodology`; не потому, что сервер её читает (не читает), а потому, что (а) серверу этот факт нужен, и читать он
обязан **владельца**, а не копию; (б) текстура — тот же тип факта — уже в колонке, два одинаковых факта в двух разных
хранилищах — второе место по построению; (в) `FIELD_OWNERS` кладёт факты, нужные серверу, в колонки `sites`. Пункты о записи,
чтении клиентом, переносе и приёмке остаются.

**Третье место.** `computed.soilNutrition.methodology` в кэше анализа — копия состояния страницы, отправленная сервером
клиентом, ровно класс GH-439 («браузер шлёт состояние»). Для методологии оно перестаёт быть источником: `:77` читает
владельца (колонка ?: аккаунт), ключ из кэша для методологии не читается вовсе; остаётся ли кэш анализа как хранилище
результатов и что ещё сервер из него читает как *настройку* — замечание, не расширяю: разработчику снять список ключей
`computed.*`, которые сервер читает как входы, а не как результаты (тот же класс, вероятно не один ключ).

**Вывод по координатам** (`effectiveMethodology(null, lat, lon)`) — подстановка правдоподобного значения того же класса,
что `region || 'AU'` и `?? 'sands'`: методология, которой никто не ставил, применяется в анализе как факт. Убирается: нет
методологии у владельца — исход `empty` (двадцать восьмое), серверный анализ методологию не выводит, зависящая от неё часть
не считается и в ответе помечена как «не задано»; в реестре документа — строка. Та же логика есть на клиенте
(`ammonium-acetate-methodology.js:518`, `updateMethodologyVisibility` — автовыбор AA для NZ при методологии «по
умолчанию»), но она **пишет в настройку, которую видит пользователь**, а не подставляет в расчёт; это другой вопрос —
должен ли новый NZ-сайт получать AA автоматически при настройке — доменный, **10.8(19)**, владельцу; серверный вывод
убирается независимо от ответа.

**Приёмка дополняется числом:** сегодня у шести сайтов без кэша серверная методология — по координатам; совпадает ли она с
настройкой у каждого из шести (Canberra, Federal Golf, New test, Test1, test4, Test6) — разработчику снять до правки; это
и есть «сколько сайтов сервер сегодня анализирует не по той методологии, что видит пользователь».
Не проверено мной: `SampleAnalysisController.php:68-77` — по замеру координатора, не перечитывала (мутации); что именно
`effectiveMethodology` отвечает для AU/UK координат.

**Тридцатое уточнение, 17.09.2026 — тканевые и водные показания идут из формы страницы; сервер и клиент считают по
разным методологиям на трёх сайтах.** Дерево в покое, прочитано: `nutrition-program-inputs.js:1085-1100`,
`word-export-combined.js:296-335, 730-738`, `hub-tissue-v3.js:5735-5772`, `Controller.php:20-30`, `AnalysisController.php:60-72`,
`store-shapes.json` (`waterSample: null`), `sample-manager.js:465-479`. Замер разработчика принят: двенадцать документов
на одной странице с одними тканевыми и водными показаниями, включая сайты без таких проб.

**1. Устройство: показания — из записи пробы по id, ни одного чтения страницы.** Первая сдача, отдельная, по указанию
владельца.
- **Откуда.** Сегодня `collectData` берёт числа из `GAIP_STATE.tissue` (форма, через прогон `hub-tissue-v3`), запасные —
  `input[data-val]` и `__GAIP_TISSUE_LAST__`; воду — из `_GAIP_EXPORT_BLEND_WATER` → `GAIP_STATE.water` (`word-export.js:
  9105-9290`; двадцать шестое). Все эти чтения **удаляются, не понижаются**. Источник один: `inputs.samples.tissue.values` и
  `inputs.samples.water.values` — запись пробы, выбранная резольвером по id (`nutrition-program-inputs.js:1085-1100`, с
  `provenance.recordKey`). Нормализация — та же, что у живого `loadSample` при заполнении формы (`TISSUE_FIELD_MAP`,
  `WATER_FIELD_MAP`, `_buildColumnIndex`, разбор `parseFloat`), вынесенная в чистую функцию `GAIP_SampleManager.readingsOf(kind,
  sample)` → `{N, P, K, …}`; экспорт и страница нормализуют одним кодом, иначе паритет Plan/экспорт расходится на
  суффиксах колонок (`K_Percent` против `K`, b35fix377). Комбинированный экспорт id уже передаёт (`:734-738`); одиночный
  берёт `allActive[siteId][kind]` — выбор пользователя на странице **для этого siteId**, не по указателю.
- **Что печатается из показаний.** Таблица показаний и диапазоны — по виду (двадцать седьмое) — и статус «ниже/в/выше
  диапазона» считаются в экспорте чистым сравнением (уже так: `:4145-4150`). Результаты прогона страницы —
  `tissueResults.status/limitingNutrients`, водные индексы из движка (`SAR`, `SARadj`, `RSC`), смешанная вода
  (`GAIP_WaterBlender`, `:5760-5770`) — вид II: печатаются только с отметкой прогона (слой II, 10.2), до неё опускаются со
  строкой реестра. Есть ли у водных индексов чистая функция от сырых ионов — не проверяла; если есть, они считаются в
  экспорте от показаний по id, если нет — ждут отметки; разработчику установить.
- **Когда активная проба не выбрана — три состояния, различимые носителем** (та же логика, что в двадцать восьмом):
  `none-on-file` — у сайта проб этого вида нет: разделы опущены, реестр «No water sample on file»;
  `on-file-not-selected` — пробы есть, id не передан и активной нет: разделы опущены, реестр «3 water samples on file; none
  selected for this report» — это инструмент владельца, ровно случай Burns/Russley/New test из замера;
  `selected` — по id, с `recordKey`.
  Ни одно из трёх не берёт «последнюю» или «единственную» пробу молча.
- **Подстановка, которая есть сегодня и решается владельцем — 10.8(20).** Комбинированный экспорт ткань привязывает к
  зоне (правило владельца, зона без своей тканевой пробы — без ткани), а воду — нет: берётся проба с id почвенной, иначе
  **последняя по порядку ключей** (`:311-315`, New test — пять водных). Какую водную пробу печатать зоне при нескольких —
  доменный вопрос. До ответа поведение не меняется, но перестаёт быть молчаливым: в реестре строка «water sample <label>
  used: site-wide source, not matched to zone» — видимая замена, не скрытая.
- **Чем проверяется, при том что ветви `loadSample` в песочнице не исполняются.** Показания больше не зависят от
  заполнения форм, поэтому проверка прямая и не ждёт двадцать шестого:
  - **предусловие:** снять с живой страницы форму `waterSample` (в `store-shapes.json` она `null`) — с Burns или New test;
    стабы из фикстуры, равенство форм в обе стороны;
  - **сторы:** тканевая и водная корзины получают правило двух записей (закрывает пробел gh477 из двадцать шестого): у
    сайтов A и B по две пробы каждого вида, значения различны в каждом нутриенте между A и B и между двумя пробами
    одного сайта;
  - **яд:** `GAIP_STATE.tissue`, `GAIP_STATE.water`, `__GAIP_TISSUE_LAST__`, `_GAIP_EXPORT_BLEND_WATER`, `input[data-val]` —
    часовые; экспорт для B с id `t2`/`w2` → в `word/document.xml` (anchoredSlice тканевого и водного разделов) все
    показания `t2` и ионы `w2`, ни одного числа `t1`, A или часового; **положительный контроль** — те же числа из `t2`
    присутствуют, и прогон, где показания по id равны часовым, печатает их (носитель жив);
  - три состояния — по прогону на каждое, с проверкой строки реестра и отсутствия раздела, и `selected` как контроль;
  - **мутации ревьюера:** вернуть чтение `GAIP_STATE.tissue` → часовой в документе; `allActive[pointer]` вместо
    `allActive[siteId]` → B получает A; «последняя проба» вместо `on-file-not-selected` → число из `t1`;
  - **живой парный замер — повтор замера разработчика:** двенадцать документов на одной странице; ожидание — тканевые и
    водные числа каждого документа равны значениям выбранной пробы в базе (четыре точки цепочки: БД → API → `sources` →
    документ), у Westview и Test5 водного раздела нет и есть строка реестра; цифра приёмки — «12 из 12 различны там, где
    пробы есть», рядом с сегодняшним «1 набор на 12».
- **Не проверено мной:** выбирает ли пользователь тканевую и водную пробу на `/reports/export` для одиночного экспорта
  (иначе `on-file-not-selected` станет частым состоянием одиночного отчёта); чистота водных индексов; что `WATER_FIELD_MAP`
  покрывает ключи живой водной пробы — форма не снята.

**2. Методология: решение по владельцу не меняется; моя фраза «координатный вывод убирается тихо» неверна.** Механизм по
коду: `effectiveMethodology` для NZ-рамки отвечает `ammonium_acetate` **поверх сохранённого**, для прочих — сохранённое,
при пустом `mlsn`; `AnalysisController.php:66-69` перезаписывает кэш для NZ. Расхождение на трёх сайтах (Federal Golf,
New test, test4: настройка SLAN, сервер MLSN) — не координаты, а **умолчание `mlsn` при пустом кэше**. Что делать:
- **Владелец — колонка** `sites.methodology_override` → `accounts.methodology`, как в двадцать девятом; сервер читает
  владельца. Три подстановки уходят: `?? 'mlsn'` → исход `empty` (двадцать восьмое: часть анализа, зависящая от методологии,
  не считается и помечена); перезапись кэша `:66-69` — с третьим местом; **NZ поверх сохранённого** — сервер не
  переопределяет значение владельца никогда: если у NZ-сайта стоит SLAN, сервер считает по SLAN. Должен ли NZ-сайт
  получать AA — вопрос **при настройке**, 10.8(19) расширяется на серверную сторону; ответ владельца меняет, что пишется в
  настройку, не что подставляется в расчёт. Для живых NZ-сайтов (Russley, Test5, оба NZ) в конфиге уже AA — поведение не
  меняется.
- **Расхождение, которое уже в данных.** После переноса конфиг → колонка (Federal Golf, New test, test4 получают SLAN) и
  перевода `:77` на владельца следующий серверный анализ идёт по SLAN. Остаются **кэшированные результаты**, посчитанные
  по MLSN: команда переноса (раздел 6, семья `sites:repair-config`) помечает `analysis_cache` этих сайтов недействительным и
  печатает отчёт «сайт, настройка, по чему считал сервер, кэш сброшен»; пересчёт — существующим Re-run. Видел ли клиент
  числа, посчитанные по MLSN, и на каких экранах — разработчику снять потребителей ответа `SampleAnalysisController`
  (не проверяла, какие страницы его читают); что говорить клиенту — владельцу, **10.8(21)**. `methodology_snapshot` в
  пробах не правится: для интерпретации не используется (10.8(17)).
- **Приёмка:** методология каждого из 12 сайтов совпадает на Plan, в экспорте и в серверном анализе; сегодня — 9 из 12.

**Тридцать первое уточнение, 17.09.2026 — поле, нужное проверке, а не продукту: класс, заведённый нами самими (GH-482).**
Заявка подтверждена (дерево в покое): `data.soil.aaSampleTypeSource = aaSampleType ? 'derived' : 'default'` — один писатель
(`word-export.js:8961`), читателей в `assets` ноль; читают `gh290` (текст строки, `toMatch`), `gh482` (значения), `gh483` e2e
(трассировка). Комментарий при присваивании называет назначение прямо: «Nothing prints it; it exists so that … a check can
tell apart». Формулировка ревьюера принята: различие «сайт заработал сертификат» / «вывести не удалось» доходит до
проверки и не доходит до читателя отчёта; в документе оба случая — `S277`.

**1. Чем отличается поле продукта от поля проверки.** Поле принадлежит продукту, если у него есть **потребитель в
продукте**: чтение, которое меняет наблюдаемое человеком — напечатанное, посчитанное в другое напечатанное, отправленное
или отказ. Поле принадлежит проверке, если все его читатели — тесты: тогда зелёный тест доказывает, что метка записана,
и ничего о том, что человек увидит разное. Пять осей это не ловят по построению: они проверяют, верно ли утверждение о
своём предмете, и не спрашивают, есть ли у предмета потребитель. Не хватает шестой строки паспорта — **потребитель**: у
каждого утверждения о значении назван либо наблюдаемый эффект, либо чтение в продукте (`file:line`), через которое значение
доходит до эффекта (восемнадцатое уже требует наблюдения потребителя для «есть»; здесь то же требование обращено на
сам предмет утверждения). Страж без строки «потребитель» не проходит мета-страж `guard-passports.test.js`.

**2. Что запрещает второму появляться — механически, не правилом в голове.** Зеркало уже принятой сверки «нет чтений
необъявленных полей» (второе уточнение: `Object.keys(data.turf)` − резольвер − список = ∅): **нет полей без чтений.**
Статический страж по потоку данных (шестнадцатое): для каждого присваивания `data.<a>.<b> = …` в `word-export.js` и
`word-export-combined.js` — хотя бы одно чтение того же пути в `assets` вне самого писателя. Ноль чтений — поле мёртвое
на запись, падение, если нет освобождения в форме паспорта (двадцать первое: полный текст узла, корень, что/почему/до
какого срока). Освобождение «до ответа владельца» — единственная законная форма для поля, которое ждёт решения.
Первый прогон стража даст список таких полей помимо этого — их число мне неизвестно, не проверяла; список — в реестр,
каждое либо получает потребителя, либо паспорт с `until`, либо снимается.

**3. Устройство для этого поля с учётом обоих исходов владельца (10.8(22)).** Поле не снимается до ответа — по
указанию. Различие, которое оно несёт, — это **исход производного факта** «сертификат» по двадцать восьмому: сертификат —
производное от методологии и текстуры (двадцать четвёртое), его исход `present` (выведен) / `empty` (входы пусты — не
выводится) наследуется от входов и живёт в `provenance.certificate` резольвера, а не в локальной метке экспорта. У этого
места **потребитель уже есть**: реестр «Data availability» (поправка к двадцать восьмому) печатает каждую запись с исходом
≠ `present` — «Certificate: not derived (soil texture not set)». Отсюда два исхода:
- **владелец: да, строкой в AA-отчёте** — второй потребитель: абзац раздела AA «Sufficiency ranges: certificate S277,
  derived from site settings (Ammonium Acetate, sand)» либо «… default certificate S277 — could not be derived: soil
  texture not set»; оба читают `provenance.certificate`;
- **владелец: нет** — различие остаётся видимым только в реестре; потребитель есть, поле продукта существует.
В обоих исходах `data.soil.aaSampleTypeSource` уходит: его смысл переезжает в `provenance.certificate`, у которого есть
читатель; тесты gh482 переписываются на **эффект** — строка реестра (и абзац AA при «да») присутствует в
`word/document.xml` в прогоне без текстуры и отсутствует в прогоне с ней (положительный контроль — присутствие
`S277` и диапазонов в обоих); утверждение gh290 о тексте строки присваивания снимается как текстовое (Q26). До ответа —
паспорт освобождения на поле с `until: 10.8(22)`.
Вторая половина того же вопроса, доменная, не решается здесь: сам `S277` по умолчанию при невыводимом сертификате —
подстановка правдоподобного значения (комментарий в коде это называет и откладывает); по правилу владельца «нет данных —
не выводим» диапазоны без сертификата не печатаются, но это оставляет AA-отчёт без диапазонов вовсе — записано в 10.8(22)
вторым пунктом, до ответа умолчание остаётся, в реестре документа — строка.

**Не проверено мной:** сколько ещё полей `data.*` пишутся без чтений (даст первый прогон стража п. 2); что `provenance`
резольвера сегодня несёт запись для сертификата (двадцать четвёртое требовало, реализацию GH-482 не перечитывала целиком).

**Закрытие 10.8(22) по решениям владельца, 17.09.2026 — следствия для тридцать первого.**
- **(а) Происхождение диапазонов AA в документ не выносится** («есть в UI, в отчёт не надо, если клиент не попросит»).
  Различие «выведен из настроек» / «взят по умолчанию» остаётся на экране и в документе не печатается: ни абзацем в
  AA-разделе, ни строкой реестра «Data availability». Следствие для устройства: у поля `data.soil.aaSampleTypeSource`
  потребителя в документе нет и не будет — из модели документа оно снимается (тридцать первое, п. 3, исход «нет»).
  Различие живёт в `provenance.certificate` резольвера, потребитель которого — экран; **не проверила**, читает ли экран
  именно его или считает своё, — разработчику найти читателя; если читателя нет, заявка «есть в UI» не подтверждена, и
  это надо сказать владельцу, а не заводить поле ради тестов. Тесты gh482 переписываются на эффект, который в документе
  есть: при пустой текстуре печатаются диапазоны S277, при заданной — диапазоны выведенного сертификата, и они различны
  (положительный контроль); утверждение о метке снимается, текстовое утверждение gh290 снимается.
- **(б) Умолчание сертификата остаётся** («для этого случая используем диапазоны по умолчанию»). **Именованное исключение из
  правила «нет данных — не выводим», по решению владельца 17.09.2026:** когда текстура сайта не задана, AA-отчёт печатает
  стандартный набор диапазонов (сертификат `S277`), а не остаётся без диапазонов. Это **единственное место, где умолчание
  разрешено**; разрешение принадлежит владельцу и снимается только её решением. Оформление, чтобы исключение не читалось
  подстановкой: в инвентаре подстановок запись `certificate → S277` получает статус «разрешено владельцем 17.09.2026»
  (не «удалено», не «в инвентаре до ответа») с паспортом (что: умолчание `S277` при пустой текстуре; почему: решение
  владельца, цитата; до: отзыва решения); в карте исходов сертификат при пустой текстуре — `present` с источником
  `default-by-decision` — не `empty`, потому что строки реестра владелец не хочет, и не голый `present`, потому что источник
  обязан быть виден нам (двадцать восьмое: источник выводится из чтения). Страж «нет подстановок» пропускает ровно эту
  запись по паспорту и падает на любой второй с тем же статусом без своей цитаты владельца.
- В 10.7 добавляется строка: единственное разрешённое умолчание — сертификат AA `S277` при пустой текстуре, решение
  владельца 17.09.2026; все прочие умолчания запрещены.
- **Находка при закрытии:** в `tests/fixtures/substitution-inventory.json` записи об умолчании `S277` нет (ноль совпадений
  по `S277`/`certificate`), хотя сертификат — производный факт и по двадцать второму входит во вселенную инвентаря.
  Единственное разрешённое умолчание сегодня не учтено тем стражем, который должен его пропускать по паспорту. Запись
  добавляется вместе со статусом «разрешено владельцем»; почему сборщик её не собрал (умолчание стоит в `word-export.js:8962`
  как `if (!aaSampleType) aaSampleType = 'S277'`, а не как `||`/`??`) — проверить форму сборщика: `if (!x) x = 'literal'` —
  ещё одна форма подстановки, которую grep-сборщик по `||`/`??` не видит; в перечень форм (Q26, 2.3).

**Тридцать второе уточнение, 17.09.2026 — два класса: поле без потребителя в нашей же сдаче (GH-484) и ноль, отброшенный
при печати.** Заявки подтверждены (дерево в состоянии сдачи GH-484): `data.tissue.resultsOmitted` и
`data.water.resultsOmitted` пишутся в `word-export.js:9279, 9331`, в `assets` больше не встречаются, читают `gh484` и
`gh461-export-turf-keys`. Печать воды `:13147-13158` — `if (data.water.EC|pH|SAR|RSC|Na|Cl|HCO3)`. Снято дополнительно:
реестра «Data availability» и абзацев «Not included:» в коде нет (ноль вхождений) — потребитель, который тридцатое
назначило полю `resultsOmitted`, не был построен, и сдача GH-484 ушла без него; различных путей `data.<a>.<b> =` в
`word-export.js` — 258 (вселенная стража п. 1).

**1. Страж «нет полей без чтений» применяется к сделанному сегодня, и сдача не принимается без потребителя.**
- **Моя часть.** Тридцатое написало «разделы опущены со строкой реестра», исходя из того, что реестр из поправки к
  двадцать восьмому ложится в ту же сдачу; порядок сдачи я назвала («замер → устройство → виды»), но не сказала, что
  реестр — **предпосылка** любого «опущено», и не проверила его наличие тем же grep, которым найден первый случай. Отчёт
  разработчика повторил формулу устройства, а не наблюдение документа. Правило из этого: **слово «опущено» в отчёте
  сдачи принимается только с цитатой абзаца из `word/document.xml`**, как «напечатано» принимается только с числом.
- **Как устроить прогон по сегодняшним правкам.** Страж — статический, по потоку данных (шестнадцатое): вселенная —
  все присваивания `data.<a>.<b> =` в `word-export.js` и `word-export-combined.js` (258 путей, выведено из кода, не список);
  для каждого — чтения того же пути в `assets` вне писателя, с раскрытием алиасов (`var t = data.tissue; t.x`) и
  передачей `data` в функции (тела вызываемых раскрываются, как в шестнадцатом). Первый прогон даёт полный список
  путей без чтений. **Положительный контроль стража:** три сегодняшних поля — `aaSampleTypeSource`, `tissue.resultsOmitted`,
  `water.resultsOmitted` — обязаны быть в списке; страж, который их не показал, неверен, и это проверяется до того, как
  список читают. Список делится на две части не по дате в голове, а по реестру: **базовая** — всё, что было до
  17.09 (получает строки реестра, храповик только вниз, паспорт с `until` допустим), и **введённое сегодня** — GH-482,
  GH-484 (координатор различает диффом сдач; для стража — всё, чего нет в базовой записи первого прогона, впредь
  считается новым). Для нового паспорт «легаси» не допускается: поле либо получает потребителя в той же сдаче, либо
  снимается; единственное исключение — `until: 10.8(N)` при открытом вопросе владельца (aaSampleTypeSource, 10.8(22)).
- **Что делать с найденным сегодня.** `resultsOmitted` (оба) — потребитель уже спроектирован и не построен: абзац на месте
  раздела (Limiting Nutrients, Classification, Sodium Hazard, Salinity Hazard — заголовок остаётся, вместо тела «Not included:
  the page run carries no site stamp; verdicts are not taken from another sample's run») и строка реестра «Data
  availability» (поправка к двадцать восьмому, п. 1). Порядок меняется: **реестр и абзацы — предпосылка, а не следующая
  сдача**: GH-484 считается принятой, когда оба потребителя читают эти поля и тест утверждает абзац в `document.xml`
  (положительный контроль — прогон с отметкой прогона печатает разделы). До этого строка реестра L2 открыта. Само
  устройство поля меняется в одном: `resultsOmitted` — не строка с текстом, а исход по двадцать восьмому (`omitted`, причина
  `no-run-stamp`) в той же карте исходов, из которой строится реестр; текст пишет потребитель, не писатель, иначе текст
  становится вторым местом.
- **Что делать с остальным списком** (число неизвестно до прогона): каждая строка — в реестр 10.11 с одним из трёх исходов:
  потребитель назван (`file:line`), паспорт с `until`, снято. Не чинить оптом: поле без чтений может быть мёртвым
  остатком (снять) или необходимым, но непостроенным потребителем (как `resultsOmitted`) — второе решается по одному.

**2. Ноль, отброшенный при печати — свой класс, не подстановка и не пустота.** Подстановка выдумывает значение там, где
его нет; исход `empty`/`unavailable` — о том, что значения нет; здесь **значение есть и верно, и его отбрасывает
потребитель**, решая наличие истинностью. Зеркало подстановки: там документ ≠ данным, потому что добавлено, здесь —
потому что выброшено. Имя класса: **печать по истинности вместо наличия.** Слова ревьюера точны: `readingsOf` ноль
сохраняет, расходится потребитель.
- **Правило:** наличие показания решается только `value != null` (или исходом из карты), никогда истинностью; ноль
  печатается как `0` со своим цветом и вердиктом (RSC 0 — нейтральный баланс, SAR 0 — нет натриевой опасности, Na 0,
  Cl 0 — измерено, нуль). Сравнения с порогом (`x > 1.5`) от нуля не страдают и не трогаются; страдают ветки «ниже
  диапазона» под истинностью (`if (data.tissue.N && N < lo)` — ноль ниже любого нижнего предела и молча пропущен).
- **Есть ли ещё места — есть, и их много.** Замер по regex (дым, не точный): ворот вида `if (data.<c>.<f>)` / `&& data.<c>.<f>`
  / тернарий в `word-export.js` — вода 42, ткань 27, почва 42; явных `!== undefined` по воде — 1; в
  `word-export-combined.js` по тому же шаблону — 0. Не все 111 — дефекты: ворота перед `> порог` безвредны; ворота перед
  строкой таблицы (`:11611-11627` почва, `:12471-12474` ткань, `:13147-13158` вода) и перед «ниже диапазона» — дефекты.
  Точный список — не regex, а **динамический прогон по вселенной показаний**, выведенной из `SOIL/TISSUE/WATER_FIELD_MAP` и
  производных индексов (`SAR`, `SARadj`, `RSC`): для каждого поля два прогона — значение `0` и значение отсутствует;
  утверждение: при `0` в anchoredSlice раздела есть строка поля с текстом `0` (и цвет/вердикт нулевого значения), в
  реестре строки нет; при отсутствии — строки нет, в реестре есть (двадцать восьмое). Поле, у которого оба прогона дают
  одинаковый документ, — дефект этого класса, поимённо. Мутация ревьюера: вернуть одно `!= null` к истинности → прогон
  `0` теряет строку → красный.
- **Не проверено мной, доменное и техническое:** как импортёр хранит «ниже предела обнаружения» (`<0.5` строкой?) —
  `parseFloat` даст `NaN` → `null` → «отсутствует», и это та же потеря другим путём; что печатать для таких значений —
  владельцу, если такие значения в базе есть (разработчику снять по 12 сайтам); откуда после GH-484 берутся `SAR`/`RSC`
  (из показаний по id чистой функцией или из прогона страницы) — не перечитывала.

**Тридцать третье уточнение, 17.09.2026 — положительный контроль реестра недостижим в живом документе; строка о выпуске
против строки о сайте.** Заявки подтверждены по коду (разработчик снимает замер по базе, дерево не мутируется):
`_noteAvailability(... reason: 'no-run-stamp')` стоит безусловно в тканевом (`word-export.js:9326-9332`) и водном
(`:9395-9401`) блоках, соседние записи о показаниях — под `if (state !== 'selected')`. Дополнительно снято, и это тяжелее
заявки: положительный контроль gh486 (`tests/gh486-data-availability.test.js:112-117`) получает «All site data present» не
прогоном без блоков, а `delete full.availability` — **тест удаляет карту исходов руками и утверждает документ, которого
продукт не может выдать.** Это класс Q26 (тест изготавливает состояние, о котором утверждает) поверх класса координатора
(контроль верен о множестве, куда не входит предмет). Число: сайтов из 12, для которых «All site data present» достижимо
сегодня, — ноль.

**1. Чем положительный контроль должен быть достижим и как проверяется.**
- **Достижим — данными, не правкой объекта.** Контроль — прогон фикстуры, где все поля владения `present`, тканевая и
  водная пробы выбраны по id, и **никакой правки `data` между `collectData` и рендером**: объект, переданный рендереру,
  `===` объекту, который вернул `collectData`, и заморожен (десятое, п. 2: запись бросает `TypeError`), так что
  `delete full.availability` невозможен по построению. Утверждение — в одном документе одновременно: «All site data
  present», заголовки «Tissue Analysis» и «Water Quality» **с содержимым** (строки показаний в anchoredSlice), ноль «Not
  included:». Контроль над множеством, в которое входит предмет, а не над множеством без него.
- **Парный прогон в той же фикстуре** различается только выбором проб (`selected` → не выбрана): реестр получает ровно
  строки показаний, и ничего больше не меняется в документе, кроме этих строк и абзацев на месте разделов (нормализованный
  diff, как в поправке к двадцать восьмому).
- **Живой контроль:** dev-сайт с полным набором (после п. 2 — Test5 или тот, у кого всё заполнено; разработчику назвать
  по замеру четырёх точек) печатает «All site data present» на обычной загрузке; сегодня это 0 из 12, и цифра стоит в
  реестре рядом с целевой «≥ 1 из 12».
- **Мутация ревьюера:** вернуть безусловную запись `no-run-stamp` в таблицу сайта → полная фикстура теряет «All site data
  present» → красный; `delete` карты в тесте → `TypeError` → красный сам по себе.

**2. Строка о выпуске и строка о сайте — различаются устройством, не редактированием текста.** Критерий ревьюера принят:
строка, которая не может отсутствовать ни у одного сайта, — не о сайте, и в таблице о данных сайта ей не место.
- **Область записи выводится из причины, не пишется рядом.** Причины — закрытый перечень (двадцать восьмое +
  тридцатое): `no-run-stamp` → область `release` (о выпуске: слой II не построен, одинаково для всех); `not-loaded`,
  `load-failed`, `no-record`, `no-field`, `read-threw` → `site` (о чтении этого сайта в этой сессии); пустые причины
  `empty`, `none-on-file`, `on-file-not-selected` → `site`. Карта `REASON_SCOPE` объявлена в одном месте экспорта; запись с
  причиной вне перечня — исключение при сборе, не строка.
- **Печать:** таблица «Data availability» — только `scope === 'site'`. Записи `release` — либо отдельная помеченная сноска
  «About this report version» одним абзацем, без колонок и без машинного токена («Analysis verdicts for tissue and water
  are not yet attributed to a site in this version; they are omitted for every site.»), либо не печатаются до слоя II —
  доменная половина, владельцу (10.8(23)); устройство одинаково в обоих исходах: из таблицы сайта они уходят. Коды причин
  в таблице сайта остаются (это наш инструмент), но каждый получает человеческую фразу из той же карты (`REASON_TEXT`),
  печатаемую рядом с кодом, — одно место, не предложения в писателях.
- **Критерий делается проверяемым сверкой в обе стороны:** динамический прогон по набору фикстур — сайт A (всё
  `present`, пробы выбраны), сайт B (всё пусто), варианты `unavailable` по каждой причине (двадцать восьмое, п. 3). Для
  каждой записи, встретившейся хотя бы в одном прогоне, считается, во всех ли прогонах она есть. Утверждение:
  `присутствует во всех прогонах` ⇔ `REASON_SCOPE[reason] === 'release'`. Запись `site`, которая есть везде, — красный
  (либо область объявлена неверно, либо в наборе нет случая, где её нет, — и то и другое находка); запись `release`,
  которой где-то нет, — красный. Вселенная причин — из карты, вселенная фикстур — из перечня двадцать восьмого, не из
  теста. Мутация ревьюера: объявить `no-run-stamp` областью `site` → красный по сверке; убрать `no-run-stamp` из карты
  → исключение при сборе.

**Реестр:** L3 (ниже). **Не проверено мной:** есть ли у dev-сайтов хотя бы один с полным набором полей владения и обеими
пробами (замер четырёх точек это даст); печатает ли `_notIncludedLine` для `release`-записей абзац на месте раздела —
после п. 2 он должен идти той же сноской, не абзацем в каждом разделе; текст сноски — черновик, владельцу.

**Тридцать четвёртое уточнение, 17.09.2026 — граница обещания реестра: расширяется устройством, не сужается словами.**
Замер разработчика принят: карта исходов ведёт вердикты прогонов и выбор пробы, исхода отдельного показания нет;
показание, не разобранное `parseFloat` (`<0.5` → `NaN`), исчезает так же беззвучно, как ноль в тридцать втором, по
другой причине. Сегодня таких значений в базе нет (812 показаний, 60 живых и 87 удалённых проб, ноль неразбираемых) —
граница обещания, не живой дефект.

**Решение: расширить устройством.** Довод — назначение реестра по решению владельца: «так мы выверим сами, каких данных
не хватает, и проверим, действительно ли их не хватает». Инструмент, который молчит об одном уровне потерь, выверяет не
всё, и заголовок «Data availability», честно суженный словами, остался бы обещанием, которое читатель всё равно прочтёт
как «про все данные». Слова допустимы как подпись к таблице, но граница держится не ими, а тем, что за ней ничего не
печатается без исхода.

**1. Уровень показания — три исхода, выведенные из разбора.** `readingsOf(kind, sample)` отдаёт не число, а исход на
каждый ключ карты полей: `present` (число, включая `0`), `empty` (ключа в payload нет или значение пустое — лаборатория
не сообщила), `unavailable / parse-failed` (значение есть, в число не разбирается; сырая строка сохраняется в записи
исхода). Потребитель — строка таблицы показаний — решает наличие **исходом**, не истинностью: `present` печатается
(ноль — как `0` со своим вердиктом), `empty` — строки нет, `parse-failed` — строки-числа нет. Так тридцать второе п. 2 и
этот пункт сходятся в одно устройство: ноль и `NaN` — два исхода одного уровня, и оба видимы.

**2. Реестр — уровень показания агрегирован по виду пробы, чтобы не затопить таблицу.** Не строка на показание, а строка на
вид пробы и исход, только когда есть что сказать: «Soil readings — Not set: Na, Mo (not reported by the lab)»; «Water readings —
Could not be read: Cl (raw value “<0.5”, parse-failed)». Полная проба строк не даёт — положительный контроль тридцать
третьего остаётся достижимым. Область — `site` (о данных этого сайта), `REASON_SCOPE['parse-failed'] = 'site'`.

**3. Обещание делается верным механически — стражем покрытия, не заголовком.** Всё, что документ печатает как значение,
обязано иметь путь в карте исходов: вселенная печатаемых значений выводится из `word/document.xml` через обход часовых
(девятнадцатое: фикстура с уникальным значением в каждом поле, каждое найденное в документе значение сопоставляется
пути исхода); значение в документе без записи исхода — падение; храповик от сегодняшнего числа таких значений (не
измерено — даст первый прогон) до нуля. После нуля заголовок «Data availability» верен буквально, и подпись не нужна.
Тот же приём для подстановок — тридцать девятое, часть 1 («от пустого входа к напечатанному»): один ход, два применения (сороковое, связка).
Что вне карты по построению и остаётся названным, не обещанным: результаты прогона страницы (область `release`, до слоя II)
и производные индексы, унаследовавшие исход входов (двадцать восьмое, п. 1).

**4. Проверка.** Фикстура с показаниями трёх видов: `0`, отсутствующий ключ, строка `<0.5`; утверждения о `document.xml`:
`0` напечатан в строке поля с вердиктом нуля и строки реестра нет; отсутствующий ключ — строки поля нет, строка реестра
«Not set: <поле>»; `<0.5` — строки-числа нет, строка реестра «Could not be read: <поле> (raw “<0.5”)». Положительный
контроль — полная проба: все строки, реестр без записей. Мутации ревьюера: вернуть `parseFloat(...) || null` без исхода →
`<0.5` исчезает без строки → красный; истинность вместо исхода в строке таблицы → `0` исчезает → красный.

**Доменное, 10.8(24):** что печатать для значения ниже предела обнаружения, когда такие появятся (сырую строку в
таблице, «below detection», ничего) — владельцу, не срочно (в базе таких нет). До ответа — только строка реестра.
**Не проверено мной:** число печатаемых значений без записи исхода сегодня (п. 3, первый прогон); как импортёры хранят
нечисловые значения при появлении (`<0.5` строкой в `values` или отбрасывают при импорте — тогда потеря раньше
`readingsOf`, и исход `parse-failed` её не увидит; разработчику снять по импортёрам Hill Labs / CSV).

**Тридцать пятое уточнение, 17.09.2026 — заморозка, которую можно обойти, — не заморозка: что и когда замораживается.**
Замер разработчика (GH-487) принят: карта исходов заморожена в продукте, а `buildSections` дописывает в `data` после сборки
(`word-export.js:12018`, `data.soil.surfaceType`); полная заморозка без правки рендерера невозможна. Довод разработчика
верен и становится правилом: **гарантия, живущая только под тестом, — не гарантия**; заморозка — в продукте. Класс Евы
принят: заморожено то, чем контроль подменяли, а объект открыт.

**1. Что заморожено и когда — три границы, все в продукте.**
- **Граница резольвера** — уже есть (десятое, п. 2): `resolveExportInputs` возвращает замороженный объект, запись бросает.
- **Граница сборки — новая и главная.** `collectData(inputs)` в последней строке возвращает **глубоко замороженную
  собственную копию** модели документа: `deepFreeze(structuredClone(model))`. Копия — потому что `data` сегодня может держать
  ссылки на живые объекты страницы (таблицы диапазонов, результаты прогонов, `inputs`); заморозить их на месте — значит
  заморозить состояние страницы, и это побочный эффект, а не гарантия. `structuredClone` заодно отказывает модели,
  которая несёт функции или циклы (бросает `DataCloneError`) — модель документа, которая их несёт, дефект, и он
  всплывает здесь, а не в тесте про `function`-ветку (gh461-provenance). Карта исходов — часть модели, замораживается с
  ней; отдельная заморозка карты снимается как частичная.
- **Граница печати.** `buildSections(data)` получает эту копию и ничего не возвращает в неё. Окно записи между возвратом
  `collectData` и печатью закрывается **по построению**: любое `data.x = …` в рендерере бросает `TypeError` при первом же
  экспорте, и дымоход (ноль `console.error`, blob есть) краснеет. Именно так разработчик и нашёл `:12018` — заморозка и есть
  страж, тест ей не нужен, нужен только положительный контроль (п. 3).

**2. Что делать с записями, которые рендерер делает по делу.** Каждая такая запись — одно из двух: **производное поле
модели** (как `surfaceType`: считается из `data`, печатается) — переезжает влево от границы, в `collectData`, и с этого момента
подчиняется остальному: исход в карте (двадцать восьмое), потребитель (тридцать первое), сверка ключей; либо **локальная
переменная печати** — остаётся в рендерере, но не на `data`. Третьего нет. Список таких записей неизвестен: разработчик
нашёл одну заморозкой на одной фикстуре; полный список даёт та же заморозка на всём наборе фикстур (сайт A, сайт B,
`unavailable` по причинам, три вида показаний) — каждая, что бросит, в реестр 10.11 с решением «влево» или «локально».
Число не измерено.

**3. Положительный контроль, без которого заморозка — соглашение.** `Object.freeze` в нестрогом режиме **молча
игнорирует** запись — это хуже открытого объекта: значение исчезает без ошибки, и класс «беззвучной потери» возвращается
через саму гарантию. Поэтому тест-контроль в продукте: после `collectData` попытка записи в модель (`data.soil.x = 1`,
`data.availability.push(...)`, `delete data.soil.pH`) **бросает `TypeError`**, не игнорируется — утверждается `toThrow`, не
«значение не изменилось». Если `word-export.js` не в строгом режиме (не проверяла — дерево под мутацией), заморозка
одна не даёт гарантии, и граница сборки делается `Proxy` с бросающими ловушками `set`/`defineProperty`/`deleteProperty`
рекурсивно — он бросает в любом режиме. Мутации ревьюера: убрать заморозку → контроль зелёный по «не изменилось» и красный
по `toThrow` — потому второе; вернуть запись `:12018` в рендерер → дымоход красный.

**4. Следствие для стража покрытия (тридцать четвёртое, п. 3).** С границей сборки «напечатанное» и «собранное» — одно
множество с точностью до форматирования: значение в документе либо равно значению модели после объявленного
форматирования (`toFixed`, единицы, дата), либо литерал рендерера. Правило для стража: каждое найденное в документе
значение сопоставляется пути модели через список форматирующих функций (объявлен, сверяется в обе стороны с вызовами в
рендерере); значение без пути и не литерал из паспорта — падение. Без заморозки этот страж искал бы путь у того, чего
в модели нет, и молчал бы — Ева права, две гарантии держатся друг на друге и вводятся вместе.

**Не проверено мной:** строгий режим `word-export.js`; держит ли `data` ссылки на живые объекты страницы и функции (даст
первая попытка `structuredClone`); число записей рендерера в `data` помимо `:12018`; стоимость клонирования модели на
комбинированном экспорте (12 сайтов) — если заметна, замер парой, не предположение.

**Поправка к тридцать третьему п. 2 и тридцать пятому п. 3, 17.09.2026 — строгий режим измерен; карта областей меняется.**
- **Строгий режим есть** (`word-export.js:223`, `word-export-combined.js:45`, `nutrition-calendar.js:38` — замер координатора,
  дерево в покое): `Object.freeze` бросает, запасной `Proxy` снимается. Требование «утверждается `toThrow`, не «не
  изменилось»» остаётся — оно о форме проверки.
- **Схлопывание причины в `''` — дефект карты, не только реализации.** `_reasonScope` берёт `entry.reason || ''`, а
  `REASON_SCOPE['']` объявлен законным отсутствием; запись без причины молча становится строкой о сайте, бросок срабатывает
  только на неизвестной непустой (мутация ревьюера: вердикт без `reason` переехал из сноски в таблицу, броска нет).
  Исправление в устройстве: область выводится из **пары `(outcome, reason)`**, не из причины одной. `outcome: 'empty'` —
  причина обязана быть из {`''`, `none-on-file`, `on-file-not-selected`}; `outcome: 'unavailable'` и `omitted` — причина
  обязана быть непустой и из перечня; любая другая пара — исключение при сборе, в том числе «`unavailable` без причины».
  Пустая строка перестаёт быть ключом-ловушкой: она законна только при `empty`. Сверка в обе стороны: каждая пара,
  произведённая прогоном по набору фикстур, объявлена; каждая объявленная пара произведена хотя бы одной фикстурой
  (иначе объявление мёртвое). Мутация ревьюера повторяется как положительный контроль: убрать `reason` у вердикта →
  исключение.
- **Областей три, не две.** Признак ревьюера верен («может ли строка отсутствовать хотя бы у одного сайта»), но у него
  два ответа «нет» с разной причиной: `not-loaded`, `load-failed`, `read-threw` одинаковы у всех сайтов **этого документа** и
  различны между документами (следующий экспорт может пройти) — это область **`run`**, об этом прогоне; `no-run-stamp` и
  `no-field` (дрейф API — одинаков для всех сайтов и всех документов до правки кода) — область **`release`**. Карта:
  `site` — `empty`-причины, `no-record`, `parse-failed`; `run` — `not-loaded`, `load-failed`, `read-threw`; `release` —
  `no-run-stamp`, `no-field`. `read-threw` объявлен `run` по описанию ревьюера; если сверка на наборе фикстур найдёт
  случай, где он у одного сайта есть, а у другого нет, — переезжает в `site`, и это находка сверки, не правка по памяти.
- **Печать по областям:** `site` — таблица «Data availability» под блоком сайта; `run` — **один** абзац в начале документа,
  не по сайту («Site settings could not be loaded in this export (load-failed); every section that depends on them is
  omitted for every site.»), потому что повтор двенадцати одинаковых строк скрывает, что причина одна; `release` —
  сноска или ничего (10.8(23)). Формулировки — черновик, владельцу.
- **Сверка критерия (тридцать третье, п. 2) расширяется на три области:** набор фикстур — сайты A/B в одном документе ×
  прогоны «обычный», «`load-failed`», «`no-field`»; запись есть у всех сайтов всех прогонов ⇔ `release`; у всех сайтов
  одного прогона и не у всех прогонов ⇔ `run`; иначе ⇔ `site`. Расхождение с объявленной областью в любую сторону —
  красный.
Не проверено мной: производится ли сегодня хоть одна из трёх `run`-причин (по оговорке ревьюера — нет; сверка это и
покажет как «объявлено, не произведено», и тогда для них нужна фикстура `load-failed` из двадцать восьмого, п. 3).

**Тридцать шестое уточнение, 17.09.2026 — граница сборки поставлена не там, где сборка кончается; две несовместимые
формы; пары устройств и чем проверяется их совместимость.** Замеры приняты: 33 записи комбинированного экспорта в `data`
после `collectData` (`word-export-combined.js:747, 766-772, 826-831, 915, 2497-2938, 3110`); в настоящей модели функций ноль;
граница печати закрыта, `surfaceType` переехал в `collectData`. Отклонение разработчика (заморозка карты оставлена как
защита положительного контроля до границы сборки) принято — названо, не сделано молча.

**1. Граница сборки стоит не там.** Тридцать пятое поставило её на возврат `collectData`, приняв, что сборка модели там
кончается. Для одиночного экспорта это так; для комбинированного сборка продолжается в цикле — программа и её причины,
контекст, решения поправок. Значит **граница — на передаче в `buildSections`, где сборка кончается на самом деле**, и она
уже закрыта; «главная граница стоять не может» — верно о месте, не о гарантии. Что остаётся открытым — не окно между
сборкой и печатью, а **второй писатель модели**: 33 записи делятся на два рода, и их надо развести поимённо, не оптом:
- **параметры сборки** — то, чего `collectData` не знает и знать должен: контекст комбинированного прогона
  (`_combinedCtx`, `_exportInputs`), спрей-лог, программа и причины (`:2497-2938`), решения поправок. Устройство: одна
  функция сборки на документ — `collectData(inputs, ctx)`, где `ctx` несёт то, что сегодня дописывается, а
  комбинированный экспорт зовёт её с контекстом вместо правки результата. После переезда возврат `collectData` снова
  становится концом сборки, и граница тридцать пятого возвращается на место — как следствие, не как правка ради неё;
- **второй писатель уже записанного поля** — метки сайта и пробы (`:766-772`): `collectData` их пишет (после тридцатого —
  по id из `inputs`), комбинированный перезаписывает из `entry`. Два писателя одного поля — класс «два места»; после
  тридцатого перезапись избыточна и снимается, а расхождение между двумя значениями — замер: если они когда-либо
  различны, это находка о `collectData`, не довод оставить перезапись.
Строка реестра L4. До переезда: заморозка на входе `buildSections` — единственная гарантия печати, заморозка карты —
защита контроля; окно сборки комбинированного экспорта **названо открытым**, с числом 33 и храповиком вниз по
поимённому списку, не по счётчику.

**2. Заморозка и отравление — выбор принят, с одним дополнением.** Копия обходом с переносом функций ссылкой — верная
форма: `structuredClone` отказывает не только функциям, но **любому `Proxy`**, а на прокси стоят и отравление (GH-475), и
обёртки сторов (двадцать пятое); задуманная форма отключала бы оба. Дополнение: утверждение «в настоящей модели функций
ноль» — измеренный инвариант, и он становится стражем продукта: прогон без яда утверждает ноль функций и ноль прокси в
модели (обходом), прогон с ядом — освобождён от этого паспортом «стенд». Две среды, два правила, оба названы; довод
разработчика «верно для продукта, неверно для стенда» так и записан.

**3. Пары устройств, которые могут не ужиться, — поимённо.** Каждое верно само по себе; сталкиваются на одном объекте
или одной границе.
- **Клон/заморозка (35) × наблюдение потребителя по тождеству `===` (18).** Клон меняет тождество: проверка «потребитель
  получил тот же объект, что вернул резольвер» держится только внутри `collectData`, до клона; любая проверка `===` через
  границу сборки ложно красная. Правило: тождество проверяется до границы, содержимое — после.
- **Отравление прокси (GH-475) × равенство форм сторов в обе стороны (store-shapes).** Прокси, отвечающий на любой ключ,
  ломает `Object.keys`-равенство; если оба устройства стоят на одном объекте (`GAIP_STATE`: форма снята в
  `page-state-shapes.json`, и яд сажается туда же) — они противоречат по построению. Не проверяла, стоят ли; проверка —
  п. 4.
- **Обёртки всех глобалов (25) × отравление прокси (GH-475).** Прокси над прокси: ловушка обёртки делает `value.bind(t)` для
  функций, сентинел — функция-прокси; `bind` на нём — либо потеря сентинела, либо бросок. Порядок установки и то, кто
  снаружи, не оговорены.
- **Заморозка `inputs` на возврате резольвера (10) × комбинированный цикл, дописывающий программу и причины.** Возможно,
  именно поэтому 33 записи идут в `data`, а не в `inputs`: `inputs` заморожен, `data` — нет; заморозка границы просто
  сдвинула запись в открытый объект. Не проверяла, подтверждается диффом истории записей.
- **Часовые покрытия (34) × часовые отравления (GH-475).** Один обходчик, два словаря: значение покрытия в документе —
  ожидаемое, значение яда — утечка; обходчик обязан различать их по словарю, иначе либо покрытие «утечка», либо утечка
  «покрытие». Один обходчик с двумя словарями, а не два обходчика.
- **Храповик по счётчику × переезд кода влево.** Переезд `surfaceType` в `collectData` добавляет запись `data.*.* =`; храповик
  на «число записей» краснеет от верного действия. Правило: храповики — по поимённым множествам дефектов, не по сырым
  счётчикам (уже так для освобождений, распространить на все).
- **Освобождение по полному тексту узла (21) × переформатирование/переезд кода.** Безобидный переезд делает паспорт
  недействительным; известная цена, названа: паспорт привязан к тексту, и его обновление — часть переезда.
- **Заморозка карты исходов (GH-487, отклонение) × записи уровня показания в карту (34).** Заморозка обязана быть
  **последней** операцией сборки; запись после неё — бросок. Порядок внутри `collectData` фиксируется: показания → пробы
  → вердикты → заморозка.

**4. Чем совместимость проверяется — не памятью, а реестром устройств и составным прогоном.**
- **Реестр устройств** (`tests/device-registry.test.js`, одна таблица): устройство → объект или граница, на которой
  стоит → механизм (`proxy`, `freeze`, `clone`, `shape-equality`, `identity`, `ratchet`, `text-exemption`) → что требует от
  объекта (`cloneable`, `identity-stable`, `enumerable-keys`, `no-functions`, `writable`) → что у объекта отнимает. Мета-тест:
  ни на одном объекте нет устройства, требующего свойство, которое другое устройство на том же объекте отнимает.
  Столкновение «клон × прокси» в этой таблице видно до правки: `clone` требует `cloneable`, `proxy` его отнимает, объект
  один. Пять пар выше заносятся первыми; пара из п. 2 — как первая закрытая строка, с решением.
- **Составной прогон.** Устройство, проверенное только в своём тесте, не проверено на совместимость. Дымоход получает
  режим «всё включено»: яд, обёртки сторов, формы, заморозки, покрытие — в одном прогоне на одной фикстуре, и он
  обязан быть зелёным; столкновение проявляется здесь, а не в следующей правке. Новое устройство принимается в план
  только со строкой реестра и с включением в составной прогон — та же дисциплина, что паспорт стража (двадцать первое).

**Не проверено мной:** стоят ли яд и форма на одном объекте (`GAIP_STATE`); порядок установки обёрток и яда в песочнице;
подтверждается ли историей, что записи ушли в `data` из-за заморозки `inputs`; какие из 33 записей — параметры, какие —
второй писатель (разбор поимённо — разработчику при переезде, критерий в п. 1).

**Тридцать седьмое уточнение, 17.09.2026 — живой сторож S7 читает первую таблицу документа; живой набор молчит о
сети; пометка о 4 секундах.** Замеры ревьюера приняты (Christchurch отключён → программа Russley опущена с честной
фразой, «первой» стала таблица Test5, 14/14 дважды; зеркало с Auckland — два честных красных). Чтение `tests/e2e` — при
дереве под правкой почвы в `assets`; набор e2e разработчик не правит, помечаю как чтение, не замер.

**1. Единица — документ вместо отчёта; сколько ещё таких.** `monthlyGpFrom` (`gh459-cross-site-inputs-live.test.js:63-95`)
обходит все `<w:tbl>` документа и берёт первую с месяцами; отчёт сайта в ней не назван. Ось единицы (двадцать первое)
нарушена ровно так, как сформулировал ревьюер: «программу не напечатали, зато напечатали соседнюю» — неотличимо.
- **Число — дым, не замер.** Из 28 живых тестов документ разбирают 12; по regex «первое совпадение» (`indexOf('…')`,
  `match(`, `[0]`) против «привязано к сайту» (`indexOf(siteLabel|SITE_NAME|…)`, `anchoredSlice`): `ui-vs-export-parity` 20/0,
  `calc-audit-export-parity` 25/2, `gh401` 10/2, `gh409` 11/2, `gh399` 8/0, `gh400` 8/2, `gh415` 7/1, `gh459` 6/0, `gh423` 5/1,
  `gh398` 4/0, `gh422` 2/2, `gh483` 1/0. Regex не отличает чтение документа от чтения страницы и не видит привязку,
  сделанную иначе; точная цифра — только замером ниже. Но нулей в колонке «привязано» шесть из двенадцати, и это уже ответ
  Еве по форме: большинство живых чтений документа единицу не называют.
- **Точный счёт и закрытие класса — одним устройством.** Все чтения `word/document.xml` в живом наборе идут через один
  помощник `reportOf(xml, siteLabel)`: находит заголовок площадки (тот же текст, что печатает блок Site Information) и
  возвращает кусок до следующего заголовка площадки; таблицы, абзацы, реестр читаются **внутри куска**. Прямой разбор
  `document.xml` вне помощника — статический страж по списку файлов, выведенному из `tests/e2e` (шестнадцатое: список из
  каталога, не из теста), храповик от сегодняшнего числа до нуля. Первый прогон стража и есть точный ответ на «сколько».
- **S7 переписывается по рекомендации ревьюера, с двумя дополнениями.** Утверждение — не «в первой таблице нет null», а:
  у **каждого** сайта комбинированного экспорта внутри его куска есть Monthly Schedule; GP-колонка куска Russley равна
  ряду Christchurch, куска Test5 — ряду Auckland (оба ряда известны: `[90,87,…,75]` и `[100,100,…,95]`), и наоборот не
  встречается. **Положительный контроль обязателен и уже есть у ревьюера:** зеркальный прогон с отключённым Auckland должен
  краснеть тем же тестом, а не соседним; прогон с отключённым Christchurch — краснеть **о Russley** (кусок Russley без
  таблицы и с фразой «Climate data was unavailable»), а не зеленеть. Это тот набор, который единственный ловил исходный
  дефект владельца, — поэтому переписывается первым среди живых, до остальных одиннадцати.
- Строка реестра L5.

**2. Живой набор зависит от чужих серверов и молчит об этом — закрывается тремя вещами, не одной.** Замер принят: 41
внешний запрос (open-meteo 27, NASA POWER 9, archive-api 5), плюс 5 к cdnjs; кэша в базе нет (GH-245 убрал
персистентность); при полном отказе три теста красные детерминированно с «printed: null, saved: 100» и без слова о сети;
при 8 и 30 с — 14/14, комбинированный экспорт ждёт без таймаута.
- **Тест объясняется, как объясняется продукт.** Живой прогон пишет журнал сети (Playwright `page.on('requestfailed')`,
  `response` по хостам): в отчёте jest — таблица «хост: запросов, отказов, медиана мс». Тест, зависящий от климата, перед
  утверждением о числах читает **свой же кусок документа**: если там фраза «Climate data was unavailable for this site
  when this report was generated», он падает с сообщением «climate unavailable for <site> — network: <хост>: <отказов>»,
  а не с «printed: null». Не `skip`: пропуск прячет; красный с названной причиной — отличим от дефекта экспорта одним
  взглядом. Это ось носителя для теста: тест обязан различать то, о чём молчит, как продукт различает (двадцать восьмое).
- **Условие сети — парой, по правилу замеров.** Отказ сети — искусственное условие; каждый климатический тест получает
  пару: обычный прогон (число) и прогон с отрезанными хостами (`route.abort` по трём хостам; число и фраза в куске).
  Оба числа рядом. Сегодняшний замер ревьюера (три красных при полном отказе) — это и есть первая пара, записывается.
- **Медленный ответ — не проверено продуктом.** «8 и 30 секунд — 14/14» говорит, что до 30 с экспорт ждёт; что происходит
  при 60 с и более и есть ли предел вообще — не измерено; комбинированный экспорт без таймаута — поведение продукта,
  которое надо назвать, а не чинить здесь: пара «обычно / задержка 120 с» в тот же журнал, результат — в реестр как факт
  о продукте, решение — владельцу, если предел нужен (не завожу вопрос, пока нет числа).
- **Предложение, требует решения, не в очередь:** нормали климата — единственные внешние данные, от которых зависит
  документ; их серверный кэш по паре координат сделал бы документ воспроизводимым и живой набор — детерминированным.
  GH-245 убрал персистентность в браузере по правилу «база — источник»; серверный кэш этому правилу не противоречит.
  Цена не оценена; называю, не планирую.

**3. Пометка.** Предел 4 секунды на пути Re-run (`hub-persistence.js:74-89`), после которого расчёт идёт без нормалей, —
взят ревьюером из кода, **не измерен**; записано как непроверенное. Замер, который его закроет: пара «обычно / задержка
6 с» на пути Re-run с чтением, идёт ли расчёт без нормалей (число в документе или на экране изменилось) — вместе с
парой из п. 2.

**Не проверено мной:** точное число чтений «первое совпадение» (даст страж п. 1); что помощник `reportOf` сможет
опираться на заголовок площадки во всех 12 тестах (у одиночного экспорта площадка одна — кусок равен документу, это
законно и явно); поведение экспорта при задержке свыше 30 с.

**Тридцать восьмое уточнение, 17.09.2026 — порядок принят; что именно паритет доказывал и какие сдачи стояли на слепом
S7.** Порядок Евы принят: S7 первым, паритетный харнесс сразу после, до остальных десяти. Чтение `tests/e2e` — при
дереве под правкой почвы; e2e не правится, помечено как чтение.

**1. Посылка «паритет по комбинированному пути не доказан» уточняется по коду харнесса.** `ui-vs-export-parity.test.js`
идёт через диалог комбинированного экспорта (`:886-887`), но с **ровно одной** выбранной пробой (`Deselect all`, затем
одна `data-sample-uid`, `checkedCount !== 1` — ошибка, `:889-918`). Документ содержит один отчёт, кусок равен документу,
«первое совпадение» — своё. Поэтому «паритет 24/24» (в наборе 25 тестов; какой один не считается — по отчётам в
панелях Herdr, не в файлах, я не проверяла) **верен для одиночной итерации комбинированного цикла** и ничего не
утверждает о второй и последующих. Единственный многосайтовый тест паритета (`:2152-2175`, два образца в одном документе)
привязан к **ярлыку пробы** внутри таблицы ANR (`anrRowsFor(t, label)`), сравнивает только годовой N по ANR и при
отсутствии ярлыка краснеет, не зеленеет; месячные таблицы и GP между сайтами паритет не сравнивает вовсе. Итог: паритет
не слеп в том, что он делает; он не делает того, что ему приписывали отчёты, — доказательства многосайтового цикла.
Слеп был S7 — единственный живой сторож второй итерации.

**2. Поимённо: чьи утверждения о поведении в многосайтовом цикле держались на S7 (слепом), а не на паритете.**
Критерий: дефект, который сдача закрывает, проявляется только когда сайт документа ≠ сайт страницы или во второй и
далее итерации цикла; одиночный паритет его не видит по построению.
- **GH-467** — снятие фолбэка `_buildEngineInputs` «по сайту страницы»: проявляется при странице на другом сайте — ровно
  сценарий S7 («the page points at another site for the whole export»); живого доказательства нет, остаётся песочница.
- **GH-468** — `siteId` обязателен, подмена сайтом страницы невозможна: то же.
- **GH-469** — входы календаря каждой пробы от своего сайта: по природе многосайтовое; живое доказательство — S7 (GP-ряд) и
  многосайтовый ANR-тест паритета (только годовой N, привязан). GP-часть не доказана живьём.
- **GH-470** — `inputsForSite` одним аргументом: одиночная итерация доказана паритетом (сверка всей формы, `:940-947`);
  многосайтовая — S7.
- **GH-476** — регион от сайта в цикле: паритет одиночный; S7 регион не читает; **живого доказательства не было вовсе**,
  ни слепого, ни зрячего — только песочница.
- **GH-478** — нормали по координатам: сандбокс-страж настоящий, живое подтверждение — GP-колонка S7, то есть слепое; это
  ровно то место, где мутация ревьюера (Christchurch отключён) прошла зелёной.
- **GH-479** — отказы цикла (сайт-призрак): только песочница; живого сценария нет по замыслу.
- **GH-480** — три чтения страницы → по id (методология и др.): в цикле по сайту; паритет доказывает Test5, S7 —
  остальное, слепо.
- **GH-481, GH-482** — экстрактант и текстура по владельцу, сменившие диапазоны AA у Russley и Test5: Test5 доказан
  паритетом (фикстура AA); Russley в комбинированном документе с другими сайтами — только S7.
- **GH-484 и почва в работе** — показания по id: живое доказательство — замер разработчика по 12 документам («12 из 12
  различны»); **не проверила**, читался ли каждый документ как отдельный файл (единица верна) или один комбинированный
  файл первым совпадением (та же слепота). Если второе — замер повторяется через `reportOf` до принятия почвы.
- **Не стояли на S7:** GH-465, 466, 471, 472, 473, 474, 475, 477 (стражи, владение, инвентарь — паритет для них
  регрессия одной итерации, достаточно), GH-486–489 (реестр; но любой будущий живой тест реестра в комбинированном документе
  попадает в тот же класс единицы и обязан идти через `reportOf`).

**3. Что меняется в паритетном харнессе, когда он идёт вторым.** Не «починить чтение» — оно верно для одной пробы — а
**дать ему многосайтовую итерацию с единицей «отчёт»**: помощник `reportOf(xml, siteLabel)` (тридцать седьмое), и
многосайтовый тест расширяется с ANR-N на Monthly Schedule и GP-ряд **каждого** отчёта против его же сайта на странице
(тот же адаптер, что в одиночной сверке `:940-947`, вызванный для второго сайта). Тогда «паритет сошёлся» начинает
говорить о цикле, и список п. 2 закрывается им, а не повтором S7 по каждой сдаче. Одиночные прогоны остаются как есть.
Положительный контроль тот же, что у S7: отключённые нормали одного сайта краснят тест о нём.

**Не проверено мной:** отчёты сдач с «24/24» (в панелях, не в файлах); форма замера GH-484 по 12 документам (один файл или
двенадцать); что одиночный кусок в двухсайтовом документе идёт первым в порядке перечисления (`enumerateSamples`) —
для `reportOf` неважно, для понимания «почему первым стал Test5» — замер ревьюера это уже показал.

**Тридцать девятое уточнение, 17.09.2026 — три части: перечень форм подстановки; кислотность как факт пробы;
10.8(23) закрыт.** Состояние дерева в брифе не заполнено — чтения помечаю как чтения, не замеры.

**Часть 1. Перечень форм — перечень, и он обходится новой формой.**
- **Заявка подтверждена, и причина двойная.** `tests/lib/substitution-inventory.js` (`:64-88`) распознаёт три формы:
  `||`, `??` (`LogicalExpression`) и тернарий с проверкой пустоты (`ConditionalExpression` + `isEmptinessTest`), плюс
  перенос через «носители» имён; `IfStatement`/присваивание под условием не распознаётся. Вторая причина, которой в заявке
  нет: сборщик фильтрует по списку `watched` — 28 имён фактов сайта (`_fields`: `species`, `lat`, `region`, …);
  `aaSampleType` в нём нет. Умолчание `S277` не попало в инвентарь **по двум независимым причинам** — форма и вселенная
  имён; починка одной формы его не вернула бы. Число 184 читается так: «подстановки трёх форм над 28 именами, доходящие до
  трёх видов стоков (`TextRun`, `innerHTML`/`textContent`, тела `PATCH`/`POST`/`PUT`)». Все счёты и храповики на нём
  измеряют охваченную форму и охваченные имена, не предмет.
- **Сколько форм в этом дереве — дым, не замер, метод назван.** Regex по `assets/*.js`, сырые совпадения, без разбора
  контекста (число включает случаи, где `||` не подстановка, например булева логика): `|| литерал` ~1944; `?? литерал` 119;
  `typeof x === 'undefined' ? литерал` 132; `x == null ? литерал` 99; параметры по умолчанию `(a = литерал)` 63;
  `parseFloat(x) || 0` 61; `Math.max(x, литерал)` (полы) 45; `switch … default: return литерал` 11; `Object.assign({умолчания},
  x)` 9; `if (!x) x = литерал` 3; тернарий с литералом — regex непригоден (десятки тысяч ложных). Формы, которых regex не
  видит и которые в дереве есть по чтению за день: `if (!x) x = …` (S277); `safeNum(v, 7)` — умолчание аргументом
  вспомогательной функции (`hub-tissue-v3.js:2271`, pH 7); PHP `?:`/`??` (`?? 'sands'`, `?? 'mlsn'`, `effectiveMethodology`);
  запасное чтение из другого источника (`GAIP_STATE.soil` при пустой пробе — та же подстановка, без литерала); умолчание в
  объекте-конфиге, применяемое слиянием; ветвь `catch`, возвращающая значение. Перечень получен grep'ом и памятью дня —
  то есть он **сам перечень**, и его полнота не доказуема из него самого. Это и есть ответ на вопрос 1: точное «сколько»
  из кода получить нельзя, из кода получаются только формы, о которых уже знаешь.
- **Как перечень перестаёт быть перечнем — тем же ходом, что вселенная из документа: от пустого входа к напечатанному.**
  Подстановка по определению — непустое значение на выходе при пустом входе. Значит её вселенная выводится не из
  синтаксиса, а из **прогона с пустыми входами**: все поля владения пусты (прогон уже есть — `gh461-export-turf-keys`,
  «пустые входы»), плюс «все, кроме одного» на каждое поле (подстановка может срабатывать только при частично пустом
  входе — регион от координат при заданном виде); собирается **каждое непустое значение** в `word/document.xml` и в
  каждом теле записи (`PATCH`/`POST`), и вычитается множество значений прогона с полным набором уникальных значений
  (девятнадцатое: фикстура, где каждое поле — уникальный часовой): что осталось — подставлено, **какой бы формой ни было
  написано**, `if`, `||`, аргументом, PHP или чтением соседнего источника. Статический сборщик остаётся стороной
  «объявлено»: каждое наблюдённое подставленное значение обязано сопоставиться записи инвентаря (место, форма); значение без
  записи — новая форма или новое место, красный; запись без наблюдённого значения — мёртвая или заслонённая, паспорт
  или снятие. Равенство в обе стороны. Форма становится колонкой записи, а не условием попадания. Это тот же ход, что вселенная стража покрытия из документа (тридцать четвёртое, п. 3): множество берётся из того, что вышло наружу, не из мест в коде (сороковое, связка). Границы хода, названы:
  (а) стоки — документ и тела записи, экран пока нет (экранные подстановки — тот же прогон на страницах через
  jdom/живой, отдельная работа); (б) подстановка, срабатывающая только при **непустом** входе (замена одного значения
  другим, не пустоты) — этот ход её не видит по определению, это другой класс (уже названный: «печать по истинности» и
  «второй писатель»); (в) значения, одинаковые в пустом и полном прогоне (заголовки, подписи) — не подстановки, вычитаются
  сами. Что инвентарь гарантирует до этого: только три формы над 28 именами на трёх стоках — и ничего больше; так и
  писать в его паспорте (`universe: declared, forms: 3, names: 28`).

**Часть 2. Порог фосфора у MLSN — кислотность есть факт пробы.** Решение владельца принято (сдвиг порогов — последствие,
не риск); замер координатора по 48 пробам принят как её замер (6 меняются: 3×32, 2×28, 1×40; 33 остаются 21; у 9 pH нет).
- **Наблюдение подтверждено по коду:** ветвь MLSN (`word-export.js:9145-9152`) читает `soilInput.pH_water`, где
  `soilInput = window.GAIP_STATE.soil` (`:8584`); на живом экспорте объект не определён (замер GH-490), лестница не
  срабатывала. GH-490 перевёл на `data.soil.pH` по id **только ветвь SLAN** (`:8904-8910`) и оставил MLSN — второй писатель
  той же логики в двух ветвях, одна переведена, другая нет.
- **(1) Чем отличается от показаний — классом не отличается, ролью отличается.** Тот же класс: факт пробы читается из
  состояния страницы. Роль другая: показание печатается, а pH здесь — **вход производного факта** (порог P от pH), и
  производный наследует исход входа (двадцать восьмое). Устройство то же, что у показаний: pH берётся из `data.soil.pH`,
  который GH-490 уже получает из `readingsOf('soil', sample)` по id (`:8688-8689`); лестница выносится в чистую функцию
  `mlsnPFloor(pH)` и вызывается из одного места; **не проверила**, есть ли вторая копия лестницы MLSN в движке потребности
  (у SLAN есть `_getSlanTargetP`) — если есть, одна функция на обоих, иначе паритет Plan/экспорт разойдётся ровно на этих
  шести пробах.
- **(2) Когда pH нет — 21 есть умолчание, и это доменный вопрос 10.8(25).** 21 — минимум MLSN при нейтральном pH; применить
  его без pH — принять нейтральный pH за факт. По правилу владельца порог не выводится: исход pH `empty` → порог P
  `empty` → статус P не считается, строка реестра «Phosphorus threshold: not derived (pH not reported)», показание P
  печатается без статуса. Но это меняет отчёт у 9 из 48 проб (пропадает статус P), и владелец только что оставила
  умолчание сертификата — решать ей: 21 как «стандартный минимум MLSN» (тогда второе именованное исключение, с цитатой) или
  «не выводим». До ответа поведение не меняется, запись в инвентаре «в инвентаре до ответа», строка реестра не заводится.
- **(3) Кто ещё читает pH со страницы — выводится, не перечисляется.** Тот же ход, что для документа: два прогона с
  одной пробой (pH пробы = B) и разным состоянием страницы (`GAIP_STATE.soil.pH_water` = A, затем C, оба часовые); любое
  различие в `word/document.xml` между прогонами — чтение pH со страницы, где бы оно ни стояло; вселенная — diff
  документа. Для экрана — тот же приём на странице (Plan). Grep как дым, не список находок: `GAIP_STATE.soil` читают 13
  файлов; pH из состояния/DOM — `hub-tissue-v3.js:2271` (с умолчанием 7), `:3216`, `:5815`, `gilba-synthesis-interpretation.js:375`,
  `cascade-orchestrator.js:425`, `mlsn-progressive-disclosure.js:948`, `nutrition-calendar.js:1067, 1137`,
  `nutrition-au-fertiliser-integration.js:390` — это собственный прогон страницы (вид II), не документ, и им место в слое
  II, не в этой правке. Строка реестра L6.

**Часть 3. 10.8(23) закрыт владельцем: второй слой молчит без объяснения.** Разделы вида II без данных этого сайта
отсутствуют; ни сноски, ни строки реестра, ни абзаца. Область `release` печатающего потребителя не имеет: сноска «About
this report version» (`:11764`) и её выборка (`:11709`) снимаются.
- **Три области или две плюс признак — три, и вот чем держится третья.** Область — свойство маршрутизации: куда запись
  идёт. У `release` маршрут — **никуда, и это маршрут**: потребитель в продукте есть, он отрицательный — фильтр, который не
  пускает `release` ни в таблицу сайта, ни в абзац прогона. Это наблюдаемо: мутация «`no-run-stamp` → `site`» меняет документ
  (строка появляется), значит классификация имеет эффект у клиента, и по тридцать первому это поле продукта, не проверки.
  Сверка трёх областей (поправка к тридцать третьему: «есть у всех сайтов всех прогонов ⇔ `release`») остаётся и держит
  различение независимо от печати. Записи `release` продолжают собираться в карту исходов (замороженная модель) — это
  инструмент владельца для «потом исследуем, как привязать»: число `release`-записей на документ — мера того, сколько
  слоя II ещё нет, и оно идёт к нулю, когда отметки появятся; читается из модели и журнала экспорта, не из документа.
  Положительный контроль: та же запись со `scope: site` печатается; со `scope: release` — нигде в `document.xml`.
- Корень (замер координатора, передан как её): четыре раздела берут данные из общего места без отметки сайта с первого
  коммита, вместо отметки — запасное чтение со страницы. Это описание слоя II как он есть; работа заведена в документе
  открытых вопросов, раздел 18.

**Не проверено мной:** вторая копия лестницы MLSN в движке; что пустой прогон gh461 покрывает тела записи, а не только
документ (сток `PATCH` есть у сборщика, у прогона — не проверяла); `readingKeysFor('soil')` содержит `pH` — закрыто замером координатора (`sample-manager.js:1541`, живой замер по пробе 141).

**Сороковое уточнение, 17.09.2026 — десять сдач после переписанного S7; срез без правой границы.** Замер разработчика
принят как его (21/21 после привязки; положительный контроль: при нуле таблиц у Russley чтение «по всему документу»
вернуло ряд Auckland). Прочитан переписанный `gh459-cross-site-inputs-live.test.js` (`:118-250, 453-690, 706-860,
879-1002, 1020-1181`) и стражи песочницы по сдачам; состояние дерева в брифе не заполнено — чтение, не замер.

**Что S7 утверждает теперь (по коду теста), чтобы «держится» было проверяемо.** Срез — по маркеру продукта «Report n of N»
(`:178-195`); на каждый отчёт: своя таблица Site Information с именем сайта (`:595-606`), свой вид внутри своего отчёта
(`:610-626`), ни одного чужого вида в отчёте — **кроме последнего** (`:629-658`, для последнего только журнал),
ровно одна таблица с шапкой `Month | GP%` и без `null` (`:662-676`), две различные GP-колонки (`:680`); положительный
контроль GH-491 (`:706-858`): сайт без климата не печатает своей таблицы, другой печатает свою целиком, чтение по всему
документу отвечает про чужой сайт. **Пробел, названный сразу:** S7 утверждает **различность** колонок, а не равенство
каждой известному ряду своего сайта (тридцать седьмое требовало: кусок Russley = ряд Christchurch, кусок Test5 = ряд
Auckland); перестановка колонок между отчётами прошла бы зелёной. Правка только данных теста (оба ряда известны),
в задание S7 как дополнение; на выводы ниже влияет там, где сказано.

**1. По каждой из десяти.**
- **GH-467** (снят фолбэк `_buildEngineInputs` по сайту страницы). **Подтверждается.** Держится: S7 — страница на другом
  сайте весь экспорт, и колонки двух отчётов различны (фолбэк дал бы одну и ту же — программу сайта страницы — в обоих,
  красный по `:680`); песочница — `gh461-export-identity-dataflow` (поток данных без разрешения по сайту страницы),
  `gh468-document-site-is-named`. Перестановка к этому дефекту не относится: он даёт совпадение, не обмен.
- **GH-468** (`siteId` обязателен). **Подтверждается.** Песочница `gh468-document-site-is-named` (резольверы бросают без
  id, ветвь `!siteId` снята); живьём — тот же S7-довод, что у 467.
- **GH-469** (входы календаря каждой пробы от своего сайта). **Подтверждается для GP и программы;** держится:
  песочница `gh469-calendar-inputs-are-built` (карта источников, `===`, заморозка), живьём S7 (различные колонки, своя
  Site Information) и S8 (`:879-1002`, отказ переключения — проба пропущена, чужая кривая не позаимствована). С оговоркой
  о перестановке: равенство ряду своего сайта — после дополнения S7.
- **GH-470** (`inputsForSite` одним аргументом). **Подтверждается.** Одиночная итерация — паритетный харнесс (сверка всей
  формы, не зависел от S7, тридцать восьмое); цикл — S7 и `gh469`.
- **GH-476** (регион от сайта). **Подтверждается, и моя запись в тридцать восьмом «живого доказательства не было вовсе»
  неверна:** живое есть — S9 (`:1020-1181`, GH-474): сайт перенесён AU → NZ, регион по id — `new_zealand`, каталог
  следует, поле координат страницы не отвечало (`:1167-1181`). Держится: `gh476-region-follows-the-site` + S9. Что не
  доказано живьём: регион **в цикле** для второго отчёта (S9 — один сайт); это песочница.
- **GH-478** (нормали по координатам). **Подтверждается — и это сдача, целиком стоявшая на слепом S7.** Теперь держится:
  песочница `gh459-own-temperatures` (12 температур сайта A на странице B) и `gh477-sandbox-stores-are-keyed` (нормали —
  стор по паре координат, две записи); живьём — S7 (различные колонки) и положительный контроль GH-491, который и есть
  та мутация (Christchurch отключён) → красный о Russley (`:828-835`). Оговорка о перестановке относится сюда сильнее
  всего: «различны» не значит «свои»; дополнение S7 закрывает.
- **GH-479** (отказы цикла). **Подтверждается, на S7 не стояла:** песочница `gh479-combined-loop-refusals` + живой S8.
- **GH-480** (три чтения страницы → по id: вид, методология и третье). **Подтверждается по виду, по методологии —
  песочницей и одиночным паритетом:** вид — S7 (`:610-626`, свой вид внутри своего отчёта, чужого нет — кроме
  последнего отчёта, см. п. 2); методология в цикле живьём не утверждается (S7 диапазоны не читает); держится
  `gh461-export-turf-keys`/`-provenance`, `gh459-own-temperatures`, паритет Test5. Живое покрытие методологии во второй
  итерации — многосайтовое расширение паритета (тридцать восьмое, п. 3), не S7.
- **GH-481** (экстрактант от методологии) и **GH-482** (текстура → сертификат → диапазоны AA). **Подтверждаются
  песочницей и одиночным паритетом (Test5, AA); живого доказательства в цикле нет и не было** — S7 диапазонов не
  читает, так что на нём они не стояли, и переписка S7 их не меняет. Ими закрывается то же расширение паритета.
  По 482 дополнительно: тесты переводятся на эффект (диапазоны S277 против выведенных) по закрытию 10.8(22) — до этого
  `gh482` утверждает метку, потребителя у которой нет.
**Итог:** переделывать не нужно ни одну; **на S7 и больше ни на чём** не стояла ни одна — у каждой есть страж песочницы,
но живое подтверждение цикла было слепым у 467, 468, 469, 470, 478 и по виду у 480, и теперь оно есть с одной оговоркой
(перестановка). У 480 (методология), 481, 482 живого подтверждения цикла нет до расширения паритета — не регрессия,
а названная граница.

**2. Срез без правой границы — маркер нужен, и это правка продукта.** Довод «хвост не похож на отчёт» — доказательство
отсутствия над перечисленной вселенной (двадцать первое: текстовый страж доказывает только отсутствие над тем, что
перечислено): «нет таблицы Site Information и нет шапки `Month | GP%`» верно о сегодняшнем хвосте и ничего не говорит о
завтрашнем. Что при этом ловится, а что нет — по коду теста: новая таблица в хвосте с шапкой `Month | GP%` даст в
последнем срезе две таблицы и красный по `:674` — это ловится; **чужие имена в последнем срезе не утверждаются вовсе**
(`:629-658` — только журнал), потому что хвост их уже содержит: Fertiliser Purchasing Summary печатает `<siteLabel>, …`
(`word-export-combined.js:4994, 5026`). То есть у последнего отчёта отсутствует ровно та проверка, ради которой S7
переписан, и держится она не на непохожести, а на том, что её нет. Значит маркер. Продукт уже печатает маркер начала
(«Report n of N»); правка — парный маркер конца, одна строка того же стиля («End of report n of N») в цикле
комбинированного экспорта перед общезаводским хвостом. **Это правка продукта, видимая клиенту:** одна строка в
документе, называется в отчёте сдачи отдельным разделом «изменение поведения для клиента», с образцом. После неё
срез последнего отчёта равен срезу остальных, проверка чужих имён применяется ко всем, оговорка «сказано где» снимается.
До маркера — строка реестра: последний отчёт документа проверяется слабее остальных (без чужих имён). Альтернатива,
названа и не выбрана: резать по первому заголовку хвоста («Annual Nutrient Requirements») — это снова непохожесть,
заголовок хвоста меняется тем же коммитом, что добавляет раздел.
**Цена варианта «без маркера» — перечень, по коду теста, без оценки (ответ координатору для решения владельца).**
Сегодня, при нынешнем хвосте:
1. Отсутствует: утверждение «в отчёте нет чужого вида» для последнего отчёта (`:629-658` — только журнал). Остальные
   утверждения S7 для последнего отчёта сегодня не ослаблены: Site Information берётся первой таблицей `Site | имя`
   (хвост такой не содержит), вид — из строки Species этой таблицы, а не текстом по срезу, GP — из таблицы с шапкой
   `Month | GP%` (в хвосте нет), различность колонок — от хвоста не зависит.
2. Ослаблено по построению для всего, что придёт после S7 через тот же срез (`reportOf` для остальных одиннадцати живых
   тестов, тридцать седьмое; многосайтовое расширение паритета, тридцать восьмое п. 3): хвост содержит таблицу Annual
   Nutrient Requirements со строками **всех проб всех сайтов**, Fertiliser Purchasing Summary с ярлыком **каждого** сайта,
   Monthly N Distribution по сайтам. Любое утверждение вида «в отчёте n есть строка пробы X / значение Y» для последнего
   отчёта выполнимо хвостом для X любого сайта. Это не слепота сегодняшнего S7, это ложность контракта «блоки отчёта n»
   для последнего n, и она достанется каждому следующему тесту на этом срезе.
При будущем изменении хвоста (условно):
3. Ложный красный: таблица с шапкой `Month | GP%` в хвосте → у последнего отчёта две таблицы → `:674` красный не о
   дефекте; то же для контроля GH-491 «сайт без климата не печатает своей таблицы» (`:828-835`), если этот сайт последний.
4. Ложный зелёный: контроль GH-491 «другой сайт печатает свою целиком» (`:838-845`), если этот сайт последний, а его
   таблицы нет, но такая появилась в хвосте.
Итог одной строкой: сегодня — только чужие имена в последнем отчёте (п. 1); для всего, что будет строиться на этом срезе
дальше, — п. 2, и он не зависит от будущих правок хвоста.

**Сорок первое уточнение, 17.09.2026 — область меняется: многосайтовая выгрузка откладывается; разбор сделанного и
очереди по двум путям.** Решение владельца: выгрузка по нескольким сайтам уходит в открытые вопросы, клиенту — выбирать
один сайт; работа — чтобы та же кнопка Экспорт (видны все сайты и пробы) правильно выгружала **по одному сайту**. Снято:
маркер конца отчёта, многосайтовое расширение паритета, две дыры S7. Разработчик остановлен посреди правки, дерево не
откатывалось.

**Опорный факт для разбора.** «Один сайт» — это тот же комбинированный цикл с одной выбранной пробой (паритетный харнесс
так и экспортирует: `Deselect all` → одна проба, `checkedCount === 1`). Цикл исполняется одну итерацию: `setActiveSite
(entry.siteId)`, `loadSample`, прогон, `collectData`, хвост. Указатель страницы при этом может стоять на другом сайте —
довод координатора верен и по коду: класс GH-459 (документ о сайте X из состояния страницы, отрисованной под Y) не
зависит от числа отчётов. Значит два пути различаются так: **одиночный** — «свой сайт против указателя и состояния
страницы» в одном отчёте; **многосайтовый** — «отчёт среди отчётов»: вторая и далее итерации, срезы по маркерам, чужие
имена из соседних отчётов, общезаводской хвост.

**1. Десять сдач — все относятся к одиночному пути по предмету; ни одна не откатывается.**
- GH-467 (фолбэк по сайту страницы снят), GH-468 (`siteId` обязателен), GH-480 (три чтения страницы → по id), GH-481,
  GH-482 (экстрактант, текстура — от владельца по id): предмет — чтение состояния страницы вместо сайта документа; с одним
  отчётом и указателем на другом сайте дефект тот же. **Одиночный.**
- GH-469 (входы от своего сайта, не от активного), GH-470 (`inputsForSite` одним аргументом), GH-476 (регион по id),
  GH-478 (нормали по координатам, не единственный слот): механизм — «активный/страничный вместо своего»; с одной пробой и
  указателем не на ней — тот же дефект. **Одиночный**; их многосайтовая часть (порядок итераций) — отложена вместе с
  путём.
- GH-479 (отказ переключения → пропуск пробы): с одной пробой отказ значит «не печатать против сайта страницы» — **оба**,
  для одиночного даже важнее (иначе единственный отчёт — о чужом сайте).
Что менялось в их подтверждении: живое подтверждение цикла (S7) было слепым; для одиночного пути живое подтверждение —
S7 в одиночной форме (п. 2) и паритет (п. 4).

**2. Переписанный S7 — разрезается, не снимается.**
- **«Свой сайт против указателя» (одиночный, остаётся):** установка — страница переведена на другой сайт на весь экспорт
  (`setActiveSite(OTHER_SITE.id)`, утверждение `activeDuringExport === OTHER_SITE.id`, `:571-575`); Site Information
  называет сайт пробы (`:595-606`); вид — сайта пробы (`:610-626`); GP-колонка — **ряд сайта пробы, не ряд сайта
  указателя** (это и есть «дыра о перестановке» из сорокового в одиночной форме: с одним отчётом «различность» не
  существует, остаётся только равенство известному ряду — оба ряда известны, правка данных теста). Одиночные тесты
  `:400-420` (колонка = свой сайт после переключения; напечатано сохранённое в базе) — одиночный, остаются.
- **«Отчёт среди отчётов» (многосайтовый, откладывается):** срезы по «Report n of N» (`:178-195`), «две таблицы, два среза»
  (`:578-592`), «нет чужого вида в отчёте» (`:629-658`), «свою программу, не первую в файле» и различность колонок
  (`:662-680`), хвост последнего среза — всё это про соседей и снимается вместе с путём.
Форма S7-1: одна выбранная проба сайта A, указатель на B, документ с одним отчётом: имя, вид, GP-ряд — A; ничего из B.

**3. Положительный контроль GH-491 — в нынешней форме многосайтовый, в одиночной форме нужен.** Нынешний (`:706-858`):
Russley без климата, Test5 печатает, чтение по всему документу отвечает про соседа — демонстрирует слепоту среза среди
отчётов; откладывается. Одиночная форма, дешёвая (те же данные): проба A, указатель на B, климатические хосты A отрезаны →
в документе **нет** Monthly Schedule и есть строка реестра, и **нет ряда B** (ряд указателя) под именем A. Без этого
контроля S7-1 не отличает «напечатал своё» от «напечатал указателя», когда своё недоступно. **Оставить в одиночной форме.**

**4. Паритетный харнесс в нынешнем виде — одиночный путь целиком, остаётся как есть.** Одна проба через диалог, документ
с одним отчётом, сверка с Plan той же пробы (25 тестов на фикстуру). Не покрывает: указатель на другом сайте (страница
и проба — один сайт) — это S7-1. Многосайтовый ANR-тест (`:2152-2175`, `crossSite`) и расширение из тридцать восьмого
п. 3 — многосайтовые, снимаются; сам `crossSite`-блок фикстуры — в отложенное.

**5. Очередь плана — по путям.**
- **Одиночный, остаётся:** владелец факта на входе программы (указатель страницы там и есть предмет); почва по id (GH-490,
  сдано); исходы показаний и страж покрытия (тридцать четвёртое); границы заморозки (тридцать пятое) **и 33 записи
  комбинированного цикла (тридцать шестое п. 1) — цикл исполняется и для одной пробы, второй писатель меток и параметры
  сборки — одиночный предмет**; реестр доступности и области (28–33, 35 поправка); инвентарь от пустого прогона и статусы
  с ценой (тридцать девятое ч. 1, 10.7); лестница pH по пробе (тридцать девятое ч. 2, исключение 10.8(25)); методология —
  владелец колонка (двадцать девятое п. 2); строка сайта на `/plan` с отметкой (двадцать девятое п. 1); слой II —
  отметки прогона (с одним сайтом и указателем на другом результаты прогона — сайта указателя; класс тот же); журнал
  сети в живом наборе (тридцать седьмое п. 2); сеть/задержка — пары; вселенная сторов (двадцать пятое); поле без
  потребителя (тридцать первое–второе); ноль при печати (тридцать второе п. 2).
- **Многосайтовый, откладывается в открытые вопросы:** маркер конца отчёта и L7; `reportOf` для одиннадцати живых
  тестов (тридцать седьмое п. 1 — при одном отчёте кусок равен документу, помощник не нужен); многосайтовое расширение
  паритета; срезы/хвост S7; GH-491 в нынешней форме; 10.8(20) (какую водную пробу печатать зоне при нескольких —
  формулировка про зоны комбинированного экспорта; для одной пробы вопрос остаётся в виде «одиночный экспорт: какую
  водную пробу сайта печатать, если выбрана не она» — переформулировать, не закрывать); строка L5 переписывается: слепота
  среза — отложено, указатель — S7-1.
- **Не зависит от пути:** Q26, паспорта, реестр устройств и составной прогон (тридцать шестое п. 4), пары замеров.

**Что из снятого продолжает ловить дефект при одном сайте — и потому снимать нельзя:**
1. **Равенство GP-колонки известному ряду сайта пробы** («вторая дыра S7» из сорокового) — при одном отчёте это
   единственное утверждение о климате: без него S7-1 не отличит ряд пробы от ряда указателя. Остаётся в одиночной форме.
2. **Сценарий «указатель на другом сайте весь экспорт»** — тело S7; снимать можно только срезы, не установку.
3. **Положительный контроль в одиночной форме** (п. 3) — иначе «своё недоступно» и «напечатал указателя» неразличимы.
Маркер конца отчёта и многосайтовый паритет при одном сайте не ловят ничего — снимаются без потери.

**Не проверено мной:** что диалог экспорта с одной пробой действительно единственный клиентский путь одиночной выгрузки
(в дымоходе две точки входа — вторая, одиночный `exportToWord`, чем вызывается с экрана, не перечитывала); порядок
остановленной правки разработчика — что в дереве недоделано, координатору снять до следующего задания.

**Сорок второе уточнение, 17.09.2026 — граница исправлена: несколько отчётов ОДНОГО сайта работаем, отчёты РАЗНЫХ
сайтов отложены; разбор перестроен; список того, что в рабочем пути сегодня не работает или не проверено.** Сорок
первое построено на границе «одна проба, одна итерация» — она передана неточно и неверна; сорок первое остаётся в
тексте как след, ниже — действующий разбор.

**Первой строкой.** «Один сайт» в интерфейсе и «один отчёт мимо комбинированного построителя» — не одно и то же, и
второго в продукте нет: пикер на `/reports/export` всегда строит через комбинированный построитель, при одной пробе
печатает «Report 1 of 1» и общезаводской хвост (замер разработчика). Клиент выбирает один сайт и **несколько проб** —
документ многоотчётный, по отчёту на пробу. Делить надо по выбору клиента: **несколько отчётов одного сайта — работаем;
отчёты разных сайтов — отложено.** Вторая клиентская точка входа: не найдена — единственная кнопка
`reports/export.blade.php:136`, вызовов `exportToWord` вне `word-export*.js` в `assets` ноль (чтение, не замер); дымоход
держит одиночную точку как модульную, не клиентскую.

**Факт, который меняет больше всего (измерено на документе Russley с тремя пробами, сорок третье; условие и список — по
коду).** У второй и следующих проб одного сайта в документе **отсутствуют пять** разделов: Site Information, Climate & Growth
Conditions, Soil Amendment Recommendations, Water Quality, Performance Impact Analysis. Список `siteLevelHeadings`
(`word-export-combined.js:3407-3470`, `if (!isFirstForSite)`) длиной 27, остальные разделы сегодня не печатаются вовсе,
поэтому вырезать у них нечего; пропуск идёт «до следующего заголовка» (`:3478-3488`). Два следствия:
1. **Идентичность отчёта** со второго берётся не из Site Information (её нет), а из шапки «<сайт> , <метка пробы>» перед
   маркером «Report n of N» (печатает продукт, `:3286`) — то, что есть у всех отчётов.
2. **Реестр «Data availability»** — не заголовок (жирный абзац + таблица, `word-export.js:11702`) и стоит сразу после
   таблицы Site Information; пропуск до следующего заголовка уносит его вместе с Site Information у всех отчётов, кроме
   первого. Инструмент владельца слеп по пробам 2..n. По форме; первый живой замер на документе с двумя пробами одного
   сайта это и проверит.

**Чем отчёты одного сайта различимы — устройство.** Предложение разработчика принято: различающее — **проба и то, что из
неё считается**: шапка с меткой пробы; таблица Soil Nutrition с показаниями пробы (ppm P/K/Ca/Mg/S, pH, CEC, OM);
«Sampled: <дата>»; после GH-484 — тканевые и водные показания по id. Ожидание берётся **не из движка, а из
`samples.payload` этой пробы в базе** — независимый источник, четвёртая точка цепочки (поправка к двадцать восьмому,
п. 4): продукт лабораторную запись только печатает. Это сильнее прежней сверки GP, где ожидание строил тот же движок.
GP-колонка у проб одного сайта одна (функция координат, вида, подсева) — «колонка = ряд сайта, не ряд указателя» остаётся
единственным утверждением о климате и **общим для всех отчётов сайта**, а не «второй дырой S7»; красная проверка
перестановкой колонок пуста и заменяется перестановкой **проб**: загрузить в отчёт n пробу m → таблица показаний отчёта
n ≠ payload пробы n → красный.

**Разбор по новой границе.**
1. **Десять сдач** — все в рабочем пути (предмет — чтение состояния страницы вместо сайта/пробы документа; указатель может
   стоять не там при любом числе отчётов); ни одна не откатывается; их живое подтверждение — S7 в форме «несколько проб
   одного сайта» и паритет.
2. **S7 — почти целиком остаётся:** срезы по «Report n of N», два и более срезов, «свою программу, не первую в файле»,
   хвост без правой границы, положительный контроль GH-491 в форме «третий жертвенный отчёт того же сайта» (кто стоит
   последним — предусловие остаётся). **Меняется:** идентичность отчёта — по шапке, не по Site Information (со второго её
   нет); различающее число — таблица показаний пробы против payload, не GP; **снимается** (требует разных сайтов): «нет
   чужого вида», «нет чужого имени сайта», три различных вида, различность GP-колонок между отчётами.
3. **GH-491** — остаётся в форме одного сайта: три пробы, у второй по порядку климат… нет — климат у одного сайта общий;
   жертва здесь — **проба без показаний** (payload пуст): её отчёт без таблицы Soil Nutrition и со строкой реестра, соседние —
   со своими; чтение «первого совпадения» по документу вернёт чужую таблицу — та же демонстрация слепоты, что вчера.
4. **Паритетный харнесс** — одиночная проба через тот же пикер, остаётся как есть (одна итерация того же пути);
   `crossSite`-блок и многосайтовое расширение — отложено.
5. **Очередь:** возвращаются маркер конца отчёта и L7, `reportOf` для одиннадцати живых тестов (кусок документу **не**
   равен), срезы; 10.8(20) (какая водная проба зоне при нескольких — это ровно один сайт с несколькими пробами) —
   **в рабочем пути, открыт**; остальное из сорок первого п. 5 «одиночное остаётся» — остаётся. Откладывается только:
   многосайтовое расширение паритета, `crossSite`, утверждения о чужих сайтах, L5 переписывается в форму одного сайта.

**Список для владельца: что в пути «один сайт, несколько проб, комбинированный построитель» сегодня не работает или не
проверено — сведение известного, поимённо.** Пометки: ДЕФЕКТ У КЛИЕНТА / ДЫРА В ПРОВЕРКЕ / ОТЛОЖЕНО РЕШЕНИЕМ; рядом —
чем установлено (замер / по коду / не измерено).
1. **Реестр «Data availability» отсутствует у отчётов 2..n** (уносится пропуском вместе с Site Information) —
   **ДЕФЕКТ У КЛИЕНТА, по коду, живьём не измерен.** Строки о показаниях этих проб не печатаются нигде.
2. **Разделы, зависящие от пробы, отсутствуют у отчётов 2..n как «site-level»** (измерено: из пяти отсутствующих — Soil
   Amendment Recommendations зависит от pH, Ca/Mg пробы; Water Quality и Performance Impact Analysis — по существу спорно) —
   **ДЕФЕКТ У КЛИЕНТА, вероятный; какие из пяти по существу «о пробе», а какие «о сайте» — доменное, 10.8(26)**; до ответа —
   как есть.
3. **Граница последнего отчёта** (срез до конца тела, хвост с ANR-строками всех проб и сводкой закупок) — **ДЫРА В
   ПРОВЕРКЕ, по коду:** у последнего отчёта «в отчёте есть строка/значение пробы X» выполнимо хвостом для любой пробы
   сайта; закрывается маркером конца отчёта (правка продукта, в работе).
4. **Чтения «первого совпадения»** в живых тестах, разбирающих документ (12 файлов, тридцать седьмое) — **ДЫРА В
   ПРОВЕРКЕ, дым по regex:** для фактов сайта при одном сайте безвредно, для фактов пробы (ppm, метки, ткань) слепо со
   второго отчёта; закрывается `reportOf` по шапке.
5. **S7 читает идентичность из Site Information** — со второго отчёта таблицы нет: **ДЫРА В ПРОВЕРКЕ, по коду;** переезд на
   шапку и на сверку показаний с payload (устройство выше).
6. **Дописывание в модель после сборки — 33 записи** (`word-export-combined.js:747…3110`), заморозка модели не ставится —
   **ДЫРА В ПРОВЕРКЕ, замер разработчика;** второй писатель меток (`:766-772`) — при нескольких пробах одного сайта метка
   пробы отчёта n перезаписывается из `entry` — вероятно верно, **не измерено**.
7. **31 утечка состояния страницы в документ** (GH-475: 31 часовой из 11 корней) — **уточнено сорок шестым по замеру:**
   `mlsnResults` мёртв (absent во всех 27 сборах), моя гипотеза о гонке между пробами снята; живой дефект — **первый отчёт
   каждого экспорта** считает по состоянию страницы в окне между очисткой сайта и восстановлением конфига (0% GP, нет
   Priority Actions) — **ДЕФЕКТ У КЛИЕНТА, измерен**, устройство — сорок шестое (ожидание события `site-config-applied`,
   снятие подстановки нуля).
8. **Вердикты второго слоя (ткань, вода — `resultsOmitted`)** — разделы отсутствуют без объяснения — **ОТЛОЖЕНО РЕШЕНИЕМ**
   (10.8(23)); исследование привязки — раздел 18 документа открытых вопросов.
9. **Тканевая и водная ветви в песочнице не исполняются** (L1) — вид II по ним **ДЫРА В ПРОВЕРКЕ** (замер ревьюера).
10. **Ноль отбрасывается при печати** (`if (data.water.SAR)` и ещё ~100 ворот) — **ДЕФЕКТ У КЛИЕНТА**, показание 0 не
    печатается (по коду; в базе нулей — не проверяла).
11. **Лестница порога P у MLSN читает pH со страницы** и не срабатывала — **ДЕФЕКТ У КЛИЕНТА, замер:** порог у 6 из 48
    проб иной; правка в работе (тридцать девятое ч. 2, исключение 10.8(25)).
12. **Методология в трёх местах; сервер считает по MLSN при настройке SLAN у трёх сайтов** — **ДЕФЕКТ У КЛИЕНТА, замер** (не
    экспорт, а серверный анализ; в пути, если экран/документ его читают — потребители не сняты).
13. **Умолчания видов** (`'Perennial Ryegrass'` ×7, `'Couch'` ×3, `'Not specified'`, `'generic'`) — **ДЕФЕКТ У КЛИЕНТА, по
    коду;** решение владельца есть (10.8(7)), правка не сдана.
14. **Какую водную пробу печатать зоне при нескольких** (последняя по порядку ключей) — **ОТЛОЖЕНО РЕШЕНИЕМ (открыт
    10.8(20))**; сегодня выбор молчалив.
15. **Живой набор зависит от внешних серверов и молчит о сети** (41 запрос за прогон) — **ДЫРА В ПРОВЕРКЕ, замер.**
16. **Границы заморозки и поле без потребителя** (L2–L4, статусы по реестру 10.11) — **ДЫРА В ПРОВЕРКЕ** до закрытия строк.
17. **Site Information у 2..n отсутствует, а метка/дата пробы печатаются шапкой и строкой «Sampled:»** — не дефект, а
    форма документа; **не измерено живьём**, что шапка и «Sampled:» печатаются у каждого отчёта (по коду `:3286` — да).
18. **Гонка 300 мс** (`await 300` в цикле) как механизм п. 7 — **ДЕФЕКТ У КЛИЕНТА по механизму, ОТЛОЖЕНО** в части
    отметок прогона (слой II — раздел 18).

**Не проверено мной:** всё, что помечено «по коду»; первый живой замер — документ с двумя пробами одного сайта: есть ли
у второго отчёта шапка, «Sampled:», таблица Soil Nutrition своей пробы, реестр; это одно измерение закрывает пп. 1, 5,
7, 17 разом и идёт первым.

**Сорок третье уточнение, 17.09.2026 — живой замер по Russley (три пробы, один документ): что подтвердилось, что
поправлено; проба чужой зоны — класс и устройство; место реестра доступности; маркер.** Замер координатора и
разработчика принят (страница на Test5; Russley, пробы 103/104/105, тканевая запись одна — 142).

**Поправка к сорок второму по замеру.** Вырезано у отчётов 2 и 3 **пять** H1 (Site Information, Climate & Growth
Conditions, Soil Amendment Recommendations, Water Quality, Performance Impact Analysis), не 27: список `siteLevelHeadings`
— намерение, документ — факт; моё «27 разделов по коду» в сорок втором — ровно та ошибка перечня, о которой писала
сама. По списку владельца: п. 1 (реестр отсутствует у 2..n) — **измерено**; п. 5 (идентичность из Site Information) —
подтверждён; п. 17 закрыт (шапка у каждого); п. 3 подтверждён (метки двух других проб в срезе последнего — общезаводская
ANR ключуется меткой пробы); п. 7 (гонка) — **не измерен**. Числа показаний трёх отчётов совпали с `samples.payload` до
цифры — устройство «ожидание из базы, не из движка» подтверждено; GP-колонка у трёх одна — снятие различности
подтверждено. Priority Actions есть у 2 и 3 и нет у 1 — зависит от pH пробы (у 105 pH нет), не вырезание. 10.8(26)
сужается до пяти измеренных разделов.

**1. Проба чужой зоны — класс и устройство.** Механизм один и найден по коду: резольвер берёт пробу как
`opts[kind + 'SampleId'] || active[kind]` (`nutrition-program-inputs.js:1080`) — когда у зоны нет тканевой пробы,
перечислитель передаёт `tissueSampleId: null` (зона без своей — без ткани, правило владельца, `word-export-combined.js:
310-316`), и `||` подменяет отсутствие **активной пробой сайта**. Это то состояние `on-file-not-selected`/`none-for-zone`
из тридцатого, которое устройство запрещало брать молча, — оно не реализовано, и вместо «нет пробы у зоны» печатается
проба сайта под заголовком зоны. Класс: **факт, привязанный к зоне, при отсутствии подменяется фактом сайта.** GH-484
закрыла чтение формы, но не эту подмену. Устройство:
- `|| active[kind]` из резольвера уходит. Вызывающий передаёт id явно; `null` от перечислителя означает «у этой зоны пробы
  этого вида нет» → исход `empty / none-for-zone` с числом проб вида у сайта («no tissue sample for this zone; 1 on file
  for the site: Green 18»), раздел опущен, строка реестра. Одиночный вызов без id (страница сама выбрала пробу) передаёт
  `allActive[siteId][kind]` **явно**, как намерение, — подмены по умолчанию не остаётся нигде.
- **Какие ещё разделы берут пробу не той зоны — выводом от напечатанного, не перечнем.** Прогон отчёта зоны Z, у которой
  нет пробы вида K, при том что активная проба сайта вида K несёт уникальные часовые в каждом показании; каждое значение в
  срезе Z, равное часовому, — раздел, печатающий пробу сайта вместо пробы зоны; вселенная — срез. По коду ожидание:
  канал один (после GH-484/490 все показания идут через `inputs.samples.*`), значит и утечка одна — `:1080` для `tissue`
  и `water`; для `soil` id всегда задан. Прогон это подтверждает или опровергает, а не я. Вода — тот же класс в другом
  месте: перечислитель подставляет «последнюю» водную пробу зоне без своей (`:311-315`, 10.8(20)) — это доменный
  вопрос владельца (у воды нет правила «зона без своей — без воды», как у ткани), и до ответа поведение прежнее с видимой
  строкой реестра (тридцатое).
- **Положительный контроль:** отчёт Green 18 печатает 142; отчёты Green 13 и Green 1 — без Tissue Analysis, со строкой
  реестра «no tissue sample for this zone (1 on file: Green 18)». Мутация ревьюера: вернуть `|| active[kind]` → «Green 18»
  в трёх отчётах → красный по сверке с payload (у 103/104 тканевого payload нет — значит любые тканевые числа в их
  срезе красные).

**2. Место реестра доступности — про отчёт; строки о сайте печатаются один раз; печать по субъекту, не по положению.**
Замер: сводка есть только у первого отчёта, потому что печатается внутри Site Information (вырезана у 2..n), а строка
«Not included:» есть у каждого — она привязана к своему разделу. Ошибка — **размещение по положению** («сразу после Site
Information»), а не по субъекту записи. Устройство: у записи появляется ось **субъект**, выводимая из владельца поля
(`FIELD_OWNERS`), не объявляемая: `site` (настройки сайта: вид, текстура, методология, место) и `sample` (показания,
выбор пробы, вердикты этой пробы). Оси причины (`site`/`run`/`release`, поправка к тридцать третьему) остаются — они о
**почему**, субъект — о **чём**; они ортогональны, и переименование не нужно, хотя область причины `site` и субъект
`site` — разные вещи (первая — «может отличаться между сайтами», вторая — «о настройке сайта»); чтобы не путать,
область причины `site` переименовывается в `local` («не общая для документа»). Печать: записи субъекта `sample` — в
каждом отчёте, своим блоком под собственным заголовком, стоящим вне вырезаемых разделов (после шапки отчёта, до первого
H1 — то место, где Site Information нет ни у кого); записи субъекта `site` — один раз на сайт, в первом отчёте сайта (или
в блоке сайта, если построитель его заведёт); абзац `run` — один раз на документ, в голове документа комбинированным
построителем, не в каждом отчёте (иначе три одинаковых); `release` — нигде (10.8(23)). Так «объяснение у каждого, свод у
одного» перестаёт быть противоречием: у каждого отчёта свод **о своей пробе**, свод о сайте — один. Проверка: документ
трёх проб — три блока `sample` с разными наборами (у 105 «pH not reported», у 103/104 — свои), один блок `site`, ноль
повторов; мутация: вернуть реестр в Site Information → у отчётов 2..3 блока нет → красный.

**3. Маркер конца отчёта** нужен и при одном сайте — подтверждено замером (метки чужих проб в срезе последнего);
вопрос владельцу в силе, L7 стоит.

**Следующий замер, вместо выполненного.** П. 7 — гонка: тот же документ Russley трижды с задержкой цикла 0, 300 и 2000
мс (`await 300` в цикле — искусственное условие, парой с обычным); сравнить по отчётам всё, что печатается из результатов
прогона страницы (`data.soil.summary` от `mlsnResults`, Priority Actions, `waterResults`, траектория): различие между
прогонами у одного и того же отчёта — содержимое, зависящее от гонки, поимённо. Это и есть цена п. 7 в числах для
владельца, до решения по слою II.

**Не проверено мной:** что перечислитель передаёт `tissueSampleId: null` именно для Green 13 и Green 1 (по коду
`buildZoneMap` — да; по журналу экспорта — разработчику); есть ли у `run`-абзаца уже дублирование по отчётам в живом
документе (замер этого не называл).

**Сорок четвёртое уточнение, 17.09.2026 — откуда берётся список имён инвентаря: вселенная имён выводится, не
перечисляется.** Замер координатора принят: тканевая подстановка (`opts[kind + 'SampleId'] || active[kind]`,
`nutrition-program-inputs.js:1080`) сделана формой `||`, которую сборщик знает, и в инвентарь не попала — имя не входит
в 28 имён фактов сайта. Две дыры разной природы за день: утром по форме (`if (!x) x = 'S277'`), сейчас по вселенной имён;
вторая напечатала клиенту чужие числа.

**1. Да, выводится — и тем же ходом, что вселенная стража из документа.** Подстановка — непустой выход при пустом входе.
Имя, под которым код держит значение (`aaSampleType`, `active`, `tissueInput`), для этого определения не нужно; нужен
**перечень входов, которые можно опустошить**, и он выводится из продукта, не набирается: это ключи карты происхождения,
которую резольвер строит **в прогоне** — каждый `record(field, …)` регистрирует поле, каждый вид пробы — запись
(`provenance.soilSample/tissueSample/waterSample`), производные наследуют. Прогон с записью даёт множество входов, о
котором тест не знает заранее; новый вход, прочитанный через резольвер, попадает в него по построению. Вход, прочитанный
**мимо** резольвера, в это множество не попадает — и это не дыра вселенной, а другой, уже сторожимый класс (чтение
состояния страницы: яд GH-475, поток данных, пустой контекст без глобалов). Дальше — как в тридцать девятом, ч. 1:
опустошение по одному входу («все, кроме одного») и все сразу; каждое непустое значение на выходе, которого нет в
полном прогоне с уникальными часовыми, — подстановка для опустошённого входа, **под любым именем и любой формой**.
Тканевый случай в этом устройстве ловится без единого имени: вход `tissueSample` опустошён (`tissueSampleId: null`), на
выходе — числа; чтобы они были различимы, **записи, на которые может упасть подмена, должны существовать и нести
часовые** — активная тканевая проба сайта в фикстуре обязана быть и быть отравленной; иначе подмене не на что упасть, и
прогон скажет «чисто» ложно. Это требование к фикстуре, а не к перечню: положительный контроль опустошения — «есть куда
упасть».
- **Статический сборщик** остаётся стороной «объявлено», и его `watched` **генерируется** из ключей карты происхождения
  (равенство в обе стороны с `FIELD_OWNERS`), а не набирается. У него остаётся второй, свой предел, и он сильнее, чем я
  записала сначала («`subjectName` отвечает `null`» — неверно, проверено координатором по `tests/lib/substitution-inventory.js:
  48-51`): для `MemberExpression` с `computed: true` функция возвращает имя **объекта**, и для `opts[kind + 'SampleId'] ||
  active[kind]` записью становится `opts` — подстановка названа, но контейнером, а не полем. Формулировка предела в паспорт
  сборщика: **имя вычисляемого ключа статически не разрешается, вместо поля регистрируется контейнер, поэтому фильтр по
  именам такую запись либо отбрасывает (контейнера нет в списке), либо пропускает всё разом (добавить `opts` — значит
  принять любое поле любого вызова, и запись перестаёт что-либо означать). Третьего у статического разбора нет.** Вывод
  прежний: этот случай статика не поймала бы и с верным списком; у динамической стороны предела нет.
- **Что гарантирует инвентарь после этого:** динамически — «для каждого входа, зарегистрированного резольвером в прогоне,
  при его опустошении на выходе нет непустого значения без записи инвентаря»; статически — «три формы над сгенерированными
  именами с простыми путями до трёх стоков». Границы, названы: входы мимо резольвера (другой класс, свой страж);
  подмена непустого непустым (другой класс); стоки — документ и тела записи, экран отдельно.

**2. Что это меняет в очереди.** Двадцать второе и тридцать девятое ч. 1 объединяются в одно задание «инвентарь от
пустого прогона»: вселенная входов — из карты происхождения прогона; фикстура с часовыми в каждой записи каждого вида
(включая активные пробы сайта); статический `watched` — генерируется. Положительный контроль задания: тканевый случай
(`:1080`) и `S277` (`:9014`) обязаны появиться в инвентаре первым же прогоном без правки перечней — иначе устройство
неверно. Две правки к устройству инвентаря из очереди (задание ещё не получено текстом) ложатся сюда же.

**Не проверено мной:** что резольвер регистрирует **все** свои чтения через `record()` (если часть идёт мимо, вселенная
прогона неполна ровно на них — это проверяется тем же путём: чтение мимо `record()` в резольвере = запись без
происхождения, страж потока данных десятого); что у `provenance` есть записи по видам проб после GH-484 (по коду
`:1088-1096` — есть).

**Сорок пятое уточнение, 17.09.2026 — владелец факта на входе программы.** Находка разработчика и замер приняты
(`word-export.js:7441-7447`: `siteId: _NPI.getActiveSiteId()`; 13 сайтов при странице на Test5 — у 12 годовой N = 250 из
persisted-программы Test5, в базе у них 120/150/200/250). Его оговорка держится в постановке: сегодня комбинированный
цикл переводит указатель перед сбором, и ответ верен, пока переключение улеглось; это показ ловушки, не дефект,
который клиент видит сегодня. Чтение кода — состояние дерева не названо.

**1. Кто зовёт вход и что считает своим сайтом (по коду).**
- **Экспорт**, `_buildEngineInputs` (`word-export.js:7441`): `siteId` — указатель (`getActiveSiteId()` = `SampleManager`
  → `GAIP_HUB_CONFIG.activeSiteId`, `nutrition-program-inputs.js:523-531`), при том что **`inputs.program` — та же
  программа, уже разрешённая по id** — у него в руках (`resolveExportInputs` зовёт `resolveSiteProgramInputs({siteId, …})`,
  `:1105-1111`; экспорт читает `inputs.program` для методологии и текстуры, `:8614, 8647`). Это не только указатель, это
  **второй писатель того же факта**: второй вызов передаёт другие аргументы (`soil: data.soil`, `sample: {species,
  methodology, CEC…}`), первый — `sample: {}`; два ответа могут расходиться не только сайтом. Потребители второго:
  `_userN = _programInputs.annualN` (годовой N движка, `:7492`), диапазоны, текстура, методология (`:7669-7684`).
- **Plan-страница**, `nutrition-calendar.js:1060`: `siteId: this.getActiveSiteId()` — сайт страницы; у Plan один сайт, и это
  законно по смыслу, но названо указателем, который правят на месте мастер и Account (восьмое, п. 2); передаёт живую
  форму (`planForm`) и факты пробы.
- **Резольвер экспорта**, `:1105` — по id, единственный верный вызыватель.
- **Комбинированный** — второй вызов снят (`word-export-combined.js:2314`), программа через `inputsForSite(_exportInputs)`
  по id.
Лестница годового N внутри (`:850-871`): форма Plan → persisted `meta.annualNBase` → persisted `target_n/mod` →
`turf.nProgram` (настройка) → **таблица по виду (`species-default`) — подстановка**, в инвентарь с ценой (сколько живых
сайтов без persisted и без `nProgram`) по 10.7; здесь не решается.

**2. Как факт получает владельца так, чтобы вызыватель не мог его не назвать.** Предложение координатора «перевести
вызов на `inputs.site.id`» **неполно**: id починит сайт и оставит два разрешения одного факта с разными входами.
Устройство:
- **Владелец сайта на входе программы — запись в руках вызывателя, не указатель.** Для экспорта — объект `inputs`
  (`resolveExportInputs`, по id); для Plan — отметка инжекта `GAIP_SITE_CONFIG_SITE_ID`/строка сайта с отметкой (двадцать
  девятое, п. 1), не `getActiveSiteId()`; для комбинированного — `_exportInputs` (уже).
- **Одно разрешение.** Второй вызов в экспорте (`:7441`) удаляется; `inputs.program` становится полным: факты пробы, которые
  экспорт добавлял во втором вызове (вид, методология, CEC, pH, текстура), резольвер экспорта передаёт сам — они у него уже
  по id (вид и методология — `fromConfig`, показания — `samples.soil.values` через `readingsOf`), `sample: {}` в `:1109`
  заменяется на них. Потребители `:7492, 7669-7684` читают `inputs.program`.
- **Вызыватель не может не назвать:** `siteId` уже обязателен (`_requiredSiteId`, GH-468), но назвать его указателем можно;
  поэтому **`getActiveSiteId` уходит из API `GAIP_NutritionProgramInputs`** — резольвер не отвечает на вопрос «какой сайт»,
  он его только получает. Plan получает id из отметки инжекта; экспорт — из `inputs`; больше некому. Указатель остаётся
  тем, что он есть, — состоянием страницы для страницы.

**3. Чем проверяется — от напечатанного, не перечнем вызывателей.**
- **Живьём, таблица разработчика становится стражем:** 13 документов при указателе на Test5; в каждом годовой N движка
  (печатается в программе/ANR) равен persisted-значению **этого** сайта в базе (четыре точки: БД → API → `inputs.program`
  → документ). Сегодняшняя цифра — 9 из 12 не равны (250 вместо своего) при **отключённом** переключении; при обычном
  прогоне — 12 из 12 равны (оговорка разработчика); пара «обычно / указатель не переключён» — оба числа рядом. Вселенная —
  число в документе, не список вызовов.
- **Песочница:** сайты A и B с разными persisted `annualNBase` (различимость), указатель на B (`GAIP_HUB_CONFIG.activeSiteId`,
  `SampleManager.getActiveSiteId` → B), экспорт A → N документа = A; яд: у B уникальное N-часовое — его появление в документе
  A красное. Плюс запись достижений (двадцать пятое): за экспорт ни одного обращения к `getActiveSiteId` любого стора —
  после удаления из API это доказывается отсутствием метода.
- **Plan:** `resolveSiteProgramInputs` на Plan-странице вызван с id, равным отметке инжекта, а не указателю: прогон, где
  `GAIP_HUB_CONFIG.activeSiteId` переписан после загрузки (как в поправке к двадцать девятому), — Plan считает по сайту
  отметки. Мутация ревьюера: вернуть `getActiveSiteId()` в любой из вызовов → красный по числу.
**Не проверено мной:** что `inputs.program` с `sample: {}` сегодня расходится со вторым вызовом хотя бы по одному сайту
(пара «первый ответ / второй ответ» по 13 сайтам — разработчику; если равны везде, удаление второго вызова ничего не
меняет у клиента; если нет — это своя находка); кто ещё читает `_programInputs.siteId` из журнала `[GH383]`.

**Сорок шестое уточнение, 17.09.2026 — первый отчёт каждого экспорта: ожидание временем вместо события; откуда ноль.**
Замер принят (воспроизводимо, 2 из 2, обычная загрузка): у первого отчёта Performance Impact печатает «Current growth
potential (0%)…», Monthly Schedule того же отчёта — сентябрь 13%; Priority Actions и строка о влажности почвы отсутствуют;
отчёты 2..n верны (18/18); прогоны с 0 и 300 мс дают один документ до символа, 2000 мс — верный. Мой п. 7 из списка
владельца снят как неверный: `GAIP_STATE.mlsnResults` мёртв (absent во всех 27 сборах). Чтение кода — состояние дерева не
названо.

**1. Чего именно ждёт код между загрузкой пробы и запуском анализа.** Не «DOM settle». Последовательность по коду:
`setActiveSite(entry.siteId)` шлёт `gaip:site-changed` → `site-switch-cleanup.js:203-214` **немедленно** очищает идентичность
тёрфа и глобалы прежнего сайта (`clearTurfIdentity`, `clearSiteGlobals`) → `site-config-persistence.js` восстанавливает
конфиг прибывающего сайта в легаси-DOM и глобалы **позже, по таймерам**: `gaip:site-config-applied` с `source: 'site-switch'`
через 150 мс (`:944-951`) и с `restored: true` через **1200 мс** после восстановления (`:1055-1066`, `config ? 1200 : 0`).
Цикл ждёт 300 мс и жмёт Run Analysis (`word-export-combined.js:694-696`). Прогон читает состояние страницы
(`gaip_build_state`, `hub-tissue-v3.js:6549`) — в окне между очисткой и восстановлением. Поэтому 0 и 300 мс — один
документ (оба раньше 1200), 2000 — верный (позже). Продукт это знал: комментарий у `:944-951` — «Without this, site-switch
always produces the wrong GP on first run (42% vs correct value)». Отчёты 2..n верны, потому что у одного сайта второй
`setActiveSite` не меняет сайт — `changed` ложь, события нет, очистки нет (`sample-manager.js:2448-2456`).
Итак, ждут **применения конфига прибывающего сайта к странице**, а не «оседания DOM».

**2. Почему у этого ожидания нет сигнала — сигнал есть, цикл им не пользуется.** `gaip:site-config-applied` существует, с
`detail.siteId`, и `hub-orchestrator.js:4878-4894` на него **ждёт** («config restore pending, deferring to
site-config-applied»). У соседнего шага сигнал использован (`waitForAnalysis` на `gaip:analysis-complete`, `:95-118`),
потому что тот шаг — конец прогона, который цикл сам запускает; шаг «конфиг применён» — следствие переключения, которое
цикл считал мгновенным, и ожидание было поставлено числом при первом же расхождении (комментарий «Small delay for DOM
to settle»). Осложнение, которое надо назвать: событие шлётся **дважды** на одно переключение — через 150 мс без
восстановления (`source: 'site-switch'`) и через 1200 мс с `restored: true`; ожидание первого попадёт в то же окно.

**3. Чем заменить ожидание времени.**
- **Событие с отметкой, не пауза:** после `setActiveSite` цикл ждёт `gaip:site-config-applied` с `detail.siteId ===
  entry.siteId` и `detail.restored === true`; если `setActiveSite` вернул «сайт не менялся» (тот же сайт, событий не будет) —
  не ждёт ничего. Таймаут — не «продолжаем как есть», а исход `unavailable / config-not-applied` для этого отчёта: разделы,
  стоящие на состоянии страницы, опускаются со строкой реестра (двадцать восьмое), прогон не запускается на пустом.
  `setTimeout(r, 300)` удаляется.
- **Если бы сигнала не было** — ждать наблюдаемого следствия, а не времени: условие «легаси-DOM и глобалы равны строке сайта»
  (`.gaip-lat/.gaip-lon` = `getSite(id).latitude/longitude`, вид = конфигу) опросом до выполнения с таймаутом в исход; сигнал
  заводить только там, где следствие ненаблюдаемо. Здесь сигнал есть, заводить нечего.
- **Долгий ответ — слой II:** прогон получает входы по id и не читает страницу; тогда ждать нечего. Здесь — ближний.
- Тот же класс рядом: `SETTLE_MS = 2500` «for charts to render» после `analysis-complete` (`:47`) — ожидание временем
  вместо события рендера; названо, в эту сдачу не входит.
- **Чем это ожидание отличается от того, что здесь уже стояло, — отдельной строкой, чтобы не появился третий таймер.**
  Механизм «ждать события» против того же дефекта уже вводился именно здесь: комментарий `site-config-persistence.js:
  944-946` (дословно, проверено координатором): «Dispatch site-config-applied so tissue auto-run uses the event path rather
  than the 1s fallback timer. Without this, site-switch always produces the wrong GP on first run (42% vs correct value)».
  Дефект был замечен, назван и закрыт — **таймером на 150 мс, который шлёт событие**. То есть потребитель ждал события,
  а событие было таймером под именем события: оно сообщает не «конфиг применён», а «прошло 150 мс», и о факте не знает
  (без `restored`). Второй отправитель (`:1055-1066`) тоже таймер — 1200 мс после восстановления. Отличие моего
  ожидания в трёх вещах, и все три проверяемы: (а) **событие шлёт тот, кто сделал факт, в момент факта** — из конца
  записи `restoreConfig` в DOM/глобалы, синхронно, без `setTimeout`; отправка через 150 мс удаляется как таймер под именем
  события, 1200-мс таймер снимается с отправки (если он нужен чему-то ещё — это другое ожидание, и ему своё событие);
  (б) **событие несёт факт, и потребитель его проверяет**: `siteId === entry.siteId` и `restored === true`, а не «пришло
  что-то с этим именем»; (в) **таймаут — исход, не продолжение**: `unavailable / config-not-applied` в реестре, прогон не
  запускается. Страж на класс «таймер под именем события»: статически — отправитель `gaip:site-config-applied` достижим
  только из пути записи восстановления, никогда из обратного вызова `setTimeout`/`setInterval` (поток данных,
  шестнадцатое); положительный контроль — сегодняшняя отправка `:944-951` обязана в нём краснеть. Динамически —
  утверждение о порядке из п. 5 (событие после `analysis-complete` → прогон не запущен).

**4. Откуда ноль — не один из трёх случаев координатора, а четвёртый: не посчитано, но напечатано как посчитанный ноль.**
Печать: `Math.round(gp)` при `gp !== undefined && gp !== null` (`word-export.js:4732-4737`) — 0 напечатан, значит в модели
число 0, а не пустота. Число 0 рождается в **двух** местах, строка посимвольно та же: `calcC3GrowthPotential` (`hub-tissue-v3.js:2095`) и
`calcC4GrowthPotential` (`:2101`) — `return gp != null ? Math.max(0, Math.min(100, gp * 100)) : 0;` — **движок ответил `null`,
обёртка подставила 0**. Правка `: 0` → `: null` называется в обеих (проверено координатором): иначе класс закрыт для
C3-видов и открыт для C4 — couch и buffalograss, то есть австралийские сайты. **Замечание координатора принято: я назвала место, а не
класс, и класс оказался вдвое больше — копия строкой ниже.** Класс выводится не по строкам с `: 0`, а от напечатанного:
прогон, в котором **каждый движок отвечает `null`** (`GilbaGrowthPotentialEngine.compute` и остальные `compute`/`calculate`
страницы — заглушены на `null`, вход — полная фикстура), и в документе собирается каждое числовое значение, которое при
таком ответе движка не имеет права существовать; каждое найденное — обёртка, подменяющая «не посчитано» числом, под любым
именем и в любом файле. Статический поиск `: 0`/`|| 0`/`?? 0` после `compute` — сторона «объявлено», сверка в обе стороны.
Правка идёт по выведенному списку, две строки `:2095/:2101` — его первые две записи, не весь список. Это подстановка того же класса, что `|| 'AU'`:
«не посчитано» становится «0%», и Performance Impact пишет клиенту про «severely restricts». Случай (1) «не посчитано»
по существу, замаскированный в (2) «посчитано». Что именно дало движку `null` в первом прогоне — не установлено чтением:
средняя температура строится с умолчаниями (`Et = max || 25`, `Nt = min || 15`, `:6123-6125`), так что пустой вход дал бы
20 °C и ненулевой GP, не ноль; `null` от `GilbaGrowthPotentialEngine.compute` — другой вход (какой — один
инструментированный прогон: журнал `Mt`, `ft` и ответа `compute` в первом прогоне; гипотеза — вход, очищенный
`clearSiteGlobals`, но это гипотеза). Устройство **не зависит от ответа**: `: 0` заменяется на `: null`, `growth.weighted =
null` доходит до экспорта, гейт `gp !== null` опускает абзац, реестр получает строку «growth potential not computed» —
и тогда ожидание чинит момент, а подстановка перестаёт маскировать «не посчитано» в любом будущем случае. Чинится ли
дефект ожиданием — да, для первого отчёта; но без снятия `: 0` следующий такой случай снова напечатает 0%.
**Размер сдачи — решение координатора, утверждено:** в сдачу входят ожидание события; снятие подстановки в **двух
известных** местах (`:2095`, `:2101` — цена известна); **выведение списка — как замер**, не как правка; инструментированный
прогон о входе, давшем `null`. Снятие остальных найденных **не входит**: по правилу владельца (10.7) подстановка не
снимается по правилу молча — каждая идёт владельцу вопросом с ценой, пакетом. `SETTLE_MS = 2500` — открытый вопрос, не в
работе.
**Форма вывода списка — с ценой сразу, не «найдено N мест»** (требование координатора, подтверждено; это правило 10.7,
применённое к моему же замеру): по каждому месту — что напечатается вместо подставленного числа (пустота, опущенный
абзац, строка реестра) и у скольких сайтов из живых это меняет документ (четыре точки: БД → прогон → документ). Места с
нулевой ценой сегодня — в пакет, но отдельной группой. Владелец видит сначала **два числа** — сколько мест с ненулевой
ценой и сколько с нулевой — и только потом, если захочет, перечень. Без этого пакет — полотно, и невидимость
возвращается в форме избытка.

**5. Проверка.** Живьём, парой: обычный прогон (сегодня — 0% и нет Priority Actions у первого отчёта) против прогона с
ожиданием события; утверждение — GP первого отчёта равен GP текущего месяца его же Monthly Schedule (сентябрь — 13%),
Priority Actions и строка влажности есть, отчёты 2..n не изменились (18/18). Порядок событий — по журналу: `site-config-
applied{restored}` для сайта отчёта раньше `analysis-complete`. Песочница: `site-config-applied` шлётся нарочно **после**
`analysis-complete` → цикл обязан не запускать прогон до него (утверждение о порядке, не о числе). Подстановка нуля:
прогон, где движок отвечает `null`, — в документе нет абзаца «Current growth potential», есть строка реестра; мутация
ревьюера — вернуть `: 0` → «0%» → красный; вернуть `setTimeout(300)` вместо события → первый отчёт красный по равенству
GP.

**Не проверено мной:** что `detail.restored` действительно `true` в 1200-мс отправке при наличии конфига (по коду
`restored: !!config`); вход, давший движку `null` (гипотеза, замер разработчика); что `hub-orchestrator` не запускает
собственный `computeAll` по `site-config-applied` так, что после ожидания прогон будет двойным (по коду он **ждёт** его —
значит, наоборот, сегодняшний ранний Run Analysis идёт до оркестратора; порядок снять журналом).

**Связка приёмов (по замечанию координатора):** «вселенная стража из документа» (тридцать четвёртое, п. 3) и «от
пустого входа к напечатанному» (тридцать девятое, часть 1) — один приём: **множество, о котором утверждает проверка,
берётся из того, что вышло наружу, а не из мест в коде**; первый — для полноты покрытия, второй — для подстановок. Обе
записи получают перекрёстную ссылку; в паспорт стража строка `universe` допускает два происхождения — «из выхода
продукта» и «объявлено, сверено с выходом», третьего («из перечня в коде») нет. Числа дыма по формам (тридцать девятое)
стоят в плане только с оговоркой «сырые вхождения оператора, не подстановки» и масштабом не являются — так и в отчётах.

**Замечание к методу после тридцатого, 17.09.2026 — предложение; решения координатора 17.09: п. 1 принят (порядок: текущая сдача → почва по id → слой II; двадцать шестое п. 2 с первого места снято), п. 2 — замер цены jsdom держится, пока не ясно, остался ли вопрос; риск вынесен в 10.11 отдельной строкой; граница п. 3 записана координатором в документ владельца.** В тридцатом проверка
перестала зависеть от неисполняемых ветвей песочницы не потому, что инструмент починен, а потому, что предмет измерения
сменился вместе с правкой: числа больше не берутся из форм, и заполняет ли их песочница — неважно. Тот же ход применим
ещё в двух местах очереди; называю до того, как за ними выстроятся задания.

1. **Двадцать шестое, п. 2 (настоящий `sample-manager.js` на jsdom с разметкой форм) — для экспорта становится ненужным,
   если остаток 10.5 (почвенные показания) пойдёт по id так же, как ткань и вода.** Единственное чтение экспорта, которое
   ещё держится на заполненной форме, — `data.soil` («the soil readings, read off the page», `ALLOWED_IN_DOCUMENT`); резольвер
   уже отдаёт `samples.soil.values` программе (`nutrition-program-inputs.js:1107`). Когда и почва читается из записи по id,
   ни одно чтение экспорта не зависит от `loadSample`, и граница подмены в песочнице для экспорта не нужна. Что остаётся
   на формах — собственный прогон страницы (вид II: `tissueResults`, `mlsnResults`, водные индексы, смесь) — измеряется
   отметкой прогона (слой II), а отметка проверяется событием с отметкой в jsdom (`gh459-results-carry-a-stamp`), без
   настоящего `sample-manager`. Двадцать шестое остаётся верным утверждением о песочнице (ветви не исполняются) и остаётся
   в реестре как «вид II по ткани и воде не измерен», но перестаёт держать очередь: п. 2 двадцать шестого снимается с
   первого места и откладывается до решения, нужен ли он вообще. Порядок вместо него: тридцатое п. 1 → почва по id
   (остаток 10.5) → слой II отметки.
2. **Двадцать пятое (вселенная сторов двумя проходами) — нужно для переходного состояния, конечное состояние дешевле и
   строже.** Двухпроходная обёртка всех глобалов отвечает на вопрос «до чего дотянулся экспорт», пока экспорт вообще
   тянется к глобалам. Конечное состояние по десятому: `collectData(inputs)` и генераторы разделов — функции от `inputs` и
   отмеченных результатов, без `window`. Тогда доказательство — не запись достижений, а **отсутствие глобалов**: экспорт
   исполняется в контексте, где нет ни одного `GAIP_*`, `document`, `localStorage` (только `docx`/`JSZip`), и любое чтение
   бросает `ReferenceError`. Это та же смена предмета: не «записать всё, до чего дотянулся», а «дотянуться некуда».
   Двадцать пятое остаётся как замер переходного периода (пока чтения есть, их надо видеть), но задание «обернуть все
   глобалы» не строится как конечное; вместо него — храповик на число мест, где экспорт читает `window`, до нуля, и после
   нуля пустой контекст как единственный страж.
3. **Где ход не применим и почему.** Слой II (результаты прогона страницы) — предмет можно было бы сменить радикально:
   считать вид II в экспорте от входов по id чистыми движками, как Plan считает программу, и убрать прогон `/hub` в
   iframe из экспорта вовсе; тогда отметки не нужны. Это меняет не измерение, а продукт (какой код считает разделы
   документа), цена не оценена, паритет алгоритмов пришлось бы доказывать на каждом движке — не предлагаю в очередь,
   называю как границу хода: там, где предмет менять нельзя без решения владельца, инструмент чинится.
Риск самого хода, чтобы не забыть: смена предмета убирает зависимость от сломанного инструмента только для этого предмета;
для страницы (Plan, собственный прогон) инструмент по-прежнему сломан, и строка «не измерено» из двадцать шестого не
закрывается тридцатым.

Необязательное, принято: при удалении дублирующего блока пропал сигнал о неразрешённом конфиге сайта. Поведение верное
(подмены нет, печатается «Not specified»), диагностика нужна: `console.warn('[WordExport] site config unresolved for <id>: ' +
<поля unresolved из inputs.sources>)` — `warn`, не `error`, чтобы дымоход (ноль `console.error`) оставался верен для законного
состояния.
- `tests/gh459-results-carry-a-stamp.test.js` (jsdom): событие с отметкой сайта A при входах сайта B → раздел опущен,
  `data.omitted` содержит его; отметка B → раздел есть; событие без отметки → раздел опущен (старый раннер не считается
  доверенным).
- `tests/gh459-late-cascade-does-not-land.test.js` (jsdom, по образцу gh377 `bootWithServer`): каскад запланирован для A,
  переключение на B до срабатывания, срабатывание → входы B не тронуты, в логе `dropped`.
- Существующий `tests/hoxton-combined-export-per-site-climate.test.js` (GH-459) поглощается (а).

**Сорок седьмое уточнение, 17.09.2026 — 10.8(26) закрыт владельцем: вырезание разделов по позиции — дефект; устройство
«опущено по данным, не по позиции»; и второе устройство — мутация предполагаемого источника.**

**Часть A. 10.8(26).** Решение владельца: план генерится по одной пробе, отчёт про пробу обязан нести её план и её
рекомендации; если по пробе план не генерировался — раздел опускается **по отсутствию данных**, со строкой реестра, а не по
позиции в документе. Два основания различаются, второе должно стать невозможным.
- **Какие из пяти зависят от пробы — замером, не списком.** Устройство замера: один сайт, две пробы A и B, у которых
  различается каждое показание (различимость); два документа по одной пробе каждый (обе — «первые», ничего не вырезано);
  каждый из пяти разделов сравнивается между документами. Содержимое различается → раздел о пробе; совпадает → о сайте
  (или ни о чём). Положительный контроль: Soil Nutrition обязан различаться, Site Information — совпадать; иначе фикстура
  или сравнение неверны. Моё чтение генераторов — заявка, не результат: Performance Impact читает пороги почвы, диапазоны
  тканей, Ca/K/Mg пробы, воду (`word-export.js:4559-4720`) — о пробе; Water Quality читает только `data.water`
  (`:13426-13506`) — о водной пробе зоны (10.8(20)); Soil Amendment Recommendations — по смыслу о pH/Ca/Mg пробы,
  генератор по имени не нашла (`:8799`, `:11413` — упоминания), замер решит; Site Information и Climate & Growth
  Conditions — о сайте. Расстановку координатора (2 о сайте, 3 о пробе) замер подтвердит или опровергнет.
- **Чем отчёт получает разделы своей пробы.** У раздела появляется **субъект**, выводимый из его входов, не объявляемый:
  тот же обходчик, что у стража покрытия (тридцать четвёртое), собирает пути модели, которые читает генератор раздела;
  субъект = `sample`, если среди путей есть путь субъекта `sample` (показания, план пробы, вердикты пробы), иначе `site`.
  Это та же ось субъекта, что у записей реестра (сорок третье), — одна карта на оба.
- **Чем «опущено, потому что данных нет» отличается от «опущено, потому что отчёт не первый», и как второе становится
  невозможным.** Позиционного вырезания не остаётся: список `siteLevelHeadings` и условие `!isFirstForSite` уходят.
  Единственное допустимое повторение-сокращение — **дедупликация разделов субъекта `site`**, и она делается не по позиции,
  а по **равенству содержимого**: раздел печатается один раз на сайт только если его содержимое в отчёте n равно уже
  напечатанному в отчёте 1 (сравнение блоков); неравенство — не «пропустить», а красный: раздел объявлен о сайте, а
  различается по отчётам, значит он о пробе. Разделы субъекта `sample` в дедупликацию не входят по построению; их
  присутствие решает **исход данных** (двадцать восьмое): план/показания/водная проба этой пробы `present` → печать;
  `empty` → опущен со строкой реестра «no programme generated for this sample» / «no water sample for this zone»; в
  документе не бывает отсутствующего раздела без строки реестра (страж покрытия: каждое отсутствие имеет исход).
  Так «не первый» перестаёт быть основанием: основания у пропуска два — равенство содержимого (только `site`) и исход
  `empty` (со строкой), третьего в коде нет.
- **Проверка.** Документ двух проб одного сайта: Soil Amendment Recommendations, Performance Impact, Water Quality — в
  обоих отчётах, с разным содержимым; Site Information, Climate — один раз, равные. Отрицательный прогон: у пробы B плана
  нет → в отчёте B раздел плана отсутствует **и** есть строка реестра. Мутации ревьюера: вернуть заголовок в список
  вырезания → отчёт 2 без раздела при `present`-данных и без строки → красный; объявить Soil Amendment субъектом `site` →
  дедупликация видит неравенство → красный.
- **Что упирается в данные и идёт владельцу — 10.8(27).** Сохранённый план (`nutritionCalendarProgram`) хранится в конфиге
  **сайта**, один на сайт, и в `meta` (`nutrition-calendar.js:2181-2222`) отметки пробы нет — есть методология, вид,
  распределение, но не `sampleId`. Значит «план сгенерирован по пробе X» сегодня из данных не следует, и исход
  «no programme for this sample» вычислить нельзя. Устройство: при генерации план получает `meta.sampleId` (отметка), читатель
  сопоставляет по id; **старые планы без отметки** — доменный вопрос: считать их планом сайта для всех проб (как сегодня)
  или ничьими до перегенерации. До ответа — как сегодня, со строкой реестра «programme not attributed to a sample».

**Часть B. Мутация предполагаемого источника — проверка представления, не кода.** Находка разработчика принята: половина
`NutritionCalendar.calculateGP` не изменила напечатанную колонку GP (3/3), мутация `GilbaGrowthPotentialEngine.compute`
изменила всё — колонка идёт мимо функции, через которую мы считали. Следствие координатора верно: представления о пути
чисел проверены не везде.
1. **Вселенная — выводится, не перечисляется.** Числа документа, у которых в наших записях **назван источник**, — это ровно
   то, что уже собрано картой стража покрытия (тридцать четвёртое): каждое напечатанное значение ↔ путь модели, и у пути —
   **предполагаемый писатель** (функция, откуда путь получает значение по потоку данных, шестнадцатое) плюс то, что
   объявлено словами: `FIELD_PATHS`/`sources` резольвера, `claims` в паспортах стражей, фразы «берётся из X» в этом плане
   и в changelog. Вселенная проверки = множество пар «напечатанное значение → предполагаемый писатель»; пара без
   писателя — уже находка (число, о котором мы ничего не утверждали).
2. **Чем проверяется каждое.** Мутация предполагаемого писателя — детерминированное искажение его **выхода** (`×0.5`,
   `+1`, инверсия булева) — и утверждение: напечатанное значение изменилось ровно там, где записано. Не изменилось —
   путь идёт мимо. Прогон один на писателя, вселенная закрыта, значит это конечный список прогонов, выведенный из карты.
3. **Расхождение — чинить запись, кроме одного случая.** По умолчанию неверна запись (план, паспорт, `FIELD_PATHS`): она
   правится на измеренного писателя. Исключение, которое надо проверять при каждом расхождении: если число считается
   **двумя** путями (как здесь: `calculateGP` и прямой вызов движка распределительным модулем) — это класс «два места
   одного факта» (10.7, методология): Plan и документ могут разойтись ровно тогда, когда два пути перестанут совпадать;
   тогда чинится продукт (один путь), а запись — следом. Решает не «скорее второе», а вопрос: есть ли второй живой путь.
4. **Предел приёма, и как его держать.** Неприменившаяся мутация ничего не доказывает (`project_unapplied_mutation…`).
   Три вердикта, различимые в устройстве: (а) **не достигнуто** — мутированная функция не вызывалась в прогоне (счётчик
   внутри мутации или запись достижений двадцать пятого = 0); (б) **достигнуто, но выход не изменился** — мутация на
   реальных входах не отличима (`×0.5` при `gp = 0`, `+1` на `null`): пишется пара «оригинал/мутант» на каждом вызове,
   равенство = мутация пустая; (в) **достигнуто, выход изменился, документ не изменился** — единственный вердикт «путь
   мимо». Только (в) правит запись; (а) и (б) — «не измерено», мутация подбирается заново. Положительный контроль приёма:
   мутация **измеренного** писателя (движок GP) обязана менять документ — иначе не работает сама проверка.
**Не проверено мной:** что `siteLevelHeadings` — единственное позиционное вырезание в построителе (`alwaysStrip` для
Cross-Module — второе, о документе, не о позиции отчёта; других не искала); генератор Soil Amendment Recommendations по
имени; писатель `nutritionCalendarProgram.meta` — читала одну запись, могут быть другие.

**Сорок восьмое уточнение, 17.09.2026 — связь плана с пробой восстановима по снимку (10.8(27) меняется); пара в строке
климата из двух источников.**

**Часть A — закрыта решением владельца 17.09.2026 сразу после записи: «да, нам нужен идентификатор. А со старыми планами
ничего страшного, мы перегенерируем и всё».** Остаётся только п. 1 (отметка `meta.sampleId` при генерации, чтение по id);
п. 2 и п. 3 (сопоставление старых планов по снимку и ветка неоднозначности) **сняты** — они были нужны только для
восстановления старых. План без отметки — **непривязанный**: раздел плана в отчёте пробы опущен по исходу `empty` со
строкой реестра «programme not attributed to a sample — regenerate the programme for this sample». Довод «сопоставление по значениям ломается молча» остаётся — как причина не делать сопоставление вообще, а не делать его однократно.

**Часть B. Пара в строке климата — два числа из разных источников, поданные как одно утверждение.** Замер принят:
«Temperature 8.5 °C, Growth Potential (C3) 13%», GP посчитан из 8.91 °C; при дефекте первого отчёта пара разошлась на 9.7
против 6.6. По коду (чтение, не замер): печатаемая температура — `data.climate.temperature = cm.temperature.mean` из
`window.climateMetrics` (`word-export.js:8508-8510`); откуда движок GP берёт свою температуру — не устанавливала, это тот же
инструментированный прогон, что в сорок шестом п. 4 (журнал входа движка), одна работа на оба.
- **Устройство: пара — одна запись одного писателя.** Предложение вида «температура T, GP из неё G» печатается только из
  объекта `{ temperature, gp, source }`, который **возвращает вычисление GP** вместе с температурой, на которой считало;
  экспорт не собирает пару из двух путей модели. Если продукт хочет показать и другое показание (среднюю прогноза,
  норму месяца), оно печатается **отдельным подписанным значением** («forecast mean 8.5 °C», «GP 13% at 8.9 °C, monthly
  normal»), а не в одной строке без подписи. Какую температуру подписать какой — после замера происхождения; если оба
  показания законны, печатаются оба с подписями, если одно из них — промежуточное, оно не печатается вовсе. Это не
  домен: правило «пара из одной записи» архитектурное; домен — только формулировка подписей.
- **Проверка от напечатанного.** Страж покрытия (тридцать четвёртое) для каждого абзаца с двумя и более числами
  требует, чтобы их пути модели имели **одного писателя** (поток данных); абзац с числами разных писателей — красный, если
  у чисел нет подписей источника. Динамически — приёмом сорок седьмого, часть B: мутация входной температуры движка
  (+10 °C) обязана изменить **оба** числа строки вместе; мутация средней прогноза не должна менять строку GP (или должна
  менять только подписанное «forecast mean»). Сегодняшняя строка на этой проверке красная по построению: 8.5 и 13% — от
  разных писателей.
**Не проверено мной:** писатель температуры для движка GP (инструментированный прогон); есть ли другие абзацы-пары в
документе (страж покрытия даст список — он и есть вселенная, перечень не составляю).

**Сорок девятое уточнение, 17.09.2026 — об инструменте судят по тому, что он сделал, а не по тому, что о нём написано:
журнал действия проверки как сторона «исполнено» паспорта.** Два случая дня с одной причиной: утром S7 читал первое
совпадение по документу, а десять сдач считали его зорким (утверждение шире инструмента); вечером разработчик дважды
измерил «кнопка генерации на /plan невидима» и назвал дефектом, тогда как харнесс паритета (`ui-vs-export-parity.test.js:
813`) всё это время кликал `a[data-tab="nutrition"]` перед кнопкой — зонд не открыл вкладку (утверждение уже
инструмента). Оба круга начались с утверждения об инструменте, сделанного не из наблюдения за его работой.

**1. Чем измеряется, что проверка делает.** Не текстом теста и не паспортом, а **журналом действия** — записью того, что
исполнилось в этом прогоне: для живого теста — последовательность действий (переходы, клики с селекторами, ожидания с
тем, чего ждали), чтения документа (какой файл, каким срезом и по какому якорю, единица — документ/отчёт/таблица),
утверждения с фактическими значениями; для стража песочницы — запись достижений (двадцать пятое: до чего дотянулся),
обойдённые пути, утверждения с фактическими значениями. Журнал пишется самим тестом в машинно-читаемом виде (одна
запись на тест в выводе прогона, по правилу «живой прогон сохраняется целиком») и есть **единственный носитель
утверждений об инструменте**. Утром журнал S7 показал бы «прочитана таблица №1 документа» вместо «прочитан срез отчёта
2» — слепота видна до того, как на неё опёрлись; вечером — «клик по кнопке без клика по вкладке» против журнала харнесса
«вкладка → кнопка» — расхождение зонда с покрытым путём видно до слова «дефект».

**2. Как встраивается в паспорт — сторона «исполнено» к стороне «объявлено».** В паспорте есть `guarantee` и `claims`
(объявлено); не хватает **`observed`**: каждое утверждение `claims` записывается как **предикат над журналом**, а не как
фраза — «единица чтения = отчёт для каждого отчёта документа» = `journal.reads.every(r => r.unit === 'report')`;
«кликает Generate на вкладке Nutrition» = «в `journal.actions` клик `a[data-tab="nutrition"]` стоит раньше клика
`#plan-nut-generate-btn`». Мета-страж паспортов (`guard-passports.test.js`) после прогона вычисляет предикаты на
фактическом журнале: утверждение без свидетеля в журнале — переоценка инструмента (утренний случай), красный; действие
журнала, которого нет в `claims`, — инструмент делает больше, чем объявлено, — запись в паспорт, не красный. Равенство
в обе стороны, как у форм сторов. Второе встраивание — **правило для зондов**: замер, объявляющий дефект на пути, который
покрывает существующий харнесс, обязан **воспроизвести журнал действий харнесса** для этого пути или назвать каждое
отклонение; расхождение действий — первый подозреваемый, продукт — второй. Это то же правило, что «опущено принимается с
цитатой»: **«инструмент видит X» / «инструмент не видит X» принимается только со строкой журнала**, где это видно.
Никакого отдельного ритуала: журнал — часть вывода прогона, предикаты — часть паспорта, сверка — часть мета-стража.
**Следствие, замеченное в первом применении (координатор, 17.09):** расхождение зонда с журналом харнесса — не только
подозреваемый, но и источник ответа: харнесс несёт в порядке своих шагов знание о том, что нужно продукту, чтобы путь
вообще начался (пример: генерация на `/plan` требует выбранной в пикере пробы — разработчик нашёл это как «пропущенный
шаг» и получил ответ на свой вопрос за двадцать минут). Это следствие правила о журнале, не отдельное правило, но у него
одно самостоятельное применение, которое стоит строки: **шаги харнесса, без которых путь не начинается, — это
предусловия пути, и они нигде не были записаны, кроме порядка кликов живого теста.** В паспорте они становятся явными —
`preconditions` как часть стороны «объявлено» (предикаты над журналом: «до клика по кнопке в журнале есть выбор пробы»),
— и этот список есть **вселенная для стража «молчаливый no-op»**: для каждого предусловия продукт при его невыполнении
обязан ответить пользователю, что и почему (кнопка на сайте без проб — no-op без ответа, раздел 26 документа открытых
вопросов, класс «отсутствие ответа вместо ответа», двадцать восьмое). Проверка — от показанного, и наличие текста как такового **не засчитывается** (координатор: «“Ничего не выбрано” без
указания, что именно не запустилось, — то же молчание, только вежливое»; подпись «No soil samples for this site» стоит в
карточке постоянно, а клиент, нажавший кнопку, ответа не получил). **Предикат над показанным:** ответ — это разность
экрана после действия и до него (`shown.after − shown.before`), и она (а) непуста — текст, стоявший до клика, ответом не
является по построению; (б) называет **действие, которое не состоялось** (подпись кнопки/действия, как оно объявлено в
предусловии: «programme not generated»); (в) называет **причину** — имя нарушенного предусловия («no soil sample
selected»). Три условия вместе; любое одно — молчание. Предусловие без такого прогона — «не проверено».
**Вселенная «что может промолчать» не составляется** — в паспорт прямо: она выводится из предусловий живых путей, то есть
из того, что тесты вынуждены делать, чтобы продукт заработал (журналы харнессов); тот же ход, что у покрытия
(тридцать четвёртое), источник другой — не напечатанный документ, а предусловия живых путей. Новый живой путь приносит
свои предусловия в вселенную по построению; путь без харнесса — путь без известных предусловий, и это его строка реестра.
Число таких путей — **результат устройства, не оговорка**: реестр отвечает не только «какие кнопки молчат», но и «для
скольких путей мы не знаем, что им нужно для работы»; оба числа идут владельцу (правило в памяти проекта, 17.09.2026:
раздел «границы, названы» пустым не бывает, число в границе — такой же результат, как число в покрытии).

**3. Предел.** Утверждения об инструменте, которые нельзя проверить иначе, чем прогоном: всё, что о его поведении **при
условии** — слепота при опущенном разделе видна только в прогоне с опущенным разделом; зоркость клика — только при
исполненном клике. Для них вместо фразы пишется одно из двух: либо предикат над журналом **прогона с этим условием**
(положительный контроль — GH-491 и есть такой прогон), либо явное «не проверено: требует прогона при условии C; прогон
не выполнен» — с условием по имени. Утверждения о **вселенной** («покрывает всё X») прогоном не доказываются — только
выведением из выхода (тридцать четвёртое, сорок четвёртое). Утверждения о **будущем** («хвост останется непохожим»)
не проверяются вовсе — пишутся как условие с границей («держится, пока ___; страж на границу — ___»), никогда как факт.
Утверждения об **отсутствии в коде** — форма, не поведение (постоянная часть брифа). Общее правило записи: фраза об
инструменте в плане, отчёте или паспорте либо ссылается на строку журнала, либо помечена «не проверено» с условием;
третьей формы нет — она и дала оба круга.

**Отметка к сорок восьмому, часть B (замер разработчика):** писатель у пары климата один (`window.climateMetrics`), второго
нет; расхождение — **внутри записи**: три температуры, печатаются две, посчитанные не друг из друга, подпись называет
третью величину. Устройство «пара из одной записи» выполнено по форме и не выполнено по смыслу: пара обязана печатать
величины, отношение между которыми называет подпись. Какое число верное — владельцу, отправлено; до ответа хода нет.

**Пятидесятое уточнение, 17.09.2026 — молчащая кнопка выводится без харнесса: предусловие — то, что продукт читает перед
тем, как отказаться работать.** Замер координатора принят: Russley, программы нет, три пробы есть; «Calculating for: Green
18», клик «Generate Nutrition Program» — ноль событий за 60 с, ноль запросов, база без изменений, кнопка активна, консоль
чиста; причина — пустое ANNUAL N TARGET без `required` (`plan.blade.php:914`, только placeholder); у сайта с сохранённой
программой поле заполняется из неё, поэтому там кнопка работает. Граница сорок девятого («путь без харнесса — путь без
известных предусловий») проверилась через час и оказалась с дефектом за ней: харнесс паритета работает на сайте с
программой, предусловие «годовой N задан» ни в одном журнале не записано — страж в форме сорок девятого этот случай не
поймал бы.

**1. Заявка координатора верна, и она сильнее границы.** Предусловие пути — это вход, который путь **читает и при
пустоте которого выходит без эффекта**. Значит его можно вывести не из того, что делает тест, а из того, что делает
продукт, — тем же ходом, что инвентарь подстановок (тридцать девятое, сорок четвёртое), только предмет другой: там
«непустой выход при пустом входе», здесь **«отсутствие эффекта при пустом входе»**. Устройство:
- **Вселенная действий** — из страницы, не из списка: всё, на чём висит обработчик клика/отправки на живой странице
  (обход DOM после загрузки), — кнопки, формы, переключатели.
- **Вселенная входов действия** — записью чтений во время прогона обработчика (селекторы DOM, ключи сторов, поля
  конфига — тот же приём записи достижений, двадцать пятое): что действие прочитало до первого эффекта или до выхода.
- **Прогон «все, кроме одного»** по каждому прочитанному входу: вход опустошён, действие вызвано, наблюдаются две
  вещи — **эффект** (запрос, запись в базу/стор, событие, изменение экрана, ожидание с таймаутом на асинхронное) и
  **разность экрана** (предикат сорок девятого: непуста, называет действие и причину). Три исхода на пару
  (действие, вход): эффект есть — вход не предусловие; эффекта нет и ответ есть — предусловие с ответом, в порядке;
  **эффекта нет и ответа нет — молчащая кнопка**, находка с именем входа. Так между «мы не знаем, что нужно пути» и «путь
  молча ничего не делает» расстояния не остаётся: второе получается из первого прогоном, без человека с зондом.
- **Харнессы — положительный контроль вывода, не источник:** предусловия из журналов харнессов (сорок девятое) обязаны
  оказаться среди выведенных для тех же действий; предусловие журнала, которого вывод не нашёл, — вывод неполон (вход
  читается не в обработчике, а раньше — тогда запись чтений расширяется на путь до обработчика), не «случай особый».
  Сегодняшний случай — контроль наоборот: вывод обязан найти `annualN` у «Generate Nutrition Program» как вход без ответа,
  а харнесс его не знал; если вывод его не находит — вывод неверен.
**1а. Постановка координатора жёстче, и ответ на неё — три вывода, ни один не из харнессов.** Вопрос не «добавить
`required`», а **как вселенная предусловий получает пути, которых харнессы не проходят**: множество живых путей — само
перечень, собранный тем, что кто-то решил покрыть тестом, и за его краем оказался путь каждого нового клиента — первая
программа на сайте, где её нет. Вселенная предусловий, выведенная из журналов, унаследовала болезнь перечня. Поэтому у
стража три выводимых стороны, и журналы харнессов ни одна из них не использует как источник:
- **действия** — из живой страницы (обход DOM: всё с обработчиком), не из того, что тесты кликают;
- **входы действия** — из чтений продукта во время обработчика (заявка координатора; верна — это и есть «что продукт
  читает перед тем, как отказаться»), не из того, что тесты заполняют;
- **состояния**, в которых действия прогоняются, — из модели записей, не из фикстур тестов: по видам записей владения
  (строка сайта, конфиг, пробы каждого вида, сохранённая программа) строятся состояния «каждая запись отсутствует по одной»
  и «отсутствуют все, кроме строки сайта» — последнее и есть **новый сайт**, состояние первого клиента, и оно попадает в
  набор **по построению**, а не потому, что кто-то вспомнил про новичка. Сегодняшний дефект — пара («Generate», `annualN`)
  в состоянии «программы нет»: в состоянии «программа есть» поле заполняется из неё и вход не пуст; значит одного
  опустошения входов мало, нужны состояния, и они выведены.
Журналы харнессов остаются **положительным контролем**: их предусловия и их состояния обязаны найтись среди выведенных.
Граница после этого — только п. 2 ниже; «за ней нужен человек с зондом» верно для сочетаний входов и для отказов после
эффекта, не для путей новых клиентов.
**1б. Цена до работы и порядок — требование координатора (второго названного и не взятого пункта, как кэш нормалей,
не заводим).** Цена — произведение трёх чисел: действия × входы × состояния; сегодня известно ни одно. Что могу дать без
устройства — верхняя граница по **форме** (grep по разметке, обработчики из JS не считаны): `plan.blade.php` — 3 кнопки,
`app/resources/views/reports/export.blade.php` — 7 кнопок + 4 `onclick` (из семи действий с эффектом по смыслу не больше четырёх: остальное — переключатели интерфейса), `settings.blade.php` — 36 кнопок + 3 submit, `data.blade.php` — 33
кнопки. Это не число действий: обработчики вешаются и из JS (`nutrition-calendar.js`, `plan-ui.js` — по одному
`addEventListener('click')` каждый по дыму), и не все кнопки — действия с эффектом. **Дешёвый замер двух чисел — один
живой тест на страницу, без устройства:** (1) число действий — через CDP `DOMDebugger.getEventListeners` по всем
элементам страницы после загрузки (считаются реальные обработчики `click`/`submit`, не разметка); (2) входы самого
сложного действия — обёртки на `document.querySelector*`, `getElementById`, геттеры `GAIP_SiteConfig`/`GAIP_SampleManager`,
`localStorage.getItem` с множеством прочитанных ключей за окно клика (синхронно + микрозадачи + ожидание первого
эффекта) в состоянии «новый сайт»; один клик по каждому действию, максимум различных чтений — второе число. Стоимость
замера — один файл e2e, один прогон на страницу; результат — два числа на страницу и оценка произведения.
**Порядок — что делается первым, и чем это оценивается до постройки.** Признак: **какая координата различала три
найденных руками случая.** Кнопка на сайте без проб — действие Generate, вход «выбранная проба», состояние «проб нет»;
кнопка при пустом годовом N — то же действие, вход `annualN`, состояние «программы нет»; раздел, пропадающий у второй
пробы, — не действие, состояние «отчёт не первый». Во всех трёх пустой вход был **следствием состояния**, а не
самостоятельным событием; действие в двух из трёх одно и то же. Значит находки на единицу работы даёт **сторона
состояний**: одно и то же малое множество действий, прогнанное по выведенным состояниям, даёт входы пустыми сами, без
опустошения по одному. Порядок: (1) состояния из модели записей × действия, которые уже кликают харнессы (перечень,
но короткий и с положительным контролем) — на сегодняшних данных нашло бы 3 из 3; (2) действия из обхода DOM на
состоянии «новый сайт» — 2 из 3; (3) опустошение входов по одному — 1 из 3 и только вместе с состояниями. Оценка до
постройки — этот ретроспективный счёт по найденному руками; после первого прогона (1) — число находок за прогон, и им
проверяется, что порядок был верным. Треть работы — п. (1); ожидаемые две трети пользы — по признаку, не по вере, и
первый прогон это либо подтвердит числом, либо опровергнет.
**Условие приёмки (координатор, оба исхода названы до замера):** счёт 3 из 3 — ретроспективный, по случаям, найденным руками; если находок на первом прогоне окажется мало, это не «устройство плохое», а смещение счёта тем, что искали руками, — смещение называется, не списывается.
**2. Граница, которая остаётся, — уже, и названа.** (а) Вход, который читается только в ветке, недостижимой при
пустых остальных, — виден только при порядке опустошения, дающем ту ветку; «все, кроме одного» покрывает одиночные
предусловия, сочетания — нет (число сочетаний — в границу, не в покрытие). (б) Отказ после эффекта (запрос ушёл, сервер
отказал молча) — на стороне ответа сервера, свой прогон с подменой ответа. (в) Действия, не достижимые со страницы,
в вселенную не входят — и это верно: их нет у клиента. Строка «путь без известных предусловий» сужается до «действие,
которое прогон не смог вызвать», и таких тоже считают.
**3. Дефект дня — как он выглядит в этом устройстве и что чинить.** Пара («Generate Nutrition Program», `annualN`): эффекта
нет, ответа нет → молчащая кнопка. `required` в разметке — форма, не ответ (двадцать девятое о форме и поведении): при
`required` браузер покажет подсказку, но предикат сорок девятого требует названного действия и причины — «Programme
not generated: annual N target is not set». Чинится ответ, а не только атрибут; и вторая половина: почему поле пусто —
у сайта без сохранённой программы годовой N не откуда взять, кроме ввода, и это законно; страж подстановок здесь
следит, чтобы пустота не заполнилась умолчанием по виду (лестница `species-default`, сорок пятое).
**Состояние работы, не дефект:** `meta.sampleId` в свежесозданном плане отсутствует (Russley, Test5); есть `inputSources`
с тремя полями «из пробы» без id пробы — правка по 10.8(27) ещё не сделана. **Не проверено мной:** что запись чтений
обработчика ловит чтения через замыкания, сделанные до клика (граница (а) в другой форме); число действий на живых
страницах — даст первый обход.

**Пятьдесят первое уточнение, 17.09.2026 — клеймо источника ставится по наличию поля в объекте вызывателя, а не по
существованию источника; в сохранённом плане Canberra клеймо лжёт.** Замеры приняты: вчера — расхождение клейм между
двумя разрешениями входов (`site-config` против `sample` при равных значениях, безвредно, потребители сравнивают только с
`'species-default'`/`'default'`); сегодня — `meta.inputSources = {species: 'sample', methodology: 'sample', surfaceType:
'sample'}` в сохранённом плане Canberra, у которой **нет ни одной пробы**; числа верные (из конфига сайта), клеймо ложное.
Заявка о механизме подтверждена по коду: `sources.species = sample.species ? 'sample' : …` (`nutrition-program-inputs.js:
801`), `sources.methodology = sample.methodology ? 'sample' : …` (`:809`), `sources.surfaceType` так же (`:795-796`).
**Кто передаёт объект на Plan-странице — установила:** `nutrition-calendar.js:1060-1070` строит `sample: {species:
rawSpecies, methodology, CEC, pH, soilTexture}`, где `rawSpecies` — из **состояния страницы** (`:818-828`:
`state.turf.effectiveSpecies` → `grassSpecies` → `GAIP_CANONICAL_STATE` → DOM `.gaip-grass-species`), а `methodology =
(soil.methodology || 'mlsn')` (`:987`) — из состояния плюс **умолчание `'mlsn'`** (подстановка, в инвентарь с ценой). То есть
Plan объявляет значения сайта и страницы «пробой»; экспорт (до сорок пятого) — свои разрешённые по id значения «пробой».
Аргумент `sample` — **канал объявления происхождения вызывателем**, ровно тот, который GH-471 убрал внутри резольвера
(`take(field, value, 'site-config')`) и оставил снаружи.

**1. Чем отметка источника отличается от наличия поля — и как она получает источник.** Источник — не свойство значения,
а свойство **чтения**: откуда и по какому ключу значение прочитано (GH-471: «источник выводится из чтения, никогда не
пишется рядом»). Наличие поля в объекте, который принёс вызыватель, о чтении не говорит ничего — вызыватель мог взять
значение где угодно. Поэтому резольвер **не принимает значений**, только адреса: `soilSampleId` (и других видов) — и читает
запись пробы **сам**, из стора по id, через `readerFor(field, 'sample', sampleId, record)` с `recordKey`, как уже делается
для строки сайта и конфига; `'sample'` ставится только тогда, когда запись с этим id существует и несёт поле. Законный
второй канал — **форма Plan-страницы**: значение, которое пользователь ввёл или выбрал на странице, — источник
`'plan-form'` (так уже устроен годовой N: `planForm.annualN` → `'plan'`); вид или методология, выбранные на Plan, идут этим
каналом с этим клеймом, а не «пробой». Что Plan сегодня передаёт как «пробу» из `state.turf`/DOM — это отрисованный конфиг
сайта: резольвер читает его сам по id (отметка инжекта, двадцать девятое п. 1) и ставит `'site-config'`. Аргумент
`opts.sample` **удаляется из API**.
**2. Что ставится, когда поле есть, а источника нет.** Ничего — такого состояния после п. 1 не бывает по построению:
значение входит только через запись по id или форму, и у каждого входа источник есть до того, как появилось значение.
Если старый вызыватель всё же передаёт `opts.sample.x`, резольвер **бросает** (как `_requiredSiteId` при пустом
`siteId`): «anonymous value for species — pass a sample id or a form». Клеймо вида `'caller-declared'` отвергнуто нарочно:
оно сохранилось бы в план и стало бы третьим утверждением о происхождении рядом с `sampleId` и `inputSources`.
Сохранённое `meta.inputSources` пишется **только из `sources` резольвера**, никогда из объекта вызывателя.
**3. Чем проверяется — три стороны, положительный контроль готов (Canberra).**
- Песочница: сайт с видом и методологией в конфиге и **нулём проб** (форма Canberra) → `sources.species` и
  `sources.methodology` равны `'site-config'`, в теле сохранения плана нет ни одного `'sample'`; сайт с пробой по id, у
  которой есть поле, → `'sample'` с `recordKey`; форма Plan с выбранным видом → `'plan-form'`. Мутация ревьюера: вернуть
  `sample.species ? 'sample'` → Canberra-фикстура красная.
- Инвариант сохранённых планов, живьём по 13 сайтам: каждое `'sample'` в `meta.inputSources` обязано иметь рядом
  `meta.sampleId` и запись пробы с этим id, несущую поле; сегодня нарушений ≥ 1 (Canberra), и это число — положительный
  контроль. Планы без `sampleId` (все старые) читаются как **непривязанные независимо от `inputSources`** — их клейма не
  доверяются, по 10.8(27) их перегенерируют; после перегенерации нарушений обязано быть 0.
- Инвентарь подстановок (тридцать девятое, сорок четвёртое): клеймо происхождения — тоже выход, и тело сохранения плана
  — сток инвентаря (`PATCH`); прогон с пустыми пробами обязан дать в теле ноль клейм `'sample'` — ложное клеймо есть
  подстановка происхождения и попадает в инвентарь с ценой (сколько сохранённых планов несут `'sample'` без пробы).
Связь с сорок пятым: вчерашнее расхождение двух разрешений — тот же механизм (экспорт объявлял свои значения «пробой»);
с одним разрешением по id оно исчезает само.
**Цена в числах — замер координатора по базе (`site_configs`, `config.nutritionCalendarProgram.meta.inputSources`, 17.09).**
Сохранённых планов 10; клеймо `'sample'` у species и methodology — **в 10 из 10**; `'site-config'` в сохранённых планах не
встречается ни разу. Проверяемо ложных **2** — Test1 - Sports и Test6 - UK (проб любого вида ноль); **8** непроверяемы в обе
стороны (пробы есть: Burns 29, New test - location 18, Test5 - NZ 2, остальные по одной; `sampleId` нет — из какой пробы
якобы поле, сказать нельзя). Следствия для устройства: п. 1 меняет не редкий случай, а **поведение по умолчанию** — клеймо
всегда говорит одно и то же; положительный контроль — минимум 2 доказуемых нарушения, не «≥ 1», а после перегенерации с
`sampleId` восемь станут проверяемыми и покажут, сколько из них тоже ложны; цена правки — перегенерация меняет клеймо у
всех десяти планов, числа не меняются, меняется только отметка происхождения, и она становится верной. Число «ложных
среди восьми» — результат следующего замера после перегенерации, не оценка.
**Не проверено:** есть ли на Plan-странице пользовательский выбор вида/методологии (если DOM `.gaip-grass-species` — только
легаси-разметка, канал `'plan-form'` для вида не нужен) — нужен живой прогон интерфейса, координатор не мерила.

**Пятьдесят второе уточнение, 17.09.2026 — граница последнего отчёта без новой видимой строки; ткань — решение
владельца; NZ и AA — сужение выбора, не умолчание.**

**1. Маркер конца отчёта: заявка координатора годится, и довод верен.** Владелец спрашивает, зачем в клиентском документе
технический маркер. Ответ: он не нужен, если у общезаводского хвоста есть **собственный заголовок, который цикл печатает
безусловно** при выходе из отчётов — «Facility summary» (формулировка — владельцу) над Annual Nutrient Requirements,
Fertiliser Purchasing Summary, References & Methodology, Glossary of Terms. Чем это отличается от отвергнутой
«непохожести»: непохожесть утверждала **отсутствие** признаков отчёта в хвосте над перечисленной вселенной признаков
(таблицы Site Information нет, шапки `Month | GP%` нет) — и молчала о признаке, которого в перечне не было. Заголовок хвоста
— утверждение о **наличии** границы, объявленной продуктом: срез последнего отчёта кончается на первом блоке, который
продукт сам назвал началом другого раздела, а не на том, что «дальше не похоже». Три условия, чтобы заголовок был
границей, а не ещё одной непохожестью: (а) печатается **безусловно** кодом выхода из цикла, в каждом комбинированном
документе, включая «Report 1 of 1», — не выводится из содержимого хвоста; (б) узнаваем в `document.xml` по фиксированному
тексту и стилю (заголовок первого уровня, тот же способ, что у «Report n of N»); (в) **страж утверждает его наличие ровно
один раз** — отсутствие заголовка красное, а не «срез до конца тела»; срез до конца тела запрещён как режим. Переименование
или перенос заголовка краснит страж — это положительный контроль, не хрупкость. Клиенту заголовок над общезаводскими
разделами полезен по смыслу; технического маркера «End of report» не нужно, вопрос владельцу о нём снимается, L7
закрывается этим. Что не меняется: единица чтения (отчёт), идентичность по шапке, показания против payload (сорок третье).
**Развилка по замеру координатора (условие (а) сегодня не выполнено):** первый заголовок хвоста «Annual Nutrient
Requirements» стоит внутри `if (anrReports.length > 0)` (`assets/word-export-combined.js:3633`, заголовок `:3641-3642`,
разрыв страницы тоже под условием); References & Methodology и Glossary приходят из хвоста первого отчёта
(`trailingSections`, `:3448-3450`) и добавляются под условием `if (trailingSections)` (`:5375-5377`). Безусловного вывода
на выходе из цикла в построителе нет — проверено по коду. **Решение — развилка 2:** собственный заголовок хвоста над всем
общезаводским блоком, печатаемый кодом выхода из цикла **до** любого условного содержимого (до `anrReports`, до
`trailingSections`), в каждом комбинированном документе. Не развилка 1 (сделать безусловным заголовок ANR): он именует
таблицу, которой при пустом `anrReports` нет, — заголовок над пустотой; и не развилка 3 (измерить, бывает ли `anrReports`
пуст): граница, зависящая от того, что данных «обычно хватает», — это непохожесть в другой одежде. Заголовок именует
раздел, который в документе уже есть и начинается без имени; при пустом `anrReports` под ним остаются References и
Glossary (их безусловность в одиночном экспорте — замер, не читала). Имя раздела — владельцу («Facility summary»/
«Site-wide sections»/«Appendices» — черновики). Положительный контроль (в) дополняется фикстурой с пустым `anrReports`
(проба без почвенных показаний): заголовок есть и там, ровно один.
**Один заголовок или два — два, и границей служит первый.** Хвост разнороден: Annual Nutrient Requirements и Fertiliser
Purchasing Summary — **сводка по всем пробам документа**; References & Methodology и Glossary of Terms — **справочный
материал**, к сводке не относящийся. Один заголовок над обоими вынужден называть и то и другое («totals & reference») —
это утверждение о разделе, которого как единого нет, тот же класс, что заголовок над пустым ANR. Два заголовка: первый —
над сводкой, печатается **безусловно** на выходе из цикла и есть граница последнего отчёта (условие (а) — только ему);
второй — над справочным блоком, может оставаться под условием `trailingSections`, к границе отношения не имеет. Если сводка
пуста (нет `anrReports` и нет закупок), под первым заголовком стоит одна строка «No combined totals: no soil samples with
readings in this document» — по двадцать восьмому, отсутствие с причиной, а не пустота; так заголовок никогда не
именует ничего. Варианты текста первого заголовка (владельцу, устройство к ней не идёт): «Summary Across Samples»;
«Combined Totals for This Document»; «All Samples — Totals». Второго: «References & Glossary»; «Reference Material». Отвергнуто:
«Facility Summary» (facility — не термин интерфейса, у клиента «site»); «Combined Totals & Reference» (два предмета под одним
именем).
**Выбор координатора — «Summary Across Samples» и «References & Glossary» — проверен тремя правилами (17.09).**
1. *Не именует пустоту* — проходит с одним условием: при пустых итогах под заголовком стоит строка об отсутствии, и
   раздел существует и говорит почему — это та же форма, что «All site data present» в реестре. Условие: **причина в строке
   берётся из карты исходов, не пишется текстом.** «No soil samples with readings in this document» — верно, только если
   итогов нет именно поэтому; если показания есть, а требования не посчитаны (нет вида, нет региона), фиксированная строка
   солжёт. Строка = «No combined totals: <причина из исхода>» — иначе заголовок обещает сводку, а под ним утверждение о
   причине, которой не измеряли.
2. *Термины совпадают с интерфейсом* — проходит: под первым заголовком «Annual Nutrient Requirements» и «<site>, Fertiliser
   Purchasing Summary» (слово Summary уже внутри); «samples» — слово пикера («Select samples», «samples to include»,
   `app/resources/views/reports/export.blade.php`). Под вторым — «References & Methodology» и «Glossary of Terms»: заголовок
   «References & Glossary» называет два из трёх слов, не противоречит, сужает мягко; допустимо, полная форма «References,
   Methodology & Glossary» — если владелец захочет точности.
3. *Множество при одной пробе* — проходит как соглашение интерфейса, не как утверждение о данных: пикер говорит «samples» и
   при одной пробе; «across» при одной пробе читается странно, но не ложно — множество из одного элемента существует, и
   под заголовком стоят его итоги. Если нужна точность вместо соглашения — число в заголовок из документа: «Summary Across
   3 Samples» / «Summary Across 1 Sample», страж якорится по префиксу «Summary Across». Это вариант, не требование.
Итог: оба заголовка идут в устройство как выбранные; единственное условие к реализации — п. 1 (причина из исхода).
**Закрыто окончательно (координатор, 17.09.2026; к владельцу не возвращаемся):** «Summary Across Samples» над итогами —
безусловный, он же граница последнего отчёта; «References & Glossary» над справочным блоком — короткая форма; строка под
пустой сводкой — «No combined totals: <причина из исхода>», причина из карты исходов, текстом не пишется; вариант с числом в
заголовке («Summary Across 1 Sample») **не берём** — вычисляемый текст ради редкого случая; полную форму «References,
Methodology & Glossary» владельцу не предлагаем — разница её решения не требует. L7 закрывается этим устройством.

**2. Ткань — решение владельца: не печатать.** Тканевые показания идут только под своей зоной; в отчёте про зону без своей
тканевой пробы раздела Tissue Analysis нет. Это устройство сорок третьего п. 1: `|| active[kind]` из резольвера уходит,
`tissueSampleId: null` от перечислителя — исход `empty / none-for-zone`, раздел опущен, в реестре пробы строка «no tissue
sample for this zone (N on file for the site)» — строка остаётся, потому что реестр печатает всё отсутствующее (решение по
двадцать восьмому), а решение владельца — о разделе, не о реестре. Контроль: отчёт Green 18 печатает 142, Green 13 и
Green 1 — без раздела, со строкой; мутация — вернуть `|| active[kind]`. Строится.

**3. Новозеландский сайт и AA — сужение выбора по координатам, другое устройство.** Слова владельца: при NZ-координатах в
настройках в списке методологий только AA; в мастере на шаге методологии только AA и выбран по умолчанию. Рассуждение
координатора проверено и верно с одной оговоркой: значение, выбранное из списка с единственным вариантом, — выбор
пользователя, **но выбором оно становится в момент сохранения**, а не в момент сужения списка; до сохранения значения нет.
Устройство:
- **Список методологий — функция региона, одна на все экраны:** `methodologyOptionsFor(region)`; регион — производный
  факт от координат владельца (двадцать третье: классификатор кончается `return null`); `new_zealand` → `['ammonium_acetate']`,
  прочие регионы → полный список, `null` → полный список **без предвыбора**. Мастер и Settings зовут одну функцию;
  предвыбор в мастере — первый (единственный) элемент, и он **сохраняется шагом мастера** — это и есть выбор пользователя.
- **Промежуток «список сужен, поле пусто»:** у нового NZ-сайта до шага мастера методологии нет — исход `empty` по двадцать
  восьмому: анализ и документ ничего по методологии не считают и не подставляют; заполняется шагом мастера. Никакой
  автозаписи AA «за пользователя» вне сохранения не происходит — иначе это умолчание под именем выбора.
- **Существующий NZ-сайт с сохранённым MLSN/SLAN** (сайт перенесён в NZ или настроен до правила): список показывает только
  AA, а сохранённое значение — не в списке. Продукт **не меняет** его молча (запись — намерение, не состояние): экран
  показывает сохранённое как недопустимое для региона с подсказкой «not available for New Zealand sites — save to switch
  to Ammonium Acetate»; значение в базе меняется только сохранением. Сервер (тридцатое) методологию по координатам не
  выводит и не переопределяет — читает сохранённое; серверный `isNewZealand → ammonium_acetate` уходит вместе с этим
  устройством, потому что сужение списка делает его ненужным по построению: у NZ-сайта, прошедшего мастер, другого
  значения быть не может.
- **Сайт без координат:** регион `null`, список не сужается, предвыбора нет, выбор — пользователя; правило о регионе по
  координатам (закрыто владельцем ранее) здесь ничего не подставляет, потому что подставлять нечего.
- **Проверка:** Russley/Test5 (NZ) — в Settings и в мастере один вариант, AA; сайт без координат — полный список, ничего
  не выбрано; NZ-сайт с сохранённым MLSN — экран показывает конфликт, база без изменений до сохранения (четыре точки);
  прогон мастера на новом NZ-сайте — сохранено `ammonium_acetate` шагом, не до него. Мутации: список из региона страницы
  вместо региона сайта по id (S9-сценарий: сайт перенесён, страница не перезагружена) → список неверный → красный;
  автозапись при сужении → база изменилась без сохранения → красный.
10.8(19) закрывается этим устройством.
**Не проверено мной:** где в мастере и в Settings строится список методологий сегодня (один источник или два — по
памяти `ammonium-acetate-methodology.js` правит видимость опций на `/hub`; для db-shell не читала); печатает ли построитель
что-либо безусловное на выходе из цикла уже сейчас, к чему заголовок можно привязать.

**Пятьдесят третье уточнение, 17.09.2026 — 10.8(16) и 10.8(21) закрыты владельцем; владелец методологии и текстуры;
ступень, которую никто не пишет; два умолчания на конце цепочки Re-run.** Решения: текстуру менять можно, «из настроек
сайта»; расхождение колонки и снимка клиенту не объясняется — владелец перегенерирует анализ по всем площадкам после
правок. Замер ревьюера принят (перепроверен координатором по базе): `sites.methodology_override` — 0 из 12;
`sites.soil_texture_override` — 4 из 12; `samples.methodology_snapshot` — `'mlsn'` у всех 60 живых проб; `SampleController.php:
479` штампует новую пробу как `methodology_override ?: account->methodology`; форма Settings отправляет
`name="methodology"` (`settings.blade.php:465`) в gaip-конфиг, не в колонку; четыре площадки настроены на одно, пробы
проштампованы другим (Federal Golf, test4 — slan; Test5, Russley — AA; пробы `'mlsn'`); клиентский путь Re-run читает
снимок с двумя умолчаниями на конце (`hub-persistence.js:1313-1314`: `methodology: _smMethodDom || _smSample.
methodologySnapshot || _smRaw.methodology || 'mlsn'`, `soilTexture: _smTexDom || _smSample.soilTextureSnapshot || 'loam'`).
Граница входа названа ревьюером: достижимость этого блока на сегодняшнем Re-run **не замерялась** — чтение исходника.

**1. Владелец — как решено в двадцать четвёртом и двадцать девятом, решение не меняется; «из настроек» ему не
противоречит.** «Из настроек сайта» — о том, **кто пишет** (экран Settings), а не о том, где лежит; хранилище за экраном —
наше устройство. Владелец методологии — `sites.methodology_override` → `accounts.methodology`; текстуры —
`sites.soil_texture_override` → `accounts.soil_texture`. Довод прежний и подтверждён замером: сервер читает колонки
(штамп `:479`, анализ), текстура уже колонка и GH-482 по ней сдан; перенести методологию в конфиг значило бы или учить сервер
читать JSON конфига, или держать два хранилища — второе как раз то, что измерено (0 из 12 в колонке, всё в конфиге,
штампы — по пустой колонке). Что делается, одним заданием (иначе между записью и чтением сайт живёт без методологии):
- **запись:** поле `methodology` формы Settings (`settings.blade.php:465`) направляется в `PATCH /api/sites/{id}` колонкой,
  из путей записи конфига ключ `turf.methodology` уходит (`clear`); то же для текстуры, если её поле формы идёт в конфиг —
  **не проверено**, писатель 4 из 12 не найден (двадцать четвёртое);
- **перенос:** однократно, командой семьи `sites:repair-config`: для сайта с пустой колонкой и непустым `turf.methodology`
  в конфиге значение копируется в колонку, ключ из конфига удаляется; отчёт «сайт, было в конфиге, стало в колонке» — 12
  строк; конфликт «оба непусты и различны» сегодня невозможен (колонка пуста у всех);
- **чтение:** клиент (GH-480 читает конфиг) → строка сайта по id (`fromSite('methodology')`), Plan — через отметку инжекта
  (двадцать девятое п. 1); сервер — как есть, колонка, но без `?: account->methodology` в штампе (п. 2) и без `?? 'mlsn'`
  (тридцатое);
- **приёмка:** методология каждого из 12 сайтов совпадает на Plan, в экспорте и в серверном анализе; сегодня расходятся 4.

**Образец уже есть на сервере — ссылаюсь, не вывожу заново:** для текстуры `SampleAnalysisController.php:92-95` читает
`resolveSoilTexture(site->soil_texture_override, account->soil_texture) ?? snapshot ?? 'sands'` — владелец первым, снимок
последним запасным, с комментарием «no reason to prefer a snapshot that can go stale over it». Это та форма, которую
проектирует пятьдесят третье; для методологии сервер и клиент строятся по ней же, с двумя правками к образцу: снимок из
цепочки уходит вовсе (10.8(17)), `?? 'sands'` — подстановка (тридцатое). Замер координатора (18.09): по текстуре
расходятся Russley (колонка `sand`, у шести проб `loam` и `sand` вперемешку) и Westview (колонка `clay_loam`, проба
`loam`); Canberra — колонка `loamy_sand`, проб нет; серверный расчёт у обеих идёт по колонке, пороги не уезжают. Где
расхождение влияет — клиентский Re-run (`hub-persistence.js:1313-1314`), закрывается пятьдесят пятым.
**2. Ступень, которую никто не читает по делу, — убирается, а не чинится.** (Поправка 18.09: писатель у неё есть —
`saveSampleRecord`, `SampleController.php:445-484`, из `store` и `sync`, и он перезаписывает снимки при повторном сохранении
той же пробы, в том числе восстановленной мягко удалённой; «никто не пишет» — снято.) `samples.methodology_snapshot` и
`soil_texture_snapshot`: для интерпретации не используются (10.8(17)), пишутся из пустой колонки с умолчанием аккаунта,
у всех проб одно значение — это не факт о пробе, а след умолчания в момент сохранения. Штамп при создании пробы (`:479-480`)
**перестаёт писаться**; читатели снимка — Re-run `hub-persistence.js:1313-1314` и всё, что найдёт поиск чтений
`methodologySnapshot`/`soilTextureSnapshot` — переезжают на владельца по id; колонки остаются как история до отдельной
миграции (удаление схемы — не в это задание). Довод владельца делает это безопасным: анализ по всем площадкам
перегенерируется после правок, старые штампы никого не кормят.

**3. Два умолчания на конце цепочки Re-run — владельцу с ценой, не снимаются молча (10.7).** `|| 'mlsn'` и `|| 'loam'`
(`hub-persistence.js:1313-1314`) — подстановки класса `?? 'sands'`; после п. 1 и 2 цепочка Re-run — «поле страницы →
владелец по id → умолчание», и первое звено (`_smMethodDom`, `_smTexDom` — чтения полей страницы) — тот же класс, что
закрыли GH-482 и GH-490 в экспорте, убирается тем же ходом (по id). Умолчания остаются записями инвентаря со статусом
`в оценке` до цены. **Цена требует замера достижимости первой** — граница ревьюера: (а) достижим ли блок `:1313` на
сегодняшнем Re-run (журнал действия Re-run, сорок девятое); (б) у скольких сайтов после переноса владелец пуст (колонка
и аккаунт) — столько раз сработает умолчание; (в) что меняется в результате Re-run при `'mlsn'`→пусто и `'loam'`→пусто
(пара прогонов на сайте с пустым владельцем). Три числа — и запись идёт владельцу как вопрос **10.8(28)**; без них не
идёт.

**Не проверено мной:** писатель `soil_texture_override` (4 из 12) — какой экран; достижимость `:1313` на Re-run;
поле текстуры формы Settings — в конфиг или в колонку; другие читатели `methodologySnapshot` кроме `:1313`.

**Пятьдесят четвёртое уточнение, 17.09.2026 — подстановка в расчёт, а не в печать: покрывается выведением, но другой
стороной; третий сток — результат расчёта.** Запись: `var gp = data.climate.growthPotential || 50;` (`assets/word-export.js:
9826` и `:9846`) перед валидацией годового N — и ноль, и отсутствие становятся пятьюдесятью; найдено разработчиком по
указанию ревьюера, не тронуто, цена не измерена, в пакете владельцу (раздел 30 документа открытых вопросов). Формулировка
координатора верна: подставленное число не печатается, оно уходит в вычисление, след виден только в результате.

**1. Покрывается ли выведением — да, но не сбором напечатанных значений, а зависимостью.** Приём тридцать девятого в
форме «собрать каждое непустое значение в документе при пустом входе» такую подстановку не найдёт: 50 в документе нет. Но
правило двадцать восьмого о производных — «производный факт наследует худший исход входов» — делает её видимой без
знания литерала: при `growthPotential = empty` всё, что от него зависит (валидированный N, масштабированная программа),
обязано быть `empty` — отсутствовать или быть помечено; напечатанное число с зависимостью от опустошённого входа —
подстановка **по определению, какой бы литерал ни стоял**. Сторона доказательства — не значение, а **происхождение**:
карта покрытия (тридцать четвёртое: напечатанное → путь модели → писатель, сорок седьмое) расширяется на один шаг —
**замыкание зависимостей**: у каждого напечатанного значения известно, от каких входов оно посчитано (поток данных через
писателя). Тогда прогон с пустым входом X утверждает: ни одно напечатанное значение из замыкания X не присутствует без
пометки. Это и есть третий сток — **результат расчёта**, и он покрыт не отдельным приёмом, а тем, что сток определяется
через зависимость, а не через равенство литералу.
**2. Дешёвая динамическая форма без карты зависимостей — дифференциальные прогоны.** Три прогона на вход: пустой,
часовой A, часовой B. Подстановка в расчёт проявляется как **нечувствительность к пустоте при чувствительности к
значению**: `out(empty) ≠ out(A) ≠ out(B)` и при этом `out(empty)` **равен `out(c)`** для какого-то постоянного `c` — то есть
пустота была заменена числом; литерал не нужно знать заранее, его выдаёт равенство (для GP — `out(empty) == out(50)`).
Это приём сорок седьмого (мутация предполагаемого источника), обращённый: там мутируют писателя и ждут изменения
выхода, здесь опустошают вход и ждут, что выход **исчезнет**, а не совпадёт с константой.
**3. Границы, названы.** (а) Подстановка, значение которой совпадает с законным результатом для этого входа, — по значению
неотличима, но и ничего не меняет у клиента; ловится только замыканием зависимостей (она всё равно печатает число,
зависящее от пустого входа). (б) Подстановка в расчёт, результат которого не доходит ни до одного стока (мёртвый) — вне
вселенной, и это верно: у клиента её нет. (в) Замыкание зависимостей строится потоком данных с той же глубиной, что
шестнадцатое (тела вызываемых раскрываются); зависимость через глобал или через состояние страницы в него не попадает
— это уже сторожимые классы (яд, пустой контекст). (г) Строка `:9826` — сразу два класса: подстановка (`undefined → 50`) и
ноль, отброшенный истинностью (`0 → 50`, тридцать второе п. 2); цена считается для обоих: сколько живых сайтов имеют
пустой GP и сколько — GP = 0 в момент валидации (второе после сорок шестого — ноль от «не посчитано» уйдёт, останется
только настоящий ноль зимой у C4).
**Вселенная стоков после этого — три:** документ, тела записи, результат расчёта (через замыкание зависимостей); четвёртый —
экран — по-прежнему отдельно.
**Три слепоты инвентаря за день — и покрывает ли их устройство (вопрос координатора).** Третья: `var effectiveSpecies =
data.turf.effectiveSpecies || data.turf.species || 'Couch';` (`assets/word-export.js:9825`) — форма знакомая, имя не
вычисляемое, в инвентаре ноль. Объяснение по коду сборщика, две независимые причины: (1) **вселенная имён** —
`subjectName` для обычного члена возвращает имя свойства (`tests/lib/substitution-inventory.js:48-51`), для `||`-цепочки — имя
левого операнда (`:53`) → `effectiveSpecies`; это **производное имя** (вид после подсева), в 28 именах фактов сайта его нет,
запись отфильтрована. Это вторая слепота в другом обличье — не вычисляемый ключ, а псевдоним/производное того же
факта; называю это прямо, новой она не является. (2) **вселенная стоков** — сборщик собирает записи только от стоков
печати и записи (`sinksOf`, `:164`, обход от стоков `:283`); значение `:9825` идёт в валидацию, то есть в третий сток
(расчёт), которого у сборщика нет — граница пятьдесят четвёртого, п. 1. Каждой причины достаточно, чтобы запись не
попала. Итог по трём: первая (форма) и вторая с третьей (имена; и стоки) — все три покрываются устройством «инвентарь от
пустого прогона» в его нынешней записи: вселенная входов — из карты происхождения прогона (`species` там есть как ключ,
под каким бы именем код ни держал производное — сорок четвёртое), сток — через замыкание зависимостей и дифференциальные
прогоны (пятьдесят четвёртое). **Что утверждается, а не предполагается:** для `:9825` дифференциальный прогон по входу
`species` (пустой, часовой A, часовой B) обязан показать либо `out(empty) == out('Couch') ≠ out(A)` — подстановка
найдена без знания литерала, либо `out(empty) == out(A) == out(B)` — вид на валидацию в этой ветке не влияет, и запись
имеет цену 0 в этом стоке (тогда она ищется в других стоках, куда `effectiveSpecies` доходит). Что из двух — результат
прогона; предположение «вид влияет на валидацию» до прогона не принимается за факт. Дифференциальные прогоны —
основная форма по решению координатора: константу искать больше не надо.

**Пятьдесят пятое уточнение, 17.09.2026 — класс GH-459 в пути расчёта (Re-run): источник и момент вместе; 10.8(28)
закрыт ценой ноль; поправка к «третьей слепоте».** Замеры разработчика приняты: блок `assets/hub-persistence.js:1288-1320`
на Re-run достижим (два исполнения за прогон на площадках с пробами, ноль на Canberra — гейт по пробам); значения
**всегда** приходят с первого звена — полей страницы `.gaip-soil-methodology` и `.gaip-soil-texture`, оба непустые в момент
чтения, звенья 2–4 (снимок, сырое, умолчание) не достигаются никогда; поле расходится с пробой (Russley 105: в базе
`mlsn`/`loam`, блок получил `ammonium_acetate`/`sand`; Test5 141: `mlsn`/`sand` → `ammonium_acetate`/`sand`); значение поля
**меняется за время жизни страницы** (`slan → ammonium_acetate` на Russley и Test5, `slan → mlsn` на Canberra), блок берёт то,
что стоит в момент запуска. Чем заполняется поле значением AA при пробе `mlsn` — разработчик не мерил («следующий вопрос»).

**1. Чем факт получает владельца здесь — тем же, чем везде: владелец по id, читаемый в момент прогона, и ничем со
страницы.** Методология и текстура — настройки сайта (10.8(17), пятьдесят третье): `sites.methodology_override` →
`accounts.methodology`, `sites.soil_texture_override` → `accounts.soil_texture`. В пути Re-run они читаются **резольвером по
id сайта прогона** (`fromSite`), а id — из записи в руках, не из указателя: Re-run идёт в iframe, и сайт ему задаёт
родитель — отметка инжекта (`GAIP_SITE_ROW`/`GAIP_SITE_CONFIG_SITE_ID`, двадцать девятое п. 1), не `GAIP_SiteContext.getSiteId()`
(`hub-persistence.js:916-918` — указатель). Исход по двадцать восьмому: владелец пуст → `empty`, в кэш пишется отсутствие с
исходом, не значение.
**2. Что происходит с чтением, которое сегодня побеждает, — удаляется, не понижается**, вместе со всей цепочкой: звено 1
(поля страницы) — класс GH-482/490 в другом пути; звено 2 (снимок) — снято пятьдесят третьим (снимок перестаёт писаться и
читаться); звено 3 (сырое значение пробы) — проба не владелец методологии; звено 4 (`'mlsn'`/`'loam'`) — цена ноль
измерена, снимается **вместе с цепочкой** как её часть, в пакет владельцу записью с ценой 0 (10.7: не молча). Цепочки не
остаётся — одно звено, владелец. Отдельно: **кэш анализа не должен нести методологию и текстуру вовсе** — сервер после
тридцатого читает владельца, а не `computed.soilNutrition.methodology`; ключ из тела кэша уходит (тридцатое, «третье
место»); если движку на клиенте нужна методология для расчёта — он получает её от резольвера по id, а не пишет её на
сервер как состояние.
**3. Ось момента.** Поле страницы меняется за время жизни (`slan → ammonium_acetate`): любое чтение DOM здесь — гонка, и
удаление чтения снимает гонку, а не смещает её. Что пишет в поле AA при пробе `mlsn` — по коду вероятный писатель
`assets/ammonium-acetate-methodology.js:518-530` (`gaip:site-changed` → через 300 мс `updateMethodologyVisibility`, автовыбор AA
для NZ при методологии «по умолчанию»; Russley и Test5 — NZ, Canberra — нет: картина совпадает), **не измерено** —
замер: журнал записей в `.gaip-soil-methodology` за жизнь страницы (кто, когда, что). Пятьдесят второе (сужение списка
вместо автозаписи) убирает этого писателя; до него он существует, и это ещё одна причина не читать поле.
**4. Проверка.** Песочница: строка сайта X (методология M1, текстура T1), поле страницы M2/T2, снимок пробы M3/T3 —
результат прогона и тело кэша несут M1/T1 и только их; после загрузки поле переписывается (имитация автовыбора) — результат
не меняется (момент); мутации ревьюера: вернуть чтение `.gaip-soil-methodology` → M2 → красный; подставить `'mlsn'` при
пустом владельце → значение вместо исхода → красный. Живьём, парой: Re-run на Russley до и после — тело кэша с
`methodology` сегодня (AA из поля) против тела без ключа и результата по владельцу (после переноса пятьдесят третьего —
AA из колонки; число совпадёт, источник — нет, и это видно только по отметке). Отметка происхождения в результате
прогона — `{siteId, methodology, texture, source, readAt}` из чтений резольвера (пятьдесят первое): чем прогон считал,
читается потом, не восстанавливается.

**10.8(28) закрыт ценой ноль** — умолчания `'mlsn'` и `'loam'` недостижимы (ни один путь), строка валидации `:9825-9826` не
исполняется вовсе (0 из 9 отчётов, ключа `fertility` в `GAIP_STATE` на `/reports/export` нет). Оговорка разработчика
сохраняется дословно: «Это не значит, что дефекта нет: код на `:9826` написан так, что подставит 50 на зимнем нуле C4,
если ветка когда-нибудь оживёт. Сегодня цена нулевая». «Сегодня не срабатывает» ≠ «дефекта нет»; записи в инвентаре
остаются со статусом «в оценке, цена 0».
**Поправка к «третьей слепоте» (пятьдесят четвёртое):** `|| 'Couch'` (`:9825`) — ветка недостижима: `effectiveSpecies`
присваивается безусловно в трёх ветках выше, последняя даёт `'Not specified'`; записи в инвентаре не было **не из-за
сборщика**. Правило координатора, принято: **отсутствие записи в инвентаре — утверждение о сборщике, а не о коде, пока не
проверена достижимость** (как «не наблюдалось» — утверждение о зонде). Две причины из пятьдесят четвёртого (имя,
сток) остаются верными как свойства сборщика, но к этой строке они не относятся; третий сток как ось — остаётся. И
замечено наравне с дефектами: та ветка печатает `'Not specified'` вместо выдуманного вида — продукт там уже ведёт себя
так, как требуется везде.

**Пятьдесят шестое уточнение, 17.09.2026 — второй экземпляр «таймера под именем события»; прогон класса по дереву:
сейчас, разово, статически.** Второй случай: `assets/ammonium-acetate-methodology.js:518-520` — подписка на
`gaip:site-changed` → `setTimeout(updateMethodologyVisibility, 300)`, комментарий «Delay lets sample-persistence and
site-config-persistence finish restoring the new site's config first» — тот же класс, та же цифра, тот же довод, что у
`word-export-combined.js:694` (сорок шестое); по коду, поведением не мерено. Найден замером, который мерил другое, — значит
после первого случая класс по дереву не прогоняли. Решение: **прогнать сейчас**, потому что (а) статический прогон не
трогает стенд — ревьюеру он не мешает, а разработчик стоит; (б) формулировка класса и два подтверждённых случая уже есть;
(в) третий случай через неделю в чужом замере дороже прогона по признаку.
- **Чем прогонять — разовым замером, не стражем.** Страж сорок шестого («отправитель `site-config-applied` недостижим из
  обратного вызова таймера») сторожит одно событие; класс шире — **обработчик события ждёт временем, а затем читает
  состояние, которое приходит другим событием**. Страж на класс строится после того, как известна вселенная и базовая
  цифра храповика; разовый прогон их даёт. Форма замера — статический, по AST (шестнадцатое): для каждой подписки на
  `gaip:*` — есть ли в обработчике `setTimeout`/`setInterval`, и **что читает** обратный вызов (DOM-селекторы, геттеры сторов,
  глобалы); для каждого чтения — существует ли событие готовности этого источника (`gaip:site-config-applied`,
  `gaip:weather-ready`, `gaip:monthly-normals-ready`, `gaip:analysis-complete`). Три колонки на строку: событие и задержка;
  что читает; событие готовности есть/нет. Выход — сначала два числа: сколько обратных вызовов читают состояние,
  приходящее событием, и у скольких из них событие готовности уже существует; перечень — по запросу (правило подачи).
  Задержка перерисовки, которая ничего не читает, — не класс, из перечня выпадает.
- **Дым по форме (мой grep, не замер):** обработчиков `gaip:*` с `setTimeout` в шести строках после подписки — 65 в `assets`;
  после `gaip:site-changed` — 9 (`ammonium-acetate-methodology.js:520` 300 мс; `card-layout-redesign.js:868, 872` 600/800;
  `daily-dashboard.js:2052`; `gaip-evidence-ui.js:553` 400; `gaip-morning-briefing.js:792` 400; `site-settings-multi-site-turf-
  toggle.js:90`; `site-profile-bridge.js:432`; `sensor-api-bridge.js:304`). 65 — верхняя граница формы, не число случаев
  класса: сколько из них читают состояние — даст прогон.
- **Что с найденными:** по правилу из памяти проекта (записано координатором): снятый источник закрывает ось момента
  целиком — сначала проверяется, можно ли снять чтение (как в пятьдесят пятом), и только если нельзя — ожидание события
  с тремя признаками факта (сорок шестое). Второй экземпляр закрывается пятьдесят вторым (сужение списка вместо
  автозаписи — источник снимается). Порядок: замер — сразу, разработчиком, пока стоит; правки — по списку с ценой, после
  очереди.

**Пятьдесят седьмое уточнение, 17.09.2026 — суждение из пустоты: лесенка с безусловной последней ветвью; фикстура под
утверждение вместо формы продюсера.** Замер ревьюера принят (доведён до документа): `calcMixedGrowthPotential` охраняет
`weighted`, но в том же объекте `status` собран лесенкой (`assets/hub-tissue-v3.js:2140-2149`: `a >= 80 ? … : a >= 20 ? … :
"Minimal/dormant - temperature limiting"`); при `a === null` все сравнения ложны и работает последняя ветвь;
`word-export.js:8529` копирует `cm.growth.status`, `:12474` печатает с цветом; в документе «Growth Potential» отсутствует
(правка работает), «Status Minimal/dormant - temperature limiting» печатается. Формулировка координатора верна: класс тот
же, предмет другой — мы закрывали числа из пустоты и не спросили, что ещё из той же пустоты выходит.

**1. Признак класса — синтаксический, и по нему места выводятся, не перечисляются.** Лесенка `x >= a ? A : x >= b ? B : C`
(и её формы: цепочка `if/else if/else`, `switch` с `default`, `||`-цепочка текстов) с **последней ветвью без условия**: при
`x = null`/`NaN`/`undefined` все сравнения ложны, и последняя ветвь достигается **всегда** — это не «редко ошибается», это
«о пустоте всегда говорит одно и то же». Вселенная — статически, по AST (та же машинерия, что у сборщика инвентаря и
шестнадцатого): все цепочки условных выражений/операторов, у которых (а) тесты — сравнения одного субъекта, (б) последняя
ветвь безусловна и даёт **непустое** значение (текст, число, булево), (в) субъект по карте происхождения может быть
пустым (зависит от входа с исходом `empty`/`unavailable` — двадцать восьмое). Это то же правило, что у классификаторов
региона (двадцать третье: «классификаторы кончаются `return null`»), распространённое на все лесенки: **первая ветвь
любой лесенки — `x == null → null`**, последняя ветвь тогда достижима только значением. Текстовые суждения — статусы,
подписи, вердикты, рекомендации — все выходы таких лесенок; их вселенная — их выход, найденный обходом, не список.
**2. Чем это отличается от чисел в дифференциальных прогонах.** Для чисел `out(empty)` равен константе, и равенство
выдаёт литерал; для суждений `out(empty)` равен **последней ветви**, и по значению её не отличить от законного «действительно
минимальный». Отличается так: **различать и не нужно.** По правилу производных (двадцать восьмое, пятьдесят четвёртое)
при пустом входе никакого суждения быть не может — «действительно минимальный» требует значения. Значит утверждение одно и
то же для чисел и для текстов: **при опустошённом входе ничего из замыкания его зависимостей не печатается** —
присутствие суждения красное само по себе, какая бы ветвь его ни дала. Дифференциальные прогоны для текстов нужны не для
обнаружения, а для **имени ветви**: `out(empty) == out(x_min) ≠ out(x_max)` называет, какая ветвь принимает пустоту, —
это сообщение об исправлении, не признак дефекта. Так класс «число из пустоты» и «суждение из пустоты» — один класс с
одним стражем (замыкание зависимостей), и второй не требует своего устройства.
**3. Диагноз нашего стража — ось входа, фикстура под утверждение.** GH-510 подал `growth: { c3: null, c4: null, weighted:
null }` без `status` — форму, которой продюсер не издаёт; фикстура собрана из того, что нужно утверждению. Правило,
которое уже есть для сторов (форма снимается с живого, заглушка строится из снятого, равенство в обе стороны),
распространяется на **результаты**: фикстура результата — это **выход настоящего продюсера на отравленном/пустом входе**
(`calcMixedGrowthPotential(null-входы)` вызывается, его объект и есть фикстура), а не объект, набранный в тесте. Тогда
`status` в фикстуре присутствует по построению, и страж его видит. Положительный контроль: фикстура, снятая с продюсера,
обязана содержать все ключи, которые продюсер издаёт (сверка ключей с объявленной формой в обе стороны); ключ, которого
в фикстуре нет, а продюсер издаёт, — красный. Правка статуса — первой, как решено; страж переписывается на фикстуру от
продюсера в той же сдаче, иначе следующий ключ объекта пройдёт так же.
**3а. Подстановка перед лесенкой (`hub-tissue-v3.js:5300-5306`, `H.weighted ?? 50` на входе) — вопрос координатора.** Правило
«первая ветвь `x == null → null`» её не ловит по построению — до первой ветви значение уже не `null`; признак «субъект
может быть пустым» тоже не срабатывает. Ответ на две части:
- **Дифференциальный прогон её видит** — и не по форме, а по правилу производных: напечатанный статус зависит от
  `weighted`, который был пуст; при опустошённом входе ничего из замыкания не печатается, присутствие статуса красное;
  равенство `out(null) == out(50) ≠ out(A)` называет константу. Прогон — сторона доказательства, и она форм не различает.
- **Статический признак нужен тоже, и он не отдельный, а составной:** лесенка = **`null`-ветвь первой + субъект без
  подстановки**: выражение субъекта лесенки не содержит `||`/`??`/тернария с непустым литералом — это тот же сборщик
  инвентаря (форма `??` ему известна), применённый к субъекту лесенки, а не к стоку. Заявка координатора «вход лесенки не
  может быть подставлен» — верна, и это ровно вторая половина составного правила.
- **Что весомее — разное, и потому оба:** у прогона условие достижимости стока — он молчит там, где сток сегодня не
  достигается, и это молчание равно «цена 0», а не «дефекта нет» (оговорка разработчика о `:9826`); статический признак
  достижимости не требует и называет места с ценой 0, которые оживут при смене достижимости, — записи «в оценке, цена 0»
  по 10.7. Прогон — доказательство эффекта у клиента, признак — храповик без условия. Ни один не заменяет другой.
**4. Раздел 31 (`gh490:131`, счётчик подстроки `getActiveSample('soil')` = 1)** — утверждение по форме, та форма, которую в
тот же день запретили для исключений; переписывается по значению: запись достижений (двадцать пятое) — за экспорт
`GAIP_SampleManager.getActiveSample` не достигнут ни разу, показания пришли по id (`provenance.soilSample.recordKey`
равен id из `inputs`); мутация ревьюера, обошедшая счётчик, — положительный контроль нового утверждения.

**Пятьдесят восьмое уточнение, 17.09.2026 — затенение: порядок двух строк шаблона решает, какой код работает; правка легла
в проигравшую копию; `weighted` — два писателя одного факта.** Замеры приняты: `calcMixedGrowthPotential` объявлена дважды
на верхнем уровне (`assets/hub-tissue-v3.js:2129`, `assets/mlsn-progressive-disclosure.js:996`), оба — классические скрипты;
в `app/resources/views/reports/export.blade.php` первый грузится строкой 242, второй — 243, побеждает второй, у победившей
копии ключа `status` нет; `calculateC3C4Fractions` объявлена в тех же двух файлах; вчерашняя правка `: 0 → : null` легла в
**проигравшую** копию (`hub-tissue-v3.js`), живой путь несёт дефект нетронутым (`mlsn-progressive-disclosure.js:1002-1003`);
все тесты зелёные, ни один страж не заметил. Граница замера разработчика: пять страниц с `word-export.js`, на четырёх
побеждает `mlsn-progressive-disclosure`, на `/plan` ни один не загружен, на `/stadium` побеждает `hub-tissue-v3` и там не
загружен движок GP (лестница отвечала одно и то же независимо от температуры — отдельная находка).

**1. Чем опознаются пары и сколько их — выводом.** Пара = одно имя, объявленное на верхнем уровне в двух и более
классических скриптах, **загружаемых на одной странице**; побеждает позднее объявление в порядке `<script>` шаблона (и
`function`, и `var`, и `window.X =` — у последнего побеждает последняя запись при загрузке). Вселенная выводится в два
шага: (а) по AST каждого файла — множество объявлений верхнего уровня (`FunctionDeclaration`, `var`, присваивания
`window.`/`global.`); (б) по каждому blade-шаблону — упорядоченный список скриптов (тот же разбор, что у дымохода:
`$hubScripts`, плюс прямые `<script>`), и пересечение имён между скриптами одной страницы. Результат — таблица **страница ×
имя → победивший файл**; число пар — на страницу, не на дерево, потому что пара существует только там, где оба файла
загружены. Дым по форме (мой grep, не замер): объявлений `function` в колонке 0 — 244 в `assets`, имён в двух и более
файлах — **28** (нижняя граница: `var`, `window.X =` и объявления с отступом не считаны; и это по дереву, не по странице —
часть пар на одной странице не встречается).
**2. Как страж узнаёт победителя на каждой странице — тем же порядком, что продукт, и проверяет по значению.** Порядок
задаётся blade, а не JS, — значит страж читает blade (шестнадцатое, двадцать пятое: список скриптов — из шаблона, не из
теста), грузит скрипты страницы в песочницу **в этом порядке** и после загрузки сверяет **по значению**: `Function.prototype.
toString` глобала равен тексту объявления в ожидаемом (позднем) файле; расхождение — красный. Статическая таблица п. 1 —
сторона «объявлено», прогон загрузки — «исполнено», равенство в обе стороны. То же для каждой страницы, грузящей
`word-export.js`, — по списку страниц из каталога blade, не из теста.
**3. Чем закрывается класс «правка легла в копию, которая не исполняется».** Тремя вещами, и координатор права: без
записи достижений зелёный набор этого не показывает.
- **Запись достижений с адресом файла** (двадцать пятое, сорок девятое): журнал прогона пишет для каждой достигнутой
  функции **файл и строку объявления** (не только имя) — при двух копиях видно, какая исполнилась; паспорт стража, который
  утверждает о функции, несёт в `observed` «достигнуто: `mlsn-progressive-disclosure.js:996`»; утверждение о функции в файле,
  который на этой странице не побеждает, — красный. Вчерашняя правка на этом краснела бы в тот же час: сдача утверждала о
  `hub-tissue-v3.js:2095/2101`, журнал показал бы `mlsn-progressive-disclosure.js:996`.
- **Фикстура от продюсера** (пятьдесят седьмое): страж, который **вызывает** продюсер в песочнице, вызывает того, кто
  победил, — и видит его выход; GH-510 не вызывал, а набирал объект, потому и не заметил. Правило одно на оба случая.
- **Пара — дефект класса «два места одного факта», не особенность загрузки:** каждая пара из таблицы п. 1 — строка реестра
  с ценой (на каких страницах побеждает какая копия, различаются ли они текстом); закрытие — одно объявление, второе
  удаляется или переименовывается; храповик по таблице до нуля пар на каждой странице. Правка `: 0` переносится в
  победившую копию **и** пара устраняется в той же сдаче — иначе следующая правка ляжет так же.
Положительный контроль класса: дифференциальный прогон на странице экспорта — движок отвечает `null`, документ **сегодня**
несёт «0%»/статус, хотя правка сдана; после переноса в победившую копию — не несёт. `/stadium`: движок GP не загружен →
`GPE` отсутствует → лестница отвечала константой — отдельная запись инвентаря с ценой (что печатает `/stadium`).

**4. `weighted` числовой при null-листьях — два писателя одного факта.** Замер: `c3: 1, c4: null, weighted: 37`; если бы
`weighted` считался из листьев, при null-листе он был бы null — его пишет не тот, кто пишет листья. Тот же класс, что у
входов программы (сорок пятое). Устройство: объект `growth` — **одна запись одного писателя**: `{c3, c4, weighted, status}`
считаются в одном месте из одних входов, `weighted = f(c3, c4, доля)` наследует `null` листа (двадцать восьмое), `status`
— лесенка с первой ветвью `null` (пятьдесят седьмое); любой другой писатель `growth.weighted` удаляется. Кто сегодня пишет —
не разбиралось; кандидаты по дыму grep (форма): `hub-tissue-v3.js:772` (`r.growth.weighted =` в `validateClimateMetrics`),
`:909-915` и `:6144-6148` (`weighted: (c3 + c4) / 2` из температуры), `cascade-orchestrator.js:352` (`weighted || 50` —
подстановка), `climate-module-v2.1-dual-metrics.js:348, 356`, `climate-module-v2.js:916, 1020`. Установить писателя 37 — замер
приёмом сорок седьмого: мутировать продюсера листьев → `weighted` обязан измениться; не изменился → пишет другой,
запись достижений называет кто. Проверка после: фикстура от продюсера с `c4: null` → `weighted: null`, `status: null`, в
документе ни числа, ни суждения; мутация — вернуть второго писателя → 37 → красный.

**Вопрос координатора: одного ли происхождения `weighted || 50` (`cascade-orchestrator.js:352`) и `growthPotential || 50`
(`word-export.js:9826, :9846`)?** По чтению (форма, дерево у разработчика) их не два, а **не менее одиннадцати в семи файлах**
с одной константой: `cascade-orchestrator.js:352, :516`; `hub-tissue-v3.js:2390` (`?? 50) / 100`), `:3226`, `:5300-5306`
(**лесенка статуса с `?? 50`** — при `null` печатает статус для 50, «суждение из пустоты» в другой форме: не последняя ветвь,
а подстановка перед лесенкой); `nitrogen-validator.js:577`; `stress-trajectory-engine-pure.js:436`; `word-export.js:9826, :9846`.
Комментариев о происхождении константы нет ни у одной; «50 — нейтральный/средний ростовой потенциал» — общее соглашение,
скопировано или придумано независимо — по коду не установить, а история версий мне закрыта. **Для пакета владельцу
происхождение не решает, решает сток и цена:** запись в инвентаре — **одна на класс** («GP по умолчанию 50», соглашение) с
**подстрочными записями на каждое место**, у каждой своя цена, потому что стоки разные: валидация N (`:9826/:9846`) —
недостижима, цена 0 (пятьдесят пятое); каскад износа/стресса (`cascade-orchestrator.js:352, :516`), статус на странице
(`hub-tissue-v3.js:5300`), валидатор азота (`:577`), траектория стресса (`:436`) — достижимость и цена не измерены. Так
владелец видит «одно соглашение, 11 мест, из них с ненулевой ценой — N» (два числа, потом перечень — 10.7), а не одиннадцать
несвязанных строк и не одну строку, скрывающую десять. Замер, который даёт цены, — уже принятый: дифференциальные прогоны
по входу `growth` (`null` / 50 / часовой) на каждой странице, где сток достижим; `out(null) == out(50) ≠ out(A)` — место
живое, цена — что изменилось у клиента; равенство всех трёх — сток недостижим или не зависит. Устранение — одним ходом на
класс после ответа владельца, не по одному месту; до ответа — статус «в оценке» у всех одиннадцати, найденные вне списка
(grep — нижняя граница) добавляются тем же прогоном, не перечнем.
**Приёмка «неполнота фикстуры» — поправка координатора принята и записана:** неполноту нельзя поймать красным цветом того
же стража (4 из 4 зелёных при вердикте в документе — «неполнота проявляется молчанием»); она видна только сравнением
формы фикстуры с формой продюсера. Признак: если проверка неполноты требует, чтобы неполный страж покраснел, условие
неверно.

**Пятьдесят девятое уточнение, 18.09.2026 — владелец методологии: решение меняется на конфиг; шаг «перенос в колонку»
снимается; одна функция держит и вывод по региону, и умолчание.** Замеры координатора и Ники приняты (перепроверены по
дереву): у шага «перенос методологии в колонку» нет исполнителя (в `app/app/Console/Commands` — `ExportFieldOwners`,
`MakeAdmin`, `RepairSiteConfigs`; миграции, заполняющей `methodology_override`, нет; колонка создаётся начальной схемой и
не наполняется; форма её не шлёт); читатели колонки во всём PHP — `Site.php:32` (fillable), `SiteController.php:170`
(валидация), `:988` (эхо в payload) и единственный функциональный `SampleController.php:479` (штамп при создании пробы);
серверные страницы берут методологию из gaip-конфига через `effectiveMethodology` (`Controller.php:23`; dashboard,
analysis, reports, settings, data); анализ пробы — из кэша; клиентский Re-run — штамп после DOM. Заполнение колонки чинит
штамп **будущих** проб и ничего из уже посчитанного.

**1. Ответ на вопрос: шаг не должен остаться — ни как действие на стенде, ни как часть правки.** Он стоял в пятьдесят
третьем как следствие решения «владелец — колонка», а то решение держалось на посылке «факт, нужный серверу, живёт в
колонке `sites`, сервер читает колонки». Для методологии посылка **неверна по замеру**: сервер читает **конфиг** — в
шести контроллерах через одну функцию — а колонку читает только штамп, который пятьдесят третье и так убирает. Значит
колонка не владелец, а пустое хранилище с одним уходящим читателем; наполнять его — заводить второе место у факта,
который уже живёт в одном. **Владелец методологии — `config.turf.methodology` (namespace `gaip`), то, что пишет форма
Settings; второе звено — `accounts.methodology` (настройка аккаунта), отдаётся API вместе со строкой сайта.** Колонка
`sites.methodology_override` **упраздняется**: не пишется (форма и так не пишет), не читается (штамп снят), из `fillable`,
валидации и payload убирается; удаление из схемы — отдельной миграцией позже, не в это задание. Это четвёртое место за
два дня, где «владелец один» убирает хранилище, а не наполняет его (`opts.sample`, снимки, ключ методологии в кэше,
колонка). Двадцать девятое п. 2 и пятьдесят третье п. 1 в части «колонка» — **отменяются этим уточнением**; в части
«снимок перестаёт писаться и читаться» и «Re-run читает владельца по id» — остаются.
Асимметрия с текстурой названа, не спрятана: текстура — колонка (`soil_texture_override`, GH-482 сдан, серверный читатель
`SampleAnalysisController.php:92-95` читает колонку). Два одинаковых по роли факта в разных хранилищах — не по замыслу, а
по цене: переносить текстуру в конфиг значило бы отменять сданное ради симметрии; переносить методологию в колонку —
писать исполнителя и трогать шесть контроллеров ради симметрии. Симметрия не факт клиента; остаётся как известная
асимметрия с одной записью в 10.11 (L8), закрывается, если и когда текстура переедет по своей причине.

**2. Что делается вместо переноса — правка одной функции и двух чтений.**
- `effectiveMethodology` (`Controller.php:23-28`) — базовая для шести контроллеров и держит сразу **вывод по региону**
  (`isNewZealand → 'ammonium_acetate'` поверх сохранённого) и **умолчание** (`'mlsn'` при пустом). По тридцатому и
  пятьдесят второму: и то и другое уходит; функция читает владельца (`config.turf.methodology`, затем аккаунт) и при
  пустоте возвращает `null` — исход `empty`, который шесть контроллеров обязаны показать («methodology not set»), а не
  посчитать по умолчанию. Цена в числах до правки: сколько из 12 сайтов имеют пустой `turf.methodology` в конфиге и
  пустую настройку аккаунта — столько страниц перестанут считать по `'mlsn'` и покажут «не задано»; это замер, и его
  результат идёт владельцу по 10.7 (подстановка `'mlsn'` — с ценой), не снимается молча.
- Штамп `SampleController.php:479-480` — снят (пятьдесят третье п. 2).
- Re-run (`hub-persistence.js:1313-1314`) — читает владельца по id через резольвер (пятьдесят пятое); `fromConfig
  ('methodology')` — GH-480 уже так читает на клиенте, ничего переезжать не нужно.
- Кэш анализа — ключ методологии не пишется и не читается (пятьдесят пятое).
Приёмка та же: методология каждого из 12 сайтов совпадает на Plan, в экспорте и в серверном анализе; сегодня расходятся
четыре (штампы), после снятия штампа и правки функции — расхождений нет по построению, потому что читателей у второго и
третьего места не остаётся. Мутация ревьюера: вернуть `isNewZealand` в `effectiveMethodology` → у NZ-сайта с SLAN в
конфиге сервер считает по AA → красный по приёмке; вернуть `?? 'mlsn'` → сайт с пустой настройкой считает вместо «не
задано» → красный.

**Три непроверенных закрыты замерами Ники (18.09):** (1) `effectiveMethodology` читает конфиг — вызыватели передают
`$gaipConfig['turf']['methodology'] ?? null` (`app/app/Http/Controllers/AnalysisController.php:44-48` и два места того же
файла); (2) поле `accounts.methodology` есть — `string(32) default 'mlsn'` в начальной миграции, аккаунт на стенде один,
значение `mlsn`; (3) сайтов с пустой методологией в конфиге — **0 из 12**: умолчание `'mlsn'` в `effectiveMethodology` сегодня
не срабатывает ни разу, цена его снятия — 0, владельцу идёт числом. Правка от этого не становится ненужной:
`isNewZealand → AA` стоит **выше** умолчания и перекрывает сохранённое независимо от пустоты; его цена не измерена и
меряется отдельно (сайты NZ с сохранённым не-AA — по замерам дня Russley и Test5 в конфиге уже AA, так что цена, вероятно,
тоже 0, — но это заявка, не замер). Асимметрия L8 подтверждена замером Ники: форма Settings пишет текстуру в колонку
отдельным `PATCH`, методологию — в конфиг; одна форма, два соседних поля, два хранилища.
**К 10.8(27), новый факт (координатор, перепроверено Никой):** писателя `sampleId` в `meta` плана в дереве **нет** — оба
вхождения имени отладочные (`nutrition-calendar.js:2492`, `nutrition-au-fertiliser-integration.js:577`). Перегенерация планов
сегодня отметку пробы **не даёт**; работа по решению владельца (отметка при генерации) ещё не написана. До неё каждый план,
включая перегенерированный, — непривязанный по пятьдесят первому/сорок восьмому (раздел плана опущен со строкой реестра и
указанием перегенерировать — которое до правки ничего не изменит). Порядок: правка писателя `meta.sampleId` идёт **до**
того, как владельцу предлагается перегенерировать.

### 10.7. Доказательство — требования владельца, встроены

1. **Грязный профиль — постоянный живой сценарий** (`tests/e2e/gh459-cross-site-inputs-live.test.js` расширяется до S6): страница
   прогрета сайтом с тёплосезонным видом (Couch, Christchurch), затем экспорт одной пробы райграсового сайта (Test5), обычная
   загрузка, без задержек и подмен; парный прогон с чистым контекстом. Оба должны совпасть.
2. **Красная проверка на печатный текст**, мутация ревьюера: названия видов чужого сайта не встречаются **нигде** в документе,
   кроме библиографии (список исключённых разделов именован в тесте). Пропущенное место выглядит как отсутствующее.
   **Переписано 16.09 (ночь) по находке ревьюера.** Первая редакция требовала «напечатанный GP согласован с напечатанной рядом
   температурой по кривой из подписи». Это требование неверно: по коду два числа считаются от **разных** температур по
   замыслу — GP от средней за сегодня (`climate-engine.js:26` `todayMean`, `calculateGrowthMetrics(i.todayMean ?? i.mean)`),
   а печатается средняя за период прогноза (`word-export.js:8365` `cm.temperature.mean`). Такая проверка красна на правильном
   документе, а единственный способ её озеленить — печатать другую температуру, то есть изменить то, что видит клиент;
   ночью запрещено, и это молча решило бы доменный вопрос. Заменено на **провенанс**: напечатанные Temperature, Growth
   Potential (обе разновидности), тепловой/холодовой стресс и статус **равны значениям того прогона, чья отметка совпала с
   сайтом пробы** (`run.results.climateMetrics`, слой II), поле за полем. Ловит тот же дефект — пара «13.3 °C при GP 2 %»
   невозможна ни для одной смеси кривых (C3 при 13.3 даёт 47.6, C4 4.1) и потому пришла из двух прогонов — и не постановляет,
   что число должно означать. Что GP и температура берутся от разных средних — не дефект и не предмет этой поправки; если
   владелец захочет это менять, это доменное решение с записью в 10.8.
   Попутно: комментарий `word-export.js:8367` называет `cm.growth.weighted` «drought-adjusted», а по коду
   (`climate-engine.js` `calculateWeightedGrowth`) это чистая смесь кривых по долям C3/C4 без поправки на засуху. Комментарий
   устарел и введёт в заблуждение автора теста; поправить текст комментария при слое II (не поведение).
3. **Помесячное сравнение** GP, температур и азота Plan против экспорта — уже в парити-харнессе (GH-459), остаётся: это
   поверхность против поверхности, доменного утверждения нет. Пересмотрено тем же глазом: строка «после слоя II добавляется
   сравнение с `run.results.climateMetrics`» — это и есть провенанс п. 2, дублировать не нужно.
4. **«Документ печатает сохранённое, а не свежесосчитанное».** Пересмотрено тем же глазом: утверждение «помесячная программа
   в документе равна `site_configs.gaip.nutritionCalendarProgram`» **само постановляет контракт** (документ обязан печатать
   сохранённую программу, а не пересчитывать) — это вопрос 10.8(5), и до ответа владельца такая проверка не пишется: если
   экспорт по замыслу пересчитывает для выбранной пробы, она будет красной на правильном документе, и озеленить её можно
   только сменой поведения. До ответа действует провенанс: напечатанная программа равна той, которую **экспорт сам посчитал
   для этого сайта в этом прогоне** (хук `computeProgram()` парити-харнесса, уже есть), а сохранённая программа сайта
   сравнивается с напечатанной **только как отчётная цифра** (расхождение печатается в отчёте прогона, не роняет тест).
   После ответа на 10.8(5) — либо утверждение равенства с сохранённым, либо явная запись, что экспорт пересчитывает.
5. Всё — на обычной загрузке; условия прогона рядом с цифрой (правило замеров, раздел 8).

**Названные исключения из правила «нет данных — не выводим» — по решению владельца, каждое с цитатой, снимаются только её
решением:**
1. Сертификат AA `S277` при пустой текстуре сайта — «для этого случая используем диапазоны по умолчанию» (17.09.2026,
   10.8(22б)).
2. Порог фосфора MLSN 21 при неизмеренной кислотности пробы — «оставляем как было» (17.09.2026, 10.8(25)); цена: 9 из 48
   живых почвенных проб, статус P у них сохраняется.
Исключение без своей цитаты владельца — падение стража подстановок.

**Факт владельца, который держится при всех рассуждениях (17.09.2026, раздел 25 документа открытых вопросов):** клиент
прекратил тестирование из-за того самого класса дефектов, который чинится здесь, — конфигурация стиралась и заменялась.
Следствие: «клиент не жаловался» и «клиент уже видел эти числа» доказательствами не являются — он не отвечает, потому что
перестал пользоваться; вопрос, отложенный «до отзыва клиента», отложен до события, которое само не наступит. Такие
отложения в этом плане не заводятся; цена решения считается по живым записям, не по отзывам.

**Назначение инвентаря подстановок — по общему указанию владельца 17.09.2026: «это хорошо, что вы спрашиваете, но такие
кейсы мы должны отдельно рассматривать все».** Правило «по умолчанию ничего не берём» определяет, что мы подстановку
**находим и показываем**, а не что с ней делаем. Найденная подстановка не снимается по правилу молча и не оставляется по
правилу молча: каждая выносится владельцу отдельным вопросом с ценой в числах — как сертификат и как фосфор. Инвентарь —
не автоматический чистильщик, а способ не пропустить случай, который надо вынести владельцу с числом. Следствия для
устройства (двадцать второе, тридцать девятое часть 1):
- **Форма находки.** У каждой записи инвентаря — цена в числах: сколько живых записей затрагивает (пробы, сайты, документы —
  по замеру четырёх точек, поправка к двадцать восьмому п. 4) и что именно у клиента изменится, если подстановку снять
  (какой раздел, статус или число). Без цены случай владельцу не выносится — решать по нему нечего; запись без цены —
  «не оценено», в вопрос не идёт.
- **Статусы записи**, и других нет: `в оценке` (цены ещё нет), `в вопросе 10.8(N)` (с ценой, ждёт решения), `разрешено
  владельцем <дата, цитата>`, `снято по решению <дата>`. Храповик инвентаря — не «только вниз» (число — показатель охвата, не
  прогресса, см. ниже), а «нет записей без статуса и нет записей в вопросе без цены»; страж подстановок падает на подстановку без записи и на запись без статуса.
- **Что не выносится по одной:** подстановка, которую не наблюдал ни один живой прогон (цена 0 из N), — статус «снято по
  решению» не ставится автоматически и здесь; она остаётся `в оценке` с числом 0 и идёт владельцу пакетом.
- **Пакет приходит владельцу считанным, а не списком — это требование к устройству, не пожелание к отчёту.** Форма пакета:
  сначала два числа — сколько записей и какая суммарная цена (для пакета нулевой цены — «N мест, цена 0 из M живых») — и
  только по её запросу перечень. Довод координатора: через месяц перечень — полотно на сто записей, которое никто не
  прочтёт, и невидимость возвращается в форме избытка; **непрочитанный пакет равен непоказанной подстановке**, поэтому
  способ подачи — часть механизма. Проверяемо: пакет без двух чисел в голове не считается поданным (страж отчёта сдачи —
  тот же, что «опущено» без цитаты не принимается).
  **Связь (замечание координатора):** это следующее звено того же разрыва, что в тридцать восьмом (паритет верен в том, что
  делает, и не делает того, что ему приписывали отчёты) и в тридцать четвёртом (обещание реестра шире устройства): там —
  между инструментом и фразой о нём, здесь — между отчётом и его прочтением. Весь день проверялось, что находка
  **сделана** (замер, красная мутация, цитата); это правило проверяет, что она **дошла**. Цепочка замкнута с обеих сторон:
  от измеренного до прочитанного. Правило о подаче — о любой передаче, не только о пакете владельцу: сводки координаторов
  Кейт и передача находок дальше подчиняются той же форме («два числа в голове, перечень по запросу»; полотно — находка
  не подана; слова Евы, 17.09.2026).
- **Число подстановок перестало быть показателем прогресса, но осталось показателем охвата** (формулировка
  координатора). Следствие: падение числа само по себе ничего не значит (запись могла быть снята по решению, могла
  исчезнуть из-за сужения сборщика — различимо только по статусам); рост числа **без новых записей `в оценке`** значит, что
  сборщик стал видеть больше форм или больше имён, — это хорошая новость, а не плохая; рост **с** новыми записями `в
  оценке` — новые места, которым нужна цена. Привычка читать рост как ухудшение здесь неверна: показатель качества — не
  число, а «нет записей без статуса и нет записей в вопросе без цены».

### 10.8. Порядок, размер, что откладывается до утра

| Шаг | Что | Закрывает | Дни | Стенд |
|---|---|---|---|---|
| A | Слой I: `resolveExportInputs`, `collectData(inputs)`, удаление чтений вида I по инвентарю 10.5, сторож (а)(б)(в), одиночный экспорт через резолвер | B, C, D, E, F, G, H | 2.5 | RC на текст — да, по очереди |
| B | Слой III: сверка целевого сайта в каждом отложенном писателе, тест late-cascade | факт 2 (возврат чужого в раннер) | 1 | нет |
| C | Слой II: отметка прогона, событие с результатами, `waitForAnalysis` со значением, `collectResults`, явная запись входов в раннер, удаление чтений вида II | A (слот климата) и все результаты | 2.5 | S6, п. 3–4 |
| D | Живая приёмка: S6 оба прогона, RC на текст и на числа мутациями ревьюера, «сохранённое против напечатанного» | — | 1 | да |

Порядок A → B → C → D; A и B можно ночью (не меняют, что печатается для правильно настроенного сайта; меняют только, что при
пустом поле не подставляется чужое). C затрагивает событие раннера, которое читают и другие модули (`hub-tissue`, DLI,
`auto-refresh`) — делать при свободном стенде и с ревью.

**Вопросы на утро (доменные, ночью не решаются; до ответа действует существующее правило «нет раздела, нет подмены»):**

1. Результат прогона принадлежит другому сайту: опустить раздел с пометкой (как сегодня для недоступного) или прервать экспорт
   целиком. Поправка исходит из первого.
2. Площадь зоны (`.gaip-soil-area-ha`) сегодня живёт только в DOM `/hub`. Где ей жить по id — в payload почвенной пробы или в
   конфиге сайта. До ответа — `null`, печать «missing area».
3. Раздел Variety Traits (D): источник по id — сорта из конфига сайта (`turf.variety`, `overseedVariety`) или из пробы. Поправка
   исходит из конфига сайта.
4. Объединён с вопросом 7 — один вопрос, задать один раз.
5. Контракт п. 10.7(4): документ обязан печатать сохранённую программу сайта (что клиент видел на Plan) или пересчитывает её
   для выбранной пробы. От ответа зависит, какая проверка пишется; до ответа — только провенанс и отчётная цифра.
   Рядом второй такой же: GP в блоке Climate & Growth считается от средней за сегодня, а печатается средняя за период —
   так задумано в коде; менять ли — доменное, в этой поправке не трогается.
6. Слой III меняет поведение `/hub` при быстром переключении сайтов (чужой каскад больше не дорисовывает). Клиенту не видно;
   подтвердить, что это не доменное.
### 10.9. Приём, которого избегать: сторож, привязанный к месту или к имени, а не к происхождению значения

Записано 17.09.2026 после четырёх случаев за сутки, один механизм: сторож GH-459 (сканировал тело функции — вынос чтения в
хелпер строкой выше снял проверку), `gh461` (то же плюс имя переменной `_inTurf` — переназначение переменной и второе
присваивание прошли), `gh365` (сопоставление по значению вместо структуры), сторож стадии 1 (по имени переменной вместо её
происхождения). Во всех четырёх тест проверял **где** написано и **как** называется, а гарантия слоя — **откуда** значение.
Регрессия, которая переносит чтение в другое место или переименовывает переменную, проходит такой сторож по построению.

Правило для каждого нового сторожа в этой работе и в проходе Q26:

- Сначала формулируется **гарантия** как утверждение о значениях («ни одно значение в X не происходит из Y»), не о тексте
  («в функции F нет строки S»).
- Сторож проверяет происхождение одним из двух способов: **динамически** — источник Y заполняется сентинелами, и утверждается,
  что ни один сентинел не достиг X (это единственная проверка, безразличная к месту и имени); или **по потоку данных** —
  AST-разбор всего файла от каждого присваивания в X к корням правой части, с разворотом хелперов. Regex по именам и по
  телам функций — только дымовая проверка сверх этих двух, никогда единственная.
- Исключение выдаётся по **назначению** (какие именно члены и зачем), не по форме (весь объект, весь селектор). Исключение
  шире причины — это дыра ровно на разницу.
- Проверка перечня утверждает **каждое** присваивание, не «хотя бы одно»: второй писатель того же поля — красный.
- Красная проверка сторожа включает мутации переноса: то же чтение хелпером выше, тем же чтением из другой функции, тем же
  значением под другим именем, вторым присваиванием после верного. Мутации выбирает ревьюер, не автор (правило 5.2 плана Q26).
- Пять осей в заголовке каждого сторожа (шестнадцатое и семнадцатое уточнения): **единица, момент, различимость, вход,
  носитель**; у проверки отсутствия — обязательный позитивный контроль присутствия в том же файле.

7. **Закрыт владельцем 17.09.2026.** Печатать вид, установленный на сайте; захардкоженные названия убираются. Поле без вида
   печатается пустым, раздел, который без вида посчитать нельзя, опускается. Разбор по полям и сторож — двадцать седьмое.
   Следствие для кривой GP вынесено в (18).
8. **От ревьюера, 17.09.** `data.turf.c3Fraction` в `word-export.js` читается десять раз и не присваивается нигде — мёртвая
   ветка задолго до слоя I. Из-за неё `overseedDominant`, `useC3Targets` и вывод подсева по доле покрова всегда ложны. Два
   выхода: связать `c3Fraction` с `percentC3`, который резолвер уже отдаёт (тогда для сайтов с подсевом изменятся печатаемые
   цели и, возможно, кривая — числа клиента), или удалить ветки как мёртвые (ничего не меняется в печати). Решение владельца.
   До ответа сторож утверждает мёртвость явно (10.6, уточнение п. 2), чтобы её не спрятать.
9. **От ревьюера, 17.09.** `overseedVarietyDisplay`: если в данных сортов нет отображаемого имени по ключу, резолвер отдаёт
   ключ — печать изменится с названия на ключ. Проверить по таблице сортов; если так, вопрос владельцу.
10. **От ревьюера, 17.09.** Строка Location в Site Information: сегодня печатает координаты, потому что резолвер читал
    несуществующий ключ (`locationName` вместо `location.name`, одиннадцатое уточнение). После исправления пути печатается
    название из `location.name`; когда названия у сайта нет — координаты, «Not specified» или ничего — решает владелец.
11. **Четырнадцатое уточнение, 17.09 — отвечать сейчас.** Регион каталога продуктов (какой региональный рекомендатель и
    каталог получает клиент) определяется **по координатам сайта** или это **отдельная настройка страны** сайта, которую
    задают руками (координаты — лишь умолчание при пустой настройке)? Сегодня регион берётся из полей формы скрытого
    раннера и после переезда сайта не меняется (замер: Canberra в Окленде получает австралийский каталог). До ответа
    разработчик на четырнадцатое не запускается.
12. **Закрыт владельцем 17.09.2026.** Слот названия на карточке сайта при пустом имени — пусто; координаты не печатаются.
    Живой e2e на `/morning-briefing` получает ожидаемое значение (двадцать седьмое, п. 2).
13. **Девятнадцатое, 17.09 — отвечено владельцем 17.09.** Название места обязательно; форма Settings не сохраняется, пока
    локация не выбрана, пользователь вводит её. Сообщение — существующее «Location is required» (GH-404).
14. **Девятнадцатое, 17.09 — отвечено владельцем 17.09.** Никаких исключений для существующих сайтов и никаких обходных
    путей: сайт без имени попадает под то же правило при первом сохранении; миграции и отдельной ветки нет.
15. **Двадцать первое, 17.09 — отвечено владельцем 17.09: «Нет региона — не выводим».** Раздел, который без региона
    посчитать нельзя, не печатается; никаких замещений. Правка — двадцать третье, п. 1.
16. **Закрыт владельцем 17.09.2026.** Текстуру менять можно, «из настроек сайта»; изменившиеся напечатанные диапазоны
    приняты как последствие. Владелец — колонка `sites.soil_texture_override` → аккаунт (двадцать четвёртое, пятьдесят
    третье).
17. **Закрыт владельцем 17.09.2026.** Текстура и методология берутся с сайта, из настроек, которые видит пользователь:
    `sites.soil_texture_override`, второе звено `accounts.soil_texture`, и всё. Снимок пробы в цепочку не входит никаким
    звеном; `methodology_snapshot` и `soil_texture_snapshot` для интерпретации не используются. Довод: признак в пробе мог быть
    записан при другой настройке; интерпретация — по текущей. Вывод текстуры из конструкции профиля и серверная подстановка
    `sands` тем же решением из цепочки исключены: нет настройки — текстура не разрешена.
18. **Закрыт владельцем 17.09.2026, с условием.** Вида нет — не печатать; но надо убедиться, что вида действительно нет,
    а не что его не получили. Устройство трёх исходов чтения (`present`/`empty`/`unavailable`), поведение документа и
    доказательство — двадцать восьмое. Относится ко всем полям, где принято «нет данных — не выводим».
    Поправка 17.09: отчёт выгружается всегда, недостающее пишется в реестре данных и на месте раздела, с различием
    «не задано» / «не прочитано» и кодом причины; замер на живом стенде идёт раньше устройства (поправка к двадцать восьмому).
19. **Закрыт владельцем 17.09.2026.** При NZ-координатах в списке методологий только AA (Settings и мастер), в мастере
    выбран по умолчанию и сохраняется шагом. Сужение выбора по региону, не автоподстановка; серверный вывод по координатам
    уходит. Устройство — пятьдесят второе, п. 3.
20. **Тридцатое, 17.09.** Какую водную пробу печатать зоне в комбинированном экспорте, когда у сайта их несколько и ни одна
    не совпадает по id с почвенной (сегодня — последняя по порядку ключей; New test — пять водных)? До ответа поведение
    прежнее, но в реестре документа видимая строка о выборе.
21. **Закрыт владельцем 17.09.2026; формулировка дважды уточнена 18.09.** Расхождение колонки и снимка клиенту не
    объясняется. Устраняет ли его перегенерация — **не измерено**: снимки пишутся в `saveSampleRecord`
    (`app/app/Http/Controllers/SampleController.php:445-484`: `firstOrNew` с `withTrashed`, один `fill` для новой и
    существующей пробы), вызываемой из `store` (`:88`) и из `sync` (`:269`) — путь перезаписи существует через
    `/api/samples/sync`; доходит ли до `sync` хоть одно действие из списка владельца — живой прогон, поставлен первым.
    Моя прежняя запись «пишутся только при создании, остаётся навсегда» — снята (ошибка передачи: одно место записи и четыре
    чтения прочитаны как «пишется один раз», без вопроса, что за функция и кто её зовёт; нашёл ревьюер). Для устройства это
    безразлично: снимок из цепочки уходит вовсе, читатели переезжают на владельца по id — переписывается он или нет, он
    неважен. Для ответа владельцу — формулировка условная до замера: «перегенерирую, расхождений не останется» может
    оказаться верным буквально. Хранилище методологии — конфиг (пятьдесят девятое); снимок перестаёт писаться и
    читаться (пятьдесят третье).
22. **Закрыт владельцем 17.09.2026.** (а) Происхождение диапазонов AA в документ не выносится — «есть в UI, в отчёт не
    надо, если клиент не попросит»; строка реестра не заводится, поле `aaSampleTypeSource` из модели документа снимается.
    (б) Умолчание сертификата остаётся — «для этого случая используем диапазоны по умолчанию»: при пустой текстуре
    печатаются диапазоны S277. Именованное исключение из правила «нет данных — не выводим», единственное, по решению
    владельца 17.09.2026. Следствия — закрытие 10.8(22) после тридцать первого.
23. **Закрыт владельцем 17.09.2026.** Печатать ли строку о том, чего нет ни у кого (вердикты вида II без отметки прогона до
    слоя II)? «Пока не выводить и не писать комментарий в отчёте». Разделы отсутствуют без сноски и без строки реестра;
    область `release` собирается в модель, не печатается; работа по привязке — отдельной строкой в документе открытых
    вопросов (раздел 18). Устройство — тридцать девятое, часть 3.
24. **Тридцать четвёртое, 17.09.** Что печатать для лабораторного значения ниже предела обнаружения (`<0.5`), когда такие
    появятся: сырую строку, «below detection», ничего? В базе сегодня таких нет; до ответа — только строка реестра
    «Could not be read (parse-failed)».
25. **Закрыт владельцем 17.09.2026.** «Оставляем как было»: порог P = 21 при неизмеренной кислотности сохраняется, статус
    фосфора у 9 из 48 проб не снимается. Второе именованное исключение из правила «нет данных — не выводим», рядом с
    сертификатом (10.7); снимается только решением владельца. Общее указание владельца к нему — 10.7, «назначение
    инвентаря подстановок».
26. **Закрыт владельцем 17.09.2026.** Вырезание разделов, зависящих от пробы, у второй и следующих — дефект, не задумка:
    план генерится по одной пробе, отчёт про пробу несёт её план и рекомендации; нет плана по пробе — раздел опущен по
    отсутствию данных со строкой реестра, не по позиции. Какие из пяти разделов о пробе — замером (сорок седьмое, часть A).
27. **Закрыт владельцем 17.09.2026.** «Нужен идентификатор; со старыми планами ничего не делаем — перегенерируем». Новые
    планы несут `meta.sampleId`; план без отметки — непривязанный, раздел опущен со строкой реестра и указанием
    перегенерировать. Сопоставление старых планов по снимку не делается.
28. **Закрыт ценой ноль 17.09.2026 (замер разработчика).** Умолчания `'mlsn'`/`'loam'` недостижимы; строка валидации
    `:9825-9826` не исполняется. Оговорка сохранена: дефект есть по коду, цена сегодня нулевая. Снимаются вместе с
    цепочкой чтений Re-run (пятьдесят пятое), в пакет владельцу записью с ценой 0.

### 10.10. Дымоход экспорта — постоянный тест в обычном `npx jest` (17.09.2026, вход владельца)

**Факт, ради которого он нужен.** 2639 зелёных тестов при мёртвом экспорте: правка слоя I оставила обращение к переменной,
которую сама же убрала, и сборка документа падала исключением целиком. Ни один тест в `npx jest` не выполняет `exportToWord()`
— четыре теста грузят `word-export.js` в песочницу (`gh401`, `gh369`, `hoxton-export-awaits-climate-normals`, …) и зовут чистые
функции; единственное выполнение экспорта целиком — скачивание в парити-харнессе (`ui-vs-export-parity.test.js:928`), которое
без стенда пропускается. Закрывается тестом, не правилом.

**Место — `tests/word-export-smoke.test.js`, обычный набор, без стенда и без браузера.** Живые наборы без стенда пропускаются,
значит дымоход среди них не выполняется там, где смотрят каждый день. Песочница `vm` с реальными модулями — установленный в
репозитории способ (`gh401-delivery-volumes-and-rounding.test.js:104-125` `loadWordExport()`), и в node 24 есть `Blob` и
`URL.createObjectURL`, которые нужны `exportToWord()`. Скачивание в парити-харнессе остаётся вторым, браузерным дымоходом на
случай, когда стенд поднят; первый — этот.

**Устройство.**

1. **Тот же код, что на странице.** В песочницу грузятся `assets/docx.min.js` и `assets/jszip.min.js` (UMD, вешаются на
   `globalThis.docx`/`JSZip` — сама библиотека страницы, не пакет из `node_modules`, чтобы версия не разошлась), затем модули
   расчёта, которые читает экспорт: `nutrition-requirement-core.js`, `nutrition-delivery-core.js`, `nutrition-program-inputs.js`,
   `species-controller`/`gp-status.js`/`climate-normals-service.js` и остальное из списка `reports/export.blade.php:238-310`,
   затем `word-export.js`. **Перечисление:** список модулей в тесте не пишется руками — он читается из массива скриптов в
   `reports/export.blade.php`, и тест утверждает, что грузит всё из него, кроме именованного списка исключений с причиной
   (UI-только модули: панели, кнопки, мастер). Модуль, добавленный на страницу и не попавший в дымоход, роняет тест.
2. **Стабы — только поставщики данных страницы, никогда внутренности экспорта.** `GAIP_HUB_CONFIG`, `GAIP_SiteConfig.getConfig(id)`,
   `GAIP_SampleManager` (активный сайт, список сайтов, пробы по id), `GilbaClimateNormalsService.getResolvedSync(lat, lon)`
   отвечают данными одной реальной фикстуры (`tests/fixtures/test5-soccer-sample141.json` или парити-фикстура с блоком
   `scenario`). `document` — стаб с `createElement`, где `<a>` запоминает `href` и `click()`, `URL.createObjectURL` запоминает
   blob; `console.error` и `console.warn` записываются, не глушатся.
3. **Выполняется сама функция.** `await GAIP_WordExport.export()` — не `collectData()` + `buildSections()` по отдельности: владелец
   просит проверку, которая выполнит **эту** функцию.
4. **Утверждения — самые дешёвые, но не пустые:** (а) blob создан и ссылка «нажата»; (б) `blob.size > 0`; (в) `JSZip.loadAsync(blob)`
   открывается, внутри есть `[Content_Types].xml` и `word/document.xml` непустой — это и есть «файл открывается» для .docx;
   (г) `word/document.xml` содержит имя сайта и ярлык пробы из фикстуры — одна строка каждого; без (г) документ с пустыми
   разделами (исключение внутри `buildSections`, перехваченное и залогированное) прошёл бы как «непустой и открывается»;
   (д) за время экспорта ни одного `console.error`. Чисел не сравнивается, содержимое не разбирается — (г) это подстрока, не
   разбор.
5. **Красная проверка** (мутации выбирает ревьюер, три обязательных): обращение к несуществующему идентификатору в
   `collectData` (ровно сегодняшний дефект) → красный по (а)/(д) с `ReferenceError` в выводе; `buildSections()` возвращает
   `[]` → красный по (г); переименование `GAIP_WordExport.export` → красный на загрузке. Стаб-дрейф проверяется четвёртой:
   стаб `getSiteConfig` возвращает `null` → экспорт обязан не упасть молча, а дать документ с «Not specified» и без
   `console.error`, либо упасть с ошибкой — что именно, фиксируется по текущему поведению, не выбирается.
6. **Комбинированный экспорт** — вторым тестом в том же файле после слоя II: `exportCombinedWithSamples([две пробы двух сайтов])`,
   `triggerAnalysis()` находит стаб-кнопку, чей `click()` сразу диспатчит `gaip:analysis-complete` с отметкой прогона и пустыми
   результатами; утверждения те же (а)–(д) плюс «в документе есть оба имени сайтов». До слоя II `waitForAnalysis()` не
   возвращает значения, и цикл ждёт `TIMEOUT_MS` — поэтому не раньше.

**Дополнение 17.09.2026 — потеря всей программы питания проходила как «экспорт работает».** Две мутации ревьюера (обнулить
признак наличия программы; подсунуть пустую) — 6 из 6 зелёных. Решение: дымоход утверждает **наличие центрального раздела**,
оставаясь без чисел и без разбора — это подстрока, как имя сайта в (г): (е) `word/document.xml` содержит заголовок раздела
программы питания **тем литералом, которым его печатает `word-export.js`** (взять из кода построителя, не придумывать), и **не**
содержит текст «недоступно/unavailable», которым файл печатает отсутствие программы, при фикстуре с полными входами. Документ без
единственного раздела, ради которого он существует, — это экспорт, который не работает; утверждение о его присутствии — часть
«работает», не разбор содержимого. Красная проверка — обе мутации ревьюера.

Условная слабость, названная ревьюером, закрывается правилом: **строки, по которым дымоход узнаёт, что данные прошли через
резолвер, не должны существовать в `word-export.js` как литералы.** «Perennial Ryegrass» стоит в файле семь раз как умолчание;
сегодня оно в документ не попадает, при активном подсеве попадёт, и тогда совпадение ничего не докажет. Тест сам проверяет, что
каждая утверждаемая строка (имя сайта, ярлык пробы, вид травы) не встречается в исходнике `word-export.js`; иначе фикстура
меняется на ту, чей вид в файле не захардкожен (`Creeping Bentgrass (Greens)`, Burns/Federal), или в утверждение берётся ярлык
пробы вместо вида.

**Слепые зоны — названы, не спрятаны.** Песочница не браузер: захват SVG/canvas-графиков (`captureCharts`), вёрстка, реальные
`Blob`/`URL`, порядок загрузки на живой странице в ней не проверяются; для них остаётся браузерный дымоход парити-харнесса.
Стаб поставщиков данных может «сделать зелёным» то, чего на странице нет, — поэтому стабы ограничены поставщиками данных и
кормятся реальной фикстурой, а список модулей берётся из blade.

**Вторая, статическая сеть на тот же дефект — дешевле дымохода и шире его.** «Обращение к убранной переменной» ловится без
выполнения: `tests/assets-no-undefined-identifiers.test.js` разбирает каждый `assets/*.js` через `@babel/parser` +
`@babel/traverse` (уже в devDependencies), берёт свободные идентификаторы (`scope.hasBinding()` ложно) и сверяет с именованным
списком глобалов страницы (`window`, `document`, `docx`, `JSZip`, `GAIP_*`, …). Неизвестный свободный идентификатор — красный с
файлом и строкой. Это ловит класс «ссылка на то, чего больше нет» во всех модулях разом, а не только в экспорте; дымоход при
этом нужен всё равно — он ловит падения, которые видны только при выполнении (неверная форма данных, `null` там, где ждали
объект). Место — часть 0 плана Q26 (инструмент), 0.5–1 день на список глобалов.

**Размер.** Дымоход одиночного экспорта — 1 день (стабы, фикстура, три красные проверки); комбинированный — 0.5 дня после
слоя II; статическая сеть — 0.5–1 день. Порядок: дымоход одиночного экспорта — **до** продолжения работ по слою I, потому что
именно его отсутствие пропустило сегодняшнюю поломку.

### 10.11. Открытые строки реестра (переносятся в `Q26-ledger` как есть, не в текст отчётов)

| № | Строка | Открыта | Закрывается чем |
|---|--------|---------|-----------------|
| L1 | **Песочница экспорта не исполняет тканевую и водную ветви `loadSample` и не шлёт `gaip:site-changed`; для Plan и для собственного прогона страницы (вид II: `tissueResults`, `mlsnResults`, водные индексы, смесь) инструмент остаётся сломанным.** Тридцатое сняло зависимость только для чтений экспорта (числа по id из записи пробы); «зависимости нет» не означает «песочница в порядке». | 17.09.2026, двадцать шестое / тридцатое | Отметки прогона слоя II, проверенные событием в jsdom, — для вида II в экспорте; для Plan и прогона страницы — либо среда с настоящим `sample-manager.js` (двадцать шестое п. 2, отложено), либо отдельное решение о том, что прогон страницы экспортом не измеряется вовсе. До этого строка открыта. |
| L2 | **GH-484: `data.tissue.resultsOmitted` / `data.water.resultsOmitted` записаны без потребителя; разделы Limiting Nutrients, Classification, Sodium Hazard, Salinity Hazard исчезают из документа без слова.** Реестр «Data availability» и абзацы «Not included:» (поправка к двадцать восьмому) в коде отсутствуют. | 17.09.2026, тридцать второе | Оба потребителя построены и читают исход `omitted / no-run-stamp`; тест утверждает абзац в `word/document.xml` с положительным контролем (прогон с отметкой печатает разделы). |
| L3 | **GH-486: «All site data present» недостижимо ни для одного из 12 сайтов** (две записи `no-run-stamp` стоят безусловно в таблице сайта), а положительный контроль gh486 получает его удалением `data.availability` руками (`:112-117`). | 17.09.2026, тридцать третье | Область записи выводится из причины (`REASON_SCOPE`), `release`-записи вне таблицы сайта; объект рендера заморожен и `===` возврату `collectData`; контроль — фикстура с полным набором печатает «All site data present» вместе с блоками ткани и воды; живой сайт ≥ 1 из 12. |
| L4 | **Комбинированный экспорт правит модель после `collectData` — 33 записи** (`word-export-combined.js:747, 766-772, 826-831, 915, 2497-2938, 3110`); граница сборки на возврате `collectData` не ставится; заморозка карты исходов оставлена как защита контроля (отклонение GH-487). | 17.09.2026, тридцать шестое | Записи разведены поимённо: параметры сборки → `collectData(inputs, ctx)`, второй писатель полей (метки) → снят; после переезда возврат `collectData` — конец сборки и граница тридцать пятого возвращается; храповик по поимённому списку, не по счётчику. |
| L5 | **Живой S7 (`gh459-cross-site-inputs-live`) читает первую таблицу документа, не таблицу своего сайта**: при опущенной программе Russley зеленеет на таблице Test5 (14/14 дважды). Единственный живой набор, ловивший исходный дефект владельца, слеп по оси единицы. | 17.09.2026, тридцать седьмое | Все чтения документа в e2e — через `reportOf(xml, siteLabel)`; S7 утверждает таблицу у каждого сайта внутри его куска и ряд нормалей своего сайта; зеркальные прогоны (Auckland/Christchurch отключены) краснеют о своём сайте; страж на прямой разбор `document.xml` вне помощника, храповик до нуля. |
| L6 | **Ветвь MLSN лестницы порога P читает pH из `GAIP_STATE.soil` (`word-export.js:9145-9152`), на живом экспорте объект не определён — лестница не срабатывала ни разу; GH-490 перевёл только ветвь SLAN.** По замеру координатора порог меняется у 6 из 48 проб. | 17.09.2026, тридцать девятое | pH — из `data.soil.pH` по id (`readingsOf`), лестница — одна чистая функция для обеих ветвей и для движка; без pH — исход по 10.8(25); чтения pH со страницы выводятся diff'ом документа при разном состоянии страницы и одной пробе. |
| L7 (закрывается пятьдесят вторым: безусловный заголовок «Summary Across Samples» на выходе из цикла) | **Последний отчёт комбинированного документа проверяется S7 слабее остальных:** срез идёт до конца тела и вбирает общезаводской хвост, чужие имена в нём не утверждаются (`gh459-cross-site-inputs-live.test.js:629-658`, только журнал); хвост уже содержит чужие ярлыки (Fertiliser Purchasing Summary). Плюс: S7 утверждает различность GP-колонок, не равенство ряду своего сайта. | 17.09.2026, сороковое | Маркер конца отчёта в продукте («End of report n of N», правка продукта, видимая клиенту) → срез последнего равен остальным; в S7 — равенство колонки каждого отчёта известному ряду своего сайта (правка данных теста). |
| L8 | **Асимметрия хранилищ двух одинаковых по роли фактов:** текстура — колонка `sites.soil_texture_override` (GH-482), методология — конфиг `turf.methodology` (пятьдесят девятое); не по замыслу, а по цене. | 18.09.2026, пятьдесят девятое | Закрывается, если текстура переедет в конфиг по своей причине; отдельно не чинится. |


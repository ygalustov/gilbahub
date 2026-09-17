# PLAN (вариант 2) — GH-439: минимальная починка без смены архитектуры

Параллельный план к `PLAN-GH439-site-config-db-only-RU.md` (далее «полный план»). Находки
`GH-439-config-reset-analysis-RU.md` (далее «анализ») приняты как установленные; оба документа не редактировались.
Написан 15.09.2026 по рабочему дереву на эту дату. Код не менялся, git не трогался, база не открывалась,
тесты не запускались, агенты не запускались. Единственное созданное — этот файл.

Номера тикетов: шаги здесь обозначены M0–M5. Если выбран этот путь, буквы GH-439a… из полного плана достаются им;
проставляет разработчик по факту, следующий свободный после GH-438 в changelog `docs/instructions.md`.

---

## 0. Целевое состояние, одним абзацем

Браузер продолжает держать копию конфигурации (`gilba_hub_site_configs` в `localStorage`, `window.GAIP_SITE_CONFIG`
на Plan, `D.gaipConfig` на Settings, легаси-регистр сайтов в `gilba_samples`). Все существующие маршруты остаются:
`PUT /api/sites/{id}/config/gaip` принимает объект целиком, `POST /api/sites/sync` принимает регистр. Меняются три вещи.
Сервер перестаёт стирать то, чего в запросе нет, и перестаёт принимать ID как имя. Клиент перестаёт отправлять
снимки DOM и копии других сайтов: на сервер уходят только те сайты, которые эта страница изменила через
`mergeConfig()`-семейство, и только после того, как сервер был прочитан. Каждая запись несёт номер версии, которую
клиент читал; если сервер ушёл вперёд, запись отклоняется (409), клиент накладывает своё изменение на свежую копию и
повторяет. Ни один путь из таблицы анализа после этого не пишет в базу состояние, построенное без чтения базы.

---

## 1. Что этот путь не трогает (граница минимального)

- Таймеры `restoreDelay` 800/3000 мс, `snapshotConfig()`, `restoreConfig()`, ветка «first visit», обработчики
  `gaip:turf-profile-change` / `gaip:site-save-requested` / `gaip:config-save-requested` / `gaip:analysis-complete` —
  остаются как есть. Они продолжают писать в локальную копию. Они перестают быть основанием для записи на сервер.
- `location-preloader.js`, `migrateDefaultSite`, зеркала Settings в `localStorage` (W18, W20, W21 полного плана),
  `saveLocationToServer()` (W3) — не трогаются.
- Форма PUT-запросов сохраняется (`{ config: <объект> }`); добавляется одно необязательное поле `base_version`.
- `gssh` (стадион) — вне области, как в полном плане.
- Пробы (W40, stamp `gilba_samples.currentSite`) — план по пробам.

---

## 2. Контракт API после работы

### 2.1. `PUT /api/sites/{site}/config/gaip` — остаётся, получает четыре правила и версию

Тело: `{ "config": { … }, "base_version": 7 }`. `base_version` необязателен.

Правила для `namespace = gaip` (для `gssh` ничего не меняется), применяются **после** `resolveGaipConfigWrite()`
(`SiteController.php:437-548`), который остаётся без изменений:

1. **Перенос отсутствующих ключей.** Каждый верхнеуровневый ключ, который есть в строке базы и которого нет в
   `config` запроса, копируется из базы. Исключение — три программных ключа `nutritionProgram`,
   `nutritionCalendarProgram`, `nutritionProgramCoords`: ими уже распорядился `resolveGaipConfigWrite()`, и когда он
   намеренно оставил их пустыми (координаты меняются в этом же запросе), общий перенос не должен их воскрешать.
   Присутствующий ключ с пустым значением (`[]`, `{}`, `""`) заменяет — это явная запись.
2. **Слияние по полям внутри `turf`, `location`, `wizard`.** Если секция есть в запросе, поля секции, отсутствующие
   в запросе, копируются из базы; присутствующие заменяют, включая `""` и `null`, кроме п. 3. Остальные секции
   (`pgr`, `traffic`, `irrigation`, `weatherOverride`, массивы, скаляры) заменяются целиком, как сегодня.
3. **Защита identity-полей.** `turf.species`, `turf.methodology`, `turf.turfType`, `location.lat`, `location.lon`:
   если в запросе `null` / `""` / нечисло (для координат), а в базе непустое значение — остаётся значение базы.
   Ни одна форма продукта не может законно обнулить эти пять полей (Settings > Site требует локацию — GH-404).
4. **`wizard` никогда не исчезает через PUT** — следствие п. 1. Сбросить его можно только явно прислав `wizard`
   с другим содержимым.
5. **Версия.** Колонка `site_configs.version` (unsigned int, default 0). Увеличивается на 1 при каждой записи
   колонки `config` любым путём (observer `saving` на модели `SiteConfig`: `updateConfig()`, очистка программы в
   `update()` при смене координат, `firstOrCreate` в `syncRegistry()`, `store()`). Если в запросе есть
   `base_version` и он не равен текущему — **409**, ничего не записано, тело
   `{ message: "Site configuration changed since this page loaded it", data: { site_id, namespace, config: <текущий>, version, synced_at } }`.
   Без `base_version` запрос принимается, как сегодня (легаси-писатели: оба мастера, `gssh`).
6. **Ответ 200** — как сегодня плюс `data.version`. `sitePayload()` (`SiteController.php:601-622`) отдаёт
   `configs.gaip.version`; инжекты в blade отдают версию рядом с конфигом (раздел 3, M2).
7. **Лог.** На каждый PUT `gaip`: `Log::info('site-config.put', [site_id, user_id, referer, keys(config),
   carried: [...], guarded: [...], base_version, version])`. Если сработал п. 3 — `Log::warning('site-config.put.guarded', …)`.
   Если 409 — `Log::info('site-config.put.conflict', …)`. Это единственный след для следующего инцидента.
   `SiteController.php` сейчас не импортирует `Log` — добавить `use Illuminate\Support\Facades\Log;`.

### 2.2. `POST /api/sites/sync` — остаётся, перестаёт переименовывать и создавать

`syncRegistry()` (`SiteController.php:80-151`):

- имя из запроса считается пустым, если оно равно `$siteId`, или совпадает с `/^[0-9a-f]{8}-[0-9a-f]{4}-/i`
  (UUID-форма), или начинается с `__site__` (уже есть). Пустое имя → существующая ветка `$site->name` (имя не меняется);
- неизвестный `$siteId` → пропускается, `saved` его не считает; в ответ добавляется `skipped`. Ветка `else`
  (`new Site()` c `timezone = 'Australia/Sydney'`) удаляется;
- `firstOrCreate` для `site_configs` существующего сайта остаётся.

### 2.3. Что не меняется

`PATCH /api/sites/{site}`, `GET /api/sites`, `GET /api/sites/{site}`, `POST /api/sites`, `PATCH /api/active-site`,
`DELETE /api/sites/{site}` — без изменений (кроме `version` в `sitePayload()`).

---

## 3. Шаги

Каждый шаг — отдельный коммит, отдельно проверяется, продукт после него рабочий. Порядок обязателен: M0 первым.

### M0 — сервер: гвард на PUT, версия, `sites/sync` без имени и без создания

**Меняется:**

- `app/database/migrations/<date>_add_version_to_site_configs.php`: `$table->unsignedInteger('version')->default(0)->after('config')`.
  Схема `site_configs` — `0001_01_01_000000_create_initial_schema.php:124-134`.
- `app/app/Models/SiteConfig.php`: `version` в `$fillable` и в `casts` (`integer`); `booted()` со `saving`-observer:
  если `isDirty('config')` → `version = (int) getOriginal('version') + 1`.
- `app/app/Http/Controllers/SiteController.php`:
  - `updateConfig()` (`:318-373`): после `resolveGaipConfigWrite()` — новый приватный `guardGaipConfigWrite(array $incoming, ?SiteConfig $existing, bool $coordinatesChanging): array{config, carried, guarded}`
    по правилам 2.1 (1–4); затем проверка `base_version` (2.1.5) **до** `updateOrCreate`; лог (2.1.7);
    `version` в ответе. `$coordinatesChanging` нужен, чтобы не переносить три программных ключа, когда
    `resolveGaipConfigWrite()` их очистил, — проще всего вернуть этот флаг из `resolveGaipConfigWrite()` третьим
    элементом кортежа.
  - `syncRegistry()` (`:80-151`) — по 2.3.
  - `sitePayload()` — `version`.
- `app/routes/web.php:90-97` — без изменений.

**Проверка.** PHPUnit, новый `app/tests/Feature/GH439PutGuardTest.php` (~12, раздел 10) и
`app/tests/Feature/GH439SyncRegistryTest.php` (~4) зелёные; два существующих теста `SiteApiTest.php:115-227`
переписаны (они пинят создание сайта через sync). `GH371CoordinateInvalidationTest.php` (15) зелёный без правок —
`resolveGaipConfigWrite()` не тронут. `php artisan test` зелёный.
E2E `tests/e2e/gh439-config-reset-live.test.js`: **E зелёный** (имя на месте), **F переписан** на «сайт не создан,
`saved: 0`, `skipped: 1`» и зелёный; **H1 по-прежнему красный** — снимок несёт `nProgram: "250"` непустым, сервер
не отличит его от намеренного; закрывает M1. **B по-прежнему красный** — закрывает M2. Оба записать как
`test.failing` до своих шагов.

**Провал.** PUT без `wizard` при `wizard` в базе → в базе нет `wizard`; PUT с `turf.species: ""` → в базе пусто;
PUT с `base_version` на единицу меньше → 200 вместо 409; `POST sites/sync` с `label = id` → `sites.name = id`.

**Размер.** 1.5–2 дня.

### M1 — `site-config-persistence.js`: снимки не уходят на сервер; уходят только изменения этой страницы

**Меняется** (`assets/site-config-persistence.js`, 1917 строк):

- Новые модульные переменные: `_serverPullDone = false`, `_serverVersions = {}` (siteId → `version` из
  `GET /api/sites`), `_dirty = {}`, `_pendingPatches = {}` (siteId → массив патчей), `_pushAfterPull = false`.
- `pullConfigsFromServer()` (`:315-421`): для **каждого** сайта из ответа записать `_serverVersions[id]`
  (независимо от наличия `turf`). Правило слияния заменяется: для сайта, у которого есть `config` с `turf`,
  `_configs[id] = serverCfg` **целиком**; если `_dirty[id]` — после этого заново наложить `_pendingPatches[id]`
  тем же кодом, что `mergeConfig()`. Сравнение `savedAt` и список `identityFields` удаляются: Settings не
  обновляет верхнеуровневый `savedAt` (`settings-init.js` — единственный `savedAt` на `:1752`, внутри `traffic`),
  поэтому «сервер новее» по `savedAt` никогда не срабатывало после правок в Settings с другого устройства.
  В конце: `_serverPullDone = true`; если `_pushAfterPull` — вызвать `pushConfigsToServer()`. В `catch` —
  `_serverPullDone` остаётся `false`.
- `pushConfigsToServer()` (`:268-310`): в момент срабатывания таймера — если `!_serverPullDone` →
  `_pushAfterPull = true; return`. Ключи — только `Object.keys(_dirty)` ∩ живые сайты, без `'default'`.
  Тело для сайта: `clone(_configs[id])` с повторно наложенными `_pendingPatches[id]` (чтобы снимок DOM, случившийся
  между `mergeConfig()` и отправкой, не выбросил изменение — сегодня `snapshotConfig()` не переносит, например,
  `alertContacts`), плюс `base_version: _serverVersions[id]`. На 200: `_configs[id] = data.config`,
  `_serverVersions[id] = data.version`, `delete _dirty[id]`, `delete _pendingPatches[id]`, `saveToStorage()`.
  На 409 (`err.status === 409`, тело в `err.responseText` — `apiFetchJson`, `:66-93`): `_configs[id] = data.config`,
  `_serverVersions[id] = data.version`, заново наложить `_pendingPatches[id]`, повторить PUT **один раз**; второй
  409 → `warn(...)`, `delete _dirty[id]`, `delete _pendingPatches[id]`. `syncSiteRegistryToServer(keys)` остаётся
  перед PUT (сервер имена больше не принимает — безвредно).
- Новая приватная `markDirty(siteId, patch)`: `_dirty[siteId] = true; _pendingPatches[siteId].push(clone(patch))`.
  Вызывается **только** из `mergeConfig()` (`:1808-1846`), `setCompanionSpecies()` (`:1857-1866`, патч
  `{ turf: { companionSpecies } }`), `setMultiSiteTurfEnabled()` (`:1896-1913`, патч `{ multiSiteTurf }`).
- `saveCurrentSiteConfig()` (`:1174-1236`): оба вызова `pushConfigsToServer()` удаляются. Снимок пишется в
  `_configs` и `localStorage`, как сегодня, но не помечает сайт грязным. Ветки page-load (`:1589`, `:1624-1634`)
  и четыре обработчика событий (`:1674`, `:1699`, `:1716`, `:1746`) сегодня push не зовут — не менять.
- `saveCurrentSite` в экспорте (`:1851`) — не помечает грязным (снимок).

**Что это означает для `/hub`:** правки легаси-формы (вид, HOC, методология, overseed, traffic-поля) и кнопка Save
больше не доходят до базы — они живут в локальной копии до следующего pull. Это решение 1 полного плана; оно
нужно и здесь (раздел 11, решение 1).

**Проверка.** Новый jest `tests/gh439-config-push-gating.test.js` (~9, раздел 10) зелёный — по образцу
`bootWithServer()` из `tests/gh377-program-input-invalidation.test.js:820-856` (fake timers, `global.fetch` mock,
реальный модуль). Существующие: `gh377` блок pull (`:807-960`, 3 теста) — два проходят без правок (сервер новее →
всё с сервера), третий («an OLDER server savedAt leaves the local turf alone») переписывается на «сервер заменяет
целиком, если сайт не грязный»; `gh385` (10), `b35fix504` (20), `gh394` (31), `gh371` (30) — без правок в этом
шаге (snapshot/restore не тронуты). Полный `npx jest` зелёный.
E2E: **H1 зелёный** — за 25 с ноль `PUT …/config/gaip`, `wizard` и `nProgram: 200` на месте; **H2 зелёный** —
ноль PUT для неактивного сайта; A, C, D зелёные; парити-харнесс `npm run test:e2e` (+`:burns`, `:slan`) зелёный —
переключение сайтов в скрытом раннере (`saveCurrentSiteConfig()` → `restoreNewSiteConfig()`) работает, потому что
не тронуто.

**Провал.** В логе запросов H1 есть хотя бы один `PUT`; после `mergeConfig()` до завершения pull ушёл PUT;
после `gaip:analysis-complete` тело PUT не содержит ключ, добавленный `mergeConfig()` до снимка; парити-харнесс
падает на переключении сайта (значит, задет restore).

**Размер.** 2 дня.

### M2 — Plan и Settings: `base_version` и повтор на 409

**Меняется:**

- `app/resources/views/plan.blade.php:28`: рядом с `GAIP_SITE_CONFIG` → `window.GAIP_SITE_CONFIG_VERSION = @json($gaipRecord?->version ?? 0)`
  (`PageController.php:33-34` уже держит `$gaipRecord`; передать в view).
- `app/resources/views/settings.blade.php:966`: `gaipConfigVersion: @json($gaipRecord?->version ?? 0)`
  (`SettingsController.php:18`).
- `app/resources/views/layouts/app.blade.php:38`: `gaipConfigVersion` в `GAIP_HUB_CONFIG` (для `seedFromInjectedConfig`
  в M1 — `_serverVersions[activeSiteId]` берётся из инжекта до прихода `GET /api/sites`; иначе первый push на `/hub`
  до pull ждёт pull, что тоже допустимо).
- `assets/nutrition-calendar.js` `persistSiteConfigPatch()` (`:2712-2792`), ветка прямого PUT (`:2764-2787`):
  - вызовы сериализуются через модульную цепочку промисов (`_putQueue = _putQueue.then(...)`): сегодня Generate
    даёт три независимых PUT (анализ, сценарий B — «три PUT»), и параллельные запросы с одним `base_version`
    гарантированно дадут 409 второму и третьему;
  - тело `{ config: GAIP_SITE_CONFIG, base_version: GAIP_SITE_CONFIG_VERSION }`; на 200 —
    `GAIP_SITE_CONFIG = data.config; GAIP_SITE_CONFIG_VERSION = data.version`; на 409 — `GAIP_SITE_CONFIG = data.config`
    (свежий, с методологией из Settings), `Object.assign` того же `patch` поверх, повтор один раз; второй 409 —
    `console.warn`, без записи. Строка `Object.assign({}, GAIP_SITE_CONFIG, patch, {savedAt})` остаётся — это и
    есть «наложить патч».
  - ветка через `mergeConfig()` — без изменений (M1 делает остальное).
- `assets/settings-init.js`: новый хелпер `putGaipConfig(siteId, sections)`: `cfg = clone(D.gaipConfig)`
  (массив → `{}`), `Object.assign(cfg, sections)`, strip трёх программных ключей (как сегодня `:263-265`, `:812-814`,
  `:1757-1759`), PUT с `base_version: D.gaipConfigVersion`; на 200 — `D.gaipConfig = data.config; D.gaipConfigVersion = data.version`;
  на 409 — `D.gaipConfig = data.config`, повтор с теми же `sections` один раз. Хелпер читает статус ответа сам
  (`apiFetch`, `:171-181`, возвращает `r.json()` без статуса — не менять его, чтобы не трогать чужие вызовы).
  Четыре формы переводятся на хелпер: Site (`:321-324`, `sections = { location, irrigation, weatherOverride }`),
  Turf (`:819-822`, `{ turf }`), импорт бандла (`:1622-1624`, `{ turf, location, pgr }` — сегодня шлёт только их;
  с переносом ключей на сервере это допустимо), Traffic (`:1762`, `{ traffic }`). Форма Site сегодня шлёт
  `Promise.all([PATCH sites, PUT config])`; PATCH со сменой координат очищает программу и увеличивает `version`
  (observer M0), поэтому параллельный PUT получит 409 на каждом сохранении с новыми координатами. Сделать
  последовательно: PATCH → взять `data.configs.gaip.version` из ответа `sitePayload()` → PUT. Форма Turf
  (PUT + PATCH `soil_texture_override`) — PATCH без координат версию не двигает; сделать последовательно для
  единообразия. Зеркала в `localStorage` (`:333-340`, `:831-836`, `:1626-1640`) остаются.
- `assets/onboarding-wizard.js` (`:569-586`) и `assets/site-setup-wizard.js` (`:1286-1310`) — без изменений:
  `base_version` не шлют, сервер (M0, правила 1–2) сохраняет всё, чего они не прислали.

**Проверка.** E2E **B зелёный** (после Generate в старой вкладке Plan в базе `ammonium_acetate`; в логе запросов
Plan — PUT с `base_version`, ответ 409, повторный PUT, 200); A, C зелёные. Новый e2e-сценарий **S1**: вкладка
Settings открыта, в другой вкладке Plan > Generate, затем в Settings сохранить Turf — в базе программа на месте и
`turf` из формы (вопрос 6 плана дефектов). Jest: `tests/gh371-d01-coordinate-invalidation.test.js:539-549`
(regex на строку PUT в `settings-init.js`) и `tests/gh394-traffic-schedule-persisted-and-derived.test.js:337`
(то же для Traffic) — обновить на новую строку вызова; `:241` (тело прямого PUT на Plan несёт stamp) — проходит,
тело не меняется. Новый jest `tests/gh439-plan-put-conflict.test.js` (~4): очередь; 409 → повтор с патчем поверх
свежего конфига; второй 409 → без записи; ответ 200 обновляет `GAIP_SITE_CONFIG_VERSION`.

**Провал.** B: в базе `slan` после Generate; в логе два параллельных PUT с одинаковым `base_version`; Settings > Site
с новыми координатами показывает «Save failed».

**Размер.** 1.5 дня.

### M3 — `sample-persistence.js`: ярлык-ID не уходит на сервер

**Меняется** (`assets/sample-persistence.js`):

- `fetchSamplesFromServer()` `:388-389`: `label: (sample.summary && sample.summary.site_name) || ''` вместо `|| siteId`.
  `SM.getActiveSiteLabel()` (`sample-manager.js:2428`) при пустом ярлыке показывает ID — как сегодня.
- `syncSiteListToServer()` `:488-522`: в `toSync` ярлык `label === id ? '' : label` — тот же гвард, что в
  `site-config-persistence.js:141-143`.

**Проверка.** Jest `tests/gh439-registry-labels.test.js` (~3): при упавшем `GET /api/sites` регистр из проб не
несёт ярлык = ID; тело `POST sites/sync` не содержит `label` равного ключу. E2E E — зелёный уже после M0; после M3
в логе `E labels the page wanted to push` — пустые ярлыки. Фильтр тела в E (`route.continue({postData})`) можно
снять: сервер имена не принимает.

**Провал.** В теле `sites/sync` ярлык совпадает с ключом.

**Размер.** 0.5 дня.

### M4 — мастер на Reports-страницах и таймзона новых сайтов

Два пункта за пределами таблицы анализа, без которых симптом «мастер появился» и «Сидней» остаётся видимым.

- **Мастер на Reports.** `site-setup-wizard.js:126-155` читает `GAIP_WIZARD_CONFIG.wizardComplete`; этот объект
  инжектирует только `layouts/app.blade.php:41-49` (страница `/hub`). `reports/export|forensic|scenarios.blade.php`,
  `morning-briefing.blade.php`, `stadium.blade.php` его не задают, поэтому там мастер показывается по `localStorage`
  (`gilba_wizard_complete`, `gilba_turf_profiles`), а не по базе: чистый браузер видит мастер даже при целом
  `wizard` в базе. Вынести блок `@php … $wizardState …` и `window.GAIP_WIZARD_CONFIG = …` из `layouts/app.blade.php`
  в partial и подключить в пяти views. Это же делает стадия 2 полного плана для `gaipConfig`; здесь — только
  `GAIP_WIZARD_CONFIG`.
- **Таймзона.** `onboarding-wizard.js:602` и `site-setup-wizard.js:1218`: `timezone: 'Australia/Sydney'` →
  `Intl.DateTimeFormat().resolvedOptions().timeZone || null`. Settings > Site селект `#stg-timezone`: пустая опция
  при `timezone = NULL` (анализ: сейчас показывается первая опция «Australia — Sydney / Melbourne» и сохраняется при
  любом сохранении формы). Решение 3 полного плана.

**Проверка.** E2E **S2**: чистый контекст, `/reports/export` при `wizard.complete = true` в базе — оверлей
`#gaip-wizard-overlay` не появляется; при `wizard` отсутствующем — появляется. `gh407-wizard-nz-live.test.js`
(существующий) зелёный. PHPUnit: `POST /api/sites` без `timezone` → `NULL`, не `Australia/Sydney` (проверить, что
`store()` не подставляет дефолт — по коду `:36-77` не подставляет).

**Провал.** Оверлей на `/reports/export` при целом `wizard`; новый NZ-сайт с `Australia/Sydney`.

**Размер.** 0.5–1 день.

### M5 — ремонт уже испорченных строк

Полный план, стадия 4 и раздел 6 — дословно: SQL-выборки, `php artisan sites:repair-config --dry-run` / `--apply`,
правила (`wizard` и таймзона автоматически, имена — только отчёт, F-двойники — только отчёт). Эта работа одинакова
для обоих путей и переживает переход. 1 день.

Порядок выполнения: M0 → M1 → M2 → M3 → M4 → M5. M3 и M4 независимы от M1–M2 и могут идти раньше, если нужно
быстро закрыть E и мастер на Reports.

---

## 4. Что это чинит — по путям анализа

| Путь анализа | Механизм сегодня | Что закрывает | Как |
|---|---|---|---|
| 1 / H1 — весь конфиг целиком, `wizard` исчезает, `nProgram` → DOM-умолчание | `pushConfigsToServer()` шлёт снимок «first visit» всех сайтов при позднем `GET /api/sites` | M0 + M1 | M0: `wizard` и все отсутствующие ключи переносятся из базы. M1: снимок не помечает сайт грязным → PUT не уходит вообще; pull заменяет локальную копию целиком |
| 2 / B — методология откатывается к состоянию вкладки Plan | `persistSiteConfigPatch()` шлёт `GAIP_SITE_CONFIG` целиком | M0 + M2 | `base_version` устарел → 409 → патч поверх свежего конфига → повтор |
| 3 / E — имя → ID у всех сайтов с пробами | `syncSiteListToServer()` с `label = siteId` → `syncRegistry()` пишет `name` | M0 (+ M3) | Сервер: ID-форма имени = пустое имя. Клиент: ярлык не строится из ID |
| 4 / F — новый сайт-двойник с `Australia/Sydney` | `syncRegistry()` создаёт строку для неизвестного ID | M0 | Ветка создания удалена |
| H2 — старая копия чужого сайта пушится | `pushConfigsToServer()` шлёт все ключи `_configs` | M1 | Пушатся только грязные сайты; pull заменяет неграшные копии целиком |
| Settings шлёт клон `D.gaipConfig` (вопрос 6 плана дефектов) | клон на момент загрузки страницы | M0 + M2 | 409 → секция формы поверх свежего конфига |
| Мастера шлют `{turf, location, wizard}`, стирая остальное | `_persist()`, `persistWizardState()` | M0 | Перенос отсутствующих ключей; слияние по полям в `turf` |
| `my_site` из `migrateDefaultSite` | `sites/sync` создаёт | M0 | Не создаёт; `PUT /sites/my_site/config` не уходит (не грязный) |
| Мастер на Reports при целом `wizard` | нет инжекта `GAIP_WIZARD_CONFIG` | M4 | Инжект |
| Таймзона `Australia/Sydney` у новых сайтов | оба мастера | M4 (новые), M5 (старые) | Таймзона браузера; ремонт |
| Уже испорченные строки | — | M5 | Ремонт |

---

## 5. Что остаётся сломанным после этого пути

Точный список. Это половина сравнения.

1. **Механизм остаётся.** DOM → локальная копия → сервер по-прежнему существует; его сдерживают три правила
   (`markDirty` только из патч-функций, пуш только после pull, `base_version`). Новый писатель, который обойдёт
   `markDirty()` или вызовет `pushConfigsToServer()` после ручного `_dirty[id] = true`, вернёт дефект. Структурный
   тест (раздел 10) пинит, что `_dirty[` присваивается только внутри `markDirty()` и что `markDirty(` вызывается
   ровно из трёх функций. Это защита от рецидива по строке кода, не по конструкции.
2. **Программа из устаревшей вкладки Plan сохраняется с устаревшим штампом.** В сценарии B после 409 методология
   AA остаётся, но программа посчитана под SLAN (`meta.methodology = SLAN`) и ложится рядом с AA. Проверка на
   чтении (GH-377) её отвергнет, и при следующей загрузке Plan покажет состояние «regenerate». Данные не теряются;
   один лишний Generate. Полный план закрывает это перечитыванием конфига перед Generate (стадия 1).
3. **Правки легаси-формы на `/hub` не сохраняются** (решение 1). То же в полном плане.
4. **Локальная копия по-прежнему кормит расчёт до прихода pull.** На hub-странице `restoreConfig()` в 800 мс берёт
   копию из `localStorage` прошлой сессии; если Settings меняли на другом устройстве, эта загрузка считает по
   старым значениям, следующая — по новым (pull заменил копию). `location-preloader.js` так же подставляет
   координаты из `localStorage` до pull. В базу это не пишется. Полный план убирает это в стадии 2.
5. **Неудавшийся push не повторяется после перезагрузки.** `_dirty` живёт в памяти страницы; если PUT упал по сети,
   при следующей загрузке pull заменит локальную копию серверной, и сгенерированная программа потеряна — её нужно
   сгенерировать заново. Сегодня такой push повторяется неявно при следующем триггере. Офлайн не поддерживается,
   но это новое поведение при обрыве связи.
6. **Второй 409 подряд — запись отброшена молча** (только `console.warn`). Два человека, жмущие Generate на одном
   сайте в одну секунду. Полный план: патч не конфликтует по определению.
7. **`POST /api/sites/sync` продолжает уходить при каждом сохранении проб** (`sample-persistence.js:292`) и
   писать `modified_by_user_id`. Безвредно, но это ещё один фоновый запрос состояния.
8. **`saveLocationToServer()` (W3) и кнопка Save на `/hub`** остаются: PATCH координат из локальной копии по клику
   на странице, которую никто не открывает. Гвард iframe есть; прямой заход на `/hub` — нет.
9. **Мастера всё ещё шлют объект, собранный на клиенте** (`buildMergedSiteConfig()` из локальной копии); сервер
   защищает остальные ключи, но `hoc`/`nProgram` внутри `turf` при повторном прохождении мастера на hub-странице
   приходят из локальной копии на момент загрузки (после M1 она свежая на момент pull).
10. **Во время недоступности `GET /api/sites`** регистр сайтов показывает ID вместо имён (только отображение).
11. **`version` — на второй записи в базу через `PUT` без `base_version`** (мастера, `gssh`) конфликт не
    обнаруживается. Документировано, не дефект: эти писатели — первая запись для нового сайта.
12. **Пробы (W40)** — план по пробам, как и в полном плане.
13. **`gssh`** — вне области, как в полном плане.
14. Из 42 позиций инвентаря полного плана (раздел 5.1) здесь меняются 15: W1, W4, W10, W11, W12, W14, W15, W17,
    W19, W21, W22, W32, W34, W38, W39. Остальные 27 остаются как есть. Каждая следующая правка
    `site-config-persistence.js` должна учитывать `_dirty`/`_pendingPatches`.

---

## 6. Время (та же основа, что в полном плане: один разработчик на Opus, с тестами, без ревью)

| Шаг | Дни | Общий с полным планом |
|---|---|---|
| M0 сервер | 1.5–2 | частично: `syncRegistry`, тесты sync, `version` переживают; гвард PUT — до стадии 3 |
| M1 `site-config-persistence.js` | 2 | нет: слой `_dirty`/`_pendingPatches` удаляется в стадии 2 |
| M2 Plan + Settings | 1.5 | частично: очередь и разбиение форм на секции переживают; 409-повтор — нет |
| M3 `sample-persistence.js` | 0.5 | нет: функция удаляется в стадии 2 |
| M4 мастер на Reports + таймзона | 0.5–1 | да |
| M5 ремонт | 1 | да |
| Живые проверки (e2e GH-439 все сценарии, парити на трёх фикстурах, ручной обход Settings/Plan/Reports) | 1–1.5 | — |

Итого: **7–8 дней разработки + 1–1.5 дня живых проверок**; ядро без общих шагов (M0–M3) — 5.5–6.5 дней.
Полный план: 11–13 + 2–3.

---

## 7. Чем рискуем

Во время работы:

| Шаг | Риск | Чем ловится |
|---|---|---|
| M0 | Перенос отсутствующих ключей воскрешает программу, которую `resolveGaipConfigWrite()` намеренно очистил при смене координат | PHPUnit «PUT без программных ключей + новые координаты → в базе программы нет»; `GH371CoordinateInvalidationTest` (15) |
| M0 | Observer `saving` двигает `version` при записи `gssh`, `analysis_cache` и других namespace — безвредно, но `base_version` от hub-страницы для `gaip` сравнивается только с `gaip`-строкой (уникальность `site_id + namespace`) | PHPUnit |
| M0 | Миграция на проде: колонка добавляется к живой таблице | `--dry-run` не бывает; таблица маленькая (одна строка на сайт и namespace) |
| M1 | Замена локальной копии целиком при pull меняет то, что видят `word-export.js`/`daily-dashboard.js` через `getConfig()` на первой загрузке после Settings с другого устройства — теперь видят новое. Это исправление, но парити-фикстуры могли быть сняты со старого поведения | `npm run test:e2e` на трёх фикстурах |
| M1 | 409-повтор внутри 2-секундного debounce и `saveCurrentSiteConfig()` при переключении сайта в раннере экспорта: pull ответ и снимок гонятся за `_configs[id]` | jest-тест «снимок между merge и push не теряет патч»; парити-харнесс |
| M1 | `seedFromInjectedConfig` (`:1332`) на `/hub` кладёт конфиг без `wizard` (`SKIP_KEYS`) — локальная копия без `wizard` до pull; с M1 это не уходит на сервер | H1 |
| M2 | Форма Site: PATCH → PUT последовательно вместо `Promise.all` — сохранение на ~50 мс дольше; если PATCH упал, PUT не делается (сегодня делается) | ручная проверка Settings > Site, `gh404-settings-location-required-live.test.js` |
| M2 | Очередь в `persistSiteConfigPatch()`: если один PUT завис, следующие ждут; `fetch` без таймаута | jest на очередь; `console.warn` при 409 |

После работы:

- Любая новая функция, пишущая конфиг с hub-страницы через `pushConfigsToServer()`, обязана идти через `markDirty()`.
  Без структурного теста это соглашение, с ним — падающий тест.
- `base_version` защищает только писателей, которые его шлют. Новый писатель без `base_version` снова может
  переписать чужую запись. PHPUnit фиксирует, что PUT без `base_version` принимается — это намеренно; менять на
  «обязателен» можно после M2, отдельным решением.
- Шум в логе: `site-config.put` на каждый PUT. После M1 фоновых PUT на загрузку нет, объём — по числу реальных
  сохранений.

---

## 8. Что придётся выбросить, если полный план всё же будет сделан

| Сделано здесь | Судьба в полном плане | Дни, потраченные дважды |
|---|---|---|
| M0: `guardGaipConfigWrite()`, правила 1–4 на PUT, `GH439PutGuardTest` | Полный план держит гвард на PUT до стадии 3, затем PUT → 410 и гвард с тестами удаляются. Логика слияния по секциям переезжает в `patchConfig()` почти дословно | ~0.5 |
| M0: `version` + observer + `base_version` | Не нужны PATCH-намерениям; можно оставить как след в логе. Не мешают | 0 (остаётся) или ~0.3 (удаление) |
| M0: `syncRegistry()` без имени и создания + тесты | Стадия 0 полного плана делает то же; стадия 3 удаляет маршрут, тесты становятся «404» | 0 |
| M1: `_dirty`, `_pendingPatches`, `markDirty()`, 409-повтор в push, замена копии при pull | Стадия 2 удаляет `pushConfigsToServer()` целиком; замена копии при pull совпадает с «сервер всегда прав» | ~1.5 |
| M2: очередь PUT на Plan, разбиение форм Settings на секции | Переживают: PATCH-патч отправляется из тех же секций; очередь нужна и PATCH | 0 |
| M2: 409-повтор на Plan и в `putGaipConfig()`, инжекты `version` | Стадия 1 заменяет PUT на PATCH; повтор не нужен | ~0.5 |
| M3 | Стадия 2 удаляет `syncSiteListToServer()` | ~0.3 |
| M4, M5 | Совпадают со стадиями 2 (инжект) и 4 (ремонт) и решением 3 | 0 |
| E2E: переписанные F, B, новые S1, S2 | Остаются | 0 |

Итого дважды: **≈3 дня из 7–8**. Переживает: ≈4–5 дней (сервер `sites/sync`, `version`, секции Settings,
очередь, M4, M5, e2e). Полный план после этого пути короче не на 3 дня, а примерно на 2.5–3.5 (стадия 0
уже сделана в части `sites/sync`; стадия 4 и решение 3 закрыты; стадии 1–3 в полном объёме).

---

## 9. Инвентарь изменений по файлам

| Файл | Строки (рабочее дерево 15.09.2026) | Шаг |
|---|---|---|
| `app/database/migrations/<new>_add_version_to_site_configs.php` | новый | M0 |
| `app/app/Models/SiteConfig.php` | `$fillable`, `casts`, `booted()` | M0 |
| `app/app/Http/Controllers/SiteController.php` | `:80-151` `syncRegistry`; `:318-373` `updateConfig`; `:437-548` `resolveGaipConfigWrite` (возврат флага); `:601-622` `sitePayload`; import `Log` | M0 |
| `app/tests/Feature/SiteApiTest.php` | `:115-148`, `:194-227` | M0 |
| `app/tests/Feature/GH439PutGuardTest.php`, `GH439SyncRegistryTest.php` | новые | M0 |
| `assets/site-config-persistence.js` | `:268-310`, `:315-421`, `:1174-1236`, `:1808-1846`, `:1851`, `:1857-1866`, `:1896-1913`; новые переменные и `markDirty()` | M1 |
| `tests/gh377-program-input-invalidation.test.js` | `:807-960`, один тест | M1 |
| `tests/gh439-config-push-gating.test.js` | новый | M1 |
| `app/resources/views/plan.blade.php:28`, `settings.blade.php:966`, `layouts/app.blade.php:38`; `PageController.php:33-34`, `SettingsController.php:18` | инжект `version` | M2 |
| `assets/nutrition-calendar.js` | `:2712-2792` | M2 |
| `assets/settings-init.js` | `:171-181` (не менять), `:240-345`, `:795-840`, `:1600-1640`, `:1745-1770`; новый `putGaipConfig()` | M2 |
| `tests/gh371-d01-coordinate-invalidation.test.js:539-549`, `tests/gh394-traffic-schedule-persisted-and-derived.test.js:337` | regex на строку PUT | M2 |
| `tests/gh439-plan-put-conflict.test.js` | новый | M2 |
| `assets/sample-persistence.js` | `:388-389`, `:488-522` | M3 |
| `tests/gh439-registry-labels.test.js` | новый | M3 |
| `app/resources/views/partials/<wizard-config>.blade.php` (новый), `layouts/app.blade.php:15-49`, `reports/export|forensic|scenarios.blade.php`, `morning-briefing.blade.php`, `stadium.blade.php` | инжект `GAIP_WIZARD_CONFIG` | M4 |
| `assets/onboarding-wizard.js:602`, `assets/site-setup-wizard.js:1218`, `settings.blade.php` (`#stg-timezone`) | таймзона | M4 |
| `app/app/Console/Commands/RepairSiteConfigs.php` | новый (полный план, стадия 4) | M5 |
| `tests/e2e/gh439-config-reset-live.test.js` | F, B (`test.failing` до M2), H1 (`test.failing` до M1), новые S1, S2 | M0–M4 |
| `docs/instructions.md` | changelog | все |

---

## 10. Тесты

### Новые

- `app/tests/Feature/GH439PutGuardTest.php` (~12): отсутствующие `wizard`/`traffic`/`irrigation`/`alertContacts`
  переносятся; `alertContacts: []` в запросе заменяет; `turf` без `hoc` сохраняет `hoc` из базы; `turf.species: ""`
  при непустом → значение базы + `Log::warning` (через `Log::spy()`); `location.lat: null` при непустом → значение
  базы; PUT без программных ключей при смене координат → программа очищена, не перенесена; `base_version` равен →
  200, `version` +1; не равен → 409 с текущим конфигом, строка не изменилась; без `base_version` → 200; `PATCH
  /sites/{id}` со сменой координат двигает `version`; PUT `gssh` — замена целиком, перенос не применяется;
  `viewer` → 403 (как сегодня).
- `app/tests/Feature/GH439SyncRegistryTest.php` (~4): `label = id` → имя не меняется; UUID-форма → не меняется;
  неизвестный ID → не создан, `saved: 0`, `skipped: 1`; обычный ярлык → переименован (сегодняшнее поведение).
- `tests/gh439-config-push-gating.test.js` (~9, по образцу `bootWithServer()` из gh377): (1) pull задержан — после
  3.6 с снимок в `_configs`, ноль PUT; pull пришёл — копия заменена серверной (`wizard`, `nProgram: 200`), ноль
  PUT; (2) `mergeConfig()` до pull — ноль PUT; после pull — один PUT для этого сайта, тело = серверный конфиг +
  патч, `base_version` из pull; (3) `gaip:site-changed` → `saveCurrentSiteConfig()` → ноль PUT; (4)
  `gaip:analysis-complete` после `mergeConfig({alertContacts})` — тело PUT содержит `alertContacts`; (5) 409 →
  копия из тела 409, патч поверх, один повтор с новой версией, 200; (6) второй 409 → нет третьего PUT, `_dirty`
  очищен, `warn`; (7) pull упал (500) → за 30 с ноль PUT при `mergeConfig()`; (8) H2: старая копия чужого сайта
  в `localStorage` → после pull заменена, ноль PUT; (9) структурный: `_dirty[` присваивается только в `markDirty()`;
  `markDirty(` вызывается ровно из `mergeConfig`, `setCompanionSpecies`, `setMultiSiteTurfEnabled`;
  `saveCurrentSiteConfig` не содержит `pushConfigsToServer(`.
- `tests/gh439-plan-put-conflict.test.js` (~4): очередь сериализует три `persistSiteConfigPatch()`; 409 → повтор с
  патчем поверх конфига из 409; второй 409 → без записи; 200 обновляет `GAIP_SITE_CONFIG_VERSION`.
- `tests/gh439-registry-labels.test.js` (~3): см. M3.
- `tests/e2e/gh439-config-reset-live.test.js`: F → «не создан»; H1 и B — `test.failing` до M1/M2, затем обычные;
  S1 (Settings после чужого Generate — программа цела); S2 (мастер на `/reports/export` по базе, не по
  `localStorage`); фильтр тела в E снимается после M0.

### Существующие, которые придётся менять

| Файл | Тестов | Что |
|---|---|---|
| `app/tests/Feature/SiteApiTest.php` | 2 из 30 | `sync` больше не создаёт: создать сайт фабрикой, затем sync/PUT |
| `tests/gh377-program-input-invalidation.test.js` | 1 из 58 | «сервер старше по `savedAt` → локальный `turf` сохраняется» → «сервер заменяет целиком, если сайт не грязный» |
| `tests/gh371-d01-coordinate-invalidation.test.js` | 2 из 30 | regex на строки PUT в `settings-init.js` (`:539`, `:547`) |
| `tests/gh394-traffic-schedule-persisted-and-derived.test.js` | 1 из 31 | regex на строку PUT формы Traffic (`:337`) |
| `tests/gh385-…`, `b35fix504`, `cotula-*`, `hoxton-climate-normals-…`, `gh322b`, `gh378` | 0 | не трогаются: snapshot/restore/cascade не меняются |
| `app/tests/Feature/GH371CoordinateInvalidationTest.php` | 0 из 15 | `resolveGaipConfigWrite()` не тронут |

Итого затронуто ≈ 6 существующих jest и 2 PHPUnit против ≈ 60–80 jest и ≈ 20 PHPUnit в полном плане.

Полные прогоны (`npx jest`, `php artisan test`) — после каждого шага. Живая проверка — `GILBA_E2E=1 npx jest
tests/e2e/gh439-config-reset-live.test.js --runInBand --testTimeout=600000` и `npm run test:e2e` (+`:burns`, `:slan`)
после M1 и после M2. Замеры — только jest-тестами, без разовых скриптов.

---

## 11. Решения продукта, нужные этому пути

1. **Правки в легаси-форме `/hub` перестают сохраняться** (после M1). Рекомендую да — то же решение 1 полного
   плана; без него минимальный путь невозможен, потому что снимок этой формы и есть путь 1.
2. **`POST /api/sites/sync` не создаёт сайты и не принимает ID-форму как имя.** Рекомендую да. Альтернатива —
   оставить создание с `timezone = NULL` — не рекомендую: это единственный путь, которым сайт появляется без
   мастера и без координат.
3. **`version` как колонка (миграция) или `synced_at` как строка-токен.** Рекомендую колонку: `synced_at` —
   секундная точность, две записи в одну секунду из разных вкладок неразличимы. Если миграция на проде
   нежелательна — `synced_at` с документированной дырой в одну секунду.
4. **Поведение Plan на 409:** молча повторить с программой поверх свежего конфига (рекомендую) или показать
   сообщение «настройки изменены в другой вкладке, сгенерируйте заново». Повтор не теряет данные; программа с
   устаревшим штампом всё равно будет отвергнута на чтении (раздел 5, п. 2).
5. **`base_version` — необязательный** (рекомендую в этом плане) или обязательный после M2 (тогда мастера тоже
   должны читать версию; +0.5 дня).
6. **Таймзона из браузера + пустая опция в Settings** — решение 3 полного плана. Рекомендую да.
7. **Ремонт строк (M5) — как в полном плане:** `wizard` и таймзона автоматически, имена вручную. Рекомендую да.
   Отображательное правило «мастер не показывать, если есть вид и координаты» вместо ремонта — не рекомендую:
   оно прячет отсутствие `wizard` в базе, а не восстанавливает его.
8. **`gssh` вне области.** Как в полном плане.

---

## 12. Сравнение двух путей

| | Минимальный (этот план) | Полный (`PLAN-GH439-site-config-db-only-RU.md`) |
|---|---|---|
| Что чинится | Все четыре пути анализа, H2, клон Settings, мастера, `my_site`, мастер на Reports, таймзона, ремонт | То же |
| Что остаётся | Механизм DOM → копия → сервер под тремя правилами; программа из устаревшей Plan с устаревшим штампом; расчёт первой загрузки по старой копии; push без повтора после перезагрузки; молчаливый отброс второго 409; `sites/sync` фоном; W3/W7 на `/hub` | Ничего из путей анализа; остаются W40 (пробы) и `gssh` |
| Время | 7–8 дней + 1–1.5 живых | 11–13 + 2–3 живых |
| Правки в существующих тестах | ≈ 6 jest, 2 PHPUnit | ≈ 60–80 jest, ≈ 20 PHPUnit |
| Риск во время работы | Средний в M1 (гонки push/pull/снимок в 1900-строчном модуле с таймерами); низкий в остальном | Высокий в стадии 2 (порядок событий загрузки, заглушки на Reports, регистр без `sites/sync`) |
| Риск после работы | Рецидив через новый писатель, обошедший `markDirty()`/`base_version`; защита — структурный тест и лог | Рецидив требует вернуть PUT/`sites/sync` — структурный тест ловит по строке маршрута |
| След для следующего инцидента | `site-config.put` с `carried`/`guarded`/409 | `site-config.patch` с ключами патча |
| Цена смены курса потом | ≈ 3 дня выброшено, ≈ 4–5 переживают; полный план после этого — ≈ 9–10 дней вместо 11–13 | — |
| Решения продукта | 1 (легаси-форма), 2 (`sites/sync`), 3 (`version`), 6 (таймзона), 7 (ремонт) — совпадают с полным планом; 4, 5 — только здесь | 9 решений, раздел 7 полного плана |
| Что видно пользователю между шагами | После M1: правки на `/hub` не сохраняются. Иначе ничего | После стадии 2: то же |

---

## 13. Где я расхожусь с документами-источниками

1. **Анализ, «Конфиг целиком / мастер настройки»:** «на `/hub` и Reports-страницах `site-setup-wizard.js` показывается,
   когда `GAIP_WIZARD_CONFIG.wizardComplete` ложно». По коду это верно для `/hub` (`layouts/app.blade.php:41-49`).
   На `reports/export|forensic|scenarios`, `morning-briefing`, `stadium` объект `GAIP_WIZARD_CONFIG` не инжектируется
   ни одним view и ни одним скриптом до завершения самого мастера (`site-setup-wizard.js:1323`); решение о показе
   там принимается по `localStorage` (`gilba_wizard_complete`, `gilba_turf_profiles`, `:141-152`). Потеря `wizard` в
   базе показывает мастер на `/hub`; на Reports мастер показывается чистому браузеру независимо от базы. Отсюда M4.
2. **Полный план, стадия 0:** «H1 зелёный после стадии 0 (`wizard` и `nProgram` на месте после 14 фоновых PUT)».
   `nProgram: "250"` из снимка — непустое значение; гвард стадии 0 (carry-forward и защита пустых identity-полей)
   его не остановит, `nProgram` в списке защищённых полей там нет. `wizard` — да, `nProgram` — нет. H1 в его
   нынешнем виде (`identity()` включает `nProgram`) остаётся красным до стадии 2 полного плана. Здесь — до M1.
3. **Полный план, инвентарь:** «13 писателей в 6 файлах» / «42 позиции в 14 файлах» — не пересчитывала; для этого
   плана существенны 14 позиций (раздел 9).

---

## 14. Открытые вопросы

1. Запускает ли деплой на проде `php artisan migrate`? Если нет — решение 3 склоняется к `synced_at`, или миграцию
   применяют вручную перед M0.
2. Есть ли на проде GH-359 (вопрос 3 анализа)? От этого зависит, повторяется ли E при каждом открытии `/analysis`
   не-админом, и насколько срочен M0.
3. Учитывать ли `climate-normals-service.js`: `tests/hoxton-climate-normals-service-ensure.test.js:144` пинит, что
   `mergeConfig()` оттуда не вызывается. Если когда-то вызовется — пойдёт через `markDirty()` и будет записано;
   это ожидаемо, но подтвердить.
4. Нужно ли сообщение пользователю на 409 в Plan/Settings (решение 4), и где — в стиле `setMsg()` Settings или
   в консоли.

---

## Что трогалось

Только чтение файлов рабочего дерева. Тесты не запускались, dev-стенд и база не открывались, агенты не
запускались, ни один существующий файл не изменён.

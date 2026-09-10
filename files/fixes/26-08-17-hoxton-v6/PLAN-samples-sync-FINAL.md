# PLAN (FINAL) — Lab samples: база данных — единственный источник; браузерная копия удаляется

Независимое ревью первоначального плана аналитика (две саморевизии, 2026-09-10). Тот файл (`PLAN-samples-sync.md`) удалён 11.09.2026: его содержимое целиком вошло сюда, а восемь мест помечены здесь `[ОТМЕНЕНО]` / `[ИСПРАВЛЕНО]`, так что держать рядом отменённую версию значило бы приглашать работать не по тому документу. Ревью выполнено
2026-09-10 только чтением: код рабочего дерева, дамп `dev-db-snapshot-2026-09-10.sql` (разобран скриптом, без
подключения к живой БД), тесты. Ни один файл исходников не тронут, живых проверок и мутаций БД не было, git не
использовался. Пути относительно `/Users/katep/Documents/Work/gilba/gilbahub/`, номера строк — рабочее дерево на
2026-09-10.

Документ самодостаточен: исполнитель работает только по нему. Места, где оригинальный план **отменён или
исправлен**, помечены `[ОТМЕНЕНО]` / `[ИСПРАВЛЕНО]` с причиной. Где я не уверена — написано прямо.

Язык UI, кода, комментариев и changelog — английский (правило проекта); этот документ — русский, потому что его
читает пользователь.

---

## 0. Суть в один абзац

Диагноз плана подтверждён по коду: одна вкладка `/analysis`, одно локальное добавление образца — и
`POST /api/samples/sync` мягко удаляет все остальные образцы этого сайта и типа (`synced: 1, deleted: 14`), потому
что восстановленные с сервера образцы лежат в сторе как `values`, а `sync()` читает только `rawData`, поэтому
keep-list состоит из одного локального образца. Направление зафиксировано пользователем: браузерная копия
удаляется, а не чинится; сервер перестаёт удалять «отсутствующее в снимке» и перестаёт воскрешать мягко удалённые
строки. Стадия 0 (удалить `reconcileMissingSnapshotSamples()`) действительно самостоятельна и закрывает потерю
данных одна. Дальше — по-записные маршруты (в т.ч. отсутствующий `DELETE /api/samples/{id}`), по-записная запись
из хаба, удаление кэша и честное состояние «не удалось загрузить». Ревью нашло: (1) обоснование отказа от UUID
фактически неверно, но само решение можно оставить по другой причине; (2) три пропущенных дефекта — `apiFetch()`
на Settings глотает HTTP-ошибки, ветка `hub-persistence.js` с `gilba_import_active_site` закрыта условием «есть
локальная копия», а моделей для `spray_logs`/`field_log_entries` нет, так что «SoftDeletes на моделях» не
реализуемо в том виде, как записано; (3) удаление воскрешения надо ставить в стадию 2, а не раньше — иначе оно
бессмысленно при живом snapshot-push.

---

## 1. Проверка фактов оригинального плана

| # | Утверждение плана | Итог | Где проверено |
|---|---|---|---|
| 1 | Снимок из браузера — не то, что держит вкладка: восстановленные образцы несут `values`, `sync()` читает только `rawData` | **Верно.** | `sample-persistence.js:435` (`values: pld`), `SampleController.php:171-174` (`$sampleData['rawData'] ?? []` → пропуск), `sample-manager.js:1346` (`rawData \|\| values`), `updateSample()` `:1995` (`{...sample.rawData, ...cleanValues}` — у восстановленного `rawData` нет, получается частичный) |
| 2 | Воспроизведение `synced: 1, deleted: 14` одной вкладкой | **Согласуется с кодом.** Keep-list = только образцы с непустым `rawData` (`:210`), всё остальное с `client_uid IS NOT NULL` в этом (site, type) удаляется (`:437-454`). Строки с `client_uid IS NULL` не трогаются (`:440`). GH-194-guard (`:433-435`) спасает только когда keep-list пуст. | `SampleController.php:159-233, 427-457` |
| 3 | Страница грузится → один push (через `setActiveSite()`) | **Верно.** `_currentSite` стартует как `'default'`, конфиг даёт UUID → `changed` → `gaip:site-changed` → `scheduleSave`. Push безвреден, пока в сторе нет `rawData`-образцов. | `sample-manager.js:2423-2438`, `sample-persistence.js:461-465, 727` |
| 4 | Hub Delete/Clear не доходят до сервера для восстановленных образцов | **Верно, и хуже:** если в сторе есть хоть один локальный `rawData`-образец, Delete одного образца удаляет на сервере *все остальные*, кроме локального. | те же строки |
| 5 | `saveSampleRecord()` воскрешает trashed-строки; уникального индекса нет | **Верно.** `withTrashed()->firstOrNew()` + `restore()` `:366-369`; индекс `samples_site_type_client_uid_idx` неуникальный (`migrations/0001_…:159`). | |
| 6 | `DELETE /api/samples/{id}` не существует; `DataController::destroy()` привязан к `activeSite` и не трогает `site_summaries` | **Верно.** Маршруты `routes/web.php:99-105, 116`; `DataController.php:109-122` — `where('site_id', $activeSite->id)->firstOrFail()`, `$sample->delete()`, summaries не трогаются. | |
| 7 | `POST`/`PATCH` принимают то, что есть у хаба | **Верно с оговорками (раздел 5).** `store()` валидирует `site_id, sample_type, client_uid?, …, payload (present array), notes?`; `update()` — `payload sometimes\|array`, замена целиком (`:279`). Route-model-binding по числовому `id` → хабу нужен `serverId`; у восстановленных он есть в ответе `index()` (`samplePayload()` `:462`), у новых — в ответе `store()` (`201`, `data.id`). | `SampleController.php:66-114, 255-312` |
| 8 | Дамп: 86/144 trashed, 66 в одну секунду | **Верно.** 86 trashed; `2026-07-15 04:29:02` — 66 строк; следующие пики 6 (`07-02`), 4 (`07-10`). | дамп |
| 9 | 20 потребителей браузерной копии и их классификация | **В основном верно; три поправки.** (a) Ключ в `hub-persistence.js` — **`gilba_hub_samples`** (`:237`), а не `gilba_samples`; grep `gilba_samples` по этому файлу пуст, поэтому предложенный в §10 плана source-pin для `hub-persistence.js` **пустой** — заменить на `gilba_hub_samples`/`CONFIG.keys.samples`. (b) Item 4: блок `:2282-2318` (честь `gilba_import_active_site` + `setActiveSite(cfgSite)`) сегодня выполняется **только внутри `if (samples)`** (`:2281`) — при удалении локальной копии его надо вынести из-под условия, иначе он никогда не сработает. Плана это не говорит. (c) Item 14: per-sample turf profile читает не только `word-export.js:6798-6821`, но и `loadSample()` (`sample-manager.js:1452-1478`) — каскад в `GaipTurfProfile.state` и `gaip:turf-profile-change`, т.е. он влияет и на страничный анализ, не только на Word. Оценка «breaks» верна, вес больше заявленного. | |
| 10 | «Только turf profile по-настоящему ломается» | **Верно** в смысле «единственная функция, у которой нет никакого серверного пути». Item 15 («последний выбранный образец») — визуальное изменение, и его не надо путать с GH-386: там пикеры `soil-nutrition-analysis.js` помнят выбор через *свой* ключ localStorage с числовым `samples.id`, к `gilba_samples`/`allActive` это не относится и от изменения не пострадает. | `tests/gh386-…` шапка |
| 11 | `rawData = payload` на восстановлении безопасно только после исчезновения snapshot-push | **Верно, и после стадии 0 тоже.** Без reconcile push не удаляет, но upsert-ит *все* образцы вкладки: с `rawData` у всех 200 каждый event перезаписывал бы серверный payload копией вкладки (last-writer-wins для всех образцов сразу) и пересоздавал удалённые на Data page. Порядок «2 до 3» и атомарность стадии 2 (убрать вызов `sync` из хаба **в том же коммите**, где ставится `rawData = payload`) обязательны. | |
| 12 | Клиент минтит `client_uid` только вида `Soil_1_y6pb` (обоснование отказа от UUID, D-7) | **Неверно как факт.** Три пути минтят label-derived id: «Save as Sample» с введённым именем → `captureFromForm(dataType, sampleName)` → `addSample({id: sampleName})` — id = имя как введено (`sample-switcher-ui.js:111-120`, `sample-manager.js:1764-1765`); CSV-импорт → колонка Sample ID/Name/Zone дословно (`extractSampleId()` `:688-694`, `:1160-1161`); lab-report parser → `addSample({label})` → slug (`lab-report-parser.js:562, 588, 613, 631`; `sample-manager.js:1766-1770`). В дампе: 108 uid вида `Soil_1_xxxx` (пользователь оставил имя по умолчанию), 24 `NULL` (Data page: `client_uid: null`, `data.blade.php:2420`), **12 label-derived** — `'Green 1'`, `'Green 2'`, `'18th Green'`, `'Bore 2'`, `'test'`, `'114'`, `'115'`, `sample_55`, `sample_106`. Вывод для D-7 — в разделе 7. | |
| 13 | Таймер 6000 мс в `hub-orchestrator.js` (GH-243) | **Частично.** Строки `GH-243`/`6000` в файле нет; есть «6s safety fallback» (`hub-orchestrator.js:~7472`) и ожидание `gaip:state-restored` до 1200 мс (`:7502-7510`). Остаточный риск описан верно, ссылка — нет. | |
| 14 | `clearSiteData` жёстко удаляет `spray_logs`/`field_log_entries`; «SoftDeletes на обеих моделях» | Жёсткое удаление — **верно** (`SampleController.php:147-148`, миграция без `softDeletes` `:182-209, 235-253`). «SoftDeletes на моделях» — **нереализуемо как написано: Eloquent-моделей для этих таблиц нет** (`app/app/Models/` — только `Account, Site, Sample, SiteSummary, PrecinctGroup` с SoftDeletes; spray/field — нет моделей вообще). Все обращения — сырые `DB::table()` в 16 местах (`DashboardController:71`, `DataController:37,49`, `SprayLogController:71,90,164,168,180,293,304`, `SampleController:147,148`, `FieldLogEntryController:26,95,115,118`). Кроме того, у `field_log_entries` есть `unique(user_id, client_uid)` (`:250`) — мягко удалённая строка блокирует повторную вставку того же `client_uid`; `FieldLogEntryController::store()` (`:95-118`) ищет существующую сырым запросом и делает `update` — при soft delete он «обновит» trashed-строку, не сняв `deleted_at`. Детали — D-3, раздел 7. | |
| 15 | Settings import — единственный внешний вызов `sync` | **Верно** (`settings-init.js:1761`). Но `apiFetch()` там (`:171-181`) возвращает `r.json()` при **любом** статусе — 4xx/5xx/419 показывают «0 records imported successfully» и редиректят на дашборд. План этого не видит; при ужесточении контракта `sync` (стадия 1) это станет видимым дефектом. | |
| 16 | Пропущено планом: ролевая модель | В `GAIP_HUB_CONFIG` (`layouts/db-shell.blade.php:10-15`) нет флага прав; `canEditSite` = admin/manager/editor (`User.php:63-65`). Сегодня viewer может добавить образец в памяти, push тихо получит 403 (`warn`). После стадии 2 это станет видимой ошибкой на каждую запись. Правило проекта: при новых маршрутах — role check на сервере и скрытие UI. | |
| 17 | Пропущено планом: стадия 0 оставляет усечение payload при Update | `updateSample()` на восстановленном образце даёт `rawData` = только поля формы; `sync()` заменяет payload целиком (`:390`) → ключи, которых нет в форме (`thatch`, `moisture`, `_source`, всё нестандартное из CSV), **тихо теряются**. Это есть сегодня и остаётся между стадиями 0 и 2. Не потеря строки, но потеря полей. | `sample-manager.js:1995`, дамп: payload `id 75` содержит `thatch, moisture` |

Всё, что не перечислено (таблицы §1-§2, §4 плана), проверено выборочно и совпадает с кодом; я не перепроверяла
скрипты проб (они в scratchpad прошлой сессии) — принимаю их результаты как согласующиеся с кодом.

---

## 2. Направление (зафиксировано пользователем, не обсуждается)

- Браузерная копия образцов удаляется, не синхронизируется. Оффлайн не нужен и не планируется.
- Если данные не пришли из БД — страница говорит об этом и предлагает Retry; ничего из localStorage не
  подставляется.
- Сервер не удаляет строки только потому, что их нет в присланном снимке.
- Сервер не воскрешает мягко удалённые строки при совпадении `(site, type, client_uid)`.
- Образцы — первый шаг; конфиги сайтов (`gilba_hub_site_configs`, `site-config-persistence.js`) — отдельная работа
  позже, здесь не трогаются.

---

## 3. Текущее поведение (проверено, сжато)

**Сервер, `app/app/Http/Controllers/SampleController.php`.** `sync()` 116-253: тело `allSites{siteId:{soil|water|tissue|loi:{key:sample}}}`,
`clearSiteData` (bool), `sourceFile`. `clearSiteData` 146-157 — жёсткий `DELETE` spray/field logs + мягкое удаление
всех samples/summaries сайта. Per sample: `rawData` пустой → пропуск (171-174); `_label`/`_zone`/`zone`/`_source`
дописываются в payload (176-203); `client_uid = id ?? key` (205-208); `saveSampleRecord()` 358-425 —
`withTrashed()->firstOrNew` + `restore()` (366-369), `payload` заменяется (390), summary upsert по
`(site, type, lab_date)` (398-420, уникальный индекс `site_summaries:177`), ring 12 (499-518); затем
`reconcileMissingSnapshotSamples()` (232, 427-457). `store()` 66-114 → тот же `saveSampleRecord()` (т.е. upsert с
воскрешением при наличии `client_uid`) + `mergeZoneNameIntoSite()` для soil/tissue/loi (106-109, 520-531).
`update()` 255-312 — пофайлово, `payload` заменяется (279), summary re-upsert; **не** вызывает
`mergeZoneNameIntoSite()`. `index()` 18-64 — `limit` max 200 (23), default 50 (59), все сайты логина (admin — все
сайты вообще, 27-29), сортировка `COALESCE(lab_date, sample_date) DESC, id DESC`.

**Клиент, `assets/sample-persistence.js`.** Boot `restore()` 601-709: `GET sites` → `GET samples?limit=200`
(365) → сборка объектов `{id: client_uid || payload.label || 'sample_'+id, label, date, notes, zoneType, values: payload,
methodologySnapshot, soilTextureSnapshot}` (398-450) → `restoreFromPersistence()` → `setActiveSite(activeSiteId)`
(461-465) → запись в localStorage (467-472). `[]` или ошибка → `onComplete(false)` (368-371, 477-480) →
`restoreFromLocalFallback()` 663-690 — единственное чтение кэша. `finishReady()` 622-627 ставит
`_gaipSamplePersistenceReady` и шлёт `gaip:samples-persistence-ready`. Запись: 11 событий `MUTATION_EVENTS` 719-731
→ 500 мс → `doSave()` 264-311: localStorage → `sites/sync` → `samples/sync` со всем стором (`filterAutoGenSamples()`
316-334 убирает ключи `sample_\d+`). `beforeunload` 744-758 — только localStorage.

**Где загружено.** `sample-manager.js` + `sample-persistence.js`: `analysis.blade.php:114-115`,
`field-log.blade.php:37-38` (**`layouts.app`**, не db-shell — `field-log.blade.php:1`), `hub.blade.php:199-200`,
`reports/{export,scenarios,forensic}.blade.php`. Только `sample-manager.js` (без persistence, in-memory):
`morning-briefing.blade.php:16`, `stadium.blade.php:122`. `hub-persistence.js` (второй кэш `gilba_hub_samples`):
`hub`, три reports. `data`, `plan`, `dashboard`, `settings` — SM не грузят.

**Data page, `app/resources/views/data.blade.php`.** Delete 1265-1281 → `DELETE /api/data/entry/{id}`; ручная форма
POST `/api/samples` с `client_uid: null` (2417-2421); CSV-форма с `client_uid: _parsedCSV.uid || null` (2384);
редактирование `PATCH /api/samples/{id}` (2496); bulk area `PATCH {payload}` (3232-3237).

---

## 4. Стадии — что именно делать

Нумерация тикета: Change log в `docs/instructions.md` заканчивается **GH-399** (delivery, stages 0-1); GH-400 и
GH-401 зарезервированы `PLAN-remaining-defects-RU.md:712` за delivery-работой. **Первый свободный — GH-402**;
перепроверить в момент реализации. Ниже `GH-NNN`. Один тикет, пять коммитов (a)-(e), каждый откатывается сам.

### Стадия 0 — GH-NNN(a) — убрать серверное удаление по снимку. Самостоятельна, идёт первой.

Подтверждаю: ничто в остальных стадиях не требуется для неё и не меняет её. После неё запрос из пробы 2 вернёт
`deleted: 0`. Побочный эффект (уже верный сегодня для восстановленных образцов): hub Delete/Clear не доходят до
сервера ни для каких образцов до стадии 2 — образец возвращается после перезагрузки. Это осознанно: лучше
«не удалилось», чем «удалилось лишнее».

Изменения (один файл + тесты):
1. `SampleController.php`: удалить метод `reconcileMissingSnapshotSamples()` (427-457) и его вызов (232). Строка
   `$deleted += …` уходит; `deleted` в ответе остаётся (его увеличивает только `clearSiteData`).
2. `tests/Feature/SiteApiTest.php`: `test_authenticated_user_sync_reconciles_deleted_samples` (356-445) —
   инвертировать: второй push с одним `green_1` → `deleted: 0`, `green_2` жив, `index` возвращает 2.
   `test_authenticated_user_sync_can_restore_soft_deleted_sample` (447-596) — **не трогать в стадии 0**: он
   удаляет `green_1` через reconcile, чего больше нет. Переписать так: удалить `green_1` явно (пока нет `destroy()` —
   `Sample::find($id)->delete()` в тесте), затем push с `green_1` → **на стадии 0 он ещё воскрешается** (это
   поведение стадии 2 меняет). Проще: в стадии 0 пометить тест `markTestSkipped('GH-NNN(c) removes resurrection')`
   и переписать его в стадии 2. `[ИСПРАВЛЕНО]` — план говорил «инвертировать оба пина», но второй нельзя
   инвертировать до удаления воскрешения.
3. Новые PHPUnit (`tests/Feature/GhNNNSamplesNoSnapshotDeleteTest.php`), красные до фикса:
   - `one_local_sample_must_not_delete_server_samples`: 13 образцов созданы через `POST /api/samples` **с**
     `client_uid` (не через `sync` — `values`-shaped образцы `sync` пропустил бы и не создал; `[ИСПРАВЛЕНО]`
     формулировка плана «13 seeded values-shaped… в одном sync body» неточна), затем `sync` с телом из 13
     `values`-shaped + 1 `rawData` → 14 живых, `deleted: 0`. До фикса: `deleted: 13`.
   - `stale_snapshot_must_not_delete_a_sample_it_never_saw`: A1-A3 через `sync`, A4 через `POST`, re-push A1-A3 →
     A4 жив.
   - `summaries_of_untouched_samples_survive_a_partial_sync`: summary A4 не trashed.
4. Комментарий в коде: `// GH-NNN: …` (не `b35fixNNN`), 1-2 предложения.
5. Changelog: одна запись GH-NNN(a), без атрибуции, коротко.

Запуск: `docker exec gilba_app php artisan test --filter=GhNNN` и полный `SiteApiTest`.

**Что остаётся открытым после стадии 0 и почему это приемлемо:** (i) усечение payload при Update восстановленного
образца (факт 17) — не потеря строки, закрывается стадией 2; (ii) stale-вкладка с `rawData`-образцом всё ещё
воскрешает удалённый на Data page образец — закрывается стадией 2; (iii) hub Delete не доходит до сервера —
стадия 2. Поэтому стадии 0→2 надо пройти подряд, не растягивая.

### Стадия 1 — GH-NNN(b) — серверные маршруты. Ставится одна; хаб пока пушит снимки (уже безвредно).

1. **`SampleController::destroy(Request, Sample $sample)`** + маршрут `Route::delete('/samples/{sample}', …)->name('samples.destroy')`
   рядом с `:103`. Логика: `abort_unless(canEditSite($sample->site), 403)`; в транзакции: summaries с
   `source_sample_id = $sample->id` — если есть другой живой образец того же `(site, type, lab_date)`, перевести
   `source_sample_id`/`summary` на него (пересобрать `buildSummaryPayload()`), иначе мягко удалить summary;
   `$sample->delete()`; проставить `deleted_by_user_id`, `delete_source = 'hub' | 'data-page' | 'import-clear'`
   (пункт 4). Ответ `{success: true, data: {id}}`. Тесты: 403 для viewer, 404 для чужого/trashed, summary
   re-point и soft-delete, `delete_source` записан.
2. **Data page на новый маршрут**: `data.blade.php:1270` → `/api/samples/{id}`; удалить `DataController::destroy()`
   и маршрут `:116`. `[ИСПРАВЛЕНО]` план говорил «route it for the Data page too» — правильнее удалить старый,
   чтобы удаление было в одном месте (правило «без дублирования»). Проверить: bulk-delete на Data page
   (`dat-delete-bulk-btn`, `:1297`) идёт через тот же `deleteEntry()` — да, через `deleteEntry(id, section, tr)`.
3. **Общий helper display-зоны**: вынести карту `zoneDisplayMap` (`:192-201`) в приватный метод
   `applyZoneMeta(array $payload, ?string $label, ?string $zone): array`, использовать в `sync()`, `store()`,
   `update()`, чтобы хаб и Data page давали одинаковый `payload.zone`. `update()` дополнительно вызывает
   `mergeZoneNameIntoSite()` при `payload._label` для soil/tissue/loi (D-6).
4. **Атрибуция + кап** (D-2): миграция `add_delete_attribution_to_samples` — `deleted_by_user_id` (unsignedBigInteger
   nullable), `delete_source` (string 32 nullable). В `sync()`'s `clearSiteData`: отказ (422) если
   `count(allSites) > 1`; `Log::info` с site_id, count, user на каждый clear и на каждый `destroy()`. Кап «> 20 строк
   и > 50 % site/type» применять к будущему batch-delete; для явного import-clear — не применять (он и есть
   «заменить всё»). `[ИСПРАВЛЕНО]` план формулировал кап и для `sync`'s clear — это противоречит его смыслу.
5. **`sync` сужается**: `clearSiteData` принимает `bool` (как сейчас) **или** `{site_id}`; при `true` с более чем
   одним сайтом — 422. `allSites` с более чем одним сайтом при clear — 422. `[ИСПРАВЛЕНО]` план менял тип на
   `{site_id}` — не ломать существующего вызова с `true`, принимать оба.
6. **`index()` cap**: поднять `max` до 2000 и добавить в ответ `meta: {total, returned}` (count по тому же query до
   limit). Клиент (стадия 3) при `returned < total` показывает состояние ошибки «loaded N of M» — не работает
   тихо на подмножестве. `[ИСПРАВЛЕНО]` план предлагал «per site» — хабу нужны образцы **всех** сайтов сразу
   (combined export по сайтам, `word-export-combined.js`), один запрос проще; `?site_id=` уже поддерживается для
   страниц, которым нужен один сайт.
7. **`settings-init.js apiFetch()`** (`:171-181`): `if (!r.ok) throw` с телом ошибки; в обработчике импорта
   (`:1773-1777`) показывать сообщение сервера. Без этого п.5 даёт «0 records imported successfully» + редирект.
   **Добавлено ревью** (факт 15). Это единственное изменение в `settings-init.js` на этой стадии.
8. **D-3 — мягкое удаление логов при `clearSiteData`** (пользователь принял; реализация **не** «SoftDeletes на
   моделях», факт 14): миграция `deleted_at` nullable timestamp на `spray_logs` и `field_log_entries`;
   `clearSiteData` → `update(['deleted_at' => now()])` вместо `delete()`; **все 16** сырых запросов получают
   `->whereNull('deleted_at')` (список в факте 14); `FieldLogEntryController::store()` при найденной trashed-строке
   с тем же `(user_id, client_uid)` пишет `deleted_at => null` в `$record`; `SprayLogController::destroy()` — оставить
   как есть (пользовательское удаление одной записи вне scope, «не расширять scope фикса»), но записать.
   Тест: import-clear → логи не видны в `/api/spray-log`, `/api/field-log/entries`, Data page, dashboard;
   повторная запись field-log с тем же `client_uid` не падает на unique.
   **Открытый вопрос, не решение** (раздел 9, F-9): бандл импорта вообще не содержит логов (в `settings-init.js`
   нет ни `spray`, ни `field_log`), т.е. «импорт образцов» удаляет логи, которые ничем не заменяет. Мягкое удаление
   делает это обратимым; вопрос «а надо ли трогать логи вообще» — пользователю, одной строкой.
9. Тесты стадии 1 — раздел 10.

### Стадия 2 — GH-NNN(c) — хаб пишет по-записно; сервер перестаёт воскрешать. Один коммит, атомарно.

Почему воскрешение снимается здесь, а не в стадии 0/1 `[ИСПРАВЛЕНО]` (план держал его в §9.7 как альтернативу):
пока хаб пушит снимок, «не воскрешать» = «создать новую живую строку с тем же `client_uid`» — stale-вкладка всё
равно вернёт удалённый образец, только другим `id`. Разницы в безопасности нет, а инвертировать
`test_…_can_restore_soft_deleted_sample` можно только вместе с новым `destroy()`. Если пользователь хочет раньше —
можно в стадию 1 без вреда; смысл появляется только здесь.

Сервер:
1. `saveSampleRecord()`: `Sample::query()->firstOrNew($attributes)` — **без** `withTrashed()`, без `restore()`.
   Совпадение среди живых → update; trashed-совпадение игнорируется, создаётся новая строка (индекс неуникальный,
   допустимо). Переписать `test_…_can_restore_soft_deleted_sample` в
   `test_sync_and_store_do_not_resurrect_a_deleted_sample`: удалить через `DELETE /api/samples/{id}`, re-push /
   re-POST с тем же uid → старая строка trashed, новая живая, `index` показывает одну.
2. `store()` — без изменений сверх п.1.

Клиент (`assets/sample-persistence.js`, переписать раздел записи; `sample-manager.js` — точечно):
3. **Восстановление**: каждому объекту `serverId: sample.id`; `rawData = payload` **минус** мета-ключи
   (`_label`, `_zone`, `_source`, `_turfProfile`, `zone`), которые поднимаются в `label`, `zoneType`, `source`,
   `turfProfile`; `values` оставить как алиас на переходный период (читается в `sample-manager.js:1346`,
   `hub-persistence.js:1611`) — убрать в стадии 3. Каскад turf profile в `loadSample()` (`:1452-1478`) и чтение в
   `word-export.js:6810` получают `sample.turfProfile` как раньше. `normalized = normalizeValues(rawData, type)`.
4. **`MUTATION_EVENTS` → по-записные обработчики** (снимок больше не собирается, `syncSamplesToServer()`,
   `filterAutoGenSamples()`, `doSave()`-ветка samples удаляются):

   | Событие | Запрос | Тело |
   |---|---|---|
   | `gaip:sample-added`, `gaip:samples-imported` (по `detail.sampleIds`), `gaip:dataImported` (legacy, `:2187`) | `POST /api/samples` на каждый | `{site_id: SM.getActiveSiteId(), sample_type, client_uid: sample.id, sample_date: date, lab_date: date, notes, payload: rawData + {_label: label, _zone: zoneType, _source?: source, _turfProfile?: turfProfile}}` → `sample.serverId = data.id` |
   | `gaip:sample-updated` (`updateSample`, `setZoneType`), `gaip:sample-renamed`, `gaip:sample-turf-profile-changed` (**добавить** — сегодня не в списке) | `PATCH /api/samples/{serverId}` | `{payload: <полный, как выше>, sample_date, lab_date, notes}` |
   | `gaip:sample-deleted` | `DELETE /api/samples/{serverId}` | — |
   | `gaip:samples-cleared`, `gaip:all-samples-cleared` | N × `DELETE` по списку `serverId`, снятому **до** очистки стора (стор уже пуст к моменту события — `sample-manager.js:2066-2089`; обработчик должен взять список из `detail` — **добавить `detail.sampleIds`/`detail.serverIds` в оба события**) | — |
   | `gaip:site-added/renamed/removed` | `POST /api/sites/sync` как сейчас (`syncSiteListToServer()`), **до** первого `POST /api/samples` для клиентского сайта (`exists:sites`) | — |
   | `gaip:site-changed` | **ничего** | — |

   Объекты без `serverId` (ещё не подтверждённый POST) при `update/delete` ставятся в очередь до ответа POST —
   простой per-sample promise chain. Ошибка запроса (4xx/5xx/сеть) → `sample._dirty = {op, error}`,
   `gaip:samples-persistence-error {sampleId, op, status}`; объект не удаляется из стора; UI (стадия 3) показывает
   маркер и Retry. `fetch(..., {keepalive: true})` для тел < 64 КБ; на `pagehide` — flush очереди (best effort).
5. `sample-manager.js`: `addSample()` — `source: sampleData.source || 'manual'`; `deleteSample()`,
   `clearSamples()`, `clearAllSamples()` — кладут `serverId`-список в `detail`. Больше ничего в `sample-manager.js`
   на этой стадии.
6. **Права**: в `layouts/db-shell.blade.php` `GAIP_HUB_CONFIG` добавить `canEditActiveSite: @json($activeSite && auth()->user()->canEditSite($activeSite))`;
   `sample-switcher-ui.js` скрывает Save/Import/Delete/Rename/Set turf profile при `false`; persistence при
   `false` не шлёт записей (защита от 403-шума). **Добавлено ревью** (факт 16, правило прав).
7. **Settings import** остаётся на `sync` с `clearSiteData: true` и одним сайтом — единственный вызов `sync`;
   `sample-persistence.js` больше не знает про `samples/sync`. Jest-guard: ни одно тело запроса из
   `sample-persistence.js` не содержит `allSites` (раздел 10).
8. `setSampleTurfProfile()` — D-4: сериализуется в `payload._turfProfile` при PATCH (п.4), поднимается при
   восстановлении (п.3). Проверить один раз, что `SampleAnalysisController::validatePayload()` (`:281`,
   `foreach UNUSUAL_RANGES`) и `computeNutrients()` не спотыкаются об объектное значение — по коду они читают
   именованные ключи, риск низкий; всё же прогнать `GET /api/samples/{id}/analyse` на образце с `_turfProfile` в
   PHPUnit.

### Стадия 3 — GH-NNN(d) — удалить браузерную копию, добавить состояние ошибки. Ставится одна.

Удаления (по таблице раздела 6): `sample-persistence.js` — `StorageAdapter`, `CONFIG.storageKey`,
`restoreFromLocalFallback()`, `recoverSitesFromLegacyConfig()`, все `_ls.setItem` (470, 574, 654), `beforeunload`,
публичные `clear/getStorageSize*/StorageAdapter`; `hub-persistence.js` — `CONFIG.keys.samples` (237),
`collectSamples()`/`restoreSamples()` (887-907), запись 2167-2169, чтение 2280-2281 и 2317, импорт 2378
(`samples` игнорируется в старом бандле); **блок 2282-2318 сохранить и вывести из-под `if (samples)`** — выполняется
всегда через 200 мс; `dashboard-ui.js:74-88` (штамп; `gilba_wb_water_override` 90-105 **остаётся**);
`settings-init.js:1743-1752` (очистка кэша перед импортом); `gaip-field-log.js:218-283, 336-370` (SiteLoader
записи и fallback-чтения); `sample-manager.js:2166-2184` (b35fix268); `site-config-persistence.js:1492-1503`
(force-save снимка перед reload — **только** запись `gilba_samples`; сама миграция default-сайта остаётся);
`gilba-storage-migrate.js:23, 154` — убрать `gilba_samples` из списков; `values`-алиас из стадии 2 убрать.
Не трогать: `site-data-transfer.js` (правило проекта), `gaip-morning-briefing.js` (legacy, ждёт таймером и без
кэша), `water-balance-analysis.js:1424` (комментарий).

Состояние ошибки — раздел 5. `finishReady()` получает `{source: 'server'|'empty'|'error', count, total?}` и
ставит `_gaipSamplePersistenceReady = true` **во всех трёх** случаях (иначе `turf-profile-controller.js:1283`
никогда не переключит сайт — подтверждено, факт таблицы §4 item 19).

### Стадия 4 — GH-NNN(e), опционально — «Recently deleted» на Data page

`GET /api/samples?trashed=1&site_id=…`, `POST /api/samples/{id}/restore` (`canManageSite`), вкладка на Data page.
Не блокирует ничего. Замечание: после стадии 2 восстановление trashed-строки может создать **вторую живую** с тем
же `client_uid` (если после удаления добавили образец с тем же именем) — `restore` должен это проверять и
отказывать с сообщением, либо переименовывать `client_uid` (`<uid> (restored)`).

---

## 5. Состояние ошибки — «не удалось загрузить» ≠ «образцов пока нет»

| Состояние | Детекция | Стор | UI |
|---|---|---|---|
| **Пусто** | `GET /api/sites` ok **и** `GET /api/samples` → 200, `data: []`, `meta.total === 0` | пуст, разблокирован | существующие empty states (`db-empty-state` в blade, badge switcher «0») — без баннера |
| **Не удалось загрузить** | любой из: HTTP ≠ 2xx (в т.ч. 419), сеть, невалидный JSON, отказ `/api/sites`, `meta.returned < meta.total` | пуст и **заблокирован**: `SM.setReadOnly(true)`; `addSample/updateSample/deleteSample/clearSamples/importFile/importCSV` бросают `Error('Samples are not loaded — retry first')`; persistence ничего не шлёт | баннер в content header db-shell (стиль как у `NutritionCalendar._renderStaleProgramBanner()` — `nutrition-calendar.js:~2172`; `.db-*` классы, SVG-иконка): **"Samples could not be loaded from the server. Nothing has been changed. Retry"** (при частичной загрузке: **"Loaded N of M samples. Retry"**). Retry → `GAIP_SamplePersistence.restore()` заново; успех → баннер снимается, `gaip:samples-persistence-ready {source:'server'}`. На `/reports/*` — кнопка Generate disabled с той же фразой рядом (прецедент GH-377: отказать, а не напечатать пустой документ) |
| **Ошибка записи после успешной загрузки** | 4xx/5xx/сеть на POST/PATCH/DELETE | образец `_dirty`; стор не блокируется | маркер в строке switcher + Retry на образец; при 403 — текст «You don't have permission to edit this site»; при 419 — «Session expired — reload the page» |

Почему это различимо: у пустого состояния нет баннера и стор разблокирован; у ошибки — баннер, блокировка, Generate
disabled. Ничего не остаётся сломанным при ошибке: флаг готовности ставится, события `gaip:samples-restored` **не**
шлётся (нечего восстанавливать), `gaip:site-samples-ready` шлётся `reloadActiveSample()` как обычно (формы
очищаются). Страницы **без** db-shell header (`/field-log`, `/hub`-iframe): баннер рендерится только если слот
найден; иначе `console.warn` + `gaip:samples-persistence-ready {source:'error'}` — для скрытого iframe этого
достаточно, а `/field-log` — legacy `layouts.app` (в нём SM нужен только для списка сайтов, который берётся с
`/api/sites`).

Оценка дизайна плана: достигает цели; поправки — частичная загрузка (`meta.total`) и страницы без слота.

---

## 6. Потребители браузерной копии (проверено; поправки к таблице плана)

Классификация плана подтверждена для items 1-3, 5-13, 15-20. Поправки:

- **Item 4** (`hub-persistence.js`): ключ `gilba_hub_samples`; блок `2282-2318` под `if (samples)` — вывести
  из-под условия (см. стадию 3). Source-pin для этого файла — на `gilba_hub_samples` / `keys.samples`.
- **Item 14** (turf profile): читается ещё и `loadSample()` каскадом (`:1452-1478`) — влияет на страничный анализ
  (SpeciesController, disease). Персистить обязательно (D-4 принято).
- **Item 15**: GH-386-память пикеров — другой механизм, не затрагивается.
- **Item 6** (dashboard re-run stamp): удалить безопасно — `GAIP_HUB_CONFIG.activeSiteId` в iframe + серверный
  pointer из `PATCH /api/active-site` (`dashboard-ui.js:36-42`) достаточны; live-проверка в разделе 10.

---

## 7. Восемь решений пользователя — проверка по коду

| # | Решение | Проверка | Вердикт |
|---|---|---|---|
| D-1 | Стадия 0 сейчас, отдельным коммитом | Независимость подтверждена (раздел 4). | **Безопасно. Делать.** |
| D-2 | Атрибуция + кап bulk-delete | Колонки аддитивны; кап **не** применять к явному import-clear (иначе импорт в сайт с > 20 образцами невозможен). | **Безопасно с поправкой** (стадия 1 п.4). |
| D-3 | Soft delete spray/field логов при импорте | Моделей нет; 16 сырых запросов; unique `(user_id, client_uid)` на field-log. Реализуемо, но объём больше, чем «две строки». Побочно: импорт вообще не восстанавливает логи. | **Безопасно; объём ×5 от плана.** Вопрос F-9. |
| D-4 | Персистить turf profile в `payload._turfProfile` | Сервер хранит payload как есть; читатели — `loadSample()` и `word-export.js`. В дампе `_turfProfile` нигде нет — обратной совместимости не требуется. | **Безопасно.** |
| D-5 | Не хранить «последний выбранный образец» | На `/analysis` и так newest-by-date (GH-372). GH-386 не затрагивается. | **Безопасно.** |
| D-6 | Rename добавляет label в зоны сайта | `mergeZoneNameIntoSite()` идемпотентен (case-insensitive check `:525`); старый label не удаляется — так же ведут себя `store()`/`sync()`. | **Безопасно.** |
| D-7 | **Отказ от клиентских UUID** | **Обоснование неверно** (факт 12): label-derived uid минтятся тремя путями и лежат в дампе (`'Green 1'`, `'18th Green'`, …). **Но решение можно оставить по другой причине:** совпадение uid = намеренная семантика «re-import updates» (`sample-manager.js:1193-1194`) и «Save as Sample с тем же именем» → auto-dedup внутри вкладки (`:1786-1797`); половина риска «un-delete» уходит со стадией 2. Остаётся: две вкладки/устройства минтят один и тот же uid → второй `POST` перезаписывает payload первого через upsert `store()` — это last-writer-wins того же класса, что D-8. UUID это закрыл бы, но сломал бы re-import-семантику (повторный импорт CSV давал бы дубликаты). | **Решение оставить; обоснование заменить; риск записать под D-8.** Если пользователь всё же захочет UUID — только с сохранением re-import по `(label, date)` на клиенте, что отдельная работа. |
| D-8 | Отложить version-check | После стадии 2 `update()` — last-writer-wins; при одном операторе приемлемо. Записать в changelog как known limit вместе с D-7-остатком. | **Безопасно.** |

---

## 8. Опасности, которых план не поднимает

- **F-1 `settings-init.js apiFetch()` глотает статусы** — стадия 1 п.7. Сейчас 419 после долгой сессии на Settings
  показывает успех импорта.
- **F-2 Усечение payload при Update восстановленного образца** (факт 17) — существует сегодня, закрывается
  стадией 2. Между 0 и 2 не растягивать.
- **F-3 `GET /api/samples` для admin спанит все аккаунты** (`:27-29`) — стор хаба у админа содержит образцы всех
  клиентов; combined export может их смешать; с капом 2000 и `meta.total` станет видно. Не в scope.
- **F-4 `hub-persistence.js` — второй кэш** (`gilba_hub_samples`) со своими триггерами (`bindAutoSave()` 2069-2122:
  input/change в `#gaip-hub`, `gaip:sample-loaded`, `gaip:site-changed`, …). План его видит (item 4), но не как
  отдельную копию с отдельным ключом — стадия 3 должна вырезать именно её.
- **F-5 Права** (факт 16) — стадия 2 п.6.
- **F-6 `clearSiteData` удаляет логи, которые импорт не восстанавливает** — D-3 делает обратимым; вопрос F-9.
- **F-7 `field_log_entries` unique + soft delete** — стадия 1 п.8.
- **F-8 Стадия 4 может создать две живые строки с одним uid** — раздел 4, стадия 4.
- **F-9 (вопрос пользователю, одна строка):** трогать ли логи при импорте образцов вообще. Если «нет» — D-3
  сводится к удалению двух строк `:147-148` и миграция не нужна. Я бы спросила до стадии 1.
- **F-10 Параллельные правки в `assets/`** (monthly-N, delivery-агенты): эта работа трогает `sample-manager.js`,
  `sample-persistence.js`, `hub-persistence.js` (samples-ветка), `dashboard-ui.js` (штамп), `settings-init.js`
  (`apiFetch`, import-блок), `gaip-field-log.js`, `site-config-persistence.js` (одна запись), `sample-switcher-ui.js`
  (права), `layouts/db-shell.blade.php` (одна строка конфига), `data.blade.php` (URL удаления), `SampleController.php`,
  `DataController.php`, `FieldLogEntryController.php`, `SprayLogController.php`, `DashboardController.php`,
  `routes/web.php`, миграции. Delivery-план (`PLAN-delivery-unification.md`) в `sample-*` не заходит; сверить перед
  стадией 1.

---

## 9. Рекомендация по каждому finding

| Finding | Рекомендация | Почему |
|---|---|---|
| Факт 1-8 (диагноз плана верен) | **Делать стадию 0 сейчас** | Единственный дефект с потерей данных, достижим обычным действием; один метод, откатывается. |
| Факт 9a (ключ `gilba_hub_samples`, пустой pin) | **Исправить в стадии 3** | Иначе guard-тест зелёный при живом кэше. |
| Факт 9b (`if (samples)` gate вокруг import-active-site) | **Исправить в стадии 3** | Иначе после импорта дашборд откроется не на импортированном сайте. |
| Факт 9c / item 14 (turf profile влияет на анализ) | **Стадия 2, D-4 как принято** | Без персиста после стадии 3 теряется на каждой перезагрузке и на странице, и в Word. |
| Факт 11 (rawData=payload только без snapshot-push) | **Стадия 2 атомарно** | Разделение на два коммита открывает окно массовой перезаписи. |
| Факт 12 / D-7 (обоснование отказа от UUID неверно) | **Решение оставить, обоснование заменить (раздел 7); остаток риска — в changelog под D-8** | Re-import-семантика важнее редкого cross-tab совпадения имён; воскрешение уходит в стадии 2. |
| Факт 13 (ссылка GH-243/6000) | **Записать и идти дальше**; live-проверка с throttling в стадии 3 | Остаточный риск описан верно; точная ссылка — `hub-orchestrator.js:~7472`. |
| Факт 14 / D-3 (нет моделей, 16 сырых запросов, unique на field-log) | **Стадия 1 п.8 по исправленному рецепту; до неё — вопрос F-9** | Как записано в плане, не компилируется в задачу. |
| Факт 15 / F-1 (`apiFetch` без проверки статуса) | **Делать в стадии 1 вместе с ужесточением `sync`** | Иначе ужесточение превращается в ложный «успех». |
| Факт 16 / F-5 (права) | **Стадия 2** | Правило проекта; по-записная запись сделает 403 видимым. |
| Факт 17 / F-2 (усечение payload при Update) | **Записать; закрывается стадией 2; стадии 0→2 подряд** | Не потеря строки; отдельный фикс между стадиями не стоит риска. |
| Порядок «воскрешение снимать в стадии 2» | **Стадия 2** (допустимо в 1) | При живом snapshot-push эффект неотличим. |
| Стадия 1 п.2 (удалить `DataController::destroy`) | **Стадия 1** | Одна точка удаления; «без дублирования». |
| Стадия 1 п.6 (`index()` cap 2000 + `meta.total` вместо per-site) | **Стадия 1** | Хабу нужны все сайты; частичная загрузка должна быть видимой. |
| D-2 кап не для import-clear | **Стадия 1** | Иначе импорт в непустой сайт невозможен. |
| F-3 (admin спанит все аккаунты) | **Записать и идти дальше** | Вне scope; станет видимым через `meta.total`. |
| F-4 (второй кэш) | **Стадия 3** | Именно он даёт гонку 200 мс на reports. |
| F-8 (стадия 4, дубликаты при restore) | **Стадия 4, если делается** | Опционально. |
| F-9 (трогать ли логи при импорте) | **Спросить пользователя одной строкой до стадии 1** | Меняет объём D-3 в пять раз. |
| F-10 (пересечения с другими агентами) | **Проверить перед стадией 1** | Механически. |
| Items 5, 9, 10, 11, 12, 13, 17, 18, 20 (legacy/dead/stays) | **Стадия 3 — удалить dead-код; legacy не трогать** | Как в плане; подтверждено. |
| D-1, D-4, D-5, D-6, D-8 | **Без изменений** | Проверены по коду, безопасны. |

---

## 10. Тесты и живая проверка

**Стадия 0 (PHPUnit, красные до фикса)** — раздел 4. Плюс инверсия `test_…_reconciles_deleted_samples`;
`test_…_can_restore_soft_deleted_sample` → `markTestSkipped` до стадии 2.

**Стадия 1 (PHPUnit):** `destroy()` — 403 viewer, 404 чужой/trashed, summary re-point при общей дате,
soft-delete summary иначе, `delete_source`; `index()` — 250 строк → `meta.total 250, returned 200` при
`limit=200`; `sync` — два сайта с `clearSiteData:true` → 422; `update()` с `_label` → зона в
`attributes_json.zones`; D-3 — логи невидимы после clear, повторный field-log с тем же `client_uid` не падает;
`apiFetch` — Jest на `settings-init.js` (или ручная проверка: 422 от сервера → сообщение, не редирект).

**Стадия 2 (Jest, `tests/ghNNN-sample-writes-per-record.test.js`, харнесс как в
`tests/gh378-no-duplicate-site-changed-during-export.test.js` — реальный `sample-manager.js` + переписанный
`sample-persistence.js`, stub `fetch`):** `addSample` → один `POST` с телом по таблице; `updateSample` на
восстановленном → один `PATCH` с **полным** payload (включая ключи, которых нет в форме — фикстура с `thatch`);
`deleteSample` → `DELETE /api/samples/{serverId}`; `clearSamples` → N `DELETE`; `setSampleTurfProfile` → `PATCH` с
`_turfProfile`; восстановление поднимает `_turfProfile` в `sample.turfProfile`; `gaip:site-changed` → ноль
запросов к `/samples`; **guard: ни одно тело не содержит `allSites`**; `canEditActiveSite:false` → ноль запросов
записи. PHPUnit: `saveSampleRecord()` не воскрешает (переписанный тест).

**Стадия 3 (Jest):** `fetch` reject → стор пуст, `setReadOnly(true)`, `addSample` бросает, ready с
`source:'error'`, `_gaipSamplePersistenceReady === true`; `[]` + `total 0` → `source:'empty'`, разблокирован;
`returned < total` → `source:'error'`; source-pin: `gilba_samples` отсутствует в `sample-persistence.js`,
`dashboard-ui.js`, `settings-init.js`, `gaip-field-log.js`, `site-config-persistence.js`, `sample-manager.js`;
`gilba_hub_samples` и `keys.samples` отсутствуют в `hub-persistence.js`; блок `gilba_import_active_site`
выполняется без локальной копии (мок `sessionStorage`).

**Live (Playwright, `tests/e2e/ghNNN-samples-db-only-live.test.js`, по образцу `tests/e2e/gh394-traffic-live.test.js`;
scratch-сайт «New test - location»; дамп/диф/восстановление `samples`, `site_summaries`,
`sites.attributes_json` до/после):** (1) Add через форму `/analysis` → в БД +1, ничего не trashed; (2) второй
контекст добавляет на Data page, первый правит заметку → оба живы, payload второго не тронут; (3) Delete в хабе и
на Data page → обе trashed с `delete_source`; (4) reload → счётчики `/data`, badge `/analysis`, picker
`/reports/export` совпадают с БД; (5) `/reports/export` с перехватом `/api/samples` → баннер, Generate disabled,
docx не создан; снять перехват + Retry → picker полон; (6) дашборд Re-run → iframe анализирует
`GAIP_HUB_CONFIG.activeSiteId` (сравнить с сайтом в analysis cache); (7) Settings import в непустой сайт → старый
набор trashed, новый жив, логи невидимы, повторная перезагрузка вкладки `/analysis`, открытой до импорта, **не**
возвращает старый набор; (8) throttling «Slow 3G» на `/reports/export` → до прихода API нет цифр из ниоткуда,
после — картина совпадает с (4).

**Где смотреть глазами после каждой стадии:** `/data` (счётчик записей по вкладкам), `/analysis` (badge и список
switcher), `/reports/export` (picker образцов), консоль браузера — нет `[SamplePersistence]` warn.

---

## 11. Что я не проверяла и где не уверена

- Скрипты проб прошлой сессии и их вывод — принимаю по описанию; код с ними согласуется.
- Достаточность 200 мс в `hub-persistence.js` на реальном хостинге — не измерялось ни планом, ни мной; после
  стадии 3 вопрос снимается.
- Что `validatePayload()`/`computeNutrients()` терпят объектный `_turfProfile` — по коду читают именованные ключи;
  пин в PHPUnit стадии 2 закроет.
- Точное место 6-секундного fallback в `hub-orchestrator.js` (около 7472) — по grep, не по прочтению функции.

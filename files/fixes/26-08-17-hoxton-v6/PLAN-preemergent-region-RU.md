# План 3бт (`GH-727`): регион предвсходовой программы — один словарь и координаты площадки

Аналитик — Аня, 29.09.2026. Всё ниже снято чтением кода, двумя `SELECT` по стенду (только чтение) и прогоном движка в jest на копии в памяти: `scratchpad/p3bt/species-sets.test.js`, вывод `p3bt/sets.out`. Кода не писала, стенд не трогала, прогонов на площадках не было.

## Проверка заявок из пункта и задания

| Заявка | Замер | Итог |
|---|---|---|
| австралийские площадки теряют 11 видов с `au` | теряют **6**. Ещё 5 тегов `au` стоят в тропической таблице, а её движок для нетропического региона не читает (`pre-emergent-engine.js`, `analyse`, ветка `isTropical`) | не подтвердилась |
| новозеландские теряют 6 видов с `nz` | теряют **5**. Шестой тег `nz` — тоже в тропической таблице | не подтвердилась |
| `Test6 - UK` теряет 2, у `test4 - USA` регион не объявлен ни одним видом | 2 и 0 | верно |
| «набор изменится у всех 13 площадок» | меняется у **12 из 13 площадок с прогоном**. У `test4 - USA` остаётся 7 видов: ни один вид не помечен регионом США | не подтвердилась для одной |
| «зашитое `au` — единственное значение, которое таблица понимает» | таблица понимает ещё `nz`, `uk`, `eu`, `scandinavia` и три длинных тропических имени. Запасная ветка строителя даёт `nz` по `site.country`, но это поле не заполняет ничего (`calculation-inputs.schema.json`, `notInputs` → `site.country`, замер GH-725). Поэтому на деле она даёт `au` | по смыслу верна, формулировка шире |
| словари не совпадают | тропическая половина движка уже говорит именами владельца (`TROPICAL_REGIONS`: `southeast_asia`, `australia_tropical`, `australia_subtropical`). Не совпадает умеренная | верна для умеренной половины |
| перечень 13 площадок в пункте | в нём есть `GH-671 wizard press 022408`, у которой нет ни одного прогона, и нет `Hoxton Soccer - Kate's test` (NZ, 5 прогонов). Площадок с прогоном 13: 6 AU, 5 NZ, 1 UK, 1 USA | перечень неточен |
| **«Чего не установлено: сколько площадок получают чужой `region`»** | **Установлено.** Последняя сохранённая строка у **4 австралийских площадок** несёт `new_zealand`: `Burns`, `Canberra`, `New test - location`, `Westview`. Всего таких строк **10** (5, 2, 1, 2) с 17.09 по 25.09. Из кода к `new_zealand` в строителе ведёт одна дорога — `gaip_detectRegion` по полям страницы, а поля несли координаты Новой Зеландии, пока прогон шёл под австралийской площадкой. Сам момент гонки не замерен | закрыто замером |

**Это видно клиенту уже сегодня:** подвал карточки на `/plan` печатает `Region: new_zealand` у этих четырёх австралийских площадок (`plan-ui.js`, `renderPreEmergent`, строка `summary.region`). Набор видов сегодня от этого не меняется: ни `new_zealand`, ни `australia_temperate` движку не известны, оба дают те же 7 видов с `all`.

**Почему две части нельзя делить, в числах.** Если починить только словарь, эти четыре австралийские площадки получат новозеландский набор из 12 видов вместо австралийского из 13. В нём не будет Crowfoot grass. Решение владельца брать обе части этим подтверждается.

## Устройство: у кого что

- **Перечень регионов** — `REGIONS` в `assets/regional-profiles.js`: 17 идентификаторов. **Правило отнесения точки к региону** — `detectRegion(lat, lon)` в том же файле. Второго перечня в продукте быть не должно.
- **Координаты** — строка площадки, `sites.latitude` / `sites.longitude`. На странице её отдаёт `GAIP_SiteConfig.getSite(siteId)` (`site-config-persistence.js`, GH-473), это ответ сервера, обратно он не пишется. Регион по площадке уже собран в одну функцию: `GAIP_RegionalProfiles.detectRegionForSite(siteId)` (GH-476).
  - Решение владельца 10.8(11) записано в самой функции: «регион берётся из координат площадки, отдельной настройки страны нет». Для неизвестных координат функция отвечает `null`, подстановки нет.
- **Образец уже работает в восьми файлах**, и строитель просто присоединяется к нему. Все восемь зовут `detectRegionForSite(GAIP_RegionalProfiles.activeSiteId())`:
  - `nutrition-au-fertiliser-integration.js`, `nutrition-nz-fertiliser-integration.js`, `nutrition-uk-fertiliser-integration.js`, `nutrition-prebble-integration.js`;
  - `gilba-soil-interpretation.js`, `ammonium-acetate-methodology.js`, `cotula-bowling-green.js`, `spray-log-ui.js`.
  - Их стережёт `tests/gh476-region-follows-the-site.test.js`.

**Кто становится читателем после работы:**
1. `buildPreEmergentInputs` берёт регион одним вызовом `detectRegionForSite(activeSiteId())`. Поля страницы, `"au"`, `site.country` и `site.region` он больше не читает.
2. Теги видов в движке пишутся идентификаторами владельца. Движок не переводит имена и своего словаря не держит. Так он уже устроен в тропической половине.

**Почему без таблицы перевода «длинное имя → короткий код».** Таблица перевода — это второй словарь, который надо держать в согласии с первым. По правилу проекта это «два читателя со сторожем». Теги видов — не копия перечня регионов: это данные о сорняках, которые ссылаются на идентификаторы владельца. Тест проверяет, что каждый тег есть в `REGIONS`, и читает `REGIONS` из самого `regional-profiles.js`.

## Перемаркировка тегов — точная таблица

Выведена из самого `detectRegion`: каждый короткий код заменяется теми идентификаторами, которые `detectRegion` возвращает для того же места.

| Сейчас | Становится | Основание |
|---|---|---|
| `au` | `australia_temperate`, `australia_mediterranean`, `australia` | `detectAustralianSubRegion` возвращает для нетропической Австралии эти три. `australia_tropical` и `australia_subtropical` сюда **не входят**: сегодня эти регионы видов `au` не получают, и так остаётся |
| `nz` | `new_zealand` | единственный NZ-идентификатор |
| `uk` | `uk_ireland` | единственный британский |
| `eu` | `continental_europe`, `germany`, `mediterranean` | европейская рамка `detectRegion` без `uk_ireland` и `scandinavia`: оба у этих двух видов стоят отдельными тегами |
| `scandinavia` | `scandinavia` | уже идентификатор владельца |

Перемаркировка затрагивает 11 записей: 6 в `SPECIES_DB` и 5 в `TROPICAL_SPECIES_DB`. Замер на копии в памяти: вне перечня владельца **0** тегов; тропические регионы, `japan` и `south_africa` дают те же наборы, что сегодня.

## План

1. **`assets/pre-emergent-engine.js`: теги.** Перемаркировать 11 записей по таблице. Логика `analyse` и `listSpecies` не меняется. JSDoc `inputs.region` («`'au'`, `'nz'`, or `'all'`») переписать: регион — идентификатор из `REGIONS`.
2. **Тот же файл: без региона нет ответа.** Сейчас `var region = inputs.region || 'all'`: без региона движок молча выдаёт 7 видов с `all`, и это подстановка. Отказывать так же, как отказывает при пустой `soilTemp5cm` в начале `analyse`: `success: false`, `error: 'region is required'`, пустые `results`. `listSpecies(region)` не трогать: у него `all` означает «весь каталог», ответом о площадке это не является.
3. **`assets/hub-orchestrator.js`, `buildPreEmergentInputs`, блок `// ── Region`.** Заменить на `detectRegionForSite(activeSiteId())` — ровно в той форме, в какой его зовут восемь файлов из образца.
   - Убрать чтение `.gaip-lat` / `.gaip-lon`, `let region = "au"` и обе ветки `site.country === "NZ" || site.region === "nz"`.
   - Регион, которого нет, остаётся `null`.
4. **Тот же файл, шаг 8b.** Если `preEmInputs.region == null`: вызвать `attempting("pre-emergent", "preEmergent")`, записать `note("pre-emergent", …)` о том, что у площадки нет координат, и движок не звать.
   - Это существующий механизм GH-573: ожидаемый и не пришедший результат в конце прохода становится пропуском по имени, и панель неполного прогона его называет.
   - Проверку поставить до сторожа гонки (`_priorWasSensor`).
   - Отказ самого движка (шаг 2) пропуском не станет: `producedSomething` считает объект с ключами результатом. Поэтому решает строитель, а шаг 2 — страховка для других вызывающих.
5. **Записи идут за кодом, в той же сдаче:**
   - `assets/dependency-graph.json`, узел предвсходовой программы: `readsTheListExcuses` сейчас `["site.country", "site.region"]`. Строитель их больше не читает.
   - `assets/calculation-inputs.schema.json`, `notInputs["site.country"]`: текст говорит, что предвсходовый движок строит на этом поле ветку для Новой Зеландии. Останется один читатель — `ambient-dli-engine.js`.
   - Что именно требуют `tests/gh676-…`, `gh644-…` и `gh725-…` после правки, разработчик устанавливает прогоном. Сами записи `notInputs` не удаляются: `site.country` читает `ambient-dli-engine.js`, `site.region` читают `shade-engine.js`, `shade-engine-pure.js`, `spray-log-integration.js` и `gilba-water-interpretation.js`.
6. **Тест `tests/gh727-…test.js`** на стенде `tests/lib/orchestrator-bench.js`: он грузит всё, что грузит `/hub`, включая `regional-profiles.js`, `pre-emergent-engine.js`, `hub-orchestrator.js` и `site-config-persistence.js`. Разделы — ниже.

## Признак сдачи — числом, до правки

**Часть 1, словарь.** Снимается тестом из шага 6 и повторяется замером `p3bt/species-sets.test.js`.

| Что | Сейчас | После |
|---|---|---|
| значений тегов вне `REGIONS` (кроме `all`) | 4 (`au`, `nz`, `uk`, `eu`) в 11 записях | 0 |
| видов при `australia_temperate` | 7 | 13 |
| видов при `new_zealand` | 7 | 12 |
| видов при `uk_ireland` | 7 | 9 |
| видов при `us_transition` | 7 | 7 |
| `australia_tropical` / `australia_subtropical` / `southeast_asia` | 22 / 18 / 22 | 22 / 18 / 22, те же ключи |
| видов без региона | 7 (`all`) | 0, `success: false` |

- Ожидаемые наборы тест берёт литералом ключей видов, а не из движка.
- Перечень владельца тест читает из `regional-profiles.js`.
- Тест печатает, какие регионы и какие теги осмотрел.

**Часть 2, источник координат.** Снимается тестом из шага 6 на стенде оркестратора.

| Случай | Сейчас | После |
|---|---|---|
| поля страницы −36.85 / 174.76 (NZ), строка активной площадки −35.23 / 149.00 (AU) | `new_zealand` | `australia_temperate` |
| то же, наоборот | `australia_temperate` | `new_zealand` |
| у строки активной площадки нет координат, поля страницы пусты | `au` → 13 видов | движок не вызван, `preEmergent` в `computed.skipped` |

**Мутации для приёмки, выбирает ревьюер.** Например:
- вернуть чтение `.gaip-lat` — красные первые два случая;
- вернуть `|| 'all'` — красный случай «без региона»;
- оставить один тег `au` — красный тест тегов с именем вида.

**Стенд — только после прогона в окно Ники.** `/plan` рисует сохранённую строку, поэтому до нового прогона площадка показывает старый набор. Снимать `SELECT`-ом `scratchpad/q3bt.sql`, колонки `pe_region` и `pe_n`.

| Площадка | Сейчас `pe_region` / `pe_n` | После прогона | Можно ли прогонять |
|---|---|---|---|
| `Burns` | `new_zealand` / 7 | `australia_temperate` / 13 | решает Ника («не для порчи») |
| `Canberra` | `new_zealand` / 7 | `australia_temperate` / 13 | **нет, только чтение** |
| `New test - location` | `new_zealand` / 7 | `australia_temperate` / 13 | да |
| `Westview` | `new_zealand` / 7 | `australia_temperate` / 13 | да |
| `Federal Golf` | `australia_temperate` / 7 | `australia_temperate` / 13 | да |
| `Test1 - Sports` | `australia_temperate` / 7 | `australia_temperate` / 13 | **нет** |
| `Russley`, оба `Test - GC - NZ`, `Test5 - NZ` | `new_zealand` / 7 | `new_zealand` / 12 | да |
| `Hoxton Soccer - Kate's test` | `new_zealand` / 7 | `new_zealand` / 12 | **нет** |
| `Test6 - UK` | `uk_ireland` / 7 | `uk_ireland` / 9 | да |
| `test4 - USA` | `us_transition` / 7 | `us_transition` / 7 | **нет** — случай США закрывает только тест |

## Что человек увидит на `/plan`, вкладка Pre-emergent, после прогона

- **Австралия (`australia_temperate`).** 13 карточек видов вместо 7. Добавятся Crowfoot grass, Southern crabgrass, Catsear / False dandelion, Creeping woodsorrel, Bindii / Lawn burweed, White clover. У `Burns`, `Canberra`, `New test - location` и `Westview` подвал сменится с `Region: new_zealand` на `Region: australia_temperate`.
- **Новая Зеландия (`new_zealand`).** 12 карточек вместо 7. Добавятся Southern crabgrass, Catsear / False dandelion, Creeping woodsorrel, Bindii / Lawn burweed, White clover. Подвал не меняется.
- **Великобритания (`uk_ireland`).** 9 карточек вместо 7. Добавятся Creeping woodsorrel и White clover.
- **США (`us_transition`).** Без изменений, 7 карточек. В таблице движка нет ни одного вида, помеченного регионом США: это содержание таблицы, а не словарь. Новые виды в эту работу не входят.
- **Во всех трёх изменившихся регионах** может измениться значок «N alerts»: новые виды получают свой статус окна по той же температуре почвы.
- **Площадка без координат** не может закончить мастер, поэтому до прогона не доходит. На стенде у трёх `GH-769 construction press` координат нет, и прогонов у них нет. Если такая площадка всё же дойдёт до прогона, карточка покажет существующее пустое состояние, а панель неполного прогона назовёт пропуск.

## Подводные камни

- **В `hub-orchestrator.js` есть вторая функция с именем `detectRegion`** (около `:3073`). Она питает `buildDiseaseInputs` и прогноз и говорит своими кодами: `NZ`, `AU`, `GB`, `SCAND`, `JP`, по умолчанию `"AU"`. К `gaip_detectRegion` она отношения не имеет. В этой работе её не трогать, она стоит в перечне класса ниже.
- **`gssh-scenario-engine.js:736–743` — дословная копия блока строителя:** поля страницы и `'au'` по умолчанию. Это сценарии болезней, а не предвсходовая программа. Не трогать, она тоже в перечне.
- **Не звать `gaip_detectRegion(lat, lon)` напрямую.** У `detectRegion` для нечисловых входов есть запасной `'uk_ireland'` (`regional-profiles.js`, начало `detectRegion`). `detectRegionForSite` отсекает `NaN` раньше, поэтому ходить только через неё.
- **Теги `au` и `nz` в тропической таблице сегодня недостижимы и останутся такими.** Перемаркировать их надо, иначе тест тегов покраснеет. «Оживлять» их, подмешивая тропическую таблицу в умеренные регионы, нельзя: это сменит наборы у площадок, о которых задача не говорит.
- **Сторож гонки шага 8b** держит прошлый результат из `window.GAIP_PRE_EMERGENT_RESULT` вместо нового прохода, если прошлый был с датчика. Тогда в строку ляжет прошлый проход, возможно чужой площадки, с его регионом. Граница названа в разделе о браузерных копиях.
- **Поля `.gaip-lat` / `.gaip-lon` остаются на странице**, их по-прежнему пишут и читают другие модули. Убирается только чтение в строителе.
- **Защищённые площадки не прогонять** ради проверки: прогон пишет строку в `analysis_results`. Случаи США и `Canberra` закрываются тестом.
- **Подвал печатает сырой идентификатор** (`Region: australia_temperate`). В `REGIONS` есть имя для людей, но менять подвал в эту работу не входит.
- **В коде** — `GH-727`, без русского и без номеров вопросов.

## Браузерные копии в этой области

Искала по `buildPreEmergentInputs` и шагу 8b целиком: `.gaip-`, `localStorage`, `global.` / `window.`.

- **`.gaip-lat` / `.gaip-lon`** — поля страницы как источник региона. **Убираются этой работой.**
- **`GAIP_SoilTempLogger`, `localStorage` `gilba_soil_temp_log`** — строитель читает историю температуры почвы из браузера (`hub-orchestrator.js`, «Priority 2: stored sensor history»). Только когда источник — датчик.
- **`window.GAIP_PRE_EMERGENT_RESULT`** — прошлый результат, который сторож гонки держит вместо нового прохода. Тоже только при датчике.
  - **Граница для обеих:** обе живут в сенсорной части, а её владелец вынесла целиком (Вопрос 63). На стенде из 86 сохранённых строк с датчика нет ни одной: 80 `physics_model`, 1 `estimated`, 5 пусто. **В записи Вопроса 63 этих двух копий нет:** там перечислены настройки и показания датчиков, а `gilba_soil_temp_log` и `GAIP_PRE_EMERGENT_RESULT` не названы. Дописать их туда — дело держателя документа.
- **`GAIP_SiteConfig.getSite`** — это ответ сервера со строкой площадки, по образцу GH-473 и GH-476. Обратно он не пишется, копией в смысле правила не является.

## Класс: где ещё решают регион или берут координаты со страницы — перечень

Предложение, требует решения. В работу не входит. Искала `grep` по `gaip-lat`, `>= 166`, `> 165`, `countryCode ===` в `assets`, `app/resources`, `app/app`. **Граница поиска:** рамки только для Австралии, без новозеландской границы, эти образцы не ловят.

**A. Регион берётся из полей страницы — тот же класс `GH-459`, 7 мест кроме строителя:**
- `hub-orchestrator.js:3081`, `detectRegion` — запас после `gaip_getCurrentRegion()`, свои коды, по умолчанию `"AU"`. Питает болезни и прогноз;
- `gssh-scenario-engine.js:738` — сценарии болезней, по умолчанию `'au'`;
- `turf-profile-controller.js:44` `getVarietyRegion`, `:131` `getDetectedRegionId`, `:986` `dispatchStateChange`;
- `cultivar-profile-ui.js:112`;
- `nz-fine-fescue-integration.js:332`.

**B. Климатическая зона или полушарие по широте со страницы, 6 мест:**
- `au-variety-traits.js:141` `getCurrentAUClimateZone`;
- `nz-variety-traits.js:133` `getCurrentNZClimateZone`;
- `variety-traits-integration.js:780`;
- `turf-profile-controller.js:18` `getClimateZone`, `:38` `isNorthernHemisphereCool`;
- `hub-orchestrator.js:3683` `getCurrentSeason`.

**C. Координаты со страницы для другого — погода, широта, снимок, 16 мест.** Часть из них законна на странице одной площадки: так прямо сказано в комментарии GH-480 у `nutrition-summary-integration.js:885`.
- `climate-engine-v2.js:855`;
- `climate-normals-service.js:294`;
- `nutrition-summary-integration.js:436` (по умолчанию `-33`) и `:893`;
- `nutrition-calendar.js:794`;
- `gilba-water-interpretation.js:212`;
- `gilba-synthesis-interpretation.js:613`;
- `nutrition-prebble-integration.js:638` (по умолчанию `-35`);
- `hub-orchestrator.js:564`;
- `hub-tissue-v3.js:1681`;
- `auto-refresh.js:86`, `:212`;
- `site-profile-bridge.js:176`;
- `hub-persistence.js:1252`;
- `site-setup-wizard.js:1456`;
- `turf-profile-controller.js:1096` `snapshotLocation`.

**D. Своя рамка «это Новая Зеландия / Австралия» вместо `detectRegion` владельца, 23 места в 20 файлах** — вторая копия правила, откуда бы ни брались координаты:
- `variety-traits-integration.js:89`;
- `ambient-dli-engine.js:200–214` (это Вопрос 114);
- `site-setup-wizard.js:742`;
- `onboarding-wizard.js:686`;
- `fungicide-filter.js:238`, `:605`;
- `nutrition-prebble-integration.js:207`;
- `spray-log-ui.js:253`;
- `ammonium-acetate-methodology.js:424`;
- `gilba-soil-interpretation.js:320`;
- `nutrition-nz-fertiliser-integration.js:112`, `:131`;
- `hub-tissue-v3.js:7948`;
- `disease-integration.js:235`;
- `settings-init.js:602`;
- `word-export-combined.js:2379`;
- `identity-enforcement.js:825`;
- `hub-orchestrator.js:3089`;
- `cotula-bowling-green.js:880`, `:887`;
- `data.blade.php:1754`;
- `plan.blade.php:73`;
- `app/app/Http/Controllers/Controller.php:16` — на сервере. По решению владельца координаты решают список методологий в Settings, и именно это место его исполняет. Его, вероятно, надо оставить.

**Итого вне этой работы: 51 место.** Функция `detectRegion` оркестратора стоит и в A (`:3081`), и в D (`:3089`); в итоге она посчитана один раз. Работа другого порядка, чем 3бт: затрагивает болезни, сорта, погоду, мастер и экспорт. Поэтому это вопрос в основной документ с этим перечнем, а не расширение пункта.

**Попутно, вне класса и вне работы:** `plan.blade.php:92–94` выводит методологию из координат. Если в настройках пусто или `mlsn` и площадка в Новой Зеландии, страница берёт `ammonium_acetate`, иначе подставляет `mlsn`. Это против решения владельца о единственном владельце методологии («Никаких других зависимостей не должно быть»). В документах этого места не нашла. Стенд не мерила.

## Смежное

- **Вопрос 114** (нет ветки для NZ и США в `ambient-dli-engine.js`) этой работой не затрагивается: DLI-движок строитель не зовёт.

## Открытые вопросы

Владельческой развилки нет: смену набора у всех площадок она приняла заранее. Перемаркировка `eu` выведена из рамки `detectRegion` и не меняет ни одной площадки стенда, поэтому к владельцу не идёт.

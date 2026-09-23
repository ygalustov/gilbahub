> **22.09.2026, позже в тот же день: отдельная работа по полю назначения отменена владельцем** («поле не добавлять,
> вопрос оставить открытым»). Этот разбор вошёл одним случаем (В-4) в `PLAN-calculation-inputs-RU.md` — разбор всех
> входящих параметров расчёта; там же стадия «ложный пропуск» (раздел 4.4). Здесь — материал и замеры, не работа.

# План — назначение площадки (turf intent): что не заполнено, где заполнить, и что на самом деле от этого зависит (Вопрос 61)

Задание владельца через Нику 22.09.2026, её слова целиком: «нам надо где-то выводить, что конкретно не заполнено, потому
что сейчас "что-то не посчиталось, нажмите ещё раз Re-run" — а почему не посчиталось, у нас не выводится. Давай добавим
это поле в настройки и сделаем его тогда обязательным, если оно нужно нам для расчёта. И если оно не заполнено, то в этом
сообщении выводить, что оно не заполнено». Поправка Ники: обязательность — предмет разбора, не данность; гипотеза
владельца «скорее всего, обязательно только для спорта. Проверь». Разбор, не реализация; работа не начата. Всё по дереву и
базе 22.09; живые тесты не запускались, стенд не правился, git не трогался.

**Границы:** расчёт остаётся в браузере, движки на сервер не переносятся. **Браузерные копии в этой области:** нет —
назначение и тип площадки живут в `site_configs.gaip.turf` и приходят на страницы с сервера; в прогонщике
`hub-tissue-v3.js:1120-1133` читает тип с плиток формы `/hub` с запасом из `gaipTurfProfile.state` — это входы расчёта в
браузере (граница Вопроса 50), не хранимая копия; искала `grep` по `turfIntent|turfType|subCategory` в файлах с
`localStorage` — чтений ноль. Остаток, не являющийся работой, — в `PLAN-remaining-defects-RU.md`, Вопрос 61 (раздел 8).

## 1. Как устроено сегодня — целиком

### 1.1. Ключ назначения выводится, а не заполняется

`turfIntentKey` объявлен в `assets/identity-enforcement.js:89-104`: тир 1, `required: false`, восемь значений
(`eliteMatchPlay, professionalSport, collegiateSport, communityRecreation, generalMaintenance, establishment, renovation,
overseeding`) плюс `unknownIntent`, штраф уверенности 20, `affectedEngines: wear-recovery, pgr-module, nutrition-demand`.
Значение собирает `extractTurfIntentKey(turf, site)` (`:672-760`): сначала явное поле `turf.turfIntent | turf.intent |
site.intent` — **в интерфейсе его нет** (0 вхождений в `app/resources/views` и `settings-init.js`; замер Ники подтверждён),
затем **карта по `turfType + '_' + subCategory`**: `golf_greens → eliteMatchPlay`, `golf_tees/fairways → professionalSport`,
`golf_surrounds → generalMaintenance`, `sports_stadium/elite → eliteMatchPlay`, `sports_professional → professionalSport`,
`sports_community/training → communityRecreation`, `sports_ → professionalSport`, `lawns_ → generalMaintenance`, `bowls* →
eliteMatchPlay`, плюс одиночные `greens/fairways/tees/sports/golf/lawns`. Нет совпадения — `null` → `unknownIntent`
(`setIdentityKey`, `:446-455`; допущение в `_identityState.assumptions`, штраф в `quality.totalConfidencePenalty` `:472`).

**Спорт в карту не попадает.** Settings для спорта подставляет в `subCategory` **вид спорта** (`settings.blade.php:681-685`:
`soccer, afl, rugby_union, rugby_league, cricket`), а карта ждёт **уровень** (`stadium, elite, professional, community,
training`). `sports_soccer` не совпадает ни с чем; совпал бы только пустой `subCategory` (`sports_` → `professionalSport`).

### 1.2. Двенадцать площадок стенда (база 22.09)

| Площадки | `turfType_subCategory` | Ключ назначения сегодня |
|---|---|---|
| Burns, Canberra, Federal Golf, New test, Russley, Test — GC — NZ — delivery, warm season, test4, Test6 (10) | `golf_greens` | `eliteMatchPlay` — **выведен** |
| Westview | `lawns_` (subCategory NULL) | `generalMaintenance` — выведен |
| Test1 — Sports, Test5 — NZ | `sports_soccer` | **`unknownIntent`** |

Явного поля 0 из 12 (замер Ники верен), но производный ключ есть у 10 из 12; неизвестен он ровно у двух спортивных —
и это подтверждает гипотезу владельца, **но по причине карты, а не по нужде расчёта** (1.3).

### 1.3. Что от ключа зависит на самом деле — ноль чисел, и это измерено

- **Движок износа назначение не читает.** `assets/wear-recovery-engine-pure.js` — `grep intent`: только `summerIntent`
  (`:401-434`, другое поле, «переход/поддержание летом»). Блокировка «BLOCKED — recovery windows require defined intent»
  (`identity-enforcement.js:150-163`) — **объявление, которое никто не исполняет:** `buildWearRecoveryInputs` вычисляет
  `wearCheck` (`hub-orchestrator.js:3276-3285`), пишет `warn` и **не возвращает** `wearCanRun`; шаг 7 вызывает движок
  всегда и пишет результат (`Step 7`, строки `n+1…n+22`). На стенде это видно: у Test5 — NZ строки 24, 31, 34 несут полный
  `computed.wear` — 14 ключей (`compactionRisk, wearResistance, recoveryWindow, recoveryProbability, aerationSchedule…`),
  `_meta.applicable: true`, метка времени своего прогона.
- **Запрет рекомендаций** (`canEmitRecommendations: false` для `pgr-module` и `nutrition-demand` при неизвестном
  назначении, `:195, :212`) читается только внутри самого модуля (`:487, :872, :896`); ни PGR, ни питание его не
  спрашивают (`grep` по `assets` — ноль снаружи). Объявлено, не действует.
- **Штраф уверенности −20** копится в `_identityState.quality` (`:472`); `getConfidencePenalty()` снаружи модуля не
  вызывается (`grep` — ноль). Допущения печатаются в консоль (`hub-orchestrator.js:587-591`) и в forensic-отчёт
  (`reports-forensic-ui.js:132-172`: «Turf Intent: unknownIntent»).

**Итог:** неизвестное назначение сегодня не меняет ни одного числа ни на одной площадке. Клиент на спортивной площадке
износа **не лишён**: карточка Recovery на Plan (`plan-ui.js:429-470`: compaction risk %, wear resistance, recovery window,
recovery probability, aeration weeks) рисуется из `computed.wear`; пустое состояние «No traffic data configured» — только
без `wear` **и** без расписания трафика (`:454-458`).

### 1.4. Откуда взялось сообщение «some values were not computed… Try Re-run again»

Не из пропуска, а из **ложного вывода сервера**. GH-558 `AnalysisResults::skippedFrom` (`:197-215`) выводит пропуск из
**фразы** предупреждения: `reportsNotProducing` — regex `blocked|failed|error|skipping|skipped|unavailable|not
available|could not|unable to` — **без проверки, есть ли результат модуля в `computed`**. Предупреждение износа на спорте
содержит слово `BLOCKED` → `wear: engine-did-not-produce` → строка 34 (Test5, 08:33) — `partial`, панель: «The re-run
finished without wear: some values were not computed. … Try Re-run again». При этом `computed.wear` в той же строке —
полный. Строки 24 и 31 той же площадки несут те же два предупреждения и записаны `complete` (правило появилось между
ними). **Повторное нажатие ничего не изменит** — предупреждение воспроизводится каждым прогоном на спорте; в этом
владелец права, и причина ещё дальше от прогона, чем она думала: ничего не пропущено.

Второе, что попадает в `warnings`: `[b35fix365 writer1-mainBlock] GAIP_DISEASE_RESULT written…` — информационная строка,
написанная через `warn` (`hub-orchestrator.js`, модуль `disease`); в пропуск не превращается (нет слов из regex), но шумит.

### 1.5. Где «назначение» рядом, но не оно

`turf.summerIntent` (`transition | maintain`, Settings `:566-576`) — летнее управление при пересеве, читает движок износа;
`site_type` (`golf | sports | precinct`, колонка `sites`) — тип площадки для Account; `turfType` (`golf | sports | lawns
| bowls`) и `subCategory` — профиль тёрфа. Мастер заведения (`onboarding-wizard.js:153, :308-341`) требует `subCategory`
только для гольфа; для спорта — ничего сверх типа.

## 2. Что устроено неправильно

1. **Сервер судит о пропуске по слову, а не по данным** — «не произвёл» ставится модулю, чей результат лежит рядом.
2. **Таблица личности объявляет блокировки и запреты, которых код не исполняет** — ни блок износа, ни запрет
   рекомендаций; таблица и движки расходятся, и доверять нельзя ни тому, ни другому.
3. **Для спорта назначение невыводимо по построению**: `subCategory` несёт вид спорта, карта ждёт уровень; поля, где
   уровень задаётся, нет.
4. **Сообщение называет код, а не предмет**, и не различает «не заполнено в настройках» от «не посчиталось в прогоне».
5. `warn()` собирает и информационные строки.

## 3. Ответы на вопросы разбора

**Обязательно ли поле и для кого.** По замеру — **ни для кого**: ни один движок не требует назначения для расчёта, блок и
запреты не исполняются, числа от него не зависят. Обязательное поле было бы ложью в интерфейсе («нужно для расчёта»).
Гипотеза «только для спорта» верна в другом: **только на спорте ключ не выводится**, только там возникает допущение и
(сегодня) ложная неполнота. Поэтому: поле **необязательное**, для спорта — единственный источник, для гольфа/lawns/bowls —
переопределение выведенного.

**Двенадцать площадок.** После стадии 1 у Test5 строка 34 пересчитывается в `complete`, сообщение исчезает как неверное.
После стадии 3: у 10 гольф и 1 lawns в Settings видно «Turf intent: Elite match play — derived from Golf / Greens» с
возможностью выбрать своё; руками заполнять нечего. У двух спортивных поле пустое, панель анализа несёт информационную
строку с именем поля и местом; владелец заполняет **две** площадки, не двенадцать. До заполнения продукт показывает те же
числа, что сейчас, — они от поля не зависят.

**«Не заполнено» против «не посчиталось».** Два разных списка в результате прогона и два разных предложения на
экране: `skipped[]` — шаг не выполнен (`climate-late`, `engine-error`) → «finished without …, try Re-run»;
`assumptions[]` — вход заменён допущением (`turfIntentKey: unknownIntent`) → «Assumed: turf intent not set — set it in
Settings → Turf → Turf intent», без «try Re-run», потому что нажатие не поможет. Допущение не делает прогон `partial`.

**Как сообщение узнаёт имя поля.** Связь уже наполовину есть: `IDENTITY_KEYS[key].displayName` («Turf Intent») и
`affectedEngines`; `_identityState.assumptions[]` несёт `key, displayName, assumedValue, impact, confidencePenalty`. Не
хватает адреса поля: `settingsField: 'turf.turfIntent'`, `settingsLabel: 'Settings → Turf → Turf intent'` у ключа в той же
таблице; допущения едут в тело прогона (`detail.assumptions`), в строку, в проекцию, в `AnalysisNotice` — предложение
строится из `displayName + settingsLabel`, карта — одна, в PHP (как в GH-548), страница получает её с пилюлей.

**Обязательность — где проверялась бы и что ломает.** Если владелец всё же захочет «обязательно для спорта»: проверка
на сервере (`SiteController` PATCH конфига: `turf.turfIntent` `required_if:turf.turfType,sports`), в форме Settings
(`settings-init.js`, сохранение Turf) и в мастере (`onboarding-wizard.js:153` — сегодня `case 2` требует `subCategory`
только для гольфа; для спорта пришлось бы добавить плитки уровня) — 3 места + тесты; **мастер ломается**: площадка спорта
не заведётся без ответа на вопрос, которого расчёту не нужно. Замер против; в план как стадия 4 с числом, не
рекомендуется.

## 4. Устройство

- **Правда о пропуске (сервер).** `skippedFrom` выводит `engine-did-not-produce` из фразы **только если** результата
  модуля в `computed` нет (`computed[module]` отсутствует или `null`); при наличии результата фраза остаётся в
  `warnings` как есть. Уже помеченные строки пересчитываются командой GH-558 (объявленный прогон на стенде).
- **Таблица личности говорит правду.** `wear-recovery.canRunUnknown.turfIntentKey: true`, `unknownBehaviour: 'Uses
  generic recovery assumptions'` — ровно то, что движок делает; `wearCheck.restrictions` пишутся в
  `computed.wear._meta.restrictions`, чтобы ограничение было видно у результата, а не в консоли. Запреты рекомендаций для
  `pgr-module`/`nutrition-demand` — либо исполнять, либо снять; это домен (что показывать при неизвестном назначении) —
  **решение владельца**, в основной документ находкой с числом (8).
- **Поле в Settings → Turf.** «Turf intent», селект из восьми значений `:91-97` (без `unknownIntent`), пустой по умолчанию;
  для гольфа/lawns/bowls под селектом — «Derived from <Type> / <Surface>: <Elite match play>» из той же карты (та же функция,
  отданная странице, не копия); выбранное значение пишется в `config.turf.turfIntent` и имеет приоритет (так уже в
  `extractTurfIntentKey`). Для спорта карта **не дополняется** видами спорта: `sports_soccer → professionalSport` было бы
  подстановкой уровня, которого никто не выбирал.
- **Допущения в результате.** Прогонщик кладёт `identityState.assumptions` в тело (`detail.assumptions`); схема-конверт
  объявляет; `AnalysisResults` хранит (поле `detail` уже JSON), проекция отдаёт `lastRun.assumptions`; `AnalysisNotice`
  печатает информационной строкой (не warning, не partial): «Assumed: turf intent not set for this site — set it in
  Settings → Turf → Turf intent. Recovery uses generic assumptions.» Раскрытие деталей — тот же список, что forensic.
- **Шум.** Строки `warn` без предупреждающего содержания (`[b35fix365 …] written`) переводятся в `log`.
- **Мастер** не меняется: поле необязательное.

## 5. Что видит человек между стадиями

| После стадии | Панель анализа (Test5, Test1) | Settings → Turf | Числа |
|---|---|---|---|
| 1 | сообщение «finished without wear… Try Re-run» исчезает; строка 34 — `complete` | — | без изменений |
| 2 | — | — | без изменений (движок и так считал) |
| 3 | «Assumed: turf intent not set — set it in Settings → Turf → Turf intent» (информация); после заполнения — ничего | у гольфа/lawns — «Elite match play — derived from Golf / Greens»; у спорта — пустой селект | без изменений |
| 4 (если владелец решит) | — | спорт не сохраняется без назначения; мастер получает шаг | без изменений |

## 6. Объём числом, стадии, порядок

| Стадия | Что | Мест | Тесты |
|---|---|---|---|
| **1. Сервер: пропуск по данным** | `AnalysisResults::skippedFrom` (1); команда пересчёта GH-558 — прогон на стенде, объявленный (0 правок) | 1 | 1 новый PHPUnit: фикстура строки 34 (warnings с `BLOCKED`, `computed.wear` полный) → `complete`; та же без `computed.wear` → `partial`; мутация ревьюера: убрать проверку `computed` → красный |
| **2. Таблица личности** | `identity-enforcement.js:150-163` (1); `hub-orchestrator.js:3276-3285` — restrictions в `_meta` (1); `warn`→`log` информационных строк (1, `grep` по `written`) | 3 | 1 jest: таблица и код согласны — для каждого движка с `canRunUnknown: false` в оркестраторе есть ветка, которая не вызывает движок (сегодня — ноль таких, тест это и утверждает) |
| **3. Поле и допущения** | `settings.blade.php` (селект + подпись «derived») (1); `settings-init.js` (сохранение `turf.turfIntent`, подпись из карты) (1); `SiteController` — `turfIntent` в допустимых ключах `turf`, `Rule::in` восьми (1); `identity-enforcement.js` — `settingsField/settingsLabel` у ключей, экспорт `deriveTurfIntent` странице (2); `hub-persistence.js` — `detail.assumptions` (1); `analysis-result.schema.json` конверт (1); `AnalysisResults::forSite` — `lastRun.assumptions` (1); `AnalysisNotice` — предложение и карта (2); партиал `analysis-notice.blade.php` — информационный уровень (1) | 11 | jest: предложение слово в слово из строки с допущением; PHPUnit: `turfIntent` вне восьми → 422; песочница Settings: гольф показывает выведенное, спорт — пустое, без предвыбора (мутация: предвыбрать `professionalSport` → красный по gh477-классу) |
| **4. (только по решению владельца) обязательно для спорта** | `SiteController` `required_if` (1); `settings-init.js` проверка формы (1); `onboarding-wizard.js:153, :308-341` — шаг для спорта (2) | 4 | 2 |

**Итого стадии 1–3 ≈ 15 мест, 0 миграций, 0 новых экранов, 4 теста; стадия 4 — ещё 4 места и 2 теста, не рекомендуется
по замеру.** Порядок 1 → 2 → 3: стадия 1 отделима и закрывает наблюдение владельца немедленно; 2 раньше 3, чтобы
допущение печаталось про то, что движок действительно делает.

## 7. Границы — что в план не входит

- **Сделать назначение входом расчёта износа** (recovery windows по уровню игры) — работа над движком, числа меняются:
  `wear-recovery-engine-pure.js` + таблица + тесты ≈ 5 мест; **решение владельца**, здесь не делается; сегодня движок этого
  не делает, и план не выдумывает зависимость.
- **Исполнять запреты рекомендаций** для PGR и питания при неизвестном назначении — домен; находка с числом (8).
- Расчёт в браузере; движки не переносятся.

## 8. В основной документ (Вопрос 61), здесь ссылки

- Находка: ложный `partial` от `skippedFrom` по слову в предупреждении — строка 34 Test5 (стадия 1 чинит).
- Находка: три объявленных ограничения личности, которых код не исполняет (блок износа, два запрета рекомендаций) —
  стадия 2 приводит таблицу к коду; исполнять запреты или нет — решение владельца, ≈ 4 места (`pgr-module`,
  `nutrition-demand` читают `getEngineRestrictions`, тесты).
- Решение владельца: обязательность для спорта — стадия 4, не рекомендована.

## 9. Не установлено

Почему строки 24 и 31 с теми же предупреждениями записаны `complete`, а 34 — `partial` (по времени: правило GH-558
сдано между 08:16 и 08:33, changelog по минутам не сверяла); влияет ли `totalConfidencePenalty` на какой-либо экран (по
`grep` потребителей нет; бейдж уверенности `confidence-ui-integration.js` не читала); список `subCategory` для спорта в
Settings строится JS (`stg-turf-subcategory`, «— select —» в blade) — сверяла по трафик-вкладке `stg-tw-sport`, не по этому
селекту; Test1 — Sports не прогонялся с 10.08 (строка 3) — что покажет на нём стадия 1, снимется пересчётом.

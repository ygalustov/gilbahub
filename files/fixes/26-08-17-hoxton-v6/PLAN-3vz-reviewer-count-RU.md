# Пункт 3вз: второй счёт ревьюера

Ревьюер, 30.09.2026, ночь. Только чтение. Комментарии снимались помощником `codeOf` (`GH-788`), поэтому счёт — по коду, а не по упоминаниям.

## Чтения координат со страницы: 54 живых, не 18

| файл | чтений |
|---|---|
| `turf-profile-controller.js` | **13** |
| `site-setup-wizard.js` | 6 |
| `auto-refresh.js` | 4 |
| `hub-orchestrator.js` | 4 |
| `nutrition-summary-integration.js` | 3 |
| по 2: `au-variety-traits`, `climate-engine-v2`, `climate-normals-service`, `cultivar-profile-ui`, `gssh-scenario-engine`, `nutrition-calendar`, `nz-fine-fescue-integration`, `nz-variety-traits`, `site-profile-bridge`, `site-settings-panel` | 20 |
| по 1: `gilba-synthesis-interpretation`, `gilba-water-interpretation`, `nutrition-prebble-integration`, `variety-traits-integration` | 4 |

**Всего 54 в 19 файлах.** Без снятия комментариев было бы 56 — две разницы это упоминания в прозе.

**Расхождение с заявленными 18 объясняется единицей:** моя — **вызов** `querySelector('.gaip-lat'/'.gaip-lon')` с адресом; её 18, судя по формулировке, — места, где координаты **доходят до расчёта**, а не все чтения подряд. Часть моих 54 — форма настроек и мастер, где читать поле законно: человек его как раз заполняет.

## Главный вопрос: отстаёт ли поле страницы на площадку в объединённом экспорте

**Сегодня — нет. Живых чтений координат со страницы в экспортах ноль:** ни в `word-export.js`, ни в `word-export-combined.js` нет ни одного `querySelector('.gaip-lat')` вне комментария.

Механизм, о котором речь, **описан в коде как уже закрытый** — `word-export-combined.js:2340-2362`, якорь: комментарий `GH-362` перед `var _prebbleAvailable` и функция `_nzFromCoords`:

> «b35fix305 resolved the recommender branch ONCE here, for the whole document… The collection loop above switches the active site per entry, so by the time this ran those inputs held whichever site was collected LAST. In a multi-site combined export every sample got that one site's catalogue… **The branch is now resolved per sample, from that sample's own coordinates**.»

Там же назван второй корень: пустые координаты давали `uk_ireland` по умолчанию, и площадка НЗ уходила в австралийскую ветку. Сейчас на этом месте `_nzFromCoords` (якорь: `var _nzFromCoords = function (lat, lon)`), который возвращает **`null`, а не `false`**, когда координаты непригодны, — то есть «мы не знаем, где эта проба» отделено от «проба не в НЗ».

**Ответ на твой вопрос: это тот же класс, что у водного баланса, но в экспорте он уже починен, и починен именно как класс** — с отделением «не знаем» от «нет». В `3гз` этого отделения нет: `Object.assign` сливает данные без пометки об источнике.

## Порядок между пунктами

Раз в экспорте механизм закрыт, **зависимости между `3вз` и `3гз` по этому месту нет** — их можно делать в любом порядке. Но `word-export-combined.js:2340-2362` стоит прочитать перед `3гз`: там готовый образец того, как этот класс закрывали в прошлый раз, включая различение `null` и `false`. Это дешевле, чем изобретать заново.

## Границы

- Считал только `querySelector('.gaip-lat'/'.gaip-lon')`. Координаты, взятые через переменную, через `getElementById` или из `GAIP_STATE`, в счёт не вошли — отдельного поиска по ним не делал.
- Двадцать две рамки «НЗ / Австралия» и девятнадцать полей преобразователя, названные в заявке, я не проверял: это другой предмет, и на вопрос про отставание поля он не влияет.
- Живого экрана не было и в этот раз.

---

## Якоря к адресам этого замера (по правилу пункта 3го)

| адрес | якорь, по которому его найти заново |
|---|---|
| `word-export-combined.js:2340-2362` | комментарий `GH-362`, далее `var _prebbleAvailable` |
| `word-export-combined.js:2372` | `var _nzFromCoords = function (lat, lon)` |
| чтения координат, 54 живых | `querySelector('.gaip-lat')` / `querySelector('.gaip-lon')` |
| `turf-profile-controller.js` (13 чтений) | те же два селектора |

**Единица этого замера названа в разделе выше: чтение — один вызов `querySelector` с адресом.** У аналитика единица «поля», и числа поэтому расходятся законно: 54 против 18.

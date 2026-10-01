# План 3гр (`GH-NNN` — от координатора): поля `GAIP_STATE` под именем чужого предмета

Аня, 01.10.2026, ночь. Сняты `grep -n`, чтением и одним `SELECT` (только чтение). Кода не писала, прогонов не было.

`md5`: `hub-tissue-v3.js` `c41c2855…`, `gilba-synthesis-interpretation.js` `7683f637…`.

## Три адреса разработчика — перемерены, все верны

- `hub-tissue-v3.js`, `gaip_extractCascadeResults`, около `:727` — `oe: computed.traffic || { TrafficRisk: 0, recoveryProb: 0, recoveryWindow: 0 }`. Комментарий над буквой — `// oe = Traffic results`.
- `hub-tissue-v3.js`, `gaip_republishCascadePass`, около `:1192` — `next.tissueResults = x.oe;`; `next` становится `window.GAIP_STATE` тремя строками ниже.
- `hub-tissue-v3.js`, первая публикация после каскада, около `:8621` — `tissueResults: oe,`.

## Это класс, а не случай — поле второе

В той же таблице букв `gaip_extractCascadeResults` есть второе поле того же устройства: **`ne: computed.firmness`** публикуется как **`fertiliserIndex`**.
- `gaip_republishCascadePass` — `next.fertiliserIndex = x.ne;`;
- первая публикация — `fertiliserIndex: ne,`.

Остальные буквы названы своим предметом: `l` → `mlsnResults`, `d` → `waterResults`, `ae` → `nitrogenStatus`, `se` → `shadeMetrics`, `fe` → `salinityPenalty`. Проверено по обоим местам публикации.

**Итого: два поля, четыре места публикации.** Таблица букв — наследство сжатого старого хаба. Имя поля подписывает предмет по старой раскладке, а буква уже несёт другой.

## Доходит ли до того, что читает клиент — нет, по коду

**`fertiliserIndex`** не читает никто: вне двух мест публикации имени нет ни в `assets`, ни в шаблонах. Публикация мёртвая.

**`tissueResults`** — один читатель, синтез: `gilba-synthesis-interpretation.js`, около `:492`:

```
const tissueState = canonicalTissue || gaipState.tissue || gaipState.tissueResults || {};
```

Путь до клиента обрывается дважды:
1. **Синтез не запускается сам.** После анализа он только вставляет кнопку в результаты старого хаба (`onAnalysisComplete` → `checkAndInject`). Запрос уходит по нажатию: `button.addEventListener('click', handleSynthesisClick)`. Файл грузят `hub`, `reports/export`, `reports/scenarios`, `reports/forensic`. На трёх последних разметка старого хаба спрятана в `#rp-hub-runner`, и нажать нечего. Word берёт синтез из `window.GAIP_SYNTHESIS_INTERPRETATION` (`word-export.js`, якорь `var synthesisInterpretation = window.GAIP_SYNTHESIS_INTERPRETATION`), а без нажатия там пусто.
2. **Даже при нажатии итог тот же, что без ошибки.** Трафик доходит до синтеза, только когда ткани нет: `gaip_read_tissue_data` отдаёт `null` без пробы ткани. На стенде так у 9 площадок из 13 с прогонами, ткань есть у 4. Тогда `tissueState` — объект трафика `{ TrafficRisk, recoveryProb, recoveryWindow }`. Нутриентов в нём нет, но он непустой, и синтез идёт читать ткань с полей формы старого хаба (`getInputValue('[data-tissue-nutrient="…"]')`). Без пробы ткани эти поля кадр очищает, и выходит `data.tissue = null` — тот же результат, что без трафика.

**Где это не безобидно — латентно.** Объект трафика открывает чтение ткани с полей страницы, то есть класс `GH-459`. Если в полях осталась ткань прошлой площадки, синтез отправит её как ткань этой. Сегодня кадр поля чистит, и числа это не меняет.

**Отрисовка не задета.** `gaip_render_results(pass.state, pass.weather, x.l, x.d, x.oe, …)` получает трафик пятым параметром и рисует его как трафик (`i.TrafficRisk`, «Traffic load index»). Ошибка имени — только в публикации в `GAIP_STATE`.

## Сторож держит то же неверное имя

`tests/gh461-export-identity-dataflow.test.js`:
- модель контейнеров подписывает ткань этим именем: `tissue: 'tissueResults from the page; no tissue result exists by id until a run is stamped'`;
- снимок настоящего экспорта от 2026-09-17 (`tests/fixtures/page-state-shapes.json`, `_captured`) держит `tissueResults` среди пяти «живых» контейнеров: `expect(live.sort()).toEqual(['mlsnResults', 'shadeMetrics', 'tissueResults', 'waterResults', 'wearMetrics'])`. В снимке это `"tissueResults": "object"`, и объектом там был трафик.

То же слово — `tests/gh461-export-turf-keys.test.js`, около `:372`: `tissue: 'GAIP_STATE.tissueResults and the tissue form; section 10.5'`.

**Ошибка имени дошла до описания того, откуда экспорт берёт ткань.** По дереву сегодня экспорт `GAIP_STATE.tissueResults` не читает: `gh484` это и держит (`expect(src).not.toMatch(/GAIP_STATE\.tissueResults/)`).

## Корневая причина

Таблица букв `gaip_extractCascadeResults` и две публикации в глобал страницы расходятся в том, что буква значит. Буква переназначена (`oe` — трафик, `ne` — упругость), а имена полей остались от прежнего смысла. Проверять соответствие некому: читатель по имени получает чужой предмет и не может это заметить.

## Устройство

**Не переименовать, а снять.**
- Переименовать `tissueResults` в `trafficResults` значило бы завести новую копию результата прогона в глобале страницы. Правило проекта запрещает новую браузерную копию.
- По имени трафика её сегодня не читает никто.
- Трафик в строку идёт из `computed.traffic` прохода, а не из глобала.

1. **Снять `tissueResults` и `fertiliserIndex` из обеих публикаций** — `gaip_republishCascadePass` (2 строки) и первой публикации после каскада (2 строки). (4)
2. **Синтез — снять `|| gaipState.tissueResults`** из цепочки. Без ткани синтез получает `{}` и в чтение полей формы не идёт. (1)
3. **Сторожа.** В `gh461` модель контейнеров и список «живых» говорят неправду о ткани:
   - подпись `tissue` исправляется на то, откуда ткань берётся сегодня (по `gh484` — по id пробы);
   - в список «живых» `tissueResults` больше не входит.

   Это смена смысла сторожа, а не поломка. **Снимок `page-state-shapes.json` — след экспорта 17.09.** Переснимать его можно только живым экспортом, в окне пункта 14. До того он остаётся снимком прошлого, и это пишется в самом наборе. (2)

**Размер ≈ 7 мест** (4 публикации, 1 синтез, 2 сторожа), продукт по числам не меняется.

## Подводные камни

- **Порядок чтения в синтезе сохранить**: `canonicalTissue || gaipState.tissue || {}`. Снимается только третье звено.
- **Не трогать буквы в `gaip_extractCascadeResults` и параметры `gaip_render_results`**: отрисовка получает их по позиции и рисует верно.
- **Умолчания в таблице букв** — `oe` с нулями трафика, `ne` с `FI: 0`, `ae` с `opt: 200` и «No data» — это подстановки, другой класс. **В этот пункт не входят, названы:** на `/hub` при непосчитанном трафике отрисовка покажет «Traffic load index 0.0». Если координатор решит, это отдельный пункт.

## Браузерные копии в этой области — это и есть предмет

- **`GAIP_STATE.tissueResults`** (трафик под именем ткани) и **`GAIP_STATE.fertiliserIndex`** (упругость под именем удобрения) — копии результата прохода в глобале страницы. **Уходят.**
- **Поля формы ткани старого хаба**, которые синтез читает (`[data-tissue-nutrient]`, `[data-val]`, `[name="tissue.*"]`). Путь к ним из-за трафика закрывается. Сам путь при наличии ткани остаётся: он синтеза, а синтез — интерфейс `/hub`. Граница.
- **`window.GAIP_SYNTHESIS_INTERPRETATION`** — ответ сервера, который Word берёт из окна. Остаётся: предмет синтеза, не этого пункта.

Искала `tissueResults`, `fertiliserIndex` по `assets`, шаблонам и `tests`; буквы — по `gaip_extractCascadeResults`, `gaip_republishCascadePass` и первой публикации.

## Как проверить

- Случай на синтез: площадка без ткани, в `GAIP_STATE` есть трафик → `data.tissue` — `null`, и **поля формы ткани не читаются**: заглушка `getInputValue` считает вызовы.
- Случай на публикацию: после прохода в `GAIP_STATE` нет ни `tissueResults`, ни `fertiliserIndex`, а `computed.traffic` и `computed.firmness` в строке на месте.
- **Мутацию выбирает ревьюер.** Кандидат — вернуть `|| gaipState.tissueResults`: случай обязан покраснеть на счёте вызовов `getInputValue`, а не на `data.tissue`, потому что при пустых полях `data.tissue` будет `null` и так.

## Признак сдачи — числом

- Полей `GAIP_STATE` под именем чужого предмета: 2 → 0.
- Мест публикации: 4 → 0.
- Читателей трафика как ткани: 1 → 0.

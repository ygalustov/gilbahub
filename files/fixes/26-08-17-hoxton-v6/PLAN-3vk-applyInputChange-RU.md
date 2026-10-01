# 3вк (`GH-NNN` — от координатора): `applyInputChange` — функция без вызывающих, удаляется

Аналитик — Аня, 30.09.2026, ночь. Снято чтением и `grep`. `md5`: `hub-orchestrator.js` `09dbefa2…`, `tests/fixtures/gh678-unresolved-executors.json` `ff037075…`, `tests/gh718-orchestrator-exports-by-the-stack.test.js` `55ea3ae7…`, `tests/gh678-the-caller-walk-itself.test.js` `ca443ae7…`.

## Перечень адресов

1. `assets/hub-orchestrator.js`, около `:5700-5719` — описание `/** Apply an input change to the hub state … */` и тело `function applyInputChange(path, value) { … }` (якорь — имя функции; заканчивается `log("selective", \`Applied input change: ${path}\`, …); }`).
2. `assets/hub-orchestrator.js`, около `:6022` — строка экспорта `applyInputChange: applyInputChange,` в объекте `GaipOrchestrator`.
3. `tests/fixtures/gh678-unresolved-executors.json`, раздел `empty`, около `:889-898` — запись `"assets/hub-orchestrator.js : <top level> : applyInputChange #1"` (`ticket: "GH-718"`, `why: "no-caller"`).

**≈ 3 места.**

## Условие «не задела живое» — до правки и после

**До правки, `grep -rn "applyInputChange"` по `assets`, `app` (включая `resources/views`), `tests`:** ровно три вхождения — определение, экспорт и запись описи. Обращений по вычисленному имени (`['applyInputChange']`, строкой) — ноль. Если `grep` даст больше трёх, правка стоит, и новое вхождение называется.

**После правки:**
- `grep` — ноль вхождений;
- `npx jest tests/gh678-the-caller-walk-itself.test.js tests/gh718-orchestrator-exports-by-the-stack.test.js` — зелёные. `gh718` печатает «left without a caller (6)» вместо 7 и утверждает `orphans.length > 0`: после снятия остаются 6 записей под `GH-718`, утверждение держится;
- полный `jest` — зелёный.

**Мутацию выбирает ревьюер.** Например, снять только тело, оставив запись описи: храповик `gh678` обязан покраснеть с именем записи. Иначе опись не сверяется с деревом, и это находка.

## Граница — названа, в работу не входит

Под тем же `GH-718` в описи ещё 6 функций без вызывающих: `irrigation-scheduler.js` `schedule_pure`; `tissue-corrective-engine-pure.js` `diagnoseDeficiencies`, `diagnoseCause`, `calculateMonthlyOverlay`, `diagnoseSoilRatios`, `diagnose`. Класс тот же, пункт называет одну. Обобщение — отдельной строкой, решение координатора.

## Браузерные копии в этой области

Нет: `applyInputChange` писала в `_hubState.inputs` памяти оркестратора, хранилищ браузера не трогала. Искала чтением тела функции.

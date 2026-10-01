# 3гв, продолжение: кто читает `productType` и `applicationDate`

Ревьюер, 30.09.2026, ночь. Только чтение, комментарии сняты помощником `codeOf`. Адреса с якорями.

## Ответ коротко

**Из КОНФИГА эти два поля сегодня не читает никто.** Живых чтений вида `config.pgr.productType` / `config.pgr.applicationDate` в дереве нет. Все найденные чтения (`productType` — 23 места, `applicationDate` — 29) берут их **из состояния прогона** `state.pgr`, а оно с `GH-780` собирается из журнала опрыскивания, а не из конфига.

## Где это видно — ключевое место

`hub-tissue-v3.js:2452-2459`, якорь — комментарий `GH-780: one chooser for whose application this is` и строка `var _fromLog = gaip_lastPgrForThisRun() || null;`:

```
productType:     (_fromLog && _fromLog.product_key) || "",
applicationDate: (_fromLog && _fromLog.application_date) || null,
rateLperHa:      (_fromLog && _fromLog.rate) || 0,
gddThreshold:    safeNum(e.querySelector(".gaip-pgr-gdd")?.value, null),
```

**Три поля из четырёх приходят из журнала (`_fromLog`), а порог GDD — из поля страницы.** Именно порог и восстанавливается в поле из конфига (`site-config-persistence.js:897-900`), то есть цепочка «конфиг → поле → состояние» существует **только для порога**.

Рядом, `hub-tissue-v3.js:2437-2449`, стоит объяснение, почему так: раздел конфига «is never read as a setting», `pgr.enabled` ложно у 12 площадок, и дата, лежащая рядом, «reached no calculation».

## Читатели этих полей — все через состояние, не через конфиг

| читатель | адрес | якорь | откуда берёт |
|---|---|---|---|
| заметка об исчерпанном окне | `hub-tissue-v3.js:1018`, `:1033` | `var _pgrNoteApplied = state.pgr && state.pgr.applicationDate` | `state.pgr` |
| плитка `/field-log` | `gaip-field-log-analysis.js:454`, `:458`, `:505-506`, `:521` | `if (!pgr.productType \|\| !pgr.applicationDate)` | `siteConfig.pgr \|\| turf.pgr` — **единственное место, где конфиг ещё назван** |
| движок PGR | `gilba-pgr-module-v3.js:1643`, `:1651` | `state.pgr?.productType \|\| "TE250"` | `state.pgr`, с подстановкой |
| сценарии | `gaip-scenario-engine.js:882`, `:895`, `:903` | `if (!pgr.productType \|\| !pgr.applicationDate)` | переданное состояние |
| строка результата | `hub-persistence.js:2892` | `applicationDate: _pgr.applicationDate \|\| null` | `GAIP_PGR_RESULT` |
| сервер | `RunStart.php:249`, `AnalysisNotice.php:810` | `'pgr.productType' => 'product_name'` | тело записи |

**Единственное место, где конфиг ещё назван как источник, — плитка `/field-log`** (`gaip-field-log-analysis.js:452` и `:520`, якорь `var pgr = (siteConfig && siteConfig.pgr) || turf.pgr || {};`). Это и есть тот вход, о котором стоило спросить.

## Откуда значения возьмутся после правки 3гв

- **Для расчёта и заметок — оттуда же, откуда сейчас:** из журнала опрыскивания через `gaip_lastPgrForThisRun()`. Правка ничего не отнимает.
- **Для плитки `/field-log` — вопрос открыт.** Сегодня она читает `siteConfig.pgr` первым, и `turf.pgr` вторым. Если раздел перестанет храниться, у неё останется `turf.pgr`; **несёт ли `turf.pgr` эти поля, я не проверял** — это надо замерить до правки, иначе плитка потеряет источник молча.
- **Порог GDD** остаётся отдельным предметом: он единственный идёт «конфиг → поле страницы → состояние», и его судьба в плане названа.

## Границы

- Искал по `pgr.productType` / `pgr.applicationDate` и по доступу ключом. Чтение через переменную-посредник или через развёрнутый объект (`const {productType} = pgr`) не ловится.
- `turf.pgr` как источник для плитки не измерял — назвал это открытым.
- Подстановка `"TE250"` в движке (`gilba-pgr-module-v3.js:1643`) — отдельный предмет того же класса, что мы разбирали в 3ащ; в 3гв не входит.

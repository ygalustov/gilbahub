# Пункт 3гд: сторожа, читающие исходник строкой. Перечень, образец и условия приёмки

Снято ревьюером 30.09.2026. Файл заведён по решению координатора: перечень и образец должны пережить сессию,
поэтому лежат в дереве документов, а не в скрэтчпаде. На этот файл ссылаются пункты 3гд и 3ге.

## 1. Почему пункт существует

Сторож, который утверждает по тексту исходника, не отличает **код** от **цитаты кода в комментарии**.
За одни сутки этот класс поймал нас дважды:

1. разработчика в 3вщ — его сторож считал цитату удалённого в комментарии за само удалённое;
2. **уже принятую сдачу `GH-781`** — перепись писателей журнала читает исходник без снятия комментариев.
   Замер ревьюера: вставка блочного комментария с цитатой вызова двери в `cascade-orchestrator.js`
   раздула перепись с **7 до 8 писателей**, и набор остался **зелёным**. То есть утверждение
   «ни одного неизвестного переписи» проверяется против переписи, которую можно раздуть комментарием.
   Дефект в стороже, не в продукте; сдача закрыта.

## 2. Перечень: 120 наборов зависят от поиска по тексту, 91 из них не снимают комментарии

```
verdict depends on a substring of the source: 120 suites
  strip comments first: 29
  do NOT strip:         91   (lower bound)
    audit-reconciliation-b35fix380.test.js  lines: 90,94
```

**Это НИЖНЯЯ граница, а не измеренное число, и вот почему.** Признак, которым перечень снят, —
`expect(` в ОДНОЙ строке с поиском по прочитанному тексту. Утверждение, собранное в две строки
(`const m = src.match(...)`, затем `expect(m)`), этим признаком не ловится. Поэтому пункт 3ге
начинается с замера настоящего числа, а не с починки.

**Способ замера воспроизводим:** скрипт лежит рядом с этим файлом как
`PLAN-3gd-source-reading-guards-inventory.py` и запускается из `gilbahub/` как `python3 <путь> tests`.

### 2.1 Девяносто один набор, поимённо, со строками утверждений

```
audit-reconciliation-b35fix380.test.js  lines: 90,94
climate-gp-stress-light.test.js  lines: 255,260,265,270
disease-forecast-browntop-normalize-b35fix503.test.js  lines: 62
disease-forecast-cached-species-stress-coupling.test.js  lines: 293
fusarium-honest-provenance-b35fix495.test.js  lines: 136,137,141,142
fusarium-modifier-retirement-b35fix497.test.js  lines: 192
fusarium-tier2-audit-b35fix395.test.js  lines: 234,235,236,243,245
gh248-c4-species-classification.test.js  lines: 135,136
gh249-daily-pattern-today-no-current-hour-pin.test.js  lines: 77
gh250-monthly-normal-gp.test.js  lines: 71,72,76,87,110,111…
gh251-rerun-waits-for-monthly-normals.test.js  lines: 60,83,142,143
gh260-mlsn-engine-aa-branch.test.js  lines: 43,44,56,62,63,64…
gh262-sample-fallback-methodology.test.js  lines: 66,72,84,88
gh263-soil-texture-snapshot.test.js  lines: 72,73
gh264-sample-snapshot-backfill.test.js  lines: 79,80,81,82
gh265-methodology-dom-priority.test.js  lines: 70,76,77,78,87,88
gh267-growth-potential-tooltip-aa.test.js  lines: 43,44
gh273-texture-dom-priority.test.js  lines: 56,60,73
gh275-clear-data-texture-site-switch.test.js  lines: 73
gh278-monthly-n-distribution-normals-race.test.js  lines: 55
gh280-monthly-n-card-redesign.test.js  lines: 88,89,90
gh291-k-recon-preview-derive-code.test.js  lines: 59,71,72
gh292-k-reconciliation-decision-shared-file.test.js  lines: 103,104,108,109,110,132…
gh296-monthly-temps-race-proof-fallback.test.js  lines: 46,47,63
gh298-doRerunSync-forces-monthly-n-render.test.js  lines: 94,95,101
gh304-aa-range-source-labeling.test.js  lines: 55,56,66,67,202,203…
gh304-nutrition-calendar-range-source.test.js  lines: 136
gh311-nutrient-excess-delivery-check.test.js  lines: 45,46,54,55,63,64…
gh312-unified-nutrient-balance-status.test.js  lines: 73,74,143,144,150,155…
gh313-nutrient-range-column.test.js  lines: 43,78
gh316-annual-product-summary-balance.test.js  lines: 24,25,26,34,35,44…
gh317-balance-cell-color-matches-status.test.js  lines: 26,33
gh318-annual-product-summary-p-rounding.test.js  lines: 82,83,93,113,115,118…
gh321-au-uk-late-render-catchup.test.js  lines: 23,24,25,30,31,32…
gh322b-restore-dispatches-generated-event.test.js  lines: 64,84
gh326-p-k-fertiliser-selection-fix.test.js  lines: 43,56
gh327-p-delivery-accuracy-score.test.js  lines: 38,66
gh328-liquid-p-delivery-accuracy-score.test.js  lines: 28
gh329-hard-exclude-unneeded-p-k.test.js  lines: 86,87
gh333-excess-deficit-color-and-removal.test.js  lines: 115,158,159,172,173,177…
gh334-delivered-column-bold.test.js  lines: 33,49
gh337-slow-release-rate-scaling.test.js  lines: 51,52,53
gh338-missing-soil-data.test.js  lines: 79,95,109,147
gh339-foliar-n-delivery-score.test.js  lines: 49
gh342-au-p-carryover-tracking.test.js  lines: 28,32,36,37,38,42
gh343-au-k-annual-budget-cap.test.js  lines: 22
gh346-nutrition-calendar-gp-color-collision.test.js  lines: 27,32,33
gh349-nz-preemergent-herbicide-rules.test.js  lines: 45
gh350-word-export-gp-color-and-herbicide-note.test.js  lines: 35,43,44,55
gh365-gp-status-unit-explicit.test.js  lines: 364,371
gh369-tissue-status-independence-note.test.js  lines: 522,526,532,536,537,549…
gh371-d01-coordinate-invalidation.test.js  lines: 496,535,539,540,541
gh377-program-input-invalidation.test.js  lines: 817,837,841
gh379-methodology-case-invariance.test.js  lines: 254,297
gh384-plan-page-through-core.test.js  lines: 75,88,102,103
gh392-mulders-no-cmol-conversion.test.js  lines: 127,139
gh394-traffic-schedule-persisted-and-derived.test.js  lines: 145
gh396-report-plan-vocabulary.test.js  lines: 210,211,212,222,223,248
gh397-anr-colour-scope.test.js  lines: 69
gh402-no-silent-multisite-turf.test.js  lines: 48,49,50,56
gh404-settings-requires-location.test.js  lines: 44,45,71,72,95,96
gh406-purchasing-summary-units.test.js  lines: 46,47,53,56,57,58…
gh407-wizard-nz-no-mlsn.test.js  lines: 65,78,79,84,97,116…
gh408-warm-season-gp-parity.test.js  lines: 79,84,145,146
gh424-soil-temp-basis.test.js  lines: 214,245
gh425-calc-trace.test.js  lines: 537,538,562,563
gh426-soil-temperature-conversion.test.js  lines: 242,243
gh433-one-glossary-entry.test.js  lines: 92,93
gh435-au-strategic-p-note.test.js  lines: 133,134
gh439-no-client-state-writes.test.js  lines: 120
gh440-writers-send-changes.test.js  lines: 82,91,120,121,122,166…
gh477-substitution-for-emptiness.test.js  lines: 56,59
gh481-extractant-follows-methodology.test.js  lines: 146,151,153
gh546-mlsn-thresholds-parity.test.js  lines: 92
gh549-a-zone-with-no-name.test.js  lines: 102
gh572-cec-reaches-the-result.test.js  lines: 105
gh574-cards-come-from-the-engine-not-the-markup.test.js  lines: 67,163
gh576-no-numbers-no-verdict-about-the-soil.test.js  lines: 65,182
gh588-the-runner-is-told-about-the-soil-sample.test.js  lines: 59,148
gh589-the-pass-comes-after-the-inputs.test.js  lines: 107,401
gh614-the-transcript-can-be-broken-and-seen.test.js  lines: 156,157
gh678-the-caller-walk-itself.test.js  lines: 351
gh738-the-emptiness-map-of-the-stored-row.test.js  lines: 122,123
gh745-does-the-bench-reach-the-write.test.js  lines: 37,46,55
gh745-the-frame-invariant-by-behaviour.test.js  lines: 43,44
gh781-the-runners-own-facts-reach-the-row.test.js  lines: 201
hoxton-combined-export-per-site-climate.test.js  lines: 113,114,115,143
hub-orchestrator-climate-recovery.test.js  lines: 48,56,61,102,103,107…
hub-orchestrator-species-race-guard-b35fix501.test.js  lines: 39,40,44,45,49,53
hub-persistence-growth-shadow.test.js  lines: 45,49
site-config-persistence-last-update-b35fix504.test.js  lines: 61,74,79,83,97,103
```

### 2.2 Разбиение по типу утверждения внутри этих 91

| тип | число | что с ним делает цитата в комментарии |
|---|---|---|
| «подстрока присутствует» (`toMatch` / `toContain`) | 380 | даёт **ложное зелёное**: правку удалили, цитата осталась |
| счёт вхождений (`(src.match(...) \|\| []).length`) | 310 | ломает счёт в обе стороны |
| комментарий и есть предмет | 3 | снимать нельзя — см. раздел 4 |

## 3. Образец помощника — единственный правильный в дереве сегодня

Из `gh783`. Блочный комментарий **заменяется пробелами**, а не удаляется:

```js
const stripComments = (src) => src
    .replace(/\/\*[\s\S]*?\*\//g, (m) => m.replace(/[^\n]/g, ' '))
    .replace(/(^|[^:])\/\/[^\n]*/g, '$1 ');
```

**Почему пробелами, замер:** удаление уносит переводы строк вместе с комментарием, и каждый номер
строки после него уезжает. На стороже, из которого взят образец, это давало адрес
**`disease-forecast.js:749`, где чтение стоит на `:920`** — промах на сто семьдесят одну строку.
Неверный адрес хуже отсутствующего, потому что по нему идут.

Второй `replace` не трогает `://` — иначе он съедал бы хвост URL внутри строкового литерала.

## 4. Три набора, которым комментарий и есть предмет — условие приёмки

Помощник не должен ломать их, и на каждый нужен случай:

- **`gh402-no-silent-multisite-turf.test.js:48–50`** — утверждает слова владельца в коде:
  `GH-402`, `must not change how a site is calculated`, `To restore`;
- **`gh425-calc-trace.test.js:537–538`** — утверждает инструкцию по снятию: `TO REMOVE IT`,
  `delete the single <script> tag`;
- **`gh329-hard-exclude-unneeded-p-k.test.js:86–87`** — утверждает строчные комментарии-разделители
  `// SCORE 4: P Delivery Accuracy` и `// SCORE 7: …`.

## 5. Четыре свежих сторожа: что именно читает исходник строкой

| набор | место | чем читает | почему первым |
|---|---|---|---|
| `gh781-every-journal-writer-is-met-or-declared` | `:143` перепись писателей, `:214–215` второй счёт | регулярка по `src`, комментарии не снимаются | здесь замерено раздувание 7 → 8 |
| `gh781-the-runners-own-facts-reach-the-row` | `:198–201` | `expect(src).toContain(exportLine)` | подмена строки перед запуском в `vm`: цитата в комментарии пройдёт за строку кода |
| `gh781-the-row-takes-the-accepted-pass` | `:240–241`, `:288–289` | `src.indexOf(LAST) < 0` как ворота перед разбором | файл, где имя стоит только в комментарии, будет разобран напрасно, а файл, где оно есть в коде, ворота не пропустят только по цитате |
| `gh782-the-aa-ranges-come-from-the-sites-species` | `:196–202` | `expect(engine).toContain('speciesOfTheSite(state)')` | ровно то утверждение, которое цитата в комментарии удовлетворяет без кода |
| `gh746-a-guard-compares-the-list-not-its-length` | `:215–218` | `src.indexOf(text)` для вычисления номера строки | адрес, выведенный из цитаты, укажет на комментарий |

## 6. Проверяемая форма для новых наборов

Набор, чей вердикт зависит от подстроки в исходнике, читает исходник через помощника.
Ловится тем же перечнем, которым снят этот: скрипт раздела 2 показывает набор, который читает
исходник и не снимает комментарии.

## 7. Что НЕ входит в 3гд

Остальные 87 наборов — пункт 3ге, и там **первым делом замер настоящего числа**, а не починка.
Брать в один пункт работу, размер которой не установлен, значит открыть пункт без конца.

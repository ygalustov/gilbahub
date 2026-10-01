# Пункт 3ащ: перечень ревьюера, не число

Ревьюер, 30.09.2026, ночь. Только чтение и `SELECT`. Числа аналитика считал заявками; собирал состав, а не количество.

## Живые подстановки `|| 'loam'` — пять мест

| адрес | что подставляет |
|---|---|
| `assets/hub-tissue-v3.js:1939` | `soilTexture: e.querySelector(".gaip-soil-texture")?.value \|\| "loam"` — сборка прогона |
| `assets/hub-persistence.js:2080` | `soilTexture: _smTexDom \|\| _smSample.soilTextureSnapshot \|\| …` — цепочка при сборе пробы |
| `assets/hub-persistence.js:2133` | `var tx = _smRaw.Texture \|\| _smRaw.texture \|\| …` — разбор сырой пробы |
| `assets/gilba-synthesis-interpretation.js:384` | `soilTexture: soilState.soilTexture \|\| 'loam'` |
| `assets/salinity-penalty.js:750` | `const soilTexture = state?.soil?.soilTexture \|\| 'loam'` |

**Пять — совпало с заявкой. Состав проверить против её списка не могу: её пяти адресов у меня нет.** Говорю о своём составе, чтобы сравнение было возможно.

**Вне этого списка, и это НЕ подстановка расчёта:** `gaip-clear-data.js:227` и `gssh-clear-data.js:215` — `resetSelect(SELECTORS.soilTexture, 'loam')`, то есть сброс формы к значению по умолчанию; `gaip-scenario-engine.js:340` и `gssh-scenario-engine.js:340` — `soilTexture: 'loam'` в заготовке сценария «что если». Четыре места, которые перепись по слову `loam` находит, но предметом пункта они не являются.

## Три других дома того же умолчания — подтверждаю все три

**1. Коэффициент `ECe`, `app/app/Http/Controllers/SampleAnalysisController.php:374-379`:**
```
$multipliers = ['sand'=>5, 'loamy_sand'=>5.5, 'sandy_loam'=>6, 'loam'=>7, 'clay_loam'=>8, 'clay'=>10];
$tex = strtolower((string)($payload['Texture'] ?? $payload['texture'] ?? 'loam'));
return round($ec15 * ($multipliers[$tex] ?? 7), 3);
```
**Здесь суглинок стоит трижды в двух видах:** как строковое умолчание `?? 'loam'`, как значение в карте (`'loam' => 7`) и как числовое умолчание `?? 7` — то есть даже неизвестная текстура считается суглинком, но уже числом. Перепись по слову `loam` третий случай не видит: там нет слова.

**2. Разметка `/hub`** — список текстур со суглинком; проверять её живьём я не стал, предмет чужой страницы.

**3. Серверный источник «площадка ?: аккаунт», `SampleAnalysisController.php:115-118`:**
```
$soilTexture = HillLabsSampleTypesService::resolveSoilTexture(
    $site->soil_texture_override, $site->account?->soil_texture) ?? $sample->soil_texture_snapshot ?? 'sands';
```
**Замер по базе: аккаунт в системе один, и у него `soil_texture = 'loam'`.** То есть «умолчание схемы» сегодня не гипотетическое — оно единственное значение на весь стенд. Последнее звено цепочки подставляет уже `'sands'`, не `'loam'` — четвёртое умолчание того же поля, в третьем написании.

## Достижимость по данным

| | число |
|---|---|
| площадок с прогонами | **13** |
| из них с заданной `soil_texture_override` | **5** |
| **из них без текстуры — суглинок достижим** | **8** |

**Заданная текстура у пяти, а не у трёх:** `Canberra` (`loamy_sand`), `Hoxton Soccer - Kate's test` (`sand`), `Russley` (`sand`), `Test5 - NZ` (`sand`), `Westview` (`clay_loam`).

**Заявка «текстура задана у Hoxton, Russley и Test5» неполна: пропущены `Canberra` и `Westview`.** Число «8 из 13 подставляется» подтверждается, но получается оно из 13 − 5, а не из 13 − 3.

## Границы

- Пять живых подстановок — по слову `loam` в `assets` и `app`; подстановка под другим именем (`sands`, `default`) в этот перечень не входит, и одна такая найдена отдельно (`?? 'sands'`).
- Разметку `/hub` не открывал.
- Достижимость считал по `sites.soil_texture_override`; если текстура доезжает до расчёта откуда-то ещё, счёт «8 из 13» это не учитывает.

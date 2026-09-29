# Перечень проб для перезагрузки, 3м (`GH-722`) — стенд, 28.09.2026

Снят скриптом `tools/samples-to-reload.php` на стенде; сверен построчно с независимым перечнем (своя реализация сопоставления по `assets/lab-reading-names.json` и свой `SELECT`): **40 строк и 40 строк, расхождений нет**.

**Осмотрено:** 21 живая площадка, у 10 из них есть пробы; 64 пробы (почва 50, ткань 5, вода 9). **Под неканоническими именами — 40 проб на трёх площадках.** Столбцов, которых карта не узнаёт вовсе, — ноль.

**Как читать строку:** площадка · тип и номер пробы, её метка · дата · лаборатория · исходный файл · какие имена неправильные и во что они должны лечь.
- `[both]` — каноническое имя УЖЕ лежит в этой же пробе рядом с неканоническим;
- `[suffix]` — имя узнано только после того, как снят суффикс метода (`pH_CaCl2` прочитан как `pH`). Это не то же показание под другим именем, а другое показание: pH в растворе CaCl2. Такую пробу перезагружать до решения нельзя, см. план.

## Burns — 26 проб

- soil #28 "Green 1" | date 2004-06-01 | lab not recorded | file: burns_gc_gilba_2026-03-16.json | EC1_5 -> EC [both]; pH_CaCl2 -> pH [suffix,both]; pH_Water -> pH [both]; CEC_meq100g -> CEC [both]
- soil #29 "Green 12" | date 2003-06-01 | lab not recorded | file: burns_gc_gilba_2026-03-16.json | EC1_5 -> EC [both]; pH_CaCl2 -> pH [suffix,both]; pH_Water -> pH [both]; CEC_meq100g -> CEC [both]
- soil #30 "Green 4" | date 2003-06-01 | lab not recorded | file: burns_gc_gilba_2026-03-16.json | EC1_5 -> EC [both]; pH_CaCl2 -> pH [suffix,both]; pH_Water -> pH [both]; CEC_meq100g -> CEC [both]
- soil #31 "Green 3" | date 2009-06-01 | lab not recorded | file: burns_gc_gilba_2026-03-16.json | EC1_5 -> EC [both]; pH_Water -> pH [both]; CEC_meq100g -> CEC [both]
- soil #32 "Green 7" | date 2003-06-01 | lab not recorded | file: burns_gc_gilba_2026-03-16.json | EC1_5 -> EC [both]; pH_CaCl2 -> pH [suffix,both]; pH_Water -> pH [both]; CEC_meq100g -> CEC [both]
- soil #33 "Green 7" | date 2004-06-01 | lab not recorded | file: burns_gc_gilba_2026-03-16.json | EC1_5 -> EC [both]; pH_CaCl2 -> pH [suffix,both]; pH_Water -> pH [both]; CEC_meq100g -> CEC [both]
- soil #34 "Green 8" | date 2004-06-01 | lab not recorded | file: burns_gc_gilba_2026-03-16.json | EC1_5 -> EC [both]; pH_CaCl2 -> pH [suffix,both]; pH_Water -> pH [both]; CEC_meq100g -> CEC [both]
- soil #35 "Green 11" | date 2004-06-01 | lab not recorded | file: burns_gc_gilba_2026-03-16.json | EC1_5 -> EC [both]; pH_CaCl2 -> pH [suffix,both]; pH_Water -> pH [both]; CEC_meq100g -> CEC [both]
- soil #36 "Green 16" | date 2009-06-01 | lab not recorded | file: burns_gc_gilba_2026-03-16.json | EC1_5 -> EC [both]; pH_Water -> pH [both]; CEC_meq100g -> CEC [both]
- soil #37 "Green 4" | date 2013-07-01 | lab not recorded | file: burns_gc_gilba_2026-03-16.json | EC1_5 -> EC [both]; pH_CaCl2 -> pH [suffix,both]; pH_Water -> pH [both]; CEC_meq100g -> CEC [both]
- soil #38 "Green 4" | date 2014-07-01 | lab not recorded | file: burns_gc_gilba_2026-03-16.json | EC1_5 -> EC [both]; pH_CaCl2 -> pH [suffix,both]; pH_Water -> pH [both]; CEC_meq100g -> CEC [both]
- soil #39 "Green 8" | date 2013-07-01 | lab not recorded | file: burns_gc_gilba_2026-03-16.json | EC1_5 -> EC [both]; pH_CaCl2 -> pH [suffix,both]; pH_Water -> pH [both]; CEC_meq100g -> CEC [both]
- soil #40 "Green 8" | date 2014-07-01 | lab not recorded | file: burns_gc_gilba_2026-03-16.json | EC1_5 -> EC [both]; pH_CaCl2 -> pH [suffix,both]; pH_Water -> pH [both]; CEC_meq100g -> CEC [both]
- soil #41 "Green 10" | date 2013-07-01 | lab not recorded | file: burns_gc_gilba_2026-03-16.json | EC1_5 -> EC [both]; pH_CaCl2 -> pH [suffix,both]; pH_Water -> pH [both]; CEC_meq100g -> CEC [both]
- soil #42 "Green 10" | date 2014-07-01 | lab not recorded | file: burns_gc_gilba_2026-03-16.json | EC1_5 -> EC [both]; pH_CaCl2 -> pH [suffix,both]; pH_Water -> pH [both]; CEC_meq100g -> CEC [both]
- soil #43 "Green 13" | date 2013-07-01 | lab not recorded | file: burns_gc_gilba_2026-03-16.json | EC1_5 -> EC [both]; pH_CaCl2 -> pH [suffix,both]; pH_Water -> pH [both]; CEC_meq100g -> CEC [both]
- soil #44 "Green 13" | date 2014-07-01 | lab not recorded | file: burns_gc_gilba_2026-03-16.json | EC1_5 -> EC [both]; pH_CaCl2 -> pH [suffix,both]; pH_Water -> pH [both]; CEC_meq100g -> CEC [both]
- soil #45 "Green 2" | date 2025-07-31 | lab not recorded | file: burns_gc_gilba_2026-03-16.json | pH_Water -> pH [both]; OM_Percent -> OM [both]; CEC_meq100g -> CEC [both]
- soil #46 "Green 4" | date 2025-07-31 | lab not recorded | file: burns_gc_gilba_2026-03-16.json | pH_Water -> pH [both]; OM_Percent -> OM [both]; CEC_meq100g -> CEC [both]
- soil #47 "Green 10" | date 2025-07-31 | lab not recorded | file: burns_gc_gilba_2026-03-16.json | pH_Water -> pH [both]; OM_Percent -> OM [both]; CEC_meq100g -> CEC [both]
- soil #48 "Green 15" | date 2025-07-31 | lab not recorded | file: burns_gc_gilba_2026-03-16.json | pH_Water -> pH [both]; OM_Percent -> OM [both]; CEC_meq100g -> CEC [both]
- soil #49 "Putter Green" | date 2024-07-24 | lab not recorded | file: burns_gc_gilba_2026-03-16.json | pH_Water -> pH [both]; OM_Percent -> OM [both]; CEC_meq100g -> CEC [both]
- soil #50 "Putter Green" | date 2025-07-31 | lab not recorded | file: burns_gc_gilba_2026-03-16.json | pH_Water -> pH [both]; OM_Percent -> OM [both]; CEC_meq100g -> CEC [both]
- soil #51 "12th Fairway" | date 2024-07-24 | lab not recorded | file: burns_gc_gilba_2026-03-16.json | pH_Water -> pH [both]; OM_Percent -> OM [both]; CEC_meq100g -> CEC [both]
- soil #52 "12th Fairway" | date 2025-07-31 | lab not recorded | file: burns_gc_gilba_2026-03-16.json | pH_Water -> pH [both]; OM_Percent -> OM [both]; CEC_meq100g -> CEC [both]
- soil #53 "Rye Nursery" | date 2025-07-31 | lab not recorded | file: burns_gc_gilba_2026-03-16.json | pH_Water -> pH; OM_Percent -> OM; CEC_meq100g -> CEC

## Hoxton Soccer - Kate's test — 1 проба

- water #326 "Simpsons lake" | date 2026-08-08 | lab not recorded | file: not recorded | P -> PO4

## New test - location — 13 проб

- soil #123 "Putter Green" | date 2024-10-03 | lab not recorded | file: wollongong_golf_club_gilba_2026-03-16.json | EC1_5 -> EC [both]; pH_Water -> pH [both]; OM_Percent -> OM [both]; CEC_meq100g -> CEC [both]
- soil #124 "Green 2" | date 2024-10-03 | lab not recorded | file: wollongong_golf_club_gilba_2026-03-16.json | EC1_5 -> EC; pH_Water -> pH; OM_Percent -> OM; CEC_meq100g -> CEC
- soil #125 "Green 11" | date 2024-10-03 | lab not recorded | file: wollongong_golf_club_gilba_2026-03-16.json | EC1_5 -> EC; pH_Water -> pH; OM_Percent -> OM; CEC_meq100g -> CEC
- soil #126 "Green 1" | date 2018-12-31 | lab not recorded | file: wollongong_golf_club_gilba_2026-03-16.json | EC1_5 -> EC [both]; pH_Water -> pH [both]; OM_Percent -> OM [both]; CEC_meq100g -> CEC [both]
- soil #127 "Green 5" | date 2018-12-31 | lab not recorded | file: wollongong_golf_club_gilba_2026-03-16.json | EC1_5 -> EC [both]; pH_Water -> pH [both]; OM_Percent -> OM [both]; CEC_meq100g -> CEC [both]
- soil #128 "Green 16" | date 2018-12-31 | lab not recorded | file: wollongong_golf_club_gilba_2026-03-16.json | EC1_5 -> EC [both]; pH_Water -> pH [both]; OM_Percent -> OM [both]; CEC_meq100g -> CEC [both]
- soil #129 "Green 7" | date 2019-12-31 | lab not recorded | file: wollongong_golf_club_gilba_2026-03-16.json | EC1_5 -> EC [both]; pH_Water -> pH [both]; CEC_meq100g -> CEC [both]
- soil #130 "Green 12" | date 2019-12-31 | lab not recorded | file: wollongong_golf_club_gilba_2026-03-16.json | EC1_5 -> EC [both]; pH_Water -> pH [both]; CEC_meq100g -> CEC [both]
- soil #131 "Green 4" | date 2020-12-31 | lab not recorded | file: wollongong_golf_club_gilba_2026-03-16.json | EC1_5 -> EC [both]; pH_Water -> pH [both]; OM_Percent -> OM [both]; CEC_meq100g -> CEC [both]
- soil #132 "Green 6" | date 2020-12-31 | lab not recorded | file: wollongong_golf_club_gilba_2026-03-16.json | EC1_5 -> EC [both]; pH_Water -> pH [both]; OM_Percent -> OM [both]; CEC_meq100g -> CEC [both]
- soil #133 "Green 7" | date 2020-12-31 | lab not recorded | file: wollongong_golf_club_gilba_2026-03-16.json | EC1_5 -> EC [both]; pH_Water -> pH [both]; OM_Percent -> OM [both]; CEC_meq100g -> CEC [both]
- soil #134 "Green 12" | date 2020-12-31 | lab not recorded | file: wollongong_golf_club_gilba_2026-03-16.json | EC1_5 -> EC [both]; pH_Water -> pH [both]; OM_Percent -> OM [both]; CEC_meq100g -> CEC [both]
- soil #135 "Green No 8" | date 2019-08-07 | lab not recorded | file: wollongong_golf_club_gilba_2026-03-16.json | EC1_5 -> EC; pH_Water -> pH; CEC_meq100g -> CEC

## Отдельно

- **Burns, почва #51 «12th Fairway», 2024-07-24:** в пробе два разных pH — `pH_Water` 5.5 и `pH` 6.6. Прогон сегодня читает `pH_Water`. При записи под одно имя одно из двух значений уйдёт; какое — сказано в плане.
- **Hoxton Soccer - Kate's test, вода #326 «Simpsons lake»:** исходный файл НЕ ЗАПИСАН. Перезагружать нечем, пока файл не найден. Кроме того, `P -> PO4` здесь не переименование: `P` — фосфор, `PO4` — фосфат, это разные величины (открытый вопрос в плане).
- **Исходные файлы по двум площадкам есть у нас:** `gilbahub/files/burns_gc_gilba_2026-03-16.json` (26 проб Burns) и `gilbahub/files/wollongong_golf_club_gilba_2026-03-16.json` (13 проб New test - location). Оба — файлы площадки целиком, а импорт файла площадки удаляет всё, что на ней было, и загружает только то, что в файле (правило владельца). Перезагрузка ими заменит на площадке всё, не только пробы.

## Что при этом не проверено

- Совпадают ли значения в исходных файлах с тем, что лежит в базе сейчас: файлы я не открывала и не сверяла.

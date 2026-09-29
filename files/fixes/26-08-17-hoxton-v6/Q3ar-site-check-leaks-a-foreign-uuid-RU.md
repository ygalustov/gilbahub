# Пункт 3ар — замер по форме 38.4: сверка площадки отвечает раньше права писать и отдаёт чужой UUID

Снято разработчиком 24.09.2026. Набор: `app/tests/Feature/Gh666DoesTheSiteCheckLeakOtherAccountsTest.php`.
Тестовая база (SQLite), свои фабрики, стенд не тронут. Тело ответа печатается **целиком** до утверждений.

**Чей это код: мой, GH-663.** Отказ называл владельца пробы, чтобы человеку было понятно, что не так, — и вместе с
понятностью отдал идентификатор площадки, которой человек не видит.

**Оба исхода были названы до прогона. Наступил первый: чтение аналитика подтверждено, все пять случаев.**

## Что вышло

| случай | статус | что в теле |
|---|---|---|
| 1. U пишет на SA, в теле проба SB (`KEY_B`) | **422** | `belongsTo: [UUID SB]` — **площадки, которой U не видит** |
| 2. То же с **удалённой** пробой SB (`KEY_T`) | **422** | `belongsTo: [UUID SB]` — удалённые отвечают так же |
| 3. U пишет на SC (права нет), проба SB | **422**, не `403` | `belongsTo: [UUID SB]`, `filedUnder: UUID SC` |
| 4. Контроль: U пишет на SA свою пробу | **200** | чужих UUID нет |
| 5. U пишет на SC (права нет) своей пробой | **422**, не `403` | `belongsTo: [UUID SA]` — его собственная, утечки нет |

**Три вывода, каждый — прямо из тела:**
1. **Утечка есть и она в `belongsTo`.** В случаях 1–3 приходит UUID площадки другого аккаунта. Право писать на SA у
   пользователя есть, права видеть SB — нет.
2. **Сверка отвечает раньше права писать.** Случаи 3 и 5 адресованы площадке, на которую у U прав нет, и оба дают
   `422`, а не `403`. Случай 5 показывает это без всякой утечки: там UUID его собственной площадки.
3. **Удалённая проба не тише живой.** Случай 2 отвечает тем же UUID: `withTrashed()` в сверке снимает и её.

**Границы замера, названы.** Тестовая база SQLite; приведение типов здесь не воспроизводится (та же граница, что в
GH-663). Пять случаев — это пять пар площадок, не перебор. `filedUnder` в случае 3 несёт UUID SC, но его прислал сам
пользователь, поэтому утечкой это не является.

## Устройство — не делал

По 38.4 оно за пределами замера: в ответе `422` не должно быть `belongsTo` вовсе, человеку и кадру достаточно «пробы не
этой площадки», подробности — в журнал сервера; право писать проверяется до сверки. ≈2 места. Жду решения.

## Полный вывод прогона, дословно

```
SA=01a0d10d-7bcf-728b-accd-18f14e462764 (U is manager here)
SB=01a0d10d-7bd2-71a7-8847-b7f82556bf49 (another account; U cannot see it)
SC=01a0d10d-7bd2-71a7-8847-b7f826422e57 (another account; U cannot see it)
1. U writes on SA, body carries SB's sample KEY_B
   status 422 body {"error":"site-mismatch","message":"the result did not belong to the site the run was started for","detail":{"filedUnder":"01a0d10d-7bcf-728b-accd-18f14e462764","foreignSamples":[{"type":"soil","sample":"KEY_B","belongsTo":["01a0d10d-7bd2-71a7-8847-b7f82556bf49"]}],"by":"samples"}}
2. U writes on SA, body carries SB's DELETED sample KEY_T
   status 422 body {"error":"site-mismatch","message":"the result did not belong to the site the run was started for","detail":{"filedUnder":"01a0d10d-7bcf-728b-accd-18f14e462764","foreignSamples":[{"type":"soil","sample":"KEY_T","belongsTo":["01a0d10d-7bd2-71a7-8847-b7f82556bf49"]}],"by":"samples"}}
3. U writes on SC (no right) with SB's sample KEY_B
   status 422 body {"error":"site-mismatch","message":"the result did not belong to the site the run was started for","detail":{"filedUnder":"01a0d10d-7bd2-71a7-8847-b7f826422e57","foreignSamples":[{"type":"soil","sample":"KEY_B","belongsTo":["01a0d10d-7bd2-71a7-8847-b7f82556bf49"]}],"by":"samples"}}
4. CONTROL: U writes on SA with his own KEY_A
   status 200 body {"ok":true,"outcome":"partial"}
5. U writes on SC (no right) with his OWN KEY_A
   status 422 body {"error":"site-mismatch","message":"the result did not belong to the site the run was started for","detail":{"filedUnder":"01a0d10d-7bd2-71a7-8847-b7f826422e57","foreignSamples":[{"type":"soil","sample":"KEY_A","belongsTo":["01a0d10d-7bcf-728b-accd-18f14e462764"]}],"by":"samples"}}
what came back: {"1":{"status":422,"mentionsSB":true,"mentionsSA":true,"hasBelongsTo":true},"2":{"status":422,"mentionsSB":true,"mentionsSA":true,"hasBelongsTo":true},"3":{"status":422,"mentionsSB":true,"mentionsSA":false,"hasBelongsTo":true},"5":{"status":422,"mentionsSB":false,"mentionsSA":true,"hasBelongsTo":true}}

```

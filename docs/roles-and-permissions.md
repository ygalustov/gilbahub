# Roles & Permissions — Plan

## Overview

Чистый RBAC. Четыре уровня, один глобальный + три per-site. Никаких отдельных прав — только роли.

```
Admin (global)
  └── Manager (per site)
        ├── Editor (per site)
        └── Viewer (per site)
```

---

## Role Definitions

### Admin `users.is_admin = true`

- Видит и управляет всеми сайтами без записи в `site_user`
- Полный доступ к любому функционалу
- Может приглашать и назначать роли **manager / editor / viewer** на любой сайт
- Может одобрять/отклонять pending-пользователей (self-registration)
- Флаг выставляется только через Artisan-команду — никогда через API

### Manager `site_user.role = 'manager'`

- Видит только свои сайты
- Всё что может Editor — плюс управление доступом пользователей
- Может приглашать и назначать роли **manager / editor / viewer** на своих сайтах
- Может удалять пользователей со своих сайтов
- Назначается Admin-ом или Manager-ом

### Editor `site_user.role = 'editor'`

- Видит только свои сайты
- Загрузка данных (soil, water, tissue, spray log, sensor CSV)
- Удаление записей
- Запуск анализа
- Редактирование настроек сайта (локация, вид травы, интеграции)
- **Не может** управлять пользователями
- Назначается Admin-ом или Manager-ом

### Viewer `site_user.role = 'viewer'`

- Видит только свои сайты
- Только просмотр — dashboard, анализ, данные, отчёты
- **Не может** ничего изменять, загружать, удалять
- **Не может** управлять пользователями
- Назначается Admin-ом или Manager-ом

---

## Permission Matrix

| Действие                        | Admin | Manager | Editor | Viewer |
|---------------------------------|:-----:|:-------:|:------:|:------:|
| Видит все сайты                 |  ✓    |  —      |  —     |  —     |
| Просмотр dashboard / анализа    |  ✓    |  ✓      |  ✓     |  ✓     |
| Просмотр данных                 |  ✓    |  ✓      |  ✓     |  ✓     |
| Загрузка данных                 |  ✓    |  ✓      |  ✓     |  —     |
| Удаление записей                |  ✓    |  ✓      |  ✓     |  —     |
| Запуск анализа                  |  ✓    |  ✓      |  ✓     |  —     |
| Настройки сайта                 |  ✓    |  ✓      |  ✓     |  —     |
| Настройка интеграций (сенсоры)  |  ✓    |  ✓      |  ✓     |  —     |
| Приглашение manager/editor/viewer|  ✓   |  ✓      |  —     |  —     |
| Удаление пользователя с сайта   |  ✓    |  ✓      |  —     |  —     |
| Одобрение pending-пользователей |  ✓    |  —      |  —     |  —     |
| Глобальное управление (все сайты)|  ✓   |  —      |  —     |  —     |

---

## Database

### `users` — добавить колонки

```sql
is_admin              BOOLEAN NOT NULL DEFAULT FALSE
status                ENUM('active', 'pending', 'suspended') NOT NULL DEFAULT 'active'
password_hash         VARCHAR(255) NULLABLE        -- null = только Magic Link
password_prompt_shown BOOLEAN NOT NULL DEFAULT FALSE
```

### `sites` — добавить колонку

```sql
provisional_name  BOOLEAN NOT NULL DEFAULT FALSE
-- true = имя временное (сайт создан автоматически при апруве Flow B)
--   → wizard показывает поле «Site name» в Welcome step (шаг 0, до Location)
--   → при сохранении wizard: PATCH sites/{id} { name: ... }, флаг сбрасывается в false
-- false = имя уже задано (сайт создан вручную через UI), поле в wizard не показывается
```

### `site_user` — обновить роли

Текущий дефолт: `'manager'`. Оставить.
Исправить: SiteController пишет `'owner'` — заменить на `'manager'`, добавить миграцию для существующих строк.

Допустимые значения: `'manager'`, `'editor'`, `'viewer'`.

### Новая таблица `invitations`

```sql
id              BIGINT PK
email           VARCHAR(255) NOT NULL
role            ENUM('manager','editor','viewer') NOT NULL
site_id         UUID NOT NULL FK → sites.id   -- всегда к конкретному сайту
invited_by      FK → users.id NOT NULL
created_at      TIMESTAMP NOT NULL

UNIQUE(email, site_id)   -- нельзя пригласить один email дважды на один сайт
```

Инвайт бессрочный — действует пока Admin/Manager не отзовёт. Нет токена, нет `expires_at` — email в таблице и есть ключ.

---

## Getting Started Panel — поведение по ролям

Панель Getting Started показывает шаги по заполнению сайта (soil, water, tissue, sensors, analysis).

- **Viewer** — панель **не показывается**. Viewer не может выполнить ни один шаг, показывать бессмысленно.
- **Editor / Manager / Admin** — панель показывается. Шаги отражают состояние **сайта**, а не конкретного пользователя — если Admin уже загрузил soil test до инвайта, приглашённый Editor увидит этот шаг уже выполненным.

Реализация: добавить `activeSiteRole` в `GAIP_HUB_CONFIG` (из DashboardController), в `initGettingStarted()` добавить проверку роли перед показом панели.

---

## Registration & Onboarding Flows

### Flow A — Invite + Magic Link (реализовать первым)

**Шаг 1 — Admin/Manager приглашает:**
1. Нажимает **Invite** в Settings → Users
2. Вводит email + выбирает роль (manager / editor / viewer)
3. Сервер сохраняет email в `invitations`, отправляет письмо: «Вас пригласили в Gilba — войдите на сайт»

**Шаг 2 — Пользователь входит:**
1. Открывает страницу логина
2. Вводит email → нажимает **Send Magic Link**
3. Сервер всегда отвечает одинаково: «If this email is recognized, you'll receive a link shortly» — не раскрываем ни наличие аккаунта, ни наличие инвайта (слово «registered» намеренно не используется — приглашённый без аккаунта тоже получает ссылку)
4. Если email есть в `invitations` или уже есть аккаунт → реально отправляется Magic Link; если неизвестен → письмо не отправляется, но ответ тот же
5. Пользователь кликает ссылку → MagicLinkController обрабатывает токен:
   - Если аккаунт **уже существует** (повторный вход): создаётся полная auth-сессия (`Auth::login($user)`) → сразу на шаг 6
   - Если аккаунт **не существует** (первый вход): аккаунт ещё не создан, полная auth-сессия невозможна без `user_id` → вместо этого сохраняем email во временный session-ключ: `session(['pending_magic_email' => $email])` → редирект на `/welcome` (без токена в URL):
   ```
   Welcome to Gilba!
   What's your name?
   [________________]
   [Continue]
   ```
   `/welcome` доступна только если `session('pending_magic_email')` установлен (иначе редирект на логин).
   После Submit на `/welcome`: аккаунт создаётся (`users` insert), `status = 'active'`, создаётся полная auth-сессия (`Auth::login($newUser)`), временный ключ удаляется
6. Все pending инвайты для этого email обрабатываются сразу — пользователь добавляется во все `site_user` записи одновременно (один email мог быть приглашён на несколько сайтов разными менеджерами). После обработки обработанные записи удаляются из `invitations`.
   ⚠️ Обработка pending инвайтов происходит при **любом** успешном входе (Magic Link или пароль) — не только при первом. Если существующий пользователь получил новый инвайт и войдёт по паролю, инвайт должен обработаться так же.
7. Редирект на dashboard

**Magic Link токен:**
- `Str::random(64)`, хранится в таблице `magic_links`
- Одноразовый, истекает через **15 минут**
- После использования — удаляется
- При запросе нового Magic Link все старые для того же email удаляются — только последняя ссылка активна

### Password Setup Banner

На dashboard показывается banner при каждом входе пока `password_prompt_shown = false` (не только при первом — игнорирование баннера без клика «Not now»/«×» не сбрасывает флаг):

```
┌─────────────────────────────────────────────────────────────────┐
│  Want faster sign-in? Set up a password — or keep using         │
│  Magic Link every time.          [Set password]  [Not now]  ×   │
└─────────────────────────────────────────────────────────────────┘
```

**Когда показывается:**
- Только если `password_prompt_shown = false` — единственное условие
- Не показывается повторно после «Not now», «×» или установки пароля

**Клик «Set password»:**
- Открывается модальное окно с полями «New password» + «Confirm password»
- После сохранения: banner исчезает, `password_prompt_shown = true`, toast «Password set. You can now sign in with your password»

**Клик «Not now» или «×»:**
- Banner исчезает навсегда
- Флаг `password_prompt_shown = true` сохраняется в БД
- Опция остаётся доступна в **Settings → Profile** в любой момент

**Страница логина:**
```
Email:    [________________]
Password: [________________]   ← всегда видно; если пароль не установлен — просто не заполнять
          Forgot password?     ← ссылка рядом с полем пароля

[Sign in]

── or ──

[Send Magic Link]

Don't have an account? [Register]   ← только если self-registration включена в конфиге
```
Если пользователь ввёл email без пароля и нажал Sign in:
- Если email не найден в системе → «No password set — use Magic Link instead» (тот же ответ что при отсутствии пароля — не раскрываем что email неизвестен)
- Если пароль не установлен → «No password set — use Magic Link instead»
- Если пароль установлен → «Please enter your password»

Если пользователь ввёл неверный пароль → «Incorrect password»

**Сброс пароля:**
Кнопка «Forgot password?» рядом с полем пароля — использует email, уже введённый в поле Email выше. Если поле Email пустое → инлайн-подсказка: «Enter your email address first». Если email заполнен → тот же механизм Magic Link, но ссылка содержит query-параметр `?password_reset=1`; пользователь сразу видит инлайн-ответ рядом с кнопкой: «If this email has an account, you'll receive a reset link shortly» (тот же нейтральный ответ независимо от того существует ли аккаунт — anti-enumeration). После клика по ссылке из письма — вместо редиректа на dashboard — пользователь попадает в Settings → Profile, где сразу открывается модал «Set new password» (поля «New password» + «Confirm password», без «Current password» — верификация уже пройдена через Magic Link).

---


### Flow B — Self-registration + approval

Предназначен для новых клиентов, которым нужен свой сайт. Viewer/Editor-доступ к существующим сайтам — только через Flow A (invite от Manager).

1. Пользователь регистрируется на `/register` (email + имя) → `status = 'pending'` → видит страницу-подтверждение прямо на `/register`: «Your request has been submitted. You'll receive an email once your account is approved.» (не `/pending` — это отдельная страница)
2. Если пользователь пытается войти позже, пока ещё не одобрен → `EnsureUserIsActive` делает редирект на `/pending` (экран ожидания с кнопкой Sign out)
3. Admin получает уведомление (email) → вкладка Pending в Settings → Users
4. Admin принимает решение — два взаимоисключающих варианта:

   **Вариант A — Одобряет** (один клик, без выбора роли/сайта) → система автоматически:
   - создаёт сайт с временным именем («{Имя}'s site»), флаг `provisional_name = true`
   - назначает пользователя **Manager** этого сайта
   - устанавливает `status = 'active'`
   - отправляет письмо с Magic Link для первого входа

5. После одобрения: Пользователь входит → проходит onboarding wizard; DashboardController передаёт флаг в `GAIP_HUB_CONFIG` (аналогично `activeSiteRole`): `provisionalName: true`. Wizard читает `GAIP_HUB_CONFIG.provisionalName` и, если `true`, добавляет поле «Site name» в Welcome step (шаг 0) — пользователь вводит настоящее название сайта (отдельно от location в шаге 1). Поле обязательное — кнопка «Next» заблокирована пока поле пустое. Site name сохраняется сразу при клике «Next» на шаге 0 (до перехода на шаг 1): `PATCH sites/{id} { name }`, `provisional_name → false` — чтобы имя не потерялось если пользователь закроет wizard после шага 0. → попадает на dashboard → видит Getting Started panel

   **Вариант B — Отклоняет** (вместо шагов 4A–5): аккаунт **удаляется** — пользователь может зарегистрироваться снова.
   ⚠️ При удалении аккаунта: также инвалидировать сессию пользователя (`DB::table('sessions')->where('user_id', $userId)->delete()`), чтобы активная сессия не стала «призраком» с несуществующим user_id.

Flow A (invite) и Flow B (self-registration) сосуществуют. Self-registration включается флагом в конфиге — можно отключить если нужен только invite-only режим.

---

## Backend Implementation

### Middleware

**`EnsureUserIsActive`** — на все `auth`-маршруты **кроме `/pending` и `/logout`**:
```php
if ($request->user()->status === 'pending') {
    return redirect('/pending'); // страница «Ожидайте одобрения»
}
if ($request->user()->status === 'suspended') {
    abort(403, 'Your account has been suspended.');
}
```
⚠️ Маршрут `/pending` должен быть **исключён** из этого middleware (через `except` или отдельную группу маршрутов) — иначе pending-пользователь попадёт в бесконечный цикл редиректов: `/любой-роут` → `/pending` → middleware → `/pending` → ...
Suspended блокируется даже если `is_admin = true` — suspension всегда в приоритете.
⚠️ Если в системе только один Admin и он suspended — разблокировать можно только через Artisan: `php artisan user:unsuspend {email}`.
⚠️ Существующие сессии не уничтожаются в момент suspension — следующий запрос заблокируется middleware. Если нужна немедленная инвалидация всех сессий — `DB::table('sessions')->where('user_id', $userId)->delete()` (при условии database session driver).

### Helper-методы на модели User

```php
public function roleOnSite(Site $site): ?string
{
    if ($this->is_admin) return 'admin';
    return $this->sites()
        ->where('sites.id', $site->id)
        ->first()?->pivot->role;
}

public function canManageSite(Site $site): bool  // manager+
{
    return in_array($this->roleOnSite($site), ['admin', 'manager']);
}

public function canEditSite(Site $site): bool    // editor+
{
    return in_array($this->roleOnSite($site), ['admin', 'manager', 'editor']);
}

public function canViewSite(Site $site): bool    // viewer+
{
    return $this->roleOnSite($site) !== null;
}
```

### Проверки в контроллерах

```php
// Просмотр
abort_unless($request->user()->canViewSite($site), 403);

// Загрузка / удаление / настройки
abort_unless($request->user()->canEditSite($site), 403);

// Управление пользователями
abort_unless($request->user()->canManageSite($site), 403);
```

### Admin — автоматический проход

```php
// AppServiceProvider.php
Gate::before(function (User $user) {
    if ($user->is_admin) return true;
});
```

### Защита от escalation (server-side)

Менеджер может выдать любую роль до manager включительно.
Admin через API может выдать manager/editor/viewer. `is_admin` выставляется только через Artisan — никогда через API.

```php
private function assertCanGrantRole(User $actor, Site $site, string $targetRole): void
{
    // Предполагает, что canManageSite уже проверен выше в контроллере.
    // Без этой проверки Viewer (level 1) мог бы выдать роль Viewer (1 >= 1).

    // 'admin' нельзя выдать через API никому — только через Artisan
    abort_if($targetRole === 'admin', 403);

    $hierarchy = ['viewer' => 1, 'editor' => 2, 'manager' => 3];
    $actorLevel = $actor->is_admin ? 3 : ($hierarchy[$actor->roleOnSite($site)] ?? 0);
    $targetLevel = $hierarchy[$targetRole] ?? 0;

    abort_unless($actorLevel >= $targetLevel, 403);
}
```

### Новая таблица `magic_links`

```sql
id          BIGINT PK
token       VARCHAR(64) UNIQUE NOT NULL   -- Str::random(64)
email       VARCHAR(255) NOT NULL
expires_at  TIMESTAMP NOT NULL            -- 15 минут
created_at  TIMESTAMP NOT NULL
```

### Invitation & Magic Link security

- Инвайт бессрочный — действует пока Admin/Manager не отзовёт вручную
- Один email может быть приглашён на один сайт только один раз (UNIQUE constraint)
- Если пользователь уже существует и получает новый инвайт на другой сайт — просто добавляется в `site_user`, новый аккаунт не создаётся
- Magic Link: одноразовый, 15 минут, удаляется после использования
- На запрос Magic Link: одинаковый ответ для известных и неизвестных email — не раскрываем кто зарегистрирован
- Rate limit: максимум 3 Magic Link запроса с одного email в час, максимум 10 с одного IP в час
- Rate limit на попытки входа с паролем: максимум 5 попыток в минуту с одного IP (brute force защита)

### Password security

- Минимум 8 символов
- Хранится как bcrypt hash (`password_hash` в `users`)
- «Change password» требует подтверждения через текущий пароль ИЛИ Magic Link (если пароль забыт)
- `password_prompt_shown = true` выставляется при: установке пароля, клике «Not now», клике «×» — после этого баннер больше не показывается независимо от того установлен ли пароль

---

## UI — Settings → Users

Вкладка видна только Manager и Admin. Editor и Viewer её не видят.
Размещается между Integrations и Profile.

---

### Manager view — пользователи активного сайта

```
Users                                              [+ Invite]

[Search by name or email…]    Role: [All roles ▾]

 NAME              EMAIL                   ROLE       
 ─────────────────────────────────────────────────────────────
 Kate G.      ·    kate@example.com        [Manager]    —        ← (you)
 John D.      ·    john@example.com        [Editor]     [•••]
 Sarah M.     ·    sarah@example.com       [Viewer]     [•••]
```

**Role badges — цвет по роли:**
- Manager — тёмно-зелёный
- Editor — синий
- Viewer — серый

**[•••] dropdown на каждой строке (кроме себя):**
```
 Change role →  [ Manager ]
                [ Editor  ]   ← текущая отмечена
                [ Viewer  ]
 ──────────────
 Remove from site
```
Смена роли — inline, без модала, с подтверждением тостом.
«Remove from site» — confirm dialog: «Remove John D. from this site?»

**Pending invitations** — секция ниже таблицы (если есть):
```
 Pending invitations
 ─────────────────────────────────────────────────────────────
 worker@example.com        [Viewer]     Invited 2 days ago   [×]
 boss@example.com          [Manager]    Invited 5 hours ago  [×]
```
[×] отзывает инвайт (удаляет запись из `invitations`).

---

### Admin view — отличия от Manager

Admin видит пользователей через фильтр по сайтам:

```
Users                                              [+ Invite]

[Search by name, email or site…]    Site: [All sites ▾]    Role: [All roles ▾]

 NAME              EMAIL                SITE          ROLE      
 ──────────────────────────────────────────────────────────────────
 Kate G.      ·    kate@example.com     Golf Club A   [Manager]  [•••]
 John D.      ·    john@example.com     Golf Club A   [Editor]   [•••]
 Sarah M.     ·    sarah@example.com    Stadium B     [Viewer]   [•••]
```

**[•••] для Admin** (кроме собственной строки — на себе [•••] не показывается):
```
 Change role →  [ Manager ]
                [ Editor  ]   ← текущая отмечена
                [ Viewer  ]
 ──────────────
 Remove from site
 ──────────────
 Suspend account      ← если active
 Unsuspend account    ← если suspended (строка выделена серым)
```
«Suspend account» → confirm → `status = 'suspended'`, пользователь теряет доступ при следующем запросе (существующая сессия блокируется middleware; для немедленной инвалидации — удалить сессию через DB, см. раздел Middleware).
Suspended пользователи показываются в таблице серым цветом с badge [Suspended].

**Вкладки внутри Users (только у Admin):**
```
[ Active ]  [ Pending (2) ]  [ Suspended ]
```

Вкладка **Pending** — пользователи из Flow B (self-registration), роли ещё нет:
```
[Search by name or email…]

 NAME        EMAIL                    REGISTERED      
 ──────────────────────────────────────────────────────
 Alex B.     alex@example.com         10 min ago       [Approve]  [Reject]
 Tom C.      tom@example.com          2 hours ago      [Approve]  [Reject]
```
«Approve» → сайт создаётся автоматически («{Имя}'s site»), пользователь становится Manager, отправляется Magic Link. Без подтверждения — один клик, никакого модала.
«Reject» → confirm → аккаунт **удаляется**. Пользователь может зарегистрироваться снова. Не используем `status = 'suspended'` — чтобы не смешивать «не одобрен» с «заблокирован за нарушения».

Вкладка **Suspended** — заблокированные пользователи, кнопка [Unsuspend] на каждой строке.

**Pending invitations** — отдельная секция ниже таблицы на вкладке Active (аналогично Manager view), показывает неотвеченные инвайты **по всем сайтам** независимо от выбранного Site-фильтра — Admin должен видеть все невостребованные инвайты глобально.

---

### Invite modal — Manager

```
┌─────────────────────────────────────────┐
│  Invite to Golf Club A              [×] │
│                                         │
│  Email                                  │
│  [_____________________________]        │
│                                         │
│  Role                                   │
│  ○ Manager                              │
│  ● Editor                               │
│  ○ Viewer                               │
│                                         │
│  [Send invitation]   [Cancel]           │
└─────────────────────────────────────────┘
```
После отправки: строка появляется в «Pending invitations», toast «Invitation sent to worker@example.com».
Если email уже на этом сайте (запись в `site_user`) → ошибка инлайн: «This user already has access to this site».
Если для этого email уже есть pending invite на этот сайт (запись в `invitations`) → ошибка инлайн: «A pending invitation already exists for this email».

### Invite modal — Admin (дополнительно выбор сайта)

```
┌─────────────────────────────────────────┐
│  Invite user                        [×] │
│                                         │
│  Email                                  │
│  [_____________________________]        │
│                                         │
│  Site                                   │
│  [Golf Club A              ▾]           │
│                                         │
│  Role                                   │
│  ○ Manager  ● Editor  ○ Viewer          │
│                                         │
│  [Send invitation]   [Cancel]           │
└─────────────────────────────────────────┘
```
Те же ошибки инлайн что и в Manager modal: «This user already has access to this site» и «A pending invitation already exists for this email» — проверка по выбранному Site.

---

### Empty state (нет пользователей кроме себя)

```
         [person icon]
    No other users on this site yet.
    Invite a manager, editor, or viewer
    to collaborate.

         [+ Invite someone]
```

---

## UI — `/register` (Flow B — self-registration)

```
┌─────────────────────────────────────────┐
│  Create account                         │
│                                         │
│  Name                                   │
│  [_____________________________]        │
│                                         │
│  Email                                  │
│  [_____________________________]        │
│                                         │
│  [Request access]                       │
│                                         │
│  Already have an account? [Sign in]     │
└─────────────────────────────────────────┘
```

После отправки — варианты:
- Email свободен → аккаунт создаётся с `status = 'pending'` → страница-подтверждение: «Your request has been submitted. You'll receive an email once your account is approved.»
- Email уже существует (active или pending) → **не раскрываем** разницу; тот же нейтральный ответ что и при успехе — не говорим есть ли аккаунт (anti-enumeration)
- Email принадлежит suspended пользователю → тот же нейтральный ответ; аккаунт не создаётся повторно

---

## UI — `/pending` (ожидание одобрения)

Показывается пользователям с `status = 'pending'` при любой попытке зайти в систему (редирект из `EnsureUserIsActive`).

```
┌─────────────────────────────────────────┐
│                                         │
│           [clock icon]                  │
│                                         │
│   Your account is pending approval      │
│                                         │
│   We've notified our team. You'll       │
│   receive an email when you're          │
│   approved.                             │
│                                         │
│           [Sign out]                    │
│                                         │
└─────────────────────────────────────────┘
```

---

## UI — Settings → Profile

Profile — последняя вкладка в Settings (после всех остальных), чтобы при открытии Settings всегда открывался список сайтов первым.

Порядок вкладок: Sites → Site settings → Turf profile → Zones → Import → Integrations → Users → **Profile**

Доступна всем пользователям (любая роль). Порядок секций:

**1. Account**
```
Name
[________________]   [Save]

Email
kate@example.com     (read-only — смена email требует верификации, реализовать позже)
```

**2. Security**

**Если пароль не установлен:**
```
Password
You're signing in with Magic Link only.
[Set a password]
```
Клик → модальное окно: поле «New password» + «Confirm password» → сохранить.

**Если пароль уже установлен:**
```
Password
Last changed: 3 June 2026
[Change password]
```
- «Change password» → модальное окно: «Current password» + «New password» + «Confirm password» + ссылка «Forgot current password? Send Magic Link» (запускает тот же flow что и «Forgot password?» на странице логина)

**DB** — поля `password_hash` и `password_prompt_shown` учтены в секции Database выше.

---

## Security Fixes — до начала реализации

1. **`DataController.destroy()` — null activeSite**
   ```php
   $activeSite = $request->user()->activeSite;
   abort_unless($activeSite, 403);
   ```

2. **Role mismatch `'owner'` vs `'manager'`**
   SiteController пишет `'owner'` — исправить на `'manager'`.
   Миграция: `UPDATE site_user SET role = 'manager' WHERE role = 'owner'`.

3. **`abortUnlessMember` не проверяет роль**
   Заменить на `canViewSite` / `canEditSite` / `canManageSite` во всех контроллерах.

---

## Implementation Order

1. Security fixes (выше)
2. Миграция: `users.is_admin`, `users.status`, `users.password_hash`, `users.password_prompt_shown`, `sites.provisional_name`, таблицы `invitations` + `magic_links`, нормализация `site_user.role`
3. `EnsureUserIsActive` middleware
4. Helper-методы на User: `roleOnSite`, `canViewSite`, `canEditSite`, `canManageSite`
5. `Gate::before` для admin
6. Обновить все контроллеры на role-aware проверки
7. Artisan-команды: `user:make-admin {email}` (создаёт пользователя если не существует, затем выставляет `is_admin = true` — единственный способ создать первого Admin), `user:unsuspend {email}`
8. Magic Link auth: редизайн страницы логина (+ ссылка на `/register` если self-reg включена) + MagicLinkController + `/magic/{token}` + страница `/welcome` (ввод имени при первом входе); обновить `AuthController.login()` — пароль опциональный, новые error messages («No password set», «Incorrect password»), обработка pending инвайтов при каждом успешном входе (пароль или Magic Link); Password Setup Banner на dashboard. ⚠️ «Forgot password» redirect в Settings → Profile с модалом «Set new password» зависит от step 11 — реализовать redirect сейчас, модал доделать в step 11
9. InvitationController + письмо-уведомление при инвайте
10. Settings → Users UI (manager view, затем admin view)
11. Settings → Profile UI (Set/Change password, имя)
12. Getting Started Panel — проверка роли (не показывать Viewer)
13. Self-registration: `/register` route + страница `/pending` (Flow B) + уведомление Admin при новой регистрации

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
- Может назначать менеджеров на любой сайт
- Может одобрять/отклонять pending-пользователей
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

### `site_user` — обновить роли

Текущий дефолт: `'manager'`. Оставить.
Исправить: SiteController пишет `'owner'` — заменить на `'manager'`, добавить миграцию для существующих строк.

Допустимые значения: `'manager'`, `'editor'`, `'viewer'`.

### Новая таблица `invitations`

```sql
id              BIGINT PK
email           VARCHAR(255)
role            ENUM('manager','editor','viewer')
site_id         UUID NOT NULL FK → sites.id   -- всегда к конкретному сайту
invited_by      FK → users.id NOT NULL
created_at      TIMESTAMP

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
3. Сервер всегда отвечает одинаково: «If this email is registered, you'll receive a link shortly» — не раскрываем есть ли аккаунт
4. Если email есть в `invitations` или уже есть аккаунт → реально отправляется Magic Link; если неизвестен → письмо не отправляется, но ответ тот же
5. Пользователь кликает ссылку → если первый вход: вводит имя → аккаунт создаётся, `status = 'active'`
6. Все pending инвайты для этого email обрабатываются сразу — пользователь добавляется во все `site_user` записи одновременно (один email мог быть приглашён на несколько сайтов разными менеджерами). После обработки обработанные записи удаляются из `invitations`
7. Редирект на dashboard

**Magic Link токен:**
- `Str::random(64)`, хранится в таблице `magic_links`
- Одноразовый, истекает через **15 минут**
- После использования — удаляется
- При запросе нового Magic Link все старые для того же email удаляются — только последняя ссылка активна

### Password Setup Banner

После первого входа на dashboard показывается одноразовый banner:

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

[Sign in]

── or ──

[Send Magic Link]
```
Если пользователь ввёл email без пароля и нажал Sign in:
- Если пароль не установлен → «No password set — use Magic Link instead»
- Если пароль установлен → «Please enter your password»

Если пользователь ввёл неверный пароль → «Incorrect password»

**Сброс пароля:**
Кнопка «Forgot password?» рядом с полем пароля → тот же механизм Magic Link, но ссылка содержит query-параметр `?password_reset=1`. После клика по ссылке — вместо редиректа на dashboard — пользователь попадает в Settings → Profile, где сразу открывается модал «Set new password» (поля «New password» + «Confirm password», без «Current password» — верификация уже пройдена через Magic Link).

---

### Flow B — Self-registration + approval (опционально, позже)

1. Пользователь регистрируется самостоятельно → `status = 'pending'`
2. Видит только экран «Ожидайте одобрения»
3. Admin получает уведомление → вкладка Pending в Settings → Users
4. Admin одобряет: выбирает роль + сайт → `status = 'active'`
5. Пользователь получает письмо с Magic Link для первого входа

Оба flow могут сосуществовать. Self-registration включается флагом в конфиге.

---

## Backend Implementation

### Middleware

**`EnsureUserIsActive`** — на все `auth`-маршруты:
```php
if ($request->user()->status === 'pending') {
    return redirect('/pending'); // страница «Ожидайте одобрения»
}
if ($request->user()->status === 'suspended') {
    abort(403, 'Your account has been suspended.');
}
```
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
token       VARCHAR(64) UNIQUE   -- Str::random(64)
email       VARCHAR(255)
expires_at  TIMESTAMP            -- 15 минут
created_at  TIMESTAMP
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
- «Remove password» требует подтверждения через текущий пароль или Magic Link
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

**[•••] для Admin дополнительно:**
```
 Change role →  ...
 ──────────────
 Remove from site
 ──────────────
 Suspend account      ← если active
 Unsuspend account    ← если suspended (строка выделена серым)
```
«Suspend account» → confirm → `status = 'suspended'`, пользователь теряет доступ ко всем сайтам немедленно.
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
«Approve» → модал: выбрать роль + сайт → `status = 'active'`, пользователь добавляется в `site_user`.
«Reject» → confirm → аккаунт **удаляется**. Пользователь может зарегистрироваться снова при желании. Не используем `status = 'suspended'` — чтобы не смешивать «самостоятельно зарегистрировался, не одобрен» с «заблокирован за нарушения».

Вкладка **Suspended** — заблокированные пользователи, кнопка [Unsuspend] на каждой строке.

**Pending invitations** — отдельная секция ниже таблицы на вкладке Active (аналогично Manager view), показывает неотвеченные инвайты по всем сайтам.

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
Если email уже на этом сайте → ошибка инлайн: «This user already has access to this site».

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

## UI — Settings → Profile

Profile — последняя вкладка в Settings (после всех остальных), чтобы при открытии Settings всегда открывался список сайтов первым.

Порядок вкладок: Sites → Site settings → Turf profile → Zones → Import → Integrations → Users → **Profile**

Доступна всем пользователям (любая роль). Секция **Security**:

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
[Change password]  [Remove password]
```
- «Change password» → модальное окно: «Current password» + «New password» + «Confirm password»
- «Remove password» → подтверждение → пароль удаляется, вход только через Magic Link

**Также в Profile:**
- Имя (редактировать)
- Email (только просмотр — смена email требует верификации, реализовать позже)

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
2. Миграция: `users.is_admin`, `users.status`, `users.password_hash`, `users.password_prompt_shown`, таблицы `invitations` + `magic_links`, нормализация `site_user.role`
3. `EnsureUserIsActive` middleware
4. Helper-методы на User: `roleOnSite`, `canViewSite`, `canEditSite`, `canManageSite`
5. `Gate::before` для admin
6. Обновить все контроллеры на role-aware проверки
7. Artisan-команды: `user:make-admin {email}`, `user:unsuspend {email}`
8. Magic Link auth: редизайн существующей страницы логина + MagicLinkController + `/magic/{token}` + страница `/pending` для pending users
9. InvitationController + письмо-уведомление при инвайте
10. Settings → Users UI (manager view, затем admin view)
11. Self-registration + pending flow (опционально): `/register` route + письмо с Magic Link при одобрении

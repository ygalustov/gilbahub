# Migration Plan: Remove WordPress And Move To Standalone Laravel + MySQL

## Goal

Migrate the Gilba Agronomic Intelligence Hub from a WordPress plugin into a standalone Laravel web application hosted on a normal web server, backed by MySQL 8, with proper authentication, authorization, persistent storage, and the existing agronomic/stadium engines reused where practical.

The priority is to remove the WordPress dependency first. The first standalone version should preserve the current vanilla JavaScript/frontend behavior as much as possible. Vue or any other frontend rewrite is deferred until after the Laravel/MySQL version is stable.

## Recommended Stack

- PHP 8.2+
- MySQL 8+
- Nginx or Apache
- Composer
- Laravel as the backend application framework
- Vite for frontend asset bundling
- Laravel sessions for browser authentication
- Laravel Sanctum only if a separate SPA/mobile API is added later
- Laravel Scheduler for recurring jobs
- Laravel queues for longer-running background work
- Existing vanilla JavaScript frontend retained during the initial WordPress removal

Laravel is the chosen backend framework because this project needs authentication, migrations, validation, mail, scheduled tasks, file uploads, queues, CSRF protection, database models, encrypted secrets, and clean service boundaries.

## Migration Strategy

Use a two-step modernization path:

1. Remove WordPress first.
2. Modernize the frontend later only after the standalone app is stable.

The first migration should not also be a frontend rewrite. Existing JavaScript engines, global objects, DOM-driven behavior, and CSS should be carried over with minimal behavior changes. The main work in the first pass is replacing WordPress as the platform layer: routing, authentication, storage, Ajax/REST endpoints, asset loading, scheduled tasks, and server-side services.

Deferred until later:

- Vue or another frontend framework
- full component rewrite
- major UI redesign
- large JavaScript module restructuring
- replacing all `localStorage` usage at once

Still required during the WordPress removal:

- replace `admin-ajax.php` and WordPress REST routes with Laravel routes
- replace WordPress shortcodes with Laravel views
- replace WordPress user/session checks with Laravel authentication
- replace WordPress user meta/options/transients with MySQL-backed application tables
- preserve existing script load order until each feature is verified
- keep existing domain engines framework-neutral

## Phase 1: Inventory And Boundaries

Classify the current codebase into migration groups:

- Reusable frontend engines: most files in `assets/*.js`, including climate, disease, shade, salinity, tissue, water, irrigation, PGR, wear/recovery, and dashboard logic.
- Reusable PHP domain classes: some `includes/stadium/*` classes and interpretation classes after removing WordPress dependencies.
- WordPress-only glue: shortcodes, `wp_ajax_*`, `register_rest_route`, `get_user_meta`, `update_option`, `wp_enqueue_script`, nonces, and plugin activation hooks.
- Data assets: CSV templates, stadium JSON files, fertiliser/fungicide/product/variety datasets.
- Persistence-heavy features: spray log, prediction logger, site configs, sensor credentials, logos, alerts, and AI interpretation cache.

Deliverable: a migration map where every current endpoint, shortcode, storage key, and custom table is mapped to a new route/table/service.

## Phase 2: New Laravel App Skeleton

Create the standalone PHP application.

Required base features:

- Login
- Logout
- Registration or admin-created users
- Password reset
- CSRF protection
- Session handling
- User profile page
- Role/permission model
- Base app layout
- API route prefix, such as `/api/v1`
- Environment-based configuration through `.env`
- Laravel migrations, seeders, policies, middleware, jobs, and scheduled commands

Minimum roles:

- `admin`
- `manager`
- `operator`
- `viewer`

Suggested permission split:

- Admins manage users, global settings, integrations, and system configuration.
- Managers manage sites, reports, credentials, and team membership.
- Operators enter samples/logs and run analysis.
- Viewers can read dashboards and reports only.

## Phase 3: Database Schema

The latest plugin now has a clearer canonical backend model under `includes/data/`. The Laravel schema should pivot to match that model rather than the older WordPress meta/localStorage shape.

Canonical foundation tables to mirror first:

```text
accounts
precinct_groups
sites
samples
spray_logs
site_summaries
```

Recommended Laravel mapping:

```text
users                         -> Laravel auth users
accounts                      -> one logical customer/account, linked to owner user
account_user                  -> optional later if one account can have multiple users
precinct_groups               -> grouping layer above sites
sites                         -> UUID primary key, can be precinct or child site
site_user                     -> user membership within a site/account scope
site_configs                  -> current GAIP per-site config JSON during transition
samples                       -> unified soil/water/tissue/loi sample store
spray_logs                    -> historical spray events
site_summaries                -> derived trend/reporting snapshots
media_uploads                 -> uploaded photos/documents
stadium_venue_profiles        -> stadium-specific saved venue profile state
```

Important schema changes versus the current Laravel app:

- `sites` should move from integer IDs to UUIDs to match the plugin's new canonical ID model.
- `sites` should support hierarchy with `parent_site_id`.
- `sites` should carry `account_id` and optional `precinct_group_id`.
- methodology and soil texture should support inheritance:
  - account default
  - site override
  - sample snapshot at write time
- `samples` should become the main source of truth for imported lab data rather than ad hoc saved JSON blobs.
- `site_summaries` should be stored as derived snapshots with ring-buffer trimming, not only recomputed client-side.
- `spray_logs` should support fan-out fields like `applied_to_site_ids` and `applied_to_samples`.

Secondary tables still likely needed in Laravel:

```text
password_reset_tokens
sessions
cache
cache_locks
integration_credentials
sensor_mappings
predictions
outcomes
calibration_offsets
field_observations
alert_settings
alert_rules
alert_events
report_logos
export_jobs
audit_logs
```

Existing WordPress/custom storage mapping should now be treated like this:

```text
legacy localStorage site state        -> site_configs (temporary transition store)
wp_gilba_data_accounts                -> accounts
wp_gilba_data_precinct_groups         -> precinct_groups
wp_gilba_data_sites                   -> sites
wp_gilba_data_samples                 -> samples
wp_gilba_data_spray_log               -> spray_logs
wp_gilba_data_site_summaries          -> site_summaries
wp_gilba_spray_log                    -> spray_logs (legacy precursor)
wp_gilba_predictions                  -> predictions
wp_gilba_outcomes                     -> outcomes
wp_gilba_calibration_offsets          -> calibration_offsets
```

Practical implication: stop designing the standalone DB around only `users + sites + site_configs`. That was enough for the first lift-out, but it is not the right final backbone anymore.

## Phase 4: Replace WordPress Storage

Replace current WordPress storage calls with explicit app services and tables.

```text
get_user_meta/update_user_meta -> explicit user/site tables
get_option/update_option       -> app_settings or feature-specific tables
transients                     -> cache_entries or Redis later
custom WordPress tables        -> normal application tables
localStorage                   -> browser cache only, not source of truth
```

Do not remove `localStorage` immediately. Use it as a frontend cache during migration, but sync important data to MySQL.

Important data that should become server-side source of truth:

- Sites
- Site configs
- Turf profiles
- Samples
- Sensor mappings
- Spray logs
- Predictions/outcomes
- Logos
- Alert settings
- AI interpretation history

## Phase 5: API Replacement

Replace WordPress Ajax and REST routes with normal authenticated API endpoints.

Suggested route set:

```text
POST   /api/v1/geocode/search
POST   /api/v1/geocode/reverse

GET    /api/v1/sites
POST   /api/v1/sites
GET    /api/v1/sites/{site}
PUT    /api/v1/sites/{site}
DELETE /api/v1/sites/{site}

GET    /api/v1/site-configs
GET    /api/v1/site-configs/{site}
PUT    /api/v1/site-configs/{site}

POST   /api/v1/lab/parse
POST   /api/v1/interpret/soil
POST   /api/v1/interpret/water
POST   /api/v1/interpret/synthesis

GET    /api/v1/spray-log
POST   /api/v1/spray-log
PUT    /api/v1/spray-log/{id}
DELETE /api/v1/spray-log/{id}
GET    /api/v1/spray-log/summary
GET    /api/v1/spray-log/context

POST   /api/v1/predictions
GET    /api/v1/predictions/pending/{site}
POST   /api/v1/outcomes
POST   /api/v1/outcomes/batch
GET    /api/v1/outcomes/history/{site}
GET    /api/v1/calibration/{site}

POST   /api/v1/sensors/hydrosight/proxy
POST   /api/v1/sensors/specconnect/proxy
GET    /api/v1/sensors/credentials
PUT    /api/v1/sensors/credentials
GET    /api/v1/sensors/mappings
PUT    /api/v1/sensors/mappings

GET    /api/v1/stadiums
GET    /api/v1/stadiums/{stadium}
POST   /api/v1/stadium/shade-analysis
POST   /api/v1/stadium/rig-calculate
POST   /api/v1/stadium/seasonal-plan

GET    /api/v1/alerts/settings
PUT    /api/v1/alerts/settings
POST   /api/v1/alerts/check
POST   /api/v1/alerts/test
```

Security requirements:

- Use app auth middleware instead of WordPress login checks.
- Use CSRF protection for browser requests.
- Scope every site-related query by authenticated user and site membership.
- Store API credentials encrypted at rest.
- Never return raw sensor API keys to the browser.
- Add rate limiting to external API proxy endpoints.
- Validate uploaded files by server-detected MIME type, not browser-supplied MIME type.

## Phase 6: Frontend Extraction

Start by preserving the existing frontend as much as possible. This phase is a lift-out from WordPress, not a Vue migration.

Steps:

1. Copy `assets/` into the new app.
2. Create standalone pages for the hub, field log, morning briefing, and stadium mode.
3. Move the HTML from `gaip_hub_render_shortcode()` into a PHP view/template.
4. Replace WordPress-localized globals with an explicit config object.

Example:

```js
window.GAIP_HUB_CONFIG = {
  apiBase: "/api/v1",
  csrfToken: "...",
  userId: 123,
  mode: "agronomic"
};
```

5. Replace `admin-ajax.php` calls with `/api/v1/*`.
6. Keep existing JS globals initially.
7. Preserve current CSS and DOM structure unless a change is required to remove WordPress coupling.
8. Reproduce the current script load order before optimizing it.
9. Later, after the standalone app is stable, split the frontend into modules or components if needed.

Initial app pages:

```text
/hub
/field-log
/morning-briefing
/stadium
/settings
/admin/users
```

## Phase 7: Authentication And Authorization

Add the authentication layer missing from a standalone deployment.

Required features:

- Secure login/logout
- Password hashing
- Password reset
- Optional registration flow
- Email verification if publicly accessible
- Account lockout or throttling
- Role-based permissions
- Site membership model
- Session expiry
- Audit log for sensitive actions
- Encrypted credential storage
- Optional two-factor authentication for admins

Recommended site access model:

```text
User belongs to many sites.
Each site membership has a role.
Every site query is scoped by site_id and user_id.
```

This is stricter than the current WordPress plugin, where many routes primarily check whether the user is logged in.

## Phase 8: Backend Services

Port PHP services away from WordPress helper functions.

Replace:

```php
wp_remote_post()
wp_send_json_success()
sanitize_text_field()
get_transient()
set_transient()
wp_mail()
```

With Laravel equivalents:

```text
Laravel HTTP client
Laravel JSON responses/resources
Form Requests and validators
Cache facade or database cache store
Mail and notification services
Jobs and queues for long-running work
```

Services to implement:

- `GeocodingService`
- `WeatherService`
- `ClaudeInterpretationService`
- `LabParserService`
- `SensorCredentialService`
- `HydrosightProxyService`
- `SpecConnectProxyService`
- `AlertService`
- `SprayLogService`
- `PredictionLoggerService`
- `StadiumShadeService`
- `ReportExportService`
- `SiteConfigService`
- `AuditLogService`

## Phase 9: Data Migration From WordPress

Build an importer that can read from the old WordPress database.

Migrate:

- WordPress users to app users
- Relevant `wp_usermeta` keys to user/site tables
- Relevant `wp_options` values to app settings or feature-specific tables
- `wp_gilba_spray_log` to `spray_logs`
- `wp_gilba_predictions` to `predictions`
- `wp_gilba_outcomes` to `outcomes`
- `wp_gilba_calibration_offsets` to `calibration_offsets`
- Stadium custom venues/options to stadium tables

For browser-only `localStorage` data, provide an import flow:

1. User opens old WordPress hub.
2. User exports local data as JSON.
3. User imports JSON into the new app.
4. Server validates and stores the data.

This is necessary because much of the current app state may exist only in the user's browser.

## Phase 10: Deployment

Basic production layout:

```text
/var/www/gilba-app
Nginx or Apache virtual host
PHP-FPM
MySQL 8
.env config
HTTPS certificate
daily database backups
log rotation
```

Cron/scheduled jobs:

- APVMA sync
- Weather/sensor cache refresh
- Alert checks
- Prediction expiry
- Calibration updates
- Old cache cleanup
- Old import/upload cleanup

Backups:

- Database backup daily
- Uploaded files backup daily
- Keep `.env` and app encryption key backed up securely
- Test restore process regularly

## Suggested Migration Order

1. App skeleton, auth, users, roles.
2. Database schema and migrations.
3. Asset loading outside WordPress, preserving current order.
4. Main hub page rendered as a Laravel view instead of a shortcode.
5. Replace `admin-ajax.php` calls with Laravel routes.
6. Site config persistence.
7. Spray log.
8. Prediction, outcome, and calibration tables.
9. Soil/water/tissue/sample persistence.
10. AI interpretation endpoints.
11. Sensor integrations.
12. Reports, exports, and logos.
13. Alerts.
14. Stadium mode.
15. LocalStorage import/export.
16. WordPress data importer.
17. Hardening, tests, deployment.
18. Optional frontend modernization after the standalone version is stable.

## Main Risks

- The main plugin file mixes UI, routing, WordPress integration, and patch history.
- A lot of state is implicit in browser globals.
- `localStorage` is currently a major persistence layer.
- Access control must become stricter than the WordPress version.
- Frontend asset load order is likely fragile and must be reproduced carefully first.
- Some PHP classes assume WordPress functions and need adapters or rewrites.
- Some features rely on server secrets and must be redesigned so secrets never reach the browser.
- Rewriting the frontend during WordPress removal would increase migration risk and should be avoided in the first pass.

## Realistic Effort

Rough standalone MVP:

- Authentication
- Main hub
- Site persistence
- Core analysis engines
- Spray log
- Basic reports

Estimated effort: 4-8 weeks.

Production replacement for the full plugin:

- All integrations
- AI interpretation
- Sensors
- Alerts
- Stadium mode
- Imports
- Robust permissions
- Deployment tooling

Estimated effort: 10-16+ weeks, depending on polish and how much refactoring is done during the port.

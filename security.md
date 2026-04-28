# GAIP Hub — Security Audit
**Build:** b35fix120  
**Date:** 2026-03-22  
**Scope:** Full codebase — PHP handlers, REST routes, Ajax endpoints, JS client, file uploads, credential storage

---

## Summary

No hardcoded API keys found in source. No raw `echo $_POST` / `$_GET` to HTML output. No `eval()` or `document.write` in JS. Core Ajax and REST routes are consistently nonce-verified and require authentication.

Five real issues found, ranging from medium to low severity.

---

## Findings

---

### 1. MEDIUM — Sensor API key returned in plaintext to browser

**File:** `gilba-agronomic-intelligence-hub.php` — `gilba_sensor_load_credentials()` (line 1053)

The `gilba_sensor_load_credentials` Ajax handler returns the raw Hydrosight (and any future SoilScout / SpecConnect) API keys directly in the JSON response body:

```php
$credentials[$vendor] = $key;   // raw key string
wp_send_json_success(array(
    'credentials' => $credentials,
    ...
));
```

The key is then stored in JS module state (`state.apiKey`) and included in every POST to the Hydrosight proxy. This means:

- The raw API key is visible in the browser's network tab on every page load
- It sits in JS heap memory for the session duration
- Any XSS or browser extension with content script access to the page can exfiltrate it

**Fix:** Return a boolean `key_set: true/false` to the JS for UI purposes only. The proxy handler (`gilba_hydrosight_proxy`) should retrieve the key server-side from user meta rather than accepting it as a POST parameter:

```php
// In gilba_hydrosight_proxy():
$user_id = get_current_user_id();
$api_key = get_user_meta($user_id, 'gilba_sensor_hydrosight_key', true);
if (empty($api_key)) {
    wp_send_json_error(array('message' => 'No API key configured'), 400);
}
// Remove: $api_key = isset($_POST['api_key']) ? sanitize_text_field(...) : '';
```

JS never needs to hold the key — it just passes the endpoint path.

---

### 2. MEDIUM — Alert settings writable by any logged-in user

**File:** `includes/class-gilba-alerts.php` — `handle_save_settings()`, `check_permission()` (lines 205, 216)

The REST routes for `POST /gilba/v1/alert-settings` and `POST /gilba/v1/alert-test` use `check_permission()` which only requires `is_user_logged_in()`. Any WordPress subscriber (role level 0) on a multi-user install can overwrite the ClickSend username, API key, sender number, and admin email:

```php
public function check_permission() {
    return is_user_logged_in();  // no capability check
}
```

The admin settings page correctly gates on `manage_options`, but the REST API bypasses that entirely.

**Fix:** Raise the REST permission to `manage_options` or at minimum `edit_posts` depending on the intended user base. For a single-user install this is low risk, but it should be consistent with the admin page gate:

```php
public function check_permission() {
    return current_user_can('manage_options');
}
```

If non-admin users legitimately need to trigger alert checks, split the permission: `manage_options` for settings/test, `read` for alert-check only.

---

### 3. LOW — Morning briefing renders site labels and location names without HTML escaping

**File:** `assets/gaip-morning-briefing.js` — `buildSiteCard()` (lines 419, 491, 510–511)

`site.label`, `locName` (from `location.name`), and the composed `metaLine` string are concatenated directly into the `innerHTML` string with no escaping:

```js
var label   = site.label || siteId;           // raw from localStorage
var locName = location.name || ...;           // raw from localStorage
// ...
'<div ...>' + label + '</div>'                // injected unescaped
'<div ...>' + metaLine + '</div>'             // injected unescaped
container.innerHTML = html;
```

These values come from `gilba_hub_site_configs` in localStorage, which is written by the user via the site setup UI. On a single-user install this is self-XSS only. On any shared or multi-user install where one user's stored configs influence another user's briefing page (e.g. shared WP session, demo accounts), it becomes exploitable.

`site-dashboard.js` correctly uses an `esc()` helper (`div.textContent = str; return d.innerHTML`) for the same data — morning briefing should match.

**Fix:** Add the same `esc()` helper to `gaip-morning-briefing.js` and wrap all user-controlled strings before HTML insertion:

```js
function esc(str) {
    if (!str) return '';
    var d = document.createElement('div');
    d.textContent = str;
    return d.innerHTML;
}
// Then:
'<div>' + esc(label) + '</div>'
'<div>' + esc(metaLine) + '</div>'
```

Also applies to: `activeLabel` in the footer note (line 615).

---

### 4. LOW — Lab parser trusts client-supplied MIME type for file routing

**File:** `includes/class-gilba-lab-parser.php` — `parse_file()` (line 62)

The file type routing uses `$file['type']` which is the MIME type submitted by the browser — it is not validated against the actual file contents:

```php
$mime = $file['type'];   // client-controlled
if ( $ext === 'pdf' || $mime === 'application/pdf' ) { ... }
```

A client can submit a non-PDF with `Content-Type: application/pdf` and the server will attempt to base64-encode and pass it to the Claude API as a PDF document. The practical risk is low (it would return a garbled API response rather than cause code execution), but it wastes API credits and could be used to probe the Claude API with unexpected binary content.

The extension check (`$ext`) provides some protection since both conditions are ORed, but extension is also client-controlled via the filename.

**Fix:** Use `finfo_file()` on `$file['tmp_name']` for server-side MIME detection:

```php
$finfo = finfo_open(FILEINFO_MIME_TYPE);
$real_mime = finfo_file($finfo, $file['tmp_name']);
finfo_close($finfo);
```

Validate `$real_mime` against an allowlist `['application/pdf', 'application/vnd.openxmlformats...', 'text/plain', 'text/csv']`. Reject anything else before processing.

---

### 5. LOW — Hydrosight proxy endpoint allows unrestricted query string injection

**File:** `gilba-agronomic-intelligence-hub.php` — `gilba_hydrosight_proxy()` (line 834)

The endpoint validation checks that the value starts with `/` and contains none of `< > " ' \` but does not restrict `?`, `&`, `#`, or `@`:

```php
if (strpos($endpoint, '/') !== 0 || preg_match('/[<>"\'\\\]/', $endpoint)) {
    wp_send_json_error(...);
}
$url = 'https://api.hydrosight.au/v1' . $endpoint;
```

A logged-in user can supply `/sensors?legitimate_param=x&injected=y` and the proxy will forward it verbatim. Since the base domain is hardcoded to `https://api.hydrosight.au/v1`, this is not an SSRF risk. The Hydrosight API will receive unexpected parameters that it will either ignore or reject. No server-side impact.

Mentioning it for completeness — becomes relevant if the base URL is ever made configurable.

**Fix (optional):** Whitelist the specific endpoint paths the JS actually needs (e.g. `/sensors`, `/readings`) rather than allowing arbitrary paths. Or at minimum add `?` to the character blocklist if Hydrosight's API doesn't use query params through this proxy.

---

## Non-issues Checked

| Area | Result |
|------|--------|
| Hardcoded API keys in source | None found. `GILBA_CLAUDE_API_KEY`, `GSSH_CLAUDE_API_KEY`, ClickSend credentials all loaded from `wp-config.php` or WP options |
| Ajax nonce verification | All 30+ Ajax handlers verified — nonce checked before processing |
| Unauthenticated Ajax routes | `wp_ajax_nopriv_gilba_geocode_search` and GSSH equivalent are intentionally open. They proxy Nominatim (public geocoding API), sanitise the address input with `sanitize_text_field()`, and perform no writes. Acceptable |
| REST route authentication | All REST routes require `is_user_logged_in()` at minimum. No `__return_true` permission callbacks |
| SQL injection | Spray log and prediction logger use `$wpdb->insert()` and `$wpdb->prepare()` throughout. No raw query concatenation found |
| `echo $_POST` / `$_GET` | None found in PHP output |
| `eval()` / `new Function()` in JS | None found |
| `document.write` | None found |
| PHP `shell_exec` / `exec` / `system` | None found |
| Open redirect | `window.location.href` assignment in `stadium/admin.js:212` appends a `venueId` from a WP-controlled dropdown — not user-free-text. Low risk |
| ClickSend API key exposure in admin UI | Correctly uses `type="password"` input and only exposes `key_set: bool` to the settings page |
| Claude API key exposure | Loaded server-side only via `defined('GILBA_CLAUDE_API_KEY')`. Never sent to JS |

---

## Priority Order

1. **Fix first (before production):** Finding 1 — sensor key in JS / network tab. One-line proxy change.
2. **Fix before multi-user deployment:** Finding 2 — alert settings writable by subscribers.
3. **Fix in next JS pass:** Finding 3 — morning briefing `esc()` missing. Low effort, add helper and wrap 4 strings.
4. **Fix when convenient:** Finding 4 — MIME validation. Add `finfo_file()` check.
5. **Optional:** Finding 5 — proxy endpoint query string. No real attack surface with hardcoded base URL.

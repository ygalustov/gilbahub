<!doctype html>
<html lang="en">
<head>
    <meta charset="utf-8">
    <meta name="viewport" content="width=device-width, initial-scale=1">
    <meta name="csrf-token" content="{{ csrf_token() }}">
    <title>{{ $title ?? config('app.name') }}</title>
    @php
        $activeSite = auth()->user()?->activeSite;
        $savedLocation = [
            'name' => $activeSite?->location_name ?? '',
            'lat' => $activeSite?->latitude ?? '',
            'lon' => $activeSite?->longitude ?? '',
        ];
        $activeGaipConfig = [];
        if ($activeSite) {
            $activeGaipRecord = $activeSite->configs()->where('namespace', 'gaip')->first();
            $activeGaipConfig = is_array($activeGaipRecord?->config) ? $activeGaipRecord->config : [];
        }
        $wizardState = is_array($activeGaipConfig['wizard'] ?? null) ? $activeGaipConfig['wizard'] : [];
    @endphp
    <script>
        window.GAIP_HUB_CONFIG = Object.assign({}, window.GAIP_HUB_CONFIG || {}, {
            nonce: "{{ csrf_token() }}",
            csrfToken: "{{ csrf_token() }}",
            restUrl: "{{ url('/api') }}/",
            restNonce: "{{ csrf_token() }}",
            userId: {{ auth()->id() ?? 0 }},
            activeSiteId: @json($activeSite?->id),
            siteUrl: "{{ url('/') }}",
            hubUrl: "{{ route('hub') }}",
            hubMode: "agronomic",
            savedLocation: @json($savedLocation)
        });
        window.GAIP_FIELD_LOG_CONFIG = Object.assign({}, window.GAIP_HUB_CONFIG, window.GAIP_FIELD_LOG_CONFIG || {});
        window.GAIP_WIZARD_CONFIG = Object.assign({}, window.GAIP_WIZARD_CONFIG || {}, {
            nonce: "{{ csrf_token() }}",
            csrfToken: "{{ csrf_token() }}",
            restUrl: "{{ url('/api') }}/",
            activeSiteId: @json($activeSite?->id),
            savedLocation: @json($savedLocation),
            wizardComplete: @json((bool) ($wizardState['complete'] ?? false)),
            wizardState: @json($wizardState)
        });
    </script>
    @yield('head')
    <style>
        :root {
            color-scheme: light;
            --bg: #f5f7f6;
            --panel: #ffffff;
            --border: #d8e0dc;
            --text: #17231f;
            --muted: #5b6a65;
            --brand: #236b4a;
            --brand-dark: #185139;
            --danger: #a53b3b;
        }
        * { box-sizing: border-box; }
        body {
            margin: 0;
            font-family: system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
            color: var(--text);
            background: var(--bg);
        }
        a { color: var(--brand); text-decoration: none; }
        a:hover { text-decoration: underline; }
        .shell { min-height: 100vh; display: flex; flex-direction: column; }
        .topbar {
            height: 56px;
            display: flex;
            align-items: center;
            justify-content: space-between;
            gap: 16px;
            padding: 0 24px;
            background: var(--panel);
            border-bottom: 1px solid var(--border);
        }
        .brand { font-weight: 700; letter-spacing: 0; }
        .nav { display: flex; align-items: center; gap: 16px; font-size: 14px; }
        .nav form { margin: 0; }
        .button-link {
            border: 0;
            padding: 0;
            background: transparent;
            color: var(--brand);
            cursor: pointer;
            font: inherit;
        }
        .content { width: min(1120px, calc(100% - 32px)); margin: 32px auto; }
        .content.content-wide { width: min(1400px, calc(100% - 24px)); margin: 16px auto 32px; }
        .panel {
            background: var(--panel);
            border: 1px solid var(--border);
            border-radius: 8px;
            padding: 24px;
        }
        .muted { color: var(--muted); }
        .grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(220px, 1fr)); gap: 16px; }
        .card {
            display: block;
            padding: 18px;
            border: 1px solid var(--border);
            border-radius: 8px;
            background: #fbfcfb;
        }
        .card strong { display: block; margin-bottom: 6px; color: var(--text); }
        .auth-wrap { width: min(420px, calc(100% - 32px)); margin: 72px auto; }
        label { display: block; margin: 14px 0 6px; font-weight: 600; }
        input[type="email"], input[type="password"], input[type="text"], input[type="number"] {
            width: 100%;
            border: 1px solid var(--border);
            border-radius: 6px;
            padding: 10px 12px;
            font: inherit;
        }
        .primary {
            width: 100%;
            margin-top: 18px;
            border: 0;
            border-radius: 6px;
            padding: 11px 14px;
            background: var(--brand);
            color: #fff;
            cursor: pointer;
            font: inherit;
            font-weight: 700;
        }
        .primary:hover { background: var(--brand-dark); }
        .secondary {
            border: 1px solid var(--border);
            border-radius: 6px;
            padding: 9px 12px;
            background: #fff;
            color: var(--brand);
            cursor: pointer;
            font: inherit;
            font-weight: 700;
        }
        .secondary:hover { background: #f1f7f4; text-decoration: none; }
        .compact-button { width: auto; margin: 0; padding: 8px 11px; }
        .error { margin-top: 8px; color: var(--danger); font-size: 14px; }
        .check-row { display: flex; align-items: center; gap: 8px; margin-top: 14px; color: var(--muted); }
        .section-title { margin: 28px 0 12px; font-size: 18px; }
        .status-line { margin: 10px 0 0; color: var(--muted); font-size: 14px; }
        .site-list { display: grid; gap: 10px; margin-top: 12px; }
        .site-row {
            display: grid;
            grid-template-columns: 1fr auto auto auto;
            gap: 12px;
            align-items: center;
            padding: 14px;
            border: 1px solid var(--border);
            border-radius: 8px;
            background: #fbfcfb;
        }
        .site-row strong { display: block; }
        .site-meta { margin-top: 4px; color: var(--muted); font-size: 13px; }
        .site-form {
            display: grid;
            gap: 14px;
            margin-top: 12px;
            padding: 16px;
            border: 1px solid var(--border);
            border-radius: 8px;
            background: #fbfcfb;
        }
        .form-grid {
            display: grid;
            grid-template-columns: repeat(auto-fit, minmax(180px, 1fr));
            gap: 12px;
        }
        .form-actions { display: flex; align-items: center; gap: 10px; flex-wrap: wrap; }
        .form-actions .primary { width: auto; margin-top: 0; }
        .site-edit-panel[hidden] { display: none; }
        .pill {
            display: inline-flex;
            align-items: center;
            border-radius: 999px;
            padding: 4px 9px;
            background: #e8f3ed;
            color: var(--brand-dark);
            font-size: 12px;
            font-weight: 700;
        }
    </style>
</head>
<body>
<div class="shell">
    @auth
        <header class="topbar">
            <div class="brand">{{ config('app.name') }}</div>
            <nav class="nav" aria-label="Primary">
                <a href="{{ route('dashboard') }}">Dashboard</a>
                <a href="{{ route('data') }}">Data</a>
                <a href="{{ route('field-log') }}">Field Log</a>
                <a href="{{ route('morning-briefing') }}">Morning Briefing</a>
                <a href="{{ route('stadium') }}">Stadium</a>
                <a href="{{ route('settings') }}">Settings</a>
                <form method="POST" action="{{ route('logout') }}">
                    @csrf
                    <button class="button-link" type="submit">Logout</button>
                </form>
            </nav>
        </header>
    @endauth

    @yield('body')
</div>
@yield('scripts')
</body>
</html>

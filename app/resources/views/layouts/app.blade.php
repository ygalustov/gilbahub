<!doctype html>
<html lang="en">
<head>
    <meta charset="utf-8">
    <meta name="viewport" content="width=device-width, initial-scale=1">
    <title>{{ $title ?? config('app.name') }}</title>
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
        input[type="email"], input[type="password"] {
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
        .error { margin-top: 8px; color: var(--danger); font-size: 14px; }
        .check-row { display: flex; align-items: center; gap: 8px; margin-top: 14px; color: var(--muted); }
    </style>
</head>
<body>
<div class="shell">
    @auth
        <header class="topbar">
            <div class="brand">{{ config('app.name') }}</div>
            <nav class="nav" aria-label="Primary">
                <a href="{{ route('hub') }}">Hub</a>
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
</body>
</html>

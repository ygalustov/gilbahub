<!doctype html>
<html lang="en">
<head>
    <meta charset="utf-8">
    <meta name="viewport" content="width=device-width, initial-scale=1">
    <title>Sign In — {{ config('app.name') }}</title>
    <link rel="stylesheet" href="{{ $legacyAssetUrl('gaip-design-system.css') }}">
    <style>
        *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }

        body {
            min-height: 100vh;
            display: flex;
            font-family: "Barlow", -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
            font-size: 14px;
            background: #f4f7f5;
            color: #1a2b23;
        }

        /* ── Left panel ── */
        .login-aside {
            width: 340px;
            flex-shrink: 0;
            background: #1a2b23;
            display: flex;
            flex-direction: column;
            padding: 40px 36px;
        }

        .login-logo {
            width: 40px;
            height: 40px;
            background: #2da85e;
            border-radius: 10px;
            display: flex;
            align-items: center;
            justify-content: center;
            color: #fff;
        }

        .login-brand {
            margin-top: 12px;
            font-size: 20px;
            font-weight: 700;
            color: #fff;
            letter-spacing: -0.3px;
        }

        .login-tagline {
            margin-top: 8px;
            font-size: 13px;
            color: rgba(255,255,255,0.45);
            line-height: 1.5;
        }

        .login-aside-footer {
            margin-top: auto;
            font-size: 12px;
            color: rgba(255,255,255,0.25);
        }

        /* ── Right panel ── */
        .login-main {
            flex: 1;
            display: flex;
            align-items: center;
            justify-content: center;
            padding: 40px 24px;
        }

        .login-card {
            width: 100%;
            max-width: 400px;
        }

        .login-heading {
            font-size: 22px;
            font-weight: 700;
            color: #1a2b23;
            letter-spacing: -0.3px;
        }

        .login-sub {
            margin-top: 6px;
            font-size: 14px;
            color: #6b8878;
        }

        .login-form { margin-top: 28px; }

        .login-field { margin-top: 16px; }
        .login-field:first-child { margin-top: 0; }

        .login-label {
            display: block;
            font-size: 13px;
            font-weight: 600;
            color: #3d5c4a;
            margin-bottom: 6px;
        }

        .login-input {
            width: 100%;
            padding: 10px 13px;
            border: 1px solid #ccd9d2;
            border-radius: 7px;
            font-family: inherit;
            font-size: 14px;
            color: #1a2b23;
            background: #fff;
            outline: none;
            transition: border-color 0.15s, box-shadow 0.15s;
        }

        .login-input:focus {
            border-color: #2da85e;
            box-shadow: 0 0 0 3px rgba(45,168,94,0.12);
        }

        .login-input.error { border-color: #dc2626; }

        .login-error {
            margin-top: 6px;
            font-size: 13px;
            color: #dc2626;
        }

        .login-remember {
            display: flex;
            align-items: center;
            gap: 8px;
            margin-top: 16px;
            font-size: 13px;
            color: #6b8878;
            cursor: pointer;
            user-select: none;
        }

        .login-remember input { cursor: pointer; accent-color: #2da85e; }

        .login-btn {
            width: 100%;
            margin-top: 24px;
            padding: 11px 16px;
            background: #2da85e;
            color: #fff;
            border: none;
            border-radius: 7px;
            font-family: inherit;
            font-size: 14px;
            font-weight: 700;
            cursor: pointer;
            transition: background 0.15s;
        }

        .login-btn:hover { background: #259950; }
        .login-btn:active { background: #1e7d45; }

        /* ── Responsive ── */
        @media (max-width: 640px) {
            .login-aside { display: none; }
        }
    </style>
</head>
<body>

    <aside class="login-aside">
        <div class="login-logo">
            <svg width="22" height="22" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2.5">
                <path stroke-linecap="round" stroke-linejoin="round" d="M12 3c0 0-6 4-6 9a6 6 0 0012 0c0-5-6-9-6-9z"/>
            </svg>
        </div>
        <div class="login-brand">The Gilba<br>Turf Agronomy Hub</div>
        <p class="login-tagline">Agronomic intelligence<br>for turf management.</p>
        <div class="login-aside-footer">&copy; {{ date('Y') }} The Gilba Turf Agronomy Hub</div>
    </aside>

    <main class="login-main">
        <div class="login-card">
            <h1 class="login-heading">Sign in</h1>
            <p class="login-sub">Sign in to continue.</p>

            <form class="login-form" method="POST" action="{{ route('login.store') }}">
                @csrf

                <div class="login-field">
                    <label class="login-label" for="email">Email</label>
                    <input
                        class="login-input{{ $errors->has('email') ? ' error' : '' }}"
                        id="email" name="email" type="email"
                        value="{{ old('email') }}"
                        autocomplete="email"
                        autofocus
                        required
                    >
                    @error('email')
                        <div class="login-error">{{ $message }}</div>
                    @enderror
                </div>

                <div class="login-field">
                    <label class="login-label" for="password">Password</label>
                    <input
                        class="login-input{{ $errors->has('password') ? ' error' : '' }}"
                        id="password" name="password" type="password"
                        autocomplete="current-password"
                        required
                    >
                    @error('password')
                        <div class="login-error">{{ $message }}</div>
                    @enderror
                </div>

                <label class="login-remember">
                    <input name="remember" type="checkbox" value="1">
                    <span>Remember me</span>
                </label>

                <button class="login-btn" type="submit">Sign in</button>
            </form>
        </div>
    </main>

</body>
</html>

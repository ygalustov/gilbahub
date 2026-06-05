<!doctype html>
<html lang="en">
<head>
    <meta charset="utf-8">
    <meta name="viewport" content="width=device-width, initial-scale=1">
    <title>Sign In — {{ config('app.name') }}</title>
    <link rel="icon" type="image/svg+xml" href="/images/favicon.svg">
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
            width: 40px; height: 40px;
            background: #2da85e;
            border-radius: 10px;
            display: flex; align-items: center; justify-content: center;
            color: #fff;
        }
        .login-brand {
            margin-top: 12px;
            font-size: 20px; font-weight: 700;
            color: #fff; letter-spacing: -0.3px;
        }
        .login-tagline {
            margin-top: 8px; font-size: 13px;
            color: rgba(255,255,255,0.45); line-height: 1.5;
        }
        .login-aside-footer {
            margin-top: auto; font-size: 12px;
            color: rgba(255,255,255,0.25);
        }

        /* ── Right panel ── */
        .login-main {
            flex: 1; display: flex;
            align-items: center; justify-content: center;
            padding: 40px 24px;
        }
        .login-card { width: 100%; max-width: 400px; }

        /* ── Screens ── */
        .login-screen { display: none; }
        .login-screen.active { display: block; }

        /* ── Typography ── */
        .login-heading {
            font-size: 22px; font-weight: 700;
            color: #1a2b23; letter-spacing: -0.3px;
        }
        .login-sub {
            margin-top: 6px; font-size: 14px; color: #6b8878;
        }

        /* ── Back link ── */
        .login-back {
            display: inline-flex; align-items: center; gap: 5px;
            font-size: 13px; color: #6b8878;
            background: none; border: none; padding: 0;
            font-family: inherit; cursor: pointer; margin-bottom: 24px;
        }
        .login-back:hover { color: #1a2b23; }

        /* ── Form elements ── */
        .login-form { margin-top: 28px; }
        .login-field { margin-top: 16px; }
        .login-field:first-child { margin-top: 0; }

        .login-label {
            display: block; font-size: 13px; font-weight: 600;
            color: #3d5c4a; margin-bottom: 6px;
        }
        .login-label-row {
            display: flex; align-items: center;
            justify-content: space-between; margin-bottom: 6px;
        }
        .login-label-row .login-label { margin-bottom: 0; }

        .login-forgot {
            font-size: 12px; color: #2da85e;
            cursor: pointer; background: none; border: none;
            padding: 0; font-family: inherit;
        }
        .login-forgot:hover { text-decoration: underline; }

        .login-input {
            width: 100%; padding: 10px 13px;
            border: 1px solid #ccd9d2; border-radius: 7px;
            font-family: inherit; font-size: 14px;
            color: #1a2b23; background: #fff; outline: none;
            transition: border-color 0.15s, box-shadow 0.15s;
        }
        .login-input:focus {
            border-color: #2da85e;
            box-shadow: 0 0 0 3px rgba(45,168,94,0.12);
        }
        .login-input.error { border-color: #dc2626; }

        .login-error { margin-top: 6px; font-size: 13px; color: #dc2626; }
        .login-hint  { margin-top: 6px; font-size: 12px; color: #6b8878; }

        .login-btn {
            width: 100%; margin-top: 20px; padding: 11px 16px;
            background: #2da85e; color: #fff; border: none;
            border-radius: 7px; font-family: inherit;
            font-size: 14px; font-weight: 700; cursor: pointer;
            transition: background 0.15s;
            display: flex; align-items: center; justify-content: center; gap: 8px;
        }
        .login-btn:hover:not(:disabled) { background: #259950; }
        .login-btn:active:not(:disabled) { background: #1e7d45; }
        .login-btn:disabled { opacity: 0.7; cursor: default; }

        .login-btn-secondary {
            width: 100%; margin-top: 10px; padding: 11px 16px;
            background: transparent; color: #3d5c4a;
            border: 1px solid #ccd9d2; border-radius: 7px;
            font-family: inherit; font-size: 14px; font-weight: 600;
            cursor: pointer; transition: background 0.15s, border-color 0.15s;
            display: flex; align-items: center; justify-content: center; gap: 8px;
        }
        .login-btn-secondary:hover { background: #f0f5f2; border-color: #a8c4b2; }

        .login-divider {
            display: flex; align-items: center;
            gap: 12px; margin-top: 20px;
            color: #a8c4b2; font-size: 12px;
        }
        .login-divider::before, .login-divider::after {
            content: ''; flex: 1; height: 1px; background: #e0ebe4;
        }

        .login-footer-link {
            margin-top: 24px; text-align: center;
            font-size: 13px; color: #6b8878;
        }
        .login-footer-link a {
            color: #2da85e; text-decoration: none; font-weight: 600;
        }
        .login-footer-link a:hover { text-decoration: underline; }

        /* ── Spinner ── */
        @keyframes spin { to { transform: rotate(360deg); } }
        .login-spinner {
            width: 15px; height: 15px; flex-shrink: 0;
            border: 2px solid rgba(255,255,255,0.35);
            border-top-color: #fff;
            border-radius: 50%;
            animation: spin 0.7s linear infinite;
        }
        .login-btn-secondary .login-spinner {
            border-color: rgba(61,92,74,0.25);
            border-top-color: #3d5c4a;
        }

        /* ── Confirmation screen ── */
        .login-sent { text-align: center; }
        .login-sent-icon {
            width: 56px; height: 56px; background: #eaf7ef;
            border-radius: 50%;
            display: flex; align-items: center; justify-content: center;
            margin: 0 auto 20px; color: #2da85e;
        }
        .login-sent-heading {
            font-size: 20px; font-weight: 700;
            color: #1a2b23; letter-spacing: -0.2px;
        }
        .login-sent-body {
            margin-top: 10px; font-size: 14px;
            color: #6b8878; line-height: 1.55;
        }
        .login-sent-email { font-weight: 600; color: #1a2b23; }
        .login-sent-footer {
            margin-top: 28px; font-size: 13px; color: #6b8878;
        }
        .login-sent-footer button {
            background: none; border: none; padding: 0;
            font-family: inherit; font-size: 13px;
            color: #2da85e; cursor: pointer; font-weight: 600;
        }
        .login-sent-footer button:hover { text-decoration: underline; }

        /* ── Mobile header ── */
        .login-mobile-header { display: none; }

        @media (max-width: 640px) {
            body { flex-direction: column; }

            .login-aside { display: none; }

            .login-mobile-header {
                display: flex;
                align-items: center;
                gap: 10px;
                padding: 20px 20px 0;
                flex-shrink: 0;
            }
            .login-mobile-logo {
                width: 34px; height: 34px; flex-shrink: 0;
                background: #2da85e;
                border-radius: 8px;
                display: flex; align-items: center; justify-content: center;
                color: #fff;
            }
            .login-mobile-brand {
                font-size: 15px; font-weight: 700;
                color: #1a2b23; letter-spacing: -0.2px; line-height: 1.2;
            }

            .login-main {
                align-items: stretch;
                justify-content: flex-start;
                padding: 24px 20px 48px;
            }
            .login-card { max-width: 100%; }
            .login-heading { font-size: 20px; }
        }
    </style>
</head>
<body>

    <aside class="login-aside">
        <div class="login-logo">
            <svg width="28" height="28" viewBox="0 0 48 48" fill="none">
                <text x="24" y="25" text-anchor="middle" dominant-baseline="middle" font-family="Arial, Helvetica, sans-serif" font-size="32" font-weight="700" fill="currentColor">G</text>
            </svg>
        </div>
        <div class="login-brand">The Gilba<br>Turf Agronomy Hub</div>
        <p class="login-tagline">Agronomic intelligence<br>for turf management.</p>
        <div class="login-aside-footer">&copy; {{ date('Y') }} The Gilba Turf Agronomy Hub</div>
    </aside>

    <header class="login-mobile-header">
        <div class="login-mobile-logo">
            <svg width="22" height="22" viewBox="0 0 48 48" fill="none">
                <text x="24" y="25" text-anchor="middle" dominant-baseline="middle" font-family="Arial, Helvetica, sans-serif" font-size="32" font-weight="700" fill="currentColor">G</text>
            </svg>
        </div>
        <div class="login-mobile-brand">The Gilba<br>Turf Agronomy Hub</div>
    </header>

    <main class="login-main">
        <div class="login-card">

            {{-- ── Screen 1: Password sign-in ── --}}
            <div class="login-screen active" id="screen-password">
                <h1 class="login-heading">Sign in</h1>
                <p class="login-sub">Welcome back.</p>

                @if ($errors->has('email') && str_contains($errors->first('email'), 'expired'))
                    <div style="margin-top:16px;padding:12px 14px;background:#fef2f2;border:1px solid #fca5a5;border-radius:7px;font-size:13px;color:#dc2626;">
                        {{ $errors->first('email') }}
                    </div>
                @endif

                <form class="login-form" method="POST" action="{{ route('login.store') }}">
                    @csrf
                    <div class="login-field">
                        <label class="login-label" for="email">Email</label>
                        <input
                            class="login-input{{ $errors->has('email') && !str_contains($errors->first('email'), 'expired') ? ' error' : '' }}"
                            id="email" name="email" type="email"
                            value="{{ old('email') }}"
                            autocomplete="email" autofocus required>
                        @if ($errors->has('email') && !str_contains($errors->first('email'), 'expired'))
                            <div class="login-error">{{ $errors->first('email') }}</div>
                        @endif
                    </div>
                    <div class="login-field">
                        <div class="login-label-row">
                            <label class="login-label" for="password">Password</label>
                            <button type="button" class="login-forgot" id="forgot-btn">Forgot password?</button>
                        </div>
                        <input
                            class="login-input{{ $errors->has('password') ? ' error' : '' }}"
                            id="password" name="password" type="password"
                            autocomplete="current-password">
                        @error('password')
                            <div class="login-error">{{ $message }}</div>
                        @enderror
                        <div class="login-hint" id="forgot-hint" style="display:none;"></div>
                    </div>
                    <button class="login-btn" type="submit">Sign in</button>
                </form>

                <div class="login-divider">or</div>

                <button class="login-btn-secondary" id="open-magic-screen" type="button">
                    Sign in with magic link
                </button>

                @if (config('auth.self_registration_enabled'))
                    <p class="login-footer-link">
                        Don't have an account? <a href="{{ route('register') }}">Register</a>
                    </p>
                @endif
            </div>

            {{-- ── Screen 2: Magic link email entry ── --}}
            <div class="login-screen" id="screen-magic">
                <button class="login-back" id="back-to-password" type="button">
                    <svg width="14" height="14" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2.5">
                        <path stroke-linecap="round" stroke-linejoin="round" d="M15 19l-7-7 7-7"/>
                    </svg>
                    Back to sign in
                </button>

                <h1 class="login-heading">Sign in without a password</h1>
                <p class="login-sub">Enter your email and we'll send you a one-time sign-in link.</p>

                <form class="login-form" id="magic-form">
                    @csrf
                    <div class="login-field">
                        <label class="login-label" for="magic-email">Email</label>
                        <input
                            class="login-input"
                            id="magic-email" name="email" type="email"
                            autocomplete="email" required
                            placeholder="you@example.com">
                    </div>
                    <button class="login-btn" type="submit" id="magic-send-btn">
                        Send magic link
                    </button>
                </form>
            </div>

            {{-- ── Screen 3: Confirmation ── --}}
            <div class="login-screen" id="screen-sent">
                <div class="login-sent">
                    <div class="login-sent-icon">
                        <svg width="26" height="26" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
                            <path stroke-linecap="round" stroke-linejoin="round" d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z"/>
                        </svg>
                    </div>
                    <div class="login-sent-heading">Check your inbox</div>
                    <p class="login-sent-body">
                        We sent a sign-in link to<br>
                        <span class="login-sent-email" id="sent-email-display"></span>
                    </p>
                    <p class="login-sent-body" style="margin-top:8px;">
                        The link expires in 15&nbsp;minutes.<br>Check your spam folder if you don't see it.
                    </p>
                    <div class="login-sent-footer">
                        Didn't get it?
                        <button id="resend-btn" type="button">Resend</button>
                        &nbsp;·&nbsp;
                        <button id="back-to-signin-btn" type="button">Back to sign in</button>
                    </div>
                </div>
            </div>

        </div>
    </main>

    <script>
        const csrfToken = () => document.querySelector('meta[name="csrf-token"]')?.content
            ?? document.querySelector('input[name="_token"]')?.value ?? '';

        function showScreen(id) {
            document.querySelectorAll('.login-screen').forEach(s => s.classList.remove('active'));
            document.getElementById(id).classList.add('active');
        }

        // Screen 1 → Screen 2
        document.getElementById('open-magic-screen').addEventListener('click', function() {
            // Pre-fill magic email from password form if already typed
            const pwEmail = document.getElementById('email').value.trim();
            if (pwEmail) document.getElementById('magic-email').value = pwEmail;
            showScreen('screen-magic');
            document.getElementById('magic-email').focus();
        });

        // Screen 2 → Screen 1
        document.getElementById('back-to-password').addEventListener('click', () => showScreen('screen-password'));

        // Screen 3 → Screen 1
        document.getElementById('back-to-signin-btn').addEventListener('click', () => showScreen('screen-password'));

        // Magic link send
        async function sendMagicLink(email, passwordReset = false) {
            const fd = new FormData();
            fd.append('email', email);
            fd.append('_token', csrfToken());
            if (passwordReset) fd.append('password_reset', '1');
            await fetch('{{ route('magic.send') }}', {
                method: 'POST', body: fd,
                headers: { 'X-Requested-With': 'XMLHttpRequest' }
            });
        }

        document.getElementById('magic-form').addEventListener('submit', function(e) {
            e.preventDefault();
            const email = document.getElementById('magic-email').value.trim();
            if (!email) { document.getElementById('magic-email').focus(); return; }

            // Show confirmation immediately; send in background
            sendMagicLink(email).catch(() => {});
            document.getElementById('sent-email-display').textContent = email;
            showScreen('screen-sent');
            startResendCooldown();
        });

        // Resend
        function startResendCooldown() {
            const btn = document.getElementById('resend-btn');
            let secs = 60;
            btn.disabled = true;
            const tick = () => {
                btn.textContent = `Resend in ${secs}s`;
                if (--secs < 0) { btn.disabled = false; btn.textContent = 'Resend'; return; }
                setTimeout(tick, 1000);
            };
            tick();
        }

        document.getElementById('resend-btn').addEventListener('click', function() {
            const email = document.getElementById('sent-email-display').textContent;
            sendMagicLink(email).catch(() => {});
            startResendCooldown();
        });

        // Forgot password
        document.getElementById('forgot-btn').addEventListener('click', async function() {
            const email = document.getElementById('email').value.trim();
            const hintEl = document.getElementById('forgot-hint');

            if (!email) {
                hintEl.textContent = 'Enter your email address first.';
                hintEl.style.color = '#dc2626';
                hintEl.style.display = 'block';
                document.getElementById('email').focus();
                return;
            }

            this.disabled = true;
            this.textContent = 'Sending…';
            try { await sendMagicLink(email, true); } catch(_) {}
            hintEl.textContent = "If this email has an account, you'll receive a reset link shortly.";
            hintEl.style.color = '#6b8878';
            hintEl.style.display = 'block';
            this.disabled = false;
            this.textContent = 'Forgot password?';
        });
    </script>

</body>
</html>

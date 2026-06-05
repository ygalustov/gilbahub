<!doctype html>
<html lang="en">
<head>
    <meta charset="utf-8">
    <meta name="viewport" content="width=device-width, initial-scale=1">
    <title>No Access — {{ config('app.name') }}</title>
    <link rel="icon" type="image/svg+xml" href="/images/favicon.svg">
    <link rel="stylesheet" href="{{ $legacyAssetUrl('gaip-design-system.css') }}">
    <style>
        *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }
        body {
            min-height: 100vh;
            display: flex;
            align-items: center;
            justify-content: center;
            font-family: "Barlow", -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
            font-size: 14px;
            background: #f4f7f5;
            color: #1a2b23;
        }
        .card {
            width: 100%;
            max-width: 400px;
            padding: 48px 36px;
            background: #fff;
            border-radius: 12px;
            box-shadow: 0 2px 12px rgba(0,0,0,0.08);
            text-align: center;
        }
        .icon {
            width: 56px;
            height: 56px;
            background: #f0f5f2;
            border-radius: 50%;
            display: inline-flex;
            align-items: center;
            justify-content: center;
            color: #6b8878;
        }
        h1 { margin-top: 20px; font-size: 18px; font-weight: 700; letter-spacing: -0.2px; }
        p { margin-top: 10px; font-size: 14px; color: #6b8878; line-height: 1.6; }
        form { margin-top: 28px; }
        button {
            padding: 10px 24px;
            background: transparent;
            color: #3d5c4a;
            border: 1px solid #ccd9d2;
            border-radius: 7px;
            font-family: inherit;
            font-size: 14px;
            font-weight: 600;
            cursor: pointer;
            transition: background 0.15s;
        }
        button:hover { background: #f0f5f2; }
    </style>
</head>
<body>
    <div class="card">
        <div class="icon">
            <svg width="24" height="24" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
                <path stroke-linecap="round" stroke-linejoin="round" d="M12 15v2m0 0v2m0-2h2m-2 0H10M9 10a3 3 0 116 0v1H9v-1zM5 21h14a2 2 0 002-2v-7a2 2 0 00-2-2H5a2 2 0 00-2 2v7a2 2 0 002 2z"/>
            </svg>
        </div>

        <h1>You don't have access to any sites</h1>
        <p>Your access may have been removed. Contact your administrator to be invited to a site.</p>

        <form method="POST" action="{{ route('logout') }}">
            @csrf
            <button type="submit">Sign out</button>
        </form>
    </div>
</body>
</html>

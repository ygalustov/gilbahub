<!doctype html>
<html lang="en">
<head>
    <meta charset="utf-8">
    <meta name="viewport" content="width=device-width, initial-scale=1">
    <title>Welcome — {{ config('app.name') }}</title>
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
            padding: 40px 36px;
            background: #fff;
            border-radius: 12px;
            box-shadow: 0 2px 12px rgba(0,0,0,0.08);
        }
        h1 { font-size: 22px; font-weight: 700; letter-spacing: -0.3px; }
        p { margin-top: 8px; font-size: 14px; color: #6b8878; }
        .field { margin-top: 20px; }
        label { display: block; font-size: 13px; font-weight: 600; color: #3d5c4a; margin-bottom: 6px; }
        input {
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
        input:focus { border-color: #2da85e; box-shadow: 0 0 0 3px rgba(45,168,94,0.12); }
        input.error { border-color: #dc2626; }
        .error-msg { margin-top: 6px; font-size: 13px; color: #dc2626; }
        button {
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
        button:hover { background: #259950; }
    </style>
</head>
<body>
    <div class="card">
        @if(auth()->check())
            <h1>One last step</h1>
            <p>Confirm your name to set up your site.</p>
        @else
            <h1>Welcome to Gilba!</h1>
            <p>What's your name?</p>
        @endif

        <form method="POST" action="{{ route('welcome.store') }}">
            @csrf
            <div class="field">
                <label for="name">Name</label>
                <input
                    class="{{ $errors->has('name') ? 'error' : '' }}"
                    id="name" name="name" type="text"
                    value="{{ old('name', auth()->user()?->name) }}"
                    autocomplete="name"
                    autofocus
                    required
                >
                @error('name')
                    <div class="error-msg">{{ $message }}</div>
                @enderror
            </div>
            <button type="submit">Continue</button>
        </form>
    </div>
</body>
</html>

@php
    $legacyAssetUrl = function (string $asset): string {
        $path = base_path('../assets/'.$asset);
        $version = is_file($path) ? '?v='.filemtime($path) : '';
        return url('/legacy-assets/'.$asset).$version;
    };
@endphp
<!doctype html>
<html lang="en">
<head>
    <meta charset="utf-8">
    <meta name="viewport" content="width=device-width, initial-scale=1">
    <meta name="csrf-token" content="{{ csrf_token() }}">
    <title>Reports — {{ config('app.name') }}</title>
    <link rel="stylesheet" href="{{ $legacyAssetUrl('gaip-design-system.css') }}">
    <link rel="stylesheet" href="{{ $legacyAssetUrl('dashboard-ui.css') }}">
</head>
<body>

<div class="db-shell">

    {{-- SIDEBAR --}}
    <nav class="db-sidebar">
        <div class="db-sidebar-logo">
            <svg width="20" height="20" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2.5">
                <path stroke-linecap="round" stroke-linejoin="round" d="M12 3c0 0-6 4-6 9a6 6 0 0012 0c0-5-6-9-6-9z"/>
            </svg>
        </div>

        <a href="{{ route('dashboard') }}" class="db-nav-item" title="Dashboard">
            <svg width="20" height="20" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
                <rect x="3" y="3" width="7" height="7" rx="1.5"/>
                <rect x="14" y="3" width="7" height="7" rx="1.5"/>
                <rect x="3" y="14" width="7" height="7" rx="1.5"/>
                <rect x="14" y="14" width="7" height="7" rx="1.5"/>
            </svg>
        </a>

        <a href="{{ route('data') }}" class="db-nav-item" title="Data">
            <svg width="20" height="20" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
                <ellipse cx="12" cy="5" rx="9" ry="3"/>
                <path stroke-linecap="round" stroke-linejoin="round" d="M3 5v6c0 1.66 4.03 3 9 3s9-1.34 9-3V5"/>
                <path stroke-linecap="round" stroke-linejoin="round" d="M3 11v6c0 1.66 4.03 3 9 3s9-1.34 9-3v-6"/>
            </svg>
        </a>

        <a href="{{ route('analysis') }}" class="db-nav-item" title="Analysis">
            <svg width="20" height="20" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
                <path stroke-linecap="round" stroke-linejoin="round" d="M3 17l4-4 4 3 4-6 4-2"/>
                <path stroke-linecap="round" stroke-linejoin="round" d="M3 21h18"/>
            </svg>
        </a>

        <a href="{{ route('plan') }}" class="db-nav-item" title="Plan">
            <svg width="20" height="20" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
                <rect x="3" y="4" width="18" height="18" rx="2"/>
                <path stroke-linecap="round" stroke-linejoin="round" d="M16 2v4M8 2v4M3 10h18"/>
                <path stroke-linecap="round" d="M8 14h.01M12 14h.01M16 14h.01M8 18h.01M12 18h.01"/>
            </svg>
        </a>

        <a href="{{ route('reports') }}" class="db-nav-item active" title="Reports">
            <svg width="20" height="20" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
                <path stroke-linecap="round" stroke-linejoin="round" d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2"/>
                <rect x="9" y="3" width="6" height="4" rx="1"/>
                <path stroke-linecap="round" d="M9 12h6M9 16h4"/>
            </svg>
        </a>

        <div class="db-sidebar-bottom">
            <a href="{{ route('settings') }}" class="db-nav-item" title="Settings">
                <svg width="20" height="20" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
                    <path stroke-linecap="round" stroke-linejoin="round" d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z"/>
                    <circle cx="12" cy="12" r="3"/>
                </svg>
            </a>
        </div>
    </nav>

    {{-- MAIN --}}
    <div class="db-main">
        <header class="db-topbar">
            <div style="font-size:15px;font-weight:600;color:var(--text)">Reports</div>
        </header>

        <div style="padding:40px;text-align:center;color:#5b6a65;margin-top:60px">
            <svg width="48" height="48" fill="none" viewBox="0 0 24 24" stroke="#c8d5cf" stroke-width="1.5" style="margin:0 auto 16px;display:block">
                <path stroke-linecap="round" stroke-linejoin="round" d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2"/>
                <rect x="9" y="3" width="6" height="4" rx="1"/>
                <path stroke-linecap="round" d="M9 12h6M9 16h4"/>
            </svg>
            <div style="font-size:16px;font-weight:600;color:#3d5247;margin-bottom:8px">Reports coming soon</div>
            <div style="font-size:13px;max-width:360px;margin:0 auto;line-height:1.6">
                Word/PDF exports, forensic decision records, scenario comparisons, and forecast accuracy reports.
            </div>
        </div>
    </div>

</div>
</body>
</html>

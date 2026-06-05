<!doctype html>
<html lang="en">
<head>
    <meta charset="utf-8">
    <meta name="viewport" content="width=device-width, initial-scale=1">
    <meta name="csrf-token" content="{{ csrf_token() }}">
    <title>{{ $title ?? 'Gilba' }} — {{ config('app.name') }}</title>
    <link rel="icon" type="image/svg+xml" href="/images/favicon.svg">
    <script>
        window.GAIP_HUB_CONFIG = {
            nonce:        "{{ csrf_token() }}",
            csrfToken:    "{{ csrf_token() }}",
            restUrl:      "{{ url('/api') }}/",
            userId:       {{ auth()->id() ?? 0 }},
            activeSiteId: @json($activeSite?->id),
            siteType:     @json($activeSite?->site_type),
            siteUrl:      "{{ url('/') }}",
            hubUrl:       "{{ route('hub') }}",
            hubMode:      "agronomic",
        };
        window.GAIP_DASHBOARD_DATA = @json($analysisCache ?? null);
    </script>
    @yield('head')
    <link rel="stylesheet" href="{{ $legacyAssetUrl('gaip-design-system.css') }}">
    <link rel="stylesheet" href="{{ $legacyAssetUrl('dashboard-ui.css') }}">
    @yield('styles')
</head>
<body>

<div class="db-shell">

    @include('partials.sidebar', ['currentPage' => $currentPage ?? ''])

    <div class="db-main">

        @include('partials.topbar')

        @yield('content')

    </div>

</div>

{{-- Mobile bottom navigation --}}
@php $cp = $currentPage ?? ''; @endphp
<nav class="db-bottom-nav">
    <a href="{{ route('dashboard') }}" class="db-bottom-nav-item{{ $cp === 'dashboard' ? ' active' : '' }}">
        <svg width="20" height="20" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
            <rect x="3" y="3" width="7" height="7" rx="1.5"/><rect x="14" y="3" width="7" height="7" rx="1.5"/>
            <rect x="3" y="14" width="7" height="7" rx="1.5"/><rect x="14" y="14" width="7" height="7" rx="1.5"/>
        </svg>
        <span>Dashboard</span>
    </a>
    <a href="{{ route('data') }}" class="db-bottom-nav-item{{ $cp === 'data' ? ' active' : '' }}">
        <svg width="20" height="20" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
            <ellipse cx="12" cy="5" rx="9" ry="3"/>
            <path stroke-linecap="round" stroke-linejoin="round" d="M3 5v6c0 1.66 4.03 3 9 3s9-1.34 9-3V5M3 11v6c0 1.66 4.03 3 9 3s9-1.34 9-3v-6"/>
        </svg>
        <span>Data</span>
    </a>
    <a href="{{ route('analysis') }}" class="db-bottom-nav-item{{ $cp === 'analysis' ? ' active' : '' }}">
        <svg width="20" height="20" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
            <path stroke-linecap="round" stroke-linejoin="round" d="M3 17l4-4 4 3 4-6 4-2M3 21h18"/>
        </svg>
        <span>Analysis</span>
    </a>
    <a href="{{ route('plan') }}" class="db-bottom-nav-item{{ $cp === 'plan' ? ' active' : '' }}">
        <svg width="20" height="20" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
            <rect x="3" y="4" width="18" height="18" rx="2"/>
            <path stroke-linecap="round" stroke-linejoin="round" d="M16 2v4M8 2v4M3 10h18"/>
            <path stroke-linecap="round" d="M8 14h.01M12 14h.01M16 14h.01M8 18h.01M12 18h.01"/>
        </svg>
        <span>Plan</span>
    </a>
    <a href="{{ route('reports.export') }}" class="db-bottom-nav-item{{ $cp === 'reports' ? ' active' : '' }}">
        <svg width="20" height="20" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
            <path stroke-linecap="round" stroke-linejoin="round" d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2"/>
            <rect x="9" y="3" width="6" height="4" rx="1"/>
            <path stroke-linecap="round" d="M9 12h6M9 16h4"/>
        </svg>
        <span>Reports</span>
    </a>
</nav>

{{-- Shared info popover — used by db-info-icon on all pages --}}
<div id="db-info-popover" class="db-info-popover" style="display:none" role="tooltip" aria-live="polite">
    <div class="db-info-popover-arrow" id="db-info-popover-arrow"></div>
    <button class="db-info-popover-close" id="db-info-popover-close" aria-label="Close">×</button>
    <div class="db-info-popover-title" id="db-info-popover-title"></div>
    <div class="db-info-popover-body" id="db-info-popover-body" style="white-space:pre-line"></div>
</div>

@yield('overlays')
<script src="{{ $legacyAssetUrl('dashboard-ui.js') }}"></script>
@yield('scripts')

</body>
</html>

<!doctype html>
<html lang="en">
<head>
    <meta charset="utf-8">
    <meta name="viewport" content="width=device-width, initial-scale=1">
    <meta name="csrf-token" content="{{ csrf_token() }}">
    <title>{{ $title ?? 'Gilba' }} — {{ config('app.name') }}</title>
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

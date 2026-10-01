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
            {{-- GH-792 (queue item 79): `hubUrl` is gone from this view. It was an address of the old
                 plugin-era page in the config of a client page, with no reader in `assets` -- measured, the
                 only mention left is a comment saying a card no longer navigates there. An address nobody
                 uses is the next link somebody adds by finding it here. The runner's own layout
                 (`layouts/app.blade.php`) keeps it: that page IS the runner. --}}
            hubMode:      "agronomic",
            // GH-441 (GH-439 stage 2): the site's stored config travels with
            // the page. Pages that run the legacy engine used to start with
            // nothing and read a copy out of localStorage instead.
            savedLocation: @json($injectedSavedLocation ?? null),
            gaipConfig:   @json(($injectedGaipConfig ?? []) ?: null),
            // GH-752: the site's construction, resolved by the one dictionary as the app layout
            // resolves it (GH-664). The report pages run the engines in a hidden frame of this layout.
            construction: @json(\App\Support\CalculationInputs::resolveConstruction(($injectedGaipConfig ?? []) ?: [])),
            // GH-752: the inputs list's word for the site's methodology, or null when it has none or
            // one the list does not declare. The soil page labels its thresholds with it.
            methodologyShort: @json(\App\Support\CalculationInputs::methodologyShort(strtolower((string) (($injectedGaipConfig ?? [])['turf']['methodology'] ?? '')))),
            // GH-533 (PLAN-samples-sync-FINAL, stage 2, item 6): may the
            // person looking at this page change what is on it?
            //
            // It has to be answered here because from this stage every sample
            // action is its own request. Until now a viewer added a sample in
            // the browser, the one snapshot push collected a 403, and the
            // failure went to a console warning. Per record, the same viewer
            // makes a request per action and sees each one refused.
            //
            // Absent is not false -- see canWriteSamples() in
            // sample-persistence.js. A page that does not say this is a page
            // we have not taught to answer, not a page that said no.
            canEditActiveSite: @json($activeSite ? (bool) auth()->user()?->canEditSite($activeSite) : false),
        };
        {{-- GH-678 (queue item 6, place 3 -- the gates): the dependency graph as DATA,
             here as well as in `layouts.app`, and its absence here is what the gate
             found on its first run. `reports/export`, `reports/scenarios` and
             `reports/forensic` all LOAD `dependency-graph.js` and all extend this
             layout, not `layouts.app` -- so on three pages a client can open, the
             module ran with no data. It answered anyway, out of the twenty-six engines
             it used to carry itself, and nothing said the page had not been given
             anything. One injection point per layout that loads the module. --}}
        window.GAIP_DEPENDENCY_GRAPH = @json(\App\Support\DependencyGraph::forClient());
        {{-- GH-752: the SLAN ranges, from their one file (assets/slan-ranges.json, read by
             App\Support\SlanRanges). The report pages on this layout run the engine that judges
             SLAN samples, and data goes where the code that reads it goes. --}}
        window.GAIP_SLAN_RANGES = @json(\App\Support\SlanRanges::forClient());
        {{-- GH-722: how a lab writes the column for each reading of a sample, from the
             one file that declares it. The sample manager builds its tables from this
             and keeps only which form field a reading fills. --}}
        window.GAIP_LAB_READING_NAMES = @json(\App\Support\LabReadingNames::forClient());
        window.GAIP_DASHBOARD_DATA = @json($analysisCache ?? null);
        // GH-441: the setup wizard reads the database's own wizard record
        // rather than deciding from localStorage, which is why a clean browser
        // used to see it on a site that had completed it.
        window.GAIP_WIZARD_CONFIG = Object.assign({}, window.GAIP_WIZARD_CONFIG || {}, {
            nonce:          "{{ csrf_token() }}",
            csrfToken:      "{{ csrf_token() }}",
            restUrl:        "{{ url('/api') }}/",
            activeSiteId:   @json($activeSite?->id),
            savedLocation:  @json($injectedSavedLocation ?? null),
            wizardComplete: @json($injectedWizardAnswered ?? false),
            wizardState:    @json($injectedWizardState ?? [])
        });
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
<script>window.GAIP_SpeciesData = { speciesByType: @json($speciesData ?? []) };</script>
<script src="{{ $legacyAssetUrl('settings-unavailable-banner.js') }}"></script>
{{-- GH-536 (stage 3): the samples half of the same idea — a failed read says so, with a Retry. --}}
<script src="{{ $legacyAssetUrl('samples-unavailable-banner.js') }}"></script>
<script src="{{ $legacyAssetUrl('dashboard-ui.js') }}"></script>
@yield('scripts')

</body>
</html>

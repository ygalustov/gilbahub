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
    <title>Analysis — {{ config('app.name') }}</title>
    <script>
        window.GAIP_HUB_CONFIG = Object.assign({}, window.GAIP_HUB_CONFIG || {}, {
            nonce:           "{{ csrf_token() }}",
            csrfToken:       "{{ csrf_token() }}",
            restUrl:         "{{ url('/api') }}/",
            userId:          {{ auth()->id() ?? 0 }},
            activeSiteId:    @json($activeSite?->id),
            siteUrl:         "{{ url('/') }}",
            hubUrl:          "{{ route('hub') }}",
            hubMode:         "agronomic",
            savedLocation:   @json($savedLocation),
            turfSpecies:     @json($turfSpecies),
            overseedSpecies: @json($overseedSpecies),
            turfMethodology: @json($turfMethodology),
            percentC3Cover:  @json($percentC3Cover)
        });
        window.GAIP_DASHBOARD_DATA = @json($analysisCache);
    </script>
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

        <a href="{{ route('analysis') }}" class="db-nav-item active" title="Analysis">
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

        <a href="{{ route('reports') }}" class="db-nav-item" title="Reports">
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

        {{-- TOP BAR — rendered once, never changes on tab switch --}}
        <header class="db-topbar">
            <div class="db-site-switcher-wrap" id="db-site-switcher-wrap" style="position:relative">
                <button class="db-site-switcher" id="db-site-switcher-btn" type="button"
                        aria-haspopup="listbox" aria-expanded="false">
                    <span id="db-site-name">{{ $activeSite?->name ?? 'Select site' }}</span>
                    <svg width="14" height="14" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2.5">
                        <path stroke-linecap="round" stroke-linejoin="round" d="M19 9l-7 7-7-7"/>
                    </svg>
                </button>
                <div class="db-site-dropdown" id="db-site-dropdown" hidden
                     style="position:absolute;top:calc(100% + 6px);left:0;z-index:200;min-width:200px;background:#fff;border:1px solid #d8e0dc;border-radius:8px;box-shadow:0 4px 16px rgba(0,0,0,.12);overflow:hidden">
                    @foreach($allSites as $site)
                    <button type="button"
                            class="db-site-option{{ $site->id === $activeSite?->id ? ' active' : '' }}"
                            data-site-id="{{ $site->id }}"
                            style="display:block;width:100%;padding:10px 16px;border:0;background:{{ $site->id === $activeSite?->id ? '#e8f3ed' : 'transparent' }};text-align:left;cursor:pointer;font:inherit;font-size:14px;color:#17231f">
                        {{ $site->name }}
                    </button>
                    @endforeach
                </div>
            </div>

            <div class="db-context-pills">
                @if($turfMethodology)
                    <span class="db-pill">{{ $turfMethodology }}</span>
                @endif
                <span class="db-pill">{{ $turfSpecies ?? '' }}</span>
                <span class="db-pill">{{ $locationName ?? '' }}</span>
            </div>

            <div class="db-topbar-right">
                <span id="db-analysis-ts" class="db-analysis-ts">Analysis: —</span>
                <button class="db-rerun-btn" id="db-rerun-btn" type="button">
                    <svg width="12" height="12" viewBox="0 0 24 24" fill="currentColor">
                        <polygon points="5,3 19,12 5,21"/>
                    </svg>
                    Re-run
                </button>
            </div>
        </header>

        {{-- NOTIFICATION BAR --}}
        <div id="db-analysis-notice" class="db-verdict warning" style="display:none">
            <svg width="16" height="16" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2.5" style="flex-shrink:0">
                <path stroke-linecap="round" stroke-linejoin="round" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"/>
            </svg>
            <span id="db-analysis-notice-text"></span>
            <button id="db-analysis-notice-dismiss" type="button"
                    style="margin-left:auto;background:none;border:none;color:inherit;opacity:.75;cursor:pointer;font-size:13px;padding:0 4px">
                Dismiss ✕
            </button>
        </div>

        {{-- TABS BAR — rendered once, router sets the active class --}}
        <nav class="gl-tabs-bar">
            <div class="gl-tabs-inner">
                <a href="#disease" class="gl-tab" data-tab="disease">
                    <svg width="13" height="13" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2.5" style="flex-shrink:0">
                        <path stroke-linecap="round" stroke-linejoin="round" d="M12 9v2m0 4h.01M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z"/>
                    </svg>
                    Disease Risk <span class="gl-tab-badge" id="gl-badge-disease"></span>
                </a>
                <a href="#" class="gl-tab">
                    Stress <span class="gl-tab-badge" id="gl-badge-stress"></span>
                </a>
                <a href="#growth-light" class="gl-tab" data-tab="growth-light">
                    <svg width="13" height="13" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2.5" style="flex-shrink:0">
                        <path stroke-linecap="round" stroke-linejoin="round" d="M12 3c0 0-6 4-6 9a6 6 0 0012 0c0-5-6-9-6-9z"/>
                    </svg>
                    Growth &amp; Light
                </a>
                <a href="#" class="gl-tab">Soil &amp; Nutrition</a>
                <a href="#" class="gl-tab">Water Balance</a>
                <a href="#" class="gl-tab">PGR &amp; Irrigation</a>
                <a href="#" class="gl-tab">Pre-emergent</a>
            </div>
            <span class="gl-tab-accuracy" id="gl-tab-accuracy" hidden></span>
        </nav>

        {{-- TAB CONTENT WRAPPERS — both in DOM, router shows/hides --}}

        <div id="analysis-tab-disease" style="flex:1;overflow-y:auto;display:none">
            <div id="dr-page-content">
                <div style="padding:40px;text-align:center;color:#5b6a65">Loading disease analysis…</div>
            </div>
        </div>

        <div id="analysis-tab-growth-light" style="flex:1;overflow-y:auto;display:none">
            <div id="gl-page-content">
                <div style="padding:40px;text-align:center;color:#5b6a65">Loading growth &amp; light analysis…</div>
            </div>
        </div>

    </div>{{-- /.db-main --}}
</div>{{-- /.db-shell --}}

{{-- Shared info popover --}}
<div id="db-info-popover" class="db-info-popover" style="display:none">
    <div id="db-info-popover-arrow" class="db-info-popover-arrow"></div>
    <button id="db-info-popover-close" class="db-info-popover-close" type="button">&#215;</button>
    <div id="db-info-popover-title" class="db-info-popover-title"></div>
    <div id="db-info-popover-body" class="db-info-popover-body" style="white-space:pre-line"></div>
</div>

{{-- Scripts: router MUST be first so GAIP_ANALYSIS_ROUTER is set before page scripts run --}}
<script src="{{ $legacyAssetUrl('dashboard-ui.js') }}"></script>
<script src="{{ $legacyAssetUrl('analysis-router.js') }}"></script>
<script src="{{ $legacyAssetUrl('disease-analysis.js') }}"></script>
<script src="{{ $legacyAssetUrl('growth-light-analysis.js') }}"></script>

</body>
</html>

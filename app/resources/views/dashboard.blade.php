@php
    $legacyAssetUrl = function (string $asset): string {
        $path = base_path('../assets/'.$asset);
        $version = is_file($path) ? '?v='.filemtime($path) : '';
        return url('/legacy-assets/'.$asset).$version;
    };
    $activeSite = auth()->user()?->activeSite;
    $savedLocation = [
        'name' => $activeSite?->location_name ?? '',
        'lat'  => $activeSite?->latitude ?? '',
        'lon'  => $activeSite?->longitude ?? '',
    ];
@endphp
<!doctype html>
<html lang="en">
<head>
    <meta charset="utf-8">
    <meta name="viewport" content="width=device-width, initial-scale=1">
    <meta name="csrf-token" content="{{ csrf_token() }}">
    <title>Dashboard — {{ config('app.name') }}</title>
    <script>
        window.GAIP_HUB_CONFIG = Object.assign({}, window.GAIP_HUB_CONFIG || {}, {
            nonce: "{{ csrf_token() }}",
            csrfToken: "{{ csrf_token() }}",
            restUrl: "{{ url('/api') }}/",
            userId: {{ auth()->id() ?? 0 }},
            activeSiteId: @json($activeSite?->id),
            siteUrl: "{{ url('/') }}",
            hubUrl: "{{ route('hub') }}",
            hubMode: "agronomic",
            savedLocation: @json($savedLocation)
        });
    </script>
    <link rel="stylesheet" href="{{ $legacyAssetUrl('gaip-design-system.css') }}">
    <link rel="stylesheet" href="{{ $legacyAssetUrl('dashboard-ui.css') }}">
</head>
<body>

<div class="db-shell">

    {{-- ============================================================
         LEFT SIDEBAR
    ============================================================ --}}
    <nav class="db-sidebar">
        {{-- Logo --}}
        <div class="db-sidebar-logo">
            <svg width="20" height="20" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2.5">
                <path stroke-linecap="round" stroke-linejoin="round" d="M12 3c0 0-6 4-6 9a6 6 0 0012 0c0-5-6-9-6-9z"/>
            </svg>
        </div>

        {{-- Dashboard --}}
        <a href="{{ route('dashboard') }}" class="db-nav-item active" title="Dashboard">
            <svg width="20" height="20" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
                <rect x="3" y="3" width="7" height="7" rx="1.5"/>
                <rect x="14" y="3" width="7" height="7" rx="1.5"/>
                <rect x="3" y="14" width="7" height="7" rx="1.5"/>
                <rect x="14" y="14" width="7" height="7" rx="1.5"/>
            </svg>
        </a>

        {{-- Data --}}
        <a href="#" class="db-nav-item" title="Data">
            <svg width="20" height="20" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
                <path stroke-linecap="round" stroke-linejoin="round" d="M3 10h18M3 14h18M10 3v18"/>
            </svg>
        </a>

        {{-- Analysis --}}
        <a href="#" class="db-nav-item" title="Analysis">
            <svg width="20" height="20" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
                <path stroke-linecap="round" stroke-linejoin="round" d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z"/>
            </svg>
        </a>

        {{-- Reports --}}
        <a href="#" class="db-nav-item" title="Reports">
            <svg width="20" height="20" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
                <path stroke-linecap="round" stroke-linejoin="round" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"/>
            </svg>
        </a>

        {{-- Stadium --}}
        <a href="{{ route('stadium') }}" class="db-nav-item" title="Stadium">
            <svg width="20" height="20" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
                <ellipse cx="12" cy="12" rx="9" ry="5"/>
                <path stroke-linecap="round" d="M3 12c0 4 4 7 9 7s9-3 9-7"/>
            </svg>
        </a>

        {{-- Settings at bottom --}}
        <div class="db-sidebar-bottom">
            <a href="{{ route('settings') }}" class="db-nav-item" title="Settings">
                <svg width="20" height="20" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
                    <path stroke-linecap="round" stroke-linejoin="round" d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z"/>
                    <circle cx="12" cy="12" r="3"/>
                </svg>
            </a>
        </div>
    </nav>

    {{-- ============================================================
         MAIN AREA
    ============================================================ --}}
    <div class="db-main">

        {{-- TOP BAR --}}
        <header class="db-topbar">
            {{-- Site switcher --}}
            <button class="db-site-switcher" id="db-site-switcher-btn" type="button">
                <span id="db-site-name">{{ $activeSite?->name ?? 'Select site' }}</span>
                <svg width="14" height="14" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2.5">
                    <path stroke-linecap="round" stroke-linejoin="round" d="M19 9l-7 7-7-7"/>
                </svg>
            </button>

            {{-- Context pills (populated by JS) --}}
            <div class="db-context-pills" id="db-context-pills">
                <span class="db-pill" id="db-pill-species">—</span>
                <span class="db-pill" id="db-pill-region">—</span>
            </div>

            <div class="db-topbar-right">
                {{-- Analysis timestamp --}}
                <span class="db-analysis-ts" id="db-analysis-ts">Analysis: —</span>

                {{-- Re-run --}}
                <button class="db-rerun-btn" id="db-rerun-btn" type="button">
                    <svg width="14" height="14" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2.5">
                        <path stroke-linecap="round" stroke-linejoin="round" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15"/>
                    </svg>
                    Re-run
                </button>

                {{-- Settings --}}
                <a href="{{ route('settings') }}" class="db-settings-btn" title="Settings">
                    <svg width="16" height="16" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
                        <path stroke-linecap="round" stroke-linejoin="round" d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z"/>
                        <circle cx="12" cy="12" r="3"/>
                    </svg>
                </a>
            </div>
        </header>

        {{-- VERDICT BAR (Tier 0) --}}
        <div class="db-verdict critical" id="db-verdict-bar">
            <svg width="16" height="16" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2.5" style="flex-shrink:0">
                <path stroke-linecap="round" stroke-linejoin="round" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"/>
            </svg>
            <span id="db-verdict-text">Dollar Spot risk HIGH — forecast 69% tomorrow</span>
        </div>

        {{-- PAGE BODY --}}
        <div class="db-body">

            {{-- ── TIER 4: Conditions strip ── --}}
            <div class="db-conditions" id="db-conditions-strip">
                <div class="db-conditions-current">
                    <div class="db-weather-icon" id="db-weather-icon">🌫️</div>
                    <div>
                        <div class="db-temp" id="db-temp">—°C</div>
                        <div class="db-weather-desc" id="db-weather-desc">Loading…</div>
                    </div>
                </div>

                <div class="db-conditions-divider"></div>

                <div class="db-forecast" id="db-forecast">
                    <div class="db-forecast-day">
                        <div class="db-forecast-label">Wed</div>
                        <div class="db-forecast-icon">☀️</div>
                        <div class="db-forecast-temp">17°</div>
                        <div class="db-forecast-rain">0mm</div>
                    </div>
                    <div class="db-forecast-day">
                        <div class="db-forecast-label">Thu</div>
                        <div class="db-forecast-icon">☀️</div>
                        <div class="db-forecast-temp">19°</div>
                        <div class="db-forecast-rain">0mm</div>
                    </div>
                    <div class="db-forecast-day">
                        <div class="db-forecast-label">Fri</div>
                        <div class="db-forecast-icon">🌧️</div>
                        <div class="db-forecast-temp">16°</div>
                        <div class="db-forecast-rain">6mm</div>
                    </div>
                </div>
            </div>

            {{-- ── TIER 2: Field Status — Vital Signs ── --}}
            <div>
                <div class="db-section-heading">Field Status</div>
                <div class="db-vitals" id="db-vitals-row">

                    {{-- Growth Potential --}}
                    <div class="db-vital-card">
                        <div class="db-vital-label">
                            Growth Potential
                            <span class="db-info-icon" title="Predicted turfgrass growth capacity based on temperature and species">i</span>
                        </div>
                        <div class="db-vital-main" id="db-gp-value">62%</div>
                        <div class="db-vital-sub" id="db-gp-forecast">
                            <strong>↓ Forecast 55% in 8 days</strong>
                        </div>
                        <div class="db-vital-footer" id="db-gp-footer">Cool-Season · Thermal 26%</div>
                    </div>

                    {{-- Disease Risk --}}
                    <div class="db-vital-card">
                        <div class="db-vital-label">
                            Disease Risk
                            <span class="db-info-icon" title="Current disease pressure across monitored pathogens">i</span>
                        </div>
                        <div class="db-vital-main critical" id="db-disease-value">HIGH</div>
                        <div class="db-vital-sub" id="db-disease-today">32% today</div>
                        <div class="db-vital-alert" id="db-disease-alert">⚠ 69% in 1 day</div>
                        <div class="db-vital-footer" id="db-disease-name">Fusarium Patch (Microdochium)</div>
                    </div>

                    {{-- Stress Index --}}
                    <div class="db-vital-card">
                        <div class="db-vital-label">
                            Stress Index
                            <span class="db-info-icon" title="Composite stress score across traffic, climate, and wear factors">i</span>
                        </div>
                        <div class="db-vital-main" id="db-stress-value">19 <span style="font-size:14px;font-weight:500;color:var(--gaip-text-muted)">/100</span></div>
                        <div class="db-vital-sub" id="db-stress-driver">Driven by: <strong>Traffic 93%</strong></div>
                        <div class="db-progress-bar">
                            <div class="db-progress-fill" id="db-stress-bar" style="width:19%;background:#d97706"></div>
                        </div>
                        <div class="db-vital-footer" id="db-stress-trend">↓ Falling</div>
                    </div>

                    {{-- Soil Moisture VWC --}}
                    <div class="db-vital-card">
                        <div class="db-vital-label">
                            Soil Moisture (VWC)
                            <span class="db-info-icon" title="Volumetric Water Content — current soil moisture level">i</span>
                        </div>
                        <div class="db-vital-main" id="db-vwc-value">13%</div>
                        <div class="db-range-bar-wrap" id="db-vwc-bar-wrap">
                            {{-- Target zone 12-15% --}}
                            <div class="db-range-bar-target" style="left:30%;width:7.5%"></div>
                            {{-- Fill to current value (13% of 40% max ≈ 32.5%) --}}
                            <div class="db-range-bar-fill" id="db-vwc-fill" style="width:32.5%"></div>
                        </div>
                        <div class="db-vital-sub" style="font-size:10px;color:var(--gaip-text-muted)">
                            Target: <strong style="color:var(--gaip-accent)">12–15%</strong>
                        </div>
                        <div class="db-vital-footer" id="db-vwc-msg">0.7mm buffer before irrigation trigger</div>
                    </div>

                    {{-- Irrigation Plan --}}
                    <div class="db-vital-card">
                        <div class="db-vital-label">
                            Irrigation Plan
                            <span class="db-info-icon" title="Weekly water requirement based on ET and recent rainfall">i</span>
                        </div>
                        <div class="db-vital-main" id="db-irr-value">7<span style="font-size:16px;font-weight:600"> mm</span></div>
                        <div class="db-vital-sub">Weekly requirement</div>
                        <div class="db-vital-footer" id="db-irr-forecast" style="color:#16a34a">↑ Ahead by 6mm — skip cycle</div>
                    </div>

                </div>{{-- /db-vitals --}}
            </div>

            {{-- ── TIER 1: Action Queue ── --}}
            <div class="db-action-queue" id="db-action-queue">
                <div class="db-aq-header">
                    <div class="db-aq-title" id="db-aq-headline">Act on this today</div>
                    <div class="db-aq-meta" id="db-aq-resolved">0/1 resolved</div>
                </div>

                {{-- TODAY --}}
                <div class="db-aq-section">
                    <div class="db-aq-section-head">
                        <span class="dot dot-red"></span>
                        TODAY
                        <span style="color:var(--gaip-text-muted);margin-left:2px">(1)</span>
                    </div>
                    <div class="db-aq-card">
                        <div class="db-aq-card-chips">
                            <span class="db-chip db-chip-estimate">Estimate</span>
                            <span class="db-chip db-chip-disease">Disease › Dollar Spot</span>
                        </div>
                        <div class="db-aq-card-title">Apply fungicide today</div>
                        <div class="db-aq-card-reason">Risk 35% (threshold 20%) · holding stable</div>
                        <div class="db-aq-card-window">
                            <svg width="12" height="12" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2.5">
                                <path stroke-linecap="round" stroke-linejoin="round" d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z"/>
                            </svg>
                            Spray window: Optimal · Rain-free until Friday
                        </div>
                        <div class="db-aq-card-consequence">If delayed: spray cost doubles</div>
                        <div class="db-aq-card-actions">
                            <button class="db-btn-commit">Commit — spray today</button>
                            <button class="db-btn-defer">Defer</button>
                            <a class="db-btn-details">View Details →</a>
                        </div>
                    </div>
                </div>

                {{-- THIS WEEK --}}
                <div class="db-aq-section">
                    <div class="db-aq-section-head">
                        <span class="dot dot-amber"></span>
                        THIS WEEK
                        <span style="color:var(--gaip-text-muted);margin-left:2px">(1)</span>
                    </div>
                    <div class="db-aq-card">
                        <div class="db-aq-card-chips">
                            <span class="db-chip db-chip-estimate">Estimate</span>
                            <span class="db-chip db-chip-preemerg">Pre-emergent</span>
                        </div>
                        <div class="db-aq-card-title">Order pre-emergent</div>
                        <div class="db-aq-card-reason">Soil 17.0°C · window opens in ~6 days</div>
                        <div class="db-aq-card-consequence">If delayed: one window this season</div>
                        <div class="db-aq-card-actions">
                            <button class="db-btn-commit amber">Commit — order now</button>
                            <button class="db-btn-defer">Defer</button>
                            <a class="db-btn-details">View Details →</a>
                        </div>
                    </div>
                </div>

                {{-- WATCHING --}}
                <div class="db-aq-section">
                    <div class="db-aq-section-head">
                        <span class="dot dot-grey"></span>
                        WATCHING
                        <span style="color:var(--gaip-text-muted);margin-left:2px">(2)</span>
                    </div>
                    <div class="db-aq-card">
                        <div class="db-aq-card-title">Irrigation on track</div>
                        <div class="db-aq-card-reason">VWC 13% within target band 12–15% · Friday rain 6mm</div>
                        <div class="db-aq-card-actions">
                            <button class="db-btn-commit grey">Commit to this decision</button>
                            <button class="db-btn-defer">Defer</button>
                            <a class="db-btn-details">View Details →</a>
                        </div>
                    </div>
                    <div class="db-aq-card">
                        <div class="db-aq-card-title">Nutrition (foliar K)</div>
                        <div class="db-aq-card-reason">Tissue K 1.8% (target 2.2%) · plan early next week</div>
                        <div class="db-aq-card-actions">
                            <button class="db-btn-commit grey">Commit to this decision</button>
                            <button class="db-btn-defer">Defer</button>
                            <a class="db-btn-details">View Details →</a>
                        </div>
                    </div>
                </div>

            </div>{{-- /db-action-queue --}}

            {{-- ── TIER 5: Data Sources ── --}}
            <div class="db-sources" id="db-data-sources">
                <div class="db-sources-header">
                    <div class="db-sources-title">Data Sources</div>
                    <span class="db-sources-issue-badge" id="db-sources-badge">1 issue</span>
                </div>

                <div class="db-sources-grid" id="db-sources-grid">
                    <div class="db-source-item">
                        <div class="db-source-name">Weather</div>
                        <div class="db-source-sub">Open-Meteo</div>
                        <div class="db-source-status">
                            <span class="db-source-dot ok"></span>
                            <span class="db-source-status-text ok">Live</span>
                        </div>
                    </div>
                    <div class="db-source-item">
                        <div class="db-source-name">Soil Test</div>
                        <div class="db-source-sub">&nbsp;</div>
                        <div class="db-source-status">
                            <span class="db-source-dot ok"></span>
                            <span class="db-source-status-text ok">12d ago</span>
                        </div>
                    </div>
                    <div class="db-source-item">
                        <div class="db-source-name">Tissue Test</div>
                        <div class="db-source-sub">&nbsp;</div>
                        <div class="db-source-status">
                            <span class="db-source-dot warning"></span>
                            <span class="db-source-status-text warning">36d ago</span>
                        </div>
                        <a class="db-source-action" href="#">Import</a>
                    </div>
                    <div class="db-source-item">
                        <div class="db-source-name">Water Test</div>
                        <div class="db-source-sub">Current (8d)</div>
                        <div class="db-source-status">
                            <span class="db-source-dot ok"></span>
                            <span class="db-source-status-text ok">Current</span>
                        </div>
                    </div>
                    <div class="db-source-item">
                        <div class="db-source-name">Sensors</div>
                        <div class="db-source-sub">Hydrosight</div>
                        <div class="db-source-status">
                            <span class="db-source-dot ok"></span>
                            <span class="db-source-status-text ok">3m ago</span>
                        </div>
                    </div>
                    <div class="db-source-item">
                        <div class="db-source-name">Spray Log</div>
                        <div class="db-source-sub">Up to date (8d)</div>
                        <div class="db-source-status">
                            <span class="db-source-dot ok"></span>
                            <span class="db-source-status-text ok">Updated</span>
                        </div>
                    </div>
                </div>

                <div class="db-sources-footer">
                    <span class="db-sources-summary" id="db-sources-summary">5 sources current · 1 needs update</span>
                    <div class="db-sources-progress">
                        <div class="db-sources-progress-bar">
                            <div class="db-sources-progress-fill" style="width:83.3%"></div>
                        </div>
                        <span id="db-sources-score">5/6 sources</span>
                    </div>
                </div>
            </div>

        </div>{{-- /db-body --}}
    </div>{{-- /db-main --}}
</div>{{-- /db-shell --}}

</body>
</html>

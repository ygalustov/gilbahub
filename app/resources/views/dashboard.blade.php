@php
    $legacyAssetUrl = function (string $asset): string {
        $path = base_path('../assets/'.$asset);
        $version = is_file($path) ? '?v='.filemtime($path) : '';
        return url('/legacy-assets/'.$asset).$version;
    };
    $today = now()->toDateString();
    $ageLabel = function(?string $dateStr) use ($today): string {
        if (!$dateStr) return '—';
        $days = (int) now()->diffInDays($dateStr, false) * -1;
        if ($days <= 0)  return 'Today';
        if ($days === 1) return '1d ago';
        return $days . 'd ago';
    };
    $ageClass = function(?string $dateStr): string {
        if (!$dateStr) return 'warning';
        $days = (int) now()->diffInDays($dateStr, false) * -1;
        return $days > 30 ? 'warning' : 'ok';
    };
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
            nonce:         "{{ csrf_token() }}",
            csrfToken:     "{{ csrf_token() }}",
            restUrl:       "{{ url('/api') }}/",
            userId:        {{ auth()->id() ?? 0 }},
            activeSiteId:  @json($activeSite?->id),
            siteUrl:       "{{ url('/') }}",
            hubUrl:        "{{ route('hub') }}",
            hubMode:       "agronomic",
            savedLocation: @json($savedLocation)
        });
        // Analysis results from DB — primary data source for the dashboard
        window.GAIP_DASHBOARD_DATA = @json($analysisCache);
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
        <a href="{{ route('data') }}" class="db-nav-item" title="Data">
            <svg width="20" height="20" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
                <ellipse cx="12" cy="5" rx="9" ry="3"/>
                <path stroke-linecap="round" stroke-linejoin="round" d="M3 5v6c0 1.66 4.03 3 9 3s9-1.34 9-3V5"/>
                <path stroke-linecap="round" stroke-linejoin="round" d="M3 11v6c0 1.66 4.03 3 9 3s9-1.34 9-3v-6"/>
            </svg>
        </a>

        {{-- Analysis --}}
        <a href="{{ route('analysis.growth-light') }}" class="db-nav-item" title="Analysis">
            <svg width="20" height="20" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
                <path stroke-linecap="round" stroke-linejoin="round" d="M3 17l4-4 4 3 4-6 4-2"/>
                <path stroke-linecap="round" stroke-linejoin="round" d="M3 21h18"/>
            </svg>
        </a>

        {{-- Reports --}}
        <a href="#" class="db-nav-item" title="Reports">
            <svg width="20" height="20" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
                <path stroke-linecap="round" stroke-linejoin="round" d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2"/>
                <rect x="9" y="3" width="6" height="4" rx="1"/>
                <path stroke-linecap="round" d="M9 12h6M9 16h4"/>
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

            {{-- Context pills from DB config --}}
            <div class="db-context-pills" id="db-context-pills">
                @if($turfMethodology)
                    <span class="db-pill">{{ $turfMethodology }}</span>
                @endif
                <span class="db-pill" id="db-pill-species">{{ $turfSpecies ?? '' }}</span>
                <span class="db-pill" id="db-pill-region">{{ $locationName ?? '' }}</span>
            </div>

            <div class="db-topbar-right">
                {{-- Analysis timestamp --}}
                <span class="db-analysis-ts" id="db-analysis-ts">Analysis: —</span>

                {{-- Re-run --}}
                <button class="db-rerun-btn" id="db-rerun-btn" type="button">
                    <svg width="12" height="12" viewBox="0 0 24 24" fill="currentColor">
                        <polygon points="5,3 19,12 5,21"/>
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
                    <div class="db-conditions-label">Current</div>
                    <div class="db-conditions-main">
                        <div class="db-weather-icon" id="db-weather-icon">🌫️</div>
                        <div class="db-temp" id="db-temp">—°C</div>
                    </div>
                    <div class="db-weather-desc" id="db-weather-desc">Loading…</div>
                </div>

                <div class="db-conditions-divider"></div>

                <div class="db-forecast" id="db-forecast">
                    {{-- Populated by dashboard-init.js from Open-Meteo --}}
                </div>
            </div>

            {{-- ── TIER 2: Field Status — Vital Signs ── --}}
            <div>
                <div class="db-section-heading">Field Status</div>
                <div class="db-vitals" id="db-vitals-row">

                    {{-- Growth Potential --}}
                    <div class="db-vital-card" data-panel="growth-potential">
                        <div class="db-vital-label">
                            Growth Potential
                            <span class="db-info-icon" data-info="growth-potential" tabindex="0" role="button" aria-label="About Growth Potential">i</span>
                        </div>
                        <div class="db-vital-main" id="db-gp-value">—</div>
                        <div class="db-vital-sub" id="db-gp-forecast"></div>
                        <div class="db-progress-bar" style="margin:6px 0 4px">
                            <div class="db-progress-fill" id="db-gp-bar" style="width:0%;background:#16a34a"></div>
                        </div>
                        <div class="db-vital-footer" id="db-gp-footer"></div>
                    </div>

                    {{-- Disease Risk --}}
                    <div class="db-vital-card" data-panel="disease-risk">
                        <div class="db-vital-label">
                            Disease Risk
                            <span class="db-info-icon" data-info="disease-risk" tabindex="0" role="button" aria-label="About Disease Risk">i</span>
                        </div>
                        <div class="db-disease-main-row">
                            <div class="db-vital-main" id="db-disease-value">—</div>
                            <span class="db-disease-fc-label" id="db-disease-fc-label" style="display:none">Forecast Peak</span>
                        </div>
                        <div class="db-vital-sub" id="db-disease-today"></div>
                        <div class="db-progress-bar" style="margin:4px 0">
                            <div class="db-progress-fill" id="db-disease-bar" style="width:0%;background:#dc2626"></div>
                        </div>
                        <div class="db-vital-alert" id="db-disease-alert" style="display:none"></div>
                        <div class="db-disease-name-row" id="db-disease-name-row" style="display:none">
                            <span class="db-disease-name-dot" id="db-disease-name-dot">●</span>
                            <span id="db-disease-name"></span>
                        </div>
                    </div>

                    {{-- Stress Index --}}
                    <div class="db-vital-card" data-panel="stress-index">
                        <div class="db-vital-label">
                            Stress Index
                            <span class="db-info-icon" data-info="stress-index" tabindex="0" role="button" aria-label="About Stress Index">i</span>
                        </div>
                        <div class="db-vital-main" id="db-stress-value">—</div>
                        <div class="db-vital-sub" id="db-stress-driver"></div>
                        <div class="db-progress-bar">
                            <div class="db-progress-fill" id="db-stress-bar" style="width:0%;background:#d97706"></div>
                        </div>
                        <div class="db-vital-footer" id="db-stress-trend"></div>
                    </div>

                    {{-- Soil Moisture VWC --}}
                    <div class="db-vital-card" data-panel="vwc">
                        <div class="db-vital-label">
                            Soil Moisture (VWC)
                            <span class="db-info-icon" data-info="vwc" tabindex="0" role="button" aria-label="About Soil Moisture VWC">i</span>
                        </div>
                        <div class="db-vital-main" id="db-vwc-value">—</div>
                        {{-- Zone bar: red (dry) | green (target 12–15%) | red (wet) --}}
                        {{-- Scale: 0–40% VWC = 0–100% bar width; trigger@12%=30%, target hi@15%=37.5% --}}
                        <div class="db-vwc-bar" id="db-vwc-bar-wrap">
                            <div class="db-vwc-zone-low"  style="width:30%"></div>
                            <div class="db-vwc-zone-ok"   style="width:7.5%"></div>
                            <div class="db-vwc-zone-high"></div>
                            <div class="db-vwc-needle" id="db-vwc-fill" style="display:none"></div>
                        </div>
                        <div class="db-vital-sub" style="font-size:10px;color:var(--gaip-text-muted)">
                            Target: <strong style="color:var(--gaip-accent)">12–15%</strong>
                        </div>
                        <div class="db-vital-footer" id="db-vwc-msg"></div>
                    </div>

                    {{-- Irrigation Plan --}}
                    <div class="db-vital-card" data-panel="irrigation-plan">
                        <div class="db-vital-label">
                            Irrigation Plan
                            <span class="db-info-icon" data-info="irrigation-plan" tabindex="0" role="button" aria-label="About Irrigation Plan">i</span>
                        </div>
                        <div class="db-vital-main" id="db-irr-value">—</div>
                        <div class="db-vital-sub">Weekly requirement</div>
                        <div class="db-vital-footer" id="db-irr-forecast"></div>
                    </div>

                </div>{{-- /db-vitals --}}
            </div>

            {{-- ── TIER 1: Action Queue ── --}}
            <div class="db-action-queue" id="db-action-queue">
                <div class="db-aq-header">
                    <div class="db-aq-title" id="db-aq-headline">
                        <svg width="16" height="16" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2.5" style="color:var(--gaip-text-muted,#6b8878);flex-shrink:0">
                            <path stroke-linecap="round" stroke-linejoin="round" d="M8 6h13M8 12h13M8 18h13M3 6h.01M3 12h.01M3 18h.01"/>
                        </svg>
                        Act on this today
                    </div>
                    <div class="db-aq-meta" id="db-aq-resolved"></div>
                </div>
                <div id="db-aq-body" style="color:var(--gaip-text-muted);font-size:13px;padding:16px 0">
                    Run analysis in Hub to see action recommendations
                </div>
            </div>{{-- /db-action-queue --}}

            {{-- ── TIER 5: Data Sources ── --}}
            @php
                $soilAge   = $ageLabel($sampleDates['soil']   ?? null);
                $soilCls   = $ageClass($sampleDates['soil']   ?? null);
                $tissueAge = $ageLabel($sampleDates['tissue'] ?? null);
                $tissueCls = $ageClass($sampleDates['tissue'] ?? null);
                $waterAge  = $ageLabel($sampleDates['water']  ?? null);
                $waterCls  = $ageClass($sampleDates['water']  ?? null);
                $sprayAge  = $ageLabel($lastSprayDate ?? null);
                $sprayCls  = $ageClass($lastSprayDate ?? null);

                $noData     = !$sampleDates['soil'] && !$sampleDates['tissue']
                           && !$sampleDates['water'] && !$lastSprayDate;

                $labIssues  = ($soilCls   === 'warning' ? 1 : 0)
                            + ($tissueCls === 'warning' ? 1 : 0)
                            + ($waterCls  === 'warning' ? 1 : 0)
                            + ($sprayCls  === 'warning' ? 1 : 0);
                $okSources  = 6 - $labIssues;
                $progressPct = (int) round($okSources / 6 * 100);
            @endphp
            <div class="db-sources" id="db-data-sources">
                <div class="db-sources-header">
                    <div class="db-sources-title">Data Sources</div>
                    @if($labIssues > 0)
                    <span class="db-sources-issue-badge" id="db-sources-badge">{{ $labIssues }} {{ $labIssues === 1 ? 'issue' : 'issues' }}</span>
                    @else
                    <span class="db-sources-issue-badge" id="db-sources-badge" style="display:none">0 issues</span>
                    @endif
                </div>

                @if($noData)
                {{-- Empty state: no lab data imported yet --}}
                <div class="db-sources-empty">
                    <div class="db-sources-empty-icon">
                        <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/><line x1="12" y1="18" x2="12" y2="12"/><line x1="9" y1="15" x2="15" y2="15"/></svg>
                    </div>
                    <div class="db-sources-empty-msg">No lab data imported yet</div>
                    <div class="db-sources-empty-sub">Import a soil, tissue, or water test to enable analysis</div>
                    <a href="{{ route('hub') }}" class="db-sources-import-btn">Import Data →</a>
                </div>
                @else
                <div class="db-sources-grid" id="db-sources-grid">
                    {{-- Row 1: Weather · Soil Test · Tissue Test --}}
                    <div class="db-source-row" data-source="weather">
                        <span class="db-source-dot ok"></span>
                        <div class="db-source-label">
                            <span class="db-source-name">Weather</span>
                            <span class="db-source-sub">Open-Meteo</span>
                        </div>
                        <span class="db-source-status-text ok">Live</span>
                    </div>

                    <div class="db-source-row" data-source="soil">
                        <span class="db-source-dot {{ $soilCls }}"></span>
                        <div class="db-source-label">
                            <span class="db-source-name">Soil Test</span>
                            @if($sampleDates['soil'])<span class="db-source-sub">{{ $sampleDates['soil'] }}</span>@endif
                        </div>
                        <span class="db-source-status-text {{ $soilCls }}">{{ $soilAge }}</span>
                        @if($soilCls === 'warning')<a class="db-source-action" href="{{ route('hub') }}">Import</a>@endif
                    </div>

                    <div class="db-source-row" data-source="tissue">
                        <span class="db-source-dot {{ $tissueCls }}"></span>
                        <div class="db-source-label">
                            <span class="db-source-name">Tissue Test</span>
                            @if($sampleDates['tissue'])<span class="db-source-sub">{{ $sampleDates['tissue'] }}</span>@endif
                        </div>
                        <span class="db-source-status-text {{ $tissueCls }}">{{ $tissueAge }}</span>
                        @if($tissueCls === 'warning')<a class="db-source-action" href="{{ route('hub') }}">Import</a>@endif
                    </div>

                    {{-- Row 2: Sensors · Water Test · Spray Log --}}
                    <div class="db-source-row" data-source="sensors">
                        <span class="db-source-dot ok"></span>
                        <div class="db-source-label">
                            <span class="db-source-name">Sensors</span>
                            <span class="db-source-sub" id="db-sensor-provider">Hydrosight</span>
                        </div>
                        <span class="db-source-status-text ok" id="db-sensor-status">—</span>
                    </div>

                    <div class="db-source-row" data-source="water">
                        <span class="db-source-dot {{ $waterCls }}"></span>
                        <div class="db-source-label">
                            <span class="db-source-name">Water Test</span>
                            @if($sampleDates['water'])<span class="db-source-sub">{{ $sampleDates['water'] }}</span>@endif
                        </div>
                        <span class="db-source-status-text {{ $waterCls }}">{{ $waterAge }}</span>
                        @if($waterCls === 'warning')<a class="db-source-action" href="{{ route('hub') }}">Import</a>@endif
                    </div>

                    <div class="db-source-row" data-source="spray">
                        <span class="db-source-dot {{ $sprayCls }}"></span>
                        <div class="db-source-label">
                            <span class="db-source-name">Spray Log</span>
                            @if($lastSprayDate)<span class="db-source-sub">{{ $lastSprayDate }}</span>@endif
                        </div>
                        <span class="db-source-status-text {{ $sprayCls }}">{{ $sprayAge }}</span>
                    </div>
                </div>

                <div class="db-sources-footer">
                    <span class="db-sources-summary">
                        <span class="db-src-ok-dot">●</span>
                        <span id="db-sources-ok-count">{{ $okSources }}</span> sources current
                        <span id="db-sources-issues-part"@if($labIssues === 0) style="display:none"@endif>
                            · <span class="db-src-warn-dot">●</span>
                            <span id="db-sources-issue-count" class="db-src-warn-text">{{ $labIssues }} needs update</span>
                        </span>
                    </span>
                    <div class="db-sources-progress">
                        <div class="db-sources-progress-bar">
                            <div class="db-sources-progress-fill" id="db-sources-progress-fill" style="width:{{ $progressPct }}%"></div>
                        </div>
                        <span id="db-sources-score">{{ $okSources }}/6 sources</span>
                    </div>
                </div>
                @endif
            </div>

        </div>{{-- /db-body --}}
    </div>{{-- /db-main --}}
</div>{{-- /db-shell --}}

<script src="{{ $legacyAssetUrl('gilba-storage-ns.js') }}"></script>
<script src="{{ $legacyAssetUrl('dashboard-init.js') }}" defer></script>

<script>
(function () {
    var btn = document.getElementById('db-site-switcher-btn');
    var dropdown = document.getElementById('db-site-dropdown');
    if (!btn || !dropdown) return;

    btn.addEventListener('click', function (e) {
        e.stopPropagation();
        var open = !dropdown.hidden;
        dropdown.hidden = open;
        btn.setAttribute('aria-expanded', String(!open));
    });

    document.addEventListener('click', function () {
        dropdown.hidden = true;
        btn.setAttribute('aria-expanded', 'false');
    });

    dropdown.addEventListener('click', function (e) {
        e.stopPropagation();
        var target = e.target.closest('[data-site-id]');
        if (!target) return;

        var siteId = target.dataset.siteId;
        var csrfToken = document.querySelector('meta[name="csrf-token"]')?.content
            || (window.GAIP_HUB_CONFIG && window.GAIP_HUB_CONFIG.csrfToken)
            || '';

        target.disabled = true;
        target.textContent = '…';

        fetch('/api/active-site', {
            method: 'PATCH',
            headers: {
                'Content-Type': 'application/json',
                'X-CSRF-TOKEN': csrfToken,
                'Accept': 'application/json',
            },
            body: JSON.stringify({ site_id: siteId }),
        })
        .then(function (r) { return r.ok ? r.json() : Promise.reject(r.status); })
        .then(function () { window.location.reload(); })
        .catch(function () {
            target.disabled = false;
            target.textContent = target.dataset.siteName || 'Error';
        });
    });

    // Store site names for error recovery
    dropdown.querySelectorAll('[data-site-id]').forEach(function (el) {
        el.dataset.siteName = el.textContent.trim();
    });
}());
</script>

{{-- Info popover — shown when db-info-icon is clicked --}}
<div id="db-info-popover" class="db-info-popover" style="display:none" role="tooltip" aria-live="polite">
    <div class="db-info-popover-arrow" id="db-info-popover-arrow"></div>
    <button class="db-info-popover-close" id="db-info-popover-close" aria-label="Close">×</button>
    <div class="db-info-popover-title" id="db-info-popover-title"></div>
    <div class="db-info-popover-body" id="db-info-popover-body" style="white-space:pre-line"></div>
</div>

{{-- Card side panel — slides in from right on vital card click --}}
<div id="db-panel-backdrop" class="db-panel-backdrop"></div>
<aside id="db-side-panel" class="db-side-panel" role="dialog" aria-modal="true" aria-label="Detail panel">
    <div class="db-panel-header">
        <div class="db-panel-title" id="db-panel-title">Detail</div>
        <button class="db-panel-close" id="db-panel-close" aria-label="Close panel">×</button>
    </div>
    <div class="db-panel-body" id="db-panel-body"></div>
</aside>
</body>
</html>

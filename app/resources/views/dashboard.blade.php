@php
    $today = now()->toDateString();
    $ageLabel = function(?string $dateStr) use ($today): string {
        if (!$dateStr) return '—';
        $days = (int) now()->diffInDays($dateStr, false) * -1;
        if ($days <= 0)  return 'Today';
        if ($days === 1) return '1d ago';
        return $days . 'd ago';
    };
    $ageClass = function(?string $dateStr): string {
        if (!$dateStr) return 'warning'; // never tested counts as needing attention, same as stale data
        $days = (int) now()->diffInDays($dateStr, false) * -1;
        return $days > 30 ? 'warning' : 'ok';
    };
@endphp
@extends('layouts.db-shell', ['title' => 'Dashboard', 'currentPage' => 'dashboard'])

@section('head')
<script>
    Object.assign(window.GAIP_HUB_CONFIG, {
        savedLocation:       @json($savedLocation),
        turfSpecies:         @json($turfSpecies),
        turfMethodology:     @json($turfMethodology),
        wizardComplete:      @json(!is_null($turfSpecies)),
        gettingStartedSteps: @json($gettingStartedSteps),
        activeSiteRole:      @json($activeSiteRole),
        provisionalName:     @json($provisionalName),
    });
    window.GAIP_SiteContext = {
        getSiteId: function() {
            return (window.GAIP_HUB_CONFIG || {}).activeSiteId || null;
        }
    };
</script>
@endsection

@section('content')

        {{-- Password Setup Banner — shown when password_prompt_shown = false --}}
        @if(!auth()->user()->password_prompt_shown)
        <div id="db-password-banner" style="display:flex;align-items:center;gap:12px;padding:12px 20px;background:#1a2b23;color:rgba(255,255,255,0.9);font-size:13px;font-family:'Barlow',-apple-system,sans-serif">
            <svg width="15" height="15" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2.5" style="flex-shrink:0;color:#2da85e">
                <path stroke-linecap="round" stroke-linejoin="round" d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z"/>
            </svg>
            <span style="flex:1">Want faster sign-in? Set up a password — or keep using Magic Link every time.</span>
            <button id="db-pw-banner-set" type="button" style="flex-shrink:0;padding:6px 14px;background:#2da85e;color:#fff;border:0;border-radius:6px;font:inherit;font-size:13px;font-weight:600;cursor:pointer">Set password</button>
            <button id="db-pw-banner-dismiss" type="button" style="flex-shrink:0;padding:6px 12px;background:rgba(255,255,255,0.1);color:rgba(255,255,255,0.75);border:1px solid rgba(255,255,255,0.2);border-radius:6px;font:inherit;font-size:13px;cursor:pointer">Not now</button>
            <button id="db-pw-banner-close" type="button" aria-label="Close" style="flex-shrink:0;background:none;border:none;cursor:pointer;color:rgba(255,255,255,0.4);padding:4px;line-height:1">
                <svg width="16" height="16" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2.5"><path stroke-linecap="round" stroke-linejoin="round" d="M6 18L18 6M6 6l12 12"/></svg>
            </button>
        </div>
        @endif

        {{-- Site setup banner — shown for sites that have not been configured yet --}}
        @if(!$turfSpecies)
        <div id="db-setup-banner" style="display:flex;align-items:center;gap:12px;padding:12px 20px;background:#1a2b23;color:rgba(255,255,255,0.9);font-size:13px;font-family:inherit">
            <svg width="16" height="16" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2.5" style="flex-shrink:0;color:#2da85e">
                <path stroke-linecap="round" stroke-linejoin="round" d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"/>
            </svg>
            <span style="flex:1">This site hasn't been set up yet. Configure turf type, species and location to run your first analysis.</span>
            <button id="db-setup-btn" type="button"
                    style="flex-shrink:0;padding:7px 14px;background:#2da85e;color:#fff;border:0;border-radius:6px;font:inherit;font-size:13px;font-weight:600;cursor:pointer">
                Set up this site
            </button>
        </div>
        @endif

        {{-- VERDICT BAR (Tier 0) --}}
        <div class="db-verdict critical" id="db-verdict-bar" style="display:none">
            <svg width="16" height="16" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2.5" style="flex-shrink:0">
                <path stroke-linecap="round" stroke-linejoin="round" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"/>
            </svg>
            <span id="db-verdict-text"></span>
        </div>

        {{-- Shown by JS when weather failed AND no manual data → GP could not be calculated --}}
        <div id="db-analysis-error" style="display:none;align-items:center;gap:10px;padding:10px 20px;background:#fef2f2;border-bottom:1px solid #fecaca;font-size:13px;color:#991b1b;font-family:inherit">
            <svg width="15" height="15" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2.5" style="flex-shrink:0;color:#dc2626">
                <path stroke-linecap="round" stroke-linejoin="round" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"/>
            </svg>
            <span><strong>Weather unavailable</strong> — Growth Potential could not be calculated. Click <strong>Re-run</strong> to try again, or add manual weather data in <a href="{{ route('settings') }}" style="color:#991b1b;font-weight:600">Settings → Site settings</a>.</span>
        </div>

        {{-- Shown by JS when weather failed BUT GP was calculated from manual settings override --}}
        <div id="db-analysis-manual" style="display:none;align-items:center;gap:10px;padding:10px 20px;background:#fffbeb;border-bottom:1px solid #fde68a;font-size:13px;color:#92400e;font-family:inherit">
            <svg width="15" height="15" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2" style="flex-shrink:0;color:#d97706">
                <path stroke-linecap="round" stroke-linejoin="round" d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"/>
            </svg>
            <span><strong>Live weather unavailable</strong> — Growth Potential calculated from manual weather data in <a href="{{ route('settings') }}" style="color:#92400e;font-weight:600">Settings</a>. Update manually or try Re-run when live weather is restored.</span>
        </div>

        {{-- PAGE BODY --}}
        <div class="db-body">

            {{-- ── TIER 4: Conditions strip ── --}}
            <div class="db-conditions" id="db-conditions-strip">
                <div class="db-conditions-current">
                    <div class="db-conditions-label">Current</div>
                    <div class="db-conditions-main">
                        <div class="db-weather-icon" id="db-weather-icon"></div>
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
                        <div class="db-vital-sub" id="db-gp-forecast" style="font-size:10px;color:var(--gaip-text-muted,#6b8878);margin-top:1px">today</div>
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
                        <div class="db-vital-main" id="db-disease-value">—</div>
                        <div class="db-vital-sub" id="db-disease-today"></div>
                        <div class="db-progress-bar" style="margin:4px 0">
                            <div class="db-progress-fill" id="db-disease-bar" style="width:0%;background:#16a34a"></div>
                        </div>
                        <div class="db-disease-name-row" id="db-disease-name-row" style="display:none">
                            <span class="db-disease-name-dot" id="db-disease-name-dot">●</span>
                            <span id="db-disease-name"></span>
                        </div>
                        <div class="db-vital-alert" id="db-disease-alert" style="display:none"></div>
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
                        <div class="db-vwc-bar" id="db-vwc-bar-wrap">
                            <div class="db-vwc-zone-low"  style="width:37.5%"></div>
                            <div class="db-vwc-zone-ok"   style="width:25%"></div>
                            <div class="db-vwc-zone-high"></div>
                            <div class="db-vwc-needle" id="db-vwc-fill" style="display:none"></div>
                        </div>
                        <div class="db-vital-sub" style="font-size:10px;color:var(--gaip-text-muted)">
                            Target: <strong style="color:var(--gaip-accent)">15–25%</strong>
                        </div>
                        <div class="db-vital-footer" id="db-vwc-msg" style="display:none"></div>
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
                <div id="db-aq-body" style="color:var(--gaip-text-muted);font-size:13px;padding:16px 0;text-align:center">
                    Run analysis to see action recommendations
                </div>
            </div>

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

                $noData    = !$sampleDates['soil'] && !$sampleDates['tissue']
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
                <div class="db-sources-empty">
                    <div class="db-sources-empty-icon">
                        <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/><line x1="12" y1="18" x2="12" y2="12"/><line x1="9" y1="15" x2="15" y2="15"/></svg>
                    </div>
                    <div class="db-sources-empty-msg">No lab data imported yet</div>
                    <div class="db-sources-empty-sub">Import a soil, tissue, or water test to enable analysis</div>
                    <a href="{{ route('data.section', 'soil') }}" class="db-sources-import-btn">Import Data →</a>
                </div>
                @else
                <div class="db-sources-grid" id="db-sources-grid">
                    <div class="db-source-row" data-source="weather">
                        <span class="db-source-dot ok" id="db-src-weather-dot"></span>
                        <div class="db-source-label">
                            <span class="db-source-name">Weather</span>
                            <span class="db-source-sub">Open-Meteo</span>
                        </div>
                        <span class="db-source-status-text ok" id="db-src-weather-status">Live</span>
                    </div>

                    <div class="db-source-row" data-source="soil">
                        <span class="db-source-dot {{ $soilCls }}"></span>
                        <div class="db-source-label">
                            <span class="db-source-name">Soil Test</span>
                            @if($sampleDates['soil'])<span class="db-source-sub">{{ $sampleDates['soil'] }}</span>@endif
                        </div>
                        <span class="db-source-status-text {{ $soilCls }}">{{ $soilAge }}</span>
                        @if($soilCls === 'warning')<a class="db-source-action" href="{{ route('data.section', 'soil') }}">Import</a>@endif
                    </div>

                    <div class="db-source-row" data-source="tissue">
                        <span class="db-source-dot {{ $tissueCls }}"></span>
                        <div class="db-source-label">
                            <span class="db-source-name">Tissue Test</span>
                            @if($sampleDates['tissue'])<span class="db-source-sub">{{ $sampleDates['tissue'] }}</span>@endif
                        </div>
                        <span class="db-source-status-text {{ $tissueCls }}">{{ $tissueAge }}</span>
                        @if($tissueCls === 'warning')<a class="db-source-action" href="{{ route('data.section', 'tissue') }}">Import</a>@endif
                    </div>

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
                        @if($waterCls === 'warning')<a class="db-source-action" href="{{ route('data.section', 'water') }}">Import</a>@endif
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

@endsection

@section('overlays')
<div id="db-info-popover" class="db-info-popover" style="display:none" role="tooltip" aria-live="polite">
    <div class="db-info-popover-arrow" id="db-info-popover-arrow"></div>
    <button class="db-info-popover-close" id="db-info-popover-close" aria-label="Close">×</button>
    <div class="db-info-popover-title" id="db-info-popover-title"></div>
    <div class="db-info-popover-body" id="db-info-popover-body" style="white-space:pre-line"></div>
</div>

<div id="db-panel-backdrop" class="db-panel-backdrop"></div>
<aside id="db-side-panel" class="db-side-panel" role="dialog" aria-modal="true" aria-label="Detail panel">
    <div class="db-panel-header">
        <div class="db-panel-title" id="db-panel-title">Detail</div>
        <button class="db-panel-close" id="db-panel-close" aria-label="Close panel">×</button>
    </div>
    <div class="db-panel-body" id="db-panel-body"></div>
</aside>

{{-- Getting Started floating panel --}}
<div id="db-gs-panel" class="db-gs-panel" style="display:none" aria-label="Getting Started">
    <div class="db-gs-header">
        <span class="db-gs-title">Getting Started</span>
        <div class="db-gs-header-actions">
            <button id="db-gs-skip-all" type="button" class="db-gs-skip">Skip All</button>
            <button id="db-gs-close" type="button" class="db-gs-close" title="Close">
                <svg width="14" height="14" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2.5"><path stroke-linecap="round" stroke-linejoin="round" d="M6 18L18 6M6 6l12 12"/></svg>
            </button>
        </div>
    </div>
    <div class="db-gs-progress-row">
        <div class="db-gs-progress-bar"><div class="db-gs-progress-fill" id="db-gs-fill"></div></div>
        <span class="db-gs-progress-label" id="db-gs-label">0 of 5 done</span>
    </div>
    <ul class="db-gs-list" id="db-gs-list">
        <li class="db-gs-item" data-key="setup">
            <span class="db-gs-check" aria-hidden="true"></span>
            <button type="button" class="db-gs-link" id="db-gs-setup" data-key="setup">Set up site</button>
        </li>
        <li class="db-gs-item" data-key="soil">
            <span class="db-gs-check" aria-hidden="true"></span>
            <a href="{{ route('data.section', 'soil') }}" class="db-gs-link" data-key="soil">Add your soil test</a>
        </li>
        <li class="db-gs-item" data-key="water">
            <span class="db-gs-check" aria-hidden="true"></span>
            <a href="{{ route('data.section', 'water') }}" class="db-gs-link" data-key="water">Add your water test</a>
        </li>
        <li class="db-gs-item" data-key="tissue">
            <span class="db-gs-check" aria-hidden="true"></span>
            <a href="{{ route('data.section', 'tissue') }}" class="db-gs-link" data-key="tissue">Add your tissue test</a>
        </li>
        <li class="db-gs-item" data-key="sensors">
            <span class="db-gs-check" aria-hidden="true"></span>
            <a href="{{ route('data.section', 'sensors') }}" class="db-gs-link" data-key="sensors">Add sensor data</a>
        </li>
        <li class="db-gs-item" data-key="analysis">
            <span class="db-gs-check" aria-hidden="true"></span>
            <button type="button" class="db-gs-link" id="db-gs-run" data-key="analysis">Run your first analysis</button>
        </li>
    </ul>
</div>
@endsection

@section('scripts')
<script src="{{ $legacyAssetUrl('gilba-storage-ns.js') }}"></script>
<script src="{{ $legacyAssetUrl('spray-log.js') }}" defer></script>
<script src="{{ $legacyAssetUrl('uv-residual-engine.js') }}" defer></script>
<script src="{{ $legacyAssetUrl('spray-log-cascade.js') }}" defer></script>
{{-- Variety traits must load before dashboard-init so getDiseaseModifier/getWearModifier are available --}}
<script src="{{ $legacyAssetUrl('gilba-variety-traits.js') }}"></script>
<script src="{{ $legacyAssetUrl('uk-variety-traits.js') }}"></script>
<script src="{{ $legacyAssetUrl('scanturf-variety-traits.js') }}"></script>
<script src="{{ $legacyAssetUrl('geves-variety-traits.js') }}"></script>
<script src="{{ $legacyAssetUrl('bsa-variety-traits.js') }}"></script>
<script src="{{ $legacyAssetUrl('japan-variety-traits.js') }}"></script>
<script src="{{ $legacyAssetUrl('scandinavia-variety-traits.js') }}"></script>
<script src="{{ $legacyAssetUrl('au-variety-traits.js') }}"></script>
<script src="{{ $legacyAssetUrl('nz-variety-traits.js') }}"></script>
<script src="{{ $legacyAssetUrl('variety-traits-integration.js') }}"></script>
<script src="{{ $legacyAssetUrl('dashboard-init.js') }}" defer></script>
<script src="{{ $legacyAssetUrl('onboarding-wizard.js') }}" defer></script>
<script>
(function () {
    var banner = document.getElementById('db-password-banner');
    if (!banner) return;

    var apiBase = (window.GAIP_HUB_CONFIG || {}).apiBase || '/api';
    var csrf = document.querySelector('meta[name="csrf-token"]')?.content || @json(csrf_token());

    function dismissBanner(andNavigate) {
        fetch(apiBase + '/profile/password-prompt', {
            method: 'PATCH',
            headers: { 'X-CSRF-TOKEN': csrf, 'X-Requested-With': 'XMLHttpRequest' }
        });
        banner.remove();
        if (andNavigate) {
            window.location.href = '/settings#profile';
        }
    }

    document.getElementById('db-pw-banner-set').addEventListener('click', function () {
        dismissBanner(true);
    });
    document.getElementById('db-pw-banner-dismiss').addEventListener('click', function () {
        dismissBanner(false);
    });
    document.getElementById('db-pw-banner-close').addEventListener('click', function () {
        dismissBanner(false);
    });
}());
</script>
@endsection

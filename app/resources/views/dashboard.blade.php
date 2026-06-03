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
        if (!$dateStr) return 'warning';
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
        wizardComplete:      @json(!is_null($turfSpecies)),
        gettingStartedSteps: @json($gettingStartedSteps),
    });
</script>
@endsection

@section('content')

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
<script src="{{ $legacyAssetUrl('dashboard-init.js') }}" defer></script>
<script src="{{ $legacyAssetUrl('onboarding-wizard.js') }}" defer></script>
@endsection

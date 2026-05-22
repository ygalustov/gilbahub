@extends('layouts.db-shell', ['title' => 'Accuracy', 'currentPage' => 'reports'])

@section('head')
<script>
    {{-- Add savedLocation to GAIP_HUB_CONFIG so benchmark-chart.js can compute the site identifier --}}
    window.GAIP_HUB_CONFIG.savedLocation = @json($savedLocation);

    {{-- Benchmark chart config (auto-init by benchmark-chart.js) --}}
    window.GAIP_BenchmarkConfig = {
        'rp-benchmark': {
            rootId:  'rp-benchmark',
            title:   'Forecast Accuracy',
            module:  'all',
            limit:   200,
            days:    90,
        }
    };
</script>
@endsection

@section('styles')
<style>
.rp-page { padding: 0; display: flex; flex-direction: column; flex: 1; min-height: 0; overflow-y: auto; }
.rp-content { padding: 24px 28px; max-width: 900px; }
.rp-section { background: var(--gaip-surface); border: 1px solid var(--gaip-border); border-radius: 10px; padding: 20px 22px; margin-bottom: 16px; }
.rp-section-title { font-size: 11px; font-weight: 700; letter-spacing: .06em; text-transform: uppercase; color: var(--gaip-text-secondary); margin: 0 0 14px; }
.rp-confidence-row { display: flex; align-items: center; gap: 10px; padding: 9px 0; border-bottom: 1px solid var(--gaip-border); }
.rp-confidence-row:last-child { border-bottom: none; }
.rp-engine-name { font-size: 13px; font-weight: 600; color: var(--gaip-text); min-width: 150px; }
.rp-conf-badge { font-size: 11px; font-weight: 700; padding: 2px 8px; border-radius: 4px; }
.rp-conf-high { background: var(--gaip-good-bg); color: #065f46; border: 1px solid #10b981; }
.rp-conf-medium { background: var(--gaip-warning-bg); color: #92400e; border: 1px solid #f59e0b; }
.rp-conf-low { background: var(--gaip-critical-bg); color: #991b1b; border: 1px solid #ef4444; }
.rp-conf-reason { font-size: 12px; color: var(--gaip-text-secondary); margin-left: auto; text-align: right; max-width: 300px; }
.rp-improve-hint { font-size: 12px; color: var(--gaip-text-secondary); margin-top: 12px; padding-top: 12px; border-top: 1px solid var(--gaip-border); line-height: 1.6; }
.rp-improve-hint a { color: var(--gaip-accent); }
</style>
@endsection

@section('content')
<div class="rp-page">
    @include('reports._subnav')

    <div class="rp-content">

        {{-- Page header --}}
        <div style="margin-bottom:22px">
            <div style="font-size:20px;font-weight:700;color:var(--gaip-text);margin-bottom:4px">Forecast Accuracy</div>
            <div style="font-size:13px;color:var(--gaip-text-secondary)">
                {{ $activeSite?->name ?? 'No site selected' }}
                @if($turfSpecies) · {{ $turfSpecies }} @endif
                @if($turfMethodology) · {{ $turfMethodology }} @endif
                @if($analysisCache && !empty($analysisCache['analyzedAt']))
                    · Last analysis: {{ \Carbon\Carbon::parse($analysisCache['analyzedAt'])->diffForHumans() }}
                @endif
            </div>
        </div>

        {{-- ─── Engine Confidence Scores ─── --}}
        <div class="rp-section">
            <div class="rp-section-title">Data Confidence</div>
            <div id="rp-confidence-content">
                @if($analysisCache && !empty($analysisCache['metrics']))
                    @php
                        $metrics = $analysisCache['metrics'];
                        $engines = [
                            'Disease Risk'     => ['key' => 'disease',    'icon' => '🦠'],
                            'Growth Potential' => ['key' => 'growth',     'icon' => '🌱'],
                            'Stress Index'     => ['key' => 'stress',     'icon' => '🌡️'],
                            'Irrigation / VWC' => ['key' => 'irrigation', 'icon' => '💧'],
                            'Soil Nutrition'   => ['key' => 'soil',       'icon' => '🧪'],
                            'PGR'              => ['key' => 'pgr',        'icon' => '📐'],
                            'Water Quality'    => ['key' => 'water',      'icon' => '🌊'],
                            'Pre-emergent'     => ['key' => 'preemergent','icon' => '🌿'],
                        ];
                        $hasAny = false;
                        foreach ($engines as $label => $cfg) {
                            $conf = $metrics[$cfg['key']]['_meta']['confidence'] ??
                                    $metrics[$cfg['key']]['confidence'] ?? null;
                            if ($conf !== null) { $hasAny = true; break; }
                        }
                    @endphp
                    @if($hasAny)
                        @foreach($engines as $label => $cfg)
                            @php
                                $conf = $metrics[$cfg['key']]['_meta']['confidence'] ??
                                        $metrics[$cfg['key']]['confidence'] ?? null;
                                $level = is_array($conf) ? ($conf['level'] ?? null) : ($conf ?? null);
                                $reason = is_array($conf) ? ($conf['reason'] ?? '') : '';
                                $badgeClass = match(strtolower($level ?? '')) {
                                    'high'   => 'rp-conf-high',
                                    'medium' => 'rp-conf-medium',
                                    'low'    => 'rp-conf-low',
                                    default  => 'rp-conf-medium',
                                };
                            @endphp
                            @if($level)
                            <div class="rp-confidence-row">
                                <span style="font-size:16px;width:22px;flex-shrink:0">{{ $cfg['icon'] }}</span>
                                <span class="rp-engine-name">{{ $label }}</span>
                                <span class="rp-conf-badge {{ $badgeClass }}">{{ ucfirst($level) }}</span>
                                @if($reason)
                                    <span class="rp-conf-reason">{{ $reason }}</span>
                                @endif
                            </div>
                            @endif
                        @endforeach
                        <div class="rp-improve-hint">
                            To improve confidence: keep soil tests &lt; 60 days old (<a href="{{ route('data.section', 'soil') }}">Soil Tests</a>)
                            and ensure sensor data is current (<a href="{{ route('data.section', 'sensors') }}">Sensors</a>).
                        </div>
                    @else
                        <div style="font-size:13px;color:var(--gaip-text-secondary);padding:8px 0">
                            Confidence scores will appear here after an analysis run.
                        </div>
                    @endif
                @else
                    <div style="font-size:13px;color:var(--gaip-text-secondary);padding:8px 0">
                        No analysis cache found. Run an analysis to see confidence scores.
                    </div>
                @endif
            </div>
        </div>

        {{-- ─── Pending Outcomes ─── --}}
        <div class="rp-section">
            <div class="rp-section-title">Pending Outcomes</div>
            <div style="font-size:12px;color:var(--gaip-text-secondary);margin-bottom:14px;line-height:1.6">
                Predictions awaiting outcome confirmation. Confirming outcomes improves model accuracy over time.
            </div>
            {{-- outcome-capture-ui.js looks for #gaip-daily-dashboard and inserts before it --}}
            <div id="rp-outcome-wrapper">
                <div id="gaip-daily-dashboard" style="display:none"></div>
            </div>
        </div>

        {{-- ─── Accuracy History (Benchmark Chart) ─── --}}
        <div class="rp-section">
            <div class="rp-section-title">Accuracy History</div>
            <div style="font-size:12px;color:var(--gaip-text-secondary);margin-bottom:14px;line-height:1.6">
                Predicted vs. actual outcomes over the last 90 days. Requires ≥ 3 months of confirmed predictions to be meaningful.
            </div>
            {{-- benchmark-chart.js reads window.GAIP_BenchmarkConfig and renders here --}}
            <div id="rp-benchmark"></div>
        </div>

    </div>
</div>
@endsection

@section('scripts')
<link rel="stylesheet" href="{{ $legacyAssetUrl('benchmark-chart.css') }}">
<script src="https://cdn.jsdelivr.net/npm/chart.js@4/dist/chart.umd.min.js"></script>
<script src="https://cdn.jsdelivr.net/npm/chartjs-adapter-date-fns@3/dist/chartjs-adapter-date-fns.bundle.min.js"></script>
<script src="{{ $legacyAssetUrl('outcome-capture-ui.js') }}" defer></script>
<script src="{{ $legacyAssetUrl('benchmark-chart.js') }}" defer></script>
@endsection

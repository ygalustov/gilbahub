@php
    $isStadium = $activeSite && str_contains(strtolower($activeSite->name ?? ''), 'stadium');
    $multiSite = $allSites->count() > 1;
    $hasAnalysis = !empty($analysisCache);
@endphp
@extends('layouts.db-shell', ['title' => 'Export', 'currentPage' => 'reports'])

@section('head')
<script>
    // GH-357: pass through the site's real soil texture, same as plan.blade.php
    // (GH-294) already does. word-export.js's _aaRanges IIFE (GH-352/353/355)
    // falls back to window.GAIP_HUB_CONFIG.soilTexture when nothing else
    // resolved it -- that fallback was correct in principle, this page just
    // never populated the field it reads.
    Object.assign(window.GAIP_HUB_CONFIG, {
        soilTexture: @json($soilTexture ?? null),
    });
</script>
@endsection

@section('styles')
<link rel="stylesheet" href="{{ $legacyAssetUrl('bulk-area-modal.css') }}">
<style>
.rp-page { padding: 0; display: flex; flex-direction: column; flex: 1; min-height: 0; overflow-y: auto; }
.rp-content { padding: 24px 28px; max-width: 860px; }
.rp-section-title { font-size: 11px; font-weight: 700; letter-spacing: .06em; text-transform: uppercase; color: var(--gaip-text-secondary); margin: 0 0 14px; }
.rp-card { background: var(--gaip-surface); border: 1px solid var(--gaip-border); border-radius: 10px; padding: 20px 22px; margin-bottom: 14px; }
.rp-card-header { display: flex; align-items: flex-start; gap: 14px; margin-bottom: 12px; }
.rp-card-icon { width: 36px; height: 36px; border-radius: 8px; background: var(--gaip-surface-muted); display: flex; align-items: center; justify-content: center; flex-shrink: 0; color: var(--gaip-text-secondary); }
.rp-card-title { font-size: 14px; font-weight: 700; color: var(--gaip-text); line-height: 1.3; }
.rp-card-subtitle { font-size: 12px; color: var(--gaip-text-secondary); margin-top: 2px; }
.rp-card-body { font-size: 13px; color: var(--gaip-text-secondary); line-height: 1.6; margin-bottom: 14px; }
.rp-card-sections { display: flex; flex-wrap: wrap; gap: 6px; margin-bottom: 14px; }
.rp-tag { font-size: 11px; padding: 3px 8px; border-radius: 4px; background: var(--gaip-surface-muted); color: var(--gaip-text-secondary); border: 1px solid var(--gaip-border); }
.rp-btn { display: inline-flex; align-items: center; gap: 7px; padding: 9px 16px; border-radius: 7px; border: none; cursor: pointer; font-size: 13px; font-weight: 600; transition: opacity .15s; }
.rp-btn:disabled { opacity: .45; cursor: not-allowed; }
.rp-btn-primary { background: var(--gaip-accent); color: #fff; }
.rp-btn-secondary { background: var(--gaip-surface-muted); color: var(--gaip-text); border: 1px solid var(--gaip-border); }
.rp-btn-primary:hover:not(:disabled) { opacity: .88; }
.rp-btn-secondary:hover:not(:disabled) { background: var(--gaip-surface-hover); }
.rp-notice { display: flex; align-items: flex-start; gap: 10px; padding: 11px 14px; border-radius: 8px; background: var(--gaip-warning-bg,#fff8e7); border: 1px solid var(--gaip-warning-border,#f5c842); font-size: 12px; color: var(--gaip-text-secondary); margin-bottom: 16px; }
.rp-branding-toggle { font-size: 12px; color: var(--gaip-accent); cursor: pointer; text-decoration: none; display: inline-flex; align-items: center; gap: 4px; margin-bottom: 12px; background: none; border: none; padding: 0; font-family: inherit; }
.rp-branding-panel { display: none; padding: 14px; background: var(--gaip-surface-muted); border-radius: 8px; margin-bottom: 12px; }
.rp-branding-panel.open { display: block; }
.rp-branding-row { display: flex; align-items: center; gap: 10px; margin-bottom: 10px; flex-wrap: wrap; }
.rp-branding-label { font-size: 12px; font-weight: 600; color: var(--gaip-text-secondary); min-width: 90px; }
.rp-input { padding: 7px 10px; border: 1px solid var(--gaip-border); border-radius: 6px; font-size: 13px; background: var(--gaip-surface); color: var(--gaip-text); min-width: 180px; }
.rp-select { padding: 6px 10px; border: 1px solid var(--gaip-border); border-radius: 6px; font-size: 12px; background: var(--gaip-surface); color: var(--gaip-text); }
.rp-logo-status { font-size: 11px; color: var(--gaip-text-secondary); }
/* hidden hub runs analysis silently */
#rp-hub-runner { display: none !important; position: absolute; left: -9999px; width: 1px; height: 1px; overflow: hidden; pointer-events: none; }
@keyframes rp-spin { to { transform: rotate(360deg); } }
@include('reports._hub-suppress')
</style>
@endsection

@section('content')
<div class="rp-page">
    @include('reports._subnav')

    <div class="rp-content">

        {{-- Page header --}}
        <div style="margin-bottom:22px">
            <div style="font-size:20px;font-weight:700;color:var(--gaip-text);margin-bottom:4px">Export Centre</div>
            <div style="font-size:13px;color:var(--gaip-text-secondary)">
                {{ $activeSite?->name ?? 'No site selected' }}
                @if($turfSpecies) · {{ $turfSpecies }} @endif
                @if($turfMethodology) · {{ $turfMethodology }} @endif
                @if($hasAnalysis && !empty($analysisCache['analyzedAt']))
                    · Analysis: {{ \Carbon\Carbon::parse($analysisCache['analyzedAt'])->diffForHumans() }}
                @endif
            </div>
        </div>

        @if(!$hasAnalysis)
        <div class="rp-notice">
            <svg width="16" height="16" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2.5" style="flex-shrink:0;margin-top:1px">
                <path stroke-linecap="round" stroke-linejoin="round" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"/>
            </svg>
            <div>No analysis found for this site. Click <strong>Re-run</strong> in the top bar to generate one, then return here to export.</div>
        </div>
        @endif

        {{-- ─── BRANDING (shared across all Word exports) ─── --}}
        <button type="button" class="rp-branding-toggle" onclick="document.getElementById('rp-branding').classList.toggle('open');this.textContent=document.getElementById('rp-branding').classList.contains('open')?'▲ Hide branding settings':'▼ Branding settings'">
            ▼ Branding settings
        </button>
        <div id="rp-branding" class="rp-branding-panel">
            <div class="rp-branding-row">
                <span class="rp-branding-label">Organisation</span>
                <input id="gaip-org-name" class="rp-input" type="text" placeholder="Your organisation name">
            </div>
            <div class="rp-branding-row">
                <span class="rp-branding-label">Logo</span>
                <select id="gaip-logo-select" class="rp-select">
                    <option value="">No logo</option>
                </select>
                <button id="gaip-logo-add-btn" type="button" class="rp-btn rp-btn-secondary" style="padding:6px 12px;font-size:12px">Upload</button>
                <button id="gaip-logo-delete-btn" type="button" class="rp-btn rp-btn-secondary" style="padding:6px 12px;font-size:12px">Delete</button>
                <input id="gaip-logo-upload" type="file" accept="image/png,image/jpeg,image/gif,image/webp" style="display:none">
                <span id="gaip-logo-status" class="rp-logo-status"></span>
            </div>
        </div>

        {{-- ─── 1. Full Analysis Report (Word) ─── --}}
        <div class="rp-card">
            <div class="rp-card-header">
                <div class="rp-card-icon">
                    <svg width="20" height="20" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
                        <path stroke-linecap="round" stroke-linejoin="round" d="M9 12h6m-6 4h4m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"/>
                    </svg>
                </div>
                <div>
                    <div class="rp-card-title">Full Analysis Report</div>
                    <div class="rp-card-subtitle">Word (.docx) — select samples to include, all modules</div>
                </div>
            </div>
            <div class="rp-card-sections">
                <span class="rp-tag">Soil & MLSN/SLAN/AA</span>
                <span class="rp-tag">Nutrient Trends</span>
                <span class="rp-tag">Annual Requirements</span>
                <span class="rp-tag">Nutrition Program</span>
                <span class="rp-tag">Disease Risk</span>
                <span class="rp-tag">Growth Potential</span>
                <span class="rp-tag">Water Quality</span>
                <span class="rp-tag">PGR &amp; Irrigation</span>
                <span class="rp-tag">Cultivar Profile</span>
                <span class="rp-tag">AI Interpretation</span>
                <span class="rp-tag">Forensic Record</span>
            </div>
            <button id="rp-export-word-btn" type="button" class="rp-btn rp-btn-primary" onclick="rpExportWordWithPicker()">
                <svg width="15" height="15" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2.5">
                    <path stroke-linecap="round" stroke-linejoin="round" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4"/>
                </svg>
                Generate &amp; Download Word
            </button>
        </div>

        {{-- ─── 3. Calendar Export (iCal) ─── --}}
        <div class="rp-card">
            <div class="rp-card-header">
                <div class="rp-card-icon">
                    <svg width="20" height="20" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
                        <rect x="3" y="4" width="18" height="18" rx="2"/>
                        <path stroke-linecap="round" stroke-linejoin="round" d="M16 2v4M8 2v4M3 10h18"/>
                        <path stroke-linecap="round" d="M8 14h.01M12 14h.01M16 14h.01M8 18h.01M12 18h.01"/>
                    </svg>
                </div>
                <div>
                    <div class="rp-card-title">Calendar Export</div>
                    <div class="rp-card-subtitle">iCal (.ics) — Apple Calendar, Google Calendar, Outlook</div>
                </div>
            </div>
            <div class="rp-card-sections">
                <span class="rp-tag">Spray log (last 90 days)</span>
                <span class="rp-tag">PGR reapplication reminder</span>
                <span class="rp-tag">Pre-emergent timing alerts</span>
            </div>
            <button id="gaip-export-ical" type="button" class="rp-btn rp-btn-primary"
                    onclick="if(window.GAIP_ICalExport){GAIP_ICalExport.export()}else{alert('Analysis not yet loaded — please wait a moment.')}">
                <svg width="15" height="15" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2.5">
                    <path stroke-linecap="round" stroke-linejoin="round" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4"/>
                </svg>
                Download .ics
            </button>
        </div>

        {{-- ─── 4. LED Lighting Report (Stadium only) ─── --}}
        @if($isStadium)
        <div class="rp-card">
            <div class="rp-card-header">
                <div class="rp-card-icon">
                    <svg width="20" height="20" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
                        <path stroke-linecap="round" stroke-linejoin="round" d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z"/>
                    </svg>
                </div>
                <div>
                    <div class="rp-card-title">LED Lighting Report</div>
                    <div class="rp-card-subtitle">Word (.docx) — rig placement &amp; seasonal plan for stadium sites</div>
                </div>
            </div>
            <div class="rp-card-sections">
                <span class="rp-tag">Venue &amp; Environment Summary</span>
                <span class="rp-tag">Rig Placement Results</span>
                <span class="rp-tag">Seasonal Operating Plan</span>
                <span class="rp-tag">Agronomic Context</span>
            </div>
            <button type="button" class="rp-btn rp-btn-primary"
                    onclick="if(window.GSSH_LEDExport){GSSH_LEDExport.export()}else{alert('Stadium analysis not yet loaded.')}">
                <svg width="15" height="15" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2.5">
                    <path stroke-linecap="round" stroke-linejoin="round" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4"/>
                </svg>
                Generate LED Report
            </button>
        </div>
        @endif

    </div>{{-- /.rp-content --}}
</div>{{-- /.rp-page --}}

{{-- Hidden hub runner: loads the full analysis engine stack so all export globals are populated --}}
<div id="rp-hub-runner">
    @include('partials.legacy-hub-markup', ['savedLocation' => $savedLocation])
</div>
@endsection

@section('overlays')
<div id="db-info-popover" class="db-info-popover" style="display:none">
    <div id="db-info-popover-arrow" class="db-info-popover-arrow"></div>
    <button id="db-info-popover-close" class="db-info-popover-close" type="button">&#215;</button>
    <div id="db-info-popover-title" class="db-info-popover-title"></div>
    <div id="db-info-popover-body" class="db-info-popover-body" style="white-space:pre-line"></div>
</div>
@endsection

@section('scripts')
{{-- Suppress automatic analysis_cache DB writes while the hidden hub runs for export.
     Only the topbar Re-run (iframe path) should update the main cache. --}}
<script>window.GILBA_REPORTS_EXPORT = true;</script>
@php
    $hubScripts = [
        'gilba-hub-v2.js','growth-potential-engine.js','nutrition-requirement-engine.js','climate-engine-v2.js',
        'climate-normals-service.js', // GH-245 (Hoxton audit D01-D03)
        'gaip-utils.js','species-controller.js','identity-enforcement.js','climate-engine.js',
        'weather-resilience.js','ambient-dli-engine.js','ambient-dli-integration.js',
        'gaip-soil-temp-integration.js','regional-profiles.js','gilba-variety-traits.js',
        'uk-variety-traits.js','scanturf-variety-traits.js','geves-variety-traits.js',
        'bsa-variety-traits.js','japan-variety-traits.js','scandinavia-variety-traits.js',
        'nz-fine-fescue-traits.js','gilba-storage-ns.js','gaip-site-context.js',
        'gilba-storage-migrate.js','location-preloader.js','turf-profile-controller.js',
        'nitrogen-validator.js','wear-recovery-engine-pure.js','wear-recovery-integration.js',
        'overseed-multiplier.js','overseed-climate-integration.js','shade-engine-pure.js',
        'shade-integration.js','dli-recovery-bridge.js','gaip-classification-constants.js',
        'hub-tissue-v3.js','tissue-engine.js','tissue-interpretation.js',
        'soil-tissue-integration.js','tissue-ui.js','mlsn-progressive-disclosure.js',
        'mulders-interaction-checker.js','hill-labs-sample-types.js',
        'ammonium-acetate-methodology.js','cotula-bowling-green.js',
        'nutrient-demand-engine.js','nutrition-summary-integration.js',
        'water-progressive-disclosure-WITH-SOIL-INTERACTION.js','salinity-penalty.js',
        'salinity-climate-integration.js','salinity-engine-pure.js',
        'recycled-water-nutrient-engine.js','phytotoxicity-engine.js',
        'water-blender.js','water-blender-ui.js','water-importer.js',
        'au-variety-traits.js','nz-variety-traits.js','variety-traits-integration.js',
        'variety-selector-ui.js','cultivar-profile-ui.js','nz-fine-fescue-integration.js',
        'gilba-pgr-module-v3.js','pgr-ui.js','dmi-growth-suppression.js',
        'irrigation-scheduler.js','irrigation-scheduler-ui.js',
        'climate-module-v2.js','climate-module-v2-ui.js',
        'climate-module-v2.1-dual-metrics.js','climate-module-v2.1-ui.js',
        'climate-module-v2.1-integration.js','dew-prediction-engine.js',
        'dew-prediction-ui.js','dew-prediction-integration.js',
        'tissue-progressive-disclosure.js','extended-regional-fungicides.js',
        'european-regional-fungicides.js','nz-fungicides.js','au-fungicides.js',
        'uk-fungicides.js','fungicide-filter.js','smith-kerns-model.js',
        'large-patch-model.js','disease-engine.js','disease-engine-pure.js',
        'disease-stress-climate-coupling.js','disease-ui.js','disease-integration.js',
        'bipolaris-curvularia-models.js','red-thread-model.js','red-thread-integration.js',
        'gilba-charts.js','disease-forecast.js','irrigation-forecast.js',
        'shade-forecast.js','pgr-forecast.js','stress-trajectory-engine-pure.js',
        'stress-trajectory-ui.js','stress-trajectory-integration.js',
        'hub-integration-patch.js','dependency-graph.js','soil-temp-logger.js',
        'pre-emergent-engine.js','pre-emergent-integration.js','hub-orchestrator.js',
        'citation-registry.js','engine-confidence.js','confidence-ui-integration.js',
        'contradiction-detector.js','input-range-validator.js',
        'gaip-scenario-engine.js','cascade-orchestrator.js',
        'sensor-api-specconnect.js','sensor-import.js','sensor-import-ui.js',
        'sensor-integration-manager.js','sensor-api-hydrosight.js',
        'sensor-api-bridge.js','sensor-integration-ui.js',
        'lab-import.js','sample-manager.js','sample-persistence.js','zone-key.js',
        'jspdf-shim.js',
        'sample-switcher-ui.js','bulk-area-modal.js',
        'sample-turf-profile-modal.js','sample-turf-profile-bulk-modal.js',
        'site-settings-multi-site-turf-toggle.js','form-ux.js',
        'lab-report-parser.js','gaip-clear-data.js','input-state-watcher.js',
        'soil-structure-engine.js','site-selector-ui.js','site-config-persistence.js',
        'site-profile-bridge.js','site-switch-cleanup.js','site-dashboard.js',
        'nutrient-trend.js',
        'jszip.min.js','docx.min.js',
        'gp-status.js',
        'word-export-combined.js','gaip-ical-export.js',
        'k-reconciliation-decision.js', // GH-292: must load before word-export.js
        'word-export.js','chart-annotator-hub.js','export-metadata.js',
        'gssh-led-export.js',
        'gilba-soil-interpretation.js','gilba-water-interpretation.js',
        'gilba-synthesis-interpretation.js','hub-persistence.js',
        'daily-dashboard.js','priority-action-queue.js',
        'gaip-decision-engine.js','gaip-decision-ui.js','gaip-evidence-ui.js',
        'floating-run-button.js','card-layout-redesign.js',
        'tab-navigation.js','quick-jump-nav.js',
        'nutrition-calendar.js','prebbles-products.js',
        'nutrition-prebble-integration.js','au-fertiliser-products.js',
        'nutrition-au-fertiliser-integration.js','uk-fertiliser-products.js',
        'nutrition-uk-fertiliser-integration.js','aitkens-fertiliser-products.js',
        'nz-fertiliser-products.js','nutrition-nz-fertiliser-integration.js',
        'tissue-corrective-engine-pure.js',
        'site-setup-wizard.js','hub-header-bar.js','mobile-turf-sheet.js',
        'spray-log.js','spray-log-ui.js','spray-log-integration.js',
        'spray-log-cascade.js','spray-log-print.js','gilba-alerts.js',
        'uv-residual-engine.js','site-settings-panel.js','site-data-transfer.js',
        'environmental-utilisation-engine.js','eue-integration-bridge.js',
        'gssh-operational-summary.js','shade-engine.js','global-solubles.js',
        'gaip-field-log-analysis.js','gaip-field-log.js','gaip-morning-briefing.js',
    ];
    $headLike = ['gilba-hub-v2.js','growth-potential-engine.js','nutrition-requirement-engine.js','climate-engine-v2.js'];
@endphp
@foreach($hubScripts as $script)
    @if(is_file(base_path('../assets/'.$script)))
        <script src="{{ $legacyAssetUrl($script) }}" @if(!in_array($script,$headLike)) defer @endif></script>
    @endif
@endforeach

{{-- Export: show sample picker then run combined export --}}
<script defer>
function rpExportWordWithPicker() {
    if (!window.GAIP_CombinedExport) {
        alert('Analysis not yet loaded — please wait a moment and try again.');
        return;
    }
    GAIP_CombinedExport.exportWithPicker('all');
}
</script>
@endsection

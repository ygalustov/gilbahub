@extends('layouts.db-shell', ['title' => 'Forensic Record', 'currentPage' => 'reports'])

@section('head')
<script>
    // GH-364: same soil-texture pass-through GH-357 added to export.blade.php.
    // ReportsController::pageData() already computes $soilTexture for every
    // Reports tab, but only the Export tab consumed it -- and this page loads
    // word-export.js/word-export-combined.js too, so its _aaRanges resolution
    // hit exactly the gap GH-357 declared closed.
    Object.assign(window.GAIP_HUB_CONFIG, {
        soilTexture: @json($soilTexture ?? null),
    });
</script>
@endsection

@section('styles')
<style>
.rp-page { padding: 0; display: flex; flex-direction: column; flex: 1; min-height: 0; overflow-y: auto; }
.rp-content { padding: 24px 28px; max-width: 900px; }
#rp-hub-runner { display: none !important; position: absolute; left: -9999px; width: 1px; height: 1px; overflow: hidden; pointer-events: none; }
@include('reports._hub-suppress')
</style>
@endsection

@section('content')
<div class="rp-page">
    @include('reports._subnav')

    <div class="rp-content">
        <div style="margin-bottom:22px">
            <div style="font-size:20px;font-weight:700;color:var(--gaip-text);margin-bottom:4px">Forensic Decision Record</div>
            <div style="font-size:13px;color:var(--gaip-text-secondary)">
                {{ $activeSite?->name ?? 'No site selected' }}
                @if($turfSpecies) · {{ $turfSpecies }} @endif
                @if($turfMethodology) · {{ $turfMethodology }} @endif
            </div>
        </div>

        {{-- Forensic panel rendered by reports-forensic-ui.js --}}
        <div id="gaip-forensic-report-panel">
            <div class="db-empty-state">
                <svg width="36" height="36" fill="none" viewBox="0 0 24 24" stroke="#c8d5cf" stroke-width="1.5">
                    <path stroke-linecap="round" stroke-linejoin="round" d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2"/>
                    <rect x="9" y="3" width="6" height="4" rx="1"/>
                    <path stroke-linecap="round" d="M9 12h6M9 16h4"/>
                </svg>
                <div class="db-empty-title">Loading forensic record…</div>
                <div class="db-empty-sub">
                    The decision record loads automatically from the last analysis run.<br>
                    If this message persists after 10 seconds, click <strong>Re-run</strong> in the top bar.
                </div>
            </div>
        </div>
    </div>
</div>

{{-- Hidden hub: same stack as /reports/export --}}
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
@php
    $hubScripts = [
        'gilba-hub-v2.js','growth-potential-engine.js',
        // GH-383 (D31 stage 0/1): the shared per-nutrient requirement core and the
        // shared programme input adapter both engines now route through. Must load
        // before nutrition-requirement-engine.js and nutrition-calendar.js.
        'nutrition-requirement-core.js','nutrition-program-inputs.js',
        'nutrition-requirement-engine.js','climate-engine-v2.js',
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
        'jspdf-shim.js','sample-switcher-ui.js','bulk-area-modal.js',
        'sample-turf-profile-modal.js','sample-turf-profile-bulk-modal.js',
        'site-settings-multi-site-turf-toggle.js','form-ux.js',
        'lab-report-parser.js','gaip-clear-data.js','input-state-watcher.js',
        'soil-structure-engine.js','site-selector-ui.js','site-config-persistence.js',
        'site-profile-bridge.js','site-switch-cleanup.js','site-dashboard.js',
        'nutrient-trend.js','jszip.min.js','docx.min.js',
        'gp-status.js',
        'word-export-combined.js','gaip-ical-export.js',
        'k-reconciliation-decision.js', // GH-292: must load before word-export.js
        'word-export.js',
        'chart-annotator-hub.js','export-metadata.js',
        'gilba-soil-interpretation.js','gilba-water-interpretation.js',
        'gilba-synthesis-interpretation.js','hub-persistence.js',
        'daily-dashboard.js','priority-action-queue.js',
        'gaip-decision-engine.js','gaip-decision-ui.js','gaip-evidence-ui.js',
        'floating-run-button.js','auto-refresh.js','card-layout-redesign.js',
        'tab-navigation.js','quick-jump-nav.js',
        'nutrition-calendar.js',
        // GH-396: shared Balance/Status classifier for the Plan page's Nutrient
        // Delivery Summary and the export's Annual Nutrient Requirements table.
        'nutrient-balance-status.js',
        'prebbles-products.js',
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
    // GH-383: the core and the input adapter must EXECUTE before the engine and
    // the calendar. Everything outside $headLike is emitted with `defer`, so a
    // non-deferred script always runs first regardless of document order — the
    // two new files therefore have to be head-like too.
    $headLike = ['gilba-hub-v2.js','growth-potential-engine.js','nutrition-requirement-core.js','nutrition-program-inputs.js','nutrition-requirement-engine.js','climate-engine-v2.js'];
@endphp
@foreach($hubScripts as $script)
    @if(is_file(base_path('../assets/'.$script)))
        <script src="{{ $legacyAssetUrl($script) }}" @if(!in_array($script,$headLike)) defer @endif></script>
    @endif
@endforeach
<script src="{{ $legacyAssetUrl('reports-forensic-ui.js') }}" defer></script>
@endsection

@extends('layouts.db-shell', ['title' => 'Scenarios', 'currentPage' => 'reports'])

@section('styles')
<style>
.rp-page { padding: 0; display: flex; flex-direction: column; flex: 1; min-height: 0; overflow-y: auto; }
.rp-content { padding: 24px 28px; flex: 1; display: flex; flex-direction: column; }
#rp-hub-runner { display: none !important; position: absolute; left: -9999px; width: 1px; height: 1px; overflow: hidden; pointer-events: none; }
#gaip-whatif-container { flex: 1; }
@include('reports._hub-suppress')
</style>
@endsection

@section('content')
<div class="rp-page">
    @include('reports._subnav')

    <div class="rp-content">
        <div style="margin-bottom:22px">
            <div style="font-size:20px;font-weight:700;color:var(--gaip-text);margin-bottom:4px">Scenario Comparison</div>
            <div style="font-size:13px;color:var(--gaip-text-secondary)">
                {{ $activeSite?->name ?? 'No site selected' }}
                @if($turfSpecies) · {{ $turfSpecies }} @endif
                @if($turfMethodology) · {{ $turfMethodology }} @endif
            </div>
        </div>

        {{-- How-to hint —shown only while whatif UI hasn't mounted yet --}}
        <div id="rp-scenario-hint" style="background:var(--gaip-surface);border:1px solid var(--gaip-border);border-radius:10px;padding:20px 22px;margin-bottom:16px">
            <div style="font-size:11px;font-weight:700;letter-spacing:.06em;text-transform:uppercase;color:var(--gaip-text-secondary);margin-bottom:10px">How it works</div>
            <div style="display:flex;flex-direction:column;gap:8px">
                <div style="display:flex;align-items:flex-start;gap:10px;font-size:13px;color:var(--gaip-text-secondary)">
                    <span style="flex-shrink:0;width:20px;height:20px;border-radius:50%;background:var(--gaip-accent);color:#fff;font-size:11px;font-weight:700;display:flex;align-items:center;justify-content:center;margin-top:1px">1</span>
                    <span><strong style="color:var(--gaip-text)">Current Baseline</strong> — your site's current analysis state (auto-loaded from last analysis run).</span>
                </div>
                <div style="display:flex;align-items:flex-start;gap:10px;font-size:13px;color:var(--gaip-text-secondary)">
                    <span style="flex-shrink:0;width:20px;height:20px;border-radius:50%;background:var(--gaip-accent);color:#fff;font-size:11px;font-weight:700;display:flex;align-items:center;justify-content:center;margin-top:1px">2</span>
                    <span><strong style="color:var(--gaip-text)">Scenario B</strong> — choose a quick preset (e.g. "Poor Water Quality") or adjust individual parameters manually.</span>
                </div>
                <div style="display:flex;align-items:flex-start;gap:10px;font-size:13px;color:var(--gaip-text-secondary)">
                    <span style="flex-shrink:0;width:20px;height:20px;border-radius:50%;background:var(--gaip-accent);color:#fff;font-size:11px;font-weight:700;display:flex;align-items:center;justify-content:center;margin-top:1px">3</span>
                    <span>Click <strong style="color:var(--gaip-text)">Compare Scenarios</strong> to see how the change affects disease risk, growth potential, stress index, and other metrics.</span>
                </div>
            </div>
        </div>

        {{-- What-if panel: gaip-whatif-ui.js mounts here --}}
        <div id="gaip-whatif-container">
            <div class="db-empty-state">
                <svg width="28" height="28" fill="none" viewBox="0 0 24 24" stroke="#c8d5cf" stroke-width="1.5">
                    <path stroke-linecap="round" stroke-linejoin="round" d="M8 7h12m0 0l-4-4m4 4l-4 4M4 17H0m0 0l4 4m-4-4l4-4"/>
                </svg>
                <div class="db-empty-title">Running analysis…</div>
                <div class="db-empty-sub">
                    Building the baseline scenario from your site data.<br>
                    This typically takes 5–15 seconds. If nothing appears after 20 seconds, click <strong>Re-run</strong> in the top bar.
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
        'gilba-hub-v2.js','growth-potential-engine.js','nutrition-requirement-engine.js','climate-engine-v2.js',
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
        'gaip-scenario-engine.js','gaip-whatif-ui.js',
        'cascade-orchestrator.js','scenario-presets.js','scenario-export.js',
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
        'word-export-combined.js','gaip-ical-export.js','word-export.js',
        'chart-annotator-hub.js','export-metadata.js',
        'gilba-soil-interpretation.js','gilba-water-interpretation.js',
        'gilba-synthesis-interpretation.js','hub-persistence.js',
        'daily-dashboard.js','priority-action-queue.js',
        'gaip-decision-engine.js','gaip-decision-ui.js','gaip-evidence-ui.js',
        'floating-run-button.js','auto-refresh.js','card-layout-redesign.js',
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

{{-- Light-theme override for gaip-whatif-ui.js built-in dark styles --}}
<link rel="stylesheet" href="{{ $legacyAssetUrl('reports-scenarios-override.css') }}">

{{-- Mount what-if panel once analysis is ready --}}
<script defer>
(function () {
    function mountScenarioPanel() {
        if (window.GAIP_WhatIfUI && typeof GAIP_WhatIfUI.mount === 'function') {
            var ok = GAIP_WhatIfUI.mount('gaip-whatif-container');
            if (ok !== false) {
                var hint = document.getElementById('rp-scenario-hint');
                if (hint) hint.style.display = 'none';
            }
            if (typeof GAIP_WhatIfUI.loadBaseline === 'function') {
                GAIP_WhatIfUI.loadBaseline();
            }
        }
    }

    document.addEventListener('gaip:orchestrator-complete', function () {
        setTimeout(mountScenarioPanel, 300);
    });
    document.addEventListener('gaip:analysis-complete', function () {
        setTimeout(mountScenarioPanel, 300);
    });
}());
</script>
@endsection

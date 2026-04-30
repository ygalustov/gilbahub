@extends('layouts.app', ['title' => 'Hub'])

@section('head')
    @php
        $legacyAssetUrl = function (string $asset): string {
            $path = base_path('../assets/'.$asset);
            $version = is_file($path) ? '?v='.filemtime($path) : '';

            return url('/legacy-assets/'.$asset).$version;
        };

        $hubStyles = [
            'hub.css',
            'sample-manager.css',
            'site-selector-ui.css',
            'site-dashboard.css',
            'disease-ui.css',
            'nutrition-calendar.css',
            'nutrient-trend.css',
            'shade-ui.css',
            'gaip-decision.css',
            'gaip-evidence.css',
            'gaip-design-system.css',
            'gaip-mobile.css',
        ];
    @endphp
    @foreach ($hubStyles as $style)
        <link rel="stylesheet" href="{{ $legacyAssetUrl($style) }}">
    @endforeach
@endsection

@section('body')
    @php
        $activeSite = auth()->user()?->activeSite;
        $savedLocation = [
            'name' => $activeSite?->location_name ?? '',
            'lat' => $activeSite?->latitude ?? '',
            'lon' => $activeSite?->longitude ?? '',
        ];

        $hubScripts = [
            'gilba-hub-v2.js',
            'climate-engine-v2.js',
            'gaip-utils.js',
            'species-controller.js',
            'regional-profiles.js',
            'gilba-variety-traits.js',
            'au-variety-traits.js',
            'nz-variety-traits.js',
            'uk-variety-traits.js',
            'scanturf-variety-traits.js',
            'scandinavia-variety-traits.js',
            'geves-variety-traits.js',
            'bsa-variety-traits.js',
            'japan-variety-traits.js',
            'variety-traits-integration.js',
            'nz-fine-fescue-integration.js',
            'location-preloader.js',
            'climate-engine.js',
            'ambient-dli-engine.js',
            'ambient-dli-integration.js',
            'weather-resilience.js',
            'climate-module-v2.js',
            'climate-module-v2-ui.js',
            'climate-module-v2.1-dual-metrics.js',
            'climate-module-v2.1-ui.js',
            'climate-module-v2.1-integration.js',
            'gaip-soil-temp-integration.js',
            'dew-prediction-engine.js',
            'dew-prediction-ui.js',
            'dew-prediction-integration.js',
            'shade-engine.js',
            'shade-engine-pure.js',
            'shade-forecast.js',
            'dli-recovery-bridge.js',
            'wear-recovery-engine-pure.js',
            'wear-recovery-integration.js',
            'stress-trajectory-engine-pure.js',
            'stress-trajectory-ui.js',
            'stress-trajectory-integration.js',
            'irrigation-scheduler.js',
            'irrigation-forecast.js',
            'irrigation-scheduler-ui.js',
            'cascade-orchestrator.js',
            'disease-engine-pure.js',
            'disease-stress-climate-coupling.js',
            'hub-orchestrator.js',
            'turf-profile-controller.js',
            'sample-manager.js',
            'zone-key.js',
            'nutrient-trend.js',
            'sample-switcher-ui.js',
            'site-selector-ui.js',
            'site-data-transfer.js',
            'site-config-persistence.js',
            'site-profile-bridge.js',
            'site-switch-cleanup.js',
            'jspdf-shim.js',
            'hub-tissue-v3.js',
            'hub-persistence.js',
            'nutrition-requirement-engine.js',
            'nutrition-summary-integration.js',
            'nutrition-calendar.js',
            'prebbles-products.js',
            'nutrition-prebble-integration.js',
            'au-fertiliser-products.js',
            'nutrition-au-fertiliser-integration.js',
            'uk-fertiliser-products.js',
            'nutrition-uk-fertiliser-integration.js',
            'site-dashboard.js',
            'hub-header-bar.js',
            'site-settings-panel.js',
            'daily-dashboard.js',
            'gilba-charts.js',
            'card-layout-redesign.js',
            'tab-navigation.js',
            'citation-registry.js',
            'engine-confidence.js',
            'confidence-ui-integration.js',
            'hub-integration-patch.js',
            'pre-emergent-engine.js',
            'pre-emergent-integration.js',
            'disease-forecast.js',
            'disease-ui.js',
            'disease-integration.js',
            'cultivar-profile-ui.js',
            'lab-report-parser.js',
            'gaip-decision-engine.js',
            'gaip-decision-ui.js',
            'gaip-evidence-ui.js',
        ];
    @endphp

    <main class="content content-wide">
        @include('partials.legacy-hub-markup', ['savedLocation' => $savedLocation])
    </main>
@endsection

@section('scripts')
    @php($headLikeScripts = ['gilba-hub-v2.js', 'climate-engine-v2.js'])

    @foreach ($hubScripts as $script)
        <script src="{{ $legacyAssetUrl($script) }}" @if (! in_array($script, $headLikeScripts, true)) defer @endif></script>
    @endforeach
@endsection

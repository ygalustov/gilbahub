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
            'location-preloader.js',
            'climate-engine.js',
            'shade-engine.js',
            'cascade-orchestrator.js',
            'hub-orchestrator.js',
            'turf-profile-controller.js',
            'sample-manager.js',
            'sample-switcher-ui.js',
            'site-selector-ui.js',
            'site-config-persistence.js',
            'site-profile-bridge.js',
            'site-switch-cleanup.js',
            'jspdf-shim.js',
            'hub-tissue-v3.js',
            'hub-persistence.js',
            'site-dashboard.js',
            'hub-header-bar.js',
            'site-settings-panel.js',
            'daily-dashboard.js',
            'card-layout-redesign.js',
            'tab-navigation.js',
            'citation-registry.js',
            'engine-confidence.js',
            'confidence-ui-integration.js',
            'hub-integration-patch.js',
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

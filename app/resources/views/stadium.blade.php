@extends('layouts.app', ['title' => 'Stadium'])

@section('head')
    @php
        $legacyAssetUrl = function (string $asset): string {
            $path = base_path('../assets/'.$asset);
            $version = is_file($path) ? '?v='.filemtime($path) : '';

            return url('/legacy-assets/'.$asset).$version;
        };

        $stadiumStyles = [
            'hub.css',
            'sample-manager.css',
            'site-selector-ui.css',
            'site-dashboard.css',
            'tissue.css',
            'column-collapse-fix.css',
            'shade-ui.css',
            'gaip-design-system.css',
            'gaip-mobile.css',
            'stadium/frontend.css',
        ];

        $stadiumDataFiles = [
            ['path' => base_path('../data/stadiums/australia_stadium_obstruction_profiles.json'), 'country' => 'Australia', 'region' => 'Australia'],
            ['path' => base_path('../data/stadiums/uk_stadium_obstruction_profiles.json'), 'country' => 'United Kingdom', 'region' => 'United Kingdom'],
            ['path' => base_path('../data/stadiums/japan_j1_stadium_obstruction_profiles.json'), 'country' => 'Japan', 'region' => 'Japan'],
            ['path' => base_path('../data/stadiums/stadium_obstruction_profiles_sample.json'), 'country' => 'Other', 'region' => 'Other'],
        ];

        $stadiums = [];
        foreach ($stadiumDataFiles as $source) {
            if (! is_file($source['path'])) {
                continue;
            }
            $rows = json_decode(file_get_contents($source['path']), true);
            if (! is_array($rows)) {
                continue;
            }
            foreach ($rows as $row) {
                if (! is_array($row) || empty($row['venue_id']) || empty($row['stadium'])) {
                    continue;
                }
                $venueId = (string) $row['venue_id'];
                $stadiums[$venueId] = [
                    'name' => (string) $row['stadium'],
                    'lat' => $row['pitch_center']['lat'] ?? null,
                    'lng' => $row['pitch_center']['lon'] ?? null,
                    'country' => $source['country'],
                    'region' => $source['region'],
                    'club' => $row['club'] ?? null,
                    'league' => $row['league'] ?? null,
                ];
            }
        }
        ksort($stadiums);
    @endphp

    @foreach ($stadiumStyles as $style)
        <link rel="stylesheet" href="{{ $legacyAssetUrl($style) }}">
    @endforeach

    <script>
        window.GILBA_PLUGIN_NS = 'gssh';
        window.GSSH_CONTEXT = window.GSSH_CONTEXT || {};
        window.GSSH_HUB_CONFIG = Object.assign({}, window.GSSH_HUB_CONFIG || {}, {
            openMeteoUrl: 'https://api.open-meteo.com/v1/forecast',
            restUrl: '{{ url('/api') }}/',
            csrfToken: '{{ csrf_token() }}',
            savedLocation: window.GAIP_HUB_CONFIG ? window.GAIP_HUB_CONFIG.savedLocation : {},
            nonce: '{{ csrf_token() }}',
            restNonce: '{{ csrf_token() }}',
            userId: {{ auth()->id() ?? 0 }},
            hubMode: 'stadium'
        });
        window.GAIP_HUB_CONFIG = Object.assign({}, window.GAIP_HUB_CONFIG || {}, {
            hubMode: 'stadium'
        });
        window.GSSH_STADIUM_CONFIG = Object.assign({}, window.GSSH_STADIUM_CONFIG || {}, {
            venues: @json($stadiums),
            nonce: '{{ csrf_token() }}'
        });
        window.GilbaStadiumData = Object.assign({}, window.GilbaStadiumData || {}, {
            stadiums: @json($stadiums)
        });
    </script>
@endsection

@section('body')
    @php
        $activeSite = auth()->user()?->activeSite;
        $savedLocation = [
            'name' => $activeSite?->location_name ?? '',
            'lat' => $activeSite?->latitude ?? '',
            'lon' => $activeSite?->longitude ?? '',
        ];

        $stadiumScripts = [
            'gilba-storage-ns.js',
            'gaip-site-context.js',
            'gilba-storage-migrate.js',
            'gilba-hub-v2.js',
            'climate-engine-v2.js',
            'climate-normals-service.js', // GH-245 (Hoxton audit D01-D03)
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
            'site-selector-ui.js',
            'site-config-persistence.js',
            'site-profile-bridge.js',
            'site-switch-cleanup.js',
            'hub-tissue-v3.js',
            'citation-registry.js',
            'engine-confidence.js',
            'confidence-ui-integration.js',
            'tab-navigation.js',
            'shade-orchestrator.js',
            'stadium/unified-venue-selector.js',
            'stadium/venue-profile-persistence.js',
            'stadium/coverage-slider.js',
            'stadium-tab-ui.js',
        ];
    @endphp

    <main class="content content-wide">
        @include('partials.legacy-hub-markup', ['savedLocation' => $savedLocation])
        <div id="gssh-hub" class="gssh-hub-wrapper"></div>
    </main>
@endsection

@section('scripts')
    @php($headLikeScripts = ['gilba-storage-ns.js', 'gaip-site-context.js', 'gilba-storage-migrate.js', 'gilba-hub-v2.js', 'climate-engine-v2.js'])

    @foreach ($stadiumScripts as $script)
        <script src="{{ $legacyAssetUrl($script) }}" @if (! in_array($script, $headLikeScripts, true)) defer @endif></script>
    @endforeach
@endsection

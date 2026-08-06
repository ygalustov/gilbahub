@extends('layouts.db-shell', ['title' => 'Analysis', 'currentPage' => 'analysis'])

@section('head')
<script>
    Object.assign(window.GAIP_HUB_CONFIG, {
        savedLocation:   @json($savedLocation),
        turfSpecies:     @json($turfSpecies),
        turfVariety:     @json($turfVariety ?? null),
        overseedSpecies: @json($overseedSpecies),
        turfMethodology: @json($turfMethodology),
        percentC3Cover:  @json($percentC3Cover),
    });
    window.GAIP_SITE_CONFIG = {
        turf: {
            species:          @json($turfSpecies),
            variety:          @json($turfVariety ?? null),
            turfType:         @json($turfSiteType ?? null),
            companionSpecies: @json($companionSpecies ?? null),
        }
    };
    window.GAIP_SiteContext = {
        getSiteId: function() {
            return (window.GAIP_HUB_CONFIG || {}).activeSiteId || null;
        }
    };
</script>
@endsection

@section('content')

        {{-- NOTIFICATION BAR --}}
        <div id="db-analysis-notice" class="db-verdict warning" style="display:none">
            <svg width="16" height="16" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2.5" style="flex-shrink:0">
                <path stroke-linecap="round" stroke-linejoin="round" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"/>
            </svg>
            <span id="db-analysis-notice-text"></span>
            <button id="db-analysis-notice-dismiss" type="button"
                    style="margin-left:auto;background:none;border:none;color:inherit;opacity:.75;cursor:pointer;font-size:13px;padding:0 4px">
                Dismiss ✕
            </button>
        </div>

        {{-- TABS BAR --}}
        <nav class="gl-tabs-bar">
            <div class="gl-tabs-inner">
                <a href="#disease" class="gl-tab" data-tab="disease">
                    <svg width="13" height="13" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2.5" style="flex-shrink:0">
                        <path stroke-linecap="round" stroke-linejoin="round" d="M12 9v2m0 4h.01M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z"/>
                    </svg>
                    Disease Risk <span class="gl-tab-badge" id="gl-badge-disease"></span>
                </a>
                <a href="#stress" class="gl-tab" data-tab="stress">
                    Stress <span class="gl-tab-badge" id="gl-badge-stress"></span>
                </a>
                <a href="#growth-light" class="gl-tab" data-tab="growth-light">
                    <svg width="13" height="13" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2.5" style="flex-shrink:0">
                        <path stroke-linecap="round" stroke-linejoin="round" d="M12 3c0 0-6 4-6 9a6 6 0 0012 0c0-5-6-9-6-9z"/>
                    </svg>
                    Growth &amp; Light
                </a>
                <a href="#soil-nutrition" class="gl-tab" data-tab="soil-nutrition">Soil &amp; Nutrition</a>
                <a href="#water-balance" class="gl-tab" data-tab="water-balance">Water Balance</a>

            </div>
            <span class="gl-tab-accuracy" id="gl-tab-accuracy" hidden></span>
        </nav>

        {{-- TAB CONTENT WRAPPERS — router shows/hides --}}
        <div id="analysis-tab-disease" style="flex:1;overflow-y:auto;scrollbar-gutter:stable;display:none">
            <div id="dr-page-content">
                <div style="padding:40px;text-align:center;color:#5b6a65">Loading disease analysis…</div>
            </div>
        </div>

        <div id="analysis-tab-growth-light" style="flex:1;overflow-y:auto;scrollbar-gutter:stable;display:none">
            <div id="gl-page-content">
                <div style="padding:40px;text-align:center;color:#5b6a65">Loading growth &amp; light analysis…</div>
            </div>
        </div>

        <div id="analysis-tab-soil-nutrition" style="flex:1;overflow-y:auto;scrollbar-gutter:stable;display:none">
            <div id="sn-page-content">
                <div style="padding:40px;text-align:center;color:#5b6a65">Loading soil &amp; nutrition analysis…</div>
            </div>
        </div>

        <div id="analysis-tab-water-balance" style="flex:1;overflow-y:auto;scrollbar-gutter:stable;display:none">
            <div id="wb-page-content">
                <div style="padding:40px;text-align:center;color:#5b6a65">Loading water balance analysis…</div>
            </div>
        </div>

        <div id="analysis-tab-stress" style="flex:1;overflow-y:auto;scrollbar-gutter:stable;display:none">
            <div id="stress-page-content">
                <div style="padding:40px;text-align:center;color:#5b6a65">Loading stress analysis…</div>
            </div>
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
{{-- Sample management: needed for soil/water sample selectors in Water Balance tab --}}
<script src="{{ $legacyAssetUrl('sample-manager.js') }}"></script>
<script src="{{ $legacyAssetUrl('sample-persistence.js') }}"></script>
<script src="{{ $legacyAssetUrl('spray-log.js') }}"></script>
<script src="{{ $legacyAssetUrl('uv-residual-engine.js') }}"></script>
<script src="{{ $legacyAssetUrl('spray-log-cascade.js') }}"></script>
{{-- Router MUST be first so GAIP_ANALYSIS_ROUTER is set before page scripts run --}}
<script src="{{ $legacyAssetUrl('analysis-router.js') }}"></script>
{{-- Variety traits must load before disease engine so getDiseaseModifier/getWearModifier are available --}}
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
{{-- Disease engine must load before disease-forecast.js so generateForecast uses the full engine --}}
<script src="{{ $legacyAssetUrl('disease-engine-pure.js') }}"></script>
<script src="{{ $legacyAssetUrl('disease-stress-climate-coupling.js') }}"></script>
<script src="{{ $legacyAssetUrl('disease-forecast.js') }}"></script>
<script src="{{ $legacyAssetUrl('disease-analysis.js') }}"></script>
<script src="{{ $legacyAssetUrl('growth-light-analysis.js') }}"></script>
<script src="{{ $legacyAssetUrl('soil-nutrition-analysis.js') }}"></script>
<script src="{{ $legacyAssetUrl('water-balance-analysis.js') }}"></script>
<script src="{{ $legacyAssetUrl('stress-analysis.js') }}"></script>
@endsection

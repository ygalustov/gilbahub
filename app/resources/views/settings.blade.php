@php
    $legacyAssetUrl = function (string $asset): string {
        $path = base_path('../assets/'.$asset);
        $version = is_file($path) ? '?v='.filemtime($path) : '';
        return url('/legacy-assets/'.$asset).$version;
    };
@endphp
@extends('layouts.db-shell', ['title' => 'Settings', 'currentPage' => 'settings'])

@section('styles')
<link rel="stylesheet" href="{{ $legacyAssetUrl('settings-ui.css') }}">
<link rel="stylesheet" href="{{ $legacyAssetUrl('data-ui.css') }}">
@endsection

@section('content')
        <div class="db-content stg-scroll">
            <div class="stg-wrap">

                {{-- Page heading --}}
                <div class="stg-page-head">
                    <h1 class="stg-page-title">Settings</h1>
                </div>

                @if(!$activeSite)
                <div class="stg-card stg-no-site">
                    <p>No active site configured. Create a site from the Dashboard to get started.</p>
                </div>
                @else

                {{-- ── Tabs ──────────────────────────────────────────── --}}
                <div class="stg-tabs" role="tablist">
                    <button class="stg-tab active" role="tab" data-tab="site"         aria-selected="true" >Site settings</button>
                    <button class="stg-tab"         role="tab" data-tab="turf"         aria-selected="false">Turf profile</button>
                    <button class="stg-tab" role="tab" data-tab="traffic" aria-selected="false"
                        @if(($activeGaipConfig['turf']['turfType'] ?? '') !== 'sports') style="display:none" @endif
                    >Traffic &amp; Wear</button>
                    <button class="stg-tab"         role="tab" data-tab="zones"        aria-selected="false">Zones</button>
                    <button class="stg-tab"         role="tab" data-tab="import"       aria-selected="false">Import</button>
                    <button class="stg-tab"         role="tab" data-tab="integrations" aria-selected="false">Integrations</button>
                </div>

                {{-- ── Site settings ────────────────────────────────── --}}
                <div class="stg-panel" id="stg-tab-site" role="tabpanel">
                    <form id="stg-site-form" class="stg-form" novalidate>

                        {{-- Block 1: Site details --}}
                        <div class="stg-card" style="margin-bottom:16px">
                            <div class="stg-card-head">
                                <div class="stg-card-title">Site details</div>
                                <div class="stg-card-desc">Basic information about this location.</div>
                            </div>
                            <div class="stg-form-grid">
                                <div class="stg-field">
                                    <label for="stg-name">Site name</label>
                                    <input type="text" id="stg-name" name="name"
                                           value="{{ $activeSite->name }}" required maxlength="255">
                                </div>
                                <div class="stg-field">
                                    <label for="stg-site-type">Site type</label>
                                    <select id="stg-site-type" name="site_type">
                                        @php
                                            $siteType = $activeSite->site_type ?? '';
                                            $siteTypes = [
                                                'golf'       => 'Golf',
                                                'sports'     => 'Sports (football / cricket / rugby)',
                                                'bowling'    => 'Bowling green',
                                                'racecourse' => 'Racecourse',
                                                'precinct'   => 'Other / precinct',
                                            ];
                                        @endphp
                                        @foreach($siteTypes as $val => $label)
                                        <option value="{{ $val }}" {{ $siteType === $val ? 'selected' : '' }}>{{ $label }}</option>
                                        @endforeach
                                    </select>
                                </div>
                                <div class="stg-field">
                                    <label for="stg-timezone">Timezone</label>
                                    <select id="stg-timezone" name="timezone">
                                        @php
                                            $tz = $activeSite->timezone ?? '';
                                            $tzOptions = [
                                                'Australia/Sydney'    => 'Australia — Sydney / Melbourne',
                                                'Australia/Brisbane'  => 'Australia — Brisbane',
                                                'Australia/Adelaide'  => 'Australia — Adelaide',
                                                'Australia/Perth'     => 'Australia — Perth',
                                                'Australia/Darwin'    => 'Australia — Darwin',
                                                'Pacific/Auckland'    => 'New Zealand — Auckland',
                                                'Asia/Singapore'      => 'Singapore',
                                                'Asia/Tokyo'          => 'Japan — Tokyo',
                                                'Europe/London'       => 'UK — London',
                                                'Europe/Paris'        => 'Europe — Paris / Berlin',
                                                'America/New_York'    => 'USA — Eastern',
                                                'America/Chicago'     => 'USA — Central',
                                                'America/Denver'      => 'USA — Mountain',
                                                'America/Los_Angeles' => 'USA — Pacific',
                                                'UTC'                 => 'UTC',
                                            ];
                                        @endphp
                                        @foreach($tzOptions as $val => $label)
                                        <option value="{{ $val }}" {{ $tz === $val ? 'selected' : '' }}>{{ $label }}</option>
                                        @endforeach
                                    </select>
                                </div>
                                {{-- Location search spans full width, coordinates follow in the same grid --}}
                                <div class="stg-field" style="grid-column:1/-1;position:relative;">
                                    <label for="stg-location-name">Location (for live weather)</label>
                                    <input type="text" id="stg-location-name" name="location_name"
                                           value="{{ $locationName ?? '' }}"
                                           maxlength="255" placeholder="Search suburb, city, or venue…"
                                           autocomplete="off">
                                    <div id="stg-location-results"
                                         style="display:none;position:absolute;left:0;right:0;top:100%;margin-top:2px;
                                                background:#fff;border:1px solid #d8e0dc;border-radius:6px;
                                                box-shadow:0 4px 12px rgba(0,0,0,.15);z-index:1000;
                                                max-height:220px;overflow-y:auto;"></div>
                                </div>
                                <div class="stg-field">
                                    <label for="stg-latitude">Latitude</label>
                                    <input type="number" id="stg-latitude" name="latitude"
                                           value="{{ $latitude ?? '' }}"
                                           step="0.0000001" min="-90" max="90" placeholder="-33.8688">
                                </div>
                                <div class="stg-field">
                                    <label for="stg-longitude">Longitude</label>
                                    <input type="number" id="stg-longitude" name="longitude"
                                           value="{{ $longitude ?? '' }}"
                                           step="0.0000001" min="-180" max="180" placeholder="151.2093">
                                </div>
                                <div class="stg-field">
                                    <label>Hemisphere</label>
                                    <input type="text" id="stg-hemisphere" readonly
                                           value="{{ isset($latitude) ? ($latitude < 0 ? 'Southern' : 'Northern') : '' }}"
                                           style="background:#f5f7f6;color:#6b7f76;cursor:default;">
                                </div>
                                <div class="stg-field">
                                    <label for="stg-elevation">
                                        Elevation (m)
                                        <button type="button" class="stg-info-icon" data-stg-info="elevation" aria-label="About elevation">i</button>
                                    </label>
                                    <input type="number" id="stg-elevation" name="elevation"
                                           value="{{ $activeGaipConfig['location']['elevation'] ?? '' }}"
                                           min="0" max="5000" step="1" placeholder="e.g. 50">
                                </div>
                            </div>
                        </div>

                        {{-- Block 2: Irrigation system --}}
                        <div class="stg-card" style="margin-bottom:16px">
                            <div class="stg-card-head">
                                <div class="stg-card-title">Irrigation system</div>
                                <div class="stg-card-desc">Used for irrigation scheduling and water cost reporting in the analysis.</div>
                            </div>
                            <div class="stg-form-grid">
                                <div class="stg-field">
                                    <label for="stg-irrig-method">
                                        Irrigation method
                                        <button type="button" class="stg-info-icon" data-stg-info="irrig-method" aria-label="About irrigation method">i</button>
                                    </label>
                                    <select id="stg-irrig-method" name="irrig_method">
                                        <option value="">— select —</option>
                                        @php $irrigMethod = $activeGaipConfig['irrigation']['method'] ?? ''; @endphp
                                        @foreach(['sprinkler' => 'Sprinkler / overhead', 'drip' => 'Drip / sub-surface', 'mixed' => 'Mixed system'] as $v => $l)
                                        <option value="{{ $v }}" {{ $irrigMethod === $v ? 'selected' : '' }}>{{ $l }}</option>
                                        @endforeach
                                    </select>
                                </div>
                                <div class="stg-field">
                                    <label for="stg-irrig-efficiency">
                                        System efficiency (%)
                                        <button type="button" class="stg-info-icon" data-stg-info="irrig-efficiency" aria-label="About system efficiency">i</button>
                                    </label>
                                    <input type="number" id="stg-irrig-efficiency" name="irrig_efficiency"
                                           value="{{ $activeGaipConfig['irrigation']['efficiency'] ?? '75' }}"
                                           min="10" max="100" step="1" placeholder="75">
                                </div>
                                <div class="stg-field">
                                    <label for="stg-irrig-rain">
                                        Effective rainfall (%)
                                        <button type="button" class="stg-info-icon" data-stg-info="irrig-rain" aria-label="About effective rainfall">i</button>
                                    </label>
                                    <input type="number" id="stg-irrig-rain" name="irrig_rain"
                                           value="{{ $activeGaipConfig['irrigation']['effectiveRainfall'] ?? '80' }}"
                                           min="0" max="100" step="1" placeholder="80">
                                </div>
                                <div class="stg-field">
                                    <label for="stg-irrig-cost">
                                        Cost per kL ($/kL)
                                        <button type="button" class="stg-info-icon" data-stg-info="irrig-cost" aria-label="About water cost">i</button>
                                    </label>
                                    <input type="number" id="stg-irrig-cost" name="irrig_cost"
                                           value="{{ $activeGaipConfig['irrigation']['costPerKl'] ?? '3.00' }}"
                                           min="0" step="0.01" placeholder="3.00">
                                </div>
                            </div>
                        </div>

                        {{-- Block 3: Manual weather override --}}
                        <div class="stg-card" style="margin-bottom:16px">
                            <div class="stg-card-head">
                                <div class="stg-card-title">Manual weather override</div>
                                <div class="stg-card-desc">Use when live weather is unavailable, or to model a specific scenario. Leave blank to use live data from Open-Meteo.</div>
                            </div>
                            <div class="stg-form-grid">
                                <div class="stg-field">
                                    <label for="stg-wx-tmin">Min air temp (°C)</label>
                                    <input type="number" id="stg-wx-tmin" name="wx_tmin"
                                           value="{{ $activeGaipConfig['weatherOverride']['tmin'] ?? '' }}"
                                           step="0.1" placeholder="e.g. 12">
                                </div>
                                <div class="stg-field">
                                    <label for="stg-wx-tmax">Max air temp (°C)</label>
                                    <input type="number" id="stg-wx-tmax" name="wx_tmax"
                                           value="{{ $activeGaipConfig['weatherOverride']['tmax'] ?? '' }}"
                                           step="0.1" placeholder="e.g. 24">
                                </div>
                                <div class="stg-field">
                                    <label for="stg-wx-humidity">Humidity (%)</label>
                                    <input type="number" id="stg-wx-humidity" name="wx_humidity"
                                           value="{{ $activeGaipConfig['weatherOverride']['humidity'] ?? '' }}"
                                           min="0" max="100" step="1" placeholder="e.g. 65">
                                </div>
                                <div class="stg-field">
                                    <label for="stg-wx-rain">Rainfall (mm/week)</label>
                                    <input type="number" id="stg-wx-rain" name="wx_rain"
                                           value="{{ $activeGaipConfig['weatherOverride']['rainfall'] ?? '' }}"
                                           min="0" step="0.1" placeholder="e.g. 0">
                                </div>
                                <div class="stg-field">
                                    <label for="stg-wx-soiltemp">
                                        Soil temp @ 10cm (°C)
                                        <button type="button" class="stg-info-icon" data-stg-info="wx-soiltemp" aria-label="About soil temperature">i</button>
                                    </label>
                                    <input type="number" id="stg-wx-soiltemp" name="wx_soiltemp"
                                           value="{{ $activeGaipConfig['weatherOverride']['soilTemp'] ?? '' }}"
                                           step="0.1" placeholder="optional">
                                </div>
                                <div class="stg-field">
                                    <label for="stg-wx-et0">
                                        ET₀ (mm/day)
                                        <button type="button" class="stg-info-icon" data-stg-info="wx-et0" aria-label="About ET₀">i</button>
                                    </label>
                                    <input type="number" id="stg-wx-et0" name="wx_et0"
                                           value="{{ $activeGaipConfig['weatherOverride']['et0'] ?? '' }}"
                                           min="0" step="0.01" placeholder="optional">
                                </div>
                            </div>
                        </div>

                        <div class="stg-actions" style="margin-top:20px">
                            <button type="submit" class="stg-btn-primary" id="stg-site-save">Save changes</button>
                            <span class="stg-msg" id="stg-site-msg" hidden></span>
                        </div>
                    </form>
                </div>

                {{-- ── Turf profile ────────────────────────────────── --}}
                <div class="stg-panel stg-hidden" id="stg-tab-turf" role="tabpanel">
                    @php
                        $turf = is_array($activeGaipConfig['turf'] ?? null) ? $activeGaipConfig['turf'] : [];
                        // coolOverseed (settings key) and overseedSpecies (hub key) are synonyms — accept either.
                        $turfVal = function(string $k, $fallback = '') use ($turf) {
                            if (isset($turf[$k]) && $turf[$k] !== '') return $turf[$k];
                            if ($k === 'coolOverseed' && isset($turf['overseedSpecies']) && $turf['overseedSpecies'] !== '') return $turf['overseedSpecies'];
                            if ($k === 'overseedSpecies' && isset($turf['coolOverseed']) && $turf['coolOverseed'] !== '') return $turf['coolOverseed'];
                            return $fallback;
                        };

                        $speciesGroups = [
                            'Warm-season (C4)' => [
                                'Couch', 'Bermuda', 'Kikuyu', 'Zoysia', 'Seashore Paspalum', 'Buffalo',
                            ],
                            'Cool-season (C3)' => [
                                'Creeping Bentgrass (Greens)', 'Creeping Bentgrass (Fairway)',
                                'Creeping Bentgrass', 'Colonial Bentgrass', 'Browntop Bent',
                                'Perennial Ryegrass', 'Kentucky Bluegrass', 'Tall Fescue',
                                'Fine Fescue', 'Chewings Fescue', 'Chewings Fescue (Greens)',
                                'Slender Creeping Red Fescue', 'Strong Creeping Red Fescue',
                                'Poa annua',
                            ],
                        ];
                    @endphp

                    <form id="stg-turf-form" class="stg-form" novalidate>

                        {{-- Block 1: Identity --}}
                        <div class="stg-card" style="margin-bottom:16px">
                            <div class="stg-card-head">
                                <div class="stg-card-title">Turf identity</div>
                                <div class="stg-card-desc">Species and surface type — drives growth potential, disease risk, and nutrition targets.</div>
                            </div>
                            <div class="stg-form-grid" style="grid-template-columns:repeat(2,1fr)">
                                <div class="stg-field">
                                    <label for="stg-turf-type">Turf type</label>
                                    <select id="stg-turf-type" name="turfType">
                                        <option value="">— select —</option>
                                        @foreach(['golf' => 'Golf', 'sports' => 'Sports Field', 'lawns' => 'Lawns'] as $v => $l)
                                        <option value="{{ $v }}" {{ $turfVal('turfType') === $v ? 'selected' : '' }}>{{ $l }}</option>
                                        @endforeach
                                    </select>
                                </div>
                                <div class="stg-field">
                                    <label for="stg-turf-subcategory">Surface / area</label>
                                    <select id="stg-turf-subcategory" name="subCategory">
                                        <option value="">— select —</option>
                                    </select>
                                </div>
                                <div class="stg-field">
                                    <label for="stg-turf-species">Species</label>
                                    <select id="stg-turf-species" name="species">
                                        <option value="">— select —</option>
                                        @foreach($speciesGroups as $groupLabel => $options)
                                        <optgroup label="{{ $groupLabel }}">
                                            @foreach($options as $sp)
                                            <option value="{{ $sp }}" {{ $turfVal('species') === $sp ? 'selected' : '' }}>{{ $sp }}</option>
                                            @endforeach
                                        </optgroup>
                                        @endforeach
                                    </select>
                                </div>
                                <div class="stg-field">
                                    <label for="stg-turf-variety">Cultivar / variety</label>
                                    <select id="stg-turf-variety" name="variety">
                                        <option value="generic">Generic / Unknown</option>
                                        @if($turfVal('variety') && $turfVal('variety') !== 'generic')
                                        <option value="{{ $turfVal('variety') }}" selected>{{ $turfVal('variety') }}</option>
                                        @endif
                                    </select>
                                </div>
                            </div>
                            {{-- Companion surface species — shown only for Golf / Greens --}}
                            <div id="stg-companion-row" style="display:none;margin-top:12px;padding:10px 14px;background:#f0fdf4;border-left:3px solid #16a34a;border-radius:0 6px 6px 0">
                                <div class="stg-field" style="margin:0">
                                    <label for="stg-companion-species" style="color:#14532d">Fairway / Tee species</label>
                                    <select id="stg-companion-species" name="companionSpecies">
                                        <option value="">— None (greens only) —</option>
                                        <option value="couch" {{ $turfVal('companionSpecies') === 'couch' ? 'selected' : '' }}>Couch (Bermudagrass)</option>
                                        <option value="kikuyu" {{ $turfVal('companionSpecies') === 'kikuyu' ? 'selected' : '' }}>Kikuyu</option>
                                        <option value="zoysia" {{ $turfVal('companionSpecies') === 'zoysia' ? 'selected' : '' }}>Zoysia</option>
                                        <option value="buffalo" {{ $turfVal('companionSpecies') === 'buffalo' ? 'selected' : '' }}>Buffalo (St Augustine)</option>
                                    </select>
                                    <div style="font-size:12px;color:#166534;margin-top:8px;line-height:1.5">
                                        If your fairways or tees carry a different species to your greens, select it here.
                                        After each analysis run, the dashboard will show a <strong>separate disease risk assessment</strong> for that surface —
                                        using the same weather data but disease thresholds specific to the selected species.
                                        Greens analysis is unaffected.
                                    </div>
                                </div>
                            </div>
                        </div>

                        {{-- Block 2: Construction --}}
                        <div class="stg-card" style="margin-bottom:16px">
                            <div class="stg-card-head">
                                <div class="stg-card-title">Construction & conditions</div>
                                <div class="stg-card-desc">Rootzone profile and maintenance parameters — affects irrigation scheduling and nutrient interpretation.</div>
                            </div>
                            <div class="stg-form-grid">
                                <div class="stg-field">
                                    <label for="stg-turf-construction">Construction type</label>
                                    <select id="stg-turf-construction" name="construction">
                                        <option value="">— select —</option>
                                        @foreach([
                                            'sand_carpet'  => 'Sand carpet',
                                            'sand_profile' => 'Sand profile (USGA-style)',
                                            'pipe_drained' => 'Pipe drained + slit drained',
                                            'soil'         => 'Soil field',
                                            'hybrid'       => 'Hybrid reinforced',
                                        ] as $v => $l)
                                        <option value="{{ $v }}" {{ $turfVal('construction') === $v ? 'selected' : '' }}>{{ $l }}</option>
                                        @endforeach
                                    </select>
                                </div>
                                <div class="stg-field">
                                    <label for="stg-turf-soil-texture">Soil texture</label>
                                    <select id="stg-turf-soil-texture" name="soilTexture">
                                        @php $tex = $activeSite->soil_texture_override ?? ''; @endphp
                                        <option value="" {{ $tex === '' ? 'selected' : '' }}>— select —</option>
                                        @foreach([
                                            'sand'       => 'Sand / Sand rootzone',
                                            'loamy_sand' => 'Loamy Sand',
                                            'sandy_loam' => 'Sandy Loam',
                                            'loam'       => 'Loam',
                                            'clay_loam'  => 'Clay Loam',
                                            'clay'       => 'Clay',
                                        ] as $v => $l)
                                        <option value="{{ $v }}" {{ $tex === $v ? 'selected' : '' }}>{{ $l }}</option>
                                        @endforeach
                                    </select>
                                </div>
                                <div class="stg-field">
                                    <label for="stg-turf-drainage">Drainage</label>
                                    <select id="stg-turf-drainage" name="drainage">
                                        <option value="">— select —</option>
                                        @foreach([
                                            'excellent' => 'Excellent (>150 mm/hr)',
                                            'good'      => 'Good (100–150 mm/hr)',
                                            'moderate'  => 'Moderate (50–100 mm/hr)',
                                            'poor'      => 'Poor (<50 mm/hr)',
                                        ] as $v => $l)
                                        <option value="{{ $v }}" {{ $turfVal('drainage') === $v ? 'selected' : '' }}>{{ $l }}</option>
                                        @endforeach
                                    </select>
                                </div>
                                <div class="stg-field">
                                    <label for="stg-turf-hoc">Height of cut (mm)</label>
                                    <input type="number" id="stg-turf-hoc" name="hoc"
                                           value="{{ $turfVal('hoc') }}" min="1" max="150" step="0.5" placeholder="e.g. 3">
                                </div>
                            </div>
                        </div>

                        {{-- Block 3: Agronomic program --}}
                        <div class="stg-card" style="margin-bottom:16px">
                            <div class="stg-card-head">
                                <div class="stg-card-title">Soil interpretation & program</div>
                                <div class="stg-card-desc">How soil test results are interpreted and the annual nitrogen budget.</div>
                            </div>
                            <div class="stg-form-grid">
                                <div class="stg-field">
                                    <label for="stg-turf-methodology">Soil test methodology</label>
                                    <select id="stg-turf-methodology" name="methodology">
                                        <option value="">— select —</option>
                                        @php
                                            $methOptions = [
                                                'mlsn'             => 'MLSN — Minimum Levels for Sustainable Nutrition',
                                                'slan'             => 'SLAN — Sufficiency Level of Available Nutrients',
                                                'ammonium_acetate' => 'Ammonium Acetate (Hill Labs NZ)',
                                            ];
                                            $curMeth = $turfVal('methodology');
                                            // Also check site-level override as fallback
                                            if (!$curMeth) $curMeth = $activeSite->methodology_override ?? '';
                                        @endphp
                                        @foreach($methOptions as $v => $l)
                                        <option value="{{ $v }}" {{ $curMeth === $v ? 'selected' : '' }}>{{ $l }}</option>
                                        @endforeach
                                    </select>
                                    <p class="stg-field-hint">MLSN: validated for sand-based greens. SLAN: standard for sports fields, fairways, and lawns.</p>
                                </div>
                                <div class="stg-field">
                                    <label for="stg-turf-n">Annual nitrogen (kg/ha)</label>
                                    <input type="number" id="stg-turf-n" name="nProgram"
                                           value="{{ $turfVal('nProgram') }}" min="0" max="1000" step="1" placeholder="e.g. 150">
                                </div>
                            </div>
                        </div>

                        {{-- Block 4: Composition --}}
                        <div class="stg-card" style="margin-bottom:16px">
                            <div class="stg-card-head">
                                <div class="stg-card-title">Stand composition</div>
                                <div class="stg-card-desc">Only needed for mixed or overseeded stands. For a pure monoculture leave Overseed blank and set C3 cover to 0 or 100.</div>
                            </div>
                            <div class="stg-form-grid">
                                <div class="stg-field">
                                    <label for="stg-turf-cool-overseed">Overseed species</label>
                                    <select id="stg-turf-cool-overseed" name="overseedSpecies">
                                        <option value="">— none —</option>
                                        @foreach([
                                            'Warm-season (C4)' => ['Couch', 'Bermuda', 'Kikuyu', 'Zoysia', 'Seashore Paspalum', 'Buffalo'],
                                            'Cool-season (C3)' => ['Perennial Ryegrass', 'Annual Ryegrass', 'Tall Fescue', 'Fine Fescue', 'Kentucky Bluegrass', 'Creeping Bentgrass'],
                                        ] as $overseedGroup => $overseedSpecies)
                                        <optgroup label="{{ $overseedGroup }}">
                                            @foreach($overseedSpecies as $sp)
                                            <option value="{{ $sp }}" {{ $turfVal('overseedSpecies') === $sp ? 'selected' : '' }}>{{ $sp }}</option>
                                            @endforeach
                                        </optgroup>
                                        @endforeach
                                    </select>
                                    <p class="stg-field-hint">The grass species overseeded onto the base. Typically cool-season (C3) overseeded onto warm-season (C4) for winter play.</p>
                                </div>
                                <div class="stg-field">
                                    <label for="stg-turf-overseed-variety">Overseed variety</label>
                                    <select id="stg-turf-overseed-variety" name="overseedVariety">
                                        @php $overseedVar = $turfVal('overseedVariety', 'generic'); @endphp
                                        @foreach([
                                            'generic'          => 'Generic / Unknown',
                                            'RPR'              => 'RPR (Regenerating)',
                                            'Slugger 3GL'      => 'Slugger 3GL',
                                            'Derby Xtreme'     => 'Derby Xtreme',
                                            'SR 4700'          => 'SR 4700',
                                            'Karma'            => 'Karma',
                                            'Barolympic'       => 'Barolympic',
                                            'Barorlando'       => 'Barorlando',
                                            'Pinnacle 3'       => 'Pinnacle 3',
                                            'Premier 3'        => 'Premier 3',
                                            'Intense'          => 'Intense',
                                            'Grand Slam GLS'   => 'Grand Slam GLS',
                                            'APS'              => 'APS',
                                        ] as $v => $l)
                                        <option value="{{ $v }}" {{ $overseedVar === $v ? 'selected' : '' }}>{{ $l }}</option>
                                        @endforeach
                                    </select>
                                </div>
                                <div class="stg-field">
                                    <label for="stg-turf-overseed-status">Overseed status</label>
                                    <select id="stg-turf-overseed-status" name="overseedStatus">
                                        @foreach(['none' => 'None / not overseeded', 'establishing' => 'Establishing', 'established' => 'Established', 'dominant' => 'Dominant'] as $v => $l)
                                        <option value="{{ $v }}" {{ $turfVal('overseedStatus', 'none') === $v ? 'selected' : '' }}>{{ $l }}</option>
                                        @endforeach
                                    </select>
                                    <p class="stg-field-hint">Current state of the overseed component.</p>
                                </div>
                                <div class="stg-field" style="grid-column:1/-1">
                                    <label for="stg-turf-summer-intent">
                                        Summer management intent
                                        <button type="button" class="stg-info-icon" data-stg-info="summer-intent" aria-label="About summer management intent">i</button>
                                    </label>
                                    <select id="stg-turf-summer-intent" name="summerIntent">
                                        @php $summerIntent = $turfVal('summerIntent', 'transition'); @endphp
                                        <option value="transition" {{ $summerIntent === 'transition' ? 'selected' : '' }}>Transition — let overseed fade, support base grass recovery</option>
                                        <option value="maintain"   {{ $summerIntent === 'maintain'   ? 'selected' : '' }}>Maintain — keep overseed through summer (poor base coverage)</option>
                                    </select>
                                    <p class="stg-field-hint">Only relevant when overseed is active. Choose Maintain if base grass coverage is poor and the surface needs the overseed for playability.</p>
                                </div>
                                <div class="stg-field">
                                    <label for="stg-turf-poa">
                                        Poa annua content (%)
                                        <button type="button" class="stg-info-icon" data-stg-info="poa-percent" aria-label="About Poa annua">i</button>
                                    </label>
                                    <input type="number" id="stg-turf-poa" name="poaPercent"
                                           value="{{ $turfVal('poaPercent', '0') }}" min="0" max="100" step="1" placeholder="0">
                                    <p class="stg-field-hint">Estimated Poa annua percentage in the stand.</p>
                                </div>
                                <div class="stg-field">
                                    <label for="stg-turf-c3">
                                        C3 cover (%)
                                        <button type="button" class="stg-info-icon" data-stg-info="c3-cover" aria-label="About C3 cover">i</button>
                                    </label>
                                    <input type="number" id="stg-turf-c3" name="c3Cover"
                                           value="{{ $turfVal('c3Cover', '0') }}" min="0" max="100" step="1" placeholder="0">
                                    <p class="stg-field-hint">Percentage of surface covered by cool-season (C3) grass. 0 = pure C4, 100 = pure C3.</p>
                                </div>
                            </div>
                        </div>

                        {{-- Block 5: Site history --}}
                        <div class="stg-card" style="margin-bottom:16px">
                            <div class="stg-card-head">
                                <div class="stg-card-title">Site history</div>
                                <div class="stg-card-desc">Used in disease risk modelling. Set once and update annually — doesn't change often.</div>
                            </div>
                            <div class="stg-form-grid">
                                <div class="stg-field">
                                    <label for="stg-turf-years">
                                        Years established
                                        <button type="button" class="stg-info-icon" data-stg-info="site-years" aria-label="About years established">i</button>
                                    </label>
                                    <input type="number" id="stg-turf-years" name="yearsEstablished"
                                           value="{{ $turf['siteHistory']['yearsEstablished'] ?? '' }}" min="0" max="100" step="1" placeholder="e.g. 5">
                                </div>
                                <div class="stg-field">
                                    <label for="stg-turf-thatch">
                                        Thatch depth (mm)
                                        <button type="button" class="stg-info-icon" data-stg-info="site-thatch" aria-label="About thatch depth">i</button>
                                    </label>
                                    <input type="number" id="stg-turf-thatch" name="thatchDepth"
                                           value="{{ $turf['siteHistory']['thatchDepth'] ?? '' }}" min="0" max="100" step="1" placeholder="e.g. 12">
                                </div>
                                <div class="stg-field">
                                    <label for="stg-turf-wintermin">
                                        Winter min temp (°C)
                                        <button type="button" class="stg-info-icon" data-stg-info="site-wintermin" aria-label="About winter minimum temperature">i</button>
                                    </label>
                                    <input type="number" id="stg-turf-wintermin" name="winterMinTemp"
                                           value="{{ $turf['siteHistory']['winterMinTemp'] ?? '' }}" step="0.5" placeholder="e.g. -2">
                                </div>
                            </div>
                        </div>

                        {{-- Block 6: Light enhancement --}}
                        <div class="stg-card" style="margin-bottom:24px">
                            <div class="stg-card-head">
                                <div class="stg-card-title">Artificial light (optional)</div>
                                <div class="stg-card-desc">Only required for covered or partially enclosed venues using supplemental LED lighting.</div>
                            </div>
                            <div class="stg-form-grid">
                                <div class="stg-field">
                                    <label for="stg-turf-led-ppfd">
                                        LED PPFD (µmol/m²/s)
                                        <button type="button" class="stg-info-icon" data-stg-info="led-ppfd" aria-label="About LED PPFD">i</button>
                                    </label>
                                    <input type="number" id="stg-turf-led-ppfd" name="ledPpfd"
                                           value="{{ $activeGaipConfig['turf']['led']['ppfd'] ?? '' }}" min="0" step="10" placeholder="e.g. 800">
                                </div>
                                <div class="stg-field">
                                    <label for="stg-turf-led-hours">
                                        LED hours per day
                                        <button type="button" class="stg-info-icon" data-stg-info="led-hours" aria-label="About LED hours">i</button>
                                    </label>
                                    <input type="number" id="stg-turf-led-hours" name="ledHours"
                                           value="{{ $activeGaipConfig['turf']['led']['hours'] ?? '' }}" min="0" max="24" step="0.5" placeholder="e.g. 8">
                                </div>
                            </div>
                        </div>

                        <div class="stg-actions">
                            <button type="submit" class="stg-btn-primary" id="stg-turf-save">Save turf profile</button>
                            <span class="stg-msg" id="stg-turf-msg" hidden></span>
                        </div>

                    </form>
                </div>

                {{-- ── Traffic & Wear (sports fields only) ─────────── --}}
                <div class="stg-panel stg-hidden" id="stg-tab-traffic" role="tabpanel"
                    @if(($activeGaipConfig['turf']['turfType'] ?? '') !== 'sports') style="display:none" @endif
                >
                    <form id="stg-traffic-form" class="stg-form" novalidate>

                        <div class="stg-card" style="margin-bottom:16px">
                            <div class="stg-card-head">
                                <div class="stg-card-title">Match schedule</div>
                                <div class="stg-card-desc">Applies to sports fields. Drives wear recovery and compaction risk calculations.</div>
                            </div>
                            <div class="stg-form-grid" style="grid-template-columns:repeat(2,1fr)">
                                <div class="stg-field">
                                    <label for="stg-tw-sport">Sport</label>
                                    <select id="stg-tw-sport">
                                        <option value="soccer">Soccer</option>
                                        <option value="afl">AFL</option>
                                        <option value="rugby_union">Rugby Union</option>
                                        <option value="rugby_league">Rugby League</option>
                                        <option value="cricket">Cricket</option>
                                    </select>
                                </div>
                                <div class="stg-field">
                                    <label for="stg-tw-matches">Matches per week</label>
                                    <input type="number" id="stg-tw-matches" min="0" max="14" step="1" placeholder="2">
                                </div>
                                <div class="stg-field">
                                    <label for="stg-tw-match-dur">Match duration (hrs)</label>
                                    <input type="number" id="stg-tw-match-dur" min="0.5" max="4" step="0.25" placeholder="1.5">
                                </div>
                                <div class="stg-field">
                                    <label for="stg-tw-age-group">Player age group</label>
                                    <select id="stg-tw-age-group">
                                        <option value="junior">Junior (U12)</option>
                                        <option value="youth">Youth (12–17)</option>
                                        <option value="adult" selected>Adult (18–35)</option>
                                        <option value="masters">Masters (35+)</option>
                                    </select>
                                </div>
                                <div class="stg-field">
                                    <label for="stg-tw-squad-size">Typical squad size</label>
                                    <select id="stg-tw-squad-size">
                                        <option value="small">Small (&lt;15 players)</option>
                                        <option value="medium" selected>Medium (15–30 players)</option>
                                        <option value="large">Large (&gt;30 players)</option>
                                    </select>
                                </div>
                            </div>
                        </div>

                        <div class="stg-card" style="margin-bottom:16px">
                            <div class="stg-card-head">
                                <div class="stg-card-title">Training schedule</div>
                            </div>
                            <div class="stg-form-grid" style="grid-template-columns:repeat(2,1fr)">
                                <div class="stg-field">
                                    <label for="stg-tw-train-type">Training type</label>
                                    <select id="stg-tw-train-type">
                                        <option value="full">Full training / match sim</option>
                                        <option value="skills" selected>Skills &amp; Drills</option>
                                        <option value="light">Light training</option>
                                    </select>
                                </div>
                                <div class="stg-field">
                                    <label for="stg-tw-sessions">Sessions per week</label>
                                    <input type="number" id="stg-tw-sessions" min="0" max="14" step="1" placeholder="3">
                                </div>
                                <div class="stg-field">
                                    <label for="stg-tw-session-dur">Session duration (hrs)</label>
                                    <input type="number" id="stg-tw-session-dur" min="0.25" max="4" step="0.25" placeholder="1.5">
                                </div>
                                <div class="stg-field">
                                    <label for="stg-tw-area-pct">Training area used (%)</label>
                                    <input type="number" id="stg-tw-area-pct" min="10" max="100" step="5" placeholder="100">
                                </div>
                                <div class="stg-field">
                                    <label for="stg-tw-rest-days">Rest days per week</label>
                                    <input type="number" id="stg-tw-rest-days" min="0" max="7" step="1" placeholder="2">
                                </div>
                            </div>
                        </div>

                        <div class="stg-card" style="margin-bottom:16px">
                            <div class="stg-card-head">
                                <div class="stg-card-title">Current conditions</div>
                            </div>
                            <div class="stg-form-grid" style="grid-template-columns:repeat(2,1fr)">
                                <div class="stg-field">
                                    <label for="stg-tw-moisture">Current soil moisture</label>
                                    <select id="stg-tw-moisture">
                                        <option value="dry">Dry</option>
                                        <option value="slightly_dry">Slightly Dry</option>
                                        <option value="optimal" selected>Optimal</option>
                                        <option value="moist">Moist</option>
                                        <option value="wet">Wet</option>
                                        <option value="saturated">Saturated</option>
                                    </select>
                                </div>
                                <div class="stg-field">
                                    <label for="stg-tw-root-depth">Est. root depth (mm)</label>
                                    <input type="number" id="stg-tw-root-depth" min="20" max="300" step="5" placeholder="100">
                                </div>
                            </div>
                        </div>

                        <div class="stg-card" style="margin-bottom:16px">
                            <div class="stg-card-head">
                                <div class="stg-card-title">Prior usage history</div>
                                <div class="stg-card-desc">Enter total match + training hours from recent weeks to calculate cumulative wear.</div>
                            </div>
                            <div class="stg-form-grid" style="grid-template-columns:repeat(4,1fr)">
                                <div class="stg-field">
                                    <label for="stg-tw-h1">Last week (hrs)</label>
                                    <input type="number" id="stg-tw-h1" min="0" step="0.5" placeholder="—">
                                </div>
                                <div class="stg-field">
                                    <label for="stg-tw-h2">2 weeks ago (hrs)</label>
                                    <input type="number" id="stg-tw-h2" min="0" step="0.5" placeholder="—">
                                </div>
                                <div class="stg-field">
                                    <label for="stg-tw-h3">3 weeks ago (hrs)</label>
                                    <input type="number" id="stg-tw-h3" min="0" step="0.5" placeholder="—">
                                </div>
                                <div class="stg-field">
                                    <label for="stg-tw-h4">4 weeks ago (hrs)</label>
                                    <input type="number" id="stg-tw-h4" min="0" step="0.5" placeholder="—">
                                </div>
                            </div>
                        </div>

                        <div class="stg-card" style="margin-bottom:16px">
                            <div class="stg-card-head">
                                <div class="stg-card-title">Surface hardness — optional</div>
                                <div class="stg-card-desc">Clegg hammer readings (2.25 kg @ 450 mm). Typical: 60–90 Gmax. Does not block analysis.</div>
                            </div>
                            <div class="stg-form-grid" style="grid-template-columns:repeat(3,1fr)">
                                <div class="stg-field">
                                    <label for="stg-tw-clegg-mean">Mean Gmax</label>
                                    <input type="number" id="stg-tw-clegg-mean" min="0" max="300" step="1" placeholder="e.g. 75">
                                </div>
                                <div class="stg-field">
                                    <label for="stg-tw-clegg-hard">Hardest zone</label>
                                    <input type="number" id="stg-tw-clegg-hard" min="0" max="300" step="1" placeholder="e.g. goalmouth">
                                </div>
                                <div class="stg-field">
                                    <label for="stg-tw-clegg-soft">Softest zone</label>
                                    <input type="number" id="stg-tw-clegg-soft" min="0" max="300" step="1" placeholder="e.g. wing area">
                                </div>
                            </div>
                        </div>

                        <div class="stg-form-actions">
                            <button type="submit" class="stg-btn-primary" id="stg-traffic-save">Save traffic schedule</button>
                            <span class="stg-save-msg" id="stg-traffic-msg" hidden></span>
                            <span class="stg-form-hint">After saving, go to the <a href="/plan#recovery">Plan → Recovery</a> tab and re-run the analysis to update recovery forecasts.</span>
                        </div>

                    </form>
                </div>

                {{-- ── Zones ────────────────────────────────────────── --}}
                <div class="stg-panel stg-hidden" id="stg-tab-zones" role="tabpanel">
                    <div class="stg-card">
                        <div class="stg-card-head">
                            <div class="stg-card-title">Zones</div>
                            <div class="stg-card-desc">Named areas on this site — used when logging soil, tissue, and spray data.</div>
                        </div>

                        <div class="stg-zone-list" id="stg-zone-list">
                            {{-- populated by JS --}}
                        </div>

                        <div class="stg-zone-add">
                            <input type="text" id="stg-zone-input"
                                   placeholder="New zone name (e.g. Greens)"
                                   maxlength="60" class="stg-zone-input">
                            <button type="button" class="stg-btn-secondary" id="stg-zone-add-btn">Add</button>
                        </div>

                        <div class="stg-actions" style="margin-top:24px">
                            <button type="button" class="stg-btn-primary" id="stg-zones-save">Save zones</button>
                            <span class="stg-msg" id="stg-zones-msg" hidden></span>
                        </div>
                    </div>
                </div>

                {{-- ── Import ───────────────────────────────────────── --}}
                <div class="stg-panel stg-hidden" id="stg-tab-import" role="tabpanel">
                    <div class="stg-card">
                        <div class="stg-card-head">
                            <div class="stg-card-title">Import from old portal</div>
                            <div class="stg-card-desc">
                                Upload the <code>.json</code> file you exported from the previous GAIP Hub
                                (use the <strong>Export</strong> button on the old portal to get the file).
                            </div>
                            <div style="display:flex;align-items:flex-start;gap:8px;margin-top:10px;padding:10px 12px;background:#fff8ed;border:1px solid #f59e0b;border-radius:6px;font-size:13px;color:#92400e;line-height:1.4">
                                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="flex-shrink:0;margin-top:1px"><path d="M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z"/><line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/></svg>
                                <span>All existing data for this site will be replaced with data from the file.</span>
                            </div>
                        </div>

                        {{-- Step 1: file picker --}}
                        <div id="imp-step-idle">
                            <label class="imp-file-label" id="imp-file-label" for="imp-file-input">
                                <svg width="18" height="18" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2" style="flex-shrink:0">
                                    <path stroke-linecap="round" stroke-linejoin="round" d="M3 16.5v2.25A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75V16.5m-13.5-9L12 3m0 0l4.5 4.5M12 3v13.5"/>
                                </svg>
                                <span id="imp-file-name">Choose .json file…</span>
                            </label>
                            <input type="file" id="imp-file-input" accept=".json" style="display:none">
                        </div>

                        {{-- Step 2: preview (hidden until file chosen) --}}
                        <div id="imp-step-preview" class="stg-hidden">
                            <div class="imp-found-table" id="imp-found-table"></div>
                            <div class="imp-target-note" id="imp-target-note"></div>
                            <div class="stg-actions" style="margin-top:20px">
                                <button type="button" class="stg-btn-primary" id="imp-run-btn">Import to this site</button>
                                <button type="button" class="stg-btn-secondary" id="imp-cancel-btn">Choose a different file</button>
                                <span class="stg-msg" id="imp-msg" hidden></span>
                            </div>
                        </div>

                        {{-- Step 3: done --}}
                        <div id="imp-step-done" class="stg-hidden">
                            <div class="imp-success" id="imp-success-msg"></div>
                            <div class="stg-actions" style="margin-top:16px">
                                <button type="button" class="stg-btn-secondary" id="imp-again-btn">Import another file</button>
                            </div>
                        </div>
                    </div>
                </div>

                {{-- ── Integrations ─────────────────────────────────── --}}
                <div class="stg-panel stg-hidden" id="stg-tab-integrations" role="tabpanel">

                    <div class="sens-providers">

                        {{-- Hydrosight --}}
                        <div class="sens-provider-card">
                            <div class="sens-provider-header">
                                <div class="sens-provider-icon">
                                    <svg width="18" height="18" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
                                        <path stroke-linecap="round" stroke-linejoin="round" d="M8.111 16.404a5.5 5.5 0 017.778 0M12 20h.01m-2.667-5.596a3 3 0 014.334 0M5.636 12.364a9.5 9.5 0 0112.728 0"/>
                                    </svg>
                                </div>
                                <div class="sens-provider-info">
                                    <div class="sens-provider-name">Hydrosight</div>
                                    <div class="sens-provider-desc">Wireless buried TDR sensors. Reads VWC, EC and soil temperature per zone.</div>
                                </div>
                                <span class="sens-status-badge" id="sens-hs-badge">Not configured</span>
                            </div>
                            <div class="sens-provider-body" id="sens-hs-body">
                                <label class="sens-label" for="sens-hs-key">API Key</label>
                                <div class="sens-key-row">
                                    <div style="position:relative;flex:1">
                                        <input type="password" class="sens-input" id="sens-hs-key" placeholder="Enter your Hydrosight API key" autocomplete="new-password" spellcheck="false" style="width:100%;padding-right:36px">
                                        <button type="button" class="sens-eye-btn" data-target="sens-hs-key" style="position:absolute;right:8px;top:50%;transform:translateY(-50%);background:none;border:none;cursor:pointer;color:#6b8878;padding:2px;line-height:0" tabindex="-1" aria-label="Show/hide key">
                                            <svg class="pw-eye-show" width="16" height="16" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2"><path stroke-linecap="round" stroke-linejoin="round" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z"/><path stroke-linecap="round" stroke-linejoin="round" d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z"/></svg>
                                            <svg class="pw-eye-hide" width="16" height="16" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2" style="display:none"><path stroke-linecap="round" stroke-linejoin="round" d="M13.875 18.825A10.05 10.05 0 0112 19c-4.478 0-8.268-2.943-9.543-7a9.97 9.97 0 011.563-3.029m5.858.908a3 3 0 114.243 4.243M9.878 9.878l4.242 4.242M9.88 9.88l-3.29-3.29m7.532 7.532l3.29 3.29M3 3l3.59 3.59m0 0A9.953 9.953 0 0112 5c4.478 0 8.268 2.943 9.543 7a10.025 10.025 0 01-4.132 5.411m0 0L21 21"/></svg>
                                        </button>
                                    </div>
                                    <button class="sens-test-btn" id="sens-hs-test" type="button">Test &amp; Save</button>
                                </div>
                                <div class="sens-field-msg" id="sens-hs-msg"></div>
                                <button class="sens-disconnect-btn" id="sens-hs-disconnect" type="button" style="display:none">Disconnect</button>
                            </div>
                            <div class="sens-sensor-list" id="sens-hs-list" style="display:none">
                                <div class="sens-sensor-list-head">Connected Sensors</div>
                            </div>
                        </div>

                        {{-- SpecConnect --}}
                        <div class="sens-provider-card">
                            <div class="sens-provider-header">
                                <div class="sens-provider-icon">
                                    <svg width="18" height="18" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
                                        <path stroke-linecap="round" stroke-linejoin="round" d="M9 3H5a2 2 0 0 0-2 2v4m6-6h10a2 2 0 0 1 2 2v4M9 3v18m0 0h10a2 2 0 0 0 2-2v-4M9 21H5a2 2 0 0 1-2-2v-4m0 0h18"/>
                                    </svg>
                                </div>
                                <div class="sens-provider-info">
                                    <div class="sens-provider-name">SpecConnect</div>
                                    <div class="sens-provider-desc">TDR 350/300 FieldScout spatial readings. Session-based soil scanning via portable probe.</div>
                                </div>
                                <span class="sens-status-badge" id="sens-sc-badge">Not configured</span>
                            </div>
                            <div class="sens-provider-body" id="sens-sc-body">
                                <label class="sens-label" for="sens-sc-key">API Key</label>
                                <div class="sens-key-row">
                                    <div style="position:relative;flex:1">
                                        <input type="password" class="sens-input" id="sens-sc-key" placeholder="Enter your SpecConnect API key" autocomplete="new-password" spellcheck="false" style="width:100%;padding-right:36px">
                                        <button type="button" class="sens-eye-btn" data-target="sens-sc-key" style="position:absolute;right:8px;top:50%;transform:translateY(-50%);background:none;border:none;cursor:pointer;color:#6b8878;padding:2px;line-height:0" tabindex="-1" aria-label="Show/hide key">
                                            <svg class="pw-eye-show" width="16" height="16" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2"><path stroke-linecap="round" stroke-linejoin="round" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z"/><path stroke-linecap="round" stroke-linejoin="round" d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z"/></svg>
                                            <svg class="pw-eye-hide" width="16" height="16" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2" style="display:none"><path stroke-linecap="round" stroke-linejoin="round" d="M13.875 18.825A10.05 10.05 0 0112 19c-4.478 0-8.268-2.943-9.543-7a9.97 9.97 0 011.563-3.029m5.858.908a3 3 0 114.243 4.243M9.878 9.878l4.242 4.242M9.88 9.88l-3.29-3.29m7.532 7.532l3.29 3.29M3 3l3.59 3.59m0 0A9.953 9.953 0 0112 5c4.478 0 8.268 2.943 9.543 7a10.025 10.025 0 01-4.132 5.411m0 0L21 21"/></svg>
                                        </button>
                                    </div>
                                    <button class="sens-test-btn" id="sens-sc-test" type="button">Test &amp; Save</button>
                                </div>
                                <div class="sens-field-msg" id="sens-sc-msg"></div>
                                <button class="sens-disconnect-btn" id="sens-sc-disconnect" type="button" style="display:none">Disconnect</button>
                            </div>
                            <div class="sens-sensor-list" id="sens-sc-list" style="display:none">
                                <div class="sens-sensor-list-head">Connected Equipment</div>
                            </div>
                        </div>

                    </div>{{-- /sens-providers --}}

                </div>{{-- /integrations panel --}}

                @endif

            </div>{{-- /stg-wrap --}}
        </div>{{-- /db-content --}}

@endsection

{{-- Info popover (shared across all settings tabs) --}}
<div id="stg-info-popover" class="stg-info-popover" style="display:none" role="tooltip" aria-live="polite">
    <div id="stg-info-popover-arrow" class="stg-info-popover-arrow"></div>
    <button id="stg-info-popover-close" class="stg-info-popover-close" aria-label="Close">&times;</button>
    <div id="stg-info-popover-title" class="stg-info-popover-title"></div>
    <p  id="stg-info-popover-body"  class="stg-info-popover-body"></p>
</div>

@section('scripts')
@if($activeSite)
<script>
window.STG_DATA = {
    activeSiteId:         @json($activeSite->id),
    zones:                @json($activeSite->attributes_json['zones'] ?? []),
    csrfToken:            @json(csrf_token()),
    apiBase:              @json(url('/api')),
    gaipConfig:           @json($activeGaipConfig),
    activeSiteRole:       @json($activeSiteRole),
};
</script>
<script src="{{ $legacyAssetUrl('gilba-variety-traits.js') }}"></script>
<script src="{{ $legacyAssetUrl('settings-init.js') }}"></script>
@endif

@endsection

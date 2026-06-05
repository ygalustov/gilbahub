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
                    <button class="stg-tab active" role="tab" data-tab="sites"        aria-selected="true" >Sites</button>
                    <button class="stg-tab"         role="tab" data-tab="site"         aria-selected="false">Site settings</button>
                    <button class="stg-tab"         role="tab" data-tab="turf"         aria-selected="false">Turf profile</button>
                    <button class="stg-tab"         role="tab" data-tab="zones"        aria-selected="false">Zones</button>
                    <button class="stg-tab"         role="tab" data-tab="import"       aria-selected="false">Import</button>
                    <button class="stg-tab"         role="tab" data-tab="integrations" aria-selected="false">Integrations</button>
                    @if(in_array($activeSiteRole, ['admin', 'manager']))
                    <button class="stg-tab"         role="tab" data-tab="users"        aria-selected="false">Users</button>
                    @endif
                    <button class="stg-tab"         role="tab" data-tab="profile"      aria-selected="false">Profile</button>
                </div>

                {{-- ── Sites ────────────────────────────────────────── --}}
                <div class="stg-panel" id="stg-tab-sites" role="tabpanel">
                    <div class="stg-sites-head">
                        <h2 class="stg-sites-title">All sites</h2>
                        <button type="button" class="stg-btn-primary stg-sites-add-btn" id="stg-add-site-btn">
                            <svg width="13" height="13" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2.5"><path stroke-linecap="round" stroke-linejoin="round" d="M12 4v16m8-8H4"/></svg>
                            Add site
                        </button>
                    </div>

                    {{-- Add-site inline form (hidden by default) --}}
                    <div class="stg-add-site-form stg-hidden" id="stg-add-site-form">
                        <div class="stg-add-site-form-inner">
                            <input type="text" id="stg-new-site-name" class="stg-input" placeholder="Site name" maxlength="255">
                            <select id="stg-new-site-type" class="stg-select">
                                <option value="precinct">General</option>
                                <option value="golf">Golf</option>
                                <option value="sports">Sports</option>
                                <option value="bowls">Bowls</option>
                                <option value="lawns">Lawns</option>
                            </select>
                            <button type="button" class="stg-btn-primary" id="stg-add-site-save-btn">Create</button>
                            <button type="button" class="stg-btn-ghost" id="stg-add-site-cancel-btn">Cancel</button>
                        </div>
                    </div>

                    {{-- Onboarding prompt — shown after new site is created --}}
                    <div id="stg-onboard-prompt" class="stg-hidden" style="margin-bottom:12px;padding:14px 16px;background:var(--gaip-surface-muted,#f3f7f5);border:1px solid var(--gaip-border,#d1dbd6);border-radius:8px;display:flex;align-items:center;gap:12px">
                        <svg width="16" height="16" fill="none" viewBox="0 0 24 24" stroke="var(--gaip-accent,#2da85e)" stroke-width="2" style="flex-shrink:0"><path stroke-linecap="round" stroke-linejoin="round" d="M9 12l2 2 4-4M7.835 4.697a3.42 3.42 0 001.946-.806 3.42 3.42 0 014.438 0 3.42 3.42 0 001.946.806 3.42 3.42 0 013.138 3.138 3.42 3.42 0 00.806 1.946 3.42 3.42 0 010 4.438 3.42 3.42 0 00-.806 1.946 3.42 3.42 0 01-3.138 3.138 3.42 3.42 0 00-1.946.806 3.42 3.42 0 01-4.438 0 3.42 3.42 0 00-1.946-.806 3.42 3.42 0 01-3.138-3.138 3.42 3.42 0 00-.806-1.946 3.42 3.42 0 010-4.438 3.42 3.42 0 00.806-1.946 3.42 3.42 0 013.138-3.138z"/></svg>
                        <div style="flex:1;font-size:13px;color:var(--gaip-text,#17231f)">
                            Site created. Would you like to configure it now?
                        </div>
                        <button type="button" id="stg-onboard-yes" class="stg-btn-primary" style="white-space:nowrap">Quick Setup</button>
                        <button type="button" id="stg-onboard-no"  class="stg-btn-ghost"  style="white-space:nowrap">Do it later</button>
                    </div>

                    <div class="dat-table-wrap" style="padding:0;overflow-x:auto">
                        <table class="dat-table stg-sites-table" id="stg-sites-table">
                            <thead>
                                <tr>
                                    <th class="stg-st-sortable" data-col="name">Site <svg class="stg-sort-icon" width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><path d="M12 5v14M5 12l7-7 7 7"/></svg></th>
                                    <th class="stg-st-sortable" data-col="location">Location <svg class="stg-sort-icon" width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><path d="M12 5v14M5 12l7-7 7 7"/></svg></th>
                                    <th class="stg-st-sortable" data-col="species">Grass <svg class="stg-sort-icon" width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><path d="M12 5v14M5 12l7-7 7 7"/></svg></th>
                                    <th class="stg-st-sortable dat-th-num" data-col="soil">Soil <svg class="stg-sort-icon" width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><path d="M12 5v14M5 12l7-7 7 7"/></svg></th>
                                    <th class="stg-st-sortable dat-th-num" data-col="water">Water <svg class="stg-sort-icon" width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><path d="M12 5v14M5 12l7-7 7 7"/></svg></th>
                                    <th class="stg-st-sortable" data-col="last_run">Last run <svg class="stg-sort-icon" width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><path d="M12 5v14M5 12l7-7 7 7"/></svg></th>
                                    <th style="width:44px"></th>
                                </tr>
                            </thead>
                            <tbody id="stg-sites-tbody">
                                {{-- Rendered by JS --}}
                            </tbody>
                        </table>
                    </div>

                    {{-- Detail panel (same pattern as Data page) --}}
                    <div id="stg-site-detail" class="dat-detail" style="display:none" aria-live="polite">
                        <div class="dat-detail-header">
                            <div>
                                <div class="dat-detail-title" id="stg-detail-title">—</div>
                                <div class="dat-detail-subtitle" id="stg-detail-subtitle"></div>
                            </div>
                            <div class="dat-detail-actions">
                                <button class="dat-detail-close" id="stg-detail-close" aria-label="Close">×</button>
                            </div>
                        </div>
                        <div id="stg-detail-body" class="dat-detail-body"></div>
                    </div>
                </div>

                {{-- ── Site settings ────────────────────────────────── --}}
                <div class="stg-panel stg-hidden" id="stg-tab-site" role="tabpanel">
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
                                           value="{{ $activeSite->location_name ?? '' }}"
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
                                           value="{{ $activeSite->latitude ?? '' }}"
                                           step="0.0000001" min="-90" max="90" placeholder="-33.8688">
                                </div>
                                <div class="stg-field">
                                    <label for="stg-longitude">Longitude</label>
                                    <input type="number" id="stg-longitude" name="longitude"
                                           value="{{ $activeSite->longitude ?? '' }}"
                                           step="0.0000001" min="-180" max="180" placeholder="151.2093">
                                </div>
                                <div class="stg-field">
                                    <label>Hemisphere</label>
                                    <input type="text" id="stg-hemisphere" readonly
                                           value="{{ isset($activeSite->latitude) ? ($activeSite->latitude < 0 ? 'Southern' : 'Northern') : '' }}"
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
                                    <input type="password" class="sens-input" id="sens-hs-key" placeholder="Enter your Hydrosight API key" autocomplete="new-password" spellcheck="false">
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
                                    <input type="password" class="sens-input" id="sens-sc-key" placeholder="Enter your SpecConnect API key" autocomplete="new-password" spellcheck="false">
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

                @if(in_array($activeSiteRole, ['admin', 'manager']))
                {{-- ── Users panel ─────────────────────────────────── --}}
                <div class="stg-panel stg-hidden" id="stg-tab-users" role="tabpanel">
                    <div id="users-root">

                        @if($activeSiteRole === 'admin')
                        {{-- Admin: tabs Active / Pending / Suspended --}}
                        <div class="stg-sites-head" style="margin-bottom:16px">
                            <h2 class="stg-sites-title">Users</h2>
                            <button type="button" class="stg-btn-primary" id="users-invite-btn">
                                <svg width="13" height="13" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2.5"><path stroke-linecap="round" stroke-linejoin="round" d="M12 4v16m8-8H4"/></svg>
                                Invite
                            </button>
                        </div>
                        <div style="display:flex;gap:4px;margin-bottom:20px" id="users-admin-tabs">
                            <button class="stg-tab active" data-utab="active">Active</button>
                            <button class="stg-tab" data-utab="pending">Pending <span id="users-pending-count" style="display:none" class="badge"></span></button>
                            <button class="stg-tab" data-utab="suspended">Suspended</button>
                        </div>
                        @else
                        {{-- Manager: simple header --}}
                        <div class="stg-sites-head" style="margin-bottom:16px">
                            <h2 class="stg-sites-title">Users</h2>
                            <button type="button" class="stg-btn-primary" id="users-invite-btn">
                                <svg width="13" height="13" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2.5"><path stroke-linecap="round" stroke-linejoin="round" d="M12 4v16m8-8H4"/></svg>
                                Invite
                            </button>
                        </div>
                        @endif

                        {{-- Search + filters --}}
                        <div style="display:flex;gap:10px;align-items:center;margin-bottom:16px;flex-wrap:wrap" id="users-filters">
                            <input type="text" id="users-search" class="stg-input" placeholder="{{ $activeSiteRole === 'admin' ? 'Search by name, email or site…' : 'Search by name or email…' }}" style="flex:1;min-width:180px;max-width:320px">
                            @if($activeSiteRole === 'admin')
                            <select id="users-site-filter" class="stg-select" style="min-width:160px">
                                <option value="">All sites</option>
                            </select>
                            @endif
                            <select id="users-role-filter" class="stg-select">
                                <option value="">All roles</option>
                                <option value="manager">Manager</option>
                                <option value="editor">Editor</option>
                                <option value="viewer">Viewer</option>
                            </select>
                        </div>

                        {{-- Members table --}}
                        <div id="users-active-panel">
                            <div class="dat-table-wrap" style="padding:0;overflow-x:auto">
                                <table class="dat-table" id="users-table">
                                    <thead>
                                        <tr>
                                            <th>Name</th>
                                            <th>Email</th>
                                            @if($activeSiteRole === 'admin')<th>Site</th>@endif
                                            <th>Role</th>
                                            <th style="width:40px"></th>
                                        </tr>
                                    </thead>
                                    <tbody id="users-tbody">
                                        <tr><td colspan="{{ $activeSiteRole === 'admin' ? 5 : 4 }}" style="text-align:center;padding:24px;color:#6b8878">Loading…</td></tr>
                                    </tbody>
                                </table>
                            </div>

                            {{-- Pending invitations --}}
                            <div id="users-invitations-section" style="margin-top:28px;display:none">
                                <h3 style="font-size:13px;font-weight:600;color:#3d5c4a;margin-bottom:12px">Pending invitations</h3>
                                <div class="dat-table-wrap" style="padding:0;overflow-x:auto">
                                    <table class="dat-table">
                                        <tbody id="users-invitations-tbody"></tbody>
                                    </table>
                                </div>
                            </div>

                            {{-- Empty state --}}
                            <div id="users-empty" style="display:none;text-align:center;padding:40px 24px;color:#6b8878">
                                <svg width="32" height="32" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="1.5" style="margin:0 auto 12px;display:block;color:#a8c4b2"><path stroke-linecap="round" stroke-linejoin="round" d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0z"/></svg>
                                <div style="font-weight:600;margin-bottom:6px">No other users on this site yet.</div>
                                <div style="font-size:13px">Invite a manager, editor, or viewer to collaborate.</div>
                                <button type="button" class="stg-btn-primary" id="users-invite-empty-btn" style="margin-top:16px">+ Invite someone</button>
                            </div>
                        </div>

                        @if($activeSiteRole === 'admin')
                        {{-- Pending users panel --}}
                        <div id="users-pending-panel" style="display:none">
                            <div class="dat-table-wrap" style="padding:0;overflow-x:auto">
                                <table class="dat-table">
                                    <thead>
                                        <tr><th>Name</th><th>Email</th><th>Registered</th><th style="width:160px"></th></tr>
                                    </thead>
                                    <tbody id="users-pending-tbody">
                                        <tr><td colspan="4" style="text-align:center;padding:24px;color:#6b8878">No pending registrations.</td></tr>
                                    </tbody>
                                </table>
                            </div>
                        </div>

                        {{-- Suspended users panel --}}
                        <div id="users-suspended-panel" style="display:none">
                            <div class="dat-table-wrap" style="padding:0;overflow-x:auto">
                                <table class="dat-table">
                                    <thead>
                                        <tr><th>Name</th><th>Email</th><th style="width:120px"></th></tr>
                                    </thead>
                                    <tbody id="users-suspended-tbody">
                                        <tr><td colspan="3" style="text-align:center;padding:24px;color:#6b8878">No suspended accounts.</td></tr>
                                    </tbody>
                                </table>
                            </div>
                        </div>
                        @endif

                    </div>{{-- /users-root --}}

                    {{-- Invite modal --}}
                    <div id="users-invite-modal" style="display:none;position:fixed;inset:0;background:rgba(0,0,0,0.4);z-index:1000;align-items:center;justify-content:center">
                        <div style="background:#fff;border-radius:12px;padding:32px;width:100%;max-width:440px;box-shadow:0 8px 32px rgba(0,0,0,0.16);font-family:'Barlow',sans-serif;font-size:14px">
                            <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:24px">
                                <h3 id="invite-modal-title" style="font-size:16px;font-weight:700;color:#1a2b23;margin:0">Invite user</h3>
                                <button type="button" id="invite-modal-close" style="background:none;border:none;cursor:pointer;color:#6b8878;padding:4px">
                                    <svg width="18" height="18" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2"><path stroke-linecap="round" stroke-linejoin="round" d="M6 18L18 6M6 6l12 12"/></svg>
                                </button>
                            </div>

                            <div style="margin-bottom:16px">
                                <label style="display:block;font-size:13px;font-weight:600;color:#3d5c4a;margin-bottom:6px">Email</label>
                                <input type="email" id="invite-email" class="stg-input" style="width:100%" placeholder="colleague@example.com">
                            </div>

                            @if($activeSiteRole === 'admin')
                            <div style="margin-bottom:16px">
                                <label style="display:block;font-size:13px;font-weight:600;color:#3d5c4a;margin-bottom:6px">Site</label>
                                <select id="invite-site" class="stg-select" style="width:100%">
                                    <option value="">Select site…</option>
                                </select>
                            </div>
                            @endif

                            <div style="margin-bottom:24px">
                                <label style="display:block;font-size:13px;font-weight:600;color:#3d5c4a;margin-bottom:10px">Role</label>
                                <div style="display:flex;flex-direction:column;gap:8px">
                                    <label style="display:flex;align-items:center;gap:8px;cursor:pointer"><input type="radio" name="invite-role" value="manager"> Manager</label>
                                    <label style="display:flex;align-items:center;gap:8px;cursor:pointer"><input type="radio" name="invite-role" value="editor" checked> Editor</label>
                                    <label style="display:flex;align-items:center;gap:8px;cursor:pointer"><input type="radio" name="invite-role" value="viewer"> Viewer</label>
                                </div>
                            </div>

                            <div id="invite-modal-error" style="display:none;margin-bottom:12px;font-size:13px;color:#dc2626"></div>

                            <div style="display:flex;gap:10px">
                                <button type="button" id="invite-submit-btn" class="stg-btn-primary" style="flex:1">Send invitation</button>
                                <button type="button" id="invite-cancel-btn" class="stg-btn-ghost">Cancel</button>
                            </div>
                        </div>
                    </div>

                </div>{{-- /users panel --}}
                @endif

                {{-- ── Profile panel ───────────────────────────────── --}}
                <div class="stg-panel stg-hidden" id="stg-tab-profile" role="tabpanel">
                    <h2 style="font-size:16px;font-weight:700;color:#1a2b23;margin-bottom:24px">Profile</h2>

                    {{-- Account section --}}
                    <div class="stg-card" style="margin-bottom:20px">
                        <h3 style="font-size:13px;font-weight:700;color:#3d5c4a;text-transform:uppercase;letter-spacing:.5px;margin-bottom:16px">Account</h3>

                        <div style="margin-bottom:16px">
                            <label class="stg-label" for="profile-name">Name</label>
                            <div style="display:flex;gap:10px;align-items:flex-start">
                                <input type="text" id="profile-name" class="stg-input" value="{{ auth()->user()->name }}" style="flex:1;max-width:320px">
                                <button type="button" id="profile-name-save" class="stg-btn-primary">Save</button>
                            </div>
                            <div id="profile-name-msg" style="font-size:12px;margin-top:6px;display:none"></div>
                        </div>

                        <div>
                            <label class="stg-label">Email</label>
                            <div style="font-size:14px;color:#1a2b23;padding:10px 0">{{ auth()->user()->email }}</div>
                        </div>
                    </div>

                    {{-- Security section --}}
                    <div class="stg-card">
                        <h3 style="font-size:13px;font-weight:700;color:#3d5c4a;text-transform:uppercase;letter-spacing:.5px;margin-bottom:16px">Security</h3>

                        <div>
                            <label class="stg-label">Password</label>
                            @if(!auth()->user()->password_hash)
                            <div style="font-size:13px;color:#6b8878;margin-bottom:10px">You're signing in with Magic Link only.</div>
                            <button type="button" id="set-password-btn" class="stg-btn-primary">Set a password</button>
                            @else
                            <div style="font-size:13px;color:#6b8878;margin-bottom:10px">
                                Last changed: {{ auth()->user()->updated_at?->format('j F Y') }}
                            </div>
                            <button type="button" id="change-password-btn" class="stg-btn-primary">Change password</button>
                            @endif
                        </div>
                    </div>

                    {{-- Set / Change password modal --}}
                    <div id="password-modal" style="display:none;position:fixed;inset:0;background:rgba(0,0,0,0.4);z-index:1000;align-items:center;justify-content:center">
                        <div style="background:#fff;border-radius:12px;padding:32px;width:100%;max-width:420px;box-shadow:0 8px 32px rgba(0,0,0,0.16);font-family:'Barlow',sans-serif;font-size:14px">
                            <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:24px">
                                <h3 id="pw-modal-title" style="font-size:16px;font-weight:700;color:#1a2b23;margin:0">Set password</h3>
                                <button type="button" id="pw-modal-close" style="background:none;border:none;cursor:pointer;color:#6b8878;padding:4px">
                                    <svg width="18" height="18" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2"><path stroke-linecap="round" stroke-linejoin="round" d="M6 18L18 6M6 6l12 12"/></svg>
                                </button>
                            </div>

                            <div id="pw-current-field" style="margin-bottom:16px;display:none">
                                <label style="display:block;font-size:13px;font-weight:600;color:#3d5c4a;margin-bottom:6px">Current password</label>
                                <input type="password" id="pw-current" class="stg-input" style="width:100%" autocomplete="current-password">
                                <a href="#" id="pw-forgot-link" style="font-size:12px;color:#2da85e;display:block;margin-top:6px">Forgot current password? Send Magic Link</a>
                            </div>
                            <div style="margin-bottom:16px">
                                <label style="display:block;font-size:13px;font-weight:600;color:#3d5c4a;margin-bottom:6px">New password</label>
                                <input type="password" id="pw-new" class="stg-input" style="width:100%" autocomplete="new-password">
                            </div>
                            <div style="margin-bottom:24px">
                                <label style="display:block;font-size:13px;font-weight:600;color:#3d5c4a;margin-bottom:6px">Confirm password</label>
                                <input type="password" id="pw-confirm" class="stg-input" style="width:100%" autocomplete="new-password">
                            </div>

                            <div id="pw-modal-error" style="display:none;margin-bottom:12px;font-size:13px;color:#dc2626"></div>
                            <div id="pw-modal-success" style="display:none;margin-bottom:12px;font-size:13px;color:#2da85e"></div>

                            <div style="display:flex;gap:10px">
                                <button type="button" id="pw-submit-btn" class="stg-btn-primary" style="flex:1">Save password</button>
                                <button type="button" id="pw-cancel-btn" class="stg-btn-ghost">Cancel</button>
                            </div>
                        </div>
                    </div>

                </div>{{-- /profile panel --}}

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
    sitesTableData:       @json($sitesTableData ?? []),
    activeSiteRole:       @json($activeSiteRole),
    passwordPromptShown:  @json(auth()->user()->password_prompt_shown),
    hasPassword:          @json(!empty(auth()->user()->password_hash)),
    openPasswordModal:    @json(session('open_password_modal', false)),
};
</script>
<script src="{{ $legacyAssetUrl('gilba-variety-traits.js') }}"></script>
<script src="{{ $legacyAssetUrl('settings-init.js') }}"></script>
@endif

@endsection
